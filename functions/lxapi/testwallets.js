// /lxapi/testwallets -- ADMIN ONLY. The admin "Test wallets" page reads and edits the approved list here.
//   GET                                   -> { ok, rows: [{ net, addr, label, added_at, added_by }] }
//   POST { op:'add', net, addr, label }   -> { ok }
//   POST { op:'remove', net, addr }       -> { ok }
// Every handler calls requireAdmin() first: functions/ is shared by the public project too, so a missing check
// would put this on lumoscore.com. Writes are audited. See _lib/testwallets.js for what an approved wallet gets.
import { requireAdmin } from '../../_lib/adminauth.js';
import { audit } from '../../_lib/audit.js';
import { SCHEMA, NETS, normAddr, validAddr } from '../../_lib/testwallets.js';

function json(body, status) {
  return new Response(JSON.stringify(body), { status: status || 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
function clip(s, n) { s = String(s == null ? '' : s).trim(); return s.length > n ? s.slice(0, n) : s; }

export async function onRequestGet({ request, env }) {
  const bad = await requireAdmin(request);
  if (bad) return bad;
  const db = env && env.ADMIN_DB;
  if (!db) return json({ ok: false, error: 'no database binding' }, 500);
  await db.prepare(SCHEMA).run();
  const r = await db.prepare('SELECT net, addr, label, added_at, added_by FROM test_wallets ORDER BY net, added_at DESC').all();
  return json({ ok: true, nets: Object.keys(NETS), rows: r.results || [] });
}

export async function onRequestPost({ request, env }) {
  const bad = await requireAdmin(request);
  if (bad) return bad;
  const db = env && env.ADMIN_DB;
  if (!db) return json({ ok: false, error: 'no database binding' }, 500);
  let b = {};
  try { b = await request.json(); } catch (e) { return json({ ok: false, error: 'bad request' }, 400); }
  const net = String(b.net || '');
  if (!NETS[net]) return json({ ok: false, error: 'unknown network' }, 400);
  const addr = normAddr(net, b.addr);
  if (!validAddr(net, addr)) return json({ ok: false, error: 'That is not a valid ' + net + ' address.' }, 400);
  await db.prepare(SCHEMA).run();
  if (b.op === 'add') {
    const who = request.headers.get('cf-access-authenticated-user-email') || '';
    await db.prepare('INSERT INTO test_wallets (net, addr, label, added_at, added_by) VALUES (?1, ?2, ?3, ?4, ?5) '
      + 'ON CONFLICT (net, addr) DO UPDATE SET label = excluded.label')
      .bind(net, addr, clip(b.label, 60) || null, Date.now(), who || null).run();
    await audit(env, request, 'testwallet.add', net + ':' + addr, { label: clip(b.label, 60) || undefined });
    return json({ ok: true });
  }
  if (b.op === 'remove') {
    await db.prepare('DELETE FROM test_wallets WHERE net = ?1 AND addr = ?2').bind(net, addr).run();
    await audit(env, request, 'testwallet.remove', net + ':' + addr, {});
    return json({ ok: true });
  }
  return json({ ok: false, error: 'unknown op' }, 400);
}
