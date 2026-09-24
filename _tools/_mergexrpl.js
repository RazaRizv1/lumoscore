// Fold the XRPL build into the Stellar deployment, so one domain serves both chains.
//
// WHY A SEPARATE PASS rather than one build: the two chains are separate repos with separate design
// containers and separate transform chains, and they emit the SAME 97 filenames (lumoscore-dex.html and
// so on) differing only in which chain's data is baked in. Merging the builds themselves would mean
// merging two transform chains; merging their OUTPUT is a copy with three collisions to resolve.
//
// WHAT MAKES THIS SAFE, all measured rather than assumed (2026-09-24):
//   * XRPL pages reference assets ABSOLUTELY -- 0 relative "assets/..." refs across all 97 pages -- so
//     they work unchanged from a subdirectory. That is why the pages can go to dist/x/ with no renaming.
//   * 76 assets are byte-identical in both builds and 3 differ. Of those 3, launchpad-icons.json is not
//     referenced by any XRPL page, so only the two trade-hero SVGs need their own copies.
//   * Every XRPL-only Function is xrpl*-prefixed (plus _tokenid.js) and NOTHING that exists in both
//     differs, so the API side merges with no collisions at all.
//   * Combined the site is ~811 files, against Cloudflare Pages' 20,000 limit, and the largest XRPL page
//     is 1.3 MB against its 25 MB per-file limit.
//
// ORDER: run this AFTER `npm run build`, which regenerates dist/ and dist/_redirects from scratch. This
// pass only ever ADDS to that output, and re-running it is safe -- dist/x is rebuilt and the route block
// is replaced between its markers rather than appended again.
//
// XRPL pages keep their inline script: the XRPL build does not run _externalize.js, so each page carries
// ~1.3 MB of it. That is a load-time cost, not a correctness one -- see lumoscore-page-weight.
const fs = require('fs');
const path = require('path');

const SRC = 'C:/LumosCore-XRPL/dist';
const DST = 'C:/LumosCore/dist';
const FN_SRC = 'C:/LumosCore-XRPL/functions/lxapi';
const FN_DST = 'C:/LumosCore/functions/lxapi';
const SUB = 'x';                       // XRPL pages live at dist/x/, served as /x/lumoscore-*

// The only two assets that differ AND are used by an XRPL page. Their XRPL versions are copied under a
// prefixed name and the copied pages are repointed, so neither chain's art can overwrite the other's.
const CLASH = ['assets/hero/trade-hero-dark.svg', 'assets/hero/trade-hero-light.svg'];
const clashName = (p) => p.replace(/([^/]+)$/, 'xrpl-$1');

// Chain-scoped routes only. XRPL's own _redirects also claims /dashboard, /bridge, /wallet, /rewards,
// /mcp and /launchpad -- the chain-neutral paths, which in a merged site belong to Stellar. Taking them
// would silently hand the whole app to XRPL.
const ROUTES = [
  ['/trade/xrpl/:asset', 'lumoscore-dex-asset'],
  ['/trade/xrpl', 'lumoscore-dex'],
  ['/pools/xrpl/id/:pool', 'lumoscore-amm-pool'],
  ['/pools/xrpl/:a/:b', 'lumoscore-amm-pool'],
  ['/pools/xrpl', 'lumoscore-amm'],
  ['/account/xrpl/:address', 'lumoscore-account'],
  ['/bridge/xrpl', 'lumoscore-bridge'],
  ['/rewards/xrpl', 'lumoscore-rewards-dark'],
  ['/lumos/xrpl', 'lumoscore-lumos-token'],
];
const MARK_A = '# ---- XRPL (merged by _mergexrpl.js) ----';
const MARK_B = '# ---- end XRPL ----';

function die(m) { console.error('  ! ' + m); process.exit(1); }
function rmrf(p) { if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }); }
function cp(a, b) { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.copyFileSync(a, b); }

if (!fs.existsSync(SRC)) die('no XRPL build at ' + SRC + ' — build it there first');
if (!fs.existsSync(DST + '/_redirects')) die('no Stellar build at ' + DST + ' — run `npm run build` first');

