// Remove the mobile network switcher. LumosCore is Stellar-only in the app shell — there is no network
// to switch to — but the design shipped a "Network · Stellar" row in the mobile slide menu that opened a
// panel offering Hedera and XRP Ledger, with baked demo addresses (a row labelled "Stellar" carrying
// 0x00…000a). Offering a switch that cannot work is confusing at best; on a real-funds page a fake
// address is worse. This strips three things from every mobile page:
//   1. the <a data-open-network> row in .menu-links (what the user actually sees)
//   2. <div id="nsBackdrop"> and <div id="netSwitcher"> (the panel it opened)
// The design's wiring script is left alone on purpose: it opens with `if(!sw)return;`, so with the panel
// gone it no-ops. Idempotent — after one pass none of the three markers exist.
//
// Usage: node _tools/_mobnetswitch.js [--write]
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// Remove one element by depth-matching its closing tag, so the panel's nested rows go with it.
function cutElement(h, startIdx, tag) {
  if (startIdx < 0) return h;
  const open = new RegExp('<' + tag + '\\b', 'gi');
  const close = new RegExp('</' + tag + '>', 'gi');
  let depth = 0, i = startIdx;
  while (i < h.length) {
    open.lastIndex = i; close.lastIndex = i;
    const o = open.exec(h), c = close.exec(h);
    if (!c) return h;                                  // unbalanced -> refuse to cut
    if (o && o.index < c.index) { depth++; i = o.index + 1; continue; }
    depth--; i = c.index + 1;
    if (depth === 0) return h.slice(0, startIdx) + h.slice(c.index + c[0].length);
  }
  return h;
}

function stripRow(h) {
  // The menu entry: <a href="#" data-open-network="">…</a>. Loop in case a page ever carries more than
  // one. NOTE this deliberately matches the ANCHOR only — the string also appears once more per page as
  // a querySelectorAll('[data-open-network]') inside the design's wiring script, which must survive
  // intact (with no matching element it simply iterates an empty list).
  for (let guard = 0; guard < 5; guard++) {
    const m = /<a\b[^>]*\bdata-open-network\b[^>]*>/i.exec(h);
    if (!m) break;
    const next = cutElement(h, m.index, 'a');
    if (next === h) break;                              // unbalanced -> stop rather than spin
    h = next;
  }
  return h;
}

function stripPanel(h) {
  for (const id of ['netSwitcher', 'nsBackdrop']) {
    const re = new RegExp('<div\\b[^>]*\\bid="' + id + '"[^>]*>', 'i');
    const m = re.exec(h);
    if (m) h = cutElement(h, m.index, 'div');
  }
  return h;
}

let rows = 0, panels = 0, keys = 0;
for (const chain of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain', 'stellar', 'xrpl']) {
  for (const dev of ['desktop', 'mobile']) {
    const file = `lumoscore-${chain}-${dev}.html`;
    let data; try { data = read(file); } catch (e) { continue; }
    const { json, s, e } = getContents(data);
    let changed = false;

    for (const k of Object.keys(json)) {
      let h = json[k];
      if (h.indexOf('data-open-network') < 0 && h.indexOf('"netSwitcher"') < 0) continue;
      const before = h;
      if (h.indexOf('data-open-network') >= 0) { h = stripRow(h); rows++; }
      if (h.indexOf('"netSwitcher"') >= 0 || h.indexOf('"nsBackdrop"') >= 0) { h = stripPanel(h); panels++; }
      if (h !== before) { json[k] = h; changed = true; keys++; }
    }

    if (changed && process.argv.includes('--write')) {
      const ser = JSON.stringify(json).split('</').join('<' + B + '/');
      fs.writeFileSync(file, data.slice(0, s) + ser + data.slice(e), 'utf8');
    }
  }
}
console.log('network switcher removed: ' + rows + ' menu rows, ' + panels + ' panels, across ' + keys + ' page keys'
  + (process.argv.includes('--write') ? '' : '  (dry run — pass --write)'));
