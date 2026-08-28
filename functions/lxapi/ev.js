// Records that a wallet CONNECTED to the site.
//
// This is the only source for the "connected wallets" figures on the admin dashboard. Nothing on-chain
// records a connection -- only wallets that go on to pay a fee leave a trace, and those are a small
// fraction of the people who open the app. Without this endpoint that number cannot exist, which is why
// it is shown blank rather than estimated until this is collecting.
//
// WHAT IS STORED, AND WHAT IS NOT: one row per wallet per UTC day, holding the address, the first and
// last timestamp that day, and a count. No IP, no user agent, no page, no referrer -- none of it is
// needed to answer "how many distinct wallets in this window", and collecting it anyway would turn a
// counter into a tracking log. The address is public on-chain data and the admin Users page needs it to
// join against fee payments, so it is stored as-is rather than hashed.
//
// Deliberately narrow: POST only, one field, and the address must match Stellar's G-address shape
// exactly, so this cannot be used to write arbitrary rows.
const ADDR_RE = /^G[A-Z2-7]{55}$/;

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
  // No binding is not an error the browser should care about: the beacon is fire-and-forget and the
  // site must not behave differently because analytics storage is unavailable.
  if (!db) return json({ ok: false, reason: 'no db' }, 200);

  let addr = '';
  try {
    const b = await request.json();
    addr = String((b && b.addr) || '');
  } catch (_) { return json({ ok: false, reason: 'bad body' }, 200); }
  if (!ADDR_RE.test(addr)) return json({ ok: false, reason: 'bad addr' }, 200);

  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);   // UTC, so days do not shift with the viewer

  try {
    // Upsert: the first connection of the day creates the row, later ones only move last_ts and bump
    // the counter. This is why the table is keyed (addr, day) -- it makes a repeat visit cost one write
    // instead of one row, and keeps "distinct wallets" a plain COUNT rather than a DISTINCT over a log.
    await db.prepare(
      'INSERT INTO wallet_day (addr, day, first_ts, last_ts, seen) VALUES (?1, ?2, ?3, ?3, 1) '
      + 'ON CONFLICT(addr, day) DO UPDATE SET last_ts = ?3, seen = seen + 1'
    ).bind(addr, day, now).run();
  } catch (e) {
    return json({ ok: false, reason: 'write failed' }, 200);
  }
  return json({ ok: true }, 200);
}
