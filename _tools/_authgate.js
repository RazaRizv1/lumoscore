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
//
// ONE EXCEPTION: the bridge opened with ?claim=<burn hash>. That link is how a phone hands a CCTP claim to a wallet
// app's own browser (MetaMask, Coinbase Wallet) -- a fresh browser with no Stellar wallet in it. The guard bounced it to
// the landing page and the claim was lost (RAZA 2026-09-19); connecting LOBSTR there is impossible, since that browser
// only carries an EVM wallet. And none is needed: the USDC is already burned on Stellar, and the claim is signed
// entirely on the destination chain. Scoped to the bridge path AND a well-formed 64-hex hash, nothing wider.
// REMEMBER A PREPARED ACTION BEFORE BOUNCING IT (2026-11-16).
//
// The MCP server hands back an approve link for every write, and for any pair without XLM that link
// is /dashboard?swap=<from>,<to>,<amount>. The dashboard is gated, so an agent's user clicked
// "approve your swap" and landed on the MARKETING PAGE with the whole request thrown away -- query
// string and all. That is the user report behind "it doesn't create your trx": nothing was broken in
// the MCP, the destination simply discarded what it was asked to do.
//
// So the url is parked before the redirect and picked up again the moment a wallet connects (see
// lxPostConnectHome in _wallet_realconnect.js, and the landing gate below for the already-connected
// case). sessionStorage, matching the lumos.connectOnArrive precedent in _mc_engine.js: it survives
// the navigation, it is per-tab, and it cannot outlive the tab to fire on some later visit.
//
// NOT lumos.connDest, which already exists for this shape of problem -- four separate places write
// it ("home" or "stay:<chain>") and the landing page's own Launch App button is one of them, so
// parking a value there would be overwritten by the very click that starts the connect.
//
// ONLY URLS THAT CARRY A REQUEST. A bare /dashboard is already where connecting sends you, so
// storing it would add a redirect to no purpose; the query string is what cannot be reconstructed.
//
// The value is "<timestamp>|<path>" and the reader re-validates it. A stored path is a redirect
// target, so it is checked on the way OUT as well as in: it must begin with a single "/" -- a
// leading "//" is protocol-relative and would send the user to another site entirely.
const PARK='try{if(location.search&&location.search.length>1&&location.search.length<512)'
  +'sessionStorage.setItem("lumos.returnTo",Date.now()+"|"+location.pathname+location.search);}catch(_){}';
const GUARD='<script id="lx-authgate">(function(){try{'
  +'if(/bridge/i.test(location.pathname)&&/[?&]claim=[0-9a-fA-F]{64}(?![0-9a-fA-F])/.test(location.search))return;'
  +'if(/^\\/launchpad\\/?$/.test(location.pathname))return;'
  +'if(!(localStorage.getItem("lumos.wallet")||localStorage.getItem("lumos.address"))){'
  + PARK
  +'location.replace("/");}}catch(_){}})();</script>';
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
// It also honours a parked prepared action (see PARK above). Someone already connected in another
// tab is bounced here by the guard and then straight back out again by this script -- without this
// branch that second hop lands on the dashboard and the request is lost just the same, one step later.
const TAKE='function(){var u="";try{var v=sessionStorage.getItem("lumos.returnTo");if(v){'
  +'var i=v.indexOf("|"),t=+v.slice(0,i),p=v.slice(i+1);'
  // Fifteen minutes. Long enough to install a wallet and come back, short enough that a link opened
  // this morning cannot redirect a visit this afternoon.
  +'if(i>0&&t&&(Date.now()-t)<900000&&p.charAt(0)==="/"&&p.charAt(1)!=="/")u=p;'
  +'sessionStorage.removeItem("lumos.returnTo");}}catch(_){}return u;}';
