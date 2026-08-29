// Cloudflare Pages Function — the public support form.
//
// It emails team@lumoscore.com with the sender's address as reply-to, so a message lands in the inbox
// the admin Support page already reads and replying from there goes straight back to the person who
// wrote in. No ticket store, no second place to check.
//
// THIS ENDPOINT SENDS EMAIL AND IS PUBLIC, which makes it a spam relay unless it is nailed shut. So:
//   * the recipient is a constant here and can never be influenced by the request body
//   * every field is length-capped before it reaches the mail body
//   * header-injection characters are stripped from anything that lands in a header (subject, reply-to)
//   * one submission per IP per 30s, and 5 per hour, held in the same KV the rest of the site uses
//   * a missing or malformed body is rejected before any of that
//
// It deliberately does NOT verify the address. A support form that makes you confirm an email before it
// will carry your problem is a support form people give up on.
const TO = 'team@lumoscore.com';
const FROM = 'LumosCore Support <support@lumoscore.com>';

const LIMITS = { email: 254, name: 80, subject: 160, message: 5000, wallet: 60, txHash: 80 };
const WINDOW_S = 30;        // shortest gap between two messages from one address
const HOURLY_MAX = 5;

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

// Anything reaching a mail header must not be able to start a new one.
function header(s) {
  return String(s || '').replace(/[\r\n]+/g, ' ').trim();
}
function clip(s, n) {
  s = String(s == null ? '' : s);
  return s.length > n ? s.slice(0, n) : s;
}
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
// Deliberately loose: the job is to catch a typo and a header-injection attempt, not to adjudicate
// what a valid address looks like. Over-strict validation turns away real people.
function plausibleEmail(s) {
  if (!s || s.length > LIMITS.email) return false;
  if (/[\r\n\s,;]/.test(s)) return false;
  const at = s.indexOf('@');
  return at > 0 && at < s.length - 3 && s.indexOf('.', at) > at + 1;
}

export async function onRequestPost(ctx) {
  const { request, env } = ctx;

  let b;
  try { b = await request.json(); } catch (_) { return json({ ok: false, error: 'bad request' }, 400); }
  if (!b || typeof b !== 'object') return json({ ok: false, error: 'bad request' }, 400);

  const email = header(clip(b.email, LIMITS.email));
  const subject = header(clip(b.subject, LIMITS.subject));
  const message = clip(b.message, LIMITS.message);
  const name = header(clip(b.name, LIMITS.name));
  const wallet = header(clip(b.wallet, LIMITS.wallet));
  const txHash = header(clip(b.txHash, LIMITS.txHash));

  if (!plausibleEmail(email)) return json({ ok: false, error: 'enter a valid email address' }, 400);
  if (!subject) return json({ ok: false, error: 'add a subject' }, 400);
  if (!message.trim()) return json({ ok: false, error: 'add a message' }, 400);

  // ---- rate limit ---------------------------------------------------------------------------------
  // Keyed on the connecting IP. Best-effort by design: if KV is unavailable the message still goes,
  // because losing a real support request is worse than letting one extra through.
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const kv = env && env.CONTENT_KV;
  if (kv && ip !== 'unknown') {
    try {
      const burst = 'sup:rl:' + ip;
      if (await kv.get(burst)) {
        return json({ ok: false, error: 'You just sent one — give it a moment before sending another.' }, 429);
      }
      const hourKey = 'sup:hr:' + ip + ':' + Math.floor(Date.now() / 3600000);
      const n = parseInt((await kv.get(hourKey)) || '0', 10) || 0;
      if (n >= HOURLY_MAX) {
        return json({ ok: false, error: 'Too many messages from here in the last hour. Email ' + TO + ' directly.' }, 429);
      }
      await kv.put(burst, '1', { expirationTtl: WINDOW_S });
      await kv.put(hourKey, String(n + 1), { expirationTtl: 3700 });
    } catch (_) { /* never block a real message on the limiter failing */ }
  }

  const key = env && env.RESEND_API_KEY;
  if (!key) return json({ ok: false, error: 'Support is temporarily unavailable. Email ' + TO + ' directly and we will pick it up.' }, 503);

  const who = name ? name + ' <' + email + '>' : email;
  const rows = [
    ['From', who],
    ['Wallet', wallet || '—'],
    ['Transaction', txHash || '—'],
    ['Received', new Date().toISOString()],
  ];
  const html = '<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6">'
    + '<table style="border-collapse:collapse;margin-bottom:18px;font-size:13.5px">'
    + rows.map((r) => '<tr><td style="padding:2px 14px 2px 0;color:#777">' + esc(r[0])
        + '</td><td style="padding:2px 0"><b>' + esc(r[1]) + '</b></td></tr>').join('')
    + '</table>'
    + '<div style="white-space:pre-wrap">' + esc(message) + '</div></div>';

  const text = rows.map((r) => r[0] + ': ' + r[1]).join('\n') + '\n\n' + message;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        // the whole point: hitting Reply in the inbox answers the person who wrote in
        reply_to: email,
        subject: '[Support] ' + subject,
        html,
        text,
      }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.log('support: resend ' + r.status + ' ' + detail.slice(0, 200));
      return json({ ok: false, error: 'could not send' }, 502);
    }
  } catch (e) {
    console.log('support: ' + ((e && e.message) || e));
    return json({ ok: false, error: 'could not send' }, 502);
  }

  return json({ ok: true }, 200);
}

// A GET here is someone poking at the URL, not a browser that needs anything.
export function onRequestGet() {
  return json({ ok: false, error: 'post a message' }, 405);
}
