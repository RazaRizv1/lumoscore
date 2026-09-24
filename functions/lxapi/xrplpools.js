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
  const n = Math.min(100, Math.max(1, parseInt(url.searchParams.get('n') || '50', 10) || 50));

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
  const key = new Request(url.origin + url.pathname + '?n=' + n + '&issuer=' + issuer, request);
  const hit = await cache.match(key);
  if (hit) return hit;

  let out;
  try {
    const r = await upstream('/amm?limit=' + n + '&sort=volume&status=active'
      + (issuer ? '&issuer=' + encodeURIComponent(issuer) : ''), env);
    const rows = ((r && r.pools) || []).map((p) => {
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
      ok: true, count: rows.length, total: num(r && r.total),
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

  const res = json(out, TTL);
  context.waitUntil(cache.put(key, res.clone()));
  return res;
}
