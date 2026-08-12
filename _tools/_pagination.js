// Pools "Pool" page: REMOVE the old design-era transactions pager.
//
// This file used to INJECT a <script id="lx-txpage"> that faked a 137-row transaction set by cloning the
// design's mock rows (templates[i % templates.length]) and paging them 50 at a time. Once _ammdata.js
// started filling the same tbody with real Horizon transactions, that script became actively harmful:
//   * every Prev/Next click wiped the tbody and re-appended its stale clones, so all pages showed the
//     SAME transactions -- the bug as reported;
//   * it rebuilt .controls from scratch on every render, destroying the listeners _ammdata bound there;
//   * it wrote its fake "of 137" into the footer over the real count.
// Real pagination now lives in _ammdata.js (txApply). This transform strips the dead script instead.
// Idempotent: safe to re-run, does nothing once the containers are clean.
const {read,getContents,writeContents}=require(__dirname+'/lib.js');

const OPEN='<script id="lx-txpage">';
function strip(html){
  let out=html, n=0;
  for(;;){
    const i=out.indexOf(OPEN); if(i<0) break;
    const j=out.indexOf('</script>', i); if(j<0) break;   // malformed: leave it alone rather than eat the page
    out=out.slice(0,i)+out.slice(j+9); n++;
  }
  return {out,n};
}

let total=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    try{ read(file); }catch(e){ continue; }
    writeContents(file, json=>{
      for(const k of Object.keys(json)){
        const {out,n}=strip(json[k]);
        if(n){ json[k]=out; total+=n; }
      }
    });
  }
}
console.log('tx pagination: removed '+total+' stale lx-txpage script(s)');
