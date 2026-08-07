// AMM Pools real-data layer — TESTNET, PHASE 1 (read-only display).
// Pools list (lumoscore-amm.html): TVL + snapshot + My Positions + All Pools table, from the
// real testnet pools of the Launchpad tokens. Detail page + write actions come in later phases.
// The design builds these tables with its own JS, so we hold content + re-assert via MutationObserver.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const LIST_KEYS = ['lumoscore-amm.html', 'lumoscore-amm-dark.html', 'lumoscore-amm-mobile.html'];
const DETAIL_KEYS = ['lumoscore-amm-pool.html', 'lumoscore-amm-pool-dark.html', 'lumoscore-amm-pool-mobile.html'];
const KEYS = LIST_KEYS.concat(DETAIL_KEYS);

const STYLE = `<style id="lx-amm-css">
/* Create Pool asset dropdown: never flash the design's mock placeholder assets (USDC/LUMOS/GUI/AMI...) — only our real held-asset items (.lx-cpitem) ever render */
#createPoolModal .asset-dropdown .ad-item:not(.lx-cpitem){display:none!important}
/* AUDIT (user-reported): the Create Pool MAX control is a bare <span> — it fires, but the design gives it no
   cursor, hover or hit padding, so it reads as decoration and people assume it is broken. */
#createPoolModal .field-foot .max-btn{cursor:pointer;user-select:none;padding:2px 7px;margin:-2px -7px;border-radius:6px;transition:background .14s,color .14s}
#createPoolModal .field-foot .max-btn:hover{background:rgba(234,106,44,.14);color:var(--accent,#ea6a2c)}
#createPoolModal .field-foot .max-btn:active{background:rgba(234,106,44,.24)}
#createPoolModal .lx-cpwarn{margin:8px 2px 0;font-size:12.5px;line-height:1.45;color:#c9791f}
/* success toast — same look as the site's "Copied to clipboard" toast (self-contained) */
.lx-ctoast-stack{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none}
.lx-ctoast{background:var(--text,#16171b);color:var(--bg,#fff);padding:11px 18px 11px 14px;border-radius:10px;font-family:'Hanken Grotesk',system-ui,sans-serif;font-size:16px;font-weight:600;display:inline-flex;align-items:center;gap:9px;box-shadow:0 12px 32px rgba(0,0,0,.28),0 2px 8px rgba(0,0,0,.16);animation:lxCtIn .25s ease}
.lx-ctoast .ci{width:18px;height:18px;border-radius:50%;background:var(--green,#35c07f);color:#fff;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
.lx-ctoast.lxa-terr .ci{background:var(--red,#ef4444)}
.lx-ctoast a{color:inherit;text-decoration:underline}
@keyframes lxCtIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
html:not(.lx-ammready) #poolsBody, html:not(.lx-ammready) #poolTabs .count{visibility:hidden}
/* Market Overview box: show its structure (title/labels) instantly; only the value+sub cells shimmer as a
   skeleton until real data lands — so the box never sits blank for ~2s and never flashes mock numbers. */
/* Skeleton the RIGHT-side dynamic cells (value + vsub). The left label/sub are static design text.
   The vsub holds the mock $ (and an .lc-money the site re-stamps) — earlier it wasn't covered, so the
   24H-Volume figure flashed a mock value before real data. */
/* white-space:nowrap + overflow:hidden are ESSENTIAL: during load these cells still hold the design's
   MOCK text (e.g. "51,250 XLM swapped") which wraps to 2 lines in the narrow column and makes the whole
   top section ~40px taller until real (short) data lands. One-lining the skeleton keeps height stable. */
html:not(.lx-ammready) .amm-snapshot-value, html:not(.lx-ammready) .amm-snapshot-vsub, html:not(.lx-ammready) .amm-snapshot-sub{color:transparent!important;border-radius:6px;white-space:nowrap!important;overflow:hidden!important;background:linear-gradient(90deg,rgba(148,140,200,.10) 25%,rgba(148,140,200,.22) 37%,rgba(148,140,200,.10) 63%)!important;background-size:400% 100%!important;animation:lxShim 1.3s ease-in-out infinite}
/* width-only constraints — do NOT add margin/display here or the skeleton rows grow taller than the
   ready rows and the whole top section visibly shrinks ~40px when data lands */
html:not(.lx-ammready) .amm-snapshot-value{max-width:96px}
html:not(.lx-ammready) .amm-snapshot-vsub{max-width:120px}
html:not(.lx-ammready) .amm-snapshot-sub{max-width:120px}
/* also hide EVERY child of the value/vsub/sub cells (unit span, .lc-money with its re-stamped data-orig mock,
   the mock caption text) so nothing bleeds through the shimmer while loading — this was the residual flash */
html:not(.lx-ammready) .amm-snapshot-value *, html:not(.lx-ammready) .amm-snapshot-vsub *, html:not(.lx-ammready) .amm-snapshot-sub *{color:transparent!important;background:transparent!important;text-shadow:none!important}
@keyframes lxShim{0%{background-position:100% 0}100%{background-position:0 0}}
.lx-hstat .v .lx-hskel{display:inline-block;width:44px;height:24px;border-radius:6px;color:transparent!important;vertical-align:middle;background:linear-gradient(90deg,rgba(255,255,255,.07) 25%,rgba(255,255,255,.16) 37%,rgba(255,255,255,.07) 63%);background-size:400% 100%;animation:lxShim 1.3s ease-in-out infinite}
.lx-hstat[data-k=top] .lx-toptxt.lx-hskel{width:92px;height:22px}
.lx-hstat[data-k=top] .lx-hpairskel{display:inline-flex;flex:0 0 auto}
.lx-hstat[data-k=top] .lx-hpairskel .pa,.lx-hstat[data-k=top] .lx-hpairskel .pb{width:33px;height:33px;border-radius:50%;background:linear-gradient(90deg,rgba(255,255,255,.07) 25%,rgba(255,255,255,.16) 37%,rgba(255,255,255,.07) 63%);background-size:400% 100%;animation:lxShim 1.3s ease-in-out infinite}
.lx-hstat[data-k=top] .lx-hpairskel .pb{margin-left:-11px;border:2.5px solid rgba(22,20,42,.95);box-sizing:border-box}
/* Market Overview: match the "New Mints on Stellar" (Trade page) typography scale so the two cards feel
   the same — label like .dex-mint-name (15.5/700), value like .dex-mint-mc (15/700), subs 13/12.5 soft. */
.amm-snapshot-label{font-size:15.5px!important;font-weight:700!important;line-height:1.2!important;letter-spacing:.2px!important;text-transform:none!important;color:var(--text)!important}
.amm-snapshot-value{font-size:15px!important;font-weight:700!important;letter-spacing:normal!important;line-height:1.2!important}
.amm-snapshot-sub{font-size:13px!important;margin-top:2px!important}
.amm-snapshot-vsub{font-size:12.5px!important;margin-top:2px!important}
.amm-snapshot-row{padding:10px 8px!important}
.amm-snapshot-ic.fees{background:rgba(245,158,11,.15)!important;color:#f59e0b!important}
/* token/pair icons rendered ENTIRELY via CSS custom-props + ::after so the site logo-painter (which clears innerHTML & stamps an inline bg on an interval) can't wipe them; stylesheet !important beats the painter's inline background */
.pair-icons .pa.lx-ico,.pair-icons .pb.lx-ico{position:absolute!important;top:0;overflow:hidden;padding:0;background-color:var(--mc,#2a2f42)!important;background-image:var(--mi,none)!important;background-size:contain!important;background-position:center!important;background-repeat:no-repeat!important}
.pair-icons .pa.lx-ico[data-mono]::after,.pair-icons .pb.lx-ico[data-mono]::after{content:attr(data-mono);position:absolute;inset:0;display:grid;place-items:center;color:#fff;font-weight:800;font-family:'JetBrains Mono',monospace;font-size:12px}
.pair-icons .pa,.pair-icons .pb{background-image:none!important;overflow:hidden;padding:0}
.pair-icons .pa img,.pair-icons .pb img{width:100%;height:100%;object-fit:cover;border-radius:50%;display:block}
/* Typography parity with the rest of the site (e.g. Wallet › My Assets): numeric/value cells + tab counts
   use JetBrains Mono (tabular), the pair NAME stays Hanken Grotesk. Fixes "Pools text looks different". */
#poolsBody td, #lx-mypanel td, #poolTabs .count{font-family:'JetBrains Mono',monospace!important}
#poolsBody .pair-name, #lx-mypanel .pair-name{font-family:'Hanken Grotesk','Hanken Grotesk',sans-serif!important;font-size:15.5px!important;font-weight:700!important}
#poolsBody .pair-sub, #lx-mypanel .pair-sub{font-size:12.5px!important}
/* value cells 19px -> 15px to match Trade "All Trading Pairs" (pair-name 15.5 / sub 12.5 keep their own sizes) */
#poolsBody td, #lx-mypanel td{font-size:15px!important}
#poolsBody td div:not(.pair-name):not(.pair-sub), #lx-mypanel td div:not(.pair-name):not(.pair-sub){font-size:15px!important}
/* My Positions: after dropping the Fees Earned + Deposited columns, pull "View position" left — fix the data
   columns to content/size so the View cell (last) absorbs all leftover width and its button sits, left-aligned,
   right after Pool Share (leftover blank space collapses to the far right of the row, not between the cells) */
#lx-mypanel table.pools th:nth-child(2),#lx-mypanel table.pools td:nth-child(2){white-space:nowrap;width:1px}
#lx-mypanel table.pools th:nth-child(3),#lx-mypanel table.pools td:nth-child(3){width:200px}
#lx-mypanel table.pools th:nth-child(4),#lx-mypanel table.pools td:nth-child(4){width:130px}
/* The view-position cell is the last column and the table is full-width, so the preceding columns are
   width-capped above and this one absorbs the slack — left-aligning the button left it stranded mid-row
   with a wide empty gutter to its right. Pin it to the right edge instead. */
#lx-mypanel table.pools .lx-viewcell{text-align:right!important;padding-left:10px;padding-right:16px;white-space:nowrap}
.lx-amm-empty{padding:22px 12px;text-align:center;color:var(--text-muted);font-size:13.5px}
.lx-amm-empty b{color:var(--text);display:block;margin-bottom:4px}
html:not(.lx-ammready) .pool-header, html:not(.lx-ammready) .pool-layout{visibility:hidden}
/* the breadcrumb pair (last span in .crumb) is a baked "LUMOS / XLM" mock that pdCopy corrects to the
   real pair before reveal — hide it until then so it doesn't flash the wrong pair */
html:not(.lx-ammready) .crumb span:last-child{visibility:hidden}
/* PAIR labels carry a baked "LUMOS / XLM" mock. reveal() fires at 700ms (before the pool fetch resolves) so the
   mock would flash. Gate the pair TEXT on lx-detpr (added only once paintDetail paints the real pair) — the ico
   stays visible, only the wrong text is masked. The withdraw "from position" row is re-created on tab switch, so
   gate it per-element on data-lxpair (set by fixWithdrawPair) instead of the global class. */
/* Mask EVERY baked LUMOS/XLM mock (text, values, logos) on the detail page until the real paint (lx-detpr).
   Use visibility:hidden — NOT color:transparent — because the mock hides values inside inline-coloured child
   spans (the green "+$32.18" PnL) and uses <img> logos, neither of which a text-colour rule can hide. Layout
   is preserved. The deposit/withdraw asset chips are re-created on tab switch, so they're gated per-element on
   data-lxpair (set by setField / fixWithdrawPair) instead of the global class. */
html:not(.lx-detpr) .ph-name,
html:not(.lx-detpr) .crumb span:last-child,
html:not(.lx-detpr) .ph-icons .pa, html:not(.lx-detpr) .ph-icons .pb,
html:not(.lx-detpr) .my-position .mp-amount, html:not(.lx-detpr) .my-position .mp-pnl,
html:not(.lx-detpr) .my-position .mp-asset-name, html:not(.lx-detpr) .my-position .mp-asset-amt,
html:not(.lx-detpr) .my-position .mp-asset-ico, html:not(.lx-detpr) .my-position .mp-fee-val,
html:not(.lx-detpr) .position-share-pill{visibility:hidden!important}
#dwDeposit .dw-field .row .asset:not([data-lxpair]), #dwWithdraw .dw-field .row .asset:not([data-lxpair]){visibility:hidden!important}
/* Remaining mock-flash surfaces on the detail page (audit #9/#10/#11): the STAT values (3,420,180 XLM /
   8,420 / 42.10 mock), the Pool Transactions MOCK rows (0x wallets + 5/26/2026 dates) and the mock
   Participants (847). Real rows carry .lx-txrow/.lx-partrow — mock rows never do, so hide non-lx rows
   outright (no timing dependency); stat values reveal with the real paint (lx-detpr). */
html:not(.lx-detpr) .ph-stat .v, html:not(.lx-detpr) .ph-stat .s{visibility:hidden!important}
/* AUDIT (user-reported): the header PRICE block was never in this list, so on every pool the top-right
   showed the baked "0.000713 XLM / $0.000108 per LUMOS" until the real paint — i.e. a yXLM/XLM pool
   announced a LUMOS price for a few seconds. Same gate as everything else in the header. */
html:not(.lx-detpr) .ph-price .v,
html:not(.lx-detpr) .ph-price .s,
html:not(.lx-detpr) .ph-price .lc-money{visibility:hidden!important}
.lx-detfail{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:16px 0 0;padding:13px 16px;border:1px solid rgba(209,84,47,.35);border-left:3px solid #d1542f;border-radius:12px;background:rgba(209,84,47,.07);font-size:13.2px;line-height:1.5;color:var(--text,#0e0e10)}
.lx-detfail span{flex:1 1 300px}
.lx-detretry{padding:7px 15px;border-radius:9px;border:1px solid var(--border-strong,#d5d5dd);background:var(--surface-2,#f6f6f8);color:var(--text,#0e0e10);font:650 12.5px/1 inherit;cursor:pointer}
.lx-detretry:hover{border-color:#d1542f;color:#d1542f}
table.tx tbody tr:not(.lx-txrow){display:none!important}
#partList > *:not(.lx-partrow){display:none!important}
html:not(.lx-detpr) .side-head .count-pill{visibility:hidden!important}
/* AUDIT (user-reported, DWARF/SBB): the deposit CTA looked live even when the deposit could not possibly
   succeed — an AMM deposit needs BOTH sides of the pair, and the user held none of one of them. Grey it out
   and make it inert so the state is legible BEFORE filling in amounts, instead of erroring only on submit. */
.dw-card .dw-cta.lx-dwoff{opacity:.45!important;cursor:not-allowed!important;pointer-events:none!important;filter:grayscale(.35)}
.dw-card .lx-dwhint{margin-top:9px;font-size:12px;line-height:1.45;color:var(--text-muted);text-align:center}
/* AUDIT: the hero's absolutely-positioned stats chip (.lm-chip) collides with the "Provide liquidity, earn
   swap fees" headline once the promo card narrows (≤1100px) — unreadable jumble. The same numbers live in
   the Market Overview panel, so just hide the decorative chip at narrow widths. */
@media (max-width:1100px){ .lm-pools .lm-chip{display:none!important} }
/* the design paints a synthetic mock chart on load; hide its data (line/area/bars) until our real engine takes
   over (lx-chartready), keeping the axis/grid so the plot frame stays visible */
html:not(.lx-chartready) #tvlChart svg path:not(.lx-ch), html:not(.lx-chartready) #tvlChart svg rect:not(.lx-ch){opacity:0!important}
.ph-icons .pa,.ph-icons .pb,.mp-asset-ico,#dwDeposit .dw-field .asset .ico,#dwWithdraw .asset .ico{background-image:none!important;overflow:hidden}
.ph-icons .pa img,.ph-icons .pb img,.mp-asset-ico img,.dw-field .asset .ico img{width:100%;height:100%;object-fit:cover;border-radius:50%;display:block}
.type-pill.deposit{background:rgba(34,197,94,.14)!important;color:#16a34a!important}
.type-pill.withdraw{background:rgba(239,68,68,.14)!important;color:#ef4444!important}
.lx-partrow{display:flex;align-items:center;gap:10px}
.lx-partrow .part-addr{flex:1;font-family:'JetBrains Mono',monospace;font-size:13px}
.lx-partrow .part-share{font-weight:700;font-size:14px!important}
/* pool detail: remove the design's green endpoint dot on the TVL chart */
#tvlChart circle{display:none!important}
/* pool-tx wallet address is a link to stellar.expert — subtle hover underline */
table.tx .wallet-cell{cursor:pointer}
table.tx a.wallet-cell:hover .lx-waddr{text-decoration:underline}
/* pagination row: vertically center "Page X of Y" with the Prev/Next buttons */
.controls{align-items:center!important}
/* Pools hero: animated dark cosmic cover (both themes) — replaces inject_livemarket's orange streams */
.lumos-promo.lm-on.lm-pools{min-height:366px!important;overflow:hidden;background:radial-gradient(58% 84% at 70% 30%,rgba(140,96,246,.26),transparent 60%),radial-gradient(46% 64% at 92% 78%,rgba(198,86,232,.14),transparent 62%),radial-gradient(52% 68% at 24% 90%,rgba(74,110,224,.12),transparent 62%),linear-gradient(140deg,#0f1120 0%,#0a0a15 55%,#070610 100%)!important}
.lm-pools .lm{min-height:366px!important}
.lm-pools .lm-streams,.lm-pools .lm-svg,.lm-pools .lm-bars,.lm-pools .lm-pool{display:none!important}
.lm-pools .lm::after{background:linear-gradient(100deg,rgba(9,9,18,.66) 12%,rgba(9,9,18,.16) 46%,transparent 72%)!important;z-index:2!important}
/* bigger text, forced light so it stays readable on the dark card in LIGHT theme too */
.lm-pools .lm-c-pool{position:relative;z-index:4;padding-top:21px}
.lm-pools .lm-h{font-size:38px!important;line-height:1.08!important;color:#fff!important;margin-bottom:13px!important;letter-spacing:-.01em}
.lm-pools .lm-sub{font-size:15.5px!important;line-height:1.55!important;max-width:380px!important;color:rgba(228,230,245,.76)!important;margin-bottom:22px!important}
.lm-pools .lm-cta{font-size:14.5px!important;padding:13px 22px!important}
.lm-pools .lm-chip{z-index:4!important;background:rgba(16,15,32,.62)!important;border:1px solid rgba(255,255,255,.12)!important;backdrop-filter:blur(6px);padding:21px 27px!important;min-width:0;width:max-content;max-width:360px}
.lm-pools .lm-chip .p1,.lm-pools .lm-chip .p2,.lm-pools .lm-chip .p3{display:none!important}
.lx-hstats{display:grid;grid-template-columns:auto auto;gap:20px 24px}
.lx-hstat{display:flex;flex-direction:column;gap:4px;min-width:0}
.lx-hstat .v{font:800 29px/1.05 'Hanken Grotesk',sans-serif;color:#fff;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lx-hstat .l{font:600 13px/1.2 'JetBrains Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:rgba(228,230,245,.6)}
/* Top Pool stat: show the pair logos beside the "CODE / XLM" text */
.lx-hstat[data-k=top] .v{display:flex;align-items:center;gap:12px}
.lx-hstat[data-k=top] .pair-icons{width:57px;height:33px;flex:0 0 57px}
.lx-hstat[data-k=top] .pair-icons .pa.lx-ico,.lx-hstat[data-k=top] .pair-icons .pb.lx-ico{width:33px!important;height:33px!important;border:2.5px solid rgba(22,20,42,.95);box-sizing:border-box;box-shadow:0 3px 8px rgba(0,0,0,.4)}
.lx-hstat[data-k=top] .pair-icons .pb.lx-ico{left:23px!important}
.lx-hstat[data-k=top] .pair-icons .pa.lx-ico[data-mono]::after,.lx-hstat[data-k=top] .pair-icons .pb.lx-ico[data-mono]::after{font-size:13px}
.lx-hstat[data-k=top] .lx-toptxt{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:20px}
/* My Positions "View position" — themed pill button (light + dark) instead of a raw link */
.lx-ammview{display:inline-flex;align-items:center;gap:5px;padding:7px 15px;border-radius:9px;font:700 12.5px/1 'Hanken Grotesk',sans-serif;text-decoration:none!important;white-space:nowrap;border:1px solid rgba(234,106,44,.38);color:var(--accent,#ea6a2c)!important;background:rgba(234,106,44,.10);transition:background .15s ease,color .15s ease,border-color .15s ease}
.lx-ammview:hover{background:var(--accent,#ea6a2c);color:#fff!important;border-color:var(--accent,#ea6a2c)}
.pair-icons .pa .lx-mono{display:grid;place-items:center;width:100%;height:100%;color:#fff;font-weight:800;font-family:'JetBrains Mono',monospace;font-size:12px;border-radius:50%}
/* injected cosmic decor (nebulae drift, orb floats, particles rise, stars twinkle) */
.lx-cosmic{position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden}
.lx-neb{position:absolute;border-radius:50%;filter:blur(50px);mix-blend-mode:screen;will-change:transform}
.lx-neb.n1{width:600px;height:470px;right:-70px;top:-130px;background:radial-gradient(circle,rgba(140,96,246,.62),transparent 66%);animation:lxNeb1 30s ease-in-out infinite alternate}
.lx-neb.n2{width:480px;height:430px;right:150px;bottom:-180px;background:radial-gradient(circle,rgba(206,88,236,.44),transparent 66%);animation:lxNeb2 36s ease-in-out infinite alternate}
.lx-neb.n3{width:410px;height:340px;left:32%;top:4%;background:radial-gradient(circle,rgba(72,120,232,.34),transparent 66%);animation:lxNeb1 33s ease-in-out infinite alternate-reverse}
@keyframes lxNeb1{from{transform:translate(0,0) scale(1)}to{transform:translate(-48px,36px) scale(1.18)}}
@keyframes lxNeb2{from{transform:translate(0,0) scale(1)}to{transform:translate(54px,-32px) scale(1.12)}}
.lx-stars{position:absolute;inset:0;animation:lxTw 7s ease-in-out infinite;background-repeat:no-repeat;background-image:
radial-gradient(1.6px 1.6px at 17% 24%,rgba(255,255,255,.9),transparent 60%),
radial-gradient(1.3px 1.3px at 61% 16%,rgba(255,255,255,.62),transparent 60%),
radial-gradient(1.7px 1.7px at 83% 52%,rgba(255,255,255,.74),transparent 60%),
radial-gradient(1.1px 1.1px at 45% 66%,rgba(255,255,255,.5),transparent 60%),
radial-gradient(1.4px 1.4px at 93% 30%,rgba(255,255,255,.64),transparent 60%),
radial-gradient(1.2px 1.2px at 34% 44%,rgba(255,255,255,.5),transparent 60%),
radial-gradient(1.5px 1.5px at 73% 80%,rgba(255,255,255,.58),transparent 60%),
radial-gradient(1px 1px at 55% 90%,rgba(255,255,255,.42),transparent 60%),
radial-gradient(1.3px 1.3px at 12% 66%,rgba(255,255,255,.52),transparent 60%),
radial-gradient(1.6px 1.6px at 70% 40%,rgba(255,255,255,.66),transparent 60%),
radial-gradient(1.1px 1.1px at 88% 66%,rgba(255,255,255,.46),transparent 60%),
radial-gradient(1.2px 1.2px at 26% 80%,rgba(255,255,255,.48),transparent 60%)}
@keyframes lxTw{0%,100%{opacity:.6}50%{opacity:1}}
.lx-constel{position:absolute;right:3%;top:50%;transform:translateY(-50%);width:330px;height:330px;opacity:.95;pointer-events:none;animation:lxConFloat 12s ease-in-out infinite}
@keyframes lxConFloat{0%,100%{transform:translateY(-50%)}50%{transform:translateY(calc(-50% - 12px))}}
.lx-constel line{stroke:rgba(150,120,240,.26);stroke-width:1}
.lx-constel circle{fill:#cbbaff;filter:drop-shadow(0 0 5px rgba(168,128,255,.9));animation:lxNode 4.5s ease-in-out infinite}
@keyframes lxNode{0%,100%{opacity:.5}50%{opacity:1}}
/* top-align the hero text with the TVL chip (chip sits ~21px from top) */
.lm-pools .lm{display:block!important}
.lx-part{position:absolute;border-radius:50%;background:rgba(214,196,255,.85);box-shadow:0 0 9px rgba(172,132,255,.9);animation:lxDrift linear infinite}
.lx-part.p1{width:5px;height:5px;left:57%;bottom:14%;animation-duration:15s}
.lx-part.p2{width:4px;height:4px;left:74%;bottom:8%;animation-duration:19s;animation-delay:-4s}
.lx-part.p3{width:6px;height:6px;left:66%;bottom:22%;animation-duration:23s;animation-delay:-9s}
.lx-part.p4{width:3px;height:3px;left:85%;bottom:12%;animation-duration:17s;animation-delay:-2s}
@keyframes lxDrift{0%{transform:translateY(20px);opacity:0}12%{opacity:1}86%{opacity:1}100%{transform:translateY(-160px);opacity:0}}
#poolsBody tr td:last-child,#panelAllPools thead th:last-child{text-align:center!important}
#lx-mypanel{opacity:1!important;visibility:visible!important;animation:none!important}
</style>`;

