// GET /lxapi/xrplammchart?acct=<AMM account>&p=1d|1w|1m|3m|1y|all
//
// A pool's liquidity over time, for the Pool Activity chart on the pool page. RAZA 2026-09-15: "In
// Pools-Pool chart hover, its supposed to show TVL instead of price." lumoscore.com charts the pool's own
// value there; the XRP Ledger keeps no such history, but xrpl.to records it per pool — /amm/liquidity-chart,
// keyed by the AMM account — with the day's volume, fees and trade count on the same point.
//
// Returned as compact points: [timeMs, tvlXrp, volumeXrp, feesXrp, trades], oldest first.
//
// THE FILTER IS VERIFIED, not trusted. xrpl.to has ignored a pool parameter before and answered 200 with a
// different pool (see the note in xrplpools.js); this response echoes `ammAccount`, and a mismatch is refused
// rather than charted under the wrong name.
//
// Proxied rather than fetched from the browser: the API key must stay server-side, and the anonymous tier's
// per-IP daily limit would be spent in a few page views.
const UP = 'https://api.xrpl.to/api';
const TTL = 300;
const PERIODS = { '1d': 1, '1w': 1, '1m': 1, '3m': 1, '1y': 1, all: 1 };
const ADDR = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;

// THE LAST GOOD ANSWER, SHARED BY EVERY DATA CENTER (RAZA 2026-11-20, XRP/RLUSD: "i had to retry it 3 times before the
// chart appeared"). xrpl.to refuses bursts with 429 and retry-after: 60, and caches.default is PER DATA CENTER, so a
// visitor whose colo never held this answer got a failure. D1 is global: ADMIN_DB, the production binding (staging has
// none and skips this). Written at most once an hour per key -- the upsert's WHERE -- and read only on a refusal. Not KV:
// the free plan's 1,000 KV writes a day are spoken for.
const LG_EVERY = 3600000, LG_KEEP = 2 * 86400000;
let lgReady = false;
async function lgTable(db) {
  if (lgReady) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS lastgood (k TEXT PRIMARY KEY, v TEXT NOT NULL, ts INTEGER NOT NULL)').run();
  lgReady = true;
}
async function lgRead(env, k) {
  const db = env && env.ADMIN_DB;
  if (!db) return null;
  try {
    await lgTable(db);
    const r = await db.prepare('SELECT v, ts FROM lastgood WHERE k = ?1').bind(k).first();
    if (!r || Date.now() - Number(r.ts) > LG_KEEP) return null;
    return JSON.parse(r.v);
  } catch (_) { return null; }
}
async function lgKeep(env, k, body) {
  const db = env && env.ADMIN_DB;
  if (!db) return;
  try {
    await lgTable(db);
    await db.prepare('INSERT INTO lastgood (k, v, ts) VALUES (?1, ?2, ?3) ON CONFLICT(k) DO UPDATE SET v = excluded.v, ts = excluded.ts'
      + ' WHERE excluded.ts - lastgood.ts > ?4').bind(k, JSON.stringify(body), Date.now(), LG_EVERY).run();
  } catch (_) {}
}

const json = (body, secs) => new Response(JSON.stringify(body), {
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=' + secs,
    'access-control-allow-origin': '*',
  },
});

