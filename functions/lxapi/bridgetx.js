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

// ---- public: read the registry -------------------------------------------------------------------
// Everything here is already public on chain; the value is that it is assembled and attributed.
export async function onRequestGet({ request, env }) {
  const kv = env && env.CONTENT_KV;
  if (!kv) return json({ ok: 1, rows: [] }, 200, TTL);

  let map = {};
  try { map = (await kv.get(KEY, 'json')) || {}; } catch (e) { map = {}; }

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
  if (fops.length !== 1 || fops[0].type !== 'payment' || fops[0].to !== FEE_ACCT) {
    return json({ ok: false, error: 'that transaction is not a standalone fee payment' }, 400);
  }
  const payer = String(fops[0].from || '');
  const feeAmount = +fops[0].amount || 0;
  const feeCode = fops[0].asset_type === 'native' ? 'XLM' : String(fops[0].asset_code || '');
  const feeAt = Date.parse(fops[0].created_at || '') || 0;
  if (!ADDR_RE.test(payer) || !(feeAmount > 0)) return json({ ok: false, error: 'unreadable fee payment' }, 400);

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

  const rec = {
    feeHash, burnHash, from: payer,
    fee: feeAmount, feeCode,
    amount: burnAmount,                                   // USDC burned, net of our fee
    gross: burnAmount != null ? +(burnAmount + feeAmount).toFixed(7) : null,
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
