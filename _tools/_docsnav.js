// Docs pages: drop the app sidebar, because the docs have their own.
//
// Every docs page shipped inside the app shell, so the left of the screen carried TWO menus -- the
// app rail (Dashboard, Trade, Pools, Bridge, ...) and immediately beside it the docs contents. The app
// rail goes; the docs' own column slides into the space, which it does on its own because the rail is
// a flex item and removing it simply gives the row its width back.
//
// THE BRAND COMES WITH IT. The LUMOSCORE logo lives in the sidebar's own header, not the topbar --
// the topbar has one too but it is hidden app-wide by ".topbar .logo,.appbar .logo{display:none
// !important}" precisely because the sidebar is showing it. Hiding the sidebar alone would leave the
// docs with no logo and no way back to the site, so the topbar's is restored here. That override
// needs !important of its own: nothing outranks an !important declaration except another one.
//
// And it is restored AS A LINK. The topbar logo is a plain <div>, which was fine while it was hidden;
// as the only home affordance on the page it has to be reachable by keyboard and announce itself as a
// link, so it is wrapped in an <a href="/"> rather than given a click handler.
//
// Mobile docs pages have no app sidebar at all, so they are not touched -- asserted rather than
// assumed, by looking for the element before doing anything.
//
// Re-injects: strips its own output first.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const CSS = '<style id="lx-docsnav">'
  + '.nx-side{display:none}'
  // Beats ".topbar .logo{display:none!important}" on source order at equal weight; both are
  // !important, and the later one wins.
  + '.topbar .logo{display:flex!important}'
  + '.lx-docshome{display:inline-flex;align-items:center;text-decoration:none;color:inherit;'
  + 'border-radius:10px}'
  + '.lx-docshome:focus-visible{outline:2px solid var(--accent);outline-offset:3px}'
  + '</st' + 'yle>';

// Walk tag depth: the logo holds two child divs, so the first </div> is not its own.
function elRange(html, startIdx, tag) {
  const re = new RegExp('<\\/?' + tag + '\\b', 'g');
  re.lastIndex = startIdx;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    if (m[0].charAt(1) === '/') { depth--; if (depth === 0) return html.indexOf('>', m.index) + 1; }
    else depth++;
  }
  return -1;
}

const FILES = ['lumoscore-aptos-desktop.html', 'lumoscore-aptos-mobile.html'];
const problems = [];
const staged = [];

for (const file of FILES) {
  let data; try { data = read(file); } catch (e) { problems.push(file + ': unreadable'); continue; }
  const { json, s, e } = getContents(data);
  let touched = 0, wrapped = 0, skipped = 0;

  for (const key of Object.keys(json)) {
    if (key.indexOf('lumoscore-docs-') !== 0) continue;
    let html = json[key];

    html = html
      .replace(/<style id="lx-docsnav">[\s\S]*?<\/style>/g, '')
      .replace(/<a href="\/" class="lx-docshome" aria-label="LumosCore home">([\s\S]*?)<\/a>/g, '$1');

    // Mobile docs pages carry no app rail. Checked, not assumed.
    if (html.indexOf('<aside class="nx-side">') < 0) { json[key] = html; skipped++; continue; }

    const tb = html.indexOf('<header class="topbar">');
    if (tb < 0) { problems.push(key + ': topbar not found'); break; }
    const lg = html.indexOf('<div class="logo">', tb);
    if (lg < 0) { problems.push(key + ': topbar logo not found'); break; }
    const lgEnd = elRange(html, lg, 'div');
    if (lgEnd < 0) { problems.push(key + ': topbar logo is not closed'); break; }
    // Anchored inside the topbar, not the sidebar: the sidebar has a .logo too, and wrapping that one
    // would put a link inside the element being hidden.
    if (lg > html.indexOf('</header>', tb)) { problems.push(key + ': topbar logo is outside the topbar'); break; }

    html = html.slice(0, lg)
      + '<a href="/" class="lx-docshome" aria-label="LumosCore home">'
      + html.slice(lg, lgEnd) + '</a>'
      + html.slice(lgEnd);
    wrapped++;

    const bo = html.lastIndexOf('</body>');
    html = bo >= 0 ? html.slice(0, bo) + CSS + html.slice(bo) : html + CSS;

    json[key] = html;
    touched++;
  }

  if (problems.length) break;
  staged.push({ file, data, s, e, json, touched, wrapped, skipped });
}

if (problems.length) {
  console.error('docs nav: ABORT — nothing written.');
  problems.forEach(x => console.error('  ' + x));
  process.exit(1);
}
if (!staged.some(st => st.touched)) {
  console.error('docs nav: ABORT — no docs page carried an app sidebar; nothing to do.');
  process.exit(1);
}
for (const st of staged) {
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.file + ': sidebar hidden on ' + st.touched + ' docs page(s), '
    + st.wrapped + ' logo(s) linked, ' + st.skipped + ' without a sidebar left alone');
}
console.log('docs nav: done');
