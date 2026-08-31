// Curated listing applications from the public "List your token" page.
//
// THE ONLY THING THAT MAKES THIS SAFE IS THAT THE PAYMENT IS VERIFIED ON-CHAIN. This endpoint is
// public and unauthenticated, so every field in the body is a claim by a stranger. The request is
// accepted only if Horizon confirms a transaction that:
//   * exists and succeeded;
//   * contains a payment to OUR fee collector;
//   * in XLM;
//   * of at least the amount that asset was quoted at, checked against a fresh quote;
//   * and has not already been used for another request.
//
// Everything else follows from that. The refund address is taken from the PAYMENT's source account,
// never from the form -- otherwise a rejection could be steered to pay a stranger. tx_hash is the
// primary defence against replays and the table's unique key, so a double submit collapses into one
// row rather than two requests for one payment.
const FEE_ACCT = 'GAMZFXIJD5E3PNRFCG6VPXCJNUOZAP5BY2P3MU3ZXXUSVM2UY5P6LJKD';
const H = 'https://horizon.stellar.org';

const HASH_RE = /^[0-9a-f]{64}$/i;
const CODE_RE = /^[A-Za-z0-9]{1,12}$/;
const ADDR_RE = /^G[A-Z2-7]{55}$/;
const MEDIA_RE = /^[0-9a-f]{32}\.(png|jpg|jpeg|webp|gif)$/i;

const LIMITS = { descr: 600, note: 200, website: 200, handle: 80, discord: 200 };

// Where to go and look. Review is "is this project findable and is it what it claims", which cannot be
// answered from a code and an address, so the application carries them and the panel shows them.
//
// Kept AS TYPED, matching what /lxapi/assetmeta stores: the asset page already turns a bare handle, an
// @handle or a full URL into the right link, and normalising here would be a second implementation of
// that, free to disagree with the first. What IS enforced is the scheme -- see safeSite.
//
// javascript: and data: are the reason this is not just a length check. These strings end up in an
// href on the admin panel and, after approval, on a public asset page.
function safeSite(s, max) {
  const v = clip(s, max);
  if (!v) return '';
  const lc = v.toLowerCase();
  if (lc.indexOf('http://') === 0 || lc.indexOf('https://') === 0) return v;
  // A bare domain is what most people type. Anything else -- a scheme we did not name, or a colon
  // before the first slash -- is refused rather than guessed at.
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/[^\s]*)?$/i.test(v)) return v;
  return '';
}

// The logo arrives INSIDE this paid request rather than through an upload endpoint of its own.
// /lxapi/media requires an admin, and a public upload route would be a free way to fill KV with
// images. Here the $250 payment is the anti-abuse token: no verified payment, no stored bytes.
//
// Kept deliberately smaller than media.js's 4MB. This is an asset logo shown at 52px, not a cover
// image, and a stranger's upload is not the place to be generous.
const LOGO_MAX = 512 * 1024;
// SVG is absent for the same reason media.js omits it: it is a document format that can carry script,
// and serving one from our own origin would run that script there.
const LOGO_TYPES = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif',
};

async function mediaId(buf, ext) {
  const d = await crypto.subtle.digest('SHA-256', buf);
  const b = new Uint8Array(d);
  let s = '';
  for (let i = 0; i < 16; i++) s += b[i].toString(16).padStart(2, '0');
  return s + '.' + ext;
}

// Accepts a data: URI as produced by FileReader in the browser. Returns { id } or { err }.
async function storeLogo(env, dataUri) {
  const kv = env && env.CONTENT_KV;
  if (!kv) return { err: 'image storage unavailable' };
  const m = /^data:([a-z/+.-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(String(dataUri || ''));
  if (!m) return { err: 'the logo must be a base64 image' };
  const ext = LOGO_TYPES[m[1].toLowerCase()];
  if (!ext) return { err: 'logo must be PNG, JPEG, WebP or GIF' };

  let buf;
  try {
    const bin = atob(m[2]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    buf = arr.buffer;
  } catch (e) { return { err: 'the logo could not be read' }; }

  if (!buf.byteLength) return { err: 'the logo is empty' };
  if (buf.byteLength > LOGO_MAX) {
    return { err: 'the logo is ' + Math.round(buf.byteLength / 1024) + 'KB, over the 512KB limit' };
  }

  const id = await mediaId(buf, ext);
  // Same prefix and metadata shape media.js uses, so /lxapi/media?id=... serves it unchanged.
  await kv.put('media:' + id, buf, {
    metadata: { type: m[1].toLowerCase(), size: buf.byteLength, at: Date.now() },
  });
  return { id };
}
// The quote the payer was shown must still be roughly current when their payment lands. Generous
// enough for a wallet approval, tight enough that a day-old quote is not honoured.
const TOLERANCE = 0.97;

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}
function clip(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) : s; }

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
    },
  });
}

