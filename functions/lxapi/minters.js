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

export async function onRequestGet({ request, env }) {
  const kv = env && env.CONTENT_KV;
  if (!kv) return json({ ok: false, error: 'no kv' }, 500);
  const u = new URL(request.url);
  if (u.searchParams.get('all')) return json({ ok: true, admin: await getMap(kv, ADMIN) }, 200);
  const net = u.searchParams.get('net') || '', id = String(u.searchParams.get('id') || '').trim();
  if (!NETS[net] || !id || id.length > 120) return json({ ok: false, error: 'bad request' }, 400);
  const key = net + '|' + id;
  const adm = await getMap(kv, ADMIN);
  if (adm[key]) return json({ ok: true, minter: adm[key], source: 'admin' }, 200, 300);
  const chain = await getMap(kv, CHAIN);
  if (chain[key]) return json({ ok: true, minter: chain[key], source: 'chain' }, 200, 300);
  let m = null;
  try {
    if (net === 'stellar') m = await stellarMinter(kv, id);
    else if (net === 'xrpl') m = await xrplMinter(kv, id);
  } catch (e) {
    return json({ ok: false, error: 'could not read the chain', minter: null }, 200, 0);   // not stored: try again later
  }
  if (m) { chain[key] = m; try { await kv.put(CHAIN, JSON.stringify(chain)); } catch (e) {} }
  return json({ ok: true, minter: m, source: m ? 'chain' : null }, 200, m ? 300 : 120);
}

export async function onRequestPost({ request, env }) {
  const bad = await requireAdmin(request);
  if (bad) return bad;
  const kv = env && env.CONTENT_KV;
  if (!kv) return json({ ok: false, error: 'no kv' }, 500);
  let b = {};
  try { b = await request.json(); } catch (e) { return json({ ok: false, error: 'bad request' }, 400); }
  const net = String(b.net || ''), id = String(b.id || '').trim();
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
