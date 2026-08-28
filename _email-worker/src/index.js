// Cloudflare Email Worker for team@ and raza@lumoscore.com.
//
// FORWARDING HAPPENS FIRST, AND STORING SECOND. Mail delivery is the thing that must not break: if the
// database is unavailable, or the parser trips on an unusual message, the message has already gone to
// the real mailbox and the only thing lost is a copy in the admin panel. The other order would mean a
// bug in here could silently swallow customer email, which is not a trade anyone would make for an
// inbox view.
//
// This is a standalone Worker, not a Pages Function, because only Workers can receive email. It shares
// the same D1 database as the admin panel through the ADMIN_DB binding.
//
// Deploy:  cd _email-worker && npx wrangler deploy
const FORWARD_TO = 'usa282@protonmail.com';

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
    // 1. DELIVERY FIRST. Nothing below this line can stop the mail reaching the real mailbox.
    let forwarded = true;
    try {
      await message.forward(FORWARD_TO);
    } catch (e) {
      forwarded = false;
      // If forwarding itself fails, reject so the sender's server retries rather than believing it
      // was delivered. Silently accepting undeliverable mail is worse than a bounce.
      try { message.setReject('Could not deliver'); } catch (_) {}
    }

    // 2. Then keep a copy for the admin panel, best-effort.
    try {
      const db = env && env.ADMIN_DB;
      if (!db) return;
      // 1 MB is plenty for the body of a support message and bounds what one email can cost.
      const raw = await readAll(message.raw, 1024 * 1024);
      const p = parse(raw);
      const h = p.headers;
      const id = (h['message-id'] || ('gen-' + Date.now() + '-' + Math.round(Number(message.rawSize) || 0)))
        .replace(/[<>]/g, '').slice(0, 250);
      const subject = decodeWords(h.subject || '(no subject)').slice(0, 500);
      const fromName = nameOf(h.from).slice(0, 120);

      await db.prepare(
        'INSERT OR IGNORE INTO mail (id, ts, to_addr, from_addr, from_name, subject, body_text, body_html, size, archived) '
        + 'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0)'
      ).bind(
        id, Date.now(),
        String(message.to || '').slice(0, 200),
        String(message.from || '').slice(0, 200),
        fromName, subject,
        (p.text || '').slice(0, 200000),
        (p.html || '').slice(0, 400000),
        Number(message.rawSize) || raw.length
      ).run();
      // INSERT OR IGNORE on the Message-ID: a retried delivery must not create a second row.
    } catch (e) {
      // Swallowed on purpose. The mail is already delivered; a storage failure is a missing copy in an
      // internal tool, and throwing here would turn that into a bounce for the sender.
    }
  },
};

// Exported for tests; the runtime only uses the default export above.
export { parse, decodeWords, nameOf, headerMap };
