// Cross-Chain via Circle CCTP (TESTNET). Source = Stellar (domain 27), asset = USDC.
// Phase 1: config + copy + destination filter. Phase 2: real burn engine.
// FLOW (validated on testnet): approve(USDC -> TokenMessenger) then deposit_for_burn.
//   deposit_for_burn(caller, amount i128 @7dp, dest_domain u32, mint_recipient 32B, USDC Address,
//   dest_caller 32B(0), max_fee i128(0), min_finality u32(2000)). Freighter (testnet) signs both.
// Freighter access: window.freighterApi if present, else dynamic-import @stellar/freighter-api@6 (same as wallet lxSign).
// Layered ON TOP of the finalized bridge + _bridge*.js transforms (never edits them). See GUARDRAILS.md.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const CCTP_DOMAINS={Ethereum:0,Avalanche:1,Optimism:2,Arbitrum:3,Base:6,Polygon:7,Solana:5,Sui:8,Linea:11,'World Chain':14};
const HIDE=['BNB Chain','Hedera','Mantle','Near','Scroll','Sei','Starknet','zkSync Era'];

const OLD_SUB='Swap assets seamlessly between networks via Wormhole and LayerZero.';
const NEW_SUB='Bridge USDC natively across chains with Circle CCTP — burn on Stellar, mint on the destination.';
const BUGGY_SUB='Bridge USDC natively across chains with Circle CCTP \\u2014 burn on Stellar, mint on the destination.';

const CSS='<style id="lx-cctp-css">'
+HIDE.map(function(n){return '.brd-opt[data-net="'+n+'"]{display:none!important}';}).join('')
// real network logos (replace the letter-mark badges) — logos only, no layout change
+'.brd-opt .brd-ic img.lx-netimg,.br-netchip .br-ic img.lx-netimg{width:100%;height:100%;object-fit:cover;border-radius:50%;display:block}'
// all logos across the 3 steps -> uniform 26px
+'.br-step .br-ic,.br-step .brd-ic,.br-step .lx-assetic,.br-step .lx-netic,.br-rv-leg .v .ic,.br-rv-leg .v .lx-rvnet,.br-asschip .br-ic{width:26px!important;height:26px!important;min-width:26px!important;flex:0 0 26px!important;border-radius:50%;overflow:hidden}'
+'.br-step .br-ic img,.br-step .brd-ic img,.br-rv-leg .v .ic img,.br-asschip .br-ic img,.br-step .lx-netimg,.br-rv-leg .v .ic>span,.br-step .br-ic>span{width:100%!important;height:100%!important;object-fit:cover;display:block}'
// destination address: single refined focus state (removes the nested double-orange)
+'.br-wallet.brw-in .br-addr-in{outline:0!important;border:0!important;box-shadow:none!important;background:transparent!important}'
+'.br-wallet.brw-in{transition:border-color .15s ease,box-shadow .15s ease}'
+'.br-wallet.brw-in:focus-within{border-color:rgba(234,106,44,.55)!important;box-shadow:0 0 0 3px rgba(234,106,44,.12)!important}'
// source: balance moved beneath the amount (right-aligned), clean spacing
+'.br-side .lx-balrow{display:flex;justify-content:flex-end;align-items:center;margin-top:10px}'
+'.br-side .lx-balrow .bal{display:inline-flex;align-items:center;gap:8px;font-size:12px;white-space:nowrap}'
+'.br-side .br-amtrow{align-items:center}'
// Circle CCTP fee chip in review — match the theme (brand-orange tint, same pill shape as the LUMOS chip)
+'.br-rv-list .lx-cchip{display:inline-block;margin-left:8px;font-size:11px;padding:2px 8px;border-radius:20px;background:rgba(234,106,44,.1);color:#bf571f;border:.8px solid rgba(234,106,44,.24);vertical-align:middle}'
// recent-transactions row icons -> 26px too (some mock rows render at 30px)
+'.br-txwrap .br-table .br-asschip .br-ic,.br-txwrap .br-table .br-asschip .br-ic.lx-netic{width:26px!important;height:26px!important;min-width:26px!important;flex:0 0 26px!important;border-radius:50%;overflow:hidden}'
+'.br-txwrap .br-table .br-asschip .br-ic img{width:100%!important;height:100%!important;object-fit:cover;display:block}'
// step-1 flash fix: the design paints the recent-tx table in its original column order, then JS
// reorders columns + injects a "Bridge Used" column ~300ms later. Hold the table hidden until that
// restructure is done, then fade in (CSS animation is a failsafe reveal if the JS never runs).
+'.br-table{opacity:0;animation:lxtblrev 0s linear 2s forwards}'
+'@keyframes lxtblrev{to{opacity:1}}'
+'.br-table.lx-tbl-ready{opacity:1!important;animation:none;transition:opacity .28s ease}'
// clickable recent-tx addresses -> explorer wallet pages
+'.br-table .lx-txaddr{color:inherit;text-decoration:none;border-bottom:1px dashed rgba(120,130,150,.45);transition:color .12s,border-color .12s}'
+'.br-table .lx-txaddr:hover{color:#ea6a2c;border-bottom-color:#ea6a2c}'
// editable amount input (replaces the contenteditable div — guaranteed typeable)
+'.br-amt .v .lx-amtin{width:100%;min-width:64px;box-sizing:border-box;border:0;outline:0;background:transparent;font:inherit;color:inherit;text-align:right;padding:0;margin:0;cursor:text}'
+'.br-amt .v{cursor:text}'
// widen the amount (right) column so You Swap / You Get aren\\x27t cramped, and add right-edge breathing room
+'@media(min-width:621px){.br-step[data-step="2"] .br-io>.br-side{grid-template-columns:minmax(0,320fr) minmax(0,310fr)!important}}'
// step 2: wider card column (fill more width, less tall) + equal-height source/destination cards (symmetry)
+'@media(min-width:621px){.br-step[data-step="2"] .br-io{max-width:860px!important;margin-left:auto!important;margin-right:auto!important;align-items:stretch!important}'
+'.br-step[data-step="2"] .br-io>.br-side,.br-step[data-step="2"] .br-io>.br-swapmid{max-width:none!important;width:auto!important}}'
+'.br-step[data-step="2"] .br-io>.br-side{min-height:180px;align-content:center}'
// inset the amount content from the card edge via the grid-cell rows (NOT .br-amt itself — padding there overflowed the flex row)
+'.br-step[data-step="2"] .br-amtrow,.br-step[data-step="2"] .br-assetrow{padding-right:16px}'
+'.br-step[data-step="2"] .br-amt{min-width:0;padding-right:0!important}'
+'.br-step[data-step="2"] .br-side>.hd{padding-right:16px}'
+'.br-side .lx-balrow{font-size:11px}'
// Review button disabled until valid; invalid destination address highlighted
+'.br-actions .br-next.lx-disabled,.br-actions .br-next:disabled{opacity:.45;cursor:not-allowed;pointer-events:none;filter:grayscale(.15)}'
+'.br-wallet.lx-invalid{border-color:#e5484d!important;box-shadow:0 0 0 3px rgba(229,72,77,.13)!important}'
// CCTP verified badge in recent transactions
+'.br-table .lx-vbadge{display:inline-flex;align-items:center;gap:3px;font-size:10.5px;font-weight:600;padding:2px 7px;border-radius:20px;background:rgba(31,169,104,.12);color:#0f9257;border:.8px solid rgba(31,169,104,.28);vertical-align:middle;white-space:nowrap}'
// Bridge Used column
+'.br-table .lx-buse-dash{opacity:.4}'
+'.br-table .lx-buse-cctp{font-weight:600;color:var(--text,#0e0e10)}'
// MAX button in the You Swap balance row
+'.br-side .lx-balrow .max.lx-maxbtn{background:var(--accent-pale,rgba(234,106,44,.1))!important;background-image:none!important;color:var(--accent,#ea6a2c)!important;border:0!important;border-radius:7px;padding:2px 9px!important;width:auto!important;height:auto!important;min-width:0!important;font-size:11px;font-weight:700;line-height:1.7;cursor:pointer;box-shadow:none!important}'
+'.br-side .lx-balrow .max.lx-maxbtn::after{content:"MAX"}'
+'.br-side .lx-balrow .max.lx-maxbtn:hover{filter:brightness(.96)}'
+'.br-side .lx-balrow{gap:10px}'
// Review address rows: network logo beside the address
+'.br-rv-list .r .v.mono{display:inline-flex;align-items:center;gap:7px;justify-content:flex-end}'
+'.br-rv-list .lx-rvaddric{width:20px;height:20px;flex:0 0 20px;border-radius:50%;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;background:var(--surface-2,#f0f1f4)}'
+'.br-rv-list .lx-rvaddric img,.br-rv-list .lx-rvaddric svg{width:100%;height:100%;object-fit:cover;display:block}'
// step-progress loading overlay on Confirm (theme-aware via site CSS vars)
+'.br-card{position:relative}'
+'.lx-prog{display:none;position:absolute;inset:0;z-index:60;background:rgba(8,10,16,.5);backdrop-filter:blur(4px);align-items:center;justify-content:center;border-radius:inherit;padding:20px}'
+'.lx-prog-card{width:min(440px,94%);background:var(--surface,#fff);border:1px solid var(--border,#ececef);border-radius:20px;box-shadow:0 30px 70px rgba(0,0,0,.4);padding:26px 26px 24px;box-sizing:border-box;position:relative;overflow:hidden}'
+'.lx-prog-card::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--accent,#ea6a2c),#ff9a3d)}'
+'.lx-prog-h{font-size:20px;font-weight:750;letter-spacing:-.2px;color:var(--text,#0e0e10);margin-bottom:5px}'
+'.lx-prog-sub{font-size:12.5px;color:var(--text,#0e0e10);opacity:.55;margin-bottom:20px;line-height:1.45}'
+'.lx-prog-list{list-style:none;margin:0;padding:0}'
+'.lx-prog-list li{position:relative;display:flex;align-items:center;gap:13px;padding:9px 10px;border-radius:12px;font-size:14.5px;color:var(--text,#0e0e10);opacity:.5;transition:opacity .25s,background .25s}'
+'.lx-prog-list li.active,.lx-prog-list li.done{opacity:1}'
+'.lx-prog-list li.active{font-weight:650;background:var(--accent-pale,rgba(234,106,44,.1))}'
+'.lx-prog-list li:not(:last-child)::after{content:"";position:absolute;left:23px;top:37px;width:2px;height:calc(100% - 22px);background:var(--border,#e0e2e8);z-index:0}'
+'.lx-prog-list li.done:not(:last-child)::after{background:#1fa968}'
+'.lx-pdot{position:relative;z-index:1;width:26px;height:26px;flex:0 0 26px;border-radius:50%;border:2px solid var(--border,#e0e2e8);background:var(--surface,#fff);display:inline-flex;align-items:center;justify-content:center;transition:border-color .2s,background .2s}'
+'.lx-prog-list li.active .lx-pdot{border-color:var(--accent,#ea6a2c)}'
+'.lx-prog-list li.done .lx-pdot{background:#1fa968;border-color:#1fa968}'
+'.lx-spin{width:12px;height:12px;border-radius:50%;border:2px solid var(--accent,#ea6a2c);border-top-color:transparent;animation:lxspin .7s linear infinite;display:none}'
+'.lx-prog-list li.active .lx-spin{display:block}'
+'.lx-tick{color:#fff;font-size:13px;font-weight:700;line-height:1;display:none}'
+'.lx-prog-list li.done .lx-tick{display:block}'
+'@keyframes lxspin{to{transform:rotate(360deg)}}'
+'.lx-prog-msg{margin-top:18px;font-size:12.5px;color:var(--text,#0e0e10);opacity:.65;min-height:18px}'
+'.lx-prog-x{margin-top:16px;width:100%;padding:13px;border:0;border-radius:13px;background:linear-gradient(135deg,var(--accent,#ea6a2c),#ff8a3d);color:#fff;font:inherit;font-size:15px;font-weight:650;cursor:pointer;box-shadow:0 8px 20px rgba(234,106,44,.32)}'
+'.lx-prog-x:hover{filter:brightness(1.05)}'
// ---- Awaiting redemption panel ----
+'.lx-brpend{margin:0 0 26px;padding:20px 22px;border:1px solid var(--border,#e6e6ea);border-left:3px solid var(--accent,#ea6a2c);border-radius:16px;background:var(--surface,#fff)}'
+'.lx-brp-head{display:flex;align-items:center;gap:10px;margin-bottom:6px}'
+'.lx-brp-head h2{margin:0;font-size:17px;font-weight:700;color:var(--text,#0e0e10)}'
+'.lx-brp-n{min-width:22px;height:22px;padding:0 7px;border-radius:11px;background:var(--accent,#ea6a2c);color:#fff;font:700 12px/22px inherit;text-align:center}'
+'.lx-brp-note{margin:0 0 16px;font-size:12.8px;line-height:1.55;color:var(--text-soft,#6b6b76);max-width:72ch}'
+'.lx-brp-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:13px 0;border-top:1px solid var(--border,#e6e6ea)}'
+'.lx-brp-main{flex:1 1 240px;min-width:0}'
+'.lx-brp-amt{font-size:14.5px;font-weight:650;color:var(--text,#0e0e10)}'
+'.lx-brp-ar{opacity:.45;margin:0 3px}'
+'.lx-brp-sub{margin-top:3px;font-size:12px;color:var(--text-soft,#6b6b76)}'
+'.lx-brp-sub a{color:var(--text-soft,#6b6b76);text-decoration:underline;text-underline-offset:2px}'
+'.lx-brp-sub a:hover{color:var(--accent,#ea6a2c)}'
+'.lx-brp-warn{color:#c9791f}'
+'.lx-brp-chip{flex:0 0 auto;padding:5px 11px;border-radius:20px;font-size:11.5px;font-weight:650;white-space:nowrap}'
+'.lx-brp-chip.wait{background:rgba(201,121,31,.12);color:#c9791f}'
+'.lx-brp-chip.ok{background:rgba(53,192,127,.14);color:#2a9a63}'
+'.lx-brp-btns{display:flex;gap:8px;flex-wrap:wrap}'
+'.lx-brp-b{padding:7px 12px;border-radius:9px;border:1px solid var(--border-strong,#d5d5dd);background:var(--surface-2,#f6f6f8);color:var(--text,#0e0e10);font:650 12.5px/1 inherit;cursor:pointer;transition:.15s}'
+'.lx-brp-b:hover:not(:disabled){border-color:var(--accent,#ea6a2c);color:var(--accent,#ea6a2c)}'
+'.lx-brp-b:disabled{opacity:.55;cursor:default}'
+'.lx-brp-b.ghost{background:transparent;color:var(--text-soft,#6b6b76)}'
+'.lx-brp-b.primary{background:var(--accent,#ea6a2c);border-color:var(--accent,#ea6a2c);color:#fff}'
+'.lx-brp-b.primary:hover:not(:disabled){filter:brightness(1.06);color:#fff}'
+'.lx-bfee .lx-bamt{opacity:.72;font-weight:500;margin-left:2px}'
+'.lx-brp-relay{flex:1 1 100%;margin-top:2px;font-size:12.3px;line-height:1.5;color:var(--text-soft,#6b6b76)}'
+'.lx-brp-relay.ok{color:#2a9a63}'
+'.lx-brp-relay.warn{color:#c9791f}'
+'.lx-brp-relay .mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}'
+'.lx-brp-msg{flex:1 1 100%;margin-top:2px;font-size:12.3px;line-height:1.5;color:var(--text-soft,#6b6b76)}'
+'.lx-brp-msg.err{color:#d1542f}'
+'.lx-brp-msg.ok{color:#2a9a63}'
+'.lx-brp-msg a{color:inherit;text-decoration:underline;text-underline-offset:2px}'
+'</style>';

