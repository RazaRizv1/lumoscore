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

// Remove one element and everything inside it, by walking tag depth.
//
// This replaces the regex strip the networks block used to get. A non-greedy "...</div>" cannot know
// where an element ends: against nested markup it stops at the first inner close and leaves the outer
// one loose, and a pattern written to catch the nested form instead runs PAST a flat block until it
// finds a match somewhere else entirely -- which is how one run swallowed the hero's CTA row. Depth
// counting has neither failure mode, and it means the block's markup can nest freely.
function cutElement(html, openMarker, tag) {
  let out = html;
  for (let guard = 0; guard < 20; guard++) {
    const at = out.indexOf(openMarker);
    if (at < 0) return out;
    const re = new RegExp('<' + tag + '\\b|</' + tag + '>', 'g');
    re.lastIndex = at;
    let depth = 0, m, end = -1;
    while ((m = re.exec(out))) {
      if (m[0].charAt(1) === '/') { depth--; if (depth === 0) { end = m.index + m[0].length; break; } }
      else depth++;
    }
    if (end < 0) return out;
    out = out.slice(0, at) + out.slice(end);
  }
  return out;
}

// Written by replacing the h1's contents outright, for the same reason the tagline is: matching the
// previous wording means every reword has to carry the last one with it, and the run aborts (or worse,
// silently no-ops) the moment they drift. The <br/> and the gradient span are part of the design's
// two-line treatment, so they are re-emitted rather than left to whatever was there.
// The headline IS the sentence now. "The Multi-chain World Starts Here" and the tagline underneath it
// were the same claim twice, once as a slogan and once in plain terms, and the slogan carried almost
// no query surface for a page the SEO work cares about. The tagline element is removed with it.
//
// The break is chosen, not left to wrapping, and it splits the sentence at its own hinge: the list of
// verbs, then the claim. That gives the design's original shape back -- a long line in ink over a
// short accented one, which is what "The Multi-chain World / Starts Here" was. The dash ends line one
// deliberately here; the thing to avoid is a dash left dangling by a wrap it did not intend.
//
// The space before the <br/> is load-bearing. Phones hide the break and let the text wrap itself, and
// without one an earlier version ran two words together. A trailing space before a line break
// collapses, so desktop is unaffected.
const HEAD_HTML = 'Trade, Launch, Bridge, and Explore — <br/>'
  + '<span class="grad">All in one place.</span>';

// ---- the networks line, between the tagline and the buttons.
// Marks come from _netlogos.json, the same file the section further down the page uses, so the hero
// and that section cannot drift apart. Labelled XRPL rather than the file's "XRP Ledger", which is
// what the rest of the landing copy calls it.
//
// This states what runs where, so the claims are held to what is actually true: Stellar is live,
// XRPL is not, and nothing else is named. "More upcoming" gets a neutral mark rather than a logo
// because there is no third chain to put a logo to yet.
const NETLOGOS = require(__dirname + '/_netlogos.json');
const MORE_MARK = '<svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">'
  + '<circle cx="16" cy="16" r="16" fill="currentColor" opacity=".14"/>'
  + '<circle cx="9.5" cy="16" r="2" fill="currentColor"/><circle cx="16" cy="16" r="2" fill="currentColor"/>'
  + '<circle cx="22.5" cy="16" r="2" fill="currentColor"/></svg>';

// ONE capsule, divided by hairlines -- not three separate pills, and not a loose inline list.
//
// Both earlier attempts failed the same way. Loose text at three sizes read as debris. Equal-width
// pills were symmetrical as boxes but not as an image: each pill centred its own contents, so the
// three logos landed at three unrelated offsets and the eye had nothing to line up on. Sizing the
// cells to their content inside a single bordered bar fixes that by construction -- there is one
// outline, one baseline, one rhythm of dividers, and the logos sit at the same height with equal
// padding either side of every rule.
//
// It also matches the search field directly above it: the hero now reads bar, bar, buttons.
function netPill(mark, label, extraClass) {
  return '<span class="lx-hnet' + (extraClass ? ' ' + extraClass : '') + '">'
    + '<i class="lx-hnet-m">' + mark + '</i>'
    + '<b class="lx-hnet-t">' + label + '</b></span>';
}

