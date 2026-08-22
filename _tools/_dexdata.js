// Trade-MAIN page real-data layer — MAINNET, READ-ONLY (Phase 3).
// Fills the finalized DEX main page (lumoscore-dex) with live Stellar mainnet data across 4 sections:
//   1) hero price chip (XLM/USD + 24h),  2) New Mints list,  3) Market Movers grid,  4) All Trading Pairs table.
// Driven by a fixed curated mainnet asset universe (no all-markets endpoint exists on Horizon). Nothing is
// redesigned; we only ADD real values into existing elements + wire the table filter/search + row navigation.
// Modeled directly on _dexassetdata.js: idempotent applyAll re-asserted via a debounced+self-guarded global
// MutationObserver + dedicated synchronous per-section observers + a bounded interval; CSS no-flash gates so
// the design's mock values never flash; painter-proof icons (::before driven by --lxvar); ES5 var in the
// browser code, no emoji/astral chars and no \\u escapes that would break JSON re-serialization.
const fs = require('fs');
const { read, getContents, VERIFIED, VTICK_SVG, DOMAIN_DISPLAY } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const KEYS = ['lumoscore-dex.html', 'lumoscore-dex-dark.html', 'lumoscore-dex-mobile.html'];

// The hero's network mark. Taken from the site's own chain registry rather than a CDN or a new file:
// it is already the logo the network switcher paints, it is an inline SVG data URI so there is no
// request and nothing to cache-bust, and it cannot drift from the rest of the app.
const CHAIN_REG = JSON.parse(fs.readFileSync(__dirname + '/_chains.json', 'utf8'));
const HERO_MARK = (CHAIN_REG.stellar && CHAIN_REG.stellar.logo) || '';
if (!HERO_MARK) throw new Error('_chains.json: no stellar logo — refusing to ship a blank hero mark');

// Hero art lives under /assets/*, which _headers serves as "max-age=31536000, immutable". With a stable
// filename that is a one-way door: replace the file and every browser that already has it keeps the old
// one for a YEAR. That is exactly what happened -- the palette was changed and the phone went on serving
// the previous image while a fresh browser got the new one, from the same URL. The token manifest already
// carries ?v=<hash> for this reason; the hero art did not. Now it does, so the bytes decide the URL.
const heroV = (name) => {
  try {
    const buf = fs.readFileSync(__dirname + '/../assets/hero/' + name);
    return require('crypto').createHash('sha1').update(buf).digest('hex').slice(0, 8);
  } catch (e) { return '0'; }
};
const HERO_DARK = '/assets/hero/trade-hero-dark.svg?v=' + heroV('trade-hero-dark.svg');
const HERO_LIGHT = '/assets/hero/trade-hero-light.svg?v=' + heroV('trade-hero-light.svg');

