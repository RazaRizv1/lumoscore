// Landing page: a "From the blog" preview above the FAQ -- one post at a time, five dots, rotating.
//
// THE POSTS ARE REAL. /lxapi/blog serves published posts out of KV, each with a cover, a category
// and a read time, and /blog/:slug already renders them. (Note for anyone reading _dashblogs.js:
// its header still says "there is no blog to read yet" and ships placeholder rows with a "Coming
// soon" tag. That was true when it was written and is not any more -- worth revisiting separately,
// but not silently changed here.)
//
// FETCHED, NOT BAKED. The posts live in KV and change without a rebuild, so baking titles into the
// container would mean the landing page quietly going stale the first time anything is published.
// Same approach _blogdata.js takes for /blog itself.
//
// THE SECTION STARTS HIDDEN AND REVEALS ITSELF ONLY ONCE IT HAS POSTS. An empty card frame waiting
// on a fetch is a worse first frame than no section, and a skeleton that never fills -- because the
// endpoint is down, or returns nothing -- is worse than both.
//
// ALL FIVE SLIDES ARE RENDERED AND STACKED IN ONE GRID CELL (grid-area:1/1) rather than swapping
// the content of a single node. Two reasons, both about not introducing a flash into the section
// that was just fixed for one: the deck's height is the tallest slide's, so switching cannot resize
// it and shove the FAQ down the page; and every cover is in the DOM from the start, so an advance
// never shows an empty image frame while a JPEG loads.
//
// FIELD SHAPES ARE READ OFF THE LIVE ENDPOINT, not assumed:
//   cover       "/lxapi/media?id=<hash>.png"   -- already root-relative
//   publishAt   null on every current post     -- so the date comes from publishedAt (epoch ms)
//   excerpt     "" on at least one post        -- so the line is omitted rather than left blank
//   readMins    number
// Anything missing is dropped from the slide rather than printed as "undefined".
//
// EVERY FIELD IS ESCAPED. These strings come from the admin editor via KV; that is a trusted author
// today, but a title is still untrusted input as far as this page is concerned, and one unescaped
// quote in a title would be enough to break out of the attribute it sits in.
//
// Idempotent: strips its own section, stylesheet and script before inserting.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const HEAD = 'From the blog';
const SUB = 'How the product works, and what changed lately.';
const N = 5;          // slides, and therefore dots
const EVERY = 10000;  // ms between advances

const SECTION = '<section class="lx-blogs" id="blog" aria-labelledby="lx-bl-h" hidden>'
  + '<div class="container">'
  + '<div class="lx-sec-head lx-blhead">'
  + '<h2 id="lx-bl-h">' + HEAD + '</h2><p>' + SUB + '</p>'
  + '</div>'
  // aria-roledescription rather than a live region: this rotates on its own, and a live region
  // would make a screen reader announce a new headline every ten seconds while the reader is
  // somewhere else entirely on the page.
  + '<div class="lx-bl-deck" data-lxbl aria-roledescription="carousel" aria-label="Recent posts"></div>'
  + '<div class="lx-bl-foot">'
  + '<div class="lx-bl-dots" data-lxbldots role="tablist" aria-label="Choose a post"></div>'
  + '<a class="lx-bl-all" href="/blog">Read all posts<span aria-hidden="true"> &rarr;</span></a>'
  + '</div>'
  + '</div></section>';

