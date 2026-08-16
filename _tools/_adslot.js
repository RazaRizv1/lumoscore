// Trade-asset promoted slot (step 2 of the ad system: delivery only).
//
// Puts one promoted card in the right rail of every Trade-asset page, in the space the price-change grid
// vacated when it moved under the chart. Step 2 is DELIVERY ONLY -- there is no impression counting, no
// self-serve submission, no escrow and no moderation queue here; those are steps 3-5 and each needs a
// server side this transform deliberately does not assume.
//
// THE SLOT IS NEVER EMPTY. With no campaign booked it falls back to a house creative, so there is no state
// of the page in which the rail shows a hole or a "your ad here" placeholder. `campaigns` below is the
// booked list (empty today, later fed from the admin panel); `HOUSE` is the guaranteed floor.
//
// WHY THE DEFAULT CREATIVE IS BAKED INTO THE MARKUP rather than written by script: everything on this page
// that our layer fills is gated behind a :not(.lxda) visibility rule precisely because the design paints
// its own values before our script runs (DEV guide 5a). A slot rendered from JS would have the same
// problem in reverse -- an empty 228px box at first paint, then a card, which is a layout jump in the
// rail. Emitting the resolved default as real markup means the common case involves no JavaScript at all
// and cannot flash. The inline script only intervenes in the one case the build cannot know: when the
// page's own asset IS the asset the house ad promotes.
//
// LANDMINES OBSERVED HERE
//   * The multichain re-skin observer rewrites "XLM"/"Stellar" in text. The card names a specific pair, so
//     the whole block carries data-lx-noswap.
//   * The logo painter over-paints short/empty elements and strips their content. The 46px logo is an
//     empty div with a background image -- exactly its prey -- so the background is !important and the
//     element carries data-lxc, the logo-guard's opt-out.
//   * The design runs a document-capture click handler that opens asset pages WITHOUT the ?asset= query,
//     landing everyone on default LUMOS. A plain <a href> would be swallowed by it. Same remedy as
//     _dexdata.js: a WINDOW-capture listener (the earlier phase) that stopImmediatePropagation()s and
//     sets location.href itself.
//   * Backslash escapes are eaten on the way into the browser (DEV landmine 8), so the emitted code uses
//     indexOf/split and carries no regex at all.
const fs = require('fs');
const { read, getContents, VTICK_SVG } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// The mobile build is a separate container with a separate page key and no rail at all, so it needs its
// own insertion point (below) -- but the same creatives, the same resolver and the same CSS.
const CONTAINERS = [
  { file: 'lumoscore-aptos-desktop.html', keys: ['lumoscore-dex-asset.html', 'lumoscore-dex-asset-dark.html'] },
  { file: 'lumoscore-aptos-mobile.html',  keys: ['lumoscore-dex-asset-mobile.html'] },
];
const LUMOS_ISS = 'GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S';

// ---- creatives -----------------------------------------------------------------------------------------
// A creative is deliberately NOT free-form. Everything above the description -- logo, title, issuer name,
// domain, verified tick, click target -- is derived from the asset or the product, so the only text an
// advertiser will ever type is `copy`. That is the whole moderation surface, by design: one field.
const HOUSE = [
  {
    id: 'lumos',
    code: 'LUMOS',
    title: 'LUMOS / XLM',
    sub: 'Lumos Core',
    domain: 'lumoscore.com',
    verified: true,
    logo: '/assets/tokens/lumos.png',
    // 0.2 -> 0.1, NOT 0.5 -> 0.25. The authority is _feerate.js:
    //     window.__lxFeeRate = (bal >= 250000) ? 0.001 : 0.002
    // and the trade card's own fee row is on the same screen as this card, so a wrong number here
    // contradicts the product in the reader's eye line. If that tier ever changes, this string is one
    // of the places that has to move with it.
    copy: 'The asset the platform runs on. Hold 250,000 and your trading fee drops from 0.2% to 0.1% ' +
          '&mdash; and eligible pools pay their rewards in it.',
    cta: 'View LUMOS',
    // The clean-URL form, not lumoscore-dex-asset.html?asset=. The site redirects the query form to
    // this one anyway, so writing it directly saves every click a second navigation.
    href: '/trade/stellar/LUMOS-' + LUMOS_ISS,
  },
  {
    // The fallback's fallback, and not a rare one: LUMOS is what ?asset= defaults to, so the LUMOS page is
    // probably the most-viewed Trade-asset page there is. Advertising LUMOS to someone already reading the
    // LUMOS page would waste the single most valuable impression on the site, so that case gets a creative
    // pointing at a different LumosCore product instead.
    id: 'launchpad',
    code: null,                                   // a product, not an asset: no pair, no tick
    title: 'Launchpad',
    sub: 'LumosCore',
    domain: 'lumoscore.com',
    verified: false,
    logo: '/assets/tokens/lumos.png',
    copy: 'Issue a token on Stellar mainnet in three steps. Set the supply, upload an icon, and the asset ' +
          'is live and tradeable in under a minute.',
    cta: 'Open Launchpad',
    href: 'lumoscore-launch-token.html',
  },
];

