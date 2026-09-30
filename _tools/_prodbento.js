// Products section: pinned horizontal carousel -> static 3x2 grid, desktop only.
//
// WHY. The six product cards were laid out as a scroll-pinned horizontal carousel: #products is
// 230vh tall, .lxpc-pin sticks to the viewport, and a CSS view-timeline slides .products-grid left
// as you scroll through that 230vh. It is a genuinely nice piece of work -- no JS, no autoplay, and
// a progress rail that is a readout of the same timeline rather than a decoration moving at a
// similar speed.
//
// It also means that at rest the page shows THREE of the six products and the other three are
// off-screen. The section that exists to tell a first-time visitor what LumosCore is shows half of
// it, and the half it shows is whichever three happen to be leftmost. A landing page's first still
// frame is what a shared link preview, a thumbnail and a skimming reader all get.
//
// So the layout changes and NOTHING ELSE DOES. Every card keeps its per-card accent (--pc/--pc-rgb),
// its gradient edge, its lit icon tile with the orbit pair behind it and its pill CTA -- all of that
// was built to reference shots RAZA supplied on 2026-09-28 and none of it is the problem. This
// transform writes no markup at all; it is a stylesheet that re-places six existing cards.
//
// ---------------------------------------------------------------------------------------------
// WHY THIS IS A PLAIN 3x2 AND NOT A BENTO. Two earlier versions of this file were asymmetric, and
// both failed the same way, which is worth writing down so it is not tried a third time.
//
//   v1: Trade and Cross-Chain as 2x2 tiles. Doubling a tile's HEIGHT does not double its content --
//       each card has one sentence -- so a three-line description and a pill ended up floating in a
//       629px box with ~155px of nothing above and below. Centring the block made the emptiness
//       symmetric instead of removing it. The section came out 1442px tall to say six short things.
//
//   v2: Trade and Cross-Chain one row tall but two columns wide, re-laid horizontally (icon beside
//       the text). Better -- the width was genuinely used -- but the row height is set by the
//       TALLEST tile in it, and the tall ones are the narrow stacked cards. Measured: the wide tiles
//       still carried 155px of slack above and 135px below, because their horizontal content is
//       ~124px tall in a 414px row. An asymmetric grid of cards that all hold the same amount of
//       text cannot avoid this; the slack just moves.
//
// The honest encoding is that these six ARE peers. Trade is not more important to a first-time
// reader than Cross-Chain, and none of them has more to say than the others. Six equal tiles, three
// across, two down: no cell is bigger than its content, so no cell has a void in it.
//
// Equal-width tiles are also SHORTER. At a 1280px container three columns is a ~413px tile against
// the ~287px a four-column row gave, and the descriptions drop from four lines to two or three. The
// vertical furniture is tightened with it (below), and between them the section goes from 2300px
// pinned -> 1442 (v1) -> 1194 (v2) -> ~1000.
//
// This is the "three equal columns" shape that is usually a generated-layout tell, and the reason it
// is right here and wrong there is the content: that pattern is a tell when three cards are made
// equal to pad out a feature ROW. This is a six-item grid of actual peer products, where equal
// treatment is what is true.
// ---------------------------------------------------------------------------------------------
//
// DESKTOP ONLY, and the gate matters. Below 900px _landingproducts.js turns .products-grid into a
// native touch scroller (scroll-snap, bled to the screen edges with margin:0 -20px) and
// _prodcards.js's own header records a 2.4px horizontal-overflow bug on handsets that was tracked
// down to exactly that bleed and fixed with `overflow-x:clip` on the section. A grid at phone width
// is a single column anyway -- there is nothing to gain there and a fixed overflow bug to lose.
//
// SPECIFICITY, NOT ORDER. Every selector is written `.block#products ...` (1,2,0) so it beats
// _prodcards.js's `#products ...` (1,1,0) wherever this stylesheet ends up sitting. The section
// really does carry class="block" and id="products" -- checked on the built page, not assumed.
//
// Re-injects: strips its own stylesheet (/g, so a page that ever held two copies does not keep one)
// before writing. Writes no markup, so there is nothing else to undo.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const COLS = 3;
const CARDS = 6;