const STYLE = `<style id="lx-dexmain-css">
.lx-vtick{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;margin-left:5px;border-radius:50%;background:var(--green,#35c07f);color:#fff;vertical-align:-2px;flex:0 0 14px}
.lx-vtick svg{width:9px;height:9px;display:block}

/* ---- no-flash gates: hide the design's mock values until our data owns the element ---- */
#dexMintsList:not(.lxd) .dex-mint-row{visibility:hidden}
#dexMoverGrid:not(.lxd) .dex-mover-card{visibility:hidden}
#dexMkTbody:not(.lxd) tr{visibility:hidden}
/* sortable column headers. Only the five numeric columns take a click -- Asset, Day High/Low and 7d Trend
   are not single values to order by, and a header that looks clickable but is not is worse than a plain
   one. The arrow is always present on a sortable column so the affordance does not depend on hover. */
.dex-mk-table thead th.lx-sortable{cursor:pointer;user-select:none;white-space:nowrap;transition:color .12s ease}
.dex-mk-table thead th.lx-sortable:hover{color:var(--text)}
.dex-mk-table thead th.lx-son{color:var(--accent)}
.lx-sarrow{display:inline-block;margin-left:5px;font-size:9px;line-height:1;opacity:.4;vertical-align:middle}
.dex-mk-table thead th.lx-son .lx-sarrow{opacity:1}
.lm-chip:not(.lxd) .p2,.lm-chip:not(.lxd) .p3{visibility:hidden}
/* ---- painter-proof token icons: the site logo-painter can't touch a ::before pseudo-element ---- */
.dex-mint-ic[data-lxic],.dex-mover-ico[data-lxic],.dex-mk-pair-ic[data-lxic]{position:relative;overflow:hidden;color:transparent!important;font-size:0!important}
.dex-mint-ic[data-lxic]::before,.dex-mover-ico[data-lxic]::before,.dex-mk-pair-ic[data-lxic]::before{content:"";position:absolute;inset:0;background:var(--lxvar) center/cover no-repeat;border-radius:inherit;z-index:2}
.lx-dex-empty{text-align:center;padding:34px 12px;color:var(--text-soft);font-size:14px}
/* ---- hero "advanced DEX" card: orange constellation (mirrors the Pools lx-constel, orange theme) with 5 data points ---- */
/* Trade hero gets its OWN warm/amber background (mirrors the Pools purple), always dark regardless of site theme.
   The html prefix boosts specificity to beat inject_livemarket.js's own .lumos-promo.lm-on !important rule (which uses var(--surface) = theme-following). */
html .lumos-promo.lm-on{overflow:hidden!important;background:radial-gradient(58% 84% at 70% 30%,rgba(140,96,246,.26),transparent 60%),radial-gradient(46% 64% at 92% 78%,rgba(198,86,232,.14),transparent 62%),radial-gradient(52% 68% at 24% 90%,rgba(74,110,224,.12),transparent 62%),linear-gradient(140deg,#0f1120 0%,#0a0a15 55%,#070610 100%)!important;border:1px solid rgba(255,255,255,.10)!important}
/* the design's .lm::after overlay uses var(--surface) (resolves LIGHT) -> a white diagonal streak over the heading. Replace with a dark purple readability overlay (mirrors Pools' .lm::after), darkening the heading side, transparent over the constellation. */
html .lumos-promo.lm-on .lm::after{background:linear-gradient(100deg,rgba(14,9,24,.64) 6%,rgba(14,9,24,.15) 44%,transparent 70%)!important;z-index:2!important}
.lumos-promo.lm-on .lm-bars{display:none!important}                 /* replace the old zigzag bars with the constellation */
svg.lm-svg.lx-dxc{overflow:visible}
.lx-dxc .lx-dxfloat{animation:lxDxFloat 12s ease-in-out infinite}
@keyframes lxDxFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
.lx-dxc{display:none!important}                                   /* drop the wireframe constellation; the subtle starfield replaces it */
.lx-dxc line{stroke:rgba(255,255,255,.12);stroke-width:1}
.lx-dxc .nd{fill:#f2ddff;filter:drop-shadow(0 0 6px rgba(226,182,255,.9));animation:lxDxNode 4.5s ease-in-out infinite}
@keyframes lxDxNode{0%,100%{opacity:.4}50%{opacity:1}}
.lx-dxc .dp{fill:#ffcfa6;filter:drop-shadow(0 0 12px rgba(255,155,85,1));animation:lxDxNode 3.4s ease-in-out infinite}
.lx-dxc .dpr{fill:none;stroke:rgba(255,190,150,.9);stroke-width:1.4;transform-box:fill-box;transform-origin:center;animation:lxDxRing 3s ease-out infinite}
@keyframes lxDxRing{0%{opacity:.85;transform:scale(.5)}70%{opacity:0;transform:scale(2.4)}100%{opacity:0}}
/* ---- 5 floating DATA POINTS on the right side of the hero animation (mirrors the Pools .lx-hstats) ---- */
.lumos-promo{position:relative!important}
/* ===== Pools-matched cosmic animation (identical to the AMM/Pools hero): nebulae drift + stars twinkle + constellation float + particles rise ===== */
.lumos-promo .lm{position:relative;z-index:1}
.lumos-promo .lm-c{position:relative;z-index:3}                    /* heading/sub/button above the cosmic layer */
.lx-cosmic{position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden}
.lx-neb{position:absolute;border-radius:50%;filter:blur(50px);mix-blend-mode:screen;will-change:transform}
.lx-neb.n1{width:600px;height:470px;right:-70px;top:-130px;background:radial-gradient(circle,rgba(140,96,246,.62),transparent 66%);animation:lxNeb1 30s ease-in-out infinite alternate}
.lx-neb.n2{width:480px;height:430px;right:150px;bottom:-180px;background:radial-gradient(circle,rgba(206,88,236,.44),transparent 66%);animation:lxNeb2 36s ease-in-out infinite alternate}
.lx-neb.n3{width:410px;height:340px;left:32%;top:4%;background:radial-gradient(circle,rgba(72,120,232,.34),transparent 66%);animation:lxNeb1 33s ease-in-out infinite alternate-reverse}
@keyframes lxNeb1{from{transform:translate(0,0) scale(1)}to{transform:translate(-48px,36px) scale(1.18)}}
@keyframes lxNeb2{from{transform:translate(0,0) scale(1)}to{transform:translate(54px,-32px) scale(1.12)}}
.lx-stars{position:absolute;inset:0;animation:lxTw 7s ease-in-out infinite;background-repeat:no-repeat;background-image:radial-gradient(1.6px 1.6px at 17% 24%,rgba(255,255,255,.9),transparent 60%),radial-gradient(1.3px 1.3px at 61% 16%,rgba(255,255,255,.62),transparent 60%),radial-gradient(1.7px 1.7px at 83% 52%,rgba(255,255,255,.74),transparent 60%),radial-gradient(1.1px 1.1px at 45% 66%,rgba(255,255,255,.5),transparent 60%),radial-gradient(1.4px 1.4px at 93% 30%,rgba(255,255,255,.64),transparent 60%),radial-gradient(1.2px 1.2px at 34% 44%,rgba(255,255,255,.5),transparent 60%),radial-gradient(1.5px 1.5px at 73% 80%,rgba(255,255,255,.58),transparent 60%),radial-gradient(1px 1px at 55% 90%,rgba(255,255,255,.42),transparent 60%),radial-gradient(1.3px 1.3px at 12% 66%,rgba(255,255,255,.52),transparent 60%),radial-gradient(1.6px 1.6px at 70% 40%,rgba(255,255,255,.66),transparent 60%),radial-gradient(1.1px 1.1px at 88% 66%,rgba(255,255,255,.46),transparent 60%),radial-gradient(1.2px 1.2px at 26% 80%,rgba(255,255,255,.48),transparent 60%)}
@keyframes lxTw{0%,100%{opacity:.6}50%{opacity:1}}
.lx-constel{position:absolute;right:3%;top:50%;transform:translateY(-50%);width:330px;height:330px;opacity:.95;pointer-events:none;animation:lxConFloat 12s ease-in-out infinite}
@keyframes lxConFloat{0%,100%{transform:translateY(-50%)}50%{transform:translateY(calc(-50% - 12px))}}
.lx-constel line{stroke:rgba(150,120,240,.26);stroke-width:1}
.lx-constel circle{fill:#cbbaff;filter:drop-shadow(0 0 5px rgba(168,128,255,.9));animation:lxNode 4.5s ease-in-out infinite}
@keyframes lxNode{0%,100%{opacity:.5}50%{opacity:1}}
.lx-part{position:absolute;border-radius:50%;background:rgba(214,196,255,.85);box-shadow:0 0 9px rgba(172,132,255,.9);animation:lxDrift linear infinite}
.lx-part.p1{width:5px;height:5px;left:57%;bottom:14%;animation-duration:15s}
.lx-part.p2{width:4px;height:4px;left:74%;bottom:8%;animation-duration:19s;animation-delay:-4s}
.lx-part.p3{width:6px;height:6px;left:66%;bottom:22%;animation-duration:23s;animation-delay:-9s}
.lx-part.p4{width:3px;height:3px;left:85%;bottom:12%;animation-duration:17s;animation-delay:-2s}
@keyframes lxDrift{0%{transform:translateY(20px);opacity:0}12%{opacity:1}86%{opacity:1}100%{transform:translateY(-160px);opacity:0}}
/* ===== HERO, COMPACT =====
   Copy runs the full width, a small live XLM pill sits top-right, and the four exchange stats form a
   strip along the bottom edge.
   It used to be one large glass panel in the top-right holding a 2x2 stats grid, which cost twice over:
   the panel forced .lm-c down to calc(100% - 388px) -- at a 1024px viewport that left the headline 165px
   wide and three lines tall -- and the hero as a whole ran ~524px, so All Trading Pairs began well below
   the fold. Full-width copy + a bottom strip carries the same four numbers in roughly 150px less height. */
.lumos-promo .lm{display:flex!important;flex-direction:column}
.lumos-promo .lm-c{max-width:none!important;padding:24px 26px 18px!important;flex:1 1 auto;display:flex;flex-direction:column;align-items:flex-start}
.lumos-promo .lm-h{font-size:32px!important;line-height:1.1!important;letter-spacing:-.015em;color:#fff!important;max-width:calc(100% - 200px)}
.lumos-promo .lm-sub{font-size:14.5px!important;line-height:1.5!important;color:rgba(228,230,245,.78)!important;max-width:48ch}
.lumos-promo .lm-cta{margin-top:16px}
/* live XLM price: a pill now, not a panel. The min-width is deliberate -- .lm-chip:not(.lxd) hides p2/p3
   until real data lands, so without it the pill would size to "XLM" alone and then jump. */
.lumos-promo .lm-chip{position:absolute!important;top:18px;right:18px;width:auto!important;max-width:none!important;min-width:152px;box-sizing:border-box;display:inline-flex!important;flex-direction:row;align-items:baseline;gap:9px;padding:9px 14px!important;z-index:5;background:linear-gradient(158deg,rgba(255,255,255,.12),rgba(255,255,255,.035))!important;border:1px solid rgba(255,255,255,.18)!important;border-radius:12px!important;backdrop-filter:blur(24px) saturate(1.4)!important;-webkit-backdrop-filter:blur(24px) saturate(1.4)!important;box-shadow:0 14px 34px rgba(6,2,20,.45),inset 0 1px 0 rgba(255,255,255,.26)!important}
.lumos-promo .lm-chip .p1{order:1;margin:0!important;padding:0!important;border:0!important;font-size:11px!important;letter-spacing:.09em;color:rgba(228,230,245,.6)!important}
.lumos-promo .lm-chip .p2,.lumos-promo .lm-chip .p2 .lc-money{order:2;font-size:17px!important;line-height:1.05;color:#fff!important}
.lumos-promo .lm-chip .p3{order:3;font-size:11px!important;margin-left:auto}
/* the four exchange stats, as a strip along the bottom edge (z-index 4 clears .lm::after, which is 3) */
.lumos-promo .lx-dxstats{order:9;margin-top:auto;position:relative;z-index:4;display:grid;grid-template-columns:1fr 1fr .78fr 1.32fr;align-items:flex-end;gap:0;padding:13px 26px 15px;background:linear-gradient(180deg,rgba(255,255,255,.015),rgba(255,255,255,.075));border-top:1px solid rgba(255,255,255,.12);backdrop-filter:blur(16px) saturate(1.3);-webkit-backdrop-filter:blur(16px) saturate(1.3)}
.lx-dxstat{display:flex;flex-direction:column;gap:4px;min-width:0;overflow:hidden;padding-left:17px;border-left:1px solid rgba(255,255,255,.10)}
.lx-dxstat:first-child{padding-left:0;border-left:0}
.lx-dxstat .v{font:800 28px/1.05 'Hanken Grotesk',sans-serif;color:#fff!important;letter-spacing:-.01em;white-space:nowrap;display:flex;align-items:center;gap:10px}
.lx-dxstat .l{font:600 12px/1.2 'JetBrains Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:rgba(228,230,245,.6)!important;white-space:nowrap}
.lx-dxstat[data-k=top] .v{font-size:18px}
.lx-dxpair{display:inline-flex;flex:0 0 auto}
.lx-dxpair span{display:block;width:28px;height:28px;border-radius:50%;background:#222 center/cover no-repeat;border:2px solid rgba(18,13,32,.92);box-shadow:0 2px 6px rgba(0,0,0,.4)}
.lx-dxpair .pb{margin-left:-10px}
/* ===== DESKTOP HERO =====
   Same treatment as mobile, at desktop scale: the neutral gradient image instead of the violet cosmic
   animation, and the card reduced to a headline and the stat strip. The description, the XLM price pill
   and the Start Trading button are gone -- that button linked to /trade/stellar, the page you are already
   on. The two page CTAs take the corner the pill vacated.
   Scoped to .lm-on: the mobile card does not carry it, and this stylesheet is only injected into the three
   Trade keys, so the Pools hero (which shares .lumos-promo) is out of reach. */
html .lumos-promo.lm-on{overflow:hidden!important;border:1px solid rgba(255,255,255,.10)!important;background:#130c07 url(${HERO_DARK}) center/cover no-repeat!important}
html[data-theme="light"] .lumos-promo.lm-on{border-color:rgba(16,16,22,.10)!important;background:#fff1e6 url(${HERO_LIGHT}) center/cover no-repeat!important}
.lumos-promo.lm-on .lm::before,.lumos-promo.lm-on .lm::after{display:none!important}   /* design's scanlines + wash */
.lumos-promo.lm-on .lm-sub,.lumos-promo.lm-on .lm-cta,.lumos-promo.lm-on .lm-chip,.lumos-promo.lm-on .lm-svg,.lumos-promo.lm-on .lm-bars{display:none!important}
/* Mark on the left, headline beside it. .lm-c becomes a ROW here, so justify-content is now the
   horizontal axis and align-items does the vertical centring the column layout used to do. */
.lumos-promo.lm-on .lm-c{flex-direction:row;align-items:center;justify-content:flex-start;gap:18px;padding:26px 30px!important;max-width:none!important}
/* Painted through ::before, not the element background. The site's own painter writes an inline
   "background:transparent" onto empty spans like this one, and inline beats any stylesheet rule -- the
   mark rendered as nothing. A pseudo-element is out of its reach; this is the same trick the token icons
   in this file already use. */
.lx-heroico{flex:0 0 auto;position:relative;width:56px;height:56px;border-radius:50%;overflow:hidden;box-shadow:0 6px 18px -8px rgba(0,0,0,.55)}
.lx-heroico::before{content:"";position:absolute;inset:0;background:url("${HERO_MARK}") center/contain no-repeat}
html[data-theme="light"] .lx-heroico{box-shadow:0 6px 18px -10px rgba(16,16,22,.35)}
.lumos-promo.lm-on .lm-h{font-size:36px!important;line-height:1.08!important;max-width:420px}
html[data-theme="light"] .lumos-promo.lm-on .lm-h{color:#0e0e10!important}
html[data-theme="light"] .lumos-promo.lm-on .lx-dxstats{background:linear-gradient(180deg,rgba(255,255,255,.34),rgba(255,255,255,.70));border-top-color:rgba(16,16,22,.12)}
html[data-theme="light"] .lumos-promo.lm-on .lx-dxstat .v{color:#0e0e10!important}
html[data-theme="light"] .lumos-promo.lm-on .lx-dxstat .l{color:rgba(52,52,64,.72)!important}
/* the page CTAs, now in the hero's top-right corner */
.lx-dctas{position:absolute!important;top:20px;right:22px;z-index:5;display:flex!important;align-items:center;gap:14px;margin:0!important;padding:0!important}
/* DESKTOP: the CTAs share the headline's row instead of floating above it, so the card reads as one line
   of content rather than two things pinned to opposite corners.
   Guarded to >880px because the phone hero is the same .lm markup and keeps its own stacked layout.
   flex-wrap rather than a viewport breakpoint: the hero is one of two columns, so its width tracks the
   window rather than any round number -- measured 818px at a 1920 viewport (CTAs fit beside a 420px
   headline with room to spare) but 647px at 1440 (they do not). Wrapping lets the row decide for itself;
   when it cannot fit, the CTAs drop to their own line, still flush right, and the headline keeps its size.
   align-self:flex-start puts them level with the FIRST line of the headline, not its vertical middle. */
@media(min-width:881px){
/* align-content matters here: once a flex container can wrap, its single line is STRETCHED to the full
   height by default, so align-self:flex-start on the CTAs pinned them to the top of the card rather than
   to the top of the headline -- which is exactly the stranded-in-a-corner look this is meant to end.
   Centring the line collapses it to its content, and flex-start then means the headline's first line. */
.lumos-promo.lm-on .lm-c{flex-wrap:wrap;column-gap:24px;row-gap:12px;align-content:center}
.lumos-promo.lm-on .lm-h{flex:0 0 auto}
.lumos-promo.lm-on .lx-dctas{position:static!important;top:auto;right:auto;order:9;margin-left:auto!important;align-self:flex-start}
/* the mark and the second line carry the weight; line one stays as it was */
.lumos-promo.lm-on .lx-heroico{width:64px;height:64px}
.lumos-promo.lm-on .lm-h .lx-h1{display:block}
.lumos-promo.lm-on .lm-h .lx-h2{display:block;font-size:48px;line-height:1.02;letter-spacing:-.022em}
}
.lx-dctas .dex-hero-btn.primary{order:1}   /* the design ships the ghost first; Launch Token leads here */
.lx-dctas .dex-hero-btn.ghost{order:2}
.lx-dctas .dex-hero-btn{display:inline-flex!important;align-items:center;justify-content:center;gap:7px;height:38px;padding:0 15px!important;border-radius:10px;font-weight:700;font-size:13px;line-height:1;text-decoration:none;white-space:nowrap;border:1px solid transparent;margin:0!important;flex:0 0 auto}
.lx-dctas .dex-hero-btn svg{width:15px;height:15px;flex:0 0 auto}
.lx-dctas .dex-hero-btn.primary{background:linear-gradient(180deg,#ff8a4c,var(--accent,#ea6a2c))!important;color:#fff!important;box-shadow:0 10px 22px -12px rgba(234,106,44,.95),inset 0 1px 0 rgba(255,255,255,.30)}
.lx-dctas .dex-hero-btn.ghost{background:none!important;border:0!important;box-shadow:none!important;height:auto!important;padding:0!important;font-weight:600;font-size:13px;color:rgba(255,255,255,.82)!important;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1px;text-decoration-color:currentColor}
html[data-theme="light"] .lx-dctas .dex-hero-btn.ghost{color:#33333d!important}
/* the header row is empty once the heading is hidden and the buttons have moved out */
.dex-hero:has(> .dex-hero-l.lx-sronly){margin:0!important;padding:0!important;min-height:0!important;display:block!important}

/* ===== MOBILE HERO =====
   The mobile page ships a different component: a 4-slide auto-rotating .lumos-promo-slides carousel, with
   none of the desktop hero's CSS -- no #lx-livemarket block, so .lm, .lm-h, .lm-sub and .lm-cta have no
   base rules there at all. Everything the mobile hero needs is therefore declared here in full rather than
   as overrides, scoped to .lx-mobhero so desktop cannot be touched.
   applyMobileHero() lifts the DEX slide's own copy into the desktop structure, so the headline stays
   correct per chain, and hides the carousel. */
/* A flat gradient IMAGE, and no animation at all. The card used to run the Pools cosmic layer -- three
   drifting nebulae, a twinkling starfield, a floating constellation and four rising particles, eight
   simultaneous keyframe animations on a phone. applyCosmic() now skips this card and removes the layer if
   an earlier pass built one, so the elements are gone rather than merely hidden.
   The art is two authored SVGs under /assets/hero (about 1.3 KB each, pure gradients, no filters), one per
   theme, and both are NEUTRAL -- stops taken from the site's own grey ramp, depth from luminance alone, no
   hue at all. The card is a shade of the page rather than a colour on it. Everything else on the card
   follows: border, price pill, stat strip and the secondary button are all neutral too. The only brand
   colour left inside the hero is the primary button and the accent word in the headline.
   The flat colour behind the image is the art's own mid-tone, so a slow image load shows no white flash. */
.lumos-promo.lx-mobhero{overflow:hidden;border:1px solid rgba(255,255,255,.10);background:#130c07 url(${HERO_DARK}) center/cover no-repeat}
.lx-mobhero .lx-cosmic{display:none!important}     /* belt and braces if a stale layer ever survives */
/* the two page CTAs, moved inside the card: Launch Token leads, How it works sits beside it */
/* Copy, then the stat band. The actions are no longer on the card -- they sit in the All Trading Pairs
   heading. Order is set here because the blocks are appended by different functions. */
.lx-mobhero .lm-c{order:1}
.lx-mobhero .lx-dxstats{order:2!important;margin-top:0!important}
/* the CTA row, now in the section heading: title left, actions right, wrapping onto a second line rather
   than overflowing when a narrow screen cannot seat all three */
.mdx-section-head:has(.lx-ctas){display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
.lx-ctas{display:flex!important;align-items:center;gap:7px;margin:0 0 0 auto!important;padding:0!important;flex:0 0 auto}
/* the strip is no longer the last thing on the card, so it closes with a rule as well as opening with one */

/* visually hidden, still in the document outline and the accessibility tree */
.lx-sronly{position:absolute!important;width:1px!important;height:1px!important;margin:-1px!important;padding:0!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;clip-path:inset(50%)!important;white-space:nowrap!important;border:0!important}
/* Sized so the pair of them seats beside the 121px heading inside a 343px row at 375px. It was 3px over
   and wrapped to a second line; the group is 197px now against 212px of space. Narrower phones still wrap
   rather than overflow -- that is what the flex-wrap on the head is for. */
.lx-ctas .mdx-hero-btn{display:inline-flex!important;align-items:center;justify-content:center;gap:5px;height:31px;padding:0 8px!important;border-radius:9px;font-weight:700;font-size:10.5px;line-height:1;text-decoration:none;white-space:nowrap;border:1px solid transparent;width:auto!important;margin:0!important;flex:0 0 auto}
.lx-ctas .mdx-hero-btn svg{width:11px;height:11px;flex:0 0 auto}
.lx-ctas .mdx-hero-btn.primary{background:linear-gradient(180deg,#ff8a4c,var(--accent,#ea6a2c))!important;color:#fff!important;box-shadow:0 8px 18px -11px rgba(234,106,44,.95),inset 0 1px 0 rgba(255,255,255,.30)}
/* the design ships these as flex children that grow; a link must be its own width, not half the row */
.lx-ctas .mdx-hero-btn.ghost{flex:0 0 auto;justify-content:flex-start!important;background:none!important;border:0!important;box-shadow:none!important;height:auto!important;padding:0!important;font-weight:600;font-size:10.5px;color:var(--text-muted,#b8b8c2)!important;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1px;text-decoration-color:currentColor}
.lx-ctas .mdx-hero-btn.ghost svg{width:10px;height:10px;opacity:.75}
/* ---- light theme: the same card, warmed rather than darkened ---- */
html[data-theme="light"] .lumos-promo.lx-mobhero{border-color:rgba(16,16,22,.10);background:#fff1e6 url(${HERO_LIGHT}) center/cover no-repeat}
html[data-theme="light"] .lumos-promo.lx-mobhero .lm-h{color:#0e0e10!important}
html[data-theme="light"] .lumos-promo.lx-mobhero .lm-h em{color:#c2551d!important}
html[data-theme="light"] .lumos-promo.lx-mobhero .lm-sub{color:rgba(38,38,48,.75)!important}
html[data-theme="light"] .lx-ctas .mdx-hero-btn.ghost{color:#33333d!important}
html[data-theme="light"] .lumos-promo.lx-mobhero .lm-chip{background:rgba(255,255,255,.78)!important;border-color:rgba(16,16,22,.12)!important;box-shadow:0 10px 24px -14px rgba(16,16,22,.30)!important}
html[data-theme="light"] .lumos-promo.lx-mobhero .lm-chip .p1{color:rgba(52,52,64,.72)!important}
html[data-theme="light"] .lumos-promo.lx-mobhero .lm-chip .p2,html[data-theme="light"] .lumos-promo.lx-mobhero .lm-chip .p2 .lc-money{color:#0e0e10!important}
html[data-theme="light"] .lumos-promo.lx-mobhero .lx-dxstats{background:linear-gradient(180deg,rgba(255,255,255,.34),rgba(255,255,255,.70));border-top-color:rgba(16,16,22,.12)}
html[data-theme="light"] .lumos-promo.lx-mobhero .lx-dxstat .v{color:#0e0e10!important}
html[data-theme="light"] .lumos-promo.lx-mobhero .lx-dxstat .l{color:rgba(52,52,64,.72)!important}
html[data-theme="light"] .lx-mobhero .lx-dxpair span{border-color:rgba(255,255,255,.95)}
.lx-mobhero .lumos-promo-slides,.lx-mobhero .lumos-promo-dots{display:none!important}
.lx-mobhero .lm{position:relative;z-index:2;width:100%;display:flex;flex-direction:column;min-height:260px}
.lx-mobhero .lm-c{position:relative;z-index:3;display:flex;flex-direction:column;align-items:flex-start;padding:20px 18px 18px;flex:1 1 auto}
.lx-mobhero .lm-h{margin:0;font-weight:800;letter-spacing:-.02em}
.lx-mobhero .lm-h em{font-style:normal;color:var(--accent,#ff7a3c)}
.lx-mobhero .lm-sub{margin:9px 0 0}
.lx-mobhero .lm-cta{display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:13.5px;color:#fff;text-decoration:none;background:linear-gradient(180deg,var(--accent-2,#ff894c),var(--accent));padding:10px 17px;border-radius:11px;box-shadow:0 10px 24px -10px var(--accent-soft),inset 0 1px 0 rgba(255,255,255,.28)}
.lx-mobhero .lm-cta svg{width:16px;height:16px}
/* Narrow (this also covers the MOBILE page, whose hero is the .lumos-promo-slides carousel -- it has no
   .lm and no .lm-chip, so the strip lands as the card's last child and there is no pill to place).
   The strip folds to 2x2 and everything steps down a size: at 375px the four columns become ~145px, and at
   the desktop sizes "USDC / XLM" plus its two 24px logos overran that by 4px. */
@media(max-width:880px){
.lumos-promo .lm-c{padding:18px 18px 16px!important;gap:12px;flex-direction:row;align-items:center}
.lx-heroico{width:38px;height:38px}
.lx-hline2{display:block}                 /* forces "on <Chain>." onto its own line on a phone */
.lumos-promo .lm-h{max-width:100%!important;font-size:23px!important;line-height:1.14!important}
.lumos-promo .lm-sub{font-size:13.5px!important;max-width:100%!important}
.lumos-promo .lm-cta{margin-top:14px}
.lumos-promo .lm-chip{position:static!important;margin:0 0 13px;align-self:flex-start;min-width:0}
.lumos-promo .lx-dxstats{grid-template-columns:1fr 1fr;gap:11px 0;padding:11px 18px 12px}
.lx-dxstat{padding-left:14px}
.lx-dxstat:nth-child(3){padding-left:0;border-left:0}
.lx-dxstat .v{font-size:19px;gap:7px}
.lx-dxstat .l{font-size:9.5px}
.lx-dxstat[data-k=top] .v{font-size:13.5px}
.lx-dxpair span{width:21px;height:21px}
.lx-dxpair .pb{margin-left:-8px}
/* the mobile card carries its own 260px floor, which the carousel needed and this hero does not */
.lumos-promo.lx-mobhero,.lx-mobhero .lm{min-height:0!important}
/* first paint: the carousel is already hidden but .lm is not built yet, so hold the card's height for
   that one frame rather than letting it collapse to nothing and snap open. */
.lumos-promo.lx-mobhero:not(:has(.lm)){min-height:120px!important}   /* == the settled height; it was 169 from before the CTAs moved off the card, so the box opened tall and then shrank */
}
/* ===== PHONE: the hero becomes a wide banner, about half the height =====
   At 375px the card was 348px tall against 343px of width -- square, and a third of the screen before a
   single trading pair. This lays it out landscape: headline left with the live XLM price opposite it, the
   button under them, and the four stats in ONE horizontal row rather than a 2x2 block.
   Kept at its own 560px breakpoint so a narrowed desktop window keeps the roomier 2x2 treatment.
   The price also moves to absolute top-right here. In flow it was a child of .lm, outside .lm-c's padding,
   so it sat flush in the rounded corner and got clipped -- visible as a small empty blob. */
@media(max-width:560px){
.lumos-promo .lm-c{padding:13px 14px 12px!important}
.lx-mobhero .lm-c{padding-bottom:13px!important}
.lumos-promo .lm-h{font-size:18px!important;line-height:1.18!important;max-width:100%!important}
.lumos-promo .lm-sub{display:none!important}          /* no room for it at half height; the headline carries the message */
.lumos-promo .lm-cta{margin-top:11px;font-size:12.5px;padding:8px 14px;border-radius:9px}
.lumos-promo .lm-cta svg{width:14px;height:14px}
.lumos-promo .lm-chip{position:absolute!important;top:12px;right:13px;margin:0;padding:6px 10px!important;flex-direction:column;align-items:flex-end;gap:1px;border-radius:10px!important}
.lumos-promo .lm-chip .p1{font-size:9px!important;letter-spacing:.1em}
.lumos-promo .lm-chip .p2,.lumos-promo .lm-chip .p2 .lc-money{font-size:13px!important}
.lumos-promo .lm-chip .p3{font-size:9.5px!important;margin-left:0}
/* One row of four. The columns size to their CONTENT and the leftover space is spread between them --
   proportional fr tracks cannot work here, because each column's width is set by a string whose length
   nobody controls: "$129.2K" against "35", and "USDC / XLM" plus two logos against "LIQUIDITY". Measured
   at 360px, fr tracks handed 78px to a column needing 87 and 93 to one needing 68. Auto tracks cannot
   clip while the row as a whole fits, so the dividers give way to spacing. */
.lumos-promo .lx-dxstats{grid-template-columns:repeat(4,auto);justify-content:space-between;gap:0;padding:9px 14px 10px}
.lx-dxstat{padding-left:0;border-left:0;gap:3px}
.lx-dxstat .v{font-size:16px;gap:6px}
.lx-dxstat .l{font-size:8px;letter-spacing:.03em}
.lx-dxstat[data-k=top] .v{font-size:10.5px}
.lx-dxpair span{width:16px;height:16px;border-width:1.5px}
.lx-dxpair .pb{margin-left:-6px}
}
/* Empty Gainers/Losers. Spans the grid so the message sits in the panel rather than in one cell. */
.dex-mover-empty{grid-column:1/-1;padding:26px 16px;text-align:center;color:var(--text-muted);font-size:13.5px}
/* ---- Market Movers: symmetric body — price/vol (left) + Trades 24h (right), spark spans below ---- */
.dex-mover-body{display:flex;justify-content:space-between;align-items:flex-end;gap:10px}
.dex-mover-l{min-width:0}
.dex-mover-r{text-align:right;flex:0 0 auto}
.dex-mover-trades{font:800 18px/1.05 'Hanken Grotesk',sans-serif;color:var(--text)}
.dex-mover-tlabel{font:600 9.5px/1.2 'JetBrains Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:var(--text-soft);margin-top:3px;white-space:nowrap}
/* ---- All Trading Pairs: Trades (24h) column (header th inserted via JS) ---- */
.th-trades{text-align:right!important}
.dex-mk-trades-td{text-align:right}
.dex-mk-trades{font-weight:700;white-space:nowrap}
/* kill two stray tiny logos the site's [data-logo] applier paints onto non-logo elements:
   (1) #dexMintTabs = an empty 6px leftover in the New Mints header (data-logo="APT");
   (2) .dex-mover-pct = the % badge, which during LOAD (empty "\\u2014") gets tagged data-logo=<ticker> and
       painted with a tiny logo until the real % lands. Only suppress while it carries data-logo -> loaded pills untouched. */
#dexMintTabs,.dex-mints-tabs,#mdxMintTabs,.mdx-mints-tabs{display:none!important}   /* same empty leftover on the mobile card */
.dex-mover-pct[data-logo]{background-image:none!important;box-shadow:none!important}
/* the avatar-painter sometimes injects a stray <svg> initials-avatar INTO our painter-proof icons (it broke the
   LUMOS logo in All Trading Pairs). Our real logo lives in ::before -> hide any injected svg child so it can't cover it. */
.dex-mint-ic[data-lxic]>svg,.dex-mover-ico[data-lxic]>svg,.dex-mk-pair-ic[data-lxic]>svg{display:none!important}
/* #19 denomination switch. Sized off the search field it sits beside so the row keeps one baseline. */
.lx-dnsw{display:inline-flex;flex:0 0 auto;align-items:center;gap:2px;padding:3px;border-radius:10px;
  background:var(--surface-2);border:1px solid var(--border)}
.lx-dnsw button{padding:5px 11px;border:0;border-radius:7px;background:transparent;color:var(--text-soft);
  font:800 12px/1 inherit;letter-spacing:.02em;cursor:pointer;transition:color .14s ease,background .14s ease}
.lx-dnsw button:hover{color:var(--text)}
.lx-dnsw button.on{background:var(--surface);color:var(--text);box-shadow:0 1px 3px rgba(0,0,0,.18)}
/* the row holding the search input is a flex line; the switch must not stretch with the input */
.dex-mk-search{flex:1 1 auto;min-width:0}
/* New Mints: 4 symmetric stat columns (Price / Market cap / 24h Volume / 24h Trades), right-aligned */
.dex-mint-stats{display:flex;gap:22px;flex:0 0 auto;margin-left:auto;align-items:flex-start}
.dex-mint-stat{display:flex;flex-direction:column;align-items:flex-end;min-width:60px}
.dex-mint-stat .l{font:600 10px/1 'JetBrains Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:var(--text-soft,#6f6f79);margin-bottom:6px}
.dex-mint-stat .v{font-weight:700;font-size:14px;color:var(--text,#0e0e10);white-space:nowrap;line-height:1.25;text-align:right}
/* the dollar figure is a second line under the XLM price, not a continuation of it */
.dex-mint-stat .v .sub{display:block;font-weight:600;font-size:11.5px;color:var(--text-soft,#6f6f79);margin-top:3px;letter-spacing:0}
/* Price carries the longest string in the row, so it gets room; the counts stay narrow */
.dex-mint-stat:first-child{min-width:104px}
</style>`;

