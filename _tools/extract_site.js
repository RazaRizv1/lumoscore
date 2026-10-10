const fs = require('fs');
const path = require('path');
// The combined site's XRPL paths. They are not in the ROUTES table below -- they are the other
// repo's build, served by _redirects rewrites that _mergexrpl.js writes -- but the middleware has to
// recognise them or they never reach the SEO head. Shared with that tool, not copied.
const { PATTERNS: XRPL_PATTERNS } = require('./_xrplroutes.js');

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
  const m = {}, hub = {};
  for(const [url, file, flag] of ROUTES){
    if(flag === 'alias') continue;                  // an alias is never where a link should point
    if(/:/.test(url)) continue;                     // dynamic routes are handled by query conversion
    // key on the BASE name: /rewards is served by lumoscore-rewards-dark.html, but links to it appear
    // as -dark, -light and -mobile, and every one of them is the same page.
    const base = file.replace(/\.html$/, '').replace(/-(dark|light|mobile)$/, '');
    if (flag === 'hub') hub[base] = url;
    else if (!(base in m)) m[base] = url;
  }
  // A HUB WINS. Clicking "Cross-chain" in the menu while signed out must open the chooser, not drop
  // the visitor onto the Stellar bridge -- picking the network for them is the whole thing the
  // chooser exists to stop. Pointing these at /<hub>/stellar meant the menu bypassed every chooser on
  // the site, which is how they were unreachable from inside the app.
  //
  // Someone who IS connected does not want the question, and the head gate on the hub forwards them.
  // That costs a second document load, so runtime() ALSO upgrades the click to /<hub>/stellar when a
  // wallet is present -- the gate stays as the safety net for a typed url or an external link.
  for (const b in hub) m[b] = hub[b];
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
    // the network choosers, straight off the route table so this list cannot drift from it
    + 'var HUBS=' + JSON.stringify(ROUTES.filter((r) => r[2] === 'hub').map((r) => r[0])) + ';'
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
    // A connected wallet has already answered the chooser's question, so skip straight to its chain
    // page. Without this the menu link lands on the hub, whose head gate then forwards -- correct but
    // a second document load on every single navigation. Modified clicks are left alone so
    // ctrl/cmd-click still opens the hub in a new tab.
    + 'if(HUBS.indexOf(hb)>=0&&!e.defaultPrevented&&e.button===0'
    + '&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){'
    + 'var ad="",ch="";'
    + 'try{ ad=localStorage.getItem("lumos.address")||"";'
    + 'ch=(localStorage.getItem("lumos.chain")||"").toLowerCase(); }catch(_){}'
    + 'if(ad&&(ch===""||ch==="stellar")){e.preventDefault();'
    + 'location.href=hb+"/stellar"+h.slice(hb.length);return;}}'
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
    addCurated(out);
    return out;
  }catch(e){ const out = {}; try{ addCurated(out); }catch(_){} return out; }
}
// THE CURATED LOGOS WE ALREADY SHIP (assets/tokens/curated/CODE-ISSUER.png, written by _bridgelogos.js).
//
// RAZA 2026-09-20: "Where's VELO logo on Trade-Asset page". It was there -- about half a second late. Nothing in the
// page knew the asset, so it drew the initials avatar and asked the edge (/lxapi/assetlogo, ~500ms on that asset),
// then repainted. Measured on production: the letter first, the real logo after. Every curated asset has a logo file
// sitting in this build, so the page can know it on the FIRST paint instead, with no request at all -- which is what
// this registry is for. Only fills keys the launchpad file has not already claimed.
// A few curated assets ship their logo under their own name rather than as CODE-ISSUER.png, so the scan below never
// sees them (BLND was the one left drawing a letter). The map now lives in _namedlogos.js, SHARED with _ogcards.js,
// which needs the same answer when it picks a logo for the share card.
const { NAMED_LOGOS } = require('./_namedlogos.js');
function addCurated(out){
  for(const k of Object.keys(NAMED_LOGOS)){
    const p = NAMED_LOGOS[k];
    if(out[k] && out[k].image) continue;
    if(!fs.existsSync(path.join(__dirname, '..', p.replace(/^\//, '')))) continue;   // never name a file this build lacks
    out[k] = { image: p, name: (out[k] && out[k].name) || '' };
  }
  const dir = path.join(__dirname, '..', 'assets', 'tokens', 'curated');
  let files = []; try{ files = fs.readdirSync(dir); }catch(e){ return; }
  for(const f of files){
    const m = /^([A-Za-z0-9]{1,12})-(G[A-Z2-7]{55})\.png$/.exec(f);
    if(!m) continue;
    const k = m[1] + '-' + m[2];
    if(out[k] && out[k].image) continue;
    out[k] = { image: '/assets/tokens/curated/' + f, name: (out[k] && out[k].name) || '' };
  }
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

// Resource hints, injected FIRST in <head> so the handshakes overlap the 234 KB of inline CSS that
// follows them rather than queueing behind it.
//
// MEASURED on production before adding these, not assumed. Handshake cost (DNS+TCP+TLS) to each
// origin, against when the page first actually contacts it on /trade/stellar/:asset:
//     horizon.stellar.org   592 ms handshake, first contacted at 1729 ms
//     api.stellar.expert     95 ms            first contacted at 1714 ms
//     api.coingecko.com      59 ms            first contacted at 1727 ms
// Horizon is the whole prize: 185 ms of TCP and 394 ms of TLS, paid serially at the exact moment the
// page is trying to fill in prices. Nothing touches it for the first 1.7 s, so a hint issued here has
// the socket open and idle long before it is needed.
//
// Checked against the build rather than guessed: horizon and stellar.expert are referenced by 96 of 96
// pages, coingecko by 92 -- so no page is warming an origin it never calls except four, which pay one
// idle socket. Only three preconnects: each holds a connection open, so warming everything is
// counterproductive. coingecko gets dns-prefetch, which is nearly free.
//
// ⚠ crossorigin ON THE FONT PRELOAD IS NOT OPTIONAL, even though the file is same-origin. Fonts are
// fetched in CORS mode, so a preload without it is treated as a DIFFERENT request than the one the
// stylesheet makes and the browser downloads the file TWICE -- slower than adding nothing at all.
// Verified after the change by counting font requests, not by reading the tag.
//
// The font is hankengrotesk-latin: used on 96 of 96 pages, currently requested at 1212 ms and landing
// at 1881 ms because it cannot start until the CSS that references it has parsed. font-display is
// swap, so text is never invisible -- what this removes is a second of fallback-font flash.
const HINTS =
    '<link rel="preconnect" href="https://horizon.stellar.org" crossorigin>'
  + '<link rel="preconnect" href="https://api.stellar.expert" crossorigin>'
// esm.sh is deliberately NOT preconnected despite being the third-busiest origin in the build. It is
// only contacted when someone connects a wallet, which is why it does not appear in the page-load
// timing above at all -- and a preconnected socket is dropped after ~10 s idle, so the hint would
// expire long before the click that needs it. Warming it would cost a connection and buy nothing.
  + '<link rel="dns-prefetch" href="https://api.coingecko.com">'
  + '<link rel="preload" as="font" type="font/woff2" crossorigin'
  + ' href="/assets/fonts/hankengrotesk-latin.woff2">';

function injectHints(html){
  if(html.indexOf('rel="preconnect"')>=0) return html;      // idempotent across rebuilds
  const hi = html.indexOf('<head>');
  if(hi >= 0) return html.slice(0, hi + 6) + HINTS + html.slice(hi + 6);
  const he = html.indexOf('</head>');
  if(he >= 0) return html.slice(0, he) + HINTS + html.slice(he);
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
//
// THE CSP IS DELIBERATELY PARTIAL, and the earlier note here — "any useful policy would need
// 'unsafe-inline' and buy nothing" — was half right. It is true of script-src and style-src: the design
// carries hundreds of inline <script> and style attributes, and a script-src that has to allow
// 'unsafe-inline' protects almost nothing. It is NOT true of the four directives below, none of which
// has anything to do with inline code, so they are set and the rest are left off until that inline code
// is moved out.
//
//   base-uri 'self'     the one that actually matters. <base href="https://evil/"> re-points every
//                       root-relative URL on the page at another origin — including
//                       /assets/vendor/stellar-sdk-*.min.js, the library that builds transactions for
//                       signing. Self-hosting that file is only worth anything if the browser resolves
//                       it against OUR origin, and this is what guarantees that.
//   object-src 'none'   nothing in the build uses <object>, <embed> or a plugin. Checked.
//   frame-ancestors     backs X-Frame-Options DENY with the header modern browsers actually prefer.
//   form-action 'self'  the build contains no <form action> and creates none at runtime. Checked. So
//                       any form that appears is not ours, and cannot post anywhere.
//
// Each was verified against the built output before being added rather than assumed safe: zero forms,
// zero <object>/<embed>, zero real <base> elements (the three matches are inside a comment), and
// nothing framing our own pages.
const CSP = "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'";

function headersFile(isAdmin){
  const common =
      '  X-Content-Type-Options: nosniff\n'
    + '  X-Frame-Options: DENY\n'
    + '  Content-Security-Policy: ' + CSP + '\n'
    + '  Referrer-Policy: strict-origin-when-cross-origin\n'
    // camera=(self), NOT camera=(). The empty allowlist disables the camera for every origin INCLUDING this one,
    // so the QR scanners on the bridge and the wallet could never open one: getUserMedia was rejected with
    // NotAllowedError however the reader answered the prompt, which is why RAZA saw "Camera permission was
    // declined" on a tablet where he had just accepted it (2026-09-21). (self) grants it to this origin only --
    // no third party and no iframe, which is what the empty list was protecting. Everything else stays off.
    + '  Permissions-Policy: camera=(self), microphone=(), geolocation=(), interest-cohort=()\n';
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
//
// THE THIRD FIELD marks a url that is not the page's primary address. Two values:
//
//   'alias' — a SECOND URL FOR THE SAME PAGE. It still serves (that is the entire point: a link
//             posted somewhere must keep working), but it stays out of the clean-URL map, out of the
//             sitemap, and its canonical points at the real one.
//   'hub'   — a NETWORK CHOOSER. Same file, genuinely different page: the bare path asks which chain
//             and /<thing>/stellar answers (see _tools/_lumosparent.js). It keeps its own canonical
//             and its own sitemap row, AND it is what the menu links to -- a signed-out visitor
//             picking "Cross-chain" must get the question, not be dropped onto the Stellar bridge.
//             runtime() upgrades the click to /<thing>/stellar when a wallet is already connected.
//
// An alias stays out of the clean map, the sitemap and legacyClean, and its canonical points at the
// real url. A hub is the opposite on every count except that it is still not an alias of anything.
//
// Without that flag the two derivations of "the url for this file" DISAGREED, which is what produced
// the duplicates. cleanMapJson takes the LAST matching route and legacyClean the FIRST, so
// lumoscore-bridge was /bridge to lxNavigate and /bridge/stellar to a location.href — and both urls
// shipped in the sitemap self-canonicalising, which is precisely the split the /docs comment further
// down describes. Four pages were in that state (bridge, rewards, lumos, faq) and adding bare /trade
// and /pools would have made six. One flag now decides it for every consumer.
//
// WHICH ONE IS THE ALIAS: the one the site does NOT already link. Every canonical below is the url
// that internal links and existing canonicals use today, so this consolidates the duplicates without
// moving a single page that search engines have already indexed.
const ROUTES = [
  // dynamic first: these carry an asset or pool identifier in the path
  ['/trade/stellar/:asset',            'lumoscore-dex-asset.html'],
  ['/trade/stellar',                   'lumoscore-dex.html'],
  ['/account/stellar/:address',        'lumoscore-account.html'],
  ['/pools/stellar/id/:pool',          'lumoscore-amm-pool.html'],   // fallback: id-only links
  ['/pools/stellar/:a/:b',             'lumoscore-amm-pool.html'],
  ['/pools/stellar',                   'lumoscore-amm.html'],
  // The bare paths are NETWORK CHOOSERS, the same pattern /lumos already uses: Stellar live, XRP
  // Ledger shown as Upcoming and not clickable, so the chooser never promotes a chain that is not
  // public. /trade and /pools 404d entirely until now.
  ['/trade',                           'lumoscore-dex.html',  'hub'],
  ['/pools',                           'lumoscore-amm.html',  'hub'],
  // NO /asset/stellar route. The asset-overview page was removed — it showed the same facts as
  // Trade-asset with no way to act on them. /asset/stellar/<ASSET> is now a permanent 301 to
  // /trade/stellar/<ASSET>, handled in the middleware so already-indexed urls keep their value.
  // launchpad flow: /launchpad/review must precede /launchpad
  ['/launchpad/review',                'lumoscore-launch-review.html'],
  ['/launchpad/confirm',               'lumoscore-launch-confirm.html'],
  ['/launchpad/stellar',               'lumoscore-launch-token.html'],
  // A CHOOSER, like /trade and /pools. It was the one product on the landing page whose card had
  // nowhere safe to point: the bare path served the Stellar launchpad behind the wallet gate, so a
  // signed-out visitor clicking it was bounced straight to "/".
  ['/launchpad',                       'lumoscore-launch-token.html', 'hub'],
  // flat pages
  ['/dashboard',                       'lumoscore-home.html'],
  // CHAIN-SCOPED ALIASES. The same page addressed by chain, so a promoted link names the network it is
  // about -- the scheme /trade/stellar already proved. The bare path stays as the chain-neutral form.
  ['/bridge/stellar',                  'lumoscore-bridge.html'],
  ['/bridge',                          'lumoscore-bridge.html', 'hub'],
  ['/wallet',                          'lumoscore-wallet.html'],
  ['/rewards/stellar',                 'lumoscore-rewards-dark.html'],   // only variant that exists
  ['/rewards',                         'lumoscore-rewards-dark.html', 'hub'],
  ['/lumos/stellar',                   'lumoscore-lumos-token.html'],
  ['/lumos',                           'lumoscore-lumos-token.html', 'hub'],
  ['/signin',                          'lumoscore-signin.html'],
  ['/mcp',                             'lumoscore-mcp.html'],
  ['/blog/:slug',                      'lumoscore-blog-post.html'],
  ['/blog',                            'lumoscore-blog.html'],
  ['/privacy',                         'lumoscore-privacy.html'],
  ['/terms',                           'lumoscore-terms.html'],
  ['/support',                         'lumoscore-support.html'],
  ['/whitepaper',                      'lumoscore-whitepaper.html'],
  ['/about',                           'lumoscore-about.html'],
  ['/list-your-token',                 'lumoscore-list-token.html'],
  // docs: each slug before the bare /docs, which serves the introduction
  ['/docs/introduction',                'lumoscore-docs-introduction.html'],
  ['/docs/connect-a-wallet',            'lumoscore-docs-connect-a-wallet.html'],
  ['/docs/fees',                        'lumoscore-docs-fees.html'],
  ['/docs/swaps',                       'lumoscore-docs-swaps.html'],
  ['/docs/limit-orders',                'lumoscore-docs-limit-orders.html'],
  ['/docs/liquidity-pools',             'lumoscore-docs-liquidity-pools.html'],
  ['/docs/cross-chain',                 'lumoscore-docs-cross-chain.html'],
  ['/docs/wallet',                      'lumoscore-docs-wallet.html'],
  ['/docs/trustlines',                  'lumoscore-docs-trustlines.html'],
  ['/docs/rewards',                     'lumoscore-docs-rewards.html'],
  ['/docs/launch-a-token',              'lumoscore-docs-launch-a-token.html'],
  ['/docs/asset-metadata',              'lumoscore-docs-asset-metadata.html'],
  ['/docs/verification',                'lumoscore-docs-verification.html'],
  ['/docs/curated-listing',             'lumoscore-docs-curated-listing.html'],
  ['/docs/security',                    'lumoscore-docs-security.html'],
  ['/docs/troubleshooting',             'lumoscore-docs-troubleshooting.html'],
  // /docs/faq is the ALIAS: the footer has always called it FAQs and every link the build rewrites
  // points at /faq, so /faq is the address and the docs-tree spelling defers to it.
  ['/docs/faq',                        'lumoscore-docs-faq.html', 'alias'],
  ['/docs',                            'lumoscore-docs-introduction.html', 'alias'],
  ['/faq',                             'lumoscore-docs-faq.html'],
];

// Case: fixed segments are lowercase, but an asset segment must keep its case — yUSDC and YUSDC are
// genuinely different assets on Stellar. Pages matches paths case-sensitively, so these redirects
// only forgive the fixed part.
// Wrong-but-published urls that must keep working. A link written once and posted somewhere
// cannot be edited later, so the site forgives the spelling rather than 404ing.
//   /blogs/... -- the plural. The Rewards page links this way, and the site only serves /blog/...
const ALIASES = [
  ['/blogs/*', '/blog/:splat'],
  ['/blogs',   '/blog'],
];

// A WILDCARD DOES NOT MATCH THE BARE PATH, which is why /Trade and /Pools 404'd while /Trade/stellar
// redirected correctly. '/Trade/*' matches /Trade/<something> and nothing else, so the two shortest
// and most likely hand-typed forms of each were the only ones not forgiven. Both spellings are listed
// now; Pages applies the first match, and the bare entry cannot shadow the splat because the paths
// differ.
//
// The rest were simply never here. Measured against production on 2026-10-10: /About, /Blog, /Support,
// /Terms, /Privacy, /Docs and /FAQ all returned 404. These are exactly the urls a person capitalises
// by hand when writing a link in an email, a tweet or a directory listing -- the links nobody can go
// back and edit, which is the entire reason this table exists.
//
// Only the FIXED segments are forgiven. An asset segment keeps its case, because yUSDC and YUSDC are
// genuinely different assets on Stellar and folding them would resolve one to the other.
const CASE_FIXES = [
  ['/Trade/*', '/trade/:splat'], ['/Pools/*', '/pools/:splat'],
  ['/Trade',   '/trade'],   ['/Pools',   '/pools'],
  ['/Bridge',  '/bridge'], ['/Wallet', '/wallet'], ['/Rewards', '/rewards'],
  ['/MCP',     '/mcp'],    ['/Dashboard', '/dashboard'], ['/Launchpad', '/launchpad'],
  ['/About',   '/about'],  ['/Blog', '/blog'], ['/Blog/*', '/blog/:splat'],
  ['/Support', '/support'], ['/Terms', '/terms'], ['/Privacy', '/privacy'],
  ['/Docs',    '/docs'],   ['/Docs/*', '/docs/:splat'], ['/FAQ', '/faq'],
  ['/Whitepaper', '/whitepaper'], ['/Lumos', '/lumos'],
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
  for(const [from, to] of ALIASES) L.push(pad(from) + to + '  301');
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
// Static, indexable routes for sitemap.xml, derived from the SAME table the middleware routes on.
//
// EXCLUDED, and why:
//   * anything with a :param -- those urls are enumerated from live data instead (assets, pools and
//     blog posts), because a placeholder is not a url;
//   * /signin, and the launchpad's mid-flow steps, which are states rather than pages and would be
//     thin, duplicated entries;
//   * admin, which is not part of the public site at all.
// THE WALLET-GATED SURFACES MUST NOT BE LISTED, and until 2026-10-10 two of them were.
//
// /dashboard and /wallet carry lx-authgate, which is a CLIENT-SIDE guard: it reads localStorage and
// calls location.replace("/"). Googlebot has no localStorage and does not run that redirect, so it
// received HTTP 200 and the whole app shell -- 383KB of dashboard, 427KB of wallet -- while _seo.js
// stamped them "index, follow" and this list put them in the sitemap. We were actively submitting them.
//
// Nothing private leaked: every real balance is fetched at runtime from a connected wallet and a
// crawler has none, so what got indexed was app chrome plus placeholder figures. That is still wrong
// twice over. A gated app surface has no business in a search result, and a page titled "Dashboard --
// Your Stellar Portfolio" showing somebody else's placeholder dollar amounts is precisely the
// thin-content signal that costs a domain its quality score.
//
// _mc_engine.js:166 asserts the dashboard "is authgated, so it is never indexed or shared". That was
// the assumption; it was false in production. Three defences now, because one of them is a <meta> tag
// in a 400KB document and the other is a file nobody reads twice: this list, noindex in _seo.js, and
// an X-Robots-Tag response header in the middleware. The header is the one that holds if the markup
// changes shape.
//
// /launchpad is deliberately NOT here -- see PUBLIC_BASES in _authgate.js. It is a hub, it is now
// public, and ranking for "launch a token on Stellar" is the entire point of it.
const SITEMAP_SKIP = new Set([
  '/signin', '/launchpad/review', '/launchpad/confirm',
  '/dashboard', '/wallet',
]);
// A few pages deserve a stronger signal than the default.
const SITEMAP_WEIGHT = {
  '/': ['1.0', 'daily'],
  '/trade/stellar': ['0.9', 'daily'],
  '/pools/stellar': ['0.9', 'daily'],
  '/blog': ['0.9', 'daily'],
  '/docs': ['0.8', 'weekly'],
  '/whitepaper': ['0.8', 'monthly'],
  '/faq': ['0.7', 'monthly'],
  '/about': ['0.6', 'monthly'],
  // An issuer looking for "list token on Stellar" is exactly who this page is for, so it is not a
  // default-weight page.
  '/list-your-token': ['0.7', 'monthly'],
  '/lumos': ['0.8', 'weekly'],
  '/bridge': ['0.8', 'weekly'],
  '/launchpad': ['0.8', 'weekly'],
  '/privacy': ['0.3', 'yearly'],
  '/terms': ['0.3', 'yearly'],
};
function sitemapRoutesJs(routePairs){
  const seen = new Set();
  const rows = [];
  for (const [urlPattern, , , alias] of routePairs){
    if (urlPattern.indexOf(':') >= 0) continue;          // dynamic: listed from live data instead
    if (SITEMAP_SKIP.has(urlPattern)) continue;
    // An alias is the SAME PAGE at a second url. Listing both submitted two identical documents and
    // asked Google to pick -- the dedupe here was keyed on the url, which is unique by construction,
    // so it never removed anything and /docs and /docs/faq shipped as pairs. The flag is what
    // actually makes "one page, one row" true.
    //
    // A HUB IS NOT AN ALIAS and stays listed: /trade asks which network and /trade/stellar answers,
    // so they are two pages that happen to share a file, and both are worth finding.
    if (alias === 'alias') continue;
    if (seen.has(urlPattern)) continue;
    seen.add(urlPattern);
    const w = SITEMAP_WEIGHT[urlPattern] || ['0.6', 'weekly'];
    rows.push([urlPattern, w[0], w[1]]);
  }
  return '// GENERATED by extract_site.js — do not edit.\n'
    + '// Static indexable routes, derived from the route table so a new page cannot be forgotten.\n'
    + 'export const SITEMAP_ROUTES = ' + JSON.stringify(rows, null, 2) + ';\n';
}

// A TABLET THAT ASKED FOR THE DESKTOP SITE STILL WANTS THE MOBILE BUILD ("I want to keep it like on mobile
// on tablet too", RAZA 2026-09-21). The edge decides from the user agent and client hints, but Chrome's
// "Desktop site" rewrites the first and a browser may strip the second -- and then a tablet lands on the
// desktop build, where the recent-transactions table and the landing page are laid out for a screen it does
// not have. The PAGE can tell what the edge could not: a coarse pointer that cannot hover is a touch screen,
// not a laptop with a touchscreen (those keep a fine pointer and hover through their trackpad). It records
// that in a cookie the middleware reads and reloads once. The url never changes, so this does not bring back
// the second address for the same page that the design removed on purpose.
// Only desktop pages carry it, so the reload lands on a page without it and cannot loop; the cookie is also
// checked first, so a route with no mobile build settles after one pass. lxdev=d is the way back to desktop.
// THE WAY BACK OUT, and it has to be on EVERY page including the mobile build.
//
// RAZA, on a desktop: "WTF is my desktop showing the like this. also when i check on my other google
// profile, its showing fine." A cookie is per-profile, which is exactly the shape of that report -- and
// the cookie below lasts a YEAR. Once it is set wrongly there was nothing on the site that could unset
// it: the only script that touched it lived on desktop pages, and a stuck visitor never sees one. The
// answer was "clear your cookies", which is not an answer.
//
// ?lxdev=d pins the desktop build, ?lxdev=m pins mobile, ?lxdev=0 forgets the preference and lets
// detection run again. The parameter is stripped with replaceState so it never enters history and
// cannot be shared by accident.
function deviceEscapeJs(){
  return '<script id="lx-devesc">(function(){try{'
    + 'var m=/[?&]lxdev=(d|m|0)(?:&|$)/.exec(location.search||"");if(!m)return;'
    + 'if(m[1]==="0")document.cookie="lxdev=;path=/;max-age=0;samesite=lax";'
    + 'else document.cookie="lxdev="+m[1]+";path=/;max-age=31536000;samesite=lax";'
    + 'var q=(location.search||"").replace(/([?&])lxdev=(?:d|m|0)(&|$)/,"$1").replace(/[?&]$/,"");'
    + 'location.replace(location.pathname+(q&&q!=="?"?q:"")+location.hash);'
    + '}catch(_){}})();<' + '/script>';
}
function deviceSwapJs(){
  return '<script id="lx-devswap">(function(){try{'
    + 'if(/(?:^|; )lxdev=/.test(document.cookie||""))return;'
    + 'var coarse=false,hover=true;'
    + 'try{coarse=window.matchMedia("(pointer:coarse)").matches;}catch(_){}'
    + 'try{hover=window.matchMedia("(hover:hover)").matches;}catch(_){}'
    + 'if(!coarse||hover)return;'
    // A TOUCH SCREEN, not a touch-capable laptop: some Windows machines report a coarse pointer with no
    // hover while a mouse is idle, and that is not a reason to hand them a phone layout for a year.
    + 'if(!(navigator.maxTouchPoints>1))return;'
    // SCREEN WIDTH, NOT WINDOW WIDTH. This read min(innerWidth, screen.width), so a desktop browser
    // snapped to half a wide monitor measured under 1280 and pinned itself to the mobile build -- for a
    // year, on that profile, with no way back. The window can be any size; the SCREEN is what says
    // whether this is a tablet.
    + 'var w=(window.screen&&window.screen.width)||9999;'
    + 'if(w>1280)return;'
    + 'document.cookie="lxdev=m;path=/;max-age=31536000;samesite=lax";'
    + 'location.reload();'
    + '}catch(_){}})();<' + '/script>';
}
function injectDeviceSwap(html, name){
  const i = html.indexOf('</head>');
  if (i < 0) return html;
  // The escape goes on every build. A visitor pinned to mobile only ever loads mobile pages, so an
  // escape that lives on desktop pages is an escape they can never reach.
  if (html.indexOf('id="lx-devesc"') < 0) html = html.slice(0, i) + deviceEscapeJs() + html.slice(i);
  if (/-mobile\.html$/.test(name)) return html;          // already the build it would switch to
  if (html.indexOf('id="lx-devswap"') >= 0) return html; // idempotent
  const j = html.indexOf('</head>');
  return j < 0 ? html : html.slice(0, j) + deviceSwapJs() + html.slice(j);
}

// alias url -> the url that page actually lives at, derived from the route table's alias flag so a new
// alias cannot be added without its canonical following. Keyed on the file (theme suffix stripped),
// because that is what makes two urls the same page.
function canonOfJson(routePairs){
  const home = {};                                        // file -> the page's real url
  for (const [u, f, , flag] of routePairs){
    if (flag || u.indexOf(':') >= 0) continue;
    const b = f.replace(/-(dark|light|mobile)$/, '');
    if (!(b in home)) home[b] = u;
  }
  const m = {};
  // ONLY an alias gets a canonical pointing elsewhere. A hub is its own page -- pointing /trade at
  // /trade/stellar would ask search engines to drop the chooser, which is the page we want strangers
  // to land on.
  for (const [u, f, , flag] of routePairs){
    if (flag !== 'alias' || u.indexOf(':') >= 0) continue;
    const c = home[f.replace(/-(dark|light|mobile)$/, '')];
    if (c && c !== u) m[u] = c;
  }
  return JSON.stringify(m);
}

function middlewareJs(routePairs, mobileFiles, chainAlt, poolPairs){
  return `// GENERATED by _tools/extract_site.js — edit the ROUTES table there, not this file.
const MOBILE = /Android|iPhone|iPod|IEMobile|BlackBerry|Opera Mini|Mobile Safari|Windows Phone/i;
// [urlPattern, desktopFile, mobileFile|null] — "/" names both explicitly because its desktop file is
// index (fetching /lumoscore-landing would hit the 301 back to "/" and loop).
const ROUTES = ${JSON.stringify(routePairs, null, 2)};
const HAS_MOBILE = new Set(${JSON.stringify(mobileFiles)});
// CHAIN-AWARE PAGES: a Stellar page file -> the same page in another chain's build.
//
// The authgated surfaces (dashboard, wallet, launchpad) are ONE url each on a multi-chain deployment,
// serving whichever network the reader is connected to. They are never indexed -- the gate bounces
// anyone without a wallet -- so a second url per chain would only ever be a second private link to the
// same screen, and RAZA's point stands: there is nothing for /dashboard/xrpl to be good for.
//
// Empty on a single-chain build, which is what this generator produces; the combine step fills it in
// when it assembles a deployment that actually has a second chain.
const CHAIN_ALT = ${JSON.stringify(chainAlt || {})};
// AMM ACCOUNT -> THE PAIR IT HOLDS, for the /pools/<chain>/id/<account> title. See poolIdSeo below
// for why this is a baked table and not a lookup: an AMM's pair never changes, so a table can be
// incomplete but not wrong, while a lookup would cost a subrequest on every render.
//
// Empty on a single-chain build, exactly like CHAIN_ALT above; the combine step fills it from the
// XRPL build's _tools/poolpairs.generated.json when it assembles a deployment that has a second
// chain. An account that is not in here keeps the account-named title, which is what every pool had
// before this existed.
const POOL_PAIRS = ${JSON.stringify(poolPairs || {})};

// The combined site's XRPL paths, which match() cannot answer for: they are the other repo's build,
// reached through _redirects rewrites rather than through the ROUTES table above. Generated from the
// same table _mergexrpl.js writes those rewrites from (_tools/_xrplroutes.js), so the two cannot
// drift. Compiled ONCE here rather than per request -- there is a 10ms CPU budget on this plan.
const XRPL_PAGE = ${JSON.stringify(XRPL_PATTERNS)}.map(function (s) { return new RegExp(s); });
function isXrplPage(pathname){
  const p = pathname.length > 1 ? pathname.replace(/\\/+$/, '') : pathname;
  for (const r of XRPL_PAGE) if (r.test(p)) return true;
  return false;
}

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

function esc(s){return (String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')).split(String.fromCharCode(39)).join("&#39;");}
function fmtUsd(n){
  if (n == null || !isFinite(n)) return null;
  if (n >= 1000) return '$' + Math.round(n).toLocaleString('en-US');
  // toPrecision(3) goes exponential below about 1e-6, so a genuinely cheap token shipped its price
  // into the search result as "$7.72e-7" -- which reads as a bug to a person and is not a number a
  // language model restates cleanly. Plenty of Stellar assets sit down there.
  //
  // Zero and negative are guarded before the log, which would otherwise be -Infinity and ask toFixed
  // for 100 decimals -- that trimmed back to a bare "$0." once the zeros were stripped.
  if (!(n > 0)) return null;
  if (n < 0.0001) {
    const places = Math.min(100, Math.max(4, 2 - Math.floor(Math.log10(n))));
    return '$' + Number(n).toFixed(places).replace(/0+$/, '').replace(/\\.$/, '');
  }
  return '$' + Number(n).toFixed(n < 1 ? 4 : 2);
}

async function assetFacts(assetId){
  try {
    const r = await fetch(
      'https://api.stellar.expert/explorer/public/asset?search=' + encodeURIComponent(assetId) + '&limit=5',
      { cf: { cacheTtlByStatus: { '200-299': SEO_CACHE_TTL, '300-399': 0, '400-599': 0 }, cacheEverything: true } });
    if (!r.ok) return null;
    const d = await r.json();
    const recs = (d && d._embedded && d._embedded.records) || [];
    const m = recs.filter(x => String(x.asset || '').indexOf(assetId) === 0)[0];
    if (!m) return null;
    const toml = m.tomlInfo || m.toml_info || {};
    return {
      code: assetId.split('-')[0],
      price: +m.price || null,
      // stellar.expert returns {total, authorized, funded}; this read [0], which is undefined on an
      // object, so it reported 0 for every asset. Both shapes read — see _searchassets.js, fixed earlier
      // for the same upstream change.
      trustlines: (function (t) { return !t ? 0 : (t.total != null ? +t.total || 0 : +t[0] || 0); })(m.trustlines),
      domain: m.domain || '',
      image: toml.image || '',
      name: toml.name || '',
      desc: String(toml.desc || toml.description || '').slice(0, 400),
    };
  } catch (e) { return null; }
}

// THE CHAIN IS PART OF THE ANSWER (RAZA 2026-10-06: "sweep the wrong-chain titles across all XRPL
// pages"). On the combined deployment this one middleware serves both builds, and every title it
// composed said "on Stellar" — so /trade/xrpl/PHNIX-… arrived titled "PHNIX price, pools and holders
// on Stellar", in the browser tab and, worse, in the HTML a crawler reads.
//
// Named rather than guessed: 'stellar' is the default, so every existing Stellar url produces the same
// bytes it did before and this is additive for that build.
const NET_NAME = { stellar: 'Stellar', xrpl: 'the XRP Ledger' };
const NET_NATIVE = { stellar: 'XLM', xrpl: 'XRP' };
function netName(c){ return NET_NAME[c] || NET_NAME.stellar; }
function netNative(c){ return NET_NATIVE[c] || NET_NATIVE.stellar; }

function assetSeo(f, assetId, chain){
  const code = f ? f.code : assetId.split('-')[0];
  const net = netName(chain);
  const bits = [];
  const px = f && fmtUsd(f.price);
  if (px) bits.push('Price ' + px);
  if (f && f.trustlines) bits.push(f.trustlines.toLocaleString('en-US') + ' trustlines');
  if (f && f.domain) bits.push('issued by ' + f.domain);
  const facts = bits.length ? bits.join(' · ') + '. ' : '';
  return {
    title: code + ' price, pools and holders on ' + net + ' | LumosCore',
    // Search results truncate around 160 characters and the FACTS are the half worth showing, so
    // the boilerplate tail is trimmed rather than the price and trustline count.
    desc: (facts + code + ' price, pools, holders and trades on ' + net + '. Trade non-custodially.')
      .slice(0, 158),
    image: (f && f.image) || '',
  };
}

function poolSeo(a, b, img, chain){
  const nat = netNative(chain);
  const A = a === 'native' ? nat : a.split('-')[0];
  const B = b === 'native' ? nat : b.split('-')[0];
  const net = netName(chain);
  return {
    title: A + ' / ' + B + ' liquidity pool on ' + net + ' | LumosCore',
    desc: 'Reserves, total value locked, 24h volume and fees for the ' + A + ' / ' + B
      + ' liquidity pool on ' + net + '. Add or withdraw liquidity from your own wallet.',
    image: img || '',
  };
}

// A POOL NAMED BY ITS OWN ID IS NOT A PAIR. /pools/<chain>/id/<account> was being read by the pair
// rule — segs[2] and segs[3] are "id" and the account — so it published, literally, "id /
// rPivZEebGS9XSLKZbrR4Yqc8t97A4GR3wH liquidity pool on Stellar". Both chains serve this url shape and
// both had it.
//
// The id is shortened the way the page itself prints it, which also keeps each pool's title distinct:
// one shared title across every pool url is the duplicate-content problem this whole layer exists to
// avoid.
//
// THE PAIR IS NAMED WHEN WE KNOW IT, AND THE ACCOUNT WHEN WE DO NOT. This used to read "the pair is
// not named because the edge does not know it without a lookup, and a title that guesses is worse
// than one that is merely general" -- which is right about guessing and is answered by knowing in
// advance rather than by looking up. POOL_PAIRS is built at build time, and it is safe to bake for
// one specific reason: AN AMM ACCOUNT'S PAIR NEVER CHANGES. An AMM is created for one asset pair and
// its pseudo-account exists to hold that pair; nothing repoints an existing AMM at other assets. So
// the table can be incomplete, and an account missing from it falls through to exactly the title it
// had before -- but an entry in it cannot have gone stale.
//
// The format matches poolSeo() above character for character, so the two url shapes for the same
// pool do not describe it differently.
function poolIdSeo(id, chain){
  const net = netName(chain);
  const short = id.length > 12 ? id.slice(0, 6) + '…' + id.slice(-4) : id;
  const pair = POOL_PAIRS[id];
  if (pair) {
    return {
      title: pair + ' liquidity pool on ' + net + ' | LumosCore',
      desc: 'Reserves, total value locked, 24h volume and fees for the ' + pair
        + ' liquidity pool on ' + net + '. Add or withdraw liquidity from your own wallet.',
      image: '',
    };
  }
  return {
    title: 'Liquidity pool ' + short + ' on ' + net + ' | LumosCore',
    desc: 'Reserves, total value locked, 24h volume and fees for ' + net + ' liquidity pool '
      + short + '. Add or withdraw liquidity from your own wallet.',
    image: '',
  };
}

// A purpose-built card is landscape; an asset's toml logo is a small square (SHX's is 128x128).
// Declaring a square as a large-image card is why scrapers dropped it and used the favicon instead.
// ---- og:image dimensions -------------------------------------------------------------------------
// Read from the image's own header, cached in KV, and emitted only when both values are real. See the
// note in the commit: none is always preferable to wrong.
const DIM_KEY = 'imgdim:';
const DIM_TTL = 60 * 60 * 24 * 365;

// Only our own uploaded media. A foreign URL is never fetched and never measured.
function mediaIdOf(u){
  try {
    // Our origin and our media endpoint, or nothing. The id pattern alone also matches a cover
    // pointing at another host, and learnImgDims would then go and fetch it.
    if (String(u || '').indexOf(PRIMARY_ORIGIN + '/lxapi/media?') !== 0) return '';
    const m = /[?&]id=([0-9a-f]{32}\\.[a-z0-9]{2,5})/i.exec(String(u || ''));
    return m ? m[1].toLowerCase() : '';
  } catch (e) { return ''; }
}

// Header-only parsers. Anything unrecognised returns null rather than a guess.
function parseImgDims(b){
  try {
    if (!b || b.length < 24) return null;
    const be16 = (i) => (b[i] << 8) | b[i + 1];
    const be32 = (i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    const le16 = (i) => b[i] | (b[i + 1] << 8);
    // PNG: IHDR is always the first chunk
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
      return { w: be32(16), h: be32(20) };
    }
    // GIF87a / GIF89a
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) {
      return { w: le16(6), h: le16(8) };
    }
    // WebP: RIFF....WEBP
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
        b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
      const c = String.fromCharCode(b[12], b[13], b[14], b[15]);
      if (c === 'VP8X') return { w: (b[24] | (b[25] << 8) | (b[26] << 16)) + 1,
                                 h: (b[27] | (b[28] << 8) | (b[29] << 16)) + 1 };
      if (c === 'VP8 ') return { w: le16(26) & 0x3fff, h: le16(28) & 0x3fff };
      return null;                                   // VP8L and friends: not worth a fragile parser
    }
    // JPEG: walk the segments to the first start-of-frame
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
        const len = be16(i + 2);
        if (len < 2) return null;
        const isSOF = (m >= 0xc0 && m <= 0xcf) && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
        if (isSOF) return { h: be16(i + 5), w: be16(i + 7) };
        i += 2 + len;
      }
      return null;                                    // header not inside the range we fetched
    }
    return null;
  } catch (e) { return null; }
}

// What we already know. One cheap get; never fetches, never blocks on anything.
async function imgDims(env, url){
  try {
    const kv = env && env.CONTENT_KV; if (!kv) return null;
    const id = mediaIdOf(url); if (!id) return null;
    const d = await kv.get(DIM_KEY + id, 'json');
    if (!d) return null;
    const w = +d.w, h = +d.h;
    return (w > 0 && h > 0 && w < 100000 && h < 100000) ? { w, h } : null;
  } catch (e) { return null; }
}

// Learn them for next time. waitUntil only -- this must never be awaited on the response path.
async function learnImgDims(env, url){
  try {
    const kv = env && env.CONTENT_KV; if (!kv) return;
    const id = mediaIdOf(url); if (!id) return;
    if (await kv.get(DIM_KEY + id, 'json')) return;   // already known
    const r = await fetch(url, { headers: { range: 'bytes=0-65535' }, cf: { cacheTtlByStatus: { '200-299': 300, '300-399': 0, '400-599': 0 } } });
    if (!r.ok && r.status !== 206) return;
    const d = parseImgDims(new Uint8Array(await r.arrayBuffer()));
    if (!d || !(d.w > 0) || !(d.h > 0)) return;
    await kv.put(DIM_KEY + id, JSON.stringify({ w: d.w, h: d.h }), { expirationTtl: DIM_TTL });
  } catch (e) { /* a missing dimension costs nothing; a thrown one would cost the page */ }
}
// Both of our own 1200x630 cards: the per-asset one built on demand by /lxapi/ogcard, and the
// per-section ones _tools/_ogsection.js draws into assets/og/s/ at build time. Recognising a card
// is what earns it the large Twitter layout and lets the dimensions be stated as the constants they
// are, rather than measured.
function isCardImage(u){
  const s = String(u || '');
  return s.indexOf('/lxapi/ogcard') >= 0 || s.indexOf('/lxapi/ogpool') >= 0
    || s.indexOf('/lxapi/ogxrpl') >= 0 || s.indexOf('/assets/og/s/') >= 0;
}

// One pool's card. Every pool is pointed at the endpoint, which serves the drawn card for the top
// hundred on that chain and the chain's pools card for the rest -- so the list of which hundred were
// drawn stays a property of the build instead of something to keep in step here too.
function poolCardFor(chain, id){
  if (!id) return '';
  return PRIMARY_ORIGIN + '/lxapi/ogpool?p=' + (chain === 'xrpl' ? 'xrpl' : 'stellar') + '-' + encodeURIComponent(id);
}

// The one XRPL asset with a card of its own; see the asset branch for why it is the only one.
const XRPL_LUMOS = 'LUMOS-rsPqeamjpr3Bxu4LhtCgvJEAQusYRRg6Ha';

// Section routes that have a card drawn for them. Keyed on the canonical path. Only the image is
// taken from here: the title and description are already correct in the built page, and copying
// them into the edge would be two places to keep in step for no gain.
const SECTION_CARD = {
  '/trade': 'trade',
  '/trade/stellar': 'trade-stellar',
  '/trade/xrpl': 'trade-xrpl',
  '/pools': 'pools',
  '/pools/stellar': 'pools-stellar',
  '/pools/xrpl': 'pools-xrpl',
  '/bridge': 'bridge',
  '/bridge/stellar': 'bridge-stellar',
  '/bridge/xrpl': 'bridge-xrpl',
  '/lumos': 'lumos',
  '/lumos/stellar': 'lumos-stellar',
  '/lumos/xrpl': 'lumos-xrpl',
  '/rewards': 'rewards',
  '/rewards/stellar': 'rewards-stellar',
  '/rewards/xrpl': 'rewards-xrpl',
  '/whitepaper': 'whitepaper',
  '/list-your-token': 'list-your-token',
};

// The card for everything with no better answer: the docs, the legal pages, the footer links, a
// blog post published without a cover. It names the product and the two chains and claims nothing
// else, because it has to stay true of every page that falls back to it.
const GENERAL_CARD = '/assets/og/s/general.png';

// Two whole sections share a card rather than each page being listed: all 17 docs pages are docs,
// and a blog post published without a cover is still the blog. Matched on the prefix so a page added
// to either tomorrow inherits the right card instead of dropping to the general one.
function fallbackCard(p){
  // /faq is here because it is a docs page that does not look like one from its path: CANON_OF
  // rewrites /docs/faq to /faq, so the prefix alone misses it. ("/docs" canonicalises to
  // "/docs/introduction", which the prefix still catches.) Caught by checking the built output
  // rather than the rule -- it was the one page of seventeen serving the general card.
  if (p === '/faq') return '/assets/og/s/docs.png';
  if (p === '/docs' || p.indexOf('/docs/') === 0) return '/assets/og/s/docs.png';
  if (p === '/blog' || p.indexOf('/blog/') === 0) return '/assets/og/s/blog.png';
  return GENERAL_CARD;
}

// A 1200x630 card: the asset's logo padded onto the brand background. Built through Cloudflare's
// resizing, whose source must be on this zone -- hence /lxapi/logoimg re-serving foreign logos.
// One plain URL. The 1200x630 padding happens inside the endpoint, so nothing is nested here.
function cardFor(assetId){
  if (!assetId) return '';
  return PRIMARY_ORIGIN + '/lxapi/ogcard?asset=' + encodeURIComponent(assetId);
}

// The logo an admin uploaded for an asset, which the issuer's toml knows nothing about.
async function adminImage(env, assetId){
  try {
    const kv = env && env.CONTENT_KV;
    if (!kv || !assetId) return '';
    const ov = await kv.get('asset:' + assetId, 'json');
    return (ov && ov.image) || '';
  } catch (e) { return ''; }
}
// og:image is fetched by a scraper with no page context, so a relative path is useless to it.
function absUrl(u){
  const v = String(u || '');
  if (!v) return '';
  if (v.indexOf('//') === 0) return 'https:' + v;
  if (v.indexOf('/') === 0) return PRIMARY_ORIGIN + v;
  return v;
}

// A published post, read from the same KV the blog itself reads. Unpublished or missing returns null
// so the page keeps its template SEO rather than advertising something that is not there.
async function blogPost(env, slug){
  try {
    const kv = env && env.CONTENT_KV;
    if (!kv || !slug) return null;
    const p = await kv.get('blog:post:' + slug, 'json');
    if (!p || p.published === false) return null;
    return p;
  } catch (e) { return null; }
}

// THE SAME READ, BUT ABLE TO SAY WHY IT FOUND NOTHING -- which blogPost above cannot, and that is the
// whole reason this exists.
//
// /blog/<any-slug-at-all> answered HTTP 200. Measured on production: a deleted-looking slug returned a
// 420KB page titled "LumosCore Blog", stamped index/follow, CANONICALISING TO ITSELF, carrying a
// description left over from an unrelated post about liquidity pools. That is a soft 404, and a soft
// 404 is the one thing Google will never drop, because 200 means the page is fine. Every deleted post,
// every renamed slug (editing a title rewrites it) and every typo became a permanent indexable page
// in an unbounded url space. This is the likeliest source of the stale results RAZA found with
// site:lumoscore.com, and unlike a real 404 it could not expire.
//
// blogPost returns null for FIVE different situations: no KV binding, no slug, no record, an
// unpublished record, and a thrown error. Refusing the page on null would therefore mean that one KV
// wobble 404s all twelve real posts -- strictly worse than the bug being fixed, and the same trap the
// asset-id note further down refuses to walk into. So this reports the DECISION separately:
//
//   decided:true  the read came back and there is genuinely no record at this slug -> safe to refuse
//   decided:false we could not tell (no binding, or the read threw) -> serve the page, as before
//
// Only the no-record case is decided. An UNPUBLISHED or scheduled record is left alone deliberately:
// it exists, it is somebody's draft, and refusing it could break an admin preview -- a narrower
// question than the one being fixed here.
async function blogLookup(env, slug){
  const kv = env && env.CONTENT_KV;
  if (!kv || !slug) return { post: null, decided: false };
  try {
    const p = await kv.get('blog:post:' + slug, 'json');
    if (p) return { post: p.published === false ? null : p, decided: false };
    return { post: null, decided: true };
  } catch (e) { return { post: null, decided: false }; }
}
// The index, for the same reason the post body is read: /blog ships an empty grid that the browser
// fills, so a crawler saw an index of nothing -- 24 links, not one of them to a post. The four posts
// are in sitemap.xml so they are discoverable, but a sitemap conveys existence and nothing else: no
// internal links means no authority flowing to them and no topical context, on exactly the pages the
// backlink campaign is meant to lift.
//
// Same filter the public endpoint applies, so a scheduled post is not linked before it is live.
async function blogIndex(env){
  try {
    const kv = env && env.CONTENT_KV;
    if (!kv) return [];
    const idx = (await kv.get('blog:index', 'json')) || [];
    const now = Date.now();
    return idx.filter((p) => p && p.published && (!p.publishAt || p.publishAt <= now));
  } catch (e) { return []; }
}
// Whitespace, built without a backslash: this whole function lives inside a template literal, where a
// backslash is eaten on the way out. Writing /BACKSLASH-s+/g here produced /s+/g, which matched the
// letter s and quietly deleted every one of them from the description.
const WS_RE = new RegExp('[' + String.fromCharCode(32, 9, 10, 13) + ']+', 'g');

// The excerpt if the author wrote one, otherwise the opening of the body with its markup removed.
function blogDesc(p){
  const ex = String((p && p.excerpt) || '').trim();
  if (ex) return ex.slice(0, 300);
  const body = String((p && p.body) || '')
    .replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(WS_RE, ' ').trim();
  return body.slice(0, 155) + (body.length > 155 ? '…' : '');
}
function blogSeo(p, origin){
  // The stored title already ends in "| LumosCore" on existing posts, so it is not appended twice.
  const t = String((p && p.title) || '').trim();
  // endsWith rather than a pattern: no backslash to lose, and it says what it means.
  const title = t.toLowerCase().replace(WS_RE, ' ').trim().endsWith('lumoscore')
    ? t : (t + ' | LumosCore');
  const cover = String((p && p.cover) || '');
  return {
    title,
    desc: blogDesc(p),
    image: cover ? (cover.indexOf('/') === 0 ? origin + cover : cover) : '',
    // A post cover is a wide editorial image, so it earns the large card. isCardImage() only
    // recognises our generated /lxapi/ogcard, which a cover is not.
    largeCard: !!cover,
    post: p,
  };
}

// The network choosers. A hub and its Stellar page SHARE A FILE and differ only by what the head
// gate shows, so to a crawler that does not run JavaScript they would otherwise be the same document
// down to the title -- the duplicate-pair problem the alias flag exists to prevent, reintroduced at
// five new urls. These give each hub its own title and description at the edge.
const HUB_SEO = {
  '/trade': {
    title: 'Trade on LumosCore — Choose a network',
    desc: 'Swap assets and place limit orders on-chain. Choose a network to see its markets, prices and pairs on LumosCore.',
  },
  '/pools': {
    title: 'Liquidity Pools on LumosCore — Choose a network',
    desc: 'Provide liquidity and earn a share of the trading fees. Choose a network to see its pools, TVL and volume on LumosCore.',
  },
  '/bridge': {
    title: 'Bridge assets with LumosCore — Choose a network',
    desc: 'Move assets between networks with Circle CCTP, LayerZero and NEAR Intents. Choose the network you are bridging from.',
  },
  '/rewards': {
    title: 'LUMOS Rewards — Choose a network',
    desc: 'Liquidity and holder rewards, paid out each round. Choose a network to see its rounds and your share.',
  },
  '/lumos': {
    title: 'LUMOS token — Choose a network',
    desc: 'LumosCore’s native token. Choose a network to see its price, pools and holders on that chain.',
  },
};

// A PATH SEGMENT IS ENCODED; AN ASSET ID IS NOT. A ticker may contain characters a url has to
// escape, and nine of the XRPL assets in the sitemap start with a dollar sign. Taking segs[2] raw
// published a title reading "%24FLIPPY price, pools and holders on the XRP Ledger", and sent
// "/lxapi/ogxrpl?a=%2524FLIPPY-..." for the card, because encodeURIComponent ran over an already
// encoded string. Decoding once here fixes both, and is the point where every id enters.
//
// Malformed input keeps its original form rather than throwing, which is the same choice
// malformedId() makes just below for the same reason: a bad percent sequence is a 404 to answer, not
// an exception to raise inside the SEO layer.
function decSeg(x){
  try { return decodeURIComponent(x); } catch (e) { return x; }
}

function seoFor(pathname){
  const segs = pathname.split('/').filter(Boolean);
  // segs[1] names the chain on every parameterised route — /trade/<chain>/<asset>,
  // /pools/<chain>/<a>/<b>, /pools/<chain>/id/<account>. Anything that is not 'xrpl' is Stellar, so
  // every url this build already served keeps its exact wording.
  const chain = segs[1] === 'xrpl' ? 'xrpl' : 'stellar';
  if ((segs[0] === 'trade' || segs[0] === 'asset') && segs[2]) return { kind: 'asset', id: decSeg(segs[2]), chain };
  // Before the pair rule, or "id" becomes the first asset of the pair.
  if (segs[0] === 'pools' && segs[2] === 'id' && segs[3]) return { kind: 'poolid', id: decSeg(segs[3]), chain };
  if (segs[0] === 'pools' && segs[2] && segs[3]) return { kind: 'pool', a: decSeg(segs[2]), b: decSeg(segs[3]), chain };
  if (segs[0] === 'blog' && segs[1]) return { kind: 'blog', slug: decSeg(segs[1]) };
  // exactly one segment, so /trade is the hub and /trade/stellar is not
  if (segs.length === 1 && HUB_SEO['/' + segs[0]]) return { kind: 'hub', id: '/' + segs[0] };
  return null;
}

// Replaces an element's text. Used on the asset identity block, whose shipped markup is the design's
// USDC sample: without this, every asset page tells a non-rendering crawler it is USD Coin.
// NOTE the property is v, not text: naming it "text" shadows the text() handler HTMLRewriter calls
// on this same object, which is exactly how this threw Error 1101 on every asset page.
//
// mode 'inner' replaces the element's contents outright — correct where the element holds only text.
// mode 'text' rewrites text nodes only, leaving child elements alone; a.website holds an SVG icon
// beside the domain and would lose it otherwise.
class TextSetter {
  constructor(v, mode){
    this.v = String(v == null ? '' : v);
    this.mode = mode === 'text' ? 'text' : 'inner';
    this.first = true;
  }
  element(el){
    this.first = true;
    if (this.mode === 'inner') el.setInnerContent(this.v);
  }
  text(chunk){
    if (this.mode === 'inner') return;
    const t = chunk.text;
    if (!t || !t.trim()) return;              // whitespace between the icon and the label
    chunk.replace(this.first ? this.v : '', { html: false });
    this.first = false;
  }
}

// Writes stored HTML into an element. Only the blog body uses this, and only with markup that came
// back through the sanitiser in lxapi/blog.js -- setInnerContent with html:true is parsed as real
// markup, so a <script> in there would RUN, where the client's innerHTML would not have executed it.
// That difference is the whole reason the allowlist moved server-side.
class HtmlSetter {
  constructor(html){ this.html = String(html == null ? '' : html); }
  element(el){ if (this.html) el.setInnerContent(this.html, { html: true }); }
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

  // Two passes, so this agrees with the clean-url map rather than depending on route order: a hub is
  // preferred, and an alias is never a destination. The app assigns location.href="lumoscore-bridge.html"
  // in a dozen places, and that is a menu navigation like any other -- it should reach the chooser.
  for (const r of ROUTES){
    if (r[0].indexOf('/:') >= 0 || r[3] !== 'hub') continue;
    if (r[1].replace(/-(dark|light|mobile)$/, '') === base) return r[0];
  }
  for (const r of ROUTES){
    if (r[0].indexOf('/:') >= 0 || r[3]) continue;
    if (r[1].replace(/-(dark|light|mobile)$/, '') === base) return r[0];
  }
  return null;
}

// Shapes, not existence. A Stellar public key is 56 characters of base32 starting with G; an asset id
// is CODE-ISSUER; a pool id is 64 hex. Built with String.fromCharCode where a character class would
// otherwise need a backslash, because this whole file is emitted from a template literal and a lone
// backslash does not survive the trip.
const G_RE = new RegExp('^G[A-Z2-7]{55}$');
const ASSET_RE = new RegExp('^[A-Za-z0-9]{1,12}-G[A-Z2-7]{55}$');
const POOLID_RE = new RegExp('^[0-9a-fA-F]{64}$');

// THE XRPL SHAPES, which this guard did not have. It only ever tested s[1] === 'stellar', so every
// /trade/xrpl, /pools/xrpl and /account/xrpl url reached the SEO layer whatever was in it:
// /trade/xrpl/totaljunk answered 200 titled "totaljunk price, pools and holders on the XRP Ledger",
// and /pools/xrpl/id/totaljunk answered 200 as a liquidity pool. Both are measured, not supposed.
// That is the same fabrication the Stellar half exists to prevent, and it is how a crafted segment
// reached the ld+json emitter.
//
// An account is 'r' and 24-34 base58 characters -- base58 being why 0, O, I and l are absent.
// An asset is CODE-ISSUER with the issuer an account, which is what the asset page itself requires:
// it splits on the LAST dash, so a dash inside a ticker is fine and the greedy class below finds the
// right one by backtracking.
//
// THE CODE CLASS IS DELIBERATELY WIDE. XRPL tickers are not alphanumeric the way Stellar's are: a
// currency is either three characters or forty hex digits decoded back to as many as twenty, and
// across the 398 assets currently in the sitemap the codes already use $, = and . besides letters and
// digits. Constraining it to what today's roster happens to contain would 404 a legitimate token
// tomorrow, so the rule is only what the url and the page actually require -- printable, no slash,
// at most twenty characters. Built from char codes because a backslash does not survive the template
// literal this file is emitted from, which is the same reason the three constants above avoid them.
const X_PRINT = '[' + String.fromCharCode(33) + '-' + String.fromCharCode(46)
  + String.fromCharCode(48) + '-' + String.fromCharCode(126) + ']';   // ! to ~, minus "/"
const X_ACCT = 'r[1-9A-HJ-NP-Za-km-z]{24,34}';
const XACCT_RE = new RegExp('^' + X_ACCT + '$');
const XASSET_RE = new RegExp('^' + X_PRINT + '{1,20}-' + X_ACCT + '$');
function malformedId(pathname){
  const s = pathname.replace(/^\\/+|\\/+$/g, '').split('/').filter(Boolean);
  // A percent-encoded segment that will not decode is malformed by definition, so the original is
  // tested and fails the shape check rather than throwing.
  const dec = (x) => { try { return decodeURIComponent(x); } catch (e) { return x; } };
  if (s[0] === 'trade' && s[1] === 'stellar' && s.length === 3){
    return !ASSET_RE.test(dec(s[2]));
  }
  if (s[0] === 'account' && s[1] === 'stellar' && s.length === 3){
    return !G_RE.test(dec(s[2]));
  }
  if (s[0] === 'pools' && s[1] === 'stellar' && s[2] === 'id' && s.length === 4){
    return !POOLID_RE.test(dec(s[3]));
  }
  // The pair form. "native" is XLM and has no issuer, so it is the one value that is not an asset id.
  if (s[0] === 'pools' && s[1] === 'stellar' && s.length === 4){
    const okSide = (x) => x === 'native' || ASSET_RE.test(x);
    return !(okSide(dec(s[2])) && okSide(dec(s[3])));
  }

  // ---- the same four shapes on XRPL ----
  if (s[0] === 'trade' && s[1] === 'xrpl' && s.length === 3){
    return !XASSET_RE.test(dec(s[2]));
  }
  if (s[0] === 'account' && s[1] === 'xrpl' && s.length === 3){
    return !XACCT_RE.test(dec(s[2]));
  }
  // An XRPL pool is named by its AMM ACCOUNT, not by a 64-hex id -- that is Stellar's shape and the
  // one above. Everything this build links to is this form.
  if (s[0] === 'pools' && s[1] === 'xrpl' && s[2] === 'id' && s.length === 4){
    return !XACCT_RE.test(dec(s[3]));
  }
  // The pair form, which the route table serves and nothing in the build currently links to. BOTH
  // native markers are accepted because both render: /pools/xrpl/XRP/RLUSD-rMxC… and
  // /pools/xrpl/native/RLUSD-rMxC… each answer 200 with "XRP / RLUSD liquidity pool" today, and a
  // guard that 404'd either would be breaking a working url to tidy up an unused one.
  if (s[0] === 'pools' && s[1] === 'xrpl' && s.length === 4){
    const okX = (x) => x === 'native' || x === 'XRP' || XASSET_RE.test(x);
    return !(okX(dec(s[2])) && okX(dec(s[3])));
  }
  return false;
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

  // 0b) A TRAILING SLASH IS THE SAME PAGE, so it must redirect rather than 404.
  //
  // Every path answered 404 with a slash on the end: /blog/, /about/, /docs/, /faq/, /lumos/,
  // /bridge/. People append them by habit, directory forms normalise to them, and forum software adds
  // them -- so each was a dead link carrying nothing, and a backlink placed on the wrong form of the
  // url was simply wasted.
  //
  // 301, because the canonical form is the one without. Query and hash ride along. The root is left
  // alone: "/" IS the canonical path and trimming it would loop.
  //
  // GET and HEAD only. A 301 on a POST is turned into a GET by most clients and the body is dropped,
  // so an api call that happened to carry a trailing slash would fail silently rather than loudly.
  const navMethod = request.method === 'GET' || request.method === 'HEAD';
  if (navMethod && url.pathname.length > 1 && url.pathname.endsWith('/')){
    const to = new URL(url.toString());
    to.pathname = url.pathname.replace(/\\/+$/, '');
    if (to.pathname === '') to.pathname = '/';
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

  // 1c) THE THREE OPEN URL PATTERNS. /trade/stellar/:asset, /account/stellar/:address and the two
  // /pools/stellar forms accepted literally any string, returned 200, built a unique title out of the
  // junk and self-canonicalised to it -- an unbounded space of indexable pages that burns crawl budget
  // and dilutes the real asset pages.
  //
  // AFTER THE REDIRECTS ABOVE, NOT BEFORE THEM. Placed first, this 404ed every url the app itself
  // navigates to: the pool page is reached by assigning location.href="lumoscore-amm-pool.html?pool=..."
  // from a page already at /trade/stellar/..., so the browser asks for
  // /trade/stellar/lumoscore-amm-pool.html -- three segments under /trade/stellar, whose last one is a
  // filename and not an asset id. legacyClean exists precisely to redirect that, and it never got the
  // chance. Every Pools-pool page on production returned "Not found" until this moved down.
  //
  // FORMAT ONLY, deliberately. Checking that the asset actually EXISTS would need an upstream call on
  // every request, and that upstream is exactly the one already proven to fail intermittently -- a
  // wobble there would start 404ing real assets, which is far worse than serving a well-formed one
  // that happens to be empty. A Stellar issuer is 56 base32 characters; a crawler does not invent
  // those, so the space stops being unbounded.
  if (malformedId(url.pathname)){
    return new Response('Not found', {
      status: 404,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'public, max-age=300',
        'x-robots-tag': 'noindex, nofollow',
      },
    });
  }

  // /mcp IS TWO THINGS ON ONE URL: the marketing page on GET, and the remote MCP server on POST
  // (functions/mcp.js). Without this line a POST falls into the page branch below, and a client whose
  // user agent happens to look like a phone is handed the mobile HTML page in reply to a JSON-RPC call.
  if (url.pathname === '/mcp' && !navMethod) return next();

  const hit = match(url.pathname);

  // AN XRPL PAGE IS A PAGE, even though match() cannot see it.
  //
  // match() is built from the ROUTES table, which is Stellar's. The XRPL urls are _redirects
  // 200-rewrites to /x/<file> that _mergexrpl.js prepends to dist/_redirects, so they are not in it
  // -- and the "if (!hit) return next()" below therefore returned before any of the SEO work for every
  // single one of them. Measured on staging 2026-10-09: /trade/xrpl, /trade/xrpl/<asset>,
  // /pools/xrpl, /bridge/xrpl, /rewards/xrpl and /lumos/xrpl served NO og:image and NO canonical,
  // while their Stellar twins served the full set. Every XRPL share card -- the hundred asset cards,
  // the section cards, the pool cards -- was unreachable by a crawler, and the endpoint serving them
  // worked perfectly the whole time, which is exactly why it went unnoticed.
  //
  // Everything downstream was already waiting for these paths: seoFor() reads the chain out of
  // segs[1], SECTION_CARD has all five XRPL hubs, and the asset branch builds /lxapi/ogxrpl. Nothing
  // there needed changing. Only this gate.
  //
  // NO FILE SWAP for them. Every line below that reads hit.desktop / hit.mobile picks WHICH file to
  // serve, and _redirects has already made that choice for an XRPL url. So xrplPage takes the
  // response from next() untouched and joins at the HTML rewrite, leaving Stellar's matching, its
  // mobile build and its chain swap byte-for-byte as they were.
  //
  // The substring test runs first so the nine regexes are never walked for a Stellar url, which is
  // every url but these. XRPL_PAGE itself is compiled once at module scope, not per request.
  const xrplPage = !hit && url.pathname.indexOf('/xrpl') > 0 && isXrplPage(url.pathname);

  // not a page route -> let Pages serve it as usual
  if (!hit && !xrplPage) return next();

  // WHICH BUILD A TABLET GETS. The user agent alone cannot answer this: Chrome's "Desktop site" is
  // remembered per site, and with it on an Android tablet sends a plain Linux UA -- indistinguishable
  // from a laptop here. That is why RAZA's tablet showed the side rail one minute and the bottom bar
  // the next, and why the desktop build's transaction table and landing page were being squeezed into
  // a tablet (2026-09-21). Two more signals answer it:
  //   - client hints. Chrome keeps sending the real platform, so Sec-CH-UA-Platform still says Android
  //     (and sec-ch-ua-mobile ?1 on a phone) even when the UA string has been rewritten.
  //   - the lxdev cookie, set by the page itself when it finds it is a touch device of tablet size
  //     looking at the desktop build. That covers any browser whose hints are stripped.
  const ua = request.headers.get('user-agent') || '';
  const chPlat = (request.headers.get('sec-ch-ua-platform') || '').replace(/"/g, '');
  const chMob = (request.headers.get('sec-ch-ua-mobile') || '');
  const cookie = request.headers.get('cookie') || '';
  const forcedMobile = /(?:^|;\\s*)lxdev=m(?:;|$)/.test(cookie);
  const forcedDesktop = /(?:^|;\\s*)lxdev=d(?:;|$)/.test(cookie);
  const isMobile = !forcedDesktop && (MOBILE.test(ua) || chPlat === 'Android' || chMob === '?1' || forcedMobile);
  // A "hit &&" guard on each of these: an XRPL page has no row in the ROUTES table, and the whole point of
  // this block is choosing between that row's desktop and mobile files. _redirects already chose for
  // it, so wantMobile stays false, baseFile stays empty, altFile stays null and fetchFile stays null
  // -- which lands on the await next() below, the response Pages was going to serve anyway.
  const wantMobile = !!hit && isMobile && HAS_MOBILE.has(hit.mobile);

  // WHICH CHAIN'S BUILD, for the pages that have one per chain.
  //
  // A COOKIE, because this decision is the server's and localStorage never reaches it. Both connect
  // layers write lx_chain when a wallet connects and clear it on disconnect, so the default — no
  // cookie, nobody connected — is the Stellar build, exactly as before.
  // A CHAIN NAMED IN THE PATH BEATS THE COOKIE. The cookie answers "which chain is connected", which
  // is the right question for a BARE authgated url (/dashboard, /wallet, /launchpad) and the wrong one
  // for a url that already says. /launchpad/stellar is the only route that is both chain-qualified and
  // mapped in CHAIN_ALT, and measured on the deployed build it served the XRPL launchpad -- seven
  // xrplcluster references, no Stellar one -- to anyone carrying lx_chain=xrpl. A url that names a
  // network and serves the other one is worse than either answer on its own.
  const pathChain = /\\/stellar(\\/|$)/.test(url.pathname) ? 'stellar'
    : (/\\/xrpl(\\/|$)/.test(url.pathname) ? 'xrpl' : '');
  const chain = pathChain || (/(?:^|;\\s*)lx_chain=xrpl(?:;|$)/.test(cookie) ? 'xrpl' : 'stellar');
  const baseFile = hit ? (wantMobile ? hit.mobile : hit.desktop) : '';
  const altFile = (!hit || chain === 'stellar') ? null : CHAIN_ALT[chain + ' ' + baseFile];

  // Desktop needs no rewrite — Pages already serves the right file for this url. Rewriting anyway
  // broke "/", whose desktop file is index: fetching /index just 308s back to /.
  // Vary is still set on BOTH branches, or a cache would hand a desktop page to a phone.
  const fetchFile = altFile || (wantMobile ? hit.mobile : null);
  const res = fetchFile
    ? await context.env.ASSETS.fetch(
        new Request(new URL('/' + fetchFile, request.url).toString(), request))
    : await next();

  let out = new Response(res.body, res);
  // COOKIE BELONGS IN Vary, and not only for the chain. lxdev already changed which build this returns
  // while Vary named User-Agent alone, so a shared cache could hand one reader's variant to another.
  // The chain split makes that far worse — it would be one network's private dashboard served to
  // somebody connected to the other.
  //
  // NOT FOR AN XRPL PAGE, at this writer or the one at the end, and the two conditions must stay
  // identical for the reason given there. _redirects maps each XRPL url to exactly one file, so the
  // response varies by neither the user agent nor the chain cookie; "Vary: User-Agent" would split
  // the edge cache for them by browser and buy nothing. They carried no Vary from us before this
  // change either, so their caching is left exactly as it was.
  if (!xrplPage) out.headers.set('Vary', 'User-Agent, Cookie');

  const ct = out.headers.get('content-type') || '';
  if (ct.indexOf('text/html') < 0) return out;

  // canonical is the clean url WITHOUT query or hash, on whatever host served this request
  //
  // EXCEPT for an alias. Two urls for one page -- identical title, description, h1 and body, each
  // canonicalising to itself -- means neither defers and Google has to pick. /docs vs
  // /docs/introduction was fixed by hand here; the same shape then reappeared four more times
  // (/bridge, /rewards, /lumos, /faq) because nothing stopped it. This map is now GENERATED from the
  // route table's alias flag, so every pair is covered and a new one cannot be added without it.
  // Both urls keep serving; only the signal changes.
  const CANON_OF = ${canonOfJson(routePairs)};
  const cleanPath = url.pathname === '/' ? '/' : url.pathname.replace(/\\/+$/, '');

  // THE UNLISTED PATHS, AS A RESPONSE HEADER. Generated from SITEMAP_SKIP, so "kept out of the
  // sitemap" and "told not to index" are ONE decision in ONE place and cannot drift apart. That they
  // had drifted is the whole reason this exists.
  //
  // /dashboard and /wallet were gated, listed in the sitemap, and stamped "index, follow". The gate on
  // them is CLIENT-SIDE -- lx-authgate reads localStorage and calls location.replace("/") -- so a
  // crawler, having neither, got HTTP 200 and the entire app shell: 383KB and 427KB measured against
  // production with Googlebot's user agent on 2026-10-10, carrying placeholder dollar figures under a
  // title promising the reader their own portfolio. _mc_engine.js asserted these were "never indexed".
  //
  // Nothing private was exposed -- real balances load at runtime from a wallet the crawler does not
  // have -- but a gated app surface does not belong in a search result, and that page is a
  // thin-content signal against the whole domain.
  //
  // THIS IS THE THIRD DEFENCE, and the only one that holds without the markup: _seo.js writes the
  // noindex meta and the sitemap omits the row, but a <meta> tag is one line inside a 400KB document
  // and this is a header. It is set HERE, in the middleware, rather than in _headers, because these
  // paths are rewrites answered by this function and Pages applies _headers to its own asset
  // responses -- a Function's Response is not guaranteed to inherit them.
  //
  // noarchive too: without it a cached copy can still be served from a result after the page drops out.
  //
  // Keyed on the CLEANED path, so a trailing slash cannot slip past. An ALIAS is also absent from the
  // sitemap but must stay indexable, which is why this reads SITEMAP_SKIP and not the alias flag.
  const NOINDEX_PATHS = ${JSON.stringify([...SITEMAP_SKIP].sort())};
  if (NOINDEX_PATHS.indexOf(cleanPath) >= 0) {
    out.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }

  const canonPath = CANON_OF[cleanPath] || cleanPath;
  const canonical = PRIMARY_ORIGIN + canonPath;
  const want = seoFor(url.pathname);

  let seo = null;
  if (want && want.kind === 'asset') {
    // THE ENRICHMENT IS STELLAR'S, so it is not run for an XRPL asset. assetFacts asks stellar.expert
    // and reads a SEP-1 toml; adminImage and cardFor are keyed on a Stellar asset id. Against an XRPL
    // issuer they cost a round trip to learn nothing, and anything they did return would be a fact
    // about a different chain's token printed under this one's name. The title and description are
    // still the XRPL ones — see assetSeo — so the page is correctly described, just not enriched.
    const stellar = want.chain !== 'xrpl';
    const f = stellar ? await assetFacts(want.id) : null;
    seo = assetSeo(f, want.id, want.chain);
    seo.facts = f;
    // EVERY Stellar asset advertises a card now. The gate here used to require a logo, because the
    // only fallback was that logo padded onto a plain rectangle and a missing one left an empty
    // field of brand colour. /lxapi/ogcard now answers with the trade page's own card when an asset
    // has none of its own, so there is always something branded and legible to point at, and the
    // adminImage/toml lookup that decided it is no longer needed on this path.
    if (stellar) seo.image = cardFor(want.id);
    // XRPL HAS NO CURATED ROSTER, so no XRPL token gets a card drawn from its own metadata: the
    // name, description and icon all come from whoever issued it, and rendering those onto a
    // LumosCore-branded 1200x630 image would publish an endorsement nobody made. Every XRPL asset
    // therefore shows the chain's trade card -- the same rule an uncurated Stellar asset follows.
    // LUMOS is the exception, being ours, with a fixed and blackholed issuer.
    // XRPL ASSETS GET A CARD FOR THE TOP HUNDRED BY 24H VOLUME, and the chain's trade card for the
    // rest -- the endpoint decides, so which hundred were drawn stays a property of the build. The
    // bound is the point: XRPL has no curated roster and a token's name and icon are its issuer's to
    // choose, so the cards are limited to the one filter that costs something to pass. The card
    // carries the issuer ADDRESS and no issuer name for the same reason -- a name can be copied, an
    // address cannot, and it is what tells a reader which USDC they are looking at.
    //
    // LUMOS keeps the card its own token page uses: same token, described the same way, so two
    // near-identical files would only be two things to keep in step.
    else if (want.id === XRPL_LUMOS) seo.image = '/assets/og/s/lumos-xrpl.png';
    else seo.image = PRIMARY_ORIGIN + '/lxapi/ogxrpl?a=' + encodeURIComponent(want.id);
  }
  else if (want && want.kind === 'poolid') {
    seo = poolIdSeo(want.id, want.chain);
    // Every pool points at the endpoint; it decides between this pool's own card and the chain's.
    seo.image = poolCardFor(want.chain, want.id);
  }
  else if (want && want.kind === 'hub') {
    seo = {
      title: HUB_SEO[want.id].title + ' | LumosCore',
      desc: HUB_SEO[want.id].desc,
      image: SECTION_CARD[want.id] ? '/assets/og/s/' + SECTION_CARD[want.id] + '.png' : '',
    };
  }
  else if (want && want.kind === 'blog') {
    const look = await blogLookup(context.env, want.slug);
    if (look.post) seo = blogSeo(look.post, PRIMARY_ORIGIN);
    else if (look.decided) {
      // 410 GONE, NOT 404, and that is RAZA's call: "410 Gone for known-dead, 404 for the rest". This
      // is the known-dead half -- the authoritative index was read successfully and holds no record at
      // this slug, so we are not guessing. Google retires a 410 faster than a 404 and does not keep
      // re-asking. The rest of the site keeps its 404 (see malformedId above), because an asset or
      // pool id cannot be checked without an upstream call that is allowed to wobble.
      //
      // Serves the real 404 page as the body so a reader who follows a dead link from Google gets the
      // branded page with a way back, not the word "Gone". The STATUS is what search engines read and
      // the body is what people read; they do not have to agree in tone.
      const branded = await context.env.ASSETS.fetch(
        new URL('/404.html', request.url).toString());
      const hdrs = {
        'content-type': 'text/html; charset=utf-8',
        // Short, not immutable: a slug can come back if the post is republished under its old name,
        // and nothing should cache "gone" for longer than it takes to notice.
        'cache-control': 'public, max-age=300',
        'x-robots-tag': 'noindex, nofollow, noarchive',
      };
      return branded && branded.ok
        ? new Response(branded.body, { status: 410, headers: hdrs })
        : new Response('Gone', { status: 410, headers: Object.assign({}, hdrs, {
            'content-type': 'text/plain; charset=utf-8' }) });
    }
  }
  // The index page has no seoFor entry of its own -- its title and description are baked -- so the
  // post list is fetched here purely to render the links.
  let blogList = null;
  if (url.pathname === '/blog') blogList = await blogIndex(context.env);
  else if (want && want.kind === 'pool') {
    // XLM has no logo of its own, so the pair's other side is the one worth showing.
    // THE PAIR FORM CARRIES NO POOL ID, so there is nothing to look a pool card up by: the cards are
    // keyed on the pool's id (Stellar) or its AMM account (XRPL), and resolving a pair to one of
    // those would mean a lookup on every page view. It takes the chain's pools card instead, which
    // is what the id form falls back to anyway for any pool outside the top hundred. The id form is
    // what the pools table links to, so this is the rarer of the two.
    //
    // The asset lookup that used to run here went solely to decide an image, and now decides
    // nothing, so it is gone rather than left to cost a round trip per request.
    seo = poolSeo(want.a, want.b, '/assets/og/s/pools-' + (want.chain === 'xrpl' ? 'xrpl' : 'stellar') + '.png', want.chain);
  }

  // A plain section route carries no seo object -- its title and description are baked into the page
  // -- but it does have a card. Only the image is added, so the page keeps its own wording and a
  // crawler falls back to <title> and <meta name="description"> for the card's text, exactly as it
  // does today.
  if (!seo && SECTION_CARD[canonPath]) {
    seo = { title: '', desc: '', image: '/assets/og/s/' + SECTION_CARD[canonPath] + '.png', imageOnly: true };
  }

  // NOTHING SHIPS WITHOUT A CARD. Every branch above that leaves the image empty -- a hub with no
  // card of its own, a blog post published without a cover, and every route that has no branch at
  // all -- falls back to the general one here, rather than each route having to be listed. A page
  // with no og:image unfurls as a bare line of text, which is the thing this whole exercise is
  // about; a correct, branded, generic picture beats that everywhere.
  if (!seo) seo = { title: '', desc: '', image: fallbackCard(canonPath), imageOnly: true };
  else if (!seo.image) seo.image = fallbackCard(canonPath);

  const head = [
    '<link rel="canonical" href="' + esc(canonical) + '">',
    '<meta property="og:url" content="' + esc(canonical) + '">',
    '<meta property="og:site_name" content="LumosCore">',
    '<meta property="og:type" content="website">',
  ];
  // Ask for the card type that matches the image we actually have.
  head.push('<meta name="twitter:card" content="'
    + ((seo && (isCardImage(seo.image) || seo.largeCard)) ? 'summary_large_image' : 'summary') + '">');
  if (seo){
    if (!seo.imageOnly) {
      head.push('<meta property="og:title" content="' + esc(seo.title) + '">');
      head.push('<meta property="og:description" content="' + esc(seo.desc) + '">');
      head.push('<meta name="twitter:title" content="' + esc(seo.title) + '">');
      head.push('<meta name="twitter:description" content="' + esc(seo.desc) + '">');
    }
    seo.image = absUrl(seo.image);
    // A crawler reads the page first and fetches og:image a moment later. Building the card now,
    // without holding up this response, means that second request usually finds it already cached
    // instead of paying the cold 2-3s that made a link need pasting two or three times.
    //
    // Only the on-demand card is worth warming. A section card is a static file on the CDN, already
    // as fast as it will ever be, so prewarming it would buy a subrequest and nothing else.
    if (String(seo.image || '').indexOf('/lxapi/ogcard') >= 0) {
      try { context.waitUntil(fetch(seo.image, { headers: { accept: 'image/*' } })); } catch (e) {}
    }
    if (seo.image){
      head.push('<meta property="og:image" content="' + esc(seo.image) + '">');
      if (seo.title) head.push('<meta property="og:image:alt" content="' + esc(seo.title) + '">');
    // Only when both are known and real. Unknown emits nothing, which is the previous behaviour.
    // Our own cards are 1200x630 by construction, so their size is a known value needing neither a
    // KV read nor a fetch. The learn pass could never see them: mediaIdOf() only recognises
    // /lxapi/media?id=<hash>.<ext>, so every card url returned '' and BOTH imgDims and learnImgDims
    // bailed on the empty id. That is why no asset page ever carried og:image:width -- verified on
    // production, where blog covers (which do match that pattern) report real measured dimensions
    // and cards report none. Non-card images keep the measure-and-remember path, which works.
    const _dim = isCardImage(seo.image) ? { w: 1200, h: 630 }
                                        : await imgDims(context.env, seo.image);
    if (_dim) {
      head.push('<meta property="og:image:width" content="' + _dim.w + '">');
      head.push('<meta property="og:image:height" content="' + _dim.h + '">');
    } else if (context.waitUntil) {
      context.waitUntil(learnImgDims(context.env, seo.image));
    }
      head.push('<meta name="twitter:image" content="' + esc(seo.image) + '">');
    }
    // a description already exists from the build; replace rather than duplicate. Skipped for a
    // card-only seo, which has no wording of its own and would emit an empty one.
    if (seo.desc) head.push('<meta name="lx-seo-desc" content="' + esc(seo.desc) + '">');
  }

  // ---- structured data -------------------------------------------------------------------------
  // Organization and WebSite go on every page: they are what lets a search or answer engine attribute
  // a statement to a publisher rather than to an anonymous URL. The details are the registered ones.
  const ld = [{
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': PRIMARY_ORIGIN + '/#organization',
    name: 'LumosCore',
    legalName: 'LumosCore OÜ',
    url: PRIMARY_ORIGIN + '/',
    logo: PRIMARY_ORIGIN + '/assets/favicon.png',
    foundingLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressCountry: 'EE' } },
    identifier: '17336483',
    sameAs: [
      'https://x.com/LumosCore',
      'https://t.me/lumoscore',
      'https://www.linkedin.com/company/lumoscore/',
    ],
  }, {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': PRIMARY_ORIGIN + '/#website',
    url: PRIMARY_ORIGIN + '/',
    name: 'LumosCore',
    publisher: { '@id': PRIMARY_ORIGIN + '/#organization' },
    inLanguage: 'en',
  }];

  // Breadcrumbs only where there is a real hierarchy to describe.
  //
  // Built from the CANONICAL path, not the requested one. On an alias the two differ, and using the
  // request path made /trade emit a breadcrumb naming /trade as its own node -- structured data
  // asserting the page exists at the very url the canonical beside it defers away from. Same page,
  // same trail, whichever of its urls was asked for.
  const crumbs = [];
  const segsC = canonPath.split('/').filter(Boolean);
  if (segsC.length){
    crumbs.push({ '@type': 'ListItem', position: 1, name: 'Home', item: PRIMARY_ORIGIN + '/' });
    let acc = '';
    segsC.forEach(function(sg, i){
      acc += '/' + sg;
      crumbs.push({
        '@type': 'ListItem',
        position: i + 2,
        name: decodeURIComponent(sg).replace(/-/g, ' ').slice(0, 60),
        item: PRIMARY_ORIGIN + acc,
      });
    });
    ld.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs,
    });
  }

  // An article is a distinct entity with its own dates and author.
  if (seo && seo.post){
    const p = seo.post;
    const iso = (v) => { try { return new Date(+v || v).toISOString(); } catch (e) { return undefined; } };
    ld.push({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: String(p.title || '').slice(0, 110),
      description: seo.desc,
      image: seo.image || undefined,
      datePublished: iso(p.publishedAt || p.publishAt || p.createdAt),
      dateModified: iso(p.updatedAt || p.publishedAt || p.publishAt),
      author: { '@type': 'Organization', name: 'LumosCore', '@id': PRIMARY_ORIGIN + '/#organization' },
      publisher: { '@id': PRIMARY_ORIGIN + '/#organization' },
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      keywords: Array.isArray(p.tags) ? p.tags.join(', ') : undefined,
      articleSection: p.category || undefined,
      inLanguage: 'en',
    });
  }

  head.push('<script type="application/ld+json" id="lx-ld-core">'
    // THIS ESCAPE WAS A NO-OP AND THAT WAS AN INJECTION. It used to read .join('<\\/'), which this
    // template literal turns into .join('<\/') in the generated file -- and '<\/' in JavaScript is
    // just '</', so the replacement replaced a string with itself. Any path segment reaching this
    // JSON could therefore close the ld+json element early: the breadcrumb name decodes the segment
    // (see buildLd), so /trade/xrpl/%3C%2Fscript%3E... shipped a literal </script> inside it and
    // everything after it was parsed as markup.
    //
    // Written with String.fromCharCode(92) rather than a backslash because the backslash has to
    // survive this template literal AND the generated file's own string parsing, and it did not. The
    // result is the three characters < \ / : still valid JSON (\/ is an escaped solidus) and no
    // longer the sequence that ends a script element. Verified on the built file, not here.
    + JSON.stringify(ld).split('</').join('<' + String.fromCharCode(92) + '/') + '</scr' + 'ipt>');

  let rw = new HTMLRewriter().on('head', new HeadInjector(head.join('')));
  // GUARDED ON THE VALUE, NOT ON seo EXISTING.
  //
  // These two rewrite the page's OWN title and description, so an seo object carrying empty strings
  // does not leave them alone -- it BLANKS them. That is what the general-card fallback did the
  // moment it was added: it builds an seo object for every route that previously had none, purely to
  // carry an image, and every one of those pages started serving <title></title> and an empty
  // description while still saying index,follow. Measured on /rewards/stellar and /lumos/stellar,
  // which had real titles an hour earlier.
  //
  // Checking the value means a card-only seo cannot touch the wording, and it also protects any
  // branch that ever computes an empty one.
  if (seo){
    if (seo.title) rw = rw.on('title', new TitleSetter(seo.title));
    if (seo.desc) rw = rw.on('meta[name="description"]', {
      element(el){ el.setAttribute('content', seo.desc); },
    });
  }
  // The asset identity block ships as the design's USDC sample. Fill it with what this page is
  // actually about, so a crawler that never runs the page's JavaScript reads the right asset.
  // GATED ON THE ROUTE, NOT ON THE FACTS. assetFacts() depends on stellar.expert, and when that
  // subrequest comes back empty the block used to be skipped entirely -- leaving the design's USDC
  // sample in place, so the page told a non-rendering crawler it was USD Coin. Measured 2026-08-31:
  // every asset page served that way to GPTBot and ClaudeBot while answering correctly to Googlebot
  // and to browsers, which is the worst possible audience to get it wrong for.
  //
  // The code and the issuer are in the URL and need no upstream, so the identity is always corrected
  // and only the enrichment is conditional. A missing price is a missing line; it is never another
  // asset's name.
  if (want && want.kind === 'asset'){
    const f = seo && seo.facts ? seo.facts : null;
    const code = (f && f.code) || want.id.split('-')[0];
    const bits = [];
    if (f && f.price) bits.push('Price ' + fmtUsd(f.price));
    if (f && f.trustlines) bits.push(f.trustlines.toLocaleString('en-US') + ' trustlines');
    // The issuer's own words when they published any; otherwise a factual sentence rather than a
    // borrowed one. Never another asset's copy.
    // THE CHAIN IS NOT ALWAYS STELLAR HERE ANY MORE. This sentence said "is a Stellar asset"
    // unconditionally, which was harmless only while the middleware never reached an XRPL page --
    // it returned at the route gate above. Now that it does, the literal would tell a crawler that
    // every XRP Ledger token is a Stellar one. (What it replaced was worse: the XRPL build serves
    // ONE file for every asset, so without this rewrite each of those pages shipped the design's
    // hardcoded Circle blurb and BERT's page told a crawler it was USD Coin.)
    // Phrased "an asset on <network>" so it can take netName(), the ONE place the two networks are
    // named (assetSeo and the hub titles already read it). "a Stellar asset" would have needed its
    // own ternary, which is how a third spelling of the chain name gets into the codebase.
    const desc = (f && f.desc)
      || (code + ' is an asset on ' + netName(want.chain)
          + (f && f.domain ? ', issued by ' + f.domain : '')
          + '. ' + (bits.length ? bits.join(' \u00b7 ') + '. ' : '')
          + 'Trade it non-custodially on LumosCore from your own wallet.');
    rw = rw.on('.asset-name', new TextSetter(code))
           .on('.asset-description', new TextSetter(desc));
    // Always rewritten, even to an empty string: an asset with no home domain was otherwise left
    // showing the design's placeholder, which claims the issuer is circle.com. Blank is honest.
    // Text mode because this anchor also holds the globe icon, which setInnerContent would delete.
    rw = rw.on('a.website', new TextSetter((f && f.domain) || '', 'text'));
  }

  // THE ARTICLE ITSELF, for a crawler that runs no JavaScript.
  //
  // The post page ships an empty shell -- <h1></h1> and <article class="lx-post-body"></article> --
  // and the browser fills both from /lxapi/blog. So what a crawler received was 329 words of nav and
  // footer and not one word of the article, on the exact pages the backlink plan points at. Links to
  // a page whose body is invisible pass their authority to a nav bar.
  //
  // The post is already in hand: the metadata above reads it at request time to build the title and
  // description, so this costs no extra work. The client sets the same innerHTML on load, so it
  // overwrites this with identical content -- no duplication, and nothing visibly changes.
  if (want && want.kind === 'blog' && seo && seo.post){
    const p = seo.post;
    if (p.title) rw = rw.on('.lx-post-head h1', new TextSetter(String(p.title)));
    if (p.body) rw = rw.on('.lx-post-body', new HtmlSetter(p.body));
  }

  // THE BLOG INDEX, likewise. Same shape the client builds, so when its own render lands a moment
  // later it replaces this with an equivalent grid and nothing moves. The cover and the date are left
  // to the client: the cover needs a second lookup, and the date it prints is relative ("today",
  // "3 days ago"), which cannot be computed server-side without going stale in cache.
  if (url.pathname === '/blog' && blogList && blogList.length){
    const cards = blogList.map((p) => '<a class="lx-bp-card" href="/blog/' + esc(p.slug) + '">'
      + '<div class="lx-bp-cover" data-cov="' + esc(p.slug) + '"></div>'
      + '<div class="lx-bp-title">' + esc(p.title || p.slug) + '</div>'
      + '<div class="lx-bp-when"></div></a>').join('');
    rw = rw.on('.lx-bp-grid', new HtmlSetter(cards));
  }

  out = rw.transform(out);
  // Set AGAIN here, and it must match the earlier one: this is the last writer on the response, so a
  // narrower value here silently undoes it. That is exactly what happened — the chain-aware pages went
  // out with "Vary: User-Agent" despite the header being set correctly further up, which would let a
  // shared cache hand one network's dashboard to somebody connected to the other.
  //
  // The xrplPage condition is the same one as the earlier writer, for that same reason: if only one
  // of the two skipped it, this last writer would decide, and which way it went would depend on
  // which line someone edited.
  if (!xrplPage) out.headers.set('Vary', 'User-Agent, Cookie');
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
    // the device swap is for the public site's mobile builds; the admin has none, so on a tablet it would only reload
    const built = injectHints(cleanLinks(rootRelative(injectRuntime(injectTokenRegistry(src), validArray))));
    const html = adminOnly ? built : injectDeviceSwap(built, name);
    fs.writeFileSync(path.join(outDir, name), html, 'utf8');
    written++;
  }
  // an admin build is not a site: no landing redirect, and it opens on the dashboard
  if(adminOnly) fs.writeFileSync(path.join(outDir, 'index.html'), adminIndexHtml(), 'utf8');
  else {
    const landing = all['lumoscore-landing.html'];
    if(!landing) throw new Error('lumoscore-landing.html missing — cannot build the site root');
    // index.html is written HERE rather than in the loop above, so it misses anything the loop injects --
    // which is how the site root, the one page a tablet lands on first, was the only desktop page without
    // the device swap (RAZA: "the landing page is kinda breaking on tablet", 2026-09-21).
    fs.writeFileSync(path.join(outDir, 'index.html'),
      injectDeviceSwap(indexHtml(injectHints(cleanLinks(rootRelative(injectRuntime(injectTokenRegistry(landing), validArray))))), 'index.html'), 'utf8');
  }
  // The admin panel deploys as its OWN Cloudflare project, so it cannot borrow dist/assets the way
  // serve.js lets it locally — without this its favicon and wallet logos 404 in production.
  // Only what the admin build actually references is copied (~470 KB), not the whole 19 MB folder.
  if(adminOnly){
    // 'vendor' holds the self-hosted Stellar libraries. The admin panel signs mainnet transactions
    // too (rewards payouts), so it must NOT be the one origin left loading them off a public CDN.
    const need = ['favicon.png', 'wallets', 'vendor'];
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
    // 4th field carries the alias flag through to the sitemap and the canonical map. The middleware
    // ignores it for routing -- an alias resolves to its file exactly like any other url.
    const routePairs = [['/', 'index', 'lumoscore-landing-mobile', null]]
      .concat(ROUTES.map(([u, f, flag]) => [u, f.replace(/\.html$/, ''), null, flag || null]));
    const mobileFiles = files
      .filter(n => /-mobile\.html$/.test(n))
      .map(n => n.replace(/\.html$/, ''));

    fs.writeFileSync(path.join(outDir, '_routes.json'), routesJson(), 'utf8');
    const fnDir = path.join(__dirname, '..', 'functions');
    fs.mkdirSync(fnDir, { recursive: true });
    // No chain alternatives in a single-chain build; combine_with_stellar.js fills the table in when it
    // assembles a deployment that serves two.
    fs.writeFileSync(path.join(fnDir, '_middleware.js'), middlewareJs(routePairs, mobileFiles, {}, {}), 'utf8');
    fs.writeFileSync(path.join(fnDir, '_sitemap-routes.js'), sitemapRoutesJs(routePairs), 'utf8');
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

  // The browser card kit travels with EVERY build, public or admin.
  //
  // The launchpad and the admin panel both load /assets/js/lx-ogkit.js on demand to draw a card the
  // moment an asset is minted or curated. Emitting it only from _ogsection.js meant an admin-only
  // build shipped the hook without the scripts it loads -- a 404 at exactly the moment it matters,
  // and silent, because the publish is deliberately fire-and-forget. Doing it here ties the kit to
  // the build that serves it instead of to a card script someone may not have run.
  try {
    const emitted = require('./_ogkit.js').emitBrowser();
    if (emitted.length) console.log('            card kit:', emitted.join(' '));
  } catch (e) {
    console.error('            card kit NOT emitted: ' + e.message);
  }
}
if(!adminOnly) console.log('admin pages excluded from the public build \u2014 build them with: node _tools/extract_site.js '+(target||'aptos')+' --admin');
