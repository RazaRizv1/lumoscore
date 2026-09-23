// Where a wallet last connected from, as a country and nothing finer.
//
// TWO HALVES WITH VERY DIFFERENT RULES:
//   POST is PUBLIC, because the app calls it the moment someone connects a wallet. It accepts an
//        address and nothing else -- the country comes from request.cf at the edge, so a caller can
//        record that a wallet connected but can never say from where.
//   GET  is ADMIN ONLY. The map it returns associates wallet addresses with countries, which is
//        exactly the kind of thing that must not be readable by whoever asks. functions/ is shared
//        with the PUBLIC projects, where nothing sits in front of it.
//
// COUNTRY ONLY. Cloudflare also offers region and city; a wallet address plus a city is a far more
// identifying record than a wallet address plus a flag, and the flag is what the panel asked for.
// One row per address, overwritten each time: last-seen-from, not a location history.
import { requireAdmin } from '../../_lib/adminauth.js';

const ADDR_RE = /^G[A-Z2-7]{55}$/;
const CC_RE = /^[A-Z]{2}$/;

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

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

export async function onRequestPost({ request, env }) {
  const db = env && env.ADMIN_DB;
  // Answer 200 either way. This is a beacon fired during wallet connect; a failure here must never
  // become a visible error in the middle of someone connecting their wallet.
  if (!db) return json({ ok: true }, 200);

  let b;
  try { b = await request.json(); } catch (_) { return json({ ok: true }, 200); }
  const addr = String((b && b.addr) || '').trim().toUpperCase();
  if (!ADDR_RE.test(addr)) return json({ ok: true }, 200);

  // From the edge, never the body.
  const cf = (request && request.cf) || {};
  const cc = String(cf.country || '').trim().toUpperCase();
  // T1 is Cloudflare's code for Tor, and XX for unknown. Neither is a place, so neither is stored --
  // a flag for "Tor" would be a wrong answer rather than a missing one.
  if (!CC_RE.test(cc) || cc === 'T1' || cc === 'XX') return json({ ok: true }, 200);

  try {
    await db.prepare(
      'INSERT INTO wallet_geo (addr, country, ts, n) VALUES (?1, ?2, ?3, 1) '
      + 'ON CONFLICT(addr) DO UPDATE SET country = ?2, ts = ?3, n = n + 1'
    ).bind(addr, cc, Date.now()).run();
  } catch (_) { /* never surface a beacon failure to someone connecting a wallet */ }
  return json({ ok: true }, 200);
}

export async function onRequestGet({ request, env }) {
  const bad = await requireAdmin(request);
  if (bad) return bad;
  const db = env && env.ADMIN_DB;
  if (!db) return json({ ok: true, geo: {} }, 200);

  try {
    // The panel renders one flag per row and holds at most a few hundred wallets, so the whole map
    // goes at once rather than a request per row.
    const r = await db.prepare('SELECT addr, country, ts, n FROM wallet_geo LIMIT 5000').all();
    const geo = {};
    for (const row of ((r && r.results) || [])) {
      geo[row.addr] = { c: row.country, t: row.ts, n: row.n };
    }
    return json({ ok: true, geo }, 200);
  } catch (e) {
    return json({ ok: true, geo: {}, error: String((e && e.message) || e) }, 200);
  }
}
