// Asset Overview page real-data layer — TESTNET, READ-ONLY.
// Parameterized by ?asset=CODE-ISSUER (falls back to the last Launchpad mint, then a seed token).
// Fills identity, price, stat cards, about, top pools, top holders, recent trades with real
// Stellar TESTNET data. Community Discussion + human holder labels stay as design placeholders.
// The design builds these sections with its own JS, so we hold our content and re-assert via a
// MutationObserver (same defense as the rewards/wallet layers). Content is hidden until first paint.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const KEYS = ['lumoscore-asset-overview.html', 'lumoscore-asset-overview-dark.html', 'lumoscore-asset-overview-mobile.html'];

const STYLE = `<style id="lx-ao-css">
html:not(.lx-aoready) .ov-hero, html:not(.lx-aoready) .ov-card{visibility:hidden}
/* AUDIT (flash sweep): the gate covered .ov-hero and .ov-card but NOT the .ov-stats strip, so "2.6M APT",
   "+8.4% past 24h", "12,408" and "+184 this week" all painted before the real Horizon numbers arrived.
   Same lx-aoready flag, which already has a 6s safety reveal, so a dead fetch still shows the page. */
html:not(.lx-aoready) .ov-stats .ov-stat .v,
html:not(.lx-aoready) .ov-stats .ov-stat .v-sub,
html:not(.lx-aoready) .ov-stats .ov-stat .delta{visibility:hidden}
.ov-ico.lx-aoico{display:grid;place-items:center;color:#fff;font-weight:800;font-family:'JetBrains Mono',monospace}
.ov-change-cell.lx-aoflat .ov-change-pill{color:var(--text-soft)!important;background:var(--surface-2)!important}
.lx-aonolog, .lx-aonolog *{background-image:none!important}
.ov-tag.lx-aonolog{padding:5px 11px}
.ov-trade-side{font-weight:800;font-size:11px;letter-spacing:.03em}
.ov-trade-side.buy{color:#16a34a}
.ov-trade-side.sell{color:#e5484d}
.ov-trade-side.swap{color:var(--accent)}
.ov-change-cell.lx-aoempty{display:flex;flex-direction:column;justify-content:center;gap:7px}
.ov-change-cell.lx-aoempty::before{content:attr(data-lbl);font-size:11px;color:var(--text-soft)}
.ov-change-cell.lx-aoempty::after{content:"—";color:var(--text-soft);font-weight:700;font-size:13px}
.ov-cta-row{gap:12px}
.ov-cta{padding:12px 15px!important;border-radius:12px!important;min-height:0!important;height:auto!important;gap:11px!important;box-shadow:none!important;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}
.ov-cta:hover{transform:translateY(-2px);box-shadow:0 10px 24px -14px var(--accent-soft)}
.ov-cta .ov-cta-ico{width:34px!important;height:34px!important;border-radius:9px!important;flex:0 0 34px!important}
.ov-cta .ov-cta-ico svg{width:17px!important;height:17px!important}
.ov-cta .ov-cta-title{font-size:14.5px!important;margin:0!important}
.ov-cta .ov-cta-sub{font-size:11.5px!important;opacity:.68}
.ov-about-row .val .lx-issico{display:inline-block;width:18px;height:18px;border-radius:4px;overflow:hidden;vertical-align:-4px;margin-right:8px}
.ov-about-row .val .lx-issico svg{display:block;width:18px;height:18px}
.ov-about-row .val .lx-netlogo{width:26px;height:26px;border-radius:50%;vertical-align:-8px;margin-right:9px}
.buy-sell-legend .hl{display:block;color:var(--text-soft);font-weight:500;font-size:10.5px;margin-top:3px}
.buy-sell-legend .sells{text-align:right}
#ovTradesList .ov-trade-row{grid-template-columns:76px 1fr auto auto 84px 30px!important;align-items:center}
#ovTradesList .ov-trade-amount{text-align:right;white-space:nowrap}
#ovTradesList .ov-trade-amount .lx-tsub{color:var(--text-soft);font-weight:500}
#ovTradesList .ov-trade-time{text-align:right;color:var(--text-soft)}
.lx-trade-addr{color:inherit;text-decoration:none;transition:color .15s}
.lx-trade-addr:hover{color:var(--accent);text-decoration:underline}
.ov-hero .ov-ico{width:94px!important;height:94px!important}
.ov-ico.lx-aoico{font-size:36px!important}
.ov-title-block h1{font-size:46px!important}
.ov-subtitle{font-size:18px!important}
.lx-aodesc{text-align:justify}
.ov-price-block .ov-cta-row{display:flex!important;gap:10px;flex-wrap:nowrap;margin-top:16px}
.ov-price-block .ov-cta{flex:1 1 0!important;max-width:none!important;width:auto!important;min-width:0}
#ovDiscussionComposer,#ovDiscussionComposer:focus,#ovDiscussionComposer:focus-visible{border:none!important;box-shadow:none!important;outline:none!important;background:transparent!important}
.lx-ao-empty{padding:26px 8px;text-align:center;color:var(--text-muted);font-size:13.5px;line-height:1.55}
.lx-ao-empty b{color:var(--text);display:block;font-size:14.5px;margin-bottom:5px}
#ovChart .lx-ao-chartnote{position:absolute;inset:0;display:grid;place-items:center;text-align:center;color:var(--text-soft);font-size:13px;padding:16px}
</style>`;

