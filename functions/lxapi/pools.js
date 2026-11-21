// Cloudflare Pages Function — the network-wide Stellar AMM pool list, ranked by real USD TVL.
//
// The Pools page used to list five curated pools. The network has 39,844 (measured, exact — paged through
// Horizon end to end). Ranking those by dollar value cannot be done in the browser: enumeration is 200
// requests and 47s, against a Horizon budget of 100 requests per 5 minutes per IP.
//
// WHY HORIZON AND NOT stellar.expert. stellar.expert returns a ready-made total_value_locked and would be
// one cheap call, and this endpoint was very nearly built on it. Two measurements killed that:
//
//   1. Its `sort` and `order` parameters are IGNORED. `sort=tvl&order=desc`, `order=desc` and no
//      parameters at all return byte-identical pages — same records, same order. `order=asc` merely
//      reverses the first n. The order it does return correlates with size (page 1 holds the largest
//      pool) but is not a ranking: 43 of the first 93 XLM-leg pools break descending order.
//   2. So you cannot read "the top N". Reading 8,000 pools — 40 requests — covered only 60.8% (415/683)
//      of the pools Horizon says are worth >= $100, and the largest one missing was worth $8,072.
//
// Ranking off that would have silently dropped hundreds of real pools from the middle of the list, which
// is worse than the five hardcoded ones because it would look complete. Horizon's reserves are the ledger
// itself, so TVL here is computed, not reported.
//
// (Same reason poolstats.js's "walk down the TVL ranking" comment is optimistic about that upstream --
// noted, not changed from here.)
//
// SCOPE — what is in the ranking and what is not:
//   * pools with a native XLM leg          10,082   priced from the XLM leg
//   * pools with a Circle USDC leg, no XLM    880   priced from the USDC leg
//   * everything else                      28,882   NOT RANKED, and cannot be: no path to a USD price
//                                                   without a per-pool orderbook call each.
// The excluded set is reported as `unpriceable` so the page can state the number rather than imply the
// ranking is all 39,844.
//
// A pool's two legs are equal in value by construction, so TVL = 2 x the priceable leg. That is exact,
// not an approximation.
//
// Reads no secret, touches no funds, GET only, fixed upstream hosts.

// LOBSTR FIRST (2026-11-18, RAZA: "why are stellar pools empty"). SDF's Horizon answered a /trades page in
// 7.7s against LOBSTR's 1.9s; a deep step (VOL_DEEP_PAGES x pages, sequential per pool) then ran past the
// ~30s a background step is allowed, was killed before it saved, and the same 51 busy pools -- XLM/USDC,
// SHX, LDEX, VELO... -- stayed pending for good with Vol/Fees showing a dash. j() alternates hosts per
// attempt, so SDF is still the retry.
const HOSTS = ['https://horizon.stellar.lobstr.co', 'https://horizon.stellar.org'];
const USDC = 'USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const PAGE = 200;            // Horizon max per request
const RANK_TTL = 900;        // 15 min — reserves move, but the ORDER of a 10k list barely does
const UPSTREAM_TTL = 900;
const DAY = 86400000;
// How far the 24h volume sweep reaches, and what it costs. See volWalk()/volSweep().
const VOL_TOP = 100;         // ranked pools that get a figure; the rest report null and show a dash
const VOL_PAR = 10;          // trades pages in flight at once — 20 starts drawing non-200s from Horizon
const VOL_BATCH = 20;        // pools whose first page one request reads
const VOL_DEEP_PAR = 15;     // pools whose walk one request continues...
const VOL_DEEP_PAGES = 10;   // ...by this many pages each. Raised 2026-11-18 (5x4 -> 15x10): the paid plan allows 10,000
                             // subrequests (the 50 cap this was sized for is gone) and LOBSTR reads a page in ~1s, so a
                             // step is ~10-12s -- well inside the ~30s a background step may run. 15x10x2 = 300 worst case.
// Pages one pool may ever cost before it is given up on. 16 was too low and it dashed three pools that
// genuinely trade: measured 2026-11-10, XLM/MTL needs 63 pages (12,503 trades in 24h), XLM/XAU 35 and
// XLM/XCHF 26. 80 covers all three with headroom. It is not expensive in the way it looks — a walk is
// resumed VOL_DEEP_PAGES at a time BEHIND the response, so a deeper cap costs more sweep steps, never a
// slower page, and only for the handful of pools that are actually this busy.
// 80 -> 160 on 2026-11-18: XLM/EURMTL ran 91 pages (18,196 trades in 24h) and was given up on, showing
// a dash; XLM/SSLX 53 and SSLX/USDC 45 were close behind. A bot-traded pool costs sweep steps, never a page.
const VOL_MAX_PAGES = 160;
// Consecutive unreadable pages before a pool is given up on, counted per POOL and reset by any page that
// reads. See volWalk: this is what keeps a transient Horizon non-200 from costing a pool its figure.
const VOL_MAX_FAILS = 4;
const VOL_TTL = 3600;        // a figure stands this long before the sweep walks the head again
const VOL_HOLD = 604800;     // how long the map survives in the store — far past TTL, so it never blanks
// A WEEK, NOT SIX HOURS (RAZA 2026-11-20 "Yes, keep them"). KV expiry only moves on a write, and this site can go six
// hours without a visitor: the key then EXPIRED, every finished figure went with it, and the next visitor saw Vol and
// Fees as dashes while the walk restarted from zero (prod 2026-11-20: ts 0, rev 6, 46 of 100). With the map kept, a
// quiet stretch takes the same path as the hourly refresh: last figures shown, re-walked in the background.
const VOL_BUSY = 20000;      // ms a sweep step is assumed to still be running, so polls do not stampede
                             // — measured at 5-23s per step, and a step cut short simply retries


const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// GUARDRAILS E12: throttle + retry + host fallback. Horizon's 429 carries no CORS header, so in the
// browser it surfaces as an opaque "Failed to fetch"; here we see the status, but the fallback matters
// just as much because a single throttled page would corrupt the ranking.
// `tries` is capped lower by the volume sweep, where the subrequest budget is counted per POOL and a
// silent 4x retry would make that count a guess -- see volSweep.
async function j(path, ttl = UPSTREAM_TTL, tries = 4, valid) {
  for (let attempt = 0; attempt < tries; attempt++) {
    const host = HOSTS[attempt % HOSTS.length];
    try {
      // ttl 0 = READ LIVE, no edge cache at all (a pool's newest trades: see volPage). cacheEverything overrides Horizon's
      // own no-store, so a cached head page could outlive its TTL and make a busy pool read as idle (2026-11-20).
      const r = await fetch(host + path, ttl > 0 ? { cf: { cacheTtlByStatus: { '200-299': ttl, '300-399': 0, '400-599': 0 }, cacheEverything: true } } : {});
      if (r.status === 429) { await sleep(700 * (attempt + 1)); continue; }
      if (!r.ok) { await sleep(200); continue; }
      const body = await r.json();
      // A 200 that is not the shape we asked for is a failure, not an answer -- and with cacheEverything the
      // edge would hand the same body back for the rest of the TTL, so the NEXT HOST is the only real retry.
      if (valid && !valid(body)) { await sleep(200); continue; }
      return body;
    } catch (_) { await sleep(200); }
  }
  return null;
}

