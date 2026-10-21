// The review side of a curated-listing application: read the queue, decide, record the refund.
//
// functions/ is shared with the PUBLIC projects, where nothing sits behind Access, so EVERY handler
// here calls requireAdmin() first -- see the same note in blog.js. A missing check would put the
// listing queue, and the payer addresses in it, on lumoscore.com.
//
// The division of labour with the panel is deliberate:
//   * APPROVING an asset is done by the existing PUT /lxapi/assetmeta, which already knows how to add
//     to the curated list, stamp the tick and store the description and logo. This endpoint does not
//     reimplement any of that -- it REFUSES to mark a request approved until it can see the asset on
//     the curated list itself. A half-finished approval therefore stays visibly pending rather than
//     reading as done while the asset is nowhere.
//   * REFUNDING is a payment from whichever wallet the admin has connected, so the signing happens in
//     the browser. What lands here is the resulting hash, and it is CHECKED against Horizon before the
//     row is marked refunded: right payee, right asset, at least the amount taken. A refund we did not
//     actually make must never be able to close a request.
//
// HEDERA ROWS (network = 'hedera', written by hederalisting.js) take the same three decisions with the
// ledger-specific parts swapped, and the Stellar paths are untouched:
//   * the asset is the TOKEN ID (issuer column); curated means it is in Hedera's curated list, which is
//     baked into the Hedera build -- read here from /lxapi/hederamarket on the same origin. So approving
//     is: vouch the id in C:\LumosCore-HEDERA\_tools\_hederacurate.js, rebuild, deploy, THEN approve.
//     The same guarantee as Stellar's: never an approval this endpoint cannot see.
//   * the refund is checked on the Hedera Mirror Node: an HBAR credit to the payer of at least what was
//     taken. The panel cannot sign HBAR, so a Hedera refund is sent from HashPack/Kabila and recorded
//     here by its transaction id.
//   * tx_hash / refund_hash hold the 96-hex transaction hash; GET resolves each to its transaction id
//     (what HashScan links by) through the Mirror Node.
import { requireAdmin } from '../../_lib/adminauth.js';
import { audit } from '../../_lib/audit.js';
import { mirrorTxId, b64hex } from './hederalisting.js';

const H = 'https://horizon.stellar.org';
const LIST = 'assets:list';
const HASH_RE = /^[0-9a-f]{64}$/i;
const MIRROR = 'https://mainnet-public.mirrornode.hedera.com/api/v1';
const HHASH_RE = /^[0-9a-f]{96}$/i;
const MCF = { cf: { cacheTtlByStatus: { '200-299': 300, '300-399': 0, '400-599': 0 } } };

// The Hedera curated set, as the Hedera build serves it. null when it cannot be read -- which is not
// the same as "not curated", so approval says which (never-cache-a-failure-as-an-answer).
async function hederaCurated(request) {
  try {
    const r = await fetch(new URL(request.url).origin + '/lxapi/hederamarket', MCF);
    if (!r.ok) return null;
    const d = await r.json();
    if (!d || !d.ok || !Array.isArray(d.rows)) return null;
    return new Set(d.rows.map((x) => x.i));
  } catch (e) { return null; }
}
// 96-hex hash or a transaction id -> the parent Mirror record, or null.
async function hederaTx(ref) {
  const key = HHASH_RE.test(ref) ? ref.toLowerCase() : mirrorTxId(ref);
  if (!key) return null;
  const r = await fetch(MIRROR + '/transactions/' + key, MCF);
  if (!r.ok) return null;
  const j = await r.json();
  return ((j && j.transactions) || []).filter((t) => !t.nonce && !t.scheduled)[0] || null;
}
function hashscanId(t) {
  return t ? String(t.transaction_id || '').replace(/^(\d+\.\d+\.\d+)-(\d+)-(\d+)$/, '$1@$2.$3') : '';
}
const ID_RE = /^lr_[0-9a-f]{16}$/;
const LIMITS = { note: 300 };

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
function clip(s, n) { s = String(s == null ? '' : s).trim(); return s.length > n ? s.slice(0, n) : s; }

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

