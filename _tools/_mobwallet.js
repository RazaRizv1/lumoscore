// Mobile wallet page: real data.
//
// _walletdata.js gated on #assetsTable, which only the DESKTOP wallet has, so the whole layer was
// absent on mobile and every figure on the page was the design's mock — including an Ethereum 0x…
// address presented as the user's Stellar account, a portfolio denominated in APT, three invented open
// orders and a fabricated activity feed. That gate now accepts the mobile page too, so the fetching and
// pricing run there; this transform renders the result into the mobile markup, which shares no class
// names with desktop and so cannot be reached by the aliasing trick used on the trade pane.
//
// Everything comes from the globals that layer publishes — __lxNative / __lxHoldings / __lxTotalXLM /
// __lxXlmUsd / __lxOffers / __lxOps — so the two layouts can never disagree about a balance.
//
// Usage: node _tools/_mobwallet.js [--write]
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const STYLE = '<style id="lx-mobwallet-css">'
  // Hide the mock until real data lands, so no one ever sees a foreign address or an invented order.
  + 'body:not(.lxmw-ready) .orders-stack,body:not(.lxmw-ready) .activity-block{visibility:hidden}'
  + '.lxmw-empty{padding:18px 4px;text-align:center;color:var(--text-soft,#8a8fa3);'
  + 'font:600 13px/1.5 "Hanken Grotesk",system-ui,sans-serif}'
  + '.lxmw-row{display:flex;align-items:center;gap:11px;padding:13px 2px;border-bottom:1px solid var(--border)}'
  + '.lxmw-row:last-child{border-bottom:0}'
  + '.lxmw-ico{width:32px;height:32px;border-radius:50%;flex:0 0 auto;background:var(--surface-2,#222) center/cover no-repeat}'
  + '.lxmw-nm{font:800 14px/1.2 "Hanken Grotesk",system-ui,sans-serif}'
  + '.lxmw-sub{font:600 11.5px/1.3 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-soft,#8a8fa3);margin-top:3px}'
  + '.lxmw-amt{margin-left:auto;text-align:right}'
  + '.lxmw-amt .a{font:800 14px/1.2 "JetBrains Mono",ui-monospace,monospace}'
  + '.lxmw-amt .u{font:600 11.5px/1.3 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-soft,#8a8fa3);margin-top:3px}'
  + '</style>';

