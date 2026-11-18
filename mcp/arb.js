// find_arbitrage: loops that start and end in the same asset and return more than they cost, AT THE PERSON'S AMOUNT,
// checked LIVE. (RAZA 2026-11-18: "make the MCP find arbitrage opportunities ... the goal is to turn 10 XLM into 12".)
//
// WHAT WAS MEASURED BEFORE THIS WAS BUILT, and why the live check is the whole tool. A snapshot of all 39,049 Stellar
// pools and 963,275 open offers showed 491 loops above 10 XLM (best +3.7%, nearly all through VELO); re-read live an
// hour later, EVERY ONE returned less than 10 (9.88-9.96). Real gaps exist and close in minutes; bots run this all day.
// So the scanner's shortlist (built off-site on a schedule, see C:\LumosCore-Scanner) only says WHERE to look. Each
// candidate's hops are re-read now -- the pool by id and the order book -- and walked at the exact amount, taking the
// better venue per hop, as a path payment does. Only a loop that still returns more than the input is reported.
//
// NO EARNING CLAIMS: this reports price gaps checked at a stated time for a stated amount. A path payment with destMin
// above the input either lands at least that or fails for the network fee, so trying costs 0.00001 XLM, never the input.
// This server signs nothing; the loop is returned as the exact operation to sign.
import { web, ApiError, xrplRpc } from './api.js';
import { xrplReadHop, xrplHopOut } from './xrpl.js';
import { nearQuoteSession, nearAlong, NearQuoteBusy } from './near.js';

const SHORTLIST_URL = (typeof process !== 'undefined' && process.env && process.env.LUMOSCORE_ARB_SHORTLIST)
  || 'https://raw.githubusercontent.com/RazaRizv1/lumoscore-scanner/shortlist/shortlist-stellar.json';
const HZ = 'https://horizon.stellar.org';
const UA = 'lumoscore-mcp/0.1.0 (+https://lumoscore.com/mcp)';
const MAX_READS = 36;                 // a Worker request has ~50 sub-requests; the shortlist and margin take the rest
const INT64 = 922337203685.4775807;   // the largest balance Stellar allows: a hop past it is rejected on chain

function ok(obj) { return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] }; }
function fail(msg) { return { isError: true, content: [{ type: 'text', text: msg }] }; }
const nf = (n, d = 7) => (n == null || !isFinite(n) ? null : +(+n).toFixed(d));
const q = (a) => (a === 'XLM' ? 'native' : a.replace('-', ':'));
const qp = (pre, a) => (a === 'XLM' ? `${pre}_asset_type=native`
  : `${pre}_asset_type=${a.split('-')[0].length <= 4 ? 'credit_alphanum4' : 'credit_alphanum12'}&${pre}_asset_code=${a.split('-')[0]}&${pre}_asset_issuer=${a.split('-')[1]}`);
const code = (a) => a.split('-')[0];

async function getJson(url, ms = 8000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': UA }, signal: ctl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch (_) { return null; } finally { clearTimeout(t); }
}

// One live read session: each pool and each order book at most once, MAX_READS in all.
function session() {
  let reads = 0; const cache = new Map();
  const read = (key, url) => {
    if (cache.has(key)) return cache.get(key);
    if (reads >= MAX_READS) return Promise.resolve(undefined);       // undefined = not read (budget), null = read, nothing there
    reads++;
    const p = getJson(HZ + url); cache.set(key, p); return p;
  };
  return {
    pool: (id) => (id ? read('p:' + id, '/liquidity_pools/' + id) : Promise.resolve(null)),
    book: (a, b) => read('b:' + a + '>' + b, `/order_book?${qp('selling', a)}&${qp('buying', b)}&limit=200`),
    get reads() { return reads; },
  };
}

