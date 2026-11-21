// Cloudflare Pages Function — the Dashboard's Network Stats strip: Assets, Pools, Trades, Ledger.
//
// WHY THIS FILE HAS BEEN REWRITTEN TWICE IN THREE DAYS
//
// It used to read stellar.expert's /ledger/ledger-stats and /asset-stats/overall. Both now answer
// **HTTP 402 Payment Required** ([[stellar-expert-api-went-paid]]), so for days it returned 502 and the
// strip showed dashes — or worse, the page silently redisplayed each visitor's figures from their last
// successful visit, so a returning visitor saw five-day-old numbers presented as current.
//
// On 2026-11-10 I replaced the four pills with throughput figures Horizon gives for free (ledger,
// tx/sec, ops/sec, close time). RAZA's answer was that those are not the stats the dashboard is for.
// So this version puts the ORIGINAL FOUR LABELS back, each on the closest source we own.
//
// ⚠ THE NUMBERS ARE NOT THE OLD NUMBERS, AND THAT IS NOT A BUG. The old ones were stellar.expert's
// private aggregates, and nothing free reproduces them. Measured 2026-11-12:
//
//   pill      old (stellar.expert)   now (ours)      why they differ
//   ------    --------------------   -----------     ---------------------------------------------
//   Assets    3,862                  428,469         theirs was a RATED subset; this is every asset
//                                                    the ledger holds, counted off Horizon
//   Pools     15,630                 40,082          same figure the Pools page states — the ranked
//                                                    11,200 plus the measured 28,882 unpriceable
//   Trades    82,015 / UTC day       ~864,000 / 24h  theirs counted DEX trades only for the last
//                                                    complete day; this is every trade Horizon
//                                                    reports, projected from a measured window
//   Accounts  278,820,000            10,046,016      theirs counted every account EVER funded, a
//                                                    cumulative total that still includes accounts
//                                                    since merged away. This is how many accounts
//                                                    hold a balance TODAY — the same kind of figure
//                                                    XRPL's strip shows (8.65M), so the two chains
//                                                    are finally comparable.
//
// 2026-11-12, RAZA: "instead of Ledger on the right side, it was accounts. Please compare with XRPL
// and fix it". He was right and I had the wrong end of it: I retired the Accounts pill after finding
// stellar.expert 402, having concluded "nothing free publishes an account total". That conclusion was
// never tested against anything except stellar.expert ([[never-cache-a-failure-as-an-answer]] — the
// one source refusing is not the same as no source existing). CoinMetrics' COMMUNITY api publishes
// it, free, keyless and daily, and XRPL's own strip had been reading a third-party aggregate
// (xrpl.to's global.totalAddresses) for exactly this figure the whole time. The precedent was already
// in the codebase; I just never looked at it.
//
// Anything we cannot measure is returned as null, never as a zero and never as a stale copy
// ([[never-cache-a-failure-as-an-answer]]).
//
// Deliberately narrow: GET only, no parameters, fixed upstream URLs. Reads no secret, touches no funds.

const HORIZON_LEDGERS = 'https://horizon.stellar.org/ledgers?order=desc&limit=100';
const HORIZON_TRADES = 'https://horizon.stellar.org/trades?order=desc&limit=200';
const HORIZON_ASSETS = 'https://horizon.stellar.org/assets?limit=200&order=asc';
const TTL = 60;

// --- pools -----------------------------------------------------------------------------------------
// Read straight out of the ranking /lxapi/pools already built from Horizon and holds in KV. Zero
// subrequests, and it cannot disagree with the Pools page because it is literally the same rows.
// UNPRICEABLE must match pools.js and poolstats.js — the measured count of pools with neither an XLM
// nor a Circle USDC leg, which therefore have no path to a USD price.
const K_POOLS_FULL = 'pools:full:v2';
// THE SMALL RECORD, FROM WHERE pools.js WRITES IT (2026-11-19). pools.js moved its state to CONTENT_KV on 11-18
// (LUMOS_KV was never created). This file kept reading the 3.4 MB ranking through its own store, which still
// named LUMOS_KV/POOLS_KV only -- so it found the per-colo cache nothing writes any more, and the Dashboard's
// Pools pill sat on "pending" (health report). Only the COUNT is needed, and pools:meta carries it as `ranked`,
// so the pill no longer parses 3.4 MB either. netstats' own keys stay in their old store: they are written
// often, and KV writes are the scarce resource on this plan.
const K_POOLS_META = 'pools:meta:v2';
function poolsMeta(env) {
  const kv = env && (env.LUMOS_KV || env.POOLS_KV || env.CONTENT_KV);
  if (!kv) return Promise.resolve(null);
  return kv.get(K_POOLS_META, 'json').catch(() => null);
}
const UNPRICEABLE = 28882;

