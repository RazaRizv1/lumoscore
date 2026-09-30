(function(){
  var W = document.querySelector("[data-lxbl]");
  var DOTS = document.querySelector("[data-lxbldots]");
  var SEC = document.querySelector(".lx-blogs");
  if (!W || !DOTS || !SEC) return;
  var N = 5, EVERY = 10000;

  function esc(s){ return String(s == null ? "" : s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }

  var MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function when(p){
    var t = p.publishedAt || p.publishAt || p.createdAt;
    if (!t) return "";
    var d = new Date(+t);
    if (isNaN(d.getTime())) return "";
    return MON[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear();
  }

  function slide(p, i){
    var bits = [];
    if (p.category) bits.push('<span class="lx-bl-cat">' + esc(p.category) + "</span>");
    var w = when(p);
    if (w) bits.push('<span class="lx-bl-dot">&middot;</span><span>' + esc(w) + "</span>");
    if (p.readMins) bits.push('<span class="lx-bl-dot">&middot;</span><span>' + esc(p.readMins) + " min</span>");

    // alt="" on purpose: the cover is decorative, the title right beside it is the label, and a
    // screen reader should not hear the headline twice. The first cover loads eagerly because it is
    // the one on screen; the rest are lazy.
    var cover = p.cover
      ? '<img class="lx-bl-cover" src="' + esc(p.cover) + '" alt=""'
        + (i === 0 ? '' : ' loading="lazy"') + ' decoding="async">'
      : '<div class="lx-bl-cover"></div>';

    // Excerpt is empty on some posts, so the element is omitted rather than left blank.
    var ex = (p.excerpt && String(p.excerpt).trim())
      ? '<p class="lx-bl-ex">' + esc(p.excerpt) + "</p>" : "";

    return '<a class="lx-bl-slide' + (i === 0 ? " is-on" : "") + '" href="/blog/' + esc(p.slug) + '"'
      + ' role="tabpanel" id="lx-bl-p' + i + '" aria-label="' + esc(p.title) + '">'
      + cover
      + '<div class="lx-bl-body">'
      + '<div class="lx-bl-meta">' + bits.join("") + "</div>"
      + '<h3 class="lx-bl-title">' + esc(p.title) + "</h3>"
      + ex
      + '<span class="lx-bl-go">Read post<span aria-hidden="true"> &rarr;</span></span>'
      + "</div></a>";
  }

  fetch("/lxapi/blog", { headers: { accept: "application/json" } })
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(d){
      var ps = (d && d.posts) || [];
      ps = ps.filter(function(p){ return p && p.slug && p.title && p.published !== false; });
      // Newest first. The endpoint's order is not contracted anywhere, so it is sorted here rather
      // than trusted -- publishedAt is the only field every post actually carries.
      ps.sort(function(a,b){ return (+b.publishedAt||+b.createdAt||0) - (+a.publishedAt||+a.createdAt||0); });
      ps = ps.slice(0, N);
      if (!ps.length) return;                       // nothing to show: the section stays hidden

      W.innerHTML = ps.map(slide).join("");
      DOTS.innerHTML = ps.map(function(p, i){
        // The label names the post rather than saying "slide 3", so it is useful read aloud.
        return '<button type="button" class="lx-bl-dotb" role="tab" data-i="' + i + '"'
          + ' aria-controls="lx-bl-p' + i + '"'
          + ' aria-selected="' + (i === 0 ? "true" : "false") + '"'
          + ' aria-label="' + esc(p.title) + '"><i></i></button>';
      }).join("");
      SEC.removeAttribute("hidden");

      // ONE dot is pointless and a single post is not a carousel.
      if (ps.length < 2) { DOTS.style.display = "none"; return; }

      var slides = [].slice.call(W.children);
      var dots = [].slice.call(DOTS.children);
      var at = 0, timer = null;

      function show(i){
        i = ((i % slides.length) + slides.length) % slides.length;
        if (i === at) return;
        slides[at].classList.remove("is-on");
        dots[at].setAttribute("aria-selected", "false");
        at = i;
        slides[at].classList.add("is-on");
        dots[at].setAttribute("aria-selected", "true");
      }

      var still = false;
      try { still = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

      function stop(){ if (timer) { clearInterval(timer); timer = null; } }
      function start(){
        // Not while the reader has asked for less motion, not while the tab is in the background
        // (otherwise it advances through every post unseen and they come back to the last one), and
        // not while a pointer is resting on it or focus is inside it.
        if (still || timer || document.hidden) return;
        timer = setInterval(function(){ show(at + 1); }, EVERY);
      }

      SEC.addEventListener("mouseenter", stop);
      SEC.addEventListener("mouseleave", start);
      SEC.addEventListener("focusin", stop);
      SEC.addEventListener("focusout", function(e){
        if (!SEC.contains(e.relatedTarget)) start();
      });
      document.addEventListener("visibilitychange", function(){
        if (document.hidden) stop(); else start();
      });

      DOTS.addEventListener("click", function(e){
        var b = e.target && e.target.closest ? e.target.closest(".lx-bl-dotb") : null;
        if (!b) return;
        show(+b.getAttribute("data-i") || 0);
        // A manual pick restarts the clock, so the post they just chose gets its full ten seconds
        // instead of whatever was left of the previous one.
        stop(); start();
      });

      // Left/right arrows move between dots, which is what a tablist is expected to do.
      DOTS.addEventListener("keydown", function(e){
        var d = e.key === "ArrowRight" ? 1 : (e.key === "ArrowLeft" ? -1 : 0);
        if (!d) return;
        e.preventDefault();
        show(at + d);
        dots[at].focus();
        stop(); start();
      });

      start();
    })
    .catch(function(){ /* endpoint down: leave the section hidden rather than show an empty shell */ });
})();