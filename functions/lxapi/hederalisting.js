// Curated listing applications for HEDERA tokens: the quote (GET) and the paid request (POST).
//
// listing.js's twin, for the other ledger, and built on the same rule: THE ONLY THING THAT MAKES THIS
// SAFE IS THAT THE PAYMENT IS VERIFIED ON-CHAIN. The body is a stranger's claim; the Mirror Node is the
// record. A request is accepted only if the transaction the browser names:
//   * exists and reached consensus with SUCCESS;
//   * is under 24 hours old (see listing.js MAX_PAYMENT_AGE_MS for why a window has to exist at all);
//   * carries the memo "LumosCore listing" -- the collector also receives every swap fee, and the memo
//     is what separates a listing payment from those, on top of the window;
//   * credits OUR collector with HBAR of at least the quoted amount, re-quoted here;
//   * and has not already been used for another request.
// The refund account is the transaction's PAYER, never anything in the form.
//
// It writes into the same listing_request table as listing.js, with network = 'hedera', so the admin
// queue is one queue. Two columns are spelled for this ledger and the admin endpoint knows it:
//   issuer      the token id, 0.0.x -- on Hedera the token id IS the identity (there is no issuer account)
//   tx_hash     the transaction hash as 96 hex characters (the Mirror Node gives it in base64). Hex, so
//               the id scheme ('lr_' + 16 hex) and the UNIQUE replay key work unchanged.
// The transaction id (0.0.x-seconds-nanos), which is what HashScan and the wallet show, is not a column;
// the admin endpoint derives links from the hash's record when it needs one.
//
// Lives here, not in the Hedera fork, because the logo handling must stay ONE implementation:
// storeLogo is imported from listing.js. The fork takes both files through shared-functions.json.
import { storeLogo } from './listing.js';

const COLLECTOR = '0.0.10229748';                 // RAZA, 2026-10-21; the platform fee account
const MIRROR = 'https://mainnet-public.mirrornode.hedera.com/api/v1';
const MEMO = 'LumosCore listing';
const PRICE_USD = 250;
const QUOTE_TTL = 60;
const QUOTE_VALID_S = 900;
// The HBAR price is the site's own (/lxapi/hederamarket), so the fee and every other figure agree. That
// endpoint serves its last good answer when DexScreener fails; for a CHARGE, an answer older than this
// is refused rather than used -- a guessed price is a price someone pays.
const PRICE_MAX_AGE_MS = 15 * 60 * 1000;
const TOLERANCE = 0.97;
const MAX_PAYMENT_AGE_MS = 24 * 3600 * 1000;
const FUTURE_SKEW_MS = 5 * 60 * 1000;

const TOKEN_RE = /^0\.0\.\d{1,12}$/;
// 0.0.5@1729000000.000000123 (SDK / wallet spelling) or 0.0.5-1729000000-000000123 (Mirror spelling).
const TXID_RE = /^(0\.0\.\d{1,12})[@-](\d{1,12})[.-](\d{1,9})$/;
const LIMITS = { descr: 600, website: 200, handle: 80, discord: 200 };

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
function clip(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) : s; }
// Same scheme rule as listing.js: these land in an href on the admin panel and, after approval, a page.
function safeSite(s, max) {
  const v = clip(s, max).trim();
  if (!v) return '';
  const lc = v.toLowerCase();
  if (lc.indexOf('http://') === 0 || lc.indexOf('https://') === 0) return v;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/[^\s]*)?$/i.test(v)) return v;
  return '';
}

// HBAR has 8 decimals (tinybar). Rounded UP, so a quote is never a tinybar short of the price.
function hbar(n) { return (Math.ceil(n * 1e8) / 1e8).toFixed(8); }

export function mirrorTxId(id) {
  const m = TXID_RE.exec(String(id || '').trim());
  return m ? m[1] + '-' + m[2] + '-' + m[3].padStart(9, '0') : '';
}
export function b64hex(s) {
  try {
    const bin = atob(String(s || ''));
    let h = '';
    for (let i = 0; i < bin.length; i++) h += bin.charCodeAt(i).toString(16).padStart(2, '0');
    return h;
  } catch (e) { return ''; }
}

