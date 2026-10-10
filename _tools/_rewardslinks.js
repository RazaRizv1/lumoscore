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

// [ retired slug, where it should point now ] — the "Read the announcement" anchors, which the design
// shipped pointing at three posts that were never published. Same destinations as LINKS above, so a
// programme's heading and its announcement cannot disagree. See the note at the replace site.
const ANN = [
  ['introducing-native-lp-rewards-for-lumos', '/blog/earn-lumos-every-15-days-how-lumoscore-lp-rewards-work'],
  ['introducing-whale-holder-rewards-for-lumos', '/blog/lumos-whale-holder-rewards-programme'],
  ['introducing-ecosystem-lp-rewards-for-lumos', '/blog/lumoscore-ecosystem-liquidity-rewards'],
];

const FILES = ['lumoscore-aptos-desktop.html', 'lumoscore-aptos-mobile.html'];
const problems = [];
const staged = [];

for (const file of FILES) {
  let data; try { data = read(file); } catch (e) { problems.push(file + ': unreadable'); continue; }
  const { json, s, e } = getContents(data);
  let pages = 0, links = 0, ann = 0;

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

    // THE "Read the announcement" ANCHORS GET THE SAME TREATMENT AS THE HEADINGS ABOVE, which they
    // never did. Found in a mobile audit 2026-10-09; three faults in one href, on both chains'
    // rewards pages:
    //
    //   https://lumoscore.com/blogs/introducing-native-lp-rewards-for-lumos  target="_blank"
    //   ^ absolute: on staging this leaves for PRODUCTION, which is the exact trap the note at the
    //     top of this file describes
    //                            ^ "/blogs/", which 301s to "/blog/" -- a redirect hop, on mobile
    //                                                       ^ a new tab for an internal link, and
    //                                                         without rel=noopener
    //
    // THE DESTINATION IS NOW CHANGED TOO, and this is the call the note above was waiting for. RAZA
    // 2026-10-10, asked about renaming posts: "jsut make sure that no 404s anywhere."
    //
    // The three introducing-* posts do not exist. A crawl of every internal link on the site found
    // exactly these three dead, on /rewards, /rewards/stellar and /rewards/xrpl -- nine links in all,
    // and the only broken ones anywhere. They answer 410 now that the blog soft-404 is fixed, which
    // is honest but still a dead "Read the announcement" on a page we promote.
    //
    // Each maps onto a post that DOES exist and covers that exact programme, confirmed by reading the
    // card each link sits in rather than by matching names:
    //
    //   Native LP Rewards    "Provide liquidity to a LUMOS / NATIVE pool"      -> earn-lumos-every-15-days…
    //   Ecosystem LP Rewards "Every 6 months, 10 pools are selected"           -> lumoscore-ecosystem-liquidity-rewards
    //   Whale Holder Rewards "Simply hold 5,000,000+ LUMOS on any chain"       -> lumos-whale-holder-rewards-programme
    //
    // So each announcement now points at the same post as its heading, which is what the page was
    // always trying to say. Keyed on the OLD SLUG rather than on position in the DOM: the slug names
    // its programme unambiguously, and a card reordered by the design cannot mis-assign a link.
    const annBefore = (html.match(/<a class="blog"/g) || []).length;
    html = html.replace(
      /<a class="blog" href="https:\/\/lumoscore\.com\/blogs\/([A-Za-z0-9-]+)"[^>]*>/g,
      '<a class="blog" href="/blog/$1">');
    // Runs after the form fix, so it catches both the original absolute spelling and the relative one
    // an earlier run already produced.
    for (const [dead, live] of ANN) {
      html = html.split('<a class="blog" href="/blog/' + dead + '">')
                 .join('<a class="blog" href="' + live + '">');
    }
    const annAfter = (html.match(/<a class="blog" href="\/blog\//g) || []).length;
    // Nothing may still point at a retired slug. This is the assertion the whole change exists for.
    for (const [dead] of ANN) {
      if (html.indexOf('/blog/' + dead) >= 0) problems.push(key + ': still links the dead slug ' + dead);
    }
    // Tolerates a re-run: already-relative anchors simply do not match the pattern above.
    if (annBefore && annAfter !== annBefore) {
      problems.push(key + ': ' + annBefore + ' announcement link(s) but only ' + annAfter
        + ' are relative afterwards — the href shape changed');
    }
    ann += annAfter;

    json[key] = html;
    pages++;
  }

  if (problems.length) break;
  staged.push({ file, data, s, e, json, pages, links, ann });
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
  console.log('  ' + st.file + ': ' + st.links + ' programme link(s), ' + st.ann + ' announcement link(s) made relative, across ' + st.pages + ' rewards page(s)');
}
console.log('rewards links: done');
