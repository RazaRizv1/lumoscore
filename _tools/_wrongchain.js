// "You are connected to the other chain" — say so, and stop the buttons that cannot work.
//
// RAZA 2026-10-16, three reports that are one missing idea:
//
//   11  "I am currently connected to XRPL, but if while being connected to XRPL, im opening any
//       stellar page, it shows on top that im connected to stellar. Its very confusing ... It should
//       mention 'View only mode. You are currently connected to XRPL. To use Stellar, logout and
//       connect using Stellar wallet.'"
//   12  "if im connected to XRPL, but lets say i open launchpad page on Stellar. The button should be
//       disabled here because im connected to XRPL ... This applies to all other pages if im not
//       connected to that network."
//   13  the hub chooser — fixed separately in _lumosparent.js.
//
// WHY THE SITE SAID THE WRONG THING. There are two different facts here and the build only ever
// modelled one of them:
//
//   lumos.chain    the chain being VIEWED      — written by the switcher, and adopted from the url
//   lumos.network  the chain the WALLET is on  — written once, at connect, beside lumos.address
//
// Every chain-shaped thing on screen was driven by the first. So opening /pools/stellar re-skinned
// the whole page to Stellar — including the marks beside the connected address — and nothing
// anywhere compared the two. The page was not lying about the chain; it was answering a different
// question than the reader was asking.
//
// THE WALLET DECIDES, AND THE ADDRESS IS THE BACKSTOP. lumos.network is read first, but an address
// shape cannot go stale the way a stored field can: XRP Ledger addresses are r-prefixed base58,
// Stellar's are G-prefixed base32. If a future connect path forgets to write lumos.network, this
// still resolves correctly rather than silently calling every page fine.
//
// SCOPE IS DELIBERATELY NARROW, in three ways:
//
//   * Only pages whose URL NAMES a chain. A hub or the landing page claims nothing, so there is
//     nothing to contradict, and _lumosparent.js already forwards a connected reader off the hubs.
//   * Only when a wallet is actually connected. Disconnected is not "wrong chain", it is "no chain",
//     and the connect flow already handles it.
//   * Nothing is hidden and nothing navigates. A reader who wants to LOOK at the other chain's pools
//     keeps every read-only thing on the page; what they lose is the buttons that would have failed.
//
// WHAT THIS DOES NOT COVER, stated plainly because the gap is real: the CTA list below is static, and
// several write buttons on this site are built at RUNTIME inside dialogs (the swap confirm, Send,
// Create pool). Those are not disabled by this pass. They already fail — a Stellar signing path with
// an XRPL wallet connected finds no Freighter or LOBSTR and throws — so the change here is that the
// reader is TOLD why, at the top of the page, before they get that far. Closing the gap properly
// means a guard in the signing layer, and there is no single choke point for it today: signing is
// reached from _ammdata.js, _axelar.js, _cctp.js and the wallet layer separately.
//
// Idempotent: style, head script and body script are each swapped BY ID WHERE THEY SIT.
//
// IT NO LONGER NEEDS _heromono.js RE-RUN AFTERWARDS, and that is a deliberate change (2026-11-14).
// This header used to read "AFTER RUNNING THIS, RUN _heromono.js AND REBUILD", because the old
// injection stripped all three blocks and re-appended them at the end of <head> and </body> — which
// pushed this layer past every layer that had been sitting after it, _heromono.js included, and
// _heromono.js has to end up last or the hero paints in its per-page colour instead of the
// monochrome one (predeploy_check.js blocks on exactly that). There is no recipe file on the Stellar
// side — the XRPL fork has _tools/rebuild.js, this repo has nothing equivalent — so that ordering
// was carried by whoever ran the transforms, and getting it wrong is silent.
//
// The injection below now swaps each block in place, so running this moves nothing: measured at
// `384 block(s) swapped in place, 0 appended` and `LAYER ORDER MOVED: 0 of 128 page keys`. The run
// prints swapped vs appended separately for that reason — an `appended` above zero on a tree that
// already carries the layer is the one outward sign that something is about to change position.
// ([[a-transform-that-patches-in-place-cannot-reorder]])
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);
const CHAINS = JSON.parse(fs.readFileSync(__dirname + '/_chains.json', 'utf8'));

