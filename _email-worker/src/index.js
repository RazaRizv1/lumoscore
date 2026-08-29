// Cloudflare Email Worker for the lumoscore.com addresses: support@, info@ and raza@.
//
// FORWARD_TO must match what the routing rule it replaces already delivered to. Cloudflare only
// delivers to VERIFIED destination addresses, so pointing this at the wrong mailbox does not quietly
// send mail elsewhere -- forward() fails, the handler rejects, and real mail bounces.
//
// ORDER: read the message, then FORWARD, then store. Mail delivery is the thing that must not break: if the
// database is unavailable, or the parser trips on an unusual message, the message has already gone to
// the real mailbox and the only thing lost is a copy in the admin panel. The other order would mean a
// bug in here could silently swallow customer email, which is not a trade anyone would make for an
// inbox view.
//
// This is a standalone Worker, not a Pages Function, because only Workers can receive email. It shares
// the same D1 database as the admin panel through the ADMIN_DB binding.
//
// Deploy:  cd _email-worker && npx wrangler deploy
const FORWARD_TO = 'daolumos@gmail.com';

// ---- a small MIME reader ---------------------------------------------------------------------------
// Deliberately dependency-free and deliberately best-effort. It handles what real mail actually is most
// of the time: a single text part, or multipart/alternative where we want the text/plain half, with
// quoted-printable or base64 transfer encoding. Anything it cannot make sense of still gets stored --
// the raw source is kept -- so a message is never lost to a parsing gap, it just displays plainly.
function splitHeaders(raw) {
  const i = raw.indexOf('\r\n\r\n');
  const j = raw.indexOf('\n\n');
  let at, len;
  if (i >= 0 && (j < 0 || i <= j)) { at = i; len = 4; } else if (j >= 0) { at = j; len = 2; } else { return [raw, '']; }
  return [raw.slice(0, at), raw.slice(at + len)];
}

function headerMap(head) {
  const out = {};
  // unfold: a continuation line starts with whitespace and belongs to the header above it
  const lines = head.replace(/\r\n/g, '\n').split('\n');
  let cur = '';
  const push = () => {
    const c = cur.indexOf(':');
    if (c > 0) {
      const k = cur.slice(0, c).trim().toLowerCase();
      if (!(k in out)) out[k] = cur.slice(c + 1).trim();
    }
    cur = '';
  };
  for (const ln of lines) {
    if (/^[ \t]/.test(ln) && cur) { cur += ' ' + ln.trim(); continue; }
    push(); cur = ln;
  }
  push();
  return out;
}

// Quoted-printable encodes BYTES, not characters: "é" arrives as =C3=A9, two bytes of UTF-8. Turning
// each pair straight into a character with fromCharCode produces "Ã©" -- the classic mojibake -- so the
// bytes are collected and decoded as UTF-8 once at the end. Caught by the parser tests; every accented
// character and every € in a support message would have arrived mangled.
function decodeQP(s) {
  const src = s.replace(/=\r?\n/g, '');
  const bytes = [];
  for (let i = 0; i < src.length; i++) {
    if (src[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(src.substr(i + 1, 2))) {
      bytes.push(parseInt(src.substr(i + 1, 2), 16));
      i += 2;
      continue;
    }
    const c = src.charCodeAt(i);
    if (c < 128) { bytes.push(c); continue; }
    // Already-decoded non-ASCII (some senders mix it in): re-encode so the buffer stays valid UTF-8.
    for (const b of new TextEncoder().encode(src[i])) bytes.push(b);
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
}
function decodeB64(s) {
  try {
    const bin = atob(s.replace(/[\r\n]/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch (_) { return s; }
}
function decodeBody(body, enc) {
  const e = String(enc || '').toLowerCase();
  if (e.indexOf('quoted-printable') >= 0) return decodeQP(body);
  if (e.indexOf('base64') >= 0) return decodeB64(body);
  return body;
}

// RFC 2047 encoded-words in a Subject or From, e.g. =?utf-8?B?…?=
function decodeWords(s) {
  return String(s || '').replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (m, cs, enc, txt) => {
    try {
      return enc.toUpperCase() === 'B' ? decodeB64(txt) : decodeQP(txt.replace(/_/g, ' '));
    } catch (_) { return m; }
  });
}

function parse(raw) {
  const [head, body] = splitHeaders(raw);
  const h = headerMap(head);
  const ctype = h['content-type'] || 'text/plain';
  const enc = h['content-transfer-encoding'] || '';
  const out = { headers: h, text: '', html: '' };

  const bm = /boundary="?([^";\r\n]+)"?/i.exec(ctype);
  if (bm) {
    const parts = body.split('--' + bm[1]);
    for (const p of parts) {
      if (!p || p.trim() === '--') continue;
      const [ph, pb] = splitHeaders(p.replace(/^\r?\n/, ''));
      const pmap = headerMap(ph);
      const pct = (pmap['content-type'] || '').toLowerCase();
      const pen = pmap['content-transfer-encoding'] || '';
      // Nested multipart (mixed containing alternative) is common; one level of recursion covers it.
      if (pct.indexOf('multipart/') === 0) {
        const inner = parse(p.replace(/^\r?\n/, ''));
        if (!out.text && inner.text) out.text = inner.text;
        if (!out.html && inner.html) out.html = inner.html;
        continue;
      }
      if (pct.indexOf('text/plain') === 0 && !out.text) out.text = decodeBody(pb, pen);
      else if (pct.indexOf('text/html') === 0 && !out.html) out.html = decodeBody(pb, pen);
    }
  } else if (ctype.toLowerCase().indexOf('text/html') === 0) {
    out.html = decodeBody(body, enc);
  } else {
    out.text = decodeBody(body, enc);
  }
  return out;
}

function nameOf(from) {
  const s = decodeWords(from || '');
  const m = /^\s*"?([^"<]*?)"?\s*</.exec(s);
  return (m && m[1].trim()) || '';
}

