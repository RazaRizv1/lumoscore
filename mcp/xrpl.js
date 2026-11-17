// The XRP Ledger half of the connector: the same fourteen tools, against a different chain.
//
// WHY A SEPARATE FILE AND NOT A BRANCH INSIDE EACH TOOL. Almost nothing is shared below the surface.
// Stellar identifies an asset as CODE + a G-address and reads it from Horizon; XRPL identifies one as
// a 40-hex currency + an r-address and reads it from xrpl.to and a rippled node. Interleaving the two
// inside fourteen functions would mean fourteen places where a Stellar assumption can reach an XRPL
// answer -- and the fork has already shipped that exact bug once, when the XRPL Trade-Asset page
// ignored the token in its own url and rendered Stellar LUMOS. One file per chain, one dispatch point.
//
// SAME RULES AS THE STELLAR SIDE. No key, no signing, no invented numbers. Where XRPL cannot answer
// what Stellar can, the tool says so in the response rather than returning a Stellar-shaped guess.
import { api, apiPost, xrplRpc, web, ApiError } from './api.js';

const nf = (n, d = 7) => (n == null || !isFinite(n) ? null : +(+n).toFixed(d));

// An amount as PLAIN decimal digits, for a prefill link. String(0.0000001) is "1e-7", and the page
// refuses anything that is not plain digits -- deliberately, since it is about to be approved -- so a
// small deposit would silently arrive as an empty box. Six decimals because that is a drop, the
// smallest unit XRP has; trailing zeros are trimmed so the field reads the way a person would write
// it. An issued currency carries more precision than this, but not in a box someone is about to read.
// IT VALIDATES ITS OWN OUTPUT against the rule the page enforces, and returns '' rather than a value
// the page will throw away. Six decimals makes this sharper here than on Stellar: 0.0000001 XRP is
// below a drop and rounds to "0", and the page treats an empty-or-zero box as unfilled, so it would
// write "0" again on every tick for the whole watch window. Exponent notation ("1e+21") is simply
// refused by the page. Either way, emit nothing and let the amount stand in the reply text alone.
const plainAmount = (v) => {
  const n = +v;
  if (!isFinite(n) || n <= 0) return '';
  const s = n.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  if (!/^[0-9]+(\.[0-9]+)?$/.test(s) || +s === 0) return '';
  return s;
};
function ok(obj) { return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] }; }
function fail(msg) { return { isError: true, content: [{ type: 'text', text: msg }] }; }

// xrpl.to's terms require a visible credit on any surface showing their data, and an MCP response IS
// such a surface -- it is read by a person through an agent. The endpoints already echo the credit in
// their payloads for exactly this reason, so it is carried through rather than dropped here.
const CREDIT = { data_source: 'xrpl.to', attribution: 'Data by xrpl.to', attribution_url: 'https://xrpl.to' };

// Base58 minus 0, O, I and l. Length is 25-35 including the leading r.
export const R_RE = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;

// ---- asset identity ------------------------------------------------------------------------------
//
// A LEDGER CURRENCY IS NOT A TICKER. On the wire XRPL carries either a three-character code or a
// 40-character hex blob, and most real tokens are the blob: RLUSD is
// 524C555344000000000000000000000000000000. An agent cannot be asked to type that, and the website's
// own urls do not use it either -- /trade/xrpl/RLUSD-rMxCK… is CODE-ISSUER, the same shape Stellar
// uses. So CODE-ISSUER is the id this connector speaks on both chains, and the hex conversion happens
// here, once, where it can be tested.
//
// The conversion is not reversible for every input, which is the part worth stating: a 40-hex
// currency whose bytes are not printable ASCII has no ticker, and this returns the hex itself rather
// than mangling it into something that looks like a code.
export function currencyHex(code) {
  const c = String(code || '');
  if (c === 'XRP') return 'XRP';
  if (/^[0-9A-Fa-f]{40}$/.test(c)) return c.toUpperCase();   // already a currency, pass it through
  if (c.length <= 3) return c;                                // standard three-character currency
  let h = '';
  for (let i = 0; i < c.length; i++) h += c.charCodeAt(i).toString(16).padStart(2, '0');
  return (h + '0'.repeat(40)).slice(0, 40).toUpperCase();
}

export function codeFromCurrency(cur) {
  const c = String(cur || '');
  if (!/^[0-9A-Fa-f]{40}$/.test(c)) return c;
  let s = '';
  for (let i = 0; i < 40; i += 2) {
    const b = parseInt(c.slice(i, i + 2), 16);
    if (b === 0) break;
    // Anything outside printable ASCII means this is not a ticker at all (an LP token, or a currency
    // carrying packed bytes). Returning the hex is the honest answer; half-decoding it would invent a
    // name that no explorer or wallet would agree with.
    if (b < 0x20 || b > 0x7e) return c.toUpperCase();
    s += String.fromCharCode(b);
  }
  return s || c.toUpperCase();
}

