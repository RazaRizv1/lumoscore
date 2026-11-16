// The phone bottom bar on the launchpad page, with Launch lit. Stellar twin of NEAR's _nearlaunchbar.js.
//
// Once the bar's Pools tab becomes Launch (_mobnavlaunch.js), tapping it leads to the one page in the bar that was
// never given a bar -- so the navigation would disappear underneath the user at exactly the moment they used it. Every
// other tab's destination keeps the bar with its own tab lit; the launchpad should too.
//
// NOTHING IS DRAWN NEW. The bar, its stylesheet and its script are copied verbatim from the bridge page (whose bar
// _mobnavlaunch has already given the Launch tab), so the launchpad's bar IS the same bar -- only which tab is lit
// differs. The optional tablet/viewport sheets are copied only where the source page carries them, because a fork that
// has never had them on any of its bar pages should not get them on this one page alone: the bar here must match the
// bar everywhere else in ITS OWN build, not the richest build.
//
// The launchpad already pins its cost summary to the bottom (.summary-fixed, bottom:0), which the bar would now cover.
// That panel is raised by the bar's height and the page's bottom padding grows by the same, keeping the last field
// clear of both.
//
// Only the launchpad page itself: Review and Confirm are steps inside one launch and carry no bar on any chain.
// Run AFTER _mobnavlaunch.js. Idempotent: a launchpad that already has the bar is left alone.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const CONTAINER = 'lumoscore-aptos-mobile.html';
const SRC = 'lumoscore-bridge-mobile.html';
const DST = 'lumoscore-launch-token-mobile.html';
const BAR_H = 72;      // .nb-bar{height:72px} in nbnav-css
const BODY_PB = 220;   // the launchpad's own body padding-bottom, which the bar now sits inside

// nbnav-css and nbnav-js are the bar itself and cannot be skipped. The other two are build-added overrides that some
// forks have never carried.
const NEEDED = [['style', 'nbnav-css', true], ['style', 'lx-nbwide', false], ['style', 'lx-nbviewport', false], ['script', 'nbnav-js', true]];

function block(h, tag, id) {
  const i = h.indexOf('<' + tag + ' id="' + id + '"');
  if (i < 0) return null;
  const end = '</' + tag + '>';
  const j = h.indexOf(end, i);
  return j < 0 ? null : h.slice(i, j + end.length);
}

const data = read(CONTAINER);
const { json, s, e } = getContents(data);
const src = json[SRC], dst = json[DST];
if (typeof src !== 'string' || typeof dst !== 'string') { console.error('mob launch bar ABORT: missing ' + SRC + ' or ' + DST); process.exit(1); }

if (dst.indexOf('class="nb-bar"') >= 0) {
  console.log('mob launch bar: already on the launchpad page');
  process.exit(0);
}

const n0 = src.indexOf('<nav class="nb-bar"');
if (n0 < 0) { console.error('mob launch bar ABORT: no bar on ' + SRC); process.exit(1); }
const n1 = src.indexOf('</nav>', n0);
if (n1 < 0) { console.error('mob launch bar ABORT: unterminated bar on ' + SRC); process.exit(1); }

let nav = src.slice(n0, n1 + 6);
if (nav.indexOf('data-id="launch"') < 0) { console.error('mob launch bar ABORT: the bar has no Launch tab (run _mobnavlaunch.js first)'); process.exit(1); }
// Clear whatever the bridge page lit, then light Launch.
nav = nav.split('class="nb-tab active"').join('class="nb-tab"')
         .split('<a class="nb-tab" data-id="launch"').join('<a class="nb-tab active" data-id="launch"');
if (nav.indexOf('class="nb-tab active" data-id="launch"') < 0) { console.error('mob launch bar ABORT: could not light the Launch tab'); process.exit(1); }

const parts = {}, copied = [], skipped = [];
for (const [tag, id, required] of NEEDED) {
  const b = block(src, tag, id);
  if (!b) {
    if (required) { console.error('mob launch bar ABORT: ' + SRC + ' has no ' + id); process.exit(1); }
    skipped.push(id);
    continue;
  }
  if (dst.indexOf(' id="' + id + '"') >= 0) { console.error('mob launch bar ABORT: ' + DST + ' already has ' + id); process.exit(1); }
  parts[id] = b;
  copied.push(id);
}

const lift = '<style id="lx-moblaunchbar">html .summary-fixed{bottom:' + BAR_H + 'px!important}'
  + 'html body{padding-bottom:' + (BODY_PB + BAR_H) + 'px!important}</style>';

let h = dst;
const hd = h.indexOf('</head>');
const bd = h.lastIndexOf('</body>');
if (hd < 0 || bd < 0 || h.split('</body>').length !== 2) { console.error('mob launch bar ABORT: ' + DST + ' head/body not found exactly once'); process.exit(1); }

h = h.slice(0, bd) + nav + parts['nbnav-js'] + h.slice(bd);
h = h.slice(0, hd) + copied.filter((id) => id !== 'nbnav-js').map((id) => parts[id]).join('') + lift + h.slice(hd);

json[DST] = h;
fs.writeFileSync(CONTAINER, data.slice(0, s) + JSON.stringify(json).split('</').join('<' + B + '/') + data.slice(e), 'utf8');
console.log('mob launch bar: bottom bar on the launchpad page, Launch lit; copied ' + copied.join(', ')
  + (skipped.length ? '; not present on ' + SRC + ' so not copied: ' + skipped.join(', ') : ''));
