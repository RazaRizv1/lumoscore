// Sections that were asked to be removed outright.
//
// This one DELETES markup rather than hiding it, because that is what was asked -- a display:none
// section still ships its text to crawlers and still costs bytes. Two safeguards, because deleting
// from a gitignored container is exactly the operation that has no undo:
//   1. every removed block is written to _tools/_dropped/<key>.<name>.html before it is cut, so
//      putting one back is a copy-paste rather than a reconstruction;
//   2. the end of each block is found by COUNTING nested open/close tags, never by a lazy regex
//      running forward to the next closing tag it happens to meet.
//
// Idempotent by nature: once a block is gone its anchor is gone, so a second run finds nothing.
const fs = require('fs');
const path = require('path');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);
const BAK = __dirname + '/_dropped';

// Each cut is located by an anchor, then closed by tag counting. No page keys are named: a cut is
// applied wherever its anchor exists, so theme and mobile variants are covered without a list to
// keep in step.
const CUTS = [
  // Dashboard -> Explore products. Two cuts on desktop: the heading, then the style block that only
  // serves the grid plus the grid itself. `through` matches the CLASS ATTRIBUTE, not the bare word --
  // "products-grid" also appears inside <style id="lx-products"> as a selector, and anchoring on that
  // took the heading's own <div> as the block to close and removed 120 characters instead of the grid.
  { name: 'explore-products', from: '<!-- ===== EXPLORE PRODUCTS ===== -->', through: 'class="products-grid"', tag: 'div' },
  { name: 'explore-products-grid', from: '<style id="lx-products">', through: 'class="products-grid"', tag: 'div' },
  { name: 'explore-products', from: '<!-- ===== Explore Products ===== -->', through: 'class="products-stack"', tag: 'div' },
  // LUMOS token page -> About LUMOS.
  { name: 'about-lumos', from: '<section class="about-card">', through: 'about-card', tag: 'section' },
];

// Walk forward from an opening tag, counting nesting, and return the index just past its close.
function endOfTag(s, openIdx, tag) {
  const open = new RegExp('<' + tag + '(?=[\\s>])', 'g');
  const close = new RegExp('</' + tag + '>', 'g');
  open.lastIndex = openIdx + 1; close.lastIndex = openIdx + 1;
  let depth = 1, o = open.exec(s), c = close.exec(s);
  while (c) {
    if (o && o.index < c.index) { depth++; o = open.exec(s); continue; }
    depth--;
    if (depth === 0) return c.index + c[0].length;
    c = close.exec(s);
    while (o && c && o.index < c.index) { depth++; o = open.exec(s); }
  }
  return -1;
}

let containers = 0, cuts = 0, bytes = 0;
try { fs.mkdirSync(BAK, { recursive: true }); } catch (e) { }

for (const dev of ['desktop', 'mobile']) {
  const file = `lumoscore-aptos-${dev}.html`;
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s: st, e: en } = getContents(data);
  let changed = false;

  for (const k of Object.keys(json)) {
    let p = json[k];
    for (const cut of CUTS) {
      const a = p.indexOf(cut.from);
      if (a < 0) continue;
      // the block that closes the cut: the first element carrying `through` at or after the anchor
      const mark = p.indexOf(cut.through, a);
      if (mark < 0) { console.log(`  !! ${k}: "${cut.name}" anchor found but no ${cut.through} after it — skipped`); continue; }
      const openIdx = p.lastIndexOf('<' + cut.tag, mark);
      if (openIdx < a - 400) { console.log(`  !! ${k}: "${cut.name}" ${cut.through} opens before its anchor — skipped`); continue; }
      const end = endOfTag(p, openIdx, cut.tag);
      if (end < 0) { console.log(`  !! ${k}: "${cut.name}" never closes — skipped`); continue; }
      const block = p.slice(a, end);
      // guard: a cut that swallows a big share of the page is a bug, not a removal
      if (block.length > p.length * 0.25) { console.log(`  !! ${k}: "${cut.name}" would remove ${block.length} of ${p.length} chars — refused`); continue; }
      fs.writeFileSync(path.join(BAK, k.replace(/\.html$/, '') + '.' + cut.name + '.html'), block, 'utf8');
      p = p.slice(0, a) + p.slice(end);
      cuts++; bytes += block.length;
      console.log(`  ${k}: removed "${cut.name}" (${block.length} chars, saved to _tools/_dropped/)`);
    }
    if (p !== json[k]) { json[k] = p; changed = true; }
  }

  if (changed) {
    containers++;
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, st) + serialized + data.slice(en), 'utf8');
  }
}
console.log('dropped sections: ' + cuts + ' block(s), ' + bytes + ' chars, across ' + containers + ' containers');
