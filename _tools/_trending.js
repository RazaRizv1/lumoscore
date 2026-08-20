// "Trending on Stellar" dashboard section — real Stellar assets.
//  Roster + price + 7d price history + volume + logos from stellar.expert asset ranking (sort=volume7d).
//  24h/7d change+sparkline derived from the 8-point daily price7d; 30d fetched lazily per-asset from Horizon
//  trade_aggregations (real, XLM->USD). Overrides the design's mock renderTrending. Runs only when the
//  connected network is Stellar. Idempotent. Injects into the dashboard page (the one with #trendingList).
const fs=require('fs');const{read,getContents,VERIFIED,VTICK_SVG}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const CSS=`<style id="lx-trending-css">
#trendingList:not(.lx-tready) .trending-row{display:none!important}
/* Verified-issuer tick, identical to the one on Trade and Wallet — same 14px green disc, same 9px check,
   so the mark means one thing everywhere. Sits inside .nm-row, which is already a flex row, and is
   flex:0 0 so a long asset name can never squeeze it. */
.trending-row .lx-vtick{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;margin-left:5px;border-radius:50%;background:var(--green,#35c07f);color:#fff;vertical-align:-2px;flex:0 0 14px}
.trending-row .lx-vtick svg{width:9px;height:9px;display:block}
/* the site's global logo-painter clears an icon's background + inserts its own <img>; it can't touch a ::before
   pseudo-element, so we paint the real logo there via the --lxtic custom property (painter-proof, as on Pools/Trade) */
.trending-row .lx-tico{position:relative;width:40px;height:40px;border-radius:50%;flex-shrink:0;overflow:hidden;background:transparent}
.trending-row .lx-tico::before{content:"";position:absolute;inset:0;background:var(--lxtic,#20222c) center/cover no-repeat;border-radius:50%;z-index:2}
.trending-row .lx-tico[data-l]::after{content:attr(data-l);position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:16px;z-index:3}
.trending-row .lx-tico img{display:none!important}
/* The design styles .trade-btn on the desktop page only, so on a phone this row ended with a raw browser
   button — grey, square, 1.6px outset border. Restate the desktop rule (it is a no-op there) and step the
   type down on a narrow row, where a 16.5px/72px control crowds out the price. */
.trending-row .trade-btn{padding:8px 14px;border-radius:9px;border:1px solid var(--border,#26262c);background:transparent;color:var(--text,#f6f5f3);font-family:inherit;font-size:16.5px;font-weight:700;line-height:1.2;cursor:pointer;flex-shrink:0}
.trending-row .trade-btn:active{border-color:var(--accent,#ea6a2c);color:var(--accent,#ea6a2c)}
@media (max-width:560px){.trending-row .trade-btn{font-size:13.5px;padding:7px 11px;border-radius:8px}}
.lx-tskel-row{padding:14px 24px;display:flex;align-items:center;gap:16px;border-bottom:1px solid var(--border)}
.lx-tskel-row:last-child{border-bottom:none}
.lx-sk{background:linear-gradient(90deg,rgba(140,142,165,.10) 25%,rgba(140,142,165,.22) 37%,rgba(140,142,165,.10) 63%);background-size:400% 100%;animation:lxtsh 1.25s ease infinite;border-radius:6px}
@keyframes lxtsh{0%{background-position:100% 0}100%{background-position:-100% 0}}
.trending-row .trade-btn:hover{border-color:var(--accent,#ea6a2c)!important;color:var(--accent,#ea6a2c)!important}
/* The metric control, built to match the design's own period control (.tf-mini) rather than
   introducing a second visual language for the same kind of switch. */
.lx-metric{display:inline-flex;gap:3px;background:var(--surface-2);padding:3px;border-radius:9px;margin-right:8px}
.lx-metric button{padding:6px 11px;border:0;border-radius:6px;background:transparent;color:var(--text-muted);
  font:700 12.5px/1 inherit;font-family:inherit;cursor:pointer;white-space:nowrap}
.lx-metric button.active{background:var(--accent);color:#fff}
.lx-metric button:not(.active):hover{color:var(--text)}
@media(max-width:640px){
.lx-metric{margin:0 0 8px}
.lx-metric button{padding:6px 9px;font-size:11.5px}
}
</style>`;

