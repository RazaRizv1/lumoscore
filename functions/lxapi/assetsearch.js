// Cloudflare Pages Function — same-origin proxy for stellar.expert's asset search.
//
// WHY THIS EXISTS. The search overlay called api.stellar.expert straight from the browser, so the
// rate limit was charged to the VISITOR'S IP. On a desktop that is one person and rarely a problem.
// On a mobile network it is CGNAT: hundreds of subscribers share one address, so the quota is spent by
// strangers and the search fails for reasons the user cannot see or influence. That is the reported
// shape exactly -- "Asset index unavailable right now", constantly, on the phone, for queries that
// answer fine from anywhere else ("usdt0" returns HTTP 200 with 3 records from a shell).
//
// Proxying moves the request to Cloudflare's IP and, more importantly, lets the EDGE CACHE do the work:
// the same query typed by the next person is served without touching upstream at all. Asset metadata
// changes slowly, so a few minutes of staleness costs nothing and removes almost all of the load.
// Same reasoning, and the same fix, as /lxapi/candles and /lxapi/dexassets.
//
// Deliberately narrow, so this cannot become an open proxy for someone else's traffic:
//   * GET only
//   * exactly one upstream path, hardcoded
//   * only `search` and `limit` are forwarded, and both are validated
//   * no secret is read and nothing here can touch user funds
const UPSTREAM = 'https://api.stellar.expert/explorer/public/asset';
const TTL = 300;          // 5 minutes at the edge
const TTL_ERR = 20;       // brief, so a blip does not pin an error in place
const MAX_Q = 64;

function json(body, status, ttl) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=' + ttl,
      'access-control-allow-origin': '*',
    },
  });
}

export async function onRequestGet({ request }) {
  const q = new URL(request.url).searchParams;

  const search = (q.get('search') || '').trim();
  // A code, an issuer address, or a name fragment. Anything with a slash, a scheme or a control
  // character is refused rather than passed upstream.
  if (!search || search.length > MAX_Q || !/^[A-Za-z0-9 ._:-]+$/.test(search)) {
    return json('{"error":"bad search"}', 400, TTL_ERR);
  }
  const limit = Math.min(Math.max(parseInt(q.get('limit'), 10) || 12, 1), 50);

  const url = UPSTREAM + '?search=' + encodeURIComponent(search) + '&limit=' + limit;

  try {
    // cf.cacheTtl caches the UPSTREAM response at the edge too, so repeated queries from different
    // visitors collapse into one origin fetch.
    const r = await fetch(url, {
      headers: { accept: 'application/json' },
      cf: { cacheTtl: TTL, cacheEverything: true },
    });

    if (!r.ok) {
      // Pass the status through so the caller can tell "throttled" from "no such asset", but never
      // cache a failure for long.
      return json(JSON.stringify({ error: 'upstream', status: r.status }), r.status === 429 ? 429 : 502, TTL_ERR);
    }

    const body = await r.text();
    return json(body, 200, TTL);
  } catch (e) {
    return json('{"error":"unreachable"}', 502, TTL_ERR);
  }
}
