// The ten tools the /mcp page promises, split by what this server can honestly do alone.
//
// READS return live data from the endpoints that already serve lumoscore.com, so an agent and a
// visitor see the same numbers.
//
// WRITES DO NOT SIGN. They validate the request, then hand back a link that opens the prepared action
// in LumosCore where the person approves it in their own wallet. That is not a limitation worked
// around -- it is the design. An MCP server runs inside an agent loop, so a key here is a key an AI
// can spend unattended. Every field is checked before the link is built, so a malformed request fails
// here with a reason rather than in a wallet the user has already been asked to trust.
import { api, horizon, parseAsset, G_RE, web, ApiError } from './api.js';

const nf = (n, d = 7) => (n == null || !isFinite(n) ? null : +(+n).toFixed(d));

// ---- reads ------------------------------------------------------------------------------------

async function getMarket({ asset }) {
  const a = parseAsset(asset);
  if (!a) return fail(`"${asset}" is not an asset id. Use CODE-ISSUER (e.g. SHX-GDSTRSHX…) or XLM.`);
  if (a.id === 'native') return fail('XLM is the quote asset here; ask for an asset priced against it.');
  const d = await api('/lxapi/dexassets?a=' + encodeURIComponent(a.id));
  const row = d && d.a && d.a[a.id];
  if (!row) return fail(`No market data for ${a.code}. It may not be traded on the Stellar DEX.`);
  return ok({
    asset: a.id, code: a.code, issuer: a.issuer,
    price_xlm: nf(row.px), price_24h_ago_xlm: nf(row.pc), change_24h_pct: nf(row.chg, 2),
    volume_24h_xlm: nf(row.vol, 2), high_24h_xlm: nf(row.high), low_24h_xlm: nf(row.low),
    trades_24h: row.trades ?? null,
    source: 'Stellar DEX via lumoscore.com', page: web('/trade/stellar/' + a.id),
  });
}

// /lxapi/pools answers {page,per,total,rows:[…]}, and each side is an OBJECT {code,issuer,amount},
// not a "CODE-ISSUER" string. Both cost me a wrong first version: a probe that hunted for "the array"
// and printed its keys hid the nesting AND the shape of a and b, and the tool returned zero pools
// while the endpoint was serving twenty-five. Read the record, not a summary of it.
const sideId = (s) => (!s ? null : (s.issuer ? `${s.code}-${s.issuer}` : (String(s.code).toUpperCase() === 'XLM' ? 'native' : s.code)));

async function listPools({ limit = 20, asset }) {
  const d = await api('/lxapi/pools');
  const list = Array.isArray(d) ? d : (Array.isArray(d && d.rows) ? d.rows : []);
  const want = asset ? parseAsset(asset) : null;
  if (asset && !want) return fail(`"${asset}" is not an asset id. Use CODE-ISSUER or XLM.`);
  const hit = (s) => {
    if (!want || !s) return !want;
    if (want.id === 'native') return String(s.code || '').toUpperCase() === 'XLM';
    return `${s.code}-${s.issuer}` === want.id;
  };
  const out = list.filter((p) => !want || hit(p.a) || hit(p.b))
    .slice(0, Math.max(1, Math.min(100, +limit || 20)));
  return ok({
    count: out.length, of: list.length, total_pools: (d && d.total) ?? list.length,
    pools: out.map((p) => ({
      id: p.id,
      pair: `${(p.a || {}).code || '?'} / ${(p.b || {}).code || '?'}`,
      a: sideId(p.a), b: sideId(p.b),
      reserve_a: nf((p.a || {}).amount, 4), reserve_b: nf((p.b || {}).amount, 4),
      tvl_usd: nf(p.tvl, 2), volume_24h_usd: nf(p.vol24, 2),
      fee_bps: p.fee ?? null, participants: p.members ?? null,
      page: web('/pools/stellar/' + encodeURIComponent(sideId(p.a) || '') + '/' + encodeURIComponent(sideId(p.b) || '')),
    })),
  });
}

