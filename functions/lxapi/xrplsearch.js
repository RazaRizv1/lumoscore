import { issuerDomains } from './_issuerdomain.js';
import { vouched, issuerName } from './_unvouched.js';
// Token search for the XRP Ledger.
//
// Replaces a Stellar index that was live on every XRPL page: typing "USD" into the search box on
// this site returned Stellar assets with G-issuers, and prefetched their logos. Same class of
// wrong-chain layer as the Trade market table.
//
// A TICKER IS NOT AN IDENTITY, and on this ledger the search box is where that bites first. A search
// for "USD" returns, right now: RLUSD (Ripple), USDC (Circle), USD (Bitstamp), USD (RippleFox),
// USDT (XRPS), USDC (GateHub). Two different USDs and two different USDCs, all real, none of them
// each other. So every result carries its issuer, and results are ordered by 24h volume so the one
// people actually mean is first -- ordering by name would put the impostor above the real thing.
//
// Proxied and cached for the same reason as the other feeds: 333 upstream requests per DAY per IP.
// A search box firing per keystroke from the visitor's own IP would exhaust that in one session.

// SEARCH NO LONGER SPENDS A REQUEST PER QUERY (RAZA 2026-09-17, on "love" answering with a rate-limit notice: "This
// shouldnt be happening"). Per-query filtering meant every word nobody had typed before cost one of the day's 333 upstream
// requests, and once they were gone — which a day of testing manages easily — search simply stopped working.
//
// Instead ONE request fetches the ranked token list and it is cached here as an index, then searched in this worker. A
// ten-minute index costs about 144 requests a day no matter how many people search, and a query answers from memory with
// no upstream call at all. The per-query filter stays as a fallback for anything the index does not contain, so a small
// token outside the list is still findable while the budget lasts.
// `/v1` is the canonical base; `/api` is an internal alias serving the identical API, and their own
// docs say to use /v1 in new integrations.
const UP = 'https://api.xrpl.to/v1';
const TTL = 300;                       // a query's result set moves slowly; the cache does the work
// How long to stop asking the per-query endpoint after it refuses. Five minutes: long enough that a
// burst of searches costs ONE request instead of one each, short enough that a limit which clears
// (the per-second cap, rather than the daily one) is noticed quickly. The daily allowance is the bad
// case, and there this is a retry every five minutes rather than every keystroke.
const BRK_TTL = 300;
// AN HOUR, BECAUSE THE INDEX IS NO LONGER THE ANSWER. It was ten minutes when it served every
// search and its prices were what the reader saw. It is now only consulted after the ledger search
// has been refused, and every row it returns is labelled `partial`, so an hour-old price on a
// degraded path beats rebuilding a hundred rows against the very allowance that just ran out.
const IDX_TTL = 3600;
// A HUNDRED, BECAUSE A HUNDRED IS ALL THERE IS. This asked for 1000 and the comment beside it said
// "the upstream decides what it will actually give" -- which it does: `/tokens` documents `limit` as
// "int (max 100; default 100)", and the reply says so in its own body (`limit: 100, count: 100,
// total: 20466`). Nobody read the reply, so the index has always been 100 rows while the empty-state
// message told the reader we had searched the top 1,000. Asking for a number the API will not honour
// is not a bigger index; it is a wrong number in a sentence shown to users.
const IDX_LIMIT = 100;

// `diag` goes out as a header rather than into the body: it is for us, it must not become something a
// page starts reading, and a header survives the response being cached so a hit can still be told apart
// from a fresh resolve. The domain layer shipped broken-but-plausible once because a blank domain and an
// unreachable ledger looked the same from outside; this is what makes them different.
const json = (body, secs, diag) => new Response(JSON.stringify(body), {
  headers: Object.assign({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=' + secs,
    'access-control-allow-origin': '*',
  }, diag ? { 'x-lxdom': diag } : null),
});

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// `body` turns this into a POST -- /search is the only endpoint here that takes one. Everything else
// (the key, the retry, the Retry-After handling) is unchanged, so the two verbs cannot drift apart.
async function upstream(path, env, body) {
  const headers = { accept: 'application/json', 'user-agent': 'LumosCore/1.0 (+https://lumoscore.com)' };
  if (env && env.XRPLTO_API_KEY) headers['x-api-key'] = env.XRPLTO_API_KEY;
  const init = { headers };
  if (body !== undefined) {
    init.method = 'POST';
    headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch(UP + path, init);
    if (r.ok) return r.json();
    if (r.status !== 429 || attempt === 1) throw new Error('upstream ' + r.status);
    const ra = Number(r.headers.get('retry-after'));
    await sleep(isFinite(ra) && ra > 0 && ra <= 5 ? ra * 1000 : 1200);
  }
  throw new Error('upstream 429');
}

