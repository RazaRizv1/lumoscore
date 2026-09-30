// Scroll-driven scenes on browsers that have no scroll-driven animations (Safari below 26).
//
// WHAT IS BROKEN WITHOUT THIS. Two scenes on the landing page are built on CSS scroll timelines and
// are wrapped in `@supports (animation-timeline: ...)`, so on Safari 18 and earlier neither exists:
//
//   the hero      _herounify.js, `@supports (animation-timeline:scroll())` -- ring convergence,
//                 flame ignition, the caption fading to "One Core"
//   the products  _prodcards.js, `@supports (animation-timeline:view())`   -- the sticky pin, the
//                 six cards sliding sideways, and the progress rail under them
//
// Reported from an iPhone 12 Pro with an iPhone 13 Pro Max beside it showing both correctly.
//
// WHY IT SCRUBS RATHER THAN PLAYS. The first attempt gave the hero the same keyframes on a plain
// DURATION. That "works" in the sense that the scene resolves, and it is wrong: it played itself out
// on load, before the reader had scrolled at all, which is the opposite of a scene whose whole point
// is to answer the scroll. So the durations stay, but only as the SHAPE of the timeline -- every one
// of those animations is paused here and its currentTime is driven from the scroll position. Same
// choreography, same trigger as the native version.
//
// WHY WEB ANIMATIONS RATHER THAN MORE CSS. Setting `currentTime` on an Animation already accounts
// for that animation's own delay, so the hero's staggered fallback (ring at .35s, flame at 1.35s,
// "One Core" at 2.05s) keeps its stagger for free: one shared progress value, mapped onto each
// animation's own place in the timeline. Reproducing that in CSS would mean a separate scroll range
// per element and six chances to get one wrong.
//
// THE PIN NEEDS NO JS. `position:sticky` is not a scroll-driven animation and works on every browser
// here -- it was only unavailable because it sat inside the @supports block. The CSS below restores
// it, along with the track height the pin needs and the rail's `display:block`.
//
// DESKTOP PRODUCTS IS DELIBERATELY ABSENT. _prodbento.js unpins that section above 900px and lays
// the six cards out as a static 3x2 grid, so there is no carousel there to restore; re-adding the
// 230vh track would fight it. Only the handset carousel is rebuilt.
//
// IT CANNOT TOUCH BROWSERS THAT ALREADY WORK. The stylesheet is inside `@supports not (...)`, the
// exact complement of the upstream condition, and the script's first line returns when
// `CSS.supports('animation-timeline','scroll()')` is true. Both were confirmed against the built
// page in a Chromium that does support it: the block does not apply and the script exits.
//
// Reduce Motion is respected: the script returns, and the CSS is gated to no-preference. A reader
// who asked for less motion gets the still layout (see _herostill.js), not an animation.
//
// Re-injects: strips its own stylesheet and script before writing.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const CSS = '<style id="lx-scrollfb-css">'

  // ---- THE CAROUSEL'S LAYOUT, which is NOT gated on @supports at all ------------------------
  // _prodcards.js puts the carousel's grid in `@media (max-width:900px) and (min-height:700px)` --
  // no @supports involved. An iPhone 12 Pro's Safari viewport is ~656px, so it misses this block
  // entirely and keeps _landingproducts.js's overflow-x scroller instead. That costs three things at
  // once, and the third is the one that took a measurement to find:
  //   * .lxpc-view never gets overflow:hidden, so there is no window for the row to slide behind
  //   * the grid stays display:flex instead of the column grid the slide is written against
  //   * --g is never defined -- and the mobile keyframe is
  //     `translateX(calc(-368% - 5 * var(--g)))`, so with --g missing the calc() is invalid, the
  //     whole transform is dropped at computed-value time, and the row does not move by a pixel
  //     even though the animation is running. Measured: animationName lxpc-slide-m, playState
  //     paused, currentTime 1000, transform matrix(1,0,0,1,0,0).
  //
  // Copied verbatim from upstream at a 600px floor rather than 700. Identical values, so on phones
  // that already matched the 700px rule this is a duplicate that changes nothing.
  + '@media (max-width:900px) and (min-height:600px){'
  + '#products .lxpc-view{overflow:hidden;padding:24px 0;margin:-24px 0}'
  + '.block#products .lxpc-view .products-grid{--g:14px;display:grid;grid-template-columns:none;'
  + 'grid-auto-flow:column;grid-auto-columns:78%;gap:var(--g);width:100%;'
  + 'overflow-x:visible;overflow-y:visible;margin:0;padding:0;'
  + 'scroll-snap-type:none;will-change:transform}'
  + '.block#products .lxpc-view .products-grid>*{scroll-snap-align:none}'
  // The prev/next arrows belong to _landingproducts.js's overflow-x scroller, which the carousel
  // replaces -- upstream hides them alongside its own carousel block, so they follow it here too.
  // They are not merely redundant: they drive scrollBy() on a grid that no longer scrolls, so
  // leaving them visible ships two buttons that do nothing. RAZA had them on an iPhone 12 Pro and
  // not on a 13 Pro Max, which is the 700px height gate again.
  + '#products .lx-prail{display:none}'
  + '}'

  // ---- AND THE ANIMATION FOR SUPPORTING BROWSERS IN THE SAME BAND ---------------------------
  // Restoring the layout at 600px without this would have opened a new hole rather than closing
  // one: between 600 and 700px of viewport height, a browser that DOES have scroll timelines gets
  // the carousel layout from the block above, but upstream's animation block still requires 700px
  // and the @supports-not block below does not apply to it. That is a frozen row with its arrows
  // hidden -- six cards and no way to reach four of them. Upstream's own rules, verbatim, for
  // exactly that band.
  + '@supports (animation-timeline:view()){'
  + '@media (prefers-reduced-motion:no-preference) and (max-width:900px) and (min-height:600px) '
  + 'and (max-height:699px){'
  + '#products{height:300vh;padding:0;view-timeline-name:--lxpcT;view-timeline-axis:block}'
  + '#products .lxpc-pin{position:sticky;top:0;height:100vh;height:100dvh;display:flex;'
  + 'flex-direction:column;justify-content:center;overflow:hidden}'
  + '.block#products .lxpc-view .products-grid{animation:lxpc-slide-m linear both;'
  + 'animation-timeline:--lxpcT;animation-range:contain 0% contain 100%}'
  + '#products .lxpc-bar{display:block}'
  + '#products .lxpc-bar>i{animation:lxpc-fill linear both;animation-timeline:--lxpcT;'
  + 'animation-range:contain 0% contain 100%}'
  + '}'
  + '}'

  + '@supports not (animation-timeline:view()){'
  // min-height:600px, NOT the 700px _prodcards.js uses -- and that 100px is the whole reason an
  // iPhone 12 Pro showed the plain arrow scroller instead of the carousel. The device is 844 CSS px
  // tall, but the media query sees Safari's VIEWPORT, which after the address bar and toolbar is
  // about 656px. 656 < 700, so neither the upstream block nor the first version of this one ever
  // matched, and the section fell through to _landingproducts.js's overflow-x scroller with its
  // prev/next buttons. An iPhone 13 Pro Max clears it at ~738px, which is why that phone was fine.
  //
  // 700 was chosen upstream because "below that the pinned row does not fit", measured at 360x640.
  // 640 is still excluded here; 656 is not, and the pin sizes itself with 100dvh and centres its
  // content, so the ~345px card has room. If it turns out to be tight on a short phone the number to
  // move is this one.
  + '@media (prefers-reduced-motion:no-preference) and (max-width:900px) and (min-height:600px){'
  + '#products{height:300vh;padding:0}'
  + '#products .lxpc-pin{position:sticky;top:0;height:100vh;height:100dvh;display:flex;'
  + 'align-items:center}'
  + '#products .lxpc-bar{display:block}'
  // 1s is an arbitrary unit here: the script overwrites currentTime every scroll event, so the
  // number only has to be non-zero and shared. `both` holds the end frame if the script never runs.
  + '#products .lxpc-bar>i{animation:lxpc-fill 1s linear both}'
  + '.block#products .lxpc-view .products-grid{animation:lxpc-slide-m 1s linear both}'
  + '}'
  + '}'
  + '</st' + 'yle>';