// --- assets ----------------------------------------------------------------------------------------
// Counting every asset means paging Horizon to exhaustion: 2,143 pages at 200/page, 24 minutes end to
// end when I measured it on 2026-11-12. That cannot happen inside one request on a plan that caps an
// invocation at 50 subrequests and ~10ms of CPU. So it is accumulated a few pages at a time BEHIND the
// response, in waitUntil, with the cursor parked in KV — the same shape pools.js uses for its volume
// sweep. A pass only publishes when it COMPLETES; a half-finished pass is never shown as a total
// ([[a-partial-fetch-presented-as-complete]]).
// --- trades ----------------------------------------------------------------------------------------
// TRADES PER LEDGER x LEDGERS PER DAY. Getting here took three wrong estimators, and the wrong ones all
// LOOKED fine, so the reasoning is written down:
//
//  1. "200 trades / the span between their timestamps." `ledger_close_time` is per LEDGER and ledgers
//     close every ~5s, so that span is quantised to 5s steps and the oldest ledger in the page is only
//     partly sampled. Measured 576,000 and 3,456,000 per day within twenty minutes — a 6x spread.
//  2. Smoothing that. A moving average over a BIASED estimator converges on the bias, not the truth.
//  3. "Group one page by ledger, drop the partial ends." Unbiased in principle, and 4.6x too LOW in
//     practice (381,000 against 1,750,000). When a ledger is busy, all 200 trades of the page land
//     inside it, there is no complete ledger left to measure, and the sample is skipped — so it only
//     ever sees QUIET ledgers. Survivorship bias, and it is invisible unless you measure it against a
//     wider sample.
//
// What works: walk enough pages to cover ~16 ledgers, drop the partial ledger at each end, and average
// the complete ones. Measured twice, two minutes apart: 103.7 and 99.4 trades per ledger — 4% apart.
// That costs 8 subrequests and a few MB of scanning, so it does NOT run on the hot path: it runs behind
// the response at most every TRADES_REFRESH_MS, and the figure lives in KV between sweeps.
const K_TRADES = 'netstats:trades:v1';
const TRADES_PAGES = 8;
const TRADES_REFRESH_MS = 10 * 60 * 1000;
const TRADES_WEIGHT = 0.3;          // across sweeps, each of which is already a 14-ledger average
const TRADES_MIN_LEDGERS = 8;       // a sweep narrower than this says more about the window than the rate
// Until the first sweep lands, publish what I measured by hand on 2026-11-12 (the mean of those two
// runs), exactly as ASSETS_MEASURED does. A seeded figure that says where it came from beats a dash.
const TRADES_PER_LEDGER_MEASURED = 101.5;
// --- accounts ---------------------------------------------------------------------------------------
// ACCOUNTS HOLDING A BALANCE, from CoinMetrics' community API — free, no key, no attribution header,
// one small JSON body. `AdrBalCnt` is their count of addresses with a non-zero balance, published once
// a day; Stellar accounts must hold a base reserve to exist at all, so for this chain "has a balance"
// and "exists" are the same set.
//
// Asked for the last 2 days and take the LAST row, never the first: the series is ascending by time and
// the newest day is sometimes still absent, in which case the previous one is the right answer rather
// than a gap. One day of lag on a running total that moves ~2,000 a day is not a figure anyone can see.
const COINMETRICS_ACCOUNTS =
  'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=xlm&metrics=AdrBalCnt&frequency=1d&page_size=2';