// EVERY CHAIN THIS SITE SERVES AS A URL SEGMENT, not just the two it was written for.
//
// RAZA 2026-11-14, connected with Rabet on Stellar: "when we open any near page while connected to
// stellar, it shows launch app like im not even connected. Its supposed to show the view only
// message." Measured on production: /bridge/near sets neither data-lx-page-chain nor
// data-lx-wallet-chain, because the head script below read the page's chain with a regex that knew
// exactly two ids and returned "" for everything else -- so the layer quit on its second line and
// the notice, the CTA lock and the way out were all absent on every NEAR page.
//
// THE NAMES ARE NOT IN _chains.json AND MUST NOT BE PUT THERE. That file is injected WHOLE into the
// mc-engine by _multichain.js (`engine.replace('/*CHAINS*/', JSON.stringify(CH))`), so adding a key
// there feeds the chain switcher and the hub grids -- a product change, made silently, to fix a
// banner. The forks register themselves with combine instead, through their own chains/<id>.js
// surface. This table is therefore local and deliberately small: it holds only what the SENTENCE
// needs, and nothing that paints.
//
// `the` and `art` are data, not rules. "connected to XRP Ledger" and "a XRP Ledger wallet" both read
// as broken English, and this sentence is the entire point of the notice; "the" belongs to the XRP
// Ledger alone, and the article follows the SOUND of the name (an Arc, a NEAR), which no amount of
// string logic gets right. Stellar and XRPL keep reading their display names from _chains.json so
// the banner cannot drift from the switcher on the two chains that file does describe.
const NAME_OF = (id, dflt) => (CHAINS[id] || {}).name || dflt;
const CHAIN = {
  stellar: { name: NAME_OF('stellar', 'Stellar'), the: NAME_OF('stellar', 'Stellar'), art: 'a' },
  xrpl: { name: NAME_OF('xrpl', 'XRP Ledger'), the: 'the ' + NAME_OF('xrpl', 'XRP Ledger'), art: 'an' },
  near: { name: 'NEAR', the: 'NEAR', art: 'a' },
  arc: { name: 'Arc', the: 'Arc', art: 'an' },
  hedera: { name: NAME_OF('hedera', 'Hedera'), the: NAME_OF('hedera', 'Hedera'), art: 'a' },
};
// Arc and Hedera are here although production serves neither today: staging combines all four
// (`combine.js xrpl near arc hedera`), and a table that lists only what shipped is a table that
// reproduces this exact bug on the day the next chain goes live. A chain nobody can reach costs one
// unreachable branch; a chain that is reachable and missing costs a silent page.

// THE SECTIONS THAT EXIST ON EVERY CHAIN. The notice ends with a way out -- "Open pools on Stellar"
// -- built from this page's own first path segment. With two chains that was safe by accident; with
// five it ships a 404, because the segment is whatever the url starts with and not every section is
// chain-qualified. Measured against production rather than assumed, /<section>/<chain> for each:
//
//   trade pools bridge rewards launchpad lumos   200 on stellar, xrpl and near
//   account                                      404 -- the real route is /account/<chain>/<address>
//   blog                                         410 on stellar, 200 on near
//   liquidity-farming                            301, and Stellar only
//
// So the link is offered only for a section known to exist on the destination chain. Everywhere
// else the notice still appears in full and simply does not offer a shortcut -- which is the
// existing behaviour minus a dead link, not a feature removed.
const CROSSCHAIN = ['trade', 'pools', 'bridge', 'rewards', 'launchpad', 'lumos'];

