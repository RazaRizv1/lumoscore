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
const TTL_GOOD = 86400;   // how long a last-good answer is kept: a day

// LAST GOOD, PER QUERY.
//
// RAZA 2026-10-14: "I still see -- instead of holders count when i first open trade-asset page
// sometimes". Reproduced by refusing exactly one request: the Holders tab badge reads
// holdersFunded, which is set from THIS endpoint's answer to search=<issuer>&limit=50, and
// nothing else on the page can supply it. When the answer is a failure the badge stays unwritten
// and lxUnmask dashes it at 6s -- correctly, because we did not know the number.
//
// The failure is upstream throttling, not a bug here, and it is not rare: a single production page
// load shows `1 request(s) got HTTP 429` in the health report. Retrying from the browser does not
// help -- it is the same rate limit, charged again a second later.
//
// So keep the last answer that worked and serve THAT when upstream will not answer. An asset's
// holder count, name and toml do not change minute to minute, so a reading from earlier is the
// same reading; showing it beats dashing a number we have. Keyed per query, because one shared
// slot would hand every asset page whichever asset was looked up last.
//
// Only answers that CONTAIN RECORDS are remembered. An empty result is a legitimate reply to a
// search for something that does not exist, but it must never evict a good one -- a stored empty
// would turn a transient failure into a confident "this asset has no holders".
const LAST_GOOD = 'https://lumoscore.internal/__lastgood/assetsearch';
const keyFor = (search, limit) =>
  LAST_GOOD + '?search=' + encodeURIComponent(search) + '&limit=' + limit;

function hasRecords(body) {
  try {
    const d = JSON.parse(body);
    return !!(d && d._embedded && d._embedded.records && d._embedded.records.length);
  } catch (_) { return false; }
}

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

export async function onRequestGet(ctx) {
  const q = new URL(ctx.request.url).searchParams;

  const search = (q.get('search') || '').trim();
  // A code, an issuer address, or a name fragment. Anything with a slash, a scheme or a control
  // character is refused rather than passed upstream.
  if (!search || search.length > MAX_Q || !/^[A-Za-z0-9 ._:-]+$/.test(search)) {
    return json('{"error":"bad search"}', 400, TTL_ERR);
  }
  // Callers use 1, 5, 12, 20, 50 and 200. Capping below the highest would silently truncate a
  // roster lookup into a short list, which is worse than a visible failure.
  const limit = Math.min(Math.max(parseInt(q.get('limit'), 10) || 12, 1), 200);

  const url = UPSTREAM + '?search=' + encodeURIComponent(search) + '&limit=' + limit;

  const cache = caches.default;
  const key = keyFor(search, limit);

  // Only reached when this request could not get an answer of its own.
  const fallback = async (status) => {
    try {
      const hit = await cache.match(key);
      if (hit) {
        return new Response(await hit.text(), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'cache-control': 'public, max-age=30',   // short: try upstream again soon
            'access-control-allow-origin': '*',
            'x-lx-stale': '1',                       // a reader can tell, without the figures changing
          },
        });
      }
    } catch (_) {}
    // Nothing to fall back on: report the failure, and do not let it be cached AS an answer.
    return json(JSON.stringify({ error: 'upstream', status: status }), status === 429 ? 429 : 502, 0);
  };

  try {
    // cf.cacheTtl caches the UPSTREAM response at the edge too, so repeated queries from different
    // visitors collapse into one origin fetch.
    const r = await fetch(url, {
      headers: { accept: 'application/json' },
      cf: { cacheTtlByStatus: { '200-299': TTL, '300-399': 0, '400-599': 0 }, cacheEverything: true },
    });

    // 404 still means "no such asset" and is still answered as itself; fallback() only has
    // something to give when an earlier identical query succeeded, so a genuine miss is unchanged.
    if (!r.ok) return fallback(r.status);

    const body = await r.text();
    const out = json(body, 200, TTL);

    // Keep this answer for the next request that cannot get one. waitUntil so the write never
    // delays the response; without it the put races the worker shutting down and silently does
    // nothing. Stored with its own long max-age, because a last-good that expired with the normal
    // edge entry would be gone exactly when it is needed.
    if (hasRecords(body)) {
      try {
        const save = new Response(body, {
          headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=' + TTL_GOOD },
        });
        if (ctx && ctx.waitUntil) ctx.waitUntil(cache.put(key, save));
        else await cache.put(key, save);
      } catch (_) {}
    }
    return out;
  } catch (e) {
    return fallback(0);
  }
}
