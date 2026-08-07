#!/usr/bin/env node
// LumosCore local server — serves the built site over http://localhost so browser wallet
// extensions (Rabet, Freighter, MetaMask, …) inject their providers. They do NOT inject
// into file:// pages, which is why opening the HTML directly shows "wallet not detected".
//
//   node serve.js            -> http://localhost:8080
//   node serve.js 3000       -> http://localhost:3000
//
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, 'dist');
const PORT = parseInt(process.argv[2], 10) || 8080;

// ---- admin panel: opt-in, loopback only -------------------------------------------------------
// The admin build lives OUTSIDE dist/ so a public deploy of dist/ cannot contain it. Serving it here
// requires --admin, and even then only to requests from this machine. That keeps the default safe:
// start the server the usual way and the admin panel does not exist as far as the network is concerned.
const MOBILE_UA = /Android|iPhone|iPod|IEMobile|BlackBerry|Opera Mini|Mobile Safari|Windows Phone/i;
const ADMIN_ROOT = path.join(__dirname, 'dist-admin');
const ADMIN = process.argv.includes('--admin');
const isAdminPath = p => /^\/(lumoscore-admin-|admin(\/|$))/.test(p);
function isLocal(req){
  const a = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  return a === '127.0.0.1' || a === '::1';
}

// ---- optional password on the local admin panel ------------------------------------------------
// Set these in your shell before starting the server; they are deliberately NOT stored in the repo,
// because a password committed to a file is not a password:
//
//   $env:LUMOS_ADMIN_USER = "admin"      (PowerShell)
//   $env:LUMOS_ADMIN_PASS = "…"
//   node serve.js 8080 --admin
//
// This is REAL auth — the check happens here, before any bytes are sent, so it cannot be bypassed
// from the browser. It is a second lock on top of "the files are not in the public build" and
// "loopback only". If no password is set, those two still apply and nothing is weakened.
//
// In production Cloudflare Access replaces this entirely; do not send Basic Auth over the internet.
const crypto = require('crypto');
const ADMIN_USER = process.env.LUMOS_ADMIN_USER || '';
const ADMIN_PASS = process.env.LUMOS_ADMIN_PASS || '';
const HAS_PW = !!ADMIN_PASS;

// compare digests, not raw strings: equal-length buffers, and no early exit that leaks length
function sameSecret(a, b){
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}
function adminAuthOk(req){
  if (!HAS_PW) return true;
  const h = req.headers.authorization || '';
  if (h.slice(0, 6).toLowerCase() !== 'basic ') return false;
  let decoded = '';
  try { decoded = Buffer.from(h.slice(6), 'base64').toString('utf8'); } catch (e) { return false; }
  const i = decoded.indexOf(':');
  if (i < 0) return false;
  return sameSecret(decoded.slice(0, i), ADMIN_USER) && sameSecret(decoded.slice(i + 1), ADMIN_PASS);
}
const MT = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml',
  '.gif':'image/gif', '.woff2':'font/woff2', '.woff':'font/woff', '.ico':'image/x-icon' };

// Same-origin read-only proxy for ONE upstream call: stellar.expert's ranked asset holders.
//
// Why this exists: Horizon cannot rank holders (its /accounts?asset= is ordered by account id, not
// balance), so "Top 10 / Top 50 hold" cannot be computed from Horizon at all. stellar.expert does return
// a real ranking and even sends Access-Control-Allow-Origin:*, but that one path is blocked in-browser
// here (fetch AND XMLHttpRequest both fail, while other paths on the same host succeed), so the page
// cannot call it directly. Serving it from this origin sidesteps that.
//
// Deliberately narrow: GET only, one fixed upstream path, and the asset must match CODE-GISSUER exactly,
// so this cannot be used as an open proxy. If the site is ever hosted as plain static files this route
// simply won't exist — the page falls back to showing the unranked sample.
function holdersProxy(req, res, q) {
  const asset = /^[A-Za-z0-9]{1,12}-G[A-Z2-7]{55}$/.test(q.get('asset') || '') ? q.get('asset') : null;
  if (!asset) { res.writeHead(400, {'content-type':'application/json'}); return res.end('{"error":"bad asset"}'); }
  const limit = Math.min(parseInt(q.get('limit'), 10) || 50, 200);
  const up = 'https://api.stellar.expert/explorer/public/asset/' + asset + '/holders?order=desc&limit=' + limit;
  fetch(up).then(r => r.text().then(body => {
    res.writeHead(r.status, {'content-type':'application/json','cache-control':'public, max-age=120'});
    res.end(body);
  })).catch(e => { res.writeHead(502, {'content-type':'application/json'}); res.end(JSON.stringify({error:String(e&&e.message||e)})); });
}

