// The share card for one liquidity pool, served from ONE clean URL.
//
// _tools/_ogpools.js draws a card per pool for the top 100 on each chain -- Stellar by TVL, the XRP
// Ledger by 24h volume, for the reason set out in that file -- into assets/og/p/. There are 11,026
// Stellar pools and 31,328 XRPL ones, so most pools have no card of their own; those fall back to
// their chain's pools card, the same rule an uncurated asset follows.
//
// Resolved HERE rather than in the middleware on purpose: the middleware can point every pool at
// this endpoint without carrying a list of which hundred were drawn, and that list stays a property
// of the build rather than something to keep in step in two places.
import { CARD_V } from '../../_lib/ogcardver.js';

const TTL = 86400;
// Stellar pools are identified by a 64-character hex id; an XRPL pool by its AMM account, which is
// what the url carries -- NOT the row id the pools endpoint also returns.
const ID_RE = { stellar: /^[0-9a-f]{64}$/i, xrpl: /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/ };

function pass(body, extra) {
  return new Response(body, {
    status: 200,
    headers: Object.assign({
      'content-type': 'image/png',
      'cache-control': 'public, max-age=' + TTL + ', immutable',
      'access-control-allow-origin': '*',
    }, extra || {}),
  });
}

// ONE PARAMETER, SO THE URL CARRIES NO AMPERSAND.
//
// Written as ?c=stellar&id=… the tag reads content="…?c=stellar&amp;id=…", which is correct HTML --
// and a conforming parser decodes it and fetches the right url, verified at 200. A crawler that does
// NOT decode entities fetches "amp;id=…" instead, gets a 400, and shows no card at all. Social
// crawlers are exactly the audience here and they are not uniformly careful, so the ampersand is
// removed rather than relied upon. "stellar-<id>" is also the filename, so nothing has to be joined.
const KEY_RE = /^(stellar|xrpl)-(.+)$/;

export async function onRequestGet(ctx) {
  const { request } = ctx;
  const url = new URL(request.url);
  const m = KEY_RE.exec(url.searchParams.get('p') || '');
  const chain = m ? m[1] : '';
  const id = m ? m[2] : '';
  if (!m || !ID_RE[chain].test(id)) {
    return new Response(null, { status: 400, headers: { 'cache-control': 'public, max-age=300' } });
  }

  // A Pages Function response is not edge-cached by default, so without this every crawler hit pays
  // for the subrequest again. Keyed on our own versioned url so bumping CARD_V retires the previous
  // generation at once, exactly as ogcard.js does.
  const cache = caches.default;
  const key = new Request(url.origin + '/lxapi/ogpool?v=' + CARD_V + '.' + chain + '-' + encodeURIComponent(id));
  const hit = await cache.match(key);
  if (hit) return hit;

  const opts = { cf: { cacheTtlByStatus: { '200-299': TTL, '300-399': 0, '400-599': 0 }, cacheEverything: true } };
  const tries = [
    url.origin + '/assets/og/p/' + chain + '-' + encodeURIComponent(id) + '.png',
    url.origin + '/assets/og/s/pools-' + chain + '.png',
  ];
  for (const href of tries) {
    try {
      const r = await fetch(href, opts);
      if (r.ok && (r.headers.get('content-type') || '').indexOf('image/') === 0) {
        const out = pass(r.body);
        if (ctx.waitUntil) ctx.waitUntil(cache.put(key, out.clone()));
        return out;
      }
    } catch (e) { /* try the fallback, then give up */ }
  }

  // Both are build artefacts; if neither is there the build is broken, and a 404 says so more
  // honestly than an invented image.
  return new Response(null, { status: 404, headers: { 'cache-control': 'public, max-age=300' } });
}
