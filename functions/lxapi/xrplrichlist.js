// Top holders of one token — the Trade-Asset page's "Holders" tab.
//
// The tab shipped fifty fabricated rows of EVM wallets ("0x00…c3a1  3.14M  12.800%") on a page about
// an XRP Ledger token, with the stats above them invented to match. This is the real thing.
//
// THE UPSTREAM 301-REDIRECTS. `api/richlist/<id>` answers 301 and the payload only arrives if the
// redirect is followed — a plain fetch that does not follow returns 200-with-nothing, which looks
// exactly like "this token has no holders". Workers' fetch follows by default; it is called out here
// because the first manual probe against it came back empty and read as a missing feature.
//
// Proxied for the usual reasons: 333 requests a day per IP, 2 per second, and an API key that must
// not reach the browser.

import { tokenId } from './_tokenid.js';

const UP = 'https://api.xrpl.to/api';
const TTL = 300;                    // a rich list moves slowly; five minutes is generous

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

  let id = (url.searchParams.get('id') || '').trim().slice(0, 120);
  if (!id) id = await tokenId(url.searchParams.get('iss'), url.searchParams.get('cur'));
  if (!id) return json({ ok: false, error: 'unknown token', rows: [] }, 60);

  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('n') || '50', 10) || 50));
  // Paging past the first hundred holders (the pool page's Participants list). Bounded, and an integer.
  const start = Math.min(10000, Math.max(0, parseInt(url.searchParams.get('start') || '0', 10) || 0));

  const CACHE_V = '2';
  const cache = caches.default;
  const key = new Request(url.origin + url.pathname + '?v=' + CACHE_V + '&id=' + id + '&n=' + limit + '&start=' + start, request);
  const hit = await cache.match(key);
  if (hit) return hit;

  let out;
  try {
    const headers = { accept: 'application/json', 'user-agent': 'LumosCore/1.0 (+https://lumoscore.com)' };
    if (env && env.XRPLTO_API_KEY) headers['x-api-key'] = env.XRPLTO_API_KEY;

    const r = await fetch(UP + '/richlist/' + encodeURIComponent(id) + '?start=' + start + '&limit=' + limit,
      { headers, redirect: 'follow' });
    if (!r.ok) throw new Error('upstream ' + r.status);
    const j = await r.json();

    const rows = ((j && j.richList) || []).map((h) => ({
      rank: num(h.rank),
      account: String(h.account || ''),
      balance: num(h.balance),
      // Percentage of supply, as the upstream computes it. Not recomputed here: dividing by a supply
      // figure from a different call is how two numbers on one screen end up disagreeing.
      holding: num(h.holding),
      // The biggest holder of a traded token is very often its own AMM pool, and saying so is the
      // difference between "one wallet owns 7%" and "7% is pooled liquidity".
      amm: !!h.isAMM,
      creator: !!h.isCreator,
      frozen: !!h.freeze,
      name: String(h.name || ''),
    })).filter((h) => h.account && h.balance != null);

    // A TRUSTLINE IS NOT A HOLDING (RAZA 2026-10-08: "its showing different count on Pools main page
    // participants column and then inside its showing different on participants box").
    //
    // Measured on rpREX8e8asAiG5vqxYmuDMvNKp2i96vWwA, straight from the ledger: the LP token has 13
    // trustlines and exactly 3 of them carry a balance of zero, so there are 10 liquidity providers.
    // The pools table said 10 and this box said 13, and the detail page showed BOTH — 10 from the
    // pool row, then 13 once the richlist landed and overwrote it. Upstream's `length` counts lines;
    // someone who withdrew everything keeps the line and is not a provider any more.
    //
    // It is the same distinction the LUMOS token page already had to make between holders and
    // trustlines, and a zero row is worth nothing on either page: it renders as a 0.00% participant.
    const kept = rows.filter((h) => h.balance > 0);
    const dropped = rows.length - kept.length;
    // Exact when this page held the whole list, which is every AMM pool — those have tens of
    // providers, not thousands. Past that the upstream total is corrected by what was actually seen,
    // which can still overcount further pages but never reports fewer than it is showing.
    const whole = start === 0 && rows.length < limit;
    const upstreamTotal = num(j && j.length);
    const realTotal = whole ? kept.length
      : Math.max(kept.length, (upstreamTotal == null ? kept.length : upstreamTotal - dropped));

    const s = (j && j.summary) || {};
    out = {
      ok: true,
      total: realTotal,                     // holders with a balance, not trustlines
      summary: { top10: num(s.top10Hold), top50: num(s.top50Hold), frozen: num(s.frozen) },
      start, count: kept.length, rows: kept,
      src: 'xrpl.to', attribution: 'Data by xrpl.to', attributionUrl: 'https://xrpl.to',
    };
  } catch (e) {
    const err = String((e && e.message) || e);
    // THE LAST GOOD LIST, from whichever data center fetched it (lgRead, above), marked stale. Else a failure the
    // browser does not keep and the edge holds 10s -- the pool page's Participants box retries on its own.
    const old = await lgRead(env, 'richlist:' + id + ':' + limit + ':' + start);
    if (old && old.ok === true) {
      const st = json({ ...old, stale: true, error: err }, 60);
      st.headers.set('x-lx-upstream', 'stale');
      context.waitUntil(cache.put(key, st.clone()));
      return st;
    }
    const res = json({ ok: false, error: err, rows: [] }, 10);
    context.waitUntil(cache.put(key, res.clone()));
    res.headers.set('cache-control', 'no-store');
    return res;
  }

  const res = json(out, TTL);
  context.waitUntil(cache.put(key, res.clone()));
  context.waitUntil(lgKeep(env, 'richlist:' + id + ':' + limit + ':' + start, out));   // every colo's fallback
  return res;
}
