// Cloudflare Pages Function — same-origin proxy for stellar.expert's ranked asset holders.
//
// This is the hosted equivalent of the /lxapi/holders route in serve.js. Without it the Trade-asset
// page loses its "Top 10 / Top 50 hold" figures, because:
//   * Horizon cannot rank holders at all (its /accounts?asset= is ordered by account id, not balance);
//   * stellar.expert DOES return a real ranking, but that one path is blocked in-browser here (both
//     fetch and XMLHttpRequest fail, while other paths on the same host succeed).
// Serving it from our own origin sidesteps that. The page already falls back to an unranked sample if
// this route 404s, so the site degrades rather than breaks — but the numbers are only right with it.
//
// Deliberately narrow, so this cannot be used as an open proxy: GET only, one fixed upstream path,
// and the asset must match CODE-GISSUER exactly. Nothing here reads a secret or touches user funds.
const ASSET_RE = /^[A-Za-z0-9]{1,12}-G[A-Z2-7]{55}$/;

export async function onRequestGet({ request }) {
  const q = new URL(request.url).searchParams;
  const asset = q.get('asset') || '';
  if (!ASSET_RE.test(asset)) {
    return new Response('{"error":"bad asset"}', {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  const limit = Math.min(parseInt(q.get('limit'), 10) || 50, 200);
  // Paging is by an OPAQUE cursor, not an offset: upstream returns nothing for cursor=200, while the
  // token from _links.next works and the pages stay correctly ranked with no overlap. So the token is
  // passed through rather than translated into a number.
  //
  // Still not an open proxy: restricted to the base64url/percent alphabet those tokens use, and to a
  // sane length, so nothing else can be appended to the upstream URL.
  const cur = q.get('cursor') || '';
  const okCur = !!cur && cur.length <= 256 && /^[A-Za-z0-9%+/=_-]+$/.test(cur);
  const upstream =
    'https://api.stellar.expert/explorer/public/asset/' + asset + '/holders?order=desc&limit=' + limit
    + (okCur ? '&cursor=' + encodeURIComponent(decodeURIComponent(cur)) : '');

  try {
    const r = await fetch(upstream, { cf: { cacheTtl: 120, cacheEverything: true } });
    const body = await r.text();
    return new Response(body, {
      status: r.status,
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=120' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e && e.message) || e) }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
}

// Anything other than GET is not part of this route's contract.
export async function onRequest({ request }) {
  if (request.method === 'GET') return onRequestGet({ request });
  return new Response('{"error":"method not allowed"}', {
    status: 405,
    headers: { 'content-type': 'application/json', allow: 'GET' },
  });
}
