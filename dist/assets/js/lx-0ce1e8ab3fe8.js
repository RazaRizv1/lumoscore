
(function(){
  if(window.__lxMobDex)return;window.__lxMobDex=1;
  // Put a skeleton beside each list that is waiting on data. Runs before anything else so the boxes are
  // never empty, even on the slowest first paint, and it is inserted ONCE per list -- the marker is the
  // element itself, so a re-run finds it and does nothing.
  (function skel(){
    try{
      var lists=[".mdx-mints-list",".mdx-mover-list",".mdx-mk-list"];
      for(var i=0;i<lists.length;i++){
        var el=document.querySelector(lists[i]); if(!el||!el.parentNode)continue;
        if(el.previousElementSibling&&el.previousElementSibling.className==="lxmd-skel")continue;
        var sk=document.createElement("div"); sk.className="lxmd-skel"; sk.setAttribute("aria-hidden","true");
        // Movers is a short strip; the other two are lists. Enough bars to read as content, not a block.
        var rows=(lists[i]===".mdx-mover-list")?3:5, h="";
        for(var r=0;r<rows;r++)h+='<div class="lxmd-skel-row"></div>';
        sk.innerHTML=h;
        el.parentNode.insertBefore(sk,el);
      }
    }catch(_){}
  })();
  var DASH="—";
  function q(s,r){return (r||document).querySelector(s);}
  function esc(t){return (String(t==null?"":t).replace(/[&<>"]/g,function(c){
    return c==="&"?"&amp;":c==="<"?"&lt;":c===">"?"&gt;":"&quot;";})).split(String.fromCharCode(39)).join("&#39;");}
  function n(v){return (typeof v==="number"&&isFinite(v))?v:null;}
  function num(v,d){if(v==null||!isFinite(+v))return DASH;var x=Math.abs(+v);
    return (+v).toLocaleString(undefined,{minimumFractionDigits:0,
      maximumFractionDigits:(d!=null?d:(x>=1000?2:(x>=1?4:6)))});}
  function abbr(v){if(v==null||!isFinite(+v))return DASH;var x=+v;
    if(x>=1e9)return (x/1e9).toFixed(2)+"B";
    if(x>=1e6)return (x/1e6).toFixed(2)+"M";
    if(x>=1e3)return (x/1e3).toFixed(2)+"K";return x.toFixed(2);}
  function pct(v){return v==null?DASH:((v>=0?"+":"")+(+v).toFixed(2)+"%");}
  // Below 1e-8 a plain decimal is an unreadable run of zeros and exponential notation is trader-hostile,
  // so the zeros get counted into a subscript instead: 0.000000001234 -> 0.0(8)1234. At 1e-8 and above we
  // stay plain and trim the padding.
  //
  // Deliberately free of backslash escapes: this code is emitted through a template literal, which eats
  // one level of them -- a /\.$/ here would ship as /.$/ and delete the last digit of every price.
  var SUBD=String.fromCharCode(8320,8321,8322,8323,8324,8325,8326,8327,8328,8329);
  function zsub(n){ var s=String(n),o=""; for(var i=0;i<s.length;i++)o+=SUBD.charAt(+s.charAt(i)); return o; }
  function trimZ(t){ while(t.length>1&&t.charAt(t.length-1)==="0")t=t.slice(0,-1);
    if(t.charAt(t.length-1)===".")t=t.slice(0,-1); return t; }
  function smallNum(x,sig){ x=+x||0; if(!(x>0))return "0";
    if(x>=1e-8)return trimZ(x.toFixed(8));
    var e=x.toExponential((sig||4)-1), i=e.indexOf("e");
    if(i<0)return String(x);
    var mant=trimZ(e.slice(0,i)).split(".").join(""), exp=-parseInt(e.slice(i+1),10);
    if(!(exp>1))return trimZ(x.toFixed(8));
    return "0.0"+zsub(exp-1)+mant; }
  function fmtPrice(v){var x=+v||0;
    if(x>=1000)return x.toFixed(2);if(x>=1)return x.toFixed(4);
    if(x>=0.01)return x.toFixed(5);if(x>=0.0001)return x.toFixed(7);
    if(x>0)return smallNum(x,4);return "0";}
  function priceOf(a){return (a&&a.px!=null&&isFinite(+a.px))?+a.px:null;}
  function assets(){return window.__lxDEXassets||null;}
  // Same arithmetic the desktop mint rows use: supply x price x the XLM rate. Null unless all three are
  // in, so a partial figure is never presented as a market cap.
  function mcapOf(a){
    var xu=null;
    try{ xu=window.__lxXlmUsd||null; if(!xu){var c=JSON.parse(localStorage.getItem("lumos.xlmUsd")||"null"); if(c&&+c.v>0)xu=+c.v;} }catch(_){}
    if(!a||a.supply==null||!(a.px>0)||!(xu>0))return null;
    var m=a.supply*a.px*xu, s=Math.abs(m);
    if(s>=1e9)return "$"+(m/1e9).toFixed(2)+"B";
    if(s>=1e6)return "$"+(m/1e6).toFixed(2)+"M";
    if(s>=1e3)return "$"+(m/1e3).toFixed(1)+"K";
    return "$"+m.toFixed(2);
  }
  // #3/#7: a.chg is the move against XLM -- that is what trade_aggregations measure. On a day when XLM
  // itself rose 11%, an asset that merely held its DOLLAR value printed as a red -11%, which is what the
  // whole list was doing: USDC -10.26%, EURC -7.26%, a dollar stablecoin and a euro one apparently
  // collapsing on the same afternoon. The desktop table has converted to dollars for a while; this
  // renderer never did, so the same asset disagreed with itself depending on the device.
  //
  // _dexdata.js owns the conversion and publishes it; the fallback recomputes from the same cached
  // figure it writes, for the window before it has run. Null -- not the raw XLM number -- when XLM's own
  // move is unknown, because printing an XLM change under a dollar heading is precisely the bug.
  // #19: follows the shared denomination choice. _dexdata.js owns it; this is the fallback for the
  // window before that script has run, and it reads the same stored key so the two cannot disagree.
  function denom(){ try{ if(window.__lxDenom)return window.__lxDenom;
    var v=localStorage.getItem("lumos.dexDenom"); if(v==="xlm"||v==="usd")return v; }catch(_){}
    return "xlm"; }
  // XLM/USD from the shared cache -- the same key and the same 6h freshness window cu() uses below, so
  // the two cannot disagree about the rate within one render.
  function xu(){
    try{ var c=JSON.parse(localStorage.getItem("lumos.xlmUsd")||"null");
      if(c&&+c.v>0&&(Date.now()-c.ts<216e5))return +c.v; }catch(_){}
    return 0;
  }
  // Both fall back to lumens when the rate is unknown rather than printing a dollar sign in front of an
  // unconverted number, which would be a wrong figure rather than a missing one.
  function priceTxt(a){
    var p=priceOf(a); if(p==null)return DASH;
    if(denom()==="usd"){ var r=xu(); if(r>0)return "$"+fmtPrice(p*r); }
    return fmtPrice(p)+" XLM";
  }
  function volTxt(a){
    if(a.vol==null)return DASH;
    if(denom()==="usd"){ var r=xu(); if(r>0)return "$"+abbr(a.vol*r); }
    return abbr(a.vol)+" XLM";
  }
  function cu(a){
    if(denom()==="xlm")return (a&&a.chg!=null)?a.chg:null;
    try{ if(window.__lxChgShown&&window.__lxDenom!=="xlm")return window.__lxChgShown(a); }catch(_){}
    try{ if(window.__lxChgU)return window.__lxChgU(a); }catch(_){}
    if(!a||a.chg==null)return null;
    var xc=null;
    try{ if(window.__lxXlmChg!=null)xc=+window.__lxXlmChg;
      else{ var c=JSON.parse(localStorage.getItem("lumos.xlmUsd")||"null");
        if(c&&c.chg!=null&&(Date.now()-c.ts<216e5))xc=+c.chg; } }catch(_){}
    if(xc==null)return null;
    return ((1+a.chg/100)*(1+xc/100)-1)*100;
  }
  // Defer to the layer's own resolver so both layouts show one logo per asset. It prefers the hardcoded
  // brand logo, falls back to the stellar.toml-resolved image (a.img — which the earlier mobile code
  // ignored, so toml-only assets never got their real logo), and finally to a lettered avatar. A flat
  // brand-colour disc, which is what this used to emit, just reads as a missing logo.
  function avatarBg(code){var c=String(code||"?"),hue=0,i;
    for(i=0;i<c.length;i++)hue=(hue*31+c.charCodeAt(i))%360;
    var init=c.replace(/[^A-Za-z0-9]/g,"").slice(0,2).toUpperCase()||"?",fz=init.length>1?15:20;
    var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="hsl('
      +hue+',60%,50%)"/><text x="20" y="'+(init.length>1?26:27)+'" text-anchor="middle" '
      +'font-family="system-ui,sans-serif" font-weight="800" font-size="'+fz+'" fill="#fff">'+init+'</text></svg>';
    return 'url("data:image/svg+xml,'+encodeURIComponent(svg)+'")';}
  function logoCss(a){
    try{if(window.__lxDEXlogoCss)return window.__lxDEXlogoCss(a);}catch(_e){}
    var u=a&&(a.logo||a.img); return u?"url("+u+")":avatarBg(a&&a.code);}
  // The icon carries the code twice on purpose: data-lxic is what we paint from, data-lxc is the healer's
  // documented opt-out. See PAINTER-PROOF ICONS in STYLE.
  var VFD={"XLM|":"stellar.org","USDC|GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN":"circle.com","EURC|GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2":"circle.com","yXLM|GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55":"ultracapital.xyz","yUSDC|GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF":"ultracapital.xyz","SHX|GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEKEBR7UCHEUUEK72N7I7KJ6JH":"stronghold.co","LUMOS|GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S":"lumosdao.io","AQUA|GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA":"aqua.network","TDT|GBINRJAGLT2WN6DK2I47QKMKEJW56ASPO6K2GQPCLY7ZO7TAQMKUBPOG":"lumoscore.com","XRP|GBXRPL45NPHCVMFFAYZVUVFFVKSIZ362ZXFP7I2ETNQ3QKZMFLPRDTD5":"fchain.io","SCOP|GC6OYQJIZF3HFXCYPFCBXYXNGIBQ4TNSFUBUXQJOZWIP6F3YZK4QH3VQ":"scopuly.com","MTL|GACKTN5DAZGWXRWB2WLM6OPBDHAMT6SJNGLJZPQMEZBUR4JUGBX2UK7V":"mtl.montelibero.org","EURMTL|GACKTN5DAZGWXRWB2WLM6OPBDHAMT6SJNGLJZPQMEZBUR4JUGBX2UK7V":"mtl.montelibero.org","ZARZ|GAROH4EV3WVVTRQKEY43GZK3XSRBEYETRVZ7SVG5LHWOAANSMCTJBB3U":"zeam.money","USDZ|GAKTLPC4ZV37SSCITQ5IS5AQ4WPF4CF4VZJQPPAROSGXMYOATF5U6XPR":"zeam.money","CLPX|GDYSPBVZHPQTYMGSYNOHRZQNLB3ZWFVQ2F7EP7YBOLRGD42XIC3QUX5G":"clpx.finance","yBTC|GBUVRNH4RW4VLHP4C5MOF46RRIRZLAVHYGX45MVSTKA2F6TMR7E7L6NW":"ultracapital.xyz","yETH|GDYQNEF2UWTK4L6HITMT53MZ6F5QWO3Q4UVE6SCGC4OMEQIZQQDERQFD":"ultracapital.xyz","ARS|GCYE7C77EB5AWAA25R5XMWNI2EDOKTTFTTPZKM2SR5DI4B4WFD52DARS":"api.anclap.com","PEN|GA4TDPNUCZPTOHB3TKUYMDCRVATXKEADH7ZEYEBWJKQKE2UBFCYNBPEN":"api.anclap.com","ETH|GBFXOHVAS43OIWNIO7XLRJAHT3BICFEIKOJLZVXNT572MISM4CMGSOCC":"ultracapital.xyz","BTCLN|GDPKQ2TSNJOFSEE7XSUXPWRP27H6GFGLWD7JCHNEYYWQVGFA543EVBVT":"kbtrading.org","USDM|GDHDC4GBNPMENZAOBB4NCQ25TGZPDRK6ZGWUGSI22TVFATOLRPSUUSDM":"mtl.montelibero.org","CETES|GCRYUGD5NVARGXT56XEZI5CIFCQETYHAPQQTHO2O3IQZTHDH4LATMYWC":"etherfuse.com","USTRY|GCRYUGD5NVARGXT56XEZI5CIFCQETYHAPQQTHO2O3IQZTHDH4LATMYWC":"etherfuse.com","SSLX|GBHFGY3ZNEJWLNO4LBUKLYOCEK4V7ENEBJGPRHHX7JU47GWHBREH37UR":"sslx.sl8.online","AFR|GBX6YI45VU7WNAAKA3RBFDR3I3UKNFHTJPQ5F6KOOKSGYIAM4TRQN54W":"afreum.com","TFT|GBOVQKJYHXRR3DX6NOX2RRYFRCUMSADGDESTDNBDS6CDVLGVESRTAC47":"threefold.io","GOLD|GBC5ZGK6MQU3XG5Y72SXPA7P5R5NHYT2475SNEJB2U3EQ6J56QLVGOLD":"mintx.co","USDY|GAJMPX5NBOG6TQFPQGRABJEEB2YE7RFRLUKJDZAZGAD5GFX4J7TADAZ6":"ondo.finance","USDT0|GATISXX6BZ6NC7IKQBY37CJD4SOZL3CYZJWXEDG6JVIY4WBS6KXJHN6Q":"","XTROOP|GARPXWTVB4QAGDZDCKV7ERN5GJTTMBSLOGPQPHYRVLYOW24CFB2SWCR5":"librequidity.org","GRAT|GAJ7V3EMD3FRWAPBEJAP7EC4223XI5EACDZ46RFMY5DYOMCIMWEFR5II":"gratz.io","VELO|GDM4RQUQQUVSKQA7S6EM7XBZP3FCGH4Q7CL6TABQ7B2BEJ5ERARM2M5M":"","PHO|GAX5TXB5RYJNLBUR477PEXM4X75APK2PGMTN6KEFQSESGWFXEAKFSXJO":"app.phoenix-hub.io","ACT|GAHHULDPDVGB5WS5PH7BCGLJ7ZHECDBIIMKB62UPVDUOCHNFL7HX3FS7":"authentic-payment.com","IDRT|GDPKQ2TSNJOFSEE7XSUXPWRP27H6GFGLWD7JCHNEYYWQVGFA543EVBVT":"kbtrading.org","LMX|GCJF4534PAFBOQ6R7QLVMRKUQV2AMNGEXGGDDN2ISYAIN5XPKTLUMEXO":"lumexo.io","LTC|GBVOL67TMUQBGL4TZYNMY3ZQ5WGQYFPFD5VJRWXR72VA33VFNL225PL5":"stellarport.io","SLVR|GBZVELEQD3WBN3R3VAG64HVBDOZ76ZL6QPLSFGKWPFED33Q3234NSLVR":"mintx.co","XRF|GCHI6I3X62ND5XUMWINNNKXS2HPYZWKFQBZZYBSMHJ4MIP2XJXSZTXRF":"reflector.network","PYUSD|GDQE7IXJ4HUHV6RQHIUPRJSEZE4DRS5WY577O2FY6YQ5LVWZ7JZTU2V5":"token-metadata.paxos.com","sUSD|GCHW7CWI7GMIYQYFXMFJNJX5645XGWIINIAEQK3SABQO6CAYL5T7JYIH":"synt.tech","XLMG|GCVNN7O5JISPEYUTLK3JYGBDWCPDIHB4MTG4PMSJVIKJCR64NOXWI3YH":"stellargold.net","BRAVE|GDREF4TAC3RFYVLHEV24CXN2VBGCEEP74BZOC3T4Q4XJ6SXJFMDPNTJL":"brave-token.age-shield.com","Xoge|GCELOR2TIPF6WJLVIXYQNWEO2QAABIAGGFJYHKTULOJ7MR5F5P4DSLNR":"xoge.xmint.io","LIBERATOR|GCV4LXAU5PMYTIO7P5USPE2HUKLRCV2PPMULTOQSZESFLJLVL25W6D7F":"lumoscore.com","JDMC|GDZ7MGCU3TH4EVXU6S7EZSCRH6VCL36L4Q436MNVLEEFFVXRLRMHGZX2":"justdumbmemes.com","Fucupcakes|GAYLMXU2ACEUZCHCFZM4OAIUJCJTU6QZBWUTVRGOB5JHLWKNVGNP2P6B":"justdumbmemes.com","TKG|GAM3PID2IOBTNCBMJXHIAS4EO3GQXAGRX4UB6HTQY2DUOVL3AQRB4UKQ":"tokenglade.com","PAYBO|GDNUDY5LNUVCO55LLK6H2RCOILB6EO7UOVAOGDTV3FB7Y2U45TMAXD3D":"paybo.club","FRED|GCA73U2PZFWAXJSNVMEVPNPPJCZGETWPWZC6E4DJAIWP3ZW3BAGYZLV6":"fredenergy.org","PYBC|GBVB43NLVIP2USHXSKI7QQCZKZU2Z6U6A5PAHMIW7LLNVMQJTOX2BZI5":"luxpayband.io","BLND|GDJEHTBE6ZHUXSWFI642DCGLUOECLHPF3KSXHPXTSTJ7E3JF6MQ5EZYY":"","KALE|GBDVX4VELCDSQ54KQJYTNHXAHFLBCA77ZY2USQBM4CSHTTV7DME7KALE":"kalepail.com","XXA|GC4HS4CQCZULIOTGLLPGRAAMSBDLFRR6Y7HCUQG66LNQDISXKIXXADIM":"ixinium.io","XTAR|GAORYJ3KBDGIM7FFSKVUJHJ5NEFWIRDIAGGBJBJS7TY6ECZS53257IG4":"dogstarcoin.com","xLMNR|GDKA6WVMFSA73BMEVKPO6WXSSWP4MPRBDJVSXLLSEVIEVH226L5RJ7NL":"thelumenaire.com","ARST|GCSAZVWXZKWS4XS223M5F54H2B6XPIIXZZGP7KEAIU6YSL5HDRGCI3DG":"pubnet-sep.latamex.com"};

  // What WE show as an asset home domain where the on-chain value is stale (LUMOS still declares the
  // pre-rename lumosdao.io). Display only -- never the toml fetch, which 404s on the new domain.
  var DDOM={"LUMOS|GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S":"lumoscore.com"};
  function dispDom(c,i,d){ return DDOM[(c||"")+"|"+(i||"")]||d||""; }
  var VTICK='<span class="lx-vtick" title="Verified issuer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>';
  function vtick(a){ return (a && a.code && a.issuer && VFD[a.code+"|"+a.issuer]!==undefined) ? VTICK : ""; }
  function ico(cls,a){
    return '<span class="'+cls+' lxmd-ic" data-lxic="'+esc(a.code)+'" data-lxc="'+esc(a.code)+'"'
      +' style="--lxvar:'+esc(logoCss(a))+'"></span>';}
  function href(a){return "/trade/stellar/"+encodeURIComponent(a.code+"-"+a.issuer);}

  // We reuse the design own row classes, so the design can repaint a list with its mock rows at any
  // time. A signature stored on the CONTAINER survives that repaint, which made us skip the redraw and
  // leave Aptos mock tokens on screen. So the guard checks the rows are still OURS as well as current.
  // .lxmd-empty counts as ours too: an empty search result has no stamped rows, and without it every
  // pass would decide the list had been clobbered and repaint the same message forever.
  function stale(list,sig){
    if(list.getAttribute("data-lxmd")!==sig)return true;
    return !list.querySelector("[data-lxmd-row],.lxmd-empty");
  }

  // ---- Featured (the design calls it "New Mints") --------------------------------------------------
  // The desktop layer retitles this: the list is the CURATED launch set, not new mints. Same here,
  // rather than leaving a claim the data does not support.
  function renderMints(){
    var list=q(".mdx-mints-list");if(!list)return;var A=assets();if(!A)return;
    // The heading itself is retitled in CSS, not here — see RETITLE in STYLE.
    //
    // The SAME five the desktop shows: the newest LAUNCHPAD mints. This took A.slice(0,5) -- the curated
    // majors -- so the card headed "New mints on LumosCore" listed USDC, EURC, ARST, AQUA and yXLM, none
    // of which was minted here. The desktop already computes this (newest-first over the native roster),
    // so its own list is reused rather than a second one being derived that could drift from it.
    var d=null;
    try{ if(window.__lxDEXloadNative)window.__lxDEXloadNative();
         d=window.__lxDEXmints?window.__lxDEXmints():null; }catch(_){ d=null; }
    if(!d||!d.length)d=A.slice(0,3);              // roster not in yet: keep the placeholder rows (same count the card shows)
    // created is in the signature too: it arrives after the first paint, and without it the card kept
    // the rows it had built when the mint date was still unknown.
    var sig="m|"+d.map(function(a){return a.code+":"+(a.trades==null?"":a.trades)+":"+(a.created||0);}).join("|");
    if(!stale(list,sig))return;list.setAttribute("data-lxmd",sig);
    list.innerHTML=d.map(function(a){
      return '<div class="mdx-mint-row" data-lxmd-row="1" data-href="'+esc(href(a))+'">'
        +ico("mdx-mint-ic",a)
        +'<div><div class="mdx-mint-name">'+esc(a.code)+'</div>'
        // #27: this printed "lumoscore.com" under every row -- the same word three times on a card
        // already headed "New mints on LumosCore". Same line the desktop card now shows: how new it is.
        +'<div class="mdx-mint-sub">'+esc((function(){ try{ return (window.__lxDEXmintAge&&window.__lxDEXmintAge(a))||""; }catch(_){ return ""; } })()
            ||dispDom(a.code,a.issuer,a.domain)||"Stellar")+'</div></div>'
        +'<div class="mdx-mint-right">'
          +'<div class="mdx-mint-fig"><span class="v">'+esc(priceOf(a)==null?DASH:fmtPrice(priceOf(a))+" XLM")+'</span>'
          +'<span class="k">'+esc(mcapOf(a)==null?"":("MC "+mcapOf(a)))+'</span></div>'
          +'<div class="mdx-mint-fig"><span class="v2">'+esc(a.vol==null?DASH:abbr(a.vol)+" XLM")+'</span>'
          +'<span class="k">'+esc(a.trades==null?"":(num(a.trades,0)+(a.trades===1?" trade":" trades")))+'</span></div>'
        +'</div></div>';
    }).join("");
  }

  // ---- Market Movers -------------------------------------------------------------------------------
  // Reuses the layer's own moverData(), so Gainers/Losers/Volume order identically to desktop.
  function moverCat(){var t=q(".mdx-mover-tabs .active,.mdx-mover-tabs button.active");
    return t?((t.getAttribute("data-cat")||(t.textContent||"").trim().toLowerCase())):"gainers";}
  function renderMovers(){
    var list=q(".mdx-mover-list");if(!list)return;
    // The desktop layer paints this container now -- the same card, with the sparkline, volume, TVL
    // and trade count that this renderer never had. Standing down rather than racing it.
    if(window.__lxDEXmovers)return;
    var A=assets();if(!A)return;
    // Pass the category explicitly: moverData() otherwise reads the DESKTOP active-tab selector, which
    // does not exist here, so all three tabs came back as Gainers.
    var cat=moverCat();
    var d;try{d=window.__lxDEXmovers?window.__lxDEXmovers(cat):null;}catch(_){d=null;}
    // Do NOT pad an empty category with "the first four assets". Gainers and Losers are quality-gated
    // now, and on a day when nothing qualifies the honest answer is that nothing qualifies -- padding it
    // put arbitrary assets under a heading that claims they moved. Volume is never empty in practice.
    if(!d)d=[];
    if(!d.length&&!window.__lxDEXloaded)d=A.slice(0,10);       // still loading: keep the placeholder rows
    // The signature has to include the CONVERTED figure. Keyed on a.chg alone, the list would not repaint
// when XLM's own 24h move arrived a moment later -- every row would keep whatever it first rendered.
    var sig="v|"+cat+"|"+d.map(function(a){var c=cu(a);return a.code+":"+(c==null?"":c.toFixed(4));}).join("|");
    if(!stale(list,sig))return;list.setAttribute("data-lxmd",sig);
    if(!d.length){
      list.innerHTML='<div class="lxmd-empty">No '+(cat==="losers"?"losers":"gainers")
        +' right now among assets with real liquidity and holders.</div>';
      return;
    }
    list.innerHTML=d.map(function(a){var _cu=cu(a),up=(_cu||0)>=0;
      return '<div class="mdx-mover-row" data-lxmd-row="1" data-href="'+esc(href(a))+'">'
        +ico("mdx-mover-ic",a)
        +'<div class="mdx-mover-main"><div class="mdx-mover-pair">'+esc(a.code)+vtick(a)+'</div>'
        +'<div class="mdx-mover-sub">'+esc(dispDom(a.code,a.issuer,a.domain)||"Stellar")+'</div></div>'
        +'<div class="mdx-mover-right">'
        +'<div class="mdx-mover-price">'+esc(priceOf(a)==null?DASH:fmtPrice(priceOf(a))+" XLM")+'</div>'
        +'<div class="mdx-mover-pct '+(_cu==null?"":(up?"up":"down"))+'">'+esc(_cu==null?DASH:pct(n(_cu)))+'</div>'
        +'</div></div>';
    }).join("");
  }

  // ---- All Trading Pairs ---------------------------------------------------------------------------
  function mkFilter(){var t=q(".mdx-mk-filters .active,.mdx-mk-filters button.active");
    return t?((t.getAttribute("data-cat")||(t.textContent||"").trim().toLowerCase())):"all";}
  function mkQuery(){var i=q(".mdx-mk-search input");return i?String(i.value||"").trim().toLowerCase():"";}
  var MK_PER=50, mkPage=1, mkKey="";
  // ---- sorting -------------------------------------------------------------------------------------
  // The phone list has no column headers to click, so the control is a button in the search row that
  // opens a small sheet. Same five fields and the same rules as the desktop table, so a reader moving
  // between the two gets the same answer: biggest first on the first tap, tap again to flip, and rows
  // whose value has not been fetched sink to the bottom in BOTH directions rather than leading an
  // ascending sort with a wall of blanks.
  var MK_SORTS=[["px","Last price"],["chg","24H change"],["vol","Volume (24H)"],["trades","Trades (24H)"],["tvlUsd","Liquidity"]];
  var mkSort={key:"vol",dir:-1};                              // default: 24h volume, high to low
  // "24H change" has to sort on the figure the rows actually SHOW. Sorting the raw XLM move while
  // displaying the dollar move puts the list in an order the reader cannot see any reason for.
  function mkCmp(k,dir){ return function(a,b){ var x=(k==="chg"?cu(a):a[k]),y=(k==="chg"?cu(b):b[k]);
    var xn=(x==null||x!==x), yn=(y==null||y!==y);
    if(xn&&yn)return 0; if(xn)return 1; if(yn)return -1;
    return dir<0?(y-x):(x-y); }; }
  var SORT_IC='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v16"/><path d="M4 8l3-4 3 4"/><path d="M17 20V4"/><path d="M14 16l3 4 3-4"/></svg>';
  function sortLabel(){ if(!mkSort.key)return ""; for(var i=0;i<MK_SORTS.length;i++)if(MK_SORTS[i][0]===mkSort.key)return MK_SORTS[i][1]; return ""; }
  function closeSheet(){ var s=q(".lx-msheet"); if(s)s.classList.remove("open"); var b=q(".lx-msort"); if(b)b.classList.remove("on"); }
  function ensureSortUi(){
    var box=q(".mdx-mk-search"); if(!box)return;
    if(!box.__lxs){ box.__lxs=1; box.classList.add("lx-mkq");
      var b=document.createElement("button"); b.type="button"; b.className="lx-msort";
      b.setAttribute("aria-label","Sort pairs"); b.innerHTML=SORT_IC;
      box.appendChild(b);
      var sh=document.createElement("div"); sh.className="lx-msheet";
      sh.innerHTML=MK_SORTS.map(function(s){
        return '<button type="button" data-sk="'+s[0]+'"><span>'+s[1]+'</span><i></i></button>'; }).join("")
        + '<button type="button" data-sk="" class="lx-mreset"><span>Default order</span><i></i></button>'
        // #19: the denomination lives in this sheet because it is the only control surface the pair list
        // has on a phone, and it is the same kind of choice as the sort -- how the list is expressed.
        + '<div class="lx-mdsec">Change shown in</div>'
        + '<button type="button" data-dn="usd"><span>US dollars</span><i></i></button>'
        + '<button type="button" data-dn="xlm"><span>XLM</span><i></i></button>';
      box.appendChild(sh);
    }
    // keep the sheet and the button in step with the state on every render
    var bt=q(".lx-msort"); if(bt)bt.classList.toggle("act",!!mkSort.key);
    var sh2=q(".lx-msheet"); if(!sh2)return;
    [].slice.call(sh2.querySelectorAll("button[data-dn]")).forEach(function(o){
      var on=(o.getAttribute("data-dn")===denom());
      if(o.classList.contains("on")!==on)o.classList.toggle("on",on);
      var ic=o.querySelector("i"); if(ic){ var w=on?String.fromCharCode(10003):""; if(ic.textContent!==w)ic.textContent=w; }
    });
    [].slice.call(sh2.querySelectorAll("button[data-sk]")).forEach(function(o){
      var k=o.getAttribute("data-sk"), on=(k===mkSort.key)&&(k!=="");
      if(o.classList.contains("on")!==on)o.classList.toggle("on",on);
      // fromCharCode, not a "\\uXXXX" escape: this file's browser code is not emitted through a template
      // literal, so the escape survived into the page as the six literal characters ▲.
      var i=o.querySelector("i"); if(i){ var w=on?String.fromCharCode(mkSort.dir<0?9660:9650):""; if(i.textContent!==w)i.textContent=w; }
    });
  }
  // Window capture, for the same reason the desktop headers need it: the design ships a delegated
  // navigation handler on document capture, so a listener on the button itself never sees the click.
  function installSortUi(){
    if(window.__lxMDXsort)return; window.__lxMDXsort=1;
    window.addEventListener("click",function(e){
      var t=e.target; if(!t||!t.closest)return;
      var bt=t.closest(".lx-msort");
      if(bt){ e.preventDefault(); e.stopImmediatePropagation();
        var s=q(".lx-msheet"); if(s){ var open=!s.classList.contains("open"); s.classList.toggle("open",open); bt.classList.toggle("on",open); }
        return; }
      // #19: the denomination options share the sheet with the sort options, so they are matched first
      // and separately -- a [data-sk] lookup would not see them, and letting them fall through to the
      // tap-outside branch below would close the sheet without changing anything.
      var dn=t.closest(".lx-msheet button[data-dn]");
      if(dn){ e.preventDefault(); e.stopImmediatePropagation();
        var dv=dn.getAttribute("data-dn");
        try{ if(window.__lxDenomSet)window.__lxDenomSet(dv); else { window.__lxDenom=dv; localStorage.setItem("lumos.dexDenom",dv); } }catch(_){}
        // force a repaint: the row signature is built from the CONVERTED figure, so changing what that
        // figure means has to invalidate it or every row keeps the number it already had.
        try{ [".mdx-mk-list",".mdx-mover-list"].forEach(function(sel){var el=q(sel); if(el)el.removeAttribute("data-lxmd");}); }catch(_){}
        closeSheet(); try{ pass(); }catch(_){}
        return; }
      var op=t.closest(".lx-msheet button[data-sk]");
      if(op){ e.preventDefault(); e.stopImmediatePropagation();
        var k=op.getAttribute("data-sk");
        // "Default order" restores the DEFAULT, which is now volume high-to-low -- not "no sorting".
        // Clearing to "" would leave the roster order, which the label no longer describes.
        if(!k){ mkSort.key="vol"; mkSort.dir=-1; }
        else if(mkSort.key===k)mkSort.dir=-mkSort.dir;
        else { mkSort.key=k; mkSort.dir=-1; }
        mkPage=1; closeSheet(); try{ pass(); }catch(_){}
        return; }
      if(!t.closest(".lx-msheet"))closeSheet();     // a tap anywhere else puts the sheet away
    },true);
  }
  // One line: [Curated] [filter .......]. See note above -- needs a real wrapper, not CSS.
  function mkOneLine(){
    var f=q(".mdx-mk-filters"), s=q(".mdx-mk-search");
    if(!f||!s||!f.parentNode)return;
    if(f.parentNode.className&&String(f.parentNode.className).indexOf("lx-mkrow")>=0)return;
    var w=document.createElement("div"); w.className="lx-mkrow";
    f.parentNode.insertBefore(w,f); w.appendChild(f); w.appendChild(s);
  }
  // Mobile keeps its OWN copy of the verified map, so the merge added to the desktop script never
  // reached it: an asset curated after the last build was ticked on desktop and bare on the phone.
  // Shares the one request the other blocks already make.
  function lxMobMergeV(){
    window.__lxCuratedV=window.__lxCuratedV||fetch("/lxapi/assetmeta")
      .then(function(r){return r.ok?r.json():null;})
      .then(function(d){return (d&&d.verified)||{};}).catch(function(){return {};});
    window.__lxCuratedV.then(function(vf){ var added=0;
      Object.keys(vf).forEach(function(id){ var r=vf[id]; if(!r||!r.v)return;
        var i=id.lastIndexOf("-"); if(i<0)return;
        var k=id.slice(0,i)+"|"+id.slice(i+1);
        if(VFD[k]===undefined){ VFD[k]=r.d||""; added++; } });
      if(!added)return;
      // The row signature is built from code and price, so a changed tick map does not move it and
      // the staleness guard would skip the repaint. Clearing it is what makes the ticks appear.
      try{ var l=q(".mdx-mk-list"); if(l)l.removeAttribute("data-lxmd"); }catch(_){}
      try{ renderPairs(); }catch(_){}
    });
  }
  function renderPairs(){
    try{ mkOneLine(); }catch(_){}
    var list=q(".mdx-mk-list");if(!list)return;var A=assets();if(!A)return;
    var cat=mkFilter(),qy=mkQuery();
    // The native roster is not part of __lxDEXassets -- it is discovered on demand by the desktop data
    // layer (which is injected here too) so the curated roster, and the headline volume/TVL sums built
    // from it, stay exactly as they were.
    var nv=null;
    try{ if(window.__lxDEXloadNative)window.__lxDEXloadNative();
         nv=window.__lxDEXnativeList?window.__lxDEXnativeList():null; }catch(_){}
    var NL=(nv&&nv.list)||[], src;
    // All = curated majors + our own tokens; identity dedupe (LUMOS is the same object in both).
    // Identity dedupe on code+issuer. Object identity cannot catch two distinct objects describing the
    // same asset, which is how TDT reached the list twice.
    // Names deliberately prefixed. "q" is this file's DOM query helper, and a for(var q=...) loop here
    // hoists q to a local number for the WHOLE function -- so q(".mdx-mk-list") on the first line became
    // undefined(...) and renderPairs threw on every pass. pass() swallows exceptions, so the list simply
    // froze on its last good render with nothing in the console.
    var zSeen={};
    function zPut(dst,a){ if(!a)return; var id=a.code+"|"+a.issuer; if(zSeen[id])return; zSeen[id]=1; dst.push(a); }
    src=[];
    if(cat==="native"){ for(var zi=0;zi<NL.length;zi++)zPut(src,NL[zi]); }
    else { for(var zj=0;zj<A.length;zj++)zPut(src,A[zj]); }
    var d=src.filter(function(a){
      if(cat&&cat!=="all"&&cat!=="native"){var c=String(a.cat||"").toLowerCase();
        if(c!==cat&&c+"s"!==cat)return false;}
      // code + issuer + domain. The box says "ticker or address" but the issuer was not in the haystack,
      // so pasting an address matched nothing. Desktop already searched all three.
      if(qy&&String(a.code||"").toLowerCase().indexOf(qy)<0)return false;
      return true;});
    // Sorted before paging, so page 1 holds the top of the SORTED list rather than the top of the
    // unsorted one re-ordered within itself.
    if(mkSort.key)d=d.slice().sort(mkCmp(mkSort.key,mkSort.dir));
    try{ ensureSortUi(); installSortUi(); }catch(_){}
    // A new filter, search or order starts at page 1; a data refresh does not.
    var fkey=cat+"|"+qy+"|"+mkSort.key+mkSort.dir; if(mkKey!==fkey){ mkKey=fkey; mkPage=1; }
    var pages=Math.max(1,Math.ceil(d.length/MK_PER)); if(mkPage>pages)mkPage=pages;
    var start=(mkPage-1)*MK_PER, all=d; d=all.slice(start,start+MK_PER);
    // Ask the data layer to price THIS page's rows. Only the five newest launchpad tokens are priced up
    // front; the rest are fetched when a row is rendered, and the desktop list does that itself. Nothing
    // here ever asked, so 26 of 32 sat at "0 XLM / —" -- and they had not simply never traded:
    // LIBERATOR, BLA and TDT had each traded within the hour. It was a missing request, not a dead market.
    // priceVisible dedupes and caches, so calling it per render is cheap and repaint-safe.
    try{ if(window.__lxDEXpriceRows)window.__lxDEXpriceRows(d); }catch(_){}
    var sig="p|"+denom()+"|"+cat+"|"+qy+"|"+mkPage+"/"+pages+"|"+d.map(function(a){return a.code+":"+(priceOf(a)==null?"":a.px);}).join("|");
    if(!stale(list,sig))return;list.setAttribute("data-lxmd",sig);
    if(!d.length){list.innerHTML='<div class="lxmd-empty">No pairs match</div>';return;}
    var pgh=pages<2?"":('<div class="lxmd-pager">'
      +'<button class="lxmd-pg" data-pg="'+(mkPage-1)+'"'+(mkPage<=1?" disabled":"")+'>Prev</button>'
      +'<span class="lxmd-pg-info">Page '+mkPage+' of '+pages+'</span>'
      +'<button class="lxmd-pg" data-pg="'+(mkPage+1)+'"'+(mkPage>=pages?" disabled":"")+'>Next</button>'
      +'</div>');
    // #25: rank the curated list. The order is meaningful -- it is the sort the reader picked -- but
    // nothing on the row said so, and a list that looks unordered invites the question of why USDC
    // is first. The number is the row's position in the list as displayed, so it follows the sort.
    list.innerHTML=d.map(function(a,_i){var _cu=cu(a),up=(_cu||0)>=0;
      return '<div class="mdx-mk-row" data-lxmd-row="1" data-href="'+esc(href(a))+'">'
        // Position in the WHOLE sorted list, not in this page of it. _i restarts at 0 on every page, so
        // page 2 opened at #1 again and the ranking silently became a per-page row number -- two rows
        // called #1 in one list, and no way to tell 26th from 1st. start is the offset of this page.
        +'<span class="mdx-mk-rank">#'+(start+_i+1)+'</span>'
        +'<div class="mdx-mk-top">'+ico("mdx-mk-ic",a)
        +'<div class="mdx-mk-meta"><div class="mdx-mk-name-row">'
        +'<span class="mdx-mk-name">'+esc(a.code)+vtick(a)+'</span>'
        +'<span class="mdx-mk-domain">'+esc(dispDom(a.code,a.issuer,a.domain)||"Stellar")+'</span></div>'
        // Trades beside volume. The desktop table has carried a TRADES (24H) column for a while and the
        // field is already on the asset -- a.trades, the same trade_count the aggregate is built from --
        // so this is a field that was fetched and then not shown, not a new request. Omitted rather than
        // dashed when it is null: an unpriced pair already shows one dash on this line and a second
        // would read as two broken figures instead of one missing one.
        +'<div class="mdx-mk-vol">Vol '+esc(volTxt(a))
          +(a.trades!=null?('<span class="mdx-mk-trades">'+esc(num(a.trades,0))+' trades</span>'):'')
          +'</div></div>'
        +'<div class="mdx-mk-right">'
        +'<div class="mdx-mk-price">'+esc(priceTxt(a))+'</div>'
        +'<div class="mdx-mk-pct '+(_cu==null?"":(up?"up":"down"))+'">'+esc(_cu==null?DASH:pct(n(_cu)))+'</div>'
        +'</div></div></div>';
    }).join("")+pgh;
  }

  // ---- tabs, filters, search, row navigation -------------------------------------------------------
  function wire(){
    if(window.__lxmdWired)return;window.__lxmdWired=1;
    // WINDOW-capture, the earliest phase, for the same reason the desktop layer uses it: the design has
    // its own delegated nav handler on DOCUMENT capture. A document-capture listener here loses that race
    // and the design's handler wins, which is why tapping a row re-served the Trade page instead of the
    // asset page. stopImmediatePropagation, not stopPropagation — the latter still lets other listeners
    // on the same node and phase run, and the design's is one of them.
    window.addEventListener("click",function(e){
      var t=e.target;if(!t||!t.closest)return;
      // Tabs and filters are the design's to handle (it owns the .active toggle); only schedule a repaint.
      if(t.closest(".mdx-mover-tabs")||t.closest(".mdx-mk-filters")){
        setTimeout(pass,30);setTimeout(pass,240);return;}
      // Before the row check: a pager button sits outside any [data-href], but claiming it here keeps
      // the design's own delegated handlers off it entirely.
      var pgb=t.closest(".lxmd-pg[data-pg]");
      if(pgb){ if(!pgb.disabled){ e.preventDefault(); e.stopImmediatePropagation();
          mkPage=+pgb.getAttribute("data-pg")||1; renderPairs();
          try{ var hd=q(".mdx-section-head"); if(hd&&hd.scrollIntoView)hd.scrollIntoView({block:"start"}); }catch(_){} }
        return; }
      var row=t.closest("[data-href]");
      if(row&&/mdx-(mint|mover|mk)-row/.test(String(row.className||""))){
        e.preventDefault();e.stopImmediatePropagation();
        location.href=row.getAttribute("data-href");}
    },true);
    var si=q(".mdx-mk-search input");
    if(si)si.addEventListener("input",function(){setTimeout(pass,0);});
  }
  // Logos resolved from stellar.toml land AFTER the first render, and a late logo alone does not change
  // a row's signature, so nothing would repaint. Re-applying the variable each pass costs nothing and is
  // what the desktop layer's paintIcons does.
  var LXMQ={};
  // Neither the initials disc nor a third-party index can know about a logo uploaded in the admin
  // panel. /lxapi/assetlogo is the one resolver that merges our own overrides, and it is asked only
  // for an asset that resolved to nothing -- a row with artwork costs no request.
  function lxMobLogo(a){ var k=a.code+"-"+a.issuer; if(LXMQ[k]!==undefined)return; LXMQ[k]=null;
    fetch("/lxapi/assetlogo?v=2&asset="+encodeURIComponent(k))
      .then(function(r){ return r.ok?r.json():null; })
      .then(function(j){ var u=j&&j.image; if(u){ a.img=u; try{ repaintIcons(); }catch(_){} } })
      .catch(function(){}); }
  function repaintIcons(){
    var A=assets();if(!A)return;var by={};
    A.forEach(function(a){by[a.code]=a;});
    [].slice.call(document.querySelectorAll("[data-lxic]")).forEach(function(ic){
      var a=by[ic.getAttribute("data-lxic")];if(!a)return;
      var css=logoCss(a);
      if(css&&ic.style.getPropertyValue("--lxvar")!==css)ic.style.setProperty("--lxvar",css);
      if(a.code&&a.issuer&&!a.logo&&!a.img)lxMobLogo(a);});
  }
  // ---- Section order + mover tabs (mobile layout) ---------------------------------------------------
  // Trading pairs first, then the mints card, then Market Movers. The design ships them the other way
  // round, and each section is a run of SIBLINGS under .page (head, then its controls, then its list)
  // rather than one wrapper each -- so the whole run moves, in order, or the heads end up over the wrong
  // lists. Idempotent: it only acts when the order is actually wrong, so the 900ms pass cannot thrash it.
  function orderSections(){
    var page=q(".page"); if(!page)return;
    var kids=[].slice.call(page.children);
    function headByText(re){ for(var i=0;i<kids.length;i++){
      var k=kids[i]; if(k.className&&String(k.className).indexOf("mdx-section-head")>=0&&re.test(k.textContent||""))return k; } return null; }
    var pairsHead=headByText(/trading pairs/i), moversHead=headByText(/market movers/i);
    var mints=page.querySelector(".mdx-mints-card");
    if(!pairsHead||!moversHead||!mints)return;
    // A section is its head plus every sibling up to the next head.
    function run(head){
      var out=[head], n=head.nextElementSibling;
      while(n&&!(n.className&&String(n.className).indexOf("mdx-section-head")>=0)){ out.push(n); n=n.nextElementSibling; }
      return out;
    }
    var pairs=run(pairsHead), movers=run(moversHead);
    // Already in the wanted order? Then leave the DOM alone.
    if(pairs[0].compareDocumentPosition(mints)&Node.DOCUMENT_POSITION_FOLLOWING &&
       mints.compareDocumentPosition(movers[0])&Node.DOCUMENT_POSITION_FOLLOWING) return;
    var anchor=mints.previousElementSibling;          // keep everything above the mints card where it is
    var frag=document.createDocumentFragment();
    pairs.forEach(function(el){frag.appendChild(el);});
    frag.appendChild(mints);
    movers.forEach(function(el){frag.appendChild(el);});
    if(anchor&&anchor.parentNode===page)page.insertBefore(frag,anchor.nextSibling);
    else page.appendChild(frag);
  }
  // Volume first and selected by default: it is the tab that answers "what is actually being traded",
  // and unlike a percentage it cannot be manufactured on a dead asset. Gainers and Losers follow.
  function orderMoverTabs(){
    var bar=q(".mdx-mover-tabs"); if(!bar||bar.__lxOrd)return;
    var want=["volume","gainers","losers"], have={};
    [].slice.call(bar.children).forEach(function(b){ var c=b.getAttribute&&b.getAttribute("data-cat"); if(c)have[c]=b; });
    if(!have.volume||!have.gainers||!have.losers)return;
    bar.__lxOrd=1;
    want.forEach(function(c){ bar.appendChild(have[c]); });
    // Only claim the default when the user has not chosen yet -- re-asserting it on every pass would
    // drag them back to Volume mid-browse.
    if(!bar.__lxDef){ bar.__lxDef=1;
      want.forEach(function(c){ have[c].classList.toggle("active",c==="volume"); });
    }
  }
  // items 16 + 18: hide a whole section -- its head plus every sibling up to the next head.
  function hideRun(re){
    var page=q(".page"); if(!page)return;
    var kids=[].slice.call(page.children), head=null;
    for(var i=0;i<kids.length;i++){
      var k=kids[i];
      if(k.className&&String(k.className).indexOf("mdx-section-head")>=0&&re.test(k.textContent||"")){ head=k; break; }
    }
    if(!head)return;
    head.classList.add("lx-mdgone");
    for(var n=head.nextElementSibling;n&&!(n.className&&String(n.className).indexOf("mdx-section-head")>=0);n=n.nextElementSibling)
      n.classList.add("lx-mdgone");
  }
  function hideDropped(){
    try{ hideRun(/new mints/i); }catch(_){}
    try{ hideRun(/market movers/i); }catch(_){}
    // The mints card is its own node on this layout and can sit outside the run.
    try{ var mc=q(".mdx-mints-card"); if(mc)mc.classList.add("lx-mdgone"); }catch(_){}
  }
  function pass(){try{
    orderSections();orderMoverTabs();
    hideDropped();
    wire();renderMints();renderMovers();renderPairs();repaintIcons();try{lxMobMergeV();}catch(_){}
    // Hold the reveal until the ORDER is real, not merely until assets exist. The list defaults to 24h
    // volume, and __lxDEXassets appears as soon as the eight majors are priced -- the launchpad roster
    // lands after that, so revealing on assets() alone showed volume order for the majors and then
    // re-sorted when the rest arrived. __lxDEXsortReady is raised by the data layer when both halves are
    // in, and it carries that layer's own 6s backstop, so this cannot hang waiting.
    if(assets()&&(window.__lxDEXsortReady||!mkSort.key)&&!document.body.classList.contains("lxmd-ready"))
      document.body.classList.add("lxmd-ready");
  }catch(_){}}
  if(document.readyState!=="loading")pass();else document.addEventListener("DOMContentLoaded",pass);
  setInterval(pass,900);
})();
