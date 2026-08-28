// Tells /lxapi/ev that a wallet connected, so the admin dashboard's "connected wallets" figure has a
// source. Nothing on-chain records a connection, so without this the number cannot exist.
//
// WHY IT POLLS localStorage RATHER THAN HOOKING THE WALLET FLOWS: there are several ways an address
// gets set -- Freighter, Rabet, LOBSTR extension, WalletConnect, and a reconnect on load -- across
// transforms that are large and touchy. Every one of them ends at the same place: lumos.address in
// localStorage. Watching the destination catches all of them and cannot be missed by a path someone
// adds later, whereas patching each connect handler would need editing several working files and would
// silently stop covering a new one.
//
// ONE WRITE PER VISIT, not per poll: a sessionStorage marker holds the address already reported, so the
// interval costs a localStorage read and nothing else. Connecting a different wallet in the same tab
// reports again, which is correct -- that is a second distinct wallet.
//
// Public pages only. Admin pages are excluded: counting our own sessions as user connections would
// quietly inflate the very figure the admin panel is there to report.
//
// Idempotent: the block is stripped and re-added on every run.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const SCRIPT = '<script id="lx-beacon">' + `(function(){
if(window.__lxBeacon)return; window.__lxBeacon=1;
var KEY="lumos.address", MARK="lumos.ev.sent";
function cur(){ try{ var a=localStorage.getItem(KEY)||""; return /^G[A-Z2-7]{55}$/.test(a)?a:""; }catch(e){ return ""; } }
function already(a){ try{ return sessionStorage.getItem(MARK)===a; }catch(e){ return false; } }
function mark(a){ try{ sessionStorage.setItem(MARK,a); }catch(e){} }
function ping(){
  var a=cur(); if(!a||already(a))return;
  mark(a);   // marked BEFORE the request, so a slow network cannot let the interval fire it twice
  try{
    fetch("/lxapi/ev",{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({addr:a}),keepalive:true}).catch(function(){});
  }catch(e){}
}
// Fire-and-forget in every direction: the page must never wait on this, and a failure must never
// surface to the user. An analytics beacon that can break a wallet connect is not worth having.
if(document.readyState!=="loading")ping(); else document.addEventListener("DOMContentLoaded",ping);
setInterval(ping,5000);
window.addEventListener("storage",ping);
})();` + '</' + 'script>';

let pages = 0, files = 0;
for (const c of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain', 'stellar', 'xrpl']) {
  for (const dev of ['desktop', 'mobile']) {
    const file = `lumoscore-${c}-${dev}.html`;
    let data; try { data = read(file); } catch (e) { continue; }
    const { json, s, e } = getContents(data);
    let changed = false;
    for (const k of Object.keys(json)) {
      if (/^lumoscore-admin-/.test(k)) continue;          // never count our own sessions
      let h = json[k];
      h = h.replace(/<script id="lx-beacon">[\s\S]*?<\/script>/g, '');
      const bi = h.lastIndexOf('</body>');
      if (bi < 0) continue;
      h = h.slice(0, bi) + SCRIPT + h.slice(bi);
      json[k] = h; changed = true; pages++;
    }
    if (changed) {
      const ser = JSON.stringify(json).split('</').join('<' + B + '/');
      fs.writeFileSync(file, data.slice(0, s) + ser + data.slice(e), 'utf8');
      files++;
    }
  }
}
console.log('beacon: wallet-connect reporting on ' + pages + ' public page key(s) across ' + files + ' container(s)');
