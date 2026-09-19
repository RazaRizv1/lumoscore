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
// LayerZero / NEAR Intents rows, {transferHash: record}. A SEPARATE key on purpose: staging and production share this
// KV namespace, and a deployment built before these routes existed reads KEY and treats every row in it as a CCTP burn.
const RKEY = 'bridge:routes';
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
  const todo = Object.keys(map).filter((k) => map[k] && (!map[k].route || map[k].route === 'CCTP') && map[k].destName == null && HASH_RE.test(map[k].burnHash || '')).slice(0, HEAL_MAX);
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

// ---- LayerZero and NEAR Intents ------------------------------------------------------------------
// RAZA 2026-09-19: "it should show all on both devices". Only CCTP transfers reached this record; the other two
// routes lived in the localStorage of the browser that sent them, so phone and desktop showed different histories.
// They are registered here by the transfer's own hash, and -- as for CCTP -- nothing the caller says is trusted:
//
//   LayerZero     the tx must be a `send` call on the USDT0 OFT contract that burned USDT0, from `payer`. Destination
//                 (dst_eid) and recipient (`to`) are read from the call's own arguments, the amount from the burn.
//   NEAR Intents  the tx must pay 1Click's Stellar deposit account from `payer`, under a numeric memo. What it
//                 delivered, on which chain and to whom is read from 1Click's status for that memo, and the quote's
//                 refund address must be `payer` -- the deposit is the payer's own.
//
// AND BOTH MUST CARRY LUMOSCORE'S FEE. Anyone can call the OFT, and every Stellar user of 1Click pays the same deposit
// account, so the transfer alone does not show it went through LumosCore. It counts only when the same account paid
// the fee collector in the transfer itself or in a transaction within BRIDGE_WINDOW_MS of it (the swap-first leg, or
// LayerZero's deferred fee). A stranger's transfer cannot be recorded as ours.
const OFT = '5d672cb21b3afcdda54546c7f5b9fd346920e41f8fe8f39e838e5d7bd7435546';   // CBOWOLFSDM5P…UMMF6, raw contract id
const NI_DEP = 'GDJ4JZXZELZD737NVFORH4PSSQDWFDZTKW3AIDKHYQG23ZXBPDGGQBJK';            // 1Click, one account, memo per transfer
const ONECLICK = 'https://1click.chaindefuser.com/v0';
const EID = { 30101: 'Ethereum', 30110: 'Arbitrum', 30111: 'Optimism', 30109: 'Polygon', 30362: 'Berachain', 30339: 'Ink',
  30367: 'Hyperliquid', 30390: 'Monad', 30295: 'Flare', 30280: 'Sei', 30398: 'MegaETH', 30383: 'Plasma' };
const NI_CHAIN = { eth: 'Ethereum', arb: 'Arbitrum', base: 'Base', pol: 'Polygon', op: 'Optimism', avax: 'Avalanche',
  bera: 'Berachain', monad: 'Monad', plasma: 'Plasma' };
const NI_FINAL = { SUCCESS: 1, REFUNDED: 1, FAILED: 1 };
// Sent through LumosCore but carrying no fee, checked by hand against the ledger 2026-09-19: the first USDT0-sourced
// LayerZero send (0.05988 USDT0 -> Polygon, RAZA's wallet). Its deferred fee failed with op_no_trust -- the collector had
// no USDT0 trustline yet -- and it predates the `lx:lz` memo. Nothing else is accepted without a fee.
const LZ_FEELESS = { '18bddff507944aa88f1cc4345e48b893d1d7dd9db3bd16b8914e6151272c7b1d': 1 };

// The value stored under a symbol key of a Soroban map, as raw ScVal bytes (key: tag 15, u32 length, padded name).
function scMapVal(u, name) {
  const key = [0, 0, 0, 15, 0, 0, 0, name.length].concat(Array.from(name, (c) => c.charCodeAt(0)));
  while (key.length % 4) key.push(0);
  outer: for (let i = 0; i + key.length <= u.length; i++) {
    for (let k = 0; k < key.length; k++) if (u[i + k] !== key[k]) continue outer;
    return u.slice(i + key.length);
  }
  return null;
}
function codeOf(o, p) { p = p || ''; return o[p + 'asset_type'] === 'native' ? 'XLM' : String(o[p + 'asset_code'] || ''); }

