// GET /lxapi/nearfees — every payment into the NEAR fee collector, normalised for the admin Revenue page.
//
// THE THIRD COLLECTOR. The admin panel (_tools/_admin.js) reads Stellar's collector from Horizon and the XRP Ledger's
// from account_tx, both straight from the browser. NEAR cannot be read that way: the collector's history is spread over
// receipts, an ft_transfer arrives as a FunctionCall on the TOKEN's contract rather than on the collector, and decoding
// it needs the transaction index plus every transaction's receipts. So it is read here, once per cache period, and
// handed back already in HORIZON'S PAYMENT SHAPE -- the shape xRow() gives XRPL rows -- so every admin surface that
// already handles two chains handles three without a branch of its own.
//
// WHAT A ROW IS. A SUCCESSFUL receipt that moved value to fees-lumoscore.near:
//   native NEAR  a Transfer action on a receipt whose receiver is the collector;
//   a token      an ft_transfer FunctionCall on the token's contract naming receiver_id: fees-lumoscore.near.
// A failed receipt moved nothing and is not a row. The sender is the receipt's predecessor, which is the real account
// even inside a relayed (meta) transaction.
//
// WHAT IS NOT A ROW, and why:
//   predecessor "system"   gas refunds. The collector signs its own storage_deposit calls; the unused gas comes back.
//   signer = the collector the collector paying itself (an over-attached storage_deposit refunded by the token). These
//                          are counted in `self`, as the Stellar and XRPL sides count theirs, and move no money.
//
// THE FEE ASSET IS WHATEVER THE USER SWAPPED, so there is no fee-asset list on NEAR: the admin classifies by MEMO. Every
// LumosCore path that pays this account writes one (browser/nearswap.js "LumosCore platform fee 0.2%", nibridge.js
// "lx:ni", nearbridges.js "lx:om" / "lx:wh", contracts/router "lx:sw"). The one that cannot is the launchpad: the
// factory (lumoscore.near) forwards the create fee as a bare NEAR Transfer from its on_token_created callback. That
// receipt is recognised here by its shape -- predecessor lumoscore.near inside a create_token transaction -- and marked
// lxkind:"mint". create_reserved_token (LumosCore's own tokens, no fee) is deliberately NOT marked: the only one so far
// is the LUMOS mint's storage overpayment, which is RAZA's own NEAR coming back, not revenue.
//
// COST (10 ms CPU, 50 subrequests on the free plan): one index call, then only transactions not decoded before, twenty a
// call, at most PER_RUN per request, one call after the other -- FastNEAR answered 429 to two quick calls of twenty from
// one IP (2026-11-10). The decoded map holds a few fields per transaction and is kept a week in one cache entry, so the
// receipts (about 6 KB a transaction) are parsed once. A run that could not decode everything says partial:true and is
// cached only seconds; the admin then shows NEAR as incomplete, never as smaller.
//
// A FAILED READ IS { ok:false } AND IS NEVER CACHED. "No NEAR fees" and "could not ask" must never look alike.
//
// Public and read-only: it is chain data anyone can read on NearBlocks, takes no input and writes nothing but its own
// cache. functions/ ships to lumoscore.com too, which is fine for exactly that reason.

const FTX = 'https://tx.main.fastnear.com/v0/';
const RPC = 'https://free.rpc.fastnear.com';
const FEE = 'fees-lumoscore.near';
const FACTORY = 'lumoscore.near';
const VER = 'v1', TTL = 300, MAP_TTL = 604800, PER_RUN = 40, BATCH = 20;

