// The mobile bottom nav (Home / Trade / Bridge / Pools / Wallet) is design markup — a
// <nav class="nb-bar"> before </body> — and it is present on every mobile page EXCEPT the dashboard,
// where it was simply never authored. The stylesheet is already on that page (.nb-bar css is there),
// so only the markup is missing.
//
// Rather than hand-write a copy that can drift from the real one, this lifts the nav out of a page
// that already has it and re-stamps the active tab per page. Idempotent: a page that already has a
// nav is skipped, so re-running changes nothing.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// which tab is highlighted on which page
const ACTIVE = {
  'lumoscore-home-mobile.html': 'home',
  'lumoscore-dex-mobile.html': 'trade',
  'lumoscore-dex-asset-mobile.html': 'trade',
  'lumoscore-bridge-mobile.html': 'bridge',
  'lumoscore-amm-mobile.html': 'pools',
  'lumoscore-amm-pool-mobile.html': 'pools',
  'lumoscore-wallet-mobile.html': 'wallet',
};

const file = 'lumoscore-aptos-mobile.html';
let data;
try { data = read(file); } catch (e) { console.log('mobile container not found'); process.exit(0); }
const { json, s, e } = getContents(data);

// find a page that already carries the nav, and use it as the template
let tpl = null;
for (const k of Object.keys(json)) {
  const m = json[k].match(/<nav class="nb-bar">[\s\S]*?<\/nav>/);
  if (m) { tpl = m[0]; break; }
}
if (!tpl) { console.log('mobile bottom nav: no source page to copy from — nothing done'); process.exit(0); }

let added = 0, already = 0;
for (const k of Object.keys(json)) {
  let h = json[k];
  if (h.indexOf('class="nb-bar"') >= 0) { already++; continue; }
  if (h.indexOf('.nb-bar{') < 0) continue;        // page is not part of the mobile shell
  const bi = h.lastIndexOf('</body>');
  if (bi < 0) continue;

  // re-stamp the active tab for THIS page: clear the template's, then set our own
  let nav = tpl.split(' active"').join('"');
  const want = ACTIVE[k];
  if (want) nav = nav.replace('class="nb-tab" data-id="' + want + '"', 'class="nb-tab active" data-id="' + want + '"');

  json[k] = h.slice(0, bi) + nav + h.slice(bi);
  added++;
}

// ---- the bar on a TABLET (RAZA 2026-09-19, screenshot at tablet width) ---------------------------------------------
// The design caps the bar at a phone's width (max-width:430px, centred with left:50% + translateX(-50%)). On a tablet
// that left a square 430px box floating mid-screen, and the page scrolling under it showed on both sides ("Estim ...
// claimable") -- it read as a box stuck over the content, not as a navigation bar. The bar itself is NOT resized: its
// active-tab rail is positioned by script in pixels from the bar's own edge, so a wider bar would put the rail off its
// tab. Instead a full-width strip is drawn BEHIND it in the bar's own background and top border. Idempotent: the style
// is stripped and re-inserted on every run.
const WIDE = '<style id="lx-nbwide">@media (min-width:431px){'
  + '.nb-bar::before{content:"";position:absolute;top:-1px;bottom:0;left:50%;width:100vw;transform:translateX(-50%);'
  + 'background:inherit;border-top:inherit;z-index:-1}}</style>';
// A BLUR THAT IS NEVER SEEN AND NEVER STOPS COSTING. The slide-menu's overlay covers the whole viewport and
// carries backdrop-filter:blur(4px) in its BASE rule, while it is hidden with opacity+visibility rather than
// display -- so the element stays laid out and the compositor keeps that full-screen blur alive behind every
// scroll. What it costs is per pixel, and a tablet has several times a phone's pixels, which is the shape of
// what RAZA reported on 2026-09-21: "scrolling on tab is very laggy while on mobile its smooth". The blur
// belongs to the open state; closed, it should cost nothing. Opening looks the same -- the overlay fades in
// and its blur comes with it. (.search-overlay and .modal-overlay already close with display:none, so they
// cost nothing when shut and are left alone.)
// The second permanent cost on the same screen: the design's scroll-reveal keeps will-change:opacity,transform
// in its SETTLED state, so every revealed block stays pinned to its own compositor layer for the life of the
// page -- measured on the dashboard at tablet width: five elements, ~0.9 of a screen, which at a tablet's pixel
// ratio is several million device pixels held and re-rastered while scrolling. will-change is a hint for what is
// ABOUT to animate; once the reveal has finished there is nothing left to hint at. The reveal itself is
// unchanged: opacity and transform are composited anyway, with or without the hint.
// THE MOBILE BUILD IS CAPPED TO A PHONE'S WIDTH, AND MOST PAGES ALREADY LIFT THAT CAP. Every mobile page
// carries body{max-width:430px;margin:0 auto} from the design, and 39 of the 41 also carry the design's own
// lx-mobile-fix, which sets html,body{max-width:100%} and lets the page fill whatever screen it is on. The
// landing and signin pages never got it, so on a tablet they rendered as a 430px column marooned in the
// middle of a 1024px screen -- "it still shows just at the center, like im viewing on mobile resolution"
// (RAZA 2026-09-21, after tablets were switched to this build). Give those two the same rule the other 39
// have, rather than inventing a different one.
const WIDEBODY = '<style id="lx-mobwide">html,body{max-width:100%}</style>';
const OVB = '<style id="lx-scrollcost">'
  + '.menu-overlay{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'
  + '.menu-overlay.open{backdrop-filter:blur(4px)!important;-webkit-backdrop-filter:blur(4px)!important}'
  + '[data-lcmu].lcmu-in{will-change:auto!important}'
  + '</style>';
let wide = 0, ovb = 0, widebody = 0;
for (const k of Object.keys(json)) {
  let h = json[k];
  const before = h;
  h = h.replace(/<style id="lx-nbwide">[\s\S]*?<\/style>/g, '');
  h = h.replace(/<style id="lx-ovblur">[\s\S]*?<\/style>/g, '');     // the id this block used to carry
  h = h.replace(/<style id="lx-scrollcost">[\s\S]*?<\/style>/g, '');
  h = h.replace(/<style id="lx-mobwide">[\s\S]*?<\/style>/g, '');
  if (h.indexOf('class="nb-bar"') >= 0 && h.indexOf('</head>') >= 0) { h = h.replace('</head>', WIDE + '</head>'); wide++; }
  if (h.indexOf('menu-overlay') >= 0 && h.indexOf('</head>') >= 0) { h = h.replace('</head>', OVB + '</head>'); ovb++; }
  // only the pages the design left capped -- the other 39 already lift it themselves
  if (h.indexOf('lx-mobile-fix') < 0 && h.indexOf('max-width: 430px') >= 0 && h.indexOf('</head>') >= 0) { h = h.replace('</head>', WIDEBODY + '</head>'); widebody++; }
  if (h !== before) { json[k] = h; added++; }
}

if (added) {
  const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
  fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
}
console.log("mobile bottom nav: added to " + added + " page key(s), " + already + " already had it; tablet backing on " + wide + "; overlay blur gated on " + ovb + "; width cap lifted on " + widebody);
