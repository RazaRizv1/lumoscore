// Trade-Asset (dex-asset) page — a "Review order" modal that intercepts "Place Buy/Limit Order" and shows
// the full order details (You pay / You receive + Rate, Price impact, Slippage, Min received, Network fee,
// Trading fee), with a compact "hold 250,000 LUMOS for 0.25% fees" note near the bottom and a "Confirm order"
// button (re-fires the native CTA to continue the real flow). Plus an inline "Trading fee 0.5% · 0.25% with
// LUMOS" chip in the summary that links to the $LUMOS page. No panel-layout impact. Theme-aware. Idempotent.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const DOWN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M8 11l4 4 4-4"/></svg>';
const CLOSE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
const DARROW='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="6 13 12 19 18 13"/></svg>';

const STYLE='<style id="lx-feemodal-css">'
+'.lx-feerow{border-top:1px dashed var(--border);margin-top:4px !important;padding-top:8px !important}'
+'.lx-feehint{display:inline-flex;align-items:center;gap:7px}'
+'.lx-feeold{color:var(--text);font-weight:600}'
+'.lx-feechip{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:#0f9257;background:rgba(31,169,104,.1);border:1px solid rgba(31,169,104,.26);border-radius:20px;padding:2px 8px;cursor:pointer;transition:.14s;white-space:nowrap}'
+'.lx-feechip:hover{background:rgba(31,169,104,.2)}'
+'.lx-feechip svg{width:11px;height:11px}'
+'[data-theme="dark"] .lx-feechip{color:#5fe6a8;background:rgba(53,192,127,.14);border-color:rgba(95,230,168,.3)}'
+'.lx-feemodal{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(8,10,14,.55);backdrop-filter:blur(3px)}'
+'.lx-fm-card{width:min(420px,94vw);max-height:92vh;overflow:auto;background:var(--surface,#fff);border:1px solid var(--border);border-radius:18px;box-shadow:0 30px 70px -20px rgba(0,0,0,.55);animation:lxfmin .22s ease}'
+'@keyframes lxfmin{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}'
+'.lx-fm-head{display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid var(--border)}'
+'.lx-fm-head h3{flex:1;font-size:16px;font-weight:800;color:var(--text)}'
+'.lx-fm-close{width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text-soft);cursor:pointer;display:grid;place-items:center;flex-shrink:0}'
+'.lx-fm-close svg{width:14px;height:14px}'
+'.lx-fm-body{padding:16px 18px 4px}'
+'.lx-rv-swap{position:relative;background:var(--bg,#f6f7f9);border:1px solid var(--border);border-radius:12px;padding:2px 14px}'
+'.lx-rv-leg{display:flex;justify-content:space-between;align-items:baseline;padding:12px 0}'
+'.lx-rv-leg+.lx-rv-leg{border-top:1px solid var(--border)}'
+'.lx-rv-lbl{font-size:12.5px;color:var(--text-soft)}'
+'.lx-rv-amt{font-size:17px;font-weight:800;color:var(--text);font-family:\'JetBrains Mono\',monospace}'
+'.lx-rv-ar{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:26px;height:26px;border-radius:50%;background:var(--surface,#fff);border:1px solid var(--border);display:grid;place-items:center;color:var(--text-soft)}'
+'.lx-rv-ar svg{width:14px;height:14px}'
+'.lx-rv-details{margin-top:14px}'
+'.lx-rv-drow{display:flex;justify-content:space-between;gap:14px;font-size:12.5px;padding:5px 0;color:var(--text-soft)}'
+'.lx-rv-drow .v{color:var(--text);font-weight:600;font-family:\'JetBrains Mono\',monospace;text-align:right}'
+'.lx-rv-lumos{display:flex;align-items:center;gap:10px;margin-top:14px;padding:10px 11px;border-radius:11px;border:1px solid rgba(31,169,104,.28);background:rgba(31,169,104,.06)}'
+'[data-theme="dark"] .lx-rv-lumos{border-color:rgba(95,230,168,.28);background:rgba(53,192,127,.08)}'
+'.lx-rv-lumos-ic{width:28px;height:28px;border-radius:8px;overflow:hidden;flex-shrink:0;border:1px solid rgba(31,169,104,.25)}'
+'.lx-rv-lumos-ic img{width:100%;height:100%;object-fit:cover;display:block}'
+'.lx-rv-lumos-main{flex:1;min-width:0}'
+'.lx-rv-lumos-txt{font-size:11.5px;line-height:1.3;color:var(--text)}'
+'.lx-rv-lumos-txt b{color:#0f9257;font-weight:800}'
+'[data-theme="dark"] .lx-rv-lumos-txt b{color:#5fe6a8}'
+'.lx-rv-lumos-bar{height:5px;border-radius:3px;background:rgba(31,169,104,.18);overflow:hidden;margin:6px 0 4px}'
+'[data-theme="dark"] .lx-rv-lumos-bar{background:rgba(95,230,168,.16)}'
+'.lx-rv-lumos-bar .f{height:100%;border-radius:3px;background:linear-gradient(90deg,#35c07f,#1fa968)}'
+'.lx-rv-lumos-bal{font-size:10.5px;color:var(--text-soft)}'
+'.lx-rv-lumos-bal b{color:var(--text);font-weight:700}'
+'.lx-buy-sm{flex-shrink:0;display:inline-flex;align-items:center;padding:6px 11px;border-radius:8px;border:none;background:#1fa968;color:#fff;font:800 11px/1 inherit;cursor:pointer}'
+'.lx-buy-sm:hover{background:#25bd78}'
+'.lx-fm-foot{padding:14px 18px 18px}'
+'.lx-fm-confirm{width:100%;height:48px;border:none;border-radius:12px;background:var(--accent,#ea6a2c);color:#fff;font-weight:800;font-size:15px;cursor:pointer;transition:filter .14s}'
+'.lx-fm-confirm:hover{filter:brightness(1.05)}'
+'</style>';

