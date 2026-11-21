// "What you can do with LUMOS" -- two bands instead of a five-card grid.
//
// Asked for: the fee benefit alone across the top, then three boxes below, one per incentive reward.
// The section shipped five equal cards -- fee, Native LP, Ecosystem LP, Whale Holder, and a
// coming-soon Liquidity Pairing -- so the fee, which is the one benefit that applies to everyone who
// simply HOLDS the token, read as one of five footnotes.
//
// The split is done in CSS on the existing grid (the fee card spans every column, the rest flow three
// across) rather than by moving markup, so there is nothing to re-order and no first-paint reshuffle.
// Liquidity Pairing is hidden: three boxes were asked for, it is not an incentive reward, and it is
// not live. Its markup is untouched -- unhide by deleting one rule.
//
// The copy is also CORRECTED here. Both builds claimed holders "trade fee-free", which is not what
// the product does: _feerate.js is the single source of truth and it publishes 0.002 by default and
// 0.001 at 250,000 LUMOS. Half the fee, not no fee.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const KEYS = ['lumoscore-lumos-token.html', 'lumoscore-lumos-token-dark.html', 'lumoscore-lumos-token-mobile.html'];
// Card class -> where its link goes. Stellar, because this repo's containers are the Stellar build.
const CARD_LINKS = [
  ['fee',    '/docs/fees'],        // Trading fee waivers -- the fee schedule is the documentation for it
  ['native', '/rewards/stellar'],  // Native LP Rewards
  // RAZA 2026-11-13: 'instead of calling it "View partner pools", make it "View Ecosystem LP Pools"
  // and link it to pools main page -> Rewarded pools tab.' That tab IS this card's ten assets, so the
  // link now lands on it rather than on All Pools, where the reader would have to find it themselves.
  // ?tab=rewarded is read by lx-ammdata on the pools page; it also accepts #rewarded.
  //
  // RENAMED AGAIN the same day, and for a reason worth keeping: 'instead call it "View Rewarded
  // pools" because that's what it redirects to. and that also contain Native LP pool at the top so
  // we cant say that its Ecosystem LP pools.' He is right -- the Rewarded tab leads with the native
  // LUMOS pool and then the ten ecosystem ones, so a link promising only the latter mis-states where
  // it lands. The LABEL now names the destination; the CARD still names the programme.
  //
  // THE OLD LABEL IS A LIST, NOT A STRING. The relabel below matches the exact old text, so with a
  // single spelling an edit here is a no-op against containers that already carry the previous
  // rename -- which is exactly what happened: the pages said "View Ecosystem LP Pools" and the
  // anchor still said "View partner pools". Both spellings stay until a base carrying the oldest one
  // is provably gone, the same rule _xrplcopy2.js and _sendph.js already follow.
  ['eco',    '/pools/stellar?tab=rewarded',
             ['View partner pools', 'View Ecosystem LP Pools'], 'View Rewarded Pools'],
  ['whale',  '/rewards/stellar'],  // Whale Holder Rewards -- eligibility and schedule live on rewards
];

