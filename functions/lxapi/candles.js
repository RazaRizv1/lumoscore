// Cloudflare Pages Function — serve Horizon trade_aggregations from the edge instead of the browser.
//
// Why this exists. Measured 2026-08-25: of every Horizon endpoint this site touches, /trade_aggregations is
// the ONLY metered one. In the same second, from the same IP, /assets, /liquidity_pools, /order_book and
// /trades all answered 200 and sent no X-RateLimit headers at all, while /trade_aggregations answered 429
// with x-ratelimit-remaining: 0 -- and it stayed exhausted through a 17-minute silence. It is a separate
// 100-per-5-minutes allowance, not the general one.
//
// The asset page fires FOUR of these per view: the 2-bar daily (price + 24h), the 2-bar hourly (1h), the
// 200-bar daily (1M/3M/6M/7d), and the chart. So roughly 25 asset views exhaust the budget for everyone
// behind that IP -- and an office or a phone network is one IP. Past that point Horizon 429s, and because
// its 429 carries NO Access-Control-Allow-Origin header the browser cannot even read the status: it
// surfaces as an opaque "Failed to fetch". The page's own .catch() then swallows it silently. That is why
// 3M/6M dashed on most assets and why the chart sometimes never loaded -- one cause, two symptoms.
//
// dexassets.js already solved exactly this for Trade-main; this is the same cure for the asset page.
//
// Deliberately a PASS-THROUGH: the upstream body is streamed back unparsed. Parsing 200 records and
// re-serialising them would spend the free plan's 10ms CPU budget for no benefit -- the client already
// knows how to read Horizon's shape, and this way the function's cost does not grow with limit. One
// subrequest per invocation, and the edge cache collapses many visitors into one upstream hit.
//
// Narrow by construction: GET only, one asset matching CODE-GISSUER exactly, resolution from a fixed
// allowlist, limit capped, timestamps digits-only. The only host contacted is Horizon, and every parameter
// sent upstream is rebuilt here from validated pieces rather than forwarded from the request. Nothing here
// reads a secret or touches user funds.
const ASSET_RE = /^[A-Za-z0-9]{1,12}-G[A-Z2-7]{55}$/;

const H = 'https://horizon.stellar.org';

// Horizon accepts only these bucket sizes; the page uses 3600000, 86400000, and 900000/604800000 for the
// chart timeframes. Anything else is rejected rather than passed upstream.
const RES = ['60000', '300000', '900000', '3600000', '86400000', '604800000'];

const MAX_LIMIT = 200;   // Horizon's own ceiling
const TTL = 300;         // matches Horizon's 5-minute window, as in dexassets.js
const TTL_ERR = 15;      // never pin a failure on the page for a full window
const TIMEOUT_MS = 6000;

function err(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=' + TTL_ERR,
      'access-control-allow-origin': '*',
    },
  });
}

function digits(v, maxLen) {
  if (!v) return null;
  const s = String(v);
  if (s.length > maxLen) return null;
  for (let i = 0; i < s.length; i++) {
    const c = s.charAt(i);
    if (c < '0' || c > '9') return null;
  }
  return s;
}

export async function onRequestGet({ request }) {
  const q = new URL(request.url).searchParams;

  const a = (q.get('a') || '').trim();
  if (!ASSET_RE.test(a)) return err('bad asset', 400);
  const dash = a.lastIndexOf('-');
  const code = a.slice(0, dash);
  const issuer = a.slice(dash + 1);

  const res = (q.get('res') || '86400000').trim();
  if (RES.indexOf(res) < 0) return err('bad resolution', 400);

  const limit = digits(q.get('limit') || '200', 3);
  if (!limit || +limit < 1 || +limit > MAX_LIMIT) return err('bad limit', 400);

  const order = (q.get('order') || 'desc').trim();
  if (order !== 'asc' && order !== 'desc') return err('bad order', 400);

  // Optional window, used by the chart. Both must be plain millisecond timestamps.
  const start = q.get('start') ? digits(q.get('start'), 16) : null;
  const end = q.get('end') ? digits(q.get('end'), 16) : null;
  if ((q.get('start') && !start) || (q.get('end') && !end)) return err('bad time', 400);

  const type = code.length <= 4 ? 'credit_alphanum4' : 'credit_alphanum12';
  let url = H + '/trade_aggregations' +
    '?base_asset_type=' + type +
    '&base_asset_code=' + encodeURIComponent(code) +
    '&base_asset_issuer=' + issuer +
    '&counter_asset_type=native' +
    '&resolution=' + res +
    '&order=' + order +
    '&limit=' + limit;
  if (start) url += '&start_time=' + start;
  if (end) url += '&end_time=' + end;

  // Horizon 429s under load. From a server that is visible and cheap to ride out, so two backed-off retries
  // turn a throttled moment into a slightly slower answer rather than the dash the browser used to get.
  const delays = [0, 400, 1200];
  let lastStatus = 0;
  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) await new Promise((r) => setTimeout(r, delays[i]));
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(url, {
        signal: ctl.signal,
        // cacheEverything lets a second invocation reuse the upstream body instead of paying the hop again
        cf: { cacheTtl: TTL, cacheEverything: true },
      });
      clearTimeout(t);
      if (r.ok) {
        // Stream the body straight through -- no parse, no re-serialise.
        return new Response(r.body, {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'cache-control': 'public, max-age=' + TTL,
            'access-control-allow-origin': '*',
          },
        });
      }
      lastStatus = r.status;
    } catch (e) {
      clearTimeout(t);
      lastStatus = /abort/i.test(String((e && e.message) || e)) ? 504 : 502;
    }
  }
  // 200 with an error body, briefly cached: the client falls back to Horizon directly, and a bad moment
  // upstream is not pinned on the page for a full window.
  return err(lastStatus === 429 ? 'upstream rate limited' : 'upstream ' + lastStatus, 200);
}
