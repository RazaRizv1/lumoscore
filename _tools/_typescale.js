// #28 — scale TYPE and SPACING by 10%, and nothing else.
//
// WHY THIS SHAPE. The design's CSS is entirely in px: 330 font-size declarations, zero rem, one em. So
// the usual lever -- raise the root font-size and let rem do the work -- does nothing here. (There IS
// already a `<style id="lx-typescale">html{font-size:19.5px}` in the desktop container, baked into the
// design export rather than produced by any transform, and with no rem in the stylesheet it is inert.
// It is left alone.)
//
// WHAT IS SCALED: font-size, px line-heights, and the four spacing properties (padding, margin, gap and
// their long forms), plus the size/line-height inside a `font:` shorthand.
//
// WHAT IS DELIBERATELY NOT: width, height, min/max-width, min/max-height, flex-basis, top/right/bottom/
// left, grid-template-*, border-width, border-radius, box-shadow, transform, stroke-width, letter-
// spacing. Those are the page's skeleton and its hairlines. Growing type inside an unchanged skeleton is
// the whole point of "scale type and spacing" -- and it is also the risk, which is why this ships with a
// measured overflow check rather than on the assumption that it is fine.
//
// Media query CONDITIONS are untouched by construction: a breakpoint reads `(max-width:760px)`, and
// max-width is not in the property list, so the phone stays the phone.
//
// IDEMPOTENCY MATTERS MORE THAN USUAL. This rewrites the container in place, and the containers are the
// source -- they are not regenerated from anything. A second run would compound to 1.21x, a third to
// 1.33x, and nothing would look obviously wrong until it was far too big.
//
// The mark goes on each <style> BLOCK, not on the page. A page-level sentinel would have been simpler
// and wrong: every other transform injects its own stylesheet, so after this ran once, any CSS added
// later would keep its authored size while the design around it grew -- our own labels sitting at 10px
// beside the design's at 11. Marking per block means a re-run scales exactly the blocks that are new and
// leaves the rest alone, so this can be re-run after any transform and stay correct.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');

const FACTOR = 1.10;
const MARK = 'data-lxts';

// Long forms listed explicitly rather than matched by prefix: `padding` must not also catch a property
// that merely starts with those letters, and an explicit list is auditable.
const PROPS = [
  'font-size', 'line-height',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'padding-block', 'padding-inline', 'padding-block-start', 'padding-block-end',
  'padding-inline-start', 'padding-inline-end',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'margin-block', 'margin-inline', 'margin-block-start', 'margin-block-end',
  'margin-inline-start', 'margin-inline-end',
  'gap', 'row-gap', 'column-gap', 'grid-gap', 'grid-row-gap', 'grid-column-gap',
];

function scaleNum(n) {
  const v = parseFloat(n) * FACTOR;
  // One decimal is plenty at these sizes and keeps the stylesheet readable; 8.5px -> 9.4px.
  const r = Math.round(v * 10) / 10;
  return (Math.abs(r - Math.round(r)) < 0.001) ? String(Math.round(r)) : String(r);
}

// Multiply every px length inside one declaration VALUE. Anything that is not a px length -- percentages,
// unitless line-heights, `auto`, `inherit`, var() fallbacks in other units -- is returned untouched.
function scaleValue(val) {
  return val.replace(/(-?\d*\.?\d+)px\b/g, (m, num) => scaleNum(num) + 'px');
}

function scaleCss(css) {
  let hits = 0;

  // The `font:` shorthand carries the size (and optionally /line-height) in the middle of a value whose
  // other parts must not be touched -- `font: 800 14px/1.2 "Hanken Grotesk"` has a weight that would be
  // ruined by a blind numeric pass. Only the px lengths are scaled, and a unitless line-height after the
  // slash is left as the ratio it is.
  css = css.replace(/(^|[;{}\s])font\s*:\s*([^;{}]+)/gi, (m, lead, val) => {
    if (!/\d+(?:\.\d+)?px/.test(val)) return m;
    hits++;
    return lead + 'font:' + scaleValue(val);
  });

  const re = new RegExp('(^|[;{}\\s])(' + PROPS.join('|') + ')\\s*:\\s*([^;{}]+)', 'gi');
  css = css.replace(re, (m, lead, prop, val) => {
    if (!/\d/.test(val) || !/px/.test(val)) return m;   // 0, auto, %, inherit — nothing to do
    hits++;
    return lead + prop + ':' + scaleValue(val);
  });

  return { css, hits };
}

// Only inside <style> blocks. Inline style="" attributes are mostly written by the running app from live
// data, so scaling the handful that are static would be inconsistent with the rest and impossible to keep
// idempotent.
function scalePage(html) {
  let hits = 0, blocks = 0, already = 0;
  const out = html.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, open, body, close) => {
    if (open.indexOf(MARK) >= 0) { already++; return m; }   // this block is already at scale
    const r = scaleCss(body);
    hits += r.hits; blocks++;
    // The mark records the factor, so a future change of FACTOR is visible in the container rather than
    // silently compounding on top of the old one.
    return open.replace(/>$/, ' ' + MARK + '="' + FACTOR + '">') + r.css + close;
  });
  return { html: out, hits, blocks, already };
}

const WRITE = process.argv.includes('--write');
let pages = 0, decls = 0, blocks = 0, already = 0;

for (const dev of ['desktop', 'mobile']) {
  const file = `lumoscore-aptos-${dev}.html`;
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;

  for (const k of Object.keys(json)) {
    const r = scalePage(json[k]);
    already += r.already;
    if (!r.hits) continue;
    json[k] = r.html;
    decls += r.hits; blocks += r.blocks; pages++; changed = true;
  }

  // Same write-back every other transform uses: the page map lives inside a <script> tag, so "</" has to
  // be re-escaped or the serialized JSON closes that tag early and takes the rest of the file with it.
  if (changed && WRITE) {
    const B = String.fromCharCode(92);
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}

console.log('typescale x' + FACTOR + ': ' + decls + ' declarations in ' + blocks
  + ' style blocks on ' + pages + ' page keys'
  + (already ? (', ' + already + ' blocks already at scale (left alone)') : '')
  + (WRITE ? '' : '   (dry run — pass --write)'));
