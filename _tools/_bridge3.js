// Cross-chain bridge round-3 (idempotent, all 7 chains, desktop+mobile):
//  A) Review step: show BOTH logos per leg — the network logo + the asset logo (was asset-only).
//  B) Recent transactions: add a trailing explorer link-icon column (icon only, no text).
//  C) Recent transactions: enlarge the From/To network icons.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const XPLINK='<td class="br-xp"><a class="br-xplink" href="#" aria-label="View on explorer" title="View on explorer"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6"></path></svg></a></td>';

const STYLE='<style id="lx-bridge3css">'
/* #8: step 1 had ~89px of nothing between the destination box and Next. .br-errslot reserves room
   for an error message so the button does not jump when one appears -- fair -- but it was doing so
   with a 51px top margin AND a 38px reservation, on a panel that usually has no error at all. The
   reservation goes; the slot sizes to its content and takes a normal gap, and Next carries its own. */
+'.br-errslot{margin-top:14px!important;min-height:0!important}'
+'.br-errslot:empty{display:none!important;margin:0!important}'
+'.br-step .br-actions{margin-top:20px!important}'
// (A) review-leg network logo chip
+'.br-rv-leg .v .lx-rvnet{width:26px;height:26px;flex:0 0 26px;min-width:26px;border-radius:50%;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;background:var(--surface-3)}'
+'.br-rv-leg .v .lx-rvnet:empty{display:none}'
+'.br-rv-leg .v .lx-rvnet img,.br-rv-leg .v .lx-rvnet svg{width:100%;height:100%;object-fit:cover;display:block;border-radius:50%}'
+'.br-rv-leg .v .lx-rvnet .lx-netlm2{font-size:9.5px}'
// (C) bigger From/To network icons in the recent-transactions table (was 20px)
+'.br-table .br-asschip .br-ic.lx-netic{width:30px !important;height:30px !important;flex:0 0 30px !important;min-width:30px}'
+'.br-table .br-asschip .br-ic.lx-netic img,.br-table .br-asschip .br-ic.lx-netic svg{width:100% !important;height:100% !important;object-fit:cover;border-radius:50%}'
+'.br-table .br-asschip{gap:9px}'
// (B) explorer link column
+'.br-table th.br-xph{width:44px}'
+'.br-table td.br-xp{text-align:right;width:44px}'
+'.br-xplink{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;color:var(--text-soft);transition:color .15s,background .15s}'
+'.br-xplink:hover{color:var(--accent);background:var(--surface-2)}'
+'</style>';

// populate the two review-leg network logos: leg[0]=source (site chain), leg[1]=selected destination
const SCRIPT='<script id="lx-bridge3js">(function(){'
+'function fill(){var s3=document.querySelector(\'.br-step[data-step="3"]\');if(!s3)return;var legs=s3.querySelectorAll(".br-rv-leg");if(legs.length<2)return;'
+'var srcNet=document.querySelector(\'.br-step[data-step="2"] .br-io>.br-side .br-wallet .br-ic.lx-netic\');'
+'var pick=document.querySelector(".brd-trigger .br-ic");'
+'var a=legs[0].querySelector("[data-rvnet]"),b=legs[1].querySelector("[data-rvnet]");'
+'if(a&&srcNet&&srcNet.innerHTML.trim())a.innerHTML=srcNet.innerHTML;'
+'if(b&&pick&&pick.innerHTML.trim())b.innerHTML=pick.innerHTML;}'
+'document.addEventListener("click",function(e){var t=e.target&&e.target.closest?e.target.closest(\'[data-go="3"],.br-next\'):null;if(t)setTimeout(fill,50);},true);'
+'try{var s3=document.querySelector(\'.br-step[data-step="3"]\');if(s3){new MutationObserver(function(){if(!s3.hasAttribute("hidden"))setTimeout(fill,20);}).observe(s3,{attributes:true,attributeFilter:["hidden"]});}}catch(_){}'
+'var n=0,iv=setInterval(function(){fill();if(++n>25)clearInterval(iv);},250);'
+'})();</script>';

let n=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain','stellar','xrpl']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      if(!/bridge/.test(k)) continue;
      let h=json[k]; const before=h;
      // (A) inject an empty network-logo span before the asset .ic in each review leg (once)
      if(h.indexOf('data-rvnet')<0){
        h=h.replace(/(<div class="br-rv-leg"><div class="k">[^<]*<\/div><div class="v">)(<span class="ic">)/g,
                    '$1<span class="ic lx-rvnet" data-rvnet></span>$2');
      }
      // (B) explorer link column — header cell + one trailing cell per data row (once)
      if(h.indexOf('br-xplink')<0){
        h=h.replace(/(<th>Destination address<\/th><th>From<\/th><th>To<\/th>)/,'$1<th class="br-xph" aria-label="Explorer"></th>');
        h=h.replace(/(<tr>(?:(?!<\/tr>)[\s\S])*?br-asschip(?:(?!<\/tr>)[\s\S])*?)<\/tr>/g, '$1'+XPLINK+'</tr>');
      }
      // (C)+styles+script: strip prior, re-inject (idempotent)
      h=h.replace(/<style id="lx-bridge3css">[\s\S]*?<\/style>/,'').replace(/<script id="lx-bridge3js">[\s\S]*?<\/script>/,'');
      const bi=h.lastIndexOf('</body>'); if(bi>=0) h=h.slice(0,bi)+STYLE+SCRIPT+h.slice(bi);
      if(h!==before){ json[k]=h; n++; }
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('bridge review-legs + tx explorer link + bigger From/To icons on '+n+' pages');
