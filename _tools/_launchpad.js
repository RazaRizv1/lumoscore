// Launchpad — real Stellar (TESTNET) token issuance. Layered ON TOP of the finalized launch pages
// (lumoscore-launch-token/review/confirm*.html); never edits the design or other _*.js transforms. See GUARDRAILS.md.
//
// FLOW (all classic ops, submitted to Horizon testnet):
//   1. generate a fresh ISSUER keypair (client-side) + fund via friendbot   [local]
//   2. distributor (user/Freighter) trustline to CODE:issuer                [Freighter]
//   3. issuer mints full supply -> distributor, then LOCKS itself (masterWeight 0) => fixed supply  [issuer local key]
//   4. distributor: changeTrust(XLM/CODE pool) + liquidityPoolDeposit + service-fee payment          [Freighter]
//   => asset is issued, supply fixed, LP live on the Stellar SDEX.
// The issuer is a throwaway key (useless after step 3's lock), so signing its txs locally is safe.
// Reuses the same patterns as _cctp.js (SDK via jsdelivr, Freighter via esm.sh @6, Horizon POST submit).

const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const CSS='<style id="lx-lp-css">'
/* item 31: the '?' markers in Launch Cost. Each row already states exactly what it is and what it
   costs, so the marker added a question the row had already answered -- and its tooltip still said
   'Aptos asset issuance fee', which is wrong on a Stellar launch. */
+'.summary-card .cost-row .info-i{display:none!important}'
// item 35: the terms line under the Next button.
+'.summary-card .summary-foot{display:none!important}'
+'.lx-lp-invalid{border-color:#e5484d!important;box-shadow:0 0 0 3px rgba(229,72,77,.13)!important}'
// Project Type: compact chip buttons instead of big cards — icon + title only, no description, auto width,
// sit inline. No default selection (see the uncheck in run()); .selected gets the accent ring on click.
+'.type-grid{display:flex!important;flex-wrap:wrap;gap:10px!important}'
+'.type-card{flex:0 0 auto!important;width:auto!important;min-width:0!important;padding:9px 15px 9px 13px!important;gap:9px!important;align-items:center!important;border-radius:11px!important}'
+'.type-card .sub{display:none!important}'
+'.type-card .radio{display:none!important}'
+'.type-card .ic{width:30px!important;height:30px!important;flex:0 0 30px!important}'
+'.type-card .ic svg{width:16px!important;height:16px!important}'
+'.type-card .info{display:flex;align-items:center}'
+'.type-card .ttl{font-size:14px!important;font-weight:700!important;white-space:nowrap}'
// launch progress overlay (theme-aware via site CSS vars)
+'.lxlp-prog{display:none;position:fixed;inset:0;z-index:9999;background:rgba(8,10,16,.5);backdrop-filter:blur(4px);align-items:center;justify-content:center;padding:20px}'
+'.lxlp-card{width:min(440px,94%);background:var(--surface,#fff);border:1px solid var(--border,#ececef);border-radius:20px;box-shadow:0 30px 70px rgba(0,0,0,.4);padding:26px 26px 24px;box-sizing:border-box;position:relative;overflow:hidden}'
+'.lxlp-card::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--accent,#ea6a2c),#ff9a3d)}'
+'.lxlp-h{font-size:20px;font-weight:750;letter-spacing:-.2px;color:var(--text,#0e0e10);margin-bottom:5px}'
+'.lxlp-sub{font-size:12.5px;color:var(--text,#0e0e10);opacity:.55;margin-bottom:20px;line-height:1.45}'
+'.lxlp-list{list-style:none;margin:0;padding:0}'
+'.lxlp-list li{position:relative;display:flex;align-items:center;gap:13px;padding:9px 10px;border-radius:12px;font-size:14.5px;color:var(--text,#0e0e10);opacity:.5;transition:opacity .25s,background .25s}'
+'.lxlp-list li.active,.lxlp-list li.done{opacity:1}'
+'.lxlp-list li.active{font-weight:650;background:var(--accent-pale,rgba(234,106,44,.1))}'
+'.lxlp-list li:not(:last-child)::after{content:"";position:absolute;left:23px;top:37px;width:2px;height:calc(100% - 22px);background:var(--border,#e0e2e8);z-index:0}'
+'.lxlp-list li.done:not(:last-child)::after{background:#1fa968}'
+'.lxlp-dot{position:relative;z-index:1;width:26px;height:26px;flex:0 0 26px;border-radius:50%;border:2px solid var(--border,#e0e2e8);background:var(--surface,#fff);display:inline-flex;align-items:center;justify-content:center;transition:border-color .2s,background .2s}'
+'.lxlp-list li.active .lxlp-dot{border-color:var(--accent,#ea6a2c)}'
+'.lxlp-list li.done .lxlp-dot{background:#1fa968;border-color:#1fa968}'
+'.lxlp-spin{width:12px;height:12px;border-radius:50%;border:2px solid var(--accent,#ea6a2c);border-top-color:transparent;animation:lxlpspin .7s linear infinite;display:none}'
+'.lxlp-list li.active .lxlp-spin{display:block}'
+'.lxlp-tick{color:#fff;font-size:13px;font-weight:700;line-height:1;display:none}'
+'.lxlp-list li.done .lxlp-tick{display:block}'
+'@keyframes lxlpspin{to{transform:rotate(360deg)}}'
+'.lxlp-msg{margin-top:18px;font-size:12.5px;color:var(--text,#0e0e10);opacity:.65;min-height:18px}'
+'.lxlp-x{margin-top:16px;width:100%;padding:13px;border:0;border-radius:13px;background:linear-gradient(135deg,var(--accent,#ea6a2c),#ff8a3d);color:#fff;font:inherit;font-size:15px;font-weight:650;cursor:pointer;box-shadow:0 8px 20px rgba(234,106,44,.32)}'
+'</style>';