const SCRIPT = `<script id="lx-ammdata">(function(){
  var H="https://horizon.stellar.org";                 // MAINNET
  // Real Stellar MAINNET assets with live XLM pools (canonical issuers, matching the swap engine).
  var KNOWN=[
    {code:"USDC",issuer:"GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"},
    {code:"AQUA",issuer:"GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA"},
    {code:"yXLM",issuer:"GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55"},
    {code:"EURC",issuer:"GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2"},
    {code:"yUSDC",issuer:"GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF"}
  ];
  try{ var extra=JSON.parse(localStorage.getItem("lumos.launches")||"[]"); if(extra&&extra.length)extra.forEach(function(e){ if(e&&e.code&&e.issuer&&!KNOWN.some(function(t){return t.code===e.code&&t.issuer===e.issuer;}))KNOWN.push({code:e.code,issuer:e.issuer}); }); }catch(e){}
  var GRAD=["linear-gradient(135deg,#ea6a2c,#ff9a3d)","linear-gradient(135deg,#7c6cf5,#a89bff)","linear-gradient(135deg,#2dd4bf,#14b8a6)","linear-gradient(135deg,#ec4899,#f472b6)","linear-gradient(135deg,#3b82f6,#60a5fa)","linear-gradient(135deg,#f59e0b,#fbbf24)","linear-gradient(135deg,#22c55e,#4ade80)","linear-gradient(135deg,#06b6d4,#22d3ee)","linear-gradient(135deg,#f43f5e,#fb7185)","linear-gradient(135deg,#8b5cf6,#c084fc)"];
  function ghash(s){ var h=2166136261; for(var i=0;i<(s||"").length;i++){ h^=s.charCodeAt(i); h=(h*16777619)>>>0; } return h; }

  function num(n){return Math.round(+n||0).toLocaleString("en-US");}
  // XLM/USD when CoinGecko rate-limits (429, frequent on the free tier): fall back to the cross-page cache
  // (<6h) then the last-known global. The old hardcoded 0.11 silently rendered EVERY USD value ~35% low.
  function xuFallback(){ try{ var c=JSON.parse(localStorage.getItem("lumos.xlmUsd")||"null"); if(c&&+c.v>0&&(Date.now()-c.ts<216e5))return +c.v; }catch(_){}
    return (+window.__lxXlmUsd>0)?+window.__lxXlmUsd:0.11; }
  function xuSave(v){ if(+v>0){ try{ localStorage.setItem("lumos.xlmUsd",JSON.stringify({v:+v,ts:Date.now()})); }catch(_){} } return +v||0; }
  // adaptive quantity: big -> commas/M, small -> enough decimals so a tiny LP share never rounds to "0"
  function qty(n){ n=+n||0; var a=Math.abs(n); if(a>=1e6)return (n/1e6).toFixed(2)+"M"; if(a>=1e3)return Math.round(n).toLocaleString("en-US"); if(a>=1)return (Math.round(n*100)/100).toLocaleString("en-US"); if(a>0){ var d=Math.min(7,Math.max(2,2-Math.floor(Math.log(a)/Math.LN10))); var s=n.toFixed(d); if(s.indexOf(".")>=0)s=s.replace(/0+$/,"").replace(/\\.$/,""); return s; } return "0"; }
  function usd(x){x=+x;if(!x)return "$0";var a=Math.abs(x);if(a>=1e9)return "$"+(x/1e9).toFixed(2)+"B";if(a>=1e6)return "$"+(x/1e6).toFixed(2)+"M";if(a>=1e3)return "$"+(x/1e3).toFixed(1)+"K";if(a>=1)return "$"+x.toFixed(2);return "$"+x.toFixed(x>=0.01?4:6);}
  function esc(s){return (s+"").replace(/[<>&"]/g,function(c){return c==="<"?"&lt;":c===">"?"&gt;":c==="&"?"&amp;":"&quot;";});}
  function getJSON(u){return fetch(u).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});}
  function myAddr(){try{var a=localStorage.getItem("lumos.address")||"";return /^G[A-Z2-7]{55}$/.test(a)?a:"";}catch(e){return "";}}
  function gcolor(s){return GRAD[ghash(s)%GRAD.length];}
  function launchIcon(code,issuer){ try{ var m=JSON.parse(localStorage.getItem("lumos.launch.icons")||"{}"); return m[code+"-"+issuer]||""; }catch(e){ return ""; } }
  // token side = the token's own uploaded logo if we have it, else a DISTINCT colored monogram (per code); XLM side = xlm.png
  function ico1(cls,mi,mono,code,issuer){ var mo=mono?(' data-mono="'+esc(mono)+'"'):''; var idn=(code!=null&&code!=="")?(' data-lxc="'+esc(code)+'" data-lxi="'+esc(issuer||"")+'"'):''; return '<div class="'+cls+' lx-ico" data-lxfixed="1" data-logoed="1"'+mo+idn+' style="--mi:'+mi+'"></div>'; }
  // letter-avatar data-URI: a per-asset coloured monogram, so an unknown token NEVER renders the generic
  // assets/tokens/placeholder.svg image (what sUSD showed on the pool detail page).
  function avatarUri(code){ var c=String(code||"?"),hue=0; for(var i=0;i<c.length;i++)hue=(hue*31+c.charCodeAt(i))%360;
    var init=c.replace(/[^A-Za-z0-9]/g,"").slice(0,2).toUpperCase()||"?"; var fs=init.length>1?15:20;
    var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="hsl('+hue+',60%,50%)"/><text x="20" y="'+(init.length>1?26:27)+'" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="'+fs+'" fill="#fff">'+init+'</text></svg>';
    return "data:image/svg+xml,"+encodeURIComponent(svg); }
  // ASYNC LOGO HEALING: amTokUrl() is SYNCHRONOUS (hardcoded map + cache only), so every asset outside it
  // (sUSD, CETES, PYUSD, …) rendered a placeholder/letter forever — amFetchLogo existed but nothing called
  // it for these. Mark every icon with data-lxc/data-lxi, resolve each unknown code ONCE via stellar.expert,
  // then patch all its elements (imgs -> src, .lx-ico -> --mi + drop the letter).
  var _healTried={};
  function applyLogo(code,url){ if(!code||!url)return;
    qa('[data-lxc="'+code+'"]').forEach(function(el){
      if(el.tagName==="IMG"){ if(el.getAttribute("src")!==url)el.setAttribute("src",url); return; }
      el.style.setProperty("--mi","url("+url+")"); if(el.hasAttribute("data-mono"))el.removeAttribute("data-mono"); });
  }
  function healLogos(){
    var want={};
    qa("[data-lxc][data-lxi]").forEach(function(el){ var c=el.getAttribute("data-lxc"); if(!c||c==="XLM")return; want[c]=el.getAttribute("data-lxi")||""; });
    Object.keys(want).forEach(function(c){ var i=want[c]; var u=amTokUrl(c,i);
      if(u){ applyLogo(c,u); return; }
      var k=c+"|"+i; if(_healTried[k])return; _healTried[k]=1;
      amFetchLogo(c,i,function(img){ if(img)applyLogo(c,img); }); });
  }
  // real token logo (known map + launch icons + harvested cache) for the pair's non-XLM side; letter fallback only when truly unknown
  function icoPair(code,issuer){ var up=amTokUrl(code,issuer); var tok= up ? ico1('pa','url('+up+')',null,code,issuer) : ico1('pa',gcolor(code),(code&&code[0]?code[0]:"?").toUpperCase(),code,issuer); var xlm=ico1('pb','url(assets/tokens/xlm.png)',null); return '<div class="pair-icons" data-paired="1">'+tok+xlm+'</div>'; }

  // build a pool object from a raw Horizon /liquidity_pools/{id} record (for the user's positions
  // that aren't in the KNOWN launchpad set, so Pools "My Positions" matches the wallet's Liq Pools tab)
  function poolFromRec(p){ var xlm=0,tok=0,code="?",issuer="";
    var rs=(p.reserves||[]).map(function(rv){ var nat=rv.asset==="native"; var sp=nat?["XLM",""]:String(rv.asset).split(":"); return {code:nat?"XLM":sp[0],issuer:nat?"":(sp[1]||""),amount:+rv.amount,native:nat}; });
    rs.forEach(function(rv){ if(rv.native)xlm=rv.amount; else { tok=rv.amount; code=rv.code; issuer=rv.issuer; } });
    return {code:code,issuer:issuer,id:p.id,xlm:xlm,tok:tok,a0:rs[0]||null,a1:rs[1]||null,nonXlm:xlm===0,shares:+p.total_shares,fee:(p.fee_bp||30)/100,trustlines:+(p.total_trustlines||0)}; }
  // generic pair icon (both sides real logos) — for non-XLM pools like AQUA/EURC. Reuses amTokUrl (known map + stellar.expert cache).
  function assetIcoBg(a){ if(!a)return null; if(a.native||a.code==="XLM")return "url(assets/tokens/xlm.png)"; var u=amTokUrl(a.code,a.issuer); return u?("url("+u+")"):null; }
  function icoPairG(a0,a1){ var b0=assetIcoBg(a0),b1=assetIcoBg(a1);
    var e0=b0?ico1("pa",b0,null,a0.code,a0.issuer):ico1("pa",gcolor(a0.code),(a0.code&&a0.code[0]?a0.code[0]:"?").toUpperCase(),a0.code,a0.issuer);
    var e1=b1?ico1("pb",b1,null,a1.code,a1.issuer):ico1("pb",gcolor(a1.code),(a1.code&&a1.code[0]?a1.code[0]:"?").toUpperCase(),a1.code,a1.issuer);
    return '<div class="pair-icons" data-paired="1">'+e0+e1+'</div>'; }
  function fetchVol(id,pool){ return getJSON(H+"/liquidity_pools/"+id+"/trades?order=desc&limit=100").then(function(tr){ var trs=(tr&&tr._embedded&&tr._embedded.records)||[]; var now=Date.now(),vol=0,n=0; trs.forEach(function(x){ var xa=x.base_asset_type==="native"?+x.base_amount:+x.counter_amount; var ts=Date.parse(x.ledger_close_time||""); if(now-ts<=864e5){vol+=xa;n++;} }); pool.vol24Xlm=vol; pool.n24=n; return pool; }); }
  // vol24Xlm === null means "not fetched yet" (distinct from 0, a real "no trades in 24h"), so
  // painters can show a dash instead of a confident, wrong 0.
  var VOLQ=[];
  function volLater(id,pool){ pool.vol24Xlm=null; pool.n24=null; VOLQ.push({id:id,pool:pool}); return pool; }
  function volReady(){ return !!DATA && DATA.pools.every(function(p){ return p.vol24Xlm!=null; }); }
  function runVolQ(cb){ var q=VOLQ.splice(0,VOLQ.length); if(!q.length){ cb&&cb(); return; }
    Promise.all(q.map(function(it){
      // last-100-trades fallback, used only if stellar.expert is unreachable. Understates busy pools,
      // but a stale-but-fast number beats a permanently dashed column.
      function horizonFallback(){
        return getJSON(H+"/liquidity_pools/"+it.id+"/trades?order=desc&limit=100").then(function(tr){
          var trs=(tr&&tr._embedded&&tr._embedded.records)||[]; var now=Date.now(),vol=0,n=0;
          trs.forEach(function(x){ var xa=x.base_asset_type==="native"?+x.base_amount:+x.counter_amount; var ts=Date.parse(x.ledger_close_time||""); if(now-ts<=864e5){vol+=xa;n++;} });
          it.pool.vol24Xlm=vol; it.pool.n24=n; it.pool.fees24XlmReal=null;
        });
      }
      return getJSON("https://api.stellar.expert/explorer/public/liquidity-pool/"+it.id).then(function(d){
        if(!d||!d.assets||!d.volume)throw new Error("no expert stats");
        var xi=-1; for(var i=0;i<d.assets.length;i++){ if((d.assets[i].asset||d.assets[i].name)==="XLM"){xi=i;break;} }
        it.pool.n24=(d.trades&&+d.trades["1d"])||0;
        if(xi<0){ it.pool.vol24Xlm=0; it.pool.fees24XlmReal=null; return; }   // non-XLM pair: no XLM-denominated side to report
        var v=d.volume[xi]&&d.volume[xi]["1d"], f=d.earned_fees&&d.earned_fees[xi]&&d.earned_fees[xi]["1d"];
        if(v==null)throw new Error("no 1d volume");
        it.pool.vol24Xlm=+v/1e7;   // one leg of each swap — the conventional way to denominate X/XLM volume
        // Fees are taken from the INPUT asset, so 24h fees land on BOTH sides depending on which way each
        // swap ran. Reading only the XLM side reported ~40% of the truth (USDC/XLM: 444 XLM against a
        // 1,148 XLM expectation). Convert the other side at the pool's own reserve ratio and sum — that
        // reconciles to volume x fee rate, which is the cross-check that this is right.
        var _oi=(xi===0?1:0), _fo=d.earned_fees&&d.earned_fees[_oi]&&d.earned_fees[_oi]["1d"];
        var _rate=(it.pool.tok>0?it.pool.xlm/it.pool.tok:0);
        it.pool.fees24XlmReal=(f!=null||_fo!=null)
          ? ((f!=null?+f/1e7:0)+((_fo!=null&&_rate>0)?(+_fo/1e7)*_rate:0))
          : null;
      }).catch(function(){ return horizonFallback(); })
        .catch(function(){ it.pool.vol24Xlm=0; it.pool.n24=0; it.pool.fees24XlmReal=null; });   // both sources down -> a real 0, not a permanent dash
    })).then(function(){ cb&&cb(); });
  }
  // re-derive everything that depends on 24h volume, once the deferred fetches land
  function recomputeVol(){ if(!DATA)return; var xu=DATA.xlmUsd||0;
    DATA.pools.concat(DATA.mine).forEach(function(p){ var v=(p.vol24Xlm==null?0:p.vol24Xlm);
      p.vol24Usd=v*xu; p.fees24Xlm=(p.fees24XlmReal!=null?p.fees24XlmReal:v*p.fee/100); p.fees24Usd=p.fees24Xlm*xu; });
    DATA.totVolXlm=DATA.pools.reduce(function(s,p){return s+(p.vol24Xlm||0);},0);
    DATA.totVolUsd=DATA.pools.reduce(function(s,p){return s+(p.vol24Usd||0);},0);
  }
  var DATA=null;
  var _cpBals=null;                       // wallet balances fetched EARLY just for the Create Pool asset picker
  function load(){
    var xlmP=getJSON("https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd");
    var acctP=myAddr()?(window.__lxAcct?window.__lxAcct(myAddr()):getJSON(H+"/accounts/"+myAddr())):Promise.resolve(null);
    var poolsP=Promise.all(KNOWN.map(function(t){
      return getJSON(H+"/liquidity_pools?reserves=native,"+encodeURIComponent(t.code+":"+t.issuer)).then(function(r){
        var p=r&&r._embedded&&r._embedded.records&&r._embedded.records[0]; if(!p)return null;
        var xlm=0,tok=0; (p.reserves||[]).forEach(function(rv){ if(rv.asset==="native")xlm=+rv.amount; else tok=+rv.amount; });
        var pool={code:t.code,issuer:t.issuer,id:p.id,xlm:xlm,tok:tok,shares:+p.total_shares,fee:(p.fee_bp||30)/100,trustlines:+(p.total_trustlines||0)};
        return volLater(p.id,pool);
      });
    }));
    Promise.all([xlmP,acctP,poolsP]).then(function(r){
      var xlmUsd=xuSave((r[0]&&r[0].stellar&&+r[0].stellar.usd)||0)||xuFallback();
      var acct=r[1]; var pools=(r[2]||[]).filter(Boolean);
      var myShares={}; if(acct){ (acct.balances||[]).forEach(function(b){ if(b.asset_type==="liquidity_pool_shares")myShares[b.liquidity_pool_id]=+b.balance; }); }
      // the user may hold LP shares in pools outside the KNOWN launchpad set — fetch those so "My
      // Positions" here matches the wallet's Liq Pools count instead of only counting KNOWN pools.
      var haveIds={}; pools.forEach(function(p){ haveIds[p.id]=1; });
      var extraIds=[]; for(var _id in myShares){ if(myShares[_id]>0.001&&!haveIds[_id])extraIds.push(_id); }
      return Promise.all(extraIds.map(function(id){ return getJSON(H+"/liquidity_pools/"+id).then(function(p){ if(!p)return null; return volLater(id,poolFromRec(p)); }); })).then(function(ex){
      var extra=(ex||[]).filter(Boolean);
      function _fin(p){ p.tvlXlm=p.xlm*2; p.tvlUsd=p.tvlXlm*xlmUsd; p.vol24Usd=(p.vol24Xlm||0)*xlmUsd; p.fees24Xlm=(p.vol24Xlm||0)*p.fee/100; p.fees24Usd=p.fees24Xlm*xlmUsd; p.mineShares=myShares[p.id]||0; p.mineFrac=p.shares>0?p.mineShares/p.shares:0; }
      pools.forEach(_fin); extra.forEach(_fin);
      pools.sort(function(a,b){return b.tvlXlm-a.tvlXlm;});
      function _isMine(p){ return p.mineShares>1e-7&&(p.xlm>0||p.tok>0); }   // has shares + pool still has liquidity (works for non-XLM pairs like AQUA/EURC too, where xlm=0)
      // "All Pools" (and the snapshot stats) stay the curated KNOWN pools; the user's positions in OTHER pools
      // (e.g. the non-XLM AQUA/EURC pool) go ONLY into "My Positions" — they must NOT leak into All Pools as
      // bogus "EURC / XLM · 0 XLM" rows (poolFromRec gives a non-XLM pool xlm=0 + the wrong single-side code).
      var mine=pools.filter(_isMine).concat(extra.filter(_isMine));
      DATA={xlmUsd:xlmUsd,pools:pools,mine:mine,balances:(acct&&acct.balances)||[],
        totLiqXlm:pools.reduce(function(s,p){return s+p.tvlXlm;},0), totLiqUsd:pools.reduce(function(s,p){return s+p.tvlUsd;},0),
        totVolXlm:pools.reduce(function(s,p){return s+(p.vol24Xlm||0);},0), totVolUsd:pools.reduce(function(s,p){return s+p.vol24Usd;},0),
        activePools:pools.filter(function(p){return p.tvlXlm>0;}).length, participants:pools.reduce(function(s,p){return s+(p.trustlines||0);},0),
        myTotUsd:mine.reduce(function(s,p){return s+p.tvlUsd*p.mineFrac;},0)};
      try{ paint(); }catch(_e){ try{ console.error("LXPAINT:", (_e&&_e.stack)||_e); }catch(__){} } reveal();
      // second phase: 24h volume/fees arrive after the page is already usable
      runVolQ(function(){ try{ recomputeVol(); paint(); }catch(_ve){ try{ console.error("LXVOL:", (_ve&&_ve.stack)||_ve); }catch(__){} } });
      }); // close extra-positions .then
    }).catch(function(_le){ try{ console.error("LXLOAD:", (_le&&_le.stack)||_le); }catch(__){} try{ reveal(); }catch(___){} });
  }

  function setText(el,t){ if(el&&el.textContent!==t)el.textContent=t; }
  function q(s){return document.querySelector(s);} function qa(s){return [].slice.call(document.querySelectorAll(s));}

  // AUDIT (user-reported: Market Overview shows wrong numbers for a few seconds on refresh). The shimmer
  // mask hides these until lx-ammready, but the 7s safety reveal fired regardless of whether the data had
  // landed — so on a slow Horizon response it UNCOVERED the design's mock (100 pools, 11,274 participants,
  // 51,250 XLM swapped) and presented it as live. Cells we actually write get .lx-snapd; the failsafe dashes
  // any that don't have it, so a slow load degrades to "unknown" instead of to fiction.
  function snapDone(el){ if(el&&el.classList)el.classList.add("lx-snapd"); return el; }
  function paintSnapshot(){
    if(!DATA)return;
    qa(".amm-snapshot-row").forEach(function(row){
      var ic=(row.querySelector(".amm-snapshot-ic")||{}).className||"";
      var val=row.querySelector(".amm-snapshot-value"), subL=row.querySelector(".amm-snapshot-sub");
      var monies=[].slice.call(row.querySelectorAll(".lc-money"));   // the right-side $ ($ lives in an .lc-money the site re-stamps)
      function setMonies(v){ var d=usd(v); monies.forEach(function(m){ if(m.textContent!==d){ m.textContent=d; if(m.setAttribute){m.setAttribute("data-usd",v);m.setAttribute("data-orig",d);} } }); }
      // left sub = a STATIC descriptive caption, set unconditionally so the design's mock (e.g. "51,250 XLM
      // swapped") never persists and never flashes into the script value. The $ figure goes to setMonies (vsub).
      if(/liquidity/.test(ic)){ if(val){setText(val,num(DATA.totLiqXlm)+" XLM");snapDone(val);} setMonies(DATA.totLiqUsd); if(subL)setText(subL,"Across all pools"); }
      else if(/pools/.test(ic)){ if(val){setText(val,String(DATA.activePools));snapDone(val);} if(subL){setText(subL,"");subL.style.display="none";} }
      else if(/volume/.test(ic)){ if(!volReady()){ if(val)setText(val,"\u2014"); if(subL)setText(subL,"Swapped (24h)"); }
        else { if(val){setText(val,num(DATA.totVolXlm)+" XLM");snapDone(val);} setMonies(DATA.totVolUsd); if(subL)setText(subL,"Swapped (24h)"); } }
      else if(/participant/.test(ic)){ if(val){setText(val,num(DATA.participants));snapDone(val);} if(subL)setText(subL,"Unique LP wallets"); }
      else if(/fees/.test(ic)){ if(!volReady()){ if(val)setText(val,"\u2014"); if(subL)setText(subL,"Across all pools"); return; }
        var _fu=DATA.pools.reduce(function(s,p){return s+(p.fees24Usd||0);},0); if(val){setText(val,usd(_fu));snapDone(val);} if(subL)setText(subL,"Across all pools"); }
    });
    buildFeesRow();
    paintHeroStats();
  }
  // Replace the hero's "TOTAL VALUE LOCKED" chip (redundant with the right-side Pool Snapshot) with 4 stats we DON'T show elsewhere.
  // Build the chip structure (labels + skeleton values) IMMEDIATELY at boot so it doesn't pop in ~2s after data.
  function buildHeroStats(){ var chip=q(".lumos-promo.lm-pools .lm-chip"); if(!chip||chip.querySelector(".lx-hstats"))return;
    chip.insertAdjacentHTML("beforeend",'<div class="lx-hstats">'
      +'<div class="lx-hstat" data-k="fees"><span class="v"><span class="lx-hskel"></span></span><span class="l">24h Fees</span></div>'
      +'<div class="lx-hstat" data-k="trades"><span class="v"><span class="lx-hskel"></span></span><span class="l">24h Trades</span></div>'
      +'<div class="lx-hstat" data-k="tokens"><span class="v"><span class="lx-hskel"></span></span><span class="l">Tokens</span></div>'
      +'<div class="lx-hstat" data-k="top"><span class="v"><span class="lx-hpairskel"><span class="pa"></span><span class="pb"></span></span><span class="lx-toptxt lx-hskel"></span></span><span class="l">Top Pool</span></div></div>'); }
  function paintHeroStats(){
    if(!DATA)return; var chip=q(".lumos-promo.lm-pools .lm-chip"); if(!chip)return;
    buildHeroStats();
    var fees=DATA.pools.reduce(function(s,p){return s+(p.fees24Usd||0);},0);
    var trades=DATA.pools.reduce(function(s,p){return s+(p.n24||0);},0);
    var topP=DATA.pools[0]||null;
    // 24h fees/trades are SUMS ACROSS POOLS, so a partial fill isn't "less complete" — it's a wrong
    // number presented as final. Each pool's /trades resolves separately and every DOM mutation triggers
    // a repaint, so the chip visibly counted 0 -> 2 -> 102 -> 202 -> 302 -> 402. Hold both on the loading
    // shimmer until every pool's volume is in. runVolQ's catch sets 0 on failure, so volReady() always
    // becomes true eventually and this can never shimmer forever.
    var vals={tokens:String(DATA.pools.length)};   // "top" handled below (has icons)
    if(volReady()){ vals.fees=usd(fees); vals.trades=num(trades); }
    qa(".lumos-promo.lm-pools .lm-chip .lx-hstat").forEach(function(el){ var k=el.getAttribute("data-k"),v=el.querySelector(".v"); if(!v)return;
      if(k==="top"){ var want=topP?(topP.code+" / XLM"):"\\u2014"; if(v.getAttribute("data-top")!==want){ v.setAttribute("data-top",want); v.innerHTML=topP?(icoPair(topP.code,topP.issuer)+'<span class="lx-toptxt">'+esc(topP.code)+' / XLM</span>'):'<span class="lx-toptxt">\\u2014</span>'; } return; }
      if(vals[k]!=null&&v.textContent!==vals[k]){ v.classList.remove("lx-hskel"); v.textContent=vals[k]; } });
  }

  function volTxt(v){ if(v==null)return "\u2014"; if(v>0&&v<0.01)return "<0.01 XLM"; return num(v)+" XLM"; }
  function feeTxt(f){ if(f==null)return "\u2014"; if(f>0&&f<0.01)return "<0.01 XLM"; return num(f>=0.01?+f.toFixed(2):0)+" XLM"; }
  function allRow(p,i){
    var idx=(i+1<10?"0":"")+(i+1);
    return '<tr class="lx-ammrow" data-pool="'+p.id+'"'+pairAttr(p)+' style="cursor:pointer"><td class="idx">'+idx+'</td>'+
      '<td><div class="pair-cell">'+icoPair(p.code,p.issuer)+'<div><div class="pair-name">'+esc(p.code)+' / XLM</div><div class="pair-sub">'+p.fee+'% fee \\u00b7 Stellar AMM</div></div></div></td>'+
      '<td><div>'+num(p.xlm)+' XLM</div><div class="pair-sub">'+usd(p.tvlUsd)+'</div></td>'+
      (function(){ if(p.vol24Xlm==null)return '<td><div>\u2014</div></td><td><div>\u2014</div></td>';
        var _xu=(DATA&&DATA.xlmUsd)||0, _fx=(p.fees24XlmReal!=null?p.fees24XlmReal:p.vol24Xlm*p.fee/100);
        return '<td><div>'+volTxt(p.vol24Xlm)+'</div><div class="pair-sub">'+usd(p.vol24Xlm*_xu)+'</div></td>'+
               '<td><div>'+feeTxt(_fx)+'</div><div class="pair-sub">'+usd(_fx*_xu)+'</div></td>'; })()+
      '<td>'+num(p.trustlines)+'</td></tr>';
  }
  function myRow(p,i){
    var idx=(i+1<10?"0":"")+(i+1);
    var nonX=p.nonXlm&&p.a0&&p.a1;   // e.g. AQUA/EURC — no XLM side, so render both real reserves
    var pairIco=nonX?icoPairG(p.a0,p.a1):icoPair(p.code,p.issuer);
    var pairName=nonX?(esc(p.a0.code)+' / '+esc(p.a1.code)):(esc(p.code)+' / XLM');
    var liqMain,liqSub;
    if(nonX){ liqMain=qty(p.a0.amount*p.mineFrac)+' '+esc(p.a0.code); liqSub=qty(p.a1.amount*p.mineFrac)+' '+esc(p.a1.code); }
    else { liqMain=qty(p.xlm*p.mineFrac)+' XLM'; liqSub=usd(p.tvlUsd*p.mineFrac); }
    // non-XLM pools break the X/XLM detail page -> View opens the pool on the explorer instead; also mark the row so its click-nav skips the detail page.
    var view=nonX?('<a class="lx-ammview" href="https://stellar.expert/explorer/public/liquidity-pool/'+p.id+'" target="_blank" rel="noopener">View position \\u2192</a>'):('<a class="lx-ammview" href="lumoscore-amm-pool.html?pool='+p.id+'">View position \\u2192</a>');
    return '<tr class="lx-ammrow" data-pool="'+p.id+'"'+pairAttr(p)+''+(nonX?' data-nonxlm="1"':'')+' style="cursor:pointer"><td class="idx">'+idx+'</td>'+
      '<td><div class="pair-cell">'+pairIco+'<div><div class="pair-name">'+pairName+'</div><div class="pair-sub">'+p.fee+'% fee</div></div></div></td>'+
      '<td><div>'+liqMain+'</div><div class="pair-sub">'+liqSub+'</div></td>'+
      '<td>'+(p.mineFrac*100>=0.01?(p.mineFrac*100).toFixed(2):"<0.01")+'%</td>'+
      '<td class="lx-viewcell">'+view+'</td></tr>';
  }
  // inject the animated cosmic decor into the pools hero (once)
  // 5th Market-Overview row: "24h Fees" (parity with the 5-row "New Mints on Stellar" card on Trade).
  // Injected at boot with skeleton values so it doesn't pop in ~2s after data.
  function buildFeesRow(){ var list=q(".amm-snapshot-list"); if(!list||list.querySelector(".lx-feesrow"))return;
    var row=document.createElement("div"); row.className="amm-snapshot-row lx-feesrow";
    row.innerHTML='<div class="amm-snapshot-ic fees"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"></line><circle cx="6.5" cy="6.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle></svg></div>'
      +'<div class="amm-snapshot-meta"><div class="amm-snapshot-label">24h Fees</div><div class="amm-snapshot-sub">Across all pools</div></div>'
      +'<div class="amm-snapshot-right"><div class="amm-snapshot-value">\\u2014</div><div class="amm-snapshot-vsub">Paid to LPs</div></div>';
    list.appendChild(row); }
  function wireHeroCover(){
    var hero=q(".lumos-promo.lm-pools"); if(!hero||hero.querySelector(".lx-cosmic"))return;
    var host=hero.querySelector(".lm")||hero;
    var d=document.createElement("div"); d.className="lx-cosmic";
    d.innerHTML='<div class="lx-neb n1"></div><div class="lx-neb n2"></div><div class="lx-neb n3"></div><div class="lx-stars"></div>'
      +'<svg class="lx-constel" viewBox="0 0 330 330" xmlns="http://www.w3.org/2000/svg"><g><line x1="52" y1="72" x2="146" y2="46"/><line x1="146" y1="46" x2="238" y2="78"/><line x1="52" y1="72" x2="104" y2="134"/><line x1="146" y1="46" x2="104" y2="134"/><line x1="238" y1="78" x2="202" y2="150"/><line x1="104" y1="134" x2="202" y2="150"/><line x1="238" y1="78" x2="284" y2="166"/><line x1="104" y1="134" x2="68" y2="206"/><line x1="202" y1="150" x2="166" y2="222"/><line x1="284" y1="166" x2="252" y2="242"/><line x1="68" y1="206" x2="166" y2="222"/><line x1="166" y1="222" x2="252" y2="242"/><line x1="166" y1="222" x2="124" y2="272"/><line x1="68" y1="206" x2="124" y2="272"/></g><g><circle cx="52" cy="72" r="3.4" style="animation-delay:-.2s"></circle><circle cx="146" cy="46" r="4" style="animation-delay:-1.4s"></circle><circle cx="238" cy="78" r="3" style="animation-delay:-2.1s"></circle><circle cx="104" cy="134" r="4.4" style="animation-delay:-.8s"></circle><circle cx="202" cy="150" r="3.6" style="animation-delay:-2.7s"></circle><circle cx="284" cy="166" r="2.8" style="animation-delay:-1.1s"></circle><circle cx="68" cy="206" r="3.2" style="animation-delay:-3.2s"></circle><circle cx="166" cy="222" r="4.2" style="animation-delay:-.5s"></circle><circle cx="252" cy="242" r="3" style="animation-delay:-1.9s"></circle><circle cx="124" cy="272" r="3.4" style="animation-delay:-2.4s"></circle></g></svg>'
      +'<div class="lx-part p1"></div><div class="lx-part p2"></div><div class="lx-part p3"></div><div class="lx-part p4"></div>';
    host.insertBefore(d, host.firstChild);
    buildHeroStats();   // show the 4 stat labels (+ skeleton values) instantly, not ~2s after data lands
    buildFeesRow();     // add the 5th Market-Overview row up front too
  }
  function myEmptyRow(){ return '<tr class="lx-ammrow"><td colspan="5"><div class="lx-amm-empty"><b>No open positions</b>Add liquidity to a pool to start earning a share of its swap fees.</div></td></tr>'; }
  // The design's #panelMyPositions gets emptied on some machines (can't repro / find the cause), so we OWN
  // the My Positions table entirely: build our own #lx-mypanel that nothing else touches, and toggle it.
  function buildMyPanel(){
    var mp=q("#panelMyPositions"); if(!mp)return null;
    var p=q("#lx-mypanel");
    if(!p){ p=document.createElement("div"); p.className="pools-card"; p.id="lx-mypanel"; p.style.display="none";
      p.innerHTML='<table class="pools"><thead><tr><th>#</th><th>Pair</th><th>Your Liquidity</th><th>Pool Share</th><th class="lx-viewcell"></th></tr></thead><tbody></tbody></table>';
      mp.parentNode.insertBefore(p, mp.nextSibling); }
    return p;
  }
  function fillMyPos(){
    if(!DATA)return; var p=buildMyPanel(); if(!p)return; var tb=p.querySelector("tbody"); if(!tb)return; var want=DATA.mine.length||1;
    if(tb.querySelectorAll(".lx-ammrow").length!==want) tb.innerHTML=DATA.mine.length?DATA.mine.map(myRow).join(""):myEmptyRow();
  }
  function wireMyPosTab(){
    if(window.__lxMyTab)return; var bar=q("#poolTabs"); if(!bar)return; window.__lxMyTab=1;
    buildMyPanel();
    function apply(){ var mineActive=!!window.__lxMine;    // our own click flag — NOT the design's unreliable .active
      var lp=q("#lx-mypanel"), ap=q("#panelAllPools"), mp=q("#panelMyPositions");
      if(mp)mp.style.display="none";                       // never show the design's (emptied) panel
      if(lp){ lp.style.setProperty("display",mineActive?"block":"none","important"); lp.style.setProperty("opacity","1","important"); lp.style.setProperty("visibility","visible","important"); }
      if(ap)ap.style.display=mineActive?"none":"block";
      if(mineActive)fillMyPos();
    }
    // CAPTURE-phase on document: fires BEFORE the design's button handler can stopPropagation. flag = which tab was clicked
    document.addEventListener("click",function(e){ var b=e.target&&e.target.closest&&e.target.closest("#poolTabs button[data-tab]"); if(!b)return; window.__lxMine=(b.getAttribute("data-tab")==="mine"); fillMyPos(); setTimeout(apply,0); setTimeout(apply,80); },true);
    setInterval(function(){ fillMyPos(); apply(); },1200);   // always re-apply (reads the flag) so it self-heals
    window.lxMyDiag=function(){ var p=q("#lx-mypanel"); if(!p)return {error:"no panel"}; var r=p.getBoundingClientRect(),cs=getComputedStyle(p); var tr=p.querySelector("tbody tr"),trr=tr?tr.getBoundingClientRect():null; var ha=null,el=p.parentNode; while(el&&el.nodeType===1){ var s=getComputedStyle(el); if(s.display==="none"||s.visibility==="hidden"||s.height==="0px"){ ha=(el.id||el.className||el.tagName)+":"+s.display+"/"+s.visibility+"/"+s.height; break; } el=el.parentNode; } return {mine:DATA?DATA.mine.length:"ND",rows:p.querySelectorAll(".lx-ammrow").length,disp:cs.display,vis:cs.visibility,op:cs.opacity,ovf:cs.overflow,panelH:Math.round(r.height),panelTop:Math.round(r.top),panelW:Math.round(r.width),rowH:trr?Math.round(trr.height):null,rowTop:trr?Math.round(trr.top):null,parent:(p.parentNode.id||p.parentNode.className||"?"),hiddenAncestor:ha}; };
  }
  // rename the "My Positions" tab -> "My Pools" (keep its count badge — only the text node). Called synchronously
  // at boot (before the async data paint) so the baked "My Positions" never flashes before the rename.
  function renameMineTab(){ var _tb=q("#poolTabs"); if(_tb&&!_tb.hasAttribute("data-lxnonav"))_tb.setAttribute("data-lxnonav","1");   // the design nav shim honours this: tab clicks must never navigate
    var mineBtn=q("#poolTabs button[data-tab=mine]"); if(mineBtn){ [].slice.call(mineBtn.childNodes).forEach(function(nd){ if(nd.nodeType===3&&/My Positions/i.test(nd.nodeValue)){ nd.nodeValue=nd.nodeValue.replace(/My Positions/i,"My Pools"); } }); } }
  // AUDIT (numeric/UX): four All-Pools headers ship with a "\\u2195" sort glyph — Liquidity, 24h Volume,
  // Fees (24h), Participants — but the design never wired them: no handler, no data-sort, cursor:auto.
  // They advertised a feature that did nothing. Sort the real data and re-render.
  var SORTK=null, SORTD=-1;                       // -1 = descending (the useful default for money columns)
  var SORTMAP=[{re:/liquidity/i,f:function(p){return +p.xlm||0;}},
               {re:/24h\\s*volume/i,f:function(p){return +p.vol24Xlm||0;}},
               {re:/fees/i,f:function(p){return +p.fees24Xlm||0;}},
               {re:/participants/i,f:function(p){return +p.trustlines||0;}}];
  function sortedPools(){
    var a=DATA.pools.slice();
    if(!SORTK)return a;
    return a.sort(function(x,y){ var d=SORTK(x)-SORTK(y); return SORTD<0?-d:d; });
  }
  function poolsTable(){ var b=q("#poolsBody"); return b&&b.closest?b.closest("table"):null; }
  // discovery is glyph-based ONCE, then we tag the headers — the glyph gets swapped for a direction arrow,
  // so a later glyph search would no longer find them.
  function sortHeaders(){
    var t=poolsTable(); if(!t)return [];
    var tagged=[].slice.call(t.querySelectorAll("thead th[data-lxsortable]"));
    if(tagged.length)return tagged;
    return [].slice.call(t.querySelectorAll("thead th")).filter(function(x){return /\\u2195/.test(x.textContent);});
  }
  // the design puts the glyph in <span class="sort-i">, not in a text node of the th
  function setGlyph(th,g){
    var s=th.querySelector(".sort-i"); if(s){ if(s.textContent!==g)s.textContent=g; return; }
    [].slice.call(th.childNodes).forEach(function(nd){ if(nd.nodeType===3&&/[\\u2191\\u2193\\u2195]/.test(nd.nodeValue)) nd.nodeValue=nd.nodeValue.replace(/[\\u2191\\u2193\\u2195]/,g); });
  }
  function wireSort(){
    sortHeaders().forEach(function(th){
      if(th.__lxsort)return; th.__lxsort=1;
      var m=null; for(var i=0;i<SORTMAP.length;i++){ if(SORTMAP[i].re.test(th.textContent)){ m=SORTMAP[i]; break; } }
      if(!m){ th.style.cursor="default"; return; }                 // a glyph we cannot map -> don't pretend
      th.setAttribute("data-lxsortable","1");
      th.__lxsortf=m.f;
      th.style.cursor="pointer"; th.style.userSelect="none";
    });
  }
  // The click itself is handled at WINDOW capture. A listener on the th cannot win: the design ships a
  // document-level capture shim that maps label text to pages, and document capture runs before the target
  // phase — so clicking "Liquidity" NAVIGATED instead of sorting. Window capture fires first, and
  // stopImmediatePropagation keeps the shim from ever seeing it.
  function doSort(th){
    if(SORTK===th.__lxsortf){ SORTD=-SORTD; } else { SORTK=th.__lxsortf; SORTD=-1; }
    var body=q("#poolsBody");
    if(body&&DATA&&DATA.pools.length){ body.innerHTML=sortedPools().map(allRow).join(""); try{ healLogos(); }catch(_){} }
    sortHeaders().forEach(function(o){ setGlyph(o, o===th?(SORTD<0?"\\u2193":"\\u2191"):"\\u2195"); });
  }
  if(!window.__lxAmmSortWired){ window.__lxAmmSortWired=1;
    window.addEventListener("click",function(e){
      var t=e.target; if(!t||!t.closest)return;
      var th=t.closest("th[data-lxsortable]"); if(!th||!th.__lxsortf)return;
      e.preventDefault(); e.stopImmediatePropagation();
      doSort(th);
    },true);
  }
  function paintTables(){
    if(!DATA)return;
    wireHeroCover(); wireMyPosTab();
    var allBody=q("#poolsBody");
    // Render once per meaningful state, not once ever: the old "rows already exist -> never touch it"
    // guard meant the deferred 24h volume/fees could never reach the table (the columns stayed dashed
    // forever while the snapshot above them filled in). Keyed on row count + whether volume has landed
    // + the active sort, so a repaint with nothing new produces byte-identical HTML and the
    // MutationObserver loop still settles on the first pass.
    var _tsig=DATA.pools.length+"|"+(volReady()?1:0)+"|"+String(SORTK)+"|"+SORTD;
    if(allBody && (!allBody.querySelector(".lx-ammrow") || allBody.getAttribute("data-lxsig")!==_tsig)){
      allBody.innerHTML=DATA.pools.length?sortedPools().map(allRow).join(""):'<tr class="lx-ammrow"><td colspan="6"><div class="lx-amm-empty"><b>No pools yet</b>Launch a token to create its first pool.</div></td></tr>';
      allBody.setAttribute("data-lxsig",_tsig);
      try{ healLogos(); }catch(_){}
    }
    wireSort();
    // My Positions TAB panel (design's original tab layout, restored)
    fillMyPos();
    // tab counts: All Pools | My Positions
    var allc=q("#poolTabs button[data-tab=all] .count")||q("#poolTabs .count"); if(allc){setText(allc,String(DATA.pools.length));snapDone(allc);}
    var minec=q("#poolTabs button[data-tab=mine] .count"); if(minec){setText(minec,String(DATA.mine.length));snapDone(minec);}
    renameMineTab();
    // pagination footer: real count, single page (design mock said "1-10 of 100")
    var pag=q("#paginationAll"); if(pag){ var st=pag.querySelectorAll("strong"); if(st[0])setText(st[0],(DATA.pools.length?"1":"0")+"\\u2013"+DATA.pools.length); if(st[1])setText(st[1],String(DATA.pools.length)); var pc=pag.querySelector(".page-controls"); if(pc)pc.style.display=DATA.pools.length>10?"":"none"; }
    wireCreatePool();
  }
  // header/subtitle testnet wording
  function paintCopy(){
    qa("main p, .amm-hero p, .amm-sub").forEach(function(p){ if(/on Aptos.s on-chain AMM|Aptos.s on-chain/i.test(p.textContent)) p.textContent="Provide liquidity and earn fees on Stellar\\u2019s mainnet AMM pools."; });
  }

  function paint(){ paintSnapshot(); paintTables(); paintCopy(); try{ healLogos(); }catch(_){} }
  function reveal(){ document.documentElement.classList.add("lx-ammready"); }
  // poolFromRec normalises Horizon's reserves into a0/a1 ({code,issuer,native}) — there is no
  // .reserves on the record by the time a row is built.
  function urlSeg(x){ return (!x||x.native||x.code==="XLM") ? "native" : (x.code+"-"+x.issuer); }
  // TWO record shapes reach a row: wallet pools go through poolFromRec (a0/a1), while the curated
  // KNOWN list builds {code,issuer,...} directly and is always <code>/XLM.
  function pairAttr(p){ try{ if(!p)return "";
    var a,b;
    if(p.a0&&p.a1){ a=urlSeg(p.a0); b=urlSeg(p.a1); }
    else if(p.code&&p.issuer){ a="native"; b=p.code+"-"+p.issuer; }
    else return "";
    if(b==="native"){ var t=a; a=b; b=t; }   // native first = Stellar's canonical order = one url per pool
    if(a===b)return "";
    return ' data-pair="'+a+'|'+b+'"'; }catch(e){ return ""; } }
  var sched=false;
  function schedule(){ if(sched)return; sched=true; (window.requestAnimationFrame||function(f){setTimeout(f,16);})(function(){ sched=false; paint(); }); }
  function detailUrl(hex,fromDest,pair){
    // a pool's clean url is its two assets; fall back to ?pool=<id> when the pair is unknown
    if(pair){ var _q=String(pair).split("|"); if(_q.length===2) return "/pools/stellar/"+_q[0]+"/"+_q[1]; }
 var suf=/-dark\\./.test(location.pathname)?"-dark":(/-mobile\\./.test(location.pathname)?"-mobile":""); var base="lumoscore-amm-pool"+suf+".html"; if(fromDest&&String(fromDest).indexOf("amm-pool")>=0)base=String(fromDest).split("?")[0]; base=base.split("-light.html").join(".html"); if(["lumoscore-amm-pool.html","lumoscore-amm-pool-dark.html","lumoscore-amm-pool-mobile.html"].indexOf(base)<0)base="lumoscore-amm-pool"+suf+".html"; return base+"?pool="+hex; }
  function wireNav(){
    var _nav=window.lxNavigate;
    window.lxNavigate=function(cands){
      try{ var t=window.event&&window.event.target;
        var cpItem=t&&t.closest&&t.closest("#createPoolModal .ad-item"); if(cpItem){ if(window.__lxCpSel)window.__lxCpSel(cpItem); return; }
        var cpPick=t&&t.closest&&t.closest("#createPoolModal .asset-picker"); if(cpPick){ var _fld=cpPick.closest(".asset-field"); var _dd=_fld&&_fld.querySelector(".asset-dropdown"); if(_dd){ var _wo=_dd.classList.contains("open"); [].slice.call(document.querySelectorAll("#createPoolModal .asset-dropdown")).forEach(function(x){x.classList.remove("open");x.style.display="";}); if(!_wo){ _dd.classList.add("open"); _dd.style.display="block"; } } return; }   // toggle the asset dropdown open/closed
        if(t&&t.closest&&t.closest("#createPoolModal")){ [].slice.call(document.querySelectorAll("#createPoolModal .asset-dropdown.open")).forEach(function(x){x.classList.remove("open");x.style.display="";}); return; }   // click elsewhere in the modal -> close any open dropdown, block mock nav
        var row=t&&t.closest&&t.closest(".lx-ammrow[data-pool]"); if(row){ location.href=detailUrl(row.getAttribute("data-pool"),cands&&cands[0],row.getAttribute("data-pair")); return; } }catch(e){}
      return _nav?_nav.apply(this,arguments):(cands&&cands[0]&&(location.href=cands[0]));
    };
    document.addEventListener("click",function(e){ var r=e.target&&e.target.closest&&e.target.closest(".lx-ammrow[data-pool]"); if(r&&!r.getAttribute("data-nonxlm")&&!(e.target.closest&&e.target.closest("a[href]"))){ e.stopImmediatePropagation(); location.href=detailUrl(r.getAttribute("data-pool"),null,r.getAttribute("data-pair")); } },true);
  }
  // ==================== DETAIL PAGE ====================
  var IPAL=["#ea6a2c","#7c6cf5","#2dd4bf","#ec4899","#3b82f6","#06b6d4","#f59e0b","#22c55e"];
  var __lxPoolId="";
  function poolParam(){ if(__lxPoolId)return __lxPoolId;
    try{ if(window.__lxRoute&&window.__lxRoute.poolId)return window.__lxRoute.poolId; }catch(_){} try{ return (new URLSearchParams(location.search)).get("pool")||""; }catch(e){ var m=location.search.match(/pool=([a-f0-9]+)/i); return m?m[1]:""; } }
  // Clean urls address a pool by its two ASSETS (/pools/stellar/native/LUMOS-G…), but everything below
  // works from the pool's hex id. Horizon can look one up from the reserve pair — note it wants
  // CODE:ISSUER (not CODE-ISSUER) and its own canonical ordering, so both orders are tried.
  function specOf(seg){ if(!seg)return null; if(seg.toLowerCase()==="native"||seg.toUpperCase()==="XLM")return "native";
    var i=seg.indexOf("-"); return i>0 ? (seg.slice(0,i)+":"+seg.slice(i+1)) : null; }
  function resolvePair(a,b,cb){
    var x=specOf(a), y=specOf(b);
    if(!x||!y){ cb(""); return; }
    function tryOrder(p,q,next){
      getJSON(H+"/liquidity_pools?reserves="+encodeURIComponent(p+","+q)+"&limit=1").then(function(d){
        var r=d&&d._embedded&&d._embedded.records&&d._embedded.records[0];
        if(r&&r.id){ cb(r.id); return; }
        if(next)next(); else cb("");
      });
    }
    tryOrder(x,y,function(){ tryOrder(y,x,null); });
  }
  function hshort(h){ return h?h.slice(0,6)+"\\u2026"+h.slice(-4):""; }
  function ashort(a){ return a?a.slice(0,4)+"\\u2026"+a.slice(-4):"\\u2014"; }
  function fprice(x){ x=+x||0; if(x>=1)return x.toFixed(4); if(x>=0.0001)return x.toFixed(6); return x.toPrecision(3); }
  function pusd(x){ x=+x||0; if(!x)return "$0.00"; if(x>=1)return "$"+x.toFixed(2); return "$"+x.toFixed(x>=0.01?4:(x>=0.0001?6:8)); }
  // strip trailing zeros from a fixed-decimal string ("0.0000001000" -> "0.0000001")
  function trimZ(s){ return s.indexOf(".")<0?s:s.replace(/0+$/,"").replace(/[.]$/,""); }
  // AUDIT: toPrecision() emits scientific notation for small balances, so a 0.0000001 AQUA balance rendered
  // as "1.0e-7". Stellar amounts are 7dp decimals and exponent form is not a valid amount anywhere in this
  // UI (it also fed the MAX button, which put "1e-7" straight into the deposit input).
  function famt(x){ x=+x||0; if(x>=1000)return num(x); if(x>=1)return x.toFixed(2); if(x>=0.0001)return x.toFixed(6); return x?trimZ(x.toFixed(7)):"0"; }
  function xlmc(x){ x=+x||0; var a=Math.abs(x); if(a>=1e6)return (x/1e6).toFixed(2)+"M XLM"; if(a>=1e3)return (x/1e3).toFixed(1)+"K XLM"; if(a>=1)return num(x)+" XLM"; return x.toFixed(2)+" XLM"; }
  function setMoneyEl(m,usdv,disp){ if(!m)return; m.textContent=disp; if(m.setAttribute){ m.setAttribute("data-usd",usdv); m.setAttribute("data-orig",disp); } }
  function ident(seed,size){ size=size||26; var s=(seed||"x")+""; var hh=2166136261; for(var i=0;i<s.length;i++){ hh^=s.charCodeAt(i); hh=(hh*16777619)>>>0; } var bg=IPAL[hh%IPAL.length]; var fg=IPAL[(Math.floor(hh/7))%IPAL.length]; if(fg===bg)fg="#ffffff"; var cell=size/5,rects=""; for(var c=0;c<3;c++){ for(var rr=0;rr<5;rr++){ if((hh>>(c*5+rr))&1){ var xs=[c]; if(c<2)xs.push(4-c); xs.forEach(function(xx){ rects+='<rect x="'+(xx*cell).toFixed(2)+'" y="'+(rr*cell).toFixed(2)+'" width="'+cell.toFixed(2)+'" height="'+cell.toFixed(2)+'" fill="'+fg+'"></rect>'; }); } } } return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'" style="border-radius:50%;background:'+bg+'" xmlns="http://www.w3.org/2000/svg">'+rects+'</svg>'; }
  // real token logo for the pool's non-XLM asset (was a hardcoded placeholder). Known map + launch icons +
  // harvested cache, with a stellar.expert toml fallback that fills the header <img> async.
  var AMLOGOS={XLM:"assets/tokens/xlm.png",AQUA:"assets/tokens/aqua.png",USDC:"assets/tokens/usdc.png",yUSDC:"assets/tokens/usdc.png",EURC:"https://assets.coingecko.com/coins/images/26045/small/euro.png",yXLM:"https://assets.coingecko.com/coins/images/100/small/fmpFRHHQ_400x400.jpg",BLND:"assets/tokens/blnd.svg",SHX:"assets/tokens/shx.png",SSLX:"assets/tokens/sslx.png"};
  function amTokUrl(code,issuer){ return AMLOGOS[code]||launchIcon(code,issuer)||((window.__lxLogos||{})[code])||""; }
  function amFetchLogo(code,issuer,cb){ var u=amTokUrl(code,issuer); if(u){cb(u);return;} if(!code||!issuer){cb("");return;} getJSON("https://api.stellar.expert/explorer/public/asset?search="+encodeURIComponent(code)+"&limit=20").then(function(d){ var recs=(d&&d._embedded&&d._embedded.records)||[]; var m=recs.filter(function(rc){return (rc.asset||"").indexOf(code+"-"+issuer)===0;})[0]; var ti=(m&&(m.tomlInfo||m.toml_info))||{}; var img=ti.image||ti.orgLogo||""; if(img){AMLOGOS[code]=img;try{(window.__lxLogos=window.__lxLogos||{})[code]=img;}catch(_){}} cb(img||""); }).catch(function(){cb("");}); }
  function tokLogo(){ var c=(DET&&DET.code)||"", i=(DET&&DET.issuer)||""; var av=avatarUri(c); var u=amTokUrl(c,i)||av;
    return '<img class="lx-tokimg" data-lxc="'+esc(c)+'" data-lxi="'+esc(i)+'" src="'+u+'" alt="" onerror="this.onerror=null;this.src=\\x27'+av+'\\x27">'; }
  function xlmLogo(){ return '<img src="assets/tokens/xlm.png" alt="">'; }
  // logo for ANY pair side (nonXlm pools have two credit assets; tokLogo only knows DET.code)
  function genLogo(a){ if(!a||a.native||a.code==="XLM")return xlmLogo(); var av=avatarUri(a.code); var u=amTokUrl(a.code,a.issuer)||av;
    return '<img class="lx-tokimg" data-lxc="'+esc(a.code)+'" data-lxi="'+esc(a.issuer)+'" src="'+u+'" alt="" onerror="this.onerror=null;this.src=\\x27'+av+'\\x27">'; }

  var DET=null;
  function loadDetail(){
    var hex=poolParam();
    if(!hex){
      var _r=window.__lxRoute;
      if(_r&&_r.poolA&&_r.poolB&&!window.__lxPairTried){
        window.__lxPairTried=1;
        resolvePair(_r.poolA,_r.poolB,function(id){ if(!id){ reveal(); return; } __lxPoolId=id; loadDetail(); });
        return;
      }
      reveal(); return;
    }
    // the page was BLACK for ~3s (whole layout gated hidden until all 6 fetches resolve). Reveal the structure
    // fast so the user sees the page + skeletons; paintDetail/guardHeader fill/replace values as data lands.
    setTimeout(function(){ try{ reveal(); }catch(_){} }, 700);
    // visible, recoverable failure state — beats dashes + an eternal loader with no explanation
    function detailFail(){
      try{
        qa(".ph-name, .crumb span:last-child").forEach(function(e){ setText(e,"\\u2014"); });
        qa(".ph-stat .v, .ph-stat .s, .ph-price .v").forEach(function(e){ setText(e,"\\u2014"); });
        var svg=q("#tvlChart svg");
        if(svg){ [].slice.call(svg.querySelectorAll(".lx-chload")).forEach(function(e){ if(e.parentNode)e.parentNode.removeChild(e); });
          var t=chS("text",{"class":"lx-chload",x:"500",y:"140","text-anchor":"middle","dominant-baseline":"middle",fill:"var(--text-muted,#8b90a0)","font-size":"13"});
          t.textContent="Pool history unavailable"; svg.appendChild(t); }
        document.documentElement.classList.add("lx-chartready");
        var host=q(".pool-header")||q("main");
        if(host&&!q(".lx-detfail")){
          var b=document.createElement("div"); b.className="lx-detfail";
          b.innerHTML='<span>Couldn\\u2019t load this pool from Horizon \\u2014 the network may be busy or temporarily unreachable. Nothing is wrong with the pool itself.</span><button type="button" class="lx-detretry">Retry</button>';
          host.appendChild(b);
          b.querySelector(".lx-detretry").addEventListener("click",function(){ b.remove(); DET=null; try{ loadDetail(); }catch(_){} });
        }
      }catch(_){}
      reveal();
    }
    window.__lxDetFail=detailFail;    // the 7s failsafe reuses this instead of dashing with no explanation
    // getJSON never REJECTS — it resolves null on a non-2xx *and* on a network error
    // (fetch().then(r=>r.ok?r.json():null).catch(()=>null)). So retrying has to key on a null result,
    // not on a rejection, and the auxiliary calls already degrade on their own: a null trades/operations
    // /participants response only empties its own section, it can never sink the page.
    // The pool record IS the page, so give a busy or throttled Horizon three chances before giving up —
    // that is what stopped the user having to hit Retry on a transient blip. Still resolves null at the
    // end, so the !p.reserves guard below stays the single place failure is handled.
    function poolTry(n){ return getJSON(H+"/liquidity_pools/"+hex).then(function(p){
      if(p&&p.reserves)return p;
      if(n<=0)return p;
      return new Promise(function(rs){ setTimeout(rs,800); }).then(function(){ return poolTry(n-1); }); }); }
    window.__lxDetLoading=1;
    var xlmP=getJSON("https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd");
    var poolP=poolTry(2);
    var trP=getJSON(H+"/liquidity_pools/"+hex+"/trades?order=desc&limit=100");
    var opP=getJSON(H+"/liquidity_pools/"+hex+"/operations?order=desc&limit=50");
    var partP=getJSON(H+"/accounts?liquidity_pool="+hex+"&limit=100");
    var acctP=myAddr()?(window.__lxAcct?window.__lxAcct(myAddr()):getJSON(H+"/accounts/"+myAddr())):Promise.resolve(null);
    Promise.all([xlmP,poolP,trP,opP,partP,acctP]).then(function(r){
      window.__lxDetLoading=0;
      var xlmUsd=xuSave((r[0]&&r[0].stellar&&+r[0].stellar.usd)||0)||xuFallback();
      // AUDIT (user-reported "still not loading"): this used to reveal() and give up in silence, so a failed
      // or throttled Horizon call left the page dashed forever with a permanent "Loading pool history…" and
      // no way to recover. Say what happened and offer a retry.
      var p=r[1]; if(!p||!p.reserves){ detailFail(); return; }
      var xlm=0,tok=0,code="TOKEN",issuer="";
      p.reserves.forEach(function(rv){ if(rv.asset==="native")xlm=+rv.amount; else { tok=+rv.amount; var pp=rv.asset.split(":"); code=pp[0]; issuer=pp[1]||""; } });
      var fee=(p.fee_bp||30)/100;
      var priceXlm=tok>0?xlm/tok:0, priceUsd=priceXlm*xlmUsd;
      var tvlXlm=xlm*2, tvlUsd=tvlXlm*xlmUsd;
      // AUDIT (user-reported, pool 344e66\\u2026): this page assumed every pool is token/XLM. That pool is
      // USDC/LUMOS — both reserves are credit assets, so the XLM slot read 0, TVL/price showed $0, the pair
      // name lied, and a painter exception left the whole right rail on design mock. Pair-aware model:
      // nonXlm pools orient a0 = the canonical-USDC side when present (keeps USD figures real); XLM pools
      // keep every legacy field and code path EXACTLY as before.
      var USDC_ISS="GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
      var rz=(p.reserves||[]).map(function(rv){ var nat=rv.asset==="native"; var pp=nat?["XLM",""]:rv.asset.split(":"); return {code:pp[0],issuer:pp[1]||"",amt:+rv.amount,native:nat}; });
      var nonXlm=rz.length===2&&!rz[0].native&&!rz[1].native;
      var a0=rz[0]||null, a1=rz[1]||null;
      if(nonXlm&&a1.code==="USDC"&&a1.issuer===USDC_ISS){ a0=rz[1]; a1=rz[0]; }
      var pxA0perA1=0;
      if(nonXlm){ code=a1.code; issuer=a1.issuer; tok=a1.amt; xlm=0;
        pxA0perA1=a1.amt>0?a0.amt/a1.amt:0;
        if(a0.code==="USDC"&&a0.issuer===USDC_ISS){ tvlUsd=a0.amt*2; priceUsd=pxA0perA1; } }
      var pairName=nonXlm?(a0.code+" / "+a1.code):(code+" / XLM");
      var now=Date.now();
      var trs=(r[2]&&r[2]._embedded&&r[2]._embedded.records)||[];
      var vol=0, txs=[];
      trs.forEach(function(x){
        var nb=x.base_asset_type==="native";
        var xa=nb?+x.base_amount:+x.counter_amount, ta=nb?+x.counter_amount:+x.base_amount;
        if(nonXlm){ var _bA0=(x.base_asset_code===a0.code&&x.base_asset_issuer===a0.issuer); xa=_bA0?+x.base_amount:+x.counter_amount; ta=_bA0?+x.counter_amount:+x.base_amount; }
        var ts=Date.parse(x.ledger_close_time||x.created_at||"");
        if(now-ts<=864e5)vol+=xa;
        // AUDIT (numeric): buy/sell here is stated w.r.t. the TOKEN, but base_is_seller is w.r.t. the BASE
        // asset — and Horizon picks base canonically, so base is sometimes XLM and sometimes the token.
        // The old plain negation only held when base was native; it was inverted for every pair whose
        // base is the token. base_is_seller=true means the taker BOUGHT the base (verified against a live
        // order book: those trades execute at the ask), so flip only when base is XLM.
        txs.push({type:"swap",xlm:xa,tok:ta,who:(x.base_account||x.counter_account||""),time:ts,buy:nb?!x.base_is_seller:!!x.base_is_seller});
      });
      var vol24Xlm=vol, vol24Usd=vol*xlmUsd, fees24Xlm=vol*fee/100, fees24Usd=fees24Xlm*xlmUsd;
      if(nonXlm){ var _a0usd=(a0.code==="USDC"&&a0.issuer===USDC_ISS); vol24Usd=_a0usd?vol:0; fees24Usd=_a0usd?fees24Xlm:0; }
      var ops=(r[3]&&r[3]._embedded&&r[3]._embedded.records)||[];
      function amt(arr){ var xx=0,tt=0; (arr||[]).forEach(function(rv){ if(rv.asset==="native")xx=+rv.amount; else tt=+rv.amount; }); return {x:xx,t:tt}; }
      ops.forEach(function(o){
        var ts=Date.parse(o.created_at||"");
        if(o.type==="liquidity_pool_deposit"){ var a=amt(o.reserves_deposited); txs.push({type:"deposit",xlm:a.x,tok:a.t,who:o.source_account,time:ts}); }
        else if(o.type==="liquidity_pool_withdraw"){ var b=amt(o.reserves_received||o.reserves_min); txs.push({type:"withdraw",xlm:b.x,tok:b.t,who:o.source_account,time:ts}); }
      });
      txs.sort(function(a,b){return b.time-a.time;});
      var accs=(r[4]&&r[4]._embedded&&r[4]._embedded.records)||[];
      var parts=[], myShares=0;
      accs.forEach(function(a){ var id=a.account_id||a.id; (a.balances||[]).forEach(function(b){ if(b.asset_type==="liquidity_pool_shares"&&b.liquidity_pool_id===hex){ parts.push({addr:id,shares:+b.balance}); if(myAddr()&&id===myAddr())myShares=+b.balance; } }); });
      var totShares=+p.total_shares||parts.reduce(function(s,x){return s+x.shares;},0);
      parts.forEach(function(x){ x.frac=totShares>0?x.shares/totShares:0; });
      parts.sort(function(a,b){return b.shares-a.shares;});
      // AUDIT #3 bug 6 (FUNDS): balXlm was the RAW native balance, so the pool Deposit field offered the
      // full 9.73 XLM when only 1.73 is actually spendable — the same contradiction just fixed on Send,
      // Swap and Trade, still live here. Use the wallet's shared spendable figure when available and
      // mirror its formula otherwise (base+subentries+sponsorship reserve, selling liabilities, fee head-room).
      var acct=r[5], balTok=0,balXlm=0,balXlmRaw=0,balXlmSell=0,balA0=0, subs=(acct&&acct.subentry_count)||0;
      if(acct){ (acct.balances||[]).forEach(function(b){ if(b.asset_type==="native"){balXlmRaw=+b.balance;balXlmSell=+b.selling_liabilities||0;} else if(b.asset_code===code&&b.asset_issuer===issuer)balTok=+b.balance; if(nonXlm&&a0&&b.asset_code===a0.code&&b.asset_issuer===a0.issuer)balA0=+b.balance; if(b.asset_type==="liquidity_pool_shares"&&b.liquidity_pool_id===hex)myShares=+b.balance; }); }
      // spendable XLM: prefer the wallet engine figure so every surface states one number
      var _spon=((acct&&+acct.num_sponsoring)||0)-((acct&&+acct.num_sponsored)||0);
      var _res=(2+subs+_spon)*0.5;
      balXlm=(window.__lxMaxXLM!=null)?window.__lxMaxXLM:Math.max(0,balXlmRaw-_res-balXlmSell-0.001);
      var myFrac=totShares>0?myShares/totShares:0;
      var _det={hex:hex,code:code,issuer:issuer,xlm:xlm,tok:tok,fee:fee,priceXlm:priceXlm,priceUsd:priceUsd,xlmUsd:xlmUsd,
        tvlXlm:tvlXlm,tvlUsd:tvlUsd,vol24Xlm:vol24Xlm,vol24Usd:vol24Usd,fees24Xlm:fees24Xlm,fees24Usd:fees24Usd,
        txs:txs,parts:parts,totShares:totShares,myShares:myShares,myFrac:myFrac,balTok:balTok,balXlm:balXlm,balXlmRaw:balXlmRaw,subs:subs,
        pairName:pairName,nonXlm:nonXlm,a0:a0,a1:a1,pxA0perA1:pxA0perA1,balA0:balA0};
      // MUTATE the existing DET in place on refresh (don't replace it) so wireDW's captured d (===DET)
      // stays valid with fresh numbers — this lets add/withdraw re-fetch+repaint with NO page reload.
      if(DET){for(var _k in _det)DET[_k]=_det[_k];}else{DET=_det;}
      try{ var _fb=q(".lx-detfail"); if(_fb)_fb.remove();                      // data arrived after all
        var _cs=q("#tvlChart svg");
        if(_cs){ [].slice.call(_cs.querySelectorAll(".lx-chload")).forEach(function(e){
          if(/unavailable/i.test(e.textContent||"")&&e.parentNode)e.parentNode.removeChild(e); }); } }catch(_){}
      paintDetail(); reveal();
    });
  }

  function pdHeader(){
    var d=DET;
    var name=q(".ph-name"); if(name)setText(name,d.pairName||(d.code+" / XLM"));
    qa(".pool-header span").forEach(function(s){ if(/Pool ID:/.test(s.textContent))setText(s,"Pool ID: "+hshort(d.hex)); });
    // "View on Explorer" (the external-link icon button, path starts "M18 13"): open the pool on stellar.expert.
    qa(".pool-header button").forEach(function(b){ if(b.__lxex)return; var p=b.querySelector("svg path"); var dd=(p&&p.getAttribute("d"))||""; if(dd.indexOf("M18 13")!==0&&dd.indexOf("M15 3")!==0&&!/3h6|14L21/.test(dd))return; b.__lxex=1; var c=b.cloneNode(true); b.parentNode.replaceChild(c,b); c.setAttribute("title","View on Explorer"); c.addEventListener("click",function(e){ e.preventDefault(); e.stopImmediatePropagation(); window.open("https://stellar.expert/explorer/public/liquidity-pool/"+d.hex,"_blank","noopener"); },true); });
    var pi=q(".ph-icons"); if(pi&&pi.getAttribute("data-lxdet")!=="1"){ pi.setAttribute("data-lxdet","1"); pi.innerHTML='<div class="pa" data-lxfixed="1">'+tokLogo()+'</div><div class="pb" data-lxfixed="1">'+xlmLogo()+'</div>'; amFetchLogo(d.code,d.issuer,function(url){ var im=pi.querySelector(".pa img"); if(im&&url)im.src=url; }); }
    var pv=q(".ph-price .v"), pm=q(".ph-price .lc-money");
    if(d.nonXlm){ if(pv)setText(pv,fprice(d.pxA0perA1)+" "+d.a0.code); if(pm)setMoneyEl(pm,d.priceUsd,d.priceUsd>0?pusd(d.priceUsd):"\\u2014"); }
    else { if(pv)setText(pv,fprice(d.priceXlm)+" XLM"); if(pm)setMoneyEl(pm,d.priceUsd,pusd(d.priceUsd)); }
    var ps=q(".ph-price .s"); if(ps){ [].slice.call(ps.childNodes).forEach(function(nd){ if(nd.nodeType===3&&/per /.test(nd.textContent)&&nd.textContent.indexOf(d.code)<0)nd.textContent=" per "+d.code; }); }
    guardHeader(); fixWithdrawPair();
    document.documentElement.classList.add("lx-detpr");   // real pair painted -> reveal the (until-now masked) pair labels
  }
  // The withdraw tab's "Withdraw from position" input row shows a baked "LUMOS / XLM" mock (the design re-creates
  // it on every tab switch, so it isn't corrected by pdCopy). Rewrite its text node to the real pair + fix its ico.
  // Guarded (data-lxpair) so it's a no-op once correct (the .dw-card observer would otherwise loop on our write).
  function fixWithdrawPair(){ if(!DET)return; var row=q("#dwWithdraw .dw-field .row .asset"); if(!row)return; var want=DET.pairName||(DET.code+" / XLM");
    [].slice.call(row.childNodes).forEach(function(nd){ if(nd.nodeType===3&&nd.textContent.trim()&&nd.textContent.trim()!==want)nd.textContent=want; });
    // the design's data-logo painter hijacks this .ico (stamps data-logo="APT", paints a background and
    // EMPTIES it) — detect the hijack (or a missing img) and undo it; the re-inserted <img> makes the
    // element fail the painter's isCandidate() from then on.
    var ic=row.querySelector(".ico");
    if(ic&&(ic.getAttribute("data-logo")||ic.getAttribute("data-lxwp")!=="1"||!ic.querySelector("img"))){
      ic.removeAttribute("data-logo"); ic.style.removeProperty("background"); ic.style.removeProperty("background-image");
      ic.setAttribute("data-lxwp","1"); ic.setAttribute("data-lxfixed","1"); ic.style.overflow="hidden"; ic.innerHTML=tokLogo(); }
    row.setAttribute("data-lxpair","1"); }
  function guardHeader(){
    var pp=q(".ph-price"); if(!pp||pp.__lxg)return; pp.__lxg=1;
    try{ new MutationObserver(function(){ if(!DET)return; var ps=q(".ph-price .s"); if(!ps)return; [].slice.call(ps.childNodes).forEach(function(nd){ if(nd.nodeType===3&&/per /.test(nd.textContent)&&nd.textContent.indexOf(DET.code)<0)nd.textContent=" per "+DET.code; }); }).observe(pp,{childList:true,subtree:true,characterData:true}); }catch(e){}
  }
  function pdStats(){
    var d=DET;
    qa(".ph-stat").forEach(function(s){
      var ic=s.querySelector(".ic"); var cn=ic?((ic.className&&ic.className.baseVal!==undefined)?ic.className.baseVal:ic.className):"";
      var v=s.querySelector(".v"), sub=s.querySelector(".s");
      var U0=d.nonXlm?d.a0.code:"XLM";
      if(/liq/.test(cn)){ if(d.nonXlm){ if(v)setText(v,num(d.a0.amt)+" "+U0); if(sub)setText(sub,"+ "+num(d.a1.amt)+" "+d.a1.code+" \\u00b7 \\u2248 "+(d.tvlUsd>0?usd(d.tvlUsd):"\\u2014")); }
        else { if(v)setText(v,num(d.xlm)+" XLM"); if(sub)setText(sub,"+ "+num(d.tok)+" "+d.code+" \\u00b7 \\u2248 "+usd(d.tvlUsd)); } }
      else if(/vol/.test(cn)){ if(v)setText(v,num(d.vol24Xlm)+" "+U0); if(sub)setText(sub,d.nonXlm?(d.vol24Usd>0?"\\u2248 "+usd(d.vol24Usd):"24h volume"):"\\u2248 "+usd(d.vol24Usd)); }
      else if(/fee/.test(cn)){ if(v)setText(v,(d.fees24Xlm>=0.01?d.fees24Xlm.toFixed(2):"0")+" "+U0); if(sub)setText(sub,(d.nonXlm&&!(d.fees24Usd>0)?"":"\\u2248 "+usd(d.fees24Usd)+" \\u00b7 ")+d.fee+"% fee tier"); }
    });
  }
  // ---- REAL-DATA chart engine: takes over the design's synthetic candlestick/line/volume renderer ----
  // Reconstructs the pool's TVL (2x XLM reserve) and volume over its ACTUAL lifetime from on-chain txs,
  // then draws line / candlestick / volume for the active {type, metric, range} (read from __tvlChartState).
  var SVGNS="http://www.w3.org/2000/svg";
  function chS(tag,at){ var e=document.createElementNS(SVGNS,tag); for(var k in at)e.setAttribute(k,at[k]); var c=e.getAttribute("class")||""; e.setAttribute("class",(c?c+" ":"")+"lx-ch"); return e; }
  function chBuild(){
    var d=DET, evs=d.txs.filter(function(t){return t.time;}).slice();
    var desc=evs.slice().sort(function(a,b){return b.time-a.time;});   // newest first
    var r=d.xlm, pts=[{t:Date.now(),r:d.xlm}];
    desc.forEach(function(e){ if(e.type==="deposit")r-=e.xlm; else if(e.type==="withdraw")r+=e.xlm; else if(e.type==="swap")r-=(e.buy?e.xlm:-e.xlm); if(r<0)r=0; pts.push({t:e.time,r:r}); });
    pts.sort(function(a,b){return a.t-b.t;});
    var vol=evs.filter(function(e){return e.type==="swap";}).map(function(e){return {t:e.time,v:e.xlm};}).sort(function(a,b){return a.t-b.t;});
    return {pts:pts, vol:vol, t0:pts.length?pts[0].t:Date.now(), t1:Date.now()};
  }
  // Real historical series from Horizon trade_aggregations over the SELECTED range (the tx-reconstruction only
  // spans the last ~100 trades ≈ minutes for busy pools, so the range buttons did nothing and TVL looked flat).
  // Price + volume are REAL; TVL(t)=TVL_now·sqrt(price(t)/price_now) from the constant-product invariant, anchored to the live reserve.
  var CH_RES={"1D":900000,"1W":3600000,"1M":86400000,"3M":86400000,"1Y":604800000,"ALL":604800000};
  var CH_DAYS={"1D":1,"1W":7,"1M":30,"3M":90,"1Y":365,"ALL":730};
  function chAgg(range,cb){
    var d=DET; if(!d||!d.issuer||!(d.priceXlm>0)){ cb(null); return; }
    d.__agg=d.__agg||{}; if(d.__agg[range]){ cb(d.__agg[range].__empty?null:d.__agg[range]); return; }
    d.__aggP=d.__aggP||{}; if(d.__aggP[range])return; d.__aggP[range]=1;
    var res=CH_RES[range]||86400000, end=Math.ceil(Date.now()/res)*res, start=Math.floor((end-(CH_DAYS[range]||365)*86400000)/res)*res;
    var url=H+"/trade_aggregations?base_asset_type=credit_alphanum"+(d.code.length>4?"12":"4")+"&base_asset_code="+encodeURIComponent(d.code)+"&base_asset_issuer="+d.issuer+"&counter_asset_type=native&resolution="+res+"&start_time="+start+"&end_time="+end+"&order=asc&limit=200";
    getJSON(url).then(function(r){ d.__aggP[range]=0; var recs=(r&&r._embedded&&r._embedded.records)||[]; var pts=[],vol=[];
      recs.forEach(function(x){ var t=+x.timestamp; var price=+x.avg||+x.close||0; if(price>0)pts.push({t:t,r:d.xlm*Math.sqrt(price/d.priceXlm)}); vol.push({t:t,v:+x.counter_volume||0}); });
      if(pts.length<2){ d.__agg[range]={__empty:1}; cb(null); return; }
      pts.push({t:Date.now(),r:d.xlm});   // pin the newest point to the live reserve
      d.__agg[range]={pts:pts,vol:vol,t0:pts[0].t,t1:Date.now()}; cb(d.__agg[range]);
    }).catch(function(){ d.__aggP[range]=0; d.__agg[range]={__empty:1}; cb(null); });
  }
  // clear the plot + show a subtle centered loader while the selected range's real series is fetched (no wrong flash)
  function chLoading(svg){
    document.documentElement.classList.add("lx-chartready");
    [].slice.call(svg.querySelectorAll(".lx-ch")).forEach(function(e){ if(e.parentNode)e.parentNode.removeChild(e); });
    [].slice.call(svg.querySelectorAll("path")).forEach(function(p){ if((p.getAttribute("class")||"").indexOf("lx-ch")<0)p.setAttribute("d",""); });
    [].slice.call(svg.querySelectorAll("rect,line")).forEach(function(x){ if((x.getAttribute("class")||"").indexOf("lx-ch")>=0&&x.parentNode)x.parentNode.removeChild(x); });
    // AUDIT (user-reported "Pools-Pool takes ages to load"): this label had NO class, and every cleanup pass
    // only removes .lx-ch nodes — so once painted it stayed forever. The page finished loading in ~4s and
    // then sat there saying "Loading pool history…" on top of a fully drawn chart. Tag it so it can be cleared.
    var t=chS("text",{"class":"lx-chload",x:"500",y:"140","text-anchor":"middle","dominant-baseline":"middle",fill:"var(--text-muted,#8b90a0)","font-size":"13"}); t.textContent="Loading pool history\\u2026";
    var o=chS("animate",{attributeName:"opacity",values:"0.35;0.8;0.35",dur:"1.1s",repeatCount:"indefinite"}); t.appendChild(o); svg.appendChild(t);
  }
  function chPairEmpty(){ var svg=q("#tvlChart svg"); document.documentElement.classList.add("lx-chartready"); if(!svg)return;
    [].slice.call(svg.querySelectorAll(".lx-chload")).forEach(function(e){ if(e.parentNode)e.parentNode.removeChild(e); });
    [].slice.call(svg.querySelectorAll("path")).forEach(function(pp){ if((pp.getAttribute("class")||"").indexOf("lx-ch")<0)pp.setAttribute("d",""); });
    if(!svg.querySelector(".lx-chpair")){ var t=chS("text",{"class":"lx-chpair",x:"500",y:"140","text-anchor":"middle","dominant-baseline":"middle",fill:"var(--text-muted,#8b90a0)","font-size":"13"}); t.textContent="No chart for this pair yet"; svg.appendChild(t); } }
  function chDraw(){
    var svg=q("#tvlChart svg"); if(!svg)return; document.documentElement.classList.add("lx-chartready"); if(!DET)return;
    if(DET.nonXlm){ chPairEmpty(); return; }   // TVL/volume series are XLM-denominated; honest empty beats garbage
    var s=(window.__tvlChartState&&window.__tvlChartState())||{type:"line",metric:"tvl",range:"1Y"};
    var agg=DET.__agg&&DET.__agg[s.range], ser;
    if(agg&&!agg.__empty){ ser=agg; }
    else if(agg&&agg.__empty){ if(!DET.__chSer)DET.__chSer=chBuild(); ser=DET.__chSer; }   // no trade_aggregations for this range -> tx-reconstruction fallback
    else { chAgg(s.range,function(){ chDraw(); }); chLoading(svg); return; }   // range not fetched yet: show a loader, DON'T flash the wrong (minutes-long) reconstruction while ALL/1Y loads
    var W=1000,H=280,DW=936,padT=12,padB=24;
    var RD={"1D":1,"1W":7,"1M":30,"3M":90,"1Y":365,"ALL":null}, days=RD[s.range];
    var t1=Date.now(), t0=(days==null)?ser.t0:Math.max(ser.t0,t1-days*86400000); if(!(t0<t1))t0=t1-86400000;
    var isVol=(s.metric==="volume"||s.metric==="vol"), isBar=isVol||(s.type!=="line"&&s.type!=="area");   // volume always draws as bars (matches the design)
    [].slice.call(svg.querySelectorAll(".lx-chload")).forEach(function(e){ if(e.parentNode)e.parentNode.removeChild(e); });   // we are about to draw -> drop the loader
    [].slice.call(svg.querySelectorAll(".lx-ch")).forEach(function(e){ if(e.parentNode)e.parentNode.removeChild(e); });
    [].slice.call(svg.querySelectorAll("path")).forEach(function(p){ if((p.getAttribute("class")||"").indexOf("lx-ch")<0)p.setAttribute("d",""); });
    [].slice.call(svg.querySelectorAll("rect")).forEach(function(r){ if((r.getAttribute("class")||"").indexOf("lx-ch")<0&&r.parentNode)r.parentNode.removeChild(r); });
    [].slice.call(svg.querySelectorAll("line")).forEach(function(l){ if((l.getAttribute("class")||"").indexOf("lx-ch")>=0)return; if(l.getAttribute("x1")===l.getAttribute("x2")&&l.parentNode)l.parentNode.removeChild(l); });
    function rezAt(t){ var v=ser.pts.length?ser.pts[0].r:0; for(var i=0;i<ser.pts.length;i++){ if(ser.pts[i].t<=t)v=ser.pts[i].r; else break; } return v; }
    function X(t){ return (t1>t0?(t-t0)/(t1-t0):0.5)*DW; }
    var mn,mx,vals=[];
    if(isVol){
      var NB=isBar?46:60, bw=(t1-t0)/NB, buck=[]; for(var i=0;i<NB;i++)buck.push(0);
      ser.vol.forEach(function(e){ if(e.t<t0||e.t>t1)return; var bi=Math.min(NB-1,Math.max(0,Math.floor((e.t-t0)/bw))); buck[bi]+=e.v; });
      vals=buck.map(function(v,i){return {t:t0+(i+0.5)*bw,v:v};}); mn=0; mx=Math.max.apply(null,buck.concat([1]));
    } else {
      var ts=[t0]; ser.pts.forEach(function(p){ if(p.t>t0&&p.t<t1)ts.push(p.t); }); ts.push(t1);
      vals=ts.map(function(t){return {t:t,v:rezAt(t)*2};}); var vv=vals.map(function(p){return p.v;});
      mn=Math.min.apply(null,vv); mx=Math.max.apply(null,vv);
      if(mx===mn){ mx=mn*1.04+1; mn=Math.max(0,mn*0.96-1); } else { var pd=(mx-mn)*0.12; mn=Math.max(0,mn-pd); mx=mx+pd; }
    }
    function Y(v){ return padT+(H-padT-padB)*(1-(mx>mn?(v-mn)/(mx-mn):0.5)); }
    var accent=isVol?"#8b7bf0":"#16a34a";
    if(isVol&&isBar){
      var bpx=Math.max(2,DW/vals.length*0.6);
      vals.forEach(function(p){ var x=X(p.t), h=(H-padT-padB)*(mx>0?p.v/mx:0); svg.appendChild(chS("rect",{x:(x-bpx/2).toFixed(1),y:(H-padB-h).toFixed(1),width:bpx.toFixed(1),height:Math.max(0,h).toFixed(1),rx:"1",fill:accent,"fill-opacity":"0.85"})); });
    } else if(isBar){
      var NB2=46, bw2=(t1-t0)/NB2, cpx=Math.max(2,DW/NB2*0.6);
      for(var j=0;j<NB2;j++){ var bs=t0+j*bw2, be=bs+bw2, o=rezAt(bs)*2, c=rezAt(be)*2, hi=Math.max(o,c), lo=Math.min(o,c);
        ser.pts.forEach(function(p){ if(p.t>=bs&&p.t<=be){ var q2=p.r*2; if(q2>hi)hi=q2; if(q2<lo)lo=q2; } });
        var xc=X(bs+bw2/2), col=(c>=o)?"#16a34a":"#ff5b5b";
        svg.appendChild(chS("line",{x1:xc.toFixed(1),y1:Y(hi).toFixed(1),x2:xc.toFixed(1),y2:Y(lo).toFixed(1),stroke:col,"stroke-width":"1.2"}));
        var yo=Y(o),yc=Y(c); svg.appendChild(chS("rect",{x:(xc-cpx/2).toFixed(1),y:Math.min(yo,yc).toFixed(1),width:cpx.toFixed(1),height:Math.max(1,Math.abs(yc-yo)).toFixed(1),rx:"1",fill:col}));
      }
    } else {
      var dd=""; vals.forEach(function(p,i){ dd+=(i?"L":"M")+X(p.t).toFixed(1)+" "+Y(p.v).toFixed(1)+" "; });
      var lastX=X(vals[vals.length-1].t).toFixed(1), firstX=X(vals[0].t).toFixed(1);
      svg.appendChild(chS("path",{d:dd+"L"+lastX+" "+(H-padB)+" L"+firstX+" "+(H-padB)+" Z",fill:accent,"fill-opacity":"0.10",stroke:"none"}));
      svg.appendChild(chS("path",{d:dd,fill:"none",stroke:accent,"stroke-width":"2","stroke-linejoin":"round","stroke-linecap":"round"}));
    }
    var yt=[].slice.call(svg.querySelectorAll("text")).filter(function(t){return t.getAttribute("x")==="996";});
    // AUDIT FIX: fixed 2-dp labels collapse on near-flat data (all 5 gridlines read "1.09M XLM") — pick the
    // decimals from the per-gridline STEP so adjacent labels always differ (capped at 5 dp).
    var _step=(mx-mn)/Math.max(1,yt.length-1);
    function yfmt(x){ x=+x||0; var a=Math.abs(x), sc=a>=1e6?1e6:(a>=1e3?1e3:1), sfx=sc===1e6?"M XLM":(sc===1e3?"K XLM":" XLM");
      var d=2; if(_step>0){ d=Math.max(2,Math.min(5,Math.ceil(-Math.log10(_step/sc))+1)); if(!isFinite(d))d=2; }
      return sc===1?((a>=1?num(x):x.toFixed(Math.max(2,d)))+" XLM"):((x/sc).toFixed(d)+sfx); }
    yt.forEach(function(t,i){ var frac=yt.length<=1?1:(1-i/(yt.length-1)); setText(t,yfmt(mn+(mx-mn)*frac)); });
    var xt=[].slice.call(svg.querySelectorAll("text")).filter(function(t){return t.getAttribute("y")==="278";}).sort(function(a,b){return (+a.getAttribute("x"))-(+b.getAttribute("x"));});
    var span=t1-t0, MO=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    function fmt(t){ var dt=new Date(t); if(span<2*86400000){ var hh=dt.getHours(),mm=dt.getMinutes(); return (hh<10?"0":"")+hh+":"+(mm<10?"0":"")+mm; } if(span<120*86400000)return MO[dt.getMonth()]+" "+dt.getDate(); return MO[dt.getMonth()]; }
    xt.forEach(function(t,i){ var frac=xt.length<=1?1:i/(xt.length-1); setText(t,fmt(t0+span*frac)); });
    DET.__chSig=s.type+"|"+s.metric+"|"+s.range;
  }
  // Re-assert real data only when needed: the active view changed, OR the design re-rendered its own mock
  // (its candle <rect>s reappear / its <path> d gets re-set — e.g. during the design's ~1-2s enter animation).
  function chSync(){ var g=q("#tvlChart svg"); if(!g||!DET)return; var s=(window.__tvlChartState&&window.__tvlChartState())||{type:"line",metric:"tvl",range:"1Y"}; var sig=s.type+"|"+s.metric+"|"+s.range; var dirty=!!g.querySelector("rect:not(.lx-ch)"); if(!dirty){ var dp=g.querySelector("path:not(.lx-ch)"); dirty=!!(dp&&dp.getAttribute("d")); } if(sig!==DET.__chSig||dirty)chDraw(); }
  function pdChart(){
    var svg=q("#tvlChart svg"); if(!svg)return; chDraw();
    if(!window.__lxChHook){ window.__lxChHook=1;
      document.addEventListener("click",function(e){ var t=e.target; if(t&&t.closest&&t.closest(".chart-type,.tf-mini,.chart-mode-select,.chart-menu,.menu")){ [40,160,400,800].forEach(function(ms){ setTimeout(chSync,ms); }); } },true);
      setInterval(chSync,500);   // catch the design's late/animated re-renders without flicker (guarded)
    }
  }
  function txRow(t){
    var pill=t.type==="deposit"?'<span class="type-pill deposit">Deposit</span>':(t.type==="withdraw"?'<span class="type-pill withdraw">Withdraw</span>':'<span class="type-pill swap">Swap</span>');
    var when=t.time?new Date(t.time).toLocaleString():"\\u2014";
    var ex="https://stellar.expert/explorer/public/account/"+encodeURIComponent(t.who||"");
    return '<tr class="lx-txrow" data-txtype="'+t.type+'">'+
      '<td>'+pill+'</td>'+
      '<td><span class="num">'+famt(t.xlm)+' XLM</span></td>'+
      '<td><span class="num">'+famt(t.tok)+' '+esc(DET.code)+'</span></td>'+
      '<td><a class="wallet-cell" href="'+ex+'" target="_blank" rel="noopener" style="color:inherit;text-decoration:none"><div class="wallet-avatar">'+ident(t.who,22)+'</div><span class="lx-waddr">'+ashort(t.who)+'</span></a></td>'+
      '<td>'+when+'</td>'+
      '<td><a class="ext-link" href="'+ex+'" target="_blank" rel="noopener"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M17 7H8M17 7v9"></path></svg></a></td></tr>';
  }
  function pdTx(){
    var d=DET; var tb=q("table.tx tbody"); if(!tb)return;
    tb.__lxPP=1;
    var wantTx=d.txs.length||1;
    if(tb.querySelectorAll(".lx-txrow").length!==wantTx){
      tb.innerHTML=d.txs.length?d.txs.map(txRow).join(""):'<tr class="lx-txrow"><td colspan="6" style="text-align:center;color:var(--text-muted);padding:22px">No transactions yet</td></tr>';
    }
    var pg=q("#lx-txpage"); if(pg)pg.style.display="none";
    var bar=q(".tx-filter");
    if(bar&&!bar.__lxf){ bar.__lxf=1;
      qa(".tx-filter button").forEach(function(b){ b.parentNode.replaceChild(b.cloneNode(true),b); });  // strip the design's own filter listeners
      var fb=qa(".tx-filter button");
      fb.forEach(function(b){ b.addEventListener("click",function(e){ e.stopPropagation(); fb.forEach(function(x){x.classList.remove("active");}); b.classList.add("active"); var f=b.textContent.trim().toLowerCase(); qa("table.tx tbody .lx-txrow").forEach(function(rw){ var ty=rw.getAttribute("data-txtype")||""; var show=(f.indexOf("all")===0)||(f.indexOf("swap")===0&&ty==="swap")||(f.indexOf("deposit")===0&&ty==="deposit")||(f.indexOf("withdraw")===0&&ty==="withdraw"); rw.style.display=show?"":"none"; }); }); });
    }
  }
  function pdAssetRow(a,name,ico,amt){ if(!a)return; var icoEl=a.querySelector(".mp-asset-ico"); if(icoEl){ icoEl.setAttribute("data-lxfixed","1"); icoEl.style.overflow="hidden"; if(icoEl.getAttribute("data-lxd")!=="1"){icoEl.setAttribute("data-lxd","1");icoEl.innerHTML=ico;} } var nm=a.querySelector(".mp-asset-name"); if(nm)setText(nm,name); var am=a.querySelector(".mp-asset-amt"); if(am)setText(am,amt); }
  function pdPosition(){
    var d=DET; var mp=q(".my-position"); if(!mp)return;
    // Header: rename "My Position" -> "Position Value" and drop the irrelevant top "100%" pill (per user);
    // the position value moves up (the redundant inner "Position Value" label is hidden).
    var head=mp.previousElementSibling; if(head&&/side-head/.test(String(head.className||""))){
      [].slice.call(head.childNodes).forEach(function(nd){ if(nd.nodeType===3&&/my position/i.test(nd.textContent))nd.textContent="Position Value"; });
      [].slice.call(head.querySelectorAll("*")).forEach(function(el){ if(el.children.length===0&&/^\\s*my position\\s*$/i.test(el.textContent||""))el.textContent="Position Value"; });
    }
    var sp=q(".position-share-pill"); if(sp)sp.style.display="none";
    var lbl0=mp.querySelector(".mp-label"); if(lbl0)lbl0.style.display="none";
    var assets=qa(".mp-asset");
    if(d.myFrac>0){
      mp.classList.add("active");
      var myUsd=d.tvlUsd*d.myFrac;
      var amt=q(".mp-amount .lc-money")||q(".mp-amount"); setMoneyEl(amt,myUsd,d.tvlUsd>0?usd(myUsd):"\\u2014");
      var pill=q(".position-share-pill"); if(pill)setText(pill,(d.myFrac*100>=0.01?(d.myFrac*100).toFixed(2):"<0.01")+"%");
      var pnl=q(".mp-pnl"); if(pnl)pnl.innerHTML='<span style="color:var(--text-muted)">'+(d.myFrac*100>=0.01?(d.myFrac*100).toFixed(2):"<0.01")+'% of pool \\u00b7 current value</span>';
      if(d.nonXlm){ pdAssetRow(assets[0],d.a0.code,genLogo(d.a0),famt(d.a0.amt*d.myFrac)); pdAssetRow(assets[1],d.a1.code,genLogo(d.a1),famt(d.a1.amt*d.myFrac)); }
      else { pdAssetRow(assets[0],d.code,tokLogo(),famt(d.tok*d.myFrac)); pdAssetRow(assets[1],"XLM",xlmLogo(),famt(d.xlm*d.myFrac)); }
    } else {
      mp.classList.remove("active");
      var val=q(".mp-value"); if(val)val.innerHTML='<div class="mp-label">Your Position</div><div class="mp-amount">\\u2014</div><div class="mp-pnl" style="color:var(--text-muted)">'+(myAddr()?"You have no liquidity in this pool":"Connect your wallet to see your position")+'</div>';
      if(d.nonXlm){ pdAssetRow(assets[0],d.a0.code,genLogo(d.a0),"0"); pdAssetRow(assets[1],d.a1.code,genLogo(d.a1),"0"); }
      else { pdAssetRow(assets[0],d.code,tokLogo(),"0"); pdAssetRow(assets[1],"XLM",xlmLogo(),"0"); }
    }
    // The "Earned fees" ($8.92) + "LP tokens" (23,415.82) rows are baked mock. LP tokens = the real LP-share
    // balance; earned fees can't be derived without a deposit cost-basis, so show "—" instead of a fake number.
    qa(".my-position .mp-fee-row").forEach(function(rw){ var lab=(rw.querySelector(".mp-fee-label")||{}).textContent||""; var val=rw.querySelector(".mp-fee-val"); if(!val)return;
      if(/lp tokens/i.test(lab)){ setText(val,d.myFrac>0?famt(d.myShares):"0"); }
      else if(/earned fees/i.test(lab)){ val.innerHTML='<span style="color:var(--text-muted)">\\u2014</span>'; } });
  }
  function pdDW(){
    var d=DET;
    function setField(f,name,ico,bal){ if(!f)return; var a=f.querySelector(".asset"); if(a){ var icoEl=a.querySelector(".ico"); if(icoEl){ icoEl.setAttribute("data-lxfixed","1"); icoEl.style.overflow="hidden"; if(icoEl.getAttribute("data-lxd")!=="1"){icoEl.setAttribute("data-lxd","1");icoEl.innerHTML=ico;} } [].slice.call(a.childNodes).forEach(function(nd){ if(nd.nodeType===3&&nd.textContent.trim())nd.textContent=" "+name+" "; }); a.setAttribute("data-lxpair","1"); } var b=f.querySelector(".balance"); if(b)setText(b,"Balance: "+famt(bal));
      // name the reserve, exactly as Send/Swap/Trade do — "Balance: 1.73" on a 9.73 XLM wallet reads as a bug otherwise
      try{ var _bl=f.querySelector(".balance")||f.querySelector("[class*=bal]");
        if(_bl){ if(name==="XLM"&&d&&d.balXlmRaw!=null){ _bl.title=famt(bal)+" XLM spendable \u2014 "+famt(d.balXlmRaw)+" total, "+famt(Math.max(0,d.balXlmRaw-bal))+" locked as the Stellar account reserve"; }
                 else if(_bl.title){ _bl.removeAttribute("title"); } } }catch(_){}; }
    var fields=qa("#dwDeposit .dw-field");
    if(d.nonXlm){ setField(fields[0],d.a0.code,genLogo(d.a0),d.balA0); setField(fields[1],d.a1.code,genLogo(d.a1),d.balTok); }
    else { setField(fields[0],d.code,tokLogo(),d.balTok); setField(fields[1],"XLM",xlmLogo(),d.balXlm); }
    var lp=q("#dwWithdraw .balance"); if(lp)setText(lp,"Your LP: "+famt(d.myShares));
    qa(".dw-summary .r").forEach(function(rw){ var lab=(rw.querySelector("span")||{}).textContent||""; var st=rw.querySelector("strong"); if(!st)return; if(/fee tier/i.test(lab))setText(st,d.fee+"%"); else if(/network fee/i.test(lab))setText(st,"\\u2248 0.00001 XLM"); });
  }
  function partRow(p){
    var ex="https://stellar.expert/explorer/public/account/"+encodeURIComponent(p.addr);
    return '<div class="part-row lx-partrow"><div class="part-avatar">'+ident(p.addr,26)+'</div>'+
      '<a class="part-addr" href="'+ex+'" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">'+ashort(p.addr)+'</a>'+
      '<span class="part-share">'+(p.frac*100>=0.01?(p.frac*100).toFixed(2):"<0.01")+'%</span></div>';
  }
  function pdParts(){
    var d=DET; var list=q("#partList"); if(!list)return;
    list.__lxPP=1;  // block the design's participant paginator/cloner
    var wantP=d.parts.length||1;
    if(list.querySelectorAll(".lx-partrow").length!==wantP){
      list.innerHTML=d.parts.length?d.parts.map(partRow).join(""):'<div class="part-row lx-partrow" style="justify-content:center;color:var(--text-muted)">No liquidity providers yet</div>';
    }
    var pg=q("#lx-partpage"); if(pg)pg.style.display="none";
    qa(".part-count, .participants-count, [data-partcount]").forEach(function(e){ setText(e,String(d.parts.length)); });
    // the design mocks the participant count ("847") in the "Participants" side-head pill — set the real count.
    qa(".count-pill").forEach(function(e){ var sh=e.closest&&e.closest(".side-head"); if(sh&&/participant/i.test(sh.textContent||""))setText(e,String(d.parts.length)); });
    // "Viewing 1 - N of N" + hide the mock participant pager (single page for the real, small count)
    qa("*").forEach(function(e){ if(e.children.length===0&&/Viewing .* of \\d/.test(e.textContent||"")){ setText(e,"Viewing 1 \\u2013 "+d.parts.length+" of "+d.parts.length); var pcard=(e.closest&&e.closest(".pools-card, .side-card"))||e.parentElement; if(pcard){ [].slice.call(pcard.querySelectorAll(".controls")).forEach(function(c){ if(/Page \\d+ of|Prev|Next/.test(c.textContent||""))c.style.display="none"; }); } } });
  }
  function pdCopy(){
    var d=DET;
    try{ document.title=(d.pairName||(d.code+" / XLM"))+" liquidity pool on Stellar | LumosCore"; }catch(e){}
    var cr=q(".crumb"); if(cr){ [].slice.call(cr.querySelectorAll("*")).forEach(function(e){ var t=e.textContent||""; if(e.children.length===0&&t.indexOf("LUMOS")>=0&&(t.indexOf("XLM")>=0||t.indexOf("APT")>=0))setText(e,d.pairName||(d.code+" / XLM")); }); }
  }
  // AUDIT (user-reported, pool 344e66\\u2026): one painter throwing killed every LATER painter, so the whole
  // right rail (position, deposit/withdraw) stayed on the design mock — a fake $1,247.50 position on a real
  // pool. Isolate each painter: one failure can no longer take the rest of the page down with it.
  function paintDetail(){ if(!DET)return;
    [pdHeader,pdStats,pdChart,pdTx,pdPosition,pdDW,pdParts,pdCopy,wireDW,healLogos].forEach(function(fn){ try{ fn(); }catch(_){} }); }
  var schedD=false;
  function scheduleDetail(){ if(schedD)return; schedD=true; (window.requestAnimationFrame||function(f){setTimeout(f,16);})(function(){ schedD=false; if(DET)paintDetail(); }); }

  // ==================== PHASE 2: WRITE OPS (sign + submit via connected wallet) ====================
  // Ported from the Launchpad's proven signing stack: @stellar/stellar-sdk via jsdelivr, multi-wallet
  // signer (Freighter/Albedo/Rabet/xBull/LOBSTR), Horizon via XHR (bypasses wallet fetch-wrappers).
  var WPASS="Public Global Stellar Network ; September 2015";
  var _wsdk=null, _wmods={};
  function wMod(u){ return _wmods[u]||(_wmods[u]=import(u)); }
  function wLoadSdk(){ if(window.StellarSdk)return Promise.resolve(window.StellarSdk); if(_wsdk)return _wsdk; _wsdk=new Promise(function(res,rej){ var s=document.createElement("script"); s.src="https://cdn.jsdelivr.net/npm/@stellar/stellar-sdk@13.3.0/dist/stellar-sdk.min.js"; s.onload=function(){res(window.StellarSdk);}; s.onerror=function(){rej(new Error("Failed to load Stellar SDK"));}; document.head.appendChild(s); }); return _wsdk; }
  function wWallet(){ try{ return (localStorage.getItem("lumos.wallet")||"").toLowerCase().replace(/[^a-z]/g,""); }catch(e){ return ""; } }
  function wXhr(method,url,body){ return new Promise(function(resolve,reject){ var r=new XMLHttpRequest(); r.open(method,url,true); if(body!=null)r.setRequestHeader("Content-Type","application/x-www-form-urlencoded"); r.onload=function(){ var j=null; try{j=JSON.parse(r.responseText);}catch(e){} resolve({status:r.status,ok:r.status>=200&&r.status<300,json:j}); }; r.onerror=function(){reject(new Error("Network error contacting Horizon"));}; r.timeout=45000; r.ontimeout=function(){reject(new Error("Horizon request timed out"));}; r.send(body==null?null:body); }); }
  function wAcct(pk){ return wXhr("GET",H+"/accounts/"+pk).then(function(r){ if(!r.ok||!r.json)throw new Error("Your account isn't activated on mainnet yet."); return r.json; }); }
  function wSubmit(xdr){ return wXhr("POST",H+"/transactions","tx="+encodeURIComponent(xdr)).then(function(r){ var res=r.json||{}; if(res.successful)return res; var rc=res.extras&&res.extras.result_codes; throw new Error(rc?("Rejected \\u00b7 "+JSON.stringify(rc)):(res.detail||("HTTP "+r.status))); }); }
  function wSign(xdr,addr){ var w=wWallet();
    if(w==="albedo")return wMod("https://esm.sh/@albedo-link/intent@0.12.0").then(function(m){var al=m.default||m.albedo||m; if(!al||!al.tx)throw new Error("Albedo SDK failed to load"); return al.tx({xdr:xdr,network:"public",pubkey:addr,submit:false});}).then(function(r){var s=r&&(r.signed_envelope_xdr||r.xdr); if(!s)throw new Error("Albedo did not return a signed transaction"); return s;});
    if(w==="rabet"){ if(!window.rabet||!window.rabet.sign)return Promise.reject(new Error("Rabet not found. Unlock the extension and retry.")); return Promise.resolve(window.rabet.sign(xdr,"mainnet")).then(function(r){ if(r&&r.error)throw new Error((r.error&&r.error.message)||r.error); var s=r&&(r.xdr||r.signedXDR); if(!s)throw new Error("Rabet did not return a signed transaction"); return s;}); }
    if(w==="xbull"){ var x=window.xBullSDK; if(!x||!x.signXDR)return Promise.reject(new Error("xBull not found. Unlock the extension and retry.")); return Promise.resolve(x.signXDR(xdr,{network:"PUBLIC",networkPassphrase:WPASS,publicKey:addr})).then(function(r){var s=r&&(r.signedXDR||r.xdr||r); if(!s||typeof s!=="string")throw new Error("xBull did not return a signed transaction"); return s;}); }
    if(w==="lobstr")return wMod("https://esm.sh/@lobstrco/signer-extension-api").then(function(m){var sign=m.signTransaction||(m.default&&m.default.signTransaction); if(!sign)throw new Error("LOBSTR API unavailable"); return sign(xdr);}).then(function(s){ if(!s||typeof s!=="string")throw new Error("LOBSTR couldn't sign \\u2014 unlock it, set to Mainnet, then retry."); return s;});
    if(w==="walletconnect")return Promise.reject(new Error("WalletConnect signing isn't enabled yet. Reconnect with Freighter, Albedo, Rabet or LOBSTR."));
    return (window.freighterApi&&window.freighterApi.getAddress?Promise.resolve(window.freighterApi):wMod("https://esm.sh/@stellar/freighter-api@6").then(function(m){return m.default||m;})).then(function(f){ return Promise.resolve(f.signTransaction(xdr,{networkPassphrase:WPASS,network:"PUBLIC",address:addr})); }).then(function(sig){ var s=(sig&&(sig.signedTxXdr||sig.signedXDR))||sig; if((sig&&sig.error)||typeof s!=="string")throw new Error("Signing cancelled."); return s; });
  }
  function wAmt(n){ var x=Number(n); if(!isFinite(x)||x<0)x=0; return x.toFixed(7); }
  // FLOOR (not round) to the display precision: rounding 80.059072 -> "80.0591" exceeds the real balance and
  // trips the "Not enough" guard when MAX fills the field. Truncating guarantees the shown amount <= actual.
  // AUDIT: String(1e-7) is "1e-7" — Stellar rejects exponent-form amounts, so MAX on a tiny balance wrote an
  // unsubmittable value into the input. Always emit a plain 7dp decimal (floored, never rounded up past the
  // real balance), with trailing zeros trimmed.
  function fmtIn(v){ v=+v; if(!(v>0))return ""; var dp=v>=1?4:7,f=Math.pow(10,dp); var n=Math.floor(v*f)/f; if(!(n>0))return ""; return trimZ(n.toFixed(dp)); }
  // build → sign → submit; buildOps(S, acctJson) -> [operations]
  function wSend(addr, buildOps){ var S; return wLoadSdk().then(function(sdk){S=sdk; return wAcct(addr);}).then(function(a){ var tb=new S.TransactionBuilder(new S.Account(addr,a.sequence),{fee:"2000",networkPassphrase:WPASS}); buildOps(S,a).forEach(function(op){tb.addOperation(op);}); var tx=tb.setTimeout(180).build(); return wSign(tx.toXDR(),addr); }).then(function(signed){ return wSubmit(signed); }); }
  // inline status message under a CTA (no new modals — a small line the existing card already has room for)
  // bottom-center toast, identical to the site's "Copied to clipboard" toast (self-contained CSS above)
  function ammToast(msg,isErr,hash){ var CK='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    var view=hash?(' \\u00b7 <a href="https://stellar.expert/explorer/public/tx/'+hash+'" target="_blank" rel="noopener">view</a>'):'';
    var stack=document.querySelector(".lx-ctoast-stack"); if(!stack){ stack=document.createElement("div"); stack.className="lx-ctoast-stack"; document.body.appendChild(stack); }
    var t=document.createElement("div"); t.className="lx-ctoast"+(isErr?" lxa-terr":""); t.innerHTML='<span class="ci">'+CK+'</span><span>'+esc(msg||"")+view+'</span>'; stack.appendChild(t);
    setTimeout(function(){ t.style.transition="opacity .22s,transform .22s"; t.style.opacity="0"; t.style.transform="translateY(8px)"; setTimeout(function(){ if(t.parentNode)t.parentNode.removeChild(t); },240); }, isErr?4000:3200); }
  function wMsg(btn, text, isErr, hash){ var el=btn.parentNode.querySelector(":scope > .lx-dwmsg"); if(!text){ if(el)el.style.display="none"; return; }
    var view=(hash?' \\u00b7 <a href="https://stellar.expert/explorer/public/tx/'+hash+'" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">view</a>':'');
    // SUCCESS -> bottom-center toast (same as the site's copy-address toast), not an inline line under the button
    if(!isErr){ if(el)el.style.display="none"; try{ ammToast(text,false,hash); return; }catch(_){} }
    if(!el){ el=document.createElement("div"); el.className="lx-dwmsg"; el.style.cssText="margin-top:10px;font-size:12.5px;line-height:1.45;text-align:center;font-weight:600"; btn.parentNode.insertBefore(el,btn.nextSibling); } el.style.display="block"; el.style.color=isErr?"#ef4444":"#16a34a"; el.innerHTML=esc(text)+view; }
  function wRun(btn, addr, buildOps, labels, onDone){
    // AUDIT #8/#10 (funds): __lxBusy is an in-flight guard — it blocks a second submit while the wallet prompt
    // is open (the create-pool observer honours it) AND it is what re-enables the button afterwards. Previously
    // the success path never restored the disabled flag, so the CTA was dead for the rest of the session.
    if(btn.__lxBusy)return;
    btn.__lxBusy=true;
    var orig=btn.innerHTML; btn.disabled=true; btn.style.opacity="0.7"; btn.style.cursor="wait"; btn.classList.add("lx-btnload"); btn.textContent=labels.wait||"Confirm in wallet\\u2026"; wMsg(btn,"",false);
    function restore(){ btn.__lxBusy=false; btn.classList.remove("lx-btnload"); btn.disabled=false; btn.style.opacity="1"; btn.style.cursor=""; btn.innerHTML=orig; }
    wSend(addr,buildOps).then(function(res){ btn.classList.remove("lx-btnload"); btn.textContent=labels.ok||"\\u2713 Done"; btn.style.opacity="1"; wMsg(btn,labels.okMsg||"Success.",false,res&&res.hash); if(onDone)onDone(res);
        setTimeout(restore,2500); })                              // brief "\\u2713 Done", then usable again
      .catch(function(e){ restore(); wMsg(btn,(e&&e.message)||"Transaction failed.",true); });
  }
  function wCtaText(btn,txt){ var tn=null; [].slice.call(btn.childNodes).forEach(function(n){ if(n.nodeType===3&&n.textContent.trim())tn=n; }); if(tn)tn.textContent=" "+txt; else btn.appendChild(document.createTextNode(" "+txt)); }

  // ---- DETAIL: Add Liquidity + Withdraw (shares the one .dw-cta; action = active tab) ----
  function wireDW(){
    if(window.__lxDWwired||!DET)return; var card=q(".dw-card"); if(!card)return; window.__lxDWwired=1;
    var d=DET, r=d.tok>0?d.xlm/d.tok:0;               // XLM per 1 token
    var depIn=qa("#dwDeposit .dw-field input");        // [0]=token, [1]=XLM
    function wInEl(){ return q("#dwWithdraw .dw-field input")||q("#dwWithdraw .row input")||q("#dwWithdraw input"); }   // re-query (design re-creates withdraw inputs on tab switch)
    // XLM the account must keep back: (2+subentries)*0.5 base reserve + 0.5 for the new pool trustline (if not
    // yet trusted) + fee margin. Depositing below this avoids the mid-tx op_underfunded the user hit.
    function xlmKeep(){ return (2+(d.subs||0))*0.5 + (d.myShares>0?0:0.5) + 0.6; }
    // d.balXlm is ALREADY the spendable figure (line ~676 subtracts the account reserve + selling liabilities),
    // so subtracting xlmKeep() from it double-counted the reserve — on a 9.73 XLM wallet that reported 0 usable
    // and rejected deposits it could actually afford. Take the headroom off the RAW balance, then clamp to the
    // spendable figure so this can only ever be more conservative, never more permissive.
    function usableXlm(){ var raw=(d.balXlmRaw!=null?d.balXlmRaw:d.balXlm); return Math.max(0, Math.min(d.balXlm, raw - xlmKeep())); }
    // "You receive" = (shares / totalShares) x each reserve. Recompute live as the LP amount changes.
    // AUDIT (user-reported): the You-Receive rows showed bare numbers with no logo/code — the design data-logo
    // painter empties the icons, and the old writer only re-labeled the token row (and classified rows by
    // their CURRENT label, which breaks the moment we relabel one). Tag each row side ONCE on first sight,
    // then always rewrite BOTH labels + icons + amounts from the pair model.
    function withRecvEls(){ var rows=[]; qa("#dwWithdraw .row").forEach(function(rw){ if(rw.querySelector("input"))return;
        var a=rw.querySelector(".asset"); var sp=rw.querySelector(":scope > span");
        if(!sp)return;                                    // no amount holder -> not a You-Receive row
        if(!a){ a=document.createElement("div"); a.className="asset";
          var _ic=document.createElement("div"); _ic.className="ico"; a.appendChild(_ic);
          a.appendChild(document.createTextNode(" ")); rw.insertBefore(a,rw.firstChild); }
        rows.push({a:a,sp:sp}); });
      var e={A:null,B:null};
      rows.forEach(function(r){ var side=r.a.getAttribute("data-lxside");
        if(!side){ var t=(r.a.textContent||"").replace(/[^A-Za-z0-9]/g,"").toUpperCase(); side=(t==="XLM")?"B":"A"; r.a.setAttribute("data-lxside",side); }
        e[side]=r; });
      if(!e.A&&rows[0])e.A=rows[0]; if(!e.B&&rows[1]&&rows[1]!==e.A)e.B=rows[1];
      return e; }
    function wrSide(r,a,amtTxt){ if(!r)return;
      var _hasTxt=false;
      [].slice.call(r.a.childNodes).forEach(function(nd){ if(nd.nodeType===3&&nd.textContent.trim()){ _hasTxt=true; if(nd.textContent!==" "+a.code+" ")nd.textContent=" "+a.code+" "; } });
      if(!_hasTxt)r.a.appendChild(document.createTextNode(" "+a.code+" "));   // freshly built cell has no label yet
      var ic=r.a.querySelector(".ico");
      if(ic&&(ic.getAttribute("data-logo")||!ic.querySelector("img"))){ ic.removeAttribute("data-logo"); ic.style.removeProperty("background"); ic.style.removeProperty("background-image"); ic.setAttribute("data-lxfixed","1"); ic.style.overflow="hidden"; ic.innerHTML=genLogo(a); }
      // MUST tag: the mask rule "#dwWithdraw .dw-field .row .asset:not([data-lxpair]){visibility:hidden}"
      // hides EVERY asset cell in the panel until it is claimed. fixWithdrawPair() only ever claims the
      // first one (querySelector), i.e. the "Withdraw from position" row — so the You-Receive cells stayed
      // invisible and the row rendered as a bare number with no logo and no ticker.
      if(r.a.getAttribute("data-lxpair")!=="1")r.a.setAttribute("data-lxpair","1");
      if(r.sp.textContent!==amtTxt)r.sp.textContent=amtTxt; }
    function withRecv(){ try{ fixWithdrawPair(); }catch(_){} var w=wInEl(); var sh=parseFloat(String((w&&w.value)||"").replace(/,/g,""))||0; var frac=d.totShares>0?sh/d.totShares:0; if(frac<0)frac=0; if(frac>1)frac=1; var e=withRecvEls();
      var sideA=d.nonXlm?d.a0:{code:d.code,issuer:d.issuer}, sideB=d.nonXlm?d.a1:{code:"XLM",native:true};
      var amtA=(d.nonXlm?d.a0.amt:d.tok)*frac, amtB=(d.nonXlm?d.a1.amt:d.xlm)*frac;
      wrSide(e.A,sideA,famt(amtA)); wrSide(e.B,sideB,famt(amtB));
      // "Pool share after" (remaining) in the withdraw summary
      var rem=(d.totShares-sh)>0?Math.max(0,(d.myShares-sh))/(d.totShares-sh):0; qa("#dwWithdraw .dw-summary .r, #dwWithdraw .summary .r, #dwWithdraw [class*=summary] > div").forEach(function(rw){ if(!/share/i.test(rw.textContent||""))return; var st=rw.querySelector("strong")||rw.querySelector("span:last-child"); if(st)st.textContent=(rem*100>=0.01?(rem*100).toFixed(2):(sh>0?"0.00":(d.myFrac*100).toFixed(2)))+"%"; }); }
    function maxBal(){ var fromXlm=r>0?usableXlm()/r:0; var t=Math.min(d.balTok,fromXlm); return {tok:t,xlm:t*r}; }
    function dInputs(){ return qa("#dwDeposit .dw-field input"); }   // re-query each time (design may re-create them)
    function setDep(t,x){ var di=dInputs(); if(di[0])di[0].value=fmtIn(t); if(di[1])di[1].value=fmtIn(x); shareAfter(); }
    // Delegated on the deposit panel so it survives the design re-rendering its inputs: edit one -> compute the other.
    var dpanel=q("#dwDeposit"); if(dpanel&&!dpanel.__lxDIn){ dpanel.__lxDIn=1; dpanel.addEventListener("input",function(e){ if(!e.target||e.target.tagName!=="INPUT")return; var di=dInputs(); if(e.target===di[0]){ var t=parseFloat(String(di[0].value).replace(/,/g,""))||0; if(di[1])di[1].value=fmtIn(t*r); shareAfter(); } else if(e.target===di[1]){ var x=parseFloat(String(di[1].value).replace(/,/g,""))||0; if(di[0])di[0].value=fmtIn(r>0?x/r:0); shareAfter(); } }); }
    // DELEGATED MAX/% on the deposit panel (a one-time clone dies when the design re-creates the panel on tab
    // switch -> "MAX does nothing"). Capture+stopPropagation so the design's own unbalanced handler can't also run.
    if(dpanel&&!dpanel.__lxDMax){ dpanel.__lxDMax=1; dpanel.addEventListener("click",function(e){ var t=e.target; if(!t||!t.closest)return; var btn=t.closest(".max-btn, .dw-pct-b, .dw-pct button, button, [class*=max], [class*=pct]"); if(!btn||!dpanel.contains(btn))return; var txt=(btn.textContent||"").trim().toLowerCase(); if(txt!=="max"&&!/^\d+(\.\d+)?%?$/.test(txt))return; e.preventDefault(); e.stopPropagation(); var m=maxBal(); var f=(txt==="max")?1:((parseFloat(txt)||0)/100); if(!(m.tok*f>0)&&!(m.xlm*f>0)){ var msg=(usableXlm()<=0)?("No spendable XLM to deposit \\u2014 your "+num(d.balXlm)+" XLM is below the account reserve.") : ("You need some "+d.code+" and XLM to deposit here."); try{ ammToast(msg,true); }catch(_){ } return; } setDep(m.tok*f,m.xlm*f); },true); }
    // Withdraw %/Max + LP input, DELEGATED on #dwWithdraw so it survives the design re-creating the buttons/input
    // on tab switch. Replicates the design's inline accent highlight (which our earlier clone stripped).
    function wBtns(){ return qa("#dwWithdraw .dw-pct-b, #dwWithdraw .dw-pct button, #dwWithdraw .max-btn"); }
    // The restyle forces this button's border/bg/color back to default (they're in its transition list + an override
    // that beats even inline !important), but OUTLINE + font-weight are free — use an accent ring for the highlight.
    function wHi(active){ wBtns().forEach(function(x){ if(x===active){ x.style.setProperty("outline","2px solid var(--accent)","important"); x.style.setProperty("outline-offset","-1px","important"); x.style.setProperty("font-weight","800","important"); } else { x.style.removeProperty("outline"); x.style.removeProperty("outline-offset"); x.style.removeProperty("font-weight"); } }); }
    var wpanel=q("#dwWithdraw");
    if(wpanel&&!wpanel.__lxW){ wpanel.__lxW=1;
      wpanel.addEventListener("input",function(e){ if(e.target&&e.target.tagName==="INPUT"){ wHi(null); withRecv(); } });   // manual amount clears the % highlight
      wpanel.addEventListener("click",function(e){ var btn=e.target&&e.target.closest&&e.target.closest(".dw-pct-b, .dw-pct button, .max-btn"); if(!btn||!wpanel.contains(btn))return; wHi(btn); var f=/max/i.test(btn.textContent)?1:(parseFloat(btn.textContent)||0)/100; var w=wInEl(); if(w){ w.value=fmtIn(d.myShares*f); withRecv(); } });
    }
    function isWith(){ var wp=q("#dwWithdraw"); return !!(wp&&getComputedStyle(wp).display!=="none"); }
    // every write above is diff-guarded, so this settles on the first pass instead of ping-ponging
    // with the design's own repaint.
    (function(){ var wp=q("#dwWithdraw"); if(!wp||wp.__lxRecvObs)return; wp.__lxRecvObs=1;
      try{ new MutationObserver(function(){ if(wp.__lxRecvBusy)return; wp.__lxRecvBusy=1;
        try{ withRecv(); }catch(_){} wp.__lxRecvBusy=0; }).observe(wp,{childList:true,subtree:true}); }catch(_){} })();
    function shareAfter(){ if(isWith())return; var x=parseFloat(depIn[1]&&depIn[1].value)||0; var pr=q(".dw-summary .r strong"); if(!pr)return; if(x>0&&d.xlm>0&&d.totShares>0){ var delta=d.totShares*(x/d.xlm); var f=(d.myShares+delta)/(d.totShares+delta); pr.textContent=(f*100>=0.01?(f*100).toFixed(2):"<0.01")+"%"; } else pr.textContent=(d.myFrac*100>=0.01?(d.myFrac*100).toFixed(2):"\\u2014"); }
    var cta=q(".dw-card .dw-cta"); if(!cta)return; var c2=cta.cloneNode(true); cta.parentNode.replaceChild(c2,cta); cta=c2;
    // Keep the shared CTA label in sync with the active tab. The design re-renders the button label at
    // unpredictable times (so fixed setTimeout re-asserts lost the race and it stayed "Add Liquidity"),
    // and it keys off the tab's .active class, which flips synchronously on click. A MutationObserver on
    // .dw-card re-asserts on ANY change; the text-diff guard stops it from looping on its own write.
    function tabIsWithdraw(){ var bs=qa(".dw-tabs button");
      var wt=bs.filter(function(b){return /withdraw/i.test(b.textContent||"");})[0];
      var dt=bs.filter(function(b){return /deposit/i.test(b.textContent||"");})[0];
      if(wt&&wt.classList.contains("active"))return true;
      if(dt&&dt.classList.contains("active"))return false;
      return isWith(); }                                  // neither marked -> the visible panel is the truth
    // A pool deposit needs BOTH assets, so an empty balance on either side makes the action impossible —
    // as does a non-XLM pair, whose deposits are deliberately not wired yet (see the FUNDS note below).
    // Returns "" when the CTA should be live, otherwise the reason it is not.
    function ctaBlockReason(){
      if(tabIsWithdraw()) return (d.myShares>0)?"":"You have no LP shares in this pool to withdraw.";
      if(d.nonXlm) return "Deposits for "+(d.pairName||"this pair")+" aren\u2019t supported here yet \u2014 withdrawing works normally.";
      // Name WHICH side is missing. A flat "no XLM" contradicts the balance shown directly above the button
      // when the wallet does hold XLM but all of it is pinned by the account reserve \u2014 call that case out.
      var noTok=!(d.balTok>0), noXlm=!(usableXlm()>0);
      if(noTok&&noXlm) return "Adding liquidity needs both "+d.code+" and XLM \u2014 you have neither available.";
      if(noTok) return "Adding liquidity needs both "+d.code+" and XLM \u2014 you have no "+d.code+".";
      if(noXlm) return "No spendable XLM \u2014 \u2248"+xlmKeep().toFixed(1)+" XLM must stay for the account reserve + fees.";
      return "";
    }
    // EVERY write here is diff-guarded. applyCtaState runs from the .dw-card MutationObserver, so an
    // unconditional write would re-trigger the observer forever — that is exactly what froze this page once.
    function applyCtaState(){
      var b=q(".dw-card .dw-cta"); if(!b||b.__lxBusy)return;                        // mid-transaction: wRun owns the button
      var why=ctaBlockReason(), off=!!why;
      if(b.classList.contains("lx-dwoff")!==off)b.classList.toggle("lx-dwoff",off);
      if((b.getAttribute("aria-disabled")==="true")!==off){ if(off)b.setAttribute("aria-disabled","true"); else b.removeAttribute("aria-disabled"); }
      if((b.getAttribute("title")||"")!==why){ if(why)b.setAttribute("title",why); else b.removeAttribute("title"); }
      var host=b.parentNode; if(!host)return;
      var h=host.querySelector(":scope > .lx-dwhint");
      if(!off){ if(h&&h.style.display!=="none")h.style.display="none"; return; }
      if(!h){ h=document.createElement("div"); h.className="lx-dwhint"; host.appendChild(h); }
      if(h.textContent!==why)h.textContent=why;
      if(h.style.display!=="")h.style.display="";
    }
    // syncLabel ONLY touches the CTA text (guarded so it settles) — this is what the observer runs. It must
    // NOT call withRecv()/shareAfter(): those write textContent INSIDE .dw-card, which the childList observer
    // would see as a mutation and re-fire forever, freezing the page (that blanked the whole pool detail page).
    // b.__lxBusy => a transaction is in flight and wRun owns the label ("Confirm in wallet…"); relabelling
    // it here would wipe the loading state the moment it was set.
    function syncLabel(){ var b=q(".dw-card .dw-cta"); if(!b||b.__lxBusy)return; var want=tabIsWithdraw()?"Withdraw":"Add Liquidity"; if((b.textContent||"").replace(/\\s+/g," ").trim()!==want)wCtaText(b,want); applyCtaState(); }
    function syncCta(){ syncLabel(); if(tabIsWithdraw())withRecv(); else shareAfter(); }
    qa(".dw-tabs button").forEach(function(tb){ tb.addEventListener("click",function(){ [0,30,150,400].forEach(function(ms){ setTimeout(syncCta,ms); }); }); });
    var _dwc=q(".dw-card"); if(_dwc&&!_dwc.__lxCtaObs){ _dwc.__lxCtaObs=1; try{ new MutationObserver(function(){ syncLabel(); }).observe(_dwc,{childList:true,subtree:true,attributes:true,attributeFilter:["class","style"]}); }catch(_){} }
    syncCta();
    if(isWith())withRecv();
    // deep-link: ?act=withdraw (e.g. from the Wallet "Remove" button) opens the Withdraw tab
    try{ if(!window.__lxActDone && /[?&]act=withdraw/.test(location.search)){ window.__lxActDone=1; var _wt=qa(".dw-tabs button").filter(function(b){return /withdraw/i.test(b.textContent);})[0]; if(_wt)_wt.click(); } }catch(e){}
    cta.addEventListener("click",function(e){ e.preventDefault(); e.stopImmediatePropagation();
      var _blk=ctaBlockReason(); if(_blk){ wMsg(cta,_blk,true); return; }
      var addr=myAddr(); if(!addr){ wMsg(cta,"Connect your Stellar wallet first.",true); return; }
      if(isWith()){
        var wel=wInEl(); var sh=parseFloat(String((wel&&wel.value)||"").replace(/,/g,""))||0;
        if(!(sh>0)){ wMsg(cta,"Enter the amount of LP shares to withdraw.",true); return; }
        if(sh>d.myShares*(1+1e-6)+1e-4){ wMsg(cta,"You hold "+fmtIn(d.myShares)+" LP shares.",true); return; }
        var shW=Math.min(sh,d.myShares);   // clamp so a rounded "Max" never exceeds the real balance (no op_underfunded)
        wRun(cta,addr,function(S){ return [ S.Operation.liquidityPoolWithdraw({liquidityPoolId:d.hex, amount:wAmt(shW), minAmountA:"0", minAmountB:"0"}) ]; }, {ok:"\\u2713 Withdrawn",okMsg:"Liquidity withdrawn."}, function(){ var w=wInEl(); if(w)w.value=""; wHi(null); setTimeout(loadDetail,2600); });
      } else {
        // AUDIT (FUNDS): for a nonXlm pool this builder would construct a native/token LiquidityPoolAsset —
        // i.e. deposit into a DIFFERENT pool than the page shows. Block until arbitrary-pair deposits are
        // wired (canonical asset ordering + price bounds). Withdraw is pair-agnostic and stays enabled.
        if(d.nonXlm){ wMsg(cta,"Deposits for "+d.pairName+" aren\\u2019t supported here yet \\u2014 withdrawing works normally.",true); return; }
        var di=dInputs(); var ta=parseFloat(String(di[0]&&di[0].value).replace(/,/g,""))||0, xa=parseFloat(String(di[1]&&di[1].value).replace(/,/g,""))||0;
        if(!(ta>0)||!(xa>0)){ wMsg(cta,"Enter both "+d.code+" and XLM amounts.",true); return; }
        if(ta>d.balTok+1e-7){ wMsg(cta,"Not enough "+d.code+" \\u00b7 balance "+fmtIn(d.balTok),true); return; }
        if(xa>usableXlm()+1e-7){ wMsg(cta,"Not enough XLM \\u2014 keep \\u2248"+xlmKeep().toFixed(1)+" for account reserve + fees (usable "+fmtIn(usableXlm())+" of "+fmtIn(d.balXlm)+" XLM)",true); return; }
        wRun(cta,addr,function(S,a){ var ops=[], asset=new S.Asset(d.code,d.issuer), poolAsset=new S.LiquidityPoolAsset(S.Asset.native(),asset,S.LiquidityPoolFeeV18);
          var hasTrust=(a.balances||[]).some(function(b){return b.asset_type==="liquidity_pool_shares"&&b.liquidity_pool_id===d.hex;});
          if(!hasTrust)ops.push(S.Operation.changeTrust({asset:poolAsset}));
          ops.push(S.Operation.liquidityPoolDeposit({liquidityPoolId:d.hex, maxAmountA:wAmt(xa), maxAmountB:wAmt(ta), minPrice:{n:1,d:1000000000}, maxPrice:{n:1000000000,d:1}}));
          return ops; }, {ok:"\\u2713 Added",okMsg:"Liquidity added."}, function(){ var di=dInputs(); if(di[0])di[0].value=""; if(di[1])di[1].value=""; setTimeout(loadDetail,2600); });
      }
    });
  }

  // ---- LIST: Create Pool (populate the finalized modal's pickers with real assets, then create+deposit) ----
  function wireCreatePool(){
    // Only the BALANCES are needed here — waiting for the whole pools payload (DATA) left the asset dropdown
    // visibly empty for seconds (the CSS hides the design's mock items). _cpBals is filled by an early,
    // standalone /accounts fetch so the picker is ready almost immediately.
    // NOTE: require a NON-EMPTY list — an empty array is truthy and would wire an EMPTY picker while
    // permanently setting __lxCPwired, locking out the real balances when they arrive.
    if(window.__lxCPwired)return;
    var _bals=(DATA&&DATA.balances&&DATA.balances.length)?DATA.balances:((_cpBals&&_cpBals.length)?_cpBals:null);
    if(!_bals)return;
    var modal=q("#createPoolModal"); if(!modal)return; window.__lxCPwired=1;
    var cpCta=null;
    var balMap={XLM:0}; (_bals||[]).forEach(function(b){ if(b.asset_type==="native")balMap.XLM=+b.balance; else if(b.asset_code)balMap[b.asset_code+":"+b.asset_issuer]=+b.balance; });
    // only assets the connected wallet actually holds (XLM + every credit asset with a positive balance)
    function assets(){ var arr=[]; if((balMap.XLM||0)>0)arr.push({code:"XLM",issuer:"",bal:balMap.XLM,native:true}); (_bals||[]).forEach(function(b){   /* _bals, NOT DATA.balances — DATA is still null on the early (fast) wire path and this threw */ if(b.asset_type&&b.asset_type!=="native"&&b.asset_type!=="liquidity_pool_shares"&&b.asset_code&&+b.balance>0)arr.push({code:b.asset_code,issuer:b.asset_issuer,bal:+b.balance,native:false}); }); return arr; }
    // real asset logos: local PNGs where they exist, known CDN URLs otherwise, and a colored-letter fallback
    // (the letter shows through if the image 404s/fails — so an asset never renders a generic placeholder).
    var LOGOS={XLM:"assets/tokens/xlm.png",AQUA:"assets/tokens/aqua.png",USDC:"assets/tokens/usdc.png",yUSDC:"assets/tokens/usdc.png",EURC:"https://assets.coingecko.com/coins/images/26045/small/euro.png",yXLM:"https://assets.coingecko.com/coins/images/100/small/fmpFRHHQ_400x400.jpg"};
    var _CPCOLS=["#6f5ded","#ff894c","#2bb673","#e0447b","#3aa0ff","#f5b301","#9b5de5","#00bbf9"];
    function cpCol(s){ s=s||"?"; var h=0; for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0; return _CPCOLS[h%_CPCOLS.length]; }
    function logo(a){ var code=a.native?"XLM":a.code; var u=LOGOS[code]||((window.__lxLogos||{})[code])||"";
      var s='<span style="position:relative;display:flex;width:100%;height:100%;align-items:center;justify-content:center;border-radius:50%;overflow:hidden;background:'+cpCol(code)+';color:#fff;font-weight:800;font-size:11px">'+esc((code||"?").slice(0,1).toUpperCase());
      if(u)s+='<img src="'+u+'" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" onerror="this.style.display=\\x27none\\x27">';
      return s+'</span>'; }
    var sel=[null,null];
    // fair market rate (to per from) via a Horizon strict-send probe, cached per pair. Lets us auto-fill the
    // second amount so a NEW pool starts at the real market price (the ratio sets the price).
    var _poolRate={};
    function fairRate(from,to,cb){ if(!from||!to){cb(0);return;} var key=(from.native?"X":from.code+":"+from.issuer)+">"+(to.native?"X":to.code+":"+to.issuer); if(_poolRate[key]!=null){cb(_poolRate[key]);return;}
      var srcP=from.native?"source_asset_type=native":("source_asset_type=credit_alphanum"+(from.code.length>4?"12":"4")+"&source_asset_code="+from.code+"&source_asset_issuer="+from.issuer);
      var dstP="destination_assets="+encodeURIComponent(to.native?"native":(to.code+":"+to.issuer)); var probe=from.native?"10":"100";
      getJSON(H+"/paths/strict-send?"+srcP+"&source_amount="+probe+"&"+dstP).then(function(pd){ var recs=(pd&&pd._embedded&&pd._embedded.records)||[]; var out=recs.length?parseFloat(recs[0].destination_amount):0; var rate=out>0?out/parseFloat(probe):0; _poolRate[key]=rate; cb(rate); }).catch(function(){cb(0);}); }
    // fill the OTHER amount from the edited one at the fair rate (never clobbers the field being typed in)
    function autofillOther(idx){ var a=amts&&amts[idx], other=amts&&amts[1-idx]; if(!a||!other||!sel[idx]||!sel[1-idx]){summary();return;} fairRate(sel[idx],sel[1-idx],function(rate){ if(rate>0){ var v=(parseFloat((a.value||"").replace(/,/g,""))||0)*rate; if(document.activeElement!==other)other.value=v>0?fmtIn(v):""; } summary(); }); }
    // AUDIT (user-reported): both sides could be set to the same asset — a BROT/BROT "pool", which Stellar
    // rejects outright. Identity is code+issuer, so USDC from two different issuers is still a valid pair.
    function akey(a){ return a?(a.code+":"+(a.issuer||"")):""; }
    function paintField(idx){
      if(!sel[idx])return;
      var field=modal.querySelectorAll(".asset-field")[idx], pk=field&&field.querySelector(".asset-picker");
      if(pk){ pk.classList.remove("placeholder"); var ico=pk.querySelector(".ap-ico"),nm=pk.querySelector(".ap-name");
        if(ico){ico.innerHTML=logo(sel[idx]);ico.style.cssText="width:24px;height:24px;overflow:hidden;border-radius:50%;display:inline-flex;background:transparent";}
        if(nm)nm.textContent=sel[idx].code; }
      var bal=field&&(field.querySelector(".field-foot .balance strong")||field.querySelector(".field-foot .balance"));
      if(bal)bal.textContent=famt(sel[idx].bal);
    }
    function selectItem(idx, it){ if(idx<0)return; var code=it.getAttribute("data-code"),iss=it.getAttribute("data-issuer");
      var picked={code:code,issuer:iss,native:!iss,bal:balMap[code==="XLM"?"XLM":(code+":"+iss)]||0};
      // picking the asset already on the other side SWAPS the pair (what every DEX does) instead of
      // producing a self-pair. The lists below also filter it out, so this is the belt to that braces.
      if(sel[1-idx]&&akey(sel[1-idx])===akey(picked)){ sel[1-idx]=sel[idx]||null; }
      sel[idx]=picked;
      paintField(0); paintField(1);
      var field=modal.querySelectorAll(".asset-field")[idx];
      var dd=field&&field.querySelector(".asset-dropdown"); if(dd){ dd.classList.remove("open"); dd.style.display=""; }
      dds.forEach(function(d,i){ fill(d,i); });          // refresh both lists so the exclusion stays current
      if(sel[0]&&sel[1]){ var _fi=(amts&&amts[0]&&(parseFloat(amts[0].value)||0)>0)?0:((amts&&amts[1]&&(parseFloat(amts[1].value)||0)>0)?1:-1); if(_fi>=0){ autofillOther(_fi); return; } }
      summary();
    }
    // the design's .ad-item handler calls lxNavigate (mock nav); our lxNavigate wrapper routes it here instead
    window.__lxCpSel=function(it){ var fields=[].slice.call(modal.querySelectorAll(".asset-field")); var f=it.closest&&it.closest(".asset-field"); selectItem(fields.indexOf(f), it); };
    function fill(dd,idx){ var list=dd.querySelector(".ad-list"); if(!list)return;
      var other=akey(sel[1-idx]);
      var opts=assets().filter(function(a){ return akey(a)!==other; });   // a pool cannot pair an asset with itself
      if(!opts.length){ list.innerHTML='<div class="lx-cpnone" style="padding:14px 12px;font-size:13px;color:var(--text-soft,#6b6b76)">No other asset in your wallet to pair with. A pool needs two different assets.</div>'; return; }
      list.innerHTML=opts.map(function(a){ return '<button type="button" class="ad-item lx-cpitem" data-code="'+esc(a.code)+'" data-issuer="'+esc(a.issuer)+'"><span class="ad-ico" style="width:26px;height:26px;overflow:hidden;border-radius:50%;display:inline-flex;background:transparent">'+logo(a)+'</span><span class="ad-meta"><span class="ad-tk">'+esc(a.code)+'</span><span class="ad-nm">'+(a.native?"Stellar Lumens":esc(a.code))+'</span></span><span class="ad-bal">'+famt(a.bal)+'</span></button>'; }).join("");
      list.querySelectorAll(".lx-cpitem").forEach(function(it){ it.addEventListener("click",function(e){ e.preventDefault(); e.stopImmediatePropagation(); selectItem(idx,it); }); });
    }
    var dds=[].slice.call(modal.querySelectorAll(".asset-dropdown")); dds.forEach(function(dd,i){ fill(dd,i); });
    var amts=[].slice.call(modal.querySelectorAll(".asset-amt"));
    [].slice.call(modal.querySelectorAll(".asset-field")).forEach(function(f,i){ var mx=f.querySelector(".max-btn"); if(mx)mx.addEventListener("click",function(){ if(sel[i]&&amts[i]){ var b=sel[i].bal-(sel[i].native?1.6:0); amts[i].value=fmtIn(b>0?b:0); autofillOther(i); } }); });
    amts.forEach(function(a,idx){ a.addEventListener("input",function(){ autofillOther(idx); }); });
    qa("#createPoolModal .pool-summary .row strong").forEach(function(s){ var lab=((s.previousElementSibling||{}).textContent||""); if(/trading fee/i.test(lab))s.textContent="0.3%"; else if(/network fee/i.test(lab))s.textContent="\\u2248 0.00001 XLM"; });
    function summary(){ var a0=parseFloat(amts[0]&&amts[0].value)||0,a1=parseFloat(amts[1]&&amts[1].value)||0; var pr=q("#createPoolModal .pool-summary .row strong"); if(pr){ if(sel[0]&&sel[1]&&a0>0&&a1>0)pr.textContent=(+((a1/a0).toFixed(6)))+" "+sel[1].code+"/"+sel[0].code; else pr.textContent="\\u2014"; }
      // AUDIT: autofillOther() derives the paired amount from the market rate, so MAX on one side routinely
      // proposes more of the OTHER asset than the wallet holds (MAX 8.13 XLM -> 4,078 AQUA against a 0.0000001
      // balance). Nothing flagged it, so the only feedback was a failed transaction. Name the shortfall.
      var over=[];
      if(sel[0]&&a0>0&&a0>(sel[0].bal-(sel[0].native?1.6:0))+1e-9)over.push(sel[0].code);
      if(sel[1]&&a1>0&&a1>(sel[1].bal-(sel[1].native?1.6:0))+1e-9)over.push(sel[1].code);
      var same=!!(sel[0]&&sel[1]&&akey(sel[0])===akey(sel[1]));
      var warn=modal.querySelector(".lx-cpwarn");
      if(same){
        if(!warn){ warn=document.createElement("div"); warn.className="lx-cpwarn"; var sm0=modal.querySelector(".pool-summary"); if(sm0&&sm0.parentNode)sm0.parentNode.insertBefore(warn,sm0.nextSibling); else modal.appendChild(warn); }
        warn.textContent="A pool needs two different assets \\u2014 pick something other than "+sel[0].code+" for one side.";
        warn.style.display="";
        if(cpCta){ cpCta.style.opacity="0.6"; cpCta.style.cursor="pointer"; }
        return;
      }
      if(over.length){
        if(!warn){ warn=document.createElement("div"); warn.className="lx-cpwarn"; var sm=modal.querySelector(".pool-summary"); if(sm&&sm.parentNode)sm.parentNode.insertBefore(warn,sm.nextSibling); else modal.appendChild(warn); }
        warn.textContent="Not enough "+over.join(" or ")+(over.length>1?"":"")+" \\u2014 lower the amount, or pick a pair you hold more of."+(over.indexOf("XLM")>=0?" XLM also keeps ~1.6 locked as the account reserve.":"");
        warn.style.display="";
      } else if(warn){ warn.style.display="none"; }
      var valid=!!(sel[0]&&sel[1]&&a0>0&&a1>0&&!over.length); if(cpCta){ cpCta.style.opacity=valid?"1":"0.6"; cpCta.style.cursor="pointer"; } }
    var cta=null; modal.querySelectorAll("button").forEach(function(b){ if(/create pool/i.test(b.textContent)&&/liquidit|&/i.test(b.textContent))cta=b; }); if(!cta)cta=modal.querySelector(".btn-primary"); if(!cta)return;
    var c2=cta.cloneNode(true); cta.parentNode.replaceChild(c2,cta); cta=c2; cpCta=cta; cta.disabled=false; cta.style.opacity="0.6";
    // the design keeps this button disabled based on its own (bypassed) selection state — keep it clickable; our handler validates.
    // AUDIT #8 (funds): this observer also undid wRun()'s disable while the wallet prompt was open, so the user
    // could click again and sign a SECOND deposit. Never re-enable while a transaction is in flight (cta.__lxBusy).
    try{ new MutationObserver(function(){ if(cta.disabled&&!cta.__lxBusy)cta.disabled=false; }).observe(cta,{attributes:true,attributeFilter:["disabled"]}); }catch(_e){}
    cta.addEventListener("click",function(e){ e.preventDefault(); e.stopImmediatePropagation();
      var addr=myAddr(); if(!addr){ wMsg(cta,"Connect your Stellar wallet first.",true); return; }
      if(!sel[0]||!sel[1]){ wMsg(cta,"Select both assets.",true); return; }
      if(sel[0].code===sel[1].code&&sel[0].issuer===sel[1].issuer){ wMsg(cta,"Choose two different assets.",true); return; }
      var a0=parseFloat(amts[0]&&amts[0].value)||0,a1=parseFloat(amts[1]&&amts[1].value)||0; if(!(a0>0)||!(a1>0)){ wMsg(cta,"Enter both amounts.",true); return; }
      if(a0>sel[0].bal+1e-7){ wMsg(cta,"Not enough "+sel[0].code+" \\u00b7 balance "+fmtIn(sel[0].bal),true); return; }
      if(a1>sel[1].bal+1e-7){ wMsg(cta,"Not enough "+sel[1].code+" \\u00b7 balance "+fmtIn(sel[1].bal),true); return; }
      wRun(cta,addr,function(S,a){ function mk(x){ return x.native?S.Asset.native():new S.Asset(x.code,x.issuer); }
        var A=mk(sel[0]),B=mk(sel[1]),amtA=a0,amtB=a1,poolAsset;
        try{ poolAsset=new S.LiquidityPoolAsset(A,B,S.LiquidityPoolFeeV18); }catch(err){ var t=A;A=B;B=t; var ta=amtA;amtA=amtB;amtB=ta; poolAsset=new S.LiquidityPoolAsset(A,B,S.LiquidityPoolFeeV18); }
        var poolId=S.getLiquidityPoolId("constant_product",poolAsset.getLiquidityPoolParameters()).toString("hex"), ops=[];
        [sel[0],sel[1]].forEach(function(x){ if(!x.native){ var held=(a.balances||[]).some(function(b){return b.asset_code===x.code&&b.asset_issuer===x.issuer;}); if(!held)ops.push(S.Operation.changeTrust({asset:new S.Asset(x.code,x.issuer)})); } });
        if(!(a.balances||[]).some(function(b){return b.asset_type==="liquidity_pool_shares"&&b.liquidity_pool_id===poolId;}))ops.push(S.Operation.changeTrust({asset:poolAsset}));
        ops.push(S.Operation.liquidityPoolDeposit({liquidityPoolId:poolId, maxAmountA:wAmt(amtA), maxAmountB:wAmt(amtB), minPrice:{n:1,d:1000000000}, maxPrice:{n:1000000000,d:1}}));
        return ops; }, {ok:"\\u2713 Pool created",okMsg:"Pool created & liquidity added."}, function(){ setTimeout(function(){ location.reload(); },2600); });
    });
  }

  // DASHBOARD "Add liquidity" quick-action opens the SAME #createPoolModal but this page has no pools list, so
  // nothing wired the asset dropdown -> clicking "Select asset" fell through to the nav-shim (jumped to LUMOS/XLM).
  // Fetch just the held balances into DATA and run the real create-pool wiring (dropdown + autofill + create).
  function loadCPOnly(){ reveal(); wireNav(); var addr=myAddr(); if(!addr)return;
    // AUDIT #3 bug 5: this hardcoded xlmUsd:0.17 — every USD figure in the dashboard's Create Pool modal
    // assumed XLM = $0.17 forever. Seed from the 6h-cached live price and refresh from CoinGecko.
    (window.__lxAcct?window.__lxAcct(addr):getJSON(H+"/accounts/"+addr)).then(function(a){ DATA={balances:(a&&a.balances)||[],pools:[],mine:[],xlmUsd:xuFallback()}; try{ wireCreatePool(); }catch(_){}
      getJSON("https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd").then(function(j){ var v=j&&j.stellar&&+j.stellar.usd; if(v>0&&DATA)DATA.xlmUsd=xuSave(v); }); }).catch(function(){});
    [500,1400].forEach(function(ms){ setTimeout(function(){ try{ if(DATA)wireCreatePool(); }catch(_){} },ms); }); }
  function boot(){
    if(window.__lxAmmBoot)return; window.__lxAmmBoot=1;
    var root=q("main")||document.body;
    if(q("#poolsBody")){ try{ renameMineTab(); }catch(_){}
      // fetch just the balances up-front so Create Pool's asset dropdown is populated immediately
      // (it used to wait on the full pools load and showed an empty list for seconds)
      try{ var _cpa=myAddr(); if(_cpa)(window.__lxAcct?window.__lxAcct(_cpa):getJSON(H+"/accounts/"+_cpa)).then(function(acc){ _cpBals=(acc&&acc.balances)||[]; try{ wireCreatePool(); }catch(_e){} }).catch(function(){}); }catch(_){}
      wireHeroCover(); [0,40,120,300].forEach(function(ms){ setTimeout(wireHeroCover,ms); }); load(); wireNav(); try{ new MutationObserver(function(){ try{ renameMineTab(); }catch(_){} schedule(); }).observe(root,{childList:true,subtree:true}); }catch(e){} [300,900,2000].forEach(function(ms){ setTimeout(paint,ms); }); }
    else if(q("#tvlChart")){ loadDetail(); try{ new MutationObserver(scheduleDetail).observe(root,{childList:true,subtree:true}); }catch(e){} [0,250,600,1100].forEach(function(ms){ setTimeout(function(){ if(!DET){ var g=q("#tvlChart svg"); if(g){ try{ chLoading(g); }catch(_){} } } },ms); }); [400,1200,2500].forEach(function(ms){ setTimeout(function(){ if(DET)paintDetail(); },ms); }); }
    else if(q("#createPoolModal")){ loadCPOnly(); return; }
    else { reveal(); return; }
    setTimeout(function(){ if(!document.documentElement.classList.contains("lx-ammready")){
      // dash whatever never got real data BEFORE lifting the mask, so the reveal can't expose the mock
      qa(".amm-snapshot-value").forEach(function(v){ if(!v.classList.contains("lx-snapd"))setText(v,"\\u2014"); });
      // the tab counts are masked by the SAME gate — dash the design's baked "100" too, or lifting
      // the mask presents it as a real pool count until the data lands a moment later.
      qa("#poolTabs .count").forEach(function(c){ if(!c.classList.contains("lx-snapd"))setText(c,"\\u2014"); });
      qa(".amm-snapshot-vsub, .amm-snapshot-sub").forEach(function(s){ var r=s.closest?s.closest(".amm-snapshot-row"):null;
        var v=r&&r.querySelector(".amm-snapshot-value"); if(v&&!v.classList.contains("lx-snapd"))setText(s,""); });
      reveal(); } },7000);
    // AUDIT (flash sweep): lx-detpr only ever gets set by a successful paintDetail(). Open the detail page
    // without a ?pool= id (or with a dead fetch) and the entire masked pair/position/stat area stays blank
    // forever. lx-ammready already had this safety valve; the detail gate did not.
    // AUDIT (user-reported, follow-up): but revealing on a TIMER uncovered the design's mock — a real pool
    // page showed 3,420,180 XLM liquidity and a $1,247.50 position that were pure fiction, for the whole
    // window between 7s and the data landing (~12s on a slow Horizon). Dash the mock first, same as the
    // Market Overview fix: unknown beats invented.
    function detGiveUp(){
      // still fetching (poolTry backs off and retries) — say nothing yet. Re-armed once, so a request
      // that never settles still gets an explanation instead of hanging silently forever.
      if(window.__lxDetLoading&&!window.__lxDetWaited&&!DET){ window.__lxDetWaited=1; setTimeout(detGiveUp,8000); return; }
      if(!document.documentElement.classList.contains("lx-detpr")&&!DET){
        // no data after 7s: dash the mock AND say why, with a retry — a page of silent dashes reads as broken
        try{
          qa(".my-position .mp-amount, .my-position .mp-pnl, .my-position .mp-asset-name, .my-position .mp-asset-amt, .my-position .mp-fee-val, .position-share-pill").forEach(function(e){ setText(e,"\\u2014"); });
          qa(".side-head .count-pill").forEach(function(e){ setText(e,"\\u2014"); });
        }catch(_){}
        if(window.__lxDetFail){ window.__lxDetFail(); return; }
      }
      document.documentElement.classList.add("lx-detpr");
    }
    setTimeout(detGiveUp,7000);
  }
  if(document.readyState!=="loading")boot(); else document.addEventListener("DOMContentLoaded",boot);
})();</script>`;

