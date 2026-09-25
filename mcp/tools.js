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
  const a = parseAsset(asset);
  if (!a) return fail(`"${asset}" is not an asset id. Use CODE-ISSUER (e.g. SHX-GDSTRSHX…) or XLM.`);
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

async function listPools({ limit = 20, asset }) {
  const want = asset ? parseAsset(asset) : null;
  if (asset && !want) return fail(`"${asset}" is not an asset id. Use CODE-ISSUER or XLM.`);

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
    const recs = await poolsHolding(want, 200);
    const usd = await xlmUsd();
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
    }).sort((x, y) => (y.tvl_usd || 0) - (x.tvl_usd || 0) || (y.total_shares || 0) - (x.total_shares || 0));
    const out = rows.slice(0, Math.max(1, Math.min(200, +limit || 20)));
    return ok({
      count: out.length, of: rows.length, asset: want.id,
      source: 'Horizon, every pool holding this asset',
      tvl_note: 'tvl_usd is filled only where one side is XLM; a pool of two credit assets reports null rather than a guess.',
      pools: out,
    });
  }

  const d = await api('/lxapi/pools');
  const list = Array.isArray(d) ? d : (Array.isArray(d && d.rows) ? d.rows : []);
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
  const a = parseAsset(asset);
  if (!a) return fail(`"${asset}" is not an asset id. Use CODE-ISSUER (e.g. KALE-GBDVX4…) or XLM.`);
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

async function listBlogPosts({ limit = 20, tag, category }) {
  const d = await api('/lxapi/blog');
  let posts = (d && d.posts) || [];
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
  return prepared('add_liquidity', `Deposit ${amount_a} ${A.code} and ${amount_b} ${B.code} into the ${A.code} / ${B.code} pool`,
    web(`/pools/stellar/${encodeURIComponent(A.id)}/${encodeURIComponent(B.id)}`), extra);
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
  { name: 'get_market', title: 'Live price, 24h stats, supply and market cap for a Stellar asset',
    schema: { asset: { type: 'string', description: 'CODE-ISSUER, e.g. SHX-GDSTRSHX…' } }, required: ['asset'], run: getMarket },
  { name: 'list_pools', title: 'Liquidity pools by TVL, optionally filtered to one asset',
    schema: { limit: { type: 'number', description: 'Max pools to return (default 20)' }, asset: { type: 'string', description: 'Only pools containing this asset' } }, required: [], run: listPools },
  { name: 'get_portfolio', title: 'Balances, pool positions and open orders for a Stellar account',
    schema: { address: { type: 'string', description: 'Stellar public key (G…)' } }, required: ['address'], run: getPortfolio },
  { name: 'get_quote', title: 'Best-route price for a swap, from Stellar path finding',
    schema: { from: { type: 'string' }, to: { type: 'string' }, amount: { type: 'number' } }, required: ['from', 'to', 'amount'], run: getQuote },
  { name: 'list_curated_assets', title: 'Every asset LumosCore curates, with its verification state',
    schema: { include_mints: { type: 'boolean', description: 'Also include launchpad mints (not curated)' },
              verified_only: { type: 'boolean', description: 'Only assets that carry the tick' } }, required: [], run: listCuratedAssets },
  { name: 'get_orderbook', title: 'Live bids, asks, spread and depth for an asset against XLM',
    schema: { asset: { type: 'string', description: 'CODE-ISSUER, e.g. KALE-GBDVX4…' },
              limit: { type: 'number', description: 'Rows per side (default 8, max 50)' } }, required: ['asset'], run: getOrderbook },
  { name: 'list_blog_posts', title: 'LumosCore blog posts, newest first',
    schema: { limit: { type: 'number', description: 'Max posts (default 20)' },
              tag: { type: 'string', description: 'Only posts carrying this tag' },
              category: { type: 'string', description: 'Only posts in this category' } }, required: [], run: listBlogPosts },
  { name: 'get_blog_post', title: 'Read one LumosCore blog post in full',
    schema: { slug: { type: 'string', description: 'Post slug from list_blog_posts' } }, required: ['slug'], run: getBlogPost },
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