// One hop at amount x: the better of the pool and the order book (a path payment takes one venue per hop).
async function hop(s, a, b, poolId, x) {
  const [p, ob] = await Promise.all([s.pool(poolId), s.book(a, b)]);
  if (p === undefined || ob === undefined) return { unread: true };
  let poolOut = 0;
  if (p && p.reserves) {
    const ri = p.reserves.find((r) => r.asset === q(a)), ro = p.reserves.find((r) => r.asset === q(b));
    if (ri && ro && +ri.amount + x <= INT64) { const xin = x * (1 - (+p.fee_bp || 30) / 10000); poolOut = +ro.amount * xin / (+ri.amount + xin); }
  }
  let left = x, got = 0, crossed = 0;
  for (const o of (ob && ob.bids) || []) {             // selling a for b hits the bids: amount in b, price b per a
    if (++crossed > 1000) break;
    const pr = +o.price, canA = +o.amount / pr, take = Math.min(left, canA);
    got += take * pr; left -= take; if (left <= 1e-9) break;
  }
  const bookOut = left > 1e-7 ? 0 : got;
  return bookOut > poolOut ? { out: bookOut, via: 'order book' } : { out: poolOut, via: poolOut > 0 ? 'pool' : null };
}

export async function findArbitrageStellar({ amount, asset }) {
  const a0 = String(asset || 'XLM').trim();
  if (!/^(xlm|native)$/i.test(a0)) {
    return fail('On Stellar, loops are searched from XLM for now (XLM in, XLM out). Pass asset: "XLM", or leave it out.');
  }
  const amt = +amount;
  if (!(amt > 0) || amt > 1e7) return fail('amount must be a positive number of XLM (up to 10,000,000).');

  const sl = await getJson(SHORTLIST_URL, 8000);
  if (!sl || !Array.isArray(sl.loops)) {
    return fail('The scanner\'s list of candidate loops could not be read just now, so nothing was checked. Try again in a few minutes.');
  }
  const snapAge = sl.at ? Math.round((Date.now() - Date.parse(sl.at)) / 60000) : null;
  // Rank by how each did at the snapshot amount closest to this one (by ratio, so sizes compare).
  const near = (sl.amounts || [10]).reduce((b, x) => (Math.abs(Math.log(x / amt)) < Math.abs(Math.log(b / amt)) ? x : b));
  const ratioAt = (l) => { const ks = Object.keys(l.ret || {}).map(Number); if (!ks.length) return -1; const k = ks.reduce((b, x) => (Math.abs(Math.log(x / amt)) < Math.abs(Math.log(b / amt)) ? x : b)); return l.ret[k] / k; };
  const ranked = sl.loops.filter((l) => l.ret && Object.keys(l.ret).length).sort((x, y) => ratioAt(y) - ratioAt(x));

  const s = session(); const checked = []; let skipped = 0;
  for (const l of ranked) {
    const hops = ['XLM', ...l.path, 'XLM'];
    let x = amt; const legs = []; let unread = false;
    for (let i = 0; i < hops.length - 1; i++) {
      const h = await hop(s, hops[i], hops[i + 1], l.pools ? l.pools[i] : null, x);
      if (h.unread) { unread = true; break; }
      legs.push({ from: code(hops[i]), to: code(hops[i + 1]), venue: h.via, out: nf(h.out) });
      x = h.out; if (!(x > 0)) break;
    }
    if (unread) { skipped++; if (s.reads >= MAX_READS) break; continue; }
    checked.push({ path: hops, legs, ret: x });
  }
  checked.sort((x, y) => y.ret - x.ret);
  const FEE = 0.00001;
  const hits = checked.filter((c) => c.ret > amt + FEE);
  const at = new Date().toISOString();
  const fmt = (c) => {
    const destMin = nf(Math.max(amt + FEE, c.ret * 0.998), 7);
    return {
      route: c.path.map(code).join(' → '),
      returns_xlm: nf(c.ret), gap_xlm: nf(c.ret - amt), gap_pct: nf((c.ret / amt - 1) * 100, 3),
      legs: c.legs,
      // The exact operation, for the person's own wallet. destMin keeps it all-or-nothing: below it, it fails.
      operation: {
        type: 'pathPaymentStrictSend', sendAsset: 'native', sendAmount: String(amt), destination: '<your own G… address>',
        destAsset: 'native', destMin: String(destMin), path: c.path.slice(1, -1),
      },
    };
  };
  return ok({
    chain: 'stellar', amount_xlm: amt, checked_live_at: at,
    candidates_checked: checked.length, candidates_skipped_for_budget: skipped || undefined,
    shortlist_built: sl.at || null, shortlist_age_minutes: snapAge,
    found: hits.length,
    loops: hits.slice(0, 5).map(fmt),
    closest_live: hits.length ? undefined : (checked[0] ? { route: checked[0].path.map(code).join(' → '), returns_xlm: nf(checked[0].ret), gap_pct: nf((checked[0].ret / amt - 1) * 100, 3) } : null),
    answer: hits.length
      ? `${hits.length} loop(s) returned more than ${amt} XLM when re-read just now. Gaps like this usually close within minutes.`
      : `No loop returns more than ${amt} XLM right now. ${checked.length} candidates were re-read live; the shortlist that pointed at them is ${snapAge == null ? 'of unknown age' : (snapAge < 1 ? 'under a minute old' : snapAge + (snapAge === 1 ? ' minute old' : ' minutes old'))}.`,
    how_it_works: 'Candidates come from a scheduled scan of every Stellar pool and open offer. Each was re-read live here, '
      + 'pool and order book per hop, at exactly this amount; only loops still returning more than the input are listed.',
    risk: 'A path payment with destMin either delivers at least destMin or fails; a failed attempt costs the 0.00001 XLM '
      + 'network fee, not the amount. Prices move between this check and signing, so it may well fail. No return is promised.',
    signing: 'LumosCore cannot sign this for you yet: build the operation above in your own wallet (sending to your own '
      + 'address), or wait for a LumosCore page that prepares it.',
    page: web('/trade/stellar'),
  });
}

