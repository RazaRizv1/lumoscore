// AUDIT (user-reported): the "Total Reactions" widget on the trade-asset page lost its count on refresh.
//
// The design ships it as pure decoration: the click handler bumps the number in the DOM, guards against a
// second tap with an in-memory `btn.dataset.tapped`, and stores nothing. Reload and the markup's baked
// numbers come back. Two separate problems in that:
//   1. no persistence — the tap never survives a refresh, which is what was reported;
//   2. the markup bakes "2" on the rocket. That is a fabricated count. Everything else on this page was
//      moved off invented numbers, so this is held to the same rule: a reaction count starts at 0 and only
//      moves because someone actually pressed the button.
//
// LumosCore is a static site with no backend, so the ONLY reactions that can honestly be counted are the
// ones made in this browser. State is kept per asset (a reaction on AQUA must not show up on DWARF) under
// localStorage["lumos.reactions"], and a second tap now removes the reaction instead of doing nothing —
// the design's one-way `tapped` flag made a mis-tap permanent for the session.
//
// If real cross-user totals are wanted later, this is the seam: replace read()/write() with a backend call
// and delete nothing else.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const SCRIPT='<script id="lx-reactions">(function(){'
+'var KEY="lumos.reactions";'
+'function assetKey(){ try{ var p=(window.__lxRoute&&window.__lxRoute.asset)||new URLSearchParams(location.search).get("asset")||""; return p||"_"; }catch(e){ return "_"; } }'
+'function readAll(){ try{ return JSON.parse(localStorage.getItem(KEY)||"{}")||{}; }catch(e){ return {}; } }'
+'function writeAll(o){ try{ localStorage.setItem(KEY,JSON.stringify(o)); }catch(e){} }'
+'function mine(){ var a=readAll()[assetKey()]; return (a&&a.length)?a:[]; }'
+'function setMine(list){ var all=readAll(); if(list.length)all[assetKey()]=list; else delete all[assetKey()]; writeAll(all); }'
+'function btns(){ return [].slice.call(document.querySelectorAll(".dxa-react-btn,.mdxa-react-btn")); }'
+'function paint(){ var m=mine(); btns().forEach(function(b,i){'
+'  var n=b.querySelector(".num"); if(n){ var on=m.indexOf(i)>=0; var v=on?1:0; if(n.textContent!==String(v))n.textContent=String(v); }'
+'  b.classList.toggle("lx-reacted",m.indexOf(i)>=0); b.setAttribute("aria-pressed",m.indexOf(i)>=0?"true":"false"); }); }'
// capture phase + stopImmediatePropagation: the design has its own listener on these buttons that bumps
// the DOM number and sets a one-way `tapped` flag. Let it run and the two disagree, so it never runs.
+'document.addEventListener("click",function(e){'
+'  var b=e.target&&e.target.closest&&e.target.closest(".dxa-react-btn,.mdxa-react-btn"); if(!b)return;'
+'  var list=btns(), i=list.indexOf(b); if(i<0)return;'
+'  e.preventDefault(); e.stopImmediatePropagation();'
+'  var m=mine(), at=m.indexOf(i);'
+'  if(at>=0)m.splice(at,1); else m.push(i);'
+'  setMine(m); paint();'
+'},true);'
+'function boot(){ if(!document.querySelector(".dxa-react-btn,.mdxa-react-btn"))return; paint();'
+'  try{ new MutationObserver(function(){ paint(); }).observe(document.body,{childList:true,subtree:true}); }catch(e){} }'
+'if(document.readyState!=="loading")boot(); else document.addEventListener("DOMContentLoaded",boot);'
+'})();</'+'script>';

const CSS='<style id="lx-reactions-css">.dxa-react-btn,.mdxa-react-btn{position:relative}'
+'.dxa-react-btn.lx-reacted,.mdxa-react-btn.lx-reacted{border-color:var(--accent,#ea6a2c)!important;background:color-mix(in srgb,var(--accent,#ea6a2c) 12%,transparent)}'
+'.dxa-react-btn.lx-reacted .num,.mdxa-react-btn.lx-reacted .num{color:var(--accent,#ea6a2c);font-weight:800}</style>';

let n=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain','stellar','xrpl']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    let changed=false;
    for(const k of Object.keys(json)){
      let h=json[k];
      if(h.indexOf('dxa-react-btn')<0 && h.indexOf('mdxa-react-btn')<0) continue;   // mobile names it mdxa-react-btn                                  // widget not on this page
      h=h.replace(/<script id="lx-reactions">[\s\S]*?<\/script>/g,'');            // idempotent: strip first
      h=h.replace(/<style id="lx-reactions-css">[\s\S]*?<\/style>/g,'');
      // zero the design's fabricated seed count so the widget only ever shows real taps
      h=h.replace(/(<button class="m?dxa-react-btn">(?:(?!<\/button>)[\s\S])*?<span class="num">)[^<]*(<\/span>)/g,'$1'+'0'+'$2');
      const bi=h.lastIndexOf('</body>'); if(bi<0) continue;
      json[k]=h.slice(0,bi)+CSS+SCRIPT+h.slice(bi); changed=true; n++;
    }
    if(changed){ const serialized=JSON.stringify(json).split('</').join('<'+B+'/'); fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8'); }
  }
}
console.log('reactions: persisted per-asset (localStorage) + seed counts zeroed on '+n+' page keys');
