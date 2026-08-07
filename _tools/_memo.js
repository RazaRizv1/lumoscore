// "Memo" (send popup) is a Hedera/XRPL/Stellar concept, not EVM/Move chains. Remove the Memo field
// from the wallet Send popup on chains where it doesn't apply (Aptos, Starknet, VeChain, World Chain).
// Hedera keeps it.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

function removeMemoField(h){
  let out=h, removed=0;
  while(true){
    const lbl=out.indexOf('<div class="field-label">Memo ');
    if(lbl<0) break;
    // the enclosing <div class="field"> is the nearest one before the label
    const open=out.lastIndexOf('<div class="field">', lbl);
    if(open<0) break;
    // depth-match to its </div>
    let j=out.indexOf('>', open)+1, d=1;
    while(d>0){ const a=out.indexOf('<div', j), c=out.indexOf('</div>', j); if(c<0) break; if(a>=0&&a<c){d++;j=a+4;}else{d--;j=c+6;} }
    out=out.slice(0, open)+out.slice(j); removed++;
    if(removed>4) break;
  }
  return { out, removed };
}

let total=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){   // all chains — user wants it gone
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k];
      if(h.indexOf('<div class="field-label">Memo ')<0) continue;
      const r=removeMemoField(h);
      if(r.removed){ json[k]=r.out; total+=r.removed; }
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('removed '+total+' memo fields (aptos/starknet/vechain/worldchain)');
