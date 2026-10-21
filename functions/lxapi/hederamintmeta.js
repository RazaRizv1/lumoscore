// The metadata a HEDERA launchpad creator types -- logo, description, socials -- kept server-side.
//
// mintmeta.js's twin, for the token the Hedera launch creates (RAZA 2026-10-21: "like Stellar's mintmeta").
// Same reason it exists: what a creator types otherwise lives only in their browser, and a launched token
// whose page shows initials and no description is the FRANK report again (2026-09-02).
//
// WHAT MAKES A PUBLIC WRITER SAFE HERE, and safer than mintmeta.js. A submission must point at the
// launch's FEE PAYMENT, and that payment's memo -- signed by the creator's wallet, so nobody else can
// write it -- carries a fingerprint of the metadata: "LumosCore launch m:" + the first 32 hex of
//     sha256( JSON.stringify([name, description, website, twitter, telegram, sha256(logo data URL) or ""]) )
// with the fields exactly as the launch page held them. So:
//   * the fee transaction must have succeeded, be a CRYPTOTRANSFER crediting our collector with at least
//     MIN_FEE_USD of HBAR, and carry that memo;
//   * the token must exist, its treasury must be the fee's payer, it must have been created within an
//     hour AFTER the fee (the launch pays first), it must carry no keys, and LumosPools must hold a pool
//     for it -- i.e. it was launched here;
//   * the submitted fields must hash to the memo's fingerprint.
// mintmeta.js verifies the mint but not WHAT is submitted, so anyone holding a public mint hash can post
// different metadata for someone else's token. Here the content is bound to the creator's own signature.
//
// Storage is CONTENT_KV, as mintmeta.js and listing.js use:
//   hmintmeta:<token>   the record (fingerprint, fields, logo id, fee tx, times)
//   hmintmeta:all       { <token>: { name, desc, image, website, twitter, telegram } } -- one read for the
//                       pages and for /lxapi/hederalumos
// First write wins: the fingerprint makes a second, different submission impossible anyway, and an identical
// one (a retry) is answered as already stored, with its logo filled in if the first lacked it.
// GET /lxapi/hederamintmeta returns the map.
import { storeLogo } from './listing.js';

const MIRROR = 'https://mainnet-public.mirrornode.hedera.com/api/v1';
const COLLECTOR = '0.0.10229748';
const LUMOS = '0.0.10928753';                  // LumosPools mainnet; kept equal to the Hedera fork's deployments.json
const MEMO_RE = /^LumosCore launch m:([0-9a-f]{32})$/;
const TOKEN_RE = /^0\.0\.\d{1,12}$/;
const TXID_RE = /^(0\.0\.\d{1,12})[@-](\d{1,12})[.-](\d{1,9})$/;
const MIN_FEE_USD = 5;                         // the fee is ~$13.87; this only refuses a token-sized memo payment
const LIMITS = { name: 60, description: 1200, handle: 80, website: 200 };
const SUB = 'hmintmeta:', ALL = 'hmintmeta:all';
const KEYS = ['admin_key', 'supply_key', 'wipe_key', 'freeze_key', 'kyc_key', 'pause_key', 'fee_schedule_key'];

function json(body, status, ttl) {
  return new Response(JSON.stringify(body), { status, headers: {
    'content-type': 'application/json', 'access-control-allow-origin': '*',
    'cache-control': ttl ? 'public, max-age=' + ttl : 'no-store' } });
}
const clip = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
function safeSite(s, max) {
  const v = clip(s, max);
  if (!v) return '';
  const lc = v.toLowerCase();
  if (lc.indexOf('http://') === 0 || lc.indexOf('https://') === 0) return v;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/[^\s]*)?$/i.test(v)) return v;
  return '';
}
async function sha256hex(str) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(str)));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}
// THE fingerprint, shared with the launch page (browser/hederamint.js computes the same thing).
export async function fingerprint(f) {
  const logoHash = f.logo ? await sha256hex(f.logo) : '';
  return (await sha256hex(JSON.stringify([String(f.name || ''), String(f.description || ''), String(f.website || ''),
    String(f.twitter || ''), String(f.telegram || ''), logoHash]))).slice(0, 32);
}
const mirrorTxId = (id) => { const m = TXID_RE.exec(String(id || '').trim()); return m ? m[1] + '-' + m[2] + '-' + m[3].padStart(9, '0') : ''; };
async function get(p) { const r = await fetch(MIRROR + p, { cf: { cacheTtl: 30 } }); if (!r.ok) { const e = new Error('mirror ' + r.status); e.status = r.status; throw e; } return r.json(); }