// "XRP", or CODE-ISSUER where ISSUER is an r-address. The code half may itself be a 40-hex currency,
// so a caller who already has the ledger form is not forced to decode it first.
export function parseXrplAsset(s) {
  const v = String(s || '').trim();
  if (!v) return null;
  if (/^xrp$/i.test(v)) return { code: 'XRP', issuer: null, id: 'XRP', currency: 'XRP', native: true };
  // rsplit: an r-address contains no "-", but a token code can, so the LAST hyphen is the separator.
  const i = v.lastIndexOf('-');
  if (i <= 0) return null;
  const code = v.slice(0, i), issuer = v.slice(i + 1);
  if (!R_RE.test(issuer) || !code) return null;
  return { code: codeFromCurrency(code), issuer, id: `${codeFromCurrency(code)}-${issuer}`, currency: currencyHex(code), native: false };
}

// The form /lxapi/xrpltoken wants: the upstream's own "issuer-currencyHex".
const upstreamId = (a) => (a.native ? 'XRP' : `${a.issuer}-${a.currency}`);
// The form the ledger wants in a request.
const rippled = (a) => (a.native ? { currency: 'XRP' } : { currency: a.currency, issuer: a.issuer });
// The form the website's urls want.
const slug = (a) => (a.native ? 'XRP' : a.id);

// The shape hint, kept in one place. It used to live in a `bad(what, v)` helper that every tool called
// to REJECT a bare code; now that a bare code resolves, the rejection is only for a malformed id and
// the helper had no callers left, so the text moved here rather than going stale in a dead function.
const IDHINT = 'Use CODE-ISSUER (e.g. RLUSD-rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De) or XRP.';

// A BARE CODE IS NOT AN IDENTITY HERE EITHER, and the XRP Ledger makes it worse than Stellar: 20,593
// tokens are live and popular codes are squatted. So a bare code resolves ONLY through the same
// roster list_curated_assets serves -- /lxapi/xrpltokens -- filtered to the tokens LumosCore itself
// vouches for (`vf`, which that endpoint already substitutes for the upstream gateway flag and which
// is deliberately narrower).
//
// AMBIGUITY IS THE COMMON CASE HERE, not the edge. Measured on the live roster 2026-11-17: USD
// appears THREE times and BTC twice, every one of them vouched. Both refuse and name each candidate.
// Resolving to the highest-volume one would hand an agent a different issuer's token than the one it
// asked for, on a screen where the next step is a swap.
//
// A MISS IS NOT A VERDICT ON THE TOKEN. The roster is 100 rows out of 20,593, so a code that does not
// resolve may still be a perfectly real asset. The message says so, because otherwise an agent
// reports "no such token" when the token simply is not in the top hundred by volume.
async function resolveXrplCode(asset) {
  const code = String(asset || '').trim();
  // A hyphen means they meant a full id and it did not parse -- that is a malformed id, not a code to
  // look up, so it gets the shape hint instead of a roster search.
  if (!code || code.includes('-')) return { error: `"${asset}" is not an XRP Ledger asset id. ${IDHINT}` };
  let d = null;
  try { d = await api('/lxapi/xrpltokens?n=100'); } catch (_) { d = null; }
  const rows = ((d && d.rows) || []).filter((r) => +r.vf === 1);
  const hit = rows.filter((r) => String(r.n || '').toUpperCase() === code.toUpperCase());
  if (!hit.length) {
    const total = d && d.total != null ? d.total : null;
    return { error: `"${asset}" is not an XRP Ledger asset id, and no vouched token in the roster `
      + 'carries that code. That roster is the top 100 tokens by 24h volume'
      + (total ? ` out of ${total} on the ledger` : '')
      + ', so this may still be a real asset — pass the full CODE-ISSUER. list_curated_assets returns '
      + 'every code this server can resolve on its own.' };
  }
  if (hit.length > 1) {
    return { error: `"${asset}" is ambiguous — ${hit.length} vouched tokens carry that code: `
      + hit.map((r) => `${r.n}-${r.i}`).join(', ') + '. Pass the full CODE-ISSUER.' };
  }
  const w = parseXrplAsset(`${hit[0].n}-${hit[0].i}`);
  return w ? { want: w } : { error: `"${asset}" could not be resolved to an asset id.` };
}

// Mirrors wantAsset() in tools.js, including the `label` prefix: add_liquidity and get_quote each take
// two assets and the bare message cannot say which one was wrong.
async function wantXrplAsset(label, x) {
  const direct = parseXrplAsset(x);
  if (direct) return { want: direct };
  const r = await resolveXrplCode(x);
  return r.want ? r : { error: `${label}: ${r.error}` };
}

// ---- reads ---------------------------------------------------------------------------------------

