// "What you can do with LUMOS" -- two bands instead of a five-card grid.
//
// Asked for: the fee benefit alone across the top, then three boxes below, one per incentive reward.
// The section shipped five equal cards -- fee, Native LP, Ecosystem LP, Whale Holder, and a
// coming-soon Liquidity Pairing -- so the fee, which is the one benefit that applies to everyone who
// simply HOLDS the token, read as one of five footnotes.
//
// The split is done in CSS on the existing grid (the fee card spans every column, the rest flow three
// across) rather than by moving markup, so there is nothing to re-order and no first-paint reshuffle.
// Liquidity Pairing is hidden: three boxes were asked for, it is not an incentive reward, and it is
// not live. Its markup is untouched -- unhide by deleting one rule.
//
// The copy is also CORRECTED here. Both builds claimed holders "trade fee-free", which is not what
// the product does: _feerate.js is the single source of truth and it publishes 0.002 by default and
// 0.001 at 250,000 LUMOS. Half the fee, not no fee.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const KEYS = ['lumoscore-lumos-token.html', 'lumoscore-lumos-token-dark.html', 'lumoscore-lumos-token-mobile.html'];

// The rate pulled out as a figure, so the benefit is a number rather than a sentence to read.
// Values match _feerate.js (THRESH=250000, 0.002 -> 0.001); if that file changes, change these.
const FIGURE = '<div class="lxu-figure" aria-hidden="true">'
  + '<span class="lxu-rate"><span class="lxu-from">0.2%</span>'
  + '<span class="lxu-arrow">→</span><span class="lxu-to">0.1%</span></span>'
  + '<span class="lxu-off">50% off</span></div>';

// Desktop and mobile ship slightly different sentences; both said "fee-free".
const COPY = [
  ['<p>Hold 250,000 LUMOS or more in a single wallet and trade fee-free across all LumosCore products — DEX and AMM.</p>',
   '<p>Hold <strong>250,000 LUMOS</strong> or more in a single wallet and pay <strong>0.1%</strong> instead of 0.2% on every trade — half the platform fee, across the DEX and the AMM.</p>'],
  ['<p>Hold 250,000 LUMOS or more and trade fee-free across all LumosCore products — DEX and AMM.</p>',
   '<p>Hold <strong>250,000 LUMOS</strong> or more and pay <strong>0.1%</strong> instead of 0.2% on every trade — half the platform fee.</p>'],
];

