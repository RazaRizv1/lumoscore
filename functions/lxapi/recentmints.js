// GET /lxapi/recentmints?net=stellar|xrpl|near -- the 10 newest LumosCore Launchpad tokens on one network, for the
// "Recent Mints" panel on the Trade main page (RAZA 2026-11-24).
//
//   -> { ok, net, at, rows: [{ id, code, born, minter, mcap, trades24, vol24, last: { side: 'buy'|'sell', t } | null }] }
//      mcap and vol24 in USD (null when unknown); trades24 / vol24 cover ALL trading of the token on its network in the
//      last 24 hours (not only LumosCore's); last = the most recent trade, from the trader's side.
//
// Sources, per network (all public chain data or our own cached endpoints):
//   Stellar  ids = KV assets:mints. Launch time + minter = the issuer's FIRST operation (create_account: its funder is
//            the wallet that launched it, its created_at the launch) -- kept in KV once found, a mint never changes.
//            Supply = Horizon /assets (all four buckets). Trades = Horizon /trades against XLM (pool trades included).
//   XRPL     ids = KV mintmeta:xrpl. Launch time + minter = the issuer's first transaction (the launchpad funds it).
//            Trades = our /lxapi/xrplhistory (xrpl.to fills); market cap = /lxapi/xrpltoken's.
//   NEAR     ids = KV mints:near (the factory's tokens, in launch order). Minter = minters:chain. Price + supply =
//            /lxapi/neartoken; trades = /lxapi/neartokentrades.
// Cached 30 s for everyone (the panel polls); one token that cannot be read is a row with nulls, never a failed answer.
const H = 'https://horizon.stellar.org';
const XR = ['https://xrplcluster.com/', 'https://s1.ripple.com:51234/'];
const META = 'rm:meta';   // { "<net>|<id>": { born, minter } }
const DAY = 86400000;
const LAUNCHPAD_XRPL = 'rLgbG2dUJBvC3uifB8zcCRWUSVXFcSZ2DJ';   // funds every XRPL Launchpad issuer: never "the minter"

function json(body, secs) {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=' + (secs || 0), 'access-control-allow-origin': '*' } });
}
async function getJ(u, init) { const r = await fetch(u, init); if (!r.ok) throw new Error('http ' + r.status); return r.json(); }
async function rpc(method, params) {
  for (const u of XR) {
    try { const j = await getJ(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ method, params: [params] }) }); if (j && j.result && j.result.status !== 'error') return j.result; } catch (e) {}
  }
  throw new Error('xrpl');
}
// 24h price change from trades listed NEWEST FIRST as {t, px}: the latest price against the last price from before the
// window (or, for a token whose whole history fits in it, its first trade). No trade in the window = unchanged (0).
function change24(list, now) {
  const p = list.filter((x) => x.px > 0 && x.t > 0); if (!p.length || now - p[0].t > DAY) return p.length ? 0 : null;
  let ref = p.find((x) => now - x.t > DAY); if (!ref) ref = p[p.length - 1];
  return ref.px > 0 ? (p[0].px / ref.px - 1) * 100 : null;
}
const split = (id) => { const i = id.lastIndexOf('-'); return [id.slice(0, i), id.slice(i + 1)]; };
function xcur(c) { if (c.length <= 3) return c; let h = ''; for (const ch of c) h += ch.charCodeAt(0).toString(16).toUpperCase(); return h.padEnd(40, '0'); }

