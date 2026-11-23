// HEADER SEARCH FOLLOWS THE CONNECTED WALLET (RAZA 2026-11-24: "Im connected to Stellar but im viewing near page. i just
// opened search so it should have opened stellar search since im connected to stellar but its opening near search").
// Loaded on EVERY page by the middleware (<script id="lx-xsearch"> in <head>, so it registers before the page's own
// search). When the wallet's network (from its address: G... Stellar, r... XRPL, otherwise NEAR) differs from the
// page's (from the path, else the lx_chain cookie), it claims the search box's input/keyup/Enter/arrows, searches the
// WALLET's network and links to that network's pages:
//   Stellar /lxapi/assetsearch (stellar.expert direct if refused) -> /trade/stellar/CODE-ISSUER
//   XRPL    /lxapi/xrplsearch -> /trade/xrpl/CODE-ISSUER      NEAR /lxapi/nearmarket -> /trade/near/<contract>
// Results go in its own box (#lxXsList) beside #spAssetList, which is hidden meanwhile: the page's search repaints
// that list over anything else written there. Same network (or no wallet): nothing here runs.
(function(){
if(window.__lxXs)return;window.__lxXs=1;
var NAMES={stellar:"Stellar",xrpl:"XRPL",near:"NEAR"};
function walletNet(){var a="";try{a=localStorage.getItem("lumos.address")||"";}catch(e){}
  if(!a)return "";if(/^G[A-Z2-7]{55}$/.test(a))return "stellar";if(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(a))return "xrpl";
  if(/^[a-z0-9._-]{2,64}$/.test(a))return "near";return "";}
function pageNet(){var s=(location.pathname||"").toLowerCase().split("/");for(var i=0;i<s.length;i++){if(s[i]==="xrpl"||s[i]==="near"||s[i]==="stellar")return s[i];}
  var m=/(?:^|; )lx_chain=([a-z]+)/.exec(document.cookie||"");return (m&&NAMES[m[1]])?m[1]:"stellar";}
function on(){var w=walletNet();return w&&w!==pageNet()?w:"";}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];});}
function short(a){a=String(a||"");return a.length>14?a.slice(0,5)+"…"+a.slice(-4):a;}
// THE DESIGN'S OWN LOOK (RAZA 2026-11-24: "the text appears bigger than it was before"). The heading, rows and empty
// message use the search popup's own markup and classes (.sp-section-head h4 + .count, .sp-row/.sp-ico/.sp-info,
// .sp-seaempty), so they read exactly like the page's search. Only the selected-row tint is ours.
function css(){if(document.getElementById("lx-xsearch-css"))return;var st=document.createElement("style");st.id="lx-xsearch-css";
  st.textContent="#lxXsList .sp-row.lx-xs-sel{background:var(--surface-2,rgba(255,255,255,.05))}#lxXsList .sp-ico img{width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block}#lxXsList a.sp-row,#lxXsList a.sp-row:hover{color:inherit;text-decoration:none}#lxXsList .sp-info{min-width:0}#lxXsList .sp-name-row{display:flex;align-items:center;gap:6px;min-width:0;white-space:nowrap}#lxXsList .lx-vtick,#lxXsList .lx-unsafetag{flex-shrink:0}#lxXsList .sp-domain{min-width:0;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}";
  document.head.appendChild(st);}
// OUR OWN BOX beside the page's list. The page's search watches #spAssetList (and its heading count) and repaints its own
// results over anything written there (Stellar's did, 15 times in 6s), so while the networks differ the page's heading
// and list are hidden and ours, built from the same design markup, are shown.
function head(){var b=document.getElementById("spAssetList");var p=b&&b.parentNode;return p?p.querySelector(".sp-section-head"):null;}
function list(){var base=document.getElementById("spAssetList");if(!base)return null;
  var l=document.getElementById("lxXsList");
  if(!l){l=document.createElement("div");l.id="lxXsList";l.setAttribute("data-lxnonav","");var h=head();(h||base).parentNode.insertBefore(l,h||base);}
  base.style.display="none";var hh=head();if(hh)hh.style.display="none";var f=document.getElementById("spFilters");if(f)f.style.display="none";l.style.display="";return l;}
function off(){var l=document.getElementById("lxXsList"),base=document.getElementById("spAssetList"),hh=head(),f=document.getElementById("spFilters");
  if(l)l.style.display="none";if(base)base.style.display="";if(hh)hh.style.display="";if(f)f.style.display="";}