const STYLE = `<style id="lx-lumosutil-css">
/* ---- band 1: the fee, across the top ---------------------------------------------------------- */
.utility-grid{grid-template-columns:repeat(3,1fr)}
.utility-grid .util-card.fee{grid-column:1/-1}
/* Two columns inside the card WITHOUT wrapping its children in a new element: the copy is assigned to
   column one, the figure to column two spanning every row. */
.util-card.fee{
  display:grid;grid-template-columns:1fr auto;column-gap:34px;align-items:center;
  padding:24px 26px;
  background:linear-gradient(115deg,var(--accent-pale,rgba(234,106,44,.12)) 0%,transparent 56%),var(--surface);
  border-color:rgba(234,106,44,.30)}
.util-card.fee>.u-ico,.util-card.fee>h4,.util-card.fee>p,.util-card.fee>.u-link{grid-column:1;margin-right:0}
.util-card.fee>p{max-width:62ch}
.util-card.fee>.u-link{justify-self:start}
/* Row 2 onwards, not row 1. .u-tag ("Live") is positioned absolutely at top:14px/right:14px, which
   is the same corner the figure was spanning into -- so the badge landed on top of the 0.1%. Starting
   the figure below the icon row clears it without moving the badge every other card shares. */
/* "2 / span 3", NOT "2 / -1". This grid declares no grid-template-rows, so every row is implicit and
   -1 resolves against the EXPLICIT grid -- which has one line. The span collapsed back onto row 1,
   which is the row the Live badge floats over, which is why the badge kept landing on the 0.1%. */
.util-card.fee>.lxu-figure{grid-column:2;grid-row:2/span 3;align-self:end;justify-self:end;
  padding-left:8px;padding-bottom:4px}

/* the rate, as a figure */
.lxu-figure{display:flex;flex-direction:column;align-items:flex-end;gap:9px;flex:0 0 auto}
.lxu-rate{display:inline-flex;align-items:baseline;gap:9px;
  font:800 40px/1 'Hanken Grotesk',system-ui,sans-serif;letter-spacing:-1.4px;color:var(--text)}
.lxu-from{font-size:24px;font-weight:700;color:var(--text-soft);text-decoration:line-through;
  text-decoration-thickness:2px;opacity:.8}
.lxu-arrow{font-size:20px;font-weight:700;color:var(--text-soft)}
.lxu-to{color:var(--accent)}
.lxu-off{font:800 11px/1 'JetBrains Mono',monospace;letter-spacing:.10em;text-transform:uppercase;
  padding:5px 10px;border-radius:999px;background:var(--accent);color:#fff;
  box-shadow:0 8px 18px -10px rgba(234,106,44,.9)}

/* ---- band 2: one box per incentive reward ----------------------------------------------------- */
/* Three boxes were asked for. Liquidity Pairing is not an incentive reward and is not live; its
   markup is untouched, so deleting this one rule brings it back. */
.utility-grid .util-card.pairing{display:none}
/* Equal height, and the link pinned to the bottom edge so three boxes of unequal copy still line up. */
.utility-grid .util-card.native,.utility-grid .util-card.eco,.utility-grid .util-card.whale{
  display:flex;flex-direction:column}
.utility-grid .util-card.native .u-link,.utility-grid .util-card.eco .u-link,
.utility-grid .util-card.whale .u-link{margin-top:auto}

/* ---- phone: the figure sits under the copy ---------------------------------------------------- */
@media(max-width:860px){
.utility-grid{grid-template-columns:1fr}
.util-card.fee{grid-template-columns:1fr;row-gap:14px;padding:18px 18px}
.util-card.fee>.lxu-figure{grid-column:1;grid-row:auto;justify-self:start;
  flex-direction:row;align-items:center;gap:12px}
.lxu-rate{font-size:30px;letter-spacing:-1px}
.lxu-from{font-size:19px}
.util-card.fee>p{max-width:none}
}
</style>`;

let containers = 0, pages = 0, copyFixed = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = `lumoscore-aptos-${dev}.html`;
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;

  for (const k of KEYS) {
    if (!json[k]) continue;
    let p = json[k];
    const before = p;
    p = p.replace(/<style id="lx-lumosutil-css">[\s\S]*?<\/style>/, '')
         // The figure ends "</span></div>" -- it contains ONE </div>, not two. Ending this match at
         // </div></div> meant it never matched the figure at all: it ran forward to the next place in
         // the page where two divs happen to close together and deleted everything in between.
         .replace(/<div class="lxu-figure"[\s\S]*?<\/span><\/div>/, '');   // strip a previous figure

    for (const [from, to] of COPY) if (p.indexOf(from) >= 0) { p = p.split(from).join(to); copyFixed++; }

    // the figure goes at the end of the fee card, just before its link
    if (p.indexOf('lxu-figure') < 0) {
      const at = p.indexOf('<div class="util-card fee">');
      if (at >= 0) {
        const link = p.indexOf('<a class="u-link"', at);
        if (link > at && link - at < 4000) p = p.slice(0, link) + FIGURE + p.slice(link);
      }
    }

    if (p.indexOf('</head>') >= 0) p = p.replace('</head>', STYLE + '</head>');
    if (p !== before) { json[k] = p; changed = true; pages++; }
  }

  if (changed) {
    containers++;
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
console.log('LUMOS utility: two bands on ' + pages + ' page keys, ' + copyFixed + ' fee sentence(s) corrected');
