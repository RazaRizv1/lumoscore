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
const CSS='<style id="lx-realdata-css">.greeting-row>.greeting{flex:1 1 auto!important;min-width:0!important}.status-row{display:grid!important;grid-template-columns:auto 1fr 1fr 1fr 1fr!important;gap:10px!important;width:100%!important}/* lx-nstats-mobile: the five-column row above is a DESKTOP layout. On a phone it overflows - auto sizes to its content and every 1fr floors at min-content, so the last card runs off screen. Two columns fit, and min-width:0 lets the cards actually shrink into them. */@media (max-width:760px){.status-row{grid-template-columns:repeat(2,minmax(0,1fr))!important}.status-row>.status-pill{min-width:0!important;width:auto!important}.status-row>.status-pill.lx-netcard{grid-column:1 / -1}}.status-row .status-pill{width:auto!important}'
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
+'function vpill(lbl,val){return \'<span class="status-pill" data-lx-noswap=""><span class="lbl">\'+lbl+\'</span><span class="val">\'+val+\'</span></span>\';}'
+'function rebuildStats(tvl,mc,vol,pr){var row=document.querySelector(".status-row");if(!row)return;var net=row.querySelector(".lx-netcard");'
// keep the LIVE netcard node (do NOT snapshot its HTML or mark the row noswap) so mc-engine can still
// rebrand it aptos->stellar; only the value pills are rebuilt (each is its own data-lx-noswap pill).
+'[].slice.call(row.querySelectorAll(".status-pill")).forEach(function(p){if(p!==net)p.parentNode.removeChild(p);});'
+'var frag=document.createElement("div");frag.innerHTML=vpill("TVL",tvl)+vpill("Market cap",mc)+vpill("Volume",vol)+vpill("Stellar price",pr);while(frag.firstChild)row.appendChild(frag.firstChild);'
+'row.classList.add("lx-ready");}'
// ---- stat cards ----
+'function stats(){Promise.all(['
+'j("https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd&include_24hr_vol=true&include_market_cap=true&include_24hr_change=true"),'
+'j("https://api.llama.fi/v2/chains").catch(function(){return null;})'
+']).then(function(res){var cg=(res[0]&&res[0].stellar)||{};var chains=res[1];'
+'var pr=cg.usd,vol=cg.usd_24h_vol,mc=cg.usd_market_cap,tvl=null;'
+'if(chains&&chains.length){var s=chains.filter(function(c){return c.gecko_id==="stellar"||/^stellar$/i.test(c.name||"");})[0];if(s)tvl=s.tvl;}'
+'var _v=[tvl!=null?usd(tvl):"\\u2014",mc!=null?usd(mc):"\\u2014",(vol!=null&&pr)?abbr(vol/pr)+" XLM":"\\u2014",pr!=null?price(pr):"\\u2014"];'
+'rebuildStats(_v[0],_v[1],_v[2],_v[3]);'
+'try{localStorage.setItem("lumos.netstats",JSON.stringify(_v));}catch(_){}'   // cache last real values so the next load shows them instantly (no blank/loading flash)
+'}).catch(function(){});}'
// ---- live activity feed (real swaps) ----
+'function feed(){j("https://horizon.stellar.org/trades?order=desc&limit=18").then(function(d){'
+'var recs=(d._embedded&&d._embedded.records)||[];var list=document.getElementById("activityList");if(!list||!recs.length)return;'
+'var html="";recs.forEach(function(t){'
+'var b=esc(t.base_asset_code||"XLM"),c=esc(t.counter_asset_code||"XLM");'
+'var bAmt=+t.base_amount,cAmt=+t.counter_amount;'
+'var pool=(t.trade_type==="liquidity_pool");'
+'var ic=pool?DROP:SWAP,cls=pool?"lp":"swap",via=pool?"via AMM pool":"via Stellar DEX";'
+'html+=\'<div class="activity-feed-row" data-lx-noswap="1"><div class="act-ic \'+cls+\'">\'+ic+\'</div>\''
+'+\'<div class="info"><div class="type">Swap <b>\'+amt(cAmt)+\' \'+c+\'</b> \\u2192 \'+amt(bAmt)+\' \'+b+\'</div>\''
+'+\'<div class="meta">\'+via+\' \\u00b7 \'+b+\'/\'+c+\'</div></div>\''
+'+\'<div class="time">\'+ago(t.ledger_close_time)+\'</div></div>\';});'
+'list.innerHTML=html;'
+'}).catch(function(){});}'
+'function prep(){var c=null;try{c=JSON.parse(localStorage.getItem("lumos.netstats")||"null");}catch(_){}if(c&&c.length===4)rebuildStats(c[0],c[1],c[2],c[3]);else rebuildStats("\\u2026","\\u2026","\\u2026","\\u2026");}'
+'function run(){prep();stats();feed();}'
+'if(document.readyState!=="loading")run();else document.addEventListener("DOMContentLoaded",run);'
+'setInterval(feed,15000);setInterval(stats,45000);'
+'})();</script>';

let n=0;
for(const dev of ['desktop','mobile']){
  const file=`lumoscore-aptos-${dev}.html`;
  let data; try{ data=read(file); }catch(e){ continue; }
  const {json,s,e}=getContents(data);
  for(const k of Object.keys(json)){
    let h=json[k];
    if(h.indexOf('activityList')<0 || h.indexOf('status-row')<0) continue;   // dashboard only
    h=h.replace(/<style id="lx-realdata-css">[\s\S]*?<\/style>/,'').replace(/<script id="lx-realdata">[\s\S]*?<\/script>/,'');  // idempotent
    if(h.indexOf('</head>')>=0) h=h.replace('</head>',CSS+'</head>');   // CSS in head -> applies before first paint (no flash)
    const bi=h.lastIndexOf('</body>'); if(bi<0) continue;
    json[k]=h.slice(0,bi)+SCRIPT+h.slice(bi); n++;
  }
  const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
  fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
}
console.log('real-data (Stellar) injected on '+n+' dashboard page keys');
