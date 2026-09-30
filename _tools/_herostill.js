// Mobile hero: give the LAYOUT back to readers who have Reduce Motion switched on.
//
// THE BUG. _herounify.js puts the whole handset hero -- not just its animation, its LAYOUT -- inside
// `@media (prefers-reduced-motion:no-preference) and (max-width:899px)`. Switch Reduce Motion on in
// iOS Accessibility and every one of these goes away with the motion:
//
//     .lxu-grid{display:flex;flex-direction:column}   the stack itself
//     .lxu-copy{display:contents} + order:1..4        the reading order
//     .lxu-h1{font-size:min(7.05vw,30px);white-space:nowrap}
//     .lxu-ctas{flex-wrap:nowrap} + .lxu-ctas>*{flex:1 1 0}
//     .lxu-btn{height:46px;font-size:14.5px}
//     .lxu-viz{padding-top:104px}
//
// What is left is the desktop-ish fallback, and it does not fit a phone. Measured at 390x844 (an
// iPhone 12 Pro) by disabling those blocks in the live CSSOM, against the same page with them on:
//
//     h1 font-size   27.5px -> 36px
//     h1 white-space nowrap -> normal, so the headline wraps to TWO lines
//     CTA flex-wrap  nowrap -> wrap, and each button goes 176px -> 346px, i.e. stacked full width
//     grid direction column -> row
//
// Which is exactly what RAZA photographed: a two-line headline, two full-width stacked buttons, and
// the ring shoved off the bottom of the screen. An iPhone 13 Pro Max beside it was correct, because
// that phone does not have the setting on. Nothing to do with screen size, and nothing to do with
// Safari's version -- the first theory here was that Safari below 26 lacks scroll-driven animations,
// and that is true but it is not what this is.
//
// THE PRINCIPLE. `prefers-reduced-motion` is a request for less MOTION. It is not a request for a
// different layout, and it is never a reason to serve a broken one. Only the animation declarations
// belong behind that gate.
//
// THE FIX, and why it is shaped like this. _herounify.js is finalized and this file only ADDS
// (GUARDRAILS A), so rather than unpick that block the layout half of it is re-declared here
// UNGATED at the same breakpoints. The values are copied verbatim, so when motion IS allowed these
// rules are a duplicate that changes nothing; when it is not, they are the only ones that apply.
//
// DELIBERATELY NOT COPIED, because these are the scroll machinery rather than the layout:
//   section.hero{height:210vh}         the scroll track the timeline runs over
//   .lxu-stage{position:sticky;height:100dvh;min-height:0}   the pin
//   every animation / animation-timeline declaration
// With Reduce Motion on there is no timeline, so the hero is simply its own height and the stage is
// in normal flow -- which is the correct still version of the same scene.
//
// Ordering: this lands after lx-herounify-css (both stylesheets are hoisted into <head> by
// _externalize.js in the order the transforms ran), so at equal specificity these win over the
// ungated `.lxu-h1{font-size:clamp(36px,8.4vw,52px)}` fallback that was producing the two-line
// headline.
//
// Re-injects: strips its own stylesheet before writing.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const CSS = '<style id="lx-herostill">'

  + '@media (max-width:899px){'
  // The stage keeps its spacing but NOT its pin -- see the note above.
  + '.lxu-stage{padding:82px 0 18px;justify-content:center}'
  // The stack, and the order the four blocks read in.
  + '.lxu-grid{display:flex;flex-direction:column;align-items:center;gap:0;padding:0 14px}'
  + '.lxu-copy{display:contents}'
  + '.lxu-h1{order:1}.lxu-sub{order:2}.lxu-viz{order:3}.lxu-ctas{order:4}'
  // The one-line headline. `white-space:nowrap` is what holds "Many networks. One Core." on a single
  // line, and min(7.05vw,30px) is what makes that possible at 390px wide.
  + '.lxu-h1{font-size:min(7.05vw,30px);white-space:nowrap;margin:0 0 10px;text-align:center}'
  + '.lxu-h1 i{display:inline}'
  + '.lxu-h1 i+i{margin-left:.26em}'
  + '.lxu-sub{font-size:13.5px;line-height:1.5;max-width:none;width:100%;margin:0 0 2px;'
  + 'text-align:center;text-wrap:balance}'
  // Side by side, sharing the width evenly, instead of two full-width blocks.
  + '.lxu-ctas{margin:0;gap:10px;width:100%;flex-wrap:nowrap;justify-content:center}'
  + '.lxu-ctas>*{flex:1 1 0;min-width:0}'
  + '.lxu-btn{height:46px;font-size:14.5px;padding:0 10px;white-space:nowrap}'
  + '.lxu-viz{box-sizing:content-box;padding-top:104px}'

  // THE RING'S PHONE SIZE, AND THE CAPTION'S PHONE POSITION. Both were left behind when the rest of
  // this layout was lifted out of the motion gate, and they are the other half of the same bug
  // (RAZA 2026-09-29: "The word fragmented networks on the hero section of landing page is being
  // overlapped by Launch App & Explore Products").
  //
  // On the desktop the caption hangs below the ring's centre -- `top:calc(50% + var(--d)*.74)` -- and
  // the phone block moves it to the top of the picture instead, because on a phone the space under
  // the ring belongs to the buttons. That move lived inside
  // `@media (prefers-reduced-motion:no-preference)`, so a phone with Reduce Motion on, or an iPhone
  // whose Safari predates scroll-driven animations (where _heroend.js's @supports-not fallback turns
  // the caption on), kept the DESKTOP offset and printed "Fragmented networks" straight through the
  // button row. Measured on the built page with those blocks disabled: the caption sat at y=533 over
  // buttons spanning 527-573, overlapping both by 82px and 81px across. With these two rules it sits
  // at y=189, clear of the buttons and 67px above the logo cloud.
  //
  // --d comes with it because it is the same omission: without it the phone falls back to the
  // desktop `min(64vw,300px)`, which is the diameter the caption offset is measured against. Fixing
  // one without the other would only move the collision.
  //
  // Written at .lxu-hero specificity so neither depends on which stylesheet is emitted last; on a
  // phone that is already applying the motion-gated block these set the values it already had, so
  // the normal path is unchanged -- verified by measuring the hero before and after adding them.
  + '.lxu-hero .lxu-viz{--d:max(160px,min(calc(70vw - 20px),340px,calc(72vh - 250px)));'
  + 'width:calc(var(--d)*1.42);height:calc(var(--d)*1.38)}'
  + '.lxu-hero .lxu-cue{top:6px;bottom:auto}'
  + '}'

  // The short-screen variant is gated the same way upstream and loses the same way.
  + '@media (max-width:899px) and (max-height:680px){'
  + '.lxu-stage{padding:74px 0 16px}'
  + '.lxu-h1{font-size:clamp(25px,6.6vw,34px)}'
  + '.lxu-sub{font-size:13.5px;margin-bottom:12px}'
  + '}'

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

  html = html.replace(/<style id="lx-herostill">[\s\S]*?<\/style>/g, '');

  // Every selector here targets the unified hero. If that markup is gone the stylesheet is dead
  // weight and the layout it is protecting no longer exists either.
  for (const hook of ['lxu-grid', 'lxu-h1', 'lxu-ctas', 'lxu-viz']) {
    if (html.indexOf(hook) < 0) problems.push(p.key + ': no .' + hook + ' to lay out');
  }
  if (problems.length) continue;

  const bo = html.lastIndexOf('</body>');
  html = bo >= 0 ? html.slice(0, bo) + CSS + html.slice(bo) : html + CSS;

  json[p.key] = html;
  staged.push({ file: p.file, data, s, e, json, key: p.key });
}

if (problems.length) {
  console.error('hero-still: ABORT - nothing written.');
  problems.forEach(x => console.error('  ' + x));
  process.exit(1);
}
for (const st of staged) {
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.key + ': mobile hero layout no longer depends on prefers-reduced-motion');
}
console.log('hero-still: done on ' + staged.length + ' page(s)');
