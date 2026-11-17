// Curated listing applications for XRP LEDGER tokens: the quote (GET) and the paid request (POST).
//
// hederalisting.js's twin for the XRP Ledger (RAZA 2026-11-17: XRPL and NEAR listings are paid "in
// their own coin"), built on the same rule: THE ONLY THING THAT MAKES THIS SAFE IS THAT THE PAYMENT IS
// VERIFIED ON-CHAIN. The body is a stranger's claim; a rippled `tx` lookup is the record. A request is
// accepted only if the transaction the browser names:
//   * is in a VALIDATED ledger with tesSUCCESS;
//   * is a Payment to OUR collector, in XRP, judged by meta.delivered_amount -- never by Amount, which a
//     partial payment can state while delivering a fraction of it;
//   * carries the memo "LumosCore listing" -- the collector also receives every swap fee, and the memo is
//     what separates a listing payment from those, on top of the window;
//   * is under 24 hours old and delivers at least 97% of a fresh quote;
//   * and has not already been used for another request (tx_hash is the table's unique key).
// The refund account is the transaction's Account, never anything in the form.
//
// Writes into the same listing_request table as listing.js / hederalisting.js with network = 'xrpl',
// so the admin queue is one queue. code = the currency as typed (LUMOS), issuer = the r-address,
// tx_hash = the 64-hex hash, lower-cased like Stellar's.
import { storeLogo } from './listing.js';

// The XRPL platform fee account (RAZA 2026-09-06), checksum-gated in C:\LumosCore-XRPL\_tools\xrpladdr.js.
const COLLECTOR = 'rBDV4nwHzg5ByAYJtPWrbBZnuUXSUtFr94';
const RPC = ['https://s1.ripple.com:51234/', 'https://s2.ripple.com:51234/', 'https://xrplcluster.com/'];
const MEMO = 'LumosCore listing';
const PRICE_USD = 250;
const QUOTE_TTL = 60;
const QUOTE_VALID_S = 900;
const TOLERANCE = 0.97;
const MAX_PAYMENT_AGE_MS = 24 * 3600 * 1000;
const FUTURE_SKEW_MS = 5 * 60 * 1000;
const RIPPLE_EPOCH = 946684800;

const HASH_RE = /^[0-9A-F]{64}$/i;
const ADDR_RE = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
// A currency as people type it: 3 chars (standard code) or up to 20 (stored on the ledger as 40 hex).
const CODE_RE = /^[A-Za-z0-9?!@#$%^&*<>(){}[\]|]{3,20}$/;
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
function safeSite(s, max) {
  const v = clip(s, max).trim();
  if (!v) return '';
  const lc = v.toLowerCase();
  if (lc.indexOf('http://') === 0 || lc.indexOf('https://') === 0) return v;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/[^\s]*)?$/i.test(v)) return v;
  return '';
}
function xrp(n) { return (Math.ceil(n * 1e6) / 1e6).toFixed(6); }
function hexOf(s) { let h = ''; for (let i = 0; i < s.length; i++) h += s.charCodeAt(i).toString(16).padStart(2, '0'); return h.toUpperCase(); }
function textOf(hex) {
  try { let s = ''; for (let i = 0; i + 1 < hex.length; i += 2) s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16)); return s; }
  catch (e) { return ''; }
}
// The ledger spelling of a typed code: 3 chars stay as they are, anything longer is 40-hex, zero padded.
export function ledgerCurrency(code) {
  const c = String(code || '').trim();
  if (c.length === 3) return c;
  return (hexOf(c) + '0'.repeat(40)).slice(0, 40);
}

async function rpc(method, params) {
  let last = null;
  for (const url of RPC) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ method, params: [params] }),
      });
      if (!r.ok) { last = new Error('rpc ' + r.status); continue; }
      const j = await r.json();
      if (j && j.result) return j.result;
      last = new Error('rpc empty');
    } catch (e) { last = e; }
  }
  throw last || new Error('rpc unreachable');
}

async function xrpUsd(request) {
  try {
    const r = await fetch(new URL(request.url).origin + '/lxapi/xrplprices', { cf: { cacheTtlByStatus: { '200-299': 30, '300-399': 0, '400-599': 0 } } });
    if (!r.ok) return 0;
    const d = await r.json();
    return d && d.ok && +d.usd > 0 ? +d.usd : 0;
  } catch (e) { return 0; }
}

