const fs=require('fs'),path=require('path');
const B=String.fromCharCode(92);
const badCloseSeq=')();<'+B+'/script>';   // the WRONG escaped closer
let total=0,notDoctype=0,missingRuntime=0,badClose=0,goodClose=0;
for(const c of ["aptos","hedera","starknet","vechain","worldchain"]){
  const dir="C:/LumosCore/dist/"+c;
  for(const f of fs.readdirSync(dir)){
    if(!f.endsWith(".html"))continue; total++;
    const h=fs.readFileSync(path.join(dir,f),"utf8");
    if(!/^<!doctype html>/i.test(h.trim())) notDoctype++;
    if(f!=="index.html"){
      if(h.indexOf("window.__lxSite")<0) missingRuntime++;
      if(h.indexOf(badCloseSeq)>=0) badClose++;
      if(h.indexOf(')();</scr'+'ipt>')>=0) goodClose++;
    }
  }
}
console.log("total html:",total);
console.log("notDoctype:",notDoctype);
console.log("missingRuntime:",missingRuntime);
console.log("badEscapedCloser:",badClose);
console.log("goodPlainCloser:",goodClose);
