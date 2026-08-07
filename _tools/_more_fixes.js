// Round-3 mechanical fixes:
//  #40 Pools list: remove the "Pool Price" column (header + all price cells).
//  #39 In-app search: "Assets" heading -> "Assets on <Network>" (NOT on landing/all-network search).
//  #37 Dashboard Explore-products chips: match the landing chips exactly (drop border, same shadow).
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const CHAIN={aptos:'Aptos',hedera:'Hedera',starknet:'Starknet',vechain:'VeChain',worldchain:'World Chain'};
const PRICE_TH='<th>Pool Price <span class="sort-i">↕</span></th>';
const PRICE_TD_RE=/<td>\s*<div class="num">[^<]*<\/div>\s*<div class="num-sub">[^<]* per [^<]*<\/div>\s*<\/td>/g;
const CHIP_FIX='<style id="lx-chipmatch">.pc-ic,.products-grid .pc .ic-prod{border:none !important;box-shadow:0 6px 16px -8px rgba(224,94,31,.5) !important}</style>';

let stats={price:0, assets:0, chip:0};
for(const c of Object.keys(CHAIN)){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k]; const before=h;
      // #40 pools price column (amm list pages)
      if(h.indexOf(PRICE_TH)>=0){ h=h.split(PRICE_TH).join(''); h=h.replace(PRICE_TD_RE,''); stats.price++; }
      // #39 search heading -> Assets on <Network> (in-app only)
      if(k.indexOf('lumoscore-landing.html')<0 && h.indexOf('<h4>Assets <span class="count" id="spAssetCount">')>=0){
        h=h.split('<h4>Assets <span class="count" id="spAssetCount">').join('<h4>Assets on '+CHAIN[c]+' <span class="count" id="spAssetCount">');
        stats.assets++;
      }
      // #37 explore chip match (home page)
      if(h.indexOf('<a class="pc" href="')>=0 && h.indexOf('id="lx-chipmatch"')<0){
        const bi=h.lastIndexOf('</body>'); if(bi>=0){ h=h.slice(0,bi)+CHIP_FIX+h.slice(bi); stats.chip++; }
      }
      if(h!==before) json[k]=h;
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('more fixes:', JSON.stringify(stats));
