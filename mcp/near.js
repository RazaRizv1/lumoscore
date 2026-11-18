// The NEAR half of the connector: the same fourteen tools, against a third chain.
//
// WHY A THIRD FILE AND NOT A BRANCH INSIDE THE XRPL ONE. The same reason xrpl.js is not a branch
// inside tools.js, and it is sharper here, because NEAR disagrees with BOTH of the others on the one
// thing every tool touches -- what an asset IS. Stellar: a CODE plus a G-address. XRP Ledger: a
// 40-hex currency plus an r-address. NEAR: a bare CONTRACT ACCOUNT, `lumos.lumoscore.near`, with no
// code and no issuer anywhere in it. There is nothing to share below the surface, and interleaving
// three identity models inside fourteen functions is fourteen places for the wrong one to win.
//
// WHAT NEAR CANNOT DO, SAID IN THE RESPONSE RATHER THAN GUESSED AT. One tool has no NEAR surface
// and it REFUSES with the reason instead of returning a plausible shape:
//
//   * get_orderbook -- NEAR has no order book. Rhea is an AMM; there are no resting offers to read.
//     Returning an empty book would read as "no liquidity", which is a different and false claim.
//
// get_quote USED TO REFUSE here too, and no longer does (2026-11-18): it asks Rhea's own contracts the way the
// trade page does -- see "the swap quote" below.
//
// PREFILL IS PER PAGE AND IT IS MEASURED, NOT ASSUMED. Checked against live NEAR pages 2026-11-17:
// /trade/near/<contract> carries `lx-tradeprefill` and reads ?side= and ?amount=, so a swap link
// really does arrive filled in. /pools/near/* and /bridge/near carry NEITHER `lx-poolprefill` NOR
// `lx-bridgeprefill` -- those two layers shipped to Stellar and the XRPL fork and NEAR's dist is
// built from its own repo, which does not register them. So the deposit and bridge tools here say
// the amounts must be typed. Claiming a prefill that does not happen is exactly the bug this
// connector was fixed for on Stellar: a link that promises to carry the request and then drops it.
import { api, nearRpc, nearFt, web, ApiError } from './api.js';

const nf = (n, d = 7) => (n == null || !isFinite(n) ? null : +(+n).toFixed(d));

// An amount as PLAIN decimal digits for a prefill link, capped at the token's own precision.
//
// The page refuses anything that is not plain digits -- deliberately, since it is about to be
// approved -- and `lx-tradeprefill` on the NEAR page enforces the same /^[0-9]+(\.[0-9]+)?$/ that
// Stellar's does, so an exponent ("1e+21") or a stray sign silently arrives as an empty box.
//
// WHY THE DECIMALS ARGUMENT. NEAR tokens are not one precision: USDC is 6, LUMOS 18, wNEAR 24.
// Writing more decimals than a token has is a number the chain cannot represent, and 8 is the
// readable ceiling for one someone is about to approve.
//
// THE TRAILING-ZERO STRIP IS GUARDED ON THE DOT, which is not pedantry: at 0 decimals toFixed gives
// "100" and an unguarded /0+$/ turns that into "1". The XRPL version is safe only because its 6 is
// a constant that always leaves a decimal point behind.
const plainAmount = (v, dec) => {
  const n = +v;
  if (!isFinite(n) || n <= 0) return '';
  const d = Math.max(0, Math.min(8, dec == null || !isFinite(+dec) ? 8 : +dec));
  let s = n.toFixed(d);
  if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
  if (!/^[0-9]+(\.[0-9]+)?$/.test(s) || +s === 0) return '';
  return s;
};

// A raw on-chain integer to a human decimal, EXACTLY, with string arithmetic and never a division.
// A 24-decimal balance exceeds what a double can hold long before it exceeds what a string can, so
// `+raw / 1e24` loses the low digits of the very field someone sizes a transaction against.
function fromRaw(raw, dec) {
  const s = String(raw == null ? '' : raw).trim();
  if (!/^[0-9]+$/.test(s)) return null;
  const d = Math.max(0, Math.min(36, +dec || 0));
  if (!d) return s;
  const p = s.padStart(d + 1, '0');
  const whole = p.slice(0, p.length - d);
  const frac = p.slice(p.length - d).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
}

function ok(obj) { return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] }; }
function fail(msg) { return { isError: true, content: [{ type: 'text', text: msg }] }; }

const CREDIT = {
  data_source: 'Rhea Finance indexer, DexScreener, NearBlocks, FastNEAR',
  attribution: 'Pool and price data via Rhea Finance and DexScreener',
};

// ---- asset identity ------------------------------------------------------------------------------
//
// AN ASSET ON NEAR IS AN ACCOUNT. There is no issuer field and no code field: the fungible-token
// contract's own account id IS the identity, and it is what the website's urls carry
// (/trade/near/lumos.lumoscore.near). Bridged tokens are the same shape wearing a different hat --
// USDC is `17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1`, a 64-hex implicit
// account, which satisfies the account-id rules below without a special case.
//
// The official id rules, enforced rather than approximated: 2-64 characters, lowercase alphanumerics
// separated by `-`, `_` or `.`, and every part must begin and end with an alphanumeric. A loose
// /^[a-z0-9._-]+$/ would accept `.near`, `a..b` and `-x`, none of which can exist, and would hand
// them to an endpoint as if they might.
const NEAR_ID_RE = /^(([a-z\d]+[\-_])*[a-z\d]+\.)*([a-z\d]+[\-_])*[a-z\d]+$/;

export function isNearAccount(s) {
  const v = String(s || '').trim();
  return v.length >= 2 && v.length <= 64 && NEAR_ID_RE.test(v);
}

// A bridged token's implicit account: 64 lowercase hex characters, no dot.
const HEX64_RE = /^[0-9a-f]{64}$/;

// "NEAR" is the native coin. `wrap.near` is a REAL CONTRACT and parses as an ordinary token, because
// it is one -- wNEAR is what pools actually hold, and collapsing the two would make a pool's own
// composition unreportable. The two are treated as one side only where it matters: picking which
// trade page a swap opens, below.
//
// A DOTLESS NAME IS A SYMBOL, NOT A CONTRACT ID, and getting this wrong is the whole bug this
// resolver exists for. "LUMOS" lowercases to "lumos", which satisfies every NEAR account-id rule --
// so an id-first reading accepts it as a contract, asks the market endpoint about a contract that
// does not exist, and hands back /trade/near/lumos: a confident link to a 404, which is worse than
// a refusal. The two real id shapes both announce themselves: a contract account on NEAR is dotted
// (`x.near`, `x.factory.near`) because it lives under a registrar, and a bridged token is 64-hex.
// Anything else falls through to the roster as a symbol.
export function parseNearAsset(s) {
  const v = String(s || '').trim();
  if (!v) return null;
  if (/^near$/i.test(v)) return { id: 'NEAR', code: 'NEAR', native: true };
  const lower = v.toLowerCase();
  if (!isNearAccount(lower)) return null;
  if (lower.indexOf('.') < 0 && !HEX64_RE.test(lower)) return null;   // a symbol; let the roster decide
  return { id: lower, code: null, native: false };
}

const IDHINT = 'Use the token\'s contract account id (e.g. lumos.lumoscore.near, or a bridged '
  + 'token\'s 64-hex account), or NEAR for the native coin.';

