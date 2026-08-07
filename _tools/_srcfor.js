// #5 root cause: the in-page logo applier ships `function srcFor(sym){return null;}` — stubbed,
// so NO real logo from the LOGOS map is ever applied (place() bails on null; theme chips get url("null")).
// Restore a working srcFor that returns the real base64 src (theme-aware). Activates every LOGOS entry.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const OLD='function srcFor(sym){return null;}';
const NEW='function srcFor(sym){var L=LOGOS[sym];if(!L)return null;if(L.mode==="theme"){var t=(document.documentElement.getAttribute("data-theme")==="light")?"light":"dark";return L[t]||L.light||L.dark||null;}return L.src||null;}';
// also: apply logos to EVERY explicitly-tagged [data-logo] chip (not just theme-mode) via place()
const LOOP_OLD=`if(L&&L.mode==='theme') els[i].style.backgroundImage='url("'+srcFor(d)+'")';`;
const LOOP_NEW=`if(LOGOS[d]) place(els[i],d);`;

let n=0,pages=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let changed=false;
      if(json[k].indexOf(OLD)>=0){ json[k]=json[k].split(OLD).join(NEW); changed=true; }
      if(json[k].indexOf(LOOP_OLD)>=0){ json[k]=json[k].split(LOOP_OLD).join(LOOP_NEW); changed=true; }
      if(changed){ n++; pages++; }
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('srcFor restored on '+pages+' pages ('+n+' replacements)');