async function readAll(stream, limit) {
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) { chunks.push(value.slice(0, Math.max(0, value.length - (total - limit)))); break; }
    chunks.push(value);
  }
  const all = new Uint8Array(Math.min(total, limit));
  let off = 0;
  for (const c of chunks) { all.set(c, off); off += c.length; }
  return new TextDecoder('utf-8', { fatal: false }).decode(all);
}

export default {
  async email(message, env, ctx) {
    // 1. READ THE MESSAGE FIRST -- but do not act on it yet.
    //
    // message.raw is a ReadableStream and a stream can only be read once. forward() consumes it, so
    // reading afterwards yielded nothing and every message was delivered but never stored: the first
    // real test arrived in Gmail with no copy in the panel. Reading first cannot endanger delivery --
    // it is a bounded 1 MB read into memory, and forward() still runs whatever happens here.
    let raw = null;
    try {
      raw = await readAll(message.raw, 1024 * 1024);
    } catch (e) {
      console.log('lumoscore-mail: could not read raw message: ' + ((e && e.message) || e));
    }

    // 2. DELIVERY. Nothing below this line can stop the mail reaching the real mailbox.
    try {
      await message.forward(FORWARD_TO);
    } catch (e) {
      console.log('lumoscore-mail: forward failed: ' + ((e && e.message) || e));
      // If forwarding itself fails, reject so the sender's server retries rather than believing it
      // was delivered. Silently accepting undeliverable mail is worse than a bounce.
      try { message.setReject('Could not deliver'); } catch (_) {}
    }

    // 3. Then keep a copy for the admin panel, best-effort.
    try {
      const db = env && env.ADMIN_DB;
      if (!db) { console.log('lumoscore-mail: no ADMIN_DB binding'); return; }
      if (raw == null) { console.log('lumoscore-mail: nothing to store, raw was unreadable'); return; }
      const p = parse(raw);
      const h = p.headers;
      const id = (h['message-id'] || ('gen-' + Date.now() + '-' + Math.round(Number(message.rawSize) || 0)))
        .replace(/[<>]/g, '').slice(0, 250);
      const subject = decodeWords(h.subject || '(no subject)').slice(0, 500);
      const fromName = nameOf(h.from).slice(0, 120);
  // Bare address out of a possible "Name <addr>" form; null when absent, so reply.js can fall
  // through to from_addr for ordinary mail that carries no Reply-To.
  const replyTo = (function () {
    const v = decodeWords(h['reply-to'] || '');
    if (!v) return null;
    const m = /<([^>]+)>/.exec(v);
    const a = (m ? m[1] : v).trim();
    return a.indexOf('@') > 0 ? a.slice(0, 200) : null;
  })();

      await db.prepare(
        'INSERT OR IGNORE INTO mail (id, ts, to_addr, from_addr, from_name, reply_to, subject, body_text, body_html, size, archived, raw) '
        + 'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 0, ?11)'
      ).bind(
        id, Date.now(),
        String(message.to || '').slice(0, 200),
        String(message.from || '').slice(0, 200),
        fromName, replyTo, subject,
        (p.text || '').slice(0, 200000),
        (p.html || '').slice(0, 400000),
        Number(message.rawSize) || raw.length,
        raw.slice(0, 256 * 1024)
      ).run();
      // INSERT OR IGNORE on the Message-ID: a retried delivery must not create a second row.
      console.log('lumoscore-mail: stored ' + id);
    } catch (e) {
      // Still swallowed: the mail is already delivered, and throwing here would turn a missing copy in
      // an internal tool into a bounce for the sender. But it is LOGGED now -- the first failure was
      // invisible precisely because this catch said nothing, which cost a round trip to diagnose.
      console.log('lumoscore-mail: store failed: ' + ((e && e.message) || e));
    }
  },
};

// Exported for tests; the runtime only uses the default export above.
export { parse, decodeWords, nameOf, headerMap };
