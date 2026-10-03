import { issuerDomains } from './_issuerdomain.js';
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
const UP = 'https://api.xrpl.to/api';
const TTL = 300;                       // a query's result set moves slowly; the cache does the work
const IDX_TTL = 600;                   // ten minutes: prices move, the roster of tokens does not
const IDX_LIMIT = 1000;                // how deep the index goes; the upstream decides what it will actually give

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

async function upstream(path, env) {
  const headers = { accept: 'application/json', 'user-agent': 'LumosCore/1.0 (+https://lumoscore.com)' };
  if (env && env.XRPLTO_API_KEY) headers['x-api-key'] = env.XRPLTO_API_KEY;
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch(UP + path, { headers });
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
    u: String(t.user || ''),
    i: String(t.issuer || ''),
    c: String(t.currency || ''),
    h: num(t.holders),
    v: num(t.vol24hxrp),
    p: num(t.exch),
    vf: t.verified ? 1 : 0,
    d: String(t.domain || '').slice(0, 80),
    m: String(t.md5 || ''),
  };
}

// The index: the ranked token list, fetched once and cached, then searched in here. Returns null when it cannot be built,
// so the caller can fall back to asking the upstream about this one query.
async function getIndex(url, env, ctx) {
  const cache = caches.default;
  const key = new Request(url.origin + url.pathname + '?index=v1');
  const hit = await cache.match(key);
  if (hit) {
    const cached = await hit.json().catch(() => null);
    if (cached && cached.rows && cached.rows.length) return cached;
  }
  const r = await upstream('/tokens?limit=' + IDX_LIMIT + '&sort=vol24hxrp&order=desc', env);
  const rows = ((r && r.tokens) || []).map(mapRow).filter((t) => t.n && t.i);
  if (!rows.length) return null;
  const xrpPerUsd = Number(r && r.exch && r.exch.USD);
  const body = { at: Date.now(), usd: xrpPerUsd > 0 ? 1 / xrpPerUsd : null, rows };
  ctx.waitUntil(cache.put(key, json(body, IDX_TTL)));
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
      h: num(t.h), v: num(t.v), p: num(t.p), vf: t.vf ? 1 : 0, d: '', m: String(t.m || ''),
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

  // THE INDEX ANSWERS FIRST, and for almost every query it is the only thing consulted. Ten minutes old at most, and
  // free: no upstream request happens here unless the index itself needs rebuilding.
  try {
    const idx = await getIndex(url, env, context);
    if (idx) {
      const rows = searchIndex(idx, q);
      const dstat = {};
      const domsDone = await withLedgerDomains(rows, url.origin, context, dstat);
      if (rows.length) {
        const res = json({
          ok: true, q, count: rows.length, rows, usd: idx.usd,
          src: 'xrpl.to', attribution: 'Data by xrpl.to', attributionUrl: 'https://xrpl.to',
        }, domsDone ? TTL : 20, diag(dstat));
        context.waitUntil(cache.put(key, res.clone()));
        return res;
      }
      // Nothing in the index. That is a real answer for anything ranked, but a small token outside it would also look
      // like this, so the upstream is still asked about this one query below — while the budget allows.
    }
  } catch (e) { /* index unavailable: fall through to the per-query filter */ }

  let out, fstat = null, fdone = false;
  try {
    // `filter` is a text search on the token name. limit caps at 50 when a filter is present.
    // NOT lightweight: that view drops \`domain\`, and search rows show the issuer's home domain the way
    // lumoscore.com's do (RAZA 2026-09-15). Fifty rows either way.
    const r = await upstream('/tokens?limit=50&sort=vol24hxrp&order=desc'
      + '&filter=' + encodeURIComponent(q), env);

    const xrpPerUsd = Number(r && r.exch && r.exch.USD);
    const usdPerXrp = xrpPerUsd > 0 ? 1 / xrpPerUsd : null;

    const rows = ((r && r.tokens) || []).map((t) => ({
      n: String(t.name || ''),
      u: String(t.user || ''),               // issuer's display name
      i: String(t.issuer || ''),
      c: String(t.currency || ''),
      h: num(t.holders),
      v: num(t.vol24hxrp),
      p: num(t.exch),
      vf: t.verified ? 1 : 0,
      d: String(t.domain || '').slice(0, 80),
      m: String(t.md5 || ''),
    })).filter((t) => t.n && t.i);
    // The fallback path returns rows too, and a domain that is only corrected on one of two paths is
    // worse than one that is never corrected: the same token would read differently depending on
    // whether the index happened to hold it.
    fstat = {};
    fdone = await withLedgerDomains(rows, url.origin, context, fstat);

    out = {
      ok: true, q, total: num(r && r.total), count: rows.length, rows,
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
    const local = await localSearch(url.origin, q, request).catch(() => null);
    if (local && local.length) {
      return json({ ok: true, q, count: local.length, rows: local, partial: true, src: 'cached list' }, 60);
    }
    // An empty result set is honest. A stale one from another chain is not.
    return json({ ok: false, q, error: String((e && e.message) || e), rows: [] }, 30);
  }

  // Same rule as the index path above, and for the same reason: a result set whose domains did not all
  // resolve is held for 20 seconds, not five minutes. Cached for the full TTL, the first visitor's
  // unreachable node would be served to everyone behind them as "this issuer has no home domain".
  const res = json(out, fdone ? TTL : 20, diag(fstat));
  context.waitUntil(cache.put(key, res.clone()));
  return res;
}