const SCRIPT = `<script id="lx-dexmain">(function(){
  // Verified issuers come from _tools/lib.js so every page ticks the same set — a list that drifted
  // between screens would make an asset trustworthy here and not there.
  var VFD=${JSON.stringify(VERIFIED)};

  // What WE show as an asset home domain where the on-chain value is stale (LUMOS still declares the
  // pre-rename lumosdao.io). Display only -- never the toml fetch, which 404s on the new domain.
  var DDOM=${JSON.stringify(DOMAIN_DISPLAY)};
  function dispDom(c,i,d){ return DDOM[(c||"")+"|"+(i||"")]||d||""; }
  var VTICK='<span class="lx-vtick" title="Verified issuer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>';
  function vtick(c,i){ return VFD[c+"|"+i]?VTICK:""; }
  if(window.__lxDEX)return;window.__lxDEX=true;
  var H="https://horizon.stellar.org";                       // MAINNET (+ lobstr fallback in j())
  var CG="https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd&include_24hr_change=true";
  var LUMOS_LOGO="/assets/tokens/lumos.png";

  // ---- curated real mainnet asset universe (no all-markets endpoint exists on Horizon) ----
  // logo = hardcoded real logo URL so it renders IMMEDIATELY (no placeholder-avatar flash); toml image is a
  // best-effort upgrade only for assets without a hardcoded one.
  var ASSETS=[
    {code:"USDC", issuer:"GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", cat:"stable",  b:"#2775ca", logo:"https://assets.coingecko.com/coins/images/6319/small/usdc.png"},
    {code:"EURC", issuer:"GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2", cat:"stable",  b:"#1a4fb4", logo:"https://assets.coingecko.com/coins/images/26045/small/euro.png"},
    {code:"ARST", issuer:"GCSAZVWXZKWS4XS223M5F54H2B6XPIIXZZGP7KEAIU6YSL5HDRGCI3DG", cat:"stable",  b:"#5b9bd5"},
    {code:"AQUA", issuer:"GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA", cat:"utility", b:"#7b3ff2", logo:"https://aqua.network/assets/img/aqua-logo.png"},
    {code:"yXLM", issuer:"GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55", cat:"utility", b:"#08b5e5", logo:"https://assets.coingecko.com/coins/images/100/small/fmpFRHHQ_400x400.jpg"},
    {code:"SHX",  issuer:"GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEKEBR7UCHEUUEK72N7I7KJ6JH", cat:"utility", b:"#3fb89a"},
    {code:"BTC",  issuer:"GAUTUYY2THLF7SGITDFMXJVYH3LHDSMGEAKSBU267M2K7A3W543CKUEF", cat:"utility", b:"#f7931a", logo:"https://assets.coingecko.com/coins/images/1/small/bitcoin.png"},
    {code:"LUMOS",issuer:"GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S", cat:"utility", b:"#ea6a2c", logo:"/assets/tokens/lumos.png"}
  ];
  // byCode is a TICKER index -- two different issuers can share one. byId is the IDENTITY index, and it
  // is what decides whether we already hold an asset. Ticker alone could not: the cached roster and the
  // fresh stellar.expert discovery both offer every token, and the second offer would see the ticker
  // taken, mint a "collision" key (TDT -> TDT~GBIN) and create a SECOND object for the very same asset.
  // That is why TDT appeared twice in All Trading Pairs.
  var byId={};
  // #7: a.chg is the move against XLM -- that is what Horizon trade_aggregations measure and what
  // /lxapi/dexassets returns. On a day when XLM itself rose 10%, every asset that merely held its
  // DOLLAR value showed as a red -10%, which is exactly what the pair list was doing: USDC -10.26%,
  // EURC -7.26% -- a dollar stablecoin and a euro one apparently collapsing on the same afternoon.
  //
  // In dollars now, like the asset page and the dashboard: the asset against XLM, times XLM against
  // USD. Null when XLM's own move is unknown, because printing the raw XLM figure under a dollar
  // heading is the bug itself and a dash is the honest alternative.
  function chgU(a){
    if(!a||a.chg==null||xlmChg==null)return null;
    return ((1+a.chg/100)*(1+xlmChg/100)-1)*100;
  }
  // Shared with _mobdex.js, which renders the same pair list on a phone and was printing the raw XLM
  // figure -- the desktop table was converted here and the mobile one was not, so the same asset read
  // -10.26% on one and its true dollar move on the other. One implementation, both renderers.
  try{ window.__lxChgU=chgU; }catch(_){}
  // #19: the reader chooses the denomination. Dollars stay the default -- that is the honest reading of
  // "is this up or down" for anyone not already thinking in XLM -- but a trader pricing against XLM wants
  // the raw pair move, and until now the page simply asserted one of the two.
  //
  // The choice is shared with _mobdex.js through window + localStorage, so switching on a phone and
  // reopening on a desktop shows the same thing rather than two pages disagreeing about the same asset.
  function denom(){ try{ if(window.__lxDenom)return window.__lxDenom;
    var v=localStorage.getItem("lumos.dexDenom"); if(v==="xlm"||v==="usd"){window.__lxDenom=v;return v;} }catch(_){}
    return "usd"; }
  function setDenom(v){ window.__lxDenom=v; try{ localStorage.setItem("lumos.dexDenom",v); }catch(_){}
    try{ window.dispatchEvent(new CustomEvent("lx-denom",{detail:v})); }catch(_){} }
  // XLM is the raw pair move Horizon reports; USD folds in what XLM itself did.
  function chgShown(a){ return denom()==="xlm" ? (a&&a.chg!=null?a.chg:null) : chgU(a); }
  try{ window.__lxDenomGet=denom; window.__lxDenomSet=setDenom; window.__lxChgShown=chgShown; }catch(_){}
  var byCode={}; ASSETS.forEach(function(a){ byCode[a.code]=a; byId[a.code+"|"+a.issuer]=a; a.px=0; a.chg=null; a.vol=null; a.high=null; a.low=null;
    a.tvlUsd=null; a.holders=null; a.supply=null; a.spark=null; a.domain=null; a.img=null; a.trades=null; });
  // ---- LumosCore-native assets: issuer home_domain = lumoscore.com (minted through our Launchpad) ----
  var NATIVE=[], nativeState=0;                             // 0 idle | 1 loading | 2 loaded
  var SX="https://api.stellar.expert/explorer/public/asset?search=lumoscore&limit=200";
  // v2: the saved roster is a list of WHICH assets exist, so a copy written before an asset was
  // registered hides it for six hours. Bumping the key retires those, once.
  var NKEY="lumos.native.v2", NTTL=216e5;                       // 6h: identity changes slowly, prices do not
  function nativeCached(){
    try{ var c=JSON.parse(localStorage.getItem(NKEY)||"null");
      return (c&&c.ts&&(Date.now()-c.ts<NTTL)&&c.a&&c.a.length)?c.a:null; }catch(e){ return null; }
  }
  function nativeSave(list){
    try{ localStorage.setItem(NKEY,JSON.stringify({ts:Date.now(),a:list.map(function(x){
      return {c:x.code,i:x.issuer,l:x.logo||"",d:x.domain||"",t:x.created||0}; })})); }catch(e){}
  }
  // one shape for both paths, so a cached roster and a fresh one cannot drift
  function nativeMake(code,iss,logo,dom,created){
    if(byId[code+"|"+iss])return null;                 // same code AND issuer -> already held
    var key=byCode[code]?code+"~"+iss.slice(0,4):code;
    if(byCode[key])return null;
    var a={code:code,issuer:iss,cat:"native",tkr:key,b:"#3d4351",created:(+created||0),
      logo:logo||"",domain:dom||"",px:0,chg:null,vol:null,high:null,low:null,tvlUsd:null,
      holders:null,supply:null,spark:null,img:null,trades:null};
    byCode[key]=a; byId[code+"|"+iss]=a; NATIVE.push(a); return a;
  }
  // One request per 16 assets, served from the edge cache. Falls back to Horizon per asset if the
  // endpoint is unreachable, so this can never be the reason a price is missing.
  var BATCH=16;
  function batchPx(list){
    var want=list.filter(function(a){ return a&&a.code&&a.issuer; });
    if(!want.length)return Promise.resolve();
    var jobs=[];
    for(var i=0;i<want.length;i+=BATCH)jobs.push(want.slice(i,i+BATCH));
    return Promise.all(jobs.map(function(grp){
      var qs=grp.map(function(a){ return a.code+"-"+a.issuer; }).join(",");
      return fetchJ("/lxapi/dexassets?a="+encodeURIComponent(qs)).then(function(d){
        if(!d||!d.a)throw new Error("empty");
        grp.forEach(function(a){
          var v=d.a[a.code+"-"+a.issuer]; if(!v)return;
          if(v.px>0)a.px=v.px;
          if(v.chg!=null)a.chg=v.chg;
          if(v.vol!=null)a.vol=v.vol;
          if(v.high!=null)a.high=v.high;
          if(v.low!=null)a.low=v.low;
          if(v.tr!=null)a.trades=v.tr;
          if(v.ho!=null)a.holders=v.ho;
          if(v.su!=null)a.supply=v.su;
          // home_domain now rides along on the cached response. It drives the row's domain label AND the
          // stellar.toml lookup that resolves the logo, so SHX and friends were unlabelled and
          // unillustrated purely because nothing ever set this.
          if(v.dom&&!a.domain){ a.domain=v.dom; if(!a.img)loadToml(a,v.dom); }
        });
        touch();
      }).catch(function(){
        // endpoint down -> the old path, so the page degrades instead of emptying
        return Promise.all(grp.map(function(a){ return loadAssetLite(a).catch(function(){}); }));
      });
    }));
  }
  // Sparklines and TVL are the bulk of the remaining Horizon traffic, and that traffic is what throttles
  // the endpoint the prices come from. Hold them until the numbers are painted, then trickle in fours.
  var EXTRA_HOLD=1200;
  function deferExtras(list){
    setTimeout(function(){ (function wave(i){ if(i>=list.length)return;
      Promise.all(list.slice(i,i+4).map(function(a){ return rowExtras(a).catch(function(){}); }))
        .then(function(){ wave(i+4); },function(){ wave(i+4); });
    })(0); }, EXTRA_HOLD);
  }
  // Decorative extras, fetched only after the numbers are showing: the 7d sparkline and pool TVL.
  function rowExtras(a){
    if(a.__extra)return Promise.resolve(); a.__extra=1;
    var atype=a.code.length<=4?"credit_alphanum4":"credit_alphanum12";
    var base="base_asset_type="+atype+"&base_asset_code="+a.code+"&base_asset_issuer="+a.issuer+"&counter_asset_type=native";
    if(a.domain)loadToml(a,a.domain);
    return Promise.all([
      j(H+"/trade_aggregations?"+base+"&resolution=3600000&order=desc&limit=168").then(function(d){
        var r=recs(d).slice().reverse();
        var pts=r.map(function(x){ return +x.avg||+x.close||0; }).filter(function(v){ return v>0; });
        if(pts.length>=2)a.spark=pts; touch(); }).catch(function(){}),
      j(H+"/liquidity_pools?reserves="+a.code+":"+a.issuer+"&limit=200").then(function(d){
        a.poolsRaw=recs(d).map(function(pl){ var nat=0,ass=0;
          (pl.reserves||[]).forEach(function(rv){ if(rv.asset==="native")nat=+rv.amount;
            else if(rv.asset.indexOf(a.code+":"+a.issuer)===0)ass=+rv.amount; });
          return {nat:nat,ass:ass}; });
        computeTvl(a); touch(); }).catch(function(){})
    ]);
  }
  var MINTS_SHOWN=3;                                          // rows in the "New mints on LumosCore" card, and the number we price up front
  function nativePrice(add){
    // ONLY the ones the mints box shows, and only two requests each. Everything else is fetched when a
    // row is actually rendered -- see priceVisible(). Sweeping the roster here is what made the page
    // fire ~210 requests before showing a single price.
    var _first=add.slice().sort(function(x,y){ return (y.created||0)-(x.created||0); }).slice(0,MINTS_SHOWN);
    _first.forEach(function(a){ a.__lite=1; a.__px=1; });
    // one request for all of them -- and the edge is not rate-limited the way each visitor was, which is
    // what used to leave ZERO and UPT permanently showing a dash
    MINTS_READY=batchPx(_first).then(function(){ nativeState=2; touch(); },function(){ nativeState=2; touch(); });
    // The pair list now DEFAULTS to 24h volume, so the roster needs volumes before its first paint --
    // otherwise the table shows roster order and visibly re-sorts a second later, which is the flash.
    // This is batchPx, the edge-cached endpoint at 16 assets per request (two requests for the whole
    // roster), NOT the per-asset Horizon sweep that priceVisible deliberately avoids -- that one is what
    // used to fire ~210 requests before a single price appeared, and it stays lazy.
    var rest=add.filter(function(a){ return a&&!a.__px; });
    ROSTER_READY=MINTS_READY.then(function(){ return rest.length?batchPx(rest):null; })
                            .then(rosterDone,rosterDone);
  }
  function rosterDone(){ rosterPriced=true; try{ markSortReady(); }catch(_){} }
  // Rows on screen get the full loadAsset (the table shows TVL and a sparkline); in waves of four so a
  // page turn cannot open 25 sockets at once.
  var MINTS_READY=null;                                       // resolves when the mints box has its prices
  var ROSTER_READY=null, rosterPriced=false;                  // ...and when the whole native roster has volumes
  // The rows stay hidden until the order they are in is the REAL one. With a volume default, revealing
  // earlier means painting roster order and then re-sorting in front of the reader.
  var sortReady=false;
  function markSortReady(){
    if(sortReady)return;
    if(mkSort.key && (!window.__lxDEXloaded || !rosterPriced))return;   // both halves of the data, or nothing
    sortReady=true;
    // The phone list is rendered by the mobile layer but priced by this one, so it gates on this flag
    // too -- otherwise it would reveal as soon as the majors landed and re-sort when the roster arrived.
    try{ window.__lxDEXsortReady=1; }catch(_){}
    try{ guardApply(); }catch(_){}
  }
  function priceVisible(list){
    var need=list.filter(function(a){ return a&&!a.__px; });
    if(!need.length)return;
    need.forEach(function(a){ a.__px=1; });
    var gate=MINTS_READY||Promise.resolve();
    gate.then(function(){
      // numbers first, in one or two requests; the sparkline and TVL follow in waves of four
      batchPx(need).then(function(){ deferExtras(need); });
    });
  }
  function loadNative(){
    if(nativeState)return; nativeState=1;
    // LUMOS is the platform's own token, but its issuer still declares the pre-rename lumosdao.io, so a
    // strict domain match drops it from its own tab. Pin it in until that home_domain is updated.
    var l=byCode["LUMOS"]; if(l&&NATIVE.indexOf(l)<0)NATIVE.push(l);
    touch();
    var cached=nativeCached();
    if(cached){
      var addC=[];
      cached.forEach(function(x){ var a=nativeMake(x.c,x.i,x.l,x.d,x.t); if(a)addC.push(a); });
      // Seed here as well. This path RETURNS, so seeding only in the fetch branch below meant a visitor
      // with a warm roster never saw an asset we had just registered -- FED, NEIRO and HULK were missing
      // for exactly that reason while RICHARD, PUMP, PEPE and ZBS happened to arrive via the late
      // manifest backfill.
      addManifestNatives(addC);
      touch(); nativePrice(addC);
      return;                                                  // refreshed on the next cold load
    }
    fetchJ(SX).then(function(d){
      var r=(d&&d._embedded&&d._embedded.records)||[], add=[];
      r.forEach(function(x){
        if(String(x.domain||"").toLowerCase()!=="lumoscore.com")return;
        var q0=String(x.asset||"").split("-"), code=q0[0], iss=q0[1];
        if(!code||!iss||code.length>12||iss.length!==56)return;
        // Retired and mistyped tickers linger in the index as husks: zero supply, no trustlines, no toml.
        // They cannot be traded, and padding the tab with dead rows buries the real ones.
        var tl=x.trustlines; tl=(tl&&typeof tl==="object"&&tl.length)?(+tl[0]||0):(+tl||0);
        if(!(+x.supply>0)||tl<1)return;
        // one creation point, one guard: this used to inline a second copy of the ticker-only check
        var a=nativeMake(code,iss,(x.tomlInfo&&x.tomlInfo.image)||"",x.domain||"",+x.created||0);
        if(a)add.push(a);
      });
      addManifestNatives(add);
      touch();
      nativeSave(NATIVE.filter(function(x){ return x.cat==="native"; }));
      // The mints box shows the NEWEST few, and they can sit anywhere in discovery order -- so price
      // Same routine the cached path uses: price the ones the mints box shows, and stop. Everything
      // else is fetched by priceVisible() when a row is rendered.
      nativePrice(add);
    }).catch(function(){ nativeState=0; });                  // allow a retry on the next click
  }
  // "All" means every pair LumosCore lists, curated majors AND our own Launchpad tokens. Identity dedupe,
  // not code+issuer: LUMOS is literally the same object in both lists, pinned into NATIVE by loadNative.
  function allAssets(){
    // Identity dedupe, not object identity. Object identity was enough while LUMOS was literally the same
    // object in both lists, but it cannot catch two distinct objects describing one asset.
    var out=[],seen={};
    function put(a){ if(!a)return; var id=a.code+"|"+a.issuer; if(seen[id])return; seen[id]=1; out.push(a); }
    for(var i=0;i<ASSETS.length;i++)put(ASSETS[i]);
    for(var j=0;j<NATIVE.length;j++)put(NATIVE[j]);
    return out; }
  function curFilter(){ var el=q(".dex-mk-filter.active"); return (el&&el.getAttribute)?(el.getAttribute("data-filter")||"all"):"all"; }
  // Newest first. Assets we have no created stamp for sort last rather than jumping to the top on a 0.
  function mintList(){
    return NATIVE.slice()
      .filter(function(a){ return a.cat==="native"; })            // LUMOS is pinned into NATIVE but was not minted here
      .sort(function(x,y){ return (y.created||0)-(x.created||0); })
      .slice(0,MINTS_SHOWN);
  }
  var MINTS=["LUMOS","AQUA","EURC","ARST","SHX"];             // "new mints" subset (LUMOS = the project token, tagged NEW)

  // seed XLM/USD from a shared localStorage cache so a CoinGecko 429 never blanks the USD values (falls back
  // to the last-known price, <=6h old; the shared "lumos.xlmUsd" key is written by every page on success).
  var xlmUsd=(function(){try{var c=JSON.parse(localStorage.getItem("lumos.xlmUsd")||"null");return (c&&+c.v>0&&(Date.now()-c.ts<216e5))?+c.v:0;}catch(e){return (window.__lxXlmUsd||0);}})();
  // Warm from the same cache entry. Without it the whole change column is dashes until the network
  // answers, which is a worse first paint than a figure a few minutes old.
  var xlmChg=(function(){try{var c=JSON.parse(localStorage.getItem("lumos.xlmUsd")||"null");
    return (c&&c.chg!=null&&(Date.now()-c.ts<216e5))?+c.chg:null;}catch(e){return null;}})();
  var DV=0;                                                   // data version — bumped only when real data lands

  // ---- helpers (mirrors _dexassetdata) ----
  function fetchJ(u){ return fetch(u).then(function(r){ if(!r.ok)throw new Error(r.status); return r.json(); }); }
  // at most MAXQ requests in flight; everything else waits its turn
  function wait(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  var MAXQ=6, qRun=0, qWait=[];
  function qNext(){ if(qRun>=MAXQ||!qWait.length)return; qRun++; var t=qWait.shift();
    t.go().then(t.ok,t.no).then(function(){ qRun--; qNext(); },function(){ qRun--; qNext(); }); }
  function queued(go){ return new Promise(function(ok,no){ qWait.push({go:go,ok:ok,no:no}); qNext(); }); }
  function j(u){
    return queued(function(){
      return fetchJ(u).catch(function(e){
        // A 429 arrives without CORS headers, so we cannot tell it apart from a network fault -- assume
        // the worse of the two and back off. Retrying instantly is what deepens a rate limit.
        return wait(500).then(function(){ return fetchJ(u); }).catch(function(){
          return wait(1400).then(function(){ return fetchJ(u); }).catch(function(){
            if(u.indexOf("horizon.stellar.org")>=0)return fetchJ(u.replace("horizon.stellar.org","horizon.stellar.lobstr.co"));
            throw e; }); });
      });
    });
  }
  function q(s,r){ return (r||document).querySelector(s); }
  function qa(s,r){ return [].slice.call((r||document).querySelectorAll(s)); }
  function recs(d){ return (d&&d._embedded&&d._embedded.records)||[]; }
  // close/avg round to 7dp; below that they read "0.0000000" though the asset does have a price
  function subPx(r){ var b=+r.base_volume||0, c=+r.counter_volume||0; return (b>0&&c>0)?(c/b):0; }
  function priceUsd(a){ return (a.px||0)*xlmUsd; }
  function num(n){ if(n==null)return "\\u2014"; return Math.round(+n||0).toLocaleString("en-US"); }
  // Below 1e-8 a plain decimal is an unreadable run of zeros and exponential notation is trader-hostile,
  // so the zeros get counted into a subscript instead: 0.000000001234 -> 0.0(8)1234. At 1e-8 and above we
  // stay plain and trim the padding.
  //
  // Deliberately free of backslash escapes: this code is emitted through a template literal, which eats
  // one level of them -- a /\.$/ here would ship as /.$/ and delete the last digit of every price.
  var SUBD=String.fromCharCode(8320,8321,8322,8323,8324,8325,8326,8327,8328,8329);
  function zsub(n){ var s=String(n),o=""; for(var i=0;i<s.length;i++)o+=SUBD.charAt(+s.charAt(i)); return o; }
  function trimZ(t){ while(t.length>1&&t.charAt(t.length-1)==="0")t=t.slice(0,-1);
    if(t.charAt(t.length-1)===".")t=t.slice(0,-1); return t; }
  function smallNum(x,sig){ x=+x||0; if(!(x>0))return "0";
    if(x>=1e-8)return trimZ(x.toFixed(8));
    var e=x.toExponential((sig||4)-1), i=e.indexOf("e");
    if(i<0)return String(x);
    var mant=trimZ(e.slice(0,i)).split(".").join(""), exp=-parseInt(e.slice(i+1),10);
    if(!(exp>1))return trimZ(x.toFixed(8));
    return "0.0"+zsub(exp-1)+mant; }
  function usdSmall(x){ x=+x||0; if(x>=1)return "$"+x.toLocaleString("en-US",{maximumFractionDigits:2}); if(x>=0.01)return "$"+x.toFixed(4); if(x>0)return "$"+smallNum(x,4); return "$0"; }
  function abbrUsd(n){ n=+n||0; var a=Math.abs(n); if(a>=1e9)return "$"+(n/1e9).toFixed(2)+"B"; if(a>=1e6)return "$"+(n/1e6).toFixed(2)+"M"; if(a>=1e3)return "$"+(n/1e3).toFixed(1)+"K"; if(a>=1)return "$"+n.toFixed(2); return usdSmall(n); }
  function fmtAmt(n){ n=+n||0; if(n>=1e6)return (n/1e6).toFixed(2)+"M"; if(n>=1e3)return (n/1e3).toFixed(1)+"K"; return n.toFixed(0); }
  function fmtPrice(n){ n=+n||0; if(n>=1000)return n.toFixed(2); if(n>=1)return n.toFixed(4); if(n>=0.01)return n.toFixed(5); if(n>=0.0001)return n.toFixed(7); if(n>0)return smallNum(n,4); return "0"; }
  function shortG(a){ a=String(a||""); return a.length>12?a.slice(0,4)+"\\u2026"+a.slice(-4):a; }
  // circular initial-avatar as an SVG data-URI (fallback logo for arbitrary Stellar tokens)
  function avatarBg(code){ var c=String(code||"?"); var hue=0; for(var i=0;i<c.length;i++)hue=(hue*31+c.charCodeAt(i))%360;
    var init=c.replace(/[^A-Za-z0-9]/g,"").slice(0,2).toUpperCase()||"?"; var fz=init.length>1?15:20;
    var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="hsl('+hue+',60%,50%)"/><text x="20" y="'+(init.length>1?26:27)+'" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="'+fz+'" fill="#fff">'+init+'</text></svg>';
    return "url(\\"data:image/svg+xml,"+encodeURIComponent(svg)+"\\")"; }
  // A LumosCore mint's icon lives in localStorage, written by the launchpad (see _launchpad.js), keyed
  // CODE-ISSUER. Pools and Asset-Overview have always read it; Trade did not, which is exactly why the
  // same token showed its real icon there and a coloured letter tile here.
  //
  // This is not the whole fix and is not pretending to be: an icon in localStorage is the minting browser
  // and nowhere else, so nobody else sees it. Publishing it in our stellar.toml is what makes it real for
  // every visitor, wallet and explorer -- that path is built and waiting on the icon files. This restores
  // the icons wherever the browser that minted them is used, which is the machine looking at this page.
  // THE ICON MANIFEST, READ FROM OUR OWN ORIGIN. Hosting the logo files was not enough on its own: the
  // page resolved a mint's image through loadToml(), which fetches the issuer's on-chain home_domain --
  // lumoscore.com -- no matter which site you are browsing. That URL 404s until the toml Function reaches
  // production, so a logo hosted on staging was unreachable from staging.
  //
  // This reads /assets/tokens/launchpad-icons.json from whatever origin is serving the page, so the icons
  // appear as soon as they are deployed, on staging and production alike, with no dependency on the toml
  // or on any third party. The toml still matters -- it is what publishes them to wallets and explorers --
  // but the site no longer waits on it to draw its own pages.
  // window.__lxTokenRegistry is baked into <head> at build time, so this is known on the FIRST paint and the letter avatar is never drawn for a token we have. The fetch stays only as a refresh for a page left open across a deploy.
  var _man=(function(){ try{ return window.__lxTokenRegistry||null; }catch(e){ return null; } })(), _manStarted=0;
  function loadManifest(){
    if(_manStarted)return; _manStarted=1;
    fetch("/assets/tokens/launchpad-icons.json").then(function(r){ return r.ok?r.json():null; }).then(function(m){
      if(!m||typeof m!=="object"||m.constructor===Array)return;
      _man=m;
      // The manifest can land after the roster. Backfill then, or an asset only we know about would wait
      // for the next cold load to appear.
      if(nativeState){ var late=[]; addManifestNatives(late); if(late.length)nativePrice(late); }
      try{ paintIcons(document); }catch(_e){}
      touch();                                                  // rows already drawn -> repaint with the real icons
    }).catch(function(){});
  }
  function manifestIcon(code,issuer){
    if(!_man)return "";
    var e=_man[code+"-"+issuer];
    // An entry is a bare path, or {image,name} once the asset has a display name. Reading only the
    // string form meant every logo that gained a name silently stopped rendering -- BEAR, BLA, BRIDGE,
    // BROT, FOX, LIBERATOR, PEACE and ZOMBIE all went back to letter tiles the moment names were added.
    var u=(e&&typeof e==="object")?e.image:e;
    // Same-origin absolute path only. A manifest naming another host would let one bad write repoint
    // every token icon on the site.
    return (typeof u==="string"&&u.charAt(0)==="/"&&u.indexOf("//")!==0)?u:"";
  }

  // OUR OWN ASSETS, FROM OUR OWN RECORD. The roster is discovered from stellar.expert and filtered on
  // domain==="lumoscore.com" -- but their index does not always carry the domain. WAZAAA is the case in
  // point: Horizon says home_domain=lumoscore.com and its issuer was created by our funding wallet, yet
  // stellar.expert reports domain:(none), so the row was never built and the asset simply did not exist
  // on LumosCore. Waiting for a third party to notice our own mint is not a plan.
  //
  // The manifest knows CODE and ISSUER for everything we host, so anything missing from the roster is
  // added from there. Discovery only -- price, supply and holders still come from the ledger.
  function addManifestNatives(add){
    if(!_man)return;
    for(var k in _man){ if(!Object.prototype.hasOwnProperty.call(_man,k))continue;
      var d=k.indexOf("-"); if(d<1)continue;
      var code=k.slice(0,d), iss=k.slice(d+1);
      if(!/^[A-Za-z0-9]{1,12}$/.test(code)||!/^G[A-Z2-7]{55}$/.test(iss))continue;
      var dup=false;
      for(var i=0;i<NATIVE.length;i++)if(NATIVE[i].code===code&&NATIVE[i].issuer===iss){dup=true;break;}
      if(dup)continue;
      var a=nativeMake(code,iss,"","lumoscore.com",0);
      if(a&&add)add.push(a);
    }
  }

  var _liCache=null;
  function launchIcon(code,issuer){
    try{
      if(!_liCache)_liCache=JSON.parse(localStorage.getItem("lumos.launch.icons")||"{}");
      var u=_liCache[code+"-"+issuer];
      // Only an image data URI, and none carrying a quote: this value is interpolated into url(...) and a
      // quote inside it would break out of the CSS value (the url(") trap that bit the logo guard).
      return (typeof u==="string"&&u.indexOf("data:image/")===0&&u.indexOf('"')<0&&u.indexOf("'")<0)?u:"";
    }catch(e){ return ""; }
  }
  function logoCss(a){ var u=a.logo||a.img||manifestIcon(a.code,a.issuer)||launchIcon(a.code,a.issuer); return u?"url("+u+")":avatarBg(a.code); }
  // money value wrapped as a .lc-money span (the site money-formatter keys off data-usd/data-orig -> no revert)
  function lcm(v){ v=+v||0; var s=abbrUsd(v); return '<span class="lc-money" data-usd="'+v+'" data-orig="'+s+'">'+s+'</span>'; }
  function lcmExact(v){ v=+v||0; var s=usdSmall(v); return '<span class="lc-money" data-usd="'+v+'" data-orig="'+s+'">'+s+'</span>'; }
  // paint icons ourselves (painter-proof) after any innerHTML rebuild
  function paintIcons(root){ qa("[data-lxic]",root).forEach(function(ic){ var a=byCode[ic.getAttribute("data-lxic")]; if(!a)return; var css=logoCss(a); if(css&&ic.style.getPropertyValue("--lxvar")!==css)ic.style.setProperty("--lxvar",css); }); }
  function initials(code){ return String(code||"?").replace(/[^A-Za-z0-9]/g,"").slice(0,3); }

  // ---- sparkline (winsorized, real 24x1h points) ----
  function sparkPath(vals){ if(!vals||vals.length<2)return null;
    var s=vals.slice().sort(function(a,b){return a-b;});
    var lo=s[Math.floor(s.length*0.05)]||s[0], hi=s[Math.ceil(s.length*0.95)-1]||s[s.length-1];
    var cl=vals.map(function(v){return Math.max(lo,Math.min(hi,v));});
    var mn=Math.min.apply(null,cl),mx=Math.max.apply(null,cl),rg=(mx-mn)||1;
    var w=88,h=28,n=cl.length,step=w/(n-1);
    return cl.map(function(v,i){ return (i?"L":"M")+(i*step).toFixed(1)+" "+(h-((v-mn)/rg)*(h-4)-2).toFixed(1); }).join(" "); }
  function sparkSvg(vals,up){ var d=sparkPath(vals); var color=up?"#35c07f":"#ff5b5b";
    if(!d)return '<svg class="dex-mk-spark" viewBox="0 0 88 28" preserveAspectRatio="none"></svg>';
    return '<svg class="dex-mk-spark" viewBox="0 0 88 28" preserveAspectRatio="none"><path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }

  // Navigate to the asset page WITH the ?asset= query. window.__lxNav (the site SPA router) drops the query
  // string, landing on the default (LUMOS) page, so use a direct location.href which preserves it.
  function navTo(a){ try{ location.href="lumoscore-dex-asset.html?asset="+a.code+"-"+a.issuer; }catch(e){} }

  // ================= 1) HERO price chip (.lm-chip) =================
  function applyHero(){ var chip=q(".lm-chip"); if(!chip)return;
    var p2=chip.querySelector(".p2"), p3=chip.querySelector(".p3");
    if(p2){ var t=xlmUsd>0?usdSmall(xlmUsd):"\\u2014"; if(p2.textContent!==t)p2.textContent=t; }
    if(p3&&xlmChg!=null){ var up=xlmChg>=0; p3.style.color=up?"var(--green)":"var(--red)";
      var h='<span>'+(up?"\\u25B2":"\\u25BC")+'</span> '+Math.abs(xlmChg).toFixed(2)+'%'; if(p3.innerHTML!==h)p3.innerHTML=h; }
    chip.classList.add("lxd");
  }
  // Replace the "advanced DEX" card's zigzag (svg.lm-svg + .lm-bars) with an orange constellation matching
  // the Pools page's lx-constel (streams + pulsing nodes) plus 5 prominent DATA POINTS (bigger dot + ring).
  // inject the SAME cosmic animation the Pools/AMM hero uses (nebulae + stars + constellation + particles), once
  function applyCosmic(){ var card=q(".lumos-promo"); if(!card)return;
    // Both Trade heroes are static gradient images now, so this layer is never built here, and one an
    // earlier pass left behind is torn out -- the ten keyframe animations do not exist rather than being
    // invisible. (Pools still runs its own; this file only touches Trade.)
    var stale=card.querySelector(".lx-cosmic"); if(stale&&stale.parentNode)stale.parentNode.removeChild(stale);
    return;
    var host=card.querySelector(".lm")||card;
    var d=document.createElement("div"); d.className="lx-cosmic";
    d.innerHTML='<div class="lx-neb n1"></div><div class="lx-neb n2"></div><div class="lx-neb n3"></div><div class="lx-stars"></div>'
      +'<svg class="lx-constel" viewBox="0 0 330 330" xmlns="http://www.w3.org/2000/svg"><g><line x1="52" y1="72" x2="146" y2="46"/><line x1="146" y1="46" x2="238" y2="78"/><line x1="52" y1="72" x2="104" y2="134"/><line x1="146" y1="46" x2="104" y2="134"/><line x1="238" y1="78" x2="202" y2="150"/><line x1="104" y1="134" x2="202" y2="150"/><line x1="238" y1="78" x2="284" y2="166"/><line x1="104" y1="134" x2="68" y2="206"/><line x1="202" y1="150" x2="166" y2="222"/><line x1="284" y1="166" x2="252" y2="242"/><line x1="68" y1="206" x2="166" y2="222"/><line x1="166" y1="222" x2="252" y2="242"/><line x1="166" y1="222" x2="124" y2="272"/><line x1="68" y1="206" x2="124" y2="272"/></g><g><circle cx="52" cy="72" r="3.4" style="animation-delay:-.2s"></circle><circle cx="146" cy="46" r="4" style="animation-delay:-1.4s"></circle><circle cx="238" cy="78" r="3" style="animation-delay:-2.1s"></circle><circle cx="104" cy="134" r="4.4" style="animation-delay:-.8s"></circle><circle cx="202" cy="150" r="3.6" style="animation-delay:-2.7s"></circle><circle cx="284" cy="166" r="2.8" style="animation-delay:-1.1s"></circle><circle cx="68" cy="206" r="3.2" style="animation-delay:-3.2s"></circle><circle cx="166" cy="222" r="4.2" style="animation-delay:-.5s"></circle><circle cx="252" cy="242" r="3" style="animation-delay:-1.9s"></circle><circle cx="124" cy="272" r="3.4" style="animation-delay:-2.4s"></circle></g></svg>'
      +'<div class="lx-part p1"></div><div class="lx-part p2"></div><div class="lx-part p3"></div><div class="lx-part p4"></div>';
    host.insertBefore(d, host.firstChild);
  }
  // Give the MOBILE page the same hero as desktop. It ships a 4-slide auto-rotating carousel (DEX,
  // Launchpad, Low fees, Non-custodial) whose CTAs are all href="#"; the desktop hero is a single DEX
  // panel. Rather than author new copy -- which would hardcode "Stellar" onto every chain's build -- lift
  // the carousel's own DEX slide into the desktop structure, so the headline stays right per chain, and
  // give its dead "#" link the real destination the desktop CTA uses.
  function applyMobileHero(){
    var card=q(".lumos-promo"); if(!card)return;
    if(card.querySelector(".lm"))return;                          // desktop build, or already done
    var slides=card.querySelector(".lumos-promo-slides"); if(!slides)return;
    var slide=card.querySelector('.lumos-promo-slide[data-theme="dex"]')||card.querySelector(".lumos-promo-slide");
    var src=slide&&slide.querySelector(".lumos-promo-content"); if(!src)return;
    var t=src.querySelector(".lumos-promo-title"), s=src.querySelector(".lumos-promo-sub"), a=src.querySelector(".lumos-promo-cta");
    if(!t)return;
    // the slide breaks its title across two lines for a 58%-wide column; ours runs full width
    var head=t.innerHTML.replace(/<br\\s*\\/?>/gi," ");
    // "on Stellar." takes its own line rather than being squeezed onto the first. Matched on the trailing
    // "on <Word>." so it follows whatever chain the slide names instead of hardcoding one.
    // The leading space is kept OUTSIDE the span deliberately: without it the text reads "DEXon Stellar."
    // to anything that flattens the markup -- a screen reader, a crawler, a copy-paste -- even though the
    // block display hides that from the eye.
    head=head.replace(/\\s*\\bon\\s+([A-Za-z]+)\\.\\s*$/, ' <span class="lx-hline2">on $1.</span>');
    if(head.indexOf("<em")<0)head=head.replace(/\\bDEX\\b/,"<em>DEX</em>");   // accent word, as on desktop
    var lm=document.createElement("div"); lm.className="lm";
    // No price pill here: XLM/USD belongs on the pages that trade it, not on this card.
    lm.innerHTML='<div class="lm-c"><span class="lx-heroico" aria-hidden="true"></span><h2 class="lm-h">'+head+'</h2>'
      +'<p class="lm-sub">'+(s?s.innerHTML:"")+'</p></div>';   // the actions live in the pairs heading now
    card.appendChild(lm);                                         // after .lx-cosmic, so the copy paints over it
    card.classList.add("lx-mobhero");
  }
  // Mobile: pull the page's two CTAs inside the hero card and drop the hero's own Start Trading button.
  // They are MOVED, not rebuilt -- Launch Token already points at /launchpad and any listener bound to
  // either node survives relocation, which a clone would not.
  function applyMobileCtas(){
    var card=q(".lumos-promo"); if(!card||card.className.indexOf("lx-mobhero")<0)return;
    var box=card.querySelector(".lm-c"); if(!box)return;
    var ctas=document.querySelector(".mdx-hero-ctas"); if(!ctas)return;
    // The build already seats this row inside the All Trading Pairs heading. This is the fallback for a
    // re-render that moves it: find that heading the same way the build does -- the section head before
    // the pairs filters, since the mobile renderer reorders the two heads at runtime.
    var own=card.querySelector(".lm-cta"); if(own&&own.parentNode)own.parentNode.removeChild(own);
    if(ctas.className.indexOf("lx-ctas")<0)ctas.className+=" lx-ctas";
    var filt=document.querySelector(".mdx-mk-filters")||document.querySelector(".mdx-mk-list"), head=null;
    for(var el=filt;el;el=el.previousElementSibling)
      if(el!==filt&&(" "+el.className+" ").indexOf(" mdx-section-head ")>=0){ head=el; break; }
    if(head&&ctas.parentNode!==head)head.appendChild(ctas);
    // Launch Token leads so it sits on the LEFT; the design ships How it works first
    var prim=ctas.querySelector(".mdx-hero-btn.primary");
    if(prim&&prim!==ctas.firstElementChild)ctas.insertBefore(prim,ctas.firstElementChild);
    // The page H1 and its subtitle sit directly above this card and say what the hero already says.
    // Hidden VISUALLY only. .page-title is this page's ONLY h1 and the mobile file is the one Google
    // indexes, so it keeps its place in the document outline and the accessibility tree instead of being
    // deleted. Re-asserted every pass, so a re-render cannot put them back on screen.
    var pg=card.parentNode; if(pg){
      var hd=[pg.querySelector(".page-title"),pg.querySelector(".page-subtitle")];
      for(var i=0;i<hd.length;i++)if(hd[i]&&(" "+hd[i].className+" ").indexOf(" lx-sronly ")<0)hd[i].className+=" lx-sronly";
    }
  }
  function applyPromoConstel(){
    var svg=q(".lumos-promo .lm-svg"); if(!svg)return;
    if(svg.classList.contains("lx-dxc")&&svg.querySelector(".lx-dxfloat"))return;    // idempotent (rebuild only if clobbered)
    svg.setAttribute("viewBox","0 0 640 300"); svg.setAttribute("preserveAspectRatio","xMidYMid meet"); svg.classList.add("lx-dxc");
    var L=[[70,90,180,55],[180,55,250,90],[250,90,300,100],[300,100,200,120],[200,120,160,150],[160,150,120,205],[120,205,70,90],[70,90,160,150],[300,100,430,160],[300,100,400,60],[400,60,470,70],[470,70,540,105],[540,105,600,110],[540,105,575,170],[575,170,610,195],[430,160,390,200],[390,200,330,235],[330,235,240,175],[240,175,200,120],[430,160,500,225],[500,225,575,170],[390,200,500,225],[470,70,430,160],[240,175,160,150]];
    var ND=[[70,90,3.2,-0.2],[240,175,3.4,-0.8],[120,205,3,-3.2],[400,60,3.4,-1.1],[500,225,3,-1.9],[610,195,3.2,-2.4],[160,150,3,-1.5],[600,110,3.2,-2.9]];   // small pulsing nodes
    var DP=[[180,55,-0.3],[300,100,-1.4],[430,160,-2.1],[540,105,-0.9],[330,235,-2.7],[200,120,-1.7],[470,70,-0.6],[250,90,-2.3],[575,170,-1.2],[390,200,-3.0]];   // 10 data points (5 added)
    var lines=L.map(function(p){return '<line x1="'+p[0]+'" y1="'+p[1]+'" x2="'+p[2]+'" y2="'+p[3]+'"></line>';}).join("");
    var nodes=ND.map(function(p){return '<circle class="nd" cx="'+p[0]+'" cy="'+p[1]+'" r="'+p[2]+'" style="animation-delay:'+p[3]+'s"></circle>';}).join("");
    var dps=DP.map(function(p){return '<circle class="dpr" cx="'+p[0]+'" cy="'+p[1]+'" r="5.5" style="animation-delay:'+p[1+1]+'s"></circle><circle class="dp" cx="'+p[0]+'" cy="'+p[1]+'" r="5" style="animation-delay:'+p[2]+'s"></circle>';}).join("");
    svg.innerHTML='<g class="lx-dxfloat">'+lines+nodes+dps+'</g>';
  }
  // 5 floating DATA POINTS (real trade stats) on the right of the hero animation — like the Pools .lx-hstats
  var XLM_LOGO="https://assets.coingecko.com/coins/images/100/small/fmpFRHHQ_400x400.jpg";
  function applyHeroStats(){
    var card=q(".lumos-promo"); if(!card)return;
    // The strip is a SIBLING of the copy, along the bottom edge -- it used to live inside .lm-chip, which
    // made the price pill a full panel and pushed the headline into a narrow column. Search from the card,
    // not from the chip, so a page still carrying the old placement is found and moved rather than given a
    // second copy of the strip.
    var host=card.querySelector(".lm")||card;
    var box=card.querySelector(".lx-dxstats");
    // Both builds show Trades now. A strip built by an older pass would carry the Liquidity cell --
    // relabel it in place rather than rebuilding, so nothing else in the row is disturbed.
    if(box){ var wrong=box.querySelector('[data-k="liq"]');
      if(wrong){ wrong.setAttribute("data-k","trades");
        var wl=wrong.querySelector(".l"); if(wl)wl.textContent="Trades";
        var wv=wrong.querySelector(".v"); if(wv)wv.innerHTML="\\u2014"; } }
    if(!box){ box=document.createElement("div"); box.className="lx-dxstats";
      box.innerHTML='<div class="lx-dxstat" data-k="vol"><span class="v">\\u2014</span><span class="l">24h Volume</span></div>'
        +'<div class="lx-dxstat" data-k="trades"><span class="v">\\u2014</span><span class="l">Trades</span></div>'
        // A dash like the other three, NOT allAssets().length. This is baked at build time of the strip,
        // which is before the gates below, so a live count here was written while discovery was still
        // running -- it showed the curated handful and then jumped to the full roster. set("mkts") fills
        // it after the gates, so all four cells go from dash to final together.
        +'<div class="lx-dxstat" data-k="mkts"><span class="v">\\u2014</span><span class="l">Markets</span></div>'
        +'<div class="lx-dxstat" data-k="top"><span class="v"><span class="lx-dxpair"><span class="pa"></span><span class="pb"></span></span><span class="lx-dxtxt">\\u2014</span></span><span class="l">Top Pair</span></div>';
    }
    if(box.parentNode!==host)host.appendChild(box);               // also relocates a strip left inside the chip
    if(!window.__lxDEXloaded)return;                              // reveal with the rest, not one by one
    // And not while the LumosCore roster is still arriving. These are sums over allAssets(), so writing
    // them mid-discovery showed a number built from the curated eight -- Markets 8, a part-formed trade
    // count -- which then climbed as the mints landed. It read as a wrong figure being corrected. Hold at
    // the dash until discovery has finished (2) or given up (0); a failed load resets to 0, so this can
    // never latch on permanently.
    // #10: the gate held only while discovery was RUNNING (state 1). On a cold load the strip is built
    // and filled before loadNative() has been reached at all -- state 0 -- so it wrote the curated
    // eight, and "8 Markets" then jumped to the real roster a moment later. Wait for FINISHED (2), and
    // start discovery here rather than relying on another section having run first. The timer is the
    // release valve: if Horizon never answers, the strip fills with what is known instead of sitting
    // on a dash for good.
    try{ loadNative(); }catch(_){}
    if(!window.__lxMktsTimer){ window.__lxMktsTimer=setTimeout(function(){
      window.__lxMktsGiveUp=1; try{ touch(); }catch(_){}
    },7000); }
    if(nativeState!==2&&!window.__lxMktsGiveUp)return;
    // Sum what the page actually lists. Leaving these on the curated 8 while the table says 39 pairs
    // would put two different definitions of "this exchange" on one screen.
    var _agg=allAssets();
    var vol=0,liq=0; _agg.forEach(function(a){ if(a.vol!=null)vol+=a.vol*xlmUsd; if(a.tvlUsd!=null)liq+=a.tvlUsd; });
    var top=_agg.slice().filter(function(a){return a.vol!=null&&a.vol>0;}).sort(function(a,b){return (b.vol||0)-(a.vol||0);})[0];
    function set(k,v){ var el=box.querySelector('[data-k="'+k+'"] .v'); if(el&&el.innerHTML!==v)el.innerHTML=v; }
    set("vol",vol>0?abbrUsd(vol):"\\u2014");
    // Every trade executed against these assets in the last 24h. a.trades is trade_count off the same
    // daily bar the "Trades (24h)" column reads, so the hero and the table cannot disagree. Assets whose
    // bar has not arrived yet are skipped, not counted as zero -- the same way vol is summed.
    var trd=0,seen=0; _agg.forEach(function(a){ if(a.trades!=null){ trd+=+a.trades||0; seen++; } });
    set("trades",seen?num(trd):"\\u2014");
    set("mkts",String(_agg.length));   // the strip is built once; the roster grows after
    // Top Pair cell: two overlapping token logos (asset + XLM) + the pair name
    if(top){ var pa=box.querySelector('[data-k="top"] .pa'), pb=box.querySelector('[data-k="top"] .pb'), txt=box.querySelector('[data-k="top"] .lx-dxtxt');
      if(pa){ var pc=logoCss(top); if(pa.style.backgroundImage!==pc)pa.style.backgroundImage=pc; }
      if(pb){ var xc="url("+XLM_LOGO+")"; if(pb.style.backgroundImage!==xc)pb.style.backgroundImage=xc; }
      if(txt){ var tt=top.code+" / XLM"; if(txt.textContent!==tt)txt.textContent=tt; }
    }
  }

  // ================= 2) NEW MINTS (#dexMintsList) =================
  // In-place update helpers: build each section's skeleton ONCE (all rows, real tickers/icons, "\\u2014"
  // placeholders), then fill VALUES in place on every data tick. No innerHTML rebuild per tick -> kills the
  // "loading one by one" pop-in and the nonstop glitch that came from rebuilding on ~40 streamed updates.
  function setTxt(el,t){ if(el&&el.textContent!==t)el.textContent=t; }
  function setHTML(el,h){ if(el&&el.innerHTML!==h)el.innerHTML=h; }
  function fillSpark(root,vals,up){ if(vals&&vals.length>=2)up=vals[vals.length-1]>=vals[0]; var svg=q(".dex-mk-spark",root); if(!svg)return; var d=sparkPath(vals);
    var col=up?"#35c07f":"#ff5b5b";
    // Market Movers draws this series as a filled area; All Trading Pairs keeps the hairline -- an
    // 88x28 cell in a table row has no room for a fill, and it is a row, not a chart tile.
    var mover=!!(root&&root.className&&(" "+root.className+" ").indexOf(" dex-mover-card ")>=0);
    var want="";
    if(d&&mover){
      // The gradient is defined INSIDE this svg rather than once in a shared <defs>: url(#id) is
      // resolved against the document base, so a <base> tag turns a shared reference into a miss and
      // the fill silently disappears. Per-card id, so two tiles cannot collide.
      var gid="lxsp"+String(root.getAttribute("data-tkr")||"").replace(/[^A-Za-z0-9]/g,"")+(up?"u":"d");
      want='<defs><linearGradient id="'+gid+'" x1="0" y1="0" x2="0" y2="1">'
          +'<stop offset="0" stop-color="'+col+'" stop-opacity=".22"/>'
          +'<stop offset="1" stop-color="'+col+'" stop-opacity="0"/></linearGradient></defs>'
          +'<path d="'+d+' L88 28 L0 28 Z" fill="url(#'+gid+')" stroke="none"></path>'
          +'<path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="1.4" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"></path>';
    } else if(d){
      want='<path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path>';
    }
    if(svg.innerHTML!==want)svg.innerHTML=want; }
  function renderMints(){ var list=q("#dexMintsList"); if(!list)return;
    loadNative();                                              // this list IS the native roster
    // The design ships "New Mints on Stellar" and re-renders the title in place, so the correction is
    // re-asserted rather than written once.
    try{ var mt=q(".dex-mints-title"); if(mt&&!mt.__lxT){ mt.__lxT=1;
      var fixT=function(){ [].slice.call(mt.childNodes).forEach(function(tn){
        if(tn.nodeType===3&&/New Mints on Stellar|Featured on Stellar/.test(tn.nodeValue))
          tn.nodeValue=tn.nodeValue.replace(/New Mints on Stellar|Featured on Stellar/,"New mints on LumosCore"); }); };
      fixT(); try{ new MutationObserver(fixT).observe(mt,{childList:true,characterData:true,subtree:true}); }catch(_e){}
    } }catch(_){}

    var rows=mintList();
    if(!rows.length){
      if(!list.__lxEmpty){ list.__lxEmpty=1;
        list.innerHTML='<div class="dex-mint-row" style="justify-content:center;color:var(--text-soft);font-size:14px">Loading mints'+String.fromCharCode(8230)+'</div>'; }
      return;
    }
    list.__lxEmpty=0;
    // rebuild only when WHICH assets are listed changes -- not on every price tick, or the row under the
    // pointer is destroyed mid-hover
    var sig=rows.map(function(a){ return a.tkr||a.code; }).join("|");
    if(list.__lxsig!==sig){
      list.__lxsig=sig;
      list.innerHTML=rows.map(function(a){
        return '<div class="dex-mint-row" data-tkr="'+(a.tkr||a.code)+'">'
          +'<span class="dex-mint-ic" data-lxic="'+a.code+'" style="background:'+a.b+'">'+initials(a.code)+'</span>'
          +'<div class="dex-mint-meta">'
            +'<div class="dex-mint-name">'+a.code+'</div>'
            +'<div class="dex-mint-sub">\\u2014</div>'
          +'</div>'
          +'<div class="dex-mint-stats">'
            +'<div class="dex-mint-stat"><span class="l">Price</span><span class="v" data-k="px">\\u2014</span></div>'
            +'<div class="dex-mint-stat"><span class="l">Market cap</span><span class="v" data-k="mcap">\\u2014</span></div>'
            +'<div class="dex-mint-stat"><span class="l">24h Volume</span><span class="v" data-k="vol">\\u2014</span></div>'
            +'<div class="dex-mint-stat"><span class="l">24h Trades</span><span class="v" data-k="trades">\\u2014</span></div>'
          +'</div>'
        +'</div>'; }).join("");
      paintIcons(list);
      qa(".dex-mint-row",list).forEach(function(row){ row.addEventListener("click",function(){
        var a=byCode[row.getAttribute("data-tkr")]; if(a)navTo(a); }); });
      list.classList.add("lxd");
    }
    qa(".dex-mint-row[data-tkr]",list).forEach(function(row){
      var a=byCode[row.getAttribute("data-tkr")]; if(!a)return; paintIcons(row);
      setTxt(row.querySelector(".dex-mint-sub"),shortG(a.issuer));
      if(!window.__lxDEXloaded)return;
      // price in XLM with the dollar underneath -- the asset trades in XLM, the reader thinks in dollars
      var pxEl=row.querySelector('[data-k="px"]');
      if(pxEl){ var pu=priceUsd(a);
        setHTML(pxEl, a.px>0 ? (fmtPrice(a.px)+' XLM<span class="sub">'+(pu>0?usdSmall(pu):"")+'</span>') : "\\u2014"); }
      // supply x price: both already fetched by loadAsset, so this costs nothing extra
      var mc=(a.supply!=null&&a.px>0&&xlmUsd>0)?(a.supply*a.px*xlmUsd):null;
      setTxt(row.querySelector('[data-k="mcap"]'),mc!=null?abbrUsd(mc):"\\u2014");
      var vu=(a.vol!=null&&xlmUsd>0)?(a.vol*xlmUsd):null;
      setHTML(row.querySelector('[data-k="vol"]'), a.vol!=null
        ? (abbrNum(a.vol)+' XLM<span class="sub">'+(vu!=null?abbrUsd(vu):"")+'</span>') : "\\u2014");
      setTxt(row.querySelector('[data-k="trades"]'),a.trades!=null?num(a.trades):"\\u2014");
    });
  }

  // ================= 3) MARKET MOVERS (#dexMoverGrid) =================
  // The order is FROZEN: during load we show a stable set (no continuous re-sort glitch of the % on the right),
  // then compute the real top-4 by |24h change| ONCE all data is in, and keep that order.
  // frozen top-4 PER category: each tab keeps its OWN stable order (no re-sort glitch), but switching tabs
  // now yields the correct set (previously a single global freeze made all 3 tabs show the same 4 assets).
  var _moverFrozen={};
  function moverCat(){ var t=q(".dex-mover-tab.active")||q(".mdx-mover-tab.active");
    return (t&&t.getAttribute)?(t.getAttribute("data-cat")||(t.textContent||"").trim().toLowerCase()||"gainers"):"gainers"; }
  // Takes an optional category so the mobile renderer can ask for a specific tab. Without it, the
  // category comes from ".dex-mover-tab.active" — a selector the mobile markup does not have, so a
  // mobile caller silently got "gainers" for all three tabs.
  function moverData(forceCat){
    if(!window.__lxDEXloaded)return ASSETS.slice(0,4);           // stable placeholder order during load
    var cat=forceCat||moverCat();
    if(_moverFrozen[cat])return _moverFrozen[cat].map(function(c){return byCode[c];}).filter(Boolean);
    var d=ASSETS.slice();
    // GAINERS AND LOSERS ARE QUALITY-GATED. A percentage move is trivially manufactured on an asset
    // nobody holds: one trade against a few dollars of liquidity is a 900% "gainer", and a board of those
    // is worthless and looks like an endorsement. So a mover has to clear both bars:
    //
    //   * at least $500 of liquidity against XLM   (tvlUsd -- the pool it actually trades in)
    //   * at least 250 holders                     (holders -- a real base, not one wallet and a bot)
    //
    // An asset we cannot measure is EXCLUDED rather than assumed good: null is not a passing score.
    // Volume is deliberately NOT gated -- it is already self-limiting, since faking a top-volume slot
    // costs the volume it claims.
    function worthy(a){ return (+a.tvlUsd||0)>=500 && (+a.holders||0)>=250; }
    if(cat==="losers")d=d.filter(function(a){return worthy(a)&&chgU(a)!=null&&chgU(a)<0;}).sort(function(a,b){return chgU(a)-chgU(b);});
    else if(cat==="volume")d=d.sort(function(a,b){return (b.vol||0)-(a.vol||0);});
    else d=d.filter(function(a){return worthy(a)&&chgU(a)!=null&&chgU(a)>=0;}).sort(function(a,b){return chgU(b)-chgU(a);});
    // NO top-up for gainers/losers. This used to backfill by |chg| whenever a category held fewer than
    // four, which meant that on a red day -- every asset down -- "Gainers" filled itself with the four
    // biggest LOSERS and the two tabs showed an identical list of decliners under opposite headings.
    // A short list is a fact about the market; a padded one is a false claim. Volume keeps its top-up,
    // since ordering by volume cannot misrepresent direction.
    if(cat==="volume"&&d.length<4)d=ASSETS.slice().sort(function(a,b){return (b.vol||0)-(a.vol||0);});
    d=d.slice(0,4); _moverFrozen[cat]=d.map(function(a){return a.code;}); return d;
  }
  // Volume is the default tab: it answers "what is actually trading", and unlike a percentage it cannot
  // be manufactured on a dead asset. Claimed once, so it never drags the reader back mid-browse.
  function moverDefault(){
    var bar=q(".dex-mover-tabs")||q(".dex-mover-tab")&&q(".dex-mover-tab").parentNode;
    if(!bar||bar.__lxDef)return; bar.__lxDef=1;
    var tabs=qa(".dex-mover-tab"), vol=null;
    tabs.forEach(function(t){ if((t.getAttribute("data-cat")||"")==="volume")vol=t; });
    if(!vol)return;
    // Order Volume, Gainers, Losers to match.
    var want=["volume","gainers","losers"], map={};
    tabs.forEach(function(t){ map[t.getAttribute("data-cat")||""]=t; });
    if(map.volume&&map.gainers&&map.losers)want.forEach(function(c){ bar.appendChild(map[c]); });
    tabs.forEach(function(t){ t.classList.toggle("active",t===vol); });
  }
  function renderMovers(){ var grid=q("#dexMoverGrid")||q("#mdxMoverList"); if(!grid)return;
    try{ moverDefault(); }catch(_){}
    var data=moverData(); var sig=data.map(function(a){return a.code;}).join(",");
    // An empty category is now possible and is a real answer: Gainers and Losers are quality-gated, so on
    // a day when nothing qualifies there is nothing to show. Say so rather than leaving a blank panel --
    // and never pad it, which would put arbitrary assets under a heading claiming they moved.
    if(window.__lxDEXloaded&&!data.length){
      var cat0=moverCat();
      var msg='<div class="dex-mover-empty">No '+(cat0==="losers"?"losers":"gainers")
        +' right now among assets with real liquidity and holders.</div>';
      if(grid.innerHTML!==msg){ grid.innerHTML=msg; grid.__lxsig="empty|"+cat0; }
      return;
    }
    if(grid.__lxsig!==sig || !grid.querySelector(".dex-mover-card[data-tkr]")){    // rebuild only when the top-4 order changes
      grid.innerHTML=data.map(function(a){
        return '<div class="dex-mover-card" data-tkr="'+a.code+'" data-cat="'+a.cat+'">'
          +'<div class="dex-mover-head">'
            +'<span class="dex-mover-ico" data-lxic="'+a.code+'" style="background:linear-gradient(135deg,'+a.b+','+a.b+'cc)">'+initials(a.code)+'</span>'
            +'<div class="dex-mover-pair">'+a.code+vtick(a.code,a.issuer)+'<span class="sub">\\u2014</span></div>'
            +'<span class="dex-mover-pct">\\u2014</span>'
          +'</div>'
          +'<div class="dex-mover-body">'
            +'<div class="dex-mover-l">'
              +'<div class="dex-mover-price">\\u2014</div>'
              +'<div class="dex-mover-vol">\\u2014</div>'
            +'</div>'
            +'<div class="dex-mover-r"><div class="dex-mover-trades">\\u2014</div><div class="dex-mover-tlabel">Trades 24h</div></div>'
          +'</div>'
          +sparkSvg(null,true)
        +'</div>'; }).join("");
      grid.__lxsig=sig; paintIcons(grid);
      qa(".dex-mover-card",grid).forEach(function(card){ card.addEventListener("click",function(){ var a=byCode[card.getAttribute("data-tkr")]; if(a)navTo(a); }); });
      grid.classList.add("lxd");
    }
    qa(".dex-mover-card[data-tkr]",grid).forEach(function(card){ var a=byCode[card.getAttribute("data-tkr")]; if(!a)return; paintIcons(card);
      if(!window.__lxDEXloaded)return;                          // reveal all detail values together, not one by one
      var _cu=chgShown(a); var up=(_cu||0)>=0;
      setTxt(card.querySelector(".dex-mover-pair .sub"),dispDom(a.code,a.issuer,a.domain)||shortG(a.issuer));
      var pct=card.querySelector(".dex-mover-pct"); if(pct){ pct.className="dex-mover-pct"+(_cu!=null?(up?" up":" down"):""); setTxt(pct,_cu!=null?(up?"+":"")+_cu.toFixed(2)+"%":"\\u2014"); }
      setHTML(card.querySelector(".dex-mover-price"),fmtPrice(a.px)+' <span style="font-size:14px;color:var(--text-soft);font-weight:600">XLM</span>');
      var vu=a.vol!=null?a.vol*xlmUsd:null;
      setHTML(card.querySelector(".dex-mover-vol"),'<span class="lxk">Vol</span><span class="lxv">'+(vu!=null?lcm(vu):"\\u2014")+'</span><span class="lxk">TVL</span><span class="lxv">'+(a.tvlUsd!=null?lcm(a.tvlUsd):"\\u2014")+'</span>');
      setTxt(card.querySelector(".dex-mover-trades"),a.trades!=null?num(a.trades):"\\u2014");
      fillSpark(card,a.spark,up);
    });
  }

  // ================= 4) ALL TRADING PAIRS (#dexMkTbody) =================
  // Column sorting. Five numeric columns, keyed to the fields the rows already carry.
  var MK_SORTS=[["th-price","px"],["th-change","chg"],["th-vol","vol"],["th-trades","trades"],["th-tvl","tvlUsd"]];
  // Default: 24h volume, high to low. dir -1 = biggest first. "" would mean roster order, which is now
  // only reachable by sorting on another column.
  var mkSort={key:"vol",dir:-1};
  // Unknowns sink to the bottom in BOTH directions. Sorting ascending by volume should surface the
  // quietest real market, not the thirty rows whose volume has not been fetched yet -- those carry no
  // information and would bury the answer.
  function mkCmp(k,dir){ return function(a,b){
    var x=a[k], y=b[k];
    var xn=(x==null||x!==x), yn=(y==null||y!==y);
    if(xn&&yn)return 0; if(xn)return 1; if(yn)return -1;
    return dir<0?(y-x):(x-y); }; }
  function mkSortRows(d){ return mkSort.key?d.slice().sort(mkCmp(mkSort.key,mkSort.dir)):d; }
  // The thead is design markup; make the numeric columns clickable once and keep the arrows in step.
  function ensureSortHeaders(){
    var tb=q("#dexMkTbody"); if(!tb||!tb.closest)return; var tbl=tb.closest("table"); if(!tbl)return;
    var thr=tbl.querySelector("thead tr"); if(!thr)return;
    MK_SORTS.forEach(function(s){
      var th=thr.querySelector("."+s[0]); if(!th)return;
      if(!th.__lxs){ th.__lxs=1; th.classList.add("lx-sortable"); th.setAttribute("data-sk",s[1]);
        var ar=document.createElement("span"); ar.className="lx-sarrow"; th.appendChild(ar); }
      var on=(mkSort.key===s[1]);
      if(th.classList.contains("lx-son")!==on)th.classList.toggle("lx-son",on);
      var a2=th.querySelector(".lx-sarrow");
      if(a2){ var want=on?(mkSort.dir<0?"\\u25bc":"\\u25b2"):"\\u21c5"; if(a2.textContent!==want)a2.textContent=want; }
    });
  }
  // The click has to be caught on WINDOW CAPTURE, not on the header.
  //
  // The design ships a delegated navigation handler on DOCUMENT capture, and document capture runs before
  // the event ever reaches the th -- so a listener on the header itself never fired, and every click on a
  // column title reloaded the page instead of sorting it (measured: navigation type "navigate", referrer
  // equal to the page's own URL). Window capture is the only phase that runs earlier. Same reason and the
  // same shape as the mobile layer's nav interception.
  function installSortClicks(){
    if(window.__lxDEXsortClick)return; window.__lxDEXsortClick=1;
    window.addEventListener("click",function(e){
      var t=e.target; if(!t||!t.closest)return;
      var th=t.closest("th.lx-sortable[data-sk]"); if(!th)return;
      e.preventDefault(); e.stopImmediatePropagation();
      var k=th.getAttribute("data-sk");
      if(mkSort.key===k)mkSort.dir=-mkSort.dir; else { mkSort.key=k; mkSort.dir=-1; }
      mkPage=1;                                               // a new order starts at the top of the list
      guardApply();
    },true);
  }
  function tableData(){ var f=(q(".dex-mk-filter.active")||{}).getAttribute?(q(".dex-mk-filter.active").getAttribute("data-filter")||"all"):"all";
    var qs=""; var si=q("#dexMkSearch"); if(si)qs=(si.value||"").trim().toLowerCase();
    // Kicked off here rather than on the native tab alone: All lists them too, so they load with the page.
    loadNative();
    var d=(f==="native")?NATIVE.slice():allAssets();
    if(f==="utility")d=d.filter(function(a){return a.cat==="utility";});
    else if(f==="stables")d=d.filter(function(a){return a.cat==="stable";});
    else if(f==="memes")d=[];
    if(qs)d=d.filter(function(a){ return a.code.toLowerCase().indexOf(qs)>=0 || (a.issuer||"").toLowerCase().indexOf(qs)>=0 || (a.domain||"").toLowerCase().indexOf(qs)>=0; });
    return mkSortRows(d);                                     // sorted here, so pagination pages the SORTED set
  }
  function tableSig(){ var f=(q(".dex-mk-filter.active")||{}).getAttribute?(q(".dex-mk-filter.active").getAttribute("data-filter")||"all"):"all"; var qs=(q("#dexMkSearch")||{}).value||""; return f+"|"+qs.trim().toLowerCase()+"|"+NATIVE.length+"|"+nativeState+"|"+mkSort.key+mkSort.dir; }
  // the thead is design markup (8 cols); insert a "Trades (24h)" th once, right after Volume (24h), so the 24h-activity columns sit together.
  function ensureTradesHeader(){ var tb=q("#dexMkTbody"); if(!tb||!tb.closest)return; var tbl=tb.closest("table"); if(!tbl)return;
    var thr=tbl.querySelector("thead tr"); if(!thr||thr.querySelector(".th-trades"))return;
    var th=document.createElement("th"); th.className="th-trades"; th.textContent="Trades (24h)";
    var volTh=thr.querySelector(".th-vol");
    if(volTh){ thr.insertBefore(th,volTh.nextSibling); } else { thr.appendChild(th); }
  }
  // ---- pagination -----------------------------------------------------------------------------------
  var MK_PER=25, mkPage=1;
  var PG_F='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>';
  var PG_P='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="15 18 9 12 15 6"/></svg>';
  var PG_N='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="9 18 15 12 9 6"/></svg>';
  var PG_L='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>';
  function renderPager(pages){
    var pg=q(".dex-mk-pager"); if(!pg)return;
    // One page needs no controls -- a lone "1" with four dead arrows is furniture, not navigation.
    if(pages<2){ if(pg.__lxh!=="")  { pg.innerHTML=""; pg.__lxh=""; } pg.style.display="none"; return; }
    pg.style.display="";
    var h="";
    function nav(ic,to,lab){ var off=(to<1||to>pages||to===mkPage);
      return '<button class="dex-mk-pgbtn" data-pg="'+to+'" aria-label="'+lab+'"'+(off?' disabled style="opacity:.4;cursor:default"':"")+'>'+ic+'</button>'; }
    h+=nav(PG_F,1,"First")+nav(PG_P,mkPage-1,"Previous");
    // a five-wide window around the current page, with the first/last page always reachable
    var lo=Math.max(1,mkPage-2), hi=Math.min(pages,lo+4); lo=Math.max(1,hi-4);
    if(lo>1){ h+='<button class="dex-mk-pgbtn" data-pg="1">1</button>'; if(lo>2)h+='<span class="dex-mk-dots">\u2026</span>'; }
    for(var i=lo;i<=hi;i++)h+='<button class="dex-mk-pgbtn'+(i===mkPage?" active":"")+'" data-pg="'+i+'">'+i+'</button>';
    if(hi<pages){ if(hi<pages-1)h+='<span class="dex-mk-dots">\u2026</span>'; h+='<button class="dex-mk-pgbtn" data-pg="'+pages+'">'+pages+'</button>'; }
    h+=nav(PG_N,mkPage+1,"Next")+nav(PG_L,pages,"Last");
    if(pg.__lxh!==h){ pg.innerHTML=h; pg.__lxh=h; }
    if(!pg.__lxw){ pg.__lxw=1;
      // CAPTURE, and stop the event here: the layer already runs a window-capture nav handler for rows,
      // and the design has its own click plumbing in this footer.
      pg.addEventListener("click",function(e){
        var b=e.target&&e.target.closest?e.target.closest("[data-pg]"):null; if(!b||b.disabled)return;
        e.preventDefault(); e.stopImmediatePropagation();
        var n=+b.getAttribute("data-pg")||1; if(n===mkPage)return; mkPage=n; guardApply();
        try{ var sec=q(".dex-markets"); if(sec&&sec.scrollIntoView)sec.scrollIntoView({block:"start",behavior:"smooth"}); }catch(_){}
      },true); }
  }
  function renderTable(){ var tb=q("#dexMkTbody"); if(!tb)return;
    try{ ensureTradesHeader(); }catch(_){}
    try{ ensureSortHeaders(); installSortClicks(); }catch(_){}  // after the Trades column exists, so it sorts too
    var all=tableData();
    // A new filter or search starts at page 1 -- but NOT a data refresh. tableSig() also moves as the
    // native roster loads, so keying the reset on it would yank a reader back to page 1 mid-browse.
    var fkey=curFilter()+"|"+(((q("#dexMkSearch")||{}).value)||"").trim().toLowerCase();
    if(tb.__lxfk!==fkey){ tb.__lxfk=fkey; mkPage=1; }
    var pages=Math.max(1,Math.ceil(all.length/MK_PER)); if(mkPage>pages)mkPage=pages;
    var start=(mkPage-1)*MK_PER, data=all.slice(start,start+MK_PER);
    try{ priceVisible(data); }catch(_){}                      // fetch the rows this page actually shows
    // The visible ORDER joins the signature whenever a sort is active. Without it the skeleton is only
    // rebuilt when the filter, search, page or sort CONTROL changes -- and volumes arrive long after
    // that, so a volume sort would freeze in whatever order the rows had before a single number landed.
    // Values still fill in place; this only rebuilds when the sequence itself actually differs.
    var sig=tableSig()+"|p"+mkPage+(mkSort.key?("|"+data.map(function(a){return a.tkr||a.code;}).join(",")):"");
    try{ renderPager(pages); }catch(_){}
    // rebuild the skeleton ONLY when the filter/search changes (user action) or our rows were clobbered
    if(tb.__lxsig!==sig || (!tb.querySelector("tr[data-tkr]")&&!tb.querySelector("tr.lx-dex-empty-row"))){
      if(!data.length){ tb.innerHTML='<tr class="lx-dex-empty-row"><td colspan="9"><div class="lx-dex-empty">No matching markets on Stellar right now.</div></td></tr>'; }
      else tb.innerHTML=data.map(function(a){
        return '<tr data-tkr="'+(a.tkr||a.code)+'" data-iss="'+a.issuer+'" data-cat="'+a.cat+'">'
          +'<td><div class="dex-mk-pair-cell">'
            +'<span class="dex-mk-pair-ic" data-lxic="'+a.code+'" style="background:linear-gradient(135deg,'+a.b+','+a.b+'aa)">'+initials(a.code)+'</span>'
            +'<div class="dex-mk-pair-name"><div class="dex-mk-pair-head">'+a.code+vtick(a.code,a.issuer)+'</div><span class="sub">'+(dispDom(a.code,a.issuer,a.domain)||shortG(a.issuer))+'</span></div>'
          +'</div></td>'
          +'<td><div class="dex-mk-price">\\u2014</div></td>'
          +'<td><div class="dex-mk-change">\\u2014</div></td>'
          +'<td><div class="dex-mk-vol">\\u2014</div></td>'
          +'<td class="dex-mk-trades-td"><div class="dex-mk-trades">\\u2014</div></td>'
          +'<td><div class="dex-mk-tvl">\\u2014</div></td>'
          +'<td><div class="dex-mk-hl">'
            +'<div class="row"><span class="lab">H</span><span class="v-h">\\u2014</span></div>'
            +'<div class="row"><span class="lab">L</span><span class="v-l">\\u2014</span></div>'
          +'</div></td>'
          +'<td style="text-align:right">'+sparkSvg(null,true)+'</td>'
          +'<td style="text-align:right"><button class="dex-mk-action-btn" data-tkr="'+(a.tkr||a.code)+'">Trade</button></td>'
        +'</tr>'; }).join("");
      tb.__lxsig=sig; paintIcons(tb);
      qa("tr[data-tkr]",tb).forEach(function(tr){ tr.addEventListener("click",function(){ var a=byCode[tr.getAttribute("data-tkr")]; if(a)navTo(a); }); });
      qa(".dex-mk-action-btn",tb).forEach(function(btn){ btn.addEventListener("click",function(e){ e.stopPropagation(); var a=byCode[btn.getAttribute("data-tkr")]; if(a)navTo(a); }); });
      var shown=q("#dexMkShown"); if(shown)setTxt(shown,data.length===0?"0":(start+1)+"\\u2013"+(start+data.length));
      var strongs=qa(".dex-mk-page-info strong"); if(strongs[1])setTxt(strongs[1],String(all.length));
      if(sortReady)tb.classList.add("lxd");
    }
    if(sortReady&&!tb.classList.contains("lxd"))tb.classList.add("lxd");
    // fill values in place (no innerHTML churn -> no glitch); gated so ALL rows' details reveal together
    qa("tr[data-tkr]",tb).forEach(function(tr){ var a=byCode[tr.getAttribute("data-tkr")]; if(!a)return; paintIcons(tr);
      if(!window.__lxDEXloaded)return;                          // reveal all detail values together, not one by one
      var _cu=chgShown(a); var up=(_cu||0)>=0;
      var pu=priceUsd(a), vu=a.vol!=null?a.vol*xlmUsd:null, hi=a.high!=null?a.high:a.px, lo=a.low!=null?a.low:a.px;
      setHTML(q(".dex-mk-price",tr),fmtPrice(a.px)+' XLM<span class="sub">'+(pu>0?lcmExact(pu):"\\u2014")+'</span>');
      var chg=q(".dex-mk-change",tr); if(chg){ chg.className="dex-mk-change"+(_cu!=null?(up?" up":" down"):""); setTxt(chg,_cu!=null?(up?"+":"")+_cu.toFixed(2)+"%":"\\u2014"); }
      setHTML(q(".dex-mk-vol",tr),(a.vol!=null?fmtAmt(a.vol)+" XLM":"\\u2014")+'<span class="sub">'+(vu!=null?lcm(vu):"")+'</span>');
      setTxt(q(".dex-mk-trades",tr),a.trades!=null?num(a.trades):"\\u2014");
      setHTML(q(".dex-mk-tvl",tr),a.tvlUsd!=null?lcm(a.tvlUsd):"\\u2014");
      setTxt(q(".v-h",tr),fmtPrice(hi)+" XLM"); setTxt(q(".v-l",tr),fmtPrice(lo)+" XLM");
      fillSpark(tr,a.spark,up); paintIcons(tr);
    });
  }

  // ================= apply / observe / boot =================
  function applyAll(){
    try{ applyMobileHero(); }catch(_){}         // first: builds the .lm the next three expect on mobile
    try{ applyMobileCtas(); }catch(_){}         // then move the page CTAs into it
    try{ applyHero(); }catch(_){}
    try{ applyCosmic(); }catch(_){}             // same nebula/stars/constellation animation as the Pools hero
    try{ applyPromoConstel(); }catch(_){}       // keeps the original .lm-svg zigzag hidden (rebuilt as hidden .lx-dxc)
    try{ applyHeroStats(); }catch(_){}
    try{ denomUi(); denomUiSync(); }catch(_){}
    try{ renderMints(); }catch(_){}
    try{ renderMovers(); }catch(_){}
    try{ renderTable(); }catch(_){}
  }

  // TVL across an asset's pools valued in USD (native-paired: nat*2; asset-paired: ass*px*2), then *xlmUsd.
  function computeTvl(a){ if(!a.poolsRaw)return; var txlm=0; a.poolsRaw.forEach(function(p){ if(p.nat>0)txlm+=p.nat*2; else if(p.ass>0&&a.px>0)txlm+=p.ass*a.px*2; }); a.tvlXlm=txlm; a.tvlUsd=txlm*xlmUsd; }
  function recomputeAllTvl(){ ASSETS.forEach(computeTvl); }

  // stellar.toml (best-effort; many issuers' domains are CORS-OK) -> [[CURRENCIES]].image for the real logo
  function loadToml(a,domain){
    fetch("https://"+domain+"/.well-known/stellar.toml").then(function(r){ if(!r.ok)throw 0; return r.text(); }).then(function(txt){
      var re=new RegExp("code\\\\s*=\\\\s*[\\"']"+a.code+"[\\"'][^]*?(?=\\\\[\\\\[|$)","i");
      // NOT ||txt. Falling back to the whole document meant an asset the toml does NOT list matched the
      // FIRST image= in the file -- LUMOS's -- so every unlisted mint rendered with the LUMOS flame.
      // Invisible while lumoscore.com served no toml; wrong the moment it started serving one.
      var blk=(txt.match(re)||[""])[0];
      if(!blk)return;
      var img=(blk.match(/image\\s*=\\s*["']([^"']+)["']/i)||[])[1];
      if(img){ a.img=img; touch(); }
    }).catch(function(){});
  }

  // Just enough for a mints row: the latest daily bar (price) and /assets (supply + holders). Two
  // requests instead of five, and none of them the 168-bucket sparkline series.
  function loadAssetLite(a){
    var atype=a.code.length<=4?"credit_alphanum4":"credit_alphanum12";
    var base="base_asset_type="+atype+"&base_asset_code="+a.code+"&base_asset_issuer="+a.issuer+"&counter_asset_type=native";
    return Promise.all([
      j(H+"/trade_aggregations?"+base+"&resolution=86400000&order=desc&limit=1").then(function(d){
        var r=recs(d)[0]; if(r){ a.px=+r.close||+r.avg||subPx(r)||a.px; } }).catch(function(){}),
      j(H+"/assets?asset_code="+a.code+"&asset_issuer="+a.issuer).then(function(d){
        var rec=recs(d)[0]; if(!rec)return;
        if(rec.accounts)a.holders=(+rec.accounts.authorized||0)+(+rec.accounts.authorized_to_maintain_liabilities||0);
        if(rec.balances)a.supply=+rec.balances.authorized||+rec.balances.authorized_to_maintain_liabilities||a.supply;
        else if(rec.amount!=null)a.supply=+rec.amount;
        // same free home_domain as the edge endpoint, so the degraded path labels rows too
        var tl=rec._links&&rec._links.toml&&rec._links.toml.href;
        if(tl&&!a.domain){ var af=String(tl).split("//")[1]||""; a.domain=af.split("/")[0]||""; if(a.domain&&!a.img)loadToml(a,a.domain); }
      }).catch(function(){})
    ]).then(touch);
  }

  function loadAsset(a){
    var atype=a.code.length<=4?"credit_alphanum4":"credit_alphanum12";
    var base="base_asset_type="+atype+"&base_asset_code="+a.code+"&base_asset_issuer="+a.issuer+"&counter_asset_type=native";
    var calls=[];
    // price + 24h change + high/low + 24h volume (daily aggregations)
    calls.push(j(H+"/trade_aggregations?"+base+"&resolution=86400000&order=desc&limit=2").then(function(d){ var r=recs(d);
      if(r[0]){ a.px=+r[0].close||+r[0].avg||subPx(r[0])||a.px; a.vol=+r[0].counter_volume||0; a.high=+r[0].high||0; a.low=+r[0].low||0; a.trades=+r[0].trade_count||0; }
      if(r[0]&&r[1]&&+r[1].close>0)a.chg=((+r[0].close-+r[1].close)/+r[1].close)*100;
      computeTvl(a); touch(); }).catch(function(){}));
    // 7D trend sparkline: the MOST RECENT 168 hourly buckets (=7 days), desc then reversed to chronological.
    // (was resolution=3600000 order=asc limit=24 -> the 24 OLDEST buckets = wrong window under a "7D" label.)
    calls.push(j(H+"/trade_aggregations?"+base+"&resolution=3600000&order=desc&limit=168").then(function(d){ var r=recs(d).slice().reverse();
      var pts=r.map(function(x){ return +x.avg||+x.close||0; }).filter(function(v){ return v>0; }); if(pts.length>=2)a.spark=pts; touch(); }).catch(function(){}));
    // pool TVL
    calls.push(j(H+"/liquidity_pools?reserves="+a.code+":"+a.issuer+"&limit=200").then(function(d){ var r=recs(d);
      a.poolsRaw=r.map(function(p){ var nat=0,ass=0; (p.reserves||[]).forEach(function(rv){ if(rv.asset==="native")nat=+rv.amount; else if(rv.asset.indexOf(a.code+":"+a.issuer)===0)ass=+rv.amount; }); return {nat:nat,ass:ass}; });
      computeTvl(a); touch(); }).catch(function(){}));
    // holders (trustlines) + supply
    calls.push(j(H+"/assets?asset_code="+a.code+"&asset_issuer="+a.issuer).then(function(d){ var rec=recs(d)[0]; if(!rec)return;
      if(rec.accounts)a.holders=(+rec.accounts.authorized||0)+(+rec.accounts.authorized_to_maintain_liabilities||0);
      if(rec.balances)a.supply=+rec.balances.authorized||+rec.balances.authorized_to_maintain_liabilities||a.supply;
      else if(rec.amount!=null)a.supply=+rec.amount; touch(); }).catch(function(){}));
    // issuer home_domain (-> mint/mover sub + stellar.toml logo)
    // home_domain is stable and the cached roster already carries it -- only ask when we do not know
    if(a.domain){ loadToml(a,a.domain); }
    else calls.push(j(H+"/accounts/"+a.issuer).then(function(acc){ a.domain=acc.home_domain||""; touch(); if(acc.home_domain)loadToml(a,acc.home_domain); }).catch(function(){ a.domain=""; }));
    return Promise.all(calls);
  }

  function loadData(){
    // Our own edge, cached: CoinGecko's free tier answers a handful of requests a minute per IP and
    // every visitor was spending that budget on the same public number. xlmChg is load-bearing now --
    // every percentage in the pair list is derived from it -- so it has to actually arrive.
    j("/lxapi/xlm").then(function(d){
      if(d&&+d.usd>0){ xlmUsd=+d.usd;
        if(d.chg24!=null){xlmChg=+d.chg24;try{window.__lxXlmChg=xlmChg;}catch(_e2){}}
        try{ localStorage.setItem("lumos.xlmUsd",JSON.stringify({v:xlmUsd,chg:xlmChg,ts:Date.now()})); }catch(_e){} }
      recomputeAllTvl(); touch();
    }).catch(function(){});
    // load ALL assets in PARALLEL so values + logos land together (no "loading one by one" cascade). When
    // every asset is in, flag loaded -> the movers compute their final top-4 order ONCE (no re-sort glitch).
    // the curated set the same way as everything else: numbers in one batched request, extras after
    ASSETS.forEach(function(a){ a.__px=1; });
    // priceVisible is exported because the PHONE renders its own pair list. Only the five newest native
    // tokens are priced up front; every other row is priced when it is actually rendered, and the desktop
    // list does that itself. The mobile list had no way to ask, so 26 of 32 launchpad tokens sat at
    // "0 XLM / —" -- and they had not simply never traded: LIBERATOR, BLA and TDT had all traded within
    // the hour. It was a missing request, not a missing market.
    batchPx(ASSETS).then(function(){ window.__lxDEXloaded=1; try{ markSortReady(); }catch(_){} try{window.__lxDEXassets=ASSETS;window.__lxDEXmovers=moverData;window.__lxDEXlogoCss=logoCss;window.__lxDEXpriceRows=priceVisible;window.__lxDEXmints=mintList;}catch(_){} touch(); deferExtras(ASSETS); },
      function(){ window.__lxDEXloaded=1; try{ markSortReady(); }catch(_){} touch(); });
    // safety: reveal details even if an asset's request hangs (never leave the table stuck on placeholders)
    setTimeout(function(){ sortReady=true; try{ window.__lxDEXsortReady=1; }catch(_){} try{ guardApply(); }catch(_){} }, 6000);
    setTimeout(function(){ if(!window.__lxDEXloaded){ window.__lxDEXloaded=1; try{window.__lxDEXassets=ASSETS;window.__lxDEXmovers=moverData;window.__lxDEXlogoCss=logoCss;}catch(_){} touch(); } }, 4500);
  }

  // dedicated per-section guardian: fires only on a CHILDLIST change of the container (i.e. the design blew
  // away our rows with its mock render). We observe childList ONLY (not subtree/characterData) so the site
  // money-formatter's in-place text tweaks never trigger us, and the render funcs self-skip unless our marker
  // is gone or DV changed -> no MutationObserver ping-pong / renderer freeze.
  function guardEl(sel,fn){ var el=q(sel); if(!el||el.__lxg)return; el.__lxg=1;
    try{ var mo=new MutationObserver(function(){ if(el.__lxgBusy)return; el.__lxgBusy=1; mo.disconnect(); try{ fn(); }catch(_){} try{ mo.observe(el,{childList:true}); }catch(_){} el.__lxgBusy=0; });
      mo.observe(el,{childList:true}); }catch(_){}
  }

  var sched2=false;
  function guardApply(){ try{ applyAll(); }catch(_){} }
  function sched(){ if(sched2)return; sched2=true; setTimeout(function(){ sched2=false; guardApply(); },200); }
  function touch(){ DV++; sched(); }                          // real data landed -> bump version + re-render
  window.__lxDEXapply=guardApply;
  window.__lxDEXloadNative=loadNative;
  window.__lxDEXnativeList=function(){ return {list:NATIVE,state:nativeState}; };
  window.__lxDEXdbg=function(){ return {xlmUsd:xlmUsd,xlmChg:xlmChg,assets:ASSETS.map(function(a){return {code:a.code,px:a.px,chg:a.chg,vol:a.vol,tvlUsd:a.tvlUsd,holders:a.holders,supply:a.supply,domain:a.domain,img:a.img};})}; };

  // #19: a two-state switch to the LEFT of the filter input, which is where the row has room and where
  // it reads as a property of the list rather than of the search. Segmented rather than a dropdown: two
  // options, both worth showing, and the current one should be readable without opening anything.
  function denomUi(){
    var box=document.querySelector(".dex-mk-search"); if(!box||box.__lxdn)return; box.__lxdn=1;
    var wrap=document.createElement("div"); wrap.className="lx-dnsw"; wrap.setAttribute("role","group");
    wrap.setAttribute("aria-label","Show price change in");
    // data-logo is the skip flag for the logo engine baked into the container. Without it this switch was
    // silently emptied on every load: that engine claims ANY element whose text is 1-5 characters and
    // which "looks like an icon" (a border-radius of 4px or more, or a gradient), then replaces its
    // contents with a token image. The wrapper reads "$XLM" -- four characters in a rounded, filled box --
    // so it was a perfect match, and the two buttons went with it. Set on the buttons too, since either
    // one alone would qualify on its own.
    wrap.innerHTML='<button type="button" data-dn="usd">$</button><button type="button" data-dn="xlm">XLM</button>';
    wrap.setAttribute("data-logo","");
    [].slice.call(wrap.querySelectorAll("button")).forEach(function(b){ b.setAttribute("data-logo",""); });
    box.parentNode.insertBefore(wrap,box);
    wrap.addEventListener("click",function(e){
      var b=e.target&&e.target.closest?e.target.closest("button[data-dn]"):null; if(!b)return;
      e.preventDefault(); e.stopPropagation();
      setDenom(b.getAttribute("data-dn")); denomUiSync(); touch();
    });
    denomUiSync();
  }
  function denomUiSync(){
    var d=denom();
    qa(".lx-dnsw button[data-dn]").forEach(function(b){
      var on=b.getAttribute("data-dn")===d;
      if(b.classList.contains("on")!==on)b.classList.toggle("on",on);
      b.setAttribute("aria-pressed",on?"true":"false");
    });
  }
  function boot(){
    try{ denomUi(); }catch(_){}
    loadManifest();                                            // our own hosted token icons; independent of the toml
    guardApply();                                              // synchronous skeleton (real tickers/icons, "\\u2014" values, .lxd) -> no mock flash, no blank
    // The design has its own row/Trade click handler that opens the asset page WITHOUT the ?asset= param
    // (lands on default LUMOS). Preempt it with a document-CAPTURE delegated nav that carries the param and
    // stopImmediatePropagation()s the design's handler. Survives node replacement (delegated) too.
    if(!window.__lxDEXnav){ window.__lxDEXnav=1;
      // WINDOW-capture (the earliest phase) so we run before the design's document-capture nav handler.
      window.addEventListener("click",function(e){ var t=e.target; if(!t||!t.closest)return;
        var el=t.closest(".dex-mk-action-btn[data-tkr],tr[data-tkr],.dex-mint-row[data-tkr],.dex-mover-card[data-tkr]"); if(!el)return;
        var a=byCode[el.getAttribute("data-tkr")]; if(!a)return;
        e.preventDefault(); e.stopImmediatePropagation(); navTo(a);
      },true);
    }
    // Market-mover tab clicks must re-render (the boot interval stops after ~21s, and a tab click alone
    // doesn't change #dexMoverGrid's children, so the childList observer wouldn't fire). Delegated so it
    // survives node replacement; a short + backup tick lets the design toggle .active first.
    if(!window.__lxDEXtab){ window.__lxDEXtab=1;
      document.addEventListener("click",function(e){ var t=e.target&&e.target.closest?e.target.closest(".dex-mover-tab,.mdx-mover-tab,.dex-mk-filter,.mdx-mk-filter"):null; if(t){ setTimeout(guardApply,30); setTimeout(guardApply,160); } });
    }
    guardEl("#dexMintsList",renderMints);
    guardEl("#dexMoverGrid",renderMovers);
    guardEl("#mdxMoverList",renderMovers);
    guardEl("#dexMkTbody",renderTable);
    loadData();
    var ticks=0, iv=setInterval(function(){ guardApply(); if(++ticks>30)clearInterval(iv); },700);
  }
  if(document.readyState!=="loading")boot(); else document.addEventListener("DOMContentLoaded",boot);
})();<\/script>`;