// ---- the XRP Ledger ------------------------------------------------------------------------------------------------
//
// A LOOP STARTS AND ENDS IN A TOKEN, NOT XRP: the ledger rejects an XRP-to-XRP Payment that carries paths
// (temBAD_SEND_XRP_PATHS), so the one all-or-nothing form is a Payment to yourself in a token -- Amount (what must be
// delivered) above SendMax (what you spend), with the loop as its path. The scanner builds loops in RLUSD.
// TRANSFER FEES: an issuer can take a percentage whenever its token moves on; each hop whose input is a token is charged
// its issuer's TransferRate once, read live from account_info (cached per check). Ignoring it "finds" profit in any
// token with a fee. Hops are read and walked exactly as the public-market quote does (xrpl.js readHop / hopOut).
const XRPL_SHORTLIST = (typeof process !== 'undefined' && process.env && process.env.LUMOSCORE_ARB_SHORTLIST_XRPL)
  || 'https://raw.githubusercontent.com/RazaRizv1/lumoscore-scanner/shortlist/shortlist-xrpl.json';
const RLUSD = '524C555344000000000000000000000000000000.rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De';
const xAsset = (id) => (id === 'XRP' ? { native: true, id: 'XRP', code: 'XRP' }
  : { native: false, id, currency: id.split('.')[0], issuer: id.split('.')[1] });
const xCode = (id) => {
  if (id === 'XRP') return 'XRP';
  const c = id.split('.')[0];
  if (c.length !== 40) return c;
  let s = ''; for (let i = 0; i < 40; i += 2) { const n = parseInt(c.slice(i, i + 2), 16); if (n) s += String.fromCharCode(n); }
  return s.replace(/[^ -~]/g, '') || c.slice(0, 8);
};
const X_MAX_HOPS = 14;                // two reads each (amm_info + book_offers) plus transfer rates, within ~50 sub-requests

