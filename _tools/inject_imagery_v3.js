const fs = require('fs');
const path = require('path');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const ASSETS = 'C:/LumosCore/assets';
function dataUri(file){
  const p = path.join(ASSETS, file);
  if (!fs.existsSync(p)) throw new Error('missing asset: ' + p);
  const ext = path.extname(p).slice(1).toLowerCase();
  return 'data:image/' + (ext === 'jpg' ? 'jpeg' : ext) + ';base64,' + fs.readFileSync(p).toString('base64');
}

const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";
const GRAIN_LAYER = `body::after{content:'';position:fixed;inset:0;z-index:9998;pointer-events:none;opacity:.022;mix-blend-mode:overlay;background-image:${GRAIN};background-size:170px 170px;}`;

// Full-bleed landing hero
function LANDING(art){ return `
.hero{position:relative;}
.hero::before{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;
  background-image:url("${art}");background-size:cover;background-position:center bottom;}
.hero::after{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;
  background:
    radial-gradient(ellipse 58% 46% at 50% 38%, rgba(10,10,11,.34) 0%, rgba(10,10,11,.10) 60%, rgba(10,10,11,0) 100%),
    linear-gradient(180deg, rgba(10,10,11,.46) 0%, rgba(10,10,11,0) 26%, rgba(10,10,11,0) 74%, var(--bg,#0a0a0b) 100%);}
.hero-rays{display:none!important;}
.orb{display:none!important;}
.hero > *:not(.hero-rays):not(.orb){position:relative;z-index:1;}
.hero-vignette{display:none!important;}
.hero-ctas a.btn, .hero-ctas button.btn{background-color:rgba(10,10,11,.52);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);}
.hero-ctas .btn.primary, .hero-ctas .btn-primary, .hero-ctas [class*="primary"]{background-color:var(--accent,#ea6a2c);backdrop-filter:none;-webkit-backdrop-filter:none;}`; }

// Banner hero for .dex-hero (Trade / Pools desktop)
function BANNER(art){ return `
.dex-hero{position:relative;isolation:isolate;overflow:hidden;}
.dex-hero::before{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;
  background-image:url("${art}");background-size:cover;background-position:center;border-radius:inherit;}
.dex-hero::after{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;border-radius:inherit;
  background:linear-gradient(90deg, rgba(10,10,11,.80) 0%, rgba(10,10,11,.48) 42%, rgba(10,10,11,.12) 74%, rgba(10,10,11,.22) 100%);}
.dex-hero > *{position:relative;z-index:1;}`; }

// Ambient top band for inner pages (safe on any layout: paints above body bg, below content)
function AMBIENT(art){ return `
body{isolation:isolate;}
body::before{content:'';position:absolute;top:0;left:0;right:0;height:560px;z-index:-1;pointer-events:none;
  background-image:url("${art}");background-size:cover;background-position:center 28%;opacity:.55;
  -webkit-mask-image:linear-gradient(180deg,#000 0%,#000 34%,transparent 100%);
          mask-image:linear-gradient(180deg,#000 0%,#000 34%,transparent 100%);}`; }

// Per-slide slider art keyed on the slides' own data-theme attributes.
function SLIDES(map){
  return Object.entries(map).map(([theme, art]) => `
.lumos-promo-slide[data-theme="${theme}"]::before{background:
  linear-gradient(90deg, rgba(10,10,11,.90) 0%, rgba(10,10,11,.58) 44%, rgba(10,10,11,.14) 76%, rgba(10,10,11,.24) 100%),
  url("${art}") right center / cover no-repeat;}
.lumos-promo{isolation:isolate;}`).join('\n');
}

