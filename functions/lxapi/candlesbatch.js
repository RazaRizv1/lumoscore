// Cloudflare Pages Function — the LATEST daily candle for many assets in ONE request.
//
// WHY THIS EXISTS. The account page prices every holding from its own /lxapi/candles call, one per
// asset. Measured 2026-10-16 on GAFB7IYP…36GD (65 assets, 131 pool positions): a single page load
// issued about 258 requests, 65 of them candles. /lxapi/candles fronts /trade_aggregations, which is
// the ONLY metered Horizon endpoint -- 100 per 5 minutes per IP -- so ONE heavy portfolio can spend
// most of that allowance by itself, and the browser's six-connection cap makes it slow as well.
//
// It looked fine to everyone who tried it by hand, because by then the edge held those candles. The
// daily bot runs a COLD browser, exhausted the allowance, and reported "Account stats filled: 3/4"
// for days: one asset price never resolved, so Portfolio value stayed dashed. Two manual checks said
// 4/4 while the bot was right.
//
// WHAT IT RETURNS, and why it is shaped like this: EXACTLY what the per-asset call returns, keyed by
// asset id. The caller's dust guard reads close, base_volume and counter_volume off the record and
// refuses a price drawn from a trade of almost nothing -- that test once caught a $44.35M phantom
// portfolio. Returning a different shape would have meant rewriting the guard to match, and the guard
// is the last thing that should move. So the batching changes the FETCHING and nothing else.
//
// Sized for the Workers free plan: one upstream call per asset, so MAX_ASSETS stays well inside the
// 50-subrequest ceiling. Narrow by construction -- GET only, every asset must match CODE-GISSUER, and
// the only host contacted is Horizon. Nothing here reads a secret or touches user funds.
const ASSET_RE = /^[A-Za-z0-9]{1,12}-G[A-Z2-7]{55}$/;
const H = 'https://horizon.stellar.org';
// 16, matching dexassets.js. One subrequest each leaves plenty of margin under the 50 ceiling, and a
// 65-asset wallet becomes 5 requests instead of 65.
const MAX_ASSETS = 16;
const TTL = 300;         // Horizon's own 5-minute window, as in candles.js and dexassets.js
const TTL_ERR = 15;      // never pin a failure on the page for a whole window

function json(body, status, ttl) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=' + ttl,
      'access-control-allow-origin': '*',
    },
  });
}

// The same request /lxapi/candles makes for `res=86400000&order=desc&limit=1`, which is the only
// shape the account page asks for. Anything else still has the per-asset endpoint.
function oneUrl(code, issuer) {
  const t = code.length <= 4 ? 'credit_alphanum4' : 'credit_alphanum12';
  return H + '/trade_aggregations?base_asset_type=' + t
    + '&base_asset_code=' + encodeURIComponent(code)
    + '&base_asset_issuer=' + issuer
    + '&counter_asset_type=native&resolution=86400000&order=desc&limit=1';
}

export async function onRequestGet({ request }) {
  const q = new URL(request.url).searchParams;
  const raw = (q.get('a') || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!raw.length) return json({ error: 'no assets' }, 400, TTL_ERR);
  if (raw.length > MAX_ASSETS) return json({ error: 'max ' + MAX_ASSETS + ' assets per call' }, 400, TTL_ERR);
  for (const a of raw) if (!ASSET_RE.test(a)) return json({ error: 'bad asset' }, 400, TTL_ERR);

  // ONE ASSET REFUSING MUST NOT COST THE OTHERS THEIR PRICE. allSettled, and a failure becomes an
  // empty record list for that id alone -- which the caller already handles, because that is what a
  // single candles call returns when Horizon has nothing.
  const out = {};
  await Promise.all(raw.map(async (id) => {
    const i = id.lastIndexOf('-');
    const code = id.slice(0, i), issuer = id.slice(i + 1);
    try {
      const r = await fetch(oneUrl(code, issuer), {
        headers: { accept: 'application/json' },
        // Cached at the edge per asset, so two wallets holding the same asset share one upstream call
        // — the same property the per-asset endpoint has, kept.
        cf: { cacheTtlByStatus: { '200-299': TTL, '300-399': 0, '400-599': 0 }, cacheEverything: true },
      });
      if (!r.ok) { out[id] = { _embedded: { records: [] } }; return; }
      const d = await r.json();
      const recs = (d && d._embedded && d._embedded.records) || [];
      // Only the fields the caller reads. Horizon's record carries a dozen more and passing them all
      // back would multiply the response size by the number of assets for no gain.
      out[id] = { _embedded: { records: recs.slice(0, 1).map((x) => ({
        close: x.close, avg: x.avg, base_volume: x.base_volume, counter_volume: x.counter_volume,
      })) } };
    } catch (e) {
      out[id] = { _embedded: { records: [] } };
    }
  }));

  return json(out, 200, TTL);
}
