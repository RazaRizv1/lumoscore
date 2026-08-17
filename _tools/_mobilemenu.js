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

const OPEN = '<div class="menu-overlay" id="menuOverlay">';
const END = '</aside>';

let injected = 0, pages = 0, skipped = 0;

for (const c of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain']) {
  // Mobile only: the desktop pages have their own nav and no slide menu at all.
  const file = `lumoscore-${c}-mobile.html`;
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);

  // Donor: a page in this container that already has the panel -- the LONGEST such block.
  //
  // There are two menus in this design. The landing page ships a marketing one (Products, Why LumosCore,
  // How it works, FAQs, Docs) at ~1.4KB; the app pages ship the real one (connected account row, Search,
  // Wallet, Rewards, MCP, LUMOS Token, theme toggle) at ~3.6KB. Picking the SHORTEST, which is what this
  // did first, copied the marketing menu into Pools and the account page -- the button opened, and
  // offered "Why LumosCore" to somebody already inside the app. Length is a reliable discriminator here
  // and the pages that already have a menu are never touched, so the landing page keeps its own.
  let donor = null;
  for (const k of Object.keys(json)) {
    const h = json[k];
    const a = h.indexOf(OPEN); if (a < 0) continue;
    const b = h.indexOf(END, a); if (b < 0) continue;
    const block = h.slice(a, b + END.length);
    if (!donor || block.length > donor.length) donor = block;
  }
  if (!donor) { console.log(`  ${file}: no page carries the slide menu -- nothing to copy`); continue; }

  for (const k of Object.keys(json)) {
    let h = json[k];
    // Strip a previous injection first, so re-running is idempotent and always re-copies the
    // CURRENT donor rather than leaving an old copy in place.
    h = h.replace(/<!--lx-menu-->[\s\S]*?<!--\/lx-menu-->/g, '');
    const hasBtn = h.indexOf('id="menuBtn"') >= 0;
    const hasPanel = h.indexOf('id="slideMenu"') >= 0;
    if (!hasBtn || hasPanel) { if (h !== json[k]) json[k] = h; skipped++; continue; }

    // POSITION MATTERS, and not for layout. The handler runs inline at parse time and resolves all four
    // ids immediately -- it does not wait for DOMContentLoaded. Injecting before </body> put the panel
    // AFTER that script, so getElementById still returned null, the guard still returned, and the button
    // was still dead with all four elements present in the finished DOM. Verified: the ids were all there
    // and clicking did nothing.
    //
    // So it goes directly after <body>, ahead of every script. The overlay and panel are position:fixed,
    // so being the first child costs nothing in layout.
    const wrapped = '<!--lx-menu-->' + donor + '<!--/lx-menu-->';
    const bm = h.match(/<body[^>]*>/i);
    if (bm) { const at = h.indexOf(bm[0]) + bm[0].length; h = h.slice(0, at) + wrapped + h.slice(at); }
    else { const at = h.lastIndexOf('</body>'); h = at >= 0 ? (h.slice(0, at) + wrapped + h.slice(at)) : (h + wrapped); }
    json[k] = h;
    injected++;
  }
  pages++;

  const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
  fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
}

console.log(`mobile slide menu: injected into ${injected} pages across ${pages} containers (${skipped} already had it or have no button)`);
