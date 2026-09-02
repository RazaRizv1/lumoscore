// Hero headline: keep "Multi-Chain Web3" on one line.
//
// The markup already intends two lines -- "The Core of<br/><span class=grad>Multi-Chain Web3</span>" --
// but above 1100px the headline is set at 114.4px, where that span measures 878px, and .hero-center caps
// its children at 880px with 26.4px of padding either side, leaving 827px. So the second line wrapped to
// three on every desktop width, 1920 included: the cap is a fixed pixel value, so a wider monitor does
// not help. Measured rather than eyeballed -- the text renders at 7.724x the font size.
//
// Two ways to fix it: shrink the type to ~106px so it fits the 827px box, or let the headline size to its
// own content and overflow that box. The second matches the reference, where the headline is visibly
// wider than the search field below it, so the type stays at its designed size.
//
// width:max-content sizes the box to the text; left:50% with translateX(-50%) centres a box that is
// wider than its parent, which margin:auto cannot do. Scoped to the range that actually has the problem:
// at 1100px and below the headline is already 70.4px and needs 544px, which fits with room to spare.
// The <br/> still breaks the line -- nowrap does not override an explicit break -- so it stays two lines.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const MARK = 'lx-herofit';
const CSS = '<style id="lx-herofit">'
  + '@media (min-width:1101px){'
  + '.hero-headline{white-space:nowrap;width:max-content;position:relative;left:50%;transform:translateX(-50%);max-width:calc(100vw - 48px)}'
  + '}'
  + '</style>';

const PAGES = [
  { file: 'lumoscore-aptos-desktop.html', key: 'lumoscore-landing.html' },
  { file: 'lumoscore-aptos-mobile.html', key: 'lumoscore-landing-mobile.html' }
];

let n = 0;
for (const p of PAGES) {
  const data = read(p.file);
  const { json, s, e } = getContents(data);
  const html = json[p.key];
  if (html == null) { console.error('  ' + p.key + ': missing'); continue; }
  if (html.indexOf(MARK) >= 0) { console.log('  ' + p.key + ': already fitted, skipping'); continue; }
  if (html.indexOf('hero-headline') < 0) { console.error('  ' + p.key + ': no .hero-headline, skipped'); continue; }
  const bi = html.lastIndexOf('</body>');
  json[p.key] = bi >= 0 ? html.slice(0, bi) + CSS + html.slice(bi) : html + CSS;
  const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
  fs.writeFileSync(p.file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  console.log('  ' + p.key + ': hero headline pinned to one line above 1100px');
  n++;
}
console.log('hero fit: done on ' + n + ' page(s)');
