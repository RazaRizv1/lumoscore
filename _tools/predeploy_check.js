// Runs automatically before `npm run deploy` (npm's pre<script> hook). Refuses to publish a build
// that would leak something. Each check exists because it is a mistake that is easy to make once and
// impossible to take back — a deployed file is cached, indexed, and scraped within minutes.
//
//   node _tools/predeploy_check.js           checks dist/       (the PUBLIC site)
//   node _tools/predeploy_check.js --admin   checks dist-admin/ (the ADMIN site)
const fs = require('fs');
const path = require('path');

const ADMIN = process.argv.includes('--admin');
const DIR = path.join(__dirname, '..', ADMIN ? 'dist-admin' : 'dist');
const LABEL = ADMIN ? 'ADMIN' : 'PUBLIC';

const fail = [], warn = [];

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

if (!fs.existsSync(DIR)) {
  console.error(`\n  ${LABEL} build missing: ${DIR}`);
  console.error(`  Run:  npm run ${ADMIN ? 'build:admin' : 'build'}\n`);
  process.exit(1);
}

const files = walk(DIR);
const rel = f => path.relative(DIR, f).replace(/\\/g, '/');
const html = files.filter(f => f.endsWith('.html'));

// THE PAGE AS THE BROWSER WILL SEE IT. _externalize.js moves every end-of-body script into /assets/js/lx-<hash>.js so it
// can be cached between navigations — which means half the things this file checks for (a data layer's fetch call, a
// marker string, a wired endpoint) are no longer IN the HTML it scans. Read naively, every one of those checks would
// start passing by finding nothing, which is the most dangerous way for a gate to fail: silently, and in the safe
// direction. It showed up immediately — four blog pages reported as empty shells the moment externalisation ran.
//
// So a page is read with the scripts it references folded back in, and every existing check goes on working exactly as
// written, against the code that will actually run on that page.
const _pageCache = new Map();
function readPage(f) {
  if (_pageCache.has(f)) return _pageCache.get(f);
  let s = fs.readFileSync(f, 'utf8');
  s = s.replace(/<script\b[^>]*\bsrc="\/assets\/js\/(lx-[0-9a-f]{12}\.js)"[^>]*><\/script>/g, (m, name) => {
    try { return '<script>' + fs.readFileSync(path.join(DIR, 'assets', 'js', name), 'utf8') + '</' + 'script>'; }
    catch (e) { return m; }
  });
  _pageCache.set(f, s);
  return s;
}

// ---- 1. the admin panel must never be in the public build ---------------------------------------
if (!ADMIN) {
  const leaked = files.filter(f => /(^|\/)lumoscore-admin-/.test(rel(f)));
  if (leaked.length) {
    fail.push(`${leaked.length} admin page(s) present in the public build: ${leaked.slice(0, 3).map(rel).join(', ')}${leaked.length > 3 ? ' …' : ''}`
      + `\n      Fix: npm run build   (it excludes and purges them)`);
  }
  const linking = html.filter(f => /lumoscore-admin-/.test(readPage(f)));
  if (linking.length) {
    fail.push(`${linking.length} public page(s) reference an admin URL: ${linking.slice(0, 3).map(rel).join(', ')}`
      + `\n      Even a dead link advertises the panel's location.`);
  }
}

// ---- 2. no secrets in anything served to a browser ------------------------------------------------
// A static host sends these files verbatim. Anything secret in them is public the moment it deploys,
// and stays public in caches and scrapes after you delete it.
const SECRETS = [
  [/\bsk_[A-Za-z0-9]{24,}\b/g, 'secret API key (sk_…)'],
  [/\bS[A-Z2-7]{55}\b/g, 'STELLAR SECRET SEED (S…) — would let anyone drain the account'],
  [/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, 'AWS access key id'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b/g, 'GitHub token'],
];
const found = new Map();
for (const f of files.filter(f => /\.(html|js|css|json|txt|map)$/i.test(f))) {
  const body = readPage(f);
  for (const [re, what] of SECRETS) {
    for (const m of body.match(re) || []) {
      const k = what + ' :: ' + m.slice(0, 12) + '…';
      if (!found.has(k)) found.set(k, new Set());
      found.get(k).add(rel(f));
    }
  }
}
for (const [what, inFiles] of found) {
  fail.push(`${what} appears in ${inFiles.size} file(s), e.g. ${[...inFiles].slice(0, 2).join(', ')}`
    + `\n      Rotate it, then serve it from a Pages Function using a Cloudflare secret so it never reaches the browser.`);
}

