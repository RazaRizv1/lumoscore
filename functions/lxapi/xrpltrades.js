// GET /lxapi/xrpltrades?iss=<issuer>&cur=<currency>&s=<startMs>&e=<endMs>
// GET /lxapi/xrpltrades?iss=<issuer>&cur=<currency>&b=<t0>,<t1>,…,<tn>     (up to 41 boundaries → 40 windows)
//
// How many trades a token printed inside a time window — the "Trades" line of the Trade-Asset chart's hover card.
// RAZA 2026-09-15: "Number of trades is missing in chart hover. We have it on Stellar." Stellar's candles come from
// Horizon's trade aggregations, which carry a count; xrpl.to's OHLC candles do not (checked: six columns at every
// range, interval and resolution). Its trade history does report the total for any window.
//
// THE BATCH FORM exists because the single form showed "…" while a hovered candle's count was fetched (RAZA: "for split
// seconds it shows 3 dots"). The page now asks for every candle of the range as soon as the chart draws, forty windows
// per request; each window is cached on its own, so the batch and the single form share answers.
//
// A window that ended more than an hour ago cannot change, so it is cached for a day; a live one for a minute.
// A capped ("truncated") total is not a count, and comes back as null.
import { tokenId } from './_tokenid.js';

const UP = 'https://api.xrpl.to/api';
const MAX_SPAN = 400 * 86400000;
// Thirteen boundaries, twelve windows: a window costs up to three subrequests (cache read, upstream, cache write) and a
// free-plan invocation stops at fifty — a forty-window batch answered its first eighteen and returned null for the rest.
const MAX_BOUNDS = 13;
// Two at a time, each retried once: at four, a page's burst of batches came back all-null from the upstream.
const CONCURRENCY = 2;

const json = (body, secs) => new Response(JSON.stringify(body), {
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=' + secs,
    'access-control-allow-origin': '*',
  },
});

function validWindow(s, e, now) {
  return s > 1.3e12 && e > s && e - s <= MAX_SPAN && s <= now;
}

// One window: from the edge cache if it is there, otherwise from the upstream (and cached for next time).
async function countWindow(ctx, id, s, e0, now) {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const cache = caches.default;
  const key = new Request(url.origin + url.pathname + '?v=1&id=' + id + '&s=' + s + '&e=' + e0, request);
  const hit = await cache.match(key);
  if (hit) {
    try { const j = await hit.json(); return j && j.ok && !j.truncated ? j.n : null; } catch (err) { /* refetch */ }
  }
  const e = Math.min(e0, now);
  const headers = { accept: 'application/json', 'user-agent': 'LumosCore/1.0 (+https://lumoscore.com)' };
  if (env && env.XRPLTO_API_KEY) headers['x-api-key'] = env.XRPLTO_API_KEY;
  const r = await fetch(UP + '/history?md5=' + id + '&start_time=' + s + '&end_time=' + e + '&limit=1', { headers });
  if (!r.ok) throw new Error('upstream ' + r.status);
  const j = await r.json();
  const m = (j && j.meta) || {};
  const n = Number(m.total);
  if (!isFinite(n) || n < 0) throw new Error('no total');
  const out = { ok: true, n, truncated: !!m.truncated };
  ctx.waitUntil(cache.put(key, json(out, e0 < now - 3600000 ? 86400 : 60)));
  return out.truncated ? null : n;
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const now = Date.now();
  const id = await tokenId(url.searchParams.get('iss'), url.searchParams.get('cur'));
  if (!id) return json({ ok: false, error: 'unknown token' }, 60);

  const bRaw = url.searchParams.get('b');
  if (bRaw) {
    const b = bRaw.split(',').slice(0, MAX_BOUNDS).map((x) => parseInt(x, 10));
    if (b.length < 2 || b.some((x, i) => !isFinite(x) || (i && x <= b[i - 1]))) {
      return json({ ok: false, error: 'bad boundaries' }, 60);
    }
    const n = new Array(b.length - 1).fill(null);
    let next = 0;
    async function worker() {
      while (next < n.length) {
        const i = next++;
        if (!validWindow(b[i], b[i + 1], now)) continue;
        try { n[i] = await countWindow(context, id, b[i], b[i + 1], now); } catch (err) {
          await new Promise((res) => setTimeout(res, 350));
          try { n[i] = await countWindow(context, id, b[i], b[i + 1], now); } catch (err2) { n[i] = null; }
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    // Short cache on the batch itself: its windows are cached individually, and the newest one is still moving. A batch
    // with a gap is not cached at all, so the next request asks again instead of being handed the same nulls.
    const gap = n.some((x, i) => x == null && validWindow(b[i], b[i + 1], now));
    return json({ ok: true, n }, gap ? 0 : 60);
  }

  const s = parseInt(url.searchParams.get('s') || '', 10);
  const e0 = parseInt(url.searchParams.get('e') || '', 10);
  if (!validWindow(s, e0, now)) return json({ ok: false, error: 'bad window' }, 60);
  try {
    const n = await countWindow(context, id, s, e0, now);
    return json(n == null ? { ok: true, n: null, truncated: true } : { ok: true, n, truncated: false }, e0 < now - 3600000 ? 86400 : 60);
  } catch (err) {
    return json({ ok: false, error: String((err && err.message) || err) }, 30);
  }
}