// A BARE SYMBOL IS NOT AN IDENTITY HERE EITHER, and NEAR is the worst of the three for it: 3,862
// fungible tokens are live and anyone can deploy a contract calling itself anything. So a bare symbol
// resolves ONLY through the roster list_curated_assets serves -- /lxapi/nearmarket -- filtered to the
// tokens LumosCore itself vouches for (`vf`).
//
// IT DOES NOT FALL BACK TO SEARCH. /lxapi/neartokensearch would resolve far more symbols, and that is
// the problem: Rhea's newest pools include outright honeypots, and a symbol resolved out of an
// unvouched index is an asset nobody checked, handed back on a screen whose next step is a swap.
// Curated-and-vouched or refuse.
//
// A MISS IS NOT A VERDICT ON THE TOKEN. The roster is ~72 rows out of 3,862, so a symbol that does
// not resolve may still be a perfectly real asset; the message says so rather than reporting "no
// such token".
async function resolveNearSymbol(asset) {
  const sym = String(asset || '').trim();
  // A dot means they meant a contract id and it did not validate -- that is a malformed id, not a
  // symbol to look up, so it gets the shape hint instead of a roster search.
  if (!sym || sym.indexOf('.') >= 0) return { error: `"${asset}" is not a NEAR asset id. ${IDHINT}` };
  let d = null;
  try { d = await api('/lxapi/nearmarket'); } catch (_) { d = null; }
  const rows = ((d && d.rows) || []).filter((r) => +r.vf === 1);
  const hit = rows.filter((r) => String(r.n || '').toUpperCase() === sym.toUpperCase());
  if (!hit.length) {
    return { error: `No vouched token in the LumosCore roster carries the symbol "${asset}", and `
      + '"' + asset + '" is not a contract account id either — a token contract on NEAR is dotted '
      + '(lumos.lumoscore.near) or is a bridged token\'s 64-hex account. That roster is the '
      + `${rows.length || 'curated'} tokens LumosCore lists out of 3,862 fungible tokens on NEAR, so `
      + 'this may still be a real asset — pass its contract account id. list_curated_assets returns '
      + 'every symbol this server can resolve on its own.' };
  }
  if (hit.length > 1) {
    return { error: `"${asset}" is ambiguous — ${hit.length} vouched tokens carry that symbol: `
      + hit.map((r) => r.i).join(', ') + '. Pass the contract account id.' };
  }
  const w = parseNearAsset(hit[0].i);
  return w ? { want: Object.assign(w, { code: hit[0].n, decimals: +hit[0].dc || 0 }) }
    : { error: `"${asset}" could not be resolved to an asset id.` };
}

// Mirrors wantAsset() in tools.js and wantXrplAsset() in xrpl.js, including the `label` prefix:
// add_liquidity takes two assets and a bare message cannot say which one was wrong.
async function wantNearAsset(label, x) {
  const direct = parseNearAsset(x);
  if (direct) return { want: direct };
  const r = await resolveNearSymbol(x);
  return r.want ? r : { error: `${label}: ${r.error}` };
}

// The curated roster as a lookup, for decimals and symbols a raw balance cannot supply on its own.
// A failure is not fatal anywhere it is used: the caller falls back to reporting the raw figure and
// says that it did, rather than dividing by a decimals it guessed.
async function roster() {
  try {
    const d = await api('/lxapi/nearmarket');
    const map = new Map();
    for (const r of (d && d.rows) || []) map.set(String(r.i), r);
    return { map, nearUsd: d && +d.usd ? +d.usd : null };
  } catch (_) { return { map: new Map(), nearUsd: null }; }
}

// wNEAR counts as the native side when choosing which page a swap opens -- pools hold wrap.near, but
// the trade page pairs its token against NEAR and a person does not distinguish them there.
const WNEAR = 'wrap.near';
const isNearSide = (a) => a.native || a.id === WNEAR;

// A token's display symbol, for a message. Falls back to the contract id, which is always true.
const label = (a, r) => a.code || (r && r.get(a.id) && r.get(a.id).n) || a.id;

// ---- reads ---------------------------------------------------------------------------------------

async function getMarket({ asset }) {
  const ra = await wantNearAsset('asset', asset);
  if (ra.error) return fail(ra.error);
  const a = ra.want;
  // THE NATIVE COIN ANSWERS, it is not refused (RAZA 2026-11-18: an agent testing "NEAR" got "ask for a token" and reported
  // the chain as not working). The rate is the curated roster's own NEAR/USD, the one every NEAR-priced figure here uses.
  if (a.native) {
    let m = null;
    try { m = await api('/lxapi/nearmarket'); } catch (_) { m = null; }
    if (!m || !(+m.usd > 0)) return fail('The NEAR/USD rate could not be read right now. Try again in a moment.');
    return ok({ chain: 'near', asset: 'NEAR', native: true, price_usd: nf(+m.usd, 6),
      change_24h_pct: m.near24 != null ? nf(+m.near24, 2) : null,
      note: 'NEAR is the network\'s native coin; tokens are priced against it. For a token\'s market, pass its contract id (e.g. lumos.lumoscore.near).' });
  }
  const d = await api('/lxapi/neartoken?i=' + encodeURIComponent(a.id));
  if (!d || d.ok === false) {
    return fail(`No market data for ${a.id} on NEAR.` + (d && d.error ? ` (${d.error})` : '')
      + ' It may not be a fungible-token contract, or it may have no pool.');
  }
  return ok(Object.assign({
    chain: 'near',
    asset: a.id, code: d.symbol || null, name: d.name || null, decimals: d.decimals ?? null,
    price_near: nf(d.price, 12), price_usd: nf(d.usd, 10),
    near_usd: nf(d.nearUsd, 6), near_change_24h_pct: nf(d.near24, 2),
    change_24h_pct: nf(d.d24, 2),
    volume_24h_near: nf(d.v24, 6), liquidity_near: nf(d.liquidity, 6), trades_24h: d.trades24 ?? null,
    supply: d.supply ?? null,
    pool_count: d.poolCount ?? null,
    pools: ((d.pools || []).map((p) => ({
      pair: p.pair, dex: p.dex || null, id: p.id || null,
      liquidity_usd: nf(p.liqUsd, 2), volume_24h_usd: nf(p.volUsd, 2),
      liquidity_near: nf(p.liq, 6), volume_24h_near: nf(p.vol, 6),
      base: (p.base || {}).i || null, quote: (p.quote || {}).i || null,
    }))),
    // SAID BECAUSE IT CHANGES WHAT THE PRICE MEANS. A thin token is priced off its own pool, so the
    // figure is whatever the last trade in a shallow pool left behind -- it moves on a few dollars
    // and it is not a market anyone can exit at. The liquidity and 24h volume above are the fields
    // that tell you whether to believe it, which is why they are not buried.
    price_basis: 'Priced from this token\'s own pools on Rhea. Read liquidity_near and '
      + 'volume_24h_near before trusting it: a token whose only pool is shallow carries whatever '
      + 'price its last trade left, not a price you could trade size at.',
    page: web('/trade/near/' + a.id),
  }, CREDIT));
}

