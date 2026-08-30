// /whitepaper — the LumosCore whitepaper as a real page on the site.
//
// Same construction as _legalpages.js and for the same reason: the page is cloned from an
// already-built page (MCP) so it inherits the working shell — header, nav, the theme toggle, the
// footer and all the scripts other transforms inject — and this file only replaces what sits inside
// <main>. Hand-authoring a shell would mean re-deriving every one of those and keeping it in step.
//
// The markup and CSS live beside this file rather than inside it (whitepaper-body.html /
// whitepaper.css). A 33KB document as a JS string literal is exactly where the escaping traps in
// this codebase bite: a lone backslash is stripped on the way out, and </ has to be split. Reading
// the files keeps the content byte-for-byte and keeps this transform readable.
//
// The footer has carried a "Whitepaper" link pointing at "#" on every page since the design was
// finalised. It is wired up here across the whole container, exactly as the legal pages did for
// Privacy, Terms and Support.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const TITLE = 'Whitepaper | LumosCore';
// Under 160 characters. Names what the document argues rather than repeating the site's own pitch.
const DESC = 'The LumosCore whitepaper: fragmentation, interoperability, and a non-custodial '
  + 'architecture for trading, liquidity and cross-chain transfers.';

// ---- shared shell helpers (same contracts as _legalpages.js) --------------------------------------
function replaceMain(html, inner) {
  const open = html.indexOf('<main');
  if (open < 0) return null;
  const gt = html.indexOf('>', open);
  const close = html.lastIndexOf('</main>');
  if (gt < 0 || close < 0 || close < gt) return null;
  return html.slice(0, gt + 1) + inner + html.slice(close);
}
function clearNavActive(html) {
  return html.replace(/(<a[^>]*class=")nx-item active(")/g, '$1nx-item$2')
             .replace(/(<a[^>]*class=")nx-item active( [^"]*")/g, '$1nx-item$2');
}
// The donor carries the MCP page's FAQ and its schema. Left in place they would answer MCP questions
// here and publish a second FAQPage block for a URL that is not an FAQ.
function stripFaq(html) {
  let h = html;
  const cut = (open, close) => {
    const i = h.indexOf(open); if (i < 0) return false;
    const j = h.indexOf(close, i); if (j < 0) return false;
    h = h.slice(0, i) + h.slice(j + close.length); return true;
  };
  cut('<section class="lx-faq"', '</section>');
  cut('<script type="application/ld+json" id="lx-faq-ld">', '</scr' + 'ipt>');
  cut('<style id="lx-faq-css">', '</style>');
  return h;
}
function setHead(html, style) {
  let h = html.replace(/<title>[\s\S]*?<\/title>/, '<title>' + TITLE + '</title>');
  h = h.replace(/<meta name="description" content="[^"]*">/,
    '<meta name="description" content="' + DESC + '">');
  const hi = h.indexOf('</head>');
  return hi < 0 ? h : h.slice(0, hi) + style + h.slice(hi);
}

// ---- content --------------------------------------------------------------------------------------
let MAIN, CSS;
try {
  MAIN = fs.readFileSync(__dirname + '/whitepaper-body.html', 'utf8').trim();
  CSS = fs.readFileSync(__dirname + '/whitepaper.css', 'utf8');
} catch (e) {
  console.error('whitepaper: missing whitepaper-body.html or whitepaper.css — nothing written');
  process.exit(1);
}
// A bare <footer> inside <main> would inherit the site footer's own rules. The document's end matter
// is a div carrying the page's own class instead.
MAIN = MAIN.replace('<footer>', '<div class="wpfoot">').replace('</footer>', '</div>');
if (MAIN.indexOf('<footer') >= 0) {
  console.error('whitepaper: a <footer> survived in the body — aborting'); process.exit(1);
}
const STYLE = '<style id="lx-wp-css">' + CSS.replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map((l) => l.trim()).filter(Boolean).join('') + '</style>';

// The link the footer has always had and never resolved.
const FOOTER = [
  [/(<a[^>]*)href="#"([^>]*>\s*Whitepaper\s*<\/a>)/gi, '$1href="/whitepaper"$2'],
];

let made = 0, wired = 0;
for (const [dev, donor, suffix] of [
  ['desktop', 'lumoscore-mcp.html', '.html'],
  ['mobile', 'lumoscore-mcp-mobile.html', '-mobile.html'],
]) {
  const file = 'lumoscore-aptos-' + dev + '.html';
  let data; try { data = read(file); } catch (e) { continue; }
  let json, s, e; try { ({ json, s, e } = getContents(data)); } catch (err) { continue; }

  const src = json[donor];
  if (typeof src !== 'string') {
    console.error('  ' + file + ': donor ' + donor + ' missing — skipped'); continue;
  }

  const body = replaceMain(stripFaq(src), MAIN);
  if (!body) { console.error('  ' + file + ': no <main> in donor — skipped'); continue; }
  json['lumoscore-whitepaper' + suffix] = clearNavActive(setHead(body, STYLE));
  made++;

  for (const key of Object.keys(json)) {
    let h = json[key]; const before = h;
    for (const [re, to] of FOOTER) h = h.replace(re, to);
    if (h !== before) { json[key] = h; wired++; }
  }

  const ser = JSON.stringify(json).split('</').join('<' + B + '/');
  fs.writeFileSync(file, data.slice(0, s) + ser + data.slice(e), 'utf8');
}
console.log('whitepaper: built ' + made + ' page(s), wired footer link on ' + wired + ' page keys');
