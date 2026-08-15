// Bridge page — surface the LUMOS fee tier (0.2% regular, 0.1% if holding 250,000 LUMOS):
//  1) a "Bridge fee" row (0.2% + "0.1% with LUMOS" chip) in the Review-swap step list,
//  2) a compact LUMOS note under the review with a Buy LUMOS button,
//  3) an extra "How it works" step describing the fee tier.
// Runtime + theme-aware (CSS vars). Works for every chain (incl. stellar/xrpl once built). Idempotent.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const STYLE='<style id="lx-bridgefee-css">'
+'.lx-bfee .lx-bchip{display:inline-flex;align-items:center;margin-left:7px;font-size:11px;font-weight:700;color:#0f9257;background:rgba(31,169,104,.1);border:1px solid rgba(31,169,104,.26);border-radius:20px;padding:2px 8px}'
+'[data-theme="dark"] .lx-bfee .lx-bchip{color:#5fe6a8;background:rgba(53,192,127,.14);border-color:rgba(95,230,168,.3)}'
+'.lx-brlumos{display:flex;align-items:center;gap:11px;margin-top:14px;padding:11px 13px;border-radius:13px;border:1px solid rgba(31,169,104,.28);background:rgba(31,169,104,.06)}'
+'[data-theme="dark"] .lx-brlumos{border-color:rgba(95,230,168,.26);background:rgba(53,192,127,.08)}'
+'.lx-brlumos-ic{width:32px;height:32px;border-radius:9px;overflow:hidden;flex-shrink:0;border:1px solid rgba(31,169,104,.25)}'
+'.lx-brlumos-ic img{width:100%;height:100%;object-fit:cover;display:block}'
+'.lx-brlumos-main{flex:1;min-width:0}'
+'.lx-brlumos-t{font-size:12.5px;line-height:1.3;color:var(--text)}'
+'.lx-brlumos-t b{color:#0f9257;font-weight:800}'
+'[data-theme="dark"] .lx-brlumos-t b{color:#5fe6a8}'
+'.lx-brlumos-s{font-size:11px;color:var(--text-soft);margin-top:2px}'
+'.lx-brlumos-s b{color:var(--text);font-weight:700}'
+'.lx-brlumos-buy{flex-shrink:0;padding:9px 14px;border-radius:9px;border:none;background:#1fa968;color:#fff;font:800 12px/1 inherit;cursor:pointer}'
+'.lx-brlumos-buy:hover{background:#25bd78}'
+'</style>';

const SCRIPT='<script id="lx-bridgefee">(function(){'
+'var URL="lumoscore-lumos-token.html";'
+'function boot(){var done=false;'
// 1) bridge fee row
+'var list=document.querySelector(".br-rv-list");'
+'if(list&&!list.querySelector(".lx-bfee")){var r=document.createElement("div");r.className="r lx-bfee";'
+'r.innerHTML=\'<span class="k">Bridge fee</span><span class="v">0.2%<span class="lx-bchip">0.1% with LUMOS</span></span>\';list.appendChild(r);done=true;}'
// 2) lumos note in review
+'var rv=document.querySelector(\'.br-step[data-step="3"] .br-rv\')||document.querySelector(".br-rv");'
+'if(rv&&!rv.querySelector(".lx-brlumos")){var n=document.createElement("div");n.className="lx-brlumos";'
+'n.innerHTML=\'<span class="lx-brlumos-ic"><img src="assets/favicon.png" alt="LUMOS"></span>\''
+'+\'<div class="lx-brlumos-main"><div class="lx-brlumos-t">Hold <b>250,000 LUMOS</b> to bridge at <b>0.1%</b> instead of 0.2%</div>\''
+'+\'<div class="lx-brlumos-s">You hold <b>48,240</b> / 250,000 LUMOS</div></div>\''
+'+\'<button class="lx-brlumos-buy" type="button">Buy LUMOS</button>\';rv.appendChild(n);done=true;}'
// 3) HIW fee step
+'var body=document.querySelector(".modal-hiw .modal-body");'
+'if(body&&!body.querySelector(".lx-hiwfee")){var steps=body.querySelectorAll(".hiw-step");var num=steps.length+1;var ns=num<10?"0"+num:""+num;'
+'var st=document.createElement("div");st.className="hiw-step lx-hiwfee";'
+'st.innerHTML=\'<div class="hiw-num">\'+ns+\'</div><div class="hiw-text"><div class="hiw-h">Low, transparent fees</div><div class="hiw-d">Bridging costs <b>0.2%</b> per transfer \\u2014 or just <b>0.1%</b> if you hold <b>250,000 LUMOS</b>.</div></div>\';body.appendChild(st);done=true;}'
+'return done;}'
+'document.addEventListener("click",function(e){var b=e.target&&e.target.closest?e.target.closest(".lx-brlumos-buy"):null;if(!b)return;e.preventDefault();if(window.__lxNav)__lxNav(URL);else location.href=URL;},true);'
+'function run(){var n=0,iv=setInterval(function(){boot();if(++n>30)clearInterval(iv);},220);}'   // keep trying (review step + HIW render lazily)
+'if(document.readyState!=="loading")run();else document.addEventListener("DOMContentLoaded",run);'
+'})();</script>';

let n=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain','stellar','xrpl']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      if(!/bridge/.test(k)) continue;
      let h=json[k];
      h=h.replace(/<style id="lx-bridgefee-css">[\s\S]*?<\/style>/g,'').replace(/<script id="lx-bridgefee">[\s\S]*?<\/script>/g,'');
      const bi=h.lastIndexOf('</body>'); if(bi<0) continue;
      json[k]=h.slice(0,bi)+STYLE+SCRIPT+h.slice(bi); n++;
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('bridge fee note + HIW step on '+n+' pages');
