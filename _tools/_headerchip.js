// Take the designer's placeholder person out of what crawlers and AI assistants read.
//
// The inherited topbar carries a signed-in user chip:
//
//   <div class="user-chip"><div class="avatar">RR</div><div class="name">Raza Rizvi</div></div>
//
// It is hidden from humans by `.topbar .user-chip{display:none!important}` -- unconditional, not a
// signed-in/signed-out toggle, and no script in the build references `user-chip` at all. So nobody has
// ever seen it. It is still in the served HTML, and an AI crawler reads the HTML.
//
// Measured as GPTBot across 60 pages: "Raza Rizvi" appeared in the crawler-visible text of FIFTEEN,
// including /trade, /pools, /bridge, /lumos, /about and /whitepaper. The first 320 characters of an
// asset page read "... Disconnect LUMOSCORE RR Raza Rizvi Back to DEX LIBRE ...". An assistant
// summarising LumosCore is reading a real person's name as if it were page content, on pages whose job
// is to describe a product.
//
// EMPTIED RATHER THAN REMOVED. The element stays so that a future design change which un-hides the
// chip finds the structure it expects, and so nothing that walks the topbar can trip over a missing
// node. The text is the whole problem; the box is not. Nothing is hidden from a human either way --
// the CSS already does that, which is also why this carries no visual risk.
//
// The avatar initials go with it: "RR" is the same person, just shorter.
//
// Idempotent: an already-emptied chip does not match the pattern.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const FILES = ['lumoscore-aptos-desktop.html', 'lumoscore-aptos-mobile.html'];

// Matches the chip whatever whitespace the design uses between its parts, and keeps both wrappers.
const CHIP = /(<div class="user-chip"[^>]*>\s*<div class="avatar"[^>]*>)[^<]*(<\/div>\s*<div class="name"[^>]*>)[^<]*(<\/div>)/g;

let files = 0, pages = 0, chips = 0;
for (const file of FILES) {
  let data;
  try { data = read(file); } catch (e) { console.error('  ' + file + ': missing — skipped'); continue; }
  const { json, s, e } = getContents(data);
  files++;

  for (const key of Object.keys(json)) {
    const h = json[key];
    if (typeof h !== 'string') continue;
    const n = (h.match(CHIP) || []).length;
    if (!n) continue;
    json[key] = h.replace(CHIP, '$1$2$3');
    chips += n; pages++;
  }

  const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
  fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
}

console.log('header chip: emptied ' + chips + ' placeholder user chip(s) on ' + pages
  + ' page key(s) across ' + files + ' container(s)');

// NO CHIP MAY STILL CARRY A NAME -- and the check is scoped to the CHIP, not to the page.
//
// The first version asserted the name was gone from the whole container and failed, correctly: it is
// also on /about and /whitepaper under "Team", as "Raza Rizvi — Founder & Chief Executive Officer",
// and in the admin panel's send-as dropdown. Those are real content. A named, credited founder is an
// E-E-A-T signal worth having, so stripping it would have made the site WORSE for the very audience
// this transform is meant to serve. The placeholder chip is the only wrong copy of that name.
// No regex here on purpose: the pattern needs escaped slashes, and a backslash crossing a shell
// heredoc or a template literal is the one thing this codebase loses most reliably.
const MARK = '<div class="user-chip"';
let left = 0;
for (const file of FILES) {
  let data; try { data = read(file); } catch (e) { continue; }
  const { json } = getContents(data);
  for (const key of Object.keys(json)) {
    const h = json[key];
    if (typeof h !== 'string') continue;
    // Check the TWO CHILD ELEMENTS, not a fixed window. The first attempt scanned 220 characters from
    // the chip and flagged pages that were already correct: the window ran past </header> into <main>
    // and found the page's own h2 ("Trade"). The chip is two known children, so read exactly those.
    let i = h.indexOf(MARK);
    while (i >= 0) {
      let bad = false;
      for (const cls of ['class="avatar"', 'class="name"']) {
        const c = h.indexOf(cls, i);
        if (c < 0 || c - i > 200) continue;            // not this chip's child
        const open = h.indexOf('>', c);
        const close = h.indexOf('<', open + 1);
        if (open < 0 || close < 0) continue;
        if (h.slice(open + 1, close).trim()) bad = true;
      }
      if (bad) { left++; console.error('  ! ' + key + ': a user chip child still carries text'); break; }
      i = h.indexOf(MARK, i + 1);
    }
  }
}
if (left) process.exit(1);
