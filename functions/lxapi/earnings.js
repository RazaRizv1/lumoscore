// /lxapi/earnings?net=stellar|xrpl|near&addr=<wallet> -- "My Earnings" on Trade (RAZA 2026-11-24): what a Launchpad
// minter has received as their 30% share of LumosCore's fee, paid inside each trade (see minters.js).
//   -> { ok, tokens: [id], rows: [{ at, amount, unit, token, tx }], total, unit, scanned, partial }
// Read from the chain, nothing stored about the trader:
//   Stellar  native payments TO the wallet in a transaction that also pays the LumosCore fee collector
//   XRPL     XRP Payments TO the wallet carrying the LumosCore memo (the fee memo the swap screens attach)
//   NEAR     no community Launchpad tokens exist yet -- an empty list until they do
// Tokens are the Launchpad mints whose minter (admin entry, else chain) is this wallet. Answer cached 5 minutes.
const H = 'https://horizon.stellar.org';
const STELLAR_COLLECTOR = 'GAMZFXIJD5E3PNRFCG6VPXCJNUOZAP5BY2P3MU3ZXXUSVM2UY5P6LJKD';
const RPCS = ['https://xrplcluster.com/', 'https://s1.ripple.com:51234/', 'https://s2.ripple.com:51234/'];
const LUMOS_MEMO = '4C756D6F73436F7265';   // "LumosCore", hex
const RE = { stellar: /^G[A-Z2-7]{55}$/, xrpl: /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/, near: /^[a-z0-9._-]{2,64}$/ };

function json(body, secs) {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json',
    'cache-control': secs ? 'public, max-age=' + secs : 'no-store', 'access-control-allow-origin': '*' } });
}
async function getMap(kv, k) { try { return (await kv.get(k, 'json')) || {}; } catch (e) { return {}; } }
async function hj(u) { const r = await fetch(u); if (!r.ok) throw new Error('horizon ' + r.status); return r.json(); }
async function rpc(method, params) {
  for (const url of RPCS) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ method, params: [params || {}] }) });
      if (!r.ok) continue;
      const j = await r.json();
      if (j && j.result && j.result.status !== 'error') return j.result;
    } catch (e) { /* next */ }
  }
  throw new Error('no XRPL node answered');
}
const hexText = (h) => { try { return decodeURIComponent(String(h).replace(/(..)/g, '%$1')); } catch (e) { return ''; } };

// Tokens this wallet minted: admin entries and chain answers already worked out by /lxapi/minters.
async function tokensOf(kv, net, addr) {
  const adm = await getMap(kv, 'minters:admin'), chain = await getMap(kv, 'minters:chain');
  const out = new Set();
  for (const [k, v] of Object.entries(chain)) if (v === addr && k.indexOf(net + '|') === 0 && !adm[k]) out.add(k.slice(net.length + 1));
  for (const [k, v] of Object.entries(adm)) if (v === addr && k.indexOf(net + '|') === 0) out.add(k.slice(net.length + 1));
  return [...out];
}

async function stellarRows(addr) {
  const d = await hj(H + '/accounts/' + addr + '/payments?order=desc&limit=100');
  const cand = ((d._embedded || {}).records || []).filter((p) => p.to === addr && p.from !== addr && p.asset_type === 'native'
    && (p.type === 'payment' || p.type === 'path_payment_strict_send') && p.transaction_successful !== false).slice(0, 40);
  const rows = [];
  let i = 0;
  async function worker() {
    while (i < cand.length) {
      const p = cand[i++];
      try {
        const ops = ((await hj(H + '/transactions/' + p.transaction_hash + '/operations?limit=20'))._embedded || {}).records || [];
        if (!ops.some((o) => o.to === STELLAR_COLLECTOR)) continue;
        const swap = ops.find((o) => /path_payment/.test(o.type) && o.to === o.from);
        const tok = swap ? [swap.source_asset_code, swap.asset_code].filter((c) => c && c !== 'XLM')[0] || '' : '';
        rows.push({ at: p.created_at, amount: +p.amount, unit: 'XLM', token: tok, tx: p.transaction_hash });
      } catch (e) { /* skip one */ }
    }
  }
  await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
  return rows;
}

async function xrplRows(addr) {
  const r = await rpc('account_tx', { account: addr, limit: 200, ledger_index_min: -1, ledger_index_max: -1, forward: false });
  const rows = [];
  for (const row of (r.transactions || [])) {
    const t = row.tx || row.tx_json || {};
    if (t.TransactionType !== 'Payment' || t.Destination !== addr || t.Account === addr || typeof t.Amount !== 'string') continue;
    const memo = ((t.Memos || [])[0] || {}).Memo || {};
    if (String(memo.MemoType || '').toUpperCase() !== LUMOS_MEMO) continue;
    const m = /The (\S+) to (\S+) swap/.exec(hexText(memo.MemoData || ''));
    const tok = m ? [m[1], m[2]].filter((c) => c !== 'XRP')[0] || '' : '';
    const when = row.close_time_iso || (t.date ? new Date((t.date + 946684800) * 1000).toISOString() : '');
    rows.push({ at: when, amount: +t.Amount / 1e6, unit: 'XRP', token: tok, tx: t.hash || row.hash || '' });
  }
  return rows;
}

export async function onRequestGet({ request, env, waitUntil }) {
  const u = new URL(request.url);
  const net = u.searchParams.get('net') || '', addr = String(u.searchParams.get('addr') || '').trim();
  if (!RE[net] || !RE[net].test(addr)) return json({ ok: false, error: 'bad request' });
  const cache = caches.default, key = new Request('https://lumoscore.internal/lxapi/earnings/v1/' + net + '/' + addr);
  const hit = await cache.match(key);
  if (hit) return hit;
  const kv = env && env.CONTENT_KV;
  let tokens = [], rows = [], partial = false;
  try { tokens = kv ? await tokensOf(kv, net, addr) : []; } catch (e) {}
  try {
    if (net === 'stellar') rows = await stellarRows(addr);
    else if (net === 'xrpl') rows = await xrplRows(addr);
  } catch (e) { partial = true; }
  rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const unit = { stellar: 'XLM', xrpl: 'XRP', near: 'NEAR' }[net];
  const total = +rows.reduce((s, x) => s + x.amount, 0).toFixed(7);
  const res = json({ ok: true, net, tokens, rows, total, unit, partial }, partial ? 0 : 300);
  if (!partial) { const put = cache.put(key, res.clone()); if (waitUntil) waitUntil(put); else await put; }
  return res;
}
