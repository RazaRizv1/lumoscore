// Serves an asset's logo as an image FROM OUR OWN ORIGIN.
//
// WHY IT EXISTS: Cloudflare's image resizing only transforms sources on the same zone — pointing it at
// meta.stellar.expert or an issuer's own domain returns 403. Social previews need a 1200x630 card
// built from whatever logo the asset actually has, and most of those live on other people's domains.
// Proxying them here makes them resizable, and gives us the caching too.
//
// Resolution order matches the rest of the site: an admin-uploaded override wins, then the issuer's
// toml logo. That is the same order /lxapi/assetlogo uses, so the preview shows the same mark the page
// does.
//
// FETCHING A URL AN ISSUER CONTROLS IS THE RISK HERE, so it is fenced in:
//   * https only, so this cannot be pointed at internal or plaintext endpoints;
//   * the response must actually be an image, checked on content-type, not on the URL;
//   * a size ceiling and a timeout, so a hostile or broken origin cannot hold a worker open;
//   * nothing from the request is forwarded upstream, and nothing upstream is echoed back but bytes.
const ASSET_RE = /^[A-Za-z0-9]{1,12}-G[A-Z2-7]{55}$/;
const EXPERT = 'https://api.stellar.expert/explorer/public/asset?search=';
const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 6000;
const TTL = 86400;

function fail(status) {
  // A missing logo is not an error worth a body; the caller falls back to no image.
  return new Response(null, { status, headers: { 'cache-control': 'public, max-age=300' } });
}

async function overrideImage(env, asset) {
  try {
    const kv = env && env.CONTENT_KV;
    if (!kv) return '';
    const ov = await kv.get('asset:' + asset, 'json');
    return (ov && ov.image) || '';
  } catch (e) { return ''; }
}

async function tomlImage(asset) {
  try {
    const code = asset.split('-')[0];
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), TIMEOUT_MS);
    const r = await fetch(EXPERT + encodeURIComponent(code) + '&limit=20', {
      signal: c.signal, cf: { cacheTtl: TTL, cacheEverything: true },
    });
    clearTimeout(t);
    if (!r.ok) return '';
    const d = await r.json();
    const recs = (d && d._embedded && d._embedded.records) || [];
    const m = recs.filter((x) => String(x.asset || '').indexOf(asset) === 0)[0];
    const ti = (m && (m.tomlInfo || m.toml_info)) || {};
    return ti.image || ti.orgLogo || '';
  } catch (e) { return ''; }
}

export async function onRequestGet(ctx) {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const asset = url.searchParams.get('asset') || '';
  if (!ASSET_RE.test(asset)) return fail(400);

  let src = await overrideImage(env, asset);
  if (!src) src = await tomlImage(asset);
  if (!src) return fail(404);

  // A relative override is one of ours, already on this origin.
  if (src.indexOf('/') === 0) src = url.origin + src;
  if (src.indexOf('https://') !== 0) return fail(415);

  let up;
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), TIMEOUT_MS);
    up = await fetch(src, {
      signal: c.signal,
      redirect: 'follow',
      cf: { cacheTtl: TTL, cacheEverything: true },
    });
    clearTimeout(t);
  } catch (e) { return fail(504); }
  if (!up.ok) return fail(502);

  // Trust the response, not the URL: only actual images are passed through.
  const type = String(up.headers.get('content-type') || '').toLowerCase();
  if (type.indexOf('image/') !== 0) return fail(415);
  const len = parseInt(up.headers.get('content-length') || '0', 10);
  if (len && len > MAX_BYTES) return fail(413);

  const buf = await up.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return fail(413);

  return new Response(buf, {
    status: 200,
    headers: {
      'content-type': type,
      'cache-control': 'public, max-age=' + TTL,
      'access-control-allow-origin': '*',
    },
  });
}
