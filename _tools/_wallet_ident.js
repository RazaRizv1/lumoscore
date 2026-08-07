// #38 Wallet page: replace the connected-wallet chip's initials avatar (<div class="av">RR</div>)
// with an address-deterministic identicon (same generator as the Pools/Trades wallet avatars).
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

function identicon(addr, size){
  size=size||40;
  var palette=['#6f5ded','#ef4444','#22c55e','#a855f7','#06b6d4','#f59e0b','#ec4899','#84cc16','#ff894c','#0ea5e9','#14b8a6','#facc15'];
  var h=0; for(var i=0;i<addr.length;i++){ h=((h<<5)-h)+addr.charCodeAt(i); h|=0; }
  function pick(i){ return palette[Math.abs((h>>(i*3))%palette.length)]; }
  var c1=pick(0),c2=pick(2),c3=pick(4),c4=pick(6),cell=size/5;
  var svg='<svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'" style="border-radius:inherit;background:'+c1+';" xmlns="http://www.w3.org/2000/svg">';
  for(var y=0;y<5;y++){ for(var x=0;x<3;x++){ var bit=(h>>((y*3+x)%30))&1; if(bit){ var color=(x+y)%2===0?c2:c3;
    svg+='<rect x="'+(x*cell).toFixed(2)+'" y="'+(y*cell).toFixed(2)+'" width="'+cell.toFixed(2)+'" height="'+cell.toFixed(2)+'" fill="'+color+'"/>';
    if(x<2){ svg+='<rect x="'+((4-x)*cell).toFixed(2)+'" y="'+(y*cell).toFixed(2)+'" width="'+cell.toFixed(2)+'" height="'+cell.toFixed(2)+'" fill="'+color+'"/>'; } } } }
  svg+='<circle cx="'+(size/2)+'" cy="'+(size/2)+'" r="'+(cell*0.42).toFixed(2)+'" fill="'+c4+'"/></svg>';
  return svg;
}
const STYLE='<style id="lx-walletident">.wallet-chip .av{background:transparent !important;padding:0 !important;overflow:hidden;display:grid;place-items:center}.wallet-chip .av svg{width:100%;height:100%}</style>';

let n=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k];
      if(h.indexOf('<div class="wallet-chip">')<0 || h.indexOf('<div class="av">')<0) continue;
      const before=h;
      h=h.replace(/<div class="av">[A-Z0-9]{1,3}<\/div>(?=[\s\S]{0,500}?data-copy="([^"]+)")/g, function(m, addr){
        return '<div class="av">'+identicon(addr,40)+'</div>';
      });
      if(h.indexOf('id="lx-walletident"')<0){ const bi=h.lastIndexOf('</body>'); if(bi>=0) h=h.slice(0,bi)+STYLE+h.slice(bi); }
      if(h!==before){ json[k]=h; n++; }
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('wallet identicon applied on '+n+' pages');
