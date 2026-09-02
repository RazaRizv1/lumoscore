// Cloudflare Pages Function — the last traded price of SEVERAL assets against XLM, fresh.
//
// WHY THIS EXISTS, separately from dexassets.js. Trade-main takes every figure from dexassets, whose
// price is the newest DAILY trade_aggregations bar and which is cached for 300s. Reported 2026-09-03:
// Trade-main showed LUMOS at 0.0006338 XLM while the asset page showed 0.00040625 -- the asset page was
// right, and the difference is not a bug in either number, it is five minutes plus however long the daily
// bar lags. The same staleness was fixed on the asset page in lastprice.js; this is that fix for the
// table, which needs many assets at once.
//
// dexassets.js CANNOT simply drop its TTL. /trade_aggregations is the one metered Horizon endpoint (100
// per 5 minutes, and its 429 carries no CORS header so the browser reads it as "Failed to fetch"); the
// whole roster costs ~62 of those, which is exactly why that TTL is 300. /trades is NOT metered -- see
// the measurement recorded in candles.js -- so the price can be refreshed on its own short TTL without
// touching the budget the rest of the table depends on.
//
// Split this way, each endpoint keeps the cadence its data actually needs: volume, range, holders and
// supply barely move in five minutes; the price does.
//
// TTL is 20s rather than 0 so a burst of viewers collapses into one upstream hit, and it is sent as
// s-maxage so the EDGE holds it and the browser does not -- a browser pinning its own copy is how the
// original staleness survived a reload.
//
// Narrow by construction: GET only, every asset matched against CODE-GISSUER, capped at MAX_ASSETS,
// Horizon the only host contacted, every upstream parameter rebuilt here from validated pieces. Reads no
// secret and touches no funds.
const ASSET_RE = /^[A-Za-z0-9]{1,12}-G[A-Z2-7]{55}$/;

const H = 'https://horizon.stellar.org';
const TTL = 20;
const TTL_ERR = 10;
const TIMEOUT_MS = 6000;
// The client asks in groups of 16 (BATCH in _dexdata.js). 20 leaves headroom without approaching the
// per-request subrequest limit, which is what a big roster would otherwise walk into.
const MAX_ASSETS = 20;

function json(body, status, ttl) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=0, s-maxage=' + ttl,
      'access-control-allow-origin': '*',
    },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
    },
  });
}

async function priceOf(id) {
  const dash = id.lastIndexOf('-');
  const code = id.slice(0, dash);
  const issuer = id.slice(dash + 1);
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
  } catch (e) { return null; }
  if (!r.ok) return null;

  let d;
  try { d = await r.json(); } catch (e) { return null; }

  const rec = d && d._embedded && d._embedded.records && d._embedded.records[0];
  if (!rec) return null;                       // never traded against XLM -- a fact, not an error
  const n = +(rec.price && rec.price.n);
  const den = +(rec.price && rec.price.d);
  if (!(n > 0) || !(den > 0)) return null;
  return n / den;
}

export async function onRequestGet({ request }) {
  const q = new URL(request.url).searchParams;

  const raw = (q.get('a') || '').trim();
  if (!raw) return json({ error: 'no assets' }, 400, TTL_ERR);

  const ids = [];
  for (const part of raw.split(',')) {
    const v = part.trim();
    if (!ASSET_RE.test(v)) continue;
    if (ids.indexOf(v) < 0) ids.push(v);
    if (ids.length >= MAX_ASSETS) break;
  }
  if (!ids.length) return json({ error: 'no valid assets' }, 400, TTL_ERR);

  // One asset failing must not take the batch with it: a null price is omitted and the caller keeps
  // whatever dexassets gave it for that row.
  const prices = await Promise.all(ids.map((id) => priceOf(id).catch(() => null)));

  const p = {};
  ids.forEach((id, i) => { if (prices[i] > 0) p[id] = prices[i]; });

  return json({ ok: 1, p }, 200, TTL);
}
