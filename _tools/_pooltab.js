// Ctrl / Cmd / Shift / middle-click on a pool opens it in a NEW TAB.
//
// RAZA 2026-09-17: "on pools main page, if i click on pool while holding CTRL, its not opening in new tab".
//
// WHY THIS IS A SEPARATE FILE IN THE <head> AND NOT A HANDLER IN _ammdata.
//
// A pool row is a <tr>, so it cannot be an anchor and has always navigated by script — and a script navigation knows
// nothing about the modifier keys a browser uses to mean "somewhere else". Three things were tried in the data layer
// first, and all three lost, for the same reason each time:
//
//   1. a modifier-aware handler on the row              — the design's nav shim ran first
//   2. the pair name rebuilt as a real <a href>         — the shim cancels the default action
//   3. the same handler moved to WINDOW capture         — the shim is also on window capture, and registered first
//
// Measured on the live page, with window.open stubbed and a real ctrl-click: window.open was never called and the page
// navigated to the shim's own resolved URL. Listener order at the same target and phase is registration order, and the
// shim is a body script — so nothing registered from the body can be ahead of it. A script in the HEAD runs before any
// body script exists, which makes this the first click handler on the page and the only place the modifier can be seen
// before the shim consumes the event.
//
// It does nothing at all unless a modifier is held AND the click is on something that names a pool, so an ordinary click
// still goes through the design's own path exactly as before.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const ID = 'lx-pooltab';

const JS = '(function(){'
  + 'function wants(e){ return !!(e && (e.ctrlKey||e.metaKey||e.shiftKey||e.button===1)); }'
  // A pool is named two ways in these tables: the pair-name anchor built by the data layer, and the row's own
  // data-href. Either is enough to open the right page.
  + 'function hrefFor(t){ try{'
  +   'var a=t.closest&&t.closest("a.lx-poollink[href],a.lx-ammcard[href]"); if(a) return a.getAttribute("href");'
  +   'var r=t.closest&&t.closest("[data-href]"); if(r) return r.getAttribute("data-href");'
  // My Pools rows carry no data-href, so a ctrl-click on one fell through to the shim and replaced the list instead of
  // opening a tab -- the same cause as the plain click below.
  +   'return rowHref(t); }catch(e){ return null; } }'
  // "View position" is a real anchor in the My Pools table, and a plain click on it was being resolved by the design's
  // shim back to the pools list -- RAZA: "when clicking view position, it just refreshes the pools page". Because this
  // handler is the first one registered on the page, taking the click here is the only way to be sure the anchor's own
  // href is what happens. Only this one control is claimed on a plain click; everything else is left alone.
  + 'function ownPlain(t){ try{ return !!(t.closest && t.closest("a.lx-ammview[href]")); }catch(e){ return false; } }'
  // A MY POOLS ROW IS NOT A LINK (RAZA 2026-09-20: "clicking on any of my pools takes me to All pools tab instead of
  // opening the pool"). Those rows carry the pool's id and its pair as attributes and are navigated by script -- and
  // the data layer DOES navigate them, correctly, from inside the design's nav shim. The shim then carries on and
  // navigates again, to its own placeholder page name, which the server 301s to the pools list: measured on the click,
  // one redirect, landing back on /pools/stellar with All Pools selected. The second navigation always wins, so the
  // click has to be taken before the shim sees it -- and this handler is the first one registered on the page.
  // The pair gives the clean two-asset url; a pool whose pair is unknown still has the /id/ route.
  + 'function rowHref(t){ try{'
  +   'var r=t.closest&&t.closest("tr.lx-ammrow[data-pool]"); if(!r) return null;'
  +   'var q=String(r.getAttribute("data-pair")||"").split("|");'
  +   'if(q.length===2&&q[0]&&q[1]) return "/pools/stellar/"+q[0]+"/"+q[1];'
  +   'var id=r.getAttribute("data-pool"); return id?("/pools/stellar/id/"+id):null;'
  + '}catch(e){ return null; } }'
  + 'function go(e){'
  +   'if(!wants(e)){'
  +     'if(ownPlain(e.target)){'
  +       'var a=e.target.closest("a.lx-ammview[href]"), hp=a&&a.getAttribute("href");'
  +       'if(!hp) return;'
  +       'e.preventDefault(); e.stopImmediatePropagation();'
  +       'location.href=hp; return;'
  +     '}'
  // a real link inside the row (the pair name, "View position") keeps its own href -- this only claims the ROW itself
  +     'if(e.target.closest&&e.target.closest("a[href]")) return;'
  +     'var hr=rowHref(e.target); if(!hr) return;'
  +     'e.preventDefault(); e.stopImmediatePropagation();'
  +     'location.href=hr; return;'
  +   '}'
  +   'if(e.button!=null && e.button!==0 && e.button!==1) return;'   // right-click belongs to the context menu
  +   'var t=e.target; if(!t||!t.closest) return;'
  +   'var h=hrefFor(t); if(!h) return;'
  // Both, and in this order: preventDefault stops an anchor's own navigation, stopImmediatePropagation stops the
  // design's shim from doing its own. Without the second, the tab opens AND the current page moves.
  +   'e.preventDefault(); e.stopImmediatePropagation();'
  +   'try{ window.open(h,"_blank","noopener"); }catch(_){ }'
  + '}'
  + 'window.addEventListener("click",go,true);'
  + 'window.addEventListener("auxclick",go,true);'
  + '})();';

const SCRIPT = '<script id="' + ID + '">' + JS + '</' + 'script>';

let pages = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = 'lumoscore-aptos-' + dev + '.html';
  let data;
  try { data = read(file); } catch (e) { console.error('  ' + file + ': missing — skipped'); continue; }
  const { json, s, e } = getContents(data);
  for (const key of Object.keys(json)) {
    if (typeof json[key] !== 'string') continue;
    let h = json[key];
    // Idempotent: the previous copy goes before a new one is written, or a rebuild stacks them.
    h = h.replace(new RegExp('<script id="' + ID + '">[' + B + 's' + B + 'S]*?<' + B + '/script>', 'g'), '');
    const hi = h.indexOf('<head>');
    if (hi < 0) { json[key] = h; continue; }
    // As early in the head as it can go: the point of this file is to be the first listener registered.
    json[key] = h.slice(0, hi + 6) + SCRIPT + h.slice(hi + 6);
    pages++;
  }
  const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
  fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
}
console.log('pool new-tab: head handler on ' + pages + ' page key(s)');
if (!pages) { console.error('  ! no page had a <head> — nothing was wired'); process.exit(1); }
