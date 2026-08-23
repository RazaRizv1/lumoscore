// LUMOS token page real-data layer — MAINNET, READ-ONLY.
// Fills the finalized LUMOS token page (lumoscore-lumos-token) with live data for the LUMOS asset
// on Stellar mainnet. Increment 1: hero price block (USD price, ≈XLM, 24h change) + real issuer
// address. Later increments add the price chart, Overview per-network, All-LUMOS-pools table, and
// Holders. Nothing is removed; editorial content (tokenomics, utility cards, About) stays as designed.
//
// Like the Rewards page, this page talks to Stellar MAINNET Horizon regardless of the app's network
// toggle, because LUMOS lives on mainnet. The page's stat cards/chart/tables are rendered by the
// design's own JS at runtime, so we use an idempotent applyAll() re-asserted via a MutationObserver
// (one-shot writes get overwritten), plus CSS no-flash gates so the design's sample never shows.
const fs = require('fs');
const { read, getContents, VERIFIED, VTICK_SVG, DOMAIN_DISPLAY } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const KEYS = ['lumoscore-lumos-token.html', 'lumoscore-lumos-token-dark.html', 'lumoscore-lumos-token-mobile.html'];

const STYLE = `<style id="lx-lt-css">
/* verified mark and home domain: the same badge and link treatment the rest of the site uses */
.lx-vtick{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;margin-left:10px;border-radius:50%;background:var(--green,#35c07f);color:#fff;vertical-align:middle;flex:0 0 22px}
.lx-vtick svg{width:14px;height:14px;display:block}
.lx-lt-dom{display:inline-flex;align-items:center;gap:6px;margin-left:12px;color:var(--accent,#ea6a2c);font-weight:700;text-decoration:none;font-size:15px;vertical-align:middle}
.lx-lt-dom:hover{text-decoration:underline}
/* the copy confirmation: the control tells you it worked instead of doing it in silence */
.addr-row [data-copy]{position:relative;transition:color .12s,background .12s}
.addr-row [data-copy].lx-copied{color:var(--green,#35c07f)!important;background:var(--green-soft,rgba(53,192,127,.14))!important}
/* The bubble that used to sit above the button is gone -- the toast says it now. The button keeps its
   own colour flash, which is the immediate "yes, that one" the toast cannot give at a glance. */
/* The phone row is narrower than the address + badges + domain it carries, and the domain was the
   thing that ran off the edge. Let the row wrap and let the domain give way rather than overflow. */
@media(max-width:760px){
.addr-row{flex-wrap:wrap!important;row-gap:6px}
.lx-lt-dom{margin-left:0!important;font-size:13px;min-width:0;max-width:100%;overflow:hidden}
.lx-lt-dom span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
}
.lx-lt-dom svg{width:15px;height:15px;flex:none}

.hero-price-block:not(.lxlt) .price,.hero-price-block:not(.lxlt) .change,.hero-price-block:not(.lxlt) .sub-volume{visibility:hidden}
.addr-row:not(.lxlt) .addr-value{visibility:hidden}
.cstat:not(.lxlt) .lc-money,.cstat:not(.lxlt) .val,.cstat:not(.lxlt) .sub{visibility:hidden}
/* AUDIT (flash sweep): .sub was left out of the gate above, so "+184 past 7 days" flashed before the real
   "unique addresses" label landed. Same for the allocation legend, which the engine rewrites 50M/5% -> 70M/7%. */
.alloc-legend:not(.lxlt) .amount,.alloc-legend:not(.lxlt) .pct{visibility:hidden}
.lt-cmp-row:not(.lxlt) .lt-cmp-v{visibility:hidden}
#poolsBody:not(.lxlt) tr{visibility:hidden}
#priceChart:not(.lxlt) svg{visibility:hidden}
/* also hide the design's OWN chart marks at all times (it draws a line for a frame on load before */
/* ours replaces it → a flash). Only our lx-cline/lx-carea paths are ever visible. */
#priceChart svg path:not(.lx-cline):not(.lx-carea),#priceChart svg polyline,#priceChart svg polygon:not(.lx-carea),#priceChart svg line,#priceChart svg rect{display:none!important}
.lx-cdates{display:flex;justify-content:space-between;gap:8px;padding:8px 2px 0;font:600 12.5px/1 'JetBrains Mono',monospace;color:var(--text-soft,#8a8fa3)}
/* The date row is appended AFTER the svg inside #priceChart, but .chart-body is a fixed 240px and
   .chart-card is overflow:hidden — so the row overflowed by ~5px and the labels were sliced in half
   along the bottom edge. Let the body size to its contents and keep the plot itself at its old height,
   so the chart is unchanged and the labels simply have somewhere to sit. */
.chart-card .chart-body{height:auto!important;padding-bottom:12px}
.chart-card .chart-body>svg{height:214px!important}
/* Two legend swatches, both reading "Stellar", on a chart with ONE series — a leftover from the
   multi-chain design. Nothing to distinguish, so nothing to label. */
.chart-card .chart-head .chart-legend{display:none!important}
/* price-chart hover readout */
#priceChart{position:relative}
#priceChart svg{cursor:crosshair}
.lx-chtip{position:absolute;pointer-events:none;background:var(--surface,#fff);border:1px solid var(--border,#ececef);border-radius:9px;padding:7px 10px;box-shadow:0 8px 22px rgba(0,0,0,.22);opacity:0;transition:opacity .1s;z-index:6;white-space:nowrap;font-family:'Hanken Grotesk',system-ui,sans-serif}
.lx-chtip .d{color:var(--text-soft,#8a8fa3);font-size:11px;font-weight:600;margin-bottom:2px}
.lx-chtip .p{color:var(--text,#0e0e10);font-size:14px;font-weight:800;font-variant-numeric:tabular-nums}
.lx-chtip .v{color:var(--text-soft,#8a8fa3);font-size:11px;font-weight:600;margin-top:1px}
.lx-chdot{position:absolute;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:#ea6a2c;border:2px solid var(--surface,#fff);box-shadow:0 0 0 2px rgba(234,106,44,.35);pointer-events:none;opacity:0;transition:opacity .1s;z-index:5}
.lx-chvl{position:absolute;width:1px;background:rgba(234,106,44,.45);pointer-events:none;opacity:0;transition:opacity .1s;z-index:4}
/* swap/pool asset-code chips ship with a hardcoded white bg -> broken on the dark theme. Theme it. */
.lx-asset-pick.lx-swap-pick,.lx-swap-pick{background:var(--surface,#fff)!important;color:var(--text,#0e0e10)!important;border:1px solid var(--border,#ececef)!important}
/* asset logo in the swap chips + create-pool pickers, rendered via a ::before driven by --lxmlogo (set in */
/* JS) so the site's logo-painter can't wipe it. color:transparent hides the painter's fallback initial. */
#modalSwap .lx-swap-pick{display:inline-flex!important;align-items:center!important;gap:6px!important}
#modalSwap .lx-swap-pick .lx-ap-ico[data-lxbg],#createPoolModal .asset-picker .ap-ico[data-lxbg]{position:relative!important;color:transparent!important;overflow:hidden!important}
#modalSwap .lx-swap-pick .lx-ap-ico{width:18px!important;height:18px!important;min-width:18px!important;border-radius:50%!important}
#modalSwap .lx-swap-pick .lx-ap-ico[data-lxbg]::before,#createPoolModal .asset-picker .ap-ico[data-lxbg]::before{content:"";position:absolute;inset:0;background:var(--lxmlogo) center/cover no-repeat;border-radius:50%;z-index:1}
#modalSwap .lx-swap-pick .lx-ap-ico[data-lxbg]::after{display:none!important}
/* overview "Per network" header: right cell shipped a grey highlight (data rows are transparent) → */
/* inconsistent. Normalize it and add one clean vertical divider between the two columns. */
.lt-cmp-head .lt-cmp-chain{background:transparent!important}
.lt-cmp-row .lt-cmp-chain,.lt-cmp-row .lt-cmp-v{border-left:1px solid var(--border,#ececef)!important}
/* Liquidity Pairing "SOON" card removed (no longer relevant) */
.util-card.pairing{display:none!important}
/* hero address network logo: the 26px .b-ico wraps a tiny 7px inner span+img — make them fill */
.addr-row .b-ico>span,.addr-row .b-ico img{width:26px!important;height:26px!important}
/* pools "Network" column logo -> 26px (design ships an 8px inline one) */
.pools .chain-pill{display:inline-flex;align-items:center;gap:8px}
.pools .chain-pill>span{width:26px!important;height:26px!important;flex:0 0 26px!important}
.pools .chain-pill img{width:100%!important;height:100%!important;object-fit:cover}
/* supply info (i) */
.lx-supinfo{position:relative;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;margin-left:7px;border-radius:50%;border:1.4px solid var(--text-soft,#8a8fa3);color:var(--text-soft,#8a8fa3);font:italic 700 10px/16px Georgia,serif;cursor:default;vertical-align:middle;text-align:center}
/* instant custom tooltip (native title has a ~1s delay + shows a ? cursor). Text comes from data-tip. */
/* #6: it was drawn on var(--surface) with var(--text) on it -- the same pair the cards BEHIND it use,
   so on the dark theme it read as a faintly outlined patch of the page and looked like it had failed to
   appear. A tooltip is a thing floating above the page, so it takes the opposite ground: dark bubble on
   the light theme, light bubble on the dark one.
   Three states, not two: an explicit choice stamps data-theme, and the default "system" setting stamps
   nothing at all -- so the media query is guarded against an explicit light choice rather than assuming
   the attribute is always there. */
.lx-supinfo:hover::after{content:attr(data-tip);position:absolute;bottom:150%;left:50%;transform:translateX(-50%);width:220px;background:#17171c;color:#f6f6f8;border:1px solid rgba(255,255,255,.16);border-radius:9px;padding:9px 11px;font:500 12px/1.45 'Hanken Grotesk',system-ui,sans-serif;font-style:normal;letter-spacing:0;text-align:left;box-shadow:0 10px 26px rgba(0,0,0,.34);z-index:60;pointer-events:none;white-space:normal}
html[data-theme="dark"] .lx-supinfo:hover::after{background:#f7f7f9!important;color:#141418!important;border-color:rgba(0,0,0,.14)!important;box-shadow:0 10px 26px rgba(0,0,0,.5)!important}
@media (prefers-color-scheme:dark){html:not([data-theme="light"]) .lx-supinfo:hover::after{background:#f7f7f9!important;color:#141418!important;border-color:rgba(0,0,0,.14)!important;box-shadow:0 10px 26px rgba(0,0,0,.5)!important}}
/* top-holder rank medals: 1 gold (design default), 2 silver, 3 bronze */
.holder-row .rk.silver{color:#6b7280!important;background:rgba(156,163,175,.16)!important;border-color:rgba(156,163,175,.42)!important}
.holder-row .rk.bronze{color:#a55a24!important;background:rgba(176,106,52,.16)!important;border-color:rgba(176,106,52,.42)!important}
/* ranks 1/2/3 as an inline SVG medal — no circle, just the medal */
.holder-row .rk.medal{background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important;width:30px!important;height:30px!important;min-width:30px!important;display:flex!important;align-items:center!important;justify-content:center!important;overflow:visible!important}
.holder-row .rk.medal svg{display:block}
/* remove the little Stellar/orange icon inside holder rows (covers mock rows too) */
.holder-row .chain .b-ico{display:none!important}
/* loading skeleton: while the holder list pages in (~5s cold), show shimmer bars instead of the */
/* design's mock rows (wrong EVM/XRP addrs, "Stellar ·", stale $). Repeat visits are instant (cached). */
.holder-row:not([data-lxbuilt]) .rk{visibility:hidden!important}
.holder-row:not([data-lxbuilt]) .addr,
.holder-row:not([data-lxbuilt]) .chain,
.holder-row:not([data-lxbuilt]) .holdings .v,
.holder-row:not([data-lxbuilt]) .holdings .lc-money{color:transparent!important;border-radius:5px;background-image:linear-gradient(90deg,rgba(140,140,150,.10),rgba(140,140,150,.24),rgba(140,140,150,.10))!important;background-size:200% 100%!important;animation:lxshim 1.15s ease-in-out infinite}
@keyframes lxshim{0%{background-position:200% 0}100%{background-position:-200% 0}}
/* scrollable full pool list with a sticky header */
.lx-poolscroll{max-height:440px;overflow-y:auto}
.lx-poolscroll::-webkit-scrollbar{width:9px}
.lx-poolscroll::-webkit-scrollbar-thumb{background:rgba(140,140,150,.4);border-radius:5px}
.lx-poolscroll table thead th{position:sticky;top:0;z-index:3;background:var(--surface,#fff)}
/* ===== hero polish: symmetric right cluster + card-style stat tiles (DESKTOP ONLY — */
/* the mobile page shares these class names but has its own stacked/scroll layout) ===== */
@media (min-width:760px){
.lh-card .hero-right{gap:18px!important;width:300px!important;align-items:stretch!important}
.lh-card .hero-price-block{display:flex!important;flex-direction:column!important;align-items:flex-end!important;gap:5px!important;text-align:right!important}
.lh-card .hero-price-block .lbl{font-size:11px!important;letter-spacing:1.4px!important;text-transform:uppercase!important;color:var(--text-soft,#6f6f79)!important;margin:0 0 1px!important;font-weight:700!important}
.lh-card .hero-price-block .price{font-size:41px!important;line-height:1.02!important;font-weight:800!important;font-variant-numeric:tabular-nums!important;letter-spacing:-.6px!important;margin:0!important}
.lh-card .lx-pricemeta{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:9px!important;margin-top:1px!important}
.lh-card .hero-price-block .price-native{font-size:14px!important;color:var(--text-soft,#6f6f79)!important;margin:0!important}
.lh-card .hero-price-block .change{font-size:13px!important;padding:3px 9px!important;margin:0!important}
.lh-card .hero-actions{display:flex!important;gap:10px!important;width:100%!important}
.lh-card .hero-actions>button{flex:1 1 0!important;min-width:0!important;justify-content:center!important;height:44px!important;white-space:nowrap!important;font-size:16px!important;padding:0 14px!important;gap:6px!important}
.lh-card .lh-stats{display:grid!important;grid-template-columns:repeat(5,1fr)!important;gap:12px!important}
.lh-card .lh-stats .cstat{background:var(--surface,#fff)!important;border:1px solid var(--border,#ececef)!important;border-radius:14px!important;padding:15px 16px!important;display:flex!important;flex-direction:column!important;gap:9px!important;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}
.lh-card .lh-stats .cstat:hover{transform:translateY(-2px)!important;box-shadow:0 8px 20px rgba(15,16,20,.06)!important;border-color:rgba(234,106,44,.35)!important}
.lh-card .lh-stats .cstat .lbl{font-size:11px!important;letter-spacing:.6px!important;text-transform:uppercase!important;color:var(--text-soft,#6f6f79)!important;font-weight:700!important;gap:8px!important;align-items:center!important}
.lh-card .lh-stats .cstat .lbl .ic{width:24px!important;height:24px!important;border-radius:8px!important;background:rgba(234,106,44,.1)!important;color:var(--accent,#ea6a2c)!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 24px!important}
.lh-card .lh-stats .cstat .val{font-size:24px!important;font-weight:800!important;line-height:1.05!important;letter-spacing:-.4px!important;margin:0!important}
.lh-card .lh-stats .cstat .sub{font-size:12.5px!important;color:var(--text-soft,#6f6f79)!important;margin:0!important}
.lh-card .lh-stats .cstat .sub.up{color:#16a34a!important}
.lh-card .lh-stats .cstat .sub.down{color:#ef4444!important}
/* LEFT identity: bigger logo aligned to the token name (was centered on the whole */
/* block incl. the address pill → looked low), even vertical rhythm */
.lh-card .lumos-hero-row{align-items:center!important;gap:22px!important}
.lh-card .lumos-icon{width:72px!important;height:72px!important;align-self:flex-start!important;margin-top:3px!important}
.lh-card .lumos-id{display:flex!important;flex-direction:column!important;gap:9px!important}
.lh-card .lumos-id h1{margin:0!important}
.lh-card .lh-desc{margin:0!important}
.lh-card .token-addresses{margin:0!important}
/* RIGHT: center the whole price stack over the button bar → one clean centered column */
.lh-card .hero-price-block{align-items:center!important;text-align:center!important}
.lh-card .lx-pricemeta{justify-content:center!important}
/* address row: drop the left inset so the network logo lines up under the description */
.lh-card .token-addresses .addr-row{padding-left:0!important}
/* smaller hero buttons; allow a 3rd (Add trustline) to wrap to a full-width row below */
.lh-card .hero-actions{flex-wrap:wrap!important;justify-content:center!important;gap:8px!important}
.lh-card .hero-actions>button{flex:1 1 40%!important;height:38px!important;font-size:14px!important;padding:0 12px!important}
.lh-card .hero-actions>.lx-trustbtn{flex:1 1 100%!important;order:3!important}
/* overview circulating-supply LUMOS logo: 26px, no outline (the site painter fills .lx-supinfo */
/* with the LUMOS logo; here it should read as a clean token mark, not a bordered (i)) */
.lh-card + * .lt-cmp-v .lx-supinfo,.lt-cmp-v .lx-supinfo{width:26px!important;height:26px!important;border:0!important;border-radius:50%!important;background-size:cover!important;background-position:center!important;background-repeat:no-repeat!important;flex:0 0 26px!important;font-size:0!important;margin-left:8px!important}
/* overview per-network row: Stellar logo -> 26px (design ships a 14px inner span) */
.lt-cmp-chain .lt-cmp-ico{width:26px!important;height:26px!important}
.lt-cmp-chain .lt-cmp-ico>span{width:26px!important;height:26px!important}
.lt-cmp-chain .lt-cmp-ico img{width:100%!important;height:100%!important}
}
/* tab counts e.g. "Pools (58)" — via ::after so the tab's own text node stays "Pools" */
/* (the design's tab-switch handler keys off it); global so it works at any width */
.lt-tab[data-count]::after{content:" " attr(data-count);margin-left:5px;opacity:.55;font-weight:600}
/* Add-trustline button visual (global so mobile matches desktop; layout stays desktop-scoped above) */
.lh-card .hero-actions>.lx-trustbtn{background:transparent!important;border:1.4px dashed var(--accent,#ea6a2c)!important;color:var(--accent,#ea6a2c)!important}
.lh-card .hero-actions>.lx-trustbtn:hover{background:rgba(234,106,44,.08)!important}
/* Create-Pool: Asset-2 picker dropdown menu (design ships an inert picker; we build the menu) */
.lx-cpmenu{position:fixed;z-index:100001;background:var(--surface,#fff);border:1px solid var(--border,#ececef);border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.28);padding:6px;min-width:210px;max-height:288px;overflow-y:auto}
.lx-cpmenu button{display:flex;align-items:center;gap:10px;width:100%;background:none;border:0;padding:9px 10px;border-radius:9px;cursor:pointer;color:var(--text,#0e0e10);font-size:14px;font-weight:600;text-align:left}
.lx-cpmenu button:hover{background:var(--bg,rgba(0,0,0,.05))}
.lx-cpmenu .lx-cpm-ic{width:26px;height:26px;border-radius:50%;flex:0 0 26px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff;background-size:cover!important;background-position:center!important;background-repeat:no-repeat!important;overflow:hidden}
.lx-cpmenu .lx-cpm-bal{margin-left:auto;font-size:12px;color:var(--text-soft,#8a8fa3);font-weight:600}
#createPoolModal .asset-picker .ap-ico{background-size:cover;background-position:center;background-repeat:no-repeat;overflow:hidden}
</style>`;

