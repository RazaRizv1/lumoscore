// Page-level fixes:
//  #11 Launchpad: stray "USDT" supply-unit -> dynamic ticker (mirrors #tokenTicker, default TOKENS)
//  #12 Rewards: dead "Next distribution" countdown -> self-contained script (next 1st/15th, ticks)
//  #13 $LUMOS: reconcile the supply contradiction (hero 1.17B/2B vs the "1B fixed supply" body) -> 1B, MC=FDV
// Idempotent: exact-string swaps + id-keyed <script> injections.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const CDFIX='<script id="lx-cdfix">(function(){function nd(){var n=new Date(),y=n.getFullYear(),m=n.getMonth(),dd=n.getDate();return dd<15?new Date(y,m,15):new Date(y,m+1,1);}function p(x){return(x<10?"0":"")+x;}function run(){var t=nd();var dl=document.getElementById("cdDate");if(dl)dl.textContent=t.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});function tk(){var s=Math.max(0,Math.floor((t.getTime()-Date.now())/1000));var D=document.getElementById("cdD"),H=document.getElementById("cdH"),M=document.getElementById("cdM"),S=document.getElementById("cdS");if(D)D.textContent=p(Math.floor(s/86400));if(H)H.textContent=p(Math.floor(s%86400/3600));if(M)M.textContent=p(Math.floor(s%3600/60));if(S)S.textContent=p(s%60);}tk();setInterval(tk,1000);}if(document.readyState!=="loading")run();else document.addEventListener("DOMContentLoaded",run);})();</script>';

const LPTICKER='<script id="lx-lpticker">(function(){function sync(){var t=document.getElementById("tokenTicker"),o=document.getElementById("supplyTicker");if(!o)return;var v=t&&t.value?t.value.toUpperCase().trim():"";o.textContent=v||"TOKENS";}var t=document.getElementById("tokenTicker");if(t)t.addEventListener("input",sync);if(document.readyState!=="loading")sync();else document.addEventListener("DOMContentLoaded",sync);})();</script>';

let stats={countdown:0, lpticker:0, lumos:0};
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k]; const before=h;

      // #12 rewards countdown
      if(h.indexOf('id="cdDate"')>=0 && h.indexOf('id="lx-cdfix"')<0){
        const bi=h.lastIndexOf('</body>'); if(bi>=0){ h=h.slice(0,bi)+CDFIX+h.slice(bi); stats.countdown++; }
      }
      // #11 launchpad supply ticker
      if(h.indexOf('id="supplyTicker">USDT</span>')>=0){
        h=h.replace('<span class="input-suffix" id="supplyTicker">USDT</span>','<span class="input-suffix" id="supplyTicker">TOKENS</span>');
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
