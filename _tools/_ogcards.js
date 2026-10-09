// Share cards for curated assets: a real 1200x630 image instead of a logo padded onto a square.
//
// WHY THIS IS A BUILD STEP AND NOT AN ENDPOINT. Rendering a card on demand needs satori plus a
// WebAssembly rasteriser -- about 8.5MB unpacked -- inside a Worker bundle capped at 1MB gzipped on
// this plan, and 50-200ms of CPU against a 10ms budget. It fails on both counts. Generated here, the
// libraries are devDependencies that never reach Cloudflare, the cards are static files on the CDN,
// and serving one costs nothing. functions/lxapi/ogcard.js prefers the file this writes and falls
// back to the chain's trade card for anything not drawn here.
//
// The price is deliberately NOT on the card. A build-time image would freeze whatever the price was
// at publish and keep showing it for days; a share card that quotes a stale number is worse than one
// that quotes none. Code, chain, curation status and issuer domain do not go off between builds.
//
// EVERYTHING VISUAL LIVES IN _ogkit.js. This file used to carry its own copy of the font metrics,
// the frame and the image handling, and that copy is exactly what went wrong: a fix to the kit's
// logo handling -- giving a black-on-transparent mark a white tile so it stops reading as a hole --
// landed in the kit and left the asset cards untouched, because they were never drawing through it.
// There is one renderer now.
//
// Writes into dist/assets/og/ and records which ids it drew in _data/ogcards.json, which
// extract_site.js reads so the middleware only points at a card that exists.
//
// Usage: node _tools/_ogcards.js [--limit N] [--chain Stellar|XRPL]
const fs = require('fs');
const path = require('path');
const K = require('./_ogkit.js');

const ORIGIN = 'https://lumoscore.com';
// dist/assets is committed directly rather than copied from assets/ on a public build, so the cards
// are written where they actually ship from.
const OUT_DIR = path.join(__dirname, '..', 'dist', 'assets', 'og');
const LIST_FILE = path.join(__dirname, '..', '_data', 'ogcards.json');

const { NAMED_LOGOS } = require('./_namedlogos.js');
const TOKENS = path.join(__dirname, '..', 'assets', 'tokens');

