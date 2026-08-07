const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// The original __lumosNav heuristic navigator was built for the showcase iframe only:
// in standalone pages window.parent===window, so nav() bailed AFTER the click was already
// swallowed (stopImmediatePropagation) — rows/buttons ate clicks and went nowhere.
// Fix: keep iframe path first, then fall back to the standalone runtime (window.lxNavigate
// from extract_site.js), then raw location.href.
const OLD = "function nav(base){ try{var P=window.parent; if(!P||P===window||!P.lxNavigate) return; P.lxNavigate(cand(base)); }catch(e){} }";
const NEW = "function nav(base){ try{var c=cand(base); var P=window.parent; if(P&&P!==window&&P.lxNavigate){ P.lxNavigate(c); return; } if(window.lxNavigate){ window.lxNavigate(c); return; } if(c&&c[0]) location.href=c[0]; }catch(e){} }";

function run(file, write){
  const data = read(file);
  const { json, s, e } = getContents(data);
  let n = 0;
  for (const k of Object.keys(json)){
    const parts = json[k].split(OLD);
    if (parts.length > 1){ n += parts.length - 1; json[k] = parts.join(NEW); }
  }
  const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
  if (write) fs.writeFileSync(file, data.slice(0,s) + serialized + data.slice(e), 'utf8');
  return n;
}

const args = process.argv.slice(2);
const write = args.includes('--write');
for (const f of args.filter(x => x.endsWith('.html'))){
  console.log((write?'[WROTE] ':'[DRY] ') + f.split(/[\\/]/).pop() + '  navFixed:' + run(f, write));
}