// ---- browser runtime (TESTNET, read-only). No backticks / no ${ } inside. Literal chars only. ----
const SCRIPT = `<script id="lx-aodata">(function(){
  var H="https://horizon.stellar.org";                 // MAINNET (this page)
  // Real Stellar MAINNET assets (code -> issuer). Canonical issuers, matching the swap engine.
  var KNOWN={
    USDC:"GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    EURC:"GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2",
    AQUA:"GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
    yUSDC:"GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF",
    yXLM:"GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55"
  };
  var GRAD=["linear-gradient(135deg,#ea6a2c,#ff9a3d)","linear-gradient(135deg,#7c6cf5,#a89bff)","linear-gradient(135deg,#2dd4bf,#14b8a6)","linear-gradient(135deg,#ec4899,#f472b6)","linear-gradient(135deg,#3b82f6,#60a5fa)"];

  function num(n){return Math.round(+n||0).toLocaleString("en-US");}
  function sig(x){x=+x;if(!x)return "0";if(x>=1)return x.toLocaleString("en-US",{maximumFractionDigits:4});if(x>=0.01)return x.toFixed(4);var e=Math.floor(Math.log10(x));var d=Math.min(12,Math.max(2,-e+2));return x.toFixed(d).replace(/0+$/,"").replace(/\\.$/,"");}
  function usd(x){x=+x;if(!x)return "$0";var a=Math.abs(x);if(a>=1e9)return "$"+(x/1e9).toFixed(2)+"B";if(a>=1e6)return "$"+(x/1e6).toFixed(2)+"M";if(a>=1e3)return "$"+(x/1e3).toFixed(1)+"K";if(a>=1)return "$"+x.toFixed(2);return "$"+sig(x);}
  function short(a){return a?a.slice(0,4)+"\\u2026"+a.slice(-4):"";}
  // XLM/USD when CoinGecko rate-limits (429): cross-page cache (<6h) then last-known global. The old
  // hardcoded 0.11 silently rendered every USD figure on this page ~35% low.
  function aoXuFallback(){ try{ var c=JSON.parse(localStorage.getItem("lumos.xlmUsd")||"null"); if(c&&+c.v>0&&(Date.now()-c.ts<216e5))return +c.v; }catch(_){}
    return (+window.__lxXlmUsd>0)?+window.__lxXlmUsd:0.11; }
  function aoXuSave(v){ if(+v>0){ try{ localStorage.setItem("lumos.xlmUsd",JSON.stringify({v:+v,ts:Date.now()})); }catch(_){} } return +v||0; }
  function esc(s){return (s+"").replace(/[<>&]/g,function(c){return c==="<"?"&lt;":c===">"?"&gt;":"&amp;";});}
  function getJSON(u){return fetch(u).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});}
  function letterIco(code){return code?code[0].toUpperCase():"?";}

  // ---- which asset? ?asset=CODE-ISSUER  |  ?code=&issuer=  |  last launch  |  first seed ----
  function target(){
    try{
      var q=new URLSearchParams(location.search);
      var a=(window.__lxRoute&&window.__lxRoute.asset)||q.get("asset");
      if(a&&a.indexOf("-")>0){ var i=a.indexOf("-"); return {code:a.slice(0,i),issuer:a.slice(i+1)}; }
      if(q.get("code")&&q.get("issuer")) return {code:q.get("code"),issuer:q.get("issuer")};
    }catch(e){}
    try{ var r=JSON.parse(localStorage.getItem("lumos.launch.result")||"null"); if(r&&r.code&&r.issuer) return {code:r.code,issuer:r.issuer}; }catch(e){}
    var k=Object.keys(KNOWN); return {code:k[0],issuer:KNOWN[k[0]]};
  }
  var T=target();
  var CODE=T.code, ISSUER=T.issuer, ASSET=CODE+":"+ISSUER;
  var ac4=CODE.length<=4?"credit_alphanum4":"credit_alphanum12";

  var DATA=null;               // holds all fetched values once ready
  function load(){
    var recP=getJSON(H+"/assets?asset_code="+encodeURIComponent(CODE)+"&asset_issuer="+ISSUER);
    var poolP=getJSON(H+"/liquidity_pools?reserves="+encodeURIComponent(ASSET)+"&limit=200");   // 20 was too few — the MAIN pool can sit past page 1 among dust pools (price came from a skewed one)
    var issP=getJSON(H+"/accounts/"+ISSUER);
    var holdP=getJSON(H+"/accounts?asset="+encodeURIComponent(ASSET)+"&limit=100");
    var xlmP=getJSON("https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd");
    var launchP=getJSON(H+"/accounts/"+ISSUER+"/operations?order=asc&limit=1");
    // the REAL market price: the last on-chain trade vs XLM (pool-reserve ratios lied — see below)
    var _at=(CODE.length<=4?"credit_alphanum4":"credit_alphanum12");
    var lastTradeP=getJSON(H+"/trades?base_asset_type="+_at+"&base_asset_code="+encodeURIComponent(CODE)+"&base_asset_issuer="+ISSUER+"&counter_asset_type=native&order=desc&limit=1");
    Promise.all([recP,poolP,issP,holdP,xlmP,launchP,lastTradeP]).then(function(r){
      var rec=(r[0]&&r[0]._embedded&&r[0]._embedded.records&&r[0]._embedded.records[0])||null;
      var pools=(r[1]&&r[1]._embedded&&r[1]._embedded.records)||[];
      var iss=r[2]; var holders=(r[3]&&r[3]._embedded&&r[3]._embedded.records)||[];
      var xlmUsd=aoXuSave((r[4]&&r[4].stellar&&+r[4].stellar.usd)||0)||aoXuFallback();
      var lops=(r[5]&&r[5]._embedded&&r[5]._embedded.records)||[];
      var launchTs=lops.length?Date.parse(lops[0].created_at):0;
      var ageMs=launchTs?(Date.now()-launchTs):0;
      var defTf=(!launchTs||ageMs<6048e5)?"1D":(ageMs<2592e6?"1W":"1M"); // <1w -> 1D, <1m -> 1W, else 1M
      var supply=0, holdersN=0;
      if(rec){ supply=(+rec.balances.authorized||0)+(+rec.liquidity_pools_amount||0)+(+rec.claimable_balances_amount||0)+(+rec.contracts_amount||0); holdersN=+((rec.accounts&&rec.accounts.authorized)||0); }
      var plist=pools.map(function(p){ var codeAmt=0,otherAmt=0,oc=""; (p.reserves||[]).forEach(function(rv){ if(rv.asset.indexOf(CODE+":")===0)codeAmt=+rv.amount; else {otherAmt=+rv.amount; oc=rv.asset==="native"?"XLM":rv.asset.split(":")[0];} }); return {id:p.id,other:oc,codeAmt:codeAmt,otherAmt:otherAmt,shares:+p.total_shares,xlm:oc==="XLM"?otherAmt:0}; });
      // AUDIT FIX: price was read from the FIRST XLM-paired pool in arbitrary API order — a skewed/dust
      // pool (huge XLM vs dust tokens) yields an absurd ratio (USDC market cap rendered "$313160481.71B").
      // Pick the pool with the largest AMM invariant sqrt(a*b): a lopsided pool has a tiny k even when one
      // side looks big, so the genuinely liquid pool always wins and its ratio IS the market price.
      var xlmPool=null,bestK=0; for(var i=0;i<plist.length;i++){ var _pp=plist[i]; if(_pp.other!=="XLM"||!(_pp.codeAmt>0)||!(_pp.otherAmt>0))continue; var _k=Math.sqrt(_pp.codeAmt*_pp.otherAmt); if(_k>bestK){bestK=_k;xlmPool=_pp;} }
      var priceX = xlmPool? (xlmPool.otherAmt/xlmPool.codeAmt) : 0;   // XLM per token (pool-ratio fallback)
      if(!isFinite(priceX)||priceX<0)priceX=0;
      // For liquid assets (USDC) the /liquidity_pools?reserves list can be ENTIRELY dust pools (the main
      // pool sits beyond limit=200), so any reserve-ratio price is garbage. The last on-chain TRADE vs XLM
      // is the actual market price — prefer it whenever it exists.
      try{ var _lt=(r[6]&&r[6]._embedded&&r[6]._embedded.records&&r[6]._embedded.records[0])||null;
        if(_lt&&_lt.price&&+_lt.price.n>0&&+_lt.price.d>0){ var _tp=+_lt.price.n/+_lt.price.d; if(isFinite(_tp)&&_tp>0)priceX=_tp; } }catch(_e){}
      var priceU = priceX*xlmUsd;
      var hl=holders.map(function(a){ var b=0;(a.balances||[]).forEach(function(x){ if(x.asset_code===CODE&&x.asset_issuer===ISSUER)b=+x.balance; }); return {addr:a.account_id||a.id,bal:b}; }).filter(function(h){return h.bal>0;}).sort(function(a,b){return b.bal-a.bal;}).slice(0,6);
      var domain=(iss&&iss.home_domain)||"";
      var D={code:CODE,issuer:ISSUER,supply:supply,holders:holdersN,priceX:priceX,priceU:priceU,mcapU:supply*priceU,mcapX:supply*priceX,
        pools:plist.sort(function(a,b){return (b.xlm||b.otherAmt)-(a.xlm||a.otherAmt);}),topHolders:hl,domain:domain,xlmUsd:xlmUsd,locked:true,trades:[],n24:0,vol24X:0,vol24U:0,chg1d:null,launchTs:launchTs,defTf:defTf,buysN:0,sellsN:0,dayHighU:0,dayLowU:0,xlmPoolId:(xlmPool&&xlmPool.id)||""};
      function finish(){ DATA=D; paint(); reveal(); }
      // AUDIT FIX: 24h volume/change/high/low from the (possibly dust) pool's trades produced "-100% past
      // 24h" on liquid assets. Overlay with trade_aggregations vs native — ALL markets, real daily OHLC.
      var aggP=getJSON(H+"/trade_aggregations?base_asset_type="+_at+"&base_asset_code="+encodeURIComponent(CODE)+"&base_asset_issuer="+ISSUER+"&counter_asset_type=native&resolution=86400000&order=desc&limit=2").catch(function(){return null;});
      function applyAgg(){ return aggP.then(function(ag){ var recs=(ag&&ag._embedded&&ag._embedded.records)||[]; if(!recs.length)return;
        var t0=recs[0]; if(+t0.counter_volume>0){ D.vol24X=+t0.counter_volume; D.vol24U=D.vol24X*xlmUsd; }
        if(+t0.trade_count>0)D.n24=+t0.trade_count;
        if(+t0.high>0){ D.dayHighU=+t0.high*xlmUsd; D.dayLowU=+t0.low*xlmUsd; }
        if(+t0.open>0&&+t0.close>0)D.chg1d=(+t0.close/+t0.open-1)*100;
      }).catch(function(){}); }
      // real trades come from the XLM pool's trades endpoint (AMM trades don't show under /trades?base_asset)
      if(xlmPool&&xlmPool.id){
        getJSON(H+"/liquidity_pools/"+xlmPool.id+"/trades?order=desc&limit=100").then(function(tr){
          var trs=(tr&&tr._embedded&&tr._embedded.records)||[]; var now=Date.now(), vol=0, n=0, disp=[];
          trs.forEach(function(t){
            var xlmAmt=t.base_asset_type==="native"?+t.base_amount:+t.counter_amount;
            var tokAmt=t.base_asset_type==="native"?+t.counter_amount:+t.base_amount;
            var ts=Date.parse(t.ledger_close_time||"");
            if(now-ts<=864e5){ vol+=xlmAmt; n++; }
            var buy=(t.base_asset_type==="native")?!t.base_is_seller:!!t.base_is_seller; // rising price = buys (verified vs price)
            disp.push({buy:buy,xlm:xlmAmt,tok:tokAmt,ts:ts,price:tokAmt?xlmAmt/tokAmt:0,acct:t.base_account||""});
          });
          D.trades=disp; D.n24=n; D.vol24X=vol; D.vol24U=vol*xlmUsd;
          D.buysN=disp.filter(function(d){return d.buy;}).length; D.sellsN=disp.length-D.buysN;
          var allP=disp.map(function(d){return d.price;}).filter(function(p){return p>0;}); if(priceX>0)allP.push(priceX);
          if(allP.length){ D.dayHighU=Math.max.apply(null,allP)*xlmUsd; D.dayLowU=Math.min.apply(null,allP)*xlmUsd; }
          var win=disp.filter(function(d){return now-d.ts<=864e5&&d.price>0;});
          if(win.length&&priceX>0){ var oldP=win[win.length-1].price; if(oldP>0) D.chg1d=(priceX-oldP)/oldP*100; }
          applyAgg().then(finish);
        });
      } else applyAgg().then(finish);
    });
  }

  // ---------- painters (idempotent; re-asserted by the observer) ----------
  function setText(el,txt){ if(el&&el.textContent!==txt) el.textContent=txt; }
  function setMoney(el,str,val){ if(!el)return; if(el.textContent!==str)el.textContent=str; if(el.setAttribute){ el.setAttribute("data-usd",val); el.setAttribute("data-orig",str); } }
  function q(sel){return document.querySelector(sel);}
  function qa(sel){return [].slice.call(document.querySelectorAll(sel));}

  // the token's uploaded Launchpad logo (per-asset map, else the last launch result), else neutral placeholder
  // The published registry, read from our own origin. Same record the stellar.toml is built from, so this
  // page shows the same logo a wallet does. Async, so paintIdentity repaints when it lands.
  // window.__lxTokenRegistry is baked into <head> at build time, so this is known on the FIRST paint and the letter avatar is never drawn for a token we have. The fetch stays only as a refresh for a page left open across a deploy.
  var _aoMan=(function(){ try{ return window.__lxTokenRegistry||null; }catch(e){ return null; } })();
  (function(){
    fetch("/assets/tokens/launchpad-icons.json").then(function(r){ return r.ok?r.json():null; }).then(function(m){
      if(!m||typeof m!=="object"||m.constructor===Array)return;
      _aoMan=m; try{ paintIdentity(); }catch(_e){}
    }).catch(function(){});
  })();
  function aoRegIcon(){
    if(!_aoMan)return "";
    var v=_aoMan[CODE+"-"+ISSUER]; var u=(v&&typeof v==="object")?v.image:v;
    return (typeof u==="string"&&u.charAt(0)==="/"&&u.indexOf("//")!==0)?u:"";
  }
  function aoIcon(){
    var reg=aoRegIcon(); if(reg) return reg;
    try{ var m=JSON.parse(localStorage.getItem("lumos.launch.icons")||"{}"); var k=CODE+"-"+ISSUER; var v=m&&m[k];
      var u=(v&&typeof v==="object")?v.image:v; if(u) return u; }catch(e){}
    try{ var r=JSON.parse(localStorage.getItem("lumos.launch.result")||"null"); if(r&&r.code===CODE&&r.issuer===ISSUER&&r.icon) return r.icon; }catch(e){}
    return "assets/tokens/placeholder.svg";
  }
  function paintIdentity(){
    var h1=q(".ov-title-block h1"); if(h1) setText(h1,CODE);
    var sub=q(".ov-subtitle"); if(sub) setText(sub,"Stellar mainnet asset");
    var badge=q(".ov-chain-badge"); if(badge){ if(badge.textContent.indexOf("Mainnet")<0) badge.innerHTML='Stellar \\u00b7 Mainnet'; var bd=badge.querySelector(".dot"); if(bd)bd.parentNode.removeChild(bd); }
    var cta=q(".ov-cta-row"), cg=q(".ov-change-grid"); if(cta&&cg&&cg.parentNode&&cta.parentNode!==cg.parentNode){ cg.parentNode.appendChild(cta); }
    var dom=q(".ov-domain"); if(dom){ if(DATA&&DATA.domain){ setText(dom,DATA.domain); dom.setAttribute("href","https://"+DATA.domain); } else { dom.style.display="none"; } }
    var ico=q(".ov-ico"); if(ico && !ico.classList.contains("lx-aoico")){ ico.classList.add("lx-aoico"); ico.style.background=GRAD[CODE.charCodeAt(0)%GRAD.length]; ico.style.position="relative"; ico.style.overflow="hidden"; ico.textContent=letterIco(CODE); var im=document.createElement("img"); im.alt=""; im.src=aoIcon(); im.style.cssText="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"; im.onerror=function(){ if(im.parentNode)im.parentNode.removeChild(im); }; ico.appendChild(im); }
  }
  function paintPrice(){
    if(!DATA)return;
    var pm=q(".ov-price-main"); if(pm) setText(pm, DATA.priceX? (sig(DATA.priceX)+" XLM") : "\\u2014");
    setMoney(q(".ov-price-sub .lc-money"), DATA.priceU?usd(DATA.priceU):"\\u2014", DATA.priceU||0);
    var grid=q(".ov-change-grid");
    if(grid){
      var cells=[["1D",DATA.chg1d],["1W",null],["1M",null],["1Y",null]];
      var gh=cells.map(function(c){ var vv=c[1];
        if(vv==null){ return '<div class="ov-change-cell lx-aoempty lx-aonolog" data-lx-noswap data-lbl="'+c[0]+'"></div>'; }
        var cls=vv>=0?"up":"down"; var tx=(vv>=0?"+":"")+(Math.abs(vv)>=100?num(vv):vv.toFixed(1))+"%";
        return '<div class="ov-change-cell lx-aonolog '+cls+'" data-lx-noswap><div class="lbl">'+c[0]+'</div><div class="ov-change-pill lx-aonolog">'+tx+'</div></div>'; }).join("");
      if(grid.innerHTML!==gh) grid.innerHTML=gh;
    }
  }
  function pctTxt(x){ if(x==null)return ""; var a=Math.abs(x); return (x>=0?"+":"")+(a>=1000?num(x):(a>=10?x.toFixed(0):x.toFixed(1)))+"%"; }
  function ensureDelta(s){ var d=s.querySelector(".delta"); if(!d){ d=document.createElement("div"); d.className="delta"; s.appendChild(d); } return d; }
  function paintStats(){
    if(!DATA)return;
    qa(".ov-stats .ov-stat").forEach(function(s){
      var k=((s.querySelector(".k")||{}).textContent||"").toLowerCase();
      var v=s.querySelector(".v"), vsub=s.querySelector(".v-sub");
      if(k.indexOf("market")>=0){
        setMoney(v&&v.querySelector(".lc-money")||v, usd(DATA.mcapU), DATA.mcapU);
        if(vsub)setText(vsub,num(DATA.mcapX)+" XLM");
        var d=ensureDelta(s); d.className="delta"+(DATA.chg1d==null?"":(DATA.chg1d>=0?" up":" down")); setText(d,DATA.chg1d==null?"New listing":(pctTxt(DATA.chg1d)+" past 24h"));
      } else if(k.indexOf("volume")>=0){
        setMoney(v&&v.querySelector(".lc-money")||v, usd(DATA.vol24U), DATA.vol24U);
        if(vsub)setText(vsub,DATA.n24?num(DATA.vol24X)+" XLM":"No trades yet");
        var dv=s.querySelector(".delta"); if(dv)dv.parentNode.removeChild(dv);
      } else if(k.indexOf("holder")>=0){
        if(v)setText(v,num(DATA.holders)); if(vsub)setText(vsub,"trustlines");
        var dh=s.querySelector(".delta"); if(dh)dh.parentNode.removeChild(dh);
      } else if(k.indexOf("trade")>=0){
        if(v)setText(v,num(DATA.n24));
        var dt=s.querySelector(".delta"); if(dt)dt.parentNode.removeChild(dt);
        var bar=s.querySelector(".buy-sell-bar"), leg=s.querySelector(".buy-sell-legend");
        if(!bar){ bar=document.createElement("div"); bar.className="buy-sell-bar"; bar.innerHTML='<div class="bs-buy"></div><div class="bs-sell"></div>'; s.appendChild(bar); }
        var be=bar.querySelector(".bs-buy"), se=bar.querySelector(".bs-sell"); if(be)be.style.width="50%"; if(se)se.style.width="50%";
        if(!leg){ leg=document.createElement("div"); leg.className="buy-sell-legend"; s.appendChild(leg); }
        var lh='<span class="buys">\\u25B2 '+DATA.buysN+' buys<span class="hl">High '+usd(DATA.dayHighU)+'</span></span><span class="sells">\\u25BC '+DATA.sellsN+' sells<span class="hl">Low '+usd(DATA.dayLowU)+'</span></span>'; if(leg.innerHTML!==lh)leg.innerHTML=lh;
      }
    });
  }
  function fmtLaunch(ts){ if(!ts)return "On Stellar mainnet"; var d=new Date(ts); var mo=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()]; var days=Math.floor((Date.now()-ts)/864e5); return mo+" "+d.getUTCDate()+", "+d.getUTCFullYear()+" \\u00b7 "+(days<=0?"today":days+"d ago"); }
  function paintAbout(){
    if(!DATA)return;
    qa(".ov-card-head").forEach(function(h){ if(/^About /.test((h.textContent||"").trim())) setText(h,"About "+CODE); });
    qa(".ov-about-row").forEach(function(r){
      var key=((r.querySelector(".key")||{}).textContent||"").toLowerCase().trim();
      var val=r.querySelector(".val"); if(!val)return;
      if(key.indexOf("issuer")>=0){ var mono=val.querySelector(".addr-mono"); if(mono)setText(mono,short(ISSUER)); var cp=val.querySelector("[data-copy]"); if(cp)cp.setAttribute("data-copy",ISSUER);
        if(!val.querySelector(".lx-issico")){ var sp=document.createElement("span"); sp.className="lx-issico"; sp.innerHTML=ident(ISSUER); val.insertBefore(sp,val.firstChild); } }
      else if(key.indexOf("type")>=0){ setText(val,"Fixed supply \\u00b7 Issuer locked"); }
      else if(key.indexOf("supply")>=0){ setText(val,num(DATA.supply)); }
      else if(key.indexOf("network")>=0){ var nh='<img class="lx-netlogo" src="assets/tokens/xlm.png" alt="">Stellar'; if(val.innerHTML!==nh)val.innerHTML=nh; }
      else if(key.indexOf("launch")>=0){ setText(val,fmtLaunch(DATA.launchTs)); }
    });
  }
  function miniPool(p){
    var a=GRAD[CODE.charCodeAt(0)%GRAD.length], b=GRAD[(p.other.charCodeAt(0)||1)%GRAD.length];
    return '<div class="ov-mini-row lx-aomini"><div class="ov-mini-pair"><div class="b" style="background:'+a+'">'+esc(letterIco(CODE))+'</div><div class="b" style="background:'+b+'">'+esc(letterIco(p.other))+'</div></div>'+
      '<div class="ov-mini-info"><div class="ov-mini-name">'+esc(CODE)+" / "+esc(p.other)+'</div><div class="ov-mini-sub">0.30% fee \\u00b7 Stellar AMM</div></div>'+
      '<span class="ov-mini-pill">'+(p.xlm?num(p.xlm)+" XLM":num(p.otherAmt)+" "+esc(p.other))+'</span></div>';
  }
  function paintPools(){
    if(!DATA)return;
    var card=null; qa(".ov-card-head").forEach(function(h){ if(/Top Pools/.test(h.textContent)) card=h.closest(".ov-card"); });
    if(!card)return;
    var cnt=card.querySelector(".ov-card-head .count"); if(cnt)setText(cnt,"\\u00b7 "+DATA.pools.length+" active");
    var box=card.querySelector(".ov-mini-row"); box=box?box.parentNode:null; if(!box)return;
    if(box.querySelector(".lx-aomini"))return;
    box.innerHTML=DATA.pools.length?DATA.pools.map(miniPool).join(""):'<div class="lx-ao-empty lx-aomini"><b>No pools yet</b>This asset has no liquidity pools on mainnet.</div>';
  }
  function miniHolder(h,i){
    var pct=DATA.supply?(h.bal/DATA.supply*100):0;
    return '<div class="ov-mini-row lx-aomini"><span class="ov-trade-mini-ico" style="width:36px;height:36px;border-radius:50%;overflow:hidden;flex-shrink:0">'+ident(h.addr)+'</span>'+
      '<div class="ov-mini-info"><div class="ov-mini-name"><a class="lx-trade-addr" href="https://stellar.expert/explorer/public/account/'+esc(h.addr)+'" target="_blank" rel="noopener">'+esc(short6(h.addr))+'</a></div><div class="ov-mini-sub">#'+(i+1)+'</div></div>'+
      '<div style="text-align:right"><div class="ov-mini-name">'+num(h.bal)+'</div><div class="ov-mini-sub">'+(pct>=0.01?pct.toFixed(2):sig(pct))+'%</div></div></div>';
  }
  function paintHolders(){
    if(!DATA)return; var box=q("#ovHoldersMini"); if(!box) return;
    var card=box.closest(".ov-card"); if(card){ var cnt=card.querySelector(".ov-card-head .count"); if(cnt)setText(cnt,"\\u00b7 "+num(DATA.holders)+" wallet"+(DATA.holders===1?"":"s")); }
    if(box.querySelector(".lx-aomini"))return;
    box.innerHTML=DATA.topHolders.length?DATA.topHolders.map(miniHolder).join(""):'<div class="lx-ao-empty lx-aomini"><b>No holders yet</b></div>';
  }
  function ago(ts){ var s=(Date.now()-ts)/1000; if(s<60)return Math.max(1,Math.floor(s))+"s ago"; if(s<3600)return Math.floor(s/60)+"m ago"; if(s<86400)return Math.floor(s/3600)+"h ago"; return Math.floor(s/86400)+"d ago"; }
  function ident(addr){ addr=addr||""; var h=0; for(var i=0;i<addr.length;i++)h=(h*31+addr.charCodeAt(i))>>>0; var col="hsl("+(h%360)+",62%,55%)"; var cells=""; for(var y=0;y<5;y++){ for(var x=0;x<3;x++){ if((h>>((y*3+x)%30))&1){ var xs=[x,4-x]; for(var q=0;q<xs.length;q++) cells+='<rect x="'+(xs[q]*4)+'" y="'+(y*4)+'" width="4" height="4" fill="'+col+'"/>'; } } } return '<svg viewBox="0 0 20 20" width="20" height="20"><rect width="20" height="20" fill="#0e0e14"/>'+cells+'</svg>'; }
  var LINKICO='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
  function short6(a){ return a?a.slice(0,6)+"\\u2026"+a.slice(-6):""; }
  function tradeRow(t){
    var tier=t.xlm>=10000?["t10k","10K+"]:(t.xlm>=1000?["t1k","1K+"]:(t.xlm>=100?["t100","100+"]:["t10","10+"]));
    var side=t.buy?'<div class="ov-trade-side buy">\\u25B2 BUY</div>':'<div class="ov-trade-side sell">\\u25BC SELL</div>';
    var url='https://stellar.expert/explorer/public/account/'+esc(t.acct);
    return '<div class="ov-trade-row lx-aotrade">'+
      '<div class="ov-trade-size"><span class="ov-trade-tier '+tier[0]+'">'+tier[1]+'</span></div>'+
      '<div class="ov-trade-wallet"><span class="ov-trade-mini-ico">'+ident(t.acct)+'</span><a class="lx-trade-addr" href="'+url+'" target="_blank" rel="noopener">'+short6(t.acct)+'</a></div>'+
      side+
      '<div class="ov-trade-amount">'+num(t.xlm)+' XLM <span class="lx-tsub">\\u00b7 '+num(t.tok)+' '+esc(CODE)+'</span></div>'+
      '<div class="ov-trade-time">'+ago(t.ts)+'</div>'+
      '<a class="ov-trade-explorer" href="'+url+'" target="_blank" rel="noopener">'+LINKICO+'</a></div>';
  }
  function paintTrades(){
    if(!DATA)return; var box=q("#ovTradesList"); if(!box)return;
    var mn=tradeMin(); var list=DATA.trades.filter(function(t){return t.xlm>=mn;});
    var html=list.length?list.slice(0,25).map(tradeRow).join(""):'<div class="lx-ao-empty lx-aotrade"><b>No trades'+(mn?" \\u2265 "+num(mn)+" XLM":" yet")+'</b>'+(mn?"":esc(CODE)+" was just launched \\u2014 trades appear here once it trades on the DEX.")+'</div>';
    var sigv="t"+DATA.trades.length+"m"+mn;
    if(!box.querySelector(".lx-aotrade") || box.getAttribute("data-lxsig")!==sigv){ box.innerHTML=html; box.setAttribute("data-lxsig",sigv); }
    var cnt=q("#ovTradesCount"); if(cnt) cnt.style.display="none";
  }
  function chartPoints(){ if(!DATA)return []; var win=tfWindowMs(activeTf()); var now=Date.now(); var p=(DATA.trades||[]).map(function(t){return {t:t.ts,v:t.price};}).filter(function(x){return x.v>0 && (now-x.t)<=win;}); p.sort(function(a,b){return a.t-b.t;}); if(DATA.priceX>0)p.push({t:now,v:DATA.priceX}); return p; }
  function paintChart(){
    var c=q("#ovChart"); if(!c)return; if(getComputedStyle(c).position==="static")c.style.position="relative";
    var cr=c.closest(".ov-row-2col"); if(cr&&cr.style.alignItems!=="stretch")cr.style.alignItems="stretch";
    var svg=c.querySelector("svg"); var note=c.querySelector(".lx-ao-chartnote"); var pts=chartPoints();
    if(svg && pts.length>=2){
      svg.style.opacity="1";
      var W=522,Hh=320,pad=18; var t0=pts[0].t,t1=pts[pts.length-1].t,tr=(t1-t0)||1;
      var vs=pts.map(function(p){return p.v;}); var mn=Math.min.apply(null,vs),mx=Math.max.apply(null,vs); var vr=(mx-mn)||mx||1;
      var coords=pts.map(function(p){ var x=(p.t-t0)/tr*W; var y=Hh-pad-((p.v-mn)/vr)*(Hh-2*pad); return x.toFixed(1)+" "+y.toFixed(1); });
      var line="M"+coords.join(" L"); var area=line+" L"+W.toFixed(1)+" "+Hh+" L0 "+Hh+" Z";
      var paths=svg.querySelectorAll("path");
      if(paths[0])paths[0].setAttribute("d",area); if(paths[1])paths[1].setAttribute("d",line);
      if(note)note.parentNode.removeChild(note);
    } else {
      if(svg)svg.style.opacity="0.06";
      if(!note){ var n=document.createElement("div"); n.className="lx-ao-chartnote"; n.textContent="Price history builds as "+CODE+" trades on the DEX."; c.appendChild(n); }
    }
  }
  function paintTags(){ var tags=q(".ov-tags"); if(tags && tags.style.display!=="none") tags.style.display="none"; }
  function discKey(){ return "lumos.disc."+CODE+"."+ISSUER.slice(1,7); }
  function loadDisc(){ try{ return JSON.parse(localStorage.getItem(discKey())||"[]"); }catch(e){ return []; } }
  function saveDisc(a){ try{ localStorage.setItem(discKey(),JSON.stringify(a.slice(0,100))); }catch(e){} }
  function textareaEl(){ var t=q("#ovDiscussionComposer"); if(t&&t.tagName==="TEXTAREA")return t; return q(".ov-discussion-mini textarea")||(t&&t.querySelector&&t.querySelector("textarea"))||q("main textarea"); }
  function discRow(c){ var av=(c.author||"You").slice(0,2).toUpperCase(); return '<div class="ov-disc lx-aodisc" style="display:flex;gap:12px;padding:16px 0;border-top:1px solid var(--border)"><div class="ov-disc-avatar" style="width:34px;height:34px;border-radius:50%;flex-shrink:0;display:grid;place-items:center;color:#fff;font-weight:700;font-size:12px;background:'+GRAD[Math.abs(c.ts||0)%GRAD.length]+'">'+esc(av)+'</div><div class="ov-disc-body" style="flex:1;min-width:0"><div class="ov-disc-head"><span class="ov-disc-name">'+esc(c.author||"You")+'</span> <span class="ov-disc-time">\\u00b7 '+ago(c.ts)+'</span></div><div class="ov-disc-text" style="margin-top:4px;line-height:1.5;color:var(--text-muted);word-break:break-word">'+esc(c.text)+'</div></div></div>'; }
  function wireDisc(){ var btn=q("#ovComposerPostBtn"); if(btn && !btn.__lxw){ btn.__lxw=1; btn.addEventListener("click",function(e){ e.stopImmediatePropagation(); var ta=textareaEl(); var txt=ta&&(ta.value||"").trim(); if(!txt)return; var who="You"; try{var a=localStorage.getItem("lumos.address")||""; if(/^G[A-Z2-7]{55}$/.test(a))who=a.slice(0,4)+"\\u2026"+a.slice(-4);}catch(_){}
    var cs=loadDisc(); cs.unshift({text:txt,ts:Date.now(),author:who}); saveDisc(cs); if(ta){ta.value=""; var cc=q("#ovComposerCharCount"); if(cc)cc.textContent="0/500";} paintDiscussion(); },true); } }
  function paintDiscussion(){
    var cs=loadDisc(); var list=q("#ovDiscussionList");
    if(list){ var sig="d"+cs.length+(cs[0]?cs[0].ts:0); if(list.getAttribute("data-lxdsig")!==sig || !list.querySelector(".lx-aodisc")){ list.innerHTML = cs.length? cs.map(discRow).join("") : '<div class="lx-ao-empty lx-aodisc"><b>No discussions yet</b>Be the first to share your thoughts on '+esc(CODE)+'.</div>'; list.setAttribute("data-lxdsig",sig); } }
    var cnt=q("#ovDiscussCount"); if(cnt)setText(cnt, cs.length+" thread"+(cs.length===1?"":"s"));
    var ta=textareaEl(); if(ta&&ta.placeholder&&/LUMOS/.test(ta.placeholder))ta.placeholder=ta.placeholder.replace(/LUMOS/g,CODE);
    wireDisc();
  }
  function tfWindowMs(tf){ return tf==="1D"?864e5:(tf==="1W"?6048e5:(tf==="1M"?2592e6:(tf==="1Y"?31536e6:Infinity))); }
  function activeTf(){ var b=q("#ovChartToggle button.active"); return (b&&b.dataset.period)||(DATA&&DATA.defTf)||"1D"; }
  function tradeMin(){ var b=q("#ovTradeFilters button.active"); if(!b)return 0; var t=(b.textContent||"").toLowerCase(); if(t.indexOf("all")>=0)return 0; var m=t.match(/([\\d.]+)/); if(!m)return 0; var n=parseFloat(m[1]); if(/k/.test(t))n*=1000; return n; }
  function paintDefaultTf(){ if(!DATA||window.__lxTfSet)return; var want=DATA.defTf,found=false; qa("#ovChartToggle button").forEach(function(b){ var on=b.dataset.period===want; b.classList.toggle("active",on); if(on)found=true; }); if(found)window.__lxTfSet=1; }
  function wireControls(){
    qa("#ovChartToggle button").forEach(function(b){ if(b.__lxw)return; b.__lxw=1; b.addEventListener("click",function(){ qa("#ovChartToggle button").forEach(function(x){x.classList.remove("active");}); b.classList.add("active"); window.__lxTfSet=1; paintChart(); }); });
    qa("#ovTradeFilters button").forEach(function(b){ if(b.__lxw)return; b.__lxw=1; b.addEventListener("click",function(e){ e.stopImmediatePropagation(); qa("#ovTradeFilters button").forEach(function(x){x.classList.remove("active");}); b.classList.add("active"); paintTrades(); },true); });
    wireHover();
  }
  function hrow(k,v,c){ return '<div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:3px"><span style="color:var(--text-soft)">'+k+'</span><span style="font-weight:700'+(c?";color:"+c:"")+'">'+v+'</span></div>'; }
  function wireHover(){
    var chart=q("#ovChart"); if(!chart||chart.__lxhov)return; chart.__lxhov=1;
    var box=q("#chHoverBox"), vline=q("#chHoverVline"), hline=q("#chHoverHline"), dot=q("#chHoverDot"), ptag=q("#chHoverPriceTag"), dtag=q("#chHoverDateTag");
    var MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    chart.addEventListener("mousemove",function(e){
      if(!DATA)return; var pts=chartPoints(); if(pts.length<2)return;
      var r=chart.getBoundingClientRect(); var f=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
      var t0=pts[0].t,t1=pts[pts.length-1].t; var tt=t0+f*(t1-t0);
      var i=0; while(i<pts.length-1 && pts[i+1].t<tt)i++; var a=pts[i],b=pts[Math.min(i+1,pts.length-1)]; var seg=(b.t-a.t)||1; var pv=a.v+(b.v-a.v)*((tt-a.t)/seg);
      var pu=pv*DATA.xlmUsd; var chg=pts[0].v>0?((pv-pts[0].v)/pts[0].v*100):0;
      var vs=pts.map(function(p){return p.v;}); var mn=Math.min.apply(null,vs),mx=Math.max.apply(null,vs),vr=(mx-mn)||mx||1; var pad=18; var yy=r.height-pad-((pv-mn)/vr)*(r.height-2*pad); var xx=f*r.width;
      var d=new Date(tt); var hh=d.getUTCHours(),mm=("0"+d.getUTCMinutes()).slice(-2),ap=hh<12?"AM":"PM",h12=((hh%12)||12);
      var dstr=MON[d.getUTCMonth()]+" "+d.getUTCDate()+" \\u00b7 "+h12+":"+mm+" "+ap;
      if(box){ box.innerHTML='<div style="color:var(--text-soft);font-size:11px;margin-bottom:6px">'+dstr+'</div>'+hrow("Price",sig(pv)+" XLM")+hrow("USD",usd(pu))+hrow("Change",(chg>=0?"+":"")+(Math.abs(chg)>=100?num(chg):chg.toFixed(2))+"%",chg>=0?"#16a34a":"#e5484d");
        box.style.opacity="1"; box.style.left=Math.min(r.width-176,xx+14)+"px"; box.style.top=Math.max(6,Math.min(r.height-96,yy-16))+"px"; }
      if(vline){ vline.style.opacity="1"; vline.style.left=xx+"px"; }
      if(hline){ hline.style.opacity="1"; hline.style.top=yy+"px"; }
      if(dot){ dot.style.opacity="1"; dot.style.left=xx+"px"; dot.style.top=yy+"px"; }
      if(dtag){ dtag.textContent=h12+":"+mm+" "+ap; dtag.style.opacity="1"; dtag.style.left=xx+"px"; }
      if(ptag){ ptag.textContent=sig(pv)+" XLM"; ptag.style.opacity="1"; ptag.style.top=yy+"px"; }
    });
    chart.addEventListener("mouseleave",function(){ [box,vline,hline,dot,ptag,dtag].forEach(function(el){ if(el)el.style.opacity="0"; }); });
  }
  function paintDesc(){
    qa(".ov-card p, main p").forEach(function(p){ var t=p.textContent||""; if(/native token, used across|is a token launched on LumosCore/i.test(t)){ var d=CODE+" is a token launched on LumosCore\\u2019s Stellar mainnet Launchpad, with a fixed supply and a permanently locked issuer."; if(p.textContent.trim()!==d) p.textContent=d; if(!p.classList.contains("lx-aodesc")) p.classList.add("lx-aodesc"); } });
  }

  // "Add Liquidity" CTA must open THIS asset's pool (CODE/XLM) — the design's button opens a mock LUMOS/XLM modal.
  // Route it to the functional AMM pool-detail deposit for the real CODE/XLM pool instead.
  function wireCTAs(){
    if(window.__lxAoCta) return; var add=null; qa(".ov-cta").forEach(function(c){ if((c.textContent||"").toLowerCase().indexOf("add liquid")>=0) add=c; });
    if(!add) return; window.__lxAoCta=1;
    add.addEventListener("click",function(e){ e.preventDefault(); e.stopImmediatePropagation();
      var suf=/-dark\\./.test(location.pathname)?"-dark":(/-mobile\\./.test(location.pathname)?"-mobile":"");
      var pid=(DATA&&DATA.xlmPoolId)||"";
      location.href= pid ? ("lumoscore-amm-pool"+suf+".html?pool="+pid) : ("lumoscore-amm"+suf+".html");
    },true);
  }
  function paint(){ paintIdentity(); paintPrice(); paintStats(); paintAbout(); paintPools(); paintHolders(); paintDefaultTf(); paintTrades(); paintChart(); paintTags(); paintDesc(); paintDiscussion(); wireControls(); wireCTAs();
    try{ var wt=CODE+" on Stellar — supply, holders and pools | LumosCore"; if(document.title!==wt)document.title=wt; }catch(_){} }   /* baked title said "LUMOS Asset Overview (Light)" for every asset/theme */
  function reveal(){ document.documentElement.classList.add("lx-aoready"); }

  var sched=false;
  function schedule(){ if(sched)return; sched=true; var raf=window.requestAnimationFrame||function(f){setTimeout(f,16);}; raf(function(){ sched=false; paint(); }); }

  function boot(){
    if(window.__lxAoBoot)return; window.__lxAoBoot=1;
    paintIdentity();                         // identity is known from the param -> paint instantly
    load();                                  // numeric data async -> paint + reveal when ready
    var root=q(".rwpage")||q("main")||document.body;
    try{ new MutationObserver(schedule).observe(root,{childList:true,subtree:true}); }catch(e){}
    setTimeout(function(){ if(!document.documentElement.classList.contains("lx-aoready")) reveal(); }, 6000); // safety reveal
    [200,700,1600].forEach(function(ms){ setTimeout(paint,ms); });
  }
  if(document.readyState!=="loading") boot();
  else document.addEventListener("DOMContentLoaded",boot);
})();</script>`;

// ---- inject into every container that has the asset-overview keys ----
const files = fs.readdirSync('.').filter(f => /^lumoscore-.*-(desktop|mobile)\.html$/.test(f));
let n = 0, containers = 0;
for (const file of files) {
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;
  for (const k of KEYS) {
    if (!json[k]) continue;
    let p = json[k];
    p = p.replace(/<style id="lx-ao-css">[\s\S]*?<\/style>/g, '')
         .replace(/<script id="lx-aodata">[\s\S]*?<\/script>/g, '');
    if (p.indexOf('</head>') >= 0) p = p.replace('</head>', STYLE + '</head>');
    else { const hb = p.lastIndexOf('</body>'); p = p.slice(0, hb) + STYLE + p.slice(hb); }
    const bi = p.lastIndexOf('</body>');
    p = p.slice(0, bi) + SCRIPT + p.slice(bi);
    json[k] = p; changed = true; n++;
  }
  if (changed) {
    containers++;
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
console.log('asset overview: injected=' + n + ' keys across ' + containers + ' containers');