export async function findArbitrageXrpl({ amount, asset }) {
  const want = String(asset || 'RLUSD').trim();
  if (!/^rlusd$/i.test(want) && want !== 'RLUSD-rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De') {
    return fail('On the XRP Ledger, loops are searched in RLUSD for now (RLUSD in, RLUSD out). An XRP-to-XRP loop cannot be one '
      + 'transaction there: the ledger rejects an XRP-to-XRP payment that carries paths. Pass asset: "RLUSD", or leave it out.');
  }
  const amt = +amount;
  if (!(amt > 0) || amt > 1e7) return fail('amount must be a positive number of RLUSD (up to 10,000,000).');
  const sl = await getJson(XRPL_SHORTLIST, 8000);
  if (!sl || !Array.isArray(sl.loops)) return fail('The scanner\'s list of candidate XRP Ledger loops could not be read just now, so nothing was checked. Try again in a few minutes.');
  const snapAge = sl.at ? Math.round((Date.now() - Date.parse(sl.at)) / 60000) : null;
  const near = (sl.amounts || [10]).reduce((b, x) => (Math.abs(Math.log(x / amt)) < Math.abs(Math.log(b / amt)) ? x : b));
  const ratioAt = (l) => { const ks = Object.keys(l.ret || {}).map(Number); if (!ks.length) return -1; const k = ks.reduce((b, x) => (Math.abs(Math.log(x / amt)) < Math.abs(Math.log(b / amt)) ? x : b)); return l.ret[k] / k; };
  const ranked = sl.loops.filter((l) => l.ret && Object.keys(l.ret).length).sort((x, y) => ratioAt(y) - ratioAt(x));

  const hopCache = new Map(), rateCache = new Map(); let hopsRead = 0;
  const rate = async (id) => {
    if (id === 'XRP') return 1;
    const iss = id.split('.')[1];
    if (!rateCache.has(iss)) rateCache.set(iss, xrplRpc('account_info', { account: iss, ledger_index: 'validated' })
      .then((r) => { const t = r && r.account_data && r.account_data.TransferRate; return t ? t / 1e9 : 1; }, () => 1));
    return rateCache.get(iss);
  };
  const readPair = (a, b) => {
    const k = a + '>' + b;
    if (!hopCache.has(k)) { if (hopsRead >= X_MAX_HOPS) return null; hopsRead++; hopCache.set(k, xrplReadHop(xAsset(a), xAsset(b)).catch(() => null)); }
    return hopCache.get(k);
  };
  const checked = []; let skipped = 0;
  for (const l of ranked) {
    const hops = [RLUSD, ...l.path, RLUSD];
    let x = amt; const legs = []; let unread = false;
    for (let i = 0; i < hops.length - 1; i++) {
      const p = readPair(hops[i], hops[i + 1]);
      if (!p) { unread = true; break; }
      const h = await p;
      if (!h) { x = 0; break; }
      const xin = x / (await rate(hops[i]));
      const o = xrplHopOut(h, xin);
      legs.push({ from: xCode(hops[i]), to: xCode(hops[i + 1]), venue: o.via, out: nf(o.out, 8) });
      x = o.out; if (!(x > 0)) break;
    }
    if (unread) { skipped++; continue; }
    checked.push({ path: hops, legs, ret: x });
  }
  checked.sort((a, b) => b.ret - a.ret);
  const hits = checked.filter((c) => c.ret > amt * 1.000001);
  const cur = (id) => (id === 'XRP' ? { currency: 'XRP' } : { currency: id.split('.')[0], issuer: id.split('.')[1] });
  const fmt = (c) => {
    const deliver = nf(Math.max(amt * 1.000001, c.ret * 0.998), 6);
    return {
      route: c.path.map(xCode).join(' → '),
      returns_rlusd: nf(c.ret, 6), gap_rlusd: nf(c.ret - amt, 6), gap_pct: nf((c.ret / amt - 1) * 100, 3), legs: c.legs,
      // A Payment to yourself: deliver Amount, spend at most SendMax. Amount > SendMax, so it lands only if the loop pays.
      transaction: {
        TransactionType: 'Payment', Account: '<your r… address>', Destination: '<the same r… address>',
        Amount: { currency: cur(RLUSD).currency, issuer: cur(RLUSD).issuer, value: String(deliver) },
        SendMax: { currency: cur(RLUSD).currency, issuer: cur(RLUSD).issuer, value: String(amt) },
        Paths: [c.path.slice(1, -1).map(cur)],
      },
    };
  };
  return ok({
    chain: 'xrpl', asset: 'RLUSD', amount: amt, checked_live_at: new Date().toISOString(),
    candidates_checked: checked.length, candidates_skipped_for_budget: skipped || undefined,
    shortlist_built: sl.at || null, shortlist_age_minutes: snapAge, found: hits.length,
    loops: hits.slice(0, 5).map(fmt),
    closest_live: hits.length ? undefined : (checked[0] ? { route: checked[0].path.map(xCode).join(' → '), returns_rlusd: nf(checked[0].ret, 6), gap_pct: nf((checked[0].ret / amt - 1) * 100, 3) } : null),
    answer: hits.length
      ? `${hits.length} loop(s) returned more than ${amt} RLUSD when re-read just now. Gaps like this usually close within minutes.`
      : `No loop returns more than ${amt} RLUSD right now. ${checked.length} candidates were re-read live; the shortlist that pointed at them is ${snapAge == null ? 'of unknown age' : (snapAge < 1 ? 'under a minute old' : snapAge + (snapAge === 1 ? ' minute old' : ' minutes old'))}.`,
    why_rlusd: 'An XRP-to-XRP loop cannot be one transaction on the XRP Ledger (paths are rejected on XRP-to-XRP payments), so loops start and end in RLUSD.',
    how_it_works: 'Candidates come from a scheduled scan of XRP Ledger AMM pools (data by xrpl.to) and order books. Each was re-read live here at exactly this amount, AMM and order book per hop, with issuer transfer fees applied.',
    risk: 'The payment delivers at least Amount or fails; a failed attempt costs the network fee (a fraction of a drop), not the RLUSD. Prices move between this check and signing. No return is promised.',
    signing: 'LumosCore cannot sign this for you yet: submit the transaction above from your own wallet (paying yourself).',
    data_source: 'XRP Ledger (amm_info, book_offers, account_info); candidate pools: xrpl.to', attribution: 'Data by xrpl.to', attribution_url: 'https://xrpl.to',
  });
}

