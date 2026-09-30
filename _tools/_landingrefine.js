// Landing page refinement, pass 1: type hierarchy, section alignment, and the copy.
//
// WHAT WAS WRONG, measured on the built page rather than guessed:
//
//   1. THE HIERARCHY WAS INVERTED. The hero h1 computed to 55.44px and the section h2s to 57.2px --
//      every section heading below the fold was LARGER than the headline it was supporting. Nothing
//      else on the page can read correctly while that is true, so it is fixed first.
//
//   2. THE SAME SENTENCE APPEARED THREE TIMES. The hero sub, the products sub and the final-CTA sub
//      were all a comma list of the same five verbs:
//        "Trade, bridge, provide liquidity, launch assets and manage more from one unified interface."
//        "Trade, pool, bridge, deploy, and manage your entire multichain portfolio from a single interface."
//        "Trade, bridge, provide liquidity, launch assets and unlock more from one unified platform."
//      A reader who scrolls the page is told the same thing three times in three slightly different
//      wordings, which reads as filler and wastes the two positions on the page that carry the most
//      weight. Each of the three now has its own job: the hero makes the promise, the products head
//      stops enumerating (the six cards under it already are the enumeration), and the CTA states the
//      terms of entry.
//
//   3. EVERYTHING BELOW THE HERO WAS CENTRED while the hero and the final CTA were left-aligned. The
//      page changed its mind about its own axis twice. Everything is left now, which is also what the
//      hero already does, so the change is toward the page's own strongest section rather than away.
//
// WHAT IS DELIBERATELY *NOT* DONE HERE:
//
//   NO NEW WEBFONT. Every design reference reached for says to pair a display face against the body
//   face, and on a standalone page that is right. This site already ships ~1.2MB of script per page
//   (see _externalize.js and the page-weight work) and the landing page is the first paint a new
//   visitor gets; a display face is another blocking request plus a FOUT on the one element -- the h1 --
//   that must not move. Hanken Grotesk is already a grotesk with character and already loads at 800.
//   The hierarchy problem above was a SCALE problem, not a typeface problem, and scale is free.
//   If a display face is wanted later it should be a considered decision with a budget, not a
//   side effect of a heading being too small.
//
//   NO EYEBROW LABELS over the section heads. The obvious move is a small uppercase "PRODUCTS" /
//   "WHY LUMOSCORE" tag above each h2, and it is the move to avoid: a label that only restates the
//   section's own name is decoration, and it is the single most recognisable tell of a generated
//   layout. The type scale is doing the ranking instead.
//
// Re-injects: strips its own <style> and reverses its own copy edits, so it is safe to re-run on its
// own output. Every replacement is counted and the whole thing ABORTS before writing if any string is
// missing -- a silently-skipped replacement would ship a page that is half-redesigned.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// ---------------------------------------------------------------------------------------------
// COPY
//
// `from` is the string as it stands in the container today; `to` is the replacement. `back` lists the
// replacement AND the original so a re-run can normalise either state to `to` -- that is what makes
// the transform idempotent rather than merely re-runnable once.
// ---------------------------------------------------------------------------------------------
const COPY = [
  {
    what: 'hero sub',
    from: 'Trade, bridge, provide liquidity, launch assets and manage more from one unified interface.',
    // Names the two networks, because "multichain" on its own is a word every competitor also uses,
    // and carries the custody claim -- which is the actual differentiator and was buried in card 2 of
    // a four-card row two screens further down.
    to: 'Trade, pool, bridge and launch across Stellar and XRP Ledger &mdash; from one interface, '
      + 'and without ever handing over your keys.'
  },
  {
    what: 'products head',
    from: 'One Interface. Multiple chains. Zero tab-switching.',
    // Was Title Case and three staccato fragments. The count is the interesting fact and it is one
    // the page can be held to, so the count leads.
    to: 'Six products, one account.'
  },
  {
    what: 'products sub',
    from: 'Trade, pool, bridge, deploy, and manage your entire multichain portfolio from a single interface.',
    // The six cards directly beneath ARE the list. A subhead that lists them again is the third copy
    // of the same sentence; this one says the thing the cards cannot say about themselves.
    to: 'Every one of them behaves the same way on every network LumosCore supports.'
  },
  {
    what: 'why head',
    from: 'Why Choose LumosCore?',
    // "Why Choose X?" is a template heading and a question the page then answers about itself.
    // The four items under it are claims with numbers in them, aimed at someone deciding whether to
    // connect a wallet, so the heading frames them as checkable rather than as selling points.
    to: 'Worth checking before you connect.'
  },
  {
    what: 'why sub',
    from: 'One place for everything multichain, without giving up custody of anything.',
    to: 'Four claims, each one you can verify yourself.'
  },
  {
    what: 'final CTA sub',
    from: 'Trade, bridge, provide liquidity, launch assets and unlock more from one unified platform.',
    // The third repetition. At the bottom of the page the reader has already seen the products; what
    // they have not been told is what it costs to start, which is nothing.
    to: 'No sign-up, no deposit, nothing held on your behalf. Connect a wallet and go.'
  }
];

