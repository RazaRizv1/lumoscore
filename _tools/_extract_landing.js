const fs=require('fs');
const src=fs.readFileSync('_backup_navfixed/lumoscore-hedera-desktop.html','utf8');
const m=src.match(/<script id="designContents"[^>]*>([\s\S]*?)<\/script>/);
if(!m){console.error('no designContents');process.exit(1);}
let json=m[1].trim();
// undo the </ escaping used in the showcase
json=json.split('<\/').join('</');
const map=JSON.parse(json);
const keys=Object.keys(map).filter(k=>/landing/.test(k));
console.log('landing keys:',keys);
const html=map['lumoscore-landing.html'];
fs.writeFileSync('dist/_orig-landing.html',html);
console.log('wrote dist/_orig-landing.html len',html.length);
console.log('has hero search:', /placeholder=["'][^"']*[Ss]earch/.test(html.slice(0,6000)));
