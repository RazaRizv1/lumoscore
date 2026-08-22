// Cloudflare Pages Function — XLM's price, 24h move, and its price series, from one cached place.
//
// WHY. The dashboard's top panel was measured taking 7 seconds to show a price and never drawing its
// chart at all. Neither is a rendering problem: both numbers came from CoinGecko's free tier, called
// once per visitor per page, and that tier answers a handful of requests a minute per IP before it
// starts refusing. Every visitor was spending the same tiny budget on the same public number.
//
// Asked once here instead, and cached, so the site's whole traffic costs what one visitor used to.
// Everyone gets the answer at edge speed whether or not CoinGecko is in the mood.
//
//   /lxapi/xlm            -> { usd, chg24, mcap, vol24 }
//   /lxapi/xlm?chart=7    -> { days, prices:[[ms,usd],…] }   days: 1 | 7 | 30 | 365
//
// The series is thinned HERE, to at most 180 points: a year of daily closes is 365 points and a day of
// five-minute ticks is 288, and a 420x104 sparkline cannot show either. Thinning at the edge means the
// bytes are not spent and the phone does not do the arithmetic.
//
// Deliberately narrow: GET only, one fixed upstream host, one enumerated parameter. No secret, no funds.
const CG = 'https://api.coingecko.com/api/v3';
const DAYS = { '1': 1, '7': 7, '30': 30, '365': 365 };
const PRICE_TTL = 120;    // 2 min — a live price, but not a per-request one
const CHART_TTL = 900;    // 15 min — the shape of a day does not change faster than that
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

// Keep the first and LAST point whatever the stride: the last one is the current price, and dropping
// it makes the line end somewhere the headline figure disagrees with.
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

  if (chart != null) {
    const d = DAYS[String(chart)];
    if (!d) return json({ error: 'bad period' }, 400, 60);
    try {
      const r = await fetch(CG + '/coins/stellar/market_chart?vs_currency=usd&days=' + d,
        { cf: { cacheTtl: CHART_TTL, cacheEverything: true } });
      if (!r.ok) return json({ error: 'upstream ' + r.status }, 502, 30);
      const j = await r.json();
      const prices = (j.prices || [])
        .filter((p) => Array.isArray(p) && +p[1] > 0)
        .map((p) => [+p[0], +p[1]]);
      if (!prices.length) return json({ error: 'no series' }, 502, 30);
      return json({ days: d, prices: thin(prices, MAX_POINTS) }, 200, CHART_TTL);
    } catch (e) {
      return json({ error: 'upstream unreachable' }, 502, 30);
    }
  }

  try {
    const r = await fetch(CG + '/simple/price?ids=stellar&vs_currencies=usd'
      + '&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true',
      { cf: { cacheTtl: PRICE_TTL, cacheEverything: true } });
    if (!r.ok) return json({ error: 'upstream ' + r.status }, 502, 30);
    const s = ((await r.json()) || {}).stellar || {};
    if (!(+s.usd > 0)) return json({ error: 'no price' }, 502, 30);
    return json({
      usd: +s.usd,
      chg24: (s.usd_24h_change != null && isFinite(+s.usd_24h_change)) ? +s.usd_24h_change : null,
      mcap: +s.usd_market_cap || null,
      vol24: +s.usd_24h_vol || null,
    }, 200, PRICE_TTL);
  } catch (e) {
    return json({ error: 'upstream unreachable' }, 502, 30);
  }
}