// Page through one Horizon liquidity_pools filter completely, OR until the request's subrequest budget
// runs out -- see buildStep for why that budget exists. Returns {recs, cursor, done}.
//
// It stops on budget, never on error: a page that failed is not a shorter list, it is a WRONG ranking
// with real pools missing from the middle of it.
async function enumerate(filter, cursor0, budget) {
  const out = [];
  let cursor = cursor0 || '';
  // Horizon paging is cursor-chained: page N+1's cursor is only known once page N is in hand, so these
  // cannot be fanned out. Walk sequentially with no artificial delay -- the edge cache absorbs repeats,
  // and the retry/fallback in j() is what handles a throttle, not pre-emptive sleeping.
  for (let n = 0; n < budget; n++) {
    const d = await j('/liquidity_pools?' + filter + '&limit=' + PAGE + '&order=asc' + (cursor ? '&cursor=' + cursor : ''));
    if (!d) throw new Error('enumeration page failed');
    const recs = (d._embedded && d._embedded.records) || [];
    for (const p of recs) out.push(p);
    if (recs.length < PAGE) return { recs: out, cursor, done: true };
    cursor = recs[recs.length - 1].paging_token;
  }
  return { recs: out, cursor, done: false };
}

// XLM/USD straight off the ledger: Circle USDC against native, from Horizon's own aggregation. No
// third-party price feed, and it fails closed rather than guessing a number.
//
// MIND THE DIRECTION. trade_aggregations quotes COUNTER PER BASE. base=USDC, counter=native therefore
// returns XLM PER USDC -- about 6.4 -- not dollars per XLM. Using it as-is priced the largest pool at
// $172,085,771 against a true $4.2M, a 41x overstatement that looked plausible enough to ship. The
// dollar price is its reciprocal.
async function xlmUsd() {
  const res = 900000, end = Math.ceil(Date.now() / res) * res, start = end - 12 * 3600000;
  const d = await j('/trade_aggregations?base_asset_type=credit_alphanum4&base_asset_code=USDC'
    + '&base_asset_issuer=' + USDC.split(':')[1]
    + '&counter_asset_type=native&resolution=' + res
    + '&start_time=' + start + '&end_time=' + end + '&order=desc&limit=1', 300);
  const r = (d && d._embedded && d._embedded.records) || [];
  const xlmPerUsdc = r[0] ? (+r[0].avg || +r[0].close || 0) : 0;
  if (!(xlmPerUsdc > 0)) return 0;
  const usd = 1 / xlmPerUsdc;
  // Sanity band. XLM has traded inside $0.02-$2 for its entire history; anything outside that means the
  // quote direction flipped again or the pair returned something unrelated, and a wrong price silently
  // rescales EVERY number on the page. Fail closed instead.
  return (usd > 0.02 && usd < 2) ? usd : 0;
}


// ---- 24h volume and fees, from Horizon ------------------------------------------------------
//
// THE OLD SOURCE WENT PAID. Until 2026-11-08 both columns came from one stellar.expert overlay
// (volume_value['1d'] per pool, Fees derived as volume x the pool's fee rate). The whole
// api.stellar.expert surface now answers **HTTP 402 Payment Required** with an x402 payment demand in
// the header -- measured on /liquidity-pool, /liquidity-pool/<id> and /asset alike, from the edge and
// from a laptop. So the overlay returned nothing, every row carried vol24 null, and both columns were
// a dash for every pool. The 2026-09-17 instrumentation is what said so outright rather than leaving
// it to be guessed at: the published meta read `volDiag {"status":402,"stop":"http 402"}`, withVol 0.
//
// Paying per request is not a dependency this file is going to take on, so the figure is computed from
// HORIZON, which is free, already the source of every other number here, and is the ledger itself.
//
// WHAT IT COSTS. Horizon has no volume field and no time filter, so the only way is to read a pool's
// own /trades newest-first and stop at the 24h boundary. Measured against Horizon 2026-11-09:
//
//   * a /trades page costs **~4.5 SECONDS**, at any limit from 10 to 200. A /liquidity_pools page costs
//     0.29s. Same host, same link -- it is the query, not the network, and the page size is free.
//   * walking the top 100 pools to the boundary needs 230 pages (69 pools need 1, XLM/USDC needs 8,
//     and XLM/MTL, XLM/XCHF, XLM/XAU, LSP/USDC each did over 3,200 trades and never finish).
//   * run inside the build it took **342 seconds over 8 steps**, and a deep walk cannot be parallelised
//     away because a cursor chain is sequential: XLM/USDC alone is 8 x 4.5s of waiting.
//   * past ~12 pages in flight Horizon starts answering non-200 (7 of 40 did), so VOL_PAR is 10.
//
// So volume is NOT part of the build. It is swept BEHIND the response, in waitUntil, a bounded slice of
// work per request: the ranking appears as fast as it did before, the columns fill over the following
// requests, and the map then stands for VOL_TTL -- keyed by pool id, so a ranking rebuild reuses it
// instead of paying again. The client is told `volFilling` and comes back for the rest.
//
// NOTHING IS EVER PUBLISHED AS A LOWER BOUND. The first version of this did: one page per pool, and a
// page that had not reached 24h was published as a "&ge;" figure. Measured, that read **XLM/USDC as
// &ge;$6,892 against a true $52,025** -- 13% of the answer, on the biggest pool on the page, with
// XLM/MTL showing "&ge;0". A number that wrong is not rescued by a symbol in front of it
// ([[a-partial-fetch-presented-as-complete]]). So a pool whose walk is unfinished is simply ABSENT from
// the map and dashes until the walk finishes, and the sweep keeps going: first page for VOL_BATCH
// pools, then VOL_DEEP_PAGES more for VOL_DEEP_PAR of the unfinished ones per request, resuming from a
// stored cursor. 96 of the top 100 finish; the four bot-traded ones hit VOL_MAX_PAGES and dash.
//
// (A resumed walk recomputes its 24h boundary, so it drifts by the seconds or minutes between requests
// out of a 24-hour window. That is a rounding error; carrying the original cut would instead make the
// figure older than the column claims.)
//
// Volume is ONE LEG of each swap, converted at that leg's price -- the conventional denomination, and
// the one the browser layer in _ammdata.js already uses. A pool's two legs are equal in value, so
// summing both would double every figure on the page.
function wantLeg(row) {
  for (const leg of [row.a, row.b]) {
    if (!leg) continue;
    if (leg.code === 'XLM' && !leg.issuer) return { native: true, usePx: true };
  }
  const [uc, ui] = USDC.split(':');
  for (const leg of [row.a, row.b]) {
    if (leg && leg.code === uc && leg.issuer === ui) return { native: false, code: uc, issuer: ui, usePx: false };
  }
  return null;
}
// Which side of this trade is the leg we price, and how much of it moved. A trade names its two assets
// as base/counter in whichever order the ledger recorded them, so both sides are checked -- and a
// credit asset is matched on CODE AND ISSUER, never code alone.
function sideAmount(t, want) {
  const bN = t.base_asset_type === 'native', cN = t.counter_asset_type === 'native';
  if (want.native) {
    if (bN) return +t.base_amount || 0;
    if (cN) return +t.counter_amount || 0;
    return 0;
  }
  if (!bN && t.base_asset_code === want.code && t.base_asset_issuer === want.issuer) return +t.base_amount || 0;
  if (!cN && t.counter_asset_code === want.code && t.counter_asset_issuer === want.issuer) return +t.counter_amount || 0;
  return 0;
}
// One page of one pool's trades. Returns null when the page could not be read -- an unknown, not a zero.
//
// Two attempts, not j()'s four: the sweep counts its subrequest budget per POOL, and a retry it cannot
// see would turn that count into a guess against a hard 50-per-invocation cap.
async function volPage(row, want, price, cut, cursor) {
  // $0 THAT WAS NEVER MEASURED (RAZA 2026-11-18, "looks like this bug is back on staging"): XLM/EURZ, XLM/GBPZ,
  // XLM/SSLX and SSLX/USDC were stored as 0 by a finished pass while Horizon, read directly, gave them
  // $174, $99 and hundreds of in-window trades on page one. A page with no record list -- or an empty FIRST page
  // for a pool that is in the ranking because people trade it -- read as "history ended, sum 0". Neither is
  // evidence of zero volume, so both now count as unread: the other host is tried, and the walk retries later.
  const okPage = (b) => !!(b && b._embedded && Array.isArray(b._embedded.records) && (cursor || b._embedded.records.length));
  const d = await j('/liquidity_pools/' + row.id + '/trades?order=desc&limit=' + PAGE
    + (cursor ? '&cursor=' + cursor : ''), cursor ? VOL_TTL : 0, 2, okPage);   // head page LIVE, history pages cached (2026-11-20: a 28h-stale cached head summed busy pools to $0)
  if (!d) return null;
  const recs = (d._embedded && d._embedded.records) || [];
  let sum = 0, reached = recs.length < PAGE;               // a short page IS the end of this pool's history
  for (const t of recs) {
    const ts = Date.parse(t.ledger_close_time || '');
    if (!(ts >= cut)) { reached = true; break; }            // crossed the boundary: the sum is exact
    sum += sideAmount(t, want);
  }
  return { sum: sum * price, reached, next: recs.length ? recs[recs.length - 1].paging_token : '',
    newest: !cursor && recs[0] ? recs[0].ledger_close_time : undefined };
}

