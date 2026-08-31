// Reads the admin audit trail back for the panel.
//
// Behind requireAdmin() like everything else here -- functions/ is shared with the PUBLIC projects,
// and this endpoint lists internal email addresses alongside every decision the team has taken.
//
// READ ONLY, on purpose. There is no handler here that writes, edits or deletes a row, and the panel
// offers no button that would. A log the people it records can rewrite answers nothing worth asking;
// a mistaken entry is corrected by a later one.
import { requireAdmin } from '../../_lib/adminauth.js';

const MAX = 200;

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export async function onRequestGet({ request, env }) {
  const bad = await requireAdmin(request);
  if (bad) return bad;
  const db = env && env.ADMIN_DB;
  if (!db) return json({ ok: false, error: 'no database binding', entries: [] }, 500);

  const u = new URL(request.url);
  const limit = Math.min(MAX, Math.max(1, parseInt(u.searchParams.get('limit') || '80', 10) || 80));
  // Optional filters, both narrow: an exact actor, or an action prefix like "listing." so one kind of
  // decision can be read on its own without scrolling past everything else.
  const actor = (u.searchParams.get('actor') || '').slice(0, 120);
  const kind = (u.searchParams.get('kind') || '').replace(/[^a-z.]/gi, '').slice(0, 40);

  let sql = 'SELECT id, at, actor, action, target, detail FROM admin_audit';
  const where = [];
  const bind = [];
  if (actor) { where.push('actor = ?' + (bind.length + 1)); bind.push(actor); }
  if (kind) { where.push('action LIKE ?' + (bind.length + 1)); bind.push(kind + '%'); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY at DESC LIMIT ?' + (bind.length + 1);
  bind.push(limit);

  let rows = [];
  try {
    // Spread rather than .bind.apply(): the latter needed a second prepare() just to supply a `this`,
    // so the statement that got bound was not the one that was built.
    const r = await db.prepare(sql).bind(...bind).all();
    rows = (r && r.results) || [];
  } catch (e) {
    return json({ ok: false, error: 'could not read the log', entries: [] }, 500);
  }

  return json({
    ok: true,
    entries: rows.map((r) => ({
      id: r.id,
      at: r.at,
      actor: r.actor,
      action: r.action,
      target: r.target || '',
      detail: r.detail || '',
    })),
  }, 200);
}
