// What a curated listing costs, right now, in each accepted asset.
//
// The price is $250. XLM is straightforward: 250 / (XLM price in USD).
//
// LUMOS is the interesting one, and the rule is deliberately NOT "250 divided by the LUMOS price".
// It is: how much LUMOS would I have to swap to RECEIVE $250 worth of XLM at this moment. That is a
// different number, because it is answered by the actual order book and pools rather than by a
// headline price -- it includes the spread and the depth the trade would eat through. Someone paying
// in LUMOS pays what the market would really charge them to end up with the same XLM.
//
// Horizon answers exactly that question with a strict-receive path: name the XLM you want to receive,
// name LUMOS as the source, and it returns the LUMOS required. If no path exists -- no liquidity deep
// enough to fill it -- LUMOS is reported unavailable rather than guessed at, and the form offers XLM
// only. A quote invented for an illiquid pair would undercharge or overcharge by an unbounded amount.
const H = 'https://horizon.stellar.org';
const LUMOS_CODE = 'LUMOS';
const LUMOS_ISS = 'GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S';
const PRICE_USD = 250;

// Quotes move. Short enough that nobody pays a stale rate, long enough to survive a page load and a
// wallet approval without re-quoting underneath the user.
const TTL = 60;
// How long a quote the user was SHOWN stays acceptable when their payment finally lands. A wallet
// approval can take a minute; an hour-old quote is a different market.
const QUOTE_VALID_S = 900;

function json(body, status, sMaxAge) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': sMaxAge ? ('public, max-age=' + sMaxAge) : 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}

// Stellar amounts are 7 decimal places; anything longer is rejected by the network.
function amt(n) { return (Math.ceil(n * 1e7) / 1e7).toFixed(7); }

async function xlmUsd(request) {
  // Reuse the site's own price endpoint rather than adding a second source that can disagree with
  // the figure shown everywhere else on the page.
  try {
    const origin = new URL(request.url).origin;
    const r = await fetch(origin + '/lxapi/xlm', { cf: { cacheTtl: 60, cacheEverything: true } });
    if (!r.ok) return 0;
    const d = await r.json();
    const p = +(d && (d.usd || d.price || d.xlmUsd));
    return isFinite(p) && p > 0 ? p : 0;
  } catch (e) { return 0; }
}

async function lumosForXlm(xlmAmount) {
  try {
    const u = H + '/paths/strict-receive'
      + '?destination_asset_type=native'
      + '&destination_amount=' + encodeURIComponent(xlmAmount)
      + '&source_assets=' + encodeURIComponent(LUMOS_CODE + ':' + LUMOS_ISS);
    const r = await fetch(u, { cf: { cacheTtl: 30, cacheEverything: true } });
    if (!r.ok) return 0;
    const d = await r.json();
    const recs = (d && d._embedded && d._embedded.records) || [];
    // Horizon returns every route it found; the cheapest source amount is the one a swap would take.
    let best = 0;
    for (const p of recs) {
      const v = +p.source_amount;
      if (!isFinite(v) || v <= 0) continue;
      if (!best || v < best) best = v;
    }
    return best;
  } catch (e) { return 0; }
}

export async function onRequestGet({ request }) {
  const usd = await xlmUsd(request);
  if (!usd) {
    return json({ ok: false, error: 'price unavailable' }, 503);
  }

  const xlm = PRICE_USD / usd;
  const lumos = await lumosForXlm(amt(xlm));

  return json({
    ok: true,
    priceUsd: PRICE_USD,
    xlmUsd: usd,
    // What the form charges. Both are live and both are quoted for THIS moment.
    options: [
      { asset: 'native', code: 'XLM', amount: amt(xlm) },
      lumos
        ? { asset: LUMOS_CODE + ':' + LUMOS_ISS, code: 'LUMOS', amount: amt(lumos) }
        // Stated rather than hidden: an issuer choosing LUMOS deserves to know why it is not offered.
        : { code: 'LUMOS', unavailable: 'no liquid path from LUMOS to XLM for this size right now' },
    ],
    quotedAt: Date.now(),
    validForSeconds: QUOTE_VALID_S,
  }, 200, TTL);
}
