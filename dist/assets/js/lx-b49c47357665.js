(function(){
try{ document.title="Bridge USDC and USDT0 across 16 chains | LumosCore"; }catch(_){}   /* baked title said "DEX" */
try{ window.__lxCCTP={
  testnet:false, sourceDomain:27,
  tokenMessenger:"CAE2G5Z77UP7GYPYGFOWFGW7C7J6I4YP2AFGSADRKQY62SYUFLPNFTXL",
  messageTransmitter:"CACMENFFJPJMSDAJQLX4R7K3SFZIW2LJSE3R2UMLGSWHFHS353FVXAZV",
  usdc:"CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
  usdcIssuer:"GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  rpc:"https://mainnet.sorobanrpc.com",
  passphrase:"Public Global Stellar Network ; September 2015",
  decimals:7, iris:"https://iris-api.circle.com",
  horizon:"https://horizon.stellar.org",
  feeCollector:"GAMZFXIJD5E3PNRFCG6VPXCJNUOZAP5BY2P3MU3ZXXUSVM2UY5P6LJKD", feeRate:0.002,
  domains:{"Ethereum":0,"Avalanche":1,"Optimism":2,"Arbitrum":3,"Base":6,"Polygon":7,"Linea":11,"World Chain":14}, chains:["Ethereum","Avalanche","Optimism","Arbitrum","Base","Polygon","Linea","World Chain"]
}; }catch(_){}

var _sdkP=null;
function lxCctpSdk(){
  if(window.StellarSdk) return Promise.resolve(window.StellarSdk);
  if(_sdkP) return _sdkP;
  _sdkP=new Promise(function(res,rej){
    var s=document.createElement("script");
    s.src="/assets/vendor/stellar-sdk-13.3.0.min.js";
    s.onload=function(){ window.StellarSdk?res(window.StellarSdk):rej(new Error("Stellar SDK failed to load")); };
    s.onerror=function(){ rej(new Error("Stellar SDK failed to load")); };
    document.head.appendChild(s);
  });
  return _sdkP;
}
// resolve a working Freighter API (injected global, else the official library)
function lxFreighter(){
  if(window.freighterApi&&window.freighterApi.signTransaction) return Promise.resolve(window.freighterApi);
  return import("https://esm.sh/@stellar/freighter-api@6").then(function(m){
    var f=m.default||m;
    if(!f||!f.signTransaction) throw new Error("Freighter not found. Install the Freighter extension and switch it to Mainnet.");
    return f;
  }).catch(function(e){ throw new Error("Freighter not available. Make sure the Freighter extension is installed, unlocked, and set to Mainnet. ("+(e&&e.message||e)+")"); });
}
// --- multi-wallet signing: sign with WHICHEVER Stellar wallet is connected, not just Freighter ---
function lxCctpWalletId(){ try{ return (localStorage.getItem("lumos.wallet")||"").toLowerCase().replace(/[^a-z]/g,""); }catch(_){ return ""; } }
function lxCctpConnectedAddr(){ try{ return localStorage.getItem("lumos.address")||""; }catch(_){ return ""; } }
var _cctpMods={}; function lxCctpMod(u){ return _cctpMods[u]||(_cctpMods[u]=import(u)); }
function lxCctpSignXdr(xdr, addr){
  var C=window.__lxCCTP, w=lxCctpWalletId(), pass=C.passphrase;
  if(w==="albedo"){ return lxCctpMod("https://esm.sh/@albedo-link/intent@0.12.0").then(function(m){ var al=m.default||m.albedo||m; if(!al||!al.tx) throw new Error("Albedo SDK failed to load"); return al.tx({xdr:xdr, network:"public", pubkey:addr, submit:false}); })
    .then(function(r){ var s=r&&(r.signed_envelope_xdr||r.xdr); if(!s) throw new Error("Albedo did not return a signed transaction"); return s; }); }
  if(w==="rabet"){ if(!window.rabet||!window.rabet.sign) return Promise.reject(new Error("Rabet not found. Unlock the Rabet extension and retry.")); return Promise.resolve(window.rabet.sign(xdr,"mainnet")).then(function(r){ if(r&&r.error) throw new Error((r.error&&r.error.message)||r.error); var s=r&&(r.xdr||r.signedXDR); if(!s) throw new Error("Rabet did not return a signed transaction"); return s; }); }
  // A phone has no LOBSTR extension — that session signs over WalletConnect instead. Only true when
  // the connect step recorded transport=wc, so extension sessions still take the line below.
  if((w==="lobstr"||w==="walletconnect")&&window.__lxWcActive&&window.__lxWcActive()) return window.__lxWcSign(xdr,pass);
  if(w==="lobstr"){ return lxCctpMod("https://esm.sh/@lobstrco/signer-extension-api").then(function(m){ var sign=m.signTransaction||(m.default&&m.default.signTransaction); if(!sign) throw new Error("LOBSTR API unavailable"); return sign(xdr); }).then(function(s){ if(!s||typeof s!=="string") throw new Error("LOBSTR couldn't sign — unlock the LOBSTR extension, make sure it's connected and set to Mainnet, then retry."); return s; }); }
  // WalletConnect signing isn't wired yet — don't silently fall through to Freighter (wrong account).
  if(w==="walletconnect") return Promise.reject(new Error("WalletConnect signing isn't enabled yet. Reconnect with Freighter, Albedo, Rabet or LOBSTR."));
  return lxFreighter().then(function(f){ return Promise.resolve(f.signTransaction(xdr,{networkPassphrase:pass,network:"PUBLIC",address:addr})); })
    .then(function(sig){ var s=(sig&&(sig.signedTxXdr||sig.signedXDR))||sig; if((sig&&sig.error)||typeof s!=="string") throw new Error("Signing cancelled."); return s; });
}
// Return a Freighter-API-compatible object for the connected wallet. For non-Freighter wallets a shim
// implements the same methods the engine calls (signTransaction/getAddress/requestAccess/getNetworkDetails),
// so the rest of the flow is untouched. Freighter users get the real API exactly as before.
function lxCctpSigner(){
  var w=lxCctpWalletId(), addr=lxCctpConnectedAddr(), pass=(window.__lxCCTP||{}).passphrase;
  if(w && w!=="freighter" && addr && addr.charAt(0)==="G"){
    return Promise.resolve({ __wallet:w,
      requestAccess:function(){ return Promise.resolve(addr); },
      isAllowed:function(){ return Promise.resolve(true); },
      getAddress:function(){ return Promise.resolve({address:addr}); },
      getPublicKey:function(){ return Promise.resolve(addr); },
      getNetworkDetails:function(){ return Promise.resolve({networkPassphrase:pass}); },
      getNetwork:function(){ return Promise.resolve({networkPassphrase:pass}); },
      signTransaction:function(xdr,opts){ return lxCctpSignXdr(xdr,(opts&&opts.address)||addr).then(function(s){ return {signedTxXdr:s}; }); }
    });
  }
  return lxFreighter();
}
function lxHexBytes(h){ h=String(h).replace(/^0x/i,""); var u=new Uint8Array(h.length/2); for(var i=0;i<u.length;i++)u[i]=parseInt(h.substr(i*2,2),16); return u; }
function lxB58(s){
  var A="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz", bytes=[0];
  for(var i=0;i<s.length;i++){ var c=A.indexOf(s.charAt(i)); if(c<0) throw new Error("Invalid Solana address"); var carry=c;
    for(var j=0;j<bytes.length;j++){ carry+=bytes[j]*58; bytes[j]=carry&255; carry=carry>>8; }
    while(carry){ bytes.push(carry&255); carry=carry>>8; } }
  for(var k=0;k<s.length&&s.charAt(k)==="1";k++) bytes.push(0);
  return new Uint8Array(bytes.reverse());
}
function lxMintRecipient(S,domain,addr){
  addr=(addr||"").trim(); var out=new Uint8Array(32);
  if(domain===5){ var b=lxB58(addr); if(b.length!==32) throw new Error("Invalid Solana address"); out.set(b,0); }
  else if(domain===8){ if(!/^0x[0-9a-fA-F]{64}$/.test(addr)) throw new Error("Invalid Sui address (0x + 64 hex)"); out.set(lxHexBytes(addr),0); }
  else { if(!/^0x[0-9a-fA-F]{40}$/.test(addr)) throw new Error("Invalid EVM address (0x + 40 hex)"); out.set(lxHexBytes(addr),12); }
  return S.xdr.ScVal.scvBytes(out);
}
function lxUnits(human){ var n=parseFloat(String(human).replace(/,/g,"")); if(!(n>0)) throw new Error("Enter a valid amount"); return String(Math.round(n*1e7)); }

// map raw CCTP TokenMessengerMinter contract errors to friendly messages
function lxCctpErrMap(raw){
  raw=String(raw||""); var m=raw.match(/#(7[0-9]{3})/); var code=m?m[1]:"";
  var MAP={
    "7106":"This destination isn't enabled on CCTP yet. Try Ethereum, Base, Arbitrum, Optimism, Polygon, Avalanche or Linea.",
    "7110":"This destination isn't registered on CCTP yet — pick another network.",
    "7103":"That destination address looks invalid for this network.",
    "7104":"Fee configuration error for this amount.",
    "7113":"The fee would exceed the amount — try a larger amount.",
    "7118":"Amount is too small to bridge — try a larger amount.",
    "7116":"This route's finality setting isn't supported on mainnet."
  };
  if(MAP[code]) return MAP[code];
  if(/allowance|Error(Contract, ?#9)/.test(raw)) return "USDC spend approval is needed — please retry.";
  return "Bridge simulation failed"+(code?(" (contract error "+code+")"):"")+". Try a different network or amount.";
}
// approve(USDC -> TokenMessenger) if needed, then deposit_for_burn. Returns {approveHash?, hash, status}.
function lxCctpBurn(destDomain, amountHuman, recipient, onStatus){
  var C=window.__lxCCTP; onStatus=onStatus||function(){};
  destDomain=parseInt(destDomain,10);
  return lxCctpSdk().then(function(S){
    var server=new S.rpc.Server(C.rpc), units, pk, result={};
    onStatus("Connecting wallet…");
    return lxCctpSigner().then(function(f){
      function buildSim(op,fee){ return server.getAccount(pk).then(function(acct){
        var tx=new S.TransactionBuilder(acct,{fee:fee||"10000000",networkPassphrase:C.passphrase}).addOperation(op).setTimeout(300).build();
        return server.simulateTransaction(tx).then(function(sim){ if(sim.error) throw new Error(lxCctpErrMap(sim.error)); return S.rpc.assembleTransaction(tx,sim).build(); });
      }); }
      function lxRpc(method,params){ return fetch(C.rpc,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:method,params:params})}).then(function(r){return r.json();}); }
      function signSubmit(prepared,label){
        onStatus("Waiting for signature ("+label+")…");
        return lxCctpGateSign(label, function(){ return Promise.resolve(f.signTransaction(prepared.toXDR(),{networkPassphrase:C.passphrase,network:"PUBLIC",address:pk})); }).then(function(sig){
          var xdr=(sig&&(sig.signedTxXdr||sig.signedXDR))||sig; if((sig&&sig.error)||!xdr) throw new Error("Signing cancelled.");
          if(typeof xdr!=="string") throw new Error("Unexpected signature format from your wallet.");
          onStatus("Submitting "+label+"…");
          return lxRpc("sendTransaction",{transaction:xdr}).then(function(res){
            if(res.error) throw new Error(label+" submit error: "+JSON.stringify(res.error).slice(0,180));
            var r=res.result||{};
            if(r.status==="ERROR") throw new Error(label+" rejected: "+JSON.stringify(r.errorResultXdr||r).slice(0,180));
            var hash=r.hash; if(!hash) throw new Error(label+" submit failed: "+JSON.stringify(res).slice(0,180));
            function poll(t){ return lxRpc("getTransaction",{hash:hash}).then(function(g){
              var st=(g.result&&g.result.status)||"NOT_FOUND";
              if(st==="SUCCESS") return hash;
              if(st==="FAILED") throw new Error(label+" failed on-chain ("+hash+")");
              if(t>40) throw new Error(label+" timed out ("+hash+")");
              return new Promise(function(rr){setTimeout(rr,2000);}).then(function(){return poll(t+1);});
            }); }
            return poll(0);
          });
        });
      }
      return Promise.resolve(f.requestAccess?f.requestAccess():null).then(function(){
        return f.getNetworkDetails?f.getNetworkDetails():(f.getNetwork?f.getNetwork():null);
      }).then(function(net){
        var pass=(net&&(net.networkPassphrase||net.passphrase))||null;
        if(pass&&pass!==C.passphrase) throw new Error("Freighter is not on Mainnet. Switch the network to Mainnet and retry.");
        return f.getAddress?f.getAddress():(f.getPublicKey?f.getPublicKey():null);
      }).then(function(a){
        pk=(a&&a.address)||a; if(!pk||(a&&a.error)) throw new Error("Could not read your wallet address.");
        units=lxUnits(amountHuman);
        onStatus("Checking allowance…");
        return server.getAccount(pk).then(function(acct){
          var opAl=new S.Contract(C.usdc).call("allowance", new S.Address(pk).toScVal(), new S.Address(C.tokenMessenger).toScVal());
          var txAl=new S.TransactionBuilder(acct,{fee:"1000000",networkPassphrase:C.passphrase}).addOperation(opAl).setTimeout(300).build();
          return server.simulateTransaction(txAl).then(function(simAl){
            var allowance=(!simAl.error&&simAl.result)?S.scValToNative(simAl.result.retval).toString():"0";
            var need,have; try{ need=BigInt(units); have=BigInt(allowance); }catch(_){ need=1; have=0; }
            if(have>=need) return null;
            onStatus("Approving USDC spend (one-time)…");
            return server.getLatestLedger().then(function(l){
              var exp=l.sequence+518400; // ~30 days of ledgers; one-time max approval so future bridges skip approve
              var MAXALLOW="170141183460469231731687303715884105727"; // i128 max = effectively unlimited
              var opAp=new S.Contract(C.usdc).call("approve", new S.Address(pk).toScVal(), new S.Address(C.tokenMessenger).toScVal(), S.nativeToScVal(MAXALLOW,{type:"i128"}), S.nativeToScVal(exp,{type:"u32"}));
              return buildSim(opAp).then(function(p){return signSubmit(p,"approve");}).then(function(h){ result.approveHash=h; });
            });
          });
        }).then(function(){
          onStatus("Building burn…");
          var mr=lxMintRecipient(S,destDomain,recipient);
          var op=new S.Contract(C.tokenMessenger).call("deposit_for_burn",
            new S.Address(pk).toScVal(), S.nativeToScVal(units,{type:"i128"}), S.nativeToScVal(destDomain,{type:"u32"}),
            mr, new S.Address(C.usdc).toScVal(), S.xdr.ScVal.scvBytes(new Uint8Array(32)),
            S.nativeToScVal("0",{type:"i128"}), S.nativeToScVal(2000,{type:"u32"}));
          return buildSim(op).then(function(p){return signSubmit(p,"burn");}).then(function(hash){
            result.hash=hash; result.status="SUCCESS"; onStatus("Burn confirmed ✓"); return result;
          });
        });
      });
    });
  });
}
window.lxCctpBurn=lxCctpBurn;
// EXPORTED FOR THE LAYERZERO LAYER, deliberately rather than duplicating them there. lxCctpSigner resolves three
// different wallet transports (Freighter, LOBSTR, WalletConnect) and lxCctpSdk owns the single lazy load of the
// vendored SDK. A second copy of either in _lzusdt0.js would be two wallet paths that move real money and drift
// apart the first time one is fixed -- so the LayerZero route signs through exactly the same code CCTP does.
// (function declarations hoist, so lxCctpGateSign is defined by the time this runs even though it appears later)
window.lxCctpSigner=lxCctpSigner; window.lxCctpSdk=lxCctpSdk; window.lxCctpGateSign=lxCctpGateSign;
// Same reasoning for the swap half: lxStrictPath is the only pathfinder that knows this site's slippage and
// error conventions, and lxFeeOwed* is the record that stops a missed fee signature from losing the fee. The
// LayerZero route swaps into USDT0 the same way this one swaps into USDC, so it uses these, not copies.
window.lxStrictPath=lxStrictPath; window.lxAssetOf=lxAssetOf; window.lxToAssets=lxToAssets;
window.lxFeeOwed=lxFeeOwed; window.lxFeeOwedSet=lxFeeOwedSet; window.lxFeeOwedAdd=lxFeeOwedAdd;
// (LX_ASSETS is exported further down, NOT here: it is a var, so only its declaration hoists to this point and
//  assigning it now would publish undefined. The function declarations above are safe because their bodies hoist.)

// Phase 3: poll Circle Iris (sandbox) for the burn's attestation. Returns {message, attestation, decodedMessage}.
function lxCctpAttest(hash, onStatus){
  var C=window.__lxCCTP; onStatus=onStatus||function(){};
  var url=C.iris+"/v2/messages/"+C.sourceDomain+"?transactionHash="+hash;
  function poll(t){
    onStatus("Fetching Circle attestation…"+(t?" ("+t+")":""));
    return fetch(url).then(function(r){return r.json();}).then(function(d){
      var m=(d&&d.messages&&d.messages[0])||null;
      if(m&&m.status==="complete"&&m.attestation&&m.attestation!=="PENDING"){
        onStatus("Attestation ready ✓");
        return {message:m.message, attestation:m.attestation, eventNonce:m.eventNonce, decodedMessage:m.decodedMessage, status:"complete"};
      }
      // AUDIT #3 (FUNDS): the old ceiling was 80 polls x 3s ~= 4 min, but CCTP min_finality on
      // Ethereum/Polygon is 13-20 min — so a perfectly healthy transfer "timed out" while the USDC was
      // already burned. 400 x 3s = 20 min. The error carries the burn hash so the transfer stays recoverable.
      if(t>400){ var e1=new Error("Attestation not ready yet — Circle has not finalized this burn. Your USDC is burned and safe; it stays recoverable from burn hash "+hash); e1.__lxBurnHash=hash; e1.__lxPending=true; throw e1; }
      return new Promise(function(rr){setTimeout(rr,3000);}).then(function(){return poll(t+1);});
    }).catch(function(e){ if(e&&e.__lxPending) throw e; if(t>400){ e.__lxBurnHash=hash; e.__lxPending=true; throw e; } return new Promise(function(rr){setTimeout(rr,3000);}).then(function(){return poll(t+1);}); });
  }
  return poll(0);
}
window.lxCctpAttest=lxCctpAttest;

// One-shot: burn on Stellar, then wait for the attestation. Returns everything needed to mint on the destination.
function lxCctpBridge(destDomain, amountHuman, recipient, onStatus){
  return lxCctpBurn(destDomain, amountHuman, recipient, onStatus).then(function(res){
    return lxCctpAttest(res.hash, onStatus).then(function(att){
      return { burnHash:res.hash, approveHash:res.approveHash||null, message:att.message, attestation:att.attestation,
               decodedMessage:att.decodedMessage, destDomain:parseInt(destDomain,10), recipient:recipient };
    });
  });
}
window.lxCctpBridge=lxCctpBridge;

// ---- Fee (0.2%, to XLM) + optional source->USDC hop, then CCTP burn(net) + attest ----
function lxSubmitClassic(C,xdr){
  return fetch(C.horizon+"/transactions",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"tx="+encodeURIComponent(xdr)}).then(function(r){return r.json();}).then(function(res){
    if(res.successful||res.hash) return res;
    var rc=res.extras&&res.extras.result_codes; throw new Error("Swap/fee tx failed: "+(rc?JSON.stringify(rc):JSON.stringify(res).slice(0,150)));
  });
}
function lxStrictPath(C,srcSpec,amount,destSpec){
  var sp=srcSpec.native?"source_asset_type=native":("source_asset_type="+((srcSpec.code||"").length>4?"credit_alphanum12":"credit_alphanum4")+"&source_asset_code="+srcSpec.code+"&source_asset_issuer="+srcSpec.issuer);
  // The destination CODE was hardcoded to USDC here, which was harmless while CCTP was the only route but wrong the
  // moment anything asks for a path to USDT0. Defaulted so every existing caller behaves exactly as before.
  var da=destSpec.native?"native":((destSpec.code||"USDC")+":"+destSpec.issuer);
  return fetch(C.horizon+"/paths/strict-send?"+sp+"&source_amount="+amount+"&destination_assets="+encodeURIComponent(da)).then(function(r){return r.json();}).then(function(d){
    var recs=(d._embedded&&d._embedded.records)||[]; if(!recs.length) throw new Error("No "+(srcSpec.code||"XLM")+"→"+(destSpec.native?"XLM":(destSpec.code||"USDC"))+" swap path on mainnet.");
    return { out:parseFloat(recs[0].destination_amount), path:recs[0].path||[] };
  });
}
// Unpaid platform fee, carried to the next bridge -----------------------------------------------------
// On the USDC path the fee is a second transaction that can only run AFTER the burn (a Soroban op cannot
// share a transaction with classic ops). If the user closes the tab or dismisses that second prompt, the
// old code swallowed the error and the fee was simply never charged. Remember it instead and add it to
// the next bridge, so a missed signature costs a delay rather than the fee.
function lxFeeOwed(pk){ try{ var o=JSON.parse(localStorage.getItem("lumos.cctp.feeowed")||"null");
  return (o&&o.addr===pk&&parseFloat(o.usdc)>0)?parseFloat(o.usdc):0; }catch(_){ return 0; } }
function lxFeeOwedSet(pk,v){ try{ if(!(v>0)) localStorage.removeItem("lumos.cctp.feeowed");
  else localStorage.setItem("lumos.cctp.feeowed",JSON.stringify({addr:pk,usdc:+v.toFixed(7)})); }catch(_){} }
function lxFeeOwedAdd(pk,v){ if(!(v>0))return; lxFeeOwedSet(pk,lxFeeOwed(pk)+v); }

function lxAssetOf(S,spec){ return spec.native?S.Asset.native():new S.Asset(spec.code,spec.issuer); }
function lxToAssets(S,arr){ return arr.map(function(a){ return a.asset_type==="native"?S.Asset.native():new S.Asset(a.asset_code,a.asset_issuer); }); }

// sourceSpec: "USDC" | {native:true} | {code,issuer}. Returns {burnHash,netUsdc,feeRate,message,attestation,decodedMessage,...}
function lxCctpBridgeFull(destDomain, sourceAmountHuman, recipient, sourceSpec, onStatus, netUsdcTarget){
  var C=window.__lxCCTP; onStatus=onStatus||function(){}; netUsdcTarget=parseFloat(netUsdcTarget)||0;
  var feeRate=(window.__lxFeeRate||C.feeRate||0.002), UI=C.usdcIssuer;   // honor the 250K-LUMOS tier (0.1%) same as swap
  var isUSDC=!sourceSpec||sourceSpec==="USDC"||sourceSpec.code==="USDC";
  var srcAmt=parseFloat(String(sourceAmountHuman).replace(/,/g,"")); if(!(srcAmt>0)) return Promise.reject(new Error("Enter a valid amount"));
  return lxCctpSdk().then(function(S){ return lxCctpSigner().then(function(f){
    var pk;
    var deferredFee=null, deferredFeeAmt=0, deferredFeeHash="";   // AUDIT #2 (FUNDS): USDC-path fee runs AFTER a successful burn, never before
    function acc(){ return fetch(C.horizon+"/accounts/"+pk).then(function(r){return r.json();}); }
    function usdcBal(){ return acc().then(function(a){ var b=(a.balances||[]).filter(function(x){return x.asset_code==="USDC"&&x.asset_issuer===UI;})[0]; return b?parseFloat(b.balance):0; }); }
    function signSubmit(txB,label){ onStatus("Waiting for signature ("+label+")…"); return lxCctpGateSign(label, function(){ return Promise.resolve(f.signTransaction(txB.toXDR(),{networkPassphrase:C.passphrase,network:"PUBLIC",address:pk})); }).then(function(sig){ var xdr=(sig&&(sig.signedTxXdr||sig.signedXDR))||sig; if((sig&&sig.error)||typeof xdr!=="string") throw new Error("Signing cancelled."); onStatus("Submitting "+label+"…"); return lxSubmitClassic(C,xdr); }); }
    return Promise.resolve(f.requestAccess?f.requestAccess():null).then(function(){ return f.getAddress?f.getAddress():f.getPublicKey(); }).then(function(a){
      pk=(a&&a.address)||a; if(!pk) throw new Error("Could not read your wallet address.");
      if(isUSDC){
        var feeAmt=+(srcAmt*feeRate).toFixed(7), netAmt=+((netUsdcTarget>0?netUsdcTarget:(srcAmt-feeAmt))).toFixed(7);
        if(!(feeAmt>0)) return Promise.resolve(netAmt);
        // AUDIT #2 (FUNDS): this fee tx used to be signed and submitted BEFORE lxCctpBurn ran its
        // simulation — so a burn that failed validation (destination not enabled, amount too small, …)
        // left the user charged with nothing bridged. Defer it: burn first, collect the fee only after.
        deferredFeeAmt=feeAmt;
        deferredFee=function(){
          // A fee paid to yourself is not a fee. When the connected wallet IS the collector (which is the
          // case whenever the operator tests the product) this used to submit a real self-payment: a
          // network fee spent to move money nowhere, and a row that then reads as revenue it is not.
          if(C.feeCollector===pk) return Promise.resolve();
          // Was a path payment USDC -> XLM. That added a pathfinding call, a slippage bound and a
          // destMin that can all fail on a fee this small, and a failure here is invisible to the user
          // because the burn already succeeded. A plain USDC payment has none of those failure modes.
          var owed=+(feeAmt+lxFeeOwed(pk)).toFixed(7);
          if(!(owed>0)) return Promise.resolve();
          function attempt(){
            onStatus("Approve the "+(feeRate*100).toFixed(2)+"% platform fee \u2014 one more signature ("+owed.toFixed(7)+" USDC)");
            return acc().then(function(ad){
              var tb=new S.TransactionBuilder(new S.Account(pk,ad.sequence),{fee:"1000",networkPassphrase:C.passphrase})
                .addOperation(S.Operation.payment({destination:C.feeCollector,asset:new S.Asset("USDC",UI),amount:owed.toFixed(7)}))
                .addMemo(S.Memo.text("lx:cctp"))
                .setTimeout(300).build();
              return signSubmit(tb,"fee").then(function(sr){ try{ deferredFeeHash=(sr&&(sr.hash||sr.id))||""; }catch(_){} return sr; });
            });
          }
          // one silent retry: a stale sequence number or a dropped submit is worth another go before
          // this is written off, since nothing else in the flow will ever come back for it
          return attempt().catch(function(e){ if(/cancel/i.test((e&&e.message)||"")) throw e; return attempt(); })
            .then(function(r){ lxFeeOwedSet(pk,0); return r; });
        };
        return Promise.resolve(netAmt);
      }
      var swapAmt=+(srcAmt*(1-feeRate)).toFixed(7), feeAmt=+(srcAmt*feeRate).toFixed(7);
      onStatus("Swapping "+(sourceSpec.code||"XLM")+"→USDC + fee…");
      return lxStrictPath(C,sourceSpec,swapAmt.toFixed(7),{code:"USDC",issuer:UI}).then(function(pSwap){
        var feePathP = sourceSpec.native ? Promise.resolve(null) : lxStrictPath(C,sourceSpec,feeAmt.toFixed(7),{native:true});
        return feePathP.then(function(pFee){ return usdcBal().then(function(before){ return acc().then(function(ad){
          var src=lxAssetOf(S,sourceSpec);
          var feeOp = sourceSpec.native
            ? S.Operation.payment({destination:C.feeCollector,asset:S.Asset.native(),amount:feeAmt.toFixed(7)})
            : S.Operation.pathPaymentStrictSend({sendAsset:src,sendAmount:feeAmt.toFixed(7),destination:C.feeCollector,destAsset:S.Asset.native(),destMin:(pFee.out*0.97).toFixed(7),path:lxToAssets(S,pFee.path)});
          // If the account has no USDC trustline yet (e.g. a fresh wallet), establish it in the SAME tx so the
          // swap can deliver USDC — otherwise the path payment fails with op_no_trust.
          var hasUsdcTrust=(ad.balances||[]).some(function(b){ return b.asset_code==="USDC" && b.asset_issuer===UI; });
          var _tbb=new S.TransactionBuilder(new S.Account(pk,ad.sequence),{fee:"3000",networkPassphrase:C.passphrase});
          if(!hasUsdcTrust) _tbb.addOperation(S.Operation.changeTrust({asset:new S.Asset("USDC",UI)}));
          var _tb2=_tbb.addOperation(S.Operation.pathPaymentStrictSend({sendAsset:src,sendAmount:swapAmt.toFixed(7),destination:pk,destAsset:new S.Asset("USDC",UI),destMin:(pSwap.out*0.97).toFixed(7),path:lxToAssets(S,pSwap.path)}));
          // same self-payment rule as the USDC path: paying the fee to yourself only costs a network fee
          // and fabricates a revenue row, so leave the slice in the user's wallet instead
          if(C.feeCollector!==pk) _tb2=_tb2.addOperation(feeOp);
          var tb=_tb2.setTimeout(300).build();
          return signSubmit(tb,"swap+fee").then(function(sr){ /* the fee rides in this transaction: it is what the registry verifies */ try{ if(C.feeCollector!==pk) deferredFeeHash=(sr&&(sr.hash||sr.id))||""; }catch(_){} return usdcBal().then(function(after){ var got=+(after-before).toFixed(7); if(!(got>0)) throw new Error("Swap produced no USDC."); var net=(netUsdcTarget>0&&netUsdcTarget<=got)?+netUsdcTarget.toFixed(7):got; return net; }); });
        }); }); });
      });
    }).then(function(netHuman){
      onStatus("Bridging "+netHuman+" USDC via CCTP…");
      return lxCctpBurn(destDomain,String(netHuman),recipient,onStatus).then(function(res){
        // AUDIT #1/#3 (FUNDS): persist the burn IMMEDIATELY, before attestation. Past this point the USDC is
        // already destroyed on Stellar, so the record must exist even if attestation times out or the tab closes.
        var rec={ burnHash:res.hash, approveHash:res.approveHash||null, netUsdc:netHuman, feeRate:feeRate,
                  // what the user sent, so the claims panel can say "72.50 BLND -> 0.41 USDC on Base"
                  srcKey:(isUSDC?"USDC":(sourceSpec&&sourceSpec.native?"XLM":((sourceSpec&&sourceSpec.code)||"USDC"))), srcAmount:srcAmt,
                  destDomain:parseInt(destDomain,10), recipient:recipient, status:"burned", ts:Date.now() };
        lxBrSavePending(rec);
        // fee now that the burn is confirmed. A fee failure must NEVER fail the bridge (the USDC is already
        // burned) — record it and carry on so the user still gets their attestation + redeem data.
        // a fee failure must NEVER fail the bridge — but it must not vanish either: what could not be
        // collected is remembered against this wallet and added to its next bridge
        var feeP = deferredFee ? deferredFee().catch(function(fe){
          rec.feeError=(fe&&fe.message)||"fee not collected"; lxFeeOwedAdd(pk,deferredFeeAmt); lxBrSavePending(rec); }) : Promise.resolve();
        return feeP.then(function(){ return lxBrRegister(deferredFeeHash,res.hash); })
          .then(function(){ return lxCctpAttest(res.hash,onStatus); }).then(function(att){
          rec.message=att.message; rec.attestation=att.attestation; rec.decodedMessage=att.decodedMessage;
          rec.status="attested";                       // redeemable: message + attestation are now stored
          lxBrSavePending(rec);
          return { burnHash:res.hash, approveHash:res.approveHash||null, netUsdc:netHuman, feeRate:feeRate, message:att.message, attestation:att.attestation, decodedMessage:att.decodedMessage, destDomain:parseInt(destDomain,10), recipient:recipient, minted:false };
        }).catch(function(e){ e.__lxBurnHash=res.hash; e.__lxPending=true; throw e; });
      });
    });
  }); });
}
window.lxCctpBridgeFull=lxCctpBridgeFull;

// Step 1: real network logos in the destination dropdown options + selected chip (logos only)
function lxCctpNetLogos(){
  try{
    // ONE MAP, NOT TWO. This function used to carry its own private copy of the network -> logo map, separate from
    // LX_NETMAP below, and when LayerZero added eight destinations neither copy knew them. Any network missing
    // here is simply left alone -- so the selected chip kept the design's default, which is Ethereum. That is why
    // picking Plasma, MegaETH, Flare, Monad or Sei showed an Ethereum logo (RAZA 2026-09-19). Reading LX_NETMAP
    // means a destination is added in one place and gets its logo everywhere. (It is a var assigned further down,
    // but this only ever runs from the interval and click handlers below, by which time it has its value.)
    var MAP=LX_NETMAP;
    // force=false: skip icons that already carry a real logo as a url() background (e.g. Ethereum's option) so we
    // don't fight the design's own re-render loop (that fight caused the Ethereum dropdown blip). force=true: always set.
    function apply(ic,key,force){ if(!ic)return; var img=ic.querySelector('img.lx-netimg'); if(img){ if((img.getAttribute('src')||'').indexOf(key)<0) img.setAttribute('src','assets/networks/'+key+'.png'); return; } if(!force){ var stl=ic.getAttribute('style')||''; if(stl.indexOf('url(')>=0) return; } ic.innerHTML='<img class="lx-netimg" src="/assets/networks/'+key+'.png" alt="">'; }
    [].slice.call(document.querySelectorAll('.brd-opt[data-net]')).forEach(function(o){ var key=MAP[o.getAttribute('data-net')]; if(key) apply(o.querySelector('.brd-ic'),key,false); });
    // .br-netchip covers the source chip AND the .brd-trigger (selected dest); force so the selected chip always shows the PNG (set once, no blip)
    [].slice.call(document.querySelectorAll('.br-netchip')).forEach(function(ch){ var key=MAP[((ch.querySelector('.br-nm')||ch.querySelector('.nm')||{}).textContent||'').trim()]; if(key) apply(ch.querySelector('.br-ic'),key,true); });
  }catch(_){}
}
(function(){ var n=0,iv=setInterval(function(){ n++; lxCctpNetLogos(); if(n>25) clearInterval(iv); },250);
  document.addEventListener('click',function(){ setTimeout(lxCctpNetLogos,60); setTimeout(lxCctpNetLogos,260); },true); })();
// THE FLASH ON SELECTING A DESTINATION (RAZA 2026-09-19: "There's a flash bug whenever i select any destination...
// for split second, it shows something else"). The correction above runs 60ms and 260ms AFTER the click, so the
// browser always painted the design's own icon first and then swapped it -- a frame of the wrong logo, every time.
//
// A MutationObserver callback runs as a microtask straight after the DOM change and BEFORE the next paint, so the
// design's icon is replaced before it is ever drawn. Watching only the picker (.brd, trigger + menu) keeps it cheap.
// It terminates by construction: apply() leaves an icon alone once it already shows the right src, so the change it
// makes triggers one more pass that finds nothing to do.
(function(){
  function attach(){
    var host=document.querySelector('.br-step[data-step="1"] .brd');
    if(!host) return false;
    if(host.__lxNetObs) return true;
    host.__lxNetObs=1;
    new MutationObserver(function(){ try{ lxCctpNetLogos(); }catch(_){} })
      .observe(host,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['style','src','class']});
    return true;
  }
  if(!attach()){ var t=0,iv=setInterval(function(){ if(attach()||++t>40) clearInterval(iv); },150); }
})();

