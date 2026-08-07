// Search popup fixes across ALL pages (landing + in-app), all showcase files.
//  #1 "Assets" heading + list stay empty until the user types (results-only heading).
//  #6 hide the mislabeled duplicate network filter pills (in-app single-network).
//  #7 in-app parity: empty-until-typing, no cross-network filter UI.
// Non-invasive: a small controller keyed off the existing #sp* ids; does not touch page render internals.
// Idempotent: keyed on <style id="lx-searchfix"> / <script id="lx-searchctl">.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const STYLE='<style id="lx-searchfix">#searchPopup #spFilters,.sp-body #spFilters{display:none !important}</style>';
const SCRIPT='<script id="lx-searchctl">(function(){'
+'function head(){var c=document.getElementById("spAssetCount");return c&&c.closest?c.closest(".sp-section-head"):null;}'
+'function ctl(){var inp=document.getElementById("spSearchInput");if(!inp)return;var list=document.getElementById("spAssetList");'
+'var empty=!(inp.value&&inp.value.trim());if(empty&&list&&list.children.length)list.innerHTML="";'
+'var h=head();if(h)h.style.display=(empty||!list||!list.children.length)?"none":"";}'
+'document.addEventListener("input",function(e){if(e.target&&e.target.id==="spSearchInput"){ctl();if(window.requestAnimationFrame)requestAnimationFrame(ctl);}},true);'
+'document.addEventListener("focusin",function(e){if(e.target&&e.target.id==="spSearchInput"){setTimeout(ctl,30);}},true);'
+'var mo=null;function attach(){var list=document.getElementById("spAssetList");if(list&&!mo&&window.MutationObserver){mo=new MutationObserver(ctl);mo.observe(list,{childList:true});}ctl();}'
+'if(document.readyState!=="loading")attach();else document.addEventListener("DOMContentLoaded",attach);'
+'})();</script>';

let files=0,pages=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k];
      if(h.indexOf('id="spSearchInput"')<0) continue; // only pages with the search popup
      h=h.replace(/<style id="lx-searchfix">[\s\S]*?<\/style>/g,'').replace(/<script id="lx-searchctl">[\s\S]*?<\/script>/g,'');
      const bi=h.lastIndexOf('</body>');
      const inject=STYLE+SCRIPT;
      h=bi>=0?h.slice(0,bi)+inject+h.slice(bi):h+inject;
      json[k]=h; pages++;
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
    files++;
  }
}
console.log(`search fixes applied: ${files} files, ${pages} pages with search`);