const CSS = '<style id="lx-blogs-css">'
  + '.lx-blogs{padding:88px 0 96px}'
  + '.lx-blogs .lx-sec-head{margin-bottom:34px;text-align:left;margin-inline:0;max-width:none}'
  + '.lx-blogs .lx-sec-head h2{text-align:left;font-size:clamp(28px,2.6vw,42px);line-height:1.12;'
  + 'letter-spacing:-.022em;font-weight:800;margin:0 0 14px;text-wrap:balance}'
  + '.lx-blogs .lx-sec-head p{text-align:left;margin-inline:0;max-width:58ch;'
  + 'font-size:clamp(15px,1.15vw,17.5px);line-height:1.6;color:var(--text-muted)}'

  // ---- the deck -------------------------------------------------------------------------------
  // One grid cell, every slide in it. Height is the tallest slide, so an advance never resizes it.
  + '.lx-bl-deck{display:grid;border:1px solid var(--border);border-radius:18px;'
  + 'overflow:hidden;background:var(--surface)}'
  + '.lx-bl-slide{grid-area:1/1;display:grid;grid-template-columns:minmax(0,46%) minmax(0,1fr);'
  + 'text-decoration:none;color:inherit;opacity:0;visibility:hidden;'
  // visibility carries the accessibility half: a hidden slide leaves the tab order and the screen
  // reader tree, which opacity alone would not do. Delayed off, immediate on, so the fade still
  // plays out before it is taken away.
  + 'transition:opacity .45s ease,visibility 0s linear .45s}'
  + '.lx-bl-slide.is-on{opacity:1;visibility:visible;transition:opacity .45s ease,visibility 0s}'

  + '.lx-bl-cover{width:100%;height:100%;min-height:230px;object-fit:cover;display:block;'
  + 'background:var(--surface-2);border-right:1px solid var(--border)}'
  + '.lx-bl-body{padding:26px 30px 28px;display:flex;flex-direction:column;'
  + 'justify-content:center;gap:11px;min-width:0}'
  + '.lx-bl-meta{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;'
  + 'letter-spacing:.06em;text-transform:uppercase;color:var(--text-soft)}'
  + '.lx-bl-cat{color:rgba(234,106,44,.9)}'
  + '.lx-bl-dot{opacity:.5}'
  + '.lx-bl-title{font-size:clamp(19px,1.7vw,25px);font-weight:800;line-height:1.28;'
  + 'letter-spacing:-.3px;margin:0;color:var(--text);text-wrap:pretty;'
  + 'display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}'
  + '.lx-bl-ex{font-size:15px;line-height:1.6;color:var(--text-muted);margin:0;max-width:56ch;'
  + 'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}'
  + '.lx-bl-go{font-size:14.5px;font-weight:700;color:var(--accent);margin-top:3px}'
  + '[data-theme="light"] .lx-bl-go,[data-theme="light"] .lx-bl-cat{color:#bd4e19}'
  + '.lx-bl-slide:hover .lx-bl-title{text-decoration:underline;text-underline-offset:3px}'

  // ---- dots -----------------------------------------------------------------------------------
  + '.lx-bl-foot{display:flex;align-items:center;justify-content:space-between;gap:20px;'
  + 'margin-top:20px;flex-wrap:wrap}'
  + '.lx-bl-dots{display:flex;align-items:center;gap:10px}'
  // A real button, sized to a 34px hit area with the visible dot drawn inside it -- a bare 9px
  // target is unusable on a phone and fails every pointer-size guideline going.
  + '.lx-bl-dotb{appearance:none;border:0;background:none;padding:0;margin:0;cursor:pointer;'
  + 'width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center}'
  + '.lx-bl-dotb i{display:block;width:9px;height:9px;border-radius:50%;'
  + 'background:var(--border-strong);transition:background-color .25s ease,transform .25s ease}'
  + '.lx-bl-dotb:hover i{background:var(--text-soft)}'
  + '.lx-bl-dotb[aria-selected="true"] i{background:var(--accent);transform:scale(1.35)}'
  + '.lx-bl-dotb:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:50%}'
  + '.lx-bl-all{font-size:15px;font-weight:700;color:var(--accent);text-decoration:none}'
  + '.lx-bl-all:hover{text-decoration:underline}'
  + '[data-theme="light"] .lx-bl-all{color:#bd4e19}'

  + '@media (max-width:860px){.lx-blogs{padding:54px 0 58px}'
  + '.lx-blogs .lx-sec-head{margin-bottom:24px}'
  + '.lx-bl-slide{grid-template-columns:1fr;align-content:start}'
  // height:auto IS THE FIX, and it has to be stated. The desktop rule sets height:100% so the cover
  // fills the side column next to the text; once the slide becomes a single column that same
  // declaration makes the image stretch to fill whatever vertical space the text did not use -- and
  // since the five titles are different lengths, every slide got a DIFFERENT cover height.
  // Measured on staging at 375px: 190, 190, 202, 190, 202. aspect-ratio was being ignored because an
  // explicit height beats it, and object-fit:cover then cropped each one differently, so the image
  // and the text below it shifted on every rotation. With height:auto the ratio governs and all
  // five covers are exactly 338x190.
  + '.lx-bl-cover{height:auto;min-height:0;aspect-ratio:16/9;border-right:0;'
  + 'border-bottom:1px solid var(--border)}'
  + '.lx-bl-body{padding:18px 18px 20px;gap:9px}'
  + '.lx-bl-foot{margin-top:16px}}'

  // The whole point of this component is that it moves on its own, so with motion reduced the fade
  // goes and the JS does not start the timer at all -- the dots become a plain picker.
  + '@media (prefers-reduced-motion:reduce){'
  + '.lx-bl-slide,.lx-bl-slide.is-on,.lx-bl-dotb i{transition:none}}'
  + '</st' + 'yle>';

