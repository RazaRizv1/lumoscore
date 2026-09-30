// Products carousel: let a horizontal swipe drive it, not just scrolling down. Handset only.
//
// THE PROBLEM. The row of six cards is a scroll-driven scene: it advances as the page scrolls past
// the pinned section, whether that is the native CSS view() timeline or the scrub in
// _scrollfallback.js. On a phone that reads as a row of cards you obviously ought to be able to
// swipe -- and swiping did nothing, because the grid stopped being an overflow-x scroller the
// moment the carousel layout took over (_prodcards.js sets overflow-x:visible on it and hides the
// prev/next arrows).
//
// THE APPROACH: TRANSLATE THE SWIPE INTO PAGE SCROLL, rather than moving the row directly. The
// carousel's position is a pure function of how far the page has scrolled through the section, so
// the one thing that must change is the scroll position. Driving the transform directly would mean
// a third implementation of the same motion -- one for the native timeline, one for the fallback
// scrub, one for touch -- and the three would drift. Scrolling the window instead means the
// existing machinery does the work and the row lands exactly where a vertical scroll would have
// put it, on both engines.
//
// THE RATIO IS MEASURED, NOT PICKED. A full pass of the section is `offsetHeight - innerHeight` of
// vertical scroll, and over that pass the row travels `grid.scrollWidth - view.clientWidth`
// horizontally. The ratio between them is what makes a swipe move the cards by the distance your
// finger actually moved; a hardcoded constant would be right at one viewport and wrong at every
// other. It is recomputed on resize because both terms depend on the viewport.
//
// AXIS LOCK, and why it matters. The first pointer movement decides whether the gesture is a swipe
// or a normal vertical scroll, and the decision sticks for the rest of that touch. Without it a
// slightly diagonal scroll would be stolen and the page would feel like it was fighting back. The
// threshold (8px, and horizontal only if it beats vertical by 1.2x) is deliberately biased toward
// letting the page scroll: a missed swipe is a minor annoyance, a stolen scroll is not.
//
// preventDefault is only called once the gesture is locked to the horizontal axis, which is also
// why that listener cannot be passive. The touchstart/touchend ones stay passive.
//
// DESKTOP IS EXCLUDED. _prodbento.js lays the six cards out as a static 3x2 grid above 900px --
// every card is already visible there, so there is nothing to swipe through.
//
// Re-injects: strips its own script before writing.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// touch-action IS THE FIX, and the listener alone was never going to be enough. iOS decides which
// direction a gesture belongs to on the FIRST move and hands it to its own scroller; a
// preventDefault() that arrives after that -- which is any preventDefault behind an axis lock -- is
// ignored, so the swipe did nothing on either phone while vertical scrolling kept working.
// `touch-action: pan-y` tells the compositor up front: vertical is yours, horizontal is mine. The
// axis lock then runs without fighting a gesture the browser has already claimed.
const CSS = '<style id="lx-prodswipe-css">'
  + '@media (max-width:900px){'
  + '#products .lxpc-pin,#products .lxpc-view,#products .products-grid{touch-action:pan-y}'
  + '}'
  + '</st' + 'yle>';