// ---- Step 1: Next waits for a destination (RAZA 2026-09-20) --------------------------------------------------------
// The button shipped enabled with the picker still reading "Select Network", so it advanced to step 2 with no
// destination: no routes to compare, no address format to check against, and an empty "To" side. The destination is
// whatever the picker's own label says -- and it counts only when it NAMES one of the destinations this bridge
// offers, so the placeholder, an empty label and anything stale all read as "not chosen yet".
// Disabled the way step 2 disables Review (disabled + .lx-disabled), so both steps look and behave alike.
(function(){
  function step1Next(){
    var s=document.querySelector('.br-step[data-step="1"]'); if(!s) return null;
    return s.querySelector('.br-actions .br-next')||s.querySelector('button.br-next')||s.querySelector('.br-next');
  }
  function chosen(){
    var n=lxBrDestNet(); if(!n) return false;
    try{ return lxBrRoutes().some(function(r){ return r.name===n; }); }catch(_){ return false; }
  }
  function gate(){
    var b=step1Next(); if(!b) return;
    var ok=chosen();
    if(b.tagName==="BUTTON") b.disabled=!ok;
    b.classList.toggle('lx-disabled',!ok);
    b.setAttribute('aria-disabled',ok?'false':'true');
    b.title=ok?'':'Choose a destination network first';
  }
  window.lxBrStep1Gate=gate;
  // the picker rewrites its own label, so watch the step itself; the click listener covers a menu that replaces it
  function wire(){
    var s=document.querySelector('.br-step[data-step="1"]'); if(!s) return false;
    if(s.__lxGate) return true; s.__lxGate=1;
    new MutationObserver(function(){ try{ gate(); }catch(_){} }).observe(s,{childList:true,subtree:true,characterData:true});
    document.addEventListener('click',function(){ setTimeout(gate,0); },true);
    gate(); return true;
  }
  if(!wire()){ var t=0,iv=setInterval(function(){ if(wire()||++t>60) clearInterval(iv); },150); }
})();

// ---- Step 2: wire the EXISTING wizard (source asset + amount + USDC calc + dest logos). Design preserved: only content/logos + editability. ----
var LX_ASSETS={
  USDC:{logo:"assets/tokens/usdc.png", spec:"USDC", px:1},
  XLM:{logo:"assets/tokens/xlm.png", spec:{native:true}, px:0.12},
  SHX:{logo:"assets/tokens/shx.png", spec:{code:"SHX",issuer:"GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEKEBR7UCHEUUEK72N7I7KJ6JH"}, px:0.0016},
  yXLM:{logo:"assets/tokens/yxlm.png", spec:{code:"yXLM",issuer:"GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55"}, px:0.115},
  // AUDIT #4: this was the USDC issuer (GA5ZSEJY…) — bridging/valuing LUMOS resolved the wrong asset.
  // Canonical LUMOS issuer, matching _lumostoken.js / _dexdata.js / _rewardsdata.js.
  LUMOS:{logo:"assets/favicon.png", spec:{code:"LUMOS",issuer:"GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S"}, px:0.25},
  BLND:{logo:"assets/tokens/blnd.svg", spec:{code:"BLND",issuer:"GDJEHTBE6ZHUXSWFI642DCGLUOECLHPF3KSXHPXTSTJ7E3JF6MQ5EZYY"}, px:0.05},
  AQUA:{logo:"assets/tokens/aqua.png", spec:{code:"AQUA",issuer:"GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA"}, px:0.004}
};
var LX_AORDER=["USDC","XLM","SHX","yXLM","LUMOS","BLND","AQUA"];
// the rest of the curated list, after the seven that carry baked logos and CoinGecko prices. No price here: these
// are valued by the live path quote (LX_PXLIVE stays unset, so the dollar line waits for it rather than guessing).
(function(){ var X=[{"c":"EURC","i":"GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2","d":"circle.com","l":"/assets/tokens/curated/EURC-GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2.png"},{"c":"yUSDC","i":"GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF","d":"ultracapital.xyz","l":"/assets/tokens/curated/yUSDC-GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF.png"},{"c":"TDT","i":"GBINRJAGLT2WN6DK2I47QKMKEJW56ASPO6K2GQPCLY7ZO7TAQMKUBPOG","d":"lumoscore.com","l":"/assets/tokens/curated/TDT-GBINRJAGLT2WN6DK2I47QKMKEJW56ASPO6K2GQPCLY7ZO7TAQMKUBPOG.png"},{"c":"XRP","i":"GBXRPL45NPHCVMFFAYZVUVFFVKSIZ362ZXFP7I2ETNQ3QKZMFLPRDTD5","d":"fchain.io","l":"/assets/tokens/curated/XRP-GBXRPL45NPHCVMFFAYZVUVFFVKSIZ362ZXFP7I2ETNQ3QKZMFLPRDTD5.png"},{"c":"SCOP","i":"GC6OYQJIZF3HFXCYPFCBXYXNGIBQ4TNSFUBUXQJOZWIP6F3YZK4QH3VQ","d":"scopuly.com","l":"/assets/tokens/curated/SCOP-GC6OYQJIZF3HFXCYPFCBXYXNGIBQ4TNSFUBUXQJOZWIP6F3YZK4QH3VQ.png"},{"c":"MTL","i":"GACKTN5DAZGWXRWB2WLM6OPBDHAMT6SJNGLJZPQMEZBUR4JUGBX2UK7V","d":"mtl.montelibero.org","l":"/assets/tokens/curated/MTL-GACKTN5DAZGWXRWB2WLM6OPBDHAMT6SJNGLJZPQMEZBUR4JUGBX2UK7V.png"},{"c":"EURMTL","i":"GACKTN5DAZGWXRWB2WLM6OPBDHAMT6SJNGLJZPQMEZBUR4JUGBX2UK7V","d":"mtl.montelibero.org","l":"/assets/tokens/curated/EURMTL-GACKTN5DAZGWXRWB2WLM6OPBDHAMT6SJNGLJZPQMEZBUR4JUGBX2UK7V.png"},{"c":"ZARZ","i":"GAROH4EV3WVVTRQKEY43GZK3XSRBEYETRVZ7SVG5LHWOAANSMCTJBB3U","d":"zeam.money","l":"/assets/tokens/curated/ZARZ-GAROH4EV3WVVTRQKEY43GZK3XSRBEYETRVZ7SVG5LHWOAANSMCTJBB3U.png"},{"c":"USDZ","i":"GAKTLPC4ZV37SSCITQ5IS5AQ4WPF4CF4VZJQPPAROSGXMYOATF5U6XPR","d":"zeam.money","l":"/assets/tokens/curated/USDZ-GAKTLPC4ZV37SSCITQ5IS5AQ4WPF4CF4VZJQPPAROSGXMYOATF5U6XPR.png"},{"c":"CLPX","i":"GDYSPBVZHPQTYMGSYNOHRZQNLB3ZWFVQ2F7EP7YBOLRGD42XIC3QUX5G","d":"clpx.finance","l":"/assets/tokens/curated/CLPX-GDYSPBVZHPQTYMGSYNOHRZQNLB3ZWFVQ2F7EP7YBOLRGD42XIC3QUX5G.png"},{"c":"yBTC","i":"GBUVRNH4RW4VLHP4C5MOF46RRIRZLAVHYGX45MVSTKA2F6TMR7E7L6NW","d":"ultracapital.xyz","l":"/assets/tokens/curated/yBTC-GBUVRNH4RW4VLHP4C5MOF46RRIRZLAVHYGX45MVSTKA2F6TMR7E7L6NW.png"},{"c":"yETH","i":"GDYQNEF2UWTK4L6HITMT53MZ6F5QWO3Q4UVE6SCGC4OMEQIZQQDERQFD","d":"ultracapital.xyz","l":"/assets/tokens/curated/yETH-GDYQNEF2UWTK4L6HITMT53MZ6F5QWO3Q4UVE6SCGC4OMEQIZQQDERQFD.png"},{"c":"ARS","i":"GCYE7C77EB5AWAA25R5XMWNI2EDOKTTFTTPZKM2SR5DI4B4WFD52DARS","d":"api.anclap.com","l":"/assets/tokens/curated/ARS-GCYE7C77EB5AWAA25R5XMWNI2EDOKTTFTTPZKM2SR5DI4B4WFD52DARS.png"},{"c":"PEN","i":"GA4TDPNUCZPTOHB3TKUYMDCRVATXKEADH7ZEYEBWJKQKE2UBFCYNBPEN","d":"api.anclap.com","l":"/assets/tokens/curated/PEN-GA4TDPNUCZPTOHB3TKUYMDCRVATXKEADH7ZEYEBWJKQKE2UBFCYNBPEN.png"},{"c":"ETH","i":"GBFXOHVAS43OIWNIO7XLRJAHT3BICFEIKOJLZVXNT572MISM4CMGSOCC","d":"ultracapital.xyz","l":"/assets/tokens/curated/ETH-GBFXOHVAS43OIWNIO7XLRJAHT3BICFEIKOJLZVXNT572MISM4CMGSOCC.png"},{"c":"BTCLN","i":"GDPKQ2TSNJOFSEE7XSUXPWRP27H6GFGLWD7JCHNEYYWQVGFA543EVBVT","d":"kbtrading.org","l":"/assets/tokens/curated/BTCLN-GDPKQ2TSNJOFSEE7XSUXPWRP27H6GFGLWD7JCHNEYYWQVGFA543EVBVT.png"},{"c":"USDM","i":"GDHDC4GBNPMENZAOBB4NCQ25TGZPDRK6ZGWUGSI22TVFATOLRPSUUSDM","d":"mtl.montelibero.org","l":"/assets/tokens/curated/USDM-GDHDC4GBNPMENZAOBB4NCQ25TGZPDRK6ZGWUGSI22TVFATOLRPSUUSDM.png"},{"c":"CETES","i":"GCRYUGD5NVARGXT56XEZI5CIFCQETYHAPQQTHO2O3IQZTHDH4LATMYWC","d":"etherfuse.com","l":"/assets/tokens/curated/CETES-GCRYUGD5NVARGXT56XEZI5CIFCQETYHAPQQTHO2O3IQZTHDH4LATMYWC.png"},{"c":"USTRY","i":"GCRYUGD5NVARGXT56XEZI5CIFCQETYHAPQQTHO2O3IQZTHDH4LATMYWC","d":"etherfuse.com","l":"/assets/tokens/curated/USTRY-GCRYUGD5NVARGXT56XEZI5CIFCQETYHAPQQTHO2O3IQZTHDH4LATMYWC.png"},{"c":"SSLX","i":"GBHFGY3ZNEJWLNO4LBUKLYOCEK4V7ENEBJGPRHHX7JU47GWHBREH37UR","d":"sslx.sl8.online","l":"/assets/tokens/curated/SSLX-GBHFGY3ZNEJWLNO4LBUKLYOCEK4V7ENEBJGPRHHX7JU47GWHBREH37UR.png"},{"c":"AFR","i":"GBX6YI45VU7WNAAKA3RBFDR3I3UKNFHTJPQ5F6KOOKSGYIAM4TRQN54W","d":"afreum.com","l":"/assets/tokens/curated/AFR-GBX6YI45VU7WNAAKA3RBFDR3I3UKNFHTJPQ5F6KOOKSGYIAM4TRQN54W.png"},{"c":"TFT","i":"GBOVQKJYHXRR3DX6NOX2RRYFRCUMSADGDESTDNBDS6CDVLGVESRTAC47","d":"threefold.io","l":"/assets/tokens/curated/TFT-GBOVQKJYHXRR3DX6NOX2RRYFRCUMSADGDESTDNBDS6CDVLGVESRTAC47.png"},{"c":"GOLD","i":"GBC5ZGK6MQU3XG5Y72SXPA7P5R5NHYT2475SNEJB2U3EQ6J56QLVGOLD","d":"mintx.co","l":"/assets/tokens/curated/GOLD-GBC5ZGK6MQU3XG5Y72SXPA7P5R5NHYT2475SNEJB2U3EQ6J56QLVGOLD.png"},{"c":"USDY","i":"GAJMPX5NBOG6TQFPQGRABJEEB2YE7RFRLUKJDZAZGAD5GFX4J7TADAZ6","d":"ondo.finance","l":"/assets/tokens/curated/USDY-GAJMPX5NBOG6TQFPQGRABJEEB2YE7RFRLUKJDZAZGAD5GFX4J7TADAZ6.png"},{"c":"USDT0","i":"GATISXX6BZ6NC7IKQBY37CJD4SOZL3CYZJWXEDG6JVIY4WBS6KXJHN6Q","d":"","l":"/assets/tokens/curated/USDT0-GATISXX6BZ6NC7IKQBY37CJD4SOZL3CYZJWXEDG6JVIY4WBS6KXJHN6Q.png"},{"c":"XTROOP","i":"GARPXWTVB4QAGDZDCKV7ERN5GJTTMBSLOGPQPHYRVLYOW24CFB2SWCR5","d":"librequidity.org","l":"/assets/tokens/curated/XTROOP-GARPXWTVB4QAGDZDCKV7ERN5GJTTMBSLOGPQPHYRVLYOW24CFB2SWCR5.png"},{"c":"GRAT","i":"GAJ7V3EMD3FRWAPBEJAP7EC4223XI5EACDZ46RFMY5DYOMCIMWEFR5II","d":"gratz.io","l":"/assets/tokens/curated/GRAT-GAJ7V3EMD3FRWAPBEJAP7EC4223XI5EACDZ46RFMY5DYOMCIMWEFR5II.png"},{"c":"VELO","i":"GDM4RQUQQUVSKQA7S6EM7XBZP3FCGH4Q7CL6TABQ7B2BEJ5ERARM2M5M","d":"","l":"/assets/tokens/curated/VELO-GDM4RQUQQUVSKQA7S6EM7XBZP3FCGH4Q7CL6TABQ7B2BEJ5ERARM2M5M.png"},{"c":"PHO","i":"GAX5TXB5RYJNLBUR477PEXM4X75APK2PGMTN6KEFQSESGWFXEAKFSXJO","d":"app.phoenix-hub.io","l":"/assets/tokens/curated/PHO-GAX5TXB5RYJNLBUR477PEXM4X75APK2PGMTN6KEFQSESGWFXEAKFSXJO.png"},{"c":"ACT","i":"GAHHULDPDVGB5WS5PH7BCGLJ7ZHECDBIIMKB62UPVDUOCHNFL7HX3FS7","d":"authentic-payment.com","l":"/assets/tokens/curated/ACT-GAHHULDPDVGB5WS5PH7BCGLJ7ZHECDBIIMKB62UPVDUOCHNFL7HX3FS7.png"},{"c":"IDRT","i":"GDPKQ2TSNJOFSEE7XSUXPWRP27H6GFGLWD7JCHNEYYWQVGFA543EVBVT","d":"kbtrading.org","l":"/assets/tokens/curated/IDRT-GDPKQ2TSNJOFSEE7XSUXPWRP27H6GFGLWD7JCHNEYYWQVGFA543EVBVT.png"},{"c":"LMX","i":"GCJF4534PAFBOQ6R7QLVMRKUQV2AMNGEXGGDDN2ISYAIN5XPKTLUMEXO","d":"lumexo.io","l":"/assets/tokens/curated/LMX-GCJF4534PAFBOQ6R7QLVMRKUQV2AMNGEXGGDDN2ISYAIN5XPKTLUMEXO.png"},{"c":"LTC","i":"GBVOL67TMUQBGL4TZYNMY3ZQ5WGQYFPFD5VJRWXR72VA33VFNL225PL5","d":"stellarport.io","l":"/assets/tokens/curated/LTC-GBVOL67TMUQBGL4TZYNMY3ZQ5WGQYFPFD5VJRWXR72VA33VFNL225PL5.png"},{"c":"SLVR","i":"GBZVELEQD3WBN3R3VAG64HVBDOZ76ZL6QPLSFGKWPFED33Q3234NSLVR","d":"mintx.co","l":"/assets/tokens/curated/SLVR-GBZVELEQD3WBN3R3VAG64HVBDOZ76ZL6QPLSFGKWPFED33Q3234NSLVR.png"},{"c":"XRF","i":"GCHI6I3X62ND5XUMWINNNKXS2HPYZWKFQBZZYBSMHJ4MIP2XJXSZTXRF","d":"reflector.network","l":"/assets/tokens/curated/XRF-GCHI6I3X62ND5XUMWINNNKXS2HPYZWKFQBZZYBSMHJ4MIP2XJXSZTXRF.png"},{"c":"PYUSD","i":"GDQE7IXJ4HUHV6RQHIUPRJSEZE4DRS5WY577O2FY6YQ5LVWZ7JZTU2V5","d":"token-metadata.paxos.com","l":"/assets/tokens/curated/PYUSD-GDQE7IXJ4HUHV6RQHIUPRJSEZE4DRS5WY577O2FY6YQ5LVWZ7JZTU2V5.png"},{"c":"sUSD","i":"GCHW7CWI7GMIYQYFXMFJNJX5645XGWIINIAEQK3SABQO6CAYL5T7JYIH","d":"synt.tech","l":"/assets/tokens/curated/sUSD-GCHW7CWI7GMIYQYFXMFJNJX5645XGWIINIAEQK3SABQO6CAYL5T7JYIH.png"},{"c":"XLMG","i":"GCVNN7O5JISPEYUTLK3JYGBDWCPDIHB4MTG4PMSJVIKJCR64NOXWI3YH","d":"stellargold.net","l":"/assets/tokens/curated/XLMG-GCVNN7O5JISPEYUTLK3JYGBDWCPDIHB4MTG4PMSJVIKJCR64NOXWI3YH.png"},{"c":"BRAVE","i":"GDREF4TAC3RFYVLHEV24CXN2VBGCEEP74BZOC3T4Q4XJ6SXJFMDPNTJL","d":"brave-token.age-shield.com","l":"/assets/tokens/curated/BRAVE-GDREF4TAC3RFYVLHEV24CXN2VBGCEEP74BZOC3T4Q4XJ6SXJFMDPNTJL.png"},{"c":"Xoge","i":"GCELOR2TIPF6WJLVIXYQNWEO2QAABIAGGFJYHKTULOJ7MR5F5P4DSLNR","d":"xoge.xmint.io","l":"/assets/tokens/curated/Xoge-GCELOR2TIPF6WJLVIXYQNWEO2QAABIAGGFJYHKTULOJ7MR5F5P4DSLNR.png"},{"c":"LIBERATOR","i":"GCV4LXAU5PMYTIO7P5USPE2HUKLRCV2PPMULTOQSZESFLJLVL25W6D7F","d":"lumoscore.com","l":"/assets/tokens/curated/LIBERATOR-GCV4LXAU5PMYTIO7P5USPE2HUKLRCV2PPMULTOQSZESFLJLVL25W6D7F.png"},{"c":"JDMC","i":"GDZ7MGCU3TH4EVXU6S7EZSCRH6VCL36L4Q436MNVLEEFFVXRLRMHGZX2","d":"justdumbmemes.com","l":"/assets/tokens/curated/JDMC-GDZ7MGCU3TH4EVXU6S7EZSCRH6VCL36L4Q436MNVLEEFFVXRLRMHGZX2.png"},{"c":"Fucupcakes","i":"GAYLMXU2ACEUZCHCFZM4OAIUJCJTU6QZBWUTVRGOB5JHLWKNVGNP2P6B","d":"justdumbmemes.com","l":"/assets/tokens/curated/Fucupcakes-GAYLMXU2ACEUZCHCFZM4OAIUJCJTU6QZBWUTVRGOB5JHLWKNVGNP2P6B.png"},{"c":"TKG","i":"GAM3PID2IOBTNCBMJXHIAS4EO3GQXAGRX4UB6HTQY2DUOVL3AQRB4UKQ","d":"tokenglade.com","l":"/assets/tokens/curated/TKG-GAM3PID2IOBTNCBMJXHIAS4EO3GQXAGRX4UB6HTQY2DUOVL3AQRB4UKQ.png"},{"c":"PAYBO","i":"GDNUDY5LNUVCO55LLK6H2RCOILB6EO7UOVAOGDTV3FB7Y2U45TMAXD3D","d":"paybo.club","l":"/assets/tokens/curated/PAYBO-GDNUDY5LNUVCO55LLK6H2RCOILB6EO7UOVAOGDTV3FB7Y2U45TMAXD3D.png"},{"c":"FRED","i":"GCA73U2PZFWAXJSNVMEVPNPPJCZGETWPWZC6E4DJAIWP3ZW3BAGYZLV6","d":"fredenergy.org","l":"/assets/tokens/curated/FRED-GCA73U2PZFWAXJSNVMEVPNPPJCZGETWPWZC6E4DJAIWP3ZW3BAGYZLV6.png"},{"c":"PYBC","i":"GBVB43NLVIP2USHXSKI7QQCZKZU2Z6U6A5PAHMIW7LLNVMQJTOX2BZI5","d":"luxpayband.io","l":"/assets/tokens/curated/PYBC-GBVB43NLVIP2USHXSKI7QQCZKZU2Z6U6A5PAHMIW7LLNVMQJTOX2BZI5.png"},{"c":"KALE","i":"GBDVX4VELCDSQ54KQJYTNHXAHFLBCA77ZY2USQBM4CSHTTV7DME7KALE","d":"kalepail.com","l":"/assets/tokens/curated/KALE-GBDVX4VELCDSQ54KQJYTNHXAHFLBCA77ZY2USQBM4CSHTTV7DME7KALE.png"},{"c":"XXA","i":"GC4HS4CQCZULIOTGLLPGRAAMSBDLFRR6Y7HCUQG66LNQDISXKIXXADIM","d":"ixinium.io","l":"/assets/tokens/curated/XXA-GC4HS4CQCZULIOTGLLPGRAAMSBDLFRR6Y7HCUQG66LNQDISXKIXXADIM.png"},{"c":"XTAR","i":"GAORYJ3KBDGIM7FFSKVUJHJ5NEFWIRDIAGGBJBJS7TY6ECZS53257IG4","d":"dogstarcoin.com","l":"/assets/tokens/curated/XTAR-GAORYJ3KBDGIM7FFSKVUJHJ5NEFWIRDIAGGBJBJS7TY6ECZS53257IG4.png"},{"c":"xLMNR","i":"GDKA6WVMFSA73BMEVKPO6WXSSWP4MPRBDJVSXLLSEVIEVH226L5RJ7NL","d":"thelumenaire.com","l":"/assets/tokens/curated/xLMNR-GDKA6WVMFSA73BMEVKPO6WXSSWP4MPRBDJVSXLLSEVIEVH226L5RJ7NL.png"},{"c":"ARST","i":"GCSAZVWXZKWS4XS223M5F54H2B6XPIIXZZGP7KEAIU6YSL5HDRGCI3DG","d":"pubnet-sep.latamex.com","l":"/assets/tokens/curated/ARST-GCSAZVWXZKWS4XS223M5F54H2B6XPIIXZZGP7KEAIU6YSL5HDRGCI3DG.png"}]; X.forEach(function(a){ if(LX_ASSETS[a.c])return;
  LX_ASSETS[a.c]={logo:(a.l||("/lxapi/logoimg?asset="+a.c+"-"+a.i)), spec:{code:a.c,issuer:a.i}, px:0, dom:a.d}; LX_AORDER.push(a.c); }); })();
