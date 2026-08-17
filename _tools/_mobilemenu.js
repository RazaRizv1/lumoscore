// Restore the slide-out menu on the mobile pages whose markup is missing it.
//
// The header's hamburger (#menuBtn) exists on every mobile page. Its handler does this:
//
//     const overlay = getElementById('menuOverlay'), menu = getElementById('slideMenu'),
//           openBtn = getElementById('menuBtn'),     closeBtn = getElementById('menuClose');
//     if (!overlay || !menu || !openBtn || !closeBtn) return;      // <- silent
//
// Four pages ship the button and NOT the panel, so that guard returns and the button does
// nothing at all -- no error, no console message, just a control that does not work:
//
//     account, amm (Pools list), amm-pool (Pool detail), lumos-token
//
// Reported on account. The other three have the identical defect and are fixed with it: it is one
// missing block of markup, the fix is mechanical, and each page is checked individually below.
//
// The CSS was never the problem -- .slide-menu and .menu-overlay rules are already present on the
// broken pages (3 and 2 rules respectively, same as the working ones). Only the elements are absent.
//
// The block is COPIED FROM A PAGE THAT HAS IT rather than pasted in here as a literal, so the menu
// contents (links, user row, theme toggle) stay whatever the design says they are. A hardcoded copy
// would drift the moment the design's menu changed, and nothing would flag it.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// The SAME four pages are also missing the search popup, and with the menu restored that became
// reachable: tapping Search in the menu closed the menu and did nothing, because the thing it opens
// (#searchPopup) is not in the document. Copied the same way, from a page that has it.
const BLOCKS = [
  // The menu ends at a literal </aside>; the search popup is nested divs, so its end is found by
  // BALANCING the tags rather than by a marker string. Guessing a closing marker for it produced a block
  // that ended in the wrong place -- balance is the only reliable way to lift a div subtree.
  { what: 'slide menu',   open: '<div class="menu-overlay" id="menuOverlay">', close: '</aside>',
    marker: 'id="slideMenu"',  needs: 'id="menuBtn"' },
  { what: 'search popup', open: '<div class="search-overlay" id="searchPopup"', tag: 'div',
    marker: 'id="searchPopup"', needs: 'spSearchInput' },
];

// End of the element that starts at `from`, by counting opening and closing tags of `tag`.
function balancedEnd(h, from, tag) {
  const re = new RegExp('</?' + tag + '\\b', 'gi');
  re.lastIndex = from;
  let depth = 0, m;
  while ((m = re.exec(h))) {
    if (m[0][1] === '/') { depth--; if (depth === 0) return h.indexOf('>', m.index) + 1; }
    else depth++;
  }
  return -1;
}
function extractBlock(h, spec) {
  const a = h.indexOf(spec.open);
  if (a < 0) return null;
  if (spec.close) { const b = h.indexOf(spec.close, a); return b < 0 ? null : h.slice(a, b + spec.close.length); }
  const b = balancedEnd(h, a, spec.tag);
  return b < 0 ? null : h.slice(a, b);
}

let injected = 0, pages = 0, skipped = 0;

for (const c of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain']) {
  // Mobile only: the desktop pages have their own nav and no slide menu at all.
  const file = `lumoscore-${c}-mobile.html`;
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);

  // Donor per block: a page in this container that already has it -- the LONGEST such copy.
  //
  // For the menu that choice is load-bearing. There are two in this design: the landing page ships a
  // marketing one (Products, Why LumosCore, How it works, FAQs, Docs) at ~1.4KB, the app pages ship the
  // real one (connected account row, Search, Wallet, Rewards, MCP, LUMOS Token, theme) at ~3.6KB. Picking
  // the SHORTEST, which is what this did first, copied the marketing menu into Pools and the account page
  // -- the button opened and offered "Why LumosCore" to somebody already inside the app.
  const donors = {};
  for (const spec of BLOCKS) {
    let best = null;
    for (const k of Object.keys(json)) {
      const block = extractBlock(json[k], spec);
      if (block && (!best || block.length > best.length)) best = block;
    }
    donors[spec.what] = best;
    if (!best) console.log(`  ${file}: nothing carries the ${spec.what} -- skipping it`);
  }

  for (const k of Object.keys(json)) {
    let h = json[k];
    // Strip previous injections first, so re-running is idempotent and always re-copies the CURRENT
    // donor rather than leaving an old copy in place.
    h = h.replace(/<!--lx-menu-->[\s\S]*?<!--\/lx-menu-->/g, '')
         .replace(/<!--lx-sp-->[\s\S]*?<!--\/lx-sp-->/g, '');
    let add = '';
    for (const spec of BLOCKS) {
      const donor = donors[spec.what];
      if (!donor) continue;
      if (h.indexOf(spec.needs) < 0 || h.indexOf(spec.marker) >= 0) continue;   // not wanted, or already has it
      const tag = spec.what === 'slide menu' ? 'lx-menu' : 'lx-sp';
      add += '<!--' + tag + '-->' + donor + '<!--/' + tag + '-->';
      injected++;
    }
    if (!add) { if (h !== json[k]) json[k] = h; skipped++; continue; }

    // POSITION MATTERS, and not for layout. These handlers run inline at parse time and resolve their ids
    // immediately -- they do not wait for DOMContentLoaded. Injecting before </body> put the panel AFTER
    // the script, so getElementById still returned null, the guard still returned, and the button was
    // still dead with every id present in the finished DOM. Verified: the ids were all there and clicking
    // did nothing.
    //
    // So it goes directly after <body>, ahead of every script. Both blocks are position:fixed overlays,
    // so being the first children costs nothing in layout.
    const bm = h.match(/<body[^>]*>/i);
    if (bm) { const at = h.indexOf(bm[0]) + bm[0].length; h = h.slice(0, at) + add + h.slice(at); }
    else { const at = h.lastIndexOf('</body>'); h = at >= 0 ? (h.slice(0, at) + add + h.slice(at)) : (h + add); }
    json[k] = h;
  }
  pages++;

  const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
  fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
}

console.log(`mobile slide menu: injected into ${injected} pages across ${pages} containers (${skipped} already had it or have no button)`);
