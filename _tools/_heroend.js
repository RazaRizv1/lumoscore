// Hero: quiet the "Fragmented networks" caption, and give the settled "One Core" state something to say.
//
// TWO PROBLEMS, both at the ends of the same scroll.
//
// 1. THE CAPTION WAS COMPETING WITH THE HEADLINE. "Fragmented networks" is set at
//    font:800 clamp(24px,2.9vw,40px) in full accent orange with a 24px glow -- at 1440 that is 40px
//    of bold orange sitting under the ring, which is most of the way to the 62px headline above it.
//    It reads as a second heading making its own claim rather than as a label for the diagram it
//    belongs to, which is exactly the "too much, almost like it's not related" note. It becomes a
//    caption: small, letter-spaced, and dimmed to a tint of the accent rather than the accent
//    itself. Nothing moves -- only weight, size and colour.
//
// 2. THE END OF THE SCROLL WAS EMPTY. The hero is a long pinned scene, and the payoff frame is the
//    flame with "One Core" under it and nothing else: the headline and the sub have faded out by
//    then, so a reader who has just scrolled ~1.5 viewports arrives at two words on a field of
//    rays. The convergence earns a sentence, so one is added underneath -- what the core actually
//    contains, stated plainly.
//
// THE NEW LINE USES data-l + ::after, NOT TEXT, and that is not decoration: the nav logo engine
// repaints short text nodes as ticker art, and `content:attr(data-l)` on a <b> is the escape every
// other label in this hero already uses (see .lxu-nl, .lxu-onecore, .lxu-cue). Plain text here
// would eventually come back as a logo.
//
// It reuses _herounify.js's own @keyframes lxu-rise and its scroll(root) timeline rather than
// inventing a second one, so it fades in on the same scroll the flame does -- just later, so the
// two words land first and the sentence follows.
//
// DESKTOP ONLY (>=900px). The phone hero is a reordered stack tuned to fit one screen and it puts
// .lxu-onecore at top:6px; adding a second absolutely-positioned line into that is how you get an
// overlap on a device nobody tested. The caption resize applies at every width -- it is a type
// change, and it is too big on a phone too.
//
// Re-injects: strips its own stylesheet and its own <b> before writing.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// What the core actually holds, stated as fact. Kept in step with the hero sub and the Why section,
// which both say Stellar and XRP Ledger; if a third network ships, all three move together.
const SUB = 'Stellar and XRP Ledger, with more on the way.';