// an asset with no logo anywhere leaves the grey disc rather than a broken-image mark
document.addEventListener("error",function(e){ var t=e.target; if(t&&t.tagName==="IMG"&&t.closest&&(t.closest("#lx-br-amenu")||t.closest(".br-asset"))) t.style.visibility="hidden"; },true);
document.addEventListener("load",function(e){ var t=e.target; if(t&&t.tagName==="IMG"&&t.style.visibility==="hidden") t.style.visibility=""; },true);
// Which px values are a LIVE price rather than the baked placeholder above. Only USDC is inherently
// true (it is the unit). XLM is set from our own /lxapi/xlm route, the rest by the CoinGecko pass --
// and CoinGecko does not list LUMOS, so LUMOS never becomes live and must never be quoted from px.
// Measured before this gate existed: typing 711 LUMOS printed "You get ~ 177.39 USDC" for ~2 seconds
// (baked px 0.25) against a real 0.05 -- overstated 3,548x -- until the live path quote replaced it.
var LX_PXLIVE={USDC:true};
var LX_NETMAP={Ethereum:"ethereum",Avalanche:"avalanche",Optimism:"optimism",Arbitrum:"arbitrum",Base:"base",Polygon:"polygon",Solana:"solana",Sui:"sui",Linea:"linea","World Chain":"worldchain",
  // The eight destinations only LayerZero reaches. Each logo was fetched from DefiLlama's chain icon set, checked by
  // eye against the brand, resized to 96x96 and self-hosted under assets/networks/ -- never hotlinked.
  Sei:"sei",Berachain:"berachain",Ink:"ink",Hyperliquid:"hyperliquid",Monad:"monad",Flare:"flare",MegaETH:"megaeth",Plasma:"plasma"};
// THE PICKER'S ICONS, BY STYLESHEET. lxCctpNetLogos leaves an option alone when the design already gave it a url()
// background -- replacing it fought the design's re-render loop -- and Ethereum's option carries the design's own
// ETH-TOKEN diamond. So the list showed that, and the selected field our network logo (RAZA 2026-09-19: "Why is
// ethereum's logo different in the dropdown and different when selected"). An !important background outranks the
// inline one without touching the node, so there is nothing for the loop to fight and nothing to flash.
(function(){ try{ if(document.getElementById("lx-netbg"))return; var css="";
  Object.keys(LX_NETMAP).forEach(function(n){ css+='.brd-opt[data-net="'+n+'"] .brd-ic{background:url(/assets/networks/'+LX_NETMAP[n]+'.png) center/cover no-repeat !important;color:transparent !important}'; });
  var st=document.createElement("style"); st.id="lx-netbg"; st.textContent=css; (document.head||document.documentElement).appendChild(st); }catch(_){} })();
// per-network block explorer "wallet address" pages (for clickable recent-tx addresses)
var LX_ACCT_EXP={Ethereum:"https://etherscan.io/address/",Base:"https://basescan.org/address/",Arbitrum:"https://arbiscan.io/address/",Optimism:"https://optimistic.etherscan.io/address/",Polygon:"https://polygonscan.com/address/",Avalanche:"https://snowtrace.io/address/",Linea:"https://lineascan.build/address/","World Chain":"https://worldscan.org/address/",Solana:"https://solscan.io/account/",Sui:"https://suiscan.xyz/mainnet/account/",
  // The destinations LayerZero and NEAR Intents added: without these the To address on a Sei or Monad transfer was a
  // dead "#" link (RAZA 2026-09-20, visible on the phone's cards). Official explorers, address pages.
  // Each one opened on the address below before it was listed. seitrace.com is down (521 in a browser, not just to a
  // script) so Sei uses seistream; megaexplorer.xyz is a PARKED domain now and is deliberately absent -- a dead "#"
  // link is better than sending someone to a squatter, and MegaETH gets one back when it has a real explorer.
  Sei:"https://seistream.app/account/",Monad:"https://monadexplorer.com/address/",Berachain:"https://berascan.com/address/",
  Plasma:"https://plasmascan.to/address/",Flare:"https://flare-explorer.flare.network/address/",
  Hyperliquid:"https://hyperevmscan.io/address/",Ink:"https://explorer.inkonchain.com/address/"};
function lxSrcExp(pk){ return "https://stellar.expert/explorer/public/account/"+pk; }
function lxDstExp(net,a){ var b=LX_ACCT_EXP[net]; return b?b+a:"#"; }
var LX_SRC_ADDR="GC4WVG7LVFCSERJZVIB4WHBJCNCWUGHEVRHTAA6PSSDNRGEZWZMTEIUG"; // Stellar source placeholder; overwritten by real Freighter address on connect
window.__lxBr=window.__lxBr||{srcKey:"USDC", amount:"", pk:null, bals:null, _loading:false};

// ROUND DOWN for anything that is a balance. toLocaleString rounds half-up, so 0.03297 USDC showed as 0.033 and MAX
// filled 0.033 -- more than the wallet holds -- which then failed its own balance check (RAZA 2026-09-19).
function lxBrFloor(n,dp){ var f=Math.pow(10,dp); return Math.floor(n*f+1e-6)/f; }
// the exact spendable figure, Stellar precision (7dp), no separators -- what MAX writes into the field
function lxBrExact(n){ return lxBrFloor(n,7).toFixed(7).replace(/\.?0+$/,""); }
// a received amount: 4 decimals under 1, otherwise always exactly 2 ("9,957.60", never "9,957.6")
function lxBrAmt2(n){ if(!(n>0))return "0.00"; return n<1?lxBrFmt(n,4):Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}); }
function lxBrFmt(n,dp){ if(n==null||!isFinite(n))return "0"; return Number(n).toLocaleString("en-US",{maximumFractionDigits:dp==null?2:dp}); }
function lxBrShort(a){ return a&&a.length>12 ? a.slice(0,5)+"…"+a.slice(-4) : (a||""); }
function lxBrDestNet(){ var t=document.querySelector('.br-step[data-step="1"] .brd-trigger .nm'); return t?(t.textContent||"").trim():""; }
function lxBrBalOf(k){ var Bm=window.__lxBr.bals; if(!Bm)return null; return Bm[k]!=null?Bm[k]:0; }
// destination address validation. CCTP dests are EVM/Solana/Sui — none require a pre-existing USDC trustline
// (EVM: any address holds ERC-20 USDC; Solana ATA + Sui coin object are auto-created by CCTP mint). So format-check only.
var LX_EVM_NETS={Ethereum:1,Avalanche:1,Optimism:1,Arbitrum:1,Base:1,Polygon:1,Linea:1,'World Chain':1,
  // The LayerZero-only destinations are all EVM chains too, and USDT0's OFT takes the recipient as an EVM address
  // left-padded to 32 bytes. Without these entries any text at all passed the address check for them -- and a
  // cross-chain transfer to a mistyped address cannot be recalled.
  Berachain:1,Ink:1,Hyperliquid:1,Monad:1,Flare:1,Sei:1,MegaETH:1,Plasma:1};
function lxBrValidAddr(net,a){ a=(a||'').trim(); if(!a)return false; if(LX_EVM_NETS[net])return /^0x[0-9a-fA-F]{40}$/.test(a); if(net==='Solana')return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a); if(net==='Sui')return /^0x[0-9a-fA-F]{64}$/.test(a); return a.length>0; }
function lxBrStep2Err(msg){ var s2=document.querySelector('.br-step[data-step="2"]'); var e=s2?s2.querySelector('.br-errslot'):null; if(e){ e.textContent=msg||''; if(msg) e.setAttribute('data-err',msg); else e.removeAttribute('data-err'); e.style.color=msg?'#e04f4f':''; } }
// keep the Review button disabled until amount>0 AND a valid destination address; flag an invalid address in red
function lxBrValidateStep2(){
  var s2=document.querySelector('.br-step[data-step="2"]'); if(!s2)return false;
  var sides=s2.querySelectorAll('.br-side'); if(sides.length<2)return false;
  var k=window.__lxBr.srcKey; var amtIn=sides[0].querySelector('.br-amt .lx-amtin'); var amt=parseFloat((((amtIn?amtIn.value:'')||'').split(',').join('')))||0;
  var dstIn=sides[1].querySelector('.br-addr-in'); var addr=dstIn?(dstIn.value||'').trim():''; var net=lxBrDestNet();
  var bal=lxBrBalOf(k); var overBal=(bal!=null && amt>bal);
  // THE ROUTE MUST BE ONE THIS PAGE CAN SEND. Review -> Confirm runs the CCTP engine and nothing else; the LayerZero
  // send engine exists but is not wired to it. So with LayerZero chosen, Review would have sent the money by CCTP
  // (USDC instead of USDT0, to be claimed) -- or aimed CCTP at a LayerZero-only chain such as Plasma (found
  // 2026-09-19). The route panel publishes its choice in __lxBrRouteGate; with no panel rendered, nothing changes.
  var rg=window.__lxBrRouteGate, routeMsg="";
  if(rg&&rg.rendered&&amt>0&&!overBal){
    // LayerZero is sendable once its engine is live (LZ_SENDABLE, published by _lzusdt0.js); until then, blocked.
    // the chosen route can't take this amount (a minimum, the liquidity guard): it stays chosen, and says why
    if(rg.blocked) routeMsg=rg.blocked;
    else if(rg.route==="LayerZero"&&window.__lxLzSendable){ routeMsg=""; }
    else if(rg.route==="NEAR Intents"&&window.__lxNiSendable){ routeMsg=""; }
    else if(rg.route==="NEAR Intents") routeMsg="Sending by NEAR Intents isn't switched on yet — choose another route.";
    else if(rg.route==="LayerZero") routeMsg=rg.cctp
      ? "Sending by LayerZero isn't switched on yet — choose CCTP to continue."
      : "Sending to "+(net||"this network")+" isn't switched on yet — it can only be reached by LayerZero.";
    else if(rg.route!=="CCTP") routeMsg=rg.why||"No route can take this amount without a large loss. Try a smaller amount.";
  }
  var addrOk=lxBrValidAddr(net,addr), amtOk=(amt>0 && !overBal), ok=addrOk&&amtOk&&!routeMsg;
  var wrap=(dstIn&&dstIn.closest)?dstIn.closest('.br-wallet'):null;
  if(wrap){ if(addr&&!addrOk) wrap.classList.add('lx-invalid'); else wrap.classList.remove('lx-invalid'); }
  // inline error (balance-exceeded takes priority over a malformed address)
  if(overBal) lxBrStep2Err("Amount exceeds your balance ("+lxBrFmt(lxBrFloor(bal,bal>=1000?2:4),bal>=1000?2:4)+" "+k+").");
  else if(routeMsg) lxBrStep2Err(routeMsg);
  else if(addr && !addrOk) lxBrStep2Err("That doesn't look like a valid "+(net||'destination')+" address.");
  else lxBrStep2Err("");
  var rev=s2.querySelector('[data-go="3"]');
  if(rev){ rev.disabled=!ok; if(ok) rev.classList.remove('lx-disabled'); else rev.classList.add('lx-disabled'); rev.setAttribute('aria-disabled',ok?'false':'true'); }
  return ok;
}

function lxIssShort(k){ if(k==="XLM")return "Native asset"; var C=window.__lxCCTP; if(k==="USDC")return (C&&C.usdcIssuer)?lxBrShort(C.usdcIssuer):"—"; var sp=(LX_ASSETS[k]||{}).spec; return (sp&&sp.issuer)?lxBrShort(sp.issuer):"—"; }
function lxBrAssetMenu(anchor){
  var m=document.getElementById("lx-br-amenu");
  if(!m){
    if(!document.getElementById("lx-br-amenu-css")){ var st=document.createElement("style"); st.id="lx-br-amenu-css";
      st.textContent=".lx-br-amenu{background:var(--surface-2,#fff);border:1px solid var(--border,#ececef);border-radius:14px;box-shadow:0 18px 44px rgba(0,0,0,.28);padding:6px;font:inherit;color:var(--text,#0e0e10)}"
        +".lx-amsearch{padding:4px 4px 6px}"
        +".lx-amq{width:100%;box-sizing:border-box;background:var(--surface,#f6f7f9);border:1px solid var(--border,#ececef);border-radius:9px;color:var(--text,#0e0e10);font:inherit;font-size:13px;padding:8px 10px;outline:none}"
        +".lx-amq::placeholder{color:var(--text-soft,#8a90a2)}"
        +".lx-amq:focus{border-color:rgba(234,106,44,.55);box-shadow:0 0 0 3px rgba(234,106,44,.1)}"
        +".lx-amlist{max-height:264px;overflow:auto}"
        +".lx-br-amenu button{display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;border:0;border-radius:10px;background:transparent;color:inherit;font:inherit;cursor:pointer;text-align:left}"
        +".lx-br-amenu button:hover{background:var(--surface,#f4f5f7)}"
        +".lx-br-amenu .aic{width:26px;height:26px;border-radius:50%;overflow:hidden;display:inline-flex;flex:0 0 26px;background:var(--surface,#f0f1f4)}"
        +".lx-br-amenu .aic img{width:100%;height:100%;object-fit:cover;display:block}"
        +".lx-br-amenu .atx{display:flex;flex-direction:column;line-height:1.25;min-width:0}"
        +".lx-br-amenu .anm{font-size:14px;font-weight:600}"
        +".lx-br-amenu .aiss{font-size:11px;color:var(--text-soft,#8a90a2);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}";
      document.head.appendChild(st); }
    m=document.createElement("div"); m.id="lx-br-amenu"; m.className="lx-br-amenu"; m.style.cssText="position:absolute;z-index:99999;min-width:236px;display:none";
    m.innerHTML='<div class="lx-amsearch"><input class="lx-amq" type="text" placeholder="Search asset or issuer" spellcheck="false" autocomplete="off"></div>'
      +'<div class="lx-amlist">'+LX_AORDER.map(function(k){ return '<button type="button" data-ak="'+k+'"><span class="aic"><img src="'+LX_ASSETS[k].logo+'" alt=""></span><span class="atx"><span class="anm">'+k+'</span><span class="aiss">'+lxIssShort(k)+'</span></span></button>'; }).join("")+'</div>';
    document.body.appendChild(m);
    m.addEventListener("click",function(e){ var b=e.target.closest("[data-ak]"); if(!b)return; window.__lxBr.srcKey=b.getAttribute("data-ak"); m.style.display="none"; lxBrRenderSource(); lxBrCalc(); });
    var q=m.querySelector(".lx-amq");
    if(q){ q.addEventListener("input",function(){ var v=(q.value||"").trim().toLowerCase(); [].slice.call(m.querySelectorAll(".lx-amlist button")).forEach(function(b){ var kk=b.getAttribute("data-ak").toLowerCase(); var iss=((b.querySelector(".aiss")||{}).textContent||"").toLowerCase(); b.style.display=(!v||kk.indexOf(v)>=0||iss.indexOf(v)>=0)?"flex":"none"; }); });
      q.addEventListener("click",function(e){ e.stopPropagation(); }); q.addEventListener("keydown",function(e){ e.stopPropagation(); }); }
  }
  var open=m.style.display==="block";
  if(open){ m.style.display="none"; return; }
  var r=anchor.getBoundingClientRect();
  m.style.left=(window.scrollX+r.left)+"px"; m.style.top=(window.scrollY+r.bottom+6)+"px"; m.style.display="block";
  var qi=m.querySelector(".lx-amq"); if(qi){ qi.value=""; [].slice.call(m.querySelectorAll(".lx-amlist button")).forEach(function(b){ b.style.display="flex"; }); setTimeout(function(){ qi.focus(); },10); }
}

function lxBrRenderSource(){
  var s2=document.querySelector('.br-step[data-step="2"]'); if(!s2)return;
  var side=s2.querySelectorAll('.br-side')[0]; if(!side)return;
  var k=window.__lxBr.srcKey, A=LX_ASSETS[k]||LX_ASSETS.USDC;
  // ensure the editable amount <input> exists — re-create if the design re-rendered the row (e.g. after wallet/balance load), preserving the typed value
  var vEl=side.querySelector('.br-amt .v');
  if(vEl && !vEl.querySelector('.lx-amtin')){ var prev=(window.__lxBr.amount||''); vEl.textContent=''; var ain=document.createElement('input'); ain.className='lx-amtin'; ain.type='text'; ain.setAttribute('inputmode','decimal'); ain.setAttribute('placeholder','0'); ain.setAttribute('aria-label','Amount to swap'); ain.value=prev; vEl.appendChild(ain);
    ain.addEventListener('input',function(){ var c=ain.value.replace(/[^0-9.]/g,''); var i=c.indexOf('.'); if(i>=0) c=c.slice(0,i+1)+c.slice(i+1).replace(/[.]/g,''); if(c!==ain.value) ain.value=c; lxBrCalc(); });
    ain.addEventListener('keydown',function(e){ if(e.key==="Enter"){ e.preventDefault(); ain.blur(); } }); }
  var chip=side.querySelector('.br-asset');
  if(chip){ var nm=chip.querySelector('.nm'); if(nm)nm.textContent=k; var im=chip.querySelector('.lx-assetic img'); if(im){ if(im.getAttribute('src')!==A.logo) im.src=A.logo; } else { var ic=chip.querySelector('.lx-assetic')||chip.querySelector('.br-ic'); if(ic) ic.innerHTML='<img src="'+A.logo+'" style="width:100%;height:100%;object-fit:cover;display:block" alt="">'; } }
  var addr=side.querySelector('.br-wallet .addr'); if(addr){ var full=window.__lxBr.pk||LX_SRC_ADDR, sh=lxBrShort(full); if(addr.textContent!==sh){ addr.textContent=sh; addr.title=full; } }
  var bal=side.querySelector('.bal');
  if(bal){ var b=lxBrBalOf(k); var maxEl=bal.querySelector('.max'); var bStr=(b==null?"—":lxBrFmt(lxBrFloor(b,b>=1000?2:4),b>=1000?2:4));
    var txt=bal.querySelector('.lx-bal-txt');
    if(!txt){ txt=document.createElement('span'); txt.className='lx-bal-txt'; var fc=bal.firstChild; if(fc&&fc.nodeType===3){ bal.replaceChild(txt,fc); } else { bal.insertBefore(txt,bal.firstChild); } }
    txt.textContent="Balance: "+bStr+" "+k+" ";
    if(maxEl){ maxEl.removeAttribute('data-logo'); maxEl.style.background=""; maxEl.style.boxShadow="none"; maxEl.classList.add('lx-maxbtn'); } }
}

function lxBrRenderDest(){
  var s2=document.querySelector('.br-step[data-step="2"]'); if(!s2)return;
  var side=s2.querySelectorAll('.br-side')[1]; if(!side)return;
  var net=lxBrDestNet(), nkey=LX_NETMAP[net];
  var chip=side.querySelector('.br-asset');
  if(chip){ var nm=chip.querySelector('.nm'); if(nm&&nm.textContent!=="USDC")nm.textContent="USDC"; var ic=chip.querySelector('.lx-assetic')||chip.querySelector('.br-ic'); if(ic && !ic.querySelector('img')) ic.innerHTML='<img src="/assets/tokens/usdc.png" style="width:100%;height:100%;object-fit:cover;display:block" alt="">'; var cv=chip.querySelector('.cv'); if(cv)cv.style.display="none"; }
  if(nkey){ var lead=side.querySelector('.br-wallet .br-ic.lx-netic')||side.querySelector('.br-ic.lx-netic'); if(lead && !(lead.querySelector('img')&&lead.querySelector('img').getAttribute('src').indexOf(nkey)>=0)) lead.innerHTML='<img class="lx-netimg" src="/assets/networks/'+nkey+'.png" alt="">'; }
  // note: do NOT touch the input placeholder — the finalized design animates/owns it; overriding here caused flicker.
}

// The .usd line has no .lc-money child in this markup -- measured: ".br-amt .usd .lc-money" matches
// ZERO elements on the page. So this returned early on every call and BOTH dollar figures kept the
// design's mock "~ $100.00" / "~ $92.00" for the life of the session, whatever was actually typed.
// It reads as a USDC-only bug because the mock happens to look like a plausible USDC bridge; with XLM
// selected it says $100.00 over 10 XLM, which is off by ~54x. On a screen that moves real money the
// dollar figure is the number people sanity-check against, so this is the whole bug.
// Write the money element when there is one, and the .usd line itself when there is not.
function lxBrMoney(side, usd){
  if(!side)return;
  // Under a cent says so. Rounded to 2dp, 0.5125 SHX (~$0.0018) read "~ $0" -- as if SHX had no price at all.
  // Always two decimals: "$10,003.5" read as a different precision from its neighbours.
  var s=(usd>0&&usd<0.01)?"< $0.01":"$"+Number(usd).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}), v=String(Math.round(usd*100)/100);
  var el=side.querySelector('.br-amt .usd .lc-money');
  if(el){ el.setAttribute('data-usd',v); el.setAttribute('data-orig',s); el.textContent=s; return; }
  var u=side.querySelector('.br-amt .usd')||side.querySelector('.usd');
  if(!u)return;
  var pre=(s.charAt(0)==="<")?"":"~ ";                                                  // "< $0.01" is already approximate
  u.setAttribute('data-usd',v); u.setAttribute('data-orig',pre+s); u.textContent=pre+s;   // design format
}
// The dollar line while no live price is known. data-usd stays 0 so the money-hiding toggle has a number
// to work from, but the visible text says "unknown" rather than naming a figure derived from a guess.
function lxBrMoneyPending(side){
  if(!side)return;
  var el=side.querySelector('.br-amt .usd .lc-money')||side.querySelector('.br-amt .usd')||side.querySelector('.usd');
  if(!el)return;
  el.setAttribute('data-usd','0'); el.setAttribute('data-orig',"~ $—"); el.textContent="~ $—";
}
// Load LIVE market prices (CoinGecko) into the px table so the $ / USDC estimates are real, not hardcoded.
// Falls back silently to the built-in px values if the request fails.
var __lxPxLoaded=false;
function lxCctpLoadPrices(){
  if(__lxPxLoaded)return; __lxPxLoaded=true;
  var CG={stellar:["XLM","yXLM"],"usd-coin":["USDC"],"stronghold-token":["SHX"],blend:["BLND"],aquarius:["AQUA"]};
  var ids=Object.keys(CG).join(",");
  // XLM comes from our own cached, Horizon-backed edge route FIRST -- the same source the wallet and
  // the Trade pages use. CoinGecko is one third-party request away from rate-limiting us, and when it
  // fails this table falls back to a baked px of 0.12 against a real ~0.18: a third off, on the dollar
  // figure beside a bridge amount. This route is ours and cached, so it does not have that failure mode.
  fetch("/lxapi/xlm").then(function(r){return r.ok?r.json():null;}).then(function(x){
    var u=x&&+x.usd; if(u>0){ window.__lxXlmUsd=u; if(LX_ASSETS.XLM)LX_ASSETS.XLM.px=u; LX_PXLIVE.XLM=true; try{ lxBrCalc(); }catch(_){} }
  }).catch(function(){});
  fetch("https://api.coingecko.com/api/v3/simple/price?ids="+ids+"&vs_currencies=usd").then(function(r){return r.json();}).then(function(j){
    if(!j)throw new Error("no price data");
    var xlm=j.stellar&&j.stellar.usd; if(xlm>0&&!(window.__lxXlmUsd>0)){ window.__lxXlmUsd=xlm; LX_PXLIVE.XLM=true; }   // the edge route wins
    Object.keys(CG).forEach(function(id){ var p=j[id]&&j[id].usd; if(p>0){ CG[id].forEach(function(k){
      if(k==="XLM"&&window.__lxXlmUsd>0)return;                                                  // ditto
      if(LX_ASSETS[k]){ LX_ASSETS[k].px=p; LX_PXLIVE[k]=true; } }); } });
    try{ lxBrCalc(); }catch(_){}
  }).catch(function(){ __lxPxLoaded=false; });
}
function lxBrCalc(){
  var s2=document.querySelector('.br-step[data-step="2"]'); if(!s2)return;
  var sides=s2.querySelectorAll('.br-side'); if(sides.length<2)return;
  var amtIn=sides[0].querySelector('.br-amt .lx-amtin'); var amtEl=sides[0].querySelector('.br-amt .v'); var outEl=sides[1].querySelector('.br-amt .v'); if(!outEl)return;
  var raw=((amtIn?amtIn.value:(amtEl?amtEl.textContent:""))||"").split(",").join("").trim(); var amt=parseFloat(raw)||0; window.__lxBr.amount=raw;
  lxBrValidateStep2();
  var k=window.__lxBr.srcKey, A=LX_ASSETS[k]||LX_ASSETS.USDC, C=window.__lxCCTP, feeRate=(window.__lxFeeRate||(C&&C.feeRate)||0.002);
  // AUDIT #3 bug 1/2 (FUNDS): "You get" used the static px table — a TESTNET-era decision ("don't quote the
  // testnet pool") that was flat wrong on mainnet, where the pools ARE the market. LUMOS (not on CoinGecko)
  // kept its baked px:0.25 against a real ~$0.00005, quoting ~4,800x the deliverable amount; execution then
  // swapped at the REAL path rate, so the burn was safe but the preview and Review screen lied. Now: the px
  // figure paints instantly as a placeholder, and a debounced LIVE strict-send path quote — the same rate
  // execution uses — overwrites it. If no path exists, show a dash and zero the target: execution would
  // fail on that pair anyway, and an honest dash beats an invented number.
  // AUDIT #3 left the px table painting the FIRST figure the user sees, with the live quote arriving ~2s
  // later. That is fine for an asset whose px is live and wrong for one whose px is a baked guess: LUMOS
  // is not listed on CoinGecko, so it kept px 0.25 against a real ~0.00007 and printed a number 3,548x
  // too big beside a bridge amount. The same happens to SHX/BLND/AQUA/yXLM whenever the CoinGecko call
  // fails and their baked values stand in. So gate on whether the price is LIVE, not on which asset it is:
  // an honest "—" for a second beats a confident wrong number, and the quote fills it in either way.
  var pxLive = (k==="USDC") || (k==="XLM" ? !!(window.__lxXlmUsd>0) : !!LX_PXLIVE[k]);
  var pxu = k==="USDC"?1:(k==="XLM"?(window.__lxXlmUsd||A.px):A.px);
  var srcUsd=amt*pxu, out=amt*pxu*(1-feeRate);
  if(pxLive) lxBrMoney(sides[0], srcUsd); else lxBrMoneyPending(sides[0]);
  if(amt<=0){ outEl.textContent="~ 0.00"; lxBrMoney(sides[1],0); window.__lxBr.netUsdc=0; return; }
  if(pxLive){ outEl.textContent="~ "+lxBrAmt2(out); lxBrMoney(sides[1], out); window.__lxBr.netUsdc=+out.toFixed(7); }
  else { outEl.textContent="~ —"; lxBrMoneyPending(sides[1]); window.__lxBr.netUsdc=0; }
  if(k==="USDC")return;                                     // USDC->USDC: amt*(1-fee) IS exact, nothing to quote
  // LANDMINE: lxBrCalc is re-invoked on a ~200ms design loop, so a plain debounce (clearTimeout on every
  // call) NEVER fired — measured seq climbing 2,4,5,6,8… while the quote never ran. Key the work on the
  // INPUTS (asset+amount) instead: identical inputs reuse the in-flight/finished quote, and only a genuine
  // change starts a new one. Cache by key so re-renders repaint the real number instead of the px estimate.
  var Q=window.__lxBrQ=window.__lxBrQ||{key:null,val:null,busy:false,cache:{}};
  var qk=k+"|"+amt.toFixed(7)+"|"+feeRate;
  function paint(real){
    if(real==null){ outEl.textContent="~ —"; lxBrMoney(sides[1],0); window.__lxBr.netUsdc=0; return; }
    outEl.textContent="~ "+lxBrAmt2(real); lxBrMoney(sides[1], real);
    // The SOURCE dollar line is the value of what you send: amount x live price. It used to be rebuilt from the swap
    // quote (real/(1-fee)), which is what you RECEIVE and moves with whichever path Horizon picks that instant -- so
    // 51,981 XLM read $10,003.50, 51,982 read $9,996.77 and 51,983 read $10,001.08 (RAZA 2026-09-19): more XLM, fewer
    // dollars. Only an asset with no live price (LUMOS, most curated extras) still takes its value from the quote.
    window.__lxBr.netUsdc=+real.toFixed(7); if(!pxLive) lxBrMoney(sides[0], real/(1-feeRate));
  }
  if(Object.prototype.hasOwnProperty.call(Q.cache,qk)){ paint(Q.cache[qk]); return; }
  if(Q.key===qk)return;                                     // already in flight for exactly these inputs
  Q.key=qk;
  var swapAmt=amt*(1-feeRate); if(!(swapAmt>0))return;
  lxStrictPath(C, A.spec.native?{native:true}:A.spec, swapAmt.toFixed(7), {code:"USDC",issuer:C.usdcIssuer})
    .then(function(p){ Q.cache[qk]=+p.out; if(Q.key===qk)paint(+p.out); })
    .catch(function(){ Q.cache[qk]=null; if(Q.key===qk)paint(null); });
}