// How old a payment may be and still buy a listing.
//
// WHY THIS HAS TO EXIST. FEE_ACCT is not a dedicated listing account -- it is the platform fee
// collector, and every swap, mint and cross-chain fee lands in it. Without a window, "a payment to our
// fee collector in XLM of at least the quoted amount" describes not just the payment this applicant
// just made but every qualifying payment in that account's entire public history, made by anybody.
// The unique key on tx_hash means each one is good for only a single listing, but they are all sitting
// on-chain for anyone to read, and claiming one costs the claimant nothing: the payer of record is
// taken from the payment, so a stranger's transaction buys a stranger's listing.
//
// 24 hours rather than minutes. The real flow submits within seconds of paying -- the payment goes
// first, deliberately, so the hash exists before the form is sent -- but a failed submit, a closed tab
// or a retry the next morning are all ordinary, and locking those people out to save a few hours of
// window would be trading a real user's money for very little. A day still reduces the eligible set
// from the whole ledger to payments made in the last day and not yet claimed.
const MAX_PAYMENT_AGE_MS = 24 * 3600 * 1000;
// Small allowance for clock skew between Horizon and the edge; a payment cannot really be in the
// future, and treating a slightly-ahead timestamp as an error would be a false alarm.
const FUTURE_SKEW_MS = 5 * 60 * 1000;

// The payment that pays for this listing, as the CHAIN describes it -- not as the form claims.
async function verifyPayment(hash) {
  const t = await fetch(H + '/transactions/' + hash, { cf: { cacheTtl: 30 } });
  if (!t.ok) return { err: 'transaction not found' };
  const tx = await t.json();
  if (!tx.successful) return { err: 'transaction did not succeed' };

  // Age is checked BEFORE the amount, so someone replaying an old payment is told the real reason
  // rather than being sent off to re-check a figure that was never the problem.
  const at = Date.parse(tx.created_at || '');
  if (!at) return { err: 'could not read the payment date' };
  const age = Date.now() - at;
  if (age > MAX_PAYMENT_AGE_MS) {
    return { err: 'that payment is more than 24 hours old. Listing payments must be made as part of '
      + 'this application — if you paid recently and the form failed, contact support with the hash.' };
  }
  if (age < -FUTURE_SKEW_MS) return { err: 'that payment is dated in the future' };

  const o = await fetch(H + '/transactions/' + hash + '/operations?limit=50', { cf: { cacheTtl: 30 } });
  if (!o.ok) return { err: 'could not read the transaction' };
  const ops = ((await o.json())._embedded || {}).records || [];

  for (const op of ops) {
    if (op.type !== 'payment' || op.to !== FEE_ACCT) continue;
    // XLM only. A payment in anything else is not a listing fee, even if its value happens to match.
    if (op.asset_type !== 'native') continue;
    return {
      payer: op.from,
      asset: 'native',
      code: 'XLM',
      amount: String(op.amount),
      at: tx.created_at,
    };
  }
  return { err: 'no XLM payment to the listing account in that transaction' };
}

