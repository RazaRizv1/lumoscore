// Header connection state: make the topbar wallet chip (.lx-topwallet) reflect REAL connection.
//  - disconnected (no localStorage lumos.wallet/address): chip becomes an ember "Connect Wallet" button
//    that opens the connect modal (returns to page after).
//  - connected: shows the real truncated address (from localStorage) if we have one, else keeps the
//    baked demo address (demo/unsupported-wallet connect).
//  - Disconnect (.nx-logout sidebar button) clears localStorage and reloads.
// window-capture (beats inline onclick / other interceptors). NET baked per chain. Idempotent.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const STYLE='<style id="lx-whead-css">'
+'.lx-topwallet.lx-tw-disc{background:var(--accent);border-color:var(--accent);color:#fff;justify-content:center;padding:0 20px;gap:8px}'
+'.lx-topwallet.lx-tw-disc:hover{background:#d85f22;border-color:#d85f22}'
+'.lx-tw-cbtn{display:inline-flex;align-items:center;gap:8px;font:700 13.5px/1 "Hanken Grotesk",system-ui,sans-serif;color:#fff;letter-spacing:.01em}'
+'.lx-tw-cbtn svg{width:16px;height:16px}'
// AUDIT #12 (FUNDS): the design baked a foreign address into the chip markup, so every page paints
// "0x068d…1e1c" for a beat before sync() swaps in the real one — and it is a *copyable* fake.
// The build now empties both, and these rules keep the chip from collapsing in the meantime.
+'.lx-topwallet .lx-tw-addr:empty{display:inline-block;width:86px;height:11px;border-radius:6px;background:var(--border);opacity:.5;animation:lxTwSk 1.15s ease-in-out infinite}'
+'.lx-topwallet .lx-tw-copy[data-copy=""]{visibility:hidden}'
+'@keyframes lxTwSk{0%,100%{opacity:.28}50%{opacity:.6}}'
+'</style>';

// strip the baked demo address out of the chip markup (idempotent: after one pass there is no 0x… left)
function blankChipAddr(h){
  return h.replace(/(<span class="lx-tw-addr">)0x[0-9a-fA-F…]{2,}[^<]*(<\/span>)/g,'$1$2')
          .replace(/(<button class="lx-tw-copy"[^>]*?)data-copy="0x[0-9a-fA-F]{16,}"/g,'$1data-copy=""');
}

function scriptFor(net){
  return '<script id="lx-whead">(function(){'
  +'var NET="'+net+'";function actNet(){try{return localStorage.getItem("lumos.chain")||NET;}catch(_){return NET;}}'
  +'var PLUG=\'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2v6M15 2v6M7 8h10v3a5 5 0 0 1-10 0z"/><path d="M12 16v6"/></svg>\';'
  +'function ls(k){try{return localStorage.getItem(k);}catch(_){return null;}}'
  +'function trunc(a){a=String(a||"");return a.length>14?a.slice(0,6)+"\\u2026"+a.slice(-4):a;}'
  +'function sync(){var chip=document.querySelector(".lx-topwallet");if(!chip)return;'
  +'var wallet=ls("lumos.wallet"),addr=ls("lumos.address");var on=!!(wallet||addr);'
  +'if(on){if(chip.getAttribute("data-lxdisc")){if(chip.getAttribute("data-lxorig")!=null)chip.innerHTML=chip.getAttribute("data-lxorig");chip.removeAttribute("data-lxdisc");chip.classList.remove("lx-tw-disc");}'
  // AUDIT #7 (FUNDS): the chip's text was updated to the real G… address but the sibling copy button kept the
  // design's baked data-copy="0x068dc5d4…" (an Aptos/EVM address), so "Copy address" silently yielded a foreign
  // address. Re-point EVERY copy affordance in the chip at the real address whenever we sync it.
  +'if(addr){var ae=chip.querySelector(".lx-tw-addr");if(ae)ae.textContent=trunc(addr);'
  +'var cps=chip.querySelectorAll("[data-copy]");for(var ci=0;ci<cps.length;ci++){if(cps[ci].getAttribute("data-copy")!==addr)cps[ci].setAttribute("data-copy",addr);}'
  +'if(chip.hasAttribute("data-copy")&&chip.getAttribute("data-copy")!==addr)chip.setAttribute("data-copy",addr);'
  +'fixOwnAddrCopies(addr);}}'
  +'else{if(chip.getAttribute("data-lxorig")==null)chip.setAttribute("data-lxorig",chip.innerHTML);chip.setAttribute("data-lxdisc","1");chip.classList.add("lx-tw-disc");chip.setAttribute("title","Connect a wallet");chip.innerHTML=\'<span class="lx-tw-cbtn">\'+PLUG+\'Connect Wallet</span>\';}}'
  // AUDIT #7 (FUNDS) — same bug outside the chip (e.g. the wallet hero "copy my address" button): the design
  // baked a demo EVM/Aptos address into data-copy. Rewrite ONLY targets that clearly mean "this user's wallet
  // address" AND currently hold a 0x value — so a legitimate EVM address (bridge destination) is never touched.
  // NOTE: must sit AFTER sync()'s closing brace — putting it between the if(on) and its else broke the script.
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
  // "Connect Wallet" opens the WALLET PICKER for the network we are already on — it must not open the
  // network screen. lxChooseNetwork is a chain SWITCHER: picking a network navigates to that chain's
  // copy of the page. On a Stellar-only site, choosing Stellar from /pools/stellar navigated to
  // /pools/stellar — a reload that destroyed the modal, so the button looked dead. Passing no
  // destination did not help: the navigation is in the network-pick handler, not the home argument.
  // lxwOpenWallet(net) with NO destination opens the picker in place and leaves you where you were,
  // which is what someone pressing "Connect" on a pools page actually wants.
  +'var dc=t.closest(".lx-topwallet[data-lxdisc=\\"1\\"]");if(dc){e.preventDefault();e.stopImmediatePropagation();if(window.lxwOpenWallet)window.lxwOpenWallet(actNet());else if(window.lxChooseNetwork)window.lxChooseNetwork();return;}'
  +'var lo=t.closest(".nx-logout");if(lo){e.preventDefault();e.stopImmediatePropagation();try{localStorage.removeItem("lumos.wallet");localStorage.removeItem("lumos.address");localStorage.removeItem("lumos.network");}catch(_){}try{location.reload();}catch(_){sync();}return;}},true);'
  +'if(document.readyState!=="loading")sync();else document.addEventListener("DOMContentLoaded",sync);'
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
      const bi=h.lastIndexOf('</body>'); if(bi<0) continue;
      json[k]=h.slice(0,bi)+STYLE+scriptFor(chain)+h.slice(bi); n++;
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('wallet header-sync injected on '+n+' page keys');