async function hbarUsd(request) {
  try {
    const origin = new URL(request.url).origin;
    const r = await fetch(origin + '/lxapi/hederamarket', { cf: { cacheTtlByStatus: { '200-299': 30, '300-399': 0, '400-599': 0 } } });
    if (!r.ok) return 0;
    const d = await r.json();
    if (!d || !d.ok || !(+d.usd > 0)) return 0;
    if (!(+d.at > 0) || Date.now() - +d.at > PRICE_MAX_AGE_MS) return 0;
    return +d.usd;
  } catch (e) { return 0; }
}

// The payment, as the CHAIN describes it. Pure over one Mirror Node transaction record, so it can be
// checked against real records without a network (exported for that; exports are not routes).
export function checkPayment(t, want, now) {
  if (!t) return { err: 'transaction not found' };
  if (t.result !== 'SUCCESS') return { err: 'that transaction did not succeed (' + t.result + ')' };
  const at = Math.floor(parseFloat(t.consensus_timestamp || '0') * 1000);
  if (!at) return { err: 'could not read the payment date' };
  const age = now - at;
  if (age > MAX_PAYMENT_AGE_MS) {
    return { err: 'that payment is more than 24 hours old. Listing payments must be made as part of '
      + 'this application — if you paid recently and the form failed, contact support with the transaction id.' };
  }
  if (age < -FUTURE_SKEW_MS) return { err: 'that payment is dated in the future' };
  let memo = '';
  try { memo = new TextDecoder().decode(Uint8Array.from(atob(t.memo_base64 || ''), (c) => c.charCodeAt(0))); } catch (e) { memo = ''; }
  if (memo.trim() !== MEMO) return { err: 'that transaction is not a LumosCore listing payment (memo "' + MEMO + '" missing)' };
  const payer = String(t.transaction_id || '').split('-')[0];
  if (!TOKEN_RE.test(payer)) return { err: 'could not read who paid' };
  // HBAR only: token transfers are a different array, and a token is not a listing fee even at par.
  let tiny = 0;
  for (const x of t.transfers || []) if (x.account === COLLECTOR && +x.amount > 0) tiny += +x.amount;
  if (!tiny) return { err: 'no HBAR payment to the listing account in that transaction' };
  const amount = tiny / 1e8;
  if (want && amount < want * TOLERANCE) {
    return { err: 'the payment is short: ' + amount.toFixed(8) + ' HBAR received, about ' + want.toFixed(8) + ' HBAR required' };
  }
  const hash = b64hex(t.transaction_hash);
  if (!/^[0-9a-f]{96}$/.test(hash)) return { err: 'could not read the transaction hash' };
  return { payer, amount: amount.toFixed(8), hash, at };
}

