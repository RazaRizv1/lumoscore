// Cloudflare Pages Function — the bridge's THORChain route.
//
// The third route, and the only one of the three that COMPETES rather than covers new ground.
// NEAR Intents reaches 35 chains; Axelar carries the seventeen ITS assets and is the only way to XRPL
// EVM. THORChain overlaps NEAR Intents on ten of its eleven chains and adds exactly one nobody else
// serves (Cosmos Hub). On reach alone it would not be worth shipping.
//
// What it is worth shipping FOR is that it is independent infrastructure with its own liquidity, so a
// destination both routes serve can be PRICED BY BOTH and the better one taken. That is the job this
// endpoint exists to do, and it is why the client races the two quotes instead of preferring one.
//
// WHY A PROXY. thornode's public endpoints refuse requests from this project's shell and from a
// browser (403 / no CORS). Cloudflare's network is not blocked, and the answer caches at the edge so
// a keystroke in the amount field is not an upstream request.
//
// THORCHAIN BUILDS THE MEMO ITSELF. Unlike Axelar, where a hand-built memo that is malformed loses the
// transfer outright, /quote/swap returns the exact `memo` and the `inbound_address` to send to. That
// removes a whole class of mistake from this route: the page never composes a memo, it forwards one.
// The inbound address ROTATES (THORChain churns vaults), which is the reason it must come from the
// quote each time and must never be remembered between transfers.
// Measured 2026-09-29, and every one of these failed differently, which is why the list is long and
// why node() reports each answer rather than one word:
//   thornode.ninerealms.com          HTTP 530 / 1016  (Cloudflare origin DNS error)
//   thornode.thorswap.net            HTTP 403 "Just a moment..."  (bot challenge an automated
//                                    request cannot pass -- the same wall Bithomp puts up)
//   thornode.thorchain.liquify.com   HTTP 526  (invalid certificate)
// A THORChain node is a community-run box with no SLA. Several, tried in turn, is the only shape that
// survives that.
const NODES = [
  'https://gateway.liquify.com/chain/thorchain_api',
  'https://thornode.ninerealms.com',
  'https://thornode.thorchain.info',
  'https://thornode-v2.ninerealms.com',
  'https://thornode.thorswap.net',
];
const TIMEOUT_MS = 12000;
// THORChain denominates every asset in 1e8 units on the wire regardless of its native precision, so
// XRP's six decimals still arrive here as eight. Converting is the caller's job; this is the constant
// that says why.
const THOR_E8 = 100000000;

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

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: {
    'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,OPTIONS',
    'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' } });
}