// ---- 3. Cloudflare Pages hard limits ---------------------------------------------------------------
const TOO_BIG = files.filter(f => fs.statSync(f).size > 25 * 1024 * 1024);
if (TOO_BIG.length) fail.push(`${TOO_BIG.length} file(s) exceed Cloudflare's 25 MiB per-file limit: ${TOO_BIG.map(rel).join(', ')}`);
if (files.length > 20000) fail.push(`${files.length} files exceeds Cloudflare's 20,000 file limit.`);

// ---- 4. sanity ---------------------------------------------------------------------------------------
if (!fs.existsSync(path.join(DIR, 'index.html'))) fail.push('no index.html — the site would have no entry point.');
if (!fs.existsSync(path.join(DIR, '_headers'))) warn.push('_headers missing — security headers will not be applied.');
if (ADMIN && !/noindex/.test(fs.readFileSync(path.join(DIR, '_headers'), 'utf8').toString())) {
  warn.push('admin _headers has no noindex rule.');
}
if (ADMIN) {
  const pages = files.filter(f => f.endsWith('.html') && rel(f) !== 'index.html');
  const strays = pages.filter(f => !/^lumoscore-admin-/.test(rel(f)));
  if (strays.length) warn.push(`${strays.length} non-admin page(s) in the admin build: ${strays.slice(0, 3).map(rel).join(', ')}`);
}

// ---- did a page suddenly lose a chunk? ------------------------------------------------------------------
// Twice now a strip regex written to remove one injected block has instead run forward to the next place
// its closing sequence happened to occur and deleted everything in between -- 238KB the first time, 37KB
// the second. Both were invisible until a section was noticed missing. dist is tracked, so the previous
// build is right there to compare against. A WARNING, not a failure: sections do get removed on purpose.
if (!ADMIN) {
  const { execSync } = require('child_process');
  for (const f of files.filter(f => /\.html$/.test(rel(f)))) {
    let prev;
    try { prev = execSync('git show HEAD:dist/' + rel(f), { maxBuffer: 1 << 28, stdio: ['pipe', 'pipe', 'ignore'] }).length; }
    catch (e) { continue; }                     // new file, nothing to compare
    const now = fs.statSync(f).size;
    const drop = prev - now;
    // Absolute, not a percentage: these pages are ~1MB, so the desktop half of the second incident
    // (3.8KB, four whole cards) was only 0.34% and a percentage gate slept straight through it.
    if (drop >= 2048) {
      warn.push(`${rel(f)} shrank ${(drop / 1024).toFixed(1)}KB (${(drop / prev * 100).toFixed(2)}%) vs HEAD `
        + `— intended, or did a strip regex overrun?`);
    }
  }
}

