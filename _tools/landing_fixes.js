// Landing-page batch fixes. Applies to lumoscore-landing.html in each desktop showcase file.
// Usage: node _tools/landing_fixes.js [--write]
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

function removeSection(h, openTag){
  const s = h.indexOf(openTag);
  if (s < 0) return { h, hit:false };
  let i = h.indexOf('>', s) + 1, d = 1;
  while (d > 0){ const n = h.indexOf('<section', i), c = h.indexOf('</section>', i); if (c < 0) break; if (n >= 0 && n < c){ d++; i = n + 8; } else { d--; i = c + 10; } }
  return { h: h.slice(0, s) + h.slice(i), hit:true };
}
function removeAllDivs(h, openTag){
  let out = h, n = 0;
  while (true){
    const s = out.indexOf(openTag);
    if (s < 0) break;
    let i = out.indexOf('>', s) + 1, d = 1;
    while (d > 0){ const a = out.indexOf('<div', i), c = out.indexOf('</div>', i); if (c < 0) break; if (a >= 0 && a < c){ d++; i = a + 4; } else { d--; i = c + 6; } }
    out = out.slice(0, s) + out.slice(i); n++;
    if (n > 20) break;
  }
  return { h: out, n };
}

const NETMAP = "({stellar:'Stellar',hedera:'Hedera',aptos:'Aptos',starknet:'Starknet',vechain:'VeChain',worldchain:'World Chain',xrpl:'XRP Ledger'})[a.chain]||a.chain";
const STYLE = '<style id="lx-landfix">.sp-net{font-size:11px;font-weight:600;color:var(--text-soft);background:var(--surface-2);border:1px solid var(--border);padding:1px 6px;border-radius:5px;margin-left:4px;white-space:nowrap}</style>';

function fix(h){
  const st = { sections:0, stats:0, faq:0, empty:0, net:0 };
  // 1) remove sections
  for (const tag of ['<section class="block trending-block">','<section class="block" id="how">','<section class="final-cta-section">']){
    const r = removeSection(h, tag); if (r.hit){ h = r.h; st.sections++; }
  }
  // 2) remove product-card stat numbers
  const r = removeAllDivs(h, '<div class="pc-stats">'); h = r.h; st.stats = r.n;
  // 3) FAQ heading
  const faqOld = 'Bitcoinions, <span class="grad">answered.</span>';
  if (h.indexOf(faqOld) >= 0){ h = h.split(faqOld).join('Frequently asked <span class="grad">questions.</span>'); st.faq = 1; }
  // 4) search: empty before typing (both render impls)
  for (const decl of ['const q = currentQuery.toLowerCase().trim();','var q = currentQuery.toLowerCase().trim();']){
    if (h.indexOf(decl) >= 0){ h = h.split(decl).join(decl + " if(!q&&!activeFilter){if(assetList)assetList.innerHTML='';if(assetCount)assetCount.textContent='';return;}"); st.empty++; }
  }
  // 5) search: show network next to token name
  const nameOld = '${a.tk} ${domainBadge} ${newBadge}';
  if (h.indexOf(nameOld) >= 0){ const cnt = h.split(nameOld).length - 1; h = h.split(nameOld).join('${a.tk} <span class="sp-net">${' + NETMAP + '}</span> ${domainBadge} ${newBadge}'); st.net = cnt; }
  // append badge style
  if (h.indexOf('id="lx-landfix"') < 0){ const bi = h.lastIndexOf('</body>'); h = bi>=0 ? h.slice(0,bi)+STYLE+h.slice(bi) : h+STYLE; }
  return { h, st };
}

const chains = ['aptos','hedera','starknet','vechain','worldchain'];
const write = process.argv.includes('--write');
for (const c of chains){
  const file = `lumoscore-${c}-desktop.html`;
  const data = read(file);
  const { json, s, e } = getContents(data);
  const key = 'lumoscore-landing.html';
  if (!json[key]){ console.log(`${c}: no landing`); continue; }
  const { h, st } = fix(json[key]);
  json[key] = h;
  if (write){ const serialized = JSON.stringify(json).split('</').join('<' + B + '/'); fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8'); }
  console.log(`${write?'[WROTE]':'[DRY]'} ${c}: sections=${st.sections} pc-stats=${st.stats} faq=${st.faq} searchEmpty=${st.empty} netLabels=${st.net}`);
}
