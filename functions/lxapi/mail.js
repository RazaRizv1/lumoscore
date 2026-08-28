// The support inbox, for the admin panel.
//
// EVERY METHOD IS GATED, INCLUDING GET. Blog posts and asset descriptions are published material, so
// their reads are open. This is private correspondence from customers -- and functions/ is shared with
// the public projects, where nothing sits in front of it. An ungated read here would put the contents
// of team@lumoscore.com on the open internet.
import { requireAdmin } from '../../_lib/adminauth.js';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export async function onRequestGet({ request, env }) {
  const bad = await requireAdmin(request);
  if (bad) return bad;
  const db = env && env.ADMIN_DB;
  if (!db) return json({ messages: [], reason: 'no db' }, 200);

  const u = new URL(request.url);
  const id = u.searchParams.get('id') || '';
  const box = u.searchParams.get('box') || 'inbox';

  try {
    if (id) {
      const r = await db.prepare('SELECT * FROM mail WHERE id = ?1').bind(id).first();
      if (!r) return json({ error: 'not found' }, 404);
      return json({ message: r }, 200);
    }
    // The list deliberately does NOT select the bodies. An inbox of long messages would otherwise
    // ship every one of them to render a list of subjects.
    const where = box === 'archived' ? 'archived = 1' : 'archived = 0';
    const rows = await db.prepare(
      'SELECT id, ts, to_addr, from_addr, from_name, subject, size, read_at, archived '
      + 'FROM mail WHERE ' + where + ' ORDER BY ts DESC LIMIT 200'
    ).all();
    const counts = await db.prepare(
      'SELECT '
      + 'SUM(CASE WHEN archived = 0 THEN 1 ELSE 0 END) AS inbox, '
      + 'SUM(CASE WHEN archived = 0 AND read_at IS NULL THEN 1 ELSE 0 END) AS unread, '
      + 'SUM(CASE WHEN archived = 1 THEN 1 ELSE 0 END) AS archived FROM mail'
    ).first();
    return json({ messages: (rows && rows.results) || [], counts: counts || {} }, 200);
  } catch (e) {
    return json({ messages: [], error: String((e && e.message) || e) }, 200);
  }
}

// Mark read / unread / archived. PATCH rather than PUT: these change one flag on an existing message
// and never create one -- messages only ever arrive by email.
export async function onRequestPatch({ request, env }) {
  const bad = await requireAdmin(request);
  if (bad) return bad;
  const db = env && env.ADMIN_DB;
  if (!db) return json({ error: 'no db binding' }, 500);

  let b;
  try { b = await request.json(); } catch (_) { return json({ error: 'bad json' }, 400); }
  const id = String((b && b.id) || '');
  if (!id) return json({ error: 'id required' }, 400);

  try {
    if (b.read === true) await db.prepare('UPDATE mail SET read_at = ?2 WHERE id = ?1 AND read_at IS NULL').bind(id, Date.now()).run();
    if (b.read === false) await db.prepare('UPDATE mail SET read_at = NULL WHERE id = ?1').bind(id).run();
    if (b.archived != null) await db.prepare('UPDATE mail SET archived = ?2 WHERE id = ?1').bind(id, b.archived ? 1 : 0).run();
    return json({ ok: true }, 200);
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 500);
  }
}

// Deleting is deliberately absent. A support message is a record of what a customer said; archiving
// takes it out of the way without destroying it, and there is no reason an admin panel needs to be able
// to erase one. Add it only if a real need turns up.
