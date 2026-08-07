const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

function strip(html){
  return html.replace(/<style id="lx-imagery">[\s\S]*?<\/style>/g, '');
}

function stripShowcase(file, write){
  const data = read(file);
  const { json, s, e } = getContents(data);
  let n = 0;
  for (const k of Object.keys(json)){
    const out = strip(json[k]);
    if (out !== json[k]){ json[k] = out; n++; }
  }
  const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
  if (write) fs.writeFileSync(file, data.slice(0,s) + serialized + data.slice(e), 'utf8');
  return n;
}

const args = process.argv.slice(2);
const write = args.includes('--write');
for (const f of args.filter(x => x.endsWith('.html'))){
  const n = stripShowcase(f, write);
  console.log((write?'[WROTE] ':'[DRY] ') + f.split(/[\\/]/).pop() + '  pagesStripped:' + n);
}