function paint(w,rows,msg){var l=list();if(!l)return;css();
  var h='<div class="sp-section-head"><h4>Assets on '+esc(NAMES[w])+' <span class="count">('+rows.length+')</span></h4></div>';
  if(msg){l.innerHTML=h+'<div class="sp-seaempty">'+esc(msg)+'</div>';return;}
  l.innerHTML=h+rows.map(function(r,i){
    var ico=r.logo?'<img alt="" src="'+esc(r.logo)+'">':esc(String(r.code||"?").slice(0,2).toUpperCase());
    // Same badges as the page's own search: the verified tick, the "Not the real X" warning on a look-alike of a
    // verified asset, and the domain chip; under it the name and holders.
    var badges=(r.verified?TICK:"")+(r.fake?'<span class="lx-unsafetag" title="A verified '+esc(r.code)+' exists with a different issuer. This one is not it.">'+WARN+'Not the real '+esc(r.code)+'</span>':"")
      +(r.domain?'<span class="sp-domain">'+esc(r.domain)+'</span>':"");
    var sub=[r.sub||"",r.holders>0?(abbr(r.holders)+" holders"):""].filter(Boolean).join(" · ");
    return '<a class="sp-row sp-row--asset'+(i===0?" lx-xs-sel":"")+'" href="'+esc(r.href)+'" data-lxnonav=""><div class="sp-ico">'+ico+'</div>'
      +'<div class="sp-info"><div class="sp-name-row">'+esc(r.code)+badges+'</div><div class="sp-sub">'+esc(sub)+'</div></div>'
      +'<div class="sp-right"><div class="sp-addr-mini">'+esc(r.right||"")+'</div></div></a>';}).join("");}
