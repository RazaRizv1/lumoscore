// Curated listing applications for NEAR tokens: the quote (GET) and the paid request (POST).
//
// hederalisting.js's twin for NEAR (RAZA 2026-11-17: listings are paid "in their own coin"), on the same
// rule: THE ONLY THING THAT MAKES THIS SAFE IS THAT THE PAYMENT IS VERIFIED ON-CHAIN. A request is
// accepted only if the transaction the browser names (hash + the account that signed it, which is how
// NEAR RPC finds a transaction):
//   * reached a final, successful outcome;
//   * was signed by that account and sent to OUR collector (receiver_id), as a native Transfer of NEAR;
//   * is under 24 hours old (block timestamp) and transfers at least 97% of a fresh quote;
//   * and has not already been used for another request (tx_hash is the table's unique key).
// A native Transfer carries no memo on NEAR. The collector's swap fees arrive as ft_transfer of wNEAR
// (a FunctionCall), never as a plain Transfer, so "a direct Transfer from the signer, in the window,
// never used before" is what identifies a listing payment here.
// The refund account is the transaction's signer, never anything in the form.
//
// Same listing_request table, network = 'near': code = the token's symbol (from ft_metadata, else as
// typed), issuer = the token CONTRACT (that is the identity on NEAR), tx_hash = the base58 hash.
import { storeLogo } from './listing.js';
import { isTestWallet, TEST_PRICE } from '../../_lib/testwallets.js';

const COLLECTOR = 'fees-lumoscore.near';          // the NEAR platform fee account (RAZA)
const RPC = ['https://free.rpc.fastnear.com', 'https://near.drpc.org'];
const PRICE_USD = 250;
const QUOTE_TTL = 60;
const QUOTE_VALID_S = 900;
const PRICE_MAX_AGE_MS = 15 * 60 * 1000;
const TOLERANCE = 0.97;
const MAX_PAYMENT_AGE_MS = 24 * 3600 * 1000;
const FUTURE_SKEW_MS = 5 * 60 * 1000;
const YOCTO = 1e24;

const HASH_RE = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;
// Named (alice.near, token.v2.ref-finance.near) or implicit (64 hex) accounts.
const ACCT_RE = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$|^[0-9a-f]{64}$/;
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
function near(n) { return (Math.ceil(n * 1e5) / 1e5).toFixed(5); }
function validAcct(a) { return typeof a === 'string' && a.length >= 2 && a.length <= 64 && ACCT_RE.test(a); }

async function rpc(method, params) {
  let last = null;
  for (const url of RPC) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 'lx', method, params }),
      });
      if (!r.ok) { last = new Error('rpc ' + r.status); continue; }
      const j = await r.json();
      if (j && j.result) return j.result;
      if (j && j.error) return { error: j.error };
      last = new Error('rpc empty');
    } catch (e) { last = e; }
  }
  throw last || new Error('rpc unreachable');
}

async function nearUsd(request) {
  try {
    const r = await fetch(new URL(request.url).origin + '/lxapi/nearmarket', { cf: { cacheTtlByStatus: { '200-299': 30, '300-399': 0, '400-599': 0 } } });
    if (!r.ok) return 0;
    const d = await r.json();
    if (!d || !d.ok || !(+d.usd > 0)) return 0;
    if (+d.at > 0 && Date.now() - +d.at > PRICE_MAX_AGE_MS) return 0;
    return +d.usd;
  } catch (e) { return 0; }
}

// Pure check of an RPC `tx` result plus its block time (ms). Exported for tests.
export function checkPayment(t, signer, blockMs, want, now) {
  if (!t || t.error) return { err: 'transaction not found' };
  const tx = t.transaction || {};
  const st = t.status || {};
  if (!('SuccessValue' in st)) return { err: 'that transaction did not succeed' };
  if (tx.signer_id !== signer) return { err: 'that transaction was not signed by ' + signer };
  if (tx.receiver_id !== COLLECTOR) return { err: 'that payment did not go to the LumosCore listing account' };
  for (const ro of t.receipts_outcome || []) {
    if (ro && ro.outcome && ro.outcome.status && 'Failure' in ro.outcome.status) return { err: 'part of that transaction failed' };
  }
  let yocto = 0;
  for (const a of tx.actions || []) {
    if (a && a.Transfer && a.Transfer.deposit) yocto += Number(a.Transfer.deposit);
  }
  if (!yocto) return { err: 'that transaction has no NEAR transfer to the listing account' };
  if (!blockMs) return { err: 'could not read the payment date' };
  const age = now - blockMs;
  if (age > MAX_PAYMENT_AGE_MS) {
    return { err: 'that payment is more than 24 hours old. Listing payments must be made as part of '
      + 'this application — if you paid recently and the form failed, contact support with the hash.' };
  }
  if (age < -FUTURE_SKEW_MS) return { err: 'that payment is dated in the future' };
  const amount = yocto / YOCTO;
  if (want && amount < want * TOLERANCE) {
    return { err: 'the payment is short: ' + amount.toFixed(5) + ' NEAR received, about ' + want.toFixed(5) + ' NEAR required' };
  }
  return { payer: signer, amount: amount.toFixed(5), at: blockMs };
}

async function hexId(s) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  let h = '';
  for (let i = 0; i < 8; i++) h += d[i].toString(16).padStart(2, '0');
  return h;
}

export async function onRequestGet({ request, env }) {
  // TEST WALLETS (RAZA 2026-11-23): asked with ?a=<connected wallet>, an approved test wallet is quoted the minimum,
  // 0.5 NEAR. Never cached (the answer is per address). The POST re-checks the PAYING address itself.
  const qa = new URL(request.url).searchParams.get('a');
  if (qa && await isTestWallet(env, 'near', qa)) {
    return json({ ok: true, test: true, priceUsd: null, collector: COLLECTOR,
      options: [{ asset: 'native', code: 'NEAR', amount: String(TEST_PRICE) }], quotedAt: Date.now(), validForSeconds: QUOTE_VALID_S }, 200, 0);
  }
  const usd = await nearUsd(request);
  if (!usd) return json({ ok: false, error: 'price unavailable' }, 503);
  return json({
    ok: true,
    priceUsd: PRICE_USD,
    nearUsd: usd,
    collector: COLLECTOR,
    options: [{ asset: 'native', code: 'NEAR', amount: near(PRICE_USD / usd) }],
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

  const contract = String(b.issuer || b.contract || '').trim().toLowerCase();
  const descr = clip(b.descr, LIMITS.descr).trim();
  const logoData = String(b.logo || '');
  const hash = String(b.txHash || '').trim();
  const signer = String(b.payer || b.signer || '').trim().toLowerCase();
  const website = safeSite(b.website, LIMITS.website);
  const twitter = clip(b.twitter, LIMITS.handle).trim();
  const telegram = clip(b.telegram, LIMITS.handle).trim();
  const discord = safeSite(b.discord, LIMITS.discord);

  if (String(b.network || '').toLowerCase() !== 'near') return json({ ok: false, error: 'this endpoint takes NEAR requests' }, 400);
  if (!validAcct(contract)) return json({ ok: false, error: 'enter the token contract (for example token.near)' }, 400);
  if (!descr) return json({ ok: false, error: 'add a description' }, 400);
  if (!HASH_RE.test(hash) || !validAcct(signer)) return json({ ok: false, error: 'missing payment' }, 400);

  const db = env && env.ADMIN_DB;
  if (!db) return json({ ok: false, error: 'submissions are unavailable right now' }, 503);

  try {
    const dup = await db.prepare('SELECT id, status FROM listing_request WHERE tx_hash = ?1').bind(hash).first();
    if (dup) return json({ ok: true, id: dup.id, status: dup.status, already: true }, 200);
  } catch (e) { /* fall through to the full check */ }

  let t, blockMs = 0;
  try {
    t = await rpc('tx', { tx_hash: hash, sender_account_id: signer, wait_until: 'FINAL' });
    if (t && !t.error && t.transaction_outcome && t.transaction_outcome.block_hash) {
      const blk = await rpc('block', { block_id: t.transaction_outcome.block_hash });
      blockMs = blk && blk.header ? Math.floor(Number(blk.header.timestamp) / 1e6) : 0;
    }
  } catch (e) { return json({ ok: false, error: 'could not reach NEAR; try again shortly' }, 503); }
  if (!t || t.error) return json({ ok: false, error: 'transaction not found yet — if you just paid, try again in a few seconds' }, 400);

  // An approved test wallet (_lib/testwallets.js) pays the minimum, 0.5 NEAR -- decided from the signer, which
  // checkPayment confirms signed the transaction.
  const testW = await isTestWallet(env, 'near', signer);
  const usd = testW ? 0 : await nearUsd(request);
  const want = testW ? TEST_PRICE : (usd ? PRICE_USD / usd : 0);
  if (!want) return json({ ok: false, error: 'could not price the listing; try again shortly' }, 503);
  const pay = checkPayment(t, signer, blockMs, want, Date.now());
  if (pay.err) return json({ ok: false, error: pay.err }, 400);

  // The token must be a fungible-token contract: ft_metadata answers. An RPC wobble does not block a
  // paid submission; a contract that does not exist or is not a token does.
  let code = '';
  try {
    const m = await rpc('query', { request_type: 'call_function', finality: 'final', account_id: contract, method_name: 'ft_metadata', args_base64: 'e30=' });
    if (m && m.error) {
      const msg = JSON.stringify(m.error);
      if (/UNKNOWN_ACCOUNT|does not exist/i.test(msg)) return json({ ok: false, error: 'there is no account ' + contract + ' on NEAR' }, 400);
      if (/MethodNotFound|CodeDoesNotExist|wasm/i.test(msg)) return json({ ok: false, error: contract + ' is not a fungible token contract' }, 400);
    } else if (m && Array.isArray(m.result)) {
      const meta = JSON.parse(new TextDecoder().decode(new Uint8Array(m.result)));
      code = clip(String((meta && meta.symbol) || '').trim(), 32);
    }
  } catch (e) { /* see above */ }
  if (!code) code = clip(String(b.code || '').trim(), 32) || contract;

  let logoId = null;
  if (logoData) {
    const st = await storeLogo(env, logoData);
    if (st.err) return json({ ok: false, error: st.err }, 400);
    logoId = st.id;
  }

  const id = 'lr_' + await hexId(hash);
  try {
    await db.prepare(
      'INSERT INTO listing_request (id, network, code, issuer, descr, logo_id, payer, pay_asset, '
      + 'pay_amount, tx_hash, status, created_at, website, twitter, telegram, discord) '
      + "VALUES (?1,'near',?2,?3,?4,?5,?6,'native',?7,?8,'pending',?9,?10,?11,?12,?13)"
    ).bind(id, code, contract, descr, logoId || null, pay.payer, pay.amount, hash, Date.now(),
      website || null, twitter || null, telegram || null, discord || null).run();
  } catch (e) {
    return json({ ok: true, id, status: 'pending', already: true }, 200);
  }
  return json({ ok: true, id, status: 'pending', code, txHash: hash }, 200);
}
