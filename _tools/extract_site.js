const fs = require('fs');
const path = require('path');

function read(f){ return fs.readFileSync(f, 'utf8'); }
function getContents(data){
  const i = data.indexOf('id="designContents"');
  const s = data.indexOf('>', i) + 1;
  const e = data.indexOf('</script>', s);
  return JSON.parse(data.slice(s, e));
}

const BS = String.fromCharCode(92); // backslash

// Standalone runtime injected into every extracted page:
//  - real window.lxNavigate (picks the candidate matching this page's desktop/mobile variant)
//  - inert guard: links to pages not shipped in this folder, or bare "#", do nothing (no 404, no jump)
// old build filename -> clean url. Derived from ROUTES so there is one source of truth.
// Used at RUNTIME (lxNavigate + click) because most navigation here is built dynamically in JS;
// the static hrefs are additionally rewritten at build time so crawlers follow clean urls too.
function cleanMapJson(){
  const m = {};
  for(const [url, file] of ROUTES){
    if(/:/.test(url)) continue;                     // dynamic routes are handled by query conversion
    // key on the BASE name: /rewards is served by lumoscore-rewards-dark.html, but links to it appear
    // as -dark, -light and -mobile, and every one of them is the same page.
    m[file.replace(/\.html$/, '').replace(/-(dark|light|mobile)$/, '')] = url;
  }
  m['lumoscore-landing'] = '/';
  // dynamic routes with no identifier in the link fall back to the list page
  m['lumoscore-dex-asset'] = '/trade/stellar';
  m['lumoscore-account']   = '/account/stellar';
  // asset-overview was REMOVED — it duplicated Trade-asset without the ability to act on what it
  // showed. Anything still pointing at it resolves to the Trade page instead.
  m['lumoscore-asset-overview'] = '/trade/stellar';
  return JSON.stringify(m);
}

function runtime(validArray){
  const VALID = JSON.stringify(validArray);
  return '<script>(function(){if(window.__lxSite)return;window.__lxSite=1;'
    + 'var CLEAN=' + cleanMapJson() + ';'
    // Turn "lumoscore-x[-dark|-light|-mobile].html?query" into its clean url. Theme and device are no
    // longer part of a url, so those suffixes are dropped. An unmapped file is returned untouched
    // rather than guessed at, so nothing can navigate somewhere that does not exist.
    + 'function lxClean(u){ if(typeof u!=="string"||u.indexOf("lumoscore-")!==0)return u;'
    + '  var q="",h="",i=u.indexOf("#"); if(i>=0){h=u.slice(i);u=u.slice(0,i);}'
    + '  i=u.indexOf("?"); if(i>=0){q=u.slice(i+1);u=u.slice(0,i);}'
    + '  var base=u.replace(/'+BS+'.html$/,"").replace(/-(dark|light|mobile)$/,"");'
    + '  var p=new URLSearchParams(q), a=p.get("asset");'
    // the two dynamic routes: an ?asset= becomes a path segment
    + '  if(base==="lumoscore-account")        return a?("/account/stellar/"+a+h):("/account/stellar"+h);'
    + '  if(base==="lumoscore-dex-asset")      return a?("/trade/stellar/"+a+h):("/trade/stellar"+h);'
    + '  if(base==="lumoscore-asset-overview") return a?("/trade/stellar/"+a+h):("/trade/stellar"+h);'
    // a pool is addressed by its two assets, which a ?pool=<id> link does not carry — leave it alone
    + '  if(base==="lumoscore-amm-pool")       return u+(q?("?"+q):"")+h;'
    + '  var c=CLEAN[base]; if(!c)return u+(q?("?"+q):"")+h;'
    + '  return c+(q?("?"+q):"")+h; }'
    + 'window.lxCleanUrl=lxClean;'
    + 'var self=(location.pathname.split("/").pop()||"");'
    // Cloudflare Pages 308-redirects /foo.html -> /foo, so the extension is NOT present at runtime on
    // a hosted deploy (it is on localhost). Matching only "-mobile.html" made every mobile visitor look
    // like a desktop one and sent them to desktop pages. Accept both forms.
    + 'var MOB=/-mobile('+BS+'.html)?$/.test(self);'
    + 'var VALID=' + VALID + ';'
    + 'window.lxNavigate=function(c){if(typeof c==="string")c=[c];var p=null;'
    // 1) candidate matching this device (desktop/mobile) AND that actually exists
    + 'for(var i=0;i<c.length;i++){var f=c[i];if(MOB===/-mobile'+BS+'.html$/.test(f)&&VALID.indexOf(f)>=0){p=f;break;}}'
    // 2) any candidate that exists
    + 'if(!p)for(var j=0;j<c.length;j++){if(VALID.indexOf(c[j])>=0){p=c[j];break;}}'
    // 3) device-matching even if not in VALID, else first
    + 'for(var k=0;!p&&k<c.length;k++){var g=c[k];if(MOB===/-mobile'+BS+'.html$/.test(g)){p=g;break;}}'
    // candidate selection above works on FILENAMES (that is what VALID holds); only the final
    // destination is converted to its clean url
    + 'if(!p)p=c[0];if(p){location.href=lxClean(p);}return true;};'
    + 'document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a");if(!a)return;'
    + 'var h=a.getAttribute("href")||"";'
    + 'if(h==="#"||h==="#!"){e.preventDefault();return;}'
    // strip query/hash before the existence check — without this, "…dex-asset.html?asset=X" never
    // matched the guard at all, so a link to a page not shipped here would 404 instead of going inert
    + 'var hb=h.split("?")[0].split("#")[0];'
    + 'if(/^lumoscore-['+BS+'w-]+'+BS+'.html$/.test(hb)&&VALID.indexOf(hb)<0){e.preventDefault();return;}'
    // anything still pointing at a build filename navigates to the clean url instead
    + 'if(/^lumoscore-['+BS+'w-]+'+BS+'.html/.test(h)){var cl=lxClean(h);'
    + 'if(cl!==h){e.preventDefault();location.href=cl;}}'
    + '},true);'
    // __lxNav is a SECOND navigation helper used by onclick="" handlers across many transforms, and
    // it was never mapped — that is why clicking Dashboard still landed on lumoscore-home.html.
    // Wrapped lazily on an interval because the transforms that define it run after this runtime.
    + 'var wrapped=0,tries=0;var iv=setInterval(function(){tries++;'
    + 'if(typeof window.__lxNav==="function"&&!window.__lxNav.__lxc){'
    + 'var o=window.__lxNav;var w=function(u){return o.call(this,lxClean(u));};w.__lxc=1;'
    + 'window.__lxNav=w;wrapped=1;}'
    + 'if(wrapped||tries>40)clearInterval(iv);},50);'
    + '})();</scr' + 'ipt>'
    // light-theme was missing --surface-3 (elevated surface), leaving the account-widget wallet chip dark in light mode
    + '<style id="lx-themefix">html[data-theme="light"]{--surface-3:#ffffff}</style>'
    // The site tooltip renders ABOVE its trigger (bottom:calc(100% + 8px)). #themeToggle sits in the
    // header, so above is off the top of the viewport and all the reader sees is the arrow. The design
    // already ships a below variant as [data-tooltip-pos="below"], but setting that attribute means
    // editing the toggle's markup in every container; one rule here reaches all 30 pages that have it.
    // The arrow flips with it -- border-top drew it pointing down at a tooltip now underneath.
    + '<style id="lx-tiptheme">'
    + '#themeToggle[data-tooltip]::before{bottom:auto;top:calc(100% + 8px);transform:translateX(-50%) translateY(-2px)}'
    + '#themeToggle[data-tooltip]::after{bottom:auto;top:calc(100% + 2px);transform:translateX(-50%) translateY(-2px);'
    + 'border-top:0;border-bottom:5px solid var(--text)}'
    + '#themeToggle[data-tooltip]:hover::before,#themeToggle[data-tooltip]:hover::after,'
    + '#themeToggle[data-tooltip]:focus-visible::before,#themeToggle[data-tooltip]:focus-visible::after'
    + '{transform:translateX(-50%) translateY(0)}'
    + '</style>';
}