const K_ACCOUNTS = 'netstats:accounts:v1';
const ACCOUNTS_REFRESH_MS = 6 * 3600 * 1000;    // the series only moves daily; six hours is already eager
const ACCOUNTS_MEASURED = 10046016;             // 2026-11-11 row, read by hand 2026-11-12
const ACCOUNTS_MEASURED_AT = '2026-11-12';

const K_ASSETS = 'netstats:assets:v1';
const ASSET_PAGES_PER_REQ = 8;     // ~1.6MB of text scanned per request; the pages are not JSON.parsed
const ASSET_REFRESH_MS = 24 * 3600 * 1000;
// Until the first live pass finishes, publish the figure I measured by hand, with the date it was
// taken, exactly as poolstats.js publishes UNPRICEABLE. A measured constant that says when it was
// measured is honest; a zero or a dash while 2,143 pages grind through is not.
const ASSETS_MEASURED = 428469;
const ASSETS_MEASURED_AT = '2026-11-12';

const SUB_TIMEOUT_MS = 6000;
async function timed(url, opts) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), SUB_TIMEOUT_MS);
  try { return await fetch(url, { ...opts, signal: ac.signal }); } finally { clearTimeout(t); }
}

// Same store, same fallback as pools.js/poolstats.js: KV when the binding is present, the per-colo
// Cache API when it is not (staging has preview bindings, so it often is not).
function mkStore(env) {
  const kv = env && (env.LUMOS_KV || env.POOLS_KV);
  if (kv) {
    return {
      async get(k) { try { return await kv.get(k, 'json'); } catch (_) { return null; } },
      async put(k, v, ttl) { try { await kv.put(k, JSON.stringify(v), { expirationTtl: Math.max(60, ttl) }); } catch (_) {} },
    };
  }
  const cache = caches.default;
  const req = (k) => new Request('https://lumoscore.internal/' + encodeURIComponent(k), { method: 'GET' });
  return {
    async get(k) { try { const r = await cache.match(req(k)); return r ? await r.json() : null; } catch (_) { return null; } },
    async put(k, v, ttl) {
      try {
        await cache.put(req(k), new Response(JSON.stringify(v), {
          headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=' + Math.max(60, ttl) },
        }));
      } catch (_) {}
    },
  };
}

// Rates over the window the ledgers themselves describe — never over an assumed 5s close time. Stellar
// targets 5s but does not guarantee it, and dividing by a constant would quietly turn a slow patch on
// the network into a figure that looks like normal throughput.
function summarise(recs) {
  if (!Array.isArray(recs) || recs.length < 2) return null;
  const newest = recs[0], oldest = recs[recs.length - 1];
  const t1 = Date.parse(newest.closed_at), t0 = Date.parse(oldest.closed_at);
  if (!isFinite(t1) || !isFinite(t0) || t1 <= t0) return null;
  const span = (t1 - t0) / 1000;
  let tx = 0, ops = 0;
  for (const l of recs) {
    // SUCCESSFUL only. Stellar carries a large, steady volume of failed arbitrage attempts — 24,152 of
    // them in a 17-minute sample — and counting those would roughly double the headline for no work done.
    tx += +l.successful_transaction_count || 0;
    ops += +l.operation_count || 0;
  }
  const seq = +newest.sequence || 0;
  if (!seq) return null;
  return {
    ledger: seq,
    tps: +(tx / span).toFixed(1),
    opsPerSec: +(ops / span).toFixed(1),
    closeTime: +(span / (recs.length - 1)).toFixed(2),
    windowLedgers: recs.length,
    windowSec: Math.round(span),
    ts: Math.floor(t1 / 1000),
  };
}

