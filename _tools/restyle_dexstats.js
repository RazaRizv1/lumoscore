// Redesign the dex-asset "Stats row" into attractive, symmetrical equal cards.
// - wraps a trailing unit (e.g. "HBAR"/"APT") in the .val into <span class="u"> so values stay single-line
// - appends an override <style id="lx-assetstats"> (theme-adaptive, works light+dark)
// Idempotent. Usage: node _tools/restyle_dexstats.js [--write]
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const STYLE = '<style id="lx-assetstats">'
  + '.stat-row{gap:11px;background:transparent !important;border-top:none !important}'
  + '.stat-cell{padding:15px 16px !important;border:1px solid var(--border) !important;border-radius:13px;background:var(--surface);display:flex;flex-direction:column;justify-content:center;min-height:92px;transition:border-color .15s ease,box-shadow .15s ease}'
  + '.stat-cell:hover{border-color:var(--accent-soft,rgba(234,106,44,.32)) !important;box-shadow:0 10px 24px -18px rgba(234,106,44,.5)}'
  + '.stat-cell .lbl{font-size:10.5px;letter-spacing:.09em;font-weight:700;margin-bottom:9px;white-space:nowrap}'
  + '.stat-cell .val{font-size:18px;font-weight:800;letter-spacing:-.015em;white-space:nowrap;line-height:1.05;color:var(--text)}'
  + '.stat-cell .val .u{font-size:11.5px;font-weight:600;color:var(--text-muted);margin-left:2px}'
  + '.stat-cell .sub{font-size:12px;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  + '</style>';

// Wrap a trailing " UNIT" (2-5 uppercase letters) inside stat-cell .val divs, within the stat-row block only.
function transform(h){
  if (h.indexOf('id="lx-assetstats"') >= 0) return { h, changed:false }; // already done
  const si = h.indexOf('<div class="stat-row">');
  if (si < 0) return { h, changed:false };
  // depth-match the stat-row block
  let i = h.indexOf('>', si) + 1, d = 1;
  while (d > 0){ const n = h.indexOf('<div', i), c = h.indexOf('</div>', i); if (c < 0) break; if (n >= 0 && n < c){ d++; i = n + 4; } else { d--; i = c + 6; } }
  const block = h.slice(si, i);
  const newBlock = block.replace(/(<div class="val[^"]*">)([^<]*?) ([A-Z]{2,5})(<\/div>)/g,
    (m, a, num, unit, end) => a + num + '<span class="u">' + unit + '</span>' + end);
  let out = h.slice(0, si) + newBlock + h.slice(i);
  // append override style before </body>
  const bi = out.lastIndexOf('</body>');
  out = bi >= 0 ? out.slice(0, bi) + STYLE + out.slice(bi) : out + STYLE;
  return { h: out, changed:true };
}

const chains = ['aptos','hedera','starknet','vechain','worldchain'];
const files = [];
for (const c of chains){ files.push(`lumoscore-${c}-desktop.html`, `lumoscore-${c}-mobile.html`); }
const write = process.argv.includes('--write');
for (const file of files){
  const data = read(file);
  const { json, s, e } = getContents(data);
  let n = 0;
  for (const k of Object.keys(json)){
    if (!/dex-asset/.test(k)) continue;
    const r = transform(json[k]);
    if (r.changed){ json[k] = r.h; n++; }
  }
  if (write && n){
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
  console.log(`${write?'[WROTE]':'[DRY]'} ${file}: restyled ${n} dex-asset stat rows`);
}
