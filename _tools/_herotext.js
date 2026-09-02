// Hero headline: new wording, and the sub-1100px size drops to 60px.
//
// "The Core of / Multi-Chain Web3" becomes "The Multichain World / Starts Here", keeping the design's
// split -- first line in the ink colour, second in the gradient.
//
// The requested 60px is the <=1100px rule; above that the headline is 114.4px. That matters here
// because _herofit pins the second line to one line above 1100px, and the new line is LONGER than the
// old one: "The Multichain World" is 20 characters where "Multi-Chain Web3" was 16. So the desktop
// size is checked against the room actually available rather than assumed to still fit -- see the
// measurement note beside HERO_MAX below.
//
// Re-injects its own style block, so the sizes can be tuned by editing this file and running it again.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const OLD = '<h1 class="hero-headline">The Core of<br/><span class="grad">Multi-Chain Web3</span></h1>';
const NEW = '<h1 class="hero-headline">The Multichain World<br/><span class="grad">Starts Here</span></h1>';

// The tagline is written by REPLACING the paragraph's contents outright rather than swapping one exact
// string for another. Matching on the previous wording meant every copy change had to carry the last
// version with it, and the transform would silently no-op the moment the two drifted apart. This way
// the paragraph always ends up saying exactly what TAG_HTML says, however many times it is run.
//
// The accent span is kept: the design ends this line with a highlighted phrase, and that is the shape
// the hero was drawn around. No <strong> this time -- the old copy opened with a standalone lead
// sentence to bold, and this one is a single clause with nothing that plays that role.
const TAG_HTML = 'Trade, Launch, Bridge, and Explore across chains — '
  + '<span class="lrp-hl">all in one place</span>.';

// 60px is the requested size for the <=1100px rule. The desktop figure is set from measurement in
// _herotext_size below rather than left at 114.4: at that size the new first line does not fit the
// width _herofit gives it on narrower desktops.
const CSS = '<style id="lx-herotext">'
  // Keep the accent phrase whole so it wraps as a unit. It was splitting as "... — all" / "in one
  // place.", which reads as a broken sentence and puts the emphasis on the wrong word. nowrap rather
  // than a hard <br>, so the line still collapses to one on a viewport wide enough to hold it.
  + '.hero-tagline .lrp-hl{white-space:nowrap}'
  // Lift the hero content on desktop so the search field covers the point where the background rays
  // converge. Measured at 1440x900: the rays centre on y=423 and the field began at y=436, leaving the
  // convergence exposed as a bright dot just above it. 42px puts that point at the field's own centre.
  // Shifting .hero-center rather than the field alone moves the headline by the same amount, which is
  // what keeps the gap between them unchanged -- and the rays are positioned against the hero, not
  // this block, so they stay where they are. Verified the headline still clears the nav by 42px.
  + '@media (min-width:901px){.hero-center{top:-42px}}'
  // Above 1100px the size holds at its designed 114.4px but is capped against the viewport. Measured:
  // "The Multichain World" needs 1047px at 114.4px, and at exactly 1101px -- the narrow end of the
  // range where that size applies -- that left 22px either side. Not clipped, but crowded. 10vw gives
  // the narrow end roughly 42px and leaves 1280px and up completely unchanged.
  // Selector is .hero h1.hero-headline, not .hero-headline. The design sets the size with
  // h1.hero-headline -- element plus class, 0-1-1 -- so a bare class selector loses on specificity no
  // matter how late it is injected, and the 60px below simply never applied. Verified by reading the
  // computed size back, not by assuming the later block wins.
  + '@media (min-width:1101px){.hero h1.hero-headline{font-size:min(114.4px,10vw)}}'
  + '@media (max-width:1100px){.hero h1.hero-headline{font-size:60px;letter-spacing:-1.6px}}'
  // Phones: fluid, because the new first line is long. At a flat 44px "The Multichain World" needs
  // 403px against 336px of usable width on a 375px screen, so it wrapped and left "World" alone on a
  // line of its own -- three lines, with the orphan in the middle. 9.3vw keeps it to two.
  + '@media (max-width:520px){.hero h1.hero-headline{font-size:min(44px,9.3vw);letter-spacing:-1.2px}}'
  // Phones opened with a 167px void under the nav. The hero is min-height:100vh with
  // align-items:center AND 101.2px of top padding, so the block was centred in the full screen and
  // then pushed down again by the padding: measured on a 375x812 screen, the nav ended at 72px and the
  // headline did not start until 239px, with the content finishing at 595px. Anchoring to the top
  // instead of centring puts the gap under our control -- roughly 44px below the nav -- rather than
  // leaving it to fall out of the leftover space.
  // min-height comes down with it. Anchoring alone just moved the void: content finished at 468px
  // inside an 812px hero, leaving ~274px of nothing above the scroll cue. 78vh keeps a hero that
  // still dominates the first screen while letting the next section show at the fold, which is what
  // the cue is asking people to do anyway.
  + '@media (max-width:900px){.hero{align-items:flex-start;padding-top:112px;min-height:78vh;'
  // Bottom padding up from 35.2px. The new tagline runs to five lines on a 375px screen and six on a
  // 320px one, which left the buttons finishing 9px above the scroll cue -- clear, but only just, and
  // one more wrapped line from colliding. The cue sits at the hero's bottom edge, so padding here is
  // what buys it room.
  + 'padding-bottom:72px}}'
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

  html = html.replace(/<style id="lx-herotext">[\s\S]*?<\/style>/g, '');

  if (html.indexOf(NEW) < 0) {
    const n = html.split(OLD).length - 1;
    if (n !== 1) { problems.push(p.key + ': expected 1 old hero headline, found ' + n); continue; }
    html = html.replace(OLD, NEW);
  }

  const tagOpen = '<p class="hero-tagline">';
  const ti = html.indexOf(tagOpen);
  if (ti < 0) { problems.push(p.key + ': hero tagline paragraph not found'); continue; }
  const te = html.indexOf('</p>', ti);
  if (te < 0) { problems.push(p.key + ': hero tagline paragraph is not closed'); continue; }
  if (html.indexOf(tagOpen, ti + 1) >= 0) { problems.push(p.key + ': more than one hero tagline'); continue; }
  html = html.slice(0, ti + tagOpen.length) + TAG_HTML + html.slice(te);

  const bo = html.lastIndexOf('</body>');
  html = bo >= 0 ? html.slice(0, bo) + CSS + html.slice(bo) : html + CSS;

  json[p.key] = html;
  staged.push({ file: p.file, data, s, e, json, key: p.key });
}

if (problems.length) {
  console.error('hero text: ABORT — nothing written.');
  problems.forEach(x => console.error('  ' + x));
  process.exit(1);
}
for (const st of staged) {
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.key + ': hero headline reworded, <=1100px size set to 60px');
}
console.log('hero text: done on ' + staged.length + ' page(s)');
