// The landing hero: "Many networks. One Core." — a ring of chains that collapses into the flame as you
// scroll.
//
// WHAT REPLACED WHAT. The hero was a centred headline over a search field. The headline, one sentence and
// two buttons are all that remain of the copy: RAZA removed the eyebrow, the Live-today chips, the search
// and the network figures on 2026-09-28, so the ring carries the idea on its own.
//
// TWO TRANSFORMS NOW HAVE NOTHING TO ANCHOR TO, AND MUST NOT BE RE-RUN ON THE LANDING.
//   _heronet.js   builds the hero search field and its network selector. This transform DELETES that
//                 field. _heronet.js pre-gates the placeholder by finding `<input placeholder="...">`
//                 and aborts the build when it cannot -- so running it after this one fails loudly
//                 rather than quietly, which is the good case, but it still fails.
//   _herostats.js builds the live network figures and anchors them to `hero-search-wrap`. With that
//                 wrapper gone it has nothing to attach to either.
// Both leave a `<script>` behind in the container that keeps running for ever (landmine 11 in
// LUMOSCORE_DEV.md). Neither errors: each queries for an element, gets null, and returns. Checked.
// If the search or the figures are ever wanted back, re-run that transform FIRST and this one second --
// this transform deletes whatever it finds, so the order is what decides the outcome.
//
// NOTHING IS RE-AUTHORED THAT ALREADY EXISTS. The "Launch App" button is the header's own button, string
// for string, including its onclick -- the network chooser is wired to that exact call and a lookalike
// would open nothing. The flame in the middle of the ring is the design's own `.logo-mark`, so the core
// cannot drift from the logo in the corner. The rays, orbs and vignette behind the hero are not re-emitted
// from a copy in this file: they are whatever survives after the parts this transform owns are cut out,
// so a later change to those layers flows through instead of being overwritten by a stale duplicate.
//
// THE MOTION IS PURE CSS, and that is not a stylistic preference. Scroll-driven JS cannot be built or
// checked here at all -- the preview pane parks rAF and delivers no scroll events, so a JS scrub reads as
// "nothing happens" whether it works or not. A `animation-timeline: scroll(root)` animation renders at
// whatever scroll POSITION the page is at, which means scroll-to-offset + screenshot is a real test.
// It also means no injected <script>, so none of the backslash-eaten-by-template-literal family of
// failures can apply to this file.
//
// WHY scroll(root) AND vh RANGES rather than view(). The hero is the first element on the page, and a
// view() timeline's `cover` range is already ~26% elapsed at scroll 0 for an element that starts at the
// top of the document -- the animation would begin part-played. Against the root scroller the numbers are
// just distances from the top, which is also what makes the ranges below readable. The one place view()
// IS used is the handset, where the ring sits below the copy and therefore does enter the viewport
// normally.
//
// THE PIN. Desktop gets a 260vh track with a 100vh sticky stage: the hero holds still for 160vh while the
// ring contracts, then releases and scrolls away dimming. `position:sticky` dies inside an
// `overflow:hidden` ancestor, and the design's own `.hero` rule sets exactly that to clip the rays -- so
// the clip moves down onto the stage and the section is forced back to `overflow:visible`. No pin below
// 900px: the copy column is ~380px and the ring 300px, which does not fit inside a 100vh stage on a 667px
// handset, so there the ring scrubs on its own view() timeline as it passes up the screen.
//
// LABELS ARE PAINTED BY CSS, NOT WRITTEN AS TEXT. The site runs a logo healer that repaints any element
// holding 1-5 characters as a ticker logo, and "TON", "Sui", "Base", "NEAR" and "Sei" are all inside that
// range -- as plain text they would be silently replaced by token art. `content:attr(data-l)` cannot be
// cleared by it. Same reason the chips use it.
//
// XRPL IS NOT ADVERTISED AS LIVE. The reference shots say LIVE; the network selector on this same page
// says "Soon", the hubs say "Upcoming", and mainnet launch is 2 Oct. A front page claiming a network is
// live four days early is a false statement about where someone's money can go, so the chip reads from
// LIVE_CHAINS below -- move 'xrpl' into it on launch day and re-run, and the ring mark, the chip and the
// tag all follow from the one edit.
//
// ORDER IN THE PIPELINE. Run AFTER _herostats.js and before _heromono.js/_typescale.js:
//   … → _herostats.js → _herounify.js → _nofollow.js → _heromono.js → _typescale.js → extract_site.js
// _herostats.js anchors its block to `hero-search-wrap`, which this transform moves into the header --
// so re-running _herostats.js AFTER this one drops the figures into the nav bar. Re-running _herounify.js
// repairs that (it cuts the block from wherever it is and re-places it), but the order above avoids it.
// The stylesheet carries the /*lxts:1.1*/ stamp so _typescale.js leaves it alone: the sizes here are
// already final, and a second 1.1x on a 76px headline is not a rounding error.
//
// Idempotent: strips its own stylesheet (with /g -- a single-copy strip is how pages end up with rival
// stale sheets), unwraps its own stage, and rebuilds from the surviving parts every run.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const NETLOGOS = require(__dirname + '/_netlogos.json');
const logoOf = (name) => (NETLOGOS.find((n) => n.name === name) || {}).logo || '';

// Live means live on mainnet in LumosCore today. Nothing else goes in here.
const LIVE_CHAINS = ['stellar'];

// The ring, clockwise from just left of twelve o'clock. Ten, not eighteen: at eighteen the marks had to
// stay small to clear each other, and small is the opposite of what a hero wants. Stellar and XRPL
// straddle the top because they are the two this platform actually runs on.
//
// Algorand and Arc had no art in this repo at all -- 51 other bridge networks did, those two did not,
// because they were in the reference shots and the shots were a mockup. They shipped once as lettermark
// discs, which read as placeholders, so the real marks were fetched on 2026-09-28 with RAZA's go-ahead:
//   assets/networks/algorand.png  3,672 bytes  250x250  coin-images.coingecko.com/coins/images/4380
//   assets/networks/arc.jpg       6,524 bytes  250x250  coin-images.coingecko.com/asset_platforms/
//                                                       images/102132310  (CoinGecko platform id "arc",
//                                                       which is Circle's L1 -- not arc.network, which
//                                                       redirects to an unrelated company)
// Both were opened and looked at before being committed, and both carry their own opaque ground (the
// Algorand mark is black on white, Arc is white on navy), so `border-radius:50%` turns each into its own
// badge and neither disappears against the disc in either theme. A mark on a transparent ground would
// have vanished in dark mode -- that is what the check was for.
// Sixteen, not twenty-one, and that was arithmetic rather than taste. Twenty-one discs at the size
// RAZA asked for need about 44% more area than they had; the hero, after the copy column and the grid
// padding had already given up everything they could, could only find about 18% more. Bigger and more
// spread out are the same budget spent twice. Five of the less prominent chains came out, and the
// sixteen that remain got both.
//
// Every logo here is at least 250px on its longest side -- checked, because six of them were 96px and
// visibly soft at the size these now render, BNB Chain worst of all. See the note on `img` below.
const img = (f) => '<img src="assets/networks/' + f + '" alt="" width="46" height="46" decoding="async">';
const RING = [
  // ORDER IS POSITION: each mark takes the sector matching its index, so the list order is where things
  // sit. Stellar and XRPL are the two largest and are placed OPPOSITE each other rather than together --
  // side by side in adjacent sectors they need 0.25 of the field's radius between them and could not get
  // it, which is the overlap the guard below caught. Apart, they also balance the cloud.
  { id: 'stellar', label: 'Stellar', logo: logoOf('Stellar') },
  { id: 'ethereum', label: 'Ethereum', logo: img('ethereum.png') },
  { id: 'solana', label: 'Solana', logo: img('solana.png') },
  { id: 'bnbchain', label: 'BNB Chain', logo: img('bnbchain.png') },
  { id: 'polygon', label: 'Polygon', logo: img('polygon.png') },
  { id: 'arbitrum', label: 'Arbitrum', logo: img('arbitrum.png') },
  { id: 'avalanche', label: 'Avalanche', logo: img('avalanche.png') },
  { id: 'base', label: 'Base', logo: img('base.png') },
  { id: 'xrpl', label: 'XRPL', logo: logoOf('XRP Ledger') },
  { id: 'near', label: 'NEAR', logo: img('near.jpg') },
  { id: 'ton', label: 'TON', logo: img('ton.jpg') },
  { id: 'sui', label: 'Sui', logo: img('sui.png') },
  { id: 'hedera', label: 'Hedera', logo: logoOf('Hedera') },
  { id: 'aptos', label: 'Aptos', logo: img('aptos.png') },
  { id: 'starknet', label: 'Starknet', logo: logoOf('Starknet') },
  { id: 'hood', label: 'Robinhood', logo: img('hood.png') },
];

