// Products section: turn the volume down.
//
// _prodcards.js gives every card a gradient glowing edge, an outer glow, a lit icon plate with its
// own 42px glow AND a radial bloom under it, a glowing CTA pill, and a decorative orbit: two rings
// counter-rotating on 26s and 18s infinite animations with a lit dot on each. That is, per card,
// TWO infinite animations and FOUR separate coloured glows. It reads well as one hero card in a
// carousel where you see three at a time. Six of them at once on a static grid is a lot of light,
// and the eye has nowhere to rest -- everything on the tile is competing to be the brightest thing
// on it, so nothing reads as primary.
//
// This strips the decoration back to the information: icon, name, sentence, link. The per-card
// accent (--pc / --pc-rgb) SURVIVES and still does all the colour-coding -- it just stops being
// expressed as four light sources and becomes one tinted plate plus a coloured link. What goes is
// the glow, not the colour.
//
// Concretely:
//   * the orbit rings are removed outright (also 12 fewer infinite animations on the page)
//   * the gradient border becomes a hairline that picks up the card's accent on hover only
//   * the card's outer glow goes; hover is a faint tint and a 1px border change
//   * the icon plate drops from 84px to 60px, keeps its accent as a flat tint, loses both glows
//   * the CTA stops being a glowing bordered pill and becomes a plain coloured link with its arrow
//   * card content goes left-aligned, matching the rest of the page's axis
//
// NOT GATED BY WIDTH. The carousel is still the mobile layout and it should be quieter too -- the
// complaint is about the treatment, not the arrangement, and a phone showing one lit card at a time
// is the case where four glows on one tile is most overwhelming, not least.
//
// SPECIFICITY, AND THIS IS WORTH READING BEFORE EDITING A SELECTOR HERE.
//
// _prodcards.js does not write the selectors its source lines appear to write. Reading the file
// they look like `.product-card.lxpc .ic-prod`, but they are all built from a constant at its
// line 99 -- `const P = '.block#products .product-card.lxpc'` -- so what is actually emitted is
// `.block#products .product-card.lxpc ...`, ONE ID AND THREE CLASSES, (1,3,0). Its own comment
// two lines above even says "(1,2,0)", miscounting its own selector.
//
// The first version of this file was written against the source as it reads, prefixed `#products`
// for a (1,2,0), and lost every single contest -- the built page still showed the 84px lit icon,
// all four glows, the gradient border and centred text. The ONE rule that worked was the orbit,
// and only because `... .lxpc-orb` carried an extra element that pushed it over the line. A
// stylesheet that is present, matching, and silently outranked looks exactly like a stylesheet
// that was never injected.
//
// So every selector is built from S below: `.block#products .products-grid .product-card.lxpc`,
// (1,4,0), which beats (1,3,0) on specificity alone and therefore does not depend on this file
// being injected after _prodcards.js. `.products-grid` is the cards' direct parent in both the
// desktop grid and the mobile carousel, checked on the built page at 1440 and at 375.
//
// Re-injects: strips its own stylesheet (/g) before writing. Writes no markup.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// (1,4,0) -- see the note above. Every rule in this file hangs off it.
const S = '.block#products .products-grid .product-card.lxpc';