async function getPortfolio({ address }) {
  if (!G_RE.test(String(address || '').trim())) return fail('address must be a Stellar public key (G… , 56 characters).');
  const acct = await horizon('/accounts/' + address);
  if (!acct) return ok({ address, funded: false, note: 'This account does not exist on Stellar mainnet yet — it holds nothing until it is funded.' });
  // A liquidity_pool_shares balance carries NO asset_code or asset_issuer -- it is identified by its
  // pool id. Treating every non-native balance as code+issuer produced rows reading
  // "undefined-undefined", which an agent would happily repeat back as the name of a holding.
  const balances = (acct.balances || []).map((b) => {
    const pool = b.asset_type === 'liquidity_pool_shares';
    return {
      asset: b.asset_type === 'native' ? 'XLM' : (pool ? `pool:${b.liquidity_pool_id}` : `${b.asset_code}-${b.asset_issuer}`),
      code: b.asset_type === 'native' ? 'XLM' : (pool ? 'POOL SHARES' : b.asset_code),
      balance: nf(b.balance),
      kind: pool ? 'pool_shares' : (b.asset_type === 'native' ? 'native' : 'trustline'),
      liquidity_pool_id: b.liquidity_pool_id || undefined,
    };
  });
  let offers = [];
  try {
    const o = await horizon('/accounts/' + address + '/offers?limit=200');
    offers = (((o || {})._embedded || {}).records || []).map((r) => ({
      id: r.id, selling: assetStr(r.selling), buying: assetStr(r.buying),
      amount: nf(r.amount), price: nf(+r.price),
    }));
  } catch (_) { offers = []; }   // offers are a bonus; a failure must not lose the balances
  return ok({
    address, funded: true,
    balances, open_orders: offers,
    pool_positions: balances.filter((b) => b.kind === 'pool_shares').length,
    subentry_count: acct.subentry_count,
    page: web('/account/stellar/' + address),
  });
}

async function getQuote({ from, to, amount }) {
  const f = parseAsset(from), t = parseAsset(to);
  if (!f) return fail(`"${from}" is not an asset id. Use CODE-ISSUER or XLM.`);
  if (!t) return fail(`"${to}" is not an asset id. Use CODE-ISSUER or XLM.`);
  const amt = +amount;
  if (!isFinite(amt) || amt <= 0) return fail('amount must be a positive number.');
  if (f.id === t.id) return fail('from and to are the same asset.');
  // Horizon's own path finder is the router the DEX actually settles through, so the number returned
  // is the one a swap would get -- not an estimate assembled here.
  //
  // Built as parameters, not by patching a string. The first version assembled the query and then
  // tried to repair it with .replace(), which produced a malformed request and a flat HTTP 400 on
  // every quote -- the one tool whose whole job is a number.
  // The two sides take DIFFERENT forms, which is the part worth knowing: the source is described with
  // asset_type/code/issuer, while the destination must be `destination_assets`, a comma-separated list
  // in canonical CODE:ISSUER form. Passing the destination as a type/code/issuer trio is rejected --
  // "The request requires either a list of destination assets or a destination account" -- which is a
  // flat 400 on every quote and reads like an outage rather than a malformed request.
  const qs = new URLSearchParams({ source_amount: String(amt) });
  if (f.id === 'native') qs.set('source_asset_type', 'native');
  else {
    qs.set('source_asset_type', f.code.length > 4 ? 'credit_alphanum12' : 'credit_alphanum4');
    qs.set('source_asset_code', f.code);
    qs.set('source_asset_issuer', f.issuer);
  }
  qs.set('destination_assets', t.id === 'native' ? 'native' : `${t.code}:${t.issuer}`);
  const d = await horizon('/paths/strict-send?' + qs.toString());
  const recs = ((d || {})._embedded || {}).records || [];
  if (!recs.length) return fail(`No route found for ${amt} ${f.code} → ${t.code}. There may be no liquidity connecting them.`);
  const best = recs.reduce((x, y) => (+y.destination_amount > +x.destination_amount ? y : x));
  const outAmt = +best.destination_amount;
  return ok({
    from: f.id, to: t.id, amount_in: amt, amount_out: nf(outAmt),
    rate: nf(outAmt / amt), routes_considered: recs.length,
    hops: (best.path || []).map(assetStr),
    trading_fee_pct: 0.2,
    fee_note: 'LumosCore charges 0.2%, or 0.1% if you hold 250,000+ LUMOS. Stellar network fee is a fraction of a cent.',
    quote_source: 'Stellar Horizon strict-send path finding (the router the DEX settles through)',
    note: 'Indicative. The executed price is quoted again at signing time.',
  });
}

