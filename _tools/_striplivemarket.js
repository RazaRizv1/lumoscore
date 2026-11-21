// Remove the "Living Market" promo banner from the containers, permanently.
//
// RAZA 2026-11-14, after seeing what it actually renders: "strip it everywhere".
//
// WHAT IT IS. A July tool, `inject_livemarket.js`, baked a hero into six page keys — a ticker, a
// headline and a Start Trading button — with PLACEHOLDER figures hard-coded per chain:
//
//     aptos: { name:'Aptos', base:'APT', usd:'$8.41', ... }       <- inject_livemarket.js:10
//
// A runtime script was meant to replace those with a real price. It does not run, and the banner is
// invisible on every chain that carries it. Measured on production 2026-11-14 in a browser:
//
//   /trade/xrpl   element present, 0x0, offsetParent null   "APT $8.41 ▲ 2.41%"
//   /pools/xrpl   element present, invisible
//   /trade/near   element present, invisible, and the text reads
//                 "The most advanced DEX on Stellar" ON A NEAR PAGE, ticker "NEAR $8.41 ▲ 2.41%"
//
// Same $8.41 and same 2.41% on both, for two different assets, one of which (APT) is a chain
// LumosCore does not serve. So it is not a stale price; it is the placeholder, shipped.
//
// WHY REMOVE RATHER THAN FIX. Nothing renders it, so nobody reads it — this is not
// [[one-source-refusing-is-not-no-source]], where deleting a figure users read would be a product
// change. It is hidden markup that LIES ([[hidden-markup-still-lies]]): invisible to a reader,
// present in the served HTML, where a crawler reads a wrong chain name and a fake price.
//
// WHY A TRANSFORM AND NOT A STRIP OF dist/. The banner lives in the CONTAINERS, not in a build step
// — `inject_livemarket.js` is wired into no recipe (its only other copies are in worktrees and
// _BACKUP_* folders), so nothing will put it back. Stripping `dist/` or `.deploy` instead is what
// made this a manual chore on every single release: production 11-14h stripped it by hand, and the
// NEAR chat had to strip it again for `5564d500`. Removing it at the source ends that.
//
// THE ELEMENT IS NESTED DIVS, so its end is found by walking the tag stack. `<div class="lumos-promo">
// … <div>…</div> … </div>` cut at the first `</div>` leaves a dangling tail that closes something
// else — which is how a page loses its footer and nothing errors.
//
// Idempotent: a second run finds nothing and reports 0, which is the whole point of printing counts.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const FILES = ['lumoscore-aptos-desktop.html', 'lumoscore-aptos-mobile.html'];
const WRITE = process.argv.includes('--write');

function cutBalanced(s, startIdx) {
  const re = /<\/?div\b[^>]*>/gi;
  re.lastIndex = startIdx;
  let depth = 0, m;
  while ((m = re.exec(s))) {
    if (m[0][1] === '/') { depth--; if (depth === 0) return [startIdx, m.index + m[0].length]; }
    else if (!m[0].endsWith('/>')) depth++;
  }
  return null;
}

let files = 0, styles = 0, promos = 0, keys = 0, unbalanced = 0;
for (const file of FILES) {
  let data;
  try { data = read(file); } catch (e) { console.error('  ' + file + ': missing — skipped'); continue; }
  const { json, s, e } = getContents(data);
  files++;
  let touched = 0;

  for (const k of Object.keys(json)) {
    let h = json[k];
    if (typeof h !== 'string') continue;
    const before = h;

    // 1. the stylesheet layer
    const sOpen = h.indexOf('<style id="lx-livemarket"');
    if (sOpen >= 0) {
      const sEnd = h.indexOf('</style>', sOpen);
      if (sEnd > sOpen) { h = h.slice(0, sOpen) + h.slice(sEnd + 8); styles++; }
    }

    // 2. every lumos-promo element (there is normally one per page key)
    for (;;) {
      const i = h.search(/<div[^>]*class="[^"]*\blumos-promo\b/);
      if (i < 0) break;
      const span = cutBalanced(h, i);
      // LEAVE IT RATHER THAN GUESS. An unbalanced cut silently closes the wrong element.
      if (!span) { console.error('  ' + file + ' :: ' + k + ': UNBALANCED promo markup — left in place'); unbalanced++; break; }
      h = h.slice(0, span[0]) + h.slice(span[1]);
      promos++;
    }

    if (h !== before) { json[k] = h; keys++; touched++; }
  }

  if (WRITE && touched) {
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
  console.log('  ' + file.padEnd(32) + touched + ' page key(s) changed');
}

console.log('live-market banner: ' + styles + ' style tag(s), ' + promos + ' element(s) removed across '
  + keys + ' page key(s) in ' + files + ' container(s)'
  + (unbalanced ? '  — ' + unbalanced + ' LEFT IN PLACE, unbalanced' : ''));
console.log(WRITE ? '  written.' : '  DRY RUN — pass --write to apply');
if (!files) { console.error('  ! no container was read'); process.exit(1); }
if (unbalanced) process.exit(1);
