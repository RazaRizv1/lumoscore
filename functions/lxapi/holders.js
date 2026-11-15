// Cloudflare Pages Function — the Trade-asset page's RANKED holder list.
//
// WHY THIS STOPPED BEING A PROXY, 2026-11-16. This route used to forward one request to
// stellar.expert's /holders endpoint, which returned a ready-made ranking. That endpoint now answers
// 402 Payment Required for everyone:
//
//     GET api.stellar.expert/explorer/public/asset/LUMOS-GB5T…B6S-2/holders   ->  402
//
// which this file passed straight through. The page then fell back to Horizon's /accounts?asset=,
// and Horizon CANNOT RANK: it orders by account id, not balance. So the fallback sorted an arbitrary
// 200-account slice of 964 and presented the winner of that slice as the asset's top holder, while
// LUMOS's 9,000,000,000 burn wallet (GBIU…HUOK, 90% of supply) sat on a page nobody fetched.
//
// RAZA, 2026-11-16: "the top wallet is GBIU… which is burn wallet. this was working absolutely fine
// until few days ago". It was. Nothing here changed — the vendor did. Same move they made on the
// per-asset endpoints before (see the 402 note in _tools/_dexassetdata.js's sibling fixes).
//
// WE OWN THE RANKING NOW. Horizon hands out every trustline for free; it just will not sort them.
// Sorting is ours to do, so the only real cost is reading all of them once and keeping the result.
//
// THE COST IS WHY THIS IS CACHED AND INCREMENTAL. Horizon's /accounts?asset= is brutally slow:
// measured 6-7s per 200 accounts for LUMOS, and _dexassetdata.js records 61.6s for one page of SCOP
// (35,444 holders). The cursor chain is sequential, so pages cannot be fetched in parallel. A full
// scan therefore cannot happen while someone waits for a page. Instead each request advances the
// scan by a bounded number of pages, parks the cursor in KV, and a later request resumes it — the
// same shape /lxapi/pools uses to build its Horizon ranking.
//
// A PARTIAL SCAN IS NEVER SERVED. The client sets __lxDXAranked=1 on ANY non-empty response from
// this route and then states "Top 10 / Top 50 hold" from it. Handing it half a scan would reproduce
// the exact bug above with our name on it instead of the vendor's, so while a scan is unfinished
// this route returns 204 and the page keeps its own (honest, dashed) fallback. canRankHolders() in
// _dexassetdata.js refuses to claim a ranking it cannot prove; this route must hold the same line.
//
// AND A FAILURE IS NEVER CACHED — the lesson that cost this feature weeks of "sometimes yes,
// sometimes no": a cached 429/5xx froze the dash in at one colo for two minutes at a time. Only a
// completed scan is ever written.
const ASSET_RE = /^[A-Za-z0-9]{1,12}-G[A-Z2-7]{55}$/;

const HORIZON = 'https://horizon.stellar.org';
const PAGE = 200;            // Horizon's maximum for /accounts
// Pages per request. Sized from the real shape of the data, not a guess: LUMOS reports 964 HOLDERS
// but has 1,498 TRUSTLINES, and it is trustlines Horizon pages — the count on the page excludes zero
// balances. A budget of 6 stopped one page short of the end and served nothing. Measured warm,
// 8 pages of LUMOS cost ~16s in total (4.5s for the first, then 0.8-2.9s), so 10 covers 2,000
// trustlines in a single pass and anything larger resumes below.
const BUDGET = 10;
const BG_BUDGET = 20;        // further pages swept behind the response, once it has been sent
// Past this an asset is not rankable here at any price: USDC has ~2.3M holders, which is 11,500
// sequential pages. Such an asset is marked and never scanned again until the mark expires, so it
// costs one bounded attempt rather than an endless one. The page dashes, which is the truth.
const MAX_ACCOUNTS = 20000;
// The UI pages 200 at a time and nobody walks past a few hundred, so the stored ranking is trimmed.
// Keeps the KV value small and the sort cheap on read.
const KEEP = 2000;
const TTL = 900;             // 15 min, matching the pools ranking's own cycle
const VER = 'v1';

