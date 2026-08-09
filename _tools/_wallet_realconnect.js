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
// WalletConnect: paste a free project id from https://cloud.reown.com to enable it.
var WC_PROJECT_ID='';
// WalletConnect v2 flow (SignClient + QR modal). Ready to run as soon as WC_PROJECT_ID is set.
function wcConnect(chain,methods){
  return Promise.all([loadMod('https://esm.sh/@walletconnect/sign-client@2'),loadMod('https://esm.sh/@walletconnect/modal@2')]).then(function(mods){
    var SignClient=mods[0].default||mods[0];var Modal=mods[1].WalletConnectModal||mods[1].default;
    return SignClient.init({projectId:WC_PROJECT_ID,metadata:{name:'LumosCore',description:'Multichain DeFi',url:location.origin,icons:[]}}).then(function(client){
      return client.connect({requiredNamespaces:{stellar:{methods:methods,chains:[chain],events:[]}}}).then(function(res){
        var modal=new Modal({projectId:WC_PROJECT_ID});if(res.uri)modal.openModal({uri:res.uri});
        return res.approval().then(function(session){modal.closeModal();var acct=session.namespaces.stellar.accounts[0];return acct.split(':').pop();},
          function(err){modal.closeModal();throw err;});
      });
    });
  });
}

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
    // LOBSTR signer extension: talks to the extension via its signer-extension-api package.
    lobstr:function(){return loadMod('https://esm.sh/@lobstrco/signer-extension-api').then(function(m){
      var isC=m.isConnected||(m.default&&m.default.isConnected), getPk=m.getPublicKey||(m.default&&m.default.getPublicKey);
      if(!getPk)throw new Error('LOBSTR API failed to load');
      return Promise.resolve(isC?isC():true).then(function(c){if(!c)throw notInstalled('LOBSTR');return getPk();}).then(function(pk){if(!pk)throw notInstalled('LOBSTR');return pk;});});},
    // WalletConnect needs a project id to init the SignClient — gated until one is provided.
    walletconnect:function(){if(!WC_PROJECT_ID)return Promise.reject(needsSetup('WalletConnect needs a free Project ID (cloud.reown.com) \\u2014 add it to enable this option'));
      return wcConnect('stellar:pubnet',['stellar_signXDR','stellar_signAndSubmitXDR']);}
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
function lxHideXbull(){var rows=document.querySelectorAll('.lxw-row');for(var i=0;i<rows.length;i++){var w=(rows[i].getAttribute('data-wallet')||'').toLowerCase().replace(/[^a-z]/g,'');if((w==='xbull'||(w==='walletconnect'&&!WC_PROJECT_ID))&&rows[i].parentNode)rows[i].parentNode.removeChild(rows[i]);}}
// record which network the modal was opened for
var _open=window.lxwOpenWallet;
if(typeof _open==='function'){window.lxwOpenWallet=function(net,home){var n2=(net==='xrp')?'xrpl':(A[net]||net?net:'stellar');window.__lxNet=n2;var ret=_open.apply(this,arguments);var c=0,iv=setInterval(function(){c++;lxHideXbull();if(c>18)clearInterval(iv);},70);return ret;};}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',lxHideXbull);else lxHideXbull();

function q(sel){return document.querySelector(sel);}
function screen(name){var s=document.querySelectorAll('.lxw-screen');for(var i=0;i<s.length;i++){s[i].toggleAttribute('hidden',s[i].getAttribute('data-screen')!==name);}}
function wait(ms){return new Promise(function(r){setTimeout(r,ms);});}
// 3-step progress choreography on the connecting screen. setStep(i): steps < i are done, step i is active.
function stepEls(){return document.querySelectorAll('.lxw-steps .lxw-step');}
function setStep(i){var s=stepEls();for(var k=0;k<s.length;k++){s[k].classList.remove('is-done','is-active');if(k<i)s[k].classList.add('is-done');else if(k===i)s[k].classList.add('is-active');}}
function setConnected(net,row,addr){
  var ic=row.querySelector('.lxw-ico'),nm=row.querySelector('.lxw-name');
  var grad=ic?ic.style.background:'',ih=ic?ic.innerHTML:'',name=nm?nm.textContent:'';
  var ai=q('.lxw-acct-ico');if(ai){ai.style.background=grad;ai.innerHTML=ih;}
  var aa=q('.lxw-acct-addr');if(aa)aa.textContent=trunc(addr);
  var wd=q('.lxw-wnamedone');if(wd)wd.textContent=name;
  var cn=q('.lxw-chipname');if(cn)cn.textContent=NETLABEL[net]||net;
  try{localStorage.setItem('lumos.wallet',name);localStorage.setItem('lumos.network',net);localStorage.setItem('lumos.address',String(addr));}catch(_){}
  if(window.lxnsSetConnected)try{window.lxnsSetConnected(net,name);}catch(_){}
  screen('connected');
}
function showErr(row,err){
  var t=q('.lxw-ctitle'),nm=row.querySelector('.lxw-name'),name=nm?nm.textContent:'wallet';
  var onFile=(location.protocol==='file:');
  var msg;
  if(err&&err.code==='NOT_INSTALLED'){
    msg=onFile?('Open LumosCore over http://localhost \\u2014 wallet extensions can\\u0027t inject into file:// pages'):(name+' not detected \\u2014 install it, then try again');
  } else if(err&&err.code==='NEEDS_SETUP'){ msg=err.message; }
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
  Promise.resolve().then(fn).then(function(addr){
    if(!addr)throw new Error('No address returned');
    clearTimeout(awaitT);setStep(1);
    var el=Date.now()-t0;
    return wait(Math.max(0,900-el))                            // let "Awaiting signature" breathe
      .then(function(){setStep(2);return wait(760);})           // Finalizing
      .then(function(){setStep(3);return wait(200);})           // all done
      .then(function(){setConnected(net,row,addr);});
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
