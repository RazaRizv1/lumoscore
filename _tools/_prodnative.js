// Products on a phone: the platform's own horizontal scroller, not a scroll-driven carousel.
//
// WHY THIS REPLACES THE CAROUSEL ON HANDSETS. The pinned version turns a horizontal row into a
// VERTICAL scroll: the cards advance because the page scrolls past a 300vh section. That is a fine
// desktop effect and it is the wrong contract on a touch screen, where a row of cards asks to be
// swiped. Bridging the two needs JS that converts a horizontal drag into a page scroll, and that
// bridge failed three times in a row on real hardware:
//
//   1. the listener alone did nothing -- iOS claims the gesture on the first move, so a
//      preventDefault() behind an axis lock always arrives too late (fixed with touch-action:pan-y)
//   2. window.scrollBy() during an active touch is unreliable in WebKit and was being dropped
//   3. with a direct scrollTop assignment it finally moved, and the mapping was off by ~15x --
//      20-30 swipes to advance a single card
//
// Each of those was a guess, because none of it is testable here: the browser pane refuses to
// scroll the mobile page at all (setting documentElement.scrollTop to 300 reads back 0), so the
// gesture path cannot be exercised. Shipping a fourth guess at the ratio would be the same mistake
// again.
//
// A native overflow-x scroller has none of those problems. The browser owns the gesture, so it
// comes with momentum, rubber-banding, the right velocity curve and snap points for free, and there
// is no ratio to get wrong -- one card per flick, because the snap points say so. It also restores
// the prev/next buttons, which _landingproducts.js already wires to scrollBy on that element.
//
// MOST OF THIS ALREADY EXISTS. _landingproducts.js defines exactly this scroller at max-width:900px
// (display:flex, overflow-x:auto, scroll-snap-type:x mandatory, cards at flex:0 0 82% with
// scroll-snap-align:center). It was only ever being overridden by the carousel layout. So this file
// mostly UNDOES those overrides rather than inventing anything, and the one thing it adds is the
// progress rail, driven from scrollLeft instead of a timeline.
//
// DESKTOP IS UNTOUCHED: _prodbento.js's static 3x2 grid above 900px is unaffected, and so is the
// desktop pin. Only the handset changes.
//
// Re-injects: strips its own stylesheet and script before writing.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// Written to beat `.block#products .lxpc-view .products-grid` (1,3,0) from _prodcards.js and the
// restored copy in _scrollfallback.js, without relying on which stylesheet lands last.
const G = 'body .block#products .lxpc-view .products-grid';

const CSS = '<style id="lx-prodnative-css">'
  + '@media (max-width:900px){'

  // ---- undo the pin and its scroll track -----------------------------------------------------
  // The section goes back to its own height, so the page scrolls past it normally.
  + 'body .block#products{height:auto;min-height:0;padding:34px 0 30px;view-timeline-name:none}'
  + 'body .block#products .lxpc-pin{position:static;height:auto;min-height:0;display:block}'
  // The carousel clipped the row to slide it behind a window; a scroller needs to show its overflow.
  + 'body .block#products .lxpc-view{overflow:visible;padding:0;margin:0}'

  // ---- the native scroller ------------------------------------------------------------------
  // Same values _landingproducts.js already uses; restated because the carousel layout overrode
  // them. animation:none is what stops the slide keyframes fighting the scroll position.
  + G + '{display:flex;flex-direction:row;flex-wrap:nowrap;'
  + 'grid-template-columns:none;grid-auto-flow:row;gap:14px;'
  + 'overflow-x:auto;overflow-y:visible;scroll-snap-type:x mandatory;scroll-padding:0 20px;'
  + 'padding:4px 20px 14px;margin:0 -20px;-webkit-overflow-scrolling:touch;scrollbar-width:none;'
  + 'animation:none;transform:none;touch-action:pan-x pan-y;will-change:scroll-position}'
  + G + '::-webkit-scrollbar{display:none}'
  + G + '>.product-card{flex:0 0 82%;scroll-snap-align:center;min-width:0}'

  // ---- the rail ------------------------------------------------------------------------------
  // Shown, and driven from scrollLeft by the script below rather than by a timeline.
  + 'body .block#products .lxpc-bar{display:block;margin:14px auto 0}'
  // THE RAIL IS REVEALED, NOT SCALED -- and that is the difference between a progress bar and the
  // shimmer RAZA filmed. The <i> carries a five-stop gradient
  // (#8b7bff -> #34d37a 26% -> #a855f7 52% -> #ffb547 74% -> #ea6a2c) at width:100%, and
  // _prodcards.js reveals it with transform:scaleX(p). Scaling does not fill a bar: it SQUASHES the
  // whole spectrum into p x width, so at 20% scrolled the entire rainbow is crushed into a fifth of
  // the track and every colour slides and compresses as you move. On a 3px bar carrying a glow that
  // reads as flicker.
  //
  // clip-path:inset() uncovers the gradient instead, so each colour stays where it was painted and
  // the bar genuinely fills left to right.
  //
  // AND NO TRANSITION. The first version had transition:transform .12s, which is the other half of
  // the glitch: the value is rewritten every animation frame, so each new value restarted a 120ms
  // interpolation and the bar was permanently chasing a target it never reached. With iOS momentum
  // delivering scroll events in bursts, it visibly jerks. Driven per frame from scrollLeft it needs
  // no easing -- the scroll position IS the easing.
  //
  // Scoped to handsets, so the desktop scroll-timeline version keeps its existing behaviour.
  + 'body .block#products .lxpc-bar>i{animation:none;transform:none;'
  + 'clip-path:inset(0 100% 0 0);will-change:clip-path}'
  // The arrows work again, because there is once more something for scrollBy to scroll.
  + 'body .block#products .lx-prail{display:flex}'

  // ---- the vertical rhythm ---------------------------------------------------------------------
  // RAZA 2026-09-29: "Theres a lot of blank space below & above the product section". Measured on the
  // built page at 375px, the section was 739px tall and 179px of that was gaps: 54 above the heading,
  // 31 between the heading block and the cards, 14 to the rail, 16 to the arrows and 58 below them.
  // Those figures were inherited from the pinned desktop scene, where the section owns three
  // viewports and the space reads as composition; on a phone where it owns nine tenths of ONE, the
  // same numbers are just a section that will not start and will not end.
  //
  // Each is cut to roughly what the type needs to separate it from what is above. Nothing here moves
  // an element or changes what is shown -- the arrows in particular stay (RAZA, explicitly: "we're
  // keeping it. Don't make it disappear").
  + 'body .block#products .center-head>*:last-child{margin-bottom:18px}'
  + 'body .block#products .lxpc-bar{margin:12px auto 0}'
  + 'body .block#products .lx-prail{margin-top:12px}'

  // AND THE HOLE INSIDE EACH CARD. Every card is as tall as the tallest of the six, and the contents
  // were centred in that height -- so a card with shorter copy opened a gap in its MIDDLE, between
  // the paragraph and the link, which is the emptiness RAZA has objected to twice ("the boxes are so
  // empty"). Measured: a 369px card holding 321px of content and padding, with the 48px difference
  // sitting right above "Explore markets".
  //
  // The contents now start at the top and the link is pushed to the bottom with margin-top:auto, so
  // the slack lands in one place instead of the middle, and every card's link sits on the same line
  // as you swipe across them. The padding and the paragraph's margin come down with it, which
  // shortens the tallest card and therefore all six.
  + 'body .block#products .products-grid>.product-card{padding:22px 22px 24px;justify-content:flex-start}'
  + 'body .block#products .products-grid>.product-card p{margin-bottom:18px}'
  + 'body .block#products .products-grid>.product-card .lx-pc-cta{margin-top:auto}'
  + '}'
  + '</st' + 'yle>';

