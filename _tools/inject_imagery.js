const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// ---- shared SVG data-URIs (url-safe; %23 = #) ----
const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";
// faint market chart line (ember) with soft area fill — sits at the base of the Trade hero
const CHART = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='260' preserveAspectRatio='none'%3E%3Cdefs%3E%3ClinearGradient id='a' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='%23ea6a2c' stop-opacity='0.20'/%3E%3Cstop offset='1' stop-color='%23ea6a2c' stop-opacity='0'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M0 200 L90 175 L180 188 L270 150 L360 165 L450 120 L540 138 L630 96 L720 118 L810 70 L900 92 L990 54 L1080 74 L1200 40 L1200 260 L0 260 Z' fill='url(%23a)'/%3E%3Cpath d='M0 200 L90 175 L180 188 L270 150 L360 165 L450 120 L540 138 L630 96 L720 118 L810 70 L900 92 L990 54 L1080 74 L1200 40' fill='none' stroke='%23ea6a2c' stroke-opacity='0.55' stroke-width='2'/%3E%3C/svg%3E\")";
// liquidity-flow curves (iris + green + ember) — Pools hero
const FLOW = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='300' preserveAspectRatio='none'%3E%3Cpath d='M-20 120 C 300 40, 500 220, 820 120 S 1220 60, 1240 140' fill='none' stroke='%238b7bff' stroke-opacity='0.30' stroke-width='1.6'/%3E%3Cpath d='M-20 180 C 320 90, 560 270, 860 170 S 1200 120, 1240 190' fill='none' stroke='%2335c07f' stroke-opacity='0.22' stroke-width='1.6'/%3E%3Cpath d='M-20 90 C 260 10, 520 170, 800 80 S 1180 30, 1240 100' fill='none' stroke='%23ea6a2c' stroke-opacity='0.16' stroke-width='1.4'/%3E%3C/svg%3E\")";

const GRAIN_LAYER = `body::after{content:'';position:fixed;inset:0;z-index:9998;pointer-events:none;opacity:.03;mix-blend-mode:overlay;background-image:${GRAIN};background-size:170px 170px;}`;

const LANDING = `<style id="lx-imagery">
.hero{background:
  radial-gradient(880px 460px at 72% 4%, rgba(234,106,44,.12), transparent 60%),
  radial-gradient(820px 520px at 8% 92%, rgba(139,123,255,.10), transparent 58%),
  var(--bg,#0a0a0b);}
.orb{opacity:.20!important;filter:blur(74px) saturate(.9)!important;}
.hero-rays{opacity:.5;}
.hero-rays::before{content:'';position:absolute;inset:-2px;z-index:0;pointer-events:none;
  background-image:linear-gradient(rgba(255,255,255,.032) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.032) 1px,transparent 1px);
  background-size:60px 60px;
  -webkit-mask-image:radial-gradient(ellipse 66% 56% at 50% 40%,#000 0%,transparent 78%);
          mask-image:radial-gradient(ellipse 66% 56% at 50% 40%,#000 0%,transparent 78%);}
.hero-rays::after{content:'';position:absolute;inset:0;z-index:1;pointer-events:none;opacity:.05;mix-blend-mode:overlay;background-image:${GRAIN};background-size:160px 160px;}
${GRAIN_LAYER}
</style>`;

const TRADE = `<style id="lx-imagery">
.dex-hero{position:relative;isolation:isolate;overflow:hidden;}
.dex-hero::before{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;
  background:radial-gradient(600px 300px at 82% 12%,rgba(234,106,44,.10),transparent 62%),radial-gradient(460px 260px at 6% 96%,rgba(139,123,255,.08),transparent 60%);}
.dex-hero::after{content:'';position:absolute;left:0;right:0;bottom:0;height:62%;z-index:0;pointer-events:none;
  background-image:${CHART};background-size:100% 100%;background-repeat:no-repeat;opacity:.7;
  -webkit-mask-image:linear-gradient(90deg,transparent,#000 22%,#000 82%,transparent);mask-image:linear-gradient(90deg,transparent,#000 22%,#000 82%,transparent);}
.dex-hero-l,.dex-hero-r{position:relative;z-index:1;}
.lumos-promo{position:relative;overflow:hidden;}
.lumos-promo::before{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;
  background-image:linear-gradient(rgba(234,106,44,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(139,123,255,.045) 1px,transparent 1px);background-size:46px 46px;
  -webkit-mask-image:linear-gradient(90deg,#000,transparent 72%);mask-image:linear-gradient(90deg,#000,transparent 72%);}
.lumos-promo-content,.lumos-promo-visual{position:relative;z-index:1;}
${GRAIN_LAYER}
</style>`;

const POOLS = `<style id="lx-imagery">
.dex-hero{position:relative;isolation:isolate;overflow:hidden;}
.dex-hero::before{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;
  background:radial-gradient(560px 300px at 80% 16%,rgba(53,192,127,.09),transparent 60%),radial-gradient(520px 280px at 12% 92%,rgba(139,123,255,.09),transparent 60%);}
.dex-hero::after{content:'';position:absolute;left:0;right:0;bottom:0;height:70%;z-index:0;pointer-events:none;
  background-image:${FLOW};background-size:100% 100%;background-repeat:no-repeat;opacity:.75;
  -webkit-mask-image:linear-gradient(90deg,transparent,#000 18%,#000 88%,transparent);mask-image:linear-gradient(90deg,transparent,#000 18%,#000 88%,transparent);}
.dex-hero-l,.dex-hero-r{position:relative;z-index:1;}
.lumos-promo{position:relative;overflow:hidden;}
.lumos-promo::before{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;
  background:radial-gradient(400px 200px at 85% 20%,rgba(139,123,255,.08),transparent 60%);}
.lumos-promo-content,.lumos-promo-visual{position:relative;z-index:1;}
${GRAIN_LAYER}
</style>`;

const BLOCKS = { landing: LANDING, trade: TRADE, pools: POOLS };

function typeFor(key){
  if (/^lumoscore-landing(-mobile)?\.html$/.test(key)) return 'landing';
  if (/^lumoscore-dex(-dark|-mobile)?\.html$/.test(key)) return 'trade';
  if (/^lumoscore-amm(-dark|-mobile)?\.html$/.test(key)) return 'pools';
  return null;
}

function applyToPage(key, html){
  const type = typeFor(key);
  if (!type) return { html, injected:false };
  let out = html.replace(/<style id="lx-imagery">[\s\S]*?<\/style>/g, '');
  const block = BLOCKS[type];
  const idx = out.lastIndexOf('</head>');
  out = idx >= 0 ? out.slice(0, idx) + block + out.slice(idx) : out + block;
  return { html: out, injected:true, type };
}

function injectStandalone(file, write){
  const key = file.split(/[\\/]/).pop();
  const r = applyToPage(key, read(file));
  if (r.injected && write) fs.writeFileSync(file, r.html, 'utf8');
  return r;
}

function injectShowcase(file, write){
  const data = read(file);
  const { json, s, e } = getContents(data);
  const done = {};
  for (const k of Object.keys(json)){
    const r = applyToPage(k, json[k]);
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
  for (const f of files){
    const r = showcase ? injectShowcase(f, write) : injectStandalone(f, write);
    console.log((write?'[WROTE] ':'[DRY] ') + f.split(/[\\/]/).pop(), showcase ? JSON.stringify(r) : ('| '+(r.injected?('injected:'+r.type):'skip')));
  }
}
module.exports = { injectStandalone, injectShowcase, applyToPage, typeFor };
