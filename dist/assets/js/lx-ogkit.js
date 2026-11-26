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
// The headline is 88px tall, so 29px of air under it read as cramped against the accent line while
// the top of the card sat empty. Measured gaps now: baseline to the accent's cap 44px, accent
// baseline to the features' cap 30px, features baseline to the rule 34px.
const ACCENT_BASE = 479, FEAT_BASE = 532, RULE_Y = 566;

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

// The brand in the row position, for the cards that are not about a chain -- the blog, the docs, the
// whitepaper, the listing form. It fills the top of the card, which on those was 266px of nothing,
// and puts the mark where a reader looks first.
function brandRow(uri) {
  const h = 46, box = 44;
  const y = ROW_MID - h / 2;
  const mark = uri
    ? '<image x="' + L + '" y="' + y + '" width="' + box + '" height="' + h + '" href="' + uri + '" preserveAspectRatio="xMidYMid meet"/>'
    : '';
  return mark + bold(L + box + 14, ROW_BASE, ROW_FS, 'LumosCore', INK, -0.5, 1.5);
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
// Normalise ANY logo to a PNG the renderer can draw and a reader can actually see. Two separate
// failures, both of which ship a card that looks broken rather than one that looks wrong:
//
//   resvg draws only PNG and JPEG from inside an SVG, so webp drew nothing at all and an SVG was
//   skipped entirely -- which is what left XRF wearing a monogram over a logo that existed.
//
//   A logo that is BLACK ON TRANSPARENCY disappears into a dark card. TFT, XRF, XTROOP and AFR all
//   rendered as a silhouette darker than the panel behind it, reading as a hole. Measured across the
//   curated list: 4 of 58 sit below luminance 40, where the panel interior is about 26. Those get a
//   white tile behind them, which is what any app does with a dark mark on a dark surface. The ones
//   that are merely dark-ish and coloured -- SHX, yXLM, ETH at 56-65 -- are left alone, because they
//   read perfectly well and flattening them would put a white box where none is wanted.
async function toPng(buf) {
  try {
    const sharp = require('sharp');
    // SVG TOO. resvg will not rasterise an SVG referenced from inside another SVG, so these used to
    // be skipped and the asset fell back to a two-letter monogram -- XRF did, for a logo that was
    // sitting there the whole time. sharp renders it, but at 72dpi by default, which on a small
    // source gives a thumbnail that is then blurry in a 226px panel. The density is chosen from the
    // intrinsic size so the raster lands near 512px however the file was authored.
    const head = buf.slice(0, 400).toString('latin1');
    if (head.indexOf('<svg') >= 0 || head.trimStart().indexOf('<?xml') === 0) {
      const m = await sharp(buf).metadata();
      const side = Math.max(m.width || 72, m.height || 72);
      const density = Math.min(2400, Math.max(72, Math.round(72 * 512 / side)));
      return await encode(sharp(buf, { density }));
    }
    return await encode(sharp(buf));
  } catch (e) { return ''; }
}

// Shared tail of toPng: give a logo that is dark on transparency a white tile, then encode.
async function encode(img) {
  const sharp = require('sharp');
  const meta = await img.metadata();
  let out = img;
  if (meta.hasAlpha) {
    const { data } = await img.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let sum = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 128) { sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; n++; }
    }
    if (n && sum / n < 40) out = img.clone().flatten({ background: '#ffffff' });
  }
  const png = await out.png().toBuffer();
  return 'data:image/png;base64,' + png.toString('base64');
}

