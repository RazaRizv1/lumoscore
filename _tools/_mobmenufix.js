// The mobile slide-out menu is cropped at the bottom on Chrome — the theme switcher sits in
// .menu-theme-row, which is pinned with margin-top:auto, and the panel is `height:100vh`.
//
// On mobile Chrome 100vh is the LARGE viewport height, measured as if the address bar were hidden.
// While the bar is showing, the visible area is shorter than 100vh, so the bottom-pinned row is pushed
// past the fold and there is no way to reach it — the panel has no scroll either.
//
// 100dvh is the DYNAMIC viewport height, which tracks the address bar, so the panel always matches
// what is actually on screen. 100vh stays first as the fallback for anything without dvh support, and
// overflow-y:auto means a short screen or large text can still scroll to the last row rather than
// clipping it. The safe-area inset keeps it clear of the home indicator on notched devices.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const CSS = '<style id="lx-mobmenufix">'
  + '.slide-menu{height:100vh;height:100dvh;overflow-y:auto;-webkit-overflow-scrolling:touch;'
  + 'padding-bottom:calc(24px + env(safe-area-inset-bottom,0px))}'
  + '.menu-theme-row{flex-shrink:0}'
  + '</style>';

let n = 0, files = 0;
for (const dev of ['mobile']) {
  for (const chain of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain', 'stellar', 'xrpl']) {
    const file = `lumoscore-${chain}-${dev}.html`;
    let data;
    try { data = read(file); } catch (e) { continue; }
    const { json, s, e } = getContents(data);
    let touched = false;

    for (const k of Object.keys(json)) {
      let h = json[k];
      if (h.indexOf('.slide-menu') < 0) continue;          // page has no slide menu
      h = h.replace(/<style id="lx-mobmenufix">[\s\S]*?<\/style>/, '');   // idempotent
      if (h.indexOf('</head>') < 0) continue;
      json[k] = h.replace('</head>', CSS + '</head>');
      touched = true; n++;
    }
    if (touched) {
      const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
      fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
      files++;
    }
  }
}
console.log('mobile menu height fix: ' + n + ' page keys across ' + files + ' container(s)');
