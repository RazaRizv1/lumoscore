// POST /lxapi/cctp/enqueue  { burnHash }
//
// Hands a freshly-burned CCTP transfer to the delivery relayer. The relayer itself is a separate Worker
// (Pages Functions cannot run cron); this endpoint only writes the queue entry into the KV namespace they
// share, so no relayer URL and no shared secret ever reach the browser.
//
// DEGRADES TO NOTHING. If the CCTP namespace is not bound — before provisioning, or on a preview
// deployment — this answers { relayer: "off" } and the page keeps its manual claim flow. Auto-delivery is
// an upgrade on top of a flow that already works; it must never be able to break it.
const CCTP_KV = (env) => env && env.CCTP;
const HORIZON = 'https://horizon.stellar.org';
const TTL = 60 * 60 * 24 * 30;   // a queue entry outlives any realistic delivery; the record is not the funds

const jr = (o, s = 200) => new Response(JSON.stringify(o), {
  status: s,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

export async function onRequestPost({ request, env }) {
  const kv = CCTP_KV(env);
  if (!kv) return jr({ relayer: 'off' });

  const body = await request.json().catch(() => ({}));
  const hash = String(body.burnHash || '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash)) return jr({ error: 'bad burnHash' }, 400);

  const key = 'pend:' + hash;
  const existing = await kv.get(key, 'json');
  if (existing) return jr({ relayer: 'on', status: existing.status, already: true });

  // Only real, successful Stellar transactions get queued. Without this anyone could post arbitrary
  // hashes and have the relayer spend its request budget chasing transfers that never happened.
  const r = await fetch(`${HORIZON}/transactions/${hash}`, { headers: { accept: 'application/json' } });
  if (!r.ok) return jr({ error: 'no such Stellar transaction' }, 400);
  const tx = await r.json().catch(() => null);
  if (!tx || !tx.successful) return jr({ error: 'that Stellar transaction did not succeed' }, 400);

  const rec = {
    burnHash: hash,
    status: 'queued',
    tries: 0,
    createdAt: Date.now(),
    destDomain: Number.isFinite(+body.destDomain) ? +body.destDomain : null,
    amount: null,
    recipient: null,
  };
  await kv.put(key, JSON.stringify(rec), { expirationTtl: TTL });
  return jr({ relayer: 'on', status: 'queued' });
}

export const onRequestGet = () => jr({ error: 'POST only' }, 405);
