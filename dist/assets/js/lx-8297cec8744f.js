(function(){
  if(window.__lxConnectGate) return; window.__lxConnectGate=1;
  try{
    // The same flag the auth gate treats as "connected" (lumoscore-authgate-redirect). NOT a
    // G... address test: these pages are built for more than one network and an XRPL address
    // would fail a Stellar-shaped check, silently gating a connected wallet.
    function connected(){
      try{ return !!(localStorage.getItem("lumos.wallet")||"").trim(); }catch(e){ return false; }
    }
    function chain(){
      try{ return (window.lxGetChain&&window.lxGetChain())||"stellar"; }catch(e){ return "stellar"; }
    }
    // THE URL ALREADY ANSWERS "WHICH NETWORK?" ON A CHAIN PAGE, so do not ask it again.
    //
    // RAZA 2026-10-10: "Connect wallet button is breaking ... on both xrpl and stellar". On
    // /launchpad/stellar this handler was calling lxChooseNetwork, which opens the NETWORK chooser --
    // the reader has just picked Stellar from the hub, landed on a url ending in "stellar", filled in
    // the form, and is then asked which chain they want. That is the break, and it was mine: the
    // chooser was the right hand-off for #openCreatePool on a chain-neutral page and the wrong one
    // the moment .summary-cta brought a chain-specific page into this selector.
    //
    // lxGetChain is ALSO undefined on the XRPL build (measured), so chain() silently answered
    // "stellar" there -- which would have opened a Stellar wallet list on an XRP Ledger page. The
    // path is the one source both builds agree on.
    function pathChain(){
      try{
        var m=(location.pathname||"").match(/^\/[a-z-]+\/(stellar|xrpl)(\/|$)/);
        return m?m[1]:"";
      }catch(e){ return ""; }
    }
    // WHAT CHANGED 2026-10-10, and why the launchpad LINKS came out of this list.
    //
    // It used to read a[href='/launchpad'],a[href^='/launchpad/'],a[href^='/launchpad?'] -- every link
    // to the launchpad opened the connect modal instead of navigating. That was right when the whole
    // flow was wallet-gated: the click would otherwise have hit lx-authgate and been redirected to
    // "/", and RAZA asked for the modal precisely so a deliberate click was not thrown away
    // ("the connect wallet pop up should appear instead of taking me back to landing page").
    //
    // /launchpad and /launchpad/stellar are now PUBLIC (see PUBLIC_BASES in _authgate.js), so there is
    // no dead end left to compensate for: the click lands on the network chooser, which is the step
    // that asks which chain and is exactly what the modal was standing in for. Keeping the
    // interception would have meant the hub stayed invisible to every signed-out visitor who clicked
    // a link to it -- reachable only from a search result, which is the opposite of the intent.
    //
    // The REVIEW and CONFIRM steps stay in the list. Those are still gated, still need a signature at
    // every step, and a link landing on them signed-out is still a bounce.
    //
    // .summary-cta IS THE STEP-1 "Next" BUTTON, and adding it is what makes opening the form safe.
    // Its handler is the design's own inline onclick -> lxNavigate(['lumoscore-launch-review.html']),
    // so without this a signed-out visitor fills in the entire form and is bounced at /launchpad/review
    // -- worse than before the page was opened. The wallet is asked for at the moment it is first
    // genuinely needed. Verified unique to the three launch-token variants, so it cannot gate anything
    // else, and window capture with stopImmediatePropagation runs before an inline onclick can fire.
    // THE GATED NAV ITEMS ARE IN THE LIST NOW, and that is the fix for the report below.
    //
    // RAZA 2026-10-11: "when tapping on the wallet after launch app button, it opens up
    // lumoscore.com/trade/stellar page instead of opening the wallet popup".
    //
    // Signed out, a tap on Wallet or Dashboard in the sidebar reached lx-authgate, which does
    // location.replace() and throws the click away. Measured on the current build: it lands on "/".
    // On the build he tested it landed on /trade/stellar, which is chainHref()'s fallback in
    // _mc_engine.js for a section that is in neither chain table -- and dashboard and wallet are
    // deliberately in neither. Either way the outcome is the same: a deliberate click on the one
    // control that means "I want my wallet" is answered by a page change nobody asked for.
    //
    // He is describing the behaviour these two should have had all along, and it is the behaviour
    // Create Pool and Launch Token already have (RAZA 2026-09-30, the reason this file exists): ask
    // for the wallet at the moment it is needed, then carry on to where they were going.
    //
    // THE TARGET, NOT location.href, IS THE RETURN DESTINATION for these. For an in-page CTA the page
    // you are on IS the destination; for a nav link the destination is the page you were trying to
    // reach, and sending someone back to the page they were leaving would be the same thrown-away
    // click in a different costume.
    var NAVSEL="a[href='/wallet'],a[href='/dashboard']";
    var SEL="#openCreatePool,.lx-cplink,button.summary-cta"
      + ",a[href^='/launchpad/review'],a[href^='/launchpad/confirm']"
      + "," + NAVSEL;
    window.addEventListener("click",function(e){
      var t=e.target; if(!t||!t.closest) return;
      var hit=t.closest(SEL);
      if(!hit) return;
      if(connected()) return;                       // let the design do whatever it normally does
      e.preventDefault(); e.stopImmediatePropagation();
      // For a nav link, resume at the page they asked for rather than the one they were on.
      var dest=null;
      try{ if(t.closest(NAVSEL)) dest=hit.getAttribute("href")||null; }catch(_){}
      // A CHAIN IN THE URL BEATS THE CHOOSER. On /launchpad/stellar or /launchpad/xrpl the network is
      // already decided, so go straight to that chain's wallet list; asking again is the bug RAZA
      // reported. Everywhere else (Create Pool on a chain-neutral page) the chooser is still the right
      // first step, because it is what decides which wallet list to show.
      //
      // location.href is handed over as the return target either way, so connecting resumes the click.
      try{
        var pc=pathChain();
        // WHERE TO GO AFTER CONNECTING. Two window-capture handlers can own this click -- this one and
        // the design's lx-gate -- and only the first to register runs, because both stop propagation.
        // On the launchpad this one wins, so lx-gate's connDest write never happens and the value was
        // left unset: lxPostConnectHome then falls through to the dashboard, dumping someone who had
        // deliberately opened the launchpad, filled the form in and connected. Writing it here keeps
        // that decision with whichever handler actually ran.
        //
        // "stay:<chain>" is honoured only if the wallet they pick is on that chain, which is the
        // behaviour we want: connect XRPL while on the Stellar launchpad and this page is not yours to
        // use, so the dashboard is the honest destination. "home" where the url names no chain.
        //
        // A NAV CLICK IS "home", NEVER "stay". /wallet and /dashboard are chain-neutral urls, so
        // there is no chain to stay on, and lxPostConnectHome's "home" branch is the one that walks
        // the reader into the app -- which is exactly what tapping Wallet or Dashboard asked for.
        try{ sessionStorage.setItem("lumos.connDest",(!dest&&pc)?("stay:"+pc):"home"); }catch(_){}
        var back=dest||location.href;
        if(pc&&!dest&&window.lxwOpenWallet) window.lxwOpenWallet(pc,back);
        else if(window.lxChooseNetwork) window.lxChooseNetwork(back);
        else if(window.lxwOpenWallet) window.lxwOpenWallet(chain(),back);
      }catch(_){}
    },true);
  }catch(e){}
})();