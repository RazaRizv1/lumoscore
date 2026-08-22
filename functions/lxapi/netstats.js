// Cloudflare Pages Function — how much the Stellar network actually did yesterday.
//
// The dashboard's top strip states TVL, market cap and 24h volume, all of which are prices and sums.
// None of them says how BUSY the chain is, which is the one thing a "network stats" strip is for. The
// trade count is that number.
//
// WHY THIS IS NOT A DIRECT BROWSER CALL: the only endpoint that carries it, stellar.expert's
// /ledger/ledger-stats, returns the WHOLE daily history since 2015 — measured at 1.53 MB across 3,979
// records, with no cache-control header — and there is no parameter that narrows it (a ?from= is
// accepted and ignored). Downloading that on every dashboard load, on a phone, to read two numbers off
// the end of it is not acceptable. It is fetched here instead, once per cache period, and the page gets
// a couple of hundred bytes.
//
// The tail is sliced out of the RAW TEXT rather than JSON.parse'd. Parsing 1.5 MB would spend the whole
// free-plan CPU budget on 3,977 records we are going to throw away; the records are flat (no nested
// objects), so the last "{" ... "}" pair is a complete record and can be parsed on its own.
//
// WHAT THE CALLER MUST NOT OVERCLAIM: these are UTC-DAY buckets, not a rolling 24 hours. `trades` is the
// last COMPLETE day. `partial` is today so far, and is returned separately precisely so it cannot be
// mistaken for a full day — at 07:00 UTC it reads about a fifth of one.
//
// Deliberately narrow: GET only, no parameters, one fixed upstream URL. Reads no secret, touches no funds.
const UPSTREAM = 'https://api.stellar.expert/explorer/public/ledger/ledger-stats';
const TTL = 1800;   // 30 min at the edge — this is a daily figure; it does not move
const ASSET_TTL = 21600;   // 6 h — the asset count barely moves, and this is the expensive part

// How many assets exist on Stellar. There is no endpoint that says so: ledger-stats carries
// new_assets per day, not a running total, and neither Horizon nor the explorer publishes a count.
// The explorer's list cursor IS a plain offset though, so the end of the list can be found by
// bracketing and then bisecting it -- about sixteen one-row requests, cached for six hours, which is
// the same trick poolstats.js uses to count pools. Returns null rather than a guess if the upstream
// rate-limits mid-search: a wrong total on a dashboard is worse than an absent one.
async function assetCount() {
  const has = async (off) => {
    const r = await fetch('https://api.stellar.expert/explorer/public/asset?limit=1&cursor=' + off,
      { cf: { cacheTtl: ASSET_TTL, cacheEverything: true } });
    if (!r.ok) throw new Error('upstream ' + r.status);
    const d = await r.json();
    return ((((d || {})._embedded || {}).records) || []).length > 0;
  };
  try {
    let lo = 0, hi = 1024;
    while (await has(hi)) { lo = hi; hi *= 2; if (hi > (1 << 22)) return null; }
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (await has(mid)) lo = mid; else hi = mid; }
    return lo + 1;
  } catch (e) { return null; }
}

// The last n records, without parsing everything before them.
function tailRecords(txt, n) {
  const out = [];
  let i = txt.lastIndexOf(']');
  if (i < 0) i = txt.length;
  while (out.length < n) {
    const open = txt.lastIndexOf('{', i - 1);
    if (open < 0) break;
    const close = txt.indexOf('}', open);
    if (close < 0) break;
    try { out.unshift(JSON.parse(txt.slice(open, close + 1))); } catch (e) { /* skip a truncated record */ }
    i = open;
  }
  return out;
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

// The finished count, kept whole rather than re-bisected. The individual one-row lookups are already
// edge-cached, but sixteen sequential round trips still cost seconds; this makes a warm hit one read.
// Per-colo, like every Cache API entry — each colo warms itself once and then serves instantly.
const COUNT_KEY = 'https://lumoscore.internal/assetcount';
async function cachedCount() {
  try {
    const hit = await caches.default.match(COUNT_KEY);
    if (hit) { const d = await hit.json(); if (d && d.n > 0) return d.n; }
  } catch (e) { /* no cache here, fall through to counting */ }
  return null;
}
async function countAndStore() {
  const n = await assetCount();
  if (!(n > 0)) return null;
  try {
    await caches.default.put(COUNT_KEY, new Response(JSON.stringify({ n: n }), {
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=' + ASSET_TTL },
    }));
  } catch (e) { /* the figure is still good even if it could not be stored */ }
  return n;
}

export async function onRequestGet(context) {
  let txt = '';
  try {
    const r = await fetch(UPSTREAM, { cf: { cacheTtl: TTL, cacheEverything: true } });
    if (!r.ok) return json({ error: 'upstream ' + r.status }, 502, 60);
    txt = await r.text();
  } catch (e) {
    return json({ error: 'upstream unreachable' }, 502, 60);
  }
  const recs = tailRecords(txt, 2);
  if (!recs.length) return json({ error: 'no records' }, 502, 60);

  // The final record is today, still filling. The one before it is the last day that is finished.
  const today = recs[recs.length - 1] || null;
  const full = recs.length > 1 ? recs[recs.length - 2] : null;
  if (!full) return json({ error: 'no complete day' }, 502, 60);

  // Everything the dashboard strip needs about the NETWORK, from one record. These are all facts
  // about the last complete UTC day except `accounts`, which is a running total.
  // Bounded, because the bisection is ~16 requests and a cold cache made the whole strip wait twelve
  // seconds on it. If it is not ready in five, the day figures go out without it and the response is
  // cached briefly rather than for half an hour -- by the retry the individual list requests are warm
  // in the edge cache, so it resolves in milliseconds.
  // A pending fetch is CANCELLED the moment the response is returned unless something holds it open,
  // so the losing side of this race was being killed part-way through the bisection every time. Nothing
  // was ever left warm for "the retry" the comment above counted on, the count never completed, and the
  // dashboard's Assets cell stayed a dash on every visit. waitUntil is what keeps it running to the end.
  let assets = await cachedCount();
  if (assets == null) {
    const counting = countAndStore();
    try { context.waitUntil(counting); } catch (e) { /* no context (local mirror): just await the race */ }
    assets = await Promise.race([
      counting,
      new Promise((r) => setTimeout(() => r(null), 5000)),
    ]);
  }
  return json({
    trades: +full.trades || 0,
    operations: +full.operations || 0,
    transactions: +full.transactions || 0,
    payments: +full.payments || 0,
    activeWallets: +full.active_accounts || 0,        // wallets that did something that day
    accounts: +full.accounts || 0,                    // every account ever funded — a running total
    newAssets: +full.new_assets || 0,
    assets: assets,                                   // null when the count could not be established
    avgLedgerTime: +full.avg_ledger_time || 0,
    ts: +full.ts || 0,                                // start of that UTC day, seconds
    partial: today ? { trades: +today.trades || 0, ts: +today.ts || 0 } : null,
  }, 200, assets == null ? 60 : 900);
}
