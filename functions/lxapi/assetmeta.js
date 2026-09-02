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
import { audit } from '../../_lib/audit.js';
import { verifyAsset } from '../../_lib/stellartoml.js';
import { GRANDFATHERED } from '../../_lib/verifiedseed.js';

const LIST = 'assets:list';
const MINTS = 'assets:mints';
const MINTMETA = 'mintmeta:approved';  // {id: {name, desc, image}} -- written by mintmeta.js, read by the toml
const META = 'asset:';
// Verification state for the whole list in one key. It is DERIVED data -- re-running the handshake
// rebuilds it -- so keeping it beside the list rather than inside each record costs one read to paint
// the table instead of one per asset.
const VMAP = 'assets:verified';
const ASSET_RE = /^[A-Za-z0-9]{1,12}-G[A-Z2-7]{55}$/;
const SPLIT_RE = /^([A-Za-z0-9]{1,12})-(G[A-Z2-7]{55})$/;

// The tick is stamped HERE, by the server, from the asset's own issuer and domain. A client can ask
// for an asset to be listed; it cannot tell us the asset is verified.
// Domains WE publish the toml for. A SEP-1 handshake that lands on one of these is not evidence: the
// launchpad sets a new issuer's home_domain to lumoscore.com and adds the asset to our own toml, so the
// handshake is us asking ourselves. It passes for every token anyone mints here, which made a green tick
// something a stranger could obtain by minting -- PEPE, GROK, HULK, NEIRO and FED all held one. What that
// handshake actually proves is "minted on LumosCore", which is not the same claim as "verified".
const OWN_DOMAINS = ['lumoscore.com', 'lu.meme'];
function isOwnDomain(d) {
  const h = String(d || '').trim().toLowerCase().replace(/^www\./, '');
  return OWN_DOMAINS.indexOf(h) >= 0;
}

