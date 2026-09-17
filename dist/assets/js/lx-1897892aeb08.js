
(function(){
  var wrap=document.getElementById("lxAdWrap"); if(!wrap) return;

  // Which asset is this page showing? The SAME source of truth the data layer uses, and it has to be:
  // the site serves clean URLs, so /trade/stellar/AQUA-GBNZ... carries an EMPTY location.search. Reading
  // the query alone returned the LUMOS default on every asset page, which made the slot swap to the
  // fallback creative everywhere -- the one bug that would have looked like the feature working.
  // window.__lxRoute is set by _route.js in <head>, long before this script parses.
  function pageCode(){
    try{
      var a=(window.__lxRoute&&window.__lxRoute.asset)||
            (new URLSearchParams(window.location.search)).get("asset")||"LUMOS";
      var dash=a.indexOf("-");
      return (dash>0?a.slice(0,dash):a).toUpperCase();
    }catch(e){ return "LUMOS"; }
  }

  // On the promoted asset's OWN page the card is unchanged -- same pair, same copy, same "View LUMOS" --
  // but "view" cannot mean "navigate to the page you are already on". Mark it so the click scrolls to the
  // trade widget instead. Runs at parse time, so the mark is set before anything can be clicked.
  (function(){
    var ad=wrap.querySelector(".lxad"); if(!ad) return;
    var code=ad.getAttribute("data-adcode");
    if(code && code===pageCode()) ad.setAttribute("data-adself","1");
  })();

  // The design's own click handler opens asset pages without the ?asset= query, so a plain anchor here
  // would land every click on default LUMOS. Window-capture is the earliest phase available, which is
  // what lets us stop that handler before it sees the event.
  // Returns the card itself, not a string. An earlier version returned a "#self" sentinel and its quotes
  // were lost on the way through the build, leaving a bare hash-self token -- which JS parses as a private
  // field, so the whole script died with a SyntaxError and NOTHING on the card worked. An element
  // reference cannot be mangled that way, and the two questions (which card, and is this its own page)
  // stay separate.
  function cardOf(t){
    if(!t||!t.closest) return null;
    if(t.closest(".lxad-why")) return null;       // the booking link, not the creative
    return t.closest(".lxad");
  }
  function go(ad,e){
    if(!ad) return;
    e.preventDefault(); if(e.stopImmediatePropagation)e.stopImmediatePropagation();
    // on the promoted asset's own page there is nowhere to navigate TO, so bring the buy box into view
    if(ad.getAttribute("data-adself")==="1"){
      var w=document.querySelector(".dxa-trade-card,.mdxa-trade-card");
      if(w&&w.scrollIntoView){ try{ w.scrollIntoView({block:"center",behavior:"smooth"}); }catch(_){ w.scrollIntoView(); } }
      return; }
    var href=ad.getAttribute("data-href"); if(!href) return;
    try{ window.location.href=href; }catch(_){} }

  if(!window.__lxAdNav){ window.__lxAdNav=1;
    window.addEventListener("click",function(e){ go(cardOf(e.target),e); },true);

    // A TAP IS NOT A CLICK on a handset (DEV landmine 10). The design's own handlers have the same
    // problem, which is why controls that work in the browser pane do nothing on a real phone -- and why
    // a pane check alone never catches it. So the card listens for the touch directly.
    //
    // The guard matters more than the handler: the ad is a big block in a long scrolling page, so without
    // it every flick that happens to start on the card would navigate. A touch only counts as a tap if the
    // finger stayed within 12px and lifted inside 600ms.
    var tx=0, ty=0, tt=0, tid=null;
    window.addEventListener("touchstart",function(e){
      var t=e.touches&&e.touches[0]; if(!t) return;
      tid=cardOf(e.target); tx=t.clientX; ty=t.clientY; tt=Date.now();
    },{passive:true,capture:true});
    window.addEventListener("touchend",function(e){
      if(!tid) return; var h=tid; tid=null;
      var t=e.changedTouches&&e.changedTouches[0]; if(!t) return;
      if(Date.now()-tt>600) return;                                  // a long press, or a paused scroll
      if(Math.abs(t.clientX-tx)>12||Math.abs(t.clientY-ty)>12) return;  // a swipe, not a tap
      go(h,e);
    },{capture:true});
  }
})();
