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

// A DEADLINE, BECAUSE THE BIG ONE IS 1.5 MB. Neither fetch here had a timeout, so a slow upstream held
// the worker until the platform gave up and answered 502 itself -- which is what the dashboard's stat
// pills were reading when they sat on "—". Measured by the bot across tonight's runs: netstats 502s
// intermittently, and three Dashboard rows fail together whenever it does.
const SUB_TIMEOUT_MS = 6000;
async function timed(url, opts) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), SUB_TIMEOUT_MS);
  try { return await fetch(url, { ...opts, signal: ac.signal }); } finally { clearTimeout(t); }
}

// THE LAST ANSWER THAT WAS TRUE, kept so a bad minute upstream is not served as a broken dashboard.
// These are DAILY figures: yesterday's trade count does not change, so a reading from twenty minutes
// ago is the same number, and showing it beats showing nothing. Returned with a short max-age so the
// next request tries the upstream again rather than settling into the stale copy.
//
// This also stops the endpoint caching its own FAILURE. It used to answer 502 with
// cache-control: max-age=60, so one upstream blip was re-served as an error to everyone for a minute.
const LAST_GOOD = 'https://lumoscore.internal/__lastgood/netstats';

async function assetCount() {
  try {
    const r = await timed(ASSET_STATS, { cf: { cacheTtlByStatus: { '200-299': ASSET_TTL, '300-399': 0, '400-599': 0 }, cacheEverything: true } });
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

export async function onRequestGet(ctx) {
  const cache = caches.default;
  // Serve the previous good answer rather than an error. Only reached when this request could not
  // produce one of its own.
  const fallback = async (why) => {
    try {
      const hit = await cache.match(LAST_GOOD);
      if (hit) {
        return new Response(await hit.text(), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'cache-control': 'public, max-age=60',   // short: try the upstream again soon
            'access-control-allow-origin': '*',
            'x-lx-stale': '1',                       // so a reader can tell, without the figures changing
          },
        });
      }
    } catch (_) {}
    return json({ error: why }, 502, 0);             // 0: never cache a failure as an answer
  };

  // BOTH UPSTREAMS AT ONCE. assetCount() used to run only after the 1.5 MB download had finished, so
  // the two waits were added together for no reason -- they share no data.
  let txt = '', assets = null;
  try {
    const [r, a] = await Promise.all([
      timed(UPSTREAM, { cf: { cacheTtlByStatus: { '200-299': TTL, '300-399': 0, '400-599': 0 }, cacheEverything: true } }),
      assetCount(),
    ]);
    assets = a;
    if (!r.ok) return fallback('upstream ' + r.status);
    txt = await r.text();
  } catch (e) {
    return fallback('upstream unreachable');
  }
  const recs = tailRecords(txt, 2);
  if (!recs.length) return fallback('no records');

  // The final record is today, still filling. The one before it is the last day that is finished.
  const today = recs[recs.length - 1] || null;
  const full = recs.length > 1 ? recs[recs.length - 2] : null;
  if (!full) return fallback('no complete day');

  // Everything the dashboard strip needs about the NETWORK, from one record. These are all facts
  // about the last complete UTC day except `accounts`, which is a running total.
  const out = json({
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

  // Keep this answer for the next request that cannot get one. waitUntil so the write never delays
  // the response; without it the put races the worker shutting down and silently does nothing.
  try {
    const save = out.clone();
    if (ctx && ctx.waitUntil) ctx.waitUntil(cache.put(LAST_GOOD, save));
    else await cache.put(LAST_GOOD, save);
  } catch (_) {}
  return out;
}
