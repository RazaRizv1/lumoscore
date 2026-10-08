// Shared parts of every LumosCore share card: the font metrics, the palette, the chain marks, and
// the frame itself. _ogcards.js (per-asset) and _ogsection.js (per-section) both draw through this,
// so the background, light shaft, type scale, glass panel and foot rule cannot drift apart.
//
// Rendering happens at BUILD time with resvg; see _ogcards.js for why it can never be an endpoint.
// RUNS IN BOTH NODE AND THE BROWSER, from this one file. The build draws cards with resvg; the admin
// panel and the launchpad draw the same card in the browser the moment an asset is curated or minted,
// because nothing can rasterise one at the edge. Two implementations would drift the first time the
// design changed, so this file is copied verbatim to dist/assets/js/ and loaded there as a script.
// Verified against resvg on a 24x13 grid: mean channel distance 4.6 of a possible 441, worst cell 36,
// nothing over 40.
var IS_NODE = typeof process !== 'undefined' && !!(process.versions && process.versions.node);
var fs = IS_NODE ? require('fs') : null;
var path = IS_NODE ? require('path') : null;

const W = 1200, H = 630;
const BG = '#0a0a0b', BG_TOP = '#15151d';
const INK = '#f6f5f3', MUTED = '#9a9aa3', ACCENT = '#ea6a2c', GREEN = '#1fa968', LINE = '#2c2c34';
const FONT = IS_NODE ? path.join(__dirname, 'fonts', 'HankenGrotesk-variable.ttf') : '';

// ---- geometry, shared so every card lines up ----------------------------------------------------
const L = 84;                                        // left margin, every line sits on it
const CODE_BASE = 402, CODE_NOM = 122;               // headline baseline and nominal size
const PANEL = 330, PAD = 52, INNER = PANEL - PAD * 2;
const PX = W - L - PANEL;
// The panel is centred on the HEADLINE, not the column as a whole -- the headline is where the eye
// lands. Computed from the nominal size so the panel sits in the same place whatever the text does.
const PY = Math.round((CODE_BASE - CODE_NOM * 0.72 + CODE_BASE) / 2 - PANEL / 2);
const ROW_Y = 148, ROW_H = 38, ROW_MID = ROW_Y + ROW_H / 2;
const ROW_FS = 34, ROW_BASE = ROW_MID + ROW_FS * 0.72 / 2;
const ACCENT_BASE = 464, FEAT_BASE = 520, RULE_Y = 566;

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---- real text metrics, straight out of the TTF -------------------------------------------------
// Anything positioned after a run of text needs its true width. Guessing it (the old card used
// code.length * 52) is what put the verification tick on top of AQUA's last letter.
// Readers written over a plain byte array rather than Buffer methods, so the same parser runs on a
// Uint8Array in the browser and on the file the build reads.
let fbuf = null, TBL = {}, UPEM = 1000, NUMH = 0;
let CMAP = new Map();
const U16 = (o) => (fbuf[o] << 8) | fbuf[o + 1];
const I16 = (o) => (((fbuf[o] << 8) | fbuf[o + 1]) << 16) >> 16;
const U32 = (o) => (((fbuf[o] << 24) | (fbuf[o + 1] << 16) | (fbuf[o + 2] << 8) | fbuf[o + 3]) >>> 0);
const ascii = (o, n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(fbuf[o + i]); return s; };

function initMetrics(bytes) {
  fbuf = bytes; TBL = {}; CMAP = new Map();
  if (!fbuf || fbuf.length < 12) { fbuf = null; return false; }
  for (let i = 0, n = U16(4); i < n; i++) { const o = 12 + i * 16; TBL[ascii(o, 4)] = U32(o + 8); }
  if (TBL.head == null || TBL.hhea == null || TBL.hmtx == null || TBL.cmap == null) { fbuf = null; return false; }
  UPEM = U16(TBL.head + 18); NUMH = U16(TBL.hhea + 34);
  const c = TBL.cmap; let best = 0;
  for (let i = 0, n = U16(c + 2); i < n; i++) {
    const pid = U16(c + 4 + i * 8), eid = U16(c + 6 + i * 8);
    if ((pid === 3 && (eid === 1 || eid === 10)) || pid === 0) best = c + U32(c + 8 + i * 8);
  }
  if (U16(best) === 4) {
    const segX2 = U16(best + 6), seg = segX2 / 2;
    const endO = best + 14, startO = endO + segX2 + 2, deltaO = startO + segX2, rangeO = deltaO + segX2;
    for (let s = 0; s < seg; s++) {
      const end = U16(endO + s * 2), start = U16(startO + s * 2);
      const delta = I16(deltaO + s * 2), ro = U16(rangeO + s * 2);
      if (start === 0xffff) continue;
      for (let cp = start; cp <= end && cp !== 0x10000; cp++) {
        let g;
        if (ro === 0) g = (cp + delta) & 0xffff;
        else { const gi = rangeO + s * 2 + ro + (cp - start) * 2; if (gi + 1 >= fbuf.length) continue; g = U16(gi); if (g) g = (g + delta) & 0xffff; }
        if (g) CMAP.set(cp, g);
      }
    }
  }
  return true;
}
if (IS_NODE && fs.existsSync(FONT)) initMetrics(new Uint8Array(fs.readFileSync(FONT)));

