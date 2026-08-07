// Replace the legacy `lumos-promo` banner on Trade (dex) and Pools (amm) pages
// with the theme-adaptive, fully-CSS-animated "Living Market" hero.
// Usage: node _tools/inject_livemarket.js [--write]
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const CHAINS = {
  hedera:    { name:'Hedera',      base:'HBAR', usd:'$0.2734', pairs:['LUMOS/HBAR','USDC/HBAR','SAUCE/HBAR','USDT/HBAR','PAXG/HBAR','WBTC/HBAR','CLXY/HBAR'] },
  aptos:     { name:'Aptos',       base:'APT',  usd:'$8.41',   pairs:['LUMOS/APT','USDC/APT','CELL/APT','USDT/APT','PAXG/APT','WBTC/APT','RION/APT'] },
  starknet:  { name:'Starknet',    base:'STRK', usd:'$0.4185', pairs:['LUMOS/STRK','USDC/STRK','LORDS/STRK','USDT/STRK','PAXG/STRK','WBTC/STRK','ZRO/STRK'] },
  vechain:   { name:'VeChain',     base:'VET',  usd:'$0.0452', pairs:['LUMOS/VET','USDC/VET','BANANA/VET','USDT/VET','BIGV/VET','3DT/VET','GEMS/VET'] },
  worldchain:{ name:'World Chain', base:'WLD',  usd:'$2.31',   pairs:['LUMOS/WLD','USDC/WLD','PUF/WLD','USDT/WLD','WGEM/WLD','GFY/WLD','SUSHI/WLD'] },
};
// preset deterministic changes + tvl values so no JS/random is needed
const CHG = ['+2.41','+0.08','-1.20','+7.10','+18.72','+0.44','-0.03','+1.15','+3.60','-2.44'];
const TVL = ['$1.43M','$1.13M','$480K','$287K','$422K','$313K','$196K','$88K'];
const BARS = [45,62,50,70,58,80,66,90,72,85,60,95,78,68,88,74,92,64,82,70,96,80,88,72];

const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

const LINE = 'M0,200 L40,175 L80,210 L120,160 L160,185 L200,140 L240,170 L280,120 L320,150 L360,105 L400,145 L440,115 L480,160 L520,130 L560,190 L600,165 L640,200 L680,175 L720,210 L760,160 L800,185 L840,140 L880,170 L920,120 L960,150 L1000,105 L1040,145 L1080,115 L1120,160 L1160,130 L1200,190 L1240,165 L1280,200';
const AREA = 'M0,300 L' + LINE.slice(1) + ' L1280,300 Z';
const PLINE = 'M0,250 L64,238 L128,242 L192,224 L256,230 L320,208 L384,214 L448,190 L512,196 L576,172 L640,178 L704,238 L768,242 L832,224 L896,230 L960,208 L1024,214 L1088,190 L1152,196 L1216,172 L1280,178';
const PAREA = 'M0,300 L' + PLINE.slice(1) + ' L1280,300 Z';

function barsHTML(){ return BARS.map((v,i)=>`<i style="height:${v}%;animation-delay:${(-i*0.24).toFixed(2)}s"></i>`).join(''); }
function depthHTML(){ // gaussian concentrated-liquidity distribution, breathing outward from the price
  const N=30, c=(N-1)/2, sig=6; let out='';
  for (let i=0;i<N;i++){
    const h=Math.round(15 + 82*Math.exp(-((i-c)*(i-c))/(2*sig*sig)));
    const d=(-Math.abs(i-c)*0.16).toFixed(2);
    const mid=Math.abs(i-c)<=1?' mid':'';
    out+=`<i class="ld${mid}" style="height:${h}%;animation-delay:${d}s"></i>`;
  }
  return out;
}

function tradeTicker(cfg){
  const syms = [...new Set(cfg.pairs.map(p=>p.split('/')[0]))];
  const one = syms.map((s,i)=>{ const c=CHG[i%CHG.length], up=parseFloat(c)>=0;
    return `<b>${s} <span>&middot;</span> <span class="${up?'up':'dn'}">${up?'&#9650;':'&#9660;'} ${Math.abs(parseFloat(c))}%</span></b>`; }).join('');
  return one+one;
}
function poolsTicker(cfg){
  const one = cfg.pairs.slice(0,8).map((p,i)=>`<b>${p} <span>&middot;</span> <span class="up">${TVL[i%TVL.length]}</span></b>`).join('');
  return one+one;
}

