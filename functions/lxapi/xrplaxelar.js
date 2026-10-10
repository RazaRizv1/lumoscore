// Cloudflare Pages Function — the bridge's Axelar ITS route, for the XRP Ledger build.
//
// Two jobs, both read-only: publish which assets Axelar can actually move OUT of the XRP Ledger, and
// price the relay. Nothing here signs anything and nothing here is secret.
//
// WHY A PROXY AT ALL. api.axelarscan.io does not answer a browser preflight from our origin, so a
// direct call from the page is a CORS failure rather than an answer. This makes the call from a place
// with no CORS and caches it at the edge, so every keystroke in the amount field is not an upstream
// request.
//
// WHAT THIS ROUTE IS FOR, next to /lxapi/oneclick. NEAR Intents reaches 35 chains but moves ONLY XRP.
// Axelar reaches far fewer, and moves the seventeen ITS assets registered on the XRP Ledger —
// WETH, WBTC, USDC, SHX and the Midas RWA tokens — which NEAR Intents cannot touch at all. It is also
// the only way to XRPL EVM. The two routes overlap almost nowhere, which is why both are worth having.
//
// THE TRUSTLINE TRAP THAT KILLED THIS ROUTE ON STELLAR DOES NOT APPLY HERE. There it was an INBOUND
// problem: delivering an IOU to an XRPL account with no trustline fails, and nothing checked the
// recipient. Going OUT of the XRP Ledger the sender already holds the asset, so the trustline exists
// by definition. Anything this build later delivers INTO the XRP Ledger has to re-open that question.
const ITS = 'https://api.axelarscan.io/api/getITSAssets';
const GAS = 'https://api.axelarscan.io/gmp/estimateGasFee';
const TIMEOUT_MS = 12000;
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

// An XRPL ITS token address is the literal "XRP", or "<currency>.<issuer r-address>".
//
// THE CURRENCY COMES IN BOTH OF THE LEDGER'S TWO FORMS and the first version of this only accepted
// one. XRPL currency codes are either a 40-character hex 160-bit code (WETH ships as
// 5745544800…00) or a THREE-CHARACTER ASCII code (SHX ships as plain "SHX"). Requiring hex dropped
// SHX on the floor -- silently, since a registry entry that fails to parse is simply not listed --
// and took Solana with it, because SHX was the only asset reaching it. 17 registered, 16 served, and
// nothing said so.
//
// Neither form is decoded into the other. The value here goes into a Payment's Amount.currency
// unchanged, because converting a hex code to a ticker is lossy for anything that is not three ASCII
// characters and is how a currency code gets quietly corrupted.
function xrplId(tokenAddress) {
  const s = String(tokenAddress || '');
  if (s === 'XRP') return { native: true, currency: 'XRP', issuer: null };
  const dot = s.indexOf('.');
  if (dot < 0) return null;
  const currency = s.slice(0, dot), issuer = s.slice(dot + 1);
  if (!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(issuer)) return null;
  // Hex form: normalised to upper case, which is how the ledger compares it.
  if (/^[0-9A-Fa-f]{40}$/.test(currency)) return { native: false, currency: currency.toUpperCase(), issuer: issuer };
  // Standard form: exactly three characters, and never "XRP" -- the ledger reserves that for the
  // native asset and refuses it as an issued currency.
  if (/^[A-Za-z0-9?!@#$%^&*<>(){}\[\]|]{3}$/.test(currency) && currency !== 'XRP') {
    return { native: false, currency: currency, issuer: issuer };
  }
  return null;
}

let ASSETS = null, ASSETS_AT = 0, DESTS = null;
async function assets() {
  if (ASSETS && Date.now() - ASSETS_AT < 600000) return ASSETS;
  const r = await fetch(ITS, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!r.ok) throw new Error('registry unavailable');
  const body = await r.json();
  const list = Array.isArray(body) ? body : (body && body.data) || [];
  const out = [];
  const dests = {};
  for (const t of list) {
    const ch = t && t.chains;
    if (!ch || !ch.xrpl) continue;
    const id = xrplId(ch.xrpl.tokenAddress);
    if (!id) continue;
    const to = Object.keys(ch).filter((c) => c !== 'xrpl');
    if (!to.length) continue;
    to.forEach((c) => { dests[c] = 1; });
    out.push({
      tokenId: t.id,
      symbol: ch.xrpl.symbol || t.symbol || '',
      name: ch.xrpl.name || t.name || '',
      decimals: Number(t.decimals) || 0,
      native: id.native,
      currency: id.currency,
      issuer: id.issuer,
      chains: to,
    });
  }
  DESTS = dests;
  ASSETS = out;
  ASSETS_AT = Date.now();
  return ASSETS;
}

export async function onRequestGet({ request }) {
  const q = new URL(request.url).searchParams;
  const op = q.get('op');
  try {
    if (op === 'assets') {
      const list = await assets();
      return json({ ok: 1, gateway: GATEWAY, assets: list, destinations: Object.keys(DESTS || {}) }, 200, 600);
    }
    if (op === 'gas') {
      const list = await assets();
      const symbol = String(q.get('symbol') || '');
      const dest = String(q.get('dest') || '');
      const asset = list.find((a) => a.symbol === symbol);
      if (!asset) return json({ ok: 0, error: 'unknown asset' }, 400);
      if (asset.chains.indexOf(dest) < 0) return json({ ok: 0, error: symbol + ' does not reach ' + dest }, 400);
      const r = await fetch(GAS, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sourceChain: 'xrpl', destinationChain: dest,
          gasLimit: GAS_LIMIT, sourceTokenSymbol: symbol }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // The endpoint answers with a BARE NUMBER AS TEXT, not JSON. Read it as text and prove it is a
      // number -- an HTML error page parses as NaN and would quietly become a zero-gas transfer.
      const t = (await r.text()).trim();
      if (!r.ok || !/^[0-9]{1,30}$/.test(t)) return json({ ok: 0, error: 'estimate unavailable' }, 502);

      // A ZERO ESTIMATE IS REFUSED, NOT PASSED ON AS FREE. Measured 2026-09-29: WBTC -> xrpl-evm
      // returns exactly 0 while WBTC -> ethereum returns 3041. A transfer carrying gas_fee_amount 0
      // does not relay -- it indexes as INSUFFICIENT_GAS at best -- and on this route the funds have
      // already left the account by then. Saying "no quote" costs a user nothing; passing a zero on
      // costs them the transfer.
      if (t === '0') return json({ ok: 0, error: 'no gas estimate for this pair' }, 503);

      return json({ ok: 1, symbol: symbol, dest: dest, decimals: asset.decimals,
        gas: t, gasLimit: GAS_LIMIT }, 200, 60);
    }
    return json({ ok: 0, error: 'unknown op' }, 400);
  } catch (e) {
    return json({ ok: 0, error: 'Axelar unreachable' }, 502);
  }
}

// The XRPL multisig that IS the Axelar gateway and ITS on this ledger. Published to the page so the
// destination of a transfer has ONE source of truth rather than a literal in the browser bundle.
const GATEWAY = 'rfmS3zqrQrka8wVyhXifEeyTwe8AMz2Yhw';