// ---- NEAR (Rhea) ---------------------------------------------------------------------------------------------------
//
// wNEAR in, wNEAR out, through Rhea's classic pools. One ft_transfer_call to v2.ref-finance.near carries the loop as a
// list of swap actions and reverts entirely when the last one's min_amount_out is not met, so it is all-or-nothing.
// Each hop is asked of Rhea itself (get_return), the same reads as the NEAR swap quote (near.js along / quoteSession).
const NEAR_SHORTLIST = (typeof process !== 'undefined' && process.env && process.env.LUMOSCORE_ARB_SHORTLIST_NEAR)
  || 'https://raw.githubusercontent.com/RazaRizv1/lumoscore-scanner/shortlist/shortlist-near.json';
const N_WNEAR = 'wrap.near', N_LOOPS = 8;
const nToRaw = (n) => { const [w, f = ''] = (+n).toFixed(12).split('.'); return BigInt(w + f.padEnd(24, '0').slice(0, 24)); };
const nFromRaw = (r) => Number(r * 1000000000000n / 10n ** 24n) / 1e12;
const nShort = (id) => (id === N_WNEAR ? 'wNEAR' : id.length > 24 ? id.slice(0, 10) + '…' : id);

export async function findArbitrageNear({ amount, asset }) {
  const want = String(asset || 'NEAR').trim().toLowerCase();
  if (!['near', 'wnear', 'wrap.near'].includes(want)) {
    return fail('On NEAR, loops are searched from wNEAR for now (NEAR in, NEAR out). Pass asset: "NEAR", or leave it out.');
  }
  const amt = +amount;
  if (!(amt > 0) || amt > 1e6) return fail('amount must be a positive number of NEAR (up to 1,000,000).');
  const sl = await getJson(NEAR_SHORTLIST, 8000);
  if (!sl || !Array.isArray(sl.loops)) return fail('The scanner\'s list of candidate NEAR loops could not be read just now, so nothing was checked. Try again in a few minutes.');
  const snapAge = sl.at ? Math.round((Date.now() - Date.parse(sl.at)) / 60000) : null;
  const near = (sl.amounts || [1]).reduce((b, x) => (Math.abs(Math.log(x / amt)) < Math.abs(Math.log(b / amt)) ? x : b));
  // Every loop is a candidate, ranked by its ratio at the recorded size closest to this amount (a loop the scan only
  // found at 1 NEAR is still re-checked at 10; the live quote decides).
  const closestKey = (obj) => Object.keys(obj || {}).map(Number).reduce((b, x) => (b == null || Math.abs(Math.log(x / amt)) < Math.abs(Math.log(b / amt)) ? x : b), null);
  const ranked = sl.loops.filter((l) => l.ret && l.pools).map((l) => { const k = closestKey(l.pools); return { ...l, k, r: l.ret[k] / k }; })
    .filter((l) => l.k != null).sort((x, y) => y.r - x.r).slice(0, N_LOOPS);
  const s = nearQuoteSession(); const start = nToRaw(amt); const checked = []; let busy = false;
  for (const l of ranked) {
    const toks = [N_WNEAR, ...l.path, N_WNEAR];
    const hops = l.pools[l.k].map((id, i) => ({ pool: { id }, tin: toks[i], tout: toks[i + 1] }));
    try { const out = BigInt(await nearAlong(s, hops, start)); checked.push({ toks, hops, out }); }
    catch (e) { if (e instanceof NearQuoteBusy) { busy = true; break; } }
  }
  checked.sort((a, b) => (b.out > a.out ? 1 : -1));
  const hits = checked.filter((c) => c.out > start);
  const fmt = (c) => {
    const minOut = (c.out * 998n / 1000n > start ? c.out * 998n / 1000n : start + 1n).toString();
    return {
      route: c.toks.map(nShort).join(' → '), returns_near: nFromRaw(c.out), gap_near: nFromRaw(c.out - start),
      gap_pct: nf((nFromRaw(c.out) / amt - 1) * 100, 3), pools: c.hops.map((h) => h.pool.id),
      // One call, all-or-nothing: wrap the NEAR, then send it to Rhea with the loop as its actions.
      transaction: {
        receiver: 'wrap.near', method: 'ft_transfer_call', deposit_yocto: '1',
        args: { receiver_id: 'v2.ref-finance.near', amount: start.toString(), msg: { actions: c.hops.map((h, i) => ({
          pool_id: +h.pool.id, token_in: h.tin, token_out: h.tout, ...(i === 0 ? { amount_in: start.toString() } : {}),
          min_amount_out: i === c.hops.length - 1 ? minOut : '0' })) } },
        before: 'Wrap the NEAR first (near_deposit on wrap.near) if it is not already wNEAR.',
      },
    };
  };
  return ok({
    chain: 'near', asset: 'NEAR', amount: amt, checked_live_at: new Date().toISOString(),
    candidates_checked: checked.length, rpc_busy: busy || undefined,
    shortlist_built: sl.at || null, shortlist_age_minutes: snapAge, found: hits.length,
    loops: hits.slice(0, 5).map(fmt),
    closest_live: hits.length ? undefined : (checked[0] ? { route: checked[0].toks.map(nShort).join(' → '), returns_near: nFromRaw(checked[0].out), gap_pct: nf((nFromRaw(checked[0].out) / amt - 1) * 100, 3) } : null),
    answer: busy && !checked.length
      ? 'NEAR\'s public RPC is busy, so no loop could be checked just now. Try again in a moment; this is not "no gaps".'
      : hits.length
        ? `${hits.length} loop(s) returned more than ${amt} NEAR when asked of Rhea just now. Gaps like this usually close within minutes.`
        : `No loop returns more than ${amt} NEAR right now. ${checked.length} candidates were asked of Rhea live; the shortlist that pointed at them is ${snapAge == null ? 'of unknown age' : (snapAge < 1 ? 'under a minute old' : snapAge + (snapAge === 1 ? ' minute old' : ' minutes old'))}.`,
    how_it_works: 'Candidates come from a scheduled scan of every Rhea classic pool. Each was re-quoted live here with Rhea\'s own get_return at exactly this amount.',
    risk: 'Rhea reverts the whole call if the final minimum is not met; a failed attempt costs gas (about 0.003 NEAR), not the NEAR. Prices move between this check and signing. No return is promised.',
    signing: 'LumosCore cannot sign this for you yet: send the call above from your own NEAR wallet.',
  });
}

export const ARB = {
  stellar: findArbitrageStellar,
  xrpl: findArbitrageXrpl,
  near: findArbitrageNear,
  notYet: (name) => async () => fail(`find_arbitrage is not available on ${name} yet — only Stellar so far. `
    + 'The XRP Ledger and NEAR scanners are being built.'),
};
