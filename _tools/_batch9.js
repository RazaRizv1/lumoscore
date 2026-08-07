// Batch #9:
//  (1) FOUC fix — move the wallet-chip CSS (lx-topwallet-css + lx-walletchip2-css) from end-of-body into
//      <head> so the top-right chip renders at its final size on first paint (was flashing big — the
//      network-logo img rendered at natural 160px until the late stylesheet applied).
//  (2) Copy toast — the header copy button now shows a bottom-center "Copied to clipboard" toast styled
//      like the Wallet page's toast (replaces the old check-only feedback; still keeps a check on the btn).
//  (3) Wallet open-orders — hide the stray dot/badge after the pair (.order-pair .side) and align the pair
//      name with the Price/Amount/Total values (float the small labels above so the values center).
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

function moveToHead(h,id){
  const re=new RegExp('<style id="'+id+'">[\\s\\S]*?<\\/style>','g');
  const blocks=h.match(re); if(!blocks) return h;
  const block=blocks[0];
  h=h.replace(re,'');
  const hi=h.indexOf('</head>');
  return hi>=0 ? h.slice(0,hi)+block+h.slice(hi) : h;
}

const OO_STYLE='<style id="lx-oofix">'
+'.order-pair .side{display:none !important}'                                   // remove stray dot/badge after the pair
+'.order-details .col{position:relative;text-align:center}'                      // center values so Price sits midway between the asset and Amount
+'.order-details .col .k{position:absolute;bottom:calc(100% + 1px);left:50%;transform:translateX(-50%);white-space:nowrap}'  // float labels above, centered → values center on the name line
+'</style>';

// new copy script: bottom-center toast (Wallet-page style) + button check; blocks the wallet page's own
// copy handler from double-firing (capture + stopImmediatePropagation).
const CK='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
const CK13='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
const COPY_SCRIPT='<script id="lx-chipcopy">(function(){'
+'var CK=\''+CK+'\';var CK13=\''+CK13+'\';'
+'function ensureCSS(){if(document.getElementById("lx-copytoast-css"))return;var st=document.createElement("style");st.id="lx-copytoast-css";'
+'st.textContent=".lx-ctoast-stack{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none}"'
+'+".lx-ctoast{background:var(--text,#16171b);color:var(--bg,#fff);padding:11px 18px 11px 14px;border-radius:10px;font-family:\'Hanken Grotesk\',system-ui,sans-serif;font-size:16px;font-weight:600;display:inline-flex;align-items:center;gap:9px;box-shadow:0 12px 32px rgba(0,0,0,.28),0 2px 8px rgba(0,0,0,.16);animation:lxCtIn .25s ease}"'
+'+".lx-ctoast .ci{width:18px;height:18px;border-radius:50%;background:var(--green,#35c07f);color:#fff;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}"'
+'+"@keyframes lxCtIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}";document.head.appendChild(st);}'
+'function toast(msg){ensureCSS();var stack=document.querySelector(".lx-ctoast-stack");if(!stack){stack=document.createElement("div");stack.className="lx-ctoast-stack";document.body.appendChild(stack);}'
+'var t=document.createElement("div");t.className="lx-ctoast";t.innerHTML=\'<span class="ci">\'+CK+\'</span><span>\'+msg+\'</span>\';stack.appendChild(t);'
+'setTimeout(function(){t.style.transition="opacity .25s ease,transform .25s ease";t.style.opacity="0";t.style.transform="translateY(8px)";setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);},260);},1800);}'
+'document.addEventListener("click",function(e){var b=e.target&&e.target.closest?e.target.closest(".lx-tw-copy"):null;if(!b)return;'
+'e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();'
+'var t=b.getAttribute("data-copy")||"";try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t);}else{var ta=document.createElement("textarea");ta.value=t;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);}}catch(_){}'
+'toast("Copied to clipboard");'
+'if(!b.__lxc){var old=b.innerHTML;b.__lxc=1;b.classList.add("ok");b.innerHTML=CK13;setTimeout(function(){b.innerHTML=old;b.classList.remove("ok");b.__lxc=0;},1200);}'
+'},true);'
+'})();</script>';

let fouc=0, toast=0, oo=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k]; const before=h;
      // (1) move chip CSS to head
      if(h.indexOf('class="lx-topwallet"')>=0){
        h=moveToHead(h,'lx-topwallet-css');
        h=moveToHead(h,'lx-walletchip2-css');
        fouc++;
      }
      // (2) refresh the copy script (toast version)
      if(h.indexOf('id="lx-chipcopy"')>=0){
        h=h.replace(/<script id="lx-chipcopy">[\s\S]*?<\/script>/g,'');
        const bi=h.lastIndexOf('</body>'); if(bi>=0){ h=h.slice(0,bi)+COPY_SCRIPT+h.slice(bi); toast++; }
      }
      // (3) open-orders fix (wallet page) — strip+re-add so updates take effect on re-run
      if(h.indexOf('class="order-pair"')>=0){
        h=h.replace(/<style id="lx-oofix">[\s\S]*?<\/style>/g,'');
        const hi=h.indexOf('</head>'); if(hi>=0){ h=h.slice(0,hi)+OO_STYLE+h.slice(hi); oo++; }
      }
      if(h!==before) json[k]=h;
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('batch9 — FOUC(css→head):'+fouc+' copy-toast:'+toast+' open-orders-fix:'+oo);