// Same store as pools.js/poolstats.js: KV when the binding is present, the per-colo Cache API when it
// is not. Duplicated rather than imported because Pages Functions are separate modules.
function mkStore(env) {
  const kv = env && (env.LUMOS_KV || env.POOLS_KV);
  if (kv) {
    return {
      async get(k) { try { return await kv.get(k, 'json'); } catch (_) { return null; } },
      async put(k, v) {
        try { await kv.put(k, JSON.stringify(v), { expirationTtl: TTL * 4 }); } catch (_) {}
      },
    };
  }
  const cache = caches.default;
  const req = (k) => new Request('https://lumoscore.internal/' + encodeURIComponent(k), { method: 'GET' });
  return {
    async get(k) { try { const r = await cache.match(req(k)); return r ? await r.json() : null; } catch (_) { return null; } },
    async put(k, v) {
      try {
        await cache.put(req(k), new Response(JSON.stringify(v), {
          headers: { 'content-type': 'application/json', 'cache-control': 'max-age=' + TTL * 4 },
        }));
      } catch (_) {}
    },
  };
}

// Horizon states a balance as a decimal string ("9000000000.0000000"); stellar.expert stated it in
// stroops, and the client still divides by 1e7. Converted BY STRING, never by multiplying a float:
// 9e9 * 1e7 is 9e16, which is past Number.MAX_SAFE_INTEGER, so the arithmetic route silently loses
// the low digits of exactly the largest holders this list exists to show.
function toStroops(dec) {
  const s = String(dec == null ? '' : dec).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) return '0';
  const dot = s.indexOf('.');
  const int = dot < 0 ? s : s.slice(0, dot);
  const frac = dot < 0 ? '' : s.slice(dot + 1);
  const out = (int + (frac + '0000000').slice(0, 7)).replace(/^0+(?=\d)/, '');
  return out || '0';
}

// Exact compare of two non-negative integer strings, no BigInt: longer is larger once leading zeros
// are gone (toStroops guarantees that), and equal lengths compare lexicographically.
function cmpStr(x, y) {
  if (x.length !== y.length) return x.length - y.length;
  return x < y ? -1 : x > y ? 1 : 0;
}

// WHY NOT A BigInt COMPARATOR. The obvious version builds two BigInts per comparison, which for
// LUMOS is ~16,000 allocations inside the sort — and this plan's budget is 10ms of CPU, which a
// comparator spends where the Horizon fetches above (pure I/O wait) do not. So the numeric key is
// computed ONCE per row and the sort runs on plain numbers.
//
// A float key alone would not be enough: stroop counts pass 2^53 on a large holder (the burn wallet
// is 9e16 stroops), where Number's granularity is 16 stroops and two close holders could swap. So an
// equal key falls through to the exact string compare — rare, bounded, and never wrong.
function sortDesc(rows) {
  const keyed = rows.map((r) => [Number(r[1]), r]);
  keyed.sort((a, b) => (a[0] !== b[0] ? b[0] - a[0] : cmpStr(b[1][1], a[1][1])));
  return keyed.map((k) => k[1]);
}

async function hz(path, tries) {
  for (let attempt = 0; attempt < (tries || 2); attempt++) {
    try {
      const r = await fetch(HORIZON + path, {
        headers: { accept: 'application/json' },
        cf: { cacheTtlByStatus: { '200-299': 60, '400-599': 0 }, cacheEverything: true },
      });
      if (r.ok) return await r.json();
    } catch (_) { /* fall through to the retry */ }
  }
  return null;
}

// Advance the scan by `budget` pages. Returns {rows, cursor, done, failed}.
async function scan(code, issuer, cursor0, rows0, budget) {
  const rows = rows0 || [];
  let cursor = cursor0 || '';
  for (let n = 0; n < budget; n++) {
    const d = await hz('/accounts?asset=' + encodeURIComponent(code + ':' + issuer)
      + '&limit=' + PAGE + '&order=asc' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''));
    // Unreadable: keep what we have and the cursor, so a later request resumes instead of restarting.
    // Nothing is written as complete, so nothing wrong is served in the meantime.
    if (!d) return { rows, cursor, done: false, failed: true };
    const recs = (d._embedded && d._embedded.records) || [];
    for (const a of recs) {
      const bl = (a.balances || []).find(
        (b) => b.asset_code === code && b.asset_issuer === issuer);
      if (!bl) continue;
      const st = toStroops(bl.balance);
      // A zero balance is an open trustline, not a holder — the same cut the client makes.
      if (st !== '0') rows.push([a.account_id || a.id, st]);
    }
    // A short page is the end of the asset's accounts.
    if (recs.length < PAGE) return { rows, cursor, done: true, failed: false };
    cursor = recs[recs.length - 1].paging_token;
    if (rows.length > MAX_ACCOUNTS) return { rows, cursor, done: false, failed: false, giant: true };
  }
  return { rows, cursor, done: false, failed: false };
}

