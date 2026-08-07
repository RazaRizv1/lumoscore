// REVERSAL (2026-07-29): undo the earlier "My Positions as an always-visible static section" change and
// restore the original design's "All Pools | My Positions" TABS. For each page that still has the injected
// .mypos-section: (1) pull the positions <table> back out of it, (2) put it back inside #panelMyPositions,
// (3) re-add the "My Positions" tab button after "All Pools", (4) delete the section + its <style>.
// Idempotent — once a page is reverted (no .mypos-section) it is skipped.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

let n = 0;
for (const c of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain']) {
  for (const dev of ['desktop', 'mobile']) {
    const file = `lumoscore-${c}-${dev}.html`;
    let data; try { data = read(file); } catch (e) { continue; }
    const { json, s, e } = getContents(data);
    let changed = false;
    for (const k of Object.keys(json)) {
      let h = json[k];
      if (h.indexOf('class="mypos-section"') < 0) continue;
      // grab the whole section (lazy up to the </div> that sits right before .table-controls)
      const secRe = /<div class="mypos-section">[\s\S]*?<\/div>\s*(?=<div class="table-controls")/;
      const m = h.match(secRe);
      if (!m) continue;
      const section = m[0];
      const tm = section.match(/<table[\s\S]*?<\/table>/);
      const table = tm ? tm[0] : '';
      const count = (table.match(/data-pool/g) || []).length;
      // 1) remove the section
      h = h.replace(secRe, '');
      // 2) restore the positions table into the (emptied) My Positions panel
      h = h.replace(/<div class="pools-card" id="panelMyPositions"[^>]*><\/div>/,
        '<div class="pools-card" id="panelMyPositions" style="display:none">' + table + '</div>');
      // 3) re-add the "My Positions" tab after "All Pools" (if it's not already there)
      if (h.indexOf('data-tab="mine"') < 0) {
        h = h.replace(/(<button[^>]*data-tab="all">All Pools <span class="count">\d+<\/span><\/button>)/,
          '$1<button data-tab="mine">My Positions <span class="count">' + count + '</span></button>');
      }
      // 4) drop the section's injected style
      h = h.replace(/<style id="lx-mypos">[\s\S]*?<\/style>/g, '');
      json[k] = h; changed = true; n++;
    }
    if (changed) {
      const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
      fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
    }
  }
}
console.log('Reverted My Positions section -> tabs on ' + n + ' page keys');
