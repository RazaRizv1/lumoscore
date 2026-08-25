// Header connection state: make the topbar wallet chip (.lx-topwallet) reflect REAL connection.
//  - disconnected (no localStorage lumos.wallet/address): chip becomes an ember "Connect Wallet" button
//    that opens the connect modal (returns to page after).
//  - connected: shows the real truncated address (from localStorage) if we have one, else keeps the
//    baked demo address (demo/unsupported-wallet connect).
//  - Disconnect (.nx-logout sidebar button) clears localStorage and reloads.
// window-capture (beats inline onclick / other interceptors). NET baked per chain. Idempotent.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const STYLE='<style id="lx-whead-css">'
// !important because a later chip stylesheet (_topwallet / _walletchip2) also paints .lx-topwallet, and
// it was winning — the disconnected chip lost its accent fill and rendered white label on near-white
// (computed rgb(250,251,252)), so the button was present but unreadable.
+'.lx-topwallet.lx-tw-disc{background:var(--accent,#ea6a2c)!important;border-color:var(--accent,#ea6a2c)!important;color:#fff!important;justify-content:center;padding:0 20px;gap:8px}'
+'.lx-topwallet.lx-tw-disc:hover{background:#d85f22!important;border-color:#d85f22!important}'
+'.lx-tw-cbtn{display:inline-flex;align-items:center;gap:8px;font:700 13.5px/1 "Hanken Grotesk",system-ui,sans-serif;color:#fff;letter-spacing:.01em}'
+'.lx-tw-cbtn svg{width:16px;height:16px}'
+'.lx-launch{display:inline-flex;align-items:center;justify-content:center;height:34px;padding:0 14px;border-radius:10px;border:1px solid var(--accent,#ea6a2c);background:var(--accent,#ea6a2c);color:#fff;font:700 13px/1 "Hanken Grotesk",system-ui,sans-serif;white-space:nowrap;cursor:pointer;flex-shrink:0}'
+'.lx-launch:active{background:#d85f22;border-color:#d85f22}'
// AUDIT #12 (FUNDS): the design baked a foreign address into the chip markup, so every page paints
// "0x068d…1e1c" for a beat before sync() swaps in the real one — and it is a *copyable* fake.
// The build now empties both, and these rules keep the chip from collapsing in the meantime.
+'.lx-topwallet .lx-tw-addr:empty{display:inline-block;width:86px;height:11px;border-radius:6px;background:var(--border);opacity:.5;animation:lxTwSk 1.15s ease-in-out infinite}'
+'.lx-topwallet .lx-tw-copy[data-copy=""]{visibility:hidden}'
+'@keyframes lxTwSk{0%,100%{opacity:.28}50%{opacity:.6}}'
// MOBILE app bar. The design puts a bare initials circle top-right, which renders as an empty disc
// once the baked demo initials are cleared — it tells the user nothing. Desktop shows the network mark
// plus the shortened address, so mirror that: the avatar becomes a chip.
+'.avatar-sm.lx-mav{width:auto!important;height:auto!important;border-radius:999px;background:var(--surface-2,#1b1c22)!important;'
+'border:1px solid var(--border);display:inline-flex;align-items:center;gap:7px;padding:5px 10px 5px 6px;font-size:0;color:transparent}'
+'.avatar-sm.lx-mav::before{content:"";width:20px;height:20px;border-radius:50%;flex:0 0 auto;'
+'background:var(--lx-netlogo) center/cover no-repeat}'
+'.avatar-sm.lx-mav::after{content:attr(data-addr);font:700 11.5px/1 "JetBrains Mono",ui-monospace,monospace;color:var(--text)}'
// item 12: give the wordmark priority over the address chip on a narrow header.
+'@media (max-width:560px){'
+'.appbar .logo{flex:0 0 auto!important;overflow:visible!important;min-width:0}'
+'.appbar .logo .logo-text{overflow:visible!important}'
+'.appbar .avatar-sm.lx-mav{flex:0 1 auto!important;min-width:0;overflow:hidden}'
+'.appbar .avatar-sm.lx-mav::after{overflow:hidden;max-width:100%}'
+'}'
// The slide-menu account row leads with a generic wallet glyph; on a Stellar-only app the network mark
// is the more useful thing to show, and it matches the app bar.
// #9: the header search field visibly changed size a beat after load.
//
// It is a webfont swap, and the metric-matched fallback that exists to hide it is calibrated wrong.
// Measured on the dashboard placeholder string at 18.5px: Hanken Grotesk renders 265x25, plain
// sans-serif 266x22 -- near enough -- and 'HG Metric Fallback' 226x18, because its size-adjust (85.4%
// for the Arial branch) shrinks a face that was already the right width. So the field paints 15% narrow
// and short, then snaps out to full size when the webfont arrives.
//
// Two changes, both scoped to this field rather than to the page's typography: drop the mis-calibrated
// fallback from ITS chain so the pre-swap paint uses plain sans-serif, which is within a pixel of the
// webfont; and give it an explicit line-height so the box height stops depending on font metrics at all.
// The wider calibration problem is left alone deliberately -- it is site-wide typography and not what
// was reported.
+'.topbar .search-box input{font-family:"Hanken Grotesk",sans-serif!important;line-height:24px!important}'
// #22: the app bar ships <div class="avatar-sm">RR</div> -- baked demo initials belonging to nobody.
// They paint with the document and are only cleared once sync() has run, so every mobile page opened
// with a flash of someone else's monogram in the corner. .lx-mav hides the text (font-size:0), but that
// class arrives too late to prevent the paint, so the disc is held back until the header has been
// synced once. Markup would be the better fix, but the design re-renders this bar.
+'html:not(.lx-hdrdone) .avatar-sm{visibility:hidden!important}'
+'.mu-av.lx-mav-net{background:var(--lx-netlogo) center/cover no-repeat!important}'
+'.mu-av.lx-mav-net>svg{display:none!important}'
+'</style>';