// ---- the Ecosystem LP Rewards list ------------------------------------------------------------
//
// RAZA 2026-11-13: "On both Stellar and XRPL LUMOS token page, make the Ecosystem LP rewards like
// its made on near", and then "the asset and stuff will be from Stellar and XRPL obviously". NEAR
// grew this list first (its ticket 270); this is the same card, the same row, each chain's own
// assets.
//
// THE LIST IS THE REWARDED POOLS' PARTNER ASSETS -- not a volume ranking. Corrected 2026-11-13 after
// RAZA: "fix the eco card asset list on both chains".
//
// What was wrong. The first version took the ten assets /trade/stellar publishes by 24h volume. But
// the card says "Pair any partner token with LUMOS in a curated pool and earn boosted rewards", and
// its link goes to /pools/stellar?tab=rewarded. Four of those ten -- VELO, BTCLN, ETH and SCOP --
// have NO LUMOS pool at all, so the card was promising boosted rewards for pairs that do not exist;
// meanwhile USDT0, AQUA, BLND and xLMNR, which do have rewarded LUMOS pools, were missing from it.
// A reader could click through and not find the asset they had just been shown.
//
// WHERE THESE TEN COME FROM, and why there are exactly ten. `var RW` in _ammdata.js is the rewarded
// tab's eleven pools. One of them is the NATIVE pool (XLM), which is the one RAZA pointed out sits
// at the top of that tab and is not an "ecosystem" pool. Eleven minus the native one is ten, which
// is the row count this card was built for. The order here is RW's order, so the card and the page
// it links to read in the same sequence.
//
// EVERY CODE AND ISSUER BELOW WAS READ OFF THE POOL ITSELF -- horizon /liquidity_pools/<id>, taking
// the reserve that is not LUMOS -- not from an asset table and not from memory. All eleven were
// confirmed to carry a LUMOS leg at the same time. The six that survive from the old list came back
// with byte-identical issuers, which is the cross-check that the two sources agree.
//
// Still a FIXED ARRAY, which is NEAR's precedent (its ticket 270): a card headed "Ecosystem LP
// Rewards" is a statement about which pools we reward, and a list that silently reshuffles itself is
// not that. It moves when the rewarded set moves -- so if `var RW` in _ammdata.js changes, change
// this with it. Nothing computes one from the other.
//
// Issuer, never code alone: 403 distinct assets on this ledger use the code USDC. See
// [[lumoscore-token-logos]] -- the row's href, its logo and its tick all key on CODE-ISSUER.
// Logos: all ten answer /lxapi/logoimg directly (measured 2026-11-13, 200 with real bytes for the
// four new ones), so none needs the EURC-style fallback ladder -- which they keep anyway.
const ECO = [
  ['USDC',  'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'],
  ['USDT0', 'GATISXX6BZ6NC7IKQBY37CJD4SOZL3CYZJWXEDG6JVIY4WBS6KXJHN6Q'],
  ['EURC',  'GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2'],
  ['SHX',   'GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEKEBR7UCHEUUEK72N7I7KJ6JH'],
  ['AQUA',  'GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA'],
  ['BLND',  'GDJEHTBE6ZHUXSWFI642DCGLUOECLHPF3KSXHPXTSTJ7E3JF6MQ5EZYY'],
  ['xLMNR', 'GDKA6WVMFSA73BMEVKPO6WXSSWP4MPRBDJVSXLLSEVIEVH226L5RJ7NL'],
  ['yXLM',  'GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55'],
  ['XRP',   'GBXRPL45NPHCVMFFAYZVUVFFVKSIZ362ZXFP7I2ETNQ3QKZMFLPRDTD5'],
  ['PYUSD', 'GDQE7IXJ4HUHV6RQHIUPRJSEZE4DRS5WY577O2FY6YQ5LVWZ7JZTU2V5'],
];

// OPEN, AND RAZA'S CALL: the "Verified asset" tick on line ~109 is painted on EVERY row with no test
// behind it. NINE OF THE TEN ARE GENUINELY CURATED; only BLND is in neither source, and its logo still
// resolves from the issuer's own toml.
//
// CURATION HAS TWO SOURCES ON STELLAR and reading one of them is how this comment was wrong before:
// the `ASSETS` literal in _dexdata.js holds 29 entries, and assets/tokens/curated/ holds 52 artwork
// files. VELO, PYUSD, USDT0, xLMNR, BTCLN, ETH and SCOP are in the second and not the first, so a
// grep of _dexdata.js alone reports them as uncurated -- which is what an earlier version of this
// comment claimed, until RAZA said "are you sure pyusd and velo are not curated because they should
// be". They are. CHECK BOTH SOURCES. [[one-source-refusing-is-not-no-source]]
//
// The tick still has no test behind it, which is the same shape as [[curated-tick-is-never-automatic]]
// -- a badge that is painted rather than earned. Left as it is: that is a product call, not a build one.

const ECO_OPEN = '<div class="lxu-eco-list">';
// A LITERAL TERMINATOR, so the strip on re-run is an indexOf and not a regex that can run forward.
// The previous regex in this file ended at </div></div> and ate everything between the figure and
// the next place two divs happened to close together; see the comment on that strip below.
const ECO_END = '<span class="lxu-eco-end"></span></div>';
const ECO_TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" '
  + 'stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
