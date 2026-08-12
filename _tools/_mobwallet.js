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
  // The shared activity renderer emits DESKTOP row markup, and at 375px .activity-info collapsed to
  // ~92px so the 'From G…' line wrapped and spilled out of the card. Let the middle column take the
  // slack and truncate, and stop the amount and the explorer link from being squeezed.
  + '.activity-block .activity-row{align-items:center;gap:10px}'
  + '.activity-block .activity-info{flex:1 1 auto;min-width:0}'
  // .type is itself a flex container, so white-space could never stop it wrapping — it was breaking
  // onto three lines and making every row 93px tall. Keep its children on one line and let the ticker
  // be the thing that truncates.
  + '.activity-block .activity-info .type{display:flex;flex-wrap:nowrap;align-items:center;gap:6px;min-width:0;white-space:nowrap;overflow:hidden}'
  + '.activity-block .activity-info .type>*{flex:0 0 auto}'
  + '.activity-block .activity-amt{min-width:0}'
  + '.activity-block .activity-info .meta{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}'
  + '.activity-block .activity-amt{flex:0 0 auto;text-align:right;white-space:nowrap}'
  + '.activity-block .lx-txlink{flex:0 0 auto;margin-left:8px}'
  + '.lxmw-empty{padding:18px 4px;text-align:center;color:var(--text-soft,#8a8fa3);'
  + 'font:600 13px/1.5 "Hanken Grotesk",system-ui,sans-serif}'
  + '.lxmw-row{display:flex;align-items:center;gap:11px;padding:13px 2px;border-bottom:1px solid var(--border)}'
  + '.lxmw-row:last-child{border-bottom:0}'
  + '.lxmw-ico{width:32px;height:32px;border-radius:50%;flex:0 0 auto;background:var(--surface-2,#222) center/cover no-repeat}'
  // Until a logo resolves, show the ticker's first letters on a colour derived from the code — the
  // same idea as the desktop table's data-l fallback. An empty grey disc reads as broken; a letter
  // disc reads as an asset without a logo, which is the truth.
  + '.lxmw-ico[data-l]::after{content:attr(data-l);position:absolute;inset:0;display:flex;'
  + 'align-items:center;justify-content:center;color:#fff;font:800 11px/1 "Hanken Grotesk",system-ui,sans-serif}'
  + '.lxmw-ico{position:relative;overflow:hidden}'
  + '.lxmw-ico.lxmw-hasico::after{display:none}'
  + '.lxmw-nm{font:800 14px/1.2 "Hanken Grotesk",system-ui,sans-serif}'
  + '.lxmw-sub{font:600 11.5px/1.3 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-soft,#8a8fa3);margin-top:3px}'
  + '.lxmw-amt{margin-left:auto;text-align:right}'
  + '.lxmw-amt .a{font:800 14px/1.2 "JetBrains Mono",ui-monospace,monospace}'
  + '.lxmw-amt .u{font:600 11.5px/1.3 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-soft,#8a8fa3);margin-top:3px}'
  // --- liquidity pool rows: overlapped pair icon, tappable row, per-row actions -----------------------
  // The row wraps so the actions sit on their own line: at 390px an icon pair + pair name + share figure
  // + three controls on ONE line squeezes the name to nothing.
  + '.lxmw-row.lxmw-lp{flex-wrap:wrap;align-items:center}'
  + '.lxmw-lplink{display:flex;align-items:center;gap:11px;flex:1 1 auto;min-width:0;color:inherit;text-decoration:none}'
  + '.lxmw-lpmeta{min-width:0}'
  + '.lxmw-lp .lxmw-nm,.lxmw-lp .lxmw-sub{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  // 46px box holds two 32px discs overlapping by 18px — the same shape as the desktop pair icon
  + '.lxmw-pair{position:relative;width:46px;height:32px;flex:0 0 auto}'
  + '.lxmw-pair .lxmw-ico{position:absolute;top:0;left:0}'
  + '.lxmw-pair .lxmw-ico:last-child{left:18px;box-shadow:0 0 0 2px var(--surface,#12121a)}'
  + '.lxmw-lpacts{display:flex;gap:8px;flex:1 0 100%;margin-top:11px}'
  + '.lxmw-lpbtn{flex:1;text-align:center;padding:8px 0;border-radius:9px;border:1px solid var(--border);'
  + 'background:var(--surface-2,#1a1a24);color:var(--text);text-decoration:none;'
  + 'font:700 12.5px/1 "Hanken Grotesk",system-ui,sans-serif}'
  + '.lxmw-lpbtn:active{border-color:var(--accent);color:var(--accent)}'
  + '.lxmw-lpbtn.ghost{color:var(--text-soft,#8a8fa3)}'
  // icon-only copy: fixed width so it never steals room from the three labelled actions
  + '.lxmw-lpbtn.icon{flex:0 0 42px;padding:0;display:inline-flex;align-items:center;justify-content:center;'
  + 'color:var(--text-soft,#8a8fa3);cursor:pointer}'
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
+ 'var HZ="https://horizon.stellar.org";'
// The wallet layer already resolved every logo it knows about; reuse that map rather than a second
// source of truth. XLM has its own published URI.
+ 'function logoFor(code,native){if(native||code==="XLM")return window.__lxStellarUri||"";'
+ 'return (window.__lxLogos||{})[code]||"";}'
// __lxHoldings carries balances but no valuation; __lxRows carries balance x price in XLM. Match on
// code+issuer so two assets sharing a ticker cannot be confused for one another.
+ 'function valueXlm(code,iss,native){var rows=window.__lxRows;if(!rows)return null;'
+ 'for(var i=0;i<rows.length;i++){var b=rows[i]&&rows[i].b;if(!b)continue;'
+ 'var nat=b.asset_type==="native";'
+ 'if(native||code==="XLM"){if(nat)return n(rows[i].xlm);continue;}'
+ 'if(b.asset_code===code&&(!iss||b.asset_issuer===iss))return n(rows[i].xlm);}'
+ 'return null;}'
// __lxLogos is a short curated map (9 entries), so every other asset fell through to a blank disc.
// The asset pages already resolve arbitrary logos from stellar.expert; do the same here, cache the
// answer in localStorage so a repeat visit is instant, and cap concurrency so 30-odd holdings do not
// arrive as one burst. A miss is remembered too — re-asking on every visit for an asset that has no
// TOML image would be pure waste.
+ 'var LOGOQ=[],LOGOBUSY=0,LOGOMEM={},LOGOPAUSE=0,LOGOFAILS=0;'
+ 'function lkey(code,iss){return "lumos.alogo2."+code+"-"+(iss||"");}'
+ 'function cachedLogo(code,iss){var k=lkey(code,iss);if(LOGOMEM[k]!==undefined)return LOGOMEM[k];'
+ 'try{var raw=localStorage.getItem(k);if(raw){var o=JSON.parse(raw);'
+ 'if(o&&(Date.now()-o.ts)<2592e6){LOGOMEM[k]=o.v||"";return LOGOMEM[k];}}}catch(_){}return undefined;}'
+ 'function storeLogo(code,iss,v){var k=lkey(code,iss);LOGOMEM[k]=v||"";'
+ 'try{localStorage.setItem(k,JSON.stringify({v:v||"",ts:Date.now()}));}catch(_){}}'
+ 'function pumpLogos(){if(Date.now()<LOGOPAUSE)return;while(LOGOBUSY<1&&LOGOQ.length){(function(job){LOGOBUSY++;'
+ 'fetch("https://api.stellar.expert/explorer/public/asset?search="+encodeURIComponent(job.code)+"&limit=20")'
+ '.then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(d){'
+ 'var recs=(d&&d._embedded&&d._embedded.records)||[];'
+ 'var want=job.code+"-"+job.iss;'
+ 'var m=recs.filter(function(x){return String(x.asset||"").indexOf(want)===0;})[0];'
+ 'var t=(m&&(m.tomlInfo||m.toml_info))||{};LOGOFAILS=0;storeLogo(job.code,job.iss,t.image||"");},'
+ 'function(){try{delete LOGOMEM[lkey(job.code,job.iss)+"|q"];}catch(_){}'
+ 'LOGOFAILS++;LOGOPAUSE=Date.now()+(LOGOFAILS>3?6e5:3e4);})'
+ '.then(function(){LOGOBUSY--;setTimeout(pumpLogos,120);setTimeout(pass,0);});})(LOGOQ.shift());}}'
+ 'function resolveLogo(code,iss,native){'
+ 'var known=logoFor(code,native);if(known)return known;'
+ 'if(native||!iss)return "";'
+ 'var c=cachedLogo(code,iss);if(c!==undefined)return c;'
+ 'return "";}'
+ 'function wantLogo(code,iss){var k=lkey(code,iss);if(LOGOMEM[k+"|q"])return;'
+ 'LOGOMEM[k+"|q"]=1;LOGOQ.push({code:code,iss:iss});pumpLogos();}'
+ 'function seeRows(){if(!("IntersectionObserver" in window))return;'
+ 'var io=window.__lxmwIO;if(!io){io=window.__lxmwIO=new IntersectionObserver(function(es){'
+ 'es.forEach(function(e){if(!e.isIntersecting)return;var el=e.target;'
+ 'var c=el.getAttribute("data-c"),i=el.getAttribute("data-i");'
+ 'if(c&&i)wantLogo(c,i);io.unobserve(el);});},{rootMargin:"300px 0px"});}'
+ 'qa("#assetList .lxmw-ico[data-c]").forEach(function(el){if(el.__lxmwObs)return;el.__lxmwObs=1;io.observe(el);});}'
+ 'function _unusedResolveTail(){'
+ 'return "";}'
+ 'function initials(code){return String(code||"?").replace(/[^A-Za-z0-9]/g,"").slice(0,2).toUpperCase();}'
+ 'function hueOf(code){var h=0,c=String(code||"");for(var i=0;i<c.length;i++)h=(h*31+c.charCodeAt(i))%360;return h;}'

