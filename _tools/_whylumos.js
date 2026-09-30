// Replace the networks section with "Why Choose LumosCore?".
//
// The section was "Live on Stellar, with more to come." over three chain cards. It becomes four
// reasons instead. The section element itself is kept -- same tag, same id -- because the nav links to
// #networks and the anchor has to keep resolving; only its contents are rewritten.
//
// THE NAV LABEL IS CHANGED WITH IT. A link that says "Networks" and jumps to "Why Choose LumosCore?"
// is broken, and it is broken by this change specifically, so the label becomes "Why LumosCore" and
// the anchor stays #networks. Renaming the id instead would break every other transform that finds
// this section by it.
//
// EVERY NUMBER HERE IS CHECKED against the source of truth rather than written from memory:
// _feerate.js sets 0.2% / 0.1% with a 250,000 LUMOS threshold, and _faq.js states the same in words.
// If the fee ever moves, those two and this file have to move together.
//
// Re-injects: strips its own output first, so the copy can be edited and the transform re-run.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// The head is owned here but kept in step with _landingrefine.js, which rewrites landing copy and
// checks for BOTH the old string and the new one before deciding to act. Emitting the new text here
// means that transform finds its replacement already present and no-ops, rather than aborting.
//
// "Why Choose LumosCore?" was Title Case, and a question the page then answered about itself -- the
// most template-shaped heading on the landing page. The four items under it are claims with numbers
// in them aimed at someone deciding whether to connect a wallet, so the heading frames them as
// checkable rather than as selling points.
const HEAD = 'Worth checking before you connect.';
const SUB = 'Four claims, each one you can verify yourself.';

// Duotone, matching the product cards: a filled plate of the same colour under a stroked outline, so
// the weight comes from an area rather than a hairline. The monoline set this replaces was drawn at
// stroke-width 1.9 for 24px and shown at 28 -- thin enough that four of them in a row read as one grey
// block. `fill` and `stroke` are set per shape here rather than on the <svg>, which is what lets a
// single path be both.
const ICON = (paths) => '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" '
  + 'aria-hidden="true">' + paths + '</svg>';
// Same path twice -- once as a 26%-opacity fill, once as the stroke over it.
const duo = (d, w) => '<path d="' + d + '" fill="currentColor" opacity=".26"/>'
  + '<path d="' + d + '" stroke="currentColor" stroke-width="' + (w || 1.9) + '" '
  + 'stroke-linejoin="round" stroke-linecap="round"/>';
const line = (d, w) => '<path d="' + d + '" stroke="currentColor" stroke-width="' + (w || 2.1) + '" '
  + 'stroke-linecap="round" stroke-linejoin="round"/>';
const dot = (cx, cy, r, fill) => '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" '
  + (fill ? 'fill="currentColor" opacity=".26"/><circle cx="' + cx + '" cy="' + cy + '" r="' + r
      + '" stroke="currentColor" stroke-width="1.9"/>'
    : 'stroke="currentColor" stroke-width="1.9"/>');
const box = (x, y, fill) => {
  const d = 'M' + (x + 2.2) + ' ' + y + 'h3.2a2.2 2.2 0 0 1 2.2 2.2v3.2a2.2 2.2 0 0 1-2.2 2.2h-3.2'
    + 'a2.2 2.2 0 0 1-2.2-2.2v-3.2a2.2 2.2 0 0 1 2.2-2.2z';
  return fill ? duo(d) : line(d, 1.9);
};

