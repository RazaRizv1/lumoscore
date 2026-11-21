// Send a reply to a support message, through Resend.
//
// Receiving and sending are separate systems: Cloudflare Email Routing delivers mail TO us and cannot
// send, so outbound goes through Resend on the verified subdomain mail.lumoscore.com.
//
// FROM vs REPLY-TO is the important part. The message is sent FROM the sender's address on
// mail.lumoscore.com, because that is the domain Resend is authorised to sign for -- sending as
// @lumoscore.com would fail SPF and DKIM and land in spam. But Reply-To is that person's real
// @lumoscore.com address, so when the customer answers it goes back through the routing we already
// have and lands in BOTH the real mailbox and this panel. Without that header the conversation would
// dead-end at a subdomain nothing listens to.
//
// WHO IT GOES OUT AS (2026-11-17). This used to be hardcoded to Support, so a mail addressed to
// raza@ or abeeha@ was always answered by "LumosCore Support". Now the panel may pass a sender KEY,
// and when it does not, the sender is chosen from the address the mail was SENT TO -- answering as
// the person it was addressed to is the right default, and getting it wrong is silent: the customer
// simply hears back from the wrong person. Never an address from the caller; see _lib/mailsenders.js.
import { requireAdmin } from '../../_lib/adminauth.js';
import { audit } from '../../_lib/audit.js';
import { mailHtml } from '../../_lib/mailtemplate.js';
import { pickSender } from '../../_lib/mailsenders.js';
// A formatted reply is sanitised to an allowlist and its plain-text half derived from the result --
// the same treatment the compose path gets, and for the same reason: see _lib/mailbody.js.
import { sanitiseMailHtml, mailHtmlToText } from '../../_lib/mailbody.js';

const API = 'https://api.resend.com/emails';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

// from_addr was added to mail_reply after the table shipped, so the ALTER has to be tolerated failing
// on a database that already has it -- D1 has no ADD COLUMN IF NOT EXISTS. Same shape as mail_sent's,
// and called on the READ path too so the thread view never hits a column that is not there yet.
async function ensure(db) {
  try { await db.prepare('ALTER TABLE mail_reply ADD COLUMN from_addr TEXT').run(); } catch (_) {}
  // body stays the PLAIN text, so every existing reader keeps working; body_html is the formatted
  // copy, present only on replies written in the rich editor.
  try { await db.prepare('ALTER TABLE mail_reply ADD COLUMN body_html TEXT').run(); } catch (_) {}
}

export async function onRequestPost({ request, env }) {
  const bad = await requireAdmin(request);
  if (bad) return bad;

  const key = env && env.RESEND_API_KEY;
  if (!key) return json({ error: 'RESEND_API_KEY is not set on this project' }, 200);
  const db = env && env.ADMIN_DB;
  if (!db) return json({ error: 'no ADMIN_DB binding' }, 200);

  let b;
  try { b = await request.json(); } catch (_) { return json({ error: 'bad json' }, 400); }
  const mailId = String((b && b.id) || '');
  // A formatted reply arrives as markup and is cut down to the allowlist here; the plain-text half is
  // then DERIVED from what survived, so the two halves cannot disagree. With no markup this is the
  // plain-text path exactly as it was.
  const safeHtml = sanitiseMailHtml((b && b.html) || '');
  const text = safeHtml ? mailHtmlToText(safeHtml) : String((b && b.body) || '').trim();
  if (!mailId) return json({ error: 'id required' }, 400);
  if (!text) return json({ error: 'write something first' }, 400);

  // The recipient comes from the STORED message, never from the request body. Taking it from the
  // caller would turn an authenticated reply box into a way to send mail to anyone.
  let msg;
  try { msg = await db.prepare('SELECT id, to_addr, from_addr, from_name, subject, reply_to FROM mail WHERE id = ?1').bind(mailId).first(); }
  catch (e) { return json({ error: 'lookup failed' }, 500); }
  if (!msg) return json({ error: 'no such message' }, 404);

  const subject = /^re:/i.test(msg.subject || '') ? msg.subject : ('Re: ' + (msg.subject || '(no subject)'));
  // The panel's From picker if it sent one, otherwise whoever the mail was addressed to.
  const who = pickSender(b && b.from, msg.to_addr);

  let res, out;
  try {
    res = await fetch(API, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: who.from,
        to: [msg.reply_to || msg.from_addr],
        subject,
        text,
        // The same wrapper the compose path uses, so a reply and a new message look like the same
        // company. The plain-text part stays, for the reasons given in the template.
        // No title: this lands inside a thread the customer started, and "Re: ..." set as a 20px
        // heading reads like a machine answered. It is signed, though -- same person, same footer.
        html: mailHtml(text, { preheader: subject, sender: who, html: safeHtml }),
        reply_to: who.replyTo,
        // Threading. The stored id IS the original Message-ID with its angle brackets stripped, so they
        // go back on here -- without these the reply shows up as a new conversation in the customer's
        // client rather than under the message they sent.
        headers: {
          'In-Reply-To': '<' + msg.id + '>',
          References: '<' + msg.id + '>',
        },
      }),
    });
    out = await res.json();
  } catch (e) {
    return json({ error: 'send failed', message: String((e && e.message) || e) }, 200);
  }

  const okSend = res.ok && out && out.id;
  const rowId = 'r' + Date.now() + '-' + Math.abs((mailId.length * 31) % 9973);
  try {
    await ensure(db);
    await db.prepare(
      'INSERT INTO mail_reply (id, mail_id, ts, to_addr, subject, body, provider, err, from_addr, body_html) '
      + 'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)'
    ).bind(
      rowId, mailId, Date.now(), msg.from_addr, subject, text,
      okSend ? out.id : null,
      okSend ? null : JSON.stringify(out || {}).slice(0, 500),
      who.addr,
      safeHtml || null
    ).run();
  } catch (_) { /* the mail either went or it did not; a missing log row must not report a false failure */ }

  if (!okSend) {
    // Resend's own message is passed through: "domain not verified" and "invalid recipient" need
    // different fixes, and a generic failure would hide which one happened.
    const why = (out && (out.message || (out.error && out.error.message))) || ('HTTP ' + res.status);
    return json({ error: 'not sent', message: why }, 200);
  }
  // A support reply is an email leaving the building under the LumosCore name, so it is logged
  // like the other outward-facing actions. The BODY is not stored -- mail_reply already holds it, and
  // the audit trail is a record of who did what, not a second copy of customer correspondence.
  await audit(env, request, 'support.reply', mailId, { to: msg.reply_to || msg.from_addr, subject, from: who.addr });
  return json({ ok: true, id: out.id, to: msg.reply_to || msg.from_addr, subject, from: who.addr }, 200);
}

