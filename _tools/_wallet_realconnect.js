// REAL wallet connection (extension wallets, vanilla JS — no bundler).
// Intercepts the connect-modal wallet-row click (capture phase, blocks the mock flow for supported
// wallets), runs the wallet's injected-provider adapter, and shows/persists the REAL address in the
// existing modal screens. Unsupported wallets (Hedera/HashConnect, WalletConnect, Xaman, GemWallet…)
// fall through to the demo flow until a WalletConnect Project ID is wired.
// Adapters use each wallet's window-injected API; verified against current docs where possible, but
// APIs are version-sensitive — test with the real extensions and tweak the one-liners as needed.
// Idempotent. Injected into every page that has window.lxwOpenWallet.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const SCRIPT=`<style id="lx-realconnect-css">.lxw-cwallet-ico,.lxw-acct-ico{position:relative;overflow:hidden}.lxw-cwallet-ico .lx-wimg,.lxw-acct-ico .lx-wimg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit}`
+`.lxw-step{transition:background .28s ease,border-color .28s ease,color .28s ease}`
+`.lxw-step.is-done{color:var(--text,#fff)!important;border-color:rgba(52,192,127,.55)!important;background:rgba(52,192,127,.13)!important}`
+`.lxw-step.is-done::after{content:"\\2713";margin-left:auto;color:#35c07f;font-weight:800;font-size:13px;line-height:1}`
+`</style><script id="lx-realconnect">(function(){
if(window.__lxReal)return;window.__lxReal=true;
var NETLABEL={aptos:'Aptos',hedera:'Hedera',starknet:'Starknet',vechain:'VeChain',worldchain:'World Chain',stellar:'Stellar',xrpl:'XRP Ledger'};
function trunc(a){a=String(a||'');if(a.length<=14)return a;return a.slice(0,6)+'\\u2026'+a.slice(-4);}
function notInstalled(name){var e=new Error(name+' is not installed');e.code='NOT_INSTALLED';return e;}
function first(v){return (v&&v[0]!==undefined&&v.length!==undefined)?v[0]:v;}
// Some extensions inject their provider a tick after load — poll briefly before giving up.
function waitFor(get,ms){return new Promise(function(res){var t0=Date.now();(function tick(){var v;try{v=get();}catch(_){v=null;}if(v)return res(v);if(Date.now()-t0>=ms)return res(null);setTimeout(tick,60);})();});}
// Dynamic ESM loader (cached) for web/SDK wallets that aren't simple window globals (Albedo, LOBSTR).
var _mods={};function loadMod(u){return _mods[u]||(_mods[u]=import(u));}
function needsSetup(msg){var e=new Error(msg);e.code='NEEDS_SETUP';return e;}
// WalletConnect: paste a free project id from https://cloud.reown.com between the quotes to enable it.
// It is a PUBLIC client identifier and ships in this page's JS by design, so it is not a secret — but
// do restrict it to lumoscore.com in the Reown dashboard so nobody else can spend the relay quota.
// While it is empty EVERY WalletConnect path stays off and the extension-only behaviour is unchanged.
// PUBLIC client identifier, not a secret: it ships in the page js and is designed to be readable.
// Lock it down by allowed domain in the Reown dashboard rather than by trying to hide it.
var WC_PROJECT_ID='8ef28ece795a0868371b0e5fd6cc76ad';
var WC_CHAIN='stellar:pubnet';
var WC_METHODS=['stellar_signXDR','stellar_signAndSubmitXDR'];
// LOBSTR's registered WalletConnect link. The NATIVE scheme is used, not the https universal link
// (https://lobstr.co/uni/wc): an unhandled custom scheme leaves the page exactly where it is, whereas
// an unhandled universal link NAVIGATES to lobstr.co and takes the pending connect/sign promise with it.
var WC_LOBSTR='lobstr://wc';
function isMobile(){return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'');}
function wcPoke(link,uri){try{location.href=link+(uri?('?uri='+encodeURIComponent(uri)):'');}catch(_){}}
// Getting as far as a pairing URI must not be able to hang. A bad or unreachable relay leaves
// SignClient.init pending forever, and the connect modal would sit on "Confirming with <wallet>" with
// no error and no way back. This bounds ONLY the handshake — never res.approval(), where the user is
// legitimately taking their time in their wallet.
function wcTimeout(p,ms,msg){return new Promise(function(res,rej){var done=false;
  var to=setTimeout(function(){if(!done){done=true;var e=new Error(msg);e.code='SHOW_MSG';rej(e);}},ms);
  p.then(function(v){if(!done){done=true;clearTimeout(to);res(v);}},function(e){if(!done){done=true;clearTimeout(to);rej(e);}});});}
// One SignClient per page, created lazily. Cleared on failure so a retry can rebuild it.
var _wcClient=null;
function wcClient(){
  if(!WC_PROJECT_ID)return Promise.reject(needsSetup('WalletConnect needs a free Project ID (cloud.reown.com) \\u2014 add it to enable this option'));
  if(!_wcClient)_wcClient=wcTimeout(loadMod('https://esm.sh/@walletconnect/sign-client@2').then(function(m){
    var SignClient=m.default||m.SignClient||m;
    return SignClient.init({projectId:WC_PROJECT_ID,metadata:{name:'LumosCore',description:'Multichain DeFi',url:location.origin,icons:[]}});
  }),20000,'Could not reach WalletConnect \\u2014 check your connection and try again').catch(function(e){_wcClient=null;throw e;});
  return _wcClient;
}
function wcAddr(s){var a=s&&s.namespaces&&s.namespaces.stellar&&s.namespaces.stellar.accounts&&s.namespaces.stellar.accounts[0];
  if(!a)throw new Error('WalletConnect returned no Stellar account');return String(a).split(':').pop();}
// WalletConnect v2 connect. The modal is always opened: it carries the QR that desktop needs AND, on a
// phone, a per-wallet "Open" button whose deep link comes from the registry and is tapped by the user,
// so it is never popup-blocked. On a phone we ALSO poke the wallet directly so the usual case is zero
// extra taps, and the modal is just the fallback if that poke goes nowhere.
function wcConnect(deepLink){
  return wcClient().then(function(client){
    return wcTimeout(client.connect({requiredNamespaces:{stellar:{methods:WC_METHODS,chains:[WC_CHAIN],events:[]}}}),20000,'WalletConnect did not respond \\u2014 try again').then(function(res){
      if(res.uri&&deepLink&&isMobile())wcPoke(deepLink,res.uri);
      return loadMod('https://esm.sh/@walletconnect/modal@2').then(function(mm){
        var Modal=mm.WalletConnectModal||mm.default;
          // WalletConnect Modal defaults to z-index 89. Our own connect modal sits at 100000, so the
          // pairing UI opened UNDERNEATH it and could not be tapped. Lift it above everything, and
          // set the host element too in case the theme variable is ignored by a future version.
          var md=new Modal({projectId:WC_PROJECT_ID,themeVariables:{"--wcm-z-index":"2147483000"}});
        if(res.uri)md.openModal({uri:res.uri});
          try{setTimeout(function(){var el=document.querySelector("wcm-modal,w3m-modal");if(el)el.style.zIndex="2147483000";},60);}catch(_){}
          return md;
      },function(){return null;}).then(function(md){
        var close=function(){if(md){try{md.closeModal();}catch(_){}}};
        return res.approval().then(function(session){close();
          try{localStorage.setItem('lumos.wcTopic',session.topic);}catch(_){}
          return wcAddr(session);},function(err){close();throw err;});
      });
    });
  });
}

// --- WalletConnect SIGNING -----------------------------------------------------------------------
// Exposed as globals because signing happens on other pages entirely (Trade, Pools, Bridge, Launch,
// LUMOS, Wallet), each with its own data layer. Sessions live in WalletConnect's own storage, so
// re-initialising the client on a later page restores them; lumos.wcTopic records WHICH one is ours.
function wcSession(){
  return wcClient().then(function(client){
    var topic='';try{topic=localStorage.getItem('lumos.wcTopic')||'';}catch(_){}
    var all=[];try{all=client.session.getAll()||[];}catch(_){}
    var s=null;for(var i=0;i<all.length;i++){if(all[i]&&all[i].topic===topic)s=all[i];}
    if(!s)throw new Error('Your WalletConnect session has expired \\u2014 connect your wallet again.');
    return {client:client,session:s};
  });
}
// True ONLY for a wallet currently connected over WalletConnect. A missing or different value means the
// extension path — which is what every session created before this existed has — so nothing that already
// works changes. Disconnect removes lumos.wallet, which turns this off on its own.
// ---- SEP-0007 transport (LOBSTR mobile, no WalletConnect) -------------------------------------
// LOBSTR registers the web+stellar: scheme on mobile, verified on a real device. That gives a route
// that needs no WalletConnect relay and no Reown project id.
// Two halves, because SEP-7 only covers SIGNING:
//   connect - SEP-7 has no way to return an address, so the user supplies their public key. This is
//             identity only: it proves nothing and grants nothing. Every state-changing action still
//             has to be approved inside LOBSTR, so a wrong or hostile address can only mislead the
//             person who typed it, never move funds.
//   sign    - the tx hash is computed BEFORE signing (signing does not change it), LOBSTR is handed
//             the xdr and signs AND SUBMITS it itself, and we poll Horizon for that hash. Once it
//             lands we return the envelope_xdr, so the seven existing signing paths submit it as
//             usual. Horizon returns the original result for a duplicate submission, so that second
//             submit is a harmless no-op and none of those transforms needed changing.
var SEP7_HORIZON='https://horizon.stellar.org';
var _sbP=null;
function lxSbase(){ if(_sbP)return _sbP; _sbP=new Promise(function(res,rej){
  if(window.StellarBase)return res(window.StellarBase);
  var el=document.createElement('script');
  el.src='https://cdn.jsdelivr.net/npm/@stellar/stellar-base@13.0.1/dist/stellar-base.min.js';
  el.onload=function(){ window.StellarBase?res(window.StellarBase):rej(new Error('Stellar SDK failed to load')); };
  el.onerror=function(){ rej(new Error('Stellar SDK failed to load')); };
  document.head.appendChild(el); }); return _sbP; }
function lxIsMobile(){ return /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent||''); }
function lxSep7Supported(){ return lxIsMobile(); }
// G... StrKey, 56 chars. Cheap shape check first, then the SDK confirms the checksum, then Horizon
// confirms the account actually exists - a typo that survives the checksum still gets caught.
function lxValidAddr(a){ return /^G[A-Z2-7]{55}$/.test(String(a||'').trim()); }
function lxSep7Connect(){
  return new Promise(function(resolve,reject){
    var modal=document.querySelector('.lxw-modal'); if(!modal)return reject(new Error('modal missing'));
    var scr=modal.querySelector('.lxw-screen[data-screen="sep7addr"]');
    if(!scr){
      scr=document.createElement('div');
      scr.className='lxw-screen'; scr.setAttribute('data-screen','sep7addr'); scr.setAttribute('data-lx-noswap','');
      scr.innerHTML='<div class="lxw-head"><div class="lxw-htitles"><h3 class="lxw-title">Connect LOBSTR</h3>'
        +'<p class="lxw-sub">Paste your Stellar address. You approve every transaction in the LOBSTR app.</p></div></div>'
        +'<div style="padding:4px 20px 20px">'
        +'<input class="lxw-searchin lx-s7in" type="text" inputmode="verbatim" autocapitalize="characters" spellcheck="false" placeholder="G..." style="width:100%;box-sizing:border-box;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px">'
        +'<div class="lx-s7err" style="min-height:18px;margin:8px 2px 0;font-size:12.5px;color:#ff6b6b"></div>'
        +'<button type="button" class="lx-s7go" style="width:100%;margin-top:10px;padding:13px 16px;border:0;border-radius:12px;background:var(--accent,#ea6a2c);color:#fff;font-weight:700;font-size:14px;cursor:pointer">Continue</button>'
        +'<p style="margin:14px 2px 0;font-size:12px;line-height:1.5;color:var(--text-soft,#8a8fa3)">Open LOBSTR, tap your account and copy the address. This only tells LumosCore which account to display - it cannot move funds.</p>'
        +'</div>';
      modal.appendChild(scr);
    }
    var inp=scr.querySelector('.lx-s7in'), go=scr.querySelector('.lx-s7go'), er=scr.querySelector('.lx-s7err');
    er.textContent=''; inp.value='';
    screen('sep7addr');
    setTimeout(function(){ try{inp.focus();}catch(_){} },60);
    var busy=false;
    function fail(m){ er.textContent=m; go.disabled=false; go.style.opacity=''; busy=false; }
    function submit(){
      if(busy)return; var a=String(inp.value||'').trim().toUpperCase();
      if(!lxValidAddr(a))return fail('That is not a Stellar address - it should start with G and be 56 characters.');
      busy=true; go.disabled=true; go.style.opacity='.6'; er.textContent='';
      lxSbase().then(function(SB){
        try{ SB.Keypair.fromPublicKey(a); }catch(_){ throw new Error('checksum'); }
        return fetch(SEP7_HORIZON+'/accounts/'+a).then(function(r){
          if(r.status===404)throw new Error('missing');
          if(!r.ok)throw new Error('horizon');
          return a;
        });
      }).then(function(addr){
        try{ localStorage.setItem('lumos.transport','sep7'); }catch(_){}
        resolve(addr);
      }).catch(function(e){
        var m=(e&&e.message)||'';
        if(m==='checksum')return fail('That address has a typo - the checksum does not match.');
        if(m==='missing') return fail('No account with that address exists on Stellar mainnet yet.');
        return fail('Could not reach Stellar to check that address. Try again.');
      });
    }
    go.onclick=submit;
    inp.onkeydown=function(e){ if(e.key==='Enter')submit(); };
  });
}
// Hand the xdr to LOBSTR and wait for the network, not for the app - there is no return channel.
function lxSep7Sign(xdr,passphrase){
  return lxSbase().then(function(SB){
    var net=passphrase||SB.Networks.PUBLIC;
    var hash;
    try{ hash=new SB.Transaction(xdr,net).hash().toString('hex'); }
    catch(e){ throw new Error('Could not read that transaction'); }
    var link='web+stellar:tx?xdr='+encodeURIComponent(xdr)+'&msg='+encodeURIComponent('LumosCore');
    try{ window.location.href=link; }catch(_){}
    // Poll for the hash. Signing does not change it, so this is the same transaction LOBSTR submits.
    var tries=0, MAX=72;   // 72 x 2.5s = 3 minutes to approve in the app
    return new Promise(function(res,rej){
      (function tick(){
        tries++;
        fetch(SEP7_HORIZON+'/transactions/'+hash).then(function(r){
          if(r.status===200)return r.json().then(function(tx){
            if(tx&&tx.envelope_xdr)return res(tx.envelope_xdr);
            rej(new Error('Signed, but the transaction could not be read back'));
          });
          if(tries>=MAX){ var e=new Error('No approval received - open LOBSTR, approve the request, then try again'); e.code='SHOW_MSG'; return rej(e); }
          setTimeout(tick,2500);
        }).catch(function(){
          if(tries>=MAX){ var e2=new Error('Lost contact with Stellar while waiting for approval'); e2.code='SHOW_MSG'; return rej(e2); }
          setTimeout(tick,2500);
        });
      })();
    });
  });
}
// The LOBSTR MOBILE APP route: ask for the address, then every signature goes out over the
// web+stellar: deep link. Nothing here touches the browser extension.
function lxLobstrApp(){
  return lxSep7Connect().then(function(a){ return {address:a,transport:'sep7'}; });
}
window.__lxSep7Active=function(){ try{ return (localStorage.getItem('lumos.transport')||'')==='sep7'; }catch(_){ return false; } };
window.__lxWcActive=function(){try{
  if((localStorage.getItem('lumos.transport')||'')==='sep7')return true;
  return !!WC_PROJECT_ID&&(localStorage.getItem('lumos.transport')||'')==='wc'
    &&!!localStorage.getItem('lumos.wallet')&&!!localStorage.getItem('lumos.wcTopic');
}catch(_){return false;}};
window.__lxWcSign=function(xdr,passphrase){
  // sep7 is a separate transport behind the same entry point, so the seven signing paths that call
  // __lxWcSign need no changes at all.
  if(window.__lxSep7Active&&window.__lxSep7Active())return lxSep7Sign(xdr,passphrase);
  var chain=(String(passphrase||'').indexOf('Test Network')>=0)?'stellar:testnet':WC_CHAIN;
  return wcSession().then(function(cs){
    // Refuse rather than sign against a network this session never approved.
    var accs=(cs.session.namespaces&&cs.session.namespaces.stellar&&cs.session.namespaces.stellar.accounts)||[];
    var ok=false;for(var i=0;i<accs.length;i++){if(String(accs[i]).indexOf(chain+':')===0)ok=true;}
    if(!ok)throw new Error('This WalletConnect session cannot sign on '+chain.split(':')[1]+' \\u2014 reconnect your wallet.');
    // The request travels over the relay, and on a phone the user is looking at the browser, not at the
    // wallet, so nothing would prompt them to approve it. Poke the app forward; harmless if already open.
    var wn='';try{wn=(localStorage.getItem('lumos.wallet')||'').toLowerCase();}catch(_){}
    if(isMobile()&&wn.indexOf('lobstr')>=0)wcPoke(WC_LOBSTR,'');
    return cs.client.request({topic:cs.session.topic,chainId:chain,request:{method:'stellar_signXDR',params:{xdr:xdr}}});
  }).then(function(r){
    var s=(r&&(r.signedXDR||r.signedTxXdr||r.xdr))||(typeof r==='string'?r:null);
    if(!s||typeof s!=='string')throw new Error('Your wallet did not return a signed transaction');
    return s;
  });
};

// EVM helper (World Chain = EVM, chainId 480 / 0x1e0)
function pickEvm(flag){var e=window.ethereum;if(e&&e.providers&&e.providers.length){for(var i=0;i<e.providers.length;i++){if(e.providers[i]&&e.providers[i][flag])return e.providers[i];}}if(e)return e;return window.coinbaseWalletExtension||null;}
function evm(flag,label){return function(){var p=pickEvm(flag);if(!p)return Promise.reject(notInstalled(label));
  return p.request({method:'eth_requestAccounts'}).then(function(acc){
    return p.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x1e0'}]}).catch(function(){}).then(function(){return first(acc);});});};}
// Starknet helper
function sn(key,label){return function(){var w=window[key]||window.starknet;if(!w)return Promise.reject(notInstalled(label));
  return Promise.resolve().then(function(){return w.request?w.request({type:'wallet_requestAccounts'}):null;})
    .then(function(acc){if(acc&&acc[0])return acc[0];return Promise.resolve(w.enable&&w.enable()).then(function(){return w.selectedAddress||(w.account&&w.account.address);});})
    .catch(function(){return Promise.resolve(w.enable&&w.enable()).then(function(){return w.selectedAddress||(w.account&&w.account.address);});});};}

var A={
  aptos:{
    petra:function(){if(!window.aptos)return Promise.reject(notInstalled('Petra'));return Promise.resolve(window.aptos.connect()).then(function(r){return r&&(r.address||r);});},
    martian:function(){if(!window.martian)return Promise.reject(notInstalled('Martian'));return Promise.resolve(window.martian.connect()).then(function(r){return r&&(r.address||r);});},
    pontem:function(){if(!window.pontem)return Promise.reject(notInstalled('Pontem'));return Promise.resolve(window.pontem.connect()).then(function(r){return r&&(r.address||r);});}
  },
  stellar:{
    freighter:function(){
      // Older Freighter injects window.freighterApi; Freighter v6+ has no reliable page global and
      // must be reached through the messaging-based @stellar/freighter-api package. Try the fast
      // global path (~0.5s), else load the official package and use its messaging API.
      return waitFor(function(){return window.freighterApi;},500).then(function(f){
        if(f&&(f.requestAccess||f.getAddress||f.getPublicKey)){
          return Promise.resolve(f.setAllowed?f.setAllowed():null).catch(function(){}).then(function(){
            return f.requestAccess?f.requestAccess():(f.getAddress?f.getAddress():f.getPublicKey());
          }).then(function(r){if(r&&r.error)throw new Error((r.error&&r.error.message)||r.error);return r&&(r.address||r.publicKey||r);});
        }
        return loadMod('https://esm.sh/@stellar/freighter-api@6').then(function(m){
          var api=m.default||{};
          var isConnected=m.isConnected||api.isConnected, requestAccess=m.requestAccess||api.requestAccess, getAddress=m.getAddress||api.getAddress, setAllowed=m.setAllowed||api.setAllowed;
          if(!requestAccess)throw new Error('Freighter API failed to load');
          return Promise.resolve(isConnected?isConnected():{isConnected:true}).then(function(c){
            if(c&&c.isConnected===false)throw notInstalled('Freighter');
            return Promise.resolve(setAllowed?setAllowed():null).catch(function(){});
          }).then(function(){return requestAccess();}).then(function(r){
            if(r&&r.error)throw new Error((r.error&&r.error.message)||r.error);
            var a=r&&(r.address||r.publicKey);if(a)return a;
            if(getAddress)return getAddress().then(function(g){if(g&&g.error)throw new Error((g.error&&g.error.message)||g.error);return g&&(g.address||g);});
            throw notInstalled('Freighter');
          });
        });
      });
    },
    rabet:function(){return waitFor(function(){return window.rabet;},1800).then(function(r){if(!r)throw notInstalled('Rabet');
      return Promise.resolve(r.connect()).then(function(x){if(x&&x.error)throw new Error((x.error&&x.error.message)||x.error);return x&&(x.publicKey||x.address||x);});});},
    xbull:function(){return waitFor(function(){return window.xBullSDK;},1800).then(function(x){if(!x)throw notInstalled('xBull');
      return Promise.resolve(x.connect?x.connect({canRequestPublicKey:true,canRequestSign:true}):null).catch(function(){}).then(function(){return x.getPublicKey?x.getPublicKey():null;}).then(function(pk){return pk&&(pk.publicKey||pk);});});},
    // Albedo is a web wallet (no extension): its SDK opens a popup to albedo.link and returns the pubkey.
    albedo:function(){return loadMod('https://esm.sh/@albedo-link/intent@0.12.0').then(function(m){var al=m.default||m.albedo||m;
      if(!al||!al.publicKey)throw new Error('Albedo SDK failed to load');
      return al.publicKey({}).then(function(r){var a=r&&(r.pubkey||r.publicKey||r.address);if(!a)throw new Error('No address returned');return a;});});},
    // LOBSTR is a signer EXTENSION on desktop and a MOBILE APP that speaks WalletConnect. This used to
    // load the extension package and nothing else, so every phone was told "LOBSTR not detected" while
    // the row promised "Mobile & web". Now: extension when it is actually there, WalletConnect when it
    // is not. Detection is separated from the call so that a user REJECTING the extension surfaces as a
    // rejection instead of silently escalating into a QR modal.
    lobstr:function(){return loadMod('https://esm.sh/@lobstrco/signer-extension-api').then(function(m){
      var isC=m.isConnected||(m.default&&m.default.isConnected), getPk=m.getPublicKey||(m.default&&m.default.getPublicKey);
      if(!getPk)return null;
      return Promise.resolve(isC?isC():true).then(function(c){return c?getPk:null;},function(){return null;});
    },function(){return null;}).then(function(getPk){
      // MOBILE FIRST. On a phone LOBSTR is an APP reached by the web+stellar: deep link, not an
      // extension — so try that before anything extension-shaped. This ordering is the fix: the
      // extension module loads fine from the CDN on a phone (it is just javascript), so getPk exists
      // there even with no extension present, and the old code threw notInstalled from inside that
      // branch. Mobile therefore reported 'LOBSTR not detected' without ever trying the app.
      if(lxSep7Supported()){
        // WalletConnect first: it opens the LOBSTR app and hands back the address, no typing. SEP-7
        // cannot do that - it has no way to return an address - so it is only the fallback for a
        // build with no project id.
        if(WC_PROJECT_ID)return wcConnect(WC_LOBSTR).then(function(a){return {address:a,transport:'wc'};});
        return lxLobstrApp();
      }
      // Desktop: real extension, else WalletConnect if a project id is configured.
      if(getPk)return Promise.resolve(getPk()).then(function(pk){
        return pk?{address:pk,transport:'ext'}:null;
      },function(){return null;}).then(function(r){
        if(r)return r;
        if(WC_PROJECT_ID)return wcConnect(WC_LOBSTR).then(function(a){return {address:a,transport:'wc'};});
        throw notInstalled('LOBSTR');
      });
      if(WC_PROJECT_ID)return wcConnect(WC_LOBSTR).then(function(a){return {address:a,transport:'wc'};});
      throw notInstalled('LOBSTR');
    });},
    // WalletConnect needs a project id to init the SignClient — gated until one is provided.
    walletconnect:function(){if(!WC_PROJECT_ID)return Promise.reject(needsSetup('WalletConnect needs a free Project ID (cloud.reown.com) \\u2014 add it to enable this option'));
      return wcConnect(null).then(function(a){return {address:a,transport:'wc'};});}
  },
  starknet:{argent:sn('starknet_argentX','Argent'),braavos:sn('starknet_braavos','Braavos')},
  vechain:{
    veworld:function(){var v=window.vechain;if(!v)return Promise.reject(notInstalled('VeWorld'));
      // best-effort; robust VeChain connect normally uses @vechain/dapp-kit (Connex certificate)
      if(v.request)return Promise.resolve(v.request({method:'eth_requestAccounts'})).then(first);
      return Promise.reject(new Error('VeWorld connect needs DAppKit'));}
  },
  worldchain:{metamask:evm('isMetaMask','MetaMask'),'coinbase wallet':evm('isCoinbaseWallet','Coinbase Wallet'),rainbow:evm('isRainbow','Rainbow')},
  xrpl:{
    crossmark:function(){var c=window.crossmark;if(!c)return Promise.reject(notInstalled('Crossmark'));
      var m=(c.async&&c.async.signInAndWait)?c.async:(c.methods&&c.methods.signInAndWait?c.methods:c);
      return Promise.resolve(m.signInAndWait()).then(function(r){var d=r&&((r.response&&r.response.data)||r.response||r.data||r);return d&&(d.address||d.account||d);});}
  }
};

// Hide wallets that can't work here: xBull (its extension mis-handles liquidity-pool / local-submit txs)
// and WalletConnect while no Project ID is configured (it can't connect without one). WalletConnect
// re-appears automatically once WC_PROJECT_ID is set. These only appear for Stellar.
// On a phone, only wallets that can actually connect there belong in the list. LOBSTR reaches its
// MOBILE APP over WalletConnect; Albedo is a hosted web wallet and needs no install. Freighter,
// Rabet and xBull are browser extensions with no mobile browser equivalent, so offering them on a
// phone can only end in 'not detected'. Section headings whose rows all disappear are removed too,
// otherwise POPULAR sits above nothing.
function lxMobileOnlyWallets(){
  if(!/Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent||''))return;
  // Stellar only. XRP Ledger offers Gem/Xaman/Crossmark, which are mobile wallets in their own right,
  // and blanket-filtering would leave that list empty on a phone.
  if((window.__lxNet||"stellar")!=="stellar")return;
  // WalletConnect is kept as the generic option: it shows a pairing prompt any WalletConnect-capable
  // Stellar wallet can answer, so someone whose wallet is not LOBSTR still has a route on mobile.
  var KEEP={lobstr:1,albedo:1,walletconnect:1};
  var rows=document.querySelectorAll('.lxw-row[data-wallet]');
  for(var i=0;i<rows.length;i++){
    var w=(rows[i].getAttribute('data-wallet')||'').toLowerCase().replace(/[^a-z]/g,'');
    if(!KEEP[w]&&rows[i].parentNode)rows[i].parentNode.removeChild(rows[i]);
  }
  // Each section is a .lxw-group wrapper holding a .lxw-section label and its rows, so an orphaned
  // heading is simply a group with no rows left in it.
  var groups=document.querySelectorAll('.lxw-modal .lxw-group');
  for(var j=0;j<groups.length;j++){
    if(!groups[j].querySelector('.lxw-row')&&groups[j].parentNode)groups[j].parentNode.removeChild(groups[j]);
  }
}
function lxHideXbull(){var rows=document.querySelectorAll('.lxw-row');for(var i=0;i<rows.length;i++){var w=(rows[i].getAttribute('data-wallet')||'').toLowerCase().replace(/[^a-z]/g,'');if((w==='xbull'||(w==='walletconnect'&&!WC_PROJECT_ID))&&rows[i].parentNode)rows[i].parentNode.removeChild(rows[i]);}}
// record which network the modal was opened for
var _open=window.lxwOpenWallet;
if(typeof _open==='function'){window.lxwOpenWallet=function(net,home){var n2=(net==='xrp')?'xrpl':(A[net]||net?net:'stellar');window.__lxNet=n2;var ret=_open.apply(this,arguments);var c=0,iv=setInterval(function(){c++;lxHideXbull();lxMobileOnlyWallets();if(c>18)clearInterval(iv);},70);return ret;};}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){lxHideXbull();lxMobileOnlyWallets();});else lxHideXbull();lxMobileOnlyWallets();

function q(sel){return document.querySelector(sel);}
function screen(name){var s=document.querySelectorAll('.lxw-screen');for(var i=0;i<s.length;i++){s[i].toggleAttribute('hidden',s[i].getAttribute('data-screen')!==name);}}
function wait(ms){return new Promise(function(r){setTimeout(r,ms);});}
// 3-step progress choreography on the connecting screen. setStep(i): steps < i are done, step i is active.
function stepEls(){return document.querySelectorAll('.lxw-steps .lxw-step');}
function setStep(i){var s=stepEls();for(var k=0;k<s.length;k++){s[k].classList.remove('is-done','is-active');if(k<i)s[k].classList.add('is-done');else if(k===i)s[k].classList.add('is-active');}}
function setConnected(net,row,addr,transport){
  var ic=row.querySelector('.lxw-ico'),nm=row.querySelector('.lxw-name');
  var grad=ic?ic.style.background:'',ih=ic?ic.innerHTML:'',name=nm?nm.textContent:'';
  var ai=q('.lxw-acct-ico');if(ai){ai.style.background=grad;ai.innerHTML=ih;}
  var aa=q('.lxw-acct-addr');if(aa)aa.textContent=trunc(addr);
  var wd=q('.lxw-wnamedone');if(wd)wd.textContent=name;
  var cn=q('.lxw-chipname');if(cn)cn.textContent=NETLABEL[net]||net;
  // lumos.transport tells the signing paths WHICH LOBSTR to talk to on this device. Always written, so
  // reconnecting with the extension can never inherit a stale 'wc' from an earlier phone session.
  try{localStorage.setItem('lumos.wallet',name);localStorage.setItem('lumos.network',net);localStorage.setItem('lumos.address',String(addr));localStorage.setItem('lumos.transport',transport||'ext');}catch(_){}
  if(window.lxnsSetConnected)try{window.lxnsSetConnected(net,name);}catch(_){}
  screen('connected');
// lxPostConnectHome: land on the dashboard after connecting from anywhere in the app. Connecting is
// the gateway into the product, so leaving someone on the read-only page they happened to be browsing
// strands them one step short of what they just enabled. Short delay so 'Connected' is actually seen.
// Skipped on the dashboard (already there) and on /wallet, where the page you are on IS what
// connecting unlocks and bouncing away would be perverse.
function lxPostConnectHome(){try{var _p=location.pathname||'';
  if(/dashboard|lumoscore-home|wallet/.test(_p))return;
  setTimeout(function(){
    try{ if(window.__lxNav){window.__lxNav('lumoscore-home.html');return;} }catch(_){}
    try{ location.href='/dashboard'; }catch(_){}
  },1100);}catch(_){}}
lxPostConnectHome();
}
function showErr(row,err){
  var t=q('.lxw-ctitle'),nm=row.querySelector('.lxw-name'),name=nm?nm.textContent:'wallet';
  var onFile=(location.protocol==='file:');
  var msg;
  var lxMobileHint=/Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent||'');
    if(err&&err.code==='NOT_INSTALLED'&&lxMobileHint){
      msg=name+' is a desktop browser extension \u2014 on mobile, connect with Albedo';
    } else if(err&&err.code==='NOT_INSTALLED'){
    msg=onFile?('Open LumosCore over http://localhost \\u2014 wallet extensions can\\u0027t inject into file:// pages'):(name+' not detected \\u2014 install it, then try again');
  } else if(err&&(err.code==='NEEDS_SETUP'||err.code==='SHOW_MSG')){ msg=err.message; }
  else { msg=name+' connection failed or was rejected'; }
  if(t){t.textContent=msg;t.style.color='#ff6b6b';}
  setTimeout(function(){if(t)t.style.color='';screen('wallet');},onFile?4200:2600);
}

// WINDOW, not document, for CAPTURE ORDER. Capture runs outermost-first (window -> document ->
// target), so a document-capture listener the design registered earlier won the click and ran its
// DEMO connect, which navigates. Symptom: clicking a wallet reloaded the page in under 350ms —
// before this connector's 1800ms detection wait — and the "Confirming with <wallet>" screen never
// appeared, because the real handler never received the event at all. Binding on window puts us
// ahead of it, so the stopImmediatePropagation below actually suppresses the demo flow.
window.addEventListener('click',function(e){
  var row=e.target&&e.target.closest?e.target.closest('.lxw-row'):null;if(!row)return;
  // Network rows share the .lxw-row class but carry data-lxnet instead of data-wallet. Without this
        // they fell through to the design's demo listener, which navigates — picking a network reloaded
        // the page and destroyed the modal. Claim them here and drive the real chain switch + wallet list.
        var netId=row.getAttribute('data-lxnet');
        if(netId){e.preventDefault();e.stopImmediatePropagation();
          try{if(window.lxSetChain)window.lxSetChain(netId);}catch(_){}
          try{if(window.lxwOpenWallet)window.lxwOpenWallet(netId);}catch(_){}
          return;}
        var id=(row.getAttribute('data-wallet')||'').toLowerCase();if(!id)return;
  var net=window.__lxNet||'stellar';
  var ad=A[net];var fn=ad&&(ad[id]||ad[id.replace(/[^a-z]/g,'')]);
  if(!fn)return; // unsupported wallet -> let the existing demo flow run
  e.preventDefault();e.stopImmediatePropagation();
  var ic=row.querySelector('.lxw-ico'),nm=row.querySelector('.lxw-name'),name=nm?nm.textContent:id;
  var ci=q('.lxw-cwallet-ico');if(ci&&ic){ci.style.background=ic.style.background;ci.innerHTML=ic.innerHTML;}
  var t=q('.lxw-ctitle');if(t){t.textContent='Confirming with '+name;t.style.color='';}
  screen('connecting');
  // Smooth 3-step choreography. The wallet call starts immediately (so the extension opens right
  // away); "Awaiting signature" shows while the user approves; once the address arrives we play a
  // graceful Finalizing beat before "Connected" — with a floor so an instant resolve isn't a flash,
  // and no artificial padding when the user actually took a while to approve.
  setStep(0);
  var t0=Date.now();
  var awaitT=setTimeout(function(){setStep(1);},520);          // Opening -> Awaiting after a beat
  // Adapters return either a plain address string or {address,transport} when the transport matters
  // (LOBSTR resolves to the extension on desktop and to WalletConnect on a phone).
  Promise.resolve().then(fn).then(function(res){
    var addr=(res&&res.address)?res.address:res, tr=(res&&res.transport)||'ext';
    if(!addr)throw new Error('No address returned');
    clearTimeout(awaitT);setStep(1);
    var el=Date.now()-t0;
    return wait(Math.max(0,900-el))                            // let "Awaiting signature" breathe
      .then(function(){setStep(2);return wait(760);})           // Finalizing
      .then(function(){setStep(3);return wait(200);})           // all done
      .then(function(){setConnected(net,row,addr,tr);});
  }).catch(function(err){clearTimeout(awaitT);showErr(row,err);});
},true);
})();</script>`;

let n=0, files=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain','stellar','xrpl']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    files++;
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k];
      if(h.indexOf('window.lxwOpenWallet=')<0) continue;
      h=h.replace(/<style id="lx-realconnect-css">[\s\S]*?<\/style>/,'').replace(/<script id="lx-realconnect">[\s\S]*?<\/script>/,'');
      const bi=h.lastIndexOf('</body>'); if(bi<0) continue;
      json[k]=h.slice(0,bi)+SCRIPT+h.slice(bi); n++;
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('real wallet connect injected on '+n+' pages across '+files+' files');
