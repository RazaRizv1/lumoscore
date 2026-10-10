// Cloudflare Pages Function — the bridge's NEAR Intents (1Click) route, proxied. XRP LEDGER BUILD.
//
// Ported from the Stellar repo's functions/lxapi/oneclick.js. The differences from that file are ALL
// consequences of the origin chain, and every one of them was measured against the live API on
// 2026-09-28 rather than assumed:
//
//   1. depositMode is SIMPLE, not MEMO. Stellar's 1Click deposits go to ONE fixed account and are told
//      apart by memo; XRP gets a DEDICATED r-address per quote and no memo at all. Verified with a live
//      quote: depositAddress "r9Yhe7oxkrBVfuQXDs8rZmoZrf2xXDZz36", depositMemo absent. This is the
//      reason the XRPL send path is simpler than Stellar's -- one ordinary Payment, no destination tag,
//      no memo, and therefore nothing for a user to omit and lose funds over.
//   2. The origin is XRP and only XRP. 1Click lists exactly one asset for chain `xrp`.
//   3. refundTo is an r-address, not a G-address.
//   4. status takes a deposit address with NO memo (see 1), so the memo parameter is gone rather than
//      optional -- an optional one would invite the Stellar shape to be copied back in.
//
// WHY A PROXY, unchanged from Stellar: 1Click is reachable from a browser, but the API key -- which
// lowers its fee from 25bps to 20bps, and 1bp on stablecoin pairs -- must never ship in a page. The key
// lives only in the Pages env as ONECLICK_JWT and is added here. Without it the calls still work, at
// 1Click's keyless fee, so this ships useful before RAZA sets the secret.
//
// WHAT IS LET THROUGH, so an open endpoint cannot be turned into a general relay:
//   origin      = XRP on the XRP Ledger
//   deposit     = ORIGIN_CHAIN, SIMPLE mode
//   refund      = ORIGIN_CHAIN, to an r-address
//   recipient   = DESTINATION_CHAIN, shape-checked per destination family
//   destination = any chain 1Click offers EXCEPT xrp itself
//   no appFees  (LumosCore takes its fee on XRPL before the deposit, which is cheaper than 1Click's
//                50/50 appFees split -- same reasoning as the Stellar build)
//
// ops:  GET  ?op=tokens                        -> origin + destination tokens (cached 10 min at the edge)
//       POST ?op=quote                         -> 1Click /v0/quote (validated as above; dry or live)
//       GET  ?op=status&depositAddress=r…      -> 1Click /v0/status
//       POST ?op=submit                        -> 1Click /v0/deposit/submit {txHash, depositAddress}
//       GET  ?op=logo&id=…                     -> a CoinGecko logo for a token beyond the shipped set
const API = 'https://1click.chaindefuser.com/v0';
const TIMEOUT_MS = 12000;

// THE DESTINATION WHITELIST. Every chain 1Click serves except `xrp`, which is the origin -- a quote from
// XRP to XRP is not a bridge. Taken from a live /tokens read on 2026-09-28 (36 chains), so if 1Click adds
// a chain it is absent here until someone looks, which is the safe direction: an unknown chain is dropped
// from the token list rather than offered and then failing at quote time.
//
// On the Stellar build the equivalent list going stale did NOT surface as an error -- the picker simply
// showed "0 ASSETS" for the missing chains and every quote for them failed as 'unsupported destination
// asset'. Keep this in step with NI_CHAIN in _tools/_xrplnearintents.js, which fails the build if the two
// disagree rather than leaving a comment asking someone to remember.
const CHAINS = {
  // EVM-family, confirmed by the presence of 0x-contract tokens on each in the live list
  arb: 1, avax: 1, base: 1, bera: 1, bsc: 1, eth: 1, gnosis: 1, hood: 1, hypercore: 1,
  monad: 1, op: 1, plasma: 1, pol: 1, scroll: 1, xlayer: 1, abs: 1,
  // non-EVM
  aleo: 1, aptos: 1, bch: 1, btc: 1, cardano: 1, dash: 1, doge: 1, fogo: 1, ltc: 1,
  movement: 1, near: 1, sol: 1, starknet: 1, sui: 1, ton: 1, tron: 1, zec: 1, adi: 1,
  // Stellar. The two LumosCore builds reach each other through this route: XRP -> XLM/USDC on Stellar
  // is an ordinary 1Click pair, and it is the corridor Axelar could not serve without the SHX
  // trustline trap. See the Stellar repo's own oneclick.js for the mirror of this line.
  stellar: 1,
};

const XRPL_RE = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
const HASH_RE = /^[0-9a-fA-F]{64}$/;

