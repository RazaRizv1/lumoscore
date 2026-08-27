// THIS TRANSFORM NOW ONLY REMOVES ITSELF. Do not re-enable the injection.
//
// It paginated the Participants list by FABRICATING it: TOTAL was hardcoded to 847, every row past the
// real ones was cloned from a template, and their wallet addresses were generated arithmetically by
// addrFor(). Invented accounts, shown as this pool's liquidity providers, with a share percentage made up
// from a decaying formula.
//
// _ammdata has owned this list with real Horizon data for a long time and had to disable this one at
// runtime (#lx-partpage -> display:none) to stop the two fighting. It also still ran an interval polling
// for the list 25 times on every pool page. Now that the real list paginates properly there is nothing
// left for it to do except be wrong -- DEV landmine 11, same as _dexpag: strip it rather than out-run it.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const SCRIPT='<script id="lx-partpage">(function(){'
+'function addrFor(i,isEvm){if(isEvm){var x=(((i*2654435761)>>>0)).toString(16);while(x.length<8)x="0"+x;return "0x"+x.slice(0,4)+"\\u2026"+x.slice(4,8);}return "0.0."+(1000000+((i*748219)%8999999));}'
+'function boot(){'
+'var list=document.getElementById("partList");if(!list)return false;'
+'var real=Array.prototype.slice.call(list.querySelectorAll(".part-row"));if(!real.length)return false;'
+'if(list.__lxPP)return true;list.__lxPP=1;'
+'var card=list.closest(".side-card");if(card){card.style.flex="0 0 auto";card.style.alignSelf="stretch";}list.style.flex="0 0 auto";list.style.maxHeight="none";'
+'var PER=25,TOTAL=847,pages=Math.ceil(TOTAL/PER),page=1;'
+'var isEvm=/^0x/.test(((real[0].querySelector(".wallet")||{}).textContent||"").trim());'
+'var tmpl=real[real.length-1];'
+'function rowAt(i){if(i<real.length)return real[i].cloneNode(true);var c=tmpl.cloneNode(true);var a=addrFor(i,isEvm);var w=c.querySelector(".wallet");if(w)w.textContent=a;var av=c.querySelector(".part-avatar");if(av&&window.lxIdent)av.innerHTML=window.lxIdent(a,26);var sh=Math.max(0.01,0.16-(i-real.length)*0.00017);var shs=sh.toFixed(2);var sc=c.querySelector(".share");if(sc)sc.textContent=shs+"%";var fl=c.querySelector(".fill");if(fl)fl.style.width=Math.max(2,Math.min(100,sh*14))+"%";return c;}'
+'var foot=document.querySelector(".part-foot");var info=foot?foot.querySelector("div"):null;var nav=foot?foot.querySelector(".nav"):null;'
+'var prevSvg=\'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>\';'
+'var nextSvg=\'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>\';'
+'var prevBtn=null,nextBtn=null;'
+'if(nav){while(nav.firstChild)nav.removeChild(nav.firstChild);'
+'prevBtn=document.createElement("button");prevBtn.setAttribute("data-tooltip","Previous");prevBtn.innerHTML=prevSvg;prevBtn.onclick=function(){if(page>1){page--;upd();}};'
+'nextBtn=document.createElement("button");nextBtn.setAttribute("data-tooltip","Next");nextBtn.innerHTML=nextSvg;nextBtn.onclick=function(){if(page<pages){page++;upd();}};'
+'nav.appendChild(prevBtn);nav.appendChild(nextBtn);}'
+'function upd(){var start=(page-1)*PER,end=Math.min(start+PER,TOTAL);while(list.firstChild)list.removeChild(list.firstChild);for(var i=start;i<end;i++)list.appendChild(rowAt(i));if(info)info.textContent="Viewing "+(start+1)+" \\u2013 "+end+" of "+TOTAL.toLocaleString();if(prevBtn)prevBtn.disabled=page<=1;if(nextBtn)nextBtn.disabled=page>=pages;}'
+'upd();return true;}'
+'function run(){var n=0,iv=setInterval(function(){if(boot()||++n>25)clearInterval(iv);},180);}'
+'if(document.readyState!=="loading")run();else document.addEventListener("DOMContentLoaded",run);'
+'})();</script>';

let n=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k];
      if(h.indexOf('"partList"')<0) continue;
      const was=h;
      h=h.replace(/<script id="lx-partfill">[\s\S]*?<\/script>/g,'').replace(/<script id="lx-partpage">[\s\S]*?<\/script>/g,'');
      // STRIP ONLY. Nothing is re-injected -- see the header for why this transform is now a remover.
      if(h!==was){ json[k]=h; n++; }
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('participants 25/page pagination on '+n+' pages');
