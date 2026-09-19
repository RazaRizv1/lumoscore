(function(){
  if(window.__lxBhiw)return; window.__lxBhiw=1;
  var STEPS=[["You choose where it goes","Your connected network is the source. Pick the destination chain and the amount of USDC to move."],["You sign once, on the source chain","That signature burns your USDC. It is genuinely destroyed rather than parked in a contract, which is what lets the same amount be issued as real USDC on the other side."],["Circle attests to the burn","Circle observes the burn and issues a signed attestation for it. This is Circle’s step, not LumosCore’s — nobody here can speed it up, and it has to finish before anything can be minted."],["You claim it on the destination","With the attestation in hand, a second signature mints native USDC to your address on the destination chain. Until you take that step the funds are attested but not yet issued — they are not lost, and the claim can be made later."]];
  var el=null, trigger=null;
  function build(){
    if(el)return el;
    el=document.createElement("div");
    el.className="lx-bhiw"; el.setAttribute("hidden","");
    el.setAttribute("role","dialog"); el.setAttribute("aria-modal","true");
    el.setAttribute("aria-label","How the cross-chain bridge works");
    var steps="";
    for(var i=0;i<STEPS.length;i++){
      steps+='<li data-n="'+(i+1)+'"><h4>'+STEPS[i][0]+'</h4><p>'+STEPS[i][1]+'</p></li>';
    }
    el.innerHTML='<div class="lx-bhiw-bd" data-lxbhiw-close></div>'
      +'<div class="lx-bhiw-card">'
      +'<div class="lx-bhiw-head"><h3>How the bridge works</h3>'
      +'<button class="lx-bhiw-x" type="button" aria-label="Close" data-lxbhiw-close><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>'
      +'<div class="lx-bhiw-body">'
      +'<p class="lx-bhiw-lede">This is not a wrapped-token bridge. It uses <b>Circle CCTP</b>, Circle\u2019s own mechanism for moving USDC between chains: your USDC is <b>burned</b> on the chain it leaves and <b>native USDC is minted</b> on the chain it arrives on. What lands is genuine Circle-issued USDC, not a synthetic claim on a pool somewhere.</p>'
      +'<ol class="lx-bhiw-steps">'+steps+'</ol>'
      +'<div class="lx-bhiw-note"><b>Two signatures, not one.</b> One to burn and one to claim. That is inherent to CCTP rather than a choice made here \u2014 the second cannot be prepared until Circle has attested to the first.</div>'
      +'<div class="lx-bhiw-chains"><b>Where it goes:</b> USDC can move between Stellar and Ethereum, Base, Arbitrum, Optimism, Polygon, Avalanche, Linea and World Chain.</div>'
      +'</div></div>';
    document.body.appendChild(el);
    return el;
  }
  function open(){
    build(); el.removeAttribute("hidden");
    try{ el.querySelector(".lx-bhiw-card").scrollTop=0; }catch(_){}
    try{ el.__lxOvf=document.body.style.overflow; document.body.style.overflow="hidden"; }catch(_){}
    try{ el.querySelector(".lx-bhiw-x").focus(); }catch(_){}
  }
  function close(){
    if(!el)return;
    el.setAttribute("hidden","");
    try{ document.body.style.overflow=el.__lxOvf||""; }catch(_){}
    try{ if(trigger&&trigger.focus)trigger.focus(); }catch(_){}
  }
  // Delegated, and capturing: the button lives inside a step card the page re-renders, so a listener
  // bound to the node itself would be orphaned the first time that happened.
  window.addEventListener("click",function(e){
    var t=e.target; if(!t||!t.closest)return;
    if(t.closest("[data-lxbhiw-close]")){ e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
    var hit=t.closest("#mdxHiwBtn,#brHiwBtn");
    if(!hit){
      // the desktop build labels the same control differently; match on what it SAYS as a fallback
      var b=t.closest("button,a");
      if(b&&/how it works/i.test((b.textContent||""))&&b.closest(".br-step,.mdx-hero-ctas,.crumb-bar,header,main"))hit=b;
    }
    if(hit){ e.preventDefault(); e.stopImmediatePropagation(); trigger=hit; open(); }
  },true);
  document.addEventListener("keydown",function(e){ if(e.key==="Escape"||e.keyCode===27)close(); });
})();