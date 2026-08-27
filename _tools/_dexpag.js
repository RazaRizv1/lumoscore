// THIS TRANSFORM NOW ONLY REMOVES ITSELF. Do not re-enable the injection.
//
// It used to paginate the Trade-asset tab lists by MATERIALISING a 137-row set: `MAT=137`, and the rows
// were manufactured by cloning the design's template rows (`kids[j%kids.length].cloneNode(true)`). That
// was a reasonable trick over a mock page and became a liability the moment the lists held real data.
//
// Every tab it targeted has since been taken over by a layer with real data and its own paginator:
// Discussions was removed from the page, Holders and Pools were already excluded by its own guard, and
// Exchanges is owned by _dexassetdata.js -- which paginates the REAL filtered set and renders its control
// into .panel-foot .pgn. So nothing was left for this to do except be wrong.
//
// What the user actually saw (reported twice, and it survived two fixes aimed at the wrong element):
// under a "10K+ XLM" filter holding two real trades, the page read "Showing 1-50 of 137" and
// "Page 1 of 3". Those numbers were not a miscount -- 137 IS `MAT`, and 3 is ceil(137/50). This script
// built its footer into `.lx-pag-foot`, a container the newer layer neither writes nor knows about, so
// re-asserting `.panel-foot` on every render (the previous fix) could never displace it. It also hid the
// real footer outright with `.panel-foot{display:none !important}`.
//
// This is DEV landmine 11 exactly: a dead transform keeps running from the gitignored container, and the
// prescription there is what is applied here -- turn it into an idempotent stripper rather than trying to
// out-run it, because hiding or out-ordering a script that has already executed does nothing.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const STYLE='<style id="lx-dexpag-css">'
+'.lx-pag-foot{display:flex;align-items:center;justify-content:space-between;padding:13px 4px 2px;margin-top:6px;border-top:1px solid var(--border);font-size:13px;color:var(--text-soft);flex-wrap:wrap;gap:10px}'
+'.lx-pag-foot .pc{display:flex;align-items:center;gap:0}'
+'.lx-pag-foot button{background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:6px 13px;font-size:13px;font-weight:600;color:var(--text);cursor:pointer}'
+'.lx-pag-foot button:hover:not(:disabled){border-color:var(--accent-soft)}'
+'.lx-pag-foot button:disabled{opacity:.4;cursor:default}'
+'.lx-pag-foot .pmid{margin:0 12px}'
+'.panel-foot{display:none !important}'   // hide the decorative (non-functional) native pagination — keep only ours
+'</style>';

const SCRIPT='<script id="lx-dexpag">(function(){'
+'var PER=50,MAT=137,cur=null;'
+'function num(s){var m=(s||"").replace(/,/g,"").match(/(\\d+)/);return m?parseInt(m[1],10):0;}'
+'function activeTab(){var t=document.querySelector("[data-tab].active");if(t)return t;var all=document.querySelectorAll("[data-tab]");for(var i=0;i<all.length;i++){if((all[i].className||"").indexOf("active")>=0)return all[i];}return null;}'
+'function activeList(){var best=null;document.querySelectorAll("tbody").forEach(function(el){if(el.offsetParent===null)return;if(el.closest(".mypos-section"))return;if(el.children.length<3)return;if(!best||el.children.length>best.children.length)best=el;});return best;}'
+'function render(){var c=cur;if(!c)return;var start=(c.page-1)*PER,end=Math.min(start+PER,c.mat);'
+'while(c.list.firstChild)c.list.removeChild(c.list.firstChild);for(var i=start;i<end;i++)c.list.appendChild(c.pool[i]);'
+'while(c.foot.firstChild)c.foot.removeChild(c.foot.firstChild);'
+'var info=document.createElement("span");info.textContent="Showing "+(start+1)+"\\u2013"+end+" of "+c.mat.toLocaleString();'
+'var pc=document.createElement("span");pc.className="pc";'
+'var prev=document.createElement("button");prev.textContent="\\u2039 Prev";prev.disabled=c.page<=1;prev.onclick=function(){c.page--;render();};'
+'var mid=document.createElement("span");mid.className="pmid";mid.textContent="Page "+c.page+" of "+c.pages;'
+'var next=document.createElement("button");next.textContent="Next \\u203a";next.disabled=c.page>=c.pages;next.onclick=function(){c.page++;render();};'
+'pc.appendChild(prev);pc.appendChild(mid);pc.appendChild(next);c.foot.appendChild(info);c.foot.appendChild(pc);}'
+'function apply(){'
+'var foots=document.querySelectorAll(".lx-pag-foot");for(var i=0;i<foots.length;i++)foots[i].remove();cur=null;'
+'var t=activeTab();var total=t?num(t.textContent):0;'
+'if(t&&/^(holders|pools)$/.test((t.getAttribute("data-tab")||"").toLowerCase()))return;'
// Holders has its own native pagination (.dxa-hl-pgn). Pools is now REAL data with a real paginator in
// _dexassetdata.js, and this one must never touch it: MAT materialises rows by CLONING the template
// (kids[j%kids.length]), which was harmless over a mock list but, once the tab count read 59 against 20
// real rows, padded the table to 137 rows of duplicated pools — fabricated liquidity on a live page.
+'if(total<=PER)return;'                       // small lists (Discussions 18, Pools 7): no pagination
+'var list=activeList();if(!list)return;'
+'var kids=Array.prototype.slice.call(list.children);if(kids.length<3)return;'
+'var pool=[];for(var j=0;j<MAT;j++)pool.push(kids[j%kids.length].cloneNode(true));'
+'var host=list.closest("table")?list.closest("table").parentNode:list.parentNode;'
+'var foot=document.createElement("div");foot.className="lx-pag-foot";host.appendChild(foot);'
+'cur={list:list,pool:pool,foot:foot,mat:MAT,pages:Math.ceil(MAT/PER),page:1};render();}'
+'function schedule(){setTimeout(apply,150);}'
+'document.addEventListener("click",function(e){if(e.target&&e.target.closest&&e.target.closest("[data-tab]"))schedule();},false);'
+'if(document.readyState!=="loading")schedule();else document.addEventListener("DOMContentLoaded",schedule);'
+'})();</script>';

let n=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k];
      if(h.indexOf('data-tab="exchanges"')<0 && h.indexOf('id="dxaExTable"')<0) continue;
      const was=h;
      h=h.replace(/<style id="lx-dexpag-css">[\s\S]*?<\/style>/g,'').replace(/<script id="lx-dexpag">[\s\S]*?<\/script>/g,'');
      // STRIP ONLY. Nothing is re-injected -- see the header for why this transform is now a remover.
      if(h!==was){ json[k]=h; n++; }
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('dex-asset pagination on '+n+' pages');