function textW(str, size, tracking) {
  let u = 0, n = 0;
  for (const ch of String(str)) { const g = CMAP.get(ch.codePointAt(0)); if (g != null) u += U16(TBL.hmtx + Math.min(g, NUMH - 1) * 4); n++; }
  return u * size / UPEM + (tracking || 0) * Math.max(0, n - 1);
}
const hasFont = () => !!fbuf;

// resvg ignores font-weight on this variable font -- probed, weight 400 and 900 render to
// byte-identical output -- so weight is a stroke in the fill's own colour. The renderer offers no
// other route to a heavy face.
function bold(x, y, size, text, fill, track, w, anchor) {
  return '<text x="' + x + '" y="' + y + '" font-family="Hanken Grotesk" font-size="' + size + '"'
    + (track ? ' letter-spacing="' + track + '"' : '') + (anchor ? ' text-anchor="' + anchor + '"' : '')
    + ' fill="' + fill + '" stroke="' + fill + '" stroke-width="' + (w || 2) + '" stroke-linejoin="round">' + esc(text) + '</text>';
}
function plain(x, y, size, text, fill, anchor) {
  return '<text x="' + x + '" y="' + y + '" font-family="Hanken Grotesk" font-size="' + size + '"'
    + (anchor ? ' text-anchor="' + anchor + '"' : '') + ' fill="' + fill + '">' + esc(text) + '</text>';
}

// The chain marks, lifted from the site's own inlined icons so a card cannot drift from the UI.
// Paths live in a 32-unit viewBox; bb is the glyph's real bounding box inside it, because the glyph
// fills only about 20 of those units and drawing at viewBox scale makes the mark look weak.
const CHAIN = {
  Stellar: {
    label: 'Stellar', bb: [6, 7.856, 20, 15.33],
    d: 'M23.13 9.292l-2.4 1.224-11.598 5.907A6.909 6.909 0 0119.35 9.498l1.374-.7.205-.105a8.439 8.439 0 00-13.371 7.472 1.535 1.535 0 01-.834 1.484l-.725.37v1.724l2.134-1.088.691-.353.681-.347 12.226-6.23 1.374-.699 2.84-1.447V7.856L23.13 9.292zm2.816 2.012L10.201 19.32l-1.374.7L6 21.463v1.723l2.808-1.43 2.401-1.224 11.61-5.916a6.909 6.909 0 01-10.229 6.93l-.085.045-1.49.76a8.439 8.439 0 0013.372-7.475 1.536 1.536 0 01.833-1.483l.726-.37v-1.718z',
  },
  XRPL: {
    label: 'XRP Ledger', bb: [6, 8, 20, 16.563],
    d: 'M23.07 8h2.89l-6.015 5.957a5.621 5.621 0 01-7.89 0L6.035 8H8.93l4.57 4.523a3.556 3.556 0 004.996 0L23.07 8zM8.895 24.563H6l6.055-5.993a5.621 5.621 0 017.89 0L25.999 24.563h-2.895l-4.608-4.56a3.556 3.556 0 00-4.996 0l-4.605 4.56z',
  },
};
const CHECK = 'M9 16.2l-3.5-3.5-1.4 1.4L9 19 20 8l-1.4-1.4z';

