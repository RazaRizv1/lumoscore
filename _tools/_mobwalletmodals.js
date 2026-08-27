// The phone wallet's Send / Receive / Swap buttons did nothing.
//
// The buttons are there, and so is the handler -- the page delegates clicks on [data-open-modal] to
// openModal(id). What was never shipped on the phone build is the three modals those buttons name.
// document.getElementById("modalSend") returned null, openModal bailed, and the tap was swallowed.
//
// The desktop build has all three, fully wired by _walletdata.js (which runs on the phone page too),
// and the phone page already carries every .modal-overlay / .modal-head / .modal-body rule needed to
// style them -- only the markup was absent. So this copies the three overlays across at build time
// rather than writing a second set of modals that would then have to be kept in step.
//
// Copied from the DESKTOP container key, which is container-form markup already: no asset paths or
// hrefs to translate, unlike a copy taken from dist.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const WANT = ['modalSend', 'modalReceive', 'modalSwap'];
const SRC_KEY = 'lumoscore-wallet.html';
const DST_KEYS = ['lumoscore-wallet-mobile.html'];

// Walk forward from an opening tag counting nesting, so a modal containing divs is cut at ITS close
// and not at the first </div> that happens to come along.
function endOfTag(s, openIdx, tag) {
  const open = new RegExp('<' + tag + '(?=[\\s>])', 'g');
  const close = new RegExp('</' + tag + '>', 'g');
  open.lastIndex = openIdx + 1; close.lastIndex = openIdx + 1;
  let depth = 1, o = open.exec(s), c = close.exec(s);
  while (c) {
    if (o && o.index < c.index) { depth++; o = open.exec(s); continue; }
    depth--;
    if (depth === 0) return c.index + c[0].length;
    c = close.exec(s);
    while (o && c && o.index < c.index) { depth++; o = open.exec(s); }
  }
  return -1;
}

// ---- pull the three modals out of the desktop key --------------------------------------------------
let src;
try { src = getContents(read('lumoscore-aptos-desktop.html')).json[SRC_KEY]; }
catch (e) { console.log('no desktop container / wallet key — nothing to copy'); process.exit(0); }
if (!src) { console.log('desktop wallet key missing — nothing to copy'); process.exit(0); }

const parts = [];
for (const id of WANT) {
  const at = src.indexOf('id="' + id + '"');
  if (at < 0) { console.log('  !! ' + id + ' not found on desktop — skipped'); continue; }
  const start = src.lastIndexOf('<div', at);
  const end = endOfTag(src, start, 'div');
  if (start < 0 || end < 0) { console.log('  !! ' + id + ' never closes — skipped'); continue; }
  parts.push(src.slice(start, end));
}
if (!parts.length) { console.log('nothing to copy'); process.exit(0); }
const BLOCK = '<div id="lx-mobmodals">' + parts.join('') + '</div>';

// ---- put them on the phone key ---------------------------------------------------------------------
let containers = 0, pages = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = `lumoscore-aptos-${dev}.html`;
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;

  for (const k of DST_KEYS) {
    if (!json[k]) continue;
    let p = json[k];
    const before = p;
    // strip a previous copy, bounded by tag counting rather than a lazy regex
    const had = p.indexOf('<div id="lx-mobmodals">');
    if (had >= 0) {
      const stop = endOfTag(p, had, 'div');
      if (stop > 0) p = p.slice(0, had) + p.slice(stop);
    }
    if (p.indexOf('</body>') < 0) continue;
    p = p.replace('</body>', BLOCK + '</body>');
    if (p !== before) { json[k] = p; changed = true; pages++; }
  }

  if (changed) {
    containers++;
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
console.log('phone wallet modals: ' + parts.length + ' copied onto ' + pages + ' page key(s) across '
  + containers + ' container(s), ' + BLOCK.length + ' chars');
