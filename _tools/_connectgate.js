// Actions that NEED a wallet ask for one, instead of bouncing to the landing page or opening a form
// that cannot be filled in.
//
// Two reports, one shape:
//   RAZA 2026-09-29: "+Create your pool (when user's wallet isn't connected) --> The user should be
//   redirected directly to connect wallet while clicking on 'create pool' instead of getting the
//   select Asset 1 and 2 pop up".
//   RAZA 2026-09-30: "When I click on launch token on the trade page when the wallet isn't connected,
//   the connect wallet pop up should appear instead of taking me back to launchpad or landing page."
//
// Both controls are reachable while signed out, and both currently end somewhere useless:
//
//   * CREATE POOL opens the design's dialog. Its two asset pickers are filled from the connected
//     wallet's balances, so with no wallet it renders "Select asset" over "Balance: --" and the only
//     thing the reader can do is close it. The wallet is needed for the FIRST field, so it should be
//     asked for before the dialog, not discovered inside it.
//   * LAUNCH TOKEN is <a href="/launchpad">, and /launchpad is one of the four pages still gated
//     (every step of that flow needs a signature). The gate does location.replace("/") -- so the
//     click lands the reader on the landing page with no explanation of what just happened. Throwing
//     a deliberate click away is the worst of the three possible outcomes.
//
// Gating EVERY /launchpad link, not only the Trade page's button: the footer and nav carry the same
// link and it dead-ends the same way. One selector fixes the button RAZA reported and the several he
// has not hit yet, and a connected reader is unaffected either way.
//
// MEASURED BEFORE AND AFTER, signed out, on the live page (a check that cannot fail proves nothing):
// an ungated Create Pool click opened #createPoolModal, and with this installed the same click left
// it closed and reached window.lxChooseNetwork. Signed in, the modal still opens and the connect flow
// is never called -- the design's own path is untouched.
//
// WINDOW CAPTURE, because nothing later wins. The design owns these controls' handlers and these
// pages carry inherited click layers that run before anything bound on the page itself
// (lumoscore-inherited-listener-race, lumoscore-lumosnav-row-hijack). Capture at the window is the
// only phase that sees the click first.
//
// It deliberately does NOT check isTrusted: _poolshero.js's desktop .lx-cplink works by calling
// .click() on the original #openCreatePool, so the click that reaches the design is synthetic.
// Refusing untrusted events would gate the phone and let the desktop straight through.
//
// Re-injects: strips its own script -- under both its current id and the lx-poolgate one it shipped
// under first -- before writing.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const JS = '<script id="lx-connectgate">' + `(function(){
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
        var m=(location.pathname||"").match(/^\\/[a-z-]+\\/(stellar|xrpl)(\\/|$)/);
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
})();` + '<' + '/script>';

const FILES = ['lumoscore-aptos-desktop.html', 'lumoscore-aptos-mobile.html'];

// EVERY PUBLIC PAGE, rather than only the ones that look like they carry a control. The first version
// of this gated on finding `href="/launchpad"` in the container and injected into nothing useful,
// because the CONTAINER still holds the legacy `lumoscore-launch-token.html` form at that point --
// cleanLinks() in extract_site.js rewrites those to clean URLs at BUILD time, long after this runs.
// Hooks that only exist after the build are hooks this transform cannot see.
//
// Matching the pre-build spelling instead would just move the brittleness: the Launch Token control
// on Trade is MOVED into another card by _dexhero.js, the footer builds its own links, and any future
// page that links to the launchpad would silently miss out. The listener is a few hundred bytes, it
// returns on the first line for every click that is not one of these controls, and _externalize.js
// hashes identical scripts into ONE cached file -- so "everywhere" costs one request site-wide.
//
// Admin pages are excluded: they are a separate build with their own origin and no wallet flow.
const isAdmin = (key) => /^lumoscore-admin-/.test(key);

// THIS GATE IS STELLAR-ONLY, AND THAT IS CORRECT. The XRPL build ships its own equivalent: its
// launchpad CTA carries data-lxgate="1" and a handler in that build intercepts it, calls
// stopImmediatePropagation and opens the XRP Ledger wallet list. Verified on the deployed page --
// the CTA has the attribute, and clicking it opens Xaman/GemWallet/Crossmark.
//
// I briefly added a second copy of this gate to the XRPL containers on 2026-10-10 and then removed
// it: it could never fire, because the existing handler stops propagation first, and a dormant
// duplicate listener is a trap for whoever next changes either selector.
const problems = [];
const staged = [];

for (const file of FILES) {
  let data; try { data = read(file); } catch (e) { problems.push(file + ': unreadable'); continue; }
  const { json, s, e } = getContents(data);
  let touched = 0;

  for (const key of Object.keys(json)) {
    let html = json[key];
    if (typeof html !== 'string') continue;
    html = html.replace(/<script id="lx-connectgate">[\s\S]*?<\/script>/g, '');
    html = html.replace(/<script id="lx-poolgate">[\s\S]*?<\/script>/g, '');   // the id this shipped under first
    if (isAdmin(key)) { json[key] = html; continue; }
    const bo = html.lastIndexOf('</body>');
    html = bo >= 0 ? html.slice(0, bo) + JS + html.slice(bo) : html + JS;
    json[key] = html;
    touched++;
  }

  if (!touched) problems.push(file + ': no public page to inject into');
  staged.push({ file, data, s, e, json, touched });
}

if (problems.length) {
  console.error('connect-gate: ABORT - nothing written.');
  problems.forEach((x) => console.error('  ' + x));
  process.exit(1);
}
for (const st of staged) {
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.file + ': Create Pool / Launch Token ask for a wallet first on ' + st.touched + ' page(s)');
}
console.log('connect-gate: done on ' + staged.length + ' container(s)');
