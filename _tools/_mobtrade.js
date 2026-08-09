// Mobile Trade-asset pane: make it tell the truth.
//
// The mobile Swap/Limit panes are built from .mdxa-* markup that has no desktop counterpart, so the
// real trade engine in _dexassetdata.js — which is wired to .dxa-* selectors — never touches them.
// What shipped was the design's static mock, and it was convincing: on an AQUA page it read "Buy USDC",
// quoted 1 XLM = 0.23659 USDC against a market price of 4.22711 (the original Aptos demo number), and
// offered a 1,250 XLM balance for an account that may not even be connected. Worst of all the CTA was
// bound to `showToast(label + ' submitted')`, so tapping "Place Buy Order" reported a submitted order
// and did nothing whatsoever.
//
// This layer does NOT implement mobile trading. It makes the pane honest until that exists:
//   - every asset label and logo shows the asset actually being viewed, not USDC
//   - invented numbers (market price, balances, rate, price impact, min received) are replaced with the
//     real value when we have one and an em dash when we do not
//   - the fake "submitted" confirmation is intercepted and replaced with the truth
//
// Values come from the globals _dexassetdata.js publishes (__lxDXAcode / __lxDXAassetXlm /
// __lxDXAxlm / __lxDXAassetBal), so there is one source of truth per page.
//
// Usage: node _tools/_mobtrade.js [--write]
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const STYLE = '<style id="lx-mobtrade-css">'
  // The receive chip is rebuilt to mirror the pay chip (round logo + ticker), so it must stop being the
  // bare 24px square the earlier fix made it and size to its content again.
  + '.mdxa-trade-asset.lxmt-chip{width:auto !important;height:auto !important;min-width:0 !important;'
  + 'display:inline-flex;align-items:center;gap:7px;background:none !important;border-radius:7px}'
  // background-COLOR only — the shorthand would reset background-image and blank the logo set inline.
  + '.mdxa-trade-asset.lxmt-chip .mdxa-trade-ic{background-color:transparent !important}'
  + '.lxmt-code{font:700 12px/1 "Hanken Grotesk",system-ui,sans-serif;letter-spacing:.01em}'
  + '.lxmt-note{margin-top:8px;font:600 11.5px/1.45 "Hanken Grotesk",system-ui,sans-serif;'
  + 'color:var(--text-soft,#8a8fa3);text-align:center}'
  + '</style>';

