// 7-day sparklines for the Trade table.
//
// The market table's "7d Trend" column showed a percentage where lumoscore.com draws a curve. That
// was not a styling gap: the bulk /tokens response carries pro7d, a single NUMBER, and drawing a
// line from one number would be inventing the shape of the week. Checked the whole token object —
// 150-odd fields, and not one of them is a series.
//
// So the series has to be fetched per token, and that is the reason this endpoint is BATCHED rather
// than called once per row. Fifty rows would otherwise be fifty browser requests on every page load,
// against an upstream whose anonymous tier is 333 requests a DAY.
//
// THREE THINGS KEEP THE COST DOWN:
//
//   1. `lightweight=true` on the upstream call. Measured: 78,181 bytes without it, 1,169 with —
//      67x. The full response carries 2,000 price points for an 88x28 drawing.
//   2. A LONG edge TTL. A seven-day curve does not meaningfully change in fifteen minutes, and
//      every visitor served from one colo shares a single fetch.
//   3. Bounded concurrency WITH A RETRY. Fifty parallel requests to one host is how the logo probe
//      earned an HTTP 429 and lost 310 real logos. Six at a time still lost thirteen rows here, so
//      it is three plus a one-shot retry on 429 — see one().
//
// PARTIAL RESULTS ARE RETURNED, not an error. One token failing must not blank the column for the
// other forty-nine, and the page already has the percentage to fall back on per row.

const UP = 'https://api.xrpl.to/api';

// Fifteen minutes. The upstream data is a 7-day window; this is a rounding error on that.
const TTL = 900;

// Three at a time. Six lost thirteen of fifty rows to upstream refusals — see the retry note in
// one(). Slower per cold batch, but every result is cached for fifteen minutes and shared.
const CONC = 3;

// A page shows fifty. The cap is here so a crafted query cannot turn one request into a thousand
// upstream calls.
const MAX_IDS = 100;

// How many points to keep. The drawing is 88 CSS pixels wide, so 2,000 points is 22 per pixel —
// every one of them a string that has to cross the wire and be parsed. Sixty is more than the
// geometry can show.
const POINTS = 60;

const json = (body, secs) => new Response(JSON.stringify(body), {
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=' + secs,
    'access-control-allow-origin': '*',
  },
});

async function one(id, env) {
  // The User-Agent is mandatory upstream: without one it answers 403 to everything. Measured.
  const headers = {
    accept: 'application/json',
    'user-agent': 'LumosCore/1.0 (+https://lumoscore.com)',
  };
  if (env && env.XRPLTO_API_KEY) headers['x-api-key'] = env.XRPLTO_API_KEY;

  // RETRY ON 429, because the first version did not and it silently lost a quarter of the column.
  //
  // Measured: asking for one page's fifty ids returned 37. The thirteen missing were exactly the
  // lowest-volume rows, which reads like thin tokens having no history — and that is what I was
  // about to write down. Asking for one of them ON ITS OWN returned a full series, so they were not
  // history-less at all: they were the tail of the queue, arriving after the upstream had started
  // refusing. The volume correlation was just the order the queue happened to be in.
  //
  // A silent null is the wrong shape for a throttle. Same one-retry-with-Retry-After as
  // xrpltokens.js, and the concurrency below came down to match.
  let r = await fetch(UP + '/sparkline/' + encodeURIComponent(id) + '?period=7d&lightweight=true',
    { headers });
  if (r.status === 429) {
    const ra = Number(r.headers.get('retry-after'));
    await new Promise((res) => setTimeout(res, isFinite(ra) && ra > 0 && ra <= 5 ? ra * 1000 : 900));
    r = await fetch(UP + '/sparkline/' + encodeURIComponent(id) + '?period=7d&lightweight=true',
      { headers });
  }
  if (!r.ok) return null;                       // still refused, or a 404: the row keeps its percentage
  const j = await r.json();

  const raw = (j && j.data && j.data.prices) || [];
  if (raw.length < 2) return null;

  // The upstream sends prices as STRINGS with twenty decimal places. Number() them here rather than
  // in the browser: it is the same arithmetic either way, but doing it once at the edge means the
  // response is a tenth the size and the page does no parsing per row.
  const step = Math.max(1, Math.ceil(raw.length / POINTS));
  const out = [];
  for (let i = 0; i < raw.length; i += step) {
    const v = Number(raw[i]);
    if (isFinite(v)) out.push(v);
  }
  const lastRaw = Number(raw[raw.length - 1]);
  if (isFinite(lastRaw) && out[out.length - 1] !== lastRaw) out.push(lastRaw);

  return out.length >= 2 ? out : null;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const ids = (url.searchParams.get('ids') || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[0-9a-f]{32}$/.test(s))     // an md5 or nothing; never a pass-through
    .slice(0, MAX_IDS);

  if (!ids.length) return json({ ok: false, error: 'no ids' }, 60);

  // Keyed on the SORTED id list, so two pages asking for the same fifty tokens in a different order
  // share one cache entry rather than each paying for its own.
  const key = new Request(url.origin + '/lxapi/xrplspark?ids=' + ids.slice().sort().join(','),
    { method: 'GET' });
  const cache = caches.default;
  const hit = await cache.match(key);
  if (hit) return hit;

  const series = {};
  let queue = ids.slice();
  async function worker() {
    for (;;) {
      const id = queue.shift();
      if (!id) return;
      try {
        const pts = await one(id, env);
        if (pts) series[id] = pts;
      } catch (e) { /* one token's failure is not the column's failure */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONC, ids.length) }, worker));

  const res = json({
    ok: true,
    count: Object.keys(series).length,
    asked: ids.length,
    series,
    src: 'xrpl.to',
    // Carried through verbatim from the upstream, which states it as a REQUIREMENT on any surface
    // showing this data. Kept in the response whatever the page currently chooses to render.
    attribution: 'Data by xrpl.to',
    attributionUrl: 'https://xrpl.to',
  }, TTL);

  context.waitUntil(cache.put(key, res.clone()));
  return res;
}
