// Add the LUMOS logo favicon to every page's <head>. References assets/favicon.png (extracted from the
// .logo-mark base64 PNG) — a file, not a per-page data URI, to keep pages light. Idempotent (keyed on rel="icon").
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const LINKS='<link rel="icon" type="image/png" href="assets/favicon.png"><link rel="apple-touch-icon" href="assets/favicon.png">';

let n=0, skipped=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k];
      if(/rel="icon"/.test(h)){ skipped++; continue; }
      const m=h.match(/<head[^>]*>/i);
      if(!m){ continue; }
      const at=m.index+m[0].length;
      json[k]=h.slice(0,at)+LINKS+h.slice(at); n++;
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('favicon links added to '+n+' pages (skipped '+skipped+' already-tagged)');
