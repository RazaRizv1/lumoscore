// Two guards for the logo healer, added where the healer already has one.
//
// THE HEALER. Inside the design's nxnav-js there is a run() that walks every span/div/i/b on the
// page, takes any element whose whitespace-stripped text is 1-5 characters, resolves it as a ticker
// and calls place() -- which wipes textContent and paints a logo as a background image. It re-runs
// on a timer and on mutations, so cleaning up after it loses; the fix has to be a refusal.
//
// isCandidate() is where a refusal belongs, and it already holds one of these:
//
//     if(/^\d+$/.test(t)) return false;        // step dots / counters, never a token
//
// This transform appends two more beside it. Both can only make the healer paint FEWER things.
//
// ---- GUARD 1: a number with a magnitude suffix is never a ticker ---------------------------------
//
// The $LUMOS supply card's headline is "1B". It is not pure digits, so the existing rule lets it
// through, and looksLikeIcon() returns true for anything with a gradient background -- which is
// exactly how the design paints gradient TEXT (background:linear-gradient + background-clip:text).
// So the styling that makes the number look like a headline is what makes it look like an icon. The
// div ends up with no text and no intrinsic height and collapses to 0px.
//
// Measured on XRPL staging 2026-10-14 by trapping the textContent setter: place() blanked
// `.supply-totem .big` 108 times in 13 seconds. This repo carries the same healer and the same gap --
// it is inherited design code, not fork drift -- and _xrpllogoguard.js, which fixed it on the fork,
// closes with "NOT DONE ON STELLAR ... Logged for that side separately". This is that side.
//
// `1INCH` DELIBERATELY STILL PASSES: the suffix is anchored at the end, so "1B", "9.97B", "1,000"
// and "1.5M" are rejected while a real ticker that merely starts with a digit is not. That is the
// one case worth getting wrong in the safe direction -- a missed logo is cosmetic, an erased number
// is a lie about supply.
//
// ---- GUARD 2: an element classed as a button is never a logo slot --------------------------------
//
// RAZA 2026-10-20: "On create pool popup, in Asset 1 on right side, its showing tiny Lumos logo
// instead of Max". Measured on the LUMOS token page by trapping setAttribute and reading the stack:
//
//     at place (…:4731) <- at run (…:4749)        data-logo="LUMOS" on <span class="max-btn">
//
// Every step of isCandidate passes for that button. Its text is "MAX" -- three characters, not pure
// digits -- and looksLikeIcon() returns true on `parseFloat(borderRadius) >= 4`, which our own rule
// in _ammdata.js supplies: `#createPoolModal .field-foot .max-btn{...border-radius:6px...}`. The
// symbol does not come from the text at all; symFor() walks up to the nearest row and reads the
// tickers in it, which on this card is LUMOS. That is why Asset 1 was eaten and Asset 2, with no
// asset chosen yet, still said MAX.
//
// So the trigger is a styling choice of ours and the damage is to a control, not to a label. The
// healer's own positive test is a class naming the element an icon (ic|ico|icon|logo|coin|mark|
// avatar); the symmetric refusal is a class naming it a button. A logo slot is never classed "btn".
// Narrow on purpose: only `btn` or `button` as a whole dash/underscore/space-separated word, so
// `.max-btn`, `.pct-btn` and `.btn` are refused while `.a-ico`, `.pa`, `.pb`, `.dex-mint-ic` and
// `.dxa-trade-ic` -- the real logo slots -- are untouched.
//
// WHY NOT AN INERT <img> CHILD. isCandidate also bails on any element already holding an img or svg,
// and that escape is what extract_site.js uses for the four asset-page stat cells. It fixes one
// element at a time. This is a class of bug -- any "9.97B" in a styled box, any short-labelled
// control in a rounded chip -- so it belongs in the rule, not in 11 pages of markup.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');

const B = String.fromCharCode(92);

// The healer's existing rule, as it appears in the decoded page source.
const FIND = 'if(/^' + B + 'd+$/.test(t)) return false;';

// Ours, appended to it. Each is kept on the same line so no newline escaping is involved.
const GUARD_NUM = ' if(/^' + B + 'd[' + B + 'd.,]*[KMBT]?$/i.test(t)) return false;';
const GUARD_BTN = ' if(/(^|[' + B + 's_-])(btn|button)([' + B + 's_-]|$)/i.test(String(el.className||""))) return false;';

// Anything already carrying these has been patched. The replacement contains its own search string,
// so without this check a second run would append the guards again and a third would add a third
// copy -- the idempotence trap these transforms keep walking into.
const MARKS = ['[KMBT]?$/i.test(t)', '(btn|button)'];

const problems = [];
const staged = [];
let found = 0, addedNum = 0, addedBtn = 0, already = 0;

for (const file of fs.readdirSync('.').filter((f) => /^lumoscore-.*-(desktop|mobile)\.html$/.test(f))) {
  let data; try { data = read(file); } catch (e) { problems.push(file + ': ' + e.message); continue; }
  let json, s, e;
  try { ({ json, s, e } = getContents(data)); } catch (err) { problems.push(file + ': ' + err.message); continue; }

  let touched = 0;
  for (const key of Object.keys(json)) {
    if (typeof json[key] !== 'string') continue;
    let h = json[key];
    const n = h.split(FIND).length - 1;
    if (!n) continue;
    found += n;

    // Each guard is tracked by its own mark, so a page that already has guard 1 (none do today, but
    // a partial run or a future third guard makes this real) still receives guard 2.
    const needNum = h.indexOf(MARKS[0]) < 0;
    const needBtn = h.indexOf(MARKS[1]) < 0;
    if (!needNum && !needBtn) { already += n; continue; }

    let add = '';
    if (needNum) { add += GUARD_NUM; addedNum += n; }
    if (needBtn) { add += GUARD_BTN; addedBtn += n; }

    h = h.split(FIND).join(FIND + add);
    json[key] = h;
    touched += n;
  }
  staged.push({ file, data, s, e, json, touched });
}

// Silence is the failure mode. If the healer is ever re-minified or its rule re-spaced this stops
// matching, and without this check it would report success while shipping the bug.
if (!found) problems.push('the healer guard was not found in any container - has nxnav-js changed?');

if (problems.length) {
  console.error('logo guard: ABORT, nothing written.');
  problems.forEach((x) => console.error('  ' + x));
  process.exit(1);
}

let containers = 0;
for (const st of staged) {
  if (!st.touched) continue;
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  containers++;
}

console.log('logo guard: magnitude ' + addedNum + ', button ' + addedBtn
  + (already ? ', ' + already + ' already had both' : '')
  + ' (' + found + ' healer copies seen) across ' + containers + ' container(s)');
