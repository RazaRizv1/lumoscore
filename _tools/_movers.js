// Market Movers, as chart tiles rather than four boxes of text.
//
// The card already carried everything the reference does -- logo, ticker, verified tick, issuer
// domain, a 24h change pill, price, volume, TVL, trade count, and a real 7d series. What it lacked
// was hierarchy: the change pill was the same size as the ticker, volume and TVL ran together in one
// grey line, and the series was drawn as a bare hairline floating above the card's bottom padding.
//
// So nothing here fetches anything or adds a field. It re-ranks what is already on the card by
// weight and position, and lets the series read as a chart:
//   - the sparkline bleeds to the tile's edges and gains an area fill (in _dexdata.js's fillSpark,
//     which is where the path is written)
//   - the change pill becomes a pill, with a caret so direction is not carried by colour alone
//   - volume and TVL get labels, so the numbers stop competing with their own units
//   - a faint wash keyed to direction, so a green tile and a red tile differ before you read them
//
// Every selector is prefixed .dex-movers and most are three classes deep, which is deliberate: this
// file is injected into <head> after _dexdata.js's own block, but re-running _dexdata.js would move
// its block after this one. Winning on specificity rather than on order means the two can be run in
// either sequence.
//
// Desktop only. The phone build renders movers as .mdx-mover-row -- a compact list, which is the
// right form on a 375px screen -- and shares none of these class names, so it is left alone.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// The phone build is here now too: its Market Movers renders the SAME card, painted by the same
// desktop renderer (see _dexdata.js renderMovers, which takes #mdxMoverList as well). Its own
// container is a flex column rather than a grid, so the card stacks full width.
const KEYS = ['lumoscore-dex.html', 'lumoscore-dex-dark.html', 'lumoscore-dex-mobile.html'];

