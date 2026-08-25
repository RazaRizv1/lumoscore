// The top of the Dashboard: an XLM price chart instead of a heading nobody needed.
//
// It opened with "Network stats in 24 hours" over four flat numbers. The heading restated what the
// cards already said, and the one number a reader most wants on the page they land on after
// connecting -- what XLM is doing -- was a bare "$0.1855" with no direction and no history.
//
// So the heading goes, and a chart takes its place: XLM/USD over 24H, 7D, 1M or 1Y, with the price
// and its 24h change beside it. The four stat pills stay underneath, minus the duplicate price and
// plus the current ledger -- a dashboard should say the network is alive, and the ledger height
// moving every few seconds is the cheapest honest way to say it.
//
// Data: the CoinGecko call _realdata.js already makes returns usd_24h_change, which was fetched and
// never shown. The series is market_chart, one request per timeframe, cached per timeframe so
// switching back and forth costs nothing. The ledger is one Horizon call on the existing 45s beat.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const STYLE = `<style id="lx-dashtop-css">
.lx-xlmpanel{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:stretch;
  background:var(--surface);border:1px solid var(--border);border-radius:16px;
  padding:16px 18px;margin:0 0 14px}
.lx-xt-l{min-width:0;display:flex;flex-direction:column;gap:2px}
.lx-xt-lbl{font-weight:800;font-size:13px;line-height:1.15;font-family:'JetBrains Mono',monospace;
  letter-spacing:.06em;text-transform:uppercase;color:var(--text)}
/* The XLM mark, sized to the label it sits beside. */
.lx-xt-mark{width:20px;height:20px;flex:0 0 20px;border-radius:50%;margin-right:8px;
  background:url('/assets/tokens/xlm.png') center/cover no-repeat,var(--surface-2)}
/* The ledger height, beside the eyebrow rather than in the figures below. It is a liveness signal --
   "this chain is moving" -- not a statistic, and the strip has six of those already. */
.lx-xt-ledger{font:700 10px/1 'JetBrains Mono',monospace;color:var(--text-muted);letter-spacing:.04em;
  display:inline-flex;align-items:center;gap:5px;margin-left:10px}