const JS = '<script id="lx-prodswipe-js">' + `(function(){
  try {
    if (!("ontouchstart" in window)) return;             // pointer devices scroll, they do not swipe
    var MOBILE = window.matchMedia ? window.matchMedia("(max-width: 900px)") : null;

    var sec = document.getElementById("products");
    if (!sec) return;
    var pin = sec.querySelector(".lxpc-pin");
    var view = sec.querySelector(".lxpc-view");
    var grid = sec.querySelector(".products-grid");
    if (!pin || !view || !grid) return;

    var ratio = 1;
    function measure() {
      // Vertical distance the section is scrolled through, and horizontal distance the row covers
      // in that time. scrollWidth is the full row even though it does not scroll.
      var track = sec.offsetHeight - window.innerHeight;
      var travel = grid.scrollWidth - view.clientWidth;
      ratio = (track > 0 && travel > 0) ? (track / travel) : 1;
    }
    measure();
    window.addEventListener("resize", measure, { passive: true });

    var x0 = null, y0 = null, axis = null;
    var pending = 0, raf = 0;

    // scrollTop ASSIGNMENT, NOT window.scrollBy(). WebKit is unreliable about programmatic scrolling
    // while a touch sequence is in flight -- scrollBy() during touchmove is frequently dropped, which
    // presents exactly as "the swipe does nothing" while vertical scrolling still works, because the
    // vertical case never needs JS at all. Writing scrollingElement.scrollTop is a direct property
    // set and is honoured. documentElement is the fallback for older WebKit.
    function scroller() {
      return document.scrollingElement || document.documentElement;
    }
    function flush() {
      raf = 0;
      if (!pending) return;
      var el = scroller();
      el.scrollTop = el.scrollTop + pending;
      pending = 0;
    }

    // ON document, IN THE CAPTURE PHASE, rather than on the pin. The cards are links inside a
    // sticky container and anything between them and the pin could stop propagation before the
    // gesture ever arrives; capturing at the document means this sees the touch first and decides
    // for itself whether it is inside the section.
    function inPin(e) {
      var t = e.target;
      return !!(t && t.closest && t.closest("#products .lxpc-pin"));
    }

    document.addEventListener("touchstart", function (e) {
      if (!inPin(e)) { x0 = null; return; }
      if (e.touches.length !== 1) { x0 = null; return; }
      if (MOBILE && !MOBILE.matches) { x0 = null; return; }
      measure();
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      axis = null;
    }, { passive: true, capture: true });

    document.addEventListener("touchmove", function (e) {
      if (x0 === null || e.touches.length !== 1) return;
      var x = e.touches[0].clientX, y = e.touches[0].clientY;
      var dx = x - x0, dy = y - y0;

      if (axis === null) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;   // too small to call yet
        // Biased toward the page: horizontal only when it clearly beats vertical.
        axis = (Math.abs(dx) > Math.abs(dy) * 1.2) ? "x" : "y";
      }
      if (axis !== "x") return;                              // a vertical scroll, left alone

      e.preventDefault();
      // Swipe left (dx negative) advances the row, which is a scroll DOWN, hence the negation.
      // BATCHED TO ONE SCROLL PER FRAME. touchmove can fire several times between paints, and each
      // window.scrollBy is a synchronous scroll that re-runs every scroll listener on the page --
      // including the fallback scrub, which writes to nine animations. Doing that two or three times
      // per frame is what makes a drag feel like it is catching. Accumulating and flushing in a
      // rAF means at most one scroll per painted frame.
      pending += -dx * ratio;
      if (!raf) raf = requestAnimationFrame(flush);
      x0 = x; y0 = y;
    }, { passive: false, capture: true });

    // Any distance still waiting on a frame is applied here, so lifting a finger mid-frame does not
    // silently swallow the last few pixels of the gesture.
    function end() {
      x0 = null; y0 = null; axis = null;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      flush();
    }
    document.addEventListener("touchend", end, { passive: true, capture: true });
    document.addEventListener("touchcancel", end, { passive: true, capture: true });

    window.lxProdSwipe = { ratio: function () { return ratio; }, measure: measure };
  } catch (e) { /* a broken swipe must never take the page down with it */ }
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

  html = html.replace(/<script id="lx-prodswipe-js">[\s\S]*?<\/script>/g, '');
  html = html.replace(/<style id="lx-prodswipe-css">[\s\S]*?<\/style>/g, '');

  for (const hook of ['lxpc-pin', 'lxpc-view', 'products-grid']) {
    if (html.indexOf(hook) < 0) problems.push(p.key + ': no .' + hook + ' to swipe');
  }
  if (problems.length) continue;

  // SUPERSEDED BY _prodnative.js, and this transform now only REMOVES its own past output.
  //
  // The handset products row is a native overflow-x scroller again, so there is no gesture to
  // translate. Leaving this layer injected would actively break that: it sets
  // `touch-action: pan-y` on the grid, which tells the compositor it may pan vertically and NOT
  // horizontally -- the exact opposite of what a horizontal scroller needs. The scroller would stop
  // responding to swipes entirely.
  //
  // The file is kept rather than deleted because the three failures recorded in its header are the
  // reason the native scroller was chosen, and that reasoning should not be lost with it. CSS and
  // JS above are left in place so it can be revived if the approach is ever revisited.
  void CSS; void JS;

  json[p.key] = html;
  staged.push({ file: p.file, data, s, e, json, key: p.key });
}

if (problems.length) {
  console.error('prod-swipe: ABORT - nothing written.');
  problems.forEach(x => console.error('  ' + x));
  process.exit(1);
}
for (const st of staged) {
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.key + ': horizontal swipe drives the products carousel (handset only)');
}
console.log('prod-swipe: done on ' + staged.length + ' page(s)');
