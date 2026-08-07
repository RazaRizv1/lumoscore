// #1 Persist the sidebar collapsed/expanded state across navigation (localStorage 'lumos.side').
// The site toggles .nx-collapsed but never saves it, so every new page resets to expanded.
// Restores early (transition suppressed to avoid a collapse flash) and saves on each toggle.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const SCRIPT='<script id="lx-sidestate">(function(){'
+'function side(){return document.querySelector(".nx-side");}'
+'function apply(){var s=side();if(!s)return;try{if(localStorage.getItem("lumos.side")==="1"&&!s.classList.contains("nx-collapsed")){var t=s.style.transition;s.style.transition="none";s.classList.add("nx-collapsed");if(window.requestAnimationFrame)requestAnimationFrame(function(){s.style.transition=t;});else s.style.transition=t;}}catch(e){}}'
+'function wire(){var s=side();if(!s)return;var btn=s.querySelector(".nx-collapse");if(btn&&!btn.__lxSide){btn.__lxSide=1;btn.addEventListener("click",function(){setTimeout(function(){try{localStorage.setItem("lumos.side",s.classList.contains("nx-collapsed")?"1":"0");}catch(e){}},0);});}}'
+'apply();'
+'if(document.readyState!=="loading"){apply();wire();}else document.addEventListener("DOMContentLoaded",function(){apply();wire();});'
+'})();</script>';

let n=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k];
      if(h.indexOf('class="nx-side"')<0 && h.indexOf('nx-side ')<0 && h.indexOf('nx-side"')<0) continue;
      if(h.indexOf('id="lx-sidestate"')>=0) continue;
      const bi=h.lastIndexOf('</body>');
      if(bi<0) continue;
      json[k]=h.slice(0,bi)+SCRIPT+h.slice(bi); n++;
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('sidebar-state persistence added to '+n+' pages');
