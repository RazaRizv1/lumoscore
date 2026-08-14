(function(){
if(window.__lxMC)return;window.__lxMC=true;
var CHAINS=/*CHAINS*/;
// Networks offered in the "Choose a network" screen. Only the chains LumosCore actually runs on —
// listing Aptos/Hedera/Starknet/VeChain/World Chain advertised connections that go nowhere.
// CHAINS still defines the others: this controls what is OFFERED, not what the engine understands,
// so an existing session on another chain keeps rendering rather than breaking.
var ORDER=["stellar","xrpl"];
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
  var rows=ORDER.map(function(id){return '<button class="lxw-row" type="button" data-lxnet="'+id+'" data-lxq="'+CHAINS[id].name.toLowerCase()+' '+CHAINS[id].tk.toLowerCase()+'"><span class="lxw-ico lxw-neti"><img src="'+CHAINS[id].logo+'" alt=""></span><span class="lxw-main"><span class="lxw-name">'+CHAINS[id].name+'</span><span class="lxw-wsub">Connect on '+CHAINS[id].name+'</span></span>'+NP_CHEV+'</button>';}).join("");
  // exact same shell as the finalized "wallet" screen: head + search + list
  scr.innerHTML='<div class="lxw-head"><div class="lxw-htitles"><h3 class="lxw-title">Choose a network</h3><p class="lxw-sub">Choose a network to continue</p></div><button class="lxw-close lxw-netx" type="button" aria-label="Close">'+NP_CLOSE+'</button></div>'
   +'<div class="lxw-search">'+NP_SICO+'<input type="text" placeholder="Search networks…" class="lxw-searchin lxw-netsearch"/></div>'
   +'<div class="lxw-list">'+rows+'</div>';
  modal.appendChild(scr);
  scr.querySelector(".lxw-netx").addEventListener("click",function(){var mo=document.querySelector(".lxw-modal");if(mo&&mo.parentNode)mo.parentNode.setAttribute("hidden","");});
  var inp=scr.querySelector(".lxw-netsearch");
  if(inp)inp.addEventListener("input",function(){var q=(this.value||"").trim().toLowerCase();scr.querySelectorAll(".lxw-row").forEach(function(r){r.style.display=(!q||r.getAttribute("data-lxq").indexOf(q)>=0)?"":"none";});});
  scr.querySelectorAll(".lxw-row").forEach(function(r){r.addEventListener("click",function(){var net=r.getAttribute("data-lxnet");applyChain(net);if(window.lxwOpenWallet)window.lxwOpenWallet(net,npHome);});});
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
  // Nothing saved means a visitor who has never connected — and they were being shown the raw Aptos base:
  // "Trending on Aptos", NETWORK Aptos with the Aptos mark, "Petra or Nightly", APT tickers, on a product
  // that only runs on Stellar. The base is an artefact of where these pages came from, never something a
  // user should see, so default to the first offered chain instead of leaving the rebrand unrun.
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