// SECTIONS THAT NAME A CHAIN BUT OFFER NOTHING TO ACT ON. The notice exists to explain why buttons
// will not work; where there are no buttons it is just an alarm about nothing.
//
// The blog's categories ARE networks, so /blog/near is a real 200 page carrying this layer, and a
// Stellar reader browsing NEAR posts would have been told to disconnect in order to read an article.
// It never showed before only because /blog/stellar answers 410 and so nobody reached it — teaching
// the layer the other chain ids is exactly what would have made it visible. RAZA 2026-11-14, asked
// directly: "yes keep it off blog pages".
//
// Matched on the FIRST path segment, so /blog/near and /blog/near/<slug> are both covered. Kept to
// what is actually editorial: /account/<chain>/<address> stays IN, because it is a wallet surface
// with its own actions and a reader there has a real reason to know their wallet is on another
// chain.
const NOTICE_OFF = ['blog'];

// The write-action buttons that exist in the STATIC markup, found by scanning the built site for
// buttons whose visible text is an action verb rather than by guessing class names:
//
//    60  .btn-primary      Add Liquidity, Remove Liquidity
//     4  .dxa-side-btn     Buy, Sell          (desktop Trade-Asset)
//     2  .mdxa-side-btn    Buy, Sell          (mobile Trade-Asset)
//     3  .br-next          Next               (bridge)
//     2  .summary-cta      Next               (launchpad — RAZA's own example)
//
// `.active` (Deposit) and `.mdxa-trade-tab` (Swap) were in that scan and are NOT here: the first is
// a state class shared with things that are not buttons, the second is a TAB. Disabling a tab would
// stop someone reading the page, which is the one thing this must not do.
// `.lx-cplink` was added after measuring the result on /pools/stellar: the dialog's own submit
// (.btn-primary "Create Pool & Add Liquidity") locked correctly, but the button that OPENS the dialog
// did not, so the flow still invited someone to fill in a form they could never submit. An opener of
// a write dialog is a write action for this purpose.
//
// NAVIGATION IS DELIBERATELY NOT LOCKED, and the same sweep is what settled it: `.dex-hero-btn`
// ("Launch Token") and `.qa-row-btn` ("Trade on DEX") read like actions and are links to other
// pages. Those pages carry this same notice, so locking the link as well would only stop someone
// moving around a site they are allowed to read.
// THE SIDE TOGGLE IS NOT A WRITE BUTTON, AND THE ORDER BUTTON IS (RAZA 2026-10-26, in view-only mode:
// "why am I unable to check the sell tab of trade-asset page. I mean, just disable the swap button but
// I should be able to check the sell tab and also input values in there etc.").
//
// This list had it exactly backwards on the asset page. `.dxa-side-btn` / `.mdxa-side-btn` are the
// BUY / SELL pair -- "side" as in side of the book, not a side button -- so locking them stopped a
// reader switching to Sell at all, while `.dxa-trade-cta` / `.mdxa-trade-cta` ("Place Buy Order",
// "Place Limit Order") and `.lx-fm-confirm` ("Confirm order"), which are the controls that actually
// submit, were absent and stayed live.
//
// The note a few lines up already draws this line -- `.mdxa-trade-tab` was excluded because
// "disabling a tab would stop someone reading the page, which is the one thing this must not do" --
// and the side toggle is the same kind of control. It only chooses which form to show.
//
// Swapping the two also closes part of the gap that note admits to: the submit is now visibly locked
// with the reason at the top of the page, instead of being pressable and failing later inside the
// signing layer with a missing-wallet error.
const CTA = ['.btn-primary', '.summary-cta', '.br-next', '.lx-cplink',
  '.dxa-trade-cta', '.mdxa-trade-cta', '.lx-fm-confirm'];

