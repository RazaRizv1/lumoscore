// Mobile Trade page: real data.
//
// _dexdata.js IS injected on the mobile Trade page — unlike the wallet, the gate was never the problem
// — but every one of its renderers targets desktop containers (#dexMintsList, #dexMoverGrid,
// #dexMkTbody) and bails on the first line when they are absent. So the page kept the design's mock:
// "New Mints" listed Tether USD and Move Dollar (a Move/Aptos token), and Market Movers listed CELL
// (cellana.finance) and GUI — Aptos assets on a Stellar exchange.
//
// The aliasing trick used on the trade pane cannot work here. renderMovers does grid.innerHTML=… with
// DESKTOP card markup, and the markets renderer emits <tr> — but the mobile lists are divs of
// .mdx-mover-row / .mdx-mk-row, so aliasing would either wreck the layout or inject table rows into a
// div. This renders the layer's own dataset into the mobile markup instead, so both layouts show the
// same numbers from the same roster.
//
// Usage: node _tools/_mobdex.js [--write]
const fs = require('fs');
const { read, getContents, VERIFIED, VTICK_SVG } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);
const KEYS = ['lumoscore-dex-mobile.html'];

const STYLE = '<style id="lx-mobdex-css">'
// Verified-issuer tick, same disc/check as desktop Trade and Wallet so the mark reads identically
// on both layouts. flex:0 0 so a long code can never squeeze it out of the row.
+'.mdx-mover-pair .lx-vtick,.mdx-mk-name-row .lx-vtick{display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;margin-left:5px;border-radius:50%;background:var(--green,#35c07f);color:#fff;vertical-align:-2px;flex:0 0 13px}'
+'.mdx-mover-pair .lx-vtick svg,.mdx-mk-name-row .lx-vtick svg{width:8px;height:8px;display:block}'
  // RETITLE. The list under this heading is the curated launch set, not new mints, so the desktop layer
  // renames it. Doing that in JS here is a losing game: the design rewrites the heading's text in place
  // after we set it, and re-asserting from a MutationObserver risks trading writes with whatever does
  // the rewriting. CSS wins outright — the design can rewrite that text node as often as it likes and
  // never see it painted. The svg carries width/height attributes, so font-size:0 does not shrink it.
  + '.mdx-mints-title{font-size:0!important}'
  + '.mdx-mints-title::after{content:"Featured on Stellar";font-size:13px;font-weight:800;letter-spacing:-.01em;color:var(--text);-webkit-font-smoothing:auto}'
  // Hide the mock rows until ours land, so nobody sees Aptos tokens on a Stellar exchange even briefly.
  + 'body:not(.lxmd-ready) .mdx-mints-list,body:not(.lxmd-ready) .mdx-mover-list,'
  + 'body:not(.lxmd-ready) .mdx-mk-list{visibility:hidden}'
  + '.lxmd-empty{padding:16px 4px;text-align:center;color:var(--text-soft,#8a8fa3);'
  + 'font:600 13px/1.5 "Hanken Grotesk",system-ui,sans-serif}'
  // PAINTER-PROOF ICONS, same construction as the desktop layer.
  //
  // The design ships a logo "healer" that scans for [class*="mover-ic"] (among others), sets the element's
  // background to transparent and replaces its contents with an <img> from a map keyed by TICKER TEXT. On
  // Stellar a ticker is not an identity, so it painted Circle's USDC mark onto ARST, BTC and yXLM alike.
  // Only the movers were hit: "mdx-mover-ic" matches its "mover-ic" selector, while "mdx-mint-ic" and
  // "mdx-mk-ic" match nothing in its list — which is why exactly one of the three lists was wrong.
  //
  // A pseudo-element is out of its reach: it replaces innerHTML and inline background, and can do neither
  // to a ::before. data-lxc is belt and braces — the healer's own opt-out, so it skips these outright.
  + '.mdx-mint-ic[data-lxic],.mdx-mover-ic[data-lxic],.mdx-mk-ic[data-lxic]{position:relative;overflow:hidden;'
  + 'color:transparent!important;font-size:0!important}'
  + '.mdx-mint-ic[data-lxic]::before,.mdx-mover-ic[data-lxic]::before,.mdx-mk-ic[data-lxic]::before{content:"";'
  + 'position:absolute;inset:0;background:var(--lxvar) center/cover no-repeat;border-radius:inherit;z-index:2}'
  // Anything the healer already injected sits UNDER the ::before; hide it so it cannot show through.
  + '.mdx-mint-ic[data-lxic]>*,.mdx-mover-ic[data-lxic]>*,.mdx-mk-ic[data-lxic]>*{display:none!important}'
  + '</style>';

