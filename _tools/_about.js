// /about — the company page.
//
// Same donor-clone construction as _whitepaper.js and _legalpages.js: cloned from the built MCP page
// so the header, nav, theme toggle and footer come from the working shell, and this replaces only
// what sits inside <main>.
//
// The narrative half is drawn from the whitepaper the founders wrote — the CEX-to-multichain arc and
// the thesis are their words, condensed. The facts half is drawn from things verified in the code:
// the fee rates from _feerate.js, the eight CCTP destinations after confirming the others are
// display:none on the bridge, the registry number from the whitepaper's imprint.
//
// Every class is prefixed ab-. Scoping under .lxab stops us reaching the site's shell; prefixing
// stops the site's own .hero/.card/.note rules reaching in.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const TITLE = 'About | LumosCore';
// Under 160 characters, so a result shows the whole sentence instead of cutting it mid-clause.
const DESC = 'Multichain Web3 infrastructure from LumosCore OÜ: one interface for trading, '
  + 'liquidity, token issuance and cross-chain transfers, custody left to you.';

// ---- shared shell helpers -------------------------------------------------------------------------
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

let CSS, MAIN;
try {
  CSS = fs.readFileSync(__dirname + '/about.css', 'utf8');
  MAIN = withRail(fs.readFileSync(__dirname + '/about.html', 'utf8').trim());
} catch (e) {
  console.error('about: missing about.css or about.html — nothing written');
  process.exit(1);
}
// The contents rail, derived from the markup rather than written into it -- the same approach the
// legal pages use, and for the same reason: six section headings that would otherwise have to be
// given ids and numbers by hand, and renumbered by hand every time one moves.
//
// Splits the masthead off the top, numbers each <h2> and slugs it, and emits the rail from the same
// pass so the list and the headings can never disagree. Returns the markup untouched if the masthead
// is not shaped as expected.
function withRail(html) {
  const top = html.indexOf('</div>', html.indexOf('ab-top'));
  if (top < 0) return html;
  const headEnd = top + 6;
  const head = html.slice(0, headEnd);
  let body = html.slice(headEnd);

  const items = [];
  body = body.replace(/<h2>([\s\S]*?)<\/h2>/g, (m, txt) => {
    const plain = txt.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').trim();
    const id = 'ab-' + plain.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    items.push({ id, text: plain });
    return '<h2 id="' + id + '"><span class="ab-n">'
      + String(items.length).padStart(2, '0') + '</span><span>' + txt + '</span></h2>';
  });
  if (items.length < 3) return html;

  const rail = '<nav class="ab-toc" aria-label="Contents"><p class="ab-toc-h">On this page'
    + '<span class="ab-toc-c">' + items.length + ' sections</span></p><ol>'
    + items.map((it, i) => '<li><a href="#' + it.id + '"><span class="ab-tn">'
        + String(i + 1).padStart(2, '0') + '</span><span>' + it.text + '</span></a></li>').join('')
    + '</ol></nav>';

  return head + '<div class="ab-body">' + rail + '<article class="ab-art">' + body + '</article></div>';
}

const STYLE = '<style id="lx-about-css">' + CSS.replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map((l) => l.trim()).filter(Boolean).join('') + '</style>';

// The footer's "About" link has pointed at "#" since the design was finalised.
const FOOTER = [
  [/(<a[^>]*)href="#"([^>]*>\s*About\s*<\/a>)/gi, '$1href="/about"$2'],
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
  json['lumoscore-about' + suffix] = clearNavActive(setHead(body, STYLE));
  made++;

  for (const key of Object.keys(json)) {
    let h = json[key]; const before = h;
    for (const [re, to] of FOOTER) h = h.replace(re, to);
    if (h !== before) { json[key] = h; wired++; }
  }

  const ser = JSON.stringify(json).split('</').join('<' + B + '/');
  fs.writeFileSync(file, data.slice(0, s) + ser + data.slice(e), 'utf8');
}
console.log('about: built ' + made + ' page(s), wired footer link on ' + wired + ' page keys');