const STYLE = '<style id="lx-wrongchain-css">'
  + CTA.map((s) => 'html.lx-wrongchain ' + s).join(',')
  // DIMMED ORANGE, NOT GREY (RAZA 2026-11-23: "the swap button isnt supposed to be grey when inactive"). The same look an
  // inactive Swap has with the right wallet connected (55%, a touch of greyscale), still not pressable.
  + '{pointer-events:none!important;opacity:.55!important;cursor:not-allowed!important;'
  + 'filter:grayscale(.25)!important;box-shadow:none!important}'
  // The notice. Styled from the theme's own tokens so it inherits light and dark without a second
  // palette, and sized to read as a page-level state rather than a toast that will disappear.
  // STICKY, so the warning is still on screen at the point the reader reaches a control it explains
  // (RAZA 2026-10-17: "make view only mode message as sticky upon scrolling so that its always there
  // right infront of the users"). Scrolled away, the disabled buttons further down the page have no
  // stated reason -- they just look broken.
  //
  // The offset is MEASURED, not written down: the two layouts pin different headers at top 0 --
  // .appbar at 65px on the phone, .topbar at 80px on desktop -- so a single hardcoded number tucks
  // the bar under one of them. --lxwc-top is set from the live header by fit() below; the fallback
  // only has to cover the moment before it runs.
  //
  // z-index sits BELOW the headers (.topbar 30, the desktop sidebar .nx-side 40) so it cannot ride
  // over them, and above ordinary content so the page scrolls underneath rather than through it.
  // An opaque background is load-bearing for that -- surface-2 already is one.
  + '.lx-wcbar{position:sticky;top:calc(var(--lxwc-top,66px) + 8px);z-index:25;'
  + 'display:flex;align-items:flex-start;gap:11px;margin:0 0 18px;padding:13px 15px;'
  + 'border:1px solid var(--border-strong,#34343c);border-left:3px solid var(--accent,#ea6a2c);'
  + 'border-radius:12px;background:var(--surface-2,#1a1a1f);color:var(--text,#f6f5f3);'
  + 'font:500 13.5px/1.55 "Hanken Grotesk",system-ui,sans-serif}'
  + '.lx-wcbar b{font-weight:700}'
  + '.lx-wcbar-ic{flex:0 0 17px;width:17px;height:17px;margin-top:1px;color:var(--accent,#ea6a2c)}'
  + '.lx-wcbar-ic svg{width:100%;height:100%;display:block}'
  + '.lx-wcbar-go{display:inline-block;margin-top:5px;color:var(--accent,#ea6a2c);font-weight:700;'
  + 'text-decoration:none;border-bottom:1px solid transparent}'
  + '.lx-wcbar-go:hover{border-bottom-color:currentColor}'
  + '</style>';