// Symbol and decimals of the curated tokens, copied (id, symbol, decimals only) from the NEAR repo's
// functions/lxapi/_nearcurated.js on 2026-11-10. Anything else is asked of the token's own ft_metadata once and kept in
// the decoded map, since decimals never change.
const CUR = [
  ['wrap.near','wNEAR',24],['17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1','USDC',6],
  ['usdt.tether-token.near','USDt',6],['qtc.omft.near','QTC',12],['zec.omft.near','ZEC',8],
  ['token.rhealab.near','RHEA',18],['batman-4.nearlytrade.near','BATMAN',18],
  ['dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near','USDT.e',6],
  ['ikp.v2-launchpad.justhoot.near','IKP',18],
  ['a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near','USDC.e',6],
  ['nearly-993927.nearlytrade.near','NEARLY',18],
  ['6b175474e89094c44da98b954eedeac495271d0f.factory.bridge.near','DAI',18],
  ['853d955acef822db058eb8505911ed77f175b99e.factory.bridge.near','FRAX',18],
  ['hoot-8ecf65.launchpad.justhoot.near','HOOT',18],
  ['aaaaaa20d9e0e2461697782ef11675f668207961.factory.bridge.near','AURORA',18],
  ['wth-0b2227.launchpad.justhoot.near','WTH',18],['three-de86d6.launchpad.justhoot.near','THREE',18],
  ['token.sweat','SWEAT',18],['token.publicailab.near','PUBLIC',18],['dragon-3.nearlytrade.near','DRAGON',18],
  ['nomo.nearlytrade.near','NOMO',18],['lst.rhealab.near','rNEAR',24],['token.0xshitzu.near','SHITZU',18],
  ['qcat-3.nearlytrade.near','QCAT',18],['diarhea.nearlytrade.near','DIARHEA',18],
  ['blackdragon.tkn.near','BLACKDRAGON',24],['linear-protocol.near','LINEAR',24],
  ['hoodl-95275b.launchpad.justhoot.near','HOODL',18],['shore-4lzt.launch.shoremarkets.near','SHORE',18],
  ['kat.token0.near','KAT',18],['meta-pool.near','STNEAR',24],['ninu-4.nearlytrade.near','NINU',18],
  ['ai-8.nearlytrade.near','AI',18],['v2-nearx.stader-labs.near','NearX',24],
  ['nearagents.nearlytrade.near','NEARAGENTS',18],['npro.nearmobile.near','NPRO',24],
  ['2260fac5e5542a773aa44fbcfedf7c193bc2c599.factory.bridge.near','WBTC',8],['gear.enleap.near','GEAR',18],
  ['yuvi-6c041e37.qlyphs.near','YUVI',0],['singularty.nearlytrade.near','SINGULARTY',18],
  ['ftv2.nekotoken.near','NEKO',24],['staker1.msig1.trufin.near','TruNEAR',24],['spud-3.nearlytrade.near','SPUD',18],
  ['trade-2.nearlytrade.near','TRADE',18],['22.contract.portalbridge.near','SOL',8],
  ['sol-0xd31e793eff8104551603bfac6e1222af303d4c5b.omdep.near','DARK',6],
  ['52a047ee205701895ee06a375492490ec9c597ce.factory.bridge.near','PULSE',18],['cfi.consumer-fi.near','CFI',18],
  ['eth.bridge.near','ETH',18],['nbtc.bridge.near','NBTC',8],['jambo-1679.meme-cooking.near','JAMBO',18],
  ['apys.token.a11bd.near','APYS',24],['ribbit-426.meme-cooking.near','RIBBIT',18],['xtoken.rhealab.near','XRHEA',18],
  ['token.v2.ref-finance.near','REF',18],['mpoo.nearlytrade.near','MPOO',18],['usmeme.tg','USM',8],
  ['438e48ed4ce6beecf503d43b9dbd3c30d516e7fd.factory.bridge.near','UWON',18],['nearai.aidols.near','NEARAI',24],
  ['nearsight.v2-launchpad.justhoot.near','NEARSIGHT',18],['mpdao-token.near','mpDAO',6],
  ['gnear-229.meme-cooking.near','gnear',18],['d9c2d319cd7e6177336b0a9c93c21cb48d84fb54.factory.bridge.near','HAPI',18],
  ['zolanear-1726.meme-cooking.near','ZOLANEAR',18],['xtoken.ref-finance.near','xREF',18],
  ['c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2.factory.bridge.near','WETH',18],['vote-1737.meme-cooking.near','VOTE',18],
  ['poppy-0.meme-cooking-test.near','POPPY',18],
  ['509a38b7a1cc0dcd83aa9d06214663d9ec7c7f4a.factory.bridge.near','BST',18],['meta-token.near','$META',24],
  ['l000000.factory.shardsmarket.near','SHARDS',18],['itlx.intellex_xyz.near','ITLX',24],
  ['claw-2.nearlytrade.near','CLAW',18],['lumos.lumoscore.near','LUMOS',18]
];
const DEC = {};
for (const c of CUR) DEC[c[0]] = { s: c[1], d: c[2] };

