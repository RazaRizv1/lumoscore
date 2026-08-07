// Server-side proxy for the Soroswap aggregator.
//
// The API key used to be a literal in the page source — it shipped to every visitor in 16 built HTML
// files. Anything a browser receives is public, so the only real fix is to never send it: the browser
// now calls THIS endpoint, and the key is attached here from a Cloudflare secret.
//
// Set the secret once (never commit it, never put it in the repo):
//   npx wrangler pages secret put SOROSWAP_KEY --project-name=lumoscore
//
// Deliberately narrow, so this cannot become an open relay for someone else's traffic:
//   * POST only
//   * exactly three upstream paths, allow-listed by name
//   * only the "network" query parameter is forwarded
//   * only Content-Type is forwarded from the caller; any Authorization they send is ignored
//
// NOTE ON /send: it submits an ALREADY-SIGNED transaction. The signature is produced in the user's
// own wallet and cannot be altered here, so this proxy can relay or refuse a swap but never authorise
// one. It must not be able to sign, and it does not.
const ALLOWED = new Set(['quote', 'quote/build', 'send']);
const UPSTREAM = 'https://api.soroswap.finance';

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export async function onRequest(context) {
  const { request, env, params } = context;

  if (request.method !== 'POST') {
    return json(405, { error: 'method not allowed' });
  }

  const path = (Array.isArray(params.path) ? params.path.join('/') : String(params.path || ''));
  if (!ALLOWED.has(path)) {
    return json(404, { error: 'unknown endpoint' });
  }

  const key = env.SOROSWAP_KEY;
  if (!key) {
    // explicit, so a missing secret shows up as a clear failure rather than silently
    // degrading routing to Horizon-only with no explanation
    return json(503, { error: 'SOROSWAP_KEY is not configured on this deployment' });
  }

  // carry through only the network selector
  const net = new URL(request.url).searchParams.get('network') || 'mainnet';
  const upstream = UPSTREAM + '/' + path + '?network=' + encodeURIComponent(net);

  let body;
  try { body = await request.text(); } catch (e) { return json(400, { error: 'unreadable body' }); }
  if (body.length > 200000) return json(413, { error: 'body too large' });

  try {
    const r = await fetch(upstream, {
      method: 'POST',
      headers: {
        'authorization': 'Bearer ' + key,
        'content-type': 'application/json',
        'accept': 'application/json',
      },
      body,
    });
    const text = await r.text();
    return new Response(text, {
      status: r.status,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  } catch (e) {
    return json(502, { error: String((e && e.message) || e) });
  }
}