// ---- Browser engine (no backticks / no ${ } inside the browser code; no literal closing script tag) ----
const BODY=`(function(){
try{ document.title="Bridge USDC across 10 chains with Circle CCTP | LumosCore"; }catch(_){}   /* baked title said "DEX" */
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
  feeCollector:"GAMZFXIJD5E3PNRFCG6VPXCJNUOZAP5BY2P3MU3ZXXUSVM2UY5P6LJKD", feeRate:0.005,
  domains:${JSON.stringify(CCTP_DOMAINS)}, chains:${JSON.stringify(Object.keys(CCTP_DOMAINS))}
}; }catch(_){}

var _sdkP=null;
function lxCctpSdk(){
  if(window.StellarSdk) return Promise.resolve(window.StellarSdk);
  if(_sdkP) return _sdkP;
  _sdkP=new Promise(function(res,rej){
    var s=document.createElement("script");
    s.src="https://cdn.jsdelivr.net/npm/@stellar/stellar-sdk@13.3.0/dist/stellar-sdk.min.js";
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
  if(/allowance|Error\(Contract, ?#9\)/.test(raw)) return "USDC spend approval is needed — please retry.";
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
        var tx=new S.TransactionBuilder(acct,{fee:fee||"10000000",networkPassphrase:C.passphrase}).addOperation(op).setTimeout(120).build();
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
          var txAl=new S.TransactionBuilder(acct,{fee:"1000000",networkPassphrase:C.passphrase}).addOperation(opAl).setTimeout(60).build();
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

// ---- Fee (0.5%, to XLM) + optional source->USDC hop, then CCTP burn(net) + attest ----
function lxSubmitClassic(C,xdr){
  return fetch(C.horizon+"/transactions",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"tx="+encodeURIComponent(xdr)}).then(function(r){return r.json();}).then(function(res){
    if(res.successful||res.hash) return res;
    var rc=res.extras&&res.extras.result_codes; throw new Error("Swap/fee tx failed: "+(rc?JSON.stringify(rc):JSON.stringify(res).slice(0,150)));
  });
}
function lxStrictPath(C,srcSpec,amount,destSpec){
  var sp=srcSpec.native?"source_asset_type=native":("source_asset_type="+((srcSpec.code||"").length>4?"credit_alphanum12":"credit_alphanum4")+"&source_asset_code="+srcSpec.code+"&source_asset_issuer="+srcSpec.issuer);
  var da=destSpec.native?"native":("USDC:"+destSpec.issuer);
  return fetch(C.horizon+"/paths/strict-send?"+sp+"&source_amount="+amount+"&destination_assets="+encodeURIComponent(da)).then(function(r){return r.json();}).then(function(d){
    var recs=(d._embedded&&d._embedded.records)||[]; if(!recs.length) throw new Error("No "+(srcSpec.code||"XLM")+"→"+(destSpec.native?"XLM":"USDC")+" swap path on mainnet.");
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
  var feeRate=(window.__lxFeeRate||C.feeRate||0.005), UI=C.usdcIssuer;   // honor the 250K-LUMOS tier (0.25%) same as swap
  var isUSDC=!sourceSpec||sourceSpec==="USDC"||sourceSpec.code==="USDC";
  var srcAmt=parseFloat(String(sourceAmountHuman).replace(/,/g,"")); if(!(srcAmt>0)) return Promise.reject(new Error("Enter a valid amount"));
  return lxCctpSdk().then(function(S){ return lxCctpSigner().then(function(f){
    var pk;
    var deferredFee=null, deferredFeeAmt=0;   // AUDIT #2 (FUNDS): USDC-path fee runs AFTER a successful burn, never before
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
            onStatus("Approve the "+(feeRate*100).toFixed(2)+"% platform fee \\u2014 one more signature ("+owed.toFixed(7)+" USDC)");
            return acc().then(function(ad){
              var tb=new S.TransactionBuilder(new S.Account(pk,ad.sequence),{fee:"1000",networkPassphrase:C.passphrase})
                .addOperation(S.Operation.payment({destination:C.feeCollector,asset:new S.Asset("USDC",UI),amount:owed.toFixed(7)}))
                .setTimeout(180).build();
              return signSubmit(tb,"fee");
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
          var tb=_tb2.setTimeout(120).build();
          return signSubmit(tb,"swap+fee").then(function(){ return usdcBal().then(function(after){ var got=+(after-before).toFixed(7); if(!(got>0)) throw new Error("Swap produced no USDC."); var net=(netUsdcTarget>0&&netUsdcTarget<=got)?+netUsdcTarget.toFixed(7):got; return net; }); });
        }); }); });
      });
    }).then(function(netHuman){
      onStatus("Bridging "+netHuman+" USDC via CCTP…");
      return lxCctpBurn(destDomain,String(netHuman),recipient,onStatus).then(function(res){
        // AUDIT #1/#3 (FUNDS): persist the burn IMMEDIATELY, before attestation. Past this point the USDC is
        // already destroyed on Stellar, so the record must exist even if attestation times out or the tab closes.
        var rec={ burnHash:res.hash, approveHash:res.approveHash||null, netUsdc:netHuman, feeRate:feeRate,
                  destDomain:parseInt(destDomain,10), recipient:recipient, status:"burned", ts:Date.now() };
        lxBrSavePending(rec);
        // hand it to the delivery relayer straight away. Fire-and-forget on purpose: if the relayer is not
        // provisioned, or the request fails, the transfer still sits in the pending list with a Claim button,
        // exactly as it did before. Auto-delivery is an upgrade on a flow that already works.
        lxRelayEnqueue(res.hash,parseInt(destDomain,10));
        // fee now that the burn is confirmed. A fee failure must NEVER fail the bridge (the USDC is already
        // burned) — record it and carry on so the user still gets their attestation + redeem data.
        // a fee failure must NEVER fail the bridge — but it must not vanish either: what could not be
        // collected is remembered against this wallet and added to its next bridge
        var feeP = deferredFee ? deferredFee().catch(function(fe){
          rec.feeError=(fe&&fe.message)||"fee not collected"; lxFeeOwedAdd(pk,deferredFeeAmt); lxBrSavePending(rec); }) : Promise.resolve();
        return feeP.then(function(){ return lxCctpAttest(res.hash,onStatus); }).then(function(att){
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
    var MAP={Ethereum:'ethereum',Avalanche:'avalanche',Optimism:'optimism',Arbitrum:'arbitrum',Base:'base',Polygon:'polygon',Solana:'solana',Sui:'sui',Linea:'linea','World Chain':'worldchain'};
    // force=false: skip icons that already carry a real logo as a url() background (e.g. Ethereum's option) so we
    // don't fight the design's own re-render loop (that fight caused the Ethereum dropdown blip). force=true: always set.
    function apply(ic,key,force){ if(!ic)return; var img=ic.querySelector('img.lx-netimg'); if(img){ if((img.getAttribute('src')||'').indexOf(key)<0) img.setAttribute('src','assets/networks/'+key+'.png'); return; } if(!force){ var stl=ic.getAttribute('style')||''; if(stl.indexOf('url(')>=0) return; } ic.innerHTML='<img class="lx-netimg" src="assets/networks/'+key+'.png" alt="">'; }
    [].slice.call(document.querySelectorAll('.brd-opt[data-net]')).forEach(function(o){ var key=MAP[o.getAttribute('data-net')]; if(key) apply(o.querySelector('.brd-ic'),key,false); });
    // .br-netchip covers the source chip AND the .brd-trigger (selected dest); force so the selected chip always shows the PNG (set once, no blip)
    [].slice.call(document.querySelectorAll('.br-netchip')).forEach(function(ch){ var key=MAP[((ch.querySelector('.br-nm')||ch.querySelector('.nm')||{}).textContent||'').trim()]; if(key) apply(ch.querySelector('.br-ic'),key,true); });
  }catch(_){}
}
(function(){ var n=0,iv=setInterval(function(){ n++; lxCctpNetLogos(); if(n>25) clearInterval(iv); },250);
  document.addEventListener('click',function(){ setTimeout(lxCctpNetLogos,60); setTimeout(lxCctpNetLogos,260); },true); })();

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
var LX_NETMAP={Ethereum:"ethereum",Avalanche:"avalanche",Optimism:"optimism",Arbitrum:"arbitrum",Base:"base",Polygon:"polygon",Solana:"solana",Sui:"sui",Linea:"linea","World Chain":"worldchain"};
// per-network block explorer "wallet address" pages (for clickable recent-tx addresses)
var LX_ACCT_EXP={Ethereum:"https://etherscan.io/address/",Base:"https://basescan.org/address/",Arbitrum:"https://arbiscan.io/address/",Optimism:"https://optimistic.etherscan.io/address/",Polygon:"https://polygonscan.com/address/",Avalanche:"https://snowtrace.io/address/",Linea:"https://lineascan.build/address/","World Chain":"https://worldscan.org/address/",Solana:"https://solscan.io/account/",Sui:"https://suiscan.xyz/mainnet/account/"};
function lxSrcExp(pk){ return "https://stellar.expert/explorer/public/account/"+pk; }
function lxDstExp(net,a){ var b=LX_ACCT_EXP[net]; return b?b+a:"#"; }
var LX_SRC_ADDR="GC4WVG7LVFCSERJZVIB4WHBJCNCWUGHEVRHTAA6PSSDNRGEZWZMTEIUG"; // Stellar source placeholder; overwritten by real Freighter address on connect
window.__lxBr=window.__lxBr||{srcKey:"USDC", amount:"", pk:null, bals:null, _loading:false};

function lxBrFmt(n,dp){ if(n==null||!isFinite(n))return "0"; return Number(n).toLocaleString("en-US",{maximumFractionDigits:dp==null?2:dp}); }
function lxBrShort(a){ return a&&a.length>12 ? a.slice(0,5)+"…"+a.slice(-4) : (a||""); }
function lxBrDestNet(){ var t=document.querySelector('.br-step[data-step="1"] .brd-trigger .nm'); return t?(t.textContent||"").trim():""; }
function lxBrBalOf(k){ var Bm=window.__lxBr.bals; if(!Bm)return null; return Bm[k]!=null?Bm[k]:0; }
// destination address validation. CCTP dests are EVM/Solana/Sui — none require a pre-existing USDC trustline
// (EVM: any address holds ERC-20 USDC; Solana ATA + Sui coin object are auto-created by CCTP mint). So format-check only.
var LX_EVM_NETS={Ethereum:1,Avalanche:1,Optimism:1,Arbitrum:1,Base:1,Polygon:1,Linea:1,'World Chain':1};
function lxBrValidAddr(net,a){ a=(a||'').trim(); if(!a)return false; if(LX_EVM_NETS[net])return /^0x[0-9a-fA-F]{40}$/.test(a); if(net==='Solana')return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a); if(net==='Sui')return /^0x[0-9a-fA-F]{64}$/.test(a); return a.length>0; }
function lxBrStep2Err(msg){ var s2=document.querySelector('.br-step[data-step="2"]'); var e=s2?s2.querySelector('.br-errslot'):null; if(e){ e.textContent=msg||''; if(msg) e.setAttribute('data-err',msg); else e.removeAttribute('data-err'); e.style.color=msg?'#e04f4f':''; } }
// keep the Review button disabled until amount>0 AND a valid destination address; flag an invalid address in red
function lxBrValidateStep2(){
  var s2=document.querySelector('.br-step[data-step="2"]'); if(!s2)return false;
  var sides=s2.querySelectorAll('.br-side'); if(sides.length<2)return false;
  var k=window.__lxBr.srcKey; var amtIn=sides[0].querySelector('.br-amt .lx-amtin'); var amt=parseFloat((((amtIn?amtIn.value:'')||'').split(',').join('')))||0;
  var dstIn=sides[1].querySelector('.br-addr-in'); var addr=dstIn?(dstIn.value||'').trim():''; var net=lxBrDestNet();
  var bal=lxBrBalOf(k); var overBal=(bal!=null && amt>bal);
  var addrOk=lxBrValidAddr(net,addr), amtOk=(amt>0 && !overBal), ok=addrOk&&amtOk;
  var wrap=(dstIn&&dstIn.closest)?dstIn.closest('.br-wallet'):null;
  if(wrap){ if(addr&&!addrOk) wrap.classList.add('lx-invalid'); else wrap.classList.remove('lx-invalid'); }
  // inline error (balance-exceeded takes priority over a malformed address)
  if(overBal) lxBrStep2Err("Amount exceeds your balance ("+lxBrFmt(bal,bal>=1000?0:2)+" "+k+").");
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
      st.textContent=".lx-br-amenu{background:#fff;border:1px solid #ececef;border-radius:14px;box-shadow:0 18px 44px rgba(15,20,35,.16);padding:6px;font:inherit;color:#0e0e10}"
        +".lx-amsearch{padding:4px 4px 6px}"
        +".lx-amq{width:100%;box-sizing:border-box;background:#f6f7f9;border:1px solid #ececef;border-radius:9px;color:#0e0e10;font:inherit;font-size:13px;padding:8px 10px;outline:none}"
        +".lx-amq:focus{border-color:rgba(234,106,44,.55);box-shadow:0 0 0 3px rgba(234,106,44,.1)}"
        +".lx-amlist{max-height:264px;overflow:auto}"
        +".lx-br-amenu button{display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;border:0;border-radius:10px;background:transparent;color:inherit;font:inherit;cursor:pointer;text-align:left}"
        +".lx-br-amenu button:hover{background:#f4f5f7}"
        +".lx-br-amenu .aic{width:26px;height:26px;border-radius:50%;overflow:hidden;display:inline-flex;flex:0 0 26px;background:#f0f1f4}"
        +".lx-br-amenu .aic img{width:100%;height:100%;object-fit:cover;display:block}"
        +".lx-br-amenu .atx{display:flex;flex-direction:column;line-height:1.25;min-width:0}"
        +".lx-br-amenu .anm{font-size:14px;font-weight:600}"
        +".lx-br-amenu .aiss{font-size:11px;color:#8a90a2;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}";
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
  if(bal){ var b=lxBrBalOf(k); var maxEl=bal.querySelector('.max'); var bStr=(b==null?"—":lxBrFmt(b,b>=1000?0:4));
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
  if(chip){ var nm=chip.querySelector('.nm'); if(nm&&nm.textContent!=="USDC")nm.textContent="USDC"; var ic=chip.querySelector('.lx-assetic')||chip.querySelector('.br-ic'); if(ic && !ic.querySelector('img')) ic.innerHTML='<img src="assets/tokens/usdc.png" style="width:100%;height:100%;object-fit:cover;display:block" alt="">'; var cv=chip.querySelector('.cv'); if(cv)cv.style.display="none"; }
  if(nkey){ var lead=side.querySelector('.br-wallet .br-ic.lx-netic')||side.querySelector('.br-ic.lx-netic'); if(lead && !(lead.querySelector('img')&&lead.querySelector('img').getAttribute('src').indexOf(nkey)>=0)) lead.innerHTML='<img class="lx-netimg" src="assets/networks/'+nkey+'.png" alt="">'; }
  // note: do NOT touch the input placeholder — the finalized design animates/owns it; overriding here caused flicker.
}

function lxBrMoney(side, usd){ var el=side&&side.querySelector('.br-amt .usd .lc-money'); if(!el)return; var s="$"+lxBrFmt(usd,2); el.setAttribute('data-usd',String(Math.round(usd*100)/100)); el.setAttribute('data-orig',s); el.textContent=s; }
// Load LIVE market prices (CoinGecko) into the px table so the $ / USDC estimates are real, not hardcoded.
// Falls back silently to the built-in px values if the request fails.
var __lxPxLoaded=false;
function lxCctpLoadPrices(){
  if(__lxPxLoaded)return; __lxPxLoaded=true;
  var CG={stellar:["XLM","yXLM"],"usd-coin":["USDC"],"stronghold-token":["SHX"],blend:["BLND"],aquarius:["AQUA"]};
  var ids=Object.keys(CG).join(",");
  fetch("https://api.coingecko.com/api/v3/simple/price?ids="+ids+"&vs_currencies=usd").then(function(r){return r.json();}).then(function(j){
    if(!j)throw new Error("no price data");
    var xlm=j.stellar&&j.stellar.usd; if(xlm>0) window.__lxXlmUsd=xlm;
    Object.keys(CG).forEach(function(id){ var p=j[id]&&j[id].usd; if(p>0){ CG[id].forEach(function(k){ if(LX_ASSETS[k]) LX_ASSETS[k].px=p; }); } });
    try{ lxBrCalc(); }catch(_){}
  }).catch(function(){ __lxPxLoaded=false; });
}
function lxBrCalc(){
  var s2=document.querySelector('.br-step[data-step="2"]'); if(!s2)return;
  var sides=s2.querySelectorAll('.br-side'); if(sides.length<2)return;
  var amtIn=sides[0].querySelector('.br-amt .lx-amtin'); var amtEl=sides[0].querySelector('.br-amt .v'); var outEl=sides[1].querySelector('.br-amt .v'); if(!outEl)return;
  var raw=((amtIn?amtIn.value:(amtEl?amtEl.textContent:""))||"").split(",").join("").trim(); var amt=parseFloat(raw)||0; window.__lxBr.amount=raw;
  lxBrValidateStep2();
  var k=window.__lxBr.srcKey, A=LX_ASSETS[k]||LX_ASSETS.USDC, C=window.__lxCCTP, feeRate=(window.__lxFeeRate||(C&&C.feeRate)||0.005);
  // AUDIT #3 bug 1/2 (FUNDS): "You get" used the static px table — a TESTNET-era decision ("don't quote the
  // testnet pool") that was flat wrong on mainnet, where the pools ARE the market. LUMOS (not on CoinGecko)
  // kept its baked px:0.25 against a real ~$0.00005, quoting ~4,800x the deliverable amount; execution then
  // swapped at the REAL path rate, so the burn was safe but the preview and Review screen lied. Now: the px
  // figure paints instantly as a placeholder, and a debounced LIVE strict-send path quote — the same rate
  // execution uses — overwrites it. If no path exists, show a dash and zero the target: execution would
  // fail on that pair anyway, and an honest dash beats an invented number.
  var pxu = k==="USDC"?1:(k==="XLM"?(window.__lxXlmUsd||A.px):A.px);
  var srcUsd=amt*pxu, out=amt*pxu*(1-feeRate);
  lxBrMoney(sides[0], srcUsd);
  if(amt<=0){ outEl.textContent="~ 0.00"; lxBrMoney(sides[1],0); window.__lxBr.netUsdc=0; return; }
  outEl.textContent="~ "+lxBrFmt(out,2); lxBrMoney(sides[1], out); window.__lxBr.netUsdc=+out.toFixed(7);
  if(k==="USDC")return;                                     // USDC->USDC: amt*(1-fee) IS exact, nothing to quote
  // LANDMINE: lxBrCalc is re-invoked on a ~200ms design loop, so a plain debounce (clearTimeout on every
  // call) NEVER fired — measured seq climbing 2,4,5,6,8… while the quote never ran. Key the work on the
  // INPUTS (asset+amount) instead: identical inputs reuse the in-flight/finished quote, and only a genuine
  // change starts a new one. Cache by key so re-renders repaint the real number instead of the px estimate.
  var Q=window.__lxBrQ=window.__lxBrQ||{key:null,val:null,busy:false,cache:{}};
  var qk=k+"|"+amt.toFixed(7)+"|"+feeRate;
  function paint(real){
    if(real==null){ outEl.textContent="~ —"; lxBrMoney(sides[1],0); window.__lxBr.netUsdc=0; return; }
    outEl.textContent="~ "+lxBrFmt(real,2); lxBrMoney(sides[1], real);
    window.__lxBr.netUsdc=+real.toFixed(7); lxBrMoney(sides[0], real/(1-feeRate));
  }
  if(Object.prototype.hasOwnProperty.call(Q.cache,qk)){ paint(Q.cache[qk]); return; }
  if(Q.key===qk)return;                                     // already in flight for exactly these inputs
  Q.key=qk;
  var swapAmt=amt*(1-feeRate); if(!(swapAmt>0))return;
  lxStrictPath(C, A.spec.native?{native:true}:A.spec, swapAmt.toFixed(7), {code:"USDC",issuer:C.usdcIssuer})
    .then(function(p){ Q.cache[qk]=+p.out; if(Q.key===qk)paint(+p.out); })
    .catch(function(){ Q.cache[qk]=null; if(Q.key===qk)paint(null); });
}

function lxBrLoadWallet(force){
  var B=window.__lxBr; if(B._loading||(B.pk&&B.bals&&!force))return; B._loading=true;
  try{ lxCctpSigner().then(function(f){
    function grab(){ return Promise.resolve(f.getAddress?f.getAddress():f.getPublicKey()).then(function(a){ return (a&&a.address)||a; }); }
    var gate = force ? Promise.resolve(f.requestAccess?f.requestAccess():null) : (f.isAllowed?Promise.resolve(f.isAllowed()).then(function(ok){ if(!ok) throw new Error("not-allowed"); }):Promise.resolve());
    return gate.then(grab).then(function(pk){ if(!pk)throw new Error("no-pk"); B.pk=pk; var C=window.__lxCCTP;
      return fetch(C.horizon+"/accounts/"+pk).then(function(r){return r.json();}).then(function(ac){ var m={}; (ac.balances||[]).forEach(function(x){ if(x.asset_type==="native")m.XLM=parseFloat(x.balance); else if(x.asset_code)m[x.asset_code]=parseFloat(x.balance); }); B.bals=m; B._loading=false; lxBrRenderSource(); });
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
    var maxEl=srcSide.querySelector('.bal .max'); if(maxEl){ maxEl.style.cursor="pointer"; maxEl.addEventListener('click',function(e){ e.stopPropagation(); var b=lxBrBalOf(window.__lxBr.srcKey); if(b==null){ lxBrLoadWallet(true); return; } var a2=srcSide.querySelector('.br-amt .lx-amtin'); if(a2){ a2.value=lxBrFmt(b,b>=1000?0:4); lxBrCalc(); } }); }
    var wc=srcSide.querySelector('.br-wallet'); if(wc) wc.addEventListener('click',function(){ if(!window.__lxBr.pk) lxBrLoadWallet(true); },false);
    // gate: block advance to Review unless a valid destination address is present
    var dstInEl=dstSide.querySelector('.br-addr-in'); var revBtn=s2.querySelector('[data-go="3"]');
    if(revBtn) revBtn.addEventListener('click',function(e){ var net=lxBrDestNet(); var a=dstInEl?(dstInEl.value||'').trim():''; var msg=''; if(!a) msg="Enter the destination address to continue."; else if(!lxBrValidAddr(net,a)) msg="That doesn't look like a valid "+(net||'destination')+" address."; if(msg){ e.stopPropagation(); e.preventDefault(); lxBrStep2Err(msg); if(dstInEl) dstInEl.focus(); } else { lxBrStep2Err(''); } },true);
    if(dstInEl) dstInEl.addEventListener('input',function(){ if(lxBrValidAddr(lxBrDestNet(),(dstInEl.value||'').trim())) lxBrStep2Err(''); lxBrValidateStep2(); });
    // Paste button -> read clipboard into the destination input
    var pasteBtn=dstSide.querySelector('.br-paste');
    if(pasteBtn) pasteBtn.addEventListener('click',function(e){ e.preventDefault(); e.stopPropagation();
      function set(t){ if(dstInEl){ dstInEl.value=(t||'').trim(); dstInEl.dispatchEvent(new Event('input',{bubbles:true})); dstInEl.focus(); } }
      if(navigator.clipboard&&navigator.clipboard.readText){ navigator.clipboard.readText().then(set).catch(function(){ if(dstInEl){ dstInEl.focus(); } }); }
      else if(dstInEl){ dstInEl.focus(); try{ document.execCommand('paste'); }catch(_){ } }
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
function lxBrXpIcon(){ var a=document.querySelector('.br-table .br-xplink'); return a?a.innerHTML:'↗'; }
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
  var rIc=legs[1].querySelector('.v .ic:not(.lx-rvnet)'); if(rIc) rIc.innerHTML='<img src="assets/tokens/usdc.png" style="width:100%;height:100%;object-fit:cover;display:block" alt="">';
  var srcRow=s3.querySelector('[data-rv="src"]'); if(srcRow) srcRow.innerHTML='<span class="lx-rvaddric">'+lxBrStellarIcon()+'</span><span>'+lxBrShort(B.pk||LX_SRC_ADDR)+'</span>';
  var dstIn=s2?s2.querySelector('.br-addr-in'):null; var dst=dstIn?(dstIn.value||"").trim():""; var nkey=LX_NETMAP[net];
  var dstRow=s3.querySelector('[data-rv="dst"]'); if(dstRow){ if(dst){ dstRow.innerHTML=(nkey?'<span class="lx-rvaddric"><img class="lx-netimg" src="assets/networks/'+nkey+'.png" alt=""></span>':'')+'<span>'+lxBrShort(dst)+'</span>'; } else dstRow.textContent="—"; }
  // Bridge fee row: show the actual amount, not just the rate. It always read "0.5%" and nothing else,
  // while "You send" showed the gross amount — so from the review alone there was no way to tell the fee
  // had been taken at all. It is deducted from the source asset, so name it in the source asset.
  var bf=s3.querySelector('.lx-bfee .v');
  if(bf){
    var _fr=(window.__lxFeeRate||(window.__lxCCTP&&window.__lxCCTP.feeRate)||0.005);
    var _sa=parseFloat(String(amt).replace(/,/g,""))||0, _fa=_sa*_fr;
    var _amtTxt=_fa>0?(_fa<0.0001?_fa.toFixed(7):_fa.toLocaleString("en-US",{maximumFractionDigits:6})):"";
    var _pct=(_fr*100).toFixed(2).replace(/0$/,"").replace(/\\.$/,"")+"%";
    bf.innerHTML=_pct+(_amtTxt?' <span class="lx-bamt">\\u00b7 '+_amtTxt+' '+lxBrEsc(k)+'</span>':'')
      +(_fr>0.003?'<span class="lx-bchip">0.25% with LUMOS</span>':'<span class="lx-bchip">LUMOS holder rate</span>');
  }
  // Circle CCTP fee row — Standard transfer is free (only our 0.5%/0.25% applies). Structured so a Fast-transfer fee could slot in later.
  var list=s3.querySelector('.br-rv-list');
  if(list && !list.querySelector('.lx-cfee')){ var feeRow=list.querySelector('.lx-bfee'); var r=document.createElement('div'); r.className='r lx-cfee'; r.innerHTML='<span class="k">Circle CCTP fee</span><span class="v">Free <span class="lx-cchip">Standard transfer</span></span>'; if(feeRow) feeRow.parentNode.insertBefore(r, feeRow.nextSibling); else list.appendChild(r); }
}
function lxBrAddRecentTx(o){
  var tbody=document.querySelector('.br-table tbody'); if(!tbody)return;
  var nkey=LX_NETMAP[o.net]||"", sIcon=lxBrStellarIcon(), xp=lxBrXpIcon();
  // FROM icon = the SOURCE ASSET logo (USDC/XLM), not always the Stellar network mark.
  var srcImg=(o.srcKey==="USDC")?"assets/tokens/usdc.png":((o.srcKey==="XLM")?"assets/tokens/xlm.png":"");
  var srcIco=srcImg?('<img class="lx-netimg" src="'+srcImg+'" style="width:100%;height:100%;object-fit:cover;display:block" alt="">'):sIcon;
  var tr=document.createElement('tr'); tr.className="lx-newtx";
  tr.innerHTML='<td>'+(o.when||'Just now')+'</td>'
    +'<td><span class="br-asschip"><span class="br-ic lx-netic">'+srcIco+'</span><span><span class="am">'+o.srcAmount+' '+o.srcKey+'</span><span class="nt">Stellar</span></span></span></td>'
    +'<td class="mono"><a class="lx-txaddr" href="'+lxSrcExp(o.src)+'" target="_blank" rel="noopener" title="View source wallet on Stellar Expert">'+lxBrShort(o.src)+'</a></td>'
    +'<td><span class="br-asschip"><span class="br-ic lx-netic"><img class="lx-netimg" src="assets/networks/'+nkey+'.png" style="width:100%;height:100%;object-fit:cover;display:block" alt=""></span><span><span class="am">'+lxBrFmt(o.amount,2)+' USDC</span><span class="nt">'+o.net+'</span></span></span></td>'
    +'<td class="mono"><a class="lx-txaddr" href="'+lxDstExp(o.net,o.recipient)+'" target="_blank" rel="noopener" title="View destination wallet on '+o.net+' explorer">'+lxBrShort(o.recipient)+'</a></td>'
    +'<td class="lx-buse"><span class="lx-buse-cctp">CCTP</span></td>'
    +'<td class="br-xp"><a class="br-xplink" href="https://stellar.expert/explorer/public/tx/'+o.hash+'" target="_blank" rel="noopener" aria-label="View on explorer" title="View burn on Stellar Expert">'+xp+'</a></td>';
  tbody.insertBefore(tr, tbody.firstChild);
}
window.lxBrAddRecentTx=lxBrAddRecentTx; window.lxBrReview=lxBrReview;
// ---- persist completed bridges so they survive a page refresh ----
function lxBrRelTime(ts){ if(!ts)return "Just now"; var s=Math.floor((Date.now()-ts)/1000); if(s<60)return "Just now"; var m=Math.floor(s/60); if(m<60)return m+(m===1?" min ago":" mins ago"); var h=Math.floor(m/60); if(h<24)return h+(h===1?" hr ago":" hrs ago"); var d=Math.floor(h/24); return d+(d===1?" day ago":" days ago"); }
function lxBrSaveTx(o){ try{ var a=JSON.parse(localStorage.getItem("lumos.cctp.txs")||"[]"); a.unshift(o); if(a.length>25)a=a.slice(0,25); localStorage.setItem("lumos.cctp.txs",JSON.stringify(a)); }catch(_){} }
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
function lxBrClearPending(hash){ try{ var a=lxBrListPending().filter(function(x){return x.burnHash!==hash;}); localStorage.setItem("lumos.cctp.pending",JSON.stringify(a)); }catch(_){} }
window.lxBrSavePending=lxBrSavePending; window.lxBrListPending=lxBrListPending; window.lxBrClearPending=lxBrClearPending;
function lxBrRestoreTxs(){ try{ var tbody=document.querySelector('.br-table tbody'); if(!tbody||tbody.__lxRestored)return; tbody.__lxRestored=true; var a=JSON.parse(localStorage.getItem("lumos.cctp.txs")||"[]"); for(var i=a.length-1;i>=0;i--){ var o=a[i]; o.when=lxBrRelTime(o.ts); lxBrAddRecentTx(o); } }catch(_){} }
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
function lxBrProg(){ var el=document.getElementById("lx-prog"); if(!el){ el=document.createElement("div"); el.id="lx-prog"; el.className="lx-prog"; var items=LX_PSTEPS.map(function(s){return '<li data-pk="'+s.k+'"><span class="lx-pdot"><span class="lx-spin"></span><span class="lx-tick">✓</span></span><span class="lx-plab">'+s.label+'</span></li>';}).join(""); el.innerHTML='<div class="lx-prog-card"><div class="lx-prog-h">Bridging via Circle CCTP</div><div class="lx-prog-sub">Approve the wallet prompts — everything else runs automatically.</div><ul class="lx-prog-list">'+items+'</ul><div class="lx-prog-msg"></div><button class="lx-prog-x" type="button" hidden>Done</button></div>'; (document.querySelector(".br-card")||document.body).appendChild(el); el.querySelector(".lx-prog-x").addEventListener("click",function(){ el.style.display="none"; if(el.__ok) lxBrResetWizard(); }); } return el; }
// after a successful bridge, return the wizard to step 1 and clear the form (recent transactions stays put)
function lxBrResetWizard(){ try{
  var s3=document.querySelector('.br-step[data-step="3"]'); var b3=s3?s3.querySelector('[data-go="2"]'):null; if(b3) b3.click();
  setTimeout(function(){ var s2=document.querySelector('.br-step[data-step="2"]'); var b2=s2?s2.querySelector('[data-go="1"]'):null; if(b2) b2.click();
    window.__lxBr.amount=''; var ain=document.querySelector('.br-step[data-step="2"] .br-amt .lx-amtin'); if(ain) ain.value='';
    var din=document.querySelector('.br-step[data-step="2"] .br-addr-in'); if(din) din.value='';
    lxBrStep2Err(''); lxBrValidateStep2();
  },140);
}catch(_){} }
function lxBrProgShow(){ var el=lxBrProg(); el.style.display="flex"; el.__idx=-1; el.__ok=false; var x=el.querySelector(".lx-prog-x"); x.hidden=true; x.textContent="Done"; var h=el.querySelector(".lx-prog-h"); h.textContent="Bridging via Circle CCTP"; var m=el.querySelector(".lx-prog-msg"); m.textContent="Preparing…"; m.style.color=""; [].slice.call(el.querySelectorAll(".lx-prog-list li")).forEach(function(li){ li.className=""; }); var g=el.querySelector(".lx-prog-gate"); if(g) g.style.display="none";
  // pre-load the web-wallet SDK so its sign popup can open synchronously from the gate click
  if(lxCctpIsWebWallet()){ try{ lxCctpMod("https://esm.sh/@albedo-link/intent@0.12.0"); }catch(_){} } }
function lxBrProgUpdate(msg){ var el=lxBrProg(); el.querySelector(".lx-prog-msg").textContent=msg; var idx=-1,i; for(i=0;i<LX_PSTEPS.length;i++){ if(LX_PSTEPS[i].re.test(msg)) idx=i; } if(idx<0||idx<(el.__idx||0))return; el.__idx=idx; var lis=el.querySelectorAll(".lx-prog-list li"); for(i=0;i<lis.length;i++){ lis[i].className = i<idx?"done":(i===idx?"active":""); } }
// AUDIT #1 (FUNDS): this used to claim "Bridge complete ✓ — your USDC is on its way" as soon as Circle
// attested. But CCTP only delivers once someone submits receiveMessage() on the DESTINATION chain, which this
// app does not do — so the transfer is NOT complete here. Report exactly what happened and keep the redeem
// data visible. Pass minted=true once a destination mint is actually performed.
function lxBrProgDone(res){
  var el=lxBrProg(); el.__ok=true;
  [].slice.call(el.querySelectorAll(".lx-prog-list li")).forEach(function(li){ li.className="done"; });
  var m=el.querySelector(".lx-prog-msg"); m.style.color="";
  if(res&&res.minted){
    el.querySelector(".lx-prog-h").textContent="Bridge complete ✓";
    m.textContent="Your USDC has been minted on the destination chain — added to Recent transactions.";
  }else{
    el.querySelector(".lx-prog-h").textContent="Burned on Stellar ✓ — awaiting mint";
    m.innerHTML='Your USDC was burned on Stellar and Circle has signed the attestation, but it has <b>not been minted on the destination chain yet</b> — that final step is not automated here.'
      +'<br><br>Your transfer is safe and recoverable: the burn hash, Circle message and attestation are stored in this browser.'
      +(res&&res.burnHash?'<br><span class="lx-prog-hash" style="font-family:monospace;font-size:11.5px;opacity:.8;word-break:break-all">Burn: '+res.burnHash+'</span>':'')
      +'<br><button type="button" class="lx-prog-copy" style="margin-top:9px;background:var(--accent,#ea6a2c);color:#fff;border:none;border-radius:8px;padding:7px 12px;font-weight:700;cursor:pointer">Copy redeem data</button>';
    var cb=m.querySelector(".lx-prog-copy");
    if(cb)cb.addEventListener("click",function(){ try{ navigator.clipboard.writeText(JSON.stringify(res||{},null,2)); cb.textContent="Copied ✓"; }catch(_){ cb.textContent="Copy failed"; } });
  }
  el.querySelector(".lx-prog-x").hidden=false;
}
function lxBrProgFail(msg){ var el=lxBrProg(); el.querySelector(".lx-prog-h").textContent="Bridge failed"; var m=el.querySelector(".lx-prog-msg"); m.textContent=msg||"Something went wrong."; m.style.color="#e5484d"; var x=el.querySelector(".lx-prog-x"); x.hidden=false; x.textContent="Close"; }
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
// Requiring the destination to already hold a little gas is a cheap proof that it is a real, used account
// on THAT chain. Note what this is not: with automatic delivery the recipient needs no gas to receive, so
// this rejects some legitimate brand-new wallets. That is the deliberate trade — a funded-address rule
// costs those users a top-up; no rule at all costs someone their whole transfer.
//
// Anything we cannot check (an RPC hiccup, a chain with no usable public endpoint) passes. Our own
// infrastructure failing is not evidence against the user's address.
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
        +". LumosCore only sends to a destination already funded with at least $0.50 \\u2014 an unused address is usually a wrong one, and a cross-chain transfer cannot be undone. Check the address, fund it on "+nm+", then try again."};
    });
  }).catch(function(){ return {ok:true}; }); }
window.lxBrDestFunded=lxBrDestFunded;

function lxBrConfirm(btn){
  var B=window.__lxBr, k=B.srcKey, A=LX_ASSETS[k]||LX_ASSETS.USDC, C=window.__lxCCTP, net=lxBrDestNet();
  var domain=(C&&C.domains)?C.domains[net]:null;
  var s2=document.querySelector('.br-step[data-step="2"]'); var dstIn=s2?s2.querySelector('.br-addr-in'):null;
  var recipient=dstIn?(dstIn.value||"").trim():""; var amt=B.amount||"";
  var s3=document.querySelector('.br-step[data-step="3"]'); var errslot=s3?s3.querySelector('.br-errslot'):null;
  function say(m,ok){ if(errslot){ errslot.setAttribute('data-err',ok?'':m); errslot.textContent=m; errslot.style.color=ok?'#3fb950':''; } }
  say("");
  if(!(parseFloat(amt)>0)){ say("Enter a valid amount on the previous step."); return; }
  if(domain==null){ say("Select a CCTP-supported destination network."); return; }
  if(!recipient){ say("Paste the destination address on the previous step."); return; }
  // check the destination is a live account BEFORE any signature — nothing is burned yet, so this is the
  // last moment a wrong address costs nothing
  if(btn) btn.disabled=true;
  say("Checking the destination address\\u2026");
  lxBrDestFunded(domain,recipient).then(function(chk){
    if(btn) btn.disabled=false;
    if(!chk.ok){ say(chk.msg); return; }
    say(""); go();
  });
  function go(){
  lxBrProgShow();
  function status(m){ lxBrProgUpdate(m); }
  try{ lxCctpBridgeFull(domain, amt, recipient, A.spec, status, window.__lxBr.netUsdc).then(function(res){
    lxBrProgDone(res);
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
function lxBrDomName(d){ var C=window.__lxCCTP,m=(C&&C.domains)||{}; for(var k in m){ if(m[k]===d) return k; } return "chain "+d; }
function lxBrEsc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function lxBrShortH(h){ h=String(h||""); return h.length>16?(h.slice(0,8)+"\\u2026"+h.slice(-6)):h; }
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
function lxEvmReq(m,p){ var e=lxEvmProv();
  if(!e)return Promise.reject(new Error("No EVM wallet detected \\u2014 install MetaMask or Rabby to claim on the destination chain."));
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
  if(!cfg)return Promise.reject(new Error("Minting is not wired for this chain yet \\u2014 use Copy redeem data."));
  if(!rec.message||!rec.attestation)return Promise.reject(new Error("This transfer has no attestation yet \\u2014 press Check status first."));
  var data=lxAbiReceive(rec.message,rec.attestation), from=null;
  onStatus("Connecting your EVM wallet\\u2026");
  return lxEvmConnect().then(function(a){ from=a; onStatus("Switching to "+cfg.n+"\\u2026"); return lxEvmSwitch(cfg); })
    .then(function(){ onStatus("Checking the claim will succeed\\u2026");
      // SIMULATE FIRST: a malformed or already-spent message fails here, free, before the wallet ever opens
      return lxEvmReq("eth_call",[{from:from,to:LX_MT,data:data},"latest"]); })
    .then(function(){ onStatus("Confirm in your wallet\\u2026");
      return lxEvmReq("eth_sendTransaction",[{from:from,to:LX_MT,data:data}]); })
    .then(function(hash){ onStatus("Waiting for "+cfg.n+" to confirm\\u2026");
      return lxEvmWait(hash).then(function(ok){ return {hash:hash,ok:ok,chain:cfg.n,exp:cfg.exp}; }); });
}
window.lxEvmMint=lxEvmMint; window.lxAbiReceive=lxAbiReceive;

// ---- automatic delivery ------------------------------------------------------------------------------
// The claim above works, but it asks a Stellar user to install an EVM wallet, fund it with gas on a chain
// they may never have used, and press a button — for a step the protocol considers part of the transfer.
// So LumosCore runs a relayer that submits receiveMessage() for them. This is only the client half: queue
// the burn, then show what the relayer has done with it.
//
// receiveMessage mints to the recipient encoded inside Circle's attested message, so the relayer cannot
// redirect anything; it can only pay the gas. Everything here degrades to the manual flow — if the endpoint
// is missing, off, or the relayer declines (dust on Ethereum, say), the Claim button is what the user sees.
var LX_RELAY={};              // burnHash -> {status,reason,deliverHash}
var lxRelayOn=null;           // null = not asked yet, false = no relayer on this deployment
var lxRelayFails=0;
function lxRelayEnqueue(hash,domain){ try{
  fetch("/lxapi/cctp/enqueue",{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({burnHash:String(hash||"").toLowerCase(),destDomain:domain})})
    .then(function(r){ return r.json(); })
    .then(function(d){ if(!d)return; lxRelayOn=(d.relayer==="on");
      if(d.relayer==="on"){ LX_RELAY[String(hash).toLowerCase()]={status:d.status||"queued"}; lxBrRenderPending(); } })
    .catch(function(){});
}catch(_){} }
// one request for every pending row, not one per row
function lxRelayFetch(){
  var list=lxBrListPending().filter(function(r){ return !r.relayDone; });
  if(!list.length||lxRelayOn===false) return Promise.resolve(false);
  var hs=list.map(function(r){ return String(r.burnHash||"").toLowerCase(); }).slice(0,20).join(",");
  return fetch("/lxapi/cctp/status?hash="+hs).then(function(r){ return r.json(); }).then(function(d){
    if(!d||d.relayer!=="on"){ lxRelayOn=false; return false; }
    lxRelayOn=true; var changed=false;
    var items=d.items||{};
    for(var h in items){ var prev=LX_RELAY[h]; var now=items[h];
      if(!prev||prev.status!==now.status||prev.deliverHash!==now.deliverHash){ changed=true; }
      LX_RELAY[h]=now; }
    lxRelayFails=0;
    return changed;
  }).catch(function(){
    // no endpoint, or it is down. Tolerate a blip, but stop polling rather than loop forever against a
    // deployment that simply has no relayer — the Claim button is still there and still works.
    if(++lxRelayFails>=3) lxRelayOn=false;
    return false; });
}
function lxRelayOf(hash){ return LX_RELAY[String(hash||"").toLowerCase()]||null; }
// true while the relayer still intends to deliver this one
function lxRelayWorking(st){ return st==="queued"||st==="awaiting-attestation"||st==="retrying"||st==="sent"; }
function lxRelayChip(rec,ready){
  var s=lxRelayOf(rec.burnHash), st=s&&s.status;
  if(st==="delivered") return {cls:"ok",txt:"Delivered automatically"};
  if(lxRelayWorking(st)) return {cls:"wait",txt:(st==="awaiting-attestation"?"Awaiting Circle attestation":"Delivering automatically\\u2026")};
  return {cls:(ready?"ok":"wait"),txt:(ready?"Ready to redeem":"Awaiting Circle attestation")};
}
// the relayer declined (below the gas floor for that chain, or it gave up) — say why, plainly
function lxRelayNote(rec){ var s=lxRelayOf(rec.burnHash); if(!s) return "";
  if(s.status==="manual"&&s.reason) return '<div class="lx-brp-relay warn">Automatic delivery skipped \\u2014 '+lxBrEsc(s.reason)+'. Claim it yourself below; nothing was lost.</div>';
  if(s.status==="delivered") return '<div class="lx-brp-relay ok">LumosCore submitted the mint for you'+(s.deliverHash?' \\u00b7 <span class="mono">'+lxBrEsc(lxBrShortH(s.deliverHash))+'</span>':'')+'.</div>';
  if(lxRelayWorking(s.status)) return '<div class="lx-brp-relay">LumosCore is delivering this for you \\u2014 no wallet or gas needed on the destination chain. You can still claim it yourself at any time.</div>';
  return ""; }
// poll while anything is still moving; stop once every row is settled so an idle tab is silent
function lxRelayPoll(){
  var pend=lxBrListPending();
  if(!pend.length||lxRelayOn===false) return;
  lxRelayFetch().then(function(changed){
    // a burn made before the relayer existed (or while it was down) is queued on first sight, once
    pend.forEach(function(r){ var s=lxRelayOf(r.burnHash);
      if(lxRelayOn&&s&&s.status==="unknown"&&!r.relayQ){ r.relayQ=1; lxBrSavePending(r); lxRelayEnqueue(r.burnHash,r.destDomain); } });
    var done=[];
    pend.forEach(function(r){ var s=lxRelayOf(r.burnHash); if(s&&s.status==="delivered"&&!r.relayDone){ r.relayDone=1; lxBrSavePending(r); done.push(r); } });
    if(changed||done.length) lxBrRenderPending();
    // give the user a beat to read "Delivered", then retire the row — the Recent transactions entry stays
    if(done.length) setTimeout(function(){ done.forEach(function(r){ lxBrClearPending(r.burnHash); }); lxBrRenderPending(); },6000);
    var busy=lxBrListPending().some(function(r){ var s=lxRelayOf(r.burnHash); return !s||lxRelayWorking(s.status); });
    if(busy&&lxRelayOn!==false) setTimeout(lxRelayPoll,15000);
  });
}
window.lxRelayEnqueue=lxRelayEnqueue; window.lxRelayPoll=lxRelayPoll; window.lxRelayOf=lxRelayOf;

function lxBrRedeemJSON(r){ var C=window.__lxCCTP||{};
  return JSON.stringify({ burnHash:r.burnHash, sourceChain:"Stellar", sourceDomain:C.sourceDomain,
    destinationChain:lxBrDomName(r.destDomain), destinationDomain:r.destDomain, recipient:r.recipient,
    amountUSDC:r.netUsdc, status:r.status, message:r.message||null, attestation:r.attestation||null }, null, 2); }
function lxBrPendPanel(){ var p=document.getElementById("lxBrPending"); if(p) return p;
  p=document.createElement("section"); p.id="lxBrPending"; p.className="lx-brpend"; p.style.display="none";
  // Desktop sits it above Recent transactions. The MOBILE bridge page has no such table, and anchoring on
  // it alone meant the whole pending-claims panel silently never existed on a phone — the one place a
  // Stellar-only user is most likely to be. Fall back to the wizard card and put it directly after.
  var anchor=document.querySelector(".br-txwrap");
  if(anchor&&anchor.parentNode){ anchor.parentNode.insertBefore(p,anchor); return p; }
  var card=document.querySelector(".br-card")||document.querySelector(".br-wizard");
  if(card&&card.parentNode){ card.parentNode.insertBefore(p,card.nextSibling); return p; }
  return null; }
function lxBrRenderPending(){ try{
  var p=lxBrPendPanel(); if(!p) return false;
  // Now that delivery is automatic, a transfer the relayer has in hand needs nothing from the user, and a
  // standing "Awaiting redemption" list of things they cannot act on is just noise — the transfer already
  // appears in Recent transactions and in Wallet activity. Show a row ONLY when the user is the one who
  // has to move: the relayer declined it, gave up on it, or is not running on this deployment.
  var list=lxBrListPending().filter(function(r){
    var s=lxRelayOf(r.burnHash);
    return !s || s.status==="unknown" || s.status==="manual";
  });
  if(!list.length){ p.style.display="none"; p.innerHTML=""; return true; }
  var rows=list.map(function(r){
    var ready=!!(r.status==="attested"&&r.message&&r.attestation);
    var rs=lxRelayOf(r.burnHash), working=!!(rs&&lxRelayWorking(rs.status)), deliv=!!(rs&&rs.status==="delivered"), chip=lxRelayChip(r,ready);
    return '<div class="lx-brp-row" data-h="'+lxBrEsc(r.burnHash)+'">'
    +'<div class="lx-brp-main"><div class="lx-brp-amt">'+lxBrEsc(lxBrAmt(r.netUsdc))+' USDC <span class="lx-brp-ar">\\u2192</span> '+lxBrEsc(lxBrDomName(r.destDomain))+'</div>'
    +'<div class="lx-brp-sub">Burned '+lxBrEsc(lxBrRelTime(r.ts))+' \\u00b7 <a class="mono" target="_blank" rel="noopener" href="https://stellar.expert/explorer/public/tx/'+lxBrEsc(r.burnHash)+'">'+lxBrEsc(lxBrShortH(r.burnHash))+'</a>'
    +(r.feeError?' \\u00b7 <span class="lx-brp-warn">platform fee not collected</span>':'')+'</div></div>'
    +'<span class="lx-brp-chip '+chip.cls+'">'+chip.txt+'</span>'
    +'<div class="lx-brp-btns">'
    +((ready||deliv)?'':'<button type="button" class="lx-brp-b" data-act="check">Check status</button>')
    // while the relayer is on it, claiming yourself is still allowed — just no longer the thing to do.
    // once it IS delivered, offering a claim would only invite a transaction that must revert.
    +((ready&&!deliv&&LX_EVM[r.destDomain])?'<button type="button" class="lx-brp-b'+(working?'':' primary')+'" data-act="mint">Claim'+(working?' it myself':' on '+lxBrEsc(LX_EVM[r.destDomain].n))+'</button>':'')
    +'<button type="button" class="lx-brp-b" data-act="copy">Copy redeem data</button>'
    +'<button type="button" class="lx-brp-b ghost" data-act="done">Mark redeemed</button>'
    +'</div>'
    +lxRelayNote(r)
    +'<div class="lx-brp-msg" style="display:none"></div>'
    +'</div>'; }).join("");
  var anyRelay=list.some(function(r){ var s=lxRelayOf(r.burnHash); return !!s&&s.status!=="unknown"; });
  p.innerHTML='<div class="lx-brp-head"><h2>Needs your action</h2><span class="lx-brp-n">'+list.length+'</span></div>'
    +'<p class="lx-brp-note">'+(anyRelay
      ? 'LumosCore delivers cross-chain transfers for you, and anything it is handling is not listed here. These are the ones it could not: claim them yourself on the destination chain. Your USDC is held by Circle until you do, and nothing here expires. On Solana and Sui, use Copy redeem data.'
      : 'These transfers were burned on Stellar and are held by Circle. CCTP only delivers once the mint is submitted on the destination chain. On Ethereum, Avalanche, Optimism, Arbitrum, Base, Polygon, Linea and World Chain you can do that here with Claim. Solana and Sui are not wired yet, so use Copy redeem data. Nothing here expires.')
    +'</p>'
    +rows;
  p.style.display="";
  return true;
}catch(_){ return false; } }
document.addEventListener("click",function(e){
  var b=e.target&&e.target.closest?e.target.closest(".lx-brp-b"):null; if(!b) return;
  var row=b.closest(".lx-brp-row"); if(!row) return;
  var hash=row.getAttribute("data-h"), act=b.getAttribute("data-act");
  var rec=lxBrListPending().filter(function(x){return x.burnHash===hash;})[0]; if(!rec) return;
  e.preventDefault(); e.stopPropagation();
  if(act==="copy"){ var txt=lxBrRedeemJSON(rec); var old=b.textContent;
    try{ navigator.clipboard.writeText(txt).then(function(){ b.textContent="Copied \\u2713"; setTimeout(function(){ b.textContent=old; },1600); },function(){ window.prompt("Redeem data",txt); }); }
    catch(_){ window.prompt("Redeem data",txt); } return; }
  if(act==="check"){ var lbl=b.textContent; b.disabled=true; b.textContent="Checking\\u2026";
    lxBrPeekAttest(hash).then(function(att){
      if(att){ rec.message=att.message; rec.attestation=att.attestation; rec.decodedMessage=att.decodedMessage; rec.status="attested"; lxBrSavePending(rec); lxBrRenderPending(); }
      else { b.disabled=false; b.textContent="Not ready yet"; setTimeout(function(){ b.textContent=lbl; },2200); } }); return; }
  if(act==="mint"){
    var msg=row.querySelector(".lx-brp-msg"), lbl=b.textContent;
    function say(t,err){ if(!msg)return; msg.textContent=t; msg.style.display=t?"":"none"; msg.className="lx-brp-msg"+(err?" err":""); }
    b.disabled=true; b.textContent="Working\\u2026";
    lxEvmMint(rec,function(s){ say(s,false); }).then(function(r){
      if(r.ok===false){ b.disabled=false; b.textContent=lbl; say("The claim transaction reverted on "+r.chain+". Your burn is still valid \\u2014 nothing was lost; try again.",true); return; }
      if(r.ok===null){ b.disabled=false; b.textContent=lbl; say("Submitted, but "+r.chain+" has not confirmed yet. It stays in this list until it does.",false); return; }
      // minted for real: record it, then drop it from pending
      // NB: do NOT add a Recent-transactions row here. lxBrConfirm already added one when the burn landed —
      // this is the same transfer completing, not a new one. (An earlier version appended a second row and,
      // because it used the wrong field names, rendered it as "undefined undefined".)
      b.textContent="Claimed \\u2713";
      if(msg){ msg.className="lx-brp-msg ok"; msg.style.display="";
        msg.innerHTML="Minted on "+lxBrEsc(r.chain)+" \\u2014 "+lxBrEsc(lxBrAmt(rec.netUsdc))+" USDC is now in your wallet. "
          +'<a target="_blank" rel="noopener" href="'+lxBrEsc(r.exp+"/tx/"+r.hash)+'">View transaction</a>'; }
      // leave the confirmation on screen for a moment before the row disappears
      setTimeout(function(){ lxBrClearPending(hash); lxBrRenderPending(); },4500);
    }).catch(function(e){
      b.disabled=false; b.textContent=lbl;
      if(lxAlreadyMinted(e)){   // Circle marks the nonce used once minted — the transfer is already complete
        say("Already claimed on this chain \\u2014 removing it from the list.",false);
        lxBrClearPending(hash); setTimeout(lxBrRenderPending,900); return; }
      var em=(e&&e.message)||"Could not claim";
      // the reassurance only makes sense for failures DURING a claim — not for "you have no wallet installed"
      var selfContained=/No EVM wallet|no account authorised|not wired for this chain|no attestation yet/i.test(em);
      say((e&&e.code===4001)?"Cancelled in your wallet \\u2014 nothing was sent.":(selfContained?em:em+" \\u2014 your burn is untouched, nothing was lost."),true);
    });
    return; }
  if(act==="done"){ if(window.confirm("Remove this transfer from the pending list? Only do this once the USDC has actually been minted on "+lxBrDomName(rec.destDomain)+" \\u2014 the burn hash, message and attestation will be deleted from this browser.")){ lxBrClearPending(hash); lxBrRenderPending(); } return; }
},true);
// a burn whose attestation timed out (or whose tab was closed mid-poll) resolves itself on the next visit
function lxBrResumePending(){ try{
  lxBrListPending().filter(function(x){ return !(x.status==="attested"&&x.attestation); }).slice(0,6).forEach(function(r){
    lxBrPeekAttest(r.burnHash).then(function(att){ if(!att)return;
      r.message=att.message; r.attestation=att.attestation; r.decodedMessage=att.decodedMessage; r.status="attested";
      lxBrSavePending(r); lxBrRenderPending(); }); });
}catch(_){} }
window.lxBrRenderPending=lxBrRenderPending; window.lxBrPeekAttest=lxBrPeekAttest;

// restore persisted bridge transactions into the Recent transactions table on load
(function(){ function fixFrom(){ try{ var rows=document.querySelectorAll('.br-table tbody tr'); for(var i=0;i<rows.length;i++){ var tds=rows[i].querySelectorAll('td'); var ft=tds[1]; if(!ft)continue; var am=ft.querySelector('.am'), ic=ft.querySelector('.br-ic'); if(!am||!ic||ic.__lxfrom)continue; var t=am.textContent||''; var img=/USDC/i.test(t)?'assets/tokens/usdc.png':(/XLM/i.test(t)?'assets/tokens/xlm.png':''); if(!img)continue; ic.__lxfrom=1; ic.innerHTML='<img class="lx-netimg" src="'+img+'" style="width:100%;height:100%;object-fit:cover;display:block" alt="">'; } }catch(_){} }
 // the table half is desktop-only; the pending-claims half has to run wherever the bridge card exists
 function pass(){ var tb=document.querySelector('.br-table tbody'), card=document.querySelector('.br-card')||document.querySelector('.br-wizard');
  if(!tb&&!card) return false;
  if(tb){ lxBrTableCols(); lxBrRestoreTxs(); fixFrom(); setTimeout(fixFrom,500); setTimeout(fixFrom,1200); var _t=document.querySelector('.br-table'); if(_t)_t.classList.add('lx-tbl-ready'); }
  lxBrRenderPending(); lxBrResumePending(); lxRelayPoll(); return true; }
 if(!pass()){ var n=0,iv=setInterval(function(){ n++; if(pass()||n>40) clearInterval(iv); },120); } })();
})();`;

const SCRIPT='<script id="lx-cctp-js">'+BODY+'<'+'/script>';

let n=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain','stellar','xrpl']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      if(!/bridge/.test(k)) continue;
      let h=json[k]; const before=h;
      if(h.indexOf(OLD_SUB)>=0) h=h.split(OLD_SUB).join(NEW_SUB);
      if(h.indexOf(BUGGY_SUB)>=0) h=h.split(BUGGY_SUB).join(NEW_SUB);
      h=h.replace(/<style id="lx-cctp-css">[\s\S]*?<\/style>/,'').replace(/<script id="lx-cctp-js">[\s\S]*?<\/script>/,'');
      if(h.indexOf('</head>')>=0) h=h.replace('</head>',CSS+'</head>');
      const bi=h.lastIndexOf('</body>'); if(bi>=0) h=h.slice(0,bi)+SCRIPT+h.slice(bi);
      if(h!==before){ json[k]=h; n++; }
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('CCTP phase-2 (approve+burn engine, freighter-api fallback) on '+n+' bridge page keys');
