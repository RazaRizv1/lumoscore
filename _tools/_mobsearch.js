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
  function place(){
    var bar=document.querySelector("header.appbar"); if(!bar)return;
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
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",place);
  else place();
  // The header is re-rendered on connect (the wallet chip is swapped in), which drops the button.
  try{ new MutationObserver(place).observe(document.documentElement,{childList:true,subtree:true}); }catch(_){}
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
    p = p.replace(/<style id="lx-mobsearch-css">[\s\S]*?<\/style>/, '')
         .replace(/<script id="lx-mobsearch">[\s\S]*?<\/script>/, '');
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
