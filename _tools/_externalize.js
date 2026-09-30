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

// ---------------------------------------------------------------------------------------------
// SECOND PASS: LIFT THE lx-* STYLESHEETS OUT OF THE BODY AND INTO <head>.
//
// WHY. Almost every layer on this site injects its CSS immediately before </body>, which means the
// browser paints the page BEFORE that CSS exists and then repaints it once the parser gets there.
// That is a flash on every load, and on the landing page it is the whole hero: photographed on a
// phone, the headline rendered as unstyled italic with no line break and the orbit ring rendered as
// a raw grid of square tiles, before snapping into place. Measured on the built mobile landing
// page: 25 of its 51 lx-* stylesheets sat after </head>, including lx-herounify-css, which owns the
// hero outright.
//
// EVERY BODY <style> MOVES, NOT JUST THE lx-* ONES -- and that distinction is the whole safety
// argument. An earlier version of this hoisted only `<style id="lx-...">`, on the strength of a
// check that said every body stylesheet was an lx-* block. That check was run on the landing page
// and the wallet, and it does not hold site-wide: /bridge/stellar carries the design's own
// `<style id="br-css">` in its body. Measured against production, which still has the old order:
// all 16 lx-* body blocks sit AFTER br-css there, so they override it -- and hoisting only the
// lx-* ones would have left br-css below them and handed it the win on every tie. That is a silent
// restyle of the bridge page, and it nearly shipped.
//
// Taking all of them, in the order they appear, preserves every relationship among them exactly.
// They land at the END of <head>, so they still come after the design's head stylesheets, which is
// where they were already winning from. The cascade is therefore unchanged; only the paint timing
// moves. There is no <link rel="stylesheet"> in the body of any built page.
//
// WHY HERE RATHER THAN IN EACH TRANSFORM. There are 25+ of them; editing every one would be a large
// change with 25 chances to get an injection point wrong, and the next transform anyone writes
// would reintroduce the flash. This runs on every page on every build, so the fix cannot be undone
// by re-running a layer.
function hoistStyles(html) {
  const headEnd = html.indexOf('</head>');
  if (headEnd < 0) return html;
  // A <style> INSIDE AN <svg> IS NOT A PAGE STYLESHEET and must not be hoisted: it scopes to that
  // document fragment, and lifting it into <head> both breaks the drawing and leaks its rules to the
  // whole page. Three dex pages carry one. Their ranges are collected first so matches inside them
  // can be skipped.
  const svg = [];
  for (const s of html.matchAll(/<svg\b[\s\S]*?<\/svg>/g)) svg.push([s.index, s.index + s[0].length]);
  const inSvg = (i) => svg.some((r) => i >= r[0] && i < r[1]);

  // Non-greedy to the first closing tag: CSS cannot contain "</style>" without having already ended
  // the element, so there is no longer match to miss. No id is required -- see the header for why
  // restricting this to lx-* was wrong.
  const re = /<style\b[^>]*>[\s\S]*?<\/style>/g;
  const blocks = [];
  let out = '', last = 0, m;
  while ((m = re.exec(html))) {
    if (m.index < headEnd) continue;            // already in head: leave it exactly where it is
    if (inSvg(m.index)) continue;               // belongs to the drawing, not the page
    blocks.push(m[0]);
    out += html.slice(last, m.index);
    last = m.index + m[0].length;
  }
  if (!blocks.length) return html;
  out += html.slice(last);
  // Every removal was after </head>, so its offset has not moved.
  const hi = out.indexOf('</head>');
  if (hi < 0) return html;
  return out.slice(0, hi) + blocks.join('') + out.slice(hi);
}

const files = fs.readdirSync(DIST).filter((f) => f.endsWith('.html'));
const written = new Map();          // hash -> bytes, so a layer shared by 90 pages is written once
let pages = 0, moved = 0, bytes = 0, hoistedPages = 0;

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
  out = changed ? out + html.slice(last) : html;

  const hoisted = hoistStyles(out);
  if (hoisted !== out) { out = hoisted; hoistedPages++; }

  if (out === html) continue;
  fs.writeFileSync(file, out, 'utf8');
  pages++;
}

let total = 0;
for (const b of written.values()) total += b;
console.log('externalize: ' + moved + ' script block(s) moved off ' + pages + ' page(s) — '
  + (bytes / 1048576).toFixed(1) + ' MB of inline script now '
  + written.size + ' cacheable file(s) totalling ' + (total / 1024).toFixed(0) + ' KB');
