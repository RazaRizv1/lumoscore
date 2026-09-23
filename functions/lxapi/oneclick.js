// Cloudflare Pages Function — the bridge's NEAR Intents (1Click) route, proxied.
//
// WHY A PROXY. 1Click is reachable from a browser, but an API key -- which lowers its fee from 25 bps to 20 bps (1 bp on
// stablecoin pairs) -- must never ship in a page. The key, when set, lives only in the Pages env as ONECLICK_JWT and is
// added here. Without it the calls still work, on 1Click's keyless fee.
//
// WHAT IS LET THROUGH. Only the one shape this page uses, so the endpoint cannot be turned into a general relay:
//   origin      = XLM or USDC on Stellar      (1Click's only Stellar assets)
//   deposit     = ORIGIN_CHAIN, MEMO mode     (Stellar deposits are a shared address + memo)
//   refund      = ORIGIN_CHAIN, to a Stellar G-address
//   recipient   = DESTINATION_CHAIN, a 0x EVM address
//   destination = an asset on one of the chains the bridge lists
//   no appFees  (LumosCore takes its fee on Stellar, before the deposit -- cheaper than the 50/50 appFees split)
//
// ops:  GET ?op=tokens    -> the destination + origin tokens this page can use (cached 10 min at the edge)
//       POST ?op=quote    -> 1Click /v0/quote        (body validated as above; dry or live)
//       GET ?op=status&depositAddress=G…&depositMemo=…  -> 1Click /v0/status
//       POST ?op=submit   -> 1Click /v0/deposit/submit {txHash, depositAddress, memo}
const API = 'https://1click.chaindefuser.com/v0';
const TIMEOUT_MS = 12000;
// The destination chains this proxy will price, plus stellar as the origin. THIS IS A WHITELIST: a chain the
// page offers but this map omits is dropped from the token list, and every quote for it fails as 'unsupported
// destination asset'. Keep it in step with NI_CHAIN in _tools/_nearintents.js.
const CHAINS = { eth: 1, arb: 1, base: 1, pol: 1, op: 1, avax: 1, bera: 1, monad: 1, plasma: 1, stellar: 1,
  bsc: 1, gnosis: 1, scroll: 1, hood: 1, adi: 1 };
const STELLAR_ORIGIN = { XLM: 1, USDC: 1 };
const G_RE = /^G[A-Z2-7]{55}$/;
const EVM_RE = /^0x[0-9a-fA-F]{40}$/;
const HASH_RE = /^[0-9a-f]{64}$/i;

function json(body, status, ttl) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': ttl ? ('public, max-age=0, s-maxage=' + ttl) : 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}
function headers(env) {
  const h = { 'content-type': 'application/json', accept: 'application/json' };
  if (env && env.ONECLICK_JWT) h['X-API-Key'] = env.ONECLICK_JWT;   // never echoed, never logged
  return h;
}
async function call(env, path, init) {
  const r = await fetch(API + path, Object.assign({ headers: headers(env), signal: AbortSignal.timeout(TIMEOUT_MS) }, init || {}));
  let body = null; try { body = await r.json(); } catch (e) { body = null; }
  return { status: r.status, body };
}

let TOKENS = null, TOKENS_AT = 0;
async function tokens(env) {
  if (TOKENS && Date.now() - TOKENS_AT < 600000) return TOKENS;
  const r = await call(env, '/tokens', { method: 'GET' });
  if (r.status !== 200 || !Array.isArray(r.body)) throw new Error('token list unavailable');
  TOKENS = r.body.filter((t) => t && CHAINS[t.blockchain] && !/DEPRECATED/i.test(t.symbol || ''))
    .map((t) => ({ assetId: t.assetId, blockchain: t.blockchain, symbol: t.symbol, decimals: t.decimals,
      price: t.price, contractAddress: t.contractAddress || null, coingeckoId: t.coingeckoId || null }));
  TOKENS_AT = Date.now();
  return TOKENS;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: {
    'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' } });
}

