// ?side=sell&amount=500 on a Trade-Asset page, so a prepared trade opens ready to approve.
//
// The MCP server hands back a link for every write, and until now that link opened a bare page --
// which is not "approve", it is "type it in again yourself" (RAZA: "isnt mcp supposed to do that for
// me?"). It is a fair complaint: an approval step should present the thing being approved.
//
// SCOPE, AND WHY IT IS THIS NARROW. The Trade-Asset page pairs its asset with XLM and nothing else --
// the "you pay" chip is a display element, not a picker -- so the only thing a url can meaningfully
// prefill here is the SIDE and the AMOUNT. A pair like LUMOS -> BLND is two trades, and the MCP tool
// now says so rather than linking here and hoping.
//
// It drives the page's OWN controls: it clicks the real side button and dispatches a real input
// event, rather than writing values into the DOM. The swap panel computes rate, fee and minimum
// received from those events, so setting .value silently would show an amount with none of the
// figures that belong to it -- a number the user would then approve.
//
// Re-asserted on a few ticks because the panel renders from live data after load, and a render that
// lands after the prefill would wipe it. It stops as soon as it has applied to a rendered panel, so
// it cannot fight the user's own typing.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// WHY THIS IS A WATCHER AND NOT A ONE-SHOT (fixed 2026-11-16, it had never worked in production).
//
// The previous version set done=true the first time it FOUND the input and never ran again. The
// input is in the served HTML, so "found" was true immediately at DOMContentLoaded -- and the swap
// panel renders itself from live data a moment later and CLEARS the field. The four re-asserts at
// 300/900/1800/3000ms existed for exactly that and were all dead, because done was already true.
// The old comment said it "stops as soon as it has applied to a rendered panel"; nothing in the code
// could tell a rendered panel from an empty one.
//
// Measured on production before the fix: the field was empty at every sample from 0 to 7.6s on a
// ?side=buy&amount=100 load. Running the very same lines by hand after load set it correctly and it
// stuck -- so the logic was right and only the timing was wrong. Clicking the side toggle also wipes
// the field, which is the same re-render doing it.
//
// So: keep comparing for a bounded window and re-assert whenever the value is not what the url asked
// for. A late render therefore cannot win, which a "stop once it looks settled" rule could not
// promise -- the panel can re-render after any amount of quiet.
//
// IT MUST NEVER FIGHT THE USER. Any TRUSTED input, keydown or pointerdown inside the swap pane ends
// the watcher for good. That covers typing, the 25/50/75/MAX buttons and the side toggle: all of them
// are real user events, and a synthetic one (ours) has isTrusted false, so we cannot stop ourselves.
const SCRIPT = '<script id="lx-tradeprefill">(function(){try{'
  + 'var p=new URLSearchParams(location.search||"");'
  + 'var side=(p.get("side")||"").toLowerCase(), amt=(p.get("amount")||"").trim();'
  + 'if(side!=="buy"&&side!=="sell")side="";'
  + 'if(amt&&!/^[0-9]+(\\.[0-9]+)?$/.test(amt))amt="";'         // refuse anything that is not a plain number
  + 'if(!side&&!amt)return;'
  + 'var tries=0,touched=false,timer=null,shown=false;'
  + '["input","keydown","pointerdown"].forEach(function(ev){'
  + '  document.addEventListener(ev,function(e){try{'
  + '    if(e.isTrusted&&e.target&&e.target.closest&&e.target.closest(".dxa-pane-swap"))touched=true;'
  + '  }catch(_){}},true);});'
  // Scrolling is NOT touching the panel -- it must not stop the amount from being re-asserted -- but
  // it does mean the reader has chosen where to look, so it cancels the one-time scroll below.
  + '["wheel","touchmove"].forEach(function(ev){'
  + '  document.addEventListener(ev,function(e){if(e.isTrusted)shown=true;},{capture:true,passive:true});});'
  + 'function pane(){return document.querySelector(".dxa-pane-swap");}'
  + 'function stop(){if(timer){clearInterval(timer);timer=null;}}'
  // Set through the native setter so anything watching the property still sees the change, then a
  // real input event -- which is what the panel's own calculator listens for. Writing .value alone
  // would show an amount with no rate, no price impact and no minimum received beside it: a number
  // the user would then be asked to approve.
  + 'function put(i){try{'
  + '  var d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value");'
  + '  if(d&&d.set)d.set.call(i,amt); else i.value=amt;'
  + '  i.dispatchEvent(new Event("input",{bubbles:true}));'
  + '  i.dispatchEvent(new Event("change",{bubbles:true}));'
  + '}catch(_){try{i.value=amt;}catch(__){}}}'
  + 'function tick(){'
  + '  if(touched||tries++>48){stop();return;}'
  + '  var q=pane(); if(!q)return;'
  // The side button first: switching sides re-renders the field, so an amount set before the click is
  // thrown away by it. Return after clicking and let the next tick put the amount into the new field.
  + '  if(side){var b=q.querySelector(".dxa-side-btn."+side);'
  + '    if(b&&!b.classList.contains("active")){try{b.click();}catch(_){} return;}}'
  + '  if(!amt){stop();return;}'
  + '  var i=q.querySelector(".dxa-trade-ir input"); if(!i)return;'
  + '  if(i.value!==amt)put(i);'
  // BRING THE THING BEING APPROVED INTO VIEW, once. On a phone the swap panel is well below the
  // fold -- the link lands on the token header and the chart -- so a prepared trade that the user
  // never scrolls to is not meaningfully different from one that was never prepared. Only after the
  // amount is actually in place, never if the user has already started scrolling or typing, and
  // only when the panel is not on screen already, so it cannot yank a page the reader is using.
  + '  if(!shown&&i.value===amt){shown=true;try{'
  + '    var r=q.getBoundingClientRect();'
  + '    if(r.top<0||r.bottom>(window.innerHeight||0))'
  + '      q.scrollIntoView({block:"center",behavior:"smooth"});'
  + '  }catch(_){}}'
  + '}'
  + 'timer=setInterval(tick,250);tick();'
  + '}catch(_){}})();<' + '/script>';