async function getMarket({ asset }) {
  const ra = await wantXrplAsset('asset', asset);
  if (ra.error) return fail(ra.error);
  const a = ra.want;
  if (a.native) return fail('XRP is the quote asset here; ask for a token priced against it.');
  const d = await api('/lxapi/xrpltoken?id=' + encodeURIComponent(upstreamId(a)));
  if (!d || d.ok === false) return fail(`No market data for ${a.code} on the XRP Ledger.`
    + (d && d.error ? ` (${d.error})` : '') + ' It may not be traded, or the issuer may be wrong.');
  // `price` is in XRP and `usd` is the endpoint's own converted figure -- it is served only when a
  // stablecoin peg check passes upstream, so a null here means "could not be stood behind", not zero.
  return ok(Object.assign({
    chain: 'xrpl',
    asset: a.id, code: a.code, issuer: a.issuer, currency: a.currency,
    issuer_name: d.user || null, issuer_domain: d.domain || null,
    price_xrp: nf(d.price), price_usd: nf(d.usd),
    change_1h_pct: nf(d.p1h, 2), change_24h_pct: nf(d.p24, 2), change_7d_pct: nf(d.p7, 2),
    volume_24h_xrp: nf(d.vol24, 2), trades_24h: d.trades24 ?? null,
    high_24h_xrp: nf(d.hi), low_24h_xrp: nf(d.lo),
    tvl_xrp: nf(d.tvl, 2),
    supply: nf(d.issued, 4), circulating: nf(d.circulating, 4),
    holders: d.holders ?? null, trustlines: d.trustlines ?? null, open_offers: d.offers ?? null,
    market_cap_xrp: nf(d.marketcap, 2),
    verified: !!(+d.verified === 1),
    market_cap_note: 'supply x last price. On a thin book this is arithmetic, not a valuation — '
      + 'check get_orderbook depth before trusting it.',
    page: web('/trade/xrpl/' + slug(a)),
  }, CREDIT));
}

async function listPools({ limit = 20, asset }) {
  let want = null;
  if (asset) {
    const rw = await wantXrplAsset('asset', asset);
    if (rw.error) return fail(rw.error);
    want = rw.want;
  }
  const n = Math.max(1, Math.min(100, +limit || 20));
  // The endpoint filters by ISSUER, not by a full asset id, so an issuer with two tokens comes back
  // carrying both and the second filter below is what narrows it to the one that was asked for.
  const q = '/lxapi/xrplpools?n=' + n + (want && !want.native ? '&issuer=' + encodeURIComponent(want.issuer) : '');
  const d = await api(q);
  let rows = (d && d.rows) || [];
  if (want) {
    const hit = (s) => (want.native
      ? String((s || {}).c || '').toUpperCase() === 'XRP'
      : String((s || {}).c || '').toUpperCase() === want.currency.toUpperCase() && (s || {}).i === want.issuer);
    rows = rows.filter((p) => hit(p.a1) || hit(p.a2));
  }
  const side = (s) => {
    const c = String((s || {}).c || '');
    const isXrp = c.toUpperCase() === 'XRP';
    return { asset: isXrp ? 'XRP' : `${codeFromCurrency(c)}-${(s || {}).i}`, code: isXrp ? 'XRP' : codeFromCurrency(c), amount: nf((s || {}).v, 6) };
  };
  return ok(Object.assign({
    chain: 'xrpl',
    count: rows.length, network_total: d && d.total != null ? d.total : null,
    filtered_to: want ? want.id : null,
    // Stated because it changes what the list means. Liquidity can be conjured for free by pairing a
    // worthless token with itself, so a liquidity ranking puts fake pools on top; volume cannot be
    // faked without paying the fees. The site's own Pools page ranks the same way for the same reason.
    ranked_by: 'volume over the last 24h, not liquidity',
    network_summary: d && d.summary ? {
      liquidity_xrp: nf(d.summary.liquidity, 2), volume_24h_xrp: nf(d.summary.vol24, 2),
      fees_24h_xrp: nf(d.summary.fees24, 4), average_fee_pct: nf(d.summary.avgFee, 4),
    } : null,
    pools: rows.map((p) => ({
      account: p.acct,
      pair: `${side(p.a1).code} / ${side(p.a2).code}`,
      a: side(p.a1), b: side(p.a2),
      fee_pct: nf(p.fee, 4), liquidity_xrp: nf(p.liq, 2), volume_24h_xrp: nf(p.vol, 2),
      fees_24h_xrp: nf(p.fees, 4), apy_pct: nf(p.apy, 2), holders: p.holders ?? null, depth: p.depth || null,
      page: web('/pools/xrpl/id/' + p.acct),
    })),
  }, CREDIT));
}