// Clean URLs put pages at depth (/trade/stellar/<ASSET>), where a relative "assets/x.png" resolves to
// /trade/stellar/assets/x.png and 404s. Every asset reference is therefore rooted at build time.
// A <base href="/"> would be one line, but it also rewrites every bare "#" anchor into a navigation
// to "/", and this design uses href="#" widely — so rewriting the references is the safe fix.
function rootRelative(html){
  return html
    .replace(/(\s(?:src|href|poster|data-src)=")assets\//g, '$1/assets/')
    .replace(/(\ssrcset=")assets\//g, '$1/assets/')
    .replace(/url\((['"]?)assets\//g, 'url($1/assets/');
}

// Rewrite literal href="lumoscore-x.html" to the clean url at build time. The runtime mapper already
// handles clicks, but a crawler never clicks — it reads hrefs. Only exact matches (quote immediately
// after .html) are touched, so the JS string concatenations that build "…?asset='+code" are left alone
// and handled at runtime instead.
function cleanLinks(html){
  const map = JSON.parse(cleanMapJson());
  return html.replace(/href="(lumoscore-[a-z0-9-]+)\.html"/g, (full, base) => {
    const key = base.replace(/-(dark|light|mobile)$/, '');
    const clean = map[key];
    return clean ? 'href="' + clean + '"' : full;
  });
}

// THE TOKEN REGISTRY, BAKED IN AT BUILD TIME.
//
// Every page resolved a LumosCore token's logo by FETCHING this same file at runtime, which meant the
// first paint had no URL yet and drew the letter avatar, then swapped it for the real logo a moment
// later. Two paints is one visible flash, on every page and every asset. Fetching earlier does not fix
// that -- only knowing the answer synchronously does.
//
// So it is emitted into <head>, before any data layer runs, exactly like window.__lxRoute. The runtime
// lookup becomes a property read and the avatar is never painted for a token we have.
//
// Read from assets/tokens/ (the source the build copies into dist/), so it is always whatever
// _tools/_launchicons.js last wrote. A missing or unreadable file yields {} and every page falls back to
// the behaviour it had before, rather than failing the build.
function tokenRegistry(){
  try{
    const raw = fs.readFileSync(path.join(__dirname, '..', 'assets', 'tokens', 'launchpad-icons.json'), 'utf8');
    const m = JSON.parse(raw);
    if(!m || typeof m !== 'object' || Array.isArray(m)) return {};
    const out = {};
    for(const k of Object.keys(m)){
      const v = m[k];
      const img = (v && typeof v === 'object') ? v.image : v;
      const name = (v && typeof v === 'object' && typeof v.name === 'string') ? v.name : '';
      // same-origin absolute path only -- the page interpolates this into url(), so a value naming
      // another host would let one bad write repoint every icon on the site
      if(typeof img === 'string' && img.charAt(0) === '/' && img.indexOf('//') !== 0) out[k] = { image: img, name: name };
      else if(name) out[k] = { image: '', name: name };
    }
    return out;
  }catch(e){ return {}; }
}
const TOKEN_REG_JSON = JSON.stringify(tokenRegistry());

function injectTokenRegistry(html){
  // Guard on the ASSIGNMENT, not the bare name: the data layers mention __lxTokenRegistry in their
  // comments, so a name test matched every page and silently skipped the injection entirely.
  if(html.indexOf('window.__lxTokenRegistry=') >= 0) return html;
  // Also seed window.__lxLogos, the shared cache every wallet icon path reads (lpIco, ilogo, actBg,
  // selectSendAsset, the harvesters). It lives in ITS OWN head script, deliberately: the first attempt
  // spliced this into _walletdata.js's own script string, and when the wallet then reported broken row
  // clicks and a dead kebab menu I could not clear my own change -- the My Assets table only renders for
  // a real account, so there was nothing local to click. Here it cannot interact with that script at all.
  // Seeds only empty slots, so a harvested per-issuer result still wins, and the wallet's own
  // "window.__lxLogos=window.__lxLogos||{}" preserves whatever is already here.
  const tag = '<script>window.__lxTokenRegistry=' + TOKEN_REG_JSON + ';'
    + '(function(){try{var R=window.__lxTokenRegistry,L=(window.__lxLogos=window.__lxLogos||{});'
    + 'for(var k in R){if(!Object.prototype.hasOwnProperty.call(R,k))continue;'
    + 'var d=k.indexOf("-");if(d<1)continue;var c=k.slice(0,d),u=R[k]&&R[k].image;'
    + 'if(typeof u==="string"&&u.charAt(0)==="/"&&u.indexOf("//")!==0&&!L[c])L[c]=u;}}catch(e){}})();'
    // Wallet: clicking a My Assets row, or View asset in its row menu, opens Trade-Asset.
    //
    // This lives in <head> rather than in _walletdata.js for a reason found the hard way: that script
    // returns early when no account is connected, so an IIFE placed inside it never executed and the
    // handler was silently absent. Function declarations hoist past that; statements do not. From here
    // it is attached before anything else runs and cannot be gated.
    //
    // Delegated, so it survives the table being re-rendered, and scoped to #assetsTable and .row-menu,
    // which exist only on the wallet page -- so it is inert everywhere else.
    + '(function(){if(document.__lxRowNav)return;document.__lxRowNav=1;'
    + 'function go(c,i){if(!c)return;window.location.href=(c==="XLM")?"lumoscore-dex.html":("lumoscore-dex-asset.html?asset="+encodeURIComponent(c)+(i?("-"+i):""));}'
    + 'document.addEventListener("click",function(e){'
    + 'if(!e.target||!e.target.closest)return;'
    + 'var mb=e.target.closest(".row-menu button");'
    + 'if(mb&&/view/i.test(mb.textContent||"")){var a=window.__lxActiveAsset||{};if(a.code){e.preventDefault();e.stopPropagation();go(a.code,a.iss);}return;}'
    // everything interactive keeps its own behaviour: Trade, Send, Trustline, the kebab, the issuer copy
    + 'if(e.target.closest("button,a,input,select,[class*=copy],[data-copy]"))return;'
    + 'var row=e.target.closest("#assetsTable tbody tr");if(!row)return;'
    + 'var ico=row.querySelector(".lx-aico");if(!ico)return;'
    + 'go(ico.getAttribute("data-lxc")||"",ico.getAttribute("data-lxi")||"");'
    + '},true);})();'
    + '</scr'+'ipt>'
    + '<style>#assetsTable tbody tr{cursor:pointer}</style>';
  const hi = html.indexOf('<head>');
  if(hi >= 0) return html.slice(0, hi + 6) + tag + html.slice(hi + 6);
  const he = html.indexOf('</head>');
  if(he >= 0) return html.slice(0, he) + tag + html.slice(he);
  return html;   // no head at all -> leave the page exactly as it was
}

function injectRuntime(html, validArray){
  if(html.indexOf('window.__lxSite')>=0) return html;
  const rt = runtime(validArray);
  const bi = html.lastIndexOf('</body>');
  return bi>=0 ? html.slice(0,bi)+rt+html.slice(bi) : html+rt;
}

// "/" must BE the landing page, not a shim that bounces to /lumoscore-landing — otherwise the site's
// front door is a redirect, the clean url is pointless, and search engines index the wrong address.
// So index.html is a copy of the landing page itself, with one small script that swaps to the mobile
// build. That swap is still a redirect on phones; it goes away once device is resolved at the edge.
// No client-side device swap here any more: the edge picks desktop vs mobile from the User-Agent and
// serves both at the same url. A width-based redirect would undo that — a desktop window narrower than
// 760px would bounce to /lumoscore-landing-mobile, recreating the second url the whole design avoids.
function indexHtml(landingHtml){
  return landingHtml;
}

// The admin panel must never land in the public build.
//
// This is a static site: the server hands any file it holds to anyone who asks, and every admin page
// carries its logic in readable JavaScript. A password checked in that JavaScript is not a gate, and
// an unlinked URL is not a secret (history, referrers, crawlers). The only reliable protection for a
// static site is to NOT SHIP THE FILE. So the public build simply omits every lumoscore-admin-* page,
// and `--admin` writes them to a separate folder that is never the public root.
//
// Note this hides the PANEL, not the numbers: the fee collector's payment history is public on-chain
// and readable on stellar.expert by anyone. What is protected is the admin UI and its write actions.
const ADMIN_RE = /^lumoscore-admin-/;

// _authgate.js puts a "no wallet connected -> location.replace('lumoscore-landing.html')" guard in the
// head of every in-app page. That is correct for the public site and fatal for the admin one: the admin
// origin is a separate Pages project that contains ONLY admin pages, so there is no landing page to
// land on and every route 404s unless a wallet happens to be in that origin's localStorage. The admin
// panel is gated by Cloudflare Access instead, which authenticates before any HTML is served.
// _authgate.js no longer gates admin pages; this strips any guard already baked into the containers.
// Pages that are built by the design but must NOT ship. asset-overview duplicated Trade-asset — same
// price, holders, pools and trustlines, but read-only — so it was removed rather than maintained
// twice. Dropping the FILE (not just the route) is what makes that real: a stray link to
// lumoscore-asset-overview.html cannot quietly keep working. Everything pointing at it is redirected:
// the clean map and lxClean send it to /trade/stellar, legacyClean 301s the raw filename, and the
// middleware 301s /asset/stellar/<ASSET> for urls already published in the sitemap.
// admin-create-pool came with the design and was never wired: no submit handler, and nothing behind
// its Validate or Save-draft buttons. There is also nothing for it to do. Pools are not imported --
// lxapi/pools reads the network live from Horizon, so a pool appears because it exists on-chain --
// and creating one is an on-chain operation signed by a wallet, which is the public Pools section,
// not a panel with no signing key. Its fields were token fields anyway, duplicating the Assets page.
const DROPPED = new Set(['lumoscore-asset-overview', 'lumoscore-admin-create-pool']);
function isDropped(name){
  let b = name.replace(/\.html$/, '');
  let prev;
  do { prev = b; b = b.replace(/-(dark|light|mobile)$/, ''); } while (b !== prev);
  return DROPPED.has(b);
}

function stripAuthGate(h){
  return h.replace(/<script id="lx-authgate">[\s\S]*?<\/script>/g, '');
}

// Cloudflare Pages reads _headers from the deployed directory. Emitted by the build so a rebuild
// never silently drops them.
//
// X-Frame-Options DENY matters more than usual here: this app asks a wallet to sign transactions, and
// a framed signing prompt is a clickjacking target. Verified nothing in the build frames its own pages.
// No CSP — the design carries hundreds of inline <script> and style attributes, so any useful policy
// would need 'unsafe-inline' and buy nothing. Adding a real CSP means moving that inline code out first.
function headersFile(isAdmin){
  const common =
      '  X-Content-Type-Options: nosniff\n'
    + '  X-Frame-Options: DENY\n'
    + '  Referrer-Policy: strict-origin-when-cross-origin\n'
    + '  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()\n';
  if(isAdmin){
    // belt and braces: the admin site is behind Cloudflare Access, but if a policy is ever
    // misconfigured this at least keeps it out of search results.
    //
    // The public build tells browsers to revalidate HTML; the admin build said nothing, so pages were
    // cached at the browser's discretion. A rebuilt admin screen then kept showing the OLD one after a
    // deploy, which is indistinguishable from the deploy having failed and cost a round of debugging.
    // no-store rather than must-revalidate: this is a single-operator internal tool where being one
    // deploy behind is far more expensive than a re-fetch, and the pages carry account data anyway.
    return '/*\n' + common + '  X-Robots-Tag: noindex, nofollow, noarchive\n'
      + '\n/*.html\n  Cache-Control: no-store\n'
      + '\n/\n  Cache-Control: no-store\n';
  }
  return '/*\n' + common
    + '\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n'
    // The token-icon manifest lives under /assets/ but is the one file there that CHANGES: every new
    // launchpad logo rewrites it. Left immutable, a visitor who loaded it once keeps that copy for a
    // YEAR and never sees a logo added afterwards -- which is exactly what happened: four logos went
    // live, served 200, and still rendered as letter tiles because the browser never re-asked for the
    // index naming them. Cloudflare applies every matching rule and the LAST one wins, so this must
    // stay below /assets/*.
    + '\n/assets/tokens/launchpad-icons.json\n  Cache-Control: public, max-age=60, must-revalidate\n'
    + '\n/*.html\n  Cache-Control: public, max-age=0, must-revalidate\n';
}

// Without this, Cloudflare Pages falls back to index.html with a 200 for ANY unmatched path — so a
// mistyped or probed URL silently returns the landing page and looks like a hit. A real 404.html makes
// Pages answer with an actual 404, which is both correct and stops a prober from inferring anything.
// ---- clean URLs -------------------------------------------------------------------------------
// The public URL scheme. Left side is what visitors and search engines see; right side is the file
// that actually answers. Cloudflare Pages reads _redirects from the deployed directory; status 200
// means REWRITE (serve that file at this URL, address bar unchanged) rather than redirect.
//
// Ordering matters: Pages applies the FIRST matching rule, so more specific paths must come first.
// Placeholders (:name) match a single segment. Theme never appears in a URL — light and dark are the
// same page — and device is resolved server-side, not by a separate URL.
const ROUTES = [
  // dynamic first: these carry an asset or pool identifier in the path
  ['/trade/stellar/:asset',            'lumoscore-dex-asset.html'],
  ['/trade/stellar',                   'lumoscore-dex.html'],
  ['/account/stellar/:address',        'lumoscore-account.html'],
  ['/pools/stellar/id/:pool',          'lumoscore-amm-pool.html'],   // fallback: id-only links
  ['/pools/stellar/:a/:b',             'lumoscore-amm-pool.html'],
  ['/pools/stellar',                   'lumoscore-amm.html'],
  // NO /asset/stellar route. The asset-overview page was removed — it showed the same facts as
  // Trade-asset with no way to act on them. /asset/stellar/<ASSET> is now a permanent 301 to
  // /trade/stellar/<ASSET>, handled in the middleware so already-indexed urls keep their value.
  // launchpad flow: /launchpad/review must precede /launchpad
  ['/launchpad/review',                'lumoscore-launch-review.html'],
  ['/launchpad/confirm',               'lumoscore-launch-confirm.html'],
  ['/launchpad',                       'lumoscore-launch-token.html'],
  // flat pages
  ['/dashboard',                       'lumoscore-home.html'],
  ['/bridge',                          'lumoscore-bridge.html'],
  ['/wallet',                          'lumoscore-wallet.html'],
  ['/rewards',                         'lumoscore-rewards-dark.html'],   // only variant that exists
  ['/lumos/stellar',                   'lumoscore-lumos-token.html'],
  ['/lumos',                           'lumoscore-lumos-token.html'],
  ['/signin',                          'lumoscore-signin.html'],
  ['/mcp',                             'lumoscore-mcp.html'],
  ['/blog/:slug',                      'lumoscore-blog-post.html'],
  ['/blog',                            'lumoscore-blog.html'],
  ['/privacy',                         'lumoscore-privacy.html'],
  ['/terms',                           'lumoscore-terms.html'],
  ['/support',                         'lumoscore-support.html'],
  ['/whitepaper',                      'lumoscore-whitepaper.html'],
];

// Case: fixed segments are lowercase, but an asset segment must keep its case — yUSDC and YUSDC are
// genuinely different assets on Stellar. Pages matches paths case-sensitively, so these redirects
// only forgive the fixed part.
const CASE_FIXES = [
  ['/Trade/*', '/trade/:splat'], ['/Pools/*', '/pools/:splat'],
  ['/Bridge',  '/bridge'], ['/Wallet', '/wallet'], ['/Rewards', '/rewards'],
  ['/MCP',     '/mcp'],    ['/Dashboard', '/dashboard'], ['/Launchpad', '/launchpad'],
];

function redirectsFile(){
  const L = [];
  L.push('# Clean URLs. 200 = rewrite (url stays put); 301 = permanent redirect.');
  L.push('# Generated by _tools/extract_site.js — edit the ROUTES table there, not this file.');
  L.push('');
  // Target the EXTENSIONLESS path. Pages 308-redirects /foo.html -> /foo automatically, so rewriting
  // to "/x.html" makes it answer with that 308 instead of the page — every clean url returned 308
  // until this was changed.
  for(const [from, to] of ROUTES) L.push(pad(from) + '/' + to.replace(/\.html$/, '') + '  200');
  L.push('');
  L.push('# forgive capitalised entry points');
  for(const [from, to] of CASE_FIXES) L.push(pad(from) + to + '  301');
  L.push('');
  L.push('# the landing page IS the site root, so its old path must not be a second copy of it');
  L.push(pad('/lumoscore-landing') + '/  301');
  // Deliberately NO "legacy filename -> clean url" rules: nothing has ever been deployed, so there are
  // no old links in the wild, and such a rule collides with the rewrite above and loops.
  return L.join('\n') + '\n';
}
function pad(s){ return s + ' '.repeat(Math.max(1, 42 - s.length)); }

// ---- one URL per page, device resolved at the edge -----------------------------------------------
// Desktop and mobile are genuinely different markup here, but they must NOT be different urls: a link
// copied from a phone would carry the phone layout to a desktop, and search engines would see two
// urls serving one page. So the edge picks the variant from the User-Agent and the address bar never
// changes.
//
// Vary: User-Agent is mandatory, not optional. Without it Cloudflare caches whichever variant it saw
// first and serves it to everyone — the classic way this technique breaks.
//
// _routes.json keeps the cost at zero: only these paths invoke a Function. /assets/* and every other
// static file is served directly and never counts against the Functions quota.
function middlewareJs(routePairs, mobileFiles){
  return `// GENERATED by _tools/extract_site.js — edit the ROUTES table there, not this file.
const MOBILE = /Android|iPhone|iPod|IEMobile|BlackBerry|Opera Mini|Mobile Safari|Windows Phone/i;
// [urlPattern, desktopFile, mobileFile|null] — "/" names both explicitly because its desktop file is
// index (fetching /lumoscore-landing would hit the 301 back to "/" and loop).
const ROUTES = ${JSON.stringify(routePairs, null, 2)};
const HAS_MOBILE = new Set(${JSON.stringify(mobileFiles)});

function match(pathname){
  const segs = pathname.replace(/^\\/+|\\/+$/g, '').split('/').filter(Boolean);
  for (const r of ROUTES){
    const p = r[0].replace(/^\\/+|\\/+$/g, '').split('/').filter(Boolean);
    if (p.length !== segs.length) continue;
    let ok = true;
    for (let i = 0; i < p.length; i++){
      if (p[i].startsWith(':')) continue;
      if (p[i] !== segs[i]) { ok = false; break; }
    }
    // strip a theme suffix before deriving the mobile name: /rewards is served by
    // lumoscore-rewards-dark, whose mobile build is lumoscore-rewards-mobile — NOT
    // lumoscore-rewards-dark-mobile, which does not exist.
    if (ok) return { desktop: r[1], mobile: r[2] || (r[1].replace(/-(dark|light)$/, '') + '-mobile') };
  }
  return null;
}

// ---- per-page SEO, injected at the edge ---------------------------------------------------------
// /trade/stellar/<ASSET> is ONE file serving hundreds of assets, so without this every asset page
// ships an identical title and description — duplicate content on exactly the pages that could rank.
// Crawlers that do not run JavaScript (GPTBot, ClaudeBot, PerplexityBot) see only what arrives in the
// HTML, so the runtime title the page sets for itself is invisible to them. Injecting here fixes both.
//
// The host comes from the request, so no domain is hardcoded anywhere.
const SEO_CACHE_TTL = 300;

// The site's ONE canonical origin. Every canonical/og:url points here regardless of which host served
// the request, so the *.pages.dev preview url cannot compete with the real domain in search results.
const PRIMARY_ORIGIN = 'https://lumoscore.com';

function esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmtUsd(n){
  if (n == null || !isFinite(n)) return null;
  if (n >= 1000) return '$' + Math.round(n).toLocaleString('en-US');
  if (n < 0.0001) return '$' + Number(n).toPrecision(3);
  return '$' + Number(n).toFixed(n < 1 ? 4 : 2);
}

async function assetFacts(assetId){
  try {
    const r = await fetch(
      'https://api.stellar.expert/explorer/public/asset?search=' + encodeURIComponent(assetId) + '&limit=5',
      { cf: { cacheTtl: SEO_CACHE_TTL, cacheEverything: true } });
    if (!r.ok) return null;
    const d = await r.json();
    const recs = (d && d._embedded && d._embedded.records) || [];
    const m = recs.filter(x => String(x.asset || '').indexOf(assetId) === 0)[0];
    if (!m) return null;
    const toml = m.tomlInfo || m.toml_info || {};
    return {
      code: assetId.split('-')[0],
      price: +m.price || null,
      trustlines: (m.trustlines && m.trustlines[0]) || 0,
      domain: m.domain || '',
      image: toml.image || '',
      name: toml.name || '',
    };
  } catch (e) { return null; }
}

function assetSeo(f, assetId){
  const code = f ? f.code : assetId.split('-')[0];
  const bits = [];
  const px = f && fmtUsd(f.price);
  if (px) bits.push('Price ' + px);
  if (f && f.trustlines) bits.push(f.trustlines.toLocaleString('en-US') + ' trustlines');
  if (f && f.domain) bits.push('issued by ' + f.domain);
  const facts = bits.length ? bits.join(' · ') + '. ' : '';
  return {
    title: code + ' price, pools and holders on Stellar | LumosCore',
    desc: (facts + 'Live ' + code + ' price, liquidity pools, top holders and recent trades on the '
      + 'Stellar network. Buy or sell ' + code + ' non-custodially from your own wallet.').slice(0, 300),
    image: (f && f.image) || '',
  };
}

function poolSeo(a, b){
  const A = a === 'native' ? 'XLM' : a.split('-')[0];
  const B = b === 'native' ? 'XLM' : b.split('-')[0];
  return {
    title: A + ' / ' + B + ' liquidity pool on Stellar | LumosCore',
    desc: 'Reserves, total value locked, 24h volume and fees for the ' + A + ' / ' + B
      + ' liquidity pool on Stellar. Add or withdraw liquidity from your own wallet.',
    image: '',
  };
}

function seoFor(pathname){
  const segs = pathname.split('/').filter(Boolean);
  if ((segs[0] === 'trade' || segs[0] === 'asset') && segs[2]) return { kind: 'asset', id: segs[2] };
  if (segs[0] === 'pools' && segs[2] && segs[3]) return { kind: 'pool', a: segs[2], b: segs[3] };
  return null;
}

class HeadInjector {
  constructor(html){ this.html = html; this.done = false; }
  element(el){ if (this.done) return; this.done = true; el.append(this.html, { html: true }); }
}
class TitleSetter {
  constructor(t){ this.t = t; }
  element(el){ el.setInnerContent(this.t); }
}

// Legacy build filename -> clean url, as a REAL redirect.
//
// The build rewrites static hrefs and the runtime maps lxNavigate/clicks, but the app also navigates
// by assigning location.href="lumoscore-x.html?..." directly in a dozen places (_dexdata, _trending,
// _walletdata, _feemodal, …) and through a second helper, __lxNav. Chasing every call site is
// whack-a-mole; redirecting at the edge catches all of them, including any added later.
//
// Done HERE rather than in _redirects on purpose: a 301 there can collide with the 200-rewrite for
// the same page and loop. Here the order is explicit and the rewrite path uses env.ASSETS/next(),
// which never re-enters this check.
function legacyClean(pathname, params){
  // Take the LAST path segment, not the whole path. The app navigates with RELATIVE urls
  // (location.href="lumoscore-dex-asset.html?asset=…"), which used to resolve at the site root but
  // now resolve against a nested clean url — /trade/stellar + "lumoscore-dex-asset.html" becomes
  // /trade/lumoscore-dex-asset.html and 404s. Matching the last segment redirects it from any depth.
  //
  // plain string ops, not regex: this file is emitted from a template literal, where a lone
  // backslash does not survive and silently corrupts the pattern.
  const segs = pathname.split('/');
  let base = segs[segs.length - 1] || '';
  if (base.slice(-5) === '.html') base = base.slice(0, -5);
  if (!base.startsWith('lumoscore-')) return null;
  base = base.replace(/-(dark|light|mobile)$/, '');

  // the two dynamic routes carry their identifier in the query — promote it into the path
  const asset = params && params.get('asset');
  if (base === 'lumoscore-dex-asset')      return asset ? '/trade/stellar/' + asset : '/trade/stellar';
  if (base === 'lumoscore-asset-overview') return asset ? '/trade/stellar/' + asset : '/trade/stellar';
  // a pool is addressed by its two assets, which ?pool=<id> does not carry — leave it alone
  const pool = params && params.get('pool');
  if (base === 'lumoscore-amm-pool') return pool ? '/pools/stellar/id/' + pool : '/pools/stellar';

  // "/" is registered in ROUTES against "index" (the landing page is copied to index.html so the
  // front door is not a redirect), so the ROUTES loop below never matches "lumoscore-landing" and
  // returned null. That mattered because the wallet gate used to redirect with the bare filename:
  // from /asset/stellar/<ASSET> the browser asked for /asset/stellar/lumoscore-landing.html, no 301
  // fired, and "/asset/stellar/:asset" then matched with the asset literally being
  // "lumoscore-landing.html" — rendering an asset page for an asset that does not exist, i.e. blank.
  if (base === 'lumoscore-landing') return '/';

  for (const r of ROUTES){
    if (r[0].indexOf('/:') >= 0) continue;
    if (r[1].replace(/-(dark|light|mobile)$/, '') === base) return r[0];
  }
  return null;
}

export async function onRequest(context){
  const { request, next } = context;
  const url = new URL(request.url);

  // 0) ONE ORIGIN. www.lumoscore.com was serving the whole app on a 200 with no redirect, so the site
  // answered on two hostnames — and a browser keeps localStorage PER ORIGIN. The wallet session lives
  // there (lumos.wallet / lumos.address), so connecting on one host and later arriving on the other
  // looked exactly like being logged out, with no way for the user to tell why. It also split every
  // SEO signal in spite of the canonical tag pointing at the apex. 301 so the browser stops asking.
  if (url.hostname.startsWith('www.')){
    const to = new URL(url.toString());
    to.hostname = url.hostname.slice(4);
    return Response.redirect(to.toString(), 301);
  }

  // 1) someone navigated to a raw build filename -> send them to the canonical clean url
  const legacy = legacyClean(url.pathname, url.searchParams);
  if (legacy){
    const to = new URL(legacy, url.origin);
    // ?asset= / ?pool= became a path segment, so carrying THEM would duplicate the identifier — but
    // dropping the whole query took every OTHER param with it. That silently broke the Wallet's
    // "Remove" button on an LP position, which links to ...?pool=<id>&act=withdraw so the pool page
    // opens on the Withdraw tab: the redirect promoted the pool into the path and threw act= away, so
    // the user always landed on Deposit. Drop only the key that was promoted.
    const promoted = legacy.indexOf('/trade/stellar/') === 0
      || legacy.indexOf('/pools/stellar/id/') === 0;
    if (promoted){
      const keep = new URLSearchParams(url.search);
      keep.delete('asset'); keep.delete('pool');
      const qs = keep.toString();
      to.search = qs ? ('?' + qs) : '';
    } else to.search = url.search;
    to.hash = url.hash;
    return Response.redirect(to.toString(), 301);
  }

  // 1b) /asset/stellar/<ASSET> -> /trade/stellar/<ASSET>, permanently.
  // The asset-overview page was removed; Trade-asset shows the same facts and can act on them.
  // These urls were published in the sitemap and may already be indexed, so this is a 301 rather
  // than a 404: search engines transfer the ranking to the Trade page instead of dropping it.
  // Bare /asset/stellar (no asset) goes to the Trade list.
  if (url.pathname === '/asset/stellar' || url.pathname.indexOf('/asset/stellar/') === 0){
    const rest = url.pathname.slice('/asset/stellar'.length);
    const to = new URL('/trade/stellar' + rest, url.origin);
    to.search = url.search;
    to.hash = url.hash;
    return Response.redirect(to.toString(), 301);
  }

  const hit = match(url.pathname);

  // not a page route -> let Pages serve it as usual
  if (!hit) return next();

  const isMobile = MOBILE.test(request.headers.get('user-agent') || '');
  const wantMobile = isMobile && HAS_MOBILE.has(hit.mobile);

  // Desktop needs no rewrite — Pages already serves the right file for this url. Rewriting anyway
  // broke "/", whose desktop file is index: fetching /index just 308s back to /.
  // Vary is still set on BOTH branches, or a cache would hand a desktop page to a phone.
  const res = wantMobile
    ? await context.env.ASSETS.fetch(
        new Request(new URL('/' + hit.mobile, request.url).toString(), request))
    : await next();

  let out = new Response(res.body, res);
  out.headers.set('Vary', 'User-Agent');

  const ct = out.headers.get('content-type') || '';
  if (ct.indexOf('text/html') < 0) return out;

  // canonical is the clean url WITHOUT query or hash, on whatever host served this request
  const canonical = PRIMARY_ORIGIN + (url.pathname === '/' ? '/' : url.pathname.replace(/\\/+$/, ''));
  const want = seoFor(url.pathname);

  let seo = null;
  if (want && want.kind === 'asset') seo = assetSeo(await assetFacts(want.id), want.id);
  else if (want && want.kind === 'pool') seo = poolSeo(want.a, want.b);

  const head = [
    '<link rel="canonical" href="' + esc(canonical) + '">',
    '<meta property="og:url" content="' + esc(canonical) + '">',
    '<meta property="og:site_name" content="LumosCore">',
    '<meta property="og:type" content="website">',
    '<meta name="twitter:card" content="summary_large_image">',
  ];
  if (seo){
    head.push('<meta property="og:title" content="' + esc(seo.title) + '">');
    head.push('<meta property="og:description" content="' + esc(seo.desc) + '">');
    head.push('<meta name="twitter:title" content="' + esc(seo.title) + '">');
    head.push('<meta name="twitter:description" content="' + esc(seo.desc) + '">');
    if (seo.image) head.push('<meta property="og:image" content="' + esc(seo.image) + '">');
    // a description already exists from the build; replace rather than duplicate
    head.push('<meta name="lx-seo-desc" content="' + esc(seo.desc) + '">');
  }

  let rw = new HTMLRewriter().on('head', new HeadInjector(head.join('')));
  if (seo){
    rw = rw.on('title', new TitleSetter(seo.title))
           .on('meta[name="description"]', {
             element(el){ el.setAttribute('content', seo.desc); },
           });
  }
  out = rw.transform(out);
  out.headers.set('Vary', 'User-Agent');
  return out;
}
`;
}

function routesJson(){
  // WHICH PATHS REACH THE FUNCTIONS RUNTIME. Anything not included here is served straight from
  // static storage and `functions/_middleware.js` never runs for it.
  //
  // This used to enumerate the routes ("/trade/stellar/*", "/lumoscore-*", …) so that only real
  // pages cost an invocation. That silently broke the legacy->clean 301: the app navigates with a
  // RELATIVE url (`location.href="lumoscore-dex-asset.html?asset=…"`), so from /trade/stellar the
  // browser asks for **/trade/lumoscore-dex-asset.html**. The middleware matches on the LAST path
  // segment and would have redirected it — but "/lumoscore-*" only matches at the ROOT, so that
  // path hit no include rule, the middleware never ran, and it fell through to a static 404.
  // Enumerating routes cannot fix this in general: a relative navigation can land the legacy
  // filename under ANY prefix, including ones added later.
  //
  // So: include everything, and exclude what must stay static. `/assets/*` is the only high-volume
  // path and it stays excluded, so images/video/fonts still bypass the runtime and stay free. Every
  // other request is an HTML page view, which was already invoking the middleware anyway.
  // A single "/*" also sidesteps the "Overlapping rules found" failure that used to require careful
  // splat-vs-splat and splat-vs-exact deduping — one rule cannot overlap itself.
  return JSON.stringify({
    version: 1,
    include: ['/*'],
    exclude: ['/assets/*', '/_headers', '/_redirects', '/404.html'],
  }, null, 2) + '\n';
}

function notFoundHtml(isAdmin){
  const home = isAdmin ? 'lumoscore-admin-dashboard.html' : '/';
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="robots" content="noindex">'
    + '<link rel="icon" type="image/png" href="/assets/favicon.png">'
    + '<title>Page not found — LumosCore</title>'
    + '<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;'
    + 'background:#0f111a;color:#e7e9ee;font:16px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;text-align:center}'
    + 'div{padding:32px}h1{font-size:56px;margin:0 0 8px;letter-spacing:-.02em}'
    + 'p{margin:0 0 22px;color:#9aa0ad}a{display:inline-block;padding:11px 20px;border-radius:10px;'
    + 'background:#ea6a2c;color:#fff;text-decoration:none;font-weight:700}</style></head><body>'
    + '<div><h1>404</h1><p>That page doesn’t exist.</p>'
    + '<a href="' + home + '">Back to LumosCore</a></div></body></html>';
}

function adminIndexHtml(){
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="robots" content="noindex,nofollow">'
    + '<link rel="icon" type="image/png" href="/assets/favicon.png">'
    + '<title>LumosCore Admin</title></head><body>'
    + '<script>location.replace("lumoscore-admin-dashboard.html");</scr' + 'ipt>'
    + '<noscript><a href="lumoscore-admin-dashboard.html">LumosCore Admin</a></noscript>'
    + '</body></html>';
}

function build(chain, srcDir, outRoot, atRoot, adminOnly){
  const desktop = getContents(read(path.join(srcDir, 'lumoscore-'+chain+'-desktop.html')));
  const mobile  = getContents(read(path.join(srcDir, 'lumoscore-'+chain+'-mobile.html')));
  const all = Object.assign({}, desktop, mobile);
  const files = Object.keys(all).filter(n => ADMIN_RE.test(n) === adminOnly && !isDropped(n));
  const validArray = files.slice(); // filenames shipped in this folder

  // --root: single-version build lands directly in dist/ (no per-chain subfolder), so the
  // landing page sits at the site root. Assets are left in place (extract only writes html).
  const outDir = adminOnly ? ADMIN_OUT : (atRoot ? outRoot : path.join(outRoot, chain));
  fs.mkdirSync(outDir, { recursive: true });

  let written = 0;
  for(const name of files){
    const src  = adminOnly ? stripAuthGate(all[name]) : all[name];
    const html = cleanLinks(rootRelative(injectRuntime(injectTokenRegistry(src), validArray)));
    fs.writeFileSync(path.join(outDir, name), html, 'utf8');
    written++;
  }
  // an admin build is not a site: no landing redirect, and it opens on the dashboard
  if(adminOnly) fs.writeFileSync(path.join(outDir, 'index.html'), adminIndexHtml(), 'utf8');
  else {
    const landing = all['lumoscore-landing.html'];
    if(!landing) throw new Error('lumoscore-landing.html missing — cannot build the site root');
    fs.writeFileSync(path.join(outDir, 'index.html'),
      indexHtml(cleanLinks(rootRelative(injectRuntime(injectTokenRegistry(landing), validArray)))), 'utf8');
  }
  // The admin panel deploys as its OWN Cloudflare project, so it cannot borrow dist/assets the way
  // serve.js lets it locally — without this its favicon and wallet logos 404 in production.
  // Only what the admin build actually references is copied (~470 KB), not the whole 19 MB folder.
  if(adminOnly){
    const need = ['favicon.png', 'wallets'];
    for(const item of need){
      const src = path.join(outRoot, 'assets', item);
      const dst = path.join(outDir, 'assets', item);
      if(!fs.existsSync(src)) { console.warn('  ! admin asset missing: ' + item); continue; }
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.cpSync(src, dst, { recursive: true });
    }
    // Functions run ONLY on /lxapi/*; every other path serves a static file and costs nothing.
    //
    // ⚠ NO "exclude" HERE. In Cloudflare Pages, exclude ALWAYS takes priority over include, so the
    // previous {include:['/lxapi/*'], exclude:['/*']} cancelled itself out and no Function ever ran on
    // the admin origin -- every /lxapi/ call 404'd. That is why the holder count and the connected-
    // wallet figures came back empty on the deployed admin panel while working everywhere else.
    // Paths outside `include` already fall through to static assets; excluding them as well is not
    // "extra safety", it is the off switch.
    fs.writeFileSync(path.join(outDir, '_routes.json'),
      JSON.stringify({ version: 1, include: ['/lxapi/*'], exclude: [] }, null, 2) + '\n', 'utf8');
  }

  fs.writeFileSync(path.join(outDir, '_headers'), headersFile(adminOnly), 'utf8');
  fs.writeFileSync(path.join(outDir, '404.html'), notFoundHtml(adminOnly), 'utf8');
  // clean URLs are a public-site concern; the admin build keeps its filenames
  if(!adminOnly){
    fs.writeFileSync(path.join(outDir, '_redirects'), redirectsFile(), 'utf8');

    // device resolution at the edge. "/" is the landing page, which _redirects never covers because
    // index.html answers it directly — so it is added here explicitly.
    const routePairs = [['/', 'index', 'lumoscore-landing-mobile']]
      .concat(ROUTES.map(([u, f]) => [u, f.replace(/\.html$/, ''), null]));
    const mobileFiles = files
      .filter(n => /-mobile\.html$/.test(n))
      .map(n => n.replace(/\.html$/, ''));

    fs.writeFileSync(path.join(outDir, '_routes.json'), routesJson(), 'utf8');
    const fnDir = path.join(__dirname, '..', 'functions');
    fs.mkdirSync(fnDir, { recursive: true });
    fs.writeFileSync(path.join(fnDir, '_middleware.js'), middlewareJs(routePairs, mobileFiles), 'utf8');
  }

  // a stale admin page left over from an earlier build would still be served, so sweep the public dir
  let purged = 0;
  if(!adminOnly){
    for(const f of fs.readdirSync(outDir)){
      if(ADMIN_RE.test(f)){ fs.unlinkSync(path.join(outDir, f)); purged++; }
    }
  }
  return { chain, total: written, purged, dir: outDir };
}

const SRC = 'C:/LumosCore';
const OUT = 'C:/LumosCore/dist';
const ADMIN_OUT = 'C:/LumosCore/dist-admin';
const chains = ['aptos','hedera','starknet','vechain','worldchain','stellar','xrpl'];
const argv = process.argv.slice(2).filter(a=>a!=='--root'&&a!=='--admin');
const atRoot = process.argv.includes('--root');
const adminOnly = process.argv.includes('--admin');
const target = argv[0];
const list = target ? [target] : chains;
if(atRoot && list.length>1){ console.error('--root builds a single version; pass one chain (e.g. aptos --root)'); process.exit(1); }
if(adminOnly && list.length>1){ console.error('--admin builds one version; pass one chain (e.g. aptos --admin)'); process.exit(1); }
for(const c of list){
  const r = build(c, SRC, OUT, atRoot, adminOnly);
  console.log(r.chain.padEnd(11), 'pages:'+r.total, (r.purged?('purged '+r.purged+' stale admin page(s)  '):''), '->', r.dir);
}
if(!adminOnly) console.log('admin pages excluded from the public build \u2014 build them with: node _tools/extract_site.js '+(target||'aptos')+' --admin');
