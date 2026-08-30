// One <h1> per page, saying what the page is.
//
// The SEO audit found three faults, each a different shape:
//
//   Dashboard and Wallet have NO h1 at all. Both build their header in script, so the shipped HTML
//   has no heading a crawler can read -- the page has no stated subject.
//
//   The LUMOS token page has TWO. One is the visible hero title; the other is the heading of the
//   network-chooser section, which ships with `hidden` on it. Hidden or not, it is in the markup, and
//   two h1s means neither is the title.
//
// WHAT THIS DOES NOT DO: change any visible element's tag. Those pages are finalised and their CSS is
// keyed to the current tags, so promoting a real heading risks restyling a working page to fix a
// metadata problem. Instead the two missing h1s are added as visually-hidden headings -- read by
// crawlers and screen readers, invisible on screen, and stating exactly what the page already shows.
// The duplicate is demoted to h2, which is what it always was semantically.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// clip-rect rather than display:none: hidden text still has to be in the accessibility tree and in
// the rendered DOM, and display:none is the one form crawlers are entitled to discount.
const CSS = '<style id="lx-h1-css">'
  + '.lx-srh1{position:absolute!important;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;'
  + 'clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}'
  + '</style>';

// page key -> the heading that page should have carried all along
const NEEDS_H1 = {
  'lumoscore-home': 'LumosCore dashboard',
  'lumoscore-wallet': 'Your Stellar wallet',
};

function baseKey(key) {
  return key.replace(/\.html$/, '').replace(/-(dark|light|mobile)$/, '');
}

let added = 0, demoted = 0, styled = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = 'lumoscore-aptos-' + dev + '.html';
  let data; try { data = read(file); } catch (e) { continue; }
  let json, s, e; try { ({ json, s, e } = getContents(data)); } catch (err) { continue; }

  let changed = false;
  for (const key of Object.keys(json)) {
    let h = json[key];
    const before = h;
    const base = baseKey(key);

    // ---- the duplicate: the hidden chooser heading was never the page title ----
    if (h.indexOf('<h1 class="lx-lp-h">') >= 0) {
      h = h.split('<h1 class="lx-lp-h">').join('<h2 class="lx-lp-h">')
           .split('</h1>\n<p class="lx-lp-sub">').join('</h2>\n<p class="lx-lp-sub">');
      // the close tag may not be adjacent to the sub-paragraph; fix the first stray </h1> after it
      const i = h.indexOf('<h2 class="lx-lp-h">');
      if (i >= 0) {
        const j = h.indexOf('</h1>', i);
        if (j >= 0) h = h.slice(0, j) + '</h2>' + h.slice(j + 5);
      }
      demoted++;
    }

    // ---- the missing ones ----
    const title = NEEDS_H1[base];
    if (title && h.indexOf('class="lx-srh1"') < 0) {
      const m = h.match(/<main[^>]*>/);
      if (m) {
        const at = h.indexOf(m[0]) + m[0].length;
        h = h.slice(0, at) + '<h1 class="lx-srh1">' + title + '</h1>' + h.slice(at);
        added++;
      }
    }

    // the stylesheet only goes where the hidden heading actually is
    if (h.indexOf('class="lx-srh1"') >= 0 && h.indexOf('id="lx-h1-css"') < 0) {
      const hi = h.indexOf('</head>');
      if (hi >= 0) { h = h.slice(0, hi) + CSS + h.slice(hi); styled++; }
    }

    if (h !== before) { json[key] = h; changed = true; }
  }

  if (changed) {
    const ser = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + ser + data.slice(e), 'utf8');
  }
}
console.log('h1 fix: ' + added + ' heading(s) added, ' + demoted + ' duplicate(s) demoted to h2, '
  + styled + ' stylesheet(s) injected');