const SCRIPT = '<script id="lx-mobwallet">(function(){'
+ 'if(window.__lxMobWallet)return;window.__lxMobWallet=1;'
+ 'var DASH="\\u2014";'
+ 'function q(s,r){return (r||document).querySelector(s);}'
+ 'function qa(s,r){return [].slice.call((r||document).querySelectorAll(s));}'
+ 'function n(v){return (typeof v==="number"&&isFinite(v))?v:null;}'
+ 'function esc(t){return String(t==null?"":t).replace(/[&<>"]/g,function(c){return c==="&"?"&amp;":c==="<"?"&lt;":c===">"?"&gt;":"&quot;";});}'
+ 'function fmt(v,d){if(v==null||!isFinite(+v))return DASH;var x=Math.abs(+v);'
+ 'return (+v).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:(d!=null?d:(x>=1000?2:(x>=1?4:7)))});}'
+ 'function usd(v){return v==null?DASH:"$"+(+v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});}'
+ 'function addr(){try{return localStorage.getItem("lumos.address")||"";}catch(_){return "";}}'
+ 'function trunc(a){a=String(a||"");return a.length>12?a.slice(0,6)+"\\u2026"+a.slice(-4):a;}'
+ 'function rate(){return n(window.__lxXlmUsd);}'
// ---- header: address + portfolio -----------------------------------------------------------------
// AUDIT (funds): the design baked an Ethereum address into both the visible chip and its copy button.
// On a Stellar wallet page that is not a cosmetic problem — someone could paste it as a destination.
+ 'function fixHeader(){var a=addr();'
+ 'var t=q(".wallet-chip .text")||q(".chip .text")||q(".wallet-address .text");'
+ 'if(t)t.textContent=a?trunc(a):DASH;'
+ 'qa(".copy-addr-btn,[data-copy]").forEach(function(b){var v=b.getAttribute("data-copy")||"";'
+ 'if(/^0x[0-9a-fA-F]{8,}$/.test(v)||(a&&b.className.indexOf("copy-addr")>=0))b.setAttribute("data-copy",a||"");});'
// portfolio total, in XLM with a USD line — the mock said "31,108.45 APT"
+ 'var pv=q(".portfolio-value");'
+ 'if(pv){var tot=n(window.__lxTotalXLM),u=rate();'
+ 'if(tot!=null){pv.innerHTML=esc(fmt(tot,2))+\'<span class="unit">XLM</span>\';'
+ 'var sub=q(".portfolio-sub")||q(".portfolio-usd");'
+ 'if(sub&&u)sub.textContent=usd(tot*u);}'
+ 'else if(!window.__lxWalletReady)pv.innerHTML=DASH+\'<span class="unit">XLM</span>\';}}'
// ---- open orders ----------------------------------------------------------------------------------
+ 'function fixOrders(){var stack=q(".orders-stack");if(!stack)return;'
+ 'var offs=window.__lxOffers;if(!offs)return;'
+ 'var cnt=q("#ordersCount");if(cnt)cnt.textContent=offs.length+" active";'
+ 'var cancelAll=q("#cancelAllBtn");if(cancelAll)cancelAll.style.display=offs.length?"":"none";'
+ 'if(!offs.length){stack.innerHTML=\'<div class="lxmw-empty">No open orders</div>\';return;}'
+ 'var sig=offs.map(function(o){return o.id;}).join(",");'
+ 'if(stack.getAttribute("data-lxmw")===sig)return;stack.setAttribute("data-lxmw",sig);'
+ 'var html="";'
+ 'offs.forEach(function(o){'
+ 'var s=o.selling||{},b=o.buying||{};'
+ 'var sc=s.asset_type==="native"?"XLM":(s.asset_code||"?");'
+ 'var bc=b.asset_type==="native"?"XLM":(b.asset_code||"?");'
+ 'var amt=+o.amount||0,pr=+o.price||0;'
+ 'html+=\'<div class="lxmw-row"><div><div class="lxmw-nm">Sell \'+esc(sc)+\' \\u2192 \'+esc(bc)+\'</div>\''
+ '+\'<div class="lxmw-sub">Price \'+esc(fmt(pr,7))+\' \'+esc(bc)+\' per \'+esc(sc)+\'</div></div>\''
+ '+\'<div class="lxmw-amt"><div class="a">\'+esc(fmt(amt))+\' \'+esc(sc)+\'</div>\''
+ '+\'<div class="u">\'+esc(fmt(amt*pr))+\' \'+esc(bc)+\'</div></div></div>\';});'
+ 'stack.innerHTML=html;}'
// ---- my assets -------------------------------------------------------------------------------------
+ 'function fixAssets(){var list=q("#assetList");if(!list)return;'
+ 'var hold=window.__lxHoldings;if(!hold||!hold.length)return;'
+ 'var u=rate();'
+ 'var sig=hold.map(function(h){return (h.code||"")+":"+(h.bal||h.balance||0);}).join("|");'
+ 'if(list.getAttribute("data-lxmw")===sig)return;list.setAttribute("data-lxmw",sig);'
+ 'var html="";'
+ 'hold.forEach(function(h){'
+ 'var code=h.code||(h.native?"XLM":"?");'
+ 'var bal=+(h.bal!=null?h.bal:(h.balance!=null?h.balance:0));'
+ 'var xlm=n(h.xlm);if(xlm==null&&h.native)xlm=bal;'
// Only XLM has a price we hold here. For issued assets the wallet layer does not publish a per-asset
  // value, so the USD line stays blank rather than inventing one.
