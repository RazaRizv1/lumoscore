// Cloudflare Pages Function — a BATCH relay for public Horizon reads (RAZA 2026-11-26: "just be efficient... make sure
// for what things you really need to call api").
//
// Why. horizon.stellar.org allows 3,000 requests an hour per IP and answers a 429 WITHOUT a CORS header, so the browser
// only sees "Failed to fetch". Pages fired those reads straight from the visitor's browser: the dashboard's activity
// feed ~100 per load, Trade ~77, $LUMOS ~35 -- so one person (or one office / phone network IP) could exhaust it, and
// every visitor paid again for data that is identical for everyone.
//
// How. script#lx-hzcache in every page collects the browser's Horizon GETs that are PUBLIC and THE SAME FOR EVERY
// VISITOR (below) for a few milliseconds and sends them here in one POST. This function fetches each from Horizon
// with Cloudflare's cache in front (cf.cacheTtlByStatus), so a given URL reaches Horizon about once per TTL per data
// centre however many people ask, and the browser makes one request to us instead of up to 30 to Horizon.
//
// Narrow by construction: an allowlist of path shapes, an allowlist of query keys per shape, a character allowlist for
// every value, and the URL is REBUILT from those pieces -- nothing is forwarded as given. Only Horizon (and, after a
// 429, the lobstr mirror for non-chart reads) is contacted. Anything personal or that must be exact right now --
// accounts, offers, paths/quotes, order book, transaction submission -- is never accepted here; the page reads those
// directly as before.
//
// Answer: { r: [ {s:status, b:"raw Horizon body"} | {s:0} ] } in request order. s:0 or s>=500 or 429 means "read it
// yourself" -- the page then falls back to Horizon directly, exactly as it worked before this existed.
// Free plan: 50 subrequests per invocation, so at most MAX items, one upstream fetch each (+1 mirror retry on 429).
const H = 'https://horizon.stellar.org';
const M = 'https://horizon.stellar.lobstr.co';
const MAX = 20;
const TIMEOUT_MS = 8000;
const VAL_OK = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789:,_.-';

function hex64(v) { if (!v || v.length !== 64) return false; for (const c of v) if ('0123456789abcdef'.indexOf(c) < 0) return false; return true; }
function digits(v) { if (!v || v.length > 20) return false; for (const c of v) if (c < '0' || c > '9') return false; return true; }
function valOk(v) { if (v.length > 160) return false; for (const c of v) if (VAL_OK.indexOf(c) < 0) return false; return true; }

const PAGE = ['limit', 'order', 'cursor'];
const TA = ['base_asset_type', 'base_asset_code', 'base_asset_issuer', 'counter_asset_type', 'counter_asset_code', 'counter_asset_issuer', 'resolution', 'start_time', 'end_time', 'order', 'limit', 'offset'];

// -> { path, keys, ttl, chart } or null
function shape(pathname, q) {
  const s = pathname.replace(/\/+$/, '').split('/');
  if (s[0] !== '') return null;
  if (s[1] === 'transactions' && hex64(s[2])) {
    if (s.length === 3) return { keys: [], ttl: 86400 };
    if (s.length === 4 && ['operations', 'effects', 'payments'].includes(s[3])) return { keys: PAGE.concat(['include_failed']), ttl: 86400 };
    return null;
  }
  if ((s[1] === 'operations' || s[1] === 'ledgers') && s.length === 3 && digits(s[2])) return { keys: [], ttl: 86400 };
  if (s[1] === 'liquidity_pools') {
    if (s.length === 2 && q.get('reserves')) return { keys: ['reserves'].concat(PAGE), ttl: 60 };
    if (s.length === 3 && hex64(s[2])) return { keys: [], ttl: 60 };
    if (s.length === 4 && hex64(s[2]) && s[3] === 'trades') return { keys: PAGE, ttl: 30 };
    return null;
  }
  if (s[1] === 'trade_aggregations' && s.length === 2) return { keys: TA, ttl: 60, chart: true };
  if (s[1] === 'assets' && s.length === 2 && q.get('asset_code') && q.get('asset_issuer')) return { keys: ['asset_code', 'asset_issuer', 'limit'], ttl: 300 };
  return null;
}

// -> { url, ttl, chart } or null. Rebuilt from validated pieces only.
function build(p) {
  if (typeof p !== 'string' || p.length > 700 || p.charAt(0) !== '/' || p.charAt(1) === '/') return null;
  let u; try { u = new URL(H + p); } catch (e) { return null; }
  if (u.origin !== H) return null;
  const sh = shape(u.pathname, u.searchParams); if (!sh) return null;
  const out = new URLSearchParams();
  for (const [k, v] of u.searchParams) { if (!sh.keys.includes(k) || !valOk(v)) return null; out.append(k, v); }
  const qs = out.toString();
  return { path: u.pathname.replace(/\/+$/, '') + (qs ? '?' + qs : ''), ttl: sh.ttl, chart: !!sh.chart };
}

async function get(base, it) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(base + it.path, { signal: ctl.signal, headers: { accept: 'application/json' }, cf: { cacheTtlByStatus: { '200-299': it.ttl, '300-599': 0 }, cacheEverything: true } });
    const s = r.status;
    if (s === 429 || s >= 500) { try { r.body && r.body.cancel(); } catch (e) {} return { s }; }
    return { s, b: await r.text() };
  } catch (e) { return { s: 0 }; } finally { clearTimeout(t); }
}

async function one(p) {
  const it = build(p); if (!it) return { s: 0 };
  let a = await get(H, it);
  // the mirror keeps only ~36 days, so charts are never taken from it -- the page reads Horizon itself instead
  if ((a.s === 429 || a.s === 0 || a.s >= 500) && !it.chart) { const m = await get(M, it); if (m.s && m.s < 500 && m.s !== 429) a = m; }
  return a;
}

function json(o, status) {
  return new Response(JSON.stringify(o), { status: status || 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

export async function onRequestPost({ request }) {
  let body; try { body = await request.json(); } catch (e) { return json({ error: 'bad body' }, 400); }
  const ps = body && Array.isArray(body.p) ? body.p.slice(0, MAX) : null;
  if (!ps || !ps.length) return json({ error: 'nothing asked' }, 400);
  const r = await Promise.all(ps.map(one));
  return json({ r });
}
