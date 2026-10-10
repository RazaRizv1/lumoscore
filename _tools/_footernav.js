// Put the product hubs in the site-wide footer menu.
//
// RAZA 2026-10-11, looking at the sitelinks under the brand result on Google: "the sections dont make
// much sense ... I need you to show these: Trade, Pools, Cross chain, Launchpad, Lumos Token, Blogs."
//
// SITELINKS CANNOT BE SET. There is no markup, file or Search Console setting that names them — Google
// picks them, and the demotion tool was retired in 2016. What they are picked FROM is the site's own
// structure: pages that are indexable, important, and linked prominently and consistently with a
// stable label. So the honest lever is to make the six he wants exactly that, and to stop competing
// pages looking more important than they are.
//
// Measured before changing anything. The six ARE linked from the home page already, as real anchors in
// the product cards (an earlier count that said otherwise was my regex capping anchor text at 90
// characters and missing them). But the SITE-WIDE footer menu carried only three links:
//
//   Menu: Home(href="#")  Blogs  About
//
// so /about had a link from all 74 pages while /trade, /pools, /bridge and /launchpad had one each,
// from the home page. That ordering is roughly what Google returned: About appeared, Launchpad and
// Cross-chain did not.
//
// LABELS ARE THE ONES RAZA ASKED FOR, because a sitelink's text comes from the page's own title and
// the anchor text pointing at it. "Cross-Chain" rather than "Bridge" and "Blogs" rather than "Blog"
// are his words; the footer already used "Blogs" and "LUMOS Token", so this follows that voice.
//
// LUMOS Token is NOT moved. It already sits in the Resources column, already resolves to /lumos, and
// already appears as a sitelink — relocating it would be a visual change nobody asked for.
//
// href="#" ON "Home" IS FIXED IN PASSING. An anchor to "#" is not a link to anywhere; it was the only
// thing in this column that could not pass authority, in the column whose whole job is to pass it.
//
// Idempotent: the column is rebuilt only when it still looks like the original three-link version.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const FILES = ['lumoscore-aptos-desktop.html', 'lumoscore-aptos-mobile.html'];

// TWO FOOTERS, NOT ONE, and the mobile one is the worse of the two. The desktop container ships
//
//   Menu: <a href="#">Home</a> <a href="/blog">Blogs</a> <a href="/about">About</a>
//
// while the mobile container ships legacy filenames that cleanLinks() rewrites at build time:
//
//   Menu: lumoscore-home-mobile.html (Home)  lumoscore-amm-mobile.html (AMM Pools)
//         lumoscore-lumos-token-mobile.html (LUMOS Token)
//
// That first one resolves to /dashboard — so every mobile page carried a footer link to the gated,
// noindexed dashboard labelled "Home". Found because the assertion at the bottom of this file failed
// on the mobile container after the desktop pattern matched nothing there.
//
// Each variant keeps its own list: LUMOS Token lives in the desktop Resources column already, so
// adding it to the desktop Menu would be a second link to the same page in the same footer, while on
// mobile it IS the Menu and has to stay.
const VARIANTS = [
  {
    name: 'desktop',
    re: /(<div class="ft-col">\s*<h4>Menu<\/h4>\s*)<a href="#">Home<\/a>\s*<a href="\/blog">Blogs<\/a>\s*<a href="\/about">About<\/a>/g,
    links: [
      ['/', 'Home'], ['/trade', 'Trade'], ['/pools', 'Pools'], ['/bridge', 'Cross-Chain'],
      ['/launchpad', 'Launchpad'], ['/blog', 'Blogs'], ['/about', 'About'],
    ],
  },
  {
    name: 'mobile',
    re: /(<div class="ft-col">\s*<h4>Menu<\/h4>\s*)<a href="lumoscore-home-mobile\.html">Home<\/a>\s*<a href="lumoscore-amm-mobile\.html">AMM Pools<\/a>\s*<a href="lumoscore-lumos-token-mobile\.html">LUMOS Token<\/a>/g,
    links: [
      ['/', 'Home'], ['/trade', 'Trade'], ['/pools', 'Pools'], ['/bridge', 'Cross-Chain'],
      ['/launchpad', 'Launchpad'], ['/lumos', 'LUMOS Token'], ['/blog', 'Blogs'], ['/about', 'About'],
    ],
  },
];
// The six hubs RAZA named. Every page carrying a footer must reach all six, whichever variant it has.
//
// EACH ENTRY LISTS ITS ACCEPTED SPELLINGS, because this runs on the CONTAINER and some of these links
// are still legacy design filenames at this point — cleanLinks() in extract_site.js rewrites them to
// clean urls at BUILD time, long after this transform. The desktop Resources column carries
// lumoscore-lumos-token-dark.html, which becomes /lumos in the built page; asserting only on "/lumos"
// failed on pages that were already correct. Checking the built output instead would be the other
// option, but this file has no build to read.
const MUST = [
  ['/trade'], ['/pools'], ['/bridge'], ['/launchpad'],
  ['/lumos', 'lumoscore-lumos-token'],
  ['/blog'],
];

let files = 0, pages = 0;
for (const file of FILES) {
  let data;
  try { data = read(file); } catch (e) { console.error('  ' + file + ': missing — skipped'); continue; }
  const { json, s, e } = getContents(data);
  files++;

  for (const key of Object.keys(json)) {
    let h = json[key];
    if (typeof h !== 'string') continue;
    let hit = false;
    for (const v of VARIANTS) {
      v.re.lastIndex = 0;
      if (!v.re.test(h)) { v.re.lastIndex = 0; continue; }
      v.re.lastIndex = 0;
      const block = v.links.map(([href, t]) => '<a href="' + href + '">' + t + '</a>').join('\n          ');
      h = h.replace(v.re, '$1' + block);
      hit = true;
    }
    if (hit) { json[key] = h; pages++; }
  }

  const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
  fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
}

console.log('footer nav: product hubs added to the Menu column on ' + pages + ' page key(s) across '
  + files + ' container(s)');

// Every page that has the footer must now link all six, or the signal is inconsistent — which is the
// one thing worse than not sending it, because a sitelink is picked on consistency.
let bad = 0;
for (const file of FILES) {
  let data; try { data = read(file); } catch (e) { continue; }
  const { json } = getContents(data);
  for (const key of Object.keys(json)) {
    const h = json[key];
    if (typeof h !== 'string' || h.indexOf('<h4>Menu</h4>') < 0) continue;
    // Admin is a separate build on its own origin, noindexed, with no public product nav. It carries
    // the same footer markup and must not be held to a public-site signal.
    if (/^lumoscore-admin-/.test(key)) continue;
    // Checks the PAGE, not the Menu column: LUMOS Token legitimately sits in the Resources column on
    // desktop, and what the signal needs is that all six are reachable from every page, not which
    // column they sit in.
    for (const spellings of MUST) {
      if (!spellings.some((sp) => h.indexOf('href="' + sp) >= 0)) {
        bad++; console.error('  ! ' + key + ': no footer link to ' + spellings[0]);
        break;
      }
    }
  }
}
if (bad) process.exit(1);