// Runs in <head>, before the body exists, so the class is on <html> before anything paints and the
// CTA rule above never has a frame where it does not apply. Same placement and reason as the
// chooser gate in _lumosparent.js; _externalize.js leaves head scripts inline for exactly this.
const HEAD = '<script id="lx-wrongchain">(function(){try{'
  + 'var KNOWN=' + JSON.stringify(Object.keys(CHAIN)) + ';'
  // The url's own chain. Still matching a SEGMENT, not a substring, so an asset whose code happens
  // to contain a chain id cannot be read as a chain -- but by splitting the path and looking each
  // piece up, rather than by one regex per chain. The FIRST matching segment wins, which is the
  // chain that qualifies the section: /trade/near/USDC-... is a NEAR page, not a USDC one.
  + 'var SEG=(location.pathname||"").toLowerCase().split("/").filter(Boolean);'
  + 'var pc=""; for(var i=0;i<SEG.length;i++){ if(KNOWN.indexOf(SEG[i])>=0){ pc=SEG[i]; break; } }'
  + 'if(!pc)return;'
  // Read-only sections keep quiet even when their url names a chain -- see NOTICE_OFF. Tested on the
  // FIRST segment, which is the section, not on pc, which is the chain.
  + 'if(' + JSON.stringify(NOTICE_OFF) + '.indexOf(SEG[0])>=0)return;'
  + 'var a="",n="";'
  + 'try{ a=localStorage.getItem("lumos.address")||"";'
  + 'n=(localStorage.getItem("lumos.network")||"").toLowerCase(); }catch(_){}'
  + 'if(!a)return;'
  // THE ADDRESS IS THE BACKSTOP, and it is deliberately not extended to every chain in the table.
  // lumos.network is read first and is written at connect on all of them; this only has to survive a
  // connect path that forgot to write it. A shape is safe to add here when it cannot be mistaken for
  // something else that may sit in lumos.address -- G/r prefixes, a .near or .tg suffix, a 64-char
  // hex implicit NEAR account, and Hedera's 0.0.N are each unambiguous.
  //
  // AN EVM 0x ADDRESS IS NOT, and Arc is therefore absent on purpose. lumos.address is one key shared
  // by every chain, and a 0x value in it is as likely to be a bridge destination as a connected Arc
  // wallet. Guessing "arc" from it would put a confident wrong sentence at the top of a Stellar page
  // -- strictly worse than the no-banner case this is meant to fix. When Arc ships, lumos.network
  // carries it. Returning "" for an unrecognised shape is the existing, correct behaviour.
  //
  // String tests, not regexes with escapes: this whole script is emitted from a concatenated string
  // and a backslash here has to survive two levels of quoting.
  + 'if(KNOWN.indexOf(n)<0){ n=""; var l=a.toLowerCase();'
  + 'if(a.charAt(0)==="G"&&a.length===56)n="stellar";'
  + 'else if(a.charAt(0)==="r"&&a.length>=25&&a.length<=35)n="xrpl";'
  + 'else if(l.indexOf("0.0.")===0)n="hedera";'
  + 'else if(l.length>5&&(l.slice(-5)===".near"||l.slice(-3)===".tg"))n="near";'
  + 'else if(l.length===64&&/^[0-9a-f]+$/.test(l))n="near"; }'
  + 'if(!n||n===pc)return;'
  + 'var d=document.documentElement;'
  + 'd.classList.add("lx-wrongchain");'
  + 'd.setAttribute("data-lx-wallet-chain",n);'
  + 'd.setAttribute("data-lx-page-chain",pc);'
  + '}catch(_){}})();</' + 'script>';