async function listPools({ limit = 20, asset }) {
  let want = null;
  if (asset) {
    const rw = await wantNearAsset('asset', asset);
    if (rw.error) return fail(rw.error);
    want = rw.want;
  }
  const n = Math.max(1, Math.min(100, +limit || 20));
  // The native coin is held by pools as wNEAR, so a filter for NEAR must ask for wrap.near or it
  // would match nothing and read as "NEAR is in no pools".
  const tok = want ? (want.native ? WNEAR : want.id) : null;
  const d = await api('/lxapi/nearpools?n=' + n + (tok ? '&token=' + encodeURIComponent(tok) : ''));
  const rows = (d && d.rows) || [];
  const side = (s) => ({ asset: (s || {}).i || null, code: (s || {}).s || null, amount: nf((s || {}).v, 6) });
  // THE CONCENTRATED (DCL) POOLS OF A TOKEN (RAZA 2026-11-18: ChatGPT called NEAR's liquidity "not visible"). The
  // list above is Rhea's classic pools only, so for LUMOS it showed one pool worth $0.57 -- while get_quote filled
  // 21 NEAR into 158,304 LUMOS at 0% impact through dclv2 `lumos.lumoscore.near|wrap.near|2000`, a pool this tool
  // never mentioned. The two answers contradicted each other. With an asset filter, the token's DCL pools against
  // the three hubs are read from the contract (4 fee tiers each, the reads get_quote makes) and reported with what
  // each side holds -- including how much of it is resting limit orders, which is what makes one side deep and the
  // other empty. Without a filter there is no cheap way to list every DCL pool, and the note says so.
  let dcl = null;
  if (tok) {
    try {
      const s = quoteSession(), r = (await roster()).map;
      const nearUsd = d && +d.usd ? +d.usd : null;
      const usdOf = (id, amt) => {
        if (amt == null) return null;
        if (id === Q_USDC || id === Q_USDT) return amt;
        if (id === WNEAR) return nearUsd ? amt * nearUsd : null;
        const row = r.get(id); return row && nearUsd && +row.p > 0 ? amt * +row.p * nearUsd : null;
      };
      const pairs = HUBS.filter((h) => h !== tok).flatMap((h) => DCL_FEES.map((f) => [tok, h].sort().join('|') + '|' + f));
      const got = await Promise.all(pairs.map((id) => s.view(DCL, 'get_pool', { pool_id: id }).catch((e) => { if (e instanceof QuoteBusy) throw e; return null; })));
      const decs = {};
      const dec = async (id) => (decs[id] != null ? decs[id] : (decs[id] = await decimalsOf({ id }, r, s)));
      dcl = [];
      for (const p of got) {
        if (!p || p.state !== 'Running') continue;
        const [dx, dy] = await Promise.all([dec(p.token_x), dec(p.token_y)]);
        const h = (raw, dd) => { const v = fromRaw(raw, dd); return v == null ? null : +v; };
        const x = h(p.total_x, dx), y = h(p.total_y, dy), ox = h(p.total_order_x, dx), oy = h(p.total_order_y, dy);
        if (!(x > 0 || y > 0)) continue;
        const ux = usdOf(p.token_x, x), uy = usdOf(p.token_y, y);
        const code = (id) => (id === WNEAR ? 'wNEAR' : id === Q_USDC ? 'USDC' : id === Q_USDT ? 'USDt' : ((r.get(id) || {}).n || id));
        dcl.push({
          id: p.pool_id, kind: 'DCL (concentrated liquidity)', pair: `${code(p.token_x)} / ${code(p.token_y)}`,
          fee_pct: nf(+p.fee / 10000, 4),
          tokens: [
            { asset: p.token_x, code: code(p.token_x), amount: nf(x, 6), of_which_limit_orders: nf(ox, 6) },
            { asset: p.token_y, code: code(p.token_y), amount: nf(y, 6), of_which_limit_orders: nf(oy, 6) },
          ],
          range_liquidity_active: big(p.liquidity) > 0n,
          liquidity_usd: ux != null && uy != null ? nf(ux + uy, 2) : null,
        });
      }
      dcl.sort((p, q) => (q.liquidity_usd || 0) - (p.liquidity_usd || 0));
    } catch (e) { dcl = null; }
  }
  return ok(Object.assign({
    chain: 'near',
    count: rows.length, network_total: d && d.summary && d.summary.pools != null ? d.summary.pools : null,
    filtered_to: tok,
    concentrated_pools: tok ? dcl : undefined,
    concentrated_note: tok
      ? (dcl == null
        ? 'The concentrated (DCL) pools could not be read just now (NEAR RPC busy), so only the classic pools are listed.'
        : 'Rhea also runs concentrated-liquidity (DCL) pools, listed separately because they work differently: a side can be '
          + 'deep and the other empty, especially when most of a pool is resting limit orders. get_quote routes through both '
          + 'kinds, so read these before judging how deep a token is. Read against wNEAR, USDC and USDt only.')
      : 'Classic Rhea pools only. Pass asset to also see that token\'s concentrated (DCL) pools, which get_quote can route through.',
    near_usd: d && +d.usd ? nf(+d.usd, 6) : null,
    // Stated because it changes what the list means, and on NEAR it is the stronger warning of the
    // three chains: Rhea lets anyone open a pool, and the newest ones include outright honeypots.
    // A liquidity ranking puts a token paired with itself on top; volume has to be paid for.
    ranked_by: 'liquidity, as the Pools page ranks it',
    curation_note: 'Anyone can create a pool on Rhea. A pool appearing here is not a LumosCore '
      + 'endorsement of either token — check list_curated_assets for what is actually vouched for.',
    network_summary: d && d.summary ? {
      liquidity_usd: nf(d.summary.liquidity, 2), volume_24h_usd: nf(d.summary.vol24, 2),
      fees_24h_usd: nf(d.summary.fees24, 4), pools: d.summary.pools ?? null,
    } : null,
    pools: rows.map((p) => ({
      id: p.id, kind: p.kind || null,
      pair: ((p.tokens || []).map((t) => t.s || t.i).join(' / ')),
      tokens: (p.tokens || []).map(side),
      fee_pct: nf(p.fee, 4), liquidity_usd: nf(p.liq, 2), volume_24h_usd: nf(p.vol, 2),
      fees_24h_usd: nf(p.fees, 4), apr_pct: nf(p.apr, 4), trades_24h: p.trades ?? null,
      liquidity_providers: p.lps ?? null,
      page: web('/pools/near/id/' + p.id),
    })),
  }, CREDIT));
}

