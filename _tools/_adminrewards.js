// ADMIN — LUMOS Rewards: calculate a round for EVERY participant, then pay it out.
//
// The public Rewards page (_rewardsdata.js) answers "what would I get?" for the one connected wallet.
// This answers "what does everyone get, right now, and send it". The program rules are read from the
// same constants so the two cannot drift: 1,000,000 LUMOS across LUMOS/XLM LPs, 100,000 per eco pool,
// and 1,000,000 across holders of 5,000,000+ LUMOS at one share per 5M held.
//
// The page is CLONED from the admin dashboard shell, the way _admin.js builds Revenue, so it inherits
// the sidebar, theme and chrome rather than re-deriving them.
//
// WHY THE ADMIN PAGES NEED THEIR OWN SIGNER: measured, lxSign / lxStellar / lxConnect are all undefined
// here -- the public wallet layer is not injected on admin pages. Rather than drag those large
// transforms across, this ships a small extension-only signer (Freighter / Rabet). Mobile wallets over
// WalletConnect are deliberately out of scope for an admin payout screen.
//
// NOTHING IS SENT WITHOUT TWO DELIBERATE ACTS: the admin presses Send, and then the wallet asks them to
// sign each batch. Payments are batched 100 operations per transaction because that is the protocol
// limit, so a 300-recipient round is 3 signatures rather than 300.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const MAIN = `
      <div class="admin-page-head">
        <h1 class="admin-page-title">LUMOS Rewards</h1>
        <div class="admin-page-actions">
          <button class="adm-btn ghost" id="lxrCsv" type="button" disabled>Export CSV</button>
          <button class="adm-btn primary" id="lxrGen" type="button">Generate round</button>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-head"><span class="kpi-label">Round total</span></div><div class="kpi-value" id="lxrTotal">&mdash;</div><div class="kpi-foot" id="lxrTotalF">press Generate to calculate</div></div>
        <div class="kpi"><div class="kpi-head"><span class="kpi-label">Recipients</span></div><div class="kpi-value" id="lxrCount">&mdash;</div><div class="kpi-foot">wallets due a payout</div></div>
        <div class="kpi"><div class="kpi-head"><span class="kpi-label">Liquidity programs</span></div><div class="kpi-value" id="lxrLp">&mdash;</div><div class="kpi-foot" id="lxrLpF">LUMOS/XLM + eco pools</div></div>
        <div class="kpi"><div class="kpi-head"><span class="kpi-label">Holder program</span></div><div class="kpi-value" id="lxrWhale">&mdash;</div><div class="kpi-foot" id="lxrWhaleF">5,000,000+ LUMOS</div></div>
      </div>

      <div class="adm-card">
        <div class="adm-card-head">
          <div><div class="adm-card-title">Payouts this round</div><div class="adm-card-sub" id="lxrSub">Nothing calculated yet.</div></div>
          <div class="adm-card-actions"><button class="adm-btn primary" id="lxrSend" type="button" disabled>Send rewards</button></div>
        </div>
        <div class="adm-card-body" style="padding:0">
          <table class="adm-table" id="lxrTable" style="width:100%;border-collapse:collapse">
            <thead><tr><th style="text-align:left">Wallet</th><th style="text-align:right">LUMOS/XLM</th><th style="text-align:right">Eco pools</th><th style="text-align:right">Holder</th><th style="text-align:right">Total LUMOS</th><th style="text-align:right">Status</th></tr></thead>
            <tbody><tr><td colspan="6" class="lxadm-empty">Press <b>Generate round</b> to calculate every participant&rsquo;s share as of now.</td></tr></tbody>
          </table>
        </div>
      </div>
`;

const MOB = `
      <div class="mob-page-head">
        <h1 class="mob-page-title">LUMOS Rewards</h1>
      </div>
      <div class="lxadm-note">Calculating and paying a reward round needs a wallet extension, so it is done from a desktop browser. This page is read-only on mobile.</div>
