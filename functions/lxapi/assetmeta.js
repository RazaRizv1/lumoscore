// The curated asset list, and per-asset overrides for what the Trade-Asset page shows.
//
// WHY OVERRIDES EXIST: everything on an asset page today comes from the issuer's own stellar.toml. When
// a project asks us to correct their description, swap a logo or add a social link, there is nothing to
// change on our side -- we can only wait for them to edit a file we do not control. This gives that a
// home, and it takes precedence over the toml precisely because it is the thing we were asked to fix.
//
// Reads are public and cached: /lxapi/assetlogo merges these in, and that is on the visitor path.
// Writes go through requireAdmin() -- see the note in blog.js about functions/ being shared with the
// PUBLIC projects, where there is no Access in front of anything.
import { requireAdmin } from '../../_lib/adminauth.js';
import { verifyAsset } from '../../_lib/stellartoml.js';
import { GRANDFATHERED } from '../../_lib/verifiedseed.js';

const LIST = 'assets:list';
const MINTS = 'assets:mints';
const META = 'asset:';
// Verification state for the whole list in one key. It is DERIVED data -- re-running the handshake
// rebuilds it -- so keeping it beside the list rather than inside each record costs one read to paint
// the table instead of one per asset.
const VMAP = 'assets:verified';
const ASSET_RE = /^[A-Za-z0-9]{1,12}-G[A-Z2-7]{55}$/;
const SPLIT_RE = /^([A-Za-z0-9]{1,12})-(G[A-Z2-7]{55})$/;

// The tick is stamped HERE, by the server, from the asset's own issuer and domain. A client can ask
// for an asset to be listed; it cannot tell us the asset is verified.
async function stampVerified(kv, asset) {
  const m = SPLIT_RE.exec(asset);
  if (!m) return null;
  let res;
  try { res = await verifyAsset(m[1], m[2]); } catch (_) { res = null; }
  const gf = GRANDFATHERED[m[1] + '|' + m[2]];
  let rec;
  if (res && res.verified) rec = { v: 1, s: 'handshake', d: res.domain, t: Date.now(), why: res.reason };
  else if (gf) rec = { v: 1, s: 'grandfathered', d: (res && res.domain) || gf, t: Date.now(),
                       why: 'checked by hand when added; live handshake: ' + ((res && res.reason) || 'unavailable') };
  else rec = { v: 0, s: 'none', d: (res && res.domain) || '', t: Date.now(), why: (res && res.reason) || 'check failed' };

  let map = {};
  try { map = (await kv.get(VMAP, 'json')) || {}; } catch (_) {}
  map[asset] = rec;
  try { await kv.put(VMAP, JSON.stringify(map)); } catch (_) {}
  return { rec, toml: (res && res.toml) || null };
}

function json(body, status, ttl) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'cache-control': ttl ? ('public, max-age=' + ttl) : 'no-store',
    },
  });
}

function clean(s, max) { return String(s == null ? '' : s).trim().slice(0, max); }

// Only http(s). A javascript: or data: URL stored here would end up in an href on the public asset page.
//
// Our own uploaded images are the one relative form allowed: an admin who uploads a logo gets back
// "/lxapi/media?id=<hash>.png", which is deliberately relative so the same record works on staging and
// production. Matched narrowly -- a fixed prefix and a hash-shaped id -- rather than by "starts with /",
// which would let any same-origin path through.
function safeUrl(s) {
  const v = clean(s, 400);
  if (!v) return '';
  const lc = v.toLowerCase();
  if (/^\/lxapi\/media\?id=[0-9a-f]{32}\.(png|jpg|jpeg|webp|gif|avif)$/.test(lc)) return v;
  return (lc.indexOf('https://') === 0 || lc.indexOf('http://') === 0) ? v : '';
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, PUT, DELETE, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
    },
  });
}

export async function onRequestGet({ request, env }) {
  const kv = env && env.CONTENT_KV;
  if (!kv) return json({ list: [], reason: 'no kv' }, 200, 30);
  const u = new URL(request.url);
  const asset = u.searchParams.get('asset') || '';

  if (asset) {
    if (!ASSET_RE.test(asset)) return json({ error: 'bad asset' }, 400, 0);
    let meta = null;
    try { meta = await kv.get(META + asset, 'json'); } catch (_) {}
    return json({ asset, meta: meta || null }, 200, 60);
  }
  let list = [];
  try { list = (await kv.get(LIST, 'json')) || []; } catch (_) {}
  let verified = {};
  try { verified = (await kv.get(VMAP, 'json')) || {}; } catch (_) {}
  // Two different things, kept apart. CURATED is what LumosCore chooses to list -- the same set Trade
  // main shows. MINTS are the tokens issued through our own launchpad: ours by definition, not a
  // curation decision, and folding them into the curated list made it look like we had picked 55.
  let mints = [];
  try { mints = (await kv.get(MINTS, 'json')) || []; } catch (_) {}
  // `list` stays an array of plain ids so existing callers keep working; the rest rides alongside.
  //
  // NEVER CACHED, and this is the bug that ate an asset. The admin panel reads this list and can then
  // write the whole thing back (reorder, remove). Cached for 60s, a reload straight after an addition
  // returned the list WITHOUT it -- and the next save wrote that stale copy back, deleting the asset
  // from KV for good. The verification record survived under its own key, which is how it was traced.
  // A read that can be written back must never be stale.
  return json({ list, mints, verified }, 200, 0);
}

