// Cloudflare Pages Function — the record that says "this payment was a bridge fee".
//
// WHY THIS EXISTS. The CCTP fee is deliberately deferred: `_cctp.js` burns first and collects the fee
// only afterwards, so a failed burn can never charge for nothing. The side effect is that the fee lands
// as its OWN single-operation payment with no memo, seconds after an unrelated-looking Soroban call. On
// chain it is indistinguishable from a stranger sending USDC to the fee collector.
//
// Everything downstream classifies by transaction SHAPE -- `grossOf` in _admin.js reads the envelope and
// asks "is there a swap? is there a createAccount/setOptions?" -- so a bridge fee has no shape to match
// and falls through to "Other on-chain". Measured 2026-09-03: $10.40 of real bridge revenue on $5,198.95
// of volume sat in "Other", the dashboard feed rendered it as a bare "Platform activity" row with no
// amount and no network, and the Cross-Chain page showed nothing at all because its history lives in
// localStorage and therefore only exists in the browser that made the transfer.
//
// One record fixes all four, because all four are the same missing fact.
//
// WHAT IS TRUSTED. Nothing the caller says. A record is stored only when the ledger agrees:
//   1. feeHash is a real transaction whose ONLY operation is a payment to the fee collector, from `from`
//   2. burnHash is a real transaction from that SAME account containing an invoke_host_function
//   3. the two are within BRIDGE_WINDOW_MS of each other
// That is the same standard mintmeta.js applies to a launchpad mint: the chain is the authority, the
// client merely points at it. A stranger cannot register someone else's payment as their bridge, and a
// plain USDC transfer cannot be dressed up as revenue.
//
// The destination domain and amount are NOT taken from the caller either -- they are read from Circle's
// attestation service, keyed by the burn hash.
const H = 'https://horizon.stellar.org';
const IRIS = 'https://iris-api.circle.com/v2/messages/27?transactionHash=';
const FEE_ACCT = 'GAMZFXIJD5E3PNRFCG6VPXCJNUOZAP5BY2P3MU3ZXXUSVM2UY5P6LJKD';

const KEY = 'bridge:txs';          // {feeHash: record} -- one read for every consumer
const MAX_KEEP = 500;
const BRIDGE_WINDOW_MS = 30 * 60 * 1000;
const TIMEOUT_MS = 8000;
const TTL = 20;

const HASH_RE = /^[0-9a-f]{64}$/i;
const ADDR_RE = /^G[A-Z2-7]{55}$/;

// CCTP domain -> the name the UI shows. Kept here rather than trusted from the client so a record can
// never claim it went somewhere it did not.
const DOMAIN = {
  0: 'Ethereum', 1: 'Avalanche', 2: 'Optimism', 3: 'Arbitrum', 5: 'Solana',
  6: 'Base', 7: 'Polygon', 8: 'Sui', 11: 'Linea', 14: 'World Chain',
};

function json(body, status, ttl) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': ttl ? ('public, max-age=0, s-maxage=' + ttl) : 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
    },
  });
}

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!r.ok) return null;
  try { return await r.json(); } catch (e) { return null; }
}

