// Send a reply to a support message, through Resend.
//
// Receiving and sending are separate systems: Cloudflare Email Routing delivers mail TO us and cannot
// send, so outbound goes through Resend on the verified subdomain mail.lumoscore.com.
//
// FROM vs REPLY-TO is the important part. The message is sent FROM support@mail.lumoscore.com, because
// that is the domain Resend is authorised to sign for -- sending as @lumoscore.com would fail SPF and
// DKIM and land in spam. But Reply-To is support@lumoscore.com, so when the customer answers it goes
// back through the routing we already have and lands in BOTH the real mailbox and this panel. Without
// that header the conversation would dead-end at a subdomain nothing listens to.
import { requireAdmin } from '../../_lib/adminauth.js';
import { audit } from '../../_lib/audit.js';

const API = 'https://api.resend.com/emails';
const FROM = 'LumosCore Support <support@mail.lumoscore.com>';
const REPLY_TO = 'support@lumoscore.com';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
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
  const text = String((b && b.body) || '').trim();
  if (!mailId) return json({ error: 'id required' }, 400);
  if (!text) return json({ error: 'write something first' }, 400);

  // The recipient comes from the STORED message, never from the request body. Taking it from the
  // caller would turn an authenticated reply box into a way to send mail to anyone.
  let msg;
  try { msg = await db.prepare('SELECT id, from_addr, from_name, subject, reply_to FROM mail WHERE id = ?1').bind(mailId).first(); }
  catch (e) { return json({ error: 'lookup failed' }, 500); }
  if (!msg) return json({ error: 'no such message' }, 404);

  const subject = /^re:/i.test(msg.subject || '') ? msg.subject : ('Re: ' + (msg.subject || '(no subject)'));

  let res, out;
  try {
    res = await fetch(API, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [msg.reply_to || msg.from_addr],
        subject,
        text,
        reply_to: REPLY_TO,
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
    await db.prepare(
      'INSERT INTO mail_reply (id, mail_id, ts, to_addr, subject, body, provider, err) '
      + 'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)'
    ).bind(
      rowId, mailId, Date.now(), msg.from_addr, subject, text,
      okSend ? out.id : null,
      okSend ? null : JSON.stringify(out || {}).slice(0, 500)
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
  await audit(env, request, 'support.reply', mailId, { to: msg.reply_to || msg.from_addr, subject });
  return json({ ok: true, id: out.id, to: msg.reply_to || msg.from_addr, subject }, 200);
}

// Replies already sent for one message, so the panel can show the thread rather than just the inbound half.
export async function onRequestGet({ request, env }) {
  const bad = await requireAdmin(request);
  if (bad) return bad;
  const db = env && env.ADMIN_DB;
  if (!db) return json({ replies: [] }, 200);
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!id) return json({ error: 'id required' }, 400);
  try {
    const r = await db.prepare('SELECT id, ts, to_addr, subject, body, provider, err FROM mail_reply WHERE mail_id = ?1 ORDER BY ts ASC').bind(id).all();
    return json({ replies: (r && r.results) || [] }, 200);
  } catch (e) {
    return json({ replies: [], error: String((e && e.message) || e) }, 200);
  }
}
