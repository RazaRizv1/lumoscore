// THE LOGO PAINTER MUST NOT RE-TRIGGER ITSELF (RAZA 2026-09-22, Android tablet: "when i connect, the dashboard kinda
// lags for ~5 seconds until becoming smooth").
//
// A logo painter baked into the design (place()/run() in every page) watches the WHOLE document with a MutationObserver
// on style/class/hidden/childList and, on any change, re-runs over every [data-logo] element -- and place() rewrote each
// one unconditionally: data-logo, textContent, background, backgroundImage, ... Those writes are themselves style
// mutations, so the observer fired again, 120ms later it ran again, and so on for as long as the page was open. Measured
// in the browser: the hidden swap dialog's USDC icon was rewritten ~36 times a second, forever, and every pass also
// scanned every span/div on the page with getComputedStyle -- a steady cost a tablet feels, and worse while the activity
// feed is filling in (thousands of mutations, each one another full scan).
//
// The fix is the smallest one that ends the loop: place() leaves an element alone when it already shows that logo. No
// write, no mutation, no re-run. Anything that genuinely changes an icon still gets it repainted.
//
// Stored JSON-escaped inside the design containers (the "\n" below is a literal backslash-n there). Idempotent: the
// replacement does not contain its search string. Usage: node _tools/_logoloop.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const FILES = ['lumoscore-aptos-desktop.html', 'lumoscore-aptos-mobile.html'];

const OLD = "var src=srcFor(sym); if(!src) return;\\n    el.setAttribute('data-logo',sym);";
const NEW = "var src=srcFor(sym); if(!src) return;\\n    if(el.getAttribute('data-logo')===sym&&!el.textContent&&(el.style.backgroundImage||'').indexOf(src)>=0) return;"
  + "\\n    el.setAttribute('data-logo',sym);";
if (NEW.indexOf(OLD) >= 0) { console.error('logoloop: replacement contains its search string'); process.exit(1); }

let total = 0;
for (const f of FILES) {
  const p = path.join(ROOT, f);
  let s = fs.readFileSync(p, 'utf8');
  const n = s.split(OLD).length - 1;
  if (n) { s = s.split(OLD).join(NEW); fs.writeFileSync(p, s, 'utf8'); }
  const done = s.split("(el.style.backgroundImage||'').indexOf(src)>=0) return;").length - 1;
  console.log(f + ': patched ' + n + ', painters now idempotent: ' + done);
  total += n;
}
console.log('logoloop: ' + (total ? 'applied' : 'already applied'));