// DID IT ARRIVE? Resend accepting a reply is not the recipient getting it -- delivery, a bounce or a spam
// complaint happen afterwards, and Resend is the only one that knows (Cloudflare only RECEIVES our mail; it
// never sees what we send). So each reply's current state is read from Resend when the thread is opened,
// with the key that already lives in this project's environment: it never reaches the browser, and this
// runs only behind requireAdmin. Asked for RAZA on 2026-09-22 after a reply to v.babaiev@legarithm.io
// showed only "sent" with no way to tell whether it landed.
//
// Kept deliberately small: the latest event only, sequential calls (Resend's default limit is 2 req/s and
// a thread holds a handful of replies at most), a short timeout, and any failure answers "unknown" rather
// than failing the thread -- the replies themselves must always show.
const RESEND_EVENT = {
  delivered: 'delivered', opened: 'opened', clicked: 'opened',
  bounced: 'bounced', complained: 'complained', failed: 'failed',
  delivery_delayed: 'delayed', sent: 'sent', queued: 'sent', scheduled: 'sent',
};
export async function resendStatuses(key, replies, fetchImpl) {
  const f = fetchImpl || fetch;
  const out = replies.map((r) => Object.assign({}, r, { status: null }));
  if (!key) return out;
  const recent = out.filter((r) => r.provider && !r.err).slice(-10);
  for (const r of recent) {
    try {
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const t = ctl ? setTimeout(() => ctl.abort(), 5000) : null;
      const res = await f(API + '/' + encodeURIComponent(r.provider), {
        headers: { authorization: 'Bearer ' + key },
        signal: ctl ? ctl.signal : undefined,
      });
      if (t) clearTimeout(t);
      if (!res.ok) { r.status = 'unknown'; continue; }
      const d = await res.json();
      const ev = String((d && d.last_event) || '').toLowerCase();
      r.status = RESEND_EVENT[ev] || 'unknown';
    } catch (_) {
      r.status = 'unknown';
    }
  }
  return out;
}

// Replies already sent for one message, so the panel can show the thread rather than just the inbound half.
export async function onRequestGet({ request, env }) {
  const bad = await requireAdmin(request);
  if (bad) return bad;
  const db = env && env.ADMIN_DB;
  if (!db) return json({ replies: [] }, 200);
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!id) return json({ error: 'id required' }, 400);
  let rows;
  try {
    await ensure(db);
    const r = await db.prepare('SELECT id, ts, to_addr, subject, body, provider, err, from_addr, body_html FROM mail_reply WHERE mail_id = ?1 ORDER BY ts ASC').bind(id).all();
    rows = (r && r.results) || [];
  } catch (e) {
    return json({ replies: [], error: String((e && e.message) || e) }, 200);
  }
  const replies = await resendStatuses(env && env.RESEND_API_KEY, rows);
  return json({ replies }, 200);
}
