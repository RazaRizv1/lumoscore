(function(){
  if(window.__lxHiwReady)return; window.__lxHiwReady=1;
  var EL=null, prevFocus=null, prevOverflow="", trigger=null;
  function esc(x){return x;}
  function step(n,t,b){ return '<li><span class="lx-hiw-n">'+n+'</span><span><span class="lx-hiw-b">'+t+'</span><span class="lx-hiw-p">'+b+'</span></span></li>'; }
  function build(){
    if(EL)return EL;
    var d=document.createElement("div"); d.className="lx-hiw"; d.id="lxHiw"; d.hidden=true;
    d.innerHTML='<div class="lx-hiw-bd" data-lxhiw-close></div>'
      +'<div class="lx-hiw-card" role="dialog" aria-modal="true" aria-labelledby="lxHiwT">'
      +'<button class="lx-hiw-x" data-lxhiw-close aria-label="Close">×</button>'
      +'<h2 class="lx-hiw-t" id="lxHiwT">How it works</h2>'
      +'<p class="lx-hiw-sub">Trading and minting on LumosCore, end to end.</p>'
      +'<div class="lx-hiw-s"><div class="lx-hiw-h">How to trade</div><ol class="lx-hiw-l">'
      +step(1,"Connect and choose an asset","Connect your Stellar wallet and pick any listed asset. If you do not hold it yet, the trustline is created inside the same transaction, so there is no separate setup step.")
      +step(2,"We route for the best price","Every order is quoted across the Stellar order book, Soroswap, Phoenix and Aquarius, then filled wherever you get the most. Rate, price impact and minimum received are shown before you sign.")
      +step(3,"Sign once, settle on Stellar","One signature sends one transaction, protected by a minimum received floor, so a moving market cannot fill you below it. Want a specific price instead? The Limit tab places a real resting order on the Stellar order book.")
      +'</ol></div>'
      +'<div class="lx-hiw-s"><div class="lx-hiw-h">How to mint</div><ol class="lx-hiw-l">'
      +step(1,"Describe your token","Name, ticker, icon, description, links, total supply, and how much you keep, up to 30%. The remainder seeds the liquidity pool, so your token is tradable the moment it exists.")
      +step(2,"Review the cost","One screen showing the service fee, the pool seed and your starting liquidity, priced in XLM at the live rate, plus the small deposit that creates the issuer account.")
      +step(3,"One signature does all of it","A single atomic transaction creates the issuer, mints your entire supply to you, seeds the XLM pool, then locks the issuer permanently. Supply is fixed from the first block: nobody can mint more, including you.")
      +'</ol></div>'
      +'<p class="lx-hiw-f">Trading fee 0.2% — or 0.1% if you hold 250,000 LUMOS. Stellar network fees are separate and typically a fraction of a cent.</p>'
      +'</div>';
    document.body.appendChild(d); EL=d; return d;
  }
  function open(){
    var d=build(); if(!d.hidden)return;
    prevFocus=trigger||document.activeElement; d.hidden=false;
    prevOverflow=document.body.style.overflow; document.body.style.overflow="hidden";   // no scrolling the page behind
    var x=d.querySelector(".lx-hiw-x"); if(x)try{x.focus();}catch(_){}
  }
  function close(){
    if(!EL||EL.hidden)return;
    EL.hidden=true; document.body.style.overflow=prevOverflow||"";
    if(prevFocus&&prevFocus.focus)try{prevFocus.focus();}catch(_){}
  }
  // WINDOW capture, the earliest phase, and stopImmediatePropagation -- the same reason _mobdex.js gives
  // for its own listener: the design ships a delegated nav handler on DOCUMENT capture, so a document
  // listener here loses the race and the design wins. It treated this href="#" as navigation and re-served
  // the Trade page instead of opening the dialog. stopPropagation is not enough; the design's listener is
  // on the same node and phase, so it needs stopImmediate.
  // Delegated rather than bound, because the build moves this link into the hero (desktop) or the pairs
  // heading (mobile), and a re-rendered list must not be able to orphan the handler.
  window.addEventListener("click",function(e){
    var t=e.target; if(!t||!t.closest)return;
    if(t.closest("[data-lxhiw-close]")){ e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
    var hit=t.closest("#dexHiwBtn,.lx-dctas .dex-hero-btn.ghost,.lx-ctas .mdx-hero-btn.ghost");
    if(hit){ e.preventDefault(); e.stopImmediatePropagation(); trigger=hit; open(); }
  },true);
  document.addEventListener("keydown",function(e){ if(e.key==="Escape"||e.keyCode===27)close(); });
})();