// The fee this transfer paid LumosCore: in the transfer itself, or in the payer's own transaction nearest to it.
// A fee in ANOTHER transaction is matched with care: the same wallet may have bridged by CCTP minutes earlier (RAZA did,
// 12:11 CCTP then 12:14 LayerZero). So the route's own memo wins (`lx:lz` / `lx:ni`), a swap in that transaction must
// deliver THIS route's transport asset, and a fee already credited to another record is never taken twice.
async function feeFor(payer, at, sameOps, memoTag, transport, used) {
  const own = (sameOps || []).filter((o) => o.to === FEE_ACCT && o.from === payer)[0];
  if (own) return { op: own, ops: sameOps, hash: own.transaction_hash };
  const txs = await getJson(H + '/accounts/' + payer + '/payments?order=desc&limit=50&join=transactions');
  const cands = ((txs && txs._embedded && txs._embedded.records) || [])
    .filter((p) => p.to === FEE_ACCT && p.from === payer && !used[p.transaction_hash]
      && Math.abs((Date.parse(p.created_at) || 0) - at) <= BRIDGE_WINDOW_MS)
    .sort((a, b) => {
      const ma = ((a.transaction || {}).memo === memoTag) ? 0 : 1, mb = ((b.transaction || {}).memo === memoTag) ? 0 : 1;
      return (ma - mb) || (Math.abs(Date.parse(a.created_at) - at) - Math.abs(Date.parse(b.created_at) - at));
    }).slice(0, 3);
  for (const c of cands) {
    // IN ANOTHER TRANSACTION THE FEE MUST CARRY THIS ROUTE'S MEMO. Untagged, the nearest fee was an ordinary swap's --
    // tested against the ledger, RAZA's 12:14 LayerZero send picked up a dashboard XLM->USDT0 swap three minutes
    // earlier, which would have moved that swap's revenue into bridge revenue. Every send since the memos exist has one.
    const memo = (c.transaction || {}).memo || '';
    if (memo !== memoTag) continue;
    const r = await getJson(H + '/transactions/' + c.transaction_hash + '/operations?limit=10');
    const ops = (r && r._embedded && r._embedded.records) || [];
    const swap = ops.filter((o) => /^path_payment/.test(o.type) && o.to && o.to === o.from)[0];
    if (swap && swap.asset_code !== transport) continue;        // swapped into another route's asset
    const feeIn = /^path_payment/.test(c.type) ? codeOf(c, 'source_') : codeOf(c);
    if (!swap && feeIn !== transport) continue;                  // a lone fee must be paid in this route's asset
    return { op: c, ops, hash: c.transaction_hash };
  }
  return null;
}
// what the user put in: the swap into the transport asset when there was one, else transport + fee in the same asset
function srcOf(fee, transportCode, transportAmt) {
  const swap = (fee.ops || []).filter((o) => /^path_payment/.test(o.type) && o.to && o.to === o.from)[0];
  const fc = fee.op.asset_type === 'native' ? 'XLM' : String(fee.op.asset_code || '');
  const feeSrcCode = /^path_payment/.test(fee.op.type) ? codeOf(fee.op, 'source_') : fc;
  const feeSrcAmt = /^path_payment/.test(fee.op.type) ? +fee.op.source_amount : +fee.op.amount;
  if (swap) {
    const sc = codeOf(swap, 'source_');
    return { srcAmount: +(+swap.source_amount + (feeSrcCode === sc ? feeSrcAmt : 0)).toFixed(7), srcCode: sc };
  }
  return { srcAmount: +(transportAmt + (feeSrcCode === transportCode ? feeSrcAmt : 0)).toFixed(7), srcCode: transportCode };
}

async function registerLz(hash, used) {
  const ops = await getJson(H + '/transactions/' + hash + '/operations?limit=10');
  const op = ((ops && ops._embedded && ops._embedded.records) || []).filter((o) => o.type === 'invoke_host_function')[0];
  if (!op || op.transaction_successful === false) return { error: 'not a LayerZero send' };
  const P = op.parameters || [];
  const c = P[0] ? b64u8(P[0].value) : new Uint8Array(0);
  if (scTag(c) !== 18 || hex(c.slice(8, 40)) !== OFT || scSym(b64u8((P[1] || {}).value)) !== 'send') return { error: 'not a LayerZero send' };
  const burn = (op.asset_balance_changes || []).filter((b) => b.type === 'burn' && b.asset_code === 'USDT0')[0];
  const payer = op.source_account;
  let eid = -1, to = '';
  for (const p of P) {
    if (p.type !== 'Map') continue;
    const u = b64u8(p.value);
    const e = scMapVal(u, 'dst_eid'); if (e && scTag(e) === 3) eid = be32(e, 4);
    const t = scMapVal(u, 'to'); if (t && scTag(t) === 13) { const b = t.slice(8, 8 + be32(t, 4)); if (b.length >= 20) to = '0x' + hex(b.slice(b.length - 20)); }
  }
  if (!burn || !ADDR_RE.test(payer || '') || !EID[eid]) return { error: 'unreadable LayerZero send' };
  const at = Date.parse(op.created_at) || Date.now();
  const fee = await feeFor(payer, at, null, 'lx:lz', 'USDT0', used);
  if (!fee && !LZ_FEELESS[hash]) return { error: 'no LumosCore fee for that transfer' };
  if (!fee) return { rec: { route: 'LayerZero', feeHash: null, burnHash: hash, from: payer, fee: 0, feeCode: 'USDT0',
    amount: +burn.amount, asset: 'USDT0', gross: null, srcAmount: +burn.amount, srcCode: 'USDT0',
    destDomain: null, destName: EID[eid], recipient: to, ts: at } };
  const s = srcOf(fee, 'USDT0', +burn.amount);
  return { rec: { route: 'LayerZero', feeHash: fee.hash, burnHash: hash, from: payer, fee: +fee.op.amount, feeCode: codeOf(fee.op),
    amount: +burn.amount, asset: 'USDT0', gross: null, srcAmount: s.srcAmount, srcCode: s.srcCode,
    destDomain: null, destName: EID[eid], recipient: to, ts: at } };
}