// Local mirror of functions/lxapi/soroswap — same allow-list, same shape, so the swap path behaves
// identically in dev and production. The key comes from the environment, never the repo:
//   $env:SOROSWAP_KEY = "sk_…" ; node serve.js 8080 --admin
// Without it, quotes return 503 and routing falls back to Horizon path-finding, which is exactly
// what happens on a deployment with no secret set.
const SORO_ALLOWED = new Set(['quote', 'quote/build', 'send']);
function soroswapProxy(req, res, sub, query) {
  if (req.method !== 'POST') { res.writeHead(405, {'content-type':'application/json'}); return res.end('{"error":"method not allowed"}'); }
  if (!SORO_ALLOWED.has(sub)) { res.writeHead(404, {'content-type':'application/json'}); return res.end('{"error":"unknown endpoint"}'); }
  const key = process.env.SOROSWAP_KEY || '';
  if (!key) { res.writeHead(503, {'content-type':'application/json'}); return res.end('{"error":"SOROSWAP_KEY is not set in this shell"}'); }
  const net = (query.get('network') || 'mainnet');
  let body = '';
  req.on('data', c => { body += c; if (body.length > 200000) req.destroy(); });
  req.on('end', () => {
    fetch('https://api.soroswap.finance/' + sub + '?network=' + encodeURIComponent(net), {
      method: 'POST',
      headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json', accept: 'application/json' },
      body,
    }).then(r => r.text().then(t => {
      res.writeHead(r.status, {'content-type':'application/json','cache-control':'no-store'});
      res.end(t);
    })).catch(e => { res.writeHead(502, {'content-type':'application/json'}); res.end(JSON.stringify({error:String(e&&e.message||e)})); });
  });
}

// Clean-URL rewrites, read from the generated dist/_redirects so there is ONE source of truth (the
// ROUTES table in _tools/extract_site.js) rather than a second copy that drifts.
const RULES = (() => {
  try {
    return fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8').split('\n')
      .map(l => l.trim()).filter(l => l && !l.startsWith('#'))
      .map(l => { const [from, to, code] = l.split(/\s+/); return { from, to, code: +code || 200 }; })
      .filter(r => r.code === 200);            // 301s are Cloudflare's job; locally we only rewrite
  } catch (e) { return []; }
})();