// Pure over Mirror records, so it can be checked against real ones without a network.
export function checkLaunch(fee, token, pool, fp, hbarUsd) {
  if (!fee || fee.result !== 'SUCCESS' || fee.name !== 'CRYPTOTRANSFER') return 'that is not a successful launch fee payment';
  let memo = '';
  try { memo = new TextDecoder().decode(Uint8Array.from(atob(fee.memo_base64 || ''), (c) => c.charCodeAt(0))); } catch (e) { memo = ''; }
  const m = MEMO_RE.exec(memo.trim());
  if (!m) return 'that payment does not carry a LumosCore launch fingerprint';
  if (m[1] !== fp) return 'these details do not match the ones signed at launch';
  const payer = String(fee.transaction_id || '').split('-')[0];
  let tiny = 0;
  for (const x of fee.transfers || []) if (x.account === COLLECTOR && +x.amount > 0) tiny += +x.amount;
  if (!(hbarUsd > 0) || tiny / 1e8 * hbarUsd < MIN_FEE_USD) return 'that payment is not a LumosCore launch fee';
  if (!token || token.type !== 'FUNGIBLE_COMMON' || token.deleted) return 'that is not a live fungible token';
  if (token.treasury_account_id !== payer) return 'that token was not created by the account that paid the launch fee';
  const feeAt = parseFloat(fee.consensus_timestamp), madeAt = parseFloat(token.created_timestamp);
  if (!(madeAt >= feeAt && madeAt - feeAt <= 3600)) return 'that token was not created as part of this launch';
  if (KEYS.some((k) => token[k])) return 'that token carries keys, so it was not launched here';
  if (!pool) return 'that token has no LumosCore pool';
  return null;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' } });
}

export async function onRequestGet({ env }) {
  const kv = env && env.CONTENT_KV;
  if (!kv) return json({ ok: false, error: 'unavailable', map: {} }, 200);
  let map = {};
  try { map = (await kv.get(ALL, 'json')) || {}; } catch (e) { map = {}; }
  return json({ ok: true, map }, 200, 60);
}

export async function onRequestPost({ request, env }) {
  const kv = env && env.CONTENT_KV;
  if (!kv) return json({ ok: false, error: 'submissions are unavailable right now' }, 503);
  let b;
  try { b = await request.json(); } catch (e) { return json({ ok: false, error: 'bad request' }, 400); }
  if (!b || typeof b !== 'object') return json({ ok: false, error: 'bad request' }, 400);
  const tokenId = String(b.token || '').trim();
  const feeTx = mirrorTxId(b.feeTx);
  if (!TOKEN_RE.test(tokenId)) return json({ ok: false, error: 'bad token id' }, 400);
  if (!feeTx) return json({ ok: false, error: 'missing launch fee transaction' }, 400);
  const fields = { name: String(b.name || ''), description: String(b.description || ''), website: String(b.website || ''),
    twitter: String(b.twitter || ''), telegram: String(b.telegram || ''), logo: String(b.logo || '') };
  const fp = await fingerprint(fields);

  let prev = null;
  try { prev = await kv.get(SUB + tokenId, 'json'); } catch (e) { prev = null; }
  if (prev && prev.status === 'removed') return json({ ok: true, status: 'removed', already: true }, 200);
  if (prev && prev.fp !== fp) return json({ ok: false, error: 'details for this token are already stored' }, 409);

  // Checked BEFORE any bytes are stored, so an unverified submission costs nothing.
  let fee, token, poolHex, hbarUsd = 0;
  try {
    const origin = new URL(request.url).origin;
    const [t, k, p, mk] = await Promise.all([
      get('/transactions/' + feeTx),
      get('/tokens/' + tokenId),
      fetch(MIRROR + '/contracts/call', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ block: 'latest',
        to: '0x' + BigInt(LUMOS.split('.')[2]).toString(16).padStart(40, '0'),
        data: '0xbbe4f6db' + BigInt(tokenId.split('.')[2]).toString(16).padStart(64, '0') }) }).then((r) => r.json()),
      fetch(origin + '/lxapi/hederamarket').then((r) => r.json()).catch(() => null),
    ]);
    fee = ((t && t.transactions) || []).filter((x) => !x.nonce && !x.scheduled)[0];
    token = k; poolHex = p && p.result; hbarUsd = mk && mk.ok ? +mk.usd : 0;
  } catch (e) {
    return json({ ok: false, error: e.status === 404 ? 'that transaction or token is not on Hedera (yet — try again in a few seconds)' : 'could not reach Hedera to check the launch; try again shortly' }, e.status === 404 ? 400 : 503);
  }
  const pool = poolHex && /^0x[0-9a-f]{256}$/i.test(poolHex) && BigInt('0x' + poolHex.slice(2, 66)) > 0n;
  const bad = checkLaunch(fee, token, pool, fp, hbarUsd);
  if (bad) return json({ ok: false, error: bad }, 400);

  let logoId = prev ? prev.logoId || null : null;
  if (fields.logo && !logoId) {
    const st = await storeLogo(env, fields.logo);
    if (st.err) return json({ ok: false, error: st.err }, 400);
    logoId = st.id;
  }
  const rec = {
    token: tokenId, fp, feeTx, status: 'live', symbol: token.symbol || '',
    name: clip(fields.name, LIMITS.name), description: clip(fields.description, LIMITS.description),
    website: safeSite(fields.website, LIMITS.website), twitter: clip(fields.twitter, LIMITS.handle), telegram: clip(fields.telegram, LIMITS.handle),
    logoId, at: (prev && prev.at) || Date.now(), updated: Date.now(),
  };
  await kv.put(SUB + tokenId, JSON.stringify(rec));
  try {
    const map = (await kv.get(ALL, 'json')) || {};
    map[tokenId] = { name: rec.name, desc: rec.description, image: logoId ? '/lxapi/media?id=' + encodeURIComponent(logoId) : '',
      website: rec.website, twitter: rec.twitter, telegram: rec.telegram };
    await kv.put(ALL, JSON.stringify(map));
  } catch (e) { /* the record is stored either way; the map can be rebuilt from the records */ }
  return json({ ok: true, status: 'live', already: !!prev }, 200);
}
