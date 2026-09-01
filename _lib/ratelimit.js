// A per-IP rate limiter for the endpoints that write to D1 without any authentication.
//
// WHY THESE ENDPOINTS CANNOT SIMPLY BE AUTHENTICATED. /lxapi/ev and /lxapi/act exist precisely
// because the browser is the only witness to what they record -- a wallet connecting, and a free
// operation (pool create, deposit, withdraw, limit order) that pays us nothing and leaves no on-chain
// marker tying it to us. There is nobody to authenticate: the visitor is anonymous by design, and any
// secret shipped to the page to prove "this came from our site" is readable by anyone who views
// source. So the answer is not a login, it is a ceiling.
//
// WHAT THIS ACTUALLY BUYS. Without it, one script could hold a connection open and write rows as fast
// as the network allows: an unbounded D1 table, a distorted admin dashboard, and a bill. With it the
// cost of doing that is capped per source address. It does not, and cannot, stop a distributed writer
// -- it is a ceiling on volume, not a proof of authenticity.
//
// BEST-EFFORT ON PURPOSE, matching support.js. If KV is unavailable the write proceeds: these are
// fire-and-forget beacons, and silently losing real activity because the limiter's own store hiccuped
// would be a worse failure than letting some extra rows through. Same reason nothing here throws.
//
// Cloudflare sets cf-connecting-ip itself and it cannot be spoofed by the client -- unlike
// x-forwarded-for, which is why that header is not consulted.

// Returns { ok:true } to proceed, or { ok:false, reason } to refuse.
//
//   kv      CONTENT_KV binding (may be undefined -- then this always allows)
//   ip      request.headers.get('cf-connecting-ip')
//   ns      short namespace so two endpoints never share a counter ('ev', 'act')
//   perMin  writes allowed from one IP in a rolling minute bucket
//   perHour writes allowed from one IP in a rolling hour bucket
export async function rateLimit(kv, ip, ns, perMin, perHour) {
  if (!kv || !ip || ip === 'unknown') return { ok: true };
  try {
    const now = Date.now();
    const mKey = ns + ':rl:m:' + ip + ':' + Math.floor(now / 60000);
    const hKey = ns + ':rl:h:' + ip + ':' + Math.floor(now / 3600000);
    const [mRaw, hRaw] = await Promise.all([kv.get(mKey), kv.get(hKey)]);
    const m = parseInt(mRaw || '0', 10) || 0;
    const h = parseInt(hRaw || '0', 10) || 0;
    if (m >= perMin) return { ok: false, reason: 'rate' };
    if (h >= perHour) return { ok: false, reason: 'rate' };
    // Counted before the write rather than after, so a burst that arrives together still lands inside
    // the ceiling. KV is eventually consistent, so this is approximate by nature -- which is fine for a
    // ceiling and would not be fine for anything that had to be exact.
    // TTLs run one bucket long so a counter cannot outlive the window it belongs to.
    await Promise.all([
      kv.put(mKey, String(m + 1), { expirationTtl: 120 }),
      kv.put(hKey, String(h + 1), { expirationTtl: 3700 }),
    ]);
    return { ok: true };
  } catch (_) {
    return { ok: true };
  }
}
