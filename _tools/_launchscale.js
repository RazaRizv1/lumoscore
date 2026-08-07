// Launchpad type was larger than the rest of the app. The user wants ONLY the font size reduced — the
// layout/design must stay untouched (an earlier zoom on main.page scaled the whole design; reverted here).
// So: strip the old zoom, and reduce ONLY the oversized text sizes to the app's normal scale via a scoped
// font-only stylesheet. Spacing, padding, component sizes are left exactly as designed.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const STYLE='<style id="lx-launchfont">'
+'main.page .page-header h1{font-size:28px !important}'
+'main.page .page-header p{font-size:14.5px !important}'
+'main.page .section-head h2{font-size:18px !important}'
+'main.page .field-label{font-size:13px !important}'
+'main.page .input,main.page .textarea,main.page .select,main.page input,main.page textarea,main.page select{font-size:15px !important}'
+'main.page .type-card .ttl{font-size:15px !important}'
+'main.page .upload-zone .ttl{font-size:15px !important}'
+'main.page .collapsible-head .ttl{font-size:15px !important}'
+'main.page .cost-total .v{font-size:18px !important}'
+'main.page .cost-total .k{font-size:14px !important}'
+'main.page .preview-name{font-size:21px !important}'
+'main.page .summary-cta{font-size:15px !important}'
+'main.page .slider-row .num-box,main.page .slider-row .num-suffix{font-size:16px !important}'
+'</style>';

let n=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      if(!/launch-(token|review|confirm)/.test(k)) continue;
      let h=json[k];
      // remove the earlier zoom (design change) and any prior font block
      h=h.replace(/<style id="lx-launchscale">[\s\S]*?<\/style>/g,'').replace(/<style id="lx-launchfont">[\s\S]*?<\/style>/g,'');
      if(h.indexOf('<main class="page"')<0){ json[k]=h; continue; }
      const bi=h.lastIndexOf('</body>'); if(bi<0){ json[k]=h; continue; }
      json[k]=h.slice(0,bi)+STYLE+h.slice(bi); n++;
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('launchpad font-only reduction (zoom reverted) on '+n+' pages');