// A chain glyph scaled to a target height and placed by its own box, not the viewBox.
function chainMark(key, x, midY, height, fill) {
  const C = CHAIN[key]; if (!C) return { svg: '', w: 0 };
  const s = height / C.bb[3], w = C.bb[2] * s;
  return {
    w,
    svg: '<g transform="translate(' + (x - C.bb[0] * s).toFixed(2) + ',' + (midY - height / 2 - C.bb[1] * s).toFixed(2)
      + ') scale(' + s.toFixed(4) + ')"><path d="' + C.d + '" fill="' + (fill || INK) + '"/></g>',
  };
}

// The metadata row, built from segments so both renderers lay it out the same way. A segment is
// {chain}, {text}, {text, bold}, or {check} for the green curation badge. Dividers go between.
function metaRow(segs) {
  let x = L, out = '';
  segs.filter(Boolean).forEach((seg, i) => {
    if (i) {
      out += '<rect x="' + x.toFixed(1) + '" y="' + (ROW_Y + 1) + '" width="1.5" height="' + (ROW_H - 2) + '" fill="' + LINE + '"/>';
      x += 30;
    }
    if (seg.chain) {
      const m = chainMark(seg.chain, x, ROW_MID, 36, INK);
      out += m.svg; x += m.w + 20;
      const lbl = seg.label || CHAIN[seg.chain].label;
      out += bold(x, ROW_BASE, ROW_FS, lbl, INK, -0.5, 1.5);
      x += textW(lbl, ROW_FS, -0.5) + 30;
      return;
    }
    if (seg.check) {
      const r = 16;
      out += '<circle cx="' + (x + r).toFixed(1) + '" cy="' + ROW_MID + '" r="' + r + '" fill="none" stroke="' + GREEN + '" stroke-width="2.2"/>'
        + '<g transform="translate(' + (x + r - 11.5).toFixed(1) + ',' + (ROW_MID - 11.5) + ') scale(0.96)"><path d="' + CHECK + '" fill="' + GREEN + '"/></g>';
      x += r * 2 + 16;
      out += plain(x.toFixed(1), ROW_BASE, 30, seg.check, INK);
      x += textW(seg.check, 30, 0) + 30;
      return;
    }
    const fs = seg.size || 30;
    out += seg.bold ? bold(x, ROW_BASE, fs, seg.text, seg.fill || INK, -0.5, 1.5)
                    : plain(x.toFixed(1), ROW_BASE, fs, seg.text, seg.fill || MUTED);
    x += textW(seg.text, fs, seg.bold ? -0.5 : 0) + 30;
  });
  return { svg: out, end: x };
}

// The headline steps down only as far as it must, measured, so a long one fits where a fixed size
// would run off the canvas and a short one is not left undersized.
// Step a secondary line down until it clears the panel. Same idea as the headline, smaller range.
function fitLine(text, size, track, min) {
  const max = PX - L - 24;
  let s = size;
  while (s > min && textW(text, s, track) > max) s -= 1;
  return s;
}

function fitHeadline(text, min) {
  let size = CODE_NOM; const track = -3.5, max = PX - L - 48;
  while (size > (min || 46) && textW(text, size, track) > max) size -= 2;
  return { size, track };
}

const FRAME_DEFS =
  '<linearGradient id="bgg" x1="1" y1="0" x2="0.25" y2="1">'
  + '<stop offset="0" stop-color="' + BG_TOP + '"/><stop offset="1" stop-color="' + BG + '"/></linearGradient>'
  + '<linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">'
  + '<stop offset="0" stop-color="#cfd6e4" stop-opacity="0.13"/>'
  + '<stop offset="1" stop-color="#cfd6e4" stop-opacity="0"/></linearGradient>'
  // A shaft with hard sides reads as a seam rather than as light, so both edges are feathered.
  + '<linearGradient id="beamh" x1="0" y1="0" x2="1" y2="0">'
  + '<stop offset="0" stop-color="#000"/><stop offset="0.5" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>'
  + '<mask id="beamm"><rect x="860" y="-340" width="230" height="980" fill="url(#beamh)"/></mask>'
  + '<mask id="beamm2"><rect x="1120" y="-340" width="90" height="980" fill="url(#beamh)"/></mask>'
  + '<radialGradient id="glow" cx="0.80" cy="0.30" r="0.62">'
  + '<stop offset="0" stop-color="' + ACCENT + '" stop-opacity="0.13"/>'
  + '<stop offset="1" stop-color="' + ACCENT + '" stop-opacity="0"/></radialGradient>'
  + '<linearGradient id="sheen" x1="0" y1="0" x2="0.4" y2="1">'
  + '<stop offset="0" stop-color="#ffffff" stop-opacity="0.085"/>'
  + '<stop offset="0.62" stop-color="#ffffff" stop-opacity="0.012"/>'
  + '<stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>'
  + '<linearGradient id="edge" x1="0" y1="0" x2="0.3" y2="1">'
  + '<stop offset="0" stop-color="#ffffff" stop-opacity="0.26"/>'
  + '<stop offset="1" stop-color="#ffffff" stop-opacity="0.07"/></linearGradient>'
  + '<linearGradient id="ruleg" x1="0" y1="0" x2="1" y2="0">'
  + '<stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/>'
  + '<stop offset="1" stop-color="#ffffff" stop-opacity="0.02"/></linearGradient>';

