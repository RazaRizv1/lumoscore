// /lxapi/minters -- who minted a LumosCore Launchpad token (RAZA 2026-11-24: the minter gets 30% of LumosCore's fee on
// every LumosCore trade of the token, paid inside the trade). See memory minter-fee-share-feature.
//
//   GET  ?net=stellar|xrpl|near&id=<CODE-ISSUER | contract>   -> { ok, minter: '<address>' | null, source }
//   GET  ?all=1                                               -> { ok, admin: {net:id -> addr} }   (admin page)
//   POST { op:'set', net, id, addr } | { op:'clear', net, id }  ADMIN ONLY -- a payout address entered by hand, for
//        tokens minted before this existed or whose team asked for a different wallet. Wins over the chain.
//
// Where the chain answer comes from, the same proof each network's mint registration already checks:
//   Stellar  the mint transaction (stored as txHash in mintmeta:<id>) -- its source account signed the mint
//   XRPL     the account that funded the issuer (creatorOf in xrplmintmeta.js), for ids registered as xrplmint:<id>
//   NEAR     not derivable cheaply (the factory keeps the minter only in a log line) -- admin entries until mints
//            record it
// A token that is not a LumosCore mint answers minter:null, so a trade pays nothing extra. Chain answers are kept
// in KV once found (a mint's signer never changes); a lookup that fails is never stored.
import { requireAdmin } from '../../_lib/adminauth.js';
import { audit } from '../../_lib/audit.js';
import { validAddr, normAddr } from '../../_lib/testwallets.js';

const H = 'https://horizon.stellar.org';
const RPCS = ['https://xrplcluster.com/', 'https://s1.ripple.com:51234/', 'https://s2.ripple.com:51234/'];
const ADMIN = 'minters:admin';     // {"net|id": addr}
const CHAIN = 'minters:chain';     // {"net|id": addr}
const NETS = { stellar: 1, xrpl: 1, near: 1 };

function json(body, status, secs) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: { 'content-type': 'application/json',
    'cache-control': secs ? 'public, max-age=' + secs : 'no-store', 'access-control-allow-origin': '*' } });
}
async function getMap(kv, k) { try { return (await kv.get(k, 'json')) || {}; } catch (e) { return {}; } }
// ONE SPELLING PER XRPL TOKEN (2026-11-24). The ledger carries a code longer than 3 characters as 40 hex digits, and
// that is what the XRPL trade pages ask with ("4E50454E4755...-r4TH..."), while admin, the toml and mintmeta:xrpl
// write the plain word ("NPENGU-r4TH..."). Both spellings fold to the plain word, so a payout wallet entered in admin
// is found by the trade.
function normId(net, id) {
  if (net !== 'xrpl') return id;
  const i = id.lastIndexOf('-'); if (i < 1) return id;
  const code = id.slice(0, i);
  if (!/^[0-9A-Fa-f]{40}$/.test(code)) return id;
  let s = '';
  for (let k = 0; k < 40; k += 2) { const c = parseInt(code.slice(k, k + 2), 16); if (c === 0) break; if (c < 32 || c > 126) return id; s += String.fromCharCode(c); }
  return s.length > 3 ? s + id.slice(i) : id;
}

async function stellarMinter(kv, id) {
  let rec = null;
  try { rec = await kv.get('mintmeta:' + id, 'json'); } catch (e) {}
  if (!rec || !rec.txHash) return null;
  const r = await fetch(H + '/transactions/' + encodeURIComponent(rec.txHash));
  if (!r.ok) throw new Error('horizon ' + r.status);
  const t = await r.json();
  return t.source_account || null;
}
async function rpc(method, params) {
  for (const url of RPCS) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ method, params: [params || {}] }) });
      if (!r.ok) continue;
      const j = await r.json();
      if (j && j.result && j.result.status !== 'error') return j.result;
    } catch (e) { /* next node */ }
  }
  throw new Error('no XRPL node answered');
}
async function xrplMinter(kv, id) {
  let rec = null;
  try { rec = await kv.get('xrplmint:' + id, 'json'); } catch (e) {}
  if (!rec) return null;
  const issuer = id.slice(id.lastIndexOf('-') + 1);
  const r = await rpc('account_tx', { account: issuer, forward: true, limit: 5, ledger_index_min: -1, ledger_index_max: -1 });
  for (const row of (r.transactions || [])) {
    const t = row.tx || row.tx_json || {};
    if (t.TransactionType === 'Payment' && t.Destination === issuer && t.Account) return t.Account;
  }
  return null;
}