// clean url -> file, read back out of the generated _redirects (one source of truth)
const CLEAN_OF_FILE = (() => {
  const m = {};
  for (const r of RULES) {
    if (r.from.indexOf('/:') >= 0) continue;
    m[r.to.replace(/^\//, '').replace(/\.html$/, '').replace(/-(dark|light|mobile)$/, '')] = r.from;
  }
  return m;
})();

function legacyClean(pathname, params) {
  // last segment, not the whole path — the app navigates with RELATIVE urls, so from /trade/stellar
  // a link to "lumoscore-dex-asset.html" lands on /trade/lumoscore-dex-asset.html and 404s.
  const segs = pathname.split('/');
  let base = (segs[segs.length - 1] || '').replace(/\.html$/, '');
  if (!base.startsWith('lumoscore-')) return null;
  base = base.replace(/-(dark|light|mobile)$/, '');
  const asset = params && params.get('asset');
  if (base === 'lumoscore-dex-asset')      return asset ? '/trade/stellar/' + asset : '/trade/stellar';
  if (base === 'lumoscore-asset-overview') return asset ? '/asset/stellar/' + asset : '/asset/stellar';
  const pool = params && params.get('pool');
  if (base === 'lumoscore-amm-pool') return pool ? '/pools/stellar/id/' + pool : '/pools/stellar';
  if (base === 'lumoscore-landing') return '/';
  return CLEAN_OF_FILE[base] || null;
}

function cleanUrl(p) {
  for (const r of RULES) {
    const fs_ = r.from.split('/').filter(Boolean);
    const ps_ = p.split('/').filter(Boolean);
    if (fs_.length !== ps_.length) continue;
    let ok = true;
    for (let i = 0; i < fs_.length; i++) {
      if (fs_[i].startsWith(':')) continue;     // placeholder matches any single segment
      if (fs_[i] !== ps_[i]) { ok = false; break; }
    }
    if (ok) return r.to.endsWith('.html') ? r.to : r.to + '.html';
  }
  return null;
}

http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/lxapi/holders') return holdersProxy(req, res, new URL(req.url, 'http://x').searchParams);
  if (p.startsWith('/lxapi/soroswap/')) {
    return soroswapProxy(req, res, p.slice('/lxapi/soroswap/'.length), new URL(req.url, 'http://x').searchParams);
  }

  // /admin/... is the only way in, and only with --admin from this machine
  let root = ROOT, adminReq = false;
  if (isAdminPath(p)) {
    if (!ADMIN || !isLocal(req)) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      return res.end('Not found');
    }
    // password check happens BEFORE any admin byte is read or sent
    if (!adminAuthOk(req)) {
      res.writeHead(401, {
        'www-authenticate': 'Basic realm="LumosCore Admin", charset="UTF-8"',
        'content-type': 'text/plain',
        'cache-control': 'no-store',
      });
      return res.end('Authentication required');
    }
    adminReq = true; root = ADMIN_ROOT;
    p = p.replace(/^\/admin/, '') || '/';
  }
  // Mirror the clean-URL rewrites Cloudflare applies from dist/_redirects, so local dev behaves like
  // production instead of only working on the raw filenames.
  if (!adminReq) {
    // Legacy build filename -> 301 to the clean url, mirroring functions/_middleware.js.
    // The app still navigates by assigning location.href="lumoscore-x.html" in a dozen places, so
    // this is what actually keeps the address bar clean.
    const lg = legacyClean(p, new URL(req.url, 'http://x').searchParams);
    if (lg) {
      const q = (lg.indexOf('/trade/stellar/') === 0 || lg.indexOf('/asset/stellar/') === 0 || lg.indexOf('/pools/stellar/id/') === 0)
        ? '' : (req.url.split('?')[1] ? '?' + req.url.split('?')[1] : '');
      res.writeHead(301, { location: lg + q });
      return res.end();
    }
    const clean = cleanUrl(p);
    if (clean) p = clean;
    // Same-url device serving, mirroring functions/_middleware.js on Cloudflare: pick the mobile
    // build from the User-Agent instead of redirecting to a second url.
    if (p === '/index.html' || p === '/' ) p = '/lumoscore-landing.html';
    if (/^\/lumoscore-[a-z0-9-]+\.html$/.test(p) && MOBILE_UA.test(req.headers['user-agent'] || '')) {
      const mob = p.replace(/-(dark|light)\.html$/, '.html').replace(/\.html$/, '-mobile.html');
      if (fs.existsSync(path.join(ROOT, mob))) p = mob;
    }
  }
  if (p === '/' || p.endsWith('/')) p += 'index.html';
  let file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end('forbidden'); }
  // admin pages share the site's assets, which live in dist/ — fall back for anything not admin HTML
  if (adminReq && !fs.existsSync(file)) {
    const shared = path.join(ROOT, p);
    if (shared.startsWith(ROOT) && fs.existsSync(shared)) file = shared;
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, {'content-type':'text/plain'}); return res.end('Not found: ' + p); }
    res.writeHead(200, { 'content-type': MT[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store' });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log('\n  LumosCore is live:  http://localhost:' + PORT + '\n');
  console.log('  Open that URL in the SAME Chrome where your wallet extension is installed.');
  if (ADMIN) {
    const ok = fs.existsSync(path.join(ADMIN_ROOT, 'lumoscore-admin-dashboard.html'));
    console.log('\n  Admin panel:        http://localhost:' + PORT + '/admin/   (this machine only)'
      + (HAS_PW ? '  [password required]' : '  [no password set]'));
    if (!HAS_PW) console.log('    set LUMOS_ADMIN_USER / LUMOS_ADMIN_PASS to require a login');
    if (!ok) console.log('  ! dist-admin/ is empty — build it:  node _tools/extract_site.js aptos --admin');
  } else {
    console.log('\n  Admin panel is OFF. Start with --admin to enable it:  node serve.js --admin');
  }
  console.log('\n  Press Ctrl+C to stop.\n');
});