async function getPortfolio({ address }) {
  const addr = String(address || '').trim().toLowerCase();
  if (!isNearAccount(addr)) {
    return fail('address must be a NEAR account id (2-64 characters, lowercase, e.g. alice.near '
      + 'or a 64-hex implicit account).');
  }
  const acct = await nearRpc('query', {
    request_type: 'view_account', finality: 'final', account_id: addr,
  });
  // UNKNOWN_ACCOUNT is a REAL ANSWER -- the account does not exist -- and must not be reported as a
  // failure, the same way Horizon's 404 is funded:false on Stellar and actNotFound is on the XRPL.
  if (acct && acct._nearError) {
    return ok({ chain: 'near', address: addr, exists: false,
      note: 'This account does not exist on NEAR. A NEAR account has to be created (and funded) '
        + 'before it can hold anything.' });
  }
  if (!acct || acct.amount == null) throw new ApiError('Could not read the account from NEAR.', 0);

  // STORAGE IS NOT SPENDABLE, and saying so is the difference between a balance and a budget. Every
  // byte an account stores locks NEAR behind it; an agent told only `amount` will size a transfer the
  // account cannot sign. Same lesson as the XRPL reserve, and as MAX rounding a balance up: ONE place
  // decides what "spendable" means.
  //
  // THE RATE IS READ FROM THE PROTOCOL, NOT HARDCODED. storage_amount_per_byte is a protocol-config
  // value and has been changed by a protocol upgrade before, so a constant here is a number that is
  // right until the day it quietly is not -- in the one field someone sizes a transaction against.
  // 1e19 is kept only as a fallback, and the response says which of the two it used.
  let perByte = '10000000000000000000', rateSource = 'fallback constant (protocol config did not answer)';
  try {
    const cfg = await nearRpc('EXPERIMENTAL_protocol_config', { finality: 'final' });
    const v = ((cfg || {}).runtime_config || {}).storage_amount_per_byte;
    if (/^[0-9]+$/.test(String(v || '')) && +v > 0) { perByte = String(v); rateSource = 'live, from protocol config'; }
  } catch (_) { /* the fallback is correct today; a failure must not cost the caller their balance */ }

  const used = Math.max(0, +acct.storage_usage || 0);
  // Exact integer arithmetic on strings: these are yoctoNEAR, 24 decimals, well past a double.
  const lockedRaw = (BigInt(used) * BigInt(perByte)).toString();
  const amountRaw = String(acct.amount);
  const spendRaw = (() => {
    const a = BigInt(amountRaw), l = BigInt(lockedRaw);
    return (a > l ? a - l : 0n).toString();
  })();

  // Token balances are a bonus: a failure here must not cost the caller their NEAR balance.
  let ft = null;
  try { ft = await nearFt(addr); } catch (_) { ft = null; }
  const { map, nearUsd } = await roster();

  const tokens = (((ft || {}).tokens) || [])
    .filter((t) => t && /^[0-9]+$/.test(String(t.balance || '')) && String(t.balance) !== '0')
    .map((t) => {
      const r = map.get(String(t.contract_id));
      const dec = r ? +r.dc : null;
      const bal = dec == null ? null : fromRaw(t.balance, dec);
      return {
        asset: t.contract_id,
        code: r ? r.n : null,
        balance: bal,
        balance_raw: String(t.balance),
        decimals: dec,
        // A token outside the curated roster has no decimals WE can stand behind, so the raw integer
        // is handed back undivided and flagged. Guessing 18 is how a balance gets misread by a
        // million times in either direction.
        curated: !!r,
        value_near: r && bal != null && +r.p ? nf(+bal * +r.p, 6) : null,
        unresolved: dec == null
          ? 'Not in the curated roster, so its decimals are unknown here — balance_raw is the exact '
            + 'on-chain integer, undivided. get_market on this contract reports its decimals.'
          : undefined,
      };
    });

  return ok(Object.assign({
    chain: 'near',
    address: addr, exists: true,
    near_balance: fromRaw(amountRaw, 24),
    storage_locked_near: fromRaw(lockedRaw, 24),
    spendable_near: fromRaw(spendRaw, 24),
    storage_note: `${used} bytes stored x ${perByte} yoctoNEAR per byte. Only spendable_near can `
      + 'actually be sent or swapped, and a transaction also needs gas on top of its own amount.',
    storage_rate_source: rateSource,
    storage_bytes: used,
    tokens,
    token_source: ft ? 'FastNEAR account index' : 'unavailable — token balances could not be read, '
      + 'and an empty list here would have been a false "holds no tokens"',
    // NOT COMPUTED, AND SAID SO. An account's LP positions would mean reading the provider list of
    // every one of ~183 pools, since NEAR has no account-to-pools index; the Pools page does it for
    // the connected wallet. A silently missing field would read as "no positions".
    pool_positions: 'Not included — NEAR has no account-to-pools index, so finding them means '
      + 'scanning every pool\'s provider list. Your positions are shown on the Pools page when your '
      + 'wallet is connected.',
    open_orders: 'Not applicable — NEAR trading on LumosCore is AMM-only, so there is no resting '
      + 'order to list.',
    near_usd: nearUsd ? nf(nearUsd, 6) : null,
    page: web('/account/near/' + addr),
  }, CREDIT));
}

// ---- the swap quote: Rhea's own contracts, asked the way the trade page asks them ------------------
//
// A REAL QUOTE, NOT POOL ARITHMETIC (RAZA 2026-11-18: ChatGPT, asked for 21 NEAR -> LUMOS, said "its NEAR swap tool
// does not provide an executable quote yet" and fell back to estimating from prices). This used to refuse, because
// there is no swap-router ENDPOINT on LumosCore. But the NEAR trade page never had one either: it asks Rhea's contracts
// directly -- `get_return` on v2.ref-finance.near for a classic pool, `quote` on dclv2.ref-labs.near for a
// concentrated one -- and those views ARE the executable figure, computed by the contract that will run the swap. This
// is that same engine (LumosCore-NEAR/_tools/browser/nearswap.js route()/quoteOnce()), server side:
//   * direct: the 3 deepest classic pools holding both tokens, and each DCL fee tier;
//   * two hops through wNEAR, USDC or USDt (2 deepest classic pools per leg);
//   * DCL wins only when it gives more than 1% more, as on the page;
//   * the 0.2% platform fee comes off the input first, as on the page, and every output is for the net amount;
//   * price impact = this route at the trade size against the same route at a tiny size.
// NOT here: the page's last resort, a two-transaction route mixing a classic and a DCL leg through a hub. It costs up
// to ~36 more reads, a Worker request is allowed ~50 sub-requests, and it is not atomic -- so "no route" here says the
// page may still find one rather than claiming there is none.
const REF = 'v2.ref-finance.near';
const DCL = 'dclv2.ref-labs.near', DCL_FEES = [100, 400, 2000, 10000];
const Q_USDC = '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1';
const Q_USDT = 'usdt.tether-token.near';
const HUBS = [WNEAR, Q_USDC, Q_USDT];
const Q_FEE_BPS = 20, Q_SLIP_BPS = 50;
const Q_RPCS = ['https://free.rpc.fastnear.com', 'https://near.drpc.org'];
const Q_MAX_CALLS = 40;
const POOR_PCT = 2;

class QuoteBusy extends Error {}

