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
    var SEL="#openCreatePool,.lx-cplink,a[href='/launchpad'],a[href^='/launchpad/'],a[href^='/launchpad?']";
    window.addEventListener("click",function(e){
      var t=e.target; if(!t||!t.closest) return;
      if(!t.closest(SEL)) return;
      if(connected()) return;                       // let the design do whatever it normally does
      e.preventDefault(); e.stopImmediatePropagation();
      // The network chooser first where the page has one -- it is the step that decides which
      // wallet list to show, and it is what the rest of the site opens from a signed-out action.
      // location.href is handed over as the return target, so connecting resumes the click.
      try{
        if(window.lxChooseNetwork) window.lxChooseNetwork(location.href);
        else if(window.lxwOpenWallet) window.lxwOpenWallet(chain(),location.href);
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
