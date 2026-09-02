// The metadata a launchpad minter types, kept.
//
// WHAT WAS WRONG. lxLpCaptureDraft() collects name, description, socials and a logo into localStorage
// and window.__lxLpIcon, and the launchpad POSTs none of it anywhere. Reported 2026-09-02: FRANK was
// minted, the fee arrived, and the asset page showed nothing -- because nothing the minter entered had
// ever left his browser. Every mainnet mint since the migration is the same.
//
// assetmeta.js already reads a per-asset record at "asset:<CODE-ISSUER>" and a registry of launchpad
// mints at "assets:mints". Both were being READ and neither was being written by the launchpad. This
// endpoint is the missing writer; it invents no new store.
//
// WHAT MAKES A PUBLIC WRITER SAFE HERE. listing.js states the principle for its own paid form: "a
// public upload route would be a free way to fill KV with images. Here the $250 payment is the
// anti-abuse token: no verified payment, no stored bytes." A mint has its own token, already on chain
// and already paid -- the mint transaction. A submission is accepted only if Horizon confirms a
// transaction that CREATED this issuer, PAID our fee collector in XLM, and LOCKED that same issuer by
// zeroing its master weight. Reproducing that means actually minting through LumosCore, which is the
// thing being claimed. No verified mint, no stored bytes.
//
// PUBLISHED ON MINT, NOT ON APPROVAL, and this was reconsidered rather than assumed. The first version
// held every submission in a queue for an admin to approve. That is the wrong trade: a minter pays the
// fee, types their project's name and description as part of the flow, and would then watch their token
// sit nameless until a human happened to click something. It also makes the admin a bottleneck on every
// mint, forever.
//
// The argument for a queue was that this is stranger-supplied content appearing on our domain. It does
// not hold up. The asset CODE is already published unmoderated the moment the mint lands -- the toml
// lists it without anyone looking -- so a description is not a different kind of claim. And every way
// this content could do actual harm is already closed elsewhere:
//   * the asset page writes descriptions with textContent, not innerHTML, so the text is inert;
//   * storeLogo takes raster formats only and caps the size, and /lxapi/media serves with nosniff --
//     the SVG behind a past incident cannot get in;
//   * safeSite refuses any scheme we did not name, so javascript: and data: never reach an href.
// What is left is taste, and taste is better handled by removing something afterwards than by making
// every honest minter wait. assetmeta.js already has the admin DELETE that does it; the PUT below
// clears the toml's copy at the same time, which DELETE alone would leave behind.
import { requireAdmin } from '../../_lib/adminauth.js';
import { audit } from '../../_lib/audit.js';
import { storeLogo } from './listing.js';

const H = 'https://horizon.stellar.org';
const FEE_ACCT = 'GAMZFXIJD5E3PNRFCG6VPXCJNUOZAP5BY2P3MU3ZXXUSVM2UY5P6LJKD';

const HASH_RE = /^[0-9a-f]{64}$/i;
const CODE_RE = /^[A-Za-z0-9]{1,12}$/;
const ADDR_RE = /^G[A-Z2-7]{55}$/;

const SUB = 'mintmeta:';           // mintmeta:<CODE-ISSUER> -> one submission, kept for restore
const LIVE = 'mintmeta:approved';  // {id: {name, desc, image}} -- one read for the toml.
// The key keeps its old name so an entry written before the queue was dropped is still found; the
// constant says what it now means.
const MINTS = 'assets:mints';      // read by assetmeta.js; the launchpad never wrote it
const META = 'asset:';             // assetmeta.js's per-asset record

// Matching assetmeta.js's own field caps, so an approved record cannot carry more than the admin
// panel would have allowed someone to type by hand.
const LIMITS = { name: 60, description: 1200, handle: 80, website: 200 };
const MINT_OPS = 20;

function json(body, status, ttl) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': ttl ? 'public, max-age=' + ttl : 'no-store',
    },
  });
}

function clip(s, max) {
  return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

// Same rule as listing.js's safeSite: a scheme we did not name is refused rather than guessed at,
// because these strings end up in an href on a public page. javascript: and data: are the reason this
// is not a length check.
function safeSite(s, max) {
  const v = clip(s, max);
  if (!v) return '';
  const lc = v.toLowerCase();
  if (lc.indexOf('http://') === 0 || lc.indexOf('https://') === 0) return v;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/[^\s]*)?$/i.test(v)) return v;
  return '';
}

