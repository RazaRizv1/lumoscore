// The mobile landing header's Launch App button, sized BEFORE the header is painted.
//
// RAZA 2026-11-13: "theres a flash bug on landing page. it shows big launch app button for split
// seconds." That is the button at its unstyled size. `.btn.primary` is a 48px full-width block, so
// until these rules apply the header renders one fat orange bar across the whole width with the
// wordmark squeezed out beside it — which is exactly the screenshot.
//
// THE CAUSE IS DISTANCE, NOT TIMING. Nothing here waits on JavaScript and nothing is slow. The header
// is markup about 201KB into the document; the stylesheet that sizes the button was appended before
// </body>, about 748KB in. A browser paints the header as soon as it has it and cannot know that a
// rule 547KB further down will resize it, so it shows the fat bar and then corrects itself. Moving
// the rule ahead of the markup it governs removes the window entirely — there is no first frame in
// which the button is the wrong size.
//
// WHY ITS OWN FILE. These rules were part of _herotext.js, whose stylesheet is appended at the end of
// the body on purpose: the rest of it styles the hero against some twenty later body-level sheets,
// and hoisting the whole layer to fix a header would re-cut that cascade. Only the header rules move.
//
// _herotext.js cannot be the one to move them either, because it can no longer run on these
// containers: its anchor is `<h1 class="hero-headline">`, and a later transform renames that element
// to `.lxu-h1`, so a re-run aborts with "hero headline not found". One transform's output is the
// next one's anchor, and the chain only runs forwards. This file anchors on the BUTTON, which nothing
// renames, so it is safe to run at any point and on its own.
//
// Nothing else in the build styles .lx-navlaunch — _herotext.js is the only thing that emits the
// class or the button — so this stylesheet has no cascade conflict to lose by sitting in the head.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const ID = 'lx-navlaunch-css';

// Present only on the mobile landing header. Nothing renames it, which is what makes it a usable
// anchor; a bare "lx-navlaunch" search would also match this stylesheet's own text and report the
// button present on a page that never had one.
const BUTTON = 'lx-navlaunch" data-lxnonav';

const CSS = '<style id="' + ID + '">'
  // Sized to sit level with the 36px icon button beside it rather than at the .btn default of 48px,
  // and the label is allowed to shrink before the nav starts wrapping on a 320px screen.
  + '.lx-navlaunch{display:none}'
  + '@media (max-width:900px){.lx-navlaunch{display:inline-flex;height:36px;padding:0 14px;'
  + 'font-size:13.5px;border-radius:9px;width:auto;flex:0 0 auto;margin-left:auto}'
  + '.nav .logo{flex:0 1 auto;min-width:0}}'
  // At 320px the row is 10px over: flex shrinks the logo's box, but its wordmark is overflow:visible
  // and simply runs on, ending 2px under the button. Measured — the boxes do not intersect, so a
  // left/right comparison says it fits while the ink says otherwise. The wordmark gives up 2.5pt,
  // which is enough for the row to stop shrinking at all.
  + '@media (max-width:360px){.lx-navlaunch{padding:0 10px;font-size:12.5px}'
  + '.nav .logo-text{font-size:14px}}'
  + '</' + 'style>';

const PAGES = [
  { file: 'lumoscore-aptos-desktop.html', key: 'lumoscore-landing.html' },
  { file: 'lumoscore-aptos-mobile.html', key: 'lumoscore-landing-mobile.html' }
];

// SWAP IN PLACE. Appending after a strip would move this layer to the end of the head on every run,
// which is the whole class of bug this file exists to stop.
function putLayer(p, openTag, block) {
  const at = p.indexOf(openTag);
  if (at >= 0) {
    const end = p.indexOf('</' + 'style>', at);
    if (end > at) return p.slice(0, at) + block + p.slice(end + ('</' + 'style>').length);
  }
  // LAST IN THE HEAD, so it still beats the design's own sheets, and still ahead of the header.
  const he = p.indexOf('</head>');
  return he < 0 ? null : p.slice(0, he) + block + p.slice(he);
}

const problems = [], staged = [];
for (const p of PAGES) {
  let data;
  try { data = read(p.file); } catch (e) { problems.push(p.file + ': missing'); continue; }
  const { json, s, e } = getContents(data);
  const html = json[p.key];
  if (html == null) { problems.push(p.key + ': missing'); continue; }

  // The desktop landing has its own header and never gets this button. Absence is not an error here,
  // but a page that HAS the button and does not get the stylesheet is, so the two are reported apart.
  if (html.indexOf(BUTTON) < 0) { console.log('  ' + p.key + ': no mobile nav button — skipped'); continue; }

  const out = putLayer(html, '<style id="' + ID + '">', CSS);
  if (out == null) { problems.push(p.key + ': no closing head'); continue; }

  // The rule has to land BEFORE the header it sizes, or this file has done nothing. Checked by
  // position rather than by presence: "the stylesheet is on the page" was true of the broken build too.
  const at = out.indexOf('id="' + ID + '"'), nav = out.indexOf(BUTTON);
  if (at < 0 || nav < 0 || at > nav) { problems.push(p.key + ': stylesheet is not ahead of the header'); continue; }

  json[p.key] = out;
  staged.push({ file: p.file, data, s, e, json, key: p.key, at, nav });
}

if (problems.length) {
  console.error('navlaunch css: ABORT — nothing written.');
  problems.forEach(x => console.error('  ' + x));
  process.exit(1);
}
for (const st of staged) {
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.key + ': nav stylesheet at ' + st.at + ', header at ' + st.nav);
}
