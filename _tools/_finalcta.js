// The closing CTA: copy, plus the product shot that sits beside it.
//
// It was a centred band -- heading, standfirst, two buttons -- on a tinted panel. It becomes a
// two-column block: the copy on the left, and on the right a picture of the app itself, which is the
// one thing the page never actually shows. RAZA's reference for this is a 3D render of a laptop on a
// mountainside with the trading screen lit up on it.
//
// WHAT THIS IS AND IS NOT. The render itself is photographic and cannot be reproduced in CSS, and no
// such asset exists in the repo (nothing matches its ~2.8 aspect and the string "Start trading"
// appears in no file). What IS reproducible is everything around it: the ambient bloom, the light
// trails, the planet edge, and the screen -- so the screen is built as real markup, tilted in 3D with
// `perspective` + `rotateY`, rather than dropped in as a picture. That also means it stays sharp at
// any resolution, restyles with the theme, and costs a few KB instead of a megabyte.
//
// THE NUMBERS ON THAT SCREEN ARE ILLUSTRATIVE, and the pair is deliberately labelled NATIVE -- not a
// real ticker -- exactly as RAZA's reference does, so nothing here reads as a live quote on a mainnet
// product. The whole block carries aria-hidden and is decorative to assistive tech.
//
// EVERY SHORT LABEL IS A CSS `content`, NOT A TEXT NODE, and that is not fussiness. The site's logo
// healer repaints any element holding 1-5 characters into a ticker logo, and this mock is full of
// them -- 4h, 1W, Buy, Max, To, Swap. Written as text they would have been turned into token badges
// one by one. `<i data-l="4h">` with `::after{content:attr(data-l)}` is invisible to it, which is the
// same escape _herounify.js uses for the network names.
//
// Both copy lines are written by REPLACING the element's contents outright rather than swapping one
// exact string for another. Matching previous wording means every copy change has to carry the last
// one with it, and the transform silently no-ops the moment the two drift apart.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const HEAD_HTML = 'Stop switching. <span class="grad">Start trading.</span>';
const SUB_HTML = 'Trade, bridge, provide liquidity, launch assets and unlock more from one '
  + 'unified platform.';

// ---- the screen ------------------------------------------------------------------------------------
// Short label -> an empty element carrying its text in an attribute. See the logo-healer note above.
const t = (s, cls) => '<i' + (cls ? ' class="' + cls + '"' : '') + ' data-l="' + s + '"></i>';