// THE LOGO HEALER OPT-OUT, and it has to be BOTH of these. There are two healers on this page and
// they test different things (see [[lumoscore-token-logos]]): the first bails on data-logoed, the
// second only on a child img/svg/[data-logo]. A rank cell reading "#1" and a ticker cell reading
// "USDC" are both 1-5 characters, which is exactly what the second one eats -- it would stamp a
// logo over the text and empty the cell for the life of the page. The 0x0 svg is the one that
// always works, because that test runs before the text test and nothing gets past it.
const NOLOGO = ' data-logoed="1"';
const NOLOGO_SVG = '<svg width="0" height="0" aria-hidden="true" focusable="false"></svg>';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const shortIss = (a) => (String(a).length > 24 ? String(a).slice(0, 8) + '…' + String(a).slice(-6) : String(a));

function ecoList() {
  let h = ECO_OPEN;
  ECO.forEach(([code, iss], i) => {
    const id = code + '-' + iss;
    h += '<a class="lxu-eco-row" href="/trade/stellar/' + esc(encodeURIComponent(id)) + '">'
      + '<span class="lxu-eco-rk"' + NOLOGO + '>#' + (i + 1) + NOLOGO_SVG + '</span>'
      // data-lxc is the marker the OTHER logo layer reads as "a data layer owns this icon".
      + '<span class="lxu-eco-ic" data-lxc="' + esc(code) + '"' + NOLOGO + '>'
      // Our own origin, so a dead issuer domain cannot leave a hole: logoimg proxies and caches it.
      // onerror walks the same ladder the search rows do -- /lxapi/assetlogo, then nothing. Measured
      // 2026-11-13: nine of the ten answer logoimg directly; EURC does not, and heals on this path.
      + '<img src="/lxapi/logoimg?asset=' + esc(encodeURIComponent(id)) + '" alt="" loading="lazy" '
      + 'data-lxid="' + esc(id) + '" onerror="lxuEcoLogo(this)">'
      + '</span>'
      + '<span class="lxu-eco-tx">'
      + '<span class="lxu-eco-tk"' + NOLOGO + '><span' + NOLOGO + '>' + esc(code) + NOLOGO_SVG + '</span>'
      + '<span class="lxu-eco-vt" title="Verified asset" aria-label="Verified asset">' + ECO_TICK + '</span></span>'
      + '<span class="lxu-eco-id" title="' + esc(iss) + '">' + esc(shortIss(iss)) + '</span>'
      + '</span></a>';
  });
  return h + ECO_END;
}

// Defined in <head>, so it exists before any row's image can fail.
const ECO_SCRIPT = '<script id="lx-lumosutil-eco">'
  + 'function lxuEcoLogo(im){try{im.onerror=null;var id=im.getAttribute("data-lxid")||"";'
  + 'if(!id){im.style.visibility="hidden";return;}'
  + 'fetch("/lxapi/assetlogo?v=2&asset="+encodeURIComponent(id)).then(function(r){return r.ok?r.json():null})'
  + '.then(function(j){if(j&&j.image){im.onerror=function(){this.onerror=null;this.style.visibility="hidden"};im.src=j.image;}'
  + 'else im.style.visibility="hidden";}).catch(function(){im.style.visibility="hidden";});}catch(_){}}'
  + '</' + 'script>';

// The rate pulled out as a figure, so the benefit is a number rather than a sentence to read.
// Values match _feerate.js (THRESH=250000, 0.002 -> 0.001); if that file changes, change these.
const FIGURE = '<div class="lxu-figure" aria-hidden="true">'
  + '<span class="lxu-rate"><span class="lxu-from">0.2%</span>'
  + '<span class="lxu-arrow">→</span><span class="lxu-to">0.1%</span></span>'
  + '<span class="lxu-off">50% off</span></div>';

