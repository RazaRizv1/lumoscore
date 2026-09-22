// DARK BY DEFAULT, ON EVERY PAGE AND EVERY DEVICE (RAZA 2026-09-22: "on desktop, by default it uses dark theme but on
// mobile ... I need it to be dark on both").
//
// The theme bootstrap baked into every page read the saved choice (lumos.theme) and, when there was none, SAVED the
// page's own starting attribute as if the reader had chosen it: `else{ wr(r.getAttribute('data-theme')||'dark') }`.
// Sixteen pages start as data-theme="light" -- the phone landing page among them, which is the first page a phone sees.
// So one first visit locked that device to light for good, while a desktop that had once been set to dark stayed dark.
//
// Two edits to that one script, in the design containers the build reads:
//   1. no saved choice -> dark, and dark is what gets saved;
//   2. a one-time reset (lumos.themeV=2): a saved "light" was almost always written by the bug above, not chosen, so
//      every device starts dark once. Toggling to light afterwards is kept as before (the observer still saves it).
//
// Idempotent: neither replacement contains its own search string. Usage: node _tools/_themedefault.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const FILES = ['lumoscore-aptos-desktop.html', 'lumoscore-aptos-mobile.html'];

const A_OLD = "try{var t=rd();if(t==='light'||t==='dark'){";
const A_NEW = "try{try{if(localStorage.getItem('lumos.themeV')!=='2'){localStorage.setItem('lumos.theme','dark');"
  + "localStorage.setItem('lumos.themeV','2');try{top().__lumosTheme='dark';}catch(e){}}}catch(e){}"
  + "var t=rd();if(t==='light'||t==='dark'){";
const B_OLD = "else{wr(r.getAttribute('data-theme')||'dark');}";
const B_NEW = "else{r.setAttribute('data-theme','dark');wr('dark');}";

if (A_NEW.indexOf(A_OLD) >= 0 || B_NEW.indexOf(B_OLD) >= 0) { console.error('themedefault: replacement contains its search string'); process.exit(1); }

let total = 0;
for (const f of FILES) {
  const p = path.join(ROOT, f);
  let s = fs.readFileSync(p, 'utf8');
  const a = s.split(A_OLD).length - 1, b = s.split(B_OLD).length - 1;
  s = s.split(A_OLD).join(A_NEW).split(B_OLD).join(B_NEW);
  if (a || b) fs.writeFileSync(p, s, 'utf8');
  const done = s.split("localStorage.getItem('lumos.themeV')").length - 1;
  console.log(f + ': patched ' + a + '/' + b + ', pages now dark-by-default: ' + done);
  total += a + b;
}
console.log('themedefault: ' + (total ? 'applied' : 'already applied'));
