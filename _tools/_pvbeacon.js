// The first-party page-view beacon (see functions/lxapi/pv.js for what is stored and why).
//
// One POST per page load, sent with sendBeacon so it never delays the page and survives navigation. Only on
// lumoscore.com itself: staging, previews and localhost never send, so a test cannot inflate the real figures.
// Skipped for automation (navigator.webdriver). The session id is random, lives in sessionStorage for that browsing
// session only, and is the only thing that ties one page view to the next -- which is exactly what a bounce rate
// needs and nothing more.
//
// Every public page of both layouts; never the admin pages. Idempotent: strips its own block before re-adding it.
// Usage: node _tools/_pvbeacon.js
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const SCRIPT = '<script id="lx-pv">' + `(function(){
if(window.__lxPv)return; window.__lxPv=1;
try{
  var h=location.hostname.replace(/^www\\./,"");
  if(h!=="lumoscore.com")return;
  if(navigator.webdriver)return;
  var sid="";
  try{ sid=sessionStorage.getItem("lx.sid")||""; }catch(_){}
  if(!/^[a-z0-9]{12,40}$/.test(sid)){
    sid=(Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2)+Date.now().toString(36)).replace(/[^a-z0-9]/g,"").slice(0,32);
    try{ sessionStorage.setItem("lx.sid",sid); }catch(_){}
  }
  var ref="";
  try{ if(document.referrer){ var rh=new URL(document.referrer).hostname.replace(/^www\\./,""); if(rh&&rh!==h) ref=rh; } }catch(_){}
  var body=JSON.stringify({sid:sid,path:location.pathname,ref:ref});
  var sent=false;
  try{ if(navigator.sendBeacon) sent=navigator.sendBeacon("/lxapi/pv",new Blob([body],{type:"application/json"})); }catch(_){}
  if(!sent){ try{ fetch("/lxapi/pv",{method:"POST",headers:{"content-type":"application/json"},body:body,keepalive:true}).catch(function(){}); }catch(_){} }
}catch(_){}
})();` + '</' + 'script>';

let files = 0, pages = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = 'lumoscore-aptos-' + dev + '.html';
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;
  for (const k of Object.keys(json)) {
    if (!/\.html$/.test(k) || /^lumoscore-admin-/.test(k)) continue;
    let h = json[k]; if (typeof h !== 'string') continue;
    const before = h;
    h = h.replace(/<script id="lx-pv">[\s\S]*?<\/script>/g, '');
    const bi = h.lastIndexOf('</body>');
    if (bi < 0) continue;
    h = h.slice(0, bi) + SCRIPT + h.slice(bi);
    if (h !== before) { json[k] = h; changed = true; }
    pages++;
  }
  if (changed) {
    const ser = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + ser + data.slice(e), 'utf8');
    files++;
  }
}
console.log('page-view beacon on ' + pages + ' public page keys across ' + files + ' file(s)');
