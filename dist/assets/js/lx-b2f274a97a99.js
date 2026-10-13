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
// XRPL IS LIVE (2026-10-01). It was listed here as coming-soon because the row was otherwise a
// clickable button reading "Connect on XRP Ledger", which is a promise nothing behind it can keep.
// There is now a complete XRPL build served from the same host under /<section>/xrpl, so the promise
// is keepable and the row is a real one. Anything added here later gets the inert treatment again.
// SUBSTITUTED AT BUILD TIME by _multichain.js from LX_XRPL_PUBLIC, because whether XRPL is offered
// here is a fact about the DEPLOY and not about the code.
//
// This was hardcoded to {} on 2026-10-01 with the note above -- "there is now a complete XRPL build
// served from the same host under /<section>/xrpl, so the promise is keepable". True of the COMBINED
// build. The Stellar-only production deploy carries no XRPL pages at all, so on lumoscore.com the row
// was a clickable button reading "Connect on XRP Ledger" that landed on /trade/xrpl -- a 404. Exactly
// the promise the original comment said not to make, reintroduced by assuming every deploy is the
// combined one.
//
// RAZA, minutes after the 2026-10-13 release: "When i click launch app -> XRPL : it take me to
// trade/xrpl and also shows 404". Same root as the six dead hub links fixed earlier that day, in a
// chooser that fix did not reach -- _lumosparent.js owns the hub pages, this owns the Launch App
// modal, and they had to be found separately.
var SOON={"xrpl":1};

// WHERE A CHAIN LIVES. Stellar and XRPL are two BUILDS sharing one host: Stellar owns the bare routes
// (/dashboard, /wallet) and the /stellar-suffixed ones, XRPL owns /<section>/xrpl. So changing chain
// is a NAVIGATION and not a re-skin — walkSwap would repaint Stellar's dashboard in XRPL colours
// while every figure on it stayed Stellar's, which is worse than doing nothing because it looks like
// it worked.
//
// The section is kept wherever both chains have one, so switching from Stellar's pools lands on
// XRPL's pools rather than dumping the reader at a dashboard. Anything unrecognised falls back to the
// dashboard, which always exists on both.
//
// SECTION IN, WHOLE PATH OUT, and every value below is a literal route out of the other chain's
// _redirects. Two flat tables rather than one rule with a suffix, because neither chain's url scheme is
// derivable from the other's: Stellar serves /trade/stellar but /dashboard bare and /launchpad/review
// bare, while XRPL qualifies all of them.
//
// THE PATH TAIL IS DROPPED ON PURPOSE. This used to append it — '/'+sec+'/xrpl'+rest — which turned
// /trade/stellar/USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN into
// /trade/xrpl/USDC-GA5ZSEJ…, an XRPL trade page asked for a Stellar asset. The reader gets an empty
// page and no reason for it, which is worse than landing one level up. The same held for a pool id, an
// account address and a launchpad draft mid-flow: an identifier belongs to ONE ledger, and the section
// is the only part of the url the two chains genuinely share.
//
// account appears in neither table. Both chains serve only /account/<chain>/:address — there is no
// chain-level account page to land on, and an address from the other ledger is not one.
// The chain THIS build actually serves, and therefore the only one whose wallet list it can drive.
// Everything else is a hand-off to the other build.
var LOCAL_CHAIN='stellar';
// THE AUTHGATED SECTIONS ARE IN NEITHER TABLE — dashboard and wallet. They are ONE url each,
// served to whichever chain the reader is connected to, so "switch chain" there is not a
// navigation to a different path and cannot be expressed here.
//
// THE LAUNCHPAD IS NOW IN BOTH TABLES (2026-10-10). It used to belong to the group above — one shared
// url, chain chosen by the lx_chain cookie — and it left for the reason the cookie exists at all: that
// arrangement suits a PRIVATE page, and the launchpad is now public, indexed, and fronted by a network
// chooser at the bare /launchpad. A url cannot be both the chooser and one of the choices, so with
// lx_chain=xrpl the middleware served the XRPL file, which has no chooser in it, and the hub became
// unreachable for anyone who had ever picked XRPL. It now has a real url per chain like every other
// section, so switching chain on it is an ordinary navigation and belongs here.
//
// Nor should it be. Those pages show the connected wallet's own data, and you cannot be on the other
// chain's dashboard without a wallet on that chain — re-serving it would only put the reader in front
// of the gate. Falling through to that chain's trade page sends them somewhere public where they can
// connect, which is the step they actually need. chainFromPath benefits from the same omission: a bare
// /dashboard genuinely does not name a chain any more, so it correctly defers to the saved one.
var TO_XRPL={trade:'/trade/xrpl',pools:'/pools/xrpl',bridge:'/bridge/xrpl',rewards:'/rewards/xrpl',
  lumos:'/lumos/xrpl',mcp:'/mcp/xrpl','list-your-token':'/list-your-token/xrpl',
  launchpad:'/launchpad/xrpl'};
