// "Add liquidity" on the mobile dashboard opened nothing, so it was made to navigate to Pools instead.
// That was the wrong trade: the card is a quick ACTION, and sending someone to a list page to go and
// find the thing they just asked for is the opposite of one.
//
// The reason it opened nothing is that the mobile dashboard never shipped #createPoolModal -- measured,
// the element is on the mobile POOLS page and on the desktop dashboard, but not here. The engine that
// drives it is a different question from the markup, and the answer is that it is already present:
// lx-swapcalc and lx-ammdata both run on the mobile dashboard. So this is a missing dialog on a page
// that can already operate one, not a feature to port.
//
// Lifted from the page that has it rather than hand-written, for the same reason _mobbar.js lifts the
// bottom nav: a second copy of a dialog is a second thing to keep in step, and it will drift.
//
// Idempotent: a page that already carries the modal is skipped.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const FROM = 'lumoscore-amm-mobile.html';     // the mobile page that owns this dialog
const INTO = 'lumoscore-home-mobile.html';    // the mobile dashboard

const file = 'lumoscore-aptos-mobile.html';
let data;
try { data = read(file); } catch (e) { console.log('mobile container not found'); process.exit(0); }
const { json, s, e } = getContents(data);

if (!json[INTO]) { console.log('add-liquidity modal: no mobile dashboard key — nothing done'); process.exit(0); }
if (json[INTO].indexOf('id="createPoolModal"') >= 0) {
  console.log('add-liquidity modal: already present on the mobile dashboard');
  process.exit(0);
}
if (!json[FROM]) { console.log('add-liquidity modal: no source page — nothing done'); process.exit(0); }

// Balanced extraction. The dialog nests a dozen divs, so counting <div>/</div> from the opening tag is
// the only way to find its real end -- a lazy regex to the first </div> would take a fragment, and a
// greedy one would swallow the rest of the page.
const src = json[FROM];
const at = src.indexOf('<div class="modal-overlay" id="createPoolModal">');
if (at < 0) { console.log('add-liquidity modal: source markup not in the expected shape — nothing done'); process.exit(0); }

let depth = 0, i = at, end = -1;
const tag = /<(\/?)div\b[^>]*>/g;
tag.lastIndex = at;
let m;
while ((m = tag.exec(src))) {
  depth += m[1] ? -1 : 1;
  if (depth === 0) { end = m.index + m[0].length; break; }
  if (m.index > at + 200000) break;            // runaway guard
}
if (end < 0) { console.log('add-liquidity modal: could not balance the markup — nothing done'); process.exit(0); }

const modal = src.slice(at, end);

let h = json[INTO];
const bi = h.lastIndexOf('</body>');
if (bi < 0) { console.log('add-liquidity modal: no </body> on the dashboard — nothing done'); process.exit(0); }
h = h.slice(0, bi) + modal + h.slice(bi);
json[INTO] = h;

const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
console.log('add-liquidity modal: lifted ' + modal.length + ' chars onto the mobile dashboard');