// ===================================================================================================
// "How it works" dialog. Its own block on purpose: it does not share a scope with the data layer, so a
// throw in there cannot take the popup with it, and it needs none of that layer's state.
// ===================================================================================================
const HIW = `<style id="lx-hiw-css">
.lx-hiw{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px}
.lx-hiw[hidden]{display:none}
.lx-hiw-bd{position:absolute;inset:0;background:rgba(8,8,12,.62);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
.lx-hiw-card{position:relative;z-index:1;width:100%;max-width:560px;max-height:86vh;overflow:auto;-webkit-overflow-scrolling:touch;
  background:var(--surface,#fff);color:var(--text,#0e0e10);border:1px solid var(--border,#ececef);border-radius:18px;
  padding:26px 26px 22px;box-shadow:0 28px 70px -20px rgba(6,8,16,.55);animation:lxHiwIn .16s ease-out}
@keyframes lxHiwIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.lx-hiw-card{animation:none}}
.lx-hiw-x{position:absolute;top:14px;right:14px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;
  border-radius:9px;border:1px solid var(--border,#ececef);background:transparent;color:var(--text-muted,#5c5c66);
  font-size:19px;line-height:1;cursor:pointer}
.lx-hiw-x:hover{background:var(--surface-2,#fafbfc);color:var(--text,#0e0e10)}
.lx-hiw-x:focus-visible{outline:2px solid var(--accent,#ea6a2c);outline-offset:2px}
.lx-hiw-t{margin:0 34px 2px 0;font-size:21px;font-weight:800;letter-spacing:-.02em}
.lx-hiw-sub{margin:0 0 16px;font-size:13.5px;line-height:1.5;color:var(--text-muted,#5c5c66)}
.lx-hiw-h{margin:0 0 12px;font:700 10.5px/1 'JetBrains Mono',monospace;letter-spacing:.09em;text-transform:uppercase;color:var(--accent,#ea6a2c)}
.lx-hiw-s+.lx-hiw-s{margin-top:18px;padding-top:18px;border-top:1px solid var(--border,#ececef)}
.lx-hiw-l{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
.lx-hiw-l li{display:grid;grid-template-columns:26px 1fr;gap:12px;align-items:start}
.lx-hiw-n{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font:700 12px/1 'JetBrains Mono',monospace;color:var(--accent,#ea6a2c);
  background:var(--accent-pale,rgba(234,106,44,.10));border:1px solid var(--accent-soft,rgba(234,106,44,.22))}
.lx-hiw-b{display:block;font-size:14px;font-weight:700;margin-bottom:3px}
.lx-hiw-p{display:block;font-size:13.5px;line-height:1.55;color:var(--text-muted,#5c5c66)}
.lx-hiw-f{margin:16px 0 0;padding-top:14px;border-top:1px solid var(--border,#ececef);
  font-size:12.5px;line-height:1.55;color:var(--text-muted,#5c5c66)}   /* --text-soft measured 3.64 here: under AA */
/* --accent on a white card measures 3.18 -- under AA for 10.5px labels and the step numerals. Dark
   theme is fine at 5.82, so only light is deepened. */
html[data-theme="light"] .lx-hiw-h,html[data-theme="light"] .lx-hiw-n{color:#a8491a}
@media(max-width:560px){
  .lx-hiw{padding:0;align-items:flex-end}
  .lx-hiw-card{max-width:none;max-height:90vh;border-radius:18px 18px 0 0;padding:22px 18px 20px;animation:lxHiwUp .18s ease-out}
  @keyframes lxHiwUp{from{transform:translateY(14px);opacity:0}to{transform:none;opacity:1}}
  .lx-hiw-t{font-size:19px}
}
</style>
<script id="lx-hiw">(function(){
  if(window.__lxHiwReady)return; window.__lxHiwReady=1;
  var EL=null, prevFocus=null, prevOverflow="", trigger=null;
  function esc(x){return x;}
  function step(n,t,b){ return '<li><span class="lx-hiw-n">'+n+'</span><span><span class="lx-hiw-b">'+t+'</span><span class="lx-hiw-p">'+b+'</span></span></li>'; }
  function build(){
    if(EL)return EL;
    var d=document.createElement("div"); d.className="lx-hiw"; d.id="lxHiw"; d.hidden=true;
    d.innerHTML='<div class="lx-hiw-bd" data-lxhiw-close></div>'
      +'<div class="lx-hiw-card" role="dialog" aria-modal="true" aria-labelledby="lxHiwT">'
      +'<button class="lx-hiw-x" data-lxhiw-close aria-label="Close">×</button>'
      +'<h2 class="lx-hiw-t" id="lxHiwT">How it works</h2>'
      +'<p class="lx-hiw-sub">Trading and minting on LumosCore, end to end.</p>'
      +'<div class="lx-hiw-s"><div class="lx-hiw-h">How to trade</div><ol class="lx-hiw-l">'
      +step(1,"Connect and choose an asset","Connect your Stellar wallet and pick any listed asset. If you do not hold it yet, the trustline is created inside the same transaction, so there is no separate setup step.")
      +step(2,"We route for the best price","Every order is quoted across the Stellar order book, Soroswap, Phoenix and Aquarius, then filled wherever you get the most. Rate, price impact and minimum received are shown before you sign.")
      +step(3,"Sign once, settle on Stellar","One signature sends one transaction, protected by a minimum received floor, so a moving market cannot fill you below it. Want a specific price instead? The Limit tab places a real resting order on the Stellar order book.")
      +'</ol></div>'
      +'<div class="lx-hiw-s"><div class="lx-hiw-h">How to mint</div><ol class="lx-hiw-l">'
      +step(1,"Describe your token","Name, ticker, icon, description, links, total supply, and how much you keep, up to 30%. The remainder seeds the liquidity pool, so your token is tradable the moment it exists.")
      +step(2,"Review the cost","One screen showing the service fee, the pool seed and your starting liquidity, priced in XLM at the live rate, plus the small deposit that creates the issuer account.")
      +step(3,"One signature does all of it","A single atomic transaction creates the issuer, mints your entire supply to you, seeds the XLM pool, then locks the issuer permanently. Supply is fixed from the first block: nobody can mint more, including you.")
      +'</ol></div>'
      +'<p class="lx-hiw-f">Trading fee 0.2% — or 0.1% if you hold 250,000 LUMOS. Stellar network fees are separate and typically a fraction of a cent.</p>'
      +'</div>';
    document.body.appendChild(d); EL=d; return d;
  }
  function open(){
    var d=build(); if(!d.hidden)return;
    prevFocus=trigger||document.activeElement; d.hidden=false;
    prevOverflow=document.body.style.overflow; document.body.style.overflow="hidden";   // no scrolling the page behind
    var x=d.querySelector(".lx-hiw-x"); if(x)try{x.focus();}catch(_){}
  }
  function close(){
    if(!EL||EL.hidden)return;
    EL.hidden=true; document.body.style.overflow=prevOverflow||"";
    if(prevFocus&&prevFocus.focus)try{prevFocus.focus();}catch(_){}
  }
  // WINDOW capture, the earliest phase, and stopImmediatePropagation -- the same reason _mobdex.js gives
  // for its own listener: the design ships a delegated nav handler on DOCUMENT capture, so a document
  // listener here loses the race and the design wins. It treated this href="#" as navigation and re-served
  // the Trade page instead of opening the dialog. stopPropagation is not enough; the design's listener is
  // on the same node and phase, so it needs stopImmediate.
  // Delegated rather than bound, because the build moves this link into the hero (desktop) or the pairs
  // heading (mobile), and a re-rendered list must not be able to orphan the handler.
  window.addEventListener("click",function(e){
    var t=e.target; if(!t||!t.closest)return;
    if(t.closest("[data-lxhiw-close]")){ e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
    var hit=t.closest("#dexHiwBtn,.lx-dctas .dex-hero-btn.ghost,.lx-ctas .mdx-hero-btn.ghost");
    if(hit){ e.preventDefault(); e.stopImmediatePropagation(); trigger=hit; open(); }
  },true);
  document.addEventListener("keydown",function(e){ if(e.key==="Escape"||e.keyCode===27)close(); });
})();</script>`;