// Four reasons, in the order they were asked for. Each is one claim and one supporting sentence --
// the products grid above already lists features, so this section has to argue rather than enumerate.
const CARDS = [
  {
    key: 'all',
    // Four panes, the diagonal pair filled -- the rhythm is what stops a 2x2 grid reading as a
    // loading placeholder.
    icon: ICON(box(3.2, 3.2, true) + box(13.2, 3.2, false)
      + box(3.2, 13.2, false) + box(13.2, 13.2, true)),
    title: 'Everything in one place',
    body: 'Trade, provide liquidity, bridge, launch a token and manage your portfolio from a single '
      + 'interface. No hopping between a DEX, a bridge and three explorers to finish one job.'
  },
  {
    key: 'custody',
    icon: ICON(duo('M12 2.5l7.5 3v6c0 4.6-3.1 8.6-7.5 10-4.4-1.4-7.5-5.4-7.5-10v-6z')
      + line('M8.9 12.1l2.2 2.2 4-4.3', 2.2)),
    title: 'Non-custodial and open source',
    body: 'Your keys never leave your wallet and LumosCore never holds your funds — there is nothing '
      + 'to deposit and nothing to withdraw. The code is open for anyone to read.'
  },
  {
    key: 'fees',
    icon: ICON(duo('M20.6 13.4L13.4 20.6a2 2 0 0 1-2.83 0l-7.16-7.16A2 2 0 0 1 2.83 12V4a1 1 0 0 1 1-1'
      + 'h8a2 2 0 0 1 1.41.59l7.37 7.37a2 2 0 0 1 0 2.83z')
      + '<circle cx="7.6" cy="7.6" r="1.6" fill="currentColor"/>'),
    title: '0.2% fees, or 0.1%',
    body: 'A flat 0.2% per trade, halved to 0.1% when you hold 250,000 LUMOS — pool-held LUMOS counts '
      + 'too. Limit orders are free, because an order that may never fill should not cost you anything.'
  },
  {
    key: 'chains',
    // Three linked nodes, NOT the globe it replaces. A globe says "global" or "language"; the claim
    // on this card is that more than one chain is wired into the same app, which is a graph.
    // Edges are drawn first so the node discs cover their ends.
    icon: ICON(line('M6.2 7.4L12 16.6M17.8 7.4L12 16.6M6.2 7.4h11.6', 1.9)
      + dot(6.2, 7.4, 3.1, true) + dot(17.8, 7.4, 3.1, false) + dot(12, 16.6, 3.1, true)),
    title: 'Built for more than one chain',
    body: 'Stellar today and XRP Ledger alongside it, with more to come. One account, one interface, '
      + 'and every new network arrives as somewhere else to explore rather than another tool to learn.'
  }
];

// A DEFINITION LIST, NOT A CARD ROW, and the change is the point of this pass.
//
// Four equal cards in a row is the single most recognisable generated-layout pattern there is, and
// this page was running it directly under a six-card products grid -- the same treatment (border,
// dark fill, radius, duotone icon plate) stamped out twice in a row, which flattens the hierarchy
// between two sections that are doing completely different jobs. The products grid enumerates
// features; this section argues four claims. Different job, different form.
//
// A spec sheet is the honest form for a claim someone is about to verify: term on the left, the
// substance on the right, hairline between rows, nothing elevated. It also reads correctly to a
// screen reader, which a div soup of cards does not -- <dl>/<dt>/<dd> IS a list of terms and their
// definitions, so the semantics were sitting there unused.
//
// The <div> wrapper inside <dl> is deliberate and valid: the HTML spec allows a single div to group
// one dt/dd pair, which is what makes each row a grid container of its own.
function rowHtml(c) {
  return '<div class="lx-wsrow" data-why="' + c.key + '">'
    + '<dt class="lx-wsterm"><span class="lx-wsic">' + c.icon + '</span>' + c.title + '</dt>'
    + '<dd class="lx-wsdef">' + c.body + '</dd>'
    + '</div>';
}

const INNER = '<div class="container">'
  + '<div class="lx-sec-head lx-whyhead"><h2>' + HEAD + '</h2><p>' + SUB + '</p></div>'
  + '<dl class="lx-whyspec">' + CARDS.map(rowHtml).join('') + '</dl>'
  + '</div>';