// ---------------------------------------------------------------------------------------------
// CSS
//
// Injected last so it wins on source order at equal specificity -- this page already carries several
// <style id="lx-*"> blocks and the later one prevails. Where an existing rule is more specific the
// selector here is written to match or beat it rather than reaching for !important, except on the
// two centring declarations that are set on the element's own base rule.
// ---------------------------------------------------------------------------------------------
const CSS = '<style id="lx-landingrefine">'

  // ---- 1. THE SCALE -------------------------------------------------------------------------
  // One ratio, applied down the page. The h1 and the section h2s are deliberately far apart: the
  // gap between them IS the hierarchy, and the previous 55.44 / 57.2 had it backwards.
  //
  // GATED TO >=900px, AND THE GATE IS LOAD-BEARING. _herounify.js sizes .lxu-h1 three separate times
  // below 900px -- clamp(36px,8.4vw,52px) at max-width:899, min(7.05vw,30px) with white-space:nowrap
  // in the reduced-motion-none variant, and clamp(25px,6.6vw,34px) on short screens -- because the
  // mobile hero is a reordered stack (h1 / sub / viz / ctas) tuned to fit one phone screen. An
  // ungated rule here is BOTH later in source order AND more specific than all three, so it silently
  // won everywhere: measured at 375px the headline came out 52.36px against the ~30px that layout is
  // built for, and paired with that nowrap it would run off the side of the screen. The desktop
  // hierarchy fix has no business touching a hero that was already fitted.
  + '@media (min-width:900px){'
  // THE COLUMN HAS TO MOVE WITH THE TYPE. The hero is a two-column grid and the copy side was a
  // FIXED 420px against a 768px visualisation. Measured on the built page at the new size:
  // "Many networks." sets to 622px at 92.16px type and 417px at 64px, so a 420px column can only
  // ever carry a ~64px headline -- put 92px in it and the phrase breaks to "Many / networks.",
  // which is a worse headline than the small one it replaced. Widening the column is the fix; a
  // fixed narrow container under a large h1 is exactly what produces wrapped, stacked headings.
  //
  // The second column does NOT give the room up for free, which is the whole constraint here. The
  // orb sizes itself from its own --d:min(505px,56vh,34vw) rather than from the track, so narrowing
  // the track does not shrink it -- it just slides the whole visualisation right. Measured at
  // 1440: the outermost chain node sits at x=1344 with a 420px copy column and moves 1:1 with it,
  // so every pixel the headline gains is a pixel the orb loses off the right edge. A 44vw column
  // fitted the headline on one line and pushed 117px of the orb past the viewport.
  //
  // So the headline is sized to the room that exists rather than the room it would like. The phrase
  // "Many networks." needs ~6.9px of width per 1px of type (measured on the built page, not
  // estimated: it fits a 490px column at 71px and wraps at 73.1px).
  //
  // THE BUDGET IS MEASURED AGAINST clientWidth, NOT innerWidth. A 34vw column left the outermost
  // orb node at x=1432 with innerWidth 1440, which looks like 8px of clearance and is not: the
  // page is 13,000px tall, so there is always a scrollbar, and documentElement.clientWidth is
  // 1430 -- the node was already 2px behind it, and Windows scrollbars are wider than this pane's
  // 10px. 31vw pulls it back to ~1389 for ~41px of real clearance.
  //
  // 4.3vw x 6.9 = 29.7vw of demand against a 31vw column, so the ratio clears at 900, 1200, 1440
  // and 1920 alike with slack. Only the 1300-1700 band actually moves: below it the column's
  // 420px floor binds and above it the 560px ceiling does, so both ends keep the clearance they
  // already had.
  //
  // EVERY LENGTH HERE IS px OR vw, NEVER rem, and that is not a style preference. The root
  // font-size on this site is 21.5px, not 16 -- so the first draft's clamp(3.4rem,4.9vw,5.1rem)
  // had a floor of 73.1px, the floor won at every width below 1500, and the headline wrapped at
  // exactly the size the clamp was written to avoid. A rem here silently means something 34%
  // bigger than it reads as.
  //
  // That is ~68px at 1440 against the 55.44px it started at, and the hero keeps its animation
  // uncropped. Cropping the one genuinely original thing on the page to buy 20px of headline
  // would be a bad trade.
  //
  // There is deliberately NO white-space:nowrap: if the measurement is ever off at some width the
  // headline should wrap, not run off the side of the screen.
  + '.hero .lxu-grid,.lxu-hero .lxu-grid{grid-template-columns:clamp(420px,31vw,560px) minmax(0,1fr)}'

  // clamp() rather than breakpoints so the headline tracks the viewport continuously; the 4.3vw
  // middle term is what keeps "Many networks." and "One Core." each on the one line the markup's
  // two <i> elements are written for.
  + '.hero .lxu-h1,.lxu-hero .lxu-h1{font-size:clamp(48px,4.3vw,78px);line-height:.96;'
  + 'letter-spacing:-.036em;text-wrap:balance}'

  // The sub is the one line of prose in the hero, so it gets a real measure instead of running the
  // full column width. 46ch holds it to two or three lines at desktop.
  + '.hero .lxu-sub,.lxu-hero .lxu-sub{font-size:clamp(16px,1.2vw,19px);line-height:1.55;'
  + 'max-width:46ch;color:var(--text-muted);text-wrap:pretty}'
  + '}'

  // Section headings: decisively subordinate to the h1. Gated to the same >=900px for the same
  // reason as the hero -- the inversion was measured at desktop, the phone layouts were tuned by the
  // transforms that built them, and a scale written to fix one must not silently reach into the
  // other. px and vw only, for the 21.5px-root reason above. The ceiling (42px) sits under the
  // headline's floor across the whole range, so the ranking cannot invert again at any width.
  + '@media (min-width:900px){'
  + '#products .center-head .block-title,'
  + '#networks .lx-sec-head h2,'
  + 'section.lx-faq>h2{font-size:clamp(28px,2.6vw,42px);line-height:1.12;letter-spacing:-.022em;'
  + 'font-weight:800;text-wrap:balance;margin:0 0 14px}'
  + '}'

  // ---- 2. THE AXIS --------------------------------------------------------------------------
  // Left, matching the hero and the final CTA. `margin-inline:0` undoes the `margin:0 auto` that
  // centred the head blocks; without it the block stays centred and only its text moves.
  + '#products .center-head,#networks .lx-sec-head{text-align:left;margin-inline:0;max-width:none}'
  + 'section.lx-faq>h2{text-align:left}'
  // The category row was justify-content:center, set when the heading above it was centred too.
  // With the heading on the left rail a centred row of pills underneath reads as a mistake.
  //
  // THE PILLS AND THEIR COUNTS STAY. The obvious design note here is that 56 questions behind eight
  // tabs is a documentation page rather than a landing section -- and that note is wrong on this
  // page, which is why it is written down. Measured: exactly SIX questions are visible at rest; the
  // other seven panes are display:none. The reader already sees six. The remaining fifty are in the
  // HTML on purpose, because this section is the site's AEO layer (see the header of _faq.js) and
  // carries the FAQPage structured data -- an answer engine reads a display:none pane perfectly
  // well. "Trim it to six and link out" would have changed nothing a human sees and deleted fifty
  // crawler-visible answers. The counts are information, so they stay too.
  + 'section.lx-faq .lx-faqtabs{justify-content:flex-start}'
  // The supporting line gets a measure and stays on the left rail rather than being centred under a
  // now-left-aligned heading.
  + '#products .center-head .block-sub,#networks .lx-sec-head p{max-width:58ch;margin-inline:0;'
  + 'text-align:left;font-size:clamp(15px,1.15vw,17.5px);line-height:1.6;color:var(--text-muted);'
  + 'text-wrap:pretty}'

  // ---- 3. FIGURES ---------------------------------------------------------------------------
  // This is a page about a trading venue and the numbers on it -- 0.2%, 0.1%, 250,000 -- are the
  // claims a reader checks. Lining figures so they read as data rather than as prose.
  + '#networks .lx-why-card h3,#networks .lx-why-card p,'
  + '.lx-faq p,.lx-faq li{font-variant-numeric:tabular-nums}'

  // ---- 4. RHYTHM ----------------------------------------------------------------------------
  // The sections were set at 88px top / 96px bottom, which is tight for a page whose hero is a
  // full-viewport pinned scene. Optical rather than symmetric: the bottom carries slightly more, so
  // the gap reads as even against the heading weight sitting at the top of the next section.
  + '@media (min-width:901px){'
  + '.lx-netline.lx-why{padding:116px 0 128px}'
  + '.lx-faq{padding-top:112px;padding-bottom:120px}'
  + '#products .center-head{margin-bottom:52px}'
  + '}'

  + '</st' + 'yle>';

