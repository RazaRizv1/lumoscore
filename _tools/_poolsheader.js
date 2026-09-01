// The Pools pages shipped a different app bar from every other mobile page.
//
// Measured at 430px with a wallet connected, comparing the built pages:
//
//                        appbar padding   appbar gap   logo-text size   letter-spacing
//   trade / trade-asset  13.2 / 17.6      11px         17.6px           -0.4px
//   wallet               13.2 / 17.6      11px         17.6px           -0.4px
//   pools main + detail  13.2 / 15.4      9.9px        16.5px           -0.2px
//
// So the wordmark is a size smaller and set tighter, and the whole bar is inset less. Side by side it
// reads as a different header, which is what it is -- the Pools pages came from their own design
// source and never picked up the values the rest of the app settled on.
//
// Those four were real but they were NOT the whole story, and the first pass at this stopped there.
// A full computed-style diff of the header subtree, Trade against Pools at 430px, found two more --
// and these are the ones you can actually see:
//
// 1. THE SPACER IS NOT OPTIONAL. Every other page pushes the right-hand controls over with a
//    <div class="grow">, which is flex:1. Pools had no spacer and leaned on flex:1 on .logo instead.
//    Those look equivalent and are not: @media (max-width:560px) sets
//        .appbar .logo{flex:0 0 auto!important}
//    so on a phone -- the only place this layout is used -- the thing doing the pushing is switched
//    off. Measured at 430px: Trade's last control ends at x=413, hard against the 412.4px content
//    edge; Pools' ended at 393, nineteen pixels short. The controls were simply packed left.
//
// 2. THE WHOLE PAGE IS 7% BIGGER. html, body font-size is 15.4px on Trade and Wallet and 16.5px on
//    both Pools pages (14px vs 15px before _typescale.js). Everything sized in em or rem inherits
//    that, header included, which is why the Pools header kept reading as larger even after the
//    wordmark itself was matched.
//
// So Pools now gets the spacer, loses the flex:1 on .logo that the media query was disabling anyway,
// and takes the same base font size as the rest of the app.
//
// The desktop Pools header is a different design and is deliberately left alone. So is the dashboard,
// which already carries the 17.6px wordmark and was not part of the complaint.
//
// NOT re-scaled by _typescale.js: these blocks already carry its data-lxts stamp, so the values below
// are final px, matched to what the other pages already render.
//
// Usage: node _tools/_poolsheader.js
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// Only the phone builds of the pages that came from that design source.
//
// The public account page was added later, when its header was reported as breaking. It is the same
// defect from the same origin, not a lookalike -- checked before adding it rather than assumed, and
// every value below was already present on it to change:
//   .appbar padding 13.2/15.4, .logo-text 16.5px at -0.2px, html+body 16.5px, .logo flex:1, no spacer.
// Measured at 375px with no wallet connected, its last control ended at x=269 in a 375px viewport
// while Trade's reached the edge -- the controls were packed left with 106px of empty bar beside them.
//
// Its bar is a <div class="appbar">, not a <header class="appbar"> like the others. That is why a grep
// for the header tag says this page has no app bar at all. The matching below keys on class="appbar",
// so it finds either.
const KEYS = ['lumoscore-amm-mobile.html', 'lumoscore-amm-pool-mobile.html',
  'lumoscore-account-mobile.html'];

// [ the rule to look inside, what to change within it ]
const FIXES = [
  ['.appbar', [
    ['padding:13.2px 15.4px', 'padding:13.2px 17.6px'],
    ['gap:9.9px', 'gap:11px'],
  ]],
  ['.logo-text', [
    ['font-size:16.5px', 'font-size:17.6px'],
    ['letter-spacing: -0.2px', 'letter-spacing: -0.4px'],
  ]],
  // The base every em and rem on the page is measured from.
  ['html, body', [
    ['font-size:16.5px', 'font-size:15.4px'],
  ]],
  // .logo stops stretching. The media query already forced flex:0 0 auto on a phone, so this changes
  // nothing there -- it just stops .logo and the new spacer fighting on a wider screen.
  ['.logo', [
    ['flex: 1;', ''],
    ['min-width: 0;', ''],
  ]],
];

// The spacer the other pages have, in CSS and in markup.
const GROW_CSS = '.grow { flex: 1; }';
const GROW_TAG = '<div class="grow"></div>';

// Rewrites only INSIDE the named rule's braces, so "gap:9.9px" elsewhere in the stylesheet is safe.
function patchRule(css, selector, pairs) {
  const at = css.indexOf(selector + ' {');
  const start = at >= 0 ? at : css.indexOf(selector + '{');
  if (start < 0) return { css, hits: 0 };
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  if (open < 0 || close < 0) return { css, hits: 0 };
  let body = css.slice(open, close);
  let hits = 0;
  for (const [from, to] of pairs) {
    if (body.indexOf(from) < 0) continue;      // already aligned, or never had it
    body = body.split(from).join(to);
    hits++;
  }
  return { css: css.slice(0, open) + body + css.slice(close), hits };
}

let pages = 0, edits = 0;
for (const c of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain', 'stellar', 'xrpl']) {
  const file = 'lumoscore-' + c + '-mobile.html';
  let data; try { data = read(file); } catch (e) { continue; }
  let json, s, e; try { ({ json, s, e } = getContents(data)); } catch (err) { continue; }

  let changed = false;
  for (const key of KEYS) {
    if (typeof json[key] !== 'string') continue;
    let h = json[key];
    let hits = 0;
    for (const [sel, pairs] of FIXES) {
      const r = patchRule(h, sel, pairs);
      h = r.css; hits += r.hits;
    }

    // The spacer: the rule, then the element. Both guarded, so a re-run adds neither twice.
    if (h.indexOf(GROW_CSS) < 0 && h.indexOf('.grow{flex:1}') < 0) {
      const at = h.indexOf('.appbar {');
      const end = at >= 0 ? h.indexOf('}', at) : -1;
      if (end >= 0) { h = h.slice(0, end + 1) + '\n    ' + GROW_CSS + h.slice(end + 1); hits++; }
    }
    // Between the logo and the first control, which is where the other pages put it.
    const bar = h.indexOf('class="appbar"');
    if (bar >= 0 && h.indexOf(GROW_TAG, bar) < 0) {
      const anchor = h.indexOf('<div class="avatar-sm"', bar);
      // Only if that control is close by -- otherwise we are looking at some other part of the page.
      if (anchor > bar && anchor - bar < 900) {
        h = h.slice(0, anchor) + GROW_TAG + h.slice(anchor);
        hits++;
      }
    }
    if (hits) { json[key] = h; changed = true; edits += hits; pages++; }
  }
  if (changed) {
    const ser = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + ser + data.slice(e), 'utf8');
  }
}
console.log('pools header: aligned with the app bar on ' + pages + ' page key(s), ' + edits + ' value(s)');