+ 'function activeTab(){var b=qa(".asset-tabs button");for(var i=0;i<b.length;i++)if(b[i].classList.contains("active"))return i;return 0;}'

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
+ 'function fixAssets(){var list=q("#assetList");if(!list||activeTab()!==0)return;'
+ 'var hold=window.__lxHoldings;if(!hold||!hold.length)return;'
+ 'if(window.__lxRows&&window.__lxRows.length){var seen={};var pr=[];'
+ 'window.__lxRows.forEach(function(r){var b=r&&r.b;if(!b)return;var nat=b.asset_type==="native";'
+ 'var c=nat?"XLM":b.asset_code,i=nat?"":(b.asset_issuer||"");if(seen[c+i])return;seen[c+i]=1;'
+ 'pr.push({code:c,iss:i,bal:+b.balance,native:nat});});'
+ 'hold.forEach(function(h){if(h.native&&!seen["XLM"]){seen["XLM"]=1;pr.unshift(h);}});'
+ 'if(pr.length)hold=pr;}'
+ 'var u=rate();'
+ 'var sig="a|"+(window.__lxRows?"v":"n")+"|"+hold.map(function(h){'
+ 'return (h.code||"")+":"+(h.bal||h.balance||0)+":"+(resolveLogo(h.code,h.iss,h.native)?1:0);}).join("|");'
+ 'if(list.getAttribute("data-lxmw")===sig)return;list.setAttribute("data-lxmw",sig);'
+ 'var html="";'
+ 'hold.forEach(function(h){'
+ 'var code=h.code||(h.native?"XLM":"?");'
+ 'var bal=+(h.bal!=null?h.bal:(h.balance!=null?h.balance:0));'
+ 'var xlm=valueXlm(code,h.iss,h.native);if(xlm==null&&h.native)xlm=bal;'
// Only XLM has a price we hold here. For issued assets the wallet layer does not publish a per-asset
  // value, so the USD line stays blank rather than inventing one.
