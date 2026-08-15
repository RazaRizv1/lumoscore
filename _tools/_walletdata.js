// Real per-account data for the Wallet page (connected STELLAR address, localStorage lumos.address).
//  - Address, Total portfolio (every holding priced in XLM via Horizon orderbooks -> real XLM + USD).
//  - My Assets table (#assetsTable): real balances, real per-asset XLM/USD price + value, sorted by value.
//  - Open Orders (.orders-block): real DEX offers from /offers (or an empty state).
//  - Recent Activity: real operations (sent/received/swap/lp/order), grouped by day.
//  - Holdings / open-orders / pools counts.
// Public + CORS Horizon + CoinGecko. Stellar-only; leaves sample data otherwise. Idempotent.
const fs=require('fs');const{read,getContents,VERIFIED}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);
// Vendored QR encoder (qrcode-generator, MIT) so the Receive popup QR is real, not decorative.
const QRLIB='<script id="lx-qrlib">'+fs.readFileSync(__dirname+'/_qrlib.js','utf8')+'<\/script>';

const IC={received:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>',
sent:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
swap:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10l-3 3 3 3M4 13h11M17 14l3-3-3-3M20 11H9"/></svg>',
bridge:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="12" r="2.4"/><circle cx="19" cy="12" r="2.4"/><line x1="7.4" y1="12" x2="16.6" y2="12"/><polyline points="14 9.6 16.6 12 14 14.4"/></svg>',
lp:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>',
order:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
claim:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>',
settings:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
contract:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
data:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>',
other:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>'};
// Real Stellar logo (base64) — used for the XLM asset icon; painter-proof via CSS var + !important.
const STELLAR_SVG='<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#000"/><path d="M23.13 9.292l-2.4 1.224-11.598 5.907A6.909 6.909 0 0119.35 9.498l1.374-.7.205-.105a8.439 8.439 0 00-13.371 7.472 1.535 1.535 0 01-.834 1.484l-.725.37v1.724l2.134-1.088.691-.353.681-.347 12.226-6.23 1.374-.699 2.84-1.447V7.856zm2.816 2.012L10.201 19.32l-1.374.7L6 21.463v1.723l2.808-1.43 2.401-1.224 11.61-5.916a6.909 6.909 0 01-10.229 6.93l-.085.045-1.49.76a8.439 8.439 0 0013.372-7.475 1.536 1.536 0 01.833-1.483l.726-.37v-1.718z" fill="#FFF"/></svg>';
const STELLAR_URI='data:image/svg+xml;base64,'+Buffer.from(STELLAR_SVG).toString('base64');
// Finalized My-Assets row action buttons (Trade on DEX / Send / more) — restored verbatim.
// The Trade action used to carry the two-arrows SWAP glyph, which is a different verb from the one the
// button performs and from the Trade item in the left nav. Same candlestick mark as that nav item.
const QA_ACTIONS='<div class="row-quick-actions"><button class="qa-row-btn"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M8 6v3"/><rect x="6" y="9" width="4" height="6" rx="1"/><path d="M8 15v3"/><path d="M16 4v2"/><rect x="14" y="6" width="4" height="9" rx="1"/><path d="M16 15v3"/></svg> Trade</button><button class="qa-row-btn"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send</button><button class="qa-row-btn icon-only"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg></button></div>';
// Same row actions, but Send -> "Remove Trustline" (for zero-balance trustlines). __RMC__/__RMI__ filled per row.
const QA_REMOVE = QA_ACTIONS.replace(
  '<button class="qa-row-btn"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send</button>',
  '<button class="qa-row-btn lx-rmtrust" data-rmc="__RMC__" data-rmi="__RMI__"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg> Trustline</button>'
);
// Finalized Liq-Pools row action buttons (Add / Remove / more).
const LP_ACTIONS='<div class="row-quick-actions"><button class="qa-row-btn"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add</button><button class="qa-row-btn"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg> Remove</button><button class="qa-row-btn icon-only"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg></button></div>';
// Painter-proof icon + hide-until-ready (no flash of mock) styles.
const CSS='<style id="lx-walletdata-css">'
// AUDIT (flash sweep): a static-vs-settled diff showed the hero chip, the hero unit and the whole Recent
// activity feed painting the design's mock (0x09c7…a802, "142 APT", "From rN9au…Kj3n · 16:21", a May 2026
// date) before our Horizon data lands. Mask them until written; .lxp is added by the observer in lxWdUnmask
// so each reveals the instant its own value arrives, with a failsafe so nothing can stay hidden.
+'.hero-id-row .wallet-chip .text:not(.lxp),'
+'.hero-body .value-side .value span:not(.lxp),'
+'.activity-block .day-divider:not(.lxp),'
+'.activity-block .activity-row .activity-info .meta:not(.lxp),'
+'.activity-block .activity-row .activity-amt .a1:not(.lxp){visibility:hidden!important}'
+'#assetsTable .lx-aico{background:var(--ic,#333)!important;background-size:cover!important;background-position:center!important;background-repeat:no-repeat!important;position:relative;overflow:hidden}'
+'#assetsTable .asset-id .ico{width:26px!important;height:26px!important}'
// issuer identity line: verified tick, home domain, shortened issuer, copy
+'.lx-asb{display:inline-flex;align-items:center;gap:7px;flex-wrap:wrap}'
+'.lx-vfd{width:14px;height:14px;flex:0 0 14px;border-radius:50%;background:var(--green,#35c07f);color:#fff;display:inline-flex;align-items:center;justify-content:center}'
+'.lx-vfd svg{width:9px;height:9px;display:block}'
+'.lx-hd:empty{display:none}'
+'.lx-hd{color:var(--text-soft,#6b6b76)}'
+'.lx-iss{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.4px;opacity:.85}'
+'.lx-isscopy{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--text-soft,#6b6b76);cursor:pointer;transition:.15s;vertical-align:middle}'
+'.lx-isscopy:hover{background:var(--surface-2,#f6f6f8);color:var(--accent,#ea6a2c)}'
+'.lx-isscopy svg{width:12px;height:12px;display:block}'
+'#assetsTable .lx-aico::after{content:attr(data-l);position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:12px}'
// gentle one-time fade when a real logo replaces a letter placeholder (softens the async letter->logo swap)
+'@keyframes lxdin{from{opacity:.25}to{opacity:1}}'
+'.lx-din{animation:lxdin .3s ease}'
// the finalized logo-painter injects a default (USDC) <img> into every icon; hide it so our real logo/letter shows
+'#assetsTable .lx-aico img{display:none!important}'
// My Assets > Liquidity Pools: 26px asset logos, slightly less overlap (touch but not too much), and hide the APR (7d) column
+'#lpPanel .lp-icons{width:52px!important;height:32px!important}'
+'#lpPanel .lp-ico{width:32px!important;height:32px!important;top:0!important}'
+'#lpPanel .lp-icons .lp-ico:first-child{left:0!important}'
+'#lpPanel .lp-icons .lp-ico:last-child{left:20px!important}'
+'#lpPanel .lp-ico.lx-lpico{background:var(--ic,#333)!important;background-size:cover!important;background-position:center!important;background-repeat:no-repeat!important;overflow:hidden;color:transparent;box-shadow:0 0 0 2px var(--surface,#fff)}'
+'#lpPanel .lp-ico.lx-lpico::after{content:attr(data-l);position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px}'
+'#lpPanel .lp-ico.lx-lpico img{display:none!important}'
+'#lpPanel thead th:nth-child(3),#lpPanel tbody td:nth-child(3){display:none!important}'
+'#assetsTable .spark-cell{display:none!important}'
+'#assetsTable .price-cell .lx-pxlm{font-size:11px;color:var(--text-muted);margin-top:3px;font-family:\'JetBrains Mono\',monospace;letter-spacing:.01em}'
+'#assetsTable .price-cell .lx-p1{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}'
+'#assetsTable .price-cell .lx-chg{font-size:12px;font-weight:800;font-family:\'JetBrains Mono\',monospace;white-space:nowrap;opacity:0;transition:opacity .4s ease}'
+'#assetsTable .price-cell .lx-chg:not(:empty){opacity:1}'
+'#assetsTable .price-cell .lx-chg.up{color:var(--green,#16c784)}'
+'#assetsTable .price-cell .lx-chg.down{color:var(--red,#ea3943)}'
+'#assetsTable .price-cell .lx-chg.flat{color:var(--text-muted)}'
// render-blocking (in <head>) sizing so the brand logo never flashes at full size on refresh
+'.logo .logo-mark{width:38px!important;height:38px!important;overflow:hidden;flex-shrink:0}.logo .logo-mark img{width:100%!important;height:100%!important;object-fit:cover;display:block}'
// hide removed elements from FIRST paint (no flash): Top Mover card + fake 7-day change line
+'.insight-card.green-edge{display:none!important}'
+'.insights-rail{grid-template-columns:1fr 1fr!important}'
+'.delta-row{display:none!important}'
+'.order-row{align-items:center!important;padding-top:26px!important;padding-bottom:16px!important}'
+'.order-details{padding-top:3px}'
+'.activity-info{display:flex!important;flex-flow:row wrap;align-items:baseline;gap:2px 0;min-width:0}'
+'.activity-info .meta::before{content:"\\00b7";margin:0 8px;opacity:.5}'
+'.search-box.inline-filter svg{flex:0 0 auto;width:14px;height:14px}'
+'.value-side .value{font-size:46px!important;line-height:1.06}'
+'.activity-row{position:relative}.lx-txlink{margin-left:14px;color:var(--text-muted);display:inline-flex;align-items:center;flex-shrink:0;transition:color .12s}.lx-txlink:hover{color:var(--accent)}'
+'.activity-icon.lx-hasico{background-color:transparent!important;background-image:var(--lxlogo)!important;background-size:cover!important;background-position:center!important;background-repeat:no-repeat!important;position:relative;overflow:hidden}'
+'.activity-icon.lx-hasico>svg{display:none!important}'
+'.activity-icon.lx-hasico::after{content:attr(data-l);position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:13px;pointer-events:none}'
+'.activity-icon.lx-swapicos{background-size:58% 58%!important;background-position:left center,right center!important}'
+'.activity-icon.claim{background:rgba(16,185,129,.14)!important;color:#10b981!important}'
+'.activity-icon.contract{background:rgba(139,92,246,.14)!important;color:#8b5cf6!important}'
+'.activity-icon.bridge{background:rgba(6,182,212,.15)!important;color:#06b6d4!important}'
// A cross-chain transfer is only finished once the destination chain mints. Until then the USDC exists
// nowhere the user can see, so it gets its own row at the top of activity rather than being invisible.
+'.lx-pendclaim{text-decoration:none!important;color:inherit!important}'
+'.lx-pendclaim .activity-amt .a2{color:#c9791f}'
+'.lx-pendclaim:hover{background:rgba(6,182,212,.06)}'
// the mobile sheet clips .type/.meta to one nowrap line for op rows; these rows carry a sentence, and
// clipping it mid-word ("Waiting to be claime…") is worse than two lines. The leading "·" separator
// belongs to rows whose meta follows an address — there is none here.
+'.lx-pendclaim .activity-info .type,.lx-pendclaim .activity-info .meta{white-space:normal!important;overflow:visible!important;text-overflow:clip!important}'
+'.lx-pendclaim .activity-info .meta::before{content:""!important;margin:0!important}'
+'.activity-icon.settings{background:rgba(100,116,139,.16)!important;color:#64748b!important}'
+'.activity-icon.data{background:rgba(99,102,241,.14)!important;color:#6366f1!important}'
+'.activity-icon.other{background:rgba(100,116,139,.14)!important;color:#64748b!important}'
+'.lx-act-ilogo{display:inline-block;vertical-align:middle;width:26px;height:26px;border-radius:50%;background:var(--al);background-size:cover;background-position:center;background-repeat:no-repeat;box-shadow:0 0 0 2px var(--surface,#fff);overflow:hidden;margin-left:7px;margin-right:2px;color:#fff;font-weight:800;font-size:11px;line-height:26px;text-align:center}'
+'.lx-act-ilogo::after{content:attr(data-l)}'
// activity feed was all-700-bold; keep the amount bold, lighten the row label ("Swap X -> Y")
+'.activity-row .activity-info .type{font-weight:550!important}'
+'#assetsTable .lx-aico{width:26px!important;height:26px!important}'
+'#assetsTable .lx-aico::after{font-size:12px!important}'
+'.lx-addr-link{color:var(--accent,#ea6a2c);text-decoration:none;font-weight:600}.lx-addr-link:hover{text-decoration:underline}'
+'.pair-ico .lx-pico{background:var(--ic,#333)!important;background-size:cover!important;background-position:center!important;position:relative;overflow:hidden;color:transparent!important}'
+'.pair-ico .lx-pico::after{content:attr(data-l);position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700}'
+'.lx-skel{display:inline-block;position:relative;overflow:hidden;border-radius:8px;background:linear-gradient(90deg,rgba(140,145,165,.10) 0%,rgba(140,145,165,.10) 38%,rgba(234,106,44,.20) 50%,rgba(140,145,165,.10) 62%,rgba(140,145,165,.10) 100%);background-size:220% 100%;animation:lxsh 1.3s linear infinite}'
+'@keyframes lxsh{0%{background-position:120% 0}100%{background-position:-120% 0}}'
+'#heroChart:not(.lx-chart-ready){visibility:hidden}'
// the DESIGN ships its own chart script that draws a GREEN chart (#35c07f line + url(#hg) area + #chartCursor)
// into #heroChart, racing our orange real-data chart -> a green->orange flash. Hide the design's green marks
// outright (timing-independent); our chart uses #ea6a2c + url(#lxhc) so it is untouched.
+'#heroChart path[stroke="#35c07f"],#heroChart [fill="url(#hg)"],#heroChart [fill="#35c07f"],#heroChart #chartCursor,#heroChart #chartCursorDot{display:none!important}'
+'.lx-rc-qrwrap .qr-frame svg:not(.lx-qr-ready){visibility:hidden}'
+'.qr-display .qr-frame svg,.qr-display canvas,.qr-display img{visibility:hidden!important}'
+'.chart-axis:not(.lx-axis-ready){visibility:hidden}'
+'.lx-chart-none{display:flex;align-items:center;justify-content:center;height:100%;min-height:90px;font-size:13px;color:var(--text-soft,#6b6b76)}'
+'.lx-chartskel{position:relative;display:block;width:100%;height:100%;min-height:78px;overflow:hidden;border-radius:10px;background:linear-gradient(180deg,rgba(234,106,44,.06),transparent 72%)}'
+'.lx-chartskel svg{position:absolute;inset:0;width:100%;height:100%}'
+'.lx-chartskel .lx-carea{fill:rgba(234,106,44,.09)}'
+'.lx-chartskel .lx-cbase{fill:none;stroke:var(--accent,#ea6a2c);stroke-width:2;opacity:.22;vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round}'
+'.lx-chartskel .lx-cline{fill:none;stroke:var(--accent,#ea6a2c);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke;stroke-dasharray:22 78;stroke-dashoffset:100;animation:lxdraw 1.5s linear infinite;filter:drop-shadow(0 0 5px rgba(234,106,44,.55))}'
+'@keyframes lxdraw{to{stroke-dashoffset:0}}'
+'#heroChart{position:relative}'
+'#heroChart.lx-chart-loading{opacity:.5;transition:opacity .25s ease}'
+'.lx-ctip{position:absolute;pointer-events:none;transform:translate(-50%,-140%);background:var(--surface,#171922);border:1px solid var(--border,rgba(255,255,255,.14));border-radius:8px;padding:5px 9px;font-size:11px;line-height:1.35;font-weight:600;color:var(--text,#fff);white-space:nowrap;box-shadow:0 6px 20px rgba(0,0,0,.35);opacity:0;transition:opacity .1s;z-index:20}'
+'.lx-ctip .lx-ctd{display:block;font-size:10px;font-weight:500;opacity:.6;margin-top:1px}'
+'.lx-cx{position:absolute;top:0;bottom:0;width:1px;background:rgba(255,255,255,.35);opacity:0;pointer-events:none;transform:translateX(-.5px);z-index:15}'
+'.lx-cd{position:absolute;width:9px;height:9px;border-radius:50%;border:1.6px solid #fff;transform:translate(-50%,-50%);opacity:0;pointer-events:none;z-index:16;box-shadow:0 0 0 3px rgba(255,255,255,.12)}'
+'body:not(.lx-wd-ready) .value-side .sub-value{visibility:hidden}'
// gate finalized placeholder counts until real data lands (no split-second wrong values)
+'body:not(.lx-wd-ready) .insight-card:not(.green-edge) .headline,body:not(.lx-wd-ready) .insight-card:not(.green-edge) .sub{visibility:hidden}'
+'body:not(.lx-wd-ready) .asset-tabs .cnt{visibility:hidden}'
+'body:not(.lx-wd-ready) h2 .meta,body:not(.lx-wd-ready) h3 .meta{visibility:hidden}'
+'.app{overflow-x:clip}'
+'table:has(#assetsTable){table-layout:fixed;width:100%;min-width:540px}'
+'.assets-card{overflow:auto;max-height:560px}'
+'table:has(#assetsTable) thead th{position:sticky;top:0;z-index:3;background:var(--surface,#fff)}'
+'table:has(#assetsTable) th:nth-child(1),table:has(#assetsTable) #assetsTable td:nth-child(1){width:28%}'
+'table:has(#assetsTable) th:nth-child(2),table:has(#assetsTable) #assetsTable td:nth-child(2){width:20%}'
+'table:has(#assetsTable) th:nth-child(4),table:has(#assetsTable) #assetsTable td:nth-child(4){width:24%}'
+'table:has(#assetsTable) th:nth-child(5),table:has(#assetsTable) #assetsTable td:nth-child(5){width:28%}'
+'#assetsTable .row-quick-actions{display:flex;justify-content:flex-end;align-items:center;gap:8px;width:100%;box-sizing:border-box}'
// symmetry: the middle button varies ("Send" vs the wider "Remove Trustline"), which shifted "Trade on DEX" out
// of alignment between rows. Give it a fixed min-width (left-aligned content) + fix the ⋮ button so all three
// action columns line up vertically across every row.
+'#assetsTable .row-quick-actions>.qa-row-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;flex-shrink:0}'
+'#assetsTable .row-quick-actions>.qa-row-btn:nth-child(2){width:118px;min-width:118px;justify-content:center}'
+'#assetsTable .qa-row-btn.lx-rmtrust svg{stroke:var(--red,#ea3943)!important}'
// DEX / Swap chooser hung off the row's Trade button
+'.lx-trmenu{position:fixed;z-index:100003;min-width:198px;background:var(--surface,#171922);border:1px solid var(--border,rgba(255,255,255,.14));border-radius:12px;padding:6px;box-shadow:0 14px 44px rgba(0,0,0,.55)}'
+'.lx-trmenu button{display:flex;flex-direction:column;align-items:flex-start;gap:1px;width:100%;padding:9px 11px;border:0;border-radius:9px;background:transparent;color:var(--text);font:700 13px/1.25 \\x27Hanken Grotesk\\x27,sans-serif;text-align:left;cursor:pointer}'
+'.lx-trmenu button:hover{background:rgba(234,106,44,.12);color:var(--accent,#ea6a2c)}'
+'.lx-trmenu small{font-weight:600;font-size:11.5px;color:var(--text-muted,#8b90a0)}'
+'.lx-trmenu button:hover small{color:inherit;opacity:.8}'
+'#assetsTable .row-quick-actions>.qa-row-btn.icon-only{min-width:0;width:30px;flex:0 0 30px;justify-content:center;padding-left:0;padding-right:0}'
+'#assetsTable .qa-row-btn.lx-rmtrust:hover{color:var(--red,#ea3943)!important;border-color:rgba(234,57,67,.4)!important}'
+'#assetsTable td:nth-child(5){padding-right:20px}'
+'.lx-paste-btn{position:absolute;right:7px;top:50%;transform:translateY(-50%);background:var(--accent-soft,rgba(255,122,0,.14));color:var(--accent,#ff7a00);border:1px solid var(--accent-soft,rgba(255,122,0,.32));border-radius:7px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer;z-index:2;line-height:1}'
+'.lx-paste-btn:hover{filter:brightness(1.08)}'
+'.lx-send-err{color:var(--red,#ff5b5b);font-size:12px;font-weight:500;margin:8px 2px 14px;line-height:1.4}'
+'.lx-send-err:empty{display:none}'
+'.lx-btn-off{opacity:.42!important;cursor:not-allowed!important;filter:grayscale(.4)}'
+'.asset-pick{cursor:pointer}'
+'.lx-asset-menu{background:var(--surface,#171922);border:1px solid var(--border,rgba(255,255,255,.14));border-radius:12px;padding:6px;box-shadow:0 14px 44px rgba(0,0,0,.55);width:230px;max-height:290px;overflow-y:auto}'
+'.lx-asset-menu.lx-hassearch{display:flex;flex-direction:column;overflow:visible;max-height:344px;padding-top:8px}'
+'.lx-asset-menu.lx-hassearch .lx-am-list{flex:1 1 auto;overflow-y:auto;min-height:0;max-height:252px}'
+'.lx-asset-menu .lx-am-searchwrap{position:relative;margin:0 2px 6px}'
+'.lx-asset-menu .lx-am-ic img{width:100%;height:100%;object-fit:cover;display:block}'
+'.lx-am-item{display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;background:none;border:none;border-radius:8px;cursor:pointer;color:var(--text,#fff);font-size:13.5px;text-align:left}'
+'.lx-am-item:hover{background:rgba(255,255,255,.06)}'
+'.lx-am-ic{width:25px;height:25px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:11px;flex:0 0 auto;overflow:hidden}'
+'.lx-am-ic img{width:100%;height:100%;object-fit:cover}'
+'.lx-am-code{font-weight:600}'
+'.lx-am-bal{margin-left:auto;color:var(--text-muted);font-family:\'JetBrains Mono\',monospace;font-size:12px}'
+'.lx-asset-pick{display:inline-flex;align-items:center;gap:7px;background:var(--surface,var(--bg,#12141b));border:1px solid var(--border,rgba(255,255,255,.14));border-radius:12px;padding:7px 11px;cursor:pointer;color:var(--text,#fff);font-weight:700;font-size:14px;white-space:nowrap}'
+'.lx-asset-pick:hover{border-color:var(--accent-soft,rgba(234,106,44,.45))}'
+'.lx-ap-ico{width:28px;height:28px;border-radius:50%;flex:0 0 auto;overflow:hidden;position:relative;background-color:transparent!important;background-image:var(--lxlogo,none)!important;background-size:cover!important;background-position:center!important;background-repeat:no-repeat!important}'
+'.lx-ap-ico::after{content:attr(data-l);position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:13px;pointer-events:none}'
+'.lx-ap-ico img{display:none!important}'
// unify the Send/Receive/Swap modal-header badge icons to the orange theme (were mismatched orange/green/blue)
+'.modal h3 .ico.send,.modal h3 .ico.receive,.modal h3 .ico.swap,.modal-body h3 .ico.send,.modal-body h3 .ico.receive,.modal-body h3 .ico.swap{background:linear-gradient(135deg,var(--accent,#ea6a2c),#c1440a)!important;color:#fff!important;border-radius:12px!important;box-shadow:0 8px 20px rgba(234,106,44,.32)!important}'
+'.modal h3 .ico.send svg,.modal h3 .ico.receive svg,.modal h3 .ico.swap svg{color:#fff!important;stroke:#fff!important}'
+'#assetsTable tr.lx-pinned{background:linear-gradient(90deg,rgba(234,106,44,.10),transparent 60%);box-shadow:inset 3px 0 0 var(--accent,#ea6a2c)}'
+'.lx-pin-badge{display:inline-flex;vertical-align:middle;margin-left:7px;color:#f5b301}'
+'.lx-pin-badge svg{width:14px;height:14px}'
+'.lx-send-amt{display:flex!important;align-items:center;gap:8px}'
+'.lx-send-amt>input{flex:1 1 auto;min-width:0;padding-right:16px!important}'
+'.field-amt .lx-max-inline{flex:0 0 auto;align-self:center;background:var(--accent-soft,rgba(234,106,44,.14));color:var(--accent,#ea6a2c);border:1px solid var(--accent-soft,rgba(234,106,44,.32));border-radius:8px;padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;line-height:1}'
+'.field-amt .lx-max-inline:hover{filter:brightness(1.08)}'
// Receive popup polish
+'.qr-display{display:flex;flex-direction:column;align-items:center;gap:16px;padding:6px 0 2px;background:transparent!important;border:0!important;box-shadow:none!important}'
+'.qr-frame{background:#fff!important;padding:11px!important;border-radius:16px!important;box-shadow:0 8px 26px rgba(0,0,0,.32)!important;line-height:0;border:0!important}'
+'.qr-frame svg{width:132px;height:132px;display:block}'
+'.qr-label{font-size:10.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--text-muted);font-weight:700}'
+'.qr-addr{align-self:stretch;box-sizing:border-box;font-family:\'JetBrains Mono\',monospace;font-size:13px;line-height:1.7;color:var(--text);word-break:break-all;text-align:center;background:var(--bg,rgba(255,255,255,.03));border:1px solid var(--border);border-radius:12px;padding:13px 16px;letter-spacing:.03em;cursor:pointer;transition:border-color .15s,background .15s;margin-top:-4px}'
+'.qr-addr:hover{border-color:var(--accent-soft,rgba(234,106,44,.5));background:var(--accent-pale,rgba(234,106,44,.05))}'
+'.qr-addr::after{content:"\\2398  Tap to copy";display:block;margin-top:8px;font-family:inherit;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);opacity:.75}'
+'.lx-recv-note{margin-top:4px;display:flex;gap:9px;align-items:center;justify-content:center;text-align:center;background:var(--accent-pale,rgba(234,106,44,.07));border:1px solid var(--accent-soft,rgba(234,106,44,.22));border-radius:12px;padding:11px 14px;font-size:12.5px;line-height:1.5;color:var(--text-soft)}'
+'.lx-recv-note svg{flex:0 0 auto;width:17px;height:17px;color:var(--accent,#ea6a2c)}'
+'.lx-recv-modal .modal{max-height:96vh}'
+'.lx-recv-modal .modal-body{padding-top:8px!important;padding-bottom:8px!important}'
+'.lx-rc{display:flex;flex-direction:column;align-items:center;gap:20px;padding:12px 2px 8px;text-align:center}'
+'.lx-rc-chip{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:700;letter-spacing:.01em;color:var(--text);background:rgba(123,97,255,.1);border:1px solid rgba(123,97,255,.3);padding:6px 14px;border-radius:999px}'
+'.lx-rc-dot{width:7px;height:7px;border-radius:50%;background:#ea6a2c;box-shadow:0 0 0 3px rgba(123,97,255,.18);animation:lxrcpulse 1.8s ease-in-out infinite}'
+'@keyframes lxrcpulse{0%,100%{box-shadow:0 0 0 3px rgba(123,97,255,.18)}50%{box-shadow:0 0 0 5px rgba(123,97,255,.04)}}'
+'.lx-rc-qrwrap{position:relative;padding:12px;border-radius:22px;background:#fff;box-shadow:0 14px 40px rgba(70,50,130,.32)}'
+'.lx-rc-qrwrap .qr-frame{margin:0!important;box-shadow:none!important;border-radius:0!important;padding:0!important;background:#fff!important;line-height:0}'
+'.lx-rc-qrwrap .qr-frame svg{width:176px;height:176px;display:block}'
+'.lx-rc-corner{position:absolute;width:26px;height:26px;pointer-events:none;border:3.5px solid transparent}'
+'.lx-rc-corner.tl{top:-5px;left:-5px;border-top-color:#ea6a2c;border-left-color:#ea6a2c;border-top-left-radius:12px}'
+'.lx-rc-corner.tr{top:-5px;right:-5px;border-top-color:#f2954e;border-right-color:#f2954e;border-top-right-radius:12px}'
+'.lx-rc-corner.bl{bottom:-5px;left:-5px;border-bottom-color:#ea6a2c;border-left-color:#ea6a2c;border-bottom-left-radius:12px}'
+'.lx-rc-corner.br{bottom:-5px;right:-5px;border-bottom-color:#f2954e;border-right-color:#f2954e;border-bottom-right-radius:12px}'
+'.lx-rc-qrlogo{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:42px;height:42px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,.2)}'
+'.lx-rc-qrlogo svg{width:25px;height:25px}'
+'.lx-rc-qrlogo img{width:32px;height:32px;object-fit:contain;display:block}'
+'.lx-rc-scan{display:flex;align-items:center;justify-content:center;gap:6px;font-size:12px;color:var(--text-muted);margin-top:-1px}'
+'.lx-rc-scan svg{width:14px;height:14px}'
+'.lx-rc-addrlabel{display:flex;align-items:center;justify-content:center;gap:6px;font-size:10.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--text-muted);font-weight:700;margin-top:2px}'
+'.lx-rc-addrlabel svg{width:13px;height:13px;color:#ea6a2c}'
+'.lx-rc-addr{align-self:stretch;box-sizing:border-box;font-family:\'JetBrains Mono\',monospace;font-size:11px;line-height:1.4;color:var(--text);white-space:nowrap;overflow-x:auto;overflow-y:hidden;text-align:center;background:rgba(140,145,165,.08);border:1px solid var(--border);border-radius:14px;padding:13px 12px;letter-spacing:0;cursor:pointer;transition:border-color .15s,background .15s;position:relative}'
+'.lx-rc-addr:hover{border-color:#ea6a2c;background:rgba(123,97,255,.06)}'
+'.lx-rc-addr.lx-copied{border-color:#ea6a2c}'
+'.lx-rc-addr.lx-copied::after{content:"\\2713 Copied";position:absolute;top:50%;right:12px;transform:translateY(-50%);font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:#ea6a2c;background:var(--surface,#fff);padding:2px 6px;border-radius:6px}'
+'.lx-rc-note{align-self:stretch;margin-top:0;display:flex;gap:10px;align-items:center;text-align:left;background:var(--accent-pale,rgba(234,106,44,.07));border:1px solid var(--accent-soft,rgba(234,106,44,.22));border-left:3px solid var(--accent,#ea6a2c);border-radius:14px;padding:12px 14px;font-size:13.5px;line-height:1.45;color:var(--text-soft)}'
+'.lx-rc-note svg{flex:0 0 auto;width:19px;height:19px;color:var(--accent,#ea6a2c)}'
+'.lx-rc-note strong{color:var(--accent,#ea6a2c);font-weight:700}'
+'.lx-rc-note b{color:var(--text);font-weight:700}'
+'.lx-recv-modal .modal-foot .btn-primary{background:linear-gradient(135deg,#ea6a2c,#f2954e)!important;border:none!important;color:#fff!important}'
+'</style>';

const SCRIPT='<script id="lx-walletdata">(function(){'
// AUDIT (flash sweep) — reveal each masked mock the moment it is overwritten (see the mask rules in CSS).
// An observer beats patching every writer in this file and keeps working as new ones are added.
+'var LXWM=".hero-id-row .wallet-chip .text,.hero-body .value-side .value span,.activity-block .day-divider,.activity-block .activity-row .activity-info .meta,.activity-block .activity-row .activity-amt .a1";'
// mark the masked element itself AND any masked descendants: when a whole activity row is rebuilt, the
// mutation target is the ROW, so closest() alone would never reach the .meta/.a1 leaves inside it.
+'function lxWdPaint(n){if(!n)return;var e=(n.nodeType===3)?n.parentElement:n;if(!e||!e.closest)return;'
+'var t=e.closest(LXWM);if(t&&t.classList)t.classList.add("lxp");'
+'if(e.querySelectorAll){var d=e.querySelectorAll(LXWM);for(var i=0;i<d.length;i++)d[i].classList.add("lxp");}}'
+'function lxWdUnmask(){try{var mo=new MutationObserver(function(ms){for(var i=0;i<ms.length;i++){var m=ms[i];lxWdPaint(m.target);if(m.addedNodes)for(var j=0;j<m.addedNodes.length;j++)lxWdPaint(m.addedNodes[j]);}});'
+'mo.observe(document.body,{subtree:true,childList:true,characterData:true});}catch(_){}'
+'setTimeout(function(){[].forEach.call(document.querySelectorAll(LXWM),function(e){e.classList.add("lxp");});},6000);}'
+'if(document.readyState!=="loading")lxWdUnmask();else document.addEventListener("DOMContentLoaded",lxWdUnmask);'
+'if(window.__lxWalletData)return;window.__lxWalletData=1;'
+'function netOK(){try{var n=(localStorage.getItem("lumos.network")||localStorage.getItem("lumos.chain")||"").toLowerCase();return n==="stellar";}catch(_){return false;}}'
+'var ME="";try{ME=localStorage.getItem("lumos.address")||"";}catch(_){}'
+'if(!netOK()||!/^G[A-Z2-7]{55}$/.test(ME)){reveal();return;}'
+'var IC='+JSON.stringify(IC)+',STELLAR_URI='+JSON.stringify(STELLAR_URI)+',QA='+JSON.stringify(QA_ACTIONS)+',QARM='+JSON.stringify(QA_REMOVE)+',LPQA='+JSON.stringify(LP_ACTIONS)+';'
+'window.__lxLogos=window.__lxLogos||{};(function(K){for(var k in K){if(!window.__lxLogos[k])window.__lxLogos[k]=K[k];}})({LUMOS:"assets/favicon.png",BLND:"assets/tokens/blnd.svg",AQUA:"assets/tokens/aqua.png",SSLX:"assets/tokens/sslx.png",SHX:"assets/tokens/shx.png",yXLM:"assets/tokens/yxlm.png",yUSDC:"assets/tokens/yusdc.png",USDC:"assets/tokens/usdc.png",EURC:"https://assets.coingecko.com/coins/images/26045/small/euro.png"});'
// remove the "View transaction history" item from the row ... menu (LP pools) — feature intentionally deferred
+'(function(){try{var mo=new MutationObserver(function(muts){for(var i=0;i<muts.length;i++){var an=muts[i].addedNodes||[];for(var j=0;j<an.length;j++){var n=an[j];if(n.nodeType===1&&n.classList&&n.classList.contains("row-menu")){var bs=n.querySelectorAll("button");for(var b=0;b<bs.length;b++){if(/view transaction history/i.test((bs[b].textContent||"").trim()))bs[b].remove();}}}}});mo.observe(document.body,{childList:true});}catch(_){}})();'
// re-run LP icon self-heal whenever the Liq Pools tab is opened (belt-and-suspenders)
+'document.addEventListener("click",function(e){try{var b=e.target&&e.target.closest?e.target.closest("button,.seg-btn,[data-tab],[role=tab]"):null;if(b&&/liq|pool/i.test((b.textContent||""))){setTimeout(function(){try{lxScheduleLpFix();}catch(_){}},50);}}catch(_){}}, true);'
+'function assetCode(r){if(!r||!r.asset||r.asset==="native")return "XLM";return String(r.asset).split(":")[0];}'
+'function assetIssuer(r){if(!r||!r.asset||r.asset==="native")return "";return String(r.asset).split(":")[1]||"";}'
+'function assetNative(r){return (!r||!r.asset||r.asset==="native");}'
+'function lpIco(code,iss,native){var lg=native?(window.__lxStellarUri||STELLAR_URI):((window.__lxLogos||{})[code]||"");var icv=lg?("url(\\x27"+String(lg).replace(/\\x27/g,"%27")+"\\x27)"):colFor(code);return \'<div class="lp-ico lx-lpico" style="--ic:\'+icv+\'" data-lxcode="\'+esc(code||"")+\'" data-lxnat="\'+(native?1:0)+\'" data-lxc="\'+esc(native?"":code)+\'" data-lxi="\'+esc(native?"":iss)+\'" data-l="\'+esc(lg?"":(code||"?").slice(0,1).toUpperCase())+\'"></div>\';}'
// self-healing: re-apply the correct logo to every LP icon from native URI / __lxLogos, so a placeholder can never persist
+'function lxFixLpIcons(){try{var els=document.querySelectorAll("#lpPanel .lx-lpico");for(var i=0;i<els.length;i++){var el=els[i];var nat=el.getAttribute("data-lxnat")==="1";var code=el.getAttribute("data-lxcode")||"";var lg=nat?(window.__lxStellarUri||STELLAR_URI):((window.__lxLogos||{})[code]||"");if(!lg)continue;var cur=el.style.getPropertyValue("--ic")||"";if(cur.indexOf(String(lg).slice(0,24))<0)el.style.setProperty("--ic","url(\\x27"+String(lg).replace(/\\x27/g,"%27")+"\\x27)");if(el.getAttribute("data-l")){el.classList.add("lx-din");el.setAttribute("data-l","");}}}catch(_){}}'
+'var _lpFixIv=null;function lxScheduleLpFix(){lxFixLpIcons();if(_lpFixIv)clearInterval(_lpFixIv);var n=0;_lpFixIv=setInterval(function(){n++;lxFixLpIcons();if(n>=12){clearInterval(_lpFixIv);_lpFixIv=null;}},400);}'
+'function lxHarvestLpLogos(){var seen={};[].slice.call(document.querySelectorAll("#lpPanel .lx-lpico[data-lxi]")).forEach(function(el){var code=el.getAttribute("data-lxc"),iss=el.getAttribute("data-lxi");if(!code||!iss)return;var cached=(window.__lxLogos||{})[code];if(cached){el.style.setProperty("--ic","url(\\x27"+String(cached).replace(/\\x27/g,"%27")+"\\x27)");el.setAttribute("data-l","");return;}var key=code+"|"+iss;if(seen[key])return;seen[key]=1;j("https://api.stellar.expert/explorer/public/asset?search="+encodeURIComponent(code)+"&limit=20").then(function(d){var recs=(d._embedded&&d._embedded.records)||[];var m=recs.filter(function(rc){return (rc.asset||"").indexOf(code+"-"+iss)===0;})[0];var ti=(m&&(m.tomlInfo||m.toml_info))||{};var img=ti.image||ti.orgLogo||"";if(!img)return;try{(window.__lxLogos=window.__lxLogos||{})[code]=img;}catch(_){}[].slice.call(document.querySelectorAll("#lpPanel .lx-lpico[data-lxi=\\x27"+iss+"\\x27][data-lxc=\\x27"+code+"\\x27]")).forEach(function(x){x.style.setProperty("--ic","url(\\x27"+String(img).replace(/\\x27/g,"%27")+"\\x27)");x.setAttribute("data-l","");});}).catch(function(){});});}'
+'function renderLP(lps){var panel=document.getElementById("lpPanel");if(!panel)return;var tb=panel.querySelector("tbody");if(!tb)return;var top=lps.slice(0,10);'
+'if(!top.length){tb.innerHTML=\'<tr><td colspan="6" style="padding:28px;text-align:center;color:var(--text-muted)">No liquidity positions</td></tr>\';return;}'
+'Promise.all(top.map(function(b){return j(H+"/liquidity_pools/"+b.liquidity_pool_id).then(function(p){return{b:b,p:p};}).catch(function(){return{b:b,p:null};});})).then(function(rows){var html="";rows.forEach(function(r){var p=r.p,bal=+r.b.balance;var res=(p&&p.reserves)||[];var a0=assetCode(res[0]),a1=assetCode(res[1]);var i0=assetIssuer(res[0]),i1=assetIssuer(res[1]),n0=assetNative(res[0]),n1=assetNative(res[1]);var pct=(p&&+p.total_shares>0)?(bal/(+p.total_shares)*100):0;'
+'html+=\'<tr data-pool="\'+esc(r.b.liquidity_pool_id)+\'"><td><div class="lp-pair" style="cursor:pointer"><div class="lp-icons">\'+lpIco(a0,i0,n0)+lpIco(a1,i1,n1)+\'</div><div><div class="lp-nm">\'+esc(a0)+\' / \'+esc(a1)+\'</div><div class="lp-sb">0.30% fee tier \\u00b7 Stellar AMM</div></div></div></td>\''
+'+\'<td class="lp-share"><div class="p1">\'+(pct>0?pct.toFixed(pct<0.01?4:2)+"%":"\\u2014")+\'</div><div class="p2">\'+amt(bal)+\' LP tokens</div></td>\''
+'+\'<td><span class="lp-apr">\\u2014</span></td>\''
+'+\'<td class="right"><div class="p1">\'+(res.length?amt(+res[0].amount)+\' <span style="color:var(--text-soft);font-size:14px">\'+esc(a0)+\'</span>\':"\\u2014")+\'</div><div class="p2">\'+(res.length>1?amt(+res[1].amount)+\' \'+esc(a1):"")+\'</div></td>\''
+'+\'<td class="right"><div class="p1">\\u2014</div></td>\''
+'+\'<td class="right">\'+LPQA+\'</td></tr>\';});tb.innerHTML=html;lxHarvestLpLogos();lxScheduleLpFix();if(!tb.__lxMo){tb.__lxMo=1;try{new MutationObserver(function(){lxFixLpIcons();}).observe(tb,{childList:true});}catch(_){}}'
// LP row -> pool detail nav: pair name / +Add (deposit) / -Remove (withdraw) / ...menu "View pool page".
+'if(!panel.__lxNav){panel.__lxNav=1;panel.addEventListener("click",function(e){var t=e.target;if(!t||!t.closest)return;var row=t.closest("tr[data-pool]");if(!row)return;var hex=row.getAttribute("data-pool");if(!hex)return;/* clean url DIRECTLY: going via lumoscore-amm-pool.html?pool= meant a 301, and the redirect that promoted the id into the path used to drop act=withdraw. Browsers cache a 301 permanently, so every user who clicked Remove before that fix would keep getting the old query-less redirect from cache. Link straight to the destination and no redirect is involved. */var base="/pools/stellar/id/"+hex;var btn=t.closest(".qa-row-btn");if(btn){if(btn.classList.contains("icon-only")){window.__lxLpMenuPool=hex;setTimeout(function(){var mn=document.querySelector(".row-menu");if(!mn)return;[].slice.call(mn.querySelectorAll("button,a")).forEach(function(it){if(/view pool/i.test(it.textContent||"")){if(it.__lxwp)return;it.__lxwp=1;it.addEventListener("click",function(){location.href="/pools/stellar/id/"+(window.__lxLpMenuPool||hex);});}});},70);return;}var lbl=(btn.textContent||"").trim();if(/remove/i.test(lbl)){e.preventDefault();e.stopImmediatePropagation();location.href=base+"?act=withdraw";}else if(/add/i.test(lbl)){e.preventDefault();e.stopImmediatePropagation();location.href=base;}return;}if(t.closest(".lp-nm")||t.closest(".lp-pair")){e.preventDefault();location.href=base;}},true);}'
+'}).catch(function(){});}'
+'function reveal(){try{document.body.classList.add("lx-wd-ready");}catch(_){}}'
+'function sparkFor(s){var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;var pts=[],y=14,y0=14;for(var x=0;x<=80;x+=10){h=(h*1103515245+12345)>>>0;y=Math.max(3,Math.min(25,y+(((h>>>16)%11)-5)));if(x===0)y0=y;pts.push(x+","+y);}var up=y<=y0;return \'<svg width="80" height="28" viewBox="0 0 80 28" fill="none"><polyline points="\'+pts.join(" ")+\'" stroke="\'+(up?"#35c07f":"#ef5350")+\'" stroke-width="1.5" opacity=".75"/></svg>\';}'
// Registered OUTSIDE the #assetsTable block on purpose. It used to sit inside it, so on the mobile
// wallet — which has no such table — the handler never installed and the Trustline button had nothing
// listening. It is a delegated document listener; with no matching buttons on a page it costs nothing.
+'if(!window.__lxRmWired){window.__lxRmWired=1;document.addEventListener("click",function(e){var bt=e.target&&e.target.closest?e.target.closest(".lx-rmtrust"):null;if(!bt)return;e.preventDefault();e.stopPropagation();if(bt.__lxb)return;bt.__lxb=1;var code=bt.getAttribute("data-rmc"),iss=bt.getAttribute("data-rmi"),lbl=bt.innerHTML;bt.textContent="Removing\\u2026";lxStellar().then(function(S){return j(H+"/accounts/"+ME).then(function(acc){var tx=new S.TransactionBuilder(new S.Account(ME,acc.sequence),{fee:"1000",networkPassphrase:(LX_NET==="testnet"?S.Networks.TESTNET:S.Networks.PUBLIC)}).addOperation(S.Operation.changeTrust({asset:new S.Asset(code,iss),limit:"0"})).setTimeout(120).build();return lxTimeout(lxSign(tx.toXDR(),S),150000,"Signing timed out \\u2014 open your wallet and try again").then(function(signed){if(!signed)throw new Error("Signing cancelled");return fetch(H+"/transactions",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"tx="+encodeURIComponent(signed)}).then(function(r){return r.json();});});});}).then(function(res){if(res&&(res.successful||res.hash)){try{lxToast(code+" trustline removed \\u2713");}catch(_){}setTimeout(function(){location.reload();},1200);}else{var x=res&&res.extras&&res.extras.result_codes;throw new Error(x?JSON.stringify(x):"failed");}})'
// "Could not remove trustline" told the user nothing they could act on. Stellar refuses limit=0 while the
// trustline is still backing something, and the account itself says which: a leftover balance, an open
// offer selling it, or -- the case that prompted this -- deposits sitting in a liquidity pool, where the
// asset does NOT show up as a balance and the row honestly reads 0. Ask, then name the actual blocker.
+'.catch(function(err){bt.__lxb=0;bt.innerHTML=lbl;var m=((err&&err.message)||err)+"";'
+'function say(t){try{lxToast(t);}catch(_){}}'
// Do NOT gate the diagnosis on the error text. Stellar returns op_cannot_delete when a liquidity-pool share
// still depends on the trustline -- that string contains none of the words the old filter looked for, so the
// one case this message exists for was the one case it never explained. Diagnose every failure instead.
+'if(/tx_bad_auth|tx_bad_seq|cancelled|timed out|denied|rejected/i.test(m)){say("Trustline removal cancelled");return;}'
+'j(H+"/accounts/"+ME).then(function(a2){var bals=((a2&&a2.balances)||[]);'
+'var b=bals.filter(function(x){return x.asset_code===code&&x.asset_issuer===iss;})[0];'
+'var inPool=bals.some(function(x){return x.asset_type==="liquidity_pool_shares"&&+x.balance>0;});'
+'if(b&&+b.balance>0){say("Can\u2019t remove "+code+" yet \u2014 the balance must be 0 (you still hold "+amt(b.balance)+").");return;}'
+'if(b&&+b.selling_liabilities>0){say("Can\u2019t remove "+code+" yet \u2014 cancel your open "+code+" offers first.");return;}'
+'if(inPool){say("Can\u2019t remove "+code+" yet \u2014 your "+code+" is deposited in a liquidity pool. Withdraw it there first.");return;}'
+'say("Can\u2019t remove "+code+" yet \u2014 it is still in use (pool deposit, balance or open offer).");'
+'}).catch(function(){say("Can\u2019t remove "+code+" yet \u2014 it is still in use (pool deposit, balance or open offer).");});'
+'});},true);}'
+'function prep(){var v=document.querySelector(".value-side .value");if(v)v.innerHTML=\'<span class="lx-skel" style="width:230px;height:40px"></span>\';var ad=document.querySelector(".wallet-chip .text");if(ad)ad.textContent=shrt(ME);var tb=document.getElementById("assetsTable");if(tb){var s="";for(var i=0;i<4;i++)s+=\'<tr><td colspan="5"><div class="lx-skel" style="width:96%;height:38px;margin:9px 2%"></div></td></tr>\';tb.innerHTML=s;}if(!window.__lxAct){var ar=document.querySelector(".activity-row");window.__lxAct=ar?ar.parentNode:null;}var acn=window.__lxAct;if(acn){var a="";for(var i=0;i<5;i++)a+=\'<div class="lx-skel" style="height:40px;margin:11px 22px"></div>\';acn.innerHTML=a;}var ob=document.querySelector(".orders-block");if(ob){var o="";for(var i=0;i<3;i++)o+=\'<div class="lx-skel" style="height:44px;margin:11px 22px"></div>\';ob.innerHTML=o;}}'
+'function setPortfolio(xlm,u){var v=document.querySelector(".value-side .value");if(v)v.innerHTML=num(xlm,2)+\' <span style="font-size:.6em;color:var(--text-muted);font-weight:700">XLM</span>\';var sv=document.querySelector(".sub-value");if(sv)sv.textContent="\\u2248 "+usd(u)+" USD";'
// 7d change line is mock (no portfolio history feed) — hide it so we do not show fake data
+'var pc=document.querySelector(".value-side .pf-change,.value-side .change-line,.value-side .delta");if(!pc){var cands=document.querySelectorAll(".value-side *");for(var i=0;i<cands.length;i++){if(/past 7 days|7 days/.test(cands[i].textContent||"")){pc=cands[i];break;}}}if(pc)pc.style.display="none";}'
// NETWORK TOGGLE — the app currently runs on TESTNET (Launchpad/CCTP). Set LX_NET="mainnet" to switch the
// wallet real-data layer back to mainnet (real portfolios). Testnet has a single Horizon host (no rotation).
+'var LX_NET="mainnet";'
+'var H=(LX_NET==="testnet")?"https://horizon-testnet.stellar.org":"https://horizon.stellar.org";'
+'var HHOSTS=(LX_NET==="testnet")?["https://horizon-testnet.stellar.org"]:["https://horizon.stellar.org","https://horizon.stellarx.com","https://horizon.stellar.lobstr.co"];function _jHost(u,i){for(var k=0;k<HHOSTS.length;k++){if(u.indexOf(HHOSTS[k])===0)return HHOSTS[i%HHOSTS.length]+u.slice(HHOSTS[k].length);}return u;}'
+'var _jQ=[],_jA=0,_jMax=6;function _jPump(){while(_jA<_jMax&&_jQ.length){_jA++;(_jQ.shift())();}}'
+'function j(u){return new Promise(function(res,rej){function fin(){_jA--;_jPump();}function bk(t){return Math.min(3000,250*Math.pow(2,t))+t*80;}function att(t){fetch(_jHost(u,t)).then(function(r){if(r.status===404){fin();res({__nf:1});return;}if((r.status===429||r.status>=500)&&t<5){setTimeout(function(){att(t+1);},bk(t));return;}if(!r.ok){fin();rej(new Error(r.status));return;}r.json().then(function(d){fin();res(d);},function(e){fin();rej(e);});}).catch(function(e){if(t<5){setTimeout(function(){att(t+1);},bk(t));}else{fin();rej(e);}});}_jQ.push(function(){att(0);});_jPump();});}'
+'function esc(s){return String(s==null?"":s).replace(/[&<>]/g,function(c){return c==="&"?"&amp;":c==="<"?"&lt;":"&gt;";});}'
+'function num(n,d){n=+n||0;return n.toLocaleString(undefined,{minimumFractionDigits:d||0,maximumFractionDigits:d||0});}'
+'function amt(n){n=+n||0;var a=Math.abs(n);if(a>=1e12)return (n/1e12).toFixed(2)+"T";if(a>=1e9)return (n/1e9).toFixed(2)+"B";if(a>=1e6)return (n/1e6).toFixed(2)+"M";if(a>=1e3)return num(n,a>=1e4?0:1);if(a>=1)return num(n,2);if(a>0){var d=Math.min(7,Math.max(2,2-Math.floor(Math.log(a)/Math.LN10)));var s=n.toFixed(d);if(s.indexOf(".")>=0)s=s.replace(/0+$/,"").replace(/\\.$/,"");return s;}return "0";}'
+'function usd(n){n=+n||0;var a=Math.abs(n);return "$"+(a>=1e9?(n/1e9).toFixed(2)+"B":a>=1e6?(n/1e6).toFixed(2)+"M":a>=1e3?num(n,0):n.toFixed(2));}'
+'function shrt(a){a=String(a||"");return a.length>12?a.slice(0,5)+"\\u2026"+a.slice(-4):a;}'
// ---- issuer identity on every asset row ----
// A ticker is not an identity on Stellar: anyone can issue an asset called USDC, and hundreds have. So
// verification is keyed on code+ISSUER, never code, and every pair below was checked against its own
// issuer's home_domain on mainnet before being listed.
+'var LX_VFD='+JSON.stringify(VERIFIED)+';'
+'function lxVfd(code,iss){return (code&&iss)?(LX_VFD[code+"|"+iss]||""):"";}'
// everything else gets its home domain from the issuer account itself, cached a week
+'var LX_HDQ={};'
+'function lxHdFor(iss,cb){if(!iss)return;var k="lumos.hd."+iss;'
+'try{var c=JSON.parse(localStorage.getItem(k)||"null");if(c&&(Date.now()-c.ts)<6048e5){cb(c.d||"");return;}}catch(_){}'
+'if(LX_HDQ[iss]){LX_HDQ[iss].push(cb);return;}LX_HDQ[iss]=[cb];'
+'function flush(d){var q=LX_HDQ[iss]||[];LX_HDQ[iss]=null;q.forEach(function(f){try{f(d);}catch(_){}});}'
+'j(H+"/accounts/"+iss).then(function(a){var d=(a&&a.home_domain)||"";try{localStorage.setItem(k,JSON.stringify({d:d,ts:Date.now()}));}catch(_){}flush(d);},function(){flush("");});}'
+'var LX_CKSVG=\'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>\';'
+'var LX_CPSVG=\'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M5 15V5a2 2 0 0 1 2-2h10"></path></svg>\';'
+'function lxIssLine(code,iss,native){'
+'if(native)return \'<span class="lx-asb-t">Stellar \\u00b7 native</span>\';'
+'if(!iss)return \'<span class="lx-asb-t">Stellar asset</span>\';'
+'var v=lxVfd(code,iss),h=\'<span class="lx-asb">\';'
+'if(v)h+=\'<span class="lx-vfd" title="Verified issuer \\u00b7 \'+esc(v)+\'">\'+LX_CKSVG+\'</span>\';'
+'h+=\'<span class="lx-hd" data-hd="\'+esc(iss)+\'">\'+(v?esc(v):"")+\'</span>\';'
+'h+=\'<span class="lx-iss" title="\'+esc(iss)+\'">\'+esc(shrt(iss))+\'</span>\';'
+'h+=\'<button type="button" class="lx-isscopy" data-iss="\'+esc(iss)+\'" aria-label="Copy issuer address" title="Copy issuer address">\'+LX_CPSVG+\'</button>\';'
+'return h+\'</span>\';}'
// unverified domains fill in after render, so a row never waits on a fetch to appear
+'function lxFillHd(root){try{[].slice.call((root||document).querySelectorAll(".lx-hd[data-hd]")).forEach(function(el){'
+'if(el.textContent)return;var iss=el.getAttribute("data-hd");el.removeAttribute("data-hd");'
+'lxHdFor(iss,function(d){if(d)el.textContent=d;});});}catch(_){}}'
+'window.__lxIssLine=lxIssLine;window.__lxFillHd=lxFillHd;window.__lxVfd=lxVfd;'
+'if(!window.__lxIssCopyWired){window.__lxIssCopyWired=1;document.addEventListener("click",function(e){'
+'var b=e.target&&e.target.closest?e.target.closest(".lx-isscopy"):null;if(!b)return;'
+'e.preventDefault();e.stopPropagation();var v=b.getAttribute("data-iss")||"";'
+'function ok(){try{lxToast("Issuer address copied");}catch(_){}}'
+'try{navigator.clipboard.writeText(v).then(ok,function(){window.prompt("Issuer address",v);});}catch(_){window.prompt("Issuer address",v);}},true);}'
+'function codeOf(x){return (!x||x.asset_type==="native")?"XLM":(x.asset_code||"?");}'
+'var COL=["#3b82f6","#8b5cf6","#10b981","#f59e0b","#ec4899","#06b6d4","#ef4444","#6366f1"];'
+'function colFor(s){var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return COL[h%COL.length];}'
+'function dayLabel(t){var d=new Date(t),n=new Date();function k(x){return x.getFullYear()+"-"+x.getMonth()+"-"+x.getDate();}var mo=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];var lab=mo[d.getMonth()]+" "+d.getDate()+", "+d.getFullYear();if(k(d)===k(n))return "Today \\u00b7 "+lab;var y=new Date(n.getTime()-864e5);if(k(d)===k(y))return "Yesterday \\u00b7 "+lab;return lab;}'
+'function findH2(label){var hs=document.querySelectorAll("h2");for(var i=0;i<hs.length;i++){if((hs[i].textContent||"").indexOf(label)===0)return hs[i];}return null;}'
// best bid price in XLM per unit of the asset (0 if no market / native=1)
+'function priceXLM(b){if(b.asset_type==="native")return Promise.resolve(1);'
+'var bal=+b.balance||0,src="source_asset_type="+b.asset_type+"&source_asset_code="+encodeURIComponent(b.asset_code)+"&source_asset_issuer="+b.asset_issuer;'
// realizable value: price the WHOLE balance through actual liquidity, then per-unit = realizable/balance. Illiquid spam (huge supply, thin market) naturally collapses to ~0; the 1-unit fallback only fires when the full balance has no path.
+'function one(){return j(H+"/paths/strict-send?"+src+"&source_amount=1&destination_assets=native").then(function(d){var r=(d&&d._embedded&&d._embedded.records)||[];return r.length?parseFloat(r[0].destination_amount):0;}).catch(function(){return 0;});}'
+'if(!(bal>0))return one();'
+'return j(H+"/paths/strict-send?"+src+"&source_amount="+bal.toFixed(7)+"&destination_assets=native").then(function(d){var recs=(d&&d._embedded&&d._embedded.records)||[];var out=recs.length?parseFloat(recs[0].destination_amount):0;if(out>0)return out/bal;return one();}).catch(function(){return one();});}'
// 24h price change % per asset (asset/XLM trade-aggregations; native uses XLM/USDC). Non-blocking, top rows only.
+'function chg24(b){var now=Date.now(),start=now-26*36e5,base,ctr;if(b.asset_type==="native"){base="base_asset_type=native";ctr="counter_asset_type=credit_alphanum4&counter_asset_code=USDC&counter_asset_issuer=GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";}else{base="base_asset_type="+b.asset_type+"&base_asset_code="+encodeURIComponent(b.asset_code)+"&base_asset_issuer="+b.asset_issuer;ctr="counter_asset_type=native";}return j(H+"/trade_aggregations?"+base+"&"+ctr+"&resolution=3600000&start_time="+start+"&end_time="+now+"&order=asc&limit=100").then(function(d){var r=(d&&d._embedded&&d._embedded.records)||[];if(r.length<2)return null;var f=+r[0].avg,l=+r[r.length-1].avg;if(!(f>0)||!(l>0))return null;return (l-f)/f*100;}).catch(function(){return null;});}'
+'function lxFillChg(ri,ch){if(ch==null)return;var el=document.querySelector(\'#assetsTable .lx-chg[data-ci="\'+ri+\'"]\');if(!el)return;var flat=Math.abs(ch)<0.005,up=ch>=0;el.className="lx-chg "+(flat?"flat":(up?"up":"down"));el.textContent=(flat?"":(up?"+":"-"))+Math.abs(ch).toFixed(2)+"%";}'
// 24h change: computed for EVERY asset straight from Horizon trade-aggregations (chg24); the throttled+retried j() keeps it reliable
+'function lxLoadChanges(rows){rows.forEach(function(r,ri){chg24(r.b).then(function(ch){lxFillChg(ri,ch);}).catch(function(){});});}'
// ---- MAIN ----
+'function load(){Promise.all(['
+'j(H+"/accounts/"+ME),'
+'j(H+"/accounts/"+ME+"/offers?limit=25&order=desc").catch(function(){return{__nf:1};}),'
+'j(H+"/accounts/"+ME+"/operations?order=desc&limit=100&include_failed=false").catch(function(){return{__nf:1};}),'
+'fetch("https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd").then(function(r){return r.json();}).catch(function(){return null;}),'
// XLM/USD FALLBACK straight from Stellar: the native->USDC order book (price = USDC per XLM ~= USD per XLM).
// CoinGecko's free tier rate-limits (429) constantly; when it failed, xu=0 and EVERY price/value in My Assets
// collapsed to "—" / "$0.00". Horizon is already a hard dependency, so this is always available.
+'j(H+"/order_book?selling_asset_type=native&buying_asset_type=credit_alphanum4&buying_asset_code=USDC&buying_asset_issuer=GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN&limit=1").catch(function(){return null;})'
+']).then(function(res){'
+'var acc=res[0]||{},offers=res[1]||{},ops=res[2]||{};var ob=res[3];var xu=(ob&&ob.stellar&&+ob.stellar.usd>0)?+ob.stellar.usd:0;var ch=null;'
// 2) live order book, 3) the shared cross-page cache (<6h). Whatever we settle on is written back to the cache.
+'if(!(xu>0)){var _ob=res[4];if(_ob){var _b=(_ob.bids&&_ob.bids[0]&&+_ob.bids[0].price)||0,_a=(_ob.asks&&_ob.asks[0]&&+_ob.asks[0].price)||0;var _m=(_b>0&&_a>0)?(_b+_a)/2:(_b||_a);if(_m>0)xu=_m;}}'
+'if(!(xu>0)){try{var _c=JSON.parse(localStorage.getItem("lumos.xlmUsd")||"null");if(_c&&+_c.v>0&&(Date.now()-_c.ts<216e5))xu=+_c.v;}catch(_){}}'
+'if(!(xu>0)&&+window.__lxXlmUsd>0)xu=+window.__lxXlmUsd;'
+'if(xu>0){try{localStorage.setItem("lumos.xlmUsd",JSON.stringify({v:xu,ts:Date.now()}));}catch(_){}}'
+'var bals=(acc.balances||[]);'
+'var lps=bals.filter(function(b){return b.asset_type==="liquidity_pool_shares"&&+b.balance>1e-7;});'   /* was >0.001 — dropped dust positions the Pools page counts (wallet said "1 pool", Pools "My Pools 2") */
+'try{window.__lxOffers=(offers._embedded&&offers._embedded.records)||[];'
  +'window.__lxOps=(ops._embedded&&ops._embedded.records)||[];'
  +'window.__lxLps=lps;'
  +'window.__lxHoldings=bals.filter(function(bb){return bb.asset_type!=="liquidity_pool_shares"&&(bb.asset_type==="native"||+bb.balance>0);})'
  +'.map(function(bb){var nat=bb.asset_type==="native";return{code:nat?"XLM":bb.asset_code,iss:nat?"":(bb.asset_issuer||""),bal:+bb.balance,native:nat};});'
  +'window.__lxWalletEarly=1;}catch(_){}'
  +'var nativeB=bals.filter(function(b){return b.asset_type==="native";})[0];try{window.__lxNative=+(nativeB&&nativeB.balance)||0;fixBalances(document);}catch(_){}'
+'var others=bals.filter(function(b){return b.asset_type!=="liquidity_pool_shares"&&b.asset_type!=="native";}).sort(function(a,b){return +b.balance-+a.balance;}).slice(0,30);'
// expose asset->issuer map, LUMOS-based fee tier (0.2% guest / 0.1% for 250K+ LUMOS holders), and signing helpers for the swap
+'try{window.__lxAssets={};bals.forEach(function(bb){if(bb.asset_code&&bb.asset_issuer)window.__lxAssets[bb.asset_code]=bb.asset_issuer;});var _LI=window.__lxLumosIssuer||"GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S";var lum=bals.filter(function(bb){return bb.asset_code==="LUMOS"&&bb.asset_issuer===_LI;}).reduce(function(s,bb){return s+(+bb.balance||0);},0);if(window.__lxFeeTierSet)window.__lxFeeTierSet(lum);else{window.__lxLumosBal=lum;window.__lxFeeRate=lum>=250000?0.001:0.002;}window.__lxXlmUsd=xu;var _sub=+acc.subentry_count||0,_spon=(+acc.num_sponsoring||0)-(+acc.num_sponsored||0),_res=(2+_sub+_spon)*0.5,_sl=+(nativeB&&nativeB.selling_liabilities)||0;window.__lxMaxXLM=Math.max(0,(window.__lxNative||0)-_res-_sl-0.001);window.__lxStellarUri=STELLAR_URI;window.__lxLogos=window.__lxLogos||{};window.__lxHarvest=lxHarvest;window.lxStellar=lxStellar;window.lxSign=lxSign;window.lxTimeout=lxTimeout;window.lxToast=lxToast;}catch(_){}'
+'var toks=(nativeB?[nativeB]:[]).concat(others);'
// price every holding in XLM, then render everything that depends on value
+'Promise.all(toks.map(function(b){return priceXLM(b).then(function(p){return{b:b,px:p,xlm:(+b.balance)*p};});})).then(function(rows){'
+'rows.sort(function(a,b){return b.xlm-a.xlm;});'
+'var totalXLM=rows.reduce(function(s,r){return s+r.xlm;},0);var totalUSD=totalXLM*xu;window.__lxTotalXLM=totalXLM;'
// Published for the mobile renderer: rows carry the per-asset value in XLM (balance x price), which is
// the only place that number exists — __lxHoldings has balances but no valuation. lps are the raw
// liquidity-pool share balances.
+'try{window.__lxRows=rows;window.__lxLps=lps;}catch(_){}'
+'window.__lxHoldings=bals.filter(function(bb){return bb.asset_type!=="liquidity_pool_shares"&&(bb.asset_type==="native"||+bb.balance>0);}).map(function(bb){var nat=bb.asset_type==="native";return{code:nat?"XLM":bb.asset_code,iss:nat?"":(bb.asset_issuer||""),bal:+bb.balance,native:nat};}).filter(function(h){return h.code;}).sort(function(a,b){return (b.native?1:0)-(a.native?1:0)||b.bal-a.bal;});'
// ---- address ----
+'var ad=document.querySelector(".wallet-chip .text");if(ad)ad.textContent=shrt(ME);'
// ---- portfolio headline (real total) ----
+'setPortfolio(totalXLM,totalUSD);'
// ---- My Assets table ----
+'var tb=document.getElementById("assetsTable");if(tb){var out="";rows.forEach(function(r,ri){var b=r.b,c=codeOf(b),bal=+b.balance,isX=(b.asset_type==="native");var _act=(!isX&&bal<=0)?QARM.replace(/__RMC__/g,esc(c)).replace(/__RMI__/g,esc(b.asset_issuer||"")):QA;'
+'var pxUsd=r.px*xu;var pStr="\\u2014";if(pxUsd>0){if(pxUsd>=1)pStr="$"+pxUsd.toFixed(2);else if(pxUsd>=0.01)pStr="$"+pxUsd.toFixed(4);else{var _d=Math.min(18,Math.max(4,2-Math.floor(Math.log(pxUsd)/Math.LN10)));pStr="$"+pxUsd.toFixed(_d).replace(/0+$/,"").replace(/\\.$/,"");}}'
+'var c24=isX?ch:0;var up=c24>0,zero=!isX||c24===0;'
+'var _slg=isX?"":((window.__lxLogos||{})[c]||"");var icv=isX?("url("+STELLAR_URI+")"):(_slg?("url(\\x27"+String(_slg).replace(/\\x27/g,"%27")+"\\x27)"):colFor(c));'
+'out+=\'<tr><td><div class="asset-id"><div class="ico lx-aico" style="--ic:\'+icv+\'" data-l="\'+((isX||_slg)?"":esc(c.slice(0,1)))+\'" data-lxc="\'+(isX?"":esc(c))+\'" data-lxi="\'+(isX?"":esc(b.asset_issuer||""))+\'"></div><div class="meta"><div class="nm">\'+esc(c)+\'</div><div class="sb">\'+lxIssLine(c,b.asset_issuer||"",isX)+\'</div></div></div></td>\''
+'+\'<td class="price-cell"><div class="p1 lx-p1"><span>\'+pStr+\'</span><span class="lx-chg" data-ci="\'+ri+\'"></span></div>\'+((!isX&&r.px>0)?(\'<div class="lx-pxlm">\'+num(r.px,r.px<1?6:4)+\' XLM</div>\'):"")+\'</td>\''
+'+\'<td class="spark-cell"></td>\''
+'+\'<td class="right balance-cell"><div class="b1">\'+amt(bal)+\' \'+esc(c)+\'</div><div class="b2">\'+(r.xlm>0?"\\u2248 "+usd(r.xlm*xu):"")+\'</div></td>\''
+'+\'<td class="right">\'+_act+\'</td></tr>\';});if(out){tb.innerHTML=out;applyPins();lxFillHd(tb);lxLoadChanges(rows);try{lxHealAllLogos(tb);}catch(_){}}'
// hide the now-empty "Last 7d" column header + cells so nothing misaligns
+'var thd=tb.parentNode&&tb.parentNode.querySelector("thead");if(thd){var ths=thd.querySelectorAll("th");if(ths[2])ths[2].style.display="none";}'
// fetch each held asset’s real logo from Stellar.Expert and swap it into the icon (bg-image is CORS-free)
+'[].slice.call(document.querySelectorAll("#assetsTable .lx-aico[data-lxi]")).forEach(function(ico){var code=ico.getAttribute("data-lxc"),iss=ico.getAttribute("data-lxi");if(!code||!iss)return;j("https://api.stellar.expert/explorer/public/asset?search="+encodeURIComponent(code)+"&limit=20").then(function(d){var recs=(d._embedded&&d._embedded.records)||[];var m=recs.filter(function(rc){return (rc.asset||"").indexOf(code+"-"+iss)===0;})[0];var ti=(m&&(m.tomlInfo||m.toml_info))||{};var img=ti.image||ti.orgLogo||"";var seeded=(window.__lxLogos||{})[code]||"";var useImg=/^assets\\//.test(seeded)?seeded:img;if(useImg){try{if(!/^assets\\//.test(seeded))(window.__lxLogos=window.__lxLogos||{})[code]=img;}catch(_){}if(ico.getAttribute("data-l"))ico.classList.add("lx-din");ico.style.setProperty("--ic","url("+JSON.stringify(useImg)+")");ico.setAttribute("data-l","");}}).catch(function(){});});}'
// ---- subtitles / counts ----
+'var mh=findH2("My Assets");if(mh){var m=mh.querySelector(".meta");if(m)m.textContent=rows.length+" Holding"+(rows.length===1?"":"s")+" | Total worth: ~"+num(totalXLM,0)+" XLM";}'
// ---- OPEN ORDERS (real offers) ----
+'var offRecs=(offers._embedded&&offers._embedded.records)||[];'
// Published for the MOBILE wallet renderer (_mobwallet.js). The mobile page has none of the desktop
// containers this layer writes into, so it consumes the data instead of the DOM.
+'try{window.__lxOffers=offRecs;window.__lxOps=(ops._embedded&&ops._embedded.records)||[];window.__lxWalletReady=1;}catch(_){}'
+'var oh=findH2("Open Orders");if(oh){var om=oh.querySelector(".meta");if(om)om.textContent=offRecs.length+" active";}'
+'renderOrders(offRecs);'
// ---- summary cards: open orders + liquidity pools counts ----
+'updInsight("Open Orders",offRecs.length+" Active",offRecs.length?"Awaiting fill on the DEX":"No open orders");'
+'updInsight("Liquidity Pools",lps.length+" pool"+(lps.length===1?"":"s"),"Across your positions");'
// reconcile with the Pools page ("My Pools" counts only positions in pools that still HOLD reserves —
// a drained pool with dust shares is excluded there): re-check each pool and correct the card count.
+'try{Promise.all(lps.map(function(b){return j(H+"/liquidity_pools/"+b.liquidity_pool_id).then(function(p){var hasRes=((p&&p.reserves)||[]).some(function(rv){return +rv.amount>0;});return hasRes?1:0;}).catch(function(){return 1;});})).then(function(fl){var live=fl.reduce(function(s,x){return s+x;},0);if(live!==lps.length){updInsight("Liquidity Pools",live+" pool"+(live===1?"":"s"),"Across your positions");var _atc=document.querySelectorAll(".asset-tabs button .cnt");if(_atc[1])_atc[1].textContent=live;}});}catch(_){}'
// tab counts (Assets / Liq Pools) -> real
+'var atc=document.querySelectorAll(".asset-tabs button .cnt");if(atc[0])atc[0].textContent=rows.length;if(atc[1])atc[1].textContent=lps.length;'
+'renderLP(lps);'
// hide the Top Mover card (no free per-asset 24h feed -> do not show fake data)
+'var ics=document.querySelectorAll(".insight-card");for(var ci=0;ci<ics.length;ci++){var tt=ics[ci].querySelector(".ttl");if(tt&&/top mover/i.test(tt.textContent||"")){ics[ci].style.display="none";var par=ics[ci].parentElement;if(par&&getComputedStyle(par).display==="grid")par.style.gridTemplateColumns="1fr 1fr";}}'
// ---- RECENT ACTIVITY ----
+'var recs=(ops._embedded&&ops._embedded.records)||[];var cont=window.__lxAct||document.querySelector(".activity-block");'
+'function actBg(code,native){var lg=native?(window.__lxStellarUri||""):((window.__lxLogos||{})[code]||"");if(lg)return "url(\\x27"+String(lg).replace(/\\x27/g,"%27")+"\\x27)";return "radial-gradient("+colFor(code||"?")+" 60%,transparent 62%)";}'
+'function actIconAttrs(a){return{cls:"",style:"",dl:"",svg:IC[a.kind]||IC.swap};}'
+'function ilogo(code,native,iss){var lg=native?(window.__lxStellarUri||STELLAR_URI):((window.__lxLogos||{})[code]||"");var bg=lg?("url(\\x27"+String(lg).replace(/\\x27/g,"%27")+"\\x27)"):colFor(code||"?");return \'<span class="lx-act-ilogo" style="--al:\'+bg+\'" data-lxc="\'+esc(native?"":(code||""))+\'" data-lxi="\'+esc(native?"":(iss||""))+\'" data-l="\'+esc(lg?"":(code||"?").slice(0,1).toUpperCase())+\'"></span>\';}'
+'function typeHtml(a){if(a.kind==="swap"&&a.srcCode){return "Swap"+ilogo(a.srcCode,a.srcNative,a.srcIss)+esc(a.srcCode)+" \\u2192"+ilogo(a.dstCode,a.dstNative,a.dstIss)+esc(a.dstCode);}if(a.code&&a.type==="Sent "+a.code){return "Sent"+ilogo(a.code,a.native,a.iss)+esc(a.code);}if(a.code&&a.type==="Received "+a.code){return "Received"+ilogo(a.code,a.native,a.iss)+esc(a.code);}if(a.lp&&a.c1){return esc(a.type)+ilogo(a.c1,a.n1,a.i1)+esc(a.c1)+" + "+ilogo(a.c2,a.n2,a.i2)+esc(a.c2);}if(a.tl&&a.code){return esc(a.type)+ilogo(a.code,a.native,a.iss)+esc(a.code);}return esc(a.type);}'
+'function lxHarvestActLogos(){var seen={};[].slice.call(document.querySelectorAll(".lx-act-ilogo[data-lxi]")).forEach(function(el){var code=el.getAttribute("data-lxc"),iss=el.getAttribute("data-lxi");if(!code||!iss)return;var cached=(window.__lxLogos||{})[code];if(cached){el.style.setProperty("--al","url(\\x27"+String(cached).replace(/\\x27/g,"%27")+"\\x27)");el.setAttribute("data-l","");return;}var key=code+"|"+iss;if(seen[key])return;seen[key]=1;j("https://api.stellar.expert/explorer/public/asset?search="+encodeURIComponent(code)+"&limit=20").then(function(d){var recs=(d._embedded&&d._embedded.records)||[];var m=recs.filter(function(rc){return (rc.asset||"").indexOf(code+"-"+iss)===0;})[0];var ti=(m&&(m.tomlInfo||m.toml_info))||{};var img=ti.image||ti.orgLogo||"";if(!img)return;try{(window.__lxLogos=window.__lxLogos||{})[code]=img;}catch(_){}[].slice.call(document.querySelectorAll(".lx-act-ilogo[data-lxi=\\x27"+iss+"\\x27][data-lxc=\\x27"+code+"\\x27]")).forEach(function(x){x.style.setProperty("--al","url(\\x27"+String(img).replace(/\\x27/g,"%27")+"\\x27)");x.setAttribute("data-l","");});}).catch(function(){});});}'
+'function lxRenderActs(limit){if(!cont)return;var use=recs.slice(0,limit||recs.length);var html="",prev=null;use.forEach(function(o){var a=mapOp(o);if(!a)return;a.tx=o.transaction_hash;if(a.day!==prev){html+=\'<div class="day-divider">\'+esc(a.day)+\'</div>\';prev=a.day;}var ac=a.kind==="received"?"up":(a.kind==="sent"?"down":"swap");'
+'var ia=actIconAttrs(a);'
+'var metaHtml=a.addr?(esc(a.metaPre||"")+\' <a class="lx-addr-link" href="https://stellar.expert/explorer/public/account/\'+esc(a.addr)+\'" target="_blank" rel="noopener">\'+esc(shrt(a.addr))+\'</a>\'):esc(a.meta||"");'
+'html+=\'<div class="activity-row"><div class="activity-icon \'+a.kind+ia.cls+\'" style="\'+ia.style+\'" data-l="\'+esc(ia.dl)+\'">\'+ia.svg+\'</div><div class="activity-info"><div class="type">\'+typeHtml(a)+\'</div><div class="meta">\'+metaHtml+\'</div></div>\'+\'<div class="activity-amt"><div class="a1 \'+ac+\'">\'+esc(a.amt)+\'</div><div class="a2">\'+esc(a.amtSub||"")+\'</div></div><a class="lx-txlink" href="https://stellar.expert/explorer/public/tx/\'+esc(a.tx||"")+\'" target="_blank" rel="noopener" title="View on Stellar.Expert"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a></div>\';});cont.innerHTML=html||\'<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:14px">No recent activity</div>\';var _cb=(document.getElementById("actCount")||{}).parentElement;if(_cb)_cb.innerHTML=\'Showing <span id="actCount">\'+use.length+\'</span> of \'+recs.length+\' activities\';lxHarvestActLogos();lxPendClaims(cont);}'
// ---- pending cross-chain claims ----
// These are not Horizon operations: the burn already showed up in activity, but the transfer is not done
// until the destination chain mints. Reading the local bridge store puts that unfinished state where the
// user actually looks. Claiming is the user's own step on the destination chain, so the row says so and
// links straight to the Bridge page, where the Claim button lives.
+'function lxPendClaims(cont){if(!cont)return;var list=[];try{list=JSON.parse(localStorage.getItem("lumos.cctp.pending")||"[]");}catch(_){}'
+'list=(list||[]).filter(function(r){return r&&r.burnHash;});if(!list.length)return;'
+'var CH={0:"Ethereum",1:"Avalanche",2:"Optimism",3:"Arbitrum",5:"Solana",6:"Base",7:"Polygon",8:"Sui",11:"Linea",14:"World Chain"};'
// stored as a 7dp string ("1.2700000") — show it the way every other amount on this page is shown
+'function usdc(v){var n=parseFloat(v);return isFinite(n)?n.toLocaleString("en-US",{maximumFractionDigits:6}):String(v||"");}'
+'var html="";list.forEach(function(r){var to=CH[r.destDomain]||("chain "+r.destDomain);'
+'html+=\'<a class="activity-row lx-pendclaim" data-h="\'+esc(r.burnHash)+\'" href="/bridge"><div class="activity-icon bridge">\'+IC.bridge+\'</div>\''
+'+\'<div class="activity-info"><div class="type">Cross-chain \\u2192 \'+esc(to)+\'</div><div class="meta lxp lx-pcs">Open Bridge to claim</div></div>\''
+'+\'<div class="activity-amt"><div class="a1 lxp">\'+esc(usdc(r.netUsdc))+\' USDC</div><div class="a2">Not claimed yet</div></div></a>\';});'
+'cont.insertAdjacentHTML("afterbegin",\'<div class="day-divider lxp">Pending cross-chain claims</div>\'+html);'
+'}'
+'function lxWireActSize(){var box=document.querySelector(".act-size-tabs");if(!box||box.__lxw)return;box.__lxw=1;var btns=[].slice.call(box.querySelectorAll("button")).map(function(b){var nb=b.cloneNode(true);b.parentNode.replaceChild(nb,b);return nb;});btns.forEach(function(nb){nb.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();var n=parseInt((nb.textContent||"").replace(/[^0-9]/g,""))||100;btns.forEach(function(x){x.classList.remove("active");});nb.classList.add("active");lxRenderActs(n);},true);});btns.forEach(function(x){x.classList.remove("active");if((x.textContent||"").trim()==="100")x.classList.add("active");});}'
+'lxWireActSize();lxRenderActs(100);'
+'try{lxHealAllLogos(document);setTimeout(function(){lxHealAllLogos(document);},900);setTimeout(function(){lxHealAllLogos(document);},2400);}catch(_){}'
+'reveal();'
+'});'
+'}).catch(function(){reveal();});}'
// update a summary card by its uppercase label
+'function updInsight(title,head,sub){var cards=document.querySelectorAll(".insight-card");for(var i=0;i<cards.length;i++){var t=cards[i].querySelector(".ttl");if(t&&(t.textContent||"").trim().toLowerCase()===title.toLowerCase()){var hd=cards[i].querySelector(".headline");if(hd&&head!=null)hd.textContent=head;var sb=cards[i].querySelector(".sub");if(sb&&sub!=null)sb.textContent=sub;return;}}}'
// build order rows
// ---- real on-chain cancel (build tx via stellar-base, sign with connected wallet, submit to Horizon) ----
+'function lxToast(msg){try{if(typeof window.showToast==="function"){window.showToast(msg);return;}}catch(_){}try{var t=document.createElement("div");t.textContent=msg;t.style.cssText="position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#1c1f27;color:#fff;border:1px solid rgba(255,255,255,.16);padding:10px 16px;border-radius:10px;font-size:13px;z-index:99999;box-shadow:0 10px 34px rgba(0,0,0,.45);max-width:82vw;text-align:center";document.body.appendChild(t);setTimeout(function(){t.style.transition="opacity .4s";t.style.opacity="0";setTimeout(function(){t.remove();},420);},2600);}catch(_){}}'
+'function lxTimeout(p,ms,msg){return new Promise(function(res,rej){var done=false;var to=setTimeout(function(){if(!done){done=true;rej(new Error(msg));}},ms);p.then(function(v){if(!done){done=true;clearTimeout(to);res(v);}},function(e){if(!done){done=true;clearTimeout(to);rej(e);}});});}'
+'var __sbP=null;function lxStellar(){if(!__sbP)__sbP=new Promise(function(res,rej){if(window.StellarBase)return res(window.StellarBase);var s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/@stellar/stellar-base@13.0.1/dist/stellar-base.min.js";s.onload=function(){window.StellarBase?res(window.StellarBase):rej(new Error("Stellar SDK failed to load"));};s.onerror=function(){rej(new Error("Stellar SDK failed to load"));};document.head.appendChild(s);});return __sbP;}'
+'function lxWallet(){try{return (localStorage.getItem("lumos.wallet")||"").toLowerCase();}catch(_){return "";}}'
+'function lxSign(xdr,S){var w=lxWallet(),PP=(LX_NET==="testnet"?S.Networks.TESTNET:S.Networks.PUBLIC);'
+'if(w==="freighter"){if(window.freighterApi&&window.freighterApi.signTransaction)return Promise.resolve(window.freighterApi.signTransaction(xdr,{networkPassphrase:PP,network:(LX_NET==="testnet"?"TESTNET":"PUBLIC"),address:ME})).then(function(r){return (r&&(r.signedTxXdr||r.signedXDR))||r;});return import("https://esm.sh/@stellar/freighter-api@6").then(function(m){var f=m.default||m;return f.signTransaction(xdr,{networkPassphrase:PP,address:ME});}).then(function(r){return (r&&(r.signedTxXdr||r.signedXDR))||r;});}'
+'if(w==="rabet"){return window.rabet.sign(xdr,(LX_NET==="testnet"?"testnet":"mainnet")).then(function(r){return r.xdr;});}'
+'if(w==="xbull"){return window.xBullSDK.signXDR(xdr,{network:(LX_NET==="testnet"?"TESTNET":"PUBLIC"),publicKey:ME}).then(function(r){return (r&&(r.signedXDR||r.xdr))||r;});}'
+'if(w==="albedo"){return import("https://esm.sh/@albedo-link/intent@0.12.0").then(function(m){var al=m.default||m.albedo||m;return al.tx({xdr:xdr,network:(LX_NET==="testnet"?"testnet":"public"),pubkey:ME});}).then(function(r){return r.signed_envelope_xdr;});}'
// A phone has no LOBSTR extension - that session signs over WalletConnect instead. Only ever true when
// the connect step recorded transport=wc, so every extension session keeps the line below unchanged.
+'if((w==="lobstr"||w==="walletconnect")&&window.__lxWcActive&&window.__lxWcActive())return window.__lxWcSign(xdr,PP);'
+'if(w==="lobstr"){return import("https://esm.sh/@lobstrco/signer-extension-api").then(function(m){var s=m.signTransaction||(m.default&&m.default.signTransaction);return s(xdr);}).then(function(r){return (r&&r.signedTransaction)||r;});}'
+'return Promise.reject(new Error("Reconnect your Stellar wallet to sign (unsupported: "+(w||"none")+")"));}'
+'function lxAsset(S,nt,code,iss){return nt?S.Asset.native():new S.Asset(code,iss);}'
+'function lxCancelAll(rows){return lxStellar().then(function(S){return j(H+"/accounts/"+ME).then(function(acc){var account=new S.Account(ME,acc.sequence);var tb=new S.TransactionBuilder(account,{fee:String(100*Math.max(1,rows.length)),networkPassphrase:(LX_NET==="testnet"?S.Networks.TESTNET:S.Networks.PUBLIC)});rows.forEach(function(row){var sell=lxAsset(S,row.getAttribute("data-snt")==="1",row.getAttribute("data-sc"),row.getAttribute("data-si"));var buy=lxAsset(S,row.getAttribute("data-bnt")==="1",row.getAttribute("data-bc"),row.getAttribute("data-bi"));tb.addOperation(S.Operation.manageSellOffer({selling:sell,buying:buy,amount:"0",price:String(row.getAttribute("data-price")||"1"),offerId:String(row.getAttribute("data-oid"))}));});var tx=tb.setTimeout(180).build();return lxTimeout(lxSign(tx.toXDR(),S),150000,"Signing timed out \\u2014 open your wallet extension and try again").then(function(signed){if(!signed)throw new Error("Signing cancelled");return fetch(H+"/transactions",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"tx="+encodeURIComponent(signed)}).then(function(r){return r.json();}).then(function(res){if(res&&(res.successful||res.hash))return res;var x=res&&res.extras&&res.extras.result_codes;throw new Error(x?("DEX: "+JSON.stringify(x)):"Submit failed");});});});});}'
+'function lxCancel(row){return lxCancelAll([row]);}'
// ---- real Send: build a payment (native or issued asset) + optional text memo, sign, submit ----
+'function lxPay(dest,sym,amount,memo,memoType){return lxStellar().then(function(S){return j(H+"/accounts/"+ME).then(function(acc){var account=new S.Account(ME,acc.sequence);var asset;if(!sym||sym==="XLM")asset=S.Asset.native();else{var iss=(window.__lxAssets||{})[sym];if(!iss)throw new Error("Cannot resolve the issuer for "+sym+" \\u2014 reopen Send and pick the asset again");asset=new S.Asset(sym,iss);}var tb=new S.TransactionBuilder(account,{fee:"100",networkPassphrase:(LX_NET==="testnet"?S.Networks.TESTNET:S.Networks.PUBLIC)}).addOperation(S.Operation.payment({destination:dest,asset:asset,amount:String(amount)}));if(memo)tb.addMemo(memoType==="id"?S.Memo.id(String(memo)):S.Memo.text(memo));var tx=tb.setTimeout(180).build();return lxTimeout(lxSign(tx.toXDR(),S),150000,"Signing timed out \\u2014 open your wallet and try again").then(function(signed){if(!signed)throw new Error("Signing cancelled");return fetch(H+"/transactions",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"tx="+encodeURIComponent(signed)}).then(function(r){return r.json();}).then(function(res){if(res&&(res.successful||res.hash))return res;var x=res&&res.extras&&res.extras.result_codes;var _o=(x&&x.operations&&x.operations[0])||"",_t=(x&&x.transaction)||"";throw new Error(/no_destination/.test(_o)?"Recipient isn\\u2019t activated on testnet yet":/no_trust/.test(_o)?"Recipient has no trustline for "+sym:/underfunded/.test(_o)?"Insufficient "+sym+" balance":/line_full/.test(_o)?"Recipient\\u2019s "+sym+" balance is at its limit":/bad_auth/.test(_t+_o)?"Signature rejected \\u2014 reconnect wallet on Testnet":x?("Payment failed"):"Submit failed");});});});});}'
+'function validateSend(m){if(!m||!m.querySelector)return;var amtI=m.querySelector(\'input[placeholder="0.00"]\'),recI=m.querySelector("input.mono");if(!amtI||!recI)return;var rb=[].slice.call(m.querySelectorAll("button")).filter(function(b){return /Review.*Send/i.test((b.textContent||"").replace(/\\s+/g," "));})[0];var err=m.querySelector(".lx-send-err");if(!err){err=document.createElement("div");err.className="lx-send-err";var af=amtI.closest(".field")||amtI.parentNode;if(af&&af.parentNode)af.parentNode.insertBefore(err,af.nextSibling);}var raw=(amtI.value||"").trim(),msg="",okAmt=false,n=NaN;var sym=m.__lxsym||"XLM";if(raw!==""){if(/[^0-9.,]/.test(raw)){msg="Enter a number \\u2014 letters aren\\u2019t allowed in the amount.";}else{n=parseFloat(raw.replace(/,/g,""));var avail;if(sym==="XLM"){avail=window.__lxMaxXLM;}else{var _hs=window.__lxHoldings||[],_hh=_hs.filter(function(x){return x.code===sym;})[0];avail=_hh?_hh.bal:null;}if(!(n>0)){msg="Enter an amount greater than 0.";}else if(avail!=null&&n>avail){msg="Amount exceeds your available "+sym+" balance ("+num(avail,avail<1?6:4)+" "+sym+(sym==="XLM"?" after reserve":"")+").";}else{okAmt=true;}}}var dest=(recI.value||"").trim(),okDest=/^G[A-Z2-7]{55}$/.test(dest);if(!msg&&dest!==""&&!okDest){msg="That doesn\\u2019t look like a valid Stellar address (should start with G and be 56 characters).";}err.textContent=msg;err.style.display=msg?"":"none";var ok=okAmt&&okDest;if(rb){if(ok){rb.disabled=false;rb.classList.remove("lx-btn-off");}else{rb.disabled=true;rb.classList.add("lx-btn-off");}}}'
+'function wireSendValidation(){document.addEventListener("input",function(e){var m=e.target&&e.target.closest?e.target.closest(".modal-overlay"):null;if(!m||!m.querySelector("input.mono"))return;validateSend(m);},true);}'
+'function lxReadItemLogo(el){try{var ic=el.querySelector(".lx-am-ic");if(!ic)return "";var im=ic.querySelector("img");if(im&&im.src)return im.src;var bg=ic.style.backgroundImage||getComputedStyle(ic).backgroundImage||"";if(bg.indexOf("url(")>=0&&bg.indexOf("gradient")<0)return bg.replace(/^url\\((["\\x27]?)/,"").replace(/(["\\x27]?)\\)$/,"");}catch(_){}return "";}'
+'function lxHarvest(ic,code){if(!ic)return;var tries=0;var iv=setInterval(function(){tries++;try{var bg=ic.style.backgroundImage||"";if(bg&&bg.indexOf("url(")>=0&&bg.indexOf("gradient")<0){ic.style.setProperty("--lxlogo",bg);ic.setAttribute("data-l","");if(code&&!/^assets\\//.test(((window.__lxLogos||{})[code])||"")){var u=bg.replace(/^url\\((["\\x27]?)/,"").replace(/(["\\x27]?)\\)$/,"");(window.__lxLogos=window.__lxLogos||{})[code]=u;}clearInterval(iv);}}catch(_){}if(tries>8)clearInterval(iv);},220);}'
// generic logo self-heal: paint ANY icon carrying data-lxc/data-lxi from cache, and async-fetch the toml logo
// from stellar.expert for assets not in the seed (EURC, custom tokens) so no placeholder circle ever persists.
+'function lxPaintIco(el,url){if(!el||!url)return;var v="url(\\x27"+String(url).replace(/\\x27/g,"%27")+"\\x27)";el.style.setProperty("--ic",v);el.style.setProperty("--lxlogo",v);el.style.setProperty("--al",v);if(el.getAttribute("data-l")!==null)el.setAttribute("data-l","");}'
+'function lxHealAllLogos(root){root=root||document;try{var els=[].slice.call(root.querySelectorAll("[data-lxc][data-lxi]"));var need={};els.forEach(function(el){var code=el.getAttribute("data-lxc"),iss=el.getAttribute("data-lxi");if(!code||code==="XLM")return;var cached=(window.__lxLogos||{})[code];if(cached){lxPaintIco(el,cached);return;}if(!iss)return;(need[code+"|"+iss]=need[code+"|"+iss]||[]).push(el);});Object.keys(need).forEach(function(key){var parts=key.split("|"),code=parts[0],iss=parts[1];j("https://api.stellar.expert/explorer/public/asset?search="+encodeURIComponent(code)+"&limit=20").then(function(d){var recs=(d._embedded&&d._embedded.records)||[];var m=recs.filter(function(rc){return (rc.asset||"").indexOf(code+"-"+iss)===0;})[0];var ti=(m&&(m.tomlInfo||m.toml_info))||{};var img=ti.image||ti.orgLogo||"";if(!img)return;(window.__lxLogos=window.__lxLogos||{})[code]=img;[].slice.call(document.querySelectorAll("[data-lxc=\\x27"+code+"\\x27][data-lxi=\\x27"+iss+"\\x27]")).forEach(function(x){lxPaintIco(x,img);});}).catch(function(){});});}catch(_){}}'
+'function selectSendAsset(m,h){var ap=m.querySelector(".lx-asset-pick");if(ap){var ico=ap.querySelector(".lx-ap-ico"),cd=ap.querySelector(".lx-ap-code");if(cd)cd.textContent=h.code;if(ico){ico.setAttribute("data-lxc",h.native?"":(h.code||""));ico.setAttribute("data-lxi",h.native?"":(h.iss||(window.__lxAssets||{})[h.code]||""));var lg=h.native?STELLAR_URI:(h.logo||(window.__lxLogos||{})[h.code]||"");if(lg){ico.style.setProperty("--lxlogo","url("+JSON.stringify(lg)+")");ico.setAttribute("data-l","");}else{ico.style.setProperty("--lxlogo","linear-gradient("+colFor(h.code)+","+colFor(h.code)+")");ico.setAttribute("data-l",h.code.slice(0,1).toUpperCase());lxHarvest(ico,h.code);try{lxHealAllLogos(m);}catch(_){}}ico.innerHTML="";}}var sp=m.querySelectorAll("span");for(var k=0;k<sp.length;k++){if(/^Balance:/.test((sp[k].textContent||"").trim())){var st=sp[k].querySelector("strong");if(st)st.textContent=num(h.bal,7)+" "+h.code;break;}}m.__lxsym=h.code;validateSend(m);}'
+'function openAssetMenu(m,pick){var ex=document.querySelector(".lx-asset-menu");if(ex){ex.remove();return;}var hs=window.__lxHoldings||[];if(!hs.length)return;var menu=document.createElement("div");menu.className="lx-asset-menu lx-hassearch";'
+'var sw=document.createElement("div");sw.className="lx-am-searchwrap";sw.innerHTML=\'<svg class="lx-am-searchic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>\';var si=document.createElement("input");si.className="lx-am-search";si.placeholder="Search your assets\\u2026";sw.appendChild(si);menu.appendChild(sw);'
+'var list=document.createElement("div");list.className="lx-am-list";menu.appendChild(list);'
+'function draw(arr){list.innerHTML="";arr.forEach(function(h){var b=document.createElement("button");b.type="button";b.className="lx-am-item";var lg=h.native?STELLAR_URI:(h.logo||(window.__lxLogos||{})[h.code]||"");var ic=lg?(\'<span class="lx-am-ic" style="overflow:hidden"><img src="\'+esc(lg)+\'"></span>\'):(\'<span class="lx-am-ic" style="background:\'+colFor(h.code)+\'">\'+esc(h.code.slice(0,1).toUpperCase())+\'</span>\');b.innerHTML=ic+\'<span class="lx-am-code">\'+esc(h.code)+\'</span><span class="lx-am-bal">\'+num(h.bal,h.bal<1?6:2)+\'</span>\';b.addEventListener("click",function(ev){ev.preventDefault();ev.stopPropagation();var lg2=lxReadItemLogo(b);if(lg2&&!h.native){h.logo=lg2;window.__lxLogos=window.__lxLogos||{};window.__lxLogos[h.code]=lg2;}selectSendAsset(m,h);menu.remove();});list.appendChild(b);});if(!list.children.length)list.innerHTML=\'<div class="lx-am-empty">No matches</div>\';}'
+'draw(hs);si.addEventListener("input",function(){var q=si.value.trim().toLowerCase();draw(q?hs.filter(function(h){return (h.code||"").toLowerCase().indexOf(q)>=0;}):hs);});'
+'document.body.appendChild(menu);var r=pick.getBoundingClientRect();menu.style.position="fixed";menu.style.top=(r.bottom+6)+"px";menu.style.left=Math.max(8,r.right-230)+"px";menu.style.zIndex="100000";setTimeout(function(){try{si.focus();}catch(_){}},30);}'
+'function wireSendAssetPicker(){document.addEventListener("click",function(e){var pick=e.target&&e.target.closest?e.target.closest(".asset-pick"):null;if(pick){var m=pick.closest(".modal-overlay");if(m&&m.querySelector("input.mono")){e.preventDefault();e.stopPropagation();openAssetMenu(m,pick);return;}}if(!(e.target.closest&&e.target.closest(".lx-asset-menu"))){var mm=document.querySelector(".lx-asset-menu");if(mm)mm.remove();}},true);}'
+'function clearSend(m){if(!m)return;var a=m.querySelector(\'input[placeholder="0.00"]\');if(a)a.value="";var r=m.querySelector("input.mono");if(r)r.value="";var mo=m.querySelector(".lx-memo");if(mo)mo.value="";var rb=[].slice.call(m.querySelectorAll("button")).filter(function(b){return /Review.*Send/i.test((b.textContent||"").replace(/\\s+/g," "));})[0];if(rb){rb.disabled=false;if(rb.__lxorigHTML)rb.innerHTML=rb.__lxorigHTML;}var hs=window.__lxHoldings||[],nat=hs.filter(function(h){return h.native;})[0],sel=window.__lxSendPre||nat;if(sel)selectSendAsset(m,sel);}'
+'function wireSend(){document.addEventListener("click",function(e){var b=e.target&&e.target.closest?e.target.closest("button"):null;if(!b)return;var t=(b.textContent||"").replace(/\\s+/g," ").trim();if(!/Review.*Send/i.test(t))return;var m=b.closest(".modal-overlay");if(!m)return;var amtI=m.querySelector(\'input[placeholder="0.00"]\'),recI=m.querySelector("input.mono");if(!amtI||!recI)return;e.preventDefault();e.stopPropagation();if(b.disabled)return;if(!b.__lxorigHTML)b.__lxorigHTML=b.innerHTML;var amount=parseFloat((amtI.value||"").replace(/,/g,""))||0,dest=(recI.value||"").trim(),memoI=m.querySelector(".lx-memo"),memoRaw=memoI?(memoI.value||"").trim():"",memo=memoRaw,memoT=((m.querySelector(".lx-memo-type")||{}).value||"text"),symB=m.querySelector(".asset-pick"),sym=m.__lxsym||(symB?((symB.textContent||"").match(/[A-Z0-9]{2,12}/)||["XLM"])[0]:"XLM");if(!/^G[A-Z2-7]{55}$/.test(dest)){lxToast("Enter a valid Stellar address (G\\u2026)");return;}'
// MEMO validation. Exchanges reject or fail to credit a deposit whose memo is the wrong TYPE or has stray
// characters, and the user only finds out when the funds do not appear. Check before we ask them to sign.
// Written without \\\\d / \\\\s on purpose: this is emitted inside a JS string, where a lone backslash is lost.
+'if(memoT==="id"&&memoRaw){memo=memoRaw.replace(/[ ,]/g,"");if(!/^[0-9]+$/.test(memo)){lxToast("Memo ID must be digits only");return;}try{if(memo.length>20||BigInt(memo)>BigInt("18446744073709551615")){lxToast("Memo ID is out of range");return;}}catch(_){}}'
// A memo copied from an exchange can arrive already formatted ("242,102,035") if it was copied from a
// page that groups digits. As TEXT we used to forward that verbatim, and the deposit lands unattributed
// because the exchange matches on the bare number. If a text memo is nothing but digits and separators,
// strip them and SAY SO — silently changing what someone is about to sign is not acceptable either.
+'if(memoT==="text"&&memo&&/^[0-9][0-9 ,]*$/.test(memo)&&/[ ,]/.test(memo)){memo=memo.replace(/[ ,]/g,"");lxToast("Removed separators from the memo \\u2014 sending "+memo);}'
+'if(memoT==="text"&&memo){var _mb;try{_mb=new TextEncoder().encode(memo).length;}catch(_){_mb=memo.length;}if(_mb>28){lxToast("Text memo is too long \\u2014 28 bytes max");return;}}'
+'if(!(amount>0)){lxToast("Enter an amount to send");return;}var _av=(sym==="XLM")?window.__lxNative:((window.__lxHoldings||[]).filter(function(x){return x.code===sym;})[0]||{}).bal;if(_av!=null&&amount>_av){lxToast("Amount exceeds your "+sym+" balance");return;}var ot=b.textContent;b.disabled=true;b.textContent="Signing\\u2026";lxPay(dest,sym,amount,memo,memoT).then(function(){b.textContent="Sent \\u2713";lxToast("Sent "+amount+" "+sym);setTimeout(function(){var cl=m.querySelector(".modal-close,[data-close],.close");if(cl)cl.click();else{m.classList.remove("open");m.setAttribute("hidden","");}},1200);}).catch(function(err){b.disabled=false;b.textContent=ot;lxToast((err&&err.message)||"Send failed");});},true);}'
// ---- My Assets row actions (Trade on DEX / Send / more) wired to finalized flows ----
// row-menu (⋮) items: wire "View on Stellar Explorer" (asset page) and "Pin to top"
+'function closeRowMenu(){var m=document.querySelector(".row-menu.open");if(m)m.classList.remove("open");}'
+'function applyPins(){var tb=document.getElementById("assetsTable");if(!tb)return;var pinned;try{pinned=JSON.parse(localStorage.getItem("lumos.pinned")||"[]");}catch(_){return;}for(var i=pinned.length-1;i>=0;i--){var rows=tb.querySelectorAll("tr");for(var j=0;j<rows.length;j++){var ic=rows[j].querySelector(".lx-aico");if(ic&&ic.getAttribute("data-lxc")===pinned[i]){var row=rows[j];tb.insertBefore(row,tb.firstChild);row.classList.add("lx-pinned");var nm=row.querySelector(".nm");if(nm&&!nm.querySelector(".lx-pin-badge")){var pb=document.createElement("span");pb.className="lx-pin-badge";pb.title="Pinned";pb.innerHTML=\'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path></svg>\';nm.appendChild(pb);}break;}}}}'
+'function pinAsset(code){if(!code)return;var pinned;try{pinned=JSON.parse(localStorage.getItem("lumos.pinned")||"[]");}catch(_){pinned=[];}var ix=pinned.indexOf(code),unpin=ix>=0;if(unpin)pinned.splice(ix,1);else pinned.unshift(code);try{localStorage.setItem("lumos.pinned",JSON.stringify(pinned));}catch(_){}if(unpin){var tb=document.getElementById("assetsTable");if(tb){var rows=tb.querySelectorAll("tr");for(var i=0;i<rows.length;i++){var ic=rows[i].querySelector(".lx-aico");if(ic&&ic.getAttribute("data-lxc")===code){rows[i].classList.remove("lx-pinned");var bd=rows[i].querySelector(".lx-pin-badge");if(bd)bd.remove();break;}}}lxToast(code+" unpinned");}else{applyPins();lxToast(code+" pinned to top");}}'
+'function wireRowMenu(){document.addEventListener("click",function(e){var btn=e.target&&e.target.closest?e.target.closest(".row-menu button"):null;if(!btn)return;var t=(btn.textContent||"").trim();var a=window.__lxActiveAsset||{};if(/View on Stellar Explorer/i.test(t)){e.preventDefault();e.stopPropagation();var u=(a.code&&a.iss)?("https://stellar.expert/explorer/public/asset/"+encodeURIComponent(a.code)+"-"+a.iss):("https://stellar.expert/explorer/public/account/"+ME);window.open(u,"_blank","noopener");closeRowMenu();return;}if(/Pin to top|Unpin/i.test(t)){e.preventDefault();e.stopPropagation();pinAsset(a.code);closeRowMenu();return;}},true);}'
// top-left wallet chip: the external-link icon opens the account on Stellar.Expert
+'function wireWalletLink(){var row=document.querySelector(".hero-id-row");if(!row)return;var btns=row.querySelectorAll("button,a");for(var i=0;i<btns.length;i++){var b=btns[i];if(b.__lxlink)continue;var poly=b.querySelector("polyline");if(poly&&/15\\s+3\\s+21\\s+3\\s+21\\s+9/.test(poly.getAttribute("points")||"")){b.__lxlink=1;(function(bb){bb.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();window.open("https://stellar.expert/explorer/public/account/"+ME,"_blank","noopener");},true);})(b);}}}'
+'function wireNavGuard(){var lastClick=null;document.addEventListener("click",function(e){lastClick=e.target;},true);function bad(t){try{if(!t||!t.closest)return false;if(t.closest("a[href]"))return false;if(t.closest("main")||t.closest(".page")||t.closest(".assets-card")||t.closest(".lp-card")||t.closest(".hero")||t.closest(".insights-rail"))return true;var cl=(typeof t.className==="string"?t.className:"");if(t.tagName==="MAIN"||t.tagName==="BODY"||/(^|\\s)(app|page|main|content|wrap|shell|layout)(\\s|$)/.test(cl))return true;}catch(_){}return false;}var iv=setInterval(function(){if(typeof window.lxNavigate==="function"&&!window.__lxNavGuarded){window.__lxNavGuarded=1;var orig=window.lxNavigate;window.lxNavigate=function(c){var t=(window.event&&window.event.target)||lastClick;if(bad(t))return;return orig.apply(this,arguments);};clearInterval(iv);}},150);setTimeout(function(){clearInterval(iv);},7000);}'
+'function wireAssetActions(){var tb=document.getElementById("assetsTable");if(!tb||tb.__lxqa)return;tb.__lxqa=1;tb.addEventListener("click",function(e){var btn=e.target.closest&&e.target.closest(".qa-row-btn");if(!btn)return;var row=btn.closest("tr"),ico=row?row.querySelector(".lx-aico"):null,code=ico?ico.getAttribute("data-lxc"):"",iss=ico?ico.getAttribute("data-lxi"):"",lbl=(btn.textContent||"").trim();if(btn.classList.contains("icon-only")){window.__lxActiveAsset={code:code,iss:iss,row:row};setTimeout(function(){var mn=document.querySelector(".row-menu");if(!mn)return;var pb=[].slice.call(mn.querySelectorAll("button")).filter(function(x){return /Pin to top|Unpin/i.test(x.textContent||"");})[0];if(!pb)return;var pinned=[];try{pinned=JSON.parse(localStorage.getItem("lumos.pinned")||"[]");}catch(_){}var isP=pinned.indexOf(code)>=0;for(var i=0;i<pb.childNodes.length;i++){if(pb.childNodes[i].nodeType===3&&pb.childNodes[i].textContent.trim()){pb.childNodes[i].textContent=isP?" Unpin":" Pin to top";break;}}},70);return;}if(/Trade/i.test(lbl)){var _isX=(!code||code==="XLM");window.location.href=_isX?"lumoscore-dex.html":("lumoscore-dex-asset.html?asset="+encodeURIComponent(code)+(iss?("-"+iss):""));return;}if(/Send/i.test(lbl)){var sb=[].slice.call(document.querySelectorAll("button")).filter(function(x){return (x.textContent||"").trim()==="Send"&&(x.className||"").indexOf("qa-row-btn")<0;})[0];if(sb){var held=(window.__lxHoldings||[]).filter(function(h){return h.code===code;})[0]||{code:code,iss:iss,native:code==="XLM",bal:0};if(!held.native&&!held.logo)held.logo=(window.__lxLogos||{})[held.code]||"";window.__lxSendPre=held;sb.click();var _presel=function(){var m=document.querySelector(".modal-overlay.open");if(m&&typeof selectSendAsset==="function")selectSendAsset(m,held);};_presel();setTimeout(_presel,60);setTimeout(_presel,220);setTimeout(_presel,480);setTimeout(function(){window.__lxSendPre=null;},1400);}return;}});}'
+'function renderOrders(offRecs){var block=document.querySelector(".orders-block");if(!block)return;'
+'if(!offRecs.length){block.innerHTML=\'<div style="padding:26px 22px;text-align:center;color:var(--text-muted);font-size:14px">No open orders on the DEX</div>\';var ca=document.querySelector(".order-cancel-all,[data-cancel-all]");if(ca)ca.style.display="none";var cah=findCancelAll();if(cah)cah.style.display="none";return;}'
+'var h="";offRecs.forEach(function(o){var sc=codeOf(o.selling),bc=codeOf(o.buying);var price=+o.price||0,amount=+o.amount||0,total=amount*price;'
// show only the traded (non-native) asset — not the XLM side (this is an order, not a pool)
+'var sNat=(o.selling&&o.selling.asset_type==="native");var da=sNat?bc:sc;'
+'var daIss=sNat?((o.buying&&o.buying.asset_issuer)||""):((o.selling&&o.selling.asset_issuer)||"");var daLg=(window.__lxLogos||{})[da]||"";var daIc=daLg?("url(\\x27"+String(daLg).replace(/\\x27/g,"%27")+"\\x27)"):colFor(da);'
// quote the order in token terms: Price = XLM per token, Amount = token units, Total = XLM value. Stellar
// stores price/amount in "buying per selling"/"selling amount"; when the wallet is BUYING the token (selling
// XLM), price is token-per-XLM and amount is XLM -> invert both so it always reads e.g. "0.0011 XLM per AQUA".
+'var pxXlm=sNat?(price>0?1/price:0):price;var tokAmt=sNat?amount*price:amount;var xlmTotal=tokAmt*pxXlm;'
+'h+=\'<div class="order-row" data-oid="\'+esc(o.id)+\'" data-price="\'+esc(o.price)+\'" data-amt="\'+esc(o.amount)+\'" data-snt="\'+(sNat?"1":"")+\'" data-sc="\'+esc((o.selling&&o.selling.asset_code)||"")+\'" data-si="\'+esc((o.selling&&o.selling.asset_issuer)||"")+\'" data-bnt="\'+((o.buying&&o.buying.asset_type==="native")?"1":"")+\'" data-bc="\'+esc((o.buying&&o.buying.asset_code)||"")+\'" data-bi="\'+esc((o.buying&&o.buying.asset_issuer)||"")+\'"><div class="order-pair"><div class="pair-ico"><div class="b lx-pico" style="--ic:\'+daIc+\'" data-lxc="\'+esc(da)+\'" data-lxi="\'+esc(daIss)+\'" data-l="\'+(daLg?"":esc(da.slice(0,1)))+\'"></div></div>\''
// zero-size svg guard: the data-logo painter hijacks rounded 1-5-char elements ("Sell" chips became EURC
// logo slots and were emptied) — isCandidate() skips any element containing an svg/img child.
+'+\'<div class="pair-text"><div class="name">\'+esc(da)+\'</div><span class="side \'+(sNat?"buy":"sell")+\'">\'+(sNat?"Buy":"Sell")+\'<svg width="0" height="0" aria-hidden="true" style="position:absolute;width:0;height:0"></svg></span></div></div>\''
+'+\'<div class="order-details"><div class="col"><div class="k">Price</div><div class="v">\'+amt(pxXlm)+\' XLM</div></div><div class="col"><div class="k">Amount</div><div class="v">\'+amt(tokAmt)+\' \'+esc(da)+\'</div></div><div class="col"><div class="k">Total</div><div class="v">\'+amt(xlmTotal)+\' XLM</div></div></div>\''
+'+\'<button class="order-cancel">Cancel</button></div>\';});block.innerHTML=h;try{lxHealAllLogos(block);}catch(_){}'
// finalized wires cancel per-row at load, so our rebuilt buttons lose it -> delegated handler (survives rebuilds)
+'function orderCount(){var left=block.querySelectorAll(".order-row").length;var oh=findH2("Open Orders");if(oh){var m=oh.querySelector(".meta");if(m)m.textContent=left+" active";}if(!left){block.innerHTML=\'<div style="padding:26px 22px;text-align:center;color:var(--text-muted);font-size:14px">No open orders on the DEX</div>\';var cah0=findCancelAll();if(cah0)cah0.style.display="none";}return left;}'
+'if(!block.__lxCancel){block.__lxCancel=1;block.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest(".order-cancel");if(!b)return;e.preventDefault();e.stopPropagation();var row=b.closest(".order-row");if(!row||b.disabled)return;var ot=b.textContent;b.disabled=true;b.textContent="Signing\\u2026";lxCancel(row).then(function(){b.textContent="Cancelled";row.style.transition="opacity .25s,transform .25s";row.style.opacity="0";row.style.transform="translateX(-8px)";setTimeout(function(){row.remove();orderCount();},260);}).catch(function(err){b.disabled=false;b.textContent=ot;lxToast((err&&err.message)||"Cancel failed");});});}'
+'var cah=findCancelAll();if(cah&&!cah.__lxAll){cah.__lxAll=1;cah.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();var rows=[].slice.call(block.querySelectorAll(".order-row"));if(!rows.length)return;if(cah.disabled)return;var ot=cah.textContent;cah.disabled=true;cah.textContent="Signing\\u2026";lxCancelAll(rows).then(function(){block.innerHTML="";orderCount();cah.disabled=false;cah.textContent=ot;}).catch(function(err){cah.disabled=false;cah.textContent=ot;lxToast((err&&err.message)||"Cancel all failed");});},true);}}'
+'function findCancelAll(){var b=document.querySelectorAll("button");for(var i=0;i<b.length;i++){if(/cancel all/i.test(b[i].textContent))return b[i];}return null;}'
// ---- op -> activity row ----
// Cross-chain (CCTP) burns are logged by the bridge to localStorage; match a Soroban op's tx hash to that
// record so the activity row can say "Cross-chain swap" with real amounts instead of "Contract call".
+'var _cctpTxCache=null;function lxCctpTxByHash(h){try{if(_cctpTxCache===null)_cctpTxCache=JSON.parse(localStorage.getItem("lumos.cctp.txs")||"[]");if(!h)return null;for(var i=0;i<_cctpTxCache.length;i++){if(_cctpTxCache[i]&&_cctpTxCache[i].hash===h)return _cctpTxCache[i];}}catch(_){}return null;}'
// Trade-Asset swaps record {hash,from,to,amounts} to localStorage; match a Soroban swap op to it so the feed says "Swap XLM -> SHX" (with amounts) instead of "Contract call".
+'var _swapTxCache=null;function lxSwapByHash(h){try{if(_swapTxCache===null)_swapTxCache=JSON.parse(localStorage.getItem("lumos.swaps")||"[]");if(!h)return null;for(var i=0;i<_swapTxCache.length;i++){if(_swapTxCache[i]&&_swapTxCache[i].hash===h)return _swapTxCache[i];}}catch(_){}return null;}'
+'function mapOp(o){var day=dayLabel(o.created_at);var st="confirmed",stl="Confirmed";var A=function(c){return c==="native"||!c?"XLM":c;};'
+'if(o.type==="payment"){var c=A(o.asset_code),ai=o.asset_issuer||"",nat=(o.asset_type==="native"||!o.asset_code);if(o.from===ME)return{kind:"sent",type:"Sent "+c,metaPre:"To",addr:o.to,meta:"To "+shrt(o.to),code:c,iss:ai,native:nat,amt:"-"+amt(o.amount)+" "+c,day:day,st:st,stl:stl};return{kind:"received",type:"Received "+c,metaPre:"From",addr:o.from,meta:"From "+shrt(o.from),code:c,iss:ai,native:nat,amt:"+"+amt(o.amount)+" "+c,day:day,st:st,stl:stl};}'
+'if(o.type&&o.type.indexOf("path_payment")===0){var cc=A(o.asset_code),sc=A(o.source_asset_code);return{kind:"swap",type:"Swap "+sc+" \\u2192 "+cc,meta:"via Stellar DEX",srcCode:sc,srcNative:(o.source_asset_type==="native"||!o.source_asset_code),srcIss:o.source_asset_issuer||"",dstCode:cc,dstNative:(o.asset_type==="native"||!o.asset_code),dstIss:o.asset_issuer||"",amt:"+"+amt(o.amount)+" "+cc,amtSub:(o.source_amount?("-"+amt(o.source_amount)+" "+sc):""),day:day,st:"filled",stl:"Filled"};}'
+'if(o.type==="create_account"){if(o.account===ME)return{kind:"received",type:"Account funded",metaPre:"From",addr:o.funder,meta:"From "+shrt(o.funder),code:"XLM",native:true,amt:"+"+amt(o.starting_balance)+" XLM",day:day,st:st,stl:stl};return{kind:"sent",type:"Created account",metaPre:"",addr:o.account,meta:shrt(o.account),code:"XLM",native:true,amt:"-"+amt(o.starting_balance)+" XLM",day:day,st:st,stl:stl};}'
+'if(o.type==="change_trust"){var tc=A(o.asset_code);var removed=(+o.limit===0);return{kind:"order",tl:1,code:tc,native:(o.asset_type==="native"||!o.asset_code),iss:o.asset_issuer||"",type:"Trustline "+(removed?"removed":"added"),meta:shrt(o.trustee||o.asset_issuer),amt:"",day:day,st:st,stl:stl};}'
// "Order XLM/USDC · DEX offer · 0 XLM" said nothing about what happened. Horizon distinguishes the three
// cases plainly: amount 0 is a cancellation, offer_id 0 is a brand-new offer, anything else edits an
// existing one. The "0 XLM" was the cancel's own zero amount being printed as if it were a trade size.
+'if(o.type&&o.type.indexOf("offer")>=0){var sll=A(o.selling_asset_code),buy=A(o.buying_asset_code);'
+'var _oa=+o.amount||0,_oid=String(o.offer_id||"0"),_cancel=(_oa===0),_isNew=(_oid==="0");'
+'var _verb=_cancel?"Order cancelled":(_isNew?"Order placed":"Order updated");'
+'var _px=(+o.price>0)?(" @ "+amt(o.price)+" "+buy):"";'
+'return{kind:"order",type:_verb+" "+sll+"/"+buy,meta:_cancel?("DEX offer \\u00b7 "+sll+"/"+buy):("Sell "+amt(_oa)+" "+sll+_px),amt:_cancel?"":(amt(_oa)+" "+sll),day:day,st:_cancel?"cancelled":"pending",stl:_cancel?"Cancelled":"Pending"};}'
+'function _lpRes(arr){return (arr||[]).map(function(x){var cd=(x.asset==="native"||!x.asset)?"XLM":String(x.asset).split(":")[0];return amt(x.amount)+" "+cd;});}'
+'function _lpAsset(x){var s=x&&x.asset;if(!s||s==="native")return{c:"XLM",n:true,i:""};var p=String(s).split(":");return{c:p[0],n:false,i:p[1]||""};}'
+'if(o.type==="liquidity_pool_deposit"){var _rd=_lpRes(o.reserves_deposited),_ra=o.reserves_deposited||[],_a1=_lpAsset(_ra[0]),_a2=_lpAsset(_ra[1]);return{kind:"lp",lp:1,c1:_a1.c,n1:_a1.n,i1:_a1.i,c2:_a2.c,n2:_a2.n,i2:_a2.i,type:"Added liquidity",meta:_rd.length?_rd.join(" + "):("Pool "+String(o.liquidity_pool_id||"").slice(0,8)),amt:"",day:day,st:st,stl:stl};}'
+'if(o.type==="liquidity_pool_withdraw"){var _rw=_lpRes(o.reserves_received),_rb=o.reserves_received||[],_b1=_lpAsset(_rb[0]),_b2=_lpAsset(_rb[1]);return{kind:"lp",lp:1,c1:_b1.c,n1:_b1.n,i1:_b1.i,c2:_b2.c,n2:_b2.n,i2:_b2.i,type:"Removed liquidity",meta:_rw.length?_rw.join(" + "):("Pool "+String(o.liquidity_pool_id||"").slice(0,8)),amt:"",day:day,st:st,stl:stl};}'
+'if(o.type==="account_merge")return{kind:"sent",type:"Account merge",meta:shrt(o.into),amt:"",day:day,st:st,stl:stl};'
+'if(o.type&&o.type.indexOf("claimable_balance")>=0){var _cr=o.type.indexOf("create")>=0;var _cc=(o.asset==="native"||!o.asset)?"XLM":String(o.asset).split(":")[0];return{kind:"claim",type:(_cr?"Created":"Claimed")+" claimable balance",meta:"Stellar",amt:o.amount?((_cr?"-":"+")+amt(o.amount)+" "+_cc):"",day:day,st:st,stl:stl};}'
+'if(o.type==="set_options")return{kind:"settings",type:"Account settings",meta:"Options updated",amt:"",day:day,st:st,stl:stl};'
+'if(o.type==="manage_data")return{kind:"data",type:"Data entry",meta:o.name?String(o.name).slice(0,24):"",amt:"",day:day,st:st,stl:stl};'
// A Soroban swap reads as "Contract call" the moment it was not made in THIS browser — lxSwapByHash only
// knows swaps we recorded locally at submit time. Horizon already describes the transfers: every invoke op
// carries asset_balance_changes, so the leg that LEFT this account is what was paid and the leg that ARRIVED
// is what was received. That needs no local record and works for history made anywhere.
+'function _abcSwap(o){var ch=o&&o.asset_balance_changes;if(!ch||!ch.length)return null;var paid=null,got=null;'
+'ch.forEach(function(c){if(!c||c.type!=="transfer")return;var a={code:(c.asset_type==="native"||!c.asset_code)?"XLM":c.asset_code,iss:c.asset_issuer||"",amt:+c.amount||0};'
+'if(c.from===ME&&!paid)paid=a;else if(c.to===ME&&!got)got=a;});'
+'if(!paid||!got||paid.code===got.code)return null;return{paid:paid,got:got};}'
+'if(o.type&&o.type.indexOf("invoke_host_function")>=0){var _ab=_abcSwap(o);'
+'if(_ab)return{kind:"swap",type:"Swap "+_ab.paid.code+" \\u2192 "+_ab.got.code,meta:"via Soroswap",srcCode:_ab.paid.code,srcNative:_ab.paid.code==="XLM",srcIss:_ab.paid.iss,dstCode:_ab.got.code,dstNative:_ab.got.code==="XLM",dstIss:_ab.got.iss,amt:"+"+amt(_ab.got.amt)+" "+_ab.got.code,amtSub:"-"+amt(_ab.paid.amt)+" "+_ab.paid.code,day:day,st:"filled",stl:"Filled"};'
+'var sw=lxSwapByHash(o.transaction_hash);if(sw){return{kind:"swap",type:"Swap "+sw.from+" \\u2192 "+sw.to,meta:"via Soroswap",srcCode:sw.from,srcNative:sw.from==="XLM",srcIss:sw.fromIss||"",dstCode:sw.to,dstNative:sw.to==="XLM",dstIss:sw.toIss||"",amt:"+"+amt(sw.toAmt)+" "+sw.to,amtSub:"-"+amt(sw.fromAmt)+" "+sw.from,day:day,st:"filled",stl:"Filled"};}var bx=lxCctpTxByHash(o.transaction_hash);if(bx){var _sk=bx.srcKey||"XLM",_nn=bx.net||"destination chain";return{kind:"bridge",type:"Cross-chain swap",meta:"via Circle CCTP \\u00b7 "+_nn,amt:"+"+amt(bx.amount)+" USDC",amtSub:"-"+amt(bx.srcAmount)+" "+_sk,day:day,st:"filled",stl:"Bridged"};}return{kind:"contract",type:"Contract call",meta:"Soroban",amt:"",day:day,st:st,stl:stl};}'
+'if(o.type==="bump_sequence")return{kind:"settings",type:"Sequence bumped",meta:"",amt:"",day:day,st:st,stl:stl};'
+'if(o.type&&o.type.indexOf("clawback")>=0)return{kind:"sent",type:"Clawback",meta:"",amt:"",day:day,st:st,stl:stl};'
+'if(o.type&&(o.type.indexOf("trust")>=0||o.type.indexOf("flags")>=0))return{kind:"order",type:(o.type||"").replace(/_/g," "),meta:"",amt:"",day:day,st:st,stl:stl};'
+'return{kind:"other",type:(o.type||"Operation").replace(/_/g," ").replace(/^./,function(m){return m.toUpperCase();}),meta:"",amt:"",day:day,st:st,stl:stl};}'
// when the (hero) Send popup opens, replace its mock "Balance:" with the real native XLM balance
+'function fixBalances(scope){if(window.__lxNative==null)return;scope=scope||document;var _fmtx=function(n){return n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:7});};var _tot=window.__lxNative;var _sp=(window.__lxMaxXLM!=null)?window.__lxMaxXLM:_tot;var f=_fmtx(_sp)+" XLM";var _tip=(window.__lxMaxXLM!=null)?(_fmtx(_sp)+" XLM spendable \u2014 "+_fmtx(_tot)+" XLM total, "+_fmtx(Math.max(0,_tot-_sp))+" XLM locked as the Stellar account reserve"):"";var els=scope.querySelectorAll("span,div,p,label");for(var i=0;i<els.length;i++){var el=els[i];if(el.closest&&el.closest("#modalSwap"))continue;var st=el.querySelector?el.querySelector("strong"):null;if(st&&el.children.length===1&&/Balance:\\s*[\\d.,]+\\s*XLM(\\s|$)/.test(el.textContent||"")){st.textContent=f;if(_tip)el.title=_tip;continue;}if(el.children.length===0&&/Balance:\\s*[\\d.,]+\\s*XLM/.test(el.textContent||"")){el.textContent=(el.textContent).replace(/(Balance:\\s*)[\\d.,]+\\s*XLM/,"$1"+f);if(_tip)el.title=_tip;}}}'
// Send popup: replace the Network-fee row with a Memo field + add a Paste button to the recipient input
+'function enhanceSend(m){try{if(!m||!m.querySelectorAll)return;var rec=m.querySelector("input.mono")||[].slice.call(m.querySelectorAll("input")).filter(function(i){return /G\\.\\.\\.|domain/i.test(i.placeholder||"");})[0];if(!rec)return;var fee=[].slice.call(m.querySelectorAll("div")).filter(function(d){var sp=d.querySelector("span");return sp&&d.children.length<=2&&/^Network fee$/i.test((sp.textContent||"").trim());})[0];if(fee&&!fee.__lxMemo){fee.__lxMemo=1;var f=document.createElement("div");f.className="field lx-memo-field";f.innerHTML=\'<div class="field-label" style="display:flex;align-items:center;gap:8px">Memo <span class="meta">optional</span><select class="lx-memo-type" style="margin-left:auto;font:inherit;font-size:11.5px;padding:2px 6px;border-radius:6px;border:1px solid var(--border);background:var(--surface-2);color:var(--text)"><option value="text">Text</option><option value="id">ID</option></select></div><input class="field-input lx-memo" maxlength="28" placeholder="Memo (optional)">\';fee.parentNode.replaceChild(f,fee);}'
+'var rec=m.querySelector("input.mono")||[].slice.call(m.querySelectorAll("input")).filter(function(i){return /G\\.\\.\\.|domain/i.test(i.placeholder||"");})[0];if(rec&&!rec.__lxPaste){rec.__lxPaste=1;var wrap=document.createElement("div");wrap.style.position="relative";rec.parentNode.insertBefore(wrap,rec);wrap.appendChild(rec);rec.style.paddingRight="70px";var pb=document.createElement("button");pb.type="button";pb.className="lx-paste-btn";pb.textContent="Paste";pb.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();if(navigator.clipboard&&navigator.clipboard.readText){navigator.clipboard.readText().then(function(x){rec.value=(x||"").trim();rec.dispatchEvent(new Event("input",{bubbles:true}));rec.focus();}).catch(function(){lxToast("Clipboard blocked \\u2014 paste manually (Ctrl+V)");});}else{lxToast("Clipboard unavailable \\u2014 paste manually");}});wrap.appendChild(pb);}var fp=m.querySelector(".asset-pick");if(fp&&!m.querySelector(".lx-asset-pick")){fp.style.display="none";var ap=document.createElement("button");ap.type="button";ap.className="lx-asset-pick";ap.setAttribute("data-lx-noswap","");ap.innerHTML=\'<span class="lx-ap-ico" data-lx-noswap=""></span><span class="lx-ap-code" data-lx-noswap="">XLM</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>\';fp.parentNode.insertBefore(ap,fp.nextSibling);ap.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();openAssetMenu(m,ap);});m.__lxsym="XLM";var nat=(window.__lxHoldings||[]).filter(function(h){return h.native;})[0],sel=window.__lxSendPre||nat;if(sel)selectSendAsset(m,sel);}var famt=m.querySelector(".field-amt"),meta=m.querySelector(".field-meta"),maxb=meta?meta.querySelector(".pill-btn"):null;if(famt&&maxb&&!maxb.__lxmoved){maxb.__lxmoved=1;famt.classList.add("lx-send-amt");maxb.classList.add("lx-max-inline");famt.appendChild(maxb);}}catch(_){}}'
+'function lxOpenModal(){return document.querySelector(".modal-overlay.open")||[].slice.call(document.querySelectorAll(".modal-overlay")).filter(function(o){return !o.hasAttribute("hidden");})[0]||null;}'
+'function wireBalMax(){fixBalances(document);document.addEventListener("click",function(e){var b=e.target&&e.target.closest?e.target.closest("button"):null;if(!b)return;var t=(b.textContent||"").trim();if(t==="Send"||t.indexOf("Receive")>=0||/^swap$/i.test(t)){if(t==="Send"){var _r=document.querySelector("input.mono");if(_r)clearSend(_r.closest(".modal-overlay"));}var run=function(){var mm=lxOpenModal();fixBalances(mm||document);if(t==="Send"&&mm){enhanceSend(mm);validateSend(mm);}};setTimeout(run,50);setTimeout(run,180);return;}if(!/^max$/i.test(t))return;var m=b.closest(".modal-overlay");if(!m||!m.querySelector("input.mono"))return;var doMax=function(){var sym=m.__lxsym||"XLM",num;if(sym==="XLM"){num=(window.__lxMaxXLM!=null?window.__lxMaxXLM:window.__lxNative);}else{var h=(window.__lxHoldings||[]).filter(function(x){return x.code===sym;})[0];num=h?h.bal:null;}if(num==null||!isFinite(num))return;var inp=m.querySelector(\'input[placeholder="0.00"]\')||m.querySelector("input:not(.mono)");if(inp){var _f=Math.floor(num*1e7)/1e7;inp.value=_f>0?_f.toFixed(7).replace(/0+$/,"").replace(/\\.$/,""):"0";inp.dispatchEvent(new Event("input",{bubbles:true}));}};requestAnimationFrame(doMax);setTimeout(doMax,90);},false);}'
// Receive popup shows a fake/invalid address -> replace with the real connected G-address
+'function makeQR(txt){var lv=[[0,"H"],[0,"Q"],[8,"H"],[10,"H"],[0,"M"],[4,"M"]];for(var i=0;i<lv.length;i++){try{var q=window.qrcode(lv[i][0],lv[i][1]);q.addData(txt);q.make();return q;}catch(e){}}return null;}'
+'function fixQR(){try{if(!window.qrcode)return;var fr=document.querySelector(".qr-frame svg")||document.querySelector(".qr-display svg");if(!fr||fr.__lxqr)return;var q=makeQR(ME);if(!q)return;var n=q.getModuleCount(),s="";for(var r=0;r<n;r++){for(var c=0;c<n;c++){if(q.isDark(r,c))s+=\'<rect x="\'+c+\'" y="\'+r+\'" width="1.04" height="1.04"></rect>\';}}fr.setAttribute("viewBox","0 0 "+n+" "+n);fr.setAttribute("fill","#0d1117");fr.style.background="#fff";fr.innerHTML=s;fr.__lxqr=1;fr.classList.add("lx-qr-ready");}catch(e){}}'
+'function fixReceive(){var els=document.querySelectorAll("[data-copy]");for(var i=0;i<els.length;i++){var el=els[i];if(((el.textContent||"").trim()).indexOf("GA7K5N4M")===0){el.textContent=ME;el.setAttribute("data-copy",ME);}}fixQR();}'
+'function enhanceReceive(){try{var disp=document.querySelector(".qr-display");if(!disp)return;var body=disp.closest(".modal-body");if(!body||body.__lxrecv)return;body.__lxrecv=1;var addr=ME||(function(){var a=body.querySelector("[data-copy]");return a?(a.getAttribute("data-copy")||a.textContent||""):"";})();var warnSVG=\'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>\';var FLAME=\'<svg viewBox="0 0 24 24"><defs><linearGradient id="lxflame" x1="12" y1="2" x2="12" y2="23" gradientUnits="userSpaceOnUse"><stop stop-color="#ffb347"></stop><stop offset="1" stop-color="#ea3a2d"></stop></linearGradient></defs><path fill="url(#lxflame)" d="M12 23c-4 0-7-2.7-7-6.5 0-2.3 1.2-4 2.4-5.4.3.9 1 1.6 1.9 1.6 1.4 0 1.7-1 1.6-3.5-.1-2.4 1-4.6 3.1-6.2-.4 2 .3 3.2 1.6 4.6C19 9.6 19 11.8 19 16.5c0 3.8-3 6.5-7 6.5z"></path></svg>\';var CAM=\'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>\';var GLOBE=\'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>\';var wrap=document.createElement("div");wrap.className="lx-rc";wrap.innerHTML=\'<div class="lx-rc-qrwrap"><div class="qr-frame"><svg></svg></div><span class="lx-rc-corner tl"></span><span class="lx-rc-corner tr"></span><span class="lx-rc-corner bl"></span><span class="lx-rc-corner br"></span><div class="lx-rc-qrlogo"><img src="assets/favicon.png" alt=""></div></div>\'+\'<div class="lx-rc-addrlabel">\'+GLOBE+\' Your Stellar address</div>\'+\'<div class="lx-rc-addr" data-copy="\'+esc(addr)+\'">\'+esc(addr)+\'</div>\'+\'<div class="lx-recv-note lx-rc-note">\'+warnSVG+\'<span><strong>Stellar assets only.</strong> Other networks = lost funds.</span></div>\';var _ov=body.closest(".modal-overlay");if(_ov)_ov.classList.add("lx-recv-modal");body.innerHTML="";body.appendChild(wrap);var fb=(body.closest(".modal-overlay")||document).querySelector(".modal-foot [data-copy]");if(fb)fb.setAttribute("data-copy",addr);fixReceive();var ad=wrap.querySelector(".lx-rc-addr");if(ad&&!ad.__lxc){ad.__lxc=1;ad.addEventListener("click",function(){try{if(navigator.clipboard)navigator.clipboard.writeText(ad.getAttribute("data-copy")||addr);}catch(_){}ad.classList.add("lx-copied");setTimeout(function(){ad.classList.remove("lx-copied");},1400);});}}catch(_){}}'
+'function wireReceiveAddr(){fixReceive();enhanceReceive();document.addEventListener("click",function(e){var b=e.target&&e.target.closest?e.target.closest("button"):null;if(!b)return;var t=(b.textContent||"").trim();if(t!=="Receive"&&t.indexOf("Receive")<0)return;var go=function(){fixReceive();enhanceReceive();};requestAnimationFrame(go);setTimeout(go,40);setTimeout(go,120);},true);}'
// ---- real XLM price chart (Horizon trade-aggregations vs USDC) with working timeframes ----
+'function tfP(tf){var now=Date.now(),D=86400000;if(tf==="1D")return{res:900000,start:now-D};if(tf==="1M")return{res:86400000,start:now-30*D};if(tf==="1Y")return{res:604800000,start:now-365*D};if(tf==="ALL")return{res:604800000,start:now-5*365*D};return{res:3600000,start:now-7*D};}'
+'function tfLbl(t,tf){var d=new Date(t),mo=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];if(tf==="1D")return (d.getHours()<10?"0":"")+d.getHours()+":00";if(tf==="1Y"||tf==="ALL")return mo[d.getMonth()]+" \\u2019"+String(d.getFullYear()).slice(2);return mo[d.getMonth()]+" "+d.getDate();}'
+'function drawChart(pts,tf){var host=document.getElementById("heroChart");if(!host)return;var W=600,HH=100,vals=pts.map(function(p){return p.v;}),mn=Math.min.apply(null,vals),mx=Math.max.apply(null,vals),rg=(mx-mn)||1,n=pts.length;var co=pts.map(function(p,i){return [(i/(n-1)*W),(HH-((p.v-mn)/rg)*(HH-12)-6)];});var ln="M"+co.map(function(c){return c[0].toFixed(1)+" "+c[1].toFixed(1);}).join(" L");var ar=ln+" L "+W+" "+HH+" L 0 "+HH+" Z";var up=vals[n-1]>=vals[0],col="#ea6a2c";'
+'host.innerHTML=\'<svg viewBox="0 0 600 100" preserveAspectRatio="none" width="100%" height="100%" style="display:block"><defs><linearGradient id="lxhc" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="\'+col+\'" stop-opacity="0.28"></stop><stop offset="100%" stop-color="\'+col+\'" stop-opacity="0"></stop></linearGradient></defs><path d="\'+ar+\'" fill="url(#lxhc)"></path><path d="\'+ln+\'" fill="none" stroke="\'+col+\'" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path></svg><div class="lx-cx"></div><div class="lx-cd" style="background:\'+col+\'"></div><div class="lx-ctip"></div>\';'
+'var ax=document.querySelector(".chart-axis");if(ax){var sp=ax.querySelectorAll("span"),k=sp.length;var _span=(pts[n-1].t-pts[0].t)||0;var _ltf=(_span<2*86400000)?"1D":(_span<200*86400000?"1M":tf);for(var i=0;i<k;i++){var idx=Math.round(i/(k-1)*(n-1));sp[i].textContent=(i===k-1)?"Today":tfLbl(pts[idx].t,_ltf);}}host.__pts=pts;host.__co=co;host.__tf=tf;host.__lxdrawn=1;host.classList.add("lx-chart-ready");host.classList.remove("lx-chart-loading");chartHover(host);}'
+'function chartHover(host){if(host.__hovwired)return;host.__hovwired=1;function move(e){var pts=host.__pts,co=host.__co;if(!pts||!pts.length||!co)return;var cx=host.querySelector(".lx-cx"),cd=host.querySelector(".lx-cd"),tip=host.querySelector(".lx-ctip");if(!cx||!cd||!tip)return;var rect=host.getBoundingClientRect();var rx=(e.clientX-rect.left)/rect.width;if(rx<0)rx=0;if(rx>1)rx=1;var n=pts.length,i=Math.round(rx*(n-1));if(i<0)i=0;if(i>n-1)i=n-1;var px=co[i][0]/600*rect.width,py=co[i][1]/100*rect.height;var pv=pts[i].v*(window.__lxTotalXLM||0),ps="$"+pv.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});cx.style.left=px+"px";cd.style.left=px+"px";cd.style.top=py+"px";tip.innerHTML=ps+\'<span class="lx-ctd">\'+tfLbl(pts[i].t,host.__tf)+\'</span>\';tip.style.left=px+"px";tip.style.top=py+"px";tip.style.transform=(py<38?"translate(-50%,45%)":"translate(-50%,-135%)");cx.style.opacity=1;cd.style.opacity=1;tip.style.opacity=1;}function leave(){var cx=host.querySelector(".lx-cx"),cd=host.querySelector(".lx-cd"),tip=host.querySelector(".lx-ctip");if(cx)cx.style.opacity=0;if(cd)cd.style.opacity=0;if(tip)tip.style.opacity=0;}host.addEventListener("mousemove",move);host.addEventListener("mouseleave",leave);'
// TOUCH. drawChart replaces #heroChart wholesale (host.innerHTML=), which takes the design's own chart AND
// the touchstart/touchmove handlers it had wired to its hit-rect with it — and this replacement only ever
// bound mouse events. So the readout existed on desktop and simply did not exist on a phone.
//
// A phone has no hover, so the rules differ from the mouse: a TAP shows the values and LEAVES them up
// (mouseleave has no touch equivalent, and hiding on touchend would flash them for the length of the tap).
// Dragging scrubs along the series. It clears on the next touch outside the chart.
//
// preventDefault ONLY once the finger is travelling more horizontally than vertically: unconditionally
// cancelling touchmove here would trap the page scroll whenever a swipe happens to start on the chart.
+'var _t0=null;'
+'host.addEventListener("touchstart",function(e){var p=e.touches&&e.touches[0];if(!p)return;_t0={x:p.clientX,y:p.clientY};move({clientX:p.clientX});},{passive:true});'
+'host.addEventListener("touchmove",function(e){var p=e.touches&&e.touches[0];if(!p)return;'
+'if(_t0&&Math.abs(p.clientX-_t0.x)>Math.abs(p.clientY-_t0.y)&&e.cancelable)e.preventDefault();'
+'move({clientX:p.clientX});},{passive:false});'
+'if(!window.__lxChTapOut){window.__lxChTapOut=1;'
+'document.addEventListener("touchstart",function(e){var t=e.target;if(t&&!host.contains(t))leave();},true);}'
+'}'
+'var CG_DAYS={"1D":1,"1W":7,"1M":30,"1Y":365,"ALL":1825};'
+'function renderChart(tf){try{var _bs=document.querySelectorAll(".tf-btn");for(var _i=0;_i<_bs.length;_i++)_bs[_i].classList.toggle("active",(_bs[_i].textContent||"").trim()===tf);}catch(_){}var hs=document.getElementById("heroChart");var _CC=window.__lxCC||(window.__lxCC={});if(!window.__lxCCseed){window.__lxCCseed=1;try{var _ls=JSON.parse(localStorage.getItem("lumos.chartcache3")||"{}");for(var _kk in _ls){if(_ls[_kk]&&_ls[_kk].pts&&_ls[_kk].pts.length>1)_CC[_kk]=_ls[_kk];}}catch(_){}}var _ce=_CC[tf];var _gen=(window.__lxGen=(window.__lxGen||0)+1);var _SK=\'<div class="lx-chartskel"><svg viewBox="0 0 300 90" preserveAspectRatio="none"><path class="lx-carea" d="M0,72 30,60 60,66 90,46 120,54 150,34 180,44 210,24 240,32 270,14 300,22 300,90 0,90Z"/><path class="lx-cbase" pathLength="100" d="M0,72 30,60 60,66 90,46 120,54 150,34 180,44 210,24 240,32 270,14 300,22"/><path class="lx-cline" pathLength="100" d="M0,72 30,60 60,66 90,46 120,54 150,34 180,44 210,24 240,32 270,14 300,22"/></svg></div>\';if(hs){if(!hs.__lxdrawn){hs.classList.remove("lx-chart-ready");hs.innerHTML=_SK;}hs.classList.add("lx-chart-loading");}if(!window.__lxChartGo){return;}if(hs&&_ce&&_ce.pts&&_ce.pts.length>1){try{drawChart(_ce.pts,tf);}catch(_){}}var p=tfP(tf);try{var _ax=document.querySelector(".chart-axis");if(_ax){var _sp=_ax.querySelectorAll("span"),_k=_sp.length,_en=Date.now();var _ps=(window.__lxAcctCreated&&window.__lxAcctCreated>p.start)?window.__lxAcctCreated:p.start;var _lt=((_en-_ps)<2*86400000)?"1D":((_en-_ps)<200*86400000?"1M":tf);for(var _q=0;_q<_k;_q++){var _tt=_ps+(_en-_ps)*(_k>1?_q/(_k-1):0);_sp[_q].textContent=(_q===_k-1)?"Today":tfLbl(_tt,_lt);}_ax.classList.add("lx-axis-ready");}}catch(_){}if(hs&&_ce&&_ce.pts&&_ce.pts.length>1&&(Date.now()-_ce.ts)<900000)return;var _ac=window.__lxAcctCreated||0;var days=Math.min(CG_DAYS[tf]||30,_ac?Math.max(1,Math.ceil((Date.now()-_ac)/86400000)):(CG_DAYS[tf]||30));var _url="https://api.coingecko.com/api/v3/coins/stellar/market_chart?vs_currency=usd&days="+days;function _bnP(t){return t==="1D"?["15m",96]:(t==="1W"?["2h",84]:(t==="1M"?["4h",180]:(t==="1Y"?["1d",365]:["1w",300])));}function _noChart(){if(_gen!==window.__lxGen)return;if(hs){hs.classList.add("lx-chart-ready");hs.classList.remove("lx-chart-loading");hs.innerHTML="<div class=\\"lx-chart-none\\">Price history unavailable right now</div>";}}function _synth(){if(_gen!==window.__lxGen)return;var _bp=_bnP(tf);fetch("https://api.binance.com/api/v3/klines?symbol=XLMUSDT&interval="+_bp[0]+"&limit="+_bp[1]).then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(k){if(_gen!==window.__lxGen)return;var _pp=tfP(tf);var pts=(k||[]).map(function(c){return {t:+c[0],v:+c[4]};}).filter(function(x){return x.v>0&&x.t>=_pp.start;});if(_ac){var _fp=pts.filter(function(x){return x.t>=_ac;});if(_fp.length>=2)pts=_fp;}if(pts.length>1){_CC[tf]={pts:pts,ts:Date.now()};try{drawChart(pts,tf);}catch(_){}}else{_noChart();}}).catch(function(){_noChart();});}function _fail(){if(_gen!==window.__lxGen)return;if(_ce&&_ce.pts&&_ce.pts.length>1){if(hs){hs.classList.add("lx-chart-ready");hs.classList.remove("lx-chart-loading");}}else{_synth();}if(!window.__lxCGheal){window.__lxCGheal=1;setTimeout(function(){window.__lxCGheal=0;if(window.__lxGen===_gen)_go(1);},25000);}}function _go(_tries){fetch(_url).then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(d){if(_gen!==window.__lxGen)return;var pr=(d&&d.prices)||[];var pts=pr.map(function(x){return{t:x[0],v:+x[1]};}).filter(function(x){return x.v>0;});if(_ac){var _fp=pts.filter(function(p){return p.t>=_ac;});if(_fp.length>=2)pts=_fp;}'
// CoinGecko price history is clean; just cap the point count for a smooth path
+'if(pts.length>500){var _st=Math.ceil(pts.length/500);pts=pts.filter(function(_p,_i){return _i%_st===0||_i===pts.length-1;});}'
+'if(pts.length>1){_CC[tf]={pts:pts,ts:Date.now()};try{var _sv={};for(var _svk in _CC){if(_CC[_svk]&&_CC[_svk].pts&&_CC[_svk].pts.length>1)_sv[_svk]={pts:_CC[_svk].pts,ts:_CC[_svk].ts};}localStorage.setItem("lumos.chartcache3",JSON.stringify(_sv));}catch(_){}drawChart(pts,tf);}else if(_tries>0){setTimeout(function(){_go(_tries-1);},1400);}else{_fail();}}).catch(function(){if(_gen!==window.__lxGen)return;if(_tries>0){setTimeout(function(){_go(_tries-1);},1400);}else{_fail();}});}if(days>365){fetch("https://api.binance.com/api/v3/klines?symbol=XLMUSDT&interval=1w&limit=300").then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(k){if(_gen!==window.__lxGen)return;var pts=(k||[]).map(function(c){return {t:+c[0],v:+c[4]};}).filter(function(x){return x.v>0;});if(_ac){var _fp=pts.filter(function(p){return p.t>=_ac;});if(_fp.length>=2)pts=_fp;}if(pts.length>1){_CC[tf]={pts:pts,ts:Date.now()};try{var _sv={};for(var _svk in _CC){if(_CC[_svk]&&_CC[_svk].pts&&_CC[_svk].pts.length>1)_sv[_svk]={pts:_CC[_svk].pts,ts:_CC[_svk].ts};}localStorage.setItem("lumos.chartcache3",JSON.stringify(_sv));}catch(_){}drawChart(pts,tf);}else{_fail();}}).catch(function(){if(_gen!==window.__lxGen)return;_fail();});return;}_go(1);}'
+'function wireTf(){var bs=document.querySelectorAll(".tf-btn");for(var i=0;i<bs.length;i++){(function(btn){if(btn.__lxtf)return;btn.__lxtf=1;btn.addEventListener("click",function(){for(var q=0;q<bs.length;q++)bs[q].classList.remove("active");btn.classList.add("active");renderChart((btn.textContent||"").trim());});})(bs[i]);}}'
// enhance the PRE-RENDERED Send modal at load so Memo replaces the Network-fee row before it ever opens (no flash)
+'function enhanceSendPre(){var rec=document.querySelector("input.mono");if(rec){var m=rec.closest(".modal-overlay");if(m)enhanceSend(m);}}'
// unify every "... copied to clipboard" toast to a single "Copied to clipboard" (address click vs Copy-Address button said different things)
+'function lxNormToast(){try{if(window.__lxToastWrapped)return;if(typeof window.showToast!=="function")return;window.__lxToastWrapped=1;var _st=window.showToast;window.showToast=function(m){try{if(typeof m==="string"&&/copied to clipboard/i.test(m))m="Copied to clipboard";}catch(_){}return _st.apply(this,[m].concat([].slice.call(arguments,1)));};}catch(_){}}'
// "Trade on DEX" row button: the site's global nav shim (a document-CAPTURE handler) maps the button LABEL
// to the generic Trade page and stopImmediatePropagation()s before our #assetsTable handler runs — so the
// asset-specific ?asset= URL never fired. Beat it with a WINDOW-capture handler (runs before document-capture).
// Row "Trade" used to jump straight to the DEX page. There are two reasonable things to mean by it, so ask:
// DEX opens this asset's Trade page, Swap opens the swap modal with the asset already on the You-pay side.
// The Swap branch deliberately re-dispatches the click WITHOUT our interception (__lxPass) so the design's
// own "row Trade -> openModal(modalSwap)" handler does the opening; then we set the asset through the API
// _swapcalc publishes. Driving the design's opener beats reimplementing it.
+'function tradeMenu(btn,code,iss){'
+'var old=document.querySelector(".lx-trmenu");if(old)old.remove();'
// data-lxnonav is the global nav bridge's own opt-out. Without it that bridge sees a click on something
// labelled "Trade on DEX", matches its own rule for that phrase and navigates to the DEX page WITHOUT the
// ?asset= we are trying to pass — it runs at window capture, so it wins before this menu's handler is reached.
+'var m=document.createElement("div");m.className="lx-trmenu";m.setAttribute("data-lxnonav","");'
+'m.innerHTML=\'<button type="button" data-tr="dex"><span>Trade on DEX</span><small>Order book &amp; charts</small></button><button type="button" data-tr="swap"><span>Swap</span><small>Instant swap</small></button>\';'
+'document.body.appendChild(m);'
+'var r=btn.getBoundingClientRect();m.style.top=(r.bottom+6)+"px";'
+'m.style.left=Math.max(8,Math.min(r.left,(window.innerWidth||360)-m.offsetWidth-8))+"px";'
+'function close(){if(m.parentNode)m.remove();document.removeEventListener("click",away,true);}'
+'function away(ev){if(!m.contains(ev.target))close();}'
+'setTimeout(function(){document.addEventListener("click",away,true);},0);'
+'m.addEventListener("click",function(ev){var b=ev.target&&ev.target.closest?ev.target.closest("button[data-tr]"):null;if(!b)return;'
+'ev.preventDefault();ev.stopPropagation();var kind=b.getAttribute("data-tr");close();'
+'if(kind==="dex"){var isX=(!code||code==="XLM");window.location.href=isX?"lumoscore-dex.html":("lumoscore-dex-asset.html?asset="+encodeURIComponent(code)+(iss?("-"+iss):""));return;}'
// Open the modal the way the design does (class "open" + locked scroll) rather than replaying a click on
// the Trade button: the page ALSO carries a global label-based nav bridge, and a synthetic click on a button
// reading "Trade" gets grabbed by it and navigates to the asset page instead of opening anything.
+'var sm=document.getElementById("modalSwap");if(sm){sm.classList.add("open");document.body.style.overflow="hidden";}'
+'setTimeout(function(){try{if(window.__lxSwapFrom)window.__lxSwapFrom(code,iss);}catch(_){}} ,60);'
+'});}'
+'function wireTradeNav(){if(window.__lxTradeNav)return;window.__lxTradeNav=1;window.addEventListener("click",function(e){var btn=e.target&&e.target.closest?e.target.closest("#assetsTable .qa-row-btn"):null;if(!btn||!/Trade/i.test(btn.textContent||""))return;if(btn.__lxPass)return;var row=btn.closest("tr"),ico=row?row.querySelector(".lx-aico"):null,code=ico?ico.getAttribute("data-lxc"):"",iss=ico?ico.getAttribute("data-lxi"):"";e.preventDefault();e.stopImmediatePropagation();tradeMenu(btn,code,iss);},true);}'
// portfolio chart spans only the wallet's real lifetime — a wallet created 8 days ago must NOT show XLM price
// since 2020. Fetch the account's FIRST operation (creation) date, then re-render the active tab clamped to it.
+'function lxLoadAcctAge(){var done=false;function go(){if(done)return;done=true;window.__lxChartGo=1;try{window.__lxCC={};}catch(_){}var ab=document.querySelector(".tf-btn.active");var tf=ab?(ab.textContent||"").trim():"1M";try{renderChart(tf);}catch(_){}}if(!ME){go();return;}setTimeout(go,3500);j(H+"/accounts/"+ME+"/operations?order=asc&limit=1&include_failed=false").then(function(d){var recs=(d&&d._embedded&&d._embedded.records)||[];var t=Date.parse((recs[0]&&recs[0].created_at)||"");if(t>0)window.__lxAcctCreated=t;go();}).catch(function(){go();});}'
+'function boot(){lxNormToast();wireNavGuard();wireTradeNav();wireBalMax();wireSend();wireSendValidation();wireSendAssetPicker();enhanceSendPre();wireReceiveAddr();wireAssetActions();wireRowMenu();wireWalletLink();wireTf();lxLoadAcctAge();if(!document.querySelector("#heroChart.lx-chart-ready"))renderChart("1M");prep();load();}'   // finalized Send/Swap/Receive flows stay intact
+'try{renderChart("1M");}catch(_){}'
+'if(document.readyState!=="loading")boot();else document.addEventListener("DOMContentLoaded",boot);'
+'setInterval(load,60000);'
+'})();</script>';

let n=0;
for(const dev of ['desktop','mobile']){
  const file=`lumoscore-aptos-${dev}.html`;
  let data; try{ data=read(file); }catch(e){ continue; }
  const {json,s,e}=getContents(data);
  for(const k of Object.keys(json)){
    if(k.indexOf('wallet')<0) continue;
    let h=json[k];
    // The DESKTOP wallet renders into #assetsTable; the MOBILE wallet has no table at all (its list is
    // #assetList), so gating on #assetsTable alone excluded mobile entirely — which is why every figure
    // on the mobile wallet was the design's mock, right down to an Ethereum 0x… address presented as the
    // user's Stellar account. Let the layer run on both: its Horizon fetching and the globals it
    // publishes (__lxAssets/__lxHoldings/__lxNative/__lxTotalXLM/__lxXlmUsd/__lxAct) are layout-agnostic,
    // and its desktop-only DOM writes simply find nothing on mobile. _mobwallet.js renders those globals
    // into the mobile markup.
    if(h.indexOf('assetsTable')<0 && h.indexOf('id="assetList"')<0) continue;
    h=h.replace(/<style id="lx-walletdata-css">[\s\S]*?<\/style>/,'').replace(/<script id="lx-qrlib">[\s\S]*?<\/script>/,'').replace(/<script id="lx-walletdata">[\s\S]*?<\/script>/,'');
    // CSS into <head> so hide-until-ready applies before first paint (no flash of mock)
    if(h.indexOf('</head>')>=0){ h=h.replace('</head>', CSS+'</head>'); }
    else { const hi=h.indexOf('>',h.indexOf('<head'))+1; if(hi>0) h=h.slice(0,hi)+CSS+h.slice(hi); }
    const bi=h.lastIndexOf('</body>'); if(bi<0) continue;
    json[k]=h.slice(0,bi)+QRLIB+SCRIPT+h.slice(bi); n++;
  }
  const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
  fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
}
console.log('wallet real-data v2 (priced portfolio + orders) injected on '+n+' wallet page keys');
