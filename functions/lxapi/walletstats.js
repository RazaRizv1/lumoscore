// Distinct connected wallets per window, for the admin dashboard.
//
// Counterpart to /lxapi/ev, which records them. Because wallet_day holds one row per wallet per UTC day
// rather than one per connection, "distinct wallets in a window" is a COUNT(DISTINCT addr) over a date
// range and nothing heavier -- no dedupe pass over a log.
//
// All four windows come back in ONE request. The dashboard's period selector switches between them
// without going to the network again, so changing the period is instant and cannot half-load.
//
// Read-only, GET only, no parameters: there is nothing here to inject into.
function json(body, status, ttl) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      // Short cache: the figure moves slowly and the admin dashboard reloads often, but it should not
      // be stale enough that a wallet connecting now is invisible for minutes.
      'cache-control': 'public, max-age=' + (ttl == null ? 60 : ttl),
      'access-control-allow-origin': '*',
    },
  });
}

function dayStr(ms) { return new Date(ms).toISOString().slice(0, 10); }

export async function onRequestGet({ env }) {
  const db = env && env.ADMIN_DB;
  // null, not 0. A missing binding means "we do not know", and the dashboard renders that as a dash
  // with an explanation -- reporting zero connected wallets would be a wrong answer, not a missing one.
  if (!db) return json({ d1: null, d7: null, d30: null, all: null, reason: 'no db' }, 200, 30);

  const now = Date.now(), DAY = 86400000;
  try {
    const q = async (fromDay) => {
      const sql = fromDay
        ? 'SELECT COUNT(DISTINCT addr) AS n FROM wallet_day WHERE day >= ?1'
        : 'SELECT COUNT(DISTINCT addr) AS n FROM wallet_day';
      const st = fromDay ? db.prepare(sql).bind(fromDay) : db.prepare(sql);
      const r = await st.first();
      return (r && r.n) || 0;
    };
    // Day granularity, so "24H" means today and yesterday's rows filtered by date, not a rolling
    // timestamp. Stated plainly in the payload so the dashboard can label it honestly rather than
    // implying a precision the storage does not have.
    const [d1, d7, d30, all] = await Promise.all([
      q(dayStr(now)),
      q(dayStr(now - 6 * DAY)),
      q(dayStr(now - 29 * DAY)),
      q(null),
    ]);
    let since = null;
    try {
      const f = await db.prepare('SELECT MIN(day) AS d FROM wallet_day').first();
      since = (f && f.d) || null;
    } catch (_) { /* the counts are still good without it */ }
    return json({ d1, d7, d30, all, granularity: 'utc-day', since }, 200, 60);
  } catch (e) {
    return json({ d1: null, d7: null, d30: null, all: null, reason: 'query failed' }, 200, 30);
  }
}