// SEVERAL NODES, TRIED IN TURN. A THORChain node is a community-run box, not a service with an SLA --
// one being down or rate-limiting is ordinary, and a bridge that reports "unavailable" because the
// first name in a list was busy is reporting its own fragility as the network's.
// Every node's own answer is kept and reported when they all fail. A single "unreachable" string
// hides the difference between DNS that does not resolve, a 403 that wants a header, and a 429 that
// wants patience -- and those need three different fixes. This costs nothing and is the first thing
// anyone debugging this will want.
const TRIED = [];
async function node(path) {
  TRIED.length = 0;
  for (const base of NODES) {
    const host = base.replace(/^https?:\/\//, '');
    try {
      const r = await fetch(base + path, {
        headers: { accept: 'application/json', 'x-client-id': 'lumoscore' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!r.ok) {
        const body = (await r.text().catch(() => '')).slice(0, 400);
        // A 4xx CARRYING JSON IS AN ANSWER, NOT A DEAD NODE. THORChain reports the things a user can
        // actually fix this way -- "amount less than dust threshold", "bad destination address" --
        // and the first version of this treated every non-2xx as a node failure, walked the whole
        // list, and reported "THORChain unreachable". The reason was in the first response and got
        // thrown away; asking four more nodes could only ever produce the same refusal.
        if (r.status >= 400 && r.status < 500) {
          let msg = '';
          try { const p = JSON.parse(body); msg = String(p.message || p.error || ''); } catch (e) { msg = ''; }
          if (msg) return { __refusal: msg };
        }
        TRIED.push(host + ': HTTP ' + r.status + (body ? (' ' + body.slice(0, 120).replace(/\s+/g, ' ')) : ''));
        continue;
      }
      const j = await r.json();
      if (j && typeof j === 'object') return j;
      TRIED.push(host + ': not json');
    } catch (e) {
      TRIED.push(host + ': ' + String((e && (e.name + (e.message ? (' ' + e.message) : ''))) || 'fetch failed').slice(0, 120));
    }
  }
  throw new Error('no node answered');
}

let POOLS = null, POOLS_AT = 0;
async function pools() {
  if (POOLS && Date.now() - POOLS_AT < 300000) return POOLS;
  const j = await node('/thorchain/pools');
  const list = Array.isArray(j) ? j : [];
  // Only pools that are AVAILABLE can be swapped through. A staged pool exists, has depth, and will
  // refuse the trade -- offering one is offering a route that is not there.
  POOLS = list
    .filter((p) => p && p.status === 'Available' && typeof p.asset === 'string')
    .map((p) => ({ asset: p.asset, chain: String(p.asset).split('.')[0],
      symbol: String(p.asset).split('.')[1] || '', depth: p.balance_rune || '0' }));
  POOLS_AT = Date.now();
  return POOLS;
}

// WHICH CHAINS ARE PAUSED RIGHT NOW. A pool can be `status: "Available"` and still refuse every swap:
// trading is halted per chain through mimir, and the pool list says nothing about it. Measured
// 2026-10-23 -- SOL.SOL, GAIA.ATOM and ZEC.ZEC were all Available, and every quote to them came back
// "failed to simulate swap: ... trading is halted, can't process swap", while BTC quoted fine.
//
// The bridge was therefore OFFERING those destinations by THORChain, and only discovered the halt when
// a quote ran -- which, on this route, needs a destination address, because THORChain builds the memo.
// So the route looked fine, was chosen, and withdrew itself the moment an address was pasted. The halt
// is knowable before any of that, from one call, and it belongs beside the pools.
//
// /thorchain/inbound_addresses carries all three forms in one read: `halted` (the chain's own
// observation is paused), `chain_trading_paused` and `global_trading_paused`.
//
// A FAILED READ IS NOT "NOTHING IS HALTED". The key is omitted entirely when this call fails, never
// sent as an empty list -- an empty list means "asked, and none are", and the client refuses a route
// only on that. One value must not mean both.
async function halts() {
  const j = await node('/thorchain/inbound_addresses');
  if (!Array.isArray(j)) throw new Error('inbound_addresses: not a list');
  const out = [];
  for (const c of j) {
    if (!c || typeof c.chain !== 'string') continue;
    if (c.halted || c.chain_trading_paused || c.global_trading_paused) out.push(c.chain);
  }
  return out;
}

const ASSET_RE = /^[A-Za-z0-9]{2,12}\.[A-Za-z0-9/\-_.]{1,64}$/;
const AMT_RE = /^[0-9]{1,20}$/;

// STORED BY THE CACHE API, not by the s-maxage header — see the long note in xrplaxelar.js. A Pages
// Function response answers `cf-cache-status: DYNAMIC` however it is labelled, so this TTL had never
// been honoured and every visitor paid for the upstream read. Per-colo, and only a 200 is stored.
async function cachedPools(request, waitUntil) {
  const cache = caches.default;
  const key = new Request(new URL(request.url).origin + '/lxapi/thorchain?op=pools');
  const hit = await cache.match(key);
  if (hit) return hit;
  const list = await pools();
  // Both reads together, and the halt one is allowed to fail on its own: pools is what this endpoint
  // exists for, and losing the route entirely because a second call timed out would be a worse answer
  // than the one the client already copes with.
  const halted = await halts().catch(() => null);
  // XRP has to be swappable in its own right or this route cannot start from here at all -- and a
  // halted XRP chain means exactly that, whatever the pool says, so it folds into the same flag the
  // client already gates the whole route on.
  const xrp = list.some((p) => p.asset === 'XRP.XRP')
    && !(halted && halted.indexOf('XRP') >= 0);
  const body = { ok: 1, e8: THOR_E8, xrpTradeable: xrp, pools: list };
  if (halted) body.halted = halted;
  const res = json(body, 200, 300);
  try { const put = cache.put(key, res.clone()); if (waitUntil) waitUntil(put); else await put; } catch (e) {}
  return res;
}

export async function onRequestGet({ request, waitUntil }) {
  const q = new URL(request.url).searchParams;
  const op = q.get('op');
  try {
    if (op === 'pools') return await cachedPools(request, waitUntil);
    if (op === 'quote') {
      const to = String(q.get('to') || '');
      const amount = String(q.get('amount') || '');
      const dest = String(q.get('destination') || '');
      if (!ASSET_RE.test(to)) return json({ ok: 0, error: 'bad destination asset' }, 400);
      if (!AMT_RE.test(amount)) return json({ ok: 0, error: 'bad amount' }, 400);
      if (!dest || dest.length > 128 || /[\s<>"']/.test(dest)) return json({ ok: 0, error: 'bad destination address' }, 400);
      const list = await pools();
      if (!list.some((p) => p.asset === to)) return json({ ok: 0, error: to + ' is not an available pool' }, 400);

      const path = '/thorchain/quote/swap?from_asset=XRP.XRP&to_asset=' + encodeURIComponent(to)
        + '&amount=' + encodeURIComponent(amount) + '&destination=' + encodeURIComponent(dest);
      const j = await node(path);
      // THORChain reports a refusal as a 200 with an `error` field as often as it does with a status
      // code, so the body is what decides -- not the transport. __refusal carries the 4xx case.
      if (j.__refusal) return json({ ok: 0, error: String(j.__refusal).slice(0, 200) }, 400);
      if (j.error) return json({ ok: 0, error: String(j.error).slice(0, 200) }, 400);
      if (!j.inbound_address || !j.memo || !j.expected_amount_out) {
        return json({ ok: 0, error: 'incomplete quote' }, 502);
      }
      return json({ ok: 1,
        inbound: j.inbound_address,
        memo: j.memo,
        expected: j.expected_amount_out,
        minAmount: j.recommended_min_amount_in || null,
        seconds: j.total_swap_seconds != null ? j.total_swap_seconds : null,
        slippageBps: j.fees && j.fees.slippage_bps != null ? j.fees.slippage_bps : null,
        outboundFee: j.fees && j.fees.outbound || null,
        expiry: j.expiry || null,
        router: j.router || null,
        e8: THOR_E8 }, 200, 15);
    }
    return json({ ok: 0, error: 'unknown op' }, 400);
  } catch (e) {
    return json({ ok: 0, error: 'THORChain unreachable', tried: TRIED.slice() }, 502);
  }
}