// Walk (or continue walking) one pool, at most `maxPages` pages this time. Exactly one of three answers:
//   {usd}                            the 24h boundary was reached -- a complete, publishable figure
//   {pend:[sum,cursor,pages,fails]}  more pages needed; resume from here on a later request
//   {drop:1}                         past VOL_MAX_PAGES, or unreadable too many times -- show a dash
//
// A PAGE WE COULD NOT READ IS NOT A POOL THAT IS TOO BIG, and conflating the two is what RAZA reported on
// 2026-11-10: XLM/AQUA, XLM/ETH and XLM/LIBRE all dashed on the live page. Measured, they reach the 24h
// boundary in 3, 4 and 7 pages -- nowhere near the cap. They dashed because ONE page read failed and a
// failure returned {drop:1}, which deletes the pool from the map for the rest of VOL_TTL. With VOL_PAR
// pages in flight a transient non-200 from Horizon is ordinary, so this was losing real figures every
// sweep, and losing them in a way that looked exactly like the cap being hit
// ([[never-cache-a-failure-as-an-answer]]). A failed read now keeps its place and is retried.
async function volWalk(row, px, start, maxPages) {
  const want = wantLeg(row);
  if (!want) return { drop: 1 };                           // cannot happen in the ranking; not assumed
  const price = want.usePx ? px : 1;
  const cut = Date.now() - DAY;
  let sum = start ? +start[0] || 0 : 0;
  let cursor = start ? String(start[1] || '') : '';
  let pages = start ? +start[2] || 0 : 0;
  let fails = start ? +start[3] || 0 : 0;
  let newest = start ? start[4] : undefined;
  for (let i = 0; i < maxPages; i++) {
    const p = await volPage(row, want, price, cut, cursor);
    // Unreadable: stop THIS step, keep the cursor, and let a later one carry on from here. Bounded, so a
    // pool Horizon will never serve cannot hold the sweep open for ever -- after VOL_MAX_FAILS it dashes.
    if (!p) return (fails + 1 >= VOL_MAX_FAILS) ? { drop: 1 } : { pend: [sum, cursor, pages, fails + 1] };
    fails = 0;                                             // a page that read resets the run of failures
    if (p.newest) newest = p.newest;
    sum += p.sum; pages++; cursor = p.next;
    if (p.reached || !cursor) return { usd: Math.round(sum * 100) / 100, pages, newest };
    if (pages >= VOL_MAX_PAGES) return { drop: 1 };         // traded past any budget worth spending
  }
  return { pend: [sum, cursor, pages, fails, newest] };
}

// The volume map: { ts, idx, done, busy, map: { poolId: usd }, pend: { poolId: [sum,cursor,pages] } }.
// A few KB, so it is read on every request and written twice per sweep step without going anywhere near
// the 3.4 MB ranking. Every value in `map` is a finished measurement; `pend` holds the unfinished ones,
// which are deliberately NOT in the map.
//
// `idx` is how far through the ranking head this sweep has got. A finished sweep is left alone until it
// is VOL_TTL old, then restarted from 0 WITHOUT clearing the map, so the columns never blank while they
// are being refreshed.
// `dq` is the deep queue's rotation cursor — see the note in volSweep's deep branch.
function volEmpty() { return { ts: 0, idx: 0, rev: 0, dq: 0, done: false, busy: 0, map: {}, pend: {} }; }

