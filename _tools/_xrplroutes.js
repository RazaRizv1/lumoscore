// The XRPL routes of the combined site, in ONE place.
//
// They are not in extract_site.js's ROUTES table -- XRPL pages are the other repo's build, copied in
// by _mergexrpl.js and served by _redirects 200-rewrites to /x/<file>. But two different parts of the
// build need to know these paths:
//
//   _mergexrpl.js     writes them into dist/_redirects
//   extract_site.js   teaches the middleware to recognise them, so an XRPL page gets the SEO head
//                     every Stellar page gets (see the xrplPage branch there)
//
// They lived only in _mergexrpl.js, and the middleware's match() therefore returned `next()` for
// every one of them -- so no XRPL page carried og:image or a canonical, and every XRPL share card
// was unreachable by a crawler while the endpoint serving it worked perfectly. The id pattern for
// the XRPL cards had already drifted once by being written down twice; this is the same shape of
// mistake, so the table is shared rather than copied.
//
// Chain-scoped paths ONLY. XRPL's own _redirects also claims /dashboard, /bridge, /wallet, /rewards,
// /mcp and /launchpad -- the chain-neutral paths, which in a merged site belong to Stellar.
const ROUTES = [
  ['/trade/xrpl/:asset', 'lumoscore-dex-asset'],
  ['/trade/xrpl', 'lumoscore-dex'],
  ['/pools/xrpl/id/:pool', 'lumoscore-amm-pool'],
  ['/pools/xrpl/:a/:b', 'lumoscore-amm-pool'],
  ['/pools/xrpl', 'lumoscore-amm'],
  ['/account/xrpl/:address', 'lumoscore-account'],
  ['/bridge/xrpl', 'lumoscore-bridge'],
  ['/rewards/xrpl', 'lumoscore-rewards-dark'],
  ['/lumos/xrpl', 'lumoscore-lumos-token'],
];

// Each path as a regex SOURCE STRING, for `new RegExp(s)` at runtime.
//
// Strings, and deliberately free of backslashes: this list is emitted into the middleware through a
// TEMPLATE LITERAL, which eats a backslash on the way out -- the bug that has already broken the
// built launchpad bundle once by turning /^https?:(backslash)/(backslash)// into /^https?:\/\/\//.
// `[^/]+` needs no escape, and a literal `/` needs none inside new RegExp.
const PATTERNS = ROUTES.map(([p]) => '^' + p.split('/').map((seg) => (seg.charAt(0) === ':' ? '[^/]+' : seg)).join('/') + '$');

module.exports = { ROUTES, PATTERNS };