// RECIPIENT SHAPE PER DESTINATION FAMILY.
//
// Carried over from Stellar with its lesson intact: this list started life as "EVM_RE for everything",
// which was right while 1Click reached only EVM chains and silently wrong the moment it did not -- the
// picker offered Bitcoin, Solana, Cardano and the rest and EVERY quote to them was refused here, before
// it reached 1Click at all.
//
// WHAT THIS IS FOR: stopping an open, unauthenticated endpoint relaying arbitrary junk. It is NOT trying
// to be the authority on address formats. 1Click validates the recipient against the real chain and says
// so ("recipient is not valid"), and re-implementing twenty families of checksum rules here would just be
// a second place to get them wrong. So: an exact pattern where a family has one, a conservative
// charset-and-length guard otherwise.
const EVM_FAMILY = { arb: 1, avax: 1, base: 1, bera: 1, bsc: 1, eth: 1, gnosis: 1, hood: 1,
  hypercore: 1, monad: 1, op: 1, plasma: 1, pol: 1, scroll: 1, xlayer: 1, abs: 1 };
const ADDR_RE = {
  evm: /^0x[0-9a-fA-F]{40}$/,
  sol: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  fogo: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  tron: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
  stellar: /^G[A-Z2-7]{55}$/,
  ton: /^[UE]Q[A-Za-z0-9_-]{46}$/,
  near: /^(?:[a-z0-9._-]{2,64}|[0-9a-f]{64})$/,
  sui: /^0x[0-9a-fA-F]{64}$/,
  aptos: /^0x[0-9a-fA-F]{1,64}$/,
  movement: /^0x[0-9a-fA-F]{1,64}$/,
  starknet: /^0x[0-9a-fA-F]{1,64}$/,
  aleo: /^aleo1[0-9a-z]{50,70}$/,
  cardano: /^(?:addr1[0-9a-z]{20,110}|[1-9A-HJ-NP-Za-km-z]{50,120})$/,
  btc: /^(?:bc1[0-9a-z]{20,80}|[13][1-9A-HJ-NP-Za-km-z]{25,39})$/,
  ltc: /^(?:ltc1[0-9a-z]{20,80}|[LM3][1-9A-HJ-NP-Za-km-z]{25,39})$/,
  doge: /^[DA9][1-9A-HJ-NP-Za-km-z]{25,39}$/,
  dash: /^X[1-9A-HJ-NP-Za-km-z]{25,39}$/,
  bch: /^(?:(?:bitcoincash:)?[qp][0-9a-z]{38,58}|[13][1-9A-HJ-NP-Za-km-z]{25,39})$/,
  zec: /^(?:t1|t3)[1-9A-HJ-NP-Za-km-z]{25,39}$/,
};
const ADDR_GENERIC = /^[A-Za-z0-9:._-]{20,120}$/;
function recipientOk(chain, addr) {
  const a = String(addr || '');
  if (!a) return false;
  const re = EVM_FAMILY[chain] ? ADDR_RE.evm : ADDR_RE[chain];
  return re ? re.test(a) : ADDR_GENERIC.test(a);
}

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
  const r = await fetch(API + path, Object.assign(
    { headers: headers(env), signal: AbortSignal.timeout(TIMEOUT_MS) }, init || {}));
  let body = null; try { body = await r.json(); } catch (e) { body = null; }
  return { status: r.status, body };
}

