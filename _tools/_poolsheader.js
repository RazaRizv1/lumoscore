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
// This aligns the four. It does NOT touch the markup: the other pages push the right-hand controls
// over with a <div class="grow"> spacer while Pools does it with flex:1 on .logo, and those are
// equivalent -- adding a second stretcher alongside the first would only fight it.
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

// Only the phone builds of the two Pools pages.
const KEYS = ['lumoscore-amm-mobile.html', 'lumoscore-amm-pool-mobile.html'];

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
];

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
    if (hits) { json[key] = h; changed = true; edits += hits; pages++; }
  }
  if (changed) {
    const ser = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + ser + data.slice(e), 'utf8');
  }
}
console.log('pools header: aligned with the app bar on ' + pages + ' page key(s), ' + edits + ' value(s)');