let NI_TOK = null, NI_TOK_AT = 0;
async function niTokens(env) {
  if (NI_TOK && Date.now() - NI_TOK_AT < 3600000) return NI_TOK;
  const a = await getJson(ONECLICK + '/tokens');
  if (Array.isArray(a)) { NI_TOK = {}; a.forEach((t) => { if (t && t.assetId) NI_TOK[t.assetId] = { symbol: t.symbol, chain: t.blockchain }; }); NI_TOK_AT = Date.now(); }
  return NI_TOK || {};
}
async function niStatus(env, memo) {
  const h = { accept: 'application/json' };
  if (env && env.ONECLICK_JWT) h['X-API-Key'] = env.ONECLICK_JWT;   // never echoed
  const r = await fetch(ONECLICK + '/status?depositAddress=' + NI_DEP + '&depositMemo=' + encodeURIComponent(memo), { headers: h, signal: AbortSignal.timeout(TIMEOUT_MS) });
  return r.ok ? r.json() : null;
}
function niApply(rec, s, tok) {
  const q = (s && s.quoteResponse) || {}, qr = q.quoteRequest || {}, sd = (s && s.swapDetails) || {};
  const t = tok[qr.destinationAsset];
  if (!t || !NI_CHAIN[t.chain]) return false;
  rec.asset = String(t.symbol || '').slice(0, 20);
  rec.destName = NI_CHAIN[t.chain];
  rec.recipient = String(qr.recipient || '').slice(0, 80);
  rec.amount = s.status === 'SUCCESS' ? +(sd.amountOutFormatted || 0) : +((q.quote || {}).amountOutFormatted || 0);
  rec.niStatus = String(s.status || '');
  // what the deposit was worth in dollars, as 1Click itself valued it -- the admin's cross-chain volume. Taken from
  // 1Click rather than priced here, because the source may be AQUA or LUMOS, which this function cannot price.
  const usd = +(sd.amountInUsd || sd.depositedAmountUsd || (q.quote || {}).amountInUsd || 0);
  if (usd > 0) rec.usdIn = +usd.toFixed(2);
  return true;
}
async function registerNi(hash, env, used) {
  const ops = await getJson(H + '/transactions/' + hash + '/operations?limit=10&join=transactions');
  const recs = (ops && ops._embedded && ops._embedded.records) || [];
  const dep = recs.filter((o) => o.type === 'payment' && o.to === NI_DEP)[0];
  const tx = (recs[0] && recs[0].transaction) || {};
  const memo = String(tx.memo || '');
  if (!dep || tx.successful === false || tx.memo_type !== 'id' || !/^[0-9]{1,20}$/.test(memo)) return { error: 'not a NEAR Intents deposit' };
  const payer = dep.from;
  const s = await niStatus(env, memo);
  const qr = (s && s.quoteResponse && s.quoteResponse.quoteRequest) || {};
  if (!s || qr.refundTo !== payer) return { error: 'that deposit is not this account’s' };
  const at = Date.parse(dep.created_at) || Date.now();
  const code = codeOf(dep);
  const fee = await feeFor(payer, at, recs, 'lx:ni', code, used);
  if (!fee) return { error: 'no LumosCore fee for that transfer' };
  const sIn = srcOf(fee, code, +dep.amount);
  const rec = { route: 'NEAR Intents', feeHash: fee.hash, burnHash: hash, from: payer, fee: +fee.op.amount, feeCode: codeOf(fee.op),
    amount: null, asset: null, gross: null, srcAmount: sIn.srcAmount, srcCode: sIn.srcCode, depositMemo: memo,
    destDomain: null, destName: null, recipient: '', ts: at };
  if (!niApply(rec, s, await niTokens(env))) return { error: 'unknown destination token' };
  return { rec };
}
// a NEAR Intents row still in flight is brought up to date on read, a few per request
async function healNi(kv, map, env) {   // map is the RKEY map
  const todo = Object.keys(map).filter((k) => map[k] && map[k].route === 'NEAR Intents' && (!NI_FINAL[map[k].niStatus] || map[k].usdIn == null)).slice(0, HEAL_MAX);
  if (!todo.length) return;
  const tok = await niTokens(env);
  let changed = 0;
  for (const k of todo) {
    const s = await niStatus(env, map[k].depositMemo).catch(() => null);
    if (s && niApply(map[k], s, tok)) {
      // finished and 1Click gave no dollar value: settle at 0 so this row is not asked about on every request
      if (map[k].usdIn == null && NI_FINAL[map[k].niStatus]) map[k].usdIn = 0;
      changed++;
    }
  }
  if (changed) { try { await kv.put(RKEY, JSON.stringify(map)); } catch (e) {} }
}

