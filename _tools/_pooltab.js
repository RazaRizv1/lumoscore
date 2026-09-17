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
  +   'return null; }catch(e){ return null; } }'
  // "View position" is a real anchor in the My Pools table, and a plain click on it was being resolved by the design's
  // shim back to the pools list -- RAZA: "when clicking view position, it just refreshes the pools page". Because this
  // handler is the first one registered on the page, taking the click here is the only way to be sure the anchor's own
  // href is what happens. Only this one control is claimed on a plain click; everything else is left alone.
  + 'function ownPlain(t){ try{ return !!(t.closest && t.closest("a.lx-ammview[href]")); }catch(e){ return false; } }'
  + 'function go(e){'
  +   'if(!wants(e)){'
  +     'if(!ownPlain(e.target)) return;'
  +     'var a=e.target.closest("a.lx-ammview[href]"), hp=a&&a.getAttribute("href");'
  +     'if(!hp) return;'
  +     'e.preventDefault(); e.stopImmediatePropagation();'
  +     'location.href=hp; return;'
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