const num = (v) => { const n = Number(v); return isFinite(n) ? n : null; };

// One row, in the shape every search answer uses.
function mapRow(t) {
  return {
    n: String(t.name || ''),
    u: issuerName(t.issuer, t.currency, t.user),
    i: String(t.issuer || ''),
    c: String(t.currency || ''),
    h: num(t.holders),
    v: num(t.vol24hxrp),
    p: num(t.exch),
    vf: vouched(t.issuer, t.currency, t.verified),
    d: String(t.domain || '').slice(0, 80),
    m: String(t.md5 || ''),
  };
}

// The index: the ranked token list, fetched once and cached, then searched in here. Returns null when it cannot be built,
// so the caller can fall back to asking the upstream about this one query.
// THE INDEX IS CHARGED PER COLO, AND THE BUDGET IS NOT.
//
// The note above says a ten-minute index costs about 144 upstream requests a day "no matter how
// many people search". That is true per COLO, and the 333/day limit is per IP for all of them.
// The Cache API is per-colo on the free plan, so each Cloudflare location that serves a visitor
// rebuilds this index on its own clock: two or three busy colos spend the entire day's budget,
// and then search returns the rate-limit notice for everyone.
//
// RAZA hit exactly that on lumoscore.com within an hour of the XRPL launch, searching "lumos":
//   "The market data provider is rate-limiting us. Searches for assets already looked at still work."
// Which is the honest message, and the wrong thing to be honest about -- the budget was spent on
// refetching one list N times, not on serving searches.
//
// KV is global, so ONE index serves every colo and the cost goes back to the ~144/day the design
// assumed. Same mkStore shape as pools.js and assetsearch.js: KV when the binding is present, the
// per-colo Cache API when it is not, so this is safe before the namespace is bound and fixes the
// problem the moment it is.
function mkIdxStore(env, url) {
  const kv = env && (env.LUMOS_KV || env.POOLS_KV || env.CONTENT_KV);
  if (kv) {
    return {
      kind: 'kv',
      async get() { try { return await kv.get('xrplsearch:index:v1', 'json'); } catch (_) { return null; } },
      async put(body) {
        try { await kv.put('xrplsearch:index:v1', JSON.stringify(body), { expirationTtl: Math.max(60, IDX_TTL) }); } catch (_) {}
      },
    };
  }
  const cache = caches.default;
  const key = new Request(url.origin + url.pathname + '?index=v1');
  return {
    kind: 'cache',
    async get() { try { const h = await cache.match(key); return h ? await h.json() : null; } catch (_) { return null; } },
    async put(body) { try { await cache.put(key, json(body, IDX_TTL)); } catch (_) {} },
  };
}

async function getIndex(url, env, ctx) {
  const store = mkIdxStore(env, url);
  const cached = await store.get();
  if (cached && cached.rows && cached.rows.length) return cached;
  const r = await upstream('/tokens?limit=' + IDX_LIMIT + '&sort=vol24hxrp&order=desc', env);
  const rows = ((r && r.tokens) || []).map(mapRow).filter((t) => t.n && t.i);
  if (!rows.length) return null;
  const xrpPerUsd = Number(r && r.exch && r.exch.USD);
  const body = { at: Date.now(), usd: xrpPerUsd > 0 ? 1 / xrpPerUsd : null, rows };
  ctx.waitUntil(store.put(body));
  return body;
}

// Name, issuer name, ticker or issuer address — the same things the upstream's own filter matches, ordered as the index
// already is: by 24h volume, so the token people mean comes first rather than the one that sorts first.
function searchIndex(idx, q) {
  const needle = q.toLowerCase();
  return (idx.rows || []).filter((t) => {
    if (String(t.n || '').toLowerCase().indexOf(needle) >= 0) return true;
    if (String(t.u || '').toLowerCase().indexOf(needle) >= 0) return true;
    if (String(t.i || '').toLowerCase() === needle) return true;
    return false;
  }).slice(0, 50);
}

