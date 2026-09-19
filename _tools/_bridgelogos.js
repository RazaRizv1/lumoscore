// Logos for the bridge's From list, fetched ONCE and shipped with the site.
//
// WHY: the From list is every curated asset (_cctp.js reads lib.js VERIFIED + GENERATED_ASSETS). Most of them have
// no logo file of ours, so the list pointed at /lxapi/logoimg at runtime -- and on staging that endpoint could not
// see the admin-panel uploads, so BRAVE, Xoge, PYUSD, USDT0, XTROOP showed an empty disc; XRF's only logo is an SVG,
// which logoimg refuses by design; MTL and EURC had nothing at all (RAZA 2026-09-19). Baking the images in removes
// the runtime dependency, makes staging and main identical, and costs one small PNG per asset.
//
// SOURCES, in order -- the first one that DECODES wins:
//   1. OVERRIDE below (a checked source for an asset nothing else covers)
//   2. the live site's /lxapi/logoimg (admin upload first, then the issuer's toml -- the site's own logo order)
//   3. the logo field the admin panel stored for the asset
//   4. the issuer's stellar.toml [[CURRENCIES]] image for this exact code AND issuer
// Everything is re-encoded by sharp to a 96x96 PNG. That is also what makes an SVG safe here: the output is pixels,
// with no document left in it to carry a script.
//
// Usage: node _tools/_bridgelogos.js [--force]    (after _syncverified.js; then rebuild). Existing files are kept
// unless --force, so a re-run only fetches what is new.
const fs = require('fs');
const path = require('path');
const { VERIFIED, GENERATED_ASSETS } = require(__dirname + '/lib.js');

let sharp;
try { sharp = require('sharp'); } catch (e) { console.error('  ! sharp is not installed -- npm i -D sharp'); process.exit(1); }

const SITE = 'https://lumoscore.pages.dev';
const OUT = path.join(__dirname, '..', 'assets', 'tokens', 'curated');
const FORCE = process.argv.includes('--force');
const BASE = { USDC: 1, XLM: 1, SHX: 1, yXLM: 1, LUMOS: 1, BLND: 1, AQUA: 1 };   // already have logos of their own

const OVERRIDE = {
  // Circle's own mark. circle.com's stellar.toml answers 404 and Stellar Expert holds no image for it, so it comes
  // from CoinGecko's record for EURC (homepage circle.com). Checked by eye 2026-09-19.
  'EURC|GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2': 'https://coin-images.coingecko.com/coins/images/26045/large/EURC.png',
  // The mark shipped for the LayerZero route; its issuer declares no home_domain, so no toml can supply one.
  'USDT0|GATISXX6BZ6NC7IKQBY37CJD4SOZL3CYZJWXEDG6JVIY4WBS6KXJHN6Q': 'file:' + path.join(__dirname, '..', 'assets', 'tokens', 'usdt0.png'),
};

async function bytes(url) {
  if (!url) return null;
  if (url.startsWith('file:')) { try { return fs.readFileSync(url.slice(5)); } catch (e) { return null; } }
  if (url.startsWith('/')) url = SITE + url;
  if (!/^https:\/\//.test(url)) return null;
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'LumosCore-logo-sync' }, signal: AbortSignal.timeout(12000) });
    if (!r.ok) return null;
    const b = Buffer.from(await r.arrayBuffer());
    return b.length > 100 && b.length < 5 * 1024 * 1024 ? b : null;
  } catch (e) { return null; }
}

async function tomlImage(code, issuer) {
  try {
    const a = await fetch('https://horizon.stellar.org/accounts/' + issuer, { signal: AbortSignal.timeout(10000) }).then((r) => r.json());
    const d = a && a.home_domain; if (!d) return null;
    const t = await fetch('https://' + d + '/.well-known/stellar.toml', { signal: AbortSignal.timeout(10000) }).then((r) => (r.ok ? r.text() : ''));
    for (const block of t.split(/\[\[CURRENCIES\]\]/).slice(1)) {
      const body = block.split(/\n\[/)[0];
      const c = /code\s*=\s*"([^"]+)"/.exec(body), i = /issuer\s*=\s*"([^"]+)"/.exec(body), im = /image\s*=\s*"([^"]+)"/.exec(body);
      if (c && i && im && c[1] === code && i[1] === issuer) return im[1];
    }
  } catch (e) {}
  return null;
}

// A dark drawing on a transparent background (TFT's black bars, XRF's black line) vanishes on the dark theme, where
// the list's disc is near-black. Measured, not listed by name: if the visible pixels are dark on average AND a good
// part of the image is transparent, the logo is put on a white disc -- which is how such marks are drawn on light
// pages anyway. A logo with its own background is left exactly as it is.
async function png(buf) {
  try {
    const img = await sharp(buf, { density: 300 }).resize(96, 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const { data, info } = await sharp(img).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let seen = 0, lum = 0, clear = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      const a = data[i + 3];
      if (a < 40) { clear++; continue; }
      seen++; lum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    }
    const px = data.length / info.channels;
    // A round logo on its own dark disc is ~20-25% transparent -- just the corners -- and carries light detail inside
    // (AFR 0.10/0.20, PYUSD 0.19/0.20, yBTC 0.25/0.25), so it is left alone. TFT is pure black (0.00) at 0.31.
    const avg = seen ? lum / seen : 1, open = clear / px;
    if ((avg < 0.3 && open > 0.35) || (avg < 0.05 && open > 0.25)) {
      const disc = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><circle cx="48" cy="48" r="48" fill="#fff"/></svg>');
      const inner = await sharp(img).resize(70, 70, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      return await sharp(disc).composite([{ input: inner, left: 13, top: 13 }]).png().toBuffer();
    }
    return img;
  } catch (e) { return null; }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const logoField = {};
  for (const a of GENERATED_ASSETS || []) if (a && a.code && a.issuer) logoField[a.code + '|' + a.issuer] = a.logo || '';
  const keys = [...new Set(Object.keys(VERIFIED).concat(Object.keys(logoField)))]
    .filter((k) => { const [c, i] = k.split('|'); return i && !BASE[c] && /^G[A-Z2-7]{55}$/.test(i) && /^[A-Za-z0-9]{1,12}$/.test(c); });

  let made = 0, kept = 0; const missing = [];
  for (const k of keys) {
    const [code, issuer] = k.split('|');
    const file = path.join(OUT, code + '-' + issuer + '.png');
    if (!FORCE && fs.existsSync(file)) { kept++; continue; }
    const tries = [
      ['override', OVERRIDE[k]],
      ['logoimg', SITE + '/lxapi/logoimg?asset=' + encodeURIComponent(code + '-' + issuer)],
      ['admin field', logoField[k]],
    ];
    let out = null, from = '';
    for (const [name, url] of tries) {
      const b = await bytes(url); if (!b) continue;
      out = await png(b); if (out) { from = name; break; }
    }
    if (!out) { const u = await tomlImage(code, issuer); const b = await bytes(u); if (b) { out = await png(b); if (out) from = 'toml'; } }
    if (!out) { missing.push(code); continue; }
    fs.writeFileSync(file, out); made++;
    console.log('  ' + code.padEnd(10) + ' <- ' + from);
  }
  console.log('bridge logos: ' + made + ' fetched, ' + kept + ' kept, ' + missing.length + ' with no logo anywhere' + (missing.length ? ': ' + missing.join(', ') : ''));
})();
