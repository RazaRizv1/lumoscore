// Compose and send a NEW support email, and list the ones already sent.
//
// The panel could only ever answer mail that arrived: /lxapi/reply sends to the address on a STORED
// message and deliberately refuses to take a recipient from the request, because that would turn the
// reply box into a way to send mail to anyone. That restriction is right for a reply and is exactly
// what made it impossible to start a conversation -- to chase a listing applicant, to answer someone
// who wrote in from another address, to send anything at all to a person who has not emailed first.
//
// So this endpoint does take the recipient from the caller, which is the whole point of it, and the
// protection moves to where it belongs: requireAdmin, one recipient at a time, and a hard refusal of
// anything with a line break in it.
//
// SENDING RULES ARE THE REPLY'S, deliberately unchanged. FROM is support@mail.lumoscore.com because
// that is the subdomain Resend is authorised to sign for -- sending as @lumoscore.com fails SPF and
// DKIM and lands in spam -- while Reply-To is support@lumoscore.com, so the answer comes back through
// the routing that already exists and shows up in this panel. Divergence here would be invisible
// until something stopped being delivered.
import { requireAdmin } from '../../_lib/adminauth.js';
import { audit } from '../../_lib/audit.js';
import { resendStatuses } from './reply.js';
import { mailHtml } from '../../_lib/mailtemplate.js';

const API = 'https://api.resend.com/emails';
const FROM = 'LumosCore Support <support@mail.lumoscore.com>';
const REPLY_TO = 'support@lumoscore.com';

// Deliberately not a full RFC 5322 grammar: this is a gate, not a parser. What it must catch is a
// recipient carrying a newline, because a header injected there would travel with the message.
const ADDR = /^[^\s@,;:<>"]{1,64}@[A-Za-z0-9.-]{1,185}\.[A-Za-z]{2,24}$/;

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

// mail_sent is created on first use as well as living in _data/admin-schema.sql, so turning this on
// needs no separate migration step against a database that is already serving.
async function ensure(db) {
  await db.prepare(
    'CREATE TABLE IF NOT EXISTS mail_sent ('
    + ' id TEXT PRIMARY KEY, ts INTEGER NOT NULL, to_addr TEXT NOT NULL,'
    + ' subject TEXT, body TEXT, provider TEXT, err TEXT)'
  ).run();
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

  const to = String((b && b.to) || '').trim();
  // Subject and body are checked before the address so the first complaint is about the thing most
  // likely to be missing, rather than about an address the admin has not typed yet.
  const subject = String((b && b.subject) || '').trim();
  const text = String((b && b.body) || '').trim();
  if (!to) return json({ error: 'who is it going to?' }, 400);
  if (!ADDR.test(to)) return json({ error: 'that does not look like an email address' }, 400);
  if (!subject) return json({ error: 'give it a subject' }, 400);
  if (!text) return json({ error: 'write something first' }, 400);
  if (subject.length > 200) return json({ error: 'subject is too long' }, 400);

  let res, out;
  try {
    res = await fetch(API, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      // Both parts: html for what it looks like, text for plain-text clients, screen readers and
      // the spam filters that mark a message down for having no text alternative.
      body: JSON.stringify({ from: FROM, to: [to], subject, text, html: mailHtml(text, { preheader: subject }), reply_to: REPLY_TO }),
    });
    out = await res.json();
  } catch (e) {
    return json({ error: 'send failed', message: String((e && e.message) || e) }, 200);
  }

  const okSend = res.ok && out && out.id;
  const rowId = 's' + Date.now() + '-' + Math.floor(Math.random() * 9973);
  try {
    await ensure(db);
    await db.prepare(
      'INSERT INTO mail_sent (id, ts, to_addr, subject, body, provider, err) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)'
    ).bind(
      rowId, Date.now(), to, subject, text,
      okSend ? out.id : null,
      okSend ? null : JSON.stringify(out || {}).slice(0, 500)
    ).run();
  } catch (_) { /* the mail either went or it did not; a missing log row must not report a false failure */ }

  if (!okSend) {
    // Resend's own wording is passed through: "domain is not verified" and "invalid recipient" need
    // different fixes, and a generic failure would hide which one happened.
    const why = (out && (out.message || (out.error && out.error.message))) || ('HTTP ' + res.status);
    return json({ error: 'not sent', message: why }, 200);
  }
  // Mail leaving the building under the LumosCore name is logged like the other outward-facing
  // actions. The BODY is not stored in the audit trail -- mail_sent already holds it, and the trail
  // is a record of who did what, not a second copy of the correspondence.
  await audit(env, request, 'support.send', rowId, { to, subject });
  return json({ ok: true, id: out.id, to, subject }, 200);
}

// What has been sent from here, newest first, each with what Resend currently says about it. Accepting
// a message is not the same as it arriving, which is why the reply thread shows this too.
export async function onRequestGet({ request, env }) {
  const bad = await requireAdmin(request);
  if (bad) return bad;
  const db = env && env.ADMIN_DB;
  if (!db) return json({ sent: [] }, 200);

  let rows;
  try {
    await ensure(db);
    const r = await db.prepare(
      'SELECT id, ts, to_addr, subject, body, provider, err FROM mail_sent ORDER BY ts DESC LIMIT 100'
    ).all();
    rows = (r && r.results) || [];
  } catch (e) {
    return json({ sent: [], error: String((e && e.message) || e) }, 200);
  }
  // resendStatuses only looks up the most recent handful, which is what keeps a long list from
  // turning into a hundred sequential calls against a 2 req/s limit.
  const sent = await resendStatuses(env && env.RESEND_API_KEY, rows.slice().reverse());
  return json({ sent: sent.reverse() }, 200);
}
