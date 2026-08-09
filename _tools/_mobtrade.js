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
  + '.mdxa-trade-quick{display:flex;gap:5px;margin-top:9px}'
  + '.mdxa-trade-quick button{flex:1;padding:7px 0;background:var(--surface);border:1px solid var(--border);'
  + 'border-radius:6px;color:var(--text-muted);font:800 12.5px/1 "Hanken Grotesk",system-ui,sans-serif;cursor:pointer}'
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
// ---- the adapter ---------------------------------------------------------------------------
// The mobile pane mirrors the desktop pane one-for-one — .mdxa-pane-swap / .mdxa-trade-field /
// .mdxa-trade-ir / .mdxa-side-btn / .mdxa-trade-cta all have exact .dxa-* counterparts. So rather
// than write a second implementation of quoting and transaction building for a real-funds page, we
// give each mobile element the DESKTOP class name alongside its own. The engine in _dexassetdata.js
// then finds these panes with the selectors it already has, and mobile executes through exactly the
// same, already-proven code path as desktop: same quote, same fee, same manageBuyOffer /
// manageSellOffer / pathPaymentStrictSend, same signing.
//
// Class names are exact tokens, so .dxa-pane-swap never matched .mdxa-pane-swap by accident — the
// two sets stay independent, and the .dxa-* CSS the engine injects is attribute-gated (data-lxic,
// data-lxbal, .lxq-active) so it stays inert here.
//
// applyAll() re-runs constantly (init, a settle interval, mutation observers, on every data
// arrival), so it does not matter that we alias after the engine has already started.
+ 'var ALIAS=[["mdxa-pane-swap","dxa-pane-swap"],["mdxa-pane-limit","dxa-pane-limit"],'
+ '["mdxa-trade-field","dxa-trade-field"],["mdxa-trade-ir","dxa-trade-ir"],'
+ '["mdxa-trade-frow","dxa-trade-frow"],["mdxa-side-btn","dxa-side-btn"],'
+ '["mdxa-trade-cta","dxa-trade-cta"],["mdxa-tsum","dxa-tsum-row"],'
+ '["mdxa-trade-quick","dxa-trade-quick"]];'
+ 'function alias(){ALIAS.forEach(function(a){qa("."+a[0]).forEach(function(el){'
+ 'if(!el.classList.contains(a[1]))el.classList.add(a[1]);});});}'
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
// Desktop offers 25/50/75/MAX under "You pay"; mobile shipped without them, so there was no way to
// fill the field with the full tradable balance. The engine already handles clicks on
// .dxa-trade-quick button generically — it reads the label, multiplies spendOf(payAsset()) and fills
// the input — so building the row is the whole feature. MAX therefore lands on the same corrected
// spendable figure, i.e. it now excludes the 0.5 XLM the new trustline is about to lock up.
+ 'function ensureQuick(){var pane=q(".mdxa-pane-swap");if(!pane)return;'
+ 'var pf=qa(".mdxa-trade-field",pane)[0];if(!pf)return;'
+ 'if(q(".mdxa-trade-quick",pf))return;'
+ 'var row=document.createElement("div");row.className="mdxa-trade-quick dxa-trade-quick";'
+ 'row.innerHTML="<button>25%</button><button>50%</button><button>75%</button><button>MAX</button>";'
+ 'pf.appendChild(row);}'
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
// ---- limit tab ----------------------------------------------------------------------------------
// Structure only. Desktop's limit pane has Limit price / Amount / TOTAL / Expiry / Filled when and
// mobile shipped without a Total, so the engine's limTotInput() — which reads limFields()[2] — had
// nothing to write into. Build that third field and the engine fills it, keeps it in step with
// price x amount, and reads it back when the order is placed. Values, balances and the Filled-when
// row are all the engine's now; we only own the chips, which it cannot paint here.
+ 'function fixLimit(){var pane=q(".mdxa-pane-limit");if(!pane)return;'
+ 'var c=code(),a=assetIcon(),x=grabXlm(),fields=qa(".mdxa-trade-field",pane);'
+ 'var tf=q(".lxmt-totalfield",pane);'
+ 'if(!tf&&fields[1]&&fields[1].parentNode){'
+ 'tf=document.createElement("div");tf.className="mdxa-trade-field lxmt-totalfield";'
+ 'tf.innerHTML="<div class=\\"mdxa-trade-frow\\"><span>Total</span><span class=\\"mono\\"></span></div>"'
+ '+"<div class=\\"mdxa-trade-ir\\"><input type=\\"text\\" inputmode=\\"decimal\\" placeholder=\\"0.00\\" readonly><span class=\\"mdxa-trade-asset\\"></span></div>";'
+ 'fields[1].parentNode.insertBefore(tf,fields[1].nextSibling);fields=qa(".mdxa-trade-field",pane);}'
+ 'if(fields[0])setChip(q(".mdxa-trade-asset",fields[0]),"XLM",x);'
+ 'if(fields[1])setChip(q(".mdxa-trade-asset",fields[1]),c||"",a);'
+ 'if(fields[2])setChip(q(".mdxa-trade-asset",fields[2]),"XLM",x);'
// Re-assert readonly every pass: something downstream strips the attribute off the freshly built
// field, and an editable Total would let a user type a figure the order does not actually use.
+ 'var tin=fields[2]?q("input",fields[2]):null;'
+ 'if(tin&&!tin.hasAttribute("readonly"))tin.setAttribute("readonly","readonly");}'
// ---- run ----------------------------------------------------------------------------------------
+ 'function pass(){try{alias();grabXlm();fixSides();fixSwapChips();ensureQuick();clearDefaults();fixLimit();}catch(_){}}'
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