async function getPortfolio({ address }) {
  const addr = String(address || '').trim();
  if (!R_RE.test(addr)) return fail('address must be an XRP Ledger account (r…, 25-35 characters).');
  const info = await xrplRpc('account_info', { account: addr, ledger_index: 'validated' });
  // actNotFound is a REAL ANSWER -- an unfunded account -- and must not be reported as a failure, the
  // same way Horizon's 404 is a funded:false on the Stellar side.
  if (info && info.error === 'actNotFound') {
    return ok({ chain: 'xrpl', address: addr, funded: false,
      note: 'This account does not exist on the XRP Ledger yet. It holds nothing until it is funded '
        + 'with the base reserve.' });
  }
  if (!info || !info.account_data) throw new ApiError('Could not read the account from the XRP Ledger.', 0);
  const drops = +(info.account_data.Balance || 0);
  const ownerCount = +(info.account_data.OwnerCount || 0);

  // Trustlines and offers are a bonus: a failure on either must not cost the caller the XRP balance.
  let lines = [], offers = [];
  try {
    const l = await xrplRpc('account_lines', { account: addr, ledger_index: 'validated', limit: 400 });
    lines = (l && l.lines) || [];
  } catch (_) { lines = []; }
  try {
    const o = await xrplRpc('account_offers', { account: addr, ledger_index: 'validated', limit: 400 });
    offers = (o && o.offers) || [];
  } catch (_) { offers = []; }

  // THE RESERVE IS NOT SPENDABLE, and saying so is the difference between a balance and a budget.
  // Every trustline, offer and AMM position locks another increment on top of the base reserve; an
  // agent told only the raw balance will size a swap the account cannot sign. Same lesson as MAX
  // rounding a balance up: ONE place decides what "spendable" means.
  //
  // THE TWO NUMBERS ARE READ FROM THE LEDGER, NOT HARDCODED. They are amendment-controlled and have
  // already moved twice -- 200 XRP base to 10, then to 1 -- so a constant here is a number that is
  // right until the day it quietly is not, in the one field someone sizes a transaction against.
  // The current values are kept only as a fallback for a server_info that did not answer, and the
  // response says which of the two it used.
  let base = 1, perItem = 0.2, reserveSource = 'fallback constants (server_info did not answer)';
  try {
    const si = await xrplRpc('server_info', {});
    const v = ((si || {}).info || {}).validated_ledger || {};
    if (+v.reserve_base_xrp > 0 && +v.reserve_inc_xrp >= 0) {
      base = +v.reserve_base_xrp; perItem = +v.reserve_inc_xrp;
      reserveSource = 'live, from server_info';
    }
  } catch (_) { /* the fallback above is already correct today; a failure must not lose the balance */ }
  const reserve = base + ownerCount * perItem;
  const xrp = drops / 1e6;

  const amt = (v) => (v && typeof v === 'object' ? +v.value : +v / 1e6);
  const aid = (v) => (v && typeof v === 'object' ? `${codeFromCurrency(v.currency)}-${v.issuer}` : 'XRP');

  return ok(Object.assign({
    chain: 'xrpl',
    address: addr, funded: true,
    xrp_balance: nf(xrp, 6),
    reserve_xrp: nf(reserve, 6),
    spendable_xrp: nf(Math.max(0, xrp - reserve), 6),
    reserve_note: `${base} XRP base + ${perItem} XRP for each of ${ownerCount} owned objects `
      + '(trustlines, offers, AMM positions). Only spendable_xrp can actually be sent or swapped.',
    reserve_source: reserveSource,
    owner_count: ownerCount,
    trustlines: lines.map((l) => ({
      asset: `${codeFromCurrency(l.currency)}-${l.account}`,
      code: codeFromCurrency(l.currency), issuer: l.account,
      balance: nf(+l.balance, 8), limit: nf(+l.limit, 8),
      frozen: !!(l.freeze || l.freeze_peer),
      // A NEGATIVE BALANCE MEANS THIS ACCOUNT IS THE ISSUER of that token, not that it owes money.
      issued_by_this_account: +l.balance < 0,
    })),
    open_orders: offers.map((o) => ({
      seq: o.seq,
      selling: aid(o.taker_gets), selling_amount: nf(amt(o.taker_gets), 8),
      buying: aid(o.taker_pays), buying_amount: nf(amt(o.taker_pays), 8),
    })),
    page: web('/account/xrpl/' + addr),
  }, {}));
}