// Desktop and mobile ship slightly different sentences; both said "fee-free".
const COPY = [
  ['<p>Hold 250,000 LUMOS or more in a single wallet and trade fee-free across all LumosCore products — DEX and AMM.</p>',
   '<p>Hold <strong>250,000 LUMOS</strong> or more in a single wallet and pay <strong>0.1%</strong> instead of 0.2% on every trade — half the platform fee, across the DEX and the AMM.</p>'],
  ['<p>Hold 250,000 LUMOS or more and trade fee-free across all LumosCore products — DEX and AMM.</p>',
   '<p>Hold <strong>250,000 LUMOS</strong> or more and pay <strong>0.1%</strong> instead of 0.2% on every trade — half the platform fee.</p>'],
];

const STYLE = `<style id="lx-lumosutil-css">
/* ---- band 1: the fee, across the top ---------------------------------------------------------- */
.utility-grid{grid-template-columns:repeat(3,1fr)}
.utility-grid .util-card.fee{grid-column:1/-1}
/* Two columns inside the card WITHOUT wrapping its children in a new element: the copy is assigned to
   column one, the figure to column two spanning every row. */
.util-card.fee{
  display:grid;grid-template-columns:1fr auto;column-gap:34px;align-items:center;
  padding:24px 26px;
  background:linear-gradient(115deg,var(--accent-pale,rgba(234,106,44,.12)) 0%,transparent 56%),var(--surface);
  border-color:rgba(234,106,44,.30)}
.util-card.fee>.u-ico,.util-card.fee>h4,.util-card.fee>p,.util-card.fee>.u-link{grid-column:1;margin-right:0}
.util-card.fee>p{max-width:62ch}
.util-card.fee>.u-link{justify-self:start}
/* Row 2 onwards, not row 1. .u-tag ("Live") is positioned absolutely at top:14px/right:14px, which
   is the same corner the figure was spanning into -- so the badge landed on top of the 0.1%. Starting
   the figure below the icon row clears it without moving the badge every other card shares. */
/* "2 / span 3", NOT "2 / -1". This grid declares no grid-template-rows, so every row is implicit and
   -1 resolves against the EXPLICIT grid -- which has one line. The span collapsed back onto row 1,
   which is the row the Live badge floats over, which is why the badge kept landing on the 0.1%. */
.util-card.fee>.lxu-figure{grid-column:2;grid-row:2/span 3;align-self:end;justify-self:end;
  padding-left:8px;padding-bottom:4px}

/* the rate, as a figure */
.lxu-figure{display:flex;flex-direction:column;align-items:flex-end;gap:9px;flex:0 0 auto}
.lxu-rate{display:inline-flex;align-items:baseline;gap:9px;
  font:800 40px/1 'Hanken Grotesk',system-ui,sans-serif;letter-spacing:-1.4px;color:var(--text)}
.lxu-from{font-size:24px;font-weight:700;color:var(--text-soft);text-decoration:line-through;
  text-decoration-thickness:2px;opacity:.8}
.lxu-arrow{font-size:20px;font-weight:700;color:var(--text-soft)}
.lxu-to{color:var(--accent)}
.lxu-off{font:800 11px/1 'JetBrains Mono',monospace;letter-spacing:.10em;text-transform:uppercase;
  padding:5px 10px;border-radius:999px;background:var(--accent);color:#fff;
  box-shadow:0 8px 18px -10px rgba(234,106,44,.9)}

/* ---- band 2: one box per incentive reward ----------------------------------------------------- */
/* Three boxes were asked for. Liquidity Pairing is not an incentive reward and is not live; its
   markup is untouched, so deleting this one rule brings it back. */
.utility-grid .util-card.pairing{display:none}
/* Equal height, and the link pinned to the bottom edge so three boxes of unequal copy still line up. */
.utility-grid .util-card.native,.utility-grid .util-card.eco,.utility-grid .util-card.whale{
  display:flex;flex-direction:column}
.utility-grid .util-card.native .u-link,.utility-grid .util-card.eco .u-link,
.utility-grid .util-card.whale .u-link{margin-top:auto}

/* ---- the ten curated assets, inside the Ecosystem card ---------------------------------------- */
/* Ten rows in a three-across band would stretch Native and Whale to the same height for no reason,
   so the Ecosystem card takes the two right columns with the other two stacked beside it. 861px is
   the grid's OWN breakpoint, further down this sheet -- below it the grid is one column and the
   cards stack, so this rule must not apply there. */
@media(min-width:861px){
.utility-grid .util-card.native,.utility-grid .util-card.whale{grid-column:1}
.utility-grid .util-card.eco{grid-column:2/-1;grid-row:span 2}
}
/* Down the columns, not across: 1-5 then 6-10, so the ranks read in order. */
.lxu-eco-list{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(5,auto);
  grid-auto-flow:column;column-gap:22px;margin:6px 0 14px}
.lxu-eco-row{display:flex;align-items:center;gap:12px;padding:10px 4px;min-width:0;
  border-top:1px solid var(--border);text-decoration:none;color:inherit}
.lxu-eco-row:nth-child(5n+1){border-top:0}
.lxu-eco-row:hover .lxu-eco-tk{color:var(--accent,#ea6a2c)}
.lxu-eco-rk{flex:0 0 30px;font:700 12.5px/1 'JetBrains Mono',monospace;color:var(--text-soft)}
.lxu-eco-ic{flex:0 0 30px;width:30px;height:30px;border-radius:50%;overflow:hidden;background:var(--bg)}
.lxu-eco-ic img{width:100%;height:100%;object-fit:cover;display:block;border-radius:50%}
.lxu-eco-tx{display:flex;flex-direction:column;gap:3px;min-width:0}
.lxu-eco-tk{display:flex;align-items:center;gap:6px;font-size:15.5px;font-weight:800;color:var(--text)}
/* Styled here rather than borrowing .lx-vtick, so this card does not depend on another layer
   shipping on the page. */
.lxu-eco-vt{display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;
  flex:0 0 15px;border-radius:50%;background:var(--accent,#ea6a2c);color:#fff}
.lxu-eco-vt svg{width:10px;height:10px}
.lxu-eco-id{font:500 12.5px/1.2 'JetBrains Mono',monospace;color:var(--text-soft);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lxu-eco-end{display:none}
/* One column once two would squeeze the issuer out of its own row. */
@media(max-width:980px){
.lxu-eco-list{display:block}
.lxu-eco-row:nth-child(5n+1){border-top:1px solid var(--border)}
.lxu-eco-row:first-child{border-top:0}
}

/* ---- phone: the figure sits under the copy ---------------------------------------------------- */
@media(max-width:860px){
.utility-grid{grid-template-columns:1fr}
.util-card.fee{grid-template-columns:1fr;row-gap:14px;padding:18px 18px}
.util-card.fee>.lxu-figure{grid-column:1;grid-row:auto;justify-self:start;
  flex-direction:row;align-items:center;gap:12px}
.lxu-rate{font-size:30px;letter-spacing:-1px}
.lxu-from{font-size:19px}
.util-card.fee>p{max-width:none}
}
</style>`;