let TOKENS = null, TOKENS_AT = 0, NATIVES = null;
async function tokens(env) {
  if (TOKENS && Date.now() - TOKENS_AT < 600000) return TOKENS;
  const r = await call(env, '/tokens', { method: 'GET' });
  if (r.status !== 200 || !Array.isArray(r.body)) throw new Error('token list unavailable');
  // WHICH COINS EXIST NATIVELY SOMEWHERE, computed from the FULL upstream list before the chain filter.
  // The page uses it to tell a real coin from a bridged copy: 1Click lists XRP itself as an ordinary
  // token on Starknet and Aptos, and next to "XRP" those read as the genuine article. On THIS build that
  // matters more than it did on Stellar -- a user bridging FROM XRP who is offered "XRP on Starknet"
  // as a destination is being offered a wrapper of the thing they already hold.
  NATIVES = {};
  for (const t of r.body) {
    if (t && !t.contractAddress && t.coingeckoId && t.symbol) NATIVES[t.symbol + '|' + t.coingeckoId] = t.blockchain;
  }
  TOKENS = r.body
    .filter((t) => t && (CHAINS[t.blockchain] || t.blockchain === 'xrp') && !/DEPRECATED/i.test(t.symbol || ''))
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

// ---- logos for tokens beyond the shipped set -------------------------------------------------------
// Keyed on the coingeckoId 1Click gives the token, so the logo belongs to the token being delivered and
// not to a ticker. Fetched once per id and held in the edge cache for a week (CoinGecko's free tier 429s
// on bursts). Only raster bytes pass through, and the type sent is the one the BYTES prove -- never an
// SVG, which is a document that could carry script on our origin, and never whatever content-type
// upstream claimed.
function rasterType(b) {
  if (b.length < 12) return '';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
    && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return '';
}
async function logo(request, id) {
  if (!/^[a-z0-9-]{1,80}$/.test(id || '')) return new Response('bad id', { status: 400 });
  const cache = caches.default;
  const key = new Request(new URL(request.url).origin + '/lxapi/oneclick?op=logo&id=' + id);
  const hit = await cache.match(key); if (hit) return hit;
  const c = await fetch('https://api.coingecko.com/api/v3/coins/' + id
    + '?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false',
    { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!c.ok) return new Response('no logo', { status: 404, headers: { 'cache-control': 'public, max-age=300' } });
  const j = await c.json().catch(() => null);
  const url = j && j.image && (j.image.large || j.image.small);
  if (!url || !/^https:\/\//.test(url)) return new Response('no logo', { status: 404 });
  const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  const buf = new Uint8Array(await r.arrayBuffer());
  const type = rasterType(buf);
  if (!r.ok || !type || buf.length > 2 * 1024 * 1024) return new Response('no logo', { status: 404 });
  const res = new Response(buf, { status: 200, headers: { 'content-type': type,
    'cache-control': 'public, max-age=604800', 'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'", 'access-control-allow-origin': '*' } });
  try { await cache.put(key, res.clone()); } catch (e) {}
  return res;
}

export async function onRequestGet({ request, env }) {
  const q = new URL(request.url).searchParams;
  const op = q.get('op');
  try {
    if (op === 'logo') return await logo(request, q.get('id'));
    if (op === 'tokens') {
      const list = await tokens(env);
      return json({ ok: 1, keyed: !!(env && env.ONECLICK_JWT), tokens: list, natives: NATIVES || {} }, 200, 600);
    }
    if (op === 'status') {
      // No memo parameter: XRP deposits are SIMPLE mode, one address per quote. See the header.
      const a = (q.get('depositAddress') || '').trim();
      if (!XRPL_RE.test(a)) return json({ ok: 0, error: 'bad deposit address' }, 400);
      const r = await call(env, '/status?depositAddress=' + encodeURIComponent(a), { method: 'GET' });
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
      if (!origin || origin.blockchain !== 'xrp') return json({ ok: 0, error: 'origin must be XRP on the XRP Ledger' }, 400);
      if (!dest || dest.blockchain === 'xrp') return json({ ok: 0, error: 'unsupported destination asset' }, 400);
      if (!/^[0-9]{1,30}$/.test(String(b.amount || ''))) return json({ ok: 0, error: 'bad amount' }, 400);
      if (!XRPL_RE.test(b.refundTo || '')) return json({ ok: 0, error: 'refund must be an XRP Ledger address' }, 400);
      if (!recipientOk(dest.blockchain, b.recipient)) {
        return json({ ok: 0, error: 'recipient does not look like a ' + dest.blockchain + ' address' }, 400);
      }
      const slip = Math.max(10, Math.min(300, parseInt(b.slippageTolerance, 10) || 100));   // 0.1%..3%
      const body = {
        dry: !!b.dry, swapType: 'EXACT_INPUT', slippageTolerance: slip,
        originAsset: origin.assetId, depositType: 'ORIGIN_CHAIN',
        // SIMPLE, not MEMO -- the one line that makes this the XRPL build. See the header.
        depositMode: 'SIMPLE',
        destinationAsset: dest.assetId, amount: String(b.amount),
        refundTo: b.refundTo, refundType: 'ORIGIN_CHAIN',
        recipient: b.recipient, recipientType: 'DESTINATION_CHAIN',
        // WHO THE VOLUME BELONGS TO. 1Click writes this into the on-chain data and surfaces it on their
        // public analytics, so it is the handle NEAR Intents match LumosCore's traffic by. A label we
        // choose, not an id they issue. Lowercase because the field is documented lowercase-only.
        referral: 'lumoscore',
        deadline: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      };
      const r = await call(env, '/quote', { method: 'POST', body: JSON.stringify(body) });
      const out = r.body || {};
      if (out && typeof out === 'object') out.keyed = !!(env && env.ONECLICK_JWT);
      return json(out, r.status);
    }
    if (op === 'submit') {
      if (!HASH_RE.test(b.txHash || '') || !XRPL_RE.test(b.depositAddress || '')) {
        return json({ ok: 0, error: 'bad submit' }, 400);
      }
      // No memo: SIMPLE mode. Stellar's equivalent passes one; copying that here would send 1Click a
      // field it does not expect for this deposit mode.
      const r = await call(env, '/deposit/submit', { method: 'POST',
        body: JSON.stringify({ txHash: b.txHash, depositAddress: b.depositAddress }) });
      return json(r.body || { ok: 0 }, r.status);
    }
    return json({ ok: 0, error: 'unknown op' }, 400);
  } catch (e) { return json({ ok: 0, error: 'NEAR Intents unreachable' }, 502); }
}
