// GET /lxapi/cctp/status?hash=<burn hash>
//
// What the relayer has managed to do with one queued transfer. The Bridge page polls this to show
// "Delivering automatically…" instead of asking the user to connect an EVM wallet they may not have.
//
// Returns { relayer: "off" } when the namespace is not bound, so the page falls back to the manual claim
// button rather than showing a delivery promise nothing is keeping.
const jr = (o, s = 200) => new Response(JSON.stringify(o), {
  status: s,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

export async function onRequestGet({ request, env }) {
  const kv = env && env.CCTP;
  if (!kv) return jr({ relayer: 'off' });

  const url = new URL(request.url);
  // one hash, or several comma-separated — the pending panel usually has more than one row
  const raw = String(url.searchParams.get('hash') || '').toLowerCase();
  const hashes = raw.split(',').map((h) => h.trim()).filter((h) => /^[0-9a-f]{64}$/.test(h)).slice(0, 20);
  if (!hashes.length) return jr({ error: 'bad hash' }, 400);

  const out = {};
  await Promise.all(hashes.map(async (h) => {
    const rec = await kv.get('pend:' + h, 'json');
    out[h] = rec
      ? { status: rec.status, reason: rec.reason || null, deliverHash: rec.deliverHash || null, tries: rec.tries || 0, updatedAt: rec.updatedAt || rec.createdAt || null }
      : { status: 'unknown' };
  }));

  return jr({ relayer: 'on', items: out });
}
