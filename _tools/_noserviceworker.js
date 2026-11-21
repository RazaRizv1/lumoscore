// THIS SITE HAS NO SERVICE WORKER, SO IT REMOVES ANY IT FINDS.
//
// RAZA, 2026-10-17, on his iPhone refreshing lumoscore.com:
//
//     Safari can't open the page.
//     The error was: "FetchEvent.respondWith received an error: TypeError: Load failed".
//
// That message comes from ONE place: an active service worker whose fetch handler rejected. Safari
// prints it instead of the page, so the whole site is a blank error screen until the worker decides
// otherwise. His cleared after a few seconds, which is luck, not design — it is a worker we do not
// control deciding to fail and then not fail.
//
// IT IS NOT OURS, and that was checked rather than assumed, four ways:
//   * the served HTML on lumoscore.com AND lumoscore.pages.dev — no registration, no manifest
//   * the whole deploy artifact — zero hits for serviceWorker / workbox / FetchEvent / respondWith,
//     including the bracket form navigator['serviceWorker'] and the vendored bundles
//   * both repos' transforms
//   * git history — no worker file ever added, no registration ever committed
//   * /sw.js, /service-worker.js and /serviceworker.js all 404 in production
//
// So it is a leftover registered against that origin by whatever the domain served before this
// build, still intercepting every navigation.
//
// WHY A KILL SWITCH IN THE PAGE RATHER THAN A FILE AT /sw.js. A worker only updates when the browser
// re-fetches THE EXACT SCRIPT URL it was registered with, and we do not know that path — shipping a
// self-unregistering /sw.js only helps if it happens to be the one. getRegistrations() returns every
// registration on the origin whatever its path, so unregistering from the page clears all of them.
//
// Safe precisely because the checks above hold: there is no worker of ours for this to remove. If
// the site ever gains one deliberately, DELETE THIS LAYER FIRST — it would unregister it on sight.
//
// In <head> and synchronous, so it runs before anything else tries to fetch. The unregister itself
// is async and nothing waits on it: it cannot rescue the page view that is already broken, but it
// stops the next one, which is the whole point. A reload after the first visit is clean.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const HEAD = '<script id="lx-nosw">(function(){try{'
  + 'if(!navigator.serviceWorker||!navigator.serviceWorker.getRegistrations)return;'
  + 'navigator.serviceWorker.getRegistrations().then(function(rs){'
  + 'for(var i=0;i<rs.length;i++){ try{ rs[i].unregister(); }catch(_){} }'
  // The caches a dead worker left behind go too. Harmless when there are none, and leaving them is
  // how a replacement worker would pick the same stale responses straight back up.
  + 'if(rs.length&&window.caches&&caches.keys){ caches.keys().then(function(ks){'
  + 'for(var j=0;j<ks.length;j++){ try{ caches.delete(ks[j]); }catch(_){} } }).catch(function(){}); }'
  + '}).catch(function(){});'
  + '}catch(_){}})();</' + 'script>';

let files = 0, pages = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = 'lumoscore-aptos-' + dev + '.html';
  let data;
  try { data = read(file); } catch (e) { console.error('  ' + file + ': missing — skipped'); continue; }
  const { json, s, e } = getContents(data);
  files++;

  for (const k of Object.keys(json)) {
    let h = json[k];
    if (typeof h !== 'string') continue;
    if (h.indexOf('</head>') < 0) continue;

    // /g, and before re-inserting: one strip against two stale copies leaves a duplicate for ever.
    h = h.replace(/<script id="lx-nosw">[\s\S]*?<\/script>/g, '');
    h = h.replace('</head>', HEAD + '</head>');
    json[k] = h;
    pages++;
  }

  const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
  fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
}

console.log('no-service-worker: injected on ' + pages + ' page key(s) across ' + files + ' container(s)');
if (!files) { console.error('  ! no container was read'); process.exit(1); }