const HOMEGATE='<script id="lx-homegate">(function(){try{'
  +'if(location.search.indexOf("stay=1")>=0)return;'
  +'if(localStorage.getItem("lumos.wallet")||localStorage.getItem("lumos.address"))'
  +'location.replace((' + TAKE + ')()||"/dashboard");'
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
  // OPENED 2026-09-24. These are the pages we PROMOTE, and bouncing an unsigned visitor to the landing
  // page threw the click away: /trade/stellar converts precisely BECAUSE a stranger can see it. Both now
  // render with a connect prompt instead of redirecting. Nothing can be SIGNED without a wallet either
  // way -- this gate was protecting the view, not the money.
  'lumoscore-bridge',         // Bridge  (the page we promote)
  'lumoscore-rewards',        // Rewards (base name; the only variant is -dark)
  // OPENED 2026-09-24. EVERY FOOTER LINK WAS BROKEN WHEN SIGNED OUT (RAZA): Home, Blogs, About,
  // LUMOS Token, Documentation, FAQs, Support, Whitepaper, List your token, Terms, Privacy -- all
  // bounced to the landing page. These are the CONTENT pages: they contain no wallet data, nothing
  // on them is personal, and there is nothing to sign. The round above opened the chain-data pages
  // for exactly the reason stated at the top of this list and stopped short of the static ones, so
  // the docs the SEO layer was written for stayed unreachable to the people it brought in.
  //
  // Terms and Privacy are the sharp end: a visitor who cannot read them without connecting a wallet
  // cannot agree to them either, and both are linked from the consent copy.
  'lumoscore-about',
  'lumoscore-blog',           // the index
  'lumoscore-blog-post',      // and every post
  'lumoscore-support',
  'lumoscore-whitepaper',
  'lumoscore-terms',
  'lumoscore-privacy',
  // Reading how to list a token needs no wallet; PAYING for one still does, and that is enforced in
  // the flow itself rather than by hiding the page from everyone who has not connected yet.
  'lumoscore-list-token',
  // OPENED 2026-09-30 (RAZA: "When clicking on either participants' or holders' public wallet address
  // via Trade, Liquidity Pools, Cross-chains etc when the wallet isn't connected, LumosCore should
  // redirect us to public wallet address instead of taking on the landing page").
  //
  // This is SOMEONE ELSE'S address, read off the public ledger. _accountpage.js exists precisely
  // because "a holder in the Holders tab or a participant in a pool was a dead-end string of 56
  // characters" -- and then the gate made it a dead end again for every visitor who had not
  // connected, which is all of them on a first visit. The rows in Participants and Top Holders are
  // real <a href="/account/stellar/G..."> anchors, so nothing else had to change: the page was
  // reachable, the gate was sending it to "/".
  //
  // Nothing here is the VIEWER's: the address comes from the URL, the data comes from Horizon, and
  // there is nothing on the page to sign. Same reasoning as Trade, Pools, Bridge and Rewards above.
  'lumoscore-account',
  // OPENED 2026-10-10 (RAZA). This file serves TWO urls: /launchpad, which the route table marks as a
  // 'hub' (the network chooser), and /launchpad/stellar, which is the form. Gating the file gated BOTH,
  // so the chooser built to stop the bounce was itself bounced -- measured on staging: /launchpad ships
  // two .lx-lp-card chooser cards and a "Launchpad" heading AND the lx-authgate script, while /trade
  // ships the cards and no gate. The markup was always there; the gate redirected to "/" before it
  // painted, which is why the hub appeared not to exist.
  //
  // That also made the page unrankable. It is titled "Launch a Token on Stellar — No Code Required"
  // and sits in the sitemap at priority 0.8, so every visitor Google sent was redirected to the
  // homepage -- a strong commercial query pointing at a bounce.
  //
  // Nothing can be SIGNED without a wallet either way: this gate was protecting the VIEW, not the
  // money, the same finding that opened Trade, Pools, Bridge and Rewards on 2026-09-24. What makes it
  // safe is the step-1 CTA gate added to _connectgate.js in the same change -- without it a signed-out
  // visitor would fill the whole form and only THEN be bounced at /launchpad/review, which is worse
  // than today. The two changes are one unit; do not ship this entry alone.
  //
  // /launchpad/review and /launchpad/confirm stay gated and noindexed. They are mid-flow states that
  // need a signature at every step and have no standalone value.
  'lumoscore-launch-token',
]);
// All 17 docs pages, by prefix rather than 17 entries that a new page would have to be added to.
const PUBLIC_RE = /^lumoscore-docs-/;
// STILL GATED, deliberately: dashboard/home and wallet (both meaningless with no wallet), and the
// launchpad's mid-flow steps (review/confirm), where every step needs a signature. The launchpad's
// own form and chooser are public -- see lumoscore-launch-token above.