// ---------------------------------------------------------------------------------------------------

// THE FIELD IS A CIRCLE THAT IS THEN STRETCHED, and that detail is what lets it both look elliptical
// and turn.
//
// It was briefly laid out as a true ellipse -- x and y written straight into each mark -- and the
// rotation had to go, on the reasoning that rotating an ellipse makes it tumble and the horizontal
// stretch cannot be undone per mark while the angle is animating. The first half is right; the second
// was wrong, and it cost the hero its motion for a round.
//
// The stretch CAN be undone, as long as it is applied INSIDE the counter-rotation rather than beside it.
// With the ring stretched by KX and the orbit turned by θ, a mark renders through scaleX(KX)·rotate(θ).
// Undoing that needs rotate(-θ)·scaleX(1/KX) -- which is exactly a counter-rotating element with a
// counter-scaled child inside it, since a child's transform composes after its parent's. The two cancel
// to the identity at every angle, so the marks stay round and upright while the field they sit in stays
// a fixed ellipse and the whole thing turns.
//
// So positions are generated on a plain circular band here, and KX does the widening at render time.
// Collisions are therefore measured in the STRETCHED space -- the x separation multiplied by KX -- since
// that is where the discs actually end up.
const SEED = 20260928;
const KX = 1.25;           // how much wider than tall the field renders; the CSS applies it
const MARK = 0.1925;       // disc diameter as a fraction of --d; the CSS below uses the same number
const R_MIN = 0.210;       // circle-space radii, before the stretch
const R_MAX = 0.600;
const GAP = 0.020;         // smallest allowed space between two discs, as a fraction of --d
const CUE_LANE = 0.72;     // keep a clear band above the label that sits under the field

function mulberry32(a) {
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scatter(items) {
  const rand = mulberry32(SEED);
  const sector = 360 / items.length;
  const placed = [];
  return items.map((n, i) => {
    const live = LIVE_CHAINS.indexOf(n.id) >= 0;
    let best = null, bestGap = -Infinity;
    // Up to 120 draws per mark, keeping the roomiest if none clears outright. Keeping the best near miss
    // rather than giving up is what stops one unlucky sector from producing an overlap.
    for (let attempt = 0; attempt < 220; attempt++) {
      // Stratified: one sector each, jittered within it. Plain uniform noise clumps at this sample size
      // -- four marks in one corner and a quarter of the field bare, which reads as a mistake.
      const a = (i + 0.5) * sector + (rand() - 0.5) * sector * 0.82;
      // sqrt so they spread evenly over the AREA of the band rather than bunching against its inner rim,
      // which is what a flat random radius does -- there is less room close in.
      const r = Math.sqrt(R_MIN * R_MIN + rand() * (R_MAX * R_MAX - R_MIN * R_MIN));
      const s = live ? 1.14 + rand() * 0.10 : 0.76 + rand() * 0.40;
      const rad = a * Math.PI / 180;
      const x = Math.sin(rad) * r, y = -Math.cos(rad) * r;
      const half = s * MARK / 2;
      if (y + half > CUE_LANE && Math.abs(x * KX) < 0.36) continue;
      let gap = Infinity;
      for (const p of placed) {
        const need = (s + p.s) * MARK / 2 + GAP;
        // KX on the x term: the marks are judged where they are drawn, not where they were generated.
        gap = Math.min(gap, Math.hypot((x - p.x) * KX, y - p.y) - need);
      }
      if (gap > bestGap) { bestGap = gap; best = { a, r, s, x, y }; }
      if (gap > 0) break;
    }
    placed.push(best);
    return { n, live, a: best.a, r: best.r, s: best.s, x: best.x, y: best.y, gap: bestGap };
  });
}

// RELAXATION, because one-shot placement cannot be made reliable. Each mark is only ever checked against
// the marks placed BEFORE it, so a late arrival can be fine on arrival and still end up crowded once the
// rest are down -- and a different seed, one more network, or a size change reshuffles which pair loses.
// Chasing individual collisions by re-rolling the seed is whack-a-mole.
//
// So after the first pass, every overlapping pair is simply pushed apart along the line between them,
// half the overlap each, and the whole thing is re-checked. Radii are clamped back into the band, which
// can re-crowd a neighbour, which is exactly why it repeats. In practice it settles in a handful of
// rounds; the all-pairs guard below is what decides whether it actually did.
function relax(marks) {
  for (let round = 0; round < 400; round++) {
    let maxOver = -Infinity;
    for (let i = 0; i < marks.length; i++) {
      for (let j = i + 1; j < marks.length; j++) {
        const a = marks[i], b = marks[j];
        const need = (a.s + b.s) * MARK / 2 + GAP;
        let dx = b.x - a.x, dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d < 1e-6) { dx = 1e-3; dy = 0; d = 1e-3; }
        const over = need - d;
        if (over > maxOver) maxOver = over;
        if (over <= 0) continue;
        const ux = dx / d, uy = dy / d, push = over / 2 + 1e-4;
        a.x -= ux * push; a.y -= uy * push;
        b.x += ux * push; b.y += uy * push;
        for (const m of [a, b]) {
          const r = Math.min(R_MAX, Math.max(R_MIN, Math.hypot(m.x, m.y)));
          const ang = Math.atan2(m.x, -m.y);
          m.x = Math.sin(ang) * r; m.y = -Math.cos(ang) * r;
          m.r = r; m.a = ang * 180 / Math.PI;
        }
      }
    }
    if (maxOver <= 0) return round;
  }
  return -1;
}

// ---------------------------------------------------------------------------------------------------
const MARKS = scatter(RING);
const ROUNDS = relax(MARKS);

// THE GUARD RE-MEASURES EVERY PAIR FROM THE FINAL POSITIONS, which is not the same as trusting the
// number each mark recorded as it was placed. A mark only ever compares itself against the marks placed
// BEFORE it, so `m.gap` is a running value, not a verdict on the finished cloud -- and reading it back
// let a 20px Stellar/XRPL overlap through while reporting the build clean. Sixteen marks is 120 pairs;
// checking all of them costs nothing and is the only version that actually means what it says.
const worstPair = (() => {
  let gap = Infinity, who = '';
  for (let i = 0; i < MARKS.length; i++) {
    for (let j = i + 1; j < MARKS.length; j++) {
      const a = MARKS[i], b = MARKS[j];
      const need = (a.s + b.s) * MARK / 2 + GAP;
      const d = Math.hypot(a.x - b.x, a.y - b.y) - need;
      if (d < gap) { gap = d; who = a.n.label + ' / ' + b.n.label; }
    }
  }
  return { gap, who };
})();
if (!(worstPair.gap > 0)) {
  console.error('hero unify: ABORT — the scatter overlaps: ' + worstPair.who + ' by '
    + (-worstPair.gap).toFixed(4) + ' of --d. Change SEED, widen R_MIN/R_MAX, or drop a network.');
  process.exit(1);
}

const ringMarkup = MARKS.map((m) =>
  '<i class="lxu-n' + (m.live ? ' is-live' : '') + '" style="'
  + '--a:' + m.a.toFixed(2) + 'deg;--r:' + m.r.toFixed(4) + ';--s:' + m.s.toFixed(3) + '">'
  // Three nested spans, each doing one job: .lxu-nspin turns against the orbit, .lxu-nfix undoes the
  // field's horizontal stretch INSIDE that rotation, and .lxu-nd is the disc itself.
  + '<span class="lxu-nspin"><span class="lxu-nfix">'
  + '<span class="lxu-nd">' + m.n.logo + '</span>'
  + '<b class="lxu-nl" data-l="' + m.n.label + '"></b>'
  + '</span></span></i>').join('');

// The header's own button is CLONED out of the page at build time rather than retyped here. Its onclick
// is `window.lxChooseNetwork('lumoscore-home.html')` -- the network picker, then the wallet, then the
// dashboard. A hand-written lookalike with a slightly different call opens nothing at all, and that is
// the single most important control on the page.

