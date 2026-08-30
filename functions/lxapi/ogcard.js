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
const W = 1200;
const H = 630;
const BG = '#0a0a0b';        // --bg, the site's own background
const TTL = 86400;

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
  const hit = await cache.match(request);
  if (hit) return hit;

  const src = url.origin + '/lxapi/logoimg?asset=' + encodeURIComponent(asset);

  let r;
  try {
    r = await fetch(src, {
      headers: { accept: 'image/*' },
      cf: {
        cacheTtl: TTL,
        cacheEverything: true,
        image: {
          width: W,
          height: H,
          // pad rather than cover: a logo is not a photograph and must not be cropped into the frame
          fit: 'pad',
          background: BG,
          format: 'png',
          quality: 90,
        },
      },
    });
  } catch (e) {
    return new Response(null, { status: 502, headers: { 'cache-control': 'public, max-age=60' } });
  }

  // No logo upstream, or the transform declined it. Either way there is no card to serve.
  if (!r.ok) {
    return new Response(null, {
      status: r.status === 404 ? 404 : 502,
      headers: { 'cache-control': 'public, max-age=300' },
    });
  }

  const buf = await r.arrayBuffer();
  const type = r.headers.get('content-type') || 'image/png';
  const out = new Response(buf, {
    status: 200,
    headers: {
      'content-type': type,
      'content-length': String(buf.byteLength),
      // Long cache: the card only changes when the asset's logo does, and crawlers re-fetch rarely.
      'cache-control': 'public, max-age=' + TTL + ', s-maxage=' + TTL,
      'access-control-allow-origin': '*',
    },
  });

  // Store after responding, so the caller never waits on the write.
  try { ctx.waitUntil(cache.put(request, out.clone())); } catch (e) { /* cache is best-effort */ }
  return out;
}