const SCRIPT = '<script id="lx-mobtrade">(function(){'
+ 'if(window.__lxMobTrade)return;window.__lxMobTrade=1;'
+ 'var DASH="\\u2014";'
+ 'function q(s,r){return (r||document).querySelector(s);}'
+ 'function qa(s,r){return [].slice.call((r||document).querySelectorAll(s));}'
+ 'function code(){return window.__lxDXAcode||"";}'
// The header logo is already resolved (real image, toml image or generated avatar) — reuse it rather
// than re-deriving, so the trade pane can never disagree with the header.
+ 'function logoBg(){try{var l=q(".asset-logo");if(!l)return "";var b=getComputedStyle(l).backgroundImage;return (b&&b!=="none")?b:"";}catch(_){return "";}}'
+ 'function num(v){return (typeof v==="number"&&isFinite(v))?v:null;}'
+ 'function fmt(v,d){if(v==null)return DASH;var n=+v;if(!isFinite(n))return DASH;'
+ 'if(n!==0&&Math.abs(n)<0.0001)return n.toPrecision(4);'
+ 'return n.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:(d==null?7:d)});}'
// ---- side ---------------------------------------------------------------------------------------
+ 'function side(pane){var b=q(".mdxa-side-btn.active,.mdxa-tside.active,button.active",pane);'
+ 'var t=b?(b.textContent||"").trim().toLowerCase():"buy";return t.indexOf("sell")===0?"sell":"buy";}'
// ---- Buy/Sell labels ----------------------------------------------------------------------------
+ 'function fixSides(){var c=code();if(!c)return;'
+ 'qa(".mdxa-pane-swap button,.mdxa-pane .mdxa-side-btn").forEach(function(b){'
+ 'var t=(b.textContent||"").trim();var m=/^(Buy|Sell)\\s+(\\S+)$/.exec(t);'
+ 'if(m&&m[2]!==c)b.textContent=m[1]+" "+c;});'
+ 'qa(".mdxa-trade-cta").forEach(function(b){var t=(b.textContent||"").trim();'
+ 'var m=/^Place (Buy|Sell) Order$/.exec(t);if(m)b.setAttribute("data-lxmt-kind","swap");'
+ 'if(/^Place Limit Order$/.test(t))b.setAttribute("data-lxmt-kind","limit");});}'
// ---- the "You receive" chip: give it the same shape as "You pay" (logo + ticker) -----------------
+ 'function fixRecvChip(){var c=code();if(!c)return;'
+ 'var chip=q(".mdxa-pane-swap .mdxa-trade-asset[data-logo],.mdxa-pane-swap .mdxa-trade-asset.lxmt-chip");'
+ 'if(!chip)return;'
+ 'if(chip.getAttribute("data-lxmt")===c)return;'                    // already correct for this asset
+ 'chip.setAttribute("data-lxmt",c);chip.classList.add("lxmt-chip");'
+ 'chip.removeAttribute("data-logo");'                               // stop the 24px bare-square rule matching
+ 'chip.style.background="none";'
+ 'chip.innerHTML="";'
+ 'var ic=document.createElement("span");ic.className="mdxa-trade-ic";'
+ 'var bg=logoBg();if(bg)ic.style.backgroundImage=bg;'
+ 'ic.style.backgroundSize="cover";ic.style.backgroundPosition="50% 50%";ic.style.borderRadius="50%";'
+ 'var tx=document.createElement("span");tx.className="lxmt-code";tx.textContent=c;'
+ 'chip.appendChild(ic);chip.appendChild(tx);}'
// ---- balances -----------------------------------------------------------------------------------
// "Bal: 1,250 XLM" / "Avail: 1,250 XLM" were baked. Show the real figure once the wallet layer has it,
// otherwise a dash — never a number nobody owns.
+ 'function fixBalances(){'
+ 'var xlm=num(window.__lxDXAxlmFree);if(xlm==null)xlm=num(window.__lxDXAxlm);'
+ 'var ab=num(window.__lxDXAassetBal);var c=code();'
+ 'qa(".mdxa-pane .mdxa-trade-frow").forEach(function(row){'
+ 'var sp=row.querySelector(".mono");if(!sp)return;'
+ 'var txt=(sp.textContent||"").trim();var m=/^(Bal|Avail):/.exec(txt);if(!m)return;'
+ 'var pane=row.closest(".mdxa-pane");var isLimitAmt=pane&&pane.classList.contains("mdxa-pane-limit")&&/Amount/i.test((row.textContent||""));'
+ 'var sellSide=pane?side(pane)==="sell":false;'
// On the Limit tab the Amount is denominated in the ASSET when selling it, in XLM when buying with XLM.
+ 'var useAsset=isLimitAmt&&sellSide;'
+ 'var v=useAsset?ab:xlm,unit=useAsset?(c||""):"XLM";'
+ 'sp.textContent=m[1]+": "+(v==null?DASH:fmt(v,v>=1?2:7)+(unit?" "+unit:""));});}'
// ---- limit tab ----------------------------------------------------------------------------------
// "Mkt: 4.22711" is the original Aptos demo price and was identical on every asset.
+ 'function fixLimit(){var pane=q(".mdxa-pane-limit");if(!pane)return;var p=num(window.__lxDXAassetXlm);'
+ 'qa(".mdxa-trade-frow .mono",pane).forEach(function(sp){'
+ 'var t=(sp.textContent||"").trim();if(!/^Mkt:/.test(t))return;'
+ 'sp.textContent="Mkt: "+(p==null?DASH:fmt(p,7));});'
// the Amount field trades the ASSET, so its chip must not keep showing the Stellar mark
+ 'var c=code();if(c){var fields=qa(".mdxa-trade-field",pane);'
+ 'if(fields[1]){var chip=q(".mdxa-trade-asset",fields[1]);'
+ 'if(chip&&chip.getAttribute("data-lxmt")!==c){chip.setAttribute("data-lxmt",c);'
+ 'var bg=logoBg();if(bg){chip.style.backgroundImage=bg;chip.style.backgroundSize="cover";'
+ 'chip.style.backgroundPosition="50% 50%";chip.style.borderRadius="50%";}'
+ 'var ic=q(".mdxa-trade-ic",chip);if(ic&&bg){ic.style.backgroundImage=bg;ic.style.backgroundSize="cover";ic.innerHTML="";}}}}'
// The Limit price input ships prefilled with 4.18 — derived from the same Aptos demo price — and the
// "Filled when" row restates it, so both read as a real resting order. Keep the input synced to the
// live market until the user types (desktop prefills the same way), then leave their value alone.
+ 'var pin=q(".mdxa-trade-field input",pane);'
+ 'if(pin&&!pin.__lxmtTouched){'
+ 'if(!pin.__lxmtBound){pin.__lxmtBound=1;'
+ 'pin.addEventListener("input",function(){pin.__lxmtTouched=1;});'
+ 'pin.addEventListener("keydown",function(){pin.__lxmtTouched=1;});}'
+ 'var want=(p==null?"":String(+(+p).toFixed(7)));'
+ 'if(want&&pin.value!==want)pin.value=want;}'
+ 'var shown=pin?parseFloat(String(pin.value).replace(/[^0-9.]/g,"")):NaN;'
+ 'var op=side(pane)==="sell"?"\\u2265":"\\u2264";'
// Desktop states the pair, not a bare number: "APT/USDC <= 4.18". Match that shape.
+ 'qa(".mdxa-tsum",pane).forEach(function(row){var sps=row.querySelectorAll("span");if(sps.length<2)return;'
+ 'if(!/filled when/i.test((sps[0].textContent||"")))return;'
+ 'var v=sps[sps.length-1];'
+ 'v.textContent=isFinite(shown)&&shown>0?((c?c+"/XLM ":"")+op+" "+fmt(shown,7)):DASH;});'
// Desktop's limit pane has a Total field that mobile never had — the single real structural gap
// between the two. Add it as a summary row (mobile has no room for a fourth full field) and keep it
// in step with price x amount, with the USD estimate desktop also shows.
+ 'var amtIn=qa(".mdxa-trade-field input",pane)[1];'
+ 'var amt=amtIn?parseFloat(String(amtIn.value).replace(/[^0-9.]/g,"")):NaN;'
+ 'var sums=q(".mdxa-tsum",pane); var host=sums&&sums.parentNode;'
+ 'if(host){var tr=q(".lxmt-total",pane);'
+ 'if(!tr){tr=document.createElement("div");tr.className="mdxa-tsum lxmt-total";'
+ 'tr.innerHTML="<span>Total</span><span class=\\"mono\\"></span>";'
+ 'host.insertBefore(tr,sums);}'
+ 'var tv=tr.querySelector(".mono");'
+ 'if(isFinite(shown)&&shown>0&&isFinite(amt)&&amt>0){var tot=shown*amt;'
+ 'var u=num(window.__lxDXAxlmUsd);'
+ 'tv.textContent=fmt(tot,7)+" XLM"+(u?" \\u00b7 \\u2248 $"+fmt(tot*u,2):"");}'
+ 'else tv.textContent=DASH;}}'
// ---- swap summary: rate / price impact / min received --------------------------------------------
// These were computed by the mock from the mock price. Nothing here quotes, so they must not pretend.
+ 'function fixSummary(){var pane=q(".mdxa-pane-swap");if(!pane)return;'
+ 'qa(".mdxa-tsum",pane).forEach(function(row){var sps=row.querySelectorAll("span");if(sps.length<2)return;'
+ 'var lab=(sps[0].textContent||"").trim().toLowerCase();var val=sps[sps.length-1];'
+ 'if(lab.indexOf("rate")===0||lab.indexOf("price impact")===0||lab.indexOf("min received")===0){'
+ 'if(val.textContent.trim()!==DASH)val.textContent=DASH;}});'
// the receive amount is likewise a mock computation
+ 'var f=qa(".mdxa-trade-field",pane)[1];if(f){var inp=q("input",f);'
+ 'if(inp&&!inp.getAttribute("data-lxmt")){inp.setAttribute("data-lxmt","1");inp.value="";inp.placeholder=DASH;}'
+ 'var est=q(".mdxa-trade-frow .mono",f);if(est&&/^\\u2248/.test((est.textContent||"").trim()))est.textContent=DASH;}}'
// ---- the fake confirmation ----------------------------------------------------------------------
// The design binds every .mdxa-trade-cta to showToast(label + " submitted"). Claiming a submitted order
// is the most dangerous thing on this page, so claim it first and stop the design's listener running.
+ 'function guardCta(){if(window.__lxMobCta)return;window.__lxMobCta=1;'
+ 'window.addEventListener("click",function(e){var t=e.target;if(!t||!t.closest)return;'
+ 'var b=t.closest(".mdxa-trade-cta");if(!b)return;'
+ 'e.preventDefault();e.stopImmediatePropagation();'
+ 'var m="Trading from mobile is not available yet \\u2014 open this page on desktop to place an order.";'
+ 'try{ if(window.__lxDXAtoast)window.__lxDXAtoast(m,true); else if(window.showToast)window.showToast(m); else alert(m); }catch(_){}'
+ '},true);'
// a permanent line under the button, so the limitation is visible before anyone taps
+ 'qa(".mdxa-trade-cta").forEach(function(b){if(b.__lxmtNote)return;b.__lxmtNote=1;'
+ 'var n=document.createElement("div");n.className="lxmt-note";'
+ 'n.textContent="Order placement is desktop-only for now.";'
+ 'if(b.parentNode)b.parentNode.insertBefore(n,b.nextSibling);});}'
// ---- run ----------------------------------------------------------------------------------------
+ 'function pass(){try{fixSides();fixRecvChip();fixBalances();fixLimit();fixSummary();guardCta();}catch(_){}}'
// The design re-renders these panes on tab and side changes, so re-assert rather than run once.
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
      // mobile trade-asset pane only — identified by the markup itself, not the filename
      if (h.indexOf('mdxa-pane-swap') < 0) continue;
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
console.log('mobile trade pane honesty layer: ' + n + ' page keys'
  + (process.argv.includes('--write') ? '' : '  (dry run — pass --write)'));
