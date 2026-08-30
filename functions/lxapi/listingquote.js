// What a curated listing costs, right now.
//
// The price is $250, charged in XLM: 250 / (XLM price in USD), quoted live rather than fixed, so a
// move in XLM does not quietly change what a listing really costs.
//
// LUMOS was offered here briefly and removed. It was priced honestly -- the amount that would have to
// be swapped to RECEIVE $250 of XLM, taken from Horizon's strict-receive path so it included the
// spread and the depth the trade would eat -- and on a thin book that came out near double the
// headline value. A real number, but not one any issuer would choose, and quietly discounting it
// instead would have meant charging less than $250 while claiming otherwise. XLM only until the
// LUMOS book is deep enough for the honest number to also be a fair one.
const PRICE_USD = 250;

// A TEST PRICE, AND ONLY ON STAGING.
//
// The end-to-end flow -- quote, sign, pay, verify on-chain, queue, approve, refund -- can only really
// be exercised with a real mainnet payment, and nobody should spend $250 to find out whether the
// button works. So staging quotes a token amount instead.
//
// Gated on the HOST rather than left as a constant to flip back, because functions/ is shared by
// every project: a flat override sitting in this file would go to production with the next deploy and
// put curated listings on sale for ten cents. Tying it to the hostname means production cannot serve
// this price even if someone forgets it is here.
const TEST_PRICE_USD = 0.1;
const STAGING_HOST = 'lumoscore-staging.pages.dev';

function priceFor(request) {
  let h = '';
  try { h = new URL(request.url).hostname.toLowerCase(); } catch (e) { return PRICE_USD; }
  // Both the project host and its per-deployment hash subdomains, which is what actually gets used --
  // the bare staging host sits behind Access.
  const staging = h === STAGING_HOST || h.endsWith('.' + STAGING_HOST);
  return staging ? TEST_PRICE_USD : PRICE_USD;
}

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

// Stellar amounts carry 7 decimal places; anything longer is rejected by the network. Rounded UP, so
// a quote can never come out a stroop short of the price.
function amt(n) { return (Math.ceil(n * 1e7) / 1e7).toFixed(7); }

async function xlmUsd(request) {
  // The site's own price endpoint, not a second source: a different feed here would disagree with the
  // figure shown everywhere else on the page.
  try {
    const origin = new URL(request.url).origin;
    const r = await fetch(origin + '/lxapi/xlm', { cf: { cacheTtl: 60, cacheEverything: true } });
    if (!r.ok) return 0;
    const d = await r.json();
    const p = +(d && (d.usd || d.price || d.xlmUsd));
    return isFinite(p) && p > 0 ? p : 0;
  } catch (e) { return 0; }
}

export async function onRequestGet({ request }) {
  const usd = await xlmUsd(request);
  // No price, no quote. Charging from a stale or guessed rate is worse than asking someone to retry.
  if (!usd) return json({ ok: false, error: 'price unavailable' }, 503);

  const price = priceFor(request);
  return json({
    ok: true,
    priceUsd: price,
    // Stated in the response rather than inferred by the page, so a host serving the test price says
    // so out loud and can be shown saying so.
    testPricing: price !== PRICE_USD,
    listPriceUsd: PRICE_USD,
    xlmUsd: usd,
    options: [
      { asset: 'native', code: 'XLM', amount: amt(price / usd) },
    ],
    quotedAt: Date.now(),
    validForSeconds: QUOTE_VALID_S,
  }, 200, TTL);
}