// Headline, one sentence, two buttons. The eyebrow, the Live-today chips and the network stats were all
// here and are all gone at RAZA's direction (2026-09-28) -- the column is the claim and the way in, and
// the ring is what carries the idea.
function copyColumn(launchBtn) {
  return '<div class="lxu-copy">'
    + '<h1 class="lxu-h1"><i>Many networks.</i><i class="lxu-accent">One Core.</i></h1>'
    + '<p class="lxu-sub">Trade, bridge, provide liquidity, launch assets and manage '
    + 'more from one unified interface.</p>'
    + '<div class="lxu-ctas">' + launchBtn
    + '<a class="btn lxu-btn lxu-btn2" href="#products">Explore products'
    + '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" '
    + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg></a>'
    + '</div>'
    + '</div>';
}

// THE STARBURST IS PART OF THE VIZ NOW, NOT THE BACKDROP, and that is what keeps its convergence point
// underneath the flame. It used to sit in the stage and be nudged onto the core with a hand-computed
// `translate(19.4%,-7.2%)`. That held exactly as long as the hero's vertical composition did -- and the
// moment the eyebrow, the chips and the figures came out, the core moved 65px down the stage while the
// rays stayed where they were, leaving the bright knot of lines hanging above the logo in open space.
//
// Re-parented into .lxu-viz and centred on it, the origin IS the core's centre by construction: same
// element, same middle, at every breakpoint and after any future change to what else the hero holds.
// There is no number left to go stale.
const VIZ = (rays) => '<div class="lxu-viz">'
  + rays
  + '<span class="lxu-orbits" aria-hidden="true"></span>'
  + '<span class="lxu-halo" aria-hidden="true"></span>'
  + '<div class="lxu-core"><span class="lxu-ap" aria-hidden="true"></span>'
  + '<i class="lxu-flame logo-mark" aria-hidden="true"></i></div>'
  // The two labels under the core are the same thought at its two moments: what the ring IS when you
  // arrive, and what it BECOMES. "Fragmented networks" names the problem while the chains are still
  // scattered around the rim; it crossfades into "One Core" once they have been drawn in.
  + '<b class="lxu-onecore" data-l="One Core"></b>'
  // .lxu-ring carries the scroll-driven collapse; .lxu-orbit carries the endless turn. They have to be
  // two elements because both animate `transform`, and a second animation on the same property simply
  // replaces the first rather than composing with it.
  + '<div class="lxu-ring" aria-hidden="true"><div class="lxu-orbit">' + ringMarkup + '</div></div>'
  + '<span class="lxu-cue" aria-hidden="true"><b data-l="Fragmented networks"></b></span>'
  + '</div>';