// ---- the burn, read from the ledger itself ---------------------------------------------------------
// Circle's attestation is only ONE source of "where did it go", and it is the one that can be late: a record
// registered seconds after the burn found Circle still pending, stored destination/amount/recipient as null, and
// nothing ever came back for it (2026-09-17, 0.0999 USDC to Base -- a blank row with no network logo on the
// Cross-Chain page). The burn transaction carries all three as its own call arguments:
//   deposit_for_burn(from, amount:i128, destination_domain:u32, mint_recipient:bytes32, ...)
// and Horizon reports the USDC actually burned as a balance change. So the ledger answers without Circle.
function b64u8(s) { const b = atob(String(s || '')); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
function be32(u, o) { return ((u[o] << 24) >>> 0) + (u[o + 1] << 16) + (u[o + 2] << 8) + u[o + 3]; }
function scTag(u) { return u.length >= 4 ? be32(u, 0) : -1; }
function scSym(u) { if (scTag(u) !== 15) return ''; const n = be32(u, 4); let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(u[8 + i]); return s; }
function scU32(u) { return scTag(u) === 3 ? be32(u, 4) : -1; }
function scBytes(u) { return scTag(u) === 13 ? u.slice(8, 8 + be32(u, 4)) : new Uint8Array(0); }
function hex(u) { return Array.from(u, (x) => x.toString(16).padStart(2, '0')).join(''); }

async function fromBurn(burnHash, payer) {
  const ops = await getJson(H + '/transactions/' + encodeURIComponent(burnHash) + '/operations?limit=10').catch(() => null);
  const recs = (ops && ops._embedded && ops._embedded.records) || [];
  const op = recs.filter((o) => o.type === 'invoke_host_function' && (!payer || o.source_account === payer))[0];
  if (!op || op.transaction_successful === false) return null;
  const P = op.parameters || [];
  if (P.length < 6 || scSym(b64u8(P[1].value)) !== 'deposit_for_burn') return null;
  const dom = scU32(b64u8(P[4].value));
  const mr = scBytes(b64u8(P[5].value));
  const burned = (op.asset_balance_changes || []).filter((c) => c.type === 'burn' && c.asset_code === 'USDC')[0];
  const amount = burned ? +burned.amount : NaN;
  if (!(dom >= 0) || !DOMAIN[dom] || mr.length < 20 || !(amount > 0)) return null;
  return { destDomain: dom, amount, recipient: '0x' + hex(mr.slice(mr.length - 20)) };
}

// A stored row missing its destination is completed from the chain and written back -- at most HEAL_MAX per
// request, so a backlog can never push one request past the free plan's subrequest cap.
const HEAL_MAX = 3;
async function heal(kv, map) {
  const todo = Object.keys(map).filter((k) => map[k] && map[k].destName == null && HASH_RE.test(map[k].burnHash || '')).slice(0, HEAL_MAX);
  let changed = 0;
  for (const k of todo) {
    const r = map[k];
    const d = await fromBurn(r.burnHash, r.from).catch(() => null);
    if (!d) continue;
    r.destDomain = d.destDomain; r.destName = DOMAIN[d.destDomain];
    r.amount = d.amount; r.gross = (r.feeCode === 'USDC' || !r.feeCode) ? +(d.amount + (+r.fee || 0)).toFixed(7) : null;
    if (!r.recipient) r.recipient = d.recipient;
    changed++;
  }
  if (changed) { try { await kv.put(KEY, JSON.stringify(map)); } catch (e) {} }
}

// ---- public: read the registry -------------------------------------------------------------------
// Everything here is already public on chain; the value is that it is assembled and attributed.
export async function onRequestGet({ request, env }) {
  const kv = env && env.CONTENT_KV;
  if (!kv) return json({ ok: 1, rows: [] }, 200, TTL);

  let map = {};
  try { map = (await kv.get(KEY, 'json')) || {}; } catch (e) { map = {}; }
  await heal(kv, map);

  const q = new URL(request.url).searchParams;
  const who = (q.get('from') || '').trim();
  const limit = Math.max(1, Math.min(200, +(q.get('limit') || 50) || 50));

  let rows = Object.keys(map).map((k) => map[k]).filter(Boolean);
  if (ADDR_RE.test(who)) rows = rows.filter((r) => r.from === who);
  rows.sort((a, b) => (+b.ts || 0) - (+a.ts || 0));

  return json({ ok: 1, rows: rows.slice(0, limit) }, 200, TTL);
}

// ---- public: register a bridge, if the ledger agrees ----------------------------------------------
export async function onRequestPost({ request, env }) {
  const kv = env && env.CONTENT_KV;
  if (!kv) return json({ ok: false, error: 'no kv binding' }, 500);

  let b;
  try { b = await request.json(); } catch (e) { return json({ ok: false, error: 'bad request' }, 400); }
  if (!b || typeof b !== 'object') return json({ ok: false, error: 'bad request' }, 400);

  const feeHash = String(b.feeHash || '').trim();
  const burnHash = String(b.burnHash || '').trim();
  if (!HASH_RE.test(feeHash)) return json({ ok: false, error: 'bad feeHash' }, 400);
  if (!HASH_RE.test(burnHash)) return json({ ok: false, error: 'bad burnHash' }, 400);

  // Already known. Idempotent, so the client may retry freely -- and so may the confirm page.
  let map = {};
  try { map = (await kv.get(KEY, 'json')) || {}; } catch (e) { map = {}; }
  if (map[feeHash]) return json({ ok: true, status: 'known' }, 200);

  // 1) the fee transaction must be exactly what a deferred bridge fee looks like
  const feeOps = await getJson(H + '/transactions/' + encodeURIComponent(feeHash) + '/operations?limit=5');
  const fops = (feeOps && feeOps._embedded && feeOps._embedded.records) || [];
  if (!fops.length) return json({ ok: false, error: 'fee transaction not found' }, 400);
  // TWO SHAPES, both read off the ledger. A USDC-sourced bridge pays its fee as its own one-op payment, after the
  // burn. A bridge from any other asset (XLM, SHX, LUMOS...) pays it INSIDE the swap transaction: optionally a
  // trustline, the path payment into USDC to the sender, then the fee -- a payment in XLM, or a path payment ending
  // in XLM -- to the collector. Only the first shape was accepted, so no swap-first bridge ever reached this record
  // (RAZA 2026-09-19: 5 XLM -> Polygon, burn ae2fe3db...). Anything else in the transaction is still refused.
  let feeOp = null, swapOp = null;
  if (fops.length === 1 && fops[0].type === 'payment' && fops[0].to === FEE_ACCT) {
    feeOp = fops[0];
  } else {
    const allowed = { change_trust: 1, path_payment_strict_send: 1, path_payment_strict_receive: 1, payment: 1 };
    if (fops.some((o) => !allowed[o.type])) return json({ ok: false, error: 'that transaction is not a bridge fee payment' }, 400);
    const toFee = fops.filter((o) => o.to === FEE_ACCT);
    const toSelf = fops.filter((o) => /^path_payment/.test(o.type) && o.to && o.to === o.from && o.asset_code === 'USDC');
    if (toFee.length !== 1 || toSelf.length !== 1) return json({ ok: false, error: 'that transaction is not a bridge fee payment' }, 400);
    feeOp = toFee[0]; swapOp = toSelf[0];
    if (feeOp.from !== swapOp.from) return json({ ok: false, error: 'fee and swap are from different accounts' }, 400);
  }
  const payer = String(feeOp.from || '');
  const feeAmount = +feeOp.amount || 0;                   // for a path payment, what the collector RECEIVED
  const feeCode = feeOp.asset_type === 'native' ? 'XLM' : String(feeOp.asset_code || '');
  const feeAt = Date.parse(feeOp.created_at || '') || 0;
  if (!ADDR_RE.test(payer) || !(feeAmount > 0)) return json({ ok: false, error: 'unreadable fee payment' }, 400);
  // what the user actually put in, when it was not USDC -- shown as "5 XLM", not as the USDC it became
  const srcAmount = swapOp ? +(+swapOp.source_amount + (feeOp.type === 'payment' && feeOp.asset_type === swapOp.source_asset_type ? feeAmount : 0)).toFixed(7) : null;
  const srcCode = swapOp ? (swapOp.source_asset_type === 'native' ? 'XLM' : String(swapOp.source_asset_code || '')) : null;

  // 2) the burn must be a Soroban call from the SAME account, close in time
  const burnOps = await getJson(H + '/transactions/' + encodeURIComponent(burnHash) + '/operations?limit=10');
  const bops = (burnOps && burnOps._embedded && burnOps._embedded.records) || [];
  const burn = bops.filter((o) => o.type === 'invoke_host_function' && o.source_account === payer)[0];
  if (!burn) return json({ ok: false, error: 'no matching burn for that payer' }, 400);
  const burnAt = Date.parse(burn.created_at || '') || 0;
  if (!burnAt || Math.abs(feeAt - burnAt) > BRIDGE_WINDOW_MS) {
    return json({ ok: false, error: 'the burn and the fee are not part of the same transfer' }, 400);
  }

  // 3) how much went where, from Circle rather than from the caller. A pending attestation is not a
  //    failure -- the record is worth storing without it, and the amount can be filled in later.
  let destDomain = null, burnAmount = null, recipient = '';
  const iris = await getJson(IRIS + encodeURIComponent(burnHash)).catch(() => null);
  const msg = iris && iris.messages && iris.messages[0];
  const dm = (msg && msg.decodedMessage) || null;
  if (dm) {
    const dd = +dm.destinationDomain;
    if (dd >= 0 && DOMAIN[dd]) destDomain = dd;
    const body = dm.decodedMessageBody || {};
    const amt = +body.amount;
    if (amt > 0) burnAmount = amt / 1e6;                 // CCTP USDC is 6dp
    recipient = String(body.mintRecipient || '').slice(0, 80);
  }
  // Circle not ready yet: the burn's own arguments say the same thing.
  if (destDomain == null || burnAmount == null) {
    const d = await fromBurn(burnHash, payer).catch(() => null);
    if (d) {
      if (destDomain == null) destDomain = d.destDomain;
      if (burnAmount == null) burnAmount = d.amount;
      if (!recipient) recipient = d.recipient;
    }
  }

  const rec = {
    feeHash, burnHash, from: payer,
    fee: feeAmount, feeCode,
    amount: burnAmount,                                   // USDC burned, net of our fee
    // gross is only meaningful when the fee is in the same unit as the burn (USDC); a fee in XLM is not addable
    gross: burnAmount != null && feeCode === 'USDC' ? +(burnAmount + feeAmount).toFixed(7) : null,
    srcAmount, srcCode,                                   // e.g. 5 / "XLM" for a swap-first bridge; null for USDC
    destDomain, destName: destDomain != null ? DOMAIN[destDomain] : null,
    recipient,
    ts: feeAt || burnAt || Date.now(),
  };

  map[feeHash] = rec;

  // Keep the newest MAX_KEEP. An unbounded map would eventually stop fitting in one KV value, and this
  // is a feed, not an audit log -- the chain remains the audit log.
  const keys = Object.keys(map);
  if (keys.length > MAX_KEEP) {
    keys.sort((a, b) => (+map[b].ts || 0) - (+map[a].ts || 0));
    const trimmed = {};
    keys.slice(0, MAX_KEEP).forEach((k) => { trimmed[k] = map[k]; });
    map = trimmed;
  }

  try { await kv.put(KEY, JSON.stringify(map)); }
  catch (e) { return json({ ok: false, error: 'could not store' }, 500); }

  return json({ ok: true, status: 'stored', record: rec }, 200);
}