// TRADES: a RATE measured over a real window, then projected to 24h. NOT a count, and the caller is
// given `tradesWindowSec` so it can say so. Counting a real day means ~4,320 pages of /trades, which is
// two orders of magnitude past what one invocation may spend.
//
// The body is scanned as TEXT rather than JSON.parsed: 200 trade records is ~150KB, and parsing it to
// read two timestamps and a length would be most of this worker's 10ms CPU budget.
// ⚠ `\s*` after every colon is REQUIRED, not defensive: Horizon pretty-prints, so the bytes on the wire
// are `"ledger_close_time": "2026-…"`. A scanner written against the compact form matches ZERO times and
// the figure comes back null — which reads on the dashboard as "no trades data", not as a broken regex.
//
// Walks TRADES_PAGES pages, tallies trades per ledger across all of them, then drops the newest and the
// oldest ledger because each is cut by the page boundary rather than by the ledger closing.
async function sweepTrades() {
  const tally = new Map();
  let cursor = '', pages = 0;
  for (let i = 0; i < TRADES_PAGES; i++) {
    let txt;
    try {
      const r = await timed(HORIZON_TRADES + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''));
      if (!r.ok) break;
      txt = await r.text();
    } catch (_) { break; }
    const re = /"ledger_close_time":\s*"([^"]+)"/g;
    let m;
    while ((m = re.exec(txt))) tally.set(m[1], (tally.get(m[1]) || 0) + 1);
    const re2 = /"paging_token":\s*"([^"]*)"/g;
    let m2, lastTok = '';
    while ((m2 = re2.exec(txt))) lastTok = m2[1];
    pages++;
    if (!lastTok) break;
    cursor = lastTok;
  }
  const keys = [...tally.keys()].sort();
  if (keys.length < 4) return null;          // too few ledgers for the ends to be droppable
  const complete = keys.slice(1, -1).map((k) => tally.get(k));
  const total = complete.reduce((a, b) => a + b, 0);
  return { perLedger: total / complete.length, ledgers: complete.length, trades: total, pages };
}

// ACCOUNTS: one small read, behind the response. Returns null on any failure so the caller keeps the
// figure it already had — a count we could not refresh is not a count of zero.
async function fetchAccounts() {
  try {
    const r = await timed(COINMETRICS_ACCOUNTS, {
      cf: { cacheTtlByStatus: { '200-299': 3600, '300-399': 0, '400-599': 0 }, cacheEverything: true },
    });
    if (!r.ok) return null;
    const j = await r.json();
    const rows = (j && Array.isArray(j.data)) ? j.data : [];
    if (!rows.length) return null;
    const last = rows[rows.length - 1];
    const n = parseInt(last && last.AdrBalCnt, 10);
    if (!isFinite(n) || n <= 0) return null;
    const at = Date.parse(last.time);
    return { total: n, at: isFinite(at) ? at : Date.now(), ts: Date.now() };
  } catch (_) { return null; }
}

// ASSETS: advance the count a few pages, from wherever the last request left off. Returns the new state.
// Counts by scanning for the record separator rather than parsing — same reason as tradesFromText.
async function advanceAssets(state) {
  let st = state && typeof state === 'object' ? state : {};
  let count = +st.count || 0;
  let cursor = st.cursor || '';
  let pages = +st.pages || 0;

  for (let i = 0; i < ASSET_PAGES_PER_REQ; i++) {
    const url = HORIZON_ASSETS + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
    let txt;
    try {
      const r = await timed(url);
      if (!r.ok) break;                       // keep the cursor; a later request carries on from here
      txt = await r.text();
    } catch (_) { break; }
    // One "paging_token" per record, and the LAST one is the cursor for the next page. `\s*` because
    // Horizon pretty-prints — see tradesFromText above, where assuming compact JSON matched nothing.
    const re = /"paging_token":\s*"([^"]*)"/g;
    let m, n = 0, lastTok = '';
    while ((m = re.exec(txt))) { n++; lastTok = m[1]; }
    count += n;
    pages++;
    if (n < 200) {
      // Reached the end: this pass is complete, so it may now be published.
      return { count: 0, cursor: '', pages: 0, total: count, totalAt: Date.now(), totalPages: pages };
    }
    if (!lastTok) break;
    cursor = lastTok;
  }
  // Pass still running. `total` carries the PREVIOUS completed pass, untouched, so the strip keeps
  // showing the last figure we actually finished counting rather than a partial one.
  return { count, cursor, pages, total: st.total || null, totalAt: st.totalAt || 0, totalPages: st.totalPages || 0 };
}

