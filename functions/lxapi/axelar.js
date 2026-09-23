// Cloudflare Pages Function — the bridge's Axelar ITS route, gas estimate only.
//
// WHY A PROXY. api.axelarscan.io does not answer a browser preflight from our origin, so a direct call from the page
// is a CORS failure rather than a price. Nothing secret is involved here (unlike /lxapi/oneclick, which carries an
// API key); this exists purely to make the call from a place that has no CORS, and to cache the answer at the edge
// so every keystroke in the amount field does not become an upstream request.
//
// WHAT IS LET THROUGH. One shape, one upstream endpoint, and a destination that must be one of the two chains the
// bridge actually offers on this route — so the endpoint cannot be turned into a general relay for Axelar's API.
//
// The figure returned is XLM in STROOPS, which is what interchain_transfer's gas_token wants. It is Axelar's own
// estimate for relaying and executing the message on the destination; it is not LumosCore's fee and not the
// Stellar network fee.
const API = 'https://api.axelarscan.io/gmp/estimateGasFee';
const TIMEOUT_MS = 12000;
// Axelar's chain ids for the two destinations this route serves. Case matters upstream: the Stellar ITS contract
// itself refuses 'ethereum' while accepting 'Ethereum', and these two are the exact strings its trusted-chain list
// holds (both verified against the live contract on 2026-09-23).
const DEST = { xrpl: 1, 'xrpl-evm': 1 };
const GAS_LIMIT = '200000';

function json(body, status, ttl) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': ttl ? ('public, max-age=0, s-maxage=' + ttl) : 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: {
    'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,OPTIONS',
    'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' } });
}

export async function onRequestGet({ request }) {
  const q = new URL(request.url).searchParams;
  if (q.get('op') !== 'gas') return json({ ok: 0, error: 'unknown op' }, 400);
  const dest = String(q.get('dest') || '');
  if (!DEST[dest]) return json({ ok: 0, error: 'unsupported destination' }, 400);
  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sourceChain: 'stellar', destinationChain: dest, gasLimit: GAS_LIMIT, sourceTokenSymbol: 'XLM' }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // The endpoint answers with a bare number as text, not JSON. Read it as text and validate it IS a number --
    // an HTML error page would otherwise parse as NaN and quietly become a zero-gas transfer that never relays.
    const t = (await r.text()).trim();
    if (!r.ok || !/^[0-9]{1,18}$/.test(t)) return json({ ok: 0, error: 'estimate unavailable' }, 502);
    const stroops = t;
    return json({ ok: 1, dest, stroops, xlm: Number(stroops) / 1e7 }, 200, 60);
  } catch (e) {
    return json({ ok: 0, error: 'Axelar unreachable' }, 502);
  }
}
