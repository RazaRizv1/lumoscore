// Make the mobile bottom nav (Home / Trade / Bridge / Pools / Wallet) respond to a tap.
//
// The bar is plain markup — <a class="nb-tab" href="/wallet"> — so on a desktop pointer it just works, and
// that is why this never showed up in a browser-pane check. On a handset it did nothing: the tap never
// became the click that follows the link, so the href was never used. Nothing on the page cancels the
// touch (verified: no touchstart/touchend handler outside the chart tooltip, and hit-testing at each tab's
// centre lands inside the anchor with pointer-events:auto), so the fix is simply to stop relying on the
// synthesised click and navigate from touchend ourselves.
//
// Bound at WINDOW CAPTURE so it runs ahead of any page script, and only for anchors with a real href —
// the design's own handler owns the href="#" ones (the "More" tab opens the slide menu).
//
// A touchend is NOT automatically a tap: it also ends a scroll, and this bar sits exactly where a thumb
// finishes a swipe. Without the movement/duration guard, scrolling would navigate. The finger has to stay
// within 12px for under 600ms.
//
// Idempotent: keyed on the script id, and re-running replaces the block rather than stacking copies.
// Mobile containers only — the desktop layouts have no .nb-bar and no touch to fix.
//
// Usage: node _tools/_mobnav.js
const fs = require('fs');

const SCRIPT = `<script id="lx-mobnav">(function(){
  if(window.__lxNavWired)return; window.__lxNavWired=1;
  var t0=null;
  window.addEventListener("touchstart",function(e){
    var p=e.touches&&e.touches[0]; t0=p?{x:p.clientX,y:p.clientY,t:Date.now()}:null;
  },true);
  window.addEventListener("touchend",function(e){
    var p=e.changedTouches&&e.changedTouches[0]; if(!p||!t0)return;
    if(Math.abs(p.clientX-t0.x)>=12||Math.abs(p.clientY-t0.y)>=12||(Date.now()-t0.t)>=600)return;   // a scroll, not a tap
    var el=e.target; if(!el||!el.closest)return;
    var a=el.closest(".nb-tab[href],.bn-item[href],.bottom-nav a[href]"); if(!a)return;
    var h=a.getAttribute("href")||""; if(!h||h==="#")return;                                        // design owns href="#"
    e.preventDefault(); e.stopImmediatePropagation();
    location.href=h;
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
    if (p.indexOf('nb-tab') < 0 && p.indexOf('bottom-nav') < 0) continue;   // no bottom nav on this page
    const before = p;
    p = p.replace(/<script id="lx-mobnav">[\s\S]*?<\/script>/, '');          // re-runnable: drop the old copy
    const bi = p.lastIndexOf('</body>'); if (bi < 0) continue;
    p = p.slice(0, bi) + SCRIPT + p.slice(bi);
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
