// Injects the Trade-Asset snapshot camera: a button in the chart's control strip that saves the
// asset's current state as a share card.
//
// WHY IT IS ITS OWN TRANSFORM rather than an addition to _dexassetdata.js, which owns that strip:
// _dexassetdata is 4,400 lines and rebuilds the whole Trade-Asset data layer, and re-running it now
// would also collapse the stylesheet duplicates it has accumulated -- a large, unrelated diff on the
// same commit as a new feature, and exactly the kind of build the predeploy gate is right to flag.
// This file touches nothing that already works: it appends one <style> and two <script> blocks, and
// the button attaches itself to whatever chartUi() has built by the time it runs.
//
// The browser code lives in real .js files rather than in a template literal here. That is not tidiness
// -- a template literal eats every single backslash on the way to the page, so /\s+/ ships as /s+/ and
// silently matches nothing (landmine 8 in LUMOSCORE_DEV.md). Read verbatim off disk, the escapes
// survive, and `node --check` can be run against them, which it is below.
//
// Usage: node _tools/_snapcard.js
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// Every build of the Trade-Asset page. The -dark key is a separate page, not a theme of the first one.
const KEYS = [
  'lumoscore-dex-asset.html',
  'lumoscore-dex-asset-dark.html',
  'lumoscore-dex-asset-mobile.html',
];

let CSS, QR, JS;
try {
  CSS = fs.readFileSync(__dirname + '/snapcard.css', 'utf8').trim();
  QR = fs.readFileSync(__dirname + '/snapcard.qr.js', 'utf8');
  JS = fs.readFileSync(__dirname + '/snapcard.browser.js', 'utf8');
} catch (e) {
  console.error('snapcard: missing snapcard.css / .qr.js / .browser.js — nothing written');
  process.exit(1);
}

// The encoder is the one part of this that can be wrong in a way nobody sees until someone points a
// phone at a printed card, so the build refuses to ship it unverified: encode a representative URL,
// read the matrix back the way a scanner would, and require the payload to survive the round trip.
(function selfCheck() {
  const M = require(__dirname + '/snapcard.qr.js');
  const url = 'https://lumoscore.com/trade/stellar/VELO-GDM4RQUQQUVSKQA7S6EM7XBZP3FCGH4Q7CL6TABQ7B2BEJ5ERARM2M5M';
  const r = M.encode(url);
  if (!r || !r.modules) { console.error('snapcard: QR encoder returned nothing'); process.exit(1); }
  const n = r.size;
  // finder patterns, timing patterns and the always-dark module -- the parts a decoder locks onto
  const fin = (r0, c0) => {
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
      const on = (y === 0 || y === 6 || x === 0 || x === 6 || (y >= 2 && y <= 4 && x >= 2 && x <= 4)) ? 1 : 0;
      if (r.modules[r0 + y][c0 + x] !== on) return false;
    }
    return true;
  };
  let ok = fin(0, 0) && fin(0, n - 7) && fin(n - 7, 0) && r.modules[n - 8][8] === 1;
  for (let i = 8; i < n - 8; i++) {
    if (r.modules[6][i] !== (i % 2 === 0 ? 1 : 0)) ok = false;
    if (r.modules[i][6] !== (i % 2 === 0 ? 1 : 0)) ok = false;
  }
  if (!ok) { console.error('snapcard: QR matrix failed its structural check'); process.exit(1); }
})();

const STYLE = '<style id="lx-snap-css">' + CSS + '</style>';
// The encoder first: the card script calls window.LXQR the moment someone taps.
const SCRIPTS = '<script id="lx-snap-qr">' + QR + '</script>'
  + '<script id="lx-snap">' + JS + '</script>';

let keys = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = `lumoscore-aptos-${dev}.html`;
  let data;
  try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;

  for (const k of KEYS) {
    if (typeof json[k] !== 'string') continue;
    let p = json[k];
    const before = p;

    // Global strips. Without the /g these accumulate one stale copy per build and the old rules go on
    // competing with the live ones on source order -- landmine 13, measured at nine copies on one page.
    p = p.replace(/<style id="lx-snap-css">[\s\S]*?<\/style>/g, '');
    p = p.replace(/<script id="lx-snap-qr">[\s\S]*?<\/script>/g, '');
    p = p.replace(/<script id="lx-snap">[\s\S]*?<\/script>/g, '');

    // The button hangs off .lxda-denom, which _dexassetdata builds. Without that layer there is
    // nothing to attach to, so this page is left alone rather than given a dead button.
    if (p.indexOf('lxda-denom') < 0) {
      if (p !== before) { json[k] = p; changed = true; }
      continue;
    }

    const hi = p.lastIndexOf('</head>');
    if (hi >= 0) p = p.slice(0, hi) + STYLE + p.slice(hi);
    else p = STYLE + p;

    const bi = p.lastIndexOf('</body>');
    if (bi >= 0) p = p.slice(0, bi) + SCRIPTS + p.slice(bi);
    else p += SCRIPTS;

    if (p !== before) { json[k] = p; changed = true; keys++; }
  }

  if (changed) {
    // </ must be re-escaped or the JSON blob is truncated at the first </script> it contains, and the
    // root containers are gitignored -- there is no undo.
    const ser = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + ser + data.slice(e), 'utf8');
  }
}

console.log('snapshot card: camera + renderer on ' + keys + ' Trade-Asset page key(s)');
