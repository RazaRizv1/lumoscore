// Desktop inner pages: give the header the real search FIELD, sized and positioned like the Dashboard's,
// and drop the magnifier icon button that stood in for it.
//
// Layout, and the mistake worth not repeating. The Dashboard's topbar is
//     logo | .search-box | .topbar-right   with  .topbar-right { margin-left:auto }
// which is what pins the wallet chip and theme toggle to the right edge. Inner pages have no
// .topbar-right wrapper at all; their spacer is `<div class="grow">` with `.grow { flex:1 }`, and THAT is
// what pushes the right-hand items over. The first version of this transform put the field in the spacer's
// place, deleting the only flexible element in the row -- `.search-box` is `flex:1` but capped at
// max-width, so it could not absorb the slack and every control bunched up on the left.
// The field therefore goes BEFORE the spacer, never instead of it:
//     logo | .search-box | .grow | wallet | theme
//
// Sizing: inner pages style .search-box at 340x40, the Dashboard at 560x46. "Like the Dashboard" means the
// Dashboard's geometry, so a scoped rule matches width, height, padding, gap and radius. Colours are left
// to each page's own rule -- the two topbars sit on different backgrounds (Dashboard `var(--surface)`,
// inner pages a translucent blur), so copying the Dashboard's `background:var(--bg)` across would change
// contrast rather than preserve it.
//
// Everything else was already present: the `.search-box` rule itself, and the design's own
//     querySelectorAll('.search-box input, .hero-search input').forEach(attachToSearch)
// which binds focus and click to open #searchPopup. No new wiring.
//
// Desktop only, as asked; mobile keeps its own header.
//
// Idempotent, and self-correcting (landmine #11 — output lives in the gitignored container and re-runs
// forever): each run first puts back any field a previous run injected, restoring the original spacer, then
// re-inserts. So running this after the earlier, wrong version repairs the layout rather than compounding it.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const GROW = '<div class="grow"></div>';

// Same markup the Dashboard header uses.
const BOX =
  '<div class="search-box">' +
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-soft)">' +
  '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
  '<input placeholder="Search assets, pools and wallets" />' +
  '</div>';

// Geometry only, scoped to the topbar so nothing else that uses .search-box is touched.
const STYLE =
  '<style id="lx-hdrsearch-css">' +
  // flex:0 1 560px, NOT flex:1 -- the spacer beside it is also flex:1, and two growing siblings split the
  // slack evenly, which is why the field first came out at 363px instead of the Dashboard's 560. A fixed
  // basis takes its width and leaves the remainder to the spacer, which is what pins the right-hand
  // controls to the edge. It still shrinks below 560 on a narrow window.
  '.topbar .search-box{flex:0 1 560px;max-width:560px;height:46px;gap:11px;padding:0 16px;border-radius:12px;display:flex}' +
  '.topbar .search-box input{flex:1;min-width:0}' +
  '</style>';

let done = 0, repaired = 0, noSlot = [];

for (const chain of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain', 'stellar', 'xrpl']) {
  const file = 'lumoscore-' + chain + '-desktop.html';
  let data;
  try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;

  for (const k of Object.keys(json)) {
    let h = json[k];

    // Pages that never had the icon are not inner pages (the Dashboard has neither icon nor spacer).
    const wasInner = h.indexOf('id="headerSearchBtn"') >= 0 || h.indexOf(BOX) >= 0;
    if (!wasInner) continue;

    h = h.replace(/<style id="lx-hdrsearch-css">[\s\S]*?<\/style>/g, '');
    h = h.replace(/<button[^>]*id="headerSearchBtn"[\s\S]*?<\/button>/g, '');

    const hi = h.indexOf('<header class="topbar">');
    if (hi < 0) { noSlot.push(chain + '/' + k + ' (no topbar)'); json[k] = h; changed = true; continue; }
    const he = h.indexOf('</header>', hi);
    if (he < 0) { noSlot.push(chain + '/' + k + ' (unterminated topbar)'); json[k] = h; changed = true; continue; }

    // Rebuild the topbar to a known shape rather than editing it incrementally. An earlier version tried to
    // "undo then redo" and turned its own injected field back into a spacer while the original spacer was
    // already restored -- so every run added another <div class="grow">. Normalising is immune to whatever
    // state a previous run left behind, which matters because the container is gitignored and keeps its
    // history forever.
    let top = h.slice(hi, he);
    const hadBox = top.indexOf(BOX) >= 0;
    top = top.split(BOX).join('').split(GROW).join('');   // strip ours AND every spacer

    // the field and exactly one spacer go straight after the logo block
    const li = top.indexOf('<div class="logo"');
    if (li < 0) { noSlot.push(chain + '/' + k + ' (no .logo)'); json[k] = h; changed = true; continue; }
    const re = /<div\b[^>]*>|<\/div>/g;
    re.lastIndex = li;
    let depth = 0, logoEnd = -1, m;
    while ((m = re.exec(top))) {
      if (m[0].charAt(1) === '/') { depth--; if (depth === 0) { logoEnd = m.index + m[0].length; break; } }
      else depth++;
    }
    if (logoEnd < 0) { noSlot.push(chain + '/' + k + ' (logo unbalanced)'); json[k] = h; changed = true; continue; }

    top = top.slice(0, logoEnd) + BOX + GROW + top.slice(logoEnd);
    h = h.slice(0, hi) + top + h.slice(he);
    if (hadBox) repaired++;

    const bi = h.lastIndexOf('</head>');
    h = bi >= 0 ? h.slice(0, bi) + STYLE + h.slice(bi) : h;

    json[k] = h; changed = true; done++;
  }

  if (changed) {
    // landmine #9: `</` must be re-escaped or the container truncates on the next read, and containers are
    // gitignored -- there is no undo.
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}

console.log('header search field: ' + done + ' page keys (' + repaired + ' repaired from the earlier layout)');
if (noSlot.length) console.log('  no slot (left alone): ' + noSlot.join(', '));
