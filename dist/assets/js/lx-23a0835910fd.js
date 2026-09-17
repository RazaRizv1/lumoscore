(function(){
  var H="https://horizon.stellar.org";
  var CG="https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd";
  var DASH=String.fromCharCode(8212), MID=String.fromCharCode(183), ARROW=String.fromCharCode(8594);
  function q(s,r){ return (r||document).querySelector(s); }
  function qa(s,r){ return [].slice.call((r||document).querySelectorAll(s)); }
  function recs(d){ return (d&&d._embedded&&d._embedded.records)||[]; }
  function fetchJ(u){ return fetch(u).then(function(r){ if(!r.ok)throw new Error(r.status); return r.json(); }); }
  function j(u){ return fetchJ(u).catch(function(e){
    if(u.indexOf("horizon.stellar.org")>=0)return fetchJ(u.replace("horizon.stellar.org","horizon.stellar.lobstr.co"));
    throw e; }); }
  function esc(s){return (String(s==null?"":s).split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;").split('"').join("&quot;")).split(String.fromCharCode(39)).join("&#39;");}

  // ---- address: /account/stellar/<G...> or ?address= ------------------------------------------------
  function readAddr(){
    var a="";
    try{ a=new URLSearchParams(location.search).get("address")||new URLSearchParams(location.search).get("addr")||""; }catch(_){}
    if(!a){ var parts=location.pathname.split("/"); var last=parts[parts.length-1]||parts[parts.length-2]||"";
      if(last.length===56&&last.charAt(0)==="G")a=last; }
    a=(a||"").trim();
    // G only. A C id is a Soroban contract: Horizon serves it no balances, trustlines or history,
    // so there is no page to build -- see the message below rather than an empty shell.
    return (a.length===56&&a.charAt(0)==="G")?a:"";
  }
  var ADDR=readAddr();
  // not a page, just an explanation: readAddr rejects C ids, so ADDR is empty for one
  var PASTED_CONTRACT=(function(){ var raw="";
    try{ raw=new URLSearchParams(location.search).get("address")||""; }catch(_){}
    if(!raw){ var pp=location.pathname.split("/"); raw=pp[pp.length-1]||""; }
    raw=(raw||"").trim(); return raw.length===56&&raw.charAt(0)==="C"; })();

  // ---- formatting ---------------------------------------------------------------------------------
  var SUBD=String.fromCharCode(8320,8321,8322,8323,8324,8325,8326,8327,8328,8329);
  function zsub(n){ var s=String(n),o=""; for(var i=0;i<s.length;i++)o+=SUBD.charAt(+s.charAt(i)); return o; }
  function trimZ(t){ while(t.length>1&&t.charAt(t.length-1)==="0")t=t.slice(0,-1);
    if(t.charAt(t.length-1)===".")t=t.slice(0,-1); return t; }
  // Same rule as the Trade pages: plain decimal to 1e-8, then the zeros collapse into a subscript count.
  function smallNum(x,sig){ x=+x||0; if(!(x>0))return "0";
    if(x>=1e-8)return trimZ(x.toFixed(8));
    var e=x.toExponential((sig||4)-1), i=e.indexOf("e");
    if(i<0)return String(x);
    var mant=trimZ(e.slice(0,i)).split(".").join(""), ex=-parseInt(e.slice(i+1),10);
    if(!(ex>1))return trimZ(x.toFixed(8));
    return "0.0"+zsub(ex-1)+mant; }
  function amt(n){ n=+n||0; if(n>=1e9)return (n/1e9).toFixed(2)+"B"; if(n>=1e6)return (n/1e6).toFixed(2)+"M";
    if(n>=1000)return Math.round(n).toLocaleString("en-US"); if(n>=1)return trimZ(n.toFixed(4)); if(n>0)return smallNum(n,4); return "0"; }
  function usd(n){ n=+n||0; var a=Math.abs(n);
    if(a>=1e9)return "$"+(n/1e9).toFixed(2)+"B"; if(a>=1e6)return "$"+(n/1e6).toFixed(2)+"M";
    if(a>=1000)return "$"+n.toLocaleString("en-US",{maximumFractionDigits:0});
    if(a>=1)return "$"+n.toFixed(2);
    if(a>=0.01)return "$"+n.toFixed(4);          // cents matter; hundred-millionths of a cent do not
    if(a>0)return "$"+smallNum(n,4); return "$0"; }
  function shortG(a){ a=String(a||""); return a.length>12?(a.slice(0,4)+DASH+a.slice(-4)):a; }
  function ago(t){ var s=Math.max(0,(Date.now()-t)/1000);
    if(s<60)return Math.floor(s)+"s ago"; if(s<3600)return Math.floor(s/60)+"m ago";
    if(s<86400)return Math.floor(s/3600)+"h ago"; if(s<2592000)return Math.floor(s/86400)+"d ago";
    return new Date(t).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); }

  // ---- identicon: deterministic from the address, so the same wallet always wears the same face ----
  function hashOf(s){ var h=2166136261; for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=(h*16777619)>>>0; } return h>>>0; }
  function identicon(addr){
    var h=hashOf(addr), hue=h%360, hue2=(hue+52)%360, cells="";
    for(var x=0;x<3;x++)for(var y=0;y<5;y++){
      var bit=(hashOf(addr+":"+x+":"+y)>>>3)&1; if(!bit)continue;
      cells+='<rect x="'+(x*8)+'" y="'+(y*8)+'" width="8" height="8"/>';
      if(x<2)cells+='<rect x="'+((4-x)*8)+'" y="'+(y*8)+'" width="8" height="8"/>';
    }
    var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">'
      +'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
      +'<stop offset="0%" stop-color="hsl('+hue+',62%,52%)"/><stop offset="100%" stop-color="hsl('+hue2+',60%,38%)"/>'
      +'</linearGradient></defs><rect width="40" height="40" fill="url(#g)"/>'
      +'<g fill="rgba(255,255,255,.92)">'+cells+'</g></svg>';
    return "data:image/svg+xml;base64,"+btoa(svg);
  }

  // ---- logos: brand map, then the asset toml, then an initials disc ---------------------------------
  var STELLAR_URI="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDMyIDMyIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNiIgZmlsbD0iIzAwMCIvPjxwYXRoIGQ9Ik0yMy4xMyA5LjI5MmwtMi40IDEuMjI0LTExLjU5OCA1LjkwN0E2LjkwOSA2LjkwOSAwIDAxMTkuMzUgOS40OThsMS4zNzQtLjcuMjA1LS4xMDVhOC40MzkgOC40MzkgMCAwMC0xMy4zNzEgNy40NzIgMS41MzUgMS41MzUgMCAwMS0uODM0IDEuNDg0bC0uNzI1LjM3djEuNzI0bDIuMTM0LTEuMDg4LjY5MS0uMzUzLjY4MS0uMzQ3IDEyLjIyNi02LjIzIDEuMzc0LS42OTkgMi44NC0xLjQ0N1Y3Ljg1NnptMi44MTYgMi4wMTJMMTAuMjAxIDE5LjMybC0xLjM3NC43TDYgMjEuNDYzdjEuNzIzbDIuODA4LTEuNDMgMi40MDEtMS4yMjQgMTEuNjEtNS45MTZhNi45MDkgNi45MDkgMCAwMS0xMC4yMjkgNi45M2wtLjA4NS4wNDUtMS40OS43NmE4LjQzOSA4LjQzOSAwIDAwMTMuMzcyLTcuNDc1IDEuNTM2IDEuNTM2IDAgMDEuODMzLTEuNDgzbC43MjYtLjM3di0xLjcxOHoiIGZpbGw9IiNGRkYiLz48L3N2Zz4=";
  var LOGOS={USDC:"https://assets.coingecko.com/coins/images/6319/small/usdc.png",
    EURC:"https://assets.coingecko.com/coins/images/26045/small/euro.png",
    AQUA:"https://aqua.network/assets/img/aqua-logo.png",
    yXLM:"https://assets.coingecko.com/coins/images/100/small/fmpFRHHQ_400x400.jpg",
    BTC:"https://assets.coingecko.com/coins/images/1/small/bitcoin.png"};
  var LOGO_ISS={USDC:"GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    EURC:"GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2",
    AQUA:"GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
    yXLM:"GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55",
    BTC:"GAUTUYY2THLF7SGITDFMXJVYH3LHDSMGEAKSBU267M2K7A3W543CKUEF"};
  var LUMOS_ISS="GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S";
  var LUMOS_LOGO="/assets/tokens/lumos.png";
  var IMG={}, DOM={}, TRIED={};
  // the same verified pairs the rest of the site vouches for -- code|issuer, never code alone
  var VFD={"XLM|":"stellar.org","USDC|GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN":"circle.com","EURC|GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2":"circle.com","yXLM|GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55":"ultracapital.xyz","yUSDC|GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF":"ultracapital.xyz","SHX|GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEKEBR7UCHEUUEK72N7I7KJ6JH":"stronghold.co","LUMOS|GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S":"lumosdao.io","AQUA|GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA":"aqua.network","TDT|GBINRJAGLT2WN6DK2I47QKMKEJW56ASPO6K2GQPCLY7ZO7TAQMKUBPOG":"lumoscore.com","XRP|GBXRPL45NPHCVMFFAYZVUVFFVKSIZ362ZXFP7I2ETNQ3QKZMFLPRDTD5":"fchain.io","SCOP|GC6OYQJIZF3HFXCYPFCBXYXNGIBQ4TNSFUBUXQJOZWIP6F3YZK4QH3VQ":"scopuly.com","MTL|GACKTN5DAZGWXRWB2WLM6OPBDHAMT6SJNGLJZPQMEZBUR4JUGBX2UK7V":"mtl.montelibero.org","EURMTL|GACKTN5DAZGWXRWB2WLM6OPBDHAMT6SJNGLJZPQMEZBUR4JUGBX2UK7V":"mtl.montelibero.org","ZARZ|GAROH4EV3WVVTRQKEY43GZK3XSRBEYETRVZ7SVG5LHWOAANSMCTJBB3U":"zeam.money","USDZ|GAKTLPC4ZV37SSCITQ5IS5AQ4WPF4CF4VZJQPPAROSGXMYOATF5U6XPR":"zeam.money","CLPX|GDYSPBVZHPQTYMGSYNOHRZQNLB3ZWFVQ2F7EP7YBOLRGD42XIC3QUX5G":"clpx.finance","yBTC|GBUVRNH4RW4VLHP4C5MOF46RRIRZLAVHYGX45MVSTKA2F6TMR7E7L6NW":"ultracapital.xyz","yETH|GDYQNEF2UWTK4L6HITMT53MZ6F5QWO3Q4UVE6SCGC4OMEQIZQQDERQFD":"ultracapital.xyz","ARS|GCYE7C77EB5AWAA25R5XMWNI2EDOKTTFTTPZKM2SR5DI4B4WFD52DARS":"api.anclap.com","PEN|GA4TDPNUCZPTOHB3TKUYMDCRVATXKEADH7ZEYEBWJKQKE2UBFCYNBPEN":"api.anclap.com","ETH|GBFXOHVAS43OIWNIO7XLRJAHT3BICFEIKOJLZVXNT572MISM4CMGSOCC":"ultracapital.xyz","BTCLN|GDPKQ2TSNJOFSEE7XSUXPWRP27H6GFGLWD7JCHNEYYWQVGFA543EVBVT":"kbtrading.org","USDM|GDHDC4GBNPMENZAOBB4NCQ25TGZPDRK6ZGWUGSI22TVFATOLRPSUUSDM":"mtl.montelibero.org","CETES|GCRYUGD5NVARGXT56XEZI5CIFCQETYHAPQQTHO2O3IQZTHDH4LATMYWC":"etherfuse.com","USTRY|GCRYUGD5NVARGXT56XEZI5CIFCQETYHAPQQTHO2O3IQZTHDH4LATMYWC":"etherfuse.com","SSLX|GBHFGY3ZNEJWLNO4LBUKLYOCEK4V7ENEBJGPRHHX7JU47GWHBREH37UR":"sslx.sl8.online","AFR|GBX6YI45VU7WNAAKA3RBFDR3I3UKNFHTJPQ5F6KOOKSGYIAM4TRQN54W":"afreum.com","TFT|GBOVQKJYHXRR3DX6NOX2RRYFRCUMSADGDESTDNBDS6CDVLGVESRTAC47":"threefold.io","GOLD|GBC5ZGK6MQU3XG5Y72SXPA7P5R5NHYT2475SNEJB2U3EQ6J56QLVGOLD":"mintx.co","USDY|GAJMPX5NBOG6TQFPQGRABJEEB2YE7RFRLUKJDZAZGAD5GFX4J7TADAZ6":"ondo.finance","FRED|GCA73U2PZFWAXJSNVMEVPNPPJCZGETWPWZC6E4DJAIWP3ZW3BAGYZLV6":"fredenergy.org","PYBC|GBVB43NLVIP2USHXSKI7QQCZKZU2Z6U6A5PAHMIW7LLNVMQJTOX2BZI5":"luxpayband.io","BLND|GDJEHTBE6ZHUXSWFI642DCGLUOECLHPF3KSXHPXTSTJ7E3JF6MQ5EZYY":"","KALE|GBDVX4VELCDSQ54KQJYTNHXAHFLBCA77ZY2USQBM4CSHTTV7DME7KALE":"kalepail.com","XXA|GC4HS4CQCZULIOTGLLPGRAAMSBDLFRR6Y7HCUQG66LNQDISXKIXXADIM":"ixinium.io","XTAR|GAORYJ3KBDGIM7FFSKVUJHJ5NEFWIRDIAGGBJBJS7TY6ECZS53257IG4":"dogstarcoin.com","xLMNR|GDKA6WVMFSA73BMEVKPO6WXSSWP4MPRBDJVSXLLSEVIEVH226L5RJ7NL":"thelumenaire.com","ARST|GCSAZVWXZKWS4XS223M5F54H2B6XPIIXZZGP7KEAIU6YSL5HDRGCI3DG":"pubnet-sep.latamex.com"};

  // What WE show as an asset home domain where the on-chain value is stale (LUMOS still declares the
  // pre-rename lumosdao.io). Display only -- never the toml fetch, which 404s on the new domain.
  var DDOM={"LUMOS|GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S":"lumoscore.com"};
  function dispDom(c,i,d){ return DDOM[(c||"")+"|"+(i||"")]||d||""; }
  var VTICK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  function vtick(c,i){ return VFD[c+"|"+i]!==undefined?('<span class="lx-vtick" title="Verified issuer">'+VTICK+'</span>'):""; }
  // The baked map is a snapshot; what LumosCore vouches for changes without a build. Shares
  // window.__lxCuratedV with search, Trade and the wallet, so a page that has already asked does not
  // ask twice. Only ever ADDS -- a baked pair was checked by hand and a fetch should not revoke it.
  function lxAccMergeV(){
    window.__lxCuratedV=window.__lxCuratedV||fetch("/lxapi/assetmeta").then(function(r){ return r.ok?r.json():null; })
      .then(function(d){ return (d&&d.verified)||{}; }).catch(function(){ return {}; });
    window.__lxCuratedV.then(function(vf){ var added=0;
      Object.keys(vf).forEach(function(id){ var r=vf[id]; if(!r||!r.v)return;
        var p=id.lastIndexOf("-"); if(p<0)return;
        var k=id.slice(0,p)+"|"+id.slice(p+1);
        if(VFD[k]===undefined){ VFD[k]=r.d||""; added++; } });
      if(added)lxAccPaintV(); }).catch(function(){});
  }
  function lxAccPaintV(){ try{
    var ns=document.querySelectorAll(".acc-pair");
    for(var i=0;i<ns.length;i++){ var pr=ns[i];
      var ic=pr.querySelector(".acc-ico[data-lxc]"); if(!ic)continue;
      var c=ic.getAttribute("data-lxc")||"", is=ic.getAttribute("data-lxi")||"";
      if(!c||VFD[c+"|"+is]===undefined)continue;
      if(pr.querySelector(".lx-vtick"))continue;
      var cd=pr.querySelector(".acc-code"); if(!cd||!cd.parentNode)continue;
      var sp=document.createElement("span"); sp.className="lx-vtick";
      sp.setAttribute("title","Verified issuer"); sp.innerHTML=VTICK;
      if(cd.nextSibling)cd.parentNode.insertBefore(sp,cd.nextSibling); else cd.parentNode.appendChild(sp);
    }
  }catch(_e){} }
  lxAccMergeV();
  function key(c,i){ return c+"-"+(i||""); }
  function brand(c,i){ if(c==="LUMOS"&&i===LUMOS_ISS)return LUMOS_LOGO;
    var u=LOGOS[c]; if(!u)return ""; return (LOGO_ISS[c]&&i===LOGO_ISS[c])?u:""; }
  function initials(c){ var s=String(c||"?"), hue=hashOf(s)%360;
    var t=s.replace(/[^A-Za-z0-9]/g,"").slice(0,2).toUpperCase()||"?";
    var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="hsl('+hue+',55%,45%)"/>'
      +'<text x="20" y="'+(t.length>1?26:27)+'" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="'+(t.length>1?15:20)+'" fill="#fff">'+t+'</text></svg>';
    return "data:image/svg+xml;base64,"+btoa(svg); }
  function logoOf(c,i){ if(c==="XLM")return STELLAR_URI;
    return brand(c,i)||IMG[key(c,i)]||initials(c); }
  function paintDoms(){ qa("#accAssetsTbl tbody tr.acc-row").forEach(function(tr){
    var c=tr.getAttribute("data-code"), i=tr.getAttribute("data-iss")||"";
    if(!c||c==="XLM"||!i)return;
    var el=tr.querySelector(".acc-iss"); if(!el)return;
    var _d=dispDom(c,i,DOM[key(c,i)]||"");
    var t=shortG(i);
    if(el.textContent!==t)el.textContent=t; }); }
  var LXAQ={};
  // brand() is a hardcoded map and IMG a third-party index, so neither can ever hold a logo an admin
  // uploaded here -- which is why BLND showed its mark on Trade and none in this list.
  function lxAccLogo(c,i){ var k=key(c,i); if(LXAQ[k]!==undefined)return; LXAQ[k]=null;
    fetch("/lxapi/assetlogo?v=2&asset="+encodeURIComponent(c+"-"+i))
      .then(function(r){ return r.ok?r.json():null; })
      .then(function(j){ var u=j&&j.image; if(u){ IMG[k]=u; try{ paintLogos(); }catch(_){} } })
      .catch(function(){}); }
  function paintLogos(){ qa(".acc-ico[data-lxc]").forEach(function(el){
    var c=el.getAttribute("data-lxc"), i=el.getAttribute("data-lxi")||"";
    el.style.backgroundImage="url("+logoOf(c,i)+")";
    // Guarded on IMG being filled, so the repaint above cannot loop back into another request.
    if(c&&c!=="XLM"&&i&&!brand(c,i)&&!IMG[key(c,i)])lxAccLogo(c,i); }); }
  // Same two-source chain the pools tab uses: the issuer-scoped index, then the issuer's own toml.
  function tomlField(block,k){ var lines=block.split(String.fromCharCode(10));
    for(var i=0;i<lines.length;i++){ var ln=lines[i].trim(), eq=ln.indexOf("=");
      if(eq<0)continue; if(ln.slice(0,eq).trim()!==k)continue;
      var v=ln.slice(eq+1).trim();
      if(v.charAt(0)==='"'){ var e=v.indexOf('"',1); v=e>0?v.slice(1,e):v.slice(1); }
      return v; }
    return ""; }
  function fetchLogo(c,i){ if(!c||c==="XLM"||!i)return;
    if((brand(c,i)||IMG[key(c,i)])&&DOM[key(c,i)])return;   // logo AND domain known -> nothing to fetch
    if(TRIED[key(c,i)])return; TRIED[key(c,i)]=1;
    fetchJ("https://api.stellar.expert/explorer/public/asset?search="+encodeURIComponent(i)+"&limit=50").then(function(d){
      var m=recs(d).filter(function(r){ return (r.asset||"").indexOf(c+"-"+i)===0; })[0];
      var ti=(m&&(m.tomlInfo||m.toml_info))||{};
      // N2: repaint the ONE line that changed, not the table.
      //
      // This called renderAssets(), which rewrites the tbody wholesale -- so every icon in the table was
      // destroyed and rebuilt. With eight assets each resolving its domain at a different moment that
      // happened eight times over a few seconds, and the logos visibly churned before settling. Nothing
      // about a domain arriving changes the ORDER (assets sort by value), so there is nothing to
      // re-render: the issuer line is the only thing that differs. paintLogos already worked this way
      // for images; this is the same treatment for domains.
      if(m&&m.domain){ DOM[key(c,i)]=m.domain; try{ paintDoms(); }catch(_){} }
      if(ti.image){ IMG[key(c,i)]=ti.image; paintLogos(); return; }
      return j(H+"/accounts/"+i).then(function(acc){
        var dom=(acc&&acc.home_domain)||""; if(!dom)return;
        for(var k2=0;k2<dom.length;k2++){ var ch=dom.charAt(k2);
          if(!((ch>="a"&&ch<="z")||(ch>="A"&&ch<="Z")||(ch>="0"&&ch<="9")||ch==="."||ch==="-"))return; }
        return fetch("https://"+dom+"/.well-known/stellar.toml").then(function(r){ return r.text(); }).then(function(txt){
          var bl=txt.split("[[CURRENCIES]]");
          for(var b=1;b<bl.length;b++){ if(tomlField(bl[b],"code")!==c)continue;
            var bi=tomlField(bl[b],"issuer"); if(bi&&bi!==i)continue;
            var im=tomlField(bl[b],"image"); if(im){ IMG[key(c,i)]=im; paintLogos(); } return; } }); });
    }).catch(function(){}); }

  // ---- state --------------------------------------------------------------------------------------
  var xlmUsd=(function(){ try{ var c=JSON.parse(localStorage.getItem("lumos.xlmUsd")||"null");
    return (c&&+c.v>0&&(Date.now()-c.ts<216e5))?+c.v:0; }catch(e){ return 0; } })();
  var ASSETS=[], POOLS=[], ACTS=[], XLM=0, ACCT=null, DONE={};
  var PER=25, aShown=PER, pShown=PER, PRICE_CAP=75;
  // #6: the portfolio total is a SUM over lookups that land one at a time, and every one of them used
  // to repaint it -- so the figure climbed while you watched, and where it stopped depended on which
  // requests happened to come back. Refresh, and Horizon throttles a different two, and the "value" of
  // the same wallet is a different number. A total assembled in public is not a total.
  //
  // PXWAVE: have we even reached the point of asking? PXPEND: how many answers are still out. The
  // figure is written once, when both say the counting is over.
  var PXWAVE=0, PXPEND=0;
  function pxStart(){ PXPEND++; }
  // Write a single row's Value cell without touching the tbody's order. The row is found by the
  // code+issuer it was stamped with, so this cannot land on the wrong asset when two share a ticker.
  function fillAssetValue(a){
    try{
      var tb=q("#accAssetsTbl"); if(!tb||!a)return;
      var rows=tb.querySelectorAll("tbody tr.acc-row");
      for(var i=0;i<rows.length;i++){
        var r=rows[i];
        if(r.getAttribute("data-code")!==a.code)continue;
        if((r.getAttribute("data-iss")||"")!==(a.issuer||""))continue;
        var td=r.children[2]; if(!td)return;
        var v=(a.usd!=null&&xlmUsd>0)?usd(a.usd):DASH;
        if(td.textContent!==v)td.textContent=v;
        return;
      }
    }catch(_){}
  }
  // The sorted rebuild happens HERE, once, when nothing is still in flight -- so the reader sees the list
  // settle exactly once instead of watching it reshuffle on every arrival.
  function pxEnd(){ if(PXPEND>0)PXPEND--; if(PXPEND===0){ try{ renderStats(); renderAssets(); }catch(_){} } }
  var PIN={XLM:0, USDC:1, LUMOS:2};
  // Pinned three first, then by value. An unpriced row sorts after every priced one: we do not know
  // what it is worth, and ranking it as zero would be a claim we cannot make.
  function sortAssets(list){
    return list.slice().sort(function(x,y){
      var px=(PIN[x.code]!=null&&(x.native||x.code!=="XLM"))?PIN[x.code]:99;
      var py=(PIN[y.code]!=null&&(y.native||y.code!=="XLM"))?PIN[y.code]:99;
      if(px!==py)return px-py;
      var vx=(x.usd==null)?-1:x.usd, vy=(y.usd==null)?-1:y.usd;
      if(vx!==vy)return vy-vx;
      return String(x.code).localeCompare(String(y.code));
    });
  }
  function moreHTML(kind,shown,total){ if(total<=shown)return "";
    var next=Math.min(PER,total-shown);
    return '<div class="acc-more"><button class="acc-more-b" data-more="'+kind+'">Load '+next
      +' more<span class="acc-more-n">'+shown+' of '+total+' shown</span></button></div>'; }
  // A pager only earns its space when there is more than one page.

  function setStat(k,v,s){ var el=q('.acc-stat .v[data-k="'+k+'"]'); if(el&&el.textContent!==v)el.textContent=v;
    var sl=q('.acc-stat .s[data-s="'+k+'"]'); if(sl&&s!=null&&sl.textContent!==s)sl.textContent=s; }

  function totalValue(){ var t=XLM*xlmUsd;
    ASSETS.forEach(function(a){ if(a.usd)t+=a.usd; });
    POOLS.forEach(function(p){ if(p.usd)t+=p.usd; });
    return t; }
  // how much of the account this total actually covers
  function priced(){ var n=1, m=1+ASSETS.length+POOLS.length;
    ASSETS.forEach(function(a){ if(a.usd!=null)n++; });
    POOLS.forEach(function(p){ if(p.usd!=null)n++; });
    return {n:n,m:m}; }

  // The shimmer that stands in for the total while it is being worked out. A class on the element
  // rather than text, so nothing has to be cleared out of the number slot afterwards.
  function markCounting(on){
    try{ var el=q('.acc-stat .v[data-k="total"]'); if(el)el.classList.toggle("lx-counting",!!on); }catch(_){}
  }
  function renderStats(){
    var tv=totalValue();
    var pc=priced();
    // Counting = we have not asked yet, or answers are still out. Either way the sum on hand is a
    // partial one and must not be shown as the account's value.
    var counting=(!PXWAVE||PXPEND>0);
    if(counting){ setStat("total", "", "valuing this account"); markCounting(true); }
    else if(xlmUsd<=0){ markCounting(false); setStat("total", DASH, "waiting for XLM price"); }
    else {
      // Some holdings have no market to price them against, and no amount of waiting fixes that. The
      // total is then a floor and says so, rather than passing itself off as the whole account.
      // #9: this card used to carry the same figure three ways -- a >= sign, the dollar total, the XLM
      // equivalent, and a sentence about how many holdings had no market. Accurate, and far too much
      // for a summary tile: two lines of small print under a number the reader wanted at a glance.
      markCounting(false);
      // "Estimated value" says the one thing that qualification was for. The exact XLM amount and the
      // per-asset detail are both a scroll away in the holdings table below.
      setStat("total", usd(tv), "Estimated value");
    }
    setStat("xlm", amt(XLM)+" XLM", xlmUsd>0?usd(XLM*xlmUsd):"");
    // count what the Assets table shows -- XLM plus every funded trustline -- so the two agree
    setStat("assets", String(ASSETS.length+1), ASSETS.length===1?"1 trustline held":(ASSETS.length+" trustlines held"));
    setStat("pools", String(POOLS.length), POOLS.length?"providing liquidity":"none");
  }

  // ---- assets -------------------------------------------------------------------------------------
  // The button lives after the table inside the same card, so re-rendering the table never destroys it.
  function setMore(tblSel,kind,shown,total){
    var tbl=q(tblSel); if(!tbl)return;
    var card=tbl.closest(".acc-pane")||tbl.closest(".acc-card"); if(!card)return;
    var host=card.querySelector(".acc-more-host");
    if(!host){ host=document.createElement("div"); host.className="acc-more-host"; card.appendChild(host); }
    var html=moreHTML(kind,shown,total);
    if(host.__h!==html){ host.innerHTML=html; host.__h=html; }
    if(!host.__w){ host.__w=1;
      host.addEventListener("click",function(e){
        var b=e.target&&e.target.closest?e.target.closest("[data-more]"):null; if(!b)return;
        e.preventDefault(); e.stopPropagation();
        if(kind==="assets"){ aShown+=PER; renderAssets(); } else { pShown+=PER; renderPools(); }
      },true); }
  }
  function renderAssets(){
    var tb=q("#accAssetsTbl tbody"); if(!tb)return;
    var n=q("#accAssetsN"); if(n)n.textContent=String(ASSETS.length+1);
    var all=sortAssets([{code:"XLM",issuer:"",dom:"Stellar",bal:XLM,px:1,usd:XLM*xlmUsd,native:true}].concat(ASSETS));
    var rows=all.slice(0,Math.min(aShown,all.length));
    var tot=totalValue();
    // whatever is on screen gets priced and gets a logo, cap or no cap
    // Two jobs, two guards. __px used to gate BOTH pricing and logo/domain lookup, and the boot pricing
    // wave claims __px without ever calling fetchLogo -- so whichever ran first decided whether the asset
    // ever got a logo. That race is why some wallets showed initials and a bare issuer and others did not.
    // fetchLogo carries its own TRIED guard, so calling it on every visible row costs nothing extra.
    rows.forEach(function(a){ if(a.native)return;
      fetchLogo(a.code,a.issuer);
      if(!a.__px){ a.__px=1; loadAssetPx(a); } });
    tb.innerHTML=rows.map(function(a){
      // The home domain is dropped here: it and the issuer were competing for one narrow cell, and the
      // row opens Trade-Asset, which states the domain properly. The issuer is the thing that actually
      // identifies the asset -- a ticker plus a domain is not unique, a ticker plus an issuer is.
      var sub = a.native ? "Native asset" : shortG(a.issuer);
      return '<tr class="acc-row" data-code="'+esc(a.code)+'" data-iss="'+esc(a.issuer||"")+'">'
        +'<td><span class="acc-pair"><span class="acc-ico" data-lxc="'+esc(a.code)+'" data-lxi="'+esc(a.issuer||"")+'"></span>'
          +'<span><span class="acc-code">'+esc(a.code)+'</span>'+vtick(a.code,a.issuer||"")
          +'<span class="acc-iss">'+esc(sub)+'</span></span></span></td>'
        +'<td class="num">'+amt(a.bal)+'</td>'
        +'<td class="num">'+(a.usd!=null&&xlmUsd>0?usd(a.usd):DASH)+'</td>'
        +'</tr>'; }).join("");
    setMore("#accAssetsTbl","assets",rows.length,all.length);
    paintLogos();
    qa("#accAssetsTbl tbody tr.acc-row").forEach(function(tr){
      var c=tr.getAttribute("data-code"), i=tr.getAttribute("data-iss");
      // XLM has no Trade-Asset page -- /trade/stellar/XLM is a 404 -- so that row cannot go anywhere. It still wore the
      // pointer cursor the others wear, promising a page that does not exist. Every issued asset does open its page.
      if(!(c&&c!=="XLM"&&i)){ tr.style.cursor="default"; return; }
      tr.addEventListener("click",function(){ location.href="/trade/stellar/"+c+"-"+i; });
    });
  }

  // ---- pools --------------------------------------------------------------------------------------
  var poolsOpened=false;
  function wireTabs(){
    var bar=q("#accTabs"); if(!bar||bar.__w)return; bar.__w=1;
    bar.addEventListener("click",function(e){
      var b=e.target&&e.target.closest?e.target.closest(".acc-tab[data-t]"):null; if(!b)return;
      var t=b.getAttribute("data-t");
      qa(".acc-tab",bar).forEach(function(x){ x.classList.toggle("active",x===b); });
      qa(".acc-pane").forEach(function(pn){ pn.hidden=(pn.getAttribute("data-p")!==t); });
      if(t==="pools"&&!poolsOpened){ poolsOpened=true; renderPools(); }
    });
  }
  function renderPools(){
    var tb=q("#accPoolsTbl tbody"); if(!tb)return;
    var n0=q("#accPoolsN"); if(n0)n0.textContent=String(POOLS.length);
    if(!poolsOpened)return;                       // deferred until the tab is actually opened
    var n=q("#accPoolsN"); if(n)n.textContent=String(POOLS.length);
    if(!POOLS.length){ tb.innerHTML='<tr class="acc-empty-row"><td colspan="5"><div class="acc-empty">'
      +(DONE.pools?"This account provides no pool liquidity.":"Loading pools"+String.fromCharCode(8230))+'</div></td></tr>'; return; }
    // #4: ONE reorder, at the end -- not one per pool that finishes loading.
    //
    // Every position is valued by its own fetch, and this sorted on value every time the table was
    // repainted. With 392 positions that is hundreds of repaints, each putting the rows in a different
    // order as more values arrived, so the list visibly reshuffled for several seconds before settling.
    // Measured: the top three rows were completely different at 0.9s, 1.9s, 2.9s and 3.9s.
    //
    // So the order is held in ARRIVAL order -- which is what the reader is already looking at -- until
    // every row on screen has a value, and only then sorted, once. The deadline is there because a pool
    // whose fetch never returns must not freeze the order for ever; after it, we sort with what we have.
    if(!POOLS.__lxOrdered){
      var _vis=POOLS.slice(0,Math.min(pShown,POOLS.length));
      if(POOLS.__lxT0==null)POOLS.__lxT0=Date.now();
      var _ready=_vis.length>0&&_vis.every(function(p){ return p.usd!=null||p.__ldDone; });
      if(_ready||(Date.now()-POOLS.__lxT0)>8000)POOLS.__lxOrdered=1;
    }
    // biggest position first, unvalued last -- same rule as the assets table
    var psorted=POOLS.__lxOrdered
      ? POOLS.slice().sort(function(x,y){ var vx=(x.usd==null)?-1:x.usd, vy=(y.usd==null)?-1:y.usd; return vy-vx; })
      : POOLS.slice();
    var plist=psorted.slice(0,Math.min(pShown,psorted.length));
    plist.forEach(function(p){ if(!p.__ld){ p.__ld=1; loadPool(p); } });
    tb.innerHTML=plist.map(function(p){
      // #20: a row is only worth drawing once its pair is known.
      //
      // Every position is rendered the moment the list arrives, but the pair codes and the share come
      // from a per-pool fetch that lands later -- and each one that lands re-renders the whole table. On
      // an account with 141 positions that is 141 repaints, so the visible rows read "? / ?" at
      // "<0.01%" and then churn for several seconds. The percentage was the worst of it: 0 formatted as
      // "<0.01%" is a real-looking number for a position that might be 67% of the pool.
      //
      // Unknown rows now hold a placeholder of the same height, so nothing moves as they fill in.
      var known=!!(p.a&&p.a!=="?"&&p.b&&p.b!=="?");
      var _w=known?"":" acc-ico-wait";
        return '<tr class="acc-row" data-pool="'+esc(p.id)+'">'
        +'<td><span class="acc-pair"><span class="acc-icos">'
          +'<span class="acc-ico'+_w+'" data-lxc="'+(known?esc(p.a):"")+'" data-lxi="'+esc(p.ai||"")+'"></span>'
          +'<span class="acc-ico'+_w+'" data-lxc="'+(known?esc(p.b):"")+'" data-lxi="'+esc(p.bi||"")+'"></span></span>'
          +'<span><span class="acc-code">'+(known?(esc(p.a)+" / "+esc(p.b)):'<i class="acc-sk" style="width:86px"></i>')+'</span>'
          +'<span class="acc-dom">'+(p.tl!=null?(p.tl+(p.tl===1?" LP holder":" LP holders")):"")+'</span></span></span></td>'
        +'<td class="num">'+(known?((p.share>=0.01?p.share.toFixed(2):"<0.01")+'%'):'<i class="acc-sk" style="width:42px"></i>')+'</td>'
        +'<td class="num">'+(p.usd!=null&&xlmUsd>0?usd(p.usd):DASH)+'</td>'
        +'<td class="num acc-hide-sm">'+(p.tvl!=null&&xlmUsd>0?usd(p.tvl):DASH)+'</td>'
        +'</tr>'; }).join("");
    setMore("#accPoolsTbl","pools",plist.length,psorted.length);
    paintLogos();
    qa("#accPoolsTbl tbody tr.acc-row").forEach(function(tr){ tr.addEventListener("click",function(){
      var id=tr.getAttribute("data-pool"); if(id)location.href="/pools/stellar/id/"+id; }); });
  }

  // ---- activity -----------------------------------------------------------------------------------
  // The wallet's own activity icons, so the two pages draw the same marks.
  var WIC={
    received:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>',
    sent:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    swap:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10l-3 3 3 3M4 13h11M17 14l3-3-3-3M20 11H9"/></svg>',
    lp:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>',
    order:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    claim:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>',
    settings:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    other:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>'
  };
  // The asset's own mark, inline in the title -- the wallet's .lx-act-ilogo, same construction.
  // N12: the activity rows read "SwapyXLM" and "Added trustlineUSDC", because this returns an EMPTY
  // STRING when it has no logo and the callers put the space INSIDE that string. Whenever the mark was
  // missing -- which on a public account page is most rows -- the space went with it. accAsset below
  // owns the spacing so it is there either way.
  //
  // And it looked in one place, window.__lxLogos, which is populated by the POOLS layer and is close to
  // empty here. The assets table on this very page resolves logos through brand()/IMG, so the activity
  // rows now read the same two sources -- which is why they were showing XLM's mark and nothing else.
  function accIlogo(code,native){
    var lg=native?STELLAR_URI:(brand(code,"")||"");
    if(!lg&&!native){
      var kk=null;
      // IMG is keyed by key(code,issuer) = code+"-"+issuer, and an activity row knows the code but not
      // always the issuer, so match on the code segment. Safe against prefixes: "USDC-G..." does not
      // start with "USD-".
      try{ for(var k2 in IMG){ if(k2.indexOf(code+"-")===0){ kk=IMG[k2]; break; } } }catch(_){}
      lg=kk||((window.__lxLogos||{})[code]||"");
    }
    var bg=lg?("url('"+String(lg).replace(/'/g,"%27")+"')"):"none";
    // No logo, no mark. The initial-letter fallback put a stray "Y"/"E"/"A" in front of every asset on
    // every row -- on a page where most assets have no published logo, that is a column of loose
    // letters rather than a set of marks. The ticker is right next to it and already says which asset.
    if(!lg)return "";
    return '<span class="lx-act-ilogo" style="--al:'+bg+'"></span>';
  }
  // One space in front of the mark, always -- present whether or not there is a mark to show. The mark
  // carries its own trailing gap in CSS.
  function accAsset(code,native){ return " "+accIlogo(code,native)+esc(code); }
  var AIC={
    payment:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    swap:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>',
    trust:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    pool:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2s6 7 6 11a6 6 0 01-12 0c0-4 6-11 6-11z"/></svg>',
    offer:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>',
    other:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg>'
  };
  function opCode(o){ return o.asset_type==="native"?"XLM":(o.asset_code||""); }
  // The counterparty on a payment row, as a link to ITS OWN page on this site. It was plain text, so
  // the one thing you actually want to do next from someone's activity -- look at who they paid --
  // was the one thing the row would not let you do.
  function accWho(a){
    a=String(a||""); if(!a)return "";
    return '<a class="acc-who" href="/account/stellar/'+esc(a)+'" title="'+esc(a)+'">'+esc(shortG(a))+'</a>';
  }
  function describe(o){
    var t=o.type||"", me=ADDR;
    if(t==="payment"){
      var out=(o.from===me), pc=opCode(o), pn=(o.asset_type==="native");
      return {ic:"payment", kind:out?"sent":"received",
        titleHtml:(out?"Sent":"Received")+accAsset(pc,pn),
        title:(out?"Sent ":"Received ")+pc,
        sub:(out?("to "+shortG(o.to)):("from "+shortG(o.from))),
        subHtml:(out?("to "+accWho(o.to)):("from "+accWho(o.from))), cls:out?"acc-dn":"acc-up",
        right:(out?"-":"+")+amt(o.amount)+" "+pc}; }
    if(t.indexOf("path_payment")===0){
      var sc=o.source_asset_type==="native"?"XLM":(o.source_asset_code||"");
      var dc=opCode(o), dn=(o.asset_type==="native"), sn=(o.source_asset_type==="native");
      return {ic:"swap", kind:"swap",
        titleHtml:"Swap"+accAsset(sc,sn)+" "+ARROW+accAsset(dc,dn),
        title:"Swap "+sc+" "+ARROW+" "+dc,
        // #37: every row on a Stellar-only app is "via Stellar DEX" -- it is a column of the same five
        // words. The slot stays (other op kinds put a real counterparty in it); the swap rows just have
        // nothing to add there.
        sub:"",
        right:"+"+amt(o.amount)+" "+dc, rightSub:"-"+amt(o.source_amount)+" "+sc}; }
    if(t==="change_trust"){
      var add=(+o.limit)>0;
      var tc=(o.asset_code||opCode(o));
      return {ic:"trust", kind:"settings",
        titleHtml:(add?"Added trustline":"Removed trustline")+accAsset(tc,false),
        title:(add?"Added trustline ":"Removed trustline ")+tc,
        sub:o.asset_issuer?shortG(o.asset_issuer):"", right:""}; }
    if(t==="liquidity_pool_deposit")  return {ic:"pool", kind:"lp", title:"Deposited into a pool", sub:shortG(o.liquidity_pool_id||""), right:""};
    if(t==="liquidity_pool_withdraw") return {ic:"pool", kind:"lp", title:"Withdrew from a pool", sub:shortG(o.liquidity_pool_id||""), right:""};
    if(t.indexOf("offer")>=0){
      var amount=+o.amount||0;
      var sc2=(o.selling_asset_code||(o.selling_asset_type==="native"?"XLM":"")),
          bc2=(o.buying_asset_code||(o.buying_asset_type==="native"?"XLM":""));
      return {ic:"offer", kind:"order",
        titleHtml:(amount>0?"Placed an order":"Cancelled an order")
          +accAsset(sc2,o.selling_asset_type==="native")+" /"+accAsset(bc2,o.buying_asset_type==="native"),
        title:(amount>0?"Placed an order":"Cancelled an order"), sub:"", right:""}; }
    if(t==="create_account") return {ic:"payment", kind:"received", title:"Account created", sub:"", cls:"acc-up", right:"+"+amt(o.starting_balance)+" XLM"};
    if(t==="account_merge")  return {ic:"other", kind:"other", title:"Account merged", sub:shortG(o.into||""), right:""};
    if(t==="claim_claimable_balance") return {ic:"payment", kind:"claim", title:"Claimed claimable balance", sub:"", right:""};
    if(t==="create_claimable_balance") return {ic:"payment", kind:"claim", title:"Created claimable balance", sub:"", right:"-"+amt(o.amount)+" "+opCode(o)};
    // Anything else: say what it was rather than inventing a story for it.
    return {ic:"other", kind:"other", title:t.split("_").join(" ").replace(/^./,function(m){return m.toUpperCase();}), sub:"", right:""};
  }
  function renderActs(){
    var box=q("#accActs"); if(!box)return;
    var n=q("#accActN"); if(n)n.textContent=String(ACTS.length);
    if(!ACTS.length){ box.innerHTML='<div class="acc-empty">'
      +(DONE.acts?"No activity on this account yet.":"Loading activity"+String.fromCharCode(8230))+'</div>'; return; }
    box.innerHTML=ACTS.map(function(o){
      var d=describe(o), ts=Date.parse(o.created_at||"")||0;
      // .acc-act -> .activity-row: same element names as the wallet, so the same rules style both.
      var kind=d.kind||"other";
      var ac=(kind==="received")?"up":(kind==="sent")?"down":(kind==="swap")?"swap":"";
      var title=d.titleHtml||esc(d.title);
      // subHtml when the row has a linked counterparty, the escaped plain text otherwise. Rows without
      // one (swaps, pool ids) are unchanged.
      var meta=[(d.subHtml||esc(d.sub||"")),(ts?ago(ts):"")].filter(Boolean).join(" "+MID+" ");
      return '<div class="activity-row"><div class="activity-icon '+kind+'">'+(WIC[kind]||WIC.other)+'</div>'
        +'<div class="activity-info"><div class="type">'+title+'</div>'
        +'<div class="meta">'+meta+'</div></div>'
        +'<div class="activity-amt"><div class="a1 '+ac+'">'+esc(d.right||"")+'</div>'
        +'<div class="a2">'+esc(d.rightSub||"")+'</div></div>'
        +'<a class="lx-txlink" href="https://stellar.expert/explorer/public/tx/'+esc(o.transaction_hash||"")+'" target="_blank" rel="noopener" title="View on Stellar.Expert"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a></div>'; }).join("");
  }

  // ---- load ---------------------------------------------------------------------------------------
  // Every signer at weight 0, master included: nothing can authorise a transaction for this account ever
  // again. Returns null when the record is not in yet, so the tag appears only once we actually know.
  function acctLocked(){
    if(!ACCT||!ACCT.signers)return null;
    var sg=ACCT.signers; if(!sg.length)return null;
    var total=0;
    for(var i=0;i<sg.length;i++){ var w=+sg[i].weight; if(!isFinite(w))return null; total+=w; }
    return total===0;
  }
  var LOCKSVG='<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" '
    +'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    +'<rect x="4" y="11" width="16" height="10" rx="2"></rect>'
    +'<path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>';
  function paintHeader(){
    var el=q("#accAddr"); if(el){ el.textContent=ADDR||"No account"; el.title=ADDR; }
    var av=q("#accAvatar"); if(av&&ADDR)av.style.backgroundImage="url("+identicon(ADDR)+")";
    var nt=q("#accNet"); if(nt&&!nt.style.backgroundImage)nt.style.backgroundImage="url("+STELLAR_URI+")";
    var sub=q("#accSub"); if(!sub)return;
    var bits=[];

    if(acctLocked()===true)bits.push('<span class="lx-acclock" title="Every signer has weight 0 — '
      +'no key can authorise a transaction for this account">'+LOCKSVG+'<span>Locked</span></span>');
    if(ACCT&&ACCT.__created)bits.push("Active since "+esc(ACCT.__created));
    if(ADDR)bits.push('<a href="https://stellar.expert/explorer/public/account/'+esc(ADDR)+'" target="_blank" rel="noopener">Explorer <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>');
    sub.innerHTML=bits.join("");
  }
  function fail(msg){
    qa(".acc-empty").forEach(function(e){ e.textContent=msg; });
    var el=q("#accAddr"); if(el)el.textContent=ADDR||"No account";
  }

  function loadPrice(){ return fetchJ(CG).then(function(d){
    if(d&&d.stellar&&+d.stellar.usd){ xlmUsd=+d.stellar.usd;
      try{ localStorage.setItem("lumos.xlmUsd",JSON.stringify({v:xlmUsd,ts:Date.now()})); }catch(_){} }
  }).catch(function(){}); }

  // last trade close against XLM -- the same price the Trade pages quote, so a holding is worth the same
  // number on both screens
  function loadAssetPx(a){ pxStart(); return loadAssetPx_(a).then(pxEnd,pxEnd); }
  // /lxapi/candles answers this at the edge, cached 300s and shared, so a 72-asset wallet costs the
  // network one request per ASSET-EVER rather than 72 per page view. Direct Horizon stays as the
  // fallback, so localhost and any static host still work.
  function pxDirect(a){
    var t=a.code.length<=4?"credit_alphanum4":"credit_alphanum12";
    return j(H+"/trade_aggregations?base_asset_type="+t+"&base_asset_code="+a.code+"&base_asset_issuer="+a.issuer
      +"&counter_asset_type=native&resolution=86400000&order=desc&limit=1");
  }
  function pxAgg(a){
    var code=a.code||"", iss=a.issuer||"";
    // Only hand the edge what its validator accepts (code 1-12 alphanumeric, issuer G + 55).
    var ok=code.length>0&&code.length<13&&iss.length===56&&iss.charAt(0)==="G";
    for(var i=0;ok&&i<code.length;i++){ var ch=code.charAt(i);
      if(!((ch>="A"&&ch<="Z")||(ch>="a"&&ch<="z")||(ch>="0"&&ch<="9")))ok=false; }
    if(!ok)return pxDirect(a);
    return fetch("/lxapi/candles?a="+encodeURIComponent(code+"-"+iss)+"&res=86400000&order=desc&limit=1")
      .then(function(r){ return r.ok?r.json():null; })
      .then(function(d){ return (!d||d.error)?pxDirect(a):d; })
      .catch(function(){ return pxDirect(a); });
  }
  function loadAssetPx_(a){
    return pxAgg(a).then(function(d){
      var r=recs(d)[0]; if(r){ a.px=+r.close||+r.avg||0; a.usd=a.bal*a.px*xlmUsd; }
      // NOT renderAssets(): rebuilding here is what makes the list jump. Write this one value into the
      // row it belongs to and leave the order alone -- the sorted rebuild happens once, in pxEnd, when
      // every price has landed.
      renderStats(); fillAssetValue(a); }).catch(function(){}); }

  // __ldDone marks "this one has finished, whatever it found". Without it a pool that resolves with no
  // USD value -- a credit/credit pair with no priced side -- would look permanently unloaded and hold
  // the whole table in arrival order until the deadline expired.
  function loadPool(p){ pxStart(); return loadPool_(p).then(function(r){ p.__ldDone=1; pxEnd(r); },function(e){ p.__ldDone=1; pxEnd(e); }); }
  function loadPool_(p){
    return j(H+"/liquidity_pools/"+p.id).then(function(d){
      var tot=+d.total_shares||0; p.share=tot>0?(p.shares/tot*100):0; p.tl=+d.total_trustlines||null;
      // Keep BOTH reserves, in order. An asset/asset pool has no native side, and collapsing the two
      // into one variable is what dropped the second ticker.
      var sides=(d.reserves||[]).map(function(rv){
        if(rv.asset==="native")return {code:"XLM",iss:"",amount:+rv.amount};
        var parts=rv.asset.split(":"); return {code:parts[0],iss:parts[1]||"",amount:+rv.amount}; });
      if(sides[0]){ p.a=sides[0].code; p.ai=sides[0].iss; fetchLogo(p.a,p.ai); }
      if(sides[1]){ p.b=sides[1].code; p.bi=sides[1].iss; fetchLogo(p.b,p.bi); }
      // A constant-product pool holds equal value on both sides, so one side doubled IS the TVL.
      function settle(sideXlm){ p.tvl=sideXlm*2*xlmUsd; p.usd=p.tvl*(p.share/100); renderStats(); renderPools(); }
      var nat=null; for(var i=0;i<sides.length;i++)if(sides[i].code==="XLM")nat=sides[i];
      if(nat){ settle(nat.amount); return; }
      // no XLM side: price one side in XLM, then double that
      var s0=sides[0]; if(!s0||!s0.iss){ renderPools(); return; }
      var t0=s0.code.length<=4?"credit_alphanum4":"credit_alphanum12";
        return pxAgg({code:s0.code,issuer:s0.iss}).then(function(pd){
        var r=recs(pd)[0], px=r?(+r.close||+r.avg||0):0;
        if(px>0)settle(s0.amount*px); else renderPools();
      }).catch(function(){ renderPools(); });
      }).catch(function(){}); }

  function loadActs(){
    return j(H+"/accounts/"+ADDR+"/operations?order=desc&limit=50").then(function(d){
      ACTS=recs(d); DONE.acts=1; renderActs(); }).catch(function(){ DONE.acts=1; renderActs(); }); }

  function boot(){
    if(!ADDR){ fail(PASTED_CONTRACT
      ? ("That is a Soroban contract, not a wallet " + String.fromCharCode(8212) + " it holds no balances or history we can show. Open it on stellar.expert to see its state.")
      : "No Stellar address in this link."); return; }
    paintHeader();
    loadPrice().then(function(){ renderStats(); renderAssets(); });
    j(H+"/accounts/"+ADDR).then(function(acc){
      ACCT=acc;
      (acc.balances||[]).forEach(function(b){
        if(b.asset_type==="native"){ XLM=+b.balance||0; return; }
        if(b.asset_type==="liquidity_pool_shares"){
          if((+b.balance||0)>0)POOLS.push({id:b.liquidity_pool_id,shares:+b.balance,a:"",b:"",ai:"",bi:"",share:0,usd:null,tvl:null});
          return; }
        if(!(+b.balance>0))return;                       // an empty trustline is not a holding
        ASSETS.push({code:b.asset_code,issuer:b.asset_issuer,dom:"",bal:+b.balance,px:0,usd:null});
      });
      DONE.pools=1;
      // From here on we are valuing the account -- see PXWAVE. renderStats() is deliberately LAST:
      // renderPools() and the wave below claim their pending count synchronously, so calling it first
      // would read PXPEND as 0 and print a total built from nothing but the XLM balance.
      PXWAVE=1;
      paintHeader(); renderAssets(); wireTabs(); renderPools();
      // Price beyond the first batch so the ORDER is real rather than just Horizon's order, but stop at
      // PRICE_CAP: an account with 400 trustlines must not turn one page view into 400 requests.
      pxStart();                       // held for the whole wave, not per batch
      (function wave(i,list){ if(i>=list.length){ pxEnd(); return; }
        Promise.all(list.slice(i,i+5).map(function(a){ if(a.__px)return null; a.__px=1; return loadAssetPx(a); }))
          .then(function(){ wave(i+5,list); },function(){ wave(i+5,list); });
      })(0,ASSETS.slice(0,PRICE_CAP));
      renderStats();          // now that everything in flight has been counted
      // "active since" comes from the oldest operation we can see, not from the account record --
      // Horizon does not carry a creation timestamp on /accounts.
      j(H+"/accounts/"+ADDR+"/operations?order=asc&limit=1").then(function(d){
        var r=recs(d)[0]; if(r&&r.created_at){ ACCT.__created=new Date(r.created_at).toLocaleDateString("en-US",{month:"short",year:"numeric"}); paintHeader(); }
      }).catch(function(){});
    }).catch(function(){
      fail("This account does not exist on Stellar mainnet, or Horizon is unreachable.");
    });
    loadActs();
    // #10: the wallet page owns Send -- the keys, the balances, the signing and the asset picker all
    // live there. Handing it the recipient in the url is the whole integration; building a second send
    // form here would be a second thing to keep correct about moving real money.
    // #7: drawn once, the first time it is asked for. A QR of a 56-character address is a 37x37 grid;
    // an <svg> of that many rects stays crisp at any size and costs nothing to keep around.
    var qb=q("#accQr");
    if(qb)(function(){
      function build(){
        if(!ADDR||qb.querySelector(".acc-qrpop"))return;
        if(!window.qrcode)return;
        var q2=null;
        var lv=[[0,"H"],[0,"Q"],[8,"H"],[10,"H"],[0,"M"],[4,"M"]];
        for(var i=0;i<lv.length;i++){ try{ var t=window.qrcode(lv[i][0],lv[i][1]); t.addData(ADDR); t.make(); q2=t; break; }catch(_){} }
        if(!q2)return;
        var n=q2.getModuleCount(), pad=2, size=n+pad*2, sq="";
        for(var y=0;y<n;y++)for(var x=0;x<n;x++){
          if(!q2.isDark(y,x))continue;
          sq+='<rect x="'+(x+pad)+'" y="'+(y+pad)+'" width="1" height="1"></rect>';
        }
        var pop=document.createElement("div");
        pop.className="acc-qrpop";
        pop.innerHTML='<svg viewBox="0 0 '+size+' '+size+'" xmlns="http://www.w3.org/2000/svg">'
          +'<rect width="'+size+'" height="'+size+'" fill="#fff"></rect>'
          +'<g fill="#000">'+sq+'</g></svg>'
          +'<div class="cap">'+shortG(ADDR)+'</div>';
        qb.appendChild(pop);
      }
      qb.addEventListener("click",function(e){
        try{ e.preventDefault(); e.stopPropagation(); }catch(_){}
        build();
        qb.classList.toggle("on");
      });
      qb.addEventListener("mouseenter",build);
      // tapping anywhere else puts it away
      document.addEventListener("click",function(ev){
        if(qb.contains(ev.target))return;
        qb.classList.remove("on");
      },true);
    })();
    var sb=q("#accSend");
    if(sb)sb.addEventListener("click",function(e){
      try{ e.preventDefault(); }catch(_){}
      if(!ADDR)return;
      var u="lumoscore-wallet.html?to="+encodeURIComponent(ADDR);
      try{ if(window.__lxNav){ window.__lxNav(u); return; } }catch(_){}
      location.href=u;
    });
    var cp=q("#accCopy");
    // The site owns a bottom-centre toast (window.showToast) that every other copy action uses. Reuse it
    // rather than inventing a second confirmation style on one page.
    function accToast(m){ try{ if(typeof window.showToast==="function"){ window.showToast(m); return; } }catch(_){}
      try{ var t=document.createElement("div"); t.textContent=m;
        t.style.cssText="position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:99999;"
          +"padding:11px 18px;border-radius:12px;background:#1a1a1f;color:#fff;font-size:14px;font-weight:700;"
          +"box-shadow:0 6px 24px rgba(0,0,0,.45);pointer-events:none";
        document.body.appendChild(t); setTimeout(function(){ if(t.parentNode)t.parentNode.removeChild(t); },1800);
      }catch(_){} }
    if(cp)cp.addEventListener("click",function(){
      if(!ADDR)return;
      try{ navigator.clipboard.writeText(ADDR); }catch(_){}
      accToast("Wallet address copied");
    });
  }
  if(document.readyState!=="loading")boot(); else document.addEventListener("DOMContentLoaded",boot);
})();