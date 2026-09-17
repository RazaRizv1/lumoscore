(function(){
  // Set before anything else and synchronously: it is what arms the phone rule above, so a failure
  // to load this file leaves the card visible where it was authored rather than hidden forever.
  try{ document.documentElement.className+=' lx-sc'; }catch(_){}
  function ov(){ return document.querySelector('.dex-overview,.amm-overview'); }
  function side(){ return document.querySelector('.dex-mints-card,.mdx-mints-card,.amm-snapshot-card'); }
  // What the card should sit after once it drops below. Ordered most specific first: the pairs
  // section on Trade desktop, its mobile list, then the pagination that closes the Pools list on
  // either build.
  function anchor(){
    var a = document.querySelector('.dex-markets')
        || document.querySelector('.mdx-mk-list')
        || document.querySelector('.lx-netpag-host')
        || document.querySelector('.lx-netpag')
        || null;
    // #17: on Pools the My Pools panel is a sibling AFTER the pager, so anchoring on the pager alone
    // dropped Market Overview BETWEEN the two lists. Under All Pools that is invisible -- the list
    // above it is thousands of rows -- but the moment My Pools is selected the list above collapses
    // and the card is sitting on top of the user's own positions. Sit after the LAST list on the
    // page instead, so it is below whichever one is showing.
    var m=document.querySelector('#panelMine,#panelMyPositions');
    try{ if(m&&(!a||(a.compareDocumentPosition(m)&Node.DOCUMENT_POSITION_FOLLOWING)))a=m; }catch(_){}
    return a;
  }
  function twoCol(el){
    try{ var c=getComputedStyle(el).gridTemplateColumns;
      return !!c && c.indexOf('none')<0 && c.trim().split(/\s+/).length>1; }catch(_){ return false; }
  }
  function place(){
    var s=side(); if(!s)return;
    var o=ov();
    if(o&&twoCol(o)){ if(s.parentNode!==o)o.appendChild(s); return; }   // beside the hero
    var a=anchor();
    // Nothing to sit after yet -- the pools pager is built at runtime. Move it to the end of the page
    // anyway: at phone widths the rule above hides it while it is still in the overview, so leaving
    // it there on a page whose anchor never appears would hide it for good.
    if(!a){ var host=o&&o.parentNode; if(host&&s.parentNode===o)host.appendChild(s); return; }
    if(a===s||a.contains(s))return;
    if(s.parentNode===a.parentNode&&a.nextElementSibling===s)return;     // already in place
    a.parentNode.insertBefore(s,a.nextSibling);
  }
  function boot(){
    place();
    // The rail toggles, the window resizes, and both pages re-render their own lists. Re-assert on
    // all three rather than assuming the first pass is the last; place() is a no-op once settled.
    try{ window.addEventListener('resize',place,{passive:true}); }catch(_){}
    try{
      var rail=document.querySelector('.nx-side');
      if(rail) new MutationObserver(place).observe(rail,{attributes:true,attributeFilter:['class']});
    }catch(_){}
    try{
      var host=document.querySelector('main.page')||document.querySelector('.lcmu-in')||document.body;
      new MutationObserver(function(){ place(); }).observe(host,{childList:true,subtree:true});
    }catch(_){}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();