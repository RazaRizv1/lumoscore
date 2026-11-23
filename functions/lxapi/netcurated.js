// /lxapi/netcurated -- the XRPL and NEAR tokens curated from admin's Add asset (RAZA 2026-11-24). See _netcurated.js.
//   GET  ?net=xrpl|near                                   -> { ok, rows }   (public: the same list the site reads)
//   POST { op:'add', net:'xrpl', code, issuer }            -> { ok, row }    ADMIN ONLY
//   POST { op:'add', net:'near', contract }                -> { ok, row }    ADMIN ONLY
//   POST { op:'remove', net, id }                          -> { ok }         ADMIN ONLY  (id: ISSUER|TICKER or contract)
// An add is checked against the network first: the XRPL token must exist (xrpl.to, the source the XRPL endpoints
// already use) and the NEAR contract must answer ft_metadata. functions/ is shared with the public project, so every
// write calls requireAdmin() first. Writes are audited.
import { requireAdmin } from '../../_lib/adminauth.js';
import { audit } from '../../_lib/audit.js';
import { readNetCurated, writeNetCurated, NETCURATED_NETS } from './_netcurated.js';
import { tickerOf, currencyOf, vouchedTokens, loadVouched } from './_unvouched.js';

const NEAR_RPC = 'https://free.rpc.fastnear.com';
const XRPLTO = 'https://api.xrpl.to/api';

function json(body, status, secs) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: { 'content-type': 'application/json',
    'cache-control': secs ? 'public, max-age=' + secs : 'no-store', 'access-control-allow-origin': '*' } });
}

export async function onRequestGet({ request, env }) {
  const net = new URL(request.url).searchParams.get('net') || '';
  if (NETCURATED_NETS.indexOf(net) < 0) return json({ ok: false, error: 'unknown network' }, 400);
  return json({ ok: true, rows: await readNetCurated(env, net) }, 200, 30);
}

async function xrplToken(issuer, ticker, env) {
  const headers = { accept: 'application/json', 'user-agent': 'LumosCore/1.0 (+https://lumoscore.com)' };
  if (env && env.XRPLTO_API_KEY) headers['x-api-key'] = env.XRPLTO_API_KEY;
  const r = await fetch(XRPLTO + '/token/' + encodeURIComponent(issuer + '-' + currencyOf(ticker)), { headers });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('xrpl.to answered ' + r.status + '; try again in a minute');
  const j = await r.json();
  return (j && j.token) || null;
}

async function nearMeta(contract) {
  const body = { jsonrpc: '2.0', id: 'lx', method: 'query', params: { request_type: 'call_function', finality: 'final',
    account_id: contract, method_name: 'ft_metadata', args_base64: 'e30=' } };
  const r = await fetch(NEAR_RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('the NEAR RPC answered ' + r.status + '; try again in a minute');
  const j = await r.json();
  if (!j || j.error || !j.result || !Array.isArray(j.result.result)) return null;
  try { return JSON.parse(String.fromCharCode.apply(null, j.result.result)); } catch (e) { return null; }
}

export async function onRequestPost({ request, env }) {
  const bad = await requireAdmin(request);
  if (bad) return bad;
  if (!env || !env.CONTENT_KV) return json({ ok: false, error: 'no KV binding' }, 500);
  let b = {};
  try { b = await request.json(); } catch (e) { return json({ ok: false, error: 'bad request' }, 400); }
  const net = String(b.net || '');
  if (NETCURATED_NETS.indexOf(net) < 0) return json({ ok: false, error: 'unknown network' }, 400);
  const rows = (await readNetCurated(env, net)).slice();
  const who = request.headers.get('cf-access-authenticated-user-email') || '';

  if (b.op === 'remove') {
    const id = String(b.id || '');
    const keep = rows.filter((r) => (net === 'xrpl' ? r.issuer + '|' + r.ticker : r.i) !== id);
    if (keep.length === rows.length) return json({ ok: false, error: 'That token was not added from admin.' }, 404);
    await writeNetCurated(env, net, keep);
    await audit(env, request, 'netcurated.remove', net + ':' + id, {});
    return json({ ok: true });
  }
  if (b.op !== 'add') return json({ ok: false, error: 'unknown op' }, 400);

  try {
    if (net === 'xrpl') {
      const issuer = String(b.issuer || '').trim();
      const code = String(b.code || '').trim();
      if (!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(issuer)) return json({ ok: false, error: 'The issuer must be an XRPL account starting with r.' }, 400);
      if (!code || code.length > 40) return json({ ok: false, error: 'Enter the token code, e.g. SOLO.' }, 400);
      const ticker = tickerOf(currencyOf(code));
      await loadVouched(env);
      if (vouchedTokens().some((v) => v.issuer === issuer && v.ticker === ticker)) return json({ ok: false, error: 'That token is already curated.' }, 409);
      const t = await xrplToken(issuer, ticker, env);
      if (!t) return json({ ok: false, error: 'No such token on the XRP Ledger. Check the code and the issuer.' }, 404);
      const row = { issuer, ticker, name: String(t.name || ticker).slice(0, 60), domain: String(t.domain || '').slice(0, 120),
        added_at: Date.now(), added_by: who || null };
      rows.push(row);
      await writeNetCurated(env, net, rows);
      await audit(env, request, 'netcurated.add', 'xrpl:' + issuer + '|' + ticker, {});
      return json({ ok: true, row });
    }
    const contract = String(b.contract || '').trim().toLowerCase();
    if (!/^(?=.{2,64}$)[a-z0-9]+([_-][a-z0-9]+)*(\.[a-z0-9]+([_-][a-z0-9]+)*)*$/.test(contract)) return json({ ok: false, error: 'Enter the token contract, e.g. token.near.' }, 400);
    if (rows.some((r) => r.i === contract)) return json({ ok: false, error: 'That token is already curated.' }, 409);
    const m = await nearMeta(contract);
    if (!m || !m.symbol) return json({ ok: false, error: 'That contract is not a token on NEAR (it has no ft_metadata).' }, 404);
    const icon = String(m.icon || '');
    const row = { i: contract, s: String(m.symbol).slice(0, 24), n: String(m.name || m.symbol).slice(0, 60), d: Number(m.decimals) || 0,
      logo: icon.length <= 60000 ? icon : '', added_at: Date.now(), added_by: who || null };
    rows.push(row);
    await writeNetCurated(env, net, rows);
    await audit(env, request, 'netcurated.add', 'near:' + contract, {});
    return json({ ok: true, row });
  } catch (e) {
    return json({ ok: false, error: String(e && e.message || e) }, 502);
  }
}
