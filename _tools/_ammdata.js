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
/* ---- the three pool stat cards, as one set ---------------------------------------------------- */
/* Next to Trade-Asset's stat cards these read as three different objects: the Liquidity value wrapped
   onto a second line while its neighbours stayed on one, and the sub-line was 13.5px -- close enough
   to the 18px value to compete with it -- carrying a run-on of three facts. So: the value shrinks to
   fit rather than wrapping, the sub-line steps back to a quiet single line, and every card reserves
   the same sub-line height so three cards line up even when one has nothing to say there. */
.ph-stats .ph-stat{display:flex;flex-direction:column}
.ph-stat .v{white-space:nowrap;font-size:clamp(15px,1.35vw,18px);font-weight:800;letter-spacing:-.2px}
.ph-stat .s{font-size:12px;margin-top:3px;min-height:15px;white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis;color:var(--text-soft)}
@media(max-width:880px){
.ph-stat .v{font-size:16px}
.ph-stat .s{font-size:11.5px}
}
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
/* The stack is pointer-events:none so a toast never blocks the page underneath — but that also made the
   explorer link inside it unclickable, which is why "view" appeared to lead nowhere. Re-enable pointer
   events on the LINK only, so the rest of the toast stays click-through. */
.lx-ctoast a{color:inherit;text-decoration:underline;pointer-events:auto;white-space:nowrap}
@keyframes lxCtIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
html:not(.lx-ammready) #poolsBody, html:not(.lx-ammready) #poolTabs .count{visibility:hidden}
/* #panelAll is the PHONE's all-pools list and was never in the gate above, because when that gate was
   written paintTables filled both and revealed after. The network list changed that: the rows now arrive
   from /lxapi/pools, so the design's baked mock (LUMOS/XLM $1,432,475, CELL/XLM, USDT/XLM) sat visible
   until they landed. Same treatment as the desktop body. */
html:not(.lx-ammready) #panelAll{visibility:hidden}
/* POOL-DETAIL TAB STRIPS ON A PHONE.
   #ptabs measures 432px of tabs inside a 345px box, so "Participants" sits past the right edge and is
   simply unreachable — on a narrower handset "Transactions" and "My Position" go with it. The strip is
   overflow:auto on BOTH axes too, so instead of doing nothing a tap drags the row (the same defect the
   Trade-asset tab strip had). Deposit/Withdraw is the same shape: two fixed 152px buttons, 304px of
   content that stops fitting below ~330px of viewport.
   Fix both the way the Trade strip was fixed: the tabs SHARE the width and the row cannot scroll at all.
   overflow must be set on both axes — one non-visible axis forces the other to auto, which is what made
   it draggable vertically. */
@media (max-width:760px){
  #ptabs.panel-tabs{display:flex!important;flex-wrap:nowrap!important;overflow:hidden!important;gap:0!important;padding-bottom:2px}
  /* size to content, share what is left: equal quarters clipped "Deposit / Withdraw", which is much longer
     than the other three. The four together measure ~333px inside 345px, so they all fit unclipped; the
     min-width:0 + ellipsis below is the safety net for a narrower handset. */
  #ptabs.panel-tabs>*{flex:1 1 auto!important;min-width:0!important;padding-left:3px!important;padding-right:3px!important;
    font-size:11px!important;letter-spacing:-.1px;white-space:nowrap;text-align:center;justify-content:center!important;overflow:hidden;text-overflow:ellipsis}
  .dw-tabs{display:flex!important;flex-wrap:nowrap!important;overflow:hidden!important}
  .dw-tabs>*{flex:1 1 0!important;min-width:0!important;white-space:nowrap}
}
/* Small handsets (iPhone SE and friends): at 11px the four labels want ~302px inside a 290px strip, so
   every one of them ellipsised by a few pixels. A step down to 10px needs ~269px and they read in full. */
@media (max-width:359px){
  #ptabs.panel-tabs>*{font-size:10px!important;padding-left:2px!important;padding-right:2px!important}
}
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
/* network pool-list pager. #paginationAll ships from the design with a static "1-10 of 100"; its
   contents are replaced wholesale, so these rules describe the whole footer rather than tweaking it. */
/* display is deliberately NOT !important. The design's tab handler hides the footer by writing
   pag.style.display="none" when My Pools is selected, and an !important rule in the stylesheet beats an
   inline style -- so the pager stayed on screen under the My Pools list. Specificity here is the bug. */
.lx-netpag{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;
  padding:14px 4px 2px;margin-top:6px;border-top:1px solid var(--border);
  font-family:'Hanken Grotesk',system-ui,sans-serif;font-size:13.5px;color:var(--text-soft)}
