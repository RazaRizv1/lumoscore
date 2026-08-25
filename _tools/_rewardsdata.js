// Rewards page real-data layer — MAINNET, READ-ONLY.
// Fills #eligBox (the connected wallet's live LUMOS holdings + LP-pool shares -> estimated
// payout this round) and rewrites the 3 program-card descriptions to the real Stellar pools.
// Everything else (headline totals, Round reports, Soroban record) is intentionally left as-is
// (placeholders) per product decision. Nothing is removed.
//
// This page always talks to Stellar MAINNET Horizon regardless of the app's network toggle,
// because LUMOS + all reward pools live on mainnet.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const KEYS = ['lumoscore-rewards-dark.html', 'lumoscore-rewards-light.html', 'lumoscore-rewards-mobile.html'];

const STYLE = `<style id="lx-rewards-css">
#eligBox:not(.lxrw){visibility:hidden}
#eligBox .lxrw-bar{display:inline-block;min-width:74px;height:12px;border-radius:6px;vertical-align:middle;background:linear-gradient(90deg,var(--surface-2,#edeef2),var(--border,#dcdde3),var(--surface-2,#edeef2));background-size:200% 100%;animation:lxrwsh 1.15s ease-in-out infinite}
@keyframes lxrwsh{0%{background-position:200% 0}100%{background-position:-200% 0}}
#eligBox .lxrw-empty{padding:20px 6px;text-align:center}
#eligBox .lxrw-empty .t{font-weight:700;color:var(--text);font-size:15px}
#eligBox .lxrw-empty .s{color:var(--text-muted);font-size:13px;margin-top:6px;line-height:1.55;max-width:44ch;margin-left:auto;margin-right:auto}
.lxrw-preview{display:inline-flex;align-items:center;gap:5px;margin-left:10px;padding:3px 9px;border-radius:7px;font:700 10.5px/1.3 'Hanken Grotesk',system-ui,sans-serif;letter-spacing:.03em;text-transform:uppercase;color:#b8860b;background:rgba(245,179,1,.13);border:1px solid rgba(245,179,1,.35);vertical-align:middle;white-space:nowrap}
</style>`;