+ 'var v=(xlm!=null&&u)?xlm*u:null;'
+ 'var ico=h.logo||h.ico||resolveLogo(code,h.iss,h.native);'
+ 'html+=\'<div class="lxmw-row"><div class="lxmw-ico\'+(ico?" lxmw-hasico":"")+\'" data-lxc="\'+esc(code)+\'" data-c="\'+esc(code)+\'" data-i="\'+esc(h.iss||"")+\'" data-l="\'+esc(initials(code))+\'" style="\'+(ico?(\'background-image:url(\\\'\'+esc(ico)+\'\\\')\'):(\'background-color:hsl(\'+hueOf(code)+\',52%,38%)\'))+\'"></div>\''
+ '+\'<div><div class="lxmw-nm">\'+esc(code)+\'</div>\''
+ '+\'<div class="lxmw-sub">\'+esc(h.name||h.domain||"")+\'</div></div>\''
+ '+\'<div class="lxmw-amt"><div class="a">\'+esc(fmt(bal))+\'</div>\''
+ '+\'<div class="u">\'+(v==null?"":esc(usd(v)))+\'</div></div></div>\';});'
+ 'list.innerHTML=html;}'
// ---- liquidity pools -------------------------------------------------------------------------------
// The mobile page has ONE list container shared by both tabs and no pool panel of its own, so pool
// rows render into #assetList when the Liq Pools tab is selected. __lxLps gives the share balances;
// the pair and the reserves behind them need the pool itself, fetched once each and cached.
+ 'var POOLS={};'
+ 'function poolDetail(id,cb){if(POOLS[id]!==undefined){cb(POOLS[id]);return;}POOLS[id]=null;'
+ 'fetch(HZ+"/liquidity_pools/"+id).then(function(r){return r.ok?r.json():null;}).then(function(d){POOLS[id]=d||false;cb(POOLS[id]);})'
+ '.catch(function(){POOLS[id]=false;cb(false);});}'
+ 'function resCode(rv){var a=(rv&&rv.asset)||"";return a==="native"?"XLM":String(a).split(":")[0];}'
// The pool rows shipped with an EMPTY .lxmw-ico — no logo, no letter, so every position showed the same
// orange disc. The Assets tab two functions up already resolves a real logo per asset; a pool just needs
// it twice, overlapped, the way the desktop pair icon looks.
+ 'function resIss(rv){var p=String((rv&&rv.asset)||"").split(":");return p.length>1?p[1]:"";}'
+ 'function resNative(rv){return ((rv&&rv.asset)||"")==="native";}'
+ 'function lpIco(code,iss,native){var u=resolveLogo(code,iss,native);'
+ 'return \'<div class="lxmw-ico\'+(u?" lxmw-hasico":"")+\'" data-lxc="\'+esc(code)+\'" data-c="\'+esc(code)+\'" data-i="\'+esc(iss||"")+\'" data-l="\'+esc(initials(code))+\'" style="\'+(u?(\'background-image:url(\\\'\'+esc(u)+\'\\\')\'):(\'background-color:hsl(\'+hueOf(code)+\',52%,38%)\'))+\'"></div>\';}'
+ 'function fixPools(){var list=q("#assetList");if(!list||activeTab()!==1)return;'
+ 'var lps=window.__lxLps;if(!lps)return;'
+ 'var cnts=qa(".asset-tabs button .cnt");if(cnts[1])cnts[1].textContent=lps.length;'
+ 'if(!lps.length){if(list.getAttribute("data-lxmw")!=="p|0"){list.setAttribute("data-lxmw","p|0");'
+ 'list.innerHTML=\'<div class="lxmw-empty">No liquidity positions</div>\';}return;}'
+ 'var ready=lps.every(function(b){return POOLS[b.liquidity_pool_id]!==undefined;});'
+ 'if(!ready){lps.forEach(function(b){poolDetail(b.liquidity_pool_id,function(){});});}'
+ 'var sig="p|"+lps.map(function(b){return b.liquidity_pool_id+":"+b.balance+":"+(POOLS[b.liquidity_pool_id]?1:0);}).join("|");'
+ 'if(list.getAttribute("data-lxmw")===sig)return;list.setAttribute("data-lxmw",sig);'
+ 'var html="";'
+ 'lps.forEach(function(b){var d=POOLS[b.liquidity_pool_id];var shares=+b.balance||0;'
+ 'var pair="Pool "+String(b.liquidity_pool_id).slice(0,6)+"\\u2026",sub="loading\\u2026",amt="",icos="";'
+ 'var href="/pools/stellar/id/"+b.liquidity_pool_id;'
+ 'if(d){var rv=(d.reserves||[]);var c0=resCode(rv[0]),c1=resCode(rv[1]);'
+ 'icos=lpIco(c0,resIss(rv[0]),resNative(rv[0]))+lpIco(c1,resIss(rv[1]),resNative(rv[1]));'
+ 'pair=c0+" / "+c1;'
+ 'var tot=+d.total_shares||0;var frac=tot>0?(shares/tot):0;'
+ 'if(frac>0&&rv.length>1)sub=fmt((+rv[0].amount||0)*frac)+" "+c0+" + "+fmt((+rv[1].amount||0)*frac)+" "+c1;'
+ 'else sub=(tot>0?((frac*100).toFixed(4)+"% of pool"):"");'
+ 'amt=(frac*100).toFixed(4)+"%";}'
+ 'else if(d===false){sub="pool unavailable";}'
// The row was a plain <div>, so there was nothing to tap — the desktop table navigates on the pair cell
// and offers Add/Remove per row, and the phone had neither. Anchors rather than buttons on purpose: the
// tap bridge already turns a tap into a click on a[href], so these need no JS of their own, and Remove
// carries ?act=withdraw so the pool page opens on the Withdraw tab.
+ 'html+=\'<div class="lxmw-row lxmw-lp">\''
+ '+\'<a class="lxmw-lplink" href="\'+esc(href)+\'">\''
+ '+\'<div class="lxmw-pair">\'+(icos||\'<div class="lxmw-ico"></div>\')+\'</div>\''
+ '+\'<div class="lxmw-lpmeta"><div class="lxmw-nm">\'+esc(pair)+\'</div>\''
+ '+\'<div class="lxmw-sub">\'+esc(sub)+\'</div></div></a>\''
+ '+\'<div class="lxmw-amt"><div class="a">\'+esc(fmt(shares))+\'</div><div class="u">shares \'+esc(amt)+\'</div></div>\''
+ '+\'<div class="lxmw-lpacts">\''
+ '+\'<a class="lxmw-lpbtn" href="\'+esc(href)+\'">Add</a>\''
+ '+\'<a class="lxmw-lpbtn" href="\'+esc(href)+\'?act=withdraw">Remove</a>\''
+ '+\'<a class="lxmw-lpbtn ghost" href="\'+esc(href)+\'">Details</a>\''
// The desktop row's ... menu also offers "Copy pool address". Icon-only and fixed-width so the three
// labelled actions keep the rest of the line.
+ '+\'<button type="button" class="lxmw-lpbtn icon" data-lpcopy="\'+esc(b.liquidity_pool_id)+\'" aria-label="Copy pool address" title="Copy pool address">\''
+ '+\'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>\''
+ '+\'</div></div>\';});'
+ 'list.innerHTML=html;}'
// Copy the pool address. Delegated on DOCUMENT and registered once, because fixPools replaces the whole
// list with innerHTML on every data change — a listener bound to the button itself would not survive it.
+ 'function lpCopy(v){try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(v);return true;}}catch(_){}'
+ 'try{var ta=document.createElement("textarea");ta.value=v;ta.setAttribute("readonly","");ta.style.cssText="position:fixed;top:0;left:0;opacity:0";'
+ 'document.body.appendChild(ta);ta.select();ta.setSelectionRange(0,v.length);document.execCommand("copy");document.body.removeChild(ta);return true;}catch(_){return false;}}'
+ 'function wireLpCopy(){if(window.__lxmwCopy)return;window.__lxmwCopy=1;'
+ 'document.addEventListener("click",function(e){var t=e.target;if(!t||!t.closest)return;'
+ 'var b=t.closest("[data-lpcopy]");if(!b)return;'
+ 'e.preventDefault();e.stopPropagation();'
+ 'var id=b.getAttribute("data-lpcopy")||"";var ok=lpCopy(id);'
+ 'try{if(window.lxToast)window.lxToast(ok?"Pool address copied":"Could not copy");}catch(_){}'
+ '},true);}'
+ 'function wireTabs(){var b=qa(".asset-tabs button");if(!b.length||window.__lxmwTabs)return;window.__lxmwTabs=1;'
+ 'b.forEach(function(btn){btn.addEventListener("click",function(){setTimeout(pass,30);setTimeout(pass,260);});});}'

