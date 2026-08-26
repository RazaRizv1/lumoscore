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

// How many assets exist on Stellar. /asset-stats/overall is what the explorer's own front page reads
// this from -- 63 bytes, one request, and it states total_assets outright. Returns null rather than a
// guess if the upstream is unreachable: a wrong total on a dashboard is worse than an absent one.
const ASSET_STATS = 'https://api.stellar.expert/explorer/public/asset-stats/overall';
async function assetCount() {
  try {
    const r = await fetch(ASSET_STATS, { cf: { cacheTtl: ASSET_TTL, cacheEverything: true } });
    if (!r.ok) return null;
    const d = await r.json();
    return +d.total_assets > 0 ? +d.total_assets : null;
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

export async function onRequestGet() {
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
  const assets = await assetCount();
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
