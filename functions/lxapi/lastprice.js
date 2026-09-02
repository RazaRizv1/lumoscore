// Cloudflare Pages Function — the last traded price of one asset against XLM, fresh.
//
// WHY THIS EXISTS, separately from candles.js. The asset page's headline price came from the newest
// DAILY trade_aggregations bucket, served through candles.js at TTL=300 and sent as
// "cache-control: public, max-age=300" — so it was cached in the browser, at the edge, AND in the
// upstream subrequest. Reported 2026-09-02: LUMOS moved from ~0.00028 to ~0.00063 XLM within a few
// minutes and the page went on showing 0.00028. Measured at the time: the page and a plain fetch both
// returned 0.0002804 while Horizon's own /trades said 0.00063415; cache-busting the same candles URL
// returned the correct figure immediately. Nothing was wrong with the data — it was minutes old.
//
// candles.js CANNOT simply drop its TTL. /trade_aggregations is the one metered Horizon endpoint (100
// per 5 minutes, its own allowance, and its 429 carries no CORS header so the browser reads it as
// "Failed to fetch") — that rate limit is the entire reason candles.js exists.
//
// /trades is NOT metered. candles.js's own header records the measurement: in the same second from the
// same IP, /assets, /liquidity_pools, /order_book and /trades all answered 200 and sent no
// X-RateLimit headers at all, while /trade_aggregations answered 429 with remaining: 0. So the last
// price can come from /trades at a short TTL without touching the budget the chart depends on.
//
// TTL is 20s rather than 0: it still collapses a burst of viewers into one upstream hit, and 20s of
// staleness on a price is not what anybody noticed. Sent as s-maxage so the EDGE caches it and the
// browser does not — a browser that pins its own copy is exactly how the original bug survived a
// reload.
//
// Narrow by construction: GET only, one asset matching CODE-GISSUER, one record, Horizon the only host
// contacted, every upstream parameter rebuilt here from validated pieces. Reads no secret and touches
// no funds.
const ASSET_RE = /^[A-Za-z0-9]{1,12}-G[A-Z2-7]{55}$/;

const H = 'https://horizon.stellar.org';
const TTL = 20;
const TTL_ERR = 10;
const TIMEOUT_MS = 6000;

function json(body, status, ttl) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      // s-maxage, not max-age: the edge may hold this, the browser may not.
      'cache-control': 'public, max-age=0, s-maxage=' + ttl,
      'access-control-allow-origin': '*',
    },
  });
}

const err = (message, status) => json({ error: message }, status, TTL_ERR);

export async function onRequestGet({ request }) {
  const q = new URL(request.url).searchParams;

  const a = (q.get('a') || '').trim();
  if (!ASSET_RE.test(a)) return err('bad asset', 400);
  const dash = a.lastIndexOf('-');
  const code = a.slice(0, dash);
  const issuer = a.slice(dash + 1);
  const type = code.length <= 4 ? 'credit_alphanum4' : 'credit_alphanum12';

  const url = H + '/trades'
    + '?base_asset_type=' + type
    + '&base_asset_code=' + encodeURIComponent(code)
    + '&base_asset_issuer=' + issuer
    + '&counter_asset_type=native'
    + '&order=desc&limit=1';

  let r;
  try {
    r = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cf: { cacheTtl: TTL, cacheEverything: true },
    });
  } catch (e) {
    return json({ error: 'upstream unreachable' }, 502, TTL_ERR);
  }
  if (!r.ok) return json({ error: 'upstream ' + r.status }, 502, TTL_ERR);

  let d;
  try { d = await r.json(); } catch (e) { return json({ error: 'bad upstream body' }, 502, TTL_ERR); }

  const rec = d && d._embedded && d._embedded.records && d._embedded.records[0];
  // An asset that has never traded against XLM is not an error -- it is a fact, and the page has to be
  // able to tell the two apart. 200 with a null price, briefly cached.
  if (!rec) return json({ price: null, ts: null }, 200, TTL_ERR);

  // price is a rational {n, d}. Computing it here rather than shipping the pair keeps the client from
  // having to know Horizon's shape for one number, and the division is the whole of the CPU cost.
  const n = +(rec.price && rec.price.n);
  const den = +(rec.price && rec.price.d);
  if (!(n > 0) || !(den > 0)) return json({ price: null, ts: null }, 200, TTL_ERR);

  return json({ price: n / den, ts: rec.ledger_close_time || null }, 200, TTL);
}