// A PARTIAL SUM IS NOT A FIGURE; LAST HOUR'S FINISHED MEASUREMENT STILL IS.
//
// The pend branch used to `delete v.map[id]`, and that is what RAZA reported on 2026-11-13 as "some
// assets not showing vol and fees": XLM/USDC, XLM/SHX, XLM/AQUA, XLM/BTC and XLM/XRP dashed while the
// quiet pools beside them showed figures. Not a coincidence and not a failure -- those are the pools
// whose 24h history runs past one Horizon page. Every VOL_TTL the sweep re-walks the head from idx 0,
// each of those goes `pend` on its first page, and the delete threw away a complete figure measured an
// hour ago. They then dashed for the whole deep walk, which on a deployment with this little traffic
// is many requests -- so the busiest pools on the page were blank for a large part of every hour.
//
// It also defeated the intent stated three lines above volEmpty(): the refresh deliberately keeps
// `map` "so the columns never blank while they are being refreshed". It kept the map and then emptied
// it one pool at a time, for exactly the pools a reader most wants a number against.
//
// So: going pending no longer clears anything. A pool that has never been measured still has no entry
// and still dashes, which is right -- there is nothing to show. A pool being RE-measured keeps the
// figure it already has until the new walk replaces it (or `drop` removes it, below, which is the one
// case where we have positively learned the figure is not obtainable). Worst case a reader sees a
// figure up to VOL_TTL + the walk old, which is what the column already meant between sweeps.
//
// Note this makes `map` and `pend` no longer disjoint, so volDiag's filled + pending can exceed
// VOL_TOP. That is the honest reading of both: filled is how many columns show a figure, pending is
// how many walks are in flight.
function volApply(v, id, r) {
  if (r.pend) { v.pend[id] = r.pend; return; }
  delete v.pend[id];
  if (r.drop) delete v.map[id];                            // positively unobtainable -- not merely unfinished
  else v.map[id] = r.usd;
  // Evidence for every $0: how many pages were read and the newest trade page one showed. Small, and it
  // turns the next "why is this $0" into a lookup instead of a guess.
  if (!r.drop && r.usd === 0) { if (!v.z) v.z = {}; v.z[id] = [r.pages || 0, r.newest || null]; }
  else if (v.z) delete v.z[id];
}

async function volSweep(store, rows, px) {
  const v = Object.assign(volEmpty(), (await store.get(K.vol)) || {});
  if (!v.map) v.map = {};
  if (!v.pend) v.pend = {};
  const top = Math.min(VOL_TOP, rows.length);
  const now = Date.now();
  // The client polls while filling, and each poll would otherwise start its own sweep over the same
  // pools -- 10 concurrent trades pages is already where Horizon starts refusing them.
  if (v.busy && now - v.busy < VOL_BUSY) return v;
  if (v.done) {
    if (now - (v.ts || 0) < VOL_TTL * 1000) return v;
    v.done = false; v.idx = 0; v.pend = {};
  }
  v.busy = now;
  await store.put(K.vol, v, VOL_HOLD);

  if (v.idx < top) {
    // First page of the next VOL_BATCH pools. VOL_PAR at a time, 2 subrequests each worst case.
    const batch = rows.slice(v.idx, v.idx + VOL_BATCH);
    for (let i = 0; i < batch.length; i += VOL_PAR) {
      const group = batch.slice(i, i + VOL_PAR);
      const got = await Promise.all(group.map((r) => volWalk(r, px, null, 1)));
      for (let k = 0; k < group.length; k++) volApply(v, group[k].id, got[k]);
    }
    v.idx += batch.length;
  } else {
    // Head read; now finish the pools that need depth, a few at a time.
    const byId = new Map(rows.map((r) => [r.id, r]));
    // ROTATE THE QUEUE. This took `.slice(0, VOL_DEEP_PAR)` — always the same five keys, in insertion
    // order, until one of them finished. A pool that needs four more pages finishes in one step; a
    // bot-traded pool walks to VOL_MAX_PAGES and sits at the front of the queue for twenty. So the few
    // most expensive pools owned every step while dozens of cheap ones waited behind them, and the
    // columns filled in the slowest possible order — which is what made the fill outlast the page.
    //
    // Serving a moving window instead costs nothing and finishes the cheap ones first, so the table is
    // visibly complete long before the handful of heavy walks are. The cursor is approximate on purpose:
    // finished pools leave `pend` and shift the list, and a rotation does not need to be exact.
    const pkeys = Object.keys(v.pend);
    const start = pkeys.length ? ((+v.dq || 0) % pkeys.length) : 0;
    const ids = pkeys.slice(start, start + VOL_DEEP_PAR);
    if (ids.length < VOL_DEEP_PAR && pkeys.length > ids.length) {
      ids.push(...pkeys.slice(0, Math.min(VOL_DEEP_PAR - ids.length, pkeys.length - ids.length)));
    }
    v.dq = pkeys.length ? ((start + ids.length) % pkeys.length) : 0;
    const got = await Promise.all(ids.map((id) => (byId.has(id)
      ? volWalk(byId.get(id), px, v.pend[id], VOL_DEEP_PAGES)
      : Promise.resolve({ drop: 1 }))));                   // dropped out of the ranking mid-sweep
    for (let k = 0; k < ids.length; k++) volApply(v, ids[k], got[k]);
  }

  if (v.idx >= top && !Object.keys(v.pend).length) { v.done = true; v.ts = Date.now(); }
  v.busy = 0;
  v.rev = (+v.rev || 0) + 1;                               // see volVer: this is what retires cached slices
  await store.put(K.vol, v, VOL_HOLD);
  return v;
}

// The sweep needs the ranking head in TVL order. That is exactly what K.hot is -- 500 rows, 158 KB --
// so it is read instead of the 3.4 MB full list. A missing hot slice means the ranking was only just
// published and KV has not caught up; the next request picks it up.
async function volSweepFrom(store, meta) {
  const hot = await store.get(K.hot);
  if (!hot || !hot.rows || !hot.rows.length) return null;
  return volSweep(store, hot.rows, (hot.px != null ? hot.px : meta && meta.px) || 0);
}

// Stamp the figures onto the rows being served. The map is the source of truth for both columns:
// `vol24` null means the table shows a dash.
function volStamp(rows, v) {
  const map = (v && v.map) || {};
  for (const r of rows) {
    const e = map[r.id];
    r.vol24 = e == null ? null : e;
  }
  return rows;
}

function legOf(rec, want) {
  const rs = rec.reserves || [];
  for (let i = 0; i < rs.length; i++) if (rs[i].asset === want) return i;
  return -1;
}
function assetOut(a) {
  if (a.asset === 'native') return { code: 'XLM', issuer: null, amount: +a.amount || 0 };
  const bits = String(a.asset).split(':');
  return { code: bits[0], issuer: bits[1] || null, amount: +a.amount || 0 };
}

// A full build is 57 upstream calls: 51 pages of XLM-leg pools, 5 of USDC-leg, the price, and the
// overlay. A Worker invocation on the Free plan may make 50 subrequests, so doing it in one go returned
// HTTP 502 in production while working locally, where no such cap exists.
//
// So the build is RESUMABLE. Each request spends at most STEP_BUDGET subrequests, saves its position,
// and returns {warming:true} until the enumeration is complete; the page retries. Two or three requests
// warm it, then it is cached for everyone.
//
// It intentionally does NOT serve a partial ranking in the meantime. Half an enumeration sorted by TVL
// is not a shorter list, it is a list with real pools missing from the middle of it, and it would look
// complete. Warming is visible and honest; a silently truncated ranking is not.
const STEP_BUDGET = 40;

