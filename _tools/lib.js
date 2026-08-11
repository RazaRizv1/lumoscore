const fs=require('fs');
function read(f){return fs.readFileSync(f,'utf8');}
function getContents(data){
  const i=data.indexOf('id="designContents"');const s=data.indexOf('>',i)+1;const e=data.indexOf('</script>',s);
  return {json:JSON.parse(data.slice(s,e)), s, e};
}
// The container JSON lives INSIDE a <script> tag, so every "</" it contains must go back escaped as "<\/".
// Writing a plain JSON.stringify puts a literal </script> in the middle of the tag: the browser (and
// getContents, which scans for the first </script>) then sees the container end early and the file is
// silently truncated. That corrupted all seven mobile containers once — they are gitignored, so there was
// no undo. Escape on the way out, always.
function writeContents(file, transformFn){
  const data=read(file);
  const {json,s,e}=getContents(data);
  const changed=transformFn(json);
  const B=String.fromCharCode(92);
  const out=data.slice(0,s)+JSON.stringify(json).split('</').join('<'+B+'/')+data.slice(e);
  fs.writeFileSync(file,out,'utf8');
  return changed;
}
module.exports={read,getContents,writeContents};
