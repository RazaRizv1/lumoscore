// Share cards for curated assets: a real 1200x630 image instead of a logo padded onto a square.
//
// WHY THIS IS A BUILD STEP AND NOT AN ENDPOINT. Rendering a card on demand needs satori plus a
// WebAssembly rasteriser -- about 8.5MB unpacked -- inside a Worker bundle capped at 1MB gzipped on
// this plan, and 50-200ms of CPU against a 10ms budget. It fails on both counts. Generated here, the
// libraries are devDependencies that never reach Cloudflare, the cards are static files on the CDN,
// and serving one costs nothing. functions/lxapi/ogcard.js prefers the file this writes and falls
// back to a padded logo for anything not drawn here.
//
// The price is deliberately NOT on the card. A build-time image would freeze whatever the price was
// at publish and keep showing it for days; a share card that quotes a stale number is worse than one
// that quotes none. Code, chain, curation status and issuer domain are all facts that do not go off
// between builds.
//
// LAYOUT (redesigned 2026-10-08). Content stacks down the left -- accent dash, metadata row, the
// code, the call to action, what the page holds -- with the logo lifted into a glass panel on the
// right under a raking light shaft. Every colour is a token off the site's own dark theme.
//
// Writes into dist/assets/og/ and records which ids it managed to draw in _data/ogcards.json, which
// extract_site.js reads so the middleware only points at a card that actually exists.
//
// Usage: node _tools/_ogcards.js [--limit N] [--chain Stellar|XRPL]
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const ORIGIN = 'https://lumoscore.com';
// dist/assets is committed directly rather than copied from assets/ on a public build, so the cards
// are written where they actually ship from.
const OUT_DIR = path.join(__dirname, '..', 'dist', 'assets', 'og');
const LIST_FILE = path.join(__dirname, '..', '_data', 'ogcards.json');
const FONT = path.join(__dirname, 'fonts', 'HankenGrotesk-variable.ttf');

const W = 1200, H = 630;
const BG = '#0a0a0b', BG_TOP = '#15151d';
const INK = '#f6f5f3', MUTED = '#9a9aa3', ACCENT = '#ea6a2c', GREEN = '#1fa968', LINE = '#2c2c34';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---- real text metrics, read straight out of the TTF --------------------------------------------
// The previous card guessed text width as code.length * 52 and placed the verification tick with
// it, which is why the tick sat on top of AQUA's last letter -- AQUA at 92px is 248.8px wide, not
// 208. Everything positioned after a run of text now uses the font's own advance widths, so the
// metadata row and the tick cannot collide whatever the ticker or the domain turns out to be.
const fbuf = fs.existsSync(FONT) ? fs.readFileSync(FONT) : null;
const FU16 = (o) => fbuf.readUInt16BE(o), FI16 = (o) => fbuf.readInt16BE(o), FU32 = (o) => fbuf.readUInt32BE(o);
let TBL = {}, UPEM = 1000, NUMH = 0, CMAP = new Map();
if (fbuf) {
  for (let i = 0, n = FU16(4); i < n; i++) { const o = 12 + i * 16; TBL[fbuf.toString('ascii', o, o + 4)] = FU32(o + 8); }
  UPEM = FU16(TBL.head + 18); NUMH = FU16(TBL.hhea + 34);
  const c = TBL.cmap; let best = 0;
  for (let i = 0, n = FU16(c + 2); i < n; i++) {
    const pid = FU16(c + 4 + i * 8), eid = FU16(c + 6 + i * 8);
    if ((pid === 3 && (eid === 1 || eid === 10)) || pid === 0) best = c + FU32(c + 8 + i * 8);
  }
  if (FU16(best) === 4) {
    const segX2 = FU16(best + 6), seg = segX2 / 2;
    const endO = best + 14, startO = endO + segX2 + 2, deltaO = startO + segX2, rangeO = deltaO + segX2;
    for (let s = 0; s < seg; s++) {
      const end = FU16(endO + s * 2), start = FU16(startO + s * 2);
      const delta = FI16(deltaO + s * 2), ro = FU16(rangeO + s * 2);
      if (start === 0xffff) continue;
      for (let cp = start; cp <= end && cp !== 0x10000; cp++) {
        let g;
        if (ro === 0) g = (cp + delta) & 0xffff;
        else { const gi = rangeO + s * 2 + ro + (cp - start) * 2; if (gi + 1 >= fbuf.length) continue; g = FU16(gi); if (g) g = (g + delta) & 0xffff; }
        if (g) CMAP.set(cp, g);
      }
    }
  }
}
function textW(str, size, tracking) {
  let u = 0, n = 0;
  for (const ch of String(str)) { const g = CMAP.get(ch.codePointAt(0)); if (g != null) u += FU16(TBL.hmtx + Math.min(g, NUMH - 1) * 4); n++; }
  return u * size / UPEM + (tracking || 0) * Math.max(0, n - 1);
}