// ---- recent activity --------------------------------------------------------------------------------
// Desktop tints .activity-icon by operation type and paints the asset logo over it. The mobile rows
// shipped with no icon element at all, so there was nothing for the logo guard to heal either.
+ 'function actIcon(kind,code,native){'
+ 'var tint={Received:"#10b981",Sent:"#ef4444",Swapped:"#8b5cf6",Trustline:"#64748b",Order:"#ea6a2c",Liquidity:"#06b6d4"}[kind]||"#64748b";'
+ 'var lg=logoFor(code,native);'
+ 'var st="background-color:"+tint+"22;color:"+tint+";";'
+ 'if(lg)st+="background-image:url(\\x27"+lg+"\\x27);background-size:cover;background-position:50% 50%;";'
+ 'return \'<div class="lxmw-ico lxmw-actico" style="\'+st+\'"></div>\';}'
+ 'function fixActivity(){var block=q(".activity-block");if(!block)return;'
// _walletdata.js renders this same block — .activity-block is shared by both layouts — and its version
  // is richer: tinted type icons with the asset logo painted over them, day dividers, explorer links. But
  // it runs after the per-asset pricing, so on a phone the section sat empty for a long time. Ours is a
  // fast first paint that STANDS DOWN the moment the real one lands. .lxp is that renderer own ownership
  // marker (its CSS hides every un-marked node), so it is the honest test — the design mock also uses
  // .activity-row, which is why matching on the tag alone would never render anything.