// ---------------------------------------------------------------------------------------------
// WHERE THE RANKING LIVES, AND WHY IT IS SPLIT IN THREE
//
// Measured 2026-08-17, and both numbers decide this design:
//
//   * `caches.default` IS PER DATA CENTER. Cloudflare: "the contents of the cache do not replicate
//     outside of the originating data center." So caching the ranking there warms ONE colo, and every
//     visitor routed anywhere else paid a full ~23s cold build. That -- not the first build -- is what
//     made this page take a minute. KV is globally replicated, so one build serves the whole planet.
//
//   * PARSING THE RANKING COST MORE THAN THE FREE PLAN ALLOWS. The full ranking is 3.38 MB of JSON;
//     JSON.parse + slice(25) measured 14-45 ms, to emit an 8 KB response. The Free plan's budget is
//     10 ms of CPU per request, so EVERY request was over it, including perfect cache hits.
//
// Hence three entries instead of one, so a request reads only what it needs:
//   meta  ~200 B   ts / totals / price. Read on every request.
//   hot   ~158 KB  the top HOT_ROWS rows. Covers page 1..20 at 25/page. Parses in 0.52 ms.
//   full  ~3.4 MB  every row. Touched only by a deep page or a search.
// Written in that order -- data first, meta last -- so the presence of meta implies the data is there.
//
// On top of that, a finished page RESPONSE is cached per (ts, per, page, q) and returned verbatim on a
// hit: no parse at all. Keying it on the ranking's own timestamp means it never needs invalidating --
// a refreshed ranking simply has a new ts and the old slices age out on their own.
const HOT_ROWS = 500;
const K = {
  meta:  'pools:meta:v2',
  hot:   'pools:hot:v2',
  full:  'pools:full:v2',
  state: 'pools:state:v2',
  // v2: the v1 map holds `drop` verdicts made by the old rule, where one unreadable page gave up on a
  // pool for the rest of VOL_TTL. Bumping starts the sweep from nothing rather than waiting up to an
  // hour for those to expire, so the fix is visible on the page instead of eventually.
  vol:   'pools:vol:v3',     // v3 2026-11-18: retire $0 figures stored from unreadable pages (see volPage)
      // the 24h figures, swept separately from the ranking — see volSweep
};

// KV when the binding is present, the per-colo Cache API when it is not. The fallback is the previous
// behaviour exactly, so this deploys safely BEFORE the KV namespace is bound and improves the moment it
// is. Bonus on the Free plan: KV operations do not count against the 50-subrequest budget, Cache API
// calls do.
function mkStore(env) {
  // CONTENT_KV ADDED 2026-11-18 (RAZA: "on staging, first of all its taking awfully long to load the pools, and
  // when it does, it doesnt show anything in volume and fees"). LUMOS_KV was never created, so this ran on the
  // per-colo Cache API: every data centre cold-built the 11,000-pool ranking for its first visitor and swept
  // volume from nothing on its own. CONTENT_KV is what this project has bound (assetsearch, assetmeta, holders
  // use it); every key here is prefixed pools: and carries a TTL, so nothing collides with its content.
  const kv = env && (env.LUMOS_KV || env.POOLS_KV || env.CONTENT_KV);
  if (kv) {
    return {
      kind: 'kv',
      async get(k) { try { return await kv.get(k, 'json'); } catch (_) { return null; } },
      async put(k, v, ttl) {
        try { await kv.put(k, JSON.stringify(v), { expirationTtl: Math.max(60, ttl) }); } catch (_) {}
      },
      async del(k) { try { await kv.delete(k); } catch (_) {} },
    };
  }
  const cache = caches.default;
  const req = (k) => new Request('https://lumoscore.internal/' + encodeURIComponent(k), { method: 'GET' });
  return {
    kind: 'cache',
    async get(k) { try { const r = await cache.match(req(k)); return r ? await r.json() : null; } catch (_) { return null; } },
    async put(k, v, ttl) {
      try {
        await cache.put(req(k), new Response(JSON.stringify(v), {
          headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=' + ttl },
        }));
      } catch (_) {}
    },
    async del(k) { try { await cache.delete(req(k)); } catch (_) {} },
  };
}

// The cached page RESPONSE key. `q` is already uppercased and length-capped by the caller.
// `vv` is the volume map's own version. The body carries figures from that map, so a slice cached under
// an older one is a slice with dashes in it: without vv in the key, the columns would stay empty for
// RANK_HOLD no matter how much the sweep had filled in behind it.
function pageKey(ts, per, page, q, sort, dir, vv) {
  return new Request('https://lumoscore.internal/pools-page/' + ts + '/' + (vv || '0') + '/' + per + '/' + page
    + '/' + encodeURIComponent(q || '') + '/' + (sort || 'tvl') + (dir === 'asc' ? 'a' : 'd'), { method: 'GET' });
}
// `rev` is in here and not just ts/idx because of a measured failure: during the deep pass neither ts
// (still 0) nor idx (already at VOL_TOP) moves, so the key stopped changing and the fast path served one
// request's body verbatim for the next TWELVE while 29 more figures were landing in the map behind it.
// rev is bumped on every sweep write, so a slice is only reused while the map behind it is unchanged.
function volVer(v) { return v ? ((v.ts || 0) + '-' + (v.idx || 0) + '-' + (v.rev || 0)) : '0'; }

// COLUMN SORTING, RANKED ACROSS THE WHOLE LIST (RAZA 2026-09-17: "Let me short the pool columns (Liq, Vol, Fees,
// Participants) from high to low just like im able to sort Trade main page columns").
//
// It was refused before for a reason that was right at the time: the browser holds 25 of ~11,000 ranked rows, so sorting
// what it has would reorder one page and present the result as the top of the list. The ranking lives HERE, whole, so
// the sort belongs here too — every row, then the page cut from it, cached per column exactly like the default one is.
//
// Fees are volume x the pool's own fee rate, which is how the table's Fees column is computed, so sorting by it sorts
// the number the reader is actually looking at.
const SORTS = {
  tvl: (r) => (r.tvl == null ? null : +r.tvl),
  vol: (r) => (r.vol24 == null ? null : +r.vol24),
  fees: (r) => (r.vol24 == null ? null : (+r.vol24) * (+r.fee || 0) / 100),
  members: (r) => (r.members == null ? null : +r.members),
};

