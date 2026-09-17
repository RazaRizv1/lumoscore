(function(){
  // Verified issuers come from _tools/lib.js so every page ticks the same set — a list that drifted
  // between screens would make an asset trustworthy here and not there.
  var VFD={"XLM|":"stellar.org","USDC|GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN":"circle.com","EURC|GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2":"circle.com","yXLM|GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55":"ultracapital.xyz","yUSDC|GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF":"ultracapital.xyz","SHX|GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEKEBR7UCHEUUEK72N7I7KJ6JH":"stronghold.co","LUMOS|GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S":"lumosdao.io","AQUA|GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA":"aqua.network","TDT|GBINRJAGLT2WN6DK2I47QKMKEJW56ASPO6K2GQPCLY7ZO7TAQMKUBPOG":"lumoscore.com","XRP|GBXRPL45NPHCVMFFAYZVUVFFVKSIZ362ZXFP7I2ETNQ3QKZMFLPRDTD5":"fchain.io","SCOP|GC6OYQJIZF3HFXCYPFCBXYXNGIBQ4TNSFUBUXQJOZWIP6F3YZK4QH3VQ":"scopuly.com","MTL|GACKTN5DAZGWXRWB2WLM6OPBDHAMT6SJNGLJZPQMEZBUR4JUGBX2UK7V":"mtl.montelibero.org","EURMTL|GACKTN5DAZGWXRWB2WLM6OPBDHAMT6SJNGLJZPQMEZBUR4JUGBX2UK7V":"mtl.montelibero.org","ZARZ|GAROH4EV3WVVTRQKEY43GZK3XSRBEYETRVZ7SVG5LHWOAANSMCTJBB3U":"zeam.money","USDZ|GAKTLPC4ZV37SSCITQ5IS5AQ4WPF4CF4VZJQPPAROSGXMYOATF5U6XPR":"zeam.money","CLPX|GDYSPBVZHPQTYMGSYNOHRZQNLB3ZWFVQ2F7EP7YBOLRGD42XIC3QUX5G":"clpx.finance","yBTC|GBUVRNH4RW4VLHP4C5MOF46RRIRZLAVHYGX45MVSTKA2F6TMR7E7L6NW":"ultracapital.xyz","yETH|GDYQNEF2UWTK4L6HITMT53MZ6F5QWO3Q4UVE6SCGC4OMEQIZQQDERQFD":"ultracapital.xyz","ARS|GCYE7C77EB5AWAA25R5XMWNI2EDOKTTFTTPZKM2SR5DI4B4WFD52DARS":"api.anclap.com","PEN|GA4TDPNUCZPTOHB3TKUYMDCRVATXKEADH7ZEYEBWJKQKE2UBFCYNBPEN":"api.anclap.com","ETH|GBFXOHVAS43OIWNIO7XLRJAHT3BICFEIKOJLZVXNT572MISM4CMGSOCC":"ultracapital.xyz","BTCLN|GDPKQ2TSNJOFSEE7XSUXPWRP27H6GFGLWD7JCHNEYYWQVGFA543EVBVT":"kbtrading.org","USDM|GDHDC4GBNPMENZAOBB4NCQ25TGZPDRK6ZGWUGSI22TVFATOLRPSUUSDM":"mtl.montelibero.org","CETES|GCRYUGD5NVARGXT56XEZI5CIFCQETYHAPQQTHO2O3IQZTHDH4LATMYWC":"etherfuse.com","USTRY|GCRYUGD5NVARGXT56XEZI5CIFCQETYHAPQQTHO2O3IQZTHDH4LATMYWC":"etherfuse.com","SSLX|GBHFGY3ZNEJWLNO4LBUKLYOCEK4V7ENEBJGPRHHX7JU47GWHBREH37UR":"sslx.sl8.online","AFR|GBX6YI45VU7WNAAKA3RBFDR3I3UKNFHTJPQ5F6KOOKSGYIAM4TRQN54W":"afreum.com","TFT|GBOVQKJYHXRR3DX6NOX2RRYFRCUMSADGDESTDNBDS6CDVLGVESRTAC47":"threefold.io","GOLD|GBC5ZGK6MQU3XG5Y72SXPA7P5R5NHYT2475SNEJB2U3EQ6J56QLVGOLD":"mintx.co","USDY|GAJMPX5NBOG6TQFPQGRABJEEB2YE7RFRLUKJDZAZGAD5GFX4J7TADAZ6":"ondo.finance","FRED|GCA73U2PZFWAXJSNVMEVPNPPJCZGETWPWZC6E4DJAIWP3ZW3BAGYZLV6":"fredenergy.org","PYBC|GBVB43NLVIP2USHXSKI7QQCZKZU2Z6U6A5PAHMIW7LLNVMQJTOX2BZI5":"luxpayband.io","BLND|GDJEHTBE6ZHUXSWFI642DCGLUOECLHPF3KSXHPXTSTJ7E3JF6MQ5EZYY":"","KALE|GBDVX4VELCDSQ54KQJYTNHXAHFLBCA77ZY2USQBM4CSHTTV7DME7KALE":"kalepail.com","XXA|GC4HS4CQCZULIOTGLLPGRAAMSBDLFRR6Y7HCUQG66LNQDISXKIXXADIM":"ixinium.io","XTAR|GAORYJ3KBDGIM7FFSKVUJHJ5NEFWIRDIAGGBJBJS7TY6ECZS53257IG4":"dogstarcoin.com","xLMNR|GDKA6WVMFSA73BMEVKPO6WXSSWP4MPRBDJVSXLLSEVIEVH226L5RJ7NL":"thelumenaire.com","ARST|GCSAZVWXZKWS4XS223M5F54H2B6XPIIXZZGP7KEAIU6YSL5HDRGCI3DG":"pubnet-sep.latamex.com"};

  // What WE show as an asset home domain where the on-chain value is stale (LUMOS still declares the
  // pre-rename lumosdao.io). Display only -- never the toml fetch, which 404s on the new domain.
  var DDOM={"LUMOS|GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S":"lumoscore.com"};
  function dispDom(c,i,d){ return DDOM[(c||"")+"|"+(i||"")]||d||""; }
  var VTICK='<span class="lx-vtick" title="Verified issuer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>';
  function vtick(c,i){ return VFD[c+"|"+i]!==undefined?VTICK:""; }
  if(window.__lxDEX)return;window.__lxDEX=true;
  var H="https://horizon.stellar.org";                       // MAINNET (+ lobstr fallback in j())
  var CG="https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd&include_24hr_change=true";
  var LUMOS_LOGO="/assets/tokens/lumos.png";

  // ---- curated real mainnet asset universe (no all-markets endpoint exists on Horizon) ----
  // logo = hardcoded real logo URL so it renders IMMEDIATELY (no placeholder-avatar flash); toml image is a
  // best-effort upgrade only for assets without a hardcoded one.
  var ASSETS=[
    // Eleven added so the curated list is deep enough to fill Gainers, Losers and Volume without
    // padding them -- see #34. Every one carries a verified tick, and every tick was earned by the
    // handshake described in lib.js rather than by appearing in an index.
    // TDT is ours: minted on the launchpad, listed in lumoscore.com's stellar.toml with code, issuer
    // and image, and already in the admin curated list. It carried the verified tick everywhere that
    // reads that list -- the Trade-Asset page, search, wallet, account -- but not here, because THIS
    // table is a hardcoded universe rather than a read of the curated list. Adding an asset in the
    // admin panel therefore cannot put it on Trade main; it has to be added here as well.
    // Logo comes from our own manifest rather than meta.stellar.expert, since we host it.
    {code:"TDT", issuer:"GBINRJAGLT2WN6DK2I47QKMKEJW56ASPO6K2GQPCLY7ZO7TAQMKUBPOG", cat:"utility", b:"#3a3f4b", logo:"/assets/tokens/TDT-GBINRJAGLT2WN6DK2I47QKMKEJW56ASPO6K2GQPCLY7ZO7TAQMKUBPOG.jpg"},
    {code:"XRP", issuer:"GBXRPL45NPHCVMFFAYZVUVFFVKSIZ362ZXFP7I2ETNQ3QKZMFLPRDTD5", cat:"utility", b:"#23292f", logo:"https://meta.stellar.expert/nucngezl7i5tkm234qvcaoh2bj3vjwplvpay6yi7tqnih6puiyha"},
    {code:"SCOP", issuer:"GC6OYQJIZF3HFXCYPFCBXYXNGIBQ4TNSFUBUXQJOZWIP6F3YZK4QH3VQ", cat:"utility", b:"#2f6fed", logo:"https://meta.stellar.expert/6mixn2ch4cd46jgellalrjnzfhgtuavwoylx3dzx4e7hbx57mnlq"},
    {code:"MTL", issuer:"GACKTN5DAZGWXRWB2WLM6OPBDHAMT6SJNGLJZPQMEZBUR4JUGBX2UK7V", cat:"utility", b:"#c0392b", logo:"https://meta.stellar.expert/2lwcjvyaiye2plbkkhesvwammffe7nr4edi7tw55jj3gm2yrhovq"},
    {code:"EURMTL", issuer:"GACKTN5DAZGWXRWB2WLM6OPBDHAMT6SJNGLJZPQMEZBUR4JUGBX2UK7V", cat:"stable", b:"#1a4fb4", logo:"https://meta.stellar.expert/i3xpydw6q4ruxrn5tguyj2ee77ghjq2poq27bqt5iu54amq7xezq"},
    {code:"ZARZ", issuer:"GAROH4EV3WVVTRQKEY43GZK3XSRBEYETRVZ7SVG5LHWOAANSMCTJBB3U", cat:"stable", b:"#0f9d58", logo:"https://meta.stellar.expert/wvpr5ldqyxaoh2fpkaamfgoigeyinbyf5fju3kkb6onn2eoclzma"},
    {code:"USDZ", issuer:"GAKTLPC4ZV37SSCITQ5IS5AQ4WPF4CF4VZJQPPAROSGXMYOATF5U6XPR", cat:"stable", b:"#137a4b", logo:"https://meta.stellar.expert/wvpr5ldqyxaoh2fpkaamfgoigeyinbyf5fju3kkb6onn2eoclzma"},
    {code:"CLPX", issuer:"GDYSPBVZHPQTYMGSYNOHRZQNLB3ZWFVQ2F7EP7YBOLRGD42XIC3QUX5G", cat:"stable", b:"#d64545", logo:"https://meta.stellar.expert/i2yuqfjqb2hdtfjdue7v4y4c5mdsnonclqnmhyqie5rrbim4i3xq"},
    {code:"yBTC", issuer:"GBUVRNH4RW4VLHP4C5MOF46RRIRZLAVHYGX45MVSTKA2F6TMR7E7L6NW", cat:"utility", b:"#f7931a", logo:"https://meta.stellar.expert/rrln3zdn66zxs5pod24zdgkrkruvt5df22nezwu7jm4pz7voteaa"},
    {code:"yETH", issuer:"GDYQNEF2UWTK4L6HITMT53MZ6F5QWO3Q4UVE6SCGC4OMEQIZQQDERQFD", cat:"utility", b:"#627eea", logo:"https://meta.stellar.expert/bd4mdtcoiu3wdfhqk344elj5xzsaosown44sjwihepapcg6nilra"},
    {code:"ARS", issuer:"GCYE7C77EB5AWAA25R5XMWNI2EDOKTTFTTPZKM2SR5DI4B4WFD52DARS", cat:"stable", b:"#74acdf", logo:"https://meta.stellar.expert/6osba22g5idn6odtow3fr26gwtuvzjx7bjvoue7br6n7ockjd6qa"},
    {code:"PEN", issuer:"GA4TDPNUCZPTOHB3TKUYMDCRVATXKEADH7ZEYEBWJKQKE2UBFCYNBPEN", cat:"stable", b:"#d91023", logo:"https://meta.stellar.expert/wbjfnkcaiv4dld6eqz57rr2i4cglpigr7yhhusszahk7jenxvvlq"},
    {code:"USDC", issuer:"GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", cat:"stable",  b:"#2775ca", logo:"https://assets.coingecko.com/coins/images/6319/small/usdc.png"},
    {code:"EURC", issuer:"GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2", cat:"stable",  b:"#1a4fb4", logo:"https://assets.coingecko.com/coins/images/26045/small/euro.png"},
    {code:"ARST", issuer:"GCSAZVWXZKWS4XS223M5F54H2B6XPIIXZZGP7KEAIU6YSL5HDRGCI3DG", cat:"stable",  b:"#5b9bd5"},
    {code:"AQUA", issuer:"GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA", cat:"utility", b:"#7b3ff2", logo:"https://aqua.network/assets/img/aqua-logo.png"},
    {code:"yXLM", issuer:"GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55", cat:"utility", b:"#08b5e5", logo:"https://assets.coingecko.com/coins/images/100/small/fmpFRHHQ_400x400.jpg"},
    {code:"SHX",  issuer:"GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEKEBR7UCHEUUEK72N7I7KJ6JH", cat:"utility", b:"#3fb89a"},
    {code:"LUMOS",issuer:"GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S", cat:"utility", b:"#ea6a2c", logo:"/assets/tokens/lumos.png"},

    // #35: ten more, every one handshake-verified in lib.js under the same issuer. Logos are the
    // issuer's OWN image from its stellar.toml -- the most authoritative source there is for what an
    // asset looks like -- and each URL was fetched and confirmed to return a real image before being
    // hardcoded here, since the whole point of hardcoding is that it renders with no placeholder flash.
    {code:"ETH", issuer:"GBFXOHVAS43OIWNIO7XLRJAHT3BICFEIKOJLZVXNT572MISM4CMGSOCC", cat:"utility", b:"#627eea", logo:"https://ultracapital.xyz/static/images/icons/ETH.png"},
    {code:"BTCLN", issuer:"GDPKQ2TSNJOFSEE7XSUXPWRP27H6GFGLWD7JCHNEYYWQVGFA543EVBVT", cat:"utility", b:"#f7931a", logo:"https://kbtrading.org/static/Bitcoin_lightning_logo.png"},
    {code:"USDM", issuer:"GDHDC4GBNPMENZAOBB4NCQ25TGZPDRK6ZGWUGSI22TVFATOLRPSUUSDM", cat:"stable", b:"#1e8e5a", logo:"https://mtl.montelibero.org/images/USDM100.png"},
    {code:"CETES", issuer:"GCRYUGD5NVARGXT56XEZI5CIFCQETYHAPQQTHO2O3IQZTHDH4LATMYWC", cat:"stable", b:"#006847", logo:"https://stablebonds.s3.us-west-2.amazonaws.com/stablebond/spl-cetes.png"},
    {code:"USTRY", issuer:"GCRYUGD5NVARGXT56XEZI5CIFCQETYHAPQQTHO2O3IQZTHDH4LATMYWC", cat:"stable", b:"#1f4e79", logo:"https://stablebonds.s3.us-west-2.amazonaws.com/stablebond/spl-ustry.png"},
    {code:"USDY", issuer:"GAJMPX5NBOG6TQFPQGRABJEEB2YE7RFRLUKJDZAZGAD5GFX4J7TADAZ6", cat:"stable", b:"#2a5bd7", logo:"https://cdn.ondo.finance/tokens/logos/usdy_160x160.png"},
    {code:"GOLD", issuer:"GBC5ZGK6MQU3XG5Y72SXPA7P5R5NHYT2475SNEJB2U3EQ6J56QLVGOLD", cat:"utility", b:"#d4af37", logo:"https://www.mintx.co/images/logo100.png"},
    {code:"SSLX", issuer:"GBHFGY3ZNEJWLNO4LBUKLYOCEK4V7ENEBJGPRHHX7JU47GWHBREH37UR", cat:"utility", b:"#4a6cf7", logo:"https://sl8.online/assets/sslx-icon-e36e8c6134f6d93e6af1cd4d084a053c.png"},
    {code:"AFR", issuer:"GBX6YI45VU7WNAAKA3RBFDR3I3UKNFHTJPQ5F6KOOKSGYIAM4TRQN54W", cat:"utility", b:"#e8a33d", logo:"https://afreum.com/stellar/ST_Afreum.png"},
    {code:"TFT", issuer:"GBOVQKJYHXRR3DX6NOX2RRYFRCUMSADGDESTDNBDS6CDVLGVESRTAC47", cat:"utility", b:"#2d9cdb", logo:"https://threefoldfoundation.github.io/tft/tft_icon.png"}
  ].concat([{"code":"FRED","issuer":"GCA73U2PZFWAXJSNVMEVPNPPJCZGETWPWZC6E4DJAIWP3ZW3BAGYZLV6","cat":"utility","b":"hsl(259,62%,46%)","logo":"https://fredenergy.org/fred-logo-xlm.png"},{"code":"PYBC","issuer":"GBVB43NLVIP2USHXSKI7QQCZKZU2Z6U6A5PAHMIW7LLNVMQJTOX2BZI5","cat":"utility","b":"hsl(242,62%,46%)","logo":"https://luxpayband.io/img/LuxLogo21822.png"},{"code":"BLND","issuer":"GDJEHTBE6ZHUXSWFI642DCGLUOECLHPF3KSXHPXTSTJ7E3JF6MQ5EZYY","cat":"utility","b":"hsl(168,62%,46%)","logo":"/lxapi/media?id=c7100a58d60e0a6be6802389a018ee1b.png"},{"code":"KALE","issuer":"GBDVX4VELCDSQ54KQJYTNHXAHFLBCA77ZY2USQBM4CSHTTV7DME7KALE","cat":"utility","b":"hsl(255,62%,46%)","logo":"https://imagedelivery.net/yd3qPvu7Jy_6BfgoQb2pZQ/30466c1d-ef73-4d2b-8814-949157465a00/public"},{"code":"XXA","issuer":"GC4HS4CQCZULIOTGLLPGRAAMSBDLFRR6Y7HCUQG66LNQDISXKIXXADIM","cat":"utility","b":"hsl(241,62%,46%)","logo":"https://ixinium.io/img/main_logo.png"},{"code":"XTAR","issuer":"GAORYJ3KBDGIM7FFSKVUJHJ5NEFWIRDIAGGBJBJS7TY6ECZS53257IG4","cat":"utility","b":"hsl(109,62%,46%)","logo":"https://www.dogstarcoin.com/assets/img/dogstarcoin-logo.png"},{"code":"xLMNR","issuer":"GDKA6WVMFSA73BMEVKPO6WXSSWP4MPRBDJVSXLLSEVIEVH226L5RJ7NL","cat":"utility","b":"hsl(13,62%,46%)","logo":"https://www.thelumenaire.com/images/xLMNR-icon.png"}]);
  // byCode is a TICKER index -- two different issuers can share one. byId is the IDENTITY index, and it
  // is what decides whether we already hold an asset. Ticker alone could not: the cached roster and the
  // fresh stellar.expert discovery both offer every token, and the second offer would see the ticker
  // taken, mint a "collision" key (TDT -> TDT~GBIN) and create a SECOND object for the very same asset.
  // That is why TDT appeared twice in All Trading Pairs.
  var byId={};
  // #7: a.chg is the move against XLM -- that is what Horizon trade_aggregations measure and what
  // /lxapi/dexassets returns. On a day when XLM itself rose 10%, every asset that merely held its
  // DOLLAR value showed as a red -10%, which is exactly what the pair list was doing: USDC -10.26%,
  // EURC -7.26% -- a dollar stablecoin and a euro one apparently collapsing on the same afternoon.
  //
  // In dollars now, like the asset page and the dashboard: the asset against XLM, times XLM against
  // USD. Null when XLM's own move is unknown, because printing the raw XLM figure under a dollar
  // heading is the bug itself and a dash is the honest alternative.
  function chgU(a){
    if(!a||a.chg==null||xlmChg==null)return null;
    return ((1+a.chg/100)*(1+xlmChg/100)-1)*100;
  }
  // Shared with _mobdex.js, which renders the same pair list on a phone and was printing the raw XLM
  // figure -- the desktop table was converted here and the mobile one was not, so the same asset read
  // -10.26% on one and its true dollar move on the other. One implementation, both renderers.
  try{ window.__lxChgU=chgU; }catch(_){}
  // #19: the reader chooses the denomination. XLM is the default -- this is a Stellar pair list and the pair move is the reading
  // "is this up or down" for anyone not already thinking in XLM -- but a trader pricing against XLM wants
  // the raw pair move, and until now the page simply asserted one of the two.
  //
  // The choice is shared with _mobdex.js through window + localStorage, so switching on a phone and
  // reopening on a desktop shows the same thing rather than two pages disagreeing about the same asset.
  function denom(){ try{ if(window.__lxDenom)return window.__lxDenom;
    var v=localStorage.getItem("lumos.dexDenom"); if(v==="xlm"||v==="usd"){window.__lxDenom=v;return v;} }catch(_){}
    return "xlm"; }
  function setDenom(v){ window.__lxDenom=v; try{ localStorage.setItem("lumos.dexDenom",v); }catch(_){}
    try{ window.dispatchEvent(new CustomEvent("lx-denom",{detail:v})); }catch(_){} }
  // XLM is the raw pair move Horizon reports; USD folds in what XLM itself did.
  function chgShown(a){ return denom()==="xlm" ? (a&&a.chg!=null?a.chg:null) : chgU(a); }
  // Which figure leads. On "$" the dollar price is the headline and the XLM price becomes the sub-line;
  // on "XLM" it is the other way round, which is how it has always rendered. Nothing is hidden either
  // way -- both numbers are always present, only their order changes.
  function pxPair(px,pu,fmtUsd){
    if(!(px>0))return "—";
    if(denom()==="usd"&&pu>0)return fmtUsd(pu)+'<span class="sub">'+fmtPrice(px)+' XLM</span>';
    return fmtPrice(px)+'<span class="sub">'+(pu>0?fmtUsd(pu):"—")+'</span>';
  }
  try{ window.__lxDenomGet=denom; window.__lxDenomSet=setDenom; window.__lxChgShown=chgShown; }catch(_){}
  var byCode={}; ASSETS.forEach(function(a){ byCode[a.code]=a; byId[a.code+"|"+a.issuer]=a; a.px=0; a.chg=null; a.vol=null; a.high=null; a.low=null;
    a.tvlUsd=null; a.holders=null; a.supply=null; a.spark=null; a.domain=null; a.img=null; a.trades=null; });
  // ---- LumosCore-native assets: issuer home_domain = lumoscore.com (minted through our Launchpad) ----
  var NATIVE=[], nativeState=0;                             // 0 idle | 1 loading | 2 loaded
  var SX="/lxapi/assetsearch?search=lumoscore&limit=200";
  // v2: the saved roster is a list of WHICH assets exist, so a copy written before an asset was
  // registered hides it for six hours. Bumping the key retires those, once.
  // v3, not v2: every warm v2 roster was written with t=0 on our own mints (see the created fix in the
  // fetch below), and a warm cache returns before the fetch that would repair it -- so the mint dates
  // would have stayed missing for six hours per visitor, and for ever for anyone who reloads inside that
  // window. A new key retires those rosters once.
  var NKEY="lumos.native.v3", NTTL=216e5;                       // 6h: identity changes slowly, prices do not
  function nativeCached(){
    try{ var c=JSON.parse(localStorage.getItem(NKEY)||"null");
      return (c&&c.ts&&(Date.now()-c.ts<NTTL)&&c.a&&c.a.length)?c.a:null; }catch(e){ return null; }
  }
  function nativeSave(list){
    try{ localStorage.setItem(NKEY,JSON.stringify({ts:Date.now(),a:list.map(function(x){
      return {c:x.code,i:x.issuer,l:x.logo||"",d:x.domain||"",t:x.created||0}; })})); }catch(e){}
  }
  // one shape for both paths, so a cached roster and a fresh one cannot drift
  function nativeMake(code,iss,logo,dom,created){
    if(byId[code+"|"+iss])return null;                 // same code AND issuer -> already held
    var key=byCode[code]?code+"~"+iss.slice(0,4):code;
    if(byCode[key])return null;
    var a={code:code,issuer:iss,cat:"native",tkr:key,b:"#3d4351",created:(+created||0),
      logo:logo||"",domain:dom||"",px:0,chg:null,vol:null,high:null,low:null,tvlUsd:null,
      holders:null,supply:null,spark:null,img:null,trades:null};
    byCode[key]=a; byId[code+"|"+iss]=a; NATIVE.push(a); return a;
  }
  // One request per 16 assets, served from the edge cache. Falls back to Horizon per asset if the
  // endpoint is unreachable, so this can never be the reason a price is missing.
  var BATCH=16;
  function batchPx(list){
    var want=list.filter(function(a){ return a&&a.code&&a.issuer; });
    if(!want.length)return Promise.resolve();
    var jobs=[];
    for(var i=0;i<want.length;i+=BATCH)jobs.push(want.slice(i,i+BATCH));
    return Promise.all(jobs.map(function(grp){
      var qs=grp.map(function(a){ return a.code+"-"+a.issuer; }).join(",");
      var fresh=fetchJ("/lxapi/lastprices?a="+encodeURIComponent(qs)).then(function(d2){
        return (d2&&d2.p)||null;
      }).catch(function(){ return null; });
      return fetchJ("/lxapi/dexassets?a="+encodeURIComponent(qs)).then(function(d){
        if(!d||!d.a)throw new Error("empty");
        grp.forEach(function(a){
          var v=d.a[a.code+"-"+a.issuer]; if(!v)return;
          if(v.px>0)a.px=v.px;
          if(v.chg!=null)a.chg=v.chg;
          if(v.pc!=null)a.pc=v.pc;
          if(v.vol!=null)a.vol=v.vol;
          if(v.high!=null)a.high=v.high;
          if(v.low!=null)a.low=v.low;
          if(v.tr!=null)a.trades=v.tr;
          if(v.ho!=null)a.holders=v.ho;
          if(v.su!=null)a.supply=v.su;
          // home_domain now rides along on the cached response. It drives the row's domain label AND the
          // stellar.toml lookup that resolves the logo, so SHX and friends were unlabelled and
          // unillustrated purely because nothing ever set this.
          if(v.dom&&!a.domain){ a.domain=v.dom; if(!a.img)loadToml(a,v.dom); }
        });
        touch();
        // The fresh price is applied LAST so it outranks the cached bar whichever request finishes
        // first -- the asset page had exactly this race, where the slower daily response landed after
        // the live one and put the five-minute-old close straight back on screen.
        return fresh.then(function(p){
          if(!p)return;
          var moved=0;
          grp.forEach(function(a){
            var px=p[a.code+"-"+a.issuer];
            if(!(px>0))return;
            a.px=px; moved++;
            // Same price the row shows, measured against yesterday's close: the figure and the
            // percentage beside it must describe the same thing.
            if(a.pc>0)a.chg=((px-a.pc)/a.pc)*100;
          });
          if(moved)touch();
        }).catch(function(){});
      }).catch(function(){
        // endpoint down -> the old path, so the page degrades instead of emptying
        return Promise.all(grp.map(function(a){ return loadAssetLite(a).catch(function(){}); }));
      });
    }));
  }
  // Sparklines and TVL are the bulk of the remaining Horizon traffic, and that traffic is what throttles
  // the endpoint the prices come from. Hold them until the numbers are painted, then trickle in fours.
  var EXTRA_HOLD=1200;
  function deferExtras(list){
    setTimeout(function(){ (function wave(i){ if(i>=list.length)return;
      Promise.all(list.slice(i,i+4).map(function(a){ return rowExtras(a).catch(function(){}); }))
        .then(function(){ wave(i+4); },function(){ wave(i+4); });
    })(0); }, EXTRA_HOLD);
  }
  // Decorative extras, fetched only after the numbers are showing: the 7d sparkline and pool TVL.
  // See the note above: every trade_aggregations call on this page goes through here.
  function lxAgg(a,res,limit,order){
    var code=(a&&a.code)||"", iss=(a&&a.issuer)||"";
    var base="base_asset_type="+(code.length<=4?"credit_alphanum4":"credit_alphanum12")
      +"&base_asset_code="+encodeURIComponent(code)+"&base_asset_issuer="+iss+"&counter_asset_type=native";
    function direct(){ return j(H+"/trade_aggregations?"+base+"&resolution="+res+"&order="+order+"&limit="+limit); }
    // Only hand the edge what its validator accepts (code 1-12 alphanumeric, issuer G + 55). Checked with
    // plain string tests rather than a regex, because these files eat backslashes.
    var ok=code.length>0&&code.length<13&&iss.length===56&&iss.charAt(0)==="G";
    for(var i=0;ok&&i<code.length;i++){ var c=code.charAt(i);
      if(!((c>="A"&&c<="Z")||(c>="a"&&c<="z")||(c>="0"&&c<="9")))ok=false; }
    if(!ok)return direct();
    return fetch("/lxapi/candles?a="+encodeURIComponent(code+"-"+iss)+"&res="+res+"&order="+order+"&limit="+limit)
      .then(function(r){ return r.ok?r.json():null; })
      .then(function(d){ return (!d||d.error)?direct():d; })
      .catch(function(){ return direct(); });
  }
  function rowExtras(a){
    if(a.__extra)return Promise.resolve(); a.__extra=1;
    var atype=a.code.length<=4?"credit_alphanum4":"credit_alphanum12";
    var base="base_asset_type="+atype+"&base_asset_code="+a.code+"&base_asset_issuer="+a.issuer+"&counter_asset_type=native";
    if(a.domain)loadToml(a,a.domain); else a.__logoDone=1;
    return Promise.all([
      lxAgg(a,"3600000",168,"desc").then(function(d){
        var r=recs(d).slice().reverse();
        var pts=r.map(function(x){ return +x.avg||+x.close||0; }).filter(function(v){ return v>0; });
        if(pts.length>=2)a.spark=pts; touch(); }).catch(function(){}),
      j(H+"/liquidity_pools?reserves="+a.code+":"+a.issuer+"&limit=200").then(function(d){
        a.poolsRaw=recs(d).map(function(pl){ var nat=0,ass=0;
          (pl.reserves||[]).forEach(function(rv){ if(rv.asset==="native")nat=+rv.amount;
            else if(rv.asset.indexOf(a.code+":"+a.issuer)===0)ass=+rv.amount; });
          return {nat:nat,ass:ass}; });
        computeTvl(a); touch(); }).catch(function(){})
    ]);
  }
  var MINTS_SHOWN=3;                                          // rows in the "New mints on LumosCore" card, and the number we price up front
  function nativePrice(add){
    // ONLY the ones the mints box shows, and only two requests each. Everything else is fetched when a
    // row is actually rendered -- see priceVisible(). Sweeping the roster here is what made the page
    // fire ~210 requests before showing a single price.
    var _first=add.slice().sort(function(x,y){ return (y.created||0)-(x.created||0); }).slice(0,MINTS_SHOWN);
    _first.forEach(function(a){ a.__lite=1; a.__px=1; });
    // one request for all of them -- and the edge is not rate-limited the way each visitor was, which is
    // what used to leave ZERO and UPT permanently showing a dash
    MINTS_READY=batchPx(_first).then(function(){ nativeState=2; touch(); },function(){ nativeState=2; touch(); });
    // The pair list now DEFAULTS to 24h volume, so the roster needs volumes before its first paint --
    // otherwise the table shows roster order and visibly re-sorts a second later, which is the flash.
    // This is batchPx, the edge-cached endpoint at 16 assets per request (two requests for the whole
    // roster), NOT the per-asset Horizon sweep that priceVisible deliberately avoids -- that one is what
    // used to fire ~210 requests before a single price appeared, and it stays lazy.
    var rest=add.filter(function(a){ return a&&!a.__px; });
    ROSTER_READY=MINTS_READY.then(function(){ return rest.length?batchPx(rest):null; })
                            .then(rosterDone,rosterDone);
  }
  function rosterDone(){ rosterPriced=true; try{ markSortReady(); }catch(_){} }
  // Rows on screen get the full loadAsset (the table shows TVL and a sparkline); in waves of four so a
  // page turn cannot open 25 sockets at once.
  var MINTS_READY=null;                                       // resolves when the mints box has its prices
  var ROSTER_READY=null, rosterPriced=false;                  // ...and when the whole native roster has volumes
  // The rows stay hidden until the order they are in is the REAL one. With a volume default, revealing
  // earlier means painting roster order and then re-sorting in front of the reader.
  var sortReady=false;
  // #23: cold-start overlay for the Trade landing page. The mark and nothing else -- no percentage,
  // because unlike the pools ranking there is no staged process here to report honestly: the page waits
  // on a handful of parallel requests, and a bar over that would be a timer dressed up as progress.
  //
  // Armed on a 400ms delay so a warm load never flashes it, and capped hard at 15s so a slow or failed
  // request can never leave the page sealed behind it.
  var tboot=null, tbootArmed=false;
  function tbootShow(){
    // Withdrawn: this was read as a whole-page loading animation, which is not what a subtle in-box
    // cue was meant to be. The function stays so its five timers, the 15s failsafe and tbootHide all
    // keep resolving -- removing the declaration outright is how a top-level ReferenceError takes the
    // rest of the emitted script down with it. Nothing is inserted, so nothing paints.
    return;
    /* eslint-disable no-unreachable */
    if(tboot||!tbootArmed)return;
    if(sortReady)return;
    if(!q(".dex-markets")&&!q("#dexMintsList"))return;      // Trade landing only
    var el=document.createElement("div"); el.className="lx-tboot";
    var mk=""; try{ var lm=q(".logo-mark"); if(lm)mk=getComputedStyle(lm).backgroundImage; }catch(_){}
    el.innerHTML='<div class="lx-tboot-badge"><div class="lx-tboot-mark" data-logo="" data-logoed="1"'+((mk&&mk!=="none")?(' style="background-image:'+mk+'"'):'')+'></div></div>';
    (document.body||document.documentElement).appendChild(el);
    tboot=el;
    setTimeout(tbootHide,15000);
  }
  function tbootHide(){
    if(!tboot)return; var el=tboot; tboot=null; tbootArmed=false;
    el.classList.add("lx-tboot-out");
    setTimeout(function(){ if(el.parentNode)el.parentNode.removeChild(el); },320);
  }
  // A poll rather than one shot, for the same reason as the pools loader: a single attempt at 400ms
  // gives up if the markets section has not rendered yet, which on a cold load is precisely when it has
  // not -- and the overlay then never appears for the whole blank stretch it exists to cover.
  // tbootShow() is a no-op once shown, once sortReady, or once dismissed.
  (function(){ tbootArmed=true; [300,600,1000,1600,2400].forEach(function(ms){ setTimeout(function(){ try{ tbootShow(); }catch(_){} },ms); }); })();
  function markSortReady(){
    if(sortReady)return;
    if(mkSort.key && (!window.__lxDEXloaded || !rosterPriced))return;   // both halves of the data, or nothing
    sortReady=true;
    // The phone list is rendered by the mobile layer but priced by this one, so it gates on this flag
    // too -- otherwise it would reveal as soon as the majors landed and re-sort when the roster arrived.
    try{ window.__lxDEXsortReady=1; }catch(_){}
    // #23: the pairs table is about to reveal, so the overlay has nothing left to cover.
    try{ tbootHide(); }catch(_){}
    try{ guardApply(); }catch(_){}
  }
  function priceVisible(list){
    var need=list.filter(function(a){ return a&&!a.__px; });
    if(!need.length)return;
    need.forEach(function(a){ a.__px=1; });
    var gate=MINTS_READY||Promise.resolve();
    gate.then(function(){
      // numbers first, in one or two requests; the sparkline and TVL follow in waves of four
      batchPx(need).then(function(){ deferExtras(need); });
    });
  }
  function loadNative(){
    if(nativeState)return; nativeState=1;
    // LUMOS is the platform's own token, but its issuer still declares the pre-rename lumosdao.io, so a
    // strict domain match drops it from its own tab. Pin it in until that home_domain is updated.
    var l=byCode["LUMOS"]; if(l&&NATIVE.indexOf(l)<0)NATIVE.push(l);
    touch();
    var cached=nativeCached();
    if(cached){
      var addC=[];
      cached.forEach(function(x){ var a=nativeMake(x.c,x.i,x.l,x.d,x.t); if(a)addC.push(a); });
      // Seed here as well. This path RETURNS, so seeding only in the fetch branch below meant a visitor
      // with a warm roster never saw an asset we had just registered -- FED, NEIRO and HULK were missing
      // for exactly that reason while RICHARD, PUMP, PEPE and ZBS happened to arrive via the late
      // manifest backfill.
      addManifestNatives(addC);
      touch(); nativePrice(addC);
      return;                                                  // refreshed on the next cold load
    }
    fetchJ(SX).then(function(d){
      var r=(d&&d._embedded&&d._embedded.records)||[], add=[];
      r.forEach(function(x){
        if(String(x.domain||"").toLowerCase()!=="lumoscore.com")return;
        var q0=String(x.asset||"").split("-"), code=q0[0], iss=q0[1];
        if(!code||!iss||code.length>12||iss.length!==56)return;
        // Retired and mistyped tickers linger in the index as husks: zero supply, no trustlines, no toml.
        // They cannot be traded, and padding the tab with dead rows buries the real ones.
        var tl=x.trustlines; tl=(tl&&typeof tl==="object"&&tl.length)?(+tl[0]||0):(+tl||0);
        if(!(+x.supply>0)||tl<1)return;
        // one creation point, one guard: this used to inline a second copy of the ticker-only check
        var a=nativeMake(code,iss,(x.tomlInfo&&x.tomlInfo.image)||"",x.domain||"",+x.created||0);
        if(a)add.push(a);
        // #27: ...and when it is already held, keep what this record knows that the other path did not.
        // addManifestNatives registers our own mints with created=0 (the manifest has no timestamp), and
        // it runs first -- so nativeMake returned null here and the REAL mint time was thrown away on
        // every load. Measured: GLTCH, JROLL and REKT all carried created=0 in the page while the index
        // had 1752868441, 1751285635 and 1753389693 for them. That is also why "newest first" listed
        // them in discovery order: every key it sorted on was zero.
        else { var _e=byId[code+"|"+iss];
          if(_e){ if(!(_e.created>0)&&+x.created>0)_e.created=+x.created;
                  if(!_e.domain&&x.domain)_e.domain=x.domain;
                  if(!_e.logo&&x.tomlInfo&&x.tomlInfo.image)_e.logo=x.tomlInfo.image; } }
      });
      addManifestNatives(add);
      touch();
      nativeSave(NATIVE.filter(function(x){ return x.cat==="native"; }));
      // The mints box shows the NEWEST few, and they can sit anywhere in discovery order -- so price
      // Same routine the cached path uses: price the ones the mints box shows, and stop. Everything
      // else is fetched by priceVisible() when a row is rendered.
      nativePrice(add);
    }).catch(function(){ nativeState=0; });                  // allow a retry on the next click
  }
  // "All" means every pair LumosCore lists, curated majors AND our own Launchpad tokens. Identity dedupe,
  // not code+issuer: LUMOS is literally the same object in both lists, pinned into NATIVE by loadNative.
  function allAssets(){
    // Identity dedupe, not object identity. Object identity was enough while LUMOS was literally the same
    // object in both lists, but it cannot catch two distinct objects describing one asset.
    var out=[],seen={};
    function put(a){ if(!a)return; var id=a.code+"|"+a.issuer; if(seen[id])return; seen[id]=1; out.push(a); }
    for(var i=0;i<ASSETS.length;i++)put(ASSETS[i]);
    for(var j=0;j<NATIVE.length;j++)put(NATIVE[j]);
    return out; }
  // #13: Market Movers goes below All Trading Pairs.
  //
  // Movers is a short, opinionated read on four assets; the pairs table is the page's actual index and
  // is what someone arriving at "Trade" is looking for. Putting the editorial ahead of the index pushed
  // the table 760px down the page.
  //
  // Done at runtime rather than in the build for the same reason trimFilters is: the design re-renders
  // this region, and a build-time reorder is undone the first time it does. Guarded on document order,
  // so once Movers follows the table this is a no-op on every later tick.
  function orderSections(){
    var mv=q(".dex-movers"), mk=q(".dex-markets");
    if(!mv||!mk||mv.parentNode!==mk.parentNode)return;
    // _sidecard.js owns the slot DIRECTLY after the pairs table -- it parks the New Mints card there and
    // re-asserts on resize and on every re-render. Taking that slot would have been a tug of war between
    // two files re-asserting against each other every tick, so Movers anchors below that card instead.
    var sc=q(".dex-mints-card");
    var after=(sc&&sc.parentNode===mk.parentNode&&(mk.compareDocumentPosition(sc)&4))?sc:mk;
    if(mv.previousElementSibling===after)return;              // already in place
    after.parentNode.insertBefore(mv,after.nextSibling);
  }
  // item 17: the page's launch CTA lived inside the New Mints head, which is now hidden -- so it has to
  // be re-seated or it goes with the card. The pairs controls row is where it belongs anyway: it is the
  // only row on the page that is always visible. Moved, not rebuilt, so the listener bound to it (see
  // the #dexHiwBtn/.lx-dctas delegate) survives.
  function dropSections(){
    var ct=q(".lx-dctas"); if(!ct)return;
    var ctl=q(".dex-mk-controls"); if(!ctl)return;
    if(ct.parentNode===ctl)return;                          // already re-seated
    ctl.insertBefore(ct,ctl.firstChild);
  }
  // #7: the three chips we no longer offer, and the rename of All. Done here rather than in the build
  // because the design re-renders this row -- a build-time edit would be undone the first time it did.
  // Idempotent: a removed chip is not found again, and the rename checks before writing.
  // #19: the (i) keeps its meaning even with the label hidden -- title for the pointer, aria-label for
  // anything reading the page aloud. Set once; the design does not rewrite these attributes.
  function labelHiw(){ try{ var b=q("#dexHiwBtn"); if(!b||b.getAttribute("data-lxhiw")==="1")return;
    b.setAttribute("data-lxhiw","1"); b.setAttribute("title","How it works"); b.setAttribute("aria-label","How it works"); }catch(_){} }
  function trimFilters(){
    // #7: "LumosCore native" joins the three chips already removed. With Curated the only list this row
    // can show, a chip bar with one chip in it is a control that cannot do anything -- and the row it
    // occupies is better spent on the filter field (see below). Launchpad tokens stay reachable through
    // New Mints and their own pages.
    var kill={stables:1,memes:1,utility:1,native:1};
    qa(".dex-mk-filter,.mdx-mk-filter").forEach(function(b){
      var f=(b.getAttribute("data-filter")||"").toLowerCase();
      if(kill[f]){ if(b.parentNode)b.parentNode.removeChild(b); return; }
      if(f==="all"||f===""){
        // Only the label changes; data-filter stays "all" so every reader of it keeps working.
        var tn=null, ns=b.childNodes;
        for(var i=ns.length-1;i>=0;i--){ if(ns[i].nodeType===3&&(ns[i].nodeValue||"").trim()){ tn=ns[i]; break; } }
        if(tn&&tn.nodeValue.trim()!=="Curated")tn.nodeValue="Curated";
      }
    });
    // If the active chip was one of the three just removed, nothing is selected and the table would read
    // an empty filter. Fall back to Curated.
    var act=q(".dex-mk-filter.active,.mdx-mk-filter.active");
    if(!act){ var first=q('.dex-mk-filter[data-filter="all"],.mdx-mk-filter[data-filter="all"]');
      if(first)first.classList.add("active"); }
  }
  // #10: the field only ever searched the curated list, and the placeholder implied the whole network.
  // Say so, rather than leaving someone to conclude their asset is missing when it was never in scope.
  function labelFilterInput(){
    var want="Filter curated pairs";
    qa(".mdx-mk-search input,.dex-mk-search input,.search-box.inline-filter input,input.lx-mkq,.lx-mkq input").forEach(function(i){
      if(i.getAttribute("placeholder")!==want)i.setAttribute("placeholder",want);
    });
  }
  function curFilter(){ var el=q(".dex-mk-filter.active"); return (el&&el.getAttribute)?(el.getAttribute("data-filter")||"all"):"all"; }
  // Newest first. Assets we have no created stamp for sort last rather than jumping to the top on a 0.
  function mintList(){
    return NATIVE.slice()
      .filter(function(a){ return a.cat==="native"; })            // LUMOS is pinned into NATIVE but was not minted here
      .sort(function(x,y){ return (y.created||0)-(x.created||0); })
      .slice(0,MINTS_SHOWN);
  }
  // The rows the mints card is showing, keyed exactly as the row is stamped. Built from mintList() so
  // the key on the element and the key in the map can never disagree.
  function mintByKey(){ var m={}; mintList().forEach(function(a){ m[a.tkr||a.code]=a; }); return m; }
  // How long ago it was minted. Empty string when we have no timestamp, so the caller can fall back
  // rather than print "today" for an asset whose age is simply unknown.
  function mintAge(a){
    var t=+(a&&a.created)||0; if(!(t>0))return "";
    var d=Math.floor((Date.now()/1000-t)/86400);
    if(d<0)return "";
    if(d===0)return "Minted today";
    if(d===1)return "Minted yesterday";
    if(d<30)return "Minted "+d+" days ago";
    var mo=Math.floor(d/30);
    if(mo<12)return "Minted "+mo+(mo===1?" month":" months")+" ago";
    var y=Math.floor(d/365);
    return "Minted "+y+(y===1?" year":" years")+" ago";
  }
  window.__lxDEXmintAge=mintAge;                              // the phone's card renders its own rows
  var MINTS=["LUMOS","AQUA","EURC","ARST","SHX"];             // "new mints" subset (LUMOS = the project token, tagged NEW)

  // seed XLM/USD from a shared localStorage cache so a CoinGecko 429 never blanks the USD values (falls back
  // to the last-known price, <=6h old; the shared "lumos.xlmUsd" key is written by every page on success).
  var xlmUsd=(function(){try{var c=JSON.parse(localStorage.getItem("lumos.xlmUsd")||"null");return (c&&+c.v>0&&(Date.now()-c.ts<216e5))?+c.v:0;}catch(e){return (window.__lxXlmUsd||0);}})();
  // Warm from the same cache entry. Without it the whole change column is dashes until the network
  // answers, which is a worse first paint than a figure a few minutes old.
  var xlmChg=(function(){try{var c=JSON.parse(localStorage.getItem("lumos.xlmUsd")||"null");
    return (c&&c.chg!=null&&(Date.now()-c.ts<216e5))?+c.chg:null;}catch(e){return null;}})();
  var DV=0;                                                   // data version — bumped only when real data lands

  // ---- helpers (mirrors _dexassetdata) ----
  function fetchJ(u){ return fetch(u).then(function(r){ if(!r.ok)throw new Error(r.status); return r.json(); }); }
  // at most MAXQ requests in flight; everything else waits its turn
  function wait(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  var MAXQ=6, qRun=0, qWait=[];
  function qNext(){ if(qRun>=MAXQ||!qWait.length)return; qRun++; var t=qWait.shift();
    t.go().then(t.ok,t.no).then(function(){ qRun--; qNext(); },function(){ qRun--; qNext(); }); }
  function queued(go){ return new Promise(function(ok,no){ qWait.push({go:go,ok:ok,no:no}); qNext(); }); }
  function j(u){
    return queued(function(){
      return fetchJ(u).catch(function(e){
        // A 429 arrives without CORS headers, so we cannot tell it apart from a network fault -- assume
        // the worse of the two and back off. Retrying instantly is what deepens a rate limit.
        return wait(500).then(function(){ return fetchJ(u); }).catch(function(){
          return wait(1400).then(function(){ return fetchJ(u); }).catch(function(){
            if(u.indexOf("horizon.stellar.org")>=0)return fetchJ(u.replace("horizon.stellar.org","horizon.stellar.lobstr.co"));
            throw e; }); });
      });
    });
  }
  function q(s,r){ return (r||document).querySelector(s); }
  function qa(s,r){ return [].slice.call((r||document).querySelectorAll(s)); }
  function recs(d){ return (d&&d._embedded&&d._embedded.records)||[]; }
  // close/avg round to 7dp; below that they read "0.0000000" though the asset does have a price
  function subPx(r){ var b=+r.base_volume||0, c=+r.counter_volume||0; return (b>0&&c>0)?(c/b):0; }
  function priceUsd(a){ return (a.px||0)*xlmUsd; }
  function num(n){ if(n==null)return "\u2014"; return Math.round(+n||0).toLocaleString("en-US"); }
  // Below 1e-8 a plain decimal is an unreadable run of zeros and exponential notation is trader-hostile,
  // so the zeros get counted into a subscript instead: 0.000000001234 -> 0.0(8)1234. At 1e-8 and above we
  // stay plain and trim the padding.
  //
  // Deliberately free of backslash escapes: this code is emitted through a template literal, which eats
  // one level of them -- a /.$/ here would ship as /.$/ and delete the last digit of every price.
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
  function usdSmall(x){ x=+x||0; if(x>=1)return "$"+x.toLocaleString("en-US",{maximumFractionDigits:2}); if(x>=0.01)return "$"+x.toFixed(4); if(x>0)return "$"+smallNum(x,4); return "$0"; }
  function abbrUsd(n){ n=+n||0; var a=Math.abs(n); if(a>=1e9)return "$"+(n/1e9).toFixed(2)+"B"; if(a>=1e6)return "$"+(n/1e6).toFixed(2)+"M"; if(a>=1e3)return "$"+(n/1e3).toFixed(1)+"K"; if(a>=1)return "$"+n.toFixed(2); return usdSmall(n); }
  function fmtAmt(n){ n=+n||0; if(n>=1e6)return (n/1e6).toFixed(2)+"M"; if(n>=1e3)return (n/1e3).toFixed(1)+"K"; return n.toFixed(0); }
  // #1: this is the function the mint rows have been calling all along, and it did not exist.
  //
  // One ReferenceError on the FIRST row aborted the entire forEach, and renderMints is called inside a
  // try/catch that swallows it -- so the card showed row one with whatever had been painted before the
  // throwing line (price, market cap) and every row below it completely blank, sub-line included. It
  // read as missing data; the data was on the objects the whole time.
  //
  // Not fmtAmt: these volumes are fractions of a lumen (0.0998 XLM on a real trade), and its toFixed(0)
  // would report that as "0 XLM".
  function abbrNum(n){ n=+n||0; var a=Math.abs(n);
    if(a>=1e9)return (n/1e9).toFixed(2)+"B";
    if(a>=1e6)return (n/1e6).toFixed(2)+"M";
    if(a>=1e3)return (n/1e3).toFixed(1)+"K";
    if(a>=1)return n.toFixed(2);
    return n.toFixed(4);
  }
  function fmtPrice(n){ n=+n||0; if(n>=1000)return n.toFixed(2); if(n>=1)return n.toFixed(4); if(n>=0.01)return n.toFixed(5); if(n>=0.0001)return n.toFixed(7); if(n>0)return smallNum(n,4); return "0"; }
  function shortG(a){ a=String(a||""); return a.length>12?a.slice(0,4)+"\u2026"+a.slice(-4):a; }
  // circular initial-avatar as an SVG data-URI (fallback logo for arbitrary Stellar tokens)
  function avatarBg(code){ var c=String(code||"?"); var hue=0; for(var i=0;i<c.length;i++)hue=(hue*31+c.charCodeAt(i))%360;
    var init=c.replace(/[^A-Za-z0-9]/g,"").slice(0,2).toUpperCase()||"?"; var fz=init.length>1?15:20;
    var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="hsl('+hue+',60%,50%)"/><text x="20" y="'+(init.length>1?26:27)+'" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="'+fz+'" fill="#fff">'+init+'</text></svg>';
    return "url(\"data:image/svg+xml,"+encodeURIComponent(svg)+"\")"; }
  // A LumosCore mint's icon lives in localStorage, written by the launchpad (see _launchpad.js), keyed
  // CODE-ISSUER. Pools and Asset-Overview have always read it; Trade did not, which is exactly why the
  // same token showed its real icon there and a coloured letter tile here.
  //
  // This is not the whole fix and is not pretending to be: an icon in localStorage is the minting browser
  // and nowhere else, so nobody else sees it. Publishing it in our stellar.toml is what makes it real for
  // every visitor, wallet and explorer -- that path is built and waiting on the icon files. This restores
  // the icons wherever the browser that minted them is used, which is the machine looking at this page.
  // THE ICON MANIFEST, READ FROM OUR OWN ORIGIN. Hosting the logo files was not enough on its own: the
  // page resolved a mint's image through loadToml(), which fetches the issuer's on-chain home_domain --
  // lumoscore.com -- no matter which site you are browsing. That URL 404s until the toml Function reaches
  // production, so a logo hosted on staging was unreachable from staging.
  //
  // This reads /assets/tokens/launchpad-icons.json from whatever origin is serving the page, so the icons
  // appear as soon as they are deployed, on staging and production alike, with no dependency on the toml
  // or on any third party. The toml still matters -- it is what publishes them to wallets and explorers --
  // but the site no longer waits on it to draw its own pages.
  // window.__lxTokenRegistry is baked into <head> at build time, so this is known on the FIRST paint and the letter avatar is never drawn for a token we have. The fetch stays only as a refresh for a page left open across a deploy.
  var _man=(function(){ try{ return window.__lxTokenRegistry||null; }catch(e){ return null; } })(), _manStarted=0;
  function loadManifest(){
    if(_manStarted)return; _manStarted=1;
    fetch("/assets/tokens/launchpad-icons.json").then(function(r){ return r.ok?r.json():null; }).then(function(m){
      if(!m||typeof m!=="object"||m.constructor===Array)return;
      _man=m;
      // The manifest can land after the roster. Backfill then, or an asset only we know about would wait
      // for the next cold load to appear.
      if(nativeState){ var late=[]; addManifestNatives(late); if(late.length)nativePrice(late); }
      try{ paintIcons(document); }catch(_e){}
      touch();                                                  // rows already drawn -> repaint with the real icons
    }).catch(function(){});
  }
  function manifestIcon(code,issuer){
    if(!_man)return "";
    var e=_man[code+"-"+issuer];
    // An entry is a bare path, or {image,name} once the asset has a display name. Reading only the
    // string form meant every logo that gained a name silently stopped rendering -- BEAR, BLA, BRIDGE,
    // BROT, FOX, LIBERATOR, PEACE and ZOMBIE all went back to letter tiles the moment names were added.
    var u=(e&&typeof e==="object")?e.image:e;
    // Same-origin absolute path only. A manifest naming another host would let one bad write repoint
    // every token icon on the site.
    return (typeof u==="string"&&u.charAt(0)==="/"&&u.indexOf("//")!==0)?u:"";
  }

  // OUR OWN ASSETS, FROM OUR OWN RECORD. The roster is discovered from stellar.expert and filtered on
  // domain==="lumoscore.com" -- but their index does not always carry the domain. WAZAAA is the case in
  // point: Horizon says home_domain=lumoscore.com and its issuer was created by our funding wallet, yet
  // stellar.expert reports domain:(none), so the row was never built and the asset simply did not exist
  // on LumosCore. Waiting for a third party to notice our own mint is not a plan.
  //
  // The manifest knows CODE and ISSUER for everything we host, so anything missing from the roster is
  // added from there. Discovery only -- price, supply and holders still come from the ledger.
  function addManifestNatives(add){
    if(!_man)return;
    for(var k in _man){ if(!Object.prototype.hasOwnProperty.call(_man,k))continue;
      var d=k.indexOf("-"); if(d<1)continue;
      var code=k.slice(0,d), iss=k.slice(d+1);
      if(!/^[A-Za-z0-9]{1,12}$/.test(code)||!/^G[A-Z2-7]{55}$/.test(iss))continue;
      var dup=false;
      for(var i=0;i<NATIVE.length;i++)if(NATIVE[i].code===code&&NATIVE[i].issuer===iss){dup=true;break;}
      if(dup)continue;
      var a=nativeMake(code,iss,"","lumoscore.com",0);
      if(a&&add)add.push(a);
    }
  }

  var _liCache=null;
  function launchIcon(code,issuer){
    try{
      if(!_liCache)_liCache=JSON.parse(localStorage.getItem("lumos.launch.icons")||"{}");
      var u=_liCache[code+"-"+issuer];
      // Only an image data URI, and none carrying a quote: this value is interpolated into url(...) and a
      // quote inside it would break out of the CSS value (the url(") trap that bit the logo guard).
      return (typeof u==="string"&&u.indexOf("data:image/")===0&&u.indexOf('"')<0&&u.indexOf("'")<0)?u:"";
    }catch(e){ return ""; }
  }
  // A plain disc: no colour, no initial, nothing that has to be taken back.
  var LOGO_WAIT="linear-gradient(rgba(127,127,140,.18),rgba(127,127,140,.18))";
  function logoCss(a){
    var u=a.logo||a.img||manifestIcon(a.code,a.issuer)||launchIcon(a.code,a.issuer);
    if(u)return "url("+u+")";
    // Nothing yet AND nobody has looked -> say nothing rather than guess a colour and an initial.
    return a.__logoDone?avatarBg(a.code):LOGO_WAIT;
  }
  // money value wrapped as a .lc-money span (the site money-formatter keys off data-usd/data-orig -> no revert)
  function lcm(v){ v=+v||0; var s=abbrUsd(v); return '<span class="lc-money" data-usd="'+v+'" data-orig="'+s+'">'+s+'</span>'; }
  function lcmExact(v){ v=+v||0; var s=usdSmall(v); return '<span class="lc-money" data-usd="'+v+'" data-orig="'+s+'">'+s+'</span>'; }
  // paint icons ourselves (painter-proof) after any innerHTML rebuild
  function paintIcons(root){ qa("[data-lxic]",root).forEach(function(ic){ var a=byCode[ic.getAttribute("data-lxic")]; if(!a)return; var css=logoCss(a); if(css&&ic.style.getPropertyValue("--lxvar")!==css)ic.style.setProperty("--lxvar",css); }); }
  function initials(code){ return String(code||"?").replace(/[^A-Za-z0-9]/g,"").slice(0,3); }

  // ---- sparkline (winsorized, real 24x1h points) ----
  function sparkPath(vals){ if(!vals||vals.length<2)return null;
    var s=vals.slice().sort(function(a,b){return a-b;});
    var lo=s[Math.floor(s.length*0.05)]||s[0], hi=s[Math.ceil(s.length*0.95)-1]||s[s.length-1];
    var cl=vals.map(function(v){return Math.max(lo,Math.min(hi,v));});
    var mn=Math.min.apply(null,cl),mx=Math.max.apply(null,cl),rg=(mx-mn)||1;
    var w=88,h=28,n=cl.length,step=w/(n-1);
    return cl.map(function(v,i){ return (i?"L":"M")+(i*step).toFixed(1)+" "+(h-((v-mn)/rg)*(h-4)-2).toFixed(1); }).join(" "); }
  function sparkSvg(vals,up){ var d=sparkPath(vals); var color=up?"#35c07f":"#ff5b5b";
    if(!d)return '<svg class="dex-mk-spark" viewBox="0 0 88 28" preserveAspectRatio="none"></svg>';
    return '<svg class="dex-mk-spark" viewBox="0 0 88 28" preserveAspectRatio="none"><path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }

  // Navigate to the asset page WITH the ?asset= query. window.__lxNav (the site SPA router) drops the query
  // string, landing on the default (LUMOS) page, so use a direct location.href which preserves it.
  function navTo(a){ try{ location.href="lumoscore-dex-asset.html?asset="+a.code+"-"+a.issuer; }catch(e){} }

  // The same destination as a REAL URL, for a real link.
  //
  // Rows were only ever navigable by script, so the browser had nothing to offer on a right-click and
  // no way to honour Ctrl/Cmd/middle-click - "open in new tab" simply did nothing on this page.
  //
  // The CLEAN route is used rather than navTo's query form, because it carries the asset in the PATH:
  // /trade/stellar/<CODE>-<ISSUER>. Verified against production - that URL is server-rendered with the
  // right asset (title comes back "USDC price, pools and holders on Stellar"), so a new tab, a
  // bookmark and a pasted link all land on the asset rather than on the default LUMOS page. It is
  // also the URL a person would want to share.
  function assetHref(a){
    try{ return "/trade/stellar/"+encodeURIComponent((a.code||"")+"-"+(a.issuer||"")); }catch(e){ return "#"; }
  }

  // ================= 1) HERO price chip (.lm-chip) =================
  function applyHero(){ var chip=q(".lm-chip"); if(!chip)return;
    var p2=chip.querySelector(".p2"), p3=chip.querySelector(".p3");
    if(p2){ var t=xlmUsd>0?usdSmall(xlmUsd):"\u2014"; if(p2.textContent!==t)p2.textContent=t; }
    if(p3&&xlmChg!=null){ var up=xlmChg>=0; p3.style.color=up?"var(--green)":"var(--red)";
      var h='<span>'+(up?"\u25B2":"\u25BC")+'</span> '+Math.abs(xlmChg).toFixed(2)+'%'; if(p3.innerHTML!==h)p3.innerHTML=h; }
    chip.classList.add("lxd");
  }
  // Replace the "advanced DEX" card's zigzag (svg.lm-svg + .lm-bars) with an orange constellation matching
  // the Pools page's lx-constel (streams + pulsing nodes) plus 5 prominent DATA POINTS (bigger dot + ring).
  // inject the SAME cosmic animation the Pools/AMM hero uses (nebulae + stars + constellation + particles), once
  function applyCosmic(){ var card=q(".lumos-promo"); if(!card)return;
    // Both Trade heroes are static gradient images now, so this layer is never built here, and one an
    // earlier pass left behind is torn out -- the ten keyframe animations do not exist rather than being
    // invisible. (Pools still runs its own; this file only touches Trade.)
    var stale=card.querySelector(".lx-cosmic"); if(stale&&stale.parentNode)stale.parentNode.removeChild(stale);
    return;
    var host=card.querySelector(".lm")||card;
    var d=document.createElement("div"); d.className="lx-cosmic";
    d.innerHTML='<div class="lx-neb n1"></div><div class="lx-neb n2"></div><div class="lx-neb n3"></div><div class="lx-stars"></div>'
      +'<svg class="lx-constel" viewBox="0 0 330 330" xmlns="http://www.w3.org/2000/svg"><g><line x1="52" y1="72" x2="146" y2="46"/><line x1="146" y1="46" x2="238" y2="78"/><line x1="52" y1="72" x2="104" y2="134"/><line x1="146" y1="46" x2="104" y2="134"/><line x1="238" y1="78" x2="202" y2="150"/><line x1="104" y1="134" x2="202" y2="150"/><line x1="238" y1="78" x2="284" y2="166"/><line x1="104" y1="134" x2="68" y2="206"/><line x1="202" y1="150" x2="166" y2="222"/><line x1="284" y1="166" x2="252" y2="242"/><line x1="68" y1="206" x2="166" y2="222"/><line x1="166" y1="222" x2="252" y2="242"/><line x1="166" y1="222" x2="124" y2="272"/><line x1="68" y1="206" x2="124" y2="272"/></g><g><circle cx="52" cy="72" r="3.4" style="animation-delay:-.2s"></circle><circle cx="146" cy="46" r="4" style="animation-delay:-1.4s"></circle><circle cx="238" cy="78" r="3" style="animation-delay:-2.1s"></circle><circle cx="104" cy="134" r="4.4" style="animation-delay:-.8s"></circle><circle cx="202" cy="150" r="3.6" style="animation-delay:-2.7s"></circle><circle cx="284" cy="166" r="2.8" style="animation-delay:-1.1s"></circle><circle cx="68" cy="206" r="3.2" style="animation-delay:-3.2s"></circle><circle cx="166" cy="222" r="4.2" style="animation-delay:-.5s"></circle><circle cx="252" cy="242" r="3" style="animation-delay:-1.9s"></circle><circle cx="124" cy="272" r="3.4" style="animation-delay:-2.4s"></circle></g></svg>'
      +'<div class="lx-part p1"></div><div class="lx-part p2"></div><div class="lx-part p3"></div><div class="lx-part p4"></div>';
    host.insertBefore(d, host.firstChild);
  }
  // Give the MOBILE page the same hero as desktop. It ships a 4-slide auto-rotating carousel (DEX,
  // Launchpad, Low fees, Non-custodial) whose CTAs are all href="#"; the desktop hero is a single DEX
  // panel. Rather than author new copy -- which would hardcode "Stellar" onto every chain's build -- lift
  // the carousel's own DEX slide into the desktop structure, so the headline stays right per chain, and
  // give its dead "#" link the real destination the desktop CTA uses.
  function applyMobileHero(){
    var card=q(".lumos-promo"); if(!card)return;
    if(card.querySelector(".lm"))return;                          // desktop build, or already done
    var slides=card.querySelector(".lumos-promo-slides"); if(!slides)return;
    var slide=card.querySelector('.lumos-promo-slide[data-theme="dex"]')||card.querySelector(".lumos-promo-slide");
    var src=slide&&slide.querySelector(".lumos-promo-content"); if(!src)return;
    var t=src.querySelector(".lumos-promo-title"), s=src.querySelector(".lumos-promo-sub"), a=src.querySelector(".lumos-promo-cta");
    if(!t)return;
    // the slide breaks its title across two lines for a 58%-wide column; ours runs full width
    var head=t.innerHTML.replace(/<br\s*\/?>/gi," ");
    // "on Stellar." takes its own line rather than being squeezed onto the first. Matched on the trailing
    // "on <Word>." so it follows whatever chain the slide names instead of hardcoding one.
    // The leading space is kept OUTSIDE the span deliberately: without it the text reads "DEXon Stellar."
    // to anything that flattens the markup -- a screen reader, a crawler, a copy-paste -- even though the
    // block display hides that from the eye.
    head=head.replace(/\s*\bon\s+([A-Za-z]+)\.\s*$/, ' <span class="lx-hline2">on $1.</span>');
    if(head.indexOf("<em")<0)head=head.replace(/\bDEX\b/,"<em>DEX</em>");   // accent word, as on desktop
    var lm=document.createElement("div"); lm.className="lm";
    // No price pill here: XLM/USD belongs on the pages that trade it, not on this card.
    lm.innerHTML='<div class="lm-c"><span class="lx-heroico" aria-hidden="true"></span><h2 class="lm-h">'+head+'</h2>'
      +'<p class="lm-sub">'+(s?s.innerHTML:"")+'</p></div>';   // the actions live in the pairs heading now
    card.appendChild(lm);                                         // after .lx-cosmic, so the copy paints over it
    card.classList.add("lx-mobhero");
  }
  // Mobile: pull the page's two CTAs inside the hero card and drop the hero's own Start Trading button.
  // They are MOVED, not rebuilt -- Launch Token already points at /launchpad and any listener bound to
  // either node survives relocation, which a clone would not.
  function applyMobileCtas(){
    var card=q(".lumos-promo"); if(!card||card.className.indexOf("lx-mobhero")<0)return;
    var box=card.querySelector(".lm-c"); if(!box)return;
    var ctas=document.querySelector(".mdx-hero-ctas"); if(!ctas)return;
    // The build already seats this row inside the All Trading Pairs heading. This is the fallback for a
    // re-render that moves it: find that heading the same way the build does -- the section head before
    // the pairs filters, since the mobile renderer reorders the two heads at runtime.
    var own=card.querySelector(".lm-cta"); if(own&&own.parentNode)own.parentNode.removeChild(own);
    if(ctas.className.indexOf("lx-ctas")<0)ctas.className+=" lx-ctas";
    var filt=document.querySelector(".mdx-mk-filters")||document.querySelector(".mdx-mk-list"), head=null;
    for(var el=filt;el;el=el.previousElementSibling)
      if(el!==filt&&(" "+el.className+" ").indexOf(" mdx-section-head ")>=0){ head=el; break; }
    if(head&&ctas.parentNode!==head)head.appendChild(ctas);
    // Launch Token leads so it sits on the LEFT; the design ships How it works first
    var prim=ctas.querySelector(".mdx-hero-btn.primary");
    if(prim&&prim!==ctas.firstElementChild)ctas.insertBefore(prim,ctas.firstElementChild);
    // The page H1 and its subtitle sit directly above this card and say what the hero already says.
    // Hidden VISUALLY only. .page-title is this page's ONLY h1 and the mobile file is the one Google
    // indexes, so it keeps its place in the document outline and the accessibility tree instead of being
    // deleted. Re-asserted every pass, so a re-render cannot put them back on screen.
    var pg=card.parentNode; if(pg){
      var hd=[pg.querySelector(".page-title"),pg.querySelector(".page-subtitle")];
      for(var i=0;i<hd.length;i++)if(hd[i]&&(" "+hd[i].className+" ").indexOf(" lx-sronly ")<0)hd[i].className+=" lx-sronly";
    }
  }
  function applyPromoConstel(){
    var svg=q(".lumos-promo .lm-svg"); if(!svg)return;
    if(svg.classList.contains("lx-dxc")&&svg.querySelector(".lx-dxfloat"))return;    // idempotent (rebuild only if clobbered)
    svg.setAttribute("viewBox","0 0 640 300"); svg.setAttribute("preserveAspectRatio","xMidYMid meet"); svg.classList.add("lx-dxc");
    var L=[[70,90,180,55],[180,55,250,90],[250,90,300,100],[300,100,200,120],[200,120,160,150],[160,150,120,205],[120,205,70,90],[70,90,160,150],[300,100,430,160],[300,100,400,60],[400,60,470,70],[470,70,540,105],[540,105,600,110],[540,105,575,170],[575,170,610,195],[430,160,390,200],[390,200,330,235],[330,235,240,175],[240,175,200,120],[430,160,500,225],[500,225,575,170],[390,200,500,225],[470,70,430,160],[240,175,160,150]];
    var ND=[[70,90,3.2,-0.2],[240,175,3.4,-0.8],[120,205,3,-3.2],[400,60,3.4,-1.1],[500,225,3,-1.9],[610,195,3.2,-2.4],[160,150,3,-1.5],[600,110,3.2,-2.9]];   // small pulsing nodes
    var DP=[[180,55,-0.3],[300,100,-1.4],[430,160,-2.1],[540,105,-0.9],[330,235,-2.7],[200,120,-1.7],[470,70,-0.6],[250,90,-2.3],[575,170,-1.2],[390,200,-3.0]];   // 10 data points (5 added)
    var lines=L.map(function(p){return '<line x1="'+p[0]+'" y1="'+p[1]+'" x2="'+p[2]+'" y2="'+p[3]+'"></line>';}).join("");
    var nodes=ND.map(function(p){return '<circle class="nd" cx="'+p[0]+'" cy="'+p[1]+'" r="'+p[2]+'" style="animation-delay:'+p[3]+'s"></circle>';}).join("");
    var dps=DP.map(function(p){return '<circle class="dpr" cx="'+p[0]+'" cy="'+p[1]+'" r="5.5" style="animation-delay:'+p[1+1]+'s"></circle><circle class="dp" cx="'+p[0]+'" cy="'+p[1]+'" r="5" style="animation-delay:'+p[2]+'s"></circle>';}).join("");
    svg.innerHTML='<g class="lx-dxfloat">'+lines+nodes+dps+'</g>';
  }
  // 5 floating DATA POINTS (real trade stats) on the right of the hero animation — like the Pools .lx-hstats
  var XLM_LOGO="https://assets.coingecko.com/coins/images/100/small/fmpFRHHQ_400x400.jpg";
  function applyHeroStats(){
    var card=q(".lumos-promo"); if(!card)return;
    // The strip is a SIBLING of the copy, along the bottom edge -- it used to live inside .lm-chip, which
    // made the price pill a full panel and pushed the headline into a narrow column. Search from the card,
    // not from the chip, so a page still carrying the old placement is found and moved rather than given a
    // second copy of the strip.
    var host=card.querySelector(".lm")||card;
    var box=card.querySelector(".lx-dxstats");
    // Both builds show Trades now. A strip built by an older pass would carry the Liquidity cell --
    // relabel it in place rather than rebuilding, so nothing else in the row is disturbed.
    if(box){ var wrong=box.querySelector('[data-k="liq"]');
      if(wrong){ wrong.setAttribute("data-k","trades");
        var wl=wrong.querySelector(".l"); if(wl)wl.textContent="Trades";
        var wv=wrong.querySelector(".v"); if(wv)wv.innerHTML="\u2014"; } }
    if(!box){ box=document.createElement("div"); box.className="lx-dxstats";
      box.innerHTML='<div class="lx-dxstat" data-k="vol"><span class="v">\u2014</span><span class="l">24h Volume</span></div>'
        +'<div class="lx-dxstat" data-k="trades"><span class="v">\u2014</span><span class="l">Trades</span></div>'
        // A dash like the other three, NOT allAssets().length. This is baked at build time of the strip,
        // which is before the gates below, so a live count here was written while discovery was still
        // running -- it showed the curated handful and then jumped to the full roster. set("mkts") fills
        // it after the gates, so all four cells go from dash to final together.
        +'<div class="lx-dxstat" data-k="mkts"><span class="v">\u2014</span><span class="l">Markets</span></div>'
        +'<div class="lx-dxstat" data-k="top"><span class="v"><span class="lx-dxpair"><span class="pa"></span><span class="pb"></span></span><span class="lx-dxtxt">\u2014</span></span><span class="l">Top Pair</span></div>';
    }
    if(box.parentNode!==host)host.appendChild(box);               // also relocates a strip left inside the chip
    if(!window.__lxDEXloaded)return;                              // reveal with the rest, not one by one
    // And not while the LumosCore roster is still arriving. These are sums over allAssets(), so writing
    // them mid-discovery showed a number built from the curated eight -- Markets 8, a part-formed trade
    // count -- which then climbed as the mints landed. It read as a wrong figure being corrected. Hold at
    // the dash until discovery has finished (2) or given up (0); a failed load resets to 0, so this can
    // never latch on permanently.
    // #10: the gate held only while discovery was RUNNING (state 1). On a cold load the strip is built
    // and filled before loadNative() has been reached at all -- state 0 -- so it wrote the curated
    // eight, and "8 Markets" then jumped to the real roster a moment later. Wait for FINISHED (2), and
    // start discovery here rather than relying on another section having run first. The timer is the
    // release valve: if Horizon never answers, the strip fills with what is known instead of sitting
    // on a dash for good.
    try{ loadNative(); }catch(_){}
    if(!window.__lxMktsTimer){ window.__lxMktsTimer=setTimeout(function(){
      window.__lxMktsGiveUp=1; try{ touch(); }catch(_){}
    },7000); }
    if(nativeState!==2&&!window.__lxMktsGiveUp)return;
    // Sum what the page actually lists. Leaving these on the curated 8 while the table says 39 pairs
    // would put two different definitions of "this exchange" on one screen.
    var _agg=allAssets();
    var vol=0,liq=0; _agg.forEach(function(a){ if(a.vol!=null)vol+=a.vol*xlmUsd; if(a.tvlUsd!=null)liq+=a.tvlUsd; });
    var top=_agg.slice().filter(function(a){return a.vol!=null&&a.vol>0;}).sort(function(a,b){return (b.vol||0)-(a.vol||0);})[0];
    function set(k,v){ var el=box.querySelector('[data-k="'+k+'"] .v'); if(el&&el.innerHTML!==v)el.innerHTML=v; }
    set("vol",vol>0?abbrUsd(vol):"\u2014");
    // Every trade executed against these assets in the last 24h. a.trades is trade_count off the same
    // daily bar the "Trades (24h)" column reads, so the hero and the table cannot disagree. Assets whose
    // bar has not arrived yet are skipped, not counted as zero -- the same way vol is summed.
    var trd=0,seen=0; _agg.forEach(function(a){ if(a.trades!=null){ trd+=+a.trades||0; seen++; } });
    set("trades",seen?num(trd):"\u2014");
    set("mkts",String(_agg.length));   // the strip is built once; the roster grows after
    // Top Pair cell: two overlapping token logos (asset + XLM) + the pair name
    if(top){ var pa=box.querySelector('[data-k="top"] .pa'), pb=box.querySelector('[data-k="top"] .pb'), txt=box.querySelector('[data-k="top"] .lx-dxtxt');
      if(pa){ var pc=logoCss(top); if(pa.style.backgroundImage!==pc)pa.style.backgroundImage=pc; }
      if(pb){ var xc="url("+XLM_LOGO+")"; if(pb.style.backgroundImage!==xc)pb.style.backgroundImage=xc; }
      if(txt){ var tt=top.code+" / XLM"; if(txt.textContent!==tt)txt.textContent=tt; }
    }
  }

  // ================= 2) NEW MINTS (#dexMintsList) =================
  // In-place update helpers: build each section's skeleton ONCE (all rows, real tickers/icons, "\u2014"
  // placeholders), then fill VALUES in place on every data tick. No innerHTML rebuild per tick -> kills the
  // "loading one by one" pop-in and the nonstop glitch that came from rebuilding on ~40 streamed updates.
  function setTxt(el,t){ if(el&&el.textContent!==t)el.textContent=t; }
  function setHTML(el,h){ if(el&&el.innerHTML!==h)el.innerHTML=h; }
  function fillSpark(root,vals,up){ if(vals&&vals.length>=2)up=vals[vals.length-1]>=vals[0]; var svg=q(".dex-mk-spark",root); if(!svg)return; var d=sparkPath(vals);
    var col=up?"#35c07f":"#ff5b5b";
    // Market Movers draws this series as a filled area; All Trading Pairs keeps the hairline -- an
    // 88x28 cell in a table row has no room for a fill, and it is a row, not a chart tile.
    var mover=!!(root&&root.className&&(" "+root.className+" ").indexOf(" dex-mover-card ")>=0);
    var want="";
    if(d&&mover){
      // The gradient is defined INSIDE this svg rather than once in a shared <defs>: url(#id) is
      // resolved against the document base, so a <base> tag turns a shared reference into a miss and
      // the fill silently disappears. Per-card id, so two tiles cannot collide.
      var gid="lxsp"+String(root.getAttribute("data-tkr")||"").replace(/[^A-Za-z0-9]/g,"")+(up?"u":"d");
      want='<defs><linearGradient id="'+gid+'" x1="0" y1="0" x2="0" y2="1">'
          +'<stop offset="0" stop-color="'+col+'" stop-opacity=".22"/>'
          +'<stop offset="1" stop-color="'+col+'" stop-opacity="0"/></linearGradient></defs>'
          +'<path d="'+d+' L88 28 L0 28 Z" fill="url(#'+gid+')" stroke="none"></path>'
          +'<path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="1.4" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"></path>';
    } else if(d){
      want='<path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path>';
    }
    if(svg.innerHTML!==want)svg.innerHTML=want; }
  function renderMints(){ var list=q("#dexMintsList"); if(!list)return;
    loadNative();                                              // this list IS the native roster
    // The design ships "New Mints on Stellar" and re-renders the title in place, so the correction is
    // re-asserted rather than written once.
    try{ var mt=q(".dex-mints-title"); if(mt&&!mt.__lxT){ mt.__lxT=1;
      var fixT=function(){ [].slice.call(mt.childNodes).forEach(function(tn){
        if(tn.nodeType===3&&/New Mints on Stellar|Featured on Stellar/.test(tn.nodeValue))
          tn.nodeValue=tn.nodeValue.replace(/New Mints on Stellar|Featured on Stellar/,"New mints on LumosCore"); }); };
      fixT(); try{ new MutationObserver(fixT).observe(mt,{childList:true,characterData:true,subtree:true}); }catch(_e){}
    } }catch(_){}

    var rows=mintList();
    if(!rows.length){
      if(!list.__lxEmpty){ list.__lxEmpty=1;
        list.innerHTML='<div class="dex-mint-row" style="justify-content:center;color:var(--text-soft);font-size:14px">Loading mints'+String.fromCharCode(8230)+'</div>'; }
      return;
    }
    list.__lxEmpty=0;
    // rebuild only when WHICH assets are listed changes -- not on every price tick, or the row under the
    // pointer is destroyed mid-hover
    var sig=rows.map(function(a){ return a.tkr||a.code; }).join("|");
    if(list.__lxsig!==sig){
      list.__lxsig=sig;
      list.innerHTML=rows.map(function(a){
        return '<div class="dex-mint-row" data-tkr="'+(a.tkr||a.code)+'">'
          +'<span class="dex-mint-ic" data-lxic="'+a.code+'" style="background:'+a.b+'">'+initials(a.code)+'</span>'
          +'<div class="dex-mint-meta">'
            +'<div class="dex-mint-name">'+a.code+'</div>'
            +'<div class="dex-mint-sub">\u2014</div>'
          +'</div>'
          +'<div class="dex-mint-stats">'
            +'<div class="dex-mint-stat"><span class="l">Price</span><span class="v" data-k="px">\u2014</span></div>'
            +'<div class="dex-mint-stat"><span class="l">Market cap</span><span class="v" data-k="mcap">\u2014</span></div>'
            +'<div class="dex-mint-stat"><span class="l">24h Volume</span><span class="v" data-k="vol">\u2014</span></div>'
            +'<div class="dex-mint-stat"><span class="l">24h Trades</span><span class="v" data-k="trades">\u2014</span></div>'
          +'</div>'
        +'</div>'; }).join("");
      paintIcons(list);
      qa(".dex-mint-row",list).forEach(function(row){ row.addEventListener("click",function(){
        var a=mintByKey()[row.getAttribute("data-tkr")]; if(a)navTo(a); }); });
      list.classList.add("lxd");
    }
    // #1: paint from the objects mintList() just handed us, NOT from a second byCode lookup.
    //
    // Two of the three rows resolved to nothing there and were skipped whole -- no price, no market cap,
    // no volume, no trade count, and not even the sub-line -- while the objects themselves held all of
    // it (JROLL: px 3e-7, vol 0.727, 103 trades). The row is keyed by a.tkr, which nativeMake sets to a
    // COLLISION key when the code is already taken, so the key on the row and the key in the map are not
    // reliably the same string. Nothing needs to be looked up: rows IS the answer.
    var _bk=mintByKey();
    qa(".dex-mint-row[data-tkr]",list).forEach(function(row){
      var a=_bk[row.getAttribute("data-tkr")]; if(!a)return; paintIcons(row);
      // #27: the issuer address said nothing a reader could use, and the phone printed "lumoscore.com"
      // on every row -- the same word under each of three tokens on a card headed "New mints on
      // LumosCore". How new is the one thing this card is claiming, so that is what it says now.
      setTxt(row.querySelector(".dex-mint-sub"),mintAge(a)||shortG(a.issuer));
      if(!window.__lxDEXloaded)return;
      // price in XLM with the dollar underneath -- the asset trades in XLM, the reader thinks in dollars
      var pxEl=row.querySelector('[data-k="px"]');
      if(pxEl){ var pu=priceUsd(a);
        setHTML(pxEl, pxPair(a.px,pu,usdSmall)); }
      // supply x price: both already fetched by loadAsset, so this costs nothing extra
      var mc=(a.supply!=null&&a.px>0&&xlmUsd>0)?(a.supply*a.px*xlmUsd):null;
      setTxt(row.querySelector('[data-k="mcap"]'),mc!=null?abbrUsd(mc):"\u2014");
      var vu=(a.vol!=null&&xlmUsd>0)?(a.vol*xlmUsd):null;
      setHTML(row.querySelector('[data-k="vol"]'), a.vol!=null
        ? (abbrNum(a.vol)+' XLM<span class="sub">'+(vu!=null?abbrUsd(vu):"")+'</span>') : "\u2014");
      setTxt(row.querySelector('[data-k="trades"]'),a.trades!=null?num(a.trades):"\u2014");
    });
  }

  // ================= 3) MARKET MOVERS (#dexMoverGrid) =================
  // The order is FROZEN: during load we show a stable set (no continuous re-sort glitch of the % on the right),
  // then compute the real top-4 by |24h change| ONCE all data is in, and keep that order.
  // frozen top-4 PER category: each tab keeps its OWN stable order (no re-sort glitch), but switching tabs
  // now yields the correct set (previously a single global freeze made all 3 tabs show the same 4 assets).
  var _moverFrozen={};
  function moverCat(){ var t=q(".dex-mover-tab.active")||q(".mdx-mover-tab.active");
    return (t&&t.getAttribute)?(t.getAttribute("data-cat")||(t.textContent||"").trim().toLowerCase()||"gainers"):"gainers"; }
  // Takes an optional category so the mobile renderer can ask for a specific tab. Without it, the
  // category comes from ".dex-mover-tab.active" — a selector the mobile markup does not have, so a
  // mobile caller silently got "gainers" for all three tabs.
  // #34: ten, not four. A ceiling rather than a quota -- see the padding note below, which still holds:
  // a category that can only field three honest entries shows three.
  var MOVER_N=10;
  function moverData(forceCat){
    if(!window.__lxDEXloaded)return ASSETS.slice(0,MOVER_N);     // stable placeholder order during load
    var cat=forceCat||moverCat();
    if(_moverFrozen[cat])return _moverFrozen[cat].map(function(c){return byCode[c];}).filter(Boolean);
    var d=ASSETS.slice();
    // GAINERS AND LOSERS ARE QUALITY-GATED. A percentage move is trivially manufactured on an asset
    // nobody holds: one trade against a few dollars of liquidity is a 900% "gainer", and a board of those
    // is worthless and looks like an endorsement. So a mover has to clear both bars:
    //
    //   * at least $500 of liquidity against XLM   (tvlUsd -- the pool it actually trades in)
    //   * at least 250 holders                     (holders -- a real base, not one wallet and a bot)
    //
    // An asset we cannot measure is EXCLUDED rather than assumed good: null is not a passing score.
    // Volume is deliberately NOT gated -- it is already self-limiting, since faking a top-volume slot
    // costs the volume it claims.
    function worthy(a){ return (+a.tvlUsd||0)>=500 && (+a.holders||0)>=250; }
    if(cat==="losers")d=d.filter(function(a){return worthy(a)&&chgU(a)!=null&&chgU(a)<0;}).sort(function(a,b){return chgU(a)-chgU(b);});
    else if(cat==="volume")d=d.sort(function(a,b){return (b.vol||0)-(a.vol||0);});
    else d=d.filter(function(a){return worthy(a)&&chgU(a)!=null&&chgU(a)>=0;}).sort(function(a,b){return chgU(b)-chgU(a);});
    // NO top-up for gainers/losers. This used to backfill by |chg| whenever a category held fewer than
    // four, which meant that on a red day -- every asset down -- "Gainers" filled itself with the four
    // biggest LOSERS and the two tabs showed an identical list of decliners under opposite headings.
    // A short list is a fact about the market; a padded one is a false claim. Volume keeps its top-up,
    // since ordering by volume cannot misrepresent direction.
    if(cat==="volume"&&d.length<MOVER_N)d=ASSETS.slice().sort(function(a,b){return (b.vol||0)-(a.vol||0);});
    d=d.slice(0,MOVER_N); _moverFrozen[cat]=d.map(function(a){return a.code;}); return d;
  }
  // Volume is the default tab: it answers "what is actually trading", and unlike a percentage it cannot
  // be manufactured on a dead asset. Claimed once, so it never drags the reader back mid-browse.
  function moverDefault(){
    var bar=q(".dex-mover-tabs")||q(".dex-mover-tab")&&q(".dex-mover-tab").parentNode;
    if(!bar||bar.__lxDef)return; bar.__lxDef=1;
    var tabs=qa(".dex-mover-tab"), vol=null;
    tabs.forEach(function(t){ if((t.getAttribute("data-cat")||"")==="volume")vol=t; });
    if(!vol)return;
    // Order Volume, Gainers, Losers to match.
    var want=["volume","gainers","losers"], map={};
    tabs.forEach(function(t){ map[t.getAttribute("data-cat")||""]=t; });
    if(map.volume&&map.gainers&&map.losers)want.forEach(function(c){ bar.appendChild(map[c]); });
    tabs.forEach(function(t){ t.classList.toggle("active",t===vol); });
  }
  function renderMovers(){ var grid=q("#dexMoverGrid")||q("#mdxMoverList"); if(!grid)return;
    try{ moverDefault(); }catch(_){}
    var data=moverData(); var sig=data.map(function(a){return a.code;}).join(",");
    // An empty category is now possible and is a real answer: Gainers and Losers are quality-gated, so on
    // a day when nothing qualifies there is nothing to show. Say so rather than leaving a blank panel --
    // and never pad it, which would put arbitrary assets under a heading claiming they moved.
    if(window.__lxDEXloaded&&!data.length){
      var cat0=moverCat();
      var msg='<div class="dex-mover-empty">No '+(cat0==="losers"?"losers":"gainers")
        +' right now among assets with real liquidity and holders.</div>';
      if(grid.innerHTML!==msg){ grid.innerHTML=msg; grid.__lxsig="empty|"+cat0; }
      return;
    }
    if(grid.__lxsig!==sig || !grid.querySelector(".dex-mover-card[data-tkr]")){    // rebuild only when the top-4 order changes
      grid.innerHTML=data.map(function(a){
        return '<div class="dex-mover-card" data-tkr="'+a.code+'" data-cat="'+a.cat+'">'
          +'<div class="dex-mover-head">'
            +'<span class="dex-mover-ico" data-lxic="'+a.code+'" style="background:linear-gradient(135deg,'+a.b+','+a.b+'cc)">'+initials(a.code)+'</span>'
            +'<div class="dex-mover-pair">'+a.code+vtick(a.code,a.issuer)+'<span class="sub">\u2014</span></div>'
            +'<span class="dex-mover-pct">\u2014</span>'
          +'</div>'
          +'<div class="dex-mover-body">'
            +'<div class="dex-mover-l">'
              +'<div class="dex-mover-price">\u2014</div>'
              +'<div class="dex-mover-vol">\u2014</div>'
            +'</div>'
            +'<div class="dex-mover-r"><div class="dex-mover-trades">\u2014</div><div class="dex-mover-tlabel">Trades 24h</div></div>'
          +'</div>'
          +sparkSvg(null,true)
        +'</div>'; }).join("");
      grid.__lxsig=sig; paintIcons(grid);
      qa(".dex-mover-card",grid).forEach(function(card){ card.addEventListener("click",function(){ var a=byCode[card.getAttribute("data-tkr")]; if(a)navTo(a); }); });
      grid.classList.add("lxd");
      faqRelease();                                          // B12: content is on screen, the FAQ may follow
    }
    qa(".dex-mover-card[data-tkr]",grid).forEach(function(card){ var a=byCode[card.getAttribute("data-tkr")]; if(!a)return; paintIcons(card);
      if(!window.__lxDEXloaded)return;                          // reveal all detail values together, not one by one
      var _cu=chgShown(a); var up=(_cu||0)>=0;
      setTxt(card.querySelector(".dex-mover-pair .sub"),dispDom(a.code,a.issuer,a.domain)||shortG(a.issuer));
      // N6: repaint only when the DISPLAYED string changes, and never leave the pill empty.
      //
      // On the $ view the change is not a stored figure -- it is derived from the asset's XLM move and
      // the live XLM/USD rate, so the underlying number moves fractionally every time that rate
      // refreshes even though the market has not moved at all. Writing it on every applyAll tick made
      // the percentage flicker continuously. Comparing the rendered string means a change too small to
      // survive rounding never reaches the DOM, and the pill stops twitching.
      //
      // Cards were also being left with a coloured up/down pill and NO text in it -- a bare green or red
      // stub beside a price. The value and the class are now written together or not at all, so the two
      // cannot disagree again.
      var pct=card.querySelector(".dex-mover-pct");
      if(pct){
        var _ptxt=(_cu!=null)?((up?"+":"")+_cu.toFixed(2)+"%"):"\u2014";
        var _pcls="dex-mover-pct"+(_cu!=null?(up?" up":" down"):"");
        if(pct.__lxPct!==_ptxt||pct.className!==_pcls){
          pct.__lxPct=_ptxt; pct.className=_pcls; pct.textContent=_ptxt;
        }
      }
      setHTML(card.querySelector(".dex-mover-price"),fmtPrice(a.px)+' <span style="font-size:14px;color:var(--text-soft);font-weight:600">XLM</span>');
      var vu=a.vol!=null?a.vol*xlmUsd:null;
      setHTML(card.querySelector(".dex-mover-vol"),'<span class="lxk">Vol</span><span class="lxv">'+(vu!=null?lcm(vu):"\u2014")+'</span><span class="lxk">TVL</span><span class="lxv">'+(a.tvlUsd!=null?lcm(a.tvlUsd):"\u2014")+'</span>');
      setTxt(card.querySelector(".dex-mover-trades"),a.trades!=null?num(a.trades):"\u2014");
      fillSpark(card,a.spark,up);
    });
  }

  // ================= 4) ALL TRADING PAIRS (#dexMkTbody) =================
  // Column sorting. Five numeric columns, keyed to the fields the rows already carry.
  var MK_SORTS=[["th-price","px"],["th-change","chg"],["th-vol","vol"],["th-trades","trades"],["th-tvl","tvlUsd"]];
  // Default: 24h volume, high to low. dir -1 = biggest first. "" would mean roster order, which is now
  // only reachable by sorting on another column.
  var mkSort={key:"vol",dir:-1};
  // Unknowns sink to the bottom in BOTH directions. Sorting ascending by volume should surface the
  // quietest real market, not the thirty rows whose volume has not been fetched yet -- those carry no
  // information and would bury the answer.
  function mkCmp(k,dir){ return function(a,b){
    var x=a[k], y=b[k];
    var xn=(x==null||x!==x), yn=(y==null||y!==y);
    if(xn&&yn)return 0; if(xn)return 1; if(yn)return -1;
    return dir<0?(y-x):(x-y); }; }
  function mkSortRows(d){ return mkSort.key?d.slice().sort(mkCmp(mkSort.key,mkSort.dir)):d; }
  // The thead is design markup; make the numeric columns clickable once and keep the arrows in step.
  function ensureSortHeaders(){
    var tb=q("#dexMkTbody"); if(!tb||!tb.closest)return; var tbl=tb.closest("table"); if(!tbl)return;
    var thr=tbl.querySelector("thead tr"); if(!thr)return;
    MK_SORTS.forEach(function(s){
      var th=thr.querySelector("."+s[0]); if(!th)return;
      if(!th.__lxs){ th.__lxs=1; th.classList.add("lx-sortable"); th.setAttribute("data-sk",s[1]);
        var ar=document.createElement("span"); ar.className="lx-sarrow"; th.appendChild(ar); }
      var on=(mkSort.key===s[1]);
      if(th.classList.contains("lx-son")!==on)th.classList.toggle("lx-son",on);
      var a2=th.querySelector(".lx-sarrow");
      if(a2){ var want=on?(mkSort.dir<0?"\u25bc":"\u25b2"):"\u21c5"; if(a2.textContent!==want)a2.textContent=want; }
    });
  }
  // The click has to be caught on WINDOW CAPTURE, not on the header.
  //
  // The design ships a delegated navigation handler on DOCUMENT capture, and document capture runs before
  // the event ever reaches the th -- so a listener on the header itself never fired, and every click on a
  // column title reloaded the page instead of sorting it (measured: navigation type "navigate", referrer
  // equal to the page's own URL). Window capture is the only phase that runs earlier. Same reason and the
  // same shape as the mobile layer's nav interception.
  function installSortClicks(){
    if(window.__lxDEXsortClick)return; window.__lxDEXsortClick=1;
    window.addEventListener("click",function(e){
      var t=e.target; if(!t||!t.closest)return;
      var th=t.closest("th.lx-sortable[data-sk]"); if(!th)return;
      e.preventDefault(); e.stopImmediatePropagation();
      var k=th.getAttribute("data-sk");
      if(mkSort.key===k)mkSort.dir=-mkSort.dir; else { mkSort.key=k; mkSort.dir=-1; }
      mkPage=1;                                               // a new order starts at the top of the list
      guardApply();
    },true);
  }
  function tableData(){ var f=(q(".dex-mk-filter.active")||{}).getAttribute?(q(".dex-mk-filter.active").getAttribute("data-filter")||"all"):"all";
    var qs=""; var si=q("#dexMkSearch"); if(si)qs=(si.value||"").trim().toLowerCase();
    // Kicked off here rather than on the native tab alone: All lists them too, so they load with the page.
    loadNative();
    // #7: two lists now, not five. "Curated" is the vetted roster only -- LumosCore mints have their own
    // tab and no longer appear here, so the first list a visitor sees is one somebody stands behind
    // rather than everything that has ever been issued through the launchpad.
    //
    // Stables / Memes / Utility are gone. Memes filtered to an empty list by construction (nothing ever
    // set that category), and the other two split a roster of eight into subsets of two and three, which
    // is not a filter anyone needs. The data-filter values are still honoured if an old chip survives
    // somewhere, so nothing breaks if one is missed.
    var d;
    if(f==="native")d=NATIVE.slice();
    else if(f==="utility")d=allAssets().filter(function(a){return a.cat==="utility";});
    else if(f==="stables")d=allAssets().filter(function(a){return a.cat==="stable";});
    else if(f==="memes")d=[];
    else d=ASSETS.slice();
    if(qs)d=d.filter(function(a){ return a.code.toLowerCase().indexOf(qs)>=0; });
    return mkSortRows(d);                                     // sorted here, so pagination pages the SORTED set
  }
  function tableSig(){ var f=(q(".dex-mk-filter.active")||{}).getAttribute?(q(".dex-mk-filter.active").getAttribute("data-filter")||"all"):"all"; var qs=(q("#dexMkSearch")||{}).value||""; return f+"|"+qs.trim().toLowerCase()+"|"+NATIVE.length+"|"+nativeState+"|"+mkSort.key+mkSort.dir; }
  // the thead is design markup (8 cols); insert a "Trades (24h)" th once, right after Volume (24h), so the 24h-activity columns sit together.
  function ensureTradesHeader(){ var tb=q("#dexMkTbody"); if(!tb||!tb.closest)return; var tbl=tb.closest("table"); if(!tbl)return;
    var thr=tbl.querySelector("thead tr"); if(!thr||thr.querySelector(".th-trades"))return;
    var th=document.createElement("th"); th.className="th-trades"; th.textContent="Trades (24h)";
    var volTh=thr.querySelector(".th-vol");
    if(volTh){ thr.insertBefore(th,volTh.nextSibling); } else { thr.appendChild(th); }
  }
  // ---- pagination -----------------------------------------------------------------------------------
  var MK_PER=50, mkPage=1;
  var PG_F='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>';
  var PG_P='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="15 18 9 12 15 6"/></svg>';
  var PG_N='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="9 18 15 12 9 6"/></svg>';
  var PG_L='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>';
  function renderPager(pages){
    var pg=q(".dex-mk-pager"); if(!pg)return;
    // One page needs no controls -- a lone "1" with four dead arrows is furniture, not navigation.
    if(pages<2){ if(pg.__lxh!=="")  { pg.innerHTML=""; pg.__lxh=""; } pg.style.display="none"; return; }
    pg.style.display="";
    var h="";
    function nav(ic,to,lab){ var off=(to<1||to>pages||to===mkPage);
      return '<button class="dex-mk-pgbtn" data-pg="'+to+'" aria-label="'+lab+'"'+(off?' disabled style="opacity:.4;cursor:default"':"")+'>'+ic+'</button>'; }
    h+=nav(PG_F,1,"First")+nav(PG_P,mkPage-1,"Previous");
    // a five-wide window around the current page, with the first/last page always reachable
    var lo=Math.max(1,mkPage-2), hi=Math.min(pages,lo+4); lo=Math.max(1,hi-4);
    if(lo>1){ h+='<button class="dex-mk-pgbtn" data-pg="1">1</button>'; if(lo>2)h+='<span class="dex-mk-dots">…</span>'; }
    for(var i=lo;i<=hi;i++)h+='<button class="dex-mk-pgbtn'+(i===mkPage?" active":"")+'" data-pg="'+i+'">'+i+'</button>';
    if(hi<pages){ if(hi<pages-1)h+='<span class="dex-mk-dots">…</span>'; h+='<button class="dex-mk-pgbtn" data-pg="'+pages+'">'+pages+'</button>'; }
    h+=nav(PG_N,mkPage+1,"Next")+nav(PG_L,pages,"Last");
    if(pg.__lxh!==h){ pg.innerHTML=h; pg.__lxh=h; }
    if(!pg.__lxw){ pg.__lxw=1;
      // CAPTURE, and stop the event here: the layer already runs a window-capture nav handler for rows,
      // and the design has its own click plumbing in this footer.
      pg.addEventListener("click",function(e){
        var b=e.target&&e.target.closest?e.target.closest("[data-pg]"):null; if(!b||b.disabled)return;
        e.preventDefault(); e.stopImmediatePropagation();
        var n=+b.getAttribute("data-pg")||1; if(n===mkPage)return; mkPage=n; guardApply();
        try{ var sec=q(".dex-markets"); if(sec&&sec.scrollIntoView)sec.scrollIntoView({block:"start",behavior:"smooth"}); }catch(_){}
      },true); }
  }
  function renderTable(){ var tb=q("#dexMkTbody"); if(!tb)return;
    try{ ensureTradesHeader(); }catch(_){}
    try{ ensureSortHeaders(); installSortClicks(); }catch(_){}  // after the Trades column exists, so it sorts too
    var all=tableData();
    // A new filter or search starts at page 1 -- but NOT a data refresh. tableSig() also moves as the
    // native roster loads, so keying the reset on it would yank a reader back to page 1 mid-browse.
    var fkey=curFilter()+"|"+(((q("#dexMkSearch")||{}).value)||"").trim().toLowerCase();
    if(tb.__lxfk!==fkey){ tb.__lxfk=fkey; mkPage=1; }
    var pages=Math.max(1,Math.ceil(all.length/MK_PER)); if(mkPage>pages)mkPage=pages;
    var start=(mkPage-1)*MK_PER, data=all.slice(start,start+MK_PER);
    try{ priceVisible(data); }catch(_){}                      // fetch the rows this page actually shows
    // The visible ORDER joins the signature whenever a sort is active. Without it the skeleton is only
    // rebuilt when the filter, search, page or sort CONTROL changes -- and volumes arrive long after
    // that, so a volume sort would freeze in whatever order the rows had before a single number landed.
    // Values still fill in place; this only rebuilds when the sequence itself actually differs.
    var sig=tableSig()+"|p"+mkPage+(mkSort.key?("|"+data.map(function(a){return a.tkr||a.code;}).join(",")):"");
    try{ renderPager(pages); }catch(_){}
    // rebuild the skeleton ONLY when the filter/search changes (user action) or our rows were clobbered
    if(tb.__lxsig!==sig || (!tb.querySelector("tr[data-tkr]")&&!tb.querySelector("tr.lx-dex-empty-row"))){
      if(!data.length){ tb.innerHTML='<tr class="lx-dex-empty-row"><td colspan="9"><div class="lx-dex-empty">No matching markets on Stellar right now.</div></td></tr>'; }
      else tb.innerHTML=data.map(function(a,_i){
        return '<tr data-tkr="'+(a.tkr||a.code)+'" data-iss="'+a.issuer+'" data-cat="'+a.cat+'">'
          +'<td><a class="dex-mk-pair-link" href="'+assetHref(a)+'"><div class="dex-mk-pair-cell">'
            +'<span class="dex-mk-rank">#'+(start+_i+1)+'</span>'
            +'<span class="dex-mk-pair-ic" data-lxic="'+a.code+'" style="background:linear-gradient(135deg,'+a.b+','+a.b+'aa)">'+initials(a.code)+'</span>'
            +'<div class="dex-mk-pair-name"><div class="dex-mk-pair-head">'+a.code+vtick(a.code,a.issuer)+'</div><span class="sub">'+(dispDom(a.code,a.issuer,a.domain)||shortG(a.issuer))+'</span></div>'
          +'</div></a></td>'
          +'<td><div class="dex-mk-price">\u2014</div></td>'
          +'<td><div class="dex-mk-change">\u2014</div></td>'
          +'<td><div class="dex-mk-vol">\u2014</div></td>'
          +'<td class="dex-mk-trades-td"><div class="dex-mk-trades">\u2014</div></td>'
          +'<td><div class="dex-mk-tvl">\u2014</div></td>'
          +'<td><div class="dex-mk-hl">'
            +'<div class="row"><span class="lab">H</span><span class="v-h">\u2014</span></div>'
            +'<div class="row"><span class="lab">L</span><span class="v-l">\u2014</span></div>'
          +'</div></td>'
          +'<td style="text-align:right">'+sparkSvg(null,true)+'</td>'
          +'<td class="td-action" style="text-align:right"><button class="dex-mk-action-btn" data-tkr="'+(a.tkr||a.code)+'">Trade</button></td>'
        +'</tr>'; }).join("");
      tb.__lxsig=sig; paintIcons(tb);
      qa("tr[data-tkr]",tb).forEach(function(tr){ tr.addEventListener("click",function(){ var a=byCode[tr.getAttribute("data-tkr")]; if(a)navTo(a); }); });
      qa(".dex-mk-action-btn",tb).forEach(function(btn){ btn.addEventListener("click",function(e){ e.stopPropagation(); var a=byCode[btn.getAttribute("data-tkr")]; if(a)navTo(a); }); });
      var shown=q("#dexMkShown"); if(shown)setTxt(shown,data.length===0?"0":(start+1)+"\u2013"+(start+data.length));
      var strongs=qa(".dex-mk-page-info strong"); if(strongs[1])setTxt(strongs[1],String(all.length));
      if(sortReady)tb.classList.add("lxd");
    }
    if(sortReady&&!tb.classList.contains("lxd"))tb.classList.add("lxd");
    // fill values in place (no innerHTML churn -> no glitch); gated so ALL rows' details reveal together
    qa("tr[data-tkr]",tb).forEach(function(tr){ var a=byCode[tr.getAttribute("data-tkr")]; if(!a)return; paintIcons(tr);
      if(!window.__lxDEXloaded)return;                          // reveal all detail values together, not one by one
      var _cu=chgShown(a); var up=(_cu||0)>=0;
      var pu=priceUsd(a), vu=a.vol!=null?a.vol*xlmUsd:null, hi=a.high!=null?a.high:a.px, lo=a.low!=null?a.low:a.px;
      setHTML(q(".dex-mk-price",tr),pxPair(a.px,pu,lcmExact));
      var chg=q(".dex-mk-change",tr); if(chg){ chg.className="dex-mk-change"+(_cu!=null?(up?" up":" down"):""); setTxt(chg,_cu!=null?(up?"+":"")+_cu.toFixed(2)+"%":"\u2014"); }
      setHTML(q(".dex-mk-vol",tr),(a.vol!=null?fmtAmt(a.vol)+" XLM":"\u2014")+'<span class="sub">'+(vu!=null?lcm(vu):"")+'</span>');
      setTxt(q(".dex-mk-trades",tr),a.trades!=null?num(a.trades):"\u2014");
      setHTML(q(".dex-mk-tvl",tr),a.tvlUsd!=null?lcm(a.tvlUsd):"\u2014");
      setTxt(q(".v-h",tr),fmtPrice(hi)); setTxt(q(".v-l",tr),fmtPrice(lo));
      fillSpark(tr,a.spark,up); paintIcons(tr);
    });
  }

  // ================= apply / observe / boot =================
  function applyAll(){
    try{ applyMobileHero(); }catch(_){}         // first: builds the .lm the next three expect on mobile
    try{ applyMobileCtas(); }catch(_){}         // then move the page CTAs into it
    try{ applyHero(); }catch(_){}
    try{ applyCosmic(); }catch(_){}             // same nebula/stars/constellation animation as the Pools hero
    try{ applyPromoConstel(); }catch(_){}       // keeps the original .lm-svg zigzag hidden (rebuilt as hidden .lx-dxc)
    try{ applyHeroStats(); }catch(_){}
    try{ trimFilters(); try{ labelHiw(); }catch(_){} }catch(_){}
    try{ labelFilterInput(); }catch(_){}
    try{ orderSections(); }catch(_){}
    try{ dropSections(); }catch(_){}
    try{ denomUi(); denomUiSync(); }catch(_){}
    try{ renderMints(); }catch(_){}
    try{ renderMovers(); }catch(_){}
    try{ renderTable(); }catch(_){}
  }

  // TVL across an asset's pools valued in USD (native-paired: nat*2; asset-paired: ass*px*2), then *xlmUsd.
  function computeTvl(a){ if(!a.poolsRaw)return; var txlm=0; a.poolsRaw.forEach(function(p){ if(p.nat>0)txlm+=p.nat*2; else if(p.ass>0&&a.px>0)txlm+=p.ass*a.px*2; }); a.tvlXlm=txlm; a.tvlUsd=txlm*xlmUsd; }
  function recomputeAllTvl(){ ASSETS.forEach(computeTvl); }

  // stellar.toml (best-effort; many issuers' domains are CORS-OK) -> [[CURRENCIES]].image for the real logo
  // The issuer's logo, resolved SERVER-SIDE.
  //
  // This used to fetch the toml straight from the browser, described as best-effort because many
  // issuer domains are CORS-OK. Plenty are not, and a browser cannot read a response without the
  // header: pubnet-sep.latamex.com serves ARST's toml perfectly well and sends no
  // Access-Control-Allow-Origin, so ARST wore an initials disc on Trade while its real logo showed
  // everywhere else on the site. /lxapi/assetlogo does the same walk from a server, which has no such
  // limit, and is edge-cached -- it is exactly why that endpoint was built.
  //
  // The domain argument is kept because callers pass it; the resolver reads the issuer's own
  // home_domain itself, so it is no longer needed here.
  function loadToml(a,domain){
    fetch("/lxapi/assetlogo?v=2&asset="+encodeURIComponent(a.code+"-"+a.issuer))
      .then(function(r){ return r.ok?r.json():null; })
      .then(function(j){ if(j&&j.image)a.img=j.image; a.__logoDone=1; touch(); })
      .catch(function(){ a.__logoDone=1; touch(); });   // an unreachable resolver is a conclusion too
  }

  // Just enough for a mints row: the latest daily bar (price) and /assets (supply + holders). Two
  // requests instead of five, and none of them the 168-bucket sparkline series.
  function loadAssetLite(a){
    var atype=a.code.length<=4?"credit_alphanum4":"credit_alphanum12";
    var base="base_asset_type="+atype+"&base_asset_code="+a.code+"&base_asset_issuer="+a.issuer+"&counter_asset_type=native";
    return Promise.all([
      lxAgg(a,"86400000",1,"desc").then(function(d){
        // #3: this is the SAME daily bar the full loader reads, and it already carries counter_volume and
        // trade_count -- the lite path simply threw them away. That is why the two 24h columns I added to
        // the mint rows last batch showed a dash on every row: the data was in the response and discarded
        // one line before it was needed. No extra request.
        var r=recs(d)[0]; if(r){ a.px=+r.close||+r.avg||subPx(r)||a.px;
          a.vol=+r.counter_volume||0; a.trades=+r.trade_count||0;
          a.high=+r.high||0; a.low=+r.low||0; } }).catch(function(){}),
      j(H+"/assets?asset_code="+a.code+"&asset_issuer="+a.issuer).then(function(d){
        var rec=recs(d)[0]; if(!rec)return;
        if(rec.accounts)a.holders=(+rec.accounts.authorized||0)+(+rec.accounts.authorized_to_maintain_liabilities||0);
        if(rec.balances)a.supply=+rec.balances.authorized||+rec.balances.authorized_to_maintain_liabilities||a.supply;
        else if(rec.amount!=null)a.supply=+rec.amount;
        // same free home_domain as the edge endpoint, so the degraded path labels rows too
        var tl=rec._links&&rec._links.toml&&rec._links.toml.href;
        if(tl&&!a.domain){ var af=String(tl).split("//")[1]||""; a.domain=af.split("/")[0]||""; if(a.domain&&!a.img)loadToml(a,a.domain); }
      }).catch(function(){})
    ]).then(touch);
  }

  function loadAsset(a){
    var atype=a.code.length<=4?"credit_alphanum4":"credit_alphanum12";
    var base="base_asset_type="+atype+"&base_asset_code="+a.code+"&base_asset_issuer="+a.issuer+"&counter_asset_type=native";
    var calls=[];
    // price + 24h change + high/low + 24h volume (daily aggregations)
    calls.push(lxAgg(a,"86400000",2,"desc").then(function(d){ var r=recs(d);
      if(r[0]){ a.px=+r[0].close||+r[0].avg||subPx(r[0])||a.px; a.vol=+r[0].counter_volume||0; a.high=+r[0].high||0; a.low=+r[0].low||0; a.trades=+r[0].trade_count||0; }
      if(r[0]&&r[1]&&+r[1].close>0)a.chg=((+r[0].close-+r[1].close)/+r[1].close)*100;
      computeTvl(a); touch(); }).catch(function(){}));
    // 7D trend sparkline: the MOST RECENT 168 hourly buckets (=7 days), desc then reversed to chronological.
    // (was resolution=3600000 order=asc limit=24 -> the 24 OLDEST buckets = wrong window under a "7D" label.)
    calls.push(lxAgg(a,"3600000",168,"desc").then(function(d){ var r=recs(d).slice().reverse();
      var pts=r.map(function(x){ return +x.avg||+x.close||0; }).filter(function(v){ return v>0; }); if(pts.length>=2)a.spark=pts; touch(); }).catch(function(){}));
    // pool TVL
    calls.push(j(H+"/liquidity_pools?reserves="+a.code+":"+a.issuer+"&limit=200").then(function(d){ var r=recs(d);
      a.poolsRaw=r.map(function(p){ var nat=0,ass=0; (p.reserves||[]).forEach(function(rv){ if(rv.asset==="native")nat=+rv.amount; else if(rv.asset.indexOf(a.code+":"+a.issuer)===0)ass=+rv.amount; }); return {nat:nat,ass:ass}; });
      computeTvl(a); touch(); }).catch(function(){}));
    // holders (trustlines) + supply
    calls.push(j(H+"/assets?asset_code="+a.code+"&asset_issuer="+a.issuer).then(function(d){ var rec=recs(d)[0]; if(!rec)return;
      if(rec.accounts)a.holders=(+rec.accounts.authorized||0)+(+rec.accounts.authorized_to_maintain_liabilities||0);
      if(rec.balances)a.supply=+rec.balances.authorized||+rec.balances.authorized_to_maintain_liabilities||a.supply;
      else if(rec.amount!=null)a.supply=+rec.amount; touch(); }).catch(function(){}));
    // issuer home_domain (-> mint/mover sub + stellar.toml logo)
    // home_domain is stable and the cached roster already carries it -- only ask when we do not know
    if(a.domain){ loadToml(a,a.domain); }
    else calls.push(j(H+"/accounts/"+a.issuer).then(function(acc){ a.domain=acc.home_domain||""; touch(); if(acc.home_domain)loadToml(a,acc.home_domain); }).catch(function(){ a.domain=""; }));
    return Promise.all(calls);
  }

  function loadData(){
    // Our own edge, cached: CoinGecko's free tier answers a handful of requests a minute per IP and
    // every visitor was spending that budget on the same public number. xlmChg is load-bearing now --
    // every percentage in the pair list is derived from it -- so it has to actually arrive.
    j("/lxapi/xlm").then(function(d){
      if(d&&+d.usd>0){ xlmUsd=+d.usd;
        if(d.chg24!=null){xlmChg=+d.chg24;try{window.__lxXlmChg=xlmChg;}catch(_e2){}}
        try{ localStorage.setItem("lumos.xlmUsd",JSON.stringify({v:xlmUsd,chg:xlmChg,ts:Date.now()})); }catch(_e){} }
      recomputeAllTvl(); touch();
    }).catch(function(){});
    // load ALL assets in PARALLEL so values + logos land together (no "loading one by one" cascade). When
    // every asset is in, flag loaded -> the movers compute their final top-4 order ONCE (no re-sort glitch).
    // the curated set the same way as everything else: numbers in one batched request, extras after
    ASSETS.forEach(function(a){ a.__px=1; });
    // priceVisible is exported because the PHONE renders its own pair list. Only the five newest native
    // tokens are priced up front; every other row is priced when it is actually rendered, and the desktop
    // list does that itself. The mobile list had no way to ask, so 26 of 32 launchpad tokens sat at
    // "0 XLM / —" -- and they had not simply never traded: LIBERATOR, BLA and TDT had all traded within
    // the hour. It was a missing request, not a missing market.
    batchPx(ASSETS).then(function(){ window.__lxDEXloaded=1; try{ markSortReady(); }catch(_){} try{window.__lxDEXassets=ASSETS;window.__lxDEXmovers=moverData;window.__lxDEXlogoCss=logoCss;window.__lxDEXpriceRows=priceVisible;window.__lxDEXmints=mintList;}catch(_){} touch(); deferExtras(ASSETS); },
      function(){ window.__lxDEXloaded=1; try{ markSortReady(); }catch(_){} touch(); });
    // safety: reveal details even if an asset's request hangs (never leave the table stuck on placeholders)
    setTimeout(function(){ sortReady=true; try{ window.__lxDEXsortReady=1; }catch(_){} try{ guardApply(); }catch(_){} }, 6000);
    setTimeout(function(){ if(!window.__lxDEXloaded){ window.__lxDEXloaded=1; try{window.__lxDEXassets=ASSETS;window.__lxDEXmovers=moverData;window.__lxDEXlogoCss=logoCss;}catch(_){} touch(); } }, 4500);
  }

  // dedicated per-section guardian: fires only on a CHILDLIST change of the container (i.e. the design blew
  // away our rows with its mock render). We observe childList ONLY (not subtree/characterData) so the site
  // money-formatter's in-place text tweaks never trigger us, and the render funcs self-skip unless our marker
  // is gone or DV changed -> no MutationObserver ping-pong / renderer freeze.
  function guardEl(sel,fn){ var el=q(sel); if(!el||el.__lxg)return; el.__lxg=1;
    try{ var mo=new MutationObserver(function(){ if(el.__lxgBusy)return; el.__lxgBusy=1; mo.disconnect(); try{ fn(); }catch(_){} try{ mo.observe(el,{childList:true}); }catch(_){} el.__lxgBusy=0; });
      mo.observe(el,{childList:true}); }catch(_){}
  }

  var sched2=false;
  function guardApply(){ try{ applyAll(); }catch(_){} }
  function sched(){ if(sched2)return; sched2=true; setTimeout(function(){ sched2=false; guardApply(); },200); }
  function touch(){ DV++; sched(); }                          // real data landed -> bump version + re-render
  window.__lxDEXapply=guardApply;
  window.__lxDEXloadNative=loadNative;
  window.__lxDEXnativeList=function(){ return {list:NATIVE,state:nativeState}; };
  window.__lxDEXdbg=function(){ return {xlmUsd:xlmUsd,xlmChg:xlmChg,assets:ASSETS.map(function(a){return {code:a.code,px:a.px,chg:a.chg,vol:a.vol,tvlUsd:a.tvlUsd,holders:a.holders,supply:a.supply,domain:a.domain,img:a.img};})}; };

  // #19: a two-state switch to the LEFT of the filter input, which is where the row has room and where
  // it reads as a property of the list rather than of the search. Segmented rather than a dropdown: two
  // options, both worth showing, and the current one should be readable without opening anything.
  function denomUi(){
    var box=document.querySelector(".dex-mk-search"); if(!box||box.__lxdn)return; box.__lxdn=1;
    var wrap=document.createElement("div"); wrap.className="lx-dnsw"; wrap.setAttribute("role","group");
    wrap.setAttribute("aria-label","Show price change in");
    // data-logo is the skip flag for the logo engine baked into the container. Without it this switch was
    // silently emptied on every load: that engine claims ANY element whose text is 1-5 characters and
    // which "looks like an icon" (a border-radius of 4px or more, or a gradient), then replaces its
    // contents with a token image. The wrapper reads "$XLM" -- four characters in a rounded, filled box --
    // so it was a perfect match, and the two buttons went with it. Set on the buttons too, since either
    // one alone would qualify on its own.
    wrap.innerHTML='<button type="button" data-dn="usd">$</button><button type="button" data-dn="xlm">XLM</button>';
    wrap.setAttribute("data-logo","");
    [].slice.call(wrap.querySelectorAll("button")).forEach(function(b){ b.setAttribute("data-logo",""); });
    box.parentNode.insertBefore(wrap,box);
    wrap.addEventListener("click",function(e){
      var b=e.target&&e.target.closest?e.target.closest("button[data-dn]"):null; if(!b)return;
      e.preventDefault(); e.stopPropagation();
      setDenom(b.getAttribute("data-dn")); denomUiSync(); touch();
    });
    denomUiSync();
  }
  function denomUiSync(){
    var d=denom();
    // N10: name the basis. An asset can be up against XLM and down against the dollar on the same day,
    // so "24H CHANGE" alone does not say what is being reported.
    try{
      var _th=document.querySelector(".dex-mk-table thead th.th-change");
      if(_th){
        var _want="24H CHANGE ("+(d==="xlm"?"XLM":"$")+")";
        var _tn=null,_ns=_th.childNodes;
        for(var _i=0;_i<_ns.length;_i++){ if(_ns[_i].nodeType===3&&(_ns[_i].nodeValue||"").trim()){ _tn=_ns[_i]; break; } }
        if(_tn){ if(_tn.nodeValue.trim()!==_want)_tn.nodeValue=_want; }
        else if(_th.textContent.trim()!==_want)_th.textContent=_want;
      }
    }catch(_){}
    // Same treatment for the two columns that were printing their unit on every row. A per-row suffix
    // widened Last Price enough to wrap it in XLM, and the width it took squeezed Day High / Low onto
    // three lines -- the whole table got taller on a toggle that changed no data.
    try{
      var _setTh=function(sel,want){
        var t=document.querySelector(sel); if(!t)return;
        // The TEXT node only. The sort caret is an element child of the same th, and writing
        // textContent would delete it -- the column would lose its control on the first repaint.
        var tn=null,ns=t.childNodes;
        for(var i2=0;i2<ns.length;i2++){ if(ns[i2].nodeType===3&&(ns[i2].nodeValue||"").trim()){ tn=ns[i2]; break; } }
        if(tn){ if(tn.nodeValue.trim()!==want)tn.nodeValue=want; }
        else if(t.textContent.trim()!==want)t.textContent=want;
      };
      _setTh(".dex-mk-table thead th.th-price","LAST PRICE ("+(d==="xlm"?"XLM":"$")+")");
      // High/low is quoted against XLM in BOTH views, so this label does not follow the toggle.
      _setTh(".dex-mk-table thead th.th-hl","DAY HIGH / LOW (XLM)");
    }catch(_){}
    qa(".lx-dnsw button[data-dn]").forEach(function(b){
      var on=b.getAttribute("data-dn")===d;
      if(b.classList.contains("on")!==on)b.classList.toggle("on",on);
      b.setAttribute("aria-pressed",on?"true":"false");
    });
  }
  // B12: let the FAQ in once the rest of the page exists -- or after two seconds regardless, so a page
  // whose data never arrives still shows it. Idempotent; the class is only ever added.
  function faqRelease(){ try{ document.documentElement.classList.add("lx-dexlate"); }catch(_){} }
  function boot(){
    try{ denomUi(); }catch(_){}
    setTimeout(faqRelease,2000);
    loadManifest();                                            // our own hosted token icons; independent of the toml
    guardApply();                                              // synchronous skeleton (real tickers/icons, "\u2014" values, .lxd) -> no mock flash, no blank
    // The design has its own row/Trade click handler that opens the asset page WITHOUT the ?asset= param
    // (lands on default LUMOS). Preempt it with a document-CAPTURE delegated nav that carries the param and
    // stopImmediatePropagation()s the design's handler. Survives node replacement (delegated) too.
    if(!window.__lxDEXnav){ window.__lxDEXnav=1;
      // WINDOW-capture (the earliest phase) so we run before the design's document-capture nav handler.
      window.addEventListener("click",function(e){ var t=e.target; if(!t||!t.closest)return;
        var el=t.closest(".dex-mk-action-btn[data-tkr],tr[data-tkr],.dex-mint-row[data-tkr],.dex-mover-card[data-tkr]"); if(!el)return;
        var a=byCode[el.getAttribute("data-tkr")]; if(!a)return;

        // THIS HANDLER WAS THE REASON "OPEN IN NEW TAB" DID NOT WORK, and it is ours, not the
        // design's. It ran on window-capture - the earliest phase there is - and unconditionally
        // preventDefault()ed every click on a row, so Ctrl/Cmd-click was swallowed exactly like a
        // plain one and always navigated in the current tab.
        //
        // A real link now sits in the first cell, so when the click is on that link the browser
        // already knows what to do: open in a new tab, a new window, or the same one.
        //
        // BUT GETTING OUT OF THE WAY IS NOT ENOUGH, which a test caught: a Ctrl+click on the link
        // still came back defaultPrevented with this handler doing nothing, because the DESIGN's own
        // router claims the click further down and cancels it - the same interception that made a
        // plain <a href> useless on the XRPL fork. So the router is removed from the picture with
        // stopImmediatePropagation, while the default is deliberately left intact.
        //
        // That covers the plain click too, and improves it: the browser follows the href to
        // /trade/stellar/<CODE>-<ISSUER>, which is server-rendered with the right asset, instead of
        // the router resolving to a route with no asset in it and landing on the default page.
        if(t.closest("a[href]")){ e.stopImmediatePropagation(); return; }

        // Anywhere ELSE on the row there is no link to inherit, so the intent is honoured directly.
        // window.open is permitted here because this is a genuine user gesture.
        if(e.metaKey||e.ctrlKey||e.shiftKey){
          e.preventDefault(); e.stopImmediatePropagation();
          try{ window.open(assetHref(a),"_blank","noopener"); }catch(_){}
          return;
        }
        e.preventDefault(); e.stopImmediatePropagation(); navTo(a);
      },true);

      // Middle-click does not fire "click" in every browser - it fires auxclick - so it is handled
      // separately rather than by testing e.button above, which would silently miss it.
      window.addEventListener("auxclick",function(e){ if(e.button!==1)return;
        var t=e.target; if(!t||!t.closest)return;
        if(t.closest("a[href]")) return;                        // the link already opens a new tab
        var el=t.closest(".dex-mk-action-btn[data-tkr],tr[data-tkr],.dex-mint-row[data-tkr],.dex-mover-card[data-tkr]"); if(!el)return;
        var a=byCode[el.getAttribute("data-tkr")]; if(!a)return;
        e.preventDefault(); e.stopImmediatePropagation();
        try{ window.open(assetHref(a),"_blank","noopener"); }catch(_){}
      },true);
    }
    // Market-mover tab clicks must re-render (the boot interval stops after ~21s, and a tab click alone
    // doesn't change #dexMoverGrid's children, so the childList observer wouldn't fire). Delegated so it
    // survives node replacement; a short + backup tick lets the design toggle .active first.
    if(!window.__lxDEXtab){ window.__lxDEXtab=1;
      document.addEventListener("click",function(e){ var t=e.target&&e.target.closest?e.target.closest(".dex-mover-tab,.mdx-mover-tab,.dex-mk-filter,.mdx-mk-filter"):null; if(t){ setTimeout(guardApply,30); setTimeout(guardApply,160); } });
    }
    guardEl("#dexMintsList",renderMints);
    guardEl("#dexMoverGrid",renderMovers);
    guardEl("#mdxMoverList",renderMovers);
  // ---- curated assets, live ------------------------------------------------------------------
  // The roster and the tick map are baked at build time because this page avoids runtime work. But
  // an asset curated in the admin panel then not appearing here reads as the add having failed, and
  // that has now been reported three times for assets that were curated correctly every time. One
  // cached request is cheaper than that.
  //
  // It ADDS; it never removes or repaints what is already on screen. The table renders progressively
  // anyway as prices arrive, so a late arrival is the pattern here rather than a flash. Once the site
  // is next published the same assets are baked in and this becomes a no-op.
  function curatedLive(){
    return fetch("/lxapi/assetmeta").then(function(r){ return r.ok?r.json():null; }).then(function(d){
      if(!d)return;
      var vf=d.verified||{}, added=[];
      // The tick first, and for every asset -- the map is keyed CODE-ISSUER here and CODE|ISSUER there.
      Object.keys(vf).forEach(function(id){ var r=vf[id]; if(!r||!r.v)return;
        var i=id.lastIndexOf("-"); if(i<0)return;
        VFD[id.slice(0,i)+"|"+id.slice(i+1)]=r.d||""; });
      (d.list||[]).forEach(function(id){
        var i=id.lastIndexOf("-"); if(i<0)return;
        var code=id.slice(0,i), iss=id.slice(i+1);
        if(byId[code+"|"+iss])return;                    // already baked in
        var tkr=byCode[code]?code+"~"+iss.slice(0,4):code;
        if(byCode[tkr])return;
        var a={code:code,issuer:iss,cat:"utility",tkr:tkr,b:"#3d4351",
          logo:"",domain:(vf[id]&&vf[id].d)||"",
          px:0,chg:null,vol:null,high:null,low:null,tvlUsd:null,
          holders:null,supply:null,spark:null,img:null,trades:null};
        byCode[tkr]=a; byId[code+"|"+iss]=a; ASSETS.push(a); added.push(a);
      });
      try{ renderTable(); }catch(_){}                    // ticks land even when nothing was added
      if(!added.length)return;
      // Logos through the same server-side resolver every other screen uses: plenty of toml hosts
      // refuse a browser outright, which is why this is not fetched from the issuer directly.
      added.forEach(function(a){
        fetch("/lxapi/assetlogo?v=2&asset="+encodeURIComponent(a.code+"-"+a.issuer))
          .then(function(r){ return r.ok?r.json():null; })
          .then(function(j){ if(j&&j.image){ a.logo=j.image; try{ renderTable(); }catch(_){} } })
          .catch(function(){});
      });
      return batchPx(added).then(function(){ try{ renderTable(); }catch(_){} });
    }).catch(function(){});
  }
    guardEl("#dexMkTbody",renderTable);
    loadData();
    try{ curatedLive(); }catch(_){}
    var ticks=0, iv=setInterval(function(){ guardApply(); if(++ticks>30)clearInterval(iv); },700);
  }
  if(document.readyState!=="loading")boot(); else document.addEventListener("DOMContentLoaded",boot);
})();