// A stable colour per code, so an asset with no usable logo still gets its own mark rather than a
// grey square shared with every other one.
function hue(code) { let h = 0; for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) % 360; return h; }

// The chain marks, lifted from the site's own inlined icons so the card cannot drift from the UI.
// Both are paths in a 32-unit viewBox; bb is the glyph's real bounding box inside it, because the
// glyph fills only about 20 of those units and drawing at viewBox scale makes the mark look weak.
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

// RESVG 2.6.2 CANNOT DECODE WEBP. A webp data URI draws NOTHING and raises no error, so the card
// ships with an empty panel while the build reports it had a real logo -- verified against a
// known-good webp, which renders blank where the same image as PNG renders fine. No Stellar curated
// logo is webp today (measured: 53 png, 2 jpeg, 1 svg), so this is a trap rather than a live bug
// here; it is a live one on XRPL, where xrpl.to serves webp for every token icon. sharp is already a
// dependency, so anything that is not already PNG or JPEG is decoded to PNG before it reaches resvg.
async function toPng(buf) {
  try {
    const out = await require('sharp')(buf).png().toBuffer();
    return 'data:image/png;base64,' + out.toString('base64');
  } catch (e) { return ''; }
}

async function logoDataUri(assetId) {
  try {
    const r = await fetch(ORIGIN + '/lxapi/assetlogo?asset=' + encodeURIComponent(assetId));
    if (!r.ok) return '';
    const d = await r.json();
    let u = d && d.image;
    if (!u) return '';
    if (u.indexOf('data:') === 0) {
      // resvg embeds raster data URIs; an SVG one it will not rasterise, so those fall back to the
      // monogram rather than producing a card with a hole in it.
      if (/^data:image\/(png|jpe?g)/i.test(u)) return u;
      if (/^data:image\/svg/i.test(u)) return '';
      const m = /^data:([^;]+);base64,(.*)$/i.exec(u);
      return m ? await toPng(Buffer.from(m[2], 'base64')) : '';
    }
    if (u.indexOf('/') === 0) u = ORIGIN + u;
    const img = await fetch(u);
    if (!img.ok) return '';
    const type = (img.headers.get('content-type') || '').split(';')[0].toLowerCase();
    if (type.indexOf('image/') !== 0 || type.indexOf('svg') >= 0) return '';
    const buf = Buffer.from(await img.arrayBuffer());
    if (buf.length > 2 * 1024 * 1024) return '';
    if (type === 'image/png' || type === 'image/jpeg' || type === 'image/jpg') {
      return 'data:' + type + ';base64,' + buf.toString('base64');
    }
    return await toPng(buf);
  } catch (e) { return ''; }
}

// resvg ignores font-weight on this variable font -- probed: weight 400 and weight 900 render to
// byte-identical output -- so weight is drawn as a stroke in the same colour as the fill. It is not
// a shortcut; it is the only way to get a heavy face out of this renderer.
function bold(x, y, size, text, fill, track, w, anchor) {
  return '<text x="' + x + '" y="' + y + '" font-family="Hanken Grotesk" font-size="' + size + '"'
    + (track ? ' letter-spacing="' + track + '"' : '') + (anchor ? ' text-anchor="' + anchor + '"' : '')
    + ' fill="' + fill + '" stroke="' + fill + '" stroke-width="' + (w || 2) + '" stroke-linejoin="round">' + esc(text) + '</text>';
}
function plain(x, y, size, text, fill, anchor) {
  return '<text x="' + x + '" y="' + y + '" font-family="Hanken Grotesk" font-size="' + size + '"'
    + (anchor ? ' text-anchor="' + anchor + '"' : '') + ' fill="' + fill + '">' + esc(text) + '</text>';
}

