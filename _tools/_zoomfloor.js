// A 16px floor on every field a phone keyboard can open.
//
// WHY THIS EXISTS AS ITS OWN PASS. iOS Safari zooms the whole page when a focused input computes to
// less than 16px, and it does NOT zoom back out when the field loses focus. The reader is left in a
// magnified, sideways-scrolling page and has to pinch their way back. Android Chrome does not do it,
// and no desktop browser does, which is exactly why it survives every review that is not done on a
// phone.
//
// Measured on the deployed mobile build across all ten hub routes plus /mcp, reading the computed
// size off each element rather than trusting the stylesheet -- six fields were under the floor:
//
//   #poolSearch       /pools/*            our own rule (_tabs.js)
//   #mdxMkSearch      /trade/*            our own rule (_mobdex.js)
//   #ad-search-input  add-liquidity       14.3px, the design's base CSS
//   #brd-q            /bridge/*           14.5px, the design's base CSS
//   #br-addr-in       /bridge/*           15px,   the design's base CSS
//   #roundSel         /rewards/*          14.3px, the design's base CSS
//
// The last four are the design's own, so there is nothing of ours to correct -- they need an override
// layer, and that is this file. #br-addr-in is the bridge DESTINATION ADDRESS: being thrown into a
// magnified page while pasting a receiving address is the worst instance of this bug in the product.
//
// The first two ARE ours and are fixed at source (_tabs.js, _mobdex.js). They are listed here as well,
// at the same 16px, for two reasons: the values cannot disagree, and the XRPL fork carries a FROZEN
// copy of Stellar's built containers with no copy of either tool, so over there this file is the only
// thing that can reach them. Keeping both lists identical is what makes the two repos checkable
// against each other.
//
// HALF OF THESE ARE CLASSES, NOT IDS, and reading them off a DOM dump is how to get that wrong. The
// first pass wrote `#` for all six because the script that found them reported
// `el.id || el.name || el.className`, which prints a class exactly like an id. Three rules then sat in
// the page matching nothing. The tell that nearly hid it: .brd-q happens to compute to 16px on XRPL
// already, so `#brd-q` doing nothing looked like `#brd-q` working -- a rule that matches nothing is
// indistinguishable from a rule that won unless the before value is known. Each selector below is
// written as the page actually spells it.
//
// !important IS REQUIRED, and for the ids an ID selector on top of it. #poolSearch's authored rule is
// `.search-box.inline-filter input{...!important}`: an override has to clear both bars -- !important
// to compete at all, and an ID (1,0,0 against 0,2,1) to win the specificity tie. The three class
// fields are authored without !important, so importance alone settles them; they are written
// `input.x` rather than `.x` so they also outrank a same-class rule added later.
//
// A FLOOR CANNOT ALWAYS WIN, SO IT IS NOT THE ONLY MECHANISM. .br-addr-in stayed at 15px with the
// rule below in the page and matching: _bridgepolish.js writes it through a six-class descendant
// selector, (0,6,0) against this file's (0,1,1), and !important on both sides only moves the fight to
// specificity. It is fixed in _bridgepolish.js instead and kept in the list here as a backstop. The
// lesson for anything added later: check the computed value afterwards, because a losing rule and a
// winning rule look identical in the stylesheet.
//
// THE MOBILE CONTAINER ONLY, AND NO WIDTH QUERY. The first version wrote to both containers behind
// `@media (max-width:820px)`, which looked like the careful choice and was not. The desktop build
// authors these same fields at 16.5px -- already above the floor -- so between 517px and 820px the
// rule was pulling two of them DOWN half a pixel. A rule meant to stop a phone defect was the only
// thing changing the desktop build. Measured by disabling the sheet in the page and re-reading the
// computed sizes, which is the one way to see what a rule is actually doing rather than what it was
// for.
//
// Scoping to the container the phone is served instead of to a width also fixes the other end: a
// tablet in landscape gets the mobile build at ~1024px, is still a touch device, and still zooms on a
// sub-16px field -- a max-width query would have switched the floor off exactly there.
//
// `type=file` is excluded on purpose: there is nothing to type into one, so iOS does not zoom.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const ID = 'lx-zoomfloor-css';

