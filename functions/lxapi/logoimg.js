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
//   * https only, and still https after any redirect, so this cannot be pointed at internal or
//     plaintext endpoints;
//   * RASTER images only, and the bytes themselves must match the format they claim -- see below;
//   * a size ceiling and a timeout, so a hostile or broken origin cannot hold a worker open;
//   * nothing from the request is forwarded upstream, and nothing upstream is echoed back but bytes.
//
// ⚠ WHY SVG IS REFUSED, even though it is an image. This endpoint returns issuer-controlled bytes
// FROM lumoscore.com, and its URL is public and directly navigable -- it is what og:image points at,
// so it gets shared and pasted. An SVG is a document: it can carry <script>, and while that script
// stays inert inside an <img>, it executes with full lumoscore.com privileges the moment anyone opens
// the URL in a tab. An issuer only has to put their own https URL in their toml's image field to get
// script execution on our origin. There is no version of "sanitising" an SVG here that is worth the
// risk when every logo on the site renders perfectly well as a raster.
//
// Content-type alone is not proof either -- it is a header the attacker sets. The bytes are checked
// against the format's own signature, and the type WE emit is the one the signature proves, never the
// string upstream sent. nosniff and a null CSP are belt and braces on top of that.
const ASSET_RE = /^[A-Za-z0-9]{1,12}-G[A-Z2-7]{55}$/;
const EXPERT = 'https://api.stellar.expert/explorer/public/asset?search=';
const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 6000;
const TTL = 86400;

// Same raster set the upload paths accept (media.js, listing.js). No svg, no xml, no anything that a
// browser will parse as a document.
const OK_TYPES = { 'image/png': 1, 'image/jpeg': 1, 'image/webp': 1, 'image/gif': 1, 'image/avif': 1 };

// Returns the content-type the BYTES prove, or '' if they prove nothing we accept.
function sniff(buf) {
  const b = new Uint8Array(buf);
  if (b.length < 12) return '';
  const at = (i, sig) => sig.every((v, k) => b[i + k] === v);
  const ascii = (i, s) => { for (let k = 0; k < s.length; k++) if (b[i + k] !== s.charCodeAt(k)) return false; return true; };
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (at(0, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (ascii(0, 'GIF87a') || ascii(0, 'GIF89a')) return 'image/gif';
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'image/webp';
  // ISO-BMFF: 4-byte box size, then 'ftyp', then the brand.
  if (ascii(4, 'ftyp')) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
  }
  return '';
}

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
  // redirect:'follow' would otherwise walk straight past the https check above.
  if (String(up.url || src).indexOf('https://') !== 0) return fail(415);

  // The claimed type has to be one we allow before we spend anything reading the body...
  const claimed = String(up.headers.get('content-type') || '').toLowerCase().split(';')[0].trim();
  if (!OK_TYPES[claimed]) return fail(415);
  const len = parseInt(up.headers.get('content-length') || '0', 10);
  if (len && len > MAX_BYTES) return fail(413);

  const buf = await up.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return fail(413);

  // ...and then the bytes have to back the claim up. This is what actually stops a document being
  // served from our origin, because the header above is the attacker's to write and this is not.
  const type = sniff(buf);
  if (!type) return fail(415);

  return new Response(buf, {
    status: 200,
    headers: {
      'content-type': type,
      'cache-control': 'public, max-age=' + TTL,
      'access-control-allow-origin': '*',
      // Nothing here is ever a document: don't let a browser sniff its way to deciding otherwise,
      // and give whatever it does decide no privileges at all.
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
    },
  });
}