// Booked, admin-approved campaigns. Empty until the admin panel can write here (step 2b). The resolver
// below already prefers this list, so the day it has an entry the house ad steps aside on its own.
const CAMPAIGNS = [];

function card(c) {
  const tick = c.verified
    ? '<span class="lx-vtick" title="Verified issuer">' + VTICK_SVG + '</span>'
    : '';
  return '<div class="lxad" data-href="' + c.href + '" data-adid="' + c.id + '"' +
      (c.code ? ' data-adcode="' + c.code + '"' : '') + '>' +
    '<div class="lxad-top"><span class="lxad-lab">Promoted</span><span class="lxad-tag" data-l="Ad" data-lxc></span></div>' +
    '<div class="lxad-body">' +
      '<span class="lxad-logo" data-lxc style="background-image:url(' + c.logo + ')"></span>' +
      '<span class="lxad-id">' +
        '<span class="lxad-pair">' + c.title + tick + '</span>' +
        '<span class="lxad-sub">' + c.sub + ' &middot; <span class="lxad-dom">' + c.domain + '</span></span>' +
      '</span>' +
    '</div>' +
    '<p class="lxad-copy">' + c.copy + '</p>' +
    '<div class="lxad-foot"><span class="lxad-cta">' + c.cta + ' &rarr;</span>' +
      // No href yet: the self-serve booking page is step 4 and does not exist, so an anchor here would
      // 404. Rendered as a span so it cannot navigate, and excluded from the card's click handler below
      // so it cannot silently open the advertiser's own asset page instead.
      '<span class="lxad-why">Promote your token</span></div>' +
  '</div>';
}

// The build resolves the slot for the ordinary case (a page whose asset is not the house asset). The
// browser only re-resolves when that assumption fails.
const DEFAULT_C = CAMPAIGNS[0] || HOUSE[0];
const ALT_C     = HOUSE[1];

// The alternate creative rides along as an inert <template> rather than a JS string. Passing markup
// through JSON.stringify would escape its attribute quotes, and the emitted script lives inside a Node
// template literal that eats exactly one level of backslash -- so `\"` would arrive as a bare `"`, closing
// the attribute and killing the whole script. That failure has shipped here before. A <template> is not
// rendered, not escaped and not parsed as anything but markup, so the class of bug cannot occur.
const WRAP = '<div class="lxad-wrap" id="lxAdWrap" data-lx-noswap>' + card(DEFAULT_C) +
  '<template id="lxAdAlt">' + card(ALT_C) + '</template>' + '</div>';

