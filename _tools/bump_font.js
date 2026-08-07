// One-time: increase every `font-size:Npx` by +2px across the showcase files.
// NOT idempotent (additive) — run exactly once on freshly-built files.
// Usage: node _tools/bump_font.js [--write] [delta]
const fs = require('fs');
const write = process.argv.includes('--write');
const delta = parseFloat(process.argv.find(a=>/^-?\d+(\.\d+)?$/.test(a))) || 2;
const files = ['aptos','hedera','starknet','vechain','worldchain'].map(c=>`lumoscore-${c}-desktop.html`);
for (const f of files){
  const src = fs.readFileSync(f,'utf8');
  let n=0;
  const out = src.replace(/font-size:\s*([\d.]+)px/g, (m,v)=>{ n++; return 'font-size:'+(Math.round((parseFloat(v)+delta)*100)/100)+'px'; });
  if (write) fs.writeFileSync(f, out, 'utf8');
  console.log(`${write?'[WROTE]':'[DRY]'} ${f}: +${delta}px on ${n} font-size decls`);
}
