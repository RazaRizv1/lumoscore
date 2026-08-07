// AUDIT (user-reported): "when I place an order on trade or swap, or deposit/withdraw on Pools, the button
// should show that it's loading — right now it just stays like that for a couple of seconds".
//
// The runners DO already swap the label to "Confirm in wallet…", but a text change with no motion is easy to
// miss on a button you just clicked, and the gap covers a wallet prompt plus a network round trip. This adds
// the missing visual: a spinning ring in the button, a dimmed/locked look, and a progress shimmer along the
// bottom edge. One class, `lx-btnload`, so every action button on the site can share it — the runners in
// _ammdata.js / _dexassetdata.js just toggle the class.
//
// Injected site-wide (not per page) because the same treatment is wanted on Trade, Pools, Bridge and
// Launchpad, and a single rule keeps them from drifting apart.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const CSS='<style id="lx-btnload-css">'
+'@keyframes lxbtnspin{to{transform:rotate(360deg)}}'
+'@keyframes lxbtnsweep{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}'
+'.lx-btnload{position:relative!important;pointer-events:none!important;cursor:wait!important;opacity:.85!important;overflow:hidden!important}'
// the ring sits before the label; currentColor keeps it legible on the orange CTA and on outline buttons alike
+'.lx-btnload::before{content:"";display:inline-block;width:14px;height:14px;margin-right:9px;vertical-align:-2px;'
+'border:2px solid currentColor;border-right-color:transparent;border-radius:50%;opacity:.9;animation:lxbtnspin .6s linear infinite}'
// a light sweep across the button so it reads as "working" even at a glance
+'.lx-btnload::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;'
+'background:linear-gradient(90deg,transparent,currentColor,transparent);opacity:.55;animation:lxbtnsweep 1.1s ease-in-out infinite}'
// a button mid-action must never also look disabled-by-validation
+'.lx-btnload.lx-dwoff{opacity:.85!important;pointer-events:none!important;filter:none!important}'
+'@media (prefers-reduced-motion:reduce){.lx-btnload::before{animation-duration:2s}.lx-btnload::after{animation:none;opacity:.35}}'
+'</'+'style>';

let n=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain','stellar','xrpl']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    let changed=false;
    for(const k of Object.keys(json)){
      let h=json[k];
      h=h.replace(/<style id="lx-btnload-css">[\s\S]*?<\/style>/g,'');     // idempotent: strip first
      const bi=h.lastIndexOf('</body>'); if(bi<0) continue;
      json[k]=h.slice(0,bi)+CSS+h.slice(bi); changed=true; n++;
    }
    if(changed){ const serialized=JSON.stringify(json).split('</').join('<'+B+'/'); fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8'); }
  }
}
console.log('button loading state (.lx-btnload) available on '+n+' page keys');
