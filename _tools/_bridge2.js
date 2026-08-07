// Cross-chain bridge — Step-2 + "How it works" polish (idempotent, all 7 chains, desktop+mobile):
//  1) Step 2: force the Source side to share the Destination side's column split so the
//     "Source address / Amount" fields line up under "Destination address / You get".
//  2) Step 2: remove the token logo in the Source-side asset selector (right of "Balance: …").
//  3) HIW modal: delete the "<chain> DEX charges roughly 0.0001 … network fee …" foot-note.
//  4) HIW modal: restyle into a nicer gradient-timeline (ember number badges + connector line,
//     hover rows, highlighted LUMOS-fee step).
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const STYLE='<style id="lx-bridge2css">'
// (1) align Source columns to Destination (both 346:244) — desktop only (mobile stacks <=620px)
+'@media(min-width:621px){'
+'.br-step[data-step="2"] .br-side{grid-template-columns:minmax(0,346fr) minmax(0,244fr) !important}'
+'.br-step[data-step="2"] .br-io>.br-side .br-wallet:not(.brw-in){padding-left:14px}'
+'}'
// (2) the LOGOS applier mispaints a token logo onto the source "MAX" pill (beside "Balance: …") —
//     strip that background image and restore the MAX label (asset selector logo stays untouched)
+'.br-step[data-step="2"] .br-amtrow .max{background:var(--accent-soft) !important;box-shadow:none !important;color:var(--accent) !important;width:auto !important;height:auto !important}'
+'.br-step[data-step="2"] .br-amtrow .max::after{content:"MAX"}'
// keep the balance + MAX on one line (the narrowed column was wrapping it)
+'.br-step[data-step="2"] .br-amtrow{white-space:nowrap}'
+'.br-step[data-step="2"] .br-amtrow .bal{white-space:nowrap;display:inline-flex;align-items:center}'
// (4) prettier HIW modal — gradient timeline
+'.modal-hiw{max-width:580px !important}'
+'.modal-hiw .modal-body{padding:14px 20px 20px !important}'
+'.modal-hiw .modal-ico{background:linear-gradient(140deg,var(--accent),#ff9a3d) !important;color:#fff !important;width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px rgba(234,106,44,.32)}'
+'.modal-hiw .modal-ico svg{width:20px;height:20px}'
+'.modal-hiw .hiw-step{position:relative;border-bottom:none !important;padding:11px 12px !important;border-radius:12px;transition:background .15s}'
+'.modal-hiw .hiw-step:hover{background:var(--surface-2)}'
+'.modal-hiw .hiw-step:not(:last-of-type)::before{content:"";position:absolute;left:29px;top:51px;bottom:-1px;width:2px;background:linear-gradient(var(--accent),var(--border));opacity:.4;border-radius:2px}'
+'.modal-hiw .hiw-num{background:linear-gradient(140deg,var(--accent),#ff9a3d) !important;color:#fff !important;box-shadow:0 4px 10px rgba(234,106,44,.28);position:relative;z-index:1}'
+'.modal-hiw .hiw-h{font-size:16px}'
// highlighted LUMOS-fee step (appended by _bridgefee.js)
+'.modal-hiw .lx-hiwfee{background:var(--accent-pale) !important;border:1px solid rgba(234,106,44,.26);margin-top:10px}'
+'.modal-hiw .lx-hiwfee:hover{background:var(--accent-pale) !important}'
+'.modal-hiw .lx-hiwfee::before{display:none !important}'
+'.modal-hiw .lx-hiwfee .hiw-num{background:linear-gradient(140deg,#1fa968,#25bd78) !important;box-shadow:0 4px 10px rgba(31,169,104,.3)}'
+'</style>';

// remove a flat <div class="hiw-foot-note"> … </div> (svg + span only, no nested divs → first </div> closes it)
function stripFootNote(h){ return h.replace(/<div class="hiw-foot-note">[\s\S]*?<\/div>/,''); }

let n=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain','stellar','xrpl']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      if(!/bridge/.test(k)) continue;
      let h=json[k]; const before=h;
      h=h.replace(/Balance: 12,500 /g,'Balance: 12.5K '); // shorten to save space (was wrapping)
      h=stripFootNote(h);
      h=h.replace(/<style id="lx-bridge2css">[\s\S]*?<\/style>/,''); // re-inject fresh (idempotent)
      const bi=h.lastIndexOf('</body>'); if(bi>=0) h=h.slice(0,bi)+STYLE+h.slice(bi);
      if(h!==before){ json[k]=h; n++; }
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('bridge step-2 + HIW polish on '+n+' pages');
