// Trade-Asset (dex-asset) page layout: remove the LUMOS fee-tier upsell card (.lx-feetier) from the trade
// column. (User reverted the earlier "move Price change to a top strip + grow the fee-tier card" reorg — so
// Price change stays in the right/trade column exactly where the design places it, and the "Hold 250,000
// LUMOS…" box is removed so the trade column no longer overshoots the chart height.)
// Idempotent (keyed on style id). Also strips any previously-injected reorg script.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const STYLE='<style id="lx-dexlayout-css">'
+'.lx-feetier{display:none !important}'
+'</style>';

let n=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k];
      if(h.indexOf('dxa-grid')<0) continue;
      // strip the old css + the old reorg script (from the earlier top-strip version), then inject just the hide-CSS
      h=h.replace(/<style id="lx-dexlayout-css">[\s\S]*?<\/style>/g,'').replace(/<script id="lx-dexlayout">[\s\S]*?<\/script>/g,'');
      const bi=h.lastIndexOf('</body>'); if(bi<0) continue;
      json[k]=h.slice(0,bi)+STYLE+h.slice(bi); n++;
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('dex-asset: fee-tier card hidden + top-strip reorg removed on '+n+' pages');