// One card. `row` and `panel` are svg the caller builds; everything else is the shared frame.
function shell({ defs, row, headline, accent, features, panel }) {
  const f = fitHeadline(headline);
  // With no metadata row the accent dash would sit alone at the top with ~190px of nothing under it.
  // It drops to just above the headline instead, so a card without a row reads as composed rather
  // than as a card with its row missing.
  const dashY = row ? 120 : Math.round(CODE_BASE - f.size * 0.72 - 48);
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">'
    + '<defs>' + FRAME_DEFS + (defs || '') + '</defs>'
    + '<rect width="' + W + '" height="' + H + '" fill="url(#bgg)"/>'
    + '<rect width="' + W + '" height="' + H + '" fill="url(#glow)"/>'
    + '<g transform="rotate(-21 1040 0)">'
    + '<g mask="url(#beamm)"><rect x="860" y="-340" width="230" height="980" fill="url(#beam)"/></g>'
    + '<g mask="url(#beamm2)" opacity="0.55"><rect x="1120" y="-340" width="90" height="980" fill="url(#beam)"/></g>'
    + '</g>'
    + '<rect x="' + L + '" y="' + dashY + '" width="54" height="5" rx="2.5" fill="' + ACCENT + '"/>'
    + (row || '')
    // The headline was the only line that measured itself, so the other two had to be written to a
    // guessed length -- which is how boilerplate ends up on a card: short filler is safe, and saying
    // the true thing risks running into the panel. All three fit themselves now, down to a floor.
    + bold(L, CODE_BASE, f.size, headline, INK, f.track, 2.8)
    + bold(L, ACCENT_BASE, fitLine(accent, 46, -1, 34), accent, ACCENT, -1, 1.6)
    + plain(L, FEAT_BASE, fitLine(features, 32, 0, 24), features, MUTED)
    + '<rect x="' + PX + '" y="' + PY + '" width="' + PANEL + '" height="' + PANEL + '" rx="74" fill="url(#sheen)" stroke="url(#edge)" stroke-width="1.6"/>'
    + (panel || '')
    + '<rect x="' + L + '" y="' + RULE_Y + '" width="' + (W - L * 2) + '" height="1.5" fill="url(#ruleg)"/>'
    + '<rect x="' + L + '" y="' + RULE_Y + '" width="118" height="1.5" fill="' + ACCENT + '"/>'
    + '</svg>';
}

function render(svg) {
  const { Resvg } = require('@resvg/resvg-js');
  return new Resvg(svg, {
    font: { fontFiles: [FONT], loadSystemFonts: false, defaultFontFamily: 'Hanken Grotesk' },
    fitTo: { mode: 'width', value: W },
  }).render().asPng();
}

// RESVG 2.6.2 CANNOT DECODE WEBP. A webp data URI draws nothing and raises no error, so a card ships
// with an empty panel while the build reports it had a logo. xrpl.to serves webp for every token
// icon. sharp is already a dependency, so everything that is not PNG or JPEG is decoded to PNG.
async function toPng(buf) {
  try {
    const out = await require('sharp')(buf).png().toBuffer();
    return 'data:image/png;base64,' + out.toString('base64');
  } catch (e) { return ''; }
}
async function imageDataUri(url) {
  try {
    const r = await fetch(url, { headers: { accept: 'image/*' } });
    if (!r.ok) return '';
    const type = (r.headers.get('content-type') || '').split(';')[0].toLowerCase();
    if (type.indexOf('image/') !== 0 || type.indexOf('svg') >= 0) return '';
    const b = Buffer.from(await r.arrayBuffer());
    if (!b.length || b.length > 2 * 1024 * 1024) return '';
    if (type === 'image/png' || type === 'image/jpeg' || type === 'image/jpg') {
      return 'data:' + type + ';base64,' + b.toString('base64');
    }
    return await toPng(b);
  } catch (e) { return ''; }
}

