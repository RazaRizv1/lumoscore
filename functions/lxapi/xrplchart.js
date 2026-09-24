// XRP/USD price history for the wallet hero chart.
//
// WHAT THIS CHART IS, because the name invites the wrong assumption: it is the NATIVE ASSET'S PRICE
// over time, not the account's portfolio value. That is exactly what lumoscore.com plots in the same
// place — its wallet fetches CoinGecko's `coins/stellar/market_chart` and draws XLM/USD, with a
// Binance XLMUSDT fallback. Its own source carries the reason, in a comment beside the hidden delta
// row: "no portfolio history feed". Real portfolio history needs a balance series, which neither
// ledger publishes and which would have to be rebuilt by replaying every transaction.
//
// So this is the Stellar behaviour with `stellar` -> `ripple` and `XLMUSDT` -> `XRPUSDT`.
//
// SERVED FROM THE EDGE rather than fetched in the browser, which is the one deliberate difference
// from Stellar. CoinGecko's free tier meters by IP; a browser-direct call spends every visitor's own
// allowance and 429s in bursts. One cached fetch here serves everyone, and it is the same reason the
// xrpl.to endpoints in this folder exist at all.

const CG = 'https://api.coingecko.com/api/v3/coins/ripple/market_chart';
const CB = 'https://api.exchange.coinbase.com/products/XRP-USD/candles';
const BS = 'https://www.bitstamp.net/api/v2/ohlc/xrpusd/';

// Timeframe -> CoinGecko day count, Binance (interval, limit), and how long a response stays fresh.
// The short frames move; "ALL" is a decade of daily closes and does not.
// THREE SOURCES, IN ORDER, AND THE ORDER WAS MEASURED FROM THE EDGE — not chosen from what looked
// reasonable, because what looked reasonable did not work:
//
//   * BINANCE IS GONE. Stellar's chart falls back to Binance klines, so this started there too. From
//     a desk it answers fine; from a Cloudflare Worker it answers **403** on every request. It was
//     silently catching nothing and making the fallback chain look one deep when it was zero deep.
//     Removed rather than kept as decoration.
//   * CoinGecko is the best data (five-minute granularity on 1D) but its public tier meters shared
//     egress IPs and returns **429** in bursts, so it cannot be the only source.
//   * CoinGecko's public tier also answers `days=max` with **401** — "Public API is limited to 365
//     days" — so ALL can never come from it. Bitstamp's 3-day candles reach 2018-06-27 at
//     limit=1000, which is a real all-time series, so ALL leads with Bitstamp instead.
//
// Coinbase sits between them: reachable, reliable, but capped at 300 candles per request, which is
// why it is a fallback everywhere rather than a primary anywhere.
const TF = {
  '1D': { ttl: 300, sources: [['CoinGecko', 'cg', '1'], ['Coinbase', 'cb', 300], ['Bitstamp', 'bs', [300, 288]]] },
  '1W': { ttl: 900, sources: [['CoinGecko', 'cg', '7'], ['Coinbase', 'cb', 3600], ['Bitstamp', 'bs', [3600, 168]]] },
  '1M': { ttl: 1800, sources: [['CoinGecko', 'cg', '30'], ['Coinbase', 'cb', 21600], ['Bitstamp', 'bs', [21600, 120]]] },
  '1Y': { ttl: 3600, sources: [['CoinGecko', 'cg', '365'], ['Bitstamp', 'bs', [86400, 365]], ['Coinbase', 'cb', 86400]] },
  'ALL': { ttl: 21600, sources: [['Bitstamp', 'bs', [259200, 1000]], ['CoinGecko', 'cg', '365']] },
};

const json = (body, secs) => new Response(JSON.stringify(body), {
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=' + secs,
    'access-control-allow-origin': '*',
  },
});

// A User-Agent is not optional on either upstream — xrpl.to returns 403 without one and CoinGecko
// throttles anonymous callers harder. Same header this project already sends everywhere else.
const UA = { accept: 'application/json', 'user-agent': 'LumosCore/1.0 (+https://lumoscore.com)' };

