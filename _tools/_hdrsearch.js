// Desktop inner pages: give the header the real search FIELD, the way the Dashboard has it, and drop the
// magnifier icon button that stood in for it.
//
// Everything needed was already on these pages except the element itself:
//   - `.search-box { flex:1; max-width:340px; height:40px; ... }` is already in each page's stylesheet.
//   - The design's own script already does
//       document.querySelectorAll('.search-box input, .hero-search input').forEach(attachToSearch)
//     which is what opens #searchPopup.
// So this is markup only. No new CSS, no new wiring, nothing to keep in sync.
//
// The field goes where the Dashboard puts it — between the logo and the right-hand controls. On inner pages
// that slot holds `<div class="grow"></div>`, a pure spacer; `.search-box` is `flex:1` and takes over the
// same job, so the right-hand items stay pinned exactly where they were.
//
// Desktop only, deliberately: mobile keeps its own header treatment and was not part of the ask.
//
// Idempotent (landmine #11 — a transform's output lives in the gitignored container and re-runs forever):
// a page that already carries a .search-box is skipped, so running this twice changes nothing.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// Copied from the Dashboard header so the two are literally the same markup.
const BOX =
  '<div class="search-box">' +
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-soft)">' +
  '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
  '<input placeholder="Search assets, pools and wallets" />' +
  '</div>';

let done = 0, already = 0, noSlot = [];

for (const chain of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain', 'stellar', 'xrpl']) {
  const file = 'lumoscore-' + chain + '-desktop.html';
  let data;
  try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;

  for (const k of Object.keys(json)) {
    let h = json[k];
    if (h.indexOf('id="headerSearchBtn"') < 0) continue;      // not an inner page with the icon
    if (h.indexOf('class="search-box"') >= 0) { already++; continue; }

    const hi = h.indexOf('<header class="topbar">');
    if (hi < 0) { noSlot.push(chain + '/' + k + ' (no topbar)'); continue; }

    // Scope the spacer swap to the topbar: `grow` is a generic utility class and may well appear elsewhere
    // on the page, where replacing it would move unrelated layout.
    const head = h.slice(hi, hi + 4000);
    const gi = head.indexOf('<div class="grow"></div>');
    if (gi < 0) { noSlot.push(chain + '/' + k + ' (no .grow in topbar)'); continue; }

    h = h.slice(0, hi + gi) + BOX + h.slice(hi + gi + '<div class="grow"></div>'.length);
    // and the icon it replaces
    h = h.replace(/<button[^>]*id="headerSearchBtn"[\s\S]*?<\/button>/g, '');

    json[k] = h; changed = true; done++;
  }

  if (changed) {
    // landmine #9: the JSON lives inside a <script> tag, so `</` must be re-escaped or the container is
    // truncated on the next read — and the containers are gitignored, so there is no undo.
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}

console.log('header search field: added on ' + done + ' page keys, ' + already + ' already had one');
if (noSlot.length) console.log('  no slot found (left alone): ' + noSlot.join(', '));