// A CARD ENDS WHERE THE NEXT ONE BEGINS, and every search inside a card is bounded by that.
// "Within 4000 characters of the card's opening tag" is not the same thing: once a card's own link
// is already wired, a search for the next dead one simply walks into the following cards. The
// 4000 cap is kept as a backstop for the last card on the page, which has no successor.
function cardEnd(p, at) {
  const next = p.indexOf('<div class="util-card', at + 1);
  const cap = at + 4000;
  return next > at ? Math.min(next, cap) : cap;
}
// Links an earlier, unbounded run wired that were never this transform's to touch. Keyed on the
// LABEL as well as the href, so the fee card's own "/docs/fees" is not matched.
const MISWIRED = [['Read the proposal', '/docs/fees']];

let containers = 0, pages = 0, copyFixed = 0, wired = 0, listed = 0, repaired = 0, relabelled = 0;
const missing = [];
for (const dev of ['desktop', 'mobile']) {
  const file = `lumoscore-aptos-${dev}.html`;
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;

  for (const k of KEYS) {
    if (!json[k]) continue;
    let p = json[k];
    const before = p;
    // NOTE the style block is NOT stripped here -- see the in-place swap at the bottom of this loop.
    p = p.replace(/<script id="lx-lumosutil-eco">[\s\S]*?<\/script>/g, '')
         // The figure ends "</span></div>" -- it contains ONE </div>, not two. Ending this match at
         // </div></div> meant it never matched the figure at all: it ran forward to the next place in
         // the page where two divs happen to close together and deleted everything in between.
         .replace(/<div class="lxu-figure"[\s\S]*?<\/span><\/div>/, '');   // strip a previous figure
    // Same lesson, which is why this one is bounded by a literal of its own rather than a regex.
    for (;;) {
      const a = p.indexOf(ECO_OPEN);
      if (a < 0) break;
      const z = p.indexOf(ECO_END, a);
      if (z < 0) break;
      p = p.slice(0, a) + p.slice(z + ECO_END.length);
    }

    for (const [from, to] of COPY) if (p.indexOf(from) >= 0) { p = p.split(from).join(to); copyFixed++; }

    // the figure goes at the end of the fee card, just before its link
    //
    // TEST THE MARKUP, NOT THE NAME. This read `p.indexOf('lxu-figure') < 0`, which was true only
    // because the stylesheet -- which contains `.lxu-figure` twice -- used to be stripped higher up
    // this function. Moving that strip to the in-place swap at the bottom left the sheet in place,
    // so the test found the CSS, concluded a figure was already here, and skipped re-inserting the
    // one it had just stripped: the 0.2%->0.1% badge vanished from all three pages. Caught by the
    // deploy gate on 2026-11-13, not by the build, which reported success.
    if (p.indexOf('<div class="lxu-figure"') < 0) {
      const at = p.indexOf('<div class="util-card fee">');
      if (at >= 0) {
        const link = p.indexOf('<a class="u-link"', at);
        if (link > at && link < cardEnd(p, at)) p = p.slice(0, link) + FIGURE + p.slice(link);
      }
    }

    // REPAIR, and it has to run before the wiring below.
    //
    // The loop that follows used to search forward from a card with only a 4000-character bound. On
    // a RE-RUN all four real cards are already wired, so every search skipped its own card and
    // landed on the first href="#" left on the page -- the Governance card's "Read the proposal",
    // which is meant to stay dead until there is a proposal to read. The bound is now the card's own
    // extent, so it cannot happen again; this undoes the damage already sitting in the containers.
    for (const [label, href] of MISWIRED) {
      const bad = '<a class="u-link" href="' + href + '">' + label;
      if (p.indexOf(bad) >= 0) { p = p.split(bad).join('<a class="u-link" href="#">' + label); repaired++; }
    }

    // THE FOUR CARD LINKS WENT NOWHERE. Each card ended in an <a class="u-link" href="#"> -- "Learn
    // how it works", "View reward programs", "View partner pools", "Eligibility & schedule" -- and a
    // mobile audit on 2026-10-09 found these are the ONLY dead links on this page a phone user can
    // actually see and tap. Clicked each on the deployed build first: no navigation, no scroll, no
    // overlay. The other 22 dead links across trade and pools turned out to be hidden markup inside
    // collapsed hero blocks, which is why only these are wired.
    //
    // Destinations confirmed by RAZA 2026-10-09, each chosen for the card it sits in rather than sent
    // somewhere generic, and each staying on the chain the reader is already on. This repo's
    // containers are Stellar's; the XRPL build has its own copy of this page and its own fix.
    //
    // RE-POINTABLE, NOT ONE-SHOT. This used to match href="#" only, which made it idempotent but also
    // made it impossible to CHANGE a destination later: once wired, a re-run saw no dead link and did
    // nothing, so editing CARD_LINKS had no effect on an already-built container. Now it rewrites
    // whatever href the card's own anchor currently carries, which is idempotent in the stronger sense
    // -- the result is the same no matter how many times it runs or what it ran over.
    //
    // Scoped to the anchor INSIDE this card, between the card's open tag and cardEnd(). A previous
    // re-run on this page wired a link into the wrong card by searching past the card boundary; the
    // bound is the whole guard, so it is asserted rather than assumed.
    for (const [cls, href, oldLabel, newLabel] of CARD_LINKS) {
      const at = p.indexOf('<div class="util-card ' + cls + '"');
      if (at < 0) { missing.push(k + ':' + cls); continue; }
      const end = cardEnd(p, at);
      const rel = p.indexOf('<a class="u-link" href="', at);
      if (rel < at || rel >= end) continue;                       // no anchor inside THIS card
      const qs = rel + '<a class="u-link" href="'.length;
      const qe = p.indexOf('"', qs);
      if (qe < 0 || qe >= end) continue;
      if (p.slice(qs, qe) !== href) { p = p.slice(0, qs) + href + p.slice(qe); wired++; }
      // The label, when this card renames one. Replaced only within the card, and only an exact old
      // text, so a re-run after the rename finds nothing and leaves the new label alone. oldLabel may
      // be a LIST of spellings -- every previous name this link has had -- because a card renamed
      // twice has containers in either state and an anchor on one spelling silently misses the other.
      if (oldLabel && newLabel) {
        const e2 = cardEnd(p, at);
        for (const was of [].concat(oldLabel)) {
          if (was === newLabel) continue;
          const li = p.indexOf(was, rel);
          if (li > rel && li < e2) {
            p = p.slice(0, li) + newLabel + p.slice(li + was.length); relabelled++; break;
          }
        }
      }
    }

    // The ten curated assets, inside the Ecosystem card, under its own heading and copy and above
    // "View partner pools" -- the same place NEAR puts them. Static markup, not a runtime build: a
    // fixed list has nothing to wait for, so there is no first-paint reshuffle and the rows are in
    // the page a crawler reads. Only the logos are fetched, by the browser, from our own origin.
    {
      const at = p.indexOf('<div class="util-card eco"');
      if (at < 0) missing.push(k + ':eco-list');
      else {
        const link = p.indexOf('<a class="u-link"', at);
        if (link > at && link < cardEnd(p, at)) { p = p.slice(0, link) + ecoList() + p.slice(link); listed++; }
        else missing.push(k + ':eco-list');
      }
    }

    // THE SHEET GOES BACK WHERE IT WAS, not at the end of <head>.
    //
    // Stellar transforms conventionally strip their own layer and re-append it before </head>, which
    // means running ONE alone teleports that layer to the end and silently reorders the page against
    // live ([[running-one-stellar-transform-reorders-layers]]). Measured on production 2026-11-13,
    // lx-lumosutil-css is 31st of 43 in this page's <head> with TWELVE layers after it -- so an
    // append here would have had to be repaired by re-running nine unrelated transforms, each of
    // which touches other pages and reorders those in turn. That cascade is the expensive half of
    // the bug, and it is avoidable: swap the block in place and this transform is order-neutral.
    //
    // The eco script rides immediately behind the sheet for the same reason -- one unit, one
    // position. It only has to exist before a row's image can fail, and <head> guarantees that.
    {
      const OPEN = '<style id="lx-lumosutil-css">';
      const at = p.indexOf(OPEN);
      if (at >= 0) {
        const end = p.indexOf('</style>', at);
        if (end > at) p = p.slice(0, at) + STYLE + ECO_SCRIPT + p.slice(end + 8);
      } else if (p.indexOf('</head>') >= 0) {
        p = p.replace('</head>', STYLE + ECO_SCRIPT + '</head>');   // first run on a fresh container
      }
    }
    if (p !== before) { json[k] = p; changed = true; pages++; }
  }

  if (changed) {
    containers++;
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
console.log('LUMOS utility: two bands on ' + pages + ' page keys, ' + copyFixed + ' fee sentence(s) corrected, '
  + wired + ' card link(s) wired, ' + relabelled + ' relabelled, ' + repaired + ' mis-wired link(s) repaired, '
  + listed + ' ecosystem list(s) of ' + ECO.length
  + (missing.length ? ' | CARD NOT FOUND: ' + missing.join(' ') : ''));