function styleBlock(){ return `<style id="lx-livemarket">
.lumos-promo.lm-on{background:radial-gradient(120% 95% at 88% 6%,var(--accent-pale),transparent 52%),var(--surface) !important;border:1px solid var(--border) !important;min-height:300px;padding:0 !important}
.lm{position:relative;width:100%;height:100%;min-height:300px;border-radius:15px;overflow:hidden}
.lm *{box-sizing:border-box}
.lm-bg{position:absolute;inset:0;z-index:0;width:100%;height:100%;object-fit:cover;pointer-events:none;opacity:.42;-webkit-mask:radial-gradient(135% 125% at 100% 0%,#000 6%,transparent 66%);mask:radial-gradient(135% 125% at 100% 0%,#000 6%,transparent 66%)}
html[data-theme="dark"] .lm-bg{opacity:.46}
html[data-theme="light"] .lm-bg{opacity:.09}
.lm::before{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;opacity:.5;background:repeating-linear-gradient(0deg,transparent 0 43px,var(--border) 43px 44px);-webkit-mask:linear-gradient(90deg,transparent,#000 40%);mask:linear-gradient(90deg,transparent,#000 40%)}
.lm::after{content:"";position:absolute;inset:0;z-index:3;pointer-events:none;background:linear-gradient(100deg,var(--surface) 20%,transparent 62%)}
.lm-streams{position:absolute;inset:0;z-index:1;-webkit-mask:linear-gradient(90deg,transparent 8%,#000 46%,#000 92%,transparent 100%);mask:linear-gradient(90deg,transparent 8%,#000 46%,#000 92%,transparent 100%)}
.lm-streams svg{position:absolute;inset:0;width:100%;height:100%}
.lm-svg{position:absolute;right:0;top:0;width:100%;height:calc(100% - 34px);z-index:2}
.lm-line{fill:none;stroke:var(--accent);stroke-width:2.4;stroke-linejoin:round;stroke-linecap:round;filter:drop-shadow(0 0 6px var(--accent-soft))}
.lm-area{fill:url(#lmg)}
.lm-bars{position:absolute;left:0;right:0;bottom:34px;height:50px;z-index:2;display:flex;align-items:flex-end;gap:4px;padding:0 8px;opacity:.36;-webkit-mask:linear-gradient(90deg,transparent,#000 45%);mask:linear-gradient(90deg,transparent,#000 45%)}
.lm-bars i{flex:1;background:linear-gradient(180deg,var(--accent),transparent);border-radius:2px 2px 0 0;transform-origin:bottom;animation:lm-breathe 5.6s ease-in-out infinite}
@keyframes lm-breathe{0%,100%{transform:scaleY(.55)}50%{transform:scaleY(1)}}
.lm-pool{position:absolute;left:34%;top:0;width:38%;height:calc(100% - 34px);z-index:2;pointer-events:none;overflow:hidden}
.lm-surface{position:absolute;left:8%;right:6%;top:58%;height:1px;background:linear-gradient(90deg,transparent,var(--accent-soft),transparent)}
.lm-rip{position:absolute;top:58%;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;border:1.5px solid var(--accent);opacity:0;animation:lm-rip 5.5s ease-out infinite}
.lm-rip.a{left:14%;border-color:var(--accent);animation-delay:0s}
.lm-rip.b{left:40%;border-color:var(--blue);animation-delay:-.9s}
.lm-rip.c{left:64%;border-color:var(--green);animation-delay:-1.8s}
.lm-rip.d{left:88%;border-color:var(--accent);animation-delay:-2.7s}
@keyframes lm-rip{0%{transform:scale(.3);opacity:.75}100%{transform:scale(4);opacity:0}}
/* Pools: calm liquidity-depth bell curve + quiet current-price marker */
.lm-bell{animation:lm-glow 7s ease-in-out infinite}
@keyframes lm-glow{0%,100%{filter:drop-shadow(0 0 4px var(--accent-soft))}50%{filter:drop-shadow(0 0 9px var(--accent-soft))}}
.lm-pmark-pool{position:absolute;left:67%;top:20%;bottom:34px;z-index:3;width:0;border-left:1px dashed var(--accent);opacity:.4;pointer-events:none}
/* Pools: filling liquid vessel */
.lm-pools,.lm-pools .lm{min-height:330px !important}
.lm-c-pool{max-width:58% !important}
.lm-c-pool .lm-h{font-size:21px;line-height:1.16}
.lm-pool2{position:absolute;right:4%;top:calc(50% - 17px);transform:translateY(-50%);width:158px;height:158px;z-index:2}
.lm-pool2 .glow{position:absolute;inset:-18%;border-radius:50%;background:radial-gradient(circle,var(--accent-soft),transparent 68%);filter:blur(6px)}
.lm-vessel{position:absolute;inset:0;border-radius:50%;overflow:hidden;border:1.5px solid var(--accent-soft);background:var(--surface-2);box-shadow:inset 0 2px 10px rgba(0,0,0,.25),inset 0 0 0 1px rgba(255,255,255,.04)}
.lm-vessel svg{position:absolute;inset:0;width:100%;height:100%}
.lm-vessel .rim{position:absolute;inset:0;border-radius:50%;pointer-events:none;box-shadow:inset 0 3px 12px rgba(255,255,255,.16),inset 0 -10px 24px rgba(0,0,0,.22)}
.lm-vessel .tk{position:absolute;left:50%;top:32%;transform:translate(-50%,-50%);z-index:3;font:800 14px 'JetBrains Mono',monospace;color:var(--text);letter-spacing:.02em;opacity:.85}
.lm-coin{position:absolute;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font:800 14px 'JetBrains Mono',monospace;color:#fff;z-index:3;border:2px solid var(--surface);box-shadow:0 8px 18px -6px rgba(0,0,0,.5)}
.lm-coin.a{left:-6px;top:22%;background:linear-gradient(180deg,#ff9a5c,#ea6a2c);animation:lm-bobA 4.5s ease-in-out infinite}
.lm-coin.b{right:-6px;top:44%;background:linear-gradient(180deg,#33333d,#17171d);animation:lm-bobB 5.2s ease-in-out infinite}
@keyframes lm-bobA{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes lm-bobB{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}
/* (legacy, unused) concentrated-liquidity depth histogram */
.lm-depth{position:absolute;right:6px;bottom:34px;height:70%;width:62%;z-index:2;display:flex;align-items:flex-end;justify-content:center;gap:3px;padding:0 10px;-webkit-mask:linear-gradient(90deg,transparent,#000 32%);mask:linear-gradient(90deg,transparent,#000 32%)}
.lm-depth i{width:8px;flex:0 0 auto;border-radius:3px 3px 0 0;transform-origin:bottom;background:linear-gradient(180deg,var(--accent),var(--accent-soft));animation:lm-liq 5.8s ease-in-out infinite}
.lm-depth i.mid{background:linear-gradient(180deg,#ffb27a,var(--accent))}
@keyframes lm-liq{0%,100%{transform:scaleY(.9)}50%{transform:scaleY(1.07)}}
.lm-pmark{position:absolute;left:50%;top:-7%;bottom:0;z-index:3;width:0;border-left:1px dashed var(--accent);opacity:.6}
.lm-pmark span{position:absolute;top:32%;left:50%;transform:translate(-50%,-50%);font:600 9px/1 'JetBrains Mono',monospace;color:var(--accent);white-space:nowrap;background:var(--surface);padding:3px 7px;border-radius:6px;border:1px solid var(--accent-soft);box-shadow:0 4px 12px -4px rgba(0,0,0,.4)}
.lm-c{position:relative;z-index:4;padding:24px 26px;max-width:64%}
.lm-h{margin:0;font-size:26px;line-height:1.12;font-weight:800;letter-spacing:-.025em;color:var(--text)}
.lm-h em{font-style:normal;color:var(--accent)}
.lm-sub{margin:10px 0 0;font-size:13px;line-height:1.5;color:var(--text-muted);max-width:34ch}
.lm-cta{margin-top:18px;display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:13.5px;color:#fff;text-decoration:none;background:linear-gradient(180deg,var(--accent-2,#ff894c),var(--accent));padding:10px 17px;border-radius:11px;box-shadow:0 10px 24px -10px var(--accent-soft),inset 0 1px 0 rgba(255,255,255,.28)}
.lm-cta svg{width:16px;height:16px}
.lm-chip{position:absolute;top:20px;right:20px;z-index:5;display:flex;flex-direction:column;gap:3px;background:var(--surface-2);border:1px solid var(--border);border-radius:12px;padding:9px 12px;min-width:148px}
.lm-chip .p1{font:600 10px/1 'JetBrains Mono',monospace;letter-spacing:.08em;color:var(--text-soft)}
.lm-chip .p2{font:600 18px/1 'JetBrains Mono',monospace;color:var(--text);letter-spacing:-.01em}
.lm-chip .p3{font:600 11px/1 'JetBrains Mono',monospace;color:var(--green);display:flex;align-items:center;gap:4px}
.lm-tick{position:absolute;left:0;right:0;bottom:0;height:34px;z-index:6;display:flex;align-items:center;overflow:hidden;background:var(--surface-2);border-top:1px solid var(--border)}
.lm-track{display:inline-flex;gap:26px;white-space:nowrap;padding-left:26px;animation:lm-marq 48s linear infinite;will-change:transform}
.lm-track b{font:600 12px/1 'JetBrains Mono',monospace;color:var(--text-muted);display:inline-flex;gap:7px;align-items:center}
.lm-track b span{color:var(--text-soft)}
.lm-track b .up{color:var(--green)}
.lm-track b .dn{color:var(--red)}
@keyframes lm-marq{to{transform:translateX(-50%)}}
@media (prefers-reduced-motion:reduce){.lm-bars i,.lm-rip,.lm-track,.lm-svg g *{animation:none !important}}
</style>`; }

