const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// ---------- A) light-theme token fixes (hex remap, same mechanism as restyle.js) ----------
const COLOR_MAP = {
  '#ff6a1a': '#ea6a2c',   // light-mode accent: old neon orange -> ember (matches dark)
  '#f97316': '#ff894c',   // lighter orange partner -> ember-2
  '#8a8a96': '#75757f',   // light --text-soft: bump contrast on light bg
  '#3b82f6': '#6f5ded',   // light --blue -> iris (consistent with dark secondary)
};
const RGBA_MAP = [
  ['rgba(255,106,26,', 'rgba(234,106,44,'],
  ['rgba(255, 106, 26,', 'rgba(234, 106, 44,'],
  ['rgba(249,115,22,', 'rgba(255,137,76,'],
  ['rgba(249, 115, 22,', 'rgba(255, 137, 76,'],
];

// ---------- B) interaction polish layer ----------
const CTA = ':where(.btn,.btn-primary,.dex-hero-btn,.lumos-promo-cta,.dex-mk-action-btn,.trade-btn,.open-btn,.qa-btn,.max-btn,.pill-btn)';
const CARDS = ':where(.product-card,.quick-card,.market-card,.insight-card,.activity-card,.lp-card,.tcard,.dex-mover-card,.dex-mints-card,.pools-card,.assets-card,.amm-snapshot-card,.lx-netcard)';
const ROWS = ':where(tr[data-pair],tr[data-pool],.pools tbody tr,.dex-mk-table tbody tr)';

const POLISH = `<style id="lx-polish">
/* ---- LumosCore interaction polish (clean direction: motion + focus + finish, no imagery) ---- */
@media (prefers-reduced-motion: no-preference){
  :where(a,button,input,select,textarea,.chip){transition:background-color .16s ease,border-color .16s ease,color .16s ease,box-shadow .2s ease,transform .16s ease,opacity .16s ease;}
  ${CTA}:hover{transform:translateY(-1px);}
  ${CTA}:active{transform:translateY(0) scale(.985);}
  :where(.btn.primary,.btn-primary,.dex-hero-btn.primary,.trade-btn):hover{box-shadow:0 10px 26px -12px var(--accent,#ea6a2c);}
  ${CARDS}{transition:transform .2s ease,border-color .2s ease,box-shadow .25s ease,background-color .2s ease;}
  ${CARDS}:hover{transform:translateY(-2px);border-color:var(--border-strong,#34343c);}
  html:not([data-theme="light"]) ${CARDS}:hover{box-shadow:0 14px 34px -22px rgba(0,0,0,.85);}
  body{transition:background-color .3s ease,color .3s ease;}
}
/* keyboard focus */
:where(a,button,input,select,textarea,[tabindex]):focus-visible{outline:2px solid var(--accent,#ea6a2c);outline-offset:2px;}
/* branded selection */
::selection{background:rgba(234,106,44,.26);}
/* headline balance */
:where(h1,h2,h3){text-wrap:balance;}
/* clickable market/pool rows: accent affordance */
${ROWS}{cursor:pointer;}
${ROWS}:hover td:first-child{box-shadow:inset 2px 0 0 var(--accent,#ea6a2c);}
/* themed thin scrollbars */
*{scrollbar-width:thin;scrollbar-color:var(--border-strong,#34343c) transparent;}
::-webkit-scrollbar{width:10px;height:10px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:var(--border-strong,#34343c);border-radius:8px;border:3px solid transparent;background-clip:padding-box;}
::-webkit-scrollbar-thumb:hover{background:var(--text-soft,#6e6d78);border:3px solid transparent;background-clip:padding-box;}
/* light-mode elevation: cards read as raised surfaces on light bg */
[data-theme="light"] ${CARDS}{box-shadow:0 1px 2px rgba(16,17,20,.05),0 10px 28px -20px rgba(16,17,20,.16);}
[data-theme="light"] ${CARDS}:hover{box-shadow:0 2px 4px rgba(16,17,20,.06),0 16px 36px -20px rgba(16,17,20,.22);}
</style>`;

function polishPage(html, stats){
  let out = html.replace(/<style id="lx-polish">[\s\S]*?<\/style>/g, '');
  for (const from of Object.keys(COLOR_MAP)){
    const re = new RegExp(from, 'gi');
    const m = out.match(re);
    if (m){ stats.colors += m.length; out = out.replace(re, COLOR_MAP[from]); }
  }
  for (const [a,b] of RGBA_MAP){
    const parts = out.split(a);
    if (parts.length > 1){ stats.rgba += parts.length - 1; out = parts.join(b); }
  }
  const idx = out.lastIndexOf('</head>');
  out = idx >= 0 ? out.slice(0, idx) + POLISH + out.slice(idx) : out + POLISH;
  stats.pages++;
  return out;
}

function run(file, write){
  const data = read(file);
  const { json, s, e } = getContents(data);
  const stats = { pages:0, colors:0, rgba:0 };
  for (const k of Object.keys(json)) json[k] = polishPage(json[k], stats);
  const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
  if (write) fs.writeFileSync(file, data.slice(0,s) + serialized + data.slice(e), 'utf8');
  return stats;
}

const args = process.argv.slice(2);
const write = args.includes('--write');
for (const f of args.filter(x => x.endsWith('.html'))){
  const st = run(f, write);
  console.log((write?'[WROTE] ':'[DRY] ') + f.split(/[\\/]/).pop() + '  pages:' + st.pages + ' lightAccentFixes:' + st.colors + ' rgbaFixes:' + st.rgba);
}
