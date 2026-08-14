// The mobile bottom nav (Home / Trade / Bridge / Pools / Wallet) is design markup — a
// <nav class="nb-bar"> before </body> — and it is present on every mobile page EXCEPT the dashboard,
// where it was simply never authored. The stylesheet is already on that page (.nb-bar css is there),
// so only the markup is missing.
//
// Rather than hand-write a copy that can drift from the real one, this lifts the nav out of a page
// that already has it and re-stamps the active tab per page. Idempotent: a page that already has a
// nav is skipped, so re-running changes nothing.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// which tab is highlighted on which page
const ACTIVE = {
  'lumoscore-home-mobile.html': 'home',
  'lumoscore-dex-mobile.html': 'trade',
  'lumoscore-dex-asset-mobile.html': 'trade',
  'lumoscore-bridge-mobile.html': 'bridge',
  'lumoscore-amm-mobile.html': 'pools',
  'lumoscore-amm-pool-mobile.html': 'pools',
  'lumoscore-wallet-mobile.html': 'wallet',
};

const file = 'lumoscore-aptos-mobile.html';
let data;
try { data = read(file); } catch (e) { console.log('mobile container not found'); process.exit(0); }
const { json, s, e } = getContents(data);

// find a page that already carries the nav, and use it as the template
let tpl = null;
for (const k of Object.keys(json)) {
  const m = json[k].match(/<nav class="nb-bar">[\s\S]*?<\/nav>/);
  if (m) { tpl = m[0]; break; }
}
if (!tpl) { console.log('mobile bottom nav: no source page to copy from — nothing done'); process.exit(0); }

let added = 0, already = 0;
for (const k of Object.keys(json)) {
  let h = json[k];
  if (h.indexOf('class="nb-bar"') >= 0) { already++; continue; }
  if (h.indexOf('.nb-bar{') < 0) continue;        // page is not part of the mobile shell
  const bi = h.lastIndexOf('</body>');
  if (bi < 0) continue;

  // re-stamp the active tab for THIS page: clear the template's, then set our own
  let nav = tpl.split(' active"').join('"');
  const want = ACTIVE[k];
  if (want) nav = nav.replace('class="nb-tab" data-id="' + want + '"', 'class="nb-tab active" data-id="' + want + '"');

  json[k] = h.slice(0, bi) + nav + h.slice(bi);
  added++;
}

if (added) {
  const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
  fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
}
console.log('mobile bottom nav: added to ' + added + ' page key(s), ' + already + ' already had it');
