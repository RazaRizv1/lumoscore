// The two heavy reads behind a pool page, done once at the edge and cached.
//
// RAZA 2026-09-17: "Pools-pool page is loading pathetically slow. Speed it up."
//
// Measured on the WHALEUM/XLM page before this existed, from the browser's own resource timings:
//
//   liquidity_pools/<id>              1,006 ms
//   .../trades?limit=200              1,510 ms
//   .../operations?limit=200          2,152 ms   \
//   .../operations?cursor=…           1,456 ms    >  a cursor-chained walk, SERIAL by construction
//   .../operations?cursor=…           1,408 ms   /
//   accounts?liquidity_pool=<id>      1,063 ms
//
// The operations walk cannot be parallelised — page N+1's cursor only exists once page N has arrived — so it costs five
// seconds of wall clock on every visit, from every visitor's IP, against Horizon's 100-requests-per-5-minutes budget.
// The participants call is worse in bytes than in time: /accounts returns every balance, signer and data entry of 100
// accounts, 3.8 MB on the XLM/USDC pool, to read ONE share figure from each.
//
// Both are the same request for every visitor looking at the same pool, and neither changes second to second. So they
// happen here, once, and are cached: the walk is paid by whoever arrives first after the cache expires, and the
// participants list goes out as a few KB instead of megabytes.
//
// Reads no secret, touches no funds, GET only, fixed upstream hosts.
const HOSTS = ['https://horizon.stellar.org', 'https://horizon.stellar.lobstr.co'];
const TTL = 120;              // a pool's operations move, but not faster than this
const TTL_ERR = 20;
const OP_PAGES = 3;           // 600 records — what the page's Deposits/Withdrawals filters walk today
const PER = 200;              // Horizon's maximum

const json = (body, secs) => new Response(JSON.stringify(body), {
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=' + secs,
    'access-control-allow-origin': '*',
  },
});

// GUARDRAILS E12: throttle + retry + host fallback. A throttled page here is not a shorter history, it is a wrong one.
async function hz(path) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const host = HOSTS[attempt % HOSTS.length];
    try {
      const r = await fetch(host + path, { cf: { cacheTtl: TTL, cacheEverything: true } });
      if (r.status === 429) { await new Promise((s) => setTimeout(s, 500 * (attempt + 1))); continue; }
      if (!r.ok) { await new Promise((s) => setTimeout(s, 200)); continue; }
      return r.json();
    } catch (e) { await new Promise((s) => setTimeout(s, 200)); }
  }
  return null;
}

export async function onRequest(ctx) {
  const url = new URL(ctx.request.url);
  const id = (url.searchParams.get('id') || '').trim().toLowerCase();
  // A pool id is 64 hex characters and nothing else; this value is pasted into an upstream path.
  if (!/^[0-9a-f]{64}$/.test(id)) return json({ ok: false, error: 'bad pool id' }, 300);

  const cache = caches.default;
  const key = new Request(url.origin + url.pathname + '?v=1&id=' + id, ctx.request);
  const hit = await cache.match(key);
  if (hit) return hit;

  // The walk and the participants read are independent, so they start together; only the walk's own pages are serial.
  const opsP = (async () => {
    let path = '/liquidity_pools/' + id + '/operations?order=desc&limit=' + PER;
    const all = [];
    let cursor = null, failed = false;
    for (let page = 0; page < OP_PAGES; page++) {
      const d = await hz(path);
      if (!d) { failed = true; break; }
      const recs = (d._embedded && d._embedded.records) || [];
      // ONLY THE FIELDS THE PAGE READS. Passed through whole, 600 operation records are 911 KB of JSON — most of it
      // _links, paging tokens and transaction envelopes nothing on the page ever touches. Every field kept below is one
      // the pool-transactions list actually reads off an operation: its type, when, by whom, and the reserves moved.
      for (const r of recs) {
        all.push({
          id: String(r.id || ''),
          type: String(r.type || ''),
          created_at: r.created_at,
          source_account: r.source_account,
          transaction_hash: r.transaction_hash,
          reserves_deposited: r.reserves_deposited,
          reserves_received: r.reserves_received,
          reserves_min: r.reserves_min,
          shares_received: r.shares_received,
          shares: r.shares,
        });
      }
      const next = d._links && d._links.next && d._links.next.href;
      cursor = next ? (next.split('cursor=')[1] || '').split('&')[0] : null;
      if (recs.length < PER || !next) break;
      path = '/liquidity_pools/' + id + '/operations?order=desc&limit=' + PER + '&cursor=' + cursor;
    }
    // `failed` travels: no records AND a failure is "we could not read this", which is not the same claim as "this pool
    // has no operations", and the page draws a different thing for each.
    return { records: all, cursor, failed: failed && !all.length };
  })();

  const partsP = (async () => {
    const d = await hz('/accounts?liquidity_pool=' + id + '&limit=100');
    if (!d) return null;
    const recs = (d._embedded && d._embedded.records) || [];
    // ONE FIGURE PER ACCOUNT. Everything else in those records — every other balance, signer, flag and data entry — is
    // what made this response megabytes, and none of it is read by the page.
    return recs.map((a) => {
      const bal = (a.balances || []).filter((b) => b.asset_type === 'liquidity_pool_shares' && b.liquidity_pool_id === id)[0];
      return { a: String(a.account_id || ''), shares: bal ? String(bal.balance) : '0' };
    }).filter((x) => x.a);
  })();

  let ops, parts;
  try { [ops, parts] = await Promise.all([opsP, partsP]); }
  catch (e) { return json({ ok: false, error: String((e && e.message) || e) }, TTL_ERR); }

  const out = {
    ok: true, id,
    ops: ops.records, opsCursor: ops.cursor, opsFailed: !!ops.failed,
    participants: parts,                      // null = could not read, [] = genuinely none
  };
  const res = json(out, TTL);
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}
