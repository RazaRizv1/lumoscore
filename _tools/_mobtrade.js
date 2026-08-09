// Mobile Trade-asset pane: make it tell the truth, and do the arithmetic.
//
// The mobile Swap/Limit panes are .mdxa-* markup with no desktop counterpart, so the real trade engine
// in _dexassetdata.js — wired to .dxa-* selectors — never touched them. What shipped was the design's
// static mock: on an AQUA page it read "Buy USDC", quoted against a market price of 4.22711 (the
// original Aptos demo number, identical on every asset), offered a 1,250 XLM balance for an account
// that need not be connected, and bound the CTA to showToast(label + ' submitted') so tapping "Place
// Buy Order" reported a submitted order and did nothing.
//
// This layer still does NOT place orders. It makes the pane correct up to that point:
//   - both chips follow the Buy/Sell side (buy: pay XLM, receive CODE; sell: the reverse)
//   - "You receive" is computed from the live mid-market price, and Total on the Limit tab is a real
//     field rather than a summary line
//   - the design's baked amounts are cleared, matching desktop's resetWidget()
//   - anything we cannot compute shows an em dash instead of a mock number
//   - the fake "submitted" confirmation is intercepted and replaced with the truth
//
// Prices/balances come from the globals _dexassetdata.js publishes (__lxDXAcode, __lxDXAassetXlm,
// __lxDXAxlmUsd, __lxDXAxlm/xlmFree, __lxDXAassetBal), so there is one source of truth per page.
//
// Usage: node _tools/_mobtrade.js [--write]
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const STYLE = '<style id="lx-mobtrade-css">'
  // PAINTER-PROOF. Building the chip out of child nodes loses: the design repaints it and empties it
  // between our passes, so the logo and ticker vanish at random. Pseudo-elements cannot be removed by
  // an innerHTML wipe, and hiding real children means it does not matter what the design puts back.
  // The chip therefore carries only two things we set: --lxmt-logo and data-lxmt-code.
  + '.mdxa-trade-asset.lxmt-chip{width:auto !important;height:auto !important;min-width:0 !important;'
  + 'display:inline-flex !important;align-items:center;gap:7px;background:none !important;border-radius:7px;'
  + 'font-size:0 !important;color:transparent !important}'
  + '.mdxa-trade-asset.lxmt-chip>*{display:none !important}'
  + '.mdxa-trade-asset.lxmt-chip::before{content:"";display:block;width:24px;height:24px;border-radius:50%;'
  + 'flex:0 0 auto;background-image:var(--lxmt-logo,none);background-size:cover;background-position:50% 50%;'
  + 'background-repeat:no-repeat;background-color:rgba(255,255,255,.06)}'
  + '.mdxa-trade-asset.lxmt-chip::after{content:attr(data-lxmt-code);'
  + 'font:700 12px/1 "Hanken Grotesk",system-ui,sans-serif;color:var(--text);letter-spacing:.01em}'
  + '.lxmt-note{margin-top:8px;font:600 11.5px/1.45 "Hanken Grotesk",system-ui,sans-serif;'
  + 'color:var(--text-soft,#8a8fa3);text-align:center}'
  + '</style>';