function json(body, maxAge) {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=' + maxAge, 'access-control-allow-origin': '*' } });
}
async function post(path, body) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(FTX + path, { method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'application/json', 'user-agent': 'LumosCore/1.0 (+https://lumoscore.com)' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('fastnear ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
// A token's symbol and decimals; null when the token would not say. The symbol is the token's own claim and anybody can
// deploy a token, so it is cut to a plain ticker here and escaped again where it is drawn.
async function meta(id) {
  try {
    const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1,
      method: 'query', params: { request_type: 'call_function', finality: 'final', account_id: id, method_name: 'ft_metadata', args_base64: 'e30=' } }) });
    const j = await r.json();
    const m = JSON.parse(new TextDecoder().decode(new Uint8Array(j.result.result)));
    if (Number.isInteger(+m.decimals) && +m.decimals >= 0 && +m.decimals <= 40)
      return { s: String(m.symbol || '').replace(/[^A-Za-z0-9.$_-]/g, '').slice(0, 16) || '?', d: +m.decimals };
  } catch (e) {}
  return null;
}
function scaled(raw, d) {
  const s = String(raw || '');
  if (!/^[0-9]+$/.test(s) || d == null) return null;
  const whole = s.length > d ? s.slice(0, s.length - d) : '0';
  const frac = (s.length > d ? s.slice(s.length - d) : s.padStart(d, '0')).replace(/0+$/, '');
  return whole.replace(/^0+(?=\d)/, '') + (frac ? '.' + frac : '');
}
function b64json(s) { try { return JSON.parse(atob(s || '')); } catch (e) { return null; } }
function okStatus(st) { return !!st && (st.SuccessValue !== undefined || st.SuccessReceiptId !== undefined); }

// One transaction -> what it paid the collector, as compact entries [receipt id, ms, from, token|"near", raw, memo, tag].
// tag: "" a payment, "s" the collector paying itself, "m" a launchpad create fee, "t" a swap fee paid as wNEAR by Rhea.
// An empty list still means "read".
//
// THE wNEAR SWAP FEE (RAZA 2026-11-10: "the fee always arrives as wNEAR"). The NEAR swap now sells its fee slice through
// Rhea with swap_out_recipient fees-lumoscore.near (NEAR repo, browser/nearswap.js), so the fee lands as Rhea's own
// ft_transfer of wNEAR, with no memo of ours. It is recognised by the transaction's shape: the signer's ft_transfer_call
// to v2.ref-finance.near whose msg names swap_out_recipient fees-lumoscore.near, and Rhea's ft_transfer on wrap.near to
// the collector in that same transaction. Any other wNEAR from Rhea stays an unmarked row, which the admin files under
// Other: a receipt from Rhea is never a fee unless the user's own msg says it is. The row is booked to the signer.
const REF = 'v2.ref-finance.near', WNEAR = 'wrap.near';
function asksFee(T) {
  const signer = (T.transaction || {}).signer_id;
  for (const R of (T.receipts || [])) {
    const r = R.receipt || {}, A = r.receipt && r.receipt.Action;
    if (!A || r.predecessor_id !== signer) continue;
    for (const a of (A.actions || [])) {
      const f = a && a.FunctionCall;
      if (!f || f.method_name !== 'ft_transfer_call') continue;
      const args = b64json(f.args);
      if (!args || args.receiver_id !== REF) continue;
      let m = null;
      try { m = JSON.parse(String(args.msg || '')); } catch (e) {}
      if (m && m.swap_out_recipient === FEE) return true;
    }
  }
  return false;
}
function decode(T) {
  const tx = T.transaction || {};
  const selfTx = tx.signer_id === FEE;
  const first = (tx.actions || [])[0];
  const launch = tx.receiver_id === FACTORY && first && first.FunctionCall && first.FunctionCall.method_name === 'create_token';
  const viaRef = asksFee(T);
  const out = [];
  for (const R of (T.receipts || [])) {
    const r = R.receipt || {}, eo = R.execution_outcome || {}, o = eo.outcome || {};
    const A = r.receipt && r.receipt.Action;
    if (!A || !okStatus(o.status)) continue;
    if (r.predecessor_id === 'system') continue;
    const ms = Math.floor(Number(eo.block_timestamp || r.block_timestamp || 0) / 1e6);
    const tag = selfTx ? 's' : '';
    for (const a of (A.actions || [])) {
      if (a && a.Transfer && r.receiver_id === FEE) {
        out.push([r.receipt_id, ms, r.predecessor_id, 'near', String(a.Transfer.deposit || '0'), '',
          tag || (launch && r.predecessor_id === FACTORY ? 'm' : '')]);
      }
      const f = a && a.FunctionCall;
      if (f && f.method_name === 'ft_transfer') {
        const args = b64json(f.args);
        if (args && args.receiver_id === FEE) {
          const swapFee = !tag && viaRef && r.predecessor_id === REF && r.receiver_id === WNEAR;
          out.push([r.receipt_id, ms, swapFee ? tx.signer_id : r.predecessor_id, r.receiver_id, String(args.amount || '0'),
            String(args.memo == null ? '' : args.memo).slice(0, 200), swapFee ? 't' : tag]);
        }
      }
    }
  }
  return out;
}