// After a transfer the balances on screen are stale -- the source asset (and the XLM for fees) just left the wallet.
// Re-read them WITHOUT a wallet prompt: clearing bals lets the non-forced path through, which only asks isAllowed.
// Once now and again after 6s, because Horizon can lag the ledger by a close or two.
function lxBrRefreshBalances(){ try{ var go=function(){ var B=window.__lxBr; if(!B||B._loading)return; B.bals=null; lxBrLoadWallet(false); }; go(); setTimeout(go,6000); }catch(_){} }
window.lxBrRefreshBalances=lxBrRefreshBalances;
function lxBrLoadWallet(force){
  var B=window.__lxBr; if(B._loading||(B.pk&&B.bals&&!force))return; B._loading=true;
  try{ lxCctpSigner().then(function(f){
    function grab(){ return Promise.resolve(f.getAddress?f.getAddress():f.getPublicKey()).then(function(a){ return (a&&a.address)||a; }); }
    var gate = force ? Promise.resolve(f.requestAccess?f.requestAccess():null) : (f.isAllowed?Promise.resolve(f.isAllowed()).then(function(ok){ if(!ok) throw new Error("not-allowed"); }):Promise.resolve());
    return gate.then(grab).then(function(pk){ if(!pk)throw new Error("no-pk"); B.pk=pk; var C=window.__lxCCTP;
      return fetch(C.horizon+"/accounts/"+pk).then(function(r){return r.json();}).then(function(ac){ var m={};
      // SPENDABLE, not held (RAZA 2026-09-19: 32.45 XLM shown, 5 XLM refused op_underfunded). Stellar locks 0.5 XLM per
      // subentry plus 1 base -- his 61 trustlines, pool shares and offers held 31.5 of the 32.45, leaving 0.95 -- and an
      // open offer reserves its selling amount of any asset. "Available to send", MAX and the balance check all read
      // this, so each now means what it says. XLM also keeps 0.3 back for the network fees of the burn itself: a
      // transfer that spends every lumen on the swap cannot then pay to send what it swapped.
      var res=(2+(+ac.subentry_count||0)+(+ac.num_sponsoring||0)-(+ac.num_sponsored||0))*0.5;
      (ac.balances||[]).forEach(function(x){
        var free=(parseFloat(x.balance)||0)-(parseFloat(x.selling_liabilities)||0);
        if(x.asset_type==="native") m.XLM=Math.max(0,+(free-res-0.3).toFixed(7));
        else if(x.asset_code) m[x.asset_code]=Math.max(0,+free.toFixed(7)); });
      B.bals=m; B._loading=false; lxBrRenderSource(); });
    });
  }).catch(function(){ B._loading=false; lxBrRenderSource(); }); }catch(_){ B._loading=false; }
}

function lxCctpWireStep2(){
  var s2=document.querySelector('.br-step[data-step="2"]'); if(!s2)return;
  var sides=s2.querySelectorAll('.br-side'); if(sides.length<2)return; var srcSide=sides[0], dstSide=sides[1];
  if(!s2.__lxWired){ s2.__lxWired=true;
    // relabel "Amount" -> "You swap" and relocate balance beneath the amount value
    try{ var amtrow=srcSide.querySelector('.br-amtrow'); if(amtrow){ var lbl=amtrow.querySelector('span:not(.bal)'); if(lbl) lbl.textContent="You swap"; }
      var amtBox=srcSide.querySelector('.br-amt'), balEl=srcSide.querySelector('.bal');
      if(amtBox && balEl && !srcSide.querySelector('.lx-balrow')){ var balrow=document.createElement('div'); balrow.className='lx-balrow'; balrow.appendChild(balEl); amtBox.appendChild(balrow); }
    }catch(_){}
    var sChip=srcSide.querySelector('.br-asset'); if(sChip) sChip.addEventListener('click',function(e){ e.stopPropagation(); e.preventDefault(); lxBrAssetMenu(sChip); },true);
    var dChip=dstSide.querySelector('.br-asset'); if(dChip){ dChip.style.cursor="default"; dChip.addEventListener('click',function(e){ e.stopPropagation(); e.preventDefault(); },true); }
    lxBrRenderSource(); // creates the amount <input> (idempotent, value-preserving)
    var amtBox=srcSide.querySelector('.br-amt'); if(amtBox) amtBox.addEventListener('click',function(e){ if(e.target.closest && e.target.closest('.max'))return; var i=amtBox.querySelector('.lx-amtin'); if(i) i.focus(); });
    var maxEl=srcSide.querySelector('.bal .max'); if(maxEl){ maxEl.style.cursor="pointer"; maxEl.addEventListener('click',function(e){ e.stopPropagation(); var b=lxBrBalOf(window.__lxBr.srcKey); if(b==null){ lxBrLoadWallet(true); return; } var a2=srcSide.querySelector('.br-amt .lx-amtin'); if(a2){ a2.value=lxBrExact(b); lxBrCalc(); } }); }
    var wc=srcSide.querySelector('.br-wallet'); if(wc) wc.addEventListener('click',function(){ if(!window.__lxBr.pk) lxBrLoadWallet(true); },false);
    // gate: block advance to Review unless a valid destination address is present
    var dstInEl=dstSide.querySelector('.br-addr-in'); var revBtn=s2.querySelector('[data-go="3"]');
    // Letting the phone grid shrink (see the max-width:760px block) leaves this input about 136px, and
    // the design's "Enter receiving address" needs 203px -- it was being cut to "Enter receiving".
    // MEASURE rather than assume a breakpoint: swap in the short wording only when the real one does not
    // actually fit, so the desktop keeps its own copy and this keeps working if the layout moves again.
    function lxFitAddrPh(){ try{
      if(!dstInEl || dstInEl.value) return;
      var cs=getComputedStyle(dstInEl);
      var avail=dstInEl.clientWidth-(parseFloat(cs.paddingLeft)||0)-(parseFloat(cs.paddingRight)||0);
      if(!(avail>0)) return;
      if(!dstInEl.__lxPhFull) dstInEl.__lxPhFull=dstInEl.placeholder||"";
      var m=document.createElement("span");
      m.style.cssText="position:absolute;visibility:hidden;white-space:pre;font:"+cs.font;
      m.textContent=dstInEl.__lxPhFull; document.body.appendChild(m);
      var need=m.getBoundingClientRect().width; m.remove();
      var want=(need>avail)?"Wallet address":dstInEl.__lxPhFull;
      if(dstInEl.placeholder!==want) dstInEl.placeholder=want;
    }catch(_){} }
    lxFitAddrPh(); setTimeout(lxFitAddrPh,300); window.addEventListener("resize",lxFitAddrPh);
    if(revBtn) revBtn.addEventListener('click',function(e){ var net=lxBrDestNet(); var a=dstInEl?(dstInEl.value||'').trim():''; var msg=''; if(!a) msg="Enter the destination address to continue."; else if(!lxBrValidAddr(net,a)) msg="That doesn't look like a valid "+(net||'destination')+" address."; if(msg){ e.stopPropagation(); e.preventDefault(); lxBrStep2Err(msg); if(dstInEl) dstInEl.focus(); } else { lxBrStep2Err(''); } },true);
    if(dstInEl) dstInEl.addEventListener('input',function(){ if(lxBrValidAddr(lxBrDestNet(),(dstInEl.value||'').trim())) lxBrStep2Err(''); lxBrValidateStep2(); });
    // Paste button -> read clipboard into the destination input
    var pasteBtn=dstSide.querySelector('.br-paste');
    // The clipboard permission, watched OUTSIDE the tap. Querying it is async, and awaiting anything inside the tap
    // spends the activation a clipboard read needs -- so it is read here, on load, and kept current by the browser's
    // own change event. Never prompts; it only reports what has already been decided.
    if(!window.__lxClipWatch){
      window.__lxClipWatch=1;
      try{
        if(navigator.permissions&&navigator.permissions.query){
          navigator.permissions.query({name:"clipboard-read"}).then(function(st){
            if(!st)return; window.__lxClipPerm=st.state;
            try{ st.onchange=function(){ window.__lxClipPerm=st.state; }; }catch(_){ }
          }).catch(function(){});
        }
      }catch(_){ }
    }
    if(pasteBtn) pasteBtn.addEventListener('click',function(e){ e.preventDefault(); e.stopPropagation();
      function set(t){ if(dstInEl){ dstInEl.value=(t||'').trim(); dstInEl.dispatchEvent(new Event('input',{bubbles:true})); /* filled: no keyboard needed (RAZA 2026-09-19) */ dstInEl.blur(); } }
      // ONE READ, INSIDE THE TAP. A clipboard read is only allowed while the tap that asked for it is still "active";
      // a retry on a timer has no such activation, and Chrome answers those with "This site can't ask for your
      // permission" -- the dialog RAZA saw on the tablet AND then on a phone where Paste had worked that morning. The
      // retries I added earlier today were themselves the cause, so there are none: the read happens in the handler and
      // nowhere else. When it fails (a refused permission, an overlay from another app blocking the prompt), the field
      // is focused and the way out is named -- tapping Paste again after granting is a new tap, and a new activation.
      // DO NOT ASK WHEN THE ANSWER IS ALREADY NO. Chrome refuses a clipboard read when the page is not the focused
      // window -- which is what an overlay from another app causes -- and refuses when the permission is set to Block;
      // in both cases it puts up "This site can't ask for your permission" (RAZA 2026-09-20, repeatedly, on a tablet
      // with a floating bubble on screen). Both conditions can be checked WITHOUT calling the clipboard, so the dialog
      // never appears: document.hasFocus() is synchronous, and the permission state is kept up to date in the
      // background (lxClipPerm) since querying it inside the tap would spend the tap's activation.
      var can=!!(navigator.clipboard&&navigator.clipboard.readText);
      // ask for the focus back first -- a tap on our own button usually has it already, and this costs nothing
      try{ window.focus(); }catch(_){ }
      var focused=true; try{ focused=document.hasFocus(); }catch(_){ }
      if(!can||!focused||window.__lxClipPerm==="denied"){ _pasteManual(!focused?"unfocused":(window.__lxClipPerm==="denied"?"denied":"")); return; }
      navigator.clipboard.readText().then(function(t){
        t=String(t==null?"":t).trim();
        if(!t){ if(dstInEl) dstInEl.focus(); lxBrToast("Nothing to paste \u2014 the clipboard is empty",true); return; }
        set(t);
      }).catch(function(err){
        // "denied" here is Chrome's own record for this site -- the permission is set to Block, and no retry, gesture
        // or dialog can get past it. Only the reader can undo it, so say exactly where.
        var nm=""; try{ nm=String((err&&err.name)||""); }catch(_){ }
        _pasteManual(nm==="NotAllowedError"&&window.__lxClipPerm==="denied"?"denied":"");
      });
      function _pasteManual(why){
        // Focus the field: on a phone that opens the keyboard, whose own Paste sits one tap away -- no permission, no
        // dialog, nothing for an overlay to block.
        if(dstInEl){ try{ dstInEl.focus(); }catch(_){ } }
        var touch=false; try{ touch=window.matchMedia("(pointer:coarse)").matches; }catch(_){ }
        // BLOCKED IS NOT THE SAME AS BUSY, and the difference is the only thing the reader can act on: a blocked
        // permission lives in Chrome's own site settings (RAZA 2026-09-20 -- clipboard access was set to Block for
        // lumoscore.com, which is why tapping Paste could never fill the field however the page asked).
        if(why==="denied"){
          lxBrToast(touch ? "Clipboard is blocked for this site \u2014 tap the lock beside the address, then Permissions \u2192 Clipboard \u2192 Allow"
                          : "Clipboard is blocked for this site \u2014 allow it from the lock icon beside the address, or press Ctrl+V",true);
          return;
        }
        lxBrToast(!touch ? "Couldn\u2019t read the clipboard \u2014 press Ctrl+V to paste"
          : (why==="unfocused" ? "Use Paste on the keyboard, or long-press the field \u2014 another app is over this window"
                               : "Use Paste on the keyboard, or long-press the field and choose Paste"),true);
      }
    },true);
    // close the source asset dropdown when clicking anywhere outside it
    document.addEventListener('click',function(e){ var m=document.getElementById('lx-br-amenu'); if(m&&m.style.display==="block"&&!m.contains(e.target)&&!(sChip&&sChip.contains(e.target))) m.style.display="none"; });
  }
  lxCctpLoadPrices(); lxBrRenderSource(); lxBrRenderDest(); lxBrCalc(); lxBrLoadWallet(false);
}

(function(){
  function shown(){ var s2=document.querySelector('.br-step[data-step="2"]'); return s2 && !s2.hasAttribute('hidden') && getComputedStyle(s2).display!=="none"; }
  function onShow(){ if(shown()) lxCctpWireStep2(); }
  var n=0, iv=setInterval(function(){ n++; onShow(); if(n>40) clearInterval(iv); },300);
  document.addEventListener('click',function(e){ if(e.target.closest && e.target.closest('[data-go="2"]')){ setTimeout(onShow,50); setTimeout(onShow,260); } },true);
  try{ var mo=new MutationObserver(onShow); var s2=document.querySelector('.br-step[data-step="2"]'); if(s2) mo.observe(s2,{attributes:true,attributeFilter:["hidden","style","class"]}); }catch(_){}
})();

// ---- Step 3: populate Review from state + hook Confirm -> lxCctpBridgeFull + append Recent transaction ----
function lxBrStellarIcon(){ var el=document.querySelector('.br-step[data-step="1"] .br-netbox .br-netchip .br-ic')||document.querySelector('.br-step[data-step="2"] .br-side .br-wallet .br-ic.lx-netic'); return el?el.innerHTML:''; }
// This used to scrape the icon out of a seeded row. Emptying the design's mock rows took that source away
// and every link fell back to a text arrow. Inline the mark instead — the same external-link glyph the
// Trade-asset Recent trades table uses, so the two read identically.
var LX_XPSVG='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
function lxBrXpIcon(){ return LX_XPSVG; }
function lxBrReview(){
  var s3=document.querySelector('.br-step[data-step="3"]'); if(!s3)return;
  var legs=s3.querySelectorAll('.br-rv-leg'); if(legs.length<2)return;
  var B=window.__lxBr, k=B.srcKey, A=LX_ASSETS[k]||LX_ASSETS.USDC, net=lxBrDestNet();
  var s2=document.querySelector('.br-step[data-step="2"]');
  var outEl=s2?s2.querySelectorAll('.br-side')[1].querySelector('.br-amt .v'):null;
  var recv=outEl?(outEl.textContent||"").trim():"~ 0"; var amt=B.amount||"0";
  var sendAm=legs[0].querySelector('[data-rv="send"]'); if(sendAm) sendAm.textContent=amt+" "+k;
  var sendNet=legs[0].querySelector('[data-rv="sendnet"]'); if(sendNet) sendNet.textContent="Stellar";
  var sIc=legs[0].querySelector('.v .ic:not(.lx-rvnet)'); if(sIc) sIc.innerHTML='<img src="'+A.logo+'" style="width:100%;height:100%;object-fit:cover;display:block" alt="">';
  var recvAm=legs[1].querySelector('[data-rv="recv"]'); if(recvAm) recvAm.textContent=recv+" USDC";
  var recvNet=legs[1].querySelector('[data-rv="recvnet"]'); if(recvNet) recvNet.textContent=net||"—";
  var rIc=legs[1].querySelector('.v .ic:not(.lx-rvnet)'); if(rIc) rIc.innerHTML='<img src="/assets/tokens/usdc.png" style="width:100%;height:100%;object-fit:cover;display:block" alt="">';
  var srcRow=s3.querySelector('[data-rv="src"]'); if(srcRow) srcRow.innerHTML='<span class="lx-rvaddric">'+lxBrStellarIcon()+'</span><span>'+lxBrShort(B.pk||LX_SRC_ADDR)+'</span>';
  var dstIn=s2?s2.querySelector('.br-addr-in'):null; var dst=dstIn?(dstIn.value||"").trim():""; var nkey=LX_NETMAP[net];
  var dstRow=s3.querySelector('[data-rv="dst"]'); if(dstRow){ if(dst){ dstRow.innerHTML=(nkey?'<span class="lx-rvaddric"><img class="lx-netimg" src="/assets/networks/'+nkey+'.png" alt=""></span>':'')+'<span>'+lxBrShort(dst)+'</span>'; } else dstRow.textContent="—"; }
  // Bridge fee row: show the actual amount, not just the rate. It always read "0.2%" and nothing else,
  // while "You send" showed the gross amount — so from the review alone there was no way to tell the fee
  // had been taken at all. It is deducted from the source asset, so name it in the source asset.
  var bf=s3.querySelector('.lx-bfee .v');
  if(bf){
    var _fr=(window.__lxFeeRate||(window.__lxCCTP&&window.__lxCCTP.feeRate)||0.002);
    var _sa=parseFloat(String(amt).replace(/,/g,""))||0, _fa=_sa*_fr;
    var _amtTxt=_fa>0?(_fa<0.0001?_fa.toFixed(7):_fa.toLocaleString("en-US",{maximumFractionDigits:6})):"";
    var _pct=(_fr*100).toFixed(2).replace(/0$/,"").replace(/\.$/,"")+"%";
    bf.innerHTML=_pct+(_amtTxt?' <span class="lx-bamt">· '+_amtTxt+' '+lxBrEsc(k)+'</span>':'')
      +(_fr>0.0015?'<span class="lx-bchip">0.1% with LUMOS</span>':'<span class="lx-bchip">LUMOS holder rate</span>');
  }
  // Circle CCTP fee row — Standard transfer is free (only our 0.2%/0.1% applies). Structured so a Fast-transfer fee could slot in later.
  var list=s3.querySelector('.br-rv-list');
  if(list && !list.querySelector('.lx-cfee')){ var feeRow=list.querySelector('.lx-bfee'); var r=document.createElement('div'); r.className='r lx-cfee'; r.innerHTML='<span class="k">Circle CCTP fee</span><span class="v">Free <span class="lx-cchip">Standard transfer</span></span>'; if(feeRow) feeRow.parentNode.insertBefore(r, feeRow.nextSibling); else list.appendChild(r); }
  // THE REVIEW FOLLOWS THE ROUTE. With LayerZero chosen it said "USDC", showed the USDC logo and "Circle CCTP fee:
  // Free" -- a review of a transfer that was not the one about to be signed. Rewritten on every show, both ways.
  var cf=list?list.querySelector('.lx-cfee'):null;
  if(window.__lxBrRoute==="LayerZero"){
    var rv=document.documentElement.getAttribute('data-lxroute-recv')||"";
    var rn=parseFloat(rv); if(recvAm) recvAm.textContent=(rv===""||!isFinite(rn))?"~ — USDT0":("~ "+rn.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:rn<1?4:2})+" USDT0");
    if(rIc) rIc.innerHTML='<img src="/assets/tokens/usdt0.png" style="width:100%;height:100%;object-fit:cover;display:block" alt="">';
    // the messaging fee as the route panel quoted it, e.g. "0.2% + 0.4845 XLM" -> "0.4845 XLM"
    var fv=[].slice.call(document.querySelectorAll('.lx-brs-row')).filter(function(x){ return /Bridge fee/.test(x.textContent||""); })[0];
    var xm=fv?/([0-9.]+)\s*XLM/.exec(fv.textContent||""):null;
    if(cf) cf.innerHTML='<span class="k">LayerZero messaging fee</span><span class="v">'+(xm?xm[1]+' XLM':'Quoted at signing')+' <span class="lx-cchip">Delivered in ~30 min</span></span>';
  } else if(window.__lxBrRoute==="NEAR Intents"){
    // the token picked for delivery (ETH, POL...), its logo, and NEAR Intents' own cut beside ours
    var de2=document.documentElement, sym=de2.getAttribute('data-lxroute-asset')||"", rv2=de2.getAttribute('data-lxroute-recv')||"", n2=parseFloat(rv2);
    if(recvAm) recvAm.textContent=(rv2===""||!isFinite(n2))?("~ — "+sym):("~ "+(n2<1?n2.toPrecision(4):n2.toLocaleString("en-US",{maximumFractionDigits:4}))+" "+sym);
    var lg2=de2.getAttribute('data-lxroute-logo'); if(rIc&&lg2) rIc.innerHTML='<img src="'+lg2+'" style="width:100%;height:100%;object-fit:cover;display:block" alt="">';
    var nf=[].slice.call(document.querySelectorAll('.lx-brs-row')).filter(function(x){ return /Bridge fee/.test(x.textContent||""); })[0];
    var nm2=nf?/([0-9.]+)%\s*NEAR/.exec(nf.textContent||""):null;
    if(cf) cf.innerHTML='<span class="k">NEAR Intents fee</span><span class="v">'+(nm2?nm2[1]+'%':'Included in the quote')+' <span class="lx-cchip">Delivered in ~30 s, no claim</span></span>';
  } else if(cf){
    cf.innerHTML='<span class="k">Circle CCTP fee</span><span class="v">Free <span class="lx-cchip">Standard transfer</span></span>';
  }
}
// ---- what moved, and where it lives (RAZA 2026-09-20) --------------------------------------------------------------
// "make the Asset and its network logo like this: Asset [logo] (same size as now), and small logo for the network
// beside it. The goal is to easily understand that this token has been swapped from this network to this token of this
// network." So both ends are built the same way: the ASSET's own logo at the size the column already used, with its
// NETWORK tucked into the lower-right corner and ringed in the row colour. The To column used to show only the network
// mark, which said where it landed but never what arrived.
var LX_NILOGO={"AAVE":1,"ADI":1,"ARB":1,"AURORA":1,"AVAX":1,"BERA":1,"BRETT":1,"cbBTC":1,"CFI":1,"COCA":1,"DAI":1,"ETH":1,"GMX":1,"HAPI":1,"hemiBTC":1,"INX":1,"KAITO":1,"KNC":1,"LINK":1,"MOG":1,"MON":1,"NEAR":1,"OP":1,"PEPE":1,"POL":1,"SAFE":1,"SHIB":1,"SPX":1,"sUSDC":1,"SWEAT":1,"TITN":1,"TURBO":1,"UNI":1,"USD1":1,"USDC":1,"USDf":1,"USDT":1,"USDT0":1,"VVV":1,"WBTC":1,"WETH":1,"XAUT":1,"XPL":1};
function lxBrAssetLogo(code){
  var A=LX_ASSETS[code]; if(A&&A.logo) return A.logo;                 // the Stellar side: the curated logo
  return LX_NILOGO[code]?('assets/tokens/ni/'+code+'.png'):'';        // the destination side: shipped with the site
}
// A letter is drawn by CSS, never as a text node: a one-to-five character element gets repainted as a ticker badge by
// the site's logo healer, which would put the wrong mark on an asset it guessed from the ticker.
function lxBrChipIco(code,net,stellarIcon){
  var u=lxBrAssetLogo(code), nkey=net?(LX_NETMAP[net]||""):"";
  var face=u?('<img src="'+u+'" alt="">'):('<span class="lx-tl" data-l="'+lxBrEsc(String(code||"?").charAt(0).toUpperCase())+'"></span>');
  var badge=net
    ? (nkey?('<span class="lx-tnet"><img src="/assets/networks/'+nkey+'.png" alt=""></span>'):'')
    : ('<span class="lx-tnet lx-tnet-x">'+(stellarIcon||'')+'</span>');   // no net named = the Stellar side
  return '<span class="lx-tic">'+face+badge+'</span>';
}
// the bridge, with its own mark (RAZA: "Add logo for Bridge used along with its name")
var LX_BRIDGELOGO={CCTP:'assets/tokens/circle.png',LayerZero:'assets/tokens/layerzero.png','NEAR Intents':'assets/tokens/ni/NEAR.png'};
function lxBrBridgeCell(name){
  name=name||"CCTP"; var u=LX_BRIDGELOGO[name]||'';
  return '<span class="lx-buse-r">'+(u?('<img src="'+u+'" alt="">'):'')+'<span>'+lxBrEsc(name)+'</span></span>';
}
function lxBrAddRecentTx(o){
  var tbody=document.querySelector('.br-table tbody'); if(!tbody)return;
  var nkey=LX_NETMAP[o.net]||"", sIcon=lxBrStellarIcon(), xp=lxBrXpIcon();
  // FROM icon = the SOURCE ASSET logo (USDC/XLM), not always the Stellar network mark.
  /* the SOURCE asset's own logo, from the curated list -- it knew only USDC and XLM, so BLND (and every other
     source) fell back to the Stellar mark and read as XLM (RAZA 2026-09-19) */
  var srcImg=((LX_ASSETS[o.srcKey]||{}).logo)||"";
  var srcIco=srcImg?('<img class="lx-netimg" src="'+srcImg+'" style="width:100%;height:100%;object-fit:cover;display:block" alt="">'):sIcon;
  var tr=document.createElement('tr'); tr.className="lx-newtx";
  tr.innerHTML='<td>'+(o.when||'Just now')+'</td>'
    +'<td><span class="br-asschip">'+lxBrChipIco(o.srcKey,"",sIcon)+'<span><span class="am">'+o.srcAmount+' '+o.srcKey+'</span><span class="nt">Stellar</span></span></span></td>'
    // A record with no source account gets a dash, not an empty link to /account/undefined.
    +'<td class="mono">'+(o.src?('<a class="lx-txaddr" href="'+lxSrcExp(o.src)+'" target="_blank" rel="noopener" title="View source wallet on Stellar Expert">'+lxBrShort(o.src)+'</a>'):'\u2014')+'</td>'
    // A burn whose destination is not known yet says so. It used to draw a broken image for the network, "0 USDC"
    // and an empty address cell (RAZA 2026-09-19) -- which read as an unclaimed transfer. The registry now fills
    // these in from the burn transaction itself, so this is only ever a brief state.
    +(o.net
      ? ('<td><span class="br-asschip">'+lxBrChipIco((o.asset||(o.bridge==="LayerZero"?"USDT0":"USDC")),o.net,sIcon)+'<span><span class="am">'+lxBrFmt(o.amount,(+o.amount>0&&+o.amount<1)?6:2)+' '+(o.asset||(o.bridge==="LayerZero"?"USDT0":"USDC"))+'</span><span class="nt">'+o.net+'</span></span></span></td>'
        +'<td class="mono">'+(o.recipient?('<a class="lx-txaddr" href="'+lxDstExp(o.net,o.recipient)+'" target="_blank" rel="noopener" title="View destination wallet on '+o.net+' explorer">'+lxBrShort(o.recipient)+'</a>'):'\u2014')+'</td>')
      : ('<td><span class="br-asschip"><span><span class="am">USDC</span><span class="nt">Destination pending</span></span></span></td>'
        +'<td class="mono" style="color:var(--text-soft)">Pending</td>'))
    +'<td class="lx-buse">'+lxBrBridgeCell(o.bridge)+'</td>'
    +'<td class="br-xp"><a class="br-xplink" href="'+(o.bridge==="LayerZero"?('https://layerzeroscan.com/tx/'+o.hash):('https://stellar.expert/explorer/public/tx/'+o.hash))+'" target="_blank" rel="noopener" aria-label="View on explorer" title="'+(o.bridge==="LayerZero"?'Track delivery on LayerZero Scan':'View burn on Stellar Expert')+'">'+xp+'</a></td>';
  tbody.insertBefore(tr, tbody.firstChild);
  // a new row lands at the top, which shifts every page boundary — repage, and show the page it is on
  try{ lxBrTxPage=1; lxBrTxApply(); }catch(_){}
}
window.lxBrAddRecentTx=lxBrAddRecentTx; window.lxBrReview=lxBrReview; window.lxBrValidateStep2=lxBrValidateStep2;
// the progress dialog, reachable so its states can be rendered and checked without moving money
window.lxBrProgShow=lxBrProgShow; window.lxBrProgUpdate=lxBrProgUpdate; window.lxBrProgDone=lxBrProgDone; window.lxBrProgFail=lxBrProgFail;
// The canonical issuer per source asset. A ticker is not an identity on Stellar and this table is where the right
// issuer lives (the AUDIT #4 note above fixed LUMOS pointing at the USDC issuer), so anything resolving a source
// asset reads it here rather than keeping a second copy that can drift. Exported HERE, after the assignment.
window.LX_ASSETS=LX_ASSETS;
// ---- history from the chain ----------------------------------------------------------------------
function lxB64(v){ try{ var s=atob(v), a=new Uint8Array(s.length); for(var i=0;i<s.length;i++)a[i]=s.charCodeAt(i); return a; }catch(_){ return new Uint8Array(0); } }
function lxB64Str(v){ try{ return atob(v); }catch(_){ return ""; } }
function lxHex(a){ var o=""; for(var i=0;i<a.length;i++){ var h=a[i].toString(16); o+=(h.length<2?"0":"")+h; } return o; }
// ScVal wire layout: 4-byte type discriminant, then the value. u32 is 4 bytes big-endian; a byte
// string is a 4-byte length then the payload, and the EVM recipient is the low 20 bytes of a bytes32.
function lxScU32(a){ return a.length<8?0:((a[4]<<24)>>>0)+(a[5]<<16)+(a[6]<<8)+a[7]; }
function lxScBytes(a){ return a.length<8?new Uint8Array(0):a.slice(8); }