// One quote's RPC budget and concurrency. A free RPC answers a burst of 20 view calls from one IP with 429s, so at
// most 4 run at once, a refused call retries once on the other host, and the whole quote is capped at Q_MAX_CALLS so
// it can never run past the Worker's sub-request limit.
function quoteSession() {
  let live = 0, used = 0, failed = 0; const wait = [];
  const slot = () => new Promise((res) => { if (live < 4) { live++; res(); } else wait.push(res); });
  const free = () => { const n = wait.shift(); if (n) n(); else live--; };
  async function once(host, contract, method, args) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch(Q_RPCS[host], {
        method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, signal: ctl.signal,
        body: JSON.stringify({ jsonrpc: '2.0', id: 'q', method: 'query', params: {
          request_type: 'call_function', finality: 'final', account_id: contract, method_name: method,
          args_base64: btoa(JSON.stringify(args || {})) } }),
      });
      if (r.status === 429 || r.status >= 500) return { busy: true };
      const j = await r.json().catch(() => null);
      if (!j) return { busy: true };
      if (j.error) {
        const m = String((j.error.cause && j.error.cause.name) || j.error.message || '');
        return /timeout|too many|rate|overload|unavailable|no_synced/i.test(m) ? { busy: true } : { error: m || 'RPC error' };
      }
      if (j.result && j.result.error) return { error: String(j.result.error) };   // the contract refused: an answer
      const bytes = new Uint8Array((j.result && j.result.result) || []);
      const txt = new TextDecoder().decode(bytes);
      return { value: txt ? JSON.parse(txt) : null };
    } catch (_) { return { busy: true }; } finally { clearTimeout(t); }
  }
  async function view(contract, method, args) {
    if (used >= Q_MAX_CALLS) throw new QuoteBusy('read budget spent');
    used++;
    await slot();
    try {
      let r = await once(0, contract, method, args);
      if (r.busy) r = await once(1, contract, method, args);
      if (r.busy) { failed++; throw new QuoteBusy('NEAR RPC busy'); }
      if (r.error) { const e = new Error(r.error); e.refused = true; throw e; }
      return r.value;
    } finally { free(); }
  }
  return { view, get failed() { return failed; }, get used() { return used; } };
}

const big = (s) => BigInt(String(s == null ? '0' : s));
const minOutOf = (raw) => (big(raw) * BigInt(10000 - Q_SLIP_BPS) / BigInt(10000)).toString();

// A decimal amount to the token's integer units, by string, so 24 decimals keep every digit a double gives.
function toRaw(amount, dec) {
  const n = +amount;
  if (!isFinite(n) || n <= 0) return null;
  let s = n.toFixed(Math.min(dec, 20));
  const [w, f = ''] = s.split('.');
  s = (w + f.padEnd(dec, '0').slice(0, dec)).replace(/^0+/, '');
  return s || null;
}

async function decimalsOf(a, r, s) {
  if (a.native || a.id === WNEAR) return 24;
  if (a.decimals != null && isFinite(+a.decimals)) return +a.decimals;
  const row = r.get(a.id);
  if (row && row.dc != null) return +row.dc;
  const m = await s.view(a.id, 'ft_metadata', {});
  if (!m || m.decimals == null) throw new Error(`${a.id} did not answer as a fungible token`);
  return +m.decimals;
}

// The pools that can hold a leg: the curated top 200, plus Rhea-wide rows for a token that has no pool in them --
// the same two reads the page uses. A list we could not read is "busy", never "no pools".
async function quotePools(a, b) {
  let d;
  try { d = await api('/lxapi/nearpools?n=200'); } catch (_) { throw new QuoteBusy('pool list unavailable'); }
  if (!d || !d.ok || !d.rows) throw new QuoteBusy('pool list unavailable');
  let rows = d.rows;
  for (const id of [a, b]) {
    if (id === WNEAR || rows.some((p) => (p.tokens || []).some((t) => t.i === id))) continue;
    try {
      const e = await api('/lxapi/nearpools?q=' + encodeURIComponent(id));
      rows = rows.concat(((e && e.ok && e.rows) || []).filter((p) => (p.tokens || []).some((t) => t.i === id)));
    } catch (_) { throw new QuoteBusy('pool lookup unavailable'); }
  }
  return rows;
}
function poolsBetween(rows, a, b, k) {
  return rows.filter((p) => { const ids = (p.tokens || []).map((t) => t.i); return ids.includes(a) && ids.includes(b); })
    .sort((x, y) => (y.liq || 0) - (x.liq || 0)).slice(0, k);
}

function legReturn(s, pool, tin, tout, amt) {
  if (pool.dcl) {
    return s.view(DCL, 'quote', { pool_ids: [pool.id], input_token: tin, output_token: tout, input_amount: String(amt), tag: null })
      .then((r) => String((r && r.amount) || '0'));
  }
  return s.view(REF, 'get_return', { pool_id: +pool.id, token_in: tin, amount_in: String(amt), token_out: tout })
    .then((r) => String(r || '0'));
}
// The best of several pools for one leg. A pool the contract REFUSES is "not this one"; a busy read propagates.
async function bestLeg(s, cands, tin, tout, amt) {
  const rs = await Promise.all(cands.map((p) => legReturn(s, p, tin, tout, amt)
    .then((o) => ({ pool: p, out: o }), (e) => { if (e instanceof QuoteBusy) throw e; return null; })));
  let best = null;
  for (const x of rs) if (x && big(x.out) > 0n && (!best || big(x.out) > big(best.out))) best = x;
  return best;
}

async function findRoute(s, rows, a, b, net) {
  const tries = [];
  tries.push(bestLeg(s, poolsBetween(rows, a, b, 3), a, b, net)
    .then((x) => (x ? { hops: [{ pool: x.pool, tin: a, tout: b }], out: x.out } : null)));
  for (const m of HUBS) {
    if (m === a || m === b) continue;
    const l1 = poolsBetween(rows, a, m, 2), l2 = poolsBetween(rows, m, b, 2);
    if (!l1.length || !l2.length) continue;
    tries.push(bestLeg(s, l1, a, m, net).then(async (x1) => {
      if (!x1) return null;
      const x2 = await bestLeg(s, l2, m, b, x1.out);
      return x2 ? { hops: [{ pool: x1.pool, tin: a, tout: m }, { pool: x2.pool, tin: m, tout: b }], out: x2.out } : null;
    }));
  }
  const pair = [a, b].sort().join('|');
  const dcl = bestLeg(s, DCL_FEES.map((f) => ({ id: pair + '|' + f, dcl: 1 })), a, b, net)
    .then((x) => (x ? { hops: [{ pool: x.pool, tin: a, tout: b }], out: x.out } : null));
  const [classic, d] = await Promise.all([Promise.all(tries), dcl]);
  let best = null;
  for (const r of classic) if (r && (!best || big(r.out) > big(best.out))) best = r;
  if (d && (!best || big(d.out) * 100n > big(best.out) * 101n)) best = d;
  if (!best) return null;
  // A ROUTE THAT MOVES THE PRICE A LOT IS NOT THE END OF THE SEARCH (RAZA 2026-11-18, "fix the LUMOS route through the
  // tiny pool"): 10 USDC -> LUMOS took classic 4512 > 9001 ($0.57) for 2,153 LUMOS at 91% impact, while DCL > DCL through
  // wNEAR, one transaction, gives ~22,500 at 0%. Same rule as the page's route(): past POOR_PCT impact, also try the
  // all-DCL hub routes, and keep the better. Narrower than the page, to stay inside the read budget: hubs wNEAR and USDC
  // only, atomic routes only (the page may also offer a two-transaction split, and only when it gives >1% more).
  // A hub search that runs out of reads keeps the route already found.
  try {
    if (await poorRoute(s, best, net)) {
      const h = await dclHubRoute(s, a, b, net);
      if (h && big(h.out) > big(best.out)) best = h;
    }
  } catch (e) { if (!(e instanceof QuoteBusy)) throw e; }
  return best;
}

