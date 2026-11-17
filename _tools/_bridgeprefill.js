// ?to=XRPL&asset=XLM&amount=10&recipient=r... on a bridge page, so a prepared transfer opens set up.
//
// A user testing the MCP, 2026-11-16: the bridge tool REFUSED to prepare anything without a recipient
// address -- and then returned a bare `/bridge/stellar`, so the address it had just insisted on was
// collected and thrown away, along with the asset, the amount and the destination chain. Both halves
// are fixed: mcp/tools.js and mcp/xrpl.js now treat recipient as optional and put everything they
// worked out in the query, and this layer applies what can be applied.
//
// WHAT THE PAGE ACTUALLY IS (measured live 2026-11-17, and it is not what the old card suggests):
// a three-step wizard -- `.br-sd` dots "1 Network / 2 Assets / 3 Review" over three
// `.br-step[data-step]` panels, all three present in the DOM with 2 and 3 carrying `hidden`.
//   step 1  destination network: `.brd-trigger` ("Select Network", class `is-empty`) opens `.brd-menu`,
//           53 `button.brd-opt[data-net]`, one of them data-net="XRPL".
//   step 2  the asset, the amount and the receiving address.
//   step 3  review.
//
// SO THIS LAYER DOES TWO OF THE FOUR INPUTS, and that is the honest ceiling for a static layer:
//
//   * the destination network, on step 1. Verified drivable: clicking the XRPL option fills the chip.
//   * the receiving address, into step 2's `.br-addr-in`. A real <input>, present in the DOM while the
//     step is still hidden, so it can be set before the person ever gets there.
//
// It does NOT set the asset, and it does NOT set the amount. Both are measured limits, not laziness:
//
//   * the asset picker lists the CONNECTED WALLET'S balances and opens nothing whatsoever until a
//     wallet is connected -- clicking `.br-asset` added zero nodes to the document. A control that
//     cannot be read cannot be driven safely.
//   * step 2's amount ships as `<div class="v">100</div>` -- display text, not a field. The app swaps
//     in a real input at runtime (hence `.br-amt .v input` in [[_bridgepolish]]). Writing into the DIV
//     would paint a number that the app never computed, with no USD figure, no route and no fee behind
//     it, two clicks from a Review step that says "You send". That is the one mistake here that could
//     cost someone money, so the amount is written ONLY into a real input, and only once the card is
//     already showing the asset that was asked for. Where that never happens nothing is written, and
//     the MCP reply still states the asset and the amount in words.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const SCRIPT = '<script id="lx-bridgeprefill">(function(){try{'
  + 'var p=new URLSearchParams(location.search||"");'
  + 'var to=(p.get("to")||"").trim(),as=(p.get("asset")||"").trim();'
  + 'var am=(p.get("amount")||"").trim(),rc=(p.get("recipient")||"").trim();'
  // Nothing from the query is ever written as markup; these only gate behaviour and are compared
  // against text the page rendered itself.
  + 'if(to&&!/^[A-Za-z0-9 ._-]{1,32}$/.test(to))to="";'
  + 'if(as&&!/^[A-Za-z0-9._-]{1,40}$/.test(as))as="";'
  + 'if(am&&!/^[0-9]+(\\.[0-9]+)?$/.test(am))am="";'
  + 'if(am&&+am<=0)am="";'
  + 'if(rc&&!(/^[A-Za-z0-9]{20,100}$/.test(rc)||/^0x[0-9a-fA-F]{40}$/.test(rc)))rc="";'
  + 'if(!to&&!am&&!rc)return;'
  + 'var tries=0,touched=false,timer=null;'
  // net: 0 not attempted yet, 1 set, -1 cannot be set. opened counts trigger clicks so a menu that
  // refuses to open is abandoned instead of being clicked once every 250ms.
  + 'var net=to?0:1,opened=0,didAm=false;'
  // Any TRUSTED event inside the wizard ends this for good. A synthetic event has isTrusted false,
  // so we cannot stop ourselves by writing.
  + '["input","keydown","pointerdown"].forEach(function(ev){'
  + '  document.addEventListener(ev,function(e){try{'
  + '    if(e.isTrusted&&e.target&&e.target.closest&&e.target.closest(".br-wizard"))touched=true;'
  + '  }catch(_){}},true);});'
  + 'function stop(){if(timer){clearInterval(timer);timer=null;}}'
  + 'function vis(e){if(!e)return false;var r=e.getBoundingClientRect();return !!(r.width||r.height);}'
  + 'function txt(e){return e?((e.textContent||"").replace(/\\s+/g," ").trim()):"";}'
  + 'var U=function(s){return String(s||"").toUpperCase();};'
  + 'function step(n){return document.querySelector(".br-wizard .br-step[data-step=\\"" + n + "\\"]");}'
  // Step 2's FROM card. .br-side also clothes the route panel, which is filtered out by name.
  + 'function fromSide(){var s=step(2);if(!s)return null;'
  + '  var all=[].slice.call(s.querySelectorAll(".br-io .br-side")).filter(function(e){'
  + '    return !e.classList.contains("lx-brroute");});'
  + '  return all[0]||null;}'
  + 'function put(i,v){try{'
  + '  var d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value");'
  + '  if(d&&d.set)d.set.call(i,v); else i.value=v;'
  + '  i.dispatchEvent(new Event("input",{bubbles:true}));'
  + '  i.dispatchEvent(new Event("change",{bubbles:true}));'
  + '}catch(_){try{i.value=v;}catch(__){}}}'
  // STEP 1 -- destination network. Done the moment the chip names it, however that happened: if the
  // person picked it themselves while we were waiting, we must not re-open the menu over them.
  + 'function chip(){return document.querySelector(".br-wizard .brd-trigger");}'
  + 'function chipHasTo(){var c=chip();if(!c)return false;'
  + '  if(c.classList.contains("is-empty"))return false;'
  + '  return U(txt(c.querySelector(".nm"))).indexOf(U(to))>=0;}'
  + 'function doNet(){'
  + '  if(chipHasTo()){net=1;return;}'
  + '  var c=chip();if(!c)return;'
  + '  var menu=document.querySelector(".br-wizard .brd-menu");'
  + '  if(!menu)return;'
  + '  if(!vis(menu)){'
  + '    if(opened++>3){net=-1;return;}'
  + '    try{c.click();}catch(_){}'
  + '    return;}'
  + '  var opts=[].slice.call(menu.querySelectorAll(".brd-opt"));'
  + '  if(!opts.length)return;'
  + '  var want=U(to),hit=null;'
  + '  for(var i=0;i<opts.length&&!hit;i++){'
  + '    if(U(opts[i].getAttribute("data-net"))===want)hit=opts[i];}'
  + '  for(var j=0;j<opts.length&&!hit;j++){'
  + '    if(U(txt(opts[j]))===want)hit=opts[j];}'
  + '  if(!hit){'
  // No such destination from this chain. Close the menu we opened -- leaving a 53-row dropdown hanging
  // open over the card is worse than doing nothing -- and stop touching the wizard.
  + '    net=-1;'
  + '    try{c.click();}catch(_){}'
  + '    return;}'
  + '  try{hit.click();}catch(_){}'
  + '}'
  // STEP 2 -- the receiving address. A real input, writable while the step is still hidden, so it is
  // waiting there when the person arrives. Only ever while empty: never over a value, and the person
  // cannot have typed into a hidden field, so re-asserting it is safe if a re-render clears it.
  + 'function doRc(){'
  + '  var s=step(2);if(!s)return;'
  + '  var i=s.querySelector(".br-addr-in");'
  + '  if(!i)return;'
  + '  if(String(i.value||"").trim())return;'
  + '  put(i,rc);}'
  // STEP 2 -- the amount. A REAL INPUT ONLY, and only against the asset we were asked for.
  + 'function doAm(){'
  + '  if(net!==1)return;'
  + '  var f=fromSide();if(!f)return;'
  + '  if(as){'
  + '    var nm=f.querySelector(".br-asset .nm");'
  + '    if(!nm)return;'
  + '    if(U(txt(nm))!==U(as))return;}'
  // .br-amt .v is a DIV in the shipped markup; the app replaces it with an input. No input, no write.
  + '  var i=f.querySelector(".br-amt input");'
  + '  if(!i)return;'
  + '  var cur=String(i.value||"").trim();'
  + '  if(cur&&!/^0(\\.0+)?$/.test(cur)){didAm=true;return;}'
  + '  put(i,am);didAm=true;}'
  + 'function tick(){'
  + '  if(touched||tries++>60){stop();return;}'
  + '  if(!document.querySelector(".br-wizard"))return;'
  + '  if(net===0){doNet();return;}'                       // one step per tick; let the page react
  + '  if(rc)doRc();'
  + '  if(am&&!didAm)doAm();'
  + '}'
  + 'timer=setInterval(tick,250);tick();'
  + '}catch(_){}})();<' + '/script>';

// Swap in place; never strip-at-the-top and re-append, which moves this layer past everything that
// follows it. See [[body-end-is-not-a-fixed-cascade-position]].
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
      // lumoscore-bridge.html, -dark and -mobile. Nothing else on the site carries this name.
      if (!/lumoscore-bridge/.test(k)) continue;
      let h = json[k];
      const before = h;
      h = swapOrAppend(h, '<script id="lx-bridgeprefill">', '</script>', SCRIPT);
      // Count what we MATCHED, not what we rewrote: a second run where the block is already correct
      // must not report "no bridge page matched" and exit 1.
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
console.log('bridge prefill: ' + pages + ' page key(s) across ' + containers + ' container(s)');
if (!pages) { console.error('  ! no bridge page matched'); process.exit(1); }
