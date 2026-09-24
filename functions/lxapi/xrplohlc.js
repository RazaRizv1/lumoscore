// Price history for a token, for the charts.
//
// The $LUMOS page's chart SVG was built by `lx-ltdata`, so removing that layer left an empty box.
// This is the data behind its replacement.
//
// Proxied for the usual reason — the upstream key must not reach the browser — and because a chart
// with six range buttons is six requests per visitor otherwise, on top of everything else the page
// already fetches.
//
// Returned as a compact positional array per candle: [timeMs, close, high, low, open, volume].
//
// It used to be [timeMs, close] alone, on the reasoning that these charts draw a line and an area
// rather than wicks. That reasoning was wrong about the page: the Trade-Asset chart has an
// O/H/L/C/Δ/Vol strip above it, and dropping four of six values is why that strip showed six em
// dashes while the data sat unused in the same response.
//
// Close stays at index 1 so every existing consumer, which reads p[0]/p[1] positionally, is
// unaffected. Anything added later goes on the END for the same reason.

import { tokenId } from './_tokenid.js';

const UP = 'https://api.xrpl.to/api';

// Button label -> what the upstream understands. The upstream accepts 1D|5D|7D|1M|3M|1Y|5Y|ALL.
// "1H" is not one of them: it is served as a single day and trimmed client-side to the last hour,
// which is why the trim window travels in the response rather than being guessed by the page.
const RANGES = {
  '1H': { range: '1D', interval: '5m', trimMs: 60 * 60 * 1000 },
  '24H': { range: '1D', interval: '15m' },
  '7D': { range: '7D', interval: '1h' },
  '30D': { range: '1M', interval: '4h' },
  '1Y': { range: '1Y', interval: '1d' },
  'ALL': { range: 'ALL', interval: '1d' },
};

const TTL = 300;