// Pure check of a rippled `tx` result (api_version 1 shape; v2 fields read too). Exported for tests.
export function checkPayment(t, want, now) {
  if (!t || t.error) return { err: 'transaction not found' };
  const tx = t.tx_json || t;
  const meta = t.meta || tx.meta || {};
  if (!t.validated) return { err: 'that payment is not in a validated ledger yet — try again in a few seconds' };
  if (meta.TransactionResult !== 'tesSUCCESS') return { err: 'that transaction did not succeed (' + meta.TransactionResult + ')' };
  if (tx.TransactionType !== 'Payment') return { err: 'that transaction is not a payment' };
  if (tx.Destination !== COLLECTOR) return { err: 'that payment did not go to the LumosCore listing account' };
  const date = +(tx.date != null ? tx.date : t.date);
  if (!date) return { err: 'could not read the payment date' };
  const at = (date + RIPPLE_EPOCH) * 1000;
  const age = now - at;
  if (age > MAX_PAYMENT_AGE_MS) {
    return { err: 'that payment is more than 24 hours old. Listing payments must be made as part of '
      + 'this application — if you paid recently and the form failed, contact support with the hash.' };
  }
  if (age < -FUTURE_SKEW_MS) return { err: 'that payment is dated in the future' };
  const memos = (tx.Memos || []).map((m) => textOf(((m && m.Memo) || {}).MemoData || '').trim());
  if (memos.indexOf(MEMO) < 0) return { err: 'that transaction is not a LumosCore listing payment (memo "' + MEMO + '" missing)' };
  const d = meta.delivered_amount != null ? meta.delivered_amount : meta.DeliveredAmount;
  if (typeof d !== 'string' || !/^\d+$/.test(d)) return { err: 'that payment did not deliver XRP' };
  const amount = +d / 1e6;
  if (want && amount < want * TOLERANCE) {
    return { err: 'the payment is short: ' + amount.toFixed(6) + ' XRP received, about ' + want.toFixed(6) + ' XRP required' };
  }
  if (!ADDR_RE.test(tx.Account || '')) return { err: 'could not read who paid' };
  return { payer: tx.Account, amount: amount.toFixed(6), at };
}

export async function onRequestGet({ request }) {
  const usd = await xrpUsd(request);
  if (!usd) return json({ ok: false, error: 'price unavailable' }, 503);
  return json({
    ok: true,
    priceUsd: PRICE_USD,
    xrpUsd: usd,
    collector: COLLECTOR,
    memo: MEMO,
    options: [{ asset: 'native', code: 'XRP', amount: xrp(PRICE_USD / usd) }],
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

  const code = String(b.code || '').trim();
  const issuer = String(b.issuer || '').trim();
  const descr = clip(b.descr, LIMITS.descr).trim();
  const logoData = String(b.logo || '');
  const hash = String(b.txHash || '').trim().toUpperCase();
  const website = safeSite(b.website, LIMITS.website);
  const twitter = clip(b.twitter, LIMITS.handle).trim();
  const telegram = clip(b.telegram, LIMITS.handle).trim();
  const discord = safeSite(b.discord, LIMITS.discord);

  if (String(b.network || '').toLowerCase() !== 'xrpl') return json({ ok: false, error: 'this endpoint takes XRP Ledger requests' }, 400);
  if (!CODE_RE.test(code) || code.toUpperCase() === 'XRP') return json({ ok: false, error: 'enter a valid currency code' }, 400);
  if (!ADDR_RE.test(issuer)) return json({ ok: false, error: 'enter a valid issuer address (r…)' }, 400);
  if (!descr) return json({ ok: false, error: 'add a description' }, 400);
  if (!HASH_RE.test(hash)) return json({ ok: false, error: 'missing payment' }, 400);

  const db = env && env.ADMIN_DB;
  if (!db) return json({ ok: false, error: 'submissions are unavailable right now' }, 503);

  const key = hash.toLowerCase();
  try {
    const dup = await db.prepare('SELECT id, status FROM listing_request WHERE tx_hash = ?1').bind(key).first();
    if (dup) return json({ ok: true, id: dup.id, status: dup.status, already: true }, 200);
  } catch (e) { /* fall through to the full check */ }

  let t;
  try { t = await rpc('tx', { transaction: hash, binary: false }); }
  catch (e) { return json({ ok: false, error: 'could not reach the XRP Ledger; try again shortly' }, 503); }
  if (!t || t.error) return json({ ok: false, error: 'transaction not found yet — if you just paid, try again in a few seconds' }, 400);

  const usd = await xrpUsd(request);
  const want = usd ? PRICE_USD / usd : 0;
  if (!want) return json({ ok: false, error: 'could not price the listing; try again shortly' }, 503);
  const pay = checkPayment(t, want, Date.now());
  if (pay.err) return json({ ok: false, error: pay.err }, 400);

  // The token must exist: the issuer has obligations in that currency. A ledger wobble does not block a
  // paid submission (same rule as listing.js); a clear "no such issuer / currency" does.
  try {
    const g = await rpc('gateway_balances', { account: issuer, ledger_index: 'validated', strict: true });
    if (g && g.error === 'actNotFound') return json({ ok: false, error: 'there is no account ' + issuer + ' on the XRP Ledger' }, 400);
    if (g && g.obligations && !g.error) {
      const cur = ledgerCurrency(code);
      if (!(cur in g.obligations)) return json({ ok: false, error: issuer + ' has not issued ' + code }, 400);
    }
  } catch (e) { /* see above */ }

  let logoId = null;
  if (logoData) {
    const st = await storeLogo(env, logoData);
    if (st.err) return json({ ok: false, error: st.err }, 400);
    logoId = st.id;
  }

  const id = 'lr_' + key.slice(0, 16);
  try {
    await db.prepare(
      'INSERT INTO listing_request (id, network, code, issuer, descr, logo_id, payer, pay_asset, '
      + 'pay_amount, tx_hash, status, created_at, website, twitter, telegram, discord) '
      + "VALUES (?1,'xrpl',?2,?3,?4,?5,?6,'native',?7,?8,'pending',?9,?10,?11,?12,?13)"
    ).bind(id, code, issuer, descr, logoId || null, pay.payer, pay.amount, key, Date.now(),
      website || null, twitter || null, telegram || null, discord || null).run();
  } catch (e) {
    return json({ ok: true, id, status: 'pending', already: true }, 200);
  }
  return json({ ok: true, id, status: 'pending', code, txHash: key }, 200);
}