function json(body, status, ttl) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=' + (ttl == null ? 900 : ttl),
      'access-control-allow-origin': '*',
    },
  });
}

export async function onRequestGet(ctx) {
  const env = ctx && ctx.env;
  // 200, NOT 502. This zone replaces the body of any 5xx with Cloudflare's own 16-byte text page, so
  // the JSON explaining what went wrong never reaches anyone ([[worker-5xx-body-replaced-by-cloudflare]]),
  // and the rest of /lxapi/ already reports failure as 200 with {ok:0}. Figures are null, never zero.
  const fallback = (why) => json({ ok: 0, reason: why, assets: null, pools: null, trades: null, accounts: null, ledger: null }, 200, 0);

  const store = mkStore(env);

  // The ledger window and the trade window are independent, so they go together. Pools is a KV read and
  // costs no subrequest. Asset paging happens after the response, not here.
  let ledgersJson = null, poolsFull = null, assetState = null, tradeState = null, acctState = null;
  try {
    const [lr, pf, as, ts, ac] = await Promise.all([
      timed(HORIZON_LEDGERS, { cf: { cacheTtlByStatus: { '200-299': TTL, '300-399': 0, '400-599': 0 }, cacheEverything: true } }),
      poolsMeta(env).then((m) => (m && +m.ranked > 0) ? m : store.get(K_POOLS_FULL)),
      store.get(K_ASSETS),
      store.get(K_TRADES),
      store.get(K_ACCOUNTS),
    ]);
    if (!lr.ok) return fallback('horizon ' + lr.status);
    ledgersJson = await lr.json();
    poolsFull = pf; assetState = as; tradeState = ts; acctState = ac;
  } catch (e) {
    return fallback('horizon unreachable');
  }

  const recs = (ledgersJson && ledgersJson._embedded && ledgersJson._embedded.records) || [];
  const s = summarise(recs);
  if (!s) return fallback('no ledgers');

  // POOLS — null, not zero, when the ranking has not been built yet. A caller told "0 pools" prints it.
  // poolsFull is the meta record ({ ranked }) when pools.js's KV has it, else the old full ranking ({ rows }).
  const rankedN = (poolsFull && +poolsFull.ranked > 0) ? +poolsFull.ranked
    : ((poolsFull && poolsFull.rows && poolsFull.rows.length) || 0);
  const poolRows = rankedN ? { length: rankedN } : null;
  const pools = rankedN ? (rankedN + UNPRICEABLE) : null;

  // TRADES — trades per ledger (from the last sweep, or the seeded measurement) times the ledgers this
  // chain actually closes in a day, using the close time measured above rather than Stellar's nominal 5s.
  const storedPL = tradeState && +tradeState.perLedger > 0 ? +tradeState.perLedger : null;
  const perLedger = storedPL == null ? TRADES_PER_LEDGER_MEASURED : storedPL;
  const ledgersPerDay = s.closeTime > 0 ? 86400 / s.closeTime : 17280;
  const trades24 = Math.round(perLedger * ledgersPerDay);

  // ASSETS — the last COMPLETED pass, or the hand-measured constant until one finishes.
  const assetsTotal = (assetState && assetState.total) ? assetState.total : ASSETS_MEASURED;
  const assetsAt = (assetState && assetState.totalAt) ? Math.floor(assetState.totalAt / 1000) : null;

  // ACCOUNTS — the last good read, or the hand-measured constant until the first one lands.
  const accountsTotal = (acctState && acctState.total) ? acctState.total : ACCOUNTS_MEASURED;
  const accountsAt = (acctState && acctState.at) ? Math.floor(acctState.at / 1000) : null;

  // Both writes happen BEHIND the response, never in front of it. The asset pass is bounded per request
  // and resumes from its stored cursor; the trade average is one small put.
  try {
    if (ctx && ctx.waitUntil) {
      const tDue = !tradeState || !tradeState.ts || (Date.now() - tradeState.ts) > TRADES_REFRESH_MS;
      if (tDue) {
        ctx.waitUntil((async () => {
          const sw = await sweepTrades();
          if (!sw) return;                       // a failed sweep leaves the previous figure standing
          if (sw.ledgers < TRADES_MIN_LEDGERS) return;   // too narrow a window to move the average with
          // Blend into whatever we already hold, INCLUDING the seed on the very first sweep. Replacing
          // outright is what published 31.3/ledger on 2026-11-12 within a minute of the deploy: a single
          // sweep lands in whatever the network is doing right then, and Stellar's trade rate genuinely
          // swings about 3x between a quiet stretch and a busy one (measured 31.3 and 101.5 the same
          // day, both honest point readings). One reading is not a day; the average of many is.
          const base = storedPL == null ? TRADES_PER_LEDGER_MEASURED : storedPL;
          const blended = base * (1 - TRADES_WEIGHT) + sw.perLedger * TRADES_WEIGHT;
          await store.put(K_TRADES, {
            perLedger: blended,
            samples: ((tradeState && +tradeState.samples) || 0) + 1,
            ledgers: sw.ledgers, pages: sw.pages, ts: Date.now(),
          }, 7 * 24 * 3600);
        })());
      }
      const aDue = !acctState || !acctState.ts || (Date.now() - acctState.ts) > ACCOUNTS_REFRESH_MS;
      if (aDue) {
        ctx.waitUntil((async () => {
          const got = await fetchAccounts();
          if (got) await store.put(K_ACCOUNTS, got, 7 * 24 * 3600);
        })());
      }
      const st = assetState || {};
      const running = !!st.cursor;
      const due = !st.totalAt || (Date.now() - st.totalAt) > ASSET_REFRESH_MS;
      if (running || due) {
        ctx.waitUntil((async () => {
          const next = await advanceAssets(st);
          await store.put(K_ASSETS, next, 7 * 24 * 3600);
        })());
      }
    }
  } catch (_) {}

  return json({
    ok: 1,
    // --- the four pills -------------------------------------------------------------------------
    assets: assetsTotal,              // every asset Horizon holds
    pools,                            // same total the Pools page states
    trades: trades24,                 // trades per 24h, PROJECTED from tradesWindowSec
    accounts: accountsTotal,          // accounts holding a balance (CoinMetrics AdrBalCnt)
    ledger: s.ledger,                 // latest ledger sequence — kept for callers/tooltips, not a pill
    // --- what each of those is, so no caller has to assume -----------------------------------------
    assetsMeasuredAt: assetsAt ? null : ASSETS_MEASURED_AT,   // set only while the constant is in use
    assetsCountedAt: assetsAt,                                // set once a live pass has completed
    assetsBuilding: !!(assetState && assetState.cursor),
    poolsRanked: poolRows ? poolRows.length : null,
    poolsUnpriceable: poolRows ? UNPRICEABLE : null,
    tradesProjected: true,
    tradesPerLedger: Math.round(perLedger * 10) / 10,
    tradesLedgersPerDay: Math.round(ledgersPerDay),
    tradesLedgersSampled: (tradeState && tradeState.ledgers) || null,
    tradesSamples: (tradeState && tradeState.samples) || null,
    tradesMeasuredAt: storedPL == null ? ASSETS_MEASURED_AT : null,   // set only while the seed is in use
    // --- still measured, still used by the tooltips -------------------------------------------------
    tps: s.tps,
    opsPerSec: s.opsPerSec,
    closeTime: s.closeTime,
    windowLedgers: s.windowLedgers,
    windowSec: s.windowSec,
    ts: s.ts,
    accountsAt,                                                   // when the figure we hold was dated
    accountsMeasuredAt: accountsAt ? null : ACCOUNTS_MEASURED_AT, // set only while the seed is in use
  }, 200, TTL);
}

// Anything other than GET is not part of this route's contract.
export async function onRequest(ctx) {
  if (ctx.request.method === 'GET') return onRequestGet(ctx);
  return new Response('{"error":"method not allowed"}', {
    status: 405,
    headers: { 'content-type': 'application/json', allow: 'GET' },
  });
}