.lx-netpag .lx-netpag-c{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.lx-netpag button{background:var(--surface-2);border:1px solid var(--border);border-radius:8px;
  padding:6px 12px;font:inherit;font-weight:600;color:var(--text);cursor:pointer;transition:.16s}
.lx-netpag button:hover:not(:disabled){border-color:var(--accent-soft)}
.lx-netpag button:disabled{opacity:.4;cursor:default}
.lx-netpag .lx-netpag-m{margin:0 8px;font-variant-numeric:tabular-nums;white-space:nowrap}
.lx-netpag .lx-netpag-i{font-variant-numeric:tabular-nums}
.lx-netpag-host{margin-top:10px}
@media (max-width:700px){ .lx-netpag{justify-content:center;text-align:center}
  .lx-netpag .lx-netpag-i{width:100%;text-align:center} }
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
/* NOT scoped to .dw-card. The phone puts this button in .card > .card-body, so the old
   ".dw-card .dw-cta.lx-dwoff" never matched there: the CTA was aria-disabled and inert to our handler
   while still looking and feeling fully enabled. The hint paragraph underneath hid that -- with the
   paragraph gone the button's own appearance IS the whole message, so it has to be right on both. */
.dw-cta.lx-dwoff{opacity:.45!important;cursor:not-allowed!important;pointer-events:none!important;filter:grayscale(.35)}
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
.lx-acct:hover{color:var(--accent)!important}
.lx-partrow .part-addr{flex:1;font-family:'JetBrains Mono',monospace;font-size:13px}
.lx-partrow .part-share{font-weight:700;font-size:14px!important}
/* pool detail: remove the design's green endpoint dot on the TVL chart */
#tvlChart circle{display:none!important}
/* Participants pager. We APPEND this footer ourselves, and the design only ships .part-foot styling in the
   desktop file -- the phone build has no .part-foot rule at all, so on mobile it rendered as two stacked
   unstyled divs with bare chevrons overflowing the card. Styled on our own class so it stands up wherever
   it is inserted; the values mirror the desktop rules so both look the same. */
.lx-partfoot{display:flex!important;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;
  padding:10px 14px;border-top:1px solid var(--border);font-size:13px;color:var(--text-soft);
  font-family:'Hanken Grotesk',system-ui,sans-serif}
.lx-partfoot > div:first-child{font-variant-numeric:tabular-nums}
.lx-partfoot .nav{display:inline-flex;align-items:center;gap:6px}
.lx-partfoot .nav button{width:26px;height:26px;min-width:26px;padding:0;border-radius:6px;
  border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;
  display:inline-flex;align-items:center;justify-content:center;font-size:15px;line-height:1}
.lx-partfoot .nav button:hover:not(:disabled){color:var(--accent);border-color:var(--accent)}
.lx-partfoot .nav button:disabled{opacity:.4;cursor:default}
.lx-partfoot .lx-pppg{font-variant-numeric:tabular-nums;white-space:nowrap;padding:0 2px}
/* The "Pool TVL / Volume" dropdown chose which of the two series to show, so they were never on screen
   together. They now share one chart -- TVL line with volume bars beneath it, same as Trade-asset -- which
   leaves this control with nothing to switch between. Hidden rather than deleted from the markup: the
   design ships its own open/close handler and label rewriting for it, and removing the node it expects is
   how you get a handler throwing on every click.

   NOT scoped to .chart-card. That is where the desktop puts it; the phone puts it in
   .card > .chart-controls, so a ".chart-card ..." rule hid it on desktop only and left it sitting on
   mobile. This is the SECOND selector in this file written against the desktop's wrapper and silently
   missing the phone's (the disabled-CTA rule was the first) -- on this page, scope to the element.

   #chartMetricMenu / .chart-mode-menu is the menu the design's own script builds and appends; with the
   trigger gone nothing should open it, but a stale "open" class would otherwise leave it on screen. */
.chart-mode-select,#chartMetricMenu,.chart-mode-menu{display:none!important}
/* pool-tx wallet address links to OUR account page — subtle hover underline */
.lx-sortag{display:inline-block;margin-left:7px;padding:1px 7px;border-radius:999px;font-size:10.5px;
font-weight:700;letter-spacing:.02em;background:var(--surface);border:1px solid var(--border);color:var(--text-soft);vertical-align:middle}
.lx-nolink{cursor:default}
.lx-nolink:hover .lx-waddr{text-decoration:none}
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
/* Pool Transactions pager, phone. The design ships a .tx-foot on desktop and nothing here, so this is
   built to match it: same wording, same Prev / Page N of M / Next, sized for a thumb (44px targets). */
.lx-txfoot-m{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-top:1px solid var(--border);font-size:12px;color:var(--text-muted)}
.lx-txfoot-m .controls{display:inline-flex;align-items:center;gap:4px;flex:0 0 auto}
.lx-txfoot-m button{min-height:34px;padding:8px 11px;border:1px solid var(--border);border-radius:9px;background:transparent;color:var(--text);font:600 12px/1 'Hanken Grotesk',sans-serif;-webkit-tap-highlight-color:transparent}
.lx-txfoot-m button:disabled{opacity:.4}
.lx-txfoot-m .lx-txpg{margin:0 7px;white-space:nowrap;font-size:12px;color:var(--text-muted)}
.lx-txfoot-m .lx-txinfo{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
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
/* lx-poolsweight: match the Trade tables. Pools body numbers computed to font-weight 400 while the
   Trade tables render theirs at 700 (both JetBrains Mono), so the two sections read as different
   typefaces. Only the PRIMARY numeric line is bolded — the $ sub-line under it stays lighter, which
   is how Trade does it too. Columns 1-2 (# and PAIR) are left alone; :last-child covers Participants,
   which is bare text in the td with no inner div. */
table.pools tbody tr.lx-ammrow td:nth-child(n+3)>div:first-child,
table.pools tbody tr.lx-ammrow td:last-child{font-weight:700}

/* My Position asset logos. We insert a real <img> into the design's 24px .mpm-asset-ico bubble, but the
   phone stylesheet only ever expected a LETTER in there, so it sizes nothing: a 181x181 USDC png landed
   inside a 24px clipped circle and you saw one magnified corner — which reads exactly like a broken
   placeholder. Desktop's .mp-asset-ico had the sizing; mobile did not. Cover both. */
.mp-asset-ico img,.mpm-asset-ico img{width:100%;height:100%;object-fit:cover;display:block;border-radius:50%}
.mpm-asset-ico{overflow:hidden;display:inline-flex;align-items:center;justify-content:center}

/* Trailing explorer arrow on a phone transaction row (desktop has one per table row). */
.tx-item .lx-txext{flex-shrink:0;margin-left:8px;align-self:center;color:var(--text-muted);display:inline-flex;
  align-items:center;justify-content:center;width:26px;height:26px;border-radius:7px;text-decoration:none}
/* identicon fills the icon slot edge to edge; the design tints that slot per type, which would show
   through the identicon's transparent corners */
.tx-item .tx-icon.lx-txident{background:none!important;padding:0!important;overflow:hidden;border-radius:50%}
.tx-item .tx-icon.lx-txident svg{display:block;width:100%;height:100%}
.tx-item .lx-txext:active{background:var(--surface-2);color:var(--accent)}
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
  // HOST FALLBACK, per GUARDRAILS E12. Same gap the Trade-asset layer had, same symptom: Horizon allows
  // 100 requests per 5 minutes PER IP, this page spends a large share of that on one load, and once the
  // budget is gone every call fails. The page then shows "Couldn't load this pool from Horizon" and sits
  // through its retry loop for ten seconds or more -- all of it self-inflicted, and all of it invisible as
  // a rate limit because Horizon's 429 carries no CORS header, so the browser only ever reports a dead
  // fetch. Reported from a real session, not a lab.
  //
  // The null-on-failure contract the rest of this file depends on is preserved exactly: callers still see
  // null and their existing retries still key on it. A readable 4xx (no such pool) is a real answer and is
  // NOT re-asked against the second host.
  var H2="https://horizon.stellar.lobstr.co";
  function getJSON(u){
    function once(url){ return fetch(url).then(function(r){
      if(r.ok)return r.json();
      var e=new Error("HTTP"+r.status); e.__st=r.status; throw e; }); }
    return once(u).catch(function(e){
      var st=(e&&e.__st)||0;
      if(st>=400&&st<500&&st!==429)return null;              // a real "no", not a busy network
      if(u.indexOf(H)!==0)return null;                        // not a Horizon call: nothing to fall back to
      return once(H2+u.slice(H.length)).catch(function(){ return null; });
    });
  }
  function myAddr(){try{var a=localStorage.getItem("lumos.address")||"";return /^G[A-Z2-7]{55}$/.test(a)?a:"";}catch(e){return "";}}
  function gcolor(s){return GRAD[ghash(s)%GRAD.length];}
  function launchIcon(code,issuer){ try{ var m=JSON.parse(localStorage.getItem("lumos.launch.icons")||"{}"); var v=m[code+"-"+issuer]; return (v&&typeof v==="object")?(v.image||""):(v||""); }catch(e){ return ""; } }
  // The token-icon registry we publish at /assets/tokens/launchpad-icons.json -- the same record the
  // stellar.toml is built from, so a LumosCore asset shows the SAME logo here as it does in a wallet.
  // Read from our own origin, so it needs neither the toml round trip nor any third party.
  // window.__lxTokenRegistry is baked into <head> at build time, so this is known on the FIRST paint and the letter avatar is never drawn for a token we have. The fetch stays only as a refresh for a page left open across a deploy.
  var _amMan=(function(){ try{ return window.__lxTokenRegistry||null; }catch(e){ return null; } })(), _amManGo=0;
  function amManifest(){
    if(_amManGo)return; _amManGo=1;
    fetch("/assets/tokens/launchpad-icons.json").then(function(r){ return r.ok?r.json():null; }).then(function(m){
      if(!m||typeof m!=="object"||m.constructor===Array)return;
      _amMan=m;
      try{ healLogos(); }catch(_e){}                            // rows already drawn -> repaint them
    }).catch(function(){});
  }
  function manIcon(code,issuer){
    if(!_amMan)return "";
    var v=_amMan[code+"-"+issuer]; var u=(v&&typeof v==="object")?v.image:v;
    // same-origin absolute path only, so one bad write cannot repoint every icon at another host
    return (typeof u==="string"&&u.charAt(0)==="/"&&u.indexOf("//")!==0)?u:"";
  }
  amManifest();
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
  // Same pair of icons, mobile class names. The card CSS positions ".pair-icons .a/.b"; icoPair emits the
  // desktop "pa/pb", which nothing on the phone styles, so the icons rendered as zero-size invisible divs.
  // Built through ico1 like the desktop pair, so logo resolution and the data-lxc opt-out are identical.
  // BOTH class sets on purpose. The phone card CSS positions ".pair-icons .a/.b"; the layer's own rule
  // that actually paints the logo is scoped to ".pair-icons .pa.lx-ico/.pb.lx-ico". With only the mobile
  // names the icons had the right 32x32 box and no image in it.
  function icoPairM(code,issuer){ var up=amTokUrl(code,issuer);
    var tok= up ? ico1("a pa","url("+up+")",null,code,issuer)
                : ico1("a pa",gcolor(code),(code&&code[0]?code[0]:"?").toUpperCase(),code,issuer);
    var xlm=ico1("b pb","url(/assets/tokens/xlm.png)",null);
    return '<div class="pair-icons" data-paired="1">'+tok+xlm+'</div>'; }
  function icoPair(code,issuer){ var up=amTokUrl(code,issuer); var tok= up ? ico1('pa','url('+up+')',null,code,issuer) : ico1('pa',gcolor(code),(code&&code[0]?code[0]:"?").toUpperCase(),code,issuer); var xlm=ico1('pb','url(/assets/tokens/xlm.png)',null); return '<div class="pair-icons" data-paired="1">'+tok+xlm+'</div>'; }

  // build a pool object from a raw Horizon /liquidity_pools/{id} record (for the user's positions
  // that aren't in the KNOWN launchpad set, so Pools "My Positions" matches the wallet's Liq Pools tab)
  function poolFromRec(p){ var xlm=0,tok=0,code="?",issuer="";
    var rs=(p.reserves||[]).map(function(rv){ var nat=rv.asset==="native"; var sp=nat?["XLM",""]:String(rv.asset).split(":"); return {code:nat?"XLM":sp[0],issuer:nat?"":(sp[1]||""),amount:+rv.amount,native:nat}; });
    rs.forEach(function(rv){ if(rv.native)xlm=rv.amount; else { tok=rv.amount; code=rv.code; issuer=rv.issuer; } });
    return {code:code,issuer:issuer,id:p.id,xlm:xlm,tok:tok,a0:rs[0]||null,a1:rs[1]||null,nonXlm:xlm===0,shares:+p.total_shares,fee:(p.fee_bp||30)/100,trustlines:+(p.total_trustlines||0)}; }
  // generic pair icon (both sides real logos) — for non-XLM pools like AQUA/EURC. Reuses amTokUrl (known map + stellar.expert cache).
  function assetIcoBg(a){ if(!a)return null; if(a.native||a.code==="XLM")return "url(/assets/tokens/xlm.png)"; var u=amTokUrl(a.code,a.issuer); return u?("url("+u+")"):null; }
  // mob=true adds the phone's class names alongside the desktop ones — the SAME trap icoPairM documents:
  // the card CSS positions ".pair-icons .a/.b" while the rule that paints the logo is scoped to
  // ".pair-icons .pa.lx-ico/.pb.lx-ico", so both sets are required or the icons have a box with no image
  // (or no box at all). My Pools is mostly non-XLM pairs, which come through here, so on the phone those
  // cards showed no logos at all.
  function icoPairG(a0,a1,mob){ var b0=assetIcoBg(a0),b1=assetIcoBg(a1);
    var c0=mob?"a pa":"pa", c1=mob?"b pb":"pb";
    var e0=b0?ico1(c0,b0,null,a0.code,a0.issuer):ico1(c0,gcolor(a0.code),(a0.code&&a0.code[0]?a0.code[0]:"?").toUpperCase(),a0.code,a0.issuer);
    var e1=b1?ico1(c1,b1,null,a1.code,a1.issuer):ico1(c1,gcolor(a1.code),(a1.code&&a1.code[0]?a1.code[0]:"?").toUpperCase(),a1.code,a1.issuer);
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
      // ANY non-zero balance counts. The old >0.001 dust cut is exactly why this page disagreed with
      // the wallet: an XLM/LUMOS position of 0.0000715 LP tokens is a real position that Horizon
      // reports and the wallet lists, so hiding it showed "My Pools 8" against "Liq Pools 9".
      // A held position is a held position — it is still owned and still withdrawable.
      var extraIds=[]; for(var _id in myShares){ if(myShares[_id]>0&&!haveIds[_id])extraIds.push(_id); }
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
      // NET is the whole Stellar network (see /lxapi/poolstats). Until it lands \u2014 or if it fails \u2014 fall
      // back to the LumosCore-only totals, which are at least real, rather than showing nothing.
      var N=window.__lxNet, xu=DATA.xlmUsd||0;
      if(/liquidity/.test(ic)){
        if(N&&N.tvlXlm>0){ if(val){setText(val,num(N.tvlXlm)+" XLM");snapDone(val);} setMonies(N.tvlXlm*xu); }
        else { if(val){setText(val,num(DATA.totLiqXlm)+" XLM");snapDone(val);} setMonies(DATA.totLiqUsd); }
        if(subL)setText(subL,N?"Across all Stellar pools":"Across all pools"); }
      else if(/pools/.test(ic)){
        // The network count comes from a separate (rate-limited) probe, so it can be missing while the
        // rest of NET is present. Never let that silently put a LumosCore number under a network panel —
        // if we fall back, the caption says whose count it is.
        var netN=N&&N.pools;
        if(val){setText(val,num(netN||DATA.activePools));snapDone(val);}
        if(subL){ subL.style.display=""; subL.classList.remove("up");
          setText(subL,netN?"Liquidity pools on Stellar":"Listed on LumosCore"); } }
      else if(/volume/.test(ic)){
        if(N){ if(val){setText(val,usd(N.vol24Usd));snapDone(val);} if(subL)setText(subL,(xu>0?num(N.vol24Usd/xu)+" XLM":"Swapped")+" (24h)"); }
        else if(!volReady()){ if(val)setText(val,"\u2014"); if(subL)setText(subL,"Swapped (24h)"); }
        else { if(val){setText(val,num(DATA.totVolXlm)+" XLM");snapDone(val);} setMonies(DATA.totVolUsd); if(subL)setText(subL,"Swapped (24h)"); } }
      else if(/participant/.test(ic)){
        // NET counts LP POSITIONS, not wallets: a wallet in three pools is counted three times. Say that
        // rather than relabelling it "unique", which would be false.
        if(N&&N.lpAccounts){ if(val){setText(val,num(N.lpAccounts));snapDone(val);} if(subL)setText(subL,"LP positions network-wide"); }
        else { if(val){setText(val,num(DATA.participants));snapDone(val);} if(subL)setText(subL,"Unique LP wallets"); } }
      else if(/fees/.test(ic)){
        if(N){ if(val){setText(val,usd(N.fees24Usd));snapDone(val);} if(subL)setText(subL,"Across all Stellar pools"); return; }
        if(!volReady()){ if(val)setText(val,"\u2014"); if(subL)setText(subL,"Across all pools"); return; }
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
  // MOBILE all-pools list. The phone layout is a stack of .pool-card ANCHORS in #panelAll, not a table
  // body, so the desktop <tr> builder has nowhere to go and the design's own cards survived — CELL / XLM
  // and friends, Aptos tokens on a Stellar AMM.
  //
  // The href matters as much as the data. Every mock card pointed at the bare filename
  // "lumoscore-amm-pool-mobile.html" with no pool on it, and from the clean url /pools/stellar that
  // resolves to /pools/lumoscore-amm-pool-mobile.html — which routes straight back to the list. That is
  // why tapping a pool "refreshed" the page. detailUrl() builds the real per-pool url the desktop rows
  // navigate to, so the card is a plain working link.
  function allCard(p,i){
    var idx=(i+1<10?"0":"")+(i+1);
    var _xu=(DATA&&DATA.xlmUsd)||0;
    var volCell=(p.vol24Xlm==null)?'<div class="v">\\u2014</div>'
      :('<div class="v">'+qty(p.vol24Xlm)+'</div><div class="vs">'+usd(p.vol24Xlm*_xu)+'</div>');
    return '<a class="pool-card lx-ammcard" data-pool="'+p.id+'"'+pairAttr(p)+' href="'+detailUrl(p.id,null,pairVal(p))+'">'
      +'<div class="pc-head">'+icoPairM(p.code,p.issuer)
      +'<div class="pc-info"><div class="pc-name">'+esc(p.code)+' / XLM</div>'
      +'<div class="pc-sub">'+p.fee+'% fee \\u00b7 Stellar AMM</div></div>'
      +'<div class="pc-idx">#'+idx+'</div></div>'
      +'<div class="pc-stats">'
      +'<div class="pc-stat"><div class="l">Liquidity</div><div class="v">'+qty(p.xlm)+' XLM</div>'
      +'<div class="vs">'+usd(p.tvlUsd)+'</div></div>'
      +'<div class="pc-stat"><div class="l">24h Vol</div>'+volCell+'</div>'
      +'<div class="pc-stat"><div class="l">Members</div><div class="v">'+num(p.trustlines)+'</div></div>'
      +'</div></a>';
  }
  // MOBILE "My Pools". Same problem as the all-pools list, in a different panel: the phone ships
  // #panelMine holding one baked LUMOS/APT card, and the tab wiring only ever knew the desktop panel ids
  // (#lx-mypanel / #panelAllPools / #panelMyPositions), none of which exist here. So tapping My Pools
  // either showed nothing or showed the mock. Render the real positions as the same .pool-card the
  // all-pools list uses, so both panels look and behave alike.
  function myCard(p){
    // Mirror myRow exactly. Two things bite here: the user's share is p.mineFrac (myFrac is the DETAIL
    // page's field — reading it made every card say "0 XLM"), and a position can be in a pool with NO
    // XLM leg, which must show both real assets rather than being labelled "… / XLM".
    var f=p.mineFrac||0, nonX=p.nonXlm&&p.a0&&p.a1;
    var pct=(f*100>=0.01?(f*100).toFixed(2):"<0.01")+"%";
    var name=nonX?(esc(p.a0.code)+" / "+esc(p.a1.code)):(esc(p.code)+" / XLM");
    var ico=nonX?icoPairG(p.a0,p.a1,true):icoPairM(p.code,p.issuer);
    var l1,v1,vs1,l2,v2;
    if(nonX){ l1=esc(p.a0.code); v1=qty(p.a0.amount*f); vs1=""; l2=esc(p.a1.code); v2=qty(p.a1.amount*f); }
    else { l1="Your liquidity"; v1=qty(p.xlm*f)+" XLM"; vs1=usd(p.tvlUsd*f); l2=esc(p.code); v2=qty((p.tok||0)*f); }
    // the detail page is X/XLM only, so a non-XLM position opens on the explorer instead (same as desktop)
    var href=nonX?("https://stellar.expert/explorer/public/liquidity-pool/"+p.id):detailUrl(p.id,null,pairVal(p));
    return '<a class="pool-card my-pos lx-ammcard lx-mycard" data-pool="'+p.id+'"'+pairAttr(p)+(nonX?' data-nonxlm="1" target="_blank" rel="noopener"':'')+' href="'+href+'">'
      +'<div class="pc-head">'+ico
      +'<div class="pc-info"><div class="pc-name">'+name+'</div>'
      +'<div class="pc-sub">'+p.fee+'% fee \\u00b7 Stellar AMM</div></div></div>'
      +'<div class="pc-stats">'
      +'<div class="pc-stat"><div class="l">'+l1+'</div><div class="v">'+v1+'</div>'+(vs1?'<div class="vs">'+vs1+'</div>':'')+'</div>'
      +'<div class="pc-stat"><div class="l">Pool share</div><div class="v">'+pct+'</div></div>'
      +'<div class="pc-stat"><div class="l">'+l2+'</div><div class="v">'+v2+'</div></div>'
      +'</div></a>';
  }
  function fillMyPosMobile(){
    var box=q("#panelMine"); if(!box||!DATA)return false;
    var mine=DATA.mine||[];
    var want=mine.length||1;
    if(box.querySelectorAll(".lx-mycard,.lx-myempty").length===want&&box.__lxMineN===want)return true;
    box.__lxMineN=want;
    box.innerHTML=mine.length?mine.map(myCard).join("")
      :('<div class="lx-myempty" style="text-align:center;color:var(--text-muted);padding:26px 14px;font-size:13px">'
        +(myAddr()?"You have no liquidity in any Stellar pool yet.":"Connect your wallet to see your pools.")+"</div>");
    return true;
  }
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
    loadNet();          // and start the network-wide numbers the overview actually describes
  }
  // Whole-network AMM figures for Market Overview. Stellar has ~40,000 liquidity pools, far too many for a
  // phone to enumerate (~3MB per 2,600), so /lxapi/poolstats aggregates them at the edge and returns a few
  // hundred bytes. Cached for 10 minutes there and reused from sessionStorage here.
  // Purely additive: if it fails, paintSnapshot keeps the LumosCore-only totals.
  function loadNet(){
    if(window.__lxNetP)return; window.__lxNetP=1;
    try{ var c=JSON.parse(sessionStorage.getItem("lumos.netpools")||"null");
      if(c&&c.ts&&Date.now()-c.ts<600000&&c.tvlXlm>0){ window.__lxNet=c; try{paintSnapshot();}catch(_){} return; } }catch(_){}
    getJSON("/lxapi/poolstats").then(function(d){
      if(!d||d.error||!(d.tvlXlm>0))return;
      window.__lxNet=d;
      try{ sessionStorage.setItem("lumos.netpools",JSON.stringify(d)); }catch(_){}
      try{ paintSnapshot(); }catch(_){}
    }).catch(function(){});
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
    if(!q("#panelMine"))buildMyPanel();   // desktop only: the phone already has a My Pools panel to fill
    function apply(){ var mineActive=!!window.__lxMine;    // our own click flag — NOT the design's unreliable .active
      // Mobile uses #panelAll / #panelMine and has none of the desktop panels, so the desktop-only branch
      // below left the phone showing its baked "LUMOS / APT" position card under My Pools.
      var mAll=q("#panelAll"), mMine=q("#panelMine");
      if(mAll&&mMine){
        fillMyPosMobile();
        mAll.style.display=mineActive?"none":"";
        mMine.style.display=mineActive?"":"none";
        var srch=q(".search-box.inline-filter"); if(srch)srch.style.display=mineActive?"none":"";
        return;
      }
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
  // Column sorting is OFF while the network list is up, and the headers say so rather than looking
  // clickable and doing nothing. The old sort reordered DATA.pools, all five of them, in memory. Applied
  // to the network list it could only reorder the 25 rows on screen out of 10,962 -- a "sort by members"
  // that silently means "sort these 25 by members" is worse than no sort, because the top of the list
  // would look authoritative and be wrong. Real column sorting needs the ranking rebuilt server-side per
  // column; until then the list is ranked by TVL and the Liquidity header carries the arrow to show it.
  function deadSort(){
    var t=poolsTable(); if(!t)return;
    [].slice.call(t.querySelectorAll("thead th")).forEach(function(th){
      th.removeAttribute("data-lxsortable"); th.__lxsortf=null;
      th.style.cursor="default";
      setGlyph(th, /liquidity/i.test(th.textContent) ? "\\u2193" : "");
    });
    netRelabelVol();
  }
  // The list's volume is NOT 24 hours, so the header must not say it is.
  //
  // It comes from stellar.expert's volume_value["1d"], and that field is the CURRENT UTC DAY SO FAR, not
  // a rolling window. Verified against the ledger on SSLX/XLM at 00:35Z: trades since UTC midnight summed
  // to 267.34 XLM, upstream reported 266.31. So just after midnight the column reads near zero and only
  // approaches a real day by 23:59Z -- which is exactly why a card said $82 while the pool's own page
  // said $45, and both were under the true 24h figure of $1,290.
  //
  // A true rolling 24h per row is ~11 Horizon requests PER POOL (see volDeepen), which is affordable for
  // one pool page and not for 25 rows of 10,962. Until that is precomputed server-side, the honest move
  // is to label the number for the window it actually covers.
  function netRelabelVol(){
    var t=poolsTable();
    if(t) [].slice.call(t.querySelectorAll("thead th")).forEach(function(th){
      if(th.__lxvol)return;
      // Fees carries the same window as the volume it is computed from (vol x fee%), so it is relabelled
      // with it. Leaving it at "Fees (24h)" beside "Vol (today)" would just move the wrong claim one
      // column across.
      var vol=/24h\\s*vol/i.test(th.textContent), fee=/fees\\s*\\(24h\\)/i.test(th.textContent);
      if(!vol&&!fee)return;
      th.__lxvol=1;
      var s=th.querySelector(".sort-i");
      th.textContent=vol?"VOL (TODAY)":"FEES (TODAY)"; if(s)th.appendChild(s);
    });
    qa(".lx-netcard .pc-stat .l").forEach(function(l){
      if(/24h\\s*vol/i.test(l.textContent))setText(l,"Vol (today)");
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
  // ---- NETWORK POOL LIST -------------------------------------------------------------------------
  // "All Pools" used to be the five curated KNOWN pools. This renders the whole network instead, 25 at a
  // time, ranked by real USD TVL, off /lxapi/pools.
  //
  // The ranking is NOT computed here and must not be: it is 10,962 priceable pools out of 39,844, which
  // is 57 Horizon requests and ~15s against a browser budget of 100 requests per 5 minutes per IP. The
  // endpoint does it once and caches; the page asks for one page at a time and gets a few KB.
  //
  // My Positions is deliberately untouched and still comes from DATA. It is a different question (which
  // pools is THIS wallet in), it is already correct, and routing it through a network ranking would only
  // put it at risk.
  var NETPP=25;
  var NET={page:1,q:"",rows:null,total:0,pages:1,busy:0,err:"",ranked:0,unpriceable:0,seq:0,warm:0};
  function netActive(){ return !!(q("#poolsBody")||q("#panelAll")); }
  function netFetch(){
    if(NET.busy)return; NET.busy=1;
    var mySeq=++NET.seq;                       // a later request always wins; see the flapping note below
    var u="/lxapi/pools?per="+NETPP+"&page="+NET.page+(NET.q?("&q="+encodeURIComponent(NET.q)):"");
    fetch(u).then(function(r){ if(!r.ok)throw new Error("HTTP "+r.status); return r.json(); })
    .then(function(d){
      if(mySeq!==NET.seq)return;               // a newer query already answered; discard this one
      if(!d||d.error)throw new Error((d&&d.error)||"bad payload");
      // The ranking is built across several requests (the endpoint has a per-invocation upstream budget).
      // Until it is complete it reports warming rather than serving half a ranking -- half an
      // enumeration sorted by TVL is not a shorter list, it is one with real pools missing from the
      // middle. Show progress and come back for it.
      if(d.warming){ NET.warm=+d.scanned||0; NET.busy=0; paintNet();
        setTimeout(function(){ if(mySeq===NET.seq)netFetch(); },1500); return; }
      NET.warm=0;
      NET.rows=d.rows||[]; NET.total=+d.total||0; NET.pages=Math.max(1,+d.pages||1);
      NET.page=Math.max(1,+d.page||1); NET.ranked=+d.ranked||0; NET.unpriceable=+d.unpriceable||0;
      NET.err=""; NET.busy=0; paintNet();
    }).catch(function(e){
      if(mySeq!==NET.seq){ NET.busy=0; return; }
      // Keep whatever is already on screen. The pools SEARCH bug was exactly this: an error branch that
      // painted itself over rows that had already arrived, so results appeared and then vanished.
      NET.err=String((e&&e.message)||e); NET.busy=0; paintNet();
    });
  }
  // A pool of two arbitrary assets. The KNOWN list was always CODE/XLM so allRow could hardcode that;
  // across the network most pairs are not, and 880 ranked pools have no XLM leg at all.
  // img comes from the endpoint. The page cannot resolve these itself: amTokUrl() reads a static map
  // keyed by asset CODE, which knows the curated handful and nothing else, so network pairs fell back to
  // coloured letter tiles. It is carried per leg and keyed by CODE-ISSUER upstream, because a ticker is
  // not an identity on Stellar.
  function netLegs(p){
    var a=p.a||{code:"?"},b=p.b||{code:"?"};
    var la={code:a.code,issuer:a.issuer,native:a.code==="XLM"&&!a.issuer,amount:+a.amount||0,img:a.img||""};
    var lb={code:b.code,issuer:b.issuer,native:b.code==="XLM"&&!b.issuer,amount:+b.amount||0,img:b.img||""};
    return [la,lb];
  }
  // icoPairG resolves through amTokUrl, which does not know these assets. Seed what the endpoint sent
  // into the same cache amTokUrl reads, so the shared logo path (and healLogos) sees a real URL.
  function netSeedLogos(rows){
    try{ var m=(window.__lxLogos=window.__lxLogos||{});
      (rows||[]).forEach(function(p){ [p.a,p.b].forEach(function(a){
        if(a&&a.img&&a.code&&!m[a.code])m[a.code]=a.img; }); });
    }catch(_){}
  }
  // Same shape as icoPairG, but prefers the URL the endpoint sent for THIS leg over a code-keyed
  // lookup. Falls back to icoPairG's path (and then a coloured letter tile) when there is no image.
  function netIcoBg(a){
    if(!a)return null;
    if(a.native||a.code==="XLM")return "url(/assets/tokens/xlm.png)";
    if(a.img)return "url("+a.img+")";
    var u=amTokUrl(a.code,a.issuer); return u?("url("+u+")"):null;
  }
  function netIcoPair(a0,a1,mob){
    var b0=netIcoBg(a0),b1=netIcoBg(a1);
    var c0=mob?"a pa":"pa", c1=mob?"b pb":"pb";
    var e0=b0?ico1(c0,b0,null,a0.code,a0.issuer):ico1(c0,gcolor(a0.code),(a0.code&&a0.code[0]?a0.code[0]:"?").toUpperCase(),a0.code,a0.issuer);
    var e1=b1?ico1(c1,b1,null,a1.code,a1.issuer):ico1(c1,gcolor(a1.code),(a1.code&&a1.code[0]?a1.code[0]:"?").toUpperCase(),a1.code,a1.issuer);
    return '<div class="pair-icons" data-paired="1">'+e0+e1+'</div>';
  }
  // BOTH reserves under the dollar figure, not one.
  //
  // It showed a single leg, which made the card look wrong rather than incomplete: the headline is the
  // value of the WHOLE pool (both sides), while the line under it was half of it. "$4.24M" over
  // "13.35M XLM" does not reconcile -- 13.35M XLM is about $2.09M -- so a reader checking the arithmetic
  // concludes the number is broken. Showing both sides makes the headline add up in front of them.
  function netLiq(p){
    var L=netLegs(p);
    var a=L[0], b=L[1];
    if(!b||!b.code) return qty(a.amount)+" "+esc(a.code);
    return qty(a.amount)+" "+esc(a.code)+" + "+qty(b.amount)+" "+esc(b.code);
  }
  // EVERY pool opens on our own detail page, including the 880 ranked pools with no XLM leg.
  //
  // This used to send those to stellar.expert, on the belief that the detail page was built around an
  // X/XLM pair -- a rule copied from myRow/myCard without checking whether it was still true. It is not.
  // The detail page is loaded by pool ID and reads the pool's OWN reserves; chPair() was taught to build
  // its chart query from any base/counter precisely so two credit assets work.
  //
  // Verified on USDC/XTAR (e04397d3...), a pool with no XLM leg: title "USDC / XTAR liquidity pool on
  // Stellar", liquidity "5,611 USDC + 1,190,438,276 XTAR = $11.2K", 24h volume and fees in USDC, chart
  // drawn, "Showing 1-20 of 100 transactions", 20 participants. Nothing about it needed an XLM leg.
  //
  // Sending a user off-site to read a pool we render perfectly well was the bug.
  function netHref(p){ return detailUrl(p.id,null,null); }
  function netFees(p){ return (p.vol24==null)?null:(p.vol24*(+p.fee||0)/100); }
  function netRow(p,i){
    var L=netLegs(p), n=(NET.page-1)*NETPP+i+1, idx=(n<10?"0":"")+n;
    var f=netFees(p);
    var volCell=(p.vol24==null)?'<td><div>&mdash;</div></td><td><div>&mdash;</div></td>'
      :('<td><div>'+usd(p.vol24)+'</div></td><td><div>'+usd(f)+'</div></td>');
    // DOLLARS on top, the reserve underneath. The list is ranked by USD TVL, so the dollar figure has to
    // be the one the eye follows down the column -- with the asset amount leading, the ranking looked
    // wrong wherever the units changed (a USDC-leg pool's reserve is not comparable to an XLM one's).
    return '<tr class="lx-ammrow lx-netrow" data-pool="'+p.id+'" data-href="'+netHref(p)+'" style="cursor:pointer">'+
      '<td class="idx">'+idx+'</td>'+
      // No fee-tier sub line. Every Stellar AMM pool is 0.3% and every pool in this list is a Stellar AMM
      // pool, so it carried no information and invited the question it could not answer: a reader seeing
      // "0.3% fee" beside a pool reasonably asks what THEY are being charged, when it is the pool's own
      // swap fee paid to its own LPs. The fee tier is still stated on the pool page, where there is room
      // to say whose fee it is.
      '<td><div class="pair-cell">'+netIcoPair(L[0],L[1])+'<div><div class="pair-name">'+esc(L[0].code)+' / '+esc(L[1].code)+'</div>'+
      '</div></div></td>'+
      // tvl null = we cannot VALUE this pool (neither leg is XLM or Circle USDC), which is not the same
      // claim as "it holds nothing". usd(null) renders "$0" and would state the second. Dash, and the
      // reserve underneath still says what is actually in there.
      '<td><div>'+(p.tvl==null?'&mdash;':usd(p.tvl))+'</div><div class="pair-sub">'+netLiq(p)+'</div></td>'+
      volCell+
      '<td>'+num(p.members)+'</td></tr>';
  }
  function netCard(p,i){
    var L=netLegs(p), n=(NET.page-1)*NETPP+i+1, idx=(n<10?"0":"")+n;
    var volCell=(p.vol24==null)?'<div class="v">&mdash;</div>':('<div class="v">'+usd(p.vol24)+'</div>');
    return '<a class="pool-card lx-ammcard lx-netcard" data-pool="'+p.id+'" href="'+netHref(p)+'">'+
      '<div class="pc-head">'+netIcoPair(L[0],L[1],true)+
      '<div class="pc-info"><div class="pc-name">'+esc(L[0].code)+' / '+esc(L[1].code)+'</div>'+
      '</div>'+                                   // no fee-tier sub line -- see netRow for why
      '<div class="pc-idx">#'+idx+'</div></div>'+
      '<div class="pc-stats">'+
      '<div class="pc-stat"><div class="l">Liquidity</div><div class="v">'+(p.tvl==null?'&mdash;':usd(p.tvl))+'</div><div class="vs">'+netLiq(p)+'</div></div>'+
      '<div class="pc-stat"><div class="l">24h Vol</div>'+volCell+'</div>'+
      '<div class="pc-stat"><div class="l">Members</div><div class="v">'+num(p.members)+'</div></div>'+
      '</div></a>';
  }
  function netFootHtml(){
    var start=(NET.page-1)*NETPP+1, end=Math.min(NET.page*NETPP,NET.total);
    var info=NET.total?("Showing "+num(start)+"\\u2013"+num(end)+" of "+num(NET.total)+" pools"):"No pools";
    return '<div class="lx-netpag-i">'+info+'</div>'+
      '<div class="lx-netpag-c">'+
      '<button type="button" data-np="first"'+(NET.page<=1?" disabled":"")+'>\\u00ab First</button>'+
      '<button type="button" data-np="prev"'+(NET.page<=1?" disabled":"")+'>\\u2039 Prev</button>'+
      '<span class="lx-netpag-m">Page '+num(NET.page)+' of '+num(NET.pages)+'</span>'+
      '<button type="button" data-np="next"'+(NET.page>=NET.pages?" disabled":"")+'>Next \\u203a</button>'+
      '<button type="button" data-np="last"'+(NET.page>=NET.pages?" disabled":"")+'>Last \\u00bb</button>'+
      '</div>';
  }
  function paintNet(){
    if(!netActive())return;
    var rows=NET.rows;
    // Nothing has arrived yet AND nothing failed AND we are not warming: leave the page alone rather
    // than flashing an empty table over the skeleton.
    if(!rows&&!NET.err&&!NET.warm)return;
    if(rows)netSeedLogos(rows);
    var body=q("#poolsBody"), mob=body?null:q("#panelAll");
    var empty=NET.err
      ? '<b>Could not load pools</b>'+esc(NET.err)
      : NET.warm
        ? '<b>Ranking the network\\u2019s pools\\u2026</b>'+num(NET.warm)+' scanned so far. This runs once, then it is instant.'
        : (NET.q?'<b>No pools match \\u201c'+esc(NET.q)+'\\u201d</b>Try an asset code, e.g. USDC.':'<b>No pools</b>');
    if(body){
      var sig="net|"+NET.page+"|"+NET.q+"|"+(rows?rows.length:-1)+"|"+NET.err+"|"+NET.warm;
      if(body.getAttribute("data-lxsig")!==sig){
        body.innerHTML=(rows&&rows.length)?rows.map(netRow).join("")
          :'<tr class="lx-ammrow"><td colspan="6"><div class="lx-amm-empty">'+empty+'</div></td></tr>';
        body.setAttribute("data-lxsig",sig);
        try{ healLogos(); }catch(_){}
      }
    }
    if(mob){
      var msig="net|"+NET.page+"|"+NET.q+"|"+(rows?rows.length:-1)+"|"+NET.err+"|"+NET.warm;
      if(mob.getAttribute("data-lxsig")!==msig){
        mob.innerHTML=(rows&&rows.length)?rows.map(netCard).join("")
          :'<div class="lx-amm-empty">'+empty+'</div>';
        mob.setAttribute("data-lxsig",msig);
        try{ healLogos(); }catch(_){}
      }
    }
    // The All Pools tab count is the whole ranked network, not the 25 on screen.
    var allc=q("#poolTabs button[data-tab=all] .count")||q("#poolTabs .count");
    if(allc){ setText(allc,num(NET.total)); snapDone(allc); }
    // Footer. The design ships #paginationAll with a static "1-10 of 100"; replace its contents wholesale
    // so there is exactly one pager, rather than updating its strongs and leaving dead controls beside.
    var pag=q("#paginationAll");
    if(!pag&&mob){ pag=q(".lx-netpag-host");
      if(!pag){ pag=document.createElement("div"); pag.className="lx-netpag-host"; mob.parentNode.insertBefore(pag,mob.nextSibling); } }
    if(pag){
      pag.classList.add("lx-netpag");
      var fsig=NET.page+"|"+NET.pages+"|"+NET.total;
      if(pag.getAttribute("data-lxpsig")!==fsig){ pag.innerHTML=netFootHtml(); pag.setAttribute("data-lxpsig",fsig); }
      // Only ever un-hide the pager while the All Pools panel is the one showing. A repaint that landed
      // while My Pools was open would otherwise drag the All Pools footer back under the positions list.
      var allPanel=q("#panelAllPools");
      var allShown=!allPanel||getComputedStyle(allPanel).display!=="none";
      if(allShown) pag.style.display=(NET.total>NETPP)?"flex":"none";
    }
    // Mobile cards are rebuilt on every page change, so the label has to be reapplied here.
    // deadSort runs from here too, NOT only from paintTables: paintTables returns early until DATA
    // arrives (a wallet-side fetch this list does not depend on), so on a cold load the headers kept
    // their sort arrows and their pointer cursor while nothing was listening for the click. My earlier
    // check for that was worthless -- it counted th[data-lxsortable], which is the attribute wireSort
    // ADDS, so "0 left" meant "never wired", not "successfully disabled".
    try{ deadSort(); netRelabelVol(); }catch(_){}
    // The list is on screen now (rows, warming notice, or error) -- safe to lift the mask.
    try{ reveal(); }catch(_){}
  }
  function netGo(p){
    p=Math.max(1,Math.min(NET.pages,p));
    if(p===NET.page&&NET.rows)return;
    NET.page=p; NET.rows=null; NET.err="";
    // Repaint the pager immediately so the click is acknowledged, then fetch.
    var pag=q("#paginationAll")||q(".lx-netpag-host");
    if(pag){ pag.innerHTML=netFootHtml(); pag.setAttribute("data-lxpsig",NET.page+"|"+NET.pages+"|"+NET.total); }
    netFetch();
    try{ var t=q("#poolsBody")||q("#panelAll"); if(t&&t.scrollIntoView)t.scrollIntoView({block:"start"}); }catch(_){}
  }
  if(!window.__lxNetWired){ window.__lxNetWired=1;
    // Window capture, for the same reason doSort uses it: the design ships a document-level capture shim
    // that maps label text to pages, and document capture beats the target phase. A plain button handler
    // would be pre-empted and the click would navigate instead of paging.
    window.addEventListener("click",function(e){
      var t=e.target; if(!t||!t.closest)return;
      var b=t.closest("[data-np]");
      if(b){ e.preventDefault(); e.stopImmediatePropagation();
        var k=b.getAttribute("data-np");
        netGo(k==="first"?1:k==="last"?NET.pages:k==="prev"?NET.page-1:NET.page+1);
        return; }
      var row=t.closest(".lx-netrow");
      if(row&&row.getAttribute("data-href")){ e.preventDefault(); e.stopImmediatePropagation();
        location.href=row.getAttribute("data-href"); }
    },true);
  }
  // Search runs SERVER-side over all 10,962 ranked pools. Filtering the 25 on screen would search one
  // page of 439 and report "no pools" for anything not in the current slice.
  function netWireSearch(){
    var inp=null;
    qa("input").forEach(function(x){ if(!inp&&/search pool/i.test(x.getAttribute("placeholder")||""))inp=x; });
    if(!inp||inp.__lxnet)return; inp.__lxnet=1;
    var tmr=null;
    inp.addEventListener("input",function(){
      clearTimeout(tmr);
      tmr=setTimeout(function(){
        var v=(inp.value||"").trim().toUpperCase();
        if(v===NET.q)return;
        NET.q=v; NET.page=1; NET.rows=null; NET.err=""; netFetch();
      },260);
    });
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
    // The ALL POOLS list belongs to the network layer (paintNet) on this page. Both writing #poolsBody
    // would be the two-painters bug: whichever ran last would win, and the MutationObserver that drives
    // repaints would make them alternate. My Positions below is untouched and still comes from DATA.
    var _netOwns=netActive();
    if(!_netOwns && allBody && (!allBody.querySelector(".lx-ammrow") || allBody.getAttribute("data-lxsig")!==_tsig)){
      allBody.innerHTML=DATA.pools.length?sortedPools().map(allRow).join(""):'<tr class="lx-ammrow"><td colspan="6"><div class="lx-amm-empty"><b>No pools yet</b>Launch a token to create its first pool.</div></td></tr>';
      allBody.setAttribute("data-lxsig",_tsig);
      try{ healLogos(); }catch(_){}
    }
    // Mobile has no #poolsBody: its all-pools list is a stack of .pool-card anchors in #panelAll.
    var mobList=allBody?null:q("#panelAll");
    if(!_netOwns && mobList && (!mobList.querySelector(".lx-ammcard") || mobList.getAttribute("data-lxsig")!==_tsig)){
      mobList.innerHTML=DATA.pools.length?sortedPools().map(allCard).join("")
        :'<div class="lx-amm-empty"><b>No pools yet</b>Launch a token to create the first one.</div>';
      mobList.setAttribute("data-lxsig",_tsig);
      try{ healLogos(); }catch(_){}
    }
    if(!_netOwns) wireSort();
    else deadSort();
    // My Positions TAB panel (design's original tab layout, restored)
    fillMyPos();
    // tab counts: All Pools | My Positions. paintNet owns the All count when the network list is up --
    // DATA.pools is the curated handful and would read "5" over a 10,962-row list.
    if(!_netOwns){ var allc=q("#poolTabs button[data-tab=all] .count")||q("#poolTabs .count"); if(allc){setText(allc,String(DATA.pools.length));snapDone(allc);} }
    var minec=q("#poolTabs button[data-tab=mine] .count"); if(minec){setText(minec,String(DATA.mine.length));snapDone(minec);}
    renameMineTab();
    // pagination footer: real count, single page (design mock said "1-10 of 100")
    if(!_netOwns){ var pag=q("#paginationAll"); if(pag){ var st=pag.querySelectorAll("strong"); if(st[0])setText(st[0],(DATA.pools.length?"1":"0")+"\\u2013"+DATA.pools.length); if(st[1])setText(st[1],String(DATA.pools.length)); var pc=pag.querySelector(".page-controls"); if(pc)pc.style.display=DATA.pools.length>10?"":"none"; } }
    wireCreatePool();
  }
  // header/subtitle testnet wording
  function paintCopy(){
    qa("main p, .amm-hero p, .amm-sub").forEach(function(p){ if(/on Aptos.s on-chain AMM|Aptos.s on-chain/i.test(p.textContent)) p.textContent="Provide liquidity and earn fees on Stellar\\u2019s mainnet AMM pools."; });
  }

  function paint(){ paintSnapshot(); paintTables(); paintCopy(); try{ healLogos(); }catch(_){} }
  // On the pools LIST page the rows no longer come from load()/DATA -- they come from /lxapi/pools. So
  // revealing when DATA lands uncovers the design's baked mock rows and holds them on screen until the
  // ranked page arrives. That is what "why does it show like this before loading" was: not a loading
  // state, the template's fake pools. Hold the reveal until paintNet has actually written something,
  // including its error and empty states, which are also real answers.
  function reveal(){
    if(typeof netActive==="function"&&netActive()&&!NET.rows&&!NET.err&&!NET.warm)return;
    document.documentElement.classList.add("lx-ammready");
  }
  // poolFromRec normalises Horizon's reserves into a0/a1 ({code,issuer,native}) — there is no
  // .reserves on the record by the time a row is built.
  function urlSeg(x){ return (!x||x.native||x.code==="XLM") ? "native" : (x.code+"-"+x.issuer); }
  // TWO record shapes reach a row: wallet pools go through poolFromRec (a0/a1), while the curated
  // KNOWN list builds {code,issuer,...} directly and is always <code>/XLM.
  // The pair value on its own, so a link can be built from it directly instead of only ever being read
  // back off the rendered attribute. pairAttr stays the single caller for markup.
  function pairVal(p){ try{ if(!p)return "";
    var a,b;
    if(p.a0&&p.a1){ a=urlSeg(p.a0); b=urlSeg(p.a1); }
    else if(p.code&&p.issuer){ a="native"; b=p.code+"-"+p.issuer; }
    else return "";
    if(b==="native"){ var t=a; a=b; b=t; }   // native first = Stellar's canonical order = one url per pool
    if(a===b)return "";
    return a+"|"+b; }catch(e){ return ""; } }
  function pairAttr(p){ var v=pairVal(p); return v?(' data-pair="'+v+'"'):""; }
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
    // The mobile pool card IS an <a href>, so the handler above skips it by design (that exclusion exists so
    // real links like "View position" still work). The design's own nav shim then claims the click, maps the
    // href through its page table and lands back on the pools list — the "tapping a pool just refreshes"
    // report. WINDOW capture runs before that document-capture shim, so the card's own href wins. Same
    // ordering fix as the Trade rows.
    window.addEventListener("click",function(e){
      var c=e.target&&e.target.closest&&e.target.closest("a.lx-ammcard[href]"); if(!c)return;
      var h=c.getAttribute("href"); if(!h)return;
      e.preventDefault(); e.stopImmediatePropagation(); location.href=h;
    },true);
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
  // A Soroban contract id starts with C and is not an account -- Horizon 400s on /accounts/<C...>, so
  // our account page would always be empty for one. Link G addresses, tag C addresses.
  function isCtr(a){ return !!a && String(a).charAt(0)==="C"; }
  function acctHref(a){ return "/account/stellar/"+encodeURIComponent(a||""); }
  function walletCell(who,size,cls){
    var av='<div class="wallet-avatar">'+ident(who,size)+'</div>';
    var lbl='<span class="lx-waddr">'+ashort(who)+'</span>';
    if(isCtr(who))return '<span class="'+cls+' lx-nolink">'+av+lbl+'<span class="lx-sortag">Soroban</span></span>';
    return '<a class="'+cls+' lx-acct" href="'+acctHref(who)+'" style="color:inherit;text-decoration:none">'+av+lbl+'</a>';
  }
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
  var AMLOGOS={XLM:"/assets/tokens/xlm.png",AQUA:"/assets/tokens/aqua.png",USDC:"/assets/tokens/usdc.png",yUSDC:"/assets/tokens/usdc.png",EURC:"https://assets.coingecko.com/coins/images/26045/small/euro.png",yXLM:"https://assets.coingecko.com/coins/images/100/small/fmpFRHHQ_400x400.jpg",BLND:"/assets/tokens/blnd.svg",SHX:"/assets/tokens/shx.png",SSLX:"/assets/tokens/sslx.png"};
  // Registry first: it is keyed by CODE+ISSUER, where AMLOGOS and __lxLogos are keyed by CODE alone,
  // and a ticker is not an identity on Stellar. Everything after it is the previous behaviour.
  function amTokUrl(code,issuer){ return manIcon(code,issuer)||AMLOGOS[code]||launchIcon(code,issuer)||((window.__lxLogos||{})[code])||""; }
  function amFetchLogo(code,issuer,cb){ var u=amTokUrl(code,issuer); if(u){cb(u);return;} if(!code||!issuer){cb("");return;} getJSON("https://api.stellar.expert/explorer/public/asset?search="+encodeURIComponent(code)+"&limit=20").then(function(d){ var recs=(d&&d._embedded&&d._embedded.records)||[]; var m=recs.filter(function(rc){return (rc.asset||"").indexOf(code+"-"+issuer)===0;})[0]; var ti=(m&&(m.tomlInfo||m.toml_info))||{}; var img=ti.image||ti.orgLogo||""; if(img){AMLOGOS[code]=img;try{(window.__lxLogos=window.__lxLogos||{})[code]=img;}catch(_){}} cb(img||""); }).catch(function(){cb("");}); }
  function tokLogo(){ var c=(DET&&DET.code)||"", i=(DET&&DET.issuer)||""; var av=avatarUri(c); var u=amTokUrl(c,i)||av;
    return '<img class="lx-tokimg" data-lxc="'+esc(c)+'" data-lxi="'+esc(i)+'" src="'+u+'" alt="" onerror="this.onerror=null;this.src=\\x27'+av+'\\x27">'; }
  // data-lxc so the "is this icon already ours, and for THIS asset?" test in wrSide reads the same way for
  // the XLM side as for a credit asset. Without it that test never matched and the icon was rebuilt on
  // every repaint. healLogos ignores XLM, so tagging it costs nothing.
  function xlmLogo(){ return '<img class="lx-tokimg" data-lxc="XLM" src="/assets/tokens/xlm.png" alt="">'; }
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
          var t=chS("text",{"class":"lx-chload",x:String(chBox(svg).w/2),y:String(chBox(svg).h/2),"text-anchor":"middle","dominant-baseline":"middle",fill:"var(--text-muted,#8b90a0)","font-size":"13"});
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
    // The pool record got three chances; its auxiliaries got ONE, and getJSON turns any failure into null.
    // A throttled or blipped /trades therefore rendered as "this pool has had 1 transaction" (on a pool with
    // 100) and "24h Volume 0 XLM" — a failure wearing the costume of a fact. Same retry as the pool record.
    function tryJSON(u,n){ return getJSON(u).then(function(r){
      if(r||n<=0)return r;
      return new Promise(function(rs){ setTimeout(rs,700); }).then(function(){ return tryJSON(u,n-1); }); }); }
    // 24h volume is a SUM over the day's trades, and a busy day does not fit in one page. This fetched
    // limit=100 ONCE and summed whatever came back: on SSLX/XLM, which ran 2,114 trades in 24 hours, it
    // summed the newest 100 and reported 293 XLM against a true 8,272 -- a 28x undercount, printed as a
    // fact next to a fee figure derived from it.
    //
    // Still ONE request here, now 200 (Horizon's max), because this is on the critical path and the page
    // must not get slower. The rest of the day is walked in the background by volDeepen and the two cards
    // are corrected when it lands.
    var trP=tryJSON(H+"/liquidity_pools/"+hex+"/trades?order=desc&limit=200",2);
    // Deposits/withdrawals are RARE next to swaps: this pool runs ~600 path-payments for every 5 LP
    // operations, so a 50-record window held 3 deposits and 0 withdrawals and the Withdrawals filter came
    // up empty on a pool that has had withdrawals. Horizon cannot filter operations by type, so widen the
    // window (200 is its max) and walk two more pages. 600 records covers every LP action this pool has
    // seen, and the pages are fetched in sequence only while they keep arriving.
    var opP=(function(){
      var url=H+"/liquidity_pools/"+hex+"/operations?order=desc&limit=200", all=[], pages=0, failed=false;
      function done(){ return {_embedded:{records:all},__failed:(failed&&!all.length)}; }   // no pages at all -> unknown, not "none"
      function step(u){
        return tryJSON(u,2).then(function(r){
          if(!r)failed=true;
          var recs=(r&&r._embedded&&r._embedded.records)||[];
          all=all.concat(recs); pages++;
          var nx=r&&r._links&&r._links.next&&r._links.next.href;
          // Remember where this crawl stopped. The Deposits/Withdrawals filters can carry on from here on
          // demand -- see LPQ below -- instead of every pool page paying for a deeper scan up front.
          LPQ.cursor=nx||null; LPQ.scanned=all.length; LPQ.hex=hex;
          if(recs.length===200&&nx&&pages<3)return step(nx);
          return done();
        }).catch(function(){ failed=true; return done(); });
      }
      return step(url);
    })();
    var partP=tryJSON(H+"/accounts?liquidity_pool="+hex+"&limit=100",2);
    var acctP=myAddr()?(window.__lxAcct?window.__lxAcct(myAddr()):getJSON(H+"/accounts/"+myAddr())):Promise.resolve(null);
    // DO NOT BLOCK THE PAGE ON THE TWO BOTTOM TABS. All six calls used to be awaited together, so the
    // headline cards, the chart and My Position waited for the slowest of them. Timed on the XLM/USDC pool:
    //
    //   pool record   960ms      1 KB        trades      3,851ms    137 KB
    //   participants  2,025ms  3,795 KB      operations    840ms  1,094 KB
    //
    // Participants alone returns 3.8 MB, because /accounts returns every balance, signer and data entry of
    // 100 accounts when all we want from each is one pool-share figure. Together those two are 4.9 MB of
    // JSON to download and parse before anything could paint -- and neither feeds a single thing above the
    // fold. They still start at the same moment, so nothing is slower; they just resolve into the page
    // when they land instead of holding it up.
    var opsLate=opP, partsLate=partP;
    Promise.all([xlmP,poolP,trP,Promise.resolve(null),Promise.resolve(null),acctP]).then(function(r){
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
      // getJSON resolves null on any failure, so null here means "we never got an answer" while an empty
      // records array means "this pool genuinely has none". Those are not the same claim and must not render
      // the same way: the first is what showed a 100-swap pool as having 1 transaction.
      var trFail=!(r[2]&&r[2]._embedded), opFail=!!(r[3]&&r[3].__failed);
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
        // Horizon trade ids are "<operation-id>-<index>"; the leading part is what stellar.expert's /op/ route
        // wants, so the row can link to the actual trade rather than just the trader's account.
        txs.push({type:"swap",xlm:xa,tok:ta,who:(x.base_account||x.counter_account||""),time:ts,op:String(x.id||"").split("-")[0],buy:nb?!x.base_is_seller:!!x.base_is_seller});
      });
      var vol24Xlm=vol, vol24Usd=vol*xlmUsd, fees24Xlm=vol*fee/100, fees24Usd=fees24Xlm*xlmUsd;
      if(nonXlm){ var _a0usd=(a0.code==="USDC"&&a0.issuer===USDC_ISS); vol24Usd=_a0usd?vol:0; fees24Usd=_a0usd?fees24Xlm:0; }
      // Did page 1 reach back past the 24h edge? If its OLDEST record is still inside the window there is
      // more of the day to count, and this figure is a floor, not the answer. Hand volDeepen the cursor.
      var _trOldest=trs.length?Date.parse(trs[trs.length-1].ledger_close_time||trs[trs.length-1].created_at||""):0;
      var _trNext=(r[2]&&r[2]._links&&r[2]._links.next&&r[2]._links.next.href)||null;
      var volNext=(trs.length>=200&&_trOldest>=(now-864e5)&&_trNext)?_trNext:null;
      // volume is derived ENTIRELY from the trades we fetched, so if that fetch failed the honest answer is
      // "unknown", not 0. null is already this file's word for unknown (see volLater on the list page).
      if(trFail){ vol24Xlm=null; vol24Usd=null; fees24Xlm=null; fees24Usd=null; }
      var ops=(r[3]&&r[3]._embedded&&r[3]._embedded.records)||[];
      function amt(arr){ var xx=0,tt=0; (arr||[]).forEach(function(rv){ if(rv.asset==="native")xx=+rv.amount; else tt=+rv.amount; }); return {x:xx,t:tt}; }
      ops.forEach(function(o){
        var ts=Date.parse(o.created_at||"");
        if(o.type==="liquidity_pool_deposit"){ var a=amt(o.reserves_deposited); txs.push({type:"deposit",xlm:a.x,tok:a.t,who:o.source_account,time:ts,op:String(o.id||"")}); }
        else if(o.type==="liquidity_pool_withdraw"){ var b=amt(o.reserves_received||o.reserves_min); txs.push({type:"withdraw",xlm:b.x,tok:b.t,who:o.source_account,time:ts,op:String(o.id||"")}); }
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
        volNext:volNext,volPartial:!!volNext,__xlmUsd:xlmUsd,
        txs:txs,txFail:(trFail||opFail),parts:parts,totShares:totShares,myShares:myShares,myFrac:myFrac,balTok:balTok,balXlm:balXlm,balXlmRaw:balXlmRaw,subs:subs,
        pairName:pairName,nonXlm:nonXlm,a0:a0,a1:a1,pxA0perA1:pxA0perA1,balA0:balA0};
      // MUTATE the existing DET in place on refresh (don't replace it) so wireDW's captured d (===DET)
      // stays valid with fresh numbers — this lets add/withdraw re-fetch+repaint with NO page reload.
      if(DET){for(var _k in _det)DET[_k]=_det[_k];}else{DET=_det;}
      // Finish counting the day's volume behind the already-rendered page (see volDeepen).
      try{ volDeepen(); }catch(_){}
      // The two heavy feeds land here, after the page is already on screen. Each repaints only its own
      // list. Both are guarded: a failure leaves the page exactly as it is rather than blanking a tab.
      if(opsLate){ var _ol=opsLate; opsLate=null;
        _ol.then(function(o){
          if(!DET) return;
          var recs=(o&&o._embedded&&o._embedded.records)||[];
          if(o&&o.__failed){ DET.txFail=true; try{ txFailNote(q(".tx-card")); }catch(_){} return; }
          var add=[];
          recs.forEach(function(op){
            var ts=Date.parse(op.created_at||"")||0;
            if(op.type==="liquidity_pool_deposit"){ var a=amt(op.reserves_deposited);
              add.push({type:"deposit",xlm:a.x,tok:a.t,who:op.source_account,time:ts,op:String(op.id||"")}); }
            else if(op.type==="liquidity_pool_withdraw"){ var b=amt(op.reserves_received||op.reserves_min);
              add.push({type:"withdraw",xlm:b.x,tok:b.t,who:op.source_account,time:ts,op:String(op.id||"")}); }
          });
          if(!add.length) return;
          DET.txs=DET.txs.concat(add); DET.txs.sort(function(x,y){ return y.time-x.time; });
          try{ pdTx(); }catch(_){}
        }).catch(function(){});
      }
      if(partsLate){ var _pl=partsLate; partsLate=null;
        _pl.then(function(a){
          if(!DET) return;
          var accs=(a&&a._embedded&&a._embedded.records)||[]; if(!accs.length) return;
          var ps=[], mine=0;
          accs.forEach(function(ac){ var id=ac.account_id||ac.id;
            (ac.balances||[]).forEach(function(b){
              if(b.asset_type==="liquidity_pool_shares"&&b.liquidity_pool_id===DET.hex){
                ps.push({addr:id,shares:+b.balance}); if(myAddr()&&id===myAddr())mine=+b.balance; } }); });
          var tot=DET.totShares||ps.reduce(function(s,x){return s+x.shares;},0);
          ps.forEach(function(x){ x.frac=tot>0?x.shares/tot:0; });
          ps.sort(function(x,y){ return y.shares-x.shares; });
          DET.parts=ps; if(mine&&!DET.myShares){ DET.myShares=mine; DET.myFrac=tot>0?mine/tot:0; }
          try{ pdParts(); }catch(_){}
        }).catch(function(){});
      }
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
    // Desktop writes "Pool ID: <short>"; the phone header writes just "ID: <short>", so matching on the
    // desktop wording alone left the design's fabricated a468d4…0088 sitting on the page — and the copy
    // button was still handing out that fake id. Match either wording, and re-point data-copy at the real one.
    qa(".pool-header span,.ph-id span").forEach(function(s){ var t=(s.textContent||"").trim();
      if(t.indexOf("Pool ID:")===0)setText(s,"Pool ID: "+hshort(d.hex));
      else if(t.indexOf("ID:")===0)setText(s,"ID: "+hshort(d.hex)); });
    qa(".pool-header button[data-copy],.ph-id button[data-copy]").forEach(function(b){ b.setAttribute("data-copy",d.hex); });
    // "View on Explorer" (the external-link icon button, path starts "M18 13"): open the pool on
    // stellar.expert. Replace the <button> with a real <a target=_blank> rather than calling window.open
    // from a handler — a mobile browser will block a programmatic window.open that it does not attribute
    // to a link activation, which is why the icon did nothing on the phone while the handler ran fine.
    var exHref="https://stellar.expert/explorer/public/liquidity-pool/"+d.hex;
    qa(".pool-header button").forEach(function(b){ if(b.__lxex)return; var p=b.querySelector("svg path"); var dd=(p&&p.getAttribute("d"))||""; if(dd.indexOf("M18 13")!==0&&dd.indexOf("M15 3")!==0&&!/3h6|14L21/.test(dd))return;
      var a=document.createElement("a"); a.className=b.className; a.innerHTML=b.innerHTML;
      a.setAttribute("href",exHref); a.setAttribute("target","_blank"); a.setAttribute("rel","noopener");
      a.setAttribute("title","View on Explorer"); a.setAttribute("aria-label","View pool on stellar.expert");
      a.style.cssText=(b.getAttribute("style")||"")+";display:inline-flex;align-items:center;justify-content:center;color:inherit;text-decoration:none";
      a.__lxex=1; b.parentNode.replaceChild(a,b); });
    qa(".pool-header a[title='View on Explorer']").forEach(function(a){ if(a.getAttribute("href")!==exHref)a.setAttribute("href",exHref); });
    // Header pair icons. This used to hardcode "the token, then XLM", which is only true for XLM pools:
    // on a credit/credit pool like DOPE/LMBW slot A got DET.code (which is a1 = LMBW, so its letter
    // avatar landed where DOPE belongs) and slot B got the XLM logo for an asset that isn't in the pool.
    // Paint from a0/a1 in the same order the name is built (pairName = a0 / a1), via genLogo like every
    // other pair on the page. Key the guard on the pair itself so navigating pool->pool repaints.
    var pi=q(".ph-icons");
    if(pi){
      var s0 = d.nonXlm&&d.a0 ? d.a0 : {code:d.code,issuer:d.issuer};
      var s1 = d.nonXlm&&d.a1 ? d.a1 : {code:"XLM",issuer:"",native:true};
      var sig=(s0.code||"?")+"|"+(s1.code||"?");
      if(pi.getAttribute("data-lxdet")!==sig){
        pi.setAttribute("data-lxdet",sig);
        pi.innerHTML='<div class="pa" data-lxfixed="1">'+genLogo(s0)+'</div><div class="pb" data-lxfixed="1">'+genLogo(s1)+'</div>';
        // resolve whatever the sync map didn't know (stellar.expert toml) for BOTH sides, not just A
        [[s0,".pa"],[s1,".pb"]].forEach(function(pr){ var a=pr[0]; if(!a.code||a.code==="XLM"||a.native)return;
          amFetchLogo(a.code,a.issuer,function(url){ var im=pi.querySelector(pr[1]+" img"); if(im&&url)im.src=url; }); });
      }
    }
    var pv=q(".ph-price .v"), pm=q(".ph-price .lc-money");
    if(d.nonXlm){ if(pv)setText(pv,fprice(d.pxA0perA1)+" "+d.a0.code); if(pm)setMoneyEl(pm,d.priceUsd,d.priceUsd>0?pusd(d.priceUsd):"\\u2014"); }
    else { if(pv)setText(pv,fprice(d.priceXlm)+" XLM"); if(pm)setMoneyEl(pm,d.priceUsd,pusd(d.priceUsd)); }
    var ps=q(".ph-price .s"); if(ps){ [].slice.call(ps.childNodes).forEach(function(nd){ if(nd.nodeType===3&&/per /.test(nd.textContent)&&nd.textContent.indexOf(d.code)<0)nd.textContent=" per "+d.code; }); }
    // The phone header ships an entirely different price block: .ph-price-row > div > .label/.value/.vs,
    // with no .ph-price wrapper at all. Everything above is desktop-only selectors, so on mobile the
    // design's mock "0.000713 APT / $0.000108 per LUMOS" survived on EVERY pool page. Same numbers, the
    // phone's class names. data-lx-noswap keeps the multichain re-skin from rewriting the asset code we
    // just wrote (it is the one that turns a stale "APT" into "XLM" on pairs we do not own).
    var mrow=q(".ph-price-row");
    if(mrow){
      var mv=mrow.querySelector(".value"), mvs=mrow.querySelector(".vs"), mm=mrow.querySelector(".vs .lc-money");
      var per=d.nonXlm?d.a1.code:d.code;
      if(mv){ mv.setAttribute("data-lx-noswap","1"); setText(mv,d.nonXlm?(fprice(d.pxA0perA1)+" "+d.a0.code):(fprice(d.priceXlm)+" XLM")); }
      // text BEFORE money, each isolated: every painter in the boot list runs inside a silent try/catch,
      // so anything that throws in the money path used to take the rest of pdHeader with it and leave the
      // mock "per LUMOS" sitting under a correct price until some later repaint happened to fix it.
      if(mvs){ mvs.setAttribute("data-lx-noswap","1");
        // leading space on purpose: the money span it follows may or may not end in one (setMoneyEl's
        // "\\u2014" does not), and "\\u2014per LMBW" reads as a typo
        [].slice.call(mvs.childNodes).forEach(function(nd){ if(nd.nodeType===3&&/per /.test(nd.textContent)&&nd.textContent.indexOf(per)<0)nd.textContent=" per "+per; }); }
      if(mm){ try{ setMoneyEl(mm,d.priceUsd,d.priceUsd>0?pusd(d.priceUsd):"\\u2014"); }catch(_){} }
    }
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
    // Phone header: the site's money formatter re-renders .vs from its data-orig on a timer, restoring
    // "per LUMOS" over the asset code we wrote — measured flip-flopping about once a second. Writing it
    // once in pdHeader cannot win that; own it with the same observer the desktop block uses. Converges
    // rather than loops: our own write leaves the code present, so the next callback is a no-op.
    var pr=q(".ph-price-row");
    if(pr&&!pr.__lxg){ pr.__lxg=1;
      try{ new MutationObserver(function(){ if(!DET)return; var vs=pr.querySelector(".vs"); if(!vs)return;
        var per=DET.nonXlm?DET.a1.code:DET.code; if(!per)return;
        [].slice.call(vs.childNodes).forEach(function(nd){ if(nd.nodeType===3&&/per /.test(nd.textContent)&&nd.textContent.indexOf(per)<0)nd.textContent=" per "+per; });
      }).observe(pr,{childList:true,subtree:true,characterData:true}); }catch(e){}
    }
    var pp=q(".ph-price"); if(!pp||pp.__lxg)return; pp.__lxg=1;
    try{ new MutationObserver(function(){ if(!DET)return; var ps=q(".ph-price .s"); if(!ps)return; [].slice.call(ps.childNodes).forEach(function(nd){ if(nd.nodeType===3&&/per /.test(nd.textContent)&&nd.textContent.indexOf(DET.code)<0)nd.textContent=" per "+DET.code; }); }).observe(pp,{childList:true,subtree:true,characterData:true}); }catch(e){}
  }
  function pdStats(){
    var d=DET;
    qa(".ph-stat").forEach(function(s){
      var ic=s.querySelector(".ic"); var cn=ic?((ic.className&&ic.className.baseVal!==undefined)?ic.className.baseVal:ic.className):"";
      var v=s.querySelector(".v"), sub=s.querySelector(".s");
      var U0=d.nonXlm?d.a0.code:"XLM";
      // When no USD figure exists, drop the whole "· ≈ …" clause. It used to print "· ≈ —", which reads as a
      // broken field rather than an unpriced pair — and is what made the Liquidity box look wrong.
      if(/liq/.test(cn)){ if(d.nonXlm){ if(v)setText(v,num(d.a0.amt)+" "+U0);
          if(sub)setText(sub,"+ "+num(d.a1.amt)+" "+d.a1.code+(d.tvlUsd>0?(" \\u00b7 \\u2248 "+usd(d.tvlUsd)):"")); }
        else { if(v)setText(v,num(d.xlm)+" XLM"); if(sub)setText(sub,"+ "+num(d.tok)+" "+d.code+" \\u00b7 \\u2248 "+usd(d.tvlUsd)); } }
      // null = the trades fetch never answered. Print a dash: a confident "0 XLM" on a pool that traded all
      // day is worse than admitting we do not know.
      else if(/vol/.test(cn)){
        if(d.vol24Xlm==null){ if(v)setText(v,"\\u2014"); if(sub)setText(sub,"24h volume unavailable"); }
        // While volDeepen is still walking the day, this is a FLOOR, not the figure. Say so, rather than
        // printing a partial sum that looks final -- that was the whole defect.
        else { if(v)setText(v,(d.volPartial?"\\u2265 ":"")+num(d.vol24Xlm)+" "+U0);
          if(sub)setText(sub, d.volPartial ? "still counting the last 24h\\u2026"
            : (d.nonXlm?(d.vol24Usd>0?"\\u2248 "+usd(d.vol24Usd):"24h volume"):"\\u2248 "+usd(d.vol24Usd))); } }
      else if(/fee/.test(cn)){
        if(d.fees24Xlm==null){ if(v)setText(v,"\\u2014"); if(sub)setText(sub,""); }
        else { if(v)setText(v,(d.fees24Xlm>=0.01?d.fees24Xlm.toFixed(2):"0")+" "+U0); if(sub)setText(sub,(d.nonXlm&&!(d.fees24Usd>0)?"":"\\u2248 "+usd(d.fees24Usd))); } }
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
  var __lxRangeSel="", __lxMetricSel="";
  // The ONE place the effective chart view is decided. Our strips win over the design's own state, because
  // that state does not follow a phone tap.
  //
  // chDraw and chSync must both read THIS, not the raw design state. They didn't: chDraw stamped its
  // signature from the overridden values while chSync compared the raw ones, so once a range was chosen by
  // touch the two never agreed and the 500ms chSync redrew the chart forever.
  // Metric is pinned to TVL. Volume is no longer a separate view -- it is drawn as bars inside the TVL
  // chart (chVolBars), so there is nothing left to switch between and the dropdown is removed. Pinning it
  // here rather than trusting the control matters because the DESIGN owns that control's state: it
  // rewrites the trigger label from its own state, and if anything ever set it to volume again the chart
  // would drop back to a volume-only view.
  function chState(){
    var s=(window.__tvlChartState&&window.__tvlChartState())||{type:"line",metric:"tvl",range:"1Y"};
    return {type:s.type,metric:"tvl",range:__lxRangeSel||s.range};
  }
  var CH_RES={"1D":900000,"1W":3600000,"1M":86400000,"3M":86400000,"1Y":604800000,"ALL":604800000};
  var CH_DAYS={"1D":1,"1W":7,"1M":30,"3M":90,"1Y":365,"ALL":730};
  // Centre of whatever viewBox this svg has. The loader/empty texts hardcoded x=500,y=140 — the middle of
  // a 1000x280 box — which on the phone 400x220 box sits 100 units off the right edge.
  // Read it through the SVG DOM, NOT a regex on the attribute: this code is emitted from inside a JS string,
  // so a "\\s" in a character class arrives in the browser as a literal "s" and the split silently never
  // matches. That exact bug made every caller fall back to 1000x280 on a 400x220 phone svg.
  function chBox(sv){ var v=sv&&sv.viewBox&&sv.viewBox.baseVal;
    return (v&&v.width>0&&v.height>0)?{w:v.width,h:v.height}:{w:1000,h:280}; }
  // Which asset the chart is denominated in, and the pair to ask Horizon for.
  //
  // This used to assume every pool had an XLM leg and hard-coded counter_asset_type=native, so a pool
  // of two credit assets (USDC/EURC) fell straight through to "No chart for this pair yet" — while the
  // y-axis still said XLM. trade_aggregations takes any base/counter, so build the query from the pool's
  // OWN reserves: base = the second asset, counter = the first, and the series is denominated in the
  // first asset exactly as the XLM pools are denominated in XLM.
  // Finish the 24h volume the first page could only start. Walks older pages until one crosses the 24h
  // edge, adding each in-window trade, then repaints the Volume and Fees cards.
  //
  // Off the critical path on purpose: the headline, chart and tables are already up, and a correction
  // arriving a second later is much better than a page that waits eleven requests to render. While it is
  // running the figure is marked partial rather than shown as final -- the old bug was not that the number
  // was small, it was that a floor was presented as a fact.
  var VOLMAXP=14;                      // 14 x 200 = 2,800 trades/day before we admit to a cap
  function volDeepen(){
    var d=DET; if(!d||!d.volNext||d.__volBusy)return; d.__volBusy=1;
    var cut=Date.now()-864e5, url=d.volNext, pages=0;
    function step(){
      if(!url||pages>=VOLMAXP){ d.volPartial=(!!url); d.volNext=null; d.__volBusy=0; try{ paintDetail(); }catch(_){} return; }
      pages++;
      getJSON(url).then(function(j){
        var rs=(j&&j._embedded&&j._embedded.records)||[];
        if(!j||!j._embedded){ url=null; return step(); }   // a failed page: stop, stay marked partial
        var add=0, done=false;
        for(var i=0;i<rs.length;i++){
          var x=rs[i], ts=Date.parse(x.ledger_close_time||x.created_at||"");
          if(ts<cut){ done=true; break; }
          var nb=x.base_asset_type==="native";
          var xa=nb?+x.base_amount:+x.counter_amount;
          if(d.nonXlm&&d.a0){ var _b=(x.base_asset_code===d.a0.code&&x.base_asset_issuer===d.a0.issuer); xa=_b?+x.base_amount:+x.counter_amount; }
          add+=xa;
        }
        d.vol24Xlm=(d.vol24Xlm||0)+add;
        d.fees24Xlm=d.vol24Xlm*d.fee/100;
        var px=d.__xlmUsd||0;
        if(d.nonXlm){ var a0usd=(d.a0&&d.a0.code==="USDC"); d.vol24Usd=a0usd?d.vol24Xlm:0; d.fees24Usd=a0usd?d.fees24Xlm:0; }
        else { d.vol24Usd=d.vol24Xlm*px; d.fees24Usd=d.fees24Xlm*px; }
        if(done||rs.length<200){ url=null; }
        else { url=(j._links&&j._links.next&&j._links.next.href)||null; }
        // Repaint ONLY when the count is final, so the page is not redrawn eleven times mid-walk.
        // MEASURED, because I first assumed the repaints were the bottleneck and they are not: settle
        // time went 65s -> 60s. The cost is the fetches themselves (~5s per paged Horizon trades request
        // from the browser; the same walk from node takes seconds). Worth knowing before anyone tries to
        // speed this up by touching the rendering. The card reads ">= N, still counting" throughout,
        // which is true the whole time.
        if(!url){ d.volPartial=false; d.volNext=null; try{ paintDetail(); }catch(_){} }
        step();
      }).catch(function(){ url=null; d.__volBusy=0; try{ paintDetail(); }catch(_){} });
    }
    step();
  }
  function chPair(){
    var d=DET; if(!d)return null;
    function leg(a){ return (!a||a.native||a.code==="XLM")?{native:true,code:"XLM"}:{code:a.code,issuer:a.issuer}; }
    if(!d.nonXlm) return {base:{code:d.code,issuer:d.issuer},counter:{native:true,code:"XLM"},unit:"XLM",reserve:d.xlm,price:d.priceXlm};
    if(!d.a0||!d.a1) return null;
    // The DETAIL model names the reserve .amt (the pools LIST model names it .amount) and already carries
    // the ratio as pxA0perA1. Reading .amount here left price and reserve at 0, chAgg refused to build a
    // query, and chDraw re-entered it forever — the chart sat on "Loading pool history…" indefinitely.
    var pr=(d.pxA0perA1>0)?d.pxA0perA1:((d.a1.amt>0)?(d.a0.amt/d.a1.amt):0);   // a0 per a1 = counter per base
    return {base:leg(d.a1),counter:leg(d.a0),unit:d.a0.code,reserve:d.a0.amt,price:pr};
  }
  function aggQ(side,which){
    if(side.native) return which+"_asset_type=native";
    return which+"_asset_type=credit_alphanum"+(side.code.length>4?"12":"4")
      +"&"+which+"_asset_code="+encodeURIComponent(side.code)
      +"&"+which+"_asset_issuer="+side.issuer;
  }
  function chAgg(range,cb){
    var d=DET; if(!d){ cb(null); return; }
    // Mark the range empty when no query can be built, rather than just calling back. chDraw's callback
    // is chDraw itself, so a bare cb(null) with nothing recorded made it ask again on every pass and the
    // loader never cleared. Recording __empty lets it fall through to the tx-reconstruction/empty state.
    d.__agg=d.__agg||{};
    var P=chPair(); if(!P||!(P.price>0)||!(P.reserve>0)){ d.__agg[range]={__empty:1}; cb(null); return; }
    d.__agg=d.__agg||{}; if(d.__agg[range]){ cb(d.__agg[range].__empty?null:d.__agg[range]); return; }
    d.__aggP=d.__aggP||{}; if(d.__aggP[range])return; d.__aggP[range]=1;
    var res=CH_RES[range]||86400000, end=Math.ceil(Date.now()/res)*res, start=Math.floor((end-(CH_DAYS[range]||365)*86400000)/res)*res;
    var url=H+"/trade_aggregations?"+aggQ(P.base,"base")+"&"+aggQ(P.counter,"counter")+"&resolution="+res+"&start_time="+start+"&end_time="+end+"&order=asc&limit=200";
    getJSON(url).then(function(r){ d.__aggP[range]=0; var recs=(r&&r._embedded&&r._embedded.records)||[]; var pts=[],vol=[];
      recs.forEach(function(x){ var t=+x.timestamp; var price=+x.avg||+x.close||0; if(price>0)pts.push({t:t,r:P.reserve*Math.sqrt(price/P.price)}); vol.push({t:t,v:+x.counter_volume||0}); });
      if(pts.length<2){ d.__agg[range]={__empty:1}; cb(null); return; }
      pts.push({t:Date.now(),r:P.reserve});   // pin the newest point to the live reserve
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
    var t=chS("text",{"class":"lx-chload",x:String(chBox(svg).w/2),y:String(chBox(svg).h/2),"text-anchor":"middle","dominant-baseline":"middle",fill:"var(--text-muted,#8b90a0)","font-size":"13"}); t.textContent="Loading pool history\\u2026";
    var o=chS("animate",{attributeName:"opacity",values:"0.35;0.8;0.35",dur:"1.1s",repeatCount:"indefinite"}); t.appendChild(o); svg.appendChild(t);
  }
  function chPairEmpty(){ var svg=q("#tvlChart svg"); document.documentElement.classList.add("lx-chartready"); if(!svg)return;
    [].slice.call(svg.querySelectorAll(".lx-chload")).forEach(function(e){ if(e.parentNode)e.parentNode.removeChild(e); });
    [].slice.call(svg.querySelectorAll("path")).forEach(function(pp){ if((pp.getAttribute("class")||"").indexOf("lx-ch")<0)pp.setAttribute("d",""); });
    if(!svg.querySelector(".lx-chpair")){ var t=chS("text",{"class":"lx-chpair",x:String(chBox(svg).w/2),y:String(chBox(svg).h/2),"text-anchor":"middle","dominant-baseline":"middle",fill:"var(--text-muted,#8b90a0)","font-size":"13"}); t.textContent="No chart for this pair yet"; svg.appendChild(t); } }
  // Volume bars drawn into the bottom band of the TVL chart, so both series are read at once instead of
  // being hidden behind a dropdown that showed one or the other.
  //
  // They do NOT share the TVL axis and are not meant to: the axis labels belong to the line. The bars are
  // a shape, showing when the pool was busy relative to its own quietest and busiest buckets.
  //
  // SQRT, not linear. Learned building the same thing on Trade-asset: pool volume per bucket spans orders
  // of magnitude, so a linear scale put the median bar under about a pixel while one spike owned the band
  // -- the row read as empty. Square root compresses that spread into something visible, and a floor
  // keeps a real-but-tiny bucket from rounding away to nothing, which would show "no trades" where there
  // were trades.
  // Returns the buckets it drew so the hover can report the same numbers. The tooltip must never
  // recompute them independently -- two bucketings of the same series drift apart and the box would then
  // describe a bar that is not the one under the cursor.
  function chVolBars(svg,ser,t0,t1,X,DW,H,padT,padB,res){
    var vol=(ser&&ser.vol)||[]; if(!vol.length)return null;
    // Bucket width follows the SERIES RESOLUTION, it is not a fixed count. With a fixed 46 buckets a 1M
    // chart cut 30 days of DAILY records into 0.65-day slices, so a third of them could not receive a
    // record and the hover reported "0 XLM" on days that plainly had trading. A bucket narrower than the
    // data it holds manufactures gaps.
    //
    // At bucket == resolution a zero is a real zero: trade_aggregations only emits intervals that traded,
    // so an empty bucket means nothing traded then, which is worth showing.
    var NB=Math.max(6,Math.min(60,Math.round((t1-t0)/(res||86400000))));
    var bw=(t1-t0)/NB, buck=[], i;
    for(i=0;i<NB;i++)buck.push(0);
    vol.forEach(function(e){ if(e.t<t0||e.t>t1)return;
      var bi=Math.min(NB-1,Math.max(0,Math.floor((e.t-t0)/bw))); buck[bi]+=(+e.v||0); });
    var mxv=Math.max.apply(null,buck); if(!(mxv>0))return null;
    var band=(H-padT-padB)*0.22, bpx=Math.max(1.5,DW/NB*0.62);
    for(i=0;i<NB;i++){
      var v=buck[i]; if(!(v>0))continue;
      var h=Math.max(1.5,band*Math.sqrt(v/mxv));
      var x=X(t0+(i+0.5)*bw);
      svg.appendChild(chS("rect",{"class":"lx-vol",x:(x-bpx/2).toFixed(1),y:(H-padB-h).toFixed(1),
        width:bpx.toFixed(1),height:h.toFixed(1),rx:"1",fill:"#8b7bf0","fill-opacity":"0.45"}));
    }
    return {t0:t0,bw:bw,buck:buck};
  }
  function chDraw(){
    var svg=q("#tvlChart svg"); if(!svg)return; document.documentElement.classList.add("lx-chartready"); if(!DET)return;
    // A pool of two credit assets now charts too — chAgg asks Horizon for that pair directly and
    // denominates the series in the pool's first asset — so this no longer bails on nonXlm. chAgg still
    // reports empty when Horizon has no trade history for the pair, and chPairEmpty says so honestly.
    if(!chPair()){ chPairEmpty(); return; }
    var s=chState();
    var agg=DET.__agg&&DET.__agg[s.range], ser;
    if(agg&&!agg.__empty){ ser=agg; }
    else if(agg&&agg.__empty){ if(!DET.__chSer)DET.__chSer=chBuild(); ser=DET.__chSer; }   // no trade_aggregations for this range -> tx-reconstruction fallback
    else { chAgg(s.range,function(){ chDraw(); }); chLoading(svg); return; }   // range not fetched yet: show a loader, DON'T flash the wrong (minutes-long) reconstruction while ALL/1Y loads
    // Draw into the viewBox the svg ACTUALLY has. The design sizes it per layout — 1000x280 on desktop but
    // 400x220 on the phone — and we used to assume 1000x280 everywhere, so on mobile everything below y=220
    // fell outside the box and was clipped: the chart cropped from the bottom.
    //
    // My first fix rewrote the viewBox to 1000x280 instead. That un-cropped the line but rescaled the
    // DESIGN's own axis labels, which are positioned in its 400x220 space — that is what wrecked the 1M
    // labels. Adapt to the svg; never resize it under the design's text.
    var _vb=chBox(svg), W=_vb.w, H=_vb.h;
    var DW=Math.max(1,Math.round(W*0.936)),padT=Math.max(6,Math.round(H*0.043)),padB=Math.max(12,Math.round(H*0.086));
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
    var _volInfo=null;                 // buckets chVolBars drew, handed to the hover so both agree
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
      // Volume bars UNDER the TVL line, in the same chart -- the Trade-asset treatment. Appended first so
      // the area fill and the line paint over them.
      _volInfo=chVolBars(svg,ser,t0,t1,X,DW,H,padT,padB,CH_RES[s.range]);
      var dd=""; vals.forEach(function(p,i){ dd+=(i?"L":"M")+X(p.t).toFixed(1)+" "+Y(p.v).toFixed(1)+" "; });
      var lastX=X(vals[vals.length-1].t).toFixed(1), firstX=X(vals[0].t).toFixed(1);
      svg.appendChild(chS("path",{d:dd+"L"+lastX+" "+(H-padB)+" L"+firstX+" "+(H-padB)+" Z",fill:accent,"fill-opacity":"0.10",stroke:"none"}));
      svg.appendChild(chS("path",{d:dd,fill:"none",stroke:accent,"stroke-width":"2","stroke-linejoin":"round","stroke-linecap":"round"}));
    }
    // Pick the axis labels by POSITION inside the actual viewBox, not by the desktop's literal coordinates.
    // These used to test x==="996" / y==="278" — the right/bottom edge of the 1000x280 desktop box. The phone
    // box is 400x220 with its labels at x=396 / y=218, so neither filter ever matched and the design's baked
    // mock survived: a 1D chart still reading "Aug | Nov | Feb | May | Aug" down the time axis.
    var _ax=[].slice.call(svg.querySelectorAll("text")).filter(function(t){return (t.getAttribute("class")||"").indexOf("lx-ch")<0;});
    var yt=_ax.filter(function(t){ return (+t.getAttribute("x")||0)>=W*0.9; });
    // AUDIT FIX: fixed 2-dp labels collapse on near-flat data (all 5 gridlines read "1.09M XLM") — pick the
    // decimals from the per-gridline STEP so adjacent labels always differ (capped at 5 dp).
    var _step=(mx-mn)/Math.max(1,yt.length-1);
    // Label the axis in the asset the series is actually denominated in. It said XLM unconditionally,
    // which was already wrong on a USDC/EURC pool before this pair could chart at all.
    var _u=" "+(((chPair()||{}).unit)||"XLM");
    function yfmt(x,wu){ var u=wu?_u:"";
      x=+x||0; var a=Math.abs(x), sc=a>=1e6?1e6:(a>=1e3?1e3:1), sfx=sc===1e6?("M"+u):(sc===1e3?("K"+u):u);
      var d=2; if(_step>0){ d=Math.max(2,Math.min(5,Math.ceil(-Math.log10(_step/sc))+1)); if(!isFinite(d))d=2; }
      return sc===1?((a>=1?num(x):x.toFixed(Math.max(2,d)))+u):((x/sc).toFixed(d)+sfx); }
    // THE UNIT ON EVERY GRIDLINE IS AXIS TEXT LYING ACROSS THE SERIES. These labels are text-anchor="end"
    // pinned at x=396, so a longer one cannot leave the card -- it grows LEFT, over the plot. Measured on
    // the phone box: "27.35M XLM" covers 14.1% of the plot width, "27.35M PENGULUMENS" 25.4%, and
    // "0.0000001 PENGULUMENS" 29.6%, five times over. Print the unit once, on the top gridline, and leave
    // the rest bare numbers; the reader still learns the unit and the chart gets its width back.
    // (No backticks in this comment: it is emitted from inside a Node template literal — DEV landmine 8.)
    //
    // GATE ON RENDERED WIDTH, NOT THE viewBox. DEV landmine 12 says the chart box is 1000x280 on desktop
    // and 400x220 on the phone -- true elsewhere, but NOT on this page: measured, the pool detail chart is
    // 400x220 in BOTH builds. A viewBox test therefore fires on desktop too and would have quietly changed
    // a layout nobody asked to change. The svg scales to its container, so the honest measure of crowding
    // is the drawn width: 566px on desktop, ~345px on a 375px phone.
    // Falls back to the previous behaviour when the box has not been laid out yet (width 0).
    var _drawnW=0; try{ _drawnW=svg.getBoundingClientRect().width||0; }catch(_e){}
    var _oneUnit=(_drawnW>0&&_drawnW<450);
    // i===0 is the TOP gridline: frac below is 1-i/(n-1), so i=0 maps to mx.
    yt.forEach(function(t,i){ var frac=yt.length<=1?1:(1-i/(yt.length-1)); setText(t,yfmt(mn+(mx-mn)*frac,!_oneUnit||i===0)); });
    var xt=_ax.filter(function(t){ return (+t.getAttribute("y")||0)>=H*0.9&&yt.indexOf(t)<0; }).sort(function(a,b){return (+a.getAttribute("x"))-(+b.getAttribute("x"));});
    var span=t1-t0, MO=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    function fmt(t){ var dt=new Date(t); if(span<2*86400000){ var hh=dt.getHours(),mm=dt.getMinutes(); return (hh<10?"0":"")+hh+":"+(mm<10?"0":"")+mm; } if(span<120*86400000)return MO[dt.getMonth()]+" "+dt.getDate(); return MO[dt.getMonth()]; }
    xt.forEach(function(t,i){ var frac=xt.length<=1?1:i/(xt.length-1); setText(t,fmt(t0+span*frac)); });
    // Publish exactly what was plotted, so the hover reports the series on screen instead of inventing one.
    // Points are kept in viewBox coordinates; chHover converts through the svg's own CTM, which is correct
    // on both layouts and survives whatever scaling the phone box applies.
    // usdPerUnit is the pool's live USD TVL divided by its live size in the denominating asset. Zero when
    // no USD price exists for this pair (most credit/credit pools) -> the tooltip then shows no USD line at
    // all, rather than a number derived from a made-up rate.
    var _P=chPair(), _cur=_P?_P.reserve*2:0, _tu=+DET.tvlUsd||0;
    DET.__chH={ metric:isVol?"vol":"tvl", bars:isBar, color:accent, unit:_u.replace(" ",""), span:span,
      usdPerUnit:(_cur>0&&_tu>0)?(_tu/_cur):0,
      vol:_volInfo,                    // null when the range has no traded volume -> the row is omitted

      pts:vals.map(function(p){ return {t:p.t,v:p.v,x:X(p.t),
        y:isVol?(H-padB-(H-padT-padB)*(mx>0?p.v/mx:0)):Y(p.v)}; }) };
    DET.__chSig=s.type+"|"+s.metric+"|"+s.range;
  }
  // ---- Chart hover -----------------------------------------------------------------------------------
  // The design shipped its own hover that claimed to read the rendered points but read ITS mock series and
  // formatted with baked maths ("M APT", a fixed 0.153 USD rate, a date computed from the cursor position).
  // On a pool holding 2,179 DOPE it read "2.79M XLM / $427,381". That script is stripped at build time by
  // _tools/_chart_hover.js; this is the replacement, driven by DET.__chH.
  function chHovDate(t,span){
    var dt=new Date(t);
    if(span<2*86400000) return dt.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
    var o={month:"short",day:"numeric"}; if(span>=180*86400000)o.year="numeric";
    return dt.toLocaleDateString("en-US",o);
  }
  // The Volume block in the hover box: the traded volume of the BUCKET the cursor is over, read straight
  // out of the buckets chVolBars drew rather than recomputed, so the number always describes the bar you
  // are looking at.
  //
  // Bars and line are sampled differently on purpose. The line is interpolated along the segment under the
  // cursor (a pool's series is sparse, so snapping made whole stretches report the same day), but a bar IS
  // its bucket -- there is no value "between" two of them. So the TVL figure slides and the volume figure
  // steps, which is correct for what each one is.
  //
  // Returns "" when the chart has no volume series (chVolBars returned null): no row at all beats a row
  // that says 0 on a chart that never had the data.
  //
  // LABELLED "PAIR VOLUME", and that word is load-bearing. The series comes from Horizon's
  // trade_aggregations for the ASSET PAIR, which spans every DEX venue trading it -- the order book and
  // all other pools -- not this pool alone. Measured on USDC/XLM: the pair did 2,725,945 XLM on Aug 16
  // while this pool's own trades did 240,904 XLM in 24h, about 1.8x apart. Calling that "Volume" on a
  // pool page would read as the pool's, and it would disagree with the 24h Volume card directly above it,
  // which IS pool-only. Pool-specific volume per bucket across 30 days is not reachable -- it would be a
  // paged trades crawl per bucket -- so the honest move is to name the number for what it measures.
  function chHovVol(st,t){
    var vi=st&&st.vol; if(!vi||!vi.buck||!vi.buck.length)return "";
    var i=Math.floor((t-vi.t0)/vi.bw);
    if(i<0)i=0; if(i>vi.buck.length-1)i=vi.buck.length-1;
    var v=+vi.buck[i]||0;
    var u=(st.usdPerUnit>0)?usd(v*st.usdPerUnit):"";
    return '<div style="font-size:12.5px;color:var(--text-soft);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin-top:7px">Pair volume</div>'
      +'<div style="font-weight:700;font-size:15px;color:#8b7bf0;margin-top:3px">'+esc(famt(v)+" "+st.unit)+'</div>'
      +(u?('<div style="font-size:13.5px;color:var(--text-muted);margin-top:1px">'+esc(u)+'</div>'):'');
  }
  function chHover(){
    var host=q("#tvlChart"); if(!host||host.__lxHov)return; host.__lxHov=1;
    try{ if(getComputedStyle(host).position==="static")host.style.position="relative"; }catch(_){}
    host.style.cursor="crosshair";
    function mk(cls,css){ var el=document.createElement("div"); el.className="lx-chov "+cls;
      el.style.cssText="position:absolute;pointer-events:none;opacity:0;transition:opacity .08s linear;"+css;
      host.appendChild(el); return el; }
    var vline=mk("lx-chov-v","top:0;bottom:0;width:1px;background:rgba(180,180,200,.55);z-index:4"),
        dot=mk("lx-chov-dot","width:11px;height:11px;border-radius:50%;border:2px solid var(--surface);transform:translate(-50%,-50%);z-index:6"),
        box=mk("lx-chov-box","background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:9px 12px;font-size:14px;box-shadow:0 8px 22px rgba(0,0,0,.25);min-width:140px;z-index:8;color:var(--text)");
    function hide(){ vline.style.opacity="0"; dot.style.opacity="0"; box.style.opacity="0"; }
    function at(cx,cy){
      var svg=q("#tvlChart svg"), st=DET&&DET.__chH;
      if(!svg||!st||!st.pts||!st.pts.length)return hide();
      var m=null; try{ m=svg.getScreenCTM(); }catch(_){}
      if(!m)return hide();
      var hr=host.getBoundingClientRect();
      if(cx<hr.left||cx>hr.right||cy<hr.top||cy>hr.bottom)return hide();
      var pt=svg.createSVGPoint(); pt.x=cx; pt.y=cy;
      var vp=pt.matrixTransform(m.inverse());
      // A real pool's series is SPARSE — one point per interval that actually traded — so snapping to the
      // nearest point made whole stretches of the chart report the same day (Jul 26 for three cursor-widths,
      // and Jul 20/21/24/25 unreachable entirely). For a line, read the value ALONG the segment under the
      // cursor: that is the value the line is drawing at that x, so every date in the range is reachable and
      // the dot slides on the line. Bars keep snapping — a bar IS its bucket, there is nothing between two.
      var P=st.pts, n=P.length, p, key;
      if(st.bars||n<2){
        var best=0,bd=Infinity;
        for(var i=0;i<n;i++){ var dx=Math.abs(P[i].x-vp.x); if(dx<bd){bd=dx;best=i;} }
        p=P[best]; key="b"+best;
      } else {
        var vx=Math.max(P[0].x,Math.min(P[n-1].x,vp.x));
        var j=1; while(j<n-1&&P[j].x<vx)j++;
        var A=P[j-1], B=P[j];
        var f=(B.x>A.x)?((vx-A.x)/(B.x-A.x)):0;
        p={x:vx,y:A.y+(B.y-A.y)*f,t:A.t+(B.t-A.t)*f,v:A.v+(B.v-A.v)*f};
        key="l"+Math.round(vx);
      }
      var sp=svg.createSVGPoint(); sp.x=p.x; sp.y=p.y;
      var scr=sp.matrixTransform(m);
      var lx=scr.x-hr.left, ly=scr.y-hr.top;
      vline.style.left=lx+"px"; vline.style.opacity="1";
      dot.style.left=lx+"px"; dot.style.top=ly+"px";
      dot.style.background=st.color; dot.style.boxShadow="0 0 0 3px "+st.color+"55";
      dot.style.opacity=st.bars?"0":"1";
      var sig=key+"|"+st.metric+"|"+st.unit+"|"+(st.usdPerUnit>0?1:0);
      if(box.__lxSig!==sig){ box.__lxSig=sig;
        var usdTxt=(st.usdPerUnit>0)?usd(p.v*st.usdPerUnit):"";
        box.innerHTML='<div style="font-size:12.5px;color:var(--text-soft);text-transform:uppercase;letter-spacing:.4px;font-weight:700">'+(st.metric==="vol"?"Volume":"TVL")+'</div>'
          +'<div style="font-weight:700;font-size:15px;color:var(--text);margin-top:3px">'+esc(famt(p.v)+" "+st.unit)+'</div>'
          +(usdTxt?('<div style="font-size:13.5px;color:var(--text-muted);margin-top:1px">'+esc(usdTxt)+'</div>'):'')
          +chHovVol(st,p.t)
          +'<div style="font-size:13px;color:var(--text-soft);margin-top:5px">'+esc(chHovDate(p.t,st.span))+'</div>';
      }
      box.style.opacity="1";
      var bw=box.offsetWidth||160, bh=box.offsetHeight||74;
      var bx=lx+14; if(bx+bw>hr.width)bx=lx-bw-14; if(bx<4)bx=4;
      var by=ly-24; if(by+bh>hr.height)by=hr.height-bh-4; if(by<4)by=4;
      box.style.left=bx+"px"; box.style.top=by+"px";
    }
    host.addEventListener("mousemove",function(e){ at(e.clientX,e.clientY); });
    host.addEventListener("mouseleave",hide);
    // Touch: read on tap and follow a drag, but only claim the gesture once it is clearly horizontal —
    // otherwise the page cannot be scrolled with a finger that started on the chart. And DON'T hide on
    // touchend: on a phone the finger is the cursor, so lifting it would erase the value the tap was for.
    // A tap anywhere else clears it (same behaviour as the wallet chart).
    var _t0=null;
    host.addEventListener("touchstart",function(e){ var t=e.touches&&e.touches[0]; if(!t)return;
      _t0={x:t.clientX,y:t.clientY}; at(t.clientX,t.clientY); },{passive:true});
    host.addEventListener("touchmove",function(e){ var t=e.touches&&e.touches[0]; if(!t)return;
      if(_t0&&Math.abs(t.clientX-_t0.x)>Math.abs(t.clientY-_t0.y))e.preventDefault();
      at(t.clientX,t.clientY); },{passive:false});
    document.addEventListener("touchstart",function(e){ var t=e.target;
      if(t&&t.closest&&t.closest("#tvlChart"))return; hide(); },true);
  }
  // Re-assert real data only when needed: the active view changed, OR the design re-rendered its own mock
  // (its candle <rect>s reappear / its <path> d gets re-set — e.g. during the design's ~1-2s enter animation).
  function chSync(){ var g=q("#tvlChart svg"); if(!g||!DET)return; var s=chState(); var sig=s.type+"|"+s.metric+"|"+s.range; var dirty=!!g.querySelector("rect:not(.lx-ch)"); if(!dirty){ var dp=g.querySelector("path:not(.lx-ch)"); dirty=!!(dp&&dp.getAttribute("d")); } if(sig!==DET.__chSig||dirty)chDraw(); }
  // OWN THE PHONE TAB STRIPS OUTRIGHT.
  //
  // Both strips depend on the design own click handler, and on a real handset that handler is not firing —
  // a synthetic touchstart+touchend here switches nothing; only a synthesised click does, which is exactly
  // the event a phone can withhold. Rather than keep guessing what eats it, do the switching ourselves from
  // WINDOW capture (ahead of every other listener) and on touchend as well as click, so a tap works even if
  // no click is ever synthesised. Idempotent and additive: if the design handler does run, it sets the same
  // classes we do.
  function ptabShow(name){
    qa("#ptabs button[data-ptab]").forEach(function(b){ b.classList.toggle("active", b.getAttribute("data-ptab")===name); });
    qa(".ptab-panel").forEach(function(p){ var on=p.getAttribute("data-panel")===name;
      p.classList.toggle("active",on); p.style.display=on?"":"none"; });
    try{ paintDetail(); }catch(_){}
  }
  // Switch the PANELS, not just the button styling. This owned handler stops the design's own click
  // handler (it has to — the design's state is unreliable here), which means nothing else was left to
  // show #dwWithdraw. The tab highlighted correctly and the CTA relabelled, while the Deposit form
  // stayed on screen underneath: the "Withdraw tab does not open" report, still half-true.
  // Set by wireDW once its inner painters exist; dwShow lives out here and cannot reach them directly.
  var __dwRefresh=null;
  function dwShow(mode){
    var w=(mode==="withdraw");
    qa("[data-dw]").forEach(function(b){ b.classList.toggle("active", b.getAttribute("data-dw")===mode); });
    var dp=q("#dwDeposit"), wd=q("#dwWithdraw");
    if(dp)dp.style.display=w?"none":"";
    if(wd)wd.style.display=w?"":"none";
    // Repaint through the bridge, NOT by calling syncCta/withRecv directly: those are declared inside
    // wireDW and are not in scope here, so the calls threw ReferenceError straight into the catch and the
    // panel switched without ever being painted — leaving the design's baked "620.30 / 1,860.90" on show.
    if(__dwRefresh)__dwRefresh();
  }
  function rangeShow(lbl){
    qa(".tf-mini button").forEach(function(b){ b.classList.toggle("active",(b.textContent||"").trim().toUpperCase()===lbl); });
    __lxRangeSel=lbl;                                   // chDraw prefers this over the design state
    try{ chDraw(); }catch(_){}
  }
  // Pool Activity metric dropdown (Pool TVL / Volume).
  //
  // Unlike the range strip, the design's OWN click handler for this menu works — it opens/closes the menu,
  // updates its state and rewrites the trigger's label. The only thing missing on a handset is the click.
  // So do not reimplement it: driving the chart ourselves while the design kept its stale state meant the
  // button still read "Pool TVL" while volume bars were drawn (the design rewrites that label from its own
  // state, so re-asserting our own text just fought it). Synthesise the click and let the design lead;
  // we only note the choice so chDraw agrees.
  function metricNote(el){
    __lxMetricSel=/volume/i.test(el.textContent||"")?"volume":"tvl";
    [40,160,400,800].forEach(function(ms){ setTimeout(function(){ try{ chDraw(); }catch(_){} },ms); });
  }
  // Selecting a filter only owns the button state and the filter itself; which rows end up visible is
  // txApplyM's job, exactly as the desktop strip defers to txApply. keepPage is for the re-render path,
  // where the rows were rebuilt underneath a reader who is sitting on page 3 and should stay there.
  // ---- Deposits / Withdrawals: reach back for them ------------------------------------------------
  // LP actions are RARE next to swaps and the ratio is not close. Measured on the XLM/USDC pool: 600
  // operations covered 5.5 hours and contained 344 + 253 path payments against ONE deposit and ONE
  // withdrawal. So the load-time window can never be deep enough for these two filters -- it would have
  // to hold ~7,500 operations to show 25 withdrawals, which is not something every pool page should pay
  // for on the chance somebody clicks.
  //
  // Instead the crawl continues from where the initial one stopped, only when one of those filters is
  // chosen and only while it is short, bounded by a scan ceiling. Swaps and All never trigger it: they
  // are already saturated by the first 600.
  // MIN and MAX are measured, not chosen. On the XLM/USDC pool, 3,000 operations -- 15 requests -- reach
  // back 24.9 hours and contain 8 deposits and 2 withdrawals. Chasing 20 withdrawals would take roughly
  // 150 requests, which is one and a half times the entire five-minute Horizon budget spent to add two
  // rows, and would throttle everything else on the page. So the target is 8 (reachable for deposits,
  // and it stops the crawl early when it is met) and the ceiling is 3,000 operations. Withdrawals will
  // often still come up short -- which is the truth about the pool, and the note below says so plainly
  // rather than leaving a number that looks like a bug.
  var LPQ={cursor:null, scanned:0, hex:"", busy:0, done:0, MIN:8, MAX:3000};
  // Which filter is live depends on the LAYOUT, and both variables always hold a string. txFiltM defaults
  // to "all", which is truthy, so (txFiltM||txFilt) silently resolved to "all" on desktop and every
  // crawl bailed on its first line -- the button changed to "Looking..." and nothing else ever happened.
  // The table only exists in the desktop layout, so that is the honest test.
  function lpKind(){ return q("table.tx tbody") ? txFilt : txFiltM; }
  function lpCount(kind){ var t=(DET&&DET.txs)||[], n=0;
    for(var i=0;i<t.length;i++) if(t[i].type===kind) n++; return n; }
  function lpSpan(){ var t=(DET&&DET.txs)||[]; if(t.length<2) return "";
    var a=t[t.length-1].time, b=t[0].time; if(!(a>0&&b>a)) return "";
    var h=(b-a)/3600000;
    return " (about "+(h<48?(Math.round(h)+" hour"+(Math.round(h)===1?"":"s")):(Math.round(h/24)+" days"))+")"; }
  function lpDeepen(kind,after){
    if(!DET||!LPQ.cursor||LPQ.busy||LPQ.done) return;
    if(kind!=="deposit"&&kind!=="withdraw") return;
    if(lpCount(kind)>=LPQ.MIN) return;
    LPQ.busy=1; step();
    function stop(fin){ LPQ.busy=0; if(fin)LPQ.done=1;
      // repaint so the note stops saying "Looking" and reports the depth actually reached
      try{ if(after)after(); }catch(_){}
      try{ if(q("table.tx tbody"))txApply(); else txApplyM(); }catch(_){} }
    function step(){
      if(!LPQ.cursor||LPQ.scanned>=LPQ.MAX){ stop(1); return; }
      getJSON(LPQ.cursor).then(function(r){
        var recs=(r&&r._embedded&&r._embedded.records)||[];
        if(!recs.length){ stop(1); return; }
        LPQ.cursor=(r&&r._links&&r._links.next&&r._links.next.href)||null;
        LPQ.scanned+=recs.length;
        var added=0;
        recs.forEach(function(o){
          var ts=Date.parse(o.created_at||"")||0;
          // same mapping as the initial pass -- amt() and DET.txs shape are shared
          if(o.type==="liquidity_pool_deposit"){ var a=amt(o.reserves_deposited);
            DET.txs.push({type:"deposit",xlm:a.x,tok:a.t,who:o.source_account,time:ts,op:String(o.id||"")}); added++; }
          else if(o.type==="liquidity_pool_withdraw"){ var b=amt(o.reserves_received||o.reserves_min);
            DET.txs.push({type:"withdraw",xlm:b.x,tok:b.t,who:o.source_account,time:ts,op:String(o.id||"")}); added++; }
        });
        if(added){ DET.txs.sort(function(x,y){ return y.time-x.time; }); try{ if(after)after(); }catch(_){} }
        if(lpCount(kind)>=LPQ.MIN){ LPQ.busy=0; return; }
        step();
      }).catch(function(){ LPQ.busy=0; });
    }
  }
  // REMOVER ONLY. This used to append "Searched the last 600 pool operations (about 185 days)." under the
  // transactions card, on the reasoning that "2 withdrawals" reads like a fault until you know it means 2
  // out of 600. That reasoning still holds, but the line as built did not: it had no stylesheet rule, so it
  // inherited page body type and landed under the card as loose sentence-case prose rather than a footnote,
  // reading as stray text. Removed on request.
  //
  // The same depth is still stated where it actually resolves an ambiguity -- the EMPTY state, which says
  // "No withdraw in the last 600 pool operations (about 185 days)." There a zero is genuinely misleading
  // without it. That one is inside the list and styled with it, and is deliberately kept.
  //
  // Kept as a function rather than deleted at the call sites so a node left over from a cached page still
  // gets cleaned rather than sitting there forever.
  //
  // Also still true: there is no "keep looking" control here, unlike the Trade-asset one. A deeper crawl is
  // written (lpDeepen) and it demonstrably runs -- it walks to the 3,000-operation ceiling -- but the rows
  // it should append never reached DET.txs and I have not isolated why. Shipping a control that spends ten
  // Horizon requests and then changes nothing on screen is worse than not offering it, so it stays
  // unhooked until the append is understood and proven.
  function lpDepthNote(host){
    if(!host) return;
    var n=host.querySelector(".lx-lpdepth");
    if(n&&n.parentNode)n.parentNode.removeChild(n);
  }
  function txFilterM(label,keepPage){
    var f=String(label||"").trim().toLowerCase();
    qa(".tx-filter-m button").forEach(function(b){ b.classList.toggle("active",(b.textContent||"").trim().toLowerCase()===f); });
    txFiltM=(f.indexOf("swap")===0)?"swap":((f.indexOf("deposit")===0)?"deposit":((f.indexOf("withdraw")===0)?"withdraw":"all"));
    txFiltLabelM=f||"all";
    if(!keepPage)txPageM=0;
    txApplyM();
  }
  // Phone equivalent of txApply: one pass that filters, then reveals only the current page's slice, then
  // reconciles the footer. The phone card has no pager markup of its own, so txFootM builds one.
  var txPageM=0, txFiltM="all", txFiltLabelM="all";
  function txFootM(box){
    var foot=box.querySelector(".lx-txfoot-m");
    if(!foot){
      foot=document.createElement("div"); foot.className="lx-txfoot-m";
      foot.innerHTML='<div class="lx-txinfo"></div><div class="controls">'
        +'<button type="button" data-txpg="prev">\\u2039 Prev</button>'
        +'<span class="lx-txpg"></span>'
        +'<button type="button" data-txpg="next">Next \\u203a</button></div>';
      box.appendChild(foot);
    }
    // rows and the empty-state notice are appended to the same card, so the pager has to be pushed back
    // to the end after any of them are added, or it ends up floating in the middle of the list
    if(box.lastElementChild!==foot)box.appendChild(foot);
    return foot;
  }
  function txApplyM(){
    var box=q(".ptab-panel[data-panel=transactions] .card"); if(!box)return;
    var rows=[].slice.call(box.querySelectorAll(".lx-txrow")).filter(function(rw){ return !rw.classList.contains("lx-txnone"); });
    var vis=rows.filter(function(rw){ return txFiltM==="all"||(rw.getAttribute("data-txtype")||"")===txFiltM; });
    var total=vis.length, pages=Math.max(1,Math.ceil(total/TXPP));
    if(txPageM>pages-1)txPageM=pages-1; if(txPageM<0)txPageM=0;
    var start=txPageM*TXPP, end=start+TXPP;
    rows.forEach(function(rw){ rw.style.display="none"; });
    vis.forEach(function(rw,i){ if(i>=start&&i<end)rw.style.display=""; });
    // A filter with no matches used to leave the panel blank, which reads as "broken" rather than
    // "this pool has had none". Say which it is.
    var none=box.querySelector(".lx-txnone");
    if(total){ if(none)none.style.display="none"; }
    else {
      if(!none){ none=document.createElement("div"); none.className="tx-item lx-txrow lx-txnone";
        none.style.cssText="justify-content:center;color:var(--text-muted);text-align:center"; box.appendChild(none); }
      none.style.display="";
      none.textContent=(txFiltM==="all")?"No transactions yet":("No "+txFiltLabelM+" in the last "+num(LPQ.scanned)+" pool operations"+lpSpan()+".");
    }
    // Even when there ARE rows, say how deep the search went: "2 withdrawals" reads like a fault until
    // you know it means 2 in the last 3,000 operations.
    try{ lpDepthNote(box,total); }catch(_){}
    var foot=txFootM(box);
    // one page of results needs no pager — hide the whole strip rather than show two dead buttons
    foot.style.display=(total>TXPP)?"":"none";
    var info=foot.querySelector(".lx-txinfo");
    if(info)setText(info,total?("Showing "+(start+1)+"\\u2013"+Math.min(end,total)+" of "+num(total)):"");
    var pb=foot.querySelectorAll("button[data-txpg]");
    if(pb[0])pb[0].disabled=(txPageM<=0);
    if(pb[1])pb[1].disabled=(txPageM>=pages-1);
    var ind=foot.querySelector(".lx-txpg");
    if(ind)setText(ind,"Page "+(txPageM+1)+" of "+pages);
  }
  function copyText(s){
    try{ if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(s); return true; } }catch(_){}
    try{ var ta=document.createElement("textarea"); ta.value=s; ta.setAttribute("readonly","");
      ta.style.cssText="position:fixed;top:0;left:0;opacity:0"; document.body.appendChild(ta);
      ta.select(); ta.setSelectionRange(0,s.length); document.execCommand("copy");
      document.body.removeChild(ta); return true; }catch(_){ return false; }
  }
  // OWN EVERY TAP TARGET ON THIS PAGE THAT THE DESIGN WIRES TO A CLICK.
  //
  // The design's handlers are click-only and on a real handset that click is not arriving, so each control
  // has to be driven from touchend as well. Bound at WINDOW CAPTURE so we run ahead of everything else.
  //
  // touchend alone is not a tap: it also ends a scroll. Without the movement/duration guard below, a swipe
  // that happens to finish over the bottom nav would navigate. Record the touchstart point and only act if
  // the finger stayed within ~12px for under 600ms.
  function wirePhoneTabs(){
    if(window.__lxPtabWired)return; window.__lxPtabWired=1;
    var t0=null;
    window.addEventListener("touchstart",function(e){
      var p=e.touches&&e.touches[0]; t0=p?{x:p.clientX,y:p.clientY,t:Date.now()}:null;
    },true);
    function isTap(e){
      if(e.type!=="touchend")return true;                       // a click is already a tap
      var p=e.changedTouches&&e.changedTouches[0]; if(!p||!t0)return false;
      return Math.abs(p.clientX-t0.x)<12&&Math.abs(p.clientY-t0.y)<12&&(Date.now()-t0.t)<600;
    }
    var act=function(e){
      var t=e.target; if(!t||!t.closest)return;
      // The global tap bridge (lx-mobnav) runs first and turns a tap into a real click. When it has done
      // so this touchend is already spent — acting on it too would run everything twice, which for a
      // toggle like the metric menu means opening and immediately closing it.
      if(e.type==="touchend"&&e.defaultPrevented)return;
      if(!isTap(e))return;
      var tb=t.closest("#ptabs button[data-ptab]");
      if(tb){ e.preventDefault(); e.stopImmediatePropagation(); ptabShow(tb.getAttribute("data-ptab")); return; }
      var rb=t.closest(".tf-mini button");
      if(rb){ e.preventDefault(); e.stopImmediatePropagation(); rangeShow((rb.textContent||"").trim().toUpperCase()); return; }
      var dw=t.closest("[data-dw]");
      if(dw){ e.preventDefault(); e.stopImmediatePropagation(); dwShow(dw.getAttribute("data-dw")); return; }
      // Metric dropdown: the design's click logic works, so hand it a click instead of replacing it.
      // preventDefault on touchend suppresses the browser's own synthesised click, so this fires once.
      var md=t.closest(".chart-mode-menu button,.chart-mode-select");
      if(md){ if(e.type==="touchend"){ e.preventDefault(); md.click(); }
        else if(md.closest(".chart-mode-menu")) metricNote(md);
        return; }
      var tf=t.closest(".tx-filter-m button");
      if(tf){ e.preventDefault(); e.stopImmediatePropagation(); txFilterM(tf.textContent); return; }
      // Pool Transactions pager. Ours entirely — no design handler to defer to — so drive it from the tap
      // and scroll the list head back into view, otherwise paging from the footer leaves the reader at the
      // bottom of a page they have not seen the top of.
      var pgb=t.closest(".lx-txfoot-m button[data-txpg]");
      if(pgb){ e.preventDefault(); e.stopImmediatePropagation();
        if(pgb.disabled)return;
        txPageM+=(pgb.getAttribute("data-txpg")==="next")?1:-1;
        txApplyM();
        try{ var hd=q(".ptab-panel[data-panel=transactions] .card"); if(hd&&hd.scrollIntoView)hd.scrollIntoView({block:"start",behavior:"smooth"}); }catch(_){}
        return; }
      var cp=t.closest(".ph-id button[data-copy],.pool-header button[data-copy]");
      if(cp){ e.preventDefault(); e.stopImmediatePropagation();
        var v=cp.getAttribute("data-copy")||"";
        var ok=copyText(v);
        try{ ammToast(ok?"Pool ID copied":"Could not copy",!ok); }catch(_){}
        return; }
      // the explorer control is a real <a target=_blank> now — the browser opens it, we stay out of the way
      // tapping anywhere else closes an open metric menu
      var om=q(".chart-mode-menu.open"); if(om&&!t.closest(".chart-mode-menu"))om.classList.remove("open");
    };
    window.addEventListener("click",act,true);
    window.addEventListener("touchend",act,true);
  }
  function pdChart(){
    var svg=q("#tvlChart svg"); if(!svg)return; wirePhoneTabs(); chHover(); chDraw();
    // The range strip ships with 1M pre-selected, but the design chart state defaults to 1Y — so on load the
    // button said 1M while the series drawn was a whole year. Press the pre-selected button once so the label
    // and the data agree; the design keeps them in step from then on.
    if(!window.__lxRangeSync){ window.__lxRangeSync=1;
      try{ var ab=q(".tf-mini .active,.tf-mini button.active");
        var st0=(window.__tvlChartState&&window.__tvlChartState())||{};
        var lbl=ab?(ab.textContent||"").trim().toUpperCase():"";
        if(ab&&lbl&&st0.range&&lbl!==String(st0.range).toUpperCase())ab.click();
      }catch(_){}
    }
    if(!window.__lxChHook){ window.__lxChHook=1;
      document.addEventListener("click",function(e){ var t=e.target; if(t&&t.closest&&t.closest(".chart-type,.tf-mini,.chart-mode-select,.chart-menu,.menu")){ [40,160,400,800].forEach(function(ms){ setTimeout(chSync,ms); }); } },true);
      setInterval(chSync,500);   // catch the design's late/animated re-renders without flicker (guarded)
    }
  }
  function txRow(t){
    var pill=t.type==="deposit"?'<span class="type-pill deposit">Deposit</span>':(t.type==="withdraw"?'<span class="type-pill withdraw">Withdraw</span>':'<span class="type-pill swap">Swap</span>');
    var when=t.time?new Date(t.time).toLocaleString():"\\u2014";
    var op=txHref(t);
    return '<tr class="lx-txrow" data-txtype="'+t.type+'">'+
      '<td>'+pill+'</td>'+
      '<td><span class="num">'+famt(t.xlm)+' '+esc(txCodeA())+'</span></td>'+
      '<td><span class="num">'+famt(t.tok)+' '+esc(txCodeB())+'</span></td>'+
      '<td>'+walletCell(t.who,22,"wallet-cell")+'</td>'+
      '<td>'+when+'</td>'+
      '<td><a class="ext-link" href="'+op+'" target="_blank" rel="noopener"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M17 7H8M17 7v9"></path></svg></a></td></tr>';
  }
  // Which asset each transaction column is denominated in. The fields are named .xlm/.tok for historical
  // reasons but on a credit/credit pool they carry a0 and a1, so labelling them "XLM" and DET.code printed
  // "28.45 XLM / 92.83 LMBW" on a DOPE/LMBW pool -- an asset that isn't in it. Both layouts read these.
  function txCodeA(){ return (DET&&DET.nonXlm&&DET.a0)?DET.a0.code:"XLM"; }
  function txCodeB(){ return (DET&&DET.nonXlm&&DET.a1)?DET.a1.code:((DET&&DET.code)||""); }
  // The row's own explorer target: the operation itself when Horizon gave us an id, the trader's account
  // otherwise. Used by both layouts so the desktop arrow and the phone arrow point at the same thing.
  function txHref(t){
    return (t&&t.op) ? ("https://stellar.expert/explorer/public/op/"+encodeURIComponent(t.op))
                     : ("https://stellar.expert/explorer/public/account/"+encodeURIComponent((t&&t.who)||""));
  }
  // Mobile has no tx TABLE: the panel is a .card holding .tx-item rows after its .card-head and
  // .tx-filter-m. Rendering desktop <tr>s into it would put table rows inside a div, so the rows get the
  // phone markup and only the rows are replaced -- the head and the filter strip stay put.
  function txRowM(t){
    var kind=(t.type==="deposit"||t.type==="withdraw")?t.type:"swap";
    var label=kind==="deposit"?"Deposit":(kind==="withdraw"?"Withdraw":"Swap");
    var when=t.time?new Date(t.time).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"}):"—";
    var amounts=famt(t.xlm)+" "+esc(txCodeA())+" ↔ "+famt(t.tok)+" "+esc(txCodeB());
    // Desktop gives each transaction a wallet IDENTICON for the counterparty. The phone left this slot
    // empty, so the design's logo painter claimed it and every row showed the same orange disc — the row
    // already says "Swap"/"Deposit"/"Withdraw" in words, so the slot is better spent identifying WHO.
    // data-lxfixed/data-logoed mark it as already-painted so the painter leaves it alone.
    return '<div class="tx-item lx-txrow" data-txtype="'+kind+'">'
      +'<div class="tx-icon '+kind+' lx-txident" data-lxfixed="1" data-logoed="1">'+ident(t.who||kind,32)+'</div>'
      +'<div class="tx-info"><div class="tx-type '+kind+'">'+label+'</div>'
      +'<div class="tx-amounts">'+amounts+'</div>'
      +(isCtr(t.who)
        ? ('<span class="tx-meta lx-nolink">'+ashort(t.who||"")+'<span class="lx-sortag">Soroban</span></span>')
        : ('<a class="tx-meta lx-acct" href="'+acctHref(t.who)+'" style="color:inherit;text-decoration:none">'+ashort(t.who||"")+'</a>'))+'</div>'
      +'<div class="tx-time">'+when+'</div>'
      // Desktop's table has a trailing explorer arrow per row; the phone card had none, so a tap could only
      // reach the trader's account via the address line. Same target, same icon, right edge of the row.
      +'<a class="lx-txext" href="'+txHref(t)+'" target="_blank" rel="noopener" aria-label="View on stellar.expert"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M17 7H8M17 7v9"></path></svg></a>'
      +'</div>';
  }
  function pdTxMobile(){
    // Attribute value left UNQUOTED on purpose. This whole script is a JS string in the transform, so the
    // \" I first wrote here reached the browser as a bare " and closed the selector string early — a parse
    // error that killed the entire layer, not just this function. CSS allows an unquoted value when it is a
    // valid identifier, so there is no quote left to lose.
    var d=DET; var it=q(".ptab-panel[data-panel=transactions] .tx-item,.ptab-panel[data-panel=transactions] .lx-txrow");
    var box=it?it.parentElement:q(".ptab-panel[data-panel=transactions] .card");
    if(!box)return true;
    var want=d.txs.length||1;
    // count real rows only — the "no deposits…" placeholder is ours and would otherwise make the count
    // never match, re-rendering the whole list on every pass
    if(box.querySelectorAll(".lx-txrow:not(.lx-txnone)").length!==want){
      [].slice.call(box.querySelectorAll(".tx-item")).forEach(function(r){ if(r.parentNode)r.parentNode.removeChild(r); });
      box.insertAdjacentHTML("beforeend", d.txs.length?d.txs.map(txRowM).join("")
        :('<div class="tx-item lx-txrow" style="justify-content:center;color:var(--text-muted)">'+(d.txFail?"Couldn\\u2019t load this pool\\u2019s transactions":"No transactions yet")+'</div>'));
      // rows were just replaced -> they are all visible again; re-apply whatever filter is selected,
      // keeping the reader on the page they were on
      var af=q(".tx-filter-m button.active");
      try{ txFilterM(af?af.textContent:"all",true); }catch(_){}
    }
    else { try{ txApplyM(); }catch(_){} }   // no re-render: still reconcile the pager (first paint, tab switch)
    try{ txFailNote(box); }catch(_){}
    return true;
  }
  // ---- Pool Transactions: filtering and paging over ONE list ----------------------------------------
  // The design ships a Prev/Next footer that paged its own mock rows. We replace the tbody with the real
  // ones and never wired those buttons, so every page showed the same transactions. Filter and page are
  // now the same pass: pick the rows matching the filter, then reveal only the current page's slice.
  // When the trades or operations fetch failed, whatever rows we do have are a PARTIAL list — the pool that
  // showed "1 transaction" really had 101. Say so above the list, with a retry, instead of letting the count
  // pass for the truth. Removes itself once a later load succeeds.
  function txFailNote(host){
    if(!host)return;
    var n=host.querySelector(".lx-txfail");
    if(!DET||!DET.txFail){ if(n&&n.parentNode)n.parentNode.removeChild(n); return; }
    if(n)return;
    n=document.createElement("div"); n.className="lx-txfail";
    n.style.cssText="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 16px 12px;padding:9px 12px;border:1px solid rgba(234,106,44,.38);background:rgba(234,106,44,.10);border-radius:9px;font-size:12.5px;color:var(--text-muted)";
    n.innerHTML='<span>Some transactions couldn\\u2019t be loaded \\u2014 this list may be incomplete.</span>';
    var b=document.createElement("button"); b.type="button"; b.textContent="Retry";
    b.style.cssText="margin-left:auto;padding:5px 12px;border-radius:8px;border:1px solid var(--border);background:transparent;color:inherit;font:600 12px/1 'Hanken Grotesk',sans-serif";
    b.addEventListener("click",function(e){ e.preventDefault(); e.stopPropagation(); b.disabled=true; b.textContent="Retrying\\u2026"; try{ loadDetail(); }catch(_){} });
    n.appendChild(b);
    var head=host.querySelector(".tx-head")||host.querySelector(".card-head");
    if(head&&head.nextSibling)host.insertBefore(n,head.nextSibling); else host.insertBefore(n,host.firstChild);
  }
  var TXPP=20, txPage=0, txFilt="all";
  function txAll(){ return qa("table.tx tbody .lx-txrow").filter(function(rw){ return !rw.classList.contains("lx-txnone"); }); }
  // pdTx() ends by calling txApply(), and txApply() now has to call pdTx() to re-render the page slice --
  // so without this guard the two call each other forever. The guard makes the pairing safe in both
  // directions: entering through either one runs the render once and the footer once.
  var __txInApply=0;
  function txApply(){
    if(__txInApply) return;
    __txInApply=1;
    // The rows in the DOM ARE the current page now, so there is nothing left to hide: re-render instead
    // of walking 647 elements setting style.display, which was both the slow part and a forced reflow.
    try{ pdTx(); }catch(_){}
    __txInApply=0;
    var s=txSlice();
    var foot=q(".tx-foot");
    if(!foot) return;                                     // no pager in this layout
    var total=s.all.length, pages=s.pages;
    var start=txPage*TXPP, end=start+s.rows.length;
    try{ lpDepthNote(q(".tx-card")||foot.parentNode); }catch(_){}
    var lbl=[].slice.call(foot.children).filter(function(c){ return !c.classList.contains("controls"); })[0];
    if(lbl)setText(lbl,total?("Showing "+(start+1)+"\\u2013"+Math.min(end,total)+" of "+num(total)+" transactions"):"No transactions");
    var btns=foot.querySelectorAll(".controls button");
    if(btns[0])btns[0].disabled=(txPage<=0);
    if(btns[1])btns[1].disabled=(txPage>=pages-1);
    var ctr=foot.querySelector(".controls");
    var ind=ctr&&ctr.querySelector(".lx-txpg");
    if(ctr&&!ind){                                            // the design ships bare Prev/Next: add the page chip
      ind=document.createElement("span"); ind.className="lx-txpg";
      ind.style.cssText="margin:0 12px;color:var(--text-soft);font-size:13px";
      ctr.insertBefore(ind, btns[1]||null);
    }
    if(ind)setText(ind,"Page "+(txPage+1)+" of "+pages);
  }
  // RENDER ONE PAGE, NOT THE WHOLE LIST. This used to build every transaction as a row and then hide all
  // but twenty with display:none. Measured on the SSLX/STARDUST pool: 647 rows rendered, 20 visible, and
  // 18,535 of the document's 20,937 nodes sat inside that tbody -- 89% of the page -- carrying 7,285 SVG
  // rects of identicon in rows nobody could see. Hidden nodes still cost style recalculation and memory on
  // every scroll, which is what made the page drag.
  //
  // Slicing before rendering is also what makes the pager honest: it now describes the rows that exist
  // rather than a hidden backlog.
  function txSlice(){
    var t=(DET&&DET.txs)||[];
    var f=[]; for(var i=0;i<t.length;i++) if(txFilt==="all"||t[i].type===txFilt) f.push(t[i]);
    var pages=Math.max(1,Math.ceil(f.length/TXPP));
    if(txPage>pages-1)txPage=pages-1; if(txPage<0)txPage=0;
    return {all:f,pages:pages,rows:f.slice(txPage*TXPP,(txPage+1)*TXPP)};
  }
  function pdTx(){
    var d=DET; var tb=q("table.tx tbody"); if(!tb){ pdTxMobile(); return; }
    tb.__lxPP=1;
    var s=txSlice();
    // identity of the slice, not just its length: paging between two equal-sized pages must still repaint
    var sig=txFilt+"|"+txPage+"|"+s.all.length+"|"+((s.rows[0]&&s.rows[0].op)||"")+"|"+((s.rows[s.rows.length-1]&&s.rows[s.rows.length-1].op)||"");
    if(tb.__lxtxsig!==sig || !tb.querySelector(".lx-txrow")){
      tb.__lxtxsig=sig;
      tb.innerHTML=s.rows.length?s.rows.map(txRow).join(""):('<tr class="lx-txrow"><td colspan="6" style="text-align:center;color:var(--text-muted);padding:22px">'+(d.txFail?"Couldn\\u2019t load this pool\\u2019s transactions":(d.txs.length?("No "+txFilt+"s in the last "+num(LPQ.scanned||0)+" pool operations"):"No transactions yet"))+'</td></tr>');
    }
    txFailNote(q(".tx-card")||tb.closest("table").parentNode);
    // Prev/Next, bound once. Capture + stopImmediatePropagation so the design's own pager (which walks
    // its mock rows) cannot also run and fight us over the same buttons.
    var foot=q(".tx-foot");
    if(foot&&!foot.__lxPg){ foot.__lxPg=1;
      var pb=foot.querySelectorAll(".controls button");
      if(pb[0])pb[0].addEventListener("click",function(e){ e.preventDefault(); e.stopImmediatePropagation(); txPage--; txApply(); },true);
      if(pb[1])pb[1].addEventListener("click",function(e){ e.preventDefault(); e.stopImmediatePropagation(); txPage++; txApply(); },true);
    }
    var bar=q(".tx-filter");
    if(bar&&!bar.__lxf){ bar.__lxf=1;
      qa(".tx-filter button").forEach(function(b){ b.parentNode.replaceChild(b.cloneNode(true),b); });  // strip the design's own filter listeners
      var fb=qa(".tx-filter button");
      fb.forEach(function(b){ b.addEventListener("click",function(e){ e.stopPropagation(); fb.forEach(function(x){x.classList.remove("active");}); b.classList.add("active"); var f=b.textContent.trim().toLowerCase();
        txFilt=(f.indexOf("swap")===0)?"swap":((f.indexOf("deposit")===0)?"deposit":((f.indexOf("withdraw")===0)?"withdraw":"all"));
        txPage=0;                       // a new filter starts at its first page, not wherever you were
        txApply();
      }); });
    }
    txApply();
  }
  function pdAssetRow(a,name,ico,amt){ if(!a)return; var icoEl=a.querySelector(".mp-asset-ico,.mpm-asset-ico"); if(icoEl){ icoEl.setAttribute("data-lxfixed","1"); icoEl.style.overflow="hidden"; if(icoEl.getAttribute("data-lxd")!=="1"){icoEl.setAttribute("data-lxd","1");icoEl.innerHTML=ico;} } var nm=a.querySelector(".mp-asset-name,.mpm-asset-name"); if(nm)setText(nm,name); var am=a.querySelector(".mp-asset-amt,.mpm-asset-amt"); if(am)setText(am,amt); }
  function pdPosition(){
    var d=DET; var mp=q(".my-position,.my-position-m"); if(!mp)return;
    // Header: rename "My Position" -> "Position Value" and drop the irrelevant top "100%" pill (per user);
    // the position value moves up (the redundant inner "Position Value" label is hidden).
    var head=mp.previousElementSibling; if(head&&/side-head/.test(String(head.className||""))){
      [].slice.call(head.childNodes).forEach(function(nd){ if(nd.nodeType===3&&/my position/i.test(nd.textContent))nd.textContent="Position Value"; });
      [].slice.call(head.querySelectorAll("*")).forEach(function(el){ if(el.children.length===0&&/^\\s*my position\\s*$/i.test(el.textContent||""))el.textContent="Position Value"; });
    }
    var sp=q(".position-share-pill,.mpm-share"); if(sp)sp.style.display="none";
    var lbl0=mp.querySelector(".mp-label,.mpm-label"); if(lbl0)lbl0.style.display="none";
    var assets=qa(".mp-asset,.mpm-asset");
    if(d.myFrac>0){
      mp.classList.add("active");
      var myUsd=d.tvlUsd*d.myFrac;
      var amt=q(".mp-amount .lc-money,.mpm-amount .lc-money")||q(".mp-amount,.mpm-amount"); setMoneyEl(amt,myUsd,d.tvlUsd>0?usd(myUsd):"\\u2014");
      var pill=q(".position-share-pill,.mpm-share"); if(pill)setText(pill,(d.myFrac*100>=0.01?(d.myFrac*100).toFixed(2):"<0.01")+"%");
      var pnl=q(".mp-pnl,.mpm-pnl"); if(pnl)pnl.innerHTML='<span style="color:var(--text-muted)">'+(d.myFrac*100>=0.01?(d.myFrac*100).toFixed(2):"<0.01")+'% of pool \\u00b7 current value</span>';
      if(d.nonXlm){ pdAssetRow(assets[0],d.a0.code,genLogo(d.a0),famt(d.a0.amt*d.myFrac)); pdAssetRow(assets[1],d.a1.code,genLogo(d.a1),famt(d.a1.amt*d.myFrac)); }
      else { pdAssetRow(assets[0],d.code,tokLogo(),famt(d.tok*d.myFrac)); pdAssetRow(assets[1],"XLM",xlmLogo(),famt(d.xlm*d.myFrac)); }
    } else {
      mp.classList.remove("active");
      // Mobile ships no .mpm-value wrapper — just .mpm-amount and .mpm-pnl — so the desktop path left the
      // baked "$1,247.50 / +$32.18 (2.65%)" untouched on a wallet with no position in this pool.
      var mAmt=q(".mpm-amount"), mPnl=q(".mpm-pnl"), mShare=q(".mpm-share");
      if(mAmt&&!q(".mp-value,.mpm-value")){
        mAmt.textContent="—";
        if(mPnl)mPnl.innerHTML='<span style="color:var(--text-muted)">'+(myAddr()?"No position in this pool":"Connect a wallet to see your position")+'</span>';
        if(mShare)mShare.textContent="0%";
      }
      var val=q(".mp-value,.mpm-value"); if(val)val.innerHTML='<div class="mp-label">Your Position</div><div class="mp-amount">\\u2014</div><div class="mp-pnl" style="color:var(--text-muted)">'+(myAddr()?"You have no liquidity in this pool":"Connect your wallet to see your position")+'</div>';
      if(d.nonXlm){ pdAssetRow(assets[0],d.a0.code,genLogo(d.a0),"0"); pdAssetRow(assets[1],d.a1.code,genLogo(d.a1),"0"); }
      else { pdAssetRow(assets[0],d.code,tokLogo(),"0"); pdAssetRow(assets[1],"XLM",xlmLogo(),"0"); }
    }
    // The "Earned fees" ($8.92) + "LP tokens" (23,415.82) rows are baked mock. LP tokens = the real LP-share
    // balance; earned fees can't be derived without a deposit cost-basis, so show "—" instead of a fake number.
    qa(".my-position .mp-fee-row,.my-position-m .mpm-fee-row").forEach(function(rw){ var lab=(rw.querySelector(".mp-fee-label,.mpm-fee-label")||{}).textContent||""; var val=rw.querySelector(".mp-fee-val,.mpm-fee-val"); if(!val)return;
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
  // Mobile names the inner cells .wallet/.share and adds a .share-bar meter; desktop uses
  // .part-addr/.part-share. Same row, two skins.
  function partRow(p,mob){
    var ex="https://stellar.expert/explorer/public/account/"+encodeURIComponent(p.addr);
    var pct=(p.frac*100>=0.01?(p.frac*100).toFixed(2):"<0.01")+"%";
    if(mob) return '<div class="part-row lx-partrow"><div class="part-avatar">'+ident(p.addr,26)+'</div>'
      +'<a class="wallet lx-acct" href="/account/stellar/'+p.addr+'" style="color:inherit;text-decoration:none">'+ashort(p.addr)+'</a>'
      +'<div class="share">'+pct+'</div>'
      +'<div class="share-bar"><div class="fill" style="width:'+Math.min(100,p.frac*100).toFixed(2)+'%"></div></div></div>';
    return '<div class="part-row lx-partrow"><div class="part-avatar">'+ident(p.addr,26)+'</div>'+
      '<a class="part-addr lx-acct" href="/account/stellar/'+p.addr+'" style="color:inherit;text-decoration:none">'+ashort(p.addr)+'</a>'+
      '<span class="part-share">'+(p.frac*100>=0.01?(p.frac*100).toFixed(2):"<0.01")+'%</span></div>';
  }
  // PARTICIPANTS PAGE IN STEP WITH TRANSACTIONS. The two lists sit side by side, so rendering 100 wallets
  // beside 20 transactions left the right column running hundreds of pixels past the left and the page
  // scrolling on into empty space. Same page size as the tx list, same slice-before-render rule, so the
  // columns end together and the DOM stays small.
  var PARTPP=TXPP, partPage=0;
  function partSlice(){
    var t=(DET&&DET.parts)||[];
    var pages=Math.max(1,Math.ceil(t.length/PARTPP));
    if(partPage>pages-1)partPage=pages-1; if(partPage<0)partPage=0;
    return {all:t,pages:pages,rows:t.slice(partPage*PARTPP,(partPage+1)*PARTPP)};
  }
  function pdParts(){
    var d=DET; var list=q("#partList,#participantsList"); if(!list)return;
    list.__lxPP=1;  // block the design's participant paginator/cloner
    var s=partSlice(), mob=(list.id==="participantsList");
    var sig=partPage+"|"+s.all.length+"|"+((s.rows[0]&&s.rows[0].addr)||"")+"|"+((s.rows[s.rows.length-1]&&s.rows[s.rows.length-1].addr)||"");
    if(list.__lxpsig!==sig || !list.querySelector(".lx-partrow")){
      list.__lxpsig=sig;
      list.innerHTML=s.rows.length?s.rows.map(function(_p){return partRow(_p,mob);}).join(""):'<div class="part-row lx-partrow" style="justify-content:center;color:var(--text-muted)">No liquidity providers yet</div>';
    }
    var pg=q("#lx-partpage"); if(pg)pg.style.display="none";
    qa(".part-count, .participants-count, [data-partcount]").forEach(function(e){ setText(e,String(d.parts.length)); });
    // the design mocks the participant count ("847") in the "Participants" side-head pill — set the real count.
    qa(".count-pill").forEach(function(e){ var sh=e.closest&&e.closest(".side-head"); if(sh&&/participant/i.test(sh.textContent||""))setText(e,String(d.parts.length)); });
    partFoot(list,s);
  }
  // The footer the design ships for this list is .part-foot (an info line + a .nav of Prev/Next). Reuse it
  // when it exists rather than building a second control beside it, and own its buttons outright -- the
  // design's own handler pages a cloned mock list.
  function partFoot(list,s){
    var card=(list.closest&&(list.closest(".side-card")||list.closest(".pools-card")))||list.parentElement;
    if(!card)return;
    var foot=card.querySelector(".part-foot");
    if(!foot){ foot=document.createElement("div"); foot.className="part-foot lx-partfoot";
      foot.innerHTML='<div></div><div class="nav"></div>'; card.appendChild(foot); }
    if(card.lastElementChild!==foot)card.appendChild(foot);
    var info=foot.querySelector("div"), nav=foot.querySelector(".nav");
    var from=s.all.length?(partPage*PARTPP+1):0, to=partPage*PARTPP+s.rows.length;
    if(info)setText(info, s.all.length?("Viewing "+from+" \\u2013 "+to+" of "+num(s.all.length)):"No liquidity providers yet");
    if(!nav)return;
    if(!nav.__lxw){ nav.__lxw=1;
      nav.innerHTML='<button type="button" data-pp="prev">\\u2039</button><span class="lx-pppg"></span><button type="button" data-pp="next">\\u203a</button>';
      nav.addEventListener("click",function(e){
        var b=e.target&&e.target.closest?e.target.closest("[data-pp]"):null; if(!b||b.disabled)return;
        e.preventDefault(); e.stopImmediatePropagation();
        partPage+=(b.getAttribute("data-pp")==="next")?1:-1;
        try{ pdParts(); }catch(_){}
      },true);
    }
    var bs=nav.querySelectorAll("[data-pp]"), chip=nav.querySelector(".lx-pppg");
    if(bs[0])bs[0].disabled=(partPage<=0);
    if(bs[1])bs[1].disabled=(partPage>=s.pages-1);
    if(chip)setText(chip,"Page "+(partPage+1)+" of "+s.pages);
    foot.style.display=(s.pages>1)?"":"";
  }
  function pdCopy(){
    var d=DET;
    try{ document.title=(d.pairName||(d.code+" / XLM"))+" liquidity pool on Stellar | LumosCore"; }catch(e){}
    var cr=q(".crumb"); if(cr){ [].slice.call(cr.querySelectorAll("*")).forEach(function(e){ var t=e.textContent||""; if(e.children.length===0&&t.indexOf("LUMOS")>=0&&(t.indexOf("XLM")>=0||t.indexOf("APT")>=0))setText(e,d.pairName||(d.code+" / XLM")); }); }
  }
  // AUDIT (user-reported, pool 344e66\\u2026): one painter throwing killed every LATER painter, so the whole
  // right rail (position, deposit/withdraw) stayed on the design mock — a fake $1,247.50 position on a real
  // pool. Isolate each painter: one failure can no longer take the rest of the page down with it.
  // USD for a credit/credit pool.
  //
  // loadDetail only ever derived USD two ways: XLM reserve x XLM price, or a USDC leg taken at $1. A pool of
  // two other credit assets therefore had tvlUsd = 0, and every USD readout on the page collapsed to a dash:
  // "Liquidity ... = —", no $ under 24h volume or fees, no $ on the position, and the chart hover (which asks
  // for the same rate) showed no USD line at all. The assets ARE priceable — Horizon will quote a path to
  // USDC for them — so ask, once, and repaint.
  //
  // The probe sends 0.1% of the reserve rather than a round 100 units: on a shallow pool a large probe walks
  // its own price down and the quote comes back meaningfully low.
  var USDC_ISSUER="GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
  function pxUsd(a,cb){
    if(!a||!a.code){ cb(0); return; }
    if(a.native||a.code==="XLM"){ cb((DET&&DET.xlmUsd)||0); return; }
    if(a.code==="USDC"&&a.issuer===USDC_ISSUER){ cb(1); return; }
    var samp=Math.max(0.0000001,(+a.amt||100)*0.001);
    var u=H+"/paths/strict-send?source_asset_type=credit_alphanum"+(a.code.length>4?"12":"4")
      +"&source_asset_code="+encodeURIComponent(a.code)+"&source_asset_issuer="+encodeURIComponent(a.issuer)
      +"&source_amount="+samp.toFixed(7)
      +"&destination_assets="+encodeURIComponent("USDC:"+USDC_ISSUER);
    getJSON(u).then(function(r){
      var recs=(r&&r._embedded&&r._embedded.records)||[], best=0;
      recs.forEach(function(x){ var dv=+x.destination_amount||0; if(dv>best)best=dv; });
      cb(best>0?(best/samp):0);
    }).catch(function(){ cb(0); });
  }
  function ensureUsd(){
    var d=DET; if(!d||!d.nonXlm||d.__usdTried||d.tvlUsd>0)return; d.__usdTried=1;
    pxUsd(d.a0,function(px){
      if(!(px>0)||DET!==d)return;
      d.usdPerA0=px;
      d.tvlUsd=(d.a0.amt||0)*2*px;
      d.priceUsd=(d.pxA0perA1||0)*px;   // price is quoted a0-per-a1, so a0's USD rate converts it
      d.vol24Usd=(d.vol24Xlm||0)*px;    // .vol24Xlm/.fees24Xlm hold a0 amounts on a non-XLM pool
      d.fees24Usd=(d.fees24Xlm||0)*px;
      try{ paintDetail(); }catch(_){}
    });
  }
  function paintDetail(){ if(!DET)return;
    try{ ensureUsd(); }catch(_){}
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
    // A phone has no LOBSTR extension — that session signs over WalletConnect instead. Only true when
    // the connect step recorded transport=wc, so extension sessions still take the line below.
    if((w==="lobstr"||w==="walletconnect")&&window.__lxWcActive&&window.__lxWcActive())return window.__lxWcSign(xdr,WPASS);
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
    var view=hash?(' \\u00b7 <a href="https://stellar.expert/explorer/public/tx/'+hash+'" target="_blank" rel="noopener">View on Explorer</a>'):'';
    var stack=document.querySelector(".lx-ctoast-stack"); if(!stack){ stack=document.createElement("div"); stack.className="lx-ctoast-stack"; document.body.appendChild(stack); }
    var t=document.createElement("div"); t.className="lx-ctoast"+(isErr?" lxa-terr":""); t.innerHTML='<span class="ci">'+CK+'</span><span>'+esc(msg||"")+view+'</span>'; stack.appendChild(t);
    // A toast carrying a link has to outlive the reflex to reach for it — 3.2s was not enough to notice
    // the link, move to it and tap, which is its own way of "leading nowhere". Give linked toasts 9s.
    setTimeout(function(){ t.style.transition="opacity .22s,transform .22s"; t.style.opacity="0"; t.style.transform="translateY(8px)"; setTimeout(function(){ if(t.parentNode)t.parentNode.removeChild(t); },240); }, isErr?4000:(hash?9000:3200)); }
  function wMsg(btn, text, isErr, hash){ var el=btn.parentNode.querySelector(":scope > .lx-dwmsg"); if(!text){ if(el)el.style.display="none"; return; }
    var view=(hash?' \\u00b7 <a href="https://stellar.expert/explorer/public/tx/'+hash+'" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">View on Explorer</a>':'');
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
        // adding or withdrawing liquidity moves LUMOS between wallet and pool, and the fee tier now counts
        // both — tell the resolver to re-read rather than leave it on the figure it took at page load
        try{ if(window.__lxFeeTierRefresh)window.__lxFeeTierRefresh(); }catch(_){}
        setTimeout(restore,2500); })                              // brief "\\u2713 Done", then usable again
      .catch(function(e){ restore(); wMsg(btn,(e&&e.message)||"Transaction failed.",true); });
  }
  function wCtaText(btn,txt){ var tn=null; [].slice.call(btn.childNodes).forEach(function(n){ if(n.nodeType===3&&n.textContent.trim())tn=n; }); if(tn)tn.textContent=" "+txt; else btn.appendChild(document.createTextNode(" "+txt)); }

  // ---- DETAIL: Add Liquidity + Withdraw (shares the one .dw-cta; action = active tab) ----
  //
  // The whole engine used to be gated on ".dw-card", which ONLY THE DESKTOP layout has — the phone puts
  // the same tabs, panels and CTA inside a plain .card, with the button as #dwCta. So wireDW returned on
  // its first line on mobile and nothing below ever ran: no CTA wiring, no ?act=withdraw deep link, and
  // no withRecv, which is why the phone's "You receive" rows still showed the design's baked
  // 620.30 LUMOS / 1,860.90 APT and their asset cells stayed masked (they are hidden until wrSide claims
  // them). Resolve both by shape instead of by the desktop-only wrapper.
  function dwCard(){ var c=q(".dw-card"); if(c)return c; var t=q(".dw-tabs"); return (t&&t.parentNode)||null; }
  function dwCta(){ return q(".dw-card .dw-cta")||q("#dwCta")||q(".dw-cta"); }
  function wireDW(){
    if(window.__lxDWwired||!DET)return; var card=dwCard(); if(!card)return; window.__lxDWwired=1;
    // Publish the repaint entry point for dwShow (function declarations below are hoisted).
    __dwRefresh=function(){ try{ syncCta(); }catch(_){} try{ if(isWith())withRecv(); }catch(_){} };
    // Ratio of the SECOND deposit field to the FIRST, whatever those two assets are.
    //
    // It used to be d.xlm/d.tok unconditionally. On a pool with no XLM leg d.xlm is 0 by construction, so
    // r was 0, and typing in the first field wrote 0 into the second -- one of the reasons deposits here
    // were blocked rather than merely unwired.
    //
    // Field order matches paintDeposit: XLM pool -> [token, XLM]; otherwise -> [a0, a1].
    var d=DET;
    var r=d.nonXlm ? ((d.a0&&d.a0.amt>0)?(d.a1.amt/d.a0.amt):0)
                   : (d.tok>0?d.xlm/d.tok:0);
    // Balance behind each field. XLM is the only one with a reserve to hold back, so only it goes
    // through usableXlm().
    function bal0(){ return d.nonXlm ? (+d.balA0||0) : (+d.balTok||0); }
    function bal1(){ return d.nonXlm ? (+d.balTok||0) : usableXlm(); }
    function code0(){ return d.nonXlm ? d.a0.code : d.code; }
    function code1(){ return d.nonXlm ? d.a1.code : "XLM"; }
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
      // Assign by POSITION. This used to read each cell's label and call the XLM one side B — which works
      // only while one side IS XLM. On a two-credit-asset pool (USDC/EURC) neither matched, so both rows
      // claimed side A, side B stayed null, and one row was never painted: it kept the design's baked
      // "620.30 LUMOS" with its asset cell still masked. The design emits the rows in reserve order, which
      // is the order withRecv passes them in.
      return {A:rows[0]||null,B:rows[1]||null}; }
    function wrSide(r,a,amtTxt){ if(!r)return;
      // Claim the cell from the multichain re-skin observer BEFORE writing the ticker. That observer
      // rewrites Aptos-era text (APT -> LUMOS/XLM) and was reverting our label straight back to the
      // mock's "LUMOS"/"APT" — the icon stayed correct because it is an <img> the logo healer re-resolves
      // from data-lxc, so the row ended up showing the USDC logo labelled LUMOS.
      if(!r.a.hasAttribute("data-lx-noswap"))r.a.setAttribute("data-lx-noswap","1");
      var _hasTxt=false;
      [].slice.call(r.a.childNodes).forEach(function(nd){ if(nd.nodeType===3&&nd.textContent.trim()){ _hasTxt=true; if(nd.textContent!==" "+a.code+" ")nd.textContent=" "+a.code+" "; } });
      if(!_hasTxt)r.a.appendChild(document.createTextNode(" "+a.code+" "));   // freshly built cell has no label yet
      var ic=r.a.querySelector(".ico");
      // Replace the icon unless it is ALREADY OURS AND FOR THIS ASSET. The old test was "no img present",
      // which the design's logo painter defeats: it drops its own <img> in first (the Stellar mark, since
      // the mock's second row is the native side), we then saw an img and skipped — so a DOPE/LUMOS pool
      // showed the XLM logo against the LUMOS label, permanently. Ours carry data-lxc; the painter's do
      // not, so comparing that identifies a foreign icon and a stale one from a previously viewed pool.
      var cur=ic?ic.querySelector("img"):null;
      if(ic&&(ic.getAttribute("data-logo")||!cur||cur.getAttribute("data-lxc")!==a.code)){ ic.removeAttribute("data-logo"); ic.style.removeProperty("background"); ic.style.removeProperty("background-image"); ic.setAttribute("data-lxfixed","1"); ic.style.overflow="hidden"; ic.innerHTML=genLogo(a); }
      // MUST tag: the mask rule "#dwWithdraw .dw-field .row .asset:not([data-lxpair]){visibility:hidden}"
      // hides EVERY asset cell in the panel until it is claimed. fixWithdrawPair() only ever claims the
      // first one (querySelector), i.e. the "Withdraw from position" row — so the You-Receive cells stayed
      // invisible and the row rendered as a bare number with no logo and no ticker.
      if(r.a.getAttribute("data-lxpair")!=="1")r.a.setAttribute("data-lxpair","1");
      if(r.sp.textContent!==amtTxt)r.sp.textContent=amtTxt; }
    function withRecv(){ try{ fixWithdrawPair(); }catch(_){} var w=wInEl(); var sh=parseFloat(String((w&&w.value)||"").replace(/,/g,""))||0; var frac=d.totShares>0?sh/d.totShares:0; if(frac<0)frac=0; if(frac>1)frac=1; var e=withRecvEls();
      // "You receive" is a preview of a withdrawal you have not described yet, so it has nothing to say
      // until an amount exists — and while it sat there empty-handed it displayed the design's baked
      // 620.30 / 1,860.90, which reads as a real quote. Hide the whole field until there is an amount.
      var _host=(e.A&&e.A.a.closest&&e.A.a.closest(".dw-field"))||(e.B&&e.B.a.closest&&e.B.a.closest(".dw-field"))||null;
      if(_host)_host.style.display=(sh>0)?"":"none";
      var sideA=d.nonXlm?d.a0:{code:d.code,issuer:d.issuer}, sideB=d.nonXlm?d.a1:{code:"XLM",native:true};
      var amtA=(d.nonXlm?d.a0.amt:d.tok)*frac, amtB=(d.nonXlm?d.a1.amt:d.xlm)*frac;
      wrSide(e.A,sideA,famt(amtA)); wrSide(e.B,sideB,famt(amtB));
      // "Pool share after" (remaining) in the withdraw summary
      var rem=(d.totShares-sh)>0?Math.max(0,(d.myShares-sh))/(d.totShares-sh):0; qa("#dwWithdraw .dw-summary .r, #dwWithdraw .summary .r, #dwWithdraw [class*=summary] > div").forEach(function(rw){ if(!/share/i.test(rw.textContent||""))return; var st=rw.querySelector("strong")||rw.querySelector("span:last-child"); if(st)st.textContent=(rem*100>=0.01?(rem*100).toFixed(2):(sh>0?"0.00":(d.myFrac*100).toFixed(2)))+"%"; }); }
    // Largest deposit both balances can cover at the pool's ratio. Keys are {tok,xlm} for historical
    // reasons -- they mean FIELD 1 and FIELD 2, which are only token/XLM on an XLM pool.
    function maxBal(){ var from1=r>0?bal1()/r:0; var t=Math.min(bal0(),from1); return {tok:t,xlm:t*r}; }
    function dInputs(){ return qa("#dwDeposit .dw-field input"); }   // re-query each time (design may re-create them)
    function setDep(t,x){ var di=dInputs(); if(di[0])di[0].value=fmtIn(t); if(di[1])di[1].value=fmtIn(x); shareAfter(); }
    // Delegated on the deposit panel so it survives the design re-rendering its inputs: edit one -> compute the other.
    var dpanel=q("#dwDeposit"); if(dpanel&&!dpanel.__lxDIn){ dpanel.__lxDIn=1; dpanel.addEventListener("input",function(e){ if(!e.target||e.target.tagName!=="INPUT")return; var di=dInputs(); if(e.target===di[0]){ var t=parseFloat(String(di[0].value).replace(/,/g,""))||0; if(di[1])di[1].value=fmtIn(t*r); shareAfter(); } else if(e.target===di[1]){ var x=parseFloat(String(di[1].value).replace(/,/g,""))||0; if(di[0])di[0].value=fmtIn(r>0?x/r:0); shareAfter(); } }); }
    // DELEGATED MAX/% on the deposit panel (a one-time clone dies when the design re-creates the panel on tab
    // switch -> "MAX does nothing"). Capture+stopPropagation so the design's own unbalanced handler can't also run.
    // "25%" -> 25, else 0. Written without a regex on purpose: /^\\d+(\\.\\d+)?%?$/ would arrive in the browser
    // as /^d+(.d+)?%?$/ (this code is emitted from inside a JS string) and reject every percentage button.
    function pctTxt(t){ var s=String(t).replace("%",""); var n=parseFloat(s); return (s.length&&s===String(n))?n:0; }
    if(dpanel&&!dpanel.__lxDMax){ dpanel.__lxDMax=1; dpanel.addEventListener("click",function(e){ var t=e.target; if(!t||!t.closest)return; var btn=t.closest(".max-btn, .dw-pct-b, .dw-pct button, button, [class*=max], [class*=pct]"); if(!btn||!dpanel.contains(btn))return; var txt=(btn.textContent||"").trim().toLowerCase(); if(txt!=="max"&&!pctTxt(txt))return; e.preventDefault(); e.stopPropagation(); var m=maxBal(); var f=(txt==="max")?1:((parseFloat(txt)||0)/100); if(!(m.tok*f>0)&&!(m.xlm*f>0)){ var msg=(usableXlm()<=0)?("No spendable XLM to deposit \\u2014 your "+num(d.balXlm)+" XLM is below the account reserve.") : ("You need some "+d.code+" and XLM to deposit here."); try{ ammToast(msg,true); }catch(_){ } return; } setDep(m.tok*f,m.xlm*f); },true); }
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
    var cta=dwCta(); if(!cta)return; var c2=cta.cloneNode(true); cta.parentNode.replaceChild(c2,cta); cta=c2;
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
      // The nonXlm branch used to stop here with "Deposits for X / Y aren't supported here yet". That was
      // true of the BUILDER, not of the pool: it hardcoded Asset.native() as one leg, so on a pool with no
      // XLM leg it would have funded a DIFFERENT pool than the page shows. Blocking was right; leaving it
      // blocked was not. The builder now composes both real legs and refuses unless the pool id it derives
      // matches the pool on screen, so this is an ordinary balance check for every pair.
      var c0=code0(), c1=code1(), no0=!(bal0()>0), no1=!(bal1()>0);
      if(no0&&no1) return "Adding liquidity needs both "+c0+" and "+c1+" \u2014 you have neither available.";
      if(no0) return "Adding liquidity needs both "+c0+" and "+c1+" \u2014 you have no "+c0+".";
      // A flat "no XLM" contradicts the balance shown right above the button when the wallet does hold XLM
      // but all of it is pinned by the account reserve, so that case is named.
      if(no1) return d.nonXlm ? ("Adding liquidity needs both "+c0+" and "+c1+" \u2014 you have no "+c1+".")
        : ("No spendable XLM \u2014 \u2248"+xlmKeep().toFixed(1)+" XLM must stay for the account reserve + fees.");
      return "";
    }
    // EVERY write here is diff-guarded. applyCtaState runs from the .dw-card MutationObserver, so an
    // unconditional write would re-trigger the observer forever — that is exactly what froze this page once.
    function applyCtaState(){
      var b=dwCta(); if(!b||b.__lxBusy)return;                        // mid-transaction: wRun owns the button
      var why=ctaBlockReason(), off=!!why;
      if(b.classList.contains("lx-dwoff")!==off)b.classList.toggle("lx-dwoff",off);
      if((b.getAttribute("aria-disabled")==="true")!==off){ if(off)b.setAttribute("aria-disabled","true"); else b.removeAttribute("aria-disabled"); }
      if((b.getAttribute("title")||"")!==why){ if(why)b.setAttribute("title",why); else b.removeAttribute("title"); }
      // NO visible reason under the button. An inactive Add Liquidity button already says everything a
      // sentence could: you cannot deposit what you do not hold. The paragraph explaining it read as a
      // fault on the page rather than a fact about the wallet.
      //
      // The reason still exists -- it drives the disabled state and stays on the title attribute for
      // hover/screen readers -- and any hint left over from a cached page is removed rather than left
      // stranded.
      var host=b.parentNode; if(!host)return;
      var h=host.querySelector(":scope > .lx-dwhint");
      if(h&&h.parentNode)h.parentNode.removeChild(h);
    }
    // syncLabel ONLY touches the CTA text (guarded so it settles) — this is what the observer runs. It must
    // NOT call withRecv()/shareAfter(): those write textContent INSIDE .dw-card, which the childList observer
    // would see as a mutation and re-fire forever, freezing the page (that blanked the whole pool detail page).
    // b.__lxBusy => a transaction is in flight and wRun owns the label ("Confirm in wallet…"); relabelling
    // it here would wipe the loading state the moment it was set.
    function syncLabel(){ var b=dwCta(); if(!b||b.__lxBusy)return; var want=tabIsWithdraw()?"Withdraw":"Add Liquidity"; if((b.textContent||"").replace(/\\s+/g," ").trim()!==want)wCtaText(b,want); applyCtaState(); }
    function syncCta(){ syncLabel(); if(tabIsWithdraw())withRecv(); else shareAfter(); }
    qa(".dw-tabs button").forEach(function(tb){ tb.addEventListener("click",function(){ [0,30,150,400].forEach(function(ms){ setTimeout(syncCta,ms); }); }); });
    var _dwc=dwCard(); if(_dwc&&!_dwc.__lxCtaObs){ _dwc.__lxCtaObs=1; try{ new MutationObserver(function(){ syncLabel(); }).observe(_dwc,{childList:true,subtree:true,attributes:true,attributeFilter:["class","style"]}); }catch(_){} }
    syncCta();
    if(isWith())withRecv();
    // deep-link: ?act=withdraw (e.g. from the Wallet "Remove" button) opens the Withdraw tab
    // Set the "done" flag only AFTER the tab was actually switched. It used to be set on entry, so if
    // this ran before the design had rendered .dw-tabs the deep link was consumed and never retried.
    try{ if(!window.__lxActDone && /[?&]act=withdraw/.test(location.search)){ var _wt=qa(".dw-tabs button").filter(function(b){return /withdraw/i.test(b.textContent);})[0]; if(_wt){ window.__lxActDone=1; _wt.click(); try{ dwShow("withdraw"); }catch(_){} } } }catch(e){}
    cta.addEventListener("click",function(e){ e.preventDefault(); e.stopImmediatePropagation();
      var _blk=ctaBlockReason(); if(_blk){ wMsg(cta,_blk,true); return; }
      var addr=myAddr(); if(!addr){ wMsg(cta,"Connect your Stellar wallet first.",true); return; }
      if(isWith()){
        var wel=wInEl(); var sh=parseFloat(String((wel&&wel.value)||"").replace(/,/g,""))||0;
        if(!(sh>0)){ wMsg(cta,"Enter the amount of LP shares to withdraw.",true); return; }
        if(sh>d.myShares*(1+1e-6)+1e-4){ wMsg(cta,"You hold "+fmtIn(d.myShares)+" LP shares.",true); return; }
        var shW=Math.min(sh,d.myShares);   // clamp so a rounded "Max" never exceeds the real balance (no op_underfunded)
        wRun(cta,addr,function(S){ return [ S.Operation.liquidityPoolWithdraw({liquidityPoolId:d.hex, amount:wAmt(shW), minAmountA:"0", minAmountB:"0"}) ]; }, {ok:"\\u2713 Withdrawn",okMsg:"Liquidity is withdrawn"}, function(){ var w=wInEl(); if(w)w.value=""; wHi(null);
          // Clearing the input programmatically fires no input event, so the "You receive" rows were never
          // repainted and sat there after a completed withdrawal showing the amounts you had just taken out
          // — under the design's mock LUMOS/APT labels, since nothing re-claimed them either. withRecv hides
          // the block when the amount is 0, which is exactly the state we are now in.
          try{ withRecv(); }catch(_){}
          setTimeout(loadDetail,2600); });
      } else {
        // Deposits work for ANY pair now, not only X/XLM.
        //
        // This builder used to hardcode LiquidityPoolAsset(native, token). On a pool with no XLM leg that
        // composes a DIFFERENT pool than the page shows, so depositing would have funded the wrong pool
        // with the user's money -- which is why it was blocked outright rather than left to misfire. The
        // block was correct; leaving it in place forever was not.
        //
        // Both legs are now taken from the pool's own assets, and there is a HARD GUARD below: the pool id
        // is re-derived from the assets actually composed and the deposit is refused unless it equals the
        // pool on screen. Getting the pair or the ordering wrong can no longer send funds anywhere.
        var di=dInputs();
        var v0=parseFloat(String(di[0]&&di[0].value).replace(/,/g,""))||0;
        var v1=parseFloat(String(di[1]&&di[1].value).replace(/,/g,""))||0;
        var c0=code0(), c1=code1();
        if(!(v0>0)||!(v1>0)){ wMsg(cta,"Enter both "+c0+" and "+c1+" amounts.",true); return; }
        if(v0>bal0()+1e-7){ wMsg(cta,"Not enough "+c0+" \\u00b7 balance "+fmtIn(bal0()),true); return; }
        if(v1>bal1()+1e-7){ wMsg(cta, d.nonXlm
          ? ("Not enough "+c1+" \\u00b7 balance "+fmtIn(bal1()))
          : ("Not enough XLM \\u2014 keep \\u2248"+xlmKeep().toFixed(1)+" for account reserve + fees (usable "+fmtIn(usableXlm())+" of "+fmtIn(d.balXlm)+" XLM)"),true); return; }
        wRun(cta,addr,function(S,a){
          function mk(x){ return (!x||x.native||(x.code==="XLM"&&!x.issuer))?S.Asset.native():new S.Asset(x.code,x.issuer); }
          var s0=d.nonXlm?d.a0:{code:d.code,issuer:d.issuer};
          var s1=d.nonXlm?d.a1:{code:"XLM",native:true};
          var A=mk(s0), B=mk(s1), amtA=v0, amtB=v1, poolAsset;
          // The SDK REQUIRES assetA < assetB and throws otherwise, which is what makes this swap safe:
          // A and B and their amounts move together, so maxAmountA always belongs to assetA.
          try{ poolAsset=new S.LiquidityPoolAsset(A,B,S.LiquidityPoolFeeV18); }
          catch(err){ var _t=A;A=B;B=_t; var _a=amtA;amtA=amtB;amtB=_a;
            poolAsset=new S.LiquidityPoolAsset(A,B,S.LiquidityPoolFeeV18); }
          // HARD GUARD. Derive the id of the pool these two assets actually make and refuse unless it is
          // the pool being displayed. Independent of everything above: if the pair, the ordering or the
          // fee tier were wrong, this catches it before anything is signed.
          var pid="";
          try{ pid=S.getLiquidityPoolId("constant_product",poolAsset.getLiquidityPoolParameters()).toString("hex"); }catch(_){}
          if(!pid||pid!==d.hex) throw new Error("Stopped: this deposit would fund a different pool than the one shown.");
          var ops=[];
          var hasTrust=(a.balances||[]).some(function(b){return b.asset_type==="liquidity_pool_shares"&&b.liquidity_pool_id===d.hex;});
          if(!hasTrust)ops.push(S.Operation.changeTrust({asset:poolAsset}));
          ops.push(S.Operation.liquidityPoolDeposit({liquidityPoolId:d.hex, maxAmountA:wAmt(amtA), maxAmountB:wAmt(amtB), minPrice:{n:1,d:1000000000}, maxPrice:{n:1000000000,d:1}}));
          return ops; }, {ok:"\\u2713 Added",okMsg:"Liquidity is added"}, function(){ var di=dInputs(); if(di[0])di[0].value=""; if(di[1])di[1].value=""; setTimeout(loadDetail,2600); });
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
    var LOGOS={XLM:"/assets/tokens/xlm.png",AQUA:"/assets/tokens/aqua.png",USDC:"/assets/tokens/usdc.png",yUSDC:"/assets/tokens/usdc.png",EURC:"https://assets.coingecko.com/coins/images/26045/small/euro.png",yXLM:"https://assets.coingecko.com/coins/images/100/small/fmpFRHHQ_400x400.jpg"};
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
      // Resolve the real token art. logo() above only consults two STATIC maps keyed on code, so any
      // asset not pre-seeded there fell back to a coloured letter — which is why this dropdown showed
      // X / A / B / D badges while the pool tables next to it showed proper logos. amFetchLogo is the
      // same resolver those tables use: cache first, then the asset's TOML via stellar.expert.
      list.querySelectorAll(".lx-cpitem").forEach(function(it){
        var code=it.getAttribute("data-code")||"", iss=it.getAttribute("data-issuer")||"";
        var host=it.querySelector(".ad-ico>span")||it.querySelector(".ad-ico");
        if(host && !host.querySelector("img")){
          try{ amFetchLogo(code,iss,function(u){
            if(!u||!host.isConnected)return;
            if(host.querySelector("img"))return;
            var im=document.createElement("img");
            im.src=u; im.alt=""; im.setAttribute("data-lxc",code); im.setAttribute("data-lxi",iss);
            im.style.cssText="position:absolute;inset:0;width:100%;height:100%;object-fit:cover";
            im.onerror=function(){ this.remove(); };   // fall back to the letter already underneath
            host.appendChild(im);
          }); }catch(_){}
        }
      });
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
        return ops; }, {ok:"\\u2713 Pool created",okMsg:"Pool created & liquidity added"}, function(){ setTimeout(function(){ location.reload(); },2600); });
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
    // The pools LIST page is #poolsBody on desktop and #panelAll on mobile. Testing only the desktop id
    // meant load() never ran on a phone at all: no fetch, no DATA, so every renderer below was moot and
    // the design's mock pools stayed put. This is the gate, not paintTables — the layer never started.
    if(q("#poolsBody")||q("#panelAll")){ try{ renameMineTab(); }catch(_){}
      // Network-wide Market Overview figures. Hooked HERE, not to the hero decoration builder — that
      // builder is desktop-shaped and never runs on the phone, so loadNet() was never called there.
      try{ loadNet(); }catch(_){}
      // The network pool list. Started HERE alongside loadNet for the same reason: this is the gate that
      // fires on both desktop and phone. It does not wait on load() -- the ranked page comes from
      // /lxapi/pools and has no dependency on DATA, so the list fills while the wallet-side work runs.
      try{ netFetch(); netWireSearch(); }catch(_){}
      [200,700,1600].forEach(function(ms){ setTimeout(function(){ try{ netWireSearch(); paintNet(); }catch(_){} },ms); });
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

// ---------------------------------------------------------------------------------------------------------
// BUILD GUARD: the browser code above lives inside a template literal, so a single-backslash escape ("\s",
// "\d", "\.") loses its backslash on the way out and the regex silently stops matching — no error, no crash,
// the feature just quietly does nothing. That has now shipped four separate times (the viewBox parse that
// cropped the phone chart, the deposit %-button test, and two before them). `node --check` cannot catch it:
// it validates THIS file, where the escape is still intact.
//
// So check the emitted text directly. Any escape that must survive has to be written doubled ("\\s").
// Scan THIS FILE's source for the template-literal region — not the evaluated SCRIPT, where a correctly
// doubled "\\s" has already collapsed to "\s" and would look like the bug it isn't.
{
  const self = fs.readFileSync(__filename, 'utf8');
  const a = self.indexOf('const SCRIPT = `'), b = self.indexOf('</script>`;', a);
  const bad = [];
  self.slice(a, b).split(/\r?\n/).forEach((l, i) => {
    if (l.trim().indexOf('//') === 0) return;   // prose about this very bug, not code
    const rx = /(^|[^\\])\\([swdbSWDB.\/\[\]()+*?|^$-])/g;
    let m; while ((m = rx.exec(l))) bad.push('  line ' + (i + 1) + ' of SCRIPT: \\' + m[2] + '  |  ' + l.trim().slice(0, 110));
  });
  if (bad.length) {
    console.error('amm data: ABORT — ' + bad.length + ' escape(s) will be stripped from the emitted script.\n' +
                  bad.join('\n') + '\nWrite them doubled (\\\\s) or avoid the regex.');
    process.exit(1);
  }
}

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