// A row whose figure was never measured is not a row worth zero. vol24 is null on every pool the volume overlay did not
// cover, and sorting those in as zeros would bury real pools beneath them ascending and pad the bottom descending. They
// go last in both directions, which is the only position that claims nothing about them.
function rankBy(rows, sort, dir) {
  const f = SORTS[sort] || SORTS.tvl;
  const sign = dir === 'asc' ? 1 : -1;
  return rows.slice().sort((x, y) => {
    const a = f(x), b = f(y);
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return sign * (a - b);
  });
}
// How long the ranking SURVIVES in cache. Freshness is judged separately, by its own timestamp against
// RANK_TTL, so this is not "how stale a visitor may see" -- a stale entry is served instantly and
// refreshed behind the response. This is only the window in which a cold build becomes possible again.
//
// Six hours, not one, and the reason is what a cold build costs a VISITOR: it is the single slow path
// left on this page (~25s, spread over two warming requests) and it is also why the volume column comes
// up empty -- the overlay only lands when the whole ranking completes. Every hour of hold is an hour in
// which nobody can hit that. The set of pools barely moves; only their values do, and those are refreshed
// on the stale path regardless.
const RANK_HOLD = 21600;
const SEARCH_TTL = 600;
const SEARCH_ASSETS = 6;     // distinct assets one query will chase; see searchPools

// SEARCH IS A LIVE QUERY, not a filter over the ranking.
//
// The ranking only contains pools we can price -- 10,962 of 39,844 -- so filtering it answered "which
// PRICEABLE pools mention this asset". Searching LUMOS returned 6 while Horizon has 59 for that issuer;
// the missing 53 pair it with neither XLM nor Circle USDC, so they can never enter the ranking and could
// never be found. The pools page said 6, the asset's own Trade page said 59, and the pools page was wrong.
//
// Horizon can answer this exactly with ?reserves=CODE:ISSUER -- but only if you know the ISSUER, and a
// search box gives a code. So the ranking is used for what it is good at: resolving a typed code to real
// (code, issuer) pairs. Then each is asked of Horizon directly. A couple of requests, and the answer is
// every pool that holds the asset rather than only the ones we happen to be able to value.
//
// Consequence, stated rather than hidden: a pool with no XLM and no USDC leg has no USD value we can
// compute, so its tvl is null. Those sort last and the page shows a dash -- an unknown, not a zero.
async function searchPools(ranked, q) {
  const rowsById = new Map();
  for (const r of ranked.rows) rowsById.set(r.id, r);

  // (code, issuer) pairs the ranking knows whose code contains the query, plus any logo we have for them
  const assets = new Map(), imgByKey = new Map();
  for (const r of ranked.rows) {
    for (const leg of [r.a, r.b]) {
      if (!leg || !leg.issuer) continue;
      const key = leg.code + ':' + leg.issuer;
      if (leg.img && !imgByKey.has(key)) imgByKey.set(key, leg.img);
      if (String(leg.code).toUpperCase().indexOf(q) >= 0 && !assets.has(key)) assets.set(key, leg);
    }
  }
  // Exact code matches first, so "LUMOS" chases LUMOS before BLUMOS/yLUMOS/xLUMOS when the cap bites.
  const keys = [...assets.keys()].sort((a, b) => {
    const ea = a.split(':')[0].toUpperCase() === q ? 0 : 1, eb = b.split(':')[0].toUpperCase() === q ? 0 : 1;
    return ea - eb;
  });
  const chased = keys.slice(0, SEARCH_ASSETS);

  // Nothing in the ranking carries this code. That is not the same as "no pools hold it": ranking
  // requires a leg we can price, so an asset whose every pool is small and XLM-less is invisible here
  // however many pools it has. Ask Horizon, which indexes assets regardless of what they are worth.
  // Exact code only -- a substring match would chase a different asset that merely contains the letters,
  // which on a money page is worse than no result. (The client upper-cases the query, so a mixed-case
  // code such as DicInu is not resolvable through this path; the ranking still handles those.)
  // Resolve the code straight from Horizon's asset index, which does not care whether the asset can be
  // valued. Returns only keys we did not already have. Exact code only: a substring match would chase a
  // different asset that merely contains the letters, which on a money page is worse than no result.
  // (The client upper-cases the query, so a mixed-case code such as DicInu is not resolvable this way;
  // the ranking still handles those.)
  async function resolveFromHorizon() {
    const added = [];
    try {
      const d = await j('/assets?asset_code=' + encodeURIComponent(q) + '&limit=' + SEARCH_ASSETS, SEARCH_TTL);
      for (const rec of ((d && d._embedded && d._embedded.records) || [])) {
        const code = String(rec.asset_code || ''), issuer = String(rec.asset_issuer || '');
        if (code.toUpperCase() !== q || !/^G[A-Z2-7]{55}$/.test(issuer)) continue;
        const key = code + ':' + issuer;
        if (assets.has(key)) continue;
        assets.set(key, { code, issuer });
        added.push(key);
        if (added.length >= SEARCH_ASSETS) break;
      }
    } catch (e) { /* answer with whatever the ranking gave us */ }
    return added;
  }

  if (!chased.length) chased.push(...(await resolveFromHorizon()));

  const found = new Map();
  async function chase(keys) {
    for (const key of keys) {
      let cursor = '';
      for (let page = 0; page < 4; page++) {
        const d = await j('/liquidity_pools?reserves=' + encodeURIComponent(key) + '&limit=' + PAGE
          + '&order=asc' + (cursor ? '&cursor=' + cursor : ''), SEARCH_TTL);
        const recs = (d && d._embedded && d._embedded.records) || [];
        if (!recs.length) break;
        for (const rec of recs) if (!found.has(rec.id)) found.set(rec.id, rec);
        if (recs.length < PAGE) break;
        cursor = recs[recs.length - 1].paging_token;
      }
    }
  }
  await chase(chased);

  // The ranking resolving a code is not the same as it resolving the RIGHT issuer -- a ticker is not an
  // identity on Stellar. If the chase came back empty, ask Horizon for the code and chase whatever it
  // names as well. Only reached when the answer would otherwise be "no pools", so no query that already
  // returns something pays for it.
  if (!found.size) await chase(await resolveFromHorizon());

  const out = [];
  for (const [id, rec] of found) {
    // Already ranked? Use that row -- it carries the volume overlay and logos.
    const known = rowsById.get(id);
    if (known) { out.push(known); continue; }
    const rs = (rec.reserves || []).map(assetOut);
    const xi = legOf(rec, 'native'), ui = legOf(rec, USDC);
    const tvl = xi >= 0 ? 2 * (+rec.reserves[xi].amount || 0) * ranked.px
      : (ui >= 0 ? 2 * (+rec.reserves[ui].amount || 0) : null);
    for (const leg of rs) {
      if (leg.code === 'XLM' && !leg.issuer) { leg.img = '/assets/tokens/xlm.png'; continue; }
      const u = imgByKey.get(leg.code + ':' + leg.issuer);
      if (u) leg.img = u;
    }
    out.push({
      id, a: rs[0] || null, b: rs[1] || null,
      tvl: tvl == null ? null : Math.round(tvl * 100) / 100,
      fee: (+rec.fee_bp || 0) / 100, members: +rec.total_trustlines || 0, vol24: null,
    });
  }
  // Valued pools first, largest down; unvaluable ones after, busiest first. A null is not a zero and must
  // not sort as one.
  out.sort((x, y) => {
    const xn = x.tvl == null, yn = y.tvl == null;
    if (xn !== yn) return xn ? 1 : -1;
    if (xn) return (y.members || 0) - (x.members || 0);
    return y.tvl - x.tvl;
  });
  return { rows: out, assetsChased: chased.length, assetsMatched: keys.length };
}

