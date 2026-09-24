(function(){
if(window.__lxMC)return;window.__lxMC=true;
var CHAINS={"aptos":{"name":"Aptos","tk":"APT","logo":"data:image/webp;base64,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"},"hedera":{"name":"Hedera","tk":"HBAR","logo":"data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMzIgMzIiIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNiIgZmlsbD0iIzAwMDAwMCIvPjxwYXRoIGQ9Ik0xMSA5djE0TTIxIDl2MTRNMTAgMTQuNWgxMk0xMCAxNy41aDEyIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMi40IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48L3N2Zz4="},"starknet":{"name":"Starknet","tk":"STRK","logo":"data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMzIgMzIiIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNiIgZmlsbD0iIzBjMGM0ZiIvPjxnIHRyYW5zZm9ybT0icm90YXRlKC0xOCAxNiAxNikiPjxyZWN0IHg9IjciIHk9IjEyIiB3aWR0aD0iMTIiIGhlaWdodD0iMy40IiByeD0iMS43IiBmaWxsPSIjZWM3OTZiIi8+PHJlY3QgeD0iMTEiIHk9IjE3IiB3aWR0aD0iMTIiIGhlaWdodD0iMy40IiByeD0iMS43IiBmaWxsPSIjZmZmIiBvcGFjaXR5PSIwLjg1Ii8+PC9nPjwvc3ZnPg=="},"vechain":{"name":"VeChain","tk":"VET","logo":"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiI+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNiIgZmlsbD0iIzE1QkRGRiIvPjxwYXRoIGZpbGw9IiNGRkYiIGZpbGwtcnVsZT0ibm9uemVybyIgZD0iTTE0LjczOCAyNC43MzRMNy4wNCA5LjA0NmEuMzguMzggMCAwMS4zNC0uNTQ2aDIuNjY4Yy4xNDMgMCAuMjc3LjA4LjM0LjIwNmw1LjYyMiAxMS4zODFjLjUgMS4wMiAxLjk1MSAxLjAyIDIuNDUyIDBsNS42MDQtMTEuMzcyYS4zODIuMzgyIDAgMDEuMzQtLjIwNmguMzMyYy4xOTcgMCAuMzIyLjIwNi4yMzMuMzc2bC03Ljc4IDE1Ljg1Yy0uNTAxIDEuMDItMS45NTEgMS4wMi0yLjQ1MyAweiIvPjwvZz48L3N2Zz4="},"worldchain":{"name":"World Chain","tk":"WLD","logo":"data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMzIgMzIiIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNiIgZmlsbD0iIzAwMDAwMCIvPjxjaXJjbGUgY3g9IjE2IiBjeT0iMTYiIHI9IjcuNiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjEuNyIvPjxlbGxpcHNlIGN4PSIxNiIgY3k9IjE2IiByeD0iMy40IiByeT0iNy42IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMS43Ii8+PHBhdGggZD0iTTguNCAxNmgxNS4yIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMS43Ii8+PC9zdmc+"},"stellar":{"name":"Stellar","tk":"XLM","logo":"data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNiIgZmlsbD0iIzAwMCIvPjxwYXRoIGQ9Ik0yMy4xMyA5LjI5MmwtMi40IDEuMjI0LTExLjU5OCA1LjkwN0E2LjkwOSA2LjkwOSAwIDAxMTkuMzUgOS40OThsMS4zNzQtLjcuMjA1LS4xMDVhOC40MzkgOC40MzkgMCAwMC0xMy4zNzEgNy40NzIgMS41MzUgMS41MzUgMCAwMS0uODM0IDEuNDg0bC0uNzI1LjM3djEuNzI0bDIuMTM0LTEuMDg4LjY5MS0uMzUzLjY4MS0uMzQ3IDEyLjIyNi02LjIzIDEuMzc0LS42OTkgMi44NC0xLjQ0N1Y3Ljg1NkwyMy4xMyA5LjI5MnptMi44MTYgMi4wMTJMMTAuMjAxIDE5LjMybC0xLjM3NC43TDYgMjEuNDYzdjEuNzIzbDIuODA4LTEuNDMgMi40MDEtMS4yMjQgMTEuNjEtNS45MTZhNi45MDkgNi45MDkgMCAwMS0xMC4yMjkgNi45M2wtLjA4NS4wNDUtMS40OS43NmE4LjQzOSA4LjQzOSAwIDAwMTMuMzcyLTcuNDc1IDEuNTM2IDEuNTM2IDAgMDEuODMzLTEuNDgzbC43MjYtLjM3di0xLjcxOHoiIGZpbGw9IiNGRkYiLz48L2c+PC9zdmc+"},"xrpl":{"name":"XRP Ledger","tk":"XRP","logo":"data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNiIgZmlsbD0iIzIzMjkyRiIvPjxwYXRoIGQ9Ik0yMy4wNyA4aDIuODlsLTYuMDE1IDUuOTU3YTUuNjIxIDUuNjIxIDAgMDEtNy44OSAwTDYuMDM1IDhIOC45M2w0LjU3IDQuNTIzYTMuNTU2IDMuNTU2IDAgMDA0Ljk5NiAwTDIzLjA3IDh6TTguODk1IDI0LjU2M0g2bDYuMDU1LTUuOTkzYTUuNjIxIDUuNjIxIDAgMDE3Ljg5IDBMMjYgMjQuNTYyaC0yLjg5NUwxOC41IDIwYTMuNTU2IDMuNTU2IDAgMDAtNC45OTYgMGwtNC42MSA0LjU2M3oiIGZpbGw9IiNGRkYiLz48L2c+PC9zdmc+"}};
// Networks offered in the "Choose a network" screen. Only the chains LumosCore actually runs on —
// listing Aptos/Hedera/Starknet/VeChain/World Chain advertised connections that go nowhere.
// CHAINS still defines the others: this controls what is OFFERED, not what the engine understands,
// so an existing session on another chain keeps rendering rather than breaking.
var ORDER=["stellar","xrpl"];
// Listed, but not yet connectable. The row stayed in the chooser because it says where this is going;
// it was a clickable button reading "Connect on XRP Ledger", which is a promise nothing behind it can
// keep -- picking it switched the chain and then offered a wallet list for a network we do not run.
var SOON={xrpl:1};
var BASE="aptos",cur=BASE,obs=null;
function noswap(node){
  var el=node.nodeType===3?node.parentNode:node;
  while(el){
    if(el.nodeType===1){
      var tn=el.tagName;
      if(tn==="SCRIPT"||tn==="STYLE"||tn==="NOSCRIPT")return true;
      if(el.hasAttribute&&el.hasAttribute("data-lx-noswap"))return true;
      var cn=el.className;
      if(cn&&typeof cn==="string"&&/lxw-|lxns-|lxmc/.test(cn))return true;
    }
    el=el.parentNode;
  }
  return false;
}
function esc(s){return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");}
// swap a subtree/text node from chain fc -> tc (text identity + logos)
function walkSwap(root,fc,tc){
  if(fc===tc||!CHAINS[fc]||!CHAINS[tc])return;
  var f=CHAINS[fc],t=CHAINS[tc];
  var nameRe=new RegExp(esc(f.name),"g"),tkRe=new RegExp("\\b"+esc(f.tk)+"\\b","g");
  function fix(nd){nd.nodeValue=nd.nodeValue.replace(nameRe,t.name).replace(tkRe,t.tk);}
  if(root.nodeType===3){ if(!noswap(root)&&root.nodeValue&&(root.nodeValue.indexOf(f.name)>=0||root.nodeValue.indexOf(f.tk)>=0))fix(root); return; }
  if(root.nodeType!==1)return;
  var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:function(n){
    if(!n.nodeValue||noswap(n))return NodeFilter.FILTER_REJECT;
    return (n.nodeValue.indexOf(f.name)>=0||n.nodeValue.indexOf(f.tk)>=0)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
  }});
  var arr=[],n;while(n=w.nextNode())arr.push(n);arr.forEach(fix);
  var imgs=root.querySelectorAll?root.querySelectorAll("img"):[];
  for(var i=0;i<imgs.length;i++){if(imgs[i].getAttribute("src")===f.logo&&!(imgs[i].closest&&imgs[i].closest("[data-lx-noswap]")))imgs[i].setAttribute("src",t.logo);}
  if(root.tagName==="IMG"&&root.getAttribute("src")===f.logo&&!(root.closest&&root.closest("[data-lx-noswap]")))root.setAttribute("src",t.logo);
}
function guard(fn){if(obs)obs.disconnect();try{fn();}finally{if(obs&&document.body)obs.observe(document.body,{childList:true,subtree:true,characterData:true});}}
function applyChain(to){
  if(!CHAINS[to]||to===cur)return;
  guard(function(){walkSwap(document.body,cur,to);});
  cur=to;try{localStorage.setItem("lumos.chain",to);}catch(_){}
  updSwitcher();try{window.dispatchEvent(new Event("lx-chainchange"));}catch(_){}
}
window.lxSetChain=applyChain;window.lxGetChain=function(){return cur;};
function updSwitcher(){
  var sw=document.getElementById("lxmc");if(!sw)return;
  var nm=sw.querySelector(".lxmc-name");if(nm)nm.textContent=CHAINS[cur].name;
  var lg=sw.querySelector(".lxmc-logo");if(lg)lg.innerHTML='<img src="'+CHAINS[cur].logo+'" alt="">';
  sw.querySelectorAll(".lxmc-opt").forEach(function(o){o.classList.toggle("active",o.getAttribute("data-net")===cur);});
}
function buildSwitcher(){
  if(document.getElementById("lxmc"))return;
  var host=document.querySelector(".lx-topwallet");
  var bar=host?host.parentNode:(document.querySelector(".topbar-right")||document.querySelector(".ah-right"));
  if(!bar)return;
  var sw=document.createElement("div");sw.id="lxmc";sw.className="lxmc";sw.setAttribute("data-lx-noswap","");
  var opts=ORDER.map(function(id){return '<button class="lxmc-opt" type="button" data-net="'+id+'"><span class="lxmc-ol"><img src="'+CHAINS[id].logo+'" alt=""></span>'+CHAINS[id].name+'</button>';}).join("");
  sw.innerHTML='<button class="lxmc-trig" type="button"><span class="lxmc-logo"></span><span class="lxmc-name"></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></button><div class="lxmc-menu" hidden>'+opts+'</div>';
  if(host)bar.insertBefore(sw,host);else bar.appendChild(sw);
  sw.querySelector(".lxmc-trig").addEventListener("click",function(e){e.stopPropagation();sw.querySelector(".lxmc-menu").toggleAttribute("hidden");});
  sw.querySelectorAll(".lxmc-opt").forEach(function(o){o.addEventListener("click",function(e){e.stopPropagation();applyChain(o.getAttribute("data-net"));sw.querySelector(".lxmc-menu").setAttribute("hidden","");});});
  document.addEventListener("click",function(){var m=sw.querySelector(".lxmc-menu");if(m)m.setAttribute("hidden","");});
  updSwitcher();
}
// "Choose a network" step — a screen INSIDE the existing .lxw connect modal (same design as the
// wallet list), shown before the wallet step. Pick network -> that network's wallet list.
var npHome=null;
function showScr(name){var s=document.querySelectorAll(".lxw-screen");for(var i=0;i<s.length;i++)s[i].toggleAttribute("hidden",s[i].getAttribute("data-screen")!==name);}
var NP_CLOSE='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
var NP_SICO='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
var NP_CHEV='<svg class="lxw-wchev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
function injectNetScreen(){
  var modal=document.querySelector(".lxw-modal");if(!modal)return false;
  if(modal.querySelector('.lxw-screen[data-screen="network"]'))return true;
  var scr=document.createElement("div");scr.className="lxw-screen";scr.setAttribute("data-screen","network");scr.setAttribute("data-lx-noswap","");
  var rows=ORDER.map(function(id){
    var soon=!!SOON[id], q=CHAINS[id].name.toLowerCase()+' '+CHAINS[id].tk.toLowerCase();
    var body='<span class="lxw-ico lxw-neti"><img src="'+CHAINS[id].logo+'" alt=""></span>'
      +'<span class="lxw-main"><span class="lxw-name">'+CHAINS[id].name+'</span>'
      +'<span class="lxw-wsub">'+(soon?'Support is on the way':('Connect on '+CHAINS[id].name))+'</span></span>'
      // data-lxc + data-logoed + a zero-size svg: the same three guards the token page's chooser uses.
      // A two-word tag is short enough for the logo healer to read as a ticker and paint over.
      +(soon?('<span class="lxw-soon-tag" data-lxc="" data-logoed="1"><svg width="0" height="0" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden"></svg>Next up</span>'):NP_CHEV);
    // A div, not a disabled button: a disabled button still looks like a control that failed, and it
    // drops out of the tab order in a way that reads as broken rather than as not-yet.
    return soon
      ? '<div class="lxw-row lxw-soon" data-lxnet="'+id+'" data-lxq="'+q+'" aria-disabled="true">'+body+'</div>'
      : '<button class="lxw-row" type="button" data-lxnet="'+id+'" data-lxq="'+q+'">'+body+'</button>';
  }).join("");
  // exact same shell as the finalized "wallet" screen: head + search + list
  scr.innerHTML='<div class="lxw-head"><div class="lxw-htitles"><h3 class="lxw-title">Choose a network</h3><p class="lxw-sub">Choose a network to continue</p></div><button class="lxw-close lxw-netx" type="button" aria-label="Close">'+NP_CLOSE+'</button></div>'
   +'<div class="lxw-search">'+NP_SICO+'<input type="text" placeholder="Search networks…" class="lxw-searchin lxw-netsearch"/></div>'
   +'<div class="lxw-list">'+rows+'</div>';
  modal.appendChild(scr);
  scr.querySelector(".lxw-netx").addEventListener("click",function(){var mo=document.querySelector(".lxw-modal");if(mo&&mo.parentNode)mo.parentNode.setAttribute("hidden","");});
  var inp=scr.querySelector(".lxw-netsearch");
  if(inp)inp.addEventListener("input",function(){var q=(this.value||"").trim().toLowerCase();scr.querySelectorAll(".lxw-row").forEach(function(r){r.style.display=(!q||r.getAttribute("data-lxq").indexOf(q)>=0)?"":"none";});});
  // :not(.lxw-soon) — the coming-soon rows are deliberately inert. Filtering here rather than
  // returning early inside the handler means there is no listener at all, so nothing to misfire.
  scr.querySelectorAll(".lxw-row:not(.lxw-soon)").forEach(function(r){r.addEventListener("click",function(){var net=r.getAttribute("data-lxnet");applyChain(net);if(window.lxwOpenWallet)window.lxwOpenWallet(net,npHome);});});
  if(!document.getElementById("lxw-soon-css")){
    var st=document.createElement("style"); st.id="lxw-soon-css";
    st.textContent='.lxw-row.lxw-soon{cursor:default;opacity:.62}'
      +'.lxw-row.lxw-soon:hover{background:inherit;border-color:inherit;transform:none}'
      +'.lxw-soon-tag{margin-left:auto;flex:0 0 auto;padding:3px 9px;border-radius:99px;'
      +'background:var(--surface-2,#f4f5f7);color:var(--text-muted,#8a8fa3);'
      +'font:700 10px/1.4 "Hanken Grotesk",system-ui,sans-serif;text-transform:uppercase;'
      +'letter-spacing:.05em;white-space:nowrap}'
      +'.lxw-soon-tag>svg{width:0!important;height:0!important;position:absolute!important}';
    document.head.appendChild(st);
  }
  return true;
}
function chooseNetwork(home){
  npHome=home||null;
  if(window.lxwOpenWallet)window.lxwOpenWallet(cur,npHome);
  if(injectNetScreen())showScr("network");
  else setTimeout(function(){if(injectNetScreen())showScr("network");},60);
}
window.lxChooseNetwork=chooseNetwork;
// keep newly-rendered (base-identity) content in sync with the active chain
function startObserver(){
  if(obs||!document.body)return;
  obs=new MutationObserver(function(muts){
    if(cur===BASE)return;
    guard(function(){
      for(var j=0;j<muts.length;j++){var m=muts[j];
        for(var i=0;i<m.addedNodes.length;i++)walkSwap(m.addedNodes[i],BASE,cur);
        if(m.type==="characterData"&&m.target)walkSwap(m.target,BASE,cur);
      }
    });
  });
  obs.observe(document.body,{childList:true,subtree:true,characterData:true});
}
function reskin(){ if(cur!==BASE) guard(function(){walkSwap(document.body,BASE,cur);}); } // catch anything rendered late
function boot(){
  // No in-app network switcher: the network is chosen at connect time (Choose a network -> wallet).
  // To change networks the user disconnects and reconnects on another network. We still re-skin the
  // app to whichever network was connected (via the saved lumos.chain), but show no topbar dropdown.
  startObserver();
  var saved=null;try{saved=localStorage.getItem("lumos.chain");}catch(_){}
  // Nothing saved means a visitor who has never connected — and they were being shown the raw Aptos
  // base: "Trending on Stellar", NETWORK Aptos with the Aptos mark, "Petra or Nightly", APT tickers, on
  // a product that only runs on Stellar. The base is an artefact of where these pages came from, never
  // something a user should see, so default to the first offered chain instead of leaving it unrun.
  if(!saved||!CHAINS[saved]) saved=ORDER[0];
  try{ if(saved&&CHAINS[saved]&&saved!==cur)applyChain(saved); }catch(_){}
  // Signal that the initial rebrand is done. A TARGETED CSS gate (in _multichain.js) hides ONLY the
  // small network logo/name elements until now — NOT the whole body (that blanked heavy pages).
  // Added unconditionally (incl. aptos/no-saved) so those elements always reveal.
  try{document.documentElement.classList.add("lx-chainready");}catch(_){}
  setTimeout(reskin,300);setTimeout(reskin,1200);setTimeout(reskin,3000);
  window.addEventListener("load",reskin);
}
if(document.readyState!=="loading")boot();else document.addEventListener("DOMContentLoaded",boot);
})();
