// Structural fixes across all showcase files / all pages:
//  #3 remove the theme toggle inside wallet-connect popups (they follow the site theme).
//  #4 dashboard header: replace the orange wallet-address chip with "Network stats in 24 hours"
//     (styled like the "Quick actions" section heading).
//  #5 icon consistency (launch->rocket, rewards->gift, bridge->span) + "DEX"->"Trade" in Explore products.
// Idempotent: replacements naturally no-op once applied; CSS keyed on <style id="lx-nstats">.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

// ---- canonical icon inner-SVG (from the side-menu, the single source of truth) ----
const ROCKET='<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.9 12.9 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>';
const BEAKER='<path d="M4 22h16"/><path d="M18 5l-2.36 7.07a4.5 4.5 0 0 1-7.28 0L6 5l3-3h6z"/>';
const GIFT='<path d="M20 12v9H4v-9"/><rect x="2" y="7" width="20" height="5" rx="1"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>';
const MEDAL='<polyline points="12 15 8 11 12 15 16 11 12 15"/><path d="M12 2v13"/><path d="M5 21h14"/><path d="M5 21a7 7 0 0 1 14 0"/>';
const BRIDGE='<path d="M4 9 1.5 12 4 15"/><path d="M20 9l2.5 3L20 15"/><path d="M2.5 12h19"/>';
const ARROW='<path d="M3 12h18"/><polyline points="14 5 21 12 14 19"/>';

const NSTATS_STYLE='<style id="lx-nstats">.lx-nstats{font-size:27px !important;font-weight:800 !important;letter-spacing:-0.5px !important;color:var(--text) !important;margin:0 0 2px !important;line-height:1.2}</style>';

// replace the generic arrow with the bridge span, but ONLY inside bridge tiles (near an lumoscore-bridge href)
function fixBridgeIcons(h){
  let out='', idx=0;
  while(true){
    const m=h.indexOf('lumoscore-bridge', idx);
    if(m<0){ out+=h.slice(idx); break; }
    const winEnd=Math.min(h.length, m+700);
    const arrowAt=h.indexOf(ARROW, m);
    if(arrowAt>=0 && arrowAt<winEnd){
      out+=h.slice(idx, arrowAt)+BRIDGE;
      idx=arrowAt+ARROW.length;
    } else {
      out+=h.slice(idx, m+16); // advance past this href, keep scanning
      idx=m+16;
    }
  }
  return out;
}

let stats={theme:0, header:0, launch:0, rewards:0, bridge:0, dex:0};
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k];
      const before=h;
      // #3 remove theme toggle in connect popups
      h=h.replace(/<button class="x" data-theme-toggle[\s\S]*?<\/button>/g, ()=>{stats.theme++;return '';});
      // #4 dashboard header -> "Network stats in 24 hours"
      if(/<h1 class="wal-greet">/.test(h)){
        h=h.replace(/<h1 class="wal-greet">[\s\S]*?<\/h1>/,'<h2 class="lx-nstats">Network stats in 24 hours</h2>');
        stats.header++;
        if(h.indexOf('id="lx-nstats"')<0){ const bi=h.lastIndexOf('</body>'); h=bi>=0?h.slice(0,bi)+NSTATS_STYLE+h.slice(bi):h+NSTATS_STYLE; }
      }
      // #5 icon consistency
      if(h.indexOf(BEAKER)>=0){ h=h.split(BEAKER).join(ROCKET); stats.launch++; }
      if(h.indexOf(MEDAL)>=0){ h=h.split(MEDAL).join(GIFT); stats.rewards++; }
      const hb=fixBridgeIcons(h); if(hb!==h){ stats.bridge++; h=hb; }
      // quick-action bridge tile has no href — anchor on its title instead
      h=h.replace(/(<div class="ic-lg"><svg[^>]*>)<path d="M3 12h18"\/><polyline points="14 5 21 12 14 19"\/>(<\/svg><\/div>[\s\S]{0,420}?<div class="ttl">Cross-chain Bridge<\/div>)/g, '$1'+BRIDGE+'$2');
      // activity-feed bridge icon (JS icon map) — same glyph everywhere
      h=h.replace(/(bridge:\s*'<svg[^>]*>)<path d="M3 12h18"\/><polyline points="14 5 21 12 14 19"\/>(<\/svg>')/g, '$1'+BRIDGE+'$2');
      // #5 DEX -> Trade in Explore products
      if(h.indexOf('<div class="pc-ttl">DEX</div>')>=0){ h=h.split('<div class="pc-ttl">DEX</div>').join('<div class="pc-ttl">Trade</div>'); stats.dex++; }
      h=h.split('Open DEX').join('Open Trade');
      if(h!==before) json[k]=h;
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('structural fixes:', JSON.stringify(stats));