// ---- inject into every container that has the dex-main keys ----
const files = fs.readdirSync('.').filter(f => /^lumoscore-.*-(desktop|mobile)\.html$/.test(f));
let n = 0, containers = 0;
for (const file of files) {
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;
  for (const k of KEYS) {
    if (!json[k]) continue;
    let p = json[k];
    p = p.replace(/<style id="lx-dexmain-css">[\s\S]*?<\/style>/, '')
         .replace(/<script id="lx-dexmain">[\s\S]*?<\/script>/, '')
         .replace(/<style id="lx-hiw-css">[\s\S]*?<\/style>/, '')
         .replace(/<script id="lx-hiw">[\s\S]*?<\/script>/, '');
    if (p.indexOf('</head>') >= 0) p = p.replace('</head>', STYLE + '</head>');
    else { const hb = p.lastIndexOf('</body>'); p = p.slice(0, hb) + STYLE + p.slice(hb); }
    // ---- FLASH: put the marker classes in the MARKUP, not on the JS ----
    // Everything the mobile hero replaces -- the page h1 and subtitle, the two CTAs above the card, the
    // four-slide carousel with its badge, its own Start Trading button and its dots -- ships in the static
    // HTML and paints before a line of our JS runs. Adding these classes at runtime meant a visible frame
    // of the untouched design on every load, including the container's "Aptos" wording. Applied here, the
    // CSS that hides them is in force at first paint. (Markup beats a gate beats a mask.)
    if (k === 'lumoscore-dex-mobile.html') {
      // The hero card. Matched as a plain STRING including the carousel attribute, so it can only hit the
      // one element and there is no regex escape to be eaten on the way in.
      // Idempotent: these transforms are re-run on every build, and the container keeps the previous
      // pass's output, so the plain form is gone by the second run. Check for the finished form first and
      // only fail when NEITHER is there, which is the case that would silently ship the flash.
      const HERO = '<div class="lumos-promo" aria-roledescription="carousel"';
      const DONE = '<div class="lumos-promo lx-mobhero" aria-roledescription="carousel"';
      if (p.indexOf(DONE) < 0) {
        if (p.indexOf(HERO) < 0) throw new Error('dex-mobile: hero markup not found — refusing to ship the flash');
        p = p.replace(HERO, DONE);
      }
      // the page heading and its subtitle: hidden to the eye, kept in the outline (see .lx-sronly)
      p = p.replace(/<h1 class="page-title"/, '<h1 class="page-title lx-sronly"')
           .replace(/class="page-subtitle"/, 'class="page-subtitle lx-sronly"');
      // The CTA row moves out of the page flow and into the All Trading Pairs heading, in the MARKUP.
      // Doing it at runtime meant the two buttons painted in their original slot above the hero and then
      // jumped -- the same class of flash as the carousel, which I missed when fixing that one.
      // Guard on the MARKUP form, not the bare name: the stylesheet injected a few lines above already
      // contains ".lx-ctas", so a plain indexOf('lx-ctas') is true on the first pass and skips the move.
      if (p.indexOf('<div class="mdx-hero-ctas lx-ctas"') < 0) {
        const cs = p.indexOf('<div class="mdx-hero-ctas"');
        if (cs < 0) throw new Error('dex-mobile: mdx-hero-ctas not found');
        let i = p.indexOf('>', cs) + 1, depth = 1;          // depth-match, do not guess at the first </div>
        while (depth > 0 && i < p.length) {
          const nd = p.indexOf('<div', i), cd = p.indexOf('</div>', i);
          if (cd < 0) throw new Error('dex-mobile: unbalanced mdx-hero-ctas');
          if (nd >= 0 && nd < cd) { depth++; i = nd + 4; } else { depth--; i = cd + 6; }
        }
        const block = p.slice(cs, i).replace('<div class="mdx-hero-ctas"', '<div class="mdx-hero-ctas lx-ctas"');
        p = p.slice(0, cs) + p.slice(i);
        // The pairs heading is the section head PRECEDING the pairs filters. There are two heads on this
        // page and the mobile renderer reorders them at runtime, so position is not safe -- anchor on the
        // filters and walk back.
        const filt = p.indexOf('<div class="mdx-mk-filters"');
        if (filt < 0) throw new Error('dex-mobile: mdx-mk-filters not found');
        const hs = p.lastIndexOf('<div class="mdx-section-head"', filt);
        if (hs < 0) throw new Error('dex-mobile: pairs section head not found');
        let j = p.indexOf('>', hs) + 1, d2 = 1, close = -1;
        while (d2 > 0 && j < p.length) {
          const nd = p.indexOf('<div', j), cd = p.indexOf('</div>', j);
          if (cd < 0) throw new Error('dex-mobile: unbalanced section head');
          if (nd >= 0 && nd < cd) { d2++; j = nd + 4; } else { d2--; close = cd; j = cd + 6; }
        }
        if (close < 0) throw new Error('dex-mobile: section head close not found');
        p = p.slice(0, close) + block + p.slice(close);
      }
    }
    if (k === 'lumoscore-dex.html' || k === 'lumoscore-dex-dark.html') {
      // The page heading. Hidden to the eye, kept in the DOM: this h1 is the page's only one and it is
      // what a crawler reads. Note it is .dex-hero-l > h1 here, NOT .page-title as on mobile.
      const HL = '<div class="dex-hero-l">';
      if (p.indexOf('<div class="dex-hero-l lx-sronly">') < 0) {
        if (p.indexOf(HL) < 0) throw new Error('dex desktop: .dex-hero-l not found');
        p = p.replace(HL, '<div class="dex-hero-l lx-sronly">');
      }
      // The two page CTAs move onto the hero card, into the ROW THE HEADLINE OCCUPIES. They have to sit
      // inside .lm-c to be a flex item of that row -- parked directly in .lm, as they were, the only way
      // to place them was absolute positioning, which is what left them stranded in a corner.
      // DOM order within the row does not matter: the CSS above gives them order:9 and margin-left:auto,
      // so inserting at the START of .lm-c still paints them last and flush right, and no depth scan is
      // needed to find the row's closing tag.
      const DC = '<div class="dex-hero-r lx-dctas">';
      const scanFrom = function (from) {           // index just past the block's matching </div>
        let i = p.indexOf('>', from) + 1, depth = 1;
        while (depth > 0 && i < p.length) {
          const nd = p.indexOf('<div', i), cd = p.indexOf('</div>', i);
          if (cd < 0) throw new Error('dex desktop: unbalanced hero CTA block');
          if (nd >= 0 && nd < cd) { depth++; i = nd + 4; } else { depth--; i = cd + 6; }
        }
        return i;
      };
      let block = null;
      if (p.indexOf(DC) < 0) {
        const cs = p.indexOf('<div class="dex-hero-r">');
        if (cs < 0) throw new Error('dex desktop: .dex-hero-r not found');
        const end = scanFrom(cs);
        block = p.slice(cs, end).replace('<div class="dex-hero-r">', DC);
        p = p.slice(0, cs) + p.slice(end);
      } else if (p.indexOf('<div class="lm-c">' + DC) < 0) {
        // Built by the earlier version, which parked the block directly inside .lm. Lift it out and let it
        // land in the row below, so a container built before this change converges instead of keeping the
        // old layout for ever (the gitignored containers are not rebuilt from scratch).
        const cs = p.indexOf(DC);
        const end = scanFrom(cs);
        block = p.slice(cs, end);
        p = p.slice(0, cs) + p.slice(end);
      }
      if (block) {
        const anchor = '<div class="lm-c">';
        const lc = p.indexOf(anchor);
        if (lc < 0) throw new Error('dex desktop: hero .lm-c not found');
        const at = lc + anchor.length;
        p = p.slice(0, at) + block + p.slice(at);
      }
    }
    // ALL three Trade keys, not just mobile: the hero headline ships the base chain's wording and
    // _mc_engine.js rewrites it in a text-node walk after load. "Stellar" is two characters longer than
    // "Aptos", so the line re-wrapped and the headline visibly jumped on every load. Baking the served
    // chain in means first paint is already correct; the engine looks for the BASE word, finds none in
    // this node, and leaves it alone.
    const H_APT = '<h2 class="lm-h">The most advanced <em>DEX</em> on Aptos.</h2>';
    const H_XLM = '<h2 class="lm-h">The most advanced <em>DEX</em> on Stellar.</h2>';
    if (p.indexOf(H_APT) >= 0) p = p.replace(H_APT, H_XLM);
    // The network mark, in the markup so it is there at first paint like everything else on this card.
    // aria-hidden because the headline already names the network; a screen reader gains nothing from it.
    // Guard on the MARKUP form. A bare indexOf('lx-heroico') is already true by this point: the
    // stylesheet carries the rule and the mobile builder carries the same span inside a JS string, both
    // injected above. Checking the class name alone skipped this replace entirely.
    const MARK = '<span class="lx-heroico" aria-hidden="true"></span>';
    if (p.indexOf(MARK + H_XLM) < 0 && p.indexOf(H_XLM) >= 0) p = p.replace(H_XLM, MARK + H_XLM);
    // Desktop headline in two addressable lines. It already broke into two visually, but that was the
    // natural wrap -- there was no hook to size the second line on its own. Desktop only: the phone hero
    // is built from the carousel slide by applyMobileHero(), which reads this text and adds its own
    // .lx-hline2 span, and a nested span here would not survive that. Idempotent by construction.
    if (k === 'lumoscore-dex.html' || k === 'lumoscore-dex-dark.html') {
      const ONE = '<h2 class="lm-h">The most advanced <em>DEX</em> on Stellar.</h2>';
      const TWO = '<h2 class="lm-h"><span class="lx-h1">The most advanced</span>'
                + '<span class="lx-h2"><em>DEX</em> on Stellar.</span></h2>';
      if (p.indexOf(ONE) >= 0) p = p.replace(ONE, TWO);
    }
    // "New mints" card icon. The design ships Feather's activity pulse -- the single most reused glyph in
    // crypto UI, and it says "chart", not "newly created". A sprout does: stem plus two leaves, drawn on
    // the same 24-grid at the same stroke weight, so it sits with the other icons on the page rather than
    // announcing itself. Only the inner geometry is swapped; the <svg> wrapper and its sizing stay.
    // Idempotent: after one pass the polyline is gone and there is no match.
    const PULSE = '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>';
    const SPROUT = '<path d="M12 21v-8"/><path d="M12 13c0-3.3-2.7-6-6-6 0 3.3 2.7 6 6 6Z"/>'
                 + '<path d="M12 13c0-3.9 3.1-7 7-7 0 3.9-3.1 7-7 7Z"/>';
    if (p.indexOf(PULSE) >= 0) p = p.split(PULSE).join(SPROUT);
    // The crumb shipped as "Back · Home / DEX" -- three controls saying one thing, on a page whose own
    // heading already says DEX. Reduce it to the only part a reader wants, the way out, named for where
    // it actually goes. Done in the MARKUP so it is correct at first paint (rewriting the label at
    // runtime would flash "Back" and then jump). Two independent guards, so each half is idempotent on
    // its own. Mobile is untouched by construction: neither Trade-main mobile build has a .crumb at all,
    // and it should not gain one -- the footer bar already carries that navigation.
    if (/<div class="crumb">[\s\S]*?class="sep"/.test(p)) {
      p = p.replace(/(<div class="crumb">[\s\S]*?<\/a>)[\s\S]*?<\/div>/, '$1\n  </div>');
    }
    if (/<div class="crumb">[\s\S]*?\sBack\s*<\/a>/.test(p)) {
      p = p.replace(/(<div class="crumb">[\s\S]*?)(\s)Back(\s*<\/a>)/, '$1$2Back to dashboard$3');
    }
    const bi = p.lastIndexOf('</body>');
    p = p.slice(0, bi) + SCRIPT + HIW + p.slice(bi);
    json[k] = p; changed = true; n++;
  }
  if (changed) {
    containers++;
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
console.log('dex-main data (phase 3): injected=' + n + ' keys across ' + containers + ' containers');