// ---------------------------------------------------------------------------------------------------
// The stylesheet. /*lxts:1.1*/ first, so _typescale.js treats it as already scaled.
// ---------------------------------------------------------------------------------------------------
const CSS = '<style id="lx-herounify-css">/*lxts:1.1*/'

  // -- the section becomes a track; the stage inside it is what gets pinned ---------------------------
  // `section.hero.lxu-hero` rather than `.hero`: six separate rules for `.hero` have accumulated in this
  // page from earlier transforms (min-height:100vh, padding-top:200px, align-items:flex-start among
  // them) and a bare class would only beat the ones that happen to sit earlier in the document.
  + 'section.hero.lxu-hero{display:block;min-height:0;height:auto;padding:0;'
  + 'align-items:initial;justify-content:initial;overflow:visible}'
  + '.lxu-stage{position:relative;overflow:hidden;display:flex;flex-direction:column;'
  + 'align-items:center;justify-content:center;min-height:100vh;min-height:100dvh;'
  + 'padding:112px 0 44px;box-sizing:border-box}'

  // The design's starburst radiates from the centre of the hero, which was right for a centred headline
  // and is wrong now: with the copy on the left and the ring on the right, its origin landed in the empty
  // gap between them and read as a stray bright dot in mid-air. Moved to sit behind the core instead --
  // 19.4% right and 7.2% up is the offset from the stage centre to the ring centre. The 1.45 scale is
  // what keeps the layer covering its box after that shift (the left edge has to travel 278px, and a
  // scale about the centre only gains (S-1)x715 on that side), so no corner is left bare.
  // A square big enough to reach every corner of the stage, centred on the viz -- which is centred on
  // the core. `slice` keeps the 1600x1600 viewBox centred in it, so the lines converge exactly under the
  // flame. The stage clips whatever hangs outside.
  + '.lxu-viz>.hero-rays{position:absolute;left:50%;top:50%;width:190vmax;height:190vmax;'
  + 'transform:translate(-50%,-50%);pointer-events:none}'

  // -- the two columns --------------------------------------------------------------------------------
  // 520px for the copy is the measured width at which "Many networks." holds one line at its largest
  // size; the viz takes the rest so the ring can grow with the window instead of sitting in a fixed box.
  + '.lxu-grid{position:relative;z-index:3;width:100%;max-width:1280px;margin:0 auto;padding:0 32px;'
  + 'box-sizing:border-box;display:grid;grid-template-columns:minmax(0,420px) minmax(0,1fr);'
  + 'align-items:center;gap:28px;flex:0 0 auto}'
  + '.lxu-copy{min-width:0}'

  // clamp rather than a media-query ladder: the headline is the one element that has to stay on two
  // lines from 900px to 2560px, and steps leave it either cramped or overflowing between breakpoints.
  + '.lxu-h1{font:800 clamp(34px,3.85vw,56px)/1.06 "Hanken Grotesk",system-ui,sans-serif;'
  + 'letter-spacing:-.036em;color:var(--text);margin:0 0 22px}'
  + '.lxu-h1 i{display:block;font-style:normal}'
  + '.lxu-h1 .lxu-accent{color:var(--accent)}'
  + '.lxu-sub{font:500 19px/1.55 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-muted);'
  + 'max-width:34ch;margin:0 0 32px;text-wrap:pretty}'

  + '.lxu-ctas{display:flex;flex-wrap:wrap;gap:13px;margin:0}'
  + '.lxu-btn{height:52px;padding:0 24px;font-size:17px;border-radius:12px}'
  // The secondary is a recessed well, not a second orange button: two filled accents side by side and
  // neither reads as the primary action.
  + '.lxu-btn2{background:var(--surface-2);border:1px solid var(--border);color:var(--text);'
  + 'text-decoration:none;box-shadow:none}'
  + '.lxu-btn2:hover{border-color:var(--border-strong);background:var(--surface-3)}'

  // -- the ring ---------------------------------------------------------------------------------------
  // --d is the ring's diameter and every other measurement here is derived from it, so one override in a
  // media query rescales the whole assembly without anything drifting out of true.
  + '.lxu-viz{position:relative;--kx:1.25;--d:min(505px,56vh,34vw);width:calc(var(--d)*1.8);height:var(--d);'
  + 'margin:0 auto;justify-self:center}'
  // The guide rings take the field's own proportions. Left circular behind an elliptical cloud they
  // read as a ring the marks have failed to line up on, which is the opposite of the point.
  + '.lxu-orbits{position:absolute;left:50%;top:50%;'
  + 'width:calc(var(--d)*var(--kx));height:var(--d);'
  + 'transform:translate(-50%,-50%);border-radius:50%;border:1px solid rgba(234,106,44,.13);'
  + 'pointer-events:none}'
  + '.lxu-orbits::before,.lxu-orbits::after{content:"";position:absolute;left:50%;top:50%;'
  + 'transform:translate(-50%,-50%);border-radius:50%;border:1px solid rgba(234,106,44,.09)}'
  + '.lxu-orbits::before{width:74%;height:74%}'
  + '.lxu-orbits::after{width:47%;height:47%}'
  + '[data-theme="light"] .lxu-orbits{border-color:rgba(234,106,44,.20)}'
  + '[data-theme="light"] .lxu-orbits::before,[data-theme="light"] .lxu-orbits::after'
  + '{border-color:rgba(234,106,44,.14)}'

  + '.lxu-ring{position:absolute;left:50%;top:50%;width:var(--d);height:var(--d);'
  + 'transform:translate(-50%,-50%) scaleX(var(--kx));pointer-events:none}'
  + '.lxu-nfix{display:flex;align-items:center;justify-content:center;position:relative;'
  + 'transform:scaleX(calc(1/var(--kx)))}'
  + '.lxu-orbit{position:absolute;inset:0;border-radius:50%}'
  // Rotate to the mark's own angle, push out by ITS OWN radius, unrotate so the tilt is cancelled, then
  // scale to its own size. --a, --r and --s are written per mark by the scatter above; nothing here is
  // shared between them except the shape of the transform.
  + '.lxu-n{position:absolute;left:50%;top:50%;'
  + 'transform:translate(-50%,-50%) rotate(var(--a)) translateY(calc(var(--d)*var(--r)*-1)) '
  + 'rotate(calc(var(--a)*-1)) scale(var(--s,1))}'
  + '.lxu-nspin{display:flex;align-items:center;justify-content:center;position:relative}'
  // Sized from --d rather than in fixed pixels, because the scatter's spacing is expressed in fractions
  // of --d. A disc that stayed 68px while --d shrank on a narrow window would grow relative to the gaps
  // that were proved around it, and marks that clear each other on a desktop would overlap on a phone.
  + '.lxu-nd{width:calc(var(--d)*.1925);height:calc(var(--d)*.1925);'
  + 'border-radius:50%;display:flex;align-items:center;'
  + 'justify-content:center;background:var(--surface);border:1px solid var(--border);'
  + 'box-shadow:0 8px 22px rgba(0,0,0,.36);'
  // The ring as a whole stays pointer-events:none so the marks never swallow a click meant for the page.
  // Only the disc opts back in -- not the 104px box that also holds the label, because those boxes do
  // overlap slightly at the diagonals and two marks would light up at once. The discs never touch, so
  // the disc is the one shape that gives each mark a hit area entirely its own.
  + 'pointer-events:auto;'
  // No `cursor:pointer`. These are not links, and a hand cursor promises a destination that is not there.
  + 'transition:transform .3s cubic-bezier(.2,.8,.3,1),box-shadow .3s ease,border-color .3s ease}'
  + '[data-theme="light"] .lxu-nd{box-shadow:0 8px 20px rgba(15,15,20,.11)}'
  + '.lxu-nd>svg,.lxu-nd>img{width:62%;height:62%;border-radius:50%;display:block;'
  + 'transition:transform .3s cubic-bezier(.2,.8,.3,1)}'

  // HOVER. The disc lifts to 1.24 with an ember ring around it and the logo inside grows a touch further,
  // so the mark swells rather than merely being magnified. The name under it comes up to full-strength
  // ink at the same time, which is what makes the whole mark feel picked out instead of just the circle.
  // Transform and opacity only, so a mark can be hovered while the ring is turning without the browser
  // relaying anything out.
  + '.lxu-n:hover .lxu-nd{transform:scale(1.24);border-color:var(--accent,#ea6a2c);'
  + 'box-shadow:0 0 0 5px rgba(234,106,44,.13),0 14px 34px rgba(0,0,0,.5),'
  + '0 0 26px rgba(234,106,44,.45)}'
  + '[data-theme="light"] .lxu-n:hover .lxu-nd{'
  + 'box-shadow:0 0 0 5px rgba(234,106,44,.14),0 14px 30px rgba(15,15,20,.16),'
  + '0 0 22px rgba(234,106,44,.30)}'
  + '.lxu-n:hover .lxu-nd>svg,.lxu-n:hover .lxu-nd>img{transform:scale(1.06)}'
  + '.lxu-n:hover .lxu-nl{color:var(--text)}'
  // The hover is a response to the pointer, not ambient motion, so it still happens for a reader who
  // asked for less of it -- it just happens at once instead of easing.
  + '@media (prefers-reduced-motion:reduce){'
  + '.lxu-nd,.lxu-nd>svg,.lxu-nd>img,.lxu-nl{transition:none}}'
  // The two networks with no logo file. Same disc, same weight -- a short code instead of a mark, drawn
  // by CSS so the logo healer cannot repaint a 3-to-4 character element as a token icon.
  // THE NAMES MOVED TO HOVER. Twenty-one labels around a 560px ring is more type than the picture can
  // hold -- at ten they already had to go on the stacked layout, and doubling the marks doubles the
  // collisions. They are also taken OUT OF FLOW here: the scatter's spacing was computed for the discs
  // alone, so a label that could push its own mark's box around would invalidate every gap proved above.
  + '.lxu-nl{position:absolute;top:100%;left:50%;transform:translateX(-50%);margin-top:7px;'
  + 'font:700 12px/1.2 "Hanken Grotesk",system-ui,sans-serif;color:var(--text);'
  + 'text-align:center;white-space:nowrap;pointer-events:none;opacity:0;'
  + 'transition:opacity .22s ease;text-shadow:0 1px 6px rgba(0,0,0,.85)}'
  + '[data-theme="light"] .lxu-nl{text-shadow:0 1px 6px rgba(255,255,255,.9)}'
  + '.lxu-nl::after{content:attr(data-l)}'
  + '.lxu-n:hover .lxu-nl{opacity:1}'
  + '.lxu-n.is-live .lxu-nd{border-color:rgba(234,106,44,.55);'
  + 'box-shadow:0 0 0 3px rgba(234,106,44,.11),0 8px 22px rgba(0,0,0,.36)}'
  + '.lxu-n.is-live .lxu-nl{color:var(--text-muted)}'

  // THE ORBIT TURNS WITH THE BACKGROUND. The design's starburst is `raysSpin 180s linear infinite`
  // clockwise, so the marks take the same period and the same direction and the two layers move as one
  // field instead of two things going at different speeds. Transform-only on both, so it composites and
  // costs nothing to keep running.
  + '.lxu-orbit{animation:lxu-orbitspin 200s linear infinite}'
  + '.lxu-nspin{display:flex;animation:lxu-orbitspin 200s linear infinite reverse}'
  + '@media (prefers-reduced-motion:reduce){.lxu-orbit,.lxu-nspin{animation:none}}'

  // -- the core ---------------------------------------------------------------------------------------
  // IT STARTS SMALL AND ENDS LARGE. At rest the core is a quarter of the ring's diameter -- a point the
  // scattered chains are arranged around rather than the subject of the picture -- and the scroll takes
  // it to 1.9x, which finishes wider than the old fixed size ever was. That progression IS the idea:
  // nothing in the middle at first, everything in the middle at the end.
  // THERE IS NO DISC ANY MORE, and that was the answer after two attempts at making one look good. A
  // filled circle sitting on a starburst is a sticker whatever you do to it: darken it and it is a hole
  // punched in the artwork, warm it and it is a brown blob. Both were tried and both were right to
  // reject.
  //
  // What replaces it is a WELL OF LIGHT and an APERTURE. Nothing has an edge: a soft dark vignette gives
  // the flame something to read against, a warm bloom sits over it, and both fade to nothing well before
  // they stop -- so the rays pass straight through and appear to be radiating FROM the core rather than
  // being covered by it, which is what the whole hero is about. Around it, three arcs rather than a
  // rim: two struck from opposite sides and turning against each other, plus one faint complete ring to
  // hold them together. An arc reads as a lit object turning in space; a full stroke reads as a border.
  // That is the whole difference, and it is why this is arcs and not a circle.
  + '.lxu-core{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);'
  + 'width:calc(var(--d)*.25);height:calc(var(--d)*.25);border-radius:50%;display:flex;'
  + 'align-items:center;justify-content:center;box-shadow:none;'
  + 'background:radial-gradient(circle at 50% 50%,rgba(255,164,96,.22) 0%,'
  + 'rgba(234,106,44,.09) 40%,rgba(234,106,44,0) 70%),'
  + 'radial-gradient(circle at 50% 50%,rgba(8,8,11,.80) 0%,rgba(8,8,11,.46) 38%,'
  + 'rgba(8,8,11,0) 68%)}'
  + '.lxu-core::before{content:none}'
  // LIGHT MODE INVERTS THE BACKING, it does not tint it. The dark wash that gives the flame something to
  // read against on black becomes a grey-brown smudge on white -- the same blob that was wrong on the
  // dark build, reappearing in the other theme. The flame is saturated and dark enough to hold its own
  // on white, so here the well clears the rays instead of covering them: a white bloom, with only a
  // breath of warmth over it.
  + '[data-theme="light"] .lxu-core{'
  + 'background:radial-gradient(circle at 50% 50%,rgba(255,170,110,.18) 0%,'
  + 'rgba(234,106,44,0) 62%),'
  + 'radial-gradient(circle at 50% 50%,rgba(255,255,255,.92) 0%,rgba(255,255,255,.55) 40%,'
  + 'rgba(255,255,255,0) 72%)}'

  // The aperture. Struck from `border-*-color` rather than a masked conic gradient: the arcs are exactly
  // a quarter-turn each, they cost nothing, and there is no mask support to get wrong.
  + '.lxu-ap{position:absolute;inset:-7%;border-radius:50%;pointer-events:none;'
  + 'border:2px solid transparent;border-top-color:rgba(255,158,88,.92);'
  + 'border-right-color:rgba(234,106,44,.30);'
  + 'animation:lxu-apspin 17s linear infinite}'
  + '.lxu-ap::before{content:"";position:absolute;inset:9%;border-radius:50%;'
  + 'border:1.5px solid transparent;border-bottom-color:rgba(234,106,44,.72);'
  + 'border-left-color:rgba(234,106,44,.22);'
  + 'animation:lxu-apspin 11s linear infinite reverse}'
  + '.lxu-ap::after{content:"";position:absolute;inset:22%;border-radius:50%;'
  + 'border:1px solid rgba(234,106,44,.15)}'
  + '[data-theme="light"] .lxu-ap{border-top-color:rgba(234,106,44,.9);'
  + 'border-right-color:rgba(234,106,44,.28)}'
  + '@media (prefers-reduced-motion:reduce){.lxu-ap,.lxu-ap::before{animation:none}}'
  // One ring leaving the core on a slow loop -- the thing the spokes are feeding, answering back. One,
  // not a sonar stack: three of these turns a hero into a screensaver.
  + '.lxu-core::after{content:"";position:absolute;inset:-1px;border-radius:50%;'
  + 'border:1px solid rgba(234,106,44,.5);opacity:0;pointer-events:none;'
  + 'animation:lxu-pulse 4.6s ease-out infinite}'
  + '@media (prefers-reduced-motion:reduce){.lxu-core::after{animation:none}}'
  + '.lxu-halo{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);'
  + 'width:calc(var(--d)*.42);height:calc(var(--d)*.42);border-radius:50%;opacity:.5;'
  + 'background:radial-gradient(circle,rgba(234,106,44,.30),rgba(234,106,44,0) 68%);pointer-events:none}'
  // The design's own mark. border-radius and shadow are reset because .logo-mark carries a squashed
  // radius tuned for a 38px badge in the corner.
  // With the disc gone the flame IS the core, so it carries the middle rather than sitting in it: 62% of
  // the space where it was 52%, and lit from behind by its own glow rather than by a chamber.
  + '.lxu-flame{width:62%;height:62%;border-radius:0;box-shadow:none;flex:0 0 auto;'
  + 'position:relative;z-index:1;'
  + 'filter:drop-shadow(0 0 26px rgba(234,106,44,.55)) drop-shadow(0 4px 14px rgba(0,0,0,.6))}'
  + '[data-theme="light"] .lxu-flame{'
  + 'filter:drop-shadow(0 0 22px rgba(234,106,44,.35)) drop-shadow(0 4px 12px rgba(15,15,20,.18))}'
  // The payoff line, and it is sized to be one: the headline's own weight and colour at display size,
  // not the small tracked-out caps it used to be. It sits lower than the cue because by the time it
  // appears the core beneath it has grown, and a label tucked under the small core would be inside the
  // big one.
  + '.lxu-onecore{position:absolute;left:50%;top:calc(50% + var(--d)*.32);transform:translateX(-50%);'
  + 'font:800 clamp(28px,3.3vw,48px)/1 "Hanken Grotesk",system-ui,sans-serif;letter-spacing:-.03em;'
  + 'color:var(--accent);opacity:0;white-space:nowrap;pointer-events:none;'
  + 'text-shadow:0 2px 26px rgba(234,106,44,.45)}'
  + '.lxu-onecore::after{content:attr(data-l)}'
  // OUTSIDE THE RING, NOT INSIDE IT. It used to sit in the gap between the core and the marks at 10.5px
  // of tracked-out caps, where it was both cramped and too small to be the counterpart of anything.
  // .52 of the diameter puts it clear of the outer orbit line and about 30px below the lowest label, and
  // it is set at display size so the two states of the picture read as a pair: "Fragmented networks" in
  // muted ink on arrival, "One Core" in the accent once they have been drawn in.
  //
  // It keeps its own slot rather than sharing One Core's, because by the time One Core appears the core
  // has grown to nearly half the ring and a label out at .52 would be stranded far below it.
  //
  // Hidden unless the scroll timeline is actually running: naming the state of something that is never
  // going to change is worse than saying nothing.
  // The accent, matching One Core, so the two states of the picture are plainly the same line of type
  // saying two different things. The mouse glyph that used to sit under it is gone at RAZA's direction.
  // .74, NOT .80. At .80 the label sat exactly ON the bottom edge of the viewport at every ordinary
  // laptop height -- 0px of space at 1280x720, 1366x768 and 1440x760, and 4px CUT OFF at 1440x700 --
  // because it hangs `0.80 * --d` below a ring that is itself vertically centred, so the pair grows
  // faster than the screen does. Fixed by moving the LABEL, not by shrinking --d, since the diameter
  // is the thing RAZA asked to grow.
  //
  // .74 is measured, not chosen by eye: the label is squeezed between the marks above it and the
  // bottom of the screen, and the two only both clear at one value. Over a full revolution, at
  // 1440x700 / 1280x720 / 1440x900 / 1920x1080 --
  //   .70 -> 3-4px from a disc (far too close), 36-147px below
  //   .74 -> 19-25px from a disc,              20-126px below   <- both healthy
  //   .78 -> 35-45px,                          4-106px below    (4px at 1440x700)
  //   .80 -> 43-55px,                         -4px at 1440x700  (the shipped bug)
  // Measure over the whole rotation, never one frame: the marks that pass closest to the label's ENDS
  // are only there at some phases.
  + '.lxu-cue{display:none;position:absolute;left:50%;top:calc(50% + var(--d)*.74);'
  + 'transform:translateX(-50%);align-items:center;color:var(--accent);'
  + 'white-space:nowrap;pointer-events:none;'
  + 'font:800 clamp(24px,2.9vw,40px)/1 "Hanken Grotesk",system-ui,sans-serif;letter-spacing:-.03em;'
  + 'text-shadow:0 2px 24px rgba(234,106,44,.35)}'
  + '.lxu-cue b::after{content:attr(data-l)}'
  // The label's size is set by WIDTH, so a wide-but-short window (1440x620, 1280x600 -- a laptop
  // carrying a lot of browser chrome) renders it at the full 40px in a viewport that has no room for
  // it: 13px of air underneath. Easing the type down below 680px of height buys back about 10px and
  // costs nothing at any normal height, where the clamp above is untouched. RAZA asked for this label
  // to be BIG, so this is deliberately gated as far out of the way as it can be rather than applied
  // as a general reduction.
  + '@media (max-height:680px){.lxu-cue{font-size:clamp(22px,2.2vw,30px)}}'

  // The header keeps nowrap even though the field it was added for has gone: "Why LumosCore" and
  // "Launch App" each broke over two lines once anything else shared the row, and the rule costs
  // nothing now that nothing else does.
  + '.nav-links a,.nav-actions .btn{white-space:nowrap}'

  // -- responsive --------------------------------------------------------------------------------------
  // THE RING IS CLAMPED BY VIEWPORT HEIGHT, NOT JUST WIDTH (the `62vh` term in --d above). The stage is
  // exactly one screen tall and clips what overflows it, so on a short window -- 1440x660 is an ordinary
  // laptop with a lot of browser chrome -- the label that now hangs below the ring was cut off: 19px
  // gone at 660, 39px at 620. Measured across 26 window sizes, not guessed at one. Tying the diameter to
  // height as well means the whole assembly shrinks together and the label stays inside the frame.
  + '@media (max-height:720px){.lxu-stage{padding:110px 0 36px}}'
  + '@media (max-width:1180px){'
  + '.lxu-grid{gap:24px;padding:0 28px;grid-template-columns:minmax(0,46%) minmax(0,1fr)}'
  // CIRCULAR here too, and for the same reason it goes circular on a phone. At every two-column width
  // from 900 to 1180 the stretched cloud put Solana and Polygon 22-31px past the right edge, where the
  // stage sliced them in half. It hid from a single-instant check: the field ROTATES, so which mark is
  // furthest out depends on the phase the measurement happened to catch -- one sweep called 1100px
  // clean and a full-revolution sweep at the same width found 31px gone. Squaring the field costs the
  // diameter nothing (the marks come in from `--d*1.8` to `--d*1.45` wide) where clamping --d enough to
  // fit the ellipse would have cost about 29%, undoing the size increase these widths are here for.
  + '.lxu-viz{--d:min(430px,56vh,33vw);--kx:1;width:calc(var(--d)*1.45)}'
  + '.lxu-sub{font-size:17.5px;margin-bottom:26px}'
  + '.lxu-ctas{margin-bottom:28px}'
  + '.lxu-nl{font-size:11.5px}}'

  // The last of the two-column widths. Between about 890px and 920px the ring was still 430px across in
  // a column that had stopped being wide enough for it, and Hedera -- the item at three o'clock -- ran
  // up to 12px past the right edge. Measured across the whole sweep, not spotted at one size.
  + '@media (max-width:1020px){.lxu-viz{--d:min(380px,54vh,33vw)}}'

  // One column below 900px. The ring goes under the copy, which is also the width at which the pin is
  // dropped -- a 100vh stage cannot hold a stacked hero on a short handset.
  + '@media (max-width:899px){'
  + 'section.hero.lxu-hero{height:auto}'
  // relative, NOT static. The pin is dropped here by the @supports block simply not applying
  // `position:sticky` below 900px -- setting `static` as well took the stage out of position, and an
  // `overflow:hidden` box only clips absolutely-positioned descendants when it is their containing
  // block. The design's drifting orbs then escaped the hero and gave the phone 30px of horizontal
  // scroll, which is not something they did before this hero existed.
  + '.lxu-stage{min-height:0;padding:112px 0 56px;position:relative}'
  + '.lxu-grid{grid-template-columns:minmax(0,1fr);gap:44px;padding:0 22px;justify-items:center;'
  + 'text-align:center}'
  + '.lxu-copy{max-width:560px}'
  + '.lxu-sub{margin-left:auto;margin-right:auto}'
  + '.lxu-ctas{justify-content:center}'
  // The field goes CIRCULAR here, and that is the whole fix for the phone. Stretched to --kx 1.25 the
  // cloud is `--d * 1.8` across -- 432px inside a 375px handset -- so Solana, the mark furthest out to
  // the right, was sliced in half by the stage's own overflow:hidden. Nothing scrolled and nothing
  // overlapped, so only a picture caught it. The ellipse exists to fill a wide desktop column; once the
  // hero stacks, the column is roughly square and the stretch buys nothing. --kx feeds both the stretch
  // and its counter-scale on .lxu-nfix, so one value here squares the cloud AND the guide rings without
  // touching a single mark's position -- and the scatter measured every gap in UNSTRETCHED space, which
  // is exactly this space, so the proved clearances hold rather than merely survive.
  + '.lxu-viz{--d:min(62vw,330px);--kx:1;width:calc(var(--d)*1.35)}'
  + '.lxu-h1{font-size:clamp(36px,8.4vw,52px)}'
  // The names only ever show on hover now, so they cost the stacked layout nothing; this just keeps
  // them in proportion for the one that does appear.
  + '.lxu-nl{font-size:11px}}'

  // ON A PHONE THE DISCS COME DOWN, AND ONLY THE DISCS. The scatter's spacing is a fraction of --d,
  // so it is the same at every size -- but a gap of 0.018 of --d is 10px on a desktop and 1px on a
  // 375px handset, where the marks read as touching. Shrinking a disc can only ever open a gap, never
  // close one, so this is safe to do without regenerating a single position.
  + '@media (max-width:1020px){.lxu-nd{width:calc(var(--d)*.142);height:calc(var(--d)*.142)}}'
  // .175 ON A PHONE, NOT .128. Coming down to .128 was over-correction: RAZA's read was that the marks
  // were "too tiny", and he was right -- 26px discs on a 375px screen. The scatter proved every
  // clearance at MARK .1925 in unstretched space, and rendering a disc SMALLER than the value the
  // clearance was proved at can only ever open a gap, never close one. So .175 is still inside the
  // proof with room to spare: it leaves roughly 9px between the closest pair at this diameter, against
  // the ~10px desktop has, while making every disc 37% bigger than .128 did.
  + '@media (max-width:899px){.lxu-nd{width:calc(var(--d)*.175);height:calc(var(--d)*.175)}}'
  + '@media (max-width:480px){'
  + '.lxu-btn{height:48px;padding:0 20px;font-size:16px}'
  + '.lxu-nl{font-size:10px}}'

  // Narrowest handsets: the cloud tightens with --d, and the discs follow it down automatically.
  + '@media (max-width:420px){'
  + '.lxu-viz{--d:min(64vw,300px)}}'

  // -- the scrub ----------------------------------------------------------------------------------------
  // Everything above is the resting state, which is what a browser without scroll timelines, or a reader
  // who asked for less motion, is left with: a complete hero, not a half-played one.
  + '@supports (animation-timeline:scroll()){'
  + '@media (prefers-reduced-motion:no-preference) and (min-width:900px){'
  + 'section.hero.lxu-hero{height:260vh}'
  + '.lxu-stage{position:sticky;top:0;height:100vh;height:100dvh;min-height:0;padding:0}'
  + '.lxu-cue{display:flex}'
  // THE MIDDLE IS EMPTY UNTIL IT IS EARNED. Nothing stands in the centre while the networks are still
  // scattered -- just the lit well and its arcs. The mark only appears as they close in, which is the
  // whole claim of the section: there is no core until the networks make one.
  + '.lxu-flame{opacity:0;animation:lxu-ignite linear both;animation-timeline:scroll(root);'
  + 'animation-range:86vh 150vh}'
  + '.lxu-ring{animation:lxu-collapse linear both;animation-timeline:scroll(root);'
  + 'animation-range:0 148vh}'
  + '.lxu-orbits{animation:lxu-orbits linear both;animation-timeline:scroll(root);'
  + 'animation-range:0 148vh}'
  + '.lxu-core{animation:lxu-core linear both;animation-timeline:scroll(root);'
  + 'animation-range:0 148vh}'
  + '.lxu-halo{animation:lxu-halo linear both;animation-timeline:scroll(root);'
  + 'animation-range:0 148vh}'
  + '.lxu-cue{animation:lxu-fade linear both;animation-timeline:scroll(root);'
  + 'animation-range:0 44vh}'
  + '.lxu-onecore{animation:lxu-rise linear both;animation-timeline:scroll(root);'
  + 'animation-range:98vh 150vh}'
  // Dimming starts where the pin lets go (260vh track - 100vh stage = 160vh), so the hero hands over to
  // the products section instead of sitting bright while it is scrolled past.
  + '.lxu-grid{animation:lxu-dim linear both;'
  + 'animation-timeline:scroll(root);animation-range:162vh 248vh}'
  + '}'
  // THE HANDSET IS PINNED TOO, at RAZA's direction (2026-09-28). It used to drop the pin and let the
  // ring ride a view() timeline as it came up the screen, which meant the whole point of the section
  // -- scattered networks closing into one core, with the label turning over from "Fragmented
  // networks" to "One Core" -- never happened on a phone. The ring scrubbed while the hero was
  // scrolling away, so it was barely visible, and the cue was display:none there so the label never
  // turned over at all.
  //
  // Pinning a STACKED hero is the harder case and it is why this was dropped the first time: the copy
  // and the ring have to fit inside one 100dvh stage together, on a 640px-tall handset as well as an
  // 932px one. So everything here comes down together -- padding, headline, standfirst, and --d, which
  // now carries a vh term exactly as the desktop one does so the ring shrinks on a short screen
  // instead of pushing the label off the bottom.
  + '@media (prefers-reduced-motion:no-preference) and (max-width:899px){'
  + 'section.hero.lxu-hero{height:210vh}'
  + '.lxu-stage{position:sticky;top:0;height:100vh;height:100dvh;min-height:0;'
  + 'padding:82px 0 18px;justify-content:center}'
  // THE PHONE ORDER IS NOT THE DOM ORDER, at RAZA's direction (2026-09-28):
  //   headline -> standfirst -> the label -> the ring -> the buttons
  // The buttons live inside .lxu-copy in the markup, so they cannot be moved past .lxu-viz by `order`
  // on their own. `display:contents` on .lxu-copy dissolves that wrapper into the flex line, which
  // promotes the headline, standfirst and buttons to siblings of the ring -- and only then does
  // `order` reach all four. It is also why .lxu-copy's max-width stops applying here, which is what
  // lets the standfirst run the full width the way RAZA asked.
  + '.lxu-grid{display:flex;flex-direction:column;align-items:center;gap:0;padding:0 14px}'
  + '.lxu-copy{display:contents}'
  + '.lxu-h1{order:1}.lxu-sub{order:2}.lxu-viz{order:3}.lxu-ctas{order:4}'

  // One line, not two. The desktop headline is two blocks stacked; inline plus a word space puts them
  // on one, and the size is driven off vw so `nowrap` can never overflow rather than being a clamp
  // that happens to fit the phone it was checked on.
  + '.lxu-h1{font-size:min(7.05vw,30px);white-space:nowrap;margin:0 0 10px;text-align:center}'
  + '.lxu-h1 i{display:inline}'
  + '.lxu-h1 i+i{margin-left:.26em}'
  // Two lines, full width. max-width was 34ch, which is what held it to three.
  + '.lxu-sub{font-size:13.5px;line-height:1.5;max-width:none;width:100%;margin:0 0 2px;'
  + 'text-align:center;text-wrap:balance}'
  // Side by side and sharing the width equally. flex-wrap was `wrap`, which is what stacked them.
  + '.lxu-ctas{margin:0;gap:10px;width:100%;flex-wrap:nowrap;justify-content:center}'
  + '.lxu-ctas>*{flex:1 1 0;min-width:0}'
  + '.lxu-btn{height:46px;font-size:14.5px;padding:0 10px;white-space:nowrap}'

  // Both labels move to the TOP of the ring's box. They are absolutely positioned inside .lxu-viz, so
  // the 92px of top padding is what makes room for them: `top:50%` resolves against the PADDING box,
  // which pushes the whole assembly -- rings, halo, core and marks alike -- down by half of it, so one
  // declaration clears 46px above the cloud without moving any of those five elements individually.
  // They share a position on purpose: the cue is gone by 32vh and One Core does not begin until 70vh,
  // so they never both occupy it, and the hand-over happens in one place rather than two.
  // content-box IS THE LOAD-BEARING WORD HERE. The page sets `*{box-sizing:border-box}`, under which
  // `padding-top` does not grow the element at all -- it eats into the content box, the border box
  // stays `1.38 * --d`, `top:50%` lands in the same place, and the cloud still began 2px from the top
  // with 104px of padding supposedly above it. Measured: padding 104, box 350, cloud top 2.
  //
  // With content-box the padding box becomes `1.38 * --d + 104`, so `top:50%` moves down by 52 and
  // every centred layer -- rings, halo, core and all sixteen marks -- moves with it in one
  // declaration. That yields ~54px of clear space above the cloud for a ~27px label.
  //
  // The clearance is checked over a FULL REVOLUTION, not at rest: which mark is highest depends on
  // the phase, and an at-rest check said the labels cleared while a rotating one found them 26px
  // into the marks.
  + '.lxu-viz{box-sizing:content-box;padding-top:104px}'
  + '.lxu-cue{top:6px;bottom:auto}'
  // One Core matches the cue's size here rather than keeping its desktop 28px. They are the same line
  // of type saying two different things and they now occupy the same spot, so a size difference
  // between them would read as the text jumping rather than changing.
  + '.lxu-onecore{top:6px;font-size:clamp(19px,5.4vw,26px)}'
  // WIDTH IS WHAT CAPS THE RING ON A PHONE, and sizing it off height was the mistake. The cloud is
  // `1.2 * --d` of orbit plus one disc either side, so at .175 it is about 1.42 * --d across -- which
  // means the widest --d that fits a 375px screen with a 24px margin is ~248, not the 202 that
  // `min(54vw,290px,27vh)` was handing back. The stage had over 150px of unused vertical room at the
  // same time, so the ring was being squeezed by a constraint that was not the binding one.
  //
  // `70vw - 18px` is that width budget written as CSS: (100vw - 24px) / 1.42. The vh term stays as a
  // backstop for a short-and-wide window, where height does bind.
  // THE BOX HAS TO RESERVE THE CLOUD, NOT THE RING. `.lxu-viz` is `height:var(--d)` by default, but
  // the marks orbit at up to 0.6 of --d from the centre and carry a disc on top of that, so the cloud
  // is about 1.38 * --d tall and overflows its own box by ~0.19 * --d at each end. At the old phone
  // diameter that overhang was small enough to hide in the grid gap; at this one it reached straight
  // into the buttons -- logos sitting ON "Launch App" and "Explore products", clearance measured at
  // 0px against the real painted elements rather than the copy's block box.
  // Both budgets, written out, because either can bind depending on the phone.
  //   WIDTH: the cloud is ~1.42 * --d across, against 100vw less the grid's 14px gutters, so
  //          (100vw - 28px)/1.42 = 70vw - 20px.
  //   HEIGHT: the stage holds 82 top padding + a one-line headline (~42) + a two-line standfirst
  //           (~45) + the ring's box (1.38 * --d PLUS the 104px label zone above it) + the button
  //           row (46) + 18 bottom. That is 337 + 1.38 * --d, so --d <= (100vh - 345px)/1.38,
  //           i.e. 72vh - 250px.
  // A tall phone is width-bound and a short one is height-bound; taking the min of the two is what
  // makes 360x700 and 375x812 both work, where a single vh figure left the label off the bottom on
  // the short one. The 160px floor stops a freak viewport resolving to nothing.
  + '.lxu-viz{--d:max(160px,min(calc(70vw - 20px),340px,calc(72vh - 250px)));'
  + 'width:calc(var(--d)*1.42);height:calc(var(--d)*1.38)}'
  + '.lxu-cue{display:flex;font-size:clamp(19px,5.4vw,26px)}'
  + '.lxu-flame{opacity:0;animation:lxu-ignite linear both;animation-timeline:scroll(root);'
  + 'animation-range:62vh 108vh}'
  + '.lxu-ring{animation:lxu-collapse linear both;animation-timeline:scroll(root);'
  + 'animation-range:0 106vh}'
  + '.lxu-orbits{animation:lxu-orbits linear both;animation-timeline:scroll(root);'
  + 'animation-range:0 106vh}'
  + '.lxu-core{animation:lxu-core linear both;animation-timeline:scroll(root);'
  + 'animation-range:0 106vh}'
  + '.lxu-halo{animation:lxu-halo linear both;animation-timeline:scroll(root);'
  + 'animation-range:0 106vh}'
  + '.lxu-cue{animation:lxu-fade linear both;animation-timeline:scroll(root);'
  + 'animation-range:0 32vh}'
  + '.lxu-onecore{animation:lxu-rise linear both;animation-timeline:scroll(root);'
  + 'animation-range:70vh 108vh}'
  // 210vh track - 100vh stage = 110vh of pin, so the hand-off starts where the pin lets go.
  + '.lxu-grid{animation:lxu-dim linear both;animation-timeline:scroll(root);'
  + 'animation-range:112vh 198vh}'
  + '}'
  // The shortest handsets. At 360x640 the whole stack fitted but the label finished 3px off the
  // bottom edge -- inside, and unreadable. The ring comes down again here and takes the label with
  // it, since the label hangs a fraction of --d below the ring's centre.
  + '@media (prefers-reduced-motion:no-preference) and (max-width:899px) and (max-height:680px){'
  // --d is not restated here: the formula above already carries the height budget, so a second,
  // separate figure at this breakpoint could only disagree with it. These are the type and padding
  // reductions only, which make that budget easier to meet rather than overriding it.
  + '.lxu-stage{padding:74px 0 16px}'
  + '.lxu-cue{font-size:18px}'
  + '.lxu-h1{font-size:clamp(25px,6.6vw,34px)}'
  + '.lxu-sub{font-size:13.5px;margin-bottom:12px}'
  + '}'
  + '}'

  // The base transform is repeated in every frame on purpose: a keyframe that sets `transform` replaces
  // the whole property, so dropping translate(-50%,-50%) would fling the ring a quarter-turn off centre.
  // scaleX(var(--kx)) IS LOAD-BEARING IN EVERY KEYFRAME, not decoration copied from the static rule.
  // An animated `transform` REPLACES the element's own `transform` outright -- it does not merge with
  // it -- so a keyframe that says only `scale(n)` silently drops the ring's horizontal stretch the
  // moment this timeline engages. The counter-scale on .lxu-nfix (`scaleX(1/var(--kx))`, the layer
  // that lets the marks rotate without shearing) then has nothing to cancel, and every disc renders
  // at 80% width -- a vertical oval. Shipped exactly that on 2026-09-28.
  + '@keyframes lxu-collapse'
  + '{0%{transform:translate(-50%,-50%) scaleX(var(--kx)) scale(1);opacity:1}'
  + '56%{opacity:1}'
  + '100%{transform:translate(-50%,-50%) scaleX(var(--kx)) scale(.12);opacity:0}}'
  + '@keyframes lxu-orbits{0%{transform:translate(-50%,-50%) scale(1);opacity:1}'
  + '100%{transform:translate(-50%,-50%) scale(.28);opacity:0}}'
  + '@keyframes lxu-core{0%{transform:translate(-50%,-50%) scale(1)}'
  + '55%{transform:translate(-50%,-50%) scale(1.22)}100%{transform:translate(-50%,-50%) scale(1.9)}}'
  + '@keyframes lxu-halo{0%{transform:translate(-50%,-50%) scale(.9);opacity:.45}'
  + '100%{transform:translate(-50%,-50%) scale(1.75);opacity:1}}'
  + '@keyframes lxu-fade{0%{opacity:1}100%{opacity:0}}'
  + '@keyframes lxu-rise{0%{opacity:0}100%{opacity:1}}'
  + '@keyframes lxu-dim{0%{opacity:1}100%{opacity:.16}}'
  + '@keyframes lxu-orbitspin{to{transform:rotate(360deg)}}'
  + '@keyframes lxu-ignite{0%{opacity:0;transform:scale(.52)}62%{opacity:1}'
  + '100%{opacity:1;transform:scale(1)}}'
  + '@keyframes lxu-pulse{0%{opacity:.5;transform:scale(1)}70%{opacity:0}'
  + '100%{opacity:0;transform:scale(1.75)}}'
  + '@keyframes lxu-apspin{to{transform:rotate(360deg)}}'

  + '</st' + 'yle>';

