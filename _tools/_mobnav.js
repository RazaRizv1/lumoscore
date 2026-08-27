// Make a TAP work on the mobile layouts.
//
// On this class of handset a tap never becomes the click that page scripts (and plain <a href>) rely on.
// It is invisible in a desktop browser pane, where a pointer click is real, which is why it kept coming
// back as separate bug reports: the bottom nav did nothing, asset rows did nothing, the pool list did
// nothing, the panel tabs did nothing, the explorer icon did nothing. One cause, many symptoms.
//
// So bridge it once, globally: on a touch that is actually a tap, cancel the touch's default and dispatch
// the click ourselves. Cancelling touchend is also what suppresses the browser's own synthesised click, so
// a device that WOULD have produced one still ends up with exactly one — never two.
//
// Scope and safety:
//   * only <a href> and <button>-ish elements. Form controls (input/select/textarea/label) are excluded:
//     their touch default is focus/picker behaviour, and cancelling it would break typing.
//   * anchors keep their own semantics — target=_blank opens a tab, everything else navigates. We do not
//     call location.href for in-page hrefs, we let the dispatched click run so page handlers still see it.
//   * href="#" is left entirely alone; the design owns those (e.g. the "More" tab opens the slide menu).
//   * a touchend is NOT automatically a tap — it also ends a scroll, and the bottom bar sits exactly where
//     a thumb finishes a swipe. The finger has to stay within 12px for under 600ms.
//   * bound at WINDOW CAPTURE so a page script that stops propagation cannot swallow it, and it yields to
//     any handler that already claimed the gesture (those call stopImmediatePropagation first).
//
// Idempotent: keyed on the script id, and re-running replaces the block rather than stacking copies.
// Mobile containers only — the desktop layouts have a real pointer and need none of this.
//
// Usage: node _tools/_mobnav.js
const fs = require('fs');

// #12: on a phone the whole page could be dragged out of place -- pulled down into a refresh spinner and
// rubber-banded sideways -- because nothing ever told the browser not to. overscroll-behavior:none on the
// viewport element is the documented way to decline both: the pull-to-refresh gesture and the bounce past
// the scroll limits. Deliberately NOT adding overflow-x:hidden -- the document already measures exactly
// the viewport width (checked: scrollWidth 375 at 375), and putting that on <html> is what breaks
// position:sticky. This transform is the one that visits every key of every mobile container, which is
// why the rule lives here rather than in a page-specific one.
const STYLE = `<style id="lx-mobfix">html,body{overscroll-behavior:none}<\/style>`;