async function poorRoute(s, r, net) {
  let t = big(net) / 1000n; if (t < 1n) t = 1n;
  let o = await along(s, r.hops, t), n = 0;
  while (big(o) < 100000n && n < 2 && t * 10n <= big(net) / 100n) { t *= 10n; o = await along(s, r.hops, t); n++; }
  if (!(big(o) > 0n)) return true;
  const ex = Number(r.out) / Number(net), sp = Number(o) / Number(t);
  return sp > 0 && (1 - ex / sp) * 100 > POOR_PCT;
}

async function dclHubRoute(s, a, b, net) {
  let best = null;
  for (const m of [WNEAR, Q_USDC]) {
    if (m === a || m === b) continue;
    const x1 = await bestLeg(s, DCL_FEES.map((f) => ({ id: [a, m].sort().join('|') + '|' + f, dcl: 1 })), a, m, net);
    if (!x1) continue;
    const x2 = await bestLeg(s, DCL_FEES.map((f) => ({ id: [m, b].sort().join('|') + '|' + f, dcl: 1 })), m, b, x1.out);
    if (x2 && (!best || big(x2.out) > big(best.out))) best = { hops: [{ pool: x1.pool, tin: a, tout: m }, { pool: x2.pool, tin: m, tout: b }], out: x2.out };
  }
  return best;
}

async function along(s, hops, amt) {
  let x = String(amt);
  for (const h of hops) x = await legReturn(s, h.pool, h.tin, h.tout, x);
  return x;
}

// { quote } or { error }. `f`/`t` are resolved assets.
async function nearQuote(f, t, amount, r) {
  const s = quoteSession();
  const a = f.native ? WNEAR : f.id, b = t.native ? WNEAR : t.id;
  if (a === b) return { error: 'NEAR and wNEAR are the same asset wrapped and unwrapped — that is a wrap, not a swap, and has no price.' };
  try {
    const [fd, td] = await Promise.all([decimalsOf(f, r, s), decimalsOf(t, r, s)]);
    const amtRaw = toRaw(amount, fd);
    if (!amtRaw) return { error: 'amount must be a positive number.' };
    const fee = (big(amtRaw) * BigInt(Q_FEE_BPS) / 10000n).toString();
    const net = (big(amtRaw) - big(fee)).toString();
    if (big(net) <= 0n) return { error: 'That amount is too small to swap.' };
    const rows = await quotePools(a, b);
    const route = await findRoute(s, rows, a, b, net);
    if (!route) {
      if (s.failed) throw new QuoteBusy('a read failed');
      return { error: `No direct or one-hop route between ${label(f, r)} and ${label(t, r)} on Rhea was found. `
        + 'The trade page also tries a two-transaction route through a hub token, which this server does not; '
        + `check ${web('/trade/near/' + (isNearSide(f) ? t.id : f.id))} before calling the pair untradeable.` };
    }
    // Spot along the same route: a thousandth of the trade, bumped (twice at most) until the output is big enough
    // to be a price.
    let impact = null;
    try {
      let tiny = big(net) / 1000n; if (tiny < 1n) tiny = 1n;
      let o = await along(s, route.hops, tiny), n = 0;
      while (big(o) < 100000n && n < 2 && tiny * 10n <= big(net) / 100n) { tiny *= 10n; o = await along(s, route.hops, tiny); n++; }
      if (big(o) > 0n) {
        const ex = Number(route.out) / Number(net), sp = Number(o) / Number(tiny);
        if (sp > 0) impact = Math.max(0, (1 - ex / sp) * 100);
      }
    } catch (e) { if (!(e instanceof QuoteBusy)) throw e; }
    const outH = fromRaw(route.out, td), minH = fromRaw(minOutOf(route.out), td);
    const fc = label(f, r), tc = label(t, r);
    const sym = (id) => (id === WNEAR ? 'wNEAR' : id === Q_USDC ? 'USDC' : id === Q_USDT ? 'USDt' : ((r.get(id) || {}).n || id));
    const quote = {
      chain: 'near',
      from: { asset: f.native ? 'NEAR' : f.id, code: fc, amount: fromRaw(amtRaw, fd) },
      to: { asset: t.native ? 'NEAR' : t.id, code: tc },
      platform_fee: { amount: fromRaw(fee, fd), asset: fc, rate_pct: Q_FEE_BPS / 100,
        note: 'Taken from the input before the swap. Wallets holding 250,000+ LUMOS pay 0.1%; the page applies that at signing.' },
      amount_out: outH,
      minimum_out: minH,
      slippage_pct: Q_SLIP_BPS / 100,
      price: nf(+outH / +fromRaw(net, fd), 12),
      price_unit: `${tc} per ${fc}, after the fee`,
      price_impact_pct: impact == null ? null : nf(impact, 2),
      route: route.hops.map((h) => ({ pool: String(h.pool.id), venue: h.pool.dcl ? 'Rhea concentrated (DCL)' : 'Rhea classic',
        from: sym(h.tin), to: sym(h.tout) })),
      source: 'Rhea\'s own contracts on chain: get_return (v2.ref-finance.near) and quote (dclv2.ref-labs.near) — the same reads the LumosCore trade page quotes with.',
      quoted_at: new Date().toISOString(),
      note: 'Executable at the moment it was read. Pools move; the page re-quotes at signing, and the minimum_out there is what the transaction enforces.',
      page: web('/trade/near/' + (isNearSide(f) ? t.id : f.id)),
    };
    if (impact != null && impact >= 5) {
      quote.warning = `This trade moves the price by about ${nf(impact, 1)}% — the pool is shallow for this size. `
        + 'Tell the person before they swap, and suggest a smaller amount.';
    }
    // ZERO IMPACT ON A CONCENTRATED POOL IS USUALLY LIMIT ORDERS (RAZA 2026-11-18: ChatGPT saw 0.1, 10 and 100 NEAR ->
    // LUMOS all at 0% and one rate, and asked whether to trust it). A DCL pool can hold resting limit orders at one
    // price -- LUMOS/wNEAR is ~100M LUMOS of them and no range liquidity -- and those fill at that price until they run
    // out, so the rate really is flat. Said in the answer, with where to see how much is left.
    if (impact != null && impact < 0.05 && route.hops.some((h) => h.pool.dcl)) {
      quote.impact_note = 'Price impact is ~0 because this route fills from a concentrated (DCL) pool, which can hold '
        + 'resting limit orders at a single price: those fill at that price until they run out, so the rate stays flat '
        + 'across sizes. list_pools with this asset shows how much is resting on each side.';
    }
    return { quote };
  } catch (e) {
    if (e instanceof QuoteBusy) return { error: 'NEAR\'s public RPC is busy right now, so no quote was read. Try again in a moment — this is not a missing route.' };
    return { error: 'The quote could not be read: ' + (e && e.message ? e.message : String(e)) };
  }
}

async function getQuote({ from, to, amount }) {
  const rf = await wantNearAsset('from', from); if (rf.error) return fail(rf.error);
  const rt = await wantNearAsset('to', to);     if (rt.error) return fail(rt.error);
  if (!(+amount > 0)) return fail('amount must be a positive number.');
  if (rf.want.id === rt.want.id) return fail('from and to are the same asset.');
  const r = (await roster()).map;
  const q = await nearQuote(rf.want, rt.want, amount, r);
  return q.error ? fail(q.error) : ok(Object.assign(q.quote, CREDIT));
}

