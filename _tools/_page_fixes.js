// Page-level fixes:
//  #11 Launchpad: stray "USDT" supply-unit -> dynamic ticker (mirrors #tokenTicker, default TOKENS)
//  #12 Rewards: dead "Next distribution" countdown -> self-contained script (next 1st/15th, ticks)
//  #13 $LUMOS: reconcile the supply contradiction (hero 1.17B/2B vs the "1B fixed supply" body) -> 1B, MC=FDV
// Idempotent: exact-string swaps + id-keyed <script> injections.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const CDFIX='<script id="lx-cdfix">(function(){function nd(){var n=new Date(),y=n.getFullYear(),m=n.getMonth(),dd=n.getDate();return dd<15?new Date(y,m,15):new Date(y,m+1,1);}function p(x){return(x<10?"0":"")+x;}function run(){var t=nd();var dl=document.getElementById("cdDate");if(dl)dl.textContent=t.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});function tk(){var s=Math.max(0,Math.floor((t.getTime()-Date.now())/1000));var D=document.getElementById("cdD"),H=document.getElementById("cdH"),M=document.getElementById("cdM"),S=document.getElementById("cdS");if(D)D.textContent=p(Math.floor(s/86400));if(H)H.textContent=p(Math.floor(s%86400/3600));if(M)M.textContent=p(Math.floor(s%3600/60));if(S)S.textContent=p(s%60);}tk();setInterval(tk,1000);}if(document.readyState!=="loading")run();else document.addEventListener("DOMContentLoaded",run);})();</script>';

const LPTICKER='<script id="lx-lpticker">(function(){function sync(){var t=document.getElementById("tokenTicker"),o=document.getElementById("supplyTicker");if(!o)return;var v=t&&t.value?t.value.toUpperCase().trim():"";o.textContent=v||"TOKENS";}var t=document.getElementById("tokenTicker");if(t)t.addEventListener("input",sync);if(document.readyState!=="loading")sync();else document.addEventListener("DOMContentLoaded",sync);})();</script>';