const SCRIPT = `<script id="lx-ltdata">(function(){
  if(window.__lxLT)return;window.__lxLT=true;
  // AUDIT (flash sweep): every .lxlt gate below hides content until our data claims it. If any single fetch
  // fails, that block would stay invisible forever — a blank card is worse than a stale one. Reveal all of
  // them unconditionally after 6s, matching the safety reveal the asset-overview page already had.
  setTimeout(function(){ try{ [].forEach.call(document.querySelectorAll(".hero-price-block,.addr-row,.cstat,.lt-cmp-row,.alloc-legend,#poolsBody"),
    function(e){ e.classList.add("lxlt"); }); }catch(_){} },6000);
  var H="https://horizon.stellar.org";                 // MAINNET (LUMOS lives on mainnet)
  var CODE="LUMOS";
  var ISSUER="GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S";
  var RESV="LUMOS:GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S";
  var LOGO="/assets/tokens/lumos.png";
  var EXPLORER="https://stellar.expert/explorer/public/asset/LUMOS-GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S";
  var SUPPLY_NOTE="90% (9B LUMOS) supply is locked forever. The circulating supply is 1B LUMOS.";
  var DESC="LumosCore's native utility token — powers platform fees and rewards";   // own words, from the About LUMOS copy
  // LumosDAO project/treasury/burn wallets — excluded from the "Top holders" list (they aren't community
  // holders; the 9B burn wallet would otherwise dominate at ~90%). Same set the Rewards page excludes.
  var EXCLUDE={
    "GBIU5NISX5IP6VXZK7DEKLZC4ZVPWNCDEYQLQGXG33Y3J2LHPKPCHUOK":1,"GCCDEU4DOW3AQ5WFWY7LDEFZIJAQBI5TQXRT3XAZSWDRLK3LG53HBQCP":1,
    "GAR4HYWGY4YE7WOU2TGH7G4RL7ON72KQP24WWBT755WAWPCKRFS4SHWL":1,"GA27ELKFRT7JVZTJW4P3I3ORWLLNKRIB3D6GELPN7IESPOCUNS5NHTOD":1,
    "GCYFMZPDAR7ZTTTBA5DVG2SPR2N4CLPZLGLVI475BCGJ532WOKWRKUDG":1,"GAMXMHJX6CW6LZWUYRKVF73GOMRFJDQI57UMA4LE5QUF4DCJRGI55QD6":1,
    "GDVU64GNDFDR3OWKGPK37DAK67RPOK4OMZB4RH7NQN5UOYB4GPFVQUOD":1,"GDB46BXMVI7FEZCHG4OTZ3OCSJX4CRBOOK6OJL5JD7BF5QIW3AS53IWA":1
  };
  // reward pools (Horizon hex -> incentive label) — from the Rewards page data layer
  var REWARD_HEX={
    "78e6cfc930e2d7ceb3f6cefd4f9aa5e098c5b0af086cde0ad3147982f4d217f2":"Native LP",
    "2d630c4224248bf23ff7a639bcf05db096c4ed9a96e2d1f3e9b94c2986ef9332":"Ecosystem",
    "a7d73ed49edd21b7f3533c8a2a3b534409c1ce9a0909eb6cbb230b957d37faff":"Ecosystem",
    "a027264ce20ff9161c0eb8a016ac382432ff1b0248b407374da47d502a0a071e":"Ecosystem",
    "68d62e263f1006fdec7f456ccbd3e2fba67a335b6804088a30050542209d9f51":"Ecosystem",
    "afab0b06224d5f9a737b78f3ff2014ddee4f9e747d1c514374e22890dbbe92ba":"Ecosystem",
    "9be7d7872051f1575e8f4e69b81954ef3d017f100a4cb3f7a407fb8bc894654f":"Ecosystem",
    "40bb76280b61590c22398a882ca67b7de328f7ae689c33cc27197059134cd2cc":"Ecosystem",
    "d6dc92ff8c34c657f3a20e50c6954fecf4c965d804325e0301b0f35da4b1af71":"Ecosystem",
    "f0312476658fdd50a87c95ddcee3bedd204c29368a4a647770237610dcdb269b":"Ecosystem",
    "344e6618b45f6925e7b53a71b7882e6e2c1b983ab0926676f4175a4bfb46b7bf":"Ecosystem"
  };
  // seed XLM/USD from a shared localStorage cache so a CoinGecko rate-limit (429) never blanks the USD
  // values (market cap / FDV / volume / chart) — falls back to the last-known price (<=6h old).
  var xlmUsd=(function(){try{var c=JSON.parse(localStorage.getItem("lumos.xlmUsd")||"null");return (c&&+c.v>0&&(Date.now()-c.ts<216e5))?+c.v:0;}catch(e){return (window.__lxXlmUsd||0);}})(), lumosXlm=0, chg24=null;                // price fetches
  var supply=null, holders=null, poolCount=null, activePools=null, vol24Usd=null, vol24Xlm=null, volChg=null;   // stat fetches
  function j(u){return fetch(u).then(function(r){if(!r.ok)throw new Error(r.status);return r.json();});}
  var VFD=${JSON.stringify(VERIFIED)};
  var DDOM=${JSON.stringify(DOMAIN_DISPLAY)};
  var VTICKSVG='${VTICK_SVG}';
  var GLOBE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>';
  function q(s){return document.querySelector(s);}
  function qa(s){return [].slice.call(document.querySelectorAll(s));}
  function setText(el,t){if(el&&t!=null&&el.textContent!==t)el.textContent=t;}
  function setMoney(el,s){ if(!el)return; if(el.textContent!==s)el.textContent=s; if(el.setAttribute){el.setAttribute("data-orig",s);el.setAttribute("data-usd",s);} }   // .lc-money is re-stamped from data-orig by a site painter
  function usd(x){x=+x||0;if(x>=1)return "$"+x.toFixed(2);if(x>=0.01)return "$"+x.toFixed(4);if(x>0)return "$"+x.toFixed(8);return "$0";}
  function xlmAmt(x){x=+x||0;if(x>=1)return x.toFixed(4);if(x>0)return (+x.toPrecision(4)).toString();return "0";}
  function num(n){return Math.round(+n||0).toLocaleString("en-US");}
  function abbrNum(n){n=+n||0;var a=Math.abs(n);if(a>=1e9)return (n/1e9).toFixed(2)+"B";if(a>=1e6)return (n/1e6).toFixed(2)+"M";if(a>=1e3)return (n/1e3).toFixed(1)+"K";return String(Math.round(n));}
  function abbrUsd(n){n=+n||0;var a=Math.abs(n);if(a>=1e9)return "$"+(n/1e9).toFixed(2)+"B";if(a>=1e6)return "$"+(n/1e6).toFixed(2)+"M";if(a>=1e3)return "$"+(n/1e3).toFixed(1)+"K";if(a>=1)return "$"+n.toFixed(2);return usd(n);}
  function shortG(a){a=String(a||"");return a.length>12?a.slice(0,4)+"…"+a.slice(-4):a;}
  // medal badge for the top-3 holders as an inline SVG (emoji got stripped by the JSON-container
  // re-serialization, so a pure-ASCII SVG is used instead — renders identically everywhere).
  function medalSVG(i){
    var c=[{a:"#ffe487",b:"#e3a81a",s:"#b9860f",t:"#6d4a00"},   // gold
           {a:"#ffffff",b:"#b6bcc6",s:"#8b93a0",t:"#4c5661"},   // silver
           {a:"#f3c79a",b:"#c07a3c",s:"#97592a",t:"#5f3616"}][i];// bronze
    var id="lxmed"+i;
    return '<svg viewBox="0 0 40 40" width="26" height="26" aria-hidden="true">'
      +'<defs><radialGradient id="'+id+'" cx="36%" cy="28%" r="78%"><stop offset="0%" stop-color="'+c.a+'"></stop><stop offset="100%" stop-color="'+c.b+'"></stop></radialGradient></defs>'
      +'<circle cx="20" cy="21" r="15.5" fill="url(#'+id+')" stroke="'+c.s+'" stroke-width="2"></circle>'
      +'<circle cx="20" cy="21" r="12.3" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="1"></circle>'
      +'<path d="M12 3 L16 12 L12 11 L8 12 Z" fill="'+c.s+'"></path><path d="M28 3 L32 12 L28 11 L24 12 Z" fill="'+c.s+'"></path>'
      +'<text x="20" y="26.5" text-anchor="middle" font-family="system-ui,sans-serif" font-size="15" font-weight="800" fill="'+c.t+'">'+(i+1)+'</text>'
      +'</svg>';
  }

  // Fill the hero price block + issuer address. Idempotent (only writes when different) so the
  // MutationObserver can re-assert after the design re-renders, without looping.
  function applyHero(){
    // The hero token mark was being replaced by the site-wide logo guard with its generic letter-"L"
    // SVG (it stamps data-logoed and clears the background), so the LUMOS page showed a placeholder for
    // its own token. data-lxc is that guard's documented opt-out, and re-asserting each pass keeps it
    // put if anything repaints. Same logo the wallet uses for LUMOS, and absolute so nested clean URLs
    // cannot mis-resolve it.
    try{ var bi=q(".lumos-big-icon");
      if(bi){ if(bi.getAttribute("data-lxc")==null)bi.setAttribute("data-lxc","LUMOS");
        if(bi.getAttribute("data-lxlogo")!=="1"||bi.querySelector("svg")){
          bi.setAttribute("data-lxlogo","1"); bi.innerHTML="";
          bi.style.setProperty("background",'url("/assets/favicon.png") center/cover no-repeat',"important");
          bi.style.setProperty("border-radius","50%","important"); } } }catch(_){}
    var hp=q(".hero-price-block");
    if(hp&&lumosXlm>0){
      var priceUsd=lumosXlm*xlmUsd;
      setText(hp.querySelector(".price"), usd(priceUsd));
      // "≈ X XLM" sub — the element under .price that mentions XLM
      var sub=hp.querySelector(".sub-volume")||qa(".hero-price-block *").filter(function(e){return e.children.length===0&&/XLM/.test(e.textContent||"");})[0];
      if(sub)setText(sub, "≈ "+xlmAmt(lumosXlm)+" XLM");
      // 24h change
      var ch=hp.querySelector(".change");
      if(ch&&chg24!=null){
        var up=chg24>=0;
        setText(ch, (up?"+":"−")+Math.abs(chg24).toFixed(1)+"% (24h)");
        ch.classList.toggle("down", !up);
      }
      hp.classList.add("lxlt");
    }
    // group "≈ X XLM" + the 24h change badge onto ONE right-aligned meta row (symmetry). Idempotent.
    if(hp&&!hp.querySelector(".lx-pricemeta")){
      var nat=hp.querySelector(".price-native")||hp.querySelector(".sub-volume");
      var chg=hp.querySelector(".change");
      if(nat&&chg&&nat.parentNode===hp&&chg.parentNode===hp){
        var meta=document.createElement("div"); meta.className="lx-pricemeta";
        hp.insertBefore(meta, nat); meta.appendChild(nat); meta.appendChild(chg);
      }
    }
    // LUMOS logo on the hero icon. Reuse the design's OWN transparent flame PNG (the sidebar .logo-mark
    // base64 — verified alpha=0 background) instead of the IPFS asset, which has a dark tile baked in.
    var ic=q(".lumos-icon"); if(ic&&ic.getAttribute("data-lxlogo")!=="1"){ ic.setAttribute("data-lxlogo","1");
      var brand=q(".nx-brand .logo-mark")||qa(".logo-mark").filter(function(e){return e!==ic;})[0];
      var lbg=brand?getComputedStyle(brand).backgroundImage:""; if(!lbg||lbg==="none")lbg="url("+LOGO+")";
      ic.style.setProperty("background-image",lbg,"important");
      ic.style.setProperty("background-color","transparent","important");
      ic.style.setProperty("background-size","contain","important");
      ic.style.setProperty("background-repeat","no-repeat","important");
      ic.style.setProperty("background-position","center","important");
      // the design's box-shadow is a rectangular glow meant for a solid tile; with a
      // transparent flame it reads as a faint box. Use a silhouette-following drop-shadow.
      ic.style.setProperty("box-shadow","none","important");
      ic.style.setProperty("filter","drop-shadow(0 6px 14px rgba(234,106,44,.28))","important");
    }
    // more relevant tagline (design ships the generic "Native utility token · live on Stellar")
    var desc=q(".lh-desc"); if(desc&&desc.textContent.trim()!==DESC)setText(desc, DESC);
    // "Add trustline" button — show ONLY when a wallet is connected AND it has no LUMOS trustline yet.
    var acts=q(".hero-actions");
    if(acts){
      var tbn=acts.querySelector(".lx-trustbtn");
      var show=(ltAddr() && window.__lxHasTrust===false);
      if(show&&!tbn){ tbn=document.createElement("button"); tbn.type="button"; tbn.className="btn-secondary lx-trustbtn"; tbn.textContent="Add trustline"; tbn.setAttribute("data-lx-noswap",""); tbn.addEventListener("click",function(){ ltAddTrust(tbn); }); acts.appendChild(tbn); }
      else if(!show&&tbn&&tbn.parentNode){ tbn.parentNode.removeChild(tbn); }
    }
    // real issuer address in every .addr-row (design ships an EVM 0x… placeholder)
    qa(".addr-row").forEach(function(row){
      var v=row.querySelector(".addr-value");
      if(v){ setText(v, shortG(ISSUER)); v.setAttribute("title", ISSUER); v.setAttribute("data-full", ISSUER); }
      // make the external-link addr-btn open the LUMOS asset on Stellar.expert. The design's tooltip is a
      // custom CSS one reading data-tooltip (not title) — set that, and drop our native title so only ONE shows.
      var link=row.querySelector("a.addr-btn");
      if(link&&link.getAttribute("data-lxex")!=="1"){ link.setAttribute("data-lxex","1"); link.setAttribute("href",EXPLORER); link.setAttribute("target","_blank"); link.setAttribute("rel","noopener"); link.setAttribute("data-tooltip","View on Stellar Explorer"); link.removeAttribute("title"); }
      // The PHONE build ships the copy button with an Aptos-era hex address baked into data-copy, so it
      // showed GB5T...5B6S and copied 0x0364a66f... Point every copy control on this row at the issuer
      // the row is actually displaying. Written from ISSUER rather than from the visible text, which is
      // truncated.
      // row.querySelectorAll, NOT this file's qa() -- qa takes one argument and always searches the whole
      // document, so scoping it by passing the row would have silently rewritten every data-copy on
      // the page, pool ids included.
      [].slice.call(row.querySelectorAll("[data-copy]")).forEach(function(b){
        // #3 (batch 4): the DESKTOP page ships its own [data-copy] handler with its own toast, so a
        // single tap produced two: "Address copied to clipboard" and ours. stopPropagation cannot
        // prevent that -- both listeners are on the SAME element, and the page bound its one first, so
        // it has already fired by the time ours runs. Replace the node with a clone: a clone carries
        // the markup but none of the listeners, which orphans the page's handler and leaves exactly
        // one confirmation. Same trick the header fields in _dexassetdata use, and for the same reason.
        if(!b.__lxcpc&&b.parentNode){
          var _c=b.cloneNode(true); _c.__lxcpc=1;
          b.parentNode.replaceChild(_c,b); b=_c;
        }
        if(b.getAttribute("data-copy")!==ISSUER)b.setAttribute("data-copy",ISSUER);
        // It copies, and always did once data-copy was right -- but it says NOTHING when it does, and
        // a control that gives no answer reads as a broken one. Own the click so the confirmation is
        // ours: write the address, then show it happened.
        if(b.__lxcp)return; b.__lxcp=1;
        b.addEventListener("click",function(ev){
          var txt=b.getAttribute("data-copy")||ISSUER;
          try{ev.preventDefault();ev.stopPropagation();}catch(_){}
          // #6: this drew a bubble of its own above the button. Every other copy on the site answers
          // with the bottom-centre toast, and two different confirmations for one action is one too many.
          function ok(){ ltToast("Issuer address copied");
            b.classList.add("lx-copied");
            setTimeout(function(){b.classList.remove("lx-copied");},1400); }
          try{
            if(navigator.clipboard&&navigator.clipboard.writeText){
              navigator.clipboard.writeText(txt).then(ok,fallback);
            } else fallback();
          }catch(_){ fallback(); }
          function fallback(){
            // Safari on iOS refuses the async API outside some gestures; the textarea route still works.
            try{ var ta=document.createElement("textarea"); ta.value=txt;
              ta.setAttribute("readonly",""); ta.style.cssText="position:fixed;top:0;left:0;opacity:0";
              document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0,txt.length);
              document.execCommand("copy"); document.body.removeChild(ta); ok();
            }catch(_){}
          }
        });
      });
      row.classList.add("lxlt");
    });
    // Verified tick on the token name, driven by the shared list rather than asserted here, so removing
    // LUMOS from VERIFIED removes the badge instead of leaving a stale claim on its own page.
    var _h1=q("h1");
    if(_h1 && VFD["LUMOS|"+ISSUER] && !_h1.querySelector(".lx-vtick")){
      var _tk=document.createElement("span");
      _tk.className="lx-vtick"; _tk.setAttribute("title","Verified issuer");
      _tk.innerHTML=VTICKSVG; _h1.appendChild(_tk);
    }
    // Home domain: lumoscore.com, matching Trade-Asset and search. The chain still says lumosdao.io.
    var _dom=DDOM["LUMOS|"+ISSUER]||"";
    if(_dom)qa(".addr-row").forEach(function(row){
      var a=row.querySelector(".lx-lt-dom");
      if(!a){ a=document.createElement("a"); a.className="lx-lt-dom"; a.target="_blank"; a.rel="noopener";
        a.innerHTML=GLOBE+"<span></span>"; row.appendChild(a); }
      if(a.getAttribute("href")!=="https://"+_dom)a.setAttribute("href","https://"+_dom);
      var t=a.querySelector("span"); if(t&&t.textContent!==_dom)t.textContent=_dom;
    });
    // any stray "View on <chain> Explorer" tooltips (title OR data-tooltip) -> Stellar
    qa("[data-tooltip],[title]").forEach(function(e){ ["title","data-tooltip"].forEach(function(a){ var t=e.getAttribute(a)||""; if(/View on .* Explorer/.test(t)&&t.indexOf("Stellar")<0)e.setAttribute(a,"View on Stellar Explorer"); }); });
  }

  // Hero stat cards (.lh-stats .cstat): Market Cap, Fully Diluted Val, Holders, Pools, 24h Volume.
  function applyStats(){
    var priceUsd=lumosXlm*xlmUsd;
    qa(".lh-stats .cstat").forEach(function(card){
      var t=(card.textContent||"").toUpperCase();
      var val=card.querySelector(".val"), sub=card.querySelector(".sub"); var money=card.querySelector(".lc-money")||val;
      var done=false;
      // check DILUTED before MARKET CAP: the FDV card's own sub contains the words "market cap"
      if(/DILUTED/.test(t)){ if(priceUsd>0&&supply>0){ setMoney(money,abbrUsd(supply*priceUsd)); if(sub)setText(sub,"on "+abbrNum(supply)+" total supply"); done=true; } }
      else if(/MARKET CAP/.test(t)){ if(priceUsd>0&&supply>0){ var circ=circSupply(); var mc=(circ!=null?circ:supply)*priceUsd; setMoney(money,abbrUsd(mc)); if(sub){ var wc="on "+abbrNum(circ!=null?circ:supply)+" circulating"; var ns=sub.querySelector(".lx-supnum"); if(!ns){ sub.innerHTML='<span class="lx-supnum"></span><span class="lx-supinfo" data-tip="'+SUPPLY_NOTE+'">i</span>'; ns=sub.querySelector(".lx-supnum"); } if(ns&&ns.textContent!==wc)ns.textContent=wc; } done=true; } }
      else if(/HOLDERS/.test(t)){ if(holders!=null){ if(val)setText(val,num(holders)); if(sub)setText(sub,"unique addresses"); done=true; } }
      else if(/POOLS/.test(t)){ if(poolCount!=null){ if(val)setText(val,String(poolCount)); done=true; }
        // the POOLS card ships with no sub-line → the desktop 5-card row loses its vertical rhythm.
        // Add one ONLY on the desktop layout (the mobile card already has its own sub text).
        var wide=!(window.matchMedia)||window.matchMedia("(min-width:760px)").matches;
        if(wide&&!sub){ var ps=document.createElement("div"); ps.className="sub"; ps.textContent="LUMOS pairs"; card.appendChild(ps); } }
      else if(/VOLUME/.test(t)){ if(vol24Usd!=null){ setMoney(money,abbrUsd(vol24Usd)); if(sub&&volChg!=null){ setText(sub,(volChg>=0?"+":"−")+Math.abs(volChg).toFixed(1)+"% past 24h"); sub.classList.toggle("up",volChg>=0); } done=true; } }
      if(done)card.classList.add("lxlt");
    });
  }
  // Overview "Per network" rows (.lt-cmp-row: .lt-cmp-l label + .lt-cmp-v value).
  function applyOverview(){
    var priceUsd=lumosXlm*xlmUsd;
    qa(".lt-cmp-row").forEach(function(r){
      var l=((r.querySelector(".lt-cmp-l")||{}).textContent||"").trim(), v=r.querySelector(".lt-cmp-v");
      if(!v)return; var done=false;
      if(/^price/i.test(l)){ if(priceUsd>0){ setText(v, usd(priceUsd)+(chg24!=null?("  "+(chg24>=0?"+":"−")+Math.abs(chg24).toFixed(1)+"%"):"")); done=true; } }
      else if(/24h volume/i.test(l)){ if(vol24Usd!=null&&poolCount!=null){ setText(v, abbrUsd(vol24Usd)+" across "+poolCount+" pools"); done=true; } }
      else if(/circulating/i.test(l)){ if(supply!=null){ var cs=circSupply(); var want=num(cs!=null?cs:supply)+" LUMOS"; var ns=v.querySelector(".lx-supnum"); if(!ns){ v.innerHTML='<span class="lx-supnum"></span>'; ns=v.querySelector(".lx-supnum"); } var _si=v.querySelector(".lx-supinfo"); if(_si)_si.parentNode.removeChild(_si); if(ns&&ns.textContent!==want)ns.textContent=want; done=true; } }
      else if(/holders/i.test(l)&&!/pool/i.test(l)){
        // show BOTH: holders (balance>0) · trustlines (all accounts trusting LUMOS = /assets authorized count)
        var lab=r.querySelector(".lt-cmp-l"); if(lab)setText(lab,"Holders · Trustlines");
        var hc=holderCount(), tl=holders;
        // AUDIT: this required BOTH halves before revealing, so whenever the holders count came back null
        // the row rendered "…  ·  1,453" and then stayed permanently invisible behind the .lxlt gate.
        // The trustline count alone is worth showing; the "…" already says the other half is pending.
        if(tl!=null){ setText(v, (hc!=null?num(hc):"…")+"  ·  "+num(tl)); done=true; }
      }
      else if(/active pools/i.test(l)){ if(activePools!=null){ setText(v, String(activePools)); done=true; } }
      if(done)r.classList.add("lxlt");
    });
  }
  // About copy: the design says "exists natively on both <net> and <net> … 1 billion LUMOS per chain"
  // (a cross-chain artifact). Rewrite to single-network wording on the text node itself (the <p> has
  // child elements, so an element-level edit misses it).
  // The design's i18n/render engine holds a REFERENCE to the original node and keeps restoring its baked
  // text (nonstop glitch when we edit in place). Fix = clone → edit clone → replaceChild: the engine's ref
  // is now orphaned and our fresh node persists. Guard with data-lxfixed so we clone-replace only once.
  function fixAbout(){
    try{
      qa("p").forEach(function(p){
        if(p.getAttribute("data-lxfixed")==="1")return;
        if((p.textContent||"").indexOf("exists natively on both")<0)return;
        var c=p.cloneNode(true);
        [].slice.call(c.childNodes).forEach(function(n){
          if(n.nodeType!==3)return; var v=n.nodeValue||"";
          if(/on both\\s*$/.test(v)) n.nodeValue=v.replace(/on both\\s*$/,"on ");
          else if(/^\\s*and\\s*$/.test(v)) n.nodeValue=" ";
          else if(v.indexOf("with identical tokenomics")>=0) n.nodeValue=v.replace(/with identical tokenomics — 1 billion LUMOS per chain/,"with a fixed on-chain supply");
        });
        var st=[].slice.call(c.querySelectorAll("strong")).filter(function(s){return (s.textContent||"").trim()==="Stellar";});
        for(var k=1;k<st.length;k++){ if(st[k].parentNode)st[k].parentNode.removeChild(st[k]); }
        c.setAttribute("data-lx-noswap",""); c.setAttribute("data-lxfixed","1");
        if(p.parentNode)p.parentNode.replaceChild(c,p);
      });
    }catch(_){}
  }

  // All-LUMOS-pools table (#poolsBody). Rebuild rows from the design's row template (keeps styling/icons)
  // with real pools sorted by TVL. TVL ≈ 2× the LUMOS-side value (AMM pools are balanced). 24h volume is
  // filled per-pool by a bounded trades fetch (top rows only). Rebuild only when the rows aren't ours yet
  // (survives the design re-rendering the tbody).
  // pool pair icons: .a = LUMOS logo, .b = the paired asset. XLM keeps the design's Stellar logo (that IS
  // XLM's mark); other assets get a clean per-asset avatar (no reliable logo feed for arbitrary Stellar tokens).
  // a circular initial-avatar as an SVG data-URI background (the painter overrides innerHTML, so we set
  // background + strip its data-logo attr so it has nothing to repaint from).
  function avatarBg(code){ var c=String(code||"?"); var hue=0; for(var i=0;i<c.length;i++)hue=(hue*31+c.charCodeAt(i))%360;
    var init=c.replace(/[^A-Za-z0-9]/g,"").slice(0,2).toUpperCase()||"?"; var fs=init.length>1?15:20;
    var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="hsl('+hue+',60%,50%)"/><text x="20" y="'+(init.length>1?26:27)+'" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="'+fs+'" fill="#fff">'+init+'</text></svg>';
    return "url(\\"data:image/svg+xml,"+encodeURIComponent(svg)+"\\")"; }
  function flameBg(){ var f=window.__lxFlame; if(!f){ var brand=document.querySelector(".nx-brand .logo-mark"); var bg=brand?getComputedStyle(brand).backgroundImage:""; f=(bg&&bg!=="none")?bg:("url("+LOGO+")"); window.__lxFlame=f; } return f; }
  function setPoolIcons(row, code){ var pi=row.querySelector(".pair-icons"); if(!pi)return;
    var a=pi.querySelector(".a"), b=pi.querySelector(".b");
    // .a = LUMOS flame (re-assert if the painter wiped it)
    if(a&&(a.getAttribute("data-lxa")!=="1"||a.hasAttribute("data-logo")||(a.style.backgroundImage||"").indexOf("data:image")<0)){ a.setAttribute("data-lxa","1"); a.removeAttribute("data-logo"); a.innerHTML=""; a.style.backgroundImage=flameBg(); a.style.backgroundSize="contain"; a.style.backgroundPosition="center"; a.style.backgroundRepeat="no-repeat"; }
    // .b = paired asset. XLM keeps the design's Stellar logo; others get an initial-avatar.
    if(b&&code!=="XLM"&&(b.getAttribute("data-lxb")!=="1"||b.hasAttribute("data-logo")||(b.style.backgroundImage||"").indexOf("svg+xml")<0)){ b.setAttribute("data-lxb","1"); b.removeAttribute("data-logo"); b.innerHTML=""; b.style.backgroundImage=avatarBg(code); b.style.backgroundSize="cover"; b.style.backgroundPosition="center"; b.style.backgroundRepeat="no-repeat"; }
  }
  // re-assert pool icons every tick (the design's logo-painter re-paints .a/.b from data-logo).
  function repaintPoolIcons(){ qa("#poolsBody tr[data-code]").forEach(function(r){ try{ setPoolIcons(r, r.getAttribute("data-code")); }catch(_){} }); }
  // grab the Stellar network logo (XLM's mark) already on the page; cache it.
  function stellarLogoBg(){ if(window.__lxStellar)return window.__lxStellar; var im=document.querySelector(".addr-row .b-ico img,.lt-cmp-chain .lt-cmp-ico img,.b-ico img"); var src=im?im.getAttribute("src"):""; window.__lxStellar=src?("url(\\""+src+"\\")"):flameBg(); return window.__lxStellar; }
  function assetBg(code){ if(code==="LUMOS")return flameBg(); if(code==="XLM")return stellarLogoBg(); return avatarBg(code); }
  // show both asset logos in the Swap chips (.lx-ap-ico) + Create-Pool pickers (.ap-ico). Re-assert each
  // tick — _swapcalc/the design re-render these on selection.
  // render the logo through a CSS ::before driven by a custom property — the site's logo-painter keeps
  // clearing the element's own background/text, but it can't touch a pseudo-element. Re-assert the var each tick.
  function paintIco(ico, code){ if(!ico||!code)return; ico.setAttribute("data-lxbg",code); ico.style.setProperty("--lxmlogo", assetBg(code)); }
  function setModalLogos(){
    qa("#modalSwap .lx-swap-pick").forEach(function(c){ paintIco(c.querySelector(".lx-ap-ico"), ((c.querySelector(".lx-ap-code")||{}).textContent||"").trim()); });
    // The Create-Pool chips re-paint every tick through a ::before overlay, and assetBg() only ever gets a
    // CODE parsed out of the DOM — so anything that isn't LUMOS/XLM resolved to a letter avatar and covered
    // the real logo underneath (AQUA showed "AQ" while its dropdown row showed the aqua.network mark).
    // The modal already knows the chosen asset OBJECT (code + issuer), so resolve from that and only fall
    // back to the code-only painter when we genuinely have no URL.
    var _cpm=q("#createPoolModal");
    qa("#createPoolModal .asset-field").forEach(function(fld,idx){
      var p=fld.querySelector(".asset-picker"); if(!p||p.classList.contains("placeholder"))return;
      var ico=p.querySelector(".ap-ico"); if(!ico)return;
      var code=((p.querySelector(".ap-name")||{}).textContent||"").trim();
      var a=_cpm?(idx===0?_cpm.__a1:_cpm.__a2):null;
      var u=a?cpLogo(a):"";
      if(u){ ico.setAttribute("data-lxbg",code); ico.style.setProperty("--lxmlogo","url("+u+")");
             cpFetchLogo(a,function(){ var v=cpLogo(a); if(v)ico.style.setProperty("--lxmlogo","url("+v+")"); }); }
      else paintIco(ico, code);
    });
  }
  // Supply distribution: fold Cross-Chain Reserve (50M) into Airdrops -> Airdrops becomes 70M / 7%.
  function fixAllocation(){
    qa(".alloc-row").forEach(function(r){ if(/Cross-Chain Reserve/i.test((r.querySelector(".name")||{}).textContent||"")&&r.parentNode)r.parentNode.removeChild(r); });
    qa(".alloc-seg").forEach(function(s){ if((s.getAttribute("style")||"").indexOf("--alloc-5)")>=0&&s.parentNode)s.parentNode.removeChild(s); });
    qa(".alloc-row").forEach(function(r){ if(/Airdrops/i.test((r.querySelector(".name")||{}).textContent||"")){ var am=r.querySelector(".amount"),pc=r.querySelector(".pct"); if(am)setText(am,"70M"); if(pc)setText(pc,"7%"); r.style.gridColumn="auto"; r.style.maxWidth="none"; } });
    qa(".alloc-legend").forEach(function(l){ l.classList.add("lxlt"); });   // reveal the legend once the numbers are ours
    qa(".alloc-seg").forEach(function(s){ if((s.getAttribute("style")||"").indexOf("--alloc-7)")>=0&&s.style.width!=="7%")s.style.width="7%"; });
  }
  function buildPoolsTable(){
    var pb=q("#poolsBody"); if(!pb)return; var pools=window.__lxLTpools; if(!pools||!pools.length)return;
    var priceUsd=lumosXlm*xlmUsd; if(!(priceUsd>0))return;
    if(pb.querySelector("tr[data-lxbuilt]")){ pb.classList.add("lxlt"); return; }
    var tpl=pb.querySelector("tr"); if(!tpl)return;
    var arr=pools.map(function(p){
      var lum=0,other=0,code="XLM";
      (p.reserves||[]).forEach(function(rv){ if(rv.asset.indexOf(RESV)===0)lum=+rv.amount; else if(rv.asset==="native"){other=+rv.amount;code="XLM";} else {other=+rv.amount;code=rv.asset.split(":")[0];} });
      return {hex:p.id, code:code, tvl:lum*priceUsd*2};
    }).sort(function(a,b){return b.tvl-a.tvl;});   // ALL LUMOS pools, TVL desc (list is scrollable — see .lx-poolscroll)
    var frag=document.createDocumentFragment();
    arr.forEach(function(pool){
      var row=tpl.cloneNode(true); row.setAttribute("data-lxbuilt","1"); row.setAttribute("data-hex",pool.hex); row.setAttribute("data-code",pool.code);
      var nm=row.querySelector(".pair-name"); if(nm)nm.textContent="LUMOS / "+pool.code;
      setPoolIcons(row, pool.code);   // .a = LUMOS logo, .b = the paired asset (XLM keeps the Stellar logo; others get a per-asset avatar)
      var monies=row.querySelectorAll(".lc-money");
      if(monies[0]){ monies[0].textContent=abbrUsd(pool.tvl); monies[0].setAttribute("data-orig",abbrUsd(pool.tvl)); monies[0].setAttribute("data-usd",pool.tvl); }
      if(monies[1]){ monies[1].textContent="$0"; monies[1].setAttribute("data-orig","$0"); monies[1].setAttribute("data-usd","0"); }
      var inc=row.querySelector(".incent-pill"); if(inc){ var lab=REWARD_HEX[pool.hex]; if(lab){ inc.textContent=lab; inc.className="incent-pill "+(lab==="Native LP"?"native":"eco"); } else { inc.style.display="none"; } }
      var link=row.querySelector("a"); if(link)link.setAttribute("href","lumoscore-amm-pool.html?pool="+pool.hex);
      // drop the Network column cell (obvious — always Stellar for a connected Stellar user)
      var netCell=row.querySelector(".chain-pill"); if(netCell){ var td=netCell.closest("td"); if(td&&td.parentNode)td.parentNode.removeChild(td); }
      frag.appendChild(row);
    });
    pb.innerHTML=""; pb.appendChild(frag); pb.classList.add("lxlt");
    // remove the "Network" header th to match
    var head=q("#poolsBody"); var tbl=head?head.closest("table"):null; var thead=tbl?tbl.querySelector("thead tr"):null;
    if(thead){ [].slice.call(thead.querySelectorAll("th")).forEach(function(th){ if(/^Network$/i.test((th.textContent||"").trim())&&th.parentNode)th.parentNode.removeChild(th); }); }
    // the full 58-pool list is long → wrap the table in a scroll box (sticky header via CSS). Wrap once.
    if(tbl&&tbl.parentNode&&!tbl.parentNode.classList.contains("lx-poolscroll")){ var wrap=document.createElement("div"); wrap.className="lx-poolscroll"; tbl.parentNode.insertBefore(wrap,tbl); wrap.appendChild(tbl); }
    fetchPoolVolumes(arr.slice(0,30));   // real 24h vol for the top pools; the long tail stays $0 (no trades)
  }
  // Real 24h volume for the shown pools (bounded — top rows only).
  function fetchPoolVolumes(arr){
    if(window.__lxLTvolDone)return; window.__lxLTvolDone=true;
    arr.forEach(function(pool){
      j(H+"/liquidity_pools/"+pool.hex+"/trades?order=desc&limit=100").then(function(d){
        var recs=(d&&d._embedded&&d._embedded.records)||[]; var now=Date.now(), volXlm=0;
        recs.forEach(function(x){ var xa=x.base_asset_type==="native"?+x.base_amount:(x.counter_asset_type==="native"?+x.counter_amount:0); var ts=Date.parse(x.ledger_close_time||""); if(now-ts<=864e5)volXlm+=xa; });
        var r=q('#poolsBody tr[data-hex="'+pool.hex+'"]'); var cell=r?r.querySelectorAll(".lc-money")[1]:null;
        if(cell){ var s=abbrUsd(volXlm*xlmUsd); cell.textContent=s; cell.setAttribute("data-orig",s); cell.setAttribute("data-usd",volXlm*xlmUsd); }
      }).catch(function(){});
    });
  }

  // Holders tab: distribution buckets (.wsize-row) + Top holders (.holder-row). Needs the full holder
  // list, so page /accounts?asset= (stellar.expert is CORS-blocked; Horizon is fine but unsorted → page all).
  function applyHolders(){
    // do this even before the holder list loads, so the mock subtitle doesn't linger during the cold load
    qa("*").forEach(function(e){ if(e.children.length)return; var t=e.textContent||""; if(t.indexOf("Combined")>=0&&t.indexOf("both chains")>=0)e.textContent=t.replace(/Combined[^]*?both chains/,"Ranked by balance"); });
    var hold=window.__lxLThold; if(!hold||!hold.length||!(supply>0))return;
    var b=[0,0,0,0];  // 5M+, 1M–5M, 250K–1M, <250K
    hold.forEach(function(h){ var v=h.bal; if(v>=5e6)b[0]++; else if(v>=1e6)b[1]++; else if(v>=25e4)b[2]++; else b[3]++; });
    var labels=["5M+ LUMOS","1M – 5M","250K – 1M","Under 250K"], tot=hold.length||1, mx=Math.max(b[0],b[1],b[2],b[3])||1;
    var rows=qa(".wsize-row");
    rows.forEach(function(r,i){ if(i>3)return; var lab=r.querySelector(".wsize-label"),cnt=r.querySelector(".wsize-count"),fill=r.querySelector(".fill");
      if(lab)setText(lab,labels[i]); if(cnt)setText(cnt,num(b[i])); if(fill)fill.style.width=Math.max(1,Math.round(b[i]/mx*100))+"%"; r.classList.add("lxlt"); });
    // "N total" next to the breakdown title
    qa(".hbreak-total, .holders-total").forEach(function(e){ setText(e, num(tot)+" total"); });
    // Top holders
    var hr=qa(".holder-row"), top=hold.filter(function(h){return !EXCLUDE[h.addr];}).slice(0,hr.length);
    // clone → edit → replaceChild (once per row): orphans the design engine's node reference so it can't
    // revert our real holder to the baked mock (which caused the nonstop % glitch).
    hr.forEach(function(row,i){ var h=top[i]; if(!h)return;
      if(row.getAttribute("data-lxbuilt")==="1")return;
      var c=row.cloneNode(true);
      var rk=c.querySelector(".rk"); if(rk){ if(i<3){ rk.className="rk medal"; rk.innerHTML=medalSVG(i); } else { rk.className="rk"; rk.textContent=String(i+1); } }   // 1/2/3 SVG medals, rest numbered
      var addr=c.querySelector(".addr"); if(addr){ addr.textContent=shortG(h.addr); addr.setAttribute("title",h.addr); }
      var chain=c.querySelector(".chain"); if(chain){ var bic=chain.querySelector(".b-ico"); if(bic&&bic.parentNode)bic.parentNode.removeChild(bic);   // drop the little Stellar icon + "Stellar ·" prefix
        var pct=h.bal/supply*100, want=(pct>=0.01?pct.toFixed(2):"<0.01")+"% of supply";
        var tn=[].slice.call(chain.childNodes).filter(function(n){return n.nodeType===3&&(n.nodeValue||"").replace(/\\s/g,"");})[0];
        if(tn)tn.nodeValue=want; else chain.appendChild(document.createTextNode(want)); }
      // real holdings (the design's mock $ used the old $0.0032 price → wrong). Set amount + USD.
      var pUsd=lumosXlm*xlmUsd;
      var vv=c.querySelector(".holdings .v"); if(vv)vv.textContent=abbrNum(h.bal)+" LUMOS";
      var mm=c.querySelector(".holdings .lc-money"); if(mm&&pUsd>0){ var uu=abbrUsd(h.bal*pUsd); mm.textContent=uu; mm.setAttribute("data-orig",uu); mm.setAttribute("data-usd",h.bal*pUsd); }
      // link the row to the holder's Stellar.expert account page
      c.style.cursor="pointer"; c.setAttribute("title","View "+shortG(h.addr)+" on Stellar Explorer");
      (function(ad){ c.addEventListener("click",function(ev){ if(ev.target&&ev.target.closest&&ev.target.closest("a"))return; window.open("https://stellar.expert/explorer/public/account/"+ad,"_blank","noopener"); }); })(h.addr);
      c.setAttribute("data-lx-noswap",""); c.setAttribute("data-lxbuilt","1"); c.setAttribute("data-lxbal",h.bal); c.classList.add("lxlt");
      if(row.parentNode)row.parentNode.replaceChild(c,row);
    });
    // "Combined · both chains" subtitle -> "Ranked by balance" (network is obvious; drop it)
    qa("*").forEach(function(e){ if(e.children.length)return; var t=e.textContent||""; if(t.indexOf("Combined")>=0&&t.indexOf("both chains")>=0)e.textContent=t.replace(/Combined[^]*?both chains/,"Ranked by balance"); });
    // "View full holder list →" -> the LUMOS asset (holders) on stellar.expert
    var vfl=qa("a,button").filter(function(e){return /holder list/i.test((e.textContent||""));})[0];
    if(vfl&&vfl.getAttribute("data-lxvf")!=="1"){ vfl.setAttribute("data-lxvf","1"); vfl.style.cursor="pointer";
      if(vfl.tagName==="A"){ vfl.setAttribute("href",EXPLORER); vfl.setAttribute("target","_blank"); vfl.setAttribute("rel","noopener"); }
      else { vfl.addEventListener("click",function(ev){ ev.preventDefault(); ev.stopPropagation(); window.open(EXPLORER,"_blank","noopener"); }); }
    }
  }
  function loadHolders(){
    if(window.__lxLThold||window.__lxLTholdLoading)return;
    // FAST PATH: reuse a recent cached holder list so repeat visits/refreshes are instant (paging all
    // ~1.5k accounts from Horizon takes ~5s — it can't sort by balance, so we must fetch every page).
    try{ var cc=JSON.parse(localStorage.getItem("lumos.lt.holders")||"null");
      if(cc&&cc.ts&&(Date.now()-cc.ts<18e5)&&cc.a&&cc.a.length){ window.__lxLThold=cc.a; guardApply(); return; } }catch(e){}
    window.__lxLTholdLoading=true;
    var acc=[];
    function finish(){ window.__lxLThold=acc.sort(function(x,y){return y.bal-x.bal;});
      try{ localStorage.setItem("lumos.lt.holders", JSON.stringify({ts:Date.now(), a:window.__lxLThold})); }catch(e){}
      guardApply(); }
    function page(url,depth){
      j(url).then(function(d){
        var recs=(d&&d._embedded&&d._embedded.records)||[];
        recs.forEach(function(a){ (a.balances||[]).forEach(function(bl){ if(bl.asset_code===CODE&&bl.asset_issuer===ISSUER)acc.push({addr:a.account_id||a.id,bal:+bl.balance}); }); });
        var next=d&&d._links&&d._links.next&&d._links.next.href;
        if(next&&recs.length&&depth<14){ page(next,depth+1); }
        else { finish(); }
      // AUDIT: a failure with nothing accumulated used to leave __lxLTholdLoading stuck true, which the
      // guard at the top of loadHolders() reads as "already running" — so the list could never be retried
      // for the rest of the session. Clear the flag so a later pass can have another go.
      }).catch(function(){ if(acc.length)finish(); else window.__lxLTholdLoading=false; });
    }
    page(H+"/accounts?asset="+CODE+":"+ISSUER+"&limit=200&order=desc",0);
  }
  // holders (balance > 0) vs trustlines (all accounts trusting LUMOS, incl. 0-balance).
  // AUDIT (numeric): the holders figure sat on "\\u2026" for ~29s and most visitors never saw a number.
  // It was derived purely from loadHolders(), which pages Horizon 9 times at ~3.5s a page because
  // /accounts cannot sort by balance. stellar.expert hands us the same figure in <0.5s:
  // trustlines = [total, authorized, FUNDED], and funded (balance > 0) is exactly "holders".
  // The Horizon paging still runs — the top-holders table and distribution need per-account balances —
  // but the COUNT no longer waits on it.
  function loadHolderCountFast(){
    if(window.__lxLThcFast!=null||window.__lxLThcFastTried)return; window.__lxLThcFastTried=true;
    j("https://api.stellar.expert/explorer/public/asset?search="+CODE+"&limit=20").then(function(d){
      var recs=(d&&d._embedded&&d._embedded.records)||[];
      var want=CODE+"-"+ISSUER;
      var hit=recs.filter(function(x){return String(x.asset||"").indexOf(want)===0;})[0];
      var tl=hit&&hit.trustlines;
      if(tl&&tl.length>=3&&+tl[2]>=0){ window.__lxLThcFast=+tl[2]; guardApply(); }
    }).catch(function(){});
  }
  // prefer the exact paged count once it lands; fall back to the fast funded-trustline count meanwhile
  function holderCount(){
    if(window.__lxLThold)return window.__lxLThold.filter(function(x){return x.bal>0;}).length;
    return (window.__lxLThcFast!=null)?window.__lxLThcFast:null;
  }
  // circulating supply = 10% of total (90% is locked forever — see SUPPLY_NOTE). Market cap uses THIS
  // (~1B), so it reads exactly 10x below the fully-diluted value (which uses the ~9.97B total).
  function circSupply(){ if(supply==null)return null;
    // HISTORY: 10B was minted when this was LumosDAO. Going multi-chain, 1B per chain is the clean
    // number, so 9B was locked on Stellar rather than reissued -- leaving 1B circulating of a 10B
    // total. That is a STELLAR fact. Every later chain issues 1B from day one, where circulating IS
    // the supply, so this multiplier must never follow the code to another issuer.
    return (ISSUER === "GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S") ? supply * 0.1 : supply; }

  // ---- Add-trustline: real MAINNET changeTrust via the connected wallet (mirrors the AMM signer) ----
  var WPASS_PUB="Public Global Stellar Network ; September 2015";
  var _ltsdk=null;
  function ltAddr(){ try{ return localStorage.getItem("lumos.address")||""; }catch(e){ return ""; } }
  // reuse the site's bottom-center toast (same one "Copy" uses) instead of a browser alert()
  // The phone build of this page ships the .toast CSS and the .check-ic mark but NOT the showToast
  // function that uses them -- that lives in the wallet page's own script. So the fallback here was
  // alert(), and the copy control ended up drawing its own little bubble instead. Build the design's
  // toast out of the classes the page already styles, so it is the same object either way: bottom
  // centre, green check, gone in two seconds.
  function ltToast(msg){
    try{ if(typeof window.showToast==="function"){ window.showToast(msg); return; } }catch(e){}
    try{
      var st=document.querySelector(".toast-stack");
      if(!st){ st=document.createElement("div"); st.className="toast-stack"; document.body.appendChild(st); }
      var t=document.createElement("div"); t.className="toast";
      t.innerHTML='<span class="check-ic"><svg width="10" height="10" viewBox="0 0 24 24" fill="none"'
        +' stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">'
        +'<polyline points="20 6 9 17 4 12"></polyline></svg></span>';
      t.appendChild(document.createTextNode(msg));
      st.appendChild(t);
      setTimeout(function(){ if(t.parentNode)t.parentNode.removeChild(t); },2200);
      return;
    }catch(e2){}
    try{ alert(msg); }catch(e3){}
  }
  function ltLoadSdk(){ if(window.StellarSdk)return Promise.resolve(window.StellarSdk); if(_ltsdk)return _ltsdk;
    _ltsdk=new Promise(function(res,rej){ var s=document.createElement("script"); s.src="https://cdn.jsdelivr.net/npm/@stellar/stellar-sdk@13.3.0/dist/stellar-sdk.min.js"; s.onload=function(){res(window.StellarSdk);}; s.onerror=function(){rej(new Error("SDK load failed"));}; document.head.appendChild(s); }); return _ltsdk; }
  // AUDIT (user-reported): this signed via Freighter unconditionally, so a Rabet user clicking Swap or
  // Add Liquidity on the LUMOS page got a FREIGHTER prompt — and because line ~600 installs this as the
  // global window.lxSign, it hijacked the shared Swap modal too. Same multi-wallet signer as the Trade
  // page (_dexassetdata.js), which had this exact bug fixed earlier.
  function ltWallet(){ try{ return (localStorage.getItem("lumos.wallet")||"freighter").toLowerCase(); }catch(_){ return "freighter"; } }
  // sign with the ACTUALLY-connected wallet (was hardcoded to Freighter -> Rabet users got a Freighter popup).
  function ltSign(xdr,addr){ var w=ltWallet();
    if(w==="rabet"){ if(!window.rabet||!window.rabet.sign)return Promise.reject(new Error("Rabet not found. Unlock the extension and retry.")); return Promise.resolve(window.rabet.sign(xdr,"mainnet")).then(function(r){ if(r&&r.error)throw new Error((r.error&&r.error.message)||r.error); var s=r&&(r.xdr||r.signedXDR); if(!s)throw new Error("Rabet did not return a signed transaction"); return s; }); }
    if(w==="xbull"){ var x=window.xBullSDK; if(!x||!x.signXDR)return Promise.reject(new Error("xBull not found. Unlock the extension and retry.")); return Promise.resolve(x.signXDR(xdr,{network:"PUBLIC",networkPassphrase:WPASS_PUB,publicKey:addr})).then(function(r){ var s=r&&(r.signedXDR||r.xdr||r); if(!s||typeof s!=="string")throw new Error("xBull did not return a signed transaction"); return s; }); }
    if(w==="albedo")return import("https://esm.sh/@albedo-link/intent@0.12.0").then(function(m){ var al=m.default||m.albedo||m; if(!al||!al.tx)throw new Error("Albedo SDK failed to load"); return al.tx({xdr:xdr,network:"public",pubkey:addr,submit:false}); }).then(function(r){ var s=r&&(r.signed_envelope_xdr||r.xdr); if(!s)throw new Error("Albedo did not return a signed transaction"); return s; });
    // A phone has no LOBSTR extension — that session signs over WalletConnect instead. Only true when
    // the connect step recorded transport=wc, so extension sessions still take the line below.
    if((w==="lobstr"||w==="walletconnect")&&window.__lxWcActive&&window.__lxWcActive())return window.__lxWcSign(xdr,WPASS_PUB);
    if(w==="lobstr")return import("https://esm.sh/@lobstrco/signer-extension-api").then(function(m){ var sign=m.signTransaction||(m.default&&m.default.signTransaction); if(!sign)throw new Error("LOBSTR API unavailable"); return sign(xdr); }).then(function(s){ if(!s||typeof s!=="string")throw new Error("LOBSTR couldn't sign \\u2014 unlock it, set to Mainnet, then retry."); return s; });
    // default: Freighter (requestAccess first so it's in the allow-list before signing)
    return (window.freighterApi&&window.freighterApi.signTransaction?Promise.resolve(window.freighterApi):import("https://esm.sh/@stellar/freighter-api@6").then(function(m){return m.default||m;}))
      .then(function(f){ return Promise.resolve(f.requestAccess?f.requestAccess():null).catch(function(){return null;})
        .then(function(){ return f.signTransaction(xdr,{networkPassphrase:WPASS_PUB,network:"PUBLIC",address:addr}); }); })
      .then(function(sig){ var s=(sig&&(sig.signedTxXdr||sig.signedXDR))||sig; if((sig&&sig.error)||typeof s!=="string")throw new Error("Signing cancelled."); return s; });
  }  function ltAddTrust(btn,onDone){
    var addr=ltAddr(); if(!addr){ ltToast("Connect a Stellar wallet first."); return; }
    if(btn){ btn.disabled=true; btn.setAttribute("data-lbl",btn.textContent); btn.textContent="Confirm in wallet…"; }
    var S;
    ltLoadSdk().then(function(sdk){ S=sdk; return j(H+"/accounts/"+addr); }).then(function(a){
      var tb=new S.TransactionBuilder(new S.Account(addr,a.sequence),{fee:"1000",networkPassphrase:WPASS_PUB});
      tb.addOperation(S.Operation.changeTrust({asset:new S.Asset(CODE,ISSUER)}));
      return ltSign(tb.setTimeout(180).build().toXDR(),addr);
    }).then(function(signed){
      return fetch(H+"/transactions",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"tx="+encodeURIComponent(signed)}).then(function(r){return r.json();});
    }).then(function(res){
      if(res&&res.successful){ window.__lxHasTrust=true; window.__lxWalletLoading=false; try{ loadWallet(); }catch(_){}
        if(onDone){ if(btn){ btn.disabled=false; btn.textContent=btn.getAttribute("data-lbl")||"Add Trustline"; } onDone(); }
        else if(btn&&btn.parentNode){ btn.parentNode.removeChild(btn); }
        ltToast("LUMOS trustline added."); guardApply(); }
      else { throw new Error((res&&res.extras&&res.extras.result_codes&&JSON.stringify(res.extras.result_codes))||"Transaction failed."); }
    }).catch(function(e){
      if(btn){ btn.disabled=false; btn.textContent=btn.getAttribute("data-lbl")||"Add trustline"; }
      ltToast("Could not add trustline — "+(e&&e.message||e));
    });
  }
  function ltCheckTrust(){
    var addr=ltAddr(); if(!addr){ window.__lxHasTrust=null; return; }
    // fast path: use the cached result so the Add-Trustline button doesn't pop in ~1s late on reload
    try{ var c=JSON.parse(localStorage.getItem("lumos.lt.trust."+addr)||"null"); if(c&&(Date.now()-c.ts<6e5))window.__lxHasTrust=c.has; }catch(e){}
    if(window.__lxTrustChecking)return; window.__lxTrustChecking=true;
    j(H+"/accounts/"+addr).then(function(a){
      window.__lxHasTrust=(a.balances||[]).some(function(b){return b.asset_code===CODE&&b.asset_issuer===ISSUER;});
      try{ localStorage.setItem("lumos.lt.trust."+addr, JSON.stringify({ts:Date.now(), has:window.__lxHasTrust})); }catch(e){}
      guardApply();
    }).catch(function(){ window.__lxHasTrust=null; });
  }

  // ================= Swap + Create-Pool wiring (mainnet, LUMOS-first) =================
  // The Swap modal (#modalSwap) is fully wired by _swapcalc.js (quote via Horizon strict-send + Soroswap,
  // real pathPaymentStrictSend execution, 2-step review) EXCEPT this page is missing (a) the signing/util
  // globals it reaches for at confirm time (window.lxStellar/lxSign/lxTimeout/lxToast) — so execution used
  // to bail with "Still loading balances" — and (b) the wallet holdings it reads for balances; and it
  // defaults To=USDC. We supply those globals from our own mainnet signer, load the wallet's balances into
  // the globals _swapcalc reads, and pre-select To=LUMOS on open. We do NOT re-implement the swap (that
  // would double-sign). The Create-Pool modal (#createPoolModal) is an un-wired shell, so we build it here.
  var USDC_ISSUER="GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
  function floor7(x){ return Math.floor((+x||0)*1e7)/1e7; }
  function fmtAmt(x){ x=+x||0; if(!isFinite(x))return "0"; if(x>=1000)return Math.round(x).toLocaleString("en-US"); if(x>=1)return (+x.toFixed(4)).toString(); if(x>0)return (+x.toPrecision(4)).toString(); return "0"; }
  function lumosBal(){ var h=(window.__lxHoldings||[]).filter(function(x){return x.code==="LUMOS";})[0]; return h?(+h.bal||0):0; }

  // Expose the signing/util globals _swapcalc.js expects (guarded: only if a real one isn't already set).
  function installSwapGlobals(){
    if(!window.__lxKnownSwap)window.__lxKnownSwap={};
    window.__lxKnownSwap.LUMOS=ISSUER;
    window.__lxLogos=window.__lxLogos||{}; if(!window.__lxLogos.LUMOS)window.__lxLogos.LUMOS=LOGO;
    if(xlmUsd>0&&window.__lxXlmUsd==null)window.__lxXlmUsd=xlmUsd;
    if(!window.lxStellar)window.lxStellar=function(){ return ltLoadSdk(); };
    if(!window.lxSign)window.lxSign=function(xdr,S){ return ltSign(xdr, ltAddr()); };
    if(!window.lxTimeout)window.lxTimeout=function(p,ms,msg){ return Promise.race([Promise.resolve(p), new Promise(function(_,rej){ setTimeout(function(){ rej(new Error(msg||"Timed out")); }, ms||120000); })]); };
    if(!window.lxToast)window.lxToast=function(m){ ltToast(m); };
  }

  // Load the connected wallet's balances into the globals _swapcalc reads (holdings / native / spendable)
  // and our own Create-Pool state. No-op without a connected address.
  function loadWallet(){
    var addr=ltAddr(); if(!addr||window.__lxWalletLoading)return; window.__lxWalletLoading=true;
    j(H+"/accounts/"+addr).then(function(a){
      var native=0, sub=+a.subentry_count||0, holdings=[], assets={};
      (a.balances||[]).forEach(function(b){
        if(b.asset_type==="native"){ native=+b.balance; holdings.push({code:"XLM",native:true,bal:+b.balance}); }
        else if(b.asset_code){ holdings.push({code:b.asset_code,iss:b.asset_issuer,native:false,bal:+b.balance}); window.__lxKnownSwap[b.asset_code]=b.asset_issuer; assets[b.asset_code]=b.asset_issuer; }
      });
      var reserve=(2+sub)*0.5, spend=Math.max(0, native-reserve-0.5);
      window.__lxNative=native; window.__lxMaxXLM=spend;
      if(!holdings.some(function(h){return h.code==="LUMOS";}))holdings.push({code:"LUMOS",iss:ISSUER,native:false,bal:0,logo:LOGO});
      window.__lxHoldings=holdings; window.__lxAssets=assets; window.__lxWallet=a;
      guardApply();
    }).catch(function(){ window.__lxWalletLoading=false; });
  }

  // ---- Swap: pre-select To = LUMOS (design/_swapcalc default is USDC). Poke _swapcalc's own chip state ----
  function preselectSwapTo(){
    var modal=q("#modalSwap"); if(!modal||!modal.classList.contains("open"))return;
    var fields=modal.querySelectorAll(".swap-pair .field"); if(fields.length<2)return;
    var toF=fields[1];
    if(toF.__lxasset&&toF.__lxasset.code==="LUMOS")return;
    var ap=toF.querySelector(".lx-swap-pick"); if(!ap)return;                       // _swapcalc's chip must exist
    // Preferred path: drive _swapcalc's OWN selection by clicking the LUMOS item in its picker menu — this
    // sets the asset, logo AND refreshes its private spotRate (so the rate readout is right), through its
    // own code. openSwapMenu builds synchronously, so open+click happen in one turn (no visible flash).
    try{
      ap.click();
      var menu=document.querySelector(".lx-asset-menu");
      if(menu){
        var lum=[].slice.call(menu.querySelectorAll(".lx-am-item")).filter(function(b){ var c=b.querySelector(".lx-am-code"); return c&&(c.textContent||"").trim()==="LUMOS"; })[0];
        if(lum){ lum.click(); if(menu.parentNode)menu.parentNode.removeChild(menu); return; }
        if(menu.parentNode)menu.parentNode.removeChild(menu);
      }
    }catch(_){}
    // Fallback: poke _swapcalc's chip state directly (used if the menu/holdings aren't ready yet).
    var h={code:"LUMOS",iss:ISSUER,native:false,bal:lumosBal(),logo:LOGO};
    var ic=ap.querySelector(".lx-ap-ico"); if(ic){ ic.style.setProperty("--lxlogo","url("+JSON.stringify(LOGO)+")"); ic.setAttribute("data-l",""); ic.innerHTML=""; }
    var cd=ap.querySelector(".lx-ap-code"); if(cd)cd.textContent="LUMOS";
    toF.__lxasset=h; toF.__lxsym="LUMOS"; window.__lxKnownSwap.LUMOS=ISSUER;
    var fi=fields[0].querySelector("input"); if(fi&&(fi.value||"").trim()){ try{ var ev=document.createEvent("Event"); ev.initEvent("input",true,true); fi.dispatchEvent(ev); }catch(_){} }
  }
  function wireSwapPreselect(){
    var modal=q("#modalSwap"); if(!modal||modal.__lxPre)return; modal.__lxPre=1;
    // retry across a wider window — _swapcalc's picker menu only appears once wallet holdings load, so a
    // single 150ms attempt can miss it. preselectSwapTo self-guards once To===LUMOS, so extra tries are free.
    function tries(){ [0,120,300,600,1000,1600,2400].forEach(function(d){ setTimeout(preselectSwapTo,d); }); }
    try{ var mo=new MutationObserver(function(){ if(modal.classList.contains("open"))tries(); });
      mo.observe(modal,{attributes:true,attributeFilter:["class"]}); }catch(_){}
    if(modal.classList.contains("open"))tries();
  }

  // ---- Create-Pool modal: full build (design shell). Asset 1 = LUMOS; Asset 2 chosen from XLM/USDC/held ----
  var CP_ISS={USDC:"GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",EURC:"GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2",AQUA:"GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",yXLM:"GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55"};
  var CP_URL={USDC:"https://assets.coingecko.com/coins/images/6319/small/usdc.png",EURC:"https://assets.coingecko.com/coins/images/26045/small/euro.png",AQUA:"https://aqua.network/assets/img/aqua-logo.png",yXLM:"https://assets.coingecko.com/coins/images/100/small/fmpFRHHQ_400x400.jpg"};
  function cpAvatar(code){ var c=String(code||"?"),h=0; for(var i=0;i<c.length;i++)h=(h*31+c.charCodeAt(i))%360;
    var t=c.replace(/[^A-Za-z0-9]/g,"").slice(0,2).toUpperCase()||"?";
    var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="hsl('+h+',60%,50%)"/><text x="20" y="26" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="15" fill="#fff">'+t+'</text></svg>';
    return "data:image/svg+xml,"+encodeURIComponent(svg); }
  function cpLogo(o){ if(!o)return "";
    if(o.code==="LUMOS")return LOGO;
    if(o.native||o.code==="XLM")return "assets/tokens/xlm.png";
    if(CP_URL[o.code] && CP_ISS[o.code] && o.iss===CP_ISS[o.code])return CP_URL[o.code];
    var c=(window.__lxLogosI||{})[o.code+"-"+(o.iss||"")]; if(c)return c;
    return ""; }
  var cpTried={};
  function cpFetchLogo(o,cb){ if(!o||!o.iss||o.native)return; var k=o.code+"-"+o.iss; if(cpTried[k]||cpLogo(o))return; cpTried[k]=1;
    j("https://api.stellar.expert/explorer/public/asset?search="+encodeURIComponent(o.code)+"&limit=20").then(function(d){
      var recs=(d&&d._embedded&&d._embedded.records)||[];
      var m=recs.filter(function(r){ return String(r.asset||"").indexOf(o.code+"-"+o.iss)===0; })[0];   // exact code+issuer only
      var ti=(m&&(m.tomlInfo||m.toml_info))||{}; var img=ti.image||"";
      if(!img)return; (window.__lxLogosI=window.__lxLogosI||{})[k]=img; if(cb)cb();
    }).catch(function(){});
  }
  function cpBal(a){ if(!a)return 0; if(a.native||a.code==="XLM")return (window.__lxNative!=null?window.__lxNative:0); var h=(window.__lxHoldings||[]).filter(function(x){return x.code===a.code&&!x.native;})[0]; return h?(+h.bal||0):0; }
  function cpSpend(a){ if(!a)return 0; if(a.native||a.code==="XLM")return (window.__lxMaxXLM!=null?window.__lxMaxXLM:cpBal(a)); return cpBal(a); }
  function cpIcoStyle(ico,a){ if(!ico)return; var u=a.logo||cpLogo(a)||cpAvatar(a.code);
    ico.textContent=""; ico.style.backgroundImage="url("+u+")"; ico.style.color="transparent";
    cpFetchLogo(a,function(){ var v=cpLogo(a); if(v)ico.style.backgroundImage="url("+v+")"; }); }
  function setCpPicker(f,a){ if(!f||!a)return; var p=f.querySelector(".asset-picker"); if(!p)return; p.classList.remove("placeholder");
    var ico=p.querySelector(".ap-ico"), nm=p.querySelector(".ap-name"); if(nm)nm.textContent=a.code; cpIcoStyle(ico,a);
    var bs=f.querySelector(".field-foot .balance strong"); if(bs){ bs.textContent=fmtAmt(cpBal(a))+" "+a.code; bs.style.color=""; } }
  function cpOptions(){ var opts=[{code:"XLM",native:true},{code:"USDC",iss:USDC_ISSUER,native:false}];
    (window.__lxHoldings||[]).forEach(function(h){ if(h.code==="LUMOS")return; if(opts.some(function(o){return o.code===h.code;}))return; opts.push({code:h.code,iss:h.iss,native:h.native,bal:h.bal}); }); return opts; }
  function openCpMenu(f,m,anchor){ var ex=document.querySelector(".lx-cpmenu"); if(ex){ ex.remove(); return; }
    var menu=document.createElement("div"); menu.className="lx-cpmenu";
    cpOptions().forEach(function(o){ var b=document.createElement("button"); b.type="button";
      var logo=cpLogo(o)||cpAvatar(o.code);
      b.innerHTML='<span class="lx-cpm-ic" style="background:transparent url('+logo+') center/cover no-repeat"></span><span>'+o.code+'</span><span class="lx-cpm-bal">'+fmtAmt(cpBal(o))+'</span>';
      cpFetchLogo(o,function(){ var ic=b.querySelector(".lx-cpm-ic"); var u=cpLogo(o); if(ic&&u)ic.style.background="transparent url("+u+") center/cover no-repeat"; });
      b.addEventListener("click",function(e){ e.preventDefault(); e.stopPropagation(); m.__a2=o; setCpPicker(f,o); cpLoadRatio(m,o); cpUpdate(m); menu.remove(); });
      menu.appendChild(b); });
    document.body.appendChild(menu); var r=anchor.getBoundingClientRect();
    menu.style.top=(r.bottom+6)+"px"; menu.style.left=Math.max(8,Math.min(r.left,window.innerWidth-220))+"px";
  }
  // reserves of an existing LUMOS/<other> pool, or null when the pair has no pool yet
  function cpLoadRatio(m,a2){
    m.__ratio=null; m.__ratioFor=null;
    if(!a2)return;
    var want=a2.native?"native":(a2.code+":"+a2.iss);
    j(H+"/liquidity_pools?reserves="+CODE+":"+ISSUER+"&limit=200").then(function(d){
      var recs=(d&&d._embedded&&d._embedded.records)||[];
      var hit=null;
      recs.forEach(function(p){ var rs=p.reserves||[]; if(rs.length!==2)return;
        var hasL=rs.some(function(r){ return r.asset===CODE+":"+ISSUER; });
        var hasO=rs.some(function(r){ return r.asset===want; });
        if(hasL&&hasO)hit=p; });
      if(!hit)return;
      var lr=+(hit.reserves.filter(function(r){return r.asset===CODE+":"+ISSUER;})[0]||{}).amount||0;
      var or=+(hit.reserves.filter(function(r){return r.asset===want;})[0]||{}).amount||0;
      if(lr>0&&or>0){ m.__ratio=or/lr; m.__ratioFor=want; try{ cpSyncFrom(m,1); }catch(_){} }
    }).catch(function(){});
  }
  // side: 1 = user typed in Asset 1, 2 = user typed in Asset 2. Programmatic .value writes do not fire
  // "input", so mirroring cannot loop.
  function cpSyncFrom(m,side){
    if(!m.__ratio)return; var f=m.querySelectorAll(".asset-field"); if(f.length<2)return;
    var in1=f[0].querySelector(".asset-amt"), in2=f[1].querySelector(".asset-amt");
    if(!in1||!in2)return;
    if(side===1){ var v1=parseFloat((in1.value||"").replace(/,/g,"")); in2.value=(v1>0)?floor7(v1*m.__ratio):""; }
    else { var v2=parseFloat((in2.value||"").replace(/,/g,"")); in1.value=(v2>0)?floor7(v2/m.__ratio):""; }
  }
  function cpUpdate(m){ var f=m.querySelectorAll(".asset-field"); if(f.length<2)return;
    var in1=f[0].querySelector(".asset-amt"), in2=f[1].querySelector(".asset-amt");
    var a1=m.__a1,a2=m.__a2;
    var v1=parseFloat(((in1||{}).value||"").replace(/,/g,""))||0, v2=parseFloat(((in2||{}).value||"").replace(/,/g,""))||0;
    var prow=null; qa("#createPoolModal .pool-summary .row").forEach(function(r){ if(/initial pool price/i.test(r.textContent||""))prow=r; });
    var ps=prow?prow.querySelector("strong"):null;
    if(ps)ps.textContent=(v1>0&&v2>0&&a2)?("1 "+a1.code+" ≈ "+fmtAmt(v2/v1)+" "+a2.code):"—";
    var ok=!!(a1&&a2&&v1>0&&v2>0&&a1.code!==a2.code&&ltAddr());
    if(m.__cpbtn)m.__cpbtn.disabled=!ok;
  }
  function wireCreatePool(){ var m=q("#createPoolModal"); if(!m||m.__lxcp)return; var f=m.querySelectorAll(".asset-field"); if(f.length<2)return; m.__lxcp=1;
    m.__a1={code:"LUMOS",iss:ISSUER,native:false,logo:LOGO}; m.__a2=null;
    setCpPicker(f[0], m.__a1);
    var p1=f[0].querySelector(".asset-picker"); if(p1)p1.addEventListener("click",function(e){ e.preventDefault(); e.stopPropagation(); });   // Asset 1 locked to LUMOS
    var p2=f[1].querySelector(".asset-picker"); if(p2)p2.addEventListener("click",function(e){ e.preventDefault(); e.stopPropagation(); openCpMenu(f[1],m,p2); });
    var in1=f[0].querySelector(".asset-amt"), in2=f[1].querySelector(".asset-amt");
    if(in1)in1.addEventListener("input",function(){ cpSyncFrom(m,1); cpUpdate(m); });
    if(in2)in2.addEventListener("input",function(){ cpSyncFrom(m,2); cpUpdate(m); });
    var mx1=f[0].querySelector(".max-btn"); if(mx1)mx1.addEventListener("click",function(e){ e.preventDefault(); e.stopPropagation(); var b=cpSpend(m.__a1); if(b>0&&in1){ in1.value=floor7(b); cpSyncFrom(m,1); cpUpdate(m); } });
    var mx2=f[1].querySelector(".max-btn"); if(mx2)mx2.addEventListener("click",function(e){ e.preventDefault(); e.stopPropagation(); if(!m.__a2)return; var b=cpSpend(m.__a2); if(b>0&&in2){ in2.value=floor7(b); cpSyncFrom(m,2); cpUpdate(m); } });
    var btn=m.querySelector(".modal-foot .btn-primary"); m.__cpbtn=btn;
    if(btn)btn.addEventListener("click",function(e){ e.preventDefault(); e.stopPropagation(); if(btn.disabled)return; cpExecute(m,btn); });
    if(!window.__lxCpMenuWired){ window.__lxCpMenuWired=1; document.addEventListener("click",function(e){ if(!(e.target.closest&&(e.target.closest(".lx-cpmenu")||e.target.closest(".asset-picker")))){ var mm=document.querySelector(".lx-cpmenu"); if(mm)mm.remove(); } },true); }
    cpUpdate(m);
  }
  function cpRefresh(m){ if(!m||!m.__lxcp)return; var f=m.querySelectorAll(".asset-field"); if(f.length<2)return; if(m.__a1)setCpPicker(f[0],m.__a1); if(m.__a2)setCpPicker(f[1],m.__a2); }
  function cpDefaultCompare(A,B){ if(A.isNative())return B.isNative()?0:-1; if(B.isNative())return 1; if(A.getCode()!==B.getCode())return A.getCode()<B.getCode()?-1:1; return A.getIssuer()<B.getIssuer()?-1:(A.getIssuer()>B.getIssuer()?1:0); }
  // Build the create-pool tx (changeTrusts for the two assets + the pool-share asset, then liquidityPoolDeposit).
  // Returns {tx,xdr,poolId,pair}. Exposed for debug/verification (build without signing).
  function cpBuildTx(m){ var addr=ltAddr(); if(!addr)return Promise.reject(new Error("No wallet connected"));
    var f=m.querySelectorAll(".asset-field");
    var v1=parseFloat(((f[0].querySelector(".asset-amt")||{}).value||"").replace(/,/g,""))||0;
    var v2=parseFloat(((f[1].querySelector(".asset-amt")||{}).value||"").replace(/,/g,""))||0;
    var a1=m.__a1,a2=m.__a2;
    if(!(v1>0&&v2>0&&a2))return Promise.reject(new Error("Enter amounts for both assets"));
    var S;
    return ltLoadSdk().then(function(sdk){ S=sdk; return j(H+"/accounts/"+addr); }).then(function(acc){
      var A1=(a1.native||a1.code==="XLM")?S.Asset.native():new S.Asset(a1.code,a1.iss);
      var A2=(a2.native||a2.code==="XLM")?S.Asset.native():new S.Asset(a2.code,a2.iss);
      var cmp=(S.Asset&&S.Asset.compare)?S.Asset.compare(A1,A2):cpDefaultCompare(A1,A2);
      var assetA,assetB,amtA,amtB;
      if(cmp<=0){ assetA=A1;assetB=A2;amtA=v1;amtB=v2; } else { assetA=A2;assetB=A1;amtA=v2;amtB=v1; }
      var share=new S.LiquidityPoolAsset(assetA,assetB,S.LiquidityPoolFeeV18);
      var poolId=S.getLiquidityPoolId("constant_product",share.getLiquidityPoolParameters()).toString("hex");
      var have=acc.balances||[];
      function isTrusted(as){ if(as.isNative())return true; return have.some(function(b){return b.asset_code===as.getCode()&&b.asset_issuer===as.getIssuer();}); }
      var hasShare=have.some(function(b){return b.asset_type==="liquidity_pool_shares"&&b.liquidity_pool_id===poolId;});
      var tb=new S.TransactionBuilder(new S.Account(addr,acc.sequence),{fee:"10000",networkPassphrase:WPASS_PUB});
      if(!isTrusted(assetA))tb.addOperation(S.Operation.changeTrust({asset:assetA}));
      if(!isTrusted(assetB))tb.addOperation(S.Operation.changeTrust({asset:assetB}));
      if(!hasShare)tb.addOperation(S.Operation.changeTrust({asset:share}));
      var price=amtA/amtB;
      tb.addOperation(S.Operation.liquidityPoolDeposit({liquidityPoolId:poolId,maxAmountA:amtA.toFixed(7),maxAmountB:amtB.toFixed(7),minPrice:(price*0.98).toFixed(7),maxPrice:(price*1.02).toFixed(7)}));
      var tx=tb.setTimeout(180).build();
      return {tx:tx,xdr:tx.toXDR(),poolId:poolId,pair:a1.code+" / "+a2.code};
    });
  }
  function cpExecute(m,btn){ var addr=ltAddr(); if(!addr){ ltToast("Connect a Stellar wallet first."); return; }
    var ot=btn.textContent; btn.disabled=true; btn.textContent="Confirm in wallet…";
    cpBuildTx(m).then(function(built){ return ltSign(built.xdr,addr).then(function(signed){
        return fetch(H+"/transactions",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"tx="+encodeURIComponent(signed)}).then(function(r){return r.json();}).then(function(res){ return {res:res,pair:built.pair}; }); });
    }).then(function(o){ var res=o.res;
      if(res&&res.successful){ btn.textContent="Pool created"; window.__lxWalletLoading=false; try{ loadWallet(); }catch(_){}
        ltToast("Liquidity added to the "+o.pair+" pool."); setTimeout(function(){ var cl=m.querySelector(".modal-close,[data-close]"); if(cl)cl.click(); btn.disabled=false; btn.textContent=ot; },1500); }
      else { throw new Error((res&&res.extras&&res.extras.result_codes&&JSON.stringify(res.extras.result_codes))||"Transaction failed."); }
    }).catch(function(e){ btn.disabled=false; btn.textContent=ot; ltToast("Could not create pool — "+(e&&e.message||e)); });
  }
  // ---- Trustline gate ("LUMOS trustline required" banner in both modals): wire its button + toggle it ----
  function wireTrustGates(){ qa(".trustline-gate").forEach(function(g){
      // The swap adds the trustline itself as its first step (_swapcalc signs a changeTrust before
      // the path payment), so announcing it here read as a prerequisite the user had to clear before he
      // was allowed to trade -- a barrier in front of a door that is already open. Hidden in the swap
      // modal only; other modals keep it, because they have no such step and do need it first.
      if(g.closest&&g.closest("#swapModal,#modalSwap")){ g.style.display="none"; return; }
      if(window.__lxHasTrust===true)g.style.display="none"; else if(window.__lxHasTrust===false)g.style.display="";
      var b=g.querySelector("[data-tl-add]"); if(b&&!b.__lxtg){ b.__lxtg=1; b.addEventListener("click",function(e){ e.preventDefault(); e.stopPropagation(); ltAddTrust(b,function(){ g.style.display="none"; }); }); }
    }); }

  // ---- Price chart: single real LUMOS line (LUMOS/XLM trade aggregations, priced to USD) ----
  // The design draws a two-network comparison into #priceChart svg; we replace it with one LUMOS line.
  var chartTF="7D", chartPts=null, chartWired=false;
  function tfCfg(tf){ var m={"1H":{res:60000,span:3600000},"24H":{res:900000,span:86400000},"7D":{res:3600000,span:604800000},"30D":{res:86400000,span:2592000000},"1Y":{res:604800000,span:31536000000},"All":{res:604800000,span:157680000000}}; return m[tf]||m["7D"]; }
  function axisLbl(t,tf){ var d=new Date(t),mo=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; if(tf==="1H"||tf==="24H")return (d.getHours()<10?"0":"")+d.getHours()+":00"; if(tf==="1Y"||tf==="All")return mo[d.getMonth()]+" '"+String(d.getFullYear()).slice(2); return mo[d.getMonth()]+" "+d.getDate(); }
  function drawChart(pts){
    var pc=q("#priceChart"); if(!pc)return; var svg=pc.querySelector("svg");
    if(!svg){
      // The phone build ships this container empty -- there is no design chart here to replace, so
      // make the canvas rather than giving up on it. Same viewBox the draw code below assumes.
      svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
      svg.setAttribute("viewBox","0 0 1000 320");
      svg.setAttribute("preserveAspectRatio","none");
      svg.style.width="100%"; svg.style.height="100%"; svg.style.display="block";
      pc.appendChild(svg);
    }
    if(!pts||pts.length<2){ return; }
    var W=1000,H=320,PAD=26,n=pts.length;
    // winsorize to the 5th–95th percentile — LUMOS/XLM is thin, so a couple of bad-fill trades otherwise
    // dominate the y-scale and the line collapses to spikes.
    var sorted=pts.map(function(p){return p.v;}).slice().sort(function(a,b){return a-b;});
    var lo=sorted[Math.floor(sorted.length*0.05)]||sorted[0], hi=sorted[Math.ceil(sorted.length*0.95)-1]||sorted[sorted.length-1];
    var cl=pts.map(function(p){return Math.max(lo,Math.min(hi,p.v));});
    var mn=Math.min.apply(null,cl),mx=Math.max.apply(null,cl),rg=(mx-mn)||(mx||1);
    var co=cl.map(function(v,i){return [(i/(n-1))*W, H-PAD-((v-mn)/rg)*(H-2*PAD)];});
    var ln="M"+co.map(function(c){return c[0].toFixed(1)+" "+c[1].toFixed(1);}).join(" L");
    var ar=ln+" L "+W+" "+H+" L 0 "+H+" Z";
    // The coordinates above are built in a W x H (1000 x 320) space, but the svg keeps the design's
    // baked viewBox="0 0 700 200" unless we say otherwise — so every point below y=200 was drawn
    // outside the viewBox and, with overflow visible, spilled over the date row and out of the card.
    // PAD=26 puts the lowest price at y=294, which is exactly the constant seen in the clipped output.
    // Match the viewBox to the space the path is actually drawn in; preserveAspectRatio="none" then
    // stretches it to the element box, so the curve fills the chart instead of hanging out of it.
    svg.setAttribute("viewBox","0 0 "+W+" "+H);
    svg.setAttribute("preserveAspectRatio","none");
    svg.innerHTML='<defs><linearGradient id="gradAptos" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#ea6a2c" stop-opacity="0.20"></stop><stop offset="100%" stop-color="#ea6a2c" stop-opacity="0"></stop></linearGradient></defs>'
      +'<path class="lx-carea" d="'+ar+'"></path><path class="lx-cline" d="'+ln+'"></path>';
    var a=svg.querySelector(".lx-carea"); if(a){a.setAttribute("fill","url(#gradAptos)");}
    var l=svg.querySelector(".lx-cline"); if(l){l.setAttribute("fill","none");l.setAttribute("stroke","#ea6a2c");l.setAttribute("stroke-width","2.5");l.setAttribute("stroke-linecap","round");l.setAttribute("stroke-linejoin","round");}
    // x-axis date labels as an HTML row (SVG text would be squished by preserveAspectRatio=none)
    var dr=pc.querySelector(".lx-cdates"); if(!dr){ dr=document.createElement("div"); dr.className="lx-cdates"; pc.appendChild(dr); }
    var NL=5, h="";
    for(var qi=0;qi<NL;qi++){ var idx=Math.round(qi/(NL-1)*(n-1)); h+='<span>'+(qi===NL-1?"Today":axisLbl(pts[idx].t,chartTF))+'</span>'; }
    dr.innerHTML=h;
    pc.classList.add("lxlt"); chartPts=pts;
    pc.__lxpts=pts; pc.__lxco=co;   // current series for the hover readout
    setupChartHover(pc, svg);
    updateChartLegend();
  }
  // full date/time for the hover tooltip
  function fullDate(t){ var d=new Date(t), mo=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; var hm=(chartTF==="1H"||chartTF==="24H")?(", "+(d.getHours()<10?"0":"")+d.getHours()+":"+(d.getMinutes()<10?"0":"")+d.getMinutes()):""; return mo[d.getMonth()]+" "+d.getDate()+hm; }
  // hover readout: crosshair + dot on the line + a tooltip with date / price / 24h vol. Attached once;
  // the handler reads pc.__lxpts / pc.__lxco so it stays correct after a timeframe change.
  function setupChartHover(pc, svg){
    var W=1000, HH=320;
    var tip=pc.querySelector(".lx-chtip"); if(!tip){ tip=document.createElement("div"); tip.className="lx-chtip"; pc.appendChild(tip); }
    var dot=pc.querySelector(".lx-chdot"); if(!dot){ dot=document.createElement("div"); dot.className="lx-chdot"; pc.appendChild(dot); }
    var vl=pc.querySelector(".lx-chvl"); if(!vl){ vl=document.createElement("div"); vl.className="lx-chvl"; pc.appendChild(vl); }
    if(pc.__lxHoverWired)return; pc.__lxHoverWired=1;
    // re-query svg + overlay nodes on every event — the design re-creates #priceChart's children on a
    // timeframe switch, so a closure over the original nodes would silently update detached elements.
    function move(e){
      var pts=pc.__lxpts, co=pc.__lxco; if(!pts||!co||pts.length<2)return;
      var svg=pc.querySelector("svg"), tip=pc.querySelector(".lx-chtip"), dot=pc.querySelector(".lx-chdot"), vl=pc.querySelector(".lx-chvl");
      if(!svg||!tip||!dot||!vl)return;
      var r=svg.getBoundingClientRect(), pr=pc.getBoundingClientRect();
      var relX=e.clientX-r.left; if(relX<0)relX=0; if(relX>r.width)relX=r.width;
      var idx=Math.round(relX/r.width*(pts.length-1)); idx=Math.max(0,Math.min(pts.length-1,idx));
      var p=pts[idx], ox=r.left-pr.left, oy=r.top-pr.top;
      var sx=ox+co[idx][0]/W*r.width, sy=oy+co[idx][1]/HH*r.height;
      dot.style.left=sx+"px"; dot.style.top=sy+"px"; dot.style.opacity=1;
      vl.style.left=sx+"px"; vl.style.top=oy+"px"; vl.style.height=r.height+"px"; vl.style.opacity=1;
      tip.innerHTML='<div class="d">'+fullDate(p.t)+'</div><div class="p">'+usd(p.v)+'</div><div class="v">Vol '+(p.vol>=0.01?abbrUsd(p.vol):"&lt;$0.01")+'</div>';
      tip.style.opacity=1;
      var tw=tip.offsetWidth, th=tip.offsetHeight, tx=sx+14; if(tx+tw>pr.width)tx=sx-tw-14; if(tx<2)tx=2;
      tip.style.left=tx+"px"; tip.style.top=Math.max(2,sy-th-12)+"px";
    }
    function leave(){ ["lx-chtip","lx-chdot","lx-chvl"].forEach(function(c){ var el=pc.querySelector("."+c); if(el)el.style.opacity=0; }); }
    pc.addEventListener("mousemove",move); pc.addEventListener("mouseleave",leave);
  }
  function updateChartLegend(){
    var priceUsd=lumosXlm*xlmUsd; if(!(priceUsd>0))return; var mc=supply*priceUsd;
    setText(q("#ctPriceAptos"), usd(priceUsd)); setText(q("#ctMcAptos"), "MC "+abbrUsd(mc));
    // single-network: blank the 2nd (Xrpl) legend entry + its label
    setText(q("#ctPriceXrpl"),""); setText(q("#ctMcXrpl"),"");
    qa(".ct-net, .cc-legend .nm, .ct-name").forEach(function(e){ var t=(e.textContent||""); if(/Xrpl|XRPL/i.test(t)||/Stellar/.test(t)){} });
  }
  // #2: this drew nothing until the XLM price landed, and then never tried again -- which is what
  // "the chart takes forever" was. Every point is multiplied by xlmUsd to put it in dollars, so with
  // xlmUsd still 0 every value came out 0, the filter below dropped all of them, pts.length fell under
  // 2 and the function returned having drawn nothing. Nothing re-ran it except a manual timeframe tap.
  //
  // The records are kept now, so the redraw costs no request, and the draw is retried until there is a
  // rate to draw with.
  var _chartRecs=null, _chartWait=0;
  function drawFromRecs(){
    if(!_chartRecs||!_chartRecs.length)return false;
    if(!(xlmUsd>0))return false;
    var pts=_chartRecs.map(function(x){return {t:+x.timestamp, v:(+x.avg||+x.close||0)*xlmUsd,
      vol:(+x.counter_volume||0)*xlmUsd, tr:(+x.trade_count||0)};}).filter(function(p){return p.v>0;});
    if(pts.length<2)return false;
    drawChart(pts); return true;
  }
  function loadChart(tf){
    chartTF=tf; var cfg=tfCfg(tf), now=Date.now(), start=now-cfg.span;
    var url=H+"/trade_aggregations?base_asset_type=credit_alphanum12&base_asset_code="+CODE+"&base_asset_issuer="+ISSUER+"&counter_asset_type=native&resolution="+cfg.res+"&start_time="+start+"&end_time="+now+"&order=asc&limit=200";
    j(url).then(function(d){
      var r=(d&&d._embedded&&d._embedded.records)||[];
      _chartRecs=r;
      // If the rate is not in yet, wait for it rather than silently giving up. Bounded, so a page that
      // never gets a price stops asking instead of spinning for the whole session.
      if(!drawFromRecs()&&r.length>=2&&!_chartWait){
        _chartWait=1;
        var n=0,iv=setInterval(function(){ if(drawFromRecs()||++n>60){ clearInterval(iv); _chartWait=0; } },200);
      }
    }).catch(function(){});
  }
  function wireChartTabs(){
    if(chartWired)return; var btns=qa("button").filter(function(b){return /^(1H|24H|7D|30D|1Y|All)$/.test((b.textContent||"").trim());});
    if(btns.length<3)return; chartWired=true;
    btns.forEach(function(b){ b.addEventListener("click",function(){ btns.forEach(function(x){x.classList.remove("active");}); b.classList.add("active"); loadChart((b.textContent||"").trim()); }); });
  }

  // tab-button counts e.g. "Pools (58)" / "Holders (1,441)" — set a data-count attr (CSS ::after renders
  // it) so the tab's own text node stays "Pools"/"Holders" and the design's tab-switch handler still keys off it.
  function applyTabs(){
    qa(".lt-tab").forEach(function(t){
      var txt=(t.textContent||"").trim();
      if(/^Pools$/i.test(txt)){ if(poolCount!=null)t.setAttribute("data-count","("+poolCount+")"); }
      else if(/^Holders$/i.test(txt)){ var hc=holderCount(); if(hc!=null)t.setAttribute("data-count","("+num(hc)+")"); }
    });
  }
  // top-holder USD depends on price, which may arrive AFTER the rows are built (esp. on the instant
  // cache path). The per-row build guard blocks a re-render, so refresh just the $ here every tick.
  function updateHolderUsd(){ var p=lumosXlm*xlmUsd; if(!(p>0))return; qa(".holder-row[data-lxbal]").forEach(function(r){ var bal=+r.getAttribute("data-lxbal"); var mm=r.querySelector(".holdings .lc-money"); if(mm){ var u=abbrUsd(bal*p); if(mm.getAttribute("data-orig")!==u){ mm.textContent=u; mm.setAttribute("data-orig",u); mm.setAttribute("data-usd",bal*p); } } }); }
  // Create-Pool modal: drop the "Trading fee 0.5%" row (per request). Idempotent.
  function polishModals(){ qa("#createPoolModal .row").forEach(function(r){ if(r.getAttribute("data-lxhid")!=="1"&&/Trading fee/i.test(r.textContent||"")){ r.setAttribute("data-lxhid","1"); r.style.display="none"; } }); }
  function applyAll(){ if(vol24Xlm!=null&&xlmUsd)vol24Usd=vol24Xlm*xlmUsd; try{ applyHero(); }catch(_){} try{ applyStats(); }catch(_){} try{ applyOverview(); }catch(_){} try{ applyTabs(); }catch(_){} try{ buildPoolsTable(); }catch(_){} try{ repaintPoolIcons(); }catch(_){} try{ fixAllocation(); }catch(_){} try{ setModalLogos(); }catch(_){} try{ applyHolders(); }catch(_){} try{ updateHolderUsd(); }catch(_){} try{ polishModals(); }catch(_){} try{ wireChartTabs(); }catch(_){} try{ var pc=q("#priceChart"); if(pc&&chartPts&&!pc.querySelector(".lx-cline"))drawChart(chartPts); }catch(_){} try{ fixAbout(); }catch(_){} try{ installSwapGlobals(); }catch(_){} try{ wireSwapPreselect(); }catch(_){} try{ var cpm=q("#createPoolModal"); if(cpm){ wireCreatePool(); cpRefresh(cpm); } }catch(_){} try{ wireTrustGates(); }catch(_){} }

  function loadData(){
    // XLM price (USD)
    // Our own edge, Horizon-backed and cached, for the reason recorded in functions/lxapi/xlm.js:
    // CoinGecko refuses datacenter egress and rate-limits everyone else, and this page cannot draw its
    // chart at all until the XLM price arrives.
    j("/lxapi/xlm").then(function(d){
      xlmUsd=(d&&+d.usd)||xlmUsd; if(xlmUsd>0){ window.__lxXlmUsd=xlmUsd; try{ localStorage.setItem("lumos.xlmUsd",JSON.stringify({v:xlmUsd,ts:Date.now()})); }catch(_e){} } applyAll(); try{ drawFromRecs(); }catch(_){}   // redraw, not refetch: the records are already in hand
    }).catch(function(){});
    // LUMOS/XLM daily closes (spot price + 24h change + 24h volume) via trade aggregations
    var ta="https://horizon.stellar.org/trade_aggregations?base_asset_type=credit_alphanum12&base_asset_code="+CODE+"&base_asset_issuer="+ISSUER+"&counter_asset_type=native&resolution=86400000&order=desc&limit=2";
    j(ta).then(function(d){
      var r=(d&&d._embedded&&d._embedded.records)||[];
      if(r[0])lumosXlm=+r[0].close||+r[0].avg||lumosXlm;
      if(r[0])vol24Xlm=+r[0].counter_volume||0;                              // XLM traded in the LUMOS/XLM market (24h)
      if(r[0]&&r[1]&&+r[1].close>0)chg24=((+r[0].close-+r[1].close)/+r[1].close)*100;
      if(r[0]&&r[1]&&+r[1].counter_volume>0)volChg=((+r[0].counter_volume-+r[1].counter_volume)/+r[1].counter_volume)*100;
      applyAll();
    }).catch(function(){});
    // Asset record: circulating supply (balances.authorized) + holder count (accounts.authorized)
    j("https://horizon.stellar.org/assets?asset_code="+CODE+"&asset_issuer="+ISSUER).then(function(d){
      var rec=(d&&d._embedded&&d._embedded.records&&d._embedded.records[0])||null; if(!rec)return;
      if(rec.balances)supply=+rec.balances.authorized||+rec.balances.authorized_to_maintain_liabilities||supply;
      else if(rec.amount)supply=+rec.amount;
      if(rec.accounts)holders=(+rec.accounts.authorized||0)+(+rec.accounts.authorized_to_maintain_liabilities||0);
      else if(rec.num_accounts!=null)holders=+rec.num_accounts;
      applyAll();
    }).catch(function(){});
    // LUMOS liquidity pools: total count + active (has LUMOS liquidity)
    j("https://horizon.stellar.org/liquidity_pools?reserves="+CODE+":"+ISSUER+"&limit=200").then(function(d){
      var r=(d&&d._embedded&&d._embedded.records)||[];
      poolCount=r.length;
      activePools=r.filter(function(p){ return (p.reserves||[]).some(function(rv){ return rv.asset.indexOf(CODE+":"+ISSUER)===0 && +rv.amount>0; }); }).length;
      window.__lxLTpools=r;                                                   // cached for the Pools table
      applyAll();
    }).catch(function(){});
    loadHolderCountFast();                                                    // <0.5s holders COUNT (stellar.expert)
    loadHolders();                                                            // paged holder list -> breakdown + top holders
    // re-apply asset logos shortly after a Swap/Create-Pool modal opens (covers opens after the boot interval ends)
    if(!window.__lxModalLogoHook){ window.__lxModalLogoHook=1; document.addEventListener("click",function(e){ var t=e.target; var hit=t&&t.closest&&(t.closest('[data-open-modal="modalSwap"],[data-open-modal="createPoolModal"]')||t.closest("#modalSwap,#createPoolModal,.lx-cpmenu,.lx-asset-menu")); if(hit)[60,200,450,900,1500].forEach(function(d){setTimeout(function(){try{setModalLogos();}catch(_){}},d);}); },true); }
    ltCheckTrust();                                                           // connected wallet: has LUMOS trustline? -> Add-trustline button
    loadWallet();                                                             // connected wallet balances -> swap/pool balances + _swapcalc globals
  }

  // Debounced + self-guarded re-assert: the design animates the chart continuously, so a raw
  // characterData/subtree observer fires every frame and saturates the CPU. We watch only childList,
  // debounce to ~200ms, and DISCONNECT while we write so our own edits never retrigger the observer.
  var obs=null, sched=false;
  function reobserve(){ try{ if(obs){ var root=q("main")||document.body; if(root)obs.observe(root,{childList:true,subtree:true}); } }catch(_){} }
  function guardApply(){ if(obs)obs.disconnect(); try{ applyAll(); }catch(_){} reobserve(); }
  function schedule(){ if(sched)return; sched=true; setTimeout(function(){ sched=false; guardApply(); },200); }
  window.__lxLTapply=guardApply;
  window.__lxLTdbg=function(){return {xlmUsd:xlmUsd,lumosXlm:lumosXlm,supply:supply,holders:holders,poolCount:poolCount,vol24Xlm:vol24Xlm,chg24:chg24};};
  function boot(){
    try{ installSwapGlobals(); }catch(_){}                // expose signing/util globals for _swapcalc before any confirm
    // prime the cached trustline result BEFORE the first paint so the Add-Trustline button shows instantly
    try{ var _a=ltAddr(); if(_a){ var _c=JSON.parse(localStorage.getItem("lumos.lt.trust."+_a)||"null"); if(_c&&(Date.now()-_c.ts<6e5))window.__lxHasTrust=_c.has; } }catch(_){}
    guardApply();                                        // paint whatever we have (fast)
    // The chart's own fetch, started HERE and not inside loadData's price handler.
    //
    // My previous pass replaced the old loadChart(chartTF) in that handler with a redraw, to stop it
    // re-fetching records it already had -- but that call was also the only thing that ever STARTED the
    // chart. Nothing else calls loadChart except a timeframe button, so a page nobody tapped drew
    // nothing at all: an empty card with 7D highlighted, for ever. That is the "still taking forever".
    //
    // Starting it here is also strictly faster than where it used to live: the Horizon aggregation and
    // the XLM price now go out together instead of the chart queueing behind the price, and whichever
    // lands second calls drawFromRecs.
    try{ loadChart(chartTF); }catch(_){}
    loadData();
    try{ obs=new MutationObserver(schedule); reobserve(); }catch(_){}
    // Bounded re-assert: fetch + design-render timing varies, so re-apply every 700ms for ~21s. Values
    // persist once set (the design doesn't overwrite), so this reliably lands real data without a
    // permanent interval. The observer still catches any later structural re-render.
    var ticks=0, iv=setInterval(function(){ guardApply(); if(++ticks>30)clearInterval(iv); },700);
  }
  if(document.readyState!=="loading")boot();
  else document.addEventListener("DOMContentLoaded",boot);
})();<\/script>`;