// ---------------------------------------------------------------------------------------------

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

  html = html.replace(/<style id="lx-landingrefine">[\s\S]*?<\/style>/g, '');

  const applied = [];
  for (const c of COPY) {
    const hasFrom = html.indexOf(c.from) >= 0;
    const hasTo = html.indexOf(c.to) >= 0;
    if (!hasFrom && !hasTo) {
      // Neither the original nor our replacement is present: the copy moved underneath us and a
      // blind write here would leave the page inconsistent. Abort rather than half-apply.
      problems.push(p.key + ': ' + c.what + ' -- neither original nor replacement found');
      continue;
    }
    if (hasFrom) {
      const n = html.split(c.from).length - 1;
      if (n !== 1) { problems.push(p.key + ': ' + c.what + ' -- expected 1 occurrence, found ' + n); continue; }
      html = html.split(c.from).join(c.to);
      applied.push(c.what);
    }
  }

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
  staged.push({ file: p.file, data, s, e, json, key: p.key, applied });
}

if (problems.length) {
  console.error('landing-refine: ABORT - nothing written.');
  problems.forEach(x => console.error('  ' + x));
  process.exit(1);
}
for (const st of staged) {
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.key + ': type scale + left axis, copy rewritten ['
    + (st.applied.join(', ') || 'already current') + ']');
}
console.log('landing-refine: done on ' + staged.length + ' page(s)');
