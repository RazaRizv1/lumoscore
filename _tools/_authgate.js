// Auth gate: the dashboard + every in-app page is viewable ONLY after connecting a wallet.
//  - Protected pages (everything except landing/signin): a <head> guard redirects to the landing if
//    not connected (runs before body paints, so no flash of the app).
//  - Landing "Launch App" CTA now opens the connect modal (active chain) and lands on the dashboard
//    after connecting, instead of navigating straight in.
// "Connected" = localStorage lumos.wallet/address (set by the real or demo connect flow). Idempotent.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

// Redirect to "/" — an ABSOLUTE path. It used to be the bare filename "lumoscore-landing.html", which
// is relative, so it resolved against whatever clean url the visitor was on: from /asset/stellar/<ASSET>
// the browser asked for /asset/stellar/lumoscore-landing.html, which "/asset/stellar/:asset" then
// matched with the asset being the literal string "lumoscore-landing.html" — a blank asset page.
// "/" is the landing page (index.html is a copy of it), so this needs no redirect hop either.
const GUARD='<script id="lx-authgate">(function(){try{if(!(localStorage.getItem("lumos.wallet")||localStorage.getItem("lumos.address")))location.replace("/");}catch(_){}})();</script>';
// The INVERSE of the guard above. "/" is the marketing landing page, so a connected user opening the
// site in a new tab — or from a bookmark, or by typing the domain — was dropped back on the front door
// with no sign the app already knew who they were. Connected means past the front door: go to the
// dashboard. Sits in <head> and uses replace(), so the landing never paints and never enters history
// (a back-button entry that instantly bounces forward again traps you).
//
// Cannot loop against the guard: that one fires only when NOT connected, this one only when connected,
// and disconnect clears the keys BEFORE sending you to "/", so the landing stays put afterwards.
// A ?stay=1 escape hatch keeps the landing reachable while connected — useful for checking the
// marketing page without disconnecting.
const HOMEGATE='<script id="lx-homegate">(function(){try{'
  +'if(location.search.indexOf("stay=1")>=0)return;'
  +'if(localStorage.getItem("lumos.wallet")||localStorage.getItem("lumos.address"))location.replace("/dashboard");'
  +'}catch(_){}})();</scr'+'ipt>';

const OLD_LAUNCH="window.top.lxNavigate(['lumoscore-signin.html','lumoscore-signin-mobile.html'])";
const PREV_LAUNCH="window.lxwOpenWallet((window.lxGetChain&&window.lxGetChain())||'aptos','lumoscore-home.html')";
const NEW_LAUNCH="window.lxChooseNetwork&&window.lxChooseNetwork('lumoscore-home.html')";

// WHICH PAGES ARE VIEWABLE WITHOUT A WALLET.
//
// Read-only pages are public. They render public chain data — prices, pools, holders, trustlines —
// and need no wallet to be useful. They are also 780 of the 785 urls in the sitemap, so gating them
// meant every search-engine visitor was bounced to the landing page before seeing the content the
// whole SEO layer exists to rank. Crawlers (no JS) saw the page; humans never did.
//
// Gated pages are the personal and transactional ones, where a wallet is genuinely required for the
// page to show anything at all.
//
// Admin pages are public HERE because their gate is Cloudflare Access, which authenticates at the
// edge before any HTML is served. Gating them would also break them outright: the guard redirects to
// the landing page, which does not exist on the admin origin (a separate Pages project holding only
// admin pages). extract_site.js strips the guard from the admin build too, belt and braces.
const PUBLIC_BASES = new Set([
  'lumoscore-landing',        // the front door
  'lumoscore-signin',         // where the gate sends people
  'lumoscore-dex',            // Trade
  'lumoscore-dex-asset',      // Trade — per-asset  (the big SEO surface)
  'lumoscore-amm',            // Pools
  'lumoscore-amm-pool',       // Pools — per-pool
  'lumoscore-lumos-token',    // LUMOS
  'lumoscore-mcp',            // MCP
]);
// GATED (deliberately): home/dashboard, wallet, bridge, rewards, launch-token/review/confirm.

// Keys are filenames and carry variant suffixes (-dark, -light, -mobile). Strip them before
// comparing, or "lumoscore-dex-asset-dark" misses the set. Substring matching is NOT safe here:
// "lumoscore-amm" is a prefix of "lumoscore-amm-pool", and an unanchored test would leak.
function isPublicPage(k){
  let b = k.replace(/\.html$/, '');
  let prev;
  do { prev = b; b = b.replace(/-(dark|light|mobile)$/, ''); } while (b !== prev);
  return /^lumoscore-admin-/.test(b) || PUBLIC_BASES.has(b);
}

let gated=0, rewired=0, homed=0;
for(const dev of ['desktop','mobile']){
  const file=`lumoscore-aptos-${dev}.html`;
  let data; try{ data=read(file); }catch(e){ continue; }
  const {json,s,e}=getContents(data);
  for(const k of Object.keys(json)){
    let h=json[k];
    h=h.replace(/<script id="lx-authgate">[\s\S]*?<\/script>/,''); // idempotent
    const isPublic=isPublicPage(k);
    if(isPublic){
      if(/landing/.test(k)){
        if(h.indexOf(OLD_LAUNCH)>=0){ h=h.split(OLD_LAUNCH).join(NEW_LAUNCH); rewired++; }
        if(h.indexOf(PREV_LAUNCH)>=0){ h=h.split(PREV_LAUNCH).join(NEW_LAUNCH); rewired++; }
        h=h.replace(/<script id="lx-homegate">[\s\S]*?<\/script>/,'');   // idempotent
        if(h.indexOf('</head>')>=0){ h=h.replace('</head>', HOMEGATE+'</head>'); homed++; }
      }
    } else {
      if(h.indexOf('</head>')>=0){ h=h.replace('</head>', GUARD+'</head>'); gated++; }
      else { const bi=h.indexOf('<body'); if(bi>=0){ const gt=h.indexOf('>',bi)+1; h=h.slice(0,gt)+GUARD+h.slice(gt); gated++; } }
    }
    json[k]=h;
  }
  const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
  fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
}
console.log('auth gate: protected pages='+gated+' | landing Launch-App rewired='+rewired+' | landing->dashboard when connected='+homed);