function lxBrChainHistory(){
  var addr=""; try{ addr=localStorage.getItem("lumos.address")||""; }catch(_){}
  if(!/^G[A-Z2-7]{55}$/.test(addr)) return Promise.resolve([]);
  var url="https://horizon.stellar.org/accounts/"+addr+"/operations?limit=200&order=desc";
  return fetch(url).then(function(r){ return r.ok?r.json():null; }).then(function(d){
    var recs=((d&&d._embedded)||{}).records||[], out=[];
    for(var i=0;i<recs.length;i++){
      var o=recs[i];
      if(o.type!=="invoke_host_function"||!o.transaction_successful) continue;
      var P=o.parameters||[]; if(P.length<6) continue;
      var isBurn=false;
      for(var j=0;j<P.length;j++){ if(lxB64Str(P[j].value).indexOf("deposit_for_burn")>=0){ isBurn=true; break; } }
      if(!isBurn) continue;

      var dom=lxScU32(lxB64(P[4].value));
      var mr=lxScBytes(lxB64(P[5].value));
      var rcpt=mr.length>=20?("0x"+lxHex(mr.slice(mr.length-20))):"";
      // the transfer leg of the balance change is the USDC that left the wallet
      var amt=0, ch=o.asset_balance_changes||[];
      for(var k=0;k<ch.length;k++){ if(ch[k].type==="transfer"&&ch[k].amount){ amt=parseFloat(ch[k].amount)||0; break; } }
      if(!amt) for(var k2=0;k2<ch.length;k2++){ if(ch[k2].amount){ amt=parseFloat(ch[k2].amount)||0; break; } }

      out.push({ ts:Date.parse(o.created_at)||0, hash:o.transaction_hash,
                 amount:amt, srcAmount:String(amt), srcKey:"USDC",
                 net:LX_DOMNAME[dom]||("Domain "+dom), recipient:rcpt, onchain:true });
    }
    return out;
  }).catch(function(){ return []; });
}
// Chain first, local store second: a locally-saved record carries what the user actually PAID
// (they may have swapped XLM into USDC), which the burn alone does not tell us, so matching records
// are merged rather than replaced. Anything local that is not on chain yet is still shown.
function lxBrMergedTxs(){
  var local=[]; try{ local=JSON.parse(localStorage.getItem("lumos.cctp.txs")||"[]"); }catch(_){}
  // public first, then anything this browser recorded that is not already in it
  var seen={}; LX_PUBTX.forEach(function(o){ seen[o.hash]=1; });
  local=LX_PUBTX.concat(local.filter(function(o){ return o&&!seen[o.hash]; }));
  // ONE LIST ON EVERY DEVICE (RAZA 2026-09-19: "why the fuck mobile and desktop are showing different recent
  // transactions ... it should show all on both devices"). This used to add the CONNECTED wallet's burns read from the
  // chain -- on the phone only, since desktop never called it -- so each device showed its own wallet's extras. Now
  // every route is REGISTERED in the shared record instead (lxBrSyncChain), and both layouts paint the same thing:
  // the shared record, plus whatever this browser sent that the record has not taken yet.
  local.sort(function(a,b){ return (+b.ts||0)-(+a.ts||0); });
  return Promise.resolve(local);
}
window.lxBrChainHistory=lxBrChainHistory; window.lxBrMergedTxs=lxBrMergedTxs;

// ---- MOBILE recent transactions ------------------------------------------------------------------
// The phone has no .br-table: each transaction is a .brm-txc card. Everything above targets the table
// and bailed on its first line here, so the design's seeded mock transfers were what users saw. The
// build step strips those; this fills the .lx-brmhost left in their place.
function lxBrMobCard(o){
  var nkey=LX_NETMAP[o.net]||"";
  /* the SOURCE asset's own logo, from the curated list -- it knew only USDC and XLM, so BLND (and every other
     source) fell back to the Stellar mark and read as XLM (RAZA 2026-09-19) */
  var srcImg=((LX_ASSETS[o.srcKey]||{}).logo)||"";
  var srcIco=srcImg?('<img class="lx-netimg" src="'+srcImg+'" style="width:100%;height:100%;object-fit:cover;display:block" alt="">'):lxBrStellarIcon();
  return '<div class="brm-txc lx-brmtx">'
    +'<div class="brm-tr1"><span class="brm-tm">'+(o.when||'Just now')+'</span>'
      +'<a class="br-xplink" style="margin-left:auto" href="'+(o.bridge==="LayerZero"?('https://layerzeroscan.com/tx/'+o.hash):('https://stellar.expert/explorer/public/tx/'+o.hash))+'" target="_blank" rel="noopener" title="View burn on Stellar Expert">'+lxBrXpIcon()+'</a></div>'
    +'<div class="brm-flow">'
      +'<span class="br-asschip">'+lxBrChipIco(o.srcKey,"",lxBrStellarIcon())
        +'<span><span class="am">'+o.srcAmount+' '+o.srcKey+'</span><span class="nt">Stellar</span></span></span>'
      +'<span class="br-ar">→</span>'
      +'<span class="br-asschip">'+lxBrChipIco((o.asset||(o.bridge==="LayerZero"?"USDT0":"USDC")),o.net,lxBrStellarIcon())
        +'<span><span class="am">'+lxBrFmt(o.amount,(+o.amount>0&&+o.amount<1)?6:2)+' '+(o.asset||(o.bridge==="LayerZero"?"USDT0":"USDC"))+'</span><span class="nt">'+o.net+'</span></span></span>'
    +'</div>'
    // WHO SENT IT, as the desktop table's Source address column says (RAZA 2026-09-20: "on mobile it's not showing the
    // source wallet address like it's showing on desktop"). A shared record holds other people's transfers too, so on
    // a phone the row was the only one that could not say whose transfer it was.
    +(o.src?('<div class="brm-recv">From <a class="lx-txaddr" href="'+lxSrcExp(o.src)+'" target="_blank" rel="noopener">'+lxBrShort(o.src)+'</a></div>'):'')
    +'<div class="brm-recv">To <a class="lx-txaddr" href="'+lxDstExp(o.net,o.recipient)+'" target="_blank" rel="noopener">'+lxBrShort(o.recipient)+'</a> · via '+lxBrBridgeCell(o.bridge)+'</div>'
  +'</div>';
}
function lxBrRenderMobileTxs(){ try{
  var host=document.querySelector('.lx-brmhost'); if(!host) return;
  // Paint exactly what desktop paints, immediately and with NO wallet gate: the local store, the same
  // single source lxBrRestoreTxs uses on desktop. The chain lookup then upgrades the list only if it
  // returns something, so mobile can never show LESS than desktop while a network call is in flight.
  var loc=[]; try{ loc=JSON.parse(localStorage.getItem("lumos.cctp.txs")||"[]"); }catch(_){}
  var pseen={}; LX_PUBTX.forEach(function(o){ pseen[o.hash]=1; });
  loc=LX_PUBTX.concat(loc.filter(function(o){ return o&&!pseen[o.hash]; }));
  lxBrPaintMobileTxs(host, loc);
  // Then the shared registry -- the step desktop was getting and mobile was not. Rebuilt from
  // LX_PUBTX rather than reusing loc, because the loader mutates that array in place.
  try{ lxBrLoadPublic().then(function(){
      var l2=[]; try{ l2=JSON.parse(localStorage.getItem("lumos.cctp.txs")||"[]"); }catch(_){}
      var s2={}; LX_PUBTX.forEach(function(o){ if(o&&o.hash)s2[o.hash]=1; });
      l2=LX_PUBTX.concat(l2.filter(function(o){ return o&&!s2[o.hash]; }));
      if(l2.length) lxBrPaintMobileTxs(host, l2);
      return lxBrMergedTxs();
    }).then(function(a){ if(a&&a.length) lxBrPaintMobileTxs(host, a); }); }catch(_){}
}catch(_){} }
function lxBrPaintMobileTxs(host, a){ try{
  a=a.slice().sort(function(x,y){ return (+y.ts||0)-(+x.ts||0); });   // newest first, as on desktop
  if(a.length>LX_TXMAX) a=a.slice(0,LX_TXMAX);
  if(!a.length){ host.innerHTML='<div class="brm-txc" style="text-align:center;color:var(--text-soft);font-size:13px">No cross-chain transactions yet.</div>'; return; }
  var out=""; for(var i=0;i<a.length;i++){ var o=a[i]; o.when=lxBrRelTime(o.ts); out+=lxBrMobCard(o); }
  host.innerHTML=out;
}catch(_){} }
window.lxBrRenderMobileTxs=lxBrRenderMobileTxs;

// ---- persist completed bridges so they survive a page refresh ----
function lxBrRelTime(ts){ if(!ts)return "Just now"; var s=Math.floor((Date.now()-ts)/1000); if(s<60)return "Just now"; var m=Math.floor(s/60); if(m<60)return m+(m===1?" min ago":" mins ago"); var h=Math.floor(m/60); if(h<24)return h+(h===1?" hr ago":" hrs ago"); var d=Math.floor(h/24); return d+(d===1?" day ago":" days ago"); }
// 100 kept, shown 25 at a time over at most 4 pages. Nothing older is retained: this is a local record
// in one browser, not a server-side feed, so it is bounded on purpose.
var LX_TXPP=25, LX_TXMAX=100, lxBrTxPage=1;
function lxBrSaveTx(o){ setTimeout(function(){try{lxBrRenderMobileTxs();}catch(_){}},0);
  // LayerZero / NEAR Intents: into the shared record at once, so the other device has it too (CCTP registers itself)
  if(o&&o.hash&&(o.bridge==="LayerZero"||o.bridge==="NEAR Intents")) setTimeout(function(){ try{ lxBrRegister(o.bridge,o.hash); }catch(_){} },4000); try{ var a=JSON.parse(localStorage.getItem("lumos.cctp.txs")||"[]"); var dseen={}; a.forEach(function(o){ if(o&&o.hash)dseen[o.hash]=1; }); a=a.concat(LX_PUBTX.filter(function(o){ return !dseen[o.hash]; })); /* NEWEST first before the cap: sorted oldest-first, the cap kept the oldest and dropped recent transfers */ a=a.filter(function(x){ return x&&x.hash!==o.hash; }); a.sort(function(x,y){ return (y.ts||0)-(x.ts||0); }); a.unshift(o); if(a.length>LX_TXMAX)a=a.slice(0,LX_TXMAX); localStorage.setItem("lumos.cctp.txs",JSON.stringify(a)); }catch(_){} }
function lxBrTxRows(){ var tb=document.querySelector(".br-table tbody"); return tb?[].slice.call(tb.querySelectorAll("tr:not(.lx-txempty)")):[]; }
// an empty table has to say so rather than look broken
function lxBrTxEmpty(){ var tb=document.querySelector(".br-table tbody"); if(!tb) return;
  var real=lxBrTxRows().length, e=tb.querySelector(".lx-txempty");
  if(real){ if(e&&e.parentNode) e.parentNode.removeChild(e); return; }
  if(e) return;
  var cols=document.querySelectorAll(".br-table thead th").length||6;
  var tr=document.createElement("tr"); tr.className="lx-txempty";
  tr.innerHTML='<td colspan="'+cols+'" class="lx-txempty-c">No cross-chain transfers yet — bridges you make appear here.</td>';
  tb.appendChild(tr); }
function lxBrTxApply(){
  var rows=lxBrTxRows(); if(!rows.length){ lxBrTxEmpty(); return; }
  var total=Math.min(rows.length,LX_TXMAX);
  var pages=Math.max(1,Math.min(4,Math.ceil(total/LX_TXPP)));
  if(lxBrTxPage>pages) lxBrTxPage=pages;
  var from=(lxBrTxPage-1)*LX_TXPP, to=from+LX_TXPP;
  rows.forEach(function(tr,i){ tr.style.display=(i>=from&&i<to&&i<LX_TXMAX)?"":"none"; });
  lxBrTxFoot(pages,total,from,Math.min(to,total)); lxBrTxEmpty();
}
function lxBrTxFoot(pages,total,from,to){
  var wrap=document.querySelector(".br-txwrap"); if(!wrap) return;
  var foot=wrap.querySelector(".lx-brtxpg");
  if(pages<2){ if(foot) foot.style.display="none"; return; }
  if(!foot){ foot=document.createElement("div"); foot.className="lx-brtxpg"; wrap.appendChild(foot);
    foot.addEventListener("click",function(e){ var b=e.target&&e.target.closest?e.target.closest("[data-txp]"):null; if(!b) return;
      e.preventDefault(); e.stopPropagation(); lxBrTxPage=parseInt(b.getAttribute("data-txp"),10)||1; lxBrTxApply(); },true); }
  // hidden while the pending-claims tab is showing — it belongs to the table, not to that view
  var tbl=wrap.querySelector(".br-table");
  foot.style.display=(tbl&&getComputedStyle(tbl).display==="none")?"none":"";
  var h='<span class="lx-brtxpg-n">Showing '+(from+1)+'–'+to+' of '+total+'</span><div class="lx-brtxpg-b">';
  for(var i=1;i<=pages;i++) h+='<button type="button" data-txp="'+i+'" class="lx-brtxpg-p'+(i===lxBrTxPage?" active":"")+'">'+i+'</button>';
  foot.innerHTML=h+'</div>';
}
window.lxBrTxApply=lxBrTxApply;
// AUDIT #1/#3 (FUNDS) — recovery store. A CCTP transfer is only finished once the destination chain mints.
// Everything needed to redeem later (burn hash + Circle message + attestation) is written here the moment it
// exists, keyed by burn hash and upserted, so a timeout, refresh or closed tab can never strand burned USDC.
function lxBrSavePending(rec){ try{
  if(!rec||!rec.burnHash)return;
  var a=JSON.parse(localStorage.getItem("lumos.cctp.pending")||"[]");
  var i=-1; for(var n=0;n<a.length;n++){ if(a[n].burnHash===rec.burnHash){ i=n; break; } }
  if(i>=0){ var m=a[i]; for(var k in rec){ if(rec[k]!=null) m[k]=rec[k]; } a[i]=m; } else { a.unshift(rec); }
  if(a.length>50)a=a.slice(0,50);
  localStorage.setItem("lumos.cctp.pending",JSON.stringify(a));
}catch(_){} }
function lxBrListPending(){ try{ return JSON.parse(localStorage.getItem("lumos.cctp.pending")||"[]"); }catch(_){ return []; } }
// Tell the server that this fee payment belongs to this burn. The endpoint re-checks BOTH against the
// ledger before storing, so this call is a pointer, not a claim -- nothing here is trusted.
// Bounded to 8s and never rethrows: the USDC is already bridged and the fee already paid, so a
// bookkeeping failure must not surface as a bridge failure. A miss is recoverable -- the confirm
// page and the history panel both re-register anything they find unregistered.
function lxBrRegister(feeHash,burnHash){
  try{
    if(!feeHash||!burnHash) return Promise.resolve(false);
    var done=false;
    return new Promise(function(res){
      setTimeout(function(){ if(!done){ done=true; res(false); } },8000);
      fetch("/lxapi/bridgetx",{method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({feeHash:feeHash,burnHash:burnHash})})
        .then(function(r){ if(!done){ done=true; res(!!(r&&r.ok)); } })
        .catch(function(){ if(!done){ done=true; res(false); } });
    });
  }catch(_){ return Promise.resolve(false); }
}
// A cleared claim is REMEMBERED, not just removed. Pending rows are seeded from the shared bridge record below, so
// without this a transfer claimed here would be handed straight back on the next load, and the panel would argue with
// the user about something they had already finished.
function lxBrMarkDone(hash){ try{ if(!hash)return; var d=JSON.parse(localStorage.getItem("lumos.cctp.done")||"[]");
  if(d.indexOf(hash)<0){ d.unshift(hash); if(d.length>200)d=d.slice(0,200); localStorage.setItem("lumos.cctp.done",JSON.stringify(d)); } }catch(_){} }
function lxBrIsDone(hash){ try{ return JSON.parse(localStorage.getItem("lumos.cctp.done")||"[]").indexOf(hash)>=0; }catch(_){ return false; } }
function lxBrClearPending(hash){ try{ lxBrMarkDone(hash); var a=lxBrListPending().filter(function(x){return x.burnHash!==hash;}); localStorage.setItem("lumos.cctp.pending",JSON.stringify(a)); }catch(_){} }
window.lxBrSavePending=lxBrSavePending; window.lxBrListPending=lxBrListPending; window.lxBrClearPending=lxBrClearPending;
// Pull the shared bridge record into LX_PUBTX. Deduped by burn hash and sorted newest-first, so a
// transfer this browser already knows about is not duplicated. Resolves either way: an unreachable
// registry leaves the previous behaviour exactly as it was rather than emptying the table.
var LX_PUBLOAD=null;
function lxBrLoadPublic(){
  if(LX_PUBLOAD)return LX_PUBLOAD;
  LX_PUBLOAD=fetch("/lxapi/bridgetx?limit=200&routes=all").then(function(r){ return r.ok?r.json():null; })
    .then(function(d){
      var rows=(d&&d.rows)||[]; if(!rows.length)return LX_PUBTX;
      var seen={}; LX_PUBTX.forEach(function(o){ if(o&&o.hash)seen[o.hash]=1; });
      rows.forEach(function(x){
        if(!x||!x.burnHash||seen[x.burnHash])return; seen[x.burnHash]=1;
        // src IS THE SOURCE ADDRESS COLUMN (RAZA 2026-09-17: "why's the source address missing on Bridge recent
        // transactions"). lxBrAddRecentTx reads o.src for that cell, and this mapper never carried it over, so every
        // row sourced from the shared record drew an empty link while Destination address -- taken from x.recipient
        // right beside it -- was fine. The registry has always stored it as x.from, the Stellar account the burn and
        // the fee both came from; it is the same field lxBrSeedFromServer matches against the connected wallet.
        // Rows recorded by THIS browser were never affected, which is why it reads as "some data missing" rather than
        // a broken column: the public rows win the merge in lxBrRestoreTxsNow, so in practice they all lost it.
        LX_PUBTX.push({ ts:+x.ts||Date.now(), hash:x.burnHash,
          // srcAmount/srcCode: what was really sent, when a swap came first ("5 XLM"); USDC transfers carry neither
          amount:(+x.amount||0), srcAmount:(x.srcAmount!=null?String(x.srcAmount):(x.gross!=null?String(x.gross):(x.amount!=null?String(x.amount):"\u2014"))),
          srcKey:(x.srcCode||"USDC"), net:(x.destName||""), recipient:(x.recipient||""), src:(x.from||""),
          // the route and what it delivered: USDT0 by LayerZero, any token by NEAR Intents; CCTP rows carry neither
          bridge:(x.route||"CCTP"), asset:(x.asset||undefined) });
      });
      LX_PUBTX.sort(function(a,b){ return (+b.ts||0)-(+a.ts||0); });
      return LX_PUBTX;
    }).catch(function(){ return LX_PUBTX; });
  return LX_PUBLOAD;
}
function lxBrRestoreTxs(){ try{ var _tb0=document.querySelector('.br-table tbody'); if(!_tb0||_tb0.__lxRestored||_tb0.__lxWaiting)return;
  // Claim the table immediately so the polling caller cannot start a second pass while the fetch is
  // in flight, but do not mark it restored until it is actually painted.
  _tb0.__lxWaiting=true;
  lxBrLoadPublic().then(function(){ _tb0.__lxWaiting=false; lxBrRestoreTxsNow(); });
}catch(_){} }
function lxBrRestoreTxsNow(){ try{ var tbody=document.querySelector('.br-table tbody'); if(!tbody||tbody.__lxRestored)return; tbody.__lxRestored=true; var a=JSON.parse(localStorage.getItem("lumos.cctp.txs")||"[]");
  // Same source the phone paints from. lxBrRenderMobileTxs prepends LX_PUBTX to the local store; this
  // read only the local store, so a transfer that exists on chain but was never recorded in THIS
  // browser appeared on mobile and not on desktop -- the same account, the same origin, two different
  // answers. Merged by hash, public first, exactly as the mobile path does it.
  var _pseen={}; LX_PUBTX.forEach(function(o){ _pseen[o.hash]=1; });
  a=LX_PUBTX.concat(a.filter(function(o){ return o&&!_pseen[o.hash]; }));
  // NEWEST FIRST, after the merge. The shared record came first and this browser's own transfers were appended after
  // it, so a transfer made a minute ago -- not in the shared record yet -- was listed LAST (RAZA 2026-09-19).
  a.sort(function(x,y){ return (+y.ts||0)-(+x.ts||0); });
  // a store written before the cap existed can hold more than 100 — render only what is reachable, rather
  // than building rows the pager will hide forever
  if(a.length>LX_TXMAX) a=a.slice(0,LX_TXMAX);
  for(var i=a.length-1;i>=0;i--){ var o=a[i]; o.when=lxBrRelTime(o.ts); lxBrAddRecentTx(o); } }catch(_){} }
// Repaint the desktop table from the store -- for a record that arrives AFTER the first paint (NEAR Intents history
// read back from the chain, lxNiSync). Only once the first restore has run: before that, it will read the store itself,
// and repainting early would mark the table restored before the shared registry had loaded.
window.lxBrRepaintTxs=function(){ try{ var tb=document.querySelector('.br-table tbody'); if(!tb||!tb.__lxRestored) return;
  [].slice.call(tb.querySelectorAll('tr.lx-newtx')).forEach(function(r){ r.parentNode.removeChild(r); });
  tb.__lxRestored=false; lxBrRestoreTxsNow(); try{ lxBrTxEmpty(); }catch(_){} }catch(_){} };