function svgChart(area, line){ return `<svg class="lm-svg" viewBox="0 0 640 300" preserveAspectRatio="none"><defs><linearGradient id="lmg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".28"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs><g><animateTransform attributeName="transform" type="translate" from="0 0" to="-640 0" dur="28s" repeatCount="indefinite"/><path class="lm-area" d="${area}"/><path class="lm-line" d="${line}"/></g></svg>`; }
// calm static liquidity-depth bell curve (Pools) — no scroll, no jitter
function bellPath(){ const W=640,H=300,cx=430,sig=120,amp=210,base=290; const pts=[]; for(let x=0;x<=W;x+=16){pts.push([x,Math.round(base-amp*Math.exp(-((x-cx)*(x-cx))/(2*sig*sig)))]);} const line='M'+pts.map(p=>p[0]+','+p[1]).join(' L'); const area='M0,'+H+' L'+pts.map(p=>p[0]+','+p[1]).join(' L')+' L'+W+','+H+' Z'; return {line,area}; }
function svgBell(){ const b=bellPath(); return `<svg class="lm-svg" viewBox="0 0 640 300" preserveAspectRatio="none"><defs><linearGradient id="lmg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".26"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs><path class="lm-area" d="${b.area}"/><path class="lm-line lm-bell" d="${b.line}"/></svg>`; }