const CSS = '<style id="lx-whylumos">'
  + '.lx-netline.lx-why{padding:88px 0 96px}'

  // ---- THE SPEC LIST ------------------------------------------------------------------------
  // A rule above the first row and below each one, so the section reads as a table of claims. The
  // rules are the only structure: no card border, no fill, no shadow, no radius. Elevation is a
  // signal and this section is not signalling "four separate objects", it is signalling "one list".
  + '.lx-whyspec{margin:0;border-top:1px solid var(--border)}'
  // 34/66 split. The term column is wide enough for "Non-custodial and open source" on two lines and
  // no wider -- a wider one would let the prose column fall under 60ch and start wrapping badly.
  + '.lx-wsrow{display:grid;grid-template-columns:minmax(0,34%) minmax(0,1fr);gap:16px 56px;'
  + 'align-items:start;padding:30px 0 32px;border-bottom:1px solid var(--border);'
  + 'transition:background-color .22s ease}'
  // Bottom padding carries 2px more than the top: the term sits on a cap-height and the definition
  // on a baseline, so a symmetric pad reads as top-heavy against the rule below it.

  // Not links, so the response is a wash rather than a lift -- and a wash cannot cause the
  // hover-flicker band that a translateY on a bottom edge does (the reason the old cards scaled from
  // transform-origin:center bottom instead of lifting).
  + '.lx-wsrow:hover{background-color:rgb(var(--wc)/.045)}'

  + '.lx-wsterm{display:flex;align-items:flex-start;gap:12px;margin:0;'
  + 'font-size:19px;font-weight:800;letter-spacing:-.3px;line-height:1.3;color:var(--text);'
  + 'text-wrap:balance}'
  // The glyph keeps its hue but loses the 54px plate it used to sit in. The plate was what made each
  // row read as a card; the glyph alone still colour-codes the row.
  + '.lx-wsic{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;'
  + 'width:22px;height:22px;margin-top:1px;color:rgb(var(--wc));transition:transform .22s ease}'
  + '.lx-wsic svg{width:22px;height:22px}'
  + '.lx-wsrow:hover .lx-wsic{transform:translateX(2px)}'

  + '.lx-wsdef{margin:0;font-size:16px;line-height:1.72;color:var(--text-muted);max-width:64ch;'
  + 'text-wrap:pretty}'
  // The fee row is the one with figures in it, so they get lining numerals and the term is set in
  // the mono face the rest of the app uses for numbers.
  + '.lx-wsrow[data-why="fees"] .lx-wsterm{font-family:"JetBrains Mono",ui-monospace,monospace;'
  + 'font-size:17.5px;letter-spacing:-.5px}'
  + '.lx-whyspec{font-variant-numeric:tabular-nums}'

  // ONE ACCENT PER ROW. The hues are the products grid's own palette, so the page stays one system
  // rather than gaining a second. They now drive a 22px glyph and a 4.5%-opacity hover wash instead
  // of a filled plate, a gradient border and a corner bloom -- the colour still codes the row, but it
  // is no longer the thing that makes the row look like an object.
  //
  // Held as an "R G B" triple rather than a hex so one custom property can drive the solid colour AND
  // every tint off it: `rgb(var(--wc)/.045)`. Four hexes per row would be four places to get out of
  // step.
  + '.lx-wsrow{--wc:234 106 44}'
  + '.lx-wsrow[data-why="custody"]{--wc:52 211 122}'
  + '.lx-wsrow[data-why="fees"]{--wc:255 181 71}'
  + '.lx-wsrow[data-why="chains"]{--wc:139 123 255}'
  // Deeper on white. The dark-theme hues are picked to glow on a near-black ground, and the same
  // amber and green on a white one go pale enough that the glyph reads as disabled. Absent
  // `data-theme` IS the dark theme on this site, so only the light case needs restating, and the
  // brand orange already works on both.
  + '[data-theme="light"] .lx-wsrow[data-why="custody"]{--wc:18 163 90}'
  + '[data-theme="light"] .lx-wsrow[data-why="fees"]{--wc:184 115 10}'
  + '[data-theme="light"] .lx-wsrow[data-why="chains"]{--wc:108 92 231}'

  // ---- RESPONSIVE ---------------------------------------------------------------------------
  // Below 900 the two columns collapse to one: the term sits above its definition, which is what a
  // dl does by default anyway. The row rules stay -- they are what holds the list together once the
  // side-by-side relationship is gone, and they cost nothing.
  + '@media (max-width:900px){'
  + '.lx-netline.lx-why{padding:54px 0 58px}'
  + '.lx-wsrow{grid-template-columns:1fr;gap:10px;padding:22px 0 24px}'
  + '.lx-wsterm{font-size:17.5px}'
  + '.lx-wsrow[data-why="fees"] .lx-wsterm{font-size:16.5px}'
  + '.lx-wsdef{font-size:15px;line-height:1.65}'
  // The hover wash is a pointer affordance; on a touch screen it only ever fires as a stuck
  // highlight after a tap, so it is dropped rather than left to linger.
  + '.lx-wsrow:hover{background-color:transparent}'
  + '}'
  + '@media (max-width:1100px) and (min-width:901px){'
  + '.lx-netline.lx-why{padding:72px 0 78px}'
  + '.lx-wsrow{gap:16px 36px;grid-template-columns:minmax(0,38%) minmax(0,1fr)}'
  + '}'
  + '@media (prefers-reduced-motion:reduce){'
  + '.lx-wsrow,.lx-wsic,.lx-wsrow:hover .lx-wsic{transition:none;transform:none}}'
  + '</st' + 'yle>';

