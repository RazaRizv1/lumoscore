// Pools "Pool" page: real client-side pagination for the transactions table — 50 per page,
// tab filter (All/Swaps/Deposits/Withdrawals), working Prev/Next, honest "Showing X-Y of N".
// Builds a believable transaction set by cloning the existing row templates (keeps identicons).
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const SCRIPT='<script id="lx-txpage">(function(){'
+'function boot(){'
+'var table=document.querySelector("table.tx");if(!table)return;var tbody=table.querySelector("tbody");if(!tbody)return;'
+'var foot=document.querySelector(".tx-foot");'
+'var templates=Array.prototype.slice.call(tbody.querySelectorAll("tr"));if(!templates.length)return;'
+'var PER=50,TOTAL=137;var pool=[];for(var i=0;i<TOTAL;i++){pool.push(templates[i%templates.length].cloneNode(true));}'
+'var tabBtns=Array.prototype.slice.call(document.querySelectorAll("button")).filter(function(b){return /^(All|Swaps|Deposits|Withdrawals)$/.test((b.textContent||"").trim());});'
+'var filter="all",page=1;'
+'function tkey(tr){var p=tr.querySelector(".type-pill");return p?(p.textContent||"").trim().toLowerCase():"";}'
+'function match(tr){if(filter==="all")return true;var t=tkey(tr);if(filter==="swaps")return t.indexOf("swap")>=0;if(filter==="deposits")return t.indexOf("deposit")>=0;if(filter==="withdrawals")return t.indexOf("withdraw")>=0;return true;}'
+'function render(){var list=pool.filter(match);var total=list.length;var pages=Math.max(1,Math.ceil(total/PER));if(page>pages)page=pages;if(page<1)page=1;'
+'var start=(page-1)*PER,end=Math.min(start+PER,total);while(tbody.firstChild)tbody.removeChild(tbody.firstChild);for(var i=start;i<end;i++)tbody.appendChild(list[i]);'
+'if(foot){var info=foot.querySelector("div");if(info)info.textContent="Showing "+(total?start+1:0)+"\\u2013"+end+" of "+total.toLocaleString()+" transactions";'
+'var ctrls=foot.querySelector(".controls");if(ctrls){while(ctrls.firstChild)ctrls.removeChild(ctrls.firstChild);'
+'var prev=document.createElement("button");prev.textContent="\\u2039 Prev";prev.disabled=page<=1;prev.onclick=function(){page--;render();};'
+'var mid=document.createElement("span");mid.style.cssText="margin:0 12px;color:var(--text-soft);font-size:13px";mid.textContent="Page "+page+" of "+pages;'
+'var next=document.createElement("button");next.textContent="Next \\u203a";next.disabled=page>=pages;next.onclick=function(){page++;render();};'
+'ctrls.appendChild(prev);ctrls.appendChild(mid);ctrls.appendChild(next);}}}'
+'tabBtns.forEach(function(b){b.addEventListener("click",function(){tabBtns.forEach(function(x){x.classList.toggle("active",x===b);});filter=(b.textContent||"").trim().toLowerCase();page=1;render();});});'
+'render();'
+'}'
+'if(document.readyState!=="loading")boot();else document.addEventListener("DOMContentLoaded",boot);'
+'})();</script>';

let n=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k];
      if(h.indexOf('class="tx-foot"')<0 || h.indexOf('<table class="tx">')<0) continue;
      if(h.indexOf('id="lx-txpage"')>=0) continue;
      const bi=h.lastIndexOf('</body>'); if(bi<0) continue;
      json[k]=h.slice(0,bi)+SCRIPT+h.slice(bi); n++;
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('tx pagination on '+n+' pages');