const SCRIPT = `<script id="lx-mobnav">(function(){
  if(window.__lxNavWired)return; window.__lxNavWired=1;
  var t0=null, lastTap=null;
  window.addEventListener("touchstart",function(e){
    var p=e.touches&&e.touches[0]; t0=p?{x:p.clientX,y:p.clientY,t:Date.now()}:null;
    lastTap=null;               // a new finger-down starts a new gesture: never swallow a real second tap
  },true);
  window.addEventListener("touchend",function(e){
    if(e.defaultPrevented)return;                                                  // someone already handled it
    var p=e.changedTouches&&e.changedTouches[0]; if(!p||!t0)return;
    if(Math.abs(p.clientX-t0.x)>=12||Math.abs(p.clientY-t0.y)>=12||(Date.now()-t0.t)>=600)return;   // a scroll
    var el=e.target; if(!el||!el.closest)return;
    if(el.closest("input,select,textarea,label,[contenteditable]"))return;         // native focus/picker wins
    var t=el.closest("a[href],button,[role=button]"); if(!t)return;
    if(t.disabled)return;
    var h=t.tagName==="A"?(t.getAttribute("href")||""):null;
    if(h==="#")return;                                                             // design owns these
    e.preventDefault();                                                            // also suppresses any native click
    // Re-dispatch as a real click so every existing handler — ours, the design's, the browser's default
    // link activation — behaves exactly as it does with a mouse.
    lastTap={el:t,t:Date.now()};
    var ce=new MouseEvent("click",{bubbles:true,cancelable:true,view:window});
    ce.__lxBridged=1;
    t.dispatchEvent(ce);
  },true);
  // preventDefault on touchend SHOULD suppress the native compatibility click, and on most handsets it
  // does. On some it still arrives, up to a few hundred ms later — and a control that toggles then gets
  // activated twice from one finger: it opens on our click and closes on the straggler. That is the
  // "dropdown closes on the first tap, works on the second" report, and it is mobile-only by definition,
  // which is why the desktop fix did not touch it. Swallow a native click that lands on the SAME element
  // we just bridged: by construction that click is the duplicate, never a second real tap.
  window.addEventListener("click",function(e){
    if(e.__lxBridged)return;                                                       // the one we dispatched
    // Only the browser's own compatibility click may be swallowed, and that one is always TRUSTED.
    // A script-dispatched click is not, and swallowing those broke the theme toggle on mobile: it
    // suppresses the first click and re-fires el.click() inside startViewTransition, so the real
    // handler runs on a click that is untrusted, lands on the same element, and arrives well inside
    // the window below. This ate it, and the theme never changed. Any control that re-dispatches its
    // own click would have hit the same wall.
    if(!e.isTrusted)return;
    if(!lastTap)return;
    // Deliberately generous: the straggler's delay is the device's to choose, and guessing it wrong is
    // what leaves the bug in place on exactly the handsets that have it. Safe to be generous because a
    // genuine second tap begins with a touchstart, which disarms this first.
    if(Date.now()-lastTap.t>1500){ lastTap=null; return; }
    var el=e.target&&e.target.closest?e.target.closest("a[href],button,[role=button]"):null;
    if(el&&el===lastTap.el){ lastTap=null; e.preventDefault(); e.stopImmediatePropagation(); }
  },true);
})();</script>`;

// Same guard as _ammdata: this file's browser code lives in a template literal, so a single-backslash
// escape would reach the page with the backslash stripped and silently stop matching.
{
  const self = fs.readFileSync(__filename, 'utf8');
  const a = self.indexOf('const SCRIPT = `'), b = self.indexOf('</script>`;', a);
  const bad = [];
  self.slice(a, b).split(/\r?\n/).forEach((l, i) => {
    if (l.trim().indexOf('//') === 0) return;
    const rx = /(^|[^\\])\\([swdbSWDB.\/\[\]()+*?|^$-])/g;
    let m; while ((m = rx.exec(l))) bad.push('  line ' + (i + 1) + ' of SCRIPT: \\' + m[2]);
  });
  if (bad.length) { console.error('mobnav: ABORT — escapes would be stripped:\n' + bad.join('\n')); process.exit(1); }
}

const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

let files = 0, keys = 0;
for (const c of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain', 'stellar', 'xrpl']) {
  const file = `lumoscore-${c}-mobile.html`;
  let data; try { data = read(file); } catch (e) { continue; }
  let json, s, e; try { ({ json, s, e } = getContents(data)); } catch (err) { continue; }

  let changed = false;
  for (const k of Object.keys(json)) {
    let p = json[k];
    if (typeof p !== 'string') continue;
    if (p.indexOf('</body>') < 0) continue;
    const before = p;
    p = p.replace(/<script id="lx-mobnav">[\s\S]*?<\/script>/g, '');          // re-runnable: drop the old copy
    p = p.replace(/<style id="lx-mobfix">[\s\S]*?<\/style>/g, '');
    const bi = p.lastIndexOf('</body>'); if (bi < 0) continue;
    p = p.slice(0, bi) + STYLE + SCRIPT + p.slice(bi);
    if (p !== before) { json[k] = p; changed = true; keys++; }
  }
  if (changed) {
    files++;
    // Re-escape "</" as "<\/" on the way back in: this JSON lives inside a <script> tag, so an unescaped
    // </script> in any page's markup would terminate the container early and destroy the whole build.
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
console.log('mobile nav: bottom-nav tap handler on ' + keys + ' page(s) across ' + files + ' container(s)');
