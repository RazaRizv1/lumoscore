// Pull the curated asset list out of KV and into the build, so an asset added in the admin panel
// actually reaches Trade main.
//
// WHY THIS EXISTS AT ALL. The admin panel writes to KV; the public site is built from lib.js. Nothing
// connected them, so adding an asset in the panel listed it in the panel and nowhere else -- which is
// exactly how it looked to whoever added one and then went looking for it on Trade.
//
// WHY BUILD TIME rather than a fetch on the visitor path. Trade main takes real care to avoid runtime
// work: its roster and its tick map are baked into the page precisely so nothing paints twice. Adding a
// request there to learn what to list would put a flash on the busiest page of the site to save a
// deploy on a rare action. So this runs when a human runs it, and the result is committed.
//
// Two OUTPUTS, because they are two different claims:
//   verified  CODE|ISSUER -> domain, which decides whether an asset wears a tick
//   assets    the roster Trade main lists
// An asset can be listed without being ticked. Conflating them would mean listing something as a side
// effect of trusting it.
//
// MINTS ARE NEVER INCLUDED. lib.js explains at length why the launchpad's own tokens were taken out of
// VERIFIED: beside a token called LIBERATOR a green check reads as "this one is safe", which is not a
// claim we can make about a memecoin we merely provided the button for. Only the curated list is read.
//
// Usage: node _tools/_syncverified.js        (then rebuild and deploy the public site)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require("url");

const NS = '1a4424eb11bc46aeac9a41f17319a830';          // lumos-content
const OUT = path.join(__dirname, 'verified.generated.json');

function kv(key) {
  try {
    const out = execFileSync('npx', ['wrangler', 'kv', 'key', 'get', key, '--namespace-id', NS, '--remote'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], shell: true });
    return JSON.parse(out);
  } catch (e) { return null; }
}

// A stable colour per code, so a new asset does not arrive with a hole where every other row has a
// brand tint. Deterministic, so the same asset keeps the same colour between runs.
function colourFor(code) {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return 'hsl(' + hue + ',62%,46%)';
}

(async function main() {
  const { verifyAsset } = await import(pathToFileURL(path.join(__dirname, "..", "_lib", "stellartoml.js")).href);
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { verified: {}, assets: [] };
  // The hand list, without whatever a previous run of this script merged in -- otherwise every run
  // would treat its own output as hand-curated and never notice an entry had been removed upstream.
  const lib = require('./lib.js');
  const generatedKeys = new Set(Object.keys(prev.verified || {}));
  const hand = new Set(Object.keys(lib.VERIFIED).filter((k) => !generatedKeys.has(k)));

  const list = kv('assets:list');
  const vmap = kv('assets:verified') || {};
  if (!Array.isArray(list)) { console.error('could not read assets:list from KV — is wrangler logged in?'); process.exit(1); }

  const verified = {};
  const assets = [];
  const skipped = [];

  for (const id of list) {
    const i = id.lastIndexOf('-');
    const code = id.slice(0, i), issuer = id.slice(i + 1);
    const key = code + '|' + issuer;
    if (hand.has(key)) continue;                      // already in the reviewable list; leave it there

    const rec = vmap[id];
    if (!rec || !rec.v) { skipped.push(code + ' (not verified)'); continue; }

    // Re-run the handshake rather than trusting the stored stamp: this writes into the file that
    // decides who wears a tick on a live site, and the stamp could be months old.
    const live = await verifyAsset(code, issuer);
    if (!live.verified && rec.s !== 'grandfathered') { skipped.push(code + ' (' + live.reason + ')'); continue; }

    verified[key] = live.domain || rec.d || '';

    let logo = (live.toml && live.toml.image) || '';
    const meta = kv('asset:' + id);                   // an admin override beats the toml, as everywhere
    if (meta && meta.image) logo = meta.image;

    assets.push({ code, issuer, cat: 'utility', b: colourFor(code), logo });
  }

  fs.writeFileSync(OUT, JSON.stringify({ verified, assets }, null, 2) + '\n', 'utf8');
  console.log('curated in KV      : ' + list.length);
  console.log('already hand-listed: ' + list.filter((id) => { const i = id.lastIndexOf('-'); return hand.has(id.slice(0, i) + '|' + id.slice(i + 1)); }).length);
  console.log('written to lib     : ' + assets.length + (assets.length ? ('  -> ' + assets.map((a) => a.code).join(', ')) : ''));
  if (skipped.length) console.log('skipped            : ' + skipped.join('; '));
  console.log('\nNow rebuild and deploy the public site for these to appear on Trade.');
})();