// Re-quote server-side. The number the browser displayed is a claim like any other.
async function quoted(request, code) {
  try {
    const origin = new URL(request.url).origin;
    const r = await fetch(origin + '/lxapi/listingquote', { cf: { cacheTtl: 30 } });
    if (!r.ok) return 0;
    const d = await r.json();
    const opt = ((d && d.options) || []).filter((x) => x.code === code)[0];
    return opt && opt.amount ? +opt.amount : 0;
  } catch (e) { return 0; }
}

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch (e) { return json({ ok: false, error: 'bad request' }, 400); }
  if (!b || typeof b !== 'object') return json({ ok: false, error: 'bad request' }, 400);

  const network = String(b.network || '').toLowerCase();
  const code = String(b.code || '').trim();
  const issuer = String(b.issuer || '').trim().toUpperCase();
  const descr = clip(b.descr, LIMITS.descr).trim();
  const logoData = String(b.logo || '');
  const hash = String(b.txHash || '').trim().toLowerCase();
  const website = safeSite(b.website, LIMITS.website);
  const twitter = clip(b.twitter, LIMITS.handle);
  const telegram = clip(b.telegram, LIMITS.handle);
  const discord = safeSite(b.discord, LIMITS.discord);

  if (network !== 'stellar') return json({ ok: false, error: 'only Stellar is supported today' }, 400);
  if (!CODE_RE.test(code)) return json({ ok: false, error: 'enter a valid asset code' }, 400);
  if (!ADDR_RE.test(issuer)) return json({ ok: false, error: 'enter a valid issuer address' }, 400);
  if (!descr) return json({ ok: false, error: 'add a description' }, 400);

  if (!HASH_RE.test(hash)) return json({ ok: false, error: 'missing payment' }, 400);

  // Checked here, not at the top: a bad request deserves to hear what is wrong with it rather
  // than a 503 implying the fault is ours.
  const db = env && env.ADMIN_DB;
  if (!db) return json({ ok: false, error: 'submissions are unavailable right now' }, 503);

  // One payment, one request. Checked before touching the chain so a replay costs nothing.
  try {
    const dup = await db.prepare('SELECT id, status FROM listing_request WHERE tx_hash = ?1')
      .bind(hash).first();
    if (dup) return json({ ok: true, id: dup.id, status: dup.status, already: true }, 200);
  } catch (e) { /* fall through to the full check */ }

  const pay = await verifyPayment(hash);
  if (pay.err) return json({ ok: false, error: pay.err }, 400);

  const want = await quoted(request, pay.code);
  if (!want) return json({ ok: false, error: 'could not price the listing; try again shortly' }, 503);
  if (+pay.amount < want * TOLERANCE) {
    return json({
      ok: false,
      error: 'the payment is short: ' + pay.amount + ' ' + pay.code
        + ' received, about ' + want.toFixed(7) + ' ' + pay.code + ' required',
    }, 400);
  }

  // The asset must actually exist before we queue a listing for it.
  try {
    const a = await fetch(H + '/assets?asset_code=' + encodeURIComponent(code)
      + '&asset_issuer=' + encodeURIComponent(issuer) + '&limit=1', { cf: { cacheTtl: 60 } });
    const rec = a.ok ? (((await a.json())._embedded || {}).records || [])[0] : null;
    if (!rec) return json({ ok: false, error: 'that asset does not exist on Stellar mainnet' }, 400);
  } catch (e) { /* Horizon wobble should not block a paid submission */ }

  // Stored only now: the payment has verified, so this cannot be used as free image hosting.
  let logoId = null;
  if (logoData) {
    const st = await storeLogo(env, logoData);
    if (st.err) return json({ ok: false, error: st.err }, 400);
    logoId = st.id;
  }

  const id = 'lr_' + hash.slice(0, 16);
  try {
    await db.prepare(
      'INSERT INTO listing_request (id, network, code, issuer, descr, logo_id, payer, pay_asset, '
      + 'pay_amount, tx_hash, status, created_at, website, twitter, telegram, discord) '
      + "VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,'pending',?11,?12,?13,?14,?15)"
    ).bind(id, network, code, issuer, descr, logoId || null, pay.payer, pay.asset,
      pay.amount, hash, Date.now(),
      website || null, twitter || null, telegram || null, discord || null).run();
  } catch (e) {
    // UNIQUE on tx_hash: a race between two submits of the same payment lands here, not in a
    // duplicate row.
    return json({ ok: true, id, status: 'pending', already: true }, 200);
  }

  return json({ ok: true, id, status: 'pending' }, 200);
}