// ---- 1. the pages ------------------------------------------------------------------------------------
const pagesDir = path.join(DST, SUB);
rmrf(pagesDir);                                    // rebuilt every run, so a deleted XRPL page cannot linger
fs.mkdirSync(pagesDir, { recursive: true });
const pages = fs.readdirSync(SRC).filter((f) => /\.html$/.test(f));
if (!pages.length) die('the XRPL dist has no pages');
let repointed = 0;
for (const f of pages) {
  let h = fs.readFileSync(path.join(SRC, f), 'utf8');
  for (const c of CLASH) {
    const from = '/' + c, to = '/' + clashName(c);
    if (h.indexOf(from) >= 0) { h = h.split(from).join(to); repointed++; }
  }
  fs.writeFileSync(path.join(pagesDir, f), h, 'utf8');
}

// ---- 2. assets ---------------------------------------------------------------------------------------
// Everything XRPL has that Stellar does not, plus the clashing pair under their prefixed names. Files
// that already exist and are identical are left alone; a differing file is never overwritten.
let added = 0, clashed = 0, skipped = 0;
(function walk(rel) {
  const dir = path.join(SRC, rel);
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) { walk(r); continue; }
    const a = path.join(SRC, r), b = path.join(DST, r);
    if (CLASH.indexOf(r) >= 0) { cp(a, path.join(DST, clashName(r))); clashed++; continue; }
    if (!fs.existsSync(b)) { cp(a, b); added++; continue; }
    skipped++;
  }
})('assets');

// ---- 3. the API --------------------------------------------------------------------------------------
let fns = 0;
if (fs.existsSync(FN_SRC)) {
  for (const f of fs.readdirSync(FN_SRC)) {
    if (!/\.js$/.test(f)) continue;
    const a = path.join(FN_SRC, f), b = path.join(FN_DST, f);
    // XRPL OWNS ITS OWN ENDPOINTS, so xrpl*/_tokenid are copied EVERY run, overwriting what is here.
    // Skipping existing files made this pass one-way-once: a fix made in the XRPL repo (the source of
    // truth for these) would never reach the deployed copy, and the two would drift silently.
    // Everything else is left alone -- overwriting a SHARED endpoint with the other chain's copy is the
    // one mistake here that could break the live site rather than just a page.
    const owned = /^(xrpl|_tokenid)/.test(f);
    if (!owned && fs.existsSync(b)) continue;
    cp(a, b); fns++;
  }
}

// ---- 4. routes ---------------------------------------------------------------------------------------
// Written between markers and rewritten in place, so this is idempotent. NOT added to extract_site's
// ROUTES table on purpose: that table also builds the clean-URL map, which is keyed by filename -- and
// both chains use the same filenames, so merging them there would make lumoscore-dex mean two different
// URLs. Each page set already carries its own clean-URL map from its own build, which is what keeps
// navigation inside one chain.
let red = fs.readFileSync(DST + '/_redirects', 'utf8');
const a0 = red.indexOf(MARK_A);
if (a0 >= 0) {
  const b0 = red.indexOf(MARK_B, a0);
  red = red.slice(0, a0) + red.slice(b0 < 0 ? a0 : b0 + MARK_B.length);
}
const block = [MARK_A]
  .concat(ROUTES.map(([u, f]) => u.padEnd(42) + '/' + SUB + '/' + f + '  200'))
  .concat([MARK_B, '']).join('\n');
// PREPENDED, not appended: _redirects is first-match-wins, and Stellar's own /trade/:splat-style rules
// would otherwise swallow /trade/xrpl before these are reached.
fs.writeFileSync(DST + '/_redirects', block + '\n' + red.replace(/^\n+/, ''), 'utf8');

console.log('merge xrpl: ' + pages.length + ' page(s) -> dist/' + SUB + '/'
  + ' | assets +' + added + ' (' + clashed + ' de-clashed, ' + skipped + ' already shared)'
  + ' | functions +' + fns + ' | ' + ROUTES.length + ' route(s)');
