// Standalone prototype v2 — Font-Awesome-grade LumosCore landing.
// Dense flanking logo walls, rounded chunky font, VIBRANT colored cards with real graphics,
// hard offset shadows, LumosCore ember accent. Writes dist/_fa-landing.html.  node _tools/_falanding.js
const fs=require('fs');
const netlogos=require(__dirname+'/_netlogos.json');
const A=require(__dirname+'/_chainassets.json');
const real={}; netlogos.forEach(x=>real[x.name]=x.logo);
real['Aptos']='<img src="'+A.aptosLogo+'" alt="Aptos">';

const NET={
 'Ethereum':['#627eea','ETH'],'Solana':['#9945ff','SOL'],'Sui':['#4da2ff','SUI'],'Polygon':['#8247e5','POL'],
 'Avalanche':['#e84142','AVX'],'Arbitrum':['#28a0f0','ARB'],'Optimism':['#ff0420','OP'],'Base':['#0052ff','BASE'],
 'BNB Chain':['#f0b90b','BNB'],'Near':['#12b981','NEAR'],'Sei':['#9e1f19','SEI'],'Scroll':['#c9946a','SCR'],
 'Linea':['#61dfff','LIN'],'zkSync Era':['#1e69ff','ZK'],'Mantle':['#008f6b','MNT'],'Unichain':['#ff007a','UNI'],
 'Cardano':['#0033ad','ADA'],'Tron':['#ff060a','TRX'],'Moonbeam':['#e1147b','GLMR'],'Fantom':['#1969ff','FTM'],
 'Aptos':['#0b0b0b','APT'],'Hedera':['#222831','HBAR'],'VeChain':['#15bdff','VET'],'World Chain':['#1a1a1a','WLD'],
 'Starknet':['#0c0c4f','STRK'],'Stellar':['#111111','XLM'],'XRP Ledger':['#23292f','XRP']
};
const ORDER=Object.keys(NET);
function tile(name){
 const r=real[name];
 if(r) return '<span class="fx-net" title="'+name+'">'+r+'</span>';
 const m=NET[name]||['#888','?'];
 return '<span class="fx-net fx-lm" title="'+name+'" style="background:'+m[0]+'"><b>'+m[1]+'</b></span>';
}
// two dense flanking walls
function wall(n,seed){let s='';for(let i=0;i<n;i++)s+=tile(ORDER[(i*7+seed)%ORDER.length]);return s;}
let cluster='';['Ethereum','Solana','Aptos','Stellar','Polygon','Base','Sui','XRP Ledger','Hedera','Arbitrum'].forEach(n=>cluster+=tile(n));

