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
import { XRPL } from './xrpl.js';
import { NEAR, isNearAccount as NEAR_ACCOUNT } from './near.js';

const nf = (n, d = 7) => (n == null || !isFinite(n) ? null : +(+n).toFixed(d));

// XLM/USD, memoised for the life of a call batch. A screen across the whole curated list asks for it
// once per asset, and that is 58 identical requests for a number that moves in cents.
let _xlm = { usd: null, at: 0 };
async function xlmUsd() {
  if (_xlm.usd != null && Date.now() - _xlm.at < 60000) return _xlm.usd;
  try {
    const d = await api('/lxapi/xlm');
    if (d && +d.usd > 0) _xlm = { usd: +d.usd, at: Date.now() };
  } catch (_) { /* a missing dollar price must not cost the caller the XLM figures */ }
  return _xlm.usd;
}

// SUPPLY IS NOT `amount`. Horizon's /assets dropped that field: reading it gives 0, and therefore a
// confident, measured-looking market cap of $0 for every asset on the network. Circulating supply is
// the sum of the four places a balance can sit -- trustlines, claimable balances, AMM pools and
// Soroban contracts -- and leaving any of them out understates a token that mostly lives in a pool.
async function supplyOf(a) {
  try {
    const d = await horizon(`/assets?asset_code=${encodeURIComponent(a.code)}&asset_issuer=${a.issuer}&limit=1`);
    const r = (((d || {})._embedded || {}).records || [])[0];
    if (!r) return null;
    return {
      supply: +((r.balances || {}).authorized || 0) + +(r.claimable_balances_amount || 0)
            + +(r.liquidity_pools_amount || 0) + +(r.contracts_amount || 0),
      trustlines: (r.accounts || {}).authorized ?? null,
      in_pools: +(r.liquidity_pools_amount || 0),
      in_contracts: +(r.contracts_amount || 0),
    };
  } catch (_) { return null; }
}

// ---- reads ------------------------------------------------------------------------------------

async function getMarket({ asset }) {
  const ra = await wantAsset('asset', asset);
  if (ra.error) return fail(ra.error);
  const a = ra.want;
  if (a.id === 'native') return fail('XLM is the quote asset here; ask for an asset priced against it.');
  const d = await api('/lxapi/dexassets?a=' + encodeURIComponent(a.id));
  const row = d && d.a && d.a[a.id];
  if (!row) return fail(`No market data for ${a.code}. It may not be traded on the Stellar DEX.`);
  const [sup, usd] = await Promise.all([supplyOf(a), xlmUsd()]);
  const px = +row.px || 0;
  const mcapXlm = (sup && sup.supply && px) ? sup.supply * px : null;
  return ok({
    asset: a.id, code: a.code, issuer: a.issuer,
    price_xlm: nf(px), price_24h_ago_xlm: nf(row.pc), change_24h_pct: nf(row.chg, 2),
    price_usd: (usd && px) ? nf(px * usd) : null,
    volume_24h_xlm: nf(row.vol, 2), high_24h_xlm: nf(row.high), low_24h_xlm: nf(row.low),
    trades_24h: row.trades ?? null,
    supply: sup ? nf(sup.supply, 4) : null,
    trustlines: sup ? sup.trustlines : null,
    supply_in_pools: sup ? nf(sup.in_pools, 4) : null,
    market_cap_xlm: nf(mcapXlm, 2),
    market_cap_usd: (mcapXlm && usd) ? nf(mcapXlm * usd, 2) : null,
    xlm_usd: usd ? nf(usd, 6) : null,
    // Said plainly because "market cap" is read as a valuation: this is circulating supply times the
    // last DEX price. On a token whose book is a handful of XLM deep, that price is what one small
    // order paid, and multiplying it by a billion units does not make the result worth that.
    market_cap_note: 'supply x last DEX price. On a thin book this is arithmetic, not a valuation — '
      + 'check get_orderbook depth before trusting it.',
    source: 'Stellar DEX via lumoscore.com; supply from Horizon', page: web('/trade/stellar/' + a.id),
  });
}

// /lxapi/pools answers {page,per,total,rows:[…]}, and each side is an OBJECT {code,issuer,amount},
// not a "CODE-ISSUER" string. Both cost me a wrong first version: a probe that hunted for "the array"
// and printed its keys hid the nesting AND the shape of a and b, and the tool returned zero pools
// while the endpoint was serving twenty-five. Read the record, not a summary of it.
const sideId = (s) => (!s ? null : (s.issuer ? `${s.code}-${s.issuer}` : (String(s.code).toUpperCase() === 'XLM' ? 'native' : s.code)));

// Horizon spells an asset CODE:ISSUER in a query, where the rest of this file uses CODE-ISSUER.
const hAsset = (x) => (x.id === 'native' ? 'native' : `${x.code}:${x.issuer}`);

// An amount as PLAIN decimal digits, for a prefill link. String(0.0000001) is "1e-7", and the page
// refuses anything that is not plain digits -- deliberately, since it is about to be approved -- so a
// small deposit would silently arrive as an empty box. Seven decimals is Stellar's own precision;
// trailing zeros are trimmed so the field reads the way a person would write it.
// IT VALIDATES ITS OWN OUTPUT against the rule the page enforces, and returns '' rather than a value
// the page will throw away. Two cases that formatting alone gets wrong: a number big enough that
// toFixed still yields exponent notation ("1e+21"), which the page refuses; and an amount so small it
// rounds to "0", which is worse than refused -- the page treats an empty-or-zero box as unfilled, so
// it would write "0" again on every tick for the whole watch window.
const plainAmount = (v) => {
  const n = +v;
  if (!isFinite(n) || n <= 0) return '';
  const s = n.toFixed(7).replace(/0+$/, '').replace(/\.$/, '');
  if (!/^[0-9]+(\.[0-9]+)?$/.test(s) || +s === 0) return '';
  return s;
};

// Every pool holding an asset, straight from the ledger. /lxapi/pools serves ONE page of the top pools
// by TVL, which is the right answer for "show me the big pools" and the wrong one for "which pools hold
// X" -- see listPools.
async function poolsHolding(x, limit) {
  const d = await horizon(`/liquidity_pools?reserves=${encodeURIComponent(hAsset(x))}&limit=${Math.min(200, Math.max(1, limit || 200))}`);
  return ((((d || {})._embedded || {}).records) || []);
}

