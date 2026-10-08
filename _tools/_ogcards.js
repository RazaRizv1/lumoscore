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

// The logo is resolved exactly as the rest of the site resolves it -- admin override first, then the
// issuer's toml -- via /lxapi/assetlogo. Every format goes through the kit, which rasterises what
// resvg cannot read and tiles what would be invisible.
async function logoDataUri(assetId) {
  try {
    const r = await fetch(ORIGIN + '/lxapi/assetlogo?asset=' + encodeURIComponent(assetId));
    if (!r.ok) return '';
    const d = await r.json();
    let u = d && d.image;
    if (!u) return '';
    if (u.indexOf('data:') === 0) {
      const m = /^data:([^;]+);base64,(.*)$/i.exec(u);
      if (m) return await K.toPng(Buffer.from(m[2], 'base64'));
      const sv = /^data:image\/svg\+xml[^,]*,(.*)$/i.exec(u);
      return sv ? await K.toPng(Buffer.from(decodeURIComponent(sv[1]), 'utf8')) : '';
    }
    return await K.imageDataUri(u.indexOf('/') === 0 ? ORIGIN + u : u);
  } catch (e) { return ''; }
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
  let withLogo = 0, withDomain = 0;
  for (const id of ids) {
    const code = id.slice(0, id.lastIndexOf('-'));
    const v = verified[id] || {};
    const domain = String(v.d || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (domain) withDomain++;
    const logo = await logoDataUri(id);
    if (logo) withLogo++;

    // A LOGO HOST BLIPPING MUST NOT DOWNGRADE A GOOD CARD. These logos live on the issuers' own
    // domains, so any run can lose one to a timeout: XLMG lost its mark that way and was silently
    // redrawn as a two-letter monogram while the build reported success. When the logo cannot be
    // fetched and a card already exists, the existing file is kept and the asset is named instead.
    const out = path.join(OUT_DIR, id + '.png');
    if (!logo && fs.existsSync(out)) { kept.push(code); done.push(id); continue; }

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
    + ' (' + withLogo + ' with a real logo, ' + withDomain + ' with a domain) -> dist/assets/og/'
    + (kept.length ? '\n  kept ' + kept.length + ' existing card(s) whose logo host was unreachable: ' + kept.join(' ') : ''));
})();