// WHY A QUOTE NEEDS AN ADDRESS HERE AND NOT ON STELLAR, which is the one real asymmetry between the
// two chains in this connector.
//
// Stellar's strict-send path finding takes a source ASSET and answers for anybody. XRPL's
// ripple_path_find takes a source ACCOUNT, because the routes available depend on that account's own
// trustlines and balances -- the same swap is routable for one account and not for another.
//
// The tempting shortcut is to walk book_offers instead and skip the address. Measured, that is wrong:
// the XRP/RLUSD AMM holds about 1.9M XRP, and the AMM account does not appear in the top of
// book_offers at all. A book-only quote would price a swap against a few thousand XRP of resting
// offers and ignore the pool that would actually fill it. A number that confident and that wrong is
// worse than asking for one more argument.
async function getQuote({ from, to, amount, address }) {
  const rf = await wantXrplAsset('from', from); if (rf.error) return fail(rf.error);
  const rt = await wantXrplAsset('to', to);     if (rt.error) return fail(rt.error);
  const f = rf.want, t = rt.want;
  const amt = +amount;
  if (!isFinite(amt) || amt <= 0) return fail('amount must be a positive number.');
  if (f.id === t.id) return fail('from and to are the same asset.');
  const addr = String(address || '').trim();
  if (!R_RE.test(addr)) {
    return fail('On the XRP Ledger a quote needs `address` — your r… account. The ledger\'s own router '
      + '(ripple_path_find) answers per account, because which routes exist depends on the trustlines '
      + 'and balances that account holds. Pass address to get the real executable number. '
      + 'get_market gives an indicative price without one.');
  }

  // destination_amount "-1" asks the router for the most it can deliver. For an IOU the -1 goes in
  // `value`; for XRP the whole field is the string.
  const destination_amount = t.native ? '-1' : { currency: t.currency, issuer: t.issuer, value: '-1' };
  const d = await apiPost('/lxapi/xrplpath', {
    source_account: addr,
    destination_account: addr,
    destination_amount,
    source_currencies: [rippled(f)],
  });
  const alts = (d && (d.alternatives || (d.result && d.result.alternatives))) || [];
  if (!d || d.ok === false) {
    throw new ApiError('The XRP Ledger path finder could not be reached' + (d && d.error ? `: ${d.error}` : '.'), 0);
  }
  if (!alts.length) {
    return fail(`No route found for ${amt} ${f.code} → ${t.code} from ${addr}. `
      + 'There may be no liquidity connecting them, or this account may not hold a trustline for one side.');
  }

  // The router answers "spend this much to deliver that much". It is quoted for the WHOLE spendable
  // balance by the -1 above, so the delivered amount is scaled to the amount actually asked for, and
  // the source amount it assumed is reported so the scaling is visible rather than hidden.
  const val = (v) => (v && typeof v === 'object' ? +v.value : +v / 1e6);
  const best = alts.reduce((x, y) => (val(y.destination_amount) / val(y.source_amount)
    > val(x.destination_amount) / val(x.source_amount) ? y : x));
  const rate = val(best.destination_amount) / val(best.source_amount);
  return ok({
    chain: 'xrpl',
    from: f.id, to: t.id, amount_in: amt,
    amount_out: nf(rate * amt, 8), rate: nf(rate, 8),
    routes_considered: alts.length,
    quoted_for: nf(val(best.source_amount), 8),
    scaled: Math.abs(val(best.source_amount) - amt) > 1e-9,
    scale_note: 'The ledger quotes the best route for the largest amount it can source, so the rate '
      + 'above is that route\'s rate applied to your amount. A larger order moves further up the book.',
    trading_fee_pct: 0.2,
    fee_note: 'LumosCore charges 0.2%, or 0.1% if you hold 250,000+ LUMOS. The XRP Ledger network fee '
      + 'is a fraction of a drop.',
    quote_source: 'XRP Ledger ripple_path_find (the router the ledger settles through), via lumoscore.com',
    note: 'Indicative. The executed price is quoted again at signing time.',
  });
}

async function listCuratedAssets({ verified_only = false, limit = 100 }) {
  const d = await api('/lxapi/xrpltokens?n=' + Math.max(1, Math.min(100, +limit || 100)));
  const rows = (d && d.rows) || [];
  // `vf` is LumosCore's own vouch, not the upstream's gateway flag -- the endpoint already makes that
  // substitution, and the two disagree: the upstream ticks tokens the platform declines to vouch for.
  const out = rows
    .filter((r) => (verified_only ? +r.vf === 1 : true))
    .map((r) => ({
      asset: `${r.n}-${r.i}`, code: r.n, issuer: r.i, currency: r.c,
      issuer_name: r.u || null, domain: r.dom || null, origin: r.o || null,
      verified: +r.vf === 1,
      price_xrp: nf(r.p), price_usd: d && d.usd ? nf(r.p * d.usd) : null,
      volume_24h_xrp: nf(r.v, 2), holders: r.h ?? null,
      page: web('/trade/xrpl/' + `${r.n}-${r.i}`),
    }));
  return ok(Object.assign({
    chain: 'xrpl',
    count: out.length, network_total: d && d.total != null ? d.total : null,
    xrp_usd: d && d.usd ? nf(d.usd, 6) : null,
    assets: out,
    note: 'The XRP Ledger roster is the top tokens by 24h volume, not a hand-curated list like '
      + 'Stellar\'s. `verified` is LumosCore\'s own vouch, which is deliberately narrower than the '
      + 'upstream gateway flag.',
  }, CREDIT));
}

