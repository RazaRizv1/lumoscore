// Wallet gate: on the action pages (Trade-Asset, Pools-Pool, Cross-chain/Bridge, Launchpad), when NO
// wallet is connected, turn the primary CTA into "Connect wallet" (opens the connect modal, returns to
// the page after connecting). Once connected (localStorage lumos.wallet/address set by the connect flow),
// the CTA reverts to its normal label/action. Idempotent; NET + selector baked per chain/page.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

// page-type marker (substring in the key) -> primary CTA selector + a class present-check
const TYPES=[
  {m:'dex-asset', sel:'.dxa-trade-cta', mark:'dxa-trade-cta'},
  {m:'amm-pool',  sel:'.dw-cta',        mark:'dw-cta'},
  {m:'bridge',    sel:'.br-next',       mark:'br-next'},
  {m:'launch-token', sel:'.summary-cta', mark:'summary-cta'},
];

function scriptFor(net,sel){
  return '<style id="lx-gate-css">'+'[data-lxgate="1"]{font-size:0!important;color:transparent!important}'+'[data-lxgate="1"]::after{content:"Connect wallet";font-size:15px;font-weight:800;letter-spacing:0;color:#fff;display:inline-block}'+'</'+'style>'+'<script id="lx-gate">(function(){'
  +'var NET="'+net+'",SEL="'+sel+'";'
  +'function conn(){try{return !!(localStorage.getItem("lumos.wallet")||localStorage.getItem("lumos.address"));}catch(_){return false;}}'
  +'function actNet(){try{return localStorage.getItem("lumos.chain")||NET;}catch(_){return NET;}}'
  +'function apply(){var on=conn();var els=document.querySelectorAll(SEL);for(var i=0;i<els.length;i++){var b=els[i];'
  +'if(on){if(b.getAttribute("data-lxgate")){if(b.getAttribute("data-lxorig")!=null)b.textContent=b.getAttribute("data-lxorig");'
  +'if(b.getAttribute("data-lxdis")==="1"){try{b.disabled=true;}catch(_){}b.setAttribute("disabled","");}'
  +'b.style.removeProperty("opacity");b.style.removeProperty("cursor");b.removeAttribute("data-lxdis");'
  +'b.removeAttribute("aria-label");b.removeAttribute("data-lxgate");}}'
  // Disconnected, the CTA must be ACTIVE — it is the way in, not a preview of something you cannot do.
  // The data layer disables it (no amount, no balance, nothing to quote) which is right when connected
  // and wrong when there is no wallet at all: it rendered a pale, untappable "Swap". So clear the
  // disabled state as well as relabelling, and keep the original around to hand back on connect.
  +'else{if(b.getAttribute("data-lxorig")==null)b.setAttribute("data-lxorig",(b.textContent||"").trim());'
  +'if(b.getAttribute("data-lxdis")==null)b.setAttribute("data-lxdis",(b.disabled||b.hasAttribute("disabled"))?"1":"0");'
  +'if(b.textContent.trim()!=="Connect wallet")b.textContent="Connect wallet";'
  +'try{b.disabled=false;}catch(_){}b.removeAttribute("disabled");b.removeAttribute("aria-disabled");'
  +'b.classList.remove("disabled","is-disabled","btn-disabled");'
  +'b.style.removeProperty("pointer-events");b.style.setProperty("opacity","1","important");b.style.setProperty("cursor","pointer","important");'
  +'b.setAttribute("aria-label","Connect wallet");b.setAttribute("data-lxgate","1");}}}'
  // window-capture so this runs BEFORE any document-capture interceptor (e.g. the Trade "Review order" modal)
  +'window.addEventListener("click",function(e){var b=e.target&&e.target.closest?e.target.closest("[data-lxgate=\\"1\\"]"):null;if(b){e.preventDefault();e.stopImmediatePropagation();'
  // Remember the chain this page was showing when they clicked. Connect on the same chain and they
  // come back to exactly this asset/pool; connect on a different one and this page is meaningless to
  // them, so the post-connect step sends them to that chain's dashboard instead.
  +'try{sessionStorage.setItem("lumos.connDest","stay:"+actNet());}catch(_){}'
  +'if(window.lxChooseNetwork)window.lxChooseNetwork(location.href);else if(window.lxwOpenWallet)window.lxwOpenWallet(actNet(),location.href);return;}setTimeout(apply,60);},true);'
  +'if(document.readyState!=="loading")apply();else document.addEventListener("DOMContentLoaded",apply);'
  +'setTimeout(apply,350);setTimeout(apply,1000);'
  // The data layer re-renders this button whenever the quote changes, which puts "Swap" and the disabled
  // state straight back. Timers alone lose that race, so watch the button and re-assert after any change.
  +'try{var mo=new MutationObserver(function(){if(mo.__b)return;mo.__b=1;setTimeout(function(){mo.__b=0;apply();},40);});'
  +'var host=document.querySelector(SEL);host=host&&host.parentNode?host.parentNode:document.body;'
  +'if(host)mo.observe(host,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["disabled","class"]});}catch(_){}'
  +'})();</script>';
}

let n=0;
for(const chain of ['aptos','hedera','starknet','vechain','worldchain','stellar','xrpl']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${chain}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      const type=TYPES.find(t=>k.indexOf(t.m)>=0);
      if(!type) continue;
      let h=json[k];
      if(h.indexOf(type.mark)<0) continue;                 // CTA not on this page — skip
      h=h.replace(/<style id="lx-gate-css">[\s\S]*?<\/style>/g,'').replace(/<script id="lx-gate">[\s\S]*?<\/script>/g,''); // idempotent: BOTH, or rebuilds stack them
      const bi=h.lastIndexOf('</body>'); if(bi<0) continue;
      h=h.slice(0,bi)+scriptFor(chain,type.sel)+h.slice(bi);
      json[k]=h; n++;
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('wallet gate injected on '+n+' page keys');