const CSS = '<style id="lx-prodcalm">'

  // ---- 1. THE ORBIT GOES --------------------------------------------------------------------
  // Two counter-rotating rings with a glowing dot on each, per card. `display:none` rather than
  // opacity or visibility so the animations stop running as well as stop showing -- twelve infinite
  // CSS animations on a landing page is a real cost on a phone, and they are purely decorative.
  // The span stays in the markup (it is _prodcards.js's to write) and is aria-hidden already.
  + S + ' .lxpc-orb{display:none}'

  // ---- 2. THE CARD --------------------------------------------------------------------------
  // The gradient edge is the two-background trick: a transparent border with the fill painted to
  // padding-box and the gradient to border-box. Undoing it needs BOTH halves -- a plain
  // `border-color` would do nothing, because the colour is coming from the background layer, and a
  // plain `background` would leave a transparent border showing whatever is behind the card. So the
  // background is reset to a single flat fill and the border given a real colour.
  + S + '{background:var(--surface);background-image:none;'
  + 'border:1px solid var(--border);box-shadow:none;'
  + 'transition:border-color .22s ease,background-color .22s ease}'
  // Hover is a border and a whisper of the card's own accent, not a lift and a glow. No transform:
  // a translateY on a grid tile pulls its bottom edge out from under a pointer resting there, which
  // flickers -- the same trap the Why cards were written around.
  + S + ':hover{border-color:rgba(var(--pc-rgb,234,106,44),.45);'
  + 'background-color:rgba(var(--pc-rgb,234,106,44),.045);transform:none;box-shadow:none}'

  // ---- 3. THE ICON --------------------------------------------------------------------------
  // 60px, flat, tinted with the card's accent instead of filled with it and lit from behind. The
  // ::after was a radial bloom on the floor of the plate; it goes with the rest.
  + S + ' .ic-prod{width:60px;height:60px;border-radius:15px;'
  + 'margin:0 0 18px;box-shadow:none;background:rgba(var(--pc-rgb,234,106,44),.13);'
  + 'border:1px solid rgba(var(--pc-rgb,234,106,44),.26);'
  + 'color:rgb(var(--pc-rgb,234,106,44));transition:none;transform:none}'
  + S + ' .ic-prod::after{display:none}'
  + S + ' .ic-prod>svg{width:28px;height:28px}'
  + S + ':hover .ic-prod{transform:none;box-shadow:none}'
  // The LUMOS card's icon is a bitmap of the flame rather than a glyph, and _prodcards.js already
  // special-cases it with background:none. Keep that -- a tinted plate behind a full-bleed logo
  // would frame it in a colour it does not use.
  + S + ' .ic-prod.lx-ic-logo{background:none;border:0;box-shadow:none;'
  + 'border-radius:0}'
  + S + ' .ic-prod.lx-ic-logo::after{display:none}'

  // ---- 4. THE LINK --------------------------------------------------------------------------
  // A bordered, glowing, centred pill is a button, and these are not buttons -- the whole card is
  // already the link. So it reads as what it is: the card's accent, the label, the arrow.
  + S + ' .lx-pc-cta{align-self:flex-start;margin:auto 0 0;padding:0;'
  + 'border:0;background:none;box-shadow:none;border-radius:0;'
  + 'color:rgb(var(--pc-rgb,234,106,44));font-weight:700;'
  + 'transition:gap .22s ease,opacity .22s ease;display:inline-flex;align-items:center;gap:7px}'
  + S + ':hover .lx-pc-cta{gap:11px;transform:none;box-shadow:none}'
  + '[data-theme="light"] ' + S + ' .lx-pc-cta{color:#bd4e19}'

  // ---- 5. THE AXIS --------------------------------------------------------------------------
  // Left, like the section head above it and every other section on the page now. Centring six
  // short paragraphs gives every line two ragged edges and no rail for the eye to run down.
  + S + '{text-align:left;align-items:flex-start}'
  + S + ' h3{text-align:left;font-size:20px;letter-spacing:-.3px;'
  + 'margin:0 0 8px}'
  + S + ' p{text-align:left;margin-left:0;margin-right:0;max-width:44ch;'
  + 'font-size:15px;line-height:1.62;color:var(--text-muted)}'

  + '@media (prefers-reduced-motion:reduce){'
  + S + ',#products .product-card.lxpc .lx-pc-cta{transition:none}}'

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

  html = html.replace(/<style id="lx-prodcalm">[\s\S]*?<\/style>/g, '');

  // Every selector here is `.product-card.lxpc`; if that class pair is gone the stylesheet matches
  // nothing and says so silently, which on a page this size is hard to notice.
  const n = (html.match(/class="product-card lxpc"/g) || []).length;
  if (n !== 6) { problems.push(p.key + ': expected 6 .product-card.lxpc, found ' + n); continue; }
  if (html.indexOf('lxpc-orb') < 0) { problems.push(p.key + ': no .lxpc-orb to quiet'); continue; }

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
  staged.push({ file: p.file, data, s, e, json, key: p.key, n });
}

if (problems.length) {
  console.error('prod-calm: ABORT - nothing written.');
  problems.forEach(x => console.error('  ' + x));
  process.exit(1);
}
for (const st of staged) {
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.key + ': ' + st.n + ' cards de-glowed (orbits off, 1 tint replaces 4 glows)');
}
console.log('prod-calm: done on ' + staged.length + ' page(s)');
