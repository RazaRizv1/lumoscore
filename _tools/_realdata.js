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
+'/* #15: the per-figure mark. flex:0 0 so a long value can never squeeze it out, and the pill becomes a   two-part row -- icon, then label over value -- rather than a single text column. */.lx-vpill{display:flex!important;align-items:center;gap:9px;min-width:0}.lx-vpt{display:flex;flex-direction:column;gap:2px;min-width:0}.lx-pico{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;  border-radius:8px;background:currentColor}.lx-pico svg{width:15px;height:15px;display:block;color:#fff;filter:drop-shadow(0 0 0 transparent)}/* The tinted square is the icon colour at low alpha, with the glyph itself full strength on top. */.lx-pico{background:color-mix(in srgb, currentColor 16%, transparent)}.lx-pico svg{color:currentColor}@media(max-width:900px){.lx-pico{width:22px;height:22px}.lx-pico svg{width:13px;height:13px}}.greeting-row>.greeting{flex:1 1 auto!important;min-width:0!important}.status-row{display:grid!important;grid-template-columns:auto repeat(4,minmax(0,1fr))!important;gap:10px!important;width:100%!important}.status-row .lx-netcard .lx-netmeta{padding-right:18px}.status-row .lx-vpill .val{font-size:18px!important;font-weight:800!important;letter-spacing:-.2px}.status-row .lx-vpill .lbl{font-size:10.5px!important;letter-spacing:.07em}@media(max-width:1100px){.status-row .lx-vpill .val{font-size:16px!important}}@media(max-width:900px){.status-row .lx-vpill .val{font-size:15px!important}.status-row .lx-vpill .lbl{font-size:9.5px!important}}.page>.market-grid:last-child{margin-bottom:0}.page:has(>.market-grid:last-child){padding-bottom:48px}/* lx-nstats-mobile: the five-column row above is a DESKTOP layout. On a phone it overflows - auto sizes to its content and every 1fr floors at min-content, so the last card runs off screen. Two columns fit, and min-width:0 lets the cards actually shrink into them. */@media (max-width:760px){.status-row{grid-template-columns:repeat(2,minmax(0,1fr))!important}.status-row>.status-pill{min-width:0!important;width:auto!important}.status-row>.status-pill.lx-netcard{grid-column:1 / -1}}.status-row .status-pill{width:auto!important}/* #6: the transaction link at the end of each platform-activity row. Icon only -- the row already says what happened, and a word here would compete with it. */.activity-feed-row .lx-actlink{margin-left:12px;flex:0 0 auto;display:inline-flex;align-items:center;color:var(--text-muted);text-decoration:none;transition:color .12s}.activity-feed-row .lx-actlink:hover{color:var(--accent)}'
+'/* item 7: the per-asset mark, inline with the code it names, sized to the text. */'
// item 28: the blinking dot. A heading that pulses is a permanent attention-grab for something that is
// simply true -- the feed is live whether or not a dot blinks -- and it sat oddly against a static title.
+'.live-pulse{display:none!important}'
// item 28: the marks were small enough to read as decoration. The identicon and the asset marks now
// share one size, so a row scans as [who or what] + [what happened] instead of two sizes of dot.
+'.lx-actident{flex:0 0 auto;vertical-align:-6px;margin-right:7px;box-shadow:0 0 0 1px rgba(127,127,140,.22)}'
+'.activity-feed-row .act-inl{width:20px!important;height:20px!important;vertical-align:-5px}'
+'.activity-feed-row .act-ic{width:40px!important;height:40px!important;border-radius:13px}'
// item 28: give the rows a little rhythm and a hover, so the list reads as a feed rather than a wall.
+'.activity-feed-row{padding-top:11px!important;padding-bottom:11px!important;transition:background .16s ease}'
+'.activity-feed-row:hover{background:rgba(127,127,140,.06)}'
+'.activity-feed-row .lx-actwho{display:inline-flex;align-items:center;font-variant-numeric:tabular-nums}'
+'.activity-feed-row .lx-actwho:hover{color:var(--accent,#ea6a2c)}'
+'/* The leading mark stays: hiding it on rows with an inline chip blanked nearly the whole feed. */'
+'.act-inl{display:inline-block;width:14px;height:14px;border-radius:50%;vertical-align:-2px;margin-right:5px;background-size:cover;background-position:center;background-repeat:no-repeat;background-color:rgba(127,127,140,.18);flex:0 0 auto}'
+'.activity-feed-row .info .type{overflow-wrap:anywhere}'
+'.status-row{opacity:0;animation:lxnsrev 0s linear 3s forwards}@keyframes lxnsrev{to{opacity:1}}.status-row.lx-ready{opacity:1!important;animation:none;transition:opacity .3s ease}'
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
+'"Assets":["#f7b733",\'<ellipse cx="14.8" cy="8.6" rx="4.4" ry="2.1"/><path d="M10.4 8.6v3.4c0 1.16 1.97 2.1 4.4 2.1s4.4-.94 4.4-2.1V8.6"/><ellipse cx="9.2" cy="14.4" rx="4.4" ry="2.1"/><path d="M4.8 14.4v3.4c0 1.16 1.97 2.1 4.4 2.1s4.4-.94 4.4-2.1v-3.4"/>\'],'
+'"Pools":["#38bdf8",\'<path d="M12 3.4l3.9 4.7a5.1 5.1 0 1 1-7.8 0z"/><ellipse cx="12" cy="17.6" rx="7.4" ry="2.5"/><path d="M8.6 15.9c.9.5 2.1.8 3.4.8s2.5-.3 3.4-.8"/>\'],'
+'"Trades":["#a855f7",\'<path d="M4.8 9.2h13.6M15.4 6.2l3 3-3 3"/><path d="M19.2 14.8H5.6M8.6 11.8l-3 3 3 3"/>\'],'
+'"Accounts":["#2dd4bf",\'<circle cx="12" cy="8.7" r="3.5"/><path d="M5.5 19.4a6.5 6.5 0 0 1 13 0"/>\']};'
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
+'+vpill("Trades",v.trades,v.dayTip)'
+'+vpill("Accounts",v.accounts,(v.accountsExact?v.accountsExact+" \\u2014 e":"E")+"very account ever funded on Stellar, a running total rather than a daily figure");while(frag.firstChild)row.appendChild(frag.firstChild);'
+'row.classList.add("lx-ready");}'
// ---- stat cards ----
+'var _lxX=null,_lxNS=null,_lxPS=null;'
+'function stats(){'
+'Promise.all([j("/lxapi/xlm").catch(function(){return null;}),j("/lxapi/netstats").catch(function(){return null;})])'
+'.then(function(res){if(res[0])_lxX=res[0];if(res[1])_lxNS=res[1];paintStats();}).catch(function(){});'
+'j("/lxapi/poolstats").catch(function(){return null;}).then(function(p){if(p){_lxPS=p;paintStats();}}).catch(function(){});'
+'}'
+'function paintStats(){var x=_lxX||{};var ns=_lxNS;var ps=_lxPS;'
+'var cg={usd:x.usd,usd_24h_change:x.chg24,usd_market_cap:x.mcap,usd_24h_vol:x.vol24};'
// Publish it: _dashtop.js needs the same price and 24h change, and CoinGecko's free tier is a few
// calls a minute -- two components each fetching the same object is how that budget gets spent.
+'try{window.__lxCG=cg;window.dispatchEvent(new CustomEvent("lx:cg"));}catch(_){}'
// #2: the strip used to be TVL, market cap and 24h volume -- three prices, none of which say anything
// about the chain a trader is about to trade on. These four do: how much there is to trade, where, how
// busy the place was yesterday, and how many accounts exist. All of them are ledger facts.
+'var _n=function(x){return (x==null||!isFinite(x))?"\\u2014":Math.round(x).toLocaleString("en-US");};'
// Past a million the digits stop being readable at a glance and start being counted; 2dp keeps it
// honest to ~0.05%. Below that, exact -- these are the figures people cross-check.
+'var _na=function(x){if(x==null||!isFinite(x))return "\\u2014";var a=Math.abs(x);'
+'if(a>=1e9)return (x/1e9).toFixed(2)+"B";if(a>=1e6)return (x/1e6).toFixed(2)+"M";return _n(x);};'
+'var _day="";try{if(ns&&ns.ts)_day="On "+new Date(ns.ts*1000).toLocaleDateString("en-US",{timeZone:"UTC",month:"short",day:"numeric"})+" (UTC), the last full day";}catch(_){}'