async function build(cache) {
  const mapKey = new Request('https://lumoscore.internal/lxapi/nearfees/' + VER + '/map');
  let map = {};
  const hit = await cache.match(mapKey);
  if (hit) { try { map = await hit.json(); } catch (e) { map = {}; } }
  const dec = map['~dec'] || {};

  // The index. A failure here throws, and the caller answers ok:false.
  const idx = await post('account', { account_id: FEE });
  if (!idx || !Array.isArray(idx.account_txs)) throw new Error('index');
  const list = idx.account_txs.filter((x) => x && x.transaction_hash)
    .sort((a, b) => Number(b.tx_block_height) - Number(a.tx_block_height));
  // The index answers in pages. If it holds more than it sent, the rest were not read: say so rather than paging blind.
  const truncated = Number(idx.txs_count) > list.length;

  const todo = list.map((x) => x.transaction_hash).filter((h) => !(h in map)).slice(0, PER_RUN);
  let fresh = 0;
  for (let i = 0; i < todo.length; i += BATCH) {
    let g = null;
    try { g = await post('transactions', { tx_hashes: todo.slice(i, i + BATCH) }); } catch (e) { break; }   // 429: stop, partial
    for (const T of ((g && g.transactions) || [])) {
      const h = T && T.transaction && T.transaction.hash;
      if (!h) continue;
      map[h] = decode(T); fresh++;
    }
  }

  const rows = [];
  let self = 0, unscaled = 0;
  const want = {};
  for (const x of list) for (const e of (map[x.transaction_hash] || [])) if (e[3] !== 'near' && !DEC[e[3]] && !dec[e[3]]) want[e[3]] = 1;
  for (const id of Object.keys(want).slice(0, 8)) { const m = await meta(id); if (m) { dec[id] = m; fresh++; } }

  for (const x of list) {
    const es = map[x.transaction_hash];
    if (!es) continue;
    for (const e of es) {
      if (e[6] === 's') { self++; continue; }
      const nat = e[3] === 'near';
      const m = nat ? { s: 'NEAR', d: 24 } : (DEC[e[3]] || dec[e[3]]);
      const amt = m ? scaled(e[4], m.d) : null;
      // A receipt we cannot put a number on is not dropped: it makes the answer partial, so the page says NEAR is
      // incomplete instead of quietly reporting less.
      if (amt == null) { unscaled++; continue; }
      const row = { chain: 'near', id: e[0], transaction_hash: x.transaction_hash, type: 'payment', from: e[2], to: FEE,
        memo: e[5], amount: amt, asset_type: nat ? 'native' : 'nep141', asset_code: nat ? 'NEAR' : m.s, asset_issuer: nat ? '' : e[3],
        created_at: new Date(e[1] || Math.floor(Number(x.tx_block_timestamp) / 1e6)).toISOString() };
      if (e[6] === 'm') row.lxkind = 'mint';
      if (e[6] === 't') row.lxkind = 'trade';
      rows.push(row);
    }
  }
  rows.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

  if (fresh) {
    map['~dec'] = dec;
    await cache.put(mapKey, new Response(JSON.stringify(map), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=' + MAP_TTL } }));
  }
  const behind = list.filter((x) => !(x.transaction_hash in map)).length;
  const partial = truncated || behind > 0 || unscaled > 0;
  const body = { ok: true, at: Date.now(), account: FEE, txs: list.length, rows, self };
  if (partial) { body.partial = true; body.behind = behind; body.unscaled = unscaled; if (truncated) body.truncated = true; }
  return body;
}

export async function onRequestGet(context) {
  const cache = caches.default;
  const fresh = new Request('https://lumoscore.internal/lxapi/nearfees/' + VER + '/fresh');
  const hit = await cache.match(fresh);
  if (hit) return json(await hit.json(), 60);
  try {
    const body = await build(cache);
    // Only a COMPLETE answer is kept for minutes. A partial one is still being caught up on: the next call decodes more.
    if (!body.partial) context.waitUntil(cache.put(fresh, new Response(JSON.stringify(body),
      { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=' + TTL } })));
    return json(body, body.partial ? 0 : 60);
  } catch (e) {
    return json({ ok: false, error: 'NEAR fee history unavailable' }, 0);
  }
}
