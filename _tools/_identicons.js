// #14/#33 Use address-deterministic identicons for wallet avatars on the Pools pages
//  (transactions "Wallet" column + Participants list), matching the Trades recent-tx identicons.
// Static tx rows -> identicon pre-rendered at build time from the adjacent address.
// Participants list (client IIFE) -> global lxIdent() injected + avatar line rewritten.
// Idempotent: static chips lose their letter/gradient; IIFE line + <script id="lx-identfn"> are exact-match.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

// exact port of makeIdenticon() from the Trades asset page
function identicon(addr, size){
  size=size||28;
  var palette=['#6f5ded','#ef4444','#22c55e','#a855f7','#06b6d4','#f59e0b','#ec4899','#84cc16','#ff894c','#0ea5e9','#14b8a6','#facc15'];
  var h=0; for(var i=0;i<addr.length;i++){ h=((h<<5)-h)+addr.charCodeAt(i); h|=0; }
  function pick(i){ return palette[Math.abs((h>>(i*3))%palette.length)]; }
  var c1=pick(0),c2=pick(2),c3=pick(4),c4=pick(6);
  var cell=size/5;
  var svg='<svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'" style="border-radius:50%; background:'+c1+';" xmlns="http://www.w3.org/2000/svg">';
  for(var y=0;y<5;y++){ for(var x=0;x<3;x++){ var bit=(h>>((y*3+x)%30))&1; if(bit){ var color=(x+y)%2===0?c2:c3;
    svg+='<rect x="'+(x*cell).toFixed(2)+'" y="'+(y*cell).toFixed(2)+'" width="'+cell.toFixed(2)+'" height="'+cell.toFixed(2)+'" fill="'+color+'"/>';
    if(x<2){ svg+='<rect x="'+((4-x)*cell).toFixed(2)+'" y="'+(y*cell).toFixed(2)+'" width="'+cell.toFixed(2)+'" height="'+cell.toFixed(2)+'" fill="'+color+'"/>'; } } } }
  svg+='<circle cx="'+(size/2)+'" cy="'+(size/2)+'" r="'+(cell*0.42).toFixed(2)+'" fill="'+c4+'"/></svg>';
  return svg;
}

// client-side copy for the participants IIFE
const IDENTFN='<script id="lx-identfn">window.lxIdent=function(addr,size){size=size||28;var palette=["#6f5ded","#ef4444","#22c55e","#a855f7","#06b6d4","#f59e0b","#ec4899","#84cc16","#ff894c","#0ea5e9","#14b8a6","#facc15"];var h=0;for(var i=0;i<addr.length;i++){h=((h<<5)-h)+addr.charCodeAt(i);h|=0;}function pick(i){return palette[Math.abs((h>>(i*3))%palette.length)];}var c1=pick(0),c2=pick(2),c3=pick(4),c4=pick(6);var cell=size/5;var svg=\'<svg width="\'+size+\'" height="\'+size+\'" viewBox="0 0 \'+size+" "+size+\'" style="border-radius:50%;background:\'+c1+\';" xmlns="http://www.w3.org/2000/svg">\';for(var y=0;y<5;y++){for(var x=0;x<3;x++){var bit=(h>>((y*3+x)%30))&1;if(bit){var color=(x+y)%2===0?c2:c3;svg+=\'<rect x="\'+(x*cell).toFixed(2)+\'" y="\'+(y*cell).toFixed(2)+\'" width="\'+cell.toFixed(2)+\'" height="\'+cell.toFixed(2)+\'" fill="\'+color+\'"/>\';if(x<2){svg+=\'<rect x="\'+((4-x)*cell).toFixed(2)+\'" y="\'+(y*cell).toFixed(2)+\'" width="\'+cell.toFixed(2)+\'" height="\'+cell.toFixed(2)+\'" fill="\'+color+\'"/>\';}}}}svg+=\'<circle cx="\'+(size/2)+\'" cy="\'+(size/2)+\'" r="\'+(cell*0.42).toFixed(2)+\'" fill="\'+c4+\'"/></svg>\';return svg;};</script>';

const PART_OLD="'<div class=\"part-avatar\" style=\"background:' + p.color + '\">' + p.a + '</div>'";
const PART_NEW="'<div class=\"part-avatar\">' + window.lxIdent(p.addr, 26) + '</div>'";

let stats={walletRows:0, partLists:0, pages:0};
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k];
      const hasWallet=h.indexOf('class="wallet-avatar"')>=0;
      const hasPart=h.indexOf(PART_OLD)>=0;
      if(!hasWallet && !hasPart) continue;
      let touched=false;
      // static tx wallet rows -> build-time identicon from the adjacent address
      h=h.replace(/<div class="wallet-avatar"[^>]*>[^<]*<\/div>([^<]*)<\/div>/g, function(m, tail){
        const addr=tail.trim(); if(!addr) return m;
        stats.walletRows++; touched=true;
        return '<div class="wallet-avatar">'+identicon(addr,22)+'</div>'+tail+'</div>';
      });
      // participants IIFE
      if(hasPart){
        h=h.split(PART_OLD).join(PART_NEW);
        if(h.indexOf('id="lx-identfn"')<0){ const bi=h.lastIndexOf('</body>'); h=bi>=0?h.slice(0,bi)+IDENTFN+h.slice(bi):h+IDENTFN; }
        stats.partLists++; touched=true;
      }
      if(touched){ json[k]=h; stats.pages++; }
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('identicons:', JSON.stringify(stats));