// XRPL: can this account be paid? An account with Deposit Authorization or "destination tag required" refuses a plain
// Payment, which would fail the trader's whole batch. Unknown counts as no: the trade goes ahead without the share.
async function xrplReceivable(addr) {
  try {
    const r = await rpc('account_info', { account: addr, ledger_index: 'validated' });
    const f = Number((r.account_data || {}).Flags) || 0;
    return !(f & 0x01000000) && !(f & 0x00020000);
  } catch (e) { return false; }
}

// ---- MINTER TIERS (RAZA 2026-11-24) ---------------------------------------------------------------------------------
// The minter's share of LumosCore's fee rises with the token's LIFETIME LumosCore volume, counted in USD from the moment
// this shipped (nothing traded before counts):
//     $0 30% · $100K 40% · $1M 50% · $10M 60% · $100M+ 70%
// Trades from the minter's own wallets (the launch wallet and any admin payout wallet) are not counted. The minter's own
// swaps get the tier as a discount (pages: "_pa[3]===ME" etc.). A tier never goes down: the total only grows.
//
// THE COUNTER is rebuilt from the chain, never reported by a page: every LumosCore trade pays our fee collector.
//   Stellar  the collector's payments; each one's transaction holds the swap (path payment to the payer itself), so the
//            token and its XLM side are read from the same transaction.
//   XRPL     the collector's LumosCore-memo payments; the swap is the payer's next transaction(s) in the following ledgers
//            and names the token's issuer. Trade value = (fee to us + fee to the minter) / the memo's fee rate.
//   NEAR     no community Launchpad token yet: every NEAR token answers the $0 tier until one exists.
// It advances at most once a minute, in the background of a minters lookup (every swap makes one), a bounded number of
// receipts per run (the 10 ms CPU plan), with a cursor per network in KV. Dollar values use the coin's price at the time
// the receipt is processed -- within a minute or two of the trade.
const TIERS = [[0, 0.30], [1e5, 0.40], [1e6, 0.50], [1e7, 0.60], [1e8, 0.70]];
function tierOf(usd) {
  let i = 0; for (let k = 0; k < TIERS.length; k++) if ((+usd || 0) >= TIERS[k][0]) i = k;
  const nx = TIERS[i + 1];
  return { share: TIERS[i][1], tier: i + 1, next: nx ? { at: nx[0], share: nx[1] } : null };
}
const VOL = 'minvol:';             // minvol:<net>|<id> -> { usd, n, at }
const VSTATE = 'minvol:state';     // { start, lock, st: cursor, stSeen: [hash], xl: ledger, xlSeen: [hash] }
const ST_FEE = 'GAMZFXIJD5E3PNRFCG6VPXCJNUOZAP5BY2P3MU3ZXXUSVM2UY5P6LJKD';
const XR_FEE = 'rBDV4nwHzg5ByAYJtPWrbBZnuUXSUtFr94';
const PER_RUN = 5;                 // receipts per network per run: each costs 1-2 upstream calls (Pages: 50 per request)
async function volOf(kv, net, id) { try { return (await kv.get(VOL + net + '|' + id, 'json')) || { usd: 0, n: 0, at: 0 }; } catch (e) { return { usd: 0, n: 0, at: 0 }; } }
async function addVol(kv, net, id, usd) {
  const k = VOL + net + '|' + id, v = await volOf(kv, net, id);
  v.usd = (+v.usd || 0) + usd; v.n = (+v.n || 0) + 1; v.at = Date.now();
  await kv.put(k, JSON.stringify(v));
}
async function getJ(url, init) { const r = await fetch(url, init); if (!r.ok) throw new Error('http ' + r.status); return r.json(); }
// The minter's wallets for a token: what this file answers (admin payout or the chain's launch wallet) plus the chain
// answer itself, so neither a payout change nor an admin entry lets the launch wallet's trades count.
async function minterWallets(kv, net, id) {
  const key = net + '|' + id, out = new Set();
  const adm = await getMap(kv, ADMIN), chain = await getMap(kv, CHAIN);
  if (adm[key]) out.add(adm[key]);
  let c = chain[key];
  if (!c) { try { c = net === 'stellar' ? await stellarMinter(kv, id) : (net === 'xrpl' ? await xrplMinter(kv, id) : null); } catch (e) { c = null; } }
  if (c) out.add(c);
  return out;
}
async function stellarMints(kv) { try { return new Set(((await kv.get('assets:mints', 'json')) || []).filter((x) => /-G[A-Z2-7]{55}$/.test(x))); } catch (e) { return new Set(); } }
async function xrplMintIssuers(kv) {
  const out = {};   // issuer -> CODE-issuer
  try { const m = (await kv.get('mintmeta:xrpl', 'json')) || {}; for (const k of Object.keys(m)) { const i = k.lastIndexOf('-'); out[k.slice(i + 1)] = k; } } catch (e) {}
  return out;
}
function hexText(h) { let s = ''; for (let i = 0; i + 1 < String(h || '').length; i += 2) s += String.fromCharCode(parseInt(h.slice(i, i + 2), 16)); return s; }
function lxMemo(t) {
  const ms = (t && t.Memos) || [];
  for (const m of ms) { const x = m.Memo || {}; if (hexText(x.MemoType) === 'LumosCore') return hexText(x.MemoData); }
  return null;
}