const SCRIPT='<script id="lx-feemodal">(function(){'
+'var URL="lumoscore-lumos-token.html";var modal=null,lastCta=null,proceeding=false;'
+'function tick(el){var t=el?el.textContent.trim():"";var m=t.match(/[A-Z]{2,6}/);return m?m[0]:t;}'
+'function fnum(n){return (n||0).toLocaleString("en-US",{maximumFractionDigits:6});}'
+'function build(){if(modal)return;'
+'modal=document.createElement("div");modal.className="lx-feemodal";modal.style.display="none";'
+'modal.innerHTML=\'<div class="lx-fm-card"><div class="lx-fm-head"><h3>Review order</h3><button class="lx-fm-close" type="button">'+CLOSE+'</button></div>\''
+'+\'<div class="lx-fm-body"><div class="lx-rv-swap"><div class="lx-rv-leg"><span class="lx-rv-lbl">You pay</span><span class="lx-rv-amt" data-pay>&mdash;</span></div>\''
+'+\'<div class="lx-rv-leg"><span class="lx-rv-lbl">You receive</span><span class="lx-rv-amt" data-receive>&mdash;</span></div><div class="lx-rv-ar">'+DARROW+'</div></div>\''
+'+\'<div class="lx-rv-details" data-details></div>\''
+'+\'<div class="lx-rv-lumos"><span class="lx-rv-lumos-ic"><img src="assets/favicon.png" alt="LUMOS"></span>\''
+'+\'<div class="lx-rv-lumos-main"><div class="lx-rv-lumos-txt">Hold <b>250,000 LUMOS</b> to lower your fee to <b>0.25%</b></div>\''
+'+\'<div class="lx-rv-lumos-bar"><div class="f" style="width:19%"></div></div>\''
+'+\'<div class="lx-rv-lumos-bal">You hold <b>48,240</b> / 250,000 LUMOS</div></div>\''
+'+\'<button class="lx-buy-sm" type="button">Buy LUMOS</button></div></div>\''
+'+\'<div class="lx-fm-foot"><button class="lx-fm-confirm" type="button">Confirm order</button></div></div>\';'
+'document.body.appendChild(modal);'
+'modal.addEventListener("click",function(e){if(e.target===modal)close();});'
+'modal.querySelector(".lx-fm-close").onclick=close;'
+'modal.querySelector(".lx-buy-sm").onclick=function(){close();if(window.__lxNav)__lxNav(URL);else location.href=URL;};'
+'modal.querySelector(".lx-fm-confirm").onclick=function(){close();if(lastCta){proceeding=true;lastCta.click();}};'
+'}'
+'function populate(pane){if(!pane)return;var fields=pane.querySelectorAll(".dxa-trade-field");'
+'var payIn=fields[0]&&fields[0].querySelector("input");var payTok=tick(fields[0]&&fields[0].querySelector(".dxa-trade-ir"));'
+'var recTok=tick(fields[1]&&fields[1].querySelector(".dxa-trade-ir"));'
+'var payNum=parseFloat(((payIn&&payIn.value)||"").replace(/,/g,""))||0;'
// AUDIT (numeric): the modal derived receive as pay x rate — but the pane's "Rate" row is the GROSS market
// rate while the pane's receive field is already NET of the platform fee. So the confirmation screen showed
// ~0.5% more than the user would actually get, and a Min received to match. Trust the pane's own figures.
+'var recIn=fields[1]&&fields[1].querySelector("input");'
+'var recNum=parseFloat((((recIn&&recIn.value)||"")+"").replace(/,/g,""))||0;'
+'function fr(){var r=window.__lxFeeRate;return (typeof r==="number"&&r>0&&r<=0.005)?r:0.005;}'
+'var rate=0,slip=0.5,det="";var rows=pane.querySelectorAll(".dxa-trade-summary .dxa-tsum-row");'
+'[].forEach.call(rows,function(r){var sp=r.querySelectorAll("span");var k=(sp[0]||{}).textContent.trim();var v;'
+'if(r.querySelector(".lx-feerate")){v=rateTxt();}else{v=((sp[sp.length-1]||{}).textContent||"").replace(/\\s+/g," ").trim();}'
+'if(k==="Rate"){var p=v.split("=")[1];if(p){var num=parseFloat(p.replace(/[^0-9.]/g,""));if(num)rate=num;}}'
+'if(k==="Slippage tolerance"){var sm=v.match(/([0-9.]+)/);if(sm)slip=parseFloat(sm[1]);}'
+'if(k==="Min received"&&!(parseFloat(v.replace(/[^0-9.]/g,""))>0)){v=fnum((recNum||payNum*rate*(1-fr()))*(1-slip/100))+" "+recTok;}'   // only synthesize when the pane has nothing
+'if(k)det+=\'<div class="lx-rv-drow"><span>\'+k+\'</span><span class="v">\'+v+\'</span></div>\';});'
+'if(!(recNum>0))recNum=rate?payNum*rate*(1-fr()):0;'
+'modal.querySelector("[data-pay]").textContent=fnum(payNum)+" "+payTok;'
+'modal.querySelector("[data-receive]").textContent=fnum(recNum)+" "+recTok;'
+'modal.querySelector("[data-details]").innerHTML=det;}'
+'function open(cta){build();lastCta=cta;var pane=(cta&&cta.closest(".dxa-pane"))||document.querySelector(".dxa-pane-swap.active,.dxa-pane-limit.active")||document.querySelector(".dxa-pane-swap");populate(pane);modal.style.display="flex";}'
+'function close(){if(modal)modal.style.display="none";}'
+'document.addEventListener("click",function(e){var t=e.target;if(!t||!t.closest)return;'
+'var cta=t.closest(".dxa-trade-cta");if(cta){if(cta.closest(".dxa-pane-limit"))return;if(proceeding){proceeding=false;return;}e.preventDefault();e.stopImmediatePropagation();open(cta);return;}'
+'var chip=t.closest(".lx-feechip");if(chip){e.preventDefault();e.stopPropagation();if(window.__lxNav)__lxNav(URL);else location.href=URL;}'
+'},true);'
// audit #38 (display half): the row always advertised "0.5% -> 0.25% with LUMOS", so a holder who was
// already ON the discounted tier saw the wrong rate in the order review. Show what they are actually charged.
+'function disc(){return window.__lxFeeRate===0.0025;}'
+'function rateTxt(){return disc()?"0.25%":"0.5%";}'
+'function feeHTML(){return disc()?\'<span class="lx-feerate mono">0.25%</span>\''
+':\'<span class="lx-feerate lx-feeold mono">0.5%</span><span class="lx-feechip">'+DOWN+'0.25% with LUMOS</span>\';}'
+'function addRows(){var sums=document.querySelectorAll(".dxa-pane-swap .dxa-trade-summary,.dxa-pane-limit .dxa-trade-summary");'
+'sums.forEach(function(sum){var ex=sum.querySelector(".lx-feerow");'
+'if(ex){var hint=ex.querySelector(".lx-feehint");if(hint)hint.innerHTML=feeHTML();return;}'
+'var row=document.createElement("div");row.className="dxa-tsum-row lx-feerow";'
+'row.innerHTML=\'<span>Trading fee</span><span class="lx-feehint">\'+feeHTML()+\'</span>\';'
+'sum.appendChild(row);});return sums.length>0;}'
+'window.addEventListener("lx:feetier",function(){addRows();});'
+'function run(){var n=0,iv=setInterval(function(){if(addRows()||++n>25)clearInterval(iv);},180);}'
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
      h=h.replace(/<style id="lx-feemodal-css">[\s\S]*?<\/style>/g,'').replace(/<script id="lx-feemodal">[\s\S]*?<\/script>/g,'');
      const bi=h.lastIndexOf('</body>'); if(bi<0) continue;
      json[k]=h.slice(0,bi)+STYLE+SCRIPT+h.slice(bi); n++;
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('Review-order modal (+ LUMOS note + fee chip) on '+n+' pages');