// Publish a completed build. Data first, meta last: a reader that sees meta can rely on hot/full being
// there, and one that races in between simply sees no meta and treats it as not-yet-built.
async function publish(store, rows, px) {
  const meta = {
    ts: Date.now(),
    px,
    total: rows.length,
    ranked: rows.length,
    hot: Math.min(HOT_ROWS, rows.length),
  };
  await store.put(K.full, { rows, px }, RANK_HOLD);
  await store.put(K.hot, { rows: rows.slice(0, HOT_ROWS), px }, RANK_HOLD);
  await store.put(K.meta, meta, RANK_HOLD);
  await store.del(K.state);
  return { meta, rows };
}

// Advance the resumable build by one budget. Returns {meta, rows} once complete, or null while still
// building. Safe to call from waitUntil: it only ever REPLACES the published ranking once a build
// completes, so a rebuild in flight never takes away the answer that is already being served.
//
// It returns the rows it just built rather than re-reading them, because KV is eventually consistent --
// a read immediately after a write can still answer with the old value, or nothing.
//
// THE RANKING'S FRESHNESS NO LONGER SAYS ANYTHING ABOUT VOLUME. It used to: a build that published with
// withVol 0 reported itself fresh for RANK_HOLD (6 hours), so a deployed fix stayed invisible --
// production only recovered because real traffic kept advancing the state machine, while staging, which
// gets almost no traffic, served the pre-fix build for hours after the fix was live (RAZA 2026-09-17:
// "make sure that stellar staging is alligned with stellar main"). Volume now has its own map with its
// own TTL, advanced by its own sweep on every request, so that coupling is gone rather than tuned.
function needsRebuild(meta) {
  if (!meta || !meta.ts) return true;
  return Date.now() - meta.ts > RANK_TTL * 1000;
}

async function advance(store) {
  let state = await store.get(K.state);
  state = await buildStep(state);
  if (state.phase !== 'done') {
    await store.put(K.state, state, 900);
    return null;
  }
  return publish(store, state.rows, state.px);
}

function rowsFrom(recs, priceLeg, px, seen, rows) {
  for (const rec of recs) {
    if (seen[rec.id]) continue;
    const i = legOf(rec, priceLeg);
    if (i < 0) continue;                       // the reserves= filter is exact, but do not assume it
    seen[rec.id] = 1;
    const rs = (rec.reserves || []).map(assetOut);
    rows.push({
      id: rec.id,
      a: rs[0] || null,
      b: rs[1] || null,
      tvl: Math.round(2 * (+rec.reserves[i].amount || 0) * px * 100) / 100,
      fee: (+rec.fee_bp || 0) / 100,           // basis points -> percent
      members: +rec.total_trustlines || 0,
      vol24: null,
    });
  }
}

// One resumable step. Returns the state; state.phase === 'done' means the ranking is in state.rows.
async function buildStep(state) {
  let spent = 0;
  if (!state) {
    const px = await xlmUsd(); spent++;
    if (!(px > 0)) throw new Error('no XLM price');
    state = { phase: 'native', cursor: '', px, rows: [], seen: {} };
  }
  if (state.phase === 'native') {
    const r = await enumerate('reserves=native', state.cursor, STEP_BUDGET - spent);
    spent += Math.ceil(r.recs.length / PAGE) || 1;
    rowsFrom(r.recs, 'native', state.px, state.seen, state.rows);
    state.cursor = r.cursor;
    if (r.done) { state.phase = 'usdc'; state.cursor = ''; }
    if (spent >= STEP_BUDGET - 1) return state;
  }
  if (state.phase === 'usdc') {
    const r = await enumerate('reserves=' + encodeURIComponent(USDC), state.cursor, STEP_BUDGET - spent);
    spent += Math.ceil(r.recs.length / PAGE) || 1;
    // Pools with BOTH legs were already priced off XLM above and are skipped by `seen` -- pricing the
    // same pool off two different legs would give it two different TVLs depending on which loop won.
    rowsFrom(r.recs, USDC, 1, state.seen, state.rows);
    state.cursor = r.cursor;
    // THE RANKING IS SORTED HERE, where it is also the thing that decides which pools the volume sweep
    // walks: "the top VOL_TOP" is only meaningful once the list is in order, and the sweep reads that
    // order back out of K.hot rather than sorting again.
    if (r.done) {
      state.rows.sort((x, y) => y.tvl - x.tvl);
      state.phase = 'done';
      delete state.seen;                        // ~10,962 keys that nothing reads again
    }
    if (spent >= STEP_BUDGET - 1) return state;
  }
  return state;
}

