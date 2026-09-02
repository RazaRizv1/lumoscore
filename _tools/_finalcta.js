// The closing CTA's copy.
//
// "Ready to build across chains? / Connect your wallet and launch your first token in under 5 minutes."
// becomes a sharper pair. The heading keeps the design's two-part treatment -- first half in the ink
// colour, second in the gradient -- which is the same shape the hero headline uses, so the page opens
// and closes on the same device.
//
// Both are written by REPLACING the element's contents outright rather than swapping one exact string
// for another. Matching the previous wording means every copy change has to carry the last one with
// it, and the transform silently no-ops the moment the two drift apart. This way the elements always
// end up saying exactly what is below, however many times it is run.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const HEAD_HTML = 'Stop switching. <span class="grad">Start building.</span>';
const SUB_HTML = 'Non-custodial by design. Low fees by default. Connect your wallet to get started.';

const PAGES = [
  { file: 'lumoscore-aptos-desktop.html', key: 'lumoscore-landing.html' },
  { file: 'lumoscore-aptos-mobile.html', key: 'lumoscore-landing-mobile.html' }
];

const problems = [];
const staged = [];

for (const p of PAGES) {
  const data = read(p.file);
  const { json, s, e } = getContents(data);
  let html = json[p.key];
  if (html == null) { problems.push(p.key + ': missing'); continue; }

  const n = (html.match(/<div class="final-cta">/g) || []).length;
  if (n !== 1) { problems.push(p.key + ': expected 1 final CTA, found ' + n); continue; }
  const at = html.indexOf('<div class="final-cta">');

  // The heading and standfirst are the first h2 and the first p inside the block, and both are
  // located from the block's own start so nothing elsewhere on the page can be hit by mistake.
  const h2s = html.indexOf('<h2', at);
  const h2e = html.indexOf('</h2>', h2s);
  if (h2s < 0 || h2e < 0) { problems.push(p.key + ': final CTA heading not found'); continue; }
  html = html.slice(0, html.indexOf('>', h2s) + 1) + HEAD_HTML + html.slice(h2e);

  const ps = html.indexOf('<p', html.indexOf('</h2>', at));
  const pe = html.indexOf('</p>', ps);
  if (ps < 0 || pe < 0) { problems.push(p.key + ': final CTA standfirst not found'); continue; }
  // The standfirst has to sit inside the block, not after it -- a CTA without a paragraph would
  // otherwise take the next <p> on the page and rewrite that instead.
  const blockEnd = html.indexOf('</section>', at);
  if (ps > blockEnd) { problems.push(p.key + ': final CTA standfirst is outside the block'); continue; }
  html = html.slice(0, html.indexOf('>', ps) + 1) + SUB_HTML + html.slice(pe);

  json[p.key] = html;
  staged.push({ file: p.file, data, s, e, json, key: p.key });
}

if (problems.length) {
  console.error('final CTA: ABORT — nothing written.');
  problems.forEach(x => console.error('  ' + x));
  process.exit(1);
}
for (const st of staged) {
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.key + ': closing CTA heading and standfirst rewritten');
}
console.log('final CTA: done on ' + staged.length + ' page(s)');
