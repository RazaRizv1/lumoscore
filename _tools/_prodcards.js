// The six product cards on the landing page: dark panel, glowing gradient edge, a lit icon tile with a
// pair of orbits behind it, and a pill CTA. Built to the reference shots RAZA supplied on 2026-09-28.
//
// NOTHING IS RE-AUTHORED. The cards already exist -- markup, links, copy, icons and, crucially, a
// per-card accent that earlier work put on each one as `--pc` / `--pc-rgb`. That pair is what makes the
// reference's "card colour on the left, ember on the right" edge possible without inventing a palette:
// every gradient here runs from the card's own accent to the site accent. Trade stays iris, Pools green,
// Cross-Chain purple, Rewards amber, Launchpad and LUMOS ember. One decorative span per card is added
// for the orbits; that is the only markup this transform writes.
//
// SPECIFICITY, NOT ORDER. `.product-card` already carries FOUR separate rule blocks from earlier
// transforms -- a base, a restyle, a narrow-screen override and a centred-layout pass -- and two of them
// claim `::before`. Rather than hope this stylesheet lands after all of them for ever, every selector
// here is written `.product-card.lxpc` (0,2,0), which beats a bare `.product-card` (0,1,0) wherever it
// sits in the document. `.lxpc` is on all six cards already. The old `::before` (a radial hover wash on
// one pass, a 2px top bar on another) is switched off: the gradient edge replaces both.
//
// THE GRADIENT EDGE is the two-background trick -- a transparent border with the card fill painted to
// padding-box and the gradient to border-box. The glow around it is box-shadow rather than a blurred
// copy on a negative z-index, which cannot work here: the card paints its own background, and a child
// behind that background is a child nobody sees.
//
// Idempotent: strips its own stylesheet (with /g, so a page that ever held two copies does not keep
// them) and its own orbit spans before writing either.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const ORB = '<span class="lxpc-orb" aria-hidden="true"><i></i></span>';
const PIN_OPEN = '<div class="lxpc-pin">';
const VIEW_OPEN = '<div class="lxpc-view">';
// A rail under the cards that fills left to right as the row travels right to left -- the same timeline
// driving both, so it is a readout of exactly how far through the six you are rather than a decoration
// that happens to move at a similar speed.
const BAR = '<div class="lxpc-bar" aria-hidden="true"><i></i></div>';