async function getRewards({ address }) {
  if (address && !G_RE.test(String(address).trim())) return fail('address must be a Stellar public key (G…, 56 characters).');
  return ok({
    programs: ['LP rewards', 'Holder rewards', 'Trading rewards'],
    per_round: '3,000,000 LUMOS per round, per chain',
    address: address || null,
    page: web('/rewards/stellar'),
    note: 'Eligibility and claimable amounts are computed on the Rewards page against the live ledger. '
      + 'This server does not restate them, because a reward figure that disagrees with the page is worse than a link to it.',
  });
}

// ---- writes: prepared, never signed --------------------------------------------------------------

function prepared(action, summary, url, extra) {
  return ok(Object.assign({
    action, summary,
    approve_url: url,
    signed: false,
    next_step: 'Open approve_url. LumosCore will show the prepared transaction and your wallet will ask you to sign it. '
      + 'Nothing moves until you approve it there.',
    why: 'This server never holds a key and never signs. It prepares the action and hands it back to you.',
  }, extra || {}));
}

// WHICH SCREEN CAN ACTUALLY DO THIS TRADE.
//
// Two surfaces, and they are not equivalent:
//   * the Trade-Asset page pairs ITS asset with XLM only -- its "you pay" chip is a display element
//   * the DASHBOARD swap takes any pair: both chips are pickers, and it settles through the classic
//     Horizon path payment, which is also the route that collects the platform fee correctly (the
//     reason Smart Swap was removed rather than repaired)
//
// So XLM on one side -> the trade page, prefilled. Anything else -> the dashboard swap.
//
// I got this wrong first and said an any-pair swap did not exist, because I read the page's served
// HTML and never opened it: those pickers are plain <span>s in the markup and _swapcalc.js turns them
// into pickers at runtime. Absent from the HTML is not absent from the product -- the same lesson as
// "present in the HTML is not working".
async function swap({ from, to, amount }) {
  const q = await getQuote({ from, to, amount });
  if (q.isError) return q;
  const d = JSON.parse(q.content[0].text);
  const f = parseAsset(from), t = parseAsset(to);

  if (f.id === 'native' || t.id === 'native') {
    const page = t.id === 'native' ? f.id : t.id;
    const side = t.id === 'native' ? 'sell' : 'buy';
    return prepared('swap', `Swap ${amount} ${f.code} for about ${d.amount_out} ${t.code}`,
      web(`/trade/stellar/${page}?side=${side}&amount=${amount}`),
      { quote: d, opens: 'The trade page, with the side and amount already filled in.' });
  }

  return prepared('swap', `Swap ${amount} ${f.code} for about ${d.amount_out} ${t.code}`,
    web(`/dashboard?swap=${encodeURIComponent(f.id)},${encodeURIComponent(t.id)},${amount}`),
    { quote: d,
      opens: 'The dashboard swap, with both assets and the amount already filled in.',
      route: `Settled as one path payment (${[f.code, ...d.hops.map((h) => String(h).split('-')[0]), t.code].join(' → ')}), not as two trades.` });
}

async function addLiquidity({ a, b, amount_a, amount_b }) {
  const A = parseAsset(a), B = parseAsset(b);
  if (!A) return fail(`"${a}" is not an asset id.`);
  if (!B) return fail(`"${b}" is not an asset id.`);
  if (!(+amount_a > 0) || !(+amount_b > 0)) return fail('amount_a and amount_b must both be positive.');
  return prepared('add_liquidity', `Deposit ${amount_a} ${A.code} and ${amount_b} ${B.code} into the ${A.code} / ${B.code} pool`,
    web(`/pools/stellar/${encodeURIComponent(A.id)}/${encodeURIComponent(B.id)}`),
    { note: 'A new pool position also needs a trustline, which reserves 0.5 XLM.' });
}

async function removeLiquidity({ a, b }) {
  const A = parseAsset(a), B = parseAsset(b);
  if (!A || !B) return fail('a and b must both be asset ids (CODE-ISSUER or XLM).');
  return prepared('remove_liquidity', `Withdraw your position from the ${A.code} / ${B.code} pool`,
    web(`/pools/stellar/${encodeURIComponent(A.id)}/${encodeURIComponent(B.id)}`));
}

