// Dashboard "Explore products" icons -> match the LANDING page's per-product colored gradients
// (Trade=blue, AMM=green, Bridge=purple, Rewards=yellow, Wallet=pink; white icons). Replaces the
// peach/ember uniform chips. Removes the earlier lx-chipmatch peach override.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const STYLE='<style id="lx-explore-color">'
+'a.pc .pc-ic{border:none !important;box-shadow:0 8px 18px -8px rgba(0,0,0,.4) !important}'
+'a.pc[href*="dex"] .pc-ic{background:linear-gradient(135deg,var(--blue),#1e40af) !important}'
+'a.pc[href*="amm"] .pc-ic{background:linear-gradient(135deg,var(--green),#16a34a) !important}'
+'a.pc[href*="bridge"] .pc-ic{background:linear-gradient(135deg,var(--purple),#6d28d9) !important}'
+'a.pc[href*="rewards"] .pc-ic{background:linear-gradient(135deg,var(--yellow),#ff894c) !important}'
+'a.pc[href*="wallet"] .pc-ic{background:linear-gradient(135deg,var(--pink),#be185d) !important}'
+'a.pc[href*="launch"] .pc-ic{background:linear-gradient(135deg,var(--accent),#c63f00) !important}'
+'a.pc .pc-ic,a.pc .pc-ic svg{color:#fff !important;stroke:#fff !important}'
+'</style>';

let n=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k];
      if(h.indexOf('<a class="pc" href="')<0) continue;
      h=h.replace(/<style id="lx-chipmatch">[\s\S]*?<\/style>/g,'').replace(/<style id="lx-explore-color">[\s\S]*?<\/style>/g,'');
      const bi=h.lastIndexOf('</body>'); if(bi<0) continue;
      json[k]=h.slice(0,bi)+STYLE+h.slice(bi); n++;
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('explore-product colored icons on '+n+' pages');