const NETS_HTML = '<div class="lx-heronets" data-lxnonav="1">'
  + '<span class="lx-heronets-l">Networks</span>'
  + '<div class="lx-hnetbar">'
  + netPill(NETLOGOS[0].logo, 'Stellar', 'is-live')
  + netPill(NETLOGOS[1].logo, 'XRPL')
  + netPill(MORE_MARK, 'More upcoming', 'is-more')
  + '</div></div>';

// 60px is the requested size for the <=1100px rule. The desktop figure is set from measurement in
// _herotext_size below rather than left at 114.4: at that size the new first line does not fit the
// width _herofit gives it on narrower desktops.
const CSS = '<style id="lx-herotext">'
  // ---- the scroll cue, on both layouts. It was a 11.6px muted label above a bare 22px chevron, which
  // is the one thing on the first screen asking for an action and looked like a caption. The chevron
  // becomes a real target -- a bordered disc on the card surface that drifts down and back, hinting
  // the direction rather than just pointing -- and the label gets the weight and tracking of the other
  // small caps on the page. Colour alone does not carry the hover: the disc takes the accent border
  // and a lift as well.
  + '.scroll-hint{gap:12px}'
  + '.scroll-hint>span:first-child{font-size:12px;font-weight:700;letter-spacing:.14em;'
  + 'color:var(--text-soft);transition:color .2s ease}'
  + '.scroll-hint .arrow{width:40px;height:40px;border-radius:999px;display:inline-flex;'
  + 'align-items:center;justify-content:center;border:1px solid var(--border);'
  + 'background:var(--surface);color:var(--text-soft);'
  + 'transition:border-color .2s ease,color .2s ease,box-shadow .2s ease,background .2s ease;'
  + 'animation:lxcuebob 2.6s ease-in-out infinite}'
  + '.scroll-hint .arrow svg{width:16px;height:16px}'
  + '.scroll-hint:hover>span:first-child{color:var(--text)}'
  + '.scroll-hint:hover .arrow{border-color:var(--accent);color:var(--accent);'
  + 'box-shadow:0 12px 26px -14px rgba(234,106,44,.85);animation-play-state:paused}'
  + '.scroll-hint:focus-visible .arrow{outline:2px solid var(--accent);outline-offset:3px}'
  + '@keyframes lxcuebob{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}'
  + '@media (prefers-reduced-motion:reduce){.scroll-hint .arrow{animation:none}}'
  // Keep the accent phrase whole so it wraps as a unit. It was splitting as "... — all" / "in one
  // place.", which reads as a broken sentence and puts the emphasis on the wrong word. nowrap rather
  // than a hard <br>, so the line still collapses to one on a viewport wide enough to hold it.
  // ---- the networks block: a centred eyebrow over a row of three equal pills.
  // It sits between the tagline and the primary CTA, so it has to read as one deliberate object
  // without competing with the button it introduces -- hence pill chrome at surface weight rather
  // than anything accented, and the eyebrow kept small.
  + '.lx-heronets{display:flex;flex-direction:column;align-items:center;gap:11px;margin:0 0 22px}'
  + '.lx-heronets-l{font-size:11.5px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;'
  + 'color:var(--text-soft)}'
  // The bar. One outline around all three, echoing the search field above it.
  + '.lx-hnetbar{display:inline-flex;align-items:center;height:54px;padding:0 6px;'
  + 'border:1px solid var(--border);border-radius:999px;background:var(--surface)}'
  // Cells size to their content. That is only legible because the dividers give the row its
  // structure -- as free-standing pills, content-sized boxes looked accidental, which is what sent
  // the last attempt to equal widths and its own set of alignment problems.
  + '.lx-hnet{display:inline-flex;align-items:center;gap:10px;height:28px;padding:0 20px;'
  + 'color:var(--text-muted)}'
  // A hairline between cells, not around them: border-left on a child shorter than the bar draws a
  // rule that stops clear of the rounded ends.
  + '.lx-hnet+.lx-hnet{border-left:1px solid var(--border)}'
  + '.lx-hnet-t{font-size:16px;font-weight:700;letter-spacing:-.1px;white-space:nowrap}'
  + '.lx-hnet-m{display:inline-flex;width:26px;height:26px;flex:0 0 auto}'
  + '.lx-hnet-m svg{width:100%;height:100%;display:block;border-radius:50%}'
  // The live chain reads as live: full-strength ink and a dot, quieter than a "LIVE" badge would be
  // this close to the CTA.
  + '.lx-hnet.is-live{color:var(--text)}'
  + '.lx-hnet.is-live::after{content:"";width:7px;height:7px;border-radius:50%;flex:0 0 auto;'
  + 'background:var(--green,#34d27a);box-shadow:0 0 0 3px rgba(52,210,122,.18)}'
  // The placeholder is carried by ink weight alone now. A dashed outline made sense when each item
  // had its own box; inside a single bar it would cut the shape up again.
  + '.lx-hnet.is-more{color:var(--text-soft)}'
  // ---- phones. Same bar, tightened. Every number below is checked against "More upcoming", which is
  // the widest cell by a distance and decides whether the bar fits the screen at all.
  + '@media (max-width:900px){.lx-heronets{margin-bottom:22px;gap:9px}'
  + '.lx-heronets-l{font-size:10.5px;letter-spacing:.16em}'
  + '.lx-hnetbar{height:46px;padding:0 3px;border-radius:16px}'
  + '.lx-hnet{gap:7px;height:24px;padding:0 11px}'
  + '.lx-hnet-m{width:21px;height:21px}'
  + '.lx-hnet-t{font-size:12.5px;letter-spacing:-.2px}'
  // The live dot goes on phones: it is worth ~10px of a bar that has none to give, and which chain is
  // live is answered in words by the networks section further down the page.
  + '.lx-hnet.is-live::after{display:none}}'
  // Narrow handsets: ~280px of usable width against a bar that wants ~316px at the sizes above.
  + '@media (max-width:360px){.lx-hnetbar{padding:0 2px}'
  + '.lx-hnet{gap:6px;padding:0 7px}'
  + '.lx-hnet-m{width:18px;height:18px}'
  + '.lx-hnet-t{font-size:11.5px}'
  // Nothing left to trim by this point, and the placeholder is the one cell whose mark depicts
  // nothing -- there is no third chain yet for it to stand for.
  + '.lx-hnet.is-more .lx-hnet-m{display:none}}'
  // Lift the hero content on desktop so the search field covers the point where the background rays
  // converge. Measured at 1440x900: the rays centre on y=423 and the field began at y=436, leaving the
  // convergence exposed as a bright dot just above it. 42px puts that point at the field's own centre.
  // Shifting .hero-center rather than the field alone moves the headline by the same amount, which is
  // what keeps the gap between them unchanged -- and the rays are positioned against the hero, not
  // this block, so they stay where they are. Verified the headline still clears the nav by 42px.
  // The desktop hero fills the screen. Its min-height is a flat 720px, and it only ever looked
  // full-height because the old headline happened to push the content to exactly 900px on a 900px
  // screen -- a coincidence, not a rule. The shorter sentence headline dropped it to 758px and the
  // next section started showing under the cue, which is the bug this whole area keeps coming back to.
  + '@media (min-width:901px){.hero{min-height:100vh;min-height:100dvh}'
  // -32px, re-derived rather than kept. The rays fill the hero and converge on its centre, so the
  // field has to sit there. With the hero at viewport height the content box is centred between 176px
  // of top padding and 30px of bottom, which lands the field 10px above centre before any shift; the
  // old -42px was measured against a hero whose height came from its content. The offset is constant
  // across viewport heights because both sides scale together -- checked at 900 and 1080.
  + '.hero-center{top:-32px}'
  // Bottom padding down from 88px. The networks block added ~100px to a hero that was already close
  // to the viewport: measured 966px tall at 1440x900, which put the scroll cue 28px under the fold.
  // The room is taken from BELOW the cue, never from padding-top -- the rays are pinned to a fixed
  // offset from the hero's top and the whole convergence alignment moves with it. The cue keeps 94px
  // of clearance above it, so nothing here crowds the buttons.
  + '.hero{padding-bottom:30px}'
  // ---- vertical rhythm below the search field.
  // Measured at 1440x900, the gaps down the hero ran 31 / 26 / 40 / 11 / 22 / 36 -- six different
  // values, and the tight ones bound the wrong things together. Proximity is what says what belongs
  // to what, and at 26px the tagline read as a caption on the search field while at 22px the buttons
  // read as part of the networks bar. One tight gap is kept, and only where it is true: the eyebrow
  // to its own bar. Everything else is one break value.
  //
  // Nothing above the field moves. It is pinned -- the background rays converge on its centre, and
  // _herotext's whole desktop offset is built around that measurement.
  + '.hero-search-wrap{margin-bottom:44px}'
  + '.lx-heronets{margin-bottom:44px}'
  + '.hero-ctas{margin-bottom:66px}}'
  // Phones need the same trick from the other end. The content is deliberately anchored near the nav,
  // so lifting it is not available -- the rays move instead. Left alone they sit at inset:0 and
  // converge on the hero's own centre, well below the search field.
  //
  // Pinned in PIXELS, not percentages. Because the content is top-anchored, the field sits a fixed
  // offset from the hero's top whatever the screen height, while a percentage scales with that height:
  // a version tuned at 812px was 45px out at 667px. Centre = top + height/2, so with C as the wanted
  // offset, top = 2C - 100% and height = 200% - 2C resolves to C at any hero height while still
  // spanning 0 to 100%.
  //
  // C is 257px: 132px of top padding, the headline, the gap, and half a 60px field. It moved from 252
  // when the field grew from 50px to 60px -- the pin is an offset to the FIELD, so it follows it.
  + '@media (max-width:900px){.hero-rays{top:calc(504px - 100%);bottom:auto;height:calc(200% - 504px)}}'
  // Above 1100px the size holds at its designed 114.4px but is capped against the viewport. Measured:
  // "The Multichain World" needs 1047px at 114.4px, and at exactly 1101px -- the narrow end of the
  // range where that size applies -- that left 22px either side. Not clipped, but crowded. 10vw gives
  // the narrow end roughly 42px and leaves 1280px and up completely unchanged.
  // Selector is .hero h1.hero-headline, not .hero-headline. The design sets the size with
  // h1.hero-headline -- element plus class, 0-1-1 -- so a bare class selector loses on specificity no
  // matter how late it is injected, and the 60px below simply never applied. Verified by reading the
  // computed size back, not by assuming the later block wins.
  // ---- headline sizes, reset for the sentence.
  // 114.4px was sized for "The Multi-chain World" -- 20 characters. The sentence is 67 across two
  // lines, so the old size would run four lines and swallow the screen. Every figure below is set from
  // measuring the two lines against the width actually available at the narrow end of its own range,
  // not scaled down by eye.
  //
  // Selector is .hero h1.hero-headline, not .hero-headline. The design sets the size with
  // h1.hero-headline -- element plus class, 0-1-1 -- so a bare class selector loses on specificity no
  // matter how late it is injected. Verified by reading the computed size back.
  + '@media (min-width:1101px){.hero h1.hero-headline{font-size:min(72px,5.2vw);letter-spacing:-1.6px}}'
  + '@media (max-width:1100px){.hero h1.hero-headline{font-size:46px;letter-spacing:-1.2px}}'
  + '@media (max-width:900px){.hero h1.hero-headline{font-size:min(38px,7.4vw);letter-spacing:-.9px}}'
  + '@media (max-width:520px){.hero h1.hero-headline{font-size:min(30px,7.4vw);letter-spacing:-.6px}}'
  // Line height comes down with the size: 1.1 was drawn for a two-word line, and at sentence length
  // two lines that tall read as two separate statements rather than one sentence.
  + '.hero h1.hero-headline{line-height:1.18;text-wrap:balance}'
  // The chosen break is a desktop decision. On a phone the line is short enough that forcing a break
  // after "Explore" only makes things worse -- measured 4 lines at 375px with "place." orphaned on the
  // last one. Hiding the <br> lets text-wrap:balance divide the sentence itself, which is what it is
  // for. The gradient span is unaffected; it is inline either way.
  + '@media (max-width:900px){.hero h1.hero-headline br{display:none}}'
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
  // Back to a full screen on phones. 78vh was my call, to let the next section show at the fold and
  // encourage scrolling -- but with a "Scroll to learn more" cue on the page that reads as the hero
  // failing to fill the screen, and the next section arrives before the cue has been acted on.
  // 100dvh rather than 100vh: on mobile browsers vh is measured against the viewport with the address
  // bar hidden, so a 100vh hero is taller than what is actually on screen and pushes the cue below the
  // fold -- the exact thing this is meant to fix. vh stays first as the fallback for anything without
  // dvh. Content moves down a little with it, but nowhere near the centred position that opened the
  // 167px void.
  // Full screen on phones, so the cue lands at the bottom and the next section stays below the fold --
  // the same behaviour desktop has. Sizing the hero to its content instead was my reading of a report
  // about a white band under the buttons; the band was actually the rays running out (their SVG is a
  // fixed 1000px and did not stretch with the box), which is fixed on its own below. With that fixed,
  // a full-screen hero no longer produces the band, so the height can go back.
  //
  // 100dvh rather than 100vh: mobile browsers measure vh against the viewport with the address bar
  // hidden, so a 100vh hero is taller than what is on screen and pushes the cue below the fold -- the
  // exact thing this is for. vh stays first as the fallback for anything without dvh.
  + '@media (max-width:900px){.hero{align-items:flex-start;padding-top:132px;min-height:100vh;min-height:100dvh;'
  // Bottom padding up from 35.2px. The new tagline runs to five lines on a 375px screen and six on a
  // 320px one, which left the buttons finishing 9px above the scroll cue -- clear, but only just, and
  // one more wrapped line from colliding. The cue sits at the hero's bottom edge, so padding here is
  // what buys it room.
  // 130px leaves the cue clear of the buttons (~60px) while keeping the whole hero inside a 568px
  // screen, the shortest phone worth supporting.
  + 'padding-bottom:130px}'
  // Belt and braces on the rays: make the SVG fill its box so a taller hero can never outrun it again.
  // preserveAspectRatio is "slice", so it covers and crops rather than letterboxing.
  + '.hero-rays svg{height:100%}'
  // Breathing room between the field and the tagline: 22px originally, then 52, now 104. Applied to
  // the search wrap's own margin so only this gap opens -- the field itself does not move, which
  // matters because the rays are pinned to where it sits.
  + '.hero-search-wrap{margin-bottom:104px}'
  // Same grouping fix as desktop, at phone scale. Measured 30 / 9 / 22 below the tagline, so the
  // buttons sat closer to the networks bar than the bar sat to the tagline and read as part of it.
  // One tight gap, and only between the eyebrow and its own bar. The 104px above stays as asked.
  + '.lx-heronets{margin-bottom:32px}'
  // ---- the two CTAs side by side instead of stacked.
  // The design stacks them on phones and gives .btn width:100%, so each ran the full column. They now
  // share one row: flex:1 1 0 splits the width evenly whatever the labels say, and max-width caps the
  // pair short of the full column so they read as buttons rather than two stacked bars. min-width:0
  // is what lets them actually shrink -- a flex item floors at its content width without it, and the
  // primary carries an arrow glyph as well as its label.
  + '.hero-ctas{flex-direction:row;justify-content:center;gap:12px}'
  + '.hero-ctas .btn{width:auto;flex:1 1 0;min-width:0;max-width:172px;padding:0 12px;'
  // 15px: "Learn More" and "Launch App" both hold one line at this size inside a 158px button on a
  // 375px screen, and still fit the 320px case where the buttons come out at ~140px.
  + 'font-size:15px}'
  + '.hero-ctas .btn.primary{gap:7px}}'
  // Short handsets. With the hero sized to its content, 132px above and 130px below made it 662px --
  // taller than a 568px screen, so the cue fell below the fold on exactly the devices with least room.
  // Trimming both paddings brings the whole hero inside the screen; measured rather than guessed the
  // second time, since guessing is what put it over.
  + '@media (max-width:900px) and (max-height:680px){'
  // 68px, not 96: at 96 the content plus padding came to 596px on a 568px screen, so the hero
  // outgrew the viewport and took the cue 4px past the fold with it. Confirmed dvh itself resolves
  // correctly to 568 here, so this was the box being too tall rather than a unit problem.
  + '.hero{padding-top:100px;padding-bottom:68px}'
  // The wider gap stays off short screens: at 568px the hero already ends exactly on the fold with
  // 20px between the buttons and the cue, so anything added here pushes the cue straight past it.
  // 12px, down from 22: the networks line adds ~38px of content to a hero that had none to spare, and
  // at 320x568 it closed the gap between the buttons and the scroll cue to 5px -- clear, but one
  // wrapped line from touching. Height is taken out of the content rather than by moving the cue: the
  // cue sits at the hero's bottom edge, so buying room with padding trades one collision for the cue
  // going under the fold, which is the bug this whole block exists to fix.
  + '.hero-search-wrap{margin-bottom:48px}'
  + '.lx-heronets{margin-bottom:32px}'
  // The pills are taller than the inline row they replaced, and at 320x568 that put the gap between
  // the buttons and the scroll cue back down to 6px. 39.6px of tagline margin is the largest single
  // gap left in the hero on these screens and the least missed, so it goes rather than the pills.
  // The bar is a few pixels taller than the inline row it replaced, which took the buttons-to-cue gap
  // back down to 11px here. Height off the bar and its eyebrow gap, not off the cells -- the cells are
  // already at the size where "More upcoming" only just fits a 320px screen.
  + '.lx-heronets{gap:7px}.lx-hnetbar{height:40px}'
  // The rays pin is an offset from the hero's top, so it moves with padding-top. Dropping that from
  // 132 to 100 slid the field up by 32px and left the convergence exposed again -- the pin has to
  // follow. C becomes 220, hence 440.
  + '.hero-rays{top:calc(420px - 100%);height:calc(200% - 420px)}}'
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

  html = html.replace(/<style id="lx-herotext">[\s\S]*?<\/style>/g, '')
    ;
  // The networks block is re-injected, so it is stripped first -- by depth walk, not by regex. See
  // cutElement: every regex form of this was wrong in one direction or the other, and the version
  // that ran past a flat block swallowed the hero's CTA row with it. Handles whatever shape an
  // earlier build left in the container, nested or flat.
  html = cutElement(html, '<div class="lx-heronets"', 'div');
  if (html.indexOf('lx-heronets') >= 0) { problems.push(p.key + ': networks block survived the strip'); continue; }

  const headOpen = '<h1 class="hero-headline">';
  const hi = html.indexOf(headOpen);
  if (hi < 0) { problems.push(p.key + ': hero headline not found'); continue; }
  const he = html.indexOf('</h1>', hi);
  if (he < 0) { problems.push(p.key + ': hero headline is not closed'); continue; }
  if (html.indexOf(headOpen, hi + 1) >= 0) { problems.push(p.key + ': more than one hero headline'); continue; }
  html = html.slice(0, hi + headOpen.length) + HEAD_HTML + html.slice(he);

  // ---- the tagline is gone: the headline says what it said.
  // Removed rather than hidden, so there is no empty paragraph left in the flow to reason about later.
  // Absence is the steady state -- every other step here re-injects, so the second run finds nothing
  // to remove and that is not an error. More than one would be.
  const tagN = (html.match(/<p class="hero-tagline">/g) || []).length;
  if (tagN > 1) { problems.push(p.key + ': ' + tagN + ' hero taglines, expected at most 1'); continue; }
  if (tagN === 1) html = cutElement(html, '<p class="hero-tagline">', 'p');
  if (html.indexOf('<p class="hero-tagline">') >= 0) { problems.push(p.key + ': tagline survived removal'); continue; }

  // ---- the networks block goes immediately above the buttons.
  // It used to be anchored to the tagline's close; with the tagline gone the CTA row is the anchor.
  // The row is asserted to appear exactly once rather than taking the first hit on trust -- inserting
  // against the wrong one would put the networks bar somewhere arbitrary in the page.
  const ctaN = (html.match(/<div class="hero-ctas">/g) || []).length;
  if (ctaN !== 1) { problems.push(p.key + ': expected 1 hero CTA row, found ' + ctaN); continue; }
  const at = html.indexOf('<div class="hero-ctas">');
  html = html.slice(0, at) + NETS_HTML + html.slice(at);

  // ---- secondary CTA label. Matched on the exact anchor rather than the bare words so a stray
  // "Explore Products" anywhere else on the page is never touched, and asserted to appear once.
  // ---- secondary CTA: label and destination.
  // It is now "Docs" pointing at /docs, and the header's own Docs button is dropped below, so the
  // link moves rather than duplicating. It used to be "Explore Products" -> #products; the previous
  // "Learn More" was replaced because the scroll cue directly beneath it already says exactly that.
  //
  // The whole anchor is rewritten from its class attribute rather than matched on the old label, so
  // this stays correct whatever a previous run left behind -- and the class list is read off the page
  // rather than assumed: desktop carries "btn lg" and mobile plain "btn", and hardcoding the mobile
  // form aborted the desktop page on the first run.
  const ctaI = html.indexOf('<div class="hero-ctas">');
  if (ctaI < 0) { problems.push(p.key + ': hero CTA row not found'); continue; }
  const ctaEnd = html.indexOf('</div>', ctaI);
  const row = html.slice(ctaI, ctaEnd);
  const secM = /<a [^>]*class="(btn[^"]*)"[^>]*>([\s\S]*?)<\/a>/.exec(row);
  if (!secM) { problems.push(p.key + ': secondary hero CTA not found'); continue; }
  if (/<a /g.test(row.slice(secM.index + 3))) { problems.push(p.key + ': more than one anchor in the hero CTA row'); continue; }
  html = html.slice(0, ctaI)
    + row.replace(secM[0], '<a href="/docs" class="' + secM[1] + '">Docs</a>')
    + html.slice(ctaEnd);

  // ---- the header's Docs button, desktop only. The mobile one lives in the slide-out menu and stays.
  if (p.key === 'lumoscore-landing.html') {
    const HDR = '<a href="/docs" class="btn">Docs</a>';
    const hdrN = html.split(HDR).length - 1;
    // One in the header. The hero's own is "/docs" too but was just written with the class it had
    // ("btn lg" on desktop), so it does not collide with this exact-string match -- asserted, because
    // if the hero ever ends up plain "btn" this would silently delete the wrong one.
    // 0 is fine and is the steady state: everything else in this transform re-injects, so a second
    // run finds the button already gone. Only more than one is a signal that the page is not what
    // this expects.
    if (hdrN > 1) { problems.push(p.key + ': ' + hdrN + ' header Docs buttons, expected at most 1'); continue; }
    if (hdrN === 1) html = html.replace(HDR, '');
  }

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
  console.log('  ' + st.key + ': hero headline reworded, networks block, CTAs'
    + '');
}
console.log('hero text: done on ' + staged.length + ' page(s)');
