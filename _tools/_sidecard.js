// Where the card beside the hero goes when it is no longer beside the hero.
//
// Trade pairs its hero with New Mints, Pools pairs its hero with Market Overview. When the rail is
// collapsed there is room for both across, and that is how it should read. When the rail is expanded
// the row stacks -- and stacking left the side card wedged between the hero and the main list, which
// is the least useful place for it: it pushes the thing people came for down a screen.
//
// So it follows the layout. Two columns: it stays beside the hero. One column: it moves below the
// list -- All Trading Pairs on Trade, All Pools on Pools -- and on mobile, which is always one
// column, that is simply where it lives.
//
// The condition is read off the LAYOUT, not off the rail: the overview's own grid-template-columns
// says whether there are two tracks. That covers the rail being collapsed, the window being narrow,
// and mobile having no rail at all, without this file having to know about any of them.
//
// Trade's mobile page already ships its mints card after the pairs list, so there it is a no-op --
// which is the point of driving off the DOM rather than off a page name.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const KEYS = [
  'lumoscore-dex.html', 'lumoscore-dex-dark.html', 'lumoscore-dex-mobile.html',
  'lumoscore-amm.html', 'lumoscore-amm-dark.html', 'lumoscore-amm-mobile.html',
];

const STYLE = `<style id="lx-sidecard-css">
/* The RAIL decides this, not the window. Expanded, the overview is one column and the side card
   drops below the list; collapsed, the rail hands back 170px and the two sit across. Keyed to the
   window alone, a wide screen stayed two-column with the rail open -- which is the arrangement that
   parks New Mints and Market Overview between the hero and the thing people came to read. */
.dex-overview,.amm-overview{grid-template-columns:1fr!important}
/* 1445 is where the hero still keeps the ~830px its mark, headline and CTAs need once the 570px
   side card is beside it -- the same number both pages already stacked on. */
@media(min-width:1445px){
.nx-side.nx-collapsed ~ .main .dex-overview,.nx-side.nx-collapsed ~ .main .amm-overview{grid-template-columns:1.4fr 1fr!important}
}
</style>`;

const SCRIPT = `<script id="lx-sidecard">(function(){
  function ov(){ return document.querySelector('.dex-overview,.amm-overview'); }
  function side(){ return document.querySelector('.dex-mints-card,.mdx-mints-card,.amm-snapshot-card'); }
  // What the card should sit after once it drops below. Ordered most specific first: the pairs
  // section on Trade desktop, its mobile list, then the pagination that closes the Pools list on
  // either build.
  function anchor(){
    return document.querySelector('.dex-markets')
        || document.querySelector('.mdx-mk-list')
        || document.querySelector('.lx-netpag-host')
        || document.querySelector('.lx-netpag')
        || null;
  }
  function twoCol(el){
    try{ var c=getComputedStyle(el).gridTemplateColumns;
      return !!c && c.indexOf('none')<0 && c.trim().split(/\\s+/).length>1; }catch(_){ return false; }
  }
  function place(){
    var s=side(); if(!s)return;
    var o=ov();
    if(o&&twoCol(o)){ if(s.parentNode!==o)o.appendChild(s); return; }   // beside the hero
    var a=anchor(); if(!a||a===s||a.contains(s))return;
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
})();</script>`;

let containers = 0, pages = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = `lumoscore-aptos-${dev}.html`;
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;
  for (const k of KEYS) {
    if (!json[k]) continue;
    let p = json[k];
    p = p.replace(/<script id="lx-sidecard">[\s\S]*?<\/script>/, '')
         .replace(/<style id="lx-sidecard-css">[\s\S]*?<\/style>/, '');
    // the column rule goes in <head>, so the page never paints the other arrangement first
    if (p.indexOf('</head>') >= 0) p = p.replace('</head>', STYLE + '</head>');
    if (p.indexOf('</body>') < 0) continue;
    p = p.replace('</body>', SCRIPT + '</body>');
    if (p !== json[k]) { json[k] = p; changed = true; pages++; }
  }
  if (changed) {
    containers++;
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
console.log('side card placement applied to ' + pages + ' page keys across ' + containers + ' containers');
