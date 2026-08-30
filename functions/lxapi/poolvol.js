// Cloudflare Pages Function — a liquidity pool's real 24h volume, in one call.
//
// WHY THIS EXISTS. The pool page showed "Counting…" for about a minute. It was not idling: 24h volume
// is a SUM over the day's trades, Horizon pages them 200 at a time, and a busy pool runs thousands.
// Measured on XLM/USDC: 3,438 trades in 24 hours = 18 pages, and a single page takes ~4.75s from a
// browser. That is roughly 85 seconds of sequential fetching to answer one number.
//
// WHY NOT THE CHEAP SOURCE. stellar.expert publishes a volume figure per pool and the pools LIST reads
// it. It is not a 24h figure -- it is the current UTC day SO FAR. Measured at 00:05 UTC on the same
// pool, the same moment as the walk above:
//
//     Horizon, rolling 24h : 3,438 trades   2,980,994 XLM
//     stellar.expert "1d"  :    28 trades      24,374 XLM      <- five minutes of a new UTC day
//
// A hundred-fold understatement, worst right after midnight UTC and exactly correct only just before
// it. So the walk is the honest answer and the job is to make it cheap, not to replace it.
//
// The edge is where it becomes cheap: the same pages fetched from a Worker instead of a phone, and the
// result cached for everyone who asks next. The work is I/O, not CPU, so the free plan's CPU budget is
// not the constraint here.
//
// Deliberately narrow: GET only, one path parameter validated as a 64-char hex pool id, one fixed
// upstream host. Reads no secret, touches no funds.
const H = 'https://horizon.stellar.org';
const PAGE = 200;        // Horizon's max
const MAXP = 20;         // 4,000 trades/day before we admit to a floor
// A wall-clock budget as well as a page budget. From Cloudflare the walk is a few hundred ms per page
// and finishes well inside this; measured from a home connection the same 18 pages took 68 SECONDS.
// Whoever is unlucky gets a floor quickly instead of a spinner indefinitely -- and a floor that says
// so is worth more than an exact number nobody waits for.
const BUDGET_MS = 9000;
const TTL = 300;         // 5 min — volume moves, but not per-request

function assetId(type, code, issuer) {
  return (type === 'native' || !code) ? 'native' : (code + '-' + issuer);
}
function json(body, status, ttl) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=' + (ttl == null ? TTL : ttl),
      'access-control-allow-origin': '*',
    },
  });
}

// How long a computed answer counts as fresh, and how long a stale one may still be SERVED while a
// replacement is fetched behind it. A rolling 24h total does not move meaningfully in minutes, so
// handing back a ten-minute-old figure instantly beats making someone watch the walk again.
const FRESH_MS = 5 * 60 * 1000;
const STALE_MS = 60 * 60 * 1000;

export async function onRequestGet({ request, waitUntil }) {
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!/^[0-9a-f]{64}$/i.test(id)) return json({ error: 'bad pool id' }, 400, 60);

  // THE RESPONSE WAS NEVER EDGE-CACHED. "cache-control: public, max-age=300" instructs the BROWSER;
  // Cloudflare does not cache a Function's response off the back of it, and every response came back
  // cf-cache-status: DYNAMIC. So the per-page cf.cacheTtl below saved the Horizon round trips but
  // every single visitor still paid for the walk itself -- measured on production at 9.8s, 11.0s and
  // 13.2s for three of the first four pools, which is the "Counting…" that never seems to end.
  //
  // Putting the finished answer in the Cache API fixes that: the first visitor in a colo pays, and
  // everyone after them is served from memory. Stale entries are returned IMMEDIATELY and refreshed
  // behind the response, so even the visitor who arrives after expiry waits for nothing.
  const cache = caches.default;
  const key = new Request(new URL(request.url).origin + '/lxapi/poolvol?id=' + id.toLowerCase());
  let hit = null;
  try { hit = await cache.match(key); } catch (e) { hit = null; }
  if (hit) {
    const at = +hit.headers.get('x-lx-at') || 0;
    const age = Date.now() - at;
    if (age < FRESH_MS) return hit;
    if (age < STALE_MS) {
      if (waitUntil) waitUntil(compute(id, cache, key).catch(() => {}));
      return hit;
    }
  }

  const res = await compute(id, cache, key);
  return res;
}

// The walk itself, plus the write into the cache. Split out so the stale path can call it in the
// background without also having to return anything.
async function compute(id, cache, key) {
  const cut = Date.now() - 864e5;
  let url = H + '/liquidity_pools/' + id + '/trades?order=desc&limit=' + PAGE;
  const vol = Object.create(null);
  let trades = 0, pages = 0, done = false, failed = false;
  const started = Date.now();

  while (url && pages < MAXP && Date.now() - started < BUDGET_MS) {
    let j = null;
    try {
      const r = await fetch(url, { cf: { cacheTtl: TTL, cacheEverything: true } });
      if (!r.ok) { failed = true; break; }
      j = await r.json();
    } catch (e) { failed = true; break; }
    const recs = (((j || {})._embedded || {}).records) || [];
    pages++;
    for (const x of recs) {
      const ts = Date.parse(x.ledger_close_time || x.created_at || '');
      if (!(ts >= cut)) { done = true; break; }
      trades++;
      const b = assetId(x.base_asset_type, x.base_asset_code, x.base_asset_issuer);
      const c = assetId(x.counter_asset_type, x.counter_asset_code, x.counter_asset_issuer);
      vol[b] = (vol[b] || 0) + (+x.base_amount || 0);
      vol[c] = (vol[c] || 0) + (+x.counter_amount || 0);
    }
    if (done || recs.length < PAGE) { done = true; break; }
    url = (j._links && j._links.next && j._links.next.href) || null;
    if (!url) done = true;
  }

  // partial = we stopped at the page budget with the day still unfinished, so every figure here is a
  // floor. The caller must say so rather than printing it as the answer -- see the ">=" on the page.
  // A partial answer is cached briefly, not for the full period: it should get another chance to
  // finish rather than standing as the number for five minutes.
  const res = json({
    trades: trades,
    vol: vol,                       // { "native": n, "CODE-ISSUER": n, ... } — caller picks its leg
    partial: !done,
    failed: failed && !trades,      // nothing at all came back: unknown, which is not the same as zero
    pages: pages,
  }, 200, done ? TTL : 60);
  // The stamp the reader above ages against. A Response's own Date header only has second resolution
  // and gets rewritten in transit, so the answer carries its own.
  res.headers.set('x-lx-at', String(Date.now()));

  // A partial answer is NOT cached. It is a floor produced by running out of budget, and storing it
  // would freeze that floor in place for everyone in the colo instead of letting the next request try
  // to finish the day.
  if (done && cache && key) {
    try { await cache.put(key, res.clone()); } catch (e) { /* cache write is never the user's problem */ }
  }
  return res;
}
