// Link each rewards programme to the blog post that explains it.
//
// The three programme headings on the Rewards page were plain <h3>s. Each now wraps its text in a
// link to its own post, so the page can stay short and the detail lives where it was written.
//
// PATHS, NOT ABSOLUTE URLS. The posts were given as https://lumoscore.com/... but these are internal
// links: writing the absolute form would send anyone on staging straight to production, which is
// exactly the trap that makes a staging check meaningless. Same-tab too -- an internal link that
// opens a new tab is a nuisance, not a courtesy.
//
// Matched on the exact heading element, and every one is asserted present before anything is written:
// a renamed programme should stop this transform rather than silently link two out of three.
//
// Re-injects: unwraps its own anchors first, so the URLs can be edited and the transform re-run.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// [ exact heading text, path ]
const LINKS = [
  ['Native LP Rewards', '/blog/earn-lumos-every-15-days-how-lumoscore-lp-rewards-work'],
  ['Whale Holder Rewards', '/blog/lumos-whale-holder-rewards-programme'],
  ['Ecosystem LP Rewards', '/blog/lumoscore-ecosystem-liquidity-rewards'],
];

const FILES = ['lumoscore-aptos-desktop.html', 'lumoscore-aptos-mobile.html'];
const problems = [];
const staged = [];

for (const file of FILES) {
  let data; try { data = read(file); } catch (e) { problems.push(file + ': unreadable'); continue; }
  const { json, s, e } = getContents(data);
  let pages = 0, links = 0;

  for (const key of Object.keys(json)) {
    if (key.indexOf('lumoscore-rewards') !== 0) continue;
    let html = json[key];

    // Undo a previous run before doing anything, so this is a rewrite rather than a nesting.
    html = html.replace(/<a class="lx-rwlink" href="[^"]*">([\s\S]*?)<\/a>/g, '$1');

    // Every heading has to be there, exactly once, before a single one is rewritten. Linking two of
    // three because the third was renamed is worse than not running.
    let ok = true;
    for (const [text] of LINKS) {
      const n = html.split('<h3>' + text + '</h3>').length - 1;
      if (n !== 1) { problems.push(key + ': "' + text + '" appears ' + n + ' times as an h3, expected 1'); ok = false; }
    }
    if (!ok) break;

    for (const [text, href] of LINKS) {
      html = html.split('<h3>' + text + '</h3>')
        .join('<h3><a class="lx-rwlink" href="' + href + '">' + text + '</a></h3>');
      links++;
    }
    json[key] = html;
    pages++;
  }

  if (problems.length) break;
  staged.push({ file, data, s, e, json, pages, links });
}

if (problems.length) {
  console.error('rewards links: ABORT — nothing written.');
  problems.forEach(x => console.error('  ' + x));
  process.exit(1);
}
if (!staged.some(st => st.pages)) {
  console.error('rewards links: ABORT — no rewards page found.');
  process.exit(1);
}

// The anchors inherit the heading's own colour so the cards keep their look; the underline appears on
// hover and focus, which is what says "this is a link" without turning three headings blue.
const CSS = '<style id="lx-rwlinks">'
  + '.lx-rwlink{color:inherit;text-decoration:none;border-radius:6px}'
  + '.lx-rwlink:hover{text-decoration:underline;text-underline-offset:3px}'
  + '.lx-rwlink:focus-visible{outline:2px solid var(--accent);outline-offset:3px;'
  + 'text-decoration:underline;text-underline-offset:3px}'
  + '</st' + 'yle>';

for (const st of staged) {
  for (const key of Object.keys(st.json)) {
    if (key.indexOf('lumoscore-rewards') !== 0) continue;
    let html = st.json[key].replace(/<style id="lx-rwlinks">[\s\S]*?<\/style>/g, '');
    const bo = html.lastIndexOf('</body>');
    st.json[key] = bo >= 0 ? html.slice(0, bo) + CSS + html.slice(bo) : html + CSS;
  }
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.file + ': ' + st.links + ' programme link(s) across ' + st.pages + ' rewards page(s)');
}
console.log('rewards links: done');
