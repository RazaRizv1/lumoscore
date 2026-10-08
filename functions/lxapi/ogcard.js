// The social preview card: an asset's logo padded onto a 1200x630 brand canvas, served from ONE clean
// URL.
//
// WHY NOT /cdn-cgi/image/... DIRECTLY: that form has to carry the source inside the path, so the
// og:image became a URL with a full https:// nested in it AND a query string. It works when fetched,
// but it is an odd shape to hand a crawler, and it left the transform's caching and content-type out
// of our hands. Cloudflare exposes the same transformation through the `cf.image` option on a normal
// fetch, so this endpoint does it internally and the tag stays a plain URL.
//
// The logo is resolved exactly as the rest of the site resolves it -- admin override first, then the
// issuer's toml -- via /lxapi/logoimg, which also fences the fetch of an issuer-controlled URL.
//
// A missing logo is a 404, not an empty brand-coloured rectangle: the middleware only advertises this
// card when a logo exists, and a blank canvas would be worse than no preview.
const ASSET_RE = /^[A-Za-z0-9]{1,12}-G[A-Z2-7]{55}$/;
const TTL = 86400;
// Bump to retire every cached card at once.
const CARD_V = 4;

export async function onRequestGet(ctx) {
  const { request } = ctx;
  const url = new URL(request.url);
  const asset = url.searchParams.get('asset') || '';
  if (!ASSET_RE.test(asset)) {
    return new Response(null, { status: 400, headers: { 'cache-control': 'public, max-age=300' } });
  }

  // A Pages Function response is NOT edge-cached by default -- measured cf-cache-status: DYNAMIC --
  // so every crawler hit was paying for a stellar.expert lookup, a third-party logo fetch and a
  // transform. That is 2-3 seconds, which is longer than a social crawler will wait, and it is why a
  // link often only produced a card on the second or third attempt. Serving from the Cache API turns
  // every hit after the first into a read.
  const cache = caches.default;
  // VERSIONED CACHE KEY. Entries written before the designed cards existed are still in the edge
  // cache and this lookup runs before the static-file check, so every asset already fetched kept
  // serving the old padded logo -- production returned a 16KB jpeg while the new 71KB png sat right
  // there. Keying on our own versioned URL rather than the incoming request retires the whole
  // previous generation at once, and bumping CARD_V does it again next time.
  const key = new Request(url.origin + '/lxapi/ogcard?v=' + CARD_V + '&asset=' + encodeURIComponent(asset));
  const hit = await cache.match(key);
  if (hit) return hit;

  // A DESIGNED CARD, IF THE BUILD DREW ONE.
  //
  // _tools/_ogcards.js renders a real 1200x630 card per curated asset -- code, logo, issuer domain,
  // verification mark, branding -- into assets/og/, which ships as a static file. Rendering one on
  // demand is not possible here: it needs satori plus a wasm rasteriser, about 8.5MB against a 1MB
  // bundle cap, and 50-200ms of CPU against a 10ms budget.
  //
  // Checked HERE rather than in the middleware on purpose. The middleware already points every asset
  // at this endpoint, so preferring the static file inside it means no page markup changes, no second
  // list of which assets have cards to keep in step, and an asset whose card was never drawn simply
  // falls through to the padded-logo version below.
  try {
    const stat = await fetch(url.origin + '/assets/og/' + encodeURIComponent(asset) + '.png', {
      cf: { cacheTtlByStatus: { '200-299': TTL, '300-399': 0, '400-599': 0 }, cacheEverything: true },
    });
    if (stat.ok && (stat.headers.get('content-type') || '').indexOf('image/') === 0) {
      const out = new Response(stat.body, {
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
  } catch (e) { /* fall through to the padded logo */ }

  // NO CARD OF ITS OWN -> THE SECTION CARD FOR ITS CHAIN.
  //
  // This used to pad the asset's logo onto a flat 1200x630 rectangle through Cloudflare's resizing.
  // In practice a logo is a 32px favicon, so the result was that favicon blown up eight-fold: a
  // blurry square on an empty field, carrying no text, no wordmark and nothing identifying
  // LumosCore. It was worse than showing no card, because a crawler happily published it.
  //
  // RAZA 2026-10-08: "if the asset is not curated (meaning, we can't show a custom preview for it),
  // show this preview card instead lumoscore.com/trade/stellar". So an uncurated asset now shares
  // the trade page's card -- branded, legible at thumbnail size, and true: it points at the page
  // the link leads to. _tools/_ogsection.js draws it.
  try {
    const sec = await fetch(url.origin + '/assets/og/s/trade-stellar.png', {
      cf: { cacheTtlByStatus: { '200-299': TTL, '300-399': 0, '400-599': 0 }, cacheEverything: true },
    });
    if (sec.ok && (sec.headers.get('content-type') || '').indexOf('image/') === 0) {
      const out = new Response(sec.body, {
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
  } catch (e) { /* fall through to the 404 below */ }

  // The section card is a build artefact; if it is missing the build is broken, and a 404 is a
  // louder, more honest answer than an invented one.
  return new Response(null, { status: 404, headers: { 'cache-control': 'public, max-age=300' } });
}