// THE XRP/USD RATE, FROM OUR OWN EDGE-CACHED LIST rather than from the search rows.
//
// /tokens used to carry a global `exch.USD` and the USD column came from it. /search carries no such
// field, so the first version of this derived the rate from a row: each token has both an XRP price
// (`exch`) and a USD price (`usd`), so `usd / exch` ought to be the rate. It is not. Measured on the
// three tokens a search for "yield" returns:
//
//     INTERFACE  ratio 1.5419      YLDAI  ratio 1.4873      FARM  ratio 1.5722
//     the real rate at that moment: 1.3077
//
// Those two prices are evidently taken from different sources or different moments per token, so the
// ratio is not the rate and is wrong by up to 20%. It looked right only because the first query I
// checked ("love") happened to use a liquid token whose figures agreed -- a derivation that is
// correct on the row you test and wrong on the next one is the worst kind, because the test passes.
//
// `/lxapi/xrpltokens` already publishes the rate the rest of the site renders with, from this same
// provider, cached at our own edge. Asking it costs no upstream request and keeps the search column
// consistent with every other USD figure on the page instead of inventing a second opinion.
async function xrpUsd(origin) {
  try {
    const r = await fetch(origin + '/lxapi/xrpltokens?n=1', { headers: { accept: 'application/json' } });
    if (!r.ok) return null;
    const j = await r.json();
    const u = Number(j && j.usd);
    return u > 0 ? u : null;
  } catch (_) { return null; }
}

// The fallback described in the catch block below: the site's own ranked token list, filtered here. No upstream request —
// that endpoint is edge-cached — so it still answers when the search API has cut us off. Same row shape as a real answer,
// minus `d` (the issuer's domain), which the ranked list does not carry.
async function localSearch(origin, q, request) {
  const r = await fetch(origin + '/lxapi/xrpltokens?n=100', { headers: { accept: 'application/json' } });
  if (!r.ok) return [];
  const j = await r.json();
  const needle = q.toLowerCase();
  return ((j && j.rows) || [])
    .filter((t) => String(t.n || '').toLowerCase().indexOf(needle) >= 0
                || String(t.u || '').toLowerCase().indexOf(needle) >= 0)
    .slice(0, 25)
    .map((t) => ({
      n: String(t.n || ''), u: String(t.u || ''), i: String(t.i || ''), c: String(t.c || ''),
      h: num(t.h), v: num(t.v), p: num(t.p), vf: vouched(t.i, t.c, t.vf), d: '', m: String(t.m || ''),
    }))
    .filter((t) => t.n && t.i);
}


// THE DOMAIN SHOWN IS THE ONE THE ISSUER PUT ON THE LEDGER, not the one the market data carries.
// See _issuerdomain.js for why, and for the three ATOMs that made the difference obvious. A row whose
// issuer declares nothing loses its domain rather than keeping the claimed one: no badge is better than
// a badge that is wrong, and "no domain set" is itself worth seeing on a token page.
// asked/resolved/none/unreachable/cached, flattened for a header. Absent counters read as 0 rather than
// being left out, so the shape is the same whether the lookup ran or threw.
function diag(st) {
  if (!st) return '';
  const n = (k) => (st[k] == null ? 0 : st[k]);
  return 'asked=' + n('asked') + ' resolved=' + n('resolved') + ' none=' + n('none')
    + ' unreachable=' + n('unreachable') + ' cached=' + n('cached');
}

