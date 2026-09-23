// What the admin sidebar puts a number on: unread support mail, and listing requests still waiting.
//
// ITS OWN ENDPOINT, deliberately. The sidebar is on EVERY admin page, so this runs on every one of
// them -- and the existing readers are the wrong shape for that. /lxapi/mail returns up to 200 rows
// with snippets to render a list; /lxapi/listingadmin returns up to 500 applications with their
// descriptions, logos and payment hashes. Loading either just to show "3" would ship tens of
// kilobytes per page view to render two digits. This answers with two numbers.
//
// ADMIN ONLY. It counts private correspondence and a paid application queue, and functions/ is shared
// with the public projects where nothing sits in front of it.
import { requireAdmin } from '../../_lib/adminauth.js';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

// The caller passes the watermark it last acknowledged, so "new" means new TO THIS READER rather than
// unread in the abstract. A missing or nonsense value counts everything, which is the safe direction:
// showing a badge that is already dealt with costs a click, hiding one that is not costs the message.
function since(u, k) {
  const n = parseInt(u.searchParams.get(k) || '0', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function onRequestGet({ request, env }) {
  const bad = await requireAdmin(request);
  if (bad) return bad;
  const db = env && env.ADMIN_DB;
  if (!db) return json({ ok: true, mail: 0, listings: 0, reason: 'no db' }, 200);

  const u = new URL(request.url);
  const mailSince = since(u, 'mail');
  const listSince = since(u, 'listings');

  const out = { ok: true, mail: 0, listings: 0, mailNewest: 0, listNewest: 0 };

  // UNREAD *AND* NEW. Either alone gets it wrong: counting every unread message means the badge never
  // clears while old mail sits unopened, and counting only what arrived since the last visit means a
  // message you looked at the list of but did not open stops being flagged. Both, and the badge means
  // "arrived since you last opened Support, and you have not read it".
  //
  // Blocked senders are excluded the same way the Inbox excludes them -- a badge for mail that is
  // sitting in Spam would send you looking for something that is not in the inbox.
  try {
    const r = await db.prepare(
      'SELECT COUNT(*) AS n, MAX(ts) AS newest FROM mail WHERE archived = 0 AND read_at IS NULL AND ts > ?1'
      + " AND NOT (LOWER(from_addr) IN (SELECT addr FROM mail_block)"
      + " OR '@' || LOWER(SUBSTR(from_addr, INSTR(from_addr, '@') + 1)) IN (SELECT addr FROM mail_block))"
    ).bind(mailSince).first();
    out.mail = (r && r.n) || 0;
    out.mailNewest = (r && r.newest) || 0;
  } catch (_) { /* a badge is not worth failing the page for */ }

  // PENDING *AND* NEW, the same pair as above and for the same reason: the badge says "something
  // arrived that you have not looked at", not "there is outstanding work". The Listing requests tab
  // carries the true pending total, which is where a count that should not clear on a visit belongs.
  // Both columns are epoch ms, like mail.ts, so one watermark shape works for both.
  try {
    const r = await db.prepare(
      "SELECT COUNT(*) AS n, MAX(created_at) AS newest FROM listing_request WHERE status = 'pending' AND created_at > ?1"
    ).bind(listSince).first();
    out.listings = (r && r.n) || 0;
    out.listNewest = (r && r.newest) || 0;
  } catch (_) { }

  return json(out, 200);
}