async function refreshStellar(kv, st, origin) {
  if (!st.st) {   // first run: start at the newest payment, so only what comes after counts
    const d = await getJ(H + '/accounts/' + ST_FEE + '/payments?order=desc&limit=1');
    const r = ((d._embedded || {}).records || [])[0]; st.st = r ? r.paging_token : 'now'; return;
  }
  const d = await getJ(H + '/accounts/' + ST_FEE + '/payments?order=asc&limit=50&cursor=' + encodeURIComponent(st.st));
  const recs = (d._embedded || {}).records || [];
  if (!recs.length) return;
  const mints = await stellarMints(kv);
  let px = null, done = 0;
  for (const p of recs) {
    if (done >= PER_RUN) break;
    const prev = st.st;
    st.st = p.paging_token;
    if (p.to !== ST_FEE || p.from === ST_FEE) continue;
    const h = p.transaction_hash; if ((st.stSeen || []).indexOf(h) >= 0) continue;
    st.stSeen = (st.stSeen || []).concat([h]).slice(-300); done++;
    const ops = ((await getJ(H + '/transactions/' + h + '/operations?limit=50'))._embedded || {}).records || [];
    const swap = ops.find((o) => /^path_payment_strict_(send|receive)$/.test(o.type) && o.to === p.from);
    if (!swap) continue;
    const sid = swap.source_asset_type === 'native' ? '' : swap.source_asset_code + '-' + swap.source_asset_issuer;
    const did = swap.asset_type === 'native' ? '' : swap.asset_code + '-' + swap.asset_issuer;
    const tok = mints.has(sid) ? sid : (mints.has(did) ? did : '');
    if (!tok) continue;
    const xlm = swap.source_asset_type === 'native' ? +swap.source_amount : (swap.asset_type === 'native' ? +swap.amount : 0);
    if (!(xlm > 0)) continue;                                   // token-for-token: no XLM side to value it by
    if ((await minterWallets(kv, 'stellar', tok)).has(p.from)) continue;
    if (px == null) { try { px = +(await getJ(origin + '/lxapi/xlm')).usd || 0; } catch (e) { px = 0; } }
    if (!(px > 0)) { st.st = prev; st.stSeen = st.stSeen.filter((x) => x !== h); break; }   // no price: retry this receipt next run
    await addVol(kv, 'stellar', tok, xlm * px);
  }
}

