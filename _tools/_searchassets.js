// Search: replace the mock asset results (LUMOS/CELL/... Aptos placeholders) with the real
// TESTNET tokens minted via Launchpad, each linking to the Asset Overview page. Read-only.
// The design filters a hardcoded `Assets` array into #spAssetList; we override the render so only
// real mainnet assets show, and rows are <a href=dex-asset?asset=CODE-ISSUER> (the nav
// resolver respects a[href], so clicking opens the asset page rather than the Trade page).
const fs = require('fs');
const { read, getContents, VERIFIED, DOMAIN_DISPLAY } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const STYLE = `<style id="lx-searchassets-css">
.sp-ico.lx-poolico,.lx-poolico{width:auto;min-width:66px;height:36px;display:inline-flex;flex-direction:row;flex-wrap:nowrap;grid-auto-flow:column;grid-template-columns:repeat(2,30px);align-items:center;align-items:center;justify-content:flex-start;gap:5px;overflow:visible;background:none;flex-shrink:0}
.lx-poolico .lx-pi.lx-pi-fill{background-size:118% 118%}
.lx-poolico .lx-pi{box-sizing:border-box;width:30px;height:30px;flex:0 0 30px;border-radius:50%;display:block;border:0;background-color:var(--surface-2);background-size:cover;background-position:center;background-repeat:no-repeat}
.sp-row--asset.lx-searow{text-decoration:none;color:inherit}
.sp-row--asset.lx-searow .sp-ico{display:grid;place-items:center;color:#fff;font-weight:800;font-family:'JetBrains Mono',monospace;overflow:hidden}
.sp-row--asset.lx-searow .sp-ico img{display:block}
.sp-seaempty{padding:20px 14px;text-align:center;color:var(--text-muted);font-size:13px}
/* Recent-searches header. Self-contained: this row does not exist in the design, so nothing styles it. */
.lx-rechead{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px 6px;
  font-size:11.5px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:var(--text-muted)}
.lx-rechead .lx-recclear{background:none;border:0;padding:2px 4px;margin:0;cursor:pointer;font:inherit;
  letter-spacing:inherit;text-transform:inherit;color:var(--text-muted)}
.lx-rechead .lx-recclear:hover{color:var(--accent)}
.lx-seavfd{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;margin-left:5px;border-radius:50%;background:var(--green,#35c07f);color:#fff;vertical-align:-2px}
.lx-seavfd svg{width:9px;height:9px;display:block}
</style>`;

