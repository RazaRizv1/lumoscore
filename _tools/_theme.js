// LIGHT/DARK MERGE — make every page carry BOTH themes.
//
// The design already ships a working toggle: #themeToggle, an lxtheme boot script that reads
// localStorage['lumos.theme'] and sets data-theme on <html>, and a handful of
// html[data-theme="dark"] rules. What it does NOT ship is the other theme's colours — each file
// declares only its own palette in :root, so flipping data-theme changed almost nothing and the
// site needed a second file per theme.
//
// Fix: give every file BOTH palettes, scoped by data-theme. Specificity does the rest —
// html[data-theme="x"] (0,1,1) beats :root (0,1,0) — so the attribute the toggle sets now actually
// repaints the page, and light/dark stops being a url.
//
// Applied to EVERY file in a group, not just the canonical one, because routes do not agree on which
// theme is canonical: /wallet is served by the DARK build while /trade/stellar is served by the light
// one. Whichever file answers, both themes work.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

function baseName(key){
  return key.replace(/\.html$/, '').replace(/-(dark|light|mobile)$/, '');
}
// The light builds often carry NO data-theme attribute at all (<html lang="en">), because light is
// the CSS default — so the attribute alone misses them and the page looks single-theme. Fall back to
// the filename, then to light.
function themeOf(html, key){
  const m = html.match(/<html[^>]*data-theme="(light|dark)"/);
  if (m) return m[1];
  if (/-dark\.html$/.test(key)) return 'dark';
  if (/-light\.html$/.test(key)) return 'light';
  return 'light';
}
// only the FIRST :root block is the palette; later ones are component-scoped overrides
function rootVars(html){
  const out = {};
  const m = html.match(/:root\s*\{[^}]*\}/);
  if (!m) return out;
  (m[0].match(/--[a-z0-9-]+\s*:\s*[^;}]+/gi) || []).forEach(d => {
    const i = d.indexOf(':');
    out[d.slice(0, i).trim()] = d.slice(i + 1).trim();
  });
  return out;
}
// crude but sufficient: is this colour bright enough to be a light theme's background?
function isLight(col){
  if (!col) return false;
  const hex = String(col).trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  let r, g, b;
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16);
  } else {
    const m = String(col).match(/\d+/g);
    if (!m || m.length < 3) return false;
    r = +m[0]; g = +m[1]; b = +m[2];
  }
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
}
function block(sel, vars){
  const body = Object.keys(vars).map(k => k + ':' + vars[k]).join(';');
  return body ? sel + '{' + body + '}' : '';
}

const CHAINS = ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain', 'stellar', 'xrpl'];

// PASS 1 — learn the design's own light palette from the pages that already have one.
//
// Trade, Trade-asset, Bridge and Sign-in were only ever designed dark. Rather than hide their theme
// toggle (which just moves the problem), give them the SAME light palette the rest of the app uses.
// This is not invented colour: identical variable names, taken from the design's own light builds,
// by majority vote so one odd page cannot skew it. Those pages are 70-73% variable-driven — more
// than Pools (60%) or Wallet (67%), both of which already render correctly in light.
const CANON_LIGHT = (() => {
  const votes = {};
  for (const chain of CHAINS) {
    for (const dev of ['desktop', 'mobile']) {
      let data; try { data = read(`lumoscore-${chain}-${dev}.html`); } catch (e) { continue; }
      const { json } = getContents(data);
      const byBase = {};
      for (const k of Object.keys(json)) (byBase[baseName(k)] = byBase[baseName(k)] || []).push(k);
      for (const base of Object.keys(byBase)) {
        for (const k of byBase[base]) {
          if (themeOf(json[k], k) !== 'light') continue;
          const v = rootVars(json[k]);
          if (!isLight(v['--bg'])) continue;                // only genuinely light palettes vote
          for (const name of Object.keys(v)) {
            (votes[name] = votes[name] || {});
            votes[name][v[name]] = (votes[name][v[name]] || 0) + 1;
          }
        }
      }
    }
  }
  const out = {};
  for (const name of Object.keys(votes)) {
    out[name] = Object.keys(votes[name]).sort((a, b) => votes[name][b] - votes[name][a])[0];
  }
  return out;
})();

let files = 0, groups = 0, lone = [], borrowed = [];
for (const chain of CHAINS) {
  for (const dev of ['desktop', 'mobile']) {
    const file = `lumoscore-${chain}-${dev}.html`;
    let data; try { data = read(file); } catch (e) { continue; }
    const { json, s, e } = getContents(data);

    // group every variant of a page together
    const byBase = {};
    for (const k of Object.keys(json)) (byBase[baseName(k)] = byBase[baseName(k)] || []).push(k);

    let changed = false;
    for (const base of Object.keys(byBase)) {
      const keys = byBase[base];
      let light = null, dark = null;
      for (const k of keys) {
        const t = themeOf(json[k], k);
        if (t === 'light' && !light) light = rootVars(json[k]);
        if (t === 'dark'  && !dark)  dark  = rootVars(json[k]);
      }
      // Only one palette exists for this page — there is nothing to merge, and inventing the other
      // theme's colours would be guesswork. Reported at the end rather than silently skipped.
      if (!light || !dark || !Object.keys(light).length || !Object.keys(dark).length) {
        if (dev === 'desktop') lone.push(base.replace('lumoscore-', ''));
        continue;
      }
      // Some pages ship a "-dark" file whose palette is IDENTICAL to the base file — they were only
      // ever designed dark (Trade, Trade-asset, Bridge, Sign-in). The filename lies, so verify by
      // luminance: a real light palette has a bright --bg.
      //
      // Hiding their theme toggle was the first attempt and it was the wrong call — it makes the
      // control vanish as you navigate. Instead they BORROW the app's canonical light palette. Same
      // variable names, real values from the design's own light builds, so the toggle works
      // everywhere and the header can no longer disagree with the body.
      if (!isLight(light['--bg']) || isLight(dark['--bg'])) {
        if (!dark || !Object.keys(dark).length) dark = light;   // both were dark; either is the dark one
        light = Object.assign({}, CANON_LIGHT);
        if (dev === 'desktop') borrowed.push(base.replace('lumoscore-', ''));
      }
      groups++;

      const css = '<style id="lx-theme">'
        + block('html[data-theme="light"]', light)
        + block('html[data-theme="dark"]', dark)
        + '</' + 'style>';

      for (const k of keys) {
        // strip anything an earlier run injected — including the abandoned dark-only pin, which
        // otherwise survives and keeps forcing dark on pages that can now do both
        let h = json[k].replace(/<style id="lx-theme">[\s\S]*?<\/style>/g, '')
                       .replace(/<script id="lx-darkonly">[\s\S]*?<\/script>/g, '')
                       .replace(/<style id="lx-darkonly-css">[\s\S]*?<\/style>/g, '');
        // after </head> content so it wins over the design's own :root, before any body paint
        const hi = h.indexOf('</head>');
        json[k] = hi >= 0 ? h.slice(0, hi) + css + h.slice(hi) : css + h;
        changed = true; files++;
      }
    }

    if (changed) {
      const ser = JSON.stringify(json).split('</').join('<' + B + '/');
      fs.writeFileSync(file, data.slice(0, s) + ser + data.slice(e), 'utf8');
    }
  }
}
console.log('theme: both palettes injected into ' + files + ' page keys (' + groups + ' page groups)');
if (lone.length) console.log('theme: only ONE palette exists for -> ' + [...new Set(lone)].join(', '));