// The one pool made by a specific pair. Horizon takes the two reserves in either order, but only the
// canonical ordering matches, so both are tried rather than assuming which way round the caller asked.
async function poolOfPair(A, B) {
  for (const [x, y] of [[A, B], [B, A]]) {
    try {
      const d = await horizon(`/liquidity_pools?reserves=${encodeURIComponent(hAsset(x) + ',' + hAsset(y))}&limit=1`);
      const p = ((((d || {})._embedded || {}).records) || [])[0];
      if (p) return p;
    } catch (_) { /* try the other ordering before giving up */ }
  }
  return null;
}
const reserveOf = (p, x) => {
  const want = hAsset(x);
  const r = (p.reserves || []).filter((v) => v.asset === want)[0];
  return r ? +r.amount : null;
};

// A BARE CODE IS NOT AN IDENTITY on Stellar -- 403 different issuers have called a token "USDC".
// The curated roster is the one place that says which issuer LumosCore means by a code, so a bare
// code resolves through it and nowhere else. Two curated issuers for one code refuses and names
// both, because picking one for the caller is how an agent ends up quoting the wrong token.
async function resolveCode(asset) {
  const code = String(asset || '').trim();
  if (!code || code.includes('-')) return { error: `"${asset}" is not an asset id. Use CODE-ISSUER or XLM.` };
  let d = null;
  try { d = await api('/lxapi/assetmeta'); } catch (_) { d = null; }
  const all = ((d && d.list) || []).concat((d && d.mints) || []);
  const matches = all.filter((id) => String(id).split('-')[0].toUpperCase() === code.toUpperCase());
  if (!matches.length) {
    return { error: `"${asset}" is not an asset id and is not a curated asset. Use CODE-ISSUER, or XLM. `
      + 'list_curated_assets returns every code this server can resolve on its own.' };
  }
  if (matches.length > 1) {
    return { error: `"${asset}" is ambiguous — LumosCore curates ${matches.length} assets with that code: `
      + matches.join(', ') + '. Pass the full CODE-ISSUER.' };
  }
  const w = parseAsset(matches[0]);
  return w ? { want: w } : { error: `"${asset}" could not be resolved to an asset id.` };
}

// ONE RESOLVER FOR EVERY TOOL THAT TAKES AN ASSET, which resolveCode above was not.
//
// It was written for list_pools and wired into list_pools alone, so the connector answered the same
// string two different ways: `list_pools asset=LUMOS` worked, while `add_liquidity a=LUMOS` failed
// with `"LUMOS" is not an asset id` -- and the message named the right format without mentioning that
// a curated code resolves at all. A user testing the connector reported it on 2026-11-16 as the pool
// form being broken; six tools were affected (get_market, get_quote, get_orderbook, swap,
// add_liquidity, remove_liquidity).
//
// The strictness stays exactly where resolveCode put it: a full CODE-ISSUER is taken as given, a bare
// code resolves ONLY through the curated roster, and two curated issuers for one code refuses and
// names both rather than picking. `label` says WHICH argument was wrong, because add_liquidity and
// get_quote each take two and the bare message cannot say which one failed.
async function wantAsset(label, x) {
  const direct = parseAsset(x);
  if (direct) return { want: direct };
  const r = await resolveCode(x);
  return r.want ? r : { error: `${label}: ${r.error}` };
}

