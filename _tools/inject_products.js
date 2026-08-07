// Redesign the Dashboard "Explore products" cards into light-orange gradient tiles
// backed by a subtle Higgsfield silk texture (assets/prod-texture.png), small ember icons.
// Scoped to lumoscore-home.html ONLY (not the landing). Run AFTER bump_font (self-contained sizes).
// Usage: node _tools/inject_products.js [--write]
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);
const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

function styleBlock(){ return `<style id="lx-products">
.products-grid .pc{position:relative;overflow:hidden;border-radius:18px;padding:22px;text-decoration:none;display:flex;flex-direction:column;min-height:186px;background:var(--surface);border:1px solid var(--border);box-shadow:0 8px 24px -18px rgba(0,0,0,.5);transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
.products-grid .pc:hover{transform:translateY(-3px);border-color:var(--accent-soft,rgba(234,106,44,.35));box-shadow:0 18px 40px -22px rgba(234,106,44,.28)}
/* small light-orange gradient icon chip */
.products-grid .pc .head{margin:0}
.products-grid .pc-ic,.products-grid .pc .ic-prod{width:46px;height:46px;border-radius:13px;display:grid;place-items:center;background:linear-gradient(140deg,#ffeadb,#ffd0ab) !important;border:1px solid #ffdcc4;box-shadow:0 6px 16px -8px rgba(234,106,44,.35);color:#e05e1f !important}
.products-grid .pc-ic svg,.products-grid .pc .ic-prod svg{width:23px;height:23px;stroke:#e05e1f}
.products-grid .pc-ttl,.products-grid .pc .ttl{margin:16px 0 0;font-size:18px;font-weight:800;letter-spacing:-.02em;color:var(--text)}
.products-grid .pc-desc,.products-grid .pc .desc{margin:7px 0 0;font-size:13.5px;line-height:1.5;color:var(--text-muted);max-width:32ch}
.products-grid .pc-go{margin-top:auto;padding-top:14px;font-size:13.5px;font-weight:700;color:var(--accent);display:inline-flex;align-items:center;gap:6px}
.products-grid .pc-go svg{width:15px;height:15px}
</style>`; }

function parseCards(grid){
  const cards = [];
  const parts = grid.split('<a class="product-card"').slice(1);
  for (const p of parts){
    const href = (p.match(/href="([^"]+)"/)||[])[1] || '#';
    const icon = (p.match(/<div class="ic-prod[^"]*">\s*(<svg[\s\S]*?<\/svg>)/)||[])[1] || '';
    const title = (p.match(/<div class="ttl">([^<]+)<\/div>/)||[])[1] || '';
    const desc = (p.match(/<div class="desc">([^<]+)<\/div>/)||[])[1] || '';
    const open = (p.match(/<div class="open-btn">([^<]+)<\/div>/)||[])[1] || ('Open ' + title);
    cards.push({ href, icon, title, desc, open });
  }
  return cards;
}
function buildCard(c){
  return `<a class="pc" href="${c.href}"><span class="pc-ic">${c.icon}</span>`
    + `<div class="pc-ttl">${c.title}</div><div class="pc-desc">${c.desc}</div>`
    + `<div class="pc-go">${c.open} ${arrow}</div></a>`;
}

// Replace the INNER of <div class="products-grid ...> ... </div> and prepend the style block.
function redesign(html){
  const gi = html.indexOf('<div class="products-grid');
  if (gi < 0) return { html, changed:false };
  const inStart = html.indexOf('>', gi) + 1;
  let i = inStart, depth = 1;
  while (depth > 0){
    const n = html.indexOf('<div', i), c = html.indexOf('</div>', i);
    if (c < 0) break;
    if (n >= 0 && n < c){ depth++; i = n + 4; } else { depth--; i = c; if (depth===0) break; i += 6; }
  }
  const inner = html.slice(inStart, i);
  const cards = parseCards(inner);
  if (cards.length < 3) return { html, changed:false };
  const newInner = cards.map(buildCard).join('');
  const out = html.slice(0, gi) + styleBlock() + html.slice(gi, inStart) + newInner + html.slice(i);
  return { html: out, changed:true, count:cards.length };
}

const write = process.argv.includes('--write');
const chains = ['aptos','hedera','starknet','vechain','worldchain'];
for (const chain of chains){
  const file = `lumoscore-${chain}-desktop.html`;
  const data = read(file);
  const { json, s, e } = getContents(data);
  const r = redesign(json['lumoscore-home.html'] || '');
  if (r.changed) json['lumoscore-home.html'] = r.html;
  if (write && r.changed){
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
  console.log(`${write?'[WROTE]':'[DRY]'} ${chain}: ${r.changed?('redesigned '+r.count+' product cards'):'NO products-grid found'}`);
}
