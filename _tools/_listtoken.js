// /list-your-token — the public curated-listing application.
//
// Same donor-clone construction as _about.js and _whitepaper.js: cloned from the built MCP page, so
// the header, the connect-wallet modal, the theme toggle and the footer all come from the working
// shell and this replaces only what sits inside <main>. Cloning the MCP page in particular matters
// here: it already carries window.lxwOpenWallet and the WalletConnect signer, which is what lets a
// phone pay without this page shipping a second wallet stack.
//
// THE SIGNER IS NOT COPIED. It is lifted out of _launchpad.js by name at build time and spliced into
// the browser script, so Freighter / Albedo / Rabet / xBull / LOBSTR / WalletConnect have exactly one
// implementation on the site. If the launchpad's signer is renamed or reshaped this build FAILS
// LOUDLY rather than shipping a page whose pay button silently does nothing.
//
// Every class is prefixed lt- and scoped under .lxlt, for the reason About documents: the site's own
// .hero / .card / .note / .sep rules would otherwise reach into this page, and this page's would
// reach out.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const TITLE = 'List your token | LumosCore';
const DESC = 'Apply for a curated listing on LumosCore. $250, paid in XLM, refunded in full if the '
  + 'listing is declined. Reviewed by a person, not a script.';

// ---- shared shell helpers (identical to _about.js) --------------------------------------------------
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

// ---- the signer, taken from the launchpad ----------------------------------------------------------
// Names, in the order they must appear: lxLpMod is used by lxLpSignXdr, lxLpFreighter by both the
// default branch and the address resolver.
const SIGNER_FNS = ['lxLpSdk', 'lxLpFreighter', 'lxLpWalletId', 'lxLpConnectedAddr', 'lxLpMod',
  'lxLpResolveAddr', 'lxLpSignXdr'];
// Declarations the functions close over, which live on their own lines.
const SIGNER_VARS = ['var _lpSdkP=null;', 'var _lpMods={};'];

function grabFunction(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return null;
  let depth = 0;
  for (let k = src.indexOf('{', i); k >= 0 && k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}') { depth--; if (!depth) return src.slice(i, k + 1); }
  }
  return null;
}

function buildSigner() {
  const lp = fs.readFileSync(__dirname + '/_launchpad.js', 'utf8');
  const parts = [];
  for (const v of SIGNER_VARS) {
    if (lp.indexOf(v) < 0) {
      console.error('list-token: _launchpad.js no longer declares "' + v + '" — refusing to build.');
      process.exit(1);
    }
    parts.push(v);
  }
  for (const n of SIGNER_FNS) {
    const body = grabFunction(lp, n);
    if (!body) {
      console.error('list-token: _launchpad.js no longer defines ' + n + '() — refusing to build.');
      process.exit(1);
    }
    parts.push(body);
  }
  return '/* Lifted verbatim from _tools/_launchpad.js at build time. Do not edit here. */\n'
    + parts.join('\n');
}

// ---- assemble ---------------------------------------------------------------------------------------
let CSS, MAIN, JS;
try {
  CSS = fs.readFileSync(__dirname + '/listyourtoken.css', 'utf8');
  MAIN = fs.readFileSync(__dirname + '/listyourtoken.html', 'utf8').trim();
  JS = fs.readFileSync(__dirname + '/listyourtoken.browser.js', 'utf8');
} catch (e) {
  console.error('list-token: missing listyourtoken.css/.html/.browser.js — nothing written');
  process.exit(1);
}

if (JS.indexOf('/* LX_SIGNER */') < 0) {
  console.error('list-token: the browser script has no LX_SIGNER marker — refusing to build.');
  process.exit(1);
}
// A function as the replacement, so a "$&" or "$1" appearing anywhere in the signer is inserted
// literally instead of being read as a substitution.
const signer = buildSigner();
JS = JS.replace('/* LX_SIGNER */', () => signer);

// The one sequence that must not appear: "</script" ends the element wherever it occurs, including
// inside a string, and would swallow the rest of the page. Other closing tags (</svg>, </div>) are
// harmless in a script body, and the container serializer round-trips them through JSON intact.
if (/<\/script/i.test(JS)) {
  console.error('list-token: the browser script contains "</script", which would end the element.');
  process.exit(1);
}
// Parse it before anyone's browser has to. A syntax error here would otherwise reach production as a
// page whose form does nothing at all, with no visible symptom until someone tries to pay.
try {
  new Function(JS);
} catch (e) {
  console.error('list-token: the assembled browser script does not parse: ' + e.message);
  process.exit(1);
}

const STYLE = '<style id="lx-listtoken-css">' + CSS.replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map((l) => l.trim()).filter(Boolean).join('') + '</style>';
const SCRIPT = '<script id="lx-listtoken">' + JS + '</script>';

// ---- footer: "List your token", last in the Resources column ----------------------------------------
// Both footer variants end that column with Whitepaper, so one anchor reaches the desktop and the
// phone. Scoped to the <footer> slice, because an unscoped replace once put an About link into the
// mobile navigation menu.
const FOOTER_LINK = '<a href="/list-your-token">List your token</a>';

function wireFooter(h) {
  const fi = h.lastIndexOf('<footer');
  if (fi < 0) return h;
  // Bounded at </footer>, not at the end of the document. Slicing to the end swept in this page's own
  // script, whose comments mention the path — so the "already wired" guard matched and the one page
  // that most needs the link was the only one that never got it.
  const close = h.indexOf('</footer>', fi);
  const end = close < 0 ? h.length : close;
  let ft = h.slice(fi, end);
  if (ft.indexOf('>List your token<') >= 0) return h;
  const before = ft;
  ft = ft.replace(/(<a href="\/whitepaper">Whitepaper<\/a>)/, '$1\n        ' + FOOTER_LINK);
  return ft === before ? h : h.slice(0, fi) + ft + h.slice(end);
}

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
  let body = replaceMain(stripFaq(src), MAIN);
  if (!body) { console.error('  ' + file + ': no <main> in donor — skipped'); continue; }
  body = clearNavActive(setHead(body, STYLE));
  // The script goes last, after the shell's own scripts, so lxwOpenWallet already exists when this
  // one runs and the connect button is live from the first click.
  const bi = body.lastIndexOf('</body>');
  json['lumoscore-list-token' + suffix] = bi < 0 ? body : body.slice(0, bi) + SCRIPT + body.slice(bi);
  made++;

  for (const key of Object.keys(json)) {
    const h = wireFooter(json[key]);
    if (h !== json[key]) { json[key] = h; wired++; }
  }

  const ser = JSON.stringify(json).split('</').join('<' + B + '/');
  fs.writeFileSync(file, data.slice(0, s) + ser + data.slice(e), 'utf8');
}
console.log('list-token: built ' + made + ' page(s), footer link on ' + wired + ' page keys');