`;

const CSS = `<style id="lx-adminrewards-css">
#lxrTable td.num-cell,#lxrTable th{font-variant-numeric:tabular-nums}
.lxr-st{display:inline-block;font:700 11px/1 "Hanken Grotesk",system-ui,sans-serif;padding:4px 8px;border-radius:999px;background:rgba(127,127,140,.14);color:var(--text-muted)}
.lxr-st.sent{background:rgba(34,197,94,.16);color:#22c55e}
.lxr-st.fail{background:rgba(239,68,68,.16);color:#ef4444}
.lxr-warn{margin:0 0 16px;padding:13px 16px;border-radius:12px;border:1px solid rgba(245,179,1,.35);background:rgba(245,179,1,.10);color:var(--text);font-size:13.5px;line-height:1.6}
.lxr-prog{margin-top:10px;font-size:13px;color:var(--text-muted)}
</style>`;

// Browser code. Template literal: HTML attributes are single-quoted, and there are no \\n or regex
// escapes inside -- both collapse when a literal is parsed. Newlines come from String.fromCharCode(10).
const SCRIPT = '<script id="lx-adminrewards">' + `(function(){
if(window.__lxRwAdmin)return; window.__lxRwAdmin=1;
var H="https://horizon.stellar.org";
var ISSUER="GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S";
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
// Same treasury/burn list the public rewards engine uses. These never receive and never count toward a
// denominator -- paying ourselves would inflate the round and dilute everyone real.
var EXCLUDE={
 "GBIU5NISX5IP6VXZK7DEKLZC4ZVPWNCDEYQLQGXG33Y3J2LHPKPCHUOK":1,
 "GCCDEU4DOW3AQ5WFWY7LDEFZIJAQBI5TQXRT3XAZSWDRLK3LG53HBQCP":1,
 "GAR4HYWGY4YE7WOU2TGH7G4RL7ON72KQP24WWBT755WAWPCKRFS4SHWL":1,
 "GA27ELKFRT7JVZTJW4P3I3ORWLLNKRIB3D6GELPN7IESPOCUNS5NHTOD":1,
 "GCYFMZPDAR7ZTTTBA5DVG2SPR2N4CLPZLGLVI475BCGJ532WOKWRKUDG":1,
 "GAMXMHJX6CW6LZWUYRKVF73GOMRFJDQI57UMA4LE5QUF4DCJRGI55QD6":1,
 "GDVU64GNDFDR3OWKGPK37DAK67RPOK4OMZB4RH7NQN5UOYB4GPFVQUOD":1,
 "GDB46BXMVI7FEZCHG4OTZ3OCSJX4CRBOOK6OJL5JD7BF5QIW3AS53IWA":1};

function q(s){return document.querySelector(s);}
function j(u){return fetch(u).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});}
function esc(s){return (String(s==null?"":s).replace(/[<>&]/g,function(c){return c==="<"?"&lt;":c===">"?"&gt;":"&amp;";})).split(String.fromCharCode(39)).join("&#39;");}
function shortG(a){return a?a.slice(0,4)+"\\u2026"+a.slice(-4):"";}
function num(n,d){return (+n||0).toLocaleString(undefined,{maximumFractionDigits:(d==null?2:d)});}
function isPage(){var t=((q(".admin-page-title")||{}).textContent||"").trim();return t.indexOf("LUMOS Rewards")===0;}
function sdk(){ if(window.StellarBase)return Promise.resolve(window.StellarBase);
  return new Promise(function(res,rej){ var el=document.createElement("script");
    el.src="/assets/vendor/stellar-base-13.0.1.min.js";
    el.onload=function(){ window.StellarBase?res(window.StellarBase):rej(new Error("SDK failed to load")); };
    el.onerror=function(){ rej(new Error("SDK failed to load")); }; document.head.appendChild(el); }); }

// ---- the round ---------------------------------------------------------------------------------
// Every holder of a pool, from Horizon's /accounts?liquidity_pool= index. An account can hold shares in
// many pools, so its balance is matched by liquidity_pool_id rather than taken as the first entry.
function poolHolders(hex){
  var out={};
  function page(url,depth){
    return j(url).then(function(d){ if(!d)return;
      var rs=(d._embedded&&d._embedded.records)||[];
      rs.forEach(function(a){
        (a.balances||[]).forEach(function(b){
          if(b.asset_type==="liquidity_pool_shares"&&b.liquidity_pool_id===hex){ out[a.id]=(out[a.id]||0)+(+b.balance||0); } }); });
      var nx=d._links&&d._links.next&&d._links.next.href;
      if(rs.length===200&&nx&&depth<10)return page(nx,depth+1); }); }
  return page(H+"/accounts?liquidity_pool="+hex+"&limit=200",1).then(function(){ return out; });
}
function poolTotal(hex){ return j(H+"/liquidity_pools/"+hex).then(function(p){ return p?+p.total_shares:0; }); }

// Holders of 5,000,000+ LUMOS. stellar.expert ranks by balance descending, so this stops at the first
// account below the line instead of walking every trustline.
function whales(){
  var list=[];
  function page(cur,depth){
    return j("/lxapi/holders?asset=LUMOS-"+ISSUER+"&limit=200"+(cur?("&cursor="+encodeURIComponent(cur)):"")).then(function(d){
      var rs=(d&&d._embedded&&d._embedded.records)||[]; if(!rs.length)return;
      var below=false;
      for(var i=0;i<rs.length;i++){ var bal=(+rs[i].balance||0)/1e7;
        if(bal<WHALE_UNIT){ below=true; break; }
        var ad=rs[i].address||rs[i].account;
        if(!EXCLUDE[ad])list.push({addr:ad,bal:bal}); }
      if(below)return;
      var nx=rs[rs.length-1].paging_token;
      if(nx&&depth<8)return page(nx,depth+1); }); }
  return page("",1).then(function(){ return list; });
}

var ROUND=null;
function generate(btn){
  var sub=q("#lxrSub"), tb=q("#lxrTable tbody");
  btn.disabled=true; btn.textContent="Calculating\\u2026";
  if(sub)sub.textContent="Reading pool holders and LUMOS balances from mainnet\\u2026";
  var pools=[{hex:NATIVE.hex,code:"XLM",pot:NATIVE_POOL,native:true}];
  ECO.forEach(function(p){ pools.push({hex:p.hex,code:p.code,pot:ECO_PER_POOL,native:false}); });
  var acc={};
  function add(addr,field,amt){ if(!amt||amt<=0)return; if(EXCLUDE[addr])return;
    var r=acc[addr]=acc[addr]||{addr:addr,native:0,eco:0,whale:0};
    r[field]+=amt; }
  var jobs=pools.map(function(p){
    return Promise.all([poolTotal(p.hex),poolHolders(p.hex)]).then(function(z){
      var ts=z[0], hold=z[1]; if(!(ts>0))return {code:p.code,paid:0,holders:0};
      var paid=0,n=0;
      Object.keys(hold).forEach(function(a){ if(EXCLUDE[a])return;
        var share=hold[a]/ts, amt=p.pot*share; if(amt>0){ add(a,p.native?"native":"eco",amt); paid+=amt; n++; } });
      return {code:p.code,paid:paid,holders:n}; }); });
  jobs.push(whales().then(function(ws){
    // One share per whole 5,000,000 held; the pot is split across all shares, so this needs the total
    // before any individual amount can be known.
    var tot=0; ws.forEach(function(w){ w.sh=Math.floor(w.bal/WHALE_UNIT); tot+=w.sh; });
    if(tot>0)ws.forEach(function(w){ add(w.addr,"whale",WHALE_POOL*(w.sh/tot)); });
    return {code:"holders",paid:tot>0?WHALE_POOL:0,holders:ws.length}; }));
  Promise.all(jobs).then(function(res){
    var rows=Object.keys(acc).map(function(k){ var r=acc[k];
      r.total=r.native+r.eco+r.whale; return r; })
      .filter(function(r){ return r.total>0.0000001; })
      .sort(function(a,b){ return b.total-a.total; });
    ROUND={rows:rows,at:new Date()};
    var tot=rows.reduce(function(s,r){return s+r.total;},0);
    var lp=rows.reduce(function(s,r){return s+r.native+r.eco;},0);
    var wh=rows.reduce(function(s,r){return s+r.whale;},0);
    setTxt("#lxrTotal", num(tot,0)+" LUMOS");
    setTxt("#lxrTotalF","calculated "+ROUND.at.toLocaleString());
    setTxt("#lxrCount", String(rows.length));
    setTxt("#lxrLp", num(lp,0));
    setTxt("#lxrWhale", num(wh,0));
    var empty=res.filter(function(r){ return r&&r.holders===0; }).map(function(r){ return r.code; });
    setTxt("#lxrLpF","LUMOS/XLM + "+ECO.length+" eco pools"+(empty.length?(" \\u00b7 "+empty.length+" pool(s) with no LPs"):""));
    if(sub)sub.textContent=rows.length
      ? (rows.length+" wallets \\u00b7 "+num(tot,0)+" LUMOS \\u00b7 as of "+ROUND.at.toLocaleString())
      : "No wallet qualifies for this round.";
    render();
    btn.disabled=false; btn.textContent="Recalculate";
    var csv=q("#lxrCsv"); if(csv)csv.disabled=!rows.length;
    var snd=q("#lxrSend"); if(snd)snd.disabled=!rows.length;
  }).catch(function(e){
    btn.disabled=false; btn.textContent="Generate round";
    if(sub)sub.textContent="Could not calculate: "+((e&&e.message)||e);
  });
}
function setTxt(sel,t){ var e=q(sel); if(e)e.textContent=t; }
function render(){
  var tb=q("#lxrTable tbody"); if(!tb||!ROUND)return;
  if(!ROUND.rows.length){ tb.innerHTML="<tr><td colspan='6' class='lxadm-empty'>No wallet qualifies for this round.</td></tr>"; return; }
  tb.innerHTML=ROUND.rows.map(function(r){
    var st=r.sent?"<span class='lxr-st sent'>sent</span>"
        :(r.err?("<span class='lxr-st fail' title='"+esc(r.err)+"'>failed</span>")
        :"<span class='lxr-st'>pending</span>");
    return "<tr><td class='mono'><a class='lxadm-link' target='_blank' rel='noopener' href='https://stellar.expert/explorer/public/account/"+esc(r.addr)+"'>"+esc(shortG(r.addr))+"</a></td>"
      +"<td class='num-cell' style='text-align:right'>"+num(r.native)+"</td>"
      +"<td class='num-cell' style='text-align:right'>"+num(r.eco)+"</td>"
      +"<td class='num-cell' style='text-align:right'>"+num(r.whale)+"</td>"
      +"<td class='num-cell' style='text-align:right'><b>"+num(r.total)+"</b></td>"
      +"<td style='text-align:right'>"+st+"</td></tr>"; }).join("");
}

// ---- signing -----------------------------------------------------------------------------------
// Extension wallets only. An admin payout screen is a desktop task, and pulling the public site's
// WalletConnect layer in here would be a large dependency for no gain.
function wallet(){
  if(window.freighterApi&&window.freighterApi.getPublicKey)return {name:"Freighter",
    addr:function(){ return window.freighterApi.getPublicKey(); },
    sign:function(x){ return window.freighterApi.signTransaction(x,{networkPassphrase:"Public Global Stellar Network ; September 2015"})
      .then(function(r){ return (r&&r.signedTxXdr)||r; }); }};
  if(window.rabet)return {name:"Rabet",
    addr:function(){ return window.rabet.connect().then(function(r){ return r.publicKey; }); },
    sign:function(x){ return window.rabet.sign(x,"mainnet").then(function(r){ return r.xdr; }); }};
  return null;
}
// 100 operations is the protocol limit for one transaction, so a 300-wallet round is 3 signatures.
function batches(rows,size){ var out=[]; for(var i=0;i<rows.length;i+=size)out.push(rows.slice(i,i+size)); return out; }

function send(btn){
  if(!ROUND||!ROUND.rows.length)return;
  var w=wallet();
  if(!w){ alert("No wallet extension found. Install Freighter or Rabet, unlock it, and reload this page."); return; }
  var due=ROUND.rows.filter(function(r){ return !r.sent&&r.total>0.0000001; });
  var tot=due.reduce(function(s,r){return s+r.total;},0);
  var bs=batches(due,100);
  if(!confirm("Send "+num(tot,0)+" LUMOS to "+due.length+" wallets?"+String.fromCharCode(10)+String.fromCharCode(10)
    +"This is "+bs.length+" transaction"+(bs.length===1?"":"s")+" and your wallet will ask you to sign each one."
    +String.fromCharCode(10)+"Payments on Stellar are final and cannot be reversed."))return;
  btn.disabled=true;
  var prog=q("#lxrProg");
  if(!prog){ prog=document.createElement("div"); prog.id="lxrProg"; prog.className="lxr-prog";
    var head=q(".adm-card-head"); if(head)head.parentNode.insertBefore(prog,head.nextSibling); }
  sdk().then(function(S){
    return w.addr().then(function(from){
      var asset=new S.Asset("LUMOS",ISSUER);
      var i=0;
      function step(){
        if(i>=bs.length){ prog.textContent="Done \\u2014 "+bs.length+" transaction(s) submitted."; btn.disabled=false; render(); return; }
        var batch=bs[i];
        prog.textContent="Batch "+(i+1)+" of "+bs.length+" \\u2014 waiting for your signature\\u2026";
        // The sequence number is re-read for EVERY batch: reusing a stale one makes the second
        // transaction fail with tx_bad_seq once the first has been accepted.
        return j(H+"/accounts/"+from).then(function(acct){
          if(!acct)throw new Error("Could not load the paying account");
          // TransactionBuilder's fee is the base fee PER OPERATION, not the total -- it multiplies by
          // the operation count itself. Passing a total here made a 56-payment batch pay 56x what it
          // needed to. 1000 stroops is 10x the network minimum, which is cheap headroom against
          // congestion: a full 100-op batch costs 0.01 XLM.
          var tb=new S.TransactionBuilder(new S.Account(from,acct.sequence),
            {fee:"1000",networkPassphrase:S.Networks.PUBLIC});
          batch.forEach(function(r){ tb.addOperation(S.Operation.payment({destination:r.addr,asset:asset,amount:r.total.toFixed(7)})); });
          var tx=tb.setTimeout(300).build();
          return w.sign(tx.toXDR()).then(function(signed){
            if(!signed)throw new Error("Signing cancelled");
            prog.textContent="Batch "+(i+1)+" of "+bs.length+" \\u2014 submitting\\u2026";
            return fetch(H+"/transactions",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
              body:"tx="+encodeURIComponent(signed)}).then(function(r){ return r.json(); }).then(function(res){
              if(res&&(res.successful||res.hash)){ batch.forEach(function(r){ r.sent=true; r.tx=res.hash; }); }
              else { var rc=res&&res.extras&&res.extras.result_codes;
                var msg=rc?JSON.stringify(rc):"submission failed";
                batch.forEach(function(r){ r.err=msg; }); }
              render(); i++; return step(); }); }); });
      }
      return step();
    });
  }).catch(function(e){
    if(prog)prog.textContent="Stopped: "+((e&&e.message)||e);
    btn.disabled=false; render();
  });
}

function csv(){
  if(!ROUND)return;
  var NL=String.fromCharCode(10);
  var head="wallet,lumos_xlm,eco_pools,holder,total_lumos"+NL;
  var body=ROUND.rows.map(function(r){ return [r.addr,r.native.toFixed(7),r.eco.toFixed(7),r.whale.toFixed(7),r.total.toFixed(7)].join(","); }).join(NL);
  var bl=new Blob([head+body],{type:"text/csv"}), u=URL.createObjectURL(bl);
  var el=document.createElement("a"); el.href=u; el.download="lumoscore-rewards-round.csv"; el.click();
  setTimeout(function(){URL.revokeObjectURL(u);},1000);
}

function boot(){
  if(!isPage())return;
  var head=q(".admin-page-head");
  if(head&&!q(".lxr-warn")){ var wn=document.createElement("div"); wn.className="lxr-warn";
    wn.innerHTML="<b>Generate</b> reads every pool holder and LUMOS balance from mainnet and works out this round exactly as the public Rewards page does for a single wallet. <b>Send</b> pays real LUMOS from the wallet you sign with, in batches of 100. Stellar payments are final.";
    head.parentNode.insertBefore(wn, head.nextSibling); }
  var g=q("#lxrGen"); if(g&&!g.__lx){ g.__lx=1; g.addEventListener("click",function(){ generate(g); }); }
  var s=q("#lxrSend"); if(s&&!s.__lx){ s.__lx=1; s.addEventListener("click",function(){ send(s); }); }
  var c=q("#lxrCsv"); if(c&&!c.__lx){ c.__lx=1; c.addEventListener("click",csv); }
  window.__lxRoundDbg=function(){ return ROUND; };
}
if(document.readyState!=="loading")boot(); else document.addEventListener("DOMContentLoaded",boot);
})();` + '</' + 'script>';

const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>';
function navItem(active, suffix) {
  return '<a class="adn-item ' + (active ? 'active' : '') + '" href="lumoscore-admin-rewards' + suffix + '.html" data-tip="LUMOS Rewards">\n      '
    + ICON + '\n      <span class="adn-label">Rewards</span>\n    </a>\n    ';
}
function variantOf(key) { if (/-dark\.html$/.test(key)) return '-dark'; if (/-mobile\.html$/.test(key)) return '-mobile'; return ''; }

let made = 0, pages = 0;
for (const c of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain', 'stellar', 'xrpl']) {
  for (const dev of ['desktop', 'mobile']) {
    const file = `lumoscore-${c}-${dev}.html`;
    let data; try { data = read(file); } catch (e) { continue; }
    const { json, s, e } = getContents(data);
    let changed = false;

    // build the page from the dashboard shell, exactly as the Revenue page is built
    Object.keys(json).filter(k => /^lumoscore-admin-dashboard(-dark|-mobile)?\.html$/.test(k)).forEach(function (dk) {
      const suffix = variantOf(dk);
      const rk = 'lumoscore-admin-rewards' + suffix + '.html';
      const h = json[dk];
      const tag = suffix === '-mobile' ? '<main class="mob-main">' : '<main class="admin-main">';
      const mi = h.indexOf(tag);
      const me = h.indexOf('</main>', mi);
      if (mi < 0 || me < 0) return;
      let page = h.slice(0, mi) + tag + (suffix === '-mobile' ? MOB : MAIN) + h.slice(me);
      page = page.replace(/<title>[\s\S]*?<\/title>/, '<title>LumosCore — Admin · LUMOS Rewards</title>');
      page = page.replace(/<a class="adn-item active"/, '<a class="adn-item "');
      page = page.replace(/<a class="mob-menu-item active"/, '<a class="mob-menu-item"');
      json[rk] = page; changed = true; made++;
    });

    // sidebar entry + assets on every admin page (idempotent: old copies are stripped first)
    for (const k of Object.keys(json)) {
      if (!/^lumoscore-admin-/.test(k)) continue;
      let h = json[k];
      h = h.replace(/<a class="adn-item [^"]*" href="lumoscore-admin-rewards[^"]*"[\s\S]*?<\/a>\s*/g, '');
      // The mobile entry was never stripped, so the "idempotent" above only ever held for the sidebar:
      // the unguarded insert below appended another Rewards item to the container on every run.
      h = h.replace(/<a class="mob-menu-item[^"]*" href="lumoscore-admin-rewards-mobile\.html"[\s\S]*?<\/a>\s*/g, '');
      h = h.replace(/<style id="lx-adminrewards-css">[\s\S]*?<\/style>/g, '')
           .replace(/<script id="lx-adminrewards">[\s\S]*?<\/script>/g, '');
      const suffix = variantOf(k);
      const isMine = /^lumoscore-admin-rewards/.test(k);
      const revRe = /(<a class="adn-item[^"]*" href="lumoscore-admin-revenue[^"]*"[\s\S]*?<\/a>\s*)/;
      if (revRe.test(h)) h = h.replace(revRe, '$1' + navItem(isMine, suffix));
      if (suffix === '-mobile') {
        const mi = '<a class="mob-menu-item' + (isMine ? ' active' : '') + '" href="lumoscore-admin-rewards-mobile.html">' + ICON + '<span>Rewards</span></a>\n      ';
        const mrev = /(<a class="mob-menu-item[^"]*" href="lumoscore-admin-revenue-mobile\.html">[\s\S]*?<\/a>\s*)/;
        if (mrev.test(h)) h = h.replace(mrev, '$1' + mi);
      }
      const bi = h.lastIndexOf('</body>');
      if (bi >= 0) h = h.slice(0, bi) + CSS + SCRIPT + h.slice(bi);
      json[k] = h; changed = true; pages++;
    }

    if (changed) {
      const ser = JSON.stringify(json).split('</').join('<' + B + '/');
      fs.writeFileSync(file, data.slice(0, s) + ser + data.slice(e), 'utf8');
    }
  }
}
console.log('admin rewards: page created on ' + made + ' variant(s); sidebar + engine on ' + pages + ' admin page keys');