async function refreshXrpl(kv, st, origin) {
  if (!st.xl) { const r = await rpc('ledger', { ledger_index: 'validated' }); st.xl = +((r.ledger || {}).ledger_index || r.ledger_index) || 0; return; }
  const r = await rpc('account_tx', { account: XR_FEE, forward: true, limit: 20, ledger_index_min: st.xl, ledger_index_max: -1 });
  const txs = r.transactions || [];
  const iss = await xrplMintIssuers(kv);
  let px = null, done = 0, last = st.xl;
  for (const row of txs) {
    const t = row.tx || row.tx_json || {}, h = t.hash || row.hash, L = +(t.ledger_index || row.ledger_index) || 0;
    if (done >= PER_RUN) break;
    last = Math.max(last, L);
    if (t.TransactionType !== 'Payment' || t.Destination !== XR_FEE || typeof t.Amount !== 'string') continue;
    if ((st.xlSeen || []).indexOf(h) >= 0) continue;
    const memo = lxMemo(t); if (!memo) continue;
    const pm = /fee ([0-9.]+)%/.exec(memo); if (!pm || !(+pm[1] > 0)) continue;
    st.xlSeen = (st.xlSeen || []).concat([h]).slice(-300); done++;
    // The payer's transactions around it: the swap (names the issuer) and a minter payment (part of the same fee).
    const w = await rpc('account_tx', { account: t.Account, forward: true, limit: 12, ledger_index_min: L, ledger_index_max: L + 8 });
    let tok = '', minterPaid = 0, mintWallet = '';
    const amts = (x) => (x && typeof x === 'object' && x.issuer) ? [x] : [];
    for (const r2 of (w.transactions || [])) {
      const u = r2.tx || r2.tx_json || {};
      const parts = [].concat(amts(u.Amount), amts(u.SendMax), amts(u.TakerGets), amts(u.TakerPays), amts(u.DeliverMax));
      for (const a of parts) if (!tok && iss[a.issuer]) tok = iss[a.issuer];
      if (u.TransactionType === 'Payment' && typeof u.Amount === 'string' && u.Destination !== XR_FEE && lxMemo(u)) { minterPaid += (+u.Amount || 0); mintWallet = u.Destination; }
      // Batch: the inner transactions ride in the outer one.
      for (const inner of ((u.RawTransactions || []).map((x) => x.RawTransaction || {}))) {
        const ip = [].concat(amts(inner.Amount), amts(inner.SendMax), amts(inner.TakerGets), amts(inner.TakerPays));
        for (const a of ip) if (!tok && iss[a.issuer]) tok = iss[a.issuer];
        if (inner.TransactionType === 'Payment' && typeof inner.Amount === 'string' && inner.Destination !== XR_FEE && lxMemo(inner) && inner.Account === t.Account) { minterPaid += (+inner.Amount || 0); mintWallet = inner.Destination; }
      }
    }
    if (!tok) continue;
    const wallets = await minterWallets(kv, 'xrpl', tok);
    if (wallets.has(t.Account)) continue;
    if (mintWallet && !wallets.has(mintWallet)) minterPaid = 0;      // only the token's own minter is part of the fee
    const xrp = ((+t.Amount || 0) + minterPaid) / 1e6 / (+pm[1] / 100);
    if (!(xrp > 0)) continue;
    if (px == null) { try { const q = await getJ(origin + '/lxapi/xrpltoken?id=XRP'); px = +q.usd || 0; } catch (e) { px = 0; } }
    if (!(px > 0)) { st.xlSeen = st.xlSeen.slice(0, -1); return; }   // no price: retry this receipt next run
    await addVol(kv, 'xrpl', tok, xrp * px);
  }
  // Only move past ledgers whose receipts were all looked at; a capped run resumes inside the same ledger (seen-list).
  if (done < PER_RUN && txs.length < 20) st.xl = last + (txs.length ? 1 : 0); else st.xl = Math.max(st.xl, last);
}

