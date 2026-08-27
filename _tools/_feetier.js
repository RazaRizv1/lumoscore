// Trade-Asset (dex-asset) page — Swap & Limit panes: "hold 250,000 LUMOS for the 0.1% fee tier" card.
// FULLER layout (icon+title / progress / balance+Buy) as a flex column with the foot pinned to the bottom
// (margin-top:auto) so the card fills gracefully when _dexlayout grows its height to align Total Reactions
// with the chart bottom. Theme-aware (dark Neon-Cyber / light emerald). LUMOS-logo icon. Shown only when
// the connected user does not qualify (< 250,000 LUMOS). Inserted AFTER each pane's CTA. Idempotent.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const ICON='<img src="assets/favicon.png" alt="LUMOS">';   // LUMOS logo
const ARROW='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

const STYLE='<style id="lx-feetier-css">'
+'.lx-feetier{position:relative;overflow:hidden;display:flex;flex-direction:column;gap:12px;justify-content:space-between;margin:12px 0;padding:14px;border-radius:13px;background:#08120e;border:1px solid rgba(70,220,150,.5);box-shadow:0 0 26px -8px rgba(53,220,140,.42)}'
+'.lx-feetier::before{content:"";position:absolute;inset:0;background:radial-gradient(95% 130% at 100% 120%,rgba(45,225,145,.24),transparent 55%);pointer-events:none}'
+'.lx-feetier>*{position:relative;z-index:1}'
+'.lx-ft-head{display:flex;gap:11px;align-items:center}'
+'.lx-ft-ic{width:34px;height:34px;border-radius:10px;flex-shrink:0;overflow:hidden;display:grid;place-items:center;background:rgba(47,200,132,.12);border:1px solid rgba(95,230,168,.3)}'
+'.lx-ft-ic img{width:100%;height:100%;object-fit:cover;display:block}'
+'.lx-ft-t{flex:1;min-width:0;font-size:13px;font-weight:600;line-height:1.3;color:#eef9f2}'
+'.lx-ft-t b{color:#7bffca;font-weight:800}'
+'.lx-ft-t .pct{color:#a8ffd4;font-weight:800}'
+'.lx-ft-p{height:6px;border-radius:4px;overflow:hidden;background:rgba(255,255,255,.13)}'
+'.lx-ft-pf{height:100%;border-radius:4px;background:#35c07f}'
+'.lx-ft-foot{display:flex;align-items:center;justify-content:space-between;gap:10px}'
+'.lx-ft-s{font-size:11.5px;color:rgba(255,255,255,.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
+'.lx-ft-s b{color:#7bffca;font-weight:700}'
+'.lx-ft-buy{flex-shrink:0;display:inline-flex;align-items:center;gap:5px;padding:9px 15px;border-radius:10px;border:none;font:800 12px/1 inherit;cursor:pointer;background:#1fa968;color:#eafff4;transition:background .14s}'
+'.lx-ft-buy:hover{background:#25bd78}'
+'.lx-ft-buy svg{width:12px;height:12px}'
// ---- LIGHT theme version ----
+'[data-theme="light"] .lx-feetier{background:#eefaf3;border-color:rgba(31,169,104,.32);box-shadow:0 8px 20px -14px rgba(31,169,104,.45)}'
+'[data-theme="light"] .lx-feetier::before{background:radial-gradient(95% 130% at 100% 120%,rgba(45,200,130,.12),transparent 55%)}'
+'[data-theme="light"] .lx-ft-ic{background:rgba(31,169,104,.1);border-color:rgba(31,169,104,.26)}'
+'[data-theme="light"] .lx-ft-t{color:#163a29}'
+'[data-theme="light"] .lx-ft-t b{color:#0f9257}'
+'[data-theme="light"] .lx-ft-t .pct{color:#0b7a48}'
+'[data-theme="light"] .lx-ft-p{background:rgba(20,60,40,.1)}'
+'[data-theme="light"] .lx-ft-pf{background:#1fa968}'
+'[data-theme="light"] .lx-ft-s{color:#5c6d64}'
+'[data-theme="light"] .lx-ft-s b{color:#0f9257}'
+'[data-theme="light"] .lx-ft-buy{background:#1fa968;color:#fff}'
+'[data-theme="light"] .lx-ft-buy:hover{background:#1a9560}'
+'</style>';