// The asset-card panel: one logo, centred, fitted rather than cropped. Shared so the build and the
// browser produce the same panel for a curated or freshly minted asset.
function assetPanel(uri, code) {
  const IX = PX + PAD, IY = PY + PAD, IR = Math.round(INNER * 0.25);
  if (!uri) {
    return {
      defs: '',
      svg: '<rect x="' + IX + '" y="' + IY + '" width="' + INNER + '" height="' + INNER + '" rx="' + IR + '" fill="#2a2a32"/>'
        + bold(IX + INNER / 2, IY + INNER / 2 + 30, 84, String(code || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?', '#fff', 0, 1.8, 'middle'),
    };
  }
  return {
    defs: '<clipPath id="one"><rect x="' + IX + '" y="' + IY + '" width="' + INNER + '" height="' + INNER + '" rx="' + IR + '"/></clipPath>',
    svg: '<image x="' + IX + '" y="' + IY + '" width="' + INNER + '" height="' + INNER + '" href="' + uri
      + '" clip-path="url(#one)" preserveAspectRatio="xMidYMid meet"/>',
  };
}

// One asset card, from the facts a card is allowed to state. `badge` is the curation wording --
// "Curated asset" for the vetted list, "Minted on LumosCore" for a token issued through the
// launchpad, which is true without claiming anyone checked it.
function assetCard({ code, logo, badge, domain, chain }) {
  const p = assetPanel(logo, code);
  return shell({
    defs: p.defs,
    row: metaRow([{ chain: chain || 'Stellar' }, badge ? { check: badge } : null, domain ? { text: domain } : null]).svg,
    headline: code,
    accent: 'Trade on LumosCore',
    features: 'Price · Pools · Holders',
    panel: p.svg,
  });
}

// Ship this very file, the browser generator and the TTF into dist, so the admin panel and the
// launchpad draw cards from the SAME source the build uses rather than a copy that drifts. The TTF
// is needed because the pages' woff2 faces are compressed subsets the metrics parser cannot read.
function emitBrowser() {
  if (!IS_NODE) return [];
  const out = [];
  // dist-admin as well as dist: the admin panel is its own Pages project, so loading these from
  // lumoscore.com would make the FONT fetch cross-origin, and reading a font as an ArrayBuffer needs
  // CORS the public site does not send. Same-origin copies sidestep that entirely.
  const roots = [path.join(__dirname, '..', 'dist'), path.join(__dirname, '..', 'dist-admin')];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const JS = path.join(root, 'assets', 'js');
    const FO = path.join(root, 'assets', 'fonts');
    fs.mkdirSync(JS, { recursive: true });
    fs.mkdirSync(FO, { recursive: true });
    const pairs = [
      [__filename, path.join(JS, 'lx-ogkit.js')],
      [path.join(__dirname, '_ogclient.js'), path.join(JS, 'lx-ogcardgen.js')],
      [FONT, path.join(FO, 'HankenGrotesk-variable.ttf')],
    ];
    for (const [src, dst] of pairs) {
      if (!fs.existsSync(src)) continue;
      const a = fs.readFileSync(src);
      // Only write when the bytes differ, so a rebuild does not churn dist for nothing.
      if (fs.existsSync(dst) && Buffer.compare(a, fs.readFileSync(dst)) === 0) continue;
      fs.writeFileSync(dst, a);
      out.push(path.basename(root) + '/' + path.basename(dst));
    }
  }
  return out;
}

const API = {
  W, H, BG, BG_TOP, INK, MUTED, ACCENT, GREEN, LINE, FONT,
  L, CODE_BASE, CODE_NOM, PANEL, PAD, INNER, PX, PY,
  ROW_Y, ROW_H, ROW_MID, ROW_FS, ROW_BASE, ACCENT_BASE, FEAT_BASE, RULE_Y,
  esc, textW, hasFont, initMetrics, bold, plain, CHAIN, CHECK, chainMark, metaRow, fitHeadline,
  shell, assetPanel, assetCard, render, toPng, imageDataUri, emitBrowser,
};
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else if (typeof window !== 'undefined') window.LXOGKit = API;
