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

const HOSTS = ['https://horizon.stellar.org', 'https://horizon.stellar.lobstr.co'];
const USDC = 'USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const XPERT = 'https://api.stellar.expert/explorer/public/liquidity-pool';
const PAGE = 200;            // Horizon max per request
const RANK_TTL = 900;        // 15 min — reserves move, but the ORDER of a 10k list barely does
const UPSTREAM_TTL = 900;
const VOL_PAGES = 6;         // stellar.expert overlay depth — see the volume note below


const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// GUARDRAILS E12: throttle + retry + host fallback. Horizon's 429 carries no CORS header, so in the
// browser it surfaces as an opaque "Failed to fetch"; here we see the status, but the fallback matters
// just as much because a single throttled page would corrupt the ranking.
async function j(path, ttl = UPSTREAM_TTL) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const host = HOSTS[attempt % HOSTS.length];
    try {
      const r = await fetch(host + path, { cf: { cacheTtl: ttl, cacheEverything: true } });
      if (r.status === 429) { await sleep(700 * (attempt + 1)); continue; }
      if (!r.ok) { await sleep(200); continue; }
      return r.json();
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

const A32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
// stellar.expert keys pools by strkey ("L..."), Horizon by hex. Decode base32, drop the version byte and
// the 2-byte checksum, and the remaining 32 bytes ARE the Horizon id.
function strkeyToHex(s) {
  let bits = '';
  for (const c of s) { const i = A32.indexOf(c); if (i < 0) return null; bits += i.toString(2).padStart(5, '0'); }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return bytes.slice(1, 33).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 24h volume is the one column Horizon cannot answer: a pool record carries reserves, fee and
// total_trustlines but no volume, and per-pool /trades across 10,962 pools is not a request budget that
// exists. stellar.expert does carry volume_value, so it is used as an OVERLAY only -- never for ranking,
// where its ordering was already shown to be unusable. Its coverage is size-correlated, so the pools a
// user actually sees on page 1 have a figure and deep dust pages do not. Missing means missing: those
// rows report null and the page shows a dash, rather than a fabricated 0.
// Also harvests LOGOS while it is here. Each stellar.expert pool record carries toml_info.image for both
// of its assets, so the icons cost nothing extra once this request is being made anyway.
//
// This matters because the page cannot resolve them on its own: its amTokUrl() reads a static map keyed
// by asset CODE, which knows the curated handful and nothing else, so across the network most pairs fell
// back to coloured letter tiles. Resolving them client-side instead would be 50 lookups per 25-row page.
// Shipping the URL with the row is one lookup for everybody, and it is issuer-correct rather than
// code-keyed -- which matters on Stellar, where a ticker is not an identity.
async function volumeOverlay() {
  const vol = new Map(), img = new Map();
  for (let p = 0; p < VOL_PAGES; p++) {
    let d = null;
    try {
      const r = await fetch(XPERT + '?limit=' + PAGE + '&cursor=' + p * PAGE,
        { headers: { accept: 'application/json' }, cf: { cacheTtl: UPSTREAM_TTL, cacheEverything: true } });
      if (r.ok) d = await r.json();
    } catch (_) {}
    const recs = (d && d._embedded && d._embedded.records) || [];
    if (!recs.length) break;
    for (const r of recs) {
      const hex = strkeyToHex(r.id);
      if (!hex) continue;
      vol.set(hex, ((r.volume_value && +r.volume_value['1d']) || 0) / 1e7);
      for (const a of (r.assets || [])) {
        // Key by CODE-ISSUER, never by code alone -- a ticker is not an identity on Stellar.
        // NOTE the shape: upstream writes "AQUA-GBNZ...-1", with a trailing asset-TYPE digit
        // (1 = alphanum4, 2 = alphanum12). Keying on the raw string never matched what the page
        // asks for, so every credit leg came back without a logo while XLM, matched separately,
        // looked fine -- which is exactly how it presented.
        const raw = (a.asset || a.name || '');
        const key = raw.split('-').slice(0, 2).join('-');
        const src = a.toml_info || a.tomlInfo || {};
        const u = src.image || src.orgLogo || '';
        if (key && u && !img.has(key)) img.set(key, u);
      }
    }
  }
  return { vol, img };
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
const STATE_KEY = new Request('https://lumoscore.internal/lxapi/pools-state', { method: 'GET' });
const RANK_KEY = new Request('https://lumoscore.internal/lxapi/pools-ranked', { method: 'GET' });

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
    if (r.done) state.phase = 'overlay';
    if (spent >= STEP_BUDGET - VOL_PAGES) return state;
  }
  if (state.phase === 'overlay') {
    const { vol, img } = await volumeOverlay();
    for (const r of state.rows) {
      if (vol.has(r.id)) r.vol24 = Math.round(vol.get(r.id) * 100) / 100;
      for (const leg of [r.a, r.b]) {
        if (!leg) continue;
        if (leg.code === 'XLM' && !leg.issuer) { leg.img = '/assets/tokens/xlm.png'; continue; }
        const u = img.get(leg.code + '-' + leg.issuer) || img.get(leg.code);
        if (u) leg.img = u;
      }
    }
    state.rows.sort((x, y) => y.tvl - x.tvl);
    state.phase = 'done';
    delete state.seen;                          // ~10,962 keys that nothing reads again
  }
  return state;
}

export async function onRequestGet(ctx) {
  const url = new URL(ctx.request.url);
  const per = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per') || '25', 10) || 25));
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const qRaw = (url.searchParams.get('q') || '').trim().toUpperCase().slice(0, 24);

  const cache = caches.default;
  try {
    // The RANKING is cached whole and sliced per request. Caching the per-page responses instead would
    // recompute a 10,962-pool enumeration for every page the user clicks to.
    let ranked = null;
    const hit = await cache.match(RANK_KEY);
    if (hit) ranked = await hit.json();
    if (!ranked) {
      // Resume the in-progress build, spend one budget's worth, and either finish or report progress.
      let state = null;
      try { const s = await cache.match(STATE_KEY); if (s) state = await s.json(); } catch (_) {}
      state = await buildStep(state);
      if (state.phase !== 'done') {
        try {
          const save = new Response(JSON.stringify(state), {
            headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
          });
          ctx && ctx.waitUntil && ctx.waitUntil(cache.put(STATE_KEY, save.clone()));
        } catch (_) {}
        return new Response(JSON.stringify({ warming: true, scanned: state.rows.length, phase: state.phase }), {
          headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
        });
      }
      ranked = {
        rows: state.rows, px: state.px, ranked: state.rows.length,
        withVol: state.rows.filter((r) => r.vol24 !== null).length, ts: Date.now(),
      };
      const store = new Response(JSON.stringify(ranked), {
        headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=' + RANK_TTL },
      });
      try {
        ctx && ctx.waitUntil && ctx.waitUntil(cache.put(RANK_KEY, store.clone()));
        ctx && ctx.waitUntil && ctx.waitUntil(cache.delete(STATE_KEY));
      } catch (_) {}
    }

    let rows = ranked.rows;
    if (qRaw) rows = rows.filter((r) => (r.a && r.a.code || '').toUpperCase().indexOf(qRaw) >= 0
      || (r.b && r.b.code || '').toUpperCase().indexOf(qRaw) >= 0);

    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / per));
    const start = Math.min((page - 1) * per, Math.max(0, (pages - 1) * per));

    const body = JSON.stringify({
      page: Math.floor(start / per) + 1,
      per, pages, total,
      ranked: ranked.ranked,
      unpriceable: 28882,          // measured; pools with neither an XLM nor a Circle USDC leg
      withVol: ranked.withVol,
      xlmUsd: ranked.px,
      ts: ranked.ts,
      rows: rows.slice(start, start + per),
    });
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
