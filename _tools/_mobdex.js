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
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);
const KEYS = ['lumoscore-dex-mobile.html'];

const STYLE = '<style id="lx-mobdex-css">'
  // RETITLE. The list under this heading is the curated launch set, not new mints, so the desktop layer
  // renames it. Doing that in JS here is a losing game: the design rewrites the heading's text in place
  // after we set it, and re-asserting from a MutationObserver risks trading writes with whatever does
  // the rewriting. CSS wins outright — the design can rewrite that text node as often as it likes and
  // never see it painted. The svg carries width/height attributes, so font-size:0 does not shrink it.
  + '.mdx-mints-title{font-size:0!important}'
  + '.mdx-mints-title::after{content:"Featured on Stellar";font-size:13px;font-weight:700;color:var(--text)}'
  // Hide the mock rows until ours land, so nobody sees Aptos tokens on a Stellar exchange even briefly.
  + 'body:not(.lxmd-ready) .mdx-mints-list,body:not(.lxmd-ready) .mdx-mover-list,'
  + 'body:not(.lxmd-ready) .mdx-mk-list{visibility:hidden}'
  + '.lxmd-empty{padding:16px 4px;text-align:center;color:var(--text-soft,#8a8fa3);'
  + 'font:600 13px/1.5 "Hanken Grotesk",system-ui,sans-serif}'
  // The design's icon spans are sized by their own rules; only the image source is ours.
  + '.mdx-mint-ic.lxmd-ic,.mdx-mover-ic.lxmd-ic,.mdx-mk-ic.lxmd-ic{background-size:cover!important;'
  + 'background-position:50% 50%!important;background-repeat:no-repeat!important;overflow:hidden}'
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
  // The roster carries a brand colour (a.b) for assets with no logo; keep that rather than a grey disc.
  function icoStyle(a){var lg=a&&a.logo;
    if(lg)return 'background-image:url("'+String(lg).replace(/"/g,"%22")+'")';
    return "background:linear-gradient(135deg,"+((a&&a.b)||"#333")+","+((a&&a.b)||"#333")+"cc)";}
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
        +'<span class="mdx-mint-ic lxmd-ic" style="'+esc(icoStyle(a))+'"></span>'
        +'<div><div class="mdx-mint-name"><span class="tk">'+esc(a.code)+'</span></div>'
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
        +'<span class="mdx-mover-ic lxmd-ic" style="'+esc(icoStyle(a))+'"></span>'
        +'<div class="mdx-mover-main"><div class="mdx-mover-pair">'+esc(a.code)+'</div>'
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
    var d=A.filter(function(a){
      if(cat&&cat!=="all"){var c=String(a.cat||"").toLowerCase();
        if(c!==cat&&c+"s"!==cat)return false;}
      if(qy&&(a.code+" "+(a.domain||"")).toLowerCase().indexOf(qy)<0)return false;
      return true;});
    var sig="p|"+cat+"|"+qy+"|"+d.map(function(a){return a.code+":"+(priceOf(a)==null?"":a.px);}).join("|");
    if(!stale(list,sig))return;list.setAttribute("data-lxmd",sig);
    if(!d.length){list.innerHTML='<div class="lxmd-empty">No pairs match</div>';return;}
    list.innerHTML=d.map(function(a){var up=(a.chg||0)>=0;
      return '<div class="mdx-mk-row" data-lxmd-row="1" data-href="'+esc(href(a))+'">'
        +'<div class="mdx-mk-top"><span class="mdx-mk-ic lxmd-ic" style="'+esc(icoStyle(a))+'"></span>'
        +'<div class="mdx-mk-meta"><div class="mdx-mk-name-row">'
        +'<span class="mdx-mk-name">'+esc(a.code)+'</span>'
        +'<span class="mdx-mk-domain">'+esc(a.domain||"Stellar")+'</span></div>'
        +'<div class="mdx-mk-vol">Vol '+esc(a.vol==null?DASH:abbr(a.vol)+" XLM")+'</div></div>'
        +'<div class="mdx-mk-right">'
        +'<div class="mdx-mk-price">'+esc(priceOf(a)==null?DASH:fmtPrice(priceOf(a))+" XLM")+'</div>'
        +'<div class="mdx-mk-change '+(up?"up":"down")+'">'+esc(pct(n(a.chg)))+'</div>'
        +'</div></div></div>';
    }).join("");
  }

  // ---- tabs, filters, search, row navigation -------------------------------------------------------
  function wire(){
    if(window.__lxmdWired)return;window.__lxmdWired=1;
    document.addEventListener("click",function(e){
      var t=e.target;if(!t||!t.closest)return;
      if(t.closest(".mdx-mover-tabs")||t.closest(".mdx-mk-filters")){
        setTimeout(pass,30);setTimeout(pass,240);return;}
      var row=t.closest("[data-href]");
      if(row&&/mdx-(mint|mover|mk)-row/.test(String(row.className||""))){
        e.preventDefault();e.stopPropagation();location.href=row.getAttribute("data-href");}
    },true);
    var si=q(".mdx-mk-search input");
    if(si)si.addEventListener("input",function(){setTimeout(pass,0);});
  }
  function pass(){try{
    wire();renderMints();renderMovers();renderPairs();
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