// The anti-abuse token. Identical in substance to the check the SEP-1 document makes before vouching
// for an asset (see functions/.well-known/stellar.toml.js, mintedByUs) -- deliberately, because both
// answer the same question: was this minted here?
async function verifyMint(txHash, issuer) {
  let r;
  try {
    r = await fetch(H + '/transactions/' + encodeURIComponent(txHash) + '/operations?limit=' + MINT_OPS,
      { cf: { cacheTtl: 60 } });
  } catch (e) { return 'could not reach Stellar to check the mint; try again shortly'; }
  if (!r.ok) return 'that transaction could not be found on Stellar mainnet';

  let recs;
  try { recs = (((await r.json())._embedded) || {}).records || []; } catch (e) { return 'that transaction could not be read'; }

  let created = false, paidUs = false, locked = false;
  for (const op of recs) {
    if (op.type === 'create_account' && op.account === issuer) created = true;
    if (op.type === 'payment' && op.to === FEE_ACCT && op.asset_type === 'native'
        && parseFloat(op.amount) > 0) paidUs = true;
    if (op.type === 'set_options' && op.source_account === issuer
        && String(op.master_key_weight) === '0') locked = true;
  }
  if (!created) return 'that transaction did not create this issuer';
  if (!paidUs) return 'that transaction did not pay the LumosCore mint fee';
  if (!locked) return 'that transaction did not lock the issuer';
  return null;
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
      'access-control-allow-headers': 'content-type',
    },
  });
}

// ---- public: a minter submitting what they typed --------------------------------------------------
export async function onRequestPost({ request, env }) {
  const kv = env && env.CONTENT_KV;
  if (!kv) return json({ ok: false, error: 'submissions are unavailable right now' }, 503);

  let b;
  try { b = await request.json(); } catch (e) { return json({ ok: false, error: 'bad request' }, 400); }
  if (!b || typeof b !== 'object') return json({ ok: false, error: 'bad request' }, 400);

  const code = String(b.code || '').trim();
  const issuer = String(b.issuer || '').trim().toUpperCase();
  const txHash = String(b.txHash || '').trim().toLowerCase();
  if (!CODE_RE.test(code)) return json({ ok: false, error: 'bad asset code' }, 400);
  if (!ADDR_RE.test(issuer)) return json({ ok: false, error: 'bad issuer' }, 400);
  if (!HASH_RE.test(txHash)) return json({ ok: false, error: 'missing mint transaction' }, 400);

  const id = code + '-' + issuer;

  // Idempotent by asset. A retry, a double click, or the page being reopened must not create a second
  // submission or overwrite something an admin has already ruled on.
  let prev = null;
  try { prev = await kv.get(SUB + id, 'json'); } catch (e) { /* treat as absent */ }
  // A taken-down entry stays down: a resubmit must not be a way to undo a removal.
  if (prev && prev.status === 'removed') {
    return json({ ok: true, status: 'removed', already: true }, 200);
  }

  // Checked BEFORE any bytes are stored, so an unverified submission costs us nothing.
  const bad = await verifyMint(txHash, issuer);
  if (bad) return json({ ok: false, error: bad }, 400);

  let logoId = prev ? prev.logoId || null : null;
  if (b.logo) {
    const st = await storeLogo(env, b.logo);
    if (st.err) return json({ ok: false, error: st.err }, 400);
    logoId = st.id;
  }

  const rec = {
    asset: id, code, issuer, txHash, status: 'live',
    name: clip(b.name, LIMITS.name),
    description: clip(b.description != null ? b.description : b.desc, LIMITS.description),
    website: safeSite(b.website, LIMITS.website),
    twitter: clip(b.twitter, LIMITS.handle),
    telegram: clip(b.telegram, LIMITS.handle),
    logoId: logoId || null,
    at: (prev && prev.at) || Date.now(),
    updated: Date.now(),
  };
  await kv.put(SUB + id, JSON.stringify(rec));

  // Straight to the record assetmeta.js serves, in the shape its own admin PUT writes, so a minted
  // asset is indistinguishable downstream from one curated by hand -- one reader, one shape.
  const image = rec.logoId ? '/lxapi/media?id=' + encodeURIComponent(rec.logoId) : '';
  let meta = null;
  try { meta = await kv.get(META + id, 'json'); } catch (e) { /* new record */ }
  // An admin edit is not undone by a resubmit: a field already set by hand stays unless the minter
  // actually supplies something for it.
  // PRESENT beats non-empty. A field the request carries wins even when it is empty, so a minter can
  // clear something they mistyped; a field the request omits keeps whatever is stored, so a partial
  // resubmit does not wipe an admin's edit. Falling back on emptiness instead -- which this did at
  // first -- makes a value unclearable, and the author of a description is then stuck with it.
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
  const keep = (k, v) => (has(k) ? v : ((meta && meta[k]) || ''));
  meta = {
    ...(meta || {}),
    asset: id,
    name: keep('name', rec.name),
    description: (has('description') || has('desc')) ? rec.description : ((meta && meta.description) || ''),
    image: has('logo') ? image : ((meta && meta.image) || ''),
    website: keep('website', rec.website),
    twitter: keep('twitter', rec.twitter),
    telegram: keep('telegram', rec.telegram),
  };
  await kv.put(META + id, JSON.stringify(meta));

  // One key the SEP-1 document reads, so building the toml costs a single read rather than a scan.
  try {
    const map = (await kv.get(LIVE, 'json')) || {};
    map[id] = { name: meta.name, desc: meta.description, image: meta.image };
    await kv.put(LIVE, JSON.stringify(map));
  } catch (e) { /* the asset record is written either way; the map can be rebuilt from it */ }

  // The registry is a statement of fact the chain just proved, so it does not wait for review. This is
  // what assetmeta.js has been reading all along with nothing writing it.
  try {
    const mints = (await kv.get(MINTS, 'json')) || [];
    if (mints.indexOf(id) < 0) { mints.push(id); await kv.put(MINTS, JSON.stringify(mints)); }
  } catch (e) { /* the submission is stored either way; the registry can be rebuilt */ }

  return json({ ok: true, status: 'live' }, 200);
}

