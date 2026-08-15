// Trade-Asset (dex-asset) page — a "Review order" modal that intercepts "Place Buy/Limit Order" and shows
// the full order details (You pay / You receive + Rate, Price impact, Slippage, Min received, Network fee,
// Trading fee), with a compact "hold 250,000 LUMOS for 0.1% fees" note near the bottom and a "Confirm order"
// button (re-fires the native CTA to continue the real flow). Plus an inline "Trading fee 0.2% · 0.1% with
// LUMOS" chip in the summary that links to the $LUMOS page. No panel-layout impact. Theme-aware. Idempotent.
const fs=require('fs');
// Every rule whose selector mentions the fee banner or its Buy button, taken straight out of _swapcalc.
const FM_BANNER_CSS = (function(){
  const w = fs.readFileSync(__dirname + '/_swapcalc.js', 'utf8');
  const out = (w.match(/\.lx-fee-(?:banner|ic|buy)[^{}]*\{[^}]*\}/g) || []).join('');
  if (out.length < 300) throw new Error('_feemodal: fee-banner CSS not found in _swapcalc.js');
  return out; })();const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const DOWN='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4.5 13.5H11l-1 8.5L18.5 10.5H12z"/></svg>';
const CLOSE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
const DARROW='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="6 13 12 19 18 13"/></svg>';

const STYLE='<style id="lx-feemodal-css">'
+'.lx-feerow{border-top:1px dashed var(--border);margin-top:4px !important;padding-top:8px !important;gap:12px}'+'.lx-feerow>*:first-child{flex:0 0 auto;margin-right:2px}'+'.lx-feerow{flex-wrap:wrap;row-gap:8px}'+'.lx-feehint{flex-wrap:wrap;justify-content:flex-end;margin-left:auto}'+'.lx-feechip{max-width:100%}'+'@media (max-width:430px){.lx-feechip{font-size:10.5px;padding:4px 9px;gap:4px}.lx-feerow{gap:8px}}'+'@media (max-width:395px){.lx-feechip{font-size:9.5px;padding:3px 8px;gap:3px;letter-spacing:0}.lx-fmsep{margin:0;height:9px}.lx-feechip svg{width:10px;height:10px}}'
+'.lx-feehint{display:inline-flex;align-items:center;gap:9px;flex-wrap:nowrap;min-width:0}'
+'.lx-feeold{color:var(--text);font-weight:800;letter-spacing:-.01em}.lx-feerate{font-weight:800}.lx-feehint .lx-feerate:only-child{color:#0b7a48}[data-theme="dark"] .lx-feehint .lx-feerate:only-child{color:#6ef0b4}'
+'.lx-feechip{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:800;letter-spacing:.2px;color:#0b7a48;background:linear-gradient(135deg,rgba(31,169,104,.18),rgba(31,169,104,.07));border:1px solid rgba(31,169,104,.34);border-radius:999px;padding:4px 11px;cursor:pointer;white-space:nowrap;box-shadow:0 2px 8px -5px rgba(31,169,104,.6);transition:transform .16s ease,box-shadow .16s ease,background .16s ease}'
+'.lx-feechip:hover{transform:translateY(-1px);background:linear-gradient(135deg,rgba(31,169,104,.26),rgba(31,169,104,.12));box-shadow:0 5px 14px -6px rgba(31,169,104,.65)}.lx-feechip:active{transform:translateY(0)}'
+'.lx-feechip svg{width:12px;height:12px;flex:0 0 auto}.lx-fmsep{width:1px;height:11px;background:currentColor;opacity:.32;margin:0 1px;flex:0 0 auto}.lx-fmore{display:inline-flex;align-items:center;gap:2px;font-weight:700;opacity:.92}.lx-fmore svg{width:9px;height:9px}'
+'[data-theme="dark"] .lx-feechip{color:#6ef0b4;background:linear-gradient(135deg,rgba(53,192,127,.24),rgba(53,192,127,.09));border-color:rgba(110,240,180,.38);box-shadow:0 2px 10px -5px rgba(53,192,127,.6)}[data-theme="dark"] .lx-feechip:hover{background:linear-gradient(135deg,rgba(53,192,127,.34),rgba(53,192,127,.14))}'
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
+FM_BANNER_CSS+'.lx-feebanner-wrap{margin-top:10px}'+'</style>';

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
+'+\'<div class="lx-rv-lumos-main"><div class="lx-rv-lumos-txt">Hold <b>250,000 LUMOS</b> to lower your fee to <b>0.1%</b></div>\''
+'+\'\''
+'+\'</div>\''
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
+'function fr(){var r=window.__lxFeeRate;return (typeof r==="number"&&r>0&&r<=0.002)?r:0.002;}'
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
// audit #38 (display half): the row always advertised "0.2% -> 0.1% with LUMOS", so a holder who was
// already ON the discounted tier saw the wrong rate in the order review. Show what they are actually charged.
+'function disc(){return window.__lxFeeRate===0.001;}'
+'function rateTxt(){return disc()?"0.1%":"0.2%";}'
+'function feeHTML(){return disc()?\'<span class="lx-feerate mono">0.1%</span>\''
+':\'<span class="lx-feerate lx-feeold mono">0.2%</span>\';}'
// Mobile ships the same summary under a DIFFERENT class -- .mdxa-trade-summary -- while the pane
// itself still carries .dxa-pane-swap. So this selector matched nothing there and the Trading fee row
// was simply never appended: the phone showed Rate / Price impact / Min received and stopped, with no
// fee stated anywhere on the screen someone actually swaps from.
+'function lxRvBal(){var b=window.__lxLumosBal,T=250000;'
  +'var t=document.querySelector(".lx-rv-lumos-bal"),bar=document.querySelector(".lx-rv-lumos-bar");'
  +'if(!t)return;'
  +'if(typeof b!=="number"){t.textContent="";if(bar)bar.style.display="none";return;}'
  +'if(bar){bar.style.display="";var fEl=bar.querySelector(".f");'
  +'if(fEl)fEl.style.width=Math.max(0,Math.min(100,b/T*100)).toFixed(1)+"%";}'
  +'var n=b>=1?Math.round(b).toLocaleString("en-US"):(Math.round(b*100)/100);'
  +'t.innerHTML="You hold <b>"+n+"</b> / 250,000 LUMOS";}'
  +'window.addEventListener("lx:feetier",function(){try{lxRvBal();}catch(_){}} );'
    +'function addRows(){var sums=document.querySelectorAll(".dxa-pane-swap .dxa-trade-summary,.dxa-pane-limit .dxa-trade-summary,.dxa-pane-swap .mdxa-trade-summary,.dxa-pane-limit .mdxa-trade-summary");'
