// Combined UX fixes:
//  (a) NO-FLASH sidebar collapse — apply .nx-collapsed in a script placed RIGHT AFTER </aside>,
//      so the sidebar's FIRST paint is already collapsed (no expanded->collapsed flash). Wiring
//      (save on toggle) stays before </body>.
//  (b) BULLETPROOF Pools tab switch — a capture-phase, head-registered click handler that switches
//      #panelAllPools/#panelMyPositions before anything else can swallow the click.
// Replaces the earlier lx-sidestate script.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const EARLY='<script id="lx-sc-early">(function(){try{var s=document.querySelector(".nx-side");if(s&&localStorage.getItem("lumos.side")==="1")s.classList.add("nx-collapsed");}catch(e){}})();</script>';
const WIRE='<script id="lx-sc-wire">(function(){function wire(){var s=document.querySelector(".nx-side");if(!s)return;var b=s.querySelector(".nx-collapse");if(b&&!b.__lxSide){b.__lxSide=1;b.addEventListener("click",function(){setTimeout(function(){try{localStorage.setItem("lumos.side",s.classList.contains("nx-collapsed")?"1":"0");}catch(e){}},0);});}}if(document.readyState!=="loading")wire();else document.addEventListener("DOMContentLoaded",wire);})();</script>';
const TABFIX='<script id="lx-tabfix">(function(){document.addEventListener("click",function(e){var btn=e.target&&e.target.closest?e.target.closest("#poolTabs button[data-tab]"):null;if(!btn)return;e.stopPropagation();var mine=btn.getAttribute("data-tab")==="mine";var all=document.getElementById("panelAllPools"),my=document.getElementById("panelMyPositions"),pag=document.getElementById("paginationAll");if(all)all.style.display=mine?"none":"";if(my)my.style.display=mine?"":"none";if(pag)pag.style.display=mine?"none":"";var bs=document.querySelectorAll("#poolTabs button");for(var i=0;i<bs.length;i++)bs[i].classList.toggle("active",bs[i]===btn);},true);})();</script>';

let s1=0,s2=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k]; const before=h;
      // remove earlier one-shot sidebar script
      h=h.replace(/<script id="lx-sidestate">[\s\S]*?<\/script>/g,'')
         .replace(/<script id="lx-sc-early">[\s\S]*?<\/script>/g,'')
         .replace(/<script id="lx-sc-wire">[\s\S]*?<\/script>/g,'')
         .replace(/<script id="lx-tabfix">[\s\S]*?<\/script>/g,'');
      // (a) sidebar no-flash
      if(h.indexOf('<aside class="nx-side">')>=0){
        const ai=h.indexOf('</aside>', h.indexOf('<aside class="nx-side">'));
        if(ai>=0){ h=h.slice(0,ai+8)+EARLY+h.slice(ai+8); s1++; }
        const bi=h.lastIndexOf('</body>'); if(bi>=0) h=h.slice(0,bi)+WIRE+h.slice(bi);
      }
      // (b) bulletproof tab switch on pages with the pools tabs
      if(h.indexOf('id="poolTabs"')>=0){
        const hi=h.indexOf('</head>'); if(hi>=0){ h=h.slice(0,hi)+TABFIX+h.slice(hi); s2++; }
      }
      if(h!==before) json[k]=h;
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('sidebar no-flash on '+s1+' pages; bulletproof tab switch on '+s2+' pages');