// Depth walk, so the section's own nested divs cannot confuse the end of it.
function elRange(html, startIdx, tag) {
  const re = new RegExp('<\\/?' + tag + '\\b', 'g');
  re.lastIndex = startIdx;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    if (m[0].charAt(1) === '/') { depth--; if (depth === 0) return { start: startIdx, end: html.indexOf('>', m.index) + 1 }; }
    else depth++;
  }
  return null;
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

  html = html.replace(/<style id="lx-whylumos">[\s\S]*?<\/style>/g, '');

  // MATCHED ON THE CLASS PREFIX, so this transform can run on its own output. It rewrites the class
  // to `lx-netline lx-why`, and the exact-match `lx-netline"` it used to look for then found nothing:
  // the file promised at the top that it re-injects, and it did not -- it only ever worked on a
  // container no previous run had touched, which is not a state that survives one rebuild. The abort
  // was correct and caught it; the claim in the header was the thing that was wrong.
  const SEC = '<section class="lx-netline';
  const at = html.indexOf(SEC);
  if (at < 0) { problems.push(p.key + ': networks section not found'); continue; }
  if (html.indexOf(SEC, at + 1) >= 0) {
    problems.push(p.key + ': more than one networks section'); continue;
  }
  const r = elRange(html, at, 'section');
  if (!r) { problems.push(p.key + ': networks section is not closed'); continue; }

  // The id is read off the page rather than assumed: the nav anchor depends on it, and writing a
  // guessed id here would break the link silently.
  const idM = /<section class="lx-netline[^"]*"([^>]*)>/.exec(html.slice(at, at + 300));
  const attrs = idM ? idM[1] : '';
  if (attrs.indexOf('id=') < 0) { problems.push(p.key + ': networks section has no id to preserve'); continue; }

  html = html.slice(0, r.start)
    + '<section class="lx-netline lx-why"' + attrs + '>' + INNER + '</section>'
    + html.slice(r.end);

  // ---- the nav label. "Networks" pointing at "Why Choose LumosCore?" is broken by this change, so
  // it changes with it. Desktop nav links only; the mobile slide menu is handled by its own markup
  // and is left alone unless it carries the same anchor text.
  const NAV_FROM = '<a href="#networks">Networks</a>';
  const NAV_TO = '<a href="#networks">Why LumosCore</a>';
  const navN = (html.match(/<a href="#networks">Networks<\/a>/g) || []).length;
  if (navN > 0) html = html.split(NAV_FROM).join(NAV_TO);

  const bo = html.lastIndexOf('</body>');
  html = bo >= 0 ? html.slice(0, bo) + CSS + html.slice(bo) : html + CSS;

  json[p.key] = html;
  staged.push({ file: p.file, data, s, e, json, key: p.key, navN });
}

if (problems.length) {
  console.error('why-lumoscore: ABORT — nothing written.');
  problems.forEach(x => console.error('  ' + x));
  process.exit(1);
}
for (const st of staged) {
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.key + ': networks section -> Why Choose LumosCore ('
    + CARDS.length + ' reasons), ' + st.navN + ' nav label(s) renamed');
}
console.log('why-lumoscore: done on ' + staged.length + ' page(s)');