// ---- Stellar --------------------------------------------------------------------------------------------------------
async function stellarMeta(id) {
  const [, iss] = split(id);
  const r = await fetch(H + '/accounts/' + iss + '/operations?order=asc&limit=1');
  if (r.status === 404) return null;   // issuer no longer exists (19 old mints): an answer, not an error
  if (!r.ok) throw new Error('http ' + r.status);
  const d = await r.json();
  const o = ((d._embedded || {}).records || [])[0];
  if (!o) return null;
  return { born: Date.parse(o.created_at) || 0, minter: o.type === 'create_account' ? (o.funder || o.source_account) : (o.source_account || '') };
}
async function stellarRow(id, xlmUsd) {
  const [code, iss] = split(id), at = code.length <= 4 ? 'credit_alphanum4' : 'credit_alphanum12';
  const q = 'asset_type=' + at + '&asset_code=' + code + '&asset_issuer=' + iss;
  const [a, t] = await Promise.all([
    getJ(H + '/assets?asset_code=' + code + '&asset_issuer=' + iss).catch(() => null),
    getJ(H + '/trades?base_' + q.split('&').join('&base_') + '&counter_asset_type=native&order=desc&limit=100').catch(() => null),
  ]);
  const rec = a && a._embedded && a._embedded.records && a._embedded.records[0];
  const supply = rec ? ((+((rec.balances || {}).authorized) || 0) + (+rec.liquidity_pools_amount || 0) + (+rec.claimable_balances_amount || 0) + (+rec.contracts_amount || 0)) || (+rec.amount || 0) : 0;
  const trades = (t && t._embedded && t._embedded.records) || [];
  const now = Date.now(); let n = 0, vol = 0, last = null, px = 0; const pl = [];
  for (const r of trades) {
    const tokIsBase = r.base_asset_code === code && r.base_asset_issuer === iss;
    const tok = tokIsBase ? +r.base_amount : +r.counter_amount, xlm = tokIsBase ? +r.counter_amount : +r.base_amount;
    if (!px && tok > 0 && xlm > 0) px = xlm / tok;
    const ts = Date.parse(r.ledger_close_time) || 0;
    if (tok > 0 && xlm > 0) pl.push({ t: ts, px: xlm / tok });
    // base_is_seller: the MAKER sold the base asset, so the trader (taker) BOUGHT it -- the rule the Trade-asset
    // Exchanges tab uses (_dexassetdata.js, measured on a live AQUA/XLM book). Token as base: true = buy; XLM as base: true = sell.
    const side = (tokIsBase === !!r.base_is_seller) ? 'buy' : 'sell';
    if (!last) last = { side, t: ts };
    if (now - ts <= DAY) { n++; vol += xlm; }
  }
  // 100 trades read and every one inside the day: there are more -- a floor ("100+"), and its volume is a floor too.
  const capped = trades.length >= 100 && n >= trades.length;
  return { mcap: supply > 0 && px > 0 && xlmUsd > 0 ? supply * px * xlmUsd : null, trades24: t ? n : null, capped, vol24: t && xlmUsd > 0 ? vol * xlmUsd : null, last, change24: t ? change24(pl, now) : null };
}

// ---- XRPL -----------------------------------------------------------------------------------------------------------
async function xrplMeta(id) {
  const [, iss] = split(id);
  const r = await rpc('account_tx', { account: iss, forward: true, limit: 3, ledger_index_min: -1, ledger_index_max: -1 });
  for (const row of (r.transactions || [])) {
    const t = row.tx || row.tx_json || {};
    if (t.TransactionType === 'Payment' && t.Destination === iss) return { born: (Number(t.date) + 946684800) * 1000, minter: t.Account };
  }
  return null;
}
async function xrplRow(id, origin, xrpUsd) {
  const [code, iss] = split(id), cur = xcur(code);
  const [h, tk] = await Promise.all([
    getJ(origin + '/lxapi/xrplhistory?iss=' + encodeURIComponent(iss) + '&cur=' + encodeURIComponent(cur) + '&n=100&p=0').catch(() => null),
    getJ(origin + '/lxapi/xrpltoken?id=' + encodeURIComponent(iss + '-' + cur)).catch(() => null),
  ]);
  const rows = (h && h.ok && h.rows) || [];
  const now = Date.now(); let n = 0, vol = 0, last = null; const pl = [];
  for (const r of rows) {
    const buy = r.got && r.got.i === iss, xrp = (r.paid && r.paid.c === 'XRP') ? +r.paid.v : ((r.got && r.got.c === 'XRP') ? +r.got.v : 0);
    const tokAmt = buy ? +(r.got && r.got.v) : +(r.paid && r.paid.v);
    if (xrp > 0 && tokAmt > 0) pl.push({ t: +r.t || 0, px: xrp / tokAmt });
    if (!last) last = { side: buy ? 'buy' : 'sell', t: +r.t || 0 };
    if (now - (+r.t || 0) <= DAY) { n++; vol += xrp; }
  }
  const mcap = tk && tk.ok ? (+tk.marketcap > 0 ? +tk.marketcap : (+tk.usd > 0 && +tk.circulating > 0 ? +tk.usd * +tk.circulating : null)) : null;
  return { mcap, trades24: h && h.ok ? n : null, capped: rows.length >= 100 && n >= rows.length, vol24: h && h.ok && xrpUsd > 0 ? vol * xrpUsd : null, last, change24: h && h.ok ? change24(pl, now) : null };
}

// ---- NEAR -----------------------------------------------------------------------------------------------------------
async function nearRow(contract, origin) {
  const [tk, tr] = await Promise.all([
    getJ(origin + '/lxapi/neartoken?i=' + encodeURIComponent(contract)).catch(() => null),
    getJ(origin + '/lxapi/neartokentrades?i=' + encodeURIComponent(contract)).catch(() => null),
  ]);
  const rows = (tr && tr.ok && tr.rows) || [];
  const now = Date.now(); let n = 0, vol = 0, last = null;
  for (const r of rows) { if (!last) last = { side: r.side === 'sell' ? 'sell' : 'buy', t: +r.t || 0 }; if (now - (+r.t || 0) <= DAY) { n++; vol += +r.near || 0; } }
  const nearUsd = tk && tk.ok ? +tk.nearUsd || 0 : 0;
  return { mcap: tk && tk.ok && +tk.usd > 0 && +tk.supply > 0 ? +tk.usd * +tk.supply : null, trades24: tr && tr.ok ? n : null, vol24: tr && tr.ok && nearUsd > 0 ? vol * nearUsd : null, last, change24: tr && tr.ok ? change24(rows.map((r) => ({ t: +r.t || 0, px: +r.px || 0 })), now) : null };
}