const num = (v) => { const n = Number(v); return isFinite(n) ? n : null; };

// Both upstreams are third parties and their shapes are only promised, not guaranteed. Every point
// is checked rather than trusted: a NaN price would render as a broken path, and a zero would
// flatten the whole scale.
function clean(pairs) {
  const out = [];
  for (const p of pairs) {
    const t = num(p[0]), v = num(p[1]);
    if (t == null || v == null || v <= 0) continue;
    out.push([Math.round(t), v]);
  }
  out.sort((a, b) => a[0] - b[0]);
  return out;
}

async function coingecko(days) {
  const r = await fetch(CG + '?vs_currency=usd&days=' + encodeURIComponent(days), { headers: UA });
  if (!r.ok) throw new Error('coingecko ' + r.status);
  const j = await r.json();
  return clean((j && j.prices) || []);
}

// [time, low, high, open, close, volume], seconds, NEWEST FIRST — clean() sorts it back.
async function coinbase(granularity) {
  const r = await fetch(CB + '?granularity=' + granularity, { headers: UA });
  if (!r.ok) throw new Error('coinbase ' + r.status);
  const k = await r.json();
  return clean((k || []).map((c) => [c[0] * 1000, c[4]]));
}

// { data: { ohlc: [ { timestamp: "1788998400", close: "1.35261", … } ] } } — seconds and strings.
// `step` is not free-form: Bitstamp rejects anything outside its own list with a 400, which is how
// the first attempt at a weekly (604800) series failed.
async function bitstamp(step, limit) {
  const r = await fetch(BS + '?step=' + step + '&limit=' + limit, { headers: UA });
  if (!r.ok) throw new Error('bitstamp ' + r.status);
  const j = await r.json();
  const o = (j && j.data && j.data.ohlc) || [];
  return clean(o.map((c) => [Number(c.timestamp) * 1000, c.close]));
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // Constrained to the table rather than passed through, so nothing here can be used to aim a fetch
  // at an arbitrary upstream path.
  const key = String(url.searchParams.get('tf') || '1W').toUpperCase();
  const cfg = TF[key] || TF['1W'];
  const tf = TF[key] ? key : '1W';

  // The version is part of the key on purpose. Cloudflare's Cache API survives a deploy, so without
  // it a six-hour "ALL" entry keeps serving the previous build's answer and a fix looks like it did
  // nothing — the same class of false negative as the propagation delays that have impersonated
  // defects on this project before. Bump it when the response shape or the source order changes.
  const CACHE_V = '3';

  const cache = caches.default;
  const ck = new Request(url.origin + url.pathname + '?v=' + CACHE_V + '&tf=' + tf, request);
  const hit = await cache.match(ck);
  if (hit) return hit;

  // Tried in order, and EVERY failure is reported. The first version swallowed them all into one
  // generic string, and three of five timeframes then failed at the edge while working from a desk —
  // with nothing to say which upstream had refused or why. `tried` is what turned that into
  // ["binance 403","coingecko 429"] and produced the source order above. Upstream status codes carry
  // no key and no user data, and the endpoints beside this one already return `String(e.message)`.
  let pts = [], src = '';
  const tried = [];
  for (const [name, kind, arg] of cfg.sources) {
    try {
      const got = kind === 'cg' ? await coingecko(arg)
        : kind === 'cb' ? await coinbase(arg)
          : await bitstamp(arg[0], arg[1]);
      // Two points is the minimum that can be drawn as a line, so a thin answer counts as a miss
      // and the next source gets its turn rather than the page drawing a flat line that reads as
      // real calm.
      if (got.length >= 2) { pts = got; src = name; break; }
      tried.push(name + ': ' + got.length + ' points');
    } catch (e) {
      tried.push(String((e && e.message) || e));
    }
  }

  if (!pts.length) return json({ ok: false, error: 'price history unavailable', tried, pts: [] }, 60);

  const res = json({ ok: true, tf, pts, src, tried }, cfg.ttl);
  context.waitUntil(cache.put(ck, res.clone()));
  return res;
}