// ---- browser engine (template literal: no backticks / no ${ } beyond the JSON config below; no literal </script>) ----
const BODY=`(function(){
try{ window.__lxLP={
  testnet:false,
  horizon:"https://horizon.stellar.org",
  friendbot:"https://friendbot.stellar.org",
  issuerFundXlm:"2",
  passphrase:"Public Global Stellar Network ; September 2015",
  feeCollector:"GAMZFXIJD5E3PNRFCG6VPXCJNUOZAP5BY2P3MU3ZXXUSVM2UY5P6LJKD",
  createFeeXlm:34.70, liqXlm:69.40, poolFeeXlm:69.40,
  // Mint is a fixed $25 product (Token creation $5 + Initial liquidity $10 + Pool/network $10);
  // the XLM amounts are derived from the LIVE rate so the total always equals $25 at current price.
  //
  // A cheap build was deployed to STAGING ONLY on 2026-09-03 so a real mainnet mint could be walked
  // through for about 20 cents (createFeeUsd:0.05, liqUsd:0.10, poolFeeUsd:0.05). It was never
  // committed and the repo was put back to these numbers straight after deploying, precisely so a
  // later promote could not carry test pricing into production. Only the USD values are read --
  // lxLpCosts derives the XLM from the live rate, and the cost card reads the same constants.
  createFeeUsd:5, liqUsd:10, poolFeeUsd:10
}; }catch(_){}

// Live XLM→USD so the cost card shows a real dollar figure instead of a hardcoded rate.
// Cache is {v,ts} and only trusted for 6h. The old format was a bare number with no timestamp, so a rate
// written weeks earlier was believed indefinitely -- which is how a $25 product came to read 173.50 XLM.
var LXLP_MAXAGE=216e5;   // 6 hours
try{
  var _raw=localStorage.getItem("lumos.xlmusd"), _c=null;
  if(_raw&&_raw.charAt(0)==="{"){ _c=JSON.parse(_raw); }
  if(_c&&+_c.v>0&&(Date.now()-(+_c.ts||0))<LXLP_MAXAGE) window.__lxXlmUsd=+_c.v;
  // The wallet/dex pages keep the same figure under a different key; borrow it rather than guessing.
  if(!(window.__lxXlmUsd>0)){
    var _r2=localStorage.getItem("lumos.xlmUsd");
    if(_r2&&_r2.charAt(0)==="{"){ var _c2=JSON.parse(_r2);
      if(_c2&&+_c2.v>0&&(Date.now()-(+_c2.ts||0))<LXLP_MAXAGE) window.__lxXlmUsd=+_c2.v; }
  }
}catch(_){}
// Last resort only, and deliberately not presented as live: lxLpOnPrice fires again the moment a real
// rate lands, and every cost row repaints then.
if(!(window.__lxXlmUsd>0)) window.__lxXlmUsd=0.11;
window.__lxLpPriceCbs=window.__lxLpPriceCbs||[];
function lxLpOnPrice(cb){ try{ window.__lxLpPriceCbs.push(cb); if(window.__lxXlmUsdLive) cb(window.__lxXlmUsd); }catch(_){} }
// XLM amounts sized so each cost equals its fixed USD target at the live rate (total = $25).
function lxLpCosts(){ var r=(window.__lxXlmUsd>0?window.__lxXlmUsd:0.11), C=window.__lxLP; return { rate:r, createFeeXlm:(C.createFeeUsd||5)/r, liqXlm:(C.liqUsd||10)/r, poolFeeXlm:(C.poolFeeUsd||10)/r }; }
// Shared cost-card painter (fixed $25 total; XLM derived from the live rate). Used by BOTH step-1 (live, as
// the user edits extra liquidity) and the review page — so the two never disagree.
function lxLpPaintCost(extra){
  extra=Math.max(0, parseFloat(String(extra||"0").replace(/,/g,""))||0);
  if(typeof lxLpSetRow!=="function") return;
  var C=window.__lxLP, K=lxLpCosts(), r=K.rate, dim='<span style="opacity:.55">';
  function d2(v){ return (Math.abs(v-Math.round(v))<0.005)?String(Math.round(v)):v.toFixed(2); }
  var createX=K.createFeeXlm, poolX=K.poolFeeXlm, liqX=K.liqXlm+extra, totX=createX+poolX+liqX;
  var cU=(C.createFeeUsd||5), pU=(C.poolFeeUsd||10), lU=(C.liqUsd||10)+extra*r, tU=cU+pU+lU;
  lxLpSetRow(/Token creation/i, createX.toFixed(2)+" XLM "+dim+"≈ $"+d2(cU)+"</span>");
  lxLpSetRow(/Initial liquidity/i, liqX.toFixed(2)+" XLM "+dim+"≈ $"+d2(lU)+"</span>");
  lxLpSetRow(/pool.{0,3}network/i, poolX.toFixed(2)+" XLM "+dim+"≈ $"+d2(pU)+"</span>");
  var tc=document.querySelector(".cost-total .v"); if(tc) tc.innerHTML=totX.toFixed(2)+" XLM "+dim+"≈ $"+d2(tU)+"</span>";
  // The phone's sticky summary bar -- same numbers, the design's own markup.
  var sc=document.getElementById("costTotal");
  if(sc) sc.innerHTML=totX.toFixed(2)+' XLM <span class="usd">\u2248 $'+d2(tU)+'</span>';
}
(function(){
  function adopt(p){
    if(!(p>0))return false;
    window.__lxXlmUsd=p; window.__lxXlmUsdLive=1;
    try{ localStorage.setItem("lumos.xlmusd",JSON.stringify({v:p,ts:Date.now()})); }catch(_){}
    (window.__lxLpPriceCbs||[]).forEach(function(f){ try{ f(p); }catch(_){} });
    return true;
  }
  // Our own endpoint first: server-side, edge-cached, and not subject to CoinGecko's egress rules.
  function viaEdge(){
    return fetch("/lxapi/xlm").then(function(r){ if(!r.ok)throw 0; return r.json(); })
      .then(function(d){ if(!adopt(d&&+d.usd))throw 0; });
  }
  function viaGecko(){
    return fetch("https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd")
      .then(function(r){ return r.json(); })
      .then(function(j){ adopt(j&&j.stellar&&+j.stellar.usd); });
  }
  try{ viaEdge().catch(function(){ return viaGecko(); }).catch(function(){}); }catch(_){}
})();

var _lpSdkP=null;
function lxLpSdk(){
  if(window.StellarSdk) return Promise.resolve(window.StellarSdk);
  if(_lpSdkP) return _lpSdkP;
  _lpSdkP=new Promise(function(res,rej){
    var s=document.createElement("script");
    s.src="/assets/vendor/stellar-sdk-13.3.0.min.js";
    s.onload=function(){ res(window.StellarSdk); };
    s.onerror=function(){ rej(new Error("Failed to load Stellar SDK")); };
    document.head.appendChild(s);
  });
  return _lpSdkP;
}
function lxLpFreighter(){
  if(window.freighterApi && window.freighterApi.getAddress) return Promise.resolve(window.freighterApi);
  return import("https://esm.sh/@stellar/freighter-api@6").then(function(m){ return m.default||m; });
}
// which wallet is connected + its address (set by the connect modal)
function lxLpWalletId(){ try{ return (localStorage.getItem("lumos.wallet")||"").toLowerCase().replace(/[^a-z]/g,""); }catch(_){ return ""; } }
function lxLpConnectedAddr(){ try{ return localStorage.getItem("lumos.address")||""; }catch(_){ return ""; } }
var _lpMods={}; function lxLpMod(u){ return _lpMods[u]||(_lpMods[u]=import(u)); }
// resolve the connected wallet's public key (any Stellar wallet, not just Freighter)
function lxLpResolveAddr(){
  var a=lxLpConnectedAddr(); if(a && a.charAt(0)==="G") return Promise.resolve(a);
  return lxLpFreighter().then(function(f){ return Promise.resolve(f.requestAccess?f.requestAccess():null).then(function(){ return f.getAddress?f.getAddress():f.getPublicKey(); }).then(function(r){ return (r&&r.address)||r; }); });
}
// Sign a base64 tx XDR with WHICHEVER Stellar wallet is connected; returns the signed XDR string.
function lxLpSignXdr(xdr, addr){
  var C=window.__lxLP, w=lxLpWalletId(), pass=C.passphrase;
  if(w==="albedo"){
    return lxLpMod("https://esm.sh/@albedo-link/intent@0.12.0").then(function(m){ var al=m.default||m.albedo||m; if(!al||!al.tx) throw new Error("Albedo SDK failed to load"); return al.tx({xdr:xdr, network:"public", pubkey:addr, submit:false}); })
      .then(function(r){ var s=r&&(r.signed_envelope_xdr||r.xdr); if(!s) throw new Error("Albedo did not return a signed transaction"); return s; });
  }
  if(w==="rabet"){
    if(!window.rabet||!window.rabet.sign) return Promise.reject(new Error("Rabet not found. Unlock the Rabet extension and retry."));
    return Promise.resolve(window.rabet.sign(xdr,"mainnet")).then(function(r){ if(r&&r.error) throw new Error((r.error&&r.error.message)||r.error); var s=r&&(r.xdr||r.signedXDR); if(!s) throw new Error("Rabet did not return a signed transaction"); return s; });
  }
  if(w==="xbull"){
    var x=window.xBullSDK; if(!x||!x.signXDR) return Promise.reject(new Error("xBull not found. Unlock the xBull extension and retry."));
    return Promise.resolve(x.signXDR(xdr,{network:"PUBLIC",networkPassphrase:pass,publicKey:addr})).then(function(r){ var s=r&&(r.signedXDR||r.xdr||r); if(!s||typeof s!=="string") throw new Error("xBull did not return a signed transaction"); return s; });
  }
  // A phone has no LOBSTR extension — that session signs over WalletConnect instead. Only true when
  // the connect step recorded transport=wc, so extension sessions still take the branch below.
  if((w==="lobstr"||w==="walletconnect")&&window.__lxWcActive&&window.__lxWcActive()) return window.__lxWcSign(xdr,pass);
  if(w==="lobstr"){
    return lxLpMod("https://esm.sh/@lobstrco/signer-extension-api").then(function(m){ var sign=m.signTransaction||(m.default&&m.default.signTransaction); if(!sign) throw new Error("LOBSTR API unavailable"); return sign(xdr); }).then(function(s){ if(!s||typeof s!=="string") throw new Error("LOBSTR couldn't sign — unlock the LOBSTR extension, make sure it's connected and set to Testnet, then retry."); return s; });
  }
  // WalletConnect signing isn't wired yet — don't silently fall through to Freighter (wrong account).
  if(w==="walletconnect") return Promise.reject(new Error("WalletConnect signing isn't enabled yet. Reconnect with Freighter, Albedo, Rabet or LOBSTR."));
  // default / freighter
  return lxLpFreighter().then(function(f){ return Promise.resolve(f.signTransaction(xdr,{networkPassphrase:pass,network:"PUBLIC",address:addr})); })
    .then(function(sig){ var s=(sig&&(sig.signedTxXdr||sig.signedXDR))||sig; if((sig&&sig.error)||typeof s!=="string") throw new Error("Signing cancelled."); return s; });
}
function lxLpAmt(n){ var x=Number(n); if(!isFinite(x)||x<0) x=0; return x.toFixed(7); }
function lxLpCode(t){ return String(t||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,12); }
// neutral "no logo yet" placeholder + Stellar network logo (relative asset, resolves under dist root)
var LXLP_PH="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI5NiIgaGVpZ2h0PSI5NiIgdmlld0JveD0iMCAwIDk2IDk2Ij48cmVjdCB3aWR0aD0iOTYiIGhlaWdodD0iOTYiIHJ4PSIyMiIgZmlsbD0iI2VjZWVmMyIvPjxnIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2FhYjFiZCIgc3Ryb2tlLXdpZHRoPSI0IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxyZWN0IHg9IjI3IiB5PSIzMSIgd2lkdGg9IjQyIiBoZWlnaHQ9IjM0IiByeD0iNSIvPjxjaXJjbGUgY3g9IjM5IiBjeT0iNDMiIHI9IjQiLz48cGF0aCBkPSJNMzAgNTlsMTEtMTEgOSA4IDctNiA5IDkiLz48L2c+PC9zdmc+";
var LXLP_XLM="assets/tokens/xlm.png";
function lxLpImgTag(src){ return '<img src="'+(src||LXLP_PH)+'" alt="" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit">'; }
// fill an icon container with the uploaded logo (or the placeholder) as an <img>, replacing any monogram text
function lxLpFillIcon(box, src){ if(!box) return; var want=src||LXLP_PH; var cur=box.querySelector('img[data-lxlp]'); if(cur){ if(cur.getAttribute("src")!==want) cur.setAttribute("src",want); return; } box.innerHTML='<img data-lxlp="1" src="'+want+'" alt="" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit">'; box.style.color="transparent"; box.style.overflow="hidden"; if(!box.style.background) box.style.background="var(--surface,#fff)"; }
// Step-1 live preview: the design writes the ticker letters into .preview-icon; show a placeholder image
// (or the uploaded logo) instead, and keep re-applying it since the design rewrites the box on every keystroke.
function lxLpPreviewIcon(){ var pi=document.querySelector(".preview-icon"); if(!pi) return; lxLpFillIcon(pi, window.__lxLpIcon||""); }
// Step-1 upload box: after a logo is chosen, show its thumbnail + a "Logo uploaded" confirmation inside the
// drop zone (the zone stays clickable to change it). Clearing the icon restores the design's default prompt.
function lxLpPaintUpload(){
  var uz=document.querySelector("#iconUploadZone")||document.querySelector(".upload-zone"); if(!uz) return;
  var src=window.__lxLpIcon||"", name=window.__lxLpIconName||"", prev=uz.querySelector(".lx-lp-uploaded");
  if(!src){ if(prev) prev.parentNode.removeChild(prev); for(var i=0;i<uz.children.length;i++){ var c=uz.children[i]; if(c.id!=="iconFileInput") c.style.removeProperty("display"); } return; }
  for(var j=0;j<uz.children.length;j++){ var ch=uz.children[j]; if(ch.id!=="iconFileInput" && !(ch.classList&&ch.classList.contains("lx-lp-uploaded"))) ch.style.display="none"; }
  if(!prev){ prev=document.createElement("div"); prev.className="lx-lp-uploaded"; prev.style.cssText="display:flex;align-items:center;gap:14px;justify-content:center;text-align:left"; uz.appendChild(prev); }
  prev.innerHTML='<img src="'+src+'" alt="" style="width:58px;height:58px;border-radius:13px;object-fit:cover;border:1px solid var(--border,#2a2a30);flex:0 0 auto">'
    +'<div style="min-width:0"><div style="display:flex;align-items:center;gap:7px;font-weight:750;color:#1fa968;font-size:14.5px"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span>Logo uploaded</span></div>'
    +'<div class="lx-lp-upname" style="font-size:12.5px;opacity:.6;margin-top:3px"></div></div>';
  var sub=prev.querySelector(".lx-lp-upname"); if(sub) sub.textContent=(name?name+" · ":"")+"Click to change";
}

// draft = {name, ticker, supply, sharePct, extraXlm, ...}. opts.distSigner (StellarSdk.Keypair) => sign distributor txs locally (test mode); else Freighter.
window.lxLaunchToken=function(draft, onStatus, opts){
  onStatus=onStatus||function(){}; opts=opts||{};
  var C=window.__lxLP, result={ code:"", issuer:"", distributor:"", supply:"", sharePct:0, mintHash:"", trustHash:"", poolHash:"", poolId:"", feeXlm:0, liqXlm:0, ledger:0, ts:0 };
  var code=lxLpCode(draft.ticker); if(!code) return Promise.reject(new Error("Enter a valid ticker (letters/numbers, up to 12)."));
  var supplyNum=parseFloat(String(draft.supply||"").replace(/,/g,"")); if(!(supplyNum>0)) return Promise.reject(new Error("Enter a valid total supply."));
  if(supplyNum>10000000000) supplyNum=10000000000;   // hard cap: max 10B supply
  var sharePct=Math.max(0,Math.min(30, parseFloat(draft.sharePct)||10));
  var lpTokens=supplyNum*(100-sharePct)/100;
  var extraXlm=Math.max(0, parseFloat(String(draft.extraXlm||"0").replace(/,/g,""))||0);
  // Fee split (matches the swap-fee model): the base "initial liquidity" XLM + ALL of the user's extra XLM
  // go into the LP (no deduction on extra); the remainder (token-creation + pool/network budget) is credited
  // to the shared fee-collection wallet C.feeCollector. On-chain network (tx) fees are paid separately.
  var K=lxLpCosts(); var liqXlm=(K.liqXlm||0)+extraXlm, feeXlm=(K.createFeeXlm||0)+(K.poolFeeXlm||0);
  result.code=code; result.supply=String(supplyNum); result.sharePct=sharePct; result.liqXlm=liqXlm; result.feeXlm=feeXlm;

  return lxLpSdk().then(function(S){
    var HZ=C.horizon;
    // Horizon calls go through XMLHttpRequest (NOT fetch): some wallet extensions (e.g. xBull) wrap
    // window.fetch and throw while inspecting outgoing transactions — XHR bypasses that entirely.
    function xhr(method,url,body){ return new Promise(function(resolve,reject){ var r=new XMLHttpRequest(); r.open(method,url,true); if(body!=null) r.setRequestHeader("Content-Type","application/x-www-form-urlencoded"); r.onload=function(){ var j=null; try{ j=JSON.parse(r.responseText); }catch(_){}
      resolve({status:r.status, ok:(r.status>=200&&r.status<300), json:j, text:r.responseText}); }; r.onerror=function(){ reject(new Error("Network error contacting Horizon")); }; r.ontimeout=function(){ reject(new Error("Horizon request timed out")); }; r.timeout=45000; r.send(body==null?null:body); }); }
    function acct(pk){ return xhr("GET",HZ+"/accounts/"+pk,null).then(function(r){ if(!r.ok||!r.json) throw new Error("Account not found on mainnet: "+String(pk).slice(0,6)); return r.json; }); }
    function submit(xdr,label){ return xhr("POST",HZ+"/transactions","tx="+encodeURIComponent(xdr)).then(function(r){ var res=r.json||{};
      if(res.successful) return res;
      var rc=res.extras&&res.extras.result_codes; throw new Error((label||"tx")+" failed: "+(rc?JSON.stringify(rc):(res.detail||("HTTP "+r.status)))); }); }
    function newTx(pk){ return acct(pk).then(function(a){ return { acc:new S.Account(pk,a.sequence), seqAcc:a }; }); }
    var issuerKp, distPk, asset, freighter;

    function signDist(tb,label){
      if(opts.distSigner){ tb.sign(opts.distSigner); return submit(tb.toXDR(),label); }
      onStatus("Waiting for signature ("+label+")…");
      // sign with WHICHEVER Stellar wallet is connected (Freighter / Albedo / Rabet / xBull / LOBSTR)
      return lxLpSignXdr(tb.toXDR(), distPk).then(function(x){ onStatus("Submitting "+label+"…"); return submit(x,label); });
    }

    var start = opts.distSigner ? Promise.resolve(opts.distSigner.publicKey()) : lxLpResolveAddr();

    return start.then(function(pk){
      distPk=pk; if(!distPk) throw new Error("Connect your Stellar wallet first."); result.distributor=distPk;
      onStatus("Creating issuer account…");
      issuerKp=S.Keypair.random(); asset=new S.Asset(code, issuerKp.publicKey()); result.issuer=issuerKp.publicKey();
      var issuerPk=issuerKp.publicKey();
      // MAINNET: the issuer is created + funded atomically by the first op (createAccount, sourced from the
      // connected wallet) — no friendbot, no pre-funding wait. The whole thing is ONE signed tx.
      // ONE atomic tx: trust asset -> receive full supply -> trust pool -> deposit LP -> pay fee -> lock issuer.
      var native=S.Asset.native();
      var poolAsset=new S.LiquidityPoolAsset(native, asset, S.LiquidityPoolFeeV18);
      var poolId=S.getLiquidityPoolId("constant_product", poolAsset.getLiquidityPoolParameters()).toString("hex");
      result.poolId=poolId;
      onStatus("Establishing "+code+" trustline…");
      return newTx(distPk).then(function(t){ // ONE quick fetch (distributor sequence), then build+sign immediately
        var tb=new S.TransactionBuilder(t.acc,{fee:"3000",networkPassphrase:C.passphrase})
          .addOperation(S.Operation.createAccount({destination:issuerPk, startingBalance:C.issuerFundXlm}))   // MAINNET: connected wallet funds the new issuer with real XLM (no friendbot on mainnet)
          .addOperation(S.Operation.changeTrust({asset:asset}))
          .addOperation(S.Operation.payment({source:issuerPk, destination:distPk, asset:asset, amount:lxLpAmt(supplyNum)}))
          .addOperation(S.Operation.changeTrust({asset:poolAsset}))
          .addOperation(S.Operation.liquidityPoolDeposit({liquidityPoolId:poolId, maxAmountA:lxLpAmt(liqXlm), maxAmountB:lxLpAmt(lpTokens), minPrice:{n:1,d:1000000000}, maxPrice:{n:1000000000,d:1}}))
          .addOperation(S.Operation.payment({destination:C.feeCollector, asset:native, amount:lxLpAmt(feeXlm)}))
          // homeDomain rides on the SAME setOptions that locks the issuer, and this is the only chance
          // to set it. masterWeight:0 removes the issuer's ability to sign anything ever again, so an
          // asset minted without a home domain can NEVER be given one -- reported 2026-09-02, FRANK
          // (GBATOPMB...3XNO) went out with home_domain unset and is permanently unable to claim this
          // site. Every mainnet mint since the migration is in that state.
          //
          // It matters because the SEP-1 document at lumoscore.com only lists assets that CLAIM
          // lumoscore.com: functions/.well-known/stellar.toml.js builds its candidate list by asking
          // stellar.expert for assets whose domain is ours. No home domain, no entry, and therefore no
          // name, description or logo anywhere the ecosystem can read them.
          //
          // Added to the existing operation rather than as a new one: same op count, same fee, and no
          // ordering question about whether the lock lands before the domain is set.
          .addOperation(S.Operation.setOptions({source:issuerPk, homeDomain:"lumoscore.com", masterWeight:0, lowThreshold:0, medThreshold:0, highThreshold:0}))
          .setTimeout(300).build();
        tb.sign(issuerKp); // issuer co-signs its two ops locally (throwaway key)
        // Fire the ONE wallet signature now (earliest possible), so the popup opens within the click gesture.
        var signP;
        if(opts.distSigner){ tb.sign(opts.distSigner); signP=Promise.resolve(tb.toXDR()); }
        else { onStatus("Waiting for signature (trustline)…"); signP=lxLpSignXdr(tb.toXDR(), distPk); }
        return signP.then(function(signedXdr){
          onStatus("Minting "+code+" supply & locking issuer…");
          // issuer is created + funded inside this same tx (op 1) -> submit atomically
          return Promise.resolve().then(function(){
            onStatus("Seeding XLM/"+code+" liquidity pool…");
            return submit(signedXdr,"launch");
          }).then(function(res){ result.trustHash=res.hash; result.mintHash=res.hash; result.poolHash=res.hash; result.ledger=res.ledger||0; });
        });
      });
    }).then(function(){
      // WAIT for the details to publish before declaring the launch done. This used to be fire-and-forget,
      // which lost the race: the promise resolved immediately, "Done" appeared, and the click navigated
      // away mid-upload -- aborting a POST carrying up to 700KB of logo. Measured 2026-09-03: BOMB
      // (GDK6R7M6…) minted correctly on-chain, home_domain and all, but never reached the toml, while
      // slower mints like HULK did. Bounded, because the mint has ALREADY succeeded and a slow or failing
      // publish must never strand the user on a spinner -- the confirm page retries what times out here.
      onStatus("Publishing token details…");
      return lxLpAtMost(lxLpSaveMeta(result), 20000).then(function(){ onStatus("Token launched ✓"); return result; });
    });
  });
};

// ---- draft persistence + page wiring ----
function lxLpReadDraft(){ try{ return JSON.parse(localStorage.getItem("lumos.launch.draft")||"{}"); }catch(_){ return {}; } }
function lxLpVal(sel){ var e=document.querySelector(sel); return e?(e.value||"").trim():""; }
function lxLpSocial(ph){ var e=[].slice.call(document.querySelectorAll("input")).filter(function(i){return (i.placeholder||"").indexOf(ph)>=0;})[0]; return e?(e.value||"").trim():""; }
function lxLpCaptureDraft(){
  var pt=(document.querySelector('input[name="ptype"]:checked')||{}).value||"meme";
  var d={ name:lxLpVal("#tokenName"), ticker:lxLpVal("#tokenTicker"), projectType:pt, desc:lxLpVal("#desc"),
    telegram:lxLpSocial("t.me"), twitter:lxLpSocial("x.com"), website:lxLpSocial("yourproject.com"),
    supply:lxLpVal("#supply"), sharePct:parseFloat(lxLpVal("#shareNum"))||10, extraXlm:lxLpVal("#extraLiquidity"),
    icon:window.__lxLpIcon||"", iconName:window.__lxLpIconName||"" };
  try{ localStorage.setItem("lumos.launch.draft", JSON.stringify(d)); }catch(_){}
  return d;
}
// Send what the minter typed to /lxapi/mintmeta, once the mint has actually succeeded.
//
// Until now this was the missing half of the launchpad: lxLpCaptureDraft() writes name, description,
// socials and the logo to localStorage and NOTHING ever posted them, so an asset arrived on the site
// with nothing but a code and an issuer. The endpoint proves the mint from the transaction hash before
// storing anything, which is why the hash is sent and why this can be called by anyone.
//
// FIRE AND FORGET, deliberately. The tokens are already minted and the fee is already paid by the time
// this runs; a failure here must never turn a successful launch into an error the minter sees. Any
// rejection is recoverable later by resubmitting, and losing the metadata is the status quo, not a
// regression.
// Resolve when p does, or after ms -- whichever comes first. Never rejects.
function lxLpAtMost(p, ms){
  return new Promise(function(res){
    var done=false; function fin(v){ if(!done){ done=true; res(v); } }
    setTimeout(function(){ fin("timeout"); }, ms);
    try{ Promise.resolve(p).then(fin, function(){ fin(false); }); }catch(_){ fin(false); }
  });
}
// Records whether the details for CODE-ISSUER are known to have published, so the confirm page can retry
// exactly the submissions that did not.
function lxLpMetaKey(r){ return "1:"+r.code+"-"+r.issuer; }
function lxLpSaveMeta(result){
  try{
    if(!result || !result.code || !result.issuer || !result.mintHash) return Promise.resolve(false);
    var d={}; try{ d=JSON.parse(localStorage.getItem("lumos.launch.draft")||"{}"); }catch(_){}
    var logo=window.__lxLpIcon||d.icon||"";
    // The file input accepts up to 10MB but the store caps a logo at 512KB, and the endpoint rejects
    // the WHOLE submission if the image is over. Dropping just the image keeps the description and the
    // links, which is far better than losing everything to a large PNG.
    if(logo && logo.length > 700000) logo="";
    // Only describe the token when we still have what the minter actually typed.
    //
    // The endpoint merges PRESENT-beats-non-empty: a key the request carries wins even when it is empty
    // (so a minter can clear a mistyped field), and a key it omits keeps what is stored. That makes
    // sending blanks actively destructive rather than merely useless -- it ERASES the name, description
    // and logo. Measured 2026-09-03: the confirm-page retry ran in a browser with no draft and wiped
    // BOMB's metadata. The retry is worth keeping regardless, because the registration alone is what
    // makes a fresh mint a candidate for the toml at all; it just must not claim to know the details.
    // The form requires a name, so an absent draft means we lost it, never that the user left it blank.
    var body={ code:result.code, issuer:result.issuer, txHash:result.mintHash };
    if(d && (d.name||d.desc||d.website||d.twitter||d.telegram||logo)){
      body.name=d.name||""; body.description=d.desc||""; body.website=d.website||"";
      body.twitter=d.twitter||""; body.telegram=d.telegram||""; body.logo=logo;
    }
    return fetch("/lxapi/mintmeta",{
      method:"POST", headers:{"content-type":"application/json"},
      body:JSON.stringify(body)
    }).then(function(r){
      var ok=!!(r&&r.ok);
      if(ok){ try{ localStorage.setItem("lumos.launch.metaok", lxLpMetaKey(result)); }catch(_){} }
      return ok;
    }).catch(function(){ return false; });
  }catch(_){ return Promise.resolve(false); }
}
function lxLpErr(msg){ var host=document.querySelector(".summary-cta"); if(!host)return; var el=document.getElementById("lx-lp-err"); if(!el){ el=document.createElement("div"); el.id="lx-lp-err"; el.style.cssText="color:#e5484d;font-size:12.5px;margin:8px 2px 0;text-align:center;line-height:1.4"; host.parentNode.insertBefore(el, host.nextSibling); } el.textContent=msg||""; }

// set an input/textarea value and fire input+change so the design's live preview reacts
function lxLpSetField(sel, val){ var el=document.querySelector(sel); if(!el||val==null||val==="") return; var tag=el.tagName==="TEXTAREA"?window.HTMLTextAreaElement:window.HTMLInputElement; try{ Object.getOwnPropertyDescriptor(tag.prototype,"value").set.call(el, String(val)); }catch(_){ el.value=String(val); } el.dispatchEvent(new Event("input",{bubbles:true})); el.dispatchEvent(new Event("change",{bubbles:true})); }
function lxLpSetSocial(ph, val){ if(val==null||val==="") return; var el=[].slice.call(document.querySelectorAll("input")).filter(function(i){return (i.placeholder||"").indexOf(ph)>=0;})[0]; if(!el) return; try{ Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set.call(el, String(val)); }catch(_){ el.value=String(val); } el.dispatchEvent(new Event("input",{bubbles:true})); el.dispatchEvent(new Event("change",{bubbles:true})); }
// Blank the whole step-1 form (fresh entry). Reset each field to its HTML default (browsers restore typed
// values on reload independent of our draft, so clearing localStorage isn't enough — clear the inputs too).
function lxLpClearForm(){
  ["#tokenName","#tokenTicker","#desc","#supply","#extraLiquidity","#shareNum"].forEach(function(sel){ var el=document.querySelector(sel); if(!el) return; var tag=el.tagName==="TEXTAREA"?window.HTMLTextAreaElement:window.HTMLInputElement; var dv=(el.defaultValue!=null?el.defaultValue:""); try{ Object.getOwnPropertyDescriptor(tag.prototype,"value").set.call(el, dv); }catch(_){ el.value=dv; } el.dispatchEvent(new Event("input",{bubbles:true})); el.dispatchEvent(new Event("change",{bubbles:true})); });
  ["t.me","x.com","yourproject.com"].forEach(function(ph){ var el=[].slice.call(document.querySelectorAll("input")).filter(function(i){return (i.placeholder||"").indexOf(ph)>=0;})[0]; if(!el) return; el.value=""; el.dispatchEvent(new Event("input",{bubbles:true})); el.dispatchEvent(new Event("change",{bubbles:true})); });
  [].forEach.call(document.querySelectorAll('input[name="ptype"]'),function(r){ r.checked=false; r.removeAttribute("checked"); });
  [].forEach.call(document.querySelectorAll('.type-card'),function(c){ c.classList.remove("selected"); });
  window.__lxLpIcon=""; window.__lxLpIconName=""; lxLpPreviewIcon(); lxLpPaintUpload();
}
function lxLpPopulateForm(){
  var d=lxLpReadDraft(); if(!d || !(d.name||d.ticker||d.supply)) return;
  lxLpSetField("#tokenName", d.name); lxLpSetField("#tokenTicker", d.ticker);
  lxLpSetField("#desc", d.desc); lxLpSetField("#supply", d.supply);
  lxLpSetField("#shareNum", d.sharePct); lxLpSetField("#extraLiquidity", d.extraXlm);
  lxLpSetSocial("t.me", d.telegram); lxLpSetSocial("x.com", d.twitter); lxLpSetSocial("yourproject.com", d.website);
  if(d.projectType){ var rb=document.querySelector('input[name="ptype"][value="'+d.projectType+'"]'); if(rb && !rb.checked){ rb.checked=true; rb.dispatchEvent(new Event("change",{bubbles:true})); rb.dispatchEvent(new Event("click",{bubbles:true})); } }
  if(d.icon){ window.__lxLpIcon=d.icon; window.__lxLpIconName=d.iconName||""; }
  lxLpPreviewIcon(); lxLpPaintUpload();
}
// Downscale an uploaded logo before anything stores it.
//
// WHY. The upload cap is 10MB, but localStorage is ~5MB per ORIGIN and base64 inflates a file by 4/3 --
// so a 10MB logo becomes a ~13MB data URI that cannot be stored at all. That mattered because
// lxLpConfirmLaunch persists the launch result with the icon inside it, and its setItem was wrapped in a
// silent try/catch: measured 2026-09-03, a real BOMB mint succeeded on-chain, the result was never
// written, and the confirm page fell back to the DESIGN MOCK ("Aptos Coin", 1,000,000,000 supply, 0x…
// addresses) with no error anywhere. Smaller logos could reach the same quota once lumos.launch.icons had
// accumulated a few previous mints.
//
// 256px is what the confirm card, the asset page and the token lists actually render, so nothing on
// screen loses fidelity; it puts a typical logo at 20-60KB and makes the quota unreachable in practice.
// PNG is used (not WebP) because the data URI is also POSTed to /lxapi/mintmeta and served back as the
// asset's logo, where broad support matters more than a few KB.
//
// SVG is passed through untouched when it is already small: it is markup, it scales, and rasterising it
// would throw away the one format that never needs to be. A large SVG still gets rasterised.
// Every failure path falls back to the original data URI rather than dropping the user's logo -- the
// store below is what has to survive a too-big icon, not this.
var LXLP_ICON_PX = 256;
function lxLpShrinkIcon(dataUrl, mime, done){
  try{
    if(!dataUrl || dataUrl.indexOf("data:")!==0){ done(dataUrl); return; }
    if(/svg/i.test(mime||"") && dataUrl.length<40000){ done(dataUrl); return; }
    var img=new Image();
    img.onload=function(){
      try{
        var w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
        if(!(w>0&&h>0)){ done(dataUrl); return; }
        var s=Math.min(1, LXLP_ICON_PX/Math.max(w,h));
        var cw=Math.max(1,Math.round(w*s)), ch=Math.max(1,Math.round(h*s));
        var c=document.createElement("canvas"); c.width=cw; c.height=ch;
        var x=c.getContext("2d"); if(!x){ done(dataUrl); return; }
        x.drawImage(img,0,0,cw,ch);
        var out=c.toDataURL("image/png");
        // Only accept the re-encode if it actually helped -- a tiny flat PNG can grow when redrawn.
        done((out && out.length<dataUrl.length) ? out : dataUrl);
      }catch(_){ done(dataUrl); }
    };
    img.onerror=function(){ done(dataUrl); };
    img.src=dataUrl;
  }catch(_){ done(dataUrl); }
}

// Persist the launch result so the confirm page can paint it. NEVER silently -- see lxLpShrinkIcon for
// what a swallowed QuotaExceededError looked like from the outside. Degrade in steps instead: the icon is
// the only unbounded field and it is also held separately (lumos.launch.icons) and server-side (mintmeta),
// so dropping it still leaves a correct page with a placeholder logo, which beats the design mock.
function lxLpStoreResult(res){
  function put(o){ localStorage.setItem("lumos.launch.result", JSON.stringify(o)); return true; }
  try{ return put(res); }catch(_){}
  var slim={}; for(var k in res){ if(Object.prototype.hasOwnProperty.call(res,k) && k!=="icon") slim[k]=res[k]; }
  try{ return put(slim); }catch(_){}
  try{ localStorage.removeItem("lumos.launch.icons"); }catch(_){}
  try{ return put(slim); }catch(e){
    try{ console.error("[LumosCore launch] could not persist launch result:", e); }catch(_){}
    return false;
  }
}

function lxLpWireToken(){
  var fi=document.querySelector("#iconFileInput");
  if(fi){ fi.setAttribute("accept","image/png,image/jpeg,image/jpg,image/gif,image/webp,image/avif,image/svg+xml,.png,.jpg,.jpeg,.gif,.webp,.avif,.svg"); }
  if(fi && !fi.__lxWired){ fi.__lxWired=true; fi.addEventListener("change",function(){ var f=fi.files&&fi.files[0]; if(!f){window.__lxLpIcon="";window.__lxLpIconName="";lxLpPreviewIcon();lxLpPaintUpload();return;} if(f.size>10*1024*1024){window.__lxLpIcon="";window.__lxLpIconName="";lxLpPreviewIcon();lxLpPaintUpload();return;} window.__lxLpIconName=f.name||""; var rd=new FileReader(); rd.onload=function(){ lxLpShrinkIcon(rd.result, f.type||"", function(small){ window.__lxLpIcon=small; lxLpPreviewIcon(); lxLpPaintUpload(); }); }; rd.readAsDataURL(f); }); }
  // Extra XLM liquidity: numbers (and one decimal point) only — no minus sign, exponents, or letters
  var xl=document.querySelector("#extraLiquidity");
  if(xl && !xl.__lxNum){ xl.__lxNum=true; xl.setAttribute("inputmode","decimal"); xl.setAttribute("min","0");
    xl.addEventListener("keydown",function(e){ if(e.key==="-"||e.key==="+"||e.key==="e"||e.key==="E") e.preventDefault(); });
    xl.addEventListener("input",function(){ var c=String(xl.value).replace(/[^0-9.]/g,""); var p=c.split("."); if(p.length>2) c=p[0]+"."+p.slice(1).join(""); if(c!==xl.value) xl.value=c; });
    xl.addEventListener("paste",function(e){ setTimeout(function(){ xl.dispatchEvent(new Event("input",{bubbles:true})); },0); });
  }
  // Step-1 "Launch Cost" card: repaint with the fixed-$25 model (design ships static 34.70/69.40 ≈ old rate).
  // Live-updates as the user edits extra liquidity, and again when the CoinGecko price lands.
  (function(){ function pc(){ lxLpPaintCost(xl?xl.value:0); }
    if(xl && !xl.__lxCost){ xl.__lxCost=true; xl.addEventListener("input",pc); }
    pc(); lxLpOnPrice(pc); [200,600,1400].forEach(function(ms){ setTimeout(pc,ms); }); })();
  // Token NAME: hard limit 20 characters
  var nm=document.querySelector("#tokenName");
  if(nm && !nm.__lxMax){ nm.__lxMax=true; nm.setAttribute("maxlength","20");
    nm.addEventListener("input",function(){ if(nm.value.length>20){ nm.value=nm.value.slice(0,20); } });
    nm.addEventListener("paste",function(){ setTimeout(function(){ if(nm.value.length>20){ nm.value=nm.value.slice(0,20); nm.dispatchEvent(new Event("input",{bubbles:true})); } },0); });
  }
  // Project Type: no default selection. Clear the design's baked "meme" preselect on fresh load (keep it
  // if a saved draft has a projectType — lxLpPopulateForm re-applies that). Keep the .selected ring in sync on click.
  // #8: Project Type is gone from the form. It was a required choice between Meme and Utility that
  // nothing downstream acts on -- it is not written to the asset, not in the toml, not used to filter
  // anything (the Trade chips that read it have just been removed too). Asking for it made the launch
  // one step longer for a value with no consumer.
  //
  // Hidden rather than deleted: the review screen still walks these rows by label, and the draft format
  // still round-trips a projectType from an older saved draft. The field simply stops being asked for.
  (function(){
    // The phone ships this control as .type-stack and the desktop as .type-grid. Looking only for the
    // grid meant the field was hidden on one layout and left in place on the other.
    var g=document.querySelector(".type-grid, .type-stack");
    if(g){
      var lbl=g.previousElementSibling;
      if(lbl&&/project type/i.test(lbl.textContent||""))lbl.style.display="none";
      var fld=g.closest(".form-field,.field,.form-group");
      if(fld&&/project type/i.test(fld.textContent||""))fld.style.display="none"; else g.style.display="none";
    }
    // The design marks this field required, and its Continue handler is not ours -- so rather than risk
    // a hidden field blocking the form, satisfy it. "meme" is what the code already defaults to when
    // nothing is checked (see pt above), so this changes no recorded value, only whether a validator
    // can see a selection.
    try{ var _r=document.querySelector('input[name="ptype"][value="meme"]')||document.querySelector('input[name="ptype"]');
      if(_r&&!document.querySelector('input[name="ptype"]:checked'))_r.checked=true; }catch(_){}
    // ...and the row on the review screen, which would otherwise print a type nobody chose.
    [].forEach.call(document.querySelectorAll(".review-row,.rv-row,.lp-row"),function(r){
      if(/^s*project type/i.test((r.textContent||"")))r.style.display="none";
    });
  })();
  var _tg=document.querySelector(".type-grid, .type-stack");
  if(_tg && !_tg.__lxNoDef){ _tg.__lxNoDef=true;
    var _dft=null; try{ _dft=lxLpReadDraft(); }catch(_){}
    if(!(_dft && _dft.projectType)){
      [].forEach.call(_tg.querySelectorAll('input[name="ptype"]'),function(r){ r.checked=false; r.removeAttribute("checked"); });
      [].forEach.call(_tg.querySelectorAll(".type-card"),function(c){ c.classList.remove("selected"); });
    }
    [].forEach.call(_tg.querySelectorAll(".type-card"),function(c){ c.addEventListener("click",function(){ [].forEach.call(_tg.querySelectorAll(".type-card"),function(x){ x.classList.toggle("selected",x===c); }); var ri=c.querySelector('input[name="ptype"]'); if(ri){ ri.checked=true; } }); });
  }
  // Total SUPPLY: whole tokens only, comma-grouped, HARD max 10,000,000,000 (clamps even if more is typed/pasted)
  var sup=document.querySelector("#supply");
  if(sup && !sup.__lxCap){ sup.__lxCap=true; sup.setAttribute("inputmode","numeric");
    var LXLP_SUPPLY_MAX=10000000000, lxLpCapping=false;
    // Clamp + re-fire input so the design's live preview re-reads the CAPPED value (the design's own
    // input listener runs before ours and would otherwise show the pre-cap number).
    function lxLpCapSupply(){ if(lxLpCapping) return; var digits=String(sup.value).replace(/[^0-9]/g,""); var f; if(!digits){ f=""; } else { var n=parseInt(digits,10); if(!isFinite(n)||n<0) n=0; if(n>LXLP_SUPPLY_MAX) n=LXLP_SUPPLY_MAX; f=n.toLocaleString("en-US"); } if(sup.value!==f){ lxLpCapping=true; sup.value=f; sup.dispatchEvent(new Event("input",{bubbles:true})); lxLpCapping=false; } }
    sup.addEventListener("keydown",function(e){ if(e.key==="-"||e.key==="+"||e.key==="e"||e.key==="E"||e.key===".") e.preventDefault(); });
    sup.addEventListener("input",lxLpCapSupply);
    sup.addEventListener("paste",function(){ setTimeout(lxLpCapSupply,0); });
  }
  // preview icon: show placeholder/uploaded image instead of the design's ticker-letter monogram, and keep it applied
  lxLpPreviewIcon();
  var pi=document.querySelector(".preview-icon");
  if(pi && !pi.__lxObs){ pi.__lxObs=true; try{ new MutationObserver(function(){ if(!pi.querySelector('img[data-lxlp]')) lxLpPreviewIcon(); }).observe(pi,{childList:true,characterData:true,subtree:true}); }catch(_){} }
  // Repopulate the form from the saved draft ONLY when arriving via "Edit" on the review page.
  // A fresh entry (sidebar "Launchpad", "Launch another") starts blank and discards any old draft.
  if(!document.body.__lxLpPop){ document.body.__lxLpPop=true;
    var isEdit=false; try{ isEdit=sessionStorage.getItem("lumos.launch.edit")==="1"; }catch(_){}
    if(isEdit){ try{ sessionStorage.removeItem("lumos.launch.edit"); }catch(_){} setTimeout(lxLpPopulateForm, 180); }
    else { try{ localStorage.removeItem("lumos.launch.draft"); localStorage.removeItem("lumos.launch.result"); }catch(_){} window.__lxLpIcon=""; window.__lxLpIconName=""; setTimeout(lxLpClearForm, 60); setTimeout(lxLpClearForm, 220); }
  }
  var next=[].slice.call(document.querySelectorAll(".summary-cta")).filter(function(b){return /next/i.test(b.textContent||"");})[0];
  if(next && !next.__lxWired){ next.__lxWired=true; next.addEventListener("click",function(e){
    var d=lxLpCaptureDraft(); var supOk=parseFloat(String(d.supply||"").replace(/,/g,""))>0;
    if(!d.name||!d.ticker||!supOk){ e.stopPropagation(); e.preventDefault(); lxLpErr("Enter a token name, ticker, and total supply to continue."); }
    else lxLpErr("");
  },true); }
}
function lxLpFmt(n,dp){ n=Number(n); if(!isFinite(n))return "0"; return n.toLocaleString("en-US",{maximumFractionDigits:dp==null?0:dp}); }
// set via textContent for plain values (characterData mutation survives the confirm page's childList-revert guard); innerHTML only when the value has markup
function lxLpSetRow(re, html){ var out=null; var vs=document.querySelectorAll(".v"); for(var i=0;i<vs.length;i++){ var v=vs[i]; var k=(v.parentElement&&v.parentElement.querySelector)?v.parentElement.querySelector(".k"):null; if(!k) k=v.previousElementSibling; if(k&&re.test((k.textContent||"").replace(/\s+/g," ").trim())){ if(html!=null){ if(html.indexOf("<")<0){ if(v.textContent!==html){ v.textContent=html; v.classList.remove("empty"); } } else if(v.innerHTML!==html){ v.innerHTML=html; v.classList.remove("empty"); } } out=v; } } return out; }

// ---- launch progress overlay (theme-aware) ----
// NOTE: matcher takes the LAST matching step, so regexes must NOT overlap. "Creating issuer account"
// must map ONLY to step 0 — so the issue/mint step keys on "issuing/minting/supply/locking", never bare "issu"
// (which also matches "issuer"). Keep these mutually exclusive against every onStatus() string.
var LXLP_STEPS=[{k:"issuer",label:"Create issuer account",re:/issuer account|creating issuer|create issuer/i},{k:"trust",label:"Establish trustline",re:/trustline/i},{k:"issue",label:"Mint supply & lock issuer",re:/issuing|minting|supply|locking/i},{k:"pool",label:"Seed liquidity pool",re:/pool|seeding|liquidit/i}];
function lxLpProg(){ var el=document.getElementById("lxlp-prog"); if(!el){ el=document.createElement("div"); el.id="lxlp-prog"; el.className="lxlp-prog"; var items=LXLP_STEPS.map(function(s){return '<li data-pk="'+s.k+'"><span class="lxlp-dot"><span class="lxlp-spin"></span><span class="lxlp-tick">✓</span></span><span class="lxlp-lab">'+s.label+'</span></li>';}).join(""); el.innerHTML='<div class="lxlp-card"><div class="lxlp-h">Launching your token</div><div class="lxlp-sub">Approve the wallet prompts — everything else runs automatically.</div><ul class="lxlp-list">'+items+'</ul><div class="lxlp-msg"></div><button class="lxlp-x" type="button" hidden>Done</button></div>'; document.body.appendChild(el); el.querySelector(".lxlp-x").addEventListener("click",function(){ el.style.display="none"; if(el.__ok&&el.__next) location.href=el.__next; }); } return el; }
function lxLpProgShow(){ var el=lxLpProg(); el.style.display="flex"; el.__idx=-1; el.__ok=false; var x=el.querySelector(".lxlp-x"); x.hidden=true; x.textContent="Done"; el.querySelector(".lxlp-h").textContent="Launching your token"; var m=el.querySelector(".lxlp-msg"); m.textContent="Preparing…"; m.style.color=""; [].slice.call(el.querySelectorAll(".lxlp-list li")).forEach(function(li){ li.className=""; }); }
function lxLpProgUpdate(msg){ var el=lxLpProg(); el.querySelector(".lxlp-msg").textContent=msg; var idx=-1,i; for(i=0;i<LXLP_STEPS.length;i++){ if(LXLP_STEPS[i].re.test(msg)) idx=i; } if(idx<0||idx<(el.__idx||0))return; el.__idx=idx; var lis=el.querySelectorAll(".lxlp-list li"); for(i=0;i<lis.length;i++){ lis[i].className=i<idx?"done":(i===idx?"active":""); } }
function lxLpProgDone(nextUrl){ var el=lxLpProg(); el.__ok=true; el.__next=nextUrl; [].slice.call(el.querySelectorAll(".lxlp-list li")).forEach(function(li){ li.className="done"; }); el.querySelector(".lxlp-h").textContent="Token launched ✓"; var m=el.querySelector(".lxlp-msg"); m.textContent="Your token is live on Stellar. Opening the summary…"; el.querySelector(".lxlp-x").hidden=false; }
function lxLpProgFail(msg){ var el=lxLpProg(); el.querySelector(".lxlp-h").textContent="Launch failed"; var m=el.querySelector(".lxlp-msg"); m.textContent=msg||"Something went wrong."; m.style.color="#e5484d";
  var x=el.querySelector(".lxlp-x"); x.hidden=false; x.textContent="Close"; }

// Turn a raw launch error into a clean, user-facing message (no console references).
function lxLpFriendlyErr(e, lastMsg){
  var raw=((e&&(e.message||e.detail))||(typeof e==="string"?e:"")||"").toString().toLowerCase();
  var signing=/signature|signing/i.test(lastMsg||"");
  if(/reject|declin|denied|cancel|user did|not allowed|rejected/.test(raw)) return "Signature request was declined in your wallet.";
  if(/underfund|insufficient|op_underfunded/.test(raw)) return "Not enough XLM in your wallet to complete the launch.";
  // Connected wallet isn't activated on Stellar mainnet (needs a real XLM balance to exist on-chain).
  if(/not found on mainnet|account not found|mainnet:/i.test(raw)) return "Your wallet isn't funded on Stellar mainnet yet. Add some XLM to it (enough to cover the new issuer + liquidity + network fees) and try again.";
  if(/not (found|detected)|no address|unlock|install/.test(raw)) return "Wallet not available — unlock your Stellar wallet and try again.";
  // A wallet threw during / around a signature (some wallets, e.g. xBull, error out on parts of the
  // launch). Keep the message accurate to the step rather than always blaming liquidity-pool ops.
  if(signing || (raw==="error"||raw==="") ){
    if(/pool|liquidit|seeding/i.test(lastMsg||"")) return "Your wallet couldn't sign the liquidity-pool step — some wallets don't support pool operations yet. Freighter or Albedo work reliably for launching a token.";
    return "Your wallet couldn't complete the transaction. Freighter or Albedo work reliably for launching a token.";
  }
  var m=(e&&(e.message||e.detail))||"";
  return m || "Launch failed. Please try again, or use Freighter or Albedo.";
}
function lxLpConfirmLaunch(d){
  lxLpProgShow();
  var lastMsg="";
  window.lxLaunchToken(d, function(m){ lastMsg=m; lxLpProgUpdate(m); }).then(function(res){
    res.name=d.name; res.projectType=d.projectType; res.desc=d.desc; res.telegram=d.telegram; res.twitter=d.twitter; res.website=d.website; res.icon=d.icon; res.ts=Date.now();
    lxLpStoreResult(res);
    // persist the uploaded logo per-asset so the token's Asset-Overview page shows it (keyed CODE-ISSUER; keep last 12)
    try{ if(res.icon && res.code && res.issuer){ var im=JSON.parse(localStorage.getItem("lumos.launch.icons")||"{}"); im[res.code+"-"+res.issuer]=res.icon; var ks=Object.keys(im); if(ks.length>12) ks.slice(0,ks.length-12).forEach(function(k){ delete im[k]; }); localStorage.setItem("lumos.launch.icons", JSON.stringify(im)); } }catch(_){}
    lxLpProgDone("lumoscore-launch-confirm.html");
  }).catch(function(e){
    try{ console.error("[LumosCore launch] FAILED:", e, e&&e.stack); }catch(_){}
    lxLpProgFail(lxLpFriendlyErr(e, lastMsg));
  });
}

function lxLpWireReview(){
  if(document.body.__lxLpRev) return; var d=lxLpReadDraft(); if(!d||!d.name) return; document.body.__lxLpRev=true;
  try{ lxLpSdk(); }catch(_){} // pre-warm the Stellar SDK so the launch signature fires with minimal delay (keeps the click gesture alive for web wallets)
  var C=window.__lxLP, CODE=lxLpCode(d.ticker), supply=parseFloat(String(d.supply||"").replace(/,/g,""))||0, share=Math.max(0,Math.min(30,parseFloat(d.sharePct)||10));
  var keep=supply*share/100, lp=supply*(100-share)/100, extra=Math.max(0, parseFloat(String(d.extraXlm||"0").replace(/,/g,""))||0);
  var typeName=d.projectType==="utility"?"Utility Project":"Meme Project", dim='<span style="opacity:.55">';
  var hn=document.querySelector(".hero-name"); if(hn) hn.textContent=d.name;
  var hb=document.querySelector(".hero-type-badge"); if(hb) hb.textContent=typeName;
  var hd=document.querySelector(".hero-desc"); if(hd) hd.textContent=d.desc||"No description provided.";
  // hero icon: uploaded logo, else neutral placeholder (never the baked Stellar native logo)
  var hi=document.querySelector(".hero-icon img"); if(hi) hi.src=d.icon||LXLP_PH;
  // .hero-ticker is the design's monospace ticker PILL. The multichain re-skin was converting its "$APT" text
  // into a stamped Stellar logo (data-logo) — a tiny broken sliver. data-lx-noswap makes the re-skin skip it.
  var ht=document.querySelector(".hero-ticker"); if(ht){ ht.setAttribute("data-lx-noswap","1"); ht.removeAttribute("data-logo"); ht.style.removeProperty("background"); ht.style.removeProperty("background-image"); ht.textContent="$"+CODE; }
  // ICON detail row: replace the orange monogram box with the uploaded logo (or placeholder)
  var iconRow=[].slice.call(document.querySelectorAll(".detail-row")).filter(function(rw){ var k=rw.querySelector(".k"); return k && /^icon$/i.test((k.textContent||"").replace(/\s+/g," ").trim()); })[0];
  if(iconRow){ var mono=iconRow.querySelector(".v > div"); if(mono){ mono.style.cssText="width:36px;height:36px;border-radius:10px;overflow:hidden;display:block;background:var(--surface,#fff);border:1px solid var(--border,#e6e8ee)"; mono.innerHTML=lxLpImgTag(d.icon||LXLP_PH); } }
  // Paying from: show the Stellar network logo (not the RR identicon), as a fixed round avatar
  // (the original box was a shrinking rounded-square, which looked lopsided next to the circular logo).
  var av=document.querySelector(".wallet-info .av"); if(av){ av.style.cssText="width:34px;height:34px;flex:0 0 34px;border-radius:50%;overflow:hidden;background:transparent;color:transparent;display:block;padding:0"; av.innerHTML=lxLpImgTag(LXLP_XLM); }
  var pfAddr=document.querySelector(".wallet-info .addr"); var pfReal=localStorage.getItem("lumos.address"); if(pfAddr){ if(pfReal) pfAddr.textContent=lxLpShort(pfReal); pfAddr.style.whiteSpace="nowrap"; }
  // Editing means returning to step 1 with the form intact — flag it so the token page repopulates
  // (a fresh entry via the sidebar or "Launch another" leaves no flag and starts blank).
  [].slice.call(document.querySelectorAll('a[href*="launch-token"]')).forEach(function(a){ if(a.__lxEd) return; a.__lxEd=true; a.addEventListener("click",function(){ try{ sessionStorage.setItem("lumos.launch.edit","1"); }catch(_){} }); });
  lxLpSetRow(/^Token Name/i, d.name);
  lxLpSetRow(/^Ticker/i, "$"+CODE);
  lxLpSetRow(/^Project Type/i, typeName);
  lxLpSetRow(/^Description/i, d.desc||"Not provided");
  lxLpSetRow(/^Telegram/i, d.telegram||"Not provided");
  lxLpSetRow(/Twitter|^X\b/i, d.twitter||"Not provided");
  lxLpSetRow(/^Website/i, d.website||"Not provided");
  lxLpSetRow(/^Total Supply/i, lxLpFmt(supply)+" "+CODE);
  lxLpSetRow(/^Your Share/i, share+"% "+dim+"("+lxLpFmt(keep)+" "+CODE+")</span>");
  lxLpSetRow(/Liquidity Pool Share/i, (100-share)+"% "+dim+"("+lxLpFmt(lp)+" "+CODE+")</span>");
  lxLpSetRow(/Issuer Locked/i, "Yes — supply is fixed");
  lxLpSetRow(/^Extra /i, extra>0?(lxLpFmt(extra,2)+" XLM added"):"None — using default liquidity only");
  function paintCost(){ lxLpPaintCost(extra); }
  paintCost(); lxLpOnPrice(paintCost);
  var btn=[].slice.call(document.querySelectorAll("a.btn-primary,button.btn-primary,.btn.btn-primary")).filter(function(b){return /confirm.{0,3}launch/i.test((b.textContent||"").replace(/\s+/g," "));})[0];
  // Affordability gate: don't let the user reach a mid-launch op_underfunded. Compare the wallet's XLM
  // balance against what the launch actually needs — total cost + the 2 new trustline reserves (asset + pool,
  // 0.5 XLM each) + the account's existing minimum balance + a small tx-fee margin.
  var balKnown=false, underfunded=false, notOnTestnet=false;
  function lxLpRevErr(msg){ if(!btn) return; var el=document.getElementById("lx-lp-rev-err"); if(!el){ el=document.createElement("div"); el.id="lx-lp-rev-err"; el.style.cssText="color:#e5484d;font-size:12.5px;font-weight:600;line-height:1.5;text-align:center;width:100%;box-sizing:border-box;margin:12px 0 0;padding:10px 12px;border:1px solid rgba(229,72,77,.35);border-radius:10px;background:rgba(229,72,77,.08)"; var row=btn.closest(".actions-row")||btn.parentNode; (row.parentNode||row).insertBefore(el, row.nextSibling); } el.textContent=msg||""; el.style.display=msg?"block":"none"; }
  function lxLpSetBtnEnabled(on){ if(!btn) return; if(on){ btn.style.removeProperty("opacity"); btn.style.removeProperty("filter"); btn.style.pointerEvents=""; btn.style.cursor=""; btn.removeAttribute("aria-disabled"); } else { btn.style.setProperty("opacity","0.45","important"); btn.style.setProperty("filter","grayscale(0.4)","important"); btn.style.pointerEvents="none"; btn.style.cursor="not-allowed"; btn.setAttribute("aria-disabled","true"); } }
  var addr=localStorage.getItem("lumos.address");
  var TESTNET_MSG="This wallet isn't funded on Stellar mainnet yet. Add XLM to it (enough for the new issuer + liquidity + network fees) and try again.";
  if(addr){ fetch(C.horizon+"/accounts/"+addr).then(function(r){ if(r.status===404){ var e404=new Error("NOTESTNET"); e404.code="NOTESTNET"; throw e404; } if(!r.ok) throw 0; return r.json(); }).then(function(a){
    var nb=(a.balances||[]).filter(function(b){return b.asset_type==="native";})[0]; if(!nb) return;
    var bal=parseFloat(nb.balance)||0;
    var be=[].slice.call(document.querySelectorAll("[class*='balance']")).filter(function(e){return /balance/i.test(e.textContent||"");})[0]; if(be) be.textContent="Balance "+lxLpFmt(bal,2)+" XLM";
    var _k=lxLpCosts(), total=_k.createFeeXlm+_k.poolFeeXlm+_k.liqXlm+extra; // XLM cost sized to the $25 target at live rate
    var curMin=(2+(a.subentry_count||0))*0.5, required=curMin+total+1.0+0.6+parseFloat(C.issuerFundXlm||"2"); // +1.0 = 2 new trustlines, +0.6 = fees/margin, +issuerFund = funding the new mainnet issuer account
    balKnown=true; underfunded=(bal<required);
    if(underfunded){ lxLpSetBtnEnabled(false); lxLpRevErr("Not enough XLM to launch. You need about "+lxLpFmt(required,2)+" XLM (this wallet holds "+lxLpFmt(bal,2)+" XLM). Add funds"+(extra>0?" or lower the extra liquidity":"")+" and try again."); }
    else { lxLpSetBtnEnabled(true); lxLpRevErr(""); }
  }).catch(function(e){ if(e&&e.code==="NOTESTNET"){ notOnTestnet=true; lxLpSetBtnEnabled(false); lxLpRevErr(TESTNET_MSG); } }); }
  if(btn) btn.addEventListener("click",function(e){ e.preventDefault(); e.stopPropagation();
    if(notOnTestnet){ lxLpRevErr(TESTNET_MSG); return; }
    if(balKnown&&underfunded){ lxLpRevErr(document.getElementById("lx-lp-rev-err")?document.getElementById("lx-lp-rev-err").textContent:"Not enough XLM to launch — add funds and try again."); return; }
    lxLpConfirmLaunch(d); },true);
  // The design re-renders the Description row after load (a read-more/truncation pass) that clobbers our
  // value, and label-regex matching is unreliable on it — so target the row's .v DIRECTLY (whitespace-tolerant
  // label match) and re-apply on a bounded poll until the entered description sticks.
  var wantDesc=d.desc||"Not provided";
  function lxLpDescV(){ var rows=document.querySelectorAll(".detail-row"); for(var i=0;i<rows.length;i++){ var k=rows[i].querySelector(".k"); if(k && /de.{0,3}cription/i.test((k.textContent||"").replace(/\s+/g,""))) return rows[i].querySelector(".v"); } return null; }
  function lxLpApplyDesc(){ var v=lxLpDescV(); if(v && v.textContent!==wantDesc) v.textContent=wantDesc; var hd=document.querySelector(".hero-desc"); if(hd && d.desc && hd.textContent!==d.desc) hd.textContent=d.desc; return v; }
  lxLpApplyDesc();
  var _dn=0, _div=setInterval(function(){ _dn++; var v=lxLpApplyDesc(); if((v && (v.textContent||"")===wantDesc && _dn>=6) || _dn>32) clearInterval(_div); },250);
}
function lxLpShort(a){ return a&&a.length>10?a.slice(0,5)+"…"+a.slice(-4):(a||""); }
function lxLpToast(msg){ var t=document.getElementById("lxlp-toast"); if(!t){ t=document.createElement("div"); t.id="lxlp-toast"; t.style.cssText="position:fixed;left:50%;bottom:34px;transform:translateX(-50%) translateY(10px);background:#0e0e10;color:#fff;padding:10px 16px;border-radius:10px;font-size:13.5px;font-weight:600;z-index:100000;box-shadow:0 10px 30px rgba(0,0,0,.35);opacity:0;transition:opacity .2s,transform .2s;pointer-events:none"; document.body.appendChild(t); } t.textContent=msg; void t.offsetHeight; t.style.opacity="1"; t.style.transform="translateX(-50%) translateY(0)"; clearTimeout(t.__h); t.__h=setTimeout(function(){ t.style.opacity="0"; t.style.transform="translateX(-50%) translateY(10px)"; },1500); }
function lxLpCopyToast(){ if(window.showToast){ try{ window.showToast("Copied to clipboard"); return; }catch(_){} } lxLpToast("Copied to clipboard"); }
function lxLpCopyCell(el, full){ if(!el||el.__lxCopy||!full) return; el.__lxCopy=true; el.style.cursor="pointer"; el.setAttribute("title","Click to copy"); el.addEventListener("click",function(){ try{ navigator.clipboard.writeText(full); }catch(_){} lxLpCopyToast(); }); }
function lxLpWireConfirm(){
  var r; try{ r=JSON.parse(localStorage.getItem("lumos.launch.result")||"null"); }catch(_){ r=null; }
  if(!r||!r.code) return;
  var CODE=r.code, supply=parseFloat(r.supply)||0, share=Math.max(0,Math.min(30,parseFloat(r.sharePct)||10)), keep=supply*share/100, lp=supply*(100-share)/100;
  var EXP="https://stellar.expert/explorer/public";
  var d0=new Date(r.ts||Date.now());
  function pad(x){ return (x<10?"0":"")+x; } function hms(d){ return pad(d.getUTCHours())+":"+pad(d.getUTCMinutes())+":"+pad(d.getUTCSeconds()); }
  var MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function full(d){ return MON[d.getUTCMonth()]+" "+d.getUTCDate()+", "+d.getUTCFullYear()+" · "+hms(d)+" UTC"; }
  function tOff(sec){ return new Date(d0.getTime()+sec*1000); }
  function txt(el,s){ if(el&&el.textContent!==s) el.textContent=s; }
  var TL=[
    {t:"Transaction signed", d:'Approved with Stellar wallet <span class="mono-mini">'+lxLpShort(r.distributor)+'</span>', s:0},
    {t:"Asset issued on Stellar", d:'Token '+CODE+' created with issuer locked. Supply: '+lxLpFmt(supply)+' '+CODE+'.', s:3},
    {t:"Liquidity pool created", d:'XLM/'+CODE+' pool seeded with '+lxLpFmt(lp)+' '+CODE+' · '+(r.liqXlm||0)+' XLM.', s:6},
    {t:"Listed on DEX", d:'Your token is now discoverable and tradeable.', s:8}
  ];
  // idempotent paint (only writes when a value actually differs) — safe to re-run from a MutationObserver
  function paint(){
    txt(document.querySelector(".result-name"), r.name||CODE);
    txt(document.querySelector(".result-meta .addr"), lxLpShort(r.issuer));
    var ci=document.querySelector(".result-icon img")||document.querySelector(".result-top img")||document.querySelector(".hero-icon img");
    // r.icon is dropped from the stored result if it would not fit the quota (lxLpStoreResult), so fall
    // back to the per-asset icon map before the placeholder.
    var iconSrc=r.icon; if(!iconSrc && r.issuer){ try{ iconSrc=(JSON.parse(localStorage.getItem("lumos.launch.icons")||"{}"))[CODE+"-"+r.issuer]||""; }catch(_){} }
    iconSrc=iconSrc||LXLP_PH; if(ci&&ci.getAttribute("src")!==iconSrc) ci.src=iconSrc;
    var stats=document.querySelectorAll(".result-stats .stat");
    if(stats[0]){ txt(stats[0].querySelector(".val"),lxLpFmt(supply)); txt(stats[0].querySelector(".sub"),CODE); }
    if(stats[1]){ txt(stats[1].querySelector(".val"),lxLpFmt(keep)); txt(stats[1].querySelector(".sub"),share+"% of supply"); }
    if(stats[2]){ txt(stats[2].querySelector(".val"),lxLpFmt(lp)); txt(stats[2].querySelector(".sub"),"in XLM/"+CODE+" pool"); }
    var steps=document.querySelectorAll(".tl-step");
    for(var i=0;i<steps.length && i<TL.length;i++){ var ttl=steps[i].querySelector(".ttl"), desc=steps[i].querySelector(".desc"); var th=TL[i].t+'<span class="time">'+hms(tOff(TL[i].s))+'</span>'; if(ttl&&ttl.innerHTML!==th) ttl.innerHTML=th; if(desc&&desc.innerHTML!==TL[i].d) desc.innerHTML=TL[i].d; }
    // Transaction Details rows. The design animates the LABELS with a per-letter reveal
    // (the "s" glyphs are blank for the first several seconds), so label-text matching is
    // unreliable during that window. The rows are in a fixed template order, so set by index;
    // fall back to label matching only if the row count is unexpected.
    var txVals=[lxLpShort(r.mintHash), CODE, lxLpShort(r.issuer), ((r.feeXlm||0)+(r.liqXlm||0)).toFixed(2)+" XLM", lxLpFmt(r.ledger), full(d0)];
    var txv=document.querySelectorAll(".tx-row .v");
    if(txv.length===txVals.length){
      for(var ti=0;ti<txv.length;ti++){ if(txv[ti].textContent!==txVals[ti]){ txv[ti].textContent=txVals[ti]; txv[ti].classList.remove("empty"); } }
      // click-to-copy the FULL transaction hash (row 0) and asset issuer (row 2), with toast feedback
      lxLpCopyCell(txv[0], r.mintHash); lxLpCopyCell(txv[2], r.issuer);
    } else {
      lxLpSetRow(/Transaction hash/i, txVals[0]); lxLpSetRow(/Asset code/i, txVals[1]); lxLpSetRow(/Asset issuer/i, txVals[2]);
      lxLpSetRow(/Total paid/i, txVals[3]); lxLpSetRow(/^Block/i, txVals[4]); lxLpSetRow(/Timestamp/i, txVals[5]);
    }
    [].slice.call(document.querySelectorAll("a")).forEach(function(x){ var t=(x.textContent||"");
      if(/explorer/i.test(t)){ var href=EXP+"/asset/"+CODE+"-"+r.issuer; if(x.getAttribute("href")!==href){ x.setAttribute("href",href); x.setAttribute("target","_blank"); x.setAttribute("rel","noopener"); } txt(x,"View on Stellar Explorer"); }
      // The design ships this CTA pointing at /trade/stellar -- the Trade section index, with no asset --
      // so even a correctly painted card sent the minter to a generic page. Point it at the token they
      // just launched. Two elements carry this label (.result-cta and the .action-btn below it).
      else if(t.indexOf("($")>=0 || /Token Page/i.test(t)){
        txt(x,"View "+(r.name||CODE)+" ($"+CODE+") Token Page");
        if(r.issuer){ var tp="/trade/stellar/"+CODE+"-"+r.issuer; if(x.getAttribute("href")!==tp) x.setAttribute("href",tp); }
      }
    });
  }
  paint();
  // Second chance for the details POST. lxLaunchToken waits up to 20s for it, but a slow upload, a dropped
  // connection or a closed tab can still leave the token published on-chain with nothing in the toml --
  // which is exactly how BOMB ended up minted but invisible. The draft (logo included) outlives the
  // navigation, so this page can simply send it again; the endpoint re-verifies the mint on chain and the
  // merge is idempotent, so a duplicate submission is harmless.
  if(!document.body.__lxLpMetaRetry){ document.body.__lxLpMetaRetry=true;
    var mk=""; try{ mk=localStorage.getItem("lumos.launch.metaok")||""; }catch(_){}
    if(mk!==lxLpMetaKey(r)) { try{ lxLpSaveMeta(r); }catch(_){} }
  }
  if(!document.body.__lxLpObs){ document.body.__lxLpObs=true;
    // The design reveals the tx-detail labels with a per-letter animation, and may re-render
    // rows after load; keep a persistent observer + a bounded poll re-applying the idempotent
    // paint until the Asset-code cell (index 1) holds our value.
    try{ new MutationObserver(function(){ paint(); }).observe(document.body,{childList:true,subtree:true,characterData:true}); }catch(_){}
    var _n=0, _iv=setInterval(function(){ _n++; paint(); var cv=document.querySelectorAll(".tx-row .v")[1]; if((cv&&(cv.textContent||"").trim()===CODE) || _n>75) clearInterval(_iv); },400);
  }
  // Share: the design wires share URLs at modal-open time with a hardcoded "Aptos Coin ($APT)" caption.
  // Override each share link on click (capture phase) with the real launched token, and copy the same text.
  if(!document.body.__lxLpShare){ document.body.__lxLpShare=true;
    var shareText="Just launched "+(r.name||CODE)+" ($"+CODE+") on LumosCore — check it out!";
    var pageUrl=location.href;
    function endp(p){ var u=encodeURIComponent(pageUrl), t=encodeURIComponent(shareText); var m={
      x:"https://twitter.com/intent/tweet?text="+t+"&url="+u,
      twitter:"https://twitter.com/intent/tweet?text="+t+"&url="+u,
      telegram:"https://t.me/share/url?url="+u+"&text="+t,
      whatsapp:"https://wa.me/?text="+t+"%20"+u,
      reddit:"https://www.reddit.com/submit?url="+u+"&title="+t,
      linkedin:"https://www.linkedin.com/sharing/share-offsite/?url="+u,
      facebook:"https://www.facebook.com/sharer/sharer.php?u="+u }; return m[p]; }
    function doCopy(el){ try{ navigator.clipboard.writeText(shareText+" "+pageUrl); }catch(_){} var lab=el.querySelector("span")||el; var old=lab.textContent; lab.textContent="Copied!"; setTimeout(function(){ lab.textContent=old; },1400); }
    document.addEventListener("click",function(e){
      var t=e.target; if(!t||!t.closest) return;
      var plat=t.closest("[data-platform]");
      if(plat){ var p=plat.getAttribute("data-platform"); if(/copy/i.test(p)){ e.preventDefault(); doCopy(plat); return; } var href=endp(p); if(href){ plat.setAttribute("href",href); plat.setAttribute("target","_blank"); plat.setAttribute("rel","noopener"); } return; }
      var tile=t.closest(".share-tile"); if(tile && /copy/i.test((tile.textContent||""))){ e.preventDefault(); doCopy(tile); }
    },true);
    // Best-effort embedded preview when the confirm page is hosted publicly (WhatsApp/X scrape these).
    function meta(prop,val){ var m=document.head.querySelector('meta[property="'+prop+'"]'); if(!m){ m=document.createElement("meta"); m.setAttribute("property",prop); document.head.appendChild(m); } m.setAttribute("content",val); }
    meta("og:title",(r.name||CODE)+" ($"+CODE+") on LumosCore");
    meta("og:description",(r.desc||("A new token launched on LumosCore.")).slice(0,160));
    if(r.icon){ meta("og:image",r.icon); }
    var dt=document.querySelector('meta[name="twitter:card"]'); if(!dt){ dt=document.createElement("meta"); dt.setAttribute("name","twitter:card"); dt.setAttribute("content","summary_large_image"); document.head.appendChild(dt); }
  }
}

(function(){
  // The gate matched the FILE names -- lumoscore-launch-token and friends -- but those are what Pages
  // rewrites TO. _redirects maps /launchpad, /launchpad/review and /launchpad/confirm with a 200, so the
  // address bar keeps the clean URL and location.pathname never contains "launch-token". The result was
  // that none of this file ran on the hosted site: measured on /launchpad, the icon input still carried
  // the design's own accept list and #extraLiquidity had no __lxNum marker, i.e. lxLpWireToken() had not
  // executed at all. Both spellings are accepted so opening a dist file directly still works.
  //
  // Review and confirm are tested first: their clean URLs start with /launchpad, so a token-page test
  // that merely looked for "launchpad" would swallow them.
  function run(){
    var p=(location.pathname||location.href).toLowerCase().split("?")[0].split("#")[0];
    if(p.length>1&&p.charAt(p.length-1)==="/") p=p.slice(0,-1);
    if(p.indexOf("launch-review")>=0||p.indexOf("/launchpad/review")>=0) lxLpWireReview();
    else if(p.indexOf("launch-confirm")>=0||p.indexOf("/launchpad/confirm")>=0) lxLpWireConfirm();
    else if(p.indexOf("launch-token")>=0||p.slice(-9)==="launchpad") lxLpWireToken();
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",run); else run();
  var nn=0,iv=setInterval(function(){ nn++; run(); if(nn>20) clearInterval(iv); },300);
})();

// self-contained TESTNET verification (no Freighter): funds a throwaway distributor via friendbot and runs the whole flow.
window.lxLpTest=function(draft){
  draft=draft||{ticker:"TESTX",supply:"1000000000",sharePct:10,extraXlm:0};
  return lxLpSdk().then(function(S){
    var dist=S.Keypair.random();
    return fetch(window.__lxLP.friendbot+"?addr="+dist.publicKey()).then(function(r){return r.json();}).then(function(){
      return new Promise(function(res){setTimeout(res,1500);});
    }).then(function(){
      return window.lxLaunchToken(draft, function(m){ console.log("[lxLpTest]",m); }, {distSigner:dist});
    }).then(function(result){ console.log("[lxLpTest] RESULT", result); return {distributor:dist.publicKey(), result:result}; });
  });
};
})();`;

const SCRIPT='<script id="lx-lp-js">'+BODY+'<'+'/script>';

let n=0, pages=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain','stellar','xrpl']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      if(!/launch-(token|review|confirm)/.test(k)) continue;
      let h=json[k]; const before=h;
      h=h.replace(/<style id="lx-lp-css">[\s\S]*?<\/style>/g,'').replace(/<script id="lx-lp-js">[\s\S]*?<\/script>/g,'');
      // AUDIT FIX: the crumb bakes TWO consecutive "/" separators ("Home / / Create Token") — a middle
      // segment was removed upstream but its separator stayed. Collapse doubled seps (idempotent).
      h=h.replace(/(<span class="sep">\/<\/span>)\s*<span class="sep">\/<\/span>/g,'$1');
      if(h.indexOf('</head>')>=0) h=h.replace('</head>',CSS+'</head>');
      const bi=h.lastIndexOf('</body>'); if(bi>=0) h=h.slice(0,bi)+SCRIPT+h.slice(bi);
      if(h!==before){ json[k]=h; pages++; }
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
    n++;
  }
}
console.log('Launchpad phase-1 (Stellar issuance engine) injected on '+pages+' launch-page keys across '+n+' containers');
