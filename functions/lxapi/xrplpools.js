// AMM pools on the XRP Ledger, for the Pools page.
//
// Replaces `lx-ammdata` (~286KB), which drives four pages and was walking Stellar's Horizon on an
// XRP Ledger site -- the Pools page literally reported "Ranking the network's pools… 7,800 scanned
// so far" while ranking Stellar pools, then rendered TVL in XLM.
//
// RANKED BY VOLUME, NOT LIQUIDITY, and that is a measured decision rather than a preference.
// Asking the upstream for sort=liquidity returns five BITx/… pools each claiming 113,142,29x of
// liquidity and ZERO 24h volume -- nominal value conjured out of a worthless token pairing with
// itself. sort=volume returns XRP/RLUSD, XRP/FUZZY, XRP/ARMY, XRP/USDC: pools people actually
// trade. A "top pools" table sorted by a number anyone can inflate for free is worse than no table.
//
// The response also carries the network-wide summary the page's overview cards need, which comes
// from the same request rather than a second one that could disagree with it.

const UP = 'https://api.xrpl.to/api';
const TTL = 120;

const json = (body, secs) => new Response(JSON.stringify(body), {
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=' + secs,
    'access-control-allow-origin': '*',
  },
});

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function upstream(path, env) {
  const headers = { accept: 'application/json', 'user-agent': 'LumosCore/1.0 (+https://lumoscore.com)' };
  if (env && env.XRPLTO_API_KEY) headers['x-api-key'] = env.XRPLTO_API_KEY;
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch(UP + path, { headers });
    if (r.ok) return r.json();
    if (r.status !== 429 || attempt === 1) throw new Error('upstream ' + r.status);
    const ra = Number(r.headers.get('retry-after'));
    await sleep(isFinite(ra) && ra > 0 && ra <= 5 ? ra * 1000 : 1200);
  }
  throw new Error('upstream 429');
}

const num = (v) => { const n = Number(v); return isFinite(n) ? n : null; };

