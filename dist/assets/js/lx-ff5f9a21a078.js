(function(){
if(window.__lxPv)return; window.__lxPv=1;
try{
  var h=location.hostname.replace(/^www\./,"");
  if(h!=="lumoscore.com")return;
  if(navigator.webdriver)return;
  var sid="";
  try{ sid=sessionStorage.getItem("lx.sid")||""; }catch(_){}
  if(!/^[a-z0-9]{12,40}$/.test(sid)){
    sid=(Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2)+Date.now().toString(36)).replace(/[^a-z0-9]/g,"").slice(0,32);
    try{ sessionStorage.setItem("lx.sid",sid); }catch(_){}
  }
  var ref="";
  try{ if(document.referrer){ var rh=new URL(document.referrer).hostname.replace(/^www\./,""); if(rh&&rh!==h) ref=rh; } }catch(_){}
  function send(o){ var body=JSON.stringify(o), sent=false;
    try{ if(navigator.sendBeacon) sent=navigator.sendBeacon("/lxapi/pv",new Blob([body],{type:"application/json"})); }catch(_){}
    if(!sent){ try{ fetch("/lxapi/pv",{method:"POST",headers:{"content-type":"application/json"},body:body,keepalive:true}).catch(function(){}); }catch(_){} } }
  send({sid:sid,path:location.pathname,ref:ref});
  // ---- a load that took absurdly long reports itself ----------------------------------------------
  // The browser is the only party that can see this. From outside, the origin answers in ~80ms and forty
  // cache-busted probes never went over 1.5s -- yet a real load can sit for 45 seconds with nothing painted,
  // which means the time is going somewhere before the response arrives. PerformanceNavigationTiming has
  // exactly that breakdown, including nextHopProtocol: whether the browser was served over h3 or fell back
  // to h2 is the difference between "QUIC is stalling on this network" and "something else entirely".
  //
  // Runs after load, because loadEventEnd is 0 until then. Sends only past the thresholds, so this is a few
  // rows a month rather than a metric, and the server applies the same thresholds again.
  function lxPerf(){
    try{
      var n=(performance.getEntriesByType&&performance.getEntriesByType("navigation")||[])[0];
      if(!n)return;
      var ttfb=Math.round(n.responseStart||0), load=Math.round(n.loadEventEnd||0);
      if(!(ttfb>5000||load>20000))return;
      send({kind:"perf",sid:sid,path:location.pathname,
        proto:String(n.nextHopProtocol||""),nav:String(n.type||""),
        dns:Math.round((n.domainLookupEnd||0)-(n.domainLookupStart||0)),
        conn:Math.round((n.connectEnd||0)-(n.connectStart||0)),
        ttfb:ttfb,dl:Math.round((n.responseEnd||0)-(n.responseStart||0)),load:load});
    }catch(_){}
  }
  if(document.readyState==="complete")setTimeout(lxPerf,0);
  else window.addEventListener("load",function(){setTimeout(lxPerf,0);});
  // WHAT WAS PRESSED, not what was typed: the visible label of a link or button (and, for a link leaving the site, its
  // destination host). Never a field's value, an amount or an address -- inputs are ignored entirely, and a label is
  // trimmed to 80 characters. One click a second at most, 120 per page at most, so a stuck finger cannot flood it.
  // ---- where a connected wallet is connecting from ------------------------------------------------
  // A SEPARATE PING TO A SEPARATE ENDPOINT, carrying the ADDRESS AND NOTHING ELSE -- no sid, no path,
  // no referrer. That is what keeps the two records unlinkable, and it is why the privacy policy can
  // still say the page-view record holds no wallet address: it does not, and this one holds no
  // session. The country is read from the connection at the edge; nothing about it is sent from here.
  //
  // Once per address per session, so a wallet that stays connected across twenty pages is one write.
  try{
    var wa=(localStorage.getItem("lumos.address")||"").trim().toUpperCase();
    if(/^G[A-Z2-7]{55}$/.test(wa)){
      var seen=""; try{ seen=sessionStorage.getItem("lx.geo")||""; }catch(_){}
      if(seen!==wa){
        try{ sessionStorage.setItem("lx.geo",wa); }catch(_){}
        var gb=JSON.stringify({addr:wa}), gsent=false;
        try{ if(navigator.sendBeacon) gsent=navigator.sendBeacon("/lxapi/walletgeo",new Blob([gb],{type:"application/json"})); }catch(_){}
        if(!gsent){ try{ fetch("/lxapi/walletgeo",{method:"POST",headers:{"content-type":"application/json"},body:gb,keepalive:true}).catch(function(){}); }catch(_){} }
      }
    }
  }catch(_){}

  var last=0, n=0;
  document.addEventListener("click",function(e){
    try{
      var t=e.target; if(!t||!t.closest) return;
      if(t.closest("input,textarea,select,[contenteditable]")) return;
      var el=t.closest("a[href],button,[role=button]"); if(!el) return;
      var now=Date.now(); if(now-last<1000||n>=120) return; last=now; n++;
      var label=(el.getAttribute("aria-label")||el.getAttribute("title")||el.textContent||"").replace(/\s+/g," ").trim().slice(0,80);
      var href="";
      if(el.tagName==="A"){ try{ var u=new URL(el.getAttribute("href"),location.href); if(u.hostname&&u.hostname.replace(/^www\./,"")!==h) href=u.hostname.replace(/^www\./,""); }catch(_){} }
      if(!label&&!href) return;
      send({kind:"click",sid:sid,path:location.pathname,label:label,href:href});
    }catch(_){}
  },true);
}catch(_){}
})();