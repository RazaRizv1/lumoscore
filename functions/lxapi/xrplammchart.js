// GET /lxapi/xrplammchart?acct=<AMM account>&p=1d|1w|1m|3m|1y|all
//
// A pool's liquidity over time, for the Pool Activity chart on the pool page. RAZA 2026-09-15: "In
// Pools-Pool chart hover, its supposed to show TVL instead of price." lumoscore.com charts the pool's own
// value there; the XRP Ledger keeps no such history, but xrpl.to records it per pool — /amm/liquidity-chart,
// keyed by the AMM account — with the day's volume, fees and trade count on the same point.
//
// Returned as compact points: [timeMs, tvlXrp, volumeXrp, feesXrp, trades], oldest first.
//
// THE FILTER IS VERIFIED, not trusted. xrpl.to has ignored a pool parameter before and answered 200 with a
// different pool (see the note in xrplpools.js); this response echoes `ammAccount`, and a mismatch is refused
// rather than charted under the wrong name.
//
// Proxied rather than fetched from the browser: the API key must stay server-side, and the anonymous tier's
// per-IP daily limit would be spent in a few page views.
const UP = 'https://api.xrpl.to/api';
const TTL = 300;
const PERIODS = { '1d': 1, '1w': 1, '1m': 1, '3m': 1, '1y': 1, all: 1 };
const ADDR = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;

const json = (body, secs) => new Response(JSON.stringify(body), {
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=' + secs,
    'access-control-allow-origin': '*',
  },
});

const num = (v) => { const n = Number(v); return isFinite(n) ? n : null; };

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const acct = (url.searchParams.get('acct') || '').trim();
  const p = (url.searchParams.get('p') || '1m').trim().toLowerCase();
  if (!ADDR.test(acct)) return json({ ok: false, error: 'bad account', pts: [] }, 60);
  if (!PERIODS[p]) return json({ ok: false, error: 'bad period', pts: [] }, 60);

  const cache = caches.default;
  const key = new Request(url.origin + url.pathname + '?v=1&acct=' + acct + '&p=' + p, request);
  const hit = await cache.match(key);
  if (hit) return hit;

  let out;
  try {
    const headers = { accept: 'application/json', 'user-agent': 'LumosCore/1.0 (+https://lumoscore.com)' };
    if (env && env.XRPLTO_API_KEY) headers['x-api-key'] = env.XRPLTO_API_KEY;
    const r = await fetch(UP + '/amm/liquidity-chart?ammAccount=' + acct + '&period=' + p, { headers });
    if (!r.ok) throw new Error('upstream ' + r.status);
    const j = await r.json();
    if (j && j.ammAccount && j.ammAccount !== acct) throw new Error('upstream answered for another pool');

    // Daily points carry midnight in `date` and 0 in `hour`; hourly points (1d) carry the hour separately,
    // while the longest range already folds it into `date`. Adding `hour` only to a midnight date handles all
    // three without double-counting.
    const pts = ((j && j.data) || []).map((d) => {
      let t = Date.parse(d.date);
      const h = num(d.hour) || 0;
      if (isFinite(t) && new Date(t).getUTCHours() === 0 && h > 0) t += h * 3600000;
      return [t, num(d.tvl), num(d.volume), num(d.fees), num(d.trades)];
    }).filter((x) => isFinite(x[0]) && x[1] != null && x[1] >= 0).sort((a, b) => a[0] - b[0]);

    out = { ok: true, acct, p, unit: 'XRP', count: pts.length, pts, src: 'xrpl.to' };
  } catch (e) {
    return json({ ok: false, error: String((e && e.message) || e), pts: [] }, 30);
  }

  const res = json(out, TTL);
  context.waitUntil(cache.put(key, res.clone()));
  return res;
}