// ---- logos for tokens beyond the shipped set (the picker's "Add custom token") -----------------------------------
// Keyed on the coingeckoId 1Click itself gives the token, so the logo belongs to the token being delivered, not to a
// ticker. Fetched ONCE per id and held in the edge cache for a week (CoinGecko's free tier 429s on bursts). Only raster
// bytes are passed through, and the type sent is the one the bytes prove -- never an SVG (a document that could carry
// script on our origin), never whatever content-type upstream claimed.
function rasterType(b) {
  if (b.length < 12) return '';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return '';
}
async function logo(request, id) {
  if (!/^[a-z0-9-]{1,80}$/.test(id || '')) return new Response('bad id', { status: 400 });
  const cache = caches.default, key = new Request(new URL(request.url).origin + '/lxapi/oneclick?op=logo&id=' + id);
  const hit = await cache.match(key); if (hit) return hit;
  const c = await fetch('https://api.coingecko.com/api/v3/coins/' + id + '?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false',
    { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!c.ok) return new Response('no logo', { status: 404, headers: { 'cache-control': 'public, max-age=300' } });
  const j = await c.json().catch(() => null);
  const url = j && j.image && (j.image.large || j.image.small);
  if (!url || !/^https:\/\//.test(url)) return new Response('no logo', { status: 404 });
  const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  const buf = new Uint8Array(await r.arrayBuffer());
  const type = rasterType(buf);
  if (!r.ok || !type || buf.length > 2 * 1024 * 1024) return new Response('no logo', { status: 404 });
  const res = new Response(buf, { status: 200, headers: { 'content-type': type, 'cache-control': 'public, max-age=604800',
    'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'", 'access-control-allow-origin': '*' } });
  try { await cache.put(key, res.clone()); } catch (e) {}
  return res;
}

export async function onRequestGet({ request, env }) {
  const q = new URL(request.url).searchParams;
  const op = q.get('op');
  try {
    if (op === 'logo') return await logo(request, q.get('id'));
    if (op === 'tokens') return json({ ok: 1, keyed: !!(env && env.ONECLICK_JWT), tokens: await tokens(env) }, 200, 600);
    if (op === 'status') {
      const a = (q.get('depositAddress') || '').trim(), m = (q.get('depositMemo') || '').trim();
      if (!G_RE.test(a) || (m && !/^[0-9A-Za-z_-]{1,64}$/.test(m))) return json({ ok: 0, error: 'bad deposit' }, 400);
      const r = await call(env, '/status?depositAddress=' + encodeURIComponent(a) + (m ? '&depositMemo=' + encodeURIComponent(m) : ''), { method: 'GET' });
      return json(r.body || { ok: 0 }, r.status);
    }
    return json({ ok: 0, error: 'unknown op' }, 400);
  } catch (e) { return json({ ok: 0, error: 'NEAR Intents unreachable' }, 502); }
}

export async function onRequestPost({ request, env }) {
  const op = new URL(request.url).searchParams.get('op');
  let b; try { b = await request.json(); } catch (e) { return json({ ok: 0, error: 'bad request' }, 400); }
  if (!b || typeof b !== 'object') return json({ ok: 0, error: 'bad request' }, 400);
  try {
    if (op === 'quote') {
      const list = await tokens(env);
      const origin = list.find((t) => t.assetId === b.originAsset);
      const dest = list.find((t) => t.assetId === b.destinationAsset);
      if (!origin || origin.blockchain !== 'stellar' || !STELLAR_ORIGIN[origin.symbol]) return json({ ok: 0, error: 'origin must be XLM or USDC on Stellar' }, 400);
      if (!dest || dest.blockchain === 'stellar') return json({ ok: 0, error: 'unsupported destination asset' }, 400);
      if (!/^[0-9]{1,30}$/.test(String(b.amount || ''))) return json({ ok: 0, error: 'bad amount' }, 400);
      if (!G_RE.test(b.refundTo || '')) return json({ ok: 0, error: 'refund must be a Stellar address' }, 400);
      if (!EVM_RE.test(b.recipient || '')) return json({ ok: 0, error: 'recipient must be an EVM address' }, 400);
      const slip = Math.max(10, Math.min(300, parseInt(b.slippageTolerance, 10) || 100));   // 0.1%..3%
      const body = {
        dry: !!b.dry, swapType: 'EXACT_INPUT', slippageTolerance: slip,
        originAsset: origin.assetId, depositType: 'ORIGIN_CHAIN', depositMode: 'MEMO',
        destinationAsset: dest.assetId, amount: String(b.amount),
        refundTo: b.refundTo, refundType: 'ORIGIN_CHAIN',
        recipient: b.recipient, recipientType: 'DESTINATION_CHAIN',
        deadline: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      };
      const r = await call(env, '/quote', { method: 'POST', body: JSON.stringify(body) });
      const out = r.body || {};
      if (out && typeof out === 'object') out.keyed = !!(env && env.ONECLICK_JWT);
      return json(out, r.status);
    }
    if (op === 'submit') {
      if (!HASH_RE.test(b.txHash || '') || !G_RE.test(b.depositAddress || '')) return json({ ok: 0, error: 'bad submit' }, 400);
      const body = { txHash: b.txHash, depositAddress: b.depositAddress };
      if (b.memo && /^[0-9A-Za-z_-]{1,64}$/.test(String(b.memo))) body.memo = String(b.memo);
      const r = await call(env, '/deposit/submit', { method: 'POST', body: JSON.stringify(body) });
      return json(r.body || { ok: 0 }, r.status);
    }
    return json({ ok: 0, error: 'unknown op' }, 400);
  } catch (e) { return json({ ok: 0, error: 'NEAR Intents unreachable' }, 502); }
}
