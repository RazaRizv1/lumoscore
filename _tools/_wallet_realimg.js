// Wire the REAL wallet logos (user-provided files in assets/wallets/) into the connect flows.
// SCOPED to wallet chips only: the in-app `var I` map (wallet-only) and signin opt-cards that carry
// data-wnet (wallet buttons) — NEVER the network cards (data-net-id). Wallets without a file keep the
// lettermark. Also renames Argent -> Ready.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);const Q=String.fromCharCode(34);

// var-I key -> [fallback letter, file | null]
const IK={freighter:['F','freighter.png'],xbull:['X',null],rabet:['R','rabet.jpg'],albedo:['A','albedo.png'],lobstr:['L','lobstr.png'],
  wc:['W',null],gem:['G','gem.png'],xaman:['X','xaman.png'],joey:['J',null],crossmark:['C','crossmark.webp'],
  hashpack:['H','hashpack.png'],kabila:['K','kabila.png'],blade:['B',null],metamask:['M',null],
  argent:['R','ready.png'],braavos:['B',null],petra:['P',null],martian:['M',null],pontem:['P',null],
  veworld:['V',null],sync2:['S',null],coinbase:['C',null],rainbow:['R',null]};
function iconJS(letter,file){
  let s="'<span class="+Q+"lx-wl"+Q+">"+letter+"</span>";
  if(file) s+="<img class="+Q+"lx-wimg"+Q+" src="+Q+"assets/wallets/"+file+Q+" alt="+Q+Q+" onerror="+Q+"this.remove()"+Q+">";
  return s+"'";
}
const IMAP='var I={'+Object.keys(IK).map(k=>k+':'+iconJS(IK[k][0],IK[k][1])).join(',')+'};';

function slug(n){return n.toLowerCase().replace(/[^a-z0-9]/g,'');}
const NFILE={hashpack:'hashpack.png',kabila:'kabila.png',gemwallet:'gem.png',gem:'gem.png',ready:'ready.png',argent:'ready.png',xaman:'xaman.png',crossmark:'crossmark.webp',rabet:'rabet.jpg'};

const STYLE='<style id="lx-wl-css">/* lx-wico-square: wallet marks are SQUARE app icons whose artwork runs edge to edge. The container was border-radius:50% with object-fit:cover, so a circular mask cut the corners off and the logos read as different, simpler marks at 40px. A rounded square shows the whole artwork. */.lxw-ico{border-radius:12px !important}.lxw-ico .lx-wimg{border-radius:12px !important}.lx-wl{font:800 15px/1 "Hanken Grotesk",system-ui,sans-serif;color:#fff;letter-spacing:-.02em;display:inline-flex;align-items:center;justify-content:center;width:100%;height:100%}.lxw-ico,.opt-card .ico{position:relative;overflow:hidden}.lx-wimg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block}</style>';

let inApp=0, optc=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k]; const before=h;
      if(h.indexOf('var NETS={')>=0 && h.indexOf('renderList(net)')>=0){
        h=h.replace(/var I=\{[\s\S]*?\};/, IMAP);
        h=h.split("id:'Argent',name:'Argent'").join("id:'Ready',name:'Ready'");
        inApp++;
      }
      if(h.indexOf('class="opt-card"')>=0){
        // ONLY wallet buttons (data-wnet) that have a logo file; network cards (data-net-id) untouched
        h=h.replace(/(<button class="opt-card" data-wnet="[^"]*"[^>]*>)<span class="ico"([^>]*)>[\s\S]*?<\/span>(\s*<span class="oc-nm">([^<]+)<\/span>)/g,
          function(m,btn,attrs,tail,name){
            const f=NFILE[slug(name)]; if(!f) return m;
            const l=name.trim().charAt(0).toUpperCase();
            return btn+'<span class="ico"'+attrs+'><span class="lx-wl">'+l+'</span><img class="lx-wimg" src="assets/wallets/'+f+'" alt="" onerror="this.remove()"></span>'+tail;
          });
        h=h.split('>Argent</span>').join('>Ready</span>');
        optc++;
      }
      if(h!==before){
        if(h.indexOf('id="lx-wl-css"')<0){ const bi=h.lastIndexOf('</body>'); if(bi>=0) h=h.slice(0,bi)+STYLE+h.slice(bi); } else { h = h.replace(/<style id="lx-wl-css">[\s\S]*?<\/style>/, function(){ return STYLE; }); }
        json[k]=h;
      }
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('real wallet logos wired: in-app='+inApp+' optcard='+optc);