// strip the baked demo address out of the chip markup (idempotent: after one pass there is no 0x… left)
function blankChipAddr(h){
  return h.replace(/(<span class="lx-tw-addr">)0x[0-9a-fA-F…]{2,}[^<]*(<\/span>)/g,'$1$2')
          .replace(/(<button class="lx-tw-copy"[^>]*?)data-copy="0x[0-9a-fA-F]{16,}"/g,'$1data-copy=""');
}

// #22, round two: take the baked initials OUT OF THE MARKUP.
//
// The CSS gate added last time cannot win this race and never could. STYLE and the script are appended
// before </body>, so on the bridge page the rule lands at byte ~902,000 while the avatar markup sits at
// ~43,800 -- the browser has painted "RR" long before it parses the rule that was supposed to hide it.
// Moving the whole stylesheet into <head> would fix the ordering but reshuffles the cascade for every
// other rule in it, which is not a trade worth making for one disc.
//
// So remove the content instead: with no text there is nothing wrong to paint, whatever order things
// load in. The gate stays as a second line of defence for the empty circle itself. Only ever strips a
// short run of plain text -- if the design ever puts real markup in there, this leaves it alone.
function blankAvatar(h){
  return h.replace(/<div class="avatar-sm"([^>]*)>([^<]{0,12})<\/div>/g,function(all,attrs){
    if(/style="/.test(attrs))return '<div class="avatar-sm"'+attrs.replace(/style="/,'style="visibility:hidden;')+'></div>';
    return '<div class="avatar-sm"'+attrs+' style="visibility:hidden"></div>';
  });
}

