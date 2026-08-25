// Both heroes, monochrome.
//
// The orange art went. What replaces it is not "no background" -- a flat fill on the first thing a
// visitor sees reads as unfinished -- but a neutral one: a soft off-axis highlight over a diagonal
// ramp, so the card has a light source and a bit of depth without a hue. Dark mode goes near-black
// with white type; light mode goes near-white with near-black type. The two CTAs stay orange, which
// is now the only colour on the card and therefore the thing the eye lands on.
//
// This is one file for BOTH pages on purpose. The Trade hero's own styling lives in _dexdata.js and
// the Pools hero's in _poolshero.js; putting the shared look in a third place means the two cannot
// drift apart again, which is most of what the last few rounds were spent undoing.
//
// It injects after both, so equal-specificity rules land later and win. The one rule that has to be
// stronger is the card background: _dexdata.js declares it at (0,2,1) with !important and
// _poolshero.js at (0,3,1), so the background here is written to match the higher of the two.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const KEYS = [
  'lumoscore-dex.html', 'lumoscore-dex-dark.html', 'lumoscore-dex-mobile.html',
  'lumoscore-amm.html', 'lumoscore-amm-dark.html', 'lumoscore-amm-mobile.html',
];

const STYLE = `<style id="lx-heromono-css">
/* ---- the card ------------------------------------------------------------------------------- */
/* Two layers, no hue: a highlight set off-centre so the card is lit from somewhere, over a diagonal
   ramp from lighter top-left to darker bottom-right. Written at .lm-pools strength so it beats the
   per-page background rules on both pages. */
html .lumos-promo.lm-on,html .lumos-promo.lm-on.lm-pools,html .lumos-promo.lx-mobhero{
  background:radial-gradient(122% 148% at 74% 12%,rgba(255,255,255,.085),rgba(255,255,255,0) 58%),
             linear-gradient(158deg,#191920 0%,#111116 48%,#0a0a0e 100%)!important;
  border:1px solid rgba(255,255,255,.11)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06)!important}
html[data-theme="light"] .lumos-promo.lm-on,html[data-theme="light"] .lumos-promo.lm-on.lm-pools,html[data-theme="light"] .lumos-promo.lx-mobhero{
  background:radial-gradient(122% 148% at 74% 12%,#ffffff,rgba(255,255,255,0) 60%),
             linear-gradient(158deg,#fdfdfe 0%,#f4f4f6 48%,#eaeaee 100%)!important;
  border:1px solid rgba(16,16,22,.11)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.9)!important}
/* The dark wedge behind the headline existed to keep type legible over busy orange art. Over a plain
   ground it only dulls the card -- and in light mode it was the grey wash across the left half. */
.lumos-promo.lm-on .lm::after,.lumos-promo.lx-mobhero .lm::after{display:none!important}

/* ---- the horizontal rules: gone ---------------------------------------------------------------- */
/* The design ships a 1px rule every 44px on .lm::before. Tried at three strengths and it never earned
   its place on a card whose whole job is one headline and four numbers -- it read as banding across the
   type rather than as texture. Removed on the pseudo-element so both heroes lose it together; the rule
   itself is untouched everywhere else it is used. */
.lumos-promo.lm-on .lm::before,.lumos-promo.lx-mobhero .lm::before{display:none!important}

/* ---- type: the loudest thing on the card ----------------------------------------------------- */
.lumos-promo.lm-on .lm-h,.lumos-promo.lx-mobhero .lm-h{color:#fff!important}
/* the accent word was the one orange in the copy; it is white now and carries by weight instead.
   -webkit-text-fill-color too, because the Trade headline paints its accent as a clipped gradient
   and colour alone leaves it transparent. */
.lumos-promo.lm-on .lm-h em,.lumos-promo.lm-on .lm-h .grad,.lumos-promo.lm-on .lm-h .lumos-promo-hi,
.lumos-promo.lx-mobhero .lm-h em,.lumos-promo.lx-mobhero .lm-h .grad{
  color:#fff!important;background:none!important;-webkit-background-clip:border-box!important;-webkit-text-fill-color:#fff!important}
html[data-theme="light"] .lumos-promo.lm-on .lm-h,html[data-theme="light"] .lumos-promo.lx-mobhero .lm-h,
html[data-theme="light"] .lumos-promo.lm-on .lm-h em,html[data-theme="light"] .lumos-promo.lm-on .lm-h .grad,
html[data-theme="light"] .lumos-promo.lm-on .lm-h .lumos-promo-hi{
  color:#0d0d11!important;-webkit-text-fill-color:#0d0d11!important}

/* ---- the headline, ONE size for both heroes ---------------------------------------------------- */
/* #14: Pools drifted to 38px inside a 340px column (lx-amm-css) while Trade sat at 36px inside 420px,
   so the same sentence broke onto a different number of lines and the two tops of the app stopped
   looking like the same design. Trade's numbers are the ones both use now. This lives HERE, in the
   sheet that already runs last and already owns the shared hero look, because that is what stops the
   two drifting again: any per-page rule is at most two classes, and this is three plus !important. */
.lumos-promo.lm-on .lm-h,.lumos-promo.lx-mobhero .lm-h{
  font-size:36px!important;line-height:1.08!important;max-width:420px!important}
@media(max-width:880px){
.lumos-promo.lm-on .lm-h,.lumos-promo.lx-mobhero .lm-h{
  font-size:23px!important;line-height:1.14!important;max-width:100%!important}
}
@media(max-width:560px){
.lumos-promo.lm-on .lm-h,.lumos-promo.lx-mobhero .lm-h{
  font-size:18px!important;line-height:1.18!important;max-width:100%!important}
}

/* ---- the chain mark -------------------------------------------------------------------------- */
/* #2: the hairline ring here was written for a dark disc with a white glyph, which would have been
   lost against a dark card. The mark that actually ships is the blue Stellar disc -- it carries its
   own edge -- so the ring was not giving it one, it was drawing a white outline around it. Depth
   only; nothing traces the artwork. */
.lumos-promo.lm-on .lx-heroico,.lumos-promo.lx-mobhero .lx-heroico{
  box-shadow:0 10px 24px -12px rgba(0,0,0,.8)!important}
html[data-theme="light"] .lumos-promo.lm-on .lx-heroico,html[data-theme="light"] .lumos-promo.lx-mobhero .lx-heroico{
  box-shadow:0 10px 26px -14px rgba(16,16,22,.5)!important}
/* #8/#9: the mark is the first thing on the page and it was smaller than the headline beside it --
   and the two heroes were not even the same size as each other (56 on Trade, 64 on Pools). One size,
   large enough to lead, on both. */
.lumos-promo.lm-on .lx-heroico,.lumos-promo.lx-mobhero .lx-heroico,.lm-pools .lx-heroico{
  width:76px!important;height:76px!important}
@media(max-width:880px){
.lumos-promo.lm-on .lx-heroico,.lumos-promo.lx-mobhero .lx-heroico,.lm-pools .lx-heroico{
  width:52px!important;height:52px!important}
}
@media(max-width:560px){
.lumos-promo.lm-on .lx-heroico,.lumos-promo.lx-mobhero .lx-heroico,.lm-pools .lx-heroico{
  width:46px!important;height:46px!important}
}

/* ---- the stats strip -------------------------------------------------------------------------- */
.lumos-promo.lm-on .lx-dxstats,.lumos-promo.lx-mobhero .lx-dxstats,.lumos-promo.lm-on .lm-pools .lm-chip,.lm-pools.lm-on .lm-chip,.lumos-promo.lx-mobhero .lm-chip{
  background:linear-gradient(180deg,rgba(255,255,255,.018),rgba(255,255,255,.055))!important;
  border-top:1px solid rgba(255,255,255,.10)!important}
html[data-theme="light"] .lumos-promo.lm-on .lx-dxstats,html[data-theme="light"] .lumos-promo.lx-mobhero .lx-dxstats,html[data-theme="light"] .lm-pools.lm-on .lm-chip,html[data-theme="light"] .lumos-promo.lx-mobhero .lm-chip{
  background:linear-gradient(180deg,rgba(16,16,22,.018),rgba(16,16,22,.05))!important;
  border-top:1px solid rgba(16,16,22,.10)!important}
.lumos-promo.lm-on .lx-dxstat .v,.lumos-promo.lx-mobhero .lx-dxstat .v,.lm-pools .lx-hstat .v{color:#fff!important}
.lumos-promo.lm-on .lx-dxstat .l,.lumos-promo.lx-mobhero .lx-dxstat .l,.lm-pools .lx-hstat .l{color:rgba(255,255,255,.56)!important}
.lx-dxstat,.lm-pools .lx-hstat{border-left-color:rgba(255,255,255,.10)!important}
html[data-theme="light"] .lumos-promo.lm-on .lx-dxstat .v,html[data-theme="light"] .lumos-promo.lx-mobhero .lx-dxstat .v,html[data-theme="light"] .lm-pools .lx-hstat .v{color:#0d0d11!important}
html[data-theme="light"] .lumos-promo.lm-on .lx-dxstat .l,html[data-theme="light"] .lumos-promo.lx-mobhero .lx-dxstat .l,html[data-theme="light"] .lm-pools .lx-hstat .l{color:rgba(28,28,36,.60)!important}
html[data-theme="light"] .lx-dxstat,html[data-theme="light"] .lm-pools .lx-hstat{border-left-color:rgba(16,16,22,.10)!important}

/* ---- the pair marks in Top Pool / Top Pair ---------------------------------------------------- */
/* These two coins OVERLAP by 10px, and the ring is what keeps them reading as two coins.
   The design drew it in near-black, which read as an outline drawn around each coin. A 0.8px
   hairline fixed that and broke the other half: against a black XLM mark on a near-white card it is
   invisible, so the pair merged into one blob wherever they overlap -- the broken edge.
   The answer is the ring every overlapping-avatar stack uses: keep the design's 2px, but paint it in
   the card's OWN ground, so it reads as a gap between the coins rather than a line around them.
   The drop shadow goes with it -- on a light card it was just a grey smudge under each coin. */
.lm-pools .lx-hstat[data-k=top] .pair-icons .lx-ico,.lx-dxpair span{
  border:2px solid #17171d!important;box-shadow:none!important}
html[data-theme="light"] .lm-pools .lx-hstat[data-k=top] .pair-icons .lx-ico,html[data-theme="light"] .lx-dxpair span{
  border:2px solid #ebebee!important;box-shadow:none!important}
/* 2px of ring on a 16-17px phone mark is most of the coin; the design already steps this down. */
@media(max-width:560px){
.lm-pools .lx-hstat[data-k=top] .pair-icons .lx-ico,.lx-dxpair span,
html[data-theme="light"] .lm-pools .lx-hstat[data-k=top] .pair-icons .lx-ico,html[data-theme="light"] .lx-dxpair span{
  border-width:1.5px!important}
}

/* ---- the CTAs: the only colour left ------------------------------------------------------------ */
/* Unchanged on purpose. With the hue gone from everything else these are the one warm thing on the
   card, which is the point -- the eye goes to the action. */
.lx-dctas .dex-hero-btn.ghost,.lm-pools .lx-dctas .dex-hero-btn.ghost{color:rgba(255,255,255,.80)!important}
html[data-theme="light"] .lx-dctas .dex-hero-btn.ghost,html[data-theme="light"] .lm-pools .lx-dctas .dex-hero-btn.ghost{color:#2b2b33!important}
</style>`;

let containers = 0, pages = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = `lumoscore-aptos-${dev}.html`;
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;
  for (const k of KEYS) {
    if (!json[k]) continue;
    let p = json[k];
    // GLOBAL. Non-global removed one copy and re-added one, so any duplicates already present could
    // never clear -- and duplicates were present, because the type scale used to stamp an attribute onto
    // the <style> tag, which stopped this pattern matching at all for several builds.
    p = p.replace(/<style id="lx-heromono-css">[\s\S]*?<\/style>/g, '');
    // INTO <head>, not before </body>. The per-page hero CSS is declared in <head>, so a block that
    // only lands at the end of the document is parsed AFTER first paint -- which is the orange
    // flashing on Trade for an instant on every refresh. Last thing in <head> puts it ahead of paint
    // while still sitting after lx-dexmain-css, so equal-specificity ties still resolve this way.
    if (p.indexOf('</head>') < 0) continue;
    p = p.replace('</head>', STYLE + '</head>');
    if (p !== json[k]) { json[k] = p; changed = true; pages++; }
  }
  if (changed) {
    containers++;
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
console.log('mono hero applied to ' + pages + ' page keys across ' + containers + ' containers');
