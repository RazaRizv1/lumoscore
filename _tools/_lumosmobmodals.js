// LUMOS token page, MOBILE: port the Swap and Add-Liquidity modals across from the desktop build.
//
// The mobile page already carries both triggers -- data-open-modal="modalSwap" and
// data-open-modal="createPoolModal" -- and the design's generic handler resolves those by id. But the
// modals themselves were never included in the mobile markup, so the lookup found nothing and returned
// silently: both buttons were dead, with no error and nothing on screen.
//
// So this is a markup gap, not a wiring one. Lifting the two dialogs over with their ids intact is enough
// for the existing triggers to work; nothing needs re-binding. It also makes the page qualify for
// _swapcalc (which keys off id="modalSwap"), so the swap engine attaches on mobile the same way it does
// on desktop -- run this BEFORE _swapcalc.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const IDS = ['modalSwap', 'createPoolModal'];
const MARK = '<!--lx-mobmodals-->';

// The page's own opener binds once, up front, with querySelectorAll('[data-open-modal]') -- so whether it
// catches a button depends on script order, and on this page it does not catch these two. Verified: the
// markup and CSS are fine (adding .open renders the dialog correctly at 375px); the click simply never
// reaches openModal. A delegated listener on document has no ordering to get wrong -- it works for any
// trigger, whenever it appears. Harmless if the native binder also fires: adding an existing class is a
// no-op. Kept to this page's mobile build only.
const OPENER = '<script id="lx-mobmodal-open">(function(){if(window.__lxMobModal)return;window.__lxMobModal=1;'
  + 'function ov(id){return document.getElementById(id);}'
  + 'document.addEventListener("click",function(e){var t=e.target;if(!t||!t.closest)return;'
  + 'var o=t.closest("[data-open-modal]");'
  + 'if(o){var m=ov(o.getAttribute("data-open-modal"));if(m){e.preventDefault();m.classList.add("open");document.body.classList.add("modal-open");}return;}'
  + 'var c=t.closest("[data-close],[data-close-modal],.modal-close");'
  + 'if(c){var mm=c.closest(".modal-overlay");if(mm){e.preventDefault();mm.classList.remove("open");}}'
  // tapping the backdrop closes, same as the design does elsewhere
  + 'else if(t.classList&&t.classList.contains("modal-overlay")){t.classList.remove("open");}'
  + 'if(!document.querySelector(".modal-overlay.open"))document.body.classList.remove("modal-open");'
  + '},false);})();</' + 'script>';

// Pull a complete element out by id, counting its own tag so nested markup survives intact.
function extractById(html, id) {
  const at = html.indexOf('id="' + id + '"');
  if (at < 0) return null;
  const start = html.lastIndexOf('<', at);
  if (start < 0) return null;
  const nm = /^<([a-zA-Z0-9-]+)/.exec(html.slice(start, start + 40));
  if (!nm) return null;
  const tag = nm[1];
  const re = new RegExp('<\\/?' + tag + '\\b[^>]*>', 'g');
  re.lastIndex = start;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    if (m[0][1] === '/') depth--; else if (m[0][m[0].length - 2] !== '/') depth++;
    if (depth === 0) return html.slice(start, m.index + m[0].length);
  }
  return null;
}

let done = 0, skipped = 0;
for (const chain of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain', 'stellar', 'xrpl']) {
  let dData, mData;
  try { dData = read(`lumoscore-${chain}-desktop.html`); mData = read(`lumoscore-${chain}-mobile.html`); }
  catch (e) { continue; }

  const D = getContents(dData);
  const M = getContents(mData);

  // the source of truth is whichever desktop key actually holds both dialogs
  let src = null;
  for (const k of Object.keys(D.json)) {
    if (k.indexOf('lumos-token') < 0) continue;
    const blocks = IDS.map(id => extractById(D.json[k], id));
    if (blocks.every(Boolean)) { src = blocks; break; }
  }
  if (!src) { skipped++; continue; }

  let changed = false;
  for (const k of Object.keys(M.json)) {
    if (k.indexOf('lumos-token') < 0) continue;
    let h = M.json[k];
    // idempotent: drop a previous port before adding one
    h = h.replace(new RegExp(MARK + '[\\s\\S]*?' + MARK, 'g'), '');
    // if the real markup is already there for some other reason, leave the page alone
    if (IDS.every(id => h.indexOf('id="' + id + '"') >= 0)) continue;
    const bi = h.lastIndexOf('</body>');
    if (bi < 0) continue;
    h = h.slice(0, bi) + MARK + src.join('') + OPENER + MARK + h.slice(bi);
    M.json[k] = h; changed = true; done++;
  }
  if (changed) {
    const ser = JSON.stringify(M.json).split('</').join('<' + B + '/');
    fs.writeFileSync(`lumoscore-${chain}-mobile.html`, mData.slice(0, M.s) + ser + mData.slice(M.e), 'utf8');
  }
}
console.log('lumos-token mobile modals ported into ' + done + ' page keys' + (skipped ? ' (' + skipped + ' chains had no desktop source)' : ''));