const files = fs.readdirSync('.').filter(f => /^lumoscore-.*-(desktop|mobile)\.html$/.test(f));
let n = 0, containers = 0;
for (const file of files) {
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;
  for (const k of KEYS) {
    if (!json[k]) continue;
    let p = json[k];
    // Rename the right-side box "Pool Snapshot" -> "Market Overview" (only the DOM text node; i18n JSON
    // keys are followed by '":' not '</div>', so they're untouched).
    p = p.replace(/Pool Snapshot(\s*<\/div>)/g, 'Market Overview$1');
    // AUDIT #3 bug 20: the static <title> read "LumosCore — LUMOS / APT Pool" — the browser tab, history
    // and bookmarks named an Aptos pair until the engine rewrote it at runtime. Neutral static title;
    // paintDetail still sets the real pair once known. Scoped to the <title> tag only — nothing else.
    p = p.replace(/<title>\s*LumosCore\s*—\s*LUMOS \/ APT Pool([^<]*)<\/title>/, '<title>LumosCore — Pool$1</title>');
    // AUDIT (user-reported "Pools-Pool takes ages to load"): the design defaults the activity chart to 1Y,
    // which is the SLOWEST possible query — measured against Horizon on a live pool: 1M 1.5s, 3M 2.7s,
    // 1Y 5.1s, ALL 5.1s. The chart cannot draw until it returns, so the default alone cost ~3.5 extra
    // seconds on every visit. Default to 1M; 1Y is still one click away for anyone who wants it.
    p = p.replace(/(<div class="tf-mini">[\s\S]*?<\/div>)/, function (blk) {
      if (blk.indexOf('>1M<') < 0) return blk;
      return blk.replace(/<button class="active">1Y<\/button>/, '<button>1Y</button>')
                .replace(/<button>1M<\/button>/, '<button class="active">1M</button>');
    });
    p = p.replace(/<style id="lx-amm-css">[\s\S]*?<\/style>/, '').replace(/<script id="lx-ammdata">[\s\S]*?<\/script>/, '');
    if (p.indexOf('</head>') >= 0) p = p.replace('</head>', STYLE + '</head>');
    else { const hb = p.lastIndexOf('</body>'); p = p.slice(0, hb) + STYLE + p.slice(hb); }
    const bi = p.lastIndexOf('</body>');
    p = p.slice(0, bi) + SCRIPT + p.slice(bi);
    json[k] = p; changed = true; n++;
  }
  // ALSO inject into the DASHBOARD page (has #createPoolModal but is not a pool list/detail page) so the
  // "Add liquidity" quick-action's Create Pool modal is fully wired (asset dropdown + create) — see loadCPOnly().
  for (const k of Object.keys(json)) {
    if (KEYS.indexOf(k) >= 0) continue;
    let p = json[k];
    if (p.indexOf('createPoolModal') < 0) continue;
    // Strip any PRIOR injection FIRST, then test the ORIGINAL design markers. (The injected SCRIPT itself contains
    // "#tvlChart", so testing before stripping made every rebuild after the first skip this key -> stale script.)
    p = p.replace(/<style id="lx-amm-css">[\s\S]*?<\/style>/, '').replace(/<script id="lx-ammdata">[\s\S]*?<\/script>/, '');
    if (p.indexOf('poolsBody') >= 0 || p.indexOf('tvlChart') >= 0) continue;   // a real pools list/detail page — already handled by the KEYS loop
    if (p.indexOf('</head>') >= 0) p = p.replace('</head>', STYLE + '</head>');
    const bi = p.lastIndexOf('</body>'); if (bi < 0) continue;
    p = p.slice(0, bi) + SCRIPT + p.slice(bi);
    json[k] = p; changed = true; n++;
  }
  if (changed) { containers++; const serialized = JSON.stringify(json).split('</').join('<' + B + '/'); fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8'); }
}
console.log('amm data (list): injected=' + n + ' keys across ' + containers + ' containers');