// ---- inject into every container that has the lumos-token keys ----
const files = fs.readdirSync('.').filter(f => /^lumoscore-.*-(desktop|mobile)\.html$/.test(f));
let n = 0, containers = 0;
for (const file of files) {
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;
  for (const k of KEYS) {
    if (!json[k]) continue;
    let p = json[k];
    p = p.replace(/<style id="lx-lt-css">[\s\S]*?<\/style>/, '')
         .replace(/<script id="lx-ltdata">[\s\S]*?<\/script>/, '');
    // AUDIT (flash sweep): the supply-distribution subheading ships as "...fixed supply on Aptos." and is
    // corrected to Stellar at runtime — a visible wrong-chain flash on our own token page. Fix the source
    // text so there is nothing to correct. Idempotent: after one pass the Aptos wording is gone.
    p = p.split('fixed supply on Aptos.').join('fixed supply on Stellar.');
    // #11: what the Market Reserve is FOR. The shipped sentence led with a 150M public sell order, which
    // is the one detail a reader of a token page is primed to read as an overhang -- and it left out the
    // thing the reserve actually does, which is deepen the pools LUMOS trades in. Liquidity leads; the
    // order book is named once, in passing. No split is claimed, because the split is not a fact this
    // page can show. Idempotent: after one pass neither original sentence is present.
    const RESV_NEW = 'The 300M <strong>Market Reserve</strong> is put to work gradually: it is added, a '
      + 'little at a time, to LUMOS liquidity on Stellar — the LUMOS/XLM pool and the other LUMOS '
      + 'pairs — with a portion resting on the order book for price discovery.';
    // The phone ships a SHORTER version of the same sentence -- no "working treasury" clause -- so a
    // single replacement fixed the desktop and left the phone quoting the sell order it was written to
    // stop leading with. Both forms, both chain spellings.
    const RESV_OLD = [
      'Of the 300M <strong>Market Reserve</strong>, 150M is committed to a public sell order on CHAIN '
        + 'for price discovery. The remaining 150M serves as a working treasury.',
      'Of the 300M <strong>Market Reserve</strong>, 150M is committed to a public sell order on CHAIN '
        + 'for price discovery.',
    ];
    for (const chain of ['Aptos', 'Stellar']) {
      for (const old of RESV_OLD) p = p.split(old.replace('CHAIN', chain)).join(RESV_NEW);
    }
    // ...and the rest of the section, which the phone also words differently. #1 asked for one wording
    // across both devices, and the desktop one is the reference.
    p = p.split('<strong>Whale Holder rewards</strong> over 2 years.')
         .join('<strong>Whale Holder rewards</strong> distribute over 2 years.');
    p = p.split('<span class="name">Ecosystem LP</span>')
         .join('<span class="name">Ecosystem LP Rewards</span>');
    p = p.split('<span class="name">Native LP</span>')
         .join('<span class="name">Native LP Rewards</span>');
    if (p.indexOf('</head>') >= 0) p = p.replace('</head>', STYLE + '</head>');
    else { const hb = p.lastIndexOf('</body>'); p = p.slice(0, hb) + STYLE + p.slice(hb); }
    const bi = p.lastIndexOf('</body>');
    p = p.slice(0, bi) + SCRIPT + p.slice(bi);
    json[k] = p; changed = true; n++;
  }
  if (changed) {
    containers++;
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
console.log('lumos-token data (increment 1: hero): injected=' + n + ' keys across ' + containers + ' containers');