let stats={countdown:0, lpticker:0, lumos:0, trending:0, soro:0, assetsTable:0};
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k]; const before=h;

      // THE HOME PAGE THREW ON EVERY LOAD, found by the daily health bot 2026-10-12:
      //   Uncaught TypeError: Cannot read properties of null (reading 'closest')
      //
      // The design's own trending-tabs IIFE guards the RESULT but not the LOOKUP:
      //
      //   const card = document.getElementById('trendingList').closest('.market-card');
      //   if (!card) return;          <-- never reached; the line above already threw
      //
      // `trendingList` does not exist on lumoscore-home.html, so `.closest` runs on null. An uncaught
      // throw stops the REST of that script block dead, which is how this codebase has lost whole
      // features to one missing id before.
      //
      // The null-check the author meant to write, and nothing else: when the element is absent `card`
      // is falsy and the existing `if (!card) return;` does exactly what it always did.
      if(h.indexOf("getElementById('trendingList').closest(")>=0){
        h=h.split("const card = document.getElementById('trendingList').closest('.market-card');")
           .join("const trEl = document.getElementById('trendingList');"
               + " const card = trEl && trEl.closest('.market-card');");
        stats.trending++;
      }

      // THE REWARDS PAGE LOST TEN FEATURES TO ONE DELETED BUTTON. Same bot run, same class of fault:
      //   Uncaught TypeError: Cannot read properties of null (reading 'addEventListener')
      //
      // `soroBtn` was the Smart Swap / Soroswap button, REMOVED on 2026-09-04 when that route turned
      // out to deduct 0.2% and collect nothing. The element went; this line wiring it did not. It sits
      // in the middle of an unbroken run of getElementById(...).addEventListener(...) calls, so the
      // throw takes out everything after it. Measured on the container, in order:
      //
      //   ov, roundSel, netseg, ptabs   wired     (before the throw)
      //   soroBtn                       THROWS    (no such element)
      //   csvBtn, moCsv, moClose, ov    DEAD      (CSV export and the modal/overlay controls)
      //   cdDate, cdD, cdH, cdM, cdS    DEAD      (the countdown)
      //
      // NOTE, because it is a second writer and not an accident: the CDFIX block below injects a
      // countdown that is the same nd()/p()/tk() logic as the design's — it was written to replace
      // exactly this dead code. Restoring the design's listeners brings its countdown back too, so
      // both now run. They compute identically, so the displayed value is unchanged; it is one
      // redundant interval, not a conflict. Removing CDFIX is the tidy follow-up, deliberately not
      // bundled into a fix whose job is to stop a page throwing.
      if(h.indexOf("document.getElementById('soroBtn').addEventListener(")>=0){
        h=h.split("document.getElementById('soroBtn').addEventListener('click',openSoro);")
           .join("var soroEl=document.getElementById('soroBtn');"
               + "if(soroEl)soroEl.addEventListener('click',openSoro);");
        stats.soro++;
      }

      // THE SAME FAULT ON 24 PAGES, and the widest instance of it. The design's mock assets table does:
      //
      //   const tbody = document.getElementById('assetsTable');
      //   assets.forEach((a, i) => { ... tbody.appendChild(tr); });
      //
      // `assetsTable` exists on exactly 2 of the 26 pages that run this script. On the other 24 --
      // /mcp, /privacy, /terms, /support, /whitepaper, every docs page and /list-your-token -- the
      // lookup is null and the append throws, killing whatever the rest of that block was going to do.
      // Reproduced live on lumoscore.com/list-your-token before touching anything.
      //
      // A VARIABLE HOLDS THE LOOKUP, which is why the earlier sweep for getElementById(...).prop did
      // not catch this one; trendingList and soroBtn called the method straight off the lookup.
      //
      // Guarded at the append rather than the loop: `tbody` is referenced in exactly two places (the
      // lookup and this line, checked), so this is the whole fix. Wrapping the forEach would mean
      // matching its closing brace in inherited minified-ish markup for no extra benefit, and on the
      // 2 pages that DO have the table nothing changes at all.
      // NORMALISED, NOT WRAPPED, because the replacement contains its own search string: a plain
      // split/join re-wrapped every run and the containers reached 'if (tbody) if (tbody) ...' on the
      // second build. Collapsing any depth of guard to exactly one is the same edit run twice over.
      // Strip every guard first, then add exactly one. String operations rather than a regex: the
      // literal contains parentheses and a dot, and an escape lost in transit turns the pattern into
      // capture groups that match nothing -- which is how this landed double-guarded in the first place.
      if(h.indexOf('tbody.appendChild(tr);')>=0){
        const was=h;
        while(h.indexOf('if (tbody) tbody.appendChild(tr);')>=0){
          h=h.split('if (tbody) tbody.appendChild(tr);').join('tbody.appendChild(tr);');
        }
        h=h.split('tbody.appendChild(tr);').join('if (tbody) tbody.appendChild(tr);');
        if(h!==was) stats.assetsTable++;
      }

      // #12 rewards countdown
      if(h.indexOf('id="cdDate"')>=0 && h.indexOf('id="lx-cdfix"')<0){
        const bi=h.lastIndexOf('</body>'); if(bi>=0){ h=h.slice(0,bi)+CDFIX+h.slice(bi); stats.countdown++; }
      }
      // #11 launchpad supply ticker
      if(h.indexOf('id="supplyTicker">USDT</span>')>=0){
        h=h.replace('<span class="input-suffix" id="supplyTicker">USDT</span>','<span class="input-suffix" id="supplyTicker">TOKENS</span>');
      }
      // THE DESIGN'S OWN HANDLER WRITES THE SINGULAR, AND IT WINS (RAZA 2026-10-11, twice:
      // "make it Tokens instead of Token"). The static span was already corrected above and the
      // lx-lpticker script below sets "TOKENS" too -- so the served HTML really does say TOKENS and
      // the rendered page really did say TOKEN. Measured on the live page: #supplyTicker.textContent
      // === "TOKEN" with an empty ticker field.
      //
      // The design ships its own ticker listener inline, twice per page key:
      //     if (supplyTicker) supplyTicker.textContent = v || 'TOKEN';
      // It runs on input and at init, after ours, so whatever we set is overwritten. Patching the
      // literal is the only fix that holds -- adding a third writer would just be another race.
      // Both copies are replaced; split/join rather than replace so neither is missed.
      if(h.indexOf("supplyTicker.textContent = v || 'TOKEN'")>=0){
        h=h.split("supplyTicker.textContent = v || 'TOKEN'")
           .join("supplyTicker.textContent = v || 'TOKENS'");
        stats.lptokens=(stats.lptokens||0)+1;
      }
      if(h.indexOf('id="supplyTicker"')>=0 && h.indexOf('id="lx-lpticker"')<0){
        const bi=h.lastIndexOf('</body>'); if(bi>=0){ h=h.slice(0,bi)+LPTICKER+h.slice(bi); stats.lpticker++; }
      }
      // #13 $LUMOS supply reconciliation (fixed 1B, MC = FDV)
      if(h.indexOf('<div class="sub">on 2B total supply</div>')>=0){
        h=h.split('<div class="val">$3.76M</div>').join('<div class="val">$3.20M</div>')
           .split('<div class="val">$6.40M</div>').join('<div class="val">$3.20M</div>')
           .split('<div class="sub">on 1.17B circulating</div>').join('<div class="sub">on 1B circulating</div>')
           .split('<div class="sub">on 2B total supply</div>').join('<div class="sub">= market cap · fixed supply</div>');
        stats.lumos++;
      }

      if(h!==before) json[k]=h;
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('page fixes:', JSON.stringify(stats));