export async function onRequestGet({ request, env }) {
  const bad = await requireAdmin(request);
  if (bad) return bad;
  const db = env && env.ADMIN_DB;
  if (!db) return json({ ok: false, error: 'no database binding' }, 500);

  let rows = [];
  try {
    const r = await db.prepare(
      'SELECT id, network, code, issuer, descr, logo_id, payer, pay_asset, pay_amount, tx_hash, '
      + 'status, created_at, decided_at, refund_hash, note, website, twitter, telegram, discord '
      + 'FROM listing_request ORDER BY created_at DESC LIMIT 500'
    ).all();
    rows = (r && r.results) || [];
  } catch (e) {
    return json({ ok: false, error: 'could not read the queue' }, 500);
  }

  // Which of these are already curated, so the panel can show an approval that was completed
  // elsewhere rather than offering to do it twice.
  let curated = [];
  try { curated = (await env.CONTENT_KV.get(LIST, 'json')) || []; } catch (e) { curated = []; }
  const on = new Set(curated);

  // Hedera rows: the curated set from the Hedera build, and each stored hash back to its transaction id.
  const hed = rows.filter((r) => r.network === 'hedera');
  const hOn = hed.length ? await hederaCurated(request) : null;
  const txIds = {};
  if (hed.length) {
    const refs = [];
    hed.forEach((r) => { if (r.tx_hash) refs.push(r.tx_hash); if (r.refund_hash) refs.push(r.refund_hash); });
    await Promise.all(refs.slice(0, 200).map((h) => hederaTx(h).then((t) => { txIds[h] = hashscanId(t); }, () => {})));
  }

  return json({
    ok: true,
    requests: rows.map((r) => ({
      id: r.id,
      network: r.network,
      code: r.code,
      issuer: r.issuer,
      asset: r.network === 'hedera' ? r.issuer : r.code + '-' + r.issuer,
      descr: r.descr || '',
      // The panel renders this straight into an <img src>. /lxapi/media is public and serves only what
      // was stored under a media: key, which is why the logo can be shown without a second auth hop.
      logo: r.logo_id ? '/lxapi/media?id=' + encodeURIComponent(r.logo_id) : '',
      payer: r.payer,
      payAsset: r.pay_asset,
      payAmount: r.pay_amount,
      txHash: r.tx_hash,
      status: r.status,
      createdAt: r.created_at,
      decidedAt: r.decided_at,
      refundHash: r.refund_hash || '',
      note: r.note || '',
      // What review actually needs: somewhere to go and check the project is real. Already
      // scheme-checked on the way in by listing.js, since these end up in an href here and, after
      // approval, on a public asset page.
      website: r.website || '',
      twitter: r.twitter || '',
      telegram: r.telegram || '',
      discord: r.discord || '',
      curated: r.network === 'hedera' ? !!(hOn && hOn.has(r.issuer)) : on.has(r.code + '-' + r.issuer),
      // Hedera only: transaction ids for HashScan links ('' when the Mirror Node did not answer).
      txId: r.network === 'hedera' ? (txIds[r.tx_hash] || '') : undefined,
      refundTxId: r.network === 'hedera' && r.refund_hash ? (txIds[r.refund_hash] || '') : undefined,
    })),
  }, 200);
}

// Did we actually send this refund? Same shape of check as the inbound payment on the public endpoint,
// pointed the other way.
async function verifyRefund(hash, payer, amount) {
  const t = await fetch(H + '/transactions/' + hash, { cf: { cacheTtlByStatus: { '200-299': 30, '300-399': 0, '400-599': 0 } } });
  if (!t.ok) return { err: 'that refund transaction is not on the ledger' };
  const tx = await t.json();
  if (!tx.successful) return { err: 'that refund transaction did not succeed' };

  const o = await fetch(H + '/transactions/' + hash + '/operations?limit=50', { cf: { cacheTtlByStatus: { '200-299': 30, '300-399': 0, '400-599': 0 } } });
  if (!o.ok) return { err: 'could not read that transaction' };
  const ops = ((await o.json())._embedded || {}).records || [];

  for (const op of ops) {
    if (op.type !== 'payment' || op.to !== payer) continue;
    if (op.asset_type !== 'native') continue;
    // A stroop of rounding either way is not a short refund; a materially smaller one is.
    if (+op.amount + 1e-7 < +amount) {
      return { err: 'that refund is ' + op.amount + ' XLM, short of the ' + amount + ' XLM taken' };
    }
    return { amount: String(op.amount), at: tx.created_at };
  }
  return { err: 'that transaction contains no XLM payment to the payer' };
}

