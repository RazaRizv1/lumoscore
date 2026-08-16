// Redesign the dex-asset "Stats row" into attractive, symmetrical equal cards.
// - wraps a trailing unit (e.g. "HBAR"/"APT") in the .val into <span class="u"> so values stay single-line
// - appends an override <style id="lx-assetstats"> (theme-adaptive, works light+dark)
// Idempotent. Usage: node _tools/restyle_dexstats.js [--write]
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const STYLE = '<style id="lx-assetstats">'
  + '.stat-row{gap:9px;background:transparent !important;border-top:none !important;'
  // The design sizes this row by VIEWPORT width (6 cols, 3 below 1280px, 2 below 880px). The sidebar
  // is ~285px and expands WITHOUT changing the viewport, so on a wide window the row still asked for
  // 6 columns in a container too narrow to hold them, and the last card (Supply) was cropped off the
  // right edge. auto-fit measures the CONTAINER, so the column count now follows the space actually
  // available and reflows the moment the sidebar opens or closes. This rule is injected after the
  // design css and media queries add no specificity, so it beats both breakpoints at every width —
  // which is intended: those breakpoints were the bug.
  // FIVE, not six. The "24h Change" card is gone (dropChangeCell below) because the same figure is
  // already the change pill directly under the price, three lines above it -- and carrying it twice cost
  // a whole second row. Five across on one line puts the chart ~72px higher, which was the point.
  + 'grid-template-columns:repeat(5,minmax(0,1fr))}'
  // minmax(0,1fr) instead of 1fr: a bare 1fr floors at min-content, and every line in a cell is
  // nowrap, so the track could not shrink and the row overflowed rather than fitting.
  // .asset-header becomes the query container so the counts below follow the column the row actually
  // lives in (~712px beside the swap panel) rather than the window.
  + '.asset-header{container-type:inline-size}'
  // SIX ACROSS, ALWAYS — on desktop the row stays one line whatever the sidebar is doing. The cards
  // compress instead of wrapping, which is why minmax(0,1fr) and .stat-cell{min-width:0} matter: the
  // grid default of min-content plus nowrap text is what made the row overflow and clip Supply.
  // Below ~760px of container (real phones) six cards would be unreadable, so it drops to 3 then 2.
  // 1140 was the right fold for six cards and the wrong one for five: the column beside the swap panel
  // is ~712-970px wide, so EVERY desktop width fell under it and the row always broke to two lines --
  // which is the complaint this change answers. Measured instead of guessed: five cards stay legible
  // down to ~600px of container (each track ~113px, and the compact ramp below has already tightened
  // the type by then). Under that they fold to three, then two.
  // 660, and the number is measured rather than round: at a 650px container the price track is 122px and
  // "0.00009532 XLM" no longer fits at any size above the clamp floor. 672 (a 1400px window) is the
  // narrowest that stays clean, so the fold sits just under it.
  //
  // It folds to THREE, not two, even though five leaves a ragged 3+2. Two columns would put five cards on
  // three rows -- taller than the two-row layout this change exists to remove, and the band below the fold
  // is real (a 1366px laptop lands in it). A gap on one row beats an extra row.
  + '@container (max-width:660px){.stat-row{grid-template-columns:repeat(3,minmax(0,1fr))}}'
  + '@container (max-width:430px){.stat-row{grid-template-columns:repeat(2,minmax(0,1fr))}}'
  // Only in the two-column regime: there the leftover card spanning the full width reads as deliberate.
  // Scoped, because at five and at three across the same rule would drop that card onto its own row and
  // cost exactly the height being reclaimed. The mobile build has no container, so its plain media query
  // below carries the same rule for the three cards it shows.
  + '@container (max-width:430px){.stat-row>.stat-cell:last-child:nth-child(odd){grid-column:1/-1}}'
  // min-width:0 is the other half of the crop fix. A grid item defaults to min-width:auto, i.e. its
  // min-content width, and every line in here is white-space:nowrap — so the cells refused to shrink
  // and the row overflowed its container instead of adapting. With 0 they shrink and the .sub line
  // ellipsises as it was already styled to.
  + '.stat-cell{min-width:0;padding:11px 14px !important;border:1px solid var(--border) !important;border-radius:13px;background:var(--surface);display:flex;flex-direction:column;justify-content:flex-start;min-height:0;transition:border-color .15s ease,box-shadow .15s ease}'
  + '.stat-cell:hover{border-color:var(--accent-soft,rgba(234,106,44,.32)) !important;box-shadow:0 10px 24px -18px rgba(234,106,44,.5)}'
  + '.stat-cell .lbl{font-size:11.5px;letter-spacing:.08em;font-weight:700;margin-bottom:4px;white-space:nowrap}'
  // ellipsis rather than a value that spills past the card edge once the cell can shrink
  + '.stat-cell .val{font-size:17.5px;font-weight:800;letter-spacing:-.015em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.05;color:var(--text)}'
  + '.stat-cell .val .u{font-size:11.5px;font-weight:600;color:var(--text-muted);margin-left:2px}'
  // Two lines allowed, not one. Narrower tracks mean the longest sub -- Liquidity's two pool reserves,
  // "TDT: 10.64M | xLMNR: 4.42M", ~178px of text in a ~139px track -- would otherwise ellipsise away the
  // second reserve, and showing both is the whole reason that line exists. The clamp still caps growth,
  // so a pathological value cannot stretch the row: cells with a short sub stay one line, the grid
  // stretches them all to match, and the row settles ~14px taller than a strict single line.
  + '.stat-cell .sub{font-size:11.5px;margin-top:2px;display:-webkit-box;-webkit-box-orient:vertical;'
  + '-webkit-line-clamp:2;overflow:hidden;white-space:normal;overflow-wrap:anywhere}'
  // ---- compact ramp, LAST ON PURPOSE ----------------------------------------------------------
  // These MUST come after the base .stat-cell/.lbl/.val/.sub rules above: a container query adds no
  // specificity, so if they sat earlier the base font-size would simply win and the whole ramp would
  // silently do nothing (which is exactly what happened the first time).
  //
  // Retuned for five-across. The old steps fired at 620/470/360 — widths at which the row had ALREADY
  // folded to fewer columns, so each track was getting WIDER while the ramp shrank the type: it tightened
  // exactly where there was room and did nothing where there wasn't. Now the ramp belongs to the
  // five-across regime and stops at the fold.
  //
  // THE VALUE SIZE IS CONTINUOUS, NOT STEPPED, and that is a correctness fix rather than a flourish.
  // A Stellar price has no fixed length: this same card read "0.000093" one minute and "0.00009534" the
  // next, and the longer one clipped at a step size the shorter one cleared. Any ladder of fixed sizes is
  // therefore only ever tuned to whatever the price happened to be when it was measured. clamp() on cqi
  // ties the type to the track it has to fit in, so the number the whole page is about cannot end in an
  // ellipsis. 2.15cqi hits the 17.5px ceiling at a ~815px container and reads 14.4px at 672 (a 1400px
  // window beside the swap panel), where 10 characters plus the unit measured 111px against 103px of room.
  + '@container (min-width:0px){.stat-cell .val{font-size:clamp(13px,2.15cqi,17.5px)}'
  + '.stat-cell .val .u{font-size:clamp(9.5px,1.42cqi,11.5px)}}'
  + '@container (max-width:820px){.stat-cell{padding:11px 12px !important}'
  + '.stat-cell .lbl{font-size:11px;letter-spacing:.07em}}'
  + '@container (max-width:700px){.stat-cell{padding:10px 11px !important}'
  + '.stat-cell .lbl{font-size:10.5px}.stat-cell .sub{font-size:11px}}'
  // Below the fold the row is three columns, so each track jumps back to ~210px and the type goes back to
  // full size — including the clamp, which would otherwise keep shrinking on a measure that just got wider.
  + '@container (max-width:660px){.stat-cell{padding:13px 14px !important}'
  + '.stat-cell .val{font-size:17.5px}.stat-cell .val .u{font-size:11.5px}'
  + '.stat-cell .lbl{font-size:11.5px;letter-spacing:.08em}.stat-cell .sub{font-size:11.5px}}'
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
  // Three cards on a phone now that 24h Change is gone, so the last one would sit alone in a half-width
  // slot. Let it span instead. (Container queries cannot do this here: the mobile build has no
  // .asset-header, so no container is ever established -- hence the plain media query.)
  + '.stat-row>.stat-cell:last-child:nth-child(odd){grid-column:1/-1}'
  + '.stat-cell{padding:13px 14px !important;min-width:0}'
  + '.stat-cell .val{font-size:17px}.stat-cell .val .u{font-size:12px}'
  + '.stat-cell .lbl{font-size:10px;letter-spacing:.06em;margin-bottom:5px}'
  + '.stat-cell .sub{font-size:11px;white-space:normal;overflow-wrap:anywhere}'
  // The tab strip is ~428px of tabs in a 342px box. Wrapping pushed Pools onto its own row; scrolling
  // let the whole strip slide under a finger and settle anywhere. Neither is "fixed in place", so make
  // the tabs FIT instead: the four share the width equally and the row cannot scroll at all.
  // The count badges are what overflow it — they alone are ~100px (Holders 191,691 is 48px of that).
  // Dropping them below 760px buys enough room that even a seven-digit holder count cannot reopen the
  // problem; desktop keeps its counts, and each count is still shown inside its own tab panel.
  // overflow must be set on BOTH axes. Setting overflow-x alone leaves overflow-y computed as auto (the
  // spec forces a non-visible value on one axis to make the other auto), and the row is 1px taller than
  // its box — so the strip became draggable UP AND DOWN instead. `overflow:hidden` closes both.
  // overflow must be set on BOTH axes. Setting overflow-x alone leaves overflow-y computed as auto (the
  // spec forces the other axis to auto when one is not visible), and the row is 1px taller than its box
  // — so the strip became draggable UP AND DOWN instead. The 2px of padding removes that 1px overflow
  // outright, so there is no scroll container left to drag and the active-tab underline (which sits on
  // the bottom edge and was being clipped by the hidden overflow) is fully visible again.
  + '.tabs-bar{overflow:hidden !important;flex-wrap:nowrap !important;gap:0 !important;'
  + 'padding-bottom:2px !important}'
  + '.tabs-bar>*{flex:1 1 0 !important;min-width:0 !important;padding-left:4px !important;'
  + 'padding-right:4px !important;font-size:12.5px !important;justify-content:center !important;'
  + 'text-align:center;white-space:nowrap}'
  + '.tabs-bar .count{display:none !important}'
  // The swap panel painted each token logo into a 10px box inside a 20px black circle, so the icon read
  // as a dot with a black ring around it. The 10px comes from an INLINE style on the design's wrapper,
  // which is why these need !important to win.
  // background-COLOR, not the `background` shorthand: the shorthand also resets background-image, and
  // with !important it beat the inline logo URL the trade layer sets, blanking the icon it just fixed.
  + '.mdxa-trade-ic{width:24px !important;height:24px !important;background-color:transparent !important;'
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

