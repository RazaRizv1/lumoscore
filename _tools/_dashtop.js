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
.lx-xt-lbl{font:800 10px/1 'JetBrains Mono',monospace;letter-spacing:.14em;text-transform:uppercase;
  color:var(--text-soft)}
.lx-xt-row{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
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
.lx-xt-chart.lx-empty::after{content:"";position:absolute;inset:0;border-radius:10px;
  background:linear-gradient(to top,rgba(127,127,140,.07),rgba(127,127,140,0))}

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
  display:grid!important;grid-template-columns:auto repeat(5,minmax(0,1fr))!important;
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
    p=document.createElement("div"); p.className="lx-xlmpanel"; p.setAttribute("data-lx-noswap","1");
    p.innerHTML='<div class="lx-xt-l">'
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
  }
  function load(){
    if(cache[tf]){ draw(cache[tf]); return; }
    var days=DAYS[tf]||1;
    j("https://api.coingecko.com/api/v3/coins/stellar/market_chart?vs_currency=usd&days="+days)
      .then(function(d){
        var pr=(d&&d.prices)||[];
        var v=pr.map(function(x){return +x[1];}).filter(function(x){return x>0;});
        // 1Y comes back daily and 24H five-minutely; thin the long ranges so the line stays readable
        if(v.length>180){ var step=Math.ceil(v.length/180),out=[];
          for(var i=0;i<v.length;i+=step)out.push(v[i]);
          if(out[out.length-1]!==v[v.length-1])out.push(v[v.length-1]);
          v=out; }
        cache[tf]=v; draw(v);
      }).catch(function(){ draw(null); });
  }
  function paintPrice(c){
    if(!c)return; var p=build(); if(!p)return;
    var el=p.querySelector(".lx-xt-price"), ch=p.querySelector(".lx-xt-chg");
    if(el&&c.usd!=null)el.textContent=money(c.usd);
    if(ch&&c.usd_24h_change!=null){
      var u=c.usd_24h_change>=0;
      ch.className="lx-xt-chg "+(u?"up":"down");
      ch.textContent=Math.abs(c.usd_24h_change).toFixed(2)+"% (24h)";
    }
  }
  // _realdata.js already asks CoinGecko for exactly this object on the same page. CoinGecko's free
  // tier is a handful of calls a minute, so this waits for that one rather than making a second --
  // and only falls back to its own request if that never arrives.
  function price(){
    if(window.__lxCG){ paintPrice(window.__lxCG); return; }
    var done=false;
    try{ window.addEventListener("lx:cg",function(){ done=true; paintPrice(window.__lxCG); }); }catch(_){}
    setTimeout(function(){
      if(done||window.__lxCG){ paintPrice(window.__lxCG); return; }
      j("https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd&include_24hr_change=true")
        .then(function(d){ paintPrice((d&&d.stellar)||null); }).catch(function(){});
    },6000);
  }
  // The ledger height, as the "network is alive" signal. One Horizon call, on a slow beat.
  function ledger(){
    j("https://horizon.stellar.org/ledgers?order=desc&limit=1").then(function(d){
      var r=((d._embedded&&d._embedded.records)||[])[0]; if(!r)return;
      var row=document.querySelector(".status-row"); if(!row)return;
      var pill=row.querySelector(".lx-ledgerpill");
      if(!pill){
        pill=document.createElement("span");
        pill.className="status-pill lx-ledgerpill"; pill.setAttribute("data-lx-noswap","");
        pill.innerHTML='<span class="lbl">Ledger</span><span class="val"></span>';
        row.appendChild(pill);
      }
      var v=pill.querySelector(".val");
      var t=String(r.sequence).replace(/\\B(?=(\\d{3})+(?!\\d))/g,",");
      if(v&&v.textContent!==t)v.textContent=t;
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
