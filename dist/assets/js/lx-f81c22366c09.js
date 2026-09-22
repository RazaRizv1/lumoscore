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
  // WHAT WAS PRESSED, not what was typed: the visible label of a link or button (and, for a link leaving the site, its
  // destination host). Never a field's value, an amount or an address -- inputs are ignored entirely, and a label is
  // trimmed to 80 characters. One click a second at most, 120 per page at most, so a stuck finger cannot flood it.
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