// ---- every route in the SHARED record, so every device shows the same list ----------------------------------------
// RAZA 2026-09-19: "it should show all on both devices". CCTP transfers were registered with /lxapi/bridgetx when sent;
// LayerZero and NEAR Intents lived only in the sending browser. They are registered too now -- the server verifies each
// against the ledger and against LumosCore's fee, so this only POINTS at transfers, it cannot describe them. Sources:
//   the connected wallet's own transfers, read from the chain (made on any device -- or never recorded, when a phone
//   tab was suspended while a wallet app signed), and every LayerZero / NEAR Intents record this browser holds.
var LX_OFT_HEX="5d672cb21b3afcdda54546c7f5b9fd346920e41f8fe8f39e838e5d7bd7435546";   // the USDT0 OFT contract, raw id
var LX_NI_DEP="GDJ4JZXZELZD737NVFORH4PSSQDWFDZTKW3AIDKHYQG23ZXBPDGGQBJK";              // 1Click's Stellar deposit account
// A CCTP transfer is registered as a PAIR (fee + burn); the server checks they belong together, so a wrong guess is
// simply refused and the next candidate tried.
function lxBrRegisterPair(feeHash,burnHash){
  return fetch("/lxapi/bridgetx",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({feeHash:feeHash,burnHash:burnHash})})
    .then(function(r){ return r.json(); }).then(function(j){ return !!(j&&j.ok&&j.status==="stored"); }).catch(function(){ return false; });
}
function lxBrRegister(route, hash){
  return fetch("/lxapi/bridgetx",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({route:route,hash:hash})})
    .then(function(r){ return r.json(); }).then(function(j){ return !!(j&&j.ok&&j.status==="stored"); }).catch(function(){ return false; });
}
var lxBrSyncing=false;
function lxBrSyncChain(){
  if(lxBrSyncing) return Promise.resolve(0); lxBrSyncing=true;
  var pk=""; try{ pk=localStorage.getItem("lumos.address")||""; }catch(_){}
  var todo={};   // hash -> route
  // CCTP is registered by the sending page, and that can fail (a closed tab, a dropped call): one transfer in four was
  // missing on 2026-09-20, and the dashboard showed it as a bare "Platform activity" row. Pair them up here as well.
  var cctpBurns=[], feePays=[];
  try{ JSON.parse(localStorage.getItem("lumos.cctp.txs")||"[]").forEach(function(o){
    if(o&&o.hash&&(o.bridge==="LayerZero"||o.bridge==="NEAR Intents")) todo[o.hash]=o.bridge; }); }catch(_){}
  var chainP=!/^G[A-Z2-7]{55}$/.test(pk)?Promise.resolve():
    fetch("https://horizon.stellar.org/accounts/"+pk+"/operations?order=desc&limit=100&join=transactions")
      .then(function(r){ return r.ok?r.json():null; }).then(function(d){
        (((d&&d._embedded)||{}).records||[]).forEach(function(o){
          if(o.transaction_successful===false) return;
          if(o.type==="invoke_host_function"){
            var p0=(o.parameters||[])[0], c=p0?lxB64(p0.value):new Uint8Array(0);
            var burnT0=(o.asset_balance_changes||[]).some(function(b){ return b.type==="burn"&&b.asset_code==="USDT0"; });
            if(burnT0&&c.length>=40&&lxHex(c.slice(8,40))===LX_OFT_HEX) todo[o.transaction_hash]="LayerZero";
            else if((o.parameters||[]).length>=6&&(o.asset_balance_changes||[]).some(function(b){ return b.type==="burn"&&b.asset_code==="USDC"; }))
              cctpBurns.push({h:o.transaction_hash,t:Date.parse(o.created_at)||0});
          } else if(o.type==="payment"&&o.to===LX_NI_DEP&&o.from===pk){
            var tx=o.transaction||{}; if(tx.memo_type==="id") todo[o.transaction_hash]="NEAR Intents";
          } else if((o.type==="payment"||/^path_payment/.test(o.type))&&o.to===LX_FEEACCT&&o.from===pk){
            feePays.push({h:o.transaction_hash,t:Date.parse(o.created_at)||0});
          }
        });
      }).catch(function(){});
  return chainP.then(function(){ return lxBrLoadPublic(); }).then(function(){
    var have={}; LX_PUBTX.forEach(function(o){ if(o&&o.hash) have[o.hash]=1; });
    var hs=Object.keys(todo).filter(function(h){ return !have[h]; }).slice(0,8);
    // one at a time: each registration reads the shared record and writes it back
    var n=0, chain=Promise.resolve();
    hs.forEach(function(h){ chain=chain.then(function(){ return lxBrRegister(todo[h],h).then(function(ok){ if(ok) n++; }); }); });
    // CCTP: each unregistered burn against the nearest fee payments, inside the half hour the server allows
    cctpBurns.filter(function(b){ return !have[b.h]; }).slice(0,4).forEach(function(b){
      var cands=feePays.filter(function(f){ return Math.abs(f.t-b.t)<=18e5; })
        .sort(function(x,y){ return Math.abs(x.t-b.t)-Math.abs(y.t-b.t); }).slice(0,3);
      cands.forEach(function(f){ chain=chain.then(function(hit){ if(hit==="hit") return "hit";
        return lxBrRegisterPair(f.h,b.h).then(function(ok){ if(ok){ n++; return "hit"; } return null; }); }); });
      chain=chain.then(function(){ return null; });
    });
    return chain.then(function(){ return n; });
  }).then(function(n){
    if(!n) return 0;
    LX_PUBLOAD=null;   // read the record again, now holding the new rows
    return lxBrLoadPublic().then(function(){
      try{ window.lxBrRepaintTxs(); }catch(_){}
      try{ lxBrRenderMobileTxs(); }catch(_){}
      return n; });
  }).catch(function(){ return 0; }).then(function(n){ lxBrSyncing=false; return n; });
}
window.lxBrSyncChain=lxBrSyncChain;
setTimeout(function(){ try{ lxBrSyncChain(); }catch(_){} },2500);
// add a "Bridge Used" column after "To" + rename the explorer header; backfill existing (non-CCTP) rows with a dash
function lxBrTableCols(){ try{
  var table=document.querySelector('.br-table'); if(!table||table.__lxCols)return; table.__lxCols=true;
  // design order = [0 Time,1 Source,2 Dest,3 From,4 To,5 Explorer]; reorder to Time, From, Source, To, Dest, BridgeUsed, Explorer
  function reorder(row, cells, buCell){ row.appendChild(cells[0]); row.appendChild(cells[3]); row.appendChild(cells[1]); row.appendChild(cells[4]); row.appendChild(cells[2]); row.appendChild(buCell); row.appendChild(cells[5]); }
  var headRow=table.querySelector('thead tr');
  if(headRow){ var ths=[].slice.call(headRow.querySelectorAll('th'));
    if(ths.length>=6){ var buTh=document.createElement('th'); buTh.className='lx-buse-h'; buTh.textContent='Bridge Used';
      var xph=ths[5]; xph.textContent='Explorer'; xph.removeAttribute('aria-label'); xph.className=(xph.className||'')+' lx-xph2';
      reorder(headRow, ths, buTh); }
  }
  [].slice.call(table.querySelectorAll('tbody tr')).forEach(function(tr){
    if(tr.classList.contains('br-vrow')){ var td=tr.querySelector('td[colspan]'); if(td){ var cs=parseInt(td.getAttribute('colspan'),10)||6; td.setAttribute('colspan', cs+1); } return; }
    if(tr.classList.contains('lx-newtx'))return;
    var tds=[].slice.call(tr.querySelectorAll('td')); if(tds.length<6)return;
    var buCell=document.createElement('td'); buCell.className='lx-buse'; buCell.innerHTML='<span class="lx-buse-dash">—</span>';
    reorder(tr, tds, buCell);
  });
}catch(_){} }
window.lxBrSaveTx=lxBrSaveTx;
// ---- appealing step-progress overlay for Confirm (theme-aware via CSS vars) ----
var LX_PSTEPS=[{k:"approve",label:"Approve spending",re:/approv|allowance/i},{k:"fee",label:"Collect bridge fee",re:/fee|swap/i},{k:"burn",label:"Burn on Stellar",re:/burn|bridging/i},{k:"attest",label:"Circle CCTP attestation",re:/attest/i}];
function lxBrProg(){ var el=document.getElementById("lx-prog"); if(!el){ el=document.createElement("div"); el.id="lx-prog"; el.className="lx-prog"; var items=LX_PSTEPS.map(function(s){return '<li data-pk="'+s.k+'"><span class="lx-pdot"><span class="lx-spin"></span><span class="lx-tick"></span></span><span class="lx-plab">'+s.label+'</span></li>';}).join(""); el.innerHTML='<div class="lx-prog-card"><div class="lx-prog-h">Bridging via Circle CCTP</div><div class="lx-prog-sub">Approve the wallet prompts — everything else runs automatically.</div><ul class="lx-prog-list">'+items+'</ul><div class="lx-prog-msg"></div><button class="lx-prog-x" type="button" hidden>Done</button></div>'; (document.querySelector(".br-card")||document.body).appendChild(el); el.querySelector(".lx-prog-x").addEventListener("click",function(){ el.style.display="none"; if(el.__ok){ lxBrResetWizard(); if(!el.__minted) lxBrGoPending(); } }); } return el; }
// A burn that was not minted leaves the reader with one thing they MUST still do, and closing the overlay
// used to drop them back on step 1 of an empty wizard with that transfer filed behind an unselected tab.
// Send them to it instead. Only when the mint did NOT happen: a completed bridge has nothing to claim, and
// Recent transactions is the right place for it.
function lxBrGoPending(){ try{
  if(!lxBrListPending().length) return;                  // nothing to send them to
  lxBrRenderPending();                                   // make sure the row for the burn that just happened exists
  var host=lxBrPendHost(); if(!host) return;             // the accessor also CREATES the host, so ask it rather than the DOM
  if(host.tabbed){                                       // desktop: a tab beside Recent transactions
    var tab=host.wrap.querySelector('.lx-brtab[data-brtab="pend"]');
    if(tab && !tab.hidden) tab.click();
  }
  var el=host.tabbed?host.wrap:host.el;                  // mobile ships a standalone panel instead
  // AFTER lxBrResetWizard, not alongside it: that runs its own step-back clicks on a 140ms timer, and a
  // smooth scroll started at 160ms was cancelled by the re-render every time -- measured on the phone
  // layout as scrollY still 0 a second after the click, while an instant scroll to the same element
  // landed at 815. Wait for the reset to settle, and scroll instantly so nothing can interrupt it.
  if(el&&el.scrollIntoView) setTimeout(function(){ try{ el.scrollIntoView({block:"start"}); }catch(_){ el.scrollIntoView(true); } },420);
}catch(_){} }
// after a successful bridge, return the wizard to step 1 and clear the form (recent transactions stays put)
function lxBrResetWizard(){ try{
  var s3=document.querySelector('.br-step[data-step="3"]'); var b3=s3?s3.querySelector('[data-go="2"]'):null; if(b3) b3.click();
  setTimeout(function(){ var s2=document.querySelector('.br-step[data-step="2"]'); var b2=s2?s2.querySelector('[data-go="1"]'):null; if(b2) b2.click();
    window.__lxBr.amount=''; var ain=document.querySelector('.br-step[data-step="2"] .br-amt .lx-amtin'); if(ain) ain.value='';
    var din=document.querySelector('.br-step[data-step="2"] .br-addr-in'); if(din) din.value='';
    lxBrStep2Err(''); lxBrValidateStep2();
  },140);
}catch(_){} }
// route: "LayerZero" swaps the header and hides the CCTP step list (approve / burn / attestation are not its steps;
// its own progress arrives as the status line instead). Anything else is the CCTP flow exactly as before.
function lxBrProgShow(route){ var el=lxBrProg(); el.style.display="flex"; el.__idx=-1; el.__ok=false; el.__route=route||"CCTP"; var x=el.querySelector(".lx-prog-x"); x.hidden=true; x.textContent="Done"; var h=el.querySelector(".lx-prog-h"); h.textContent=(route&&route!=="CCTP")?("Bridging via "+route):"Bridging via Circle CCTP"; var pl=el.querySelector(".lx-prog-list"); if(pl) pl.style.display=(route&&route!=="CCTP")?"none":""; var m=el.querySelector(".lx-prog-msg"); m.textContent="Preparing…"; m.style.color=""; [].slice.call(el.querySelectorAll(".lx-prog-list li")).forEach(function(li){ li.className=""; }); var g=el.querySelector(".lx-prog-gate"); if(g) g.style.display="none";
  // pre-load the web-wallet SDK so its sign popup can open synchronously from the gate click
  if(lxCctpIsWebWallet()){ try{ lxCctpMod("https://esm.sh/@albedo-link/intent@0.12.0"); }catch(_){} } }
function lxBrProgUpdate(msg){ var el=lxBrProg(); el.querySelector(".lx-prog-msg").textContent=msg; var idx=-1,i; for(i=0;i<LX_PSTEPS.length;i++){ if(LX_PSTEPS[i].re.test(msg)) idx=i; } if(idx<0||idx<(el.__idx||0))return; el.__idx=idx; var lis=el.querySelectorAll(".lx-prog-list li"); for(i=0;i<lis.length;i++){ lis[i].className = i<idx?"done":(i===idx?"active":""); } }
// AUDIT #1 (FUNDS): this used to claim "Bridge complete ✓ — your USDC is on its way" as soon as Circle
// attested. But CCTP only delivers once someone submits receiveMessage() on the DESTINATION chain, which this
// app does not do — so the transfer is NOT complete here. Report exactly what happened and keep the redeem
// data visible. Pass minted=true once a destination mint is actually performed.
function lxBrProgDone(res){
  var el=lxBrProg(); el.__ok=true; el.__minted=!!(res&&res.minted);   // drives where "Done" sends the reader
  // LayerZero: nothing to claim -- the executor delivers. Say what happened, how long the rest takes (measured median),
  // and where to watch it. __minted=true so "Done" does not send the reader to the CCTP claims tab.
  // NEAR Intents: done means DELIVERED -- this is only called once 1Click reports SUCCESS, with the destination tx
  if(res&&res.route==="NEAR Intents"){ el.__minted=true;
    [].slice.call(el.querySelectorAll(".lx-prog-list li")).forEach(function(li){ li.className="done"; });
    var nm=el.querySelector(".lx-prog-msg"); nm.style.color="";
    el.querySelector(".lx-prog-h").textContent="Delivered via NEAR Intents \u2713";
    nm.innerHTML=lxBrEsc(res.amountOut||"")+" "+lxBrEsc(res.asset||"")+" arrived at your "+lxBrEsc(res.dest||"destination")+" address. There is nothing to claim."
      +(res.destUrl?'<br><br><a href="'+lxBrEsc(res.destUrl)+'" target="_blank" rel="noopener" style="color:var(--accent,#ea6a2c);font-weight:700">View on '+lxBrEsc(res.dest||"explorer")+' \u2197</a>':'');
    el.querySelector(".lx-prog-x").hidden=false; return; }
  if(res&&res.route==="LayerZero"){ el.__minted=true;
    [].slice.call(el.querySelectorAll(".lx-prog-list li")).forEach(function(li){ li.className="done"; });
    var lm=el.querySelector(".lx-prog-msg"); lm.style.color="";
    el.querySelector(".lx-prog-h").textContent="Sent via LayerZero ✓";
    lm.innerHTML="Your USDT0 has left Stellar and will be delivered to your "+lxBrEsc(res.dest||"destination")+" address automatically, usually in about 30 minutes. There is nothing to claim."
      +(res.hash?'<br><br><a href="https://layerzeroscan.com/tx/'+res.hash+'" target="_blank" rel="noopener" style="color:var(--accent,#ea6a2c);font-weight:700">Track it on LayerZero Scan ↗</a>':'');
    el.querySelector(".lx-prog-x").hidden=false; return; }
  [].slice.call(el.querySelectorAll(".lx-prog-list li")).forEach(function(li){ li.className="done"; });
  var m=el.querySelector(".lx-prog-msg"); m.style.color="";
  if(res&&res.minted){
    el.querySelector(".lx-prog-h").textContent="Bridge complete ✓";
    m.textContent="Your USDC has been minted on the destination chain — added to Recent transactions.";
  }else{
    el.querySelector(".lx-prog-h").textContent="Burned on Stellar ✓ — awaiting mint";
    m.innerHTML='Your USDC was burned on Stellar and Circle has signed the attestation, but it has <b>not been minted on the destination chain yet</b> — that final step is not automated here.'
      +'<br><br>Your transfer is safe and recoverable: the burn hash, Circle message and attestation are stored in this browser.'
      // The hash and the copy action as ONE labelled panel, with a quiet outlined button: it is the backup, and "Done"
      // below stays the one primary action. (It used to be a second orange block, rendered at the message's 65%
      // opacity, which is what made it look washed out -- RAZA 2026-09-19.)
      +'<div class="lx-prog-redeem"><div class="lx-prog-rk">Burn transaction</div>'
      +(res&&res.burnHash?'<div class="lx-prog-rh">'+res.burnHash+'</div>':'')
      +'<button type="button" class="lx-prog-copy"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg><span>Copy redeem data</span></button></div>';
    var cb=m.querySelector(".lx-prog-copy");
    // "Copied" only once the clipboard actually took it -- writeText is a promise and can be refused
    if(cb)cb.addEventListener("click",function(){ var lab=cb.querySelector("span")||cb;
      function set(t,ok){ lab.textContent=t; cb.classList.toggle("is-ok",!!ok); cb.classList.toggle("is-bad",!ok); }
      try{ Promise.resolve(navigator.clipboard.writeText(JSON.stringify(res||{},null,2)))
        .then(function(){ set("Copied",true); }).catch(function(){ set("Copy failed \u2014 select the hash above",false); }); }
      catch(_){ set("Copy failed \u2014 select the hash above",false); } });
  }
  el.querySelector(".lx-prog-x").hidden=false;
}
function lxBrProgFail(msg){ try{ lxBrRefreshBalances(); }catch(_){} /* a swap may have landed first */ var el=lxBrProg(); el.querySelector(".lx-prog-h").textContent="Bridge failed"; var m=el.querySelector(".lx-prog-msg"); m.textContent=msg||"Something went wrong."; m.style.color="#e5484d"; var x=el.querySelector(".lx-prog-x"); x.hidden=false; x.textContent="Close"; }
window.lxBrProg={show:lxBrProgShow,update:lxBrProgUpdate,done:lxBrProgDone,fail:lxBrProgFail};
// Web-popup wallets (Albedo) can only open their sign popup from a fresh user click. The bridge needs
// several sequential signatures, so for those wallets we show an "Approve" button in the overlay before
// each signature and fire the actual signing INSIDE that click (keeping the gesture valid).
function lxCctpIsWebWallet(){ return lxCctpWalletId()==="albedo"; }
function lxCctpGateBtn(){ var el=lxBrProg(); var b=el.querySelector(".lx-prog-gate"); if(!b){ b=document.createElement("button"); b.type="button"; b.className="lx-prog-gate"; b.style.cssText="margin-top:16px;width:100%;padding:13px;border:0;border-radius:13px;background:linear-gradient(135deg,var(--accent,#ea6a2c),#ff8a3d);color:#fff;font:inherit;font-size:15px;font-weight:650;cursor:pointer;box-shadow:0 8px 20px rgba(234,106,44,.32)"; var msg=el.querySelector(".lx-prog-msg"); if(msg&&msg.parentNode){ msg.parentNode.insertBefore(b, msg.nextSibling); } else { el.querySelector(".lx-prog-card").appendChild(b); } } return b; }
// doSign(): a thunk that performs the actual wallet signature and returns its promise. For extension wallets
// it runs immediately; for web wallets it runs from the user's click on the gate button.
function lxCctpGateSign(label, doSign){
  if(!lxCctpIsWebWallet()) return doSign();
  return new Promise(function(resolve, reject){
    var el=lxBrProg(); var msg=el.querySelector(".lx-prog-msg"); if(msg) msg.textContent="Ready — click below to open your wallet and approve.";
    var b=lxCctpGateBtn(); b.textContent="Approve in "+(lxCctpWalletId()==="albedo"?"Albedo":"your wallet"); b.style.display="block"; b.disabled=false;
    function onClick(){ b.removeEventListener("click", onClick); b.style.display="none"; if(msg) msg.textContent="Waiting for signature ("+label+")…";
      var p; try{ p=doSign(); }catch(e){ reject(e); return; } Promise.resolve(p).then(resolve, reject); }
    b.addEventListener("click", onClick);
  });
}
// Destination-address funding gate ---------------------------------------------------------------------
// A cross-chain transfer is one-way and final. A typo'd address, or a right-looking address on the wrong
// chain, burns the USDC into something nobody can spend — and unlike a Stellar payment there is no
// account-not-found error to stop it, because any 20-byte string is a valid EVM address.
//
// Requiring the destination to already hold a little gas does two jobs. It is a cheap proof the address is
// a real, used account on THAT chain, and — because claiming is the user's own transaction — it is proof
// they can actually complete the transfer once the USDC is burned. An address with no gas cannot claim.
//
// Anything we cannot check (an RPC hiccup, a chain with no usable public endpoint) passes. Our own
// infrastructure failing is not evidence against the user's address.
// Exchange destinations ---------------------------------------------------------------------------------
// Sending bridged USDC straight to an exchange deposit or hot wallet is a well-known way to lose it. The
// mint arrives from a contract call rather than a normal transfer, often on a chain the account was never
// meant to receive on, and exchanges routinely fail to credit those — with no way to reverse it. And the
// user cannot claim from an address they do not hold the keys to.
//
// Every address below was checked on Ethereum mainnet before being listed: each has either a transaction
// count in the thousands-to-millions or a balance no individual holds. A blocklist that guesses would stop
// real users, so nothing goes in unverified. Exchanges reuse these addresses across EVM chains, so one
// list covers every destination we offer.
var LX_CEX={
  "0xbe0eb53f46cd790cd13851d5eff43d12404d33e8":"Binance","0xf977814e90da44bfa03b6295a0616a897441acec":"Binance",
  "0x28c6c06298d514db089934071355e5743bf21d60":"Binance","0x21a31ee1afc51d94c2efccaa2092ad1028285549":"Binance",
  "0xdfd5293d8e347dfe59e90efd55b2956a1343963d":"Binance","0x56eddb7aa87536c09ccc2793473599fd21a8b17f":"Binance",
  "0x4976a4a02f38326660d17bf34b431dc6e2eb2327":"Binance",
  "0x71660c4005ba85c37ccec55d0c4493e66fe775d3":"Coinbase","0x503828976d22510aad0201ac7ec88293211d23da":"Coinbase",
  "0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740":"Coinbase","0x3cd751e6b0078be393132286c442345e5dc49699":"Coinbase",
  "0xeb2629a2734e272bcc07bda959863f316f4bd4cf":"Coinbase","0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43":"Coinbase",
  "0xae2d4617c862309a3d75a0ffb358c7a5009c673f":"Kraken",
  "0x6cc5f688a315f3dc28a7781717a9a798a59fda7b":"OKX","0x236f9f97e0e62388479bf9e5ba4889e46b0273c3":"OKX",
  "0xf89d7b9c864f589bbf53a82105107622b35eaa40":"Bybit",
  "0x2b5634c42055806a59e9107ed44d43c426e58258":"KuCoin",
  "0x0d0707963952f2fba59dd06f2b425ace40b492fe":"Gate.io",
  "0x876eabf441b2ee5b5b0554fd502a8e0600950cfa":"Bitfinex",
  "0xab5c66752a9e8167967685f1450532fb96d5d24f":"HTX",
  "0x5bdf85216ec1e38d6458c870992a69e38e03f7ef":"Bitget",
  "0x2efb50e952580f4ff32d8d2122853432bbf2e204":"Robinhood",
  "0x390de26d772d2e2005c6d1d24afc902bae37a4bb":"Upbit",
  "0x6262998ced04146fa42253a5c0af90ca02dfd2a3":"Crypto.com",
  "0x0211f3cedbef3143223d3acf0e589747933e8527":"MEXC"
};
// No list stays current. A live signal catches the rest: nobody sends a hundred thousand transactions from
// a wallet they hold personally, so a nonce that high is an exchange, a bridge or a bot — none of which is
// somewhere to receive a claimable transfer.
var LX_CEX_NONCE=100000;

var LX_MINUSD=0.5;
var LX_NATIVE={0:"ethereum",1:"avalanche-2",2:"ethereum",3:"ethereum",5:"solana",6:"ethereum",7:"polygon-ecosystem-token",11:"ethereum",14:"ethereum"};
var LX_NATSYM={0:"ETH",1:"AVAX",2:"ETH",3:"ETH",5:"SOL",6:"ETH",7:"POL",11:"ETH",14:"ETH"};
var lxPxP=null;
function lxNativeUsd(){ if(lxPxP) return lxPxP;
  lxPxP=fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum,avalanche-2,polygon-ecosystem-token,solana&vs_currencies=usd")
    .then(function(r){ return r.json(); }).catch(function(){ return null; });
  return lxPxP; }
function lxJrpc(url,method,params){
  return fetch(url,{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({jsonrpc:"2.0",id:1,method:method,params:params||[]})}).then(function(r){ return r.json(); }); }
function lxBrDestFunded(domain,addr){
  var cfg=LX_EVM[domain], bp;
  if(cfg) bp=lxJrpc(cfg.rpc,"eth_getBalance",[addr,"latest"]).then(function(d){ return (d&&d.result)?parseInt(d.result,16)/1e18:null; });
  else if(domain===5) bp=lxJrpc("https://api.mainnet-beta.solana.com","getBalance",[addr]).then(function(d){ var v=d&&d.result&&d.result.value; return (v==null)?null:v/1e9; });
  else return Promise.resolve({ok:true});      // Sui has no usable public JSON-RPC left to ask
  return bp.then(function(bal){ if(bal==null) return {ok:true};
    return lxNativeUsd().then(function(px){
      var id=LX_NATIVE[domain], u=px&&px[id]&&px[id].usd; if(!u) return {ok:true};
      if(bal*u>=LX_MINUSD) return {ok:true};
      var sym=LX_NATSYM[domain]||"gas", nm=lxBrDomName(domain);
      return {ok:false,msg:"That "+nm+" address holds "+(bal>0?(bal.toFixed(6)+" "+sym):("no "+sym))
        +". LumosCore only sends to a destination already funded with at least $0.50 \u2014 an unused address is usually a wrong one, and a cross-chain transfer cannot be undone. Check the address, fund it on "+nm+", then try again."};
    });
  }).catch(function(){ return {ok:true}; }); }
window.lxBrDestFunded=lxBrDestFunded;

// Named exchange first (instant, certain), then the nonce signal (one call, catches what the list misses).
function lxBrDestExchange(domain,addr){
  var cfg=LX_EVM[domain]; if(!cfg) return Promise.resolve({ok:true});
  var named=LX_CEX[String(addr||"").toLowerCase()];
  if(named) return Promise.resolve({ok:false,msg:"That looks like a "+named+" address. A cross-chain transfer cannot be sent to an exchange \u2014 the USDC arrives from a contract call that exchanges usually will not credit, and you would have no way to claim it. Use a wallet you hold the keys to, then send to "+named+" from there."});
  return lxJrpc(cfg.rpc,"eth_getTransactionCount",[addr,"latest"]).then(function(d){
    var n=(d&&d.result)?parseInt(d.result,16):0;
    if(n>=LX_CEX_NONCE) return {ok:false,msg:"That address has sent "+n.toLocaleString("en-US")+" transactions, which means it is an exchange, a bridge or an automated service rather than a personal wallet. Send to a wallet you control \u2014 you need its keys to claim the USDC."};
    return {ok:true};
  }).catch(function(){ return {ok:true}; }); }
window.lxBrDestExchange=lxBrDestExchange;

// One gate, cheapest and most certain check first.
function lxBrDestCheck(domain,addr){
  return lxBrDestExchange(domain,addr).then(function(x){ return x.ok?lxBrDestFunded(domain,addr):x; }); }
window.lxBrDestCheck=lxBrDestCheck;

function lxBrConfirm(btn){
  var B=window.__lxBr, k=B.srcKey, A=LX_ASSETS[k]||LX_ASSETS.USDC, C=window.__lxCCTP, net=lxBrDestNet();
  var domain=(C&&C.domains)?C.domains[net]:null;
  var s2=document.querySelector('.br-step[data-step="2"]'); var dstIn=s2?s2.querySelector('.br-addr-in'):null;
  var recipient=dstIn?(dstIn.value||"").trim():""; var amt=B.amount||"";
  var s3=document.querySelector('.br-step[data-step="3"]'); var errslot=s3?s3.querySelector('.br-errslot'):null;
  function say(m,ok){ if(errslot){ errslot.setAttribute('data-err',ok?'':m); errslot.textContent=m; errslot.style.color=ok?'#3fb950':''; } }
  say("");
  if(!(parseFloat(amt)>0)){ say("Enter a valid amount on the previous step."); return; }
  if(window.__lxBrRoute==="LayerZero"){ lxBrConfirmLz(btn,say,net,domain,recipient,amt,k,A); return; }
  // NEAR Intents: its own flow in _nearintents.js (swap if needed -> fresh live quote -> deposit with memo -> track)
  if(window.__lxBrRoute==="NEAR Intents"){
    if(!window.__lxNiSendable||!window.lxNiConfirm){ say("Sending by NEAR Intents isn't switched on yet — choose another route."); return; }
    window.lxNiConfirm(btn,say,net,domain,recipient,amt,k,A); return; }
  if(domain==null){ say("Select a CCTP-supported destination network."); return; }
  if(!recipient){ say("Paste the destination address on the previous step."); return; }
  // check the destination is a live account BEFORE any signature — nothing is burned yet, so this is the
  // last moment a wrong address costs nothing
  if(btn) btn.disabled=true;
  say("Checking the destination address\u2026",true);   // progress, not an error: green (RAZA 2026-09-19)
  lxBrDestCheck(domain,recipient).then(function(chk){
    if(btn) btn.disabled=false;
    if(!chk.ok){ say(chk.msg); return; }
    say(""); go();
  });
  function go(){
  lxBrProgShow();
  function status(m){ lxBrProgUpdate(m); }
  try{ lxCctpBridgeFull(domain, amt, recipient, A.spec, status, window.__lxBr.netUsdc).then(function(res){
    lxBrProgDone(res); lxBrRefreshBalances();
    var tx={src:(B.pk||LX_SRC_ADDR), recipient:recipient, srcAmount:amt, srcKey:k, amount:res.netUsdc, net:net, hash:res.burnHash, ts:Date.now(), minted:!!res.minted};
    lxBrAddRecentTx(tx); lxBrSaveTx(tx);
  }).catch(function(e){
    // AUDIT #1/#3 (FUNDS): if the burn already happened, the transfer must still be recorded and shown —
    // previously an attestation timeout skipped both, leaving burned USDC with no trace anywhere.
    var bh=e&&e.__lxBurnHash;
    if(bh){
      var tx2={src:(B.pk||LX_SRC_ADDR), recipient:recipient, srcAmount:amt, srcKey:k, amount:(window.__lxBr.netUsdc||amt), net:net, hash:bh, ts:Date.now(), minted:false};
      try{ lxBrAddRecentTx(tx2); lxBrSaveTx(tx2); }catch(_){}
      lxBrProgFail(((e&&e.message)||"Attestation not ready")+" — your USDC is burned and recorded; it can be redeemed once Circle finalizes.");
    } else { lxBrProgFail((e&&e.message)||"Bridge failed."); }
  });
  }catch(e){ lxBrProgFail((e&&e.message)||"Bridge failed."); }
  }
}
// ---- Confirm, LayerZero route --------------------------------------------------------------------------------
// Until 2026-09-19 Confirm ran the CCTP engine whatever route was chosen (lxLzBridgeFull existed with no caller).
// The same guarantees as the CCTP path, in the same order, before any signature:
//   1. the address is well-formed for that chain (LX_EVM_NETS now covers every LayerZero destination);
//   2. where the chain is one we can read (it is also a CCTP chain), the exchange + funded-address checks;
//   3. there is enough SPENDABLE XLM for LayerZero's messaging fee -- the reserve and open offers held back,
//      plus the XLM being sent when XLM is the source, plus a trustline's reserve if USDT0 must be opened.
function lxBrConfirmLz(btn,say,net,domain,recipient,amt,k,A){
  var C=window.__lxCCTP||{};
  if(!window.__lxLzSendable||!window.lxLzBridgeFull){ say("Sending by LayerZero isn't switched on yet — choose CCTP to continue."); return; }
  if(!recipient){ say("Paste the destination address on the previous step."); return; }
  if(!lxBrValidAddr(net,recipient)){ say("That doesn't look like a valid "+net+" address."); return; }
  // the source asset as {code,issuer} -- USDC's entry is the string "USDC", which the LayerZero engine cannot use
  var spec=(A.spec==="USDC")?{code:"USDC",issuer:C.usdcIssuer}:A.spec;
  if(btn) btn.disabled=true;
  say("Checking the destination address and your XLM…",true);   // progress, not an error: green
  var addrP=(domain!=null)?lxBrDestCheck(domain,recipient):Promise.resolve({ok:true});
  addrP.then(function(chk){
    if(!chk.ok) throw {user:chk.msg};
    return Promise.all([ window.lxLzQuote(net,parseFloat(amt)||1,recipient),
      fetch(C.horizon+"/accounts/"+(window.__lxBr.pk||"")).then(function(r){ return r.json(); }).catch(function(){ return null; }) ]);
  }).then(function(pair){
    var q=pair[0], ac=pair[1]; var fee=(q&&q.feeXlm)||0;
    if(ac&&ac.balances){
      var nat=ac.balances.filter(function(b){ return b.asset_type==="native"; })[0]||{};
      var reserve=(2+(+ac.subentry_count||0)+(+ac.num_sponsoring||0)-(+ac.num_sponsored||0))*0.5;
      var free=(+nat.balance||0)-reserve-(+nat.selling_liabilities||0);
      var hasT0=ac.balances.some(function(b){ return b.asset_code==="USDT0"; });
      var need=fee*1.1+0.05+(k==="XLM"?(parseFloat(amt)||0):0)+((!hasT0&&k!=="USDT0")?0.5:0);
      if(free<need) throw {user:"LayerZero's messaging fee is "+fee.toFixed(4)+" XLM, paid from your wallet. You have "+Math.max(0,free).toFixed(4)+" XLM spendable"+(k==="XLM"?" beyond the amount you're sending":"")+" — you need about "+need.toFixed(4)+" XLM. Add XLM, or choose CCTP."};
    }
    if(btn) btn.disabled=false; say(""); goLz(fee);
  }).catch(function(e){ if(btn) btn.disabled=false; say((e&&e.user)||("Could not check this transfer: "+((e&&e.message)||e))); });

  function goLz(fee){
    lxBrProgShow("LayerZero");
    window.lxLzBridgeFull(net,amt,recipient,spec,function(m){ lxBrProgUpdate(m); }).then(function(res){
      lxBrProgDone({route:"LayerZero", hash:res.hash, dest:net, amount:res.net, feeXlm:res.feeXlm}); lxBrRefreshBalances();
    }).catch(function(e){
      var m=(e&&e.message)||"Transfer failed.";
      // The swap is its own transaction: if it went through and the send did not, the USDT0 is in the wallet.
      if(e&&e.__lxSwapped) m+=" — your swap completed, so the USDT0 is in your Stellar wallet. Nothing was sent cross-chain.";
      lxBrProgFail(m); lxBrRefreshBalances();   // a swap may have gone through before the failure
    });
  }
}
function lxCctpWireStep3(){
  var s3=document.querySelector('.br-step[data-step="3"]'); if(!s3)return;
  if(!s3.__lxWired){ s3.__lxWired=true;
    var btns=[].slice.call(s3.querySelectorAll('.br-actions .br-next, button.br-next'));
    var cf=btns.filter(function(b){ return /confirm/i.test(b.textContent||''); })[0]||btns[btns.length-1];
    if(cf) cf.addEventListener('click',function(e){ e.preventDefault(); e.stopPropagation(); lxBrConfirm(cf); },true);
  }
  lxBrReview();
}
(function(){
  function shown(){ var s3=document.querySelector('.br-step[data-step="3"]'); return s3 && !s3.hasAttribute('hidden') && getComputedStyle(s3).display!=="none"; }
  function onShow(){ if(shown()) lxCctpWireStep3(); }
  var n=0, iv=setInterval(function(){ n++; onShow(); if(n>40) clearInterval(iv); },300);
  document.addEventListener('click',function(e){ if(e.target.closest && e.target.closest('[data-go="3"]')){ setTimeout(onShow,50); setTimeout(onShow,280); } },true);
  try{ var mo=new MutationObserver(onShow); var s3=document.querySelector('.br-step[data-step="3"]'); if(s3) mo.observe(s3,{attributes:true,attributeFilter:["hidden","style","class"]}); }catch(_){}
})();