const STYLE = `<style id="lx-ad-css">
/* No margin here on purpose: .dxa-trade-col is already flex-direction:column with gap:10px. That gap has
   never applied because the column has only ever had one child; adding a margin on top of it would make
   the ad sit at 28px while every other pair of stacked cards on the page sits at the design's 10px. */
.lxad{background:var(--surface);border:.8px solid var(--border);border-radius:14px;padding:14px;
  display:flex;flex-direction:column;cursor:pointer;transition:border-color .15s,background .15s}
/* Tokens, not literals: the app has a light theme, and a hard-coded #16161b hover would turn a white
   card charcoal under the cursor. --border-strong/--surface-2 are the design's own hover pair. */
.lxad:hover{border-color:var(--border-strong);background:var(--surface-2)}
.lxad:hover .lxad-cta{text-decoration:underline}
.lxad-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.lxad-lab{font-size:11.5px;letter-spacing:.92px;text-transform:uppercase;font-weight:700;color:var(--text-soft,#6e6d78)}
/* The site's logo painter claimed this chip: it hunts small elements whose text looks like a ticker,
   and Ad is two characters. It had replaced the background with an inline data-URI of the LUMOS flame
   and forced display:block, so the chip rendered as an 8px-tall smear with no fill. Two defences, both
   from DEV landmine 1: !important on everything it writes inline, and the label moved into ::after so
   there is no text node for it to key on and nothing for it to strip. */
.lxad-tag{font-size:0;letter-spacing:.6px;text-transform:uppercase;font-weight:800;
  color:var(--text-soft,#6e6d78);border:.8px solid var(--border);
  background:var(--surface-2)!important;background-image:none!important;
  display:inline-block!important;border-radius:6px;padding:3px 8px;line-height:1.35}
.lxad-tag::after{content:attr(data-l);font-size:10.5px}
.lxad-body{display:flex;gap:12px;align-items:flex-start}
/* !important + data-lxc: the logo painter's favourite shape is a small empty element, and it strips
   whatever it finds there before painting its own guess. */
.lxad-logo{width:46px;height:46px;border-radius:13px;flex:none;
  background-color:#0a0a0b!important;background-size:cover!important;background-position:center!important;
  background-repeat:no-repeat!important}
.lxad-id{display:block}
.lxad-pair{display:flex;align-items:center;font-size:19px;font-weight:800;letter-spacing:-.3px;line-height:1.15}
.lxad-sub{display:block;margin-top:4px;font-size:12.5px;color:var(--text-soft,#6e6d78);font-weight:600}
.lxad-dom{color:var(--accent)}
/* Three lines, hard. The rail is 400px wide, so the copy column is ~370px: at 13.5px that is about 171
   characters of ordinary prose but only ~79 of wide capitals. A character limit alone therefore cannot
   promise three lines -- the clamp is the guarantee and the form's limit is only guidance. */
.lxad-copy{margin:12px 0 0;font-size:13.5px;color:var(--text-soft,#6e6d78);line-height:1.5;
  display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;
  /* an unbroken 400-character paste has nowhere to wrap and rendered as one clipped line, slipping under
     the clamp entirely */
  overflow-wrap:anywhere}
.lxad-foot{display:flex;align-items:center;justify-content:space-between;margin-top:12px;
  padding-top:11px;border-top:.8px solid var(--border)}
.lxad-cta{font-size:13.5px;font-weight:800;color:var(--accent)}
.lxad-why{font-size:12.5px;color:var(--text-soft,#6e6d78);border-bottom:1px solid transparent}
.lxad:hover .lxad-why{color:var(--text)}
/* Below 1280 the grid collapses to one column and the rail falls under the chart, where a full-width ad
   would be louder than anything around it. Cap it to the trade card's width and centre it. */
@media (max-width:1280px){.lxad-wrap{max-width:400px;margin-left:auto;margin-right:auto}}
</style>`;

