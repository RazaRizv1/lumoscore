// Token logos, proxied so the API key never reaches the browser.
//
// xrpl.to's thumbnail endpoint REQUIRES a key — it answers 401 without one, which is why every
// token on this site has been drawing letter initials. The key is a server-side credential, so the
// page cannot call that endpoint directly: putting it in front-end code would publish it to anyone
// who opens devtools, and it is the same key that carries this project's whole request budget.
//
// So the image is fetched here and passed through. The browser only ever sees /lxapi/xrplthumb.
//
// Cached hard. A token's logo effectively never changes, and every row of every market table asks
// for one, so this is the highest-volume endpoint in the project by a wide margin.

import { tokenId } from './_tokenid.js';

const UP = 'https://api.xrpl.to/api/thumb/';
const TTL = 604800;                    // a week; logos do not move

// md5('rsPqeamjpr3Bxu4LhtCgvJEAQusYRRg6Ha_4C554D4F53' + 30 zeros) — LUMOS, under the same scheme as every other token.
const LUMOS_ID = '5c4fb27e6ea19e0bde8900d2c0a7b177';

// Only the sizes xrpl.to actually serves. Anything else is rejected rather than passed through,
// so this cannot be turned into an open image proxy for arbitrary upstream paths.
const SIZES = [16, 32, 40, 48, 64, 96, 128];

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // A token id is an md5: exactly 32 hex characters. Validated rather than forwarded, so nothing
  // else can be appended to the upstream path.
  let id = (url.searchParams.get('id') || '').trim().toLowerCase();

  // ...and the id is DERIVABLE, which is what lets the wallet draw logos at all.
  //
  // Every other list on this site takes the id from an API row (`m`), because it is listing tokens
  // the API just ranked. The wallet lists what an ACCOUNT holds, straight off account_lines, and a
  // holding is frequently nowhere near the top of any ranking — so there is no row to take it from,
  // and one lookup per holding would be dozens of requests to price a single page.
  //
  // The derivation itself is in _tokenid.js, shared with the OHLC endpoint.
  if (!id) id = await tokenId(url.searchParams.get('iss'), url.searchParams.get('cur'));

  if (!/^[0-9a-f]{32}$/.test(id)) {
    return new Response('bad id', { status: 400, headers: { 'cache-control': 'public, max-age=3600' } });
  }
  // THE LUMOS MARK IS THIS PROJECT'S OWN (RAZA 2026-09-16: "Also fix lumos logo. Use the same logo that we're using on
  // Stellar"). The upstream holds a different artwork for the token, and it was being drawn on every surface that shows a
  // logo. Answering here — rather than at each of the dozen call sites — means one rule covers the lot, including rows that
  // arrive with an id and never name the issuer. The file is byte-identical to lumoscore.com's.
  if (id === LUMOS_ID) {
    const own = await fetch(url.origin + '/assets/tokens/lumos.png').catch(() => null);
    if (own && own.ok) {
      return new Response(own.body, {
        headers: {
          'content-type': 'image/png',
          'cache-control': 'public, max-age=' + TTL + ', immutable',
          'access-control-allow-origin': '*',
        },
      });
    }
    return Response.redirect(url.origin + '/assets/tokens/lumos.png', 302);
  }

  let w = parseInt(url.searchParams.get('w') || '48', 10);
  if (SIZES.indexOf(w) < 0) w = 48;

  const cache = caches.default;
  const key = new Request(url.origin + url.pathname + '?id=' + id + '&w=' + w, request);
  const hit = await cache.match(key);
  if (hit) return hit;

  const headers = { accept: 'image/webp,image/*', 'user-agent': 'LumosCore/1.0 (+https://lumoscore.com)' };
  if (env && env.XRPLTO_API_KEY) headers['x-api-key'] = env.XRPLTO_API_KEY;

  // RAZA 2026-09-15: "WHys the logo for this asset not loading" / "some asset logos are not loading" — the image was there;
  // a refused upstream call answered with an error the browser then kept for ten minutes. One retry, and an error is never
  // cached, so the next view asks again.
  let upstream = null;
  // A 429 is the upstream's burst cap (a wallet page asks for a hundred logos): waited out, three more times.
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      upstream = await fetch(UP + id + '?w=' + w, { headers });
      if (upstream.ok || upstream.status === 401 || upstream.status === 404) break;
    } catch (e) { upstream = null; }
    const ra = upstream ? Number(upstream.headers.get('retry-after')) : 0;
    await new Promise((res) => setTimeout(res, isFinite(ra) && ra > 0 && ra <= 3 ? ra * 1000 : 450 * (attempt + 1)));
  }
  if (!upstream) return new Response('upstream unreachable', { status: 502, headers: { 'cache-control': 'no-store' } });

  // 401 here means the key is missing or rejected. Say so with a status the page can ignore
  // quietly — a missing logo must never break a row.
  if (!upstream.ok) {
    return new Response('no logo', {
      status: upstream.status === 401 ? 404 : upstream.status,
      headers: { 'cache-control': upstream.status === 404 || upstream.status === 401 ? 'public, max-age=600' : 'no-store' },
    });
  }

  const body = await upstream.arrayBuffer();
  const res = new Response(body, {
    headers: {
      'content-type': upstream.headers.get('content-type') || 'image/webp',
      'cache-control': 'public, max-age=' + TTL + ', immutable',
      'access-control-allow-origin': '*',
    },
  });
  context.waitUntil(cache.put(key, res.clone()));
  return res;
}
