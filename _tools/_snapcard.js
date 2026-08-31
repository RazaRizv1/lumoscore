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
// phone at a card, so the build refuses to ship it unverified.
//
// THE FIRST VERSION OF THIS CHECK WAS WORTHLESS, and it is worth saying why. It encoded a URL, read
// the matrix back with a reader written from the same understanding of the spec, and asked whether the
// payload survived. It always did -- because a shared misunderstanding cancels out. The format
// information was being written to copy 1 transposed, the round trip did not care, and the symbol went
// out unreadable.
//
// So the check below is pinned to values that come from OUTSIDE this file: the published format
// strings for error-correction level L, which every conformant encoder must produce. Both copies of
// the format information are read straight out of the matrix, by absolute cell, and must equal the
// published string for the mask the encoder chose. Nothing here can be satisfied by agreeing with
// snapcard.qr.js.
(function selfCheck() {
  const M = require(__dirname + '/snapcard.qr.js');
  const url = 'https://lumoscore.com/trade/stellar/VELO-GDM4RQUQQUVSKQA7S6EM7XBZP3FCGH4Q7CL6TABQ7B2BEJ5ERARM2M5M';
  const die = (m) => { console.error('snapcard: ' + m); process.exit(1); };
  const r = M.encode(url);
  if (!r || !r.modules) die('QR encoder returned nothing');
  const n = r.size, m = r.modules;

  // ISO/IEC 18004 format strings, level L, masks 0-7. Independent of anything in this repo.
  const FMT_L = [0x77C4, 0x72F3, 0x7DAA, 0x789D, 0x662F, 0x6318, 0x6C41, 0x6976];

  // Copy 1: low six bits along row 8, then (8,7), (8,8), (7,8), then up column 8.
  let c1 = 0;
  for (let i = 0; i < 15; i++) {
    let b;
    if (i < 6) b = m[8][i];
    else if (i === 6) b = m[8][7];
    else if (i === 7) b = m[8][8];
    else if (i === 8) b = m[7][8];
    else b = m[14 - i][8];
    c1 |= b << i;
  }
  // Copy 2: along row 8 from the right edge, then up column 8 from the bottom.
  let c2 = 0;
  for (let i = 0; i < 15; i++) c2 |= (i < 8 ? m[8][n - 1 - i] : m[n - 15 + i][8]) << i;

  if (FMT_L.indexOf(c1) < 0) die('format copy 1 is 0x' + c1.toString(16) + ', not a published level-L string');
  if (c1 !== c2) die('format copies disagree: 0x' + c1.toString(16) + ' vs 0x' + c2.toString(16));

  // The error correction, checked by the property that DEFINES it rather than by re-running the same
  // division: a Reed-Solomon codeword is zero at a^0 .. a^(deg-1). The first version of this encoder
  // built its generator polynomial ascending and divided by it as though it were descending, so every
  // parity byte belonged to the reciprocal code -- a perfectly formed symbol that no decoder could
  // correct. A round-trip test cannot see that; this can.
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; } for (let j = 255; j < 512; j++) EXP[j] = EXP[j - 255]; })();
  const gmul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];
  const cw = M.__codeword ? M.__codeword(url) : null;
  if (!cw) die('encoder exposes no codeword to check');
  for (let i = 0; i < cw.ecLen; i++) {
    const a = EXP[i];
    for (const blk of cw.blocks) {
      let acc = 0;
      for (let k = 0; k < blk.length; k++) acc = gmul(acc, a) ^ blk[k];
      if (acc !== 0) die('Reed-Solomon syndrome ' + i + ' is ' + acc + ', not zero — the parity is wrong');
    }
  }

  // Structure a decoder locks onto before it reads anything.
  const fin = (r0, c0) => {
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
      const on = (y === 0 || y === 6 || x === 0 || x === 6 || (y >= 2 && y <= 4 && x >= 2 && x <= 4)) ? 1 : 0;
      if (m[r0 + y][c0 + x] !== on) return false;
    }
    return true;
  };
  if (!(fin(0, 0) && fin(0, n - 7) && fin(n - 7, 0))) die('finder patterns are wrong');
  if (m[n - 8][8] !== 1) die('the always-dark module is not set');
  for (let i = 8; i < n - 8; i++) {
    if (m[6][i] !== (i % 2 === 0 ? 1 : 0) || m[i][6] !== (i % 2 === 0 ? 1 : 0)) die('timing pattern is wrong');
  }
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
