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

const SCRIPT = '<script id="lx-tradeprefill">(function(){try{'
  + 'var p=new URLSearchParams(location.search||"");'
  + 'var side=(p.get("side")||"").toLowerCase(), amt=(p.get("amount")||"").trim();'
  + 'if(side!=="buy"&&side!=="sell"&&!amt)return;'
  + 'if(amt&&!/^[0-9]+(\\.[0-9]+)?$/.test(amt))amt="";'         // refuse anything that is not a plain number
  + 'var done=false;'
  + 'function apply(){'
  + '  if(done)return true;'
  + '  var pane=document.querySelector(".dxa-pane-swap")||document;'
  + '  var input=pane.querySelector(".dxa-trade-ir input");'
  + '  if(!input)return false;'
  // The side button first: switching sides re-renders the field, so an amount set before the click
  // is thrown away by it.
  + '  if(side){var b=pane.querySelector(".dxa-side-btn."+side);'
  + '    if(b&&!b.classList.contains("active")){try{b.click();}catch(_){}'
  + '      input=pane.querySelector(".dxa-trade-ir input")||input;}}'
  + '  if(amt){'
  + '    try{'
  // Set through the native setter so frameworks watching the property still see the change; then a
  // real input event, which is what the panel's own calculator listens for.
  + '      var d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value");'
  + '      if(d&&d.set)d.set.call(input,amt); else input.value=amt;'
  + '      input.dispatchEvent(new Event("input",{bubbles:true}));'
  + '      input.dispatchEvent(new Event("change",{bubbles:true}));'
  + '    }catch(_){ input.value=amt; }'
  + '  }'
  + '  done=true; return true;'
  + '}'
  + 'function tryApply(){ if(apply())return; }'
  + 'if(document.readyState!=="loading")tryApply();else document.addEventListener("DOMContentLoaded",tryApply);'
  + '[300,900,1800,3000].forEach(function(ms){setTimeout(tryApply,ms);});'
  + '}catch(_){}})();<' + '/script>';

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
      h = h.replace(/<script id="lx-tradeprefill">[\s\S]*?<\/script>/g, '');   // idempotent
      const bi = h.lastIndexOf('</body>');
      if (bi < 0) continue;
      h = h.slice(0, bi) + SCRIPT + h.slice(bi);
      if (h !== before) { json[k] = h; changed = true; pages++; }
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
