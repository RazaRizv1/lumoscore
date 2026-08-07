// AUDIT (user-reported: "pool logos are not showing up, and the ones that do are not correct").
//
// The multi-chain design source ships a token-logo "healer": a script that walks the page for anything
// class-matching /ico|asset-logo|token-logo|pair-ic/ and stamps in a picture from a hardcoded map keyed by
// TICKER TEXT ALONE (the map is Aptos-era — GUI, GARI, DOODOO, faptOS, ELON, …). Its pairs() pass also
// targets `.dxa-pl-icos`, which is the container the Stellar dex-asset data layer builds its pool icons in.
//
// On Stellar that is actively wrong. A ticker is not an identity here: 403 distinct mainnet assets use the
// code "USDC", 96 use "AQUA", 109 use "yXLM". The healer would happily paint Circle's brand onto a look-alike
// token, and it overwrote the issuer-correct logos the data layer had just resolved (innerHTML replace, so
// the real <img>/background was destroyed).
//
// Fix: teach the healer to leave alone any element the data layer owns. Data-layer icons all carry a
// data-lxc (code) attribute — and, where it matters, data-lxi (issuer) — so that attribute is the marker.
// Nothing else changes: on pages with no data layer the healer still runs exactly as before.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

// pairs(): skip a pair container whose icons are data-layer owned
const P_FIND='if(b.getAttribute("data-paired"))continue;';
const P_ADD ='if(b.getAttribute("data-paired"))continue;if(b.querySelector&&b.querySelector("[data-lxc]"))continue;';
// cand(): skip a single icon that is data-layer owned
const C_FIND='if(el.children.length>0)return false;';
const C_ADD ='if(el.getAttribute&&el.getAttribute("data-lxc")!=null)return false;if(el.children.length>0)return false;';

let pages=0, pairsPatched=0, candPatched=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain','stellar','xrpl']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    let changed=false;
    for(const k of Object.keys(json)){
      let h=json[k];
      if(h.indexOf('data-paired')<0 && h.indexOf(C_FIND)<0) continue;   // healer not on this page
      let out=h;
      if(out.indexOf('querySelector("[data-lxc]")')<0 && out.indexOf(P_FIND)>=0){ out=out.split(P_FIND).join(P_ADD); pairsPatched++; }
      if(out.indexOf('getAttribute("data-lxc")!=null')<0 && out.indexOf(C_FIND)>=0){ out=out.split(C_FIND).join(C_ADD); candPatched++; }
      if(out!==h){ json[k]=out; changed=true; pages++; }
    }
    if(changed){ const serialized=JSON.stringify(json).split('</').join('<'+B+'/'); fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8'); }
  }
}
console.log('logo guard: data-lxc opt-out added — pairs() on '+pairsPatched+' key(s), cand() on '+candPatched+' key(s), across '+pages+' page key(s)');
