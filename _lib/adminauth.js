// Gate for every admin WRITE endpoint.
//
// THE TRAP THIS EXISTS TO CLOSE: functions/ is shared by all three Pages projects. A file added there
// is deployed to lumoscore.com and lumoscore-staging.pages.dev as well as the admin project. So an
// endpoint that writes blog posts or asset descriptions is, by default, a world-writable endpoint on
// the PUBLIC site -- Access on the admin host does nothing for it. Every write handler must call
// requireAdmin() first.
//
// Two conditions, both required:
//   1. The request arrived on the admin project's hostname. On lumoscore.com there is no Access in
//      front, so there is no token to present and the write is refused outright.
//   2. It carries a Cloudflare Access JWT that VERIFIES against our own team's public keys.
//
// Presence of the header is NOT enough on its own -- a header can be sent by anyone. The signature is
// checked with WebCrypto against the team's published certs, along with issuer and expiry, so a forged
// or replayed token fails.
const TEAM = 'https://soft-rice-4ac1.cloudflareaccess.com';
const CERTS = TEAM + '/cdn-cgi/access/certs';
const ADMIN_HOST_SUFFIX = 'lumoscore-admin.pages.dev';

// THE ADMIN APPLICATION'S OWN AUDIENCE TAG, and the reason it is checked.
//
// Every Access application in an account issues tokens signed by the SAME team keys, with the same
// issuer. What distinguishes one application's token from another's is the aud claim. Without this
// check the verification above proves only "somebody in this Cloudflare account signed in somewhere"
// -- so a token minted for a DIFFERENT Access app would sail through here.
//
// That is not hypothetical: this account already has a second app in front of lumoscore-staging,
// whose audience is 3a12fe1d… Anyone who can reach staging holds a token that, until now, this gate
// would have accepted as an admin's.
//
// Taken from the admin app's own Access login redirect, which publishes it in the meta parameter, so
// it is the value Cloudflare itself uses rather than one copied by hand. If the Access application is
// ever deleted and recreated the tag changes, and the panel locks out until this is updated -- which
// is the correct direction to fail.
const ADMIN_AUD = 'c90b244d84522ddc47afcee730618e3cf3de28cdd4ae86d5a2832ab0133f3b4a';

let CERT_CACHE = null, CERT_AT = 0;
const CERT_TTL = 3600000;   // keys rotate rarely; an hour keeps this off the hot path

function b64urlToBytes(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64urlToString(s) { return new TextDecoder().decode(b64urlToBytes(s)); }

async function keys() {
  const now = Date.now();
  if (CERT_CACHE && (now - CERT_AT) < CERT_TTL) return CERT_CACHE;
  const r = await fetch(CERTS, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!r.ok) throw new Error('certs unavailable');
  const d = await r.json();
  CERT_CACHE = (d && d.keys) || [];
  CERT_AT = now;
  return CERT_CACHE;
}

async function verifyJwt(token) {
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  let header, payload;
  try {
    header = JSON.parse(b64urlToString(parts[0]));
    payload = JSON.parse(b64urlToString(parts[1]));
  } catch (_) { return null; }
  if (header.alg !== 'RS256') return null;                       // never trust alg:none or a swap to HS256

  const jwks = await keys();
  const jwk = jwks.filter((k) => k.kid === header.kid)[0];
  if (!jwk) return null;

  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64urlToBytes(parts[2]),
    new TextEncoder().encode(parts[0] + '.' + parts[1])
  );
  if (!ok) return null;

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) return null;
  if (payload.nbf && payload.nbf > now) return null;
  if (payload.iss && payload.iss.indexOf(TEAM) !== 0) return null;

  // aud is an ARRAY in a Cloudflare Access token, not a string -- one entry per application the token
  // is good for. Both shapes are handled because the spec permits either, and reading an array as a
  // string here would silently reject every real token.
  const aud = payload.aud;
  const list = Array.isArray(aud) ? aud : (aud ? [aud] : []);
  if (list.indexOf(ADMIN_AUD) < 0) return null;

  return payload;
}

// The verified payload of the request currently being handled, so the audit trail can record WHO did
// something without verifying the token a second time.
//
// A WeakMap keyed on the Request rather than a module-level variable: a Worker isolate handles many
// requests and can interleave them, and a shared "current admin" would eventually attribute one
// person's action to another. Keyed this way an entry cannot outlive its request or be read by a
// different one, and it is collected with it.
const VERIFIED = new WeakMap();

// The signed-in admin's email for this request, or '' if there is none. Only ever populated by
// requireAdmin() after the token verified, so it cannot be influenced by anything a caller sent.
export function adminActor(request) {
  const p = VERIFIED.get(request);
  return (p && (p.email || p.sub)) || '';
}

// Returns null when the caller is a verified admin, or a Response to return as-is when they are not.
export async function requireAdmin(request) {
  const host = new URL(request.url).hostname;
  if (host !== ADMIN_HOST_SUFFIX && !host.endsWith('.' + ADMIN_HOST_SUFFIX)) {
    // The endpoint exists on the public origins too, because functions/ is shared. Say nothing useful.
    return deny('not available here');
  }
  const token = request.headers.get('Cf-Access-Jwt-Assertion')
    || cookie(request, 'CF_Authorization');
  if (!token) return deny('no access token');
  let payload;
  try { payload = await verifyJwt(token); } catch (_) { return deny('verification failed'); }
  if (!payload) return deny('invalid access token');
  VERIFIED.set(request, payload);
  return null;
}

function cookie(request, name) {
  const raw = request.headers.get('Cookie') || '';
  const parts = raw.split(';');
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i].trim();
    if (p.indexOf(name + '=') === 0) return p.slice(name.length + 1);
  }
  return '';
}

function deny(reason) {
  return new Response(JSON.stringify({ error: 'forbidden', reason }), {
    status: 403,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
