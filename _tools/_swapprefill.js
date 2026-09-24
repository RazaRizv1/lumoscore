// /dashboard?swap=FROM,TO,AMOUNT — open the swap with the trade already in it.
//
// The dashboard swap is the only surface that takes ANY pair (both chips are pickers, and it settles
// through the classic Horizon path payment, which is the route that collects the platform fee
// correctly). So a prepared LUMOS -> BLND from the MCP server points here, and this is what makes
// that link an approval rather than an instruction to re-enter the trade.
//
// It calls window.lxSwapPrefill, exported from _swapcalc.js where pick(), the amount input and the
// quote runner are in scope. Driving the asset menu by simulated clicks instead would be a fragile
// re-implementation of one line, and it would break the moment that menu is restyled.
//
// Assets arrive as CODE-ISSUER (or XLM) and are parsed here, never eval'd or written into markup:
// every one of these values comes in off a url, so it is treated as hostile input.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const SCRIPT = '<script id="lx-swapprefill">(function(){try{'
  + 'var p=new URLSearchParams(location.search||"");var raw=(p.get("swap")||"").trim();'
  + 'if(!raw)return;'
  + 'var bits=raw.split(",");if(bits.length<2)return;'
  + 'function pa(s){s=String(s||"").trim();'
  + '  if(/^(xlm|native)$/i.test(s))return {code:"XLM",iss:"",native:true,bal:null};'
  + '  var m=/^([A-Za-z0-9]{1,12})-(G[A-Z2-7]{55})$/.exec(s);'
  + '  return m?{code:m[1],iss:m[2],native:false,bal:null}:null;}'
  + 'var from=pa(bits[0]),to=pa(bits[1]);'
  + 'var amt=(bits[2]||"").trim(); if(amt&&!/^[0-9]+(\\.[0-9]+)?$/.test(amt))amt="";'
  + 'if(!from||!to)return;'
  + 'var tries=0;'
  + 'function go(){'
  + '  tries++;'
  // The modal has to be OPEN before prefilling: _swapcalc boots its pickers when it first opens, so
  // filling a modal that has never been shown writes into controls that do not exist yet.
  + '  var modal=document.getElementById("swapModal");'
  + '  if(modal&&typeof window.lxSwapPrefill!=="function"&&tries<40){setTimeout(go,300);return;}'
  + '  if(!modal||typeof window.lxSwapPrefill!=="function"){if(tries<40)setTimeout(go,300);return;}'
  + '  var open=modal.style.display&&modal.style.display!=="none";'
  + '  if(!open){'
  // The control is the "Custom Swap / Orders" quick-card, not a button labelled "Swap". Matching
  // /^swap$/ found nothing and left the trade prefilled behind a modal that never opened -- the fields
  // were all correct and the user saw an ordinary dashboard.
  + '    var t=[].slice.call(document.querySelectorAll(".quick-card")).filter(function(x){'
  + '      return /custom swap/i.test(x.textContent||"")&&x.offsetParent!==null;})[0];'
  // That click schedules _swapcalc\'s resetFields at +120ms (it clears a stale amount on every reopen),
  // so prefilling in the same tick is wiped -- while the quote, already in flight, still lands and paints
  // a "you receive" figure with an EMPTY amount above it. Come back after the reset, not before it.
  + '    if(t){try{t.click();}catch(_){} if(tries<40){setTimeout(go,350);return;}}'
  + '  }'
  + '  if(window.lxSwapPrefill({from:from,to:to,amount:amt})===false&&tries<40){setTimeout(go,300);return;}'
  // Anything that clears the field later gets one re-apply; only when it is EMPTY, so this never
  // overwrites what the user has typed.
  + '  if(amt)[400,900,1600].forEach(function(ms){setTimeout(function(){try{'
  + '    var i=document.getElementById("swapAmtIn");'
  + '    if(i&&!(i.value||"").trim())window.lxSwapPrefill({amount:amt});'
  + '  }catch(_){}},ms);});'
  + '}'
  + 'if(document.readyState!=="loading")setTimeout(go,600);else document.addEventListener("DOMContentLoaded",function(){setTimeout(go,600);});'
  + '}catch(_){}})();<' + '/script>';

let pages = 0, containers = 0;
for (const c of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain', 'stellar', 'xrpl']) {
  for (const dev of ['desktop', 'mobile']) {
    const file = `lumoscore-${c}-${dev}.html`;
    let data; try { data = read(file); } catch (e) { continue; }
    const { json, s, e } = getContents(data);
    let changed = false;

    for (const k of Object.keys(json)) {
      if (!/home/.test(k)) continue;                       // the dashboard carries #swapModal
      let h = json[k];
      if (h.indexOf('swapModal') < 0) continue;
      const before = h;
      h = h.replace(/<script id="lx-swapprefill">[\s\S]*?<\/script>/g, '');   // idempotent
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
console.log('swap prefill: ' + pages + ' dashboard page key(s) across ' + containers + ' container(s)');
if (!pages) { console.error('  ! no dashboard with #swapModal matched'); process.exit(1); }
