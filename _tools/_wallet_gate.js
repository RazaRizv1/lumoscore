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
  return '<script id="lx-gate">(function(){'
  +'var NET="'+net+'",SEL="'+sel+'";'
  +'function conn(){try{return !!(localStorage.getItem("lumos.wallet")||localStorage.getItem("lumos.address"));}catch(_){return false;}}'
  +'function actNet(){try{return localStorage.getItem("lumos.chain")||NET;}catch(_){return NET;}}'
  +'function apply(){var on=conn();var els=document.querySelectorAll(SEL);for(var i=0;i<els.length;i++){var b=els[i];'
  +'if(on){if(b.getAttribute("data-lxgate")){if(b.getAttribute("data-lxorig")!=null)b.textContent=b.getAttribute("data-lxorig");b.removeAttribute("data-lxgate");}}'
  +'else{if(b.getAttribute("data-lxorig")==null)b.setAttribute("data-lxorig",(b.textContent||"").trim());if(b.textContent.trim()!=="Connect wallet")b.textContent="Connect wallet";b.setAttribute("data-lxgate","1");}}}'
  // window-capture so this runs BEFORE any document-capture interceptor (e.g. the Trade "Review order" modal)
  +'window.addEventListener("click",function(e){var b=e.target&&e.target.closest?e.target.closest("[data-lxgate=\\"1\\"]"):null;if(b){e.preventDefault();e.stopImmediatePropagation();if(window.lxChooseNetwork)window.lxChooseNetwork(location.href);else if(window.lxwOpenWallet)window.lxwOpenWallet(actNet(),location.href);return;}setTimeout(apply,60);},true);'
  +'if(document.readyState!=="loading")apply();else document.addEventListener("DOMContentLoaded",apply);'
  +'setTimeout(apply,350);setTimeout(apply,1000);'
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
      h=h.replace(/<script id="lx-gate">[\s\S]*?<\/script>/,''); // idempotent
      const bi=h.lastIndexOf('</body>'); if(bi<0) continue;
      h=h.slice(0,bi)+scriptFor(chain,type.sel)+h.slice(bi);
      json[k]=h; n++;
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('wallet gate injected on '+n+' page keys');
