// Real on-chain data for the STELLAR dashboard (the network the user connected with).
//  - Network-stats cards: TVL (DefiLlama), Market cap + 24h Volume + XLM price (CoinGecko).
//    (Exact live "assets"/"pools" totals need 60+ paged Horizon calls, so those two cards are
//     repurposed to TVL + Market cap — real single-request network metrics.)
//  - Live activity feed: real recent swaps from Horizon /trades (orderbook + AMM pool), refreshed.
// All three sources are public + CORS-enabled. Runs ONLY when the connected network is Stellar;
// other networks keep their sample data until their APIs are wired. Idempotent.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const SWAP='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10l-3 3 3 3"/><path d="M4 13h11"/><path d="M17 14l3-3-3-3"/><path d="M20 11H9"/></svg>';
const DROP='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>';

// CSS goes in <head> so the "hide value pills until the script paints them" rule applies BEFORE first
// paint. When it was bundled with the script at body-end it loaded too late and the mock pills flashed.
const CSS='<style id="lx-realdata-css">'
+'/* B14: the wallet that performed the action, where "via LumosCore" used to repeat the section title.'
+'   Mono and muted, the same treatment every other address on the site gets. */'
+'.lx-actwho{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:12px;'
+'color:var(--text-soft,#8a8fa3);text-decoration:none;display:inline-block}'
+'.lx-actwho{display:inline-flex;align-items:center;gap:6px}'
+'.lx-actwho:hover{color:var(--accent,#ea6a2c)}'
+'.lx-actdot{width:13px;height:13px;border-radius:50%;flex:0 0 13px;display:inline-block}'
+'.act-ic.lx-actasset{background-size:cover;background-position:center;background-repeat:no-repeat;'
+'display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;'
+'color:var(--text-soft,#8a8fa3);overflow:hidden}'
+'/* #15: the per-figure mark. flex:0 0 so a long value can never squeeze it out, and the pill becomes a   two-part row -- icon, then label over value -- rather than a single text column. */.lx-vpill{display:flex!important;align-items:center;gap:9px;min-width:0}.lx-vpt{display:flex;flex-direction:column;gap:2px;min-width:0}.lx-pico{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;  border-radius:8px;background:currentColor}.lx-pico svg{width:15px;height:15px;display:block;color:#fff;filter:drop-shadow(0 0 0 transparent)}/* The tinted square is the icon colour at low alpha, with the glyph itself full strength on top. */.lx-pico{background:color-mix(in srgb, currentColor 16%, transparent)}.lx-pico svg{color:currentColor}@media(max-width:900px){.lx-pico{width:22px;height:22px}.lx-pico svg{width:13px;height:13px}}.greeting-row>.greeting{flex:1 1 auto!important;min-width:0!important}.status-row{display:grid!important;grid-template-columns:auto repeat(6,minmax(0,1fr))!important;gap:10px!important;width:100%!important}.status-row .lx-netcard .lx-netmeta{padding-right:18px}.status-row .lx-vpill .val{font-size:18px!important;font-weight:800!important;letter-spacing:-.2px}.status-row .lx-vpill .lbl{font-size:10.5px!important;letter-spacing:.07em}@media(max-width:1100px){.status-row .lx-vpill .val{font-size:16px!important}}@media(max-width:900px){.status-row .lx-vpill .val{font-size:15px!important}.status-row .lx-vpill .lbl{font-size:9.5px!important}}.page>.market-grid:last-child{margin-bottom:0}.page:has(>.market-grid:last-child){padding-bottom:48px}/* lx-nstats-mobile: the five-column row above is a DESKTOP layout. On a phone it overflows - auto sizes to its content and every 1fr floors at min-content, so the last card runs off screen. Two columns fit, and min-width:0 lets the cards actually shrink into them. */@media (max-width:760px){.status-row{grid-template-columns:repeat(2,minmax(0,1fr))!important}.status-row>.status-pill{min-width:0!important;width:auto!important}.status-row>.status-pill.lx-netcard{grid-column:1 / -1}}.status-row .status-pill{width:auto!important}/* #6: the transaction link at the end of each platform-activity row. Icon only -- the row already says what happened, and a word here would compete with it. */.activity-feed-row .lx-actlink{margin-left:12px;flex:0 0 auto;display:inline-flex;align-items:center;color:var(--text-muted);text-decoration:none;transition:color .12s}.activity-feed-row .lx-actlink:hover{color:var(--accent)}'
+'.status-row .status-pill:not(.lx-netcard){opacity:0;animation:lxnsrev 0s linear 3s forwards}@keyframes lxnsrev{to{opacity:1}}.status-row.lx-ready .status-pill:not(.lx-netcard){opacity:1!important;animation:none;transition:opacity .3s ease}'
+'</style>';
const SCRIPT='<script id="lx-realdata">(function(){'
+'if(window.__lxRealData)return;window.__lxRealData=1;'
+'function net(){try{return (localStorage.getItem("lumos.network")||localStorage.getItem("lumos.chain")||"").toLowerCase();}catch(_){return "";}}'
+'if(net()!=="stellar")return;'                        // Stellar-only for now
+'var SWAP=\''+SWAP+'\',DROP=\''+DROP+'\';'
+'function j(u){return fetch(u).then(function(r){if(!r.ok)throw new Error(r.status);return r.json();});}'
+'function abbr(n){n=+n||0;var a=Math.abs(n);if(a>=1e9)return (n/1e9).toFixed(2)+"B";if(a>=1e6)return (n/1e6).toFixed(2)+"M";if(a>=1e3)return (n/1e3).toFixed(1)+"K";return String(Math.round(n));}'
+'function usd(n){return "$"+abbr(n);}'
+'function amt(n){n=+n||0;var a=Math.abs(n);if(a>=1e9)return (n/1e9).toFixed(2)+"B";if(a>=1e6)return (n/1e6).toFixed(2)+"M";if(a>=1e3)return (n/1e3).toFixed(1)+"K";if(a>=1)return (Math.round(n*100)/100).toString();if(a>0){var s=n.toFixed(7).replace(/0+$/,"").replace(/\\.$/,"");return s&&s!=="0"?s:"<0.0000001";}return "0";}'   /* toFixed, NOT toPrecision — the feed showed "9e-7 TGM" (scientific notation) */
+'function price(n){n=+n||0;return "$"+(n<1?n.toFixed(4):n.toFixed(2));}'
+'function ago(t){var s=Math.max(0,(Date.now()-new Date(t).getTime())/1000);if(s<60)return Math.floor(s)+"s";if(s<3600)return Math.floor(s/60)+"m";if(s<86400)return Math.floor(s/3600)+"h";return Math.floor(s/86400)+"d";}'
+'function esc(s){return String(s==null?"":s).replace(/[&<>]/g,function(c){return c==="&"?"&amp;":c==="<"?"&lt;":"&gt;";});}'
// Rebuild the whole stats row atomically (keeps the network logo card, replaces the 4 value cards).
// This sidesteps the logo-painter (which mangles individual pills) and the re-skin entirely.
+'var PICO={'
+'"Assets":["#f7b733",\'<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.2h5M9.5 13.8h5"/>\'],'
+'"Pools":["#38bdf8",\'<path d="M12 3.2l5.2 5.6a7.2 7.2 0 1 1-10.4 0z"/>\'],'
+'"Pool TVL":["#22c55e",\'<rect x="5" y="10.5" width="14" height="9" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>\'],'
+'"Trades":["#a855f7",\'<path d="M7 9h11l-2.6-2.6M17 15H6l2.6 2.6"/>\'],'
+'"Transactions":["#fb7185",\'<rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 9h6M9 12.5h6M9 16h3.5"/>\'],'
+'"Active wallets":["#2dd4bf",\'<circle cx="12" cy="9" r="3.2"/><path d="M5.5 19a6.5 6.5 0 0 1 13 0"/>\']};'
+'function pico(lbl){var e=PICO[lbl];if(!e)return "";'
+'return \'<span class="lx-pico" style="color:\'+e[0]+\'" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">\'+e[1]+\'</svg></span>\';}'
+'function vpill(lbl,val,tip){return \'<span class="status-pill lx-vpill" data-lx-noswap=""\'+(tip?\' title="\'+tip+\'"\':"")+\'>\'+pico(lbl)+\'<span class="lx-vpt"><span class="lbl">\'+lbl+\'</span><span class="val">\'+val+\'</span></span></span>\';}'
+'function rebuildStats(v){var row=document.querySelector(".status-row");if(!row)return;var net=row.querySelector(".lx-netcard");'
// keep the LIVE netcard node (do NOT snapshot its HTML or mark the row noswap) so mc-engine can still
// rebrand it aptos->stellar; only the value pills are rebuilt (each is its own data-lx-noswap pill).
+'[].slice.call(row.querySelectorAll(".status-pill")).forEach(function(p){if(p!==net)p.parentNode.removeChild(p);});'
+'var frag=document.createElement("div");frag.innerHTML='
+'vpill("Assets",v.assets,"Every asset ever issued on Stellar")'
+'+vpill("Pools",v.pools,"Liquidity pools on the Stellar AMM")'
+'+vpill("Pool TVL",v.tvl,"Value locked across every Stellar liquidity pool")'
+'+vpill("Trades",v.trades,v.dayTip)'
+'+vpill("Transactions",v.txs,v.dayTip)'
+'+vpill("Active wallets",v.wallets,v.dayTip);while(frag.firstChild)row.appendChild(frag.firstChild);'
+'row.classList.add("lx-ready");}'
// ---- stat cards ----
+'function stats(){Promise.all(['
+'j("/lxapi/xlm").catch(function(){return null;}),'
+'j("/lxapi/netstats").catch(function(){return null;}),'
+'j("/lxapi/poolstats").catch(function(){return null;})'
+']).then(function(res){var x=res[0]||{};var ns=res[1];var ps=res[2];'
+'var cg={usd:x.usd,usd_24h_change:x.chg24,usd_market_cap:x.mcap,usd_24h_vol:x.vol24};'
// Publish it: _dashtop.js needs the same price and 24h change, and CoinGecko's free tier is a few
// calls a minute -- two components each fetching the same object is how that budget gets spent.
+'try{window.__lxCG=cg;window.dispatchEvent(new CustomEvent("lx:cg"));}catch(_){}'
// #2: the strip used to be TVL, market cap and 24h volume -- three prices, none of which say anything
// about the chain a trader is about to trade on. These six do: how much there is to trade, where, how
// deep it is, and how busy the place was yesterday. All of them are ledger facts.
+'var _n=function(x){return (x==null||!isFinite(x))?"\\u2014":Math.round(x).toLocaleString("en-US");};'
+'var _day="";try{if(ns&&ns.ts)_day="On "+new Date(ns.ts*1000).toLocaleDateString("en-US",{timeZone:"UTC",month:"short",day:"numeric"})+" (UTC), the last full day";}catch(_){}'
+'var _tvlx=(ps&&ps.tvlXlm>0)?ps.tvlXlm:0;'
// XLM/USD, only to put the pool TVL in dollars. Still published on window.__lxCG for _dashtop.js,
// which is why this call stays even though no pill shows a price any more.
+'var pr=+cg.usd||0;'

+'var _v={assets:(ns&&ns.assets)?_n(ns.assets):"\\u2014",'
+'pools:(ps&&ps.pools)?_n(ps.pools):"\\u2014",'
+'tvl:(_tvlx>0&&pr>0)?usd(_tvlx*pr):(_tvlx>0?abbr(_tvlx)+" XLM":"\\u2014"),'
+'trades:(ns&&ns.trades)?_n(ns.trades):"\\u2014",'
+'txs:(ns&&ns.transactions)?_n(ns.transactions):"\\u2014",'
+'wallets:(ns&&ns.activeWallets)?_n(ns.activeWallets):"\\u2014",'
+'dayTip:_day};'
+'var _old=null;try{_old=JSON.parse(localStorage.getItem("lumos.netstats")||"null");}catch(_){}'
+'if(_old&&!_old.length){for(var _k in _v){if(_v[_k]==="\\u2014"&&_old[_k]&&_old[_k]!=="\\u2014")_v[_k]=_old[_k];}}'
+'rebuildStats(_v);'
+'var _keep={};for(var _k2 in _v){if(_v[_k2]&&_v[_k2]!=="\\u2014")_keep[_k2]=_v[_k2];}'
+'try{localStorage.setItem("lumos.netstats",JSON.stringify(_keep));}catch(_){}'   // cache last real values so the next load shows them instantly (no blank/loading flash)
+'}).catch(function(){});}'
// ---- live activity feed (real swaps) ----
+'var LX_FEEACCT="GAMZFXIJD5E3PNRFCG6VPXCJNUOZAP5BY2P3MU3ZXXUSVM2UY5P6LJKD";'
+'var XPI=\'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>\';'
+'function acode(o,p){return (o[p+"_asset_type"]==="native"||!o[p+"_asset_code"])?"XLM":o[p+"_asset_code"];}'
// Describe the operation that earned the fee. A path payment IS the swap; an offer is an order; a
// plain payment is a transfer. Anything else is named by its own type rather than guessed at.
+'function describeOp(o){'
+'if(!o)return null;'
+'if(o.type&&o.type.indexOf("path_payment")===0)'
// The DESTINATION asset of a path payment has no field prefix -- it is asset_type/asset_code, not
// dest_asset_*. acode(o,"") builds o["_asset_type"], which is always undefined, so every swap printed
// its destination as XLM regardless of what was actually received.
+'return {ic:SWAP,cls:"swap",type:"Swap <b>"+amt(+o.source_amount)+" "+esc(acode(o,"source"))+"</b> \\u2192 "+amt(+o.amount)+" "+esc((o.asset_type==="native"||!o.asset_code)?"XLM":o.asset_code),'
+'acode:acode(o,"source"),aiss:(o.source_asset_issuer||"")};'
+'if(o.type==="payment")'
+'return {ic:SWAP,cls:"swap",type:"Transfer <b>"+amt(+o.amount)+" "+esc((o.asset_type==="native"||!o.asset_code)?"XLM":o.asset_code)+"</b>"};'
+'if(o.type&&o.type.indexOf("offer")>=0)'
+'return {ic:DROP,cls:"lp",type:"Order <b>"+amt(+o.amount)+" "+esc(acode(o,"selling"))+"</b> / "+esc(acode(o,"buying"))};'
+'if(o.type&&o.type.indexOf("liquidity_pool")===0)'
+'return {ic:DROP,cls:"lp",type:(o.type.indexOf("deposit")>=0?"Added liquidity":"Removed liquidity")};'
+'return {ic:SWAP,cls:"swap",type:esc(String(o.type||"Activity").split("_").join(" "))};}'
+'function idot(a){a=String(a||"");var h=0;for(var i=0;i<a.length;i++){h=(h*31+a.charCodeAt(i))>>>0;}'
+'var h1=h%360,h2=(h1+120)%360;'
+'return \'<span class="lx-actdot" style="background:linear-gradient(135deg,hsl(\'+h1+\',62%,55%),hsl(\'+h2+\',62%,45%))"></span>\';}'
+'function shortAddr(a){a=String(a||"");return a.length>12?(a.slice(0,4)+"\\u2026"+a.slice(-4)):a;}'
+'function feedLogo(code,iss){'
+'try{var L=window.__lxLogos||{};'
+'if(iss&&L[code+"-"+iss])return L[code+"-"+iss];'
// XLM has no issuer, and the registry keys it plainly.
+'if(code==="XLM")return (L.XLM||"/assets/tokens/xlm.png");'
// Fall back to a code-only match when the registry holds one, which it does for our own mints.
+'var ks=Object.keys(L);for(var i=0;i<ks.length;i++){if(ks[i].indexOf(code+"-")===0)return L[ks[i]];}'
+'}catch(_){}return "";}'
+'function paintFeedIcons(){'
+'try{var els=document.querySelectorAll(".lx-actasset");'
+'for(var i=0;i<els.length;i++){var e=els[i];'
+'if(e.getAttribute("data-lxpainted")==="1")continue;'
+'var u=feedLogo(e.getAttribute("data-c")||"",e.getAttribute("data-i")||"");'
+'if(u){e.style.backgroundImage="url(\'"+u+"\')";e.textContent="";e.setAttribute("data-lxpainted","1");}'
+'else if(!e.textContent){e.textContent=(e.getAttribute("data-l")||"");}}'
+'}catch(_){}}'
+'function feedRow(r){'
+'return \'<div class="activity-feed-row" data-lx-noswap="1">\''
+'+(r.acode?(\'<div class="act-ic lx-actasset" data-lxc="\'+esc(r.acode)+\'" data-c="\'+esc(r.acode)+\'" data-i="\'+esc(r.aiss||"")+\'" data-l="\'+esc(String(r.acode).slice(0,2))+\'"></div>\')'
+':(\'<div class="act-ic \'+r.cls+\'">\'+r.ic+\'</div>\'))'
+'+\'<div class="info"><div class="type">\'+r.type+\'</div>\''
+'+(r.who?(\'<a class="meta lx-actwho" href="/account/stellar/\'+esc(r.who)+\'" title="\'+esc(r.who)+\'">\'+idot(r.who)+esc(shortAddr(r.who))+\'</a>\'):\'<div class="meta"></div>\')'
+'+\'</div>\''
+'+\'<div class="time">\'+r.when+\'</div>\''
+'+\'<a class="lx-actlink" href="https://stellar.expert/explorer/public/tx/\'+esc(r.hash)+\'" target="_blank" rel="noopener" title="View transaction">\'+XPI+\'</a>\''
+'+\'</div>\';}'
+'function feed(){'
+'var list=document.getElementById("activityList");if(!list)return;'
+'j("https://horizon.stellar.org/accounts/"+LX_FEEACCT+"/payments?order=desc&limit=40").then(function(d){'
+'var recs=((d._embedded&&d._embedded.records)||[]).filter(function(o){'
// fees paid TO the collector, and never the collector shuffling its own balance
+'return o.to===LX_FEEACCT&&o.from&&o.from!==LX_FEEACCT;});'
+'if(!recs.length){list.innerHTML=\'<div class="activity-feed-row" style="justify-content:center;color:var(--text-soft);font-size:14px">No platform activity yet.</div>\';return;}'
+'var use=recs.slice(0,8);'
// Paint what we already know immediately, then upgrade each row once its transaction is read.
+'var rows=use.map(function(o){return {ic:SWAP,cls:"swap",type:"Platform activity",who:o.from,when:ago(o.created_at),hash:o.transaction_hash};});'
+'list.innerHTML=rows.map(feedRow).join("");paintFeedIcons();'
+'[300,1200,3000,6000,10000].forEach(function(ms){setTimeout(paintFeedIcons,ms);});'
+'use.forEach(function(o,i){'
+'j("https://horizon.stellar.org/transactions/"+o.transaction_hash+"/operations?limit=20").then(function(t){'
+'var ops=((t._embedded&&t._embedded.records)||[]).filter(function(x){'
// the fee payment itself is not the story; the operation beside it is
+'return !(x.type==="payment"&&x.to===LX_FEEACCT);});'
+'var pick=ops.filter(function(x){return x.type&&x.type.indexOf("path_payment")===0;})[0]'
+'||ops.filter(function(x){return x.type&&(x.type.indexOf("offer")>=0||x.type.indexOf("liquidity_pool")===0);})[0]'
+'||ops[0];'
+'var de=describeOp(pick); if(!de)return;'
+'rows[i].ic=de.ic;rows[i].cls=de.cls;rows[i].type=de.type;rows[i].acode=de.acode||"";rows[i].aiss=de.aiss||"";'
+'list.innerHTML=rows.map(feedRow).join("");paintFeedIcons();'
+'[300,1200,3000,6000,10000].forEach(function(ms){setTimeout(paintFeedIcons,ms);});'
+'}).catch(function(){});});'
+'}).catch(function(){});}'
// A cache written by the previous build holds FOUR entries and no trade count, so the length check is
// what stops a warm start restoring a strip with an empty cell in it.
// A cache written by a previous build is an ARRAY, not this object, so the shape check is what stops a
// warm start restoring a strip of undefineds.
+'function prep(){var c=null;try{c=JSON.parse(localStorage.getItem("lumos.netstats")||"null");}catch(_){}'
+'var _d={assets:"\\u2026",pools:"\\u2026",tvl:"\\u2026",trades:"\\u2026",txs:"\\u2026",wallets:"\\u2026",dayTip:""};'
+'if(c&&!c.length&&typeof c==="object"){for(var k in _d){if(c[k]&&c[k]!=="\\u2014")_d[k]=c[k];}}'
+'rebuildStats(_d);}'
+'function run(){prep();stats();feed();}'
+'if(document.readyState!=="loading")run();else document.addEventListener("DOMContentLoaded",run);'
+'setInterval(feed,60000);setInterval(stats,45000);'
+'})();</script>';

let n=0;
for(const dev of ['desktop','mobile']){
  const file=`lumoscore-aptos-${dev}.html`;
  let data; try{ data=read(file); }catch(e){ continue; }
  const {json,s,e}=getContents(data);
  for(const k of Object.keys(json)){
    let h=json[k];
    if(h.indexOf('activityList')<0 || h.indexOf('status-row')<0) continue;   // dashboard only
    h=h.replace(/<style id="lx-realdata-css">[\s\S]*?<\/style>/g,'').replace(/<script id="lx-realdata">[\s\S]*?<\/script>/g,'');  // idempotent
    if(h.indexOf('</head>')>=0) h=h.replace('</head>',CSS+'</head>');   // CSS in head -> applies before first paint (no flash)
    const bi=h.lastIndexOf('</body>'); if(bi<0) continue;
    json[k]=h.slice(0,bi)+SCRIPT+h.slice(bi); n++;
  }
  const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
  fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
}
console.log('real-data (Stellar) injected on '+n+' dashboard page keys');
