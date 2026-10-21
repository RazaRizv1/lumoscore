// ONE copy of the shared Cloudflare Functions, for every chain fork.
//
//   node C:/LumosCore/_tools/shared_functions.js <forkRoot>           copy Stellar's files into the fork
//   node C:/LumosCore/_tools/shared_functions.js <forkRoot> --check   change nothing, fail on any drift
//
// WHY THIS EXISTS. C:/LumosCore/functions/lxapi is what production serves — lumoscore.com deploys from
// this repo, and it already carries every xrpl*.js Function the XRPL fork uses. The forks (C:/LumosCore-XRPL,
// and C:/LumosCore-NEAR / C:/LumosCore-ARC to come) keep their OWN copies only so their standalone
// sites and local servers have something to run, and until 2026-10-21 those copies were kept in step
// BY HAND: edit here, then "lxapi: mirror the …" in the fork. combine_with_stellar.js refuses to deploy
// when a same-named file differs by one byte, so a missed mirror blocked a release. With two repos that
// was a chore; with four it would be most of the work. RAZA, 2026-10-21: make functions/ a single
// shared source before the Arc fork starts.
//
// THE FORK SAYS WHICH FILES ARE SHARED, in <forkRoot>/shared-functions.json — a plain array of lxapi
// filenames. A list rather than "every name both repos have", because a NEW fork-only Function that
// happens to share a name with one here is a collision, not an update: XRPL's axelar.js and oneclick.js
// were exactly that (different chains, same name) and taking Stellar's would have broken the XRPL
// bridge silently. So an unlisted same-named file that differs is refused, never overwritten.
//
// NEVER TOUCHED: the generated files (_middleware.js, _sitemap-routes.js — each build writes its own,
// see middleware-is-generated) and anything the fork does not list. This script reads C:/LumosCore and
// writes only inside <forkRoot>/functions/lxapi.
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'functions', 'lxapi');
const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const forkArg = args.find((a) => !a.startsWith('--'));

function die(m) { console.error('  shared_functions ABORT: ' + m); process.exit(1); }

if (!forkArg) die('usage: shared_functions.js <forkRoot> [--check]');
const FORK = path.resolve(forkArg);
const DST = path.join(FORK, 'functions', 'lxapi');
const LIST = path.join(FORK, 'shared-functions.json');
if (path.resolve(FORK) === path.resolve(__dirname, '..')) die('the fork root is the Stellar repo itself');
if (!fs.existsSync(DST)) die('no functions/lxapi in ' + FORK);
if (!fs.existsSync(LIST)) die('no shared-functions.json in ' + FORK);

let shared;
try { shared = JSON.parse(fs.readFileSync(LIST, 'utf8')); } catch (e) { die('shared-functions.json: ' + e.message); }
if (!Array.isArray(shared) || shared.some((f) => typeof f !== 'string' || !/^[\w.-]+\.js$/.test(f))) {
  die('shared-functions.json must be an array of lxapi .js filenames');
}
const sharedSet = new Set(shared);

// Every listed file must exist here — a typo would otherwise sync nothing and report success.
const missing = shared.filter((f) => !fs.existsSync(path.join(SRC, f)));
if (missing.length) die('listed but not in C:/LumosCore/functions/lxapi: ' + missing.join(', '));

// A shared file may only import siblings the fork will also have. Stellar's own Functions reach up into
// ../../_lib and ../mcp, which the forks do not carry; a shared file that starts doing that would build
// here and fail to build in the fork, so catch it now rather than at deploy.
for (const f of shared) {
  const src = fs.readFileSync(path.join(SRC, f), 'utf8');
  const re = /from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) {
    if (m[1][0] !== '.') continue;
    if (!m[1].startsWith('./') || m[1].slice(2).includes('/')) die(f + ' imports ' + m[1] + ', outside lxapi — the fork cannot build it');
    const dep = m[1].slice(2);
    if (!sharedSet.has(dep) && !fs.existsSync(path.join(DST, dep))) die(f + ' imports ./' + dep + ', which the fork neither shares nor has');
  }
}

// Same name, different bytes, NOT listed: someone has to decide. Not this script.
const clashes = fs.readdirSync(DST).filter((f) => !sharedSet.has(f) && fs.existsSync(path.join(SRC, f))
  && fs.readFileSync(path.join(SRC, f), 'utf8') !== fs.readFileSync(path.join(DST, f), 'utf8'));
if (clashes.length) die('same name, different bytes, not in shared-functions.json — rename the fork\'s or list it: ' + clashes.join(', '));

let same = 0;
const changed = [];
for (const f of shared) {
  const a = fs.readFileSync(path.join(SRC, f));
  const p = path.join(DST, f);
  if (fs.existsSync(p) && a.equals(fs.readFileSync(p))) { same++; continue; }
  changed.push(f);
  if (!CHECK) fs.writeFileSync(p, a);
}

const label = path.basename(FORK);
if (CHECK && changed.length) {
  die(label + ': ' + changed.length + ' shared Function(s) drifted from C:/LumosCore — run without --check to resync: ' + changed.join(', '));
}
console.log('  shared_functions ' + label + ': ' + shared.length + ' shared, ' + same + ' already identical, '
  + (CHECK ? '0 drifted' : changed.length + ' copied' + (changed.length ? ' (' + changed.join(', ') + ')' : '')));