const SCRIPT='<script id="lx-feetier">(function(){'
// audit #37: BAL was a hardcoded 48240 — every visitor saw the same invented holding. Now it reads the
// live, issuer-checked balance published by lx-feerate and repaints when that resolves.
+'var THRESH=250000;'
+'function bal(){var b=window.__lxLumosBal;return (typeof b==="number"&&isFinite(b))?b:null;}'   // null = unknown/disconnected
+'function fmt(n){return Math.floor(n).toLocaleString("en-US");}'
+'function html(){var b=bal();var pct=(b===null||b<=0)?0:Math.max(3,Math.min(100,Math.round(b/THRESH*100)));'
+'var foot=(b===null)?"Connect your wallet to see your balance":("You hold <b>"+fmt(b)+"</b> / "+fmt(THRESH));'
+'return \'<div class="lx-ft-head"><div class="lx-ft-ic">'+ICON+'</div>\''
+'+\'<div class="lx-ft-t">Hold <b>250,000 LUMOS</b> to lower your fee to <span class="pct">0.1%</span></div></div>\''
+'+\'<div class="lx-ft-p"><div class="lx-ft-pf" style="width:\'+pct+\'%"></div></div>\''
+'+\'<div class="lx-ft-foot"><div class="lx-ft-s">\'+foot+\'</div>\''
+'+\'<button class="lx-ft-buy" type="button">Buy LUMOS'+ARROW+'</button></div>\';}'
+'function boot(){var panes=document.querySelectorAll(".dxa-pane-swap,.dxa-pane-limit");if(!panes.length)return false;'
+'var b=bal(),qualifies=(b!==null&&b>=THRESH);'
+'[].forEach.call(panes,function(p){var ex=p.querySelector(".lx-feetier");'
+'if(qualifies){if(ex&&ex.parentNode)ex.parentNode.removeChild(ex);return;}'   // already on the 0.1% tier -> no nudge
+'if(ex){ex.innerHTML=html();return;}'                                         // repaint in place (no remove/re-add flash)
+'var d=document.createElement("div");d.className="lx-feetier";d.innerHTML=html();'
+'var cta=p.querySelector(".dxa-trade-cta");if(cta)cta.parentNode.insertBefore(d,cta.nextSibling);else p.appendChild(d);});'
+'return true;}'
+'document.addEventListener("click",function(e){var b=e.target&&e.target.closest?e.target.closest(".lx-ft-buy"):null;if(!b)return;e.preventDefault();e.stopPropagation();if(window.__lxNav)__lxNav(\'lumoscore-lumos-token.html\');else location.href=\'lumoscore-lumos-token.html\';},true);'
+'function run(){var n=0,iv=setInterval(function(){if(boot()||++n>25)clearInterval(iv);},150);}'
+'window.addEventListener("lx:feetier",function(){boot();});'          // repaint once the real balance lands
+'if(document.readyState!=="loading")run();else document.addEventListener("DOMContentLoaded",run);'
+'})();</script>';

let n=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k];
      if(h.indexOf('dxa-trade-card')<0) continue;
      h=h.replace(/<style id="lx-feetier-css">[\s\S]*?<\/style>/g,'').replace(/<script id="lx-feetier">[\s\S]*?<\/script>/g,'');
      const bi=h.lastIndexOf('</body>'); if(bi<0) continue;
      json[k]=h.slice(0,bi)+STYLE+SCRIPT+h.slice(bi); n++;
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('LUMOS fee-tier notice (fuller, fill-height) on '+n+' pages');