async function getOrderbook({ asset, limit = 8 }) {
  const ra = await wantXrplAsset('asset', asset);
  if (ra.error) return fail(ra.error);
  const a = ra.want;
  if (a.native) return fail('XRP is the quote asset here; ask for a token priced against it.');
  const n = Math.max(1, Math.min(50, +limit || 8));
  const XRP = { currency: 'XRP' };
  const tok = rippled(a);

  // Two calls, because a book on the XRP Ledger is directional: one side is people selling the token
  // for XRP, the other is people selling XRP for the token. Asking once and negating it would invent
  // the other half.
  const [asksR, bidsR] = await Promise.all([
    xrplRpc('book_offers', { taker_gets: tok, taker_pays: XRP, limit: n, ledger_index: 'validated' }),
    xrplRpc('book_offers', { taker_gets: XRP, taker_pays: tok, limit: n, ledger_index: 'validated' }),
  ]);
  const num = (v) => (v && typeof v === 'object' ? +v.value : +v / 1e6);
  // asks: someone gives the TOKEN and wants XRP -> price = xrp per token
  const asks = ((asksR && asksR.offers) || []).map((o) => ({
    price_xrp: nf(num(o.TakerPays) / num(o.TakerGets), 10),
    amount: nf(num(o.TakerGets), 8), total_xrp: nf(num(o.TakerPays), 8),
  }));
  // bids: someone gives XRP and wants the TOKEN -> price = xrp per token, the other way round
  const bids = ((bidsR && bidsR.offers) || []).map((o) => ({
    price_xrp: nf(num(o.TakerGets) / num(o.TakerPays), 10),
    amount: nf(num(o.TakerPays), 8), total_xrp: nf(num(o.TakerGets), 8),
  }));
  const bestBid = bids.length ? bids[0].price_xrp : null;
  const bestAsk = asks.length ? asks[0].price_xrp : null;
  const depth = (rows) => nf(rows.reduce((s, r) => s + (+r.total_xrp || 0), 0), 6);

  return ok({
    chain: 'xrpl',
    asset: a.id, code: a.code, quote: 'XRP',
    best_bid_xrp: bestBid, best_ask_xrp: bestAsk,
    spread_xrp: bestBid != null && bestAsk != null ? nf(bestAsk - bestBid, 10) : null,
    spread_pct: bestBid > 0 && bestAsk != null ? nf(((bestAsk - bestBid) / bestBid) * 100, 4) : null,
    bid_depth_xrp: depth(bids), ask_depth_xrp: depth(asks),
    bids, asks,
    // THE AMM IS NOT IN THIS BOOK, and that changes what the numbers mean. Measured on XRP/RLUSD: the
    // pool holds about 1.9M XRP and its account is nowhere in the top offers. So a thin-looking book
    // does not mean a swap would fill badly -- get_quote goes through the router, which does see the
    // pool, and that is the number to trade on.
    amm_note: 'AMM pool liquidity is NOT included here — book_offers returns resting offers only. '
      + 'Use get_quote for an executable number, and list_pools to see the pool behind the pair.',
    depth_note: 'A tight spread on a dust-sized best offer is not liquidity. Read the depth columns '
      + 'and the rows, not just the best bid and ask.',
    source: 'XRP Ledger book_offers, from a validated ledger',
    page: web('/trade/xrpl/' + slug(a)),
  });
}

async function getRewards({ address }) {
  const addr = String(address || '').trim();
  if (addr && !R_RE.test(addr)) return fail('address must be an XRP Ledger account (r…, 25-35 characters).');
  return ok({
    chain: 'xrpl',
    programs: ['LP rewards', 'Holder rewards', 'Trading rewards'],
    per_round: '3,000,000 LUMOS per round, per chain',
    holder_rewards: 'Hold 5,000,000+ LUMOS on the XRP Ledger; every further 5,000,000 earns another share.',
    address: addr || null,
    page: web('/rewards/xrpl'),
    // The Stellar roster is a fixed list this server can safely restate. The XRPL roster is not the
    // same list and is not duplicated here: naming Stellar's incentivised pools under an XRPL heading
    // would be a confident wrong answer, which is the one thing this connector must not produce.
    note: 'The incentivised pool roster for the XRP Ledger is shown on the Rewards page and is not '
      + 'restated here — it is a different roster from Stellar\'s, and a list that disagreed with the '
      + 'page would be worse than a link to it. Eligibility and claimable amounts are computed there '
      + 'against the live ledger.',
  });
}

// ---- writes: prepared, never signed ---------------------------------------------------------------
//
// WHAT AN XRPL APPROVE LINK CAN AND CANNOT DO TODAY, stated in the payload rather than discovered by
// the user. The Stellar pages carry `lx-tradeprefill`, which reads ?side= and ?amount= and fills the
// swap panel in. The XRPL fork does not: it is built from a frozen copy of the Stellar output taken
// before that layer existed, and grepping the live page for the layer id returns zero. So an XRPL
// link opens the right page on the right chain, and the amounts are typed by the person.
//
// That is said in every write response. Claiming a prefill that does not happen would be the same
// class of failure as the bug this connector was just fixed for on Stellar -- a link that promises to
// carry the request and then drops it.
const NOFILL = 'The XRP Ledger pages do not accept a pre-filled swap link yet, so the amounts are '
  + 'shown here for you to enter on the page. The link opens the correct pair on the correct chain.';

function prepared(action, summary, url, extra) {
  return ok(Object.assign({
    chain: 'xrpl', action, summary,
    approve_url: url,
    signed: false,
    next_step: 'Open approve_url. LumosCore will show the prepared transaction and your wallet will '
      + 'ask you to sign it. Nothing moves until you approve it there.',
    why: 'This server never holds a key and never signs. It prepares the action and hands it back to you.',
  }, extra || {}));
}