async function stampVerified(kv, asset) {
  const m = SPLIT_RE.exec(asset);
  if (!m) return null;
  let res;
  try { res = await verifyAsset(m[1], m[2]); } catch (_) { res = null; }
  const gf = GRANDFATHERED[m[1] + '|' + m[2]];
  // Read rather than take on trust from the caller: stampVerified is reached from the add path AND from
  // the batch re-verify, and only one of those knows why it is asking. The list is the authority on
  // whether a human chose this asset.
  let curatedList = [];
  try { curatedList = (await kv.get(LIST, 'json')) || []; } catch (_) { curatedList = []; }
  const curated = Array.isArray(curatedList) && curatedList.indexOf(asset) >= 0;
  const selfSigned = !!(res && res.verified && isOwnDomain(res.domain));
  let rec;
  // CURATED MEANS TICKED. That is the rule this platform has chosen: an asset LumosCore puts on its
  // curated list carries the mark, whether or not its issuer can be made to vouch for it. BLND is why
  // -- the only BLND on Stellar, 134,092 holders, and an issuer that sets no home_domain at all, so
  // there is nothing to ask and never will be until they change it.
  //
  // The consequence, stated plainly because it is a real one: the tick now means "LumosCore lists
  // this", not "the issuer vouches for this". The weight has moved onto what gets curated. That is why
  // HOW each tick was obtained is still recorded and still shown -- handshake, grandfathered, or our
  // own word -- so the difference remains visible to whoever is deciding what to curate next.
  // A handshake counts only when it lands on a domain we do NOT control -- aqua.network, circle.com,
  // stronghold.co. Those are a third party staking their own domain on the claim, which is the entire
  // value of SEP-1. Ours proves nothing about the asset.
  if (res && res.verified && !selfSigned) rec = { v: 1, s: 'handshake', d: res.domain, t: Date.now(), why: res.reason };
  else if (gf) rec = { v: 1, s: 'grandfathered', d: (res && res.domain) || gf, t: Date.now(),
                       why: 'checked by hand when added; live handshake: ' + ((res && res.reason) || 'unavailable') };
  else if (curated) rec = { v: 1, s: 'curated', d: (res && res.domain) || '', t: Date.now(),
               why: selfSigned
                 ? 'Ticked because LumosCore curates it. The handshake lands on our own domain (' + res.domain + '), so it carries no weight on its own — a person chose this asset.'
                 : 'Ticked because LumosCore curates it — the handshake does not pass: ' + ((res && res.reason) || 'check unavailable') };
  // Nothing vouches for it and nobody chose it, so it wears no mark. Minting is not a credential: this
  // is the branch that stops anyone who can issue a token from also issuing themselves a green tick.
  else rec = { v: 0, s: selfSigned ? 'mint' : 'unverified', d: (res && res.domain) || '', t: Date.now(),
               why: selfSigned
                 ? 'Minted on the LumosCore launchpad. Its issuer names our own domain and our own toml lists it, so the handshake only proves it was minted here. Curate it to give it a tick.'
                 : 'No tick: ' + ((res && res.reason) || 'handshake unavailable') + ', and it is not on the curated list.' };

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
  // What each mint is CALLED, alongside the bare ids. `mints` is a list of "CODE-ISSUER" strings, which
  // is enough to know a token exists and nothing else -- so search could not render a row for one even
  // once it knew about it, and a freshly minted token was unfindable by the name its minter gave it.
  // Same key the SEP-1 document reads, so there is one source for a mint's name and logo, not two.
  let mintmeta = {};
  try {
    const live = (await kv.get(MINTMETA, 'json')) || {};
    if (live && typeof live === 'object' && !Array.isArray(live)) {
      for (const k of Object.keys(live)) {
        const v = live[k] || {};
        // Only what a search row needs. Descriptions can be long and there can be hundreds of these.
        mintmeta[k] = { name: v.name || '', image: v.image || '' };
      }
    }
  } catch (_) { mintmeta = {}; }
  // `list` stays an array of plain ids so existing callers keep working; the rest rides alongside.
  //
  // NEVER CACHED, and this is the bug that ate an asset. The admin panel reads this list and can then
  // write the whole thing back (reorder, remove). Cached for 60s, a reload straight after an addition
  // returned the list WITHOUT it -- and the next save wrote that stale copy back, deleting the asset
  // from KV for good. The verification record survived under its own key, which is how it was traced.
  // A read that can be written back must never be stale.
  return json({ list, mints, mintmeta, verified }, 200, 0);
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

    // The remove button in the panel comes through HERE, not through DELETE, so the tick map has to be
    // pruned on this path too -- otherwise removing an asset leaves its record behind and it stays
    // ticked everywhere while no longer being curated. Mints keep theirs: they are a separate list and
    // were never granted a tick by being curated.
    let vmap = {};
    try { vmap = (await kv.get(VMAP, 'json')) || {}; } catch (_) {}
    let mints = [];
    try { mints = (await kv.get(MINTS, 'json')) || []; } catch (_) {}
    const keep = new Set(list.concat(mints));
    let dropped = 0;
    for (const k of Object.keys(vmap)) if (!keep.has(k)) { delete vmap[k]; dropped++; }
    if (dropped) await kv.put(VMAP, JSON.stringify(vmap));

    await audit(env, request, 'asset.list.replace', '', { count: list.length, unticked: dropped });
    return json({ ok: true, list, unticked: dropped }, 200, 0);
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

  // A tick that CANNOT be earned may be GRANTED -- deliberately, and visibly.
  //
  // Some legitimate assets can never pass: BLND is the only BLND on Stellar with 134,092 holders, and
  // its issuer sets no home_domain at all, so there is nothing to ask. Refusing those forever makes the
  // rule useless; granting silently makes the tick meaningless. So a granted tick is stored as its own
  // kind and says so wherever it is shown.
  //
  // The KIND is decided here, never by the caller. A client can ask for an override; it cannot ask for
  // its asset to be recorded as having passed a handshake it did not pass.
  if (b && b.override !== undefined) {
    let map = {};
    try { map = (await kv.get(VMAP, 'json')) || {}; } catch (_) {}
    if (!b.override) {
      delete map[asset];
      await kv.put(VMAP, JSON.stringify(map));
      await audit(env, request, 'asset.untick', asset, null);
      return json({ ok: true, asset, verified: null }, 200, 0);
    }
    const sp = SPLIT_RE.exec(asset);
    let live = null;
    try { live = await verifyAsset(sp[1], sp[2]); } catch (_) {}
    // Re-checked first: an asset that passes on its own keeps an EARNED tick. Pressing the button
    // must never downgrade a real handshake to a vouched-for one.
    if (live && live.verified) {
      map[asset] = { v: 1, s: 'handshake', d: live.domain, t: Date.now(), why: live.reason };
    } else {
      map[asset] = { v: 1, s: 'manual', d: (live && live.domain) || '', t: Date.now(),
        why: 'Vouched for by an admin — the handshake does not pass: ' + ((live && live.reason) || 'check unavailable') };
    }
    await kv.put(VMAP, JSON.stringify(map));
    await audit(env, request, 'asset.tick.override', asset, { kind: map[asset] && map[asset].s });
    return json({ ok: true, asset, verified: map[asset] }, 200, 0);
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
    await audit(env, request, isNew ? 'asset.curate' : 'asset.edit', asset, { name: meta.name || undefined });
    return json({ ok: true, asset, meta, verified: stamp && stamp.rec, toml: stamp && stamp.toml }, 200, 0);
  }
  await kv.put(LIST, JSON.stringify(list));
  await audit(env, request, isNew ? 'asset.curate' : 'asset.edit', asset, null);
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
    // THE TICK GOES WITH THE LISTING. Curated means ticked, so de-listed has to mean un-ticked --
    // otherwise the record survives in the tick map and the asset keeps its mark everywhere while
    // being absent from the very list that granted it. WXT sat like that: removed from curated,
    // still verified on the asset page, because only the list was being edited.
    let vmap = {};
    try { vmap = (await kv.get(VMAP, 'json')) || {}; } catch (_) {}
    if (vmap[asset]) { delete vmap[asset]; await kv.put(VMAP, JSON.stringify(vmap)); }
  }
  await audit(env, request, metaOnly ? 'asset.meta.clear' : 'asset.uncurate', asset, null);
  return json({ ok: true }, 200, 0);
}