// The parent record of a transaction id. A transfer can carry child records (nonce > 0); the payment
// is the user's own transaction, nonce 0, not scheduled.
async function fetchTx(txid) {
  const r = await fetch(MIRROR + '/transactions/' + txid, { cf: { cacheTtlByStatus: { '200-299': 30, '300-399': 0, '400-599': 0 } } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('mirror ' + r.status);
  const j = await r.json();
  return ((j && j.transactions) || []).filter((t) => !t.nonce && !t.scheduled)[0] || null;
}

export async function onRequestGet({ request }) {
  const usd = await hbarUsd(request);
  if (!usd) return json({ ok: false, error: 'price unavailable' }, 503);
  return json({
    ok: true,
    priceUsd: PRICE_USD,
    hbarUsd: usd,
    collector: COLLECTOR,
    memo: MEMO,
    options: [{ asset: 'native', code: 'HBAR', amount: hbar(PRICE_USD / usd) }],
    quotedAt: Date.now(),
    validForSeconds: QUOTE_VALID_S,
  }, 200, QUOTE_TTL);
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
    },
  });
}

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch (e) { return json({ ok: false, error: 'bad request' }, 400); }
  if (!b || typeof b !== 'object') return json({ ok: false, error: 'bad request' }, 400);

  const token = String(b.issuer || b.token || '').trim();
  const descr = clip(b.descr, LIMITS.descr).trim();
  const logoData = String(b.logo || '');
  const txid = mirrorTxId(b.txId || b.txHash);
  const website = safeSite(b.website, LIMITS.website);
  const twitter = clip(b.twitter, LIMITS.handle).trim();
  const telegram = clip(b.telegram, LIMITS.handle).trim();
  const discord = safeSite(b.discord, LIMITS.discord);

  if (String(b.network || '').toLowerCase() !== 'hedera') return json({ ok: false, error: 'this endpoint takes Hedera requests' }, 400);
  if (!TOKEN_RE.test(token)) return json({ ok: false, error: 'enter a Hedera token id (0.0.x)' }, 400);
  if (!descr) return json({ ok: false, error: 'add a description' }, 400);
  if (!txid) return json({ ok: false, error: 'missing payment' }, 400);

  const db = env && env.ADMIN_DB;
  if (!db) return json({ ok: false, error: 'submissions are unavailable right now' }, 503);

  let t;
  try { t = await fetchTx(txid); } catch (e) { return json({ ok: false, error: 'could not reach the Hedera mirror node; try again shortly' }, 503); }
  if (!t) return json({ ok: false, error: 'transaction not found yet — if you just paid, try again in a few seconds' }, 400);

  // One payment, one request. By hash, BEFORE the amount check, so a replay costs nothing.
  const hashHex = b64hex(t.transaction_hash);
  if (/^[0-9a-f]{96}$/.test(hashHex)) {
    try {
      const dup = await db.prepare('SELECT id, status FROM listing_request WHERE tx_hash = ?1').bind(hashHex).first();
      if (dup) return json({ ok: true, id: dup.id, status: dup.status, already: true }, 200);
    } catch (e) { /* fall through to the full check */ }
  }

  const usd = await hbarUsd(request);
  const want = usd ? PRICE_USD / usd : 0;
  if (!want) return json({ ok: false, error: 'could not price the listing; try again shortly' }, 503);
  const pay = checkPayment(t, want, Date.now());
  if (pay.err) return json({ ok: false, error: pay.err }, 400);

  // The token must exist, be fungible, and not be deleted. Its symbol is taken from the CHAIN, not
  // the form: on Hedera the symbol is a label anyone can choose, and the id is what was applied for.
  let code = '';
  try {
    const r = await fetch(MIRROR + '/tokens/' + token, { cf: { cacheTtlByStatus: { '200-299': 60, '300-399': 0, '400-599': 0 } } });
    if (r.status === 404) return json({ ok: false, error: 'there is no token ' + token + ' on Hedera mainnet' }, 400);
    if (r.ok) {
      const k = await r.json();
      if (k.type !== 'FUNGIBLE_COMMON') return json({ ok: false, error: token + ' is an NFT collection, not a fungible token' }, 400);
      if (k.deleted) return json({ ok: false, error: token + ' has been deleted' }, 400);
      code = clip(String(k.symbol || '').trim(), 32);
    }
  } catch (e) { /* a mirror wobble should not block a paid submission */ }
  if (!code) code = clip(String(b.code || '').trim(), 32) || token;

  let logoId = null;
  if (logoData) {
    const st = await storeLogo(env, logoData);
    if (st.err) return json({ ok: false, error: st.err }, 400);
    logoId = st.id;
  }

  const id = 'lr_' + pay.hash.slice(0, 16);
  try {
    await db.prepare(
      'INSERT INTO listing_request (id, network, code, issuer, descr, logo_id, payer, pay_asset, '
      + 'pay_amount, tx_hash, status, created_at, website, twitter, telegram, discord) '
      + "VALUES (?1,'hedera',?2,?3,?4,?5,?6,'native',?7,?8,'pending',?9,?10,?11,?12,?13)"
    ).bind(id, code, token, descr, logoId || null, pay.payer, pay.amount, pay.hash, Date.now(),
      website || null, twitter || null, telegram || null, discord || null).run();
  } catch (e) {
    return json({ ok: true, id, status: 'pending', already: true }, 200);
  }
  return json({ ok: true, id, status: 'pending', code, txId: txid }, 200);
}