// ---- "Awaiting redemption" panel (AUDIT #1/#3 follow-through) --------------------------------------
// A CCTP transfer is only finished when receiveMessage() is submitted on the DESTINATION chain. LumosCore
// has no signer there, so burned transfers sit in lumos.cctp.pending. Until now nothing rendered them, which
// meant the recovery store was invisible: the user saw the burn hash once, in a modal, and then never again.
// This surfaces every unredeemed transfer, re-checks Circle for a late attestation, and hands over the exact
// payload needed to claim the USDC. Panel stays hidden entirely when there is nothing pending.
// Includes domains no longer offered as destinations: a transfer burned before Solana/Sui were withdrawn
// still has to name its chain properly in the pending list rather than read "chain 5".
// PUBLIC cross-chain history, baked in at build time from the chain (see _tools/_cctp_public.json,
// regenerated by scanning deposit_for_burn on the CCTP TokenMessenger). Everyone sees these with no
// wallet connected: a browser cannot read another browser's localStorage, so a shared list has to
// ship with the page until there is a server-side feed.
var LX_PUBTX=[{"ts":1786677750000,"hash":"71085fcb0ba8193e97331b709da680edcb451d33b4e9e4606ce3cd30551ff853","amount":1.269819,"srcAmount":"1.269819","srcKey":"USDC","net":"Base","recipient":"0x18789c94642c5295cfc1b344f60a3a24fd7ecc39","src":"GCVZ2EHCGY2GES7DMPRKM4424QVKXEVLLR6FBZG34PYMWTR7IZC44X2J"}];
// src read off the ledger 2026-09-19: the burn's source account, and the account the 1.269819 USDC left. This entry
// predates the shared bridge record, so it was hand-written -- without the field the Source address column reads.
var LX_DOMNAME={0:"Ethereum",1:"Avalanche",2:"Optimism",3:"Arbitrum",5:"Solana",6:"Base",7:"Polygon",8:"Sui",11:"Linea",14:"World Chain"};
function lxBrDomName(d){ var C=window.__lxCCTP,m=(C&&C.domains)||{}; for(var k in m){ if(m[k]===d) return k; } return LX_DOMNAME[d]||("chain "+d); }
function lxBrEsc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function lxBrShortH(h){ h=String(h||""); return h.length>16?(h.slice(0,8)+"\u2026"+h.slice(-6)):h; }
// stored amounts are 7dp strings ("124.500000") — show them the way the rest of the bridge does
function lxBrAmt(v){ var n=parseFloat(v); if(!isFinite(n)) return String(v||""); return n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:6}); }
// single-shot attestation check — the 400-poll loop belongs to an in-flight bridge, not to a page load
function lxBrPeekAttest(hash){ var C=window.__lxCCTP; if(!C||!hash) return Promise.resolve(null);
  return fetch(C.iris+"/v2/messages/"+C.sourceDomain+"?transactionHash="+hash).then(function(r){return r.json();}).then(function(d){
    var m=(d&&d.messages&&d.messages[0])||null;
    if(m&&m.status==="complete"&&m.attestation&&m.attestation!=="PENDING") return {message:m.message,attestation:m.attestation,decodedMessage:m.decodedMessage};
    return null; }).catch(function(){ return null; }); }
// ---- EVM destination mint: the half of CCTP that actually delivers the USDC ---------------------------
// A CCTP transfer BURNS on the source and mints nothing until receiveMessage() runs on the destination.
// Circle operates no relayer (their technical guide: "An API consumer must query this attestation and
// submits it onchain to the destination domain's MessageTransmitterV2#receiveMessage function"), so
// without this the user's USDC is destroyed on Stellar and exists nowhere.
//
// Everything below is verified against mainnet, not taken from docs:
//  - MessageTransmitterV2 is at the SAME address on every EVM chain (CREATE2). localDomain() returns the
//    correct CCTP domain on all 8, and version() returns 1 = CCTP V2, matching our Stellar burn.
//  - selector 0x57ecfd28 = receiveMessage(bytes,bytes): calling it with dummy args reverts with
//    "Invalid attestation length" (a reason from INSIDE the function) while a bogus selector reverts empty.
//  - every chainId below came from that chain's own eth_chainId.
var LX_MT="0x81D40F21F12A8F0E3252Bccb954D722d4c464B64";
var LX_EVM={
  0:{n:"Ethereum",id:"0x1",cur:"ETH",rpc:"https://ethereum-rpc.publicnode.com",exp:"https://etherscan.io"},
  1:{n:"Avalanche",id:"0xa86a",cur:"AVAX",rpc:"https://avalanche-c-chain-rpc.publicnode.com",exp:"https://snowtrace.io"},
  2:{n:"Optimism",id:"0xa",cur:"ETH",rpc:"https://optimism-rpc.publicnode.com",exp:"https://optimistic.etherscan.io"},
  3:{n:"Arbitrum",id:"0xa4b1",cur:"ETH",rpc:"https://arbitrum-one-rpc.publicnode.com",exp:"https://arbiscan.io"},
  6:{n:"Base",id:"0x2105",cur:"ETH",rpc:"https://base-rpc.publicnode.com",exp:"https://basescan.org"},
  7:{n:"Polygon",id:"0x89",cur:"POL",rpc:"https://polygon-bor-rpc.publicnode.com",exp:"https://polygonscan.com"},
  11:{n:"Linea",id:"0xe708",cur:"ETH",rpc:"https://linea-rpc.publicnode.com",exp:"https://lineascan.build"},
  14:{n:"World Chain",id:"0x1e0",cur:"ETH",rpc:"https://worldchain-mainnet.g.alchemy.com/public",exp:"https://worldscan.org"}
};
function lxHex32(n){ var h=(+n).toString(16); while(h.length<64)h="0"+h; return h; }
function lxBytesArg(hex){ hex=String(hex||"").replace(/^0x/,""); if(hex.length%2)hex="0"+hex;
  var len=hex.length/2, pad=(64-(hex.length%64))%64, z=""; while(z.length<pad)z+="0"; return {len:len,body:hex+z}; }
function lxAbiReceive(msg,att){ var a=lxBytesArg(msg), b=lxBytesArg(att);
  var off1=64, off2=64+32+Math.ceil(a.len/32)*32;
  return "0x57ecfd28"+lxHex32(off1)+lxHex32(off2)+lxHex32(a.len)+a.body+lxHex32(b.len)+b.body; }
function lxEvmProv(){ return (window.ethereum||null); }
// "Install MetaMask or Rabby" is advice a phone cannot take: there are no browser extensions on mobile,
// so this message sent every mobile claimer to a dead end while their USDC sat burned. On a phone the
// real route is the wallet app's OWN browser -- and the non-obvious part is that this transfer lives in
// THIS browser's localStorage, so it does not follow you into that app. Copy the redeem data first.
// UA only, deliberately: the question is whether this PLATFORM can have a browser extension, which a
// viewport width does not answer. A first attempt fell back to "touch and innerWidth<900" and served the
// phone message to a touch-screen Windows desktop -- caught because the test pane reported width 0, but a
// narrow window on a touch laptop would have done it too. A desktop browser keeps its extensions at any size.
function lxIsPhoneUA(){ try{
  return /Android|iPhone|iPad|iPod|Windows Phone|Mobile Safari/i.test(navigator.userAgent||"");
}catch(_){ return false; } }
function lxNoProvMsg(){ return lxIsPhoneUA()
  ? "No wallet browser detected. On a phone there are no extensions \u2014 claiming has to happen inside your wallet app's own browser (MetaMask, Rabby, Coinbase Wallet), or on a desktop that has one. Tap \u201cCopy redeem data\u201d first: this transfer is stored in THIS browser and will not follow you into the wallet app. Your burn is safe either way."
  : "No EVM wallet detected \u2014 install MetaMask or Rabby to claim on the destination chain."; }
function lxEvmReq(m,p){ var e=lxEvmProv();
  if(!e)return Promise.reject(new Error(lxNoProvMsg()));
  return e.request({method:m,params:p||[]}); }
function lxEvmConnect(){ return lxEvmReq("eth_requestAccounts").then(function(a){ if(!a||!a.length)throw new Error("No account authorised in your EVM wallet."); return a[0]; }); }
function lxEvmSwitch(cfg){ return lxEvmReq("wallet_switchEthereumChain",[{chainId:cfg.id}]).catch(function(e){
  if(e&&(e.code===4902||/unrecogni|not added|add this network/i.test(e.message||"")))
    return lxEvmReq("wallet_addEthereumChain",[{chainId:cfg.id,chainName:cfg.n,nativeCurrency:{name:cfg.cur,symbol:cfg.cur,decimals:18},rpcUrls:[cfg.rpc],blockExplorerUrls:[cfg.exp]}]);
  throw e; }); }
function lxEvmWait(hash){ var n=0; function poll(){ return lxEvmReq("eth_getTransactionReceipt",[hash]).then(function(r){
  if(r&&r.blockNumber)return (r.status==="0x1"||r.status===1);
  if(++n>90)return null;                       // give up WAITING, never claim an unknown result as success
  return new Promise(function(res){setTimeout(res,2000);}).then(poll); }); } return poll(); }
// already-minted reverts with a nonce error — that is a SUCCESS state for the user, not a failure
function lxAlreadyMinted(e){ return /nonce already used|already used|used nonce/i.test((e&&(e.message||e.data&&e.data.message))||""); }
function lxEvmMint(rec,onStatus){
  var cfg=LX_EVM[rec.destDomain];
  if(!cfg)return Promise.reject(new Error("Minting is not wired for this chain yet \u2014 use Copy redeem data."));
  if(!rec.message||!rec.attestation)return Promise.reject(new Error("This transfer has no attestation yet \u2014 press Check status first."));
  var data=lxAbiReceive(rec.message,rec.attestation), from=null;
  onStatus("Connecting your EVM wallet\u2026");
  return lxEvmConnect().then(function(a){ from=a; onStatus("Switching to "+cfg.n+"\u2026"); return lxEvmSwitch(cfg); })
    .then(function(){ onStatus("Checking the claim will succeed\u2026");
      // SIMULATE FIRST: a malformed or already-spent message fails here, free, before the wallet ever opens
      return lxEvmReq("eth_call",[{from:from,to:LX_MT,data:data},"latest"]); })
    .then(function(){ onStatus("Confirm in your wallet\u2026");
      return lxEvmReq("eth_sendTransaction",[{from:from,to:LX_MT,data:data}]); })
    .then(function(hash){ onStatus("Waiting for "+cfg.n+" to confirm\u2026");
      // Remember the submission ON THE RECORD, so a re-render shows "submitted" rather than the Claim button again,
      // and let the chain sweep clear the row the moment usedNonces agrees -- not whenever the wallet reports.
      try{ rec.claimTx=hash; rec.claimAt=Date.now(); lxBrSavePending(rec); lxBrRenderPending(); setTimeout(lxBrSweepClaimed,6000); }catch(_){}
      return lxEvmWait(hash).then(function(ok){ return {hash:hash,ok:ok,chain:cfg.n,exp:cfg.exp}; }); });
}
window.lxEvmMint=lxEvmMint; window.lxAbiReceive=lxAbiReceive;

// ---- is it claimed? Ask the destination chain, not the wallet --------------------------------------------------
// RAZA 2026-09-19: claimed on Polygon from MetaMask's browser (MetaMask: "Transaction #2 complete"), yet the row stayed
// until a refresh. The row waited on the WALLET to report a receipt, up to 3 minutes -- and a re-render in between left
// it on a detached button. The chain is the authority: Circle's MessageTransmitter marks every message it mints in
// usedNonces(nonce), permanently. The nonce is bytes 12..44 of the CCTP v2 message (checked against Circle's own
// eventNonce for a real transfer: identical). Read through the chain's PUBLIC RPC, so it needs no wallet and works for
// claims made anywhere -- another browser, another device, a block explorer.
function lxBrNonce(rec){ var m=String((rec&&rec.message)||""); if(m.slice(0,2)!=="0x"||m.length<2+88) return ""; return m.slice(2+24,2+24+64); }
function lxBrClaimedOnChain(rec){
  var cfg=LX_EVM[rec&&rec.destDomain], n=lxBrNonce(rec);
  if(!cfg||!cfg.rpc||!n) return Promise.resolve(null);                 // unknown -- never guess "claimed"
  return lxJrpc(cfg.rpc,"eth_call",[{to:LX_MT,data:"0xfeb61724"+n},"latest"]).then(function(d){
    var r=d&&d.result; if(typeof r!=="string"||r.length<3) return null;
    return /[1-9a-f]/i.test(r.slice(2)); }).catch(function(){ return null; }); }
// Sweep the panel: every attested row is checked against its chain; a claimed one is cleared with a toast. Runs on
// load, and every 10s while a claim is in flight (a row carrying claimTx) -- so the row goes the moment the chain
// agrees, whatever the wallet reports.
// A ROW IS NOT SHOWN UNTIL THE CHAIN HAS BEEN ASKED (RAZA 2026-09-20: "it shows me that i have 2 claimables for 2
// seconds and then it instantly fixes"). The panel painted from the saved list the moment the page opened, and the
// sweep below -- the only thing that knows a claim already happened, possibly on another device an hour ago -- ran
// afterwards. So the claim count flashed up and then corrected itself, with a toast announcing an hour-old claim as if
// it had just landed. Rows that COULD already be claimed (attested, with a message to check) are held back until the
// first sweep answers; a row still waiting for its attestation cannot have been claimed, so it shows at once.
var _lxPendOk={}, _lxPendFailsafe=false;
// visible when: it cannot be claimed yet (no attestation), or the chain has said it is NOT claimed, or the check itself
// never answered (failsafe) -- never hidden indefinitely because an RPC is down.
function lxBrPendVisible(list){ return list.filter(function(r){
  if(!(r&&r.attestation&&r.message)) return true;
  return _lxPendFailsafe||!!_lxPendOk[r.burnHash]; }); }
var _lxSweepT=null;
function lxBrSweepClaimed(quiet){ try{
  var list=lxBrListPending().filter(function(x){ return x&&x.attestation&&x.message; }).slice(0,8); if(!list.length) return;
  Promise.all(list.map(function(rec){ return lxBrClaimedOnChain(rec).then(function(c){ return {rec:rec,c:c}; }); })).then(function(res){
    var cleared=0;
    res.forEach(function(x){ if(x.c!==true&&x.rec&&x.rec.burnHash) _lxPendOk[x.rec.burnHash]=1;   // asked, and not claimed
      if(x.c===true){ lxBrClearPending(x.rec.burnHash); cleared++;
      // only for a claim that completes while the page is open: on load this sweep is reconciliation, not news
      if(!quiet) lxBrToast("Claimed on "+((LX_EVM[x.rec.destDomain]||{}).n||lxBrDomName(x.rec.destDomain))+" \u2014 "+lxBrAmt(x.rec.netUsdc)+" USDC"); } });
    lxBrRenderPending();
    var inFlight=lxBrListPending().some(function(x){ return x&&x.claimTx; });
    clearTimeout(_lxSweepT); if(inFlight) _lxSweepT=setTimeout(lxBrSweepClaimed,10000);
  });
}catch(_){} }
window.lxBrSweepClaimed=lxBrSweepClaimed;
// At once, and QUIETLY: this first pass is reconciliation with the chain, not news. Nothing waits on it except the rows
// it might clear -- and if the RPC never answers they are shown anyway, rather than hidden for good.
lxBrSweepClaimed(true);
setTimeout(function(){ _lxPendFailsafe=true; lxBrRenderPending(); },6000);


// Bottom-centre dark pill with a green circled check — the same toast the wallet and issuer copy buttons
// use elsewhere on the site, same markup and same timing.
function lxBrToast(msg,isErr){
  var CK='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  var stack=document.querySelector(".lx-ctoast-stack");
  if(!stack){ stack=document.createElement("div"); stack.className="lx-ctoast-stack"; document.body.appendChild(stack); }
  var t=document.createElement("div"); t.className="lx-ctoast"+(isErr?" lxa-terr":"");
  t.innerHTML='<span class="ci">'+CK+'</span><span>'+lxBrEsc(msg||"")+'</span>';
  stack.appendChild(t);
  setTimeout(function(){ t.style.transition="opacity .22s,transform .22s"; t.style.opacity="0"; t.style.transform="translateY(8px)";
    setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); },240); }, isErr?4000:3200); }
window.lxBrToast=lxBrToast;

function lxBrRedeemJSON(r){ var C=window.__lxCCTP||{};
  return JSON.stringify({ burnHash:r.burnHash, sourceChain:"Stellar", sourceDomain:C.sourceDomain,
    destinationChain:lxBrDomName(r.destDomain), destinationDomain:r.destDomain, recipient:r.recipient,
    amountUSDC:r.netUsdc, status:r.status, message:r.message||null, attestation:r.attestation||null }, null, 2); }
// Where the pending claims render.
//
// DESKTOP: as a second tab inside the Recent transactions section — "Recent transactions | Pending claims
// (N)". A standalone panel stacked above it was a second heading competing with the one below it for the
// same subject; a tab puts both views of your transfers in one place.
//
// MOBILE: that section does not exist on the phone build at all, so there it stays a standalone panel
// after the wizard card. Anchoring only on the table is what previously made the whole thing invisible on
// mobile, which is the one place a Stellar-only user is most likely to be.
function lxBrPendHost(){
  var wrap=document.querySelector(".br-txwrap");
  if(wrap){
    var body=wrap.querySelector(".lx-brpbody");
    if(!body){
      var head=wrap.querySelector(".br-txhead"), tbl=wrap.querySelector(".br-table");
      if(!head||!tbl) return null;
      head.classList.add("lx-brtabs");
      head.innerHTML='<button type="button" class="lx-brtab active" data-brtab="tx">Recent transactions</button>'
        +'<button type="button" class="lx-brtab" data-brtab="pend" hidden>Pending claims <span class="lx-brtab-n">0</span></button>';
      body=document.createElement("div"); body.className="lx-brpbody"; body.style.display="none";
      tbl.parentNode.insertBefore(body,tbl.nextSibling);
      head.addEventListener("click",function(e){
        var b=e.target&&e.target.closest?e.target.closest(".lx-brtab"):null; if(!b) return;
        e.preventDefault(); e.stopPropagation();
        var pend=b.getAttribute("data-brtab")==="pend";
        [].slice.call(head.querySelectorAll(".lx-brtab")).forEach(function(x){ x.classList.toggle("active",x===b); });
        // the design paints .br-table as display:table, so the hidden attribute alone would not win
        tbl.style.display=pend?"none":"";
        body.style.display=pend?"":"none";
        // the pager belongs to the table, so it leaves with it
        var pg=wrap.querySelector(".lx-brtxpg"); if(pg) pg.style.display=pend?"none":"";
      },true);
    }
    return {el:body,tabbed:true,wrap:wrap};
  }
  var p=document.getElementById("lxBrPending");
  if(!p){
    p=document.createElement("section"); p.id="lxBrPending"; p.className="lx-brpend"; p.style.display="none";
    var card=document.querySelector(".br-card")||document.querySelector(".br-wizard");
    if(!card||!card.parentNode) return null;
    card.parentNode.insertBefore(p,card.nextSibling);
  }
  return {el:p,tabbed:false}; }
// Paste a video URL here (YouTube, Loom, anything with a public link) and a "Watch how to claim" button
// appears in the panel. Leave it empty and the written steps stand on their own.
var LX_CLAIMVID="";   // <-- paste the tutorial video URL here; the Watch tutorial button appears once it is set
// Sits in the panel header, next to the count — the first thing you see, not something you have to open.
// Which wallet the Claim button will actually open. MetaMask is the default and what most people have,
// but window.ethereum is whatever is injected — showing a fox to someone using Rabby would be a lie, so
// an unrecognised provider gets a neutral wallet glyph and its own name in the tooltip.
var LX_FOX='<svg class="lx-wico" viewBox="0 0 32 32" aria-hidden="true">'
+'<polygon fill="#e17726" points="30.1,1.5 17.6,10.8 19.9,5.3"/><polygon fill="#e27625" points="1.9,1.5 14.3,10.9 12.1,5.3"/>'
+'<polygon fill="#e27625" points="25.6,22.1 22.3,27.2 29.4,29.2 31.4,22.2"/><polygon fill="#e27625" points="0.6,22.2 2.6,29.2 9.7,27.2 6.4,22.1"/>'
+'<polygon fill="#e27625" points="9.3,14.5 7.4,17.4 14.4,17.7 14.2,10.2"/><polygon fill="#e27625" points="22.7,14.5 17.7,10.1 17.6,17.7 24.6,17.4"/>'
+'<polygon fill="#e27625" points="9.7,27.2 13.9,25.1 10.3,22.3"/><polygon fill="#e27625" points="18.1,25.1 22.3,27.2 21.7,22.3"/>'
+'<polygon fill="#d5bfb2" points="22.3,27.2 18.1,25.1 18.4,27.8 18.4,28.9"/><polygon fill="#d5bfb2" points="9.7,27.2 13.6,28.9 13.6,27.8 13.9,25.1"/>'
+'<polygon fill="#233447" points="13.7,20.5 10.2,19.5 12.7,18.4"/><polygon fill="#233447" points="18.3,20.5 19.3,18.4 21.8,19.5"/>'
+'<polygon fill="#cc6228" points="9.7,27.2 10.3,22.1 6.4,22.2"/><polygon fill="#cc6228" points="21.7,22.1 22.3,27.2 25.6,22.2"/>'
+'<polygon fill="#cc6228" points="24.6,17.4 17.6,17.7 18.3,20.5 19.3,18.4 21.8,19.5"/><polygon fill="#cc6228" points="10.2,19.5 12.7,18.4 13.7,20.5 14.4,17.7 7.4,17.4"/>'
+'<polygon fill="#e27525" points="7.4,17.4 10.3,23.4 10.2,19.5"/><polygon fill="#e27525" points="21.8,19.5 21.7,23.4 24.6,17.4"/>'
+'<polygon fill="#e27525" points="14.4,17.7 13.7,20.5 14.6,25.1 14.8,19"/><polygon fill="#e27525" points="17.6,17.7 17.2,19 17.4,25.1 18.3,20.5"/>'
+'<polygon fill="#f5841f" points="18.3,20.5 17.4,25.1 18.1,25.1 21.7,22.3 21.8,19.5"/><polygon fill="#f5841f" points="10.2,19.5 10.3,22.3 13.9,25.1 14.6,25.1 13.7,20.5"/>'
+'<polygon fill="#c0ac9d" points="18.4,28.9 18.4,27.8 18.1,27.5 13.9,27.5 13.6,27.8 13.6,28.9 9.7,27.2 11.1,28.3 13.9,30.3 18.1,30.3 20.9,28.3 22.3,27.2"/>'
+'<polygon fill="#161616" points="18.1,25.1 17.4,25.1 14.6,25.1 13.9,25.1 13.6,27.8 13.9,27.5 18.1,27.5 18.4,27.8"/>'
+'<polygon fill="#763e1a" points="30.6,11.4 31.7,6.3 30.1,1.5 18.1,10.4 22.7,14.5 29.2,16.4 30.7,14.7 30.1,14.3 31.1,13.4 30.3,12.8 31.3,12"/>'
+'<polygon fill="#763e1a" points="0.3,6.3 1.4,11.4 0.7,12 1.7,12.8 0.9,13.4 1.9,14.3 1.3,14.7 2.8,16.4 9.3,14.5 13.9,10.4 1.9,1.5"/>'
+'<polygon fill="#f5841f" points="29.2,16.4 22.7,14.5 24.6,17.4 21.7,23.4 25.6,23.3 31.4,23.3"/><polygon fill="#f5841f" points="9.3,14.5 2.8,16.4 0.6,23.3 6.4,23.3 10.3,23.4 7.4,17.4"/>'
+'<polygon fill="#f5841f" points="17.6,17.7 18.1,10.4 19.9,5.3 12.1,5.3 14.2,10.4 14.4,17.7 14.6,19 14.6,25.1 17.4,25.1 17.4,19"/></svg>';
var LX_GENWALLET='<svg class="lx-wico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>';
function lxEvmWalletName(){ var e=window.ethereum; if(!e) return "MetaMask";
  if(e.isRabby) return "Rabby"; if(e.isCoinbaseWallet) return "Coinbase Wallet"; if(e.isBraveWallet) return "Brave Wallet";
  if(e.isTrust||e.isTrustWallet) return "Trust Wallet"; if(e.isOkxWallet||e.isOKExWallet) return "OKX Wallet";
  if(e.isPhantom) return "Phantom"; if(e.isMetaMask) return "MetaMask"; return "your wallet"; }
function lxEvmWalletIcon(){ return lxEvmWalletName()==="MetaMask"?LX_FOX:LX_GENWALLET; }

function lxBrVidBtn(){
  return LX_CLAIMVID
    ? '<a class="lx-brvid-top" target="_blank" rel="noopener" href="'+lxBrEsc(LX_CLAIMVID)+'">'
      +'<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>'
      +'Watch tutorial</a>'
    : ''; }
// Deliberately NOT "How to claim your USDC" — the same panel will carry XRPL transfers over Wanchain,
// where the asset landing on the destination is not USDC.
function lxBrHowTo(){
  return '<details class="lx-brhow"><summary>How to claim</summary>'
  +'<ol class="lx-brhow-l">'
  +'<li><b>Fund the destination address with a little gas.</b> ETH on Ethereum and the L2s, POL on Polygon, AVAX on Avalanche. Cents are enough anywhere but Ethereum.</li>'
  +'<li><b>Wait for Circle to attest</b> \u2014 a minute or two. Press Check status if it is still waiting.</li>'
  +'<li><b>Press Claim and approve one transaction.</b> Your wallet is switched to the right network and the claim is checked before anything is signed.</li>'
  +'<li><b>Or do it yourself:</b> Copy redeem data, then call <span class="mono">receiveMessage</span> on <span class="mono">'+LX_MT+'</span> from that chain\u2019s explorer.</li>'
  +'</ol>'
  +'<p class="lx-brhow-p">Anyone can submit the claim \u2014 it always pays out to the address in the attestation, so a failed attempt costs nothing but gas.</p>'
  +'</details>'; }

