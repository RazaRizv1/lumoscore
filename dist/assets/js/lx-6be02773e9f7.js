(function(){
  var MAP={"albedo":"/assets/wallets/albedo.png","crossmark":"/assets/wallets/crossmark.webp","freighter":"/assets/wallets/freighter.png","gem":"/assets/wallets/gem.png","hashpack":"/assets/wallets/hashpack.png","kabila":"/assets/wallets/kabila.png","lobstr":"/assets/wallets/lobstr.png","rabet":"/assets/wallets/rabet.jpg","ready":"/assets/wallets/ready.png","xaman":"/assets/wallets/xaman.png"};
  function logo(){
    var id="";
    try{ id=(localStorage.getItem("lumos.wallet")||localStorage.getItem("lumos.lastWallet")||""); }catch(_){}
    if(!id)return "";
    id=String(id).toLowerCase().replace(/[^a-z0-9]/g,"");
    // walletconnect stores a few different spellings; they all mean the same sheet entry
    if(id.indexOf("walletconnect")===0||id==="wc")id="wc";
    return MAP[id]||"";
  }
  // #11: the menu card said "Connected · Stellar" -- which wallet you are connected WITH was the one
  // thing it did not say. The logo covers that when we ship one, but a generic WalletConnect session
  // has no wallet-specific asset to show and drawing a brand mark from memory is not the answer.
  // Naming it is: the sub-line reads "LOBSTR · Stellar", and falls back to the id itself for a wallet
  // this map has not been taught, which is still better than saying nothing.
  var NAMES={lobstr:"LOBSTR",freighter:"Freighter",rabet:"Rabet",albedo:"Albedo",xbull:"xBull",
    walletconnect:"WalletConnect",wc:"WalletConnect",hana:"Hana",xaman:"Xaman",gem:"Gem",
    hashpack:"HashPack",kabila:"Kabila",crossmark:"Crossmark",ready:"Ready"};
  function walletId(){
    var id="";
    try{ id=(localStorage.getItem("lumos.wallet")||localStorage.getItem("lumos.lastWallet")||""); }catch(_){}
    return String(id).toLowerCase().replace(/[^a-z0-9]/g,"");
  }
  function nameIt(){
    var id=walletId(); if(!id)return;
    var nm=NAMES[id]||(id.charAt(0).toUpperCase()+id.slice(1));
    var els=document.querySelectorAll(".mu-sub");
    for(var i=0;i<els.length;i++){
      var e=els[i], t=(e.textContent||"").trim();
      if(!t||t.indexOf(nm)===0)continue;
      // Keep whatever the card said after the separator -- that is the network, and it is still true.
      var tail=t.indexOf("·")>=0?t.slice(t.indexOf("·")):"";
      var want=nm+(tail?(" "+tail):"");
      if(e.textContent!==want)e.textContent=want;
    }
  }
  // Measured ink-bounding-box crops. 1 = the mark already fills its canvas, so leave it alone.
  var ZOOM={rabet:141,ready:160,albedo:122};
  function paint(){
    try{ nameIt(); }catch(_){}
    var url=logo(); if(!url)return;
    var els=document.querySelectorAll(".mu-av,.lx-tw-av");
    for(var i=0;i<els.length;i++){
      var e=els[i];
      if(e.getAttribute("data-lxwl")===url)continue;
      e.setAttribute("data-lxwl",url);
      e.classList.add("lx-haswl");
      e.style.setProperty("background-image","url('"+url+"')","important");
      // Crop the dead margin on the marks that have one; the rest keep plain cover.
      var _z=ZOOM[walletId()];
      if(_z)e.style.setProperty("background-size",_z+"%","important");
      else e.style.removeProperty("background-size");
    }
  }
  function boot(){
    paint();
    // The chip and the menu card are both built after connect, and the menu is rendered on open --
    // so this watches rather than running once.
    try{ new MutationObserver(paint).observe(document.body,{childList:true,subtree:true}); }catch(_){}
    try{ window.addEventListener("storage",paint); }catch(_){}
    var n=0,iv=setInterval(function(){ paint(); if(++n>20)clearInterval(iv); },400);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();