// THE CARD NEEDS A BIGGER LOGO THAN THE SITE DOES, which is why it cannot just ask /lxapi/assetlogo
// and stop. The page draws a logo at 32-48px, where the issuer's toml icon is fine; this card draws
// it at 226px. TFT's toml icon is 32x32 and became an unreadable smear of black bars. And EURC's toml
// 404s, so the endpoint answers `image:""` -- the card kept an old render showing a gold "EU" tile
// while the site showed Circle's real blue mark, from a local file the card builder never looked at.
//
// Every curated asset has a local logo in this repo: assets/tokens/curated/CODE-ISSUER.png (52 of
// them, written by _bridgelogos.js) or a named file via NAMED_LOGOS. So the candidates are measured
// and the BEST one wins, rather than a fixed order -- "always local" would have downgraded AQUA from
// the toml's 176px to a 128px copy.
function localLogoFile(assetId) {
  const named = NAMED_LOGOS[assetId];
  if (named) {
    const p = path.join(__dirname, '..', named.replace(/^\//, ''));
    if (fs.existsSync(p)) return p;
  }
  for (const dir of [path.join(TOKENS, 'curated'), TOKENS]) {
    for (const ext of ['svg', 'png', 'jpg', 'jpeg', 'webp']) {
      const p = path.join(dir, assetId + '.' + ext);
      if (fs.existsSync(p)) return p;
    }
  }
  return '';
}

// How big a candidate renders. Vector is unbeatable, so it scores above any raster; a file that will
// not decode scores zero and simply loses.
async function logoScore(buf) {
  try {
    const m = await require('sharp')(buf).metadata();
    if (m.format === 'svg') return 1e6;
    return Math.min(m.width || 0, m.height || 0);
  } catch (e) { return 0; }
}

// The logo is resolved exactly as the rest of the site resolves it -- admin override first, then the
// issuer's toml -- via /lxapi/assetlogo. Every format goes through the kit, which rasterises what
// resvg cannot read and tiles what would be invisible.
// Returns the issuer-side logo BYTES, and whether the answer was definitive.
//
// `definitive` separates the two things an empty result has always meant. "The endpoint answered, and
// says this asset publishes no logo" is a fact; "the request failed" is not knowing. They were the
// same empty string, so the caller's keep-the-old-card guard treated both as a blip -- which is how
// EURC, whose toml 404s for good, kept a card nobody could redraw.
async function remoteLogo(assetId) {
  try {
    const r = await fetch(ORIGIN + '/lxapi/assetlogo?asset=' + encodeURIComponent(assetId));
    if (!r.ok) return { buf: null, definitive: false };
    const d = await r.json();
    const u = d && d.image;
    if (!u) return { buf: null, definitive: true };        // answered, and the answer is "none"
    if (u.indexOf('data:') === 0) {
      const m = /^data:([^;]+);base64,(.*)$/i.exec(u);
      if (m) return { buf: Buffer.from(m[2], 'base64'), definitive: true };
      const sv = /^data:image\/svg\+xml[^,]*,(.*)$/i.exec(u);
      return sv
        ? { buf: Buffer.from(decodeURIComponent(sv[1]), 'utf8'), definitive: true }
        : { buf: null, definitive: true };
    }
    const rr = await fetch(u.indexOf('/') === 0 ? ORIGIN + u : u, { headers: { accept: 'image/*' } });
    if (!rr.ok) return { buf: null, definitive: false };    // the host, not the answer, failed
    const b = Buffer.from(await rr.arrayBuffer());
    return { buf: b.length ? b : null, definitive: b.length > 0 };
  } catch (e) {
    return { buf: null, definitive: false };
  }
}

// The best logo available for this asset, from the issuer's and our own copies.
async function bestLogo(assetId) {
  const { buf: rbuf, definitive } = await remoteLogo(assetId);
  const lf = localLogoFile(assetId);
  let lbuf = null;
  try { if (lf) lbuf = fs.readFileSync(lf); } catch (e) { lbuf = null; }

  const rs = rbuf ? await logoScore(rbuf) : 0;
  const ls = lbuf ? await logoScore(lbuf) : 0;
  const win = ls > rs ? lbuf : (rbuf || lbuf);
  if (!win) return { uri: '', definitive, local: false };
  try {
    return { uri: await K.toPng(win), definitive: true, local: win === lbuf };
  } catch (e) {
    return { uri: '', definitive, local: false };
  }
}

(async () => {
  const emitted = K.emitBrowser();
  if (emitted.length) console.log('  browser kit -> ' + emitted.join(' '));
  if (!K.hasFont()) {
    console.error('og cards: missing ' + K.FONT + ' — nothing written');
    process.exit(1);
  }
  const limitArg = process.argv.indexOf('--limit');
  const LIMIT = limitArg > 0 ? parseInt(process.argv[limitArg + 1], 10) : 0;
  const chainArg = process.argv.indexOf('--chain');
  const CH = chainArg > 0 && K.CHAIN[process.argv[chainArg + 1]] ? process.argv[chainArg + 1] : 'Stellar';

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

  const done = [], kept = [];
  let withLogo = 0, withDomain = 0, fromLocal = 0;
  for (const id of ids) {
    const code = id.slice(0, id.lastIndexOf('-'));
    const v = verified[id] || {};
    const domain = String(v.d || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (domain) withDomain++;
    const { uri: logo, definitive, local } = await bestLogo(id);
    if (logo) withLogo++;
    if (local) fromLocal++;

    // A LOGO HOST BLIPPING MUST NOT DOWNGRADE A GOOD CARD. These logos live on the issuers' own
    // domains, so any run can lose one to a timeout: XLMG lost its mark that way and was silently
    // redrawn as a two-letter monogram while the build reported success. When the logo cannot be
    // fetched and a card already exists, the existing file is kept and the asset is named instead.
    const out = path.join(OUT_DIR, id + '.png');
    // ONLY ON A BLIP, NOT ON A KNOWN ABSENCE. `definitive` means the endpoint answered and said this
    // asset has no logo -- redraw it as a monogram, which is what the asset actually looks like now.
    // Keeping the old file in that case preserved a render nobody could reproduce: EURC showed a gold
    // "EU" tile on its card while every page on the site showed Circle's blue mark.
    if (!logo && !definitive && fs.existsSync(out)) { kept.push(code); done.push(id); continue; }

    try {
      const png = K.render(K.assetCard({
        code, logo, chain: CH, domain,
        issuer: id.slice(id.lastIndexOf('-') + 1),
        badge: v.v ? 'Curated asset' : 'Listed asset',
      }));
      fs.writeFileSync(out, png);
      done.push(id);
    } catch (e) {
      console.error('  ' + id + ': ' + e.message);
    }
  }

  fs.writeFileSync(LIST_FILE, JSON.stringify(done, null, 0), 'utf8');
  console.log('og cards: wrote ' + done.length + ' card(s) of ' + ids.length
    + ' (' + withLogo + ' with a real logo, ' + fromLocal + ' of them from our own copy, ' + withDomain + ' with a domain) -> dist/assets/og/'
    + (kept.length ? '\n  kept ' + kept.length + ' existing card(s) whose logo host was unreachable: ' + kept.join(' ') : ''));
})();
