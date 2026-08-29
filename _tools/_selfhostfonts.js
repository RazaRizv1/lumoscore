// Serve our own fonts instead of Google's.
//
// Every page carried three tags: a preconnect to fonts.googleapis.com, a preconnect to
// fonts.gstatic.com, and the stylesheet link. The preconnects mean a visitor's browser opens a
// connection to Google on page load whether or not a font is ever needed, and both hosts see their IP
// address. A Munich court ruled in 2022 that embedding Google Fonts this way without consent breaches
// the GDPR, which of the ~57 third parties this site touches makes it the only one with a decision
// attached -- and LumosCore OÜ is an Estonian company.
//
// The two families are VARIABLE fonts, so all eight weights come from ten files (one per unicode
// subset), 128 KB in total. assets/fonts/ holds exactly what Google was serving; the @font-face rules
// below are Google's own, with the URLs pointed at our origin and every unicode-range left intact, so
// a browser still downloads only the subsets it needs. Nothing about the rendering changes.
//
// Inlined rather than linked: it is 13 KB, it must not be render-blocking on a third request, and the
// rest of this site injects its CSS the same way.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const CSS_PATH = __dirname + '/fonts-local.css';
let FACES;
try { FACES = fs.readFileSync(CSS_PATH, 'utf8').trim(); }
catch (e) { console.error('missing ' + CSS_PATH + ' — run the font fetch first'); process.exit(1); }
if (FACES.indexOf('fonts.gstatic.com') >= 0) {
  console.error('fonts-local.css still points at gstatic — refusing to inject'); process.exit(1);
}
const BLOCK = '<style id="lx-fonts">' + FACES + '</style>';

// The three tags to remove. Matched on the HOST rather than the exact tag text, so a change to the
// weight list or a swapped attribute order cannot leave a live Google request behind.
const RE_PRECONNECT = /<link[^>]*rel=["']preconnect["'][^>]*fonts\.(?:googleapis|gstatic)\.com[^>]*>/gi;
const RE_PRECONNECT2 = /<link[^>]*fonts\.(?:googleapis|gstatic)\.com[^>]*rel=["']preconnect["'][^>]*>/gi;
const RE_SHEET = /<link[^>]*href=["']https:\/\/fonts\.googleapis\.com\/css2[^"']*["'][^>]*>/gi;
const RE_MINE = /<style id="lx-fonts">[\s\S]*?<\/style>/g;

let touched = 0, files = 0;
for (const chain of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain', 'stellar', 'xrpl']) {
  for (const dev of ['desktop', 'mobile']) {
    const file = `lumoscore-${chain}-${dev}.html`;
    let data; try { data = read(file); } catch (e) { continue; }
    const { json, s, e } = getContents(data);
    let changed = false;

    for (const key of Object.keys(json)) {
      let h = json[key];
      // idempotent: pull our own block before deciding whether there is anything left to do
      h = h.replace(RE_MINE, '');
      if (!RE_SHEET.test(h)) { RE_SHEET.lastIndex = 0; if (h !== json[key]) { json[key] = h; changed = true; } continue; }
      RE_SHEET.lastIndex = 0;

      h = h.replace(RE_PRECONNECT, '').replace(RE_PRECONNECT2, '');
      // the block goes exactly where the stylesheet link was, so font loading keeps its place in the
      // head order rather than being pushed behind whatever follows
      // first link becomes the block; any duplicate link is simply dropped rather than injecting twice
      let injected = false;
      h = h.replace(RE_SHEET, () => { if (injected) return ''; injected = true; return BLOCK; });
      if (!injected) continue;

      json[key] = h; changed = true; touched++;
    }

    if (changed) {
      const ser = JSON.stringify(json).split('</').join('<' + B + '/');
      fs.writeFileSync(file, data.slice(0, s) + ser + data.slice(e), 'utf8');
      files++;
    }
  }
}
console.log('self-hosted fonts: ' + touched + ' page keys across ' + files + ' containers');