+'sums.forEach(function(sum){var ex=sum.querySelector(".lx-feerow");'
+'if(ex){var hint=ex.querySelector(".lx-feehint");if(hint)hint.innerHTML=feeHTML();return;}'
+'var row=document.createElement("div");var sib=sum.querySelector(".dxa-tsum-row");row.className=(sib?sib.className.replace(/\blx-feerow\b/g,"")+" ":"dxa-tsum-row ")+"lx-feerow";'
+'row.innerHTML=\'<span>Trading fee</span><span class="lx-feehint">\'+feeHTML()+\'</span>\';'
+'sum.appendChild(row);'
  +'try{lxRvBal();}catch(_){}'
  +'var bw=sum.querySelector(".lx-feebanner-wrap");if(!bw){bw=document.createElement("div");bw.className="lx-feebanner-wrap";sum.appendChild(bw);}'
  +'bw.innerHTML=disc()'
  +'?\'<div class="lx-fee-banner holder"><span class="lx-fee-ic"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-4 0-7-2.7-7-6.5 0-2.3 1.2-4 2.4-5.4.3.9 1 1.6 1.9 1.6 1.4 0 1.7-1 1.6-3.5-.1-2.4 1-4.6 3.1-6.2-.4 2 .3 3.2 1.6 4.6C19 9.6 19 11.8 19 16.5c0 3.8-3 6.5-7 6.5z"></path></svg></span><span class="txt"><b>You qualify for 0.1% fees</b> \u2014 50% Discount</span></div>\''
  +':\'<div class="lx-fee-banner nudge"><span class="lx-fee-ic"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-4 0-7-2.7-7-6.5 0-2.3 1.2-4 2.4-5.4.3.9 1 1.6 1.9 1.6 1.4 0 1.7-1 1.6-3.5-.1-2.4 1-4.6 3.1-6.2-.4 2 .3 3.2 1.6 4.6C19 9.6 19 11.8 19 16.5c0 3.8-3 6.5-7 6.5z"></path></svg></span><span class="txt"><b>GET 50% OFF</b> \\u2014 hold 250,000 LUMOS</span><a class="lx-fee-buy" href="lumoscore-lumos-token.html">Buy LUMOS</a></div>\';'
  +'});return sums.length>0;}'
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