+ 'var v=(xlm!=null&&u)?xlm*u:null;'
+ 'var ico=h.logo||h.ico||"";'
+ 'html+=\'<div class="lxmw-row"><div class="lxmw-ico"\'+(ico?\' style="background-image:url(\\\'\'+esc(ico)+\'\\\')"\':"")+\'></div>\''
+ '+\'<div><div class="lxmw-nm">\'+esc(code)+\'</div>\''
+ '+\'<div class="lxmw-sub">\'+esc(h.name||h.domain||"")+\'</div></div>\''
+ '+\'<div class="lxmw-amt"><div class="a">\'+esc(fmt(bal))+\'</div>\''
+ '+\'<div class="u">\'+(v==null?"":esc(usd(v)))+\'</div></div></div>\';});'
+ 'list.innerHTML=html;}'
// ---- recent activity --------------------------------------------------------------------------------
+ 'function fixActivity(){var block=q(".activity-block");if(!block)return;'
+ 'var ops=window.__lxOps;if(!ops)return;'
+ 'var sig=ops.length+":"+((ops[0]&&ops[0].id)||"");'
+ 'if(block.getAttribute("data-lxmw")===sig)return;block.setAttribute("data-lxmw",sig);'
+ 'if(!ops.length){block.innerHTML=\'<div class="lxmw-empty">No activity yet</div>\';return;}'
+ 'var me=addr(),html="";'
+ 'ops.slice(0,25).forEach(function(o){'
+ 'var lbl=o.type||"operation",sub="",amt="";'
+ 'if(o.type==="payment"){lbl=(o.to===me)?"Received":"Sent";'
+ 'amt=fmt(+o.amount)+" "+(o.asset_type==="native"?"XLM":(o.asset_code||""));'
+ 'sub=(o.to===me)?("from "+trunc(o.from)):("to "+trunc(o.to));}'
+ 'else if(o.type&&o.type.indexOf("path_payment")===0){lbl="Swapped";'
+ 'amt=fmt(+o.amount)+" "+(o.asset_type==="native"?"XLM":(o.asset_code||""));'
+ 'sub="via path payment";}'
+ 'else if(o.type==="change_trust"){lbl="Trustline";sub=(o.asset_code||"")+" "+((+o.limit===0)?"removed":"added");}'
+ 'else if(o.type==="create_account"){lbl="Account created";amt=fmt(+o.starting_balance)+" XLM";}'
+ 'else if(o.type&&o.type.indexOf("manage")===0&&o.type.indexOf("offer")>0){lbl="Order";'
+ 'sub=(+o.amount===0)?"cancelled":"placed";amt=(+o.amount?fmt(+o.amount):"");}'
+ 'else if(o.type&&o.type.indexOf("liquidity_pool")===0){lbl="Liquidity";sub=o.type.replace(/_/g," ");}'
+ 'var when=o.created_at?String(o.created_at).slice(0,10):"";'
+ 'html+=\'<div class="lxmw-row"><div><div class="lxmw-nm">\'+esc(lbl)+\'</div>\''
+ '+\'<div class="lxmw-sub">\'+esc(sub||when)+\'</div></div>\''
+ '+\'<div class="lxmw-amt"><div class="a">\'+esc(amt)+\'</div><div class="u">\'+esc(when)+\'</div></div></div>\';});'
+ 'block.innerHTML=html;}'
// ---- run --------------------------------------------------------------------------------------------
+ 'function pass(){try{fixHeader();fixOrders();fixAssets();fixActivity();'
+ 'if(window.__lxWalletReady&&!document.body.classList.contains("lxmw-ready"))document.body.classList.add("lxmw-ready");'
+ '}catch(_){}}'
+ 'if(document.readyState!=="loading")pass();else document.addEventListener("DOMContentLoaded",pass);'
+ 'setInterval(pass,900);'
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
      // mobile wallet only — identified by its own markup, not the filename
      if (h.indexOf('id="assetList"') < 0 || h.indexOf('orders-stack') < 0) continue;
      h = h.replace(/<style id="lx-mobwallet-css">[\s\S]*?<\/style>/g, '')
           .replace(/<script id="lx-mobwallet">[\s\S]*?<\/script>/g, '');
      if (h.indexOf('</head>') >= 0) h = h.replace('</head>', STYLE + '</head>');
      const bi = h.lastIndexOf('</body>'); if (bi < 0) continue;
      json[k] = h.slice(0, bi) + SCRIPT + h.slice(bi);
      changed = true; n++;
    }

    if (changed && process.argv.includes('--write')) {
      const ser = JSON.stringify(json).split('</').join('<' + B + '/');
      fs.writeFileSync(file, data.slice(0, s) + ser + data.slice(e), 'utf8');
    }
  }
}
console.log('mobile wallet renderer: ' + n + ' page keys'
  + (process.argv.includes('--write') ? '' : '  (dry run — pass --write)'));