const json = (body, secs) => new Response(JSON.stringify(body), {
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=' + secs,
    'access-control-allow-origin': '*',
  },
});

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Either the upstream's own id, or the issuer + currency it is derived from — the pool pages know
  // a reserve's issuer and currency off the ledger but have no ranking row to read an id out of.
  // See _tokenid.js; the same two forms are accepted by the thumbnail proxy.
  let id = (url.searchParams.get('id') || '').trim().slice(0, 120);
  if (!id) id = await tokenId(url.searchParams.get('iss'), url.searchParams.get('cur'));
  if (!id) return json({ ok: false, error: 'no id' }, 60);

  const label = (url.searchParams.get('r') || '7D').toUpperCase();
  const spec = RANGES[label];
  if (!spec) return json({ ok: false, error: 'bad range' }, 60);

  const vs = (url.searchParams.get('vs') || 'USD').toUpperCase() === 'XRP' ? 'XRP' : 'USD';

  const cache = caches.default;
  // Versioned: the Cache API survives a deploy, so without this the previous build's two-element
  // points would keep being served and the H/L strip would stay empty on every warm colo.
  // 4: zero-volume bars now carry the previous close. The Cache API survives a deploy, so a shape or value change
  // has to move the key or colos keep serving the old series.
  const CACHE_V = '4';
  const key = new Request(url.origin + url.pathname + '?v=' + CACHE_V + '&id=' + encodeURIComponent(id)
    + '&r=' + label + '&vs=' + vs, request);
  const hit = await cache.match(key);
  if (hit) return hit;
  // The last good answer, kept a week: a failed upstream call returns it rather than an empty chart.
  const staleKey = new Request(url.origin + url.pathname + '?stale=' + CACHE_V + '&id=' + encodeURIComponent(id)
    + '&r=' + label + '&vs=' + vs, request);

  let out;
  try {
    const headers = {
      accept: 'application/json',
      'user-agent': 'LumosCore/1.0 (+https://lumoscore.com)',
    };
    if (env && env.XRPLTO_API_KEY) headers['x-api-key'] = env.XRPLTO_API_KEY;

    const r = await fetch(UP + '/ohlc/' + encodeURIComponent(id)
      + '?range=' + spec.range + '&interval=' + spec.interval + '&vs_currency=' + vs, { headers });
    if (!r.ok) throw new Error('upstream ' + r.status);
    const j = await r.json();

    // Upstream candle: [time, open, high, low, close, volume].
    //
    // THE WHOLE CANDLE TRAVELS NOW: [t, close, high, low, open, volume]. All of it used to be
    // thrown away except the close, which is why the chart's O/H/L/C/Δ/Vol strip had nothing to read
    // and sat on six em dashes — the data was in the response the entire time.
    //
    // Appended, never inserted: every existing consumer reads p[0] and p[1] positionally and is
    // unaffected by the extra indices.
    let pts = ((j && j.ohlc) || [])
      .map((c) => [Number(c[0]), Number(c[4]), Number(c[2]), Number(c[3]), Number(c[1]), Number(c[5])])
      .filter((p) => isFinite(p[0]) && isFinite(p[1]) && p[1] > 0);

    // A CANDLE WITH NO TRADES CANNOT MOVE THE PRICE (RAZA 2026-09-17, on RAC: "why does this asset show as if it has just
    // been bought based on the chart, when its clearly not. its last trx as 77 days ago"). Its 1Y series carries the same
    // close for every day since April — correct, nothing traded — and then stamps TODAY's bar with a 15x higher figure on
    // zero volume. That is the live quote off the order book, not a fill, and drawn as a candle it reads as a buy that
    // never happened. Every other day with no volume is already flat; only the current bar gets the quote.
    //
    // So a bar with no volume carries the previous close, which is what the upstream does for all the older ones. Measured
    // before applying: across LUMOS (35 zero-volume bars), SOLO (0) and ATM (3), not one zero-volume bar moves the price
    // by even 1% — the rule changes nothing anywhere except the case it exists for.
    //
    // NO SERIES-LEVEL GUARD (RAZA 2026-09-17, an hour after the first fix: "whys this asset still showing as if it has
    // pumped today"). The first version only applied when the series had volume SOMEWHERE, to protect against a feed that
    // never reports it — which switched the repair off for exactly the tokens that need it: RAC has ZERO volume across
    // 24H, 7D and 30D, because it has not traded since April, and those are the ranges he was looking at.
    //
    // Measured instead of assumed, across every interval this endpoint serves: LUMOS 21 of 87 bars carry volume at 24H,
    // SOLO 67 of 95, and RAC carries volume on 20 of its 365 daily bars — the days it did trade. The upstream reports
    // volume whenever trades happen, at every granularity. A bar without it is a bar in which nothing changed hands, and
    // it holds the price it inherited; a series without any is a window in which the token did not trade at all, which is
    // a flat line and not a 1,462% rise.
    for (let k = 1; k < pts.length; k++) {
      const v = pts[k][5];
      if (isFinite(v) && v > 0) continue;
      const prev = pts[k - 1][1];
      if (!(prev > 0)) continue;
      pts[k][1] = prev; pts[k][2] = prev; pts[k][3] = prev; pts[k][4] = prev;
    }

    if (spec.trimMs && pts.length) {
      const cut = pts[pts.length - 1][0] - spec.trimMs;
      const trimmed = pts.filter((p) => p[0] >= cut);
      // Only use the trim if something survives it: an illiquid token may have no candle in the
      // last hour at all, and an empty chart is worse than a slightly longer one.
      if (trimmed.length > 1) pts = trimmed;
    }

    out = {
      ok: true, id, range: label, vs,
      interval: String(j && j.interval || spec.interval),
      count: pts.length,
      pts,
      src: 'xrpl.to', attribution: 'Data by xrpl.to', attributionUrl: 'https://xrpl.to',
    };
  } catch (e) {
    const stale = await cache.match(staleKey);
    if (stale) {
      try { const sj = await stale.json(); if (sj && sj.ok) return json(sj, 60); } catch (err) { /* fall through */ }
    }
    return json({ ok: false, id, range: label, error: String((e && e.message) || e), pts: [] }, 0);
  }

  const res = json(out, TTL);
  context.waitUntil(cache.put(key, res.clone()));
  context.waitUntil(cache.put(staleKey, json(out, 604800)));
  return res;
}
