// Pools "Pool" page: REMOVE the design's chart hover script.
//
// It claimed to read "actual rendered points", but it read the DESIGN's mock series via
// window.__tvlChartState() and formatted with hardcoded mock maths:
//     fmtVal:  v.toFixed(2) + 'M APT'        // always millions, always APT
//     fmtUSD:  v * 1000000 * 0.153           // a baked APT/USD rate
//     fmtDate: now - (1-fracX)*days          // a date invented from the cursor position
// So on a real Stellar pool holding 2,179 DOPE the tooltip cheerfully reported "2.79M XLM / $427,381",
// which is not a rounding error, it is fiction on a page about someone's money.
//
// _ammdata.js draws the real series and now owns the hover too (chHover), reading the points it actually
// plotted, denominating in the pool's own asset, and showing USD only when a rate is genuinely known.
// Idempotent: safe to re-run, does nothing once the containers are clean.
const {read,writeContents}=require(__dirname+'/lib.js');

const MARK='=== Pool chart hover (reads actual rendered points) ===';
function strip(html){
  let out=html, n=0;
  for(;;){
    const m=out.indexOf(MARK); if(m<0) break;
    const i=out.lastIndexOf('<script', m); if(i<0) break;
    const j=out.indexOf('</script>', m); if(j<0) break;   // malformed: leave it rather than eat the page
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
console.log('chart hover: removed '+total+' mock hover script(s)');
