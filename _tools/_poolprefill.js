// ?a=LUMOS&amount_a=38.5791&b=XLM&amount_b=0.01 on a pool page, so a prepared deposit opens filled in.
//
// A user testing the MCP, 2026-11-16: add_liquidity "successfully returns the pool ID and calculates
// the proportional amount for one asset, but fails to inject the paired asset quantity into the web
// app's deposit card inputs, leaving the pool form incomplete." Measured: the tool computed both
// amounts, printed them in its reply, and then built
// `/pools/stellar/LUMOS-GB5T…/native` -- a url with no numbers in it at all. The page had nothing to
// read, so the card opened at 0.00 / 0.00. Same fault the Trade page had before [[_tradeprefill]];
// only swap was ever wired.
//
// IT DRIVES THE CARD'S OWN CONTROLS, for the reason _tradeprefill states and which matters more here:
// the deposit card computes LP shares, pool share and the network fee from the input event. Writing
// .value silently would show two amounts with none of the figures that belong to them -- and this is
// the screen where someone then approves a deposit.
//
// MATCHED BY ASSET CODE, NOT BY POSITION, because the two chains do not even share a url shape:
// Stellar is /pools/stellar/<a>/<b> and the XRP Ledger is /pools/xrpl/id/<account>. Reading the pair
// out of the path would therefore work on exactly one of them. The card's own rows carry their code
// ("LUMOS", "XRP"), so the code travels in the query and is matched against the row -- which is also
// immune to the card listing the sides in the other order. Position is the fallback, never the first
// answer.
//
// The markup is identical on both chains (verified live, 2026-11-16: .dw-card, three
// .dw-field .row inputs, two visible plus the hidden withdraw one, .dw-cta), so one layer serves
// both and the container list below is the same one _tradeprefill walks.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// IT ONLY EVER FILLS AN EMPTY BOX. It never overwrites a value, and that rule is load-bearing.
//
// Measured on the live card, 2026-11-17: typing into ONE side makes the card fill the other itself,
// on the pool's exact ratio -- 38.5791 LUMOS produced 0.0099942 XLM and turned "Pool share after"
// from an em dash into a figure. Setting BOTH sides therefore does not place two numbers; the second
// write re-derives the first, and asking for 38.5791 / 0.01 came back as 38.6012 / 0.01. A watcher
// that re-asserted the number it was given would then fight the card's own arithmetic every 250ms
// for the whole window, flickering a form someone is about to approve.
//
// So: fill a side only while it is EMPTY. That cannot fight the card, cannot fight the user, and
// still survives a late render that wipes the fields -- the case _tradeprefill exists for. The
// second side is written only if the card has NOT derived it, which is the empty-pool case, where
// there is no ratio to derive from and both amounts genuinely set the opening price.
//
// The hidden third input is the WITHDRAW field and its row is labelled with the pair ("LUMOS / XLM"),
// so rows are filtered on being visible AND on not naming two assets. Filling the withdraw box with a
// deposit amount is the one mistake here that could cost someone money.
const SCRIPT = '<script id="lx-poolprefill">(function(){try{'
  + 'var p=new URLSearchParams(location.search||"");'
  + 'var ca=(p.get("a")||"").trim(),cb=(p.get("b")||"").trim();'
  + 'var aa=(p.get("amount_a")||"").trim(),ab=(p.get("amount_b")||"").trim();'
  // Refuse anything that is not a plain number, and any code that is not a plain code. An XRP Ledger
  // code can be 40 hex characters, so the length allows for it; nothing here is ever put in the DOM
  // as markup, only compared against text the page itself rendered.
  + 'if(aa&&!/^[0-9]+(\\.[0-9]+)?$/.test(aa))aa="";'
  + 'if(ab&&!/^[0-9]+(\\.[0-9]+)?$/.test(ab))ab="";'
  + 'if(ca&&!/^[A-Za-z0-9._-]{1,40}$/.test(ca))ca="";'
  + 'if(cb&&!/^[A-Za-z0-9._-]{1,40}$/.test(cb))cb="";'
  + 'if(!aa&&!ab)return;'
  + 'var want=[];'
  + 'if(aa)want.push({c:ca.toUpperCase(),v:aa});'
  + 'if(ab)want.push({c:cb.toUpperCase(),v:ab});'
  + 'var tries=0,touched=false,timer=null,shown=false;'
  // Any TRUSTED event inside the card ends this for good -- typing, the 25/50/75/Max buttons, the
  // Deposit/Withdraw toggle. A synthetic event has isTrusted false, so we cannot stop ourselves.
  + '["input","keydown","pointerdown"].forEach(function(ev){'
  + '  document.addEventListener(ev,function(e){try{'
  + '    if(e.isTrusted&&e.target&&e.target.closest&&e.target.closest(".dw-card"))touched=true;'
  + '  }catch(_){}},true);});'
  + '["wheel","touchmove"].forEach(function(ev){'
  + '  document.addEventListener(ev,function(e){if(e.isTrusted)shown=true;},{capture:true,passive:true});});'
  + 'function card(){return document.querySelector(".dw-card");}'
  + 'function stop(){if(timer){clearInterval(timer);timer=null;}}'
  + 'function rows(){var q=card();if(!q)return [];'
  + '  return [].slice.call(q.querySelectorAll(".dw-field .row input")).filter(function(i){'
  + '    var r=i.getBoundingClientRect();if(!(r.width||r.height))return false;'
  + '    var w=i.closest(".row");if(!w)return false;'
  + '    return ((w.textContent||"").indexOf("/")<0);});}'
  + 'function codeOf(i){var w=i.closest(".row");if(!w)return "";'
  + '  return ((w.textContent||"").trim().replace(/\\s+/g," ").split(" ")[0]||"").toUpperCase();}'
  // Native setter, then a real input event -- the card's own calculator listens for it.
  + 'function put(i,v){try{'
  + '  var d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value");'
  + '  if(d&&d.set)d.set.call(i,v); else i.value=v;'
  + '  i.dispatchEvent(new Event("input",{bubbles:true}));'
  + '  i.dispatchEvent(new Event("change",{bubbles:true}));'
  + '}catch(_){try{i.value=v;}catch(__){}}}'
  + 'function depositTab(){var q=card();if(!q)return null;'
  + '  var bs=[].slice.call(q.querySelectorAll("button"));'
  + '  for(var i=0;i<bs.length;i++){'
  + '    if(((bs[i].textContent||"").trim().toLowerCase())==="deposit")return bs[i];}'
  + '  return null;}'
  + 'var empty=function(v){v=String(v||"").trim();return !v||/^0(\\.0+)?$/.test(v);};'
  + 'function findRow(rs,w,n){'
  + '  if(w.c){for(var m=0;m<rs.length;m++){if(codeOf(rs[m])===w.c)return rs[m];}return null;}'
  + '  return rs[n]||null;}'               // position only when no code was given at all
  // ONE SIDE AT A TIME, and only while it is empty. Writing both in one pass makes the card re-derive
  // the first from the second; see the note above. Returning after a write lets the card react before
  // the next tick looks again.
  + 'function apply(rs){'
  + '  for(var n=0;n<want.length;n++){'
  + '    var w=want[n],t=findRow(rs,w,n);'
  + '    if(!t)continue;'
  + '    if(empty(t.value)){put(t,w.v);return false;}'
  + '  }'
  // Done when every side we were asked about now carries something -- whether we wrote it or the
  // card derived it.
  + '  for(var k=0;k<want.length;k++){'
  + '    var r=findRow(rs,want[k],k);'
  + '    if(r&&empty(r.value))return false;'
  + '  }'
  + '  return true;}'
  + 'function tick(){'
  + '  if(touched||tries++>48){stop();return;}'
  + '  var q=card();if(!q)return;'
  // Withdraw may be the open tab; switching re-renders the fields, so click and let the next tick fill.
  + '  var d=depositTab();'
  + '  if(d&&!d.classList.contains("active")){try{d.click();}catch(_){}return;}'
  + '  var rs=rows();if(!rs.length)return;'
  + '  var all=apply(rs);'
  // Bring the thing being approved into view, once, and never over the reader's own scrolling.
  + '  if(all&&!shown){shown=true;try{'
  + '    var r=q.getBoundingClientRect();'
  + '    if(r.top<0||r.bottom>(window.innerHeight||0))'
  + '      q.scrollIntoView({block:"center",behavior:"smooth"});'
  + '  }catch(_){}}'
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
      // The pool DETAIL page only. `amm-pool` excludes lumoscore-amm.html, which is the pool LIST and
      // has no deposit card, and includes the -dark variant.
      if (!/amm-pool/.test(k)) continue;
      let h = json[k];
      const before = h;
      h = swapOrAppend(h, '<script id="lx-poolprefill">', '</script>', SCRIPT);
      // Count what we MATCHED, not what we rewrote: a second run where the block is already correct
      // must not report "no pool page matched" and exit 1.
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
console.log('pool prefill: ' + pages + ' page key(s) across ' + containers + ' container(s)');
if (!pages) { console.error('  ! no pool page matched'); process.exit(1); }