async function refreshVolumes(kv, origin) {
  let st = {}; try { st = (await kv.get(VSTATE, 'json')) || {}; } catch (e) { st = {}; }
  if (st.lock && Date.now() - st.lock < 55000) return;
  st.lock = Date.now(); if (!st.start) st.start = Date.now();
  await kv.put(VSTATE, JSON.stringify(st));
  try { await refreshStellar(kv, st, origin); } catch (e) { /* next run retries from the same cursor */ }
  try { await refreshXrpl(kv, st, origin); } catch (e) { /* next run retries from the same ledger */ }
  await kv.put(VSTATE, JSON.stringify(st));
}

export async function onRequestGet(ctx) {
  const { request, env } = ctx;
  const kv = env && env.CONTENT_KV;
  if (!kv) return json({ ok: false, error: 'no kv' }, 500);
  const u = new URL(request.url);
  if (u.searchParams.get('all')) return json({ ok: true, admin: await getMap(kv, ADMIN) }, 200);
  const net = u.searchParams.get('net') || '', id = normId(net, String(u.searchParams.get('id') || '').trim());
  if (!NETS[net] || !id || id.length > 120) return json({ ok: false, error: 'bad request' }, 400);
  const key = net + '|' + id;
  // Every lookup nudges the counter forward (at most once a minute, in the background).
  try { if (ctx.waitUntil) ctx.waitUntil(refreshVolumes(kv, u.origin).catch(() => {})); } catch (e) {}
  const vol = await volOf(kv, net, id), tr = tierOf(vol.usd);
  const adm = await getMap(kv, ADMIN);
  const answer = async (m, source) => {
    const body = { ok: true, minter: m, source, share: tr.share, tier: tr.tier, volume: Math.round((+vol.usd || 0) * 100) / 100, next: tr.next };
    if (net === 'xrpl' && m) body.receivable = await xrplReceivable(m);
    return json(body, 200, 120);
  };
  if (adm[key]) return answer(adm[key], 'admin');
  const chain = await getMap(kv, CHAIN);
  if (chain[key]) return answer(chain[key], 'chain');
  let m = null;
  try {
    if (net === 'stellar') m = await stellarMinter(kv, id);
    else if (net === 'xrpl') m = await xrplMinter(kv, id);
  } catch (e) {
    return json({ ok: false, error: 'could not read the chain', minter: null }, 200, 0);   // not stored: try again later
  }
  if (m) { chain[key] = m; try { await kv.put(CHAIN, JSON.stringify(chain)); } catch (e) {} return answer(m, 'chain'); }
  return json({ ok: true, minter: null, source: null }, 200, 120);
}