const JS = '<script id="lx-blogs-js">' + `(function(){
  var W = document.querySelector("[data-lxbl]");
  var DOTS = document.querySelector("[data-lxbldots]");
  var SEC = document.querySelector(".lx-blogs");
  if (!W || !DOTS || !SEC) return;
  var N = ${N}, EVERY = ${EVERY};

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
})();` + '<' + '/script>';

// Depth walk, because #faq holds nested sections' worth of divs and a lazy regex would close early.
function elEnd(html, startIdx, tag) {
  const re = new RegExp('<\\/?' + tag + '\\b', 'g');
  re.lastIndex = startIdx;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    if (m[0].charAt(1) === '/') { depth--; if (depth === 0) return html.indexOf('>', m.index) + 1; }
    else depth++;
  }
  return -1;
}

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

  html = html.replace(/<style id="lx-blogs-css">[\s\S]*?<\/style>/g, '');
  html = html.replace(/<script id="lx-blogs-js">[\s\S]*?<\/script>/g, '');
  for (let guard = 0; guard < 8; guard++) {
    const at = html.indexOf('<section class="lx-blogs"');
    if (at < 0) break;
    const end = elEnd(html, at, 'section');
    if (end < 0) { problems.push(p.key + ': previous blogs section is not closed'); break; }
    html = html.slice(0, at) + html.slice(end);
  }
  if (problems.length) continue;

  // ABOVE the FAQ, which is where it was asked to go.
  const at = html.indexOf('<section class="lx-faq"');
  if (at < 0) { problems.push(p.key + ': FAQ section not found'); continue; }
  html = html.slice(0, at) + SECTION + html.slice(at);

  // INJECTED AT THE END OF <body>, LIKE EVERY OTHER LAYER -- and deliberately not into <head>.
  // _externalize.js hoists every lx-* stylesheet into <head> on each build, as a group and in the
  // order it finds them, so injecting here is what keeps this layer in its NATURAL position in the
  // cascade relative to the layers it has to override.
  //
  // Injecting into <head> directly was tried first and is worse: this block then lands ahead of
  // every layer that still injects at end-of-body, i.e. it becomes the weakest instead of the
  // strongest. That silently cost two rules their overrides -- .lxu-cue reverted to 40px and the FAQ
  // heading re-centred -- and those were only the two that happened to be noticed.
  const bo0 = html.lastIndexOf('</body>');
  html = bo0 >= 0 ? html.slice(0, bo0) + CSS + html.slice(bo0) : html + CSS;

  const bo = html.lastIndexOf('</body>');
  html = bo >= 0 ? html.slice(0, bo) + JS + html.slice(bo) : html + JS;

  json[p.key] = html;
  staged.push({ file: p.file, data, s, e, json, key: p.key });
}

if (problems.length) {
  console.error('landing-blogs: ABORT - nothing written.');
  problems.forEach(x => console.error('  ' + x));
  process.exit(1);
}
for (const st of staged) {
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.key + ': blog preview above the FAQ (' + N + ' posts, '
    + (EVERY / 1000) + 's rotation, dots)');
}
console.log('landing-blogs: done on ' + staged.length + ' page(s)');
