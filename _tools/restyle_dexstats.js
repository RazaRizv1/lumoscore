// Redesign the dex-asset "Stats row" into attractive, symmetrical equal cards.
// - wraps a trailing unit (e.g. "HBAR"/"APT") in the .val into <span class="u"> so values stay single-line
// - appends an override <style id="lx-assetstats"> (theme-adaptive, works light+dark)
// Idempotent. Usage: node _tools/restyle_dexstats.js [--write]
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const STYLE = '<style id="lx-assetstats">'
  + '.stat-row{gap:11px;background:transparent !important;border-top:none !important;'
  // The design sizes this row by VIEWPORT width (6 cols, 3 below 1280px, 2 below 880px). The sidebar
  // is ~285px and expands WITHOUT changing the viewport, so on a wide window the row still asked for
  // 6 columns in a container too narrow to hold them, and the last card (Supply) was cropped off the
  // right edge. auto-fit measures the CONTAINER, so the column count now follows the space actually
  // available and reflows the moment the sidebar opens or closes. This rule is injected after the
  // design css and media queries add no specificity, so it beats both breakpoints at every width —
  // which is intended: those breakpoints were the bug.
  + 'grid-template-columns:repeat(6,minmax(0,1fr))}'
  // minmax(0,1fr) instead of 1fr: a bare 1fr floors at min-content, and every line in a cell is
  // nowrap, so the track could not shrink and the row overflowed rather than fitting.
  // .asset-header becomes the query container so the counts below follow the column the row actually
  // lives in (~712px beside the swap panel) rather than the window.
  + '.asset-header{container-type:inline-size}'
  // SIX ACROSS, ALWAYS — on desktop the row stays one line whatever the sidebar is doing. The cards
  // compress instead of wrapping, which is why minmax(0,1fr) and .stat-cell{min-width:0} matter: the
  // grid default of min-content plus nowrap text is what made the row overflow and clip Supply.
  // Below ~760px of container (real phones) six cards would be unreadable, so it drops to 3 then 2.
  + '@container (max-width:760px){.stat-row{grid-template-columns:repeat(3,minmax(0,1fr))}}'
  + '@container (max-width:430px){.stat-row{grid-template-columns:repeat(2,minmax(0,1fr))}}'
  // min-width:0 is the other half of the crop fix. A grid item defaults to min-width:auto, i.e. its
  // min-content width, and every line in here is white-space:nowrap — so the cells refused to shrink
  // and the row overflowed its container instead of adapting. With 0 they shrink and the .sub line
  // ellipsises as it was already styled to.
  + '.stat-cell{min-width:0;padding:15px 16px !important;border:1px solid var(--border) !important;border-radius:13px;background:var(--surface);display:flex;flex-direction:column;justify-content:center;min-height:92px;transition:border-color .15s ease,box-shadow .15s ease}'
  + '.stat-cell:hover{border-color:var(--accent-soft,rgba(234,106,44,.32)) !important;box-shadow:0 10px 24px -18px rgba(234,106,44,.5)}'
  + '.stat-cell .lbl{font-size:10.5px;letter-spacing:.09em;font-weight:700;margin-bottom:9px;white-space:nowrap}'
  // ellipsis rather than a value that spills past the card edge once the cell can shrink
  + '.stat-cell .val{font-size:18px;font-weight:800;letter-spacing:-.015em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.05;color:var(--text)}'
  + '.stat-cell .val .u{font-size:11.5px;font-weight:600;color:var(--text-muted);margin-left:2px}'
  + '.stat-cell .sub{font-size:12px;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  // ---- compact ramp, LAST ON PURPOSE ----------------------------------------------------------
  // Tighten padding and type as the container narrows so six cards stay legible instead of
  // ellipsising. These MUST come after the base .stat-cell/.lbl/.val/.sub rules above: a container
  // query adds no specificity, so if they sat earlier the base font-size would simply win and the
  // whole ramp would silently do nothing (which is exactly what happened the first time).
  + '@container (max-width:1140px){.stat-cell{padding:13px 12px !important}'
  + '.stat-cell .val{font-size:15px}.stat-cell .val .u{font-size:10.5px}'
  + '.stat-cell .lbl{font-size:9.5px;letter-spacing:.06em}.stat-cell .sub{font-size:11px}}'
  + '@container (max-width:1000px){.stat-cell{padding:12px 10px !important}'
  + '.stat-cell .val{font-size:13px}.stat-cell .val .u{font-size:9.5px}'
  + '.stat-cell .lbl{font-size:9px}.stat-cell .sub{font-size:10px}}'
  + '@container (max-width:880px){.stat-cell{padding:11px 8px !important}'
  + '.stat-cell .val{font-size:11.5px}.stat-cell .val .u{font-size:8.5px}'
  + '.stat-cell .lbl{font-size:8.5px;margin-bottom:6px}.stat-cell .sub{font-size:9px}}'
  // ---- MOBILE ----------------------------------------------------------------------------------
  // Everything above is a @container query keyed on .asset-header — but the MOBILE build has no
  // .asset-header (its wrapper is .asset-top inside .asset-card), so no container was ever
  // established and every one of those queries silently never matched. All a phone got was the
  // unconditional six-column rule, which squeezed its four cards into 48px each: "$0.00204" rendered
  // as "0." and the labels clipped to "VOLUM". A plain media query needs no container, and on a phone
  // the viewport IS the container, so this is both correct and free of containment side effects.
  // Placed LAST so cascade position cannot defeat it — media queries add no specificity.
  + '@media (max-width:760px){'
  + '.stat-row{grid-template-columns:repeat(2,minmax(0,1fr)) !important;gap:10px}'
  + '.stat-cell{padding:13px 14px !important;min-width:0}'
  + '.stat-cell .val{font-size:17px}.stat-cell .val .u{font-size:12px}'
  + '.stat-cell .lbl{font-size:10px;letter-spacing:.06em;margin-bottom:5px}'
  + '.stat-cell .sub{font-size:11px;white-space:normal;overflow-wrap:anywhere}'
  // The tab strip holds ~442px of tabs in a 342px box. Wrapping it onto two rows pushed Pools onto a
  // line of its own, so keep all four on ONE line and make the horizontal scroll deliberate instead:
  // snap points so it comes to rest on a tab rather than mid-label, momentum scrolling, and no
  // scrollbar gutter. flex:0 0 auto stops the tabs from being squeezed to fit.
  + '.tabs-bar{overflow-x:auto !important;flex-wrap:nowrap !important;scroll-snap-type:x proximity;'
  + '-webkit-overflow-scrolling:touch;scrollbar-width:none;-ms-overflow-style:none;overscroll-behavior-x:contain}'
  + '.tabs-bar::-webkit-scrollbar{display:none}'
  + '.tabs-bar>*{flex:0 0 auto;scroll-snap-align:start}'
  // The swap panel painted each token logo into a 10px box inside a 20px black circle, so the icon read
  // as a dot with a black ring around it. The 10px comes from an INLINE style on the design's wrapper,
  // which is why these need !important to win.
  + '.mdxa-trade-ic{width:24px !important;height:24px !important;background:transparent !important;'
  + 'overflow:hidden;border-radius:50%;flex:0 0 auto}'
  + '.mdxa-trade-ic>*{width:24px !important;height:24px !important}'
  + '.mdxa-trade-ic img{width:100% !important;height:100% !important;object-fit:cover;display:block}'
  + '.mdxa-trade-asset{gap:7px}'
  // "You receive" builds its logo differently from "You pay": no .mdxa-trade-ic, just an EMPTY span
  // carrying the image as a background. It collapsed to its content box — 15x10 — so the logo rendered
  // as a speck. Give the chip a real square to paint into.
  + '.mdxa-trade-asset[data-logo]{width:24px !important;height:24px !important;min-width:24px;'
  + 'border-radius:50%;background-size:cover !important;background-position:50% 50% !important;'
  + 'background-repeat:no-repeat !important;flex:0 0 auto}'
  + '}'
  + '</style>';