const svg={
 arrow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="M13 6l6 6-6 6"></path></svg>',
 search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
 flame:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s5 4.5 5 9a5 5 0 0 1-10 0c0-1.5.7-3 1.5-4 .2 1.2 1 2 2 2 1.2 0 1.3-1.6.5-3-.7-1.2-.3-3 1.5-4z"></path></svg>',
 wallet:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="3.5"></rect><path d="M16 12h3"></path><path d="M3 9.5h13a2 2 0 0 1 2 2"></path></svg>',
 gift:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="5" rx="1.4"></rect><path d="M5 13v8h14v-8"></path><path d="M12 8v13"></path><path d="M12 8S9.5 3 7 4.5 8 8 12 8z"></path><path d="M12 8s2.5-5 5-3.5S16 8 12 8z"></path></svg>',
 mcp:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22M4.9 4.9l2.5 2.5M16.6 16.6l2.5 2.5M19.1 4.9l-2.5 2.5M7.4 16.6l-2.5 2.5"></path></svg>',
 // headline swoosh under a word
 swoosh:'<svg class="swoosh" viewBox="0 0 200 18" preserveAspectRatio="none"><path d="M4 12 C 50 4, 150 4, 196 11" fill="none" stroke="var(--accent)" stroke-width="6" stroke-linecap="round"/></svg>',
 // card art
 artTrade:'<svg class="art" viewBox="0 0 320 150" fill="none">'
  +'<g>'
  +[ [40,70,44],[74,52,60],[108,84,40],[142,44,66],[176,64,50],[210,30,72],[244,52,54],[278,22,64] ]
     .map((c,i)=>{const col=i%2?'#31c07a':'#ea6a2c';const wickTop=c[1]-12,wickBot=c[1]+c[2]+12;return '<line x1="'+(c[0]+10)+'" y1="'+wickTop+'" x2="'+(c[0]+10)+'" y2="'+wickBot+'" stroke="'+col+'" stroke-width="2.5"/><rect x="'+c[0]+'" y="'+c[1]+'" width="20" height="'+c[2]+'" rx="4" fill="'+col+'"/>';}).join('')
  +'</g>'
  +'<polyline points="50,96 84,80 118,100 152,66 186,84 220,52 254,72 288,44" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>'
  +'<circle cx="288" cy="44" r="5" fill="#fff"/></svg>',
 artPools:'<svg class="art" viewBox="0 0 320 150" fill="none">'
  +'<circle cx="160" cy="86" r="60" fill="none" stroke="#7c6cf5" stroke-width="2.5" opacity=".35"/>'
  +'<circle cx="160" cy="86" r="42" fill="none" stroke="#7c6cf5" stroke-width="2.5" opacity=".55"/>'
  +'<circle cx="160" cy="86" r="24" fill="#7c6cf5" opacity=".16"/>'
  +'<path d="M160 40 C150 58 138 66 138 80 a22 22 0 1 0 44 0 c0-14-12-22-22-40z" fill="#7c6cf5"/>'
  +'<circle cx="96" cy="52" r="12" fill="#a89bff"/><circle cx="232" cy="60" r="9" fill="#c9c0ff"/><circle cx="220" cy="120" r="7" fill="#a89bff"/></svg>',
 artBridge:'<svg class="art" viewBox="0 0 320 150" fill="none">'
  +'<path d="M40 104 C 110 34, 210 34, 280 104" fill="none" stroke="#1f9d63" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round" opacity=".7"/>'
  +'<circle cx="40" cy="104" r="22" fill="#1f9d63"/><text x="40" y="110" font-size="15" font-weight="800" fill="#fff" text-anchor="middle" font-family="Baloo 2,sans-serif">A</text>'
  +'<circle cx="280" cy="104" r="22" fill="#0f8f57"/><text x="280" y="110" font-size="15" font-weight="800" fill="#fff" text-anchor="middle" font-family="Baloo 2,sans-serif">B</text>'
  +'<g transform="translate(160,42)"><circle r="16" fill="#fff" stroke="#1f9d63" stroke-width="2.5"/><path d="M-1 -8 l7 8 -7 8 M1 -8 l-7 8 7 8" stroke="#1f9d63" stroke-width="2.4" stroke-linecap="round" fill="none"/></g></svg>'
};

const bigCard=(cls,tag,img,title,desc)=>'<a class="fx-feat '+cls+'" href="#"><div class="fx-art"><img src="'+img+'" alt=""><span class="fx-tag">'+tag+'</span></div>'
 +'<div class="fx-body"><h3>'+title+'</h3><p>'+desc+'</p><span class="fx-go">Explore '+svg.arrow+'</span></div></a>';
const miniCard=(cls,icon,title,desc,extra)=>'<a class="fx-mini '+cls+'" href="#"><span class="fx-mini-ic">'+icon+'</span>'
 +'<div class="fx-mini-tx"><h4>'+title+'</h4><p>'+desc+'</p></div>'+(extra||'')+'</a>';