.lx-xt-ledger::before{content:"";width:5px;height:5px;border-radius:50%;background:var(--green,#35c07f);
  flex:0 0 5px;animation:lxLedgerPulse 2.2s ease-in-out infinite}
.lx-xt-l>.lx-xt-lbl{display:inline-flex;align-items:center}
.lx-xt-row{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
/* #13: the readout. Pinned inside the plot rather than following the pointer, because on a phone the
   finger IS the pointer and a tooltip under it is a tooltip you cannot see. Top-left, where the series
   has headroom on every timeframe this chart offers. */
.lx-xt-tip{position:absolute;left:10px;top:8px;z-index:5;display:none;pointer-events:none;
  padding:8px 10px;border-radius:10px;background:var(--surface);border:1px solid var(--border);
  box-shadow:0 10px 26px -12px rgba(0,0,0,.5);min-width:132px}
.lx-xt-tip.on{display:block}
.lx-xt-tip .d{font-weight:700;font-size:10.5px;line-height:1.3;color:var(--text-muted);margin-bottom:4px}
.lx-xt-tr{display:flex;align-items:baseline;justify-content:space-between;gap:12px;line-height:1.45}
.lx-xt-tr .k{font-weight:600;font-size:10.5px;color:var(--text-soft)}
.lx-xt-tr .v{font-weight:800;font-size:12px;font-family:'JetBrains Mono',monospace;color:var(--text)}
/* the vertical guide */
.lx-xt-dot{position:absolute;width:9px;height:9px;margin:-4.5px 0 0 -4.5px;border-radius:50%;
  background:currentColor;border:2px solid var(--surface,#fff);pointer-events:none;opacity:0;
  transition:opacity .1s;z-index:6}
.lx-xt-vl{position:absolute;top:0;bottom:0;width:1px;background:var(--border-strong,#d5d5dd);
  opacity:0;pointer-events:none;z-index:4}
.lx-xt-price{font:800 30px/1.05 'JetBrains Mono',monospace;letter-spacing:-1px;color:var(--text)}
.lx-xt-chg{font:800 12.5px/1 'JetBrains Mono',monospace;padding:5px 9px;border-radius:999px;
  display:inline-flex;align-items:center;gap:4px}
.lx-xt-chg.up{background:var(--green-soft);color:var(--green)}
.lx-xt-chg.down{background:var(--red-soft);color:var(--red)}
.lx-xt-chg.up::before{content:"\\25B2";font-size:7.5px}
.lx-xt-chg.down::before{content:"\\25BC";font-size:7.5px}
/* the timeframe control, matching the one on the trending card */
.lx-xt-tfs{display:inline-flex;gap:3px;background:var(--surface-2);padding:3px;border-radius:9px;margin-top:8px;align-self:flex-start}
.lx-xt-tfs button{padding:5px 11px;border:0;border-radius:6px;background:transparent;color:var(--text-muted);
  font:700 11.5px/1 inherit;font-family:inherit;cursor:pointer}
.lx-xt-tfs button.active{background:var(--accent);color:#fff}
.lx-xt-chart{position:relative;width:min(420px,42vw);min-width:220px;height:104px;align-self:center}
.lx-xt-chart svg{display:block;width:100%;height:100%}
/* ---- the loading state ------------------------------------------------------------------------- */
/* #3: while the price and the series were in flight this drew a label, a bare em dash, a live-looking
   timeframe control and a large empty rectangle -- which reads as broken rather than as loading. It is
   a skeleton now: the same shapes the real content will occupy, shimmering, so the panel does not
   change size when the data lands and nothing on screen claims to be a value it is not.
   Keyed on .lx-loading, which is set at build and removed on the first real paint -- never the other
   way round, so a failed fetch leaves the skeleton rather than a set of empty boxes. */
/* The shimmer is painted on a PSEUDO-element, never on the element itself, and this is not a style
   preference -- it is the only version that survives.
   A logo engine baked into the container (no _tools file emits it any more, so it cannot be fixed at
   source) sweeps every span/div/i/b holding 1-5 characters and, if the element "looks like an icon",
   replaces its text with a token image. Its test for icon-ness is a border-radius of 4px or more, or a
   background that is a gradient. A shimmer skeleton is exactly both -- so the first pass caught the
   price while it still read as a single em dash, stamped data-logo on it, and from then on blanked the
   element on EVERY pass regardless of what we wrote into it. The price went "$0.2021" and then empty,
   for good.
   On ::after, getComputedStyle(el) reports no radius and no background image, the element fails the
   test, and it is left alone. */
.lx-xlmpanel.lx-loading .lx-xt-price{color:transparent!important;position:relative;min-width:170px;
  display:inline-block}
.lx-xlmpanel.lx-loading .lx-xt-price::after,
.lx-xlmpanel.lx-loading .lx-xt-chg::after{content:"";position:absolute;inset:0;border-radius:7px;
  background:linear-gradient(90deg,rgba(127,127,140,.10) 25%,rgba(127,127,140,.22) 37%,rgba(127,127,140,.10) 63%);
  background-size:400% 100%;animation:lxDtShim 1.3s ease-in-out infinite;pointer-events:none}
.lx-xlmpanel.lx-loading .lx-xt-chg{color:transparent!important;position:relative;min-width:88px;
  background:none!important}
.lx-xlmpanel.lx-loading .lx-xt-chg::after{border-radius:999px}
.lx-xlmpanel.lx-loading .lx-xt-chg::before{content:none!important}
.lx-xlmpanel.lx-loading .lx-xt-tfs{opacity:.45;pointer-events:none}
@keyframes lxDtShim{0%{background-position:100% 50%}100%{background-position:0 50%}}
/* The empty chart box: a shimmering band with the rough profile of a line, so the space reads as a
   chart that has not arrived rather than as a hole in the card. */
.lx-xt-chart.lx-empty::after{content:"";position:absolute;inset:0;border-radius:10px;
  background:linear-gradient(to top,rgba(127,127,140,.09),rgba(127,127,140,0))}
.lx-xt-chart.lx-empty::before{content:"";position:absolute;left:0;right:0;bottom:26%;height:2px;
  border-radius:2px;opacity:.5;
  background:linear-gradient(90deg,rgba(127,127,140,.10) 25%,rgba(127,127,140,.30) 37%,rgba(127,127,140,.10) 63%);
  background-size:400% 100%;animation:lxDtShim 1.3s ease-in-out infinite}

/* ---- the stats strip, now INSIDE the card ------------------------------------------------------ */
/* #1: TVL, market cap, volume and the ledger were a separate rail of bordered pills under the chart --
   two boxes saying one thing, and the numbers read as chrome rather than as the network's state. They
   move into the panel and become a strip across its foot: the same anatomy the Trade and Pools heroes
   use (headline block, hairline, figures), so all three tops of the app now read the same way.
   The pills are NOT rebuilt here -- _realdata.js still owns them and repaints them atomically. Only
   the row's placement and its dress change, which is why a repaint cannot undo any of this. */
.lx-xlmpanel{padding-bottom:0}
.lx-xlmpanel>.status-row{grid-column:1/-1;margin:14px -18px 0;padding:13px 18px 14px;
  border-top:1px solid var(--border);border-radius:0 0 15px 15px;
  background:linear-gradient(180deg,rgba(127,127,140,.03),rgba(127,127,140,.07));
  display:grid!important;grid-template-columns:auto repeat(6,minmax(0,1fr))!important;
  gap:0!important;width:auto!important;align-items:center}
/* strip the pill costume: no ground, no border, a hairline divider between cells instead */
.lx-xlmpanel>.status-row>.status-pill{background:none!important;border:0!important;box-shadow:none!important;
  border-radius:0!important;padding:0 0 0 16px!important;margin:0!important;min-width:0!important;
  width:auto!important;display:flex!important;flex-direction:column;align-items:flex-start!important;
  gap:3px;border-left:1px solid var(--border)!important;min-height:34px;justify-content:center}
.lx-xlmpanel>.status-row>.status-pill:first-child{padding-left:0!important;border-left:0!important}
.lx-xlmpanel>.status-row .lbl{font:800 9.5px/1 'JetBrains Mono',monospace!important;letter-spacing:.13em;
  text-transform:uppercase;color:var(--text-soft)!important;order:2}
.lx-xlmpanel>.status-row .val{font:700 15px/1.1 'JetBrains Mono',monospace!important;
  letter-spacing:-.3px;color:var(--text)!important;order:1;white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis;max-width:100%}
/* the network cell keeps its logo, so it lays out sideways while the rest stack */
.lx-xlmpanel>.status-row>.status-pill.lx-netcard{flex-direction:row!important;align-items:center!important;gap:9px}
.lx-xlmpanel>.status-row .lx-netmeta{display:flex;flex-direction:column;gap:3px;min-width:0}
.lx-xlmpanel>.status-row .lx-netpill{width:26px;height:26px;flex:0 0 26px;border-radius:50%;overflow:hidden}
/* the ledger height is the "this chain is alive" signal, so it gets a pulse rather than another number */
.lx-xlmpanel>.status-row .lx-ledgerpill .val{display:inline-flex;align-items:center;gap:6px}
.lx-xlmpanel>.status-row .lx-ledgerpill .val::before{content:"";width:6px;height:6px;border-radius:50%;
  background:var(--green,#35c07f);flex:0 0 6px;animation:lxLedgerPulse 2.2s ease-in-out infinite}
@keyframes lxLedgerPulse{0%,100%{opacity:.35;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}

@media(max-width:1180px){
.lx-xlmpanel>.status-row{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:14px 0!important}
.lx-xlmpanel>.status-row>.status-pill:nth-child(3n+1){padding-left:0!important;border-left:0!important}
}
@media(max-width:860px){
.lx-xlmpanel{grid-template-columns:1fr;gap:12px;padding:14px 14px 0}
.lx-xt-chart{width:100%;min-width:0;height:92px}
.lx-xt-price{font-size:25px}
.lx-xlmpanel>.status-row{margin:12px -14px 0;padding:12px 14px 13px;
  grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:13px 0!important}
.lx-xlmpanel>.status-row>.status-pill{padding-left:14px!important}
.lx-xlmpanel>.status-row>.status-pill:nth-child(2n+1){padding-left:0!important;border-left:0!important}
/* the network cell spans the row, so the five figures below it pair up cleanly two by two */
.lx-xlmpanel>.status-row>.status-pill.lx-netcard{grid-column:1/-1;padding-left:0!important;border-left:0!important}
.lx-xlmpanel>.status-row>.status-pill.lx-netcard~.status-pill:nth-child(2n){padding-left:0!important;border-left:0!important}
.lx-xlmpanel>.status-row>.status-pill.lx-netcard~.status-pill:nth-child(2n+1){padding-left:14px!important;border-left:1px solid var(--border)!important}
.lx-xlmpanel>.status-row .val{font-size:14px!important}
}
</style>`;

const SCRIPT = `<script id="lx-dashtop">(function(){
  if(window.__lxDashTop)return;window.__lxDashTop=1;
  function net(){try{return (localStorage.getItem("lumos.network")||localStorage.getItem("lumos.chain")||"").toLowerCase();}catch(_){return "";}}
  if(net()!=="stellar")return;
  var DAYS={"24H":1,"7D":7,"1M":30,"1Y":365}, tf="24H", cache={}, series=null;
  function j(u){return fetch(u).then(function(r){if(!r.ok)throw new Error(r.status);return r.json();});}
  function money(n){n=+n||0;return "$"+(n<1?n.toFixed(4):n.toFixed(2));}
  function build(){
    var row=document.querySelector(".status-row"); if(!row)return null;
    // Document-wide, NOT host.querySelector. Once the strip has moved inside the panel, row.parentNode
    // IS the panel -- and an element is not its own descendant, so the host lookup found nothing and
    // this built a SECOND panel inside the first one. Everything then painted into the copy: the price
    // stayed a dash and the chart stayed empty on the panel you could actually see.
    var p=document.querySelector(".lx-xlmpanel");
    if(p)return p;
    var host=row.parentNode; if(!host)return null;
    p=document.createElement("div"); p.className="lx-xlmpanel lx-loading"; p.setAttribute("data-lx-noswap","1");
    p.innerHTML='<div class="lx-xt-l">'
      // #15: the asset this panel is about was named in 10px uppercase mono -- smaller than any figure
      // under it, and with no mark at all, so the panel opened without saying whose price it was.
      // The logo is the one already served for XLM everywhere else on the site, not a new asset.
      +'<span class="lx-xt-mark" aria-hidden="true"></span>'
      +'<span class="lx-xt-lbl">Stellar (XLM)</span>'
      +'<div class="lx-xt-row"><span class="lx-xt-price">\\u2014</span><span class="lx-xt-chg"></span></div>'
      +'<div class="lx-xt-tfs">'
        +'<button type="button" data-lxnonav="1" data-tf="24H" class="active">24H</button>'
        +'<button type="button" data-lxnonav="1" data-tf="7D">7D</button>'
        +'<button type="button" data-lxnonav="1" data-tf="1M">1M</button>'
        +'<button type="button" data-lxnonav="1" data-tf="1Y">1Y</button>'
      +'</div></div>'
      +'<div class="lx-xt-chart lx-empty"></div>';
    host.insertBefore(p,row);
    p.appendChild(row);            // #1: the strip lives inside the card -- see place()
    // The dashboard maps clicked label text to a destination, so a control inside it needs the
    // design's own opt-out or "1M" and friends navigate the page away.
    [].slice.call(p.querySelectorAll(".lx-xt-tfs button")).forEach(function(b){
      b.addEventListener("click",function(e){
        try{e.preventDefault();e.stopPropagation();}catch(_){}
        var t=b.getAttribute("data-tf"); if(t===tf)return; tf=t;
        [].slice.call(p.querySelectorAll(".lx-xt-tfs button")).forEach(function(x){x.classList.toggle("active",x===b);});
        load();
      });
    });
    return p;
  }
  function draw(pts){
    var p=build(); if(!p)return;
    var box=p.querySelector(".lx-xt-chart"); if(!box)return;
    if(!pts||pts.length<2){ box.classList.add("lx-empty"); box.innerHTML=""; return; }
    box.classList.remove("lx-empty");
    var W=420,H=104,PAD=6,n=pts.length;
    var mn=Math.min.apply(null,pts),mx=Math.max.apply(null,pts),rg=(mx-mn)||Math.abs(mx)||1;
    var up=pts[n-1]>=pts[0], col=up?"#35c07f":"#ff5b5b";
    var d="";
    for(var i=0;i<n;i++){
      var x=(i/(n-1))*W, y=H-PAD-((pts[i]-mn)/rg)*(H-PAD*2);
      d+=(i?"L":"M")+x.toFixed(1)+" "+y.toFixed(1);
    }
    var gid="lxxt"+(up?"u":"d");
    box.innerHTML='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">'
      +'<defs><linearGradient id="'+gid+'" x1="0" y1="0" x2="0" y2="1">'
      +'<stop offset="0" stop-color="'+col+'" stop-opacity=".26"/>'
      +'<stop offset="1" stop-color="'+col+'" stop-opacity="0"/></linearGradient></defs>'
      +'<path d="'+d+' L'+W+' '+H+' L0 '+H+' Z" fill="url(#'+gid+')" stroke="none"></path>'
      +'<path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"></path>'
      +'</svg>';
    box.__lxpts=pts;
    box.__lxcol=col;                       // so the dot can match the line it marks
    wireHover(box);
  }
  // #13: read the chart by pointing at it.
  //
  // The panel shows one price -- the latest -- and a shape. Anyone who wants to know what the price was
  // in the middle of that shape has no way to ask. Three figures on hover: the price at that point,
  // which varies along the series, and the two network facts the panel is already fetching for the strip
  // below (pool TVL and the asset count), which do not.
  //
  // The two constants are labelled plainly and shown as 'now', because presenting a current figure
  // beside a historical price without saying so would imply we have its history, which we do not.
  function wireHover(box){
    box.style.position=box.style.position||"relative";
    // The ELEMENTS are re-created on every draw, the LISTENERS only once. draw() rebuilds the box with
    // innerHTML, which removes anything appended here -- and guarding both together meant the readout
    // existed after the first render and was silently wiped by the second.
    var tip=box.querySelector(".lx-xt-tip");
    if(!tip){ tip=document.createElement("div"); tip.className="lx-xt-tip"; box.appendChild(tip); }
    var vl=box.querySelector(".lx-xt-vl");
    if(!vl){ vl=document.createElement("div"); vl.className="lx-xt-vl"; box.appendChild(vl); }
    var dot=box.querySelector(".lx-xt-dot");
    if(!dot){ dot=document.createElement("div"); dot.className="lx-xt-dot"; box.appendChild(dot); }
    if(box.__lxhov)return; box.__lxhov=1;
    function net(){
      // Read from the strip the page has already painted, so the two can never disagree and this costs
      // no request of its own.
      var out={};
      try{ [].slice.call(document.querySelectorAll(".status-row .lx-vpill")).forEach(function(p){
        var k=((p.querySelector(".lbl")||{}).textContent||"").trim().toLowerCase();
        var v=((p.querySelector(".val")||{}).textContent||"").trim();
        if(k&&v)out[k]=v; }); }catch(_){}
      return out;
    }
    function at(clientX){
      // Resolved per call, not captured: the pair above is replaced on every redraw, and a listener
      // holding the old pair would write into elements no longer in the document.
      var tip=box.querySelector(".lx-xt-tip"), vl=box.querySelector(".lx-xt-vl");
      if(!tip||!vl)return;
      var pts=box.__lxpts; if(!pts||pts.length<2)return;
      var r=box.getBoundingClientRect(); if(!r.width)return;
      var f=Math.max(0,Math.min(1,(clientX-r.left)/r.width));
      var i=Math.round(f*(pts.length-1));
      var v=pts[i];
      var n=net();
      var when=labelFor(i,pts.length);
      tip.innerHTML=(when?('<div class="d">'+when+'</div>'):'')
        +'<div class="lx-xt-tr"><span class="k">Price</span><span class="v">'+fmtUsd(v)+'</span></div>'
        ;
      tip.classList.add("on");
      vl.style.left=Math.round(f*r.width)+"px"; vl.style.opacity="1";
      // Snapped to the point the tooltip is quoting, not to the raw pointer position -- a dot a few
      // pixels off the value it names is worse than no dot. Mirrors draw()'s geometry exactly: same
      // W/H/PAD, same min/max over the same array, so the marker cannot drift from the path.
      var _dot=box.querySelector(".lx-xt-dot");
      if(_dot){
        var _H=104,_PAD=6;
        var _mn=Math.min.apply(null,pts),_mx=Math.max.apply(null,pts),_rg=(_mx-_mn)||Math.abs(_mx)||1;
        var _yv=_H-_PAD-((pts[i]-_mn)/_rg)*(_H-_PAD*2);
        _dot.style.left=Math.round((i/(pts.length-1))*r.width)+"px";
        _dot.style.top=(_yv/_H*r.height).toFixed(1)+"px";
        _dot.style.color=box.__lxcol||"var(--accent,#ea6a2c)";
        _dot.style.opacity="1";
      }
    }
    function off(){ var t=box.querySelector(".lx-xt-tip"),v=box.querySelector(".lx-xt-vl"),d=box.querySelector(".lx-xt-dot");
      if(t)t.classList.remove("on"); if(v)v.style.opacity="0"; if(d)d.style.opacity="0"; }
    box.addEventListener("mousemove",function(e){ at(e.clientX); });
    box.addEventListener("mouseleave",off);
    // Touch: read on tap and follow a drag. Deliberately NOT cleared on touchend -- on a phone the finger
    // is the pointer, so lifting it would erase the value the tap was for. A tap elsewhere clears it.
    box.addEventListener("touchstart",function(e){ if(e.touches&&e.touches[0])at(e.touches[0].clientX); },{passive:true});
    box.addEventListener("touchmove",function(e){ if(e.touches&&e.touches[0])at(e.touches[0].clientX); },{passive:true});
    document.addEventListener("touchstart",function(e){
      var t=e.target; if(t&&t.closest&&t.closest(".lx-xt-chart"))return; off();
    },{passive:true});
  }
  // The series carries values only, not timestamps, so the label is derived from the position within
  // the selected timeframe rather than invented. Whole days for the long ranges, hours for 24H.
  function labelFor(i,n){
    var back=(n-1-i); if(back===0)return "Now";
    // tf is the BUTTON label -- 24H / 7D / 1M / 1Y -- and DAYS maps it to a span. Deriving the label
    // from the position within that span is the only honest option: the series carries values, not
    // timestamps, so an exact date would be invented.
    var days=DAYS[tf]||1;
    if(days<=1){ var h=Math.round(back*24/(n-1)); return h===0?"Now":(h+"h ago"); }
    if(days>=365){ var mo=Math.round(back*12/(n-1)); return mo===0?"This month":(mo+(mo===1?" month ago":" months ago")); }
    var d=Math.round(back*days/(n-1));
    return d===0?"Today":(d+(d===1?" day ago":" days ago"));
  }
  function fmtUsd(v){ v=+v||0;
    if(v>=1)return "$"+v.toLocaleString("en-US",{maximumFractionDigits:4});
    return "$"+(+v.toFixed(6)).toString(); }
  function load(){
    if(cache[tf]){ draw(cache[tf]); return; }
    // A series from an earlier visit, drawn immediately and replaced when the live one lands. Six hours,
    // because a stale SHAPE is worth far more than an empty box and the headline price is live anyway.
    try{ var w=JSON.parse(localStorage.getItem("lumos.xlmSeries."+tf)||"null");
      if(w&&w.v&&w.v.length>1&&(Date.now()-w.ts<216e5)){ cache[tf]=w.v; draw(w.v); } }catch(_){}
    var days=DAYS[tf]||1;
    // #18: was CoinGecko, called by every visitor against a tier that allows a handful of requests a
    // minute per IP -- so the chart frequently never arrived at all. Our own edge asks once and caches,
    // and thins the series there, so this gets at most 180 points at edge speed. Warm from localStorage
    // first, so a return visit draws instantly instead of drawing nothing until the network answers.
    j("/lxapi/xlm?chart="+days)
      .then(function(d){
        var pr=(d&&d.prices)||[];
        var v=pr.map(function(x){return +x[1];}).filter(function(x){return x>0;});
        // 1Y comes back daily and 24H five-minutely; thin the long ranges so the line stays readable
        if(v.length>180){ var step=Math.ceil(v.length/180),out=[];
          for(var i=0;i<v.length;i+=step)out.push(v[i]);
          if(out[out.length-1]!==v[v.length-1])out.push(v[v.length-1]);
          v=out; }
        cache[tf]=v; try{ localStorage.setItem("lumos.xlmSeries."+tf,JSON.stringify({v:v,ts:Date.now()})); }catch(_){}
        draw(v);
      }).catch(function(){ draw(null); });
  }
  function paintPrice(c){
    if(!c)return; var p=build(); if(!p)return;
    var el=p.querySelector(".lx-xt-price"), ch=p.querySelector(".lx-xt-chg");
    if(el&&c.usd!=null){ el.textContent=money(c.usd); p.classList.remove("lx-loading"); }
    if(ch&&c.usd_24h_change!=null){
      var u=c.usd_24h_change>=0;
      ch.className="lx-xt-chg "+(u?"up":"down");
      ch.textContent=Math.abs(c.usd_24h_change).toFixed(2)+"% (24h)";
    }
  }
  // _realdata.js already asks CoinGecko for exactly this object on the same page. CoinGecko's free
  // tier is a handful of calls a minute, so this waits for that one rather than making a second --
  // and only falls back to its own request if that never arrives.
  // #18: this used to sit on its hands for SIX SECONDS waiting for _realdata.js to publish the same
  // object before it would ask for itself -- measured, that was the whole delay before a price showed.
  // The edge answer is cached and cheap, so there is no longer any reason to wait for anyone: ask
  // immediately, and take __lxCG too if it happens to arrive first.
  function price(){
    if(window.__lxCG){ paintPrice(window.__lxCG); return; }
    try{ window.addEventListener("lx:cg",function(){ paintPrice(window.__lxCG); }); }catch(_){}
    j("/lxapi/xlm").then(function(d){
      if(!d||!(+d.usd>0))return;
      paintPrice({usd:+d.usd,usd_24h_change:d.chg24});
      try{ localStorage.setItem("lumos.xlmUsd",JSON.stringify({v:+d.usd,chg:d.chg24,ts:Date.now()})); }catch(_){}
    }).catch(function(){});
  }
  // The ledger height, as the "network is alive" signal. One Horizon call, on a slow beat.
  function ledger(){
    j("https://horizon.stellar.org/ledgers?order=desc&limit=1").then(function(d){
      var r=((d._embedded&&d._embedded.records)||[])[0]; if(!r)return;
      var p=build(); if(!p)return;
      var lbl=p.querySelector(".lx-xt-lbl"); if(!lbl||!lbl.parentNode)return;
      // Removed: the ledger height is no longer shown. Any element left over from a previous build is
      // cleared here so it cannot survive a cached page.
      var el=p.querySelector(".lx-xt-ledger");
      if(el&&el.parentNode)el.parentNode.removeChild(el);
      // A stale pill from a previous build would otherwise sit in the strip as a seventh cell.
      var old=document.querySelector(".status-row .lx-ledgerpill");
      if(old&&old.parentNode)old.parentNode.removeChild(old);
    }).catch(function(){});
  }
  // #1: keep the strip inside the card. _realdata.js rebuilds the value pills in place on every stats()
  // pass -- it does not move the row -- but the dashboard's own re-skin can re-parent it, and build()
  // only runs once. Re-asserting costs an identity check and is a no-op the rest of the time.
  function place(){
    var p=document.querySelector(".lx-xlmpanel"), row=document.querySelector(".status-row");
    if(!p||!row)return;
    if(row.parentNode!==p||p.lastElementChild!==row)p.appendChild(row);
  }
  // _realdata.js rebuilds the four pills on every stats() pass, which drops ours -- so it is
  // re-added on the same beat rather than once.
  function run(){ build(); place(); load(); price(); ledger(); }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run);
  else run();
  setInterval(function(){ place(); price(); ledger(); },45000);
  // The strip is re-parented the moment it exists rather than on the 45s beat: _realdata.js paints its
  // warm-cache values before this file's first run in some orders, and a strip that appears outside the
  // card and then jumps into it is a flash.
  try{ new MutationObserver(function(){ place(); })
    .observe(document.documentElement,{childList:true,subtree:true}); }catch(_){}
})();</script>`;

let containers = 0, pages = 0, heads = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = `lumoscore-aptos-${dev}.html`;
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;

  for (const k of Object.keys(json)) {
    let p = json[k];
    const before = p;
    p = p.replace(/<style id="lx-dashtop-css">[\s\S]*?<\/style>/, '')
         .replace(/<script id="lx-dashtop">[\s\S]*?<\/script>/, '');
    if (p.indexOf('status-row') < 0 || p.indexOf('activityList') < 0) {   // dashboard only
      if (p !== before) { json[k] = p; changed = true; }
      continue;
    }
    // the heading the chart replaces. Bounded to its own tag -- nothing else is touched.
    const h = p.replace(/<h2 class="lx-nstats">[^<]*<\/h2>\s*/g, () => { heads++; return ''; });
    if (h !== p) p = h;
    if (p.indexOf('</head>') >= 0) p = p.replace('</head>', STYLE + '</head>');
    const bi = p.lastIndexOf('</body>');
    if (bi < 0) continue;
    p = p.slice(0, bi) + SCRIPT + p.slice(bi);
    if (p !== before) { json[k] = p; changed = true; pages++; }
  }

  if (changed) {
    containers++;
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
console.log('dashboard top: XLM chart on ' + pages + ' page keys, ' + heads
  + ' heading(s) removed, across ' + containers + ' containers');
