// Audit #38 — fee-tier integrity.
//
// Two real problems this fixes:
//  a) `window.__lxFeeRate` was only ever set by _swapcalc.js / _walletdata.js, so it exists on the
//     Wallet + Dashboard only. Bridge, Trade, Trade-asset and Pools all fell back to the 0.5% default —
//     a 250,000-LUMOS holder was OVER-charged everywhere except the two pages that happened to compute it.
//  b) the tier test summed every balance whose asset_code === "LUMOS", with NO issuer check. Anyone can
//     issue their own "LUMOS" and mint themselves 250K, then pay half fee forever. Now it only counts the
//     canonical mainnet issuer.
//
// This injects one tiny resolver on EVERY page. It publishes:
//     window.__lxFeeRate   0.005 | 0.0025      (never undefined — 0.005 from the first line)
//     window.__lxLumosBal  number | null       (null = unknown/disconnected, distinct from a real 0)
// and fires a `lx:feetier` event once resolved, so the Trade fee banner (_feetier.js) can render the
// user's ACTUAL holding instead of the hardcoded demo number.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const LUMOS_ISS='GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S';

const SCRIPT='<script id="lx-feerate">(function(){if(window.__lxFrBooted)return;window.__lxFrBooted=1;'
+'var ISS="'+LUMOS_ISS+'",THRESH=250000,H="https://horizon.stellar.org";'
+'if(typeof window.__lxFeeRate!=="number")window.__lxFeeRate=0.005;'          // never leave it undefined
+'if(!("__lxLumosBal" in window))window.__lxLumosBal=null;'                   // null = not resolved yet
+'window.__lxLumosThresh=THRESH;window.__lxLumosIssuer=ISS;'
+'function pub(bal){window.__lxLumosBal=bal;window.__lxFeeRate=(bal>=THRESH)?0.0025:0.005;'
+'try{window.dispatchEvent(new CustomEvent("lx:feetier",{detail:{bal:bal,rate:window.__lxFeeRate,thresh:THRESH}}));}catch(_){}}'
+'window.__lxFeeTier=function(){return{bal:window.__lxLumosBal,rate:window.__lxFeeRate,thresh:THRESH};};'
+'window.__lxFeeTierSet=pub;'   // _swapcalc / _walletdata already fetch the account — they publish through here

// AUDIT (user-reported slow Pools-Pool page): this resolver added a SECOND /accounts/<me> request to every
// page, duplicating one the page engines already make. Memoise it here — this script loads first on every
// page, so it is the natural owner — and let the other engines reuse the same promise.
+'window.__lxAcctP=window.__lxAcctP||{};'
+'window.__lxAcct=function(addr){if(!addr)return Promise.resolve(null);'
+'if(!window.__lxAcctP[addr])window.__lxAcctP[addr]=fetch(H+"/accounts/"+addr).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});'
+'return window.__lxAcctP[addr];};'
+'function resolve(){var ME="";try{ME=localStorage.getItem("lumos.address")||"";}catch(_){}'
+'if(!ME){if(window.__lxLumosBal!==null)pub(null);else{window.__lxLumosBal=null;window.__lxFeeRate=0.005;}return;}'
+'if(window.__lxFrFor===ME)return;window.__lxFrFor=ME;'
+'window.__lxAcct(ME).then(function(acc){'
+'if(!acc||!acc.balances){window.__lxFrFor="";return;}'                        // let a later pass retry
+'var lum=acc.balances.filter(function(b){return b.asset_code==="LUMOS"&&b.asset_issuer===ISS;})'
+'.reduce(function(s,b){return s+(+b.balance||0);},0);pub(lum);'
+'}).catch(function(){window.__lxFrFor="";});}'
+'resolve();'
+'window.addEventListener("storage",function(e){if(e&&e.key==="lumos.address"){window.__lxFrFor="";resolve();}});'
+'setTimeout(resolve,1200);setTimeout(resolve,4000);'                          // wallet connects after load
+'})();</script>';   // literal </script> — the serializer escapes it; a \/-escaped one never closes the element

let n=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain','stellar','xrpl']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    let changed=false;
    for(const k of Object.keys(json)){
      let h=json[k];
      h=h.replace(/<script id="lx-feerate">[\s\S]*?<\/script>/g,'');           // strip FIRST, globally
      const bi=h.lastIndexOf('</body>'); if(bi<0) continue;
      json[k]=h.slice(0,bi)+SCRIPT+h.slice(bi); changed=true; n++;
    }
    if(changed){ const serialized=JSON.stringify(json).split('</').join('<'+B+'/'); fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8'); }
  }
}
console.log('fee-tier resolver (issuer-checked) on '+n+' page keys');
