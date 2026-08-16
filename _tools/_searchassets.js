// Search: replace the mock asset results (LUMOS/CELL/... Aptos placeholders) with the real
// TESTNET tokens minted via Launchpad, each linking to the Asset Overview page. Read-only.
// The design filters a hardcoded `Assets` array into #spAssetList; we override the render so only
// real mainnet assets show, and rows are <a href=dex-asset?asset=CODE-ISSUER> (the nav
// resolver respects a[href], so clicking opens the asset page rather than the Trade page).
const fs = require('fs');
const { read, getContents, VERIFIED } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const STYLE = `<style id="lx-searchassets-css">
.lx-poolico{width:36px;height:36px;display:inline-flex;align-items:center;justify-content:center;overflow:visible;background:none;flex-shrink:0}
.lx-poolico .lx-pi{width:24px;height:24px;border-radius:50%;display:block;object-fit:cover;border:2px solid var(--surface,#131317);background:var(--surface-2);position:relative}
.lx-poolico .lx-pi-a{z-index:2}
.lx-poolico .lx-pi-b{margin-left:-12px}
.sp-row--asset.lx-searow{text-decoration:none;color:inherit}
.sp-row--asset.lx-searow .sp-ico{display:grid;place-items:center;color:#fff;font-weight:800;font-family:'JetBrains Mono',monospace;overflow:hidden}
.sp-row--asset.lx-searow .sp-ico img{display:block}
.sp-seaempty{padding:20px 14px;text-align:center;color:var(--text-muted);font-size:13px}
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
      '<div class="sp-info"><div class="sp-name-row">'+esc(t.name||t.code)+(VFD[t.code+"|"+t.issuer]?VTICK:"")+' <span class="sp-domain">'+esc(t.domain||"Stellar mainnet")+'</span></div>'+
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
    var im=box.querySelector(which==="a"?".lx-pi-a":".lx-pi-b"); if(im&&src)im.src=src;
  }
  // by ISSUER, never by ticker: a ticker search is score-ranked and small assets are unreachable in it
  function poolIcoLoad(id,which,code,issuer){
    if(code==="XLM"||!issuer){ poolIcoSet(id,which,code==="XLM"?LXSTELLAR:avatarUri(code)); return; }
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
    fetch("https://horizon.stellar.org/liquidity_pools/"+id).then(function(r){ return r.ok?r.json():null; }).then(function(d){
      if(!d){ POOLI[id]={n:null,tvl:null}; poolFill(id); return; }
      var sides=(d.reserves||[]).map(function(rv){
        if(rv.asset==="native")return {c:"XLM",i:"",a:+rv.amount};
        var pr=rv.asset.split(":"); return {c:(pr[0]||"?"),i:(pr[1]||""),a:+rv.amount}; });
      var nat=null; for(var i=0;i<sides.length;i++)if(sides[i].c==="XLM")nat=sides[i];
      POOLI[id]={ pair:sides.map(function(x){return x.c;}).join(" / "),
        n:(d.total_trustlines!=null?+d.total_trustlines:null),
        tvl:(nat&&xu>0)?(nat.a*2*xu):null };
      poolFill(id);
      if(sides[0])poolIcoLoad(id,"a",sides[0].c,sides[0].i);
      if(sides[1])poolIcoLoad(id,"b",sides[1].c,sides[1].i);
    }).catch(function(){ POOLI[id]={n:null,tvl:null}; poolFill(id); });
  }
  function poolRow(id){
    var ico='<div class="sp-ico lx-spico-on lx-poolico" data-pool="'+esc(id)+'" >'
      +'<img class="lx-pi lx-pi-a" alt="">'+'<img class="lx-pi lx-pi-b" alt="">'+'</div>';
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
  function seaFetch(q,cb){
    if(SEA_CACHE[q]) { cb(SEA_CACHE[q]); return; }
    fetch("https://api.stellar.expert/explorer/public/asset?search="+encodeURIComponent(q)+"&limit=12")
      .then(function(r){ return r.json(); })
      .then(function(d){
        var recs=(d&&d._embedded&&d._embedded.records)||[];
        var out=recs.map(function(x){
          var id=String(x.asset||""), p=id.split("-");
          var ti=x.tomlInfo||{};
          return {code:p[0]||"", issuer:p[1]||"", name:ti.name||"", domain:x.domain||"",
                  tl:(x.trustlines&&x.trustlines[0])||0, img:ti.image||ti.orgLogo||""};
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
    if(!q){ return; }                       // empty -> let the design clear the list
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
        if(remote===null){ paint(list,'<div class="sp-seaempty">Couldn\u2019t reach the asset index \u2014 check your connection.</div>'); return; }
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
let n = 0, containers = 0;
for (const file of files) {
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;
  for (const k of Object.keys(json)) {
    let h = json[k];
    if (h.indexOf('id="spSearchInput"') < 0) continue;           // only pages with the search popup
    h = h.replace(/<style id="lx-searchassets-css">[\s\S]*?<\/style>/, '')
         .replace(/<script id="lx-searchassets">[\s\S]*?<\/script>/, '');
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
console.log('search assets: injected=' + n + ' keys across ' + containers + ' containers');