function scriptFor(net){
  return '<script id="lx-whead">(function(){'
  +'var NET="'+net+'";function actNet(){try{return localStorage.getItem("lumos.chain")||NET;}catch(_){return NET;}}'
  +'var PLUG=\'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2v6M15 2v6M7 8h10v3a5 5 0 0 1-10 0z"/><path d="M12 16v6"/></svg>\';'
  // The landing page\'s Launch App button uses a right arrow AFTER the label, not a plug before it.
  // Same button, same journey, so it gets the same mark — copied from lumoscore-landing rather than
  // redrawn, so the two cannot drift.
  +'var ARROW=\'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>\';'
  +'function ls(k){try{return localStorage.getItem(k);}catch(_){return null;}}'
  +'function trunc(a){a=String(a||"");return a.length>14?a.slice(0,6)+"\\u2026"+a.slice(-4):a;}'
  +'function sync(){'
  +'var wallet=ls("lumos.wallet"),addr=ls("lumos.address");var on=!!(wallet||addr);'
  +'mobileMenu(on,addr);'
  +'var chip=document.querySelector(".lx-topwallet");'
  // MOBILE: no .lx-topwallet on these pages. The design leaves an empty .avatar-sm circle in the top
  // bar, which looked like a broken button. Build a real Launch App pill beside it while disconnected.
  +'if(!chip){mobileLaunch(on);if(addr)fixOwnAddrCopies(addr);return;}'
  +'if(on){if(chip.getAttribute("data-lxdisc")){if(chip.getAttribute("data-lxorig")!=null)chip.innerHTML=chip.getAttribute("data-lxorig");chip.removeAttribute("data-lxdisc");chip.classList.remove("lx-tw-disc");chip.style.removeProperty("background");chip.style.removeProperty("border-color");chip.style.removeProperty("color");}'
  // AUDIT #7 (FUNDS): the chip's text was updated to the real G… address but the sibling copy button kept the
  // design's baked data-copy="0x068dc5d4…" (an Aptos/EVM address), so "Copy address" silently yielded a foreign
  // address. Re-point EVERY copy affordance in the chip at the real address whenever we sync it.
  +'if(addr){var ae=chip.querySelector(".lx-tw-addr");if(ae)ae.textContent=trunc(addr);'
  +'var cps=chip.querySelectorAll("[data-copy]");for(var ci=0;ci<cps.length;ci++){if(cps[ci].getAttribute("data-copy")!==addr)cps[ci].setAttribute("data-copy",addr);}'
  +'if(chip.hasAttribute("data-copy")&&chip.getAttribute("data-copy")!==addr)chip.setAttribute("data-copy",addr);'
  +'fixOwnAddrCopies(addr);}}'
  +'else{if(chip.getAttribute("data-lxorig")==null)chip.setAttribute("data-lxorig",chip.innerHTML);chip.setAttribute("data-lxdisc","1");chip.classList.add("lx-tw-disc");chip.setAttribute("title","Launch the app");chip.style.setProperty("background","#ea6a2c","important");chip.style.setProperty("border-color","#ea6a2c","important");chip.style.setProperty("color","#fff","important");chip.innerHTML=\'<span class="lx-tw-cbtn">Launch App\'+ARROW+\'</span>\';}}'
  // AUDIT #7 (FUNDS) — same bug outside the chip (e.g. the wallet hero "copy my address" button): the design
  // baked a demo EVM/Aptos address into data-copy. Rewrite ONLY targets that clearly mean "this user's wallet
  // address" AND currently hold a 0x value — so a legitimate EVM address (bridge destination) is never touched.
  // NOTE: must sit AFTER sync()'s closing brace — putting it between the if(on) and its else broke the script.
  +'function mobileLaunch(on){try{'
  +'var av=document.querySelector(".avatar-sm");if(!av)return;'
  +'var btn=document.querySelector(".lx-launch");'
  // connected: drop the button, give the avatar back
  +'if(on){if(btn)btn.remove();av.style.display="";try{av.style.visibility="";}catch(_e3){}return;}'
  // disconnected: hide the empty circle, put the button where it was
  +'av.style.display="none";'
  +'if(btn)return;'
  +'btn=document.createElement("button");btn.type="button";btn.className="lx-launch";'
  +'btn.setAttribute("data-lxdisc","1");btn.setAttribute("title","Launch the app");'
  +'btn.innerHTML="Launch App"+ARROW;'
  +'if(av.parentNode)av.parentNode.insertBefore(btn,av);'
  +'}catch(_){}}'
  +'function mobileMenu(on,addr){try{'
  +'var los=document.querySelectorAll(".nx-logout,.mu-gear[aria-label=Disconnect]");'
  +'for(var i=0;i<los.length;i++)los[i].style.display=on?"":"none";'
  +'var mn=document.querySelector(".mu-name"),ms=document.querySelector(".mu-sub");'
  +'if(mn)mn.textContent=on&&addr?trunc(addr):(on?"":"Not connected");'
  +'if(ms)ms.textContent=on?("Connected \\u00b7 "+netLabel()):"Tap to connect a wallet";'
  // Disconnected, the whole account row is redundant now that Launch App sits in the header — it said
  // the same thing twice and gave the visitor a second, less obvious way in. Hide the row (not just the
  // text) while disconnected; it comes back the moment there is an address to show.
  +'var row=(mn||ms);row=row&&row.closest?(row.closest(".mu-acct")||row.closest(".menu-acct")||row.closest(".mu-row")||(row.parentElement&&row.parentElement.parentElement)):null;'
  +'if(row&&row.style)row.style.display=on?"":"none";'
  // The account row leads with a generic wallet glyph — swap it for the network mark.
  +'var av=document.querySelector(".mu-av");'
  +'if(av){av.style.setProperty("--lx-netlogo",NETLOGO);av.classList.add("lx-mav-net");}'
  // App bar, top right: an initials disc that says nothing becomes the network mark + short address,
  // matching the desktop chip. Only when connected — with no wallet there is no address to show, so
  // the design's own avatar is left alone.
  +'var sm=document.querySelector(".avatar-sm");'
  +'if(sm){if(on&&addr){sm.style.setProperty("--lx-netlogo",NETLOGO);'
  +'sm.setAttribute("data-addr",trunc(addr));sm.classList.add("lx-mav");}'
  +'else{sm.classList.remove("lx-mav");sm.removeAttribute("data-addr");}'
  // #36: it has an identity now (or is correctly staying blank), so it may be seen.
  +'try{sm.style.visibility="";}catch(_e2){}}'
  // #22: the disc has now been given its real identity (or correctly left alone), so it may paint.
  +'try{document.documentElement.classList.add("lx-hdrdone");}catch(_e){}'
  +'}catch(_){}}'
  // Absolute, not relative: these pages answer on nested clean URLs like /trade/stellar/<ASSET>, where a
  // relative "assets/…" would resolve against that path and 404.
  +'var NETLOGO=\'url("/assets/tokens/xlm.png")\';'
  +'function netLabel(){var n=actNet();return n?n.charAt(0).toUpperCase()+n.slice(1):"Stellar";}'
    +'function fixOwnAddrCopies(addr){if(!addr)return;try{'
  +'var all=document.querySelectorAll("[data-copy]");'
  +'for(var i=0;i<all.length;i++){var el=all[i],v=el.getAttribute("data-copy")||"";'
  +'if(!/^0x[0-9a-fA-F]{32,}$/.test(v))continue;'
  +'var ownAddr=(el.getAttribute("data-copy-label")||"").toLowerCase().indexOf("wallet address")>=0'
  +'||!!(el.closest&&(el.closest(".lx-topwallet")||el.closest(".wallet-chip")||el.closest(".hero-id-row")||el.closest("#modalReceive")));'
  +'if(ownAddr)el.setAttribute("data-copy",addr);}'
  +'}catch(_){}}'
  // Some of these buttons are (re)rendered by later data layers, after sync() has run — so also correct the
  // value at the moment of the click. A window-CAPTURE listener runs before the design's copy handler.
  +'window.addEventListener("click",function(e){try{var t=e.target&&e.target.closest?e.target.closest("[data-copy]"):null;if(!t)return;'
  +'var a=ls("lumos.address");if(!a)return;var v=t.getAttribute("data-copy")||"";'
  +'if(!/^0x[0-9a-fA-F]{32,}$/.test(v))return;'
  +'var own=(t.getAttribute("data-copy-label")||"").toLowerCase().indexOf("wallet address")>=0'
  +'||!!(t.closest(".lx-topwallet")||t.closest(".wallet-chip")||t.closest(".hero-id-row")||t.closest("#modalReceive"));'
  +'if(own)t.setAttribute("data-copy",a);}catch(_){}},true);'
  +'[700,1500,3000].forEach(function(ms){setTimeout(function(){try{fixOwnAddrCopies(ls("lumos.address"));}catch(_){}},ms);});'
  +'window.addEventListener("click",function(e){var t=e.target;if(!t||!t.closest)return;'
  // "Connect Wallet" opens the NETWORK screen first, then the wallet list for whatever is picked.
  // Call lxChooseNetwork with NO destination: passing one (it used to get location.href) makes the
  // network pick NAVIGATE to that destination instead of advancing to the wallet list, which reloaded
  // the page and destroyed the modal. The other half of that bug lived in _wallet_realconnect.js —
  // network rows carry .lxw-row but no data-wallet, so the real handler skipped them and the design's
  // demo listener navigated. It now claims data-lxnet rows too, so this flow stays in the modal.
  +'var dc=t.closest(".lx-topwallet[data-lxdisc=\\"1\\"]")||t.closest(".lx-launch");if(dc){e.preventDefault();e.stopImmediatePropagation();'
  // "Launch App" means take me into the app, not take me back to what I was reading. Always the
  // dashboard, whatever page it was clicked from and whichever chain they end up connecting on.
  +'try{sessionStorage.setItem("lumos.connDest","home");}catch(_){}'
  +'if(window.lxChooseNetwork)window.lxChooseNetwork();else if(window.lxwOpenWallet)window.lxwOpenWallet(actNet());return;}'
  // Disconnect leaves for the landing page rather than reloading in place. Reloading only worked on
  // GATED pages, where the auth gate then bounced to "/" — on a public page (Trade, Pools, an asset
  // page) it reloaded a signed-out view of somewhere that assumes a wallet. replace() not href, so the
  // signed-in page does not sit in history for the back button to restore.
  +'var lo=t.closest(".nx-logout")||t.closest(".mu-gear[aria-label=Disconnect]");if(lo){e.preventDefault();e.stopImmediatePropagation();try{localStorage.removeItem("lumos.wallet");localStorage.removeItem("lumos.address");localStorage.removeItem("lumos.network");}catch(_){}try{location.replace("/");}catch(_){try{location.href="/";}catch(__){sync();}}return;}},true);'
  +'if(document.readyState!=="loading")sync();else document.addEventListener("DOMContentLoaded",sync);'
  // #22 safety net. The gate above is a CSS rule waiting on a class this script sets; if anything ever
  // stops it reaching that line, the class lands here anyway and the avatar appears as the design drew
  // it. A hidden element whose un-hider can be removed is how a small bug becomes an invisible header --
  // this file is not going to be that.
  +'setTimeout(function(){try{document.documentElement.classList.add("lx-hdrdone");'
  // and clear the inline hide, so a failure upstream shows the design's disc rather than nothing at all
  +'var _sm=document.querySelector(".avatar-sm");if(_sm)_sm.style.visibility="";'
  +'}catch(_){}},2500);'
  +'setTimeout(sync,300);'
  +'})();</script>';
}

let n=0;
for(const chain of ['aptos','hedera','starknet','vechain','worldchain','stellar','xrpl']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${chain}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k];
      if(h.indexOf('lx-topwallet')<0) continue;              // no header chip on this page
      h=h.replace(/<style id="lx-whead-css">[\s\S]*?<\/style>/g,'').replace(/<script id="lx-whead">[\s\S]*?<\/script>/g,'');
      h=blankChipAddr(h);
      h=blankAvatar(h);
      const bi=h.lastIndexOf('</body>'); if(bi<0) continue;
      json[k]=h.slice(0,bi)+STYLE+scriptFor(chain)+h.slice(bi); n++;
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('wallet header-sync injected on '+n+' page keys');