function buildTrade(cfg){
  return styleBlock() + `<div class="lumos-promo lm-on" aria-label="${cfg.name} DEX"><div class="lm">`
    + svgChart(AREA, LINE)
    + `<div class="lm-bars">${barsHTML()}</div>`
    + `<div class="lm-chip"><div class="p1">${cfg.base}</div><div class="p2">${cfg.usd}</div><div class="p3"><span>&#9650;</span> 2.41%</div></div>`
    + `<div class="lm-c"><h2 class="lm-h">The most advanced <em>DEX</em> on ${cfg.name}.</h2>`
    + `<p class="lm-sub">Pro order types, deep liquidity, and lightning-fast execution &mdash; built for serious traders.</p>`
    + `<a class="lm-cta" href="lumoscore-dex-asset.html">Start Trading ${arrow}</a></div>`
    + `</div></div>`;
}
function buildPools(cfg){
  // flowing liquidity streams (ember currents flowing across the right, masked behind the copy)
  const W = 520, VW = 260;
  const wave = (y, amp, periods, phase) => { let pts=[], steps=periods*22; for (let i=0;i<=steps;i++){ let x=(i/steps)*W; let yy=y+amp*Math.sin((i/steps)*periods*2*Math.PI+phase); pts.push((i?'L':'M')+x.toFixed(1)+','+yy.toFixed(1)); } return pts.join(' '); };
  const S = [[70,12,6,1.4,.5,13,'a2'],[112,20,5,2.6,.95,9,'a'],[150,15,6,1.6,.6,15,'a2'],[192,24,4,3.2,.85,7.5,'a'],[232,18,6,2,.55,12,'a2']];
  let svg = `<svg viewBox="0 0 ${VW} 300" preserveAspectRatio="none"><defs>`
    + `<linearGradient id="pga" x1="0" x2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity="0"/><stop offset=".35" stop-color="var(--accent)"/><stop offset=".7" stop-color="var(--accent-2,#ff894c)"/><stop offset="1" stop-color="var(--accent-2,#ff894c)" stop-opacity="0"/></linearGradient>`
    + `<linearGradient id="pga2" x1="0" x2="1"><stop offset="0" stop-color="var(--accent-2,#ff894c)" stop-opacity="0"/><stop offset=".5" stop-color="var(--accent-2,#ff894c)"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>`;
  S.forEach(s => { const d = wave(s[0],s[1],s[2],s[0]); svg += `<g><animateTransform attributeName="transform" type="translate" from="0 0" to="-${VW} 0" dur="${s[5]}s" repeatCount="indefinite"/><path d="${d}" fill="none" stroke="url(#pg${s[6]})" stroke-width="${s[3]}" stroke-linecap="round" opacity="${s[4]}"/></g>`; });
  svg += `</svg>`;
  return styleBlock() + `<div class="lumos-promo lm-on lm-pools" aria-label="${cfg.name} AMM"><div class="lm">`
    + `<div class="lm-streams">${svg}</div>`
    + `<div class="lm-chip"><div class="p1">TOTAL VALUE LOCKED</div><div class="p2">$5.32M</div><div class="p3"><span>&#9650;</span> 4.2% &middot; 7d</div></div>`
    + `<div class="lm-c lm-c-pool"><h2 class="lm-h">Provide liquidity, earn <em>swap fees</em>.</h2>`
    + `<p class="lm-sub">Deposit a token pair and earn a share of the fee from every swap routed through the pool.</p>`
    + `<a class="lm-cta" href="lumoscore-amm-pool.html">Provide Liquidity ${arrow}</a></div>`
    + `</div></div>`;
}

