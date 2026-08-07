// REVERTED: previously routed the dashboard "Swap tokens"/"Add liquidity" quick-actions to the Trade/Pools
// pages. The user wants the POPUPS kept (and fixed in place), not replaced with a page link — so this
// transform now only REMOVES the old routing script it injected. Popup fixes live in _dashpops.js.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);
let n=0;
for(const dev of ['desktop','mobile']){
  const file=`lumoscore-aptos-${dev}.html`;
  let data; try{ data=read(file); }catch(e){ continue; }
  const {json,s,e}=getContents(data);
  let changed=false;
  for(const k of Object.keys(json)){
    const h=json[k]; if(h.indexOf('lx-dashqa')<0) continue;
    const nh=h.replace(/<script id="lx-dashqa">[\s\S]*?<\/script>/,'');
    if(nh!==h){ json[k]=nh; changed=true; n++; }
  }
  if(changed){ const serialized=JSON.stringify(json).split('</').join('<'+B+'/'); fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8'); }
}
console.log('dashboard quick-action routing REMOVED from '+n+' page keys (popups restored)');
