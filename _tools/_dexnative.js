// Trade page -> "All Trading Pairs" filter pills.
//
// Was: All | Utility | Memes | Stables. "Utility" lumped BTC, AQUA, yXLM, SHX and LUMOS together under a
// label that told a trader nothing, and "Memes" was a dead pill -- tableData() returned [] for it, so it
// has always rendered "No matching markets". (Left as-is here; giving it content means hand-tagging which
// tokens are memes, which is a judgement call, not data.)
//
// Now: All | *LumosCore native | Stables | Memes. "LumosCore native" is every asset whose ISSUER declares
// home_domain = lumoscore.com -- i.e. minted through our own Launchpad -- discovered live rather than
// hardcoded, so a token minted tomorrow appears without a rebuild. The data side lives in _dexdata.js.
//
// This runs at BUILD time rather than relabelling in JS at runtime: a runtime rename would ship "Utility"
// in the HTML and flip it after first paint, which is a visible flash on exactly the element the eye is on.
//
// Usage: node _tools/_dexnative.js [--write]
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const KEYS = ['lumoscore-dex.html', 'lumoscore-dex-dark.html', 'lumoscore-dex-mobile.html'];

// &#9733; not a literal star: the containers round-trip through JSON.stringify and this keeps the payload
// pure ASCII, so no encoding step in the chain can mangle it.
const STAR = '<span class="lx-mk-star" aria-hidden="true">&#9733;</span>';

// data-cat as well as data-filter: the desktop layer reads data-filter, but the mobile layer's mkFilter()
// reads data-cat and falls back to the button's TEXT. With a label of "LumosCore native" that fallback
// would look for a category called "lumoscore native" and match nothing.
function pills(p) {
  return '<button class="' + p + '-mk-filter active" data-filter="all" data-cat="all">All</button>\n'
    + '          <button class="' + p + '-mk-filter lx-mk-native" data-filter="native" data-cat="native">'
    + STAR + 'LumosCore native</button>\n'
    + '          <button class="' + p + '-mk-filter" data-filter="stables" data-cat="stables">Stables</button>\n'
    + '          <button class="' + p + '-mk-filter" data-filter="memes" data-cat="memes">Memes</button>';
}

const RE = /<button class="(dex|mdx)-mk-filter active" data-filter="all">All<\/button>\s*<button class="(?:dex|mdx)-mk-filter" data-filter="utility">Utility<\/button>\s*<button class="(?:dex|mdx)-mk-filter" data-filter="memes">Memes<\/button>\s*<button class="(?:dex|mdx)-mk-filter" data-filter="stables">Stables<\/button>/;

const STYLE = '<style id="lx-dexnative-css">'
  + '.lx-mk-star{color:var(--accent,#ea6a2c);font-size:12.5px;line-height:1;margin-right:1px}'
  // The longer label pushes four pills past a phone's width. Let the row scroll instead of letting flex
  // crush every pill to fit -- a squashed "LumosCore native" is worse than a swipe.
  + '.mdx-mk-filters{overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}'
  + '.mdx-mk-filters::-webkit-scrollbar{display:none}'
  + '.mdx-mk-filter{flex:0 0 auto;white-space:nowrap}'
  + '.dex-mk-filter{white-space:nowrap}'
  + '</style>';

let n = 0, containers = 0, missed = [];
const files = fs.readdirSync('.').filter(f => /^lumoscore-.*-(desktop|mobile)\.html$/.test(f));
for (const file of files) {
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;
  for (const k of KEYS) {
    if (!json[k]) continue;
    let p = json[k];
    p = p.replace(/<style id="lx-dexnative-css">[\s\S]*?<\/style>/, '');
    const m = RE.exec(p);
    if (m) { p = p.replace(RE, pills(m[1])); }
    else if (p.indexOf('data-filter="native"') < 0) { missed.push(file + ':' + k); continue; }
    if (p.indexOf('</head>') < 0) { missed.push(file + ':' + k + ' (no head)'); continue; }
    json[k] = p.replace('</head>', STYLE + '</head>');
    changed = true; n++;
  }
  if (changed) {
    containers++;
    if (process.argv.includes('--write')) {
      const B = String.fromCharCode(92);
      const ser = JSON.stringify(json).split('</').join('<' + B + '/');
      fs.writeFileSync(file, data.slice(0, s) + ser + data.slice(e), 'utf8');
    }
  }
}
console.log('dex native pills: rewrote=' + n + ' keys across ' + containers + ' containers'
  + (missed.length ? '\n  NOT MATCHED: ' + missed.join(', ') : '')
  + (process.argv.includes('--write') ? '' : '  (dry run - pass --write)'));
