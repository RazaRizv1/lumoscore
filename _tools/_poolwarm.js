// #19: warm the pools ranking from wherever the visitor happens to be.
//
// The ranking is built by /lxapi/pools in resumable steps -- each call advances it and answers
// {warming, scanned, phase} until it is done. On a cold cache that is roughly twenty-five seconds, and
// today the first person to open Pools pays all of it while watching a loader.
//
// Pages Functions cannot run cron on this plan, so there is no server-side way to keep it warm. The
// visitor's other page views are the only clock available: someone reading Trade or the dashboard can
// advance the build in the background at no cost to what they are looking at, and find Pools already
// warm when they get there.
//
// Deliberately modest:
//   - it does nothing until the page is idle, so it can never compete with the price and chart work
//   - per=1, because the point is to ADVANCE the build, not to fetch rows nobody will read
//   - it stops the moment the endpoint reports it is no longer warming
//   - at most four attempts, so a permanently-warming backend cannot turn every page view into a poll
//   - it skips the Pools pages themselves, which do this properly and with a progress display
//
// Idempotent: the block is removed and re-inserted on every run.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const SCRIPT = '<script id="lx-poolwarm">(function(){'
  + 'try{'
  // The XLM rate first, and on EVERY page including Pools -- see the note in the transform. Default cache
  // mode, unlike the pools warm below: here we want the browser cache to answer, not to be bypassed.
  + 'function warmRate(){ try{ fetch("/lxapi/xlm").catch(function(){}); }catch(_){} }'
  + 'if(window.requestIdleCallback)requestIdleCallback(function(){setTimeout(warmRate,1200);},{timeout:5000});'
  + 'else setTimeout(warmRate,2000);'
  // The pools pages own this properly -- netFetch drives it with a progress overlay. Anywhere else is
  // fair game. Checked at RUNTIME rather than at build time because these keys share containers.
  + 'if(document.querySelector("#poolsBody")||document.querySelector("#panelAll"))return;'
  + 'var tries=0;'
  + 'function hit(){'
  + 'if(tries++>=4)return;'
  + 'fetch("/lxapi/pools?per=1&page=1",{cache:"no-store"})'
  + '.then(function(r){return r.ok?r.json():null;})'
  + '.then(function(d){'
  // Still building -- come back and advance it again. 4s is well clear of the endpoint's own pacing.
  + 'if(d&&d.warming){ setTimeout(hit,4000); }'
  + '}).catch(function(){});'
  + '}'
  + 'function start(){ try{ hit(); }catch(_){} }'
  // Idle first, with a plain timer as the fallback for browsers without requestIdleCallback. The 2.5s
  // floor is there so this never lands inside the burst of work a page does on load.
  + 'if(window.requestIdleCallback)requestIdleCallback(function(){setTimeout(start,2500);},{timeout:6000});'
  + 'else setTimeout(start,3500);'
  + '}catch(_){}'
  + '})();</script>';

let keys = 0, containers = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = `lumoscore-aptos-${dev}.html`;
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;

  for (const k of Object.keys(json)) {
    let p = json[k];
    const before = p;
    p = p.replace(/<script id="lx-poolwarm">[\s\S]*?<\/script>/g, '');
    const bi = p.lastIndexOf('</body>');
    if (bi >= 0) { p = p.slice(0, bi) + SCRIPT + p.slice(bi); keys++; }
    if (p !== before) { json[k] = p; changed = true; }
  }

  if (changed) {
    containers++;
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
console.log('pool warm-up on ' + keys + ' page keys across ' + containers + ' containers');
