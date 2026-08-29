// Records every transaction submitted through LumosCore, so the dashboard activity feed can show the
// FREE actions -- pool creation, deposits, withdrawals, limit orders -- that pay no fee and therefore
// leave nothing on-chain tying them to us.
//
// WHY IT HOOKS THE NETWORK CALL RATHER THAN THE FLOWS. Every flow -- pools, trade, cross-chain,
// launchpad -- ends at the same place: a POST to Horizon's /transactions. Wrapping that single call
// captures all of them, catches any flow added later for free, and touches none of the working code.
// Editing four separate flows to call a recorder would be four chances to break a signing path that
// currently works, which is the one thing this codebase asks you not to do.
//
// It records only what the network accepted: the hash comes out of Horizon's own response, so a
// rejected or abandoned transaction is never recorded. Both fields sent are already public on-chain.
//
// Fire-and-forget throughout. Every branch is wrapped, the beacon result is ignored, and nothing here
// can reject a promise the app is awaiting -- a failure to record must never surface as a failed
// transaction.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const SCRIPT = '<script id="lx-actbeacon">(function(){'
  + 'if(window.__lxActB)return;window.__lxActB=1;'
  + 'var SENT={};'
  + 'function addr(){try{return localStorage.getItem("lumos.address")||"";}catch(e){return "";}}'
  + 'function rec(h){'
    + 'try{'
      + 'if(!h||SENT[h])return;'
      + 'if(!/^[0-9a-f]{64}$/i.test(h))return;'
      + 'var a=addr(); if(!/^G[A-Z2-7]{55}$/.test(a))return;'
      + 'SENT[h]=1;'
      + 'fetch("/lxapi/act",{method:"POST",headers:{"content-type":"application/json"},'
        + 'body:JSON.stringify({addr:a,hash:h}),keepalive:true}).catch(function(){});'
    + '}catch(e){}'
  + '}'
  // Horizon answers a successful submit with the transaction hash. Anything else is not an action.
  + 'function fromBody(t){try{var j=JSON.parse(t);if(j&&j.successful&&j.hash)rec(j.hash);}catch(e){}}'
  + 'function isTx(u){u=String(u||"");return u.indexOf("/transactions")>=0&&u.indexOf("horizon")>=0;}'
  // ---- fetch ----
  + 'try{var of=window.fetch;'
    + 'window.fetch=function(i,o){'
      + 'var u=(typeof i==="string")?i:(i&&i.url)||"";'
      + 'var m=((o&&o.method)||(i&&i.method)||"GET").toUpperCase();'
      + 'var p=of.apply(this,arguments);'
      + 'try{ if(m==="POST"&&isTx(u)){ p.then(function(r){'
        + 'try{ r.clone().text().then(fromBody).catch(function(){}); }catch(e){}'
        + 'return r;}).catch(function(){}); } }catch(e){}'
      + 'return p;};'
  + '}catch(e){}'
  // ---- XMLHttpRequest: the AMM flow submits through it ----
  + 'try{var oo=XMLHttpRequest.prototype.open,os=XMLHttpRequest.prototype.send;'
    + 'XMLHttpRequest.prototype.open=function(m,u){'
      + 'try{this.__lxM=String(m||"").toUpperCase();this.__lxU=u;}catch(e){}'
      + 'return oo.apply(this,arguments);};'
    + 'XMLHttpRequest.prototype.send=function(){'
      + 'try{ if(this.__lxM==="POST"&&isTx(this.__lxU)){'
        + 'this.addEventListener("load",function(){try{fromBody(this.responseText);}catch(e){}});'
      + '} }catch(e){}'
      + 'return os.apply(this,arguments);};'
  + '}catch(e){}'
  + '})();</scr' + 'ipt>';

let pages = 0, files = 0;
for (const c of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain', 'stellar', 'xrpl']) {
  for (const dev of ['desktop', 'mobile']) {
    const file = 'lumoscore-' + c + '-' + dev + '.html';
    let data; try { data = read(file); } catch (e) { continue; }
    let json, s, e; try { ({ json, s, e } = getContents(data)); } catch (err) { continue; }

    let changed = false;
    for (const k of Object.keys(json)) {
      let h = json[k];
      // idempotent: strip any previous copy before re-inserting
      const before = h;
      h = h.replace(/<script id="lx-actbeacon">[\s\S]*?<\/script>/g, '');
      const bi = h.lastIndexOf('</body>');
      if (bi < 0) { if (h !== before) { json[k] = h; changed = true; } continue; }
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
console.log('act beacon: injected on ' + pages + ' page keys across ' + files + ' container(s)');