const SCRIPT = '<script id="lx-mobdex">' + String.raw`
(function(){
  if(window.__lxMobDex)return;window.__lxMobDex=1;
  var DASH="—";
  function q(s,r){return (r||document).querySelector(s);}
  function esc(t){return String(t==null?"":t).replace(/[&<>"]/g,function(c){
    return c==="&"?"&amp;":c==="<"?"&lt;":c===">"?"&gt;":"&quot;";});}
  function n(v){return (typeof v==="number"&&isFinite(v))?v:null;}
  function num(v,d){if(v==null||!isFinite(+v))return DASH;var x=Math.abs(+v);
    return (+v).toLocaleString(undefined,{minimumFractionDigits:0,
      maximumFractionDigits:(d!=null?d:(x>=1000?2:(x>=1?4:6)))});}
  function abbr(v){if(v==null||!isFinite(+v))return DASH;var x=+v;
    if(x>=1e9)return (x/1e9).toFixed(2)+"B";
    if(x>=1e6)return (x/1e6).toFixed(2)+"M";
    if(x>=1e3)return (x/1e3).toFixed(2)+"K";return x.toFixed(2);}
  function pct(v){return v==null?DASH:((v>=0?"+":"")+(+v).toFixed(2)+"%");}
  // Same helper the desktop rows use, so a price never reads differently between the two layouts.
  function fmtPrice(v){var x=+v||0;
    if(x>=1000)return x.toFixed(2);if(x>=1)return x.toFixed(4);
    if(x>=0.01)return x.toFixed(5);if(x>=0.0001)return x.toFixed(7);
    if(x>0)return x.toExponential(2);return "0";}
  function priceOf(a){return (a&&a.px!=null&&isFinite(+a.px))?+a.px:null;}
  function assets(){return window.__lxDEXassets||null;}
  // Defer to the layer's own resolver so both layouts show one logo per asset. It prefers the hardcoded
  // brand logo, falls back to the stellar.toml-resolved image (a.img — which the earlier mobile code
  // ignored, so toml-only assets never got their real logo), and finally to a lettered avatar. A flat
  // brand-colour disc, which is what this used to emit, just reads as a missing logo.
  function avatarBg(code){var c=String(code||"?"),hue=0,i;
    for(i=0;i<c.length;i++)hue=(hue*31+c.charCodeAt(i))%360;
    var init=c.replace(/[^A-Za-z0-9]/g,"").slice(0,2).toUpperCase()||"?",fz=init.length>1?15:20;
    var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="hsl('
      +hue+',60%,50%)"/><text x="20" y="'+(init.length>1?26:27)+'" text-anchor="middle" '
      +'font-family="system-ui,sans-serif" font-weight="800" font-size="'+fz+'" fill="#fff">'+init+'</text></svg>';
    return 'url("data:image/svg+xml,'+encodeURIComponent(svg)+'")';}
  function logoCss(a){
    try{if(window.__lxDEXlogoCss)return window.__lxDEXlogoCss(a);}catch(_e){}
    var u=a&&(a.logo||a.img); return u?"url("+u+")":avatarBg(a&&a.code);}
  // The icon carries the code twice on purpose: data-lxic is what we paint from, data-lxc is the healer's
  // documented opt-out. See PAINTER-PROOF ICONS in STYLE.
  var VFD={"USDC|GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN":1,"EURC|GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2":1,"yXLM|GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55":1,"yUSDC|GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF":1,"SHX|GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEKEBR7UCHEUUEK72N7I7KJ6JH":1,"LUMOS|GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S":1,"AQUA|GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA":1};
  var VTICK='<span class="lx-vtick" title="Verified issuer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>';
  function vtick(a){ return (a && a.code && a.issuer && VFD[a.code+"|"+a.issuer]) ? VTICK : ""; }
  function ico(cls,a){
    return '<span class="'+cls+' lxmd-ic" data-lxic="'+esc(a.code)+'" data-lxc="'+esc(a.code)+'"'
      +' style="--lxvar:'+esc(logoCss(a))+'"></span>';}
  function href(a){return "/trade/stellar/"+encodeURIComponent(a.code+"-"+a.issuer);}

  // We reuse the design own row classes, so the design can repaint a list with its mock rows at any
  // time. A signature stored on the CONTAINER survives that repaint, which made us skip the redraw and
  // leave Aptos mock tokens on screen. So the guard checks the rows are still OURS as well as current.
  // .lxmd-empty counts as ours too: an empty search result has no stamped rows, and without it every
  // pass would decide the list had been clobbered and repaint the same message forever.
  function stale(list,sig){
    if(list.getAttribute("data-lxmd")!==sig)return true;
    return !list.querySelector("[data-lxmd-row],.lxmd-empty");
  }

  // ---- Featured (the design calls it "New Mints") --------------------------------------------------
  // The desktop layer retitles this: the list is the CURATED launch set, not new mints. Same here,
  // rather than leaving a claim the data does not support.
  function renderMints(){
    var list=q(".mdx-mints-list");if(!list)return;var A=assets();if(!A)return;
    // The heading itself is retitled in CSS, not here — see RETITLE in STYLE.
    var d=A.slice(0,5);
    var sig="m|"+d.map(function(a){return a.code+":"+(a.trades==null?"":a.trades);}).join("|");
    if(!stale(list,sig))return;list.setAttribute("data-lxmd",sig);
    list.innerHTML=d.map(function(a){
      return '<div class="mdx-mint-row" data-lxmd-row="1" data-href="'+esc(href(a))+'">'
        +ico("mdx-mint-ic",a)
        +'<div><div class="mdx-mint-name">'+esc(a.code)+'</div>'
        +'<div class="mdx-mint-sub">'+esc(a.domain||"Stellar")+'</div></div>'
        +'<div class="mdx-mint-right"><div>'+esc(a.vol==null?DASH:abbr(a.vol)+" XLM")+'</div>'
        +'<div class="mdx-mint-sub">'+esc(a.trades==null?DASH:num(a.trades,0)+" trades")+'</div></div></div>';
    }).join("");
  }

  // ---- Market Movers -------------------------------------------------------------------------------
  // Reuses the layer's own moverData(), so Gainers/Losers/Volume order identically to desktop.
  function moverCat(){var t=q(".mdx-mover-tabs .active,.mdx-mover-tabs button.active");
    return t?((t.getAttribute("data-cat")||(t.textContent||"").trim().toLowerCase())):"gainers";}
  function renderMovers(){
    var list=q(".mdx-mover-list");if(!list)return;var A=assets();if(!A)return;
    // Pass the category explicitly: moverData() otherwise reads the DESKTOP active-tab selector, which
    // does not exist here, so all three tabs came back as Gainers.
    var cat=moverCat();
    var d;try{d=window.__lxDEXmovers?window.__lxDEXmovers(cat):null;}catch(_){d=null;}
    if(!d||!d.length)d=A.slice(0,4);
    var sig="v|"+cat+"|"+d.map(function(a){return a.code+":"+(a.chg==null?"":a.chg);}).join("|");
    if(!stale(list,sig))return;list.setAttribute("data-lxmd",sig);
    list.innerHTML=d.map(function(a){var up=(a.chg||0)>=0;
      return '<div class="mdx-mover-row" data-lxmd-row="1" data-href="'+esc(href(a))+'">'
        +ico("mdx-mover-ic",a)
        +'<div class="mdx-mover-main"><div class="mdx-mover-pair">'+esc(a.code)+vtick(a)+'</div>'
        +'<div class="mdx-mover-sub">'+esc(a.domain||"Stellar")+'</div></div>'
        +'<div class="mdx-mover-right">'
        +'<div class="mdx-mover-price">'+esc(priceOf(a)==null?DASH:fmtPrice(priceOf(a))+" XLM")+'</div>'
        +'<div class="mdx-mover-pct '+(up?"up":"down")+'">'+esc(pct(n(a.chg)))+'</div>'
        +'</div></div>';
    }).join("");
  }

  // ---- All Trading Pairs ---------------------------------------------------------------------------
  function mkFilter(){var t=q(".mdx-mk-filters .active,.mdx-mk-filters button.active");
    return t?((t.getAttribute("data-cat")||(t.textContent||"").trim().toLowerCase())):"all";}
  function mkQuery(){var i=q(".mdx-mk-search input");return i?String(i.value||"").trim().toLowerCase():"";}
  function renderPairs(){
    var list=q(".mdx-mk-list");if(!list)return;var A=assets();if(!A)return;
    var cat=mkFilter(),qy=mkQuery();
    // The native roster is not part of __lxDEXassets -- it is discovered on demand by the desktop data
    // layer (which is injected here too) so the curated roster, and the headline volume/TVL sums built
    // from it, stay exactly as they were.
    var src=A;
    if(cat==="native"){ try{ if(window.__lxDEXloadNative)window.__lxDEXloadNative(); }catch(_){}
      var nv=null; try{ nv=window.__lxDEXnativeList?window.__lxDEXnativeList():null; }catch(_){}
      src=(nv&&nv.list)||[]; }
    var d=src.filter(function(a){
      if(cat&&cat!=="all"&&cat!=="native"){var c=String(a.cat||"").toLowerCase();
        if(c!==cat&&c+"s"!==cat)return false;}
      if(qy&&(a.code+" "+(a.domain||"")).toLowerCase().indexOf(qy)<0)return false;
      return true;});
    var sig="p|"+cat+"|"+qy+"|"+d.map(function(a){return a.code+":"+(priceOf(a)==null?"":a.px);}).join("|");
    if(!stale(list,sig))return;list.setAttribute("data-lxmd",sig);
    if(!d.length){list.innerHTML='<div class="lxmd-empty">No pairs match</div>';return;}
    list.innerHTML=d.map(function(a){var up=(a.chg||0)>=0;
      return '<div class="mdx-mk-row" data-lxmd-row="1" data-href="'+esc(href(a))+'">'
        +'<div class="mdx-mk-top">'+ico("mdx-mk-ic",a)
        +'<div class="mdx-mk-meta"><div class="mdx-mk-name-row">'
        +'<span class="mdx-mk-name">'+esc(a.code)+vtick(a)+'</span>'
        +'<span class="mdx-mk-domain">'+esc(a.domain||"Stellar")+'</span></div>'
        +'<div class="mdx-mk-vol">Vol '+esc(a.vol==null?DASH:abbr(a.vol)+" XLM")+'</div></div>'
        +'<div class="mdx-mk-right">'
        +'<div class="mdx-mk-price">'+esc(priceOf(a)==null?DASH:fmtPrice(priceOf(a))+" XLM")+'</div>'
        +'<div class="mdx-mk-pct '+(up?"up":"down")+'">'+esc(pct(n(a.chg)))+'</div>'
        +'</div></div></div>';
    }).join("");
  }

  // ---- tabs, filters, search, row navigation -------------------------------------------------------
  function wire(){
    if(window.__lxmdWired)return;window.__lxmdWired=1;
    // WINDOW-capture, the earliest phase, for the same reason the desktop layer uses it: the design has
    // its own delegated nav handler on DOCUMENT capture. A document-capture listener here loses that race
    // and the design's handler wins, which is why tapping a row re-served the Trade page instead of the
    // asset page. stopImmediatePropagation, not stopPropagation — the latter still lets other listeners
    // on the same node and phase run, and the design's is one of them.
    window.addEventListener("click",function(e){
      var t=e.target;if(!t||!t.closest)return;
      // Tabs and filters are the design's to handle (it owns the .active toggle); only schedule a repaint.
      if(t.closest(".mdx-mover-tabs")||t.closest(".mdx-mk-filters")){
        setTimeout(pass,30);setTimeout(pass,240);return;}
      var row=t.closest("[data-href]");
      if(row&&/mdx-(mint|mover|mk)-row/.test(String(row.className||""))){
        e.preventDefault();e.stopImmediatePropagation();
        location.href=row.getAttribute("data-href");}
    },true);
    var si=q(".mdx-mk-search input");
    if(si)si.addEventListener("input",function(){setTimeout(pass,0);});
  }
  // Logos resolved from stellar.toml land AFTER the first render, and a late logo alone does not change
  // a row's signature, so nothing would repaint. Re-applying the variable each pass costs nothing and is
  // what the desktop layer's paintIcons does.
  function repaintIcons(){
    var A=assets();if(!A)return;var by={};
    A.forEach(function(a){by[a.code]=a;});
    [].slice.call(document.querySelectorAll("[data-lxic]")).forEach(function(ic){
      var a=by[ic.getAttribute("data-lxic")];if(!a)return;
      var css=logoCss(a);
      if(css&&ic.style.getPropertyValue("--lxvar")!==css)ic.style.setProperty("--lxvar",css);});
  }
  function pass(){try{
    wire();renderMints();renderMovers();renderPairs();repaintIcons();
    if(assets()&&!document.body.classList.contains("lxmd-ready"))
      document.body.classList.add("lxmd-ready");
  }catch(_){}}
  if(document.readyState!=="loading")pass();else document.addEventListener("DOMContentLoaded",pass);
  setInterval(pass,900);
})();
` + '<\/scr'+'ipt>';

let n = 0, containers = 0;
const files = fs.readdirSync('.').filter(f => /^lumoscore-.*-(desktop|mobile)\.html$/.test(f));
for (const file of files) {
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;
  for (const k of KEYS) {
    if (!json[k]) continue;
    let p = json[k];
    p = p.replace(/<style id="lx-mobdex-css">[\s\S]*?<\/style>/, '')
         .replace(/<script id="lx-mobdex">[\s\S]*?<\/script>/, '');
    if (p.indexOf('</head>') >= 0) p = p.replace('</head>', STYLE + '</head>');
    const bi = p.lastIndexOf('</body>'); if (bi < 0) continue;
    json[k] = p.slice(0, bi) + SCRIPT + p.slice(bi);
    changed = true; n++;
  }
  if (changed) {
    containers++;
    if (process.argv.includes('--write')) {
      const ser = JSON.stringify(json).split('</').join('<' + B + '/');
      fs.writeFileSync(file, data.slice(0, s) + ser + data.slice(e), 'utf8');
    }
  }
}
console.log('mobile dex renderer: injected=' + n + ' keys across ' + containers + ' containers'
  + (process.argv.includes('--write') ? '' : '  (dry run — pass --write)'));
