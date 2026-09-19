(function(){
  if(window.__lxBhiw)return; window.__lxBhiw=1;
  var STEPS=[["You choose where it goes","Your connected network is the source. Pick the destination chain and the amount to move — any curated asset can be the thing you send."],["You pick a route","Both are shown with what they cost and how long they take. CCTP delivers native USDC; LayerZero delivers USDT0. Four chains accept either, and eight can only be reached by one of them, so on those the choice is made for you."],["Your asset is swapped into what the route carries","If you are not already sending that stablecoin, it is swapped on Stellar first, at a rate shown before you sign. Nothing is wrapped at any point — what crosses is the real thing."],["It is burned on Stellar and minted on the destination","Both routes are burn-and-mint, so what lands is genuine USDC or USDT0 rather than a synthetic claim on a pool. CCTP is attestable in about five seconds; LayerZero takes about 30 minutes, waiting 320 Stellar ledgers before its verifiers sign off."],["You claim it — or you do not have to","With CCTP a second signature mints the USDC to your address, and you pay that chain’s gas for it. Until you take that step the funds are attested but not issued: not lost, and claimable later. With LayerZero there is nothing to claim, because the messaging fee you paid on Stellar covers delivery."]];
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
      +'<p class="lx-bhiw-lede">This is not a wrapped-token bridge, on either route. <b>Circle CCTP</b> moves USDC and <b>LayerZero</b> moves USDT0, and both work the same way: the stablecoin is <b>burned</b> on the chain it leaves and <b>minted</b> on the chain it arrives on. What lands is the genuine asset, not a synthetic claim on a pool somewhere.</p>'
      +'<ol class="lx-bhiw-steps">'+steps+'</ol>'
      +'<div class="lx-bhiw-note"><b>How many signatures depends on the route.</b> CCTP needs two \u2014 one to burn and one to claim \u2014 and the second cannot be prepared until Circle has attested to the first. LayerZero needs one: its executor delivers, paid for by the messaging fee. Either way, a swap into the route\u2019s stablecoin is its own signature, because a Soroban operation cannot share a transaction with a classic one.</div>'
      +'<div class="lx-bhiw-chains"><b>Where it goes:</b> sixteen destinations. USDC via CCTP to Ethereum, Base, Arbitrum, Optimism, Polygon, Avalanche, Linea and World Chain. USDT0 via LayerZero to Ethereum, Arbitrum, Optimism, Polygon, Berachain, Ink, Hyperliquid, Monad, Flare, Sei, MegaETH and Plasma.</div>'
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