export async function onRequestPost({ request, env }) {
  const bad = await requireAdmin(request);
  if (bad) return bad;
  const db = env && env.ADMIN_DB;
  if (!db) return json({ ok: false, error: 'no database binding' }, 500);

  let b;
  try { b = await request.json(); } catch (e) { return json({ ok: false, error: 'bad request' }, 400); }

  const id = String((b && b.id) || '').trim();
  const action = String((b && b.action) || '').trim().toLowerCase();
  const note = clip(b && b.note, LIMITS.note);
  if (!ID_RE.test(id)) return json({ ok: false, error: 'unknown request' }, 400);

  let row;
  try {
    row = await db.prepare('SELECT * FROM listing_request WHERE id = ?1').bind(id).first();
  } catch (e) { return json({ ok: false, error: 'could not read that request' }, 500); }
  if (!row) return json({ ok: false, error: 'unknown request' }, 404);

  // ---- approve: Hedera -----------------------------------------------------------------------------
  if (action === 'approve' && row.network === 'hedera') {
    const set = await hederaCurated(request);
    if (!set) return json({ ok: false, error: 'could not read the Hedera curated list just now — nothing was changed; try again' }, 503);
    if (!set.has(row.issuer)) {
      return json({
        ok: false,
        error: row.issuer + ' is not on the Hedera curated list yet. Vouch it in C:\\LumosCore-HEDERA\\_tools\\_hederacurate.js, '
          + 'run npm run curate and the rebuild, deploy, then approve — the request stays pending until it is there',
      }, 409);
    }
    try {
      await db.prepare(
        "UPDATE listing_request SET status='approved', decided_at=?2, note=?3 WHERE id=?1"
      ).bind(id, Date.now(), note || row.note || null).run();
    } catch (e) { return json({ ok: false, error: 'could not save that decision' }, 500); }
    await audit(env, request, 'listing.approve', id, { asset: row.issuer, network: 'hedera', note: note || undefined });
    return json({ ok: true, id, status: 'approved' }, 200);
  }

  // ---- approve -------------------------------------------------------------------------------------
  if (action === 'approve') {
    const asset = row.code + '-' + row.issuer;
    let curated = [];
    try { curated = (await env.CONTENT_KV.get(LIST, 'json')) || []; } catch (e) { curated = []; }
    // The guarantee: this endpoint never claims an approval it cannot see. Curation itself is done by
    // PUT /lxapi/assetmeta, which owns the list, the tick and the metadata.
    if (curated.indexOf(asset) < 0) {
      return json({
        ok: false,
        error: 'add ' + asset + ' to the curated list first — the request stays pending until it is there',
      }, 409);
    }
    try {
      await db.prepare(
        "UPDATE listing_request SET status='approved', decided_at=?2, note=?3 WHERE id=?1"
      ).bind(id, Date.now(), note || row.note || null).run();
    } catch (e) { return json({ ok: false, error: 'could not save that decision' }, 500); }
    await audit(env, request, 'listing.approve', id, { asset, note: note || undefined });
    return json({ ok: true, id, status: 'approved' }, 200);
  }

  // ---- reject --------------------------------------------------------------------------------------
  // Rejecting does not refund. It records the decision and the reason; the money goes back on the
  // refund action, with a hash to prove it. Keeping them apart is what makes an owed refund visible:
  // a rejected row that is not yet refunded is a debt the panel can list.
  if (action === 'reject') {
    if (!note) return json({ ok: false, error: 'give a reason — the applicant is told it' }, 400);
    try {
      await db.prepare(
        "UPDATE listing_request SET status='rejected', decided_at=?2, note=?3 WHERE id=?1"
      ).bind(id, Date.now(), note).run();
    } catch (e) { return json({ ok: false, error: 'could not save that decision' }, 500); }
    await audit(env, request, 'listing.decline', id, { asset: row.code + '-' + row.issuer, reason: note, owed: row.pay_amount });
    return json({ ok: true, id, status: 'rejected', owed: row.pay_amount, to: row.payer }, 200);
  }

  // ---- refund: Hedera ------------------------------------------------------------------------------
  // Sent from a Hedera wallet, recorded by its transaction id (or hash), checked on the Mirror Node:
  // succeeded, and credited the PAYER with at least the HBAR taken. Stored as its 96-hex hash.
  if (action === 'refund' && row.network === 'hedera') {
    const ref = String((b && (b.refundTxId || b.refundHash)) || '').trim();
    if (!HHASH_RE.test(ref) && !mirrorTxId(ref)) return json({ ok: false, error: 'that is not a Hedera transaction id (0.0.x@seconds.nanos)' }, 400);
    let t;
    try { t = await hederaTx(ref); } catch (e) { return json({ ok: false, error: 'could not reach the Hedera mirror node' }, 503); }
    if (!t) return json({ ok: false, error: 'that refund transaction is not on Hedera (yet — a new one can take a few seconds)' }, 400);
    if (t.result !== 'SUCCESS') return json({ ok: false, error: 'that refund transaction did not succeed (' + t.result + ')' }, 400);
    let tiny = 0;
    for (const x of t.transfers || []) if (x.account === row.payer && +x.amount > 0) tiny += +x.amount;
    if (!tiny) return json({ ok: false, error: 'that transaction contains no HBAR payment to ' + row.payer }, 400);
    // A tinybar of rounding is not a short refund; a materially smaller one is.
    if (tiny + 1 < Math.round(+row.pay_amount * 1e8)) {
      return json({ ok: false, error: 'that refund is ' + (tiny / 1e8).toFixed(8) + ' HBAR, short of the ' + row.pay_amount + ' HBAR taken' }, 400);
    }
    const hash = b64hex(t.transaction_hash);
    if (!HHASH_RE.test(hash)) return json({ ok: false, error: 'could not read that transaction hash' }, 502);
    try {
      await db.prepare(
        "UPDATE listing_request SET status='refunded', refund_hash=?2, decided_at="
        + 'COALESCE(decided_at, ?3) WHERE id=?1'
      ).bind(id, hash, Date.now()).run();
    } catch (e) { return json({ ok: false, error: 'could not record that refund' }, 500); }
    await audit(env, request, 'listing.refund', id, { to: row.payer, amount: (tiny / 1e8).toFixed(8), tx: hashscanId(t), network: 'hedera' });
    return json({ ok: true, id, status: 'refunded', refunded: (tiny / 1e8).toFixed(8) }, 200);
  }

  // ---- refund --------------------------------------------------------------------------------------
  if (action === 'refund') {
    const hash = String((b && b.refundHash) || '').trim().toLowerCase();
    if (!HASH_RE.test(hash)) return json({ ok: false, error: 'that is not a transaction hash' }, 400);
    if (row.pay_asset !== 'native') {
      return json({ ok: false, error: 'this request was not paid in XLM' }, 400);
    }
    const v = await verifyRefund(hash, row.payer, row.pay_amount);
    if (v.err) return json({ ok: false, error: v.err }, 400);
    try {
      await db.prepare(
        "UPDATE listing_request SET status='refunded', refund_hash=?2, decided_at="
        + 'COALESCE(decided_at, ?3) WHERE id=?1'
      ).bind(id, hash, Date.now()).run();
    } catch (e) { return json({ ok: false, error: 'could not record that refund' }, 500); }
    await audit(env, request, 'listing.refund', id, { to: row.payer, amount: v.amount, tx: hash });
    return json({ ok: true, id, status: 'refunded', refunded: v.amount }, 200);
  }

  // ---- reopen --------------------------------------------------------------------------------------
  // A decision made by mistake should be undoable, but never one that moved money: a refunded request
  // stays refunded, because reopening it would invite a second refund of the same payment.
  if (action === 'reopen') {
    if (row.status === 'refunded') {
      return json({ ok: false, error: 'this one has been refunded — it cannot be reopened' }, 409);
    }
    try {
      await db.prepare(
        "UPDATE listing_request SET status='pending', decided_at=NULL WHERE id=?1"
      ).bind(id).run();
    } catch (e) { return json({ ok: false, error: 'could not reopen that request' }, 500); }
    await audit(env, request, 'listing.reopen', id, { from: row.status });
    return json({ ok: true, id, status: 'pending' }, 200);
  }

  return json({ ok: false, error: 'unknown action' }, 400);
}