async function swap({ from, to, amount, address }) {
  const rf = await wantXrplAsset('from', from); if (rf.error) return fail(rf.error);
  const rt = await wantXrplAsset('to', to);     if (rt.error) return fail(rt.error);
  const f = rf.want, t = rt.want;
  if (!(+amount > 0)) return fail('amount must be a positive number.');
  if (f.id === t.id) return fail('from and to are the same asset.');

  // A quote needs an account on this chain (see getQuote). Without one the swap is still prepared --
  // the link is the useful part -- and the response says plainly that no number was obtained, rather
  // than quietly omitting the field and letting the agent assume it failed to matter.
  let quote = null, quoteError = null;
  if (address) {
    const q = await getQuote({ from, to, amount, address });
    if (q.isError) quoteError = q.content[0].text;
    else quote = JSON.parse(q.content[0].text);
  } else {
    quoteError = 'No `address` was given, so no executable quote was fetched. '
      + 'ripple_path_find answers per account on the XRP Ledger.';
  }

  const summary = `Swap ${amount} ${f.code} for ${t.code} on the XRP Ledger`
    + (quote ? ` — about ${quote.amount_out} ${t.code}` : '');

  // XRP ON ONE SIDE -> the Trade-Asset page, which pairs ITS token with XRP and nothing else.
  if (f.native || t.native) {
    const page = f.native ? t : f;
    const side = t.native ? 'sell' : 'buy';
    return prepared('swap', summary, web(`/trade/xrpl/${slug(page)}`), {
      quote, quote_error: quoteError,
      enter_on_page: { side, amount: +amount, pair: `${f.code} → ${t.code}` },
      opens: `The ${page.code} trade page on the XRP Ledger.`,
      prefill: NOFILL,
    });
  }

  // NEITHER SIDE IS XRP. The only surface that takes an arbitrary pair is Custom Swap on the
  // dashboard -- and /dashboard carries no chain in its path, so which build it serves is decided by
  // the lx_chain cookie, which is only written when a wallet connects. Handing back /dashboard here
  // would send anyone without that cookie to the STELLAR dashboard to perform an XRP Ledger swap.
  //
  // So this returns the route instead of a link that might be the wrong chain. /trade/xrpl is a real
  // XRPL-pathed page and is where the person starts.
  return prepared('swap', summary, web('/trade/xrpl'), {
    quote, quote_error: quoteError,
    enter_on_page: { pair: `${f.code} → ${t.code}`, amount: +amount },
    opens: 'The XRP Ledger trade page.',
    route: 'Neither side is XRP, so this settles through the Custom Swap on the dashboard '
      + '(Quick actions → Custom Swap) once an XRP Ledger wallet is connected.',
    limitation: 'There is no chain-addressed url for the dashboard — /dashboard serves whichever '
      + 'network your wallet last connected to — so this link deliberately stops at the XRP Ledger '
      + 'trade page rather than risk opening the Stellar dashboard for an XRP Ledger swap.',
    prefill: NOFILL,
  });
}

async function addLiquidity({ a, b, amount_a, amount_b }) {
  const rA = await wantXrplAsset('a', a); if (rA.error) return fail(rA.error);
  const rB = await wantXrplAsset('b', b); if (rB.error) return fail(rB.error);
  const A = rA.want, B = rB.want;
  if (!(+amount_a > 0) || !(+amount_b > 0)) return fail('amount_a and amount_b must both be positive.');
  if (A.id === B.id) return fail('a and b are the same asset.');

  // The pool, if it exists, so the response can say what the deposit is joining rather than leaving
  // the agent to guess. A failure here is not fatal: the link is still correct.
  let pool = null;
  try {
    const d = await api('/lxapi/xrplpools?n=100' + (A.native ? (B.native ? '' : '&issuer=' + encodeURIComponent(B.issuer))
      : '&issuer=' + encodeURIComponent(A.issuer)));
    const hit = (s, x) => (x.native
      ? String((s || {}).c || '').toUpperCase() === 'XRP'
      : String((s || {}).c || '').toUpperCase() === x.currency.toUpperCase() && (s || {}).i === x.issuer);
    pool = ((d && d.rows) || []).filter((p) => (hit(p.a1, A) && hit(p.a2, B)) || (hit(p.a1, B) && hit(p.a2, A)))[0] || null;
  } catch (_) { pool = null; }

  const extra = {
    // XRPL's AMM reserve rule, not Stellar's. An AMM position is an owned object like any other, so it
    // raises the account reserve -- and the LP token it issues needs a trustline of its own.
    note: 'An AMM position on the XRP Ledger raises your account reserve by 0.2 XRP, and the LP token '
      + 'it issues takes a trustline. Creating a NEW pool also costs the one-time AMMCreate fee, which '
      + 'is the owner reserve at the time — far more than an ordinary transaction fee.',
    // NO `prefill: NOFILL` HERE ANY MORE, and that is the point of this change. The pool page now
    // reads the amounts back (lx-poolprefill), on this chain as well as Stellar -- the deposit card
    // is the same markup on both. NOFILL stays on every OTHER write in this file, because those pages
    // still do not read a link, and claiming a prefill that does not happen is the exact bug this was
    // written to avoid.
  };
  if (pool) {
    extra.pool_account = pool.acct;
    extra.pool_fee_pct = nf(pool.fee, 4);
    extra.pool_liquidity_xrp = nf(pool.liq, 2);
    extra.pool_volume_24h_xrp = nf(pool.vol, 2);
    extra.pool_apy_pct = nf(pool.apy, 2);
    // Off-ratio deposits are not refused on XRPL, they are priced -- the pool takes what keeps its
    // ratio and the single-sided remainder pays a slippage fee. Said plainly rather than estimated,
    // because the exact split is computed by the ledger at submission.
    extra.ratio_note = 'Deposit on the pool\'s current ratio. A single-sided or off-ratio deposit is '
      + 'allowed but charges a slippage fee, so the shares you receive are worth less than the amounts '
      + 'you put in.';
  } else {
    extra.pool = 'none found in the top pools for this pair — this deposit may create it';
    extra.price_warning = 'The ratio you deposit SETS the opening price. Match the market or arbitrage '
      + 'will correct it at your expense.';
  }
  // The amounts ride in the query, exactly as on Stellar. The two chains do not share a pool url
  // shape -- here it is /pools/xrpl/id/<account> -- which is why lx-poolprefill matches each amount
  // to its row BY CODE and never by reading the pair out of the path.
  const fill = `?a=${encodeURIComponent(A.code)}&amount_a=${plainAmount(amount_a)}`
    + `&b=${encodeURIComponent(B.code)}&amount_b=${plainAmount(amount_b)}`;
  return prepared('add_liquidity',
    `Deposit ${amount_a} ${A.code} and ${amount_b} ${B.code} into the ${A.code} / ${B.code} pool on the XRP Ledger`,
    (pool ? web('/pools/xrpl/id/' + pool.acct)
      : web(`/pools/xrpl/${encodeURIComponent(slug(A))}/${encodeURIComponent(slug(B))}`)) + fill,
    extra);
}

