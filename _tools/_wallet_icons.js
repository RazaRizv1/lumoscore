// Connect-popup wallet icons: replace the generic geometric placeholders (triangle for Albedo,
// star for xBull, etc. — the "wrong/missing logos") with clean brand-colored lettermarks on each
// wallet's existing brand gradient. (Official wallet logos are trademarks and should come from each
// wallet's own brand assets/SDK — not hand-reproduced.)
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const LETTERS={freighter:'F',xbull:'X',rabet:'R',albedo:'A',lobstr:'L',wc:'W',gem:'G',xaman:'X',joey:'J',crossmark:'C'};
function span(t){ return "'<span class=\""+"lx-wl\">"+t+"</span>'"; }
const NEWMAP='var I={'+Object.keys(LETTERS).map(k=>k+':'+span(LETTERS[k])).join(',')+'};';
const STYLE='<style id="lx-wlmark">.lx-wl{font:800 15px/1 "Hanken Grotesk",system-ui,sans-serif;color:#fff;letter-spacing:-.02em;display:inline-flex;align-items:center;justify-content:center}.lxw-ico{display:inline-flex;align-items:center;justify-content:center}</style>';

let n=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k];
      if(h.indexOf('var I={')<0 || h.indexOf('icon:I.freighter')<0) continue;
      // replace the whole var I={...}; map (first "};" closes it — the SVG strings contain no "};")
      h=h.replace(/var I=\{[\s\S]*?\};/, NEWMAP);
      if(h.indexOf('id="lx-wlmark"')<0){ const bi=h.lastIndexOf('</body>'); if(bi>=0) h=h.slice(0,bi)+STYLE+h.slice(bi); }
      json[k]=h; n++;
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('wallet lettermark icons on '+n+' pages');