const ANCHOR = '<b class="lxu-onecore" data-l="One Core"></b>';
const NEWB = '<b class="lxu-onesub" data-l="' + SUB.replace(/"/g, '&quot;') + '"></b>';

const CSS = '<style id="lx-heroend">'

  // ---- 1. the caption ------------------------------------------------------------------------
  // Same position, a third of the size. Letter-spacing rather than weight does the work of making
  // it read as a label; the accent survives as a tint so the line still belongs to the diagram.
  + '.lxu-hero .lxu-cue{font:700 clamp(12px,1.02vw,15px)/1.2 "Hanken Grotesk",system-ui,sans-serif;'
  + 'letter-spacing:.17em;text-transform:uppercase;color:rgba(234,106,44,.82);'
  + 'text-shadow:0 1px 12px rgba(234,106,44,.22)}'
  + '[data-theme="light"] .lxu-hero .lxu-cue{color:rgba(189,78,25,.9)}'
  + '@media (max-width:899px){.lxu-hero .lxu-cue{font-size:11.5px;letter-spacing:.15em}}'
  // The height-based rule _herounify.js adds for short laptop windows was sized against the 40px
  // caption and now overshoots upward; at this size there is nothing left to claw back.
  + '@media (max-height:680px){.lxu-hero .lxu-cue{font-size:clamp(11px,1vw,13px)}}'

  // ---- 2. the line under One Core ------------------------------------------------------------
  // Offset from the same anchor .lxu-onecore uses, by a clamp that tracks that element's own
  // clamp(28px,3.3vw,48px) -- a fixed px gap would collide at the small end and drift at the large.
  + '.lxu-onesub{position:absolute;left:50%;'
  + 'top:calc(50% + var(--d)*.32 + clamp(42px,3.9vw,66px));transform:translateX(-50%);'
  + 'font:600 clamp(14px,1.2vw,18px)/1.4 "Hanken Grotesk",system-ui,sans-serif;'
  + 'letter-spacing:-.01em;color:var(--text-muted);opacity:0;white-space:nowrap;'
  + 'pointer-events:none;text-align:center}'
  + '.lxu-onesub::after{content:attr(data-l)}'
  // Hidden outright below 900, rather than left at opacity 0: the phone hero repositions
  // .lxu-onecore and this would land on top of the ring.
  + '@media (max-width:899px){.lxu-onesub{display:none}}'

  // ---- 3. "One Core" belongs UNDER the ring on a phone ---------------------------------------
  // _herounify.js pins .lxu-onecore to top:6px below 900px and sizes it to match .lxu-cue, on the
  // reasoning that the two are the same line of type saying two different things and should occupy
  // one spot so the swap reads as the text CHANGING rather than jumping. Defensible, but it puts
  // the payoff at the very top of the scene: you scroll the logos together, they collapse into the
  // flame in the middle, and the words announcing it appear above everything, disconnected from the
  // thing they describe. On desktop it sits under the core, which is what reads correctly.
  //
  // THE OFFSET IS MEASURED OFF THE RING TRACK, NOT OFF THE SCATTERED MARKS -- that was the first
  // attempt's mistake. The marks are only spread out at REST; by the time "One Core" fades in they
  // have collapsed into the flame, so positioning below where they sat scattered (their lowest was
  // 373 of a 439 stage, so .70 cleared it) left the words stranded ~139px under the flame with
  // nothing in between. It cleared something that is no longer there.
  //
  // What IS still drawn around the flame in the settled state is the orbit track. Measured on the
  // built page at 375px, relative to .lxu-viz (height 439, centre 219): .lxu-ring / .lxu-orbit run
  // 98 to 341, so the track's radius is (341-219)/242.5 = .503 of --d. The flame itself is 189-250
  // and its glow .lxu-ap is 185-254.
  //
  // .44, NOT .55 and NOT the track. The track is the ORBIT PATH, not something drawn in the settled
  // frame -- what is actually visible around the flame at the end is a smaller arc. Its radius could
  // not be measured directly (window.scrollTo does not take on the mobile page, so the settled state
  // is unreachable from here), so it was derived from RAZA's screenshot: the flame renders 70px
  // tall there against 61px measured, a scale of ~1.15, which puts the arc's bottom at ~289 -- well
  // inside the 341 track. .44 lands ~37px under that arc and still 72px clear of the flame's glow,
  // which is the widest thing it could collide with if the estimate is off. A ratio rather than a
  // pixel offset because --d is
  // max(160px,min(70vw - 20px,340px,72vh - 250px)) -- it moves with both the width AND the height of
  // the phone, so a fixed top would be right on exactly one device.
  //
  // Desktop's .32 cannot be reused here: at .32 the line lands at 296, which is inside the track.
  // The phone's ring is proportionally much larger relative to its stage, which is the reason the
  // original code gave up and pinned it to the top.
  //
  // .lxu-cue stays where it is: it labels the scattered state, and that state is the top of the
  // scene. Only the payoff moves.
  + '@media (max-width:899px){'
  + '.lxu-hero .lxu-onecore{top:calc(50% + var(--d)*.44);bottom:auto}'
  + '}'
  // Starts after .lxu-onecore's 98vh-150vh so the two words are readable before the sentence
  // arrives. Same keyframes and same timeline as the rest of the scene.
  + '@media (prefers-reduced-motion:no-preference) and (min-width:900px){'
  + '.lxu-onesub{animation:lxu-rise linear both;animation-timeline:scroll(root);'
  + 'animation-range:116vh 158vh}'
  + '}'
  // With motion reduced there is no scroll animation to ride, so it is simply present.
  + '@media (prefers-reduced-motion:reduce) and (min-width:900px){.lxu-onesub{opacity:1}}'

  // ---- 4. A HERO THAT DOES NOTHING ON BROWSERS WITHOUT SCROLL-DRIVEN ANIMATIONS --------------
  // _herounify.js puts the entire scene behind `@supports (animation-timeline:scroll())`, and
  // Safari only shipped scroll-driven animations in Safari 26 -- so on iOS 18 and earlier the whole
  // block is skipped. Extracted from the built stylesheet, the resting state that leaves is:
  // `.lxu-onecore{opacity:0}` and `.lxu-cue{display:none}` -- both are only turned on INSIDE that
  // block. The reader gets a static ring of chain logos, no caption, no flame ignition and no "One
  // Core", and nothing happens when they scroll. Reported on an iPhone 12 Pro while an iPhone 13
  // Pro Max was fine, which is the same page on two different Safari versions.
  //
  // The keyframes are all named and reusable (lxu-collapse, lxu-core, lxu-orbits, lxu-halo,
  // lxu-ignite, lxu-fade 1->0, lxu-rise 0->1), so the fallback is the SAME choreography expressed as
  // a duration. `both` on every one makes the end state stick.
  //
  // A DURATION ALONE WAS NOT ENOUGH, and shipping it that way was wrong: on an iPhone 12 Pro the
  // whole scene played itself out on load, before the reader had scrolled at all. The point of this
  // hero is that the convergence answers the scroll. So the durations below are only the timeline's
  // SHAPE -- lxHeroScrub (injected with this stylesheet) pauses every one of them and sets
  // currentTime from the scroll position, which turns the same timeline into a scrub. If that script
  // does not run, the animations simply play, which is a worse but not broken outcome.
  //
  // THIS CANNOT REGRESS THE WORKING PATH. `@supports not (animation-timeline:scroll())` is the
  // exact complement of the condition _herounify.js uses, so any browser that already runs the
  // scroll version never sees a line of it. That also means it cannot be tested in the preview pane,
  // whose engine supports scroll timelines -- the declarations below were checked by applying them
  // directly and watching the scene resolve.
  //
  // Gated to no-preference: a reader who asked for less motion is not given an unrequested
  // animation instead. That path keeps the static ring, which is a legitimate outcome.
  + '@supports not (animation-timeline:scroll()){'
  + '@media (prefers-reduced-motion:no-preference){'
  // THE SCROLL TRACK HAS TO COME BACK TOO, and leaving it out is why the first scrub attempt made
  // the hero appear already finished at the top of the page. `section.hero{height:260vh/210vh}` and
  // the sticky stage are themselves inside the upstream @supports block, so on Safari 18 the hero
  // collapsed to its own content height. The scrub then computed
  // `track = section.offsetHeight - innerHeight` as <= 0 and fell into its degenerate branch, which
  // returns progress 1 -- so every animation was pinned to its END frame before the reader moved.
  // The track is what the progress is measured against; without it there is nothing to scrub over.
  + '@media (min-width:900px){'
  + 'section.hero.lxu-hero{height:260vh}'
  + '.lxu-stage{position:sticky;top:0;height:100vh;height:100dvh;min-height:0;padding:0}'
  + '}'
  // The phone's stage padding is set by _herostill.js and must not be overwritten here, so only the
  // track and the pin are restated.
  + '@media (max-width:899px){'
  + 'section.hero.lxu-hero{height:210vh}'
  + '.lxu-stage{position:sticky;top:0;height:100vh;height:100dvh;min-height:0}'
  + '}'
  + '.lxu-cue{display:flex;animation:lxu-fade .8s linear 1.5s both}'
  + '.lxu-ring{animation:lxu-collapse 2s cubic-bezier(.4,0,.2,1) .35s both}'
  + '.lxu-orbits{animation:lxu-orbits 2s cubic-bezier(.4,0,.2,1) .35s both}'
  + '.lxu-core{animation:lxu-core 2s cubic-bezier(.4,0,.2,1) .35s both}'
  + '.lxu-halo{animation:lxu-halo 1.5s ease-out 1.25s both}'
  + '.lxu-flame{opacity:0;animation:lxu-ignite 1.1s ease-out 1.35s both}'
  + '.lxu-onecore{animation:lxu-rise .7s ease-out 2.05s both}'
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

  html = html.replace(/<style id="lx-heroend">[\s\S]*?<\/style>/g, '');
  html = html.replace(/<b class="lxu-onesub"[^>]*><\/b>/g, '');

  // Both hooks are checked before anything is written: a caption rule with no .lxu-cue to style,
  // or a line with nowhere to sit, is a stylesheet that silently does nothing.
  if (html.indexOf('lxu-cue') < 0) problems.push(p.key + ': no .lxu-cue to restyle');
  const n = html.split(ANCHOR).length - 1;
  if (n !== 1) problems.push(p.key + ': expected 1 .lxu-onecore anchor, found ' + n);
  if (problems.length) continue;

  html = html.split(ANCHOR).join(ANCHOR + NEWB);

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
  staged.push({ file: p.file, data, s, e, json, key: p.key });
}

if (problems.length) {
  console.error('hero-end: ABORT - nothing written.');
  problems.forEach(x => console.error('  ' + x));
  process.exit(1);
}
for (const st of staged) {
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.key + ': cue reduced to a caption, One Core given a supporting line');
}
console.log('hero-end: done on ' + staged.length + ' page(s)');
