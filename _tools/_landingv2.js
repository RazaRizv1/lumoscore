// Landing page, second pass: the Launchpad card, and a networks strip with real marks on it.
//
// LAUNCHPAD. The grid shipped five cards and the stylesheet already carried .ic-prod.launchpad -- the
// design expected a sixth and it was never rendered. Six also fills the three-column grid as two whole
// rows instead of leaving a gap. The copy quotes the same flat $25 the launch-token FAQ quotes, rather
// than a number invented for the card.
//
// NETWORKS. The first version of this strip was three text pills. Real marks for Stellar and XRP Ledger
// come out of _netlogos.json, which is where every other surface on the site gets them, so they stay in
// step if that file is ever corrected. "More Networks" has no mark to show, so it gets a clock, which is
// what the row is actually saying: not a network, a date. Status is carried by a chip AND by the mark
// beside it rather than by colour alone.
//
// Written as its own transform rather than folded into _landingtrim.js: that one performs asserted
// removals which have already been applied, so re-running it would fail its own guards. This one only
// adds and replaces, and skips on its marker.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const netlogos = require(__dirname + '/_netlogos.json');
const B = String.fromCharCode(92);

const MARK = 'lx-netline2';

function logoOf(name) {
  const hit = netlogos.filter(x => x.name === name)[0];
  return hit ? String(hit.logo) : '';
}
const STELLAR = logoOf('Stellar');
const XRPL = logoOf('XRP Ledger');
if (!STELLAR || !XRPL) { console.error('landing v2: ABORT — Stellar/XRP Ledger mark missing from _netlogos.json'); process.exit(1); }

const CLOCK = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" '
  + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>';

const ROCKET = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
  + 'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
  + '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>'
  + '<path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>'
  + '<path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>';

const CARD = '<div class="product-card"><div class="ic-prod launchpad">' + ROCKET + '</div>'
  + '<h3>Launchpad</h3>'
  + '<p>Issue a token on Stellar in minutes — name it, set the supply and open its first pool. '
  + 'A flat $25, paid in XLM.</p></div>';

const NETLINE = '<section class="lx-netline" id="networks"><div class="container">'
  + '<div class="lx-netline-in">'
  + '<div class="lx-net-card is-live"><span class="lx-net-mark">' + STELLAR + '</span>'
  + '<span class="lx-net-txt"><b>Stellar</b><em>Live now</em></span></div>'
  + '<div class="lx-net-card is-next"><span class="lx-net-mark">' + XRPL + '</span>'
  + '<span class="lx-net-txt"><b>XRPL</b><em>Next up</em></span></div>'
  + '<div class="lx-net-card is-soon"><span class="lx-net-mark lx-net-clock">' + CLOCK + '</span>'
  + '<span class="lx-net-txt"><b>More Networks</b><em>Upcoming</em></span></div>'
  + '</div></div></section>';