const SCRIPT = `<script id="lx-searchassets">(function(){
  // Live mainnet asset search. The old build filtered a hardcoded five-token array, so every real asset
  // ("SHX", "yBTC", anything a user actually looks for) came back "no match".
  //
  // A ticker is NOT an identity here — "SHX" alone matches six different issuers, one of which is Stronghold
  // (91,001 trustlines, stronghold.co) and five of which are look-alikes. So every row carries the domain,
  // the trustline count and the issuer, and results are ordered by trustlines so the real one leads.
  var SEA_CACHE={}, SEA_SEQ=0, SEA_T=null;
  function launchTokens(){ try{ var e=JSON.parse(localStorage.getItem("lumos.launches")||"[]"); return (e&&e.length)?e:[]; }catch(_){ return []; } }
  var GRAD=["#ea6a2c","#7c6cf5","#14b8a6","#ec4899","#3b82f6"];   // solid: .lx-spico-on forces background-image:initial!important, so gradients are impossible here
  function short(a){return a?a.slice(0,4)+"\u2026"+a.slice(-4):"";}
  function esc(s){return (s+"").replace(/[<>&"]/g,function(c){return c==="<"?"&lt;":c===">"?"&gt;":c==="&"?"&amp;":"&quot;";});}
  function avatarUri(code){ var c=String(code||"?"),h=0; for(var i=0;i<c.length;i++)h=(h*31+c.charCodeAt(i))%360;
    var t=c.replace(/[^A-Za-z0-9]/g,"").slice(0,2).toUpperCase()||"?";
    var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="hsl('+h+',60%,50%)"/><text x="20" y="26" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="15" fill="#fff">'+t+'</text></svg>';
    return "data:image/svg+xml,"+encodeURIComponent(svg); }
  function nfmt(n){ n=+n||0; return n>=1e6?(n/1e6).toFixed(1)+"M":n>=1e3?(n/1e3).toFixed(1)+"K":String(n); }
  // Verified issuers — the identical set the wallet uses, keyed on code+ISSUER. A ticker is not an
  // identity on Stellar, and search is exactly where a fake "USDC" gets found, so the tick is the point.
  var VFD=${JSON.stringify(VERIFIED)};

  // What WE show as an asset home domain where the on-chain value is stale (LUMOS still declares the
  // pre-rename lumosdao.io). Display only -- never the toml fetch, which 404s on the new domain.
  var DDOM=${JSON.stringify(DOMAIN_DISPLAY)};
  function dispDom(c,i,d){ return DDOM[(c||"")+"|"+(i||"")]||d||""; }
  var VTICK='<span class="lx-seavfd" title="Verified issuer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>';
  function row(t){
    var g=GRAD[(t.code.charCodeAt(0)||0)%GRAD.length];
    // Always emit an <img>. The shared '.sp-ico.lx-spico-on' rule sets background:initial!important, so a
    // CSS-painted fallback (gradient OR solid colour) can never show here — a generated letter-avatar data
    // URI sidesteps that entirely and matches how the rest of the app draws unknown tokens.
    var ico='<div class="sp-ico lx-spico-on" style="position:relative;overflow:hidden"><img src="'+esc(t.img||avatarUri(t.code))+'" alt="" style="width:100%;height:100%;object-fit:cover;display:block"></div>';
    var sub = t.tl!=null ? (nfmt(t.tl)+" trustlines") : "Launchpad token";
    // Trade-asset, NOT asset-overview: the overview page was removed, and every asset url now resolves
    // to /trade/stellar/<CODE>-<ISSUER> — the same facts plus the ability to act on them.
    return '<a class="sp-row sp-row--asset lx-searow" data-chain="stellar" href="lumoscore-dex-asset.html?asset='+esc(t.code)+'-'+esc(t.issuer)+'">'+
      ico+
      '<div class="sp-info"><div class="sp-name-row">'+esc(t.name||t.code)+(VFD[t.code+"|"+t.issuer]?VTICK:"")+' <span class="sp-domain">'+esc(dispDom(t.code,t.issuer,t.domain)||"Stellar mainnet")+'</span></div>'+
      '<div class="sp-sub">'+esc(t.code)+' \u00b7 '+esc(sub)+'</div></div>'+
      '<div class="sp-right"><div class="sp-addr-mini" data-copy="'+esc(t.issuer)+'" data-copy-label="'+esc(t.code)+' issuer">'+short(t.issuer)+'</div></div></a>';
  }
  // Stellar public keys are base32 over [A-Z2-7], 56 chars, always leading with G. Anything else is a
  // search term, not an address.
  function isAddr(v){ return /^G[A-Z2-7]{55}$/.test(String(v||"").trim()); }
  // 64 hex characters: a liquidity-pool id, which cannot be confused with a ticker or an address
  function isPool(v){ return /^[0-9a-f]{64}$/i.test(String(v||"").trim()); }
  var POOLI={};
  function poolUsd(n){ n=+n||0; if(n>=1e9)return "$"+(n/1e9).toFixed(2)+"B"; if(n>=1e6)return "$"+(n/1e6).toFixed(2)+"M";
    if(n>=1000)return "$"+Math.round(n).toLocaleString("en-US"); if(n>=1)return "$"+n.toFixed(2); return "$"+n.toFixed(4); }
  var LXSTELLAR='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDMyIDMyIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNiIgZmlsbD0iIzAwMCIvPjxwYXRoIGQ9Ik0yMy4xMyA5LjI5MmwtMi40IDEuMjI0LTExLjU5OCA1LjkwN0E2LjkwOSA2LjkwOSAwIDAxMTkuMzUgOS40OThsMS4zNzQtLjcuMjA1LS4xMDVhOC40MzkgOC40MzkgMCAwMC0xMy4zNzEgNy40NzIgMS41MzUgMS41MzUgMCAwMS0uODM0IDEuNDg0bC0uNzI1LjM3djEuNzI0bDIuMTM0LTEuMDg4LjY5MS0uMzUzLjY4MS0uMzQ3IDEyLjIyNi02LjIzIDEuMzc0LS42OTkgMi44NC0xLjQ0N1Y3Ljg1NnptMi44MTYgMi4wMTJMMTAuMjAxIDE5LjMybC0xLjM3NC43TDYgMjEuNDYzdjEuNzIzbDIuODA4LTEuNDMgMi40MDEtMS4yMjQgMTEuNjEtNS45MTZhNi45MDkgNi45MDkgMCAwMS0xMC4yMjkgNi45M2wtLjA4NS4wNDUtMS40OS43NmE4LjQzOSA4LjQzOSAwIDAwMTMuMzcyLTcuNDc1IDEuNTM2IDEuNTM2IDAgMDEuODMzLTEuNDgzbC43MjYtLjM3di0xLjcxOHoiIGZpbGw9IiNGRkYiLz48L3N2Zz4=';
  function poolIcoSet(id,which,src){
    if(!src)return;
    if(POOLI[id])POOLI[id][which==="a"?"ia":"ib"]=src;   // survive the next repaint
    var box=document.querySelector('.lx-poolico[data-pool="'+id+'"]'); if(!box)return;
    var im=box.querySelector(which==="a"?".lx-pi-a":".lx-pi-b");
    if(im)im.classList.toggle("lx-pi-fill",src===LXSTELLAR);
    if(im)im.style.backgroundImage='url("'+src+'")';
  }
  // by ISSUER, never by ticker: a ticker search is score-ranked and small assets are unreachable in it
  var LXBRAND={
    "USDC|GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN":"https://assets.coingecko.com/coins/images/6319/small/usdc.png",
    "EURC|GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2":"https://assets.coingecko.com/coins/images/26045/small/euro.png",
    "AQUA|GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA":"https://aqua.network/assets/img/aqua-logo.png",
    "yXLM|GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55":"https://assets.coingecko.com/coins/images/100/small/fmpFRHHQ_400x400.jpg",
    "BTC|GAUTUYY2THLF7SGITDFMXJVYH3LHDSMGEAKSBU267M2K7A3W543CKUEF":"https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
    "LUMOS|GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S":"/assets/tokens/lumos.png"
  };
  function poolIcoLoad(id,which,code,issuer){
    if(code==="XLM"||!issuer){ poolIcoSet(id,which,code==="XLM"?LXSTELLAR:avatarUri(code)); return; }
    var bd=LXBRAND[code+"|"+issuer]; if(bd){ poolIcoSet(id,which,bd); return; }   // known mark, no lookup needed
    poolIcoSet(id,which,avatarUri(code));
    fetch("https://api.stellar.expert/explorer/public/asset?search="+encodeURIComponent(issuer)+"&limit=50")
      .then(function(r){ return r.json(); }).then(function(d){
        var recs=(d&&d._embedded&&d._embedded.records)||[];
        var m=recs.filter(function(x){ return (x.asset||"").indexOf(code+"-"+issuer)===0; })[0];
        var img=(m&&m.tomlInfo&&m.tomlInfo.image)||"";
        if(img)poolIcoSet(id,which,img);
      }).catch(function(){});
  }
  function poolFill(id){
    var d=POOLI[id]; if(!d)return;
    var pair=document.querySelector('.lx-pool-pair[data-pool="'+id+'"]');
    var sub=document.querySelector('.lx-pool-sub[data-pool="'+id+'"]');
    if(pair&&d.pair)pair.textContent=d.pair;
    if(d.ia)poolIcoSet(id,"a",d.ia);
    if(d.ib)poolIcoSet(id,"b",d.ib);
    if(sub){ var bits=[];
      if(d.n!=null)bits.push(d.n===1?"1 participant":(d.n.toLocaleString("en-US")+" participants"));
      if(d.tvl!=null)bits.push(poolUsd(d.tvl)+" TVL");
      sub.textContent=bits.length?bits.join(" "+String.fromCharCode(183)+" "):"Pool details unavailable"; }
  }
  function poolLoad(id){
    if(POOLI[id]){ poolFill(id); return; }
    POOLI[id]={};
    var xu=0; try{ var c=JSON.parse(localStorage.getItem("lumos.xlmUsd")||"null"); if(c&&+c.v>0)xu=+c.v; }catch(_){}
    // Host fallback, per GUARDRAILS E12 and for the same reason as the Pools and Trade-asset layers: a
    // rate-limited Horizon left the found pool reading "Pool details unavailable" even though the row
    // itself was correct. A readable 404 is a real "no such pool" and is not re-asked.
    (function(){
      var P="https://horizon.stellar.org/liquidity_pools/"+id, P2="https://horizon.stellar.lobstr.co/liquidity_pools/"+id;
      function once(u){ return fetch(u).then(function(r){ if(r.ok)return r.json();
        var e=new Error("s"); e.__st=r.status; throw e; }); }
      return once(P).catch(function(e){ var st=(e&&e.__st)||0;
        if(st>=400&&st<500&&st!==429)return null;
        return once(P2).catch(function(){ return null; }); });
    })().then(function(d){
      if(!d){ POOLI[id]={n:null,tvl:null}; poolFill(id); return; }
      var sides=(d.reserves||[]).map(function(rv){
        if(rv.asset==="native")return {c:"XLM",i:"",a:+rv.amount};
        var pr=rv.asset.split(":"); return {c:(pr[0]||"?"),i:(pr[1]||""),a:+rv.amount}; });
      var nat=null; for(var i=0;i<sides.length;i++)if(sides[i].c==="XLM")nat=sides[i];
      POOLI[id]={ pair:sides.map(function(x){return x.c;}).join(" / "),
        n:(d.total_trustlines!=null?+d.total_trustlines:null),
        tvl:(nat&&xu>0)?(nat.a*2*xu):null };
      poolFill(id);
      if(sides[0]){ poolIcoSet(id,"a",avatarUri(sides[0].c)); poolIcoLoad(id,"a",sides[0].c,sides[0].i); }
      if(sides[1]){ poolIcoSet(id,"b",avatarUri(sides[1].c)); poolIcoLoad(id,"b",sides[1].c,sides[1].i); }
    }).catch(function(){ POOLI[id]={n:null,tvl:null}; poolFill(id); });
  }
  function poolRow(id){
    var ico='<div class="sp-ico lx-spico-on lx-poolico" data-pool="'+esc(id)+'" >'
      +'<span class="lx-pi lx-pi-a"></span>'+'<span class="lx-pi lx-pi-b"></span>'+'</div>';
    return '<a class="sp-row sp-row--asset lx-searow" data-chain="stellar" href="/pools/stellar/id/'+esc(id)+'">'+ico+
      '<div class="sp-info"><div class="sp-name-row"><span class="lx-pool-pair" data-pool="'+esc(id)+'">Liquidity pool</span> <span class="sp-domain">Stellar AMM</span></div>'+
      '<div class="sp-sub lx-pool-sub" data-pool="'+esc(id)+'">Loading pool…</div></div>'+
      '<div class="sp-right"><div class="sp-addr-mini">'+esc(id.slice(0,4))+String.fromCharCode(8230)+esc(id.slice(-4))+'</div></div></a>';
  }
  // The same deterministic identicon the account page and the holder lists draw, so one wallet keeps
  // one face wherever it appears.
  function identHash(x){ var h=2166136261; for(var i=0;i<x.length;i++){ h^=x.charCodeAt(i); h=(h*16777619)>>>0; } return h>>>0; }
  function identUri(addr){
    var h=identHash(addr), hue=h%360, hue2=(hue+52)%360, cells="";
    for(var x=0;x<3;x++)for(var y=0;y<5;y++){
      if(!((identHash(addr+":"+x+":"+y)>>>3)&1))continue;
      cells+='<rect x="'+(x*8)+'" y="'+(y*8)+'" width="8" height="8"/>';
      if(x<2)cells+='<rect x="'+((4-x)*8)+'" y="'+(y*8)+'" width="8" height="8"/>';
    }
    var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
      +'<stop offset="0%" stop-color="hsl('+hue+',62%,52%)"/><stop offset="100%" stop-color="hsl('+hue2+',60%,38%)"/>'
      +'</linearGradient></defs><rect width="40" height="40" fill="url(#g)"/><g fill="rgba(255,255,255,.92)">'+cells+'</g></svg>';
    return "data:image/svg+xml;base64,"+btoa(svg);
  }
  function acctRow(addr){
    var ico='<div class="sp-ico lx-spico-on" style="position:relative;overflow:hidden"><img src="'+identUri(addr)
      +'" alt="" style="width:100%;height:100%;object-fit:cover;display:block"></div>';
    return '<a class="sp-row sp-row--asset lx-searow" data-chain="stellar" href="/account/stellar/'+esc(addr)+'">'+ico+
      '<div class="sp-info"><div class="sp-name-row">Stellar account <span class="sp-domain">wallet</span></div>'+
      '<div class="sp-sub">Balances, pools and activity</div></div>'+
      '<div class="sp-right"><div class="sp-addr-mini">'+short(addr)+'</div></div></a>';
  }
  function paint(list,html){ if(list.innerHTML!==html) list.innerHTML=html; }

  // ---- RECENT SEARCHES ------------------------------------------------------------------------------
  // ONE list of 5, shared by assets, pools and wallets -- not 5 of each. All three render as the same
  // .sp-row--asset.lx-searow, so a single capture covers them and the order is simply the order things
  // were opened in.
  //
  // What is stored is FIELDS READ BACK OFF THE ROW that was clicked, not the row's HTML and not a
  // re-derivation from the href. Storing HTML would mean writing markup from localStorage straight into
  // innerHTML on every future visit; re-deriving would mean refetching an asset index, a pool record or
  // an account just to draw five lines. Reading the rendered row gives the same thing for free, and it is
  // already escaped output.
  var RKEY="lumos.search.recent", RMAX=5;
  function recGet(){ try{ var a=JSON.parse(localStorage.getItem(RKEY)||"[]");
    return Array.isArray(a)?a.filter(function(x){return x&&x.href;}).slice(0,RMAX):[]; }catch(_){ return []; } }
  function recSave(a){ try{ localStorage.setItem(RKEY,JSON.stringify(a.slice(0,RMAX))); }catch(_){ } }
  // Dedupe on href, then unshift: reopening something already in the list MOVES it to the top rather than
  // adding a second copy, which is what "most recent first" has to mean.
  function recAdd(t){ if(!t||!t.href)return;
    var a=recGet().filter(function(x){ return x.href!==t.href; }); a.unshift(t); recSave(a); }
  // Accepts a bare URL or a full url(...) value and returns the bare URL. Tolerating both matters because
  // entries saved before this fix are stored in the url("...") form and would otherwise stay broken.
  function piUrl(v){
    v=String(v||"").trim(); if(!v||v==="none")return "";
    var m=/^url\\(\\s*["']?([\\s\\S]*?)["']?\\s*\\)$/.exec(v);
    return m?m[1]:v;
  }
  function recFromRow(a){
    // Our published token registry, read from our own origin. stellar.expert carries no tomlInfo for
// LumosCore assets at all, so their search rows arrived with img:"" and drew a letter avatar even though
// the logo was published in our stellar.toml. Same record the toml is built from, so search agrees with
// the wallet.
var _seaMan=null;
try{ fetch("/assets/tokens/launchpad-icons.json").then(function(r){ return r.ok?r.json():null; })
  .then(function(m){ if(m&&typeof m==="object"&&m.constructor!==Array)_seaMan=m; }).catch(function(){}); }catch(_e){}
function lxSeaReg(code,issuer){
  if(!_seaMan||!code||!issuer)return "";
  var v=_seaMan[code+"-"+issuer]; var u=(v&&typeof v==="object")?v.image:v;
  return (typeof u==="string"&&u.charAt(0)==="/"&&u.indexOf("//")!==0)?u:"";
}
function txt(s){ var e=a.querySelector(s); return e?e.textContent.trim().replace(/\\s+/g," "):""; }
    var nm=a.querySelector(".sp-name-row"), name="";
    if(nm){ var c=nm.cloneNode(true); var d=c.querySelector(".sp-domain"); if(d&&d.parentNode)d.parentNode.removeChild(d);
      name=c.textContent.trim().replace(/\\s+/g," "); }
    var img=a.querySelector(".sp-ico img");
    // A pool draws two circles as background-image on .lx-pi rather than an <img>, so its icon is kept as
    // those two backgrounds. Without this every recent pool would fall back to a letter avatar.
    // Store the URL, NOT the whole "url(...)" value. poolIcoSet writes it as url("SRC") with double
    // quotes, and emitting that verbatim into style="background-image:..." ends the attribute at the
    // first inner quote -- the pool's two circles then rendered as empty grey discs. Same url(") trap the
    // logo guard hit. Kept as a bare URL here and re-quoted safely in recRow.
    var pis=[].slice.call(a.querySelectorAll(".lx-poolico .lx-pi")).map(function(e){
      return piUrl(e.style.backgroundImage||""); }).filter(Boolean);
    return { href:a.getAttribute("href")||"", name:name, dom:txt(".sp-domain"), sub:txt(".sp-sub"),
      right:txt(".sp-addr-mini"), img:img?(img.getAttribute("src")||""):"", pis:pis };
  }
  function recRow(t){
    var ico = (t.pis&&t.pis.length)
      // esc() turns the quotes into &quot;, which the browser decodes back to url("...") inside the style
      // attribute instead of ending it early.
      ? '<div class="sp-ico lx-spico-on lx-poolico">'+t.pis.map(function(b,i){
          return '<span class="lx-pi lx-pi-'+(i?"b":"a")+'" style="background-image:url('+esc('"'+piUrl(b)+'"')+')"></span>'; }).join("")+'</div>'
      : '<div class="sp-ico lx-spico-on" style="position:relative;overflow:hidden"><img src="'+esc(t.img||avatarUri(t.name||"?"))
        +'" alt="" style="width:100%;height:100%;object-fit:cover;display:block"></div>';
    return '<a class="sp-row sp-row--asset lx-searow lx-recrow" data-chain="stellar" href="'+esc(t.href)+'">'+ico+
      '<div class="sp-info"><div class="sp-name-row">'+esc(t.name||"Result")
        +(t.dom?' <span class="sp-domain">'+esc(t.dom)+'</span>':'')+'</div>'+
      '<div class="sp-sub">'+esc(t.sub)+'</div></div>'+
      (t.right?'<div class="sp-right"><div class="sp-addr-mini">'+esc(t.right)+'</div></div>':'')+'</a>';
  }
  // Returns whether anything was painted, so the caller can leave the design's own empty state alone when
  // there is no history yet rather than replacing it with a blank "Recent" heading.
  function recPaint(list){
    var a=recGet(); if(!a.length) return false;
    paint(list,'<div class="lx-rechead"><span>Recent</span><button type="button" class="lx-recclear">Clear</button></div>'
      +a.map(recRow).join(""));
    return true;
  }
  if(!window.__lxRecWired){ window.__lxRecWired=1;
    // Capture, because the row is an <a> and the click must be recorded before the navigation it causes.
    document.addEventListener("click",function(e){
      var t=e.target; if(!t||!t.closest)return;
      var clr=t.closest(".lx-recclear");
      if(clr){ e.preventDefault(); e.stopPropagation();
        try{ localStorage.removeItem(RKEY); }catch(_){}
        var l=document.getElementById("spAssetList"); if(l)paint(l,"");
        return; }
      var row=t.closest(".lx-searow"); if(!row)return;
      try{ recAdd(recFromRow(row)); }catch(_){}
    },true);
  }
  function seaFetch(q,cb){
    if(SEA_CACHE[q]) { cb(SEA_CACHE[q]); return; }
    fetch("https://api.stellar.expert/explorer/public/asset?search="+encodeURIComponent(q)+"&limit=12")
      // A rate-limited index answers with an error BODY, and parsing it yielded zero records -- so a
      // failure was reported to the caller as "nothing on Stellar matches", which is a different and much
      // worse message than the truth. Check the status before trusting the body.
      .then(function(r){ if(!r.ok)throw new Error("s"+r.status); return r.json(); })
      .then(function(d){
        var recs=(d&&d._embedded&&d._embedded.records)||[];
        var out=recs.map(function(x){
          var id=String(x.asset||""), p=id.split("-");
          var ti=x.tomlInfo||{};
          return {code:p[0]||"", issuer:p[1]||"", name:ti.name||"", domain:x.domain||"",
                  tl:(x.trustlines&&x.trustlines[0])||0, img:ti.image||ti.orgLogo||lxSeaReg(p[0],p[1])||""};
        }).filter(function(t){ return t.code && /^G[A-Z2-7]{55}$/.test(t.issuer); });
        out.sort(function(a,b){ return b.tl-a.tl; });          // the widely-held one first
        SEA_CACHE[q]=out; cb(out);
      })
      .catch(function(){ cb(null); });                          // null = upstream failed (distinct from "no results")
  }
  function render(){
    var inp=document.getElementById("spSearchInput"), list=document.getElementById("spAssetList");
    if(!inp||!list)return;
    var raw=(inp.value||"").trim(), q=raw.toLowerCase();
    // Empty box -> recent searches, if there are any. With none, fall through to the design's own empty
    // state exactly as before rather than showing a "Recent" heading over nothing.
    if(!q){ recPaint(list); return; }
    // locally minted Launchpad tokens match instantly, with no round trip
    var local=launchTokens().filter(function(t){ return t&&t.code&&t.issuer&&t.code.toLowerCase().indexOf(q)>=0; });
    var seq=++SEA_SEQ;
    // The account row needs no network call, so it lands on the first keystroke rather than after the
    // asset index answers.
    var _qi=String(raw).trim();
    if(isPool(_qi))setTimeout(function(){ poolLoad(_qi); },0);
    if(SEA_CACHE[q]===undefined) paint(list, (isAddr(_qi)?acctRow(_qi):(isPool(_qi)?poolRow(_qi):""))
      + '<div class="sp-seaempty">Searching Stellar mainnet\u2026</div>');
    clearTimeout(SEA_T);
    SEA_T=setTimeout(function(){
      seaFetch(q,function(remote){
        if(seq!==SEA_SEQ)return;                                // a newer keystroke already won
        // A FAILING ASSET INDEX MUST NOT ERASE WHAT OTHER SOURCES FOUND. This painted the error on its
        // own, discarding the pool row (Horizon) and the account row (derived from the address itself) --
        // neither of which needs the index at all. That is the whole "the pool appears, then vanishes,
        // then appears" flap: every re-render repainted the row, and 220ms later this line wiped it.
        // Keeping the lead also makes the repaint idempotent, so paint()'s equality check ends the loop.
        if(remote===null){
          var _lead0 = isAddr(_qi) ? acctRow(_qi) : (isPool(_qi) ? poolRow(_qi) : "");
          paint(list, _lead0 + '<div class="sp-seaempty">Asset index unavailable right now'
            + (_lead0 ? ' \u2014 pools and accounts are unaffected.' : '.') + '</div>');
          if(isPool(_qi))setTimeout(function(){ poolLoad(_qi); },0);
          return; }
        var seen={}, all=[];
        local.concat(remote).forEach(function(t){ var k=t.code+"-"+t.issuer; if(!seen[k]){ seen[k]=1; all.push(t); } });
        // An address answers itself: show the account first, then anything that address issued.
        var _q=String(raw).trim();
        var lead = isAddr(_q) ? acctRow(_q) : (isPool(_q) ? poolRow(_q) : "");
        if(isPool(_q))setTimeout(function(){ poolLoad(_q); },0);
        paint(list, (lead + (all.length ? all.map(row).join("") : ""))
          || '<div class="sp-seaempty">Nothing on Stellar matches \u201c'+esc(raw)+'\u201d</div>');
      });
    }, SEA_CACHE[q]!==undefined ? 0 : 220);                     // debounce only when we must hit the network
  }
  function isMine(list){ return !!(list.querySelector(".lx-searow")||list.querySelector(".sp-seaempty")); }

  function wire(){
    var inp=document.getElementById("spSearchInput"), list=document.getElementById("spAssetList");
    if(!inp||!list||inp.__lxsea) return;
    inp.__lxsea=1;
    inp.addEventListener("input", render);
    inp.addEventListener("keyup", render);
    // The popup opens with an empty box and the design clears the list as it opens, so nothing would ever
    // ask for the recents. focus fires on open (the design focuses the input); the timed re-asserts cover
    // the design clearing the list a beat later.
    //
    // BOUNDED ON PURPOSE, and this is not a style preference -- it froze the page. Re-asserting the
    // recents from the MutationObserver instead made our paint and the design's clear trigger each other:
    // we paint, that is a childList mutation, the design clears, that is another mutation, we paint. The
    // observer's original guard is "q && ..." for exactly this reason -- no backticks in here, they would
    // close the template literal this script is emitted from. A fixed number of attempts cannot ping-pong.
    inp.addEventListener("focus", function(){ [0,60,180,420].forEach(function(ms){ setTimeout(render,ms); }); });
    // re-assert if the design re-renders its own rows while a query is active
    try{ new MutationObserver(function(){ var q=(inp.value||"").trim(); if(q && !isMine(list)) render(); }).observe(list,{childList:true}); }catch(e){}
  }
  function boot(){ wire(); setTimeout(wire,400); setTimeout(wire,1200); }
  if(document.readyState!=="loading") boot(); else document.addEventListener("DOMContentLoaded",boot);
  // the search popup mounts lazily on some pages; re-wire when the header search button is clicked
  document.addEventListener("click", function(e){ var b=e.target&&e.target.closest&&e.target.closest("#headerSearchBtn,[data-open-search]"); if(b) setTimeout(wire,60); }, true);
  // AUDIT FIX: the bare topbar "Search assets" input (dashboard + other in-app pages) was completely DEAD —
  // it is not the popup's #spSearchInput and nothing ever bound it. Make it a LAUNCHER: focusing (or having
  // typed into) it opens the search popup via the design's own #headerSearchBtn path and forwards the query.
  function launchPopup(seed){
    // some pages (the dashboard) have NO #headerSearchBtn / opener at all — open the overlay directly.
    var btn=document.getElementById("headerSearchBtn")||document.querySelector("[data-open-search]");
    var ov=document.getElementById("searchPopup");
    if(btn){ btn.click(); }
    else if(ov){ ov.style.display="flex"; ov.classList.add("open");
      if(!ov.__lxclose){ ov.__lxclose=1;
        ov.addEventListener("click",function(e){ if(e.target===ov){ ov.style.display="none"; ov.classList.remove("open"); } });
        document.addEventListener("keydown",function(e){ if(e.key==="Escape"&&ov.style.display!=="none"){ ov.style.display="none"; ov.classList.remove("open"); } });
      } }
    setTimeout(function(){ wire(); var si=document.getElementById("spSearchInput");
      if(si){ if(seed){ si.value=seed; try{ si.dispatchEvent(new Event("input",{bubbles:true})); }catch(_){} } try{ si.focus(); }catch(_){} } },90);
  }
  // STRICT structural scope: ONLY the header topbar's .search-box input (the dead one). An earlier version
  // matched ANY input whose placeholder said "search", which hijacked the asset/network pickers inside the
  // Bridge destination, wallet Send, Swap and Create Pool modals — focusing those opened the global search.
  document.addEventListener("focusin", function(e){ var t=e.target;
    if(!t||t.tagName!=="INPUT"||t.id==="spSearchInput"||!t.closest)return;
    var box=t.closest(".search-box"); if(!box||!box.closest(".topbar"))return;          // header search box only
    if(t.closest("#searchPopup,[class*=modal],[class*=dropdown],[class*=menu],[class*=picker],[class*=popup],[role=dialog]"))return;
    var seed=(t.value||"").trim(); try{ t.blur(); }catch(_){ } t.value="";
    launchPopup(seed);
  }, true);
})();</script>`;

