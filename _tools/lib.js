const fs=require('fs');
function read(f){return fs.readFileSync(f,'utf8');}
function getContents(data){
  const i=data.indexOf('id="designContents"');const s=data.indexOf('>',i)+1;const e=data.indexOf('</script>',s);
  return {json:JSON.parse(data.slice(s,e)), s, e};
}
function writeContents(file, transformFn){
  const data=read(file);
  const {json,s,e}=getContents(data);
  const changed=transformFn(json);
  const out=data.slice(0,s)+JSON.stringify(json)+data.slice(e);
  fs.writeFileSync(file,out,'utf8');
  return changed;
}
module.exports={read,getContents,writeContents};