function rankedBody(rows, offset, limit) {
  const slice = rows.slice(offset, offset + limit);
  const body = {
    // paging_token IS PART OF THE CONTRACT, not decoration. The admin panel's whale walk
    // (_tools/_adminrewards.js sWhales) pages by reading paging_token off the LAST record and
    // sending it back as &cursor=, the way the old upstream worked — it never looks at _links.
    // Without it that walk silently caps at the first 200 holders. It does not bite on LUMOS today
    // (the walk stops at the 5,000,000 line inside page 1), which is exactly why it would have gone
    // unnoticed until an asset had more than 200 accounts above the line and the holder programme
    // quietly underpaid. Our cursor IS an offset, so the token is the 1-based index of that row.
    _embedded: {
      records: slice.map((r, i) => ({
        account: r[0], balance: r[1], paging_token: String(offset + i + 1),
      })),
    },
    _links: {},
  };
  const next = offset + slice.length;
  // Only advertise a next page when one actually exists, or the client pages into nothing and the
  // table's Next button lies about there being more.
  if (next < rows.length) {
    body._links.next = { href: '/lxapi/holders?cursor=' + next };
  }
  return body;
}

export async function onRequestGet(ctx) {
  const { request, env } = ctx;
  const q = new URL(request.url).searchParams;
  const asset = q.get('asset') || '';
  if (!ASSET_RE.test(asset)) {
    return new Response('{"error":"bad asset"}', {
      status: 400,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }
  const cut = asset.lastIndexOf('-');
  const code = asset.slice(0, cut);
  const issuer = asset.slice(cut + 1);
  const limit = Math.min(parseInt(q.get('limit'), 10) || 50, PAGE);
  // Our own ranking is a flat sorted array, so paging is an offset. The client only ever echoes back
  // the token we put in _links.next, so nothing external depends on it staying opaque.
  const offset = Math.max(0, parseInt(q.get('cursor'), 10) || 0);

  const store = mkStore(env);
  const KEY = 'hold:' + VER + ':' + asset;
  const now = Date.now();

  const held = await store.get(KEY);
  if (held && held.giant) {
    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  }
  if (held && held.done && held.rows && (now - (held.t || 0)) < TTL * 1000) {
    return new Response(JSON.stringify(rankedBody(held.rows, offset, limit)), {
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=' + TTL },
    });
  }

  // Resume an unfinished scan rather than restarting it.
  const from = (held && !held.done && held.rows) ? held : null;
  const r = await scan(code, issuer, from ? from.cursor : '', from ? from.rows.slice() : [], BUDGET);

  if (r.giant) {
    await store.put(KEY, { giant: 1, t: now });
    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  }

  if (r.done) {
    const rows = sortDesc(r.rows).slice(0, KEEP);
    await store.put(KEY, { done: 1, t: now, rows, total: r.rows.length });
    return new Response(JSON.stringify(rankedBody(rows, offset, limit)), {
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=' + TTL },
    });
  }

  // UNFINISHED. Park the progress and say nothing — 204, so the client keeps its honest fallback
  // instead of being handed a ranking that is not one. Then keep paging behind the response so the
  // next visitor is more likely to find it finished.
  if (!r.failed) await store.put(KEY, { done: 0, t: now, cursor: r.cursor, rows: r.rows });
  try {
    ctx.waitUntil && ctx.waitUntil((async () => {
      const more = await scan(code, issuer, r.cursor, r.rows.slice(), BG_BUDGET);
      if (more.giant) { await store.put(KEY, { giant: 1, t: Date.now() }); return; }
      if (more.done) {
        const rows = sortDesc(more.rows).slice(0, KEEP);
        await store.put(KEY, { done: 1, t: Date.now(), rows, total: more.rows.length });
      } else if (!more.failed) {
        await store.put(KEY, { done: 0, t: Date.now(), cursor: more.cursor, rows: more.rows });
      }
    })());
  } catch (_) {}

  return new Response('', { status: 204, headers: { 'cache-control': 'no-store' } });
}

// Anything other than GET is not part of this route's contract.
export async function onRequest(ctx) {
  if (ctx.request.method === 'GET') return onRequestGet(ctx);
  return new Response('{"error":"method not allowed"}', {
    status: 405,
    headers: { 'content-type': 'application/json', allow: 'GET' },
  });
}
