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
import { requireAdmin } from '../../_lib/adminauth.js';

const H = 'https://horizon.stellar.org';
const LIST = 'assets:list';
const HASH_RE = /^[0-9a-f]{64}$/i;
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

  return json({
    ok: true,
    requests: rows.map((r) => ({
      id: r.id,
      network: r.network,
      code: r.code,
      issuer: r.issuer,
      asset: r.code + '-' + r.issuer,
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
      curated: on.has(r.code + '-' + r.issuer),
    })),
  }, 200);
}

// Did we actually send this refund? Same shape of check as the inbound payment on the public endpoint,
// pointed the other way.
async function verifyRefund(hash, payer, amount) {
  const t = await fetch(H + '/transactions/' + hash, { cf: { cacheTtl: 30 } });
  if (!t.ok) return { err: 'that refund transaction is not on the ledger' };
  const tx = await t.json();
  if (!tx.successful) return { err: 'that refund transaction did not succeed' };

  const o = await fetch(H + '/transactions/' + hash + '/operations?limit=50', { cf: { cacheTtl: 30 } });
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
    return json({ ok: true, id, status: 'rejected', owed: row.pay_amount, to: row.payer }, 200);
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
    return json({ ok: true, id, status: 'pending' }, 200);
  }

  return json({ ok: false, error: 'unknown action' }, 400);
}