// ---- admin: the review queue ----------------------------------------------------------------------
// Behind requireAdmin because functions/ is shared with the PUBLIC projects, where nothing sits in
// front of it, and because a pending queue is unreviewed stranger content.
export async function onRequestGet({ request, env }) {
  const bad = await requireAdmin(request);
  if (bad) return bad;
  const kv = env && env.CONTENT_KV;
  if (!kv) return json({ error: 'unavailable' }, 503);

  const out = [];
  let cursor;
  do {
    const page = await kv.list({ prefix: SUB, cursor, limit: 100 });
    for (const k of page.keys) {
      if (k.name === LIVE) continue;               // the derived map, not a submission
      let rec = null;
      try { rec = await kv.get(k.name, 'json'); } catch (e) { continue; }
      if (rec) out.push({ ...rec, logo: rec.logoId ? '/lxapi/media?id=' + encodeURIComponent(rec.logoId) : '' });
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);

  out.sort((x, y) => (y.at || 0) - (x.at || 0));
  return json({ items: out }, 200);
}

// ---- admin: approve or reject ---------------------------------------------------------------------
// ---- admin: take an entry down --------------------------------------------------------------------
// There is no "approve": metadata publishes when the mint is proven. This is the other direction, for
// the case the queue was originally meant to cover -- something is up that should not be.
//
// It clears BOTH copies. assetmeta.js's own DELETE removes "asset:<id>", but the SEP-1 document reads
// its own map, so a delete on that side alone would leave the name and logo in the toml for every
// wallet to keep showing. Removing here does both and marks the submission so a resubmit cannot
// quietly put it back.
export async function onRequestPut({ request, env }) {
  const bad = await requireAdmin(request);
  if (bad) return bad;
  const kv = env && env.CONTENT_KV;
  if (!kv) return json({ error: 'unavailable' }, 503);

  let b;
  try { b = await request.json(); } catch (e) { return json({ error: 'bad request' }, 400); }
  const id = String((b && b.asset) || '').trim();
  const action = String((b && b.action) || '').toLowerCase();
  if (!/^[A-Za-z0-9]{1,12}-G[A-Z2-7]{55}$/.test(id)) return json({ error: 'bad asset' }, 400);
  if (action !== 'remove' && action !== 'restore') return json({ error: 'bad action' }, 400);

  let rec = null;
  try { rec = await kv.get(SUB + id, 'json'); } catch (e) { /* below */ }
  if (!rec) return json({ error: 'no such submission' }, 404);

  let map = {};
  try { map = (await kv.get(LIVE, 'json')) || {}; } catch (e) { /* rebuilt below either way */ }

  if (action === 'remove') {
    // The asset itself stays registered in assets:mints -- it WAS minted here, and hiding that would
    // be untrue. Only the words and the picture come down.
    try { await kv.delete(META + id); } catch (e) { /* the map clear below is what the toml reads */ }
    delete map[id];
    await kv.put(LIVE, JSON.stringify(map));
    rec.status = 'removed';
    rec.decidedAt = Date.now();
    await kv.put(SUB + id, JSON.stringify(rec));
    await audit(env, request, 'mintmeta.remove', id, { name: rec.name || undefined });
    return json({ ok: true, status: 'removed' }, 200);
  }

  // Restore puts back exactly what the minter sent, from the submission we kept.
  const image = rec.logoId ? '/lxapi/media?id=' + encodeURIComponent(rec.logoId) : '';
  const meta = {
    asset: id,
    name: rec.name || '', description: rec.description || '', image,
    website: rec.website || '', twitter: rec.twitter || '', telegram: rec.telegram || '',
  };
  await kv.put(META + id, JSON.stringify(meta));
  map[id] = { name: meta.name, desc: meta.description, image: meta.image };
  await kv.put(LIVE, JSON.stringify(map));
  rec.status = 'live';
  rec.decidedAt = Date.now();
  await kv.put(SUB + id, JSON.stringify(rec));
  await audit(env, request, 'mintmeta.restore', id, {});
  return json({ ok: true, status: 'live' }, 200);
}