async function listCuratedAssets({ verified_only = false, limit = 100 }) {
  const d = await api('/lxapi/nearmarket');
  const rows = (d && d.rows) || [];
  const n = Math.max(1, Math.min(200, +limit || 100));
  const out = rows
    .filter((r) => (verified_only ? +r.vf === 1 : true))
    .slice(0, n)
    .map((r) => ({
      asset: r.i, code: r.n, name: r.nm || null, decimals: +r.dc || 0,
      verified: +r.vf === 1,
      price_near: nf(r.p, 12), price_usd: d && +d.usd ? nf(r.p * +d.usd, 10) : null,
      change_24h_pct: nf(r.d, 2),
      volume_24h_near: nf(r.v, 2), liquidity_near: nf(r.t, 2),
      holders: r.hc ?? null, transfers: r.x ?? null,
      website: r.w || null, coingecko: r.cg || null,
      page: web('/trade/near/' + r.i),
    }));
  return ok(Object.assign({
    chain: 'near',
    count: out.length, network_total: 3862,
    near_usd: d && +d.usd ? nf(+d.usd, 6) : null,
    near_change_24h_pct: d && d.near24 != null ? nf(+d.near24, 2) : null,
    assets: out,
    // These are the symbols a bare argument resolves to on this chain, which is the practical reason
    // an agent asks for this list at all.
    note: 'Every `code` here resolves on its own as an asset argument. Anything outside this roster '
      + 'must be passed as its contract account id — NEAR carries 3,862 fungible tokens and nothing '
      + 'stops two of them sharing a symbol, so this server will not guess between them.',
  }, CREDIT));
}

// NEAR HAS NO ORDER BOOK. Rhea is an AMM: there are no resting offers, so there is nothing to read.
async function getOrderbook({ asset }) {
  const ra = await wantNearAsset('asset', asset);
  if (ra.error) return fail(ra.error);
  const a = ra.want;
  return fail('NEAR has no central order book. Trading goes through Rhea: classic AMM pools, and concentrated (DCL) '
    + 'pools that can also hold resting limit orders — the limit orders the NEAR trade page places live inside those '
    + 'pools, not in a separate book. Use list_pools'
    + (a.native ? ' with a token' : ` with asset: "${a.id}"`) + ' to see both kinds, including how much of each side '
    + 'is resting limit orders, get_quote for an executable figure, and get_market for the current price.');
}

async function getRewards({ address }) {
  const addr = String(address || '').trim().toLowerCase();
  if (addr && !isNearAccount(addr)) return fail('address must be a NEAR account id (e.g. alice.near).');
  return ok({
    chain: 'near',
    programs: ['LP rewards', 'Holder rewards', 'Trading rewards'],
    per_round: '3,000,000 LUMOS per round, per chain',
    // A DATE, NOT "SOON". Rewards on NEAR have not started yet, and a tool that listed the programs
    // without saying so would have an agent telling someone to go and claim nothing.
    starts: '2026-12-01',
    status: 'Not started yet — the NEAR reward programs begin on 2026-12-01. The programs below are '
      + 'what will run from that date; nothing is claimable before it.',
    lumos_token: 'lumos.lumoscore.near',
    address: addr || null,
    page: web('/rewards/near'),
    note: 'The incentivised pool roster for NEAR is shown on the Rewards page and is not restated '
      + 'here — it is a different roster from Stellar\'s and the XRP Ledger\'s, and a list that '
      + 'disagreed with the page would be worse than a link to it. Eligibility and amounts are '
      + 'computed there against the live chain.',
  });
}

// ---- writes: prepared, never signed ---------------------------------------------------------------
//
// Measured per page, 2026-11-17 -- see the file header. The trade page reads a link; the pool and
// bridge pages do not.
const NOFILL = 'The NEAR pool and bridge pages do not accept a pre-filled link yet, so the amounts '
  + 'are shown here for you to enter on the page. The link opens the correct page on the correct chain.';

function prepared(action, summary, url, extra) {
  return ok(Object.assign({
    chain: 'near', action, summary,
    approve_url: url,
    signed: false,
    next_step: 'Open approve_url. LumosCore will show the prepared transaction and your wallet will '
      + 'ask you to sign it. Nothing moves until you approve it there.',
    why: 'This server never holds a key and never signs. It prepares the action and hands it back to you.',
    after_approval: 'Do not assume the outcome either way once the person has been to approve_url. Ask what the '
      + 'LumosCore page showed, and check with get_portfolio for their address: balances change once it lands. '
      + 'A cross-chain transfer can take several minutes to arrive after the page says it was sent.',
  }, extra || {}));
}

async function swap({ from, to, amount }) {
  const rf = await wantNearAsset('from', from); if (rf.error) return fail(rf.error);
  const rt = await wantNearAsset('to', to);     if (rt.error) return fail(rt.error);
  const f = rf.want, t = rt.want;
  if (!(+amount > 0)) return fail('amount must be a positive number.');
  if (f.id === t.id) return fail('from and to are the same asset.');

  const r = (await roster()).map;
  const fc = label(f, r), tc = label(t, r);
  const summary = `Swap ${amount} ${fc} for ${tc} on NEAR`;

  // NEAR OR wNEAR ON ONE SIDE -> the Trade-Asset page, which pairs ITS token against NEAR and
  // nothing else. This is the one NEAR page that reads a prefill link, so the amount really does
  // arrive filled in -- and `side` is from the PAGE's point of view: its own token is being bought
  // when NEAR is what you are spending.
  if (isNearSide(f) || isNearSide(t)) {
    const page = isNearSide(f) ? t : f;
    const side = isNearSide(f) ? 'buy' : 'sell';
    // The amount typed into that box is denominated in whichever token the box holds, which is the
    // `from` side of the swap -- so the precision cap is the FROM token's decimals, not the page's.
    const dec = f.native ? 24 : (f.decimals != null ? f.decimals : ((r.get(f.id) || {}).dc));
    const amt = plainAmount(amount, dec);
    const qs = `?side=${side}` + (amt ? `&amount=${amt}` : '');
    const q = await nearQuote(f, t, amount, r);
    return prepared('swap', summary, web('/trade/near/' + page.id) + qs, {
      enter_on_page: amt ? undefined : { side, amount: +amount, pair: `${fc} → ${tc}` },
      opens: `The ${label(page, r)} trade page on NEAR.`,
      // Measured, not assumed: lx-tradeprefill is present on this page and reads ?side= and ?amount=.
      prefill: amt
        ? `The side and amount ride in the link — /trade/near/<contract> reads ?side= and ?amount=.`
        : 'The amount is not carried: it does not survive this page\'s plain-digits check at this '
          + 'token\'s precision, so enter it on the page.',
      quote: q.quote || null,
      quote_note: q.quote
        ? 'Read from Rhea\'s contracts just now; the page re-quotes at signing and enforces its own minimum.'
          + (q.quote.warning ? ' ' + q.quote.warning : '')
        : 'No quote is attached: ' + q.error,
    });
  }

  // NEITHER SIDE IS NEAR. The pair has to route through a pool that holds both, and the page that
  // takes an arbitrary pair is the dashboard's Custom Swap -- /dashboard carries no chain in its
  // path and is served by whichever network the wallet last connected to, so handing it back here
  // would send anyone without that cookie to the Stellar dashboard to perform a NEAR swap.
  return prepared('swap', summary, web('/trade/near'), {
    enter_on_page: { pair: `${fc} → ${tc}`, amount: +amount },
    opens: 'The NEAR trade page.',
    route: 'Neither side is NEAR, so this settles through the Custom Swap on the dashboard '
      + '(Quick actions → Custom Swap) once a NEAR wallet is connected.',
    limitation: 'There is no chain-addressed url for the dashboard — /dashboard serves whichever '
      + 'network your wallet last connected to — so this link deliberately stops at the NEAR trade '
      + 'page rather than risk opening the Stellar dashboard for a NEAR swap.',
    prefill: NOFILL,
    ...(await (async () => { const q2 = await nearQuote(f, t, amount, r); return q2.quote ? { quote: q2.quote } : { quote: null, quote_note: 'No quote is attached: ' + q2.error }; })()),
  });
}

