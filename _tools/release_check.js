// Release gate: what is COMMITTED must be self-consistent, because production deploys from git.
//
// `npm run predeploy` checks dist/ as it sits on this machine, which is the right question for
// `wrangler pages deploy dist` (staging uploads the directory, so anything on disk ships). It is the
// WRONG question for production: the lumoscore project is git-connected, so only TRACKED files ship.
//
// Those two notions of "ships" diverged and put a broken route on the live site. _mergexrpl.js writes
// the 9 XRPL routes into dist/_redirects and the XRPL pages into dist/x/. dist/x/ is gitignored;
// dist/_redirects is tracked. Committing after a merge therefore sent the routes to production with
// nothing behind them, and every /trade/xrpl-style url 404d while looking like a working route. The
// predeploy check could never catch it: on this machine dist/x/ exists, so the targets resolve.
//
// XRPL is not public, so the 404 was the intended outcome and nothing leaked. The same mistake on a
// chain we had launched would have published it half-wired.
//
// Run before pushing to main:  npm run check:release
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const fail = [];

function tracked(rel) {
  try {
    return execFileSync('git', ['ls-files', '--error-unmatch', rel], { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim().length > 0;
  } catch (e) { return false; }
}

const rf = path.join(DIST, '_redirects');
if (!fs.existsSync(rf)) {
  fail.push('dist/_redirects is missing — run `npm run build` before releasing.');
} else if (!tracked('dist/_redirects')) {
  fail.push('dist/_redirects is not tracked by git, so production would not receive it.');
} else {
  const orphans = [];
  for (const line of fs.readFileSync(rf, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t[0] === '#') continue;
    const p = t.split(/\s+/);
    if (p.length < 3 || p[2] !== '200') continue;            // only rewrites; a 301 may leave the site
    const target = p[1].split('?')[0].split('#')[0];
    if (target.indexOf(':') >= 0 || target.indexOf('*') >= 0) continue;  // placeholders resolve at runtime
    const base = 'dist' + (target.startsWith('/') ? target : '/' + target);
    // Pages serves /foo from foo.html, so either spelling counts.
    if (!tracked(base) && !tracked(base + '.html')) orphans.push(p[0] + '  ->  ' + target);
  }
  if (orphans.length) {
    fail.push('dist/_redirects rewrites ' + orphans.length + ' url(s) to file(s) git does NOT track,\n'
      + '      so they ship as routes with nothing behind them and 404 on production:\n'
      + orphans.map((o) => '        ' + o).join('\n')
      + '\n      `npm run build` regenerates _redirects from the route table without them. Run\n'
      + '      `npm run merge:xrpl` only for a staging deploy, and rebuild before committing.');
  }
}

if (!fail.length) {
  console.log('\n  Release check — PASS: every committed rewrite points at a committed file.\n');
  process.exit(0);
}
console.log('\n  Release check — BLOCKED: ' + fail.length + ' problem(s)\n');
fail.forEach((f, i) => console.log('  ' + (i + 1) + '. ' + f + '\n'));
process.exit(1);