const STYLE = `<style id="lx-movers-css">
/* ---- the grid ---------------------------------------------------------------------------------- */
.dex-movers .dex-mover-grid{gap:14px}

/* ---- the tile ---------------------------------------------------------------------------------- */
/* No bottom padding: the chart runs to the edge and the tile clips it back to the corner radius. */
html .dex-movers .dex-mover-card{
  position:relative;overflow:hidden;
  padding:15px 15px 0;border-radius:16px;gap:10px;
  background-repeat:no-repeat}
/* Direction is read off the pill the paint step already classes, so up/down has ONE source of truth
   and no new attribute for the logo painter to find and decorate. */
html .dex-movers .dex-mover-card:has(.dex-mover-pct.up){
  background-image:radial-gradient(128% 74% at 50% 100%,rgba(53,192,127,.085),rgba(53,192,127,0) 72%)}
html .dex-movers .dex-mover-card:has(.dex-mover-pct.down){
  background-image:radial-gradient(128% 74% at 50% 100%,rgba(255,91,91,.085),rgba(255,91,91,0) 72%)}
html .dex-movers .dex-mover-card:hover{
  border-color:var(--accent);box-shadow:0 16px 34px -20px rgba(234,106,44,.34)}

/* ---- head: mark, ticker, issuer, change -------------------------------------------------------- */
.dex-movers .dex-mover-head{gap:9px;align-items:flex-start}
.dex-movers .dex-mover-ico{width:34px;height:34px;font-size:14px}
.dex-movers .dex-mover-pair{font-size:14.5px;line-height:1.15;letter-spacing:-.1px;padding-top:2px}
/* The issuer domain is provenance, not a headline -- and a long one used to push the pill off the row. */
.dex-movers .dex-mover-pair .sub{
  font-size:11px;margin-top:3px;max-width:100%;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* A caret as well as a colour: green and red are the same value to a red-green colourblind reader,
   and this is the one number on the tile whose sign is the whole point. */
.dex-movers .dex-mover-pct{
  display:inline-flex;align-items:center;gap:4px;flex:0 0 auto;
  font-size:12.5px;font-weight:800;line-height:1;letter-spacing:-.2px;
  padding:6px 9px;border-radius:999px;white-space:nowrap}
.dex-movers .dex-mover-pct.up::before{content:"${B}25B2";font-size:7.5px;line-height:1}
.dex-movers .dex-mover-pct.down::before{content:"${B}25BC";font-size:7.5px;line-height:1}

/* ---- the numbers ------------------------------------------------------------------------------- */
.dex-movers .dex-mover-body{align-items:flex-end}
.dex-movers .dex-mover-price{font-size:21px;letter-spacing:-.5px;line-height:1.05}
/* Labels, so "Vol" and "TVL" stop reading as part of the numbers they precede. */
.dex-movers .dex-mover-vol{
  margin-top:5px;display:flex;align-items:baseline;gap:5px;flex-wrap:wrap;
  font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:-.1px}
.dex-movers .dex-mover-vol .lxk{
  font-size:9.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
  color:var(--text-soft);opacity:.7}
.dex-movers .dex-mover-vol .lxv{color:var(--text-muted);font-weight:700}
.dex-movers .dex-mover-trades{font-size:17px;letter-spacing:-.3px}
.dex-movers .dex-mover-tlabel{font-size:9px;opacity:.85}

/* ---- the chart --------------------------------------------------------------------------------- */
/* Fixed height whether or not the series has arrived: it is fetched after the numbers, and a box that
   grows 46px when it lands would shift every tile below it. */
.dex-movers .dex-mover-card .dex-mk-spark{
  display:block;width:calc(100% + 30px);height:46px;margin:6px -15px 0;
  opacity:.92;transition:opacity .2s ease}
.dex-movers .dex-mover-card:hover .dex-mk-spark{opacity:1}
/* the same box before the series lands -- a wash, so the tile reads as loading rather than broken */
.dex-movers .dex-mover-card .dex-mk-spark:empty{
  background:linear-gradient(to top,rgba(127,127,140,.07),rgba(127,127,140,0))}

/* ---- the phone -------------------------------------------------------------------------------- */
/* Same card, one per row. The rules above are all prefixed .dex-movers, which is the DESKTOP
   section wrapper; the phone's container is .mdx-mover-list, so each one is restated for it rather
   than loosening the desktop selectors and letting them leak somewhere else. */
.mdx-mover-list{display:flex;flex-direction:column;gap:10px}
html .mdx-mover-list .dex-mover-card{
  position:relative;overflow:hidden;
  padding:14px 14px 0;border-radius:15px;gap:9px;
  display:flex;flex-direction:column;
  background:var(--surface);border:1px solid var(--border);background-repeat:no-repeat}
html .mdx-mover-list .dex-mover-card:has(.dex-mover-pct.up){
  background-image:radial-gradient(128% 74% at 50% 100%,rgba(53,192,127,.085),rgba(53,192,127,0) 72%)}
html .mdx-mover-list .dex-mover-card:has(.dex-mover-pct.down){
  background-image:radial-gradient(128% 74% at 50% 100%,rgba(255,91,91,.085),rgba(255,91,91,0) 72%)}
.mdx-mover-list .dex-mover-head{display:flex;align-items:flex-start;gap:9px}
.mdx-mover-list .dex-mover-ico{width:32px;height:32px;border-radius:50%;flex:0 0 auto;
  display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:800}
.mdx-mover-list .dex-mover-pair{flex:1;min-width:0;font-size:14px;font-weight:700;color:var(--text);padding-top:1px}
.mdx-mover-list .dex-mover-pair .sub{display:block;font-size:10.5px;font-weight:500;margin-top:2px;
  color:var(--text-soft);font-family:'JetBrains Mono',monospace;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mdx-mover-list .dex-mover-pct{display:inline-flex;align-items:center;gap:4px;flex:0 0 auto;
  font-family:'JetBrains Mono',monospace;font-size:11.5px;font-weight:800;line-height:1;
  padding:5px 8px;border-radius:999px;white-space:nowrap}
.mdx-mover-list .dex-mover-pct.up{color:var(--green);background:var(--green-soft)}
.mdx-mover-list .dex-mover-pct.down{color:var(--red);background:var(--red-soft)}
.mdx-mover-list .dex-mover-pct.up::before{content:"${B}25B2";font-size:7px;line-height:1}
.mdx-mover-list .dex-mover-pct.down::before{content:"${B}25BC";font-size:7px;line-height:1}
.mdx-mover-list .dex-mover-body{display:flex;justify-content:space-between;align-items:flex-end;gap:10px}
.mdx-mover-list .dex-mover-l{min-width:0}
.mdx-mover-list .dex-mover-r{text-align:right;flex:0 0 auto}
.mdx-mover-list .dex-mover-price{font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:800;
  color:var(--text);letter-spacing:-.4px;line-height:1.05}
.mdx-mover-list .dex-mover-vol{margin-top:4px;display:flex;align-items:baseline;gap:5px;flex-wrap:wrap;
  font-family:'JetBrains Mono',monospace;font-size:10px}
.mdx-mover-list .dex-mover-vol .lxk{font-size:9px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
  color:var(--text-soft);opacity:.7}
.mdx-mover-list .dex-mover-vol .lxv{color:var(--text-muted);font-weight:700}
.mdx-mover-list .dex-mover-trades{font:800 15px/1.05 'Hanken Grotesk',sans-serif;color:var(--text)}
.mdx-mover-list .dex-mover-tlabel{font:600 8.5px/1.2 'JetBrains Mono',monospace;letter-spacing:.05em;
  text-transform:uppercase;color:var(--text-soft);margin-top:3px;white-space:nowrap}
.mdx-mover-list .dex-mover-card .dex-mk-spark{display:block;width:calc(100% + 28px);height:40px;margin:6px -14px 0}
.mdx-mover-list .dex-mover-card .dex-mk-spark:empty{
  background:linear-gradient(to top,rgba(127,127,140,.07),rgba(127,127,140,0))}
/* the phone's own row styling, now unused -- the card replaces it */
.mdx-mover-list .mdx-mover-row{display:none}
/* Empty Gainers/Losers keeps the phone's message styling rather than the desktop's grid-spanning one */
.mdx-mover-list .dex-mover-empty{padding:16px 4px;text-align:center;color:var(--text-soft);font-size:13px}
</style>`;

let containers = 0, pages = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = `lumoscore-aptos-${dev}.html`;
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;
  for (const k of KEYS) {
    if (!json[k]) continue;
    let p = json[k];
    p = p.replace(/<style id="lx-movers-css">[\s\S]*?<\/style>/, '');
    if (p.indexOf('</head>') < 0) continue;
    p = p.replace('</head>', STYLE + '</head>');
    if (p !== json[k]) { json[k] = p; changed = true; pages++; }
  }
  if (changed) {
    containers++;
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
console.log('market movers restyled on ' + pages + ' page keys across ' + containers + ' containers');
