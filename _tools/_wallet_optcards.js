// Signin connect flow uses static .opt-card wallet buttons with per-wallet inline SVG icons
// (some generic/wrong). Replace each icon with a clean lettermark on the wallet's brand color.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const COLORS={hashpack:'#8259ef',kabila:'#16c79a',blade:'#111827',metamask:'#f6851b',argent:'#ff875b',braavos:'#f4923d',
  petra:'#2ed3b7',martian:'#6b4df6',pontem:'#0ea5e9',veworld:'#4a5bdb',sync2:'#16c79a','coinbase':'#2563eb','coinbasewallet':'#2563eb',
  rainbow:'#8b5cf6',walletconnect:'#3b99fc',freighter:'#8b5cf6',xbull:'#a855f7',rabet:'#1f2937',albedo:'#0ea5e9',lobstr:'#fb7185',
  gem:'#22c55e',gemwallet:'#22c55e',xaman:'#2563eb',joey:'#ec4899',crossmark:'#f59e0b'};
function keyOf(name){ return name.toLowerCase().replace(/[^a-z0-9]/g,''); }
function darker(hex){ // simple darken for gradient end
  var n=parseInt(hex.slice(1),16),r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  r=Math.round(r*.6);g=Math.round(g*.6);b=Math.round(b*.6);
  return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}
function grad(name){ var c=COLORS[keyOf(name)]||'#6b7280'; return 'linear-gradient(135deg,'+c+' 0%,'+darker(c)+' 100%)'; }

const STYLE='<style id="lx-wlf-css">.opt-card .oc-ico .lx-wlf{width:100%;height:100%;border-radius:inherit;display:flex;align-items:center;justify-content:center;font:800 18px/1 "Hanken Grotesk",system-ui,sans-serif;color:#fff;letter-spacing:-.02em}.opt-card .oc-ico{overflow:hidden}</style>';

let cards=0, pages=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k];
      if(h.indexOf('class="opt-card"')<0) continue;
      const before=h;
      h=h.replace(/<span class="oc-ico"([^>]*)>[\s\S]*?<\/span>(\s*<span class="oc-nm">([^<]+)<\/span>)/g,
        function(m, attrs, tail, name){
          cards++;
          return '<span class="oc-ico"'+attrs+'><span class="lx-wlf" style="background:'+grad(name)+'">'+name.trim().charAt(0).toUpperCase()+'</span></span>'+tail;
        });
      if(h!==before){
        if(h.indexOf('id="lx-wlf-css"')<0){ const bi=h.lastIndexOf('</body>'); if(bi>=0) h=h.slice(0,bi)+STYLE+h.slice(bi); }
        json[k]=h; pages++;
      }
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('opt-card lettermark icons: '+cards+' cards on '+pages+' pages');