var LX_STELLAR_SVG='<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#000"/><path d="M23.13 9.292l-2.4 1.224-11.598 5.907A6.909 6.909 0 0119.35 9.498l1.374-.7.205-.105a8.439 8.439 0 00-13.371 7.472 1.535 1.535 0 01-.834 1.484l-.725.37v1.724l2.134-1.088.691-.353.681-.347 12.226-6.23 1.374-.699 2.84-1.447V7.856zm2.816 2.012L10.201 19.32l-1.374.7L6 21.463v1.723l2.808-1.43 2.401-1.224 11.61-5.916a6.909 6.909 0 01-10.229 6.93l-.085.045-1.49.76a8.439 8.439 0 0013.372-7.475 1.536 1.536 0 01.833-1.483l.726-.37v-1.718z" fill="#FFF"/></svg>';
// USDC on the source chain, USDC on the destination chain — each token disc badged with its network.
// Stellar is inlined because there is no assets/networks/stellar.png, and scraping the wizard's chip would
// break the moment that markup moves.
function lxBrNetImg(dom){ var n=LX_NETMAP[lxBrDomName(dom)]; return n?('<img src="/assets/networks/'+n+'.png" alt="">'):''; }
// key: the asset the icon shows (defaults to USDC). The SOURCE side shows what the user actually sent -- BLND, XLM,
// LUMOS... -- not the USDC it was swapped into; the destination side is always the USDC being claimed.
function lxBrPairIco(kind,dom,key){
  var badge=(kind==="src")?LX_STELLAR_SVG:lxBrNetImg(dom);
  var name=(kind==="src")?"Stellar":lxBrDomName(dom);
  key=key||"USDC"; var logo=((LX_ASSETS[key]||{}).logo)||"assets/tokens/usdc.png";
  return '<span class="lx-brp-ico" title="'+lxBrEsc(key)+' on '+lxBrEsc(name)+'"><img src="'+logo+'" alt="'+lxBrEsc(key)+'"><i>'+badge+'</i></span>'; }
// What a pending transfer started as. Stored on the record from 2026-09-19; older records are matched by burn hash
// against this browser's own transaction history, which always carried it.
function lxBrPendSrc(r){ if(r&&r.srcKey) return {k:r.srcKey,a:r.srcAmount};
  try{ var t=JSON.parse(localStorage.getItem("lumos.cctp.txs")||"[]").filter(function(x){ return x&&x.hash===r.burnHash; })[0];
    if(t&&t.srcKey) return {k:t.srcKey,a:t.srcAmount}; }catch(_){}
  return {k:"USDC",a:r.netUsdc}; }

var LX_BR_COPY_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
  +'stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2">'
  +'</rect><path d="M5 15V5a2 2 0 0 1 2-2h10"></path></svg>';
if(!window.__lxBrCopyWired){ window.__lxBrCopyWired=1;
  document.addEventListener("click",function(e){
    var b=e.target&&e.target.closest?e.target.closest("[data-copyh]"):null; if(!b) return;
    e.preventDefault(); e.stopPropagation();
    var h=b.getAttribute("data-copyh")||"";
    function ok(){ try{ lxBrToast("Transaction hash copied \u2014 keep it to claim later"); }catch(_){} }
    try{
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(h).then(ok).catch(fallback);
      } else fallback();
    }catch(_){ fallback(); }
    function fallback(){ try{ var t=document.createElement("textarea"); t.value=h;
      t.setAttribute("readonly",""); t.style.position="fixed"; t.style.opacity="0";
      document.body.appendChild(t); t.select(); document.execCommand("copy");
      document.body.removeChild(t); ok(); }catch(_e){} }
  },true);
}
// ---- opening the MetaMask APP on a phone ------------------------------------------------------------------------
// metamask.app.link is a "universal link": the OS is supposed to hand it to the app, but tapped from inside a browser
// Android and iOS often just load it as a web page -- the MetaMask website, not the app. The app's own entry points:
//   Android  intent://dapp/<page>#Intent;scheme=metamask;package=io.metamask;...  -> the app, or the Play Store
//            listing if it is not installed (browser_fallback_url = the universal link)
//   iOS      metamask://dapp/<page>  -> the app; if nothing took it within 1.5s (not installed), the universal link
// <page> is this page without its scheme, which is what MetaMask's dapp browser expects.
function lxIsAndroid(){ try{ return /Android/i.test(navigator.userAgent||""); }catch(_){ return false; } }
function lxMmLink(page){
  var uni="https://metamask.app.link/dapp/"+page;
  if(lxIsAndroid()) return "intent://dapp/"+page+"#Intent;scheme=metamask;package=io.metamask;S.browser_fallback_url="+encodeURIComponent(uni)+";end";
  return "metamask://dapp/"+page; }
// NO FALLBACK TIMER. iOS Safari answers metamask:// with its own "Open this page in MetaMask?" sheet; while that sheet
// is up the page is still visible, so a 1.5s "did we leave?" timer fired and sent the reader to the universal link,
// which forwards to the App Store -- with MetaMask installed (RAZA 2026-09-19, iPhone: "it opens it in Apple store").
// The scheme link alone is right: installed -> Safari asks once -> the app opens on this page.
function lxMmOpen(page){ location.href=lxMmLink(page); }
// Coinbase Wallet, same reasoning: its own scheme (cbwallet://dapp?url=) rather than the go.cb-w.com universal link,
// which a browser tap can equally resolve to a web page. Android goes through an intent to the app (org.toshi).
function lxCbLink(full){
  var uni="https://go.cb-w.com/dapp?cb_url="+encodeURIComponent(full);
  if(lxIsAndroid()) return "intent://dapp?url="+encodeURIComponent(full)+"#Intent;scheme=cbwallet;package=org.toshi;S.browser_fallback_url="+encodeURIComponent(uni)+";end";
  return "cbwallet://dapp?url="+encodeURIComponent(full); }
// ---- a claim handed over by link: ?claim=<burn hash> --------------------------------------------------------
// Opened inside a wallet app's browser (see the phone hand-off in the claim handler), this page has none of the
// original browser's storage. Everything a claim needs comes from Circle's record of the burn, keyed by its hash --
// message, attestation, destination, amount, recipient -- so the transfer is rebuilt here and shown in the claims
// panel. The recipient is fixed inside Circle's signed message: a link cannot redirect anyone's USDC.
function lxBrClaimFromLink(){ try{
  var m=/[?&]claim=([0-9a-fA-F]{64})(?![0-9a-fA-F])/.exec(location.search||""); if(!m) return;
  var hash=m[1].toLowerCase();
  // The ?claim= stays in the address bar: in a wallet app's browser there is no Stellar wallet, so it is the only thing
  // that lets this page past the sign-in gate on a reload. Re-importing is harmless -- records are upserted by burn
  // hash, and one already claimed here is remembered (lxBrIsDone) and skipped.
  if(lxBrIsDone(hash)) return;
  lxBrPeekAttest(hash).then(function(att){
    if(!att){ lxBrToast("That transfer isn\u2019t ready to claim yet \u2014 Circle has not approved it."); return; }
    var dm=att.decodedMessage||{}, body=dm.decodedMessageBody||{}, mr=String(body.mintRecipient||"");
    var rec={ burnHash:hash, message:att.message, attestation:att.attestation, decodedMessage:dm,
      destDomain:parseInt(dm.destinationDomain,10), netUsdc:(+body.amount||0)/1e6,
      recipient:mr.length>=42?("0x"+mr.slice(-40)):mr, status:"attested", ts:Date.now() };
    lxBrSavePending(rec); lxBrRenderPending(); setTimeout(lxBrGoPending,300);
  });
}catch(_){} }
setTimeout(lxBrClaimFromLink,1200);
function lxBrRenderPending(){ try{
  var host=lxBrPendHost(); if(!host) return false;
  var p=host.el, list=lxBrPendVisible(lxBrListPending());
  // keep the tab label's count honest whether or not there is anything to show
  if(host.tabbed){
    var tabBtn=host.wrap.querySelector('.lx-brtab[data-brtab="pend"]');
    if(tabBtn){
      var nEl=tabBtn.querySelector(".lx-brtab-n"); if(nEl) nEl.textContent=list.length;
      tabBtn.hidden=!list.length;
      // nothing left to claim while sitting on that tab — fall back to the transactions view
      if(!list.length&&tabBtn.classList.contains("active")){
        var txBtn=host.wrap.querySelector('.lx-brtab[data-brtab="tx"]'), tbl=host.wrap.querySelector(".br-table");
        tabBtn.classList.remove("active"); if(txBtn) txBtn.classList.add("active");
        if(tbl) tbl.style.display=""; p.style.display="none";
      }
    }
  }
  if(!list.length){ if(!host.tabbed) p.style.display="none"; p.innerHTML=""; return true; }
  var rows=list.map(function(r){
    var ready=!!(r.status==="attested"&&r.message&&r.attestation);
    var evm=!!LX_EVM[r.destDomain];
    return '<div class="lx-brp-row" data-h="'+lxBrEsc(r.burnHash)+'">'
    // amount left, provenance in the middle, actions hard right — the row reads across the full width the
    // way the transactions table above it does, instead of clumping everything against the left edge
    // "72.50 BLND -> 0.41 USDC on Base": what was sent, then what is being claimed and where (was "0.41 USDC -> Base")
    +(function(){ var ps=lxBrPendSrc(r), same=(ps.k==="USDC");
      return '<div class="lx-brp-main"><div class="lx-brp-amt">'+lxBrPairIco("src",r.destDomain,ps.k)+'<span>'+lxBrEsc(same?lxBrAmt(r.netUsdc):lxBrAmt(parseFloat(ps.a)||0))+' '+lxBrEsc(ps.k)+'</span><span class="lx-brp-ar">→</span>'
        +lxBrPairIco("dst",r.destDomain)+'<span>'+(same?'':lxBrEsc(lxBrAmt(r.netUsdc))+' USDC on ')+lxBrEsc(lxBrDomName(r.destDomain))+'</span></div></div>'; })()
    +'<div class="lx-brp-meta"><div class="lx-brp-sub">Burned '+lxBrEsc(lxBrRelTime(r.ts))+' · <a class="mono" target="_blank" rel="noopener" href="https://stellar.expert/explorer/public/tx/'+lxBrEsc(r.burnHash)+'">'+lxBrEsc(lxBrShortH(r.burnHash))+'</a>'
    +'<button type="button" class="lx-brp-copyh" data-copyh="'+lxBrEsc(r.burnHash)+'" '
    +'title="Copy transaction hash" aria-label="Copy transaction hash">'+LX_BR_COPY_SVG+'</button>'
    // the platform fee is LumosCore's problem, not the user's: they can do nothing about it, it does not
    // affect what they receive, and it is already carried to their next bridge. It stays recorded on the
    // record, it just no longer sits in their way.
    +'</div></div>'
    // no "Ready to claim" chip — the Claim button next to it already says exactly that. The waiting state
    // is the one worth a chip, because then there is nothing else on the row explaining the delay.
    +(ready?'':'<span class="lx-brp-chip wait">Awaiting Circle attestation</span>')
    // ON A PHONE WITH NO WALLET IN THE PAGE (RAZA 2026-09-19): the claim happens inside a wallet app, so the row says
    // where -- "Claim on <network>" as its heading -- and offers the three ways to do it as one even row:
    // MetaMask | Coinbase Wallet | Copy redeem data. Each app button opens this page in that app with ?claim=<hash>,
    // which rebuilds the claim there from Circle's record (lxBrClaimFromLink).
    // A claim already submitted: say so, link it, and offer nothing to press twice. The chain sweep removes the row.
    +(r.claimTx?('<div class="lx-brp-sent"><span class="lx-brp-spin"></span><span>Claim submitted \u2014 confirming on '+lxBrEsc((LX_EVM[r.destDomain]||{}).n||lxBrDomName(r.destDomain))+'\u2026 '
      +((LX_EVM[r.destDomain]||{}).exp?'<a target="_blank" rel="noopener" href="'+lxBrEsc(LX_EVM[r.destDomain].exp+"/tx/"+r.claimTx)+'">View transaction</a>':'')+'</span></div>'):(
    ((ready&&evm&&!lxEvmProv()&&lxIsPhoneUA())?(function(){
      var page=location.host+location.pathname+"?claim="+encodeURIComponent(r.burnHash);
      var cbu=lxCbLink(location.protocol+"//"+page);
      return '<div class="lx-brp-claim"><div class="lx-brp-claimh">Claim on '+lxBrEsc(LX_EVM[r.destDomain].n)+'</div>'
        +'<div class="lx-brp-claim3">'
        +'<a class="lx-brp-hb3 lx-brp-mm" href="'+lxMmLink(page)+'" data-page="'+lxBrEsc(page)+'"><span class="lx-brp-hi">'+lxEvmWalletIcon()+'</span><span>MetaMask</span></a>'
        +'<a class="lx-brp-hb3 lx-brp-cb" href="'+cbu+'"><span class="lx-brp-hi"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#0052FF"/><rect x="8.6" y="8.6" width="6.8" height="6.8" rx="1.3" fill="#fff"/></svg></span><span>Coinbase Wallet</span></a>'
        +'<button type="button" class="lx-brp-b lx-brp-hb3" data-act="copy"><span class="lx-brp-hi">'+LX_BR_COPY_SVG+'</span><span>Copy redeem data</span></button>'
        +'</div></div>'; })():(
    '<div class="lx-brp-btns">'
    +(ready?'':'<button type="button" class="lx-brp-b" data-act="check">Check status</button>')
    +((ready&&evm)?'<button type="button" class="lx-brp-b primary lx-hasico" data-act="mint" title="Opens '+lxBrEsc(lxEvmWalletName())+' on '+lxBrEsc(LX_EVM[r.destDomain].n)+'"><span class="lx-wbadge">'+lxEvmWalletIcon()+'</span>Claim on '+lxBrEsc(LX_EVM[r.destDomain].n)+'</button>':'')
    +'<button type="button" class="lx-brp-b" data-act="copy">Copy redeem data</button>'
    +'</div>'))))   // closes: non-phone branch, phone ?: expr, the claimTx ":(" branch, the claimTx "+(" wrapper
    // Solana and Sui have no "connect wallet and press a button" route — not here, and not on their block
    // explorers either, which offer no way to submit an arbitrary instruction. Saying "use Copy redeem
    // data" as though that were equivalent would be misleading, so say what it actually takes.
    +(evm?'':'<div class="lx-brp-relay warn">Claiming on '+lxBrEsc(lxBrDomName(r.destDomain))+' cannot be done from a wallet or a block explorer \u2014 it needs Circle\u2019s CLI or SDK. Copy redeem data gives you everything the call requires. Your USDC is safe with Circle until then.</div>')
    +'<div class="lx-brp-msg" style="display:none"></div>'
    +'</div>'; }).join("");
  // In tab mode the tab IS the heading — a second "Awaiting redemption" title under it would just repeat
  // itself. The standalone mobile panel still needs one.
  p.innerHTML=(host.tabbed?'':'<div class="lx-brp-head"><h2>Awaiting redemption</h2><span class="lx-brp-n">'+list.length+'</span>'+lxBrVidBtn()+'</div>')
    +'<div class="lx-brp-intro"><p class="lx-brp-note">CCTP burns your USDC on Stellar and Circle holds it until the mint is submitted on the destination chain. That last step is yours to make: press Claim, approve it in your EVM wallet, and the USDC appears. You need a little gas on the destination chain to do it. Nothing here expires \u2014 an unclaimed transfer waits indefinitely. <b>Keep the transaction hash on each row.</b> Circle can rebuild everything a claim needs from it, so the hash on its own is enough to finish a transfer from any browser or device \u2014 including after you clear this one.</p>'
    +(host.tabbed?lxBrVidBtn():'')+'</div>'
    +lxBrHowTo()
    +rows;
  if(!host.tabbed) p.style.display="";
  return true;
}catch(_){ return false; } }
document.addEventListener("click",function(e){
  // the phone row's wallet-app buttons are plain links to the app's own scheme: let the browser follow the tap as-is
  // (a real user tap on a scheme link is what iOS/Android hand to the app -- intercepting it only makes that worse)
  if(e.target&&e.target.closest&&e.target.closest(".lx-brp-mm,.lx-brp-cb")) return;
  var b=e.target&&e.target.closest?e.target.closest(".lx-brp-b"):null; if(!b) return;
  var row=b.closest(".lx-brp-row"); if(!row) return;
  var hash=row.getAttribute("data-h"), act=b.getAttribute("data-act");
  var rec=lxBrListPending().filter(function(x){return x.burnHash===hash;})[0]; if(!rec) return;
  e.preventDefault(); e.stopPropagation();
  // the button used to relabel itself to "Copied ✓"; the toast is the site's established confirmation, and
  // two acknowledgements for one action is one too many
  if(act==="copy"){ var txt=lxBrRedeemJSON(rec);
    try{ navigator.clipboard.writeText(txt).then(function(){ lxBrToast("Redeem data copied"); },function(){ window.prompt("Redeem data",txt); }); }
    catch(_){ window.prompt("Redeem data",txt); } return; }
  if(act==="check"){ var lbl=b.textContent; b.disabled=true; b.textContent="Checking\u2026";
    lxBrPeekAttest(hash).then(function(att){
      if(att){ rec.message=att.message; rec.attestation=att.attestation; rec.decodedMessage=att.decodedMessage; rec.status="attested"; lxBrSavePending(rec); lxBrRenderPending(); }
      else { b.disabled=false; b.textContent="Not ready yet"; setTimeout(function(){ b.textContent=lbl; },2200); } }); return; }
  if(act==="mint"){
    var msg=row.querySelector(".lx-brp-msg"), lbl=b.textContent;
    function say(t,err){ if(!msg)return; msg.textContent=t; msg.style.display=t?"":"none"; msg.className="lx-brp-msg"+(err?" err":""); }
    // A PHONE HAS NO WALLET EXTENSION, so there is nothing here to sign with (RAZA 2026-09-19: MetaMask "not
    // detected" on his phone). Hand the claim to the wallet app instead: open THIS page inside the app's browser with
    // the burn hash in the link, and lxBrClaimFromLink rebuilds the claim there from Circle's record. Nothing from
    // this browser's storage has to travel.
    if(!lxEvmProv()&&lxIsPhoneUA()){
      var here=location.host+location.pathname, q="?claim="+encodeURIComponent(hash);
      var cb="https://go.cb-w.com/dapp?cb_url="+encodeURIComponent(location.protocol+"//"+here+q);
      if(msg){ msg.className="lx-brp-msg"; msg.style.display="";
        msg.innerHTML='Opening MetaMask with this transfer ready to claim\u2026 If it does not open:'
          // lx-brp-hb, NOT lx-brp-b: the panel's click handler cancels every .lx-brp-b click, which would kill these links
          +'<div class="lx-brp-hand"><a class="lx-brp-hb lx-mm-open" href="'+lxMmLink(here+q)+'">Open in MetaMask</a><a class="lx-brp-hb" href="'+cb+'">Open in Coinbase Wallet</a></div>';
        var mo=msg.querySelector(".lx-mm-open"); if(mo) mo.addEventListener("click",function(ev){ ev.preventDefault(); lxMmOpen(here+q); }); }
      // The Claim tap itself opens the APP (RAZA 2026-09-19: "it gotta open the MetaMask app ... instead of website").
      lxMmOpen(here+q);
      return; }
    b.disabled=true; b.textContent="Working\u2026";
    lxEvmMint(rec,function(s){ say(s,false); }).then(function(r){
      if(r.ok===false){ b.disabled=false; b.textContent=lbl; say("The claim transaction reverted on "+r.chain+". Your burn is still valid \u2014 nothing was lost; try again.",true); return; }
      if(r.ok===null){ b.disabled=false; b.textContent=lbl; say("Submitted, but "+r.chain+" has not confirmed yet. It stays in this list until it does.",false); return; }
      // minted for real: record it, then drop it from pending
      // NB: do NOT add a Recent-transactions row here. lxBrConfirm already added one when the burn landed —
      // this is the same transfer completing, not a new one. (An earlier version appended a second row and,
      // because it used the wrong field names, rendered it as "undefined undefined".)
      b.textContent="Claimed \u2713";
      if(msg){ msg.className="lx-brp-msg ok"; msg.style.display="";
        msg.innerHTML="Minted on "+lxBrEsc(r.chain)+" \u2014 "+lxBrEsc(lxBrAmt(rec.netUsdc))+" USDC is now in your wallet. "
          +'<a target="_blank" rel="noopener" href="'+lxBrEsc(r.exp+"/tx/"+r.hash)+'">View transaction</a>'; }
      // leave the confirmation on screen for a moment before the row disappears
      setTimeout(function(){ lxBrClearPending(hash); lxBrRenderPending(); },4500);
    }).catch(function(e){
      b.disabled=false; b.textContent=lbl;
      if(lxAlreadyMinted(e)){   // Circle marks the nonce used once minted — the transfer is already complete
        say("Already claimed on this chain \u2014 removing it from the list.",false);
        lxBrClearPending(hash); setTimeout(lxBrRenderPending,900); return; }
      var em=(e&&e.message)||"Could not claim";
      // the reassurance only makes sense for failures DURING a claim — not for "you have no wallet installed"
      var selfContained=/No EVM wallet|No wallet browser|no account authorised|not wired for this chain|no attestation yet/i.test(em);
      say((e&&e.code===4001)?"Cancelled in your wallet \u2014 nothing was sent.":(selfContained?em:em+" \u2014 your burn is untouched, nothing was lost."),true);
    });
    return; }
  if(act==="done"){ if(window.confirm("Remove this transfer from the pending list? Only do this once the USDC has actually been minted on "+lxBrDomName(rec.destDomain)+" \u2014 the burn hash, message and attestation will be deleted from this browser.")){ lxBrClearPending(hash); lxBrRenderPending(); } return; }
},true);
// A transfer claimed anywhere — here, from an explorer, by a script — is finished, and the row should not
// need the user to tell us so. Ask the destination chain instead: an eth_call of the very same
// receiveMessage reverts with "Nonce already used" once the message has been spent. Read-only, no wallet,
// no gas, and verified against a real claimed transfer on Base. This is what replaced "Mark redeemed".
function lxBrAutoClear(){ try{
  lxBrListPending().filter(function(r){ return r.status==="attested"&&r.message&&r.attestation&&LX_EVM[r.destDomain]; })
    .slice(0,6).forEach(function(r){
      var cfg=LX_EVM[r.destDomain];
      lxJrpc(cfg.rpc,"eth_call",[{from:"0x0000000000000000000000000000000000000001",to:LX_MT,data:lxAbiReceive(r.message,r.attestation)},"latest"])
        .then(function(d){
          var em=(d&&d.error&&(d.error.message||""))||"";
          if(em&&lxAlreadyMinted({message:em})){ lxBrClearPending(r.burnHash); lxBrRenderPending(); }
        }).catch(function(){});
    });
}catch(_){} }
window.lxBrAutoClear=lxBrAutoClear;

// A CLAIM FOLLOWS THE WALLET, NOT THE BROWSER (RAZA 2026-09-17: "Awaiting redemption is showing on the smartphone, but
// there is no pending claim on the desktop with the same wallet").
//
// Pending transfers have only ever lived in this browser's localStorage, so a transfer burned on a phone was invisible
// on a desktop holding the same wallet — and a CCTP burn that is never claimed is USDC that exists nowhere. The comment
// on LX_PUBTX above says a shared list has to ship with the page "until there is a server-side feed"; that feed now
// exists and this is the rest of that sentence.
//
// NOTHING NEW IS TRUSTED. /lxapi/bridgetx stores a record only when the ledger agrees the fee and the burn came from the
// same account inside one window, and it reads the amount and destination from Circle rather than from the caller. The
// Recent-transactions table has been drawing on it for weeks. All that changes is that the rows belonging to the
// CONNECTED account are also offered as claims.
//
// Already-claimed transfers do not linger: lxBrResumePending fetches the attestation, then lxBrAutoClear asks the
// destination chain whether the message has been spent (a read-only eth_call, no wallet, no gas) and removes the row.
// A claim cleared in THIS browser is remembered in lumos.cctp.done, so it is never seeded back.
function lxBrSeedFromServer(){
  try{
    var me=(window.lumos&&window.lumos.address)||localStorage.getItem("lumos.address")||"";
    if(!me||window.__lxBrSeeded)return;
    window.__lxBrSeeded=1;
    fetch("/lxapi/bridgetx?limit=100").then(function(r){ return r.ok?r.json():null; }).then(function(d){
      var rows=(d&&d.rows)||[]; if(!rows.length)return;
      var have={}; lxBrListPending().forEach(function(x){ if(x&&x.burnHash)have[x.burnHash]=1; });
      var added=0;
      rows.forEach(function(x){
        if(!x||!x.burnHash||x.from!==me)return;              // only this wallet's own burns
        if(x.route&&x.route!=="CCTP")return;                 // LayerZero / NEAR Intents deliver by themselves: nothing to claim
        if(have[x.burnHash]||lxBrIsDone(x.burnHash))return;
        // status "burned": lxBrResumePending will ask Circle for the attestation on this same pass.
        lxBrSavePending({ burnHash:x.burnHash, destDomain:x.destDomain, amount:x.amount,
                          recipient:x.recipient, ts:+x.ts||Date.now(), status:"burned", fromServer:1 });
        added++;
      });
      if(!added)return;
      try{ lxBrRenderPending(); }catch(_){}
      try{ lxBrResumePending(); }catch(_){}
      try{ lxBrAutoClear(); }catch(_){}
    }).catch(function(){});
  }catch(_){}
}
window.lxBrSeedFromServer=lxBrSeedFromServer;

// a burn whose attestation timed out (or whose tab was closed mid-poll) resolves itself on the next visit
function lxBrResumePending(){ try{
  lxBrListPending().filter(function(x){ return !(x.status==="attested"&&x.attestation); }).slice(0,6).forEach(function(r){
    lxBrPeekAttest(r.burnHash).then(function(att){ if(!att)return;
      r.message=att.message; r.attestation=att.attestation; r.decodedMessage=att.decodedMessage; r.status="attested";
      lxBrSavePending(r);
      // A row that has just become checkable is checked before it is drawn as claimable: a transfer seeded from the
      // shared record may have been claimed elsewhere long ago, and rendering first is what made the count flash.
      lxBrSweepClaimed(true); lxBrRenderPending(); }); });
}catch(_){} }
window.lxBrRenderPending=lxBrRenderPending; window.lxBrPeekAttest=lxBrPeekAttest;

// restore persisted bridge transactions into the Recent transactions table on load
(function(){ function fixFrom(){ try{ var rows=document.querySelectorAll('.br-table tbody tr'); for(var i=0;i<rows.length;i++){ var tds=rows[i].querySelectorAll('td'); var ft=tds[1]; if(!ft)continue; var am=ft.querySelector('.am'), ic=ft.querySelector('.br-ic'); if(!am||!ic||ic.__lxfrom)continue; var t=am.textContent||''; var img=/USDC/i.test(t)?'assets/tokens/usdc.png':(/XLM/i.test(t)?'assets/tokens/xlm.png':''); if(!img)continue; ic.__lxfrom=1; ic.innerHTML='<img class="lx-netimg" src="'+img+'" style="width:100%;height:100%;object-fit:cover;display:block" alt="">'; } }catch(_){} }
 // the table half is desktop-only; the pending-claims half has to run wherever the bridge card exists
 function pass(){ var tb=document.querySelector('.br-table tbody'), card=document.querySelector('.br-card')||document.querySelector('.br-wizard');
  if(!tb&&!card) return false;
  lxBrRenderMobileTxs();   // mobile has no tb, so this must sit OUTSIDE the if(tb) gate below
  if(tb){ lxBrTableCols(); lxBrRestoreTxs(); lxBrTxApply(); fixFrom(); setTimeout(fixFrom,500); setTimeout(fixFrom,1200); var _t=document.querySelector('.br-table'); if(_t)_t.classList.add('lx-tbl-ready'); }
  // Seeded BEFORE the three passes below, so a transfer burned on another device is rendered, attested and
  // auto-cleared on this same load rather than only on the next one.
  lxBrSeedFromServer();
  lxBrRenderPending(); lxBrResumePending(); lxBrAutoClear(); return true; }
 if(!pass()){ var n=0,iv=setInterval(function(){ n++; if(pass()||n>40) clearInterval(iv); },120); } })();
})();