+'var _v={assets:(ns&&ns.assets)?_n(ns.assets):"\\u2014",'
+'pools:(ps&&ps.pools)?_n(ps.pools):"\\u2014",'
+'trades:(ns&&ns.trades)?_n(ns.trades):"\\u2014",'
+'accounts:(ns&&ns.accounts)?_na(ns.accounts):"\\u2014",'
// the exact total, for the tooltip
+'accountsExact:(ns&&ns.accounts)?_n(ns.accounts):"",'
+'dayTip:_day};'
+'var _old=null;try{_old=JSON.parse(localStorage.getItem("lumos.netstats")||"null");}catch(_){}'
+'if(_old&&!_old.length){for(var _k in _v){if(_v[_k]==="\\u2014"&&_old[_k]&&_old[_k]!=="\\u2014")_v[_k]=_old[_k];}}'
+'rebuildStats(_v);'
+'var _keep={};for(var _k2 in _v){if(_v[_k2]&&_v[_k2]!=="\\u2014")_keep[_k2]=_v[_k2];}'
+'try{localStorage.setItem("lumos.netstats",JSON.stringify(_keep));}catch(_){}'   // cache last real values so the next load shows them instantly (no blank/loading flash)
+'}'
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
+'return {ic:SWAP,cls:"swap",type:"Swap <b>"+amt(+o.source_amount)+" "+aic(acode(o,"source"),o.source_asset_issuer||"")+esc(acode(o,"source"))+"</b> \\u2192 "+amt(+o.amount)+" "+aic((o.asset_type==="native"||!o.asset_code)?"XLM":o.asset_code,o.asset_issuer||"")+esc((o.asset_type==="native"||!o.asset_code)?"XLM":o.asset_code),'
+'acode:acode(o,"source"),aiss:(o.source_asset_issuer||""),inl:1};'
+'if(o.type==="payment")'
+'return {ic:SWAP,cls:"swap",type:"Transfer <b>"+amt(+o.amount)+" "+aic((o.asset_type==="native"||!o.asset_code)?"XLM":o.asset_code,o.asset_issuer||"")+esc((o.asset_type==="native"||!o.asset_code)?"XLM":o.asset_code)+"</b>",inl:1};'
+'if(o.type&&o.type.indexOf("offer")>=0)'
+'return {ic:DROP,cls:"lp",type:"Order <b>"+amt(+o.amount)+" "+aic(acode(o,"selling"),o.selling_asset_issuer||"")+esc(acode(o,"selling"))+"</b> / "+aic(acode(o,"buying"),o.buying_asset_issuer||"")+esc(acode(o,"buying")),inl:1};'
+'if(o.type&&o.type.indexOf("liquidity_pool")===0)'
+'return {ic:DROP,cls:"lp",type:(o.type.indexOf("deposit")>=0?"Added liquidity":"Removed liquidity")};'
+'return {ic:SWAP,cls:"swap",type:esc(String(o.type||"Activity").split("_").join(" "))};}'
+'function iavatar(a,size){a=String(a||"");size=size||22;'
+'var palette=["#6f5ded","#ef4444","#22c55e","#a855f7","#06b6d4","#f59e0b","#ec4899","#84cc16","#ff894c","#0ea5e9","#14b8a6","#facc15"];'
+'var h=0;for(var i=0;i<a.length;i++){h=((h<<5)-h)+a.charCodeAt(i);h|=0;}'
+'function pick(i){return palette[Math.abs((h>>(i*3))%palette.length)];}'
+'var c1=pick(0),c2=pick(2),c3=pick(4),c4=pick(6),cell=size/5;'
+'var svg=\'<svg class="lx-actident" width="\'+size+\'" height="\'+size+\'" viewBox="0 0 \'+size+\' \'+size+\'" style="border-radius:50%;background:\'+c1+\'" xmlns="http://www.w3.org/2000/svg">\';'
+'for(var y=0;y<5;y++){for(var x=0;x<3;x++){var bit=(h>>((y*3+x)%30))&1;if(bit){var col=(x+y)%2===0?c2:c3;'
+'svg+=\'<rect x="\'+(x*cell).toFixed(2)+\'" y="\'+(y*cell).toFixed(2)+\'" width="\'+cell.toFixed(2)+\'" height="\'+cell.toFixed(2)+\'" fill="\'+col+\'"/>\';'
+'if(x<2)svg+=\'<rect x="\'+((4-x)*cell).toFixed(2)+\'" y="\'+(y*cell).toFixed(2)+\'" width="\'+cell.toFixed(2)+\'" height="\'+cell.toFixed(2)+\'" fill="\'+col+\'"/>\';}}}'
+'svg+=\'<circle cx="\'+(size/2)+\'" cy="\'+(size/2)+\'" r="\'+(cell*0.42).toFixed(2)+\'" fill="\'+c4+\'"/></svg>\';return svg;}'
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
+'var _fQ=[],_fA=0,_fAsked={};'
+'function _fPump(){while(_fA<4&&_fQ.length){_fA++;(_fQ.shift())();}}'
// Bounded to 4 in flight and asked once per code, so a feed that refreshes every 60s does not re-ask.
// LUMOS must be seeded before the fill runs. Its issuer's home_domain resolves to lumosdao.io -- a
// DIFFERENT project -- so asking the toml for it paints someone else's mark on our own token. The
// wallet page already seeds the brand flame for exactly this reason; the dashboard did not, and the
// /^assets// guard below only protects a seed that is already there.
+'try{(window.__lxLogos=window.__lxLogos||{});var _LK="LUMOS-GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S";if(!window.__lxLogos[_LK])window.__lxLogos[_LK]="assets/favicon.png";paintFeedIcons();}catch(_){}'
+'function feedFillLogos(){try{'
+'var els=[].slice.call(document.querySelectorAll("#activityList .lx-actasset"));'
+'var want={};els.forEach(function(e){var c=e.getAttribute("data-c")||e.getAttribute("data-lxc")||"";'
+'var i=e.getAttribute("data-i")||"";'
+'if(c&&i&&!_fAsked[c]&&!((window.__lxLogos||{})[c+"-"+i]))want[c]=i;});'
+'var codes=Object.keys(want); if(!codes.length)return;'
+'codes.forEach(function(c){_fAsked[c]=1;_fQ.push(function(){'
+'fetch("/lxapi/assetlogo?asset="+encodeURIComponent(c+"-"+want[c])).then(function(r){return r.ok?r.json():null;})'
+'.then(function(d){var u=d&&d.image;'
+'if(u&&!/^assets\\//.test(((window.__lxLogos||{})[c+"-"+want[c]])||"")){(window.__lxLogos=window.__lxLogos||{})[c+"-"+want[c]]=u;try{paintFeedIcons();}catch(_){}}'
+'},function(){}).then(function(){_fA--;_fPump();});});});'
+'_fPump();}catch(_){}}'
+'function paintFeedIcons(){'
+'try{var els=document.querySelectorAll(".lx-actasset");'
+'for(var i=0;i<els.length;i++){var e=els[i];'
+'if(e.getAttribute("data-lxpainted")==="1")continue;'
+'var u=feedLogo(e.getAttribute("data-c")||"",e.getAttribute("data-i")||"");'
+'if(u){e.style.backgroundImage="url(\'"+u+"\')";e.textContent="";e.setAttribute("data-lxpainted","1");}'
+'else if(!e.textContent){e.textContent=(e.getAttribute("data-l")||"");}}'
+'}catch(_){}}'
// item 7: one mark per asset, inline with the code it names.
+'function aic(code,iss){ code=String(code||""); if(!code)return "";'
+'return \'<span class="act-inl lx-actasset" data-lxc="\'+esc(code)+\'" data-c="\'+esc(code)+\'"'
+' data-i="\'+esc(iss||"")+\'" data-l=""></span>\'; }'
+'function feedRow(r){'
+'return \'<div class="activity-feed-row" data-lx-noswap="1">\''
+'+(\'<div class="act-ic \'+r.cls+\'">\'+r.ic+\'</div>\')'
+'+\'<div class="info"><div class="type">\'+r.type+\'</div>\''
+'+(r.who?(\'<a class="meta lx-actwho" href="/account/stellar/\'+esc(r.who)+\'" title="\'+esc(r.who)+\'">\'+iavatar(r.who,22)+esc(shortAddr(r.who))+\'</a>\'):\'<div class="meta"></div>\')'
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
+'list.innerHTML=rows.map(feedRow).join("");paintFeedIcons();feedFillLogos();'
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
+'list.innerHTML=rows.map(feedRow).join("");paintFeedIcons();feedFillLogos();'
+'[300,1200,3000,6000,10000].forEach(function(ms){setTimeout(paintFeedIcons,ms);});'
+'}).catch(function(){});});'
+'}).catch(function(){});}'
// A cache written by a previous build is an ARRAY, not this object, so the shape check is what stops a
// warm start restoring a strip of undefineds.
// The other way to get a strip of undefineds is for THIS list to fall behind the pills: prep() renders
// before the fetch lands, so any key rebuildStats reads that is missing here paints the literal string
// "undefined" until the network answers. That is why the key list lives in NSKEYS and is used both to
// build the placeholders and to restore them -- rename a pill, change it in one place.
+'var NSKEYS=["assets","pools","trades","accounts"];'
+'function prep(){var c=null;try{c=JSON.parse(localStorage.getItem("lumos.netstats")||"null");}catch(_){}'
+'var _d={dayTip:"",accountsExact:""};for(var i=0;i<NSKEYS.length;i++)_d[NSKEYS[i]]="\\u2026";'
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