// ---- injected scripts must actually parse ---------------------------------------------------------------
// Every lx-* script is assembled by string concatenation in _tools/, so a stray character produces a
// page that looks fine and silently does nothing -- the tag is in the DOM, the browser throws
// "Unexpected end of input" into a console nobody is watching, and the section falls back to whatever
// the design mocked. Caught here by parsing each one instead.
{
  const vm = require('vm');
  const seen = new Set();
  for (const f of files.filter(f => f.endsWith('.html'))) {
    const s = readPage(f);
    const re = /<script id="(lx-[a-z0-9-]+)">([\s\S]*?)<\/script>/g;
    let m;
    while ((m = re.exec(s))) {
      const key = rel(f) + '#' + m[1];
      if (seen.has(key)) continue;
      seen.add(key);
      try { new vm.Script(m[2], { filename: key }); }
      catch (err) { fail.push(`${rel(f)}: <script id="${m[1]}"> does not parse — ${String(err.message).slice(0, 120)}`); }
    }
  }

  // AND THE ONES THAT NOW LIVE IN FILES. _externalize.js moves every end-of-body block to /assets/js/lx-<hash>.js so it
  // can be cached across pages, and the regex above only ever matched an INLINE body — so without this the gate would go
  // on passing while parsing nothing at all on the very scripts it exists to protect. Parsed from disk instead, once
  // each: the filenames are content hashes, so one pass covers every page that references them.
  const jsdir = require('path').join(__dirname, '..', 'dist', 'assets', 'js');
  let ext = 0;
  if (fs.existsSync(jsdir)) {
    for (const jf of fs.readdirSync(jsdir)) {
      if (!/^lx-[0-9a-f]{12}\.js$/.test(jf)) continue;
      ext++;
      const src = fs.readFileSync(require('path').join(jsdir, jf), 'utf8');
      try { new vm.Script(src, { filename: 'assets/js/' + jf }); }
      catch (err) { fail.push(`assets/js/${jf} does not parse — ${String(err.message).slice(0, 120)}`); }
    }
  }
  if (ext) console.log('  parsed ' + ext + ' externalised script file(s)');
}

// ---- hero style order ----------------------------------------------------------------------------------
// _heromono.js holds the shared monochrome look for both heroes and beats the per-page hero CSS on
// document order, not specificity. Every one of these tools re-appends its block at the end of <head>,
// so running _dexdata.js or _poolshero.js AFTER _heromono.js silently puts the orange ground back --
// which is exactly what shipped once. The build is only correct when lx-heromono-css is last.
if (!ADMIN) {
  for (const f of files.filter(f => /lumoscore-(dex|amm)(-dark|-mobile)?\.html$/.test(rel(f)))) {
    const s = readPage(f);
    const mono = s.indexOf('<style id="lx-heromono-css"');
    if (mono < 0) continue;
    const after = ['lx-dexmain-css', 'lx-poolshero-css']
      .filter(id => { const at = s.indexOf('<style id="' + id + '"'); return at >= 0 && at > mono; });
    if (after.length) fail.push(`${rel(f)}: ${after.join(' and ')} sits AFTER lx-heromono-css — the hero will `
      + `paint in its per-page colour, not the monochrome one. Re-run _tools/_heromono.js last and rebuild.`);
  }
}

