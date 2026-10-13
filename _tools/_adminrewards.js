// ADMIN — LUMOS Rewards: calculate a round for EVERY participant, then pay it out. Stellar AND XRPL.
//
// The public Rewards pages (_rewardsdata.js on Stellar, browser/rewards.js on XRPL) answer "what would
// I get?" for the one connected wallet. This answers "what does everyone get, right now, and send it".
//
// ONE PAGE, TWO CHAINS, chosen with a Stellar | XRPL chip row. A dropdown was considered and rejected:
// the chain has to be readable at a glance on a screen that moves real funds, and the Send button
// carries the chain name for the same reason. Each chain keeps its own calculated round, so switching
// chips does not throw away a round that has been part-sent.
//
// THE PROGRAMME RULES ARE SHARED, DELIBERATELY. 1,000,000 LUMOS across the LUMOS/native LPs, 100,000 per
// eco pool, and 1,000,000 across holders of 5,000,000+ LUMOS at one share per 5M held -- one set of
// constants, both chains, so the two cannot drift. Only the LEDGER I/O differs per chain; the arithmetic
// that turns pool shares into payouts is written once and both adapters feed it.
//
// The XRPL pool list, issuer, currency code and team-wallet exclusions are the same values the public
// XRPL rewards layer uses (_tools/browser/rewards.js and xrpl-core.js in the XRPL tree), copied here
// rather than re-derived -- an admin payout screen reading a different pool set than the public page
// promises is the one drift that would actually cost money.
//
// WHY THE ADMIN PAGES NEED THEIR OWN SIGNER: measured, lxSign / lxStellar / lxConnect are all undefined
// here -- the public wallet layer is not injected on admin pages. Rather than drag those large
// transforms across, this ships small extension-only signers (Freighter / Rabet on Stellar, GemWallet
// on XRPL). Mobile wallets over WalletConnect are deliberately out of scope for an admin payout screen.
//
// NOTHING IS SENT WITHOUT TWO DELIBERATE ACTS: the admin presses Send, and then the wallet asks them to
// sign. On Stellar payments are batched 100 operations per transaction because that is the protocol
// limit, so a 300-recipient round is 3 signatures rather than 300.
//
// XRPL HAS NO EQUIVALENT AND IS NOT PRETENDING TO. Every XRPL payment is its own transaction, so a
// 30-recipient round is 30 approvals. The Batch amendment (enabled on mainnet 2026-10) would group 8
// per signature, but its inner transactions each need a Sequence assigned by the submitter, and
// GemWallet's REQUEST_SUBMIT_TRANSACTION/V3 autofills only the OUTER transaction -- so a Batch would
// mean hand-managing sequences through a signer path that connect.js itself still marks UNTESTED
// AGAINST THE EXTENSION. That is not a trade worth making on real LUMOS. One payment at a time is the
// path the launchpad already uses, and rows that have been sent are skipped on a retry, so a round
// cancelled half way through resumes instead of double-paying.
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

      <div class="seg-row" id="lxrSeg"></div>

      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-head"><span class="kpi-label">Round total</span></div><div class="kpi-value" id="lxrTotal">&mdash;</div><div class="kpi-foot" id="lxrTotalF">reading mainnet&hellip;</div></div>
        <div class="kpi"><div class="kpi-head"><span class="kpi-label">Recipients</span></div><div class="kpi-value" id="lxrCount">&mdash;</div><div class="kpi-foot" id="lxrCountF">wallets due a payout</div></div>
        <div class="kpi"><div class="kpi-head"><span class="kpi-label">Liquidity programs</span></div><div class="kpi-value" id="lxrLp">&mdash;</div><div class="kpi-foot" id="lxrLpF">1,000,000 native pool + 100,000 per eco pool</div></div>
        <div class="kpi"><div class="kpi-head"><span class="kpi-label">Holder program</span></div><div class="kpi-value" id="lxrWhale">&mdash;</div><div class="kpi-foot" id="lxrWhaleF">1,000,000 across 5,000,000+ holders</div></div>
      </div>

      <div class="adm-card" id="lxrProgCard">
        <div class="adm-card-head">
          <div><div class="adm-card-title">Where the round comes from</div>
          <div class="adm-card-sub" id="lxrProgSub">Each program has its own fixed pot, split between whoever qualifies at the moment the round is calculated.</div></div>
        </div>
        <div class="adm-card-body" style="padding:0">
          <table class="adm-table" id="lxrProg" style="width:100%;border-collapse:collapse">
            <thead><tr><th style="text-align:left">Program</th><th style="text-align:left">Who it pays</th><th style="text-align:right">Pot</th><th style="text-align:right">Qualifying</th><th style="text-align:right">LUMOS this round</th></tr></thead>
            <tbody><tr><td colspan="5" class="lxadm-empty">Reading pool holders and LUMOS balances from mainnet&hellip;</td></tr></tbody>
          </table>
        </div>
      </div>

      <div class="adm-card">
        <div class="adm-card-head">
          <div><div class="adm-card-title">Payouts this round</div><div class="adm-card-sub" id="lxrSub">Nothing calculated yet.</div></div>
          <div class="adm-card-actions"><button class="adm-btn primary" id="lxrSend" type="button" disabled>Send rewards</button></div>
        </div>
        <div class="adm-card-body" style="padding:0">
          <table class="adm-table" id="lxrTable" style="width:100%;border-collapse:collapse">
            <thead><tr><th style="text-align:left">Wallet</th><th style="text-align:right" id="lxrThNat">Native LP</th><th style="text-align:right">Eco pools</th><th style="text-align:right">Holder</th><th style="text-align:right">Total LUMOS</th><th style="text-align:right">Status</th></tr></thead>
            <tbody><tr><td colspan="6" class="lxadm-empty">Reading every pool holder and LUMOS balance from mainnet&hellip;</td></tr></tbody>
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

// The chip rules are COPIED from the Users page rather than relied on: the Rewards page is cloned from
// the dashboard shell, and the shell does not carry .seg-row / .seg-chip CSS -- it lives on the Users
// and Assets pages. Scoped under #lxrSeg so this cannot collide with a page that does define them.
const CSS = `<style id="lx-adminrewards-css">
#lxrTable td.num-cell,#lxrTable th{font-variant-numeric:tabular-nums}
.lxr-st{display:inline-block;font:700 11px/1 "Hanken Grotesk",system-ui,sans-serif;padding:4px 8px;border-radius:999px;background:rgba(127,127,140,.14);color:var(--text-muted)}
.lxr-st.sent{background:rgba(34,197,94,.16);color:#22c55e}
.lxr-st.fail{background:rgba(239,68,68,.16);color:#ef4444}
.lxr-st.skip{background:rgba(245,179,1,.16);color:#f5b301}
.lxr-warn{margin:0 0 16px;padding:13px 16px;border-radius:12px;border:1px solid rgba(245,179,1,.35);background:rgba(245,179,1,.10);color:var(--text);font-size:13.5px;line-height:1.6}
.lxr-prog{margin:0 0 16px;font-size:13px;color:var(--text-muted)}
#lxrSeg{display:flex;flex-wrap:wrap;gap:9.9px;margin-bottom:17.6px}
#lxrSeg .seg-chip{display:inline-flex;align-items:center;gap:7.7px;padding:9.9px 15.4px;background:var(--surface);border:1px solid var(--border);border-radius:11px;cursor:pointer;transition:all .15s;font-size:16px}
#lxrSeg .seg-chip:hover{background:var(--surface-2)}
#lxrSeg .seg-chip.active{border-color:var(--accent);background:var(--accent-pale)}
#lxrSeg .seg-chip .seg-label{color:var(--text-muted);font-weight:600}
#lxrSeg .seg-chip.active .seg-label{color:var(--accent)}
#lxrSeg .seg-chip .seg-count{font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--text);font-size:16.5px}
#lxrSeg .seg-chip.active .seg-count{color:var(--accent)}
</style>`;

