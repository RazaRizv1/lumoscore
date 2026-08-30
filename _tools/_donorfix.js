// Silence the console error every donor-cloned page has thrown since the first one shipped.
//
// /about, /whitepaper, /list-your-token and the legal pages are built by cloning the MCP page and
// replacing everything inside <main>. The shell that survives -- header, nav, theme toggle, footer --
// is the point. What also survives is the donor's own mock-data scripts, which go looking for elements
// that lived in the <main> we removed:
//
//   desktop  const tbody = document.getElementById('assetsTable');  -> null, then tbody.appendChild()
//   mobile   const list  = document.getElementById('assetList');    -> null, then list.parentElement
//
// Both throw. Uncaught, at the TOP of their block, which means every statement after them in that
// block is skipped -- and on desktop that block is 44KB and also carries showToast, the search popup
// and several modals. Function declarations hoist so those still exist, but anything that WIRES them
// below the throw does not run. It has been live on lumoscore.com/about for a while.
//
// THE FIX IS ONE TOKEN PER SITE, and deliberately not a deletion. Cutting the script is wrong: it does
// real work further down. Leaving a hidden stub element in the markup is worse -- mock asset names
// ("Aptos Coin", "Tether") would sit in the DOM of a page we want indexed for something else. So the
// lookup falls back to a DETACHED node instead: everything downstream runs against it, appends into
// nothing, and the page is untouched.
//
// Scoped to pages that genuinely lack the element, so a page that really has an asset table is never
// altered. Idempotent: the marker is the fallback itself.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// [ id, the exact declaration, what to fall back to ]
//
// The list below is not guesswork: every built page was swept for a getElementById whose id the page
// does not contain and whose result is then dereferenced with no null check. These are what came back.
//
// The landing page entries are NOT from a donor clone: that page simply kept a trending block whose
// markup has gone, along with the counter animation that went with it. Nothing on the page has an id
// or class containing "trending" any more.
//
// What this costs was checked rather than assumed, and it is LESS than it looks. Reading script-block
// boundaries suggested the throw killed nine listeners below it; clicking the hero search on the old
// production build opened the popup anyway, so it does not cascade the way the brace-counting implied.
// Treat this as removing a red console error from the busiest page on the site, not as restoring lost
// behaviour -- and it was live long before this work, the previous production build has the same line.
const FIXES = [
  ['assetsTable', "const tbody = document.getElementById('assetsTable');",
    "const tbody = document.getElementById('assetsTable') || document.createElement('tbody');"],
  ['assetList', "const list = document.getElementById('assetList');",
    "const list = document.getElementById('assetList') || document.createElement('div');"],
  ['trendingFeatured', "const featured = document.getElementById('trendingFeatured');",
    "const featured = document.getElementById('trendingFeatured') || document.createElement('div');"],
  ['trendingRest', "const rest = document.getElementById('trendingRest');",
    "const rest = document.getElementById('trendingRest') || document.createElement('div');"],
  ['hiwModal', "var modal = document.getElementById('hiwModal');",
    "var modal = document.getElementById('hiwModal') || document.createElement('div');"],
  ['dwCta', "var cta = document.getElementById('dwCta');",
    "var cta = document.getElementById('dwCta') || document.createElement('div');"],
  ['themeBtn', "var themeBtn = document.getElementById('themeBtn');",
    "var themeBtn = document.getElementById('themeBtn') || document.createElement('button');"],
];

let patched = 0, pages = 0;
for (const c of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain', 'stellar', 'xrpl']) {
  for (const dev of ['desktop', 'mobile']) {
    const file = 'lumoscore-' + c + '-' + dev + '.html';
    let data; try { data = read(file); } catch (e) { continue; }
    let json, s, e; try { ({ json, s, e } = getContents(data)); } catch (err) { continue; }

    let changed = false;
    for (const key of Object.keys(json)) {
      let h = json[key];
      const before = h;
      for (const [id, from, to] of FIXES) {
        if (h.indexOf(from) < 0) continue;
        // The element exists on this page: the script is doing its job and must not be touched.
        if (h.indexOf('id="' + id + '"') >= 0) continue;
        h = h.split(from).join(to);
      }
      if (h !== before) { json[key] = h; changed = true; patched++; }
      pages++;
    }
    if (changed) {
      const ser = JSON.stringify(json).split('</').join('<' + B + '/');
      fs.writeFileSync(file, data.slice(0, s) + ser + data.slice(e), 'utf8');
    }
  }
}
console.log('donorfix: guarded the orphaned lookup on ' + patched + ' page key(s) of ' + pages);