export async function onRequestGet(ctx) {
  const url = new URL(ctx.request.url);
  const per = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per') || '25', 10) || 25));
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const qRaw = (url.searchParams.get('q') || '').trim().toUpperCase().slice(0, 24);
  // Default is the ranking as built — by TVL, descending — so the ordinary page costs exactly what it did before.
  const sortRaw = String(url.searchParams.get('sort') || 'tvl').toLowerCase();
  const sort = Object.prototype.hasOwnProperty.call(SORTS, sortRaw) ? sortRaw : 'tvl';
  const dir = String(url.searchParams.get('dir') || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
  const reranked = !(sort === 'tvl' && dir === 'desc');

  const cache = caches.default;
  const store = mkStore(ctx && ctx.env);
  const later = (p) => { try { ctx && ctx.waitUntil && ctx.waitUntil(p); } catch (_) {} };

  try {
    let meta = await store.get(K.meta);
    // The volume map, read alongside meta. It is a few KB, so this costs nothing next to the ranking,
    // and both the cache key and the figures in the body depend on it.
    const vol = await store.get(K.vol);
    // NOT computed here. `meta` can still be null at this point -- the very first request builds the
    // ranking further down and only then has one -- and a volFilling read off a null meta is how the
    // first request that actually serves rows told the client there was nothing more to come, and then
    // never swept. It is decided once meta is settled, in volFill() below.
    // A FINISHED MAP IS RE-MEASURED EVERY VOL_TTL (2026-11-20). This used to be `!(vol && vol.done)` alone, and it is the
    // only thing that schedules volSweepFrom -- so volSweep's "finished and VOL_TTL old: walk the head again" branch was
    // never reached. Finished figures, stale $0s included, froze until the KV expiry deleted them, then dashed while the walk
    // restarted from zero (RAZA: "i have literally got this fixed so many times but it comes back again"). The re-walk
    // keeps the map, so nothing blanks while it runs.
    const volFill = () => !(vol && vol.done) || (Date.now() - ((vol && vol.ts) || 0) >= VOL_TTL * 1000);

    // FAST PATH -- one cache read, no JSON parsed, response returned verbatim. This is what makes a warm
    // request cost ~0 ms of CPU instead of the 14-45 ms that parsing 3.38 MB to emit 8 KB used to cost.
    if (meta && meta.ts) {
      const hit = await cache.match(pageKey(meta.ts, per, page, qRaw, sort, dir, volVer(vol)));
      if (hit) {
        if (needsRebuild(meta)) later(advance(store));
        else if (volFill()) later(volSweepFrom(store, meta));
        // Re-headered, not re-read: the stored copy carries a long max-age so it survives as long as its
        // ranking does, but the CLIENT must still be told 120s or a browser would hold this for hours.
        // Passing the body through as a stream copies no bytes and parses nothing.
        return new Response(hit.body, {
          headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=120' },
        });
      }
    }

    // STALE-WHILE-REVALIDATE. The ranking used to be cached for 15 minutes and then simply vanish, so
    // every 15 minutes the next visitor paid for a full rebuild and watched "warming" for ~25s.
    //
    // Freshness is judged by the entry's own timestamp, separately from how long it survives: a stale
    // ranking is served IMMEDIATELY and the rebuild is advanced behind the response. Nobody waits on a
    // rebuild except the very first visitor ever, and a rebuild in progress never removes the answer
    // that already works.
    let built = null;
    if (!meta) {
      built = await advance(store);
      if (!built) {
        const st = (await store.get(K.state)) || {};
        return new Response(JSON.stringify({
          warming: true, scanned: (st.rows || []).length, phase: st.phase || 'native',
        }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
      }
      meta = built.meta;
    } else if (needsRebuild(meta)) {
      later(advance(store));
    }

    let rows, total, pages, start, searchMeta = null;

    if (qRaw) {
      // Search resolves a typed CODE to real (code, issuer) pairs off the ranking, so it needs every row.
      // Cached per query, so the same search repeated -- paging through it, or another visitor -- is free.
      const sKey = new Request('https://lumoscore.internal/lxapi/pools-q/' + encodeURIComponent(qRaw), { method: 'GET' });
      let hitS = null;
      try { const c = await cache.match(sKey); if (c) hitS = await c.json(); } catch (_) {}
      if (!hitS) {
        const full = (built && { rows: built.rows, px: meta.px }) || await store.get(K.full);
        if (!full) return new Response(JSON.stringify({ warming: true, scanned: 0, phase: 'native' }), {
          headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
        });
        hitS = await searchPools({ rows: full.rows, px: meta.px }, qRaw);
        later(cache.put(sKey, new Response(JSON.stringify(hitS), {
          headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=' + SEARCH_TTL },
        })));
      }
      // A search result set is small and already in hand, so the same column ordering applies there for free.
      // Stamped BEFORE the sort, because sort=vol and sort=fees both read vol24 — ordering rows by a
      // figure that has not been written onto them yet would rank the whole list as unmeasured.
      volStamp(hitS.rows, vol);
      rows = reranked ? rankBy(hitS.rows, sort, dir) : hitS.rows;
      total = rows.length;
      pages = Math.max(1, Math.ceil(total / per));
      start = Math.min((page - 1) * per, Math.max(0, (pages - 1) * per));
      searchMeta = { assetsChased: hitS.assetsChased, assetsMatched: hitS.assetsMatched };
    } else {
      total = meta.total;
      pages = Math.max(1, Math.ceil(total / per));
      // Clamp FIRST, then decide how much of the ranking to read -- an out-of-range page clamps back to
      // the last one, which may sit far outside the hot slice even though `page` looked small.
      start = Math.min((page - 1) * per, Math.max(0, (pages - 1) * per));
      // The hot slice is the TOP of the TVL ranking, so it holds the right rows only while that is the order being
      // served. Under any other column the answer can come from anywhere in the list, so the whole one is read.
      const blob = (built && { rows: built.rows })
        || await store.get((reranked || start + per > meta.hot) ? K.full : K.hot);
      if (!blob || !blob.rows) {
        // meta without its data: the entries expire together, but KV is eventually consistent and one
        // can lag. Rebuild rather than answer with an empty list that would look like "no pools".
        later(advance(store));
        return new Response(JSON.stringify({ warming: true, scanned: 0, phase: 'native' }), {
          headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
        });
      }
      volStamp(blob.rows, vol);
      rows = reranked ? rankBy(blob.rows, sort, dir) : blob.rows;
    }

    const vmap = (vol && vol.map) || {};
    const vkeys = Object.keys(vmap);
    const body = JSON.stringify({
      page: Math.floor(start / per) + 1,
      per, pages, total,
      ranked: meta.ranked,
      sort, dir,
      unpriceable: 28882,          // measured; pools with neither an XLM nor a Circle USDC leg
      withVol: vkeys.length,
      // Told to the client so it comes back for the rest instead of settling for the dashes it got.
      volFilling: volFill(),
      volDiag: {
        top: VOL_TOP,
        swept: (vol && vol.idx) || 0,
        filled: vkeys.length,
        pending: Object.keys((vol && vol.pend) || {}).length,
        ts: (vol && vol.ts) || 0,
        zeros: (vol && vol.z) || {},
      },
      xlmUsd: meta.px,
      ts: meta.ts,
      // Present only on a search, and only worth reading when assetsChased < assetsMatched: the query
      // matched more distinct assets than one request will chase, so the result is not the whole answer.
      search: searchMeta,
      rows: rows.slice(start, start + per),
    });

    // The stored copy outlives the served one on purpose. The client is told 120s so its own numbers
    // refresh; the slice is keyed on the ranking's ts, so it stays valid for as long as that ranking is
    // the published one and never needs invalidating.
    later(cache.put(pageKey(meta.ts, per, page, qRaw, sort, dir, volVer(vol)), new Response(body, {
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=' + RANK_HOLD },
    })));
    // Behind the response, never in front of it: a /trades page costs ~4.5s and there are VOL_BATCH of
    // them to do. The answer has already been built above; this only decides what the NEXT request sees.
    if (volFill()) later(volSweepFrom(store, meta));

    return new Response(body, {
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=120' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e && e.message) || e) }), {
      status: 502, headers: { 'content-type': 'application/json' },
    });
  }
}

export async function onRequest(ctx) {
  if (ctx.request.method === 'GET') return onRequestGet(ctx);
  return new Response('{"error":"method not allowed"}', {
    status: 405, headers: { 'content-type': 'application/json', allow: 'GET' },
  });
}