// Depth walk, because the section and the grid both hold divs and a non-greedy regex halves them.
function bounds(html, openMarker, tag, from) {
  const at = html.indexOf(openMarker, from || 0);
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

// Remove a wrapper but keep what it held -- used to undo a previous run before re-wrapping.
// Remove a whole element, contents and all.
function drop(html, openMarker, tag) {
  for (let guard = 0; guard < 8; guard++) {
    const b = bounds(html, openMarker, tag);
    if (!b) return html;
    html = html.slice(0, b.at) + html.slice(b.end);
  }
  return html;
}

function unwrap(html, openMarker, tag) {
  for (let guard = 0; guard < 8; guard++) {
    const b = bounds(html, openMarker, tag);
    if (!b) return html;
    const openEnd = html.indexOf('>', b.at) + 1;
    html = html.slice(0, b.at) + html.slice(openEnd, b.end - ('</' + tag + '>').length) + html.slice(b.end);
  }
  return html;
}

// padTop, tile size -> the orbit's centre is padTop + tile/2 from the top of the card. Kept as one table
// so the three numbers can never drift apart; a hand-typed `top` is exactly how the rings end up sitting
// off the icon at one breakpoint and nobody notices until it ships.
const SIZES = [
  { at: null, pad: 34, tile: 104, radius: 30, glyph: 46, orb: 216 },
  { at: 1100, pad: 30, tile: 92, radius: 27, glyph: 41, orb: 186 },
  { at: 700, pad: 26, tile: 80, radius: 24, glyph: 36, orb: 162 },
];
const sizeBlock = (s) => {
  const top = s.pad + s.tile / 2;
  return '.product-card.lxpc{padding:' + s.pad + 'px 26px 28px}'
    + '.product-card.lxpc .ic-prod{width:' + s.tile + 'px;height:' + s.tile + 'px;'
    + 'border-radius:' + s.radius + 'px}'
    + '.product-card.lxpc .ic-prod>svg{width:' + s.glyph + 'px;height:' + s.glyph + 'px}'
    + '.product-card.lxpc .lxpc-orb{top:' + top + 'px;width:' + s.orb + 'px;height:' + s.orb + 'px}';
};

// AN ID IS REQUIRED IN THE SELECTOR, and finding that out cost a build. The centred-row layout from the
// earlier landing pass is written `.block#products .product-card` -- one id and two classes, (1,2,0) --
// and an id beats any number of classes, so `.product-card.lxpc` (0,2,0) lost `flex-direction` to it in
// silence: padding, radius and colours all took effect while the card stayed a wrapped ROW, which put
// the icon left of centre and the orbit rings, centred on the card, 33-71px away from it.
//
// Every selector below is therefore written `.product-card.lxpc` for readability and rewritten through
// this prefix on the way out: (1,3,0), which outranks the existing rule outright rather than relying on
// document order. Both landing builds carry `<section class="block" id="products">`, checked.
const P = '.block#products .product-card.lxpc';

const CSS_RAW = '<style id="lx-prodcards-css">/*lxts:1.1*/'

  // ---- the card -------------------------------------------------------------------------------------
  // gap:0 is not redundant: the row layout this replaces set `gap:15px`, which in a column adds 15px
  // between every child on top of the margins set below.
  + '.product-card.lxpc{position:relative;overflow:hidden;display:flex;flex-direction:column;'
  + 'align-items:center;text-align:center;gap:0;border-radius:24px;border:1.5px solid transparent;'
  + 'background:linear-gradient(180deg,var(--surface),var(--bg)) padding-box,'
  + 'linear-gradient(135deg,var(--pc,#ea6a2c) 2%,var(--accent,#ea6a2c) 82%) border-box;'
  + 'box-shadow:0 0 26px -8px rgba(var(--pc-rgb,234,106,44),.45),'
  + '0 0 62px -22px rgba(234,106,44,.40),0 20px 44px -28px rgba(0,0,0,.9);'
  + 'transition:transform .32s cubic-bezier(.2,.8,.3,1),box-shadow .32s ease}'
  // The edge carries the card now, so the wash and the top bar the two earlier passes drew go away.
  + '.product-card.lxpc::before{display:none}'
  + '[data-theme="light"] .product-card.lxpc{'
  + 'box-shadow:0 0 22px -8px rgba(var(--pc-rgb,234,106,44),.34),'
  + '0 0 50px -22px rgba(234,106,44,.28),0 18px 38px -26px rgba(15,15,20,.35)}'

  // ---- the orbits behind the icon -------------------------------------------------------------------
  // Two rings turning against each other with a lit bead on each. The bead is a pseudo-element pinned to
  // the ring's edge, so it is the RING that is animated and the bead simply rides it -- one transform per
  // ring rather than ten keyframed positions.
  + '.lxpc-orb{position:absolute;left:50%;transform:translate(-50%,-50%);border-radius:50%;'
  + 'border:1px solid rgba(var(--pc-rgb,234,106,44),.22);pointer-events:none;'
  + 'animation:lxpc-orbA 26s linear infinite}'
  + '.lxpc-orb i{position:absolute;inset:17%;border-radius:50%;'
  + 'border:1px solid rgba(var(--pc-rgb,234,106,44),.16);'
  + 'animation:lxpc-orbB 18s linear infinite reverse}'
  + '.lxpc-orb::before,.lxpc-orb i::before{content:"";position:absolute;top:50%;left:-4px;'
  + 'width:8px;height:8px;margin-top:-4px;border-radius:50%;background:var(--pc,#ea6a2c);'
  + 'box-shadow:0 0 11px rgba(var(--pc-rgb,234,106,44),.95)}'
  + '.lxpc-orb i::before{left:auto;right:-4px}'

  // ---- the icon tile --------------------------------------------------------------------------------
  + '.product-card.lxpc .ic-prod{position:relative;margin:0 0 26px;color:#fff;'
  + 'display:flex;align-items:center;justify-content:center;'
  + 'background:linear-gradient(158deg,rgba(var(--pc-rgb,234,106,44),1),'
  + 'rgba(var(--pc-rgb,234,106,44),.68));'
  + 'box-shadow:0 0 42px -6px rgba(var(--pc-rgb,234,106,44),.6),'
  + 'inset 0 1px 0 rgba(255,255,255,.3),0 14px 30px -14px rgba(0,0,0,.8);'
  + 'transition:transform .32s cubic-bezier(.2,.8,.3,1),box-shadow .32s ease}'
  // The pool of light the tile is standing in.
  + '.product-card.lxpc .ic-prod::after{content:"";position:absolute;left:50%;bottom:-15px;'
  + 'width:126px;height:18px;transform:translateX(-50%);border-radius:50%;pointer-events:none;'
  + 'background:radial-gradient(closest-side,rgba(var(--pc-rgb,234,106,44),.85),'
  + 'rgba(var(--pc-rgb,234,106,44),0));filter:blur(6px)}'
  // LUMOS is the exception, and deliberately so: its mark is the product's own flame, which already has
  // a shape and a colour of its own. Putting it inside a tinted tile would be putting a logo inside a
  // logo, so it stands free and is lit from behind instead. `.lx-ic-logo` (0,1,0) already asked for no
  // tile; this restates it at a specificity that survives the rules above.
  + '.product-card.lxpc .ic-prod.lx-ic-logo{background:none;box-shadow:none;border:0;border-radius:0}'
  + '.product-card.lxpc .ic-prod.lx-ic-logo::after{background:radial-gradient(closest-side,'
  + 'rgba(234,106,44,.7),rgba(234,106,44,0))}'
  + '.product-card.lxpc .ic-prod.lx-ic-logo .ic-prod-img{width:100%;height:100%;'
  + 'filter:drop-shadow(0 0 26px rgba(234,106,44,.55))}'

  // ---- type -----------------------------------------------------------------------------------------
  + '.product-card.lxpc h3{font:800 30px/1.1 "Hanken Grotesk",system-ui,sans-serif;'
  + 'letter-spacing:-.03em;color:var(--text);margin:0 0 12px;text-align:center}'
  + '.product-card.lxpc p{font:500 16.5px/1.6 "Hanken Grotesk",system-ui,sans-serif;'
  + 'color:var(--text-muted);margin:0 0 26px;max-width:34ch;text-align:center;flex:1 1 auto;'
  + 'text-wrap:pretty}'

  // ---- the CTA pill ---------------------------------------------------------------------------------
  // THE PADDING-BOX LAYER HAS TO BE OPAQUE. In the two-background border trick the border-box gradient
  // fills the WHOLE box and the padding-box layer sits on top of it as a mask -- so a near-transparent
  // fill does not read as "the card showing through", it lets the gradient flood the middle and the pill
  // comes out as a solid blob with unreadable text. First attempt did exactly that.
  // var(--bg) rather than var(--surface): the card's own fill is a gradient that has reached --bg by the
  // time it gets down to the CTA, so this is the colour that actually sits behind the pill.
  + '.product-card.lxpc .lx-pc-cta{flex:0 0 auto;align-self:center;margin:auto 0 0;'
  + 'display:inline-flex;align-items:center;justify-content:center;gap:9px;padding:13px 26px;'
  + 'border-radius:999px;border:1.5px solid transparent;opacity:1;'
  + 'background:linear-gradient(var(--bg),var(--bg)) padding-box,'
  + 'linear-gradient(120deg,var(--pc,#ea6a2c),var(--accent,#ea6a2c)) border-box;'
  + 'font:750 15.5px/1 "Hanken Grotesk",system-ui,sans-serif;color:var(--accent,#ea6a2c);'
  + 'box-shadow:0 0 18px -7px rgba(var(--pc-rgb,234,106,44),.7);'
  + 'transition:transform .3s cubic-bezier(.2,.8,.3,1),box-shadow .3s ease}'
  // The ember sits at 6.22:1 on the dark card and 3.18:1 on the white one -- the label reads in one
  // theme and fails AA in the other, which was already true of this CTA before it became a pill and is
  // easier to see now that it looks like a button. A darker ember for light mode only: #bd4e19 measures
  // 4.92:1 on white and is still plainly the same colour. Dark is left alone; it already passes.
  + '[data-theme="light"] .product-card.lxpc .lx-pc-cta{color:#bd4e19}'

  // ---- hover ----------------------------------------------------------------------------------------
  // IT GROWS FROM ITS BOTTOM EDGE, IT DOES NOT LIFT, AND THAT IS A BUG FIX RATHER THAN A STYLE CHOICE.
  // `translateY(-8px)` moved the card's bottom edge 8px UP, and :hover is hit-tested against the
  // TRANSFORMED box -- so a pointer resting anywhere in that 8px band was inside the card at rest,
  // outside it once the card lifted away, inside again when it dropped back. The card then flickered
  // between the two states as fast as the browser could restyle it, which is the vibration RAZA hit
  // along the bottom edge of the products row.
  //
  // The usual fix -- a pseudo-element extending the hit area downward -- cannot work here twice over:
  // the card sets `overflow:hidden` (it has to, for the orbit rings), which clips any such element,
  // and even unclipped it would only relocate the unstable band rather than remove it.
  //
  // Scaling about `center bottom` removes it outright, because every edge either stays put or moves
  // TOWARD the pointer: the bottom is the anchor and does not move, the top rises ~8px on a 415px
  // card (matching the old lift almost exactly), and the sides spread ~4px into a 22px gutter. An edge
  // advancing into the pointer latches the hover; only a retreating edge can oscillate, and after this
  // there isn't one.
  + '.product-card.lxpc{transform-origin:center bottom}'
  + '.product-card.lxpc:hover{transform:scale(1.02);'
  + 'box-shadow:0 0 42px -4px rgba(var(--pc-rgb,234,106,44),.62),'
  + '0 0 96px -26px rgba(234,106,44,.55),0 30px 60px -30px rgba(0,0,0,.95)}'
  + '[data-theme="light"] .product-card.lxpc:hover{'
  + 'box-shadow:0 0 34px -4px rgba(var(--pc-rgb,234,106,44),.42),'
  + '0 0 74px -26px rgba(234,106,44,.34),0 26px 50px -28px rgba(15,15,20,.4)}'
  // The earlier pass tilted the icon -3deg on hover. At 50px that was a wink; at 104px it is a wonky
  // tile, so it lifts straight instead.
  + '.product-card.lxpc:hover .ic-prod{transform:translateY(-5px) scale(1.06);'
  + 'box-shadow:0 0 58px -4px rgba(var(--pc-rgb,234,106,44),.8),'
  + 'inset 0 1px 0 rgba(255,255,255,.34),0 18px 34px -14px rgba(0,0,0,.85)}'
  + '.product-card.lxpc:hover .lx-pc-cta{transform:translateY(-1px);'
  + 'box-shadow:0 0 28px -5px rgba(var(--pc-rgb,234,106,44),.95)}'
  + '.product-card.lxpc:hover .lxpc-orb{border-color:rgba(var(--pc-rgb,234,106,44),.4)}'
  + '.product-card.lxpc:hover .lxpc-orb i{border-color:rgba(var(--pc-rgb,234,106,44),.3)}'

  // ---- sizes ----------------------------------------------------------------------------------------
  + sizeBlock(SIZES[0])
  + '@media (max-width:1100px){' + sizeBlock(SIZES[1])
  + '.product-card.lxpc h3{font-size:26px}.product-card.lxpc p{font-size:15.5px;margin-bottom:22px}}'
  + '@media (max-width:700px){' + sizeBlock(SIZES[2])
  + '.product-card.lxpc h3{font-size:23px}.product-card.lxpc p{font-size:15px;margin-bottom:20px}'
  + '.product-card.lxpc .lx-pc-cta{padding:12px 22px;font-size:14.5px}'
  + '.product-card.lxpc .ic-prod::after{width:100px}}'

  + '@keyframes lxpc-orbA{to{transform:translate(-50%,-50%) rotate(360deg)}}'
  + '@keyframes lxpc-orbB{to{transform:rotate(360deg)}}'
  + '@media (prefers-reduced-motion:reduce){'
  + '.lxpc-orb,.lxpc-orb i{animation:none}'
  + '.product-card.lxpc,.product-card.lxpc .ic-prod,.product-card.lxpc .lx-pc-cta{transition:none}}'

  // ---- the six cards on one line, sliding right to left as the page scrolls -------------------------
  // THREE AT A TIME, EXACTLY. Each card is `(100% - 2 gaps) / 3` of the viewport wrapper, so three plus
  // their two gaps measure exactly one wrapper and the other three hang off the right edge. That makes
  // the distance to travel arithmetic rather than a guess: the row is 6 cards + 5 gaps = 2 wrappers +
  // one gap, so the slide is one wrapper plus one gap -- `translateX(calc(-100% - var(--g)))`, since a
  // percentage translate is a percentage of the element's own width and the row's width IS one wrapper.
  // Nothing here depends on a hand-measured pixel figure that would drift the moment a card changes.
  //
  // DESKTOP ONLY, and the gate is 901px rather than a round 1000 for a measured reason: below 901 the
  // design already turns this grid into a touch scroller you swipe, and pinning the section to drive it
  // from the page scroll would put two scroll gestures on one element and fight the one the reader is
  // actually making. Between 901 and 1100 the design instead stacks the six cards in a single column --
  // measured at 918px wide each on a 999px window, which is a mile of scrolling past six billboards --
  // so the carousel takes that band too and the two treatments meet exactly where the scroller begins.
  // ---- the progress rail ----------------------------------------------------------------------------
  // Hidden by default and shown only inside the @supports/@media block above, for the same reason the
  // hero's scroll cue is: a progress bar that can never fill is worse than no progress bar.
  + '#products .lxpc-bar{display:none;position:relative;width:min(100%,420px);height:3px;'
  + 'margin:34px auto 0;border-radius:99px;overflow:hidden;'
  + 'background:linear-gradient(90deg,rgba(var(--pc-rgb,234,106,44),.10),rgba(234,106,44,.14))}'
  + '[data-theme="light"] #products .lxpc-bar{background:rgba(15,15,20,.09)}'
  + '#products .lxpc-bar>i{display:block;width:100%;height:100%;border-radius:99px;'
  + 'transform:scaleX(0);transform-origin:0 50%;'
  + 'background:linear-gradient(90deg,#8b7bff,#34d37a 26%,#a855f7 52%,#ffb547 74%,#ea6a2c);'
  + 'box-shadow:0 0 14px rgba(234,106,44,.55)}'
  + '@media (prefers-reduced-motion:reduce){#products .lxpc-bar{display:none}}'

  // 2.4px of horizontal scroll on every handset, and it is NOT the carousel -- the carousel is gated
  // off below 901px entirely. The design's `.container` takes a FLUID side padding (17.6px at 375px)
  // while `.products-grid` bleeds to the screen edge with a hardcoded `margin:0 -20px`. The 2.4px is
  // the difference, and it has been there since long before this transform: `display:contents` on
  // .lxpc-view leaves the page exactly 378px wide, which is what cleared the wrapper of causing it.
  // `clip` rather than `hidden` on purpose -- `hidden` would make the section a scroll container and
  // trap the grid's own horizontal card scroller, and clipping only the x axis leaves the cards'
  // glow spilling vertically as it should. The bleed still reaches within 2.4px of the edge, so
  // nothing about the look changes.
  + '@media (max-width:900px){#products{overflow-x:clip}}'

  + '@media (min-width:901px){'
  // Vertical padding with matching negative margin: the wrapper has to clip horizontally for the
  // carousel to work, and without this it would clip the cards' glow at the top and bottom too.
  + '#products .lxpc-view{overflow:hidden;padding:36px 0;margin:-36px 0}'
  + '#products .products-grid{--g:22px;display:grid;grid-template-columns:none;grid-auto-flow:column;'
  + 'grid-auto-columns:calc((100% - 2*var(--g))/3);gap:var(--g);width:100%;overflow:visible;'
  + 'will-change:transform}'
  + '}'

  // THE SAME CAROUSEL ON A PHONE, at RAZA's direction (2026-09-28), where the row previously used the
  // design's own swipe scroller and nothing moved with the page.
  //
  // `overflow-x:visible` on the grid is the part that matters and is easy to miss: the design makes
  // the row a native horizontal SCROLLER on mobile, and a scroller cannot also be slid by a transform
  // -- the two fight, and the user's swipe would undo the scroll position the animation is setting.
  // Turning the scroller off is what lets the page's own scroll drive the row instead.
  //
  // One card at a time rather than three, at 78% so the next one peeks in and the row reads as
  // continuing. The design's bleed margins go too, because they are sized for a scroller that no
  // longer exists.
  // SELECTOR SPECIFICITY IS THE WHOLE FIGHT HERE. The mobile swipe scroller is declared as
  // `.block#products .products-grid{overflow-x:auto}` -- (1,2,0) -- so the obvious
  // `#products .products-grid` (1,1,0) lost and the grid stayed a native scroller while every other
  // property of mine applied. A scroller cannot also be slid by a transform, so the row simply did not
  // move. Going through .lxpc-view, which is this transform's own wrapper and therefore always
  // present, makes it (1,3,0) and settles it regardless of source order.
  //
  // min-height:700px: below that the pinned row does not fit. At 360x640 the heading, a card and the
  // rail come to 710px in a 640px stage -- 35px clipped off each end. A phone that short keeps the
  // design's swipe carousel, which needs no vertical room at all. Measured, not assumed.
  + '@media (max-width:900px) and (min-height:700px){'
  + '#products .lxpc-view{overflow:hidden;padding:24px 0;margin:-24px 0}'
  + '.block#products .lxpc-view .products-grid{--g:14px;display:grid;grid-template-columns:none;'
  + 'grid-auto-flow:column;grid-auto-columns:78%;gap:var(--g);width:100%;'
  + 'overflow-x:visible;overflow-y:visible;margin:0;padding:0;'
  + 'scroll-snap-type:none;will-change:transform}'
  + '.block#products .lxpc-view .products-grid>*{scroll-snap-align:none}'
  + '}'

  + '@supports (animation-timeline:view()){'
  + '@media (prefers-reduced-motion:no-preference) and (min-width:901px){'
  // The section becomes the track and names a view timeline; the pin inside it holds still while the
  // track passes. `contain` runs from the moment the track fully covers the viewport to the moment it
  // stops doing so, which is precisely the span over which the sticky child is stuck -- 130vh here,
  // given a 230vh track and a 100vh pin. The two are the same measurement, so the slide cannot finish
  // early or still be moving as the section lets go.
  + '#products{height:230vh;padding:0;view-timeline-name:--lxpcT;view-timeline-axis:block}'
  + '#products .lxpc-pin{position:sticky;top:0;height:100vh;display:flex;align-items:center;'
  + 'overflow:hidden}'
  + '#products .products-grid{animation:lxpc-slide linear both;animation-timeline:--lxpcT;'
  + 'animation-range:contain 0% contain 100%}'
  // The rail reads the same timeline as the row, so it is a position indicator rather than an ornament
  // that merely moves at a similar rate. scaleX from a left origin: one compositor property, no layout.
  + '#products .lxpc-bar{display:block}'
  + '#products .lxpc-bar>i{animation:lxpc-fill linear both;animation-timeline:--lxpcT;'
  + 'animation-range:contain 0% contain 100%}'
  // The prev/next rail drove this row by hand. With the page scroll driving it, two controls for one
  // position contradict each other.
  + '#products .lx-prail{display:none}'
  + '}'

  // The phone runs the same machinery on a longer track, because it moves five card-widths instead of
  // one row of three and the same 130vh of pin would make it race.
  + '@media (prefers-reduced-motion:no-preference) and (max-width:900px) and (min-height:700px){'
  + '#products{height:300vh;padding:0;view-timeline-name:--lxpcT;view-timeline-axis:block}'
  + '#products .lxpc-pin{position:sticky;top:0;height:100vh;height:100dvh;display:flex;'
  + 'flex-direction:column;justify-content:center;overflow:hidden}'
  + '.block#products .lxpc-view .products-grid{animation:lxpc-slide-m linear both;'
  + 'animation-timeline:--lxpcT;animation-range:contain 0% contain 100%}'
  + '#products .lxpc-bar{display:block}'
  + '#products .lxpc-bar>i{animation:lxpc-fill linear both;animation-timeline:--lxpcT;'
  + 'animation-range:contain 0% contain 100%}'
  + '#products .lx-prail{display:none}'
  + '}}'
  + '@keyframes lxpc-slide{from{transform:translateX(0)}'
  + 'to{transform:translateX(calc(-100% - var(--g)))}}'
  // Six cards at 78% of the viewport with five gaps between them is 4.68 viewports of content, of
  // which one viewport is already on screen -- so the row travels 3.68 viewports plus those five
  // gaps. Percentages in translateX resolve against the grid's own width, which is exactly one
  // viewport here, so 368% is that distance and the gaps are added in pixels.
  + '@keyframes lxpc-slide-m{from{transform:translateX(0)}'
  + 'to{transform:translateX(calc(-368% - 5 * var(--g)))}}'
  + '@keyframes lxpc-fill{from{transform:scaleX(0)}to{transform:scaleX(1)}}'


  + '</st' + 'yle>';

const CSS = CSS_RAW.split('.product-card.lxpc').join(P);

const PAGES = [
  { file: 'lumoscore-aptos-desktop.html', key: 'lumoscore-landing.html' },
  { file: 'lumoscore-aptos-mobile.html', key: 'lumoscore-landing-mobile.html' },
];

// ---- the product glyphs -------------------------------------------------------------------------
// The design ships these as 24px Lucide-style monoline icons at stroke-width 1.9, and the card blows
// them up to 46px. A 1.9 stroke drawn for 24px is hairline-thin at 46 and reads as stock clip-art next
// to a lit gradient tile -- which is exactly what RAZA said on 2026-09-28.
//
// These are DUOTONE instead: a filled plate of the same colour at ~24% opacity carrying the silhouette,
// with the detail stroked over it at 1.9-2.1. The weight then comes from an area rather than a line, so
// the glyph keeps its presence at 46px and still resolves at the 36px phone size. Everything is
// `currentColor` (the tile sets `color:#fff`), so each card's own accent keeps driving the tile and
// nothing here needs to know which card it is on.
//
// The LUMOS card is deliberately NOT in this list -- it shows the real token logo, and swapping the
// brand mark for a drawn icon would lose identity rather than gain polish.
const SVG_OPEN = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden="true">';
const ico = (body) => SVG_OPEN + body + '</svg>';
const ICONS = {
  // Trade -- a rising price line over its own area, with the corner arrow that says "up and out".
  dex: ico(
    '<path d="M3.2 16.2L9 10.4L12.6 13.8L20.8 5.6V20H3.2Z" fill="currentColor" opacity=".22"/>'
    + '<path d="M3.2 16.2L9 10.4L12.6 13.8L20.8 5.6" stroke="currentColor" stroke-width="2.1"'
    + ' stroke-linecap="round" stroke-linejoin="round"/>'
    + '<path d="M15.4 5.6h5.4v5.4" stroke="currentColor" stroke-width="2.1"'
    + ' stroke-linecap="round" stroke-linejoin="round"/>'),
  // Liquidity Pools -- the two-coin pair every LP position actually is.
  amm: ico(
    '<circle cx="9" cy="12" r="6.2" fill="currentColor" opacity=".24"/>'
    + '<circle cx="9" cy="12" r="6.2" stroke="currentColor" stroke-width="2"/>'
    + '<circle cx="15" cy="12" r="6.2" stroke="currentColor" stroke-width="2"/>'),
  // Cross-Chain -- interlocking links. The plain double-headed arrow it replaces was the weakest
  // glyph of the six and said nothing a bridge does.
  bridge: ico(
    '<rect x="2.4" y="8.6" width="7.8" height="6.8" rx="3.4" fill="currentColor" opacity=".24"/>'
    + '<path d="M10.2 8.6H5.8a3.4 3.4 0 0 0 0 6.8h4.4" stroke="currentColor" stroke-width="2.1"'
    + ' stroke-linecap="round"/>'
    + '<path d="M13.8 8.6h4.4a3.4 3.4 0 0 1 0 6.8h-4.4" stroke="currentColor" stroke-width="2.1"'
    + ' stroke-linecap="round"/>'
    + '<path d="M8.6 12h6.8" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>'),
  // Rewards -- a coin with a struck star. The gift box it replaces reads as a consumer promo, and the
  // first attempt here (a rimmed coin with a concentric inner ring and a small outboard sparkle) read
  // as a BULLSEYE at 46px -- two concentric circles are a target, whatever you intended, and the
  // sparkle was too small to correct it. Rendered and looked at, which is the only way that shows up.
  // One solid star inside one rim says "reward" with nothing to misread.
  rewards: ico(
    '<circle cx="12" cy="12" r="8.4" fill="currentColor" opacity=".24"/>'
    + '<circle cx="12" cy="12" r="8.4" stroke="currentColor" stroke-width="2"/>'
    + '<path d="M12 7.6L13.15 10.62L16.37 10.78L13.86 12.8L14.7 15.92L12 14.15L9.3 15.92'
    + 'L10.15 12.8L7.63 10.78L10.85 10.62Z" fill="currentColor"/>'),
  // Launchpad -- the rocket kept, but redrawn with a solid body so it has mass at 46px.
  launchpad: ico(
    '<path d="M12 2.4c2.9 2.5 4.5 5.8 4.5 9.4 0 1.5-.3 2.9-.8 4.2H8.3a11.6 11.6 0 0 1-.8-4.2'
    + 'c0-3.6 1.6-6.9 4.5-9.4Z" fill="currentColor" opacity=".24"/>'
    + '<path d="M12 2.4c2.9 2.5 4.5 5.8 4.5 9.4 0 1.5-.3 2.9-.8 4.2H8.3a11.6 11.6 0 0 1-.8-4.2'
    + 'c0-3.6 1.6-6.9 4.5-9.4Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'
    + '<circle cx="12" cy="10.1" r="2.1" stroke="currentColor" stroke-width="1.9"/>'
    + '<path d="M7.7 12.9L4.9 15.7a2 2 0 0 0-.6 1.4v2.3l3.6-1.8M16.3 12.9l2.8 2.8a2 2 0 0 1 .6 1.4v2.3'
    + 'l-3.6-1.8" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"'
    + ' stroke-linejoin="round"/>'
    + '<path d="M10.5 18.7c0 1.5.6 2.7 1.5 3.3.9-.6 1.5-1.8 1.5-3.3" stroke="currentColor"'
    + ' stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>'),
};

const problems = [];
const staged = [];

for (const p of PAGES) {
  const data = read(p.file);
  const { json, s, e } = getContents(data);
  let html = json[p.key];
  if (html == null) { problems.push(p.key + ': missing'); continue; }

  html = html.replace(/<style id="lx-prodcards-css">[\s\S]*?<\/style>/g, '');
  html = html.split(ORB).join('');
  if (html.indexOf('lxpc-orb') >= 0) { problems.push(p.key + ': an orbit span survived the strip'); continue; }
  html = unwrap(html, PIN_OPEN, 'div');
  html = unwrap(html, VIEW_OPEN, 'div');
  html = drop(html, '<div class="lxpc-bar"', 'div');
  if (html.indexOf('lxpc-pin') >= 0 || html.indexOf('lxpc-view') >= 0 || html.indexOf('lxpc-bar') >= 0) {
    problems.push(p.key + ': a carousel wrapper survived the strip'); continue;
  }

  // One orbit span per card, immediately inside the anchor so it paints behind everything else in it.
  const MARK = 'class="product-card lxpc"';
  let at = 0, added = 0;
  while (true) {
    const found = html.indexOf(MARK, at);
    if (found < 0) break;
    const close = html.indexOf('>', found);
    if (close < 0) { problems.push(p.key + ': unterminated card tag'); break; }
    html = html.slice(0, close + 1) + ORB + html.slice(close + 1);
    at = close + 1 + ORB.length;
    added++;
  }
  if (added !== 6) { problems.push(p.key + ': expected 6 product cards, found ' + added); continue; }

  // The sliding row needs a box that clips it and a box that stays still while the page scrolls past.
  // .lxpc-view goes around the grid, .lxpc-pin around everything inside the section.
  const gb = bounds(html, '<div class="products-grid">', 'div');
  if (!gb) { problems.push(p.key + ': products grid not found'); continue; }
  html = html.slice(0, gb.at) + VIEW_OPEN + html.slice(gb.at, gb.end) + '</div>' + BAR + html.slice(gb.end);

  const sb = bounds(html, '<section class="block" id="products"', 'section');
  if (!sb) { problems.push(p.key + ': products section not found'); continue; }
  const sOpen = html.indexOf('>', sb.at) + 1;
  const sClose = sb.end - '</section>'.length;
  html = html.slice(0, sOpen) + PIN_OPEN + html.slice(sOpen, sClose) + '</div>' + html.slice(sClose);

  // Swap the five drawn glyphs. Replacing the tile's CONTENTS rather than inserting alongside them is
  // what keeps this idempotent -- a second run overwrites the same span instead of stacking a second
  // svg, which is the failure mode every transform here has to be written against. Each key must hit
  // exactly once: 0 means the design's markup moved, 2 means the selector is too loose, and either way
  // guessing is worse than stopping.
  let swapped = 0, iconBad = false;
  for (const key of Object.keys(ICONS)) {
    const re = new RegExp('(<div class="ic-prod ' + key + '"[^>]*>)[\\s\\S]*?(</div>)', 'g');
    const hits = html.match(re);
    if (!hits || hits.length !== 1) {
      problems.push(p.key + ': ic-prod ' + key + ' matched ' + (hits ? hits.length : 0) + ' time(s), expected 1');
      iconBad = true; continue;
    }
    html = html.replace(re, '$1' + ICONS[key] + '$2');
    swapped++;
  }
  if (iconBad) continue;
  if (swapped !== 5) { problems.push(p.key + ': swapped ' + swapped + ' icons, expected 5'); continue; }
  // The LUMOS tile must still be carrying the real token logo, not a drawn glyph.
  if (html.indexOf('ic-prod wallet lx-ic-logo') < 0 || html.indexOf('/assets/tokens/lumos.png') < 0) {
    problems.push(p.key + ': the LUMOS card lost its token logo'); continue;
  }

  const bo = html.lastIndexOf('</body>');
  html = bo >= 0 ? html.slice(0, bo) + CSS + html.slice(bo) : html + CSS;

  json[p.key] = html;
  staged.push({ file: p.file, data, s, e, json, key: p.key, added });
}

if (problems.length) {
  console.error('product cards: ABORT — nothing written.');
  problems.forEach((x) => console.error('  ' + x));
  process.exit(1);
}
for (const st of staged) {
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.key + ': ' + st.added + ' cards restyled, orbits added');
}
console.log('product cards: done on ' + staged.length + ' page(s)');