// The notice itself, plus a sweep that re-applies the disabled state to CTAs added later. The CSS
// above already stops the pointer; this adds the DOM-level disable so a KEYBOARD activation is
// blocked too — pointer-events does nothing for someone tabbing to a button and pressing Enter.
const BODY = '<script id="lx-wrongchain-js">(function(){try{'
  + 'var d=document.documentElement;'
  + 'if(!d.classList.contains("lx-wrongchain"))return;'
  + 'var CH=' + JSON.stringify(CHAIN) + ';'
  + 'var XS=' + JSON.stringify(CROSSCHAIN) + ';'
  // Kept as NAME so the CTA title below reads unchanged; it is now derived from the one table.
  + 'var NAME={};for(var nk in CH){ if(CH.hasOwnProperty(nk))NAME[nk]=CH[nk].name; }'
  + 'var mine=d.getAttribute("data-lx-wallet-chain")||"";'
  + 'var here=d.getAttribute("data-lx-page-chain")||"";'
  + 'var CTA=' + JSON.stringify(CTA.join(',')) + ';'
  + 'function lock(root){ try{'
  + '[].forEach.call((root||document).querySelectorAll(CTA),function(b){'
  + 'if(b.getAttribute("data-lxwc")==="1")return;'
  + 'b.setAttribute("data-lxwc","1");'
  + 'b.setAttribute("aria-disabled","true");'
  + 'if(b.tagName==="BUTTON"||b.tagName==="INPUT")b.disabled=true;'
  + 'b.setAttribute("title","Connected to "+(NAME[mine]||mine)+" — switch wallets to use "+(NAME[here]||here)+".");'
  + '}); }catch(_){} }'
  // The sentence RAZA asked for, with the site's own word for the action: the header button says
  // "Disconnect", so telling someone to "logout" would name a control that is not there.
  + 'function bar(){'
  + 'if(document.querySelector(".lx-wcbar"))return;'
  + 'var host=document.querySelector(".page")||document.querySelector("main")||document.querySelector(".container");'
  + 'if(!host)return;'
  + 'var el=document.createElement("div");'
  + 'el.className="lx-wcbar"; el.setAttribute("role","status");'
  + 'var ic=document.createElement("span"); ic.className="lx-wcbar-ic";'
  + 'ic.innerHTML=\'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v5"></path><path d="M12 16.2v.1"></path></svg>\';'
  // "connected to XRP Ledger" and "a XRP Ledger wallet" both read as broken English, and this
  // sentence is the whole point of the notice — it is what tells someone why the page will not act.
  // One chain takes an article and the other does not, so both forms come from the chain id rather
  // than from string-concatenating a name and hoping.
  + 'function THE(c){ return (CH[c]&&CH[c].the)||c; }'
  + 'function AN(c){ return CH[c]?(CH[c].art+" "+CH[c].name):c; }'
  + 'var tx=document.createElement("div");'
  + 'var b=document.createElement("b"); b.textContent="View only mode. ";'
  + 'tx.appendChild(b);'
  + 'tx.appendChild(document.createTextNode("You are currently connected to "+THE(mine)'
  + '+". To use "+THE(here)+", disconnect and connect "+AN(here)+" wallet."));'
  // A way out that is not "go and find the disconnect button": the same section on the chain they
  // ARE connected to. Built from this page's own path, so it cannot point at the wrong section.
  // Only a section that EXISTS on the wallet's chain -- see CROSSCHAIN. The old form hard-coded the
  // two ids ("/stellar" or else "/xrpl"), so with a third chain connected it sent a NEAR wallet to
  // the XRPL page; and it offered the link for any first segment at all, including /account and
  // /blog, where the target is a 404 and a 410.
  + 'var seg=(location.pathname||"/").toLowerCase().split("/").filter(Boolean)[0]||"";'
  + 'if(seg&&XS.indexOf(seg)>=0&&CH[mine]){ var go=document.createElement("a"); go.className="lx-wcbar-go";'
  + 'go.href="/"+seg+"/"+mine;'
  + 'go.textContent="Open "+seg+" on "+THE(mine)+" \\u2192";'
  + 'tx.appendChild(document.createElement("br")); tx.appendChild(go); }'
  + 'el.appendChild(ic); el.appendChild(tx);'
  + 'var first=host.firstElementChild;'
  // After the breadcrumb when there is one, so the notice sits with the content rather than above
  // the navigation that got you here.
  + 'if(first&&first.classList&&first.classList.contains("crumb"))host.insertBefore(el,first.nextSibling);'
  + 'else host.insertBefore(el,first);'
  + '}'
  // THE CHIP MARK IS NOT OWNED HERE ANY MORE. This layer briefly did it, and it was the wrong home:
  // it runs only when the chains disagree, while the mark is wrong-by-default on every page until
  // something paints it. _walletlogo.js runs everywhere, already owns that node, and now sets the
  // wallet's chain mark when the wallet has no artwork of its own — plus the gate that stops the
  // flash. Two writers on one node is what produced the flash in the first place.
  // What the sticky bar has to clear, read off the page instead of assumed. Only a header actually
  // PINNED at the top counts: the desktop sidebar (.nx-side) is sticky too and 900px tall, so a
  // naive "tallest sticky element" would push the bar off the bottom of the screen. Hence both
  // guards -- it must sit at the top, and it must be header-sized.
  + 'function fit(){ try{'
  + 'var best=0, c=document.querySelectorAll(".appbar,.topbar,header");'
  + 'for(var i=0;i<c.length;i++){ var e=c[i], s=getComputedStyle(e);'
  + 'if(s.position!=="sticky"&&s.position!=="fixed")continue;'
  + 'var r=e.getBoundingClientRect();'
  + 'if(r.top>2||r.height<24||r.height>160)continue;'
  + 'if(r.height>best)best=r.height; }'
  + 'if(best)document.documentElement.style.setProperty("--lxwc-top",Math.round(best)+"px");'
  + '}catch(_){} }'
  + 'function run(){ bar(); fit(); lock(document); }'
  // the phone and desktop headers are different elements AND different heights, so a rotation or a
  // resize across the breakpoint has to re-measure or the bar hides behind the new one
  + 'try{ addEventListener("resize",fit,{passive:true}); addEventListener("load",fit); }catch(_){}'
  + 'if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run);else run();'
  // Dialogs and tables are built after load, and several of them carry .btn-primary. One observer,
  // disconnected from nothing, is cheaper than re-scanning on a timer.
  + 'try{ new MutationObserver(function(ms){ for(var i=0;i<ms.length;i++){ var ad=ms[i].addedNodes;'
  + 'for(var j=0;j<ad.length;j++){ if(ad[j].nodeType===1)lock(ad[j]); } } })'
  + '.observe(document.documentElement,{childList:true,subtree:true}); }catch(_){}'
  + '}catch(_){}})();</' + 'script>';

