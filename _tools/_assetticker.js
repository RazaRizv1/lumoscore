// Trade-Asset (dex-asset) page: the empty `.asset-ticker` span next to the <h1> asset name got a tiny
// token-logo painted onto it by the LOGOS applier (data-logo + inline background) — an ugly 20x8 sliver.
// It carries no text, so just hide it. Scoped to the asset-name row. Idempotent.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const STYLE='<style id="lx-hidetick">.asset-name-row .asset-ticker{display:none !important}</style>';

let n=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k];
      if(h.indexOf('asset-name-row')<0 || h.indexOf('asset-ticker')<0) continue;
      if(h.indexOf('id="lx-hidetick"')>=0) continue;
      const bi=h.lastIndexOf('</body>'); if(bi<0) continue;
      json[k]=h.slice(0,bi)+STYLE+h.slice(bi); n++;
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('hid the tiny .asset-ticker logo on '+n+' pages');
