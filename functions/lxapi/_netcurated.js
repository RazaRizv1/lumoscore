// ADMIN-CURATED XRPL AND NEAR TOKENS (RAZA 2026-11-24, on the admin Assets page: "when we add asset, why isnt it
// showing the network selection" -- then "Yes, build it").
//
// Until now an XRPL token was curated by adding it to ALLOW in _unvouched.js, and a NEAR token by
// _tools/nearcurated.generated.json in the NEAR repo -- both baked into code, so curating one meant a code change
// and a release. Admin's "Add asset" now writes here instead, and the endpoints that decide what is curated read
// this list ON TOP OF their built-in one:
//   XRPL  _unvouched.js loadVouched(env): vouched() ticks it, vouchedTokens() lists it on Trade (xrpltokens.js)
//   NEAR  nearCuratedSync(env, CURATED, cb): adds the row to the imported CURATED array every NEAR endpoint uses
// Stored in CONTENT_KV (bound on the public site AND admin, like the Stellar curated list in assetmeta.js), one
// JSON array per network. Written only by functions/lxapi/netcurated.js, which checks the admin first.
const KEY = { xrpl: 'netcurated:xrpl', near: 'netcurated:near' };
const TTL = 60000;
const memo = {};

export const NETCURATED_NETS = Object.keys(KEY);

// The list for one network. Read at most once a minute per isolate. A failed read is never remembered as an
// empty list: the last good one is used, or nothing extra this time and a fresh try on the next request.
export async function readNetCurated(env, net) {
  const kv = env && env.CONTENT_KV;
  if (!kv || !KEY[net]) return [];
  const m = memo[net];
  if (m && Date.now() - m.at < TTL) return m.rows;
  try {
    const j = await kv.get(KEY[net], 'json');
    const rows = Array.isArray(j) ? j : [];
    memo[net] = { at: Date.now(), rows };
    return rows;
  } catch (e) {
    return m ? m.rows : [];
  }
}

export async function writeNetCurated(env, net, rows) {
  await env.CONTENT_KV.put(KEY[net], JSON.stringify(rows));
  memo[net] = { at: Date.now(), rows };
}

// NEAR: merge the admin-curated rows into the CURATED array a NEAR endpoint imported from _nearcurated.js. Rows
// added here carry _nc:1 (NOT x: built-in rows use x for their X profile link), so one removed in admin is taken back out on the next read. cb(row, true|false) lets an
// endpoint keep a lookup it built from CURATED at load time (id -> row) in step.
export async function nearCuratedSync(env, CURATED, cb) {
  let rows;
  try { rows = await readNetCurated(env, 'near'); } catch (e) { return; }
  const want = new Map();
  for (const r of rows) if (r && r.i) want.set(String(r.i), r);
  for (let k = CURATED.length - 1; k >= 0; k--) {
    const c = CURATED[k];
    if (c && c._nc && !want.has(c.i)) { CURATED.splice(k, 1); if (cb) cb(c, false); }
  }
  for (const [i, r] of want) {
    if (CURATED.some((c) => c && c.i === i)) continue;
    const row = { i, s: String(r.s || i), n: String(r.n || r.s || i), d: Number(r.d) || 0, logo: String(r.logo || ''),
      st: 0, v: 0, _nc: 1 };
    if (r.w) row.w = String(r.w);
    CURATED.push(row);
    if (cb) cb(row, true);
  }
}