// Browser code. Template literal: HTML attributes are single-quoted, and there are no \\n or regex
// escapes inside -- both collapse when a literal is parsed. Newlines come from String.fromCharCode(10).
const SCRIPT = '<script id="lx-adminrewards">' + `(function(){
if(window.__lxRwAdmin)return; window.__lxRwAdmin=1;

// ---- the programme, shared by both chains ------------------------------------------------------
var WHALE_UNIT=5000000, WHALE_POOL=1000000, NATIVE_POOL=1000000, ECO_PER_POOL=100000;

// ---- Stellar ledger constants ------------------------------------------------------------------
var H="https://horizon.stellar.org";
var S_ISSUER="GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S";
var S_NATIVE={id:"78e6cfc930e2d7ceb3f6cefd4f9aa5e098c5b0af086cde0ad3147982f4d217f2",code:"XLM"};
// THE CYCLE THAT STARTS 2026-10-15, announced in /blog/lumoscore-ecosystem-lp-rewards-new-cycle.
// Selected pools rotate every six months; the first cycle closed 2026-10-01. Out: LMNR, sages, SSLX,
// TKG, LIBERATOR, KALE. In: USDT0, EURC, BLND, xLMNR, XRP, PYUSD.
//
// xLMNR IS NOT LMNR. They are different assets one letter apart -- LMNR (GALUVE2Y…5PHB) was last
// cycle's pool and is dropped; xLMNR (GDKA6WVM…J7NL) is this cycle's. Both have live LUMOS pools, so
// a slip here would quietly pay 100,000 LUMOS a round to the retired one.
//
// Every id below was read off Horizon rather than typed: each is the ONLY LUMOS pool for that asset
// code, so none of these is a guess about which issuer was meant. The issuer is recorded beside it so
// the next rotation can be checked without re-deriving it.
var S_ECO=[
 {id:"344e6618b45f6925e7b53a71b7882e6e2c1b983ab0926676f4175a4bfb46b7bf",code:"USDC"},      // GA5ZSEJY…KZVN
 {id:"6097e8e4b959ef59cc6030c9d94bc56f2570a371624f80a4dbed74c24cdf60bf",code:"USDT0"},     // GATISXX6…HN6Q
 {id:"a9414b0c90b18a3c6dca4855127b48f4f1faec83a489ce2b6a79c7cfdd47e655",code:"EURC"},      // GDHU6WRG…NPP2
 {id:"9be7d7872051f1575e8f4e69b81954ef3d017f100a4cb3f7a407fb8bc894654f",code:"SHX"},       // GDSTRSHX…J6JH
 {id:"68d62e263f1006fdec7f456ccbd3e2fba67a335b6804088a30050542209d9f51",code:"AQUA"},      // GBNZILST…AQUA
 {id:"dd31ba1dd14612984adad5126b3c8bbf7fc7fe88ba121b432c88bcc011ce0e33",code:"BLND"},      // GDJEHTBE…EZYY
 {id:"e67b5a693d12ba98cb411d3b349b900602302cc8bc4479d35e0c806712c9ca59",code:"xLMNR"},     // GDKA6WVM…J7NL
 {id:"a7d73ed49edd21b7f3533c8a2a3b534409c1ce9a0909eb6cbb230b957d37faff",code:"yXLM"},      // GARDNV3Q…5T55
 {id:"ac3b01d256366c386c0bff1e1a59bcd5fe57749f268aefc03854a8fdedf050a2",code:"XRP"},       // GBXRPL45…DTD5
 {id:"7d476a9bc5832cce0e7e8b1f0aa8756e0197f0ece132990f52ccf3e9a7297ca6",code:"PYUSD"}      // GDQE7IXJ…U2V5
];
// Same treasury/burn list the public rewards engine uses. These never receive and never count toward a
// denominator -- paying ourselves would inflate the round and dilute everyone real.
var S_EXCLUDE={
 "GBIU5NISX5IP6VXZK7DEKLZC4ZVPWNCDEYQLQGXG33Y3J2LHPKPCHUOK":1,
 "GCCDEU4DOW3AQ5WFWY7LDEFZIJAQBI5TQXRT3XAZSWDRLK3LG53HBQCP":1,
 "GAR4HYWGY4YE7WOU2TGH7G4RL7ON72KQP24WWBT755WAWPCKRFS4SHWL":1,
 "GA27ELKFRT7JVZTJW4P3I3ORWLLNKRIB3D6GELPN7IESPOCUNS5NHTOD":1,
 "GCYFMZPDAR7ZTTTBA5DVG2SPR2N4CLPZLGLVI475BCGJ532WOKWRKUDG":1,
 "GAMXMHJX6CW6LZWUYRKVF73GOMRFJDQI57UMA4LE5QUF4DCJRGI55QD6":1,
 "GDVU64GNDFDR3OWKGPK37DAK67RPOK4OMZB4RH7NQN5UOYB4GPFVQUOD":1,
 "GDB46BXMVI7FEZCHG4OTZ3OCSJX4CRBOOK6OJL5JD7BF5QIW3AS53IWA":1};

// ---- XRP Ledger constants ----------------------------------------------------------------------
// Issuer, currency and the eleven AMM accounts are the same values the public XRPL rewards layer
// reads. Each eco pool was confirmed by amm_info to be a real AMM with LUMOS on one side, and the
// pair names are what the LEDGER reported, not what was typed.
var XRPC="https://xrplcluster.com/";
var X_ISSUER="rsPqeamjpr3Bxu4LhtCgvJEAQusYRRg6Ha";
var X_CUR="4C554D4F53000000000000000000000000000000";
// XRPL POOLS ARE NAMED BY ASSET PAIR, NOT BY AMM ACCOUNT, and that is deliberate.
//
// Six of the ten pools in this cycle -- USDC, SHX, XLM, USDT, FLR and XAH -- DID NOT EXIST on the
// ledger when this list was written (confirmed actNotFound on two independent nodes, with known pools
// as positive controls). An AMM account address is assigned when the pool is created, so there is no
// address to hardcode for a pool nobody has made yet.
//
// Resolving by pair fixes that permanently: amm_info is asked for LUMOS + the counter-asset at
// calculation time. A pool that does not exist reads as "nobody yet" and pays nothing, and the moment
// someone creates it the next Recalculate picks it up and it starts paying -- no code change, no
// redeploy, no round silently skipping a pool because an address was never filled in.
//
// Each issuer below was resolved from the ledger and confirmed by the issuing account's OWN published
// domain, not by matching a ticker: a ticker is not an identity, and USDC alone had two candidates on
// XRPL. The domain is recorded beside each so the next rotation can be checked the same way.
var X_NATIVE={code:"XRP",cur:"XRP",iss:""};
var X_ECO=[
 {code:"RLUSD", cur:"524C555344000000000000000000000000000000", iss:"rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De"},
 {code:"USDC",  cur:"5553444300000000000000000000000000000000", iss:"rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE"},  // circle.com
 {code:"SHX",   cur:"SHX",   iss:"rfmS3zqrQrka8wVyhXifEeyTwe8AMz2Yhw"},                                      // axelar.foundation
 {code:"XPM",   cur:"XPM",   iss:"rXPMxBeefHGxx2K7g5qmmWq3gFsgawkoa"},
 {code:"XLM",   cur:"XLM",   iss:"rKiCet8SdvWxPXnAgYarFUXMh1zCPz432Y"},                                      // ripplefox.com
 {code:"USDT",  cur:"5553445400000000000000000000000000000000", iss:"rGbUjUtNVq5M3Un5r4efJqHed4o5P2Usdt"},  // xrps.io
 {code:"XDawgs",cur:"5844617767730000000000000000000000000000", iss:"raKhUVtNw6B892bKtATUT3frX35oawfsey"},
 {code:"666",   cur:"666",   iss:"rhvf9fe6PP3GC8Bku2Ug7iQPjPDxYZfrxN"},
 {code:"FLR",   cur:"FLR",   iss:"rcxJwVnftZzXqyH9YheB8TgeiZUhNo1Eu"},
 {code:"XAH",   cur:"XAH",   iss:"rswh1fvyLqHizBS2awu1vs6QcmwTBd9qiv"}
];
// An AMM's asset argument is ALWAYS an object. XRP is {currency:"XRP"} with no issuer -- the bare
// string "XRP" that reads so naturally is rejected with issueMalformed, and because a failed resolve
// is treated as "pool does not exist", that typo did not throw: it silently reported the live
// LUMOS/XRP pool as empty AND left the AMM account out of the exclusion list, so the pool's own
// 10.3M LUMOS reserve then qualified it for the holder programme. Verified against the ledger.
function xAsset(p){ return (p.cur==="XRP"&&!p.iss)?{currency:"XRP"}:{currency:p.cur,issuer:p.iss}; }
function xLumos(){ return {currency:X_CUR,issuer:X_ISSUER}; }
// Two kinds of account are excluded, for different reasons. TEAM WALLETS are treasury allocations,
// 850M LUMOS between them. AMM ACCOUNTS are not holders -- the LUMOS/XRP AMM sits near the top of the
// holder list with 17M LUMOS, which is only its own reserve, and every AMM holds LP tokens in the
// pools it is paired into. The issuer itself is excluded for the same reason.
// The team half is fixed and known. The AMM half CANNOT be written down, because the pools are named
// by pair and their account addresses are only learned when amm_info answers -- so xPrepare() adds
// each resolved AMM account before any holder is credited. See the ordering note on xPrepare.
var X_EXCLUDE={};
["rHuF5XcfA6izw3DhPuZZ5M2z1Vt5ozoQpN","raieaf1UXyXgvptvSBZQ8Tojj3ztr77sdM",
 "r42RLyT9Uz35joCo6thvknLJVBDeFqPhgN","rL9d14LpUX39owdetCB1bV56UFcwAHTs2X",
 "rEw27GSsFBmGYtkjTh2fYx8AMQY6id6jjx","rNN7aocBTz4Ba27CnL1uR38EhCxYsoHqst",
 "rUdnkuyMpDoSfeSko4Y5Pg6Do9mUh8X1tY"].forEach(function(a){ X_EXCLUDE[a]=1; });
X_EXCLUDE[X_ISSUER]=1;

function q(s){return document.querySelector(s);}
function qa(s){return Array.prototype.slice.call(document.querySelectorAll(s));}
function j(u){return fetch(u).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});}
function esc(s){return (String(s==null?"":s).replace(/[<>&]/g,function(c){return c==="<"?"&lt;":c===">"?"&gt;":"&amp;";})).split(String.fromCharCode(39)).join("&#39;");}
function shortG(a){return a?a.slice(0,4)+"\\u2026"+a.slice(-4):"";}
function num(n,d){return (+n||0).toLocaleString(undefined,{maximumFractionDigits:(d==null?2:d)});}
function isPage(){var t=((q(".admin-page-title")||{}).textContent||"").trim();return t.indexOf("LUMOS Rewards")===0;}
function setTxt(sel,t){ var e=q(sel); if(e)e.textContent=t; }
function sdk(){ if(window.StellarBase)return Promise.resolve(window.StellarBase);
  return new Promise(function(res,rej){ var el=document.createElement("script");
    el.src="/assets/vendor/stellar-base-13.0.1.min.js";
    el.onload=function(){ window.StellarBase?res(window.StellarBase):rej(new Error("SDK failed to load")); };
    el.onerror=function(){ rej(new Error("SDK failed to load")); }; document.head.appendChild(el); }); }

// XRPL JSON-RPC. One shape for every call, and a null return for anything the server flagged, so a
// caller cannot mistake an error object for data.
// raw=true hands the whole payload back INCLUDING the error, because a caller that must tell
// "no such pool" apart from "the node was busy" cannot do it through a null.
function xrpc(method,params,raw){
  return fetch(XRPC,{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({method:method,params:[params||{}]})})
    .then(function(r){ return r.json(); })
    .then(function(d){ if(raw)return d||{error:"empty response"};
      var res=d&&d.result; if(!res||res.error)return null; return res; })
    .catch(function(e){ if(raw)return {error:(e&&e.message)||"network error"}; return null; });
}

// ---- Stellar adapter ---------------------------------------------------------------------------
// Every holder of a pool, from Horizon's /accounts?liquidity_pool= index. An account can hold shares in
// many pools, so its balance is matched by liquidity_pool_id rather than taken as the first entry.
function sPoolInfo(p){
  var out={};
  function page(url,depth){
    return j(url).then(function(d){ if(!d)return;
      var rs=(d._embedded&&d._embedded.records)||[];
      rs.forEach(function(a){
        (a.balances||[]).forEach(function(b){
          if(b.asset_type==="liquidity_pool_shares"&&b.liquidity_pool_id===p.id){ out[a.id]=(out[a.id]||0)+(+b.balance||0); } }); });
      var nx=d._links&&d._links.next&&d._links.next.href;
      if(rs.length===200&&nx&&depth<10)return page(nx,depth+1); }); }
  return page(H+"/accounts?liquidity_pool="+p.id+"&limit=200",1).then(function(){
    return j(H+"/liquidity_pools/"+p.id).then(function(pl){ return {total:pl?+pl.total_shares:0,holders:out}; }); });
}
// Holders of 5,000,000+ LUMOS. stellar.expert ranks by balance descending, so this stops at the first
// account below the line instead of walking every trustline.
function sWhales(){
  var list=[];
  function page(cur,depth){
    return j("/lxapi/holders?asset=LUMOS-"+S_ISSUER+"&limit=200"+(cur?("&cursor="+encodeURIComponent(cur)):"")).then(function(d){
      var rs=(d&&d._embedded&&d._embedded.records)||[]; if(!rs.length)return;
      var below=false;
      for(var i=0;i<rs.length;i++){ var bal=(+rs[i].balance||0)/1e7;
        if(bal<WHALE_UNIT){ below=true; break; }
        var ad=rs[i].address||rs[i].account;
        if(!S_EXCLUDE[ad])list.push({addr:ad,bal:bal}); }
      if(below)return;
      var nx=rs[rs.length-1].paging_token;
      if(nx&&depth<8)return page(nx,depth+1); }); }
  // holders is null, not a set: the whale walk stops at the 5M line, so it never learns the full
  // trustline list and must not pretend it did. A null set means "not checked", and nothing is
  // excluded for it. This is why the trustline column is XRPL-only.
  return page("",1).then(function(){ return {list:list,lines:null}; });
}

// ---- XRP Ledger adapter ------------------------------------------------------------------------
// Walk every trustline on an account. account_lines is paginated by marker, and a line's balance is
// negative from the issuing side, so magnitude is what matters.
function xLines(acct,cur){
  var out=[];
  function page(marker,depth){
    var p={account:acct,ledger_index:"validated",limit:400};
    if(marker)p.marker=marker;
    return xrpc("account_lines",p).then(function(res){
      if(!res)throw new Error("Could not read trustlines for "+acct);
      (res.lines||[]).forEach(function(l){
        if(cur&&l.currency!==cur)return;
        var b=Math.abs(+l.balance||0); if(b>0)out.push({addr:l.account,bal:b}); });
      if(res.marker&&depth<40)return page(res.marker,depth+1); }); }
  return page(null,1).then(function(){ return out; });
}
// RESOLVE EVERY POOL BEFORE CREDITING ANY HOLDER. The AMM accounts have to be in X_EXCLUDE before the
// first payout is calculated, and they are only known once amm_info has answered -- so this runs as a
// phase of its own. Doing it lazily inside each pool would mean a pool resolved late could credit an
// AMM that a pool resolved early had already paid, and an AMM is not a liquidity provider.
//
// A pool that does not exist is recorded as missing rather than thrown: six of this cycle's ten were
// not on the ledger when the cycle was announced, and a pot with no pool pays nothing, exactly like a
// pool with no LPs. Only a genuine read failure is an error.
// ONLY actNotFound MEANS "NO POOL". Every other error is a read that did not happen, and the two must
// never collapse together: the public nodes answer tooBusy and slowDown freely under load (measured
// repeatedly while this cycle's pools were being resolved), and treating one of those as "no pool"
// would zero a live pool's pot AND leave its AMM account out of the exclusion list, which is how an
// AMM's own reserve ends up qualifying it for the holder programme. A read failure retries, then
// stops the round.
var X_RESOLVED=null;
function xPrepare(pools){
  X_RESOLVED={};
  return pools.reduce(function(chain,p){
    return chain.then(function(){
      function attempt(n){
        return xrpc("amm_info",{asset:xLumos(),asset2:xAsset(p)},true).then(function(r){
          var res=r&&r.result;
          var amm=res&&res.amm;
          if(amm&&amm.lp_token){
            X_RESOLVED[p.code]={acct:amm.account,lpcur:amm.lp_token.currency,total:+amm.lp_token.value||0};
            X_EXCLUDE[amm.account]=1; return; }
          var err=(res&&res.error)||(r&&r.error)||"unknown";
          if(err==="actNotFound"){ X_RESOLVED[p.code]={missing:true}; return; }
          if(n>=4)throw new Error("could not read the LUMOS/"+p.code+" pool ("+err+")");
          return new Promise(function(go){ setTimeout(go,900*n); }).then(function(){ return attempt(n+1); }); });
      }
      return attempt(1); });
  },Promise.resolve());
}
// AN AMM ACCOUNT'S TRUSTLINES ARE NOT ALL LP HOLDERS. The AMM holds LUMOS as one side of its own pool,
// so account_lines on it returns that reserve line too -- and unfiltered, the pool counts itself as its
// single largest liquidity provider and swallows most of the pot. The LP token currency from amm_info is
// what separates the two.
function xPoolInfo(p){
  var r=X_RESOLVED&&X_RESOLVED[p.code];
  if(!r)return Promise.reject(new Error("Pool "+p.code+" was never resolved"));
  if(r.missing)return Promise.resolve({total:0,holders:{}});
  return xLines(r.acct,r.lpcur).then(function(hs){
    var out={}; hs.forEach(function(h){ out[h.addr]=(out[h.addr]||0)+h.bal; });
    return {total:r.total,holders:out}; });
}
// Holders of 5,000,000+ LUMOS, from every LUMOS trustline the issuer has. Unlike stellar.expert this is
// not sorted, so the whole list is walked -- which is what makes the trustline pre-check free: the same
// walk is the definitive set of accounts that CAN receive LUMOS at all.
function xWhales(){
  return xLines(X_ISSUER,X_CUR).then(function(all){
    var lines={}; all.forEach(function(h){ lines[h.addr]=1; });
    var list=all.filter(function(h){ return !X_EXCLUDE[h.addr]&&h.bal>=WHALE_UNIT; })
                .map(function(h){ return {addr:h.addr,bal:h.bal}; });
    return {list:list,lines:lines}; });
}

var ADP={
 stellar:{ key:"stellar", name:"Stellar", nativeCode:"XLM", issuer:S_ISSUER, excl:S_EXCLUDE,
   native:S_NATIVE, eco:S_ECO, dp:7,
   // Stellar pool ids are fixed and the exclusion list is fully known up front, so there is nothing
   // to resolve before the round starts.
   prepare:function(){ return Promise.resolve(); },
   poolInfo:sPoolInfo, whales:sWhales,
   explorer:function(a){ return "https://stellar.expert/explorer/public/account/"+a; },
   finalNote:"Stellar payments are final and cannot be reversed." },
 xrpl:{ key:"xrpl", name:"XRPL", nativeCode:"XRP", issuer:X_ISSUER, excl:X_EXCLUDE,
   native:X_NATIVE, eco:X_ECO, dp:6,
   prepare:xPrepare,
   poolInfo:xPoolInfo, whales:xWhales,
   explorer:function(a){ return "https://bithomp.com/explorer/"+a; },
   finalNote:"XRP Ledger payments are final and cannot be reversed." }
};

var CH="stellar";
try{ var sv=localStorage.getItem("lumos.admin.rwchain"); if(sv&&ADP[sv])CH=sv; }catch(e){}
var ROUNDS={stellar:null,xrpl:null};
function A(){ return ADP[CH]; }
function R(){ return ROUNDS[CH]; }

// ---- the round, written once for both chains ---------------------------------------------------
// The arithmetic is chain-agnostic on purpose: an adapter supplies the pool totals, the pool holders
// and the whale list, and everything from "share of the pool" onward is the same code on both ledgers.
// That is the only way the two can be kept honestly identical.
function generate(btn){
  var a=A(), ch=CH;
  var sub=q("#lxrSub");
  btn.disabled=true; btn.textContent="Calculating\\u2026";
  if(sub)sub.textContent="Reading pool holders and LUMOS balances from "+a.name+" mainnet\\u2026";
  // The pool DEFINITION is whatever the chain names a pool by -- a pool id on Stellar, an asset pair
  // on XRPL -- and it is passed through untouched. Only pot and kind are added here.
  var pools=[{def:a.native,code:a.native.code,pot:NATIVE_POOL,native:true}];
  a.eco.forEach(function(p){ pools.push({def:p,code:p.code,pot:ECO_PER_POOL,native:false}); });
  var acc={};
  function add(addr,field,amt){ if(!amt||amt<=0)return; if(a.excl[addr])return;
    var r=acc[addr]=acc[addr]||{addr:addr,native:0,eco:0,whale:0};
    r[field]+=amt; }
  var lines=null;
  a.prepare(pools.map(function(x){ return x.def; })).then(function(){
  var jobs=pools.map(function(p){
    return a.poolInfo(p.def).then(function(z){
      var ts=z.total, hold=z.holders; if(!(ts>0))return {code:p.code,paid:0,holders:0};
      var paid=0,n=0;
      Object.keys(hold).forEach(function(k){ if(a.excl[k])return;
        var share=hold[k]/ts, amt=p.pot*share; if(amt>0){ add(k,p.native?"native":"eco",amt); paid+=amt; n++; } });
      return {code:p.code,paid:paid,holders:n}; })
      .catch(function(){ return {code:p.code,paid:null,holders:null}; }); });
  jobs.push(a.whales().then(function(w){
    lines=w.lines;
    // One share per whole 5,000,000 held; the pot is split across all shares, so this needs the total
    // before any individual amount can be known.
    var tot=0; w.list.forEach(function(x){ x.sh=Math.floor(x.bal/WHALE_UNIT); tot+=x.sh; });
    if(tot>0)w.list.forEach(function(x){ add(x.addr,"whale",WHALE_POOL*(x.sh/tot)); });
    return {code:"holders",paid:tot>0?WHALE_POOL:0,holders:w.list.length}; })
    .catch(function(){ return {code:"holders",paid:null,holders:null}; }));
  Promise.all(jobs).then(function(res){
    var rows=Object.keys(acc).map(function(k){ var r=acc[k];
      r.total=r.native+r.eco+r.whale;
      // A RECIPIENT WITHOUT A TRUSTLINE CANNOT BE PAID, and a payment to one fails on submission
      // rather than being quietly dropped. Marking it here keeps it visible in the table -- it earned
      // the share and the number is real -- while excluding it from the send instead of burning an
      // approval on a transaction that is going to be rejected. The share is NOT redistributed: the
      // pot is a fixed pot, and reassigning someone else's share because they have not opened a
      // trustline yet would change what everyone else is owed.
      r.noline=!!(lines&&!lines[r.addr]);
      return r; })
      .filter(function(r){ return r.total>0.0000001; })
      .sort(function(a2,b2){ return b2.total-a2.total; });
    ROUNDS[ch]={rows:rows,at:new Date(),res:res};
    if(ch!==CH)return;
    paint();
    btn.disabled=false; btn.textContent="Recalculate";
  }).catch(function(e){
    btn.disabled=false; btn.textContent="Recalculate";
    if(sub)sub.textContent="Could not calculate: "+((e&&e.message)||e);
  });
  // A FAILURE TO RESOLVE THE POOLS STOPS THE ROUND, and does not fall through to an empty one. If
  // amm_info cannot be reached, the honest answer is "I could not read the pools" -- a round showing
  // zero recipients because every lookup failed would look exactly like a round nobody qualified for.
  }).catch(function(e){
    btn.disabled=false; btn.textContent="Recalculate";
    if(sub)sub.textContent="Could not read the pools: "+((e&&e.message)||e);
  });
}

// Everything the round implies, redrawn from state. Called after a calculation and after a chip
// switch, so a chain that already has a round shows it instantly instead of recalculating.
function paint(){
  var a=A(), rd=R();
  setTxt("#lxrThNat","LUMOS/"+a.nativeCode);
  var sub=q("#lxrSub");
  var g=q("#lxrGen"), csvb=q("#lxrCsv"), snd=q("#lxrSend");
  if(snd)snd.textContent="Send "+a.name+" rewards";
  chips();
  if(!rd){
    setTxt("#lxrTotal","\\u2014"); setTxt("#lxrTotalF","reading "+a.name+" mainnet\\u2026");
    setTxt("#lxrCount","\\u2014"); setTxt("#lxrLp","\\u2014"); setTxt("#lxrWhale","\\u2014");
    setTxt("#lxrLpF","1,000,000 LUMOS/"+a.nativeCode+" + "+a.eco.length+" eco pools");
    if(sub)sub.textContent="Nothing calculated yet for "+a.name+".";
    var pb=q("#lxrProg tbody");
    if(pb)pb.innerHTML="<tr><td colspan='5' class='lxadm-empty'>Reading pool holders and LUMOS balances from "+esc(a.name)+" mainnet\\u2026</td></tr>";
    var tb0=q("#lxrTable tbody");
    if(tb0)tb0.innerHTML="<tr><td colspan='6' class='lxadm-empty'>Reading every pool holder and LUMOS balance from "+esc(a.name)+" mainnet\\u2026</td></tr>";
    if(csvb)csvb.disabled=true; if(snd)snd.disabled=true;
    if(g)g.textContent="Generate round";
    return;
  }
  var rows=rd.rows;
  var tot=rows.reduce(function(s,r){return s+r.total;},0);
  var lp=rows.reduce(function(s,r){return s+r.native+r.eco;},0);
  var wh=rows.reduce(function(s,r){return s+r.whale;},0);
  var nl=rows.filter(function(r){return r.noline;}).length;
  setTxt("#lxrTotal", num(tot,0)+" LUMOS");
  setTxt("#lxrTotalF","calculated "+rd.at.toLocaleString());
  setTxt("#lxrCount", String(rows.length));
  setTxt("#lxrCountF", nl?(nl+" cannot be paid \\u2014 no LUMOS trustline"):"wallets due a payout");
  setTxt("#lxrLp", num(lp,0));
  setTxt("#lxrWhale", num(wh,0));
  var empty=(rd.res||[]).filter(function(r){ return r&&r.holders===0; }).map(function(r){ return r.code; });
  setTxt("#lxrLpF","LUMOS/"+a.nativeCode+" + "+a.eco.length+" eco pools"+(empty.length?(" \\u00b7 "+empty.length+" pool(s) with no LPs"):""));
  renderPrograms(rd.res);
  if(sub)sub.textContent=rows.length
    ? (rows.length+" wallets \\u00b7 "+num(tot,0)+" LUMOS \\u00b7 "+a.name+" \\u00b7 as of "+rd.at.toLocaleString())
    : ("No wallet qualifies for this round on "+a.name+".");
  render();
  if(g)g.textContent="Recalculate";
  var payable=rows.filter(function(r){ return !r.sent&&!r.noline; }).length;
  if(csvb)csvb.disabled=!rows.length;
  if(snd)snd.disabled=!payable;
}

function chips(){
  var seg=q("#lxrSeg"); if(!seg)return;
  seg.innerHTML=["stellar","xrpl"].map(function(k){
    var rd=ROUNDS[k];
    var cnt=rd?String(rd.rows.length):"\\u2014";
    return "<button class='seg-chip"+(CH===k?" active":"")+"' type='button' data-lxchain='"+k+"'>"
      +"<span class='seg-label'>"+esc(ADP[k].name)+"</span><span class='seg-count'>"+cnt+"</span></button>"; }).join("");
  qa("#lxrSeg [data-lxchain]").forEach(function(b){
    b.addEventListener("click",function(){
      var k=b.getAttribute("data-lxchain"); if(k===CH)return;
      CH=k; try{ localStorage.setItem("lumos.admin.rwchain",k); }catch(e){}
      var pr=q("#lxrProgress"); if(pr)pr.textContent="";
      paint();
      // A chain with no round yet calculates on arrival, the same way the page calculates on load.
      if(!ROUNDS[CH]){ var g=q("#lxrGen"); if(g)generate(g); }
    }); });
}

// WHERE THE NUMBER COMES FROM, one row per program. The page used to show a single total and a list
// of wallets, which left "why is it this much?" unanswerable without reading the source -- and a pool
// with no liquidity providers was indistinguishable from a pool that had not been read. A pot that
// pays nothing now says so, and says why.
function renderPrograms(res){
  var tb=q("#lxrProg tbody"); if(!tb)return;
  var a=A();
  var by={}; (res||[]).forEach(function(r){ if(r)by[r.code]=r; });
  var rows=[];
  rows.push({name:"LUMOS/"+a.nativeCode+" liquidity", who:"Providers in the LUMOS/"+a.nativeCode+" pool, by share of the pool",
             pot:NATIVE_POOL, r:by[a.nativeCode]});
  a.eco.forEach(function(p){ rows.push({name:"LUMOS/"+p.code+" liquidity",
             who:"Providers in the LUMOS/"+p.code+" pool, by share of the pool", pot:ECO_PER_POOL, r:by[p.code]}); });
  rows.push({name:"Holder program", who:"Wallets holding 5,000,000+ LUMOS, one share per 5,000,000",
             pot:WHALE_POOL, r:by.holders});
  tb.innerHTML=rows.map(function(x){
    var r=x.r, n=r?r.holders:null, paid=r?r.paid:null;
    // Nobody qualifying is a real answer, not a missing one, so it reads as "nobody yet" and the pot
    // is shown greyed rather than as a number that was never paid. A pool that could not be READ is a
    // different thing again and says so, because a failed request must never look like an empty pool.
    var none=(n===0), unread=(r&&r.holders===null);
    return "<tr>"
      +"<td><b>"+esc(x.name)+"</b></td>"
      +"<td style='color:var(--text-muted);font-size:13.5px'>"+esc(x.who)+"</td>"
      +"<td class='num-cell' style='text-align:right'>"+num(x.pot,0)+"</td>"
      +"<td class='num-cell' style='text-align:right"+(none||unread?";color:var(--text-muted)":"")+"'>"
        +(unread?"could not read":(n==null?"\\u2026":(none?"nobody yet":num(n,0))))+"</td>"
      +"<td class='num-cell' style='text-align:right"+(none||unread?";color:var(--text-muted)":"")+"'>"
        +(unread?"\\u2014":(paid==null?"\\u2026":(paid>0?num(paid,0):"0")))+"</td></tr>";
  }).join("");
  var tot=rows.reduce(function(s,x){ return s+x.pot; },0);
  var live=rows.filter(function(x){ return x.r&&x.r.holders>0; }).length;
  setTxt("#lxrProgSub", num(tot,0)+" LUMOS is set aside across "+rows.length+" programs on "+a.name+"; "
    +live+" of them have someone qualifying right now. A pot with nobody in it pays nothing \\u2014 it is not carried over.");
}

function render(){
  var tb=q("#lxrTable tbody"), rd=R(), a=A(); if(!tb||!rd)return;
  if(!rd.rows.length){ tb.innerHTML="<tr><td colspan='6' class='lxadm-empty'>No wallet qualifies for this round.</td></tr>"; return; }
  tb.innerHTML=rd.rows.map(function(r){
    var st=r.sent?"<span class='lxr-st sent'>sent</span>"
        :(r.err?("<span class='lxr-st fail' title='"+esc(r.err)+"'>failed</span>")
        :(r.noline?"<span class='lxr-st skip' title='This wallet has no LUMOS trustline, so it cannot receive a payment. It is not included in the send.'>no trustline</span>"
        :"<span class='lxr-st'>pending</span>"));
    return "<tr><td class='mono'><a class='lxadm-link' target='_blank' rel='noopener' href='"+esc(a.explorer(r.addr))+"'>"+esc(shortG(r.addr))+"</a></td>"
      +"<td class='num-cell' style='text-align:right'>"+num(r.native)+"</td>"
      +"<td class='num-cell' style='text-align:right'>"+num(r.eco)+"</td>"
      +"<td class='num-cell' style='text-align:right'>"+num(r.whale)+"</td>"
      +"<td class='num-cell' style='text-align:right'><b>"+num(r.total)+"</b></td>"
      +"<td style='text-align:right'>"+st+"</td></tr>"; }).join("");
}

// ---- signing -----------------------------------------------------------------------------------
// Extension wallets only, on both chains. An admin payout screen is a desktop task, and pulling the
// public site's WalletConnect layer in here would be a large dependency for no gain.
function sWallet(){
  if(window.freighterApi&&window.freighterApi.getPublicKey)return {name:"Freighter",
    addr:function(){ return window.freighterApi.getPublicKey(); },
    sign:function(x){ return window.freighterApi.signTransaction(x,{networkPassphrase:"Public Global Stellar Network ; September 2015"})
      .then(function(r){ return (r&&r.signedTxXdr)||r; }); }};
  if(window.rabet)return {name:"Rabet",
    addr:function(){ return window.rabet.connect().then(function(r){ return r.publicKey; }); },
    sign:function(x){ return window.rabet.sign(x,"mainnet").then(function(r){ return r.xdr; }); }};
  return null;
}

// GemWallet, over the extension's own postMessage protocol. Lifted from the public site's connect.js,
// which took it from @gemwallet/api's source -- including the messagedId reply field, which is a typo
// in GemWallet's own client and therefore the wire format: spelling it correctly here would mean never
// resolving, on a path that otherwise looks completely healthy.
function gemSend(type,payload,ms){
  return new Promise(function(resolve,reject){
    var id=Date.now()+Math.random();
    var timer=setTimeout(function(){ window.removeEventListener("message",onMsg);
      reject(new Error("GemWallet did not respond.")); },ms||90000);
    function onMsg(ev){
      if(ev.source!==window)return;
      var d=ev.data;
      if(!d||d.source!=="GEM_WALLET_MSG_RESPONSE")return;
      if(d.messagedId!==id)return;
      clearTimeout(timer); window.removeEventListener("message",onMsg); resolve(d); }
    window.addEventListener("message",onMsg,false);
    var msg={source:"GEM_WALLET_MSG_REQUEST",messageId:id,app:"gem-wallet",type:type};
    if(payload)msg.payload=payload;
    window.postMessage(msg,window.location.origin); });
}
function gemInstalled(){
  if(window.gemWallet)return Promise.resolve(true);
  // The extension sets window.gemWallet late on some loads, so absence is not proof. Ask, and treat
  // silence within a second as "no" -- the same 1s the official client allows.
  return gemSend("REQUEST_IS_INSTALLED/V3",null,1000)
    .then(function(d){ return !!(d&&(d.isInstalled||(d.result&&d.result.isInstalled))); })
    .catch(function(){ return false; });
}
function gemMeta(){ var ic=""; try{ var l=q("link[rel*='icon']"); ic=l?l.href:""; }catch(e){}
  return {url:window.location.origin,title:document.title,favicon:ic}; }
// A REFUSAL IS ANNOUNCED AT WHICHEVER LEVEL THE EXTENSION PUTS IT, so all three nestings are read: a
// declined request answers with type:'reject' on the RESPONSE, not inside result, and checking only
// result.type fell through to the missing-hash error -- or said nothing at all when the popup was
// dismissed without an answer. Anything that is not a hash throws, so a wrong guess about the response
// shape stops the round rather than letting it continue as though a payment had been made.
function gemResult(d){
  if(d&&d.error){ var m=(d.error&&(d.error.message||d.error.name))||String(d.error);
    throw new Error(/reject|denied|cancel/i.test(m)?"Rejected in GemWallet.":m); }
  var r=(d&&d.result)||{};
  if(d&&d.type==="reject")throw new Error("Rejected in GemWallet.");
  if(r.type==="reject"||(r.result&&r.result.type==="reject"))throw new Error("Rejected in GemWallet.");
  var hash=r.hash||r.txHash||(r.result&&r.result.hash);
  if(!hash)throw new Error("GemWallet did not return a transaction hash.");
  return String(hash);
}
function xWallet(){
  return {name:"GemWallet",
    addr:function(){ return gemInstalled().then(function(ok){
        if(!ok)throw new Error("GemWallet is not installed in this browser.");
        return gemSend("REQUEST_GET_ADDRESS/V3",gemMeta()); }).then(function(d){
        if(d&&d.error){ var m=(d.error&&(d.error.message||d.error.name))||String(d.error);
          throw new Error(/reject|denied|cancel/i.test(m)?"Request rejected in GemWallet.":m); }
        var r=(d&&d.result)||{};
        if((d&&d.type==="reject")||r.type==="reject")throw new Error("Request rejected in GemWallet.");
        if(!r.address)throw new Error("GemWallet did not return an address.");
        return String(r.address); }); },
    submit:function(tx){ return gemSend("REQUEST_SUBMIT_TRANSACTION/V3",
      {transaction:tx,url:gemMeta().url,title:gemMeta().title,favicon:gemMeta().favicon})
      .then(gemResult); }};
}
// The same attribution memo every other LumosCore XRPL write path carries, so a reward payment is
// identifiable as ours on the ledger rather than looking like an anonymous transfer.
function xMemo(text){
  var hex=function(s){ var h=""; for(var i=0;i<s.length;i++){ var c=s.charCodeAt(i).toString(16);
    h+=(c.length<2?"0":"")+c; } return h.toUpperCase(); };
  return {Memo:{MemoType:hex("LumosCore"),MemoFormat:hex("text/plain"),MemoData:hex(text)}};
}

// 100 operations is the protocol limit for one Stellar transaction, so a 300-wallet round is 3 signatures.
function batches(rows,size){ var out=[]; for(var i=0;i<rows.length;i+=size)out.push(rows.slice(i,i+size)); return out; }

// The progress line. It was reading q("#lxrProg") -- which is the id of the PROGRAMS TABLE, not a
// progress element, so it never created the div it was checking for and instead set textContent on a
// <table>, wiping "Where the round comes from" the moment Send was pressed. Its own id now.
function progress(){
  var p=q("#lxrProgress");
  if(!p){ p=document.createElement("div"); p.id="lxrProgress"; p.className="lxr-prog";
    var head=q(".admin-page-head"); if(head&&head.parentNode)head.parentNode.insertBefore(p,head.nextSibling); }
  return p;
}

function send(btn){
  var rd=R(), a=A(); if(!rd||!rd.rows.length)return;
  var due=rd.rows.filter(function(r){ return !r.sent&&!r.noline&&r.total>0.0000001; });
  if(!due.length){ alert("Nothing left to send on "+a.name+"."); return; }
  var tot=due.reduce(function(s,r){return s+r.total;},0);
  var skipped=rd.rows.filter(function(r){ return r.noline; }).length;
  var NL=String.fromCharCode(10);
  var w=(CH==="stellar")?sWallet():xWallet();
  if(CH==="stellar"&&!w){ alert("No wallet extension found. Install Freighter or Rabet, unlock it, and reload this page."); return; }
  // On Stellar one transaction carries up to 100 payments. On XRPL every payment is its own
  // transaction, so the count of approvals is the count of recipients -- said plainly up front,
  // because 30 wallet popups is not something to discover half way through a payout.
  var steps=(CH==="stellar")?batches(due,100).length:due.length;
  if(!confirm("Send "+num(tot,0)+" LUMOS to "+due.length+" wallets on "+a.name+"?"+NL+NL
    +"This is "+steps+" transaction"+(steps===1?"":"s")+" and your wallet will ask you to approve each one."
    +(skipped?(NL+skipped+" wallet(s) are skipped: they have no LUMOS trustline and cannot receive a payment."):"")
    +NL+a.finalNote))return;
  btn.disabled=true;
  var p=progress();
  var run=(CH==="stellar")?sendStellar(w,due,p):sendXrpl(w,due,p);
  run.then(function(){
    p.textContent="Done \\u2014 "+due.filter(function(r){return r.sent;}).length+" of "+due.length+" paid.";
  }).catch(function(e){
    p.textContent="Stopped: "+((e&&e.message)||e);
  }).then(function(){ btn.disabled=false; paint(); });
}

function sendStellar(w,due,p){
  var bs=batches(due,100);
  return sdk().then(function(S){
    return w.addr().then(function(from){
      var asset=new S.Asset("LUMOS",S_ISSUER);
      var i=0;
      function step(){
        if(i>=bs.length)return Promise.resolve();
        var batch=bs[i];
        p.textContent="Batch "+(i+1)+" of "+bs.length+" \\u2014 waiting for your signature\\u2026";
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
            p.textContent="Batch "+(i+1)+" of "+bs.length+" \\u2014 submitting\\u2026";
            return fetch(H+"/transactions",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
              body:"tx="+encodeURIComponent(signed)}).then(function(r){ return r.json(); }).then(function(res){
              if(res&&(res.successful||res.hash)){ batch.forEach(function(r){ r.sent=true; r.tx=res.hash; }); }
              else { var rc=res&&res.extras&&res.extras.result_codes;
                var msg=rc?JSON.stringify(rc):"submission failed";
                batch.forEach(function(r){ r.err=msg; }); }
              render(); i++; return step(); }); }); });
      }
      return step(); }); });
}

// One Payment per recipient, approved one at a time. GemWallet autofills Fee, Sequence and
// LastLedgerSequence and submits, so there is no sequence to manage here -- which is exactly why this
// is a loop of single payments rather than a Batch.
//
// A FAILURE DOES NOT STOP THE ROUND, but a REFUSAL DOES. One wallet rejecting a payment (no trustline
// opened since the round was calculated, a frozen line) is that row's problem and the loop carries on.
// The admin closing the popup means they want to stop, so that throws out of the loop -- and because
// r.sent is only set on a confirmed hash, pressing Send again resumes from where it stopped instead of
// paying anyone twice.
function sendXrpl(w,due,p){
  return w.addr().then(function(from){
    var i=0, stop=null;
    function step(){
      if(i>=due.length||stop)return stop?Promise.reject(stop):Promise.resolve();
      var r=due[i];
      p.textContent="Payment "+(i+1)+" of "+due.length+" \\u2014 "+num(r.total)+" LUMOS to "
        +shortG(r.addr)+" \\u2014 approve in GemWallet\\u2026";
      var tx={TransactionType:"Payment",Account:from,Destination:r.addr,
        Amount:{currency:X_CUR,issuer:X_ISSUER,value:r.total.toFixed(6)},
        Memos:[xMemo("LumosCore: LUMOS rewards")]};
      return w.submit(tx).then(function(hash){
        r.sent=true; r.tx=hash;
      }).catch(function(e){
        var m=(e&&e.message)||String(e);
        if(/reject|cancel|denied|did not respond|not installed/i.test(m)){ stop=new Error(m); return; }
        r.err=m;
      }).then(function(){ render(); i++; return step(); }); }
    return step(); });
}

function csv(){
  var rd=R(), a=A(); if(!rd)return;
  var NL=String.fromCharCode(10), dp=a.dp;
  var head="chain,wallet,lumos_"+a.nativeCode.toLowerCase()+",eco_pools,holder,total_lumos,payable"+NL;
  var body=rd.rows.map(function(r){ return [a.key,r.addr,r.native.toFixed(dp),r.eco.toFixed(dp),
    r.whale.toFixed(dp),r.total.toFixed(dp),(r.noline?"no-trustline":"yes")].join(","); }).join(NL);
  var bl=new Blob([head+body],{type:"text/csv"}), u=URL.createObjectURL(bl);
  var el=document.createElement("a"); el.href=u; el.download="lumoscore-rewards-"+a.key+"-round.csv"; el.click();
  setTimeout(function(){URL.revokeObjectURL(u);},1000);
}

function boot(){
  if(!isPage())return;
  var head=q(".admin-page-head");
  if(head&&!q(".lxr-warn")){ var wn=document.createElement("div"); wn.className="lxr-warn";
    wn.innerHTML="This round is worked out from mainnet the moment the page opens, exactly as the public Rewards page does for a single wallet \\u2014 <b>Recalculate</b> re-reads it. Pick the chain with the chips below; each keeps its own round. Nothing leaves the treasury until you press <b>Send</b> and approve: it pays real LUMOS from the wallet you sign with \\u2014 100 payments per signature on Stellar, one approval per payment on XRPL \\u2014 and payments on both ledgers are final.";
    head.parentNode.insertBefore(wn, head.nextSibling); }
  var g=q("#lxrGen"); if(g&&!g.__lx){ g.__lx=1; g.addEventListener("click",function(){ generate(g); }); }
  var s=q("#lxrSend"); if(s&&!s.__lx){ s.__lx=1; s.addEventListener("click",function(){ send(s); }); }
  var c=q("#lxrCsv"); if(c&&!c.__lx){ c.__lx=1; c.addEventListener("click",csv); }
  paint();
  // CALCULATED ON LOAD. The page used to open with four dashes and an empty table behind a button,
  // so its normal state was blank and it taught nothing about the programs it administers (RAZA,
  // 2026-09-23: "so confusing and empty"). Reading the round is read-only -- pool holders and LUMOS
  // balances off the ledger -- so there is no reason to make it wait for a click. SENDING still takes
  // the same two deliberate acts it always did, and Send stays disabled until a round exists.
  //
  // Only the SELECTED chain is read on load. Calculating both would double the ledger traffic for a
  // round the admin may not be here to send, and the other chain calculates the moment its chip is
  // picked.
  if(g&&!g.__auto){ g.__auto=1; generate(g); }
  window.__lxRoundDbg=function(){ return {chain:CH,rounds:ROUNDS}; };
}
if(document.readyState!=="loading")boot(); else document.addEventListener("DOMContentLoaded",boot);
})();` + '</' + 'script>';

const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>';
function navItem(active, suffix) {
  return '<a class="adn-item ' + (active ? 'active' : '') + '" href="lumoscore-admin-rewards' + suffix + '.html" data-tip="LUMOS Rewards">\n      '
    + ICON + '\n      <span class="adn-label">Rewards</span>\n    </a>\n    ';
}
function variantOf(key) { if (/-dark\.html$/.test(key)) return '-dark'; if (/-mobile\.html$/.test(key)) return '-mobile'; return ''; }

// The browser block must not contain a backtick or a closing script tag: the first terminates the
// template literal above, the second ends the <script> early. Both have shipped broken builds before,
// so they are asserted rather than trusted.
if (SCRIPT.indexOf(String.fromCharCode(96)) >= 0) {
  console.error('  ! the rewards browser block contains a backtick — aborting');
  process.exit(1);
}

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
