// Share cards for curated assets: a real 1200x630 image instead of a logo padded onto a square.
//
// WHY THIS IS A BUILD STEP AND NOT AN ENDPOINT. Rendering a card on demand needs satori plus a
// WebAssembly rasteriser -- about 8.5MB unpacked -- inside a Worker bundle capped at 1MB gzipped on
// this plan, and 50-200ms of CPU against a 10ms budget. It fails on both counts. Generated here, the
// libraries are devDependencies that never reach Cloudflare, the cards are static files on the CDN,
// and serving one costs nothing.
//
// The price is deliberately NOT on the card. A build-time image would freeze whatever the price was
// at publish and keep showing it for days; a share card that quotes a stale number is worse than one
// that quotes none. Code, name, issuer domain and the verification mark are all facts that do not go
// off between builds.
//
// Writes into assets/og/ -- the SOURCE directory the build copies to dist/ -- and records which ids it
// managed to draw in _data/ogcards.json, which extract_site.js reads so the middleware only points at
// a card that actually exists.
//
// Usage: node _tools/_ogcards.js [--limit N]
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
const BG = '#0a0a0b', INK = '#ffffff', MUTED = '#9aa0ad', ACCENT = '#ea6a2c';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// A stable colour per code, so an asset with no usable logo still gets its own mark rather than a
// grey square shared with every other one.
function hue(code) {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) % 360;
  return h;
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
      return /^data:image\/(png|jpe?g|webp)/i.test(u) ? u : '';
    }
    if (u.indexOf('/') === 0) u = ORIGIN + u;
    const img = await fetch(u);
    if (!img.ok) return '';
    const type = (img.headers.get('content-type') || '').split(';')[0].toLowerCase();
    if (!/^image\/(png|jpeg|jpg|webp)$/.test(type)) return '';
    const buf = Buffer.from(await img.arrayBuffer());
    if (buf.length > 2 * 1024 * 1024) return '';
    return 'data:' + type + ';base64,' + buf.toString('base64');
  } catch (e) { return '';

  }
}

const TICK = '<path d="M9 16.2l-3.5-3.5-1.4 1.4L9 19 20 8l-1.4-1.4z" fill="#1fa968"/>';

function card({ code, name, domain, logo, verified }) {
  const h = hue(code);
  const initials = code.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?';
  const mark = logo
    ? '<image x="80" y="196" width="150" height="150" href="' + logo + '" clip-path="url(#r)" preserveAspectRatio="xMidYMid slice"/>'
    : '<rect x="80" y="196" width="150" height="150" rx="34" fill="hsl(' + h + ',58%,46%)"/>'
      + '<text x="155" y="296" font-family="Hanken Grotesk" font-size="62" font-weight="800" fill="#fff" text-anchor="middle">' + esc(initials) + '</text>';

  // The second line is the issuer's own domain when it has one, because that is the thing a share is
  // implicitly vouching for. Without one, say so plainly rather than inventing a subtitle.
  const sub = domain ? domain : (name && name !== code ? name : 'Issued on Stellar');

  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">'
    + '<defs>'
    + '<clipPath id="r"><rect x="80" y="196" width="150" height="150" rx="34"/></clipPath>'
    + '<radialGradient id="glow" cx="0.18" cy="0.1" r="0.75">'
    + '<stop offset="0" stop-color="' + ACCENT + '" stop-opacity="0.20"/>'
    + '<stop offset="1" stop-color="' + ACCENT + '" stop-opacity="0"/></radialGradient>'
    + '<linearGradient id="rule" x1="0" y1="0" x2="1" y2="0">'
    + '<stop offset="0" stop-color="' + ACCENT + '"/><stop offset="1" stop-color="' + ACCENT + '" stop-opacity="0"/>'
    + '</linearGradient></defs>'
    + '<rect width="' + W + '" height="' + H + '" fill="' + BG + '"/>'
    + '<rect width="' + W + '" height="' + H + '" fill="url(#glow)"/>'
    + '<rect width="' + W + '" height="5" fill="url(#rule)"/>'
    + mark
    + '<text x="278" y="272" font-family="Hanken Grotesk" font-size="92" fill="' + INK + '" stroke="' + INK + '" stroke-width="2.2" letter-spacing="-3">' + esc(code) + '</text>'
    + (verified ? '<g transform="translate(' + (292 + code.length * 52) + ',232) scale(1.7)">' + TICK + '</g>' : '')
    + '<text x="282" y="330" font-family="Hanken Grotesk" font-size="34" fill="' + MUTED + '">' + esc(sub) + '</text>'
    + '<rect x="80" y="470" width="1040" height="1" fill="#26262c"/>'
    + '<circle cx="92" cy="536" r="12" fill="' + ACCENT + '"/>'
    + '<text x="118" y="548" font-family="Hanken Grotesk" font-size="34" fill="' + INK + '" stroke="' + INK + '" stroke-width="0.9" letter-spacing="-1">LumosCore</text>'
    + '<text x="1120" y="548" font-family="Hanken Grotesk" font-size="28" fill="' + MUTED + '" text-anchor="end">Trade on Stellar</text>'
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
  if (!fs.existsSync(FONT)) {
    console.error('og cards: missing ' + FONT + ' — nothing written');
    process.exit(1);
  }
  const limitArg = process.argv.indexOf('--limit');
  const LIMIT = limitArg > 0 ? parseInt(process.argv[limitArg + 1], 10) : 0;

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
  let withLogo = 0;
  for (const id of ids) {
    const code = id.slice(0, id.lastIndexOf('-'));
    let domain = '';
    try {
      const m = await (await fetch(ORIGIN + '/lxapi/assetmeta?asset=' + encodeURIComponent(id) + '&meta=1')).json();
      domain = (m && m.meta && m.meta.website) || '';
      domain = String(domain).replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    } catch (e) { /* a card without a domain is still a card */ }
    const v = verified[id];
    const logo = await logoDataUri(id);
    if (logo) withLogo++;
    try {
      const png = render(card({ code, name: '', domain, logo, verified: !!(v && v.v) }));
      fs.writeFileSync(path.join(OUT_DIR, id + '.png'), png);
      done.push(id);
    } catch (e) {
      console.error('  ' + id + ': ' + e.message);
    }
  }

  fs.writeFileSync(LIST_FILE, JSON.stringify(done, null, 0), 'utf8');
  console.log('og cards: wrote ' + done.length + ' card(s) of ' + ids.length
    + ' (' + withLogo + ' with a real logo) -> dist/assets/og/');
})();
