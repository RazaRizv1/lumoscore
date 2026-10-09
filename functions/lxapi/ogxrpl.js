// The share card for one XRP Ledger asset, from ONE clean URL.
//
// _tools/_ogxrpl.js draws a card for the top 100 XRPL assets by 24h volume -- the only filter on
// that chain that costs something, since it has no curated roster and liquidity there can be
// conjured for free. Everything outside those hundred falls back to the chain's trade card, the
// same rule an uncurated Stellar asset follows.
//
// Resolved HERE rather than in the middleware so the list of which hundred were drawn stays a
// property of the build instead of something to keep in step in two places.
import { CARD_V } from '../../_lib/ogcardver.js';

const TTL = 86400;
// THIS MUST MATCH _tools/_ogxrpl.js EXACTLY. It did not: the builder was widened to allow $, because
// real tickers use it and $max and $FLIPPY are both in the top hundred, and this copy was left
// behind -- so their cards were drawn and then refused with a 400 by the endpoint meant to serve
// them. Two copies of one rule, and only the half that rejects was wrong, which is invisible until
// something that should work does not. Change one, change the other.
const ID_RE = /^[A-Za-z0-9$][A-Za-z0-9$._-]{0,23}-r[1-9A-HJ-NP-Za-km-z]{24,34}$/;

export async function onRequestGet(ctx) {
  const url = new URL(ctx.request.url);
  // ONE PARAMETER, SO THE URL CARRIES NO AMPERSAND. Written with two, the tag reads "&amp;" -- which
  // is correct HTML, and which a crawler that does not decode entities fetches literally and gets a
  // 400 for. Measured when the pool cards were wired.
  const id = url.searchParams.get('a') || '';
  if (!ID_RE.test(id)) {
    return new Response(null, { status: 400, headers: { 'cache-control': 'public, max-age=300' } });
  }

  const cache = caches.default;
  const key = new Request(url.origin + '/lxapi/ogxrpl?v=' + CARD_V + '.' + encodeURIComponent(id));
  const hit = await cache.match(key);
  if (hit) return hit;

  const opts = { cf: { cacheTtlByStatus: { '200-299': TTL, '300-399': 0, '400-599': 0 }, cacheEverything: true } };
  const tries = [
    url.origin + '/assets/og/x/' + encodeURIComponent(id) + '.png',
    url.origin + '/assets/og/s/trade-xrpl.png',
  ];
  for (const href of tries) {
    try {
      const r = await fetch(href, opts);
      if (r.ok && (r.headers.get('content-type') || '').indexOf('image/') === 0) {
        const out = new Response(r.body, {
          status: 200,
          headers: {
            'content-type': 'image/png',
            'cache-control': 'public, max-age=' + TTL + ', immutable',
            'access-control-allow-origin': '*',
          },
        });
        if (ctx.waitUntil) ctx.waitUntil(cache.put(key, out.clone()));
        return out;
      }
    } catch (e) { /* try the fallback, then give up */ }
  }

  return new Response(null, { status: 404, headers: { 'cache-control': 'public, max-age=300' } });
}
