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
+'.lx-feemodal{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(8,10,14,.55);backdrop-filter:blur(3px);overflow:hidden}'
+'@media(max-width:760px){.lx-feemodal{align-items:flex-start;padding:14px 12px}.lx-fm-card{margin:0 auto}}'
+'.lx-fm-card{width:min(420px,94vw);max-height:92vh;max-height:92dvh;overflow:auto;overscroll-behavior:contain;background:var(--surface,#fff);border:1px solid var(--border);border-radius:18px;box-shadow:0 30px 70px -20px rgba(0,0,0,.55);animation:lxfmin .22s ease}'
// The card's cap was in vh, which is the LAYOUT viewport -- so with the keyboard up it could be taller
// than the strip of screen left to show it in, even once the overlay itself is pinned correctly (see
// fitVV below). A percentage of the overlay is right in both states: with no keyboard the overlay is
// the full viewport and this is the same 92% it always was.
+'.lx-feemodal .lx-fm-card{max-height:92%}'
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
+'.lx-rv-amt{font-size:17px;font-weight:800;color:var(--text);font-family:\'JetBrains Mono\',monospace;display:inline-flex;align-items:center;gap:8px}'
// The class must NOT contain the substring "ico". A logo engine baked into the container selects on
// [class*="ico"], walks UP the DOM looking for something that reads as a ticker, and repaints whatever
// it finds -- and inside this modal the nearest match is the word LUMOS in the "Hold 250,000 LUMOS to
// lower your fee" line. That is why both legs drew the same orange L: not a fallback, but the engine
// confidently painting the wrong token over our correct one, wiping our background-image on the way.
// Renamed out of its selector, and data-logoed (its own skip flag) set as a second line of defence.
+'.lx-rv-mk{width:22px;height:22px;flex:0 0 22px;border-radius:50%;background-size:cover;background-position:center;background-repeat:no-repeat;background-color:var(--surface-2);box-shadow:0 0 0 1px var(--border)}'
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
// The ticker is not always TEXT. On a phone the receive chip renders as a logo swatch with no label --
// its code lives in data-lxmt-code -- so reading the field's text gave "" and the review said
// "You receive 0.022317" with no asset named at all. Text first, attribute second.
+'function tok(f){if(!f)return "";var t=tick(f.querySelector(".dxa-trade-ir"));if(t)return t;'
+'var c=f.querySelector("[data-lxmt-code]");return c?((c.getAttribute("data-lxmt-code")||"").trim()):"";}'
// Reads the pair out of the pane's own Rate row. Returns null unless BOTH sides parse and differ, so a
// half-rendered or placeholder row ("Rate —") can never overrule the fields.
+'function pairFromRate(pane){try{var out=null;'
+'[].forEach.call(pane.querySelectorAll(".dxa-trade-summary .dxa-tsum-row"),function(r){'
+'var sp=r.querySelectorAll("span");if(!sp.length)return;'
+'if(((sp[0]||{}).textContent||"").trim()!=="Rate")return;'
+'var v=((sp[sp.length-1]||{}).textContent||"").trim();var eq=v.indexOf("=");if(eq<0)return;'
+'var a=v.slice(0,eq).match(/[A-Za-z][A-Za-z0-9]{1,11}/);'
+'var b=v.slice(eq+1).match(/[A-Za-z][A-Za-z0-9]{1,11}/);'
+'if(a&&b&&a[0]!==b[0])out=[a[0],b[0]];});'
+'return out;}catch(_){return null;}}'
+'var payIn=fields[0]&&fields[0].querySelector("input");var payTok=tok(fields[0]);'
+'var recTok=tok(fields[1]);'
// Rate row wins where it parses; it is the one place the pane names both sides in one string.
+'var rp=pairFromRate(pane);if(rp){payTok=rp[0];recTok=rp[1];}'
// Nobody swaps an asset for itself. If the two legs still agree, the read failed -- say so instead of
// showing a confident, wrong confirmation and letting it be signed.
+'if(payTok&&payTok===recTok){payTok="";recTok="";}'
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
// #7: the first version read getComputedStyle(el).backgroundImage and got "none", so it fell through
// to an <img> that is not there either, and the modal drew the letter-avatar fallback -- an orange L
// beside 0.01 XLM. The pane does not paint its token on the ELEMENT: the mark is a ::before whose
// background-image comes from the --lxtic custom property. Ask for it the way it is actually stored,
// and only then fall back through the other two shapes.
// #2 (batch 7), the mobile half. Two separate faults, neither visible on desktop.
//
// FIRST: the markup was invalid. This built the span as a string with style="..." in DOUBLE quotes and
// then dropped a CSS url into it -- and both sources of that url produce DOUBLE quotes of their own:
// JSON.stringify(img.src) by definition, and getComputedStyle().backgroundImage because the browser
// normalises to url("..."). The attribute therefore ended at the first inner quote and the rest of the
// data URI was parsed as a series of junk attributes. Desktop escaped this only by luck: it takes the
// --lxtic path, whose inline value happens to be unquoted.
// So the URL is extracted RAW now and re-emitted single-quoted, which cannot collide with the attribute.
//
// SECOND: the two legs are not the same shape on a phone. "You pay" has an <img> inside .mdxa-trade-ic,
// but "You receive" has no icon element at all -- its logo is a background-image on the
// .mdxa-trade-asset chip itself. The old selector knew about neither, so the receive leg found nothing
// and rendered with no mark. Both are in the list below, chip last so a real icon always wins.
+'function rawUrl(v){v=String(v||"").trim();if(!v||v==="none")return "";'
+'var m=/url\\((.*)\\)/i.exec(v);if(!m)return "";'
+'var u=m[1].trim().replace(/^[\"\\x27]|[\"\\x27]$/g,"");'
+'return u&&u!=="none"?u:"";}'
+'function legIco(field){if(!field)return "";'
+'var el=field.querySelector(".dxa-trade-ic,.mdxa-trade-ic,.dxa-trade-ir .ico,.dxa-trade-ir img,.dxa-trade-ir [class*=ico]")'
+'||field.querySelector(".mdxa-trade-asset,.dxa-trade-asset");'
+'if(!el)return "";var u="";'
+'try{var v=(el.style&&el.style.getPropertyValue("--lxtic"))||"";'
+'if(!v){var c0=getComputedStyle(el);v=c0.getPropertyValue("--lxtic")||c0.getPropertyValue("--lxmlogo")||"";}'
+'u=rawUrl(v);}catch(_){}'
+'if(!u){try{u=rawUrl(getComputedStyle(el,"::before").backgroundImage);}catch(_){}}'
+'if(!u){try{u=rawUrl(getComputedStyle(el).backgroundImage);}catch(_){}}'
+'if(!u){var im=el.tagName==="IMG"?el:el.querySelector("img");if(im&&im.src)u=im.src;}'
+'if(!u)return "";'
+'var esc=String(u).replace(/\\x27/g,"%27").replace(/\\s+/g,"");'
+'return \'<span class="lx-rv-mk" data-logoed="1" data-lxc="1" style="background-image:url(\\x27\'+esc+\'\\x27)"></span>\';}'
+'var payIco=payTok?legIco(fields[0]):"",recIco=recTok?legIco(fields[1]):"";'
+'modal.querySelector("[data-pay]").innerHTML=payIco+\'<span>\'+fnum(payNum)+" "+payTok+\'</span>\';'
+'modal.querySelector("[data-receive]").innerHTML=recIco+\'<span>\'+fnum(recNum)+" "+recTok+\'</span>\';'
+'modal.querySelector("[data-details]").innerHTML=det;'
+'var ok=!!(payTok&&recTok&&payTok!==recTok);'
+'var cf=modal.querySelector(".lx-fm-confirm");'
+'if(cf){cf.disabled=!ok;cf.style.opacity=ok?"":"0.5";cf.style.cursor=ok?"":"not-allowed";'
+'cf.textContent=ok?"Confirm order":"Could not read this order";}'
+'}'
// #4, third report -- and the first two attempts were treating the symptom.
//
// .lx-feemodal is position:fixed;inset:0, and `fixed` resolves against the LAYOUT viewport. A phone
// with the keyboard up has a VISUAL viewport roughly half that height, scrolled down inside it so the
// focused amount field stays visible. The overlay therefore paints from the top of the layout viewport
// -- above the strip of screen the user can actually see -- which is precisely "I have to scroll up to
// the confirm box". Blurring the field (below) only helps if the keyboard actually goes away and the
// offset animates back to zero, which is why it kept half-working.
//
// So stop assuming the two viewports coincide and ask for the real one. visualViewport reports the
// visible rectangle in layout coordinates; pinning the overlay to it is correct with the keyboard up,
// with it down, and mid-animation, because the listeners re-run on every change. With no keyboard the
// numbers are exactly inset:0, so nothing changes on desktop.
+'function fitVV(){var vv=window.visualViewport;if(!vv||!modal)return;'
+'var st=modal.style;st.top=vv.offsetTop+"px";st.left=vv.offsetLeft+"px";'
+'st.width=vv.width+"px";st.height=vv.height+"px";st.right="auto";st.bottom="auto";}'
+'function unfitVV(){if(!modal)return;var st=modal.style;'
+'st.top=st.left=st.width=st.height=st.right=st.bottom="";}'
+'function open(cta){build();lastCta=cta;var pane=(cta&&cta.closest(".dxa-pane"))||document.querySelector(".dxa-pane-swap.active,.dxa-pane-limit.active")||document.querySelector(".dxa-pane-swap");populate(pane);modal.style.display="flex";'
// #8 (second attempt). The harness could not reproduce this -- in an iframe the sheet opens with its
// header at the top of the viewport every time -- so the cause has to be something only a real phone
// does. Two candidates, both addressed here.
//
// The KEYBOARD is the likely one: the amount field still has focus when Swap is tapped, so the
// on-screen keyboard is up, the VISUAL viewport is half the height of the layout viewport, and the
// browser scrolls to keep the focused input in view -- which moves a fixed overlay's contents out of
// sight from underneath. Blurring first dismisses the keyboard and stops that scroll happening at all.
+'try{var _ae=document.activeElement;if(_ae&&_ae.blur)_ae.blur();}catch(_){}'
// The second is a sheet left mid-scroll: reset BOTH layers, and the overlay no longer scrolls at all.
+'try{modal.scrollTop=0;var _c=modal.querySelector(".lx-fm-card");if(_c)_c.scrollTop=0;}catch(_){}'
+'try{requestAnimationFrame(function(){var c2=modal.querySelector(".lx-fm-card");if(c2)c2.scrollTop=0;modal.scrollTop=0;});}catch(_){}'
+'try{setTimeout(function(){var c3=modal.querySelector(".lx-fm-card");if(c3)c3.scrollTop=0;modal.scrollTop=0;},220);}catch(_){}'
+'try{modal.__lxPrevOvf=document.body.style.overflow;document.body.style.overflow="hidden";}catch(_){}'
+'try{fitVV();requestAnimationFrame(fitVV);setTimeout(fitVV,220);setTimeout(fitVV,450);'
+'var vv=window.visualViewport;if(vv&&!modal.__lxVV){modal.__lxVV=1;'
+'vv.addEventListener("resize",fitVV);vv.addEventListener("scroll",fitVV);}}catch(_){}}'
+'function close(){if(!modal)return;modal.style.display="none";try{unfitVV();}catch(_){}'
+'try{var vv2=window.visualViewport;if(vv2&&modal.__lxVV){modal.__lxVV=0;'
+'vv2.removeEventListener("resize",fitVV);vv2.removeEventListener("scroll",fitVV);}}catch(_){}'
+'try{document.body.style.overflow=modal.__lxPrevOvf||"";}catch(_){}}'
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
  +'?\'<div class="lx-fee-banner holder"><span class="lx-fee-ic"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-4 0-7-2.7-7-6.5 0-2.3 1.2-4 2.4-5.4.3.9 1 1.6 1.9 1.6 1.4 0 1.7-1 1.6-3.5-.1-2.4 1-4.6 3.1-6.2-.4 2 .3 3.2 1.6 4.6C19 9.6 19 11.8 19 16.5c0 3.8-3 6.5-7 6.5z"></path></svg></span><span class="txt"><b>You qualify for 0.1% trading fees</b> \u2014 50% Discount</span></div>\''
  +':\'<div class="lx-fee-banner nudge"><span class="lx-fee-ic"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-4 0-7-2.7-7-6.5 0-2.3 1.2-4 2.4-5.4.3.9 1 1.6 1.9 1.6 1.4 0 1.7-1 1.6-3.5-.1-2.4 1-4.6 3.1-6.2-.4 2 .3 3.2 1.6 4.6C19 9.6 19 11.8 19 16.5c0 3.8-3 6.5-7 6.5z"></path></svg></span><span class="txt"><b>50% off trading fees</b> \\u2014 hold 250,000 LUMOS</span><a class="lx-fee-buy" href="lumoscore-lumos-token.html">Buy LUMOS</a></div>\';'
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