const SCRIPT=`<script id="lx-trending">(function(){
if(window.__lxTrending)return;window.__lxTrending=1;
function net(){try{return (localStorage.getItem("lumos.network")||localStorage.getItem("lumos.chain")||"").toLowerCase();}catch(_){return "";}}
var nw=net();if(nw&&nw!=="stellar")return;
var SE="https://api.stellar.expert/explorer/public/asset";
var H="https://horizon.stellar.org";
// Verified issuers come from the one shared list in lib.js, keyed CODE|ISSUER — never on the ticker
// alone, because a ticker is not an identity on Stellar (there are hundreds of "USDC" issuers and only
// one of them is Circle's). Stamped in at build time so the row needs no extra request to draw it.
var VFD=${JSON.stringify(Object.keys(VERIFIED).reduce((m,k)=>(m[k]=1,m),{}))};
var VTICK='<span class="lx-vtick" title="Verified issuer">${VTICK_SVG}</span>';
function vtick(c,i){ return (c&&i&&VFD[c+"|"+i])?VTICK:""; }
var LOGOS={XLM:"assets/tokens/xlm.png",USDC:"assets/tokens/usdc.png",AQUA:"assets/tokens/aqua.png",EURC:"https://assets.coingecko.com/coins/images/26045/small/euro.png",yXLM:"https://assets.coingecko.com/coins/images/100/small/fmpFRHHQ_400x400.jpg",yUSDC:"assets/tokens/usdc.png",SHX:"assets/tokens/shx.png",BLND:"assets/tokens/blnd.svg",SSLX:"assets/tokens/sslx.png",LUMOS:"assets/favicon.png"};
var GRAD=["linear-gradient(135deg,#22d3ee,#0891b2)","linear-gradient(135deg,#35c07f,#16a34a)","linear-gradient(135deg,#ea6a2c,#ff9a3d)","linear-gradient(135deg,#a855f7,#6d28d9)","linear-gradient(135deg,#3aa0ff,#1d4ed8)","linear-gradient(135deg,#f5b301,#d97706)","linear-gradient(135deg,#e0447b,#be185d)","linear-gradient(135deg,#2dd4bf,#0d9488)"];
function grad(s){s=s||"?";var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return GRAD[h%GRAD.length];}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return c==="&"?"&amp;":c==="<"?"&lt;":c===">"?"&gt;":"&quot;";});}
function eu(s){return String(s==null?"":s).replace(/[\\x27()]/g,"");}
function fmtP(n){n=+n||0;if(n>=1)return "$"+n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});if(n>=0.01)return "$"+n.toFixed(4);if(n>0){var d=Math.min(8,Math.max(4,2-Math.floor(Math.log(n)/Math.LN10)));return "$"+n.toFixed(d).replace(/0+$/,"").replace(/\\.$/,"");}return "$0";}
function abbr(n){n=+n||0;var a=Math.abs(n);if(a>=1e9)return (n/1e9).toFixed(2)+"B";if(a>=1e6)return (n/1e6).toFixed(2)+"M";if(a>=1e3)return (n/1e3).toFixed(1)+"K";return String(Math.round(n));}
function pct(c){var a=Math.abs(c);return a>=100?String(Math.round(a)):a.toFixed(1);}
function tList(){return document.getElementById("trendingList");}
function spark(vals,up){var W=90,HH=32;if(!vals||vals.length<2)vals=[1,1.01];var mn=Math.min.apply(null,vals),mx=Math.max.apply(null,vals),rg=(mx-mn)||Math.abs(mx)||1,n=vals.length,p=[];for(var i=0;i<n;i++){var x=(i/(n-1))*(W-4)+2,y=HH-3-((vals[i]-mn)/rg)*(HH-6);p.push(x.toFixed(1)+","+y.toFixed(1));}return '<svg width="90" height="32" viewBox="0 0 90 32" fill="none" preserveAspectRatio="none"><polyline points="'+p.join(" ")+'" stroke="'+(up?"#35c07f":"#ff5b5b")+'" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';}
var _roster=null,_tf="24h",_r30=0;
// "trades" = Most Traded, "vol" = Highest Volume. Volume leads because stellar.expert hands it to us
// with the roster, so the first paint is instant; the trade counts need Horizon and arrive a moment
// later, at which point switching tabs is instant too.
var _metric="vol",_aggState=0;   // 0 none, 1 in flight, 2 done
function trOf(a,tf){var v=(tf==="30d")?a.tr30:(tf==="7d")?a.tr7:a.tr24;return v==null?null:v;}
// Once the daily buckets are in, the volume is measured rather than divided out of a 7d figure.
function volOf(a,tf){if(a.v24!=null){return (tf==="30d")?a.v30:(tf==="7d")?a.v7:a.v24;}return vol(a,tf);}
function mval(a){var v=(_metric==="trades")?trOf(a,_tf):volOf(a,_tf);return (v==null||v!==v)?-1:v;}
function ranked(){if(!_roster)return [];var r=_roster.slice();
  r.sort(function(x,y){return mval(y)-mval(x);});return r;}
function chg(a,tf){var p=(tf==="30d"&&a.p30&&a.p30.length>1)?a.p30:a.p7;if(!p||p.length<2)return 0;var last=p[p.length-1],ref=(tf==="24h")?p[p.length-2]:p[0];if(!(ref>0))return 0;return (last-ref)/ref*100;}
function vol(a,tf){if(tf==="30d")return (a.vol30!=null?a.vol30:a.vol7d*4.3);if(tf==="7d")return a.vol7d;return a.vol7d/7;}
function sdata(a,tf){return (tf==="30d"&&a.p30&&a.p30.length>1)?a.p30:a.p7;}
// The row's sub-line names the figure the list is ORDERED by, so the ranking is legible instead of
// being something the reader has to take on trust.
function metricLabel(a,tf){
  if(_metric==="trades"){var n=trOf(a,tf);return (n==null)?"Trades \\u2026":(abbr(n)+" trades");}
  var v=volOf(a,tf);return "Vol $"+abbr(v||0);
}
function skeleton(){var t=tList();if(!t)return;var s="";for(var i=0;i<8;i++){s+='<div class="lx-tskel-row"><div class="lx-sk" style="width:20px;height:16px"></div><div class="lx-sk" style="width:40px;height:40px;border-radius:50%"></div><div style="flex:1"><div class="lx-sk" style="width:120px;height:15px"></div><div class="lx-sk" style="width:180px;height:12px;margin-top:7px"></div></div><div class="lx-sk" style="width:90px;height:28px"></div><div style="text-align:right"><div class="lx-sk" style="width:70px;height:16px;margin-left:auto"></div><div class="lx-sk" style="width:54px;height:20px;margin:6px 0 0 auto"></div></div><div class="lx-sk" style="width:64px;height:34px;border-radius:9px"></div></div>';}t.innerHTML=s;t.classList.remove("lx-tready");}
function render(){var t=tList();if(!t||!_roster)return;var tf=_tf,html="";ranked().forEach(function(a,i){var c=chg(a,tf),up=c>=0,rank=i+1;var isNew=a.created>0&&(Date.now()/1000-a.created)<21*86400;var ico=a.logo?('<div class="lx-tico" style="--lxtic:url(\\x27'+eu(a.logo)+'\\x27)"></div>'):('<div class="lx-tico" style="--lxtic:'+grad(a.code)+'" data-l="'+esc(a.code.slice(0,1).toUpperCase())+'"></div>');
html+='<div class="trending-row" data-lxasset="'+esc(a.code+(a.iss?("-"+a.iss):""))+'">'
+'<div class="rank '+(rank<=3?"top":"")+'">#'+rank+'</div>'+ico
+'<div class="info"><div class="nm-row"><span class="nm">'+esc(a.code)+'</span>'+vtick(a.code,a.iss)+(isNew?'<span class="new-badge">NEW</span>':'')+'</div><div class="sub">'+esc(isNew?"Just launched":a.name)+' \\u00b7 Stellar \\u00b7 '+metricLabel(a,tf)+'</div></div>'
+'<div class="spark">'+spark(sdata(a,tf),up)+'</div>'
+'<div class="price"><div class="p1">'+fmtP(a.price)+'</div><div class="p2"><span class="change-pill '+(up?"up":"down")+'">'+(up?"\\u25b2":"\\u25bc")+' '+pct(c)+'%</span></div></div>'
+'<button class="trade-btn">Trade</button></div>';});
t.innerHTML=html;t.classList.add("lx-tready");}
// Daily buckets for every asset: trade_count and counter_volume per day, 30 days back. Everything the
// two tabs need for all three periods comes out of this one pass.
function ensureAgg(cb){
  if(_aggState===2){cb&&cb();return;}
  if(_aggState===1){return;}                        // already in flight; its own completion re-renders
  _aggState=1;
  fetch("https://api.binance.com/api/v3/klines?symbol=XLMUSDT&interval=1d&limit=32")
    .then(function(r){return r.ok?r.json():[];}).catch(function(){return [];})
    .then(function(k){
      var hist=(k||[]).map(function(c){return {t:+c[0],usd:+c[4]};});
      function xlmAt(t){if(!hist.length)return 0.17;var best=hist[0];for(var i=0;i<hist.length;i++){if(hist[i].t<=t)best=hist[i];else break;}return best.usd||0.17;}
      var res=86400000,end=Math.ceil(Date.now()/res)*res,start=end-31*res;
      function one(a){
        if(!a.iss)return Promise.resolve();
        var url=H+"/trade_aggregations?base_asset_type=credit_alphanum"+(a.code.length>4?"12":"4")
          +"&base_asset_code="+encodeURIComponent(a.code)+"&base_asset_issuer="+a.iss
          +"&counter_asset_type=native&resolution="+res+"&start_time="+start+"&end_time="+end+"&order=asc&limit=40";
        return fetch(url).then(function(r){return r.ok?r.json():null;}).then(function(j){
          var recs=(j&&j._embedded&&j._embedded.records)||[];
          if(!recs.length)return;
          // price history, converted at each day's own XLM/USD rather than today's
          var pr=recs.map(function(x){return (+x.avg||+x.close||0)*xlmAt(+x.timestamp);}).filter(function(v){return v>0;});
          if(pr.length>1)a.p30=pr;
          var n=recs.length;
          function sumT(from){var t=0;for(var i=Math.max(0,from);i<n;i++)t+=+recs[i].trade_count||0;return t;}
          function sumV(from){var t=0;for(var i=Math.max(0,from);i<n;i++)t+=(+recs[i].counter_volume||0)*xlmAt(+recs[i].timestamp);return t;}
          a.tr24=+recs[n-1].trade_count||0; a.tr7=sumT(n-7); a.tr30=sumT(0);
          a.v24=(+recs[n-1].counter_volume||0)*xlmAt(+recs[n-1].timestamp); a.v7=sumV(n-7); a.v30=sumV(0);
          a.vol30=a.v30;
        }).catch(function(){});
      }
      // waves of five: 25 assets is a quarter of Horizon's five-minute budget for this IP, and firing
      // them all at once is what turns that budget into a burst it refuses.
      var list=(_roster||[]).slice(),i=0;
      function wave(){
        if(i>=list.length)return Promise.resolve();
        var batch=list.slice(i,i+5);i+=5;
        return Promise.all(batch.map(one)).then(function(){ try{render();}catch(_){ } return wave(); });
      }
      return wave();
    })
    .then(function(){_aggState=2;_r30=1;cb&&cb();},function(){_aggState=2;_r30=1;cb&&cb();});
}
function ensure30d(cb){if(_r30){cb();return;}
// Horizon prices are in XLM; converting them with the CURRENT XLM/USD distorts history (e.g. a stablecoin would
// show a fake move). Fetch the daily XLM/USD 30d curve and convert each bucket at ITS OWN day's rate.
fetch("https://api.binance.com/api/v3/klines?symbol=XLMUSDT&interval=1d&limit=32").then(function(r){return r.ok?r.json():[];}).then(function(k){
var hist=(k||[]).map(function(c){return {t:+c[0],usd:+c[4]};});
function xlmAt(t){if(!hist.length)return 0.17;var best=hist[0];for(var i=0;i<hist.length;i++){if(hist[i].t<=t)best=hist[i];else break;}return best.usd||0.17;}
var res=86400000,end=Math.ceil(Date.now()/res)*res,start=end-31*res;
return Promise.all(_roster.map(function(a){if(a.code==="XLM"){a.p30=hist.map(function(h){return h.usd;});a.vol30=a.vol7d*4.3;return Promise.resolve();}if(!a.iss)return Promise.resolve();var url=H+"/trade_aggregations?base_asset_type=credit_alphanum"+(a.code.length>4?"12":"4")+"&base_asset_code="+encodeURIComponent(a.code)+"&base_asset_issuer="+a.iss+"&counter_asset_type=native&resolution="+res+"&start_time="+start+"&end_time="+end+"&order=asc&limit=40";
return fetch(url).then(function(r){return r.ok?r.json():null;}).then(function(j){var recs=(j&&j._embedded&&j._embedded.records)||[];if(recs.length<2)return;var pr=recs.map(function(x){return (+x.avg||+x.close||0)*xlmAt(+x.timestamp);}).filter(function(v){return v>0;});if(pr.length>1)a.p30=pr;a.vol30=recs.reduce(function(s,x){return s+(+x.counter_volume||0)*xlmAt(+x.timestamp);},0);}).catch(function(){});
}));
}).then(function(){_r30=1;cb();},function(){_r30=1;cb();});}
function setTab(tf){_tf=tf;var t=tList(),card=t?t.closest(".market-card"):null;if(card){var badge=card.querySelector(".market-head .badge");if(badge)badge.textContent="Past "+tf;}if(tf==="30d"&&!_r30){skeleton();ensure30d(function(){if(_tf==="30d")render();});}else{render();}}
// Two controls now: the metric (what the list is ranked by) and the period it is measured over. The
// period control is the design's own .tf-mini; the metric one is built to match it.
function wireMetric(){
  var t=tList();if(!t)return;var card=t.closest(".market-card");if(!card)return;
  if(card.querySelector(".lx-metric"))return;
  var mini=card.querySelector(".tf-mini");if(!mini)return;
  var box=document.createElement("div");box.className="lx-metric";
  // data-lxnonav is the design's own opt-out, and this control needs it: the dashboard maps clicked
  // LABEL TEXT to a destination, and "Most Traded" contains "Trade" -- so pressing it fired
  // lxNavigate([...dex-asset...]) and left the page instead of switching the ranking. The opt-out is
  // on the buttons as well as the box, because the handler reads from the element actually clicked.
  box.setAttribute("data-lxnonav","1");
  box.innerHTML='<button type="button" data-lxnonav="1" data-m="trades">Most Traded</button>'
              +'<button type="button" data-lxnonav="1" data-m="vol" class="active">Highest Volume</button>';
  mini.parentNode.insertBefore(box,mini);
  [].forEach.call(box.querySelectorAll("button"),function(b){
    b.addEventListener("click",function(e){
      // This card carries no data-lxnonav, so a click inside it reaches the dashboard's
      // card-navigation handler and leaves the page. A control is not a link to its own container.
      try{e.preventDefault();e.stopPropagation();}catch(_){ }
      var m=b.getAttribute("data-m");if(m===_metric)return;
      _metric=m;
      [].forEach.call(box.querySelectorAll("button"),function(x){x.classList.toggle("active",x===b);});
      // Most Traded cannot be answered from the roster alone -- the counts come from Horizon.
      if(_metric==="trades"&&_aggState!==2){skeleton();ensureAgg(function(){render();});}
      else render();
    });
  });
}
function wireTabs(){var t=tList();if(!t)return;var card=t.closest(".market-card");if(!card)return;var tabs=card.querySelectorAll(".tf-mini button");if(!tabs.length)return;var arr=[];[].forEach.call(tabs,function(b){var nb=b.cloneNode(true);b.parentNode.replaceChild(nb,b);arr.push(nb);});arr.forEach(function(nb){nb.addEventListener("click",function(){var lbl=(nb.textContent||"").trim();arr.forEach(function(x){x.classList.toggle("active",x===nb);});setTab(lbl.toLowerCase());});});}
function load(){skeleton();fetch(SE+"?sort=volume7d&order=desc&limit=80").then(function(r){return r.json();}).then(function(j){var recs=(j._embedded&&j._embedded.records)||[];var seen={},out=[];recs.forEach(function(x){var parts=(x.asset||"").split("-"),code=parts[0],iss=parts[1]||"";if(!code||seen[code])return;var toml=x.tomlInfo||x.toml_info||{};var logo=LOGOS[code]||toml.image||"";var rating=(x.rating&&x.rating.average)||0;
// quality gate: must have a real logo AND be a known/decently-rated asset AND a non-dust price -> drops spam like USDCAllow / $0 mint tokens
if(!logo||!(LOGOS[code]||rating>=6)||!(+x.price>=1e-7))return;
// XLM is the quote currency for every row here (prices and volume are denominated in it) and every
// row's Trade button opens a pair against it, so a native XLM row would mean swapping XLM for XLM.
// Any NON-native asset calling itself XLM is an impostor, so the code alone is enough to drop it.
if(code==="XLM")return;
seen[code]=1;
var nm=x.domain||toml.name||toml.orgName||code;if(nm.length>22)nm=nm.slice(0,21)+"\\u2026";
var p7=(x.price7d||[]).map(function(p){return +p[1];}).filter(function(v){return v>0;});
out.push({code:code,iss:iss,price:+x.price,p7:p7,vol7d:(+x.volume7d||0)/1e7,name:nm,logo:logo,created:+x.created||0});});if(!out.length)throw new Error("empty");
_roster=out.slice(0,25);
wireTabs();wireMetric();render();
// The daily buckets are NOT fetched here. They cost one Horizon request per asset -- 23-25 of them --
// and Horizon allows 100 per five minutes per IP, answering a breach with a 429 that carries no CORS
// header, so the browser reports only "Failed to fetch" and the numbers silently never arrive. Loading
// the dashboard should not spend a quarter of that budget on a tab the reader may never open, so the
// pass runs when Most Traded (or the 30d period) is actually selected.}).catch(function(){var t=tList();if(t&&!t.classList.contains("lx-tready"))setTimeout(load,8000);});}
(function(){if(window.__lxTrendNav)return;window.__lxTrendNav=1;window.addEventListener("click",function(e){var row=e.target&&e.target.closest?e.target.closest(".trending-row[data-lxasset]"):null;if(!row)return;e.preventDefault();e.stopImmediatePropagation();location.href="lumoscore-dex-asset.html?asset="+encodeURIComponent(row.getAttribute("data-lxasset"));},true);})();
if(document.readyState!=="loading")load();else document.addEventListener("DOMContentLoaded",load);
setInterval(function(){if(_tf!=="30d")load();},120000);
})();</script>`;

