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
function css(){if(document.getElementById("lx-xsearch-css"))return;var st=document.createElement("style");st.id="lx-xsearch-css";
  st.textContent=".lx-xs-h{padding:14px 18px 6px;font:700 12px/1 inherit;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted,#8b90a0)}"
  +".lx-xs-row{display:flex;align-items:center;gap:12px;padding:10px 18px;color:var(--text,#e8e8ee);text-decoration:none}"
  +".lx-xs-row:hover,.lx-xs-row.sel{background:var(--surface-2,rgba(255,255,255,.05))}"
  +".lx-xs-ic{flex:0 0 30px;width:30px;height:30px;border-radius:50%;background:var(--surface-2,#24242c) center/cover no-repeat;display:flex;align-items:center;justify-content:center;font:700 12px/1 inherit;color:var(--text-muted,#8b90a0)}"
  +".lx-xs-t{flex:1 1 auto;min-width:0}.lx-xs-t b{display:block;font-weight:700;font-size:14px}"
  +".lx-xs-t span{display:block;font-size:12px;color:var(--text-muted,#8b90a0);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
  +".lx-xs-r{flex:0 0 auto;font:12px 'JetBrains Mono',monospace;color:var(--text-muted,#8b90a0)}"
  +".lx-xs-msg{padding:22px 18px;text-align:center;font-size:13px;color:var(--text-muted,#8b90a0)}";
  document.head.appendChild(st);}
// OUR OWN BOX beside the page's list. The page's search watches #spAssetList and repaints its own results over anything
// written there (Stellar's did, 15 times in 6s), so while the networks differ that list is hidden and ours is shown.
function list(){var base=document.getElementById("spAssetList");if(!base)return null;
  var l=document.getElementById("lxXsList");
  if(!l){l=document.createElement("div");l.id="lxXsList";l.className=base.className;l.setAttribute("data-lxnonav","");base.parentNode.insertBefore(l,base.nextSibling);}
  base.style.display="none";l.style.display="";return l;}
function off(){var l=document.getElementById("lxXsList"),base=document.getElementById("spAssetList");if(l)l.style.display="none";if(base)base.style.display="";}
function paint(w,rows,msg){var l=list();if(!l)return;css();
  var h='<div class="lx-xs-h">Assets on '+esc(NAMES[w])+' ('+rows.length+')</div>';
  if(msg){l.innerHTML=h+'<div class="lx-xs-msg">'+esc(msg)+'</div>';return;}
  l.innerHTML=h+rows.map(function(r,i){var ic=r.logo?' style="background-image:url('+esc(r.logo).replace(/[()]/g,"")+')"':"";
    return '<a class="lx-xs-row'+(i===0?" sel":"")+'" href="'+esc(r.href)+'" data-lxnonav=""><span class="lx-xs-ic"'+ic+'>'+(r.logo?"":esc(String(r.code||"?").slice(0,2)))+'</span>'
      +'<span class="lx-xs-t"><b>'+esc(r.code)+'</b><span>'+esc(r.sub||"")+'</span></span><span class="lx-xs-r">'+esc(r.right||"")+'</span></a>';}).join("");}
function getJ(u){return fetch(u,{cache:"no-store"}).then(function(r){if(!r.ok){var e=new Error("http "+r.status);e.st=r.status;throw e;}return r.json();});}
var NEARLIST=null;
function query(w,q){var lq=q.toLowerCase();
  if(w==="stellar"){var qs="search="+encodeURIComponent(q)+"&limit=12";
    return getJ("/lxapi/assetsearch?"+qs).catch(function(e){if(e&&e.st===400)throw e;return getJ("https://api.stellar.expert/explorer/public/asset?"+qs);}).then(function(d){
      var out=[];if(/^xlm|^lumen|^stellar/.test(lq))out.push({code:"XLM",sub:"Stellar native",href:"/trade/stellar",right:"native"});
      ((d&&d._embedded&&d._embedded.records)||[]).forEach(function(x){var p=String(x.asset||"").split("-");if(p.length<2||!p[1])return;var t=x.tomlInfo||{};
        out.push({code:p[0],sub:t.name||t.orgName||x.domain||"",logo:t.image||"",href:"/trade/stellar/"+encodeURIComponent(p[0]+"-"+p[1]),right:short(p[1])});});
      return out;});}
  if(w==="xrpl")return getJ("/lxapi/xrplsearch?q="+encodeURIComponent(q)).then(function(d){
      var out=[];if(/^xrp/.test(lq))out.push({code:"XRP",sub:"XRP Ledger native",href:"/trade/xrpl",right:"native"});
      ((d&&d.rows)||[]).slice(0,12).forEach(function(x){if(!x.i)return;out.push({code:x.n,sub:x.u||x.d||"",href:"/trade/xrpl/"+encodeURIComponent(x.n+"-"+x.i),right:x.d||short(x.i)});});
      return out;});
  return (NEARLIST?Promise.resolve(NEARLIST):getJ("/lxapi/nearmarket").then(function(d){NEARLIST=(d&&d.rows)||[];return NEARLIST;})).then(function(rows){
      var out=[];if(/^w?near/.test(lq))out.push({code:"NEAR",sub:"NEAR native",href:"/trade/near",right:"native"});
      rows.filter(function(x){return [x.n,x.nm,x.i].some(function(v){return String(v||"").toLowerCase().indexOf(lq)>=0;});})
        .sort(function(a,b){return (String(b.n).toLowerCase()===lq)-(String(a.n).toLowerCase()===lq);}).slice(0,12)
        .forEach(function(x){out.push({code:x.n,sub:x.nm||"",logo:/^https?:|^data:image/.test(String(x.logo||""))?x.logo:"",href:"/trade/near/"+encodeURIComponent(x.i),right:short(x.i)});});
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
  if(e.key==="Enter"){var l=list(),a=l&&l.querySelector(".lx-xs-row.sel");if(a){e.preventDefault();e.stopImmediatePropagation();location.href=a.getAttribute("href");}}
  else if(e.key==="ArrowDown"||e.key==="ArrowUp"){var rs=[].slice.call((list()||document).querySelectorAll(".lx-xs-row"));if(!rs.length)return;e.preventDefault();e.stopImmediatePropagation();
    var i=rs.findIndex(function(x){return x.classList.contains("sel");});rs.forEach(function(x){x.classList.remove("sel");});i=e.key==="ArrowDown"?Math.min(rs.length-1,i+1):Math.max(0,i-1);rs[i].classList.add("sel");}},true);
// The page's own search may repaint the list after ours (a late answer for the page's network): put ours back.
setInterval(function(){if(!on()){off();return;}var l=document.getElementById("lxXsList"),base=document.getElementById("spAssetList");if(base&&base.style.display!=="none")base.style.display="none";if(!l)run();},700);
})();