// EVERY logo goes through toPng now, PNG and JPEG included. They used to pass straight through,
// which is why a black-on-transparent PNG reached the card untouched.
async function imageDataUri(url) {
  try {
    const r = await fetch(url, { headers: { accept: 'image/*' } });
    if (!r.ok) return '';
    const type = (r.headers.get('content-type') || '').split(';')[0].toLowerCase();
    if (type.indexOf('image/') !== 0) return '';   // svg included: toPng() rasterises it
    const b = Buffer.from(await r.arrayBuffer());
    if (!b.length || b.length > 2 * 1024 * 1024) return '';
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
function assetCard({ code, logo, badge, domain, issuer, chain }) {
  const p = assetPanel(logo, code);
  // THE ISSUER WHEN THERE IS NO DOMAIN. A ticker is not an identity on Stellar -- hundreds of assets
  // share the code USDC -- so the issuer is the only fact that actually says which asset this is,
  // and three of the curated list publish no domain at all. Without it their row is two segments
  // where every other card has three, which reads as something having failed to load rather than as
  // a fact that does not exist. Shortened because 56 characters cannot be read off a card anyway.
  const third = domain
    || (issuer ? issuer.slice(0, 4) + '…' + issuer.slice(-4) : '');
  return shell({
    defs: p.defs,
    row: metaRow([{ chain: chain || 'Stellar' }, badge ? { check: badge } : null, third ? { text: third } : null]).svg,
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

// =================================================================================================
// THE 2026-11-26 CARD (RAZA: "make them more attractive and modernistic"; mockups approved as v2 in
// og-mockups/v2). One frame for every card: near-black, a faint dot grid fading out to the right, a
// soft glow in the flame's colours, the LumosCore mark top-left, a small label, the page name, one or
// two short lines, a row of chips, and a picture on the right.
//
// NETWORKS ARE NEVER LISTED ON A HUB OR GENERAL CARD ("networks will just keep increasing"). A chain
// chip / badge appears only on a card that IS that network's page (/trade/stellar, a Stellar token).
// No numbers anywhere in a picture: a build-time image must not carry a price or a rate.
// =================================================================================================
const C2 = { BG: '#09090b', INK: '#f6f5f3', MUTED: '#a3a2ac', SOFT: '#75747e', SURF: '#121216', LINE: '#28282f', L: 84 };
let BRAND = '';
if (IS_NODE) {
  try {
    const bp = path.join(__dirname, '..', 'dist', 'assets', 'tokens', 'lumos.png');
    if (fs.existsSync(bp)) BRAND = 'data:image/png;base64,' + fs.readFileSync(bp).toString('base64');
  } catch (e) { BRAND = ''; }
}
function setBrand(uri) { BRAND = uri || ''; }

// NEAR has no vector mark on the site, so a plain geometric N in the same 32-unit box as the others.
CHAIN.NEAR = { label: 'NEAR', bb: [8, 8, 16, 16], d: 'M8 8h3.4l8.2 10.4V8H24v16h-3.4l-8.2-10.4V24H8z' };

const DEFS2 =
  '<radialGradient id="c2g1" cx="0.86" cy="0" r="0.7"><stop offset="0" stop-color="#e2557f" stop-opacity=".20"/><stop offset=".5" stop-color="#ff9a4a" stop-opacity=".06"/><stop offset="1" stop-color="#ff9a4a" stop-opacity="0"/></radialGradient>'
  + '<radialGradient id="c2g2" cx="0.98" cy="1" r="0.6"><stop offset="0" stop-color="#36c8e6" stop-opacity=".18"/><stop offset="1" stop-color="#36c8e6" stop-opacity="0"/></radialGradient>'
  + '<radialGradient id="c2g3" cx="0" cy="0" r="0.5"><stop offset="0" stop-color="#ffffff" stop-opacity=".035"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>'
  + '<pattern id="c2dots" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="#ffffff" fill-opacity=".075"/></pattern>'
  + '<linearGradient id="c2fade" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#ffffff" stop-opacity="0"/></linearGradient>'
  + '<mask id="c2dm"><rect width="' + W + '" height="' + H + '" fill="url(#c2fade)"/></mask>'
  + '<clipPath id="c2cc" clipPathUnits="objectBoundingBox"><circle cx=".5" cy=".5" r=".5"/></clipPath>'
  + '<linearGradient id="c2flame" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#3fd0ea"/><stop offset=".38" stop-color="#e2557f"/><stop offset=".72" stop-color="#ff9a4a"/><stop offset="1" stop-color="#ffcf5a"/></linearGradient>'
  + '<linearGradient id="c2edge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".22"/><stop offset=".5" stop-color="#ffffff" stop-opacity=".05"/><stop offset="1" stop-color="#ffffff" stop-opacity=".12"/></linearGradient>'
  + '<linearGradient id="c2glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".06"/><stop offset="1" stop-color="#ffffff" stop-opacity=".015"/></linearGradient>'
  + '<linearGradient id="c2area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9a4a" stop-opacity=".28"/><stop offset="1" stop-color="#e2557f" stop-opacity="0"/></linearGradient>'
  + '<linearGradient id="c2liq1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3fd0ea" stop-opacity=".55"/><stop offset="1" stop-color="#7a6cf0" stop-opacity=".55"/></linearGradient>'
  + '<linearGradient id="c2liq2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e2557f" stop-opacity=".55"/><stop offset="1" stop-color="#ff9a4a" stop-opacity=".6"/></linearGradient>'
  + '<radialGradient id="c2halo"><stop offset="0" stop-color="#ff9a4a" stop-opacity=".16"/><stop offset=".45" stop-color="#e2557f" stop-opacity=".07"/><stop offset="1" stop-color="#e2557f" stop-opacity="0"/></radialGradient>'
  + '<clipPath id="c2orb"><circle cx="925" cy="305" r="150"/></clipPath>';

// chips: { t } plain, { t, chain } with that chain's mark, { t, dot } with a coloured dot, { t, tick } green curation tick
function chips2(list) {
  const y = 516, h = 44, FS = 19;
  let x = C2.L, out = '';
  (list || []).filter(Boolean).forEach((c) => {
    const lead = c.chain || c.tick || c.dot ? 44 : 20;
    const w = Math.round(lead + textW(c.t, FS, 0) + 20);
    if (x + w > 860) return;                                  // never run into the domain on the right
    out += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="22" fill="' + (c.tick ? '#0e2519' : C2.SURF) + '" stroke="' + (c.tick ? '#1fa968' : C2.LINE) + '"' + (c.tick ? ' stroke-opacity=".5"' : '') + '/>';
    if (c.chain && CHAIN[c.chain]) {
      out += '<circle cx="' + (x + 23) + '" cy="' + (y + 22) + '" r="13" fill="#24242b"/>' + chipMark(c.chain, x + 23, y + 22, 13);
    }
    if (c.dot) out += '<circle cx="' + (x + 23) + '" cy="' + (y + 22) + '" r="10" fill="' + c.dot + '" fill-opacity=".18"/><circle cx="' + (x + 23) + '" cy="' + (y + 22) + '" r="5" fill="' + c.dot + '"/>';
    if (c.tick) out += '<circle cx="' + (x + 23) + '" cy="' + (y + 22) + '" r="11" fill="#1fa968"/><path d="M' + (x + 17.5) + ' ' + (y + 22.5) + 'l3.6 3.6 7-7.2" fill="none" stroke="#08080a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>';
    out += bold(x + lead, y + 29, FS, c.t, c.tick ? '#86e3b6' : '#dddce2', 0, 0.5);
    x += w + 10;
  });
  return out;
}

// chainMark centres itself on its own box; for a chip the mark is centred on the circle instead
function chipMark(chain, cx, cy, hgt) {
  const C = CHAIN[chain]; if (!C) return '';
  const s = hgt / C.bb[3], w = C.bb[2] * s;
  return chainMark(chain, cx - w / 2, cy, hgt, '#ffffff').svg;
}

function fitTitle(text, max, start) {
  let size = start || 100;
  while (size > 44 && textW(text, size, -size * 0.04) > max) size -= 2;
  return size;
}

// The frame. visual = { svg, defs } drawn on the right half.
function card({ eyebrow, title, sub, chipList, visual, titleSize }) {
  const L2 = C2.L, TMAX = 610;
  const ts = fitTitle(title, TMAX, titleSize || 100);
  const subs = (Array.isArray(sub) ? sub : [sub]).filter(Boolean).slice(0, 2);
  const v = visual || { svg: '', defs: '' };
  let s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">'
    + '<defs>' + DEFS2 + (v.defs || '') + '</defs>'
    + '<rect width="' + W + '" height="' + H + '" fill="' + C2.BG + '"/>'
    + '<rect width="' + W + '" height="' + H + '" fill="url(#c2dots)" mask="url(#c2dm)"/>'
    + '<rect width="' + W + '" height="' + H + '" fill="url(#c2g3)"/><rect width="' + W + '" height="' + H + '" fill="url(#c2g1)"/><rect width="' + W + '" height="' + H + '" fill="url(#c2g2)"/>';
  if (BRAND) s += '<image x="' + L2 + '" y="62" width="42" height="42" href="' + BRAND + '" preserveAspectRatio="xMidYMid meet"/>';
  s += bold(L2 + 54, 92, 28, 'LumosCore', C2.INK, -0.4, 0.9);
  if (eyebrow) {
    s += '<circle cx="' + (L2 + 5) + '" cy="226" r="5" fill="url(#c2flame)"/>'
      + bold(L2 + 20, 233, 19, String(eyebrow).toUpperCase(), C2.SOFT, 2.6, 0.5);
  }
  s += bold(L2 - 4, 334, ts, title, C2.INK, -ts * 0.04, Math.max(1.8, ts * 0.04));
  subs.forEach((t, i) => {
    let fs2 = 30; while (fs2 > 22 && textW(t, fs2, 0) > TMAX) fs2 -= 1;
    s += plain(L2, 392 + i * 40, fs2, t, C2.MUTED);
  });
  s += '<rect x="' + L2 + '" y="490" width="' + (W - L2 * 2) + '" height="1" fill="#ffffff" fill-opacity=".06"/>'
    + chips2(chipList)
    + bold(W - L2, 545, 20, 'lumoscore.com', C2.SOFT, 0, 0.4, 'end')
    + (v.svg || '')
    + '</svg>';
  return s;
}

// ---- pictures (right half; centre ~ 925,305) ----------------------------------------------------
const glass2 = (x, y, w, h, r) => '<rect x="' + x + '" y="' + (y + 14) + '" width="' + w + '" height="' + h + '" rx="' + r + '" fill="#000000" fill-opacity=".35"/>'
  + '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + r + '" fill="url(#c2glass)" stroke="url(#c2edge)" stroke-width="1.5"/>';
const ring2 = (cx, cy, r, op, dash) => '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#ffffff" stroke-opacity="' + op + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>';
const halo2 = (cx, cy, r) => '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 1.25) + '" fill="url(#c2halo)"/>';
// the network badge a network page's picture wears (top-left of the picture)
function netBadge(chain, cx, cy) {
  if (!chain || !CHAIN[chain]) return '';
  return '<circle cx="' + cx + '" cy="' + cy + '" r="24" fill="#0d0d10" stroke="url(#c2edge)" stroke-width="1.5"/>' + chipMark(chain, cx, cy, 22);
}
function brandDisc(cx, cy, r) {
  return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#0d0d10" stroke="url(#c2edge)" stroke-width="1.5"/>'
    + (BRAND ? '<image x="' + (cx - r * 0.75) + '" y="' + (cy - r * 0.75) + '" width="' + (r * 1.5) + '" height="' + (r * 1.5) + '" href="' + BRAND + '" preserveAspectRatio="xMidYMid meet"/>' : '');
}
function monogram(cx, cy, size, code) {
  const t = String(code || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?';
  return bold(cx, cy + size * 0.36, size, t, '#ffffff', 0, 1.6, 'middle');
}

const VIS = {
  home() {
    return { svg: halo2(925, 300, 175) + ring2(925, 300, 205, .05) + ring2(925, 300, 160, .07, '2 8') + ring2(925, 300, 115, .10)
      + brandDisc(925, 300, 86)
      + '<circle cx="1083" cy="214" r="5" fill="#ffcf5a"/><circle cx="772" cy="380" r="4" fill="#3fd0ea"/><circle cx="1050" cy="420" r="3.5" fill="#e2557f"/>' };
  },
  chart(chain) {
    const P = [[0, 168], [45, 150], [90, 160], [135, 118], [180, 128], [225, 92], [270, 104], [315, 66], [360, 52]];
    const X = (p) => 760 + p[0], Y = (p) => 190 + p[1];
    let d = 'M' + X(P[0]) + ' ' + Y(P[0]);
    for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], mx = (X(a) + X(b)) / 2; d += ' C' + mx + ' ' + Y(a) + ' ' + mx + ' ' + Y(b) + ' ' + X(b) + ' ' + Y(b); }
    let g = ''; for (let i = 0; i < 4; i++) g += '<rect x="760" y="' + (230 + i * 50) + '" width="360" height="1" fill="#ffffff" fill-opacity=".05"/>';
    [22, 14, 30, 18, 26, 36, 20, 28, 40].forEach((h, i) => { g += '<rect x="' + (764 + i * 44) + '" y="' + (420 - h) + '" width="22" height="' + h + '" rx="4" fill="#ffffff" fill-opacity=".08"/>'; });
    return { svg: glass2(728, 150, 424, 310, 30) + g + '<path d="' + d + ' L1120 420 L760 420 Z" fill="url(#c2area)"/>'
      + '<path d="' + d + '" fill="none" stroke="url(#c2flame)" stroke-width="5" stroke-linecap="round"/>'
      + '<circle cx="1120" cy="242" r="16" fill="#ffcf5a" fill-opacity=".18"/><circle cx="1120" cy="242" r="7.5" fill="#ffcf5a"/>'
      + netBadge(chain, 778, 186) };
  },
  bridge(chain) {
    let dots = '';
    for (let i = 1; i < 10; i++) { if (i === 5) continue; const t = i / 10, x = (1 - t) * (1 - t) * 790 + 2 * (1 - t) * t * 925 + t * t * 1060, y = (1 - t) * (1 - t) * 360 + 2 * (1 - t) * t * 170 + t * t * 360; dots += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4.2" fill="url(#c2flame)"/>'; }
    const end = (cx) => '<circle cx="' + cx + '" cy="360" r="62" fill="#0d0d10" stroke="url(#c2edge)" stroke-width="1.5"/>' + ring2(cx, 360, 84, .06) + ring2(cx, 360, 106, .035);
    const left = chain && CHAIN[chain] ? chipMark(chain, 790, 360, 40)
      : '<path d="M772 360 h34 m-12 -12 l12 12 l-12 12" fill="none" stroke="#dddce2" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>';
    return { svg: halo2(925, 300, 190) + '<path d="M790 360 Q925 170 1060 360" fill="none" stroke="#ffffff" stroke-opacity=".07" stroke-width="2"/>' + dots
      + end(790) + end(1060) + left
      + '<circle cx="1060" cy="360" r="15" fill="none" stroke="#dddce2" stroke-width="3.5"/><path d="M1053 360 l5 5 l9 -10" fill="none" stroke="#dddce2" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>'
      + brandDisc(925, 232, 34) };
  },
  orb(chain) {
    const wave = (y, amp, ph, fill) => { let d = 'M760 ' + y; for (let x = 760; x <= 1090; x += 10) d += ' L' + x + ' ' + (y + Math.sin((x - 760) / 52 + ph) * amp).toFixed(1); return '<path d="' + d + ' L1090 470 L760 470 Z" fill="' + fill + '"/>'; };
    return { svg: halo2(925, 305, 200) + '<circle cx="925" cy="319" r="150" fill="#000000" fill-opacity=".35"/>'
      + '<g clip-path="url(#c2orb)"><rect x="760" y="140" width="330" height="330" fill="#0d0d10"/>' + wave(300, 14, 0, 'url(#c2liq1)') + wave(330, 12, 2.2, 'url(#c2liq2)') + wave(372, 9, 4.1, '#ffffff') .replace('fill="#ffffff"', 'fill="#ffffff" fill-opacity=".06"') + '</g>'
      + '<circle cx="925" cy="305" r="150" fill="none" stroke="url(#c2edge)" stroke-width="1.6"/>'
      + '<path d="M842 214 A118 118 0 0 1 960 182" fill="none" stroke="#ffffff" stroke-opacity=".22" stroke-width="7" stroke-linecap="round"/>'
      + ring2(925, 305, 182, .05) + ring2(925, 305, 214, .03)
      + '<circle cx="1018" cy="252" r="5" fill="#ffffff" fill-opacity=".5"/><circle cx="880" cy="268" r="3.5" fill="#ffffff" fill-opacity=".35"/>'
      + netBadge(chain, 800, 168) };
  },
  // one token: its own logo in a glass tile, contained (not cropped -- not every logo is round)
  token(logo, code, chain) {
    const defs = '<clipPath id="c2tk"><rect x="835" y="215" width="180" height="180" rx="44"/></clipPath>';
    return { defs, svg: halo2(925, 305, 170) + glass2(775, 155, 300, 300, 56)
      + '<rect x="815" y="195" width="220" height="220" rx="56" fill="#0d0d10" stroke="url(#c2edge)" stroke-width="1.5"/>'
      + (logo ? '<image x="835" y="215" width="180" height="180" href="' + logo + '" clip-path="url(#c2tk)" preserveAspectRatio="xMidYMid meet"/>' : monogram(925, 305, 84, code))
      + netBadge(chain, 790, 170) };
  },
  // a pool: the two tokens' logos overlapping, inside the same soft rings as the orb
  pair(la, lb, ca, cb, chain) {
    const one = (cx, logo, code, id) => '<circle cx="' + cx + '" cy="305" r="92" fill="#0d0d10" stroke="url(#c2edge)" stroke-width="1.6"/>'
      + (logo ? '<image x="' + (cx - 66) + '" y="239" width="132" height="132" href="' + logo + '" clip-path="url(#' + id + ')" preserveAspectRatio="xMidYMid meet"/>' : monogram(cx, 305, 62, code));
    const defs = '<clipPath id="c2pa"><circle cx="865" cy="305" r="66"/></clipPath><clipPath id="c2pb"><circle cx="985" cy="305" r="66"/></clipPath>';
    return { defs, svg: halo2(925, 305, 200) + ring2(925, 305, 182, .05) + ring2(925, 305, 214, .03)
      + one(865, la, ca, 'c2pa') + one(985, lb, cb, 'c2pb') + netBadge(chain, 800, 190) };
  },
  posts() {
    let g = '';
    [0, 1, 2].forEach((i) => { const y = 200 + i * 78; g += '<rect x="785" y="' + y + '" width="280" height="60" rx="16" fill="#ffffff" fill-opacity="' + (i === 0 ? '.07' : '.04') + '" stroke="url(#c2edge)"/>'
      + '<circle cx="815" cy="' + (y + 30) + '" r="8" fill="' + (i === 0 ? 'url(#c2flame)' : '#ffffff') + '"' + (i === 0 ? '' : ' fill-opacity=".25"') + '/>'
      + '<rect x="837" y="' + (y + 22) + '" width="' + [180, 150, 166][i] + '" height="8" rx="4" fill="#ffffff" fill-opacity=".28"/><rect x="837" y="' + (y + 36) + '" width="' + [120, 96, 110][i] + '" height="6" rx="3" fill="#ffffff" fill-opacity=".12"/>'; });
    return { svg: halo2(925, 300, 180) + g };
  },
  docs() {
    let g = glass2(780, 160, 290, 300, 28) + '<rect x="808" y="192" width="120" height="12" rx="6" fill="url(#c2flame)"/>';
    [210, 180, 230, 160, 200, 140, 190].forEach((w, i) => { g += '<rect x="808" y="' + (228 + i * 28) + '" width="' + w + '" height="9" rx="4.5" fill="#ffffff" fill-opacity="' + (i % 3 === 2 ? '.12' : '.22') + '"/>'; });
    return { svg: halo2(925, 300, 180) + g };
  },
  paper() {
    let g = '<rect x="845" y="168" width="200" height="270" rx="18" fill="#ffffff" fill-opacity=".03" stroke="url(#c2edge)" transform="rotate(6 945 303)"/>'
      + glass2(815, 158, 200, 270, 18) + '<rect x="843" y="190" width="80" height="12" rx="6" fill="url(#c2flame)"/>';
    [140, 120, 132, 100, 126, 112, 90].forEach((w, i) => { g += '<rect x="843" y="' + (222 + i * 26) + '" width="' + w + '" height="8" rx="4" fill="#ffffff" fill-opacity=".22"/>'; });
    return { svg: halo2(925, 300, 180) + g };
  },
  listing() {
    return { svg: halo2(925, 305, 180) + ring2(925, 305, 150, .05) + ring2(925, 305, 112, .08, '2 8')
      + '<circle cx="925" cy="305" r="78" fill="#0d0d10" stroke="url(#c2edge)" stroke-width="1.5"/>'
      + '<rect x="890" y="299" width="70" height="12" rx="6" fill="url(#c2flame)"/><rect x="919" y="270" width="12" height="70" rx="6" fill="url(#c2flame)"/>'
      + '<circle cx="1046" cy="214" r="22" fill="#0e2519" stroke="#1fa968" stroke-opacity=".5"/><path d="M1036 214.5l6 6 11-11.5" fill="none" stroke="#1fa968" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>' };
  },
  rewards(chain) {
    let sp = ''; [[1060, 200, 7], [870, 168, 5], [1080, 400, 5], [775, 410, 6]].forEach(([x, y, r]) => { sp += '<path d="M' + x + ' ' + (y - r * 2) + ' L' + (x + r * 0.5) + ' ' + (y - r * 0.5) + ' L' + (x + r * 2) + ' ' + y + ' L' + (x + r * 0.5) + ' ' + (y + r * 0.5) + ' L' + x + ' ' + (y + r * 2) + ' L' + (x - r * 0.5) + ' ' + (y + r * 0.5) + ' L' + (x - r * 2) + ' ' + y + ' L' + (x - r * 0.5) + ' ' + (y - r * 0.5) + ' Z" fill="url(#c2flame)" fill-opacity=".8"/>'; });
    return { svg: halo2(925, 305, 190) + ring2(925, 305, 190, .04) + ring2(925, 305, 145, .07, '2 8') + brandDisc(925, 305, 100) + sp + netBadge(chain, 800, 190) };
  },
  launch(chain) {
    // a new token: a coin at the end of a curved launch trail, with a small "Minted" tag. Not the
    // LumosCore flame -- the token being launched is the visitor's own, not LUMOS.
    const star = (x, y, r, fill) => '<path d="M' + x + ' ' + (y - r) + ' C' + (x + r * 0.12) + ' ' + (y - r * 0.12) + ' ' + (x + r * 0.12) + ' ' + (y - r * 0.12) + ' ' + (x + r) + ' ' + y
      + ' C' + (x + r * 0.12) + ' ' + (y + r * 0.12) + ' ' + (x + r * 0.12) + ' ' + (y + r * 0.12) + ' ' + x + ' ' + (y + r)
      + ' C' + (x - r * 0.12) + ' ' + (y + r * 0.12) + ' ' + (x - r * 0.12) + ' ' + (y + r * 0.12) + ' ' + (x - r) + ' ' + y
      + ' C' + (x - r * 0.12) + ' ' + (y - r * 0.12) + ' ' + (x - r * 0.12) + ' ' + (y - r * 0.12) + ' ' + x + ' ' + (y - r) + 'Z" fill="' + fill + '"/>';
    return { svg: halo2(985, 250, 180)
      + '<path d="M760 450 C 820 430 880 380 925 320" fill="none" stroke="url(#c2flame)" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 14"/>'
      + ring2(1000, 245, 128, .05) + ring2(1000, 245, 96, .08, '2 8')
      + '<circle cx="1000" cy="245" r="72" fill="#0d0d10" stroke="url(#c2flame)" stroke-width="3"/>'
      + '<circle cx="1000" cy="245" r="56" fill="none" stroke="#ffffff" stroke-opacity=".08"/>'
      + star(1000, 245, 30, 'url(#c2flame)') + star(1052, 186, 9, '#ffcf5a') + star(940, 300, 6, '#3fd0ea')
      + '<rect x="930" y="345" width="140" height="44" rx="22" fill="#0e2519" stroke="#1fa968" stroke-opacity=".5"/>'
      + '<circle cx="953" cy="367" r="11" fill="#1fa968"/><path d="M947.5 367.5l3.6 3.6 7-7.2" fill="none" stroke="#08080a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'
      + bold(972, 374, 19, 'Minted', '#86e3b6', 0, 0.5)
      + netBadge(chain, 800, 190) };
  },
};

// 2 to 4 tokens of one pool, overlapping in a row (NEAR pools can hold up to four).
VIS.group = function (logos, codes, chain) {
  const n = Math.max(2, Math.min(4, (logos || []).length || 2));
  if (n === 2) return VIS.pair(logos[0], logos[1], codes[0], codes[1], chain);
  const r = n === 3 ? 74 : 62, step = r * 1.45, x0 = 925 - step * (n - 1) / 2;
  let defs = '', svg = halo2(925, 305, 200) + ring2(925, 305, 182, .05) + ring2(925, 305, 214, .03);
  for (let i = 0; i < n; i++) {
    const cx = Math.round(x0 + i * step), id = 'c2g' + i, ir = Math.round(r * 0.72);
    defs += '<clipPath id="' + id + '"><circle cx="' + cx + '" cy="305" r="' + ir + '"/></clipPath>';
    svg += '<circle cx="' + cx + '" cy="305" r="' + r + '" fill="#0d0d10" stroke="url(#c2edge)" stroke-width="1.6"/>'
      + (logos[i] ? '<image x="' + (cx - ir) + '" y="' + (305 - ir) + '" width="' + (ir * 2) + '" height="' + (ir * 2) + '" href="' + logos[i] + '" clip-path="url(#' + id + ')" preserveAspectRatio="xMidYMid meet"/>' : monogram(cx, 305, Math.round(r * 0.62), codes[i]));
  }
  return { defs, svg: svg + netBadge(chain, 800, 190) };
};
// MCP: a terminal window -- an agent asks, a transaction comes back ready to sign. No real addresses or numbers.
VIS.terminal = function () {
  const line = (y, w, op) => '<rect x="790" y="' + y + '" width="' + w + '" height="9" rx="4.5" fill="#ffffff" fill-opacity="' + op + '"/>';
  return { svg: halo2(925, 300, 190) + glass2(745, 165, 360, 280, 24)
    + '<rect x="745" y="165" width="360" height="40" rx="24" fill="#ffffff" fill-opacity=".04"/>'
    + '<circle cx="771" cy="185" r="5.5" fill="#e5484d" fill-opacity=".8"/><circle cx="790" cy="185" r="5.5" fill="#ffcf5a" fill-opacity=".8"/><circle cx="809" cy="185" r="5.5" fill="#1fa968" fill-opacity=".8"/>'
    + '<path d="M772 238 l10 7 -10 7" fill="none" stroke="url(#c2flame)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<rect x="792" y="240" width="170" height="10" rx="5" fill="#ffffff" fill-opacity=".45"/>'
    + line(272, 240, .18) + line(294, 200, .18) + line(316, 220, .12)
    + '<rect x="772" y="350" width="196" height="44" rx="22" fill="#0e2519" stroke="#1fa968" stroke-opacity=".5"/>'
    + '<circle cx="795" cy="372" r="11" fill="#1fa968"/><path d="M789.5 372.5l3.6 3.6 7-7.2" fill="none" stroke="#08080a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'
    + bold(814, 379, 19, 'Ready to sign', '#86e3b6', 0, 0.5)
    + brandDisc(1105, 175, 34) };
};

// The new asset card, same inputs as assetCard so the browser generator and every builder keep working.
function assetCard2({ code, logo, badge, domain, issuer, chain }) {
  const ch = chain || 'Stellar';
  const third = domain || (issuer ? issuer.slice(0, 4) + '…' + issuer.slice(-4) : '');
  const tick = badge && /curat|lumoscore token|verified/i.test(badge);
  return card({
    eyebrow: 'Token on ' + (CHAIN[ch] ? CHAIN[ch].label : ch),
    title: code, titleSize: 108,
    // NEAR passes the token's CONTRACT where Stellar passes the issuer's website, so it is named as one.
    sub: [third ? (ch === 'NEAR' ? 'Contract ' + third : domain ? 'Issued by ' + domain : 'Issuer ' + third) : 'Trade it on LumosCore'],
    chipList: [{ t: CHAIN[ch] ? CHAIN[ch].label : ch, chain: ch }, badge ? (tick ? { t: badge, tick: true } : { t: badge }) : null],
    visual: VIS.token(logo, code, null),
  });
}

const API = {
  card, VIS, assetCard2, setBrand, C2,
  W, H, BG, BG_TOP, INK, MUTED, ACCENT, GREEN, LINE, FONT,
  L, CODE_BASE, CODE_NOM, PANEL, PAD, INNER, PX, PY,
  ROW_Y, ROW_H, ROW_MID, ROW_FS, ROW_BASE, ACCENT_BASE, FEAT_BASE, RULE_Y,
  esc, textW, hasFont, initMetrics, bold, plain, CHAIN, CHECK, chainMark, metaRow, brandRow, fitHeadline,
  // assetCard IS the new card (2026-11-26): the browser generator, _ogcards.js and the NEAR builders all
  // call K.assetCard with the same inputs and get the new design. The old one stays as assetCardV1.
  shell, assetPanel, assetCard: assetCard2, assetCardV1: assetCard, render, toPng, imageDataUri, emitBrowser,
};
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else if (typeof window !== 'undefined') window.LXOGKit = API;
