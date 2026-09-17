(function(){
  if(window.__lxMobSearch)return; window.__lxMobSearch=1;
  var ICON="<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.1\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"11\" cy=\"11\" r=\"7\"></circle><line x1=\"21\" y1=\"21\" x2=\"16.65\" y2=\"16.65\"></line></svg>";
  function open(){
    // The page's own opener, so this button and the menu row open the same thing in the same state.
    try{ if(typeof window._openSearchPopup==="function"){ window._openSearchPopup(); return; } }catch(_){}
    // Fallbacks, in the order the rest of the app already uses: the menu's own row, then the overlay
    // itself. A header button that silently does nothing is worse than no header button.
    var row=document.querySelector("[data-open-search]");
    if(row){ row.click(); return; }
    var ov=document.getElementById("searchPopup");
    if(ov){ ov.classList.add("open");
      var i=ov.querySelector("input"); if(i)setTimeout(function(){ try{ i.focus(); }catch(_){} },60); }
  }
  // #9: search is in the header now, so the menu row is a second door to the same room. Hidden rather
  // than stripped from the markup, because _mobilemenu.js copies this menu between pages and a runtime
  // rule cannot get out of step with a copy. The group heading goes with it when nothing is left under
  // it -- computed, not assumed, so adding a row to Discover later brings the heading back on its own.
  function tidyMenu(){
    var menu=document.querySelector(".slide-menu"); if(!menu)return;
    var row=menu.querySelector("[data-open-search]");
    if(row&&row.style.display!=="none")row.style.display="none";
    var links=menu.querySelector(".menu-links")||menu;
    var kids=[].slice.call(links.children);
    for(var i=0;i<kids.length;i++){
      if(!kids[i].classList||!kids[i].classList.contains("menu-group"))continue;
      var anyVisible=false;
      for(var j=i+1;j<kids.length;j++){
        if(kids[j].classList&&kids[j].classList.contains("menu-group"))break;
        if(kids[j].style.display!=="none"){ anyVisible=true; break; }
      }
      var want=anyVisible?"":"none";
      if(kids[i].style.display!==want)kids[i].style.display=want;
    }
  }
  function place(){
    // .appbar, not header.appbar: Trade and the dashboard ship it as a <header>, Pools and the pool
    // page ship the same bar as a <div>. Keying on the tag is why the button was missing on exactly
    // those two.
    var bar=document.querySelector(".appbar"); if(!bar)return;
    // Only where there is something to open. On a page without the popup this would be a dead control.
    if(!document.getElementById("searchPopup")&&!document.querySelector("[data-open-search]"))return;
    if(bar.querySelector(".lx-hsearch"))return;
    var b=document.createElement("button");
    b.type="button"; b.className="lx-hsearch"; b.setAttribute("aria-label","Search");
    b.innerHTML=ICON;
    b.addEventListener("click",function(e){
      try{ e.preventDefault(); e.stopPropagation(); }catch(_){}
      open();
    });
    // Immediately before the menu button, so the reading order is wallet, search, menu -- and the menu
    // stays the last thing on the right, where a thumb expects it.
    var menu=document.getElementById("menuBtn");
    if(menu&&menu.parentNode===bar)bar.insertBefore(b,menu);
    else bar.appendChild(b);
  }
  function run(){ place(); tidyMenu(); }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run);
  else run();
  // The header is re-rendered on connect (the wallet chip is swapped in), which drops the button; the
  // menu is built when it is first opened, so the row to hide does not exist until then.
  try{ new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true}); }catch(_){}
})();