function buildBlocks(){
  const a = {
    landing:  dataUri('hero-landing.jpg'),
    trade:    dataUri('hero-trade.jpg'),
    pools:    dataUri('hero-pools.jpg'),
    asset:    dataUri('hero-asset.jpg'),
    poolDet:  dataUri('hero-pool-detail.jpg'),
    bridge:   dataUri('hero-bridge.jpg'),
    rewards:  dataUri('hero-rewards.jpg'),
    token:    dataUri('hero-token.jpg'),
    wallet:   dataUri('hero-wallet.jpg'),
    launch:   dataUri('hero-launch.jpg'),
  };
  const tradeSlides = { dex: dataUri('slide-dex.jpg'), discover: dataUri('slide-discover.jpg'), fees: dataUri('slide-fees.jpg'), secure: dataUri('slide-secure.jpg') };
  const poolSlides  = { earn: dataUri('slide-earn.jpg'), boost: dataUri('slide-boost.jpg'), open: dataUri('slide-open.jpg'), speed: dataUri('slide-speed.jpg') };

  const wrap = css => `<style id="lx-imagery">${css}\n${GRAIN_LAYER}\n</style>`;
  return { a, tradeSlides, poolSlides, wrap };
}

// page-key → css block
function blockFor(key, B_){
  const { a, tradeSlides, poolSlides, wrap } = B_;
  if (/^lumoscore-landing(-mobile)?\.html$/.test(key))                    return wrap(LANDING(a.landing));
  if (/^lumoscore-dex(-dark)?\.html$/.test(key))                          return wrap(BANNER(a.trade) + SLIDES(tradeSlides));
  if (/^lumoscore-dex-mobile\.html$/.test(key))                           return wrap(AMBIENT(a.trade) + SLIDES(tradeSlides));
  if (/^lumoscore-amm(-dark)?\.html$/.test(key))                          return wrap(BANNER(a.pools) + SLIDES(poolSlides));
  if (/^lumoscore-amm-mobile\.html$/.test(key))                           return wrap(AMBIENT(a.pools) + SLIDES(poolSlides));
  if (/^lumoscore-dex-asset(-dark|-mobile)?\.html$/.test(key))            return wrap(AMBIENT(a.asset));
  if (/^lumoscore-asset-overview(-dark|-mobile)?\.html$/.test(key))       return wrap(AMBIENT(a.asset));
  if (/^lumoscore-amm-pool(-dark|-mobile)?\.html$/.test(key))             return wrap(AMBIENT(a.poolDet));
  if (/^lumoscore-bridge(-dark|-mobile)?\.html$/.test(key))               return wrap(AMBIENT(a.bridge));
  if (/^lumoscore-rewards(-dark|-light|-mobile)?\.html$/.test(key))       return wrap(AMBIENT(a.rewards));
  if (/^lumoscore-lumos-token(-dark|-mobile)?\.html$/.test(key))          return wrap(AMBIENT(a.token));
  if (/^lumoscore-wallet(-light|-mobile)?\.html$/.test(key))              return wrap(AMBIENT(a.wallet));
  if (/^lumoscore-launch-(token|review|confirm)(-light|-mobile)?\.html$/.test(key)) return wrap(AMBIENT(a.launch));
  return null;
}

function applyToPage(key, html, B_){
  const block = blockFor(key, B_);
  if (!block) return { html, injected:false };
  let out = html.replace(/<style id="lx-imagery">[\s\S]*?<\/style>/g, '');
  const idx = out.lastIndexOf('</head>');
  out = idx >= 0 ? out.slice(0, idx) + block + out.slice(idx) : out + block;
  return { html: out, injected:true };
}

function injectShowcase(file, write, B_){
  const data = read(file);
  const { json, s, e } = getContents(data);
  let n = 0;
  for (const k of Object.keys(json)){
    const r = applyToPage(k, json[k], B_);
    if (r.injected){ json[k] = r.html; n++; }
  }
  const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
  if (write) fs.writeFileSync(file, data.slice(0,s) + serialized + data.slice(e), 'utf8');
  return n;
}

if (require.main === module){
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const files = args.filter(x => x.endsWith('.html'));
  const B_ = buildBlocks();
  for (const f of files){
    const n = injectShowcase(f, write, B_);
    console.log((write?'[WROTE] ':'[DRY] ') + f.split(/[\\/]/).pop() + '  pagesWithArt:' + n);
  }
}
module.exports = { injectShowcase, applyToPage, buildBlocks };