function card({ code, logo, verified, domain, chain }) {
  const C = CHAIN[chain] || CHAIN.Stellar;
  const L = 84;                                     // left margin, shared by every line

  // The panel is centred on the CODE, not on the column as a whole: the code is where the eye
  // lands, and a panel centred on the full stack read as sitting high beside it. The centre is
  // computed from the NOMINAL size rather than the fitted one, so the panel lands in the same place
  // on every card instead of drifting with the length of the ticker.
  const CODE_BASE = 402, CODE_NOM = 122;
  const PANEL = 330, PAD = 52, INNER = PANEL - PAD * 2;
  const PX = W - L - PANEL;
  const PY = Math.round((CODE_BASE - CODE_NOM * 0.72 + CODE_BASE) / 2 - PANEL / 2);

  // ---- metadata row: chain, curation status, issuer domain --------------------------------------
  // It sits ABOVE the panel rather than beside it. Measured across the curated list, 86 of 116
  // chain/asset combinations push this row past the panel's left edge -- brave-token.age-shield.com
  // reaches ~1047 against a panel starting at 786 -- so a row level with the panel would have run
  // into it on most cards rather than a rare few.
  const rowY = 148, rowH = 38, rowMid = rowY + rowH / 2;
  const chainFs = 34, chainBase = rowMid + chainFs * 0.72 / 2;
  const gH = 36, gS = gH / C.bb[3], gW = C.bb[2] * gS;
  const gTx = L - C.bb[0] * gS, gTy = rowMid - gH / 2 - C.bb[1] * gS;
  const nameX = L + gW + 20;
  const divX = nameX + textW(C.label, chainFs, -0.5) + 30;
  const ringR = 16, ringCx = divX + 30 + ringR;
  const curX = ringCx + ringR + 16;
  const curLabel = verified ? 'Curated asset' : 'Listed asset';
  const div2X = curX + textW(curLabel, 30, 0) + 30;

  // ---- the code, stepped down only as far as it must --------------------------------------------
  let cs = CODE_NOM, track = -3.5;
  const codeMax = PX - L - 48;
  while (cs > 58 && textW(code, cs, track) > codeMax) cs -= 2;

  // CONTAIN, NEVER CROP. `slice` scales the image to COVER the square and cuts off whatever does not
  // fit, which is right for a photograph and wrong for a logo. Measured across the curated list:
  // 49 logos are square and unaffected, 7 are not -- LUMOS worst at 294x385, losing roughly a
  // quarter of its height, which cut the base clean off the flame. `meet` fits the whole mark inside
  // the tile and lets the glass panel show at the edges.
  const IX = PX + PAD, IY = PY + PAD, IR = Math.round(INNER * 0.25);
  const mark = logo
    ? '<image x="' + IX + '" y="' + IY + '" width="' + INNER + '" height="' + INNER + '" href="' + logo + '" clip-path="url(#lclip)" preserveAspectRatio="xMidYMid meet"/>'
    : '<rect x="' + IX + '" y="' + IY + '" width="' + INNER + '" height="' + INNER + '" rx="' + IR + '" fill="hsl(' + hue(code) + ',58%,46%)"/>'
      + bold(IX + INNER / 2, IY + INNER / 2 + 30, 84, code.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?', '#fff', 0, 1.8, 'middle');

  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">'
    + '<defs>'
    // light enters from the top right, where the shaft and the panel are
    + '<linearGradient id="bgg" x1="1" y1="0" x2="0.25" y2="1">'
    + '<stop offset="0" stop-color="' + BG_TOP + '"/><stop offset="1" stop-color="' + BG + '"/></linearGradient>'
    + '<linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0" stop-color="#cfd6e4" stop-opacity="0.13"/>'
    + '<stop offset="1" stop-color="#cfd6e4" stop-opacity="0"/></linearGradient>'
    // A shaft with hard sides reads as a seam rather than as light, so both edges are feathered.
    + '<linearGradient id="beamh" x1="0" y1="0" x2="1" y2="0">'
    + '<stop offset="0" stop-color="#000"/><stop offset="0.5" stop-color="#fff"/><stop offset="1" stop-color="#000"/>'
    + '</linearGradient>'
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
    + '<stop offset="1" stop-color="#ffffff" stop-opacity="0.02"/></linearGradient>'
    + '<clipPath id="lclip"><rect x="' + IX + '" y="' + IY + '" width="' + INNER + '" height="' + INNER + '" rx="' + IR + '"/></clipPath>'
    + '</defs>'

    + '<rect width="' + W + '" height="' + H + '" fill="url(#bgg)"/>'
    + '<rect width="' + W + '" height="' + H + '" fill="url(#glow)"/>'
    + '<g transform="rotate(-21 1040 0)">'
    + '<g mask="url(#beamm)"><rect x="860" y="-340" width="230" height="980" fill="url(#beam)"/></g>'
    + '<g mask="url(#beamm2)" opacity="0.55"><rect x="1120" y="-340" width="90" height="980" fill="url(#beam)"/></g>'
    + '</g>'

    + '<rect x="' + L + '" y="120" width="54" height="5" rx="2.5" fill="' + ACCENT + '"/>'

    + '<g transform="translate(' + gTx.toFixed(2) + ',' + gTy.toFixed(2) + ') scale(' + gS.toFixed(4) + ')"><path d="' + C.d + '" fill="' + INK + '"/></g>'
    + bold(nameX, chainBase, chainFs, C.label, INK, -0.5, 1.5)
    + '<rect x="' + divX.toFixed(1) + '" y="' + (rowY + 1) + '" width="1.5" height="' + (rowH - 2) + '" fill="' + LINE + '"/>'
    + '<circle cx="' + ringCx.toFixed(1) + '" cy="' + rowMid + '" r="' + ringR + '" fill="none" stroke="' + GREEN + '" stroke-width="2.2"/>'
    + '<g transform="translate(' + (ringCx - 11.5).toFixed(1) + ',' + (rowMid - 11.5) + ') scale(0.96)"><path d="' + CHECK + '" fill="' + GREEN + '"/></g>'
    + plain(curX.toFixed(1), chainBase, 30, curLabel, INK)
    // The issuer's own domain -- the thing a share is implicitly vouching for. It comes from the
    // curated record's own `d` field, which the build already holds; the old card asked a second
    // endpoint that returns null and so printed the literal "Issued on Stellar" on all 58 of them.
    + (domain
      ? '<rect x="' + div2X.toFixed(1) + '" y="' + (rowY + 1) + '" width="1.5" height="' + (rowH - 2) + '" fill="' + LINE + '"/>'
        + plain((div2X + 30).toFixed(1), chainBase, 30, domain, MUTED)
      : '')

    + bold(L, CODE_BASE, cs, code, INK, track, 2.8)
    + bold(L, 464, 46, 'Trade on LumosCore', ACCENT, -1, 1.6)
    + plain(L, 520, 32, 'Price · Pools · Holders', MUTED)

    + '<rect x="' + PX + '" y="' + PY + '" width="' + PANEL + '" height="' + PANEL + '" rx="74" fill="url(#sheen)" stroke="url(#edge)" stroke-width="1.6"/>'
    + mark

    + '<rect x="' + L + '" y="566" width="' + (W - L * 2) + '" height="1.5" fill="url(#ruleg)"/>'
    + '<rect x="' + L + '" y="566" width="118" height="1.5" fill="' + ACCENT + '"/>'
    + '</svg>';
}

function render(svg) {
  const r = new Resvg(svg, {
    font: { fontFiles: [FONT], loadSystemFonts: false, defaultFontFamily: 'Hanken Grotesk' },
    fitTo: { mode: 'width', value: W },
  });
  return r.render().asPng();
}

(async () => {
  if (!fbuf) {
    console.error('og cards: missing ' + FONT + ' — nothing written');
    process.exit(1);
  }
  const limitArg = process.argv.indexOf('--limit');
  const LIMIT = limitArg > 0 ? parseInt(process.argv[limitArg + 1], 10) : 0;
  const chainArg = process.argv.indexOf('--chain');
  const CH = chainArg > 0 && CHAIN[process.argv[chainArg + 1]] ? process.argv[chainArg + 1] : 'Stellar';

  let meta;
  try {
    meta = await (await fetch(ORIGIN + '/lxapi/assetmeta')).json();
  } catch (e) {
    console.error('og cards: could not read the curated list from ' + ORIGIN + ' — nothing written');
    process.exit(1);
  }
  let ids = (meta && meta.list) || [];
  const verified = (meta && meta.verified) || {};
  if (LIMIT) ids = ids.slice(0, LIMIT);
  if (!ids.length) { console.error('og cards: curated list is empty — nothing written'); process.exit(1); }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(LIST_FILE), { recursive: true });

  const done = [];
  let withLogo = 0, withDomain = 0;
  const kept = [];
  for (const id of ids) {
    const code = id.slice(0, id.lastIndexOf('-'));
    const v = verified[id] || {};
    const domain = String(v.d || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (domain) withDomain++;
    const logo = await logoDataUri(id);
    if (logo) withLogo++;

    // A LOGO HOST BLIPPING MUST NOT DOWNGRADE A GOOD CARD.
    //
    // These logos live on the issuers' own domains, so any run can lose one to a timeout: this is
    // how XLMG lost its mark, stellargold.net having been briefly unreachable, and the build still
    // reported success. Redrawing it as a two-letter monogram would quietly ship a worse card than
    // the one already on disk. So when the logo could not be fetched and a card already exists, the
    // existing file is kept and the asset is reported as such rather than overwritten.
    const out = path.join(OUT_DIR, id + '.png');
    if (!logo && fs.existsSync(out)) { kept.push(code); done.push(id); continue; }

    try {
      const png = render(card({ code, logo, verified: !!v.v, domain, chain: CH }));
      fs.writeFileSync(out, png);
      done.push(id);
    } catch (e) {
      console.error('  ' + id + ': ' + e.message);
    }
  }

  fs.writeFileSync(LIST_FILE, JSON.stringify(done, null, 0), 'utf8');
  console.log('og cards: wrote ' + done.length + ' card(s) of ' + ids.length
    + ' (' + withLogo + ' with a real logo, ' + withDomain + ' with a domain) -> dist/assets/og/'
    + (kept.length ? '\n  kept ' + kept.length + ' existing card(s) whose logo host was unreachable: ' + kept.join(' ') : ''));
})();
