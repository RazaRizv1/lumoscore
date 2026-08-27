// Cloudflare Pages Function — Market Movers over the WHOLE Stellar DEX, not just the assets we list.
//
// The page used to rank its own eight curated majors plus our launchpad tokens, so "Market Movers" meant
// "movers among things LumosCore happens to list". It should mean the network.
//
// The whole problem with opening it up is that most of the network is noise: a percentage move is
// trivially manufactured on an asset nobody holds, and one trade against a few dollars of liquidity is a
// 900% "gainer". So candidates must earn their place before they are ranked:
//
//   * a pool against XLM holding at least $500          -- real depth, not a dust pair
//   * at least 250 holders                              -- a real base, not one wallet and a bot
//
// Both are measured, never assumed: an asset we cannot get a figure for is dropped rather than given the
// benefit of the doubt.
//
// The candidate set comes from /lxapi/pools, which already ranks every priceable pool on the network by
// real USD TVL and is already cached, so the liquidity bar costs nothing new. Prices, 24h change and
// holder counts come from /lxapi/dexassets, the same batch source the page uses.
//
// GET only, no secrets, no funds.
const POOL_PAGES = 4;        // 4 x 100 ranked pools -- everything above roughly $1k TVL
const PER = 100;
const BATCH = 16;            // dexassets' own batch size
const MAX_CAND = 128;        // ceiling on how many assets we price, so a cold build stays bounded
const MIN_TVL = 500;         // $ of liquidity against XLM
const MIN_HOLDERS = 250;
const TTL = 600;
const KEY = new Request('https://lumoscore.internal/lxapi/movers', { method: 'GET' });

async function j(origin, path) {
  try {
    const r = await fetch(origin + path, { cf: { cacheTtl: TTL, cacheEverything: true } });
    if (!r.ok) return null;
    return await r.json();
  } catch (_) { return null; }
}

export async function onRequestGet(ctx) {
  const origin = new URL(ctx.request.url).origin;
  const cache = caches.default;
  try {
    const hit = await cache.match(KEY);
    if (hit) return hit;

    // 1. Candidates: assets with a deep enough XLM pool. The ranking is TVL-descending, so once a page
    //    drops below the bar every later page is below it too and the walk can stop.
    const cand = new Map();
    for (let p = 1; p <= POOL_PAGES; p++) {
      const d = await j(origin, '/lxapi/pools?per=' + PER + '&page=' + p);
      const rows = (d && d.rows) || [];
      if (!rows.length) break;
      let anyAbove = false;
      for (const row of rows) {
        if (row.tvl == null || row.tvl < MIN_TVL) continue;
        anyAbove = true;
        const legs = [row.a, row.b];
        const hasXlm = legs.some((x) => x && x.code === 'XLM' && !x.issuer);
        if (!hasXlm) continue;                       // "$500+ liquidity WITH NATIVE", as specified
        for (const x of legs) {
          if (!x || !x.issuer) continue;             // skip the XLM side itself
          const k = x.code + '-' + x.issuer;
          if (!cand.has(k) && cand.size < MAX_CAND) cand.set(k, { code: x.code, issuer: x.issuer, tvl: row.tvl });
        }
      }
      if (!anyAbove) break;
      if (cand.size >= MAX_CAND) break;
    }
    if (!cand.size) throw new Error('no candidates');

    // 2. Price them, and read the holder count from the same answer.
    const keys = [...cand.keys()];
    const out = [];
    for (let i = 0; i < keys.length; i += BATCH) {
      const grp = keys.slice(i, i + BATCH);
      const d = await j(origin, '/lxapi/dexassets?a=' + encodeURIComponent(grp.join(',')));
      if (!d || !d.a) continue;
      for (const k of grp) {
        const v = d.a[k], c = cand.get(k);
        if (!v || !c) continue;
        const holders = v.ho == null ? null : +v.ho;
        if (holders == null || holders < MIN_HOLDERS) continue;    // unmeasurable is not a pass
        out.push({
          code: c.code, issuer: c.issuer, tvlUsd: c.tvl, holders,
          px: v.px == null ? null : +v.px,
          chg: v.chg == null ? null : +v.chg,
          vol: v.vol == null ? null : +v.vol,
        });
      }
    }

    const withChg = out.filter((a) => a.chg != null);
    const gainers = withChg.filter((a) => a.chg > 0).sort((a, b) => b.chg - a.chg).slice(0, 4);
    const losers = withChg.filter((a) => a.chg < 0).sort((a, b) => a.chg - b.chg).slice(0, 4);
    const volume = out.filter((a) => a.vol != null).sort((a, b) => b.vol - a.vol).slice(0, 4);

    const body = JSON.stringify({
      gainers, losers, volume,
      candidates: cand.size, qualified: out.length,
      minTvlUsd: MIN_TVL, minHolders: MIN_HOLDERS, ts: Date.now(),
    });
    const res = new Response(body, {
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=' + TTL },
    });
    try { ctx && ctx.waitUntil && ctx.waitUntil(cache.put(KEY, res.clone())); } catch (_) {}
    return res;
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e && e.message) || e) }), {
      status: 502, headers: { 'content-type': 'application/json' },
    });
  }
}

export async function onRequest(ctx) {
  if (ctx.request.method === 'GET') return onRequestGet(ctx);
  return new Response('{"error":"method not allowed"}', {
    status: 405, headers: { 'content-type': 'application/json', allow: 'GET' },
  });
}
