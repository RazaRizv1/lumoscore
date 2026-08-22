// Cloudflare Pages Function — XLM's price, its 24h move, and its price series.
//
// PRIMARY SOURCE IS HORIZON, NOT COINGECKO, and that is the whole point of this file.
//
// The first version asked CoinGecko. It works perfectly from a laptop and is the reason the change
// column on Trade emptied out in production: CoinGecko's free tier refuses datacenter egress, which is
// exactly where a Worker runs. So the endpoint answered 502, xlmChg stayed null, and every percentage
// on the pair list and in Market Movers fell back to a dash. A price source that only works from the
// developer's own connection is not a price source.
//
// Horizon has no such restriction -- two other functions here already read it from the edge -- and it
// can price XLM directly: USDC is a dollar, so the XLM/USDC trade aggregation IS XLM/USD. It is also
// the same source every other price on the site comes from, so the dashboard cannot disagree with the
// pair list about what XLM is worth.
//
// CoinGecko stays as a fallback for the case where Horizon has no recent XLM/USDC bucket.
//
//   /lxapi/xlm            -> { usd, chg24, mcap, vol24, src }
//   /lxapi/xlm?chart=7    -> { days, prices:[[ms,usd],…], src }   days: 1 | 7 | 30 | 365
//
// The series is thinned HERE to at most 180 points: a 420x104 sparkline cannot show 365 daily closes,
// let alone a day of 15-minute buckets, and the bytes are better not spent.
const H = 'https://horizon.stellar.org';
const CG = 'https://api.coingecko.com/api/v3';
const USDC = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const PAIR = 'base_asset_type=native'
  + '&counter_asset_type=credit_alphanum4&counter_asset_code=USDC&counter_asset_issuer=' + USDC;

// Horizon resolution and how many buckets to ask for, per period. Thinned to MAX_POINTS after.
const SERIES = {
  '1':   { res: 900000,   limit: 100 },   // 15 min  -> a day
  '7':   { res: 3600000,  limit: 180 },   // 1 h     -> a week
  '30':  { res: 3600000,  limit: 200 },   // 1 h     -> as far back as 200 buckets reach
  '365': { res: 86400000, limit: 200 },   // 1 day
};
const PRICE_TTL = 180;    // 3 min
const CHART_TTL = 900;    // 15 min
const MAX_POINTS = 180;

function json(body, status, ttl) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=' + ttl,
      'access-control-allow-origin': '*',
    },
  });
}
async function hz(url, ttl) {
  const r = await fetch(url, { cf: { cacheTtl: ttl, cacheEverything: true } });
  if (!r.ok) return null;
  const j = await r.json();
  return (((j || {})._embedded || {}).records) || null;
}
// Keep the first and LAST point whatever the stride: the last one is the current price, and dropping it
// makes the line end somewhere the headline figure disagrees with.
function thin(points, max) {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / max);
  const out = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]);
  const last = points[points.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

export async function onRequestGet({ request }) {
  const q = new URL(request.url).searchParams;
  const chart = q.get('chart');

  // ---- the series ----
  if (chart != null) {
    const spec = SERIES[String(chart)];
    if (!spec) return json({ error: 'bad period' }, 400, 60);
    try {
      const recs = await hz(H + '/trade_aggregations?' + PAIR
        + '&resolution=' + spec.res + '&order=desc&limit=' + spec.limit, CHART_TTL);
      if (recs && recs.length > 1) {
        // Horizon returns newest first; a chart reads left to right.
        const prices = recs.map((x) => [+x.timestamp, +x.close])
          .filter((p) => p[0] > 0 && p[1] > 0)
          .sort((a, b) => a[0] - b[0]);
        if (prices.length > 1) {
          return json({ days: +chart, prices: thin(prices, MAX_POINTS), src: 'horizon' }, 200, CHART_TTL);
        }
      }
    } catch (e) { /* fall through */ }
    try {
      const r = await fetch(CG + '/coins/stellar/market_chart?vs_currency=usd&days=' + (+chart),
        { cf: { cacheTtl: CHART_TTL, cacheEverything: true } });
      if (r.ok) {
        const j = await r.json();
        const prices = (j.prices || []).filter((p) => Array.isArray(p) && +p[1] > 0).map((p) => [+p[0], +p[1]]);
        if (prices.length > 1) {
          return json({ days: +chart, prices: thin(prices, MAX_POINTS), src: 'coingecko' }, 200, CHART_TTL);
        }
      }
    } catch (e) { /* fall through */ }
    return json({ error: 'no series' }, 502, 30);
  }

  // ---- price + 24h move ----
  let usd = 0, chg24 = null, src = 'horizon';
  try {
    // Two daily buckets: today so far, and yesterday's close. That is the same pair of numbers every
    // asset page uses for its own 24h figure, so they cannot disagree about direction.
    const d = await hz(H + '/trade_aggregations?' + PAIR
      + '&resolution=86400000&order=desc&limit=2', PRICE_TTL);
    if (d && d.length) {
      usd = +d[0].close || 0;
      if (d.length > 1 && +d[1].close > 0 && usd > 0) chg24 = ((usd - +d[1].close) / +d[1].close) * 100;
    }
  } catch (e) { /* fall through */ }

  // Market cap and 24h volume have no Horizon equivalent -- they are facts about the asset across every
  // venue, not about this ledger's order book -- so they come from CoinGecko when it answers, and are
  // simply absent when it does not. The price and the change, which the site depends on, do not.
  let mcap = null, vol24 = null;
  try {
    const r = await fetch(CG + '/simple/price?ids=stellar&vs_currencies=usd'
      + '&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true',
      { cf: { cacheTtl: PRICE_TTL, cacheEverything: true } });
    if (r.ok) {
      const s = ((await r.json()) || {}).stellar || {};
      mcap = +s.usd_market_cap || null;
      vol24 = +s.usd_24h_vol || null;
      if (!(usd > 0) && +s.usd > 0) {
        usd = +s.usd;
        chg24 = (s.usd_24h_change != null && isFinite(+s.usd_24h_change)) ? +s.usd_24h_change : null;
        src = 'coingecko';
      }
    }
  } catch (e) { /* fall through */ }

  if (!(usd > 0)) return json({ error: 'no price' }, 502, 30);
  return json({ usd: usd, chg24: chg24, mcap: mcap, vol24: vol24, src: src }, 200, PRICE_TTL);
}