// ---- browser runtime (mainnet, read-only). No backticks / no ${ } inside. ----
// The design builds #eligBox and the .prog descriptions with its own JS at runtime (and
// can re-render), so we hold our content and re-assert it via a MutationObserver — the same
// re-render-defense pattern used by the wallet/dashboard data layers.
const SCRIPT = `<script id="lx-rewardsdata">(function(){
  var ISSUER="GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S";
  var H="https://horizon.stellar.org";                       // MAINNET (this page only)
  var SE="https://api.stellar.expert/explorer/public";
  var WHALE_UNIT=5000000, WHALE_POOL=1000000, NATIVE_POOL=1000000, ECO_PER_POOL=100000;
  var NATIVE={hex:"78e6cfc930e2d7ceb3f6cefd4f9aa5e098c5b0af086cde0ad3147982f4d217f2",code:"XLM"};
  var ECO=[
    {hex:"2d630c4224248bf23ff7a639bcf05db096c4ed9a96e2d1f3e9b94c2986ef9332",code:"LMNR"},
    {hex:"a7d73ed49edd21b7f3533c8a2a3b534409c1ce9a0909eb6cbb230b957d37faff",code:"yXLM"},
    {hex:"a027264ce20ff9161c0eb8a016ac382432ff1b0248b407374da47d502a0a071e",code:"sages"},
    {hex:"68d62e263f1006fdec7f456ccbd3e2fba67a335b6804088a30050542209d9f51",code:"AQUA"},
    {hex:"afab0b06224d5f9a737b78f3ff2014ddee4f9e747d1c514374e22890dbbe92ba",code:"SSLX"},
    {hex:"9be7d7872051f1575e8f4e69b81954ef3d017f100a4cb3f7a407fb8bc894654f",code:"SHX"},
    {hex:"40bb76280b61590c22398a882ca67b7de328f7ae689c33cc27197059134cd2cc",code:"TKG"},
    {hex:"d6dc92ff8c34c657f3a20e50c6954fecf4c965d804325e0301b0f35da4b1af71",code:"LIBERATOR"},
    {hex:"f0312476658fdd50a87c95ddcee3bedd204c29368a4a647770237610dcdb269b",code:"KALE"},
    {hex:"344e6618b45f6925e7b53a71b7882e6e2c1b983ab0926676f4175a4bfb46b7bf",code:"USDC"}
  ];
  var ECO_CODES=ECO.map(function(p){return p.code;});
  // LumosDAO project / treasury / burn wallets — excluded from ALL reward programs
  // (they never receive, and never count toward any denominator).
  var EXCLUDE={
    "GBIU5NISX5IP6VXZK7DEKLZC4ZVPWNCDEYQLQGXG33Y3J2LHPKPCHUOK":1,
    "GCCDEU4DOW3AQ5WFWY7LDEFZIJAQBI5TQXRT3XAZSWDRLK3LG53HBQCP":1,
    "GAR4HYWGY4YE7WOU2TGH7G4RL7ON72KQP24WWBT755WAWPCKRFS4SHWL":1,
    "GA27ELKFRT7JVZTJW4P3I3ORWLLNKRIB3D6GELPN7IESPOCUNS5NHTOD":1,
    "GCYFMZPDAR7ZTTTBA5DVG2SPR2N4CLPZLGLVI475BCGJ532WOKWRKUDG":1,
    "GAMXMHJX6CW6LZWUYRKVF73GOMRFJDQI57UMA4LE5QUF4DCJRGI55QD6":1,
    "GDVU64GNDFDR3OWKGPK37DAK67RPOK4OMZB4RH7NQN5UOYB4GPFVQUOD":1,
    "GDB46BXMVI7FEZCHG4OTZ3OCSJX4CRBOOK6OJL5JD7BF5QIW3AS53IWA":1
  };
  var PDESC=[
    'Provide liquidity to the <b>LUMOS/XLM</b> pool on Stellar to earn a share of <b>1,000,000 LUMOS</b> every round.',
    'Every 6 months, <b>10 pools</b> are selected — currently <b>LUMOS</b> paired with '+ECO_CODES.join(", ")+'. Each pool pays <b>100,000 LUMOS</b> per round.',
    'Simply hold <b>5,000,000+ LUMOS</b> on Stellar. Every extra 5M you hold earns one more share of the pool.'
  ];

  function num(n){return Math.round(+n||0).toLocaleString("en-US");}
  function pct(x){var p=(+x||0)*100;var s=p>=1?p.toFixed(1):(p>=0.01?p.toFixed(2):p.toFixed(3));return s+"%";}
  function getJSON(u){return fetch(u).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});}
  function myAddr(){try{var a=localStorage.getItem("lumos.address")||"";return /^G[A-Z2-7]{55}$/.test(a)?a:"";}catch(e){return "";}}
  function er(dot,title,sub,val,tot){
    return '<div class="er'+(tot?" tot":"")+'"><div class="ek">'+
      (dot?'<span class="d" style="background:var('+dot+')"></span>':"")+
      '<div><div class="t">'+title+'</div>'+(sub?'<div class="s">'+sub+'</div>':"")+'</div></div>'+
      '<div class="ev mono">'+val+'</div></div>';
  }
  function mark(sig){return '<i data-lxm data-sig="'+sig+'" style="display:none"></i>';}

  // desired #eligBox content, held here and re-asserted by the observer.
  var eligHTML="", eligSig="";
  function setElig(html,sig){ eligHTML=html+mark(sig); eligSig=sig; }
  function skeletonHTML(){
    var b='<span class="lxrw-bar"></span>';
    return er("--accent","Native LP Rewards",b,b)+er("--blue","Ecosystem LP Rewards",b,b)+
      er("--green","Whale Holder Rewards",b,b)+er("","Your estimated total this round","",b,true);
  }
  function emptyHTML(title,sub){ return '<div class="lxrw-empty"><div class="t">'+title+'</div><div class="s">'+sub+'</div></div>'; }

  // Re-assert our content (idempotent). Only writes when the design's render differs from ours,
  // so once ours is in place and the design settles there are no further writes -> no loop.
  function applyAll(){
    var d=document.querySelectorAll(".progs .prog .pdesc");
    for(var i=0;i<3;i++){ if(d[i]&&d[i].innerHTML!==PDESC[i]) d[i].innerHTML=PDESC[i]; }
    var note=document.querySelector(".elig-note");
    if(note&&/Aptos/.test(note.innerHTML)) note.innerHTML=note.innerHTML.replace(/Aptos/g,"Stellar");
    var box=document.getElementById("eligBox");
    if(box&&eligHTML){
      var m=box.querySelector("[data-lxm]");
      if(!m||m.getAttribute("data-sig")!==eligSig){ box.innerHTML=eligHTML; box.classList.add("lxrw"); }
    }
  }
  var sched=false;
  function schedule(){ if(sched)return; sched=true; var raf=window.requestAnimationFrame||function(f){setTimeout(f,16);}; raf(function(){ sched=false; applyAll(); }); }

  function poolShares(hex){return getJSON(H+"/liquidity_pools/"+hex).then(function(j){return j?+j.total_shares:0;});}
  // Total whale "shares" across every LUMOS holder >= 5M. Horizon /accounts?asset is CORS-OK
  // (stellar.expert holders is not, from the browser); it isn't balance-sorted so we page all.
  function whaleTotalShares(){
    if(window.__lxWhaleTS!=null) return Promise.resolve(window.__lxWhaleTS);
    var total=0, pages=0;
    function page(url){
      return getJSON(url).then(function(j){
        if(!j)return total; pages++;
        var recs=(j._embedded&&j._embedded.records)||[];
        recs.forEach(function(acc){
          if(EXCLUDE[acc.account_id||acc.id])return;
          var lb=0;(acc.balances||[]).forEach(function(b){if(b.asset_code==="LUMOS"&&b.asset_issuer===ISSUER)lb=+b.balance;});
          if(lb>=WHALE_UNIT)total+=Math.floor(lb/WHALE_UNIT);
        });
        var next=j._links&&j._links.next&&j._links.next.href;
        if(!next||recs.length===0||pages>=12){ window.__lxWhaleTS=total; return total; }
        return page(next);
      });
    }
    return page(H+"/accounts?asset=LUMOS:"+ISSUER+"&limit=200");
  }

  function compute(a){
    getJSON(H+"/accounts/"+a).then(function(acc){
      if(!acc){ setElig(emptyHTML("No mainnet LUMOS found","This wallet has no LUMOS holdings or LP positions on Stellar mainnet yet."),"none"); applyAll(); return; }
      var bals=acc.balances||[], lumosBal=0, myPool={};
      bals.forEach(function(b){
        if(b.asset_type==="liquidity_pool_shares"){ myPool[b.liquidity_pool_id]=+b.balance; }
        else if(b.asset_code==="LUMOS"&&b.asset_issuer===ISSUER){ lumosBal=+b.balance; }
      });
      var myShares=lumosBal>=WHALE_UNIT?Math.floor(lumosBal/WHALE_UNIT):0;
      var nativeMine=myPool[NATIVE.hex]||0;
      var ecoIn=ECO.filter(function(p){return (myPool[p.hex]||0)>0;});
      var nativeP=nativeMine>0?poolShares(NATIVE.hex):Promise.resolve(0);
      var ecoP=Promise.all(ecoIn.map(function(p){return poolShares(p.hex).then(function(ts){return {p:p,ts:ts,mine:myPool[p.hex]};});}));
      // LP/ecosystem resolve fast; render those first, then fill the whale payout once the
      // (slower) holder-scan denominator resolves — so the box never waits ~15s to show anything.
      Promise.all([nativeP,ecoP]).then(function(res){
        var nativeTS=res[0], ecoArr=res[1];
        var nativeShare=nativeTS>0?nativeMine/nativeTS:0, nativeReward=NATIVE_POOL*nativeShare;
        var ecoReward=0, ecoCodes=[];
        ecoArr.forEach(function(x){var sh=x.ts>0?x.mine/x.ts:0;ecoReward+=ECO_PER_POOL*sh;ecoCodes.push(x.p.code);});
        var nSub=nativeMine>0?("LUMOS/XLM · "+pct(nativeShare)+" of the pool"):"Add LUMOS/XLM liquidity to qualify";
        var nVal=nativeMine>0?("~"+num(nativeReward)):"—";
        var eSub=ecoCodes.length?(ecoCodes.length===1?("LUMOS/"+ecoCodes[0]+" pool"):(ecoCodes.length+" pools · "+ecoCodes.slice(0,3).join(", ")+(ecoCodes.length>3?"…":""))):"Join an eligible LUMOS pool to qualify";
        var eVal=ecoCodes.length?("~"+num(ecoReward)):"—";
        var wSub=myShares>0?(num(lumosBal)+" LUMOS · "+myShares+" share"+(myShares>1?"s":"")):(lumosBal>0?(num(lumosBal)+" LUMOS · below 5M"):"Hold 5M+ LUMOS to qualify");
        function render(whaleReward,pending){
          var wVal=myShares>0?(pending?"~…":"~"+num(whaleReward)):"—";
          var total=nativeReward+ecoReward+whaleReward;
          var tVal=pending?"~… LUMOS":("~"+num(total)+" LUMOS");
          setElig(er("--accent","Native LP Rewards",nSub,nVal)+er("--blue","Ecosystem LP Rewards",eSub,eVal)+
            er("--green","Whale Holder Rewards",wSub,wVal)+er("","Your estimated total this round","",tVal,true),pending?"r1":"r2");
          applyAll();
        }
        if(myShares>0){ render(0,true); whaleTotalShares().then(function(whaleTS){ render(whaleTS>0?WHALE_POOL*(myShares/whaleTS):0,false); }); }
        else { render(0,false); }
      });
    });
  }

  // AUDIT FIX: the "Round N — full report" card is fabricated distribution history (fake rounds, wallets,
  // amounts) presented as real on a real-funds app. Product decision keeps the content — so LABEL it: an
  // amber "Illustrative preview" badge on the heading + the fake "Distributed <date>" line replaced with an
  // honest note. Idempotent (badge presence check) and re-asserted with applyAll (design re-renders).
  function markPreview(){
    try{
      var walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT); var tn, headEl=null;
      while(tn=walker.nextNode()){ if(/Round \\d+ \\u2014 full report|Round \\d+ — full report/.test(tn.nodeValue)){ headEl=tn.parentElement; break; } }
      if(!headEl)return;
      if(!headEl.querySelector(".lxrw-preview")&&!(headEl.nextElementSibling&&headEl.nextElementSibling.classList&&headEl.nextElementSibling.classList.contains("lxrw-preview"))){
        var b=document.createElement("span"); b.className="lxrw-preview"; b.textContent="Illustrative preview"; headEl.appendChild(b); }
      var card=headEl.closest("section,[class*=card],[class*=panel],div")||headEl.parentElement;
      // the "Distributed <date> on Stellar" sub-line may be split across nodes — match the element whose
      // text STARTS with "Distributed" and rewrite it whole (idempotent: rewritten text no longer matches).
      var els=[].slice.call(card.querySelectorAll("*")).filter(function(el){ return el.children.length<=2&&/^\\s*Distributed\\s/.test(el.textContent||"")&&(el.textContent||"").length<70; });
      if(els.length){ var tgt=els[els.length-1]; if(tgt.textContent.indexOf("Sample data")<0)tgt.textContent="Sample data \\u2014 the first live distribution has not run yet"; }
    }catch(_){}
  }
  function boot(){
    if(window.__lxRwBoot)return; window.__lxRwBoot=1;
    try{ document.title="LUMOS rewards — LP and holder incentives | LumosCore"; }catch(_){}   /* baked title said "My Wallet" */
    var a=myAddr();
    if(!a){ setElig(emptyHTML("Connect your Stellar wallet","See your live LUMOS balance and pool positions, and what you would earn this round."),"empty"); }
    else if(EXCLUDE[a]){ setElig(emptyHTML("Not eligible for rewards","LumosDAO project, treasury and burn wallets are excluded from all reward programs."),"excl"); }
    else { setElig(skeletonHTML(),"skel"); compute(a); }
    applyAll();
    var root=document.querySelector(".rwpage")||document.body;
    try{ new MutationObserver(schedule).observe(root,{childList:true,subtree:true}); }catch(e){}
    markPreview();
    [120,400,1000,2200].forEach(function(ms){ setTimeout(function(){ applyAll(); markPreview(); },ms); });
  }
  if(document.readyState!=="loading") boot();
  else document.addEventListener("DOMContentLoaded",boot);
})();</script>`;

// ---- inject into every container that has the rewards keys ----
const files = fs.readdirSync('.').filter(f => /^lumoscore-.*-(desktop|mobile)\.html$/.test(f));
let n = 0, containers = 0;
for (const file of files) {
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;
  for (const k of KEYS) {
    if (!json[k]) continue;
    let p = json[k];
    // idempotent: strip any prior injection first
    p = p.replace(/<style id="lx-rewards-css">[\s\S]*?<\/style>/g, '')
         .replace(/<script id="lx-rewardsdata">[\s\S]*?<\/script>/g, '');
    if (p.indexOf('</head>') >= 0) p = p.replace('</head>', STYLE + '</head>');
    else { const hb = p.lastIndexOf('</body>'); p = p.slice(0, hb) + STYLE + p.slice(hb); }
    const bi = p.lastIndexOf('</body>');
    p = p.slice(0, bi) + SCRIPT + p.slice(bi);
    json[k] = p; changed = true; n++;
  }
  if (changed) {
    containers++;
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
console.log('rewards data: injected=' + n + ' keys across ' + containers + ' containers');
