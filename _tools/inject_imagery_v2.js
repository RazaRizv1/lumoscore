const fs = require('fs');
const path = require('path');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// Higgsfield hero art (downloaded to C:\LumosCore\assets\) embedded as base64 data URIs.
const ASSETS = 'C:/LumosCore/assets';
function dataUri(file){
  const p = path.join(ASSETS, file);
  if (!fs.existsSync(p)) throw new Error('missing asset: ' + p);
  const ext = path.extname(p).slice(1).toLowerCase();
  const mime = ext === 'jpg' ? 'jpeg' : ext;
  return 'data:image/' + mime + ';base64,' + fs.readFileSync(p).toString('base64');
}

function blocks(){
  const landing = dataUri('hero-landing.jpg');
  const trade   = dataUri('hero-trade.jpg');
  const pools   = dataUri('hero-pools.jpg');

  const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";
  const GRAIN_LAYER = `body::after{content:'';position:fixed;inset:0;z-index:9998;pointer-events:none;opacity:.022;mix-blend-mode:overlay;background-image:${GRAIN};background-size:170px 170px;}`;

  // LANDING — full-bleed cinematic hero image under the existing centered content.
  // The render is already near-black in the center, so the scrim is light: a gentle
  // center vignette for headline crispness + a bottom blend into the page background.
  const LANDING = `<style id="lx-imagery">
.hero{position:relative;}
.hero::before{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;
  background-image:url("${landing}");background-size:cover;background-position:center;}
.hero::after{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;
  background:
    radial-gradient(ellipse 58% 48% at 50% 42%, rgba(10,10,11,.30) 0%, rgba(10,10,11,.14) 55%, rgba(10,10,11,0) 100%),
    linear-gradient(180deg, rgba(10,10,11,.42) 0%, rgba(10,10,11,0) 30%, rgba(10,10,11,0) 68%, var(--bg,#0a0a0b) 100%);}
.hero-rays{display:none!important;}
.orb{display:none!important;}
.hero > *:not(.hero-rays):not(.orb){position:relative;z-index:1;}
.hero-vignette{display:none!important;}
${GRAIN_LAYER}
</style>`;

  // TRADE — .dex-hero banner gets the market-chart artwork. The glowing line lives in
  // the left-center of the render, so the left scrim stays soft enough to reveal it
  // while keeping the headline legible.
  const TRADE = `<style id="lx-imagery">
.dex-hero{position:relative;isolation:isolate;overflow:hidden;}
.dex-hero::before{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;
  background-image:url("${trade}");background-size:cover;background-position:center;border-radius:inherit;}
.dex-hero::after{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;border-radius:inherit;
  background:linear-gradient(90deg, rgba(10,10,11,.78) 0%, rgba(10,10,11,.46) 42%, rgba(10,10,11,.18) 72%, rgba(10,10,11,.30) 100%);}
.dex-hero > *{position:relative;z-index:1;}
${GRAIN_LAYER}
</style>`;

  // POOLS — liquidity-silk artwork; waves flow through the lower half, text sits in the
  // dark upper-left, so only a soft left/top scrim is needed.
  const POOLS = `<style id="lx-imagery">
.dex-hero{position:relative;isolation:isolate;overflow:hidden;}
.dex-hero::before{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;
  background-image:url("${pools}");background-size:cover;background-position:center;border-radius:inherit;}
.dex-hero::after{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;border-radius:inherit;
  background:linear-gradient(90deg, rgba(10,10,11,.72) 0%, rgba(10,10,11,.40) 44%, rgba(10,10,11,.12) 78%, rgba(10,10,11,.22) 100%);}
.dex-hero > *{position:relative;z-index:1;}
${GRAIN_LAYER}
</style>`;

  return { landing: LANDING, trade: TRADE, pools: POOLS };
}

function typeFor(key){
  if (/^lumoscore-landing(-mobile)?\.html$/.test(key)) return 'landing';
  if (/^lumoscore-dex(-dark|-mobile)?\.html$/.test(key)) return 'trade';
  if (/^lumoscore-amm(-dark|-mobile)?\.html$/.test(key)) return 'pools';
  return null;
}

function applyToPage(key, html, BLOCKS){
  const type = typeFor(key);
  if (!type) return { html, injected:false };
  let out = html.replace(/<style id="lx-imagery">[\s\S]*?<\/style>/g, '');
  const idx = out.lastIndexOf('</head>');
  out = idx >= 0 ? out.slice(0, idx) + BLOCKS[type] + out.slice(idx) : out + BLOCKS[type];
  return { html: out, injected:true, type };
}

function injectStandalone(file, write, BLOCKS){
  const key = file.split(/[\\/]/).pop();
  const r = applyToPage(key, read(file), BLOCKS);
  if (r.injected && write) fs.writeFileSync(file, r.html, 'utf8');
  return r;
}

function injectShowcase(file, write, BLOCKS){
  const data = read(file);
  const { json, s, e } = getContents(data);
  const done = {};
  for (const k of Object.keys(json)){
    const r = applyToPage(k, json[k], BLOCKS);
    if (r.injected){ json[k] = r.html; done[r.type] = (done[r.type]||0)+1; }
  }
  const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
  if (write) fs.writeFileSync(file, data.slice(0,s) + serialized + data.slice(e), 'utf8');
  return done;
}

if (require.main === module){
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const showcase = args.includes('--showcase');
  const files = args.filter(a => a.endsWith('.html'));
  const BLOCKS = blocks();
  for (const f of files){
    const r = showcase ? injectShowcase(f, write, BLOCKS) : injectStandalone(f, write, BLOCKS);
    console.log((write?'[WROTE] ':'[DRY] ') + f.split(/[\\/]/).pop(), showcase ? JSON.stringify(r) : ('| '+(r.injected?('injected:'+r.type):'skip')));
  }
}
