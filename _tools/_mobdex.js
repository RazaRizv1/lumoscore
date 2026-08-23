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
const { read, getContents, VERIFIED, VTICK_SVG, DOMAIN_DISPLAY } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);
const KEYS = ['lumoscore-dex-mobile.html'];

const STYLE = '<style id="lx-mobdex-css">'
// #34: the movers become one sideways row here too, rather than ten stacked cards the reader has to
// scroll the PAGE through. Same idea as desktop: the section stays the height of a single card and the
// card clipped at the right edge is what says there is more.
+ '.mdx-mover-list{display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;gap:10px;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;padding-bottom:6px}'
// BOTH child shapes. renderMovers here stands down when the desktop layer is present, and that layer
// paints .dex-mover-card into this container -- so a rule written only for .mdx-mover-row sized nothing
// at all. Measured: ten .dex-mover-card children inside .mdx-mover-list, and a 1610px tall section.
+ '.mdx-mover-list>.mdx-mover-row,.mdx-mover-list>.dex-mover-card{flex:0 0 78%;max-width:290px;scroll-snap-align:start;min-width:0}'
+ '.mdx-mover-list::-webkit-scrollbar{height:5px}'
+ '.mdx-mover-list::-webkit-scrollbar-thumb{background:var(--border);border-radius:99px}'
+ '.mdx-mk-row{position:relative;padding-left:26px}'
+ '.mdx-mk-rank{position:absolute;left:2px;top:14px;font-family:\'JetBrains Mono\',monospace;font-size:10px;font-weight:600;color:var(--text-soft,#6f6f79);letter-spacing:-.02em}'
// #27: the mint sub-line was the only small-print line on this page NOT set in the mono face -- its
// sibling .mdx-mover-sub, directly below it and doing the same job, already is. Matched to that rule
// exactly rather than to some new size, so the two cards line up.
+ '.mdx-mint-sub{font-family:\'JetBrains Mono\',monospace;font-size:10.5px}'
// Sort control in the search row, plus the sheet it opens. The row is already a flex line with the
// magnifier and the input, so the button lands at its right end without touching the design's rules.
// The sheet is anchored to the row (position:relative on the row) rather than to the page, so it cannot
// drift when the list above it grows or shrinks.
+'.mdx-mk-search.lx-mkq{position:relative}'
+'.lx-msort{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;margin-right:-6px;padding:0;border:0;border-radius:7px;background:transparent;color:var(--text-soft);cursor:pointer}'
+'.lx-msort:hover,.lx-msort.on{background:var(--surface);color:var(--text)}'
+'.lx-msort.act{color:var(--accent)}'
+'.lx-msheet{display:none;position:absolute;z-index:40;top:calc(100% + 6px);right:0;min-width:184px;padding:5px;background:var(--surface);border:1px solid var(--border);border-radius:11px;box-shadow:0 18px 40px -18px rgba(0,0,0,.55)}'
+'.lx-msheet.open{display:block}'
+'.lx-msheet button{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:8px 9px;border:0;border-radius:8px;background:transparent;color:var(--text);font:inherit;font-size:12.5px;font-weight:600;text-align:left;cursor:pointer}'
+'.lx-msheet button:hover{background:var(--surface-2)}'
+'.lx-msheet button.on{color:var(--accent)}'
+'.lx-msheet button i{font-style:normal;font-size:9px;line-height:1;opacity:.9}'
+'.lx-msheet .lx-mreset{margin-top:3px;border-top:1px solid var(--border);border-radius:0 0 8px 8px;color:var(--text-soft);font-weight:500}'
// Section label inside the sort sheet. The sheet now carries two unrelated kinds of choice -- how the
// list is ORDERED and what the change column MEANS -- and without a divider the second pair reads as two
// more sort options.
+'.lx-msheet .lx-mdsec{margin:6px 0 2px;padding:7px 9px 3px;border-top:1px solid var(--border);font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--text-soft)}'
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
  + '.mdx-mints-title::after{content:"New mints on LumosCore";font-size:13px;font-weight:800;letter-spacing:-.01em;color:var(--text);-webkit-font-smoothing:auto}'
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
  // The pager belongs to the list ABOVE it. It used to sit in equal whitespace between the pairs list and
  // the next section, so it read as floating between the two and it was not obvious which one it paged.
  // Tie it to the list with a rule and tight top spacing, then push the following section away, so the
  // grouping is unambiguous without any extra label.
  // The rule goes BELOW the pager, not above it. Above, it cut the pager off from the list it belongs to
  // and left it grouped with whatever came next. Underneath, it closes the pairs section: list, its pager,
  // then the line, then a wide gap before New mints. Top margin is tight for the same reason -- the pager
  // should read as the last row of the list above it, not as something sitting between two sections.
  + '.lxmd-pager{display:flex;align-items:center;justify-content:space-between;gap:10px;'
  + 'margin-top:2px;padding:8px 2px 14px;border-bottom:1px solid var(--border)}'
  + '.mdx-mk-list{margin-bottom:34px}'
  + '.lxmd-pg{flex:0 0 auto;min-width:78px;padding:9px 14px;border-radius:9px;background:var(--surface-2);'
  + 'border:1px solid var(--border);color:var(--text);font:inherit;font-size:13.5px;font-weight:700;cursor:pointer}'
  + '.lxmd-pg[disabled]{opacity:.4;cursor:default}'
  + '.lxmd-pg-info{font-size:13px;color:var(--text-soft);font-weight:600;white-space:nowrap}'
  // #4: two figures per line, the smaller one under it -- the same shape the pair rows already use, so
  // four numbers fit the row without it becoming a table.
  + '.mdx-mint-right{display:flex;flex-direction:column;align-items:flex-end;gap:6px;text-align:right;min-width:0}'
  + '.mdx-mint-fig{display:flex;flex-direction:column;align-items:flex-end;line-height:1.25;min-width:0}'
  + '.mdx-mint-fig .v{font:800 13px/1.25 "JetBrains Mono",monospace;color:var(--text)}'
  + '.mdx-mint-fig .v2{font:700 12.5px/1.25 "JetBrains Mono",monospace;color:var(--text-soft)}'
  + '.mdx-mint-fig .k{font-weight:600;font-size:10.5px;line-height:1.3;color:var(--text-soft);white-space:nowrap}'
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
  // Below 1e-8 a plain decimal is an unreadable run of zeros and exponential notation is trader-hostile,
  // so the zeros get counted into a subscript instead: 0.000000001234 -> 0.0(8)1234. At 1e-8 and above we
  // stay plain and trim the padding.
  //
  // Deliberately free of backslash escapes: this code is emitted through a template literal, which eats
  // one level of them -- a /\.$/ here would ship as /.$/ and delete the last digit of every price.
  var SUBD=String.fromCharCode(8320,8321,8322,8323,8324,8325,8326,8327,8328,8329);
  function zsub(n){ var s=String(n),o=""; for(var i=0;i<s.length;i++)o+=SUBD.charAt(+s.charAt(i)); return o; }
  function trimZ(t){ while(t.length>1&&t.charAt(t.length-1)==="0")t=t.slice(0,-1);
    if(t.charAt(t.length-1)===".")t=t.slice(0,-1); return t; }
  function smallNum(x,sig){ x=+x||0; if(!(x>0))return "0";
    if(x>=1e-8)return trimZ(x.toFixed(8));
    var e=x.toExponential((sig||4)-1), i=e.indexOf("e");
    if(i<0)return String(x);
    var mant=trimZ(e.slice(0,i)).split(".").join(""), exp=-parseInt(e.slice(i+1),10);
    if(!(exp>1))return trimZ(x.toFixed(8));
    return "0.0"+zsub(exp-1)+mant; }
  function fmtPrice(v){var x=+v||0;
    if(x>=1000)return x.toFixed(2);if(x>=1)return x.toFixed(4);
    if(x>=0.01)return x.toFixed(5);if(x>=0.0001)return x.toFixed(7);
    if(x>0)return smallNum(x,4);return "0";}
  function priceOf(a){return (a&&a.px!=null&&isFinite(+a.px))?+a.px:null;}
  function assets(){return window.__lxDEXassets||null;}
  // Same arithmetic the desktop mint rows use: supply x price x the XLM rate. Null unless all three are
  // in, so a partial figure is never presented as a market cap.
  function mcapOf(a){
    var xu=null;
    try{ xu=window.__lxXlmUsd||null; if(!xu){var c=JSON.parse(localStorage.getItem("lumos.xlmUsd")||"null"); if(c&&+c.v>0)xu=+c.v;} }catch(_){}
    if(!a||a.supply==null||!(a.px>0)||!(xu>0))return null;
    var m=a.supply*a.px*xu, s=Math.abs(m);
    if(s>=1e9)return "$"+(m/1e9).toFixed(2)+"B";
    if(s>=1e6)return "$"+(m/1e6).toFixed(2)+"M";
    if(s>=1e3)return "$"+(m/1e3).toFixed(1)+"K";
    return "$"+m.toFixed(2);
  }
  // #3/#7: a.chg is the move against XLM -- that is what trade_aggregations measure. On a day when XLM
  // itself rose 11%, an asset that merely held its DOLLAR value printed as a red -11%, which is what the
  // whole list was doing: USDC -10.26%, EURC -7.26%, a dollar stablecoin and a euro one apparently
  // collapsing on the same afternoon. The desktop table has converted to dollars for a while; this
  // renderer never did, so the same asset disagreed with itself depending on the device.
  //
  // _dexdata.js owns the conversion and publishes it; the fallback recomputes from the same cached
  // figure it writes, for the window before it has run. Null -- not the raw XLM number -- when XLM's own
  // move is unknown, because printing an XLM change under a dollar heading is precisely the bug.
  // #19: follows the shared denomination choice. _dexdata.js owns it; this is the fallback for the
  // window before that script has run, and it reads the same stored key so the two cannot disagree.
  function denom(){ try{ if(window.__lxDenom)return window.__lxDenom;
    var v=localStorage.getItem("lumos.dexDenom"); if(v==="xlm"||v==="usd")return v; }catch(_){}
    return "usd"; }
  function cu(a){
    if(denom()==="xlm")return (a&&a.chg!=null)?a.chg:null;
    try{ if(window.__lxChgShown&&window.__lxDenom!=="xlm")return window.__lxChgShown(a); }catch(_){}
    try{ if(window.__lxChgU)return window.__lxChgU(a); }catch(_){}
    if(!a||a.chg==null)return null;
    var xc=null;
    try{ if(window.__lxXlmChg!=null)xc=+window.__lxXlmChg;
      else{ var c=JSON.parse(localStorage.getItem("lumos.xlmUsd")||"null");
        if(c&&c.chg!=null&&(Date.now()-c.ts<216e5))xc=+c.chg; } }catch(_){}
    if(xc==null)return null;
    return ((1+a.chg/100)*(1+xc/100)-1)*100;
  }
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
  var VFD=${JSON.stringify(VERIFIED)};

  // What WE show as an asset home domain where the on-chain value is stale (LUMOS still declares the
  // pre-rename lumosdao.io). Display only -- never the toml fetch, which 404s on the new domain.
  var DDOM=${JSON.stringify(DOMAIN_DISPLAY)};
  function dispDom(c,i,d){ return DDOM[(c||"")+"|"+(i||"")]||d||""; }
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
    //
    // The SAME five the desktop shows: the newest LAUNCHPAD mints. This took A.slice(0,5) -- the curated
    // majors -- so the card headed "New mints on LumosCore" listed USDC, EURC, ARST, AQUA and yXLM, none
    // of which was minted here. The desktop already computes this (newest-first over the native roster),
    // so its own list is reused rather than a second one being derived that could drift from it.
    var d=null;
    try{ if(window.__lxDEXloadNative)window.__lxDEXloadNative();
         d=window.__lxDEXmints?window.__lxDEXmints():null; }catch(_){ d=null; }
    if(!d||!d.length)d=A.slice(0,3);              // roster not in yet: keep the placeholder rows (same count the card shows)
    // created is in the signature too: it arrives after the first paint, and without it the card kept
    // the rows it had built when the mint date was still unknown.
    var sig="m|"+d.map(function(a){return a.code+":"+(a.trades==null?"":a.trades)+":"+(a.created||0);}).join("|");
    if(!stale(list,sig))return;list.setAttribute("data-lxmd",sig);
    list.innerHTML=d.map(function(a){
      return '<div class="mdx-mint-row" data-lxmd-row="1" data-href="'+esc(href(a))+'">'
        +ico("mdx-mint-ic",a)
        +'<div><div class="mdx-mint-name">'+esc(a.code)+'</div>'
        // #27: this printed "lumoscore.com" under every row -- the same word three times on a card
        // already headed "New mints on LumosCore". Same line the desktop card now shows: how new it is.
        +'<div class="mdx-mint-sub">'+esc((function(){ try{ return (window.__lxDEXmintAge&&window.__lxDEXmintAge(a))||""; }catch(_){ return ""; } })()
            ||dispDom(a.code,a.issuer,a.domain)||"Stellar")+'</div></div>'
        +'<div class="mdx-mint-right">'
          +'<div class="mdx-mint-fig"><span class="v">'+esc(priceOf(a)==null?DASH:fmtPrice(priceOf(a))+" XLM")+'</span>'
          +'<span class="k">'+esc(mcapOf(a)==null?"":("MC "+mcapOf(a)))+'</span></div>'
          +'<div class="mdx-mint-fig"><span class="v2">'+esc(a.vol==null?DASH:abbr(a.vol)+" XLM")+'</span>'
          +'<span class="k">'+esc(a.trades==null?"":(num(a.trades,0)+(a.trades===1?" trade":" trades")))+'</span></div>'
        +'</div></div>';
    }).join("");
  }

  // ---- Market Movers -------------------------------------------------------------------------------
  // Reuses the layer's own moverData(), so Gainers/Losers/Volume order identically to desktop.
  function moverCat(){var t=q(".mdx-mover-tabs .active,.mdx-mover-tabs button.active");
    return t?((t.getAttribute("data-cat")||(t.textContent||"").trim().toLowerCase())):"gainers";}
  function renderMovers(){
    var list=q(".mdx-mover-list");if(!list)return;
    // The desktop layer paints this container now -- the same card, with the sparkline, volume, TVL
    // and trade count that this renderer never had. Standing down rather than racing it.
    if(window.__lxDEXmovers)return;
    var A=assets();if(!A)return;
    // Pass the category explicitly: moverData() otherwise reads the DESKTOP active-tab selector, which
    // does not exist here, so all three tabs came back as Gainers.
    var cat=moverCat();
    var d;try{d=window.__lxDEXmovers?window.__lxDEXmovers(cat):null;}catch(_){d=null;}
    // Do NOT pad an empty category with "the first four assets". Gainers and Losers are quality-gated
    // now, and on a day when nothing qualifies the honest answer is that nothing qualifies -- padding it
    // put arbitrary assets under a heading that claims they moved. Volume is never empty in practice.
    if(!d)d=[];
    if(!d.length&&!window.__lxDEXloaded)d=A.slice(0,10);       // still loading: keep the placeholder rows
    // The signature has to include the CONVERTED figure. Keyed on a.chg alone, the list would not repaint
// when XLM's own 24h move arrived a moment later -- every row would keep whatever it first rendered.
    var sig="v|"+cat+"|"+d.map(function(a){var c=cu(a);return a.code+":"+(c==null?"":c.toFixed(4));}).join("|");
    if(!stale(list,sig))return;list.setAttribute("data-lxmd",sig);
    if(!d.length){
      list.innerHTML='<div class="lxmd-empty">No '+(cat==="losers"?"losers":"gainers")
        +' right now among assets with real liquidity and holders.</div>';
      return;
    }
    list.innerHTML=d.map(function(a){var _cu=cu(a),up=(_cu||0)>=0;
      return '<div class="mdx-mover-row" data-lxmd-row="1" data-href="'+esc(href(a))+'">'
        +ico("mdx-mover-ic",a)
        +'<div class="mdx-mover-main"><div class="mdx-mover-pair">'+esc(a.code)+vtick(a)+'</div>'
        +'<div class="mdx-mover-sub">'+esc(dispDom(a.code,a.issuer,a.domain)||"Stellar")+'</div></div>'
        +'<div class="mdx-mover-right">'
        +'<div class="mdx-mover-price">'+esc(priceOf(a)==null?DASH:fmtPrice(priceOf(a))+" XLM")+'</div>'
        +'<div class="mdx-mover-pct '+(_cu==null?"":(up?"up":"down"))+'">'+esc(_cu==null?DASH:pct(n(_cu)))+'</div>'
        +'</div></div>';
    }).join("");
  }

  // ---- All Trading Pairs ---------------------------------------------------------------------------
  function mkFilter(){var t=q(".mdx-mk-filters .active,.mdx-mk-filters button.active");
    return t?((t.getAttribute("data-cat")||(t.textContent||"").trim().toLowerCase())):"all";}
  function mkQuery(){var i=q(".mdx-mk-search input");return i?String(i.value||"").trim().toLowerCase():"";}
  var MK_PER=25, mkPage=1, mkKey="";
  // ---- sorting -------------------------------------------------------------------------------------
  // The phone list has no column headers to click, so the control is a button in the search row that
  // opens a small sheet. Same five fields and the same rules as the desktop table, so a reader moving
  // between the two gets the same answer: biggest first on the first tap, tap again to flip, and rows
  // whose value has not been fetched sink to the bottom in BOTH directions rather than leading an
  // ascending sort with a wall of blanks.
  var MK_SORTS=[["px","Last price"],["chg","24H change"],["vol","Volume (24H)"],["trades","Trades (24H)"],["tvlUsd","Liquidity"]];
  var mkSort={key:"vol",dir:-1};                              // default: 24h volume, high to low
  // "24H change" has to sort on the figure the rows actually SHOW. Sorting the raw XLM move while
  // displaying the dollar move puts the list in an order the reader cannot see any reason for.
  function mkCmp(k,dir){ return function(a,b){ var x=(k==="chg"?cu(a):a[k]),y=(k==="chg"?cu(b):b[k]);
    var xn=(x==null||x!==x), yn=(y==null||y!==y);
    if(xn&&yn)return 0; if(xn)return 1; if(yn)return -1;
    return dir<0?(y-x):(x-y); }; }
  var SORT_IC='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v16"/><path d="M4 8l3-4 3 4"/><path d="M17 20V4"/><path d="M14 16l3 4 3-4"/></svg>';
  function sortLabel(){ if(!mkSort.key)return ""; for(var i=0;i<MK_SORTS.length;i++)if(MK_SORTS[i][0]===mkSort.key)return MK_SORTS[i][1]; return ""; }
  function closeSheet(){ var s=q(".lx-msheet"); if(s)s.classList.remove("open"); var b=q(".lx-msort"); if(b)b.classList.remove("on"); }
  function ensureSortUi(){
    var box=q(".mdx-mk-search"); if(!box)return;
    if(!box.__lxs){ box.__lxs=1; box.classList.add("lx-mkq");
      var b=document.createElement("button"); b.type="button"; b.className="lx-msort";
      b.setAttribute("aria-label","Sort pairs"); b.innerHTML=SORT_IC;
      box.appendChild(b);
      var sh=document.createElement("div"); sh.className="lx-msheet";
      sh.innerHTML=MK_SORTS.map(function(s){
        return '<button type="button" data-sk="'+s[0]+'"><span>'+s[1]+'</span><i></i></button>'; }).join("")
        + '<button type="button" data-sk="" class="lx-mreset"><span>Default order</span><i></i></button>'
        // #19: the denomination lives in this sheet because it is the only control surface the pair list
        // has on a phone, and it is the same kind of choice as the sort -- how the list is expressed.
        + '<div class="lx-mdsec">Change shown in</div>'
        + '<button type="button" data-dn="usd"><span>US dollars</span><i></i></button>'
        + '<button type="button" data-dn="xlm"><span>XLM</span><i></i></button>';
      box.appendChild(sh);
    }
    // keep the sheet and the button in step with the state on every render
    var bt=q(".lx-msort"); if(bt)bt.classList.toggle("act",!!mkSort.key);
    var sh2=q(".lx-msheet"); if(!sh2)return;
    [].slice.call(sh2.querySelectorAll("button[data-dn]")).forEach(function(o){
      var on=(o.getAttribute("data-dn")===denom());
      if(o.classList.contains("on")!==on)o.classList.toggle("on",on);
      var ic=o.querySelector("i"); if(ic){ var w=on?String.fromCharCode(10003):""; if(ic.textContent!==w)ic.textContent=w; }
    });
    [].slice.call(sh2.querySelectorAll("button[data-sk]")).forEach(function(o){
      var k=o.getAttribute("data-sk"), on=(k===mkSort.key)&&(k!=="");
      if(o.classList.contains("on")!==on)o.classList.toggle("on",on);
      // fromCharCode, not a "\\uXXXX" escape: this file's browser code is not emitted through a template
      // literal, so the escape survived into the page as the six literal characters ▲.
      var i=o.querySelector("i"); if(i){ var w=on?String.fromCharCode(mkSort.dir<0?9660:9650):""; if(i.textContent!==w)i.textContent=w; }
    });
  }
  // Window capture, for the same reason the desktop headers need it: the design ships a delegated
  // navigation handler on document capture, so a listener on the button itself never sees the click.
  function installSortUi(){
    if(window.__lxMDXsort)return; window.__lxMDXsort=1;
    window.addEventListener("click",function(e){
      var t=e.target; if(!t||!t.closest)return;
      var bt=t.closest(".lx-msort");
      if(bt){ e.preventDefault(); e.stopImmediatePropagation();
        var s=q(".lx-msheet"); if(s){ var open=!s.classList.contains("open"); s.classList.toggle("open",open); bt.classList.toggle("on",open); }
        return; }
      // #19: the denomination options share the sheet with the sort options, so they are matched first
      // and separately -- a [data-sk] lookup would not see them, and letting them fall through to the
      // tap-outside branch below would close the sheet without changing anything.
      var dn=t.closest(".lx-msheet button[data-dn]");
      if(dn){ e.preventDefault(); e.stopImmediatePropagation();
        var dv=dn.getAttribute("data-dn");
        try{ if(window.__lxDenomSet)window.__lxDenomSet(dv); else { window.__lxDenom=dv; localStorage.setItem("lumos.dexDenom",dv); } }catch(_){}
        // force a repaint: the row signature is built from the CONVERTED figure, so changing what that
        // figure means has to invalidate it or every row keeps the number it already had.
        try{ [".mdx-mk-list",".mdx-mover-list"].forEach(function(sel){var el=q(sel); if(el)el.removeAttribute("data-lxmd");}); }catch(_){}
        closeSheet(); try{ pass(); }catch(_){}
        return; }
      var op=t.closest(".lx-msheet button[data-sk]");
      if(op){ e.preventDefault(); e.stopImmediatePropagation();
        var k=op.getAttribute("data-sk");
        // "Default order" restores the DEFAULT, which is now volume high-to-low -- not "no sorting".
        // Clearing to "" would leave the roster order, which the label no longer describes.
        if(!k){ mkSort.key="vol"; mkSort.dir=-1; }
        else if(mkSort.key===k)mkSort.dir=-mkSort.dir;
        else { mkSort.key=k; mkSort.dir=-1; }
        mkPage=1; closeSheet(); try{ pass(); }catch(_){}
        return; }
      if(!t.closest(".lx-msheet"))closeSheet();     // a tap anywhere else puts the sheet away
    },true);
  }
  function renderPairs(){
    var list=q(".mdx-mk-list");if(!list)return;var A=assets();if(!A)return;
    var cat=mkFilter(),qy=mkQuery();
    // The native roster is not part of __lxDEXassets -- it is discovered on demand by the desktop data
    // layer (which is injected here too) so the curated roster, and the headline volume/TVL sums built
    // from it, stay exactly as they were.
    var nv=null;
    try{ if(window.__lxDEXloadNative)window.__lxDEXloadNative();
         nv=window.__lxDEXnativeList?window.__lxDEXnativeList():null; }catch(_){}
    var NL=(nv&&nv.list)||[], src;
    // All = curated majors + our own tokens; identity dedupe (LUMOS is the same object in both).
    // Identity dedupe on code+issuer. Object identity cannot catch two distinct objects describing the
    // same asset, which is how TDT reached the list twice.
    // Names deliberately prefixed. "q" is this file's DOM query helper, and a for(var q=...) loop here
    // hoists q to a local number for the WHOLE function -- so q(".mdx-mk-list") on the first line became
    // undefined(...) and renderPairs threw on every pass. pass() swallows exceptions, so the list simply
    // froze on its last good render with nothing in the console.
    var zSeen={};
    function zPut(dst,a){ if(!a)return; var id=a.code+"|"+a.issuer; if(zSeen[id])return; zSeen[id]=1; dst.push(a); }
    src=[];
    if(cat==="native"){ for(var zi=0;zi<NL.length;zi++)zPut(src,NL[zi]); }
    else { for(var zj=0;zj<A.length;zj++)zPut(src,A[zj]); for(var zk=0;zk<NL.length;zk++)zPut(src,NL[zk]); }
    var d=src.filter(function(a){
      if(cat&&cat!=="all"&&cat!=="native"){var c=String(a.cat||"").toLowerCase();
        if(c!==cat&&c+"s"!==cat)return false;}
      // code + issuer + domain. The box says "ticker or address" but the issuer was not in the haystack,
      // so pasting an address matched nothing. Desktop already searched all three.
      if(qy&&(a.code+" "+(a.issuer||"")+" "+(a.domain||"")).toLowerCase().indexOf(qy)<0)return false;
      return true;});
    // Sorted before paging, so page 1 holds the top of the SORTED list rather than the top of the
    // unsorted one re-ordered within itself.
    if(mkSort.key)d=d.slice().sort(mkCmp(mkSort.key,mkSort.dir));
    try{ ensureSortUi(); installSortUi(); }catch(_){}
    // A new filter, search or order starts at page 1; a data refresh does not.
    var fkey=cat+"|"+qy+"|"+mkSort.key+mkSort.dir; if(mkKey!==fkey){ mkKey=fkey; mkPage=1; }
    var pages=Math.max(1,Math.ceil(d.length/MK_PER)); if(mkPage>pages)mkPage=pages;
    var start=(mkPage-1)*MK_PER, all=d; d=all.slice(start,start+MK_PER);
    // Ask the data layer to price THIS page's rows. Only the five newest launchpad tokens are priced up
    // front; the rest are fetched when a row is rendered, and the desktop list does that itself. Nothing
    // here ever asked, so 26 of 32 sat at "0 XLM / —" -- and they had not simply never traded:
    // LIBERATOR, BLA and TDT had each traded within the hour. It was a missing request, not a dead market.
    // priceVisible dedupes and caches, so calling it per render is cheap and repaint-safe.
    try{ if(window.__lxDEXpriceRows)window.__lxDEXpriceRows(d); }catch(_){}
    var sig="p|"+denom()+"|"+cat+"|"+qy+"|"+mkPage+"/"+pages+"|"+d.map(function(a){return a.code+":"+(priceOf(a)==null?"":a.px);}).join("|");
    if(!stale(list,sig))return;list.setAttribute("data-lxmd",sig);
    if(!d.length){list.innerHTML='<div class="lxmd-empty">No pairs match</div>';return;}
    var pgh=pages<2?"":('<div class="lxmd-pager">'
      +'<button class="lxmd-pg" data-pg="'+(mkPage-1)+'"'+(mkPage<=1?" disabled":"")+'>Prev</button>'
      +'<span class="lxmd-pg-info">Page '+mkPage+' of '+pages+'</span>'
      +'<button class="lxmd-pg" data-pg="'+(mkPage+1)+'"'+(mkPage>=pages?" disabled":"")+'>Next</button>'
      +'</div>');
    // #25: rank the curated list. The order is meaningful -- it is the sort the reader picked -- but
    // nothing on the row said so, and a list that looks unordered invites the question of why USDC
    // is first. The number is the row's position in the list as displayed, so it follows the sort.
    list.innerHTML=d.map(function(a,_i){var _cu=cu(a),up=(_cu||0)>=0;
      return '<div class="mdx-mk-row" data-lxmd-row="1" data-href="'+esc(href(a))+'">'
        +'<span class="mdx-mk-rank">#'+(_i+1)+'</span>'
        +'<div class="mdx-mk-top">'+ico("mdx-mk-ic",a)
        +'<div class="mdx-mk-meta"><div class="mdx-mk-name-row">'
        +'<span class="mdx-mk-name">'+esc(a.code)+vtick(a)+'</span>'
        +'<span class="mdx-mk-domain">'+esc(dispDom(a.code,a.issuer,a.domain)||"Stellar")+'</span></div>'
        +'<div class="mdx-mk-vol">Vol '+esc(a.vol==null?DASH:abbr(a.vol)+" XLM")+'</div></div>'
        +'<div class="mdx-mk-right">'
        +'<div class="mdx-mk-price">'+esc(priceOf(a)==null?DASH:fmtPrice(priceOf(a))+" XLM")+'</div>'
        +'<div class="mdx-mk-pct '+(_cu==null?"":(up?"up":"down"))+'">'+esc(_cu==null?DASH:pct(n(_cu)))+'</div>'
        +'</div></div></div>';
    }).join("")+pgh;
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
      // Before the row check: a pager button sits outside any [data-href], but claiming it here keeps
      // the design's own delegated handlers off it entirely.
      var pgb=t.closest(".lxmd-pg[data-pg]");
      if(pgb){ if(!pgb.disabled){ e.preventDefault(); e.stopImmediatePropagation();
          mkPage=+pgb.getAttribute("data-pg")||1; renderPairs();
          try{ var hd=q(".mdx-section-head"); if(hd&&hd.scrollIntoView)hd.scrollIntoView({block:"start"}); }catch(_){} }
        return; }
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
  // ---- Section order + mover tabs (mobile layout) ---------------------------------------------------
  // Trading pairs first, then the mints card, then Market Movers. The design ships them the other way
  // round, and each section is a run of SIBLINGS under .page (head, then its controls, then its list)
  // rather than one wrapper each -- so the whole run moves, in order, or the heads end up over the wrong
  // lists. Idempotent: it only acts when the order is actually wrong, so the 900ms pass cannot thrash it.
  function orderSections(){
    var page=q(".page"); if(!page)return;
    var kids=[].slice.call(page.children);
    function headByText(re){ for(var i=0;i<kids.length;i++){
      var k=kids[i]; if(k.className&&String(k.className).indexOf("mdx-section-head")>=0&&re.test(k.textContent||""))return k; } return null; }
    var pairsHead=headByText(/trading pairs/i), moversHead=headByText(/market movers/i);
    var mints=page.querySelector(".mdx-mints-card");
    if(!pairsHead||!moversHead||!mints)return;
    // A section is its head plus every sibling up to the next head.
    function run(head){
      var out=[head], n=head.nextElementSibling;
      while(n&&!(n.className&&String(n.className).indexOf("mdx-section-head")>=0)){ out.push(n); n=n.nextElementSibling; }
      return out;
    }
    var pairs=run(pairsHead), movers=run(moversHead);
    // Already in the wanted order? Then leave the DOM alone.
    if(pairs[0].compareDocumentPosition(mints)&Node.DOCUMENT_POSITION_FOLLOWING &&
       mints.compareDocumentPosition(movers[0])&Node.DOCUMENT_POSITION_FOLLOWING) return;
    var anchor=mints.previousElementSibling;          // keep everything above the mints card where it is
    var frag=document.createDocumentFragment();
    pairs.forEach(function(el){frag.appendChild(el);});
    frag.appendChild(mints);
    movers.forEach(function(el){frag.appendChild(el);});
    if(anchor&&anchor.parentNode===page)page.insertBefore(frag,anchor.nextSibling);
    else page.appendChild(frag);
  }
  // Volume first and selected by default: it is the tab that answers "what is actually being traded",
  // and unlike a percentage it cannot be manufactured on a dead asset. Gainers and Losers follow.
  function orderMoverTabs(){
    var bar=q(".mdx-mover-tabs"); if(!bar||bar.__lxOrd)return;
    var want=["volume","gainers","losers"], have={};
    [].slice.call(bar.children).forEach(function(b){ var c=b.getAttribute&&b.getAttribute("data-cat"); if(c)have[c]=b; });
    if(!have.volume||!have.gainers||!have.losers)return;
    bar.__lxOrd=1;
    want.forEach(function(c){ bar.appendChild(have[c]); });
    // Only claim the default when the user has not chosen yet -- re-asserting it on every pass would
    // drag them back to Volume mid-browse.
    if(!bar.__lxDef){ bar.__lxDef=1;
      want.forEach(function(c){ have[c].classList.toggle("active",c==="volume"); });
    }
  }
  function pass(){try{
    orderSections();orderMoverTabs();
    wire();renderMints();renderMovers();renderPairs();repaintIcons();
    // Hold the reveal until the ORDER is real, not merely until assets exist. The list defaults to 24h
    // volume, and __lxDEXassets appears as soon as the eight majors are priced -- the launchpad roster
    // lands after that, so revealing on assets() alone showed volume order for the majors and then
    // re-sorted when the rest arrived. __lxDEXsortReady is raised by the data layer when both halves are
    // in, and it carries that layer's own 6s backstop, so this cannot hang waiting.
    if(assets()&&(window.__lxDEXsortReady||!mkSort.key)&&!document.body.classList.contains("lxmd-ready"))
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
