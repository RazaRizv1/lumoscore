// Move the end-of-body inline scripts out of every built page and into cacheable files.
//
// WHY. RAZA 2026-09-17: "Pages are loading really slowly. Its frustrating... after i click on the page, it takes to long
// to even respond to it. It just stays there for a couple seconds and then it starts loading the new page."
//
// Measured before writing this, on the staging build:
//
//   Trade-Asset page   1,641 KB of HTML, of which 1,247 KB is INLINE SCRIPT in 51 blocks
//   head               6 blocks,    8 KB   <- anti-flash and route gates, must run before paint
//   end of body        45 blocks, 1,239 KB <- the data layers
//   cold navigation    487 KB transferred, 1,644 KB decoded, DOMContentLoaded 2,380 ms
//
// Every one of those bytes is re-downloaded and re-parsed on EVERY navigation, because a script inside an HTML document
// cannot be cached separately from it. Six pages into a session the browser has parsed the same seven megabytes of
// layer code six times. That is the couple of seconds.
//
// WHAT THIS DOES. Each end-of-body inline block is written to /assets/js/lx-<hash-of-its-contents>.js and replaced by a
// deferred <script src>. `/assets/*` already carries `Cache-Control: public, max-age=31536000, immutable` in _headers,
// and the name is a hash of the contents, so a file is downloaded once per visitor, ever, and shared by every page that
// carries that layer -- which is most of them.
//
// WHAT IT DELIBERATELY DOES NOT TOUCH:
//   * anything in <head>. Those gates run BEFORE first paint on purpose; deferring them would reintroduce exactly the
//     flash bugs GUARDRAILS section B exists to prevent.
//   * anything with a src already, or any block containing document.write (measured: none do), which defer breaks.
//
// WHY `defer` IS SAFE HERE. An inline script at the end of <body> executes during parsing, after all the markup above it
// exists, and before DOMContentLoaded. A deferred external script executes after parsing, in document order, and also
// before DOMContentLoaded. For a block sitting at the end of the body those are the same guarantees: full DOM, same
// relative order, same event. That equivalence is the entire argument for doing this, and it is why the head is excluded.
//
// Usage: node _tools/_externalize.js   (runs as part of `npm run build`)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIST = path.join(__dirname, '..', 'dist');
const OUTDIR = path.join(DIST, 'assets', 'js');

if (!fs.existsSync(DIST)) { console.error('externalize: no dist/ — run the build first'); process.exit(1); }
fs.mkdirSync(OUTDIR, { recursive: true });

// Written fresh each build: a block whose contents changed gets a new hash and a new file, and last build's file would
// otherwise sit there forever. Only our own generated names are removed.
for (const f of fs.readdirSync(OUTDIR)) {
  if (/^lx-[0-9a-f]{12}\.js$/.test(f)) fs.unlinkSync(path.join(OUTDIR, f));
}

const files = fs.readdirSync(DIST).filter((f) => f.endsWith('.html'));
const written = new Map();          // hash -> bytes, so a layer shared by 90 pages is written once
let pages = 0, moved = 0, bytes = 0;

for (const name of files) {
  const file = path.join(DIST, name);
  let html = fs.readFileSync(file, 'utf8');
  const headEnd = html.indexOf('</head>');
  if (headEnd < 0) continue;

  let changed = 0;
  // Rebuilt rather than replaced in place: every match shifts the offsets after it, and the head boundary has to be
  // judged against the ORIGINAL string, so the cursor walks forward and the output is assembled as it goes.
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
  let out = '', last = 0, m;
  while ((m = re.exec(html))) {
    const [whole, attrs, body] = m;
    const at = m.index;
    if (at < headEnd) continue;                       // head gates stay exactly where they are
    if (/\bsrc\s*=/.test(attrs)) continue;            // already external
    if (/\btype\s*=\s*["'](?!text\/javascript)/i.test(attrs)) continue;   // JSON-LD and friends are data, not code
    if (body.indexOf('document.write') >= 0) continue;
    if (body.trim().length < 2048) continue;          // a small block costs more as a request than it saves

    const hash = crypto.createHash('sha1').update(body).digest('hex').slice(0, 12);
    const jsName = 'lx-' + hash + '.js';
    if (!written.has(hash)) {
      fs.writeFileSync(path.join(OUTDIR, jsName), body, 'utf8');
      written.set(hash, Buffer.byteLength(body));
    }
    const id = (attrs.match(/id="([^"]+)"/) || [])[1];
    // The id travels with it. predeploy_check finds blocks by `<script id="lx-...">` and some layers look themselves up
    // by id to avoid double-injection; losing it would break both quietly.
    out += html.slice(last, at) + '<script' + (id ? ' id="' + id + '"' : '') + ' src="/assets/js/' + jsName + '" defer></' + 'script>';
    last = at + whole.length;
    changed++;
    moved++;
    bytes += Buffer.byteLength(body);
  }
  if (!changed) continue;
  out += html.slice(last);
  fs.writeFileSync(file, out, 'utf8');
  pages++;
}

let total = 0;
for (const b of written.values()) total += b;
console.log('externalize: ' + moved + ' script block(s) moved off ' + pages + ' page(s) — '
  + (bytes / 1048576).toFixed(1) + ' MB of inline script now '
  + written.size + ' cacheable file(s) totalling ' + (total / 1024).toFixed(0) + ' KB');
