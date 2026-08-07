// Batch #6:
//  (1) Remove "Powered by" footers from BOTH wallet-connect popups (signin .kit + in-app .lxw-foot-attr).
//  (2) Strip the sliding price ticker (<div class="lm-tick">…) from the Trade & Pools animation cards.
//  (3) Align the dashboard quick-action headings (Swap card's longer desc lifted its title): top-align
//      the card content with a fixed gap instead of space-between so all four .ttl line up.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

// depth-matched removal of <div class="CLS">…</div> (handles nested divs inside)
function removeDivByClass(html,cls){
  let out=html, guard=0;
  while(guard++<50){
    const idx=out.indexOf('<div class="'+cls+'"');
    if(idx<0) break;
    let i=out.indexOf('>',idx)+1, depth=1;
    while(depth>0){
      const n=out.indexOf('<div',i), c=out.indexOf('</div>',i);
      if(c<0){depth=0;break;}
      if(n>=0&&n<c){depth++;i=n+4;} else {depth--;i=c+6;}
    }
    out=out.slice(0,idx)+out.slice(i);
  }
  return out;
}

const QSTYLE='<style id="lx-qcalign">.quick-card{justify-content:flex-start !important;gap:20px !important}</style>';

let poweredKit=0, poweredAttr=0, ticks=0, aligned=0, dedup=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k]; const before=h;

      // (1a) signin "Powered by" footer — <div class="kit">…Powered by <b id="walletKit">…</b></div>
      if(h.indexOf('id="walletKit"')>=0){ const n0=(h.match(/<div class="kit"/g)||[]).length; h=removeDivByClass(h,'kit'); poweredKit+=n0; }
      // (1b) in-app "Powered by" attribution span
      h=h.replace(/<span class="lxw-foot-attr">[\s\S]*?<\/span>/g,function(){poweredAttr++;return '';});

      // (2) sliding price ticker on the animation cards
      if(h.indexOf('class="lm-tick"')>=0){ const n0=(h.match(/<div class="lm-tick"/g)||[]).length; h=removeDivByClass(h,'lm-tick'); ticks+=n0; }

      // (3) dashboard quick-action heading alignment
      if(h.indexOf('id="qcSwap"')>=0 && h.indexOf('id="lx-qcalign"')<0){
        const bi=h.lastIndexOf('</body>'); if(bi>=0){ h=h.slice(0,bi)+QSTYLE+h.slice(bi); aligned++; }
      }

      // (4) copy typo: doubled chain name in the Launch quick-card desc ("the Aptos Aptos DEX")
      h=h.replace(/on the (.+?) \1 DEX/g,function(m,name){dedup++;return 'on the '+name+' DEX';});

      if(h!==before) json[k]=h;
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('batch6 — poweredBy(kit)='+poweredKit+' poweredBy(attr)='+poweredAttr+' tickers='+ticks+' qc-aligned='+aligned);
