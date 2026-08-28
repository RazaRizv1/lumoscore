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

  // The roster Trade already lists by hand, read from the source rather than assumed. Parsed from the
  // literal ABOVE the .concat, so a previous run's own output is never mistaken for a hand entry.
  const rosterHand = new Set();
  {
    const dex = fs.readFileSync(path.join(__dirname, '_dexdata.js'), 'utf8');
    const a = dex.indexOf('var ASSETS=[');
    const b = dex.indexOf('].concat(', a);
    const body = a >= 0 ? dex.slice(a, b > a ? b : undefined) : '';
    const re = /\{code:"([^"]+)",\s*issuer:"([^"]+)"/g;
    let m; while ((m = re.exec(body))) rosterHand.add(m[1] + '|' + m[2]);
  }

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
    // A granted tick counts here too, or the override would work in the panel and nowhere else.
    // Curated means ticked, so every kind of tick carries through to the build. Only a record
    // that says NOT verified is skipped, which now happens solely for the launchpad mints.
    if (!rec.v) { skipped.push(code + ' (' + live.reason + ')'); continue; }

    verified[key] = live.domain || rec.d || '';

    // TICKED AND LISTED ARE NOT THE SAME LIST, which is the mistake that started this. ARST was in
    // _dexdata's hand-written roster -- listed on Trade for ages -- but absent from VERIFIED, so it
    // wore no tick and never appeared in the admin panel, whose curated list was seeded from VERIFIED.
    // It needs the tick and must NOT be added to the roster a second time.
    if (rosterHand.has(key)) continue;

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
  // REBUILD HERE, AUTOMATICALLY. Every one of these transforms bakes its OWN copy of VERIFIED into the
  // pages it writes -- that is the point of lib.js being a single list -- so changing the list and
  // re-running only one of them leaves the asset ticked on that page and bare everywhere else. That is
  // precisely what happened: xLMNR showed a tick on Trade main and had none on Trade-Asset, in search,
  // in the wallet or on the account page. Left as a step to remember, it goes wrong again next time.
  if (process.argv.indexOf('--no-build') >= 0) {
    console.log('\n--no-build: run the VERIFIED transforms yourself, then _heromono.js LAST, then npm run build.');
    return;
  }
  // SOME OF THESE ARE DRY RUNS WITHOUT --write, and say so only on stdout. Run without it,
  // _accountpage and _mobdex change nothing, exit 0, and look exactly like success -- which is how the
  // account page kept an old verified map while every other page had the new one. The flag is passed
  // to all of them: the ones that do not take it ignore it.
  const CONSUMERS = ['_accountpage', '_dashboxes', '_dexassetdata', '_dexdata', '_lumostoken',
                     '_mobdex', '_searchassets', '_trending', '_walletdata'];
  const run = (file, args) => execFileSync('node', [path.join(__dirname, file)].concat(args || []),
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

  console.log('\nrebuilding every page that bakes the verified list:');
  for (const t of CONSUMERS) {
    process.stdout.write('  ' + t + ' ... ');
    let out;
    try { out = run(t + '.js', ['--write']); }
    catch (e) { console.log('FAILED'); console.error(String(e.stderr || e).slice(0, 500)); process.exit(1); }
    // A transform that reports a dry run has done nothing. Treating that as success is the whole bug.
    if (/dry run/i.test(out || '')) {
      console.log('DRY RUN — nothing written');
      console.error('    ' + String(out).trim().split('\n').pop());
      process.exit(1);
    }
    console.log('ok');
  }
  // _heromono.js LAST, always. It carries the shared hero look and only beats the per-page hero CSS by
  // sitting after it; _dexdata above moves it out of place every time. predeploy_check catches this,
  // but catching it is not the same as not doing it.
  process.stdout.write('  _heromono (must be last) ... ');
  try { run('_heromono.js'); console.log('ok'); }
  catch (e) { console.log('FAILED'); console.error(String(e.stderr || e).slice(0, 500)); process.exit(1); }

  process.stdout.write('  extract_site ... ');
  try { run('extract_site.js', ['aptos', '--root']); console.log('ok'); }
  catch (e) { console.log('FAILED'); console.error(String(e.stderr || e).slice(0, 500)); process.exit(1); }

  console.log('\nBuilt. Now: node _tools/predeploy_check.js  &&  npm run deploy:staging');
})();
