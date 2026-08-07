// Auth gate: the dashboard + every in-app page is viewable ONLY after connecting a wallet.
//  - Protected pages (everything except landing/signin): a <head> guard redirects to the landing if
//    not connected (runs before body paints, so no flash of the app).
//  - Landing "Launch App" CTA now opens the connect modal (active chain) and lands on the dashboard
//    after connecting, instead of navigating straight in.
// "Connected" = localStorage lumos.wallet/address (set by the real or demo connect flow). Idempotent.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const GUARD='<script id="lx-authgate">(function(){try{if(!(localStorage.getItem("lumos.wallet")||localStorage.getItem("lumos.address")))location.replace("lumoscore-landing.html");}catch(_){}})();</script>';
const OLD_LAUNCH="window.top.lxNavigate(['lumoscore-signin.html','lumoscore-signin-mobile.html'])";
const PREV_LAUNCH="window.lxwOpenWallet((window.lxGetChain&&window.lxGetChain())||'aptos','lumoscore-home.html')";
const NEW_LAUNCH="window.lxChooseNetwork&&window.lxChooseNetwork('lumoscore-home.html')";

let gated=0, rewired=0;
for(const dev of ['desktop','mobile']){
  const file=`lumoscore-aptos-${dev}.html`;
  let data; try{ data=read(file); }catch(e){ continue; }
  const {json,s,e}=getContents(data);
  for(const k of Object.keys(json)){
    let h=json[k];
    h=h.replace(/<script id="lx-authgate">[\s\S]*?<\/script>/,''); // idempotent
    const isPublic=/landing|signin/.test(k);
    if(isPublic){
      if(/landing/.test(k)){
        if(h.indexOf(OLD_LAUNCH)>=0){ h=h.split(OLD_LAUNCH).join(NEW_LAUNCH); rewired++; }
        if(h.indexOf(PREV_LAUNCH)>=0){ h=h.split(PREV_LAUNCH).join(NEW_LAUNCH); rewired++; }
      }
    } else {
      if(h.indexOf('</head>')>=0){ h=h.replace('</head>', GUARD+'</head>'); gated++; }
      else { const bi=h.indexOf('<body'); if(bi>=0){ const gt=h.indexOf('>',bi)+1; h=h.slice(0,gt)+GUARD+h.slice(gt); gated++; } }
    }
    json[k]=h;
  }
  const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
  fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
}
console.log('auth gate: protected pages='+gated+' | landing Launch-App rewired='+rewired);