var TICK='<span class="lx-vtick" title="Verified"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>';
var WARN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
function abbr(n){n=+n||0;if(n>=1e6)return (n/1e6).toFixed(1)+"M";if(n>=1e3)return (n/1e3).toFixed(1)+"K";return String(Math.round(n));}
function host(u){var m=/^https?:[/][/]([^/?#]+)/i.exec(String(u||""));return m?m[1].replace(/^www[.]/,""):"";}
// A look-alike: not verified itself, while a VERIFIED asset with the same code (and another issuer) exists.
function markFakes(out,verifiedCodes){out.forEach(function(r){if(!r.verified&&r.code&&verifiedCodes[String(r.code).toUpperCase()])r.fake=1;});return out;}
var VMAP=null;
function stellarVerified(){return VMAP?Promise.resolve(VMAP):getJ("/lxapi/assetmeta").then(function(d){VMAP=(d&&d.verified)||{};return VMAP;},function(){return {};});}
function getJ(u){return fetch(u,{cache:"no-store"}).then(function(r){if(!r.ok){var e=new Error("http "+r.status);e.st=r.status;throw e;}return r.json();});}
var NEARLIST=null;
function query(w,q){var lq=q.toLowerCase();
  if(w==="stellar"){var qs="search="+encodeURIComponent(q)+"&limit=12";
    var found=getJ("/lxapi/assetsearch?"+qs).catch(function(e){if(e&&e.st===400)throw e;return getJ("https://api.stellar.expert/explorer/public/asset?"+qs);});
    return Promise.all([found,stellarVerified()]).then(function(a){var d=a[0],V=a[1]||{},vcodes={};
      Object.keys(V).forEach(function(k){if(V[k]&&V[k].v)vcodes[k.split("-")[0].toUpperCase()]=1;});
      var out=[];if(/^xlm|^lumen|^stellar/.test(lq))out.push({code:"XLM",sub:"Stellar native",href:"/trade/stellar",right:"native",verified:1});
      ((d&&d._embedded&&d._embedded.records)||[]).forEach(function(x){var p=String(x.asset||"").split("-");if(p.length<2||!p[1])return;var t=x.tomlInfo||{},key=p[0]+"-"+p[1];
        out.push({code:p[0],sub:t.name||t.orgName||"",logo:t.image||"",href:"/trade/stellar/"+encodeURIComponent(key),right:short(p[1]),
          verified:!!(V[key]&&V[key].v),domain:x.domain||"",holders:x.trustlines&&x.trustlines.funded});});
      return markFakes(out,vcodes);});}
  if(w==="xrpl")return getJ("/lxapi/xrplsearch?q="+encodeURIComponent(q)).then(function(d){
      var out=[],vcodes={};if(/^xrp/.test(lq))out.push({code:"XRP",sub:"XRP Ledger native",href:"/trade/xrpl",right:"native",verified:1});
      ((d&&d.rows)||[]).slice(0,12).forEach(function(x){if(!x.i)return;if(x.vf)vcodes[String(x.n).toUpperCase()]=1;
        out.push({code:x.n,sub:x.u||"",href:"/trade/xrpl/"+encodeURIComponent(x.n+"-"+x.i),right:short(x.i),verified:!!x.vf,domain:x.d||"",holders:x.h});});
      return markFakes(out,vcodes);});
  return (NEARLIST?Promise.resolve(NEARLIST):getJ("/lxapi/nearmarket").then(function(d){NEARLIST=(d&&d.rows)||[];return NEARLIST;})).then(function(rows){
      var out=[];if(/^w?near/.test(lq))out.push({code:"NEAR",sub:"NEAR native",href:"/trade/near",right:"native",verified:1});
      rows.filter(function(x){return [x.n,x.nm,x.i].some(function(v){return String(v||"").toLowerCase().indexOf(lq)>=0;});})
        .sort(function(a,b){return (String(b.n).toLowerCase()===lq)-(String(a.n).toLowerCase()===lq);}).slice(0,12)
        .forEach(function(x){out.push({code:x.n,sub:x.nm&&x.nm!==x.n?x.nm:"",logo:/^https?:|^data:image/.test(String(x.logo||""))?x.logo:"",href:"/trade/near/"+encodeURIComponent(x.i),
          right:short(x.i),verified:!!x.vf,domain:host(x.w),holders:x.hc});});
      return out;});}
var tmr=0,seq=0;
function run(){var w=on();if(!w)return;var inp=document.getElementById("spSearchInput");if(!inp)return;var q=String(inp.value||"").trim();var my=++seq;
  if(q.length<2){paint(w,[],"Type to search "+NAMES[w]+" — your wallet is on "+NAMES[w]+".");return;}
  paint(w,[],"Searching "+NAMES[w]+"…");
  query(w,q).then(function(rows){if(my!==seq)return;paint(w,rows,rows.length?"":"No "+NAMES[w]+" asset matches that.");},
    function(){if(my!==seq)return;paint(w,[],"Search is unavailable right now. Try again in a moment.");});}
// Claimed at window capture, ahead of the page's own search (registered later), and only while the wallet's network
// differs from the page's. Otherwise nothing here runs and the page's search is untouched.
window.addEventListener("input",function(e){if(!e.target||e.target.id!=="spSearchInput"||!on())return;e.stopImmediatePropagation();clearTimeout(tmr);tmr=setTimeout(run,250);},true);
// Stellar's search renders on keyup, not input: claimed the same way.
window.addEventListener("keyup",function(e){if(e.target&&e.target.id==="spSearchInput"&&on())e.stopImmediatePropagation();},true);
window.addEventListener("focusin",function(e){if(e.target&&e.target.id==="spSearchInput"&&on())setTimeout(run,60);},true);
window.addEventListener("keydown",function(e){if(!e.target||e.target.id!=="spSearchInput"||!on())return;
  if(e.key==="Enter"){var l=list(),a=l&&l.querySelector(".sp-row.lx-xs-sel");if(a){e.preventDefault();e.stopImmediatePropagation();location.href=a.getAttribute("href");}}
  else if(e.key==="ArrowDown"||e.key==="ArrowUp"){var rs=[].slice.call((list()||document).querySelectorAll(".sp-row"));if(!rs.length)return;e.preventDefault();e.stopImmediatePropagation();
    var i=rs.findIndex(function(x){return x.classList.contains("lx-xs-sel");});rs.forEach(function(x){x.classList.remove("lx-xs-sel");});i=e.key==="ArrowDown"?Math.min(rs.length-1,i+1):Math.max(0,i-1);rs[i].classList.add("lx-xs-sel");}},true);
// The page's own search may repaint the list after ours (a late answer for the page's network): put ours back.
setInterval(function(){if(!on()){off();return;}var l=document.getElementById("lxXsList"),base=document.getElementById("spAssetList");if(base&&base.style.display!=="none")base.style.display="none";if(!l)run();},700);
})();
