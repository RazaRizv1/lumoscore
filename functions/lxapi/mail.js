// The support inbox, for the admin panel.
//
// EVERY METHOD IS GATED, INCLUDING GET. Blog posts and asset descriptions are published material, so
// their reads are open. This is private correspondence from customers -- and functions/ is shared with
// the public projects, where nothing sits in front of it. An ungated read here would put the contents
// of team@lumoscore.com on the open internet.
import { requireAdmin, adminActor } from '../../_lib/adminauth.js';
import { audit } from '../../_lib/audit.js';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

// SPAM IS A RULE ABOUT A SENDER, evaluated on every read, so it is retroactive both ways: blocking
// someone sweeps their whole history into Spam and unblocking returns it, without touching a single
// mail row. See _data/admin-schema.sql for why this lives here and not in the Email Worker.
const BLOCKED = 'LOWER(from_addr) IN (SELECT addr FROM mail_block)';
const CLEAN = 'LOWER(from_addr) NOT IN (SELECT addr FROM mail_block)';

// Our own addresses are never spam. Blocking one would hide every forward and every reply that comes
// back through routing, and the only way to notice would be mail quietly going missing -- so the case
// is refused rather than made recoverable.
function ours(addr) {
  return /@(mail\.)?lumoscore\.com$/i.test(String(addr || '').trim());
}

// LIKE treats % and _ as wildcards, so a search for "50%" or "a_b" would match far more than it should
// -- and a lone trailing backslash would break the ESCAPE clause. Neutralise all three.
function likeTerm(q) {
  return '%' + String(q).replace(/[\\%_]/g, (c) => '\\' + c) + '%';
}

export async function onRequestGet({ request, env }) {
  const bad = await requireAdmin(request);
  if (bad) return bad;
  const db = env && env.ADMIN_DB;
  if (!db) return json({ messages: [], reason: 'no db' }, 200);

  const u = new URL(request.url);
  const id = u.searchParams.get('id') || '';
  const box = u.searchParams.get('box') || 'inbox';
  const q = (u.searchParams.get('q') || '').trim().slice(0, 120);

  try {
    if (id) {
      // A message opens from whichever box it is in, Spam included -- the point of a Spam box you can
      // see is that you can check it.
      const r = await db.prepare(
        'SELECT *, (LOWER(from_addr) IN (SELECT addr FROM mail_block)) AS spam FROM mail WHERE id = ?1'
      ).bind(id).first();
      if (!r) return json({ error: 'not found' }, 404);
      return json({ message: r }, 200);
    }

    const where = box === 'spam' ? BLOCKED
      : box === 'archived' ? ('archived = 1 AND ' + CLEAN)
      : ('archived = 0 AND ' + CLEAN);

    // Search covers what someone actually remembers about an email: who sent it, what it was called,
    // and a phrase from inside it. It is scoped to the box on screen, so the counts on the chips and
    // the list below them always describe the same set.
    const binds = [];
    let filter = '';
    if (q) {
      binds.push(likeTerm(q));
      filter = " AND (subject LIKE ?1 ESCAPE '\\' OR from_addr LIKE ?1 ESCAPE '\\'"
        + " OR from_name LIKE ?1 ESCAPE '\\' OR body_text LIKE ?1 ESCAPE '\\')";
    }

    // The list deliberately does NOT select the bodies. An inbox of long messages would otherwise
    // ship every one of them to render a list of subjects.
    const stmt = db.prepare(
      'SELECT id, ts, to_addr, from_addr, from_name, subject, size, read_at, archived, '
      + 'substr(body_text, 1, 140) AS snippet '
      + 'FROM mail WHERE ' + where + filter + ' ORDER BY ts DESC LIMIT 200'
    );
    const rows = await (binds.length ? stmt.bind(...binds) : stmt).all();

    // Counts always describe the WHOLE box, never the search result. A chip that counted down as you
    // typed would stop being the thing you navigate by.
    const counts = await db.prepare(
      'SELECT '
      + 'SUM(CASE WHEN archived = 0 AND ' + CLEAN + ' THEN 1 ELSE 0 END) AS inbox, '
      + 'SUM(CASE WHEN archived = 0 AND read_at IS NULL AND ' + CLEAN + ' THEN 1 ELSE 0 END) AS unread, '
      + 'SUM(CASE WHEN archived = 1 AND ' + CLEAN + ' THEN 1 ELSE 0 END) AS archived, '
      + 'SUM(CASE WHEN ' + BLOCKED + ' THEN 1 ELSE 0 END) AS spam FROM mail'
    ).first();
    return json({ messages: (rows && rows.results) || [], counts: counts || {} }, 200);
  } catch (e) {
    return json({ messages: [], error: String((e && e.message) || e) }, 200);
  }
}