// Wrap a trailing " UNIT" (2-5 uppercase letters) inside stat-cell .val divs, within the stat-row block only.
function transform(h){
  // Already applied: the unit-wrapping below must not run twice, but REPLACE the style block instead
  // of bailing out. Returning early meant any later edit to STYLE silently never reached the
  // containers — the transform reported success while changing nothing.
  if (h.indexOf('id="lx-assetstats"') >= 0){
    const out = h.replace(/<style id="lx-assetstats">[\s\S]*?<\/style>/, () => STYLE);
    return { h: out, changed: out !== h };
  }
  const si = h.indexOf('<div class="stat-row">');
  if (si < 0) return { h, changed:false };
  // depth-match the stat-row block
  let i = h.indexOf('>', si) + 1, d = 1;
  while (d > 0){ const n = h.indexOf('<div', i), c = h.indexOf('</div>', i); if (c < 0) break; if (n >= 0 && n < c){ d++; i = n + 4; } else { d--; i = c + 6; } }
  const block = h.slice(si, i);
  const newBlock = block.replace(/(<div class="val[^"]*">)([^<]*?) ([A-Z]{2,5})(<\/div>)/g,
    (m, a, num, unit, end) => a + num + '<span class="u">' + unit + '</span>' + end);
  let out = h.slice(0, si) + newBlock + h.slice(i);
  // append override style before </body>
  const bi = out.lastIndexOf('</body>');
  out = bi >= 0 ? out.slice(0, bi) + STYLE + out.slice(bi) : out + STYLE;
  return { h: out, changed:true };
}

const chains = ['aptos','hedera','starknet','vechain','worldchain'];
const files = [];
for (const c of chains){ files.push(`lumoscore-${c}-desktop.html`, `lumoscore-${c}-mobile.html`); }
const write = process.argv.includes('--write');
for (const file of files){
  const data = read(file);
  const { json, s, e } = getContents(data);
  let n = 0;
  for (const k of Object.keys(json)){
    if (!/dex-asset/.test(k)) continue;
    const r = transform(json[k]);
    if (r.changed){ json[k] = r.h; n++; }
  }
  if (write && n){
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
  console.log(`${write?'[WROTE]':'[DRY]'} ${file}: restyled ${n} dex-asset stat rows`);
}