const html=`<!doctype html><html lang="en" data-theme="light"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LumosCore — Multichain DeFi</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{
 --bg:#eef0f3; --card:#fff; --ink:#101425; --ink2:#3d4051; --muted:#767a89;
 --accent:#ea6a2c; --accent-edge:#c0521c; --accent-soft:#ffe9db;
 --iris:#7c6cf5; --rose:#ef5b8c; --green:#1f9d63; --navy:#111a33;
 --edge:#d5d7dd; --line:#e4e6ea; --shadow:0 4px 0 0 var(--edge);
}
*{box-sizing:border-box} html,body{margin:0}
body{background:var(--bg);color:var(--ink);font-family:'Hanken Grotesk',system-ui,sans-serif;font-size:17px;line-height:1.55;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
.wrap{max-width:1200px;margin:0 auto;padding:0 24px}
h1,h2,h3,h4,.disp{font-family:'Baloo 2','Hanken Grotesk',sans-serif;margin:0;line-height:1.02;letter-spacing:-.01em}

/* nav */
.nav{position:sticky;top:0;z-index:50;background:rgba(238,240,243,.9);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.nav-in{display:flex;align-items:center;gap:24px;height:72px}
.brand{display:flex;align-items:center;gap:10px;font-family:'Baloo 2',sans-serif;font-weight:800;font-size:21px}
.fx-flame{width:36px;height:36px;border-radius:11px;background:linear-gradient(150deg,#ffb454,var(--accent));color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 0 0 var(--accent-edge)}
.fx-flame svg{width:20px;height:20px}
.nav-links{display:flex;gap:22px;margin-left:12px}
.nav-links a{color:var(--muted);font-weight:600;font-size:15px;transition:color .15s}.nav-links a:hover{color:var(--ink)}
.nav-cta{margin-left:auto;display:flex;gap:11px}
.btn{display:inline-flex;align-items:center;gap:8px;font-family:'Baloo 2',sans-serif;font-weight:700;font-size:15.5px;border-radius:13px;padding:10px 18px;cursor:pointer;border:2px solid var(--ink);transition:transform .06s,box-shadow .06s}
.btn svg{width:17px;height:17px}
.btn-ghost{background:var(--card);color:var(--ink);box-shadow:0 4px 0 0 var(--edge)}
.btn-primary{background:var(--accent);color:#fff;border-color:var(--accent-edge);box-shadow:0 4px 0 0 var(--accent-edge)}
.btn:active{transform:translateY(3px);box-shadow:0 1px 0 0 var(--edge)}.btn-primary:active{box-shadow:0 1px 0 0 var(--accent-edge)}

/* hero + dense logo walls */
.hero{position:relative;overflow:hidden;padding:64px 0 34px}
.hero-field{position:absolute;inset:0;display:flex;flex-wrap:wrap;gap:12px;padding:22px 14px;align-content:flex-start;z-index:0;
 -webkit-mask-image:linear-gradient(90deg,#000 0,#000 22%,transparent 31%,transparent 69%,#000 78%,#000 100%),linear-gradient(#000,#000 70%,transparent);
 mask-image:linear-gradient(90deg,#000 0,#000 22%,transparent 31%,transparent 69%,#000 78%,#000 100%),linear-gradient(#000,#000 70%,transparent);
 -webkit-mask-composite:source-in;mask-composite:intersect}
.fx-net{width:34px;height:34px;flex:0 0 34px;border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#fff;
 filter:grayscale(1);opacity:.4;transition:filter .2s,opacity .2s,transform .2s;cursor:pointer}
.fx-net img,.fx-net svg{width:100%;height:100%;object-fit:cover;display:block}
.fx-net.fx-lm b{color:#fff;font-weight:800;font-size:8.5px;letter-spacing:.01em}
.fx-net:hover{filter:none;opacity:1;transform:scale(1.28);z-index:3;box-shadow:0 4px 0 0 var(--edge)}
.hero-in{position:relative;z-index:4;text-align:center;max-width:660px;margin:0 auto}
.eyebrow{display:inline-flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--line);box-shadow:0 3px 0 0 var(--edge);color:var(--ink2);font-weight:700;font-size:13px;padding:7px 15px;border-radius:999px;margin-bottom:22px}
.eyebrow .dot{width:8px;height:8px;border-radius:50%;background:var(--accent)}
.hero h1{font-size:70px;font-weight:800;letter-spacing:-.02em}
.hero h1 .u{position:relative;color:var(--accent);white-space:nowrap}
.hero h1 .u .swoosh{position:absolute;left:0;right:0;bottom:-8px;width:100%;height:16px}
.hero .sub{font-size:19px;color:var(--ink2);max-width:560px;margin:22px auto 30px;font-weight:500}
.searchbar{display:flex;align-items:center;gap:12px;background:var(--card);border:2.5px solid var(--ink);border-radius:999px;padding:8px 8px 8px 22px;max-width:600px;margin:0 auto;box-shadow:0 5px 0 0 var(--edge)}
.searchbar>svg{width:22px;height:22px;color:var(--muted);flex:0 0 auto}
.searchbar input{flex:1;border:none;outline:none;background:transparent;font-family:inherit;font-size:17px;font-weight:500}
.searchbar input::placeholder{color:var(--muted)}
.searchbar .go{display:inline-flex;align-items:center;gap:7px;background:var(--accent);color:#fff;border:2px solid var(--accent-edge);border-radius:999px;padding:11px 20px;font-family:'Baloo 2',sans-serif;font-weight:700;font-size:15.5px;cursor:pointer;box-shadow:0 3px 0 0 var(--accent-edge)}
.searchbar .go svg{width:16px;height:16px}
.hero-btns{display:flex;gap:13px;justify-content:center;margin-top:26px}

/* stat pills */
.stats{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin:6px 0 8px;position:relative;z-index:4}
.pill{background:var(--card);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);padding:16px 26px;text-align:center;min-width:180px}
.pill .n{font-family:'Baloo 2',sans-serif;font-size:32px;font-weight:800;line-height:1}
.pill .l{color:var(--muted);font-weight:700;font-size:12.5px;text-transform:uppercase;letter-spacing:.06em;margin-top:4px}
.pill.hot{background:var(--accent);border-color:var(--accent-edge);box-shadow:0 4px 0 0 var(--accent-edge)}
.pill.hot .n{color:#fff}.pill.hot .l{color:#ffe3d1}

/* sections */
.sec{padding:66px 0}
.sec-h{text-align:center;max-width:640px;margin:0 auto 40px}
.sec-h .k{color:var(--accent);font-weight:800;font-size:13px;text-transform:uppercase;letter-spacing:.12em}
.sec-h h2{font-size:44px;font-weight:800;margin:10px 0}
.sec-h p{color:var(--ink2);font-size:18px;margin:0;font-weight:500}

/* vibrant feature cards — real illustrations bleed into the card */
.feats{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
.fx-feat{position:relative;display:block;border-radius:24px;border:2px solid var(--ink);box-shadow:0 6px 0 0 var(--ink);transition:transform .09s,box-shadow .09s;overflow:hidden;background:var(--cbg)}
.fx-feat:hover{transform:translateY(-4px);box-shadow:0 10px 0 0 var(--ink)}
.fx-art{position:relative;height:212px;overflow:hidden}
.fx-art img{width:100%;height:100%;object-fit:cover;object-position:center 42%;display:block}
.fx-art::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:64px;background:linear-gradient(transparent,var(--cbg))}
.fx-body{padding:2px 26px 26px}
.fx-feat h3{font-size:27px;font-weight:800;margin-bottom:8px}
.fx-feat p{font-size:15.5px;margin:0 0 18px;font-weight:500}
.fx-go{display:inline-flex;align-items:center;gap:7px;font-family:'Baloo 2',sans-serif;font-weight:700;font-size:15px}.fx-go svg{width:16px;height:16px}
.fx-tag{position:absolute;top:16px;right:16px;z-index:2;font-family:'Baloo 2',sans-serif;font-weight:700;font-size:11px;letter-spacing:.06em;text-transform:uppercase;padding:5px 11px;border-radius:999px;backdrop-filter:blur(4px)}
.feat-trade{--cbg:#1b2b61;color:#fff}.feat-trade p{color:#c3c9e0}.feat-trade .fx-go{color:#ffb884}.feat-trade .fx-tag{background:rgba(255,255,255,.18);color:#fff}
.feat-pools{--cbg:#fdfdff;color:var(--ink)}.feat-pools p{color:#5b5570}.feat-pools .fx-go{color:var(--iris)}.feat-pools .fx-tag{background:#efeaff;color:var(--iris)}
.feat-bridge{--cbg:#ecfbff;color:var(--ink)}.feat-bridge p{color:#3f6152}.feat-bridge .fx-go{color:var(--green)}.feat-bridge .fx-tag{background:#d7f2ea;color:var(--green)}

.minis{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:22px}
.fx-mini{display:flex;flex-direction:column;gap:13px;border-radius:20px;padding:22px;border:2px solid var(--ink);box-shadow:0 5px 0 0 var(--ink);transition:transform .09s,box-shadow .09s}
.fx-mini:hover{transform:translateY(-3px);box-shadow:0 8px 0 0 var(--ink)}
.fx-mini-ic{width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.6)}
.fx-mini-ic svg{width:24px;height:24px}
.fx-mini-tx h4{font-family:'Baloo 2',sans-serif;font-size:19px;font-weight:700}
.fx-mini-tx p{font-size:14px;margin:4px 0 0;font-weight:500}
.mini-wallet{background:#ffe6d6}.mini-wallet .fx-mini-ic{color:var(--accent)}.mini-wallet p{color:#9a6a4c}
.mini-rewards{background:#ffe1ec}.mini-rewards .fx-mini-ic{color:var(--rose)}.mini-rewards p{color:#9c5772}
.mini-mcp{background:#d9f3e6}.mini-mcp .fx-mini-ic{color:var(--green)}.mini-mcp p{color:#4a7861}
.mini-multi{background:var(--navy);color:#fff}.mini-multi .fx-mini-ic{background:rgba(255,255,255,.12);color:#fff}.mini-multi p{color:#b9bdcc}
.fx-cluster{display:flex;flex-wrap:wrap;gap:6px;margin-top:auto}
.fx-cluster .fx-net{width:30px;height:30px;flex:0 0 30px;filter:none;opacity:1;cursor:default}
.fx-cluster .fx-net.fx-lm b{font-size:7.5px}

/* dashboard window */
.showcase{background:var(--card);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.win{max-width:1040px;margin:0 auto;border-radius:20px;overflow:hidden;border:2.5px solid var(--ink);box-shadow:0 8px 0 0 var(--ink);background:#f4f5f7}
.win-bar{display:flex;align-items:center;gap:8px;padding:12px 16px;background:var(--card);border-bottom:1px solid var(--line)}
.win-bar i{width:12px;height:12px;border-radius:50%}.win-bar .r{background:#ff6058}.win-bar .y{background:#ffbd2e}.win-bar .g{background:#28c93f}
.win-bar span{margin-left:12px;color:var(--muted);font-size:13px;font-weight:600;background:var(--bg);border-radius:8px;padding:5px 12px}
.win img{width:100%;display:block}

/* CTA + footer */
.cta{padding:78px 0}
.cta .card{position:relative;overflow:hidden;background:var(--navy);color:#fff;border-radius:30px;padding:58px 30px;text-align:center;border:2.5px solid #000;box-shadow:0 8px 0 0 #000}
.cta h2{font-size:42px;font-weight:800}
.cta p{color:#c3c7d6;font-size:18px;margin:14px 0 28px;font-weight:500}
.cta .btn-ghost{background:var(--accent);color:#fff;border-color:#000;box-shadow:0 4px 0 0 #000}
.cta .band{position:absolute;left:-10%;right:-10%;bottom:-30px;display:flex;gap:10px;justify-content:center;opacity:.14;pointer-events:none}
.cta .band .fx-net{filter:grayscale(1) brightness(3);opacity:1}
footer{border-top:1px solid var(--line);padding:32px 0;color:var(--muted);font-size:14.5px;font-weight:600}
.foot-in{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}

@media(max-width:900px){.hero h1{font-size:46px}.feats{grid-template-columns:1fr}.minis{grid-template-columns:repeat(2,1fr)}.nav-links{display:none}}
</style></head><body>

<nav class="nav"><div class="wrap nav-in">
 <div class="brand"><span class="fx-flame">${svg.flame}</span>LUMOSCORE</div>
 <div class="nav-links"><a href="#">Multichain</a><a href="#">Non-custodial</a><a href="#">Open source</a><a href="#">All-in-one</a><a href="#">Infrastructure</a></div>
 <div class="nav-cta"><a class="btn btn-ghost" href="#">Docs</a><a class="btn btn-primary" href="#">Launch App ${svg.arrow}</a></div>
</div></nav>

<header class="hero">
 <div class="hero-field">${wall(300,0)}</div>
 <div class="wrap"><div class="hero-in">
  <span class="eyebrow"><span class="dot"></span>7 chains. One liquidity layer.</span>
  <h1>Trade. Bridge.<br><span class="u">Earn.${svg.swoosh}</span></h1>
  <p class="sub">One non-custodial app for every network — swap, pool, and bridge assets across chains from a single place.</p>
  <div class="searchbar">${svg.search}<input placeholder="Search any asset across networks…"><button class="go">Search ${svg.arrow}</button></div>
  <div class="hero-btns"><a class="btn btn-primary" href="#">Launch App ${svg.arrow}</a><a class="btn btn-ghost" href="#">Explore networks</a></div>
 </div></div>
</header>

<section class="wrap"><div class="stats">
 <div class="pill"><div class="n">7</div><div class="l">Supported networks</div></div>
 <div class="pill"><div class="n">1,500+</div><div class="l">Assets</div></div>
 <div class="pill"><div class="n">8,000+</div><div class="l">Total trades</div></div>
 <div class="pill hot"><div class="n">$100k+</div><div class="l">Total traded</div></div>
</div></section>

<section class="sec"><div class="wrap">
 <div class="sec-h"><div class="k">Everything, onchain</div><h2>One app. Every move.</h2><p>Trade, pool, and bridge across 7 networks — plus the tools to manage it all.</p></div>
 <div class="feats">
  ${bigCard('feat-trade','Live','_fa-trade.png','Trade','Orderbook + AMM swaps with best-price routing on every pair.')}
  ${bigCard('feat-pools','Earn','_fa-pools.png','Pools','Provide liquidity to concentrated pools and earn fees on every swap.')}
  ${bigCard('feat-bridge','7 chains','_fa-bridge.png','Cross-chain','Move assets between networks through trusted bridges, one flat fee.')}
 </div>
 <div class="minis">
  ${miniCard('mini-wallet',svg.wallet,'My Wallet','Balances & positions, all chains.')}
  ${miniCard('mini-rewards',svg.gift,'Rewards','Earn points and claim perks.')}
  ${miniCard('mini-mcp',svg.mcp,'MCP','Plug LumosCore into your AI agents.')}
  ${miniCard('mini-multi',svg.flame,'Multichain','Seven networks, one account.','<div class="fx-cluster">'+cluster+'</div>')}
 </div>
</div></section>

<section class="showcase"><div class="sec"><div class="wrap">
 <div class="sec-h"><div class="k">Your control center</div><h2>Your whole portfolio. One dashboard.</h2><p>Every balance, pool, and trade across all networks — in a single, clean view.</p></div>
 <div class="win"><div class="win-bar"><i class="r"></i><i class="y"></i><i class="g"></i><span>app.lumoscore.io/dashboard</span></div><img src="_fa-dash.png" alt="LumosCore dashboard"></div>
</div></div></section>

<section class="cta"><div class="wrap"><div class="card">
 <h2>Ready to go multichain?</h2>
 <p>Connect a wallet and start trading across 7 networks in seconds. Non-custodial, always.</p>
 <a class="btn btn-ghost" href="#">Launch App ${svg.arrow}</a>
 <div class="band">${wall(40,3)}</div>
</div></div></section>

<footer><div class="wrap foot-in"><div class="brand" style="font-size:17px"><span class="fx-flame" style="width:28px;height:28px;border-radius:9px">${svg.flame}</span>LUMOSCORE</div><div>© 2026 LumosCore · Non-custodial · Open source</div></div></footer>
</body></html>`;

fs.writeFileSync('dist/_fa-landing.html',html);
console.log('wrote dist/_fa-landing.html ('+(html.length/1024).toFixed(0)+' kb)');