const JS = '<script id="lx-prodnative-js">' + `(function(){
  try {
    var mq = window.matchMedia ? window.matchMedia("(max-width: 900px)") : null;
    var sec = document.getElementById("products");
    if (!sec) return;
    var grid = sec.querySelector(".products-grid");
    var fill = sec.querySelector(".lxpc-bar > i");
    if (!grid || !fill) return;

    var raf = 0;
    function paint() {
      raf = 0;
      var max = grid.scrollWidth - grid.clientWidth;
      var p = max > 0 ? (grid.scrollLeft / max) : 0;
      if (p < 0) p = 0; else if (p > 1) p = 1;
      // Uncover from the left: 0 progress hides all of it, 1 reveals the whole gradient.
      fill.style.clipPath = "inset(0 " + ((1 - p) * 100).toFixed(3) + "% 0 0)";
    }
    function onScroll() {
      // One write per painted frame; scroll fires far more often than the screen refreshes.
      if (!raf) raf = requestAnimationFrame(paint);
    }

    grid.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    if (mq && mq.addEventListener) mq.addEventListener("change", onScroll);
    paint();

    // Exposed so the rail can be driven and checked without waiting on a frame -- the preview pane
    // parks requestAnimationFrame, so a scroll there updates scrollLeft and never repaints the bar.
    window.lxProdRail = { paint: paint, progress: function () {
      var max = grid.scrollWidth - grid.clientWidth;
      return max > 0 ? grid.scrollLeft / max : 0;
    } };
  } catch (e) {}
})();` + '<' + '/script>';

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

  html = html.replace(/<style id="lx-prodnative-css">[\s\S]*?<\/style>/g, '');
  html = html.replace(/<script id="lx-prodnative-js">[\s\S]*?<\/script>/g, '');

  for (const hook of ['products-grid', 'lxpc-bar', 'lxpc-view']) {
    if (html.indexOf(hook) < 0) problems.push(p.key + ': no .' + hook);
  }
  if (problems.length) continue;

  const bo = html.lastIndexOf('</body>');
  html = bo >= 0 ? html.slice(0, bo) + CSS + JS + html.slice(bo) : html + CSS + JS;

  json[p.key] = html;
  staged.push({ file: p.file, data, s, e, json, key: p.key });
}

if (problems.length) {
  console.error('prod-native: ABORT - nothing written.');
  problems.forEach(x => console.error('  ' + x));
  process.exit(1);
}
for (const st of staged) {
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.key + ': handset products -> native horizontal scroller with snap');
}
console.log('prod-native: done on ' + staged.length + ' page(s)');