const SCRIPT = `<script id="lx-ad">
(function(){
  var wrap=document.getElementById("lxAdWrap"); if(!wrap) return;

  // Which asset is this page showing? The SAME source of truth the data layer uses, and it has to be:
  // the site serves clean URLs, so /trade/stellar/AQUA-GBNZ... carries an EMPTY location.search. Reading
  // the query alone returned the LUMOS default on every asset page, which made the slot swap to the
  // fallback creative everywhere -- the one bug that would have looked like the feature working.
  // window.__lxRoute is set by _route.js in <head>, long before this script parses.
  function pageCode(){
    try{
      var a=(window.__lxRoute&&window.__lxRoute.asset)||
            (new URLSearchParams(window.location.search)).get("asset")||"LUMOS";
      var dash=a.indexOf("-");
      return (dash>0?a.slice(0,dash):a).toUpperCase();
    }catch(e){ return "LUMOS"; }
  }

  // Runs at parse time, before first paint, so the swap is never visible as a change.
  (function(){
    var ad=wrap.querySelector(".lxad"); var tpl=document.getElementById("lxAdAlt");
    if(!ad||!tpl) return;
    var code=ad.getAttribute("data-adcode");
    if(code && code===pageCode()) wrap.innerHTML=tpl.innerHTML;
  })();

  // The design's own click handler opens asset pages without the ?asset= query, so a plain anchor here
  // would land every click on default LUMOS. Window-capture is the earliest phase available, which is
  // what lets us stop that handler before it sees the event.
  function target(t){
    if(!t||!t.closest) return null;
    if(t.closest(".lxad-why")) return null;       // the booking link, not the creative
    var ad=t.closest(".lxad"); if(!ad) return null;
    return ad.getAttribute("data-href")||null;
  }
  function go(href,e){ e.preventDefault(); if(e.stopImmediatePropagation)e.stopImmediatePropagation();
    try{ window.location.href=href; }catch(_){} }

  if(!window.__lxAdNav){ window.__lxAdNav=1;
    window.addEventListener("click",function(e){ var h=target(e.target); if(h) go(h,e); },true);

    // A TAP IS NOT A CLICK on a handset (DEV landmine 10). The design's own handlers have the same
    // problem, which is why controls that work in the browser pane do nothing on a real phone -- and why
    // a pane check alone never catches it. So the card listens for the touch directly.
    //
    // The guard matters more than the handler: the ad is a big block in a long scrolling page, so without
    // it every flick that happens to start on the card would navigate. A touch only counts as a tap if the
    // finger stayed within 12px and lifted inside 600ms.
    var tx=0, ty=0, tt=0, tid=null;
    window.addEventListener("touchstart",function(e){
      var t=e.touches&&e.touches[0]; if(!t) return;
      tid=target(e.target); tx=t.clientX; ty=t.clientY; tt=Date.now();
    },{passive:true,capture:true});
    window.addEventListener("touchend",function(e){
      if(!tid) return; var h=tid; tid=null;
      var t=e.changedTouches&&e.changedTouches[0]; if(!t) return;
      if(Date.now()-tt>600) return;                                  // a long press, or a paused scroll
      if(Math.abs(t.clientX-tx)>12||Math.abs(t.clientY-ty)>12) return;  // a swipe, not a tap
      go(h,e);
    },{capture:true});
  }
})();
</script>`;

// The emitted browser code travelled here inside a template literal, which eats one level of backslash:
// a `\s` written above arrives as `s` and the regex silently matches nothing -- no error, no crash, the
// feature just quietly does nothing, and `node --check` cannot see it because it validates THIS file,
// where the escape is still intact. This code is written without regex for that reason; the guard makes
// the rule enforceable rather than remembered (DEV landmine 8).
(function assertNoLoneEscapes() {
  const lone = SCRIPT.split(B).filter((_, i, a) => i > 0 && a[i - 1] !== '');
  if (SCRIPT.indexOf(B) >= 0) {
    throw new Error('_adslot: emitted browser code contains a backslash (' + lone.length + ' segment(s)). ' +
      'One level was already eaten by the template literal -- rewrite without the escape.');
  }
})();