// ---------------------------------------------------------------------------------------------------
// Element surgery
// ---------------------------------------------------------------------------------------------------

// Depth walk, because every block here is a div holding divs and a non-greedy regex halves them.
function bounds(html, openMarker, tag) {
  const at = html.indexOf(openMarker);
  if (at < 0) return null;
  const re = new RegExp('<' + tag + '\\b|</' + tag + '>', 'g');
  re.lastIndex = at;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    if (m[0].charAt(1) === '/') { depth--; if (depth === 0) return { at, end: m.index + m[0].length }; }
    else depth++;
  }
  return null;
}

// Cut the element out and hand back both halves, so a node can be moved rather than re-authored.
function take(html, openMarker, tag) {
  const b = bounds(html, openMarker, tag);
  if (!b) return { html, taken: '' };
  return { html: html.slice(0, b.at) + html.slice(b.end), taken: html.slice(b.at, b.end) };
}

function drop(html, openMarker, tag) {
  let out = html;
  for (let guard = 0; guard < 24; guard++) {
    const b = bounds(out, openMarker, tag);
    if (!b) return out;
    out = out.slice(0, b.at) + out.slice(b.end);
  }
  return out;
}

// Remove a wrapper but keep what it held -- used to undo a previous run's stage before rebuilding.
function unwrap(html, openMarker, tag) {
  let out = html;
  for (let guard = 0; guard < 24; guard++) {
    const b = bounds(out, openMarker, tag);
    if (!b) return out;
    const openEnd = out.indexOf('>', b.at) + 1;
    const closeLen = ('</' + tag + '>').length;
    out = out.slice(0, b.at) + out.slice(openEnd, b.end - closeLen) + out.slice(b.end);
  }
  return out;
}