async function addLiquidity({ a, b, amount_a, amount_b }) {
  const rA = await wantNearAsset('a', a); if (rA.error) return fail(rA.error);
  const rB = await wantNearAsset('b', b); if (rB.error) return fail(rB.error);
  const A = rA.want, B = rB.want;
  if (!(+amount_a > 0) || !(+amount_b > 0)) return fail('amount_a and amount_b must both be positive.');
  if (A.id === B.id) return fail('a and b are the same asset.');

  const r = (await roster()).map;
  const ac = label(A, r), bc = label(B, r);
  // Pools hold wNEAR, never the native coin, so that is what the pool lookup and the url must use.
  const aId = A.native ? WNEAR : A.id, bId = B.native ? WNEAR : B.id;

  // The pool, if it exists, so the response can say what the deposit is joining rather than leaving
  // the agent to guess. A failure here is not fatal: the link is still correct.
  let pool = null;
  try {
    const d = await api('/lxapi/nearpools?n=200&token=' + encodeURIComponent(aId));
    pool = ((d && d.rows) || []).filter((p) => {
      const ids = (p.tokens || []).map((t) => String(t.i));
      return ids.indexOf(aId) >= 0 && ids.indexOf(bId) >= 0;
    })[0] || null;
  } catch (_) { pool = null; }

  const extra = {
    // NEAR's storage rule, not Stellar's trustline and not XRPL's owner reserve. Joining a pool
    // registers the account with the AMM contract, and that registration is storage somebody pays
    // for in locked NEAR.
    note: 'Depositing on NEAR registers your account with the Rhea AMM contract, and that '
      + 'registration is storage: a small amount of NEAR is locked while the position exists (it is '
      + 'returned when you unregister). Keep spendable NEAR for gas on top of the amounts above — '
      + 'get_portfolio separates the two.',
    // Measured: /pools/near/* carries NO lx-poolprefill. Stellar and the XRPL fork read the amounts
    // back from the link; this chain does not, and saying otherwise is the bug this connector was
    // fixed for.
    prefill: NOFILL,
    enter_on_page: { [ac]: +amount_a, [bc]: +amount_b },
  };
  if (pool) {
    extra.pool_id = pool.id;
    extra.pool_kind = pool.kind || null;
    extra.pool_fee_pct = nf(pool.fee, 4);
    extra.pool_liquidity_usd = nf(pool.liq, 2);
    extra.pool_volume_24h_usd = nf(pool.vol, 2);
    extra.pool_apr_pct = nf(pool.apr, 4);
    extra.ratio_note = 'Deposit on the pool\'s current ratio. An off-ratio deposit is priced against '
      + 'the pool, so the shares you receive are worth less than the amounts you put in.';
  } else {
    extra.pool = 'none found in the pool list for this pair — this deposit may create it';
    extra.price_warning = 'The ratio you deposit SETS the opening price. Match the market or '
      + 'arbitrage will correct it at your expense.';
  }
  return prepared('add_liquidity',
    `Deposit ${amount_a} ${ac} and ${amount_b} ${bc} into the ${ac} / ${bc} pool on NEAR`,
    pool ? web('/pools/near/id/' + pool.id)
      : web(`/pools/near/${encodeURIComponent(aId)}/${encodeURIComponent(bId)}`),
    extra);
}

async function removeLiquidity({ a, b }) {
  const rA = await wantNearAsset('a', a); if (rA.error) return fail(rA.error);
  const rB = await wantNearAsset('b', b); if (rB.error) return fail(rB.error);
  const A = rA.want, B = rB.want;
  const r = (await roster()).map;
  const aId = A.native ? WNEAR : A.id, bId = B.native ? WNEAR : B.id;
  return prepared('remove_liquidity',
    `Withdraw your position from the ${label(A, r)} / ${label(B, r)} pool on NEAR`,
    web(`/pools/near/${encodeURIComponent(aId)}/${encodeURIComponent(bId)}`),
    { prefill: NOFILL });
}

const netParam = (v) => {
  const s = String(v || '').trim();
  return /^[A-Za-z0-9 ._-]{1,32}$/.test(s) ? s : '';
};

async function bridge({ asset, to_network, amount, recipient }) {
  if (!asset || !to_network) return fail('asset and to_network are required.');
  if (!(+amount > 0)) return fail('amount must be positive.');
  // NO QUERY ON THIS LINK, and that is deliberate rather than an omission. /bridge/near carries no
  // lx-bridgeprefill, so parameters here would be dropped on the floor while the response implied
  // they had been carried. Stellar and the XRPL fork do read them; this chain does not yet.
  const net = netParam(to_network);
  return prepared('bridge', `Bridge ${amount} ${asset} from NEAR to ${to_network}`,
    web('/bridge/near'),
    { to_network: net || String(to_network).slice(0, 32),
      ...(recipient ? { recipient } : {}),
      enter_on_page: { asset: String(asset), to_network: net || null, amount: +amount,
        ...(recipient ? { recipient } : {}) },
      prefill: NOFILL,
      // Three corridors, not one, and which one carries a given asset is decided by the page's own
      // route table. Naming a corridor here would be a guess that reads as a fact.
      note: 'NEAR reaches other chains through three corridors — NEAR Intents, the Omni Bridge and '
        + 'Wormhole — and which one carries a given asset to a given network is decided by the '
        + 'bridge page\'s route table, not here. The route, the corridor and the fee are shown '
        + 'before you approve. A bridged asset usually arrives as a wrapped representation rather '
        + 'than the native coin.'
        + (recipient ? '' : ' No destination address was given, so enter the receiving address on the page.') });
}

async function launchToken({ code, supply }) {
  if (!/^[A-Za-z0-9]{1,20}$/.test(String(code || ''))) return fail('code must be 1-20 letters or digits.');
  if (!(+supply > 0)) return fail('supply must be positive.');
  return prepared('launch_token', `Issue ${supply} ${code} on NEAR`, web('/launchpad/near'),
    { prefill: NOFILL,
      note: 'A NEAR launch deploys a fungible-token contract under its own account and seeds a pool. '
        + 'The LP shares from that initial pool are sent to the all-zeros account, so the starting '
        + 'liquidity is permanently locked and cannot be pulled — by you either. Storage for the new '
        + 'contract is paid in locked NEAR at deploy time.' });
}

export const NEAR = {
  getMarket, listPools, getPortfolio, getQuote, listCuratedAssets, getOrderbook, getRewards,
  swap, addLiquidity, removeLiquidity, bridge, launchToken,
};