const num = (v) => { const n = Number(v); return isFinite(n) ? n : null; };

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const acct = (url.searchParams.get('acct') || '').trim();
  const p = (url.searchParams.get('p') || '1m').trim().toLowerCase();
  if (!ADDR.test(acct)) return json({ ok: false, error: 'bad account', pts: [] }, 60);
  if (!PERIODS[p]) return json({ ok: false, error: 'bad period', pts: [] }, 60);

  const cache = caches.default;
  const key = new Request(url.origin + url.pathname + '?v=1&acct=' + acct + '&p=' + p, request);
  const hit = await cache.match(key);
  if (hit) return hit;

  let out;
  try {
    const headers = { accept: 'application/json', 'user-agent': 'LumosCore/1.0 (+https://lumoscore.com)' };
    if (env && env.XRPLTO_API_KEY) headers['x-api-key'] = env.XRPLTO_API_KEY;
    const r = await fetch(UP + '/amm/liquidity-chart?ammAccount=' + acct + '&period=' + p, { headers });
    if (!r.ok) throw new Error('upstream ' + r.status);
    const j = await r.json();
    if (j && j.ammAccount && j.ammAccount !== acct) throw new Error('upstream answered for another pool');

    // Daily points carry midnight in `date` and 0 in `hour`; hourly points (1d) carry the hour separately,
    // while the longest range already folds it into `date`. Adding `hour` only to a midnight date handles all
    // three without double-counting.
    const pts = ((j && j.data) || []).map((d) => {
      let t = Date.parse(d.date);
      const h = num(d.hour) || 0;
      if (isFinite(t) && new Date(t).getUTCHours() === 0 && h > 0) t += h * 3600000;
      return [t, num(d.tvl), num(d.volume), num(d.fees), num(d.trades)];
    }).filter((x) => isFinite(x[0]) && x[1] != null && x[1] >= 0).sort((a, b) => a[0] - b[0]);

    out = { ok: true, acct, p, unit: 'XRP', count: pts.length, pts, src: 'xrpl.to' };
  } catch (e) {
    // A REFUSED UPSTREAM BLANKED THE CHART FOR EVERYONE (RAZA 2026-11-17: "Could not load the liquidity
    // history" on the live XRP/RLUSD pool, xrpl.to answering 429). Nothing was kept and nothing was
    // cached, so every visitor asked the refusing upstream again and got an empty chart. Same shape as
    // xrplpools/xrpltokens now: the last good series, kept for a day, is served marked `stale` with the
    // time it was taken; whichever answer this is, it is held under the main key briefly so a 429
    // window costs one upstream call per colo -- stale (real data, labelled) 60s, a plain failure 30s
    // (seconds only: never cache a failure as an answer).
    const err = String((e && e.message) || e);
    const last = await cache.match(lastKey(url, acct, p)).catch(() => null);
    let old = last ? await last.json().catch(() => null) : null;
    // This data center never held it: the copy every data center shares (lgRead, above).
    if (!(old && old.ok === true && old.pts && old.pts.length)) old = await lgRead(env, 'ammchart:' + acct + ':' + p);
    const isStale = !!(old && old.ok === true && old.pts && old.pts.length);
    const res = isStale
      ? json({ ...old, stale: true, error: err }, 60)
      : json({ ok: false, error: err, pts: [] }, 10);
    res.headers.set('x-lx-upstream', isStale ? 'stale' : 'failed');
    context.waitUntil(cache.put(key, res.clone()));
    // A FAILURE IS NEVER KEPT BY THE BROWSER (2026-11-20): the page's quiet retry was answered from its own HTTP cache
    // with the same failure for 30s. The edge holds it 10s, so a refusing upstream is asked once per colo, not per visitor.
    if (!isStale) res.headers.set('cache-control', 'no-store');
    return res;
  }

  const res = json(out, TTL);
  res.headers.set('x-lx-upstream', 'live');
  context.waitUntil(cache.put(key, res.clone()));
  // …and the copy that outlives a refusal, served by the catch above.
  context.waitUntil(cache.put(lastKey(url, acct, p), json({ ...out, cachedAt: Date.now() }, 86400)));
  context.waitUntil(lgKeep(env, 'ammchart:' + acct + ':' + p, { ...out, cachedAt: Date.now() }));   // every colo's fallback
  return res;
}

// A second cache entry, kept for a day, holding the last series the upstream actually gave -- per pool
// and per period, so a refused 1y request is never answered with another pool's or another range's line.
function lastKey(url, acct, p) {
  return new Request(url.origin + url.pathname + '?lastgood=1&acct=' + acct + '&p=' + p);
}