// SWAP THE BLOCK WHERE IT ALREADY SITS, never strip-at-the-top and re-append at the end.
// Re-appending moves this layer to the end of the page, so the container's layer order becomes "the
// order the transforms last ran in" and every layer that used to follow it moves with it -- which is
// why running one Stellar transform on its own used to require a full reorder sweep. Swapping in
// place is byte-for-byte position-preserving, so this file is safe to run alone.
// A page that has never carried the block still falls through to the append, which shows up as a set
// difference rather than a move. Stale duplicates are dropped: an older build that double-inserted
// would otherwise keep the second copy for ever, and the second copy is the one that runs last.
function swapOrAppend(p, OPEN, CLOSE, BLOCK) {
  const at = p.indexOf(OPEN);
  if (at >= 0) {
    const end = p.indexOf(CLOSE, at);
    if (end > at) {
      p = p.slice(0, at) + BLOCK + p.slice(end + CLOSE.length);
      let dup = p.indexOf(OPEN, at + BLOCK.length);
      while (dup >= 0) {
        const de = p.indexOf(CLOSE, dup);
        if (de < dup) break;
        p = p.slice(0, dup) + p.slice(de + CLOSE.length);
        dup = p.indexOf(OPEN, dup);
      }
      return p;
    }
  }
  const bi = p.lastIndexOf('</body>');
  return bi >= 0 ? p.slice(0, bi) + BLOCK + p.slice(bi) : p;
}

let pages = 0, containers = 0;
for (const c of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain', 'stellar', 'xrpl']) {
  for (const dev of ['desktop', 'mobile']) {
    const file = `lumoscore-${c}-${dev}.html`;
    let data; try { data = read(file); } catch (e) { continue; }
    const { json, s, e } = getContents(data);
    let changed = false;

    for (const k of Object.keys(json)) {
      if (!/dex-asset/.test(k)) continue;                       // the Trade-Asset page only
      let h = json[k];
      const before = h;
      h = swapOrAppend(h, '<script id="lx-tradeprefill">', '</script>', SCRIPT);
      // COUNT THE PAGES WE MATCHED, not the ones we rewrote. These are two different questions and
      // only the first one answers "did this transform find its target". Counting rewrites meant a
      // SECOND run -- where the block is already correct and nothing needs to change -- reported
      // "no Trade-Asset page matched" and exited 1, so a build that ran this twice would abort on
      // the transform having already succeeded. The write below is still gated on a real change, so
      // an unchanged container is not rewritten.
      pages++;
      if (h !== before) { json[k] = h; changed = true; }
    }

    if (changed) {
      containers++;
      const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
      fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
    }
  }
}
console.log('trade prefill: ' + pages + ' page key(s) across ' + containers + ' container(s)');
if (!pages) { console.error('  ! no Trade-Asset page matched'); process.exit(1); }