const JS = '<script id="lx-scrollfb-js">' + `(function(){
  try {
    // Native scroll timelines: nothing to do.
    if (window.CSS && CSS.supports && CSS.supports("animation-timeline", "scroll()")) return;
    // Asked for less motion: the still layout is the right answer, not a scrub.
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var GROUPS = [
      { sec: "section.hero.lxu-hero",
        sel: ".lxu-cue,.lxu-ring,.lxu-orbits,.lxu-core,.lxu-halo,.lxu-flame,.lxu-onecore,.lxu-onesub" },
      { sec: "#products",
        sel: "#products .products-grid,#products .lxpc-bar>i" }
    ];

    var live = [];

    function collect() {
      live = [];
      for (var i = 0; i < GROUPS.length; i++) {
        var g = GROUPS[i];
        var sec = document.querySelector(g.sec);
        if (!sec) continue;
        var anims = [], total = 0;
        var els = document.querySelectorAll(g.sel);
        for (var j = 0; j < els.length; j++) {
          if (!els[j].getAnimations) continue;
          var as = els[j].getAnimations();
          for (var k = 0; k < as.length; k++) {
            var a = as[k];
            // Only the finite fallback animations. The decorative infinite ones (orbit spin, pulse)
            // are not part of the scene and must keep running on their own.
            var t;
            try { t = a.effect.getComputedTiming(); } catch (e) { continue; }
            if (!isFinite(t.activeDuration) || t.activeDuration <= 0) continue;
            try { a.pause(); } catch (e) { continue; }
            anims.push(a);
            var end = (t.delay || 0) + t.activeDuration;
            if (end > total) total = end;
          }
        }
        if (anims.length && total > 0) live.push({ sec: sec, anims: anims, total: total });
      }
      return live.length;
    }

    function tick() {
      for (var i = 0; i < live.length; i++) {
        var g = live[i];
        var r = g.sec.getBoundingClientRect();
        // The section is its own track: it is taller than the viewport by exactly the distance the
        // scene is meant to play over, which is what the native view()/scroll() ranges describe too.
        var track = g.sec.offsetHeight - window.innerHeight;
        var p = track > 0 ? (-r.top / track) : (r.top <= 0 ? 1 : 0);
        if (p < 0) p = 0; else if (p > 1) p = 1;
        var at = p * g.total;
        for (var j = 0; j < g.anims.length; j++) {
          try { g.anims[j].currentTime = at; } catch (e) {}
        }
      }
    }

    function start() {
      if (!collect()) return false;
      tick();
      return true;
    }

    // The animations do not all exist at DOMContentLoaded -- some elements are written by other
    // layers -- so collection is retried for a few seconds. It keeps retrying even after a
    // successful collect: stopping at the first success meant that finding ONE group (products,
    // which is ready early) ended the search before the hero's animations existed, and the hero was
    // then never driven at all. Re-collecting is idempotent, so running it to the end costs nothing.
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      collect();
      tick();
      if (tries > 16) clearInterval(iv);
    }, 250);
    start();

    // ONE UPDATE PER PAINTED FRAME. scroll fires far more often than the screen repaints, and each
    // tick() writes currentTime to nine animations and reads two bounding boxes -- doing that three
    // or four times between paints is work thrown away, and on a phone it is what makes the scene
    // feel like it is catching rather than gliding. Coalescing into a rAF means the scene is
    // computed exactly as often as it can actually be shown.
    var pendingFrame = 0;
    function onScroll() {
      if (pendingFrame) return;
      pendingFrame = requestAnimationFrame(function () { pendingFrame = 0; tick(); });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () { collect(); tick(); }, { passive: true });
    window.lxScrollFallback = { collect: collect, tick: tick, groups: function () { return live; } };
  } catch (e) { /* leave the CSS durations to play rather than break the page */ }
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

  html = html.replace(/<style id="lx-scrollfb-css">[\s\S]*?<\/style>/g, '');
  html = html.replace(/<script id="lx-scrollfb-js">[\s\S]*?<\/script>/g, '');

  // Both scenes must actually be on the page, or this is a stylesheet and a listener for nothing.
  for (const hook of ['lxu-ring', 'lxpc-bar', 'products-grid']) {
    if (html.indexOf(hook) < 0) problems.push(p.key + ': no .' + hook);
  }
  if (problems.length) continue;

  const bo = html.lastIndexOf('</body>');
  html = bo >= 0 ? html.slice(0, bo) + CSS + JS + html.slice(bo) : html + CSS + JS;

  json[p.key] = html;
  staged.push({ file: p.file, data, s, e, json, key: p.key });
}

if (problems.length) {
  console.error('scroll-fallback: ABORT - nothing written.');
  problems.forEach(x => console.error('  ' + x));
  process.exit(1);
}
for (const st of staged) {
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.key + ': hero + products scenes scrub from scroll where timelines are missing');
}
console.log('scroll-fallback: done on ' + staged.length + ' page(s)');
