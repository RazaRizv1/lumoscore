// A search button in the phone header.
//
// Search was reachable only by opening the slide menu and finding "Search" under Discover -- two taps
// and a scan of a twelve-row list to reach the one control people use most on a market site. The header
// already carries the wallet chip and the menu button; there is room for a third, and search is the only
// thing that earns it.
//
// It does NOT build a second search. The page already ships the popup (#searchPopup) and its opener,
// window._openSearchPopup, which the menu row calls -- this reuses exactly that, so the popup, its
// filters and its results stay the one implementation.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const STYLE = `<style id="lx-mobsearch-css">
/* Sized and shaped like the menu button beside it, because they are peers -- two header actions, not a
   primary and an afterthought. */
.appbar .lx-hsearch{display:inline-flex;align-items:center;justify-content:center;
  width:38px;height:38px;flex:0 0 38px;margin-right:8px;padding:0;border-radius:11px;
  border:1px solid var(--border);background:var(--surface-2);color:var(--text-soft);
  cursor:pointer;transition:color .15s ease,border-color .15s ease,background .15s ease}
.appbar .lx-hsearch:active{background:var(--surface);color:var(--accent);border-color:var(--accent)}
.appbar .lx-hsearch svg{width:18px;height:18px;display:block}
/* The wallet chip is the flexible one: at 375px the address, this button and the menu button together
   leave it about 120px, and it already truncates. Nothing else may shrink. */
.appbar .lx-hsearch,.appbar #menuBtn{flex-shrink:0}
</style>`;

const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" '
  + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';

const SCRIPT = `<script id="lx-mobsearch">(function(){
  if(window.__lxMobSearch)return; window.__lxMobSearch=1;
  var ICON=${JSON.stringify(ICON)};
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
})();</script>`;

let containers = 0, pages = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = `lumoscore-aptos-${dev}.html`;
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;

  for (const k of Object.keys(json)) {
    let p = json[k];
    const before = p;
    p = p.replace(/<style id="lx-mobsearch-css">[\s\S]*?<\/style>/g, '')
         .replace(/<script id="lx-mobsearch">[\s\S]*?<\/script>/g, '');
    // the phone header only: header.appbar does not exist on the desktop layout
    if (p.indexOf('class="appbar"') >= 0) {
      if (p.indexOf('</head>') >= 0) p = p.replace('</head>', STYLE + '</head>');
      const bi = p.lastIndexOf('</body>');
      if (bi >= 0) { p = p.slice(0, bi) + SCRIPT + p.slice(bi); pages++; }
    }
    if (p !== before) { json[k] = p; changed = true; }
  }

  if (changed) {
    containers++;
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
console.log('header search button on ' + pages + ' phone page keys across ' + containers + ' containers');
