// Dashboard quick actions.
//
// History worth keeping: an earlier version of this file routed "Swap tokens" and "Add liquidity" to the
// Trade and Pools pages. That was reverted because the popups were wanted, not page links. What follows
// is NOT a return to that -- the popups stay wherever they exist.
//
// #33: the Cross-chain Bridge tile becomes "My wallet", leading to the wallet page.
//
// #38: "Add liquidity" did nothing on the phone. Not a broken handler: on desktop that card opens
// #createPoolModal and always has, but the mobile dashboard container does not ship that modal at all --
// measured, querySelector('#createPoolModal') is non-null on the desktop page and null on the phone. So
// the card had nothing to open. Rather than port a whole pool-creation dialog into the mobile dashboard,
// the phone goes to Pools, where creating one is the page's own job. Desktop is untouched and keeps its
// popup.
//
// The label swap is done in the markup; the routing is a capture-phase listener rather than an <a>,
// because rewriting a card's opening tag means matching nested divs with a regex, and because this page
// carries a label-based nav bridge that claims taps -- capture plus stopImmediatePropagation is how every
// other control on these pages beats it. (Tested: a plain click on the phone card opened the slide menu.)
//
// Idempotent: the label guard stops matching once swapped, and the script block is replaced wholesale.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const WALLET_ICON =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
  'stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H19a1 1 0 0 1 1 1v2"/>' +
  '<path d="M3 7.5V18a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3"/>' +
  '<path d="M20 11h-4a2 2 0 0 0 0 4h4a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1z"/></svg>';

const SCRIPT = '<script id="lx-dashqa">(function(){'
  + 'function go(u){try{location.href=u;}catch(_){}}'
  // Title text, not position: the tiles are reordered by the design between builds, and an index would
  // silently start routing the wrong card.
  + 'function target(card){'
  + 'var t=((card.querySelector(".ttl")||{}).textContent||"").trim().toLowerCase();'
  + 'if(t==="my wallet")return "/wallet";'
  // Only when there is genuinely no modal to open -- so this can never pre-empt the desktop popup.
  + 'if(t==="add liquidity"&&!document.querySelector("#createPoolModal"))return "/pools/stellar";'
  + 'return "";}'
  + 'document.addEventListener("click",function(e){'
  + 'var c=e.target&&e.target.closest?e.target.closest(".quick-card"):null; if(!c)return;'
  + 'var u=target(c); if(!u)return;'
  + 'e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation)e.stopImmediatePropagation();'
  + 'go(u);},true);'
  // A handset can withhold the synthesised click, the way it does elsewhere on these pages.
  + 'document.addEventListener("touchend",function(e){'
  + 'var c=e.target&&e.target.closest?e.target.closest(".quick-card"):null; if(!c)return;'
  + 'var u=target(c); if(!u)return;'
  + 'e.preventDefault(); if(e.stopImmediatePropagation)e.stopImmediatePropagation();'
  + 'go(u);},true);'
  + '})();</script>';

let keys = 0, tiles = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = `lumoscore-aptos-${dev}.html`;
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;

  for (const k of Object.keys(json)) {
    let p = json[k];
    const before = p;

    p = p.replace(/<script id="lx-dashqa">[\s\S]*?<\/script>/, '');
    if (p.indexOf('quick-card') < 0) { if (p !== before) { json[k] = p; changed = true; } continue; }

    // #33 -- relabel the tile and give it a wallet mark. The icon swapped is the one inside the SAME
    // card, found by walking back from the title rather than by taking the first .ic-lg on the page.
    const ttl = p.indexOf('<div class="ttl">Cross-chain Bridge</div>');
    if (ttl >= 0) {
      const cardStart = p.lastIndexOf('quick-card', ttl);
      const icStart = p.indexOf('<div class="ic-lg">', cardStart);
      const icEnd = icStart >= 0 ? p.indexOf('</div>', p.indexOf('</svg>', icStart)) : -1;
      if (icStart >= 0 && icEnd > icStart && icEnd < ttl) {
        p = p.slice(0, icStart) + '<div class="ic-lg">' + WALLET_ICON + '</div>' + p.slice(icEnd + 6);
      }
      p = p.replace(/<div class="ttl">Cross-chain Bridge<\/div>(\s*)<div class="desc">[^<]*<\/div>/,
        '<div class="ttl">My wallet</div>$1<div class="desc">Balances, orders and activity.</div>');
      tiles++;
    }

    const bi = p.lastIndexOf('</body>');
    if (bi >= 0) p = p.slice(0, bi) + SCRIPT + p.slice(bi);

    if (p !== before) { json[k] = p; changed = true; keys++; }
  }

  if (changed) {
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
console.log('dashboard quick actions: ' + tiles + ' bridge tiles -> My wallet, routing on ' + keys + ' page keys');
