(function(){
  if(window.__lxDashTop)return;window.__lxDashTop=1;
  function net(){try{return (localStorage.getItem("lumos.network")||localStorage.getItem("lumos.chain")||"").toLowerCase();}catch(_){return "";}}
  // item 16 -- see the note in the transform. Only touches cards that are on screen right now.
  function lcmShowAbove(){
    try{
      var root=document.documentElement;
      if(!root.classList.contains('lcm-ready'))return;      // motion layer not in play; nothing hidden
      var els=document.querySelectorAll('.kpi-card,.quick-card,.product-card,.market-card,.activity-card');
      var vh=window.innerHeight||root.clientHeight||0;
      for(var i=0;i<els.length;i++){
        var el=els[i];
        if(el.hasAttribute('data-lcm-done'))continue;
        var r=el.getBoundingClientRect();
        if(r.top<vh&&r.bottom>0)el.setAttribute('data-lcm-done','1');
      }
    }catch(_){}
  }
  // Now, next frame, and once more after the design's own driver has had its turn -- cards that are
  // rendered late (the activity card waits on data) would otherwise miss the first pass.
  try{
    lcmShowAbove();
    if(window.requestAnimationFrame)requestAnimationFrame(lcmShowAbove);
    document.addEventListener('DOMContentLoaded',lcmShowAbove);
    // Catch cards that are laid out a frame or two after the hooks above.
    var _lcmT=0, _lcmIv=setInterval(function(){
      lcmShowAbove();
      if((_lcmT+=60)>=1500){ clearInterval(_lcmIv); }
    },60);
  }catch(_){}
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
      +'<span class="lx-xt-head">'
      +'<span class="lx-xt-mark" aria-hidden="true"></span>'
      +'<span class="lx-xt-lbl">Stellar (XLM)</span>'
      +'</span>'
      +'<div class="lx-xt-row"><span class="lx-xt-price">\u2014</span><span class="lx-xt-chg"></span></div>'
      +'</div>'
      // THE RANGE BELONGS TO THE CHART (RAZA 2026-09-19: "place 24H 7D 1M 1Y above the chart on right. this looks
      // misplaced"). Under the price it read as a setting for the price; it sets the chart's window, so it sits on top of
      // the chart, right-aligned to it. Both are still found by class inside the panel, so the wiring is unchanged.
      +'<div class="lx-xt-r">'
      +'<div class="lx-xt-tfs">'
        +'<button type="button" data-lxnonav="1" data-tf="24H" class="active">24H</button>'
        +'<button type="button" data-lxnonav="1" data-tf="7D">7D</button>'
        +'<button type="button" data-lxnonav="1" data-tf="1M">1M</button>'
        +'<button type="button" data-lxnonav="1" data-tf="1Y">1Y</button>'
      +'</div>'
      +'<div class="lx-xt-chart lx-empty"></div>'
      +'</div>';
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
})();