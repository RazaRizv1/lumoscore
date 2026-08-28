// Manually recorded revenue: the money that does not arrive on-chain.
//
// Trading fees and mint fees are paid to the fee collector, so they are read from the chain and are not
// stored anywhere -- a stored copy of a chain figure is just a second number that can disagree with the
// first. Advertising and paid listings are invoiced off-chain and leave no trace we can read, so they
// have to be entered by hand or they simply do not appear.
//
// Gated on every method, reads included: these are the business's revenue figures, and functions/ is
// shared with the public projects where nothing sits in front of it.
import { requireAdmin } from '../../_lib/adminauth.js';

const KEY = 'revenue:manual';
const SOURCES = ['ads', 'listing', 'sponsorship', 'other'];

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

async function readAll(kv) {
  try { return (await kv.get(KEY, 'json')) || []; } catch (_) { return []; }
}

export async function onRequestGet({ request, env }) {
  const bad = await requireAdmin(request);
  if (bad) return bad;
  const kv = env && env.CONTENT_KV;
  if (!kv) return json({ entries: [], reason: 'no kv' }, 200);
  return json({ entries: await readAll(kv) }, 200);
}

export async function onRequestPut({ request, env }) {
  const bad = await requireAdmin(request);
  if (bad) return bad;
  const kv = env && env.CONTENT_KV;
  if (!kv) return json({ error: 'no kv binding' }, 500);

  let b;
  try { b = await request.json(); } catch (_) { return json({ error: 'bad json' }, 400); }

  const source = String((b && b.source) || '').toLowerCase();
  if (SOURCES.indexOf(source) < 0) return json({ error: 'source must be one of: ' + SOURCES.join(', ') }, 400);

  // Amounts are held as a STRING of a fixed 2-decimal value. Money that round-trips through a float
  // picks up 0.01 errors on the way, and a revenue table that does not add up is worse than no table.
  const n = Number(b.amountUsd);
  if (!isFinite(n) || n === 0) return json({ error: 'amountUsd must be a non-zero number' }, 400);
  const amountUsd = n.toFixed(2);

  const when = Number(b.when);
  const entry = {
    id: String((b && b.id) || ('m' + Date.now() + '-' + Math.abs(n * 100).toFixed(0))),
    source,
    amountUsd,
    // A date is required rather than defaulted to today: an invoice is nearly always entered after the
    // fact, and silently filing it under today would put the money in the wrong month.
    when: (isFinite(when) && when > 0) ? when : Date.now(),
    note: String((b && b.note) || '').trim().slice(0, 200),
    createdAt: Date.now(),
  };

  const list = await readAll(kv);
  const next = list.filter((e) => e && e.id !== entry.id);
  next.unshift(entry);
  next.sort((x, y) => (y.when || 0) - (x.when || 0));
  await kv.put(KEY, JSON.stringify(next));
  return json({ ok: true, entry }, 200);
}

export async function onRequestDelete({ request, env }) {
  const bad = await requireAdmin(request);
  if (bad) return bad;
  const kv = env && env.CONTENT_KV;
  if (!kv) return json({ error: 'no kv binding' }, 500);
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!id) return json({ error: 'id required' }, 400);
  const list = await readAll(kv);
  await kv.put(KEY, JSON.stringify(list.filter((e) => e && e.id !== id)));
  return json({ ok: true }, 200);
}
