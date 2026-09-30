(function(){
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
})();