const CSS = '<style id="lx-netline2">'
  + '.lx-netline{padding:52px 0 56px}'
  + '.lx-netline-in{display:flex;flex-wrap:wrap;justify-content:center;align-items:stretch;gap:16px}'
  + '.lx-net-card{display:inline-flex;align-items:center;gap:14px;padding:16px 26px 16px 18px;'
  + 'border:1px solid var(--border);border-radius:18px;background:var(--surface);'
  + 'transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}'
  + '.lx-net-card:hover{transform:translateY(-3px);border-color:var(--accent);'
  + 'box-shadow:0 18px 38px -22px rgba(234,106,44,.55)}'
  + '.lx-net-mark{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;'
  + 'border-radius:13px;background:var(--bg-elev,rgba(127,127,127,.12));flex:0 0 auto}'
  + '.lx-net-mark svg{width:28px;height:28px;display:block}'
  + '.lx-net-clock{color:var(--text-soft)}'
  + '.lx-net-txt{display:flex;flex-direction:column;gap:3px;text-align:left}'
  + '.lx-net-txt b{font-size:17px;font-weight:700;color:var(--text);line-height:1.15}'
  + '.lx-net-txt em{font-style:normal;font-size:12px;font-weight:600;letter-spacing:.03em;'
  + 'text-transform:uppercase;color:var(--text-soft)}'
  // Status is legible without relying on the colour: "Live now" also gets a filled dot, the other two do not.
  + '.lx-net-card.is-live .lx-net-txt em{color:var(--green,#34d399);display:inline-flex;align-items:center;gap:6px}'
  + '.lx-net-card.is-live .lx-net-txt em::before{content:"";width:7px;height:7px;border-radius:50%;'
  + 'background:var(--green,#34d399);box-shadow:0 0 0 3px rgba(52,211,153,.18)}'
  + '.lx-net-card.is-soon{opacity:.85}'
  + '@media (max-width:640px){.lx-netline{padding:30px 0 34px}.lx-netline-in{gap:12px}'
  + '.lx-net-card{padding:13px 20px 13px 14px;gap:11px}'
  + '.lx-net-mark{width:38px;height:38px;border-radius:11px}.lx-net-mark svg{width:24px;height:24px}'
  + '.lx-net-txt b{font-size:15px}.lx-net-txt em{font-size:11px}}'
  + '@media (prefers-reduced-motion:reduce){.lx-net-card{transition:none}.lx-net-card:hover{transform:none}}'
  + '</style>';

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
  if (html.indexOf(MARK) >= 0) { console.log('  ' + p.key + ': already applied, skipping'); continue; }

  // ---- the sixth card, appended so the grid reads as two full rows.
  // Counted inside the products SECTION, not inside a fixed-size window from the grid: the five cards
  // span more than 9000 characters, so a window that looked generous silently saw four and aborted.
  const gi = html.indexOf('class="products-grid"');
  if (gi < 0) { problems.push(p.key + ': no products grid'); continue; }
  const secStart = html.lastIndexOf('<section', gi);
  const secEnd = html.indexOf('</section>', gi);
  if (secStart < 0 || secEnd < 0) { problems.push(p.key + ': could not bound the products section'); continue; }
  const section = html.slice(secStart, secEnd);
  // Cards are NOT all divs -- the last one is an <a class="product-card"> link. Matching on
  // '<div class="product-card">' counted four and aborted on a grid that plainly holds five.
  const cards = (section.match(/<(?:div|a)[^>]*class="product-card"/g) || []).length;
  if (cards !== 5) { problems.push(p.key + ': expected 5 product cards, found ' + cards); continue; }
  const lastRel = section.search(/<(?:div|a)[^>]*class="product-card"(?![\s\S]*<(?:div|a)[^>]*class="product-card")/);
  if (lastRel < 0) { problems.push(p.key + ': could not locate the last card'); continue; }
  const lastAbs = secStart + lastRel;
  const tag = html.slice(lastAbs + 1, lastAbs + 4).toLowerCase().indexOf('a ') === 0 ? 'a' : 'div';
  // Walk that element's own open/close tags so the divs nested inside the card cannot close it early.
  const tre = new RegExp('<\\/?' + tag + '\\b', 'g');
  tre.lastIndex = lastAbs;
  let depth = 0, endIdx = -1, mm;
  while ((mm = tre.exec(html))) {
    if (mm[0].charAt(1) === '/') { depth--; if (depth === 0) { endIdx = html.indexOf('>', mm.index) + 1; break; } }
    else depth++;
  }
  if (endIdx < 0 || endIdx > secEnd) { problems.push(p.key + ': could not close the last card'); continue; }
  html = html.slice(0, endIdx) + CARD + html.slice(endIdx);

  // ---- the networks strip, replaced wholesale.
  const nStart = html.indexOf('<section class="lx-netline"');
  if (nStart < 0) { problems.push(p.key + ': no networks strip to replace'); continue; }
  const nEnd = html.indexOf('</section>', nStart) + 10;
  html = html.slice(0, nStart) + NETLINE + html.slice(nEnd);

  const bi = html.lastIndexOf('</body>');
  html = bi >= 0 ? html.slice(0, bi) + CSS + html.slice(bi) : html + CSS;

  json[p.key] = html;
  staged.push({ file: p.file, data, s, e, json, key: p.key });
}

if (problems.length) {
  console.error('landing v2: ABORT — nothing written.');
  problems.forEach(x => console.error('  ' + x));
  process.exit(1);
}
for (const st of staged) {
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.key + ': Launchpad card added, networks strip rebuilt');
}
console.log('landing v2: done on ' + staged.length + ' page(s)');