// NEAR LAUNCH RECORD (RAZA 2026-11-24). The factory keeps a launch's owner only in its token_created log line, so the
// launch page reports {token, signer, txHash} after a successful launch and this proves it on chain before storing
// anything -- the caller is not trusted:
//   1. the token is a sub-account of the factory and on its get_tokens list;
//   2. the transaction was signed by `signer`, sent to the factory, and logged token_created for this token with
//      owner_id = signer -- or, with no hash, `signer` holds the token's WHOLE supply (true right after a launch).
// A minter already on record is never replaced from here (admin entries live separately and always win).
const NEAR_RPC = 'https://free.rpc.fastnear.com';
const NEAR_FACTORY = 'lumoscore.near';
async function nearRpc(method, params) {
  const r = await fetch(NEAR_RPC, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'lx', method, params }) });
  if (!r.ok) throw new Error('near rpc ' + r.status);
  const j = await r.json();
  if (j.error) throw new Error('near rpc error');
  return j.result;
}
async function nearView(account, method, args) {
  const res = await nearRpc('query', { request_type: 'call_function', finality: 'final', account_id: account, method_name: method,
    args_base64: btoa(JSON.stringify(args || {})) });
  return JSON.parse(String.fromCharCode.apply(null, res.result));
}
async function nearRecord(kv, b) {
  const token = String(b.token || '').trim(), signer = String(b.signer || '').trim(), hash = String(b.txHash || '').trim();
  if (!/^[a-z0-9_-]+\.lumoscore\.near$/.test(token) || !validAddr('near', signer)) return { status: 400, error: 'bad request' };
  const tokens = await nearView(NEAR_FACTORY, 'get_tokens', {});
  if (!Array.isArray(tokens) || tokens.indexOf(token) < 0) return { status: 404, error: 'not a LumosCore launch' };
  let ok = false;
  if (/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(hash)) {
    try {
      const st = await nearRpc('EXPERIMENTAL_tx_status', { tx_hash: hash, sender_account_id: signer, wait_until: 'FINAL' });
      const tx = st.transaction || {};
      if (tx.signer_id === signer && tx.receiver_id === NEAR_FACTORY) {
        for (const ro of (st.receipts_outcome || [])) {
          for (const line of ((ro.outcome || {}).logs || [])) {
            if (line.indexOf('EVENT_JSON:') !== 0) continue;
            try {
              const ev = JSON.parse(line.slice(11));
              if (ev.event === 'token_created' && (ev.data || []).some((d) => d.token_id === token && d.owner_id === signer)) ok = true;
            } catch (e) { /* not ours */ }
          }
        }
      }
    } catch (e) { /* fall through to the supply check */ }
  }
  if (!ok) {
    const [supply, bal] = await Promise.all([nearView(token, 'ft_total_supply', {}), nearView(token, 'ft_balance_of', { account_id: signer })]);
    ok = String(supply) !== '0' && String(bal) === String(supply);
  }
  if (!ok) return { status: 403, error: 'that launch could not be confirmed on NEAR' };
  const chain = await getMap(kv, CHAIN), key = 'near|' + token;
  if (!chain[key]) { chain[key] = signer; await kv.put(CHAIN, JSON.stringify(chain)); }
  // ...and the launch joins the admin's mints list, as SYMBOL-contract (see assetmeta.js ASSET_RE).
  try {
    const sym = token.split('.')[0].toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 40);
    const id = sym + '-' + token, list = (await kv.get('mints:near', 'json')) || [];
    if (sym && Array.isArray(list) && list.indexOf(id) < 0) { list.push(id); await kv.put('mints:near', JSON.stringify(list)); }
  } catch (e) { /* the minter is recorded either way */ }
  return { status: 200, minter: chain[key] };
}

export async function onRequestPost({ request, env }) {
  const kv = env && env.CONTENT_KV;
  if (!kv) return json({ ok: false, error: 'no kv' }, 500);
  let b = {};
  try { b = await request.json(); } catch (e) { return json({ ok: false, error: 'bad request' }, 400); }
  // Public, but proven on chain (see nearRecord). Everything else below is admin only.
  if (b && b.op === 'near-record') {
    try { const r = await nearRecord(kv, b); return json(r.status === 200 ? { ok: true, minter: r.minter } : { ok: false, error: r.error }, r.status); }
    catch (e) { return json({ ok: false, error: 'could not reach NEAR; try again' }, 502); }
  }
  const bad = await requireAdmin(request);
  if (bad) return bad;
  const net = String(b.net || ''), id = normId(net, String(b.id || '').trim());
  if (!NETS[net] || !id || id.length > 120) return json({ ok: false, error: 'Pick a network and give the token.' }, 400);
  const map = await getMap(kv, ADMIN), key = net + '|' + id;
  if (b.op === 'clear') { delete map[key]; await kv.put(ADMIN, JSON.stringify(map)); await audit(env, request, 'minter.clear', key, {}); return json({ ok: true }); }
  if (b.op !== 'set') return json({ ok: false, error: 'unknown op' }, 400);
  const addr = normAddr(net, b.addr);
  if (!validAddr(net, addr)) return json({ ok: false, error: 'That is not a valid ' + net + ' address.' }, 400);
  map[key] = addr;
  await kv.put(ADMIN, JSON.stringify(map));
  await audit(env, request, 'minter.set', key, { addr });
  return json({ ok: true });
}