export async function onRequestPut({ request, env }) {
  const bad = await requireAdmin(request);
  if (bad) return bad;
  const kv = env && env.CONTENT_KV;
  if (!kv) return json({ error: 'no kv binding' }, 500, 0);

  let b;
  try { b = await request.json(); } catch (_) { return json({ error: 'bad json' }, 400, 0); }

  // Whole-list replace. The admin table reorders and removes rows locally and then saves once; without
  // this it would have to diff its list against the store and issue a call per change, which is more
  // code on both sides and gets the ordering wrong the moment two edits race.
  if (Array.isArray(b && b.list)) {
    const list = b.list.map((x) => clean(x, 80)).filter((x) => ASSET_RE.test(x));
    await kv.put(LIST, JSON.stringify(list));
    return json({ ok: true, list }, 200, 0);
  }

  // Bulk re-verification, deliberately CHUNKED. Each handshake costs a Horizon call plus a toml fetch
  // plus a possible retry, against a 50-subrequest ceiling per request -- so 8 at a time, and the
  // caller loops. Doing all 55 in one call would blow the limit and fail the whole batch.
  if (Array.isArray(b && b.verify)) {
    const want = b.verify.map((x) => clean(x, 80)).filter((x) => ASSET_RE.test(x)).slice(0, 8);
    const out = {};
    for (const a of want) {
      const r = await stampVerified(kv, a);
      if (r) out[a] = r.rec;
    }
    return json({ ok: true, verified: out, done: want.length }, 200, 0);
  }

  const asset = clean(b && b.asset, 80);
  if (!ASSET_RE.test(asset)) {
    return json({ error: 'asset must be CODE-GISSUER, e.g. USDC-GA5ZSEJY…' }, 400, 0);
  }

  // Adding to the list and editing the copy are the same call, so listing an asset never needs a second
  // round trip and an edit can never land on an asset that is not listed.
  let list = [];
  try { list = (await kv.get(LIST, 'json')) || []; } catch (_) {}
  const isNew = list.indexOf(asset) < 0;
  if (isNew) list = [asset].concat(list);

  // Listing an asset verifies it in the same call, so the tick is never a separate step the admin has
  // to remember -- and never a claim the client got to make.
  let stamp = null;
  if (isNew || b.reverify) { stamp = await stampVerified(kv, asset); }

  const hasMeta = b.description != null || b.image != null || b.website != null
    || b.twitter != null || b.telegram != null || b.discord != null || b.name != null;
  if (hasMeta) {
    let prev = null;
    try { prev = await kv.get(META + asset, 'json'); } catch (_) {}
    const meta = {
      asset,
      name: clean(b.name != null ? b.name : (prev && prev.name), 60),
      description: clean(b.description != null ? b.description : (prev && prev.description), 1200),
      image: safeUrl(b.image != null ? b.image : (prev && prev.image)),
      website: safeUrl(b.website != null ? b.website : (prev && prev.website)),
      // Handles are kept as typed. The asset page already turns a bare handle, an @handle or a full
      // URL into the right link, so normalising here would only be a second, disagreeing implementation.
      twitter: clean(b.twitter != null ? b.twitter : (prev && prev.twitter), 80),
      telegram: clean(b.telegram != null ? b.telegram : (prev && prev.telegram), 80),
      discord: safeUrl(b.discord != null ? b.discord : (prev && prev.discord)),
      updatedAt: Date.now(),
    };
    await kv.put(META + asset, JSON.stringify(meta));
    await kv.put(LIST, JSON.stringify(list));
    return json({ ok: true, asset, meta, verified: stamp && stamp.rec, toml: stamp && stamp.toml }, 200, 0);
  }
  await kv.put(LIST, JSON.stringify(list));
  return json({ ok: true, asset, meta: null, verified: stamp && stamp.rec, toml: stamp && stamp.toml }, 200, 0);
}

export async function onRequestDelete({ request, env }) {
  const bad = await requireAdmin(request);
  if (bad) return bad;
  const kv = env && env.CONTENT_KV;
  if (!kv) return json({ error: 'no kv binding' }, 500, 0);

  const u = new URL(request.url);
  const asset = u.searchParams.get('asset') || '';
  if (!ASSET_RE.test(asset)) return json({ error: 'bad asset' }, 400, 0);
  // ?meta=1 clears the overrides but keeps the asset listed -- reverting to whatever the issuer's own
  // toml says, which is a different intention from de-listing it.
  const metaOnly = u.searchParams.get('meta') === '1';

  await kv.delete(META + asset);
  if (!metaOnly) {
    let list = [];
    try { list = (await kv.get(LIST, 'json')) || []; } catch (_) {}
    await kv.put(LIST, JSON.stringify(list.filter((a) => a !== asset)));
  }
  return json({ ok: true }, 200, 0);
}