async function bridge({ asset, to_network, amount, recipient }) {
  if (!asset || !to_network) return fail('asset and to_network are required.');
  if (!(+amount > 0)) return fail('amount must be positive.');
  if (!recipient) return fail('recipient is required — the address that receives the assets on the destination chain.');
  return prepared('bridge', `Bridge ${amount} ${asset} from Stellar to ${to_network}`, web('/bridge/stellar'),
    { recipient, to_network,
      note: 'LumosCore routes through Circle CCTP, LayerZero, NEAR Intents or Axelar depending on the '
        + 'destination — Axelar is the corridor that reaches the XRP Ledger. '
        + 'The route and its fee are shown before you approve.' });
}

async function launchToken({ code, supply }) {
  if (!/^[A-Za-z0-9]{1,12}$/.test(String(code || ''))) return fail('code must be 1-12 letters or digits — a Stellar asset code.');
  if (!(+supply > 0)) return fail('supply must be positive.');
  return prepared('launch_token', `Issue ${supply} ${code} on Stellar`, web('/launchpad'),
    { note: 'Issuing a token is a multi-step signed flow: create the issuer, set metadata, mint, then optionally seed liquidity.' });
}

// ---- plumbing -----------------------------------------------------------------------------------

function codeOf(s) { return String(s || '') === 'native' ? 'XLM' : String(s || '').split('-')[0]; }
function assetStr(a) { return !a || a.asset_type === 'native' ? 'XLM' : `${a.asset_code}-${a.asset_issuer}`; }
function ok(obj) { return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] }; }
function fail(msg) { return { isError: true, content: [{ type: 'text', text: msg }] }; }

export const TOOLS = [
  { name: 'get_market', title: 'Live price and 24h stats for a Stellar asset',
    schema: { asset: { type: 'string', description: 'CODE-ISSUER, e.g. SHX-GDSTRSHX…' } }, required: ['asset'], run: getMarket },
  { name: 'list_pools', title: 'Liquidity pools by TVL, optionally filtered to one asset',
    schema: { limit: { type: 'number', description: 'Max pools to return (default 20)' }, asset: { type: 'string', description: 'Only pools containing this asset' } }, required: [], run: listPools },
  { name: 'get_portfolio', title: 'Balances, pool positions and open orders for a Stellar account',
    schema: { address: { type: 'string', description: 'Stellar public key (G…)' } }, required: ['address'], run: getPortfolio },
  { name: 'get_quote', title: 'Best-route price for a swap, from Stellar path finding',
    schema: { from: { type: 'string' }, to: { type: 'string' }, amount: { type: 'number' } }, required: ['from', 'to', 'amount'], run: getQuote },
  { name: 'get_rewards', title: 'Where to check and claim LUMOS rewards',
    schema: { address: { type: 'string', description: 'Stellar public key (optional)' } }, required: [], run: getRewards },
  { name: 'swap', title: 'Prepare a swap for you to approve (does not sign)',
    schema: { from: { type: 'string' }, to: { type: 'string' }, amount: { type: 'number' } }, required: ['from', 'to', 'amount'], run: swap },
  { name: 'add_liquidity', title: 'Prepare an AMM deposit for you to approve (does not sign)',
    schema: { a: { type: 'string' }, b: { type: 'string' }, amount_a: { type: 'number' }, amount_b: { type: 'number' } }, required: ['a', 'b', 'amount_a', 'amount_b'], run: addLiquidity },
  { name: 'remove_liquidity', title: 'Prepare an AMM withdrawal for you to approve (does not sign)',
    schema: { a: { type: 'string' }, b: { type: 'string' } }, required: ['a', 'b'], run: removeLiquidity },
  { name: 'bridge', title: 'Prepare a cross-chain transfer for you to approve (does not sign)',
    schema: { asset: { type: 'string' }, to_network: { type: 'string' }, amount: { type: 'number' }, recipient: { type: 'string' } }, required: ['asset', 'to_network', 'amount', 'recipient'], run: bridge },
  { name: 'launch_token', title: 'Prepare a token issuance for you to approve (does not sign)',
    schema: { code: { type: 'string' }, supply: { type: 'number' } }, required: ['code', 'supply'], run: launchToken },
];

export { ApiError };