const SCRIPT = '<script id="lx-mobtrade">(function(){'
+ 'if(window.__lxMobTrade)return;window.__lxMobTrade=1;'
+ 'var DASH="\\u2014",XLMICON=null;'
+ 'function q(s,r){return (r||document).querySelector(s);}'
+ 'function qa(s,r){return [].slice.call((r||document).querySelectorAll(s));}'
+ 'function code(){return window.__lxDXAcode||"";}'
+ 'function num(v){return (typeof v==="number"&&isFinite(v))?v:null;}'
+ 'function price(){return num(window.__lxDXAassetXlm);}'
+ 'function usdRate(){return num(window.__lxDXAxlmUsd);}'
+ 'function fmt(v,d){if(v==null)return DASH;var n=+v;if(!isFinite(n))return DASH;'
+ 'if(n!==0&&Math.abs(n)<0.0001)return n.toPrecision(4);'
+ 'return n.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:(d==null?7:d)});}'
// Amounts scale by orders of magnitude across assets — 297,796.3073258 LUMOS is unreadable and
// 0.0000034 BTC rounded to 2dp is zero. Pick the precision from the size of the number.
+ 'function amt(v){if(v==null||!isFinite(+v))return DASH;var n=Math.abs(+v);'
+ 'return fmt(v,n>=1000?2:(n>=1?4:7));}'
+ 'function money(v){return v==null?DASH:"$"+(+v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});}'
// The header logo is already resolved (real image, toml image or generated avatar). Read it EVERY pass,
// never cache it: it arrives asynchronously, and caching the first value is what left the receive chip
// showing a blank placeholder on assets whose logo resolved late.
+ 'function assetIcon(){try{var l=q(".asset-logo");if(!l)return "";var b=getComputedStyle(l).backgroundImage;return (b&&b!=="none")?b:"";}catch(_){return "";}}'
// The design paints XLM as an <img> inside the pay chip. Grab it once, before we rebuild anything.
+ 'function grabXlm(){if(XLMICON)return XLMICON;try{var img=q(".mdxa-pane .mdxa-trade-ic img");'
+ 'if(img&&img.src)XLMICON="url(\\""+img.src+"\\")";}catch(_){}return XLMICON;}'
+ 'function side(pane){var b=q(".mdxa-side-btn.active,button.active",pane);'
+ 'var t=b?(b.textContent||"").trim().toLowerCase():"buy";return t.indexOf("sell")===0?"sell":"buy";}'
// ---- chips --------------------------------------------------------------------------------------
// Keyed on code+logo, so a late-resolving logo re-renders instead of being locked in blank.
// Sets two properties and touches no children at all, so there is nothing for the design's repaint to
// destroy — and re-running it is free, which is what makes a late-arriving logo land.
+ 'function setChip(chip,c,bg){if(!chip)return;'
+ 'if(!chip.classList.contains("lxmt-chip"))chip.classList.add("lxmt-chip");'
+ 'if(chip.getAttribute("data-lxmt-code")!==c)chip.setAttribute("data-lxmt-code",c);'
+ 'if(chip.getAttribute("data-logo")!=null)chip.removeAttribute("data-logo");'
+ 'if(bg&&chip.style.getPropertyValue("--lxmt-logo")!==bg)chip.style.setProperty("--lxmt-logo",bg);}'
// Buying CODE spends XLM; selling CODE returns XLM. The mock kept XLM on the left either way.
+ 'function fixSwapChips(){var pane=q(".mdxa-pane-swap");if(!pane)return;var c=code();if(!c)return;'
+ 'var sell=side(pane)==="sell",a=assetIcon(),x=grabXlm();var chips=qa(".mdxa-trade-asset",pane);'
+ 'setChip(chips[0],sell?c:"XLM",sell?a:x);'
+ 'setChip(chips[1],sell?"XLM":c,sell?x:a);}'
+ 'function fixSides(){var c=code();if(!c)return;'
+ 'qa(".mdxa-pane-swap button,.mdxa-pane .mdxa-side-btn").forEach(function(b){'
+ 'var m=/^(Buy|Sell)\\s+(\\S+)$/.exec((b.textContent||"").trim());'
+ 'if(m&&m[2]!==c)b.textContent=m[1]+" "+c;});}'
// ---- clear the design amounts (desktop starts empty too — see resetWidget) -----------------------
+ 'function clearDefaults(){qa(".mdxa-pane .mdxa-trade-field input").forEach(function(i){'
+ 'if(i.__lxmtCleared)return;i.__lxmtCleared=1;'
+ 'if(i.hasAttribute("data-lxmt-keep"))return;'
+ 'if(String(i.value).trim()==="100"){i.value="";}'
+ 'if(!i.placeholder)i.placeholder="0.00";});}'
// ---- swap quote ---------------------------------------------------------------------------------
// Mid-market from the same price the header shows. It is an estimate, which is what the "≈" already
// says; price impact and min received stay dashed because nothing here routes an order.
+ 'function fixQuote(){var pane=q(".mdxa-pane-swap");if(!pane)return;'
+ 'var p=price(),c=code(),sell=side(pane)==="sell",u=usdRate();'
+ 'var ins=qa(".mdxa-trade-field input",pane),pin=ins[0],rin=ins[1];'
+ 'if(!pin)return;'
+ 'if(!pin.__lxmtBound){pin.__lxmtBound=1;pin.addEventListener("input",function(){setTimeout(fixQuote,0);});}'
+ 'var pay=parseFloat(String(pin.value).replace(/[^0-9.]/g,""));'
+ 'var out=null;if(p&&p>0&&isFinite(pay)&&pay>0)out=sell?pay*p:pay/p;'
+ 'if(rin){rin.setAttribute("readonly","readonly");rin.setAttribute("data-lxmt-keep","1");'
+ 'rin.value=out==null?"":amt(out);if(!rin.placeholder)rin.placeholder=DASH;}'
// the "≈ $x" line above the receive field
+ 'var f=qa(".mdxa-trade-field",pane)[1];'
+ 'if(f){var est=q(".mdxa-trade-frow .mono",f);'
+ 'if(est){var usd=(out!=null&&u)?(sell?out*u:out*p*u):null;est.textContent=usd==null?DASH:"\\u2248 "+money(usd);}}'
// Rate is knowable; the other two are not.
+ 'qa(".mdxa-tsum",pane).forEach(function(row){var sps=row.querySelectorAll("span");if(sps.length<2)return;'
+ 'var lab=(sps[0].textContent||"").trim().toLowerCase(),v=sps[sps.length-1];'
+ 'if(lab.indexOf("rate")===0){v.textContent=(p&&p>0&&c)?("1 "+c+" = "+fmt(p,7)+" XLM"):DASH;}'
+ 'else if(lab.indexOf("price impact")===0||lab.indexOf("min received")===0){if(v.textContent.trim()!==DASH)v.textContent=DASH;}});}'
// ---- balances -----------------------------------------------------------------------------------
+ 'function fixBalances(){var xlm=num(window.__lxDXAxlmFree);if(xlm==null)xlm=num(window.__lxDXAxlm);'
+ 'var ab=num(window.__lxDXAassetBal),c=code();'
+ 'qa(".mdxa-pane .mdxa-trade-frow").forEach(function(row){var sp=row.querySelector(".mono");if(!sp)return;'
+ 'var m=/^(Bal|Avail):/.exec((sp.textContent||"").trim());if(!m)return;'
+ 'var pane=row.closest(".mdxa-pane");'
+ 'var sell=pane?side(pane)==="sell":false;'
+ 'var isLimit=pane&&pane.classList.contains("mdxa-pane-limit");'
// Whichever asset is being SPENT is the balance that matters: XLM when buying, the asset when selling.
+ 'var useAsset=sell;var v=useAsset?ab:xlm,unit=useAsset?(c||""):"XLM";'
+ 'sp.textContent=m[1]+": "+(v==null?DASH:fmt(v,v>=1?2:7)+(unit?" "+unit:""));});}'
// ---- limit tab ----------------------------------------------------------------------------------
+ 'function fixLimit(){var pane=q(".mdxa-pane-limit");if(!pane)return;var p=price(),c=code(),u=usdRate();'
+ 'qa(".mdxa-trade-frow .mono",pane).forEach(function(sp){if(!/^Mkt:/.test((sp.textContent||"").trim()))return;'
+ 'sp.textContent="Mkt: "+(p==null?DASH:fmt(p,7));});'
+ 'var sell=side(pane)==="sell",a=assetIcon(),x=grabXlm();'
+ 'var fields=qa(".mdxa-trade-field",pane);'
// price is quoted in XLM per CODE; amount is denominated in CODE
+ 'if(fields[0])setChip(q(".mdxa-trade-asset",fields[0]),"XLM",x);'
+ 'if(fields[1])setChip(q(".mdxa-trade-asset",fields[1]),c||"",a);'
+ 'var pin=fields[0]?q("input",fields[0]):null;'
+ 'var ain=fields[1]?q("input",fields[1]):null;'
// keep the limit price on the market until the user types (desktop prefills the same way)
+ 'if(pin){if(!pin.__lxmtBound){pin.__lxmtBound=1;pin.setAttribute("data-lxmt-keep","1");'
+ 'pin.addEventListener("input",function(){pin.__lxmtTouched=1;setTimeout(fixLimit,0);});}'
+ 'if(!pin.__lxmtTouched){var want=(p==null?"":String(+(+p).toFixed(7)));if(want&&pin.value!==want)pin.value=want;}}'
+ 'if(ain&&!ain.__lxmtBound){ain.__lxmtBound=1;ain.addEventListener("input",function(){setTimeout(fixLimit,0);});}'
+ 'var pv=pin?parseFloat(String(pin.value).replace(/[^0-9.]/g,"")):NaN;'
+ 'var av=ain?parseFloat(String(ain.value).replace(/[^0-9.]/g,"")):NaN;'
// ---- Total: a real field, as on desktop (which has Limit price / Amount / Total / Expiry) --------
+ 'var tf=q(".lxmt-totalfield",pane);'
+ 'if(!tf&&fields[1]&&fields[1].parentNode){'
+ 'tf=document.createElement("div");tf.className="mdxa-trade-field lxmt-totalfield";'
+ 'tf.innerHTML="<div class=\\"mdxa-trade-frow\\"><span>Total</span><span class=\\"mono lxmt-totusd\\"></span></div>"'
+ '+"<div class=\\"mdxa-trade-ir\\"><input type=\\"text\\" inputmode=\\"decimal\\" placeholder=\\"0.00\\" data-lxmt-keep=\\"1\\"><span class=\\"mdxa-trade-asset\\"></span></div>";'
+ 'fields[1].parentNode.insertBefore(tf,fields[1].nextSibling);}'
+ 'if(tf){setChip(q(".mdxa-trade-asset",tf),"XLM",x);'
+ 'var tin=q("input",tf);'
+ 'if(tin&&!tin.__lxmtBound){tin.__lxmtBound=1;'
// Editable, and it drives Amount back the other way: Amount = Total / price.
+ 'tin.addEventListener("input",function(){tin.__lxmtTouched=1;'
+ 'var tv=parseFloat(String(tin.value).replace(/[^0-9.]/g,""));var pp=price();'
+ 'var pv2=pin?parseFloat(String(pin.value).replace(/[^0-9.]/g,"")):NaN;'
+ 'var use=isFinite(pv2)&&pv2>0?pv2:pp;'
+ 'if(ain&&isFinite(tv)&&tv>0&&use&&use>0)ain.value=amt(tv/use);'
+ 'setTimeout(function(){tin.__lxmtTouched=0;fixLimit();},0);});}'
+ 'if(tin&&!tin.__lxmtTouched){'
+ 'var tot=(isFinite(pv)&&pv>0&&isFinite(av)&&av>0)?pv*av:null;'
+ 'tin.value=tot==null?"":amt(tot);}'
+ 'var tu=q(".lxmt-totusd",tf);'
+ 'if(tu){var tvNow=parseFloat(String(tin?tin.value:"").replace(/[^0-9.]/g,""));'
+ 'tu.textContent=(isFinite(tvNow)&&tvNow>0&&u)?("\\u2248 "+money(tvNow*u)+" USD"):DASH;}}'
// desktop states the pair: "APT/USDC <= 4.18"
+ 'var op=sell?"\\u2265":"\\u2264";'
+ 'qa(".mdxa-tsum",pane).forEach(function(row){var sps=row.querySelectorAll("span");if(sps.length<2)return;'
+ 'if(!/filled when/i.test((sps[0].textContent||"")))return;var v=sps[sps.length-1];'
+ 'v.textContent=isFinite(pv)&&pv>0?((c?c+"/XLM ":"")+op+" "+fmt(pv,7)):DASH;});}'
// ---- the fake confirmation ----------------------------------------------------------------------
+ 'function guardCta(){if(window.__lxMobCta)return;window.__lxMobCta=1;'
+ 'window.addEventListener("click",function(e){var t=e.target;if(!t||!t.closest)return;'
+ 'if(!t.closest(".mdxa-trade-cta"))return;'
+ 'e.preventDefault();e.stopImmediatePropagation();'
+ 'var m="Trading from mobile is not available yet \\u2014 open this page on desktop to place an order.";'
+ 'try{ if(window.__lxDXAtoast)window.__lxDXAtoast(m,true); else if(window.showToast)window.showToast(m); else alert(m); }catch(_){}'
+ '},true);'
+ 'qa(".mdxa-trade-cta").forEach(function(b){if(b.__lxmtNote)return;b.__lxmtNote=1;'
+ 'var n=document.createElement("div");n.className="lxmt-note";'
+ 'n.textContent="Order placement is desktop-only for now.";'
+ 'if(b.parentNode)b.parentNode.insertBefore(n,b.nextSibling);});}'
// ---- run ----------------------------------------------------------------------------------------
+ 'function pass(){try{grabXlm();fixSides();fixSwapChips();clearDefaults();fixQuote();fixBalances();fixLimit();guardCta();}catch(_){}}'
+ 'if(document.readyState!=="loading")pass();else document.addEventListener("DOMContentLoaded",pass);'
+ 'setInterval(pass,900);'
+ 'window.addEventListener("click",function(){setTimeout(pass,60);},true);'
+ '})();</scr'+'ipt>';