// Find the stat-row block by depth-matching its divs. indexOf('</div>') would stop at the first cell's
// close, and every caller here needs the row's real extent.
function statRowBlock(h){
  const si = h.indexOf('<div class="stat-row">');
  if (si < 0) return null;
  let i = h.indexOf('>', si) + 1, d = 1;
  while (d > 0){ const n = h.indexOf('<div', i), c = h.indexOf('</div>', i); if (c < 0) return null;
    if (n >= 0 && n < c){ d++; i = n + 4; } else { d--; i = c + 6; } }
  return { si, ei: i, block: h.slice(si, i) };
}

// Delete the "24h Change" card. The figure is already the change pill under the price, so the card was
// a second copy of it that cost an entire row of height.
//
// Keyed on the LABEL TEXT, never on position. The card happens to be second today, but :nth-child(2)
// would silently delete Volume the day someone reorders the row -- and the mobile build abbreviates the
// label to "24h", so a position rule would also have to be right twice. Matching the text is right once.
//
// Idempotent by construction: once the card is gone there is nothing left to match.
function dropChangeCell(h){
  const row = statRowBlock(h);
  if (!row) return h;
  let b = row.block;
  const li = b.search(/<div class="lbl">\s*24h(\s+Change)?\s*<\/div>/);
  if (li < 0) return h;
  const cs = b.lastIndexOf('<div class="stat-cell">', li);
  if (cs < 0) return h;
  // walk to this cell's own close
  let i = b.indexOf('>', cs) + 1, d = 1;
  while (d > 0){ const n = b.indexOf('<div', i), c = b.indexOf('</div>', i); if (c < 0) return h;
    if (n >= 0 && n < c){ d++; i = n + 4; } else { d--; i = c + 6; } }
  // take the whitespace in front of the card with it so the block stays tidy
  let start = cs;
  while (start > 0 && (b[start - 1] === ' ' || b[start - 1] === '\n')) start--;
  b = b.slice(0, start) + b.slice(i);
  return h.slice(0, row.si) + b + h.slice(row.ei);
}

// Wrap a trailing " UNIT" (2-5 uppercase letters) inside stat-cell .val divs, within the stat-row block only.
function transform(h){
  // The card removal runs on EVERY pass, before the style-block shortcut below. Putting it after that
  // early return would mean it never ran on a container the transform had already touched -- which is
  // every container, since this transform has shipped before.
  let changed = false;
  const dropped = dropChangeCell(h);
  if (dropped !== h){ h = dropped; changed = true; }

  // Already applied: the unit-wrapping below must not run twice, but REPLACE the style block instead
  // of bailing out. Returning early meant any later edit to STYLE silently never reached the
  // containers — the transform reported success while changing nothing.
  if (h.indexOf('id="lx-assetstats"') >= 0){
    const out = h.replace(/<style id="lx-assetstats">[\s\S]*?<\/style>/, () => STYLE);
    return { h: out, changed: changed || out !== h };
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