// Keys are filenames and carry variant suffixes (-dark, -light, -mobile). Strip them before
// comparing, or "lumoscore-dex-asset-dark" misses the set. Substring matching is NOT safe here:
// "lumoscore-amm" is a prefix of "lumoscore-amm-pool", and an unanchored test would leak.
function isPublicPage(k){
  let b = k.replace(/\.html$/, '');
  let prev;
  do { prev = b; b = b.replace(/-(dark|light|mobile)$/, ''); } while (b !== prev);
  return /^lumoscore-admin-/.test(b) || PUBLIC_RE.test(b) || PUBLIC_BASES.has(b);
}

let gated=0, rewired=0, homed=0;
// SWAP THE BLOCK WHERE IT ALREADY SITS. Stripping it and re-inserting before </head> is not a
// no-op: head layers have been added after this one over the years, so the gate had drifted to
// index 26 of 87 on the dashboard and re-inserting put it at 40. Measured 2026-11-16 -- 16 pages
// moved on a run that was only meant to change the script's contents.
//
// For THIS layer that is worse than a cosmetic reorder. It is a <head> guard whose whole purpose is
// to redirect BEFORE the gated page paints; every layer that now runs ahead of it widens the window
// in which a signed-out visitor can see the app. Flash is distance.
//
// A page that has never carried the block still falls through to the insert, which registers as a
// set difference rather than a move.
function swapOrInsert(p, OPEN, BLOCK, insert) {
  const at = p.indexOf(OPEN);
  if (at >= 0) {
    const end = p.indexOf('</script>', at);
    if (end > at) {
      p = p.slice(0, at) + BLOCK + p.slice(end + '</script>'.length);
      let dup = p.indexOf(OPEN, at + BLOCK.length);
      while (dup >= 0) {
        const de = p.indexOf('</script>', dup);
        if (de < dup) break;
        p = p.slice(0, dup) + p.slice(de + '</script>'.length);
        dup = p.indexOf(OPEN, dup);
      }
      return { html: p, placed: true };
    }
  }
  return { html: insert(p), placed: false };
}

for(const dev of ['desktop','mobile']){
  const file=`lumoscore-aptos-${dev}.html`;
  let data; try{ data=read(file); }catch(e){ continue; }
  const {json,s,e}=getContents(data);
  for(const k of Object.keys(json)){
    let h=json[k];
    const isPublic=isPublicPage(k);
    if(isPublic){
      // A page that has BECOME public still has to lose a guard it used to carry.
      h=h.replace(/<script id="lx-authgate">[\s\S]*?<\/script>/g,'');
      if(/landing/.test(k)){
        if(h.indexOf(OLD_LAUNCH)>=0){ h=h.split(OLD_LAUNCH).join(NEW_LAUNCH); rewired++; }
        if(h.indexOf(PREV_LAUNCH)>=0){ h=h.split(PREV_LAUNCH).join(NEW_LAUNCH); rewired++; }
        const r=swapOrInsert(h,'<script id="lx-homegate">',HOMEGATE,
          (p)=>p.indexOf('</head>')>=0?p.replace('</head>',HOMEGATE+'</head>'):p);
        h=r.html; homed++;
      }
    } else {
      const r=swapOrInsert(h,'<script id="lx-authgate">',GUARD,(p)=>{
        if(p.indexOf('</head>')>=0)return p.replace('</head>',GUARD+'</head>');
        const bi=p.indexOf('<body');
        if(bi>=0){ const gt=p.indexOf('>',bi)+1; return p.slice(0,gt)+GUARD+p.slice(gt); }
        return p;
      });
      h=r.html; gated++;
    }
    json[k]=h;
  }
  const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
  fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
}
console.log('auth gate: protected pages='+gated+' | landing Launch-App rewired='+rewired+' | landing->dashboard when connected='+homed);