const PAGES = [
  { file: 'lumoscore-aptos-desktop.html', key: 'lumoscore-landing.html' },
  { file: 'lumoscore-aptos-mobile.html', key: 'lumoscore-landing-mobile.html' },
];

const problems = [];
const staged = [];

for (const p of PAGES) {
  const data = read(p.file);
  const { json, s, e } = getContents(data);
  let html = json[p.key];
  if (html == null) { problems.push(p.key + ': missing'); continue; }

  // 1. Strip this transform's own stylesheet. /g, always: one strip against two stale copies leaves a
  //    rival sheet competing at equal specificity for ever.
  html = html.replace(/<style id="lx-herounify-css">[\s\S]*?<\/style>/g, '');

  // 2. DELETE the two blocks the landing no longer carries, from wherever a previous run left them --
  //    the search field (with its network selector) and the live network figures. Both are cut out of
  //    the page entirely, including the wrappers an earlier version of this transform put around them.
  //    See the note at the top of this file: _heronet.js and _herostats.js must not be re-run on the
  //    landing afterwards, because each anchors its output to a node that no longer exists.
  html = drop(html, '<div class="hero-search-wrap">', 'div');
  html = drop(html, '<div class="lx-herostats"', 'div');
  html = drop(html, '<div class="lxu-figs">', 'div');
  html = drop(html, '<div class="lxu-navsearch">', 'div');
  html = drop(html, '<div class="lxu-heroSearch">', 'div');

  // 3. Clone the header's Launch App button. Taking it from the page rather than retyping it is what
  //    guarantees the hero CTA calls the same lxChooseNetwork the header does.
  const btnB = bounds(html, '<button class="btn primary"', 'button');
  if (!btnB) { problems.push(p.key + ': header Launch App button not found'); continue; }
  const headerBtn = html.slice(btnB.at, btnB.end);
  if (headerBtn.indexOf('lxChooseNetwork') < 0) {
    problems.push(p.key + ': the cloned button does not call lxChooseNetwork'); continue;
  }
  const launchBtn = headerBtn.replace('class="btn primary"', 'class="btn primary lxu-btn"');
  const hb = bounds(html, '<section class="hero', 'section');
  if (!hb) { problems.push(p.key + ': hero section not found'); continue; }
  const openEnd = html.indexOf('>', hb.at) + 1;
  let inner = html.slice(openEnd, hb.end - '</section>'.length);

  inner = unwrap(inner, '<div class="lxu-stage">', 'div');
  // THE RAYS COME OUT FIRST, and the order matters now that they live in the viz: on a re-run they are
  // inside the .lxu-grid this is about to drop, so lifting them afterwards would find nothing. The
  // backdrop guard below caught exactly that on the first build after the move -- loudly, before
  // writing, which is what it is for.
  const gotRays = take(inner, '<div class="hero-rays"', 'div');
  inner = gotRays.html;
  const rays = gotRays.taken;
  if (!rays) { problems.push(p.key + ': the starburst is gone from the hero'); continue; }

  inner = drop(inner, '<div class="lxu-grid"', 'div');
  inner = drop(inner, '<div class="hero-center"', 'div');
  inner = drop(inner, '<a class="scroll-hint"', 'a');
  // Whatever is left is the design's own background: rays, orbs, vignette. Not re-emitted from a copy in
  // this file, so a later change to those layers is carried through rather than overwritten.
  // What is left is the design's own orbs and vignette. Not re-emitted from a copy in this file, so a
  // later change to those layers flows through instead of being overwritten by a stale duplicate.
  const backdrop = inner.trim();
  if (backdrop.indexOf('orb o') < 0) {
    problems.push(p.key + ': hero backdrop lost (no orbs after the strip)'); continue;
  }
  if (backdrop.indexOf('lxu-') >= 0) {
    problems.push(p.key + ': previous run survived the strip'); continue;
  }

  // 4. Rebuild.
  const section = '<section class="hero lxu-hero">'
    + '<div class="lxu-stage">'
    + backdrop
    + '<div class="lxu-grid">' + copyColumn(launchBtn) + VIZ(rays) + '</div>'
    + '</div>'
    + '</section>';
  html = html.slice(0, hb.at) + section + html.slice(hb.end);

  // None of the removed MARKUP may survive anywhere on the page, not just inside the section. Matched on
  // the element's open tag rather than the bare class name, because both _heronet.js and _herostats.js
  // leave a <style>/<script> behind whose id and selector text contain the same words -- those are inert
  // (each queries for its element, gets null and returns) and are deliberately left where they are.
  for (const gone of ['<div class="hero-search-wrap">', '<div class="lx-herostats"',
                      '<div class="lxu-navsearch">', '<div class="lxu-figs">']) {
    if (html.indexOf(gone) >= 0) { problems.push(p.key + ': ' + gone + ' still on the page'); }
  }

  const bo = html.lastIndexOf('</body>');
  html = bo >= 0 ? html.slice(0, bo) + CSS + html.slice(bo) : html + CSS;

  json[p.key] = html;
  staged.push({ file: p.file, data, s, e, json, key: p.key });
}

if (problems.length) {
  console.error('hero unify: ABORT — nothing written.');
  problems.forEach((x) => console.error('  ' + x));
  process.exit(1);
}

for (const st of staged) {
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.key + ': ' + RING.length + ' networks, tightest gap '
    + worstPair.gap.toFixed(4) + ' of --d (' + worstPair.who + ')'
    + (ROUNDS > 0 ? ', ' + ROUNDS + ' relaxation round(s)' : ''));
}
console.log('hero unify: done on ' + staged.length + ' page(s)');