async function removeLiquidity({ a, b }) {
  const rA = await wantXrplAsset('a', a); if (rA.error) return fail(rA.error);
  const rB = await wantXrplAsset('b', b); if (rB.error) return fail(rB.error);
  const A = rA.want, B = rB.want;
  return prepared('remove_liquidity',
    `Withdraw your position from the ${A.code} / ${B.code} pool on the XRP Ledger`,
    web(`/pools/xrpl/${encodeURIComponent(slug(A))}/${encodeURIComponent(slug(B))}`),
    { prefill: NOFILL });
}

// Recipient optional, and the figures carried in the link -- the same change as Stellar's bridge and
// for the same reason; see the note there. Kept in step deliberately: a tool that asks for different
// inputs depending on which chain it lands on is the harder bug to find.
const netParam = (v) => {
  const s = String(v || '').trim();
  return /^[A-Za-z0-9 ._-]{1,32}$/.test(s) ? s : '';
};
const addrParam = (v) => {
  const s = String(v || '').trim();
  return /^[A-Za-z0-9]{20,100}$/.test(s) || /^0x[0-9a-fA-F]{40}$/.test(s) ? s : '';
};

async function bridge({ asset, to_network, amount, recipient }) {
  if (!asset || !to_network) return fail('asset and to_network are required.');
  if (!(+amount > 0)) return fail('amount must be positive.');
  const q = [];
  const n = netParam(to_network); if (n) q.push('to=' + encodeURIComponent(n));
  const av = netParam(asset);     if (av) q.push('asset=' + encodeURIComponent(av));
  const m = plainAmount(amount);  if (m) q.push('amount=' + m);
  const r = addrParam(recipient); if (r) q.push('recipient=' + encodeURIComponent(r));
  return prepared('bridge', `Bridge ${amount} ${asset} from the XRP Ledger to ${to_network}`,
    web('/bridge/xrpl') + (q.length ? '?' + q.join('&') : ''),
    { ...(recipient ? { recipient } : {}), to_network,
      // Axelar is the corridor that reaches XRPL, and it carries the TOKEN rather than the name: XRP
      // lands on the far side as wXRP. Saying so here stops an agent reporting that "XRP arrived".
      note: 'The XRP Ledger corridor is Axelar. It carries the token, not the name — XRP arrives on '
        + 'the destination chain as a wrapped representation (wXRP), not as native XRP. The route and '
        + 'its fee are shown before you approve.'
        + (recipient ? '' : ' No destination address was given, so enter the receiving address on the page.') });
}

async function launchToken({ code, supply }) {
  if (!/^[A-Za-z0-9]{1,20}$/.test(String(code || ''))) return fail('code must be 1-20 letters or digits.');
  if (!(+supply > 0)) return fail('supply must be positive.');
  return prepared('launch_token', `Issue ${supply} ${code} on the XRP Ledger`, web('/launchpad/xrpl'),
    { currency: currencyHex(code),
      note: 'Issuing on the XRP Ledger is a multi-step signed flow: configure the issuer, set the '
        + 'domain and flags, have the holder trust the currency, then send the supply. A code longer '
        + 'than three characters is carried on the ledger as a 40-character hex currency — the value '
        + 'in `currency` above is what the ledger will actually hold.',
      prefill: NOFILL });
}

export const XRPL = {
  getMarket, listPools, getPortfolio, getQuote, listCuratedAssets, getOrderbook, getRewards,
  swap, addLiquidity, removeLiquidity, bridge, launchToken,
};