var TO_STELLAR={trade:'/trade/stellar',pools:'/pools/stellar',bridge:'/bridge/stellar',
  rewards:'/rewards/stellar',lumos:'/lumos/stellar',mcp:'/mcp','list-your-token':'/list-your-token',
  launchpad:'/launchpad/stellar'};
// THE FALLBACK MUST BE A PUBLIC PAGE, and that is the whole reason it is not the dashboard.
//
// This is the branch the LANDING PAGE takes. "Choose a network" calls applyChain(net) from "/", which
// has no section, so every visitor who picks a network from the front door arrives here. It used to
// answer /dashboard/xrpl — and the dashboard carries lx-authgate, which does location.replace("/") when
// there is no lumos.wallet. An unconnected visitor is exactly who is choosing a network, so picking
// XRP Ledger navigated to the dashboard, got bounced straight back to the landing page, and looked like
// a dead button. Confirmed rather than guessed: after the click document.referrer was
// ".../dashboard/xrpl" while location.pathname was "/".
//
// The trade page is public on both chains, so the hand-off lands somewhere real and that build's own
// connect modal takes it from there. Same trap _xrplchoosenet.js was rewritten to avoid; it reappeared
// here because this is a different call site that happens to resolve to the same gated page.
function chainHref(to){
  var p=(location.pathname||'/').replace(/\/+$/,'');
  var m=p.match(/^\/([a-z-]+)/);
  var sec=m&&m[1];
  if(to==='xrpl') return (sec&&TO_XRPL[sec])||'/trade/xrpl';
  return (sec&&TO_STELLAR[sec])||'/trade/stellar';
}
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
// WHICH CHAIN THIS URL IS, read from the url rather than from storage. Returns null when the url does
// not say, which is the only case where the saved preference gets to decide.
//
// The rule is one invariant: EVERY XRPL ROUTE CARRIES /xrpl. So a chain segment settles it outright,
// and a known section reached WITHOUT one can only be Stellar's — whether Stellar serves that section
// bare only (/dashboard, /wallet) or both ways (/launchpad and /launchpad/stellar are the same page).
//
// Testing the target for a '/stellar' suffix instead, as the first version did, got /launchpad wrong:
// Stellar serves it bare too, so the url was reported as saying nothing and fell through to the stored
// preference — leaving Stellar's launchpad skinned as the XRP Ledger for anyone whose last visit was
// XRPL. A page from one chain wearing the other's name is the failure this whole function exists to
// prevent, so it must not have a gap in it.
//
// null means the url genuinely names no chain — "/", /about, /blog — where the saved value may decide.
function chainFromPath(){
  var p=(location.pathname||'/').replace(/\/+$/,'');
  if(/\/xrpl(\/|$)/.test(p))return 'xrpl';
  if(/\/stellar(\/|$)/.test(p))return 'stellar';
  var m=p.match(/^\/([a-z-]+)/);
  return (m&&TO_STELLAR[m[1]])?'stellar':null;
}
// RE-SKIN ONLY. What boot needs, and all it ever needed: adopt a chain for rendering without moving the
// reader anywhere.
function adoptChain(to){
  if(!CHAINS[to]||to===cur)return;
  cur=to;
  guard(function(){walkSwap(document.body,cur,to);});
  updSwitcher();try{window.dispatchEvent(new Event("lx-chainchange"));}catch(_){}
}
// A DELIBERATE SWITCH — the switcher, the network chooser. This one navigates.
function applyChain(to){
  if(!CHAINS[to]||to===cur)return;
  // Recorded BEFORE leaving, so the page that loads on the other side already knows which network it
  // is on rather than reading the old value and correcting itself visibly.
  try{localStorage.setItem("lumos.chain",to);}catch(_){}
  // NAVIGATE, do not repaint. Each chain is a separate build on this host with its own urls — see
  // chainHref. walkSwap remains for anything that really is one page in two liveries; a dashboard
  // whose every figure comes from a different ledger is not that.
  var href=chainHref(to);
  if(href&&href!==location.pathname){ try{location.assign(href);}catch(_){location.href=href;} return; }
  adoptChain(to);
}
window.lxSetChain=applyChain;window.lxGetChain=function(){return cur;};
// RE-SKIN WITHOUT MOVING ANYONE. applyChain is a navigation, so a caller that only needs the page to
// wear the right chain -- picking Stellar in the network chooser, where the next step is the wallet
// list on this very page -- must have something else to call. Without this the only exported way to
// change chain was the one that leaves, and the chooser used it. See the Stellar branch of the
// network-row handler in _wallet_realconnect.js.
window.lxAdoptChain=adoptChain;
// Exposed so a hand-off can work out WHERE the other chain is without going through applyChain, whose
// to===cur guard is there for re-skinning and is wrong for navigation. See the network-row handler in
// _wallet_realconnect.js.
window.lxChainHref=chainHref;
// WHERE A CHAIN STARTS ONCE A WALLET IS CONNECTED, which is not the same question chainHref answers.
//
// chainHref falls back to the TRADE page for a url with no section, and must: that branch is taken by
// the landing page, where the reader has no wallet yet and the dashboard would bounce them off its
// authgate. After a successful connect the gate passes, and the dashboard is where someone who just
// connected expects to be.
//
// One url for both chains: the dashboard is authgated, so it is never indexed or shared and has no
// reason to exist twice. Which build answers it is decided by the lx_chain cookie, which the connect
// that just happened has already set.
window.lxChainHome=function(){return '/dashboard';};
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
  // PICKING THE OTHER CHAIN HANDS OFF; IT DOES NOT OPEN A WALLET LIST HERE.
  //
  // This used to call applyChain(net) and then lxwOpenWallet(net) unconditionally. applyChain navigates
  // for the other chain, and location.assign is ASYNCHRONOUS — so the script carried on, the wallet list
  // painted, and the pending navigation then replaced it. The visible result was a wallet popup that
  // flashed for a split second before the page jumped to /trade/xrpl.
  //
  // Opening it was wrong even without the flash: THIS BUILD CANNOT DRIVE XRPL WALLETS. Measured on the
  // deployed landing page — window.lxc is undefined and there is no lx-xrplconnect script — so the
  // Gem/Xaman/Joey/Crossmark rows it listed could not have connected anything. The modal also still
  // read "Choose a Stellar wallet to continue" above them.
  //
  // So for the other chain: record the intent, navigate, and stop. The XRPL build picks the marker up on
  // arrival and opens its OWN connect modal, which is the one with a connect layer behind it.
  // sessionStorage because the two builds share an origin, it survives the navigation, and it does not
  // outlive the tab — a stale marker must never pop a connect dialog on some later visit.
  scr.querySelectorAll(".lxw-row:not(.lxw-soon)").forEach(function(r){r.addEventListener("click",function(){
    var net=r.getAttribute("data-lxnet");
    if(net!==LOCAL_CHAIN){
      try{sessionStorage.setItem("lumos.connectOnArrive",net);}catch(_){}
      applyChain(net);
      return;
    }
    applyChain(net);
    if(window.lxwOpenWallet)window.lxwOpenWallet(net,npHome);
  });});
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
  // base: "Trending on Aptos", NETWORK Aptos with the Aptos mark, "Petra or Nightly", APT tickers, on
  // a product that only runs on Stellar. The base is an artefact of where these pages came from, never
  // something a user should see, so default to the first offered chain instead of leaving it unrun.
  //
  // THE URL WINS OVER THE SAVED PREFERENCE, and boot NEVER NAVIGATES.
  //
  // This line used to be applyChain(saved), which was harmless while Stellar was the only build and
  // chainHref always returned the url we were already on. The moment XRPL went live at real urls it
  // became a trap: anyone whose last visit was XRPL had lumos.chain="xrpl", so opening ANY Stellar
  // url — a bookmark, a shared link, a search result, /trade/stellar typed by hand — ran
  // applyChain("xrpl") at boot and location.assign'd them to /trade/xrpl before the page settled.
  // Verified on staging: requesting /trade/stellar landed on /trade/xrpl, with no way back except to
  // use the switcher. A stored preference must never override an explicitly requested url.
  //
  // So the url decides when it says anything, the saved value only fills the gap, and either way this
  // is adoptChain — re-skin, no navigation. applyChain stays for the switcher, where a navigation is
  // exactly what the reader asked for.
  var use=chainFromPath()||((saved&&CHAINS[saved])?saved:ORDER[0]);
  try{ if(use&&CHAINS[use]&&use!==cur)adoptChain(use); }catch(_){}
  // Signal that the initial rebrand is done. A TARGETED CSS gate (in _multichain.js) hides ONLY the
  // small network logo/name elements until now — NOT the whole body (that blanked heavy pages).
  // Added unconditionally (incl. aptos/no-saved) so those elements always reveal.
  try{document.documentElement.classList.add("lx-chainready");}catch(_){}
  setTimeout(reskin,300);setTimeout(reskin,1200);setTimeout(reskin,3000);
  window.addEventListener("load",reskin);
}
if(document.readyState!=="loading")boot();else document.addEventListener("DOMContentLoaded",boot);
})();