const CSS = '<style id="lx-prodbento">'
  + '@media (min-width:901px){'

  // ---- UNDO THE PIN -------------------------------------------------------------------------
  // The 230vh section height IS the scroll distance the timeline runs over; with the section back
  // to its own content height there is no distance left and the animation has nothing to drive it.
  // `animation:none` is still set explicitly rather than left implied -- a timeline that never
  // advances would otherwise park the grid at the `from` keyframe, which happens to be
  // translateX(0), and relying on a keyframe's start value being the identity is the kind of thing
  // that stops being true the next time someone edits the keyframes.
  + '.block#products{height:auto;min-height:0;padding:88px 0 96px;view-timeline-name:none}'
  + '.block#products .lxpc-pin{position:static;height:auto;min-height:0;display:block}'
  // .lxpc-view was the carousel's window: overflow:hidden with a -36px margin/padding pair so the
  // cards' glow could bleed without being clipped. With nothing sliding there is nothing to clip,
  // and `visible` lets the tiles keep their box-shadow.
  + '.block#products .lxpc-view{overflow:visible;padding:0;margin:0}'
  // The progress rail is a readout of a timeline that no longer exists.
  + '.block#products .lxpc-bar{display:none}'

  // ---- THE GRID -----------------------------------------------------------------------------
  // grid-auto-rows is `auto`, NOT a minmax with a floor. A 196px floor in an earlier version was
  // propping every row open to a height the content had not asked for -- the same mistake as the
  // 2x2 tiles, in smaller print. Rows are exactly as tall as the tallest card in them, and with
  // every card the same shape that is as tall as the longest description needs.
  //
  // grid-auto-flow:row IS LOAD-BEARING AND MUST BE STATED. The carousel sets
  // `grid-auto-flow:column` -- that is how it gets six cards onto one line to slide them. Leaving
  // it alone does not give three columns of two: it gives SIX columns, three explicit ones computed
  // to 0px and three implicit ones holding the cards, each tile 50px wide and 754px tall. Earlier
  // versions of this file happened to set `dense`, which overrides `column` as a side effect and
  // hid the dependency; this one says `row` on purpose.
  + '.block#products .products-grid{display:grid;grid-auto-flow:row;'
  + 'grid-template-columns:repeat(' + COLS + ',minmax(0,1fr));grid-auto-rows:auto;gap:20px;'
  + 'animation:none;transform:none;overflow:visible;width:auto;max-width:none;'
  + 'padding:0;margin:0;scroll-snap-type:none}'
  // The cards were flex items sized `flex:0 0 82%` for the scroller. In a grid that basis fights the
  // track, so it is cleared; min-width:0 keeps a long word from forcing a tile wider than its column.
  // No per-card grid-column/grid-row: with six equal cards in three tracks, source order IS the
  // layout, and explicit placement would be six more things to keep in step for no gain.
  + '.block#products .products-grid>.product-card{flex:none;width:auto;min-width:0;max-width:none;'
  + 'scroll-snap-align:none;grid-column:auto;grid-row:auto}'

  // ---- TIGHTEN THE VERTICAL FURNITURE -------------------------------------------------------
  // Measured on the 287px-wide version, a card was 413px tall and broke down as: 62 padding +
  // 104 icon + 26 + 33 title + 12 + 106 text + 26 + 43 pill. The icon plate and the paddings were
  // sized for a card that had a whole viewport to itself in the carousel; in a grid of six they are
  // the reason the section is taller than it needs to be. Trimming the plate to 84 and easing the
  // paddings takes ~60px off every tile without touching the card's composition.
  + '.block#products .products-grid>.product-card{padding:28px 24px 26px}'
  + '.block#products .products-grid>.product-card .ic-prod{width:84px;height:84px;margin-bottom:20px}'
  + '.block#products .products-grid>.product-card h3{margin-bottom:10px}'
  + '.block#products .products-grid>.product-card p{margin-bottom:22px}'
  // A measure on the description. At ~413px of tile the line length is comfortable, but a short
  // description in a wide tile can end up as one long line and one orphan word.
  + '.block#products .products-grid>.product-card p{max-width:38ch;margin-left:auto;margin-right:auto;'
  + 'text-wrap:pretty}'

  // Below ~1180 three columns of the container is a narrow tile again, so it drops to two. Still
  // every tile the same shape, still no gaps -- six is divisible by two as well as by three, which
  // is the other reason a symmetric grid is the right call for this many cards.
  + '@media (max-width:1180px){'
  + '.block#products .products-grid{grid-template-columns:repeat(2,minmax(0,1fr))}'
  + '.block#products{padding:76px 0 84px}'
  + '}'

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

  html = html.replace(/<style id="lx-prodbento">[\s\S]*?<\/style>/g, '');

  // The selectors are worthless if the section is not shaped the way they assume, and a stylesheet
  // that silently matches nothing is exactly the failure mode that is hard to spot on a page this
  // size. Check the three things every rule depends on.
  if (!/<section class="block" id="products"/.test(html)) {
    problems.push(p.key + ': products section is not <section class="block" id="products">');
  }
  if (html.indexOf('class="products-grid"') < 0) {
    problems.push(p.key + ': no .products-grid');
  }
  const cards = (html.match(/class="product-card lxpc"/g) || []).length;
  if (cards !== CARDS) {
    problems.push(p.key + ': expected ' + CARDS + ' product cards, found ' + cards);
  }
  // Six into three and into two with nothing left over is what lets this drop a column without
  // leaving a half-empty last row. A seventh card would need that decision made again.
  if (cards % COLS !== 0 || cards % 2 !== 0) {
    problems.push(p.key + ': ' + cards + ' cards do not divide evenly into ' + COLS + ' or 2 columns');
  }
  if (problems.length) continue;

  // INTO <head>, NOT THE END OF <body>, and this is a flash fix rather than tidiness. These rules
  // restyle the hero -- headline size, and the two-column grid it sits in -- so a browser that
  // paints before the parser reaches an end-of-body <style> shows the ORIGINAL headline first and
  // then jumps to this one. That is the flash visible on reload, right on "Many networks. / One
  // Core.". Every other transform that ships CSS for this page puts it in <head> (see the
  // `</head>` replace in _launchpad.js); these four were the exception.
  //
  // GUARDRAILS B calls a visible swap during load a flash bug and makes catching it mandatory. It
  // was missed here because it was measured as layout-shift inside the hidden browser pane, which
  // does not paint on the same schedule -- CLS 0 there is not evidence of no flash on a real load.
  //
  // Source order drops with the move, so every rule in this file is written to win on SPECIFICITY
  // rather than on position; the computed sizes are re-checked on the built page after the change.
  // INJECTED AT THE END OF <body>, LIKE EVERY OTHER LAYER -- and deliberately not into <head>.
  // _externalize.js hoists every lx-* stylesheet into <head> on each build, as a group and in the
  // order it finds them, so injecting here is what keeps this layer in its NATURAL position in the
  // cascade relative to the layers it has to override.
  //
  // Injecting into <head> directly was tried first and is worse: this block then lands ahead of
  // every layer that still injects at end-of-body, i.e. it becomes the weakest instead of the
  // strongest. That silently cost two rules their overrides -- .lxu-cue reverted to 40px and the FAQ
  // heading re-centred -- and those were only the two that happened to be noticed.
  const bo = html.lastIndexOf('</body>');
  html = bo >= 0 ? html.slice(0, bo) + CSS + html.slice(bo) : html + CSS;

  json[p.key] = html;
  staged.push({ file: p.file, data, s, e, json, key: p.key, cards });
}

if (problems.length) {
  console.error('prod-bento: ABORT - nothing written.');
  problems.forEach(x => console.error('  ' + x));
  process.exit(1);
}
for (const st of staged) {
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.key + ': ' + st.cards + ' cards unpinned into a '
    + COLS + 'x' + (st.cards / COLS) + ' grid (desktop only)');
}
console.log('prod-bento: done on ' + staged.length + ' page(s)');