async function withLedgerDomains(rows, origin, ctx, stat) {
  try {
    const map = await issuerDomains(rows.map((r) => r.i), origin, ctx, stat);
    // EVERY row is overwritten, including the ones that did not resolve before the deadline. Keeping the
    // claimed domain for those would mean a token shows "x.com" or not depending on how fast the ledger
    // answered — the same row saying different things on two loads, which is worse than saying nothing.
    for (const r of rows) r.d = map[r.i] || '';
    // Whether EVERY issuer answered. A cold search can time out on some of them, and caching that for
    // the full five minutes would bake "no domain" in for everyone behind it — the first visitor's
    // slow ledger call becoming the next hundred visitors' answer. The caller shortens the TTL instead,
    // so the next request re-resolves against a per-issuer cache that is by then warm.
    return rows.every((r) => Object.prototype.hasOwnProperty.call(map, r.i));
  } catch (e) { /* the claimed domain stands rather than the search failing over a badge */ }
  return false;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim().slice(0, 40);
  if (q.length < 2) return json({ ok: true, q, rows: [] }, 60);

  const cache = caches.default;
  const key = new Request(url.origin + url.pathname + '?v=2&q=' + encodeURIComponent(q.toLowerCase()), request);
  const hit = await cache.match(key);
  if (hit) return hit;

  // THE LEDGER ANSWERS FIRST; THE INDEX IS THE FALLBACK (RAZA 2026-10-17: "we're not searching just
  // 1000 assets. we're searching for assets throughout the XRPL network", and then "flip it now").
  //
  // THIS USED TO BE THE OTHER WAY AROUND, and the index won whenever it held a single row. A
  // hundred-row list shadowing a twenty-thousand-token search is not a cache -- a cache returns the
  // same answer sooner, and this returned a DIFFERENT, smaller one. Measured on staging the moment
  // the endpoint switch went up: `xmen` answered 1 row from the index while the ledger holds 21, and
  // `xrdoge` answered 50 only because the index happened to miss it. Which answer a reader got
  // depended on whether their token had drifted into the top 100 that minute, which is the worst
  // property a search can have.
  //
  // The cost is real and was RAZA's call to make: one upstream request per unique query instead of
  // near-zero, against an anonymous allowance of 333/day. He chose correctness now and the free key
  // (33,000/day) later. If the allowance does run out, the breaker below trips and this degrades to
  // exactly the old behaviour -- the index, honestly labelled `partial` -- so the downside is capped
  // at what today already does.
  let out, fstat = null, fdone = false;
  // ONE REFUSAL STOPS THE NEXT HUNDRED ASKS (RAZA 2026-10-16: "This is my first search on xrpl in
  // hours. And even that from a different device. Yet I'm still getting this error").
  //
  // Reaching here means the index did not hold the word, so this is the per-query call that costs
  // one of the day's 333. When the upstream is already refusing, every further search spent another
  // one and failed anyway — each keystroke-triggered query burning budget to be told no. The budget
  // is per IP, shared by every visitor AND by the health bot, which is why it can be gone before the
  // first person types anything.
  //
  // So a 429 trips a breaker and we stop asking for five minutes. The same shape xrplthumb.js uses,
  // and for the same reason: the thing being protected is a shared allowance, not this one request.
  //
  // PER-COLO IS CORRECT HERE, unlike the index. The index is cached in KV precisely because it must
  // be global — one build serving every location. A rate limit is the opposite: it is charged per
  // egress IP, and each colo has its own, so one location being cut off says nothing about another.
  // The Cache API's per-colo scope is the right shape for this and the wrong shape for that.
  const brkKey = new Request(url.origin + url.pathname + '/__brk');
  const tripped = await cache.match(brkKey).catch(() => null);

  try {
    // Skipping straight to the fallback while the breaker is open. Thrown rather than branched so
    // there is ONE recovery path below, not two that can drift apart.
    if (tripped) throw new Error('upstream 429 (breaker open)');
    // THE DEDICATED SEARCH ENDPOINT, not `/tokens?filter=` (RAZA 2026-10-17: "i was able to search
    // even tiny tokens on XRPL like Xyield. whys it not wokring now").
    //
    // `filter` is documented as "text search on token NAME" and behaves like it: it finds `xmen` and
    // `xrdoge` but answers 0 for a word that only appears in the issuer's name, and it matches
    // literally -- `xyield` returns nothing. POST /search matches the name AND the issuer's display
    // name, tolerates a typo, and orders by best match; measured against the same ledger, `yield`
    // returns three real zero-volume tokens through it and none through `filter`.
    //
    // It also sits in its OWN per-endpoint rate bucket (7/min at the anonymous tier against
    // /tokens' 5/min), so a search no longer competes with the index rebuild for the same window.
    // That is a side benefit, not the fix: the budget is still the binding constraint -- see the
    // breaker below.
    //
    // `limit` is capped at 100 and offset+limit must stay within 100. Fifty, as before.
    const r = await upstream('/search', env, { search: q, limit: 50 });

    // See xrpUsd() above for why this is not derived from the rows.
    const usdPerXrp = await xrpUsd(url.origin);

    // Same mapper as the index path. These were two copies of identical code; the domain-slicing and
    // the vouched() call have to agree on both paths or the same token reads differently depending
    // on which one answered.
    const rows = ((r && r.tokens) || []).map(mapRow).filter((t) => t.n && t.i);
    // The fallback path returns rows too, and a domain that is only corrected on one of two paths is
    // worse than one that is never corrected: the same token would read differently depending on
    // whether the index happened to hold it.
    fstat = {};
    fdone = await withLedgerDomains(rows, url.origin, context, fstat);

    out = {
      // /search reports the match count under `pagination.total`; /tokens used a bare `total`. Both
      // are read so a cached old response still makes sense.
      ok: true, q, total: num((r && r.pagination && r.pagination.total) != null ? r.pagination.total : (r && r.total)),
      count: rows.length, rows,
      usd: usdPerXrp,
      src: 'xrpl.to', attribution: 'Data by xrpl.to', attributionUrl: 'https://xrpl.to',
    };
  } catch (e) {
    // THE UPSTREAM REFUSES LONG BEFORE THE DAY IS OUT (RAZA 2026-09-17: "batman" answering nothing while "lumos" and "bat"
    // returned instantly — those two were cached, this one went upstream and came back 429). Their anonymous tier is 333
    // requests a DAY per IP, so once a day's testing has spent it, every query nobody has searched before fails.
    //
    // The ranked token list this site already serves is cached here and costs nothing extra, so it is searched instead.
    // It only covers the top hundred by volume, which is why the answer says so — `partial: true` — rather than passing a
    // short list off as the whole ledger.
    // TRIP THE BREAKER, so the next search does not find this out for itself. A 200 body is used
    // because that is what the Cache API will store; its presence is the whole signal and its
    // max-age is how long we stay quiet. Not cached as an ANSWER — see [never cache a failure as an
    // answer]; this records that the upstream is refusing, never that a token does not exist.
    if (/429/.test(String((e && e.message) || e))) {
      context.waitUntil(cache.put(brkKey, new Response('1', {
        headers: { 'content-type': 'text/plain', 'cache-control': 'public, max-age=' + BRK_TTL },
      })).catch(() => {}));
    }

    // FALLBACK 1: THE INDEX. It is only reached now that the ledger search has failed, which is also
    // why it is marked `partial` -- a hundred rows is not an answer about the ledger, and the box
    // words its empty state from this flag. Mostly free: a KV read, and an upstream rebuild only if
    // the stored copy has expired. That rebuild can itself be refused, which is what the try is for.
    try {
      const idx = await getIndex(url, env, context);
      if (idx) {
        const rows = searchIndex(idx, q);
        if (rows.length) {
          const dstat = {};
          const domsDone = await withLedgerDomains(rows, url.origin, context, dstat);
          return json({
            ok: true, q, count: rows.length, rows, usd: idx.usd, partial: true,
            rate: /429/.test(String((e && e.message) || e)) ? 1 : 0,
            src: 'index', attribution: 'Data by xrpl.to', attributionUrl: 'https://xrpl.to',
          }, domsDone ? TTL : 20, diag(dstat));
        }
      }
    } catch (_) { /* the index is unavailable too: one more tier below */ }

    // FALLBACK 2: the ranked list this site already serves at its own edge-cached url. No upstream
    // request at all, so it still answers when both of the above are cut off.
    const local = await localSearch(url.origin, q, request).catch(() => null);
    if (local && local.length) {
      // `usd` and `rate` carried here too. Without them this tier rendered a blank USD column and
      // told the box the result was complete, so the one path a reader reaches when the allowance
      // has run out was also the one that said least about itself.
      return json({
        ok: true, q, count: local.length, rows: local, partial: true,
        usd: await xrpUsd(url.origin),
        rate: /429/.test(String((e && e.message) || e)) ? 1 : 0,
        src: 'cached list',
      }, 60);
    }

    // NOT ok:false ANY MORE, and this is the part the reader sees. That used to produce "The market
    // data provider is rate-limiting us" for a word nobody had searched before — an alarming message
    // about our plumbing, in answer to a question about a token.
    //
    // What is actually true: the ranked index was searched and did not hold it, the top-100 list did
    // not either, and the one place that could still have it will not answer right now. That is an
    // empty result the reader can act on, marked `partial` so the box can say it is not the whole
    // ledger. `ok: true` because the search RAN — it simply found nothing it could reach.
    //
    // `rate` rides along for the box to word the note, and is NOT the error string the client used
    // to sniff for "429". A flag is a contract; parsing someone's prose is not.
    return json({
      ok: true, q, count: 0, rows: [], partial: true,
      rate: /429/.test(String((e && e.message) || e)) ? 1 : 0,
      src: 'index',
    }, 60);
  }

  // Same rule as the index path above, and for the same reason: a result set whose domains did not all
  // resolve is held for 20 seconds, not five minutes. Cached for the full TTL, the first visitor's
  // unreachable node would be served to everyone behind them as "this issuer has no home domain".
  const res = json(out, fdone ? TTL : 20, diag(fstat));
  context.waitUntil(cache.put(key, res.clone()));
  return res;
}