// ---- outgoing links keep their nofollow ----------------------------------------------------------------
// _nofollow.js folds rel="nofollow" into every external <a> in the container, and it has to run AFTER the
// transforms that inject those anchors. Re-running any of them (_ammdata, _dexassetdata, _accountpage...)
// re-emits its script block WITHOUT the mark, so the static HTML silently loses it again -- the same
// build-order trap as the hero styles. The runtime guard would still stamp the DOM, but a crawler reading
// the raw HTML would see followed links, which is the whole point of the change. Re-run _nofollow.js.
if (!ADMIN) {
  const OURS = (h) => h === 'lumoscore.com' || h.endsWith('.lumoscore.com');
  for (const f of files) {
    const s = readPage(f);
    let n = 0, sample = '';
    for (const tag of (s.match(/<a\b[^>]*>/gi) || [])) {
      const h = /href=("|')(https?:\/\/[^"']*)\1/i.exec(tag);
      if (!h) continue;
      const host = h[2].replace(/^https?:\/\//i, '').split(/[/?#]/)[0].toLowerCase().replace(/:\d+$/, '');
      if (OURS(host)) continue;
      if (/\bnofollow\b/.test(tag)) continue;
      if (!n) sample = host;
      n++;
    }
    if (n) fail.push(`${rel(f)}: ${n} outgoing <a> tag(s) without rel="nofollow" (e.g. ${sample}) — `
      + `a transform re-ran after _nofollow.js. Re-run node _tools/_nofollow.js and rebuild.`);
  }
}

// ---- the blog pages must still know how to load posts ----------------------------------------------
// _blogdata.js injects the layer that fetches /lxapi/blog and renders the cards; _blogpage.js rebuilds
// those pages from a donor and REMOVES it. So _blogdata.js must run after _blogpage.js, and when it
// does not the pages ship as empty shells that still answer 200 -- which is why this went unnoticed
// until someone opened the page. Presence of the fetch is the cheapest possible proof the layer
// survived the build.
if (!ADMIN) {
  for (const f of files) {
    const name = rel(f);
    if (!/lumoscore-blog(-post)?(-mobile)?\.html$/.test(name)) continue;
    const s = readPage(f);
    if (s.indexOf('/lxapi/blog') < 0) {
      fail.push(name + ': the blog data layer is missing (no /lxapi/blog call) — this page would ship '
        + 'as an empty shell that still returns 200. _blogpage.js re-ran after _blogdata.js. '
        + 'Re-run node _tools/_blogdata.js and rebuild.');
    }
  }
}

// ---- the LayerZero route must not reach production by accident ----------------------------------------
// dist/ is COMMITTED and a push to main serves it directly (the source containers are gitignored, so
// Cloudflare cannot rebuild). So a staging build made with LZ_LIVE=1 sitting in the working tree would ship
// the enabled route to production the next time anyone commits dist -- enabling a real-money path that has
// never round-tripped a signature, with nobody having decided to.
//
// The build is therefore asked what it actually contains, rather than trusting whoever ran it: if dist says
// LZ_SENDABLE=true, this only passes when LZ_LIVE=1 is set for THIS run too. Deploying staging with the route
// on is `LZ_LIVE=1 npm run predeploy && LZ_LIVE=1 npm run deploy:staging`; anything else blocks.
{
  const jsDir = path.join(DIR, "assets", "js");
  let enabled = false;
  try {
    for (const f of fs.readdirSync(jsDir)) {
      if (!f.endsWith('.js')) continue;
      if (fs.readFileSync(path.join(jsDir, f), 'utf8').includes('var LZ_SENDABLE=true')) { enabled = true; break; }
    }
  } catch (_) { /* no externalised js in this build */ }
  // Inverted 2026-09-19 when the routes went live on production: a live build is now the normal one, and what must
  // not ship by accident is a WITHDRAWN build mislabelled as normal -- so a live dist fails only when LZ_LIVE=0 says
  // this run is meant to be the withdrawn one.
  if (enabled && process.env.LZ_LIVE === '0') {
    fail.push('dist was built with the LayerZero route ENABLED (LZ_SENDABLE=true) but LZ_LIVE=1 is not set for this run.\n'
      + '      That build is for staging only. Rebuild without LZ_LIVE before committing dist or pushing to main:\n'
      + '        node _tools/_cctp.js && node _tools/_faq.js && node _tools/_seo.js && node _tools/_lzusdt0.js && npm run build');
  }
}

// ---- report -------------------------------------------------------------------------------------------
const size = (files.reduce((s, f) => s + fs.statSync(f).size, 0) / 1048576).toFixed(1);
console.log(`\n  Pre-deploy check — ${LABEL} build (${files.length} files, ${size} MB)\n`);
for (const w of warn) console.log(`  ! ${w}`);
if (!fail.length) {
  console.log(`  PASS — safe to deploy.\n`);
  process.exit(0);
}
console.log(`\n  BLOCKED — ${fail.length} problem(s):\n`);
fail.forEach((f, i) => console.log(`  ${i + 1}. ${f}\n`));
if (process.env.LUMOS_ALLOW_SECRETS === '1' && !fail.some(f => /admin page|reference an admin URL|exceeds|no index/.test(f))) {
  console.log('  LUMOS_ALLOW_SECRETS=1 set — overriding. You are publishing the value(s) above.\n');
  process.exit(0);
}
console.log('  Nothing was deployed. Fix the above and re-run.\n');
process.exit(1);
