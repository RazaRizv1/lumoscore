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

// Local mirror of functions/lxapi/assetlogo — resolve an asset logo from the issuer's stellar.toml.
// Server-side, so the CORS wall that blocks this in the browser does not apply.
const LOGO_ASSET_RE = /^[A-Za-z0-9]{1,12}-G[A-Z2-7]{55}$/;
const LOGO_HOST_RE = /^[A-Za-z0-9.-]{1,253}$/;
const LOGO_CACHE = new Map();
function logoJson(res, body, ttl) {
  res.writeHead(200, { "content-type": "application/json", "cache-control": "public, max-age=" + ttl,
    "access-control-allow-origin": "*" });
  res.end(JSON.stringify(body));
}
function tomlCurrency(text, code, issuer) {
  const blocks = String(text || "").split("[[CURRENCIES]]");
  for (let i = 1; i < blocks.length; i++) {
    const b = blocks[i];
    const get = (key) => {
      const lines = b.split("\n");
      for (let n = 0; n < lines.length; n++) {
        const ln = lines[n].trim(); const eq = ln.indexOf("=");
        if (eq < 0) continue;
        if (ln.slice(0, eq).trim() !== key) continue;
        let v = ln.slice(eq + 1).trim();
        if (v.charAt(0) === '"') { const e = v.indexOf('"', 1); v = e > 0 ? v.slice(1, e) : v.slice(1); }
        return v;
      }
      return "";
    };
    if (get("code") !== code) continue;
    const iss = get("issuer"); if (iss && iss !== issuer) continue;
    return { image: get("image") || "", name: get("name") || "" };
  }
  return null;
}
async function fetchTimeout(url, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { signal: ctl.signal }); } finally { clearTimeout(t); }
}
// Local mirror of functions/lxapi/dexassets — price a batch of assets in one request. Server-side, so
// neither the browser's six-connection-per-host limit nor Horizon's CORS-less 429 applies. Keep this in
// step with the Pages Function; the shapes must match or the page behaves differently once deployed.
const DEX_CACHE = new Map();
const DEX_MAX = 16;
function dexPriceOf(bar) {
  if (!bar) return 0;
  const close = +bar.close || 0; if (close > 0) return close;
  const avg = +bar.avg || 0; if (avg > 0) return avg;
  // below 1e-7 Horizon reports "0.0000000"; the volumes carry more precision
  const b = +bar.base_volume || 0, c = +bar.counter_volume || 0;
  return b > 0 && c > 0 ? c / b : 0;
}
async function dexOneAsset(code, issuer) {
  const type = code.length <= 4 ? "credit_alphanum4" : "credit_alphanum12";
  const base = "base_asset_type=" + type + "&base_asset_code=" + encodeURIComponent(code) +
    "&base_asset_issuer=" + issuer + "&counter_asset_type=native";
  const H = "https://horizon.stellar.org";
  const out = { px: 0, chg: null, vol: null, high: null, low: null, tr: null, ho: null, su: null };
  const recs = (d) => (d && d._embedded && d._embedded.records) || [];
  // Horizon 429s under load and its 429 carries no CORS header, so upstream failure is common and cheap to
  // ride out. Two backed-off retries here mean a throttled moment does not become a dash on the page.
  const getJson = async (u) => {
    let last;
    for (const delay of [0, 400, 1200]) {
      if (delay) await new Promise((r) => setTimeout(r, delay));
      try {
        const r = await fetchTimeout(u, 6000);
        if (r.ok) return r.json();
        last = new Error(String(r.status));
      } catch (e) { last = e; }
    }
    throw last;
  };
  const agg = getJson(H + "/trade_aggregations?" + base + "&resolution=86400000&order=desc&limit=2")
    .then((d) => { const r = recs(d); if (!r[0]) return;
      out.px = dexPriceOf(r[0]); out.vol = +r[0].counter_volume || 0;
      out.high = +r[0].high || 0; out.low = +r[0].low || 0; out.tr = +r[0].trade_count || 0;
      const prev = dexPriceOf(r[1]); if (prev > 0 && out.px > 0) out.chg = ((out.px - prev) / prev) * 100;
    }).catch(() => {});
  const meta = getJson(H + "/assets?asset_code=" + encodeURIComponent(code) + "&asset_issuer=" + issuer)
    .then((d) => { const rec = recs(d)[0]; if (!rec) return;
      if (rec.accounts) out.ho = (+rec.accounts.authorized || 0) + (+rec.accounts.authorized_to_maintain_liabilities || 0);
      if (rec.balances) out.su = +rec.balances.authorized || +rec.balances.authorized_to_maintain_liabilities || null;
      else if (rec.amount != null) out.su = +rec.amount;
    }).catch(() => {});
  await Promise.all([agg, meta]);
  return out;
}
async function dexAssets(req, res, q) {
  const raw = (q.get("a") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const bad = (m) => { res.writeHead(400, { "content-type": "application/json",
    "access-control-allow-origin": "*" }); res.end(JSON.stringify({ error: m })); };
  if (!raw.length) return bad("no assets");
  if (raw.length > DEX_MAX) return bad("max " + DEX_MAX + " assets per call");
  const wanted = [];
  for (const r of raw) {
    if (!LOGO_ASSET_RE.test(r)) return bad("bad asset: " + r.slice(0, 24));
    const dash = r.lastIndexOf("-");
    wanted.push({ key: r, code: r.slice(0, dash), issuer: r.slice(dash + 1) });
  }
  const now = Date.now(), a = {}, need = [];
  for (const w of wanted) {
    const c = DEX_CACHE.get(w.key);
    if (c && now - c.ts < 300000) a[w.key] = c.v; else need.push(w);   // 5min: Horizon allows 100 req/5min per IP
  }
  const got = await Promise.all(need.map((w) => dexOneAsset(w.code, w.issuer).catch(() => null)));
  need.forEach((w, i) => {
    if (!got[i]) return;
    a[w.key] = got[i];
    // Never cache a throttled read. A px of 0 is indistinguishable from "we got rate limited", and caching
    // it would pin a dash on the page for the next minute.
    if (got[i].px > 0) DEX_CACHE.set(w.key, { ts: now, v: got[i] });
  });
  return logoJson(res, { ok: 1, a }, 300);
}
async function assetLogo(req, res, q) {
  const asset = q.get("asset") || "";
  if (!LOGO_ASSET_RE.test(asset)) { res.writeHead(400, { "content-type": "application/json" });
    return res.end('{"error":"bad asset"}'); }
  if (LOGO_CACHE.has(asset)) return logoJson(res, LOGO_CACHE.get(asset), 86400);
  const dash = asset.lastIndexOf("-");
  const code = asset.slice(0, dash), issuer = asset.slice(dash + 1);
  let out;
  try {
    const accRes = await fetchTimeout("https://horizon.stellar.org/accounts/" + issuer, 4000);
    if (!accRes.ok) out = { image: "", domain: "", reason: "issuer not found" };
    else {
      const acc = await accRes.json();
      const domain = (acc && acc.home_domain) || "";
      if (!domain) out = { image: "", domain: "", reason: "no home_domain" };
      else if (!LOGO_HOST_RE.test(domain)) out = { image: "", domain, reason: "home_domain is not a host" };
      else {
        const tr = await fetchTimeout("https://" + domain + "/.well-known/stellar.toml", 4000);
        if (!tr.ok) out = { image: "", domain, reason: "toml " + tr.status };
        else {
          const cur = tomlCurrency(await tr.text(), code, issuer);
          if (!cur) out = { image: "", domain, reason: "asset not in toml" };
          else if (!cur.image) out = { image: "", domain, name: cur.name, reason: "no image key" };
          else out = { image: cur.image, domain, name: cur.name };
        }
      }
    }
  } catch (e) {
    const msg = String((e && e.message) || e);
    out = { image: "", domain: "", reason: /abort/i.test(msg) ? "timeout" : msg };
  }
  LOGO_CACHE.set(asset, out);
  return logoJson(res, out, out.image ? 86400 : 3600);
}

// Local mirror of functions/lxapi/poolstats — network-wide AMM aggregates for the Pools Market Overview.
// Same shape as the Pages Function so the page behaves identically in dev and production. Kept in step
// with functions/lxapi/poolstats.js; see that file for what is exact and what is sampled.
const PS_API = 'https://api.stellar.expert/explorer/public/liquidity-pool';
let PS_CACHE = null;
function poolStats(req, res) {
  if (PS_CACHE && Date.now() - PS_CACHE.ts < 600000) {
    res.writeHead(200, {'content-type':'application/json'});
    return res.end(PS_CACHE.body);
  }
  // Upstream 429s on bursts, so everything here is sequential with retry — same as the Pages Function.
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const getJ = async url => {
    for (let a = 0; a < 3; a++) {
      const r = await fetch(url);
      if (r.status === 429) { await sleep(1200 * (a + 1)); continue; }
      if (!r.ok) return null;
      return r.json();
    }
    return null;
  };
  const has = async off => {
    const d = await getJ(PS_API + '?limit=1&cursor=' + off);
    if (!d) throw new Error('rate limited');
    return ((((d._embedded || {}).records) || []).length > 0);
  };
  (async () => {
    // Walk DOWN the TVL ranking — sorting by volume or LP count returns the same top pools, so breadth
    // across sort orders bought nothing. Sequential + paced: a burst gets 429ed.
    const pages = [];
    for (let cursor = 0; cursor < 800; cursor += 200) {
      if (pages.length) await sleep(1200);
      pages.push(await getJ(PS_API + '?limit=200&order=desc&sort=tvl&cursor=' + cursor).catch(() => null));
    }
    const pools = await (async () => {
      let lo = 0, hi = 1024;
      while (await has(hi)) { lo = hi; hi *= 2; if (hi > (1 << 22)) return null; }
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (await has(mid)) lo = mid; else hi = mid; }
      return lo + 1;
    })().catch(() => null);
    const seen = new Set();
    let tvlXlm = 0, vol24Usd = 0, fees24Usd = 0, lpAccounts = 0, trades24 = 0, sampled = 0;
    for (const p of pages) for (const r of ((p && p._embedded && p._embedded.records) || [])) {
      if (!r || !r.id || seen.has(r.id)) continue;
      seen.add(r.id); sampled++;
      const xlm = (r.assets || []).filter(a => (a.asset || a.name) === 'XLM')[0];
      if (xlm) tvlXlm += (2 * (+xlm.amount || 0)) / 1e7;
      vol24Usd += ((r.volume_value && +r.volume_value['1d']) || 0) / 1e7;
      fees24Usd += ((r.earned_value && +r.earned_value['1d']) || 0) / 1e7;
      lpAccounts += +r.accounts || 0;
      trades24 += (r.trades && +r.trades['1d']) || 0;
    }
    // All pages or nothing — a partial aggregate is a WRONG total, not a smaller one (see the Pages Function)
    if (pages.some(p => !p) || sampled < 800) throw new Error('incomplete sample');
    const body = JSON.stringify({ pools, sampled, tvlXlm: Math.round(tvlXlm),
      vol24Usd: Math.round(vol24Usd * 100) / 100, fees24Usd: Math.round(fees24Usd * 100) / 100,
      lpAccounts, trades24, ts: Date.now() });
    PS_CACHE = { ts: Date.now(), body };
    res.writeHead(200, {'content-type':'application/json','cache-control':'public, max-age=600'});
    res.end(body);
  })().catch(e => {
    res.writeHead(502, {'content-type':'application/json'});
    res.end(JSON.stringify({ error: String((e && e.message) || e) }));
  });
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
  if (p === '/lxapi/assetlogo') return assetLogo(req, res, new URL(req.url, 'http://x').searchParams);
  if (p === '/lxapi/dexassets') return dexAssets(req, res, new URL(req.url, 'http://x').searchParams);
  if (p === '/lxapi/poolstats') return poolStats(req, res);
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
      // Keep every param EXCEPT the one promoted into the path (see functions/_middleware.js). Dropping
      // the whole query took act=withdraw with it, so the Wallet's "Remove" deep link always landed on
      // the Deposit tab.
      const promoted = lg.indexOf('/trade/stellar/') === 0 || lg.indexOf('/asset/stellar/') === 0
        || lg.indexOf('/pools/stellar/id/') === 0;
      const raw = req.url.split('?')[1] || '';
      let q = raw ? '?' + raw : '';
      if (promoted) {
        const keep = new URLSearchParams(raw);
        keep.delete('asset'); keep.delete('pool');
        q = keep.toString() ? '?' + keep.toString() : '';
      }
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