async function listPools({ limit = 20, asset, page = 1 }) {
  let want = asset ? parseAsset(asset) : null;
  if (asset && !want) {
    const r = await resolveCode(asset);
    if (r.error) return fail(r.error);
    want = r.want;
  }

  // A FILTER HAS TO ASK THE LEDGER, not sift the page we already had.
  //
  // /lxapi/pools returns ONE page: the top 25 pools by TVL out of 11,017. Filtering that page for an
  // asset answered "0 pools" for anything outside the top 25 -- which is almost everything. An agent
  // using the connector reported it exactly right: "list_pools returns 0 pools across the whole
  // network. But the market data says about 41M LUMOS is sitting in pools, so the pool list is broken."
  // LUMOS is in 62 pools. The tool said none.
  //
  // Horizon indexes pools BY reserve, so the filtered case goes there and gets all of them. TVL is only
  // filled in where one side is XLM, since that is the only side this can price without another lookup
  // per pool -- stated as null rather than guessed at.
  if (want) {
    // BOTH SOURCES, because neither is complete on its own. Horizon indexes pools by reserve but returns
    // them in no useful order and caps at 200, so for an asset held in hundreds of pools the BIGGEST one
    // can fall outside the page -- asking for USDC pools returned AQUA/USDC and missed XLM/USDC, which
    // holds $5.5M. /lxapi/pools is the opposite: only the top 25 on the network, but ranked by TVL and
    // carrying real TVL and volume figures. Merging them means the large pools are always present and
    // the long tail is there too.
    const [recs, top] = await Promise.all([
      poolsHolding(want, 200),
      api('/lxapi/pools').then((d) => (Array.isArray(d) ? d : ((d && d.rows) || [])), () => []),
    ]);
    const usd = await xlmUsd();
    const hit = (s) => {
      if (!s) return false;
      if (want.id === 'native') return String(s.code || '').toUpperCase() === 'XLM';
      return `${s.code}-${s.issuer}` === want.id;
    };
    const ranked = new Map();
    for (const p of top) {
      if (!hit(p.a) && !hit(p.b)) continue;
      ranked.set(p.id, {
        id: p.id, pair: `${(p.a || {}).code || '?'} / ${(p.b || {}).code || '?'}`,
        a: sideId(p.a), b: sideId(p.b),
        reserve_a: nf((p.a || {}).amount, 4), reserve_b: nf((p.b || {}).amount, 4),
        tvl_usd: nf(p.tvl, 2), volume_24h_usd: nf(p.vol24, 2),
        fee_pct: p.fee ?? null, participants: p.members ?? null,
        page: web('/pools/stellar/id/' + p.id),
      });
    }
    const rows = recs.map((p) => {
      const sides = (p.reserves || []).map((v) => {
        const nat = v.asset === 'native';
        const [code, issuer] = nat ? ['XLM', ''] : String(v.asset).split(':');
        return { code, issuer, amount: +v.amount, id: nat ? 'native' : `${code}-${issuer}` };
      });
      const xlmSide = sides.filter((s) => s.id === 'native')[0];
      return {
        id: p.id,
        pair: sides.map((s) => s.code).join(' / '),
        a: sides[0] ? sides[0].id : null, b: sides[1] ? sides[1].id : null,
        reserve_a: nf(sides[0] && sides[0].amount, 4), reserve_b: nf(sides[1] && sides[1].amount, 4),
        tvl_usd: (xlmSide && usd) ? nf(xlmSide.amount * 2 * usd, 2) : null,
        total_shares: nf(+p.total_shares, 4),
        fee_pct: p.fee_bp != null ? nf(p.fee_bp / 100, 2) : null,
        participants: p.total_trustlines ?? null,
        page: web('/pools/stellar/id/' + p.id),
      };
    });
    // the ranked rows win on id: they carry TVL and 24h volume that Horizon does not publish
    for (const r of rows) if (!ranked.has(r.id)) ranked.set(r.id, r);
    const all = [...ranked.values()].sort((x, y) => (y.tvl_usd || 0) - (x.tvl_usd || 0) || (y.total_shares || 0) - (x.total_shares || 0));
    const out = all.slice(0, Math.max(1, Math.min(200, +limit || 20)));
    return ok({
      count: out.length, of: all.length, asset: want.id,
      source: 'Horizon, every pool holding this asset',
      tvl_note: 'tvl_usd is filled only where one side is XLM; a pool of two credit assets reports null rather than a guess.',
      pools: out,
    });
  }

  // PAGES, NOT ONE PAGE. limit is honoured up to 100 by walking consecutive pages of 25; asking for
  // more than the ledger holds simply stops early rather than looping.
  const per = 25;
  const want_n = Math.max(1, Math.min(100, +limit || 20));
  const from_page = Math.max(1, Math.floor(+page) || 1);
  const first = await api('/lxapi/pools?page=' + from_page);
  const envelope = (first && !Array.isArray(first)) ? first : {};
  const rowsOf = (x) => (Array.isArray(x) ? x : (Array.isArray(x && x.rows) ? x.rows : []));
  let list = rowsOf(first);
  const last_page = +envelope.pages || 1;

  // AN EMPTY ANSWER IS A FAILED ANSWER, and it must not be reported as a real one.
  //
  // api() throws on every transport failure, so nothing here can turn a dead upstream into empty data
  // -- but /lxapi/pools answers HTTP 200 with an empty envelope when ITS upstream is having a moment,
  // and that arrives as a perfectly well-formed zero. This tool then published "0 pools, 0 ranked" as
  // a success, and functions/mcp.js cached it for the TTL because only isError results are witheld
  // from the cache. That is the failure in RAZA's screenshot: an assistant told "the connected pool
  // tool returned zero", repeatedly, while the site itself was fine.
  //
  // Stellar has never had zero liquidity pools and will not start today, so empty here is never a
  // fact about the ledger. Saying so costs one condition and stops the wrong answer being both given
  // and remembered.
  if (!list.length && !(+envelope.total)) {
    return fail('LumosCore returned no pool data for page ' + from_page + '. This is an upstream hiccup, '
      + 'not an empty ledger — Stellar has tens of thousands of pools. Try again in a few seconds.');
  }
  if (from_page > last_page) {
    return fail('page ' + from_page + ' is past the end of the ranking (' + last_page + ' pages of ' + per + ').');
  }
  for (let pg = from_page + 1; list.length < want_n && pg <= last_page; pg++) {
    const more = rowsOf(await api('/lxapi/pools?page=' + pg));
    if (!more.length) break;
    list = list.concat(more);
  }
  const hit = (s) => {
    if (!want || !s) return !want;
    if (want.id === 'native') return String(s.code || '').toUpperCase() === 'XLM';
    return `${s.code}-${s.issuer}` === want.id;
  };
  const out = list.filter((p) => !want || hit(p.a) || hit(p.b)).slice(0, want_n);
  const priceable = +envelope.total || list.length;
  const unpriceable = +envelope.unpriceable || 0;
  return ok({
    count: out.length,
    page: from_page,
    pages: last_page,
    per_page: per,
    // NAMED FOR WHAT THEY ARE. "total_pools" invited the reading "LumosCore has 11,016 pools", which
    // is wrong twice over: it is not a total, and they are not LumosCore's -- every Stellar AMM pool
    // is tradeable here, LumosCore ranks them.
    ranked_pools: priceable,
    unpriceable_pools: unpriceable,
    stellar_pools_total: priceable + unpriceable,
    pools_with_volume_24h: +envelope.withVol || null,
    counts_note: 'ranked_pools are the pools with a price on both sides, ordered by TVL; '
      + 'unpriceable_pools exist on the ledger but cannot be valued in USD. LumosCore does not own '
      + 'any of them -- every Stellar AMM pool is tradeable here. Pass page to walk the ranking.',
    pools: out.map((p) => ({
      id: p.id,
      pair: `${(p.a || {}).code || '?'} / ${(p.b || {}).code || '?'}`,
      a: sideId(p.a), b: sideId(p.b),
      reserve_a: nf((p.a || {}).amount, 4), reserve_b: nf((p.b || {}).amount, 4),
      tvl_usd: nf(p.tvl, 2), volume_24h_usd: nf(p.vol24, 2),
      // NOT basis points: /lxapi/pools returns 0.3 for a 30bp pool, i.e. already a percent. The old name
      // said bps, so the playground dutifully divided by 100 and displayed a 0.30% pool as "0.003%".
      fee_pct: p.fee ?? null, participants: p.members ?? null,
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
  const rf = await wantAsset('from', from); if (rf.error) return fail(rf.error);
  const rt = await wantAsset('to', to);     if (rt.error) return fail(rt.error);
  const f = rf.want, t = rt.want;
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
  const eco = ['LMNR', 'yXLM', 'sages', 'AQUA', 'SSLX', 'SHX', 'TKG', 'LIBERATOR', 'KALE', 'USDC'];
  return ok({
    programs: ['LP rewards', 'Holder rewards', 'Trading rewards'],
    per_round: '3,000,000 LUMOS per round, per chain',
    incentivized_pools: 1 + eco.length,
    lp_programs: [
      { program: 'Native LP', pools: ['LUMOS / XLM'], pays_per_round: '1,000,000 LUMOS',
        pool_id: '78e6cfc930e2d7ceb3f6cefd4f9aa5e098c5b0af086cde0ad3147982f4d217f2' },
      { program: 'Ecosystem LP', pools: eco.map((c) => 'LUMOS / ' + c),
        pays_per_round: '100,000 LUMOS per pool', selected: 'reviewed every 6 months' },
    ],
    holder_rewards: 'Hold 5,000,000+ LUMOS on Stellar; every further 5,000,000 earns another share.',
    address: address || null,
    page: web('/rewards/stellar'),
    note: 'The roster above is fixed and is safe to quote. Eligibility and CLAIMABLE AMOUNTS are not: '
      + 'they are computed on the Rewards page against the live ledger, and this server does not restate '
      + 'them, because a reward figure that disagrees with the page is worse than a link to it.',
  });
}

// THE ROSTER, LIVE. /lxapi/assetmeta is a public GET and is the authority: the copy baked into the
// build (_tools/verified.generated.json) is a snapshot taken whenever someone last ran _syncverified,
// and it was 28 assets while the live list held 58. A tool answering "all curated assets" off the
// stale one would quietly omit half the answer and look right doing it.
//
// Mints are kept SEPARATE and default to out. A launchpad token is something LumosCore provided the
// button for, not something it curated, and folding the two lists together would let anyone add
// themselves to "curated" by minting.
async function listCuratedAssets({ include_mints = false, verified_only = false }) {
  const d = await api('/lxapi/assetmeta');
  const vmap = (d && d.verified) || {};
  const row = (id, kind) => {
    const v = vmap[id.replace('-', '|')] || vmap[id] || null;
    const [code, issuer] = String(id).split('-');
    return {
      asset: id, code, issuer, kind,
      // `v` is the 0/1 flag and `s` is only the REASON. Treating the presence of `s` as truth marked
      // every "unverified" and every mint as verified -- the tool would have reported a green tick on
      // exactly the assets the platform declines to vouch for.
      verified: !!(v && +v.v === 1),
      verified_via: v ? (v.s || null) : null,
      domain: v ? (v.d || null) : null,
      why: v ? (v.why || null) : null,
      page: web('/trade/stellar/' + id),
    };
  };
  let out = ((d && d.list) || []).map((id) => row(id, 'curated'));
  if (include_mints) out = out.concat(((d && d.mints) || []).map((id) => row(id, 'mint')));
  if (verified_only) out = out.filter((r) => r.verified);
  return ok({
    count: out.length,
    curated: ((d && d.list) || []).length,
    mints: ((d && d.mints) || []).length,
    included_mints: !!include_mints,
    assets: out,
    note: 'Curated means LumosCore lists it. Mints are launchpad tokens and are not curated — '
      + 'they are excluded unless you ask for them.',
  });
}

// THE ORDER BOOK, AND WHAT "THE FLOOR" ACTUALLY IS.
//
// A spread alone is not an opportunity, so this returns the DEPTH beside it. Scanning the curated list
// by hand turned up books where the best bid held 0.08 XLM and the one below it was 87% lower: the
// "floor" was a single dust order, and a tool that reported only best_bid/best_ask would have shown
// that asset as a wide-spread bargain. bid_depth_xlm, the top rows, and the drop to the next level are
// the columns that tell you whether the floor would hold anything.
//
// Prices are XLM per unit: the book is asked for with the asset SELLING and XLM BUYING, so Horizon
// quotes the counter asset per base.
async function getOrderbook({ asset, limit = 8 }) {
  const ra = await wantAsset('asset', asset);
  if (ra.error) return fail(ra.error);
  const a = ra.want;
  if (a.id === 'native') return fail('XLM is the quote asset here; ask for an asset priced against it.');
  const n = Math.max(1, Math.min(50, +limit || 8));
  const t = a.code.length <= 4 ? 'credit_alphanum4' : 'credit_alphanum12';
  const sel = `selling_asset_type=${t}&selling_asset_code=${encodeURIComponent(a.code)}&selling_asset_issuer=${a.issuer}`;

  const book = await horizon(`/order_book?${sel}&buying_asset_type=native&limit=${Math.max(n, 20)}`);
  if (!book) return fail(`No order book for ${a.code} against XLM.`);
  const bids = book.bids || [], asks = book.asks || [];
  const bestBid = bids.length ? +bids[0].price : null;
  const bestAsk = asks.length ? +asks[0].price : null;

  let last = null, lastAt = null;
  try {
    const tr = await horizon(`/trades?base_asset_type=${t}&base_asset_code=${encodeURIComponent(a.code)}`
      + `&base_asset_issuer=${a.issuer}&counter_asset_type=native&order=desc&limit=1`);
    const r = (((tr || {})._embedded || {}).records || [])[0];
    if (r && r.price && +r.price.d) { last = +r.price.n / +r.price.d; lastAt = r.ledger_close_time; }
  } catch (_) { /* the book is the answer; a missing last trade must not lose it */ }

  // On a bid, `amount` is denominated in the BUYING asset (XLM). On an ask it is the asset itself.
  const bidXlm = bids.reduce((s, b) => s + (+b.amount || 0), 0);
  const askUnits = asks.reduce((s, x) => s + (+x.amount || 0), 0);
  const second = bids.length > 1 ? +bids[1].price : null;

  return ok({
    asset: a.id, code: a.code, quote: 'XLM', price_unit: 'XLM per ' + a.code,
    best_bid: nf(bestBid), best_ask: nf(bestAsk),
    spread_pct: (bestBid > 0 && bestAsk > 0) ? nf(((bestAsk - bestBid) / bestBid) * 100, 2) : null,
    last_price: nf(last), last_trade_at: lastAt,
    last_vs_best_bid_pct: (last && bestBid > 0) ? nf(((last - bestBid) / bestBid) * 100, 2) : null,
    xlm_resting_at_best_bid: nf(bids.length ? +bids[0].amount : 0, 4),
    // A big number here with a tiny one above it is the tell: the floor is one order, not a level.
    drop_to_next_bid_pct: (bestBid > 0 && second > 0) ? nf(((bestBid - second) / bestBid) * 100, 2) : null,
    bid_depth_xlm: nf(bidXlm, 4), ask_depth_units: nf(askUnits, 4),
    bids: bids.slice(0, n).map((b) => ({ price_xlm: nf(+b.price), xlm_resting: nf(+b.amount, 4) })),
    asks: asks.slice(0, n).map((x) => ({ price_xlm: nf(+x.price), units_offered: nf(+x.amount, 4) })),
    page: web('/trade/stellar/' + a.id),
    note: 'To buy immediately you pay best_ask. Buying "at the floor" means resting a limit order at '
      + 'best_bid, which only fills if someone sells into it. Check xlm_resting_at_best_bid and '
      + 'drop_to_next_bid_pct before treating a wide spread as an opportunity.',
  });
}

// THE BLOG, because an agent asked about LumosCore should be able to read what LumosCore has written
// rather than infer it. /lxapi/blog lists the posts; ?slug= returns one with its body.
//
// The body comes back as HTML and is handed over as TEXT. An agent does not need the markup, tags
// inflate the payload several times over, and a model reading raw HTML will sooner or later repeat a
// fragment of it back to somebody as prose.
function htmlToText(h) {
  return String(h || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
const postRow = (p) => ({
  slug: p.slug, title: p.title, category: p.category || null,
  excerpt: p.excerpt || null, tags: p.tags || [],
  read_minutes: p.readMins ?? null,
  published_at: p.publishedAt || p.publishAt || p.createdAt || null,
  url: web('/blog/' + p.slug),
});

async function listBlogPosts({ limit = 20, tag, category, _chain }) {
  const d = await api('/lxapi/blog');
  let posts = (d && d.posts) || [];
  // Drop only the posts belonging to ANOTHER network. See blogChain() for why this is not an
  // equality test on the category.
  //
  // IT IS EVERY OTHER NETWORK, NOT "THE" OTHER ONE. This was `_chain === 'xrpl' ? 'stellar' : 'xrpl'`
  // -- a single swap, correct while there were exactly two chains and quietly wrong the moment there
  // were three: asking for near dropped the XRPL posts and kept every Stellar one. Derived from
  // CHAINS now, so a fourth fork cannot reintroduce it.
  if (_chain) {
    const others = CHAINS.filter((c) => c !== _chain);
    posts = posts.filter((p) => others.indexOf(String(p.category || '').trim().toLowerCase()) < 0);
  }
  if (tag) {
    const t = String(tag).toLowerCase();
    posts = posts.filter((p) => (p.tags || []).some((x) => String(x).toLowerCase() === t));
  }
  if (category) {
    const c = String(category).toLowerCase();
    posts = posts.filter((p) => String(p.category || '').toLowerCase() === c);
  }
  const out = posts.slice(0, Math.max(1, Math.min(100, +limit || 20)));
  return ok({
    count: out.length, of: ((d && d.posts) || []).length,
    posts: out.map(postRow),
    next_step: 'Call get_blog_post with a slug to read one in full.',
  });
}

async function getBlogPost({ slug }) {
  const s = String(slug || '').trim();
  if (!/^[a-z0-9][a-z0-9-]{0,120}$/i.test(s)) return fail('slug must be a post slug, e.g. how-to-get-your-token-curated-on-lumoscore. Call list_blog_posts first.');
  const d = await api('/lxapi/blog?slug=' + encodeURIComponent(s));
  const p = (d && (d.post || (d.slug ? d : null))) || null;
  if (!p || !p.slug) return fail(`No post with the slug "${s}". Call list_blog_posts to see what exists.`);
  const text = htmlToText(p.body);
  const CAP = 20000;
  return ok(Object.assign(postRow(p), {
    meta_description: p.metaDescription || null,
    body_text: text.length > CAP ? text.slice(0, CAP) + '\n\n[truncated]' : text,
    body_chars: text.length,
    truncated: text.length > CAP,
  }));
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
    after_approval: 'Do not assume the outcome either way once the person has been to approve_url. Ask what the '
      + 'LumosCore page showed, and check with get_portfolio for their address: balances change once it lands. '
      + 'A cross-chain transfer can take several minutes to arrive after the page says it was sent.',
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
  // getQuote has already accepted both, so these cannot fail here -- but they must RESOLVE, not just
  // parse, or a bare curated code would quote fine and then fail at the swap it was quoted for.
  const rf = await wantAsset('from', from); if (rf.error) return fail(rf.error);
  const rt = await wantAsset('to', to);     if (rt.error) return fail(rt.error);
  const f = rf.want, t = rt.want;

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
  const rA = await wantAsset('a', a); if (rA.error) return fail(rA.error);
  const rB = await wantAsset('b', b); if (rB.error) return fail(rB.error);
  const A = rA.want, B = rB.want;
  if (!(+amount_a > 0) || !(+amount_b > 0)) return fail('amount_a and amount_b must both be positive.');

  // WHAT THE DEPOSIT ACTUALLY BUYS. An agent asked "how many liq shares will i have for depositing
  // 1000000 LUMOS and equal value of USDC" and had to answer "I can't give you an exact share count.
  // The connector doesn't return one, and it couldn't give me the pool's reserves either" -- then work
  // the formula out by hand. The pool is a single Horizon lookup away and the arithmetic is fixed, so
  // the tool does it.
  //
  // Stellar's own rule, not an approximation: the first deposit into an empty pool mints sqrt(a*b); a
  // deposit into a pool that already holds liquidity mints the SMALLER of the two ratios times the
  // existing share total, because the excess of the other side is simply not taken.
  let pool = null;
  try { pool = await poolOfPair(A, B); } catch (_) { pool = null; }
  const extra = { note: 'A new pool position also needs a trustline, which reserves 0.5 XLM.' };
  if (!pool) {
    extra.pool = 'none yet — this pair has no pool, so this deposit would create it';
    extra.shares_estimate = nf(Math.sqrt(+amount_a * +amount_b), 7);
    extra.shares_basis = 'first deposit into an empty pool mints sqrt(amount_a * amount_b)';
    extra.price_warning = 'The ratio you deposit SETS the opening price. Match the market or arbitrage will correct it at your expense.';
  } else {
    const ra = reserveOf(pool, A), rb = reserveOf(pool, B), tot = +pool.total_shares;
    extra.pool_id = pool.id;
    extra.reserves = { [A.code]: nf(ra, 7), [B.code]: nf(rb, 7) };
    extra.total_shares = nf(tot, 7);
    extra.fee_pct = pool.fee_bp != null ? nf(pool.fee_bp / 100, 2) : null;
    if (ra > 0 && rb > 0 && tot > 0) {
      const fa = +amount_a / ra, fb = +amount_b / rb;
      const f = Math.min(fa, fb);
      extra.shares_estimate = nf(f * tot, 7);
      extra.pool_share_pct = nf((f * tot) / (tot + f * tot) * 100, 4);
      extra.shares_basis = 'min(amount_a / reserve_a, amount_b / reserve_b) x total_shares';
      extra.pool_price = `1 ${A.code} = ${nf(rb / ra, 7)} ${B.code}`;
      // Depositing off-ratio is not an error, it is a quiet haircut: only the smaller side is taken in
      // full and the rest stays in the wallet, so the figure above is already the real one.
      if (Math.abs(fa - fb) / Math.max(fa, fb) > 0.01) {
        extra.ratio_warning = `Your amounts are off the pool's ratio, so only the ${fa < fb ? A.code : B.code} side is taken in full`
          + ` — about ${nf(Math.abs(fa - fb) * (fa < fb ? rb : ra), 7)} ${fa < fb ? B.code : A.code} would not be deposited.`;
      }
    }
  }
  // CARRY THE AMOUNTS IN THE LINK. Until 2026-11-17 this returned the bare pool url, so the deposit
  // card opened at 0.00 / 0.00 and the two numbers computed above lived only in this reply -- a user
  // testing the connector reported exactly that. The page reads these back in lx-poolprefill
  // (_tools/_poolprefill.js), which matches each amount to its row BY CODE rather than by position,
  // which is why the codes travel too.
  return prepared('add_liquidity', `Deposit ${amount_a} ${A.code} and ${amount_b} ${B.code} into the ${A.code} / ${B.code} pool`,
    web(`/pools/stellar/${encodeURIComponent(A.id)}/${encodeURIComponent(B.id)}`
      + `?a=${encodeURIComponent(A.code)}&amount_a=${plainAmount(amount_a)}`
      + `&b=${encodeURIComponent(B.code)}&amount_b=${plainAmount(amount_b)}`), extra);
}

async function removeLiquidity({ a, b }) {
  const rA = await wantAsset('a', a); if (rA.error) return fail(rA.error);
  const rB = await wantAsset('b', b); if (rB.error) return fail(rB.error);
  const A = rA.want, B = rB.want;
  return prepared('remove_liquidity', `Withdraw your position from the ${A.code} / ${B.code} pool`,
    web(`/pools/stellar/${encodeURIComponent(A.id)}/${encodeURIComponent(B.id)}`));
}

// RECIPIENT IS OPTIONAL. It used to be required and the tool refused to prepare anything without it,
// which is backwards: the destination address is the one input the person most often does not have to
// hand, and the bridge page asks for it itself. Worse, the url this returned was a bare /bridge/stellar
// -- so the address it insisted on was collected and then thrown away. Reported 2026-11-16.
//
// Everything the tool worked out now travels in the query for [[_bridgeprefill]] to apply. That layer
// applies TWO of these four: the destination network and the receiving address. It will not write an
// amount unless the page is already showing the asset asked for here -- the alternative is a number
// against the wrong asset two clicks from a "You send" review screen. So the reply below still states
// the asset and the amount in words, because the link alone may not carry them onto the page.
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
  const a = netParam(asset);      if (a) q.push('asset=' + encodeURIComponent(a));
  const m = plainAmount(amount);  if (m) q.push('amount=' + m);
  const r = addrParam(recipient); if (r) q.push('recipient=' + encodeURIComponent(r));
  return prepared('bridge', `Bridge ${amount} ${asset} from Stellar to ${to_network}`,
    web('/bridge/stellar') + (q.length ? '?' + q.join('&') : ''),
    { to_network, ...(recipient ? { recipient } : {}),
      note: 'LumosCore routes through Circle CCTP, LayerZero, NEAR Intents or Axelar depending on the '
        + 'destination — Axelar is the corridor that reaches the XRP Ledger. '
        + 'The route and its fee are shown before you approve.'
        + (recipient ? '' : ' No destination address was given, so enter the receiving address on the page.') });
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

// ---- chains -------------------------------------------------------------------------------------
//
// ONE SET OF TOOLS, THREE CHAINS. Every tool takes `chain`, and the implementation behind it is
// picked here rather than inside each function -- see the header of xrpl.js for why they are
// separate files, and near.js for why a third chain made that call more obviously right.
//
// AN UNKNOWN CHAIN IS REFUSED, NOT DEFAULTED. The tempting line is `chain === 'xrpl' ? xrpl : stellar`,
// which turns a typo, and anything a later fork adds, into a silent Stellar answer: ask for `chain:
// "hedera"` and get Stellar prices back with no indication they are the wrong network. On a site
// where a wrong-chain action is the expensive kind of mistake, a refusal naming the chains that
// exist is the only safe reading of an argument nobody recognises.
//
// THIS LIST IS THE ONE PLACE A CHAIN IS ADDED. `near` arriving here is what made every tool accept
// it, because route() and the CHAIN schema below both read this array rather than repeating it --
// which is also why `chain: "near"` used to produce the refusal above rather than a wrong answer.
const CHAINS = ['stellar', 'xrpl', 'near'];

function pickChain(args) {
  const c = String((args && args.chain) || 'stellar').trim().toLowerCase();
  if (!CHAINS.includes(c)) {
    return { error: `"${(args && args.chain)}" is not a chain this connector serves. `
      + `Use one of: ${CHAINS.join(', ')}. Omitting chain means stellar.` };
  }
  return { chain: c };
}

// Wraps a Stellar implementation and its per-chain counterparts into one tool.
//
// A MISSING IMPLEMENTATION NAMES ITS CHAIN. The refusal used to be one sentence about the XRP Ledger
// because there was only one other chain to be missing; with three, a message that said "the other
// chain" would send an agent looking in the wrong place. Each gets its own name and its own reason.
const CHAIN_NAMES = { stellar: 'Stellar', xrpl: 'The XRP Ledger', near: 'NEAR' };

// A NETWORK WRITTEN INTO THE ASSET (RAZA 2026-11-18, testing from ChatGPT: "MCP is still not working for xrpl and
// near"). The agent never set `chain` -- most likely a tool list it cached before chain existed -- so "XRP" answered
// with Stellar's XRP token, and its fallback, `xrpl:XRP` / `near:NEAR` in the asset itself, was refused as a bad id.
// That spelling is unambiguous, so it is read as the chain: the prefix is stripped from every string argument that
// carries one, and a prefix that disagrees with an explicit `chain` (or with another argument's prefix) is refused
// rather than guessed. `xrp:` is accepted as the XRP Ledger, since that is how people write it.
const PREFIX_RE = /^\s*(stellar|xrpl|xrp|near)\s*[:/]\s*(.+)$/i;
const PREFIX_CHAIN = { stellar: 'stellar', xrpl: 'xrpl', xrp: 'xrpl', near: 'near' };
function splitPrefixes(args) {
  const out = Object.assign({}, args || {});
  let found = null;
  for (const k of Object.keys(out)) {
    if (k === 'chain' || typeof out[k] !== 'string') continue;
    const m = PREFIX_RE.exec(out[k]);
    if (!m) continue;
    const c = PREFIX_CHAIN[m[1].toLowerCase()];
    if (found && found !== c) return { error: `Arguments name two different networks (${found} and ${c}). Use one chain per call.` };
    found = c; out[k] = m[2].trim();
  }
  if (found) {
    if (out.chain && String(out.chain).trim().toLowerCase() !== found) {
      return { error: `chain is "${out.chain}" but an argument is written for ${found}. Use one: chain: "${found}" with the bare asset.` };
    }
    out.chain = found;
  }
  return { args: out };
}
// THE NATIVE COIN OF ANOTHER NETWORK, ASKED FOR WITHOUT A CHAIN. Bare "XRP" on Stellar is a real Stellar token (and a
// Stellar swap into it is legitimate), so the call is NOT rerouted -- but the answer says where the native coin lives,
// so an agent that meant the XRP Ledger or NEAR is told how to ask instead of reporting that network as missing.
function nativeHint(args, chainGiven) {
  if (chainGiven) return '';
  for (const k of ['asset', 'from', 'to']) {
    const v = String((args && args[k]) || '').trim().toUpperCase();
    if (v === 'XRP') return 'This answered for Stellar (the default). For the XRP Ledger\'s native XRP, call again with chain: "xrpl" (or asset "xrpl:XRP").';
    if (v === 'NEAR') return 'This answered for Stellar (the default). For NEAR\'s native coin, call again with chain: "near" (or asset "near:NEAR").';
  }
  return '';
}
function withHint(res, hint) {
  if (!hint || !res || !res.content || !res.content[0]) return res;
  const c = res.content[0];
  if (res.isError) return Object.assign({}, res, { content: [{ type: 'text', text: c.text + ' ' + hint }] });
  try { const o = JSON.parse(c.text); o.chain_hint = hint; return { content: [{ type: 'text', text: JSON.stringify(o, null, 2) }] }; }
  catch (e) { return res; }
}

function route(stellarFn, xrplFn, nearFn) {
  const impl = { xrpl: xrplFn, near: nearFn };
  return async (rawArgs) => {
    const sp = splitPrefixes(rawArgs);
    if (sp.error) return fail(sp.error);
    const args = sp.args;
    // AN ADDRESS NAMES ITS NETWORK (RAZA 2026-11-18: ChatGPT reported get_portfolio "rejects XRPL r… and NEAR account
    // ids" -- it passed the address and no chain, so the call went to Stellar). The three shapes cannot be confused:
    // Stellar G… (56, base32), XRPL r… (25-35, base58), NEAR a dotted account or a 64-hex implicit one. With no chain
    // given, the address picks it; an explicit chain is never overridden, and a mismatch is left to that chain's own
    // check, which names the shape it expected.
    if (!args.chain && typeof args.address === 'string') {
      const a = args.address.trim();
      if (/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(a)) args.chain = 'xrpl';
      else if (!G_RE.test(a) && (/^[0-9a-f]{64}$/.test(a) || (a.includes('.') && NEAR_ACCOUNT(a.toLowerCase())))) args.chain = 'near';
    }
    const p = pickChain(args);
    if (p.error) return fail(p.error);
    if (p.chain === 'stellar') return withHint(await stellarFn(args), nativeHint(args, !!(args && args.chain)));
    const fn = impl[p.chain];
    if (!fn) {
      return fail('That tool is Stellar-only for now. '
        + `${CHAIN_NAMES[p.chain]} has no equivalent surface on LumosCore yet.`);
    }
    return fn(args);
  };
}

// The blog is ONE surface shared by both chains, so it is not routed the way a market or a pool is.
// A post's category IS its network, and the site's own rule is the one mirrored here: a post tagged
// for the OTHER chain is dropped, while an untagged post, an "All" post and an old topic tag like
// "Guide" are not networks at all and stay. Filtering on an exact category match instead would hide
// every general post the moment someone asked for chain:"xrpl".
function blogChain(fn) {
  return async (args) => {
    const p = pickChain(args);
    if (p.error) return fail(p.error);
    return fn(Object.assign({}, args, { _chain: p.chain }));
  };
}

// `chain` is spelled out on every tool rather than merged in by a loop, so that reading this table
// tells you what each tool accepts. The description differs per tool where the two chains want
// different inputs -- an asset id is CODE-ISSUER on both, but the issuer is a G-address on Stellar
// and an r-address on the XRP Ledger, and an agent that is told so gets it right first time.
const CHAIN = { type: 'string', enum: CHAINS, description: 'stellar (default), xrpl or near' };

// WHAT AN ASSET ARGUMENT ACCEPTS, SAID ONCE AND SAID ON EVERY TOOL THAT TAKES ONE.
//
// swap, add_liquidity, remove_liquidity and bridge carried NO description on their asset arguments at
// all, and the ones that had a description named only the CODE-ISSUER form. So an agent holding the
// string "LUMOS" had nothing to tell it that a listed code resolves on its own, tried it, and got
// `"LUMOS" is not an asset id` -- which reads as "no such token" rather than "say which issuer".
// Reported 2026-11-16 together with the empty pool form; the resolver is wantAsset() above.
// NEAR SPELLS AN ASSET DIFFERENTLY FROM THE OTHER TWO, and the description has to say so or an agent
// will send it a CODE-ISSUER. There is no issuer on NEAR: the token's contract account IS its id.
const ASSET = (extra) => ({
  type: 'string',
  description: 'On Stellar and the XRP Ledger: CODE-ISSUER (SHX-GDSTRSHX… / RLUSD-rMxCKbED…), or the '
    + 'native coin as XLM / XRP. On NEAR: the token\'s contract account id '
    + '(lumos.lumoscore.near, or a bridged token\'s 64-hex account), or NEAR for the native coin. '
    + 'A bare code or symbol also works when exactly one listed asset carries it — two carriers '
    + 'refuse and name both, rather than guessing which one you meant. list_curated_assets returns '
    + 'every code that resolves on its own, per chain.'
    + (extra ? ' ' + extra : ''),
});

export const TOOLS = [
  { name: 'get_market', title: 'Live price, 24h stats, supply and market cap for an asset on Stellar, the XRP Ledger or NEAR',
    schema: { chain: CHAIN,
              asset: ASSET() }, required: ['asset'], run: route(getMarket, XRPL.getMarket, NEAR.getMarket) },
  { name: 'list_pools', title: 'Liquidity pools, optionally filtered to one asset (Stellar by TVL, XRP Ledger by 24h volume, NEAR by liquidity; on NEAR an asset filter also lists its concentrated pools)',
    schema: { chain: CHAIN,
              limit: { type: 'number', description: 'Max pools to return (default 20, max 100)' },
              page: { type: 'number', description: 'Stellar only: page of the TVL ranking, 25 per page (default 1)' },
              asset: ASSET('Only pools containing this asset.') }, required: [], run: route(listPools, XRPL.listPools, NEAR.listPools) },
  { name: 'get_portfolio', title: 'Balances, pool positions and open orders for an account',
    schema: { chain: CHAIN,
              address: { type: 'string', description: 'Stellar public key (G…), XRP Ledger account (r…) or NEAR account (alice.near, or a 64-hex implicit account). Without chain, the address shape picks the network.' } }, required: ['address'], run: route(getPortfolio, XRPL.getPortfolio, NEAR.getPortfolio) },
  { name: 'get_quote', title: 'Best-route price for a swap, from the chain\'s own path finder',
    schema: { chain: CHAIN, from: ASSET('The asset being sold.'), to: ASSET('The asset being bought.'), amount: { type: 'number', description: 'How much of `from` to sell' },
              address: { type: 'string', description: 'XRP Ledger only, optional: with it, the ledger router quotes for that account (its trustlines and balances); without it, the quote is the public market (order book and AMM) and says so' } }, required: ['from', 'to', 'amount'], run: route(getQuote, XRPL.getQuote, NEAR.getQuote) },
  { name: 'list_curated_assets', title: 'Assets LumosCore lists, with their verification state',
    schema: { chain: CHAIN,
              include_mints: { type: 'boolean', description: 'Stellar only: also include launchpad mints (not curated)' },
              verified_only: { type: 'boolean', description: 'Only assets that carry the tick' },
              limit: { type: 'number', description: 'XRP Ledger only: how many of the top tokens by volume (default 100, max 100)' } }, required: [], run: route(listCuratedAssets, XRPL.listCuratedAssets, NEAR.listCuratedAssets) },
  { name: 'get_orderbook', title: 'Live bids, asks, spread and depth for an asset against the chain\'s native coin',
    schema: { chain: CHAIN,
              asset: ASSET('Quoted against XLM on Stellar, against XRP on the XRP Ledger. NEAR has no order book: its limit orders sit inside Rhea concentrated pools, which list_pools with this asset shows.'),
              limit: { type: 'number', description: 'Rows per side (default 8, max 50)' } }, required: ['asset'], run: route(getOrderbook, XRPL.getOrderbook, NEAR.getOrderbook) },
  { name: 'list_blog_posts', title: 'LumosCore blog posts, newest first',
    schema: { chain: CHAIN,
              limit: { type: 'number', description: 'Max posts (default 20)' },
              tag: { type: 'string', description: 'Only posts carrying this tag' },
              category: { type: 'string', description: 'Only posts in this category' } }, required: [], run: blogChain(listBlogPosts) },
  { name: 'get_blog_post', title: 'Read one LumosCore blog post in full',
    schema: { slug: { type: 'string', description: 'Post slug from list_blog_posts' } }, required: ['slug'], run: getBlogPost },
  { name: 'get_rewards', title: 'LUMOS reward programs and the incentivized pool roster',
    schema: { chain: CHAIN,
              address: { type: 'string', description: 'Stellar public key (G…), XRP Ledger account (r…) or NEAR account, optional. Without chain, the address shape picks the network.' } }, required: [], run: route(getRewards, XRPL.getRewards, NEAR.getRewards) },
  { name: 'swap', title: 'Prepare a swap for you to approve (does not sign)',
    schema: { chain: CHAIN, from: ASSET('The asset being sold.'), to: ASSET('The asset being bought.'), amount: { type: 'number', description: 'How much of `from` to sell' },
              address: { type: 'string', description: 'XRP Ledger only, optional: your r… account, so the attached quote is for that wallet (without it, a public-market quote is attached)' } }, required: ['from', 'to', 'amount'], run: route(swap, XRPL.swap, NEAR.swap) },
  { name: 'add_liquidity', title: 'Prepare an AMM deposit for you to approve (does not sign)',
    schema: { chain: CHAIN, a: ASSET('One side of the pool.'), b: ASSET('The other side of the pool.'),
              amount_a: { type: 'number', description: 'How much of `a` to deposit' },
              amount_b: { type: 'number', description: 'How much of `b` to deposit' } }, required: ['a', 'b', 'amount_a', 'amount_b'], run: route(addLiquidity, XRPL.addLiquidity, NEAR.addLiquidity) },
  { name: 'remove_liquidity', title: 'Prepare an AMM withdrawal for you to approve (does not sign)',
    schema: { chain: CHAIN, a: ASSET('One side of the pool.'), b: ASSET('The other side of the pool.') }, required: ['a', 'b'], run: route(removeLiquidity, XRPL.removeLiquidity, NEAR.removeLiquidity) },
  { name: 'bridge', title: 'Prepare a cross-chain transfer for you to approve (does not sign)',
    schema: { chain: CHAIN, asset: ASSET('The asset to send.'), to_network: { type: 'string', description: 'Destination network name, e.g. XRPL, Base, Arbitrum' }, amount: { type: 'number', description: 'How much of `asset` to send' }, recipient: { type: 'string', description: 'Receiving address on the destination network. Optional — the bridge page asks for it if omitted' } }, required: ['asset', 'to_network', 'amount'], run: route(bridge, XRPL.bridge, NEAR.bridge) },
  { name: 'launch_token', title: 'Prepare a token issuance for you to approve (does not sign)',
    schema: { chain: CHAIN, code: { type: 'string' }, supply: { type: 'number' } }, required: ['code', 'supply'], run: route(launchToken, XRPL.launchToken, NEAR.launchToken) },
];

export { ApiError };