export async function onRequestGet({ request, env, waitUntil }) {
  const kv = env && env.CONTENT_KV;
  const url = new URL(request.url), net = url.searchParams.get('net') || '';
  if (!kv || !/^(stellar|xrpl|near)$/.test(net)) return json({ ok: false, error: 'bad request' }, 60);
  const cache = caches.default, key = new Request(url.origin + '/lxapi/recentmints?v=1&net=' + net);
  const hit = await cache.match(key); if (hit) return hit;

  let meta = {}; try { meta = (await kv.get(META, 'json')) || {}; } catch (e) { meta = {}; }
  let ids = [];
  try {
    if (net === 'stellar') ids = ((await kv.get('assets:mints', 'json')) || []).filter((x) => /-G[A-Z2-7]{55}$/.test(x));
    else if (net === 'xrpl') ids = Object.keys((await kv.get('mintmeta:xrpl', 'json')) || {});
    else ids = ((await kv.get('mints:near', 'json')) || []).map((k) => String(k).slice(String(k).indexOf('-') + 1));
  } catch (e) { ids = []; }

  // Launch time + minter: found once per token (a few per request, so a cold list fills over a couple of calls).
  let found = 0, changed = false;
  for (const id of ids) {
    const k = net + '|' + id; if (meta[k] || found >= 12) continue;
    try {
      let m = null;
      if (net === 'stellar') m = await stellarMeta(id);
      else if (net === 'xrpl') m = await xrplMeta(id);
      else {
        let chain = {}; try { chain = (await kv.get('minters:chain', 'json')) || {}; } catch (e) {}
        m = { born: ids.indexOf(id) + 1, minter: chain['near|' + id] || '' };   // NEAR: launch ORDER (the factory list's own)
      }
      // nothing to find (an issuer with no history, e.g. merged away) is an answer too: remember it, or it is asked
      // again on every call and the list never caches
      meta[k] = m || { born: 0, minter: '', none: 1 }; changed = true;
      found++;
    } catch (e) { /* asked again next time */ }
  }
  if (changed) { try { await kv.put(META, JSON.stringify(meta)); } catch (e) {} }

  let mc = {}, ma = {};
  try { mc = (await kv.get('minters:chain', 'json')) || {}; ma = (await kv.get('minters:admin', 'json')) || {}; } catch (e) {}
  const top = ids.filter((id) => meta[net + '|' + id] && !meta[net + '|' + id].none).sort((a, b) => (meta[net + '|' + b].born || 0) - (meta[net + '|' + a].born || 0)).slice(0, 10);
  let px = 0;
  try {
    if (net === 'stellar') px = +(await getJ(url.origin + '/lxapi/xlm')).usd || 0;
    else if (net === 'xrpl') px = +(await getJ(url.origin + '/lxapi/xrpltoken?id=XRP')).usd || 0;
  } catch (e) { px = 0; }
  const rows = await Promise.all(top.map(async (id) => {
    const m = meta[net + '|' + id];
    let r = { mcap: null, trades24: null, vol24: null, last: null };
    try { r = net === 'stellar' ? await stellarRow(id, px) : (net === 'xrpl' ? await xrplRow(id, url.origin, px) : await nearRow(id, url.origin)); } catch (e) {}
    const code = net === 'near' ? id.split('.')[0].toUpperCase() : split(id)[0];
    // "Minted by": the minter on record (chain answer, then an admin payout entry). The issuer's funder only stands in on
    // Stellar, where the minter's own wallet funds it; every XRPL Launchpad issuer was funded by the launchpad wallet.
    const k2 = net + '|' + id;
    let who = (mc[k2] && mc[k2] !== LAUNCHPAD_XRPL) ? mc[k2] : (ma[k2] || (net === 'stellar' ? m.minter : ''));
    if (who === LAUNCHPAD_XRPL) who = '';
    return Object.assign({ id, code, born: m.born, minter: who }, r);
  }));
  // A list whose launch dates are not all known yet may be missing the newest token (it can sit late in the list):
  // never cache that, so the next call carries on filling it in (shipped 2026-11-24 without this: JENSEN was missing).
  const pending = ids.some((id) => !meta[net + '|' + id]);
  const res = json({ ok: true, net, at: Date.now(), rows, complete: !pending }, pending ? 0 : 30);
  if (!pending) { try { const p = cache.put(key, res.clone()); if (waitUntil) waitUntil(p); else await p; } catch (e) {} }
  return res;
}
