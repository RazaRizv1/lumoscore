// The landing hero: headline, scroll cue, CTA row, and the geometry that holds it together.
//
// The headline is the design's own again -- "The Core of / Multi-chain Web3", with the lowercase "c"
// the rest of the page uses. It has been through two other wordings on the way here, and the tagline
// paragraph that used to sit under it is gone for good.
//
// THE THING TO KNOW BEFORE EDITING: the background rays converge on a single point, and the search
// field has to sit exactly on it. That alignment is held by hard pixel values -- .hero-center's
// negative offset on desktop, and a calc() pin on phones -- and BOTH are functions of how tall the
// hero's contents are. Every change to the headline size, the copy, the spacing, or what elements are
// present moves the field and breaks them. They have been re-derived on every such change:
// -42 -> -32 -> -93 -> -123 on desktop, with a separate value for 901-1100px where the headline is
// 70.4px, and 514 -> 568 -> 504 -> 640 -> 650 on phones. Do not carry any of them forward on faith.
// Measure: field centre against hero centre on desktop, field centre against rays centre on phones.
//
// Re-injects its own style block, so everything here can be tuned by editing this file and re-running.

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
// Back to the design's own headline, with "Multi-chain" spelled the way the rest of the page spells
// it. The two-line split -- first line in the ink colour, second in the gradient -- is the shape the
// hero was drawn around, and _herofit is written specifically to hold "Multi-chain Web3" on one line
// above 1101px, so the break is explicit rather than left to wrapping at every width.
//
// The tagline that used to sit under it is not coming back: it was removed when the headline briefly
// carried the whole sentence, and the hero reads fine without it.
const HEAD_HTML = 'The Core of<br/><span class="grad">Multi-chain Web3</span>';

// The statement panel: what the platform does, then which chains it runs on.
//
// The two are separate lines with a rule between them because they are different kinds of statement --
// one is a description, the other is a fact that will change as chains are added. Marks come from
// _netlogos.json, the same file the networks section further down the page uses, so the two cannot
// show different logos for the same chain.
//
// ON THE CLAIM: naming XRP Ledger here is deliberate and was confirmed by the owner. It reads
// stronger than the networks section further down, which says Stellar mainnet today with XRPL next --
// the distinction being that XRPL support exists but not yet at full functionality. If that section
// or the FAQ is ever reworded, this line is the one to keep it consistent with.
const NETLOGOS = require(__dirname + '/_netlogos.json');

function stmtNet(mark, label) {
  return '<span class="lx-hs-net"><i class="lx-hs-mark">' + mark + '</i>' + label + '</span>';
}

const STMT_HTML = '<div class="lx-herostmt">'
  + '<p class="lx-hs-lead">LumosCore unifies trading, liquidity, bridging, and asset management '
  + 'across networks.</p>'
  + '<span class="lx-hs-rule" aria-hidden="true"></span>'
  + '<p class="lx-hs-nets">Currently supporting '
  + stmtNet(NETLOGOS[0].logo, 'Stellar') + ' and ' + stmtNet(NETLOGOS[1].logo, 'XRP Ledger') + '.</p>'
  + '</div>';

