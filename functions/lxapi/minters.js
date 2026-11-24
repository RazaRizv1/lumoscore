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

export async function onRequestGet({ request, env }) {
  const kv = env && env.CONTENT_KV;
  if (!kv) return json({ ok: false, error: 'no kv' }, 500);
  const u = new URL(request.url);
  if (u.searchParams.get('all')) return json({ ok: true, admin: await getMap(kv, ADMIN) }, 200);
  const net = u.searchParams.get('net') || '', id = normId(net, String(u.searchParams.get('id') || '').trim());
  if (!NETS[net] || !id || id.length > 120) return json({ ok: false, error: 'bad request' }, 400);
  const key = net + '|' + id;
  const adm = await getMap(kv, ADMIN);
  const answer = async (m, source) => {
    const body = { ok: true, minter: m, source };
    if (net === 'xrpl' && m) body.receivable = await xrplReceivable(m);
    return json(body, 200, 300);
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