let files = 0, pages = 0, swapped = 0, appended = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = 'lumoscore-aptos-' + dev + '.html';
  let data;
  try { data = read(file); } catch (e) { console.error('  ' + file + ': missing — skipped'); continue; }
  const { json, s, e } = getContents(data);
  files++;

  for (const k of Object.keys(json)) {
    let h = json[k];
    if (typeof h !== 'string') continue;
    if (h.indexOf('</head>') < 0 || h.indexOf('</body>') < 0) continue;

    // IN PLACE, NOT STRIP-AND-RE-APPEND. The old form removed all three blocks and put them back at
    // the end of <head> and just before </body>, which lands them LAST in the cascade however early
    // they used to sit -- the trap in [[running-one-stellar-transform-reorders-layers]], whose only
    // other remedy is re-running every transform whose layer belongs after this one. Swapping each
    // block where it already sits keeps its position exactly, so this transform is order-neutral and
    // safe to run on its own ([[a-transform-that-patches-in-place-cannot-reorder]]).
    //
    // Nothing between the old strip and the old append read `h`, so moving the removal is safe here
    // -- that is the first trap named in that note, and it is worth re-checking if code is ever
    // added to this loop.
    //
    // A container that never carried the layer still appends, and still lands last. That is correct,
    // and a layer-order gate should read it as a set difference rather than as a move.
    for (const [open, close, block, tail] of [
      ['<style id="lx-wrongchain-css">', '</style>', STYLE, '</head>'],
      ['<script id="lx-wrongchain">', '</script>', HEAD, '</head>'],
      ['<script id="lx-wrongchain-js">', '</script>', BODY, '</body>'],
    ]) {
      const at = h.indexOf(open);
      const end = at < 0 ? -1 : h.indexOf(close, at);
      if (at >= 0 && end > at) { h = h.slice(0, at) + block + h.slice(end + close.length); swapped++; continue; }
      if (tail === '</head>') { h = h.replace('</head>', block + '</head>'); }
      else { const bi = h.lastIndexOf('</body>'); h = h.slice(0, bi) + block + h.slice(bi); }
      appended++;
    }
    json[k] = h;
    pages++;
  }

  const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
  fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
}

// Swapped vs appended, not one total: on a tree that already carries the layer every block should
// SWAP. An `appended` above zero on a re-run means a block was not found where it was left, which is
// the only outward sign that a layer is about to change position.
console.log('wrong-chain notice: ' + pages + ' page key(s) across ' + files + ' container(s) — '
  + swapped + ' block(s) swapped in place, ' + appended + ' appended');
if (!files) { console.error('  ! no container was read'); process.exit(1); }
