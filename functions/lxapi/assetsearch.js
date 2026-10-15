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


// A GLOBAL LAST-GOOD, NOT A PER-COLO ONE.
//
// The Cache API is per-colo on the free plan, so the previous last-good only helped a colo that had
// already seen one success. It could not help the FIRST request in a cold colo -- which is exactly
// the load the health bot caught dashing the Holders badge on 2026-10-15.
//
// Worse, the page asks this endpoint TWICE for the same asset (search=<CODE>&limit=20 for the code
// lookup, search=<ISSUER>&limit=50 for the holders count) and both land within about a second:
//     limit=20 200 @940ms  |  limit=50 200 @1647ms
// So when stellar.expert throttles our edge they fail TOGETHER. Reading the number from either
// response, which is what the client fix does, is redundancy that shares its failure mode.
//
// KV is global and survives both cases: any colo can serve the last count we actually saw, and a
// throttled upstream stops mattering until the entry expires.
//
// Same shape as mkStore in pools.js, deliberately: KV when the binding is present, the per-colo
// Cache API when it is not. The fallback is exactly the previous behaviour, so this is safe to ship
// before the namespace is bound to this project and improves the moment it is. On the free plan KV
// operations also do not count against the 50-subrequest budget, while Cache API calls do.
function mkStore(env) {
  // CONTENT_KV is in the list because it is what this project actually has bound. LUMOS_KV and
  // POOLS_KV are kept first so a dedicated namespace wins if one is ever added; measured on
  // production 2026-10-15, the only namespaces reaching this Function are ASSETS (Pages own static
  // assets, not ours to write to) and CONTENT_KV. Keys here are prefixed and carry a TTL, so they
  // expire on their own and cannot collide with the content the namespace is named for.
  const kv = env && (env.LUMOS_KV || env.POOLS_KV || env.CONTENT_KV);
  if (kv) {
    return {
      kind: 'kv',
      async get(k) { try { return await kv.get(k); } catch (_) { return null; } },
      async put(k, body) {
        try { await kv.put(k, body, { expirationTtl: TTL_GOOD }); } catch (_) {}
      },
    };
  }
  const cache = caches.default;
  return {
    kind: 'cache',
    async get(k) { try { const r = await cache.match(k); return r ? await r.text() : null; } catch (_) { return null; } },
    async put(k, body) {
      try {
        await cache.put(k, new Response(body, {
          headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=' + TTL_GOOD },
        }));
      } catch (_) {}
    },
  };
}

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

  const store = mkStore(ctx && ctx.env);
  const key = keyFor(search, limit);

  // Only reached when this request could not get an answer of its own.
  const fallback = async (status) => {
    try {
      const hit = await store.get(key);
      if (hit) {
        return new Response(hit, {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'cache-control': 'public, max-age=30',   // short: try upstream again soon
            'access-control-allow-origin': '*',
            'x-lx-stale': '1',                       // a reader can tell, without the figures changing
            'x-lx-store': store.kind,                // kv = global, cache = this colo only
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
    // Named on EVERY answer, not just a stale one. Whether LUMOS_KV is bound to this project is set
    // in the Cloudflare dashboard, not in this repo, so from here it is unknowable -- and a global
    // last-good that silently degraded to a per-colo one would look exactly like a working fix until
    // the next cold colo. One header makes it answerable with a curl instead of an assumption.
    try { out.headers.set('x-lx-store', store.kind); } catch (_) {}

    // Keep this answer for the next request that cannot get one. waitUntil so the write never
    // delays the response; without it the put races the worker shutting down and silently does
    // nothing. Stored with its own long TTL, because a last-good that expired with the normal edge
    // entry would be gone exactly when it is needed.
    if (hasRecords(body)) {
      if (ctx && ctx.waitUntil) ctx.waitUntil(store.put(key, body));
      else await store.put(key, body);
    }
    return out;
  } catch (e) {
    return fallback(0);
  }
}