// Named one per line so a diff shows exactly which field was added or dropped. The "#" / "input."
// split is not cosmetic -- see the note above about three rules that matched nothing.
const FIELDS = [
  '#poolSearch',              // pool filter, /pools/*
  '#mdxMkSearch',             // new-mints search, /trade/*
  '#roundSel',                // round picker, /rewards/*
  // "Search wallets…" inside the connect-wallet modal (#lcConnectModal). Verified a real id, not a
  // class, before writing the "#": getElementById hits, querySelectorAll('.lcWalletSearch') finds
  // nothing, and the element carries no class at all. Its only rule is the design's
  // `.lc-msearch input{font-size:14.3px}` with no !important, so an id plus !important settles it.
  '#lcWalletSearch',          // wallet picker in the connect modal, Trade-Asset pages
  'input.ad-search-input',    // asset picker inside the add-liquidity dialog
  'input.brd-q',              // network search, /bridge/*
  'input.br-addr-in',         // bridge DESTINATION ADDRESS, /bridge/*
  // The wallet's "Search asset…" field, on both chains. It carries NO id and NO class, which is
  // exactly why the first sweep missed it -- that sweep keyed on ids and classes, so a bare <input>
  // had nothing to report itself by. Matched through its wrapper instead. Broad on purpose: every
  // search box on a phone wants the floor, and the one other element this reaches (#poolSearch, via
  // .search-box.inline-filter) is already floored to the same 16px, so the two cannot disagree.
  '.search-box input',        // wallet asset search, /wallet
];

// A BIGGER FONT MADE A FLEX ITEM REFUSE TO SHRINK, and that is this file's own doing. A flex item
// defaults to min-width:auto, which floors it at its intrinsic width -- and an input's intrinsic
// width scales with its font-size. Raising #mdxMkSearch from 13.8px to 16px therefore widened the
// row it sits in: measured on /trade/xrpl at a 375px viewport, documentElement.scrollWidth went from
// 379 to 405. Setting min-width:0 puts it at exactly 375, at either size.
//
// Only this one field, and that is not a guess: of the eight floored above, #mdxMkSearch is the ONLY
// one whose computed min-width is "auto". The design already sets min-width:0 on #poolSearch,
// .ad-search-input and .search-box input -- its siblings in the same pattern -- so this is restoring
// the rule they have rather than inventing one, and a blanket min-width:0 across the list would be
// changing seven fields to fix one.
const CSS = FIELDS.map((s) => s + ':not([type=file])').join(',')
  + '{font-size:16px!important}'
  + '#mdxMkSearch{min-width:0!important}';
const STYLE = '<style id="' + ID + '">' + CSS + '</style>';

// Remove our own previous block before inserting, so a re-run replaces rather than stacks. Matching
// `<style id="ID">` with the ">" immediately after the id is the house pattern; nothing else is
// allowed onto this tag for exactly that reason (see the note in _typescale.js about an attribute
// quietly breaking every strip regex in the build).
const SELF = new RegExp('<style id="' + ID + '">[\\s\\S]*?<\\/style>', 'g');

// `insert` false strips our block and puts nothing back. Both containers are visited either way: an
// earlier version of this pass DID write to the desktop container, so skipping it outright would
// leave that stylesheet behind for good. Stripping everywhere and inserting in one place is what
// makes the pass converge on the right state from whatever it finds.
function apply(html, insert) {
  const cleaned = html.replace(SELF, '');
  if (!insert) return cleaned;
  const hi = cleaned.indexOf('</head>');
  // No </head> means this page key is a fragment, not a document -- leave it alone rather than
  // appending a stylesheet somewhere it will never be parsed as one.
  if (hi < 0) return null;
  return cleaned.slice(0, hi) + STYLE + cleaned.slice(hi);
}

const WRITE = process.argv.includes('--write');
let floored = 0, cleared = 0;

for (const dev of ['desktop', 'mobile']) {
  const file = 'lumoscore-aptos-' + dev + '.html';
  const insert = (dev === 'mobile');          // the build a phone is served -- see the note above
  let data; try { data = read(file); } catch (e) { continue; }
  let json, s, e; try { ({ json, s, e } = getContents(data)); } catch (err) { continue; }
  let changed = false;

  for (const k of Object.keys(json)) {
    const out = apply(json[k], insert);
    if (out === null || out === json[k]) continue;
    json[k] = out; changed = true;
    if (insert) floored++; else cleared++;
  }

  if (changed && WRITE) {
    const ser = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + ser + data.slice(e), 'utf8');
  }
}

console.log('zoomfloor: ' + FIELDS.length + ' field(s) floored at 16px on ' + floored
  + ' phone page key(s)'
  + (cleared ? ('; removed from ' + cleared + ' desktop page key(s)') : '')
  + (WRITE ? '' : '  (dry run -- pass --write)'));
