// The NEAR half of the connector: the same fourteen tools, against a third chain.
//
// WHY A THIRD FILE AND NOT A BRANCH INSIDE THE XRPL ONE. The same reason xrpl.js is not a branch
// inside tools.js, and it is sharper here, because NEAR disagrees with BOTH of the others on the one
// thing every tool touches -- what an asset IS. Stellar: a CODE plus a G-address. XRP Ledger: a
// 40-hex currency plus an r-address. NEAR: a bare CONTRACT ACCOUNT, `lumos.lumoscore.near`, with no
// code and no issuer anywhere in it. There is nothing to share below the surface, and interleaving
// three identity models inside fourteen functions is fourteen places for the wrong one to win.
//
// WHAT NEAR CANNOT DO, SAID IN THE RESPONSE RATHER THAN GUESSED AT. Two tools have no NEAR surface
// and they REFUSE with the reason instead of returning a plausible shape:
//
//   * get_orderbook -- NEAR has no order book. Rhea is an AMM; there are no resting offers to read.
//     Returning an empty book would read as "no liquidity", which is a different and false claim.
//   * get_quote    -- there is no swap-router endpoint on this chain. /lxapi/nearoneclick?op=quote
//     is NEAR Intents and is CROSS-chain only: it demands a destination asset on another network and
//     a refund account, and quoting a same-chain swap through it is not a thing it does. Deriving a
//     price from pool reserves here instead would be this server inventing a number, which is the one
//     thing it must not do -- see rule 2 in api.js.
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
  if (a.native) {
    return fail('NEAR is the quote asset here; ask for a token priced against it. '
      + 'list_curated_assets carries the NEAR/USD rate itself.');
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
  return ok(Object.assign({
    chain: 'near',
    count: rows.length, network_total: d && d.summary && d.summary.pools != null ? d.summary.pools : null,
    filtered_to: tok,
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

// NO ROUTER ON THIS CHAIN, so no quote. See the file header for why one-click is not a substitute and
// why pool arithmetic is not either.
async function getQuote({ from, to, amount }) {
  const rf = await wantNearAsset('from', from); if (rf.error) return fail(rf.error);
  const rt = await wantNearAsset('to', to);     if (rt.error) return fail(rt.error);
  if (!(+amount > 0)) return fail('amount must be a positive number.');
  return fail('There is no swap quote for NEAR through this connector. LumosCore has no NEAR '
    + 'swap-router endpoint — the one-click route it does have is cross-chain only (NEAR Intents), '
    + 'and it will not price a swap between two NEAR tokens. Rather than derive a number from pool '
    + 'reserves and present it as a quote, this refuses: use get_market for each side\'s price in '
    + 'NEAR and list_pools for the liquidity behind the pair, and the executable price is quoted on '
    + `/trade/near/${rt.want.native ? rf.want.id : rt.want.id} at signing time.`);
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
  return fail('NEAR has no order book on LumosCore. Trading here goes through Rhea\'s AMM pools, '
    + 'which hold reserves rather than resting bids and asks, so there is no book to quote — an '
    + 'empty one would read as "no liquidity", which would be false. Use list_pools'
    + (a.native ? '' : ` with asset: "${a.id}"`) + ' to see the pools and their depth, and '
    + 'get_market for the current price.');
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
    const q = `?side=${side}` + (amt ? `&amount=${amt}` : '');
    return prepared('swap', summary, web('/trade/near/' + page.id) + q, {
      enter_on_page: amt ? undefined : { side, amount: +amount, pair: `${fc} → ${tc}` },
      opens: `The ${label(page, r)} trade page on NEAR.`,
      // Measured, not assumed: lx-tradeprefill is present on this page and reads ?side= and ?amount=.
      prefill: amt
        ? `The side and amount ride in the link — /trade/near/<contract> reads ?side= and ?amount=.`
        : 'The amount is not carried: it does not survive this page\'s plain-digits check at this '
          + 'token\'s precision, so enter it on the page.',
      quote: null,
      quote_note: 'No quote is attached. NEAR has no swap-router endpoint on LumosCore, so this '
        + 'server will not put a number on it — the executable price is quoted on the page at '
        + 'signing time. See get_quote.',
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