let n=0;
for(const dev of ['desktop','mobile']){
  const file=`lumoscore-aptos-${dev}.html`;
  let data; try{ data=read(file); }catch(e){ continue; }
  const {json,s,e}=getContents(data);
  for(const k of Object.keys(json)){
    let h=json[k];
    // Strip BEFORE the guard (landmine #11). A page that no longer hosts the trending list was skipped
    // outright, so an lx-trending script injected back when it did stayed in the container and kept
    // running with whatever VERIFIED list was current then. A skipped key is one this transform can
    // otherwise never clean, so removal happens first and unconditionally.
    const hadT=h.indexOf('<script id="lx-trending">')>=0;
    h=h.replace(/<style id="lx-trending-css">[\s\S]*?<\/style>/,'').replace(/<script id="lx-trending">[\s\S]*?<\/script>/,'');
    if(h.indexOf('trendingList')<0){            // dashboard page only
      if(hadT)json[k]=h;                        // but do persist the removal (the container is always written)
      continue;
    }
    // The container is the Aptos original, so this heading still read "Trending on Aptos" on a product
    // that is Stellar-only — on both layouts, and live. The rows underneath have always been Stellar
    // assets, which made it worse, not better.
    if(h.indexOf('Trending on Aptos')>=0) h=h.split('Trending on Aptos').join('Trending on Stellar');
    h=h.replace(/<style id="lx-trending-css">[\s\S]*?<\/style>/,'').replace(/<script id="lx-trending">[\s\S]*?<\/script>/,'');  // idempotent
    if(h.indexOf('</head>')>=0) h=h.replace('</head>',CSS+'</head>');
    const bi=h.lastIndexOf('</body>'); if(bi<0) continue;
    json[k]=h.slice(0,bi)+SCRIPT+h.slice(bi); n++;
  }
  const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
  fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
}
console.log('trending (real Stellar assets) injected on '+n+' dashboard page keys');