const files = fs.readdirSync('.').filter(f => /^lumoscore-.*-(desktop|mobile)\.html$/.test(f));
let n = 0, containers = 0, stripped = 0;
for (const file of files) {
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;
  for (const k of Object.keys(json)) {
    let h = json[k];
    // Strip BEFORE the guard, not after. Pages that no longer carry the search popup were skipped
    // outright, so an lx-searchassets script injected back when they did stayed in the container and kept
    // running -- with whatever VERIFIED list was current at the time. That is landmine #11: the transform
    // is not the code, the container is, and a skipped key is one this transform can never clean. Removing
    // it unconditionally means "not eligible" now also means "left with nothing of ours".
    const had = h.indexOf('<script id="lx-searchassets">') >= 0;
    h = h.replace(/<style id="lx-searchassets-css">[\s\S]*?<\/style>/, '')
         .replace(/<script id="lx-searchassets">[\s\S]*?<\/script>/, '');
    if (h.indexOf('id="spSearchInput"') < 0) {                   // only pages with the search popup
      if (had) { json[k] = h; changed = true; stripped++; }      // but do persist the removal
      continue;
    }
    if (h.indexOf('</head>') >= 0) h = h.replace('</head>', STYLE + '</head>');
    else { const hb = h.lastIndexOf('</body>'); h = h.slice(0, hb) + STYLE + h.slice(hb); }
    // Copy FIRST, offset SECOND. bi is a byte offset into h; rewriting h after taking it leaves bi
    // pointing wherever the old string happened to be -- which spliced our script into the middle of
    // another one and truncated it. Any mutation of h has to happen before the offset is measured.
    h = h.split('placeholder="Search assets"').join('placeholder="Search assets, pools and wallets"');
    h = h.split('<span>Search assets, users, and networks.</span>')
         .join('<span>Search assets, pools and wallets on Stellar.</span>');
    const bi = h.lastIndexOf('</body>'); if (bi < 0) continue;
    json[k] = h.slice(0, bi) + SCRIPT + h.slice(bi);
    changed = true; n++;
  }
  if (changed) {
    containers++;
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
console.log('search assets: injected=' + n + ' keys across ' + containers + ' containers'
  + (stripped ? '  (also removed a stale copy from ' + stripped + ' keys that no longer host the popup)' : ''));
