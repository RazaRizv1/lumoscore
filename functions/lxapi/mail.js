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
// A block entry is EITHER a full address (`someone@example.com`) OR a domain, written with a leading
// @ (`@bounce.linkedin.com`) so the two can never be confused. The domain form exists because bulk
// senders do not reuse an address: LinkedIn's envelope from is
// `m-13zz0j7n32av8...@bounce.linkedin.com`, a fresh random local part on every single message, so an
// address block would catch the one mail you clicked and nothing after it -- which is the opposite of
// "always land in spam" (measured against the live inbox, 2026-09-23).
const MATCH = "(LOWER(from_addr) IN (SELECT addr FROM mail_block)"
  + " OR '@' || LOWER(SUBSTR(from_addr, INSTR(from_addr, '@') + 1)) IN (SELECT addr FROM mail_block))";
const BLOCKED = MATCH;
const CLEAN = 'NOT ' + MATCH;

function domainOf(addr) {
  const s = String(addr || '').trim().toLowerCase();
  const at = s.lastIndexOf('@');
  return at > 0 ? '@' + s.slice(at + 1) : '';
}

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

// One id or a list of them, normalised to a list. The cap is what the panel can actually put on
// screen (the list itself is LIMIT 200), so a request larger than that is not a bulk action from
// this UI and is cut rather than turned into an unbounded statement.
const IDS_MAX = 200;
function idsOf(b) {
  const raw = (b && Array.isArray(b.ids)) ? b.ids : [(b && b.id)];
  const seen = Object.create(null);
  const out = [];
  for (const v of raw) {
    const s = String(v == null ? '' : v);
    if (!s || seen[s]) continue;
    seen[s] = 1;
    out.push(s);
    if (out.length >= IDS_MAX) break;
  }
  return out;
}
function places(n, from) {
  const a = [];
  for (let i = 0; i < n; i++) a.push('?' + (i + (from || 1)));
  return a.join(',');
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
      // block_addr is the ENTRY that put it in Spam -- an address or an @domain -- so the panel can
      // name the actual rule rather than guess which of the two applied.
      const r = await db.prepare(
        'SELECT *, ' + MATCH + ' AS spam, '
        + "(SELECT addr FROM mail_block WHERE addr = LOWER(from_addr)"
        + " OR addr = '@' || LOWER(SUBSTR(from_addr, INSTR(from_addr, '@') + 1)) LIMIT 1) AS block_addr "
        + 'FROM mail WHERE id = ?1'
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
  const ids = idsOf(b);
  if (!ids.length) return json({ error: 'id required' }, 400);
  // read / archived stay single-message: they are per-message flags and the panel only ever sends one.
  const id = ids[0];

  try {
    if (b.read === true) await db.prepare('UPDATE mail SET read_at = ?2 WHERE id = ?1 AND read_at IS NULL').bind(id, Date.now()).run();
    if (b.read === false) await db.prepare('UPDATE mail SET read_at = NULL WHERE id = ?1').bind(id).run();
    if (b.archived != null) await db.prepare('UPDATE mail SET archived = ?2 WHERE id = ?1').bind(id, b.archived ? 1 : 0).run();

    if (b.spam != null) {
      // THE ADDRESSES COME FROM THE STORED MESSAGES, never from the request body. Taking them from the
      // caller would turn this into a way to block any address at all with one forged field.
      //
      // Selecting several messages usually means selecting several FROM ONE SENDER, so the distinct
      // set is what gets written -- twenty newsletters from one address are one block, not twenty.
      const rows = await db.prepare(
        'SELECT DISTINCT LOWER(from_addr) AS addr FROM mail WHERE id IN (' + places(ids.length) + ')'
      ).bind(...ids).all();
      const addrs = ((rows && rows.results) || []).map((r) => String(r.addr || '').trim()).filter(Boolean);
      if (!addrs.length) return json({ error: 'no sender address on those messages' }, 404);

      // scope 'domain' blocks everything from the sending host; anything else blocks the exact address.
      const domain = b.scope === 'domain';
      const found = domain
        ? [...new Set(addrs.map(domainOf).filter(Boolean))]
        : addrs;
      if (!found.length) return json({ error: 'could not read a domain from those senders' }, 400);

      // Refused rather than skipped: silently blocking 4 of 5 and saying "ok" would leave you
      // believing a sender was blocked when it was not.
      const mine = found.filter(ours);
      if (b.spam && mine.length) {
        return json({ error: 'That is one of our own (' + mine[0] + ') — blocking it would hide your own forwarded mail.' }, 400);
      }

      const now = Date.now();
      const actor = adminActor(request) || 'unknown';
      let stmts;
      if (b.spam) {
        stmts = found.map((a) => db.prepare('INSERT OR REPLACE INTO mail_block (addr, ts, by) VALUES (?1, ?2, ?3)').bind(a, now, actor));
      } else {
        // UNBLOCKING CLEARS BOTH FORMS. "Not spam" means get this out of spam, and the reader has no
        // reason to know whether it landed there by address or by domain -- removing only the one they
        // named would leave the message exactly where it was, with a button that appeared to do
        // nothing.
        const all = [...new Set(addrs.concat(addrs.map(domainOf)).filter(Boolean))];
        stmts = all.map((a) => db.prepare('DELETE FROM mail_block WHERE addr = ?1').bind(a));
      }
      await db.batch(stmts);
      await audit(env, request, b.spam ? 'support.spam' : 'support.unspam', ids[0],
        { addrs: found.slice(0, 8), n: found.length, scope: domain ? 'domain' : 'addr' });
      return json({ ok: true, addrs: found, addr: found[0], senders: found.length, messages: ids.length, scope: domain ? 'domain' : 'addr', spam: !!b.spam }, 200);
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
  const ids = idsOf(b);
  if (!ids.length) return json({ error: 'id required' }, 400);

  try {
    // Read first, so the audit line can name what was destroyed. Afterwards there is nothing to name.
    const rows = await db.prepare(
      'SELECT id, from_addr, subject FROM mail WHERE id IN (' + places(ids.length) + ')'
    ).bind(...ids).all();
    const found = (rows && rows.results) || [];
    if (!found.length) return json({ error: 'not found' }, 404);

    // The mail and its replies go in ONE batch, so there is no window in which a reply row points at
    // a message that no longer exists.
    const inList = places(found.length);
    const args = found.map((r) => r.id);
    const res = await db.batch([
      db.prepare('DELETE FROM mail_reply WHERE mail_id IN (' + inList + ')').bind(...args),
      db.prepare('DELETE FROM mail WHERE id IN (' + inList + ')').bind(...args),
    ]);
    const deleted = (res && res[1] && res[1].meta && res[1].meta.changes) || 0;
    await audit(env, request, 'support.delete', found[0].id, {
      n: found.length,
      from: found.slice(0, 5).map((r) => String(r.from_addr || '').slice(0, 80)),
      subject: String(found[0].subject || '').slice(0, 160),
    });
    return json({ ok: true, deleted }, 200);
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 500);
  }
}