let n = 0;
for (const chain of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain', 'stellar', 'xrpl']) {
  for (const dev of ['desktop', 'mobile']) {
    const file = `lumoscore-${chain}-${dev}.html`;
    let data; try { data = read(file); } catch (e) { continue; }
    const { json, s, e } = getContents(data);
    let changed = false;

    for (const k of Object.keys(json)) {
      let h = json[k];
      if (h.indexOf('mdxa-pane-swap') < 0) continue;      // mobile trade pane only
      h = h.replace(/<style id="lx-mobtrade-css">[\s\S]*?<\/style>/g, '')
           .replace(/<script id="lx-mobtrade">[\s\S]*?<\/script>/g, '');
      const bi = h.lastIndexOf('</body>'); if (bi < 0) continue;
      json[k] = h.slice(0, bi) + STYLE + SCRIPT + h.slice(bi);
      changed = true; n++;
    }

    if (changed && process.argv.includes('--write')) {
      const ser = JSON.stringify(json).split('</').join('<' + B + '/');
      fs.writeFileSync(file, data.slice(0, s) + ser + data.slice(e), 'utf8');
    }
  }
}
console.log('mobile trade pane layer: ' + n + ' page keys'
  + (process.argv.includes('--write') ? '' : '  (dry run — pass --write)'));