// The upstream marks the native side with issuer "XRPL" and currency "XRP".
// `amount` comes from currentLiquidity, not from the asset object — the asset object never carried
// a value, which is why `v` was null on every row until this was passed in.
function side(a, amount) {
  if (!a) return null;
  return {
    c: String(a.currency || ''),
    i: a.issuer === 'XRPL' ? '' : String(a.issuer || ''),
    v: num(amount != null ? amount : a.value),
    m: String(a.md5 || ''),
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  // HOW MANY POOLS THE RANKING IS DRAWN FROM. The ceiling used to be 100, which is the UPSTREAM's
  // per-request limit, not a limit on what we can rank — so the Pools page ranked 100 of the
  // ledger's 31,318 active pools and the table's own badge said so (RAZA 2026-10-07).
  //
  // The upstream caps `limit` at 100 and ignores `skip`, but it honours `page`, so more is a matter
  // of asking repeatedly. PAGES is bounded at 10 deliberately: ten subrequests sits well inside the
  // Workers ceiling, and the measured volume curve means the eleventh page would add nothing a
  // reader would see. Fetching all 314 pages per visitor is not an option — the upstream rate-limits
  // long before that, which this investigation triggered.
  const MAX_ROWS = 1000;
  const PER = 100;
  const n = Math.min(MAX_ROWS, Math.max(1, parseInt(url.searchParams.get('n') || '50', 10) || 50));

  // WHERE IN THE RANKING TO START, so a caller can walk past MAX_ROWS without this function ever
  // making more than ten upstream calls in one request.
  //
  // 1000 per call is not an arbitrary bound: 10,000 rows would be 100 upstream pages, and a Worker
  // on the free plan gets 50 subrequests and 10ms of CPU. A single request asking for all of them
  // fails at page 51. So depth is the CLIENT's to accumulate — ten calls of a thousand — and each
  // call stays well inside the limits and is edge-cached on its own key.
  const p0 = Math.min(1000, Math.max(1, parseInt(url.searchParams.get('p0') || '1', 10) || 1));

  // Optional: restrict to pools where one side is issued by this account. The upstream honours
  // `issuer` on /amm and narrows 30,648 pools to the 22 holding LUMOS -- which is the only way to
  // put a real pool count on the token page. Verified against the listing: all 22 come back with
  // status "active" and a populated currentLiquidity, and one of them is the known Native LP
  // account rnPQqk3cfHyqSyvAGh3AfMtWiszK8zaF4U.
  //
  // Constrained to the XRPL address shape rather than passed through, so this cannot be used to
  // graft arbitrary query onto the upstream path.
  const issuerRaw = (url.searchParams.get('issuer') || '').trim();
  const issuer = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(issuerRaw) ? issuerRaw : '';

  const cache = caches.default;
  // p0 BELONGS IN THE KEY. Without it every batch of a walk collides on one cache entry, and
  // batches 2..10 would be served batch 1's rows — a thousand duplicates presented as ten thousand
  // pools, which looks like it worked.
  const key = new Request(url.origin + url.pathname + '?n=' + n + '&p0=' + p0 + '&issuer=' + issuer, request);
  const hit = await cache.match(key);
  if (hit) return hit;

  let out;
  try {
    // THE SORT KEY WAS WRONG, and that mattered more than the row cap.
    //
    // This asked for `sort=volume`, and the upstream does not order by the 24h volume we render
    // under it: measured on our own response, the first five rows came back 156223, 8385, 7193,
    // 17361, 21612 — not descending by anything on screen. So "the top 100 pools" were an
    // ARBITRARY 100 of 31,318, and the page then sorted those 100 by liquidity, which is how a
    // pool with real volume could be missing from a table claiming to rank by it.
    //
    // `sort=volume24h` is the key that works. Verified: strictly descending within a page and
    // continuous across pages (page 1 ended at 58, page 2 opened at 57). So now the upstream does
    // the "consider every pool" part across all 31,318 and hands back the genuine head of the list.
    const q = (page) => '/amm?limit=' + PER + '&sort=volume24h&status=active'
      + (page > 1 ? '&page=' + page : '')
      + (issuer ? '&issuer=' + encodeURIComponent(issuer) : '');

    const first = await upstream(q(p0), env);
    const pools = ((first && first.pools) || []).slice();
    // Sequential, not parallel: the upstream 429s readily, and `upstream()` backs off per call.
    // Stops early on a short page, which is what makes the `issuer` filter cost ONE request for a
    // typical issuer — the reason an exhaustive per-asset search is affordable at all.
    let pagesRead = 1;
    for (let i = 1; pools.length < n && i < Math.ceil(n / PER); i++) {
      if ((first.pools || []).length < PER) break;      // the first page was already short
      const more = await upstream(q(p0 + i), env);
      const batch = (more && more.pools) || [];
      pagesRead++;
      if (!batch.length) break;
      pools.push(...batch);
      if (batch.length < PER) break;
    }

    const r = first;
    const rows = pools.slice(0, n).map((p) => {
      const a = p.apy24h || {};
      return {
        id: String(p._id || ''),
        acct: String(p.ammAccount || ''),
        // THE POOL COMPOSITION WAS AVAILABLE ALL ALONG and this mapping dropped it.
        //
        // `side()` reads asset1/asset2, which carry the currency and issuer but no amount — so a1.v
        // and a2.v came back null on every row, and I told RAZA the two sides could not be shown
        // without an amm_info per pool. That was wrong: the upstream puts the amounts in a separate
        // object, `currentLiquidity.asset1Amount` / `asset2Amount`, and it is already in the same
        // response. Nothing extra is fetched to fill these.
        a1: side(p.asset1, p.currentLiquidity && p.currentLiquidity.asset1Amount),
        a2: side(p.asset2, p.currentLiquidity && p.currentLiquidity.asset2Amount),
        // tradingFee is in units of 1/1000 of a percent, so 205 is 0.205%.
        fee: num(p.tradingFee) == null ? null : num(p.tradingFee) / 1000,
        liq: num(a.liquidity), vol: num(a.volume), fees: num(a.fees), apy: num(a.apy),
        holders: num(p.lpHolderCount),
        depth: (p.health && p.health.depth) || '',
      };
    });

    const s = (r && r.summary) || {};
    // THE SUMMARY IS NOT FILTERED. With `issuer` set the upstream narrows `pools` and `total` but
    // returns the SAME whole-market summary -- 28.7M liquidity, 408K 24h volume across all 30,648
    // pools. Passing that back beside 22 LUMOS pools would invite reading it as LUMOS's liquidity,
    // which is wrong by four orders of magnitude. Dropped rather than relabelled: a filtered
    // summary is not something this response can honestly supply.
    out = {
      // `more` is what lets a caller walk the ranking without guessing: a full batch means the next
      // one is worth asking for, a short one means the list ran out. `p0`/`nextP0` are echoed so a
      // client loop never has to track page arithmetic itself.
      ok: true, count: rows.length, total: num(r && r.total),
      p0, nextP0: p0 + pagesRead, more: rows.length >= n,
      filteredBy: issuer || null,
      summary: issuer ? null : {
        liquidity: num(s.totalLiquidity),
        vol24: num(s.totalVolume24h),
        fees24: num(s.totalFees24h),
        avgFee: num(s.avgFee),
      },
      rows,
      src: 'xrpl.to', attribution: 'Data by xrpl.to', attributionUrl: 'https://xrpl.to',
    };
  } catch (e) {
    return json({ ok: false, error: String((e && e.message) || e), rows: [] }, 30);
  }

  // THE DEEP BATCHES ARE CACHED FOR LONGER, which is what makes a 10,000-row walk reachable at all.
  //
  // Measured 2026-10-07: a cold walk asks for ten batches, each costing ten upstream calls, and the
  // upstream 429s partway — the diagnostic on the page reported "upstream refused (upstream 429)" at
  // p0=21, so the table settled at 2,000 of the 10,000 it was asked for. At a flat 120s every batch
  // expired before the next visitor arrived and the whole hundred calls were paid again.
  //
  // The head of the ranking is what moves: it is ordered by 24h volume, and the top pools re-order
  // within minutes. Rows past the first thousand are the long tail — pools whose volume barely
  // changes — so a short TTL there buys freshness nobody can see and spends the rate limit that the
  // depth itself needs. The head keeps its 120s.
  const res = json(out, p0 > 1 ? 900 : TTL);
  context.waitUntil(cache.put(key, res.clone()));
  return res;
}
