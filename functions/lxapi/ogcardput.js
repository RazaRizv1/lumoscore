// Stores a share card that a browser drew, so an asset curated or minted between builds has a real
// card of its own straight away instead of waiting for the next build.
//
// WHY A BROWSER DREW IT. Nothing can rasterise a card at the edge: satori plus a wasm rasteriser is
// about 8.5MB against a 1MB Worker bundle cap, and 50-200ms of CPU against 10ms. There is no CI, no
// cron and no deploy hook in this project either. The one thing that can rasterise on demand is the
// browser already performing the action, which draws through the SAME renderer the build uses
// (dist/assets/js/lx-ogkit.js is _tools/_ogkit.js verbatim) and posts the PNG here.
//
// THE BYTES ARRIVE FROM A CLIENT, so nothing about them is taken on trust:
//   - the asset id must be a well-formed Stellar asset;
//   - the body must be a real PNG, and its IHDR must say exactly 1200x630 -- read from the header,
//     which needs no decoder -- so a card cannot be the wrong shape or something that is not an
//     image at all;
//   - a size ceiling well under the KV value limit.
// A picture that passes all of that is still a picture someone chose. That is acceptable for an
// admin, who is trusted, and for a minter, whose own token's page is the only place it can appear.
//
// WHO MAY WRITE. An admin, always, including over an existing card. Otherwise only the issuer of an
// asset minted through our launchpad -- proven by a mintmeta record, which mintmeta.js only creates
// against a real on-chain mint transaction -- and then only when no card exists yet, so a mint
// cannot be used to overwrite a card repeatedly.
//
// functions/ is shared with the PUBLIC projects, where nothing sits in front of it; see the note in
// blog.js. That is why the admin path goes through requireAdmin() rather than assuming the caller.
import { requireAdmin } from '../../_lib/adminauth.js';
import { CARD_V } from '../../_lib/ogcardver.js';

const ASSET_RE = /^[A-Za-z0-9]{1,12}-G[A-Z2-7]{55}$/;
const MINT = 'mintmeta:';
const CARD = 'ogcard:';
const MAX = 2 * 1024 * 1024;       // a card is ~200KB; this is a ceiling, not a target
const W = 1200, H = 630;

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
    },
  });
}

// PNG header only: the 8-byte signature, then IHDR, whose width and height are the two big-endian
// 32-bit words at offsets 16 and 20. No decoding, no allocation beyond the slice already in hand.
function pngSize(b) {
  if (!b || b.length < 24) return null;
  if (b[0] !== 0x89 || b[1] !== 0x50 || b[2] !== 0x4e || b[3] !== 0x47
    || b[4] !== 0x0d || b[5] !== 0x0a || b[6] !== 0x1a || b[7] !== 0x0a) return null;
  if (String.fromCharCode(b[12], b[13], b[14], b[15]) !== 'IHDR') return null;
  const be = (o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  return { w: be(16), h: be(20) };
}

export async function onRequestPost({ request, env }) {
  const kv = env && env.CONTENT_KV;
  if (!kv) return json({ ok: false, error: 'storage unavailable' }, 503);

  let form;
  try { form = await request.formData(); } catch (e) { return json({ ok: false, error: 'bad request' }, 400); }

  const asset = String(form.get('asset') || '').trim();
  if (!ASSET_RE.test(asset)) return json({ ok: false, error: 'bad asset' }, 400);

  const file = form.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') return json({ ok: false, error: 'no file' }, 400);

  const buf = new Uint8Array(await file.arrayBuffer());
  if (!buf.length) return json({ ok: false, error: 'empty file' }, 400);
  if (buf.length > MAX) return json({ ok: false, error: 'file too large' }, 413);

  const dim = pngSize(buf);
  if (!dim) return json({ ok: false, error: 'not a png' }, 415);
  if (dim.w !== W || dim.h !== H) {
    return json({ ok: false, error: 'card must be ' + W + 'x' + H + ', got ' + dim.w + 'x' + dim.h }, 422);
  }

  const isAdmin = !(await requireAdmin(request));
  let by = 'admin';
  if (!isAdmin) {
    // Only an asset actually minted through the launchpad, and only once.
    let mint = null;
    try { mint = await kv.get(MINT + asset, 'json'); } catch (e) { /* treated as absent */ }
    if (!mint) return json({ ok: false, error: 'not authorised for this asset' }, 403);
    let existing = null;
    try { existing = await kv.getWithMetadata(CARD + asset, 'arrayBuffer'); } catch (e) { /* treated as absent */ }
    if (existing && existing.value) return json({ ok: false, error: 'a card already exists' }, 409);
    by = 'mint';
  }

  await kv.put(CARD + asset, buf, {
    metadata: { v: CARD_V, at: Date.now(), by, size: buf.length },
  });

  return json({ ok: true, asset, bytes: buf.length, v: CARD_V, by });
}
