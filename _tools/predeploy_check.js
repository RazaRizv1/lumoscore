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

// ---- 1. the admin panel must never be in the public build ---------------------------------------
if (!ADMIN) {
  const leaked = files.filter(f => /(^|\/)lumoscore-admin-/.test(rel(f)));
  if (leaked.length) {
    fail.push(`${leaked.length} admin page(s) present in the public build: ${leaked.slice(0, 3).map(rel).join(', ')}${leaked.length > 3 ? ' …' : ''}`
      + `\n      Fix: npm run build   (it excludes and purges them)`);
  }
  const linking = html.filter(f => /lumoscore-admin-/.test(fs.readFileSync(f, 'utf8')));
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
  const body = fs.readFileSync(f, 'utf8');
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

// ---- hero style order ----------------------------------------------------------------------------------
// _heromono.js holds the shared monochrome look for both heroes and beats the per-page hero CSS on
// document order, not specificity. Every one of these tools re-appends its block at the end of <head>,
// so running _dexdata.js or _poolshero.js AFTER _heromono.js silently puts the orange ground back --
// which is exactly what shipped once. The build is only correct when lx-heromono-css is last.
if (!ADMIN) {
  for (const f of files.filter(f => /lumoscore-(dex|amm)(-dark|-mobile)?\.html$/.test(rel(f)))) {
    const s = fs.readFileSync(f, 'utf8');
    const mono = s.indexOf('<style id="lx-heromono-css"');
    if (mono < 0) continue;
    const after = ['lx-dexmain-css', 'lx-poolshero-css']
      .filter(id => { const at = s.indexOf('<style id="' + id + '"'); return at >= 0 && at > mono; });
    if (after.length) fail.push(`${rel(f)}: ${after.join(' and ')} sits AFTER lx-heromono-css — the hero will `
      + `paint in its per-page colour, not the monochrome one. Re-run _tools/_heromono.js last and rebuild.`);
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
