// Cloudflare Pages Function — network-wide Stellar AMM statistics for the Pools page Market Overview
// and the Dashboard's Pools box.
//
// WHY THIS WAS REWRITTEN (2026-11-10). It used to aggregate stellar.expert's /liquidity-pool list. That
// endpoint began answering 402 when stellar.expert moved to paid plans, so every call fell into the
// "incomplete sample" guard below and the route returned 502 — which is why the Dashboard's Pools box
// showed a dash in all three figures (RAZA: "On dashboard, Pool stats are not showing up"). It is the
// same break that took the stellar.toml creator check out; see stellar-expert-api-went-paid.
//
// It now reads the ranking /lxapi/pools has already built from HORIZON and holds in KV. That ranking is
// the ledger's own reserves, priced in USD, for every pool with an XLM or a Circle USDC leg. So this
// endpoint makes NO upstream request at all: one KV read, sum, done. It cannot be rate-limited, it
// cannot be throttled, and it cannot disagree with the Pools page, because it is the same numbers.
//
// WHAT IS EXACT AND WHAT IS NOT — the page must not overclaim:
//   * pools        — the ranked count plus the measured count of pools that cannot be priced at all.
//                    Both figures are the ones the Pools page itself states.
//   * tvlUsd       — EXACT over the ranked set, summed from the ledger. A pool's two legs are equal in
//                    value by construction, so TVL is 2x the priceable leg; that is not an estimate.
//                    Measured 2026-11-10: $7,957,282 over 11,191 pools.
//   * tvlXlm       — the same number expressed in XLM, kept because existing callers read that field
//                    and multiply it back by the XLM rate. The round trip is exact.
//   * vol24Usd,
//     fees24Usd    — summed over the pools the volume sweep reaches, which is the top VOL_TOP by TVL,
//                    not all 11,191. Reported alongside `volPools` and `volOfTvl` so a caller can say
//                    what it covers. Measured the same day: the top 100 hold 96.40% of the ranked TVL,
//                    and an AMM cannot trade volume it has no depth for, so this tracks the network
//                    closely — but it is a floor, not a total, and is labelled as one here.
//   * lpAccounts   — LP POSITIONS over the ranked set, not unique wallets: a wallet in three pools
//                    counts three times, and the caller labels it accordingly.
//
// Deliberately narrow: GET only, no parameters, no upstream host. Reads no secret, touches no funds.

// Written by functions/lxapi/pools.js. Read-only here — this endpoint never builds or repairs the
// ranking, so a cold KV simply means "not built yet" and the caller keeps its own figures.
const K = {
  meta: 'pools:meta:v2',
  full: 'pools:full:v2',
  vol: 'pools:vol:v3',   // v3 since pools.js retired its $0 figures (2026-11-18); v2 is no longer written
};
// Must match pools.js. It is a measured constant there — pools with neither an XLM nor a Circle USDC
// leg, which have no path to a USD price — and the two surfaces have to state the same total.
const UNPRICEABLE = 28882;
const TTL = 600;   // 10 min. The ranking itself only reruns every 15.

// Same store as pools.js, same keys, same fallback: KV when the binding is present, the per-colo Cache
// API when it is not. Duplicated rather than imported because Pages Functions are separate modules and
// this one must not drag in the ranking build.
// MUST NAME THE SAME BINDINGS AS pools.js (2026-11-19). pools.js moved to CONTENT_KV on 11-18 -- LUMOS_KV was never
// created -- and this one kept looking for LUMOS_KV/POOLS_KV only, found neither, fell back to a per-colo cache that
// nothing writes any more, and answered 502 "ranking not built" to every dashboard (health report 2026-11-19).
function mkStore(env) {
  const kv = env && (env.LUMOS_KV || env.POOLS_KV || env.CONTENT_KV);
  if (kv) {
    return {
      async get(k) { try { return await kv.get(k, 'json'); } catch (_) { return null; } },
    };
  }
  const cache = caches.default;
  const req = (k) => new Request('https://lumoscore.internal/' + encodeURIComponent(k), { method: 'GET' });
  return {
    async get(k) { try { const r = await cache.match(req(k)); return r ? await r.json() : null; } catch (_) { return null; } },
  };
}

export async function onRequestGet(ctx) {
  // Cache the RESPONSE. The sum itself is cheap, but parsing the full ranked list out of KV is not
  // free, and this route is hit by every dashboard and every pools page.
  const key = new Request('https://lumoscore.internal/lxapi/poolstats', { method: 'GET' });
  const cache = caches.default;
  const hit = await cache.match(key);
  if (hit) return hit;

  try {
    const store = mkStore(ctx && ctx.env);
    const [meta, full, vol] = await Promise.all([
      store.get(K.meta),
      store.get(K.full),
      store.get(K.vol),
    ]);
    const rows = (full && full.rows) || [];
    const px = +((full && full.px) || (meta && meta.px) || 0);
    // Nothing built yet. Not an error worth caching, and not a zero: a caller told "0 pools" would
    // print it. Fail, exactly as before, and let the page keep its own clearly-labelled figures.
    if (!rows.length || !(px > 0)) throw new Error('ranking not built');

    const volMap = (vol && vol.map) || {};
    let tvlUsd = 0, lpAccounts = 0, vol24Usd = 0, fees24Usd = 0, volPools = 0, volTvl = 0;
    for (const r of rows) {
      if (!r) continue;
      const t = +r.tvl || 0;
      tvlUsd += t;
      lpAccounts += +r.members || 0;
      const v = volMap[r.id];
      if (v == null) continue;
      volPools++;
      volTvl += t;
      vol24Usd += +v || 0;
      // One figure drives both columns on the Pools page, and it drives them here too: a pool's 24h
      // fees are its 24h volume times its own fee rate. Horizon publishes no fee total.
      fees24Usd += (+v || 0) * ((+r.fee || 0) / 100);
    }

    const body = JSON.stringify({
      pools: rows.length + UNPRICEABLE,
      ranked: rows.length,
      unpriceable: UNPRICEABLE,
      sampled: rows.length,
      tvlUsd: Math.round(tvlUsd * 100) / 100,
      tvlXlm: Math.round(tvlUsd / px),
      vol24Usd: Math.round(vol24Usd * 100) / 100,
      fees24Usd: Math.round(fees24Usd * 100) / 100,
      lpAccounts,
      // What the volume figure actually covers, so a caller can state it rather than imply "all pools".
      volPools,
      volOfTvl: tvlUsd > 0 ? Math.round((volTvl / tvlUsd) * 1000) / 10 : 0,
      px,
      ts: Date.now(),
    });
    const res = new Response(body, {
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=' + TTL,
      },
    });
    try { ctx && ctx.waitUntil && ctx.waitUntil(cache.put(key, res.clone())); } catch (_) {}
    return res;
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e && e.message) || e) }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
}

// Anything other than GET is not part of this route's contract.
export async function onRequest(ctx) {
  const request = ctx.request;
  if (request.method === 'GET') return onRequestGet(ctx);
  return new Response('{"error":"method not allowed"}', {
    status: 405,
    headers: { 'content-type': 'application/json', allow: 'GET' },
  });
}