// The mobile header's Launch App button. Same handler as the desktop header's, so the network chooser
// behaves identically; data-lxnonav keeps it clear of the landing page's text-matching interceptor,
// which would otherwise see "Launch App" and swallow the click.
const NAV_LAUNCH = '<button class="btn primary lx-navlaunch" data-lxnonav="1" '
  + 'onclick="try{window.lxChooseNetwork&&window.lxChooseNetwork(\'lumoscore-home.html\')}catch(e){}">'
  + 'Launch App</button>';

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
  // ---- the statement panel, where the CTA row used to be.
  // Same material as the search field above it -- surface, one hairline border, generous radius -- so
  // the hero reads as one family rather than a field and then a different kind of box. Centred text in
  // a symmetrical panel: equal padding all round, one max-width, nothing hanging off an edge. That
  // max-width is the search field's own 680px, so the two stack as one column rather than two nearly-
  // but-not-quite equal boxes -- measured, not guessed at.
  // A flat surface with one grey hairline was reading as a placeholder box. It keeps the field's
  // width and radius -- that alignment is the point -- but gains a gradient edge, a lit top, and a
  // shadow, so it sits on the rays rather than being cut out of them.
  //
  // The gradient border is two backgrounds with different clips: the surface fills the padding-box,
  // the gradient fills the border-box, and a transparent 1px border lets the second show through only
  // at the edge. It is the one way to get a gradient hairline without a wrapper element, and the
  // surface layer must be an explicit gradient (not a bare colour) because the shorthand needs both
  // layers to be images.
  + '.lx-herostmt{max-width:680px;margin:0 auto;padding:28px 40px 26px;border-radius:22px;'
  + 'border:1px solid transparent;position:relative;overflow:hidden;'
  + 'background:linear-gradient(var(--surface),var(--surface)) padding-box,'
  + 'linear-gradient(130deg,rgba(234,106,44,.55),rgba(255,255,255,.10) 42%,rgba(139,123,255,.42)) '
  + 'border-box;'
  + 'box-shadow:0 22px 48px -30px rgba(0,0,0,.85)}'
  // Light theme gets its own shadow: the dark one is invisible on a pale ground and the panel goes
  // back to looking cut out.
  + 'html[data-theme="light"] .lx-herostmt{box-shadow:0 18px 40px -28px rgba(15,15,20,.30)}'
  // The lit top edge -- a hairline of light along the first few pixels, which is what makes a dark
  // panel read as a raised surface rather than a hole.
  + '.lx-herostmt::after{content:"";position:absolute;left:14%;right:14%;top:0;height:1px;'
  + 'pointer-events:none;background:linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent)}'
  // A single wash behind the text, centred, tinted to the accent the page already uses.
  + '.lx-herostmt::before{content:"";position:absolute;inset:0;pointer-events:none;'
  + 'background:radial-gradient(560px 190px at 50% -10%,rgba(234,106,44,.16),transparent 70%)}'
  + '.lx-herostmt p{position:relative;margin:0;text-align:center;text-wrap:balance}'
  + '.lx-hs-lead{font-size:18.5px;line-height:1.6;color:var(--text-muted)}'
  // The rule separates a description from a fact. Accent-tinted rather than grey: at 1px a border-grey
  // hairline was measurably present (96x1) and still invisible against the panel. Short, centred, and
  // fading at both ends so it reads
  // as a divider rather than a second border inside a bordered box.
  + '.lx-hs-rule{position:relative;display:block;height:1px;width:96px;margin:18px auto 16px;'
  + 'background:linear-gradient(90deg,transparent,rgba(234,106,44,.6),transparent)}'
  // Inline flow, NOT flex. As a flex row every text node between the chips became its own item and
  // took the row gap with it, so the closing full stop sat 7px off the end of "XRP Ledger" as if it
  // belonged to nothing. Ordinary inline layout spaces "and" and "." the way the sentence intends.
  + '.lx-hs-nets{font-size:16px;line-height:1.9;color:var(--text-soft)}'
  // Each chain is a name with its mark, held together so the pair never breaks across a line.
  // vertical-align:middle is what keeps an inline-flex chip sitting on the sentence rather than
  // hanging below its baseline.
  + '.lx-hs-net{display:inline-flex;align-items:center;gap:8px;vertical-align:middle;'
  + 'color:var(--text);font-weight:700;white-space:nowrap}'
  + '.lx-hs-mark{display:inline-flex;width:22px;height:22px;flex:0 0 auto}'
  + '.lx-hs-mark svg{width:100%;height:100%;display:block;border-radius:50%}'
  + '@media (max-width:1100px){.lx-herostmt{max-width:640px;padding:26px 32px 24px}'
  + '.lx-hs-lead{font-size:17.5px}.lx-hs-nets{font-size:15.5px}}'
  + '@media (max-width:900px){.lx-herostmt{max-width:none;padding:22px 20px 20px;border-radius:18px}'
  + '.lx-hs-lead{font-size:15.5px;line-height:1.58}'
  + '.lx-hs-rule{width:74px;margin:15px auto 13px}'
  + '.lx-hs-nets{font-size:13.5px;gap:0 6px}'
  + '.lx-hs-net{gap:6px}.lx-hs-mark{width:19px;height:19px}}'
  + '@media (max-width:360px){.lx-hs-nets{font-size:12.5px}'
  + '.lx-hs-mark{width:17px;height:17px}}'
  // ---- mobile header Launch App.
  // Sized to sit level with the 36px icon button beside it rather than at the .btn default of 48px,
  // and the label is allowed to shrink before the nav starts wrapping on a 320px screen.
  + '.lx-navlaunch{display:none}'
  + '@media (max-width:900px){.lx-navlaunch{display:inline-flex;height:36px;padding:0 14px;'
  + 'font-size:13.5px;border-radius:9px;width:auto;flex:0 0 auto;margin-left:auto}'
  + '.nav .logo{flex:0 1 auto;min-width:0}}'
  // At 320px the row is 10px over: flex shrinks the logo's box, but its wordmark is overflow:visible
  // and simply runs on, ending 2px under the button. Measured -- the boxes do not intersect, so a
  // left/right comparison says it fits while the ink says otherwise. The wordmark gives up 2.5pt,
  // which is enough for the row to stop shrinking at all.
  + '@media (max-width:360px){.lx-navlaunch{padding:0 10px;font-size:12.5px}'
  + '.nav .logo-text{font-size:14px}}'
  // Keep the accent phrase whole so it wraps as a unit. It was splitting as "... — all" / "in one
  // place.", which reads as a broken sentence and puts the emphasis on the wrong word. nowrap rather
  // than a hard <br>, so the line still collapses to one on a viewport wide enough to hold it.
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
  // -93px, re-derived again. The rays fill the hero and converge on its centre, so the field has to
  // sit there, and this offset is whatever it takes -- it is not a constant to be carried forward.
  // It has moved with every change to the hero's contents: -42 when the hero's height came from its
  // content, -32 once the hero became viewport-height, -93 with the networks block out, -123 for
  // the design headline coming back, -86 with the CTA row swapped for the statement panel, and -57 once that panel grew a
  // second line and a rule.
  // Measured each time; the field centre and the hero
  // centre both read 450 at 1440x900.
  + '.hero-center{top:-57px}'
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
  + '.lx-herostmt{margin-bottom:66px}}'
  // ---- a second offset for 901-1100px, where the headline is 70.4px rather than 114.4px.
  // One value cannot serve both bands: the smaller headline makes the content block ~97px shorter,
  // which lifts the field 72px above the hero centre at 950px wide. Measured there rather than
  // interpolated. This band has probably been a little out since the -42px days, when the offset was
  // also tuned at 1440 alone -- it is only visible now because the miss got big enough to see. It sits
  // after the block above so it wins on source order at equal specificity.
  + '@media (min-width:901px) and (max-width:1100px){.hero-center{top:10px}}'
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
  + '@media (max-width:900px){.hero-rays{top:calc(650px - 100%);bottom:auto;height:calc(200% - 650px)}}'
  // Above 1100px the size holds at its designed 114.4px but is capped against the viewport. Measured:
  // "The Multichain World" needs 1047px at 114.4px, and at exactly 1101px -- the narrow end of the
  // range where that size applies -- that left 22px either side. Not clipped, but crowded. 10vw gives
  // the narrow end roughly 42px and leaves 1280px and up completely unchanged.
  // Selector is .hero h1.hero-headline, not .hero-headline. The design sets the size with
  // h1.hero-headline -- element plus class, 0-1-1 -- so a bare class selector loses on specificity no
  // matter how late it is injected, and the 60px below simply never applied. Verified by reading the
  // computed size back, not by assuming the later block wins.
  // ---- headline sizes, back to the design's own now that the design's own headline is back.
  // The sentence headline needed 72/46/38/30; those were sized for 67 characters over two lines and
  // are far too small for "The Core of / Multi-chain Web3". The desktop figure is the design's
  // 114.4px, capped at 10vw: _herofit measures "Multi-chain Web3" at 7.674x the font size, so 878px at
  // 114.4, and at the narrow end of this range that would leave only ~110px of margin either side.
  //
  // Selector is .hero h1.hero-headline, not .hero-headline. The design sets the size with
  // h1.hero-headline -- element plus class, 0-1-1 -- so a bare class selector loses on specificity no
  // matter how late it is injected. Verified by reading the computed size back.
  + '@media (min-width:1101px){.hero h1.hero-headline{font-size:min(114.4px,10vw)}}'
  + '@media (max-width:1100px){.hero h1.hero-headline{font-size:70.4px;letter-spacing:-1.6px}}'
  // Phones: fluid, because "Multi-chain Web3" is the long line. At a flat 44px it needs 338px against
  // 336px of usable width on a 375px screen -- over by two pixels, which wraps "Web3" onto a line of
  // its own. 9.3vw gives 35px there and keeps the headline to the two lines the <br> intends.
  + '@media (max-width:520px){.hero h1.hero-headline{font-size:min(44px,9.3vw);letter-spacing:-1.2px}}'
  // The <br> stays visible at every width: it is the design's two-line split, and both halves are
  // short enough to hold a line on a phone. The sentence headline had to hide it and let the text
  // wrap itself; this one does not.
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
  + '@media (max-width:900px){.hero{align-items:flex-start;padding-top:200px;min-height:100vh;min-height:100dvh;'
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
  + '.hero-search-wrap{margin-bottom:44px}'
  + '}'
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
  + '.hero-search-wrap{margin-bottom:24px}'
  // The panel, tightened for the shortest screens. It grew a second line and a rule, and at 320x568
  // that put the scroll cue 28px INSIDE it -- overlapping text, not just a small gap. Everything here
  // comes out of the panel's own box rather than the hero's padding: the cue sits at the hero's bottom
  // edge, so buying room with padding trades this collision for the cue going under the fold, which is
  // the bug this whole block exists to fix. None of it moves the search field, so the pin above holds.
  + '.lx-herostmt{padding:16px 16px 15px;border-radius:16px}'
  + '.lx-hs-lead{font-size:14px;line-height:1.5}'
  + '.lx-hs-rule{width:64px;margin:11px auto 10px}'
  + '.lx-hs-nets{font-size:12.5px;line-height:1.7}'
  // The rays pin is an offset from the hero's top, so it moves with padding-top. Dropping that from
  // 132 to 100 slid the field up by 32px and left the convergence exposed again -- the pin has to
  // follow. C becomes 220, hence 440.
  + '.hero-rays{top:calc(430px - 100%);height:calc(200% - 430px)}}'
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
  // ---- the hero networks block is gone.
  // It was tried as a loose inline list, then as three equal pills, then as one divided capsule, and
  // it never earned its place between the tagline and the buttons. What it said is said properly by
  // the networks section further down the page, which is untouched.
  //
  // The strip stays: containers built before this still carry the block, and it has to come out of
  // them. Depth walk rather than regex -- every regex form of this was wrong in one direction or the
  // other, and the one that ran past a flat block swallowed the hero's CTA row with it.
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


  // ---- the hero CTA row goes; a statement takes its place.
  // Launch App was in the hero AND in the header, two identical buttons a few hundred pixels apart.
  // The header keeps it, and the mobile header gains one below so both layouts work the same way.
  //
  // Docs left the header earlier to live in this row, so removing the row would strand it in the
  // footer. It goes back into the desktop nav links instead of the header actions -- a text link
  // beside Products / Networks / FAQs rather than a second button competing with Launch App.
  //
  // The statement is re-injected on every run, so it is stripped first. Both removals are depth walks:
  // the CTA row contains a <button> with its own nested markup, and the statement is a div in a div.
  html = cutElement(html, '<div class="lx-herostmt"', 'div');
  const ctaN = (html.match(/<div class="hero-ctas">/g) || []).length;
  if (ctaN > 1) { problems.push(p.key + ': ' + ctaN + ' hero CTA rows, expected at most 1'); continue; }
  const ctaI = html.indexOf('<div class="hero-ctas">');
  if (ctaI >= 0) html = cutElement(html, '<div class="hero-ctas">', 'div');
  if (html.indexOf('<div class="hero-ctas">') >= 0) { problems.push(p.key + ': CTA row survived removal'); continue; }

  // The statement lands where the row was on the first run, and after the search field on every run
  // after that, which is the same place -- the field's wrapper is the last element before it.
  const swEnd = (() => {
    const at = html.indexOf('<div class="hero-search-wrap">');
    if (at < 0) return -1;
    const rest = cutElement(html.slice(at), '<div class="hero-search-wrap">', 'div');
    return at + (html.length - at - rest.length);
  })();
  if (swEnd < 0) { problems.push(p.key + ': hero search wrap not found'); continue; }
  html = html.slice(0, swEnd) + STMT_HTML + html.slice(swEnd);

  if (p.key === 'lumoscore-landing.html') {
    // Docs back into the nav links, once. Anchored to the FAQs link so it lands at the end of the row.
    const FAQ = '<a href="/faq">FAQs</a>';
    if (html.indexOf('<a href="/docs">Docs</a>') < 0) {
      if (html.indexOf(FAQ) < 0) { problems.push(p.key + ': FAQs nav link not found'); continue; }
      html = html.replace(FAQ, FAQ + '<a href="/docs">Docs</a>');
    }
  } else {
    // ---- mobile header gains the Launch App button the desktop header already has.
    // Same handler as desktop's, so network choice behaves identically; data-lxnonav keeps it clear of
    // the landing page's text-matching nav interceptor. Inserted before the menu button so the order
    // reads logo, action, menu.
    const MENU = '<button class="nav-icon-btn" id="menuBtn"';
    if (html.indexOf('lx-navlaunch') < 0) {
      const at = html.indexOf(MENU);
      if (at < 0) { problems.push(p.key + ': mobile menu button not found'); continue; }
      html = html.slice(0, at) + NAV_LAUNCH + html.slice(at);
    }
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
  console.log('  ' + st.key + ': hero headline, tagline removed, CTAs'
    + '');
}
console.log('hero text: done on ' + staged.length + ' page(s)');