+ 'if(q(".activity-row .lxp",block)||q(".day-divider.lxp",block))return;'
+ 'var ops=window.__lxOps;if(!ops)return;'
+ 'var sig=ops.length+":"+((ops[0]&&ops[0].id)||"");'
+ 'if(block.getAttribute("data-lxmw")===sig)return;block.setAttribute("data-lxmw",sig);'
+ 'if(!ops.length){block.innerHTML=\'<div class="lxmw-empty">No activity yet</div>\';return;}'
+ 'var me=addr(),html="";'
+ 'ops.slice(0,25).forEach(function(o){'
+ 'var lbl=o.type||"operation",sub="",amt="";'
+ 'var aCode=(o.asset_type==="native"||!o.asset_code)?"XLM":o.asset_code,aNat=(o.asset_type==="native");'
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
+ 'html+=\'<div class="lxmw-row">\'+actIcon(lbl,aCode,aNat)+\'<div><div class="lxmw-nm">\'+esc(lbl)+\'</div>\''
+ '+\'<div class="lxmw-sub">\'+esc(sub||when)+\'</div></div>\''
+ '+\'<div class="lxmw-amt"><div class="a">\'+esc(amt)+\'</div><div class="u">\'+esc(when)+\'</div></div></div>\';});'
+ 'block.innerHTML=html;}'
// ---- run --------------------------------------------------------------------------------------------
+ 'function pass(){try{fixHeader();fixOrders();wireTabs();wireLpCopy();fixAssets();fixPools();fixActivity();seeRows();'
+ 'if((window.__lxWalletEarly||window.__lxWalletReady)&&!document.body.classList.contains("lxmw-ready"))document.body.classList.add("lxmw-ready");'
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