// ---- injection -----------------------------------------------------------------------------------------
// Strip our own previous output before re-inserting. A transform that only ever appends leaves its old
// copy running inside the gitignored container forever (DEV landmine 11), and two rival ad blocks racing
// each other is exactly the failure mode that verifies clean locally and breaks in production.
// Walks tag depth to the marker's true close. A plain indexOf('</div>') would stop at the first NESTED
// close -- the card's, not the wrapper's -- and leave the tail of our own block behind on the next run.
function cutBlock(p, open, tag) {
  const i = p.indexOf(open);
  if (i < 0) return p;
  const O = '<' + tag, C = '</' + tag + '>';
  let depth = 0, k = i;
  while (k < p.length) {
    const no = p.indexOf(O, k), nc = p.indexOf(C, k);
    if (nc < 0) return p;                                   // unbalanced: leave it alone rather than guess
    if (no >= 0 && no < nc) { depth++; k = no + O.length; continue; }
    depth--; k = nc + C.length;
    if (depth === 0) return cutBlock(p.slice(0, i) + p.slice(k), open, tag);
  }
  return p;
}

function strip(p) {
  for (const [open, close] of [['<style id="lx-ad-css">', '</style>'], ['<script id="lx-ad">', '<' + '/script>']]) {
    let i;
    while ((i = p.indexOf(open)) >= 0) {
      const j = p.indexOf(close, i);
      if (j < 0) break;
      p = p.slice(0, i) + p.slice(j + close.length);
    }
  }
  return cutBlock(p, '<div class="lxad-wrap"', 'div');
}

// MOBILE has no rail: its sections are plain sibling cards in one column. The ad goes where the desktop
// rail puts it relative to the same content -- after the trade card, before the bottom tab strip -- so the
// reading order is the same on both: chart, price change, trade, ad.
function insertBeforeTabsBar(p) {
  const marker = p.indexOf(String.fromCharCode(60) + "!-- Bottom tabs");
  const bar = p.indexOf('<div class="tabs-bar">');
  if (bar < 0) return null;
  const at = (marker >= 0 && marker < bar) ? marker : bar;   // keep the design's own comment above the ad
  return p.slice(0, at) + WRAP + SCRIPT + p.slice(at);
}

// The slot goes at the end of the rail, under the trade card. The rail is an <aside>, and there is exactly
// one </aside> in the rest of the page, so its close is unambiguous -- but assert that rather than trust it.
function insertIntoRail(p) {
  const i = p.indexOf('<aside class="dxa-trade-col">');
  if (i < 0) return null;
  const j = p.indexOf('</aside>', i);
  if (j < 0) return null;
  if (p.slice(i + 1, j).indexOf('<aside') >= 0) return null;   // nested rail: the close below is the wrong one
  // The script sits immediately after the markup, not at </body>. The parser runs an inline script the
  // moment it reaches it, without yielding first, so the one case that needs a swap (the page's own asset
  // IS the promoted asset) is resolved before the slot can paint. From </body> the browser is free to
  // paint first, and the LUMOS page -- which is what ?asset= defaults to, so the most-viewed one there is
  // -- would show the wrong creative for a frame.
  return p.slice(0, j) + WRAP + SCRIPT + p.slice(j);
}

let n = 0, containers = 0;
for (const { file, keys } of CONTAINERS) {
  const data = read(file);
  const { json, s, e } = getContents(data);
  let changed = false;
  for (const k of keys) {
    if (!json[k]) continue;
    let p = strip(json[k]);
    const withAd = insertIntoRail(p) || insertBeforeTabsBar(p);
    if (!withAd) { console.log('  SKIP ' + k + ': no rail and no tab strip to anchor to'); continue; }
    p = withAd;
    if (p.indexOf('</head>') >= 0) p = p.replace('</head>', STYLE + '</head>');
    else { const hb = p.lastIndexOf('</body>'); p = p.slice(0, hb) + STYLE + p.slice(hb); }
    json[k] = p; changed = true; n++;
  }
  if (changed) {
    containers++;
    fs.writeFileSync(file, data.slice(0, s) + JSON.stringify(json).split('</').join('<' + B + '/') + data.slice(e), 'utf8');
  }
}
console.log('ad slot: injected=' + n + ' keys across ' + containers + ' container(s); ' +
  'campaigns=' + CAMPAIGNS.length + ', house=' + HOUSE.length + ' (slot never empty)');
