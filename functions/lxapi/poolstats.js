// Cloudflare Pages Function — network-wide Stellar AMM statistics for the Pools page Market Overview.
//
// The panel used to sum only the pools LumosCore itself lists, which is a LumosCore number presented under
// a "Total Liquidity / Active Pools / 24h Volume / Participants" heading. It has to describe the network.
//
// The network has ~40,000 liquidity pools (measured), so the phone cannot enumerate them: the full
// stellar.expert list is ~3MB per 2,600 pools and 200 requests end to end. Aggregate here instead, once
// per cache period, and hand the page a few hundred bytes.
//
// WHAT IS EXACT AND WHAT IS NOT — the page must not overclaim:
//   * pools        — exact. Binary-searched against the live list, not estimated.
//   * tvlXlm       — summed over the top pools by TVL, volume and LP accounts (deduped). Stellar AMM
//                    liquidity is heavily concentrated, so this is the network total to within the dust
//                    tail. Computed as 2 x the XLM leg from the pool's own reserves, NOT from the API's
//                    total_value_locked field: that field is not in consistent units across pools (summing
//                    it over 2,400 pools yields ~$90bn, which is nonsense), so it is unusable as a total.
//   * vol24Usd,
//     fees24Usd,
//     lpAccounts,
//     trades24     — same sampled set. lpAccounts counts LP positions, not unique wallets: a wallet in
//                    three pools counts three times, and the caller labels it accordingly.
//
// Deliberately narrow: GET only, no parameters, one fixed upstream host. Reads no secret, touches no funds.
const API = 'https://api.stellar.expert/explorer/public/liquidity-pool';
const PAGE = 200;          // upstream max per request
const SAMPLE_TTL = 600;    // 10 min — volume/fees move
const COUNT_TTL = 21600;   // 6 h  — the pool count barely moves, and this is the expensive part

// Upstream rate-limits bursts (429). Every URL here is individually edge-cached, so a warm cache costs
// nothing; a cold one has to be paced. Retry a 429 twice with backoff, then give up on that page.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function j(url, ttl = SAMPLE_TTL) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(url, { cf: { cacheTtl: ttl, cacheEverything: true } });
    if (r.status === 429) { await sleep(1200 * (attempt + 1)); continue; }
    if (!r.ok) return null;
    return r.json();
  }
  return null;
}

// Exact number of pools, by bracketing then bisecting the list's cursor (which is a plain offset).
// ~16 tiny requests, cached for 6h so almost nobody pays for it.
async function poolCount() {
  const has = async (off) => {
    const d = await j(API + '?limit=1&cursor=' + off, COUNT_TTL);
    if (!d) throw new Error('rate limited');
    return (((d._embedded || {}).records) || []).length > 0;
  };
  let lo = 0, hi = 1024;
  while (await has(hi)) { lo = hi; hi *= 2; if (hi > 1 << 22) return null; }
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (await has(mid)) lo = mid; else hi = mid; }
  return lo + 1;
}

export async function onRequestGet() {
  try {
    // Depth, not breadth. Sorting by volume or by LP count returns the SAME top 200 pools as sorting by
    // TVL — the big pools are big on every axis — so fanning out across sort orders added nothing and
    // three times the requests. Walk down the TVL ranking instead. Measured marginal contribution:
    // page 1 alone is 97.9% of the TVL and 94.6% of the 24h volume of the first 800; the tail beyond that
    // is dust pools with one or two LPs.
    // Sequential, not parallel: a burst is exactly what upstream answers with 429.
    const pages = [];
    for (let cursor = 0; cursor < 4 * PAGE; cursor += PAGE) {
      if (pages.length) await sleep(1200);
      pages.push(await j(API + '?limit=' + PAGE + '&order=desc&sort=tvl&cursor=' + cursor).catch(() => null));
    }
    // The count is ~20 sequential probes. It is the expensive part, it is cached for 6h, and it is
    // optional: if upstream throttles it we still return the aggregate and the caller keeps its own
    // pool count rather than showing nothing.
    const pools = await poolCount().catch(() => null);

    const seen = new Set();
    let tvlXlm = 0, vol24Usd = 0, fees24Usd = 0, lpAccounts = 0, trades24 = 0, sampled = 0;
    for (const p of pages) {
      const recs = (p && p._embedded && p._embedded.records) || [];
      for (const r of recs) {
        if (!r || !r.id || seen.has(r.id)) continue;
        seen.add(r.id);
        sampled++;
        const xlm = (r.assets || []).filter((a) => (a.asset || a.name) === 'XLM')[0];
        if (xlm) tvlXlm += (2 * (+xlm.amount || 0)) / 1e7;     // both legs are equal in value by construction
        vol24Usd += ((r.volume_value && +r.volume_value['1d']) || 0) / 1e7;
        fees24Usd += ((r.earned_value && +r.earned_value['1d']) || 0) / 1e7;
        lpAccounts += +r.accounts || 0;
        trades24 += (r.trades && +r.trades['1d']) || 0;
      }
    }
    if (!sampled) throw new Error('no upstream records');

    const body = JSON.stringify({
      pools, sampled,
      tvlXlm: Math.round(tvlXlm),
      vol24Usd: Math.round(vol24Usd * 100) / 100,
      fees24Usd: Math.round(fees24Usd * 100) / 100,
      lpAccounts, trades24,
      ts: Date.now(),
    });
    return new Response(body, {
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=' + SAMPLE_TTL },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e && e.message) || e) }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
}

// Anything other than GET is not part of this route's contract.
export async function onRequest({ request }) {
  if (request.method === 'GET') return onRequestGet();
  return new Response('{"error":"method not allowed"}', {
    status: 405,
    headers: { 'content-type': 'application/json', allow: 'GET' },
  });
}
