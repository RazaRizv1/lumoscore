(function(){
if(window.__lxTrending)return;window.__lxTrending=1;
function net(){try{return (localStorage.getItem("lumos.network")||localStorage.getItem("lumos.chain")||"").toLowerCase();}catch(_){return "";}}
var nw=net();if(nw&&nw!=="stellar")return;
var SE="https://api.stellar.expert/explorer/public/asset";
var H="https://horizon.stellar.org";
// Verified issuers come from the one shared list in lib.js, keyed CODE|ISSUER — never on the ticker
// alone, because a ticker is not an identity on Stellar (there are hundreds of "USDC" issuers and only
// one of them is Circle's). Stamped in at build time so the row needs no extra request to draw it.
var VFD={"XLM|":1,"USDC|GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN":1,"EURC|GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2":1,"yXLM|GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55":1,"yUSDC|GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF":1,"SHX|GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEKEBR7UCHEUUEK72N7I7KJ6JH":1,"LUMOS|GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S":1,"AQUA|GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA":1,"TDT|GBINRJAGLT2WN6DK2I47QKMKEJW56ASPO6K2GQPCLY7ZO7TAQMKUBPOG":1,"XRP|GBXRPL45NPHCVMFFAYZVUVFFVKSIZ362ZXFP7I2ETNQ3QKZMFLPRDTD5":1,"SCOP|GC6OYQJIZF3HFXCYPFCBXYXNGIBQ4TNSFUBUXQJOZWIP6F3YZK4QH3VQ":1,"MTL|GACKTN5DAZGWXRWB2WLM6OPBDHAMT6SJNGLJZPQMEZBUR4JUGBX2UK7V":1,"EURMTL|GACKTN5DAZGWXRWB2WLM6OPBDHAMT6SJNGLJZPQMEZBUR4JUGBX2UK7V":1,"ZARZ|GAROH4EV3WVVTRQKEY43GZK3XSRBEYETRVZ7SVG5LHWOAANSMCTJBB3U":1,"USDZ|GAKTLPC4ZV37SSCITQ5IS5AQ4WPF4CF4VZJQPPAROSGXMYOATF5U6XPR":1,"CLPX|GDYSPBVZHPQTYMGSYNOHRZQNLB3ZWFVQ2F7EP7YBOLRGD42XIC3QUX5G":1,"yBTC|GBUVRNH4RW4VLHP4C5MOF46RRIRZLAVHYGX45MVSTKA2F6TMR7E7L6NW":1,"yETH|GDYQNEF2UWTK4L6HITMT53MZ6F5QWO3Q4UVE6SCGC4OMEQIZQQDERQFD":1,"ARS|GCYE7C77EB5AWAA25R5XMWNI2EDOKTTFTTPZKM2SR5DI4B4WFD52DARS":1,"PEN|GA4TDPNUCZPTOHB3TKUYMDCRVATXKEADH7ZEYEBWJKQKE2UBFCYNBPEN":1,"ETH|GBFXOHVAS43OIWNIO7XLRJAHT3BICFEIKOJLZVXNT572MISM4CMGSOCC":1,"BTCLN|GDPKQ2TSNJOFSEE7XSUXPWRP27H6GFGLWD7JCHNEYYWQVGFA543EVBVT":1,"USDM|GDHDC4GBNPMENZAOBB4NCQ25TGZPDRK6ZGWUGSI22TVFATOLRPSUUSDM":1,"CETES|GCRYUGD5NVARGXT56XEZI5CIFCQETYHAPQQTHO2O3IQZTHDH4LATMYWC":1,"USTRY|GCRYUGD5NVARGXT56XEZI5CIFCQETYHAPQQTHO2O3IQZTHDH4LATMYWC":1,"SSLX|GBHFGY3ZNEJWLNO4LBUKLYOCEK4V7ENEBJGPRHHX7JU47GWHBREH37UR":1,"AFR|GBX6YI45VU7WNAAKA3RBFDR3I3UKNFHTJPQ5F6KOOKSGYIAM4TRQN54W":1,"TFT|GBOVQKJYHXRR3DX6NOX2RRYFRCUMSADGDESTDNBDS6CDVLGVESRTAC47":1,"GOLD|GBC5ZGK6MQU3XG5Y72SXPA7P5R5NHYT2475SNEJB2U3EQ6J56QLVGOLD":1,"USDY|GAJMPX5NBOG6TQFPQGRABJEEB2YE7RFRLUKJDZAZGAD5GFX4J7TADAZ6":1,"USDT0|GATISXX6BZ6NC7IKQBY37CJD4SOZL3CYZJWXEDG6JVIY4WBS6KXJHN6Q":1,"XTROOP|GARPXWTVB4QAGDZDCKV7ERN5GJTTMBSLOGPQPHYRVLYOW24CFB2SWCR5":1,"GRAT|GAJ7V3EMD3FRWAPBEJAP7EC4223XI5EACDZ46RFMY5DYOMCIMWEFR5II":1,"VELO|GDM4RQUQQUVSKQA7S6EM7XBZP3FCGH4Q7CL6TABQ7B2BEJ5ERARM2M5M":1,"PHO|GAX5TXB5RYJNLBUR477PEXM4X75APK2PGMTN6KEFQSESGWFXEAKFSXJO":1,"ACT|GAHHULDPDVGB5WS5PH7BCGLJ7ZHECDBIIMKB62UPVDUOCHNFL7HX3FS7":1,"IDRT|GDPKQ2TSNJOFSEE7XSUXPWRP27H6GFGLWD7JCHNEYYWQVGFA543EVBVT":1,"LMX|GCJF4534PAFBOQ6R7QLVMRKUQV2AMNGEXGGDDN2ISYAIN5XPKTLUMEXO":1,"LTC|GBVOL67TMUQBGL4TZYNMY3ZQ5WGQYFPFD5VJRWXR72VA33VFNL225PL5":1,"SLVR|GBZVELEQD3WBN3R3VAG64HVBDOZ76ZL6QPLSFGKWPFED33Q3234NSLVR":1,"XRF|GCHI6I3X62ND5XUMWINNNKXS2HPYZWKFQBZZYBSMHJ4MIP2XJXSZTXRF":1,"PYUSD|GDQE7IXJ4HUHV6RQHIUPRJSEZE4DRS5WY577O2FY6YQ5LVWZ7JZTU2V5":1,"sUSD|GCHW7CWI7GMIYQYFXMFJNJX5645XGWIINIAEQK3SABQO6CAYL5T7JYIH":1,"XLMG|GCVNN7O5JISPEYUTLK3JYGBDWCPDIHB4MTG4PMSJVIKJCR64NOXWI3YH":1,"BRAVE|GDREF4TAC3RFYVLHEV24CXN2VBGCEEP74BZOC3T4Q4XJ6SXJFMDPNTJL":1,"Xoge|GCELOR2TIPF6WJLVIXYQNWEO2QAABIAGGFJYHKTULOJ7MR5F5P4DSLNR":1,"LIBERATOR|GCV4LXAU5PMYTIO7P5USPE2HUKLRCV2PPMULTOQSZESFLJLVL25W6D7F":1,"JDMC|GDZ7MGCU3TH4EVXU6S7EZSCRH6VCL36L4Q436MNVLEEFFVXRLRMHGZX2":1,"Fucupcakes|GAYLMXU2ACEUZCHCFZM4OAIUJCJTU6QZBWUTVRGOB5JHLWKNVGNP2P6B":1,"TKG|GAM3PID2IOBTNCBMJXHIAS4EO3GQXAGRX4UB6HTQY2DUOVL3AQRB4UKQ":1,"PAYBO|GDNUDY5LNUVCO55LLK6H2RCOILB6EO7UOVAOGDTV3FB7Y2U45TMAXD3D":1,"FRED|GCA73U2PZFWAXJSNVMEVPNPPJCZGETWPWZC6E4DJAIWP3ZW3BAGYZLV6":1,"PYBC|GBVB43NLVIP2USHXSKI7QQCZKZU2Z6U6A5PAHMIW7LLNVMQJTOX2BZI5":1,"BLND|GDJEHTBE6ZHUXSWFI642DCGLUOECLHPF3KSXHPXTSTJ7E3JF6MQ5EZYY":1,"KALE|GBDVX4VELCDSQ54KQJYTNHXAHFLBCA77ZY2USQBM4CSHTTV7DME7KALE":1,"XXA|GC4HS4CQCZULIOTGLLPGRAAMSBDLFRR6Y7HCUQG66LNQDISXKIXXADIM":1,"XTAR|GAORYJ3KBDGIM7FFSKVUJHJ5NEFWIRDIAGGBJBJS7TY6ECZS53257IG4":1,"xLMNR|GDKA6WVMFSA73BMEVKPO6WXSSWP4MPRBDJVSXLLSEVIEVH226L5RJ7NL":1,"ARST|GCSAZVWXZKWS4XS223M5F54H2B6XPIIXZZGP7KEAIU6YSL5HDRGCI3DG":1};
var VTICK='<span class="lx-vtick" title="Verified issuer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>';
function vtick(c,i){ return (c&&i&&VFD[c+"|"+i]!==undefined)?VTICK:""; }
var LOGOS={XLM:"assets/tokens/xlm.png",USDC:"assets/tokens/usdc.png",AQUA:"assets/tokens/aqua.png",EURC:"https://assets.coingecko.com/coins/images/26045/small/euro.png",yXLM:"https://assets.coingecko.com/coins/images/100/small/fmpFRHHQ_400x400.jpg",yUSDC:"assets/tokens/usdc.png",SHX:"assets/tokens/shx.png",BLND:"assets/tokens/blnd.svg",SSLX:"assets/tokens/sslx.png",LUMOS:"assets/favicon.png"};
var GRAD=["linear-gradient(135deg,#22d3ee,#0891b2)","linear-gradient(135deg,#35c07f,#16a34a)","linear-gradient(135deg,#ea6a2c,#ff9a3d)","linear-gradient(135deg,#a855f7,#6d28d9)","linear-gradient(135deg,#3aa0ff,#1d4ed8)","linear-gradient(135deg,#f5b301,#d97706)","linear-gradient(135deg,#e0447b,#be185d)","linear-gradient(135deg,#2dd4bf,#0d9488)"];
function grad(s){s=s||"?";var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return GRAD[h%GRAD.length];}
function esc(s){return (String(s==null?"":s).replace(/[&<>"]/g,function(c){return c==="&"?"&amp;":c==="<"?"&lt;":c===">"?"&gt;":"&quot;";})).split(String.fromCharCode(39)).join("&#39;");}
function eu(s){return String(s==null?"":s).replace(/[\x27()]/g,"");}
function fmtP(n){n=+n||0;if(n>=1)return "$"+n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});if(n>=0.01)return "$"+n.toFixed(4);if(n>0){var d=Math.min(8,Math.max(4,2-Math.floor(Math.log(n)/Math.LN10)));return "$"+n.toFixed(d).replace(/0+$/,"").replace(/\.$/,"");}return "$0";}
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
// #34: TVL per asset, from a single cached edge call rather than a request per row.
//
// /lxapi/pools already returns the ranked pools with each leg and a TVL, so summing the pools an asset
// appears in costs one request for the whole list. Fetching it per asset would have meant seven or more
// Horizon calls on a page that has run into the 100-per-5-minutes limit before.
//
// The endpoint reports TVL in DOLLARS (native side x the XLM price, or the USDC side directly), and the
// row is asked for lumens -- so it is converted here, and simply omitted when no rate is known rather
// than printed against the wrong unit.
// The Binance series this file fetches lives inside a closure further down and is per-DAY history, not
// a spot rate. The spot rate the rest of the site shares is what is wanted here, so read that: the
// global if a sibling module has published it, otherwise the cache they all write.
function xlmUsdNow(){
  try{ if(window.__lxXlmUsd>0)return +window.__lxXlmUsd; }catch(_){}
  try{ var c=JSON.parse(localStorage.getItem("lumos.xlmUsd")||"null");
    if(c&&+c.v>0&&(Date.now()-c.ts<216e5))return +c.v; }catch(_){}
  return 0;
}
var _tvlUsd=null,_tvlRate=0;
function loadTvl(){
  if(_tvlUsd)return;
  // The endpoint answers with an OBJECT -- rows plus the paging figures -- and carries the XLM rate it
  // used, which is exactly the rate this conversion needs. Taking it from the same response means the
  // TVL shown can never be converted at a different rate from the one it was computed with.
  fetch("/lxapi/pools").then(function(r){return r.ok?r.json():null;}).then(function(d){
    var rows=(d&&d.rows)||null; if(!rows||!rows.length)return;
    if(d.xlmUsd>0)_tvlRate=+d.xlmUsd;
    var m={};
    rows.forEach(function(p){
      var t=+p.tvl; if(!(t>0))return;
      [p.a,p.b].forEach(function(leg){
        var c=leg&&leg.code; if(!c||c==="XLM")return;
        m[c]=(m[c]||0)+t;
      });
    });
    _tvlUsd=m; try{ render(); }catch(_){}
  }).catch(function(){});
}
function tvlLabel(a){
  if(!_tvlUsd)return "";
  var u=_tvlUsd[a.code]; if(!(u>0))return "";
  var x=_tvlRate>0?_tvlRate:xlmUsdNow(); if(!(x>0))return "";
  return "TVL "+abbr(u/x)+" XLM";
}
function metricLabel(a,tf){
  if(_metric==="trades"){var n=trOf(a,tf);return (n==null)?"Trades \u2026":(abbr(n)+" trades");}
  var v=volOf(a,tf);return "Vol $"+abbr(v||0);
}
function skeleton(){var t=tList();if(!t)return;var s="";for(var i=0;i<8;i++){s+='<div class="lx-tskel-row"><div class="lx-sk" style="width:20px;height:16px"></div><div class="lx-sk" style="width:40px;height:40px;border-radius:50%"></div><div style="flex:1"><div class="lx-sk" style="width:120px;height:15px"></div><div class="lx-sk" style="width:180px;height:12px;margin-top:7px"></div></div><div class="lx-sk" style="width:90px;height:28px"></div><div style="text-align:right"><div class="lx-sk" style="width:70px;height:16px;margin-left:auto"></div><div class="lx-sk" style="width:54px;height:20px;margin:6px 0 0 auto"></div></div><div class="lx-sk" style="width:64px;height:34px;border-radius:9px"></div></div>';}t.innerHTML=s;t.classList.remove("lx-tready");}
function render(){var t=tList();if(!t||!_roster)return;loadTvl();var tf=_tf,html="";ranked().forEach(function(a,i){var c=chg(a,tf),up=c>=0,rank=i+1;var isNew=a.created>0&&(Date.now()/1000-a.created)<21*86400;var ico=a.logo?('<div class="lx-tico" style="--lxtic:url(\x27'+eu(a.logo)+'\x27)"></div>'):('<div class="lx-tico" style="--lxtic:'+grad(a.code)+'" data-l="'+esc(a.code.slice(0,1).toUpperCase())+'"></div>');
html+='<div class="trending-row" data-lxasset="'+esc(a.code+(a.iss?("-"+a.iss):""))+'">'
+'<div class="rank '+(rank<=3?"top":"")+'">#'+rank+'</div>'+ico
+'<div class="info"><div class="nm-row"><span class="nm">'+esc(a.code)+'</span>'+vtick(a.code,a.iss)+(isNew?'<span class="new-badge">NEW</span>':'')// "Stellar" said nothing -- every asset in this list is a Stellar asset and the page is titled
// "Trending on Stellar". Replaced with the asset's own pool liquidity, which is the thing a reader
// weighing a trending token actually wants beside its volume. Dropped entirely when unknown, so the
// line never carries an empty separator.
+'</div><div class="sub">'+esc(isNew?"Just launched":a.name)+(function(){var t=tvlLabel(a);return t?(' \u00b7 '+t):'';})()+' \u00b7 '+metricLabel(a,tf)+'</div></div>'
+'<div class="spark">'+spark(sdata(a,tf),up)+'</div>'
+'<div class="price"><div class="p1">'+fmtP(a.price)+'</div><div class="p2"><span class="change-pill '+(up?"up":"down")+'">'+(up?"\u25b2":"\u25bc")+' '+pct(c)+'%</span></div></div>'
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
  box.innerHTML='<button type="button" data-lxnonav="1" data-m="vol" class="active">Highest Volume</button>'
              +'<button type="button" data-lxnonav="1" data-m="trades">Most Traded</button>';
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
var nm=x.domain||toml.name||toml.orgName||code;if(nm.length>22)nm=nm.slice(0,21)+"\u2026";
var p7=(x.price7d||[]).map(function(p){return +p[1];}).filter(function(v){return v>0;});
out.push({code:code,iss:iss,price:+x.price,p7:p7,vol7d:(+x.volume7d||0)/1e7,name:nm,logo:logo,created:+x.created||0});});if(!out.length)throw new Error("empty");
_roster=out.slice(0,25);
wireTabs();wireMetric();render();
/* The daily buckets are NOT fetched here. They cost one Horizon request per asset -- 23-25 of them --
   and Horizon allows 100 per five minutes per IP, answering a breach with a 429 that carries no CORS
   header, so the browser reports only "Failed to fetch" and the numbers silently never arrive. Loading
   the dashboard should not spend a quarter of that budget on a tab the reader may never open, so the
   pass runs when Most Traded (or the 30d period) is actually selected.
   A BLOCK comment on purpose: load() is one very long single line, so a // comment here swallows the
   rest of that line -- which is exactly how this shipped broken a moment ago. */}).catch(function(){var t=tList();if(t&&!t.classList.contains("lx-tready"))setTimeout(load,8000);});}
(function(){if(window.__lxTrendNav)return;window.__lxTrendNav=1;window.addEventListener("click",function(e){var row=e.target&&e.target.closest?e.target.closest(".trending-row[data-lxasset]"):null;if(!row)return;e.preventDefault();e.stopImmediatePropagation();location.href="lumoscore-dex-asset.html?asset="+encodeURIComponent(row.getAttribute("data-lxasset"));},true);})();
if(document.readyState!=="loading")load();else document.addEventListener("DOMContentLoaded",load);
setInterval(function(){if(_tf!=="30d")load();},120000);
})();