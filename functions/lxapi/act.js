// Records that a transaction was submitted THROUGH LumosCore, and reads those records back for the
// dashboard's Live Platform Activity feed.
//
// WHY THIS HAS TO EXIST. The feed was assembled from fee payments to the collector, so it could only
// ever contain fee-paying actions: swaps, cross-chain and mints. Pool creation, deposits, withdrawals
// and limit orders are FREE — they pay us nothing and leave no on-chain marker tying them to us (and
// a memo marker was ruled out, since memos do not carry to other chains). So a user creating a pool
// here was indistinguishable from one creating it anywhere else, and the panel simply never saw it.
// Nothing on-chain can fix that. Only the platform knows what the platform did.
//
// WHAT IS STORED: the transaction hash, the submitting address, and a timestamp. Both the hash and the
// address are already public on-chain — the hash reveals strictly more than we keep here — and neither
// is useful for tracking a person around the site. No IP, no user agent, no page, no referrer, and no
// record of anything that was not actually submitted to the network.
//
// The DESCRIPTION of each row is not stored. The feed reads the operations from Horizon exactly as it
// already does for fee payments, so one code path renders both sources and a stored row cannot drift
// from what the chain says happened.
//
// ⚠ THIS IS AN UNAUTHENTICATED WRITER, and it has to be -- see _lib/ratelimit.js. The shape checks
// bound what a row can contain but not how many rows can be written, so a per-IP ceiling bounds the
// rest. Note what the ceiling does NOT do: it is a limit on volume, not a proof that the transaction
// went through us. Nothing stored here can establish that, because the free operations this exists to
// record leave no marker -- which is the whole reason the endpoint exists. See LUMOSCORE_DEV.md.
import { rateLimit } from '../../_lib/ratelimit.js';

const ADDR_RE = /^G[A-Z2-7]{55}$/;
const HASH_RE = /^[0-9a-f]{64}$/i;
// A busy trader submits a few operations a minute at most; each is one beacon.
const PER_MIN = 20;
const PER_HOUR = 200;
// The feed shows 8. This is larger than that on purpose: the dashboard also counts how many distinct
// transactions happened in the last 24 hours, and a limit tight enough for the visible list would cap
// that count without saying so. 100 is far above a real day here and still one small query.
const MAX_ROWS = 100;

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
  const db = env && env.ADMIN_DB;
  // Fire-and-forget, exactly like the connect beacon: the site must not behave differently because
  // this store is unavailable, and a failed write is never the user's problem.
  if (!db) return json({ ok: false, reason: 'no db' }, 200);

  let addr = '', hash = '';
  try {
    const b = await request.json();
    addr = String((b && b.addr) || '');
    hash = String((b && b.hash) || '');
  } catch (_) { return json({ ok: false, reason: 'bad body' }, 200); }

  // Narrow on purpose: two fields, both shape-checked, so this cannot be used to write arbitrary rows.
  if (!ADDR_RE.test(addr)) return json({ ok: false, reason: 'bad addr' }, 200);
  if (!HASH_RE.test(hash)) return json({ ok: false, reason: 'bad hash' }, 200);

  // 200, not 429: fire-and-forget, exactly like the no-db case above. A refused write must not change
  // how the page behaves.
  const rl = await rateLimit(env && env.CONTENT_KV,
    request.headers.get('cf-connecting-ip'), 'act', PER_MIN, PER_HOUR);
  if (!rl.ok) return json({ ok: false, reason: 'rate' }, 200);

  try {
    // The hash is the primary key, so a retry, a double-submit or a second tab costs nothing.
    await db.prepare(
      'INSERT INTO activity (hash, addr, ts) VALUES (?1, ?2, ?3) ON CONFLICT(hash) DO NOTHING'
    ).bind(hash.toLowerCase(), addr, Date.now()).run();
  } catch (e) {
    return json({ ok: false, reason: 'write failed' }, 200);
  }
  return json({ ok: true }, 200);
}

export async function onRequestGet({ env }) {
  const db = env && env.ADMIN_DB;
  // An empty list and an unreachable store are different states, and the feed renders them
  // differently: one says "no activity yet", the other quietly falls back to the fee-payment source.
  if (!db) return json({ items: [], reason: 'no db' }, 200, 30);

  try {
    // Listing fees and their refunds are NOT platform activity, and the beacon cannot tell: it wraps
    // every submission to Horizon, so paying for a curated listing looks exactly like trading. They are
    // excluded on the way OUT instead, by asking the listing queue -- which lives in this same database
    // -- whether it owns the hash. That is exact rather than a guess at a memo, it needs nothing stored
    // at write time, and it also hides rows that were already recorded before this existed.
    const r = await db.prepare(
      'SELECT a.hash AS hash, a.addr AS addr, a.ts AS ts FROM activity a '
      + 'WHERE a.hash NOT IN (SELECT tx_hash FROM listing_request) '
      + 'AND a.hash NOT IN (SELECT refund_hash FROM listing_request WHERE refund_hash IS NOT NULL) '
      + 'ORDER BY a.ts DESC LIMIT ?1'
    ).bind(MAX_ROWS).all();
    const items = ((r && r.results) || []).map((x) => ({
      hash: x.hash, addr: x.addr, ts: x.ts,
    }));
    return json({ items }, 200, 20);
  } catch (e) {
    return json({ items: [], reason: 'read failed' }, 200, 10);
  }
}
