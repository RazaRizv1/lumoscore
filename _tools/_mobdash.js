// The mobile bottom nav's first tab said "Home" under a house, while the same destination is
// "Dashboard" under a four-pane grid on desktop. One product, two names for one page -- and "Home"
// suggests a marketing landing page rather than the account view it actually opens.
//
// The icon is taken from the desktop rail's own dashboard item rather than redrawn, so the two shells
// cannot drift apart later.
//
// Idempotent: keyed on the house path, which is gone after the first run.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// Verbatim from .nx-item[data-id=dashboard] in the desktop container.
const DASH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" '
  + 'stroke-linecap="round" stroke-linejoin="round">'
  + '<rect x="3" y="3" width="8" height="8" rx="1.6"/><rect x="13" y="3" width="8" height="5" rx="1.6"/>'
  + '<rect x="13" y="11" width="8" height="10" rx="1.6"/><rect x="3" y="14" width="8" height="7" rx="1.6"/></svg>';

// "Dashboard" is the longest label in the bar, so it gets a nowrap guard -- at 320px the tabs are about
// 60px and a wrapped label would push the bar taller. It does NOT get a smaller font: measured at 375px
// it is 51px inside a 73px tab, and shrinking only this one label would leave it visibly out of step
// with the four beside it.
const CSS = '<style id="lx-mobdash-css">'
  + '.nb-bar .nb-tab[data-id="home"] .nb-lbl{white-space:nowrap}'
  + '</style>';

const file = 'lumoscore-aptos-mobile.html';
let data;
try { data = read(file); } catch (e) { console.log('mobile container not found'); process.exit(0); }
const { json, s, e } = getContents(data);

// The house, as authored. Matched as one string so a partial rewrite cannot leave half an icon.
const HOUSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" '
  + 'stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 3l9 6.5"/>'
  + '<path d="M5 10.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9.5"/><path d="M9.5 21v-6h5v6"/></svg>';

let icons = 0, labels = 0, pages = 0, changed = false;
for (const k of Object.keys(json)) {
  let h = json[k];
  if (h.indexOf('class="nb-bar"') < 0) continue;
  const before = h;

  // Only inside the home tab, so a house used anywhere else on the page is untouched.
  //
  // "nb-tab[^"]*" and not "nb-tab" -- on the dashboard itself the tab carries its own active state
  // (class="nb-tab active"), and an exact-class match skipped the one page whose nav a visitor is most
  // likely to be looking at when they arrive.
  h = h.replace(/(<a class="nb-tab[^"]*"[^>]*data-id="home"[^>]*>)([\s\S]*?)(<\/a>)/, function (m, open, inner, close) {
    if (inner.indexOf(HOUSE) >= 0) { inner = inner.split(HOUSE).join(DASH_SVG); icons++; }
    const lab = inner.replace(/(<span class="nb-lbl">)Home(<\/span>)/, function (_m, a, b) { labels++; return a + 'Dashboard' + b; });
    return open + lab + close;
  });

  h = h.replace(/<style id="lx-mobdash-css">[\s\S]*?<\/style>/g, '');
  if (h.indexOf('</head>') >= 0) h = h.replace('</head>', CSS + '</head>');

  if (h !== before) { json[k] = h; changed = true; pages++; }
}

if (changed) {
  const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
  fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
}
console.log('mobile nav: ' + icons + ' icons + ' + labels + ' labels -> Dashboard, across ' + pages + ' page(s)');
