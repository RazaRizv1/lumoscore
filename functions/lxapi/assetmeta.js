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

const LIST = 'assets:list';
const META = 'asset:';
const ASSET_RE = /^[A-Za-z0-9]{1,12}-G[A-Z2-7]{55}$/;

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
function safeUrl(s) {
  const v = clean(s, 400);
  if (!v) return '';
  const lc = v.toLowerCase();
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
  return json({ list }, 200, 60);
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

  const asset = clean(b && b.asset, 80);
  if (!ASSET_RE.test(asset)) {
    return json({ error: 'asset must be CODE-GISSUER, e.g. USDC-GA5ZSEJY…' }, 400, 0);
  }

  // Adding to the list and editing the copy are the same call, so listing an asset never needs a second
  // round trip and an edit can never land on an asset that is not listed.
  let list = [];
  try { list = (await kv.get(LIST, 'json')) || []; } catch (_) {}
  if (list.indexOf(asset) < 0) list = [asset].concat(list);

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
    return json({ ok: true, asset, meta }, 200, 0);
  }
  await kv.put(LIST, JSON.stringify(list));
  return json({ ok: true, asset, meta: null }, 200, 0);
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