// ---- public: read the registry -------------------------------------------------------------------
// Everything here is already public on chain; the value is that it is assembled and attributed.
export async function onRequestGet({ request, env }) {
  const kv = env && env.CONTENT_KV;
  if (!kv) return json({ ok: 1, rows: [] }, 200, TTL);

  let map = {};
  try { map = (await kv.get(KEY, 'json')) || {}; } catch (e) { map = {}; }
  await heal(kv, map);
  const q0 = new URL(request.url).searchParams;
  let rmap = {};
  if (q0.get('routes') === 'all') {
    try { rmap = (await kv.get(RKEY, 'json')) || {}; } catch (e) { rmap = {}; }
    await healNi(kv, rmap, env).catch(() => {});
  }

  const q = new URL(request.url).searchParams;
  const who = (q.get('from') || '').trim();
  const limit = Math.max(1, Math.min(200, +(q.get('limit') || 50) || 50));

  let rows = Object.keys(map).map((k) => map[k]).concat(Object.keys(rmap).map((k) => rmap[k])).filter(Boolean);
  // LayerZero / NEAR Intents rows go only to a caller that asks for them. Staging and production share this store, and
  // a client written before these routes existed reads every row as a CCTP burn: it would draw them as USDC and --
  // worse -- offer each one to its connected wallet as a claim that can never complete. Opt-in keeps old pages right.
  if (q.get('routes') !== 'all') rows = rows.filter((r) => !r.route || r.route === 'CCTP');
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

  // LayerZero / NEAR Intents: registered by the transfer's own hash, verified above. Keyed by that hash (the fee may
  // live in another transaction), so a retry is idempotent and one transfer is one row.
  if (b.route === 'LayerZero' || b.route === 'NEAR Intents') {
    const h = String(b.hash || '').trim().toLowerCase();
    if (!HASH_RE.test(h)) return json({ ok: false, error: 'bad hash' }, 400);
    let m = {}, cm = {};
    try { m = (await kv.get(RKEY, 'json')) || {}; } catch (e) { m = {}; }
    if (m[h]) return json({ ok: true, status: 'known' }, 200);
    try { cm = (await kv.get(KEY, 'json')) || {}; } catch (e) { cm = {}; }
    const used = {}; [m, cm].forEach((mm) => Object.keys(mm).forEach((k) => { if (mm[k] && mm[k].feeHash) used[mm[k].feeHash] = 1; }));
    const r = await (b.route === 'LayerZero' ? registerLz(h, used) : registerNi(h, env, used)).catch(() => ({ error: 'could not read that transfer' }));
    if (!r.rec) return json({ ok: false, error: r.error || 'rejected' }, 400);
    // read again right before the write: another registration may have landed while the ledger was being read
    try { m = (await kv.get(RKEY, 'json')) || m; } catch (e) {}
    m[h] = r.rec;
    const ks = Object.keys(m);
    if (ks.length > MAX_KEEP) { ks.sort((a, c) => (+m[c].ts || 0) - (+m[a].ts || 0)); const t = {}; ks.slice(0, MAX_KEEP).forEach((k) => { t[k] = m[k]; }); m = t; }
    try { await kv.put(RKEY, JSON.stringify(m)); } catch (e) { return json({ ok: false, error: 'could not store' }, 500); }
    return json({ ok: true, status: 'stored', record: r.rec }, 200);
  }

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