// Replace the FIRST <div class="lumos-promo ...> ... </div> (div-depth matched) with `replacement`.
function replacePromo(html, replacement){
  const s = html.indexOf('<div class="lumos-promo');
  if (s < 0) return { html, changed:false };
  let i = html.indexOf('>', s) + 1, depth = 1;
  while (depth > 0){
    const n = html.indexOf('<div', i), c = html.indexOf('</div>', i);
    if (c < 0) break;
    if (n >= 0 && n < c){ depth++; i = n + 4; } else { depth--; i = c + 6; }
  }
  return { html: html.slice(0, s) + replacement + html.slice(i), changed:true };
}

const TARGETS = [
  { keys:['lumoscore-dex.html','lumoscore-dex-dark.html'], build:buildTrade },
  { keys:['lumoscore-amm.html','lumoscore-amm-dark.html'], build:buildPools },
];

const write = process.argv.includes('--write');
for (const chain of Object.keys(CHAINS)){
  const cfg = CHAINS[chain];
  const file = `lumoscore-${chain}-desktop.html`;
  const data = read(file);
  const { json, s, e } = getContents(data);
  let hits = 0;
  for (const t of TARGETS){
    const rep = t.build(cfg);
    for (const k of t.keys){
      if (!json[k]) continue;
      if (!/<div class="lumos-promo/.test(json[k])) { console.log(`   - ${chain}/${k}: no promo markup, skip`); continue; }
      // strip prior injected style so re-runs don't accumulate duplicate <style> blocks
      json[k] = json[k].replace(/<style id="lx-livemarket">[\s\S]*?<\/style>/g,'');
      const r = replacePromo(json[k], rep);
      if (r.changed){ json[k] = r.html; hits++; }
    }
  }
  if (write){
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
  console.log(`${write?'[WROTE]':'[DRY]'} ${chain}: replaced ${hits} promo blocks`);
}