// A seeded walk, so the chart is the same on every build rather than churning the container diff.
function mulberry32(a) {
  return function () {
    a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function chartSvg() {
  const rand = mulberry32(90281);
  const N = 40, W = 560, H = 190, VH = 46, gap = 2;
  const cw = (W / N) - gap;
  // A TREND PLUS A WIGGLE, not a pure random walk, and the difference is the whole readability of
  // the chart. A walk's per-step move is small next to the total distance it travels, so the first
  // version drew 40 candles whose bodies were about 4% of the price range -- at this size that is a
  // 2px diagonal line, not a candlestick chart. Wiggling open and close independently around a slow
  // trend decouples body height from total drift, and lands bodies near 9% of the range.
  let base = 100, lo = 1e9, hi = -1e9;
  const bars = [];
  for (let i = 0; i < N; i++) {
    base += 0.44;                                   // the slow climb
    const wig = 7.2;
    const o = base + (rand() - 0.5) * wig;
    const c = base + (rand() - 0.5) * wig;
    const h = Math.max(o, c) + rand() * 1.9;
    const l = Math.min(o, c) - rand() * 1.9;
    lo = Math.min(lo, l); hi = Math.max(hi, h);
    bars.push({ o: o, c: c, h: h, l: l, v: 0.22 + rand() * 0.78 });
  }
  const pad = (hi - lo) * 0.08;
  lo -= pad; hi += pad;
  const y = (v) => H - ((v - lo) / (hi - lo)) * H;

  let body = '';
  bars.forEach((b, i) => {
    const x = i * (cw + gap);
    const up = b.c >= b.o;
    const cl = up ? 'u' : 'd';
    const top = y(Math.max(b.o, b.c));
    const hgt = Math.max(1.4, Math.abs(y(b.o) - y(b.c)));
    body += '<rect class="k' + cl + '" x="' + (x + cw / 2 - 0.5).toFixed(1) + '" y="' + y(b.h).toFixed(1)
      + '" width="1" height="' + (y(b.l) - y(b.h)).toFixed(1) + '"/>'
      + '<rect class="k' + cl + '" x="' + x.toFixed(1) + '" y="' + top.toFixed(1)
      + '" width="' + cw.toFixed(1) + '" height="' + hgt.toFixed(1) + '" rx="0.6"/>';
  });
  let vol = '';
  bars.forEach((b, i) => {
    const x = i * (cw + gap);
    const bh = b.v * VH;
    vol += '<rect class="v' + (b.c >= b.o ? 'u' : 'd') + '" x="' + x.toFixed(1) + '" y="'
      + (VH - bh).toFixed(1) + '" width="' + cw.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="0.6"/>';
  });
  return '<svg class="fw-chart" viewBox="0 0 ' + W + ' ' + (H + VH + 8) + '" preserveAspectRatio="none">'
    + '<g>' + body + '</g>'
    + '<g transform="translate(0,' + (H + 8) + ')">' + vol + '</g></svg>';
}

const ROWS = [
  ['2m ago', 'Buy', '1.2847', '432.12', '555.43'],
  ['5m ago', 'Sell', '1.2811', '120.30', '153.73'],
  ['7m ago', 'Buy', '1.2875', '892.44', '1,149.02'],
  ['11m ago', 'Sell', '1.2763', '316.00', '395.65'],
];
const OVERVIEW = [
  ['Price', '$1.2847'], ['Market Cap', '$128.4M'], ['FDV', '$1.28B'],
  ['24h Volume', '$12.4M'], ['Liquidity', '$28.7M'], ['Holders', '12.4K'],
];

const NAV = ['Trade', 'Swap', 'Liquidity', 'Bridge', 'Launch', 'Portfolio'];
const RANGES = ['1m', '5m', '1h', '4h', '1D', '1W'];
const PANES = ['Trades', 'Liquidity', 'Holders', 'Info'];

const SCREEN = '<div class="fw">'
  + '<div class="fw-top">'
  // The REAL mark, not a drawn stand-in. This started as a radial-gradient circle -- a plausible
  // orange blob -- and RAZA spotted it immediately as a placeholder logo. /assets/tokens/lumos.png is
  // the same 160x160 artwork the site header carries (the header embeds it as a base64 background;
  // compared pixel-by-pixel, 0 of 32 sampled cells differ), so this now matches the real brand exactly
  // and follows it if it ever changes. Root-relative on purpose: the landing page is served from both
  // / and /x/, and a relative `assets/...` 404s from the deeper one.
  + '<span class="fw-brand">'
  + '<img class="fw-flame" src="/assets/tokens/lumos.png" alt="" width="160" height="160"'
  + ' decoding="async">' + t('LUMOSCORE') + '</span>'
  + '<span class="fw-nav">'
  + NAV.map((n, i) => t(n, i === 0 ? 'on' : '')).join('')
  + '</span>'
  + '<span class="fw-acct">' + t('0x3e…72ee') + '</span>'
  + '</div>'

  + '<div class="fw-body">'
  + '<div class="fw-main">'
  + '<div class="fw-pair">'
  + '<span class="fw-coins"><b></b><b></b></span>'
  + '<span class="fw-pn">' + t('NATIVE / USDC') + '<em>' + t('1.2847') + '<u>' + t('+12.46%') + '</u></em></span>'
  + '<span class="fw-kpis">'
  + '<span>' + t('24h Vol') + '<b>' + t('$12.4M') + '</b></span>'
  + '<span>' + t('Liquidity') + '<b>' + t('$28.7M') + '</b></span>'
  + '<span>' + t('Holders') + '<b>' + t('12.4K') + '</b></span>'
  + '</span></div>'
  + '<div class="fw-rng">' + RANGES.map((r, i) => t(r, i === 3 ? 'on' : '')).join('') + '</div>'
  + chartSvg()
  + '<div class="fw-tabs">' + PANES.map((p, i) => t(p, i === 0 ? 'on' : '')).join('') + '</div>'
  + '<div class="fw-tbl">'
  + ROWS.map((r) => '<span class="fw-row">' + t(r[0]) + t(r[1], r[1] === 'Buy' ? 'bu' : 'se')
    + t(r[2]) + t(r[3]) + t(r[4]) + '</span>').join('')
  + '</div></div>'

  + '<aside class="fw-side">'
  + '<span class="fw-seg">' + t('Swap', 'on') + t('Limit') + '</span>'
  + '<span class="fw-fld">' + t('From') + '<b>' + t('0.0') + '</b>' + t('NATIVE', 'as') + '</span>'
  + '<span class="fw-fld">' + t('To') + '<b>' + t('0.0') + '</b>' + t('USDC', 'as') + '</span>'
  + '<span class="fw-go">' + t('Swap') + '</span>'
  + '<span class="fw-ov">' + t('NATIVE Overview')
  + OVERVIEW.map((o) => '<span>' + t(o[0]) + '<b>' + t(o[1]) + '</b></span>').join('')
  + '</span></aside>'
  + '</div></div>';

const ART = '<div class="lx-fcta-art" aria-hidden="true">'
  + '<span class="lx-fcta-planet"></span>'
  + '<svg class="lx-fcta-trail" viewBox="0 0 900 560" preserveAspectRatio="none">'
  + '<path d="M-40 470 C 190 430 300 330 520 300 C 700 276 810 250 940 196"/>'
  + '<path d="M-40 530 C 210 500 340 420 560 380 C 740 348 850 320 940 282"/>'
  + '</svg>'
  + '<div class="lx-fcta-stage">' + SCREEN + '</div>'
  + '</div>';

// ---- styles ------------------------------------------------------------------------------------------
// `.final-cta.lx-fcta` (0,2,0) throughout, because the design's own `.final-cta` (0,1,0) sets
// text-align:center, the padding and the grid overlay, and an equal-specificity rule would be at the
// mercy of which style block lands last.
const CSS = '<style id="lx-fcta-css">'
  + '.final-cta.lx-fcta{text-align:left;padding:0;overflow:hidden;'
  + 'background:radial-gradient(120% 90% at 8% 100%,rgba(234,106,44,.30),transparent 58%),'
  + 'radial-gradient(90% 80% at 92% 4%,rgba(58,86,160,.34),transparent 62%),'
  + 'linear-gradient(150deg,#0e1016 0%,#0a0b10 46%,#14100e 100%);'
  + 'border-color:rgba(234,106,44,.24)}'
  + '.final-cta.lx-fcta::after{display:none}'
  + '.lx-fcta-in{position:relative;z-index:2;display:grid;grid-template-columns:minmax(0,.86fr) minmax(0,1.14fr);'
  + 'align-items:center;gap:20px;padding:64px 0 64px 60px}'

  // -- copy
  + '.lx-fcta-copy h2{font-size:clamp(34px,4.4vw,62px);line-height:1.04;letter-spacing:-.03em;'
  + 'font-weight:800;margin:0 0 18px;text-wrap:balance}'
  + '.lx-fcta-copy h2 .grad{display:block;color:var(--accent);'
  + 'background:none;-webkit-background-clip:initial;-webkit-text-fill-color:currentColor}'
  + '.lx-fcta-copy p{font-size:clamp(15px,1.25vw,19px);line-height:1.55;color:var(--text-muted);'
  + 'margin:0 0 30px;max-width:30ch}'
  + '.final-cta.lx-fcta .ctas{justify-content:flex-start;margin:0}'

  // -- ambience
  + '.lx-fcta-art{position:relative;min-height:380px;align-self:stretch;display:flex;'
  + 'align-items:center;justify-content:flex-end}'
  // The planet edge: one big circle pushed mostly off the top-right corner, lit along its rim.
  + '.lx-fcta-planet{position:absolute;right:-9%;top:-56%;width:62%;aspect-ratio:1;border-radius:50%;'
  + 'background:radial-gradient(circle at 34% 78%,rgba(96,132,214,.40),rgba(18,24,44,.92) 62%);'
  + 'box-shadow:inset 0 -18px 42px -14px rgba(150,190,255,.45);pointer-events:none}'
  + '.lx-fcta-trail{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;'
  + 'overflow:visible}'
  + '.lx-fcta-trail path{fill:none;stroke:url(#x);stroke:rgba(255,142,66,.85);stroke-width:2;'
  + 'filter:drop-shadow(0 0 9px rgba(255,120,40,.85))}'
  + '.lx-fcta-trail path:last-child{stroke:rgba(255,120,40,.4);stroke-width:1.4}'

  // -- the tilted screen
  + '.lx-fcta-stage{position:relative;z-index:2;width:104%;perspective:1500px}'
  + '.fw{transform:rotateY(-13deg) rotateX(4deg) rotateZ(.6deg);transform-origin:right center;'
  + 'border-radius:12px 12px 10px 10px;overflow:hidden;background:#0b0d13;'
  + 'border:1px solid rgba(255,255,255,.10);'
  + 'box-shadow:0 44px 90px -40px rgba(0,0,0,.95),0 0 70px -30px rgba(234,106,44,.55),'
  + 'inset 0 1px 0 rgba(255,255,255,.07);'
  + 'font:600 5.2px/1.25 "Hanken Grotesk",system-ui,sans-serif;color:#cdd3e0}'
  // One font-size on .fw and everything inside is em, so the whole mock scales from a single number.
  + '.fw i[data-l]::after{content:attr(data-l)}'
  + '.fw i{font-style:normal;display:inline-block}'

  + '.fw-top{display:flex;align-items:center;gap:1.6em;padding:1.5em 1.8em;'
  + 'border-bottom:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.02)}'
  + '.fw-brand{display:flex;align-items:center;gap:.6em;font-size:2.1em;font-weight:800;color:#fff;'
  + 'letter-spacing:.01em}'
  + '.fw-flame{width:1.2em;height:1.2em;flex:none;object-fit:contain;display:block;'
  + 'filter:drop-shadow(0 0 .32em rgba(240,129,63,.65))}'
  + '.fw-nav{display:flex;gap:1.5em;font-size:1.9em;color:#8b93a6}'
  + '.fw-nav .on{color:#fff;position:relative}'
  + '.fw-nav .on::before{content:"";position:absolute;left:0;right:0;bottom:-.75em;height:.14em;'
  + 'border-radius:1em;background:var(--accent,#ea6a2c)}'
  + '.fw-acct{margin-left:auto;font-size:1.75em;color:#dfe4ee;padding:.5em 1em;border-radius:1em;'
  + 'background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.09)}'

  + '.fw-body{display:grid;grid-template-columns:minmax(0,1fr) 30%;gap:1.6em;padding:1.8em}'
  + '.fw-pair{display:flex;align-items:center;gap:1em;margin-bottom:1.5em}'
  + '.fw-coins{display:flex;flex:none}'
  + '.fw-coins b{width:2.6em;height:2.6em;border-radius:50%;display:block}'
  + '.fw-coins b:first-child{background:linear-gradient(140deg,#2ecb72,#12854a)}'
  + '.fw-coins b:last-child{background:linear-gradient(140deg,#5aa9ff,#1f63c8);margin-left:-.8em}'
  + '.fw-pn{display:flex;flex-direction:column;gap:.25em;font-size:1.95em;color:#fff}'
  + '.fw-pn em{font-style:normal;display:flex;align-items:baseline;gap:.5em;font-size:1.28em;'
  + 'font-weight:800}'
  + '.fw-pn u{text-decoration:none;font-size:.62em;color:#2ecb72}'
  + '.fw-kpis{margin-left:auto;display:flex;gap:1.7em;text-align:right}'
  + '.fw-kpis>span{display:flex;flex-direction:column;gap:.3em;font-size:1.7em;color:#7f889b}'
  + '.fw-kpis b{font-size:1.12em;color:#fff}'

  + '.fw-rng{display:flex;gap:.55em;margin-bottom:1em;font-size:1.7em;color:#7f889b}'
  + '.fw-rng i{padding:.35em .75em;border-radius:.5em}'
  + '.fw-rng .on{background:var(--accent,#ea6a2c);color:#fff}'
  + '.fw-chart{display:block;width:100%;height:16em;margin-bottom:1.2em;'
  + 'border:1px solid rgba(255,255,255,.06);border-radius:.6em;padding:.4em;box-sizing:border-box;'
  + 'background:rgba(255,255,255,.015)}'
  + '.fw-chart .ku{fill:#f0813f}.fw-chart .kd{fill:#4aa3ff}'
  + '.fw-chart .vu{fill:rgba(240,129,63,.42)}.fw-chart .vd{fill:rgba(74,163,255,.38)}'

  + '.fw-tabs{display:flex;gap:1.5em;font-size:1.75em;color:#7f889b;padding-bottom:.6em;'
  + 'border-bottom:1px solid rgba(255,255,255,.07);margin-bottom:.9em}'
  + '.fw-tabs .on{color:var(--accent,#ea6a2c)}'
  + '.fw-tbl{display:flex;flex-direction:column;gap:.75em;font-size:1.65em;color:#aab2c4}'
  + '.fw-row{display:grid;grid-template-columns:1.1fr .8fr 1fr 1.1fr 1.1fr;gap:.6em}'
  + '.fw-row i:nth-child(n+3){text-align:right}'
  + '.fw-row .bu{color:#2ecb72}.fw-row .se{color:#ff5a52}'

  + '.fw-side{display:flex;flex-direction:column;gap:1em}'
  + '.fw-seg{display:grid;grid-template-columns:1fr 1fr;gap:.4em;padding:.35em;border-radius:.7em;'
  + 'background:rgba(255,255,255,.05);font-size:1.75em;color:#8b93a6;text-align:center}'
  + '.fw-seg i{padding:.5em 0;border-radius:.5em}'
  + '.fw-seg .on{background:rgba(234,106,44,.16);color:var(--accent,#ea6a2c)}'
  + '.fw-fld{display:grid;grid-template-columns:1fr auto;align-items:center;gap:.4em;'
  + 'padding:.9em 1em;border-radius:.7em;background:rgba(255,255,255,.04);'
  + 'border:1px solid rgba(255,255,255,.07);font-size:1.6em;color:#7f889b}'
  + '.fw-fld b{grid-column:1;font-size:1.45em;color:#fff}'
  + '.fw-fld .as{grid-row:1/3;grid-column:2;align-self:center;padding:.45em .8em;border-radius:1em;'
  + 'background:rgba(255,255,255,.08);color:#e7ebf3}'
  + '.fw-go{text-align:center;padding:.95em 0;border-radius:.7em;font-size:1.8em;font-weight:800;'
  + 'color:#fff;background:linear-gradient(180deg,#f0813f,#e05e18);'
  + 'box-shadow:0 .5em 1.4em -.6em rgba(234,106,44,.9)}'
  + '.fw-ov{display:flex;flex-direction:column;gap:.7em;padding:1em;border-radius:.7em;'
  + 'background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);font-size:1.6em;'
  + 'color:#fff}'
  + '.fw-ov>span{display:flex;justify-content:space-between;color:#7f889b}'
  + '.fw-ov b{color:#e7ebf3}'

  // -- light theme: the panel stays dark on purpose. It is a photograph of a dark product, and a
  // washed-out version of it reads as a broken image rather than a light-mode variant.
  + '[data-theme="light"] .final-cta.lx-fcta{border-color:rgba(234,106,44,.3)}'
  + '[data-theme="light"] .lx-fcta-copy h2{color:#fff}'
  + '[data-theme="light"] .lx-fcta-copy p{color:#b9c0cf}'
  // The secondary button takes the LIGHT theme's ink -- #0e0e10 -- and this panel is dark in both
  // themes, so in light mode "Read the docs" was near-black text on a near-black panel and all but
  // disappeared. Anything sitting on this panel has to be coloured for the panel, not for the page.
  + '[data-theme="light"] .final-cta.lx-fcta .btn:not(.primary){color:#fff;'
  + 'background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.34)}'
  + '[data-theme="light"] .final-cta.lx-fcta .btn:not(.primary):hover{'
  + 'background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.5)}'

  + '@media (max-width:1180px){.lx-fcta-in{padding:52px 0 52px 44px;gap:14px}'
  + '.fw{font-size:4.5px}}'
  // One column below 1000. The screen keeps its tilt but squares up a little, because a 13-degree
  // rotation reads as a mistake once it is centred under the copy rather than leading away from it.
  + '@media (max-width:1000px){.lx-fcta-in{grid-template-columns:minmax(0,1fr);padding:46px 34px 0;'
  + 'gap:32px;text-align:center}'
  + '.lx-fcta-copy p{margin-left:auto;margin-right:auto;max-width:46ch}'
  + '.final-cta.lx-fcta .ctas{justify-content:center}'
  + '.lx-fcta-art{min-height:0;justify-content:center;padding-bottom:0}'
  + '.lx-fcta-stage{width:100%}'
  + '.fw{transform:rotateX(3deg) rotateY(-5deg);transform-origin:center bottom;font-size:5px}'
  + '.lx-fcta-planet{top:-34%;right:-18%;width:58%}}'
  + '@media (max-width:760px){.fw{font-size:3.9px}'
  + '.lx-fcta-in{padding:38px 20px 0}}'
  // Under 560 the screen is smaller than the type on it -- it stops being a product shot and becomes
  // noise, so it goes rather than shrinking further.
  + '@media (max-width:560px){.lx-fcta-art{display:none}'
  + '.lx-fcta-in{padding:34px 20px 36px}}'
  + '@media (prefers-reduced-motion:reduce){.fw{transform:none}}'
  + '</st' + 'yle>';

const PAGES = [
  { file: 'lumoscore-aptos-desktop.html', key: 'lumoscore-landing.html' },
  { file: 'lumoscore-aptos-mobile.html', key: 'lumoscore-landing-mobile.html' }
];

const problems = [];
const staged = [];

for (const p of PAGES) {
  const data = read(p.file);
  const { json, s, e } = getContents(data);
  let html = json[p.key];
  if (html == null) { problems.push(p.key + ': missing'); continue; }

  // Strip this transform's own output first, so it can be re-run. Each wrapper is removed together
  // with its CLOSING tag -- taking only the opening `<div>` out would leave an orphan `</div>` behind
  // and close the CTA one level too early on the second run.
  html = html.replace(/<style id="lx-fcta-css">[\s\S]*?<\/style>/g, '');
  html = html.replace(/<div class="lx-fcta-art"[\s\S]*?<!--\/lx-fcta-art-->/g, '');
  html = html.replace(/<div class="lx-fcta-in">/g, '')
             .replace(/<!--\/lx-fcta-in--><\/div>/g, '');
  html = html.replace(/<div class="lx-fcta-copy">/g, '')
             .replace(/<!--\/lx-fcta-copy--><\/div>/g, '');
  html = html.replace(/<div class="final-cta lx-fcta">/g, '<div class="final-cta">');
  if (/lx-fcta-(in|copy|art)/.test(html)) {
    problems.push(p.key + ': a previous run of this transform survived the strip'); continue;
  }

  const n = (html.match(/<div class="final-cta">/g) || []).length;
  if (n !== 1) { problems.push(p.key + ': expected 1 final CTA, found ' + n); continue; }
  const at = html.indexOf('<div class="final-cta">');

  // The heading and standfirst are the first h2 and the first p inside the block, and both are
  // located from the block's own start so nothing elsewhere on the page can be hit by mistake.
  const h2s = html.indexOf('<h2', at);
  const h2e = html.indexOf('</h2>', h2s);
  if (h2s < 0 || h2e < 0) { problems.push(p.key + ': final CTA heading not found'); continue; }
  html = html.slice(0, html.indexOf('>', h2s) + 1) + HEAD_HTML + html.slice(h2e);

  const ps = html.indexOf('<p', html.indexOf('</h2>', at));
  const pe = html.indexOf('</p>', ps);
  if (ps < 0 || pe < 0) { problems.push(p.key + ': final CTA standfirst not found'); continue; }
  // The standfirst has to sit inside the block, not after it -- a CTA without a paragraph would
  // otherwise take the next <p> on the page and rewrite that instead.
  const blockEnd = html.indexOf('</section>', at);
  if (ps > blockEnd) { problems.push(p.key + ': final CTA standfirst is outside the block'); continue; }
  html = html.slice(0, html.indexOf('>', ps) + 1) + SUB_HTML + html.slice(pe);

  // ---- wrap the existing contents as the left column and put the screen beside it.
  // The buttons are moved, never rebuilt: the primary one carries the network chooser and its
  // data-lxnonav flag, and re-typing that markup here is how a working CTA quietly becomes a dead one.
  // A DEPTH WALK, not a literal `</div></div></section>`. The desktop container is minified and the
  // mobile one is pretty-printed, so the closing tags there are separated by newlines and indentation
  // and the literal matched nothing -- the transform aborted on mobile and wrote neither page, which
  // is the guard doing its job. Counting div opens and closes is indifferent to whitespace.
  const bs = html.indexOf('<div class="final-cta">');
  const bOpen = html.indexOf('>', bs) + 1;
  const walk = /<\/?div\b/g;
  walk.lastIndex = bs;
  let depth = 0, bClose = -1, mm;
  while ((mm = walk.exec(html))) {
    if (mm[0].charAt(1) === '/') { depth--; if (depth === 0) { bClose = mm.index; break; } }
    else depth++;
  }
  if (bClose < 0) { problems.push(p.key + ': the final CTA block is not closed'); continue; }
  const inner = html.slice(bOpen, bClose);
  if (inner.indexOf('lxChooseNetwork') < 0) {
    problems.push(p.key + ': the CTA lost its network-chooser button'); continue;
  }
  const rebuilt = '<div class="lx-fcta-in">'
    + '<div class="lx-fcta-copy">' + inner + '<!--/lx-fcta-copy--></div>'
    + ART + '<!--/lx-fcta-art-->'
    + '<!--/lx-fcta-in--></div>';
  html = html.slice(0, bs) + '<div class="final-cta lx-fcta">' + rebuilt + html.slice(bClose);

  const bo = html.lastIndexOf('</body>');
  html = bo >= 0 ? html.slice(0, bo) + CSS + html.slice(bo) : html + CSS;

  json[p.key] = html;
  staged.push({ file: p.file, data, s, e, json, key: p.key });
}

if (problems.length) {
  console.error('final CTA: ABORT — nothing written.');
  problems.forEach(x => console.error('  ' + x));
  process.exit(1);
}
for (const st of staged) {
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.key + ': final CTA rebuilt with the product shot');
}
console.log('final CTA: done on ' + staged.length + ' page(s)');
