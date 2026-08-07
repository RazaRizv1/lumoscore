// #4 (round 2): sync EVERY "Explore products" tile icon to its side-menu canonical, not just the
// three named by example. Replaces each tile's icon inner-SVG (keeps the tile's own sizing) with the
// matching side-menu icon so the same feature uses the same glyph everywhere. Idempotent.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const MAP=[
  ['trade','lumoscore-dex-dark.html'],
  ['pools','lumoscore-amm-dark.html'],
  ['bridge','lumoscore-bridge-dark.html'],
  ['rewards','lumoscore-rewards-dark.html'],
  ['wallet','lumoscore-wallet.html'],
];

function innerAfter(html, marker){
  const i=html.indexOf(marker); if(i<0) return null;
  const s=html.indexOf('<svg', i); if(s<0) return null;
  const gt=html.indexOf('>', s)+1, e=html.indexOf('</svg>', s);
  if(e<0) return null;
  return html.slice(gt, e);
}
function replaceTileIcon(html, href, innerNew){
  const a=html.indexOf('<a class="pc" href="'+href+'"'); if(a<0) return html;
  const s=html.indexOf('<svg', a); if(s<0) return html;
  const gt=html.indexOf('>', s)+1, e=html.indexOf('</svg>', s); if(e<0) return html;
  return html.slice(0, gt)+innerNew+html.slice(e);
}

let fixes=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k];
      if(h.indexOf('<a class="pc" href="')<0) continue; // only pages with the explore grid
      const before=h;
      for(const [id,href] of MAP){
        const canon=innerAfter(h, 'data-id="'+id+'"');
        if(canon) h=replaceTileIcon(h, href, canon);
      }
      if(h!==before){ json[k]=h; fixes++; }
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('explore tile icons synced on '+fixes+' pages');