// Mark read / unread / archived / spam. PATCH rather than PUT: these change one flag on an existing
// message and never create one -- messages only ever arrive by email.
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

    if (b.spam != null) {
      // THE ADDRESS COMES FROM THE STORED MESSAGE, never from the request body. Taking it from the
      // caller would turn this into a way to block any address at all with one forged field.
      const m = await db.prepare('SELECT from_addr FROM mail WHERE id = ?1').bind(id).first();
      if (!m) return json({ error: 'not found' }, 404);
      const addr = String(m.from_addr || '').trim().toLowerCase();
      if (!addr) return json({ error: 'that message has no sender address to block' }, 400);
      if (b.spam && ours(addr)) return json({ error: 'That is one of our own addresses — blocking it would hide your own forwarded mail.' }, 400);

      if (b.spam) {
        await db.prepare('INSERT OR REPLACE INTO mail_block (addr, ts, by) VALUES (?1, ?2, ?3)')
          .bind(addr, Date.now(), adminActor(request) || 'unknown').run();
      } else {
        await db.prepare('DELETE FROM mail_block WHERE addr = ?1').bind(addr).run();
      }
      await audit(env, request, b.spam ? 'support.spam' : 'support.unspam', id, { addr });
      return json({ ok: true, addr, spam: !!b.spam }, 200);
    }
    return json({ ok: true }, 200);
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 500);
  }
}

// PERMANENT DELETE. This used to be absent on the reasoning that archiving takes a message out of the
// way without destroying the record. That holds for customer correspondence and does not hold for the
// cold outreach and newsletter mail that makes up most of this inbox, which there is no reason to keep
// forever -- so deleting is here, asked for by RAZA on 2026-09-23.
//
// It is irreversible and it says so: the panel asks for a second click, the audit line records who did
// it and to what, and the replies sent on the thread go with it rather than being left as orphan rows
// pointing at a message that no longer exists.
export async function onRequestDelete({ request, env }) {
  const bad = await requireAdmin(request);
  if (bad) return bad;
  const db = env && env.ADMIN_DB;
  if (!db) return json({ error: 'no db binding' }, 500);

  let b;
  try { b = await request.json(); } catch (_) { return json({ error: 'bad json' }, 400); }
  const id = String((b && b.id) || '');
  if (!id) return json({ error: 'id required' }, 400);

  try {
    // Read first, so the audit line can name what was destroyed. Afterwards there is nothing to name.
    const m = await db.prepare('SELECT from_addr, subject FROM mail WHERE id = ?1').bind(id).first();
    if (!m) return json({ error: 'not found' }, 404);
    await db.prepare('DELETE FROM mail_reply WHERE mail_id = ?1').bind(id).run();
    const r = await db.prepare('DELETE FROM mail WHERE id = ?1').bind(id).run();
    await audit(env, request, 'support.delete', id, {
      from: String(m.from_addr || '').slice(0, 120),
      subject: String(m.subject || '').slice(0, 160),
    });
    return json({ ok: true, deleted: ((r && r.meta && r.meta.changes) || 0) }, 200);
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 500);
  }
}
