// Pool pair marks: side by side, not stacked on top of each other.
//
// The design draws a pair as a 46px box with the two logos ABSOLUTELY positioned inside it -- one at
// left:0, the other at left:14px or left:22px -- so the second sits on top of the first and each logo
// hides a third of its neighbour. On a list of pools where the pair IS the identifier, that is the one
// thing on the row that has to be legible.
//
// So they flow instead: inline-flex, both children static, a real gap between them. Written once and
// globally, because the same .pair-icons markup is what Pools main, the pool page, Wallet and the
// public address page's liquidity rows, search results and the LUMOS token page all use -- listing the
// containers instead would have meant finding every one of them and still missing some.
//
// The HEROES keep their overlapping treatment, which is what was asked. That falls out of specificity
// rather than an exception list: _poolshero.js styles the hero's marks through
// `.lm-pools .lx-hstat[data-k=top] .pair-icons` -- four classes to this file's one -- so its rules win
// even though both sides use !important. Trade's hero uses .lx-dxpair and is not touched at all.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const STYLE = `<style id="lx-pairicons-css">
/* The wrapper: a fixed 46px box holding two absolutely-placed logos becomes a flow row.
   [data-paired] is the marker the runtime pair builders stamp on every pair they draw; .pair-cell is
   the table/list cell the static ones sit in. Between them they cover Pools main, the pool page,
   Wallet and public-address liquidity rows, search and the LUMOS token page. */
/* .ph-icons is the pool page's own header pair -- same overlapping treatment, different class. */
.pair-icons[data-paired],.pair-cell .pair-icons,.pool-header-row .ph-icons{
  position:static!important;display:inline-flex!important;align-items:center;gap:6px;
  width:auto!important;height:auto!important;flex:0 0 auto;overflow:visible}
/* The children have to be named to win. The design pins them with three-class selectors
   (.pool-card .pair-icons .b { left:12px }), so a child selector at two classes loses and they stay stacked --
   which is exactly what the first attempt at this did. Three classes here beats that, and stays BELOW
   the four-class hero rules in _poolshero.js, so the Trade and Pools hero marks keep overlapping. */
html body .pair-icons[data-paired]>.pa,html body .pair-icons[data-paired]>.pb,
html body .pair-icons[data-paired]>.a,html body .pair-icons[data-paired]>.b,
html body .pair-cell .pair-icons>.pa,html body .pair-cell .pair-icons>.pb,
html body .pair-cell .pair-icons>.a,html body .pair-cell .pair-icons>.b,
html body .pool-header-row .ph-icons>*{
  position:relative!important;left:auto!important;right:auto!important;top:auto!important;
  bottom:auto!important;margin:0!important;flex:0 0 auto;
  /* the ring existed to separate two overlapping coins; there is nothing to separate now */
  box-shadow:none!important}
</style>`;

let containers = 0, pages = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = `lumoscore-aptos-${dev}.html`;
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;

  for (const k of Object.keys(json)) {
    let p = json[k];
    const before = p;
    p = p.replace(/<style id="lx-pairicons-css">[\s\S]*?<\/style>/, '');
    // only pages that actually draw a pair
    if (p.indexOf('pair-icons') < 0) { if (p !== before) { json[k] = p; changed = true; } continue; }
    if (p.indexOf('</head>') < 0) continue;
    p = p.replace('</head>', STYLE + '</head>');
    if (p !== before) { json[k] = p; changed = true; pages++; }
  }

  if (changed) {
    containers++;
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
console.log('pair marks: side by side on ' + pages + ' page keys across ' + containers + ' containers');
