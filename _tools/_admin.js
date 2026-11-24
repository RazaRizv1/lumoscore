// ADMIN PANEL — Revenue page + real on-chain data for the admin surfaces.
//
// The design already shipped an admin front end (dashboard/users/assets/support/blogs/create-pool), but
// every figure in it was mock. This transform:
//   1. adds a REVENUE page (the design had none), cloned from the dashboard shell so it inherits the exact
//      chrome, then re-bodied;
//   2. inserts "Revenue" into the admin sidebar, right after Dashboard;
//   3. injects a data layer that fills Revenue + the Dashboard KPIs from the chain.
//
// CHAINS: fee revenue is read from BOTH collectors (Stellar + XRP Ledger) as of 2026-10-15, and from
// NEAR's (fees-lumoscore.near, through /lxapi/nearfees) as of 2026-11-10. Swap
// VOLUME is still Stellar-only -- it is reconstructed from Stellar transaction envelopes and has no
// XRPL or NEAR equivalent here yet, so those tiles are labelled rather than left to read as platform-wide.
//
// WHERE THE MONEY COMES FROM: platform fees are paid to LX_FEE_COLLECTOR by _swapcalc.js. That account's
// payment history IS the revenue ledger — on-chain, auditable, and impossible to fabricate. Nothing here
// is estimated: per-asset totals are exact sums of real payments. USD is a CONVERSION of those exact
// amounts (stellar.expert spot price per asset, CoinGecko for XLM) and any asset we cannot price is
// counted in its own units and excluded from the USD total rather than guessed at.
//
// Metrics that CANNOT be real without a backend (DAU/MAU, signups, sessions) are dashed with a tooltip
// rather than invented — the same rule the rest of the site follows.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const FEE_COLLECTOR='GAMZFXIJD5E3PNRFCG6VPXCJNUOZAP5BY2P3MU3ZXXUSVM2UY5P6LJKD';

// THE XRP LEDGER COLLECTOR. Added 2026-10-15, because until then this transform read the Stellar
// collector ALONE and called the result the business's revenue. Every swap, mint and launch fee taken
// on the XRP Ledger is paid here, and not one of them reached the Revenue page, the dashboard tiles,
// the month bars, the CSV or the activity feed. Verified on-ledger the same day: 28 of the account's
// last 30 transactions are successful fee receipts.
//
// Checksum-verified at build time in _tools/xrpladdr.js of the XRPL repo, which is where it is also
// injected into the pages that PAY it; repeated here because this transform has no access to that repo.
const XFEE_COLLECTOR='rBDV4nwHzg5ByAYJtPWrbBZnuUXSUtFr94';

// THE NEAR COLLECTOR. Added 2026-11-10: every NEAR swap and bridge fee since late October went here and
// none of it reached this panel. Same constant as FEE_ACCOUNT in the NEAR repo's browser/nearswap.js.
// The browser does not read it directly -- see the NEAR block in the data layer for why.
const NFEE_COLLECTOR='fees-lumoscore.near';

// ---- the Revenue page body (uses the admin design's own classes so it is visually native) -------------
const REVENUE_MAIN=`
      <div class="admin-page-head">
        <h1 class="admin-page-title">Revenue</h1>
        <div class="admin-page-actions">
          <button class="adm-btn ghost" id="lxRevCsv" type="button">Export CSV</button>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-head">Revenue this month</div><div class="kpi-value" id="lxRevMonth">&mdash;</div><div class="kpi-foot" id="lxRevMonthSub">collected in fees</div></div>
        <div class="kpi"><div class="kpi-head">Revenue all time</div><div class="kpi-value" id="lxRevAll">&mdash;</div><div class="kpi-foot" id="lxRevAllSub">since first fee</div></div>
        <div class="kpi"><div class="kpi-head">Fee payments</div><div class="kpi-value" id="lxRevCount">&mdash;</div><div class="kpi-foot">on-chain receipts</div></div>
        <div class="kpi"><div class="kpi-head">Paying wallets</div><div class="kpi-value" id="lxRevWallets">&mdash;</div><div class="kpi-foot">distinct payers</div></div>
      </div>

      <div class="adm-card" style="margin-bottom:18px">
        <div class="adm-card-head">
          <div><div class="adm-card-title">Revenue by source</div><div class="adm-card-sub" id="lxSrcSub">Working out where the money came from&hellip;</div></div>
          <div class="adm-card-actions"><button class="adm-btn ghost" id="lxSrcAdd" type="button">Add off-chain entry</button></div>
        </div>
        <div class="adm-card-body" style="padding:0">
          <table class="adm-table" id="lxSrcTable" style="width:100%;border-collapse:collapse">
            <thead><tr><th style="text-align:left">Source</th><th style="text-align:left">How it is counted</th><th style="text-align:right">Amount</th><th style="text-align:right">Share</th></tr></thead>
            <tbody><tr><td colspan="4" class="lxadm-empty">Loading&hellip;</td></tr></tbody>
          </table>
        </div>
      </div>

      <div class="adm-card" style="margin-bottom:18px">
        <div class="adm-card-head"><div class="adm-card-title">Revenue by asset</div><div class="adm-card-sub" id="lxRevBySub"></div></div>
        <div class="adm-card-body" style="padding:0">
          <table class="adm-table" id="lxRevByAsset" style="width:100%;border-collapse:collapse">
            <thead><tr><th style="text-align:left">Asset</th><th style="text-align:right">Collected</th><th style="text-align:right">&asymp; USD</th><th style="text-align:right">Share</th></tr></thead>
            <tbody><tr><td colspan="4" class="lxadm-empty">Loading fee receipts&hellip;</td></tr></tbody>
          </table>
        </div>
      </div>

      <div class="adm-card">
        <div class="adm-card-head"><div class="adm-card-title">Fee ledger</div><div class="adm-card-sub" id="lxRevLedgerSub"></div></div>
        <div class="adm-card-body" style="padding:0">
          <table class="adm-table" id="lxRevLedger" style="width:100%;border-collapse:collapse">
            <thead><tr><th style="text-align:left">When</th><th style="text-align:left">Chain</th><th style="text-align:left">From</th><th style="text-align:left">Asset</th><th style="text-align:right">Amount</th><th style="text-align:right">Tx</th></tr></thead>
            <tbody><tr><td colspan="6" class="lxadm-empty">Loading fee receipts&hellip;</td></tr></tbody>
          </table>
        </div>
      </div>
`;

const REVENUE_MOB=`
      <div class="mob-page-head">
        <h1 class="mob-page-title">Revenue</h1>
        <p class="mob-page-sub">Platform fees collected on-chain</p>
        <div class="mob-page-actions">
          <button class="adm-btn ghost" id="lxRevCsv" type="button">Export CSV</button>
        </div>
      </div>

      <div class="mob-kpi-grid">
        <div class="mob-kpi"><div class="mob-kpi-head"><span class="mob-kpi-label">This month</span></div><div class="mob-kpi-value" id="lxRevMonth">&mdash;</div><div class="mob-kpi-foot" id="lxRevMonthSub">collected in fees</div></div>
        <div class="mob-kpi"><div class="mob-kpi-head"><span class="mob-kpi-label">All time</span></div><div class="mob-kpi-value" id="lxRevAll">&mdash;</div><div class="mob-kpi-foot" id="lxRevAllSub">since first fee</div></div>
        <div class="mob-kpi"><div class="mob-kpi-head"><span class="mob-kpi-label">Fee payments</span></div><div class="mob-kpi-value" id="lxRevCount">&mdash;</div><div class="mob-kpi-foot">on-chain receipts</div></div>
        <div class="mob-kpi"><div class="mob-kpi-head"><span class="mob-kpi-label">Paying wallets</span></div><div class="mob-kpi-value" id="lxRevWallets">&mdash;</div><div class="mob-kpi-foot">distinct payers</div></div>
      </div>

      <div class="adm-card" style="margin-bottom:14px">
        <div class="adm-card-head"><div class="adm-card-title">Revenue by asset</div><div class="adm-card-sub" id="lxRevBySub"></div></div>
        <div class="adm-card-body" style="padding:0;overflow-x:auto">
          <table class="adm-table" id="lxRevByAsset" style="width:100%;border-collapse:collapse">
            <thead><tr><th style="text-align:left">Asset</th><th style="text-align:right">Collected</th><th style="text-align:right">&asymp; USD</th><th style="text-align:right">Share</th></tr></thead>
            <tbody><tr><td colspan="4" class="lxadm-empty">Loading fee receipts&hellip;</td></tr></tbody>
          </table>
        </div>
      </div>

      <div class="adm-card">
        <div class="adm-card-head"><div class="adm-card-title">Fee ledger</div><div class="adm-card-sub" id="lxRevLedgerSub"></div></div>
        <div class="adm-card-body" style="padding:0;overflow-x:auto">
          <table class="adm-table" id="lxRevLedger" style="width:100%;border-collapse:collapse">
            <thead><tr><th style="text-align:left">When</th><th style="text-align:left">Chain</th><th style="text-align:left">From</th><th style="text-align:left">Asset</th><th style="text-align:right">Amount</th><th style="text-align:right">Tx</th></tr></thead>
            <tbody><tr><td colspan="6" class="lxadm-empty">Loading fee receipts&hellip;</td></tr></tbody>
          </table>
        </div>
      </div>
`;

const CSS=`<style id="lx-admin-css">
/* B03 (2026-11-21): the pools strip fits its box -- auto-fit columns, never two fixed 192 px ones. */
.top-strip{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))!important}.top-strip-card,.top-mini-meta{min-width:0}
/* PHONE FIT (2026-11-21): phones get the full pages again (no -mobile redirect); at phone width the action row wraps,
   the dashboard grids stack (their columns are inline in the markup, hence !important) and the profile minis go 2 x 2. */
@media (max-width:640px){.admin-page-actions{flex-wrap:wrap}.dash-grid{grid-template-columns:minmax(0,1fr)!important}.up-mini{grid-template-columns:repeat(2,minmax(0,1fr))!important}.up-mini-card{min-width:0}}
/* PHONE FIT 2 (RAZA 2026-11-23, "admin on mobile ... all so messed up"; measured at 375 px on all 8 pages):
   1. Card heads were one flex ROW -- title, a subtitle set LARGER than the title (20.9 vs 17.6 px) and the buttons --
      so Revenue by source / by asset, Fee ledger and both Rewards heads became 150-250 px tall slivers. Now they stack.
   2. Tables wider than the phone (Users 1,114 px, Assets 1,262, Blogs 845, Revenue and Rewards up to 693) sat in cards
      with overflow:hidden, so their right-hand columns -- Blogs' Edit/Delete included -- could not be reached. The card
      body now scrolls sideways.
   3. The menu: the Collapse button's invisible label still took the button's width, squeezing its arrow to 0 px (a
      blank square); tapping it widened the grid column to 220 px and crushed the page into ~155 px, and the open state
      is remembered on every page. On a phone the open menu now lies OVER the page, and lx-admphone below closes it on
      load and on a tap outside it. Desktop is untouched (every rule is inside this media query). */
@media (max-width:640px){.adm-card-head{flex-direction:column;align-items:flex-start;gap:10px}.adm-card-head>*{min-width:0;max-width:100%}.adm-card-sub{font-size:14.3px;line-height:1.45}.adm-card-body{overflow-x:auto;-webkit-overflow-scrolling:touch}.admin-shell.expanded{grid-template-columns:56px 1fr}.admin-shell.expanded>.admin-sidebar{position:fixed;left:0;top:64px;bottom:0;width:220px;z-index:80;box-shadow:8px 0 24px rgba(0,0,0,.35);overflow-y:auto}.admin-shell:not(.expanded) .adn-toggle-label{display:none}.adn-toggle svg{flex:0 0 18px;width:18px;height:18px}}
/* A FALL IN 24H / 7D READS AS RED, LIKE THE RISE READS AS GREEN (RAZA 2026-09-24).
   pct() has always emitted .ch-up / .ch-down, and the design styles only .ch-up -- so a gain was
   green and bold while a loss fell back to plain body text, the same white as the price beside it.
   Direction was carried by the minus sign alone, which is the one character easiest to miss when
   skimming a column of figures.
   Mirrors .ch-up exactly (same face, size and weight) so the two differ in hue and nothing else. */
.ch-down{color:var(--red,#dc2626);font-family:'JetBrains Mono',monospace;font-weight:700;font-size:15.4px}
/* Sortable column headings. A button rather than a click handler on the <th> so the keyboard reaches
   it and a screen reader announces it as something you can press. The arrow is always present, in a
   fixed-width slot, so the heading row does not shift as the active column moves. */
.lxth{display:inline-flex;align-items:center;gap:5px;background:none;border:0;padding:0;margin:0;cursor:pointer;
  font:inherit;color:inherit;letter-spacing:inherit;text-transform:inherit}
thead th[style*="right"] .lxth{flex-direction:row-reverse}
.lxth:hover{color:var(--text)}
.lxth-a{display:inline-block;width:9px;text-align:center;font-size:9px;line-height:1;opacity:.35}
.lxth.on{color:var(--accent,#ea6a2c)}
.lxth.on .lxth-a{opacity:1}
.lxth:focus-visible{outline:2px solid var(--accent,#ea6a2c);outline-offset:2px;border-radius:4px}
/* Dashboard groups. .kpi-grid is repeat(auto-fit,minmax(180px,1fr)), so a heading has to span the
   whole row or it would sit in a column and read as an eleventh tile. */
/* THE RAGGED RIGHT EDGE. The design's .kpi-grid is repeat(auto-fit,minmax(180px,1fr)), which resolves
   to about nine columns at desktop width -- so a group of five tiles sat in the left five and left
   four empty tracks beside it, and the two groups ended at different x positions. Both groups are
   five tiles, so the column count is pinned and every row fills edge to edge. Scoped to the dashboard
   because the other admin pages use .kpi-grid with four tiles. */
.lxd-grid{grid-template-columns:repeat(5,minmax(0,1fr))}
@media(max-width:1400px){.lxd-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:900px){.lxd-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:560px){.lxd-grid{grid-template-columns:minmax(0,1fr)}}
/* Tiles in a row share a height from the grid; this keeps their INSIDES aligned too, so the feet sit
   on one line whether the label wrapped to two lines or not. */
.lxd-grid .kpi{display:flex;flex-direction:column}
.lxd-grid .kpi-foot{margin-top:auto}
.lxd-sec{grid-column:1/-1;display:flex;align-items:baseline;gap:10px;margin:18px 0 -4px}
.lxd-sec:first-child{margin-top:0}
.lxd-sec-t{font-weight:800;font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:var(--text-muted)}
.lxd-sec .lxd-per{font-weight:700;font-size:11px;letter-spacing:.04em;padding:2px 8px;border-radius:999px;
background:var(--surface-2);color:var(--text-muted)}
/* The flag renders as an emoji, so it needs a font stack that actually HAS the regional-indicator
   glyphs -- on a desktop without one the pair falls back to the bare letters "GB", which is still a
   correct answer rather than a pair of empty boxes. */
/* Was an emoji glyph sized with font-size; it is an image and a name now - see flagOf(). The row
   is inline-flex so the flag sits on the name's baseline band rather than above it. */
.lxu-flag{display:inline-flex;align-items:center;gap:7px;line-height:1;white-space:nowrap}
/* 4:3 at flagcdn's w40, with a hairline because several flags are white at the edge and would
   otherwise bleed into a light surface. */
.lxu-flagimg{width:20px;height:15px;object-fit:cover;border-radius:2px;flex:0 0 auto;
  box-shadow:0 0 0 1px rgba(127,127,140,.28)}
.lxu-cname{font-size:13.5px;color:var(--text);overflow:hidden;text-overflow:ellipsis;max-width:150px}
/* The text swapped in when the image cannot load. */
.lxu-cc{font:700 11px/1 "Hanken Grotesk",system-ui,sans-serif;letter-spacing:.04em;
  color:var(--text-muted);padding:3px 5px;border-radius:4px;background:rgba(127,127,140,.14)}
.lxu-noflag{color:var(--text-muted);font-size:13.5px}
.lxu-tier{display:inline-block;font-weight:700;font-size:12px;letter-spacing:.02em;padding:4px 9px;border-radius:999px}
.lxu-tier.on{background:rgba(34,197,94,.14);color:#22c55e}
.lxu-tier.off{background:rgba(127,127,140,.14);color:var(--text-muted)}
.lxu-tre{display:inline-block;margin-left:6px;font:700 10px/1 "Hanken Grotesk",system-ui,sans-serif;text-transform:uppercase;letter-spacing:.05em;padding:3px 6px;border-radius:999px;background:rgba(234,106,44,.16);color:#ea6a2c;vertical-align:middle}
#lxdPeriod{-webkit-appearance:none;appearance:none;cursor:pointer;padding-right:26px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a8fa3' stroke-width='2.6' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 8px center;background-size:11px}
.adm-table th{font-size:12px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;color:var(--text-muted);padding:12px 18px;border-bottom:1px solid var(--border)}
.adm-table td{padding:13px 18px;border-bottom:1px solid var(--border);font-size:14px;vertical-align:middle}
.adm-table tbody tr:last-child td{border-bottom:0}
.adm-table td.mono,.adm-table th.mono{font-family:'JetBrains Mono',monospace}
.lxadm-empty{padding:30px 18px!important;text-align:center;color:var(--text-muted);font-size:13.5px;line-height:1.6}
.lxadm-asset{display:inline-flex;align-items:center;gap:9px;font-weight:700}
.lxadm-ico{width:24px;height:24px;border-radius:50%;overflow:hidden;flex-shrink:0}
.lxadm-ico img{width:100%;height:100%;object-fit:cover;display:block;border-radius:50%}
.lxadm-link{color:var(--accent);font-weight:700;text-decoration:none}
.lxadm-link:hover{text-decoration:underline}
.lxbars{display:flex;align-items:stretch;gap:12px;height:300px;padding:18px 18px 14px}
.lxbar{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:6px;min-width:0}
/* transparent track: an empty month should read as no bar, not as a full-height grey one */
.lxbar-track{width:100%;flex:1;display:flex;align-items:flex-end;border-radius:7px 7px 0 0;overflow:hidden;background:transparent;border-bottom:1px solid var(--border)}
.lxbar-fill{width:100%;border-radius:7px 7px 0 0;background:linear-gradient(180deg,#8b7bff,#6d28d9);min-height:2px}
.lxbar-lab{font-size:11.5px;color:var(--text-muted);white-space:nowrap}
.lxbar-val{font-family:'JetBrains Mono',monospace;font-size:11.5px;font-weight:700;color:var(--text);white-space:nowrap}
.lxbars-empty{padding:60px 18px;text-align:center;color:var(--text-muted);font-size:13.5px}
.lxstat-row{display:flex;align-items:center;gap:11px;padding:11px 18px;border-bottom:1px solid var(--border)}
.lxstat-row:last-child{border-bottom:0}
.lxstat-dot{width:9px;height:9px;border-radius:50%;background:var(--text-muted);flex-shrink:0}
.lxstat-dot.ok{background:#35c07f}.lxstat-dot.bad{background:#dc2626}
.lxstat-name{flex:1;font-size:14px;font-weight:600;color:var(--text)}
.lxstat-val{font-family:'JetBrains Mono',monospace;font-size:12.5px;color:var(--text-muted)}
.lxwal-row{display:flex;align-items:center;gap:11px;padding:11px 18px;border-bottom:1px solid var(--border);text-decoration:none;color:inherit}
.lxwal-row:last-child{border-bottom:0}
.lxwal-av{width:28px;height:28px;border-radius:50%;flex-shrink:0}
.lxwal-meta{flex:1;min-width:0}
.lxwal-addr{font-family:'JetBrains Mono',monospace;font-size:13.5px;font-weight:700;color:var(--text)}
.lxwal-sub{font-size:12.5px;color:var(--text-muted)}
.lxwal-val{font-family:'JetBrains Mono',monospace;font-size:13.5px;font-weight:700;color:var(--text)}
.lxu-av{width:32px;height:32px;border-radius:50%;flex-shrink:0}
.lxa-ico{width:30px;height:30px;border-radius:50%;flex-shrink:0}
.lxmodal{position:fixed;inset:0;background:rgba(15,17,26,.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px}
.lxmodal-box{background:var(--surface);border:1px solid var(--border);border-radius:16px;width:100%;max-width:460px;padding:22px;box-shadow:0 24px 60px rgba(0,0,0,.28)}
.lxmodal-t{font-size:18px;font-weight:800;color:var(--text);margin:0 0 4px}
.lxmodal-s{font-size:13px;color:var(--text-muted);margin:0 0 18px;line-height:1.6}
.lxmodal-l{display:block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.02em;color:var(--text-muted);margin:0 0 6px}
.lxmodal-i{width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:14px;font-family:'JetBrains Mono',monospace;margin-bottom:14px;box-sizing:border-box}
.lxmodal-i:focus{outline:none;border-color:var(--accent)}
.lxmodal-e{font-size:13px;color:#dc2626;margin:0 0 12px;line-height:1.5;min-height:0}
.lxmodal-a{display:flex;gap:10px;justify-content:flex-end;margin-top:4px}
.lxm-card{display:block;padding:13px 14px;border:1px solid var(--border);border-radius:14px;background:var(--surface);margin-bottom:10px;text-decoration:none;color:inherit}
.lxm-top{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.lxm-av{width:34px;height:34px;border-radius:50%;flex-shrink:0}
.lxm-name{font-size:13.5px;font-weight:700;color:var(--text)}
.lxm-sub{font-size:11px;color:var(--text-muted)}
.lxm-right{margin-left:auto;text-align:right;font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:var(--text)}
.lxm-stats{display:flex;gap:14px}
.lxm-stats>div{flex:1;min-width:0}
.lxm-sl{font-size:10.5px;color:var(--text-muted);margin-bottom:2px}
.lxm-sv{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:var(--text)}
.lxnote{width:100%;box-sizing:border-box;min-height:76px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13.5px;font-family:inherit;resize:vertical}
.lxnote:focus{outline:none;border-color:var(--accent)}
.lxnote-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:9px}
.lxnote-hint{font-size:12px;color:var(--text-muted)}
.lxadm-sub{font-size:12.5px;color:var(--text-muted);font-weight:500}
.lx-vtick{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;margin-left:5px;border-radius:50%;background:var(--green,#35c07f);color:#fff;vertical-align:-2px;flex:0 0 14px}
.lx-vtick svg{width:9px;height:9px}
a.ext-link{display:inline-flex;align-items:center;justify-content:center;color:var(--text-muted);text-decoration:none}
a.ext-link:hover{color:var(--accent)}
.lxa-ico{width:26px;height:26px;border-radius:50%;object-fit:cover;background:var(--surface-2)}
.lxadm-note{margin:0 0 16px;padding:12px 14px;border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:10px;background:var(--surface-2);color:var(--text-muted);font-size:13px;line-height:1.6}
/* The listing queue's row actions are WORDS, not glyphs: "Approve" and "Decline" are decisions about
   someone's money and should not be a pair of unlabelled squares. .row-act-btn is 28x28 and made for
   the pencil and the cross, so these get their own size. */
.lxreq-btn{display:inline-flex;align-items:center;height:26px;padding:0 10px;margin-left:6px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font:inherit;font-size:12.5px;font-weight:600;line-height:1;white-space:nowrap;cursor:pointer;transition:border-color .13s,color .13s}
.lxreq-btn:hover:not(:disabled){border-color:var(--accent);color:var(--accent)}
.lxreq-btn:disabled{opacity:.55;cursor:default}
.lxreq-btn.go{border-color:var(--accent);background:var(--accent);color:#fff}
.lxreq-btn.go:hover:not(:disabled){filter:brightness(1.06);color:#fff}
.lxreq-note{white-space:normal;margin-top:4px;line-height:1.45;color:var(--text-muted);font-size:12.5px}
.lxreq-copy{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;margin-left:5px;padding:0;vertical-align:-5px;border:0;border-radius:5px;background:transparent;color:var(--text-muted);cursor:pointer;transition:color .13s,background .13s}
.lxreq-copy:hover{color:var(--text);background:var(--surface-2)}
.lxreq-copy .c2{display:none}
.lxreq-copy.ok{color:#1fa968}
.lxreq-copy.ok .c1{display:none}
.lxreq-copy.ok .c2{display:block}
.lxreq-links{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}
.lxreq-links a{display:inline-flex;align-items:center;height:22px;padding:0 9px;border:1px solid var(--border);border-radius:6px;font-size:11.5px;font-weight:600;color:var(--text-muted);text-decoration:none;transition:border-color .13s,color .13s}
.lxreq-links a:hover{border-color:var(--accent);color:var(--accent)}
.lxreq-nolinks{font-size:11.5px;font-style:italic;color:var(--text-muted);opacity:.75}
/* The admin activity feed on the dashboard. */
.lxaud-row{display:flex;align-items:center;gap:11px;padding:11px 16px;border-bottom:1px solid var(--border)}
.lxaud-row:last-child{border-bottom:0}
.lxaud-dot{width:7px;height:7px;flex:0 0 7px;border-radius:50%;background:var(--text-muted)}
.lxaud-dot.ok{background:#1fa968}
.lxaud-dot.warn{background:#e0553c}
.lxaud-dot.money{background:var(--accent)}
.lxaud-meta{flex:1;min-width:0}
.lxaud-act{font-size:13.5px;color:var(--text);line-height:1.35}
.lxaud-tgt{font-family:'JetBrains Mono',monospace;font-size:12.5px;color:var(--text-muted)}
.lxaud-who{font-size:11.5px;color:var(--text-muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lxaud-when{flex:0 0 auto;font-size:11.5px;color:var(--text-muted);font-family:'JetBrains Mono',monospace}
</'+'style>`.replace("</'+'style>","</"+"style>");

// ---- wallet signing, borrowed from the launchpad ------------------------------------------------------
// The panel signs exactly one kind of transaction: a refund to a declined listing applicant. Rather
// than write a second wallet stack for that, the launchpad's signer is lifted here BY NAME at build
// time, so Freighter / Albedo / Rabet / xBull / LOBSTR / WalletConnect keep one implementation across
// the whole site. If those functions are renamed the build FAILS instead of shipping a dead button.
function lpSigner(){
  const src=fs.readFileSync(__dirname+'/_launchpad.js','utf8');
  const grab=(name)=>{
    const i=src.indexOf('function '+name+'(');
    if(i<0) return null;
    let d=0;
    for(let k=src.indexOf('{',i); k>=0 && k<src.length; k++){
      if(src[k]==='{') d++;
      else if(src[k]==='}'){ d--; if(!d) return src.slice(i,k+1); }
    }
    return null;
  };
  const parts=[];
  for(const v of ['var _lpSdkP=null;','var _lpMods={};']){
    if(src.indexOf(v)<0){ console.error('admin: _launchpad.js no longer declares "'+v+'" — refusing to build.'); process.exit(1); }
    parts.push(v);
  }
  for(const n of ['lxLpSdk','lxLpFreighter','lxLpWalletId','lxLpConnectedAddr','lxLpMod','lxLpSignXdr']){
    const b=grab(n);
    if(!b){ console.error('admin: _launchpad.js no longer defines '+n+'() — refusing to build.'); process.exit(1); }
    parts.push(b);
  }
  // lxLpSignXdr reads the passphrase off this. The launchpad sets a fuller version of the same object;
  // the panel needs only the one field and never overwrites an existing one.
  parts.push('if(!window.__lxLP)window.__lxLP={passphrase:"Public Global Stellar Network ; September 2015"};');
  return parts.join('\n')+'\n';
}
const LP_SIGNER=lpSigner();

// PHONE MENU (2026-11-23, see PHONE FIT 2 in CSS): the design restores the open menu from localStorage
// (lc-admin-expanded) on every page, which on a phone left every page crushed beside it. On a phone the menu starts
// closed and a tap outside it closes it (that first tap only closes -- it does not also press whatever was under it).
// Runs after the design's own toggle script (both sit at the end of <body>, this one later). Desktop is untouched.
const PHONEJS='<script id="lx-admphone">(function(){var mq=window.matchMedia&&window.matchMedia("(max-width:640px)");'
  // The design restores the open state INSIDE a DOMContentLoaded handler (ready(fn)), i.e. after this inline script
  // has run -- so closing it only here left the menu open on load (live bcca394a, 2026-11-23). It is closed again on
  // DOMContentLoaded: that listener is added after the design's, so it runs after the restore.
  +'if(!mq||!mq.matches)return;var sh=document.getElementById("adminShell");if(!sh)return;'
  +'var shut=function(){sh.classList.remove("expanded");};shut();'
  +'if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",shut);'
  +'document.addEventListener("click",function(e){if(!sh.classList.contains("expanded"))return;'
  +'if(e.target&&e.target.closest&&e.target.closest(".admin-sidebar"))return;'
  +'sh.classList.remove("expanded");e.preventDefault();e.stopPropagation();},true);})();</script>';

// ---- data layer ---------------------------------------------------------------------------------------
const SCRIPT='<script id="lx-admindata">(function(){'
+LP_SIGNER
+'var H="https://horizon.stellar.org";'
+'var VTICK="<svg viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"currentColor\\" stroke-width=\\"3.4\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\"><polyline points=\\"20 6 9 17 4 12\\"></polyline></svg>";'
+'var EXTICON="<svg width=\\"13\\" height=\\"13\\" viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"currentColor\\" stroke-width=\\"2\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\"><path d=\\"M7 17L17 7M17 7H8M17 7v9\\"></path></svg>";'
// Two glyphs in one button: the pages stack, and a tick that replaces them for a moment after a copy.
// Feedback matters more than usual here -- copying a 56-character account gives you nothing visible to
// check, so without it you cannot tell whether the click registered.
+'var COPYICON="<svg class=\\"c1\\" width=\\"12\\" height=\\"12\\" viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"currentColor\\" stroke-width=\\"2\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\"><rect x=\\"9\\" y=\\"9\\" width=\\"12\\" height=\\"12\\" rx=\\"2\\"></rect><path d=\\"M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1\\"></path></svg>"'
+'  +"<svg class=\\"c2\\" width=\\"12\\" height=\\"12\\" viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"currentColor\\" stroke-width=\\"3\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\"><polyline points=\\"20 6 9 17 4 12\\"></polyline></svg>";'
+'var FEE="'+FEE_COLLECTOR+'";'
+'function q(s){return document.querySelector(s);} function qa(s){return [].slice.call(document.querySelectorAll(s));}'
+'function j(u){return fetch(u).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});}'
+'function setT(el,t){ if(el&&el.textContent!==t)el.textContent=t; }'
+'function usd(n){ if(n==null||!isFinite(n))return "\\u2014"; if(n===0)return "$0"; if(n>=1e6)return "$"+(n/1e6).toFixed(2)+"M"; if(n>=1e3)return "$"+(n/1e3).toFixed(1)+"K"; if(n<0.0001)return "$"+(+n).toPrecision(3); return "$"+n.toFixed(n<1?4:2); }'
+'function num(n){ if(n==null||!isFinite(n))return "\\u2014"; if(n&&Math.abs(+n)<0.0000001)return (+n).toLocaleString(undefined,{maximumSignificantDigits:3,maximumFractionDigits:20}); return (+n).toLocaleString(undefined,{maximumFractionDigits:7}); }'
+'function shortG(a){ return a?a.slice(0,4)+"\\u2026"+a.slice(-4):""; }'
+'function esc(s){return (String(s==null?"":s).replace(/[<>&"]/g,function(c){return c==="<"?"&lt;":c===">"?"&gt;":c==="&"?"&amp;":"&quot;";})).split(String.fromCharCode(39)).join("&#39;");}'
+'function avatar(code){ var c=String(code||"?"),h=0; for(var i=0;i<c.length;i++)h=(h*31+c.charCodeAt(i))%360;'
+'  var t=c.replace(/[^A-Za-z0-9]/g,"").slice(0,2).toUpperCase()||"?";'
+'  return "data:image/svg+xml,"+encodeURIComponent(\'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="hsl(\'+h+\',60%,50%)"/><text x="20" y="26" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="15" fill="#fff">\'+t+\'</text></svg>\'); }'
+'function avatarPart(code){ return avatar(code); }'
+'function cssUrl(u){ return "url(\'"+String(u).split("\'").join("%27")+"\')"; }'
// ---- the XRP Ledger side ----
// Rows are normalised into Horizon's PAYMENT SHAPE deliberately: the grouping, the pricing, the
// ledger table, the CSV and the feed are all already written against that shape, so one normalisation
// point serves every surface instead of eight separate chain branches.
+'var XH="https://xrplcluster.com";'
+'var XFEE="'+XFEE_COLLECTOR+'";'
+'function xrpc(m,p){ return fetch(XH,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({method:m,params:[p]})}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}); }'
// XRPL stamps time in SECONDS SINCE 2000-01-01, not 1970. Read raw, every receipt dates to the
// seventies and every month bar lands in the wrong bucket.
+'function xWhen(t){ return new Date((t+946684800)*1000).toISOString(); }'
// THE CURRENCY AS UPSTREAM KEYS IT. Not "as hex" -- that was the first version's mistake, and it is
// why this is no longer called xHex.
//
// The XRP Ledger carries a code of EXACTLY THREE characters literally, and everything else as 40 hex
// characters. xrpl.to keys its tokens on whatever the ledger hands it, untouched (`slugOf` in
// lxapi/xrplprices.js is `issuer + "-" + t.currency`), so the slug has to follow the same rule.
//
// Padding a 3-character code to 40 hex builds an id the upstream 404s on. Measured against the real
// launchpad mints: POP, BRO and RAC returned NO DATA while NPENGU, LLAMA and XRLINK worked --
// `…-POP` answers 200, `…-504F5000…` answers 404.
//
// The other half was an earlier mistake in the same function: testing "longer than 3" to recognise an
// already-hex code let any 4-to-39-character ticker (RLUSD, SOLO) through unencoded.
+'function xCur(c){ c=String(c||"");'
+'  if(c.length===3)return c;'
+'  if(c.length===40&&/^[0-9a-fA-F]+$/.test(c))return c.toUpperCase();'
+'  var h=""; for(var i=0;i<c.length;i++)h+=("0"+c.charCodeAt(i).toString(16)).slice(-2);'
+'  return (h+"0000000000000000000000000000000000000000").slice(0,40).toUpperCase(); }'
+'var XSELF=0, XOK=null;'
// WHAT AN XRPL FEE WAS FOR IS ON THE FEE ITSELF. Stellar's kind comes from parsing the transaction
// envelope; the XRP Ledger hands us only the fee payment, and the swap it belongs to is a separate
// transaction by a different account. But every site that pays this collector stamps a memo --
// dxaswap.js, qorders.js and write.js all call feeMemo(), which writes "LumosCore platform fee N% -
// ... swap is the next transaction", and the three bridge routes in nibridge.js write lx:ax / lx:th /
// lx:ni ([[xrpl-bridge-marker-is-on-the-fee]]). That is already inside the account_tx response, so
// this costs NOTHING: no pairing pass, no request per payer, none of the window-matching the XRPL
// dashboard has to do.
//
// AND A RECEIPT WITH NO MEMO IS NOT AN UNREADABLE ONE. Our own code never pays this account without a
// memo, so a bare payment did not come from a fee path at all -- it is someone sending XRP to the
// collector by hand, which is exactly what "other on-chain" means. Measured over the collector's whole
// history on 2026-10-29: 54 swap memos, 19 bridge markers, 13 bare. Twelve of the thirteen are dust
// from a single account during the September build window; the thirteenth is a round 2 XRP, and it is
// 91% of all XRP ever collected. See [[admin-revenue-exclusions]] -- the Stellar side has been here.
+'function xMemo(t){ try{ return (t.Memos||[]).map(function(e){ var h=String(((e||{}).Memo||{}).MemoData||""), s="";'
+'  for(var i=0;i+1<h.length;i+=2)s+=String.fromCharCode(parseInt(h.substr(i,2),16)); return s; }).join(" "); }catch(_){ return ""; } }'
+'function xKind(mo){ mo=String(mo||"");'
+'  if(/lx:(ax|th|ni)/.test(mo))return "bridge";'
+'  if(/LumosCore platform fee/.test(mo)&&/swap/i.test(mo))return "trade";'
+'  return "other"; }'
+'function xRow(x){ var t=x.tx||x.tx_json||{}, m=x.meta||{};'
+'  if(t.TransactionType!=="Payment"||m.TransactionResult!=="tesSUCCESS")return null;'
+'  if(t.Destination!==XFEE)return null;'
+'  if(t.Account===XFEE){ XSELF++; return null; }'
// delivered_amount is what ARRIVED. Amount is what was asked for, and on a partial payment the two
// differ -- reading Amount would report money we never received as revenue.
+'  var d=(m.delivered_amount!==undefined)?m.delivered_amount:((m.DeliveredAmount!==undefined)?m.DeliveredAmount:t.Amount);'
+'  if(d==null)return null;'
+'  var nat=(typeof d==="string");'
+'  return { chain:"xrpl", from:t.Account, to:t.Destination, type:"payment", memo:xMemo(t),'
+'    amount: nat?String(Number(d)/1e6):String(d.value),'
+'    asset_type: nat?"native":"credit_alphanum4",'
+'    asset_code: nat?"XRP":d.currency, asset_issuer: nat?"":d.issuer,'
+'    created_at: x.close_time_iso||xWhen(+t.date||0),'
+'    transaction_hash: x.hash||t.hash }; }'
// XOK records whether the ledger actually answered. A failed RPC returning an empty list would look
// exactly like "no XRPL fees yet", which is the one wrong answer worth guarding against: it would
// quietly understate revenue and nobody would see a reason to doubt it.
+'function loadXrpl(){ var out=[]; XOK=true;'
+'  function page(marker,n){ var p={account:XFEE,limit:200,ledger_index_min:-1,ledger_index_max:-1,binary:false,forward:false};'
+'    if(marker)p.marker=marker;'
+'    return xrpc("account_tx",p).then(function(d){ var r=d&&d.result;'
+'      if(!r||r.error){ if(n===1)XOK=false; return out; }'
+'      (r.transactions||[]).forEach(function(x){ var row=xRow(x); if(row)out.push(row); });'
+'      if(r.marker&&n<10)return page(r.marker,n+1); return out; }); }'
+'  return page(null,1).catch(function(){ XOK=false; return out; }); }'
// ---- the NEAR side ----
// READ BY OUR OWN FUNCTION, NOT FROM THE BROWSER. A NEAR fee is usually an ft_transfer, which executes on
// the TOKEN's contract, not on the collector; finding them means FastNEAR's index plus every
// transaction's receipts (~6 KB each). functions/lxapi/nearfees.js does that once per cache period and
// answers in Horizon's payment shape, so it joins the ledger the way xRow() lets XRPL join it.
//
// NOK, like XOK: did NEAR actually answer? The Function says ok:false when it could not read, and
// partial:true while it is still decoding history (it catches up a few dozen transactions per call).
// Both leave NOK false, so the totals dash and the warning names NEAR -- rows already read are still
// listed, because they are real, but a part-read chain is never summed as if it were the whole.
//
// WHAT A NEAR FEE WAS FOR IS ON ITS MEMO, as on XRPL. Fees arrive in the INPUT token of each trade, so
// there is no fee-asset list to test against: every LumosCore path writes a memo instead --
// nearswap.js "LumosCore platform fee 0.2%" (0.1% on the LUMOS tier), the router contract "lx:sw" (not
// deployed yet), nibridge.js "lx:ni", nearbridges.js "lx:om" / "lx:wh". Limit orders charged
// "LumosCore limit order fee 0.1%" until 2026-11-04 and are free since; the memo is still a fee memo.
// The launchpad cannot write one -- the factory forwards the create fee as a bare NEAR transfer from its
// callback -- so the Function recognises that receipt by shape and stamps lxkind "mint".
// No memo means no LumosCore path paid it: it goes to Other, out of the totals.
+'var NFEE="'+NFEE_COLLECTOR+'", NOK=null, NPART=false, NSELF=0;'
// lxkind "trade": a swap fee Rhea paid as wNEAR, recognised by its transaction in /lxapi/nearfees (no memo of ours).
+'function nKind(p){ if(p&&p.lxkind==="mint")return "mint"; if(p&&p.lxkind==="trade")return "trade"; var mo=String((p&&p.memo)||"");'
+'  if(/^lx:(ni|om|wh)$/.test(mo))return "bridge";'
+'  if(mo==="lx:sw"||/^LumosCore (platform|limit order) fee/.test(mo))return "trade";'
+'  return "other"; }'
// ASKED AGAIN WHILE IT IS PARTIAL (RAZA 2026-11-18: the Revenue page showed "NEAR still being read ... reload to try
// again" and dashes after an admin deploy). /lxapi/nearfees reads twenty transactions a call on a cold cache and says
// partial until it has them all -- measured: partial on calls 1-4, complete on 5 -- but this asked once. Up to 12 asks,
// 600 ms apart, each with a cache-buster so the browser does not hand back the same partial answer. A partial last
// answer still shows the warning, exactly as before.
+'function loadNear(){ NOK=true; NPART=false; NSELF=0;'
+'  function ask(n){ return j("/lxapi/nearfees"+(n?("?r="+n+"-"+Date.now()):"")).then(function(d){'
+'    if(d&&d.ok&&d.partial&&n<12)return new Promise(function(res){ setTimeout(res,600); }).then(function(){ return ask(n+1); });'
+'    return d; }); }'
+'  return ask(0).then(function(d){'
+'    if(!d||!d.ok||!d.rows||typeof d.rows.filter!=="function"){ NOK=false; return []; }'
+'    NSELF=+d.self||0; if(d.partial){ NPART=true; NOK=false; }'
+'    return d.rows.filter(function(p){ return p&&p.to===NFEE&&p.from!==NFEE; }).map(function(p){ p.chain="near"; return p; }); })'
+'   .catch(function(){ NOK=false; return []; }); }'
// ---- fetch every fee receipt (paged) ----
+'var RV=null, RV_SELF=0;'
// ---- WHAT COUNTS AS A FEE: THE ASSET IT ARRIVED IN ---------------------------------------------
//
// RAZA sent 1,000,000 LUMOS into the Stellar collector by hand on 2026-10-18 and the page booked it
// as $74 of revenue -- 59.7% of the business. He asked twice for such transfers to stop being
// recorded; I answered with a per-receipt exclude button on all 428 rows, which is a chore, not a fix.
//
// THE RULE HE ASKED FOR IS THE RIGHT ONE, and the code backs it. _swapcalc.js either pays the platform
// fee directly in XLM or path-pays it with destAsset native, so a Stellar swap fee ALWAYS arrives as
// XLM; bridge fees arrive as USDC; the XRPL collector takes XRP. Measured over the collector's whole
// history: XLM 333 receipts, USDC 27, LUMOS exactly 1 -- his.
//
// So an asset we never charge in is not a fee, whoever sent it. Note the deliberate cost: if we ever
// start charging in another asset, this skips it silently until the list below is updated. That is a
// real trade and worth stating -- the alternative was a wallet rule, and that WOULD have been wrong,
// because the same wallet also paid two genuine XLM fees.
+'var FEE_ASSETS={stellar:{XLM:1,USDC:1},xrpl:{XRP:1}};'
// NEAR HAS NO LIST: its fees come in whatever token was swapped, so the memo decides instead (nKind).
// The name stays isFeeAsset because every caller asks the same question -- "is this receipt a fee?".
+'function isFeeAsset(p){ if(p.chain==="near")return nKind(p)!=="other";'
+'  var m=FEE_ASSETS[p.chain==="xrpl"?"xrpl":"stellar"]||{};'
+'  return !!m[assetOf(p).code]; }'
// ---- RECEIPTS THAT ARE NOT REVENUE, NAMED ONE BY ONE ------------------------------------------
//
// The asset rule above cannot catch these: we DO charge in XRP, so a hand-sent XRP payment looks
// exactly like a fee. Nothing on the ledger separates them, and nothing is inferred -- a receipt
// leaves the totals only because a person said so, by id, with a reason that is printed next to it.
//
// WHY A LIST IN THE SOURCE AND NOT THE BUTTON. A per-receipt exclude UI backed by KV was deployed on
// 2026-10-19 (admin deployment 1ed976aa). Its source was never committed, it is no longer anywhere in
// this tree, four later admin builds went out without it, and its KV key `revenue:excluded` has never
// held a value -- so the flow was never completed once. This list is the part that survives a rebuild,
// because it lives in the file the build is made from. The cost is honest: each new exclusion is a
// code change, and RAZA cannot do one from the panel.
//
// EXCLUDED IS NOT HIDDEN. These stay in the fee ledger, dimmed and struck through, carrying the
// reason -- a figure nobody can see is a figure nobody can question, and a row that silently vanished
// is one nobody can put back.
+'var NOT_REVENUE={'
// 2 XRP, 2026-09-06 02:56:51 UTC, from rp4XTcdzXG5jEP29UUW2kbgt7NaLFHU6RV, no memo. 91% of all XRP
// the collector has ever received, sent during the September XRPL build window by the same account
// that sent twelve dust payments around it. Our own code never pays this account without a memo.
// RAZA, 2026-10-29: "exclude that 2 XRP".
+'  "xrpl:D8ADCB02EFFFB3D2439CD2334B9D71AC77C7CACDAFC85D20637816FEBB9AEF93":"sent by hand during the XRPL build \\u2014 not a platform fee",'
// 100,000 LUMOS, 2026-11-04 06:06 UTC, tx 7AbCY4ebTPapVo6DKUDb97tBhTBRZzn38N8AasqVUxXA, receipt below.
// It DOES carry a LumosCore memo ("LumosCore limit order fee 0.1%"), so the memo rule counts it -- which
// is why it is named here. treasury.lumoscore.near placed the first LUMOS limit order on NEAR (100M
// LUMOS); the 0.1% fee transfer landed, DCL then refused the order (E600) and handed the 100M back, but
// the fee stayed. That incident is why NEAR limit orders went free (browser/neardcl.js). It is our own
// treasury's LUMOS moving between our own accounts, not money from a customer, and LUMOS has no NEAR
// price yet, so it would have read as $0 today and as a fortune the day a pool opens.
+'  "near:4MkQerGzC7bujsqZQczPbtXs8o1FGtdKP2TmtM1SSyxB":"the treasury\\u2019s own first LUMOS limit order; DCL refused the order after the fee landed \\u2014 not customer revenue"'
+'};'
// Stellar can put several payments in one transaction, so the operation id is the identity and the
// transaction hash is only the fallback; the XRP Ledger has one payment per transaction. NEAR rows carry
// the RECEIPT id, since one NEAR transaction can pay the collector more than once.
+'function rid(p){ return (p.chain||"stellar")+":"+String(p.id||p.transaction_hash||""); }'
+'function exReason(p){ var k=(p.chain||"stellar")+":";'
+'  return NOT_REVENUE[rid(p)]||NOT_REVENUE[k+String(p.transaction_hash||"")]||""; }'
// SOK: DID HORIZON ACTUALLY ANSWER? (RAZA 2026-10-19: "where are all the stellar transactions?")
//
// `if(!d)return;` treated a failed page exactly like a finished one, so when Horizon refused -- which it
// was doing repeatedly that afternoon, ECONNRESET on run after run -- `recs` stayed empty, `inc` was
// empty, and the page reported **$0 revenue, 67 receipts, XRP only** with total composure. Not a blank
// screen anybody would distrust: a confident, wrong set of business figures.
//
// The comment right below this one already said an XRPL failure "degrades to Stellar-only AND SAYS SO".
// The Stellar side had no such guard. Same rule now applies to both, and nothing on the page is
// presented as a total while a chain is missing.
+'var SOK=true;'
+'function loadRevenue(){ if(RV)return Promise.resolve(RV); var recs=[]; SOK=true;'
+'  function page(url,n){ return j(url).then(function(d){ if(!d){ SOK=false; return; } var r=(d._embedded&&d._embedded.records)||[]; recs=recs.concat(r);'
+'    var nx=d._links&&d._links.next&&d._links.next.href; if(r.length===200&&nx&&n<10)return page(nx,n+1); }); }'
// NO join=transactions HERE (RAZA 2026-10-19: "why is the admin revenue page loading so slowly").
// Measured against this very account: limit=200 WITH the join is 7,956 ms and 1,326 KB; without it,
// 544 ms and 297 KB. Fourteen times, and this pages up to ten times over.
//
// Nothing this function produces needs the envelope: the ledger, the KPIs, the by-asset table and the
// totals all read amount, asset, sender and date, which the payment record already carries. Only the
// "Revenue by source" breakdown parses envelope_xdr, and it now fetches those itself, bounded and in
// the background, so one slow read no longer holds up the whole page.
+'  return j("/lxapi/feeledger").then(function(d){ /* cached copy of the same records; Horizon only if it fails */ if(d&&d.ok&&Array.isArray(d.records)&&d.records.length){ recs=d.records; return; } return page(H+"/accounts/"+FEE+"/payments?order=desc&limit=200",1); }).then(function(){'
+'    var inc=recs.filter(function(p){ return p.to===FEE && p.from!==FEE && (p.type==="payment"||p.type==="path_payment_strict_send"||p.type==="path_payment_strict_receive"); }).map(function(p){ p.chain="stellar"; return p; });'
+'    RV_SELF=recs.filter(function(p){ return p.to===FEE && p.from===FEE; }).length;'
// One ledger, every chain, newest first. A Stellar failure already resolved above; an XRPL or NEAR
// failure resolves empty with XOK / NOK false, so the panel degrades to what it could read AND SAYS SO
// rather than silently reporting a smaller business. The two are read side by side, not one after the
// other: neither waits on the other's network.
+'    return Promise.all([loadXrpl(),loadNear()]).then(function(z){ var xr=z[0], nr=z[1]; RV_SELF+=XSELF+NSELF;'
+'      var all=inc.concat(xr).concat(nr).filter(function(p){ var f=String(p.from||""); /* D02: our own NEAR wallets are not revenue */ return !((p.chain==="near"&&(({"lumoscore.near":1,"razarizv1.near":1,"lumos01.near":1,"lumoscore-near-testing.near":1})[f]||f.slice(-15)===".lumoscore.near"))||((p.chain||"stellar")==="stellar"&&TREASURY[f])); /* D03: and the Stellar treasury wallets */ }).sort(function(a,b){ return Date.parse(b.created_at)-Date.parse(a.created_at); });'
// SPLIT, not dropped. Everything the collector received is still in `other` and still counted in the
// note below, so a transfer like the 1,000,000 LUMOS can be seen and queried -- it is simply not
// revenue, and nothing above it is computed from it.
// THREE GROUPS, NOT TWO. `other` means "an asset we do not charge fees in" and `ex` means "a person
// said this one is not revenue" -- they leave the totals the same way and for completely different
// reasons, and the note above the page names them separately so neither is read as the other.
+'      RV={ rows:all.filter(function(p){ return isFeeAsset(p)&&!exReason(p); }),'
+'           other:all.filter(function(p){ return !isFeeAsset(p)&&!exReason(p); }),'
+'           ex:all.filter(function(p){ return !!exReason(p); }) };'
+'      return RV; }); }); }'
// ---- USD pricing: exact amounts, converted only where a real price exists ----
// A LOOKUP THAT DID NOT COMPLETE IS NOT A PRICE OF NONE. Every callback is cb(px, unread): px null
// with unread 0 means the source answered and publishes no price for this asset; px null with
// unread 1 means we could not ask at all. They used to be the same null, so a refused request was
// reported to the reader as "no spot price published for this asset" -- a statement about the asset,
// made on the strength of a failed network call. Same rule as the Orders tab's "could not load" and
// the activity feed's unread row. Callers that want neither distinction can still ignore the second
// argument, which is why every existing call site is untouched.
// AND A FAILURE IS NEVER CACHED. PX[k] is only written when a source actually answered: caching the
// null from a dropped request made one bad moment permanent for the rest of the page view, with no
// way to retry short of a reload.
+'var PX={}, LG={};'
+'function priceUsd(code,iss,cb){ var k=code+"-"+(iss||"");'
+'  if(PX[k]!==undefined){ cb(PX[k],0); return; }'
+'  if(code==="XLM"){ j("/lxapi/xlm").then(function(d){ if(d&&+d.usd>0){ PX[k]=+d.usd; cb(PX[k],0); return null; } return j("https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd").then(function(g){ var p=(g&&g.stellar&&+g.stellar.usd)||null; if(p==null){ cb(null,1); return; } PX[k]=p; cb(p,0); }); }); return; }'
+'  j("https://api.stellar.expert/explorer/public/asset?search="+encodeURIComponent(code+"-"+iss)+"&limit=5").then(function(d){'
+'    if(!d){ cb(null,1); return; }'                                           // the request failed; it said nothing about the asset
+'    var rs=(d._embedded&&d._embedded.records)||[];'
+'    var m=rs.filter(function(r){ return String(r.asset||"").indexOf(code+"-"+iss)===0; })[0];'
+'    PX[k]=(m&&+m.price>0)?+m.price:null;'
+'    var ti=(m&&(m.tomlInfo||m.toml_info))||{}; if(ti.image)LG[k]=ti.image;'   // same call already carries the artwork
+'    cb(PX[k],0); }); }'
// ONE CALL CARRIES BOTH. /lxapi/xrplprices returns the XRP/USD rate in `usd` and every token's price
// in XRP in `t`, and it refuses to publish USD at all unless a known stablecoin prices near $1 through
// that same rate -- so a bad rate shows up as no USD rather than as a confident wrong revenue figure.
// It is our own endpoint, cached, and admin serves /lxapi/*, so this costs one upstream batch per load.
+'var XPX=null;'
// The promise is memoised so one page view costs one call -- but a REFUSAL is not memoised, or the
// first bad answer would be the answer until reload, and this endpoint refuses routinely (it is the
// anonymous rate-limit tier whenever XRPLTO_API_KEY is not bound to the project serving it, which is
// exactly how the admin panel ran: the key is on `lumoscore` and was never on `lumoscore-admin`).
// THE PUBLIC SITE'S COPY FIRST, AND THAT IS NOT A HACK -- it is where the API key is. The Function is
// identical on both projects, but secrets are per-project: XRPLTO_API_KEY is bound to `lumoscore` and
// not to `lumoscore-admin` ([[admin-project-has-its-own-secrets]]), so the admin copy runs on the
// upstream's anonymous tier -- 333 requests a day shared across the whole colo -- and refuses most of
// the time. That is what put "couldn't read" on every XRP figure in this panel (RAZA, 2026-10-29).
//
// Asking lumoscore.com instead fixes it with no secret to bind, nothing for RAZA to run, and no key
// duplicated into a second project. It is cheaper too: production's edge cache is already warm from
// real traffic, so this is usually zero upstream calls rather than up to thirty. The endpoint sends
// access-control-allow-origin: *, the admin CSP sets no connect-src, and the request carries no
// credentials and no admin data -- it is the same public price feed every visitor reads.
//
// The admin copy stays as the fallback, so binding the key here later would still work and so would a
// day when the public site is unreachable. A refusal is still never memoised.
+'var XPX_SRC="https://lumoscore.com/lxapi/xrplprices";'
+'function xPrices(){ if(XPX)return XPX;'
+'  XPX=j(XPX_SRC).then(function(d){ if(d&&d.ok)return d;'
+'    return j("/lxapi/xrplprices").then(function(e){ if(e&&e.ok)return e; XPX=null; return null; }); });'
+'  return XPX; }'
// NEAR PRICES. NEAR itself and wNEAR (wrap.near, 1:1 with NEAR) come from CoinGecko's "near"; every
// other NEP-141 token from prices.intear.tech, one public call that maps contract id -> USD for ~6,000
// NEAR tokens (verified 2026-11-10: wrap.near 3.567, usdt.tether-token.near 1). Intear answers 0 for a
// token it has no market for -- LUMOS on NEAR has no pool yet and reads 0 -- and 0 is NOT a price: it
// becomes the dash, out of the USD total. A call that failed is the third state, "couldn't read", and
// like every other source here it is never memoised, so the next paint asks again.
// The response is ~260 KB, so it is fetched once per page view and only when a NEAR token needs it.
+'var NPX=null, NGP=null;'
+'function nPrices(){ if(NPX)return NPX;'
+'  NPX=j("https://prices.intear.tech/prices").then(function(d){ if(d&&typeof d==="object"&&d["wrap.near"]!==undefined)return d; NPX=null; return null; });'
+'  return NPX; }'
+'function nNear(){ if(NGP)return NGP;'
+'  NGP=j("https://api.coingecko.com/api/v3/simple/price?ids=near&vs_currencies=usd").then(function(g){ var p=g&&g.near&&+g.near.usd; if(p>0)return p;'
+'    return nPrices().then(function(d){ var w=d&&+d["wrap.near"]; if(w>0)return w; NGP=null; return null; }); });'
+'  return NGP; }'
+'function nearPrice(code,iss,cb){'
+'  if(!iss||iss==="wrap.near"){ nNear().then(function(p){ if(p==null){ cb(null,1); return; } cb(p,0); }); return; }'
+'  nPrices().then(function(d){ if(!d){ cb(null,1); return; } var v=+d[iss]; cb(v>0?v:null,0); }); }'
+'function priceUsdOn(chain,code,iss,cb){ if(chain==="near"){ nearPrice(code,iss,cb); return; }'
+'  if(chain!=="xrpl"){ priceUsd(code,iss,cb); return; }'
+'  xPrices().then(function(d){'
+'    if(!d){ cb(null,1); return; }'                                           // endpoint unreachable or refusing
// usd null is the endpoint WITHHOLDING a rate it could not stand behind (its stablecoin check failed),
// which is still "we could not price this", never "this asset has no price".
+'    var u=+d.usd; if(!(u>0)){ cb(null,1); return; }'
+'    if(code==="XRP"&&!iss){ cb(u,0); return; }'
+'    var row=d.t&&d.t[iss+"-"+xCur(code)];'
+'    cb((row&&+row[0]>0)?(+row[0])*u:null,0); }); }'
+'var KN=[["USDC","GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"],["AQUA","GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA"],["yXLM","GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55"],["EURC","GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2"],["yUSDC","GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF"]];'
// each curated pool is <asset>/XLM, so the XLM side doubled is the pool's total value in XLM
+'var POOLS=null;'
+'function loadPools(){ if(POOLS)return Promise.resolve(POOLS);'
+'  return Promise.all(KN.map(function(t){'
+'    return j(H+"/liquidity_pools?reserves=native,"+encodeURIComponent(t[0]+":"+t[1])+"&limit=1").then(function(d){'
+'      var p=d&&d._embedded&&d._embedded.records&&d._embedded.records[0]; if(!p)return null;'
+'      var xlm=0; (p.reserves||[]).forEach(function(r){ if(r.asset==="native")xlm+=+r.amount||0; });'
+'      return {code:t[0],iss:t[1],id:p.id,xlm:xlm*2}; });'
+'  })).then(function(a){ POOLS=a.filter(Boolean).sort(function(x,y){return y.xlm-x.xlm;}); return POOLS; }); }'
+'function pageTitle(){ return ((q(".admin-page-title")||q(".mob-page-title")||{}).textContent||"").trim(); }'
+'function pageHead(){ return q(".admin-page-head")||q(".mob-page-head"); }'
// The first call REMOVES the pager buttons, which used to make every later call a no-op: .pg-btn was
// gone, so the function returned before touching the count. That is why switching to a tab with one
// row left the line reading "1-55 of 55" -- the curated tab had written it and nothing could rewrite
// it. The info element is stamped on the way past so it can still be found afterwards.
+'function fixPager(n){ var info=q(".lxpg-info"), b=q(".pg-btn");'
+'  if(b){ var ctrls=b.parentNode, row=ctrls.parentNode;'
+'    info=row.querySelector(".pg-info"); if(!info){ var f=row.firstElementChild; if(f&&f!==ctrls)info=f; }'
+'    if(info)info.className=(info.className?info.className+" ":"")+"lxpg-info";'
+'    ctrls.remove(); }'
+'  if(info)info.innerHTML="<span class=\\"mono\\">"+(n?1:0)+"</span>\\u2013<span class=\\"mono\\">"+n+"</span> of <span class=\\"mono\\">"+n+"</span>"; }'
+'function isMob(){ return !!q(".mob-page-title"); }'
+'function isDash(){ return /^Dashboard/.test(pageTitle()) && !isMob(); }'
// THE NATIVE ASSET DEPENDS ON THE CHAIN. This read "native -> XLM" unconditionally, which was right
// while there was one chain and silently wrong the moment XRPL receipts arrived: every XRP fee was
// labelled XLM in the ledger, grouped under the XLM key, and then went looking for an XLM price for an
// XRP amount. assetOf is the single place that decides a receipt's asset, so the ledger table, the
// by-asset grouping, the month bars, the dashboard tile, the feed and the CSV are all fixed here.
+'function assetOf(p){ return p.asset_type==="native"?{code:(p.chain==="xrpl"?"XRP":(p.chain==="near"?"NEAR":"XLM")),iss:""}:{code:p.asset_code||"?",iss:p.asset_issuer||""}; }'
// ONE PLACE PER CHAIN FOR ITS NAME AND ITS EXPLORER. These were inline ternaries -- xrpl, else Stellar --
// at every surface, and a third chain would have been labelled "Stellar" and linked to stellar.expert at
// each one it was not caught. NearBlocks for NEAR: it is the explorer the NEAR site already links.
+'function chainName(c){ return c==="xrpl"?"XRP Ledger":(c==="near"?"NEAR":"Stellar"); }'
+'function chainTag(c){ return c==="xrpl"?"XRPL":(c==="near"?"NEAR":"Stellar"); }'
// A NEAR account is usually a NAME (lumos01.near), and cutting it to four-and-four makes it unreadable;
// only a long one -- a 64-hex implicit account -- is shortened like a G- or r-address.
+'function shortA(c,a){ a=String(a||""); return (c==="near"&&a.length<=32)?a:shortG(a); }'
+'function exAcct(c,a){ a=encodeURIComponent(a||""); return c==="xrpl"?("https://bithomp.com/explorer/"+a):(c==="near"?("https://nearblocks.io/address/"+a):("https://stellar.expert/explorer/public/account/"+a)); }'
+'function exTx(c,h){ h=encodeURIComponent(h||""); return c==="xrpl"?("https://bithomp.com/explorer/"+h):(c==="near"?("https://nearblocks.io/txns/"+h):("https://stellar.expert/explorer/public/tx/"+h)); }'
// Every surface that dashes a total while a chain is missing asks this, so a fourth chain is one edit.
+'function allRead(){ return SOK!==false&&XOK!==false&&NOK!==false; }'
// ---- Revenue page ----
+'function paintRevenue(){ if(!q("#lxRevByAsset"))return;'
+'  loadRevenue().then(function(rv){ var head=pageHead(); if(!head||q(".lxadm-note"))return;'
+'    var other=(rv.other||[]).length, exn=(rv.ex||[]).length, parts=[];'
+'    if(RV_SELF) parts.push(RV_SELF+" self-transfer(s) (the collector paying itself)");'
+'    if(other) parts.push(other+" payment(s) that are not fees");'
+'    if(exn) parts.push(exn+" receipt(s) marked not revenue by hand (still in the ledger below, struck through)");'
// THE UNREACHABLE WARNING COMES FIRST AND LOOKS LIKE A WARNING. Everything else on this page is a
// figure; this is the one line that says the figures are incomplete, and it has to outrank them.
// NEAR has a second way to be incomplete: the Function answered, but is still decoding older history.
// Named as such, because "could not be read" would send the reader looking for an outage.
+'    var down=[]; if(SOK===false)down.push("Stellar"); if(XOK===false)down.push("the XRP Ledger"); if(NOK===false)down.push(NPART?"NEAR (still being read \\u2014 only part of its history is in)":"NEAR");'
+'    if(down.length){ var w=document.createElement("div"); w.className="lxadm-note";'
+'      w.style.cssText="border-left:3px solid #e3a008;padding-left:11px;color:#e3a008";'
+'      w.textContent="\\u26a0 "+down.join(" and ")+" could not be read in full just now, so these figures are INCOMPLETE \\u2014 receipts from "+(down.length>1?"those chains":down[0].split(" (")[0])+" are missing and the totals are shown as \\u2014 rather than a number. Reload to try again.";'
+'      head.parentNode.insertBefore(w, head.nextSibling); }'
+'    if(!parts.length) return;'
+'    var d=document.createElement("div"); d.className="lxadm-note";'
+'    d.textContent="Excludes "+parts.join(" and ")+". Fees arrive as XLM or USDC on Stellar, XRP on the XRP Ledger, and on NEAR in whatever token was swapped, carrying a LumosCore fee memo (a launch fee comes from the LumosCore factory instead) \\u2014 so anything else paid into a collector is a transfer rather than revenue. It is listed under Other on-chain and left out of the totals above.";'
+'    head.parentNode.insertBefore(d, head.nextSibling); });'
+'  loadRevenue().then(function(rv){ var rows=rv.rows;'
+'    var now=new Date(), mStart=new Date(now.getFullYear(),now.getMonth(),1).getTime();'
+'    var byA={}, wallets={}, monthRows=[];'
+'    rows.forEach(function(p){ var a=assetOf(p), ch=p.chain||"stellar", k=ch+":"+a.code+"-"+a.iss;'
+'      byA[k]=byA[k]||{chain:ch,code:a.code,iss:a.iss,amt:0,month:0};'
+'      byA[k].amt+=+p.amount||0; wallets[p.from]=1;'
+'      if(Date.parse(p.created_at)>=mStart){ byA[k].month+=+p.amount||0; monthRows.push(p); } });'
+'    setT(q("#lxRevCount"), num(rows.length));'
+'    setT(q("#lxRevWallets"), num(Object.keys(wallets).length));'
+'    var keys=Object.keys(byA);'
// Named by what WAS read, so a missing chain is visible in the subtitle as well as in the warning.
+'    var rd=[]; if(SOK!==false)rd.push("Stellar"); if(XOK!==false)rd.push("XRP Ledger"); if(NOK!==false)rd.push("NEAR");'
+'    var chains=(rd.length===3?"all three chains":(rd.length?(rd.join(" + ")+" only"):"no chain read"));'
+'    var sub=q("#lxRevLedgerSub"); if(sub)sub.textContent=(rows.length?("newest first \\u00b7 "+rows.length+" receipts \\u00b7 "+chains):"")'
+'      +((SOK===false)?" \\u00b7 Stellar unreachable":"")+((XOK===false)?" \\u00b7 XRP Ledger unreachable":"")+((NOK===false)?(NPART?" \\u00b7 NEAR still being read":" \\u00b7 NEAR unreachable"):"");'
+'    var tb=q("#lxRevLedger tbody");'
// bithomp is the explorer the XRPL site already links everywhere else; matching it keeps one
// explorer per chain instead of a third one that only the admin panel uses.
// EVERY RECEIPT, fee or not, newest first. Both kinds that leave the totals are still here, dimmed and
// struck through and carrying the reason they left: one the asset rule dropped, and one a person named
// in NOT_REVENUE. A figure nobody can see is a figure nobody can question, and a row that silently
// vanished is one nobody can put back. Only the totals ignore them.
+'    var led=rows.concat(rv.other||[]).concat(rv.ex||[]).filter(function(p){ var f=String(p.from||""); return !((f==="lumoscore.near"||f.slice(-15)===".lumoscore.near")&&!isFeeAsset(p)&&!exReason(p)); }).sort(function(a,b){ return Date.parse(b.created_at)-Date.parse(a.created_at); });'
// FIFTY A PAGE (RAZA 2026-10-19: "add pagination for the fee ledger ... otherwise it will just keep
// getting longer and might even affect page loading speed"). It was a flat slice of 60, so every
// receipt past the sixtieth was simply unreachable -- and had the cap been lifted instead, the table
// would grow without limit and take the page down with it. The pager below is drawn from the same
// array, so the count, the window and the rows cannot disagree.
+'    if(sub&&led.length>rows.length)sub.textContent=sub.textContent.replace(" receipts "," fee receipts + "+(led.length-rows.length)+" not counted "); var LEDN=50; if(window.__lxLedPage==null)window.__lxLedPage=0;'
+'    var pages=Math.max(1,Math.ceil(led.length/LEDN));'
+'    if(window.__lxLedPage>pages-1)window.__lxLedPage=pages-1;'
+'    var from=window.__lxLedPage*LEDN, win=led.slice(from,from+LEDN);'
+'    if(tb){ tb.innerHTML = led.length ? win.map(function(p){ var a=assetOf(p), ch=(p.chain||"stellar");'
+'        var exr=exReason(p), nf=!isFeeAsset(p)||!!exr;'
+'        var acct=exAcct(ch,p.from), txu=exTx(ch,p.transaction_hash);'
// "not a fee asset" is the wrong reason on NEAR, where any token can be a fee: there it was the memo.
+'        var why=exr?esc(exr):(ch==="near"?"no LumosCore fee memo":"not a fee asset");'
+'        return "<tr"+(nf?" style=\\"opacity:.55\\"":"")+">"'
+'          +"<td>"+esc(new Date(p.created_at).toLocaleString())+"</td>"'
+'          +"<td>"+chainName(ch)+"</td>"'
+'          +"<td class=\\"mono\\"><a class=\\"lxadm-link\\" target=\\"_blank\\" rel=\\"noopener\\" href=\\""+esc(acct)+"\\" title=\\""+esc(p.from)+"\\">"+esc(shortA(ch,p.from))+"</a></td>"'
+'          +"<td>"+esc(a.code)+(nf?("<div style=\\"font-size:11px;opacity:.85\\">"+why+" \\u00b7 not counted</div>"):"")+"</td>"'
+'          +"<td style=\\"text-align:right\\" class=\\"mono\\">"+(nf?("<s>"+esc(num(+p.amount))+"</s>"):esc(num(+p.amount)))+"</td>"'
+'          +"<td style=\\"text-align:right\\"><a class=\\"lxadm-link\\" target=\\"_blank\\" rel=\\"noopener\\" href=\\""+esc(txu)+"\\">view</a></td></tr>"; }).join("")'
+'      : "<tr><td colspan=\\"6\\" class=\\"lxadm-empty\\">No fee receipts yet. Fees are paid to <span class=\\"mono\\">"+esc(shortG(FEE))+"</span> on Stellar, <span class=\\"mono\\">"+esc(shortG(XFEE))+"</span> on the XRP Ledger and <span class=\\"mono\\">"+esc(NFEE)+"</span> on NEAR when users swap or add liquidity.</td></tr>"; }'
// The pager sits under the table and is rebuilt with it. Only drawn when there is more than one page:
// a "1 of 1" control is a control that does nothing.
+'    (function(){ var host=tb&&tb.closest?tb.closest(".adm-card"):null; if(!host)return;'
+'      var bar=host.querySelector(".lxled-pg");'
+'      if(pages<2){ if(bar&&bar.parentNode)bar.parentNode.removeChild(bar); return; }'
+'      if(!bar){ bar=document.createElement("div"); bar.className="lxled-pg";'
+'        bar.style.cssText="display:flex;align-items:center;gap:10px;justify-content:flex-end;padding:11px 14px;border-top:1px solid var(--border)";'
+'        host.appendChild(bar); }'
+'      var lo=from+1, hi=Math.min(from+LEDN,led.length);'
+'      bar.innerHTML="<span style=\\"margin-right:auto;color:var(--text-muted);font-size:13px\\">"'
+'        +lo+"\\u2013"+hi+" of "+led.length+"</span>"'
+'        +"<button type=\\"button\\" class=\\"adm-btn ghost\\" data-led=\\"prev\\""+(window.__lxLedPage<=0?" disabled":"")+">Previous</button>"'
+'        +"<span style=\\"color:var(--text-muted);font-size:13px\\">Page "+(window.__lxLedPage+1)+" of "+pages+"</span>"'
+'        +"<button type=\\"button\\" class=\\"adm-btn ghost\\" data-led=\\"next\\""+(window.__lxLedPage>=pages-1?" disabled":"")+">Next</button>";'
// One delegated listener for the page, registered once: the bar is rebuilt on every repaint and a
// listener bound to the buttons would go with it.
+'      if(!document.body.__lxLedW){ document.body.__lxLedW=1;'
+'        document.addEventListener("click",function(e){'
+'          var b=e.target&&e.target.closest?e.target.closest("[data-led]"):null; if(!b||b.disabled)return;'
+'          e.preventDefault();'
+'          window.__lxLedPage+=(b.getAttribute("data-led")==="next"?1:-1);'
+'          if(window.__lxLedPage<0)window.__lxLedPage=0;'
+'          try{ paintRevenue(); }catch(_){}'
+'        },true); } })();'
+'    var pending=keys.length, usdAll=0, usdMonth=0, priced=0, unpriced=[], noread=[];'
+'    function render(){'
+'      var tb2=q("#lxRevByAsset tbody"); if(!tb2)return;'
// NEAR FEES ARE wNEAR NOW (RAZA 2026-11-18: "now that we're only using wNEAR on NEAR, please remove the remaining NEAR
// assets"). Fees used to be taken in whatever token was swapped, which left dust rows (GEAR, AURORA, DARK, QTC, NEARLY,
// LUMOS -- about $0.0002 together) in this table. Only NEAR and wNEAR are listed for NEAR now. The others are still
// revenue: they stay in the totals above and in the fee ledger below, and the table subtitle says how many are not listed.
+'      var shown=keys.filter(function(k){ var a=byA[k]; return a.chain!=="near"||a.code==="wNEAR"||a.code==="NEAR"; });'
+'      var hidN=keys.length-shown.length, hidUsd=keys.filter(function(k){ return shown.indexOf(k)<0; }).reduce(function(s,k){ return s+(byA[k].usd||0); },0);'
+'      var tot=shown.reduce(function(s,k){ return s+(byA[k].usd||0); },0);'
+'      tb2.innerHTML = shown.length ? shown.sort(function(x,y){ return (byA[y].usd||0)-(byA[x].usd||0); }).map(function(k){ var a=byA[k];'
+'          var sh=tot>0&&a.usd!=null?((a.usd/tot*100).toFixed(1)+"%"):"\\u2014";'
+'          return "<tr><td><span class=\\"lxadm-asset\\"><span class=\\"lxadm-ico\\" data-lxc=\\""+esc(a.code)+"\\"><img src=\\""+(LG[k]||avatar(a.code))+"\\" alt=\\"\\"></span>"+esc(a.code)+"<span style=\\"opacity:.55;font-size:11px;margin-left:5px\\">"+chainTag(a.chain)+"</span></span></td>"'
+'            +"<td style=\\"text-align:right\\" class=\\"mono\\">"+esc(num(a.amt))+"</td>"'
// THREE STATES, NOT TWO. A number, a dash for an asset nobody publishes a price for, and words for a
// price we could not read. The dash and the words are both "no figure here", but only one of them is
// a fact about the asset -- and the dash's tooltip asserted that fact either way.
+'            +"<td style=\\"text-align:right\\" class=\\"mono\\">"+(a.usd!=null?esc(usd(a.usd)):(a.unread'
+'              ?"<span style=\\"font-style:italic;color:var(--text-muted)\\" title=\\"The price source could not be reached, so this asset is left out of the USD total. The amount collected, on the left, is exact. Reload to try again.\\">couldn\\u2019t read</span>"'
+'              :"<span title=\\"No spot price published for this asset \\u2014 counted in its own units, excluded from the USD total.\\">\\u2014</span>"))+"</td>"'
+'            +"<td style=\\"text-align:right\\">"+sh+"</td></tr>"; }).join("")'
+'        : "<tr><td colspan=\\"4\\" class=\\"lxadm-empty\\">No fees collected yet.</td></tr>";'
// A TOTAL WITH A CHAIN MISSING IS NOT A TOTAL. Showing "$0" or a part-figure invites it to be read,
// quoted and acted on; a dash plus the warning above cannot be.
+'      var whole=allRead();'
+'      setT(q("#lxRevAll"), (whole&&keys.length)?usd(usdAll):"\\u2014");'
+'      setT(q("#lxRevMonth"), (whole&&keys.length)?usd(usdMonth):"\\u2014");'
+'      var s1=q("#lxRevAllSub"), s2=q("#lxRevMonthSub");'
+'      var uns=unpriced.length?(" \\u00b7 "+unpriced.length+" asset"+(unpriced.length>1?"s":"")+" unpriced"):"";'
// Reported separately from "unpriced" everywhere it is reported at all, because the reader's next move
// differs: an unpriced asset will still be unpriced after a reload, an unread one may not be.
+'      var nrd=noread.length?(" \\u00b7 "+noread.length+" price"+(noread.length>1?"s":"")+" could not be read"):"";'
+'      if(s1)s1.textContent="across "+keys.length+" asset"+(keys.length===1?"":"s")+uns+nrd;'
+'      if(s2)s2.textContent=new Date().toLocaleString(undefined,{month:"long"})+uns+nrd;'
+'      var bs=q("#lxRevBySub"); if(bs)bs.textContent="exact on-chain amounts"+(unpriced.length?" \\u00b7 USD shown where a spot price exists":"")+nrd'
+'        +(hidN?(" \\u00b7 "+hidN+" older NEAR fee token"+(hidN>1?"s":"")+" not listed ("+usd(hidUsd)+", still in the totals and the ledger)"):"");'
+'    }'
+'    if(!pending){ render(); return; }'
+'    keys.forEach(function(k){ var a=byA[k];'
+'      priceUsdOn(a.chain,a.code,a.iss,function(px,unread){'
+'        if(px!=null){ a.usd=a.amt*px; usdAll+=a.usd; usdMonth+=a.month*px; priced++; a.unread=0; }'
+'        else { a.usd=null; a.unread=unread?1:0; (unread?noread:unpriced).push(a.code); }'
+'        if(--pending===0)render(); }); });'
+'  }); }'
// ---- CSV export (real ledger, no backend needed) ----
+'function wireCsv(){ var b=q("#lxRevCsv"); if(!b||b.__lx)return; b.__lx=1;'
+'  b.addEventListener("click",function(){ loadRevenue().then(function(rv){'
+'    var head="chain,date,from,asset,issuer,amount,tx\\n";'
+'    var body=rv.rows.map(function(p){ var a=assetOf(p); return [(p.chain||"stellar"),p.created_at,p.from,a.code,a.iss,p.amount,p.transaction_hash].join(","); }).join("\\n");'
+'    var blob=new Blob([head+body],{type:"text/csv"}); var u=URL.createObjectURL(blob);'
+'    var el=document.createElement("a"); el.href=u; el.download="lumoscore-fees.csv"; el.click(); setTimeout(function(){URL.revokeObjectURL(u);},1000); }); }); }'
// ---- Dashboard KPIs: fill what is real, dash what needs a backend ----
+`
// ---- Dashboard: windowed volume / trades / wallets, lifetime totals, and the 250K fee tier ----
// The SDK is only needed to read an envelope, so it loads on demand and only where it is used.
var _sbP=null;
function sdk(){ if(!_sbP)_sbP=new Promise(function(res,rej){
  if(window.StellarBase)return res(window.StellarBase);
  var el=document.createElement("script");
  el.src="/assets/vendor/stellar-base-13.0.1.min.js";
  el.onload=function(){ window.StellarBase?res(window.StellarBase):rej(new Error("sdk")); };
  el.onerror=function(){ rej(new Error("sdk")); };
  document.head.appendChild(el); }); return _sbP; }
// Gross volume for one fee receipt: the user's own swap leg plus the fee leg, both denominated in the
// asset being sent. Returns null when the envelope holds no swap -- a bare fee payment with no trade
// behind it is not volume, and is reported as unresolved rather than counted as zero.
// Also classifies WHERE the money came from, by the shape of the transaction rather than by its size.
// Measured across all 69 receipts, the shapes are: a user swap plus its fee (trading), the launchpad's
// issuance transaction which carries createAccount / setOptions / liquidityPoolDeposit (minting), and a
// handful of bare payments that are neither. Amount-based guessing would have been fragile -- a mint
// fee is 34.70 XLM today and that number is a config value, not a law.
function grossOf(S,p){ try{
  var ex=p.transaction&&p.transaction.envelope_xdr; if(!ex)return null;
  var tx=S.TransactionBuilder.fromXDR(ex,S.Networks.PUBLIC);
  var ops=tx.operations||[], swap=null, fee=0, mint=false;
  for(var i=0;i<ops.length;i++){ var o=ops[i];
    if(o.type==="setOptions"||o.type==="createAccount"||o.type==="liquidityPoolDeposit")mint=true;
    if(o.type==="pathPaymentStrictSend"&&o.destination===p.from){ swap=o; }
    else if(o.destination===FEE){ fee+=(+o.sendAmount||+o.amount||0); } }
  var kind=swap?"trade":(mint?"mint":"other");
  if(!swap)return {kind:kind,code:null,iss:"",gross:0};
  var a=swap.sendAsset; if(!a)return {kind:kind,code:null,iss:"",gross:0};
  var code=(a.isNative&&a.isNative())?"XLM":a.code;
  if(!code)return {kind:kind,code:null,iss:"",gross:0};
  var iss=(code==="XLM")?"":(a.issuer||"");
  return {kind:kind,code:code,iss:iss,gross:(+swap.sendAmount||0)+fee};
}catch(e){ return null; } }
// Which receipts were bridge fees. Shape cannot tell us (see the note above), so this is the authority;
// every entry was verified against the ledger server-side before it was stored. An unreachable
// registry degrades to {} and the rows simply stay in "other" -- never to a wrong attribution.
var BRIDGE=null;
function loadBridge(){ if(BRIDGE)return Promise.resolve(BRIDGE);
  return fetch("/lxapi/bridgetx?limit=200&routes=all").then(function(r){ return r.ok?r.json():null; })
    .then(function(d){ var m={}; ((d&&d.rows)||[]).forEach(function(x){ if(x&&x.feeHash)m[x.feeHash]=x; });
      BRIDGE=m; return m; })
    .catch(function(){ BRIDGE={}; return BRIDGE; }); }
var VOL=null, VOL_CAPPED=false, VOL_FAILED=false;
// Receipts with no swap behind them, inside a period (since=0: all of them). B01, 2026-11-21.
function missIn(v,since){ if(!v||!(v.missing>0))return 0; if(!since||!v.missAt)return v.missing; return v.missAt.filter(function(t){ return t>=since; }).length; }
// THE ENVELOPES, FETCHED ON THEIR OWN. loadRevenue dropped join=transactions because it costs fourteen
// times the time for data only this breakdown uses. One joined page is fetched here instead -- bounded
// at 200 receipts, roughly eight seconds, and nothing else on the page waits for it.
//
// The capped flag is recorded rather than hidden: if the collector ever holds more than 200 receipts
// the breakdown covers the most recent 200 and the subtitle has to say so, or a partial split reads as
// the whole business. Same rule as the unreachable-chain warning above.
// (No backticks anywhere in this block -- it sits inside a template literal and one would end it.)
var ENVP=null;
function loadEnvelopes(){ if(ENVP)return ENVP;
  ENVP=j(H+"/accounts/"+FEE+"/payments?order=desc&limit=200&join=transactions").then(function(d){
    var recs=(d&&d._embedded&&d._embedded.records)||[], m={};
    if(!d) return {map:{},capped:false,failed:true};
    recs.forEach(function(p){ if(p.transaction_hash&&p.transaction)m[p.transaction_hash]=p.transaction; });
    return {map:m,capped:recs.length>=200,failed:false};
  }).catch(function(){ return {map:{},capped:false,failed:true}; });
  return ENVP; }
// EVERY RECEIPT, FROM OUR OWN ENDPOINT, with the 200-envelope page kept as the fallback.
//
// loadEnvelopes fetches ONE page of 200, so a receipt older than that returned null from grossOf and
// contributed zero volume. Measured 2026-10-21: 366 inbound receipts, 200 envelopes, 166 silently
// dropped. /lxapi/revvolume pages ALL of them at the edge, once per cache period, and reads Horizon's
// JSON operations rather than parsing XDR -- same field-for-field logic, written out in that file.
//
// WHAT IT DID NOT FIX, recorded so nobody re-chases it: the dropped 166 were worth about nothing. The
// full recomputation came to $1,684 against the capped page's $1.7K. RAZA's remembered ~$20K was a
// DOUBLE COUNT removed on 2026-09-19 (cb05ea6b) -- bridges used to be added to swap volume AND to
// cross-chain volume. This endpoint is correctness and headroom, not a restoration of that figure.
//
// STELLAR ONLY. rv.rows carries both chains; the endpoint reads the Stellar collector. An XRPL receipt
// is simply not in the map and falls through to the path below, exactly as before.
var RVOL=null;
function loadRevVol(){ if(RVOL)return RVOL;
  RVOL=j("/lxapi/revvolume").then(function(d){ return (d&&d.ok&&d.rows)?d:null; }).catch(function(){ return null; });
  return RVOL; }
function loadVolume(){ if(VOL)return Promise.resolve(VOL);
  return Promise.all([loadRevenue(),sdk(),loadBridge(),loadEnvelopes(),loadRevVol()]).then(function(z){ var rv=z[0],S=z[1],BR=z[2]||{},EN=z[3]||{map:{}},RV=z[4];
    var out=[],miss=0,missAt=[];
    // grossOf reads p.transaction, which the payment record no longer carries; put it back from the
    // envelope page so the function itself is unchanged.
    rv.rows.forEach(function(p){ if(!p.transaction&&EN.map[p.transaction_hash])p.transaction=EN.map[p.transaction_hash]; });
    var RVM={}; if(RV)(RV.rows||[]).forEach(function(r){ if(r&&r.h)RVM[r.h]=r; });
    // Capped only when we are still relying on the 200-page. A complete endpoint answer retires the
    // warning; a failed one leaves it exactly as it was, because then the page really is capped.
    VOL_CAPPED=RV?!!RV.capped:!!EN.capped; VOL_FAILED=!!EN.failed&&!RV;
    // Every receipt is kept now, not just the ones with a swap, because the revenue breakdown needs to
    // account for all of them. Volume still only counts rows with gross > 0; a mint fee is revenue but
    // it is not trading volume, and adding it to volume would overstate how much is being traded.
    rv.rows.forEach(function(p){
      // THE XRP LEDGER LEAVES BEFORE grossOf, WHICH IS WHY ITS FEES WERE MISSING ENTIRELY. grossOf
      // reads p.transaction.envelope_xdr and returns null without one; an XRPL receipt has no
      // envelope, so every single one hit the miss++ return below and never reached the rows at all.
      // NO BACKTICKS IN THIS COMMENT -- it sits inside a template literal.
      // "Revenue by source" therefore split a business it was only seeing half of, and the XRP was
      // not merely unpriced there -- it was absent. (RAZA 2026-10-29.)
      //
      // It carries NO gross: valuing an XRPL swap needs the swap transaction, which we do not fetch.
      // Zero keeps it out of volUsd and the per-asset volume maps, which both skip a row with no
      // gross, so swap volume stays Stellar-only and labelled -- the documented behaviour at the top
      // of this file, deliberately unchanged. The FEE is what this row is here to carry.
      if(p.chain==="xrpl"){
        out.push({t:Date.parse(p.created_at),from:p.from,code:null,iss:"",gross:0,chain:"xrpl",
          kind:xKind(p.memo),fee:(+p.amount||0),feeCode:"XRP",feeIss:"",
          // Deliberately not reconstructed from the marker. bridged feeds the cross-chain VOLUME
          // figure and the per-route split, and we know the route but not one dollar of what crossed;
          // a route named with nothing behind it reads as "Axelar: $0.00", which is worse than silent.
          bridged:0,route:"",bridgeTo:""});
        return;
      }
      // NEAR, the same way and for the same reasons: no envelope, so no gross and no bridged value -- the
      // fee is what this row carries, in whatever token it arrived in, and its kind comes off the memo.
      // NO BACKTICKS IN THIS COMMENT -- it sits inside a template literal.
      if(p.chain==="near"){
        var na=assetOf(p);
        out.push({t:Date.parse(p.created_at),from:p.from,code:null,iss:"",gross:0,chain:"near",
          kind:nKind(p),fee:(+p.amount||0),feeCode:na.code,feeIss:na.iss,
          bridged:0,route:"",bridgeTo:""});
        return;
      }
      // The endpoint's answer wins where it has one: it read the real transaction, and it read every
      // receipt rather than the most recent 200. grossOf stays as the fallback for anything it did not
      // cover -- a Stellar one it could not resolve.
      var rvr=RVM[p.transaction_hash];
      var g=rvr?{kind:rvr.kind,code:rvr.code,iss:rvr.iss||"",gross:+rvr.gross||0}:grossOf(S,p);
      if(!g){ miss++; missAt.push(Date.parse(p.created_at)||0); return; }
      var br=BR[p.transaction_hash];
      // A registered bridge is a bridge, whatever its shape looked like. Its "gross" is the amount
      // that crossed, kept in bridged rather than gross so it can never be added to SWAP volume --
      // bridging is real volume, but it is not trading, and conflating them overstates the DEX.
      if(br)g.kind="bridge";
      if(!g.gross&&!br){ miss++; missAt.push(Date.parse(p.created_at)||0); }
      var fa=assetOf(p);
      out.push({t:Date.parse(p.created_at),from:p.from,code:g.code,iss:g.iss,gross:g.gross,chain:"stellar",
        kind:g.kind,fee:(+p.amount||0),feeCode:fa.code,feeIss:fa.iss,
        // IN DOLLARS, per route (RAZA 2026-09-19: add LayerZero and NEAR Intents fees to admin). CCTP moves USDC and
        // LayerZero USDT0 -- both dollars by construction; a NEAR Intents transfer can deliver ETH or MON, so its value
        // is the one 1Click itself put on the deposit (usdIn, stored with the record).
        bridged:br?(br.route==="NEAR Intents"?(+br.usdIn||0):(br.route==="LayerZero"?(+br.amount||0):(+br.gross||+br.amount||0))):0,
        route:br?(br.route||"CCTP"):"",bridgeTo:br?(br.destName||""):""}); });
    VOL={rows:out,missing:miss,missAt:missAt}; return VOL; })
   .catch(function(){ VOL={rows:[],missing:-1}; return VOL; }); }
// EVERY LUMOSCORE TRANSACTION ON NEAR, priced (see the dashboard tiles). The list is decoded at lumoscore.com and cached
// there; on a cold cache it answers complete:false and decodes 25 more per call, so it is asked again, a few times. NEAR
// and wNEAR are worth NEAR/USD; any other token is its roster price (in NEAR) times NEAR/USD; a token outside the roster
// stays unpriced and is counted as such, never guessed. null = NEAR could not be read at all.
var NVOL=null;
function loadNearVol(){ if(NVOL)return NVOL;
  var B="https://lumoscore.com";
  // Asked again while it is still decoding AND after an error: a cold cache answers an error page or ok:false on its
  // first calls, then catches up (measured on staging). 20 calls at most; the last good answer, complete or not, is used.
  var last=null;
  function act(n){ return j(B+"/lxapi/nearactivity?all=1&r="+n+"-"+Date.now()).then(function(d){
    if(d&&d.ok)last=d;
    if((!d||!d.ok||!d.complete)&&n<20)return act(n+1); return last; }); }
  // NEAR/USD falls back to the pools feed's own rate: nearmarket answers ok:false when DexScreener refuses it (seen on
  // staging 2026-11-18), and NEAR itself -- most of the bridged value -- needs only that one rate.
  NVOL=Promise.all([act(0),j(B+"/lxapi/nearmarket"),j(B+"/lxapi/nearpools?n=1")]).then(function(z){ var d=z[0], m=z[1], pl=z[2];
    if(!d||!d.ok)return null;
    var nu=(m&&+m.usd>0)?+m.usd:((pl&&+pl.usd>0)?+pl.usd:null), px={};
    ((m&&m.rows)||[]).forEach(function(r){ if(r&&r.i&&+r.p>0)px[r.i]=+r.p; });
    var rows=(d.rows||[]).map(function(r){ var p=(r.c==="near"||r.c==="wrap.near")?1:px[r.c];
      return {t:+r.ts,who:r.who||"",kind:r.kind,route:r.via||"",usd:(nu&&p!=null&&r.v!=null)?(+r.v)*p*nu:null}; });
    return {rows:rows,complete:!!d.complete}; }).catch(function(){ return null; });
  return NVOL; }
// Assets we cannot price are reported, never guessed at -- the rule the revenue table already follows.
function volUsd(rows,since,cb){ var byA={};
  // a bridge whose fee rode a swap (every swap-first transfer, any route) is NOT swap volume: it is counted once, as
  // cross-chain volume. The comment on bridged said so; this is where it was not enforced.
  rows.forEach(function(r){ if(since&&r.t<since)return; if(r.kind==="bridge")return; if(!r.code||!r.gross)return; var k=r.code+"-"+r.iss;
    byA[k]=byA[k]||{code:r.code,iss:r.iss,amt:0}; byA[k].amt+=r.gross; });
  var ks=Object.keys(byA); if(!ks.length){ cb(0,0); return; }
  var pend=ks.length,total=0,unpriced=0;
  ks.forEach(function(k){ var a=byA[k]; priceUsd(a.code,a.iss,function(px){
    if(px!=null)total+=a.amt*px; else unpriced++;
    if(--pend===0)cb(total,unpriced); }); }); }
// Wallets at or above the fee-tier threshold. stellar.expert ranks holders by balance DESCENDING, so
// this stops at the first holder below the line instead of paging every trustline: measured, the
// boundary sits at #115 inside the very first page of 200. Balances arrive in stroops.
// Treasury / burn wallets use the SAME list the rewards engine uses, so the two agree.
var LUMOS_ISS="GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S",TIER=250000;
var TREASURY={"GBIU5NISX5IP6VXZK7DEKLZC4ZVPWNCDEYQLQGXG33Y3J2LHPKPCHUOK":1,
"GCCDEU4DOW3AQ5WFWY7LDEFZIJAQBI5TQXRT3XAZSWDRLK3LG53HBQCP":1,
"GAR4HYWGY4YE7WOU2TGH7G4RL7ON72KQP24WWBT755WAWPCKRFS4SHWL":1,
"GA27ELKFRT7JVZTJW4P3I3ORWLLNKRIB3D6GELPN7IESPOCUNS5NHTOD":1,
"GCYFMZPDAR7ZTTTBA5DVG2SPR2N4CLPZLGLVI475BCGJ532WOKWRKUDG":1,
"GAMXMHJX6CW6LZWUYRKVF73GOMRFJDQI57UMA4LE5QUF4DCJRGI55QD6":1,
"GDVU64GNDFDR3OWKGPK37DAK67RPOK4OMZB4RH7NQN5UOYB4GPFVQUOD":1,
"GDB46BXMVI7FEZCHG4OTZ3OCSJX4CRBOOK6OJL5JD7BF5QIW3AS53IWA":1};
var TIERC=null;
function loadTier(){ if(TIERC)return Promise.resolve(TIERC);
  var n=0,excl=0,set={},failed=false;
  function page(cur,depth){
    return j("/lxapi/holders?asset=LUMOS-"+LUMOS_ISS+"&limit=200"+(cur?("&cursor="+encodeURIComponent(cur)):"")).then(function(d){
      if(!d){ failed=true; return; }
      var rs=(d._embedded&&d._embedded.records)||[]; if(!rs.length)return;
      var below=false;
      for(var i=0;i<rs.length;i++){ var bal=(+rs[i].balance||0)/1e7;
        if(bal<TIER){ below=true; break; }
        var ad=rs[i].address||rs[i].account; if(TREASURY[ad])excl++; else { n++; set[ad]=1; } }
      if(below)return;
      var nx=rs[rs.length-1].paging_token;
      if(nx&&depth<6)return page(nx,depth+1); }); }
  return page("",1).then(function(){ TIERC={n:(failed?null:n),excluded:excl,set:set}; return TIERC; })
   .catch(function(){ TIERC={n:null,excluded:0,set:{}}; return TIERC; }); }
// THE XRP LEDGER FEE TIER — a different token, on a different chain, with the same threshold.
// XRPL LUMOS is its own issuance (blackholed; see _tools/browser/feerate.js in the XRPL repo) and the
// 250K check is made against THAT balance. Until this existed every XRPL wallet was tested against the
// Stellar holder set, which can never contain an r-address, so the table printed "0.2%" from a check
// that had not been made — an assertion, not a reading.
//
// PAGED IN FULL, unlike the Stellar side. stellar.expert returns holders sorted by balance descending,
// which is why that loop may stop at the first wallet below the line; account_lines comes back in no
// particular order, so stopping early would silently drop qualifying holders. Measured 2026-10-15:
// 1727 trust lines over 5 pages, 77 wallets at or above the threshold.
var XLUMOS_ISS="rsPqeamjpr3Bxu4LhtCgvJEAQusYRRg6Ha",XLUMOS_CUR="4C554D4F53000000000000000000000000000000";
var XTIERC=null;
function loadXTier(){ if(XTIERC)return Promise.resolve(XTIERC);
  var n=0,set={},failed=false;
  function page(marker,depth){
    var p={account:XLUMOS_ISS,limit:400,ledger_index:"validated"}; if(marker)p.marker=marker;
    return xrpc("account_lines",p).then(function(d){ var r=d&&d.result;
      if(!r||r.error){ if(depth===1)failed=true; return; }
      var ls=r.lines||[];
      for(var i=0;i<ls.length;i++){ if(ls[i].currency!==XLUMOS_CUR)continue;
        // An issuer sees its own obligation, so the holder's balance is the NEGATED line balance.
        var bal=-(+ls[i].balance||0);
        if(bal>=TIER){ n++; set[ls[i].account]=1; } }
      if(r.marker&&depth<12)return page(r.marker,depth+1); }); }
  return page(null,1).then(function(){ XTIERC={n:(failed?null:n),set:set}; return XTIERC; })
   .catch(function(){ XTIERC={n:null,set:{}}; return XTIERC; }); }
var WIN=[["24H",864e5],["7D",6048e5],["30D",2592e6],["Lifetime",0]], WI=0;
function winSince(){ var ms=WIN[WI][1]; return ms?(Date.now()-ms):0; }
function kpiTile(id,label,foot,tip){
  return "<div class='kpi'><div class='kpi-head'><span class='kpi-label'>"+label+"</span></div>"
    +"<div class='kpi-value' id='"+id+"'"+(tip?(" title='"+tip+"'"):"")+">\u2014</div>"
    +"<div class='kpi-foot' id='"+id+"F'>"+foot+"</div></div>"; }
function per(){ return "<span class='lxd-per'>"+WIN[WI][0]+"</span>"; }
function buildDash(grid){
  grid.innerHTML = "<div class='lxd-sec'><span class='lxd-sec-t'>Current period</span><span class='lxd-per'>" + WIN[WI][0] + "</span></div>"
    + kpiTile("lxdRev","Revenue","fees collected")
    + kpiTile("lxdVol","Volume","swap volume")
    + kpiTile("lxdBrVol","Cross-chain volume","bridged via CCTP, LayerZero or NEAR Intents","What was sent through the Cross-Chain bridge, in dollars, split by route: CCTP counts the USDC gross (including our fee), LayerZero the USDT0 sent, NEAR Intents the deposit as NEAR Intents itself valued it. Kept out of Volume on purpose: that figure is swap volume, and adding bridged value to it would overstate how much is being traded.")
    + kpiTile("lxdTrades","Trades","fee-paying swaps")
    + kpiTile("lxdWal","Connected wallets","distinct wallets","Distinct wallets that connected a wallet to the site in this window. Recorded by our own beacon, because nothing on-chain marks a connection - only wallets that go on to pay a fee leave a trace, and those are a fraction of the people who open the app. Counted per UTC day.")
    + "<div class='lxd-sec'><span class='lxd-sec-t'>All time</span></div>"
    + kpiTile("lxdVolA","Volume","every swap since launch")
    + kpiTile("lxdBrVolA","Cross-chain","every bridge since launch")
    + kpiTile("lxdTradesA","Trades","every fee-paying swap")
    + kpiTile("lxdWalA","Wallets","connected since the beacon went live","Distinct wallets ever seen connecting. This starts from the day the beacon was installed - it cannot be backfilled, because the connections before it were never recorded anywhere.")
    // FIFTH TILE IN THE ALL-TIME ROW, not a section of its own. A heading over a single tile left it
    // stranded on a full-width row with nothing beside it, which was the most obviously lopsided thing
    // on the page (RAZA 2026-09-23). It is an all-time figure anyway -- holders now, not holders in the
    // selected window -- so this is where it belonged, and both rows are now five.
    + kpiTile("lxdTier","Holders \u2265 250K LUMOS","qualify for the 0.1% fee","Wallets holding at least 250,000 LUMOS, the threshold for the reduced 0.1% platform fee. Treasury and burn wallets are excluded.");
  grid.classList.add("lxd-grid");
}
// The window control sits in the page header beside Export/Refresh, where the design puts actions.
function wirePeriod(){ var host=q(".admin-page-actions"); if(!host||q("#lxdPeriod"))return;
  var sel=document.createElement("select"); sel.id="lxdPeriod"; sel.className="adm-btn ghost";
  sel.innerHTML=WIN.map(function(w,i){ return "<option value='"+i+"'>"+w[0]+"</option>"; }).join("");
  sel.addEventListener("change",function(){ WI=+sel.value||0;
    qa(".lxd-per").forEach(function(e){ e.textContent=WIN[WI][0]; }); fillDash(); });
  host.insertBefore(sel,host.firstChild); }
function fillDash(){
  var since=winSince();
  loadRevenue().then(function(rv){
    var inWin=rv.rows.filter(function(p){ return !since||Date.parse(p.created_at)>=since; });
    setT(q("#lxdTrades"), num(inWin.length));
    setT(q("#lxdTradesA"), num(rv.rows.length));
    var wAll={}; rv.rows.forEach(function(p){ wAll[p.from]=1; });
    // (fee-paying wallet count lives on the Users page; these two tiles are connections)
    var byA={}; inWin.forEach(function(p){ var a=assetOf(p), ch=p.chain||"stellar", k=ch+":"+a.code+"-"+a.iss;
      byA[k]=byA[k]||{chain:ch,code:a.code,iss:a.iss,amt:0}; byA[k].amt+=+p.amount||0; });
    // A REVENUE FIGURE WITH A CHAIN MISSING IS NOT REVENUE -- the Revenue page's rule, now here too. This
    // tile summed whatever arrived, so a NEAR read still catching up (or any chain refusing) would have
    // shown a smaller business with no hint. The dash names where to look.
    if(!allRead()){ setT(q("#lxdRev"),"—"); var rf=q("#lxdRevF"); if(rf)rf.textContent="a chain could not be read in full · see Revenue"; return; }
    var ks=Object.keys(byA);
    if(!ks.length){ setT(q("#lxdRev"),usd(0)); return; }
    var pend=ks.length,tot=0;
    ks.forEach(function(k){ var a=byA[k]; priceUsdOn(a.chain,a.code,a.iss,function(px){
      if(px!=null)tot+=a.amt*px; if(--pend===0)setT(q("#lxdRev"),usd(tot)); }); });
  });
  // NEAR VOLUME, FROM NEAR ITSELF (RAZA 2026-11-18: "the platform activity on NEAR shows a cross-chain swap worth ~$12, but
  // the admin only shows $1.01 of cross-chain volume, which is prolly from Stellar"). A NEAR fee receipt enters loadVolume
  // with its fee only -- no envelope, so no gross and no bridged value -- so every NEAR swap and bridge counted nothing.
  // nearV is every LumosCore transaction on NEAR (lumoscore.com/lxapi/nearactivity?all=1, decoded from the chain) priced
  // with NEAR's own roster. Added to these two tiles ONLY: the other readers of loadVolume price Stellar assets per wallet
  // and per asset, and NEAR rows there would be a second unit mixed into the first.
  Promise.all([loadVolume(),loadNearVol()]).then(function(z){ var v=z[0], nearV=z[1];
    var nSwapP=0,nSwapA=0,nUnp=0;
    if(nearV)nearV.rows.forEach(function(r){ if(r.kind!=="swap")return; if(r.usd==null){ if(!since||r.t>=since)nUnp++; return; }
      nSwapA+=r.usd; if(!since||r.t>=since)nSwapP+=r.usd; });
    var nearNote=nearV?(nearV.complete?"":" · NEAR still being read"):" · <b>NEAR could not be read</b>";
    if(v.missing<0){ var e=q("#lxdVolF"); if(e)e.textContent="could not read the transaction envelopes"; return; }
    volUsd(v.rows,since,function(t,un){ setT(q("#lxdVol"), usd(t+nSwapP)); un=(un||0)+nUnp;
      // Some fee receipts carry no swap in their envelope -- real revenue, but not volume. That is why
      // revenue/volume lands above the 0.2% fee rate, so the count is shown rather than left to puzzle
      // over: an unexplained ratio invites someone to trust the wrong number.
      // AND SAY WHEN THE FIGURE IS NOT ALL-TIME (RAZA 2026-10-21: "i sure the mentioned volume isnt
      // correct. I used it was close to $20K combined alltime... why is it suddenly showing so less").
      //
      // It was not wrong, it was TRUNCATED. Volume needs each receipt's envelope to find the swap leg,
      // and envelopes come from ONE page of 200 (loadEnvelopes). Measured against the ledger the same
      // day: 366 inbound fee receipts, 200 envelopes fetched, so 166 receipts returned null from
      // grossOf and contributed zero. "All time" was really "the most recent 200 receipts", and it
      // shrinks on its own as new receipts push older swaps out of the window.
      //
      // VOL_CAPPED already existed and was printed on the revenue BREAKDOWN subtitle only -- so the one
      // number a reader would quote was the one that never admitted its limit. Same fault as the
      // bridge table and the pool chart that day: a surface stating something it has not established.
      var f=q("#lxdVolF"); if(f)f.innerHTML="swap volume"+(nSwapP?(" \u00b7 NEAR "+usd(nSwapP)):"")+(un?(" \u00b7 "+un+" asset(s) unpriced"):"")+(missIn(v,since)>0?(" \u00b7 "+missIn(v,since)+" receipt(s) with no swap"):"")+(VOL_CAPPED?" \u00b7 <b>most recent 200 receipts only</b>":"")+nearNote; });
    // THE ALL-TIME TILE IS THE ONE THAT LIED. Its foot is static markup reading "every swap since
    // launch" and nothing ever rewrote it, so the capped figure carried an explicit claim to be
    // complete. Corrected here rather than in kpiTile, because it is only untrue while capped.
    volUsd(v.rows,0,function(t){ setT(q("#lxdVolA"), usd(t+nSwapA));
      var af=q("#lxdVolAF");
      if(af)af.innerHTML=VOL_CAPPED?"<b>most recent 200 receipts only</b> · not every swap":"every swap since launch"; });
    // Straight sum, no pricing step: CCTP moves USDC and nothing else.
    var brP=0,brA=0,brN=0,byR={};   // every bridged figure is already in dollars (see bridged); split by route
    v.rows.forEach(function(r){ var b=+r.bridged||0; if(!b)return;
      brA+=b; brN++; if(!since||r.t>=since){ brP+=b; byR[r.route||"CCTP"]=(byR[r.route||"CCTP"]||0)+b; } });
    // NEAR's bridges, labelled "(from NEAR)" so they never merge with Stellar's NEAR Intents route. A refunded transfer
    // (kind bridge_refunded / bridge_failed) moved nothing and is left out.
    var nBrUnp=0;
    if(nearV)nearV.rows.forEach(function(r){ if(r.kind!=="bridge")return; if(r.usd==null){ if(!since||r.t>=since)nBrUnp++; return; }
      var rk=r.route+" (from NEAR)"; brA+=r.usd; brN++; if(!since||r.t>=since){ brP+=r.usd; byR[rk]=(byR[rk]||0)+r.usd; } });
    setT(q("#lxdBrVol"), usd(brP)); setT(q("#lxdBrVolA"), usd(brA));
    var bf=q("#lxdBrVolF"); if(bf){ var parts=Object.keys(byR).sort(function(a,b){ return byR[b]-byR[a]; }).map(function(k){ return k+" "+usd(byR[k]); });
      bf.innerHTML=(parts.length?parts.join(" · "):"bridged via CCTP, LayerZero, NEAR Intents, Wormhole or Omni")+(nBrUnp?(" · "+nBrUnp+" unpriced"):"")+nearNote; }
    var bfa=q("#lxdBrVolAF"); if(bfa)bfa.textContent=brN?("every bridge since launch \u00b7 "+brN+" transfer"+(brN===1?"":"s")):"no bridges recorded yet";
  });
  loadTier().then(function(t){ if(t.n==null){ setT(q("#lxdTier"),"\u2014");
    var e=q("#lxdTierF"); if(e)e.textContent="could not read the holder list"; return; }
    setT(q("#lxdTier"), num(t.n));
    var f=q("#lxdTierF"); if(f)f.textContent="qualify for the 0.1% fee"+(t.excluded?(" \u00b7 "+t.excluded+" treasury excluded"):""); });
  // Connected wallets. All four windows arrive in one response, so switching the period never
  // re-fetches. null means the store could not answer -- rendered as a dash with the reason, never as
  // zero, because "no connections" and "we could not look" are different claims.
  loadWallets().then(function(w){
    var k=["d1","d7","d30","all"][WI];
    setT(q("#lxdWal"), w[k]==null?"\u2014":num(w[k]));
    setT(q("#lxdWalA"), w.all==null?"\u2014":num(w.all));
    var f=q("#lxdWalF");
    if(f)f.innerHTML=(w[k]==null)?"beacon not reporting":("distinct wallets");
    var g=q("#lxdWalAF");
    if(g)g.textContent=w.since?("connected since "+w.since):"connected since the beacon went live";
  });
}
// Cached for the page's lifetime: the four windows come back together, so the period selector reads
// from this instead of going to the network again.
var WAL=null;
function loadWallets(){ if(WAL)return Promise.resolve(WAL);
  return j("/lxapi/walletstats").then(function(d){
    WAL=d||{d1:null,d7:null,d30:null,all:null}; return WAL; })
   .catch(function(){ WAL={d1:null,d7:null,d30:null,all:null}; return WAL; }); }

// Where the revenue came from. The on-chain half is classified by transaction SHAPE (see grossOf), not
// by amount. The off-chain half cannot be read from anywhere, so it is entered by hand -- and shown as
// such, because a category that only ever reads zero should say whether that means "none" or "nobody
// has recorded any".
var MANUAL=null;
function loadManual(){ if(MANUAL)return Promise.resolve(MANUAL);
  return fetch("/lxapi/revenue").then(function(r){ return r.ok?r.json():null; })
    .then(function(d){ MANUAL=(d&&d.entries)||[]; return MANUAL; })
    .catch(function(){ MANUAL=[]; return MANUAL; }); }

var SRC_LABEL={trade:"Trading fees",mint:"Token minting",bridge:"Cross-chain fees",other:"Other on-chain",
  ads:"Advertising",listing:"Token listings",sponsorship:"Sponsorships",other_manual:"Other"};
var SRC_HOW={trade:"platform fee on each swap, read from the chain",
  mint:"launchpad issuance fee, read from the chain",
  // NOT "CCTP" ANY MORE, AND IT HAD NOT BEEN FOR A WHILE. The registry this row is built from carries
  // LayerZero and NEAR Intents as well (measured 2026-10-29: 46 CCTP, 25 LayerZero, 21 NEAR Intents),
  // and the XRPL half now adds Axelar and THORChain. Naming one route made the other four read as
  // though they were not counted.
  bridge:"bridge fee on any route, matched to the transfer on the chain",
  other:"payments to the fee collector with no swap, mint or bridge behind them",
  ads:"entered by hand",listing:"entered by hand",sponsorship:"entered by hand",other_manual:"entered by hand"};

function paintSources(){
  var tbl=q("#lxSrcTable"); if(!tbl)return;
  var tb=tbl.querySelector("tbody"); if(!tb)return;
  var rows={};
  function add(k,usd){ rows[k]=(rows[k]||0)+usd; }

  Promise.all([loadVolume(),loadManual()]).then(function(z){
    var v=z[0], man=z[1];
    if(v.missing<0){ tb.innerHTML="<tr><td colspan='4' class='lxadm-empty'>Could not read the transaction envelopes, so the on-chain split is unavailable.</td></tr>"; return; }

    // group the on-chain receipts by kind, then by fee asset, so each asset is priced once
    // THE CHAIN IS PART OF THE KEY. Without it the lookup below used the Stellar-only priceUsd for
    // everything, so XRP was sent to stellar.expert, which has never heard of it, and every XRPL fee
    // was silently counted "unpriced" and left out of this card's total and shares.
    // "|" BETWEEN ALL THREE PARTS, not "-" before the issuer: a NEAR token's issuer is a contract id and
    // those carry hyphens (nearly-993927.nearlytrade.near, sol-0x....omdep.near), so splitting on the
    // last "-" priced the wrong string. No code, issuer or account id on any of the three chains has a "|".
    var byKind={};
    v.rows.forEach(function(r){ var k=r.kind||"other";
      byKind[k]=byKind[k]||{}; var a=(r.chain||"stellar")+"|"+r.feeCode+"|"+r.feeIss;
      byKind[k][a]=(byKind[k][a]||0)+r.fee; });

    var pend=0, unpriced=0, noread=0, noreadKind={};
    Object.keys(byKind).forEach(function(k){ Object.keys(byKind[k]).forEach(function(){ pend++; }); });
    man.forEach(function(e){ add(e.source==="other"?"other_manual":e.source, parseFloat(e.amountUsd)||0); });
    if(!pend){ draw(); return; }

    // DRAW ONCE, AND NEVER NOT AT ALL (RAZA 2026-10-19: this card sat on "Loading…"). The table only
    // leaves that placeholder when draw() runs, and draw() only runs when every price callback has
    // come back -- so a single lookup that never calls back leaves the card loading for ever, with no
    // error and nothing to read. A deadline turns that into a result: whatever has priced is shown,
    // and the ones that did not are reported in the subtitle.
    //
    // A LOOKUP THAT RAN OUT OF TIME IS AN UNREAD PRICE, NOT AN UNPRICED ASSET -- it used to be added
    // to the unpriced count, which told the reader the asset has no published price when all we know is that
    // we stopped waiting for it.
    var drawn=false;
    function drawOnce(){ if(drawn)return; drawn=true; clearTimeout(tmr); draw(); }
    var tmr=setTimeout(function(){ noread+=pend; pend=0; drawOnce(); },20000);

    Object.keys(byKind).forEach(function(k){
      Object.keys(byKind[k]).forEach(function(a){
        var pp=a.split("|"), chain=pp[0], code=pp[1], iss=pp[2]||"";
        priceUsdOn(chain,code,iss,function(px,unread){
          if(drawn)return;
          if(px!=null)add(k,byKind[k][a]*px); else if(unread){ noread++; noreadKind[k]=1; } else unpriced++;
          if(--pend===0)drawOnce();
        });
      });
    });

    function draw(){
      var order=["trade","mint","bridge","other","ads","listing","sponsorship","other_manual"];
      var total=0; order.forEach(function(k){ total+=rows[k]||0; });
      var any=order.some(function(k){ return rows[k]; });
      if(!any&&!man.length){ tb.innerHTML="<tr><td colspan='4' class='lxadm-empty'>No revenue recorded yet.</td></tr>"; }
      else {
        tb.innerHTML=order.map(function(k){
          var val=rows[k]||0;
          var manual=(k==="ads"||k==="listing"||k==="sponsorship"||k==="other_manual");
          // A zero from the chain means zero. A zero from a hand-entered category means nobody has
          // recorded one, which is a different statement and should not read as revenue of nil.
          if(!val&&manual)return "";
          // A ZERO WE CANNOT STAND BEHIND IS NOT A ZERO. This row has receipts in it; what it does not
          // have is a price for them, so "$0 / 0.0%" states the one thing we know to be false. The
          // subtitle already counts the unread prices -- this stops the row itself contradicting it.
          var dead=!val&&noreadKind[k];
          var share=dead?"\u2014":(total>0?((val/total*100).toFixed(1)+"%"):"\u2014");
          var amt=dead
            ? "<span style='font-style:italic;color:var(--text-muted)' title='There are fees in this row, but their price could not be read, so they are not in the total. Reload to try again.'>couldn\u2019t read</span>"
            : esc(usd(val));
          return "<tr><td><b>"+esc(SRC_LABEL[k])+"</b></td>"
            +"<td style='color:var(--text-muted);font-size:13px'>"+esc(SRC_HOW[k])+"</td>"
            +"<td class='num-cell' style='text-align:right'>"+amt+"</td>"
            +"<td style='text-align:right'>"+share+"</td></tr>";
        }).join("");
      }
      var sub=q("#lxSrcSub");
      if(sub){
        var noManual=!man.length;
        sub.textContent=usd(total)+" total"
          +(unpriced?(" \u00b7 "+unpriced+" asset(s) unpriced"):"")
          +(noread?(" \u00b7 "+noread+" price"+(noread>1?"s":"")+" could not be read"):"")
          // A split over the most recent 200 receipts is not a split of the business, and saying so is
          // cheaper than letting the percentages be quoted as if it were.
          +(VOL_CAPPED?" \u00b7 most recent 200 receipts only":"")
          +(noManual?" \u00b7 nothing entered for advertising or listings yet":"");
      }
    }
  });
}

// Adding an off-chain entry. Deliberately a short form: source, amount, date, note. Anything more
// elaborate is an accounting package, and this only exists so the revenue page is not silently missing
// the money that never touches the chain.
function addManual(){
  if(q(".lxmodal"))return;
  var m=document.createElement("div"); m.className="lxmodal";
  var today=new Date().toISOString().slice(0,10);
  m.innerHTML="<div class='lxmodal-box'><h3 class='lxmodal-t'>Add off-chain revenue</h3>"
    +"<p class='lxmodal-s'>Advertising, paid listings and sponsorships are invoiced off-chain and leave no trace we can read, so they have to be recorded here or they never appear.</p>"
    +"<label class='lxmodal-l' for='lxrvSrc'>Source</label>"
    +"<select class='lxmodal-i' id='lxrvSrc'><option value='ads'>Advertising</option>"
    +"<option value='listing'>Token listing</option><option value='sponsorship'>Sponsorship</option>"
    +"<option value='other'>Other</option></select>"
    +"<label class='lxmodal-l' for='lxrvAmt'>Amount (USD)</label><input class='lxmodal-i' id='lxrvAmt' type='number' step='0.01' placeholder='500.00'>"
    +"<label class='lxmodal-l' for='lxrvWhen'>Date received</label><input class='lxmodal-i' id='lxrvWhen' type='date' value='"+today+"'>"
    +"<label class='lxmodal-l' for='lxrvNote'>Note</label><input class='lxmodal-i' id='lxrvNote' placeholder='Who paid, and what for'>"
    +"<p class='lxmodal-e' id='lxrvErr'></p>"
    +"<div class='lxmodal-a'><button class='adm-btn ghost' type='button' id='lxrvCancel'>Cancel</button>"
    +"<button class='adm-btn primary' type='button' id='lxrvOk'>Record</button></div></div>";
  document.body.appendChild(m);
  function close(){ m.remove(); }
  m.addEventListener("click",function(e){ if(e.target===m)close(); });
  m.querySelector("#lxrvCancel").addEventListener("click",close);
  var er=m.querySelector("#lxrvErr");
  m.querySelector("#lxrvOk").addEventListener("click",function(){
    var amt=parseFloat(m.querySelector("#lxrvAmt").value);
    if(!isFinite(amt)||amt===0){ er.textContent="Enter an amount."; return; }
    var d=m.querySelector("#lxrvWhen").value;
    var when=d?Date.parse(d+"T12:00:00Z"):Date.now();
    var ok=m.querySelector("#lxrvOk"); ok.disabled=true; ok.textContent="Saving\u2026";
    fetch("/lxapi/revenue",{method:"PUT",headers:{"content-type":"application/json"},
      body:JSON.stringify({source:m.querySelector("#lxrvSrc").value,amountUsd:amt,when:when,
        note:m.querySelector("#lxrvNote").value})})
      .then(function(r){ return r.json().then(function(b){ return {ok:r.ok,b:b}; }); })
      .then(function(z){ ok.disabled=false; ok.textContent="Record";
        if(!z.ok){ er.textContent=(z.b&&z.b.error)||"Could not save."; return; }
        MANUAL=null; close(); paintSources(); })
      .catch(function(e){ ok.disabled=false; ok.textContent="Record"; er.textContent=e.message; });
  });
}

function paintDashboard(){ if(!isDash())return; var grid=q(".kpi-grid"); if(!grid)return;
  if(grid.getAttribute("data-lxbuilt")!=="1"){ grid.setAttribute("data-lxbuilt","1"); buildDash(grid); wirePeriod(); }
  fillDash();
}
`
// ---- Support / Blogs: honest empty states, no invented records ----
// ---- stale chrome inherited from the design ------------------------------------------------------
// Two things the admin pages carry from the Aptos template they were built out of, both of which say
// something untrue:
//   1. The network chip reads "Aptos". These pages are extracted from the lumoscore-aptos-* container,
//      so the switcher defaults to that chain. LumosCore has been Stellar-only since the mainnet
//      migration -- and every figure on these pages is read from Stellar.
//   2. The dashboard subtitle promises "refreshed every 30s". Nothing polls; the figures are read once
//      per page load. Either build a poller or stop claiming one, and a claim nobody checks is the
//      worse of the two.
// Re-asserted through an observer because the chip is drawn by the design's own script, which can
// redraw it after we run -- the same defence the wallet and rewards layers use.
+'function paintChrome(){'
+'  function fixChip(){ qa(".lxns-trigger").forEach(function(t){'
+'    var el=t.querySelector(".lxns-tname")||t;'
+'    if(/Aptos/i.test(el.textContent||""))setT(el,"Stellar"); }); }'
+'  fixChip();'
+'  try{ var mo=new MutationObserver(fixChip);'
+'    mo.observe(document.body,{childList:true,subtree:true,characterData:true}); }catch(e){}'
+'  var sub=q(".admin-page-sub");'
+'  if(sub&&/refreshed every/i.test(sub.textContent||""))'
+'    setT(sub,"Read from Stellar, XRPL and NEAR on load \\u2014 press Refresh for current figures.");'
+'}'
+'function paintNoBackend(){'
+'  var t=pageTitle();'
+'  var isSup=false, isBlog=false;'
+'  if(!isSup&&!isBlog)return;'
+'  qa(".kpi .kpi-value").forEach(function(v){ setT(v,"\\u2014"); v.title="No backend connected \\u2014 there is nowhere for this data to come from yet."; });'
+'  qa(".kpi .kpi-foot").forEach(function(f){ setT(f,"awaiting backend"); });'
+'  var msg=isSup'
+'    ? "Support tickets need somewhere to live. LumosCore is a static site today, so there is no store to read tickets from and nothing is being collected. The screen below is the finished UI, waiting on a backend."'
+'    : "Blog posts need somewhere to live. LumosCore is a static site today, so there is no store to read or publish posts from. The screen below is the finished UI, waiting on a backend.";'
+'  qa(".mob-kpi .mob-kpi-value").forEach(function(v){ setT(v,"\u2014"); });'
+'  qa(".mob-kpi .mob-kpi-foot").forEach(function(f){ f.innerHTML=""; f.textContent="awaiting backend"; });'
+'  var head=pageHead();'
+'  if(head&&!q(".lxadm-note")){ var d=document.createElement("div"); d.className="lxadm-note"; d.textContent=msg; head.parentNode.insertBefore(d, head.nextSibling); }'
+'  fixPager(0);'
+'  if(isMob()){'
+'    var msub=q(".mob-page-sub"); if(msub)msub.textContent="Awaiting a backend";'
+'    var mseg=q(".mob-seg-row"); if(mseg)mseg.remove();'
+'    var mc=qa(".mob-user-card");'
+'    if(mc.length){ var hst=mc[0].parentNode, ref=mc[0].nextSibling;'
+'      mc.forEach(function(c){ c.remove(); });'
+'      var em=document.createElement("div"); em.className="lxadm-empty";'
+'      em.textContent="Nothing to show — no backend connected.";'
+'      hst.insertBefore(em, ref); } }'
+'  qa(".adm-card tbody, .adm-table tbody").forEach(function(tb){'
+'    var cols=(tb.parentNode.querySelectorAll("thead th")||[]).length||4;'
+'    if(!tb.querySelector(".lxadm-empty")) tb.innerHTML="<tr><td colspan=\\""+cols+"\\" class=\\"lxadm-empty\\">Nothing to show \\u2014 no backend connected.</td></tr>"; });'
+'}'
+'function retitle(head,txt,sub){ if(!head)return; var t=head.querySelector(".adm-card-title")||head;'
+'  for(var i=t.childNodes.length-1;i>=0;i--){ var n=t.childNodes[i]; if(n.nodeType===3&&n.textContent.trim()){ n.textContent=" "+txt; break; } }'
+'  if(sub&&!head.querySelector(".lxadm-sub")){ var e2=document.createElement("span"); e2.className="lxadm-sub"; e2.textContent=sub; head.appendChild(e2); } }'
+'function ago(iso){ var d=(Date.now()-Date.parse(iso))/1000; if(!isFinite(d))return "";'
+'  if(d<60)return Math.max(1,Math.round(d))+"s ago"; if(d<3600)return Math.round(d/60)+"m ago";'
+'  if(d<86400)return Math.round(d/3600)+"h ago"; return Math.round(d/86400)+"d ago"; }'
// Fee receipts are denominated in whatever asset the user swapped, so a monthly total is only
// meaningful once each is converted. Prices are today's spot -- said so on the card, not implied.
+'function paintDashPanels(){ if(!isDash())return;'
+'  var chartCard=q(".adm-card.chart-card");'
+'  if(chartCard&&chartCard.getAttribute("data-lxbuilt")!=="1"){ chartCard.setAttribute("data-lxbuilt","1");'
+'    chartCard.innerHTML="<div class=\\"adm-card-head\\"><div class=\\"adm-card-title\\">Revenue by month</div>"'
+'      +"<span class=\\"lxadm-sub\\">platform fees, converted at today\u2019s prices</span></div>"'
+'      +"<div class=\\"adm-card-body\\"><div id=\\"lxDashBars\\" class=\\"lxbars-empty\\">Loading\u2026</div></div>"; }'
+'  var netBars=q(".net-bars"); if(netBars)retitle(netBars.previousElementSibling,"Revenue by asset");'
+'  var strip=q(".top-strip"); if(strip)retitle(strip.previousElementSibling,"Largest curated pools (Stellar)");'
+'  var feed=q("#actFeed"); if(feed){ feed.id="lxActFeed"; feed.innerHTML="<div class=\\"lxadm-empty\\">Loading\u2026</div>"; }'
// nothing on a static site watches for anomalies, so the alert list is emptied rather than invented
+'  var alertRows=qa(".alert-row"); /* D05: the card is removed, not emptied */ if(alertRows.length){ var acard=alertRows[0].closest(".adm-card"), agrid=acard&&acard.parentNode; if(acard){ acard.remove(); if(agrid&&agrid.classList&&agrid.classList.contains("dash-grid"))agrid.style.gridTemplateColumns="1fr"; } alertRows=[]; }'
+'  if(alertRows.length){ var wrap=alertRows[0].parentNode;'
+'    wrap.innerHTML="<div class=\\"lxadm-empty\\">No monitoring connected. Alerts need a service watching the chain and a place to store what it finds \u2014 nothing is being generated here.</div>";'
+'    var pill=wrap.previousElementSibling&&wrap.previousElementSibling.querySelector(".pill"); if(pill)pill.remove(); }'
+'  loadRevenue().then(function(rv){'
// ---- month bars ----
+'    var now=new Date(), buckets=[], idx={};'
+'    for(var i=5;i>=0;i--){ var d=new Date(now.getFullYear(),now.getMonth()-i,1);'
+'      var k=d.getFullYear()+"-"+d.getMonth();'
+'      idx[k]=buckets.length; buckets.push({label:d.toLocaleString(undefined,{month:"short"}),usd:0}); }'
+'    var byA={}; rv.rows.forEach(function(p){ var a=assetOf(p), ch=p.chain||"stellar", k=ch+":"+a.code+"-"+a.iss;'
+'      byA[k]=byA[k]||{chain:ch,code:a.code,iss:a.iss,amt:0,rows:[]}; byA[k].amt+=+p.amount||0; byA[k].rows.push(p); });'
+'    var ks=Object.keys(byA), pend=ks.length, total=0;'
+'    function drawBars(){'
+'      var box=q("#lxDashBars"); if(!box)return;'
+'      var max=0; buckets.forEach(function(b){ if(b.usd>max)max=b.usd; });'
+'      if(!max){ box.className="lxbars-empty"; box.textContent="No fees collected in the last six months."; return; }'
+'      box.className="lxbars";'
+'      box.innerHTML=buckets.map(function(b){ var pct=b.usd>0?Math.max(3,Math.round(b.usd/max*100)):0;'
+'        return "<div class=\\"lxbar\\"><div class=\\"lxbar-track\\"><div class=\\"lxbar-fill\\" style=\\"height:"+pct+"%\\"></div></div>"'
+'          +"<div class=\\"lxbar-val\\">"+usd(b.usd)+"</div><div class=\\"lxbar-lab\\">"+esc(b.label)+"</div></div>"; }).join(""); }'
+'    function drawSplit(){'
+'      if(!netBars)return;'
+'      var list=ks.map(function(k){return byA[k];}).filter(function(a){return a.usd>0;}).sort(function(x,y){return y.usd-x.usd;});'
+'      if(!list.length||!total){ netBars.innerHTML="<div class=\\"lxadm-empty\\">No priced fee revenue yet.</div>"; return; }'
+'      var C=["linear-gradient(90deg,#8b7bff,#2563eb)","linear-gradient(90deg,#35c07f,#15803d)","linear-gradient(90deg,#ea6a2c,#c2410c)","linear-gradient(90deg,#f59e0b,#b45309)","linear-gradient(90deg,#ec4899,#9d174d)"];'
+'      netBars.innerHTML=list.slice(0,5).map(function(a,i){ var pc=a.usd/total*100;'
+'        return "<div class=\\"net-bar\\"><div class=\\"net-bar-head\\"><span class=\\"net-bar-name\\">"+esc(a.code)+"<span style=\\"opacity:.55;font-size:11px;margin-left:5px\\">"+chainTag(a.chain)+"</span></span>"'
+'          +"<span class=\\"net-bar-val\\">"+usd(a.usd)+" \u00b7 "+pc.toFixed(1)+"%</span></div>"'
+'          +"<div class=\\"net-bar-track\\"><div class=\\"net-bar-fill\\" style=\\"width:"+pc.toFixed(1)+"%;background:"+C[i%C.length]+"\\"></div></div></div>"; }).join(""); }'
+'    if(!pend){ drawBars(); drawSplit(); } else {'
+'      ks.forEach(function(k){ var a=byA[k]; priceUsdOn(a.chain,a.code,a.iss,function(px){'
+'        if(px!=null){ a.usd=a.amt*px; total+=a.usd;'
+'          a.rows.forEach(function(p){ var d=new Date(Date.parse(p.created_at));'
+'            var bk=idx[d.getFullYear()+"-"+d.getMonth()]; if(bk!=null)buckets[bk].usd+=(+p.amount||0)*px; }); }'
+'        if(--pend===0){ drawBars(); drawSplit(); } }); }); }'
// ---- recent activity: the last six real fee receipts ----
+'    var fd=q("#lxActFeed"); if(fd){'
+'      if(!rv.rows.length){ fd.innerHTML="<div class=\\"lxadm-empty\\">No fee payments yet.</div>"; }'
+'      else fd.innerHTML=rv.rows.slice(0,6).map(function(p){ var a=assetOf(p);'
+'        return "<div class=\\"act-row\\"><span class=\\"act-ico green\\"></span><div class=\\"act-text\\">"'
+'          +"<div class=\\"act-title\\"><span class=\\"mono\\">"+esc(shortA(p.chain,p.from))+"</span> paid <span class=\\"mono\\">"+esc(num(+p.amount))+" "+esc(a.code)+"</span> in platform fees</div>"'
+'          +"<div class=\\"act-meta\\"><span>"+chainName(p.chain)+" mainnet</span><a class=\\"lxadm-link mono\\" target=\\"_blank\\" rel=\\"noopener\\" href=\\""+esc(exTx(p.chain,p.transaction_hash))+"\\">tx: "+esc(String(p.transaction_hash).slice(0,4))+"\u2026"+esc(String(p.transaction_hash).slice(-4))+"</a></div>"'
+'          +"</div><span class=\\"act-time\\">"+esc(ago(p.created_at))+"</span></div>"; }).join(""); }'
+'  });'
// ---- largest pools strip ----
+'  if(strip){ loadPools().then(function(ps){ priceUsd("XLM","",function(px){'
+'    if(!ps.length){ strip.innerHTML="<div class=\\"lxadm-empty\\">No curated pools found.</div>"; return; }'
+'    strip.innerHTML=ps.map(function(p){'
+'      return "<a class=\\"top-strip-card\\" href=\\"https://lumoscore.com/pools/stellar/id/"+esc(p.id)+"\\" style=\\"text-decoration:none;color:inherit\\">"'
+'        +"<span class=\\"top-mini-ico\\" data-lxc=\\""+esc(p.code)+"\\" style=\\"background:transparent "+cssUrl(LG[p.code+"-"+p.iss]||avatar(p.code))+" center/cover no-repeat\\"></span>"'
+'        +"<div class=\\"top-mini-meta\\"><div class=\\"top-mini-name\\">"+esc(p.code)+" / XLM</div>"'
+'        +"<div class=\\"top-mini-sub\\">Stellar mainnet</div></div>"'
+'        +"<div class=\\"top-mini-val\\">"+(px?usd(p.xlm*px):num(p.xlm)+" XLM")+"</div></a>"; }).join("");'
+'    strip.querySelectorAll("a.top-strip-card").forEach(function(a){ a.target="_blank"; a.rel="noopener"; });'
+'    ps.forEach(function(p){ priceUsd(p.code,p.iss,function(){ var u=LG[p.code+"-"+p.iss]; if(!u)return;'
+'      var el=strip.querySelector("[data-lxc=\\""+p.code+"\\"]"); if(el)el.style.background="transparent "+cssUrl(u)+" center/cover no-repeat"; }); });'
+'  }); }); }'
+'}'
+'function cardByTitle(txt){ var hit=null;'
+'  qa(".adm-card, .mob-card").forEach(function(c){ if(hit)return;'
+'    var t=c.querySelector(".adm-card-title")||c.querySelector(".mob-card-title");'
+'    if(t&&t.textContent.replace(/\\s+/g," ").toLowerCase().indexOf(String(txt).toLowerCase())>=0)hit=c; }); return hit; }'
+'function cardBody(c,html){ if(!c)return null; var b=c.querySelector(".adm-card-body")||c.querySelector(".mob-card-body");'
+'  if(!b){ b=document.createElement("div"); b.className="adm-card-body"; c.appendChild(b); }'
+'  b.removeAttribute("style"); b.innerHTML=html; return b; }'
+'function paintDashRow3(){ if(!isDash())return;'
// 1. the listing donut had no registry behind it; the wallets that paid fees are countable
+'  var c1=cardByTitle("Listed-On Distribution");'
+'  if(c1&&c1.getAttribute("data-lxbuilt")!=="1"){ c1.setAttribute("data-lxbuilt","1");'
+'    retitle(c1.querySelector(".adm-card-head"),"Fee-paying wallets");'
+'    var b1=cardBody(c1,"<div class=\\"lxadm-empty\\">Loading\u2026</div>");'
+'    loadRevenue().then(function(rv){ var w={};'
// The link and the shortening follow the wallet's chain: every row here used to open stellar.expert,
// which knows nothing of an r-address or a .near account.
+'      rv.rows.forEach(function(p){ var a=assetOf(p); w[p.from]=w[p.from]||{n:0,last:p.created_at,codes:{},chain:(p.chain||"stellar")};'
+'        w[p.from].n++; w[p.from].codes[a.code]=1; });'
+'      var list=Object.keys(w).map(function(k){ return {addr:k,n:w[k].n,chain:w[k].chain,codes:Object.keys(w[k].codes)}; })'
+'        .sort(function(x,y){ return y.n-x.n; });'
+'      if(!list.length){ b1.innerHTML="<div class=\\"lxadm-empty\\">No wallet has paid a fee yet.</div>"; return; }'
+'      b1.removeAttribute("style"); b1.style.padding="0";'
+'      b1.innerHTML=list.slice(0,6).map(function(u){'
+'        return "<a class=\\"lxwal-row\\" target=\\"_blank\\" rel=\\"noopener\\" href=\\""+esc(exAcct(u.chain,u.addr))+"\\">"'
+'          +"<img class=\\"lxwal-av\\" data-lxc=\\"wallet\\" alt=\\"\\" src=\\""+avatarPart(u.addr.slice(1,3))+"\\">"'
+'          +"<div class=\\"lxwal-meta\\"><div class=\\"lxwal-addr\\">"+esc(shortA(u.chain,u.addr))+"</div>"'
+'          +"<div class=\\"lxwal-sub\\">paid in "+esc(u.codes.join(", "))+"</div></div>"'
+'          +"<div class=\\"lxwal-val\\">"+u.n+" fees</div></a>"; }).join(""); }); }'
// 2. LUMOS incentive emissions are not on-chain to read; API health is, and matters more to an operator
+'  var c2=cardByTitle("LUMOS Incentives");'
+'  if(c2&&c2.getAttribute("data-lxbuilt")!=="1"){ c2.setAttribute("data-lxbuilt","1");'
+'    retitle(c2.querySelector(".adm-card-head"),"System status");'
// A card called "System status" that only knew about Stellar. Since the XRPL launch half the platform
// could be down and this would have sat there green.
//
// An entry is a url for a plain GET, or a FUNCTION when the check is not one: the ledger wants a POST,
// which j() cannot do. A function resolves truthy for healthy and null for not, same contract as j().
//
// THE XRPL MARKET CHECK GOES THROUGH OUR OWN ENDPOINT, and through the cheap one. xrpl.to allows 333
// upstream requests a day and /lxapi/xrplprices spends three of them on a miss (it pages the top 300);
// /lxapi/xrpltoken spends one, caches for 60s, and answers the same question -- does our XRPL data
// path work. A status panel that eats the budget it is meant to be watching would be its own outage.
// THE PUBLIC SITE'S PATH, NOT THE ADMIN'S (RAZA 2026-11-18: "xrpl.to market data -- unreachable" for days, while
// lumoscore.com/lxapi/xrpltoken answered at once). lumoscore-admin is a separate Pages project with its own secrets and
// its own colo quota, so its copy of the endpoint can be starved while visitors are fine -- the same split that broke
// the admin's XRPL prices on 2026-10-29, fixed then by reading lumoscore.com first. The light means "is the XRPL data
// path our visitors use working", so it asks that one (it sends access-control-allow-origin: *), and the admin's own
// copy only if the public site cannot be reached at all.
+'    function xrplToOk(d){ return (d&&d.ok)?d:null; }'
+'    var SVC=[["Horizon (Stellar RPC)",H+"/assets?limit=1"],'
+'      ["stellar.expert index","https://api.stellar.expert/explorer/public/asset?search=XLM&limit=1"],'
+'      ["CoinGecko prices","https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd"],'
+'      ["XRP Ledger (xrplcluster)",function(){ return xrpc("server_info",{}).then(function(d){ return (d&&d.result&&d.result.info)?d:null; }); }],'
+'      ["xrpl.to market data",function(){ return j("https://lumoscore.com/lxapi/xrpltoken?id=XRP").then(function(d){ return d?xrplToOk(d):j("/lxapi/xrpltoken?id=XRP").then(xrplToOk); }); }]];'
+'    var b2=cardBody(c2,SVC.map(function(x,i){ return "<div class=\\"lxstat-row\\" id=\\"lxsvc"+i+"\\"><span class=\\"lxstat-dot\\"></span><span class=\\"lxstat-name\\">"+esc(x[0])+"</span><span class=\\"lxstat-val\\">checking\u2026</span></div>"; }).join(""));'
+'    b2.style.padding="0";'
+'    SVC.forEach(function(x,i){ var t0=Date.now();'
// A probe that THROWS must read as unreachable, not leave the row stuck on "checking…" for ever --
// which is what a bare .then() does, and it is the one state a status panel must never show.
+'      var p; try{ p=(typeof x[1]==="function")?x[1]():j(x[1]); }catch(e){ p=Promise.resolve(null); }'
+'      p.catch(function(){ return null; }).then(function(d){ var row=q("#lxsvc"+i); if(!row)return; var ms=Date.now()-t0;'
+'        row.querySelector(".lxstat-dot").className="lxstat-dot "+(d?"ok":"bad");'
+'        row.querySelector(".lxstat-val").textContent=d?(ms+"ms"):"unreachable"; }); }); }'
// 3. Retention needed sessions and there are none, so that card sat admitting it had nothing to show.
//    The audit trail goes here instead: with two people working in the panel, "who changed this and
//    when" is a question that now gets asked, and this is the first place anyone looks.
+'  var c3=cardByTitle("New & Retention")||cardByTitle("Retention")||cardByTitle("Admin activity");'
+'  if(c3&&c3.getAttribute("data-lxbuilt")!=="1"){ c3.setAttribute("data-lxbuilt","1");'
+'    retitle(c3.querySelector(".adm-card-head"),"Admin activity");'
+'    var b3=cardBody(c3,"<div class=\\"lxadm-empty\\">Loading\u2026</div>");'
+'    j("/lxapi/adminaudit?limit=8").then(function(d){'
+'      var es=(d&&d.entries)||[];'
+'      if(!es.length){ b3.innerHTML="<div class=\\"lxadm-empty\\">Nothing recorded yet. Every change made here \u2014 a listing approved, an asset curated, a refund sent, a post published \u2014 is logged with who made it and when.</div>"; return; }'
+'      b3.removeAttribute("style"); b3.style.padding="0";'
+'      b3.innerHTML=es.map(function(e){'
+'        return "<div class=\\"lxaud-row\\">"'
+'          +"<span class=\\"lxaud-dot "+esc(auditTone(e.action))+"\\"></span>"'
+'          +"<div class=\\"lxaud-meta\\"><div class=\\"lxaud-act\\">"+esc(auditLabel(e.action))'
+'            +(e.target?(" <span class=\\"lxaud-tgt\\">"+esc(auditTarget(e.target))+"</span>"):"")+"</div>"'
+'          +"<div class=\\"lxaud-who\\">"+esc(e.actor)+"</div></div>"'
+'          +"<div class=\\"lxaud-when\\">"+esc(ago(new Date(e.at).toISOString()))+"</div></div>"; }).join(""); }); }'
+'}'
// Reads as a sentence rather than a dotted key. Anything unmapped falls through to the raw action, so
// a new one added later shows up unlabelled instead of not showing up at all.
+'var AUD_LABEL={"listing.approve":"approved a listing","listing.decline":"declined a listing",'
+'"listing.refund":"refunded a listing fee","listing.reopen":"reopened a request",'
+'"asset.curate":"curated","asset.uncurate":"removed from curated","asset.edit":"edited",'
+'"asset.tick.override":"granted a tick","asset.untick":"removed a tick",'
+'"asset.meta.clear":"cleared overrides for","asset.list.replace":"reordered the curated list",'
+'"blog.publish":"published","blog.save":"saved a draft of","blog.delete":"deleted the post",'
+'"media.upload":"uploaded an image","revenue.add":"added a revenue entry",'
+'"support.reply":"replied to a support message"};'
+'function auditLabel(a){ return AUD_LABEL[a]||a; }'
// Money and removals are the entries worth spotting from across the room.
+'function auditTone(a){ if(a==="listing.refund"||a==="revenue.add")return "money";'
+'  if(a.indexOf("delete")>=0||a.indexOf("uncurate")>=0||a.indexOf("untick")>=0||a==="listing.decline")return "warn";'
+'  return "ok"; }'
// A 56-character issuer would swamp the row; the asset code is what identifies it at a glance.
+'function auditTarget(t){ t=String(t||""); var m=/^([A-Za-z0-9]{1,12})-G[A-Z2-7]{55}$/.exec(t);'
+'  if(m)return m[1]; if(/^G[A-Z2-7]{55}$/.test(t))return shortG(t); return t.length>28?(t.slice(0,27)+"\u2026"):t; }'
+'function accountOf(a){ return j(H+"/accounts/"+a); }'
+`
function paintUsers(){
  var t=((q(".admin-page-title")||{}).textContent||"").trim(); if(t.indexOf("Users")!==0)return;
  var tbl=q(".adm-table"); if(!tbl||tbl.getAttribute("data-lxbuilt")==="1")return; tbl.setAttribute("data-lxbuilt","1");
  // Columns are the question asked of this page: who trades most, how much, and what they are worth.
  var TH=["Wallet","From","Volume","Trades","Revenue","Fee tier","First seen","Last seen"];
  // Same contract as the Assets table: null means "leave ROWS in the order sortRows() put them", so the
  // Sort dropdown and the column headers coexist without either knowing the other's state.
  var SORTABLE={2:"vol",3:"trades",4:"rev",5:"tier",6:"first",7:"last"};
  var UCOL=null, UDIR=-1;
  var thr=tbl.querySelector("thead tr");
  function uHead(){
    if(!thr)return;
    var made=TH.map(function(h,i){
      var al=(i>1?" style='text-align:right'":"");
      var col=SORTABLE[i];
      if(!col)return "<th"+al+">"+esc(h)+"</th>";
      var on=(UCOL===col);
      return "<th"+al+"><button type='button' class='lxth"+(on?" on":"")+"' data-lxusort='"+col+"'"
        +" aria-label='Sort by "+esc(h)+(on?(UDIR<0?", high to low":", low to high"):"")+"'>"
        +esc(h)+"<span class='lxth-a'>"+(on?(UDIR<0?"▼":"▲"):"↕")+"</span></button></th>";
    }).join("");
    if(thr.innerHTML!==made)thr.innerHTML=made;
  }
  uHead();
  function uVal(u,col){
    if(col==="vol")return u.volUsd!=null?+u.volUsd:null;
    if(col==="trades")return +u.n||0;
    if(col==="rev")return u.usd!=null?+u.usd:null;
    // The tier is a yes/no, so it sorts as one: everyone on the reduced fee together, and a wallet
    // whose LUMOS balance has not resolved yet stays out of both groups rather than joining "no".
    if(col==="tier")return u.tier==null?null:(u.tier?1:0);
    if(col==="first")return Date.parse(u.first)||null;
    if(col==="last")return Date.parse(u.last)||null;
    return null;
  }
  // Same rule as the Assets table: a value still loading sorts LAST in both directions, so ascending
  // does not open with a screen of dashes. Ties fall back to the address, which is stable.
  function uBy(x,y){
    var a=uVal(x,UCOL), b=uVal(y,UCOL);
    var an=(a==null||a!==a), bn=(b==null||b!==b);
    if(an&&bn)return x.addr.localeCompare(y.addr);
    if(an)return 1;
    if(bn)return -1;
    if(a===b)return x.addr.localeCompare(y.addr);
    return UDIR*(a-b);
  }
  if(thr&&!thr.__lxus){ thr.__lxus=1; thr.addEventListener("click",function(e){
    var b=e.target.closest&&e.target.closest("[data-lxusort]"); if(!b)return;
    var c=b.getAttribute("data-lxusort");
    if(UCOL===c)UDIR=-UDIR; else { UCOL=c; UDIR=-1; }
    uHead(); render();
  }); }
  var tb=tbl.querySelector("tbody");
  if(tb)tb.innerHTML="<tr><td colspan='"+TH.length+"' class='lxadm-empty'>Loading\u2026</td></tr>";
  var seg=q(".seg-row");
  if(seg)seg.innerHTML="<button class='seg-chip active' type='button'><span class='seg-label'>All wallets</span><span class='seg-count' id='lxuAll'>\u2014</span></button>"
    +"<button class='seg-chip' type='button' data-seg='tier'><span class='seg-label'>On 0.1% fee</span><span class='seg-count' id='lxuTier'>\u2014</span></button>"
    +"<button class='seg-chip' type='button' data-seg='ext'><span class='seg-label'>External only</span><span class='seg-count' id='lxuExt'>\u2014</span></button>";
  var head=q(".admin-page-head");
  if(head&&!q(".lxadm-note")){ var nt=document.createElement("div"); nt.className="lxadm-note";
    nt.textContent="LumosCore has no sign-up, so there is no user table to read. A user here is a wallet that has paid a platform fee on-chain \u2014 the only record of someone having used the app. Wallets on Stellar, the XRP Ledger and NEAR are all listed; the network shows under each address.";
    head.parentNode.insertBefore(nt, head.nextSibling); }
  qa(".admin-page-actions .adm-btn").forEach(function(b){ if(/invite/i.test(b.textContent)){ b.disabled=true; b.style.opacity="0.5"; b.style.cursor="not-allowed"; b.title="Needs a backend \u2014 there is nowhere to store an admin account or send an invite."; } });
  var ROWS=[], SORT=0, TIERSET=null, XTIERSET=null, SEG="all", GEO=null;
  // THE FLAG IS A UNICODE REGIONAL-INDICATOR PAIR, not an image: two code points per country, no
  // request, no sprite sheet, and nothing to 404. "GB" -> the two letters shifted into the regional
  // indicator block, which every platform renders as a flag.
  // AN IMAGE, NOT AN EMOJI, AND THE COUNTRY'S FULL NAME (RAZA 2026-10-12: "also add country flag
  // like you added on analytics section ... And why are you writing short form of country name").
  //
  // This used to build a regional-indicator pair -- 0x1F1E6 + letter -- which IS the correct way to
  // write a flag emoji and renders as a flag on macOS, iOS and Android. Windows ships no flag-emoji
  // font at all, so Chrome falls back to drawing the two letters, and the column read "PK", "CA",
  // "SG". Nothing was broken; the platform simply had no glyph. The admin panel is used on Windows.
  //
  // The Analytics page already solved this with flagcdn images, which is why its flags looked right
  // beside a Users column that did not. Same source, same fallback contract: if the image 404s or the
  // network is down, the two-letter code is swapped back in rather than leaving an empty cell.
  function flagOf(cc){
    if(!/^[A-Za-z]{2}$/.test(cc||""))return "";
    var lo=String(cc).toLowerCase(), up=String(cc).toUpperCase();
    return "<img class='lxu-flagimg' alt='' loading='lazy' src='https://flagcdn.com/w40/"+lo+".png' data-cc='"+up+"'>";
  }
  // Intl.DisplayNames is in every browser this panel runs in and needs no table of our own, which
  // matters because a hand-kept country list is a list that goes stale. Built once, not per row.
  var LXDN=null; try{ LXDN=new Intl.DisplayNames(["en"],{type:"region"}); }catch(_){}
  function cnameOf(cc){
    cc=String(cc||"").toUpperCase();
    if(!cc)return "";
    if(cc==="T1")return "Tor network";            // Cloudflare's own code, not an ISO country
    if(cc==="XX"||cc==="(NONE)")return "Unknown";
    try{ var n=LXDN&&LXDN.of(cc); if(n&&n!==cc)return n; }catch(_){}
    return cc;                                    // an unknown code is shown as itself, never guessed
  }
  // The image can fail where the text never would, so the swap-back is wired once per render pass.
  function flagImgFallback(root){
    try{
      [].slice.call((root||document).querySelectorAll("img.lxu-flagimg")).forEach(function(im){
        if(im.__lxfb)return; im.__lxfb=1;
        im.addEventListener("error",function(){
          var s=document.createElement("span");
          s.className="lxu-cc";
          s.textContent=im.getAttribute("data-cc")||"?";
          if(im.parentNode)im.parentNode.replaceChild(s,im);
        });
      });
    }catch(_){}
  }
  // Three states, and they are NOT the same thing, so they do not look the same:
  //   still loading      -> nothing yet
  //   loaded, no record  -> a dash, meaning this wallet has not connected since we started recording
  //   loaded, has record -> the flag
  // Nothing was recorded before 2026-09-23 and there is no way to backfill it, so most wallets will
  // sit on the dash until their owner next connects. Saying so in the title beats a blank cell that
  // looks like a bug.
  function flagCell(addr){
    if(GEO===null)return "";
    var g=GEO[addr];
    if(!g||!g.c)return "<span class='lxu-noflag' title='This wallet has not connected since LumosCore began recording where connections come from (2026-09-23). It fills in the next time they connect.'>—</span>";
    // The NAME sits beside the flag now. A flag alone asks the reader to recognise it, and this
    // column is scanned rather than studied; the title keeps the timestamp and connect count.
    return "<span class='lxu-flag' title='Last connected from "+esc(cnameOf(g.c))+" · "+esc(new Date(g.t).toLocaleString())
      +(g.n>1?(" · "+g.n+" connects seen"):"")+"'>"+flagOf(g.c)
      +"<span class='lxu-cname'>"+esc(cnameOf(g.c))+"</span></span>";
  }
  loadRevenue().then(function(rv){
    var w={};
    // A wallet address belongs to exactly one chain, so the chain is recorded on the WALLET and the
    // per-asset tallies need no chain in their keys. That is what lets pricing, the tier check and the
    // explorer link all route off one field.
    rv.rows.forEach(function(p){ var a=assetOf(p), u=w[p.from]=w[p.from]||{addr:p.from,chain:(p.chain||"stellar"),n:0,by:{},vol:{},first:p.created_at,last:p.created_at};
      // "|", not "-": a NEAR issuer is a contract id and may itself contain hyphens.
      u.n++; u.by[a.code+"|"+a.iss]=(u.by[a.code+"|"+a.iss]||0)+(+p.amount||0);
      if(Date.parse(p.created_at)<Date.parse(u.first))u.first=p.created_at;
      if(Date.parse(p.created_at)>Date.parse(u.last))u.last=p.created_at; });
    ROWS=Object.keys(w).map(function(k){return w[k];});
    // The top row by volume was a LumosDAO treasury wallet -- our own testing, not a customer.
    // D03 (RAZA 2026-11-21, "Yes, hide it"): treasury receipts now leave loadRevenue, so they reach neither this list
    // nor the dashboard or Revenue totals -- the disagreement the next lines guarded against cannot happen.
    // Labelling beats silently dropping: excluding them here would make this page disagree with the
    // dashboard and the Revenue page, which DO count that on-chain activity. The admin can filter.
    ROWS.forEach(function(u){ u.tre=!!TREASURY[u.addr]; });
    setT(q("#lxuExt"), String(ROWS.filter(function(u){return !u.tre;}).length));
    setT(q("#lxuAll"), String(ROWS.length)); fixPager(ROWS.length);
    var sub=q(".admin-page-sub"); if(sub)sub.innerHTML="Wallets that have paid a platform fee \u00b7 <span class='mono'>"+ROWS.length+"</span> total";
    if(!ROWS.length){ if(tb)tb.innerHTML="<tr><td colspan='"+TH.length+"' class='lxadm-empty'>No wallet has paid a fee yet.</td></tr>"; return; }
    sortRows(); render();
    // revenue: the fees this wallet actually paid us, priced per asset
    // Priced PER CHAIN. The same ticker exists on both, and the old version sent every asset to
    // stellar.expert, so an XRPL wallet's fees priced to nothing and its Revenue column stayed on the
    // raw amounts. lastIndexOf splits code from issuer because an XRPL 40-hex code never contains "-"
    // but split("-") would still mangle anything that did.
    var codes={}; ROWS.forEach(function(u){ Object.keys(u.by).forEach(function(k){ codes[u.chain+"|"+k]=1; }); });
    Object.keys(codes).forEach(function(ck){ var bar=ck.indexOf("|"), ch=ck.slice(0,bar), k=ck.slice(bar+1), i=k.indexOf("|");
      priceUsdOn(ch,k.slice(0,i),k.slice(i+1),function(px){ if(px==null)return;
        ROWS.forEach(function(u){ if(u.chain===ch&&u.by[k]!=null){ u.usd=(u.usd||0)+u.by[k]*px; } }); sortRows(); render(); }); });
    // volume: gross swap size per wallet, from the same decoded envelopes the dashboard uses
    loadVolume().then(function(v){
      var idx={}; ROWS.forEach(function(u){ idx[u.addr]=u; });
      var vcodes={};
      // A row with no gross has no asset either -- grossOf returns code:null for a receipt with no
      // swap behind it, and an XRPL row never carries one. Without this guard they all keyed "null-",
      // which then went to stellar.expert as an asset search for "null": one wasted request per page
      // whose only possible answer was no match. Every other reader of these rows already skips them.
      v.rows.forEach(function(r){ var u=idx[r.from]; if(!u)return; if(!r.code||!r.gross)return;
        var k=r.code+"-"+r.iss;
        u.vol[k]=(u.vol[k]||0)+r.gross; vcodes[k]=1; });
      var vpend=Object.keys(vcodes).length; if(!vpend){ window.__lxUVolDone=1; render(); }
      Object.keys(vcodes).forEach(function(k){ var pp=k.split("-");
        priceUsd(pp[0],pp[1]||"",function(px){ if(--vpend<=0)window.__lxUVolDone=1; if(px==null){ render(); return; }
          ROWS.forEach(function(u){ if(u.vol[k]!=null){ u.volUsd=(u.volUsd||0)+u.vol[k]*px; } }); sortRows(); render(); }); });
    });
    // NEAR wallets: swap volume from the NEAR activity the dashboard already prices (B08, 2026-11-21).
    loadNearVol().then(function(nv){ if(!nv)return; var by={};
      nv.rows.forEach(function(r){ if(r.kind!=="swap"||!r.who||r.usd==null)return; by[r.who]=(by[r.who]||0)+r.usd; });
      ROWS.forEach(function(u){ if(u.chain==="near"&&by[u.addr]!=null)u.volUsd=by[u.addr]; }); sortRows(); render(); });
    // fee tier: membership of the >=250K LUMOS set, which is already fetched for the dashboard
    // Separate from everything else on the page, and failing softly: a missing geo map costs a column
    // of dashes, never the table.
    j("/lxapi/walletgeo").then(function(d){ GEO=(d&&d.geo)||{}; render(); })
      .catch(function(){ GEO={}; render(); });
    // Each wallet is tested against ITS OWN chain's LUMOS holders. Checking an r-address against the
    // Stellar set always answered "below the threshold", which reads on screen as a measurement.
    Promise.all([loadTier(),loadXTier()]).then(function(r){ TIERSET=r[0].set||{}; XTIERSET=r[1].set||{};
      // NEAR is not tested at all: no NEAR LUMOS holder list is read here, and testing a .near account
      // against either set would print "0.2%" from a check never made -- the trap XRPL fell into first.
      var onTier=0; ROWS.forEach(function(u){ if(u.chain==="near"){ u.tier=null; return; } var s=(u.chain==="xrpl")?XTIERSET:TIERSET;
        u.tier=!!s[u.addr]; if(u.tier)onTier++; });
      setT(q("#lxuTier"), String(onTier)); render(); });
  });
  function sortRows(){ ROWS.sort(function(x,y){
    if(SORT===1)return (y.n||0)-(x.n||0);
    if(SORT===2)return (y.usd||0)-(x.usd||0);
    if(SORT===3)return Date.parse(y.last)-Date.parse(x.last);
    return (y.volUsd||0)-(x.volUsd||0); }); }
  function render(){ if(!tb)return; var qy=((q(".fs-search input")||{}).value||"").trim().toLowerCase();
    var list=ROWS.filter(function(u){ if(qy&&u.addr.toLowerCase().indexOf(qy)<0)return false; if(SEG==="ext"&&u.tre)return false; if(SEG==="tier"&&!u.tier)return false; return true; });
    // On the filtered copy, never on ROWS: sortRows() owns that array and re-runs on every price that
    // lands, so a column choice written into it would be overwritten a second later.
    if(UCOL)list.sort(uBy);
    if(!list.length){ tb.innerHTML="<tr><td colspan='"+TH.length+"' class='lxadm-empty'>No wallet matches that search.</td></tr>"; return; }
    tb.innerHTML=list.map(function(u){
      var paid=Object.keys(u.by).map(function(k){ return num(u.by[k])+" "+k.split("|")[0]; }).join(", ");
      // A wallet whose LUMOS balance we have not resolved yet shows a dash, not "No" -- claiming someone
      // is off the discount before the check has finished would be a wrong answer, not a pending one.
      var tier=(u.tier==null)?"\u2014":(u.tier
        ?"<span class='lxu-tier on' title='Holds at least 250,000 LUMOS, so pays the reduced 0.1% platform fee.'>0.1%</span>"
        :"<span class='lxu-tier off' title='Below 250,000 LUMOS, so pays the standard 0.2% platform fee.'>0.2%</span>");
      // The chain is named on the wallet's own sub-line rather than in a new column, because the
      // sortable-column map is keyed by column INDEX and a ninth column would shift every entry.
      var xr=((u.chain||"stellar")!=="stellar");   // any chain whose volume this page cannot rebuild
      if(u.chain==="near"&&u.tier==null)tier="<span title='The 0.1% LUMOS tier is not checked for NEAR wallets here: no NEAR LUMOS holder list is read.'>—</span>";
      return "<tr class='clickable' data-w='"+esc(u.addr)+"' data-c='"+esc(u.chain||"stellar")+"'>"
        +"<td><div class='user-cell'><img class='lxu-av' data-lxc='wallet' alt='' src='"+avatar(u.addr.slice(1,3))+"'>"
        +"<div><div class='un mono' title='"+esc(u.addr)+"'>"+esc(shortA(u.chain,u.addr))+(u.tre?" <span class='lxu-tre' title='A LumosDAO treasury or burn wallet, not a customer. Its activity is real on-chain volume so it is counted, but it is not a trader.'>treasury</span>":"")+"</div><div class='um'>"+chainName(u.chain)+" mainnet</div></div></div></td>"
        +"<td>"+flagCell(u.addr)+"</td>"
        // Swap volume is rebuilt from Stellar transaction envelopes and has no XRPL equivalent, so an
        // XRPL wallet's volume never arrives. The ellipsis means "still loading" and would have sat
        // there for ever; a dash with a reason is the honest cell.
        +"<td class='num-cell' style='text-align:right'>"+(u.volUsd!=null?esc(usd(u.volUsd))
          :(xr?"<span title='Swap volume is reconstructed from Stellar transaction envelopes. There is no "+chainName(u.chain)+" equivalent yet, so volume is not measured for this wallet \u2014 the fees it paid are.'>\u2014</span>":(window.__lxUVolDone?"<span title='No priced swap volume: its swaps could not be priced, or it only paid fees.'>\u2014</span>":"\u2026")))+"</td>"
        +"<td class='num-cell' style='text-align:right'>"+u.n+"</td>"
        +"<td class='num-cell' style='text-align:right' title='"+esc(paid)+"'>"+(u.usd==null?esc(paid):esc(usd(u.usd)))+"</td>"
        +"<td style='text-align:right'>"+tier+"</td>"
        +"<td style='text-align:right;color:var(--text-muted);font-size:13.5px'>"+esc(new Date(u.first).toLocaleDateString())+"</td>"
        +"<td style='text-align:right;color:var(--text-muted);font-size:13.5px'>"+esc(ago(u.last))+"</td></tr>"; }).join("");
    // Wired after every write, not once at startup: the table is re-rendered on search, sort and
    // column click, and each pass creates fresh <img> nodes that have never had the handler attached.
    // flagImgFallback marks what it has already wired, so repeating it is free.
    flagImgFallback(tb); }
  // Delegated, so the row markup carries no inline handler and the address needs no quote juggling.
  if(tb&&!tb.__lxw){ tb.__lxw=1; tb.addEventListener("click",function(e){
    var tr=e.target.closest&&e.target.closest("tr[data-w]"); if(!tr)return;
    var ad=tr.getAttribute("data-w");
    // The wallet profile reads Horizon balances and a Stellar fee history, so it can say nothing about
    // an r-address. Sending one there would open a page of dashes that looks broken rather than
    // inapplicable; bithomp is the explorer the XRPL side already uses everywhere else.
    // NEAR the same way, to NearBlocks.
    var dc=tr.getAttribute("data-c");
    if(dc==="xrpl"||dc==="near"){ window.open(exAcct(dc,ad),"_blank","noopener"); return; }
    if(window.__lxNav)window.__lxNav("lumoscore-admin-user-profile.html?w="+ad); }); }
  qa(".seg-chip").forEach(function(ch){ ch.addEventListener("click",function(){ qa(".seg-chip").forEach(function(o){ o.classList.remove("active"); }); ch.classList.add("active"); SEG=ch.getAttribute("data-seg")||"all"; render(); }); });   var si=q(".fs-search input"); if(si){ si.placeholder="Search by wallet address\u2026"; si.addEventListener("input",render); }
  qa(".filter-strip .fs-select").forEach(function(sel,i){
    if(i===0){ sel.innerHTML="<option>Sort: Volume</option><option>Sort: Trades</option><option>Sort: Revenue</option><option>Sort: Last seen</option>";
      // The dropdown reorders ROWS itself, so it has to clear any column choice or it would look broken.
      sel.addEventListener("change",function(){ UCOL=null; uHead(); SORT=sel.selectedIndex; sortRows(); render(); }); }
    else sel.remove(); });
  var more=qa(".filter-strip .adm-btn").filter(function(b){return /more/i.test(b.textContent);})[0]; if(more)more.remove();
  qa(".admin-page-actions .adm-btn").forEach(function(b){ if(!/export/i.test(b.textContent)||b.__lx)return; b.__lx=1;
    b.addEventListener("click",function(){
      var head2="chain,wallet,volume_usd,trades,revenue_usd,fee_rate,first_seen,last_seen\\n";
      var body=ROWS.map(function(u){ return [(u.chain||"stellar"),u.addr,u.volUsd==null?"":u.volUsd.toFixed(6),u.n,u.usd==null?"":u.usd.toFixed(6),u.tier==null?"":(u.tier?"0.001":"0.002"),u.first,u.last].join(","); }).join("\\n");
      var bl=new Blob([head2+body],{type:"text/csv"}), url=URL.createObjectURL(bl);
      var el=document.createElement("a"); el.href=url; el.download="lumoscore-users.csv"; el.click();
      setTimeout(function(){URL.revokeObjectURL(url);},1000); }); });
}
`
+'var ASEED=[["LUMOS","GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S"],["USDC","GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"],["AQUA","GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA"],["yXLM","GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55"],["EURC","GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2"],["yUSDC","GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF"]];'
+'var AKEY="lumos.admin.assets";'
+'function aList(){ try{ var v=JSON.parse(localStorage.getItem(AKEY)||"null"); if(v&&v.length)return v; }catch(_){}'
+'  return ASEED.map(function(t){ return {code:t[0],iss:t[1]}; }); }'
// The list lives in KV now, not in this browser, so it is the same list for everyone and the public
// site can read it. localStorage is kept only as an instant-paint cache for the next page load.
+'var ASRV=false;'
+'function aSave(l){ try{ localStorage.setItem(AKEY,JSON.stringify(l)); }catch(_){}'
+'  if(!ASRV){ return Promise.resolve(null); }'

+'  var names=l.map(function(a){ return a.code+"-"+a.iss; });'
+'  return fetch("/lxapi/assetmeta",{method:"PUT",headers:{"content-type":"application/json"},'
+'    body:JSON.stringify({list:names})}).then(function(r){ return r.json(); })'
+'    .catch(function(){ return null; }); }'
// stellar.expert prices in USD (USDC comes back at 1.0001, not 6.26), so no XLM conversion here
// UPSTREAM SENDS AN OBJECT NOW: stellar.expert returns trustlines as {total, authorized, funded},
// and this read [0] and [2]. Undefined-or-0 is 0, so every row showed a measured-looking 0 -- AQUA
// has 191,991 total / 129,324 funded (RAZA, 2026-09-23). _searchassets.js had already been fixed for
// the identical change; three other call sites had not been swept. Both shapes are read so a cached
// older response still works.
+'function lxTl(t,k){ if(!t)return 0; if(t[k]!=null)return +t[k]||0; var i=(k==="funded")?2:0; return +t[i]||0; }'
+'function aInfo(code,iss,cb){ j("https://api.stellar.expert/explorer/public/asset?search="+encodeURIComponent(code+"-"+iss)+"&limit=5").then(function(d){'
+'    var rs=(d&&d._embedded&&d._embedded.records)||[];'
+'    var m=rs.filter(function(r){ return String(r.asset||"").indexOf(code+"-"+iss)===0; })[0];'
+'    if(!m){ cb(null); return; }'
+'    var ti=m.tomlInfo||m.toml_info||{}, sr=m.price7d||[];'
+'    function chg(n){ if(sr.length<n+1)return null; var a=sr[sr.length-1-n]&&sr[sr.length-1-n][1], b=sr[sr.length-1]&&sr[sr.length-1][1];'
+'      if(!a||!b)return null; return (b-a)/a*100; }'
+'    cb({code:code,iss:iss,price:+m.price||null,d1:chg(1),d7:chg(sr.length-1),'
+'      vol7d:(+m.volume7d||0)/1e7,trust:lxTl(m.trustlines,"total"),'
+'      funded:lxTl(m.trustlines,"funded"),domain:m.domain||"",img:ti.image||"",name:ti.name||""}); }); }'
// THE SAME LOOKUP, ON THE OTHER LEDGER. aInfo asks stellar.expert, which has never heard of an
// r-address: it answers with nothing, so every XRPL row rendered as a line of dashes AND spent a
// request finding that out. /lxapi/xrpltoken is the XRPL equivalent and is already proxied, cached
// and keyed the way xrpl.to expects.
//
// The callback shape is aInfo's, field for field, so render(), sortVal() and the search all keep
// working without learning about chains -- the same trick the fee ledger uses for its rows.
// An id ends in an r-address or a G-address, and only one of those is an XRP Ledger account. The same
// test assetmeta.js uses, so the panel and the store agree on what an XRPL asset is.
//
// TOP LEVEL, not inside paintAssets. It started there, and the mobile Assets painter -- a separate
// function in the same script -- threw "isXA is not defined" on its first draw, which killed the whole
// list and left it reading "Loading…" for ever. Nothing above it in that call stack catches, so one
// missing name takes the page with it.
+'function isXA(k){ return /-r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(String(k||"")); }function isNA(k){ return String(k||"").slice(-15)===".lumoscore.near"; }function nInfo(code,iss,cb){ j("https://lumoscore.com/lxapi/neartoken?i="+encodeURIComponent(iss)).then(function(d){ if(!d||!d.ok){ cb(null); return; } cb({code:code,iss:iss,price:(d.usd>0?+d.usd:null),d1:(d.d24!=null&&isFinite(+d.d24)?+d.d24:null),d7:null,vol7d:null,trust:null,funded:null,domain:"lumoscore.com",img:"",name:(d.name&&d.name.toUpperCase()!==code?d.name:"")}); }).catch(function(){ cb(null); }); }'
+'function xInfo(code,iss,cb){ j("/lxapi/xrpltoken?id="+encodeURIComponent(iss+"-"+xCur(code))).then(function(d){'
+'    if(!d||!d.ok){ cb(null); return; }'
// price is USD here because the table's column is USD, matching what stellar.expert returns for the
// Stellar rows. `usd` can be null when the rate fails its check upstream -- that is a dash, not a 0.
+'    cb({code:code,iss:iss,price:(d.usd!=null?+d.usd:null),d1:(d.p24!=null?+d.p24:null),d7:(d.p7!=null?+d.p7:null),'
+'      vol7d:null,trust:(d.trustlines!=null?+d.trustlines:null),funded:(d.holders!=null?+d.holders:null),'
+'      domain:d.domain||"",img:"",name:d.name||""}); }).catch(function(){ cb(null); }); }'
+'function pct(v){ if(v==null||!isFinite(v))return "<span style=\\"color:var(--text-muted)\\">\u2014</span>";'
+'  var c=v>=0?"ch-up":"ch-down"; return "<span class=\\""+c+"\\">"+(v>=0?"+":"")+v.toFixed(2)+"%</span>"; }'
+`
// Per-asset overrides for the public Trade-Asset page. Everything there normally comes from the
// issuer's own stellar.toml, which we cannot edit -- so when a project asks us to fix their
// description, logo or links, this is the only place that can answer. Saved values beat the toml.
// MINTER PAYOUT WALLET (RAZA 2026-11-24) -- see functions/lxapi/minters.js.
function minterEdit(k,net){
  if(q(".lxmodal"))return;
  var m=document.createElement("div"); m.className="lxmodal";
  m.innerHTML="<div class='lxmodal-box'><h3 class='lxmodal-t'>Minter of "+esc(k.split("-")[0])+"</h3>"
    +"<p class='lxmodal-s'>This wallet receives the token’s share of LumosCore’s fee on every LumosCore trade of this token, paid inside the trade: 30%, rising to 70% with the token’s lifetime LumosCore volume. Keep the wallet read from the chain, or enter the one the team gave you.</p>"
    +"<p class='lxmodal-s' id='lxmSrc' style='opacity:.8'>Looking up the minter…</p>"
    +"<label class='lxmodal-l' for='lxmAddr'>Payout wallet</label><input class='lxmodal-i' id='lxmAddr' spellcheck='false' style='font-family:JetBrains Mono,monospace;font-size:13px'>"
    +"<p class='lxmodal-e' id='lxmErr'></p>"
    +"<div class='lxmodal-a'><button class='adm-btn ghost' type='button' id='lxmClear' style='display:none'>Use the chain’s answer</button>"
    +"<button class='adm-btn ghost' type='button' id='lxmCancel'>Cancel</button><button class='adm-btn primary' type='button' id='lxmOk'>Save</button></div></div>";
  document.body.appendChild(m);
  function close(){ m.remove(); }
  m.addEventListener("click",function(e){ if(e.target===m)close(); });
  m.querySelector("#lxmCancel").addEventListener("click",close);
  var inp=m.querySelector("#lxmAddr"), er=m.querySelector("#lxmErr"), src=m.querySelector("#lxmSrc"), clr=m.querySelector("#lxmClear");
  fetch("/lxapi/minters?net="+net+"&id="+encodeURIComponent(k)+"&cb="+Date.now()).then(function(r){ return r.json(); }).then(function(d){
    inp.value=(d&&d.minter)||"";
    src.textContent=(d&&d.source==="admin")?"Entered by hand in admin.":((d&&d.minter)?"Read from the chain: the wallet that signed the mint.":"Not found on the chain. Enter the team’s wallet to start paying them.");
    clr.style.display=(d&&d.source==="admin")?"":"none";
    if(d&&d.share){ var _tl=document.createElement("p"); _tl.className="lxmodal-s"; _tl.style.opacity=".8"; _tl.textContent="Share "+Math.round(d.share*100)+"% · lifetime LumosCore volume "+"$"+(+d.volume||0).toLocaleString(undefined,{maximumFractionDigits:2})+(d.next?(" · "+Math.round(d.next.share*100)+"% from "+"$"+(+d.next.at).toLocaleString()):" · top tier")+"."; src.parentNode.insertBefore(_tl,src.nextSibling); }
  }).catch(function(){ src.textContent="Could not look it up right now."; });
  function post(body){ return fetch("/lxapi/minters",{method:"POST",credentials:"include",headers:{"content-type":"application/json"},body:JSON.stringify(body)}).then(function(r){ return r.json(); }); }
  m.querySelector("#lxmOk").addEventListener("click",function(){ var a=(inp.value||"").trim(); if(!a){ er.textContent="Enter a wallet address."; return; }
    post({op:"set",net:net,id:k,addr:a}).then(function(z){ if(!z||!z.ok){ er.textContent=(z&&z.error)||"Could not save."; return; } close(); },function(e){ er.textContent=e.message; }); });
  clr.addEventListener("click",function(){ post({op:"clear",net:net,id:k}).then(function(z){ if(!z||!z.ok){ er.textContent=(z&&z.error)||"Could not clear."; return; } close(); }); });
}
function editAsset(k){
  if(q(".lxmodal"))return;
  var i=k.indexOf("-"), code=k.slice(0,i);
  var m=document.createElement("div"); m.className="lxmodal";
  function row(id,label,hint,type){
    return "<label class='lxmodal-l' for='"+id+"'>"+esc(label)+(hint?(" <span style='font-weight:600;text-transform:none;letter-spacing:0;opacity:.7'>"+esc(hint)+"</span>"):"")+"</label>"
      +(type==="area"
        ? "<textarea class='lxmodal-i' id='"+id+"' rows='4'></textarea>"
        : "<input class='lxmodal-i' id='"+id+"' type='text'>");
  }
  m.innerHTML="<div class='lxmodal-box' style='max-width:560px'><h3 class='lxmodal-t'>Edit "+esc(code)+"</h3>"
    +"<p class='lxmodal-s'>What the public asset page shows. Prefilled from the issuer's own stellar.toml where we have no override of our own — change a field and ours is used instead.</p>"
    +"<p class='lxmodal-s' id='lxeSrc' style='opacity:.75'>Checking the issuer’s domain…</p>"
    +"<button class='adm-btn ghost' type='button' id='lxeVouch' style='display:none;margin:0 0 10px'></button>"
    +row("lxeName","Display name","optional")
    +row("lxeDesc","Description","shown under the asset name","area")
    +row("lxeImg","Logo","paste a URL, or upload a file")
    +"<div style='display:flex;align-items:center;gap:10px;margin:8px 0 4px'>"
    +"<input type='file' id='lxeFile' accept='image/png,image/jpeg,image/webp,image/gif,image/avif' style='display:none'>"
    +"<button class='adm-btn ghost' type='button' id='lxeUp'>Upload logo…</button>"
    +"<button class='adm-btn ghost' type='button' id='lxeCopy' style='display:none'>Save a copy here</button>"
    +"<span class='lxmodal-s' id='lxeUpMsg' style='margin:0'></span>"
    +"<img id='lxePrev' data-lxc='' alt='' style='display:none;width:28px;height:28px;border-radius:50%;object-fit:cover'></div>"
    +row("lxeSite","Website","https://…")
    +row("lxeX","X / Twitter","handle or full URL")
    +row("lxeTg","Telegram","handle or full URL")
    +"<label style='display:flex;align-items:center;gap:9px;margin:14px 0 2px;font-size:13.5px;font-weight:600;cursor:pointer'><input type='checkbox' id='lxeStable' style='width:16px;height:16px;margin:0'> Stablecoin <span style='font-weight:500;opacity:.7'>— list it under Curated — Stables on Trade</span></label>"
    +"<p class='lxmodal-e' id='lxeErr'></p>"
    +"<div class='lxmodal-a'><button class='adm-btn ghost' type='button' id='lxeClear'>Clear overrides</button>"
    +"<button class='adm-btn ghost' type='button' id='lxeCancel'>Cancel</button>"
    +"<button class='adm-btn primary' type='button' id='lxeOk'>Save</button></div></div>";
  document.body.appendChild(m);
  function close(){ m.remove(); }
  m.addEventListener("click",function(e){ if(e.target===m)close(); });
  m.querySelector("#lxeCancel").addEventListener("click",close);
  var er=m.querySelector("#lxeErr");
  function val(id){ return (m.querySelector(id).value||"").trim(); }
  function same(id,key){ var x=val(id); return (x===(TOMLV[key]||"").trim())?"":x; }

  // Prefilled from the issuer's own stellar.toml wherever we hold no override, so the form opens
  // showing what the asset page actually displays today instead of six empty boxes.
  //
  // The hazard that kept it empty before is still avoided, just further along: saving a field that
  // still holds the toml's own text would freeze the issuer's live wording as our copy. So on save,
  // any field still equal to the toml value is sent EMPTY -- it keeps tracking theirs. Only what you
  // actually changed is stored as an override.
  var TOMLV={name:"",description:"",image:"",website:"",twitter:"",telegram:""};
  var prev=m.querySelector("#lxePrev");
  function showPrev(){ var u=(m.querySelector("#lxeImg").value||"").trim();
    var copy=m.querySelector("#lxeCopy"), msg=m.querySelector("#lxeUpMsg");
    // Offered only for a logo still living on someone else's host. Once it is ours there is nothing
    // left to copy, and the button would be an action with no effect.
    if(copy)copy.style.display=(u&&u.indexOf("/lxapi/media")!==0)?"":"none";
    if(!prev)return;
    if(!u){ prev.style.display="none"; return; }
    prev.style.display=""; prev.src=u;
    // A broken image with an empty alt renders as a silent glyph and says nothing about why. The
    // usual causes are all actionable -- a wrong URL, a host that is down, or a blocker in THIS
    // browser refusing the issuer's domain -- so say them rather than showing a broken square.
    prev.onerror=function(){ prev.style.display="none";
      if(msg)msg.textContent="That image would not load here. The URL may be wrong or its host unreachable — or your browser is blocking that domain. “Save a copy here” serves it from LumosCore instead.";
    };
    prev.onload=function(){ if(msg&&/would not load/.test(msg.textContent))msg.textContent=""; };
  }

  // Copies the issuer's published logo into our own media store. The server fetches only the image
  // that asset's own toml declares, so this cannot be pointed anywhere else.
  var cp=m.querySelector("#lxeCopy");
  if(cp)cp.addEventListener("click",function(){
    var msg=m.querySelector("#lxeUpMsg");
    cp.disabled=true; if(msg)msg.textContent="Copying…";
    fetch("/lxapi/media?fromToml="+encodeURIComponent(k),{method:"POST"})
      .then(function(r){ return r.json().then(function(b){ return {ok:r.ok,b:b}; }); })
      .then(function(z){ cp.disabled=false;
        if(!z.ok||!z.b||!z.b.url){ if(msg)msg.textContent=(z.b&&(z.b.error||z.b.message))||"Could not copy that image."; return; }
        m.querySelector("#lxeImg").value=z.b.url; showPrev();
        if(msg)msg.textContent="Copied ("+Math.round((z.b.size||0)/1024)+" KB) — now served from LumosCore.";
      }).catch(function(e){ cp.disabled=false; if(msg)msg.textContent=e.message; });
  });
  Promise.all([
    j("/lxapi/assetmeta?asset="+encodeURIComponent(k)),
    j("/lxapi/assetverify?asset="+encodeURIComponent(k))
  ]).then(function(z){
    var v=(z[0]&&z[0].meta)||{}, vr=z[1]||{}, t=(vr&&vr.toml)||{};
    TOMLV={name:t.name||"",description:t.description||"",image:t.image||"",
           website:t.website||"",twitter:t.twitter||"",telegram:t.telegram||""};
    function put(sel,own,tom){ m.querySelector(sel).value=(own!=null&&own!=="")?own:(tom||""); }
    put("#lxeName",v.name,TOMLV.name);
    put("#lxeDesc",v.description,TOMLV.description);
    put("#lxeImg",v.image,TOMLV.image);
    put("#lxeSite",v.website,TOMLV.website);
    put("#lxeX",v.twitter,TOMLV.twitter);
    put("#lxeTg",v.telegram,TOMLV.telegram);
    var _sc=m.querySelector("#lxeStable"); if(_sc){ _sc.checked=((z[0]&&z[0].category)==="stable"); m.__lxCat=1; }
    showPrev();
    var src=m.querySelector("#lxeSrc");
    // Says which of the three situations this asset is in, because "empty because they publish
    // nothing" and "empty because their domain is unreachable" call for different action from you.
    if(src){
      if(isNA(k)) src.textContent="NEAR Launchpad token. Whatever you enter here is what its page on LumosCore shows.";
      else if(!vr.domain) src.textContent="This issuer publishes no home domain, so nothing could be prefilled. Whatever you enter here is what the asset page will show.";
      else if(!t.name&&!t.description&&!t.image) src.textContent="No usable stellar.toml at "+vr.domain+" — nothing to prefill. Whatever you enter here is what the asset page will show.";
      else src.textContent=(vr.verified?"Verified · ":"Not verified · ")+"prefilled from "+vr.domain+"’s stellar.toml. Edited fields override it.";
    }
    paintVouch(vr);
  });

  // Granting a tick the handshake could not. Offered only where it is actually needed, and the wording
  // is the point: the reader of the public site cannot tell an earned tick from a granted one, so the
  // person granting it should be told exactly what they are asserting.
  function paintVouch(vr){
    var b=m.querySelector("#lxeVouch"); if(!b)return; if(isNA(k)){ b.style.display="none"; return; }
    var VERx=window.__lxVER||{}; var rec=VERx[k]||null;
    // A CURATED TICK ON A MINT IS WITHDRAWABLE TOO (RAZA 2026-11-07, on LFQP: "you cant just get a
    // curated tick automatically just because you're minted on LumosCore"). This read only "manual",
    // so the one asset he wanted unticked showed "Vouch for this asset" -- the button that GRANTS one.
    // There was no way to take a curated tick off from the panel at all.
    //
    // Deliberately NOT widened to every curated tick: reconcileCurated still re-grants one to a curated
    // asset that is not a mint, so offering Withdraw on FRED, Xoge or PYUSD would be a button that
    // appears to work and silently undoes itself on the next read. A mint is now skipped there, so for
    // those the withdrawal is permanent and the button is honest.
    var minted=(window.__lxMINTIDS||[]).indexOf(k)>=0;
    var granted=!!(rec&&rec.v&&(rec.s==="manual"||(rec.s==="curated"&&minted)));
    if(vr&&vr.verified&&!granted){ b.style.display="none"; return; }   // earned it; nothing to grant
    b.style.display="";
    b.textContent=granted?"Withdraw the tick":"Vouch for this asset";
    b.onclick=function(){
      if(!granted&&!confirm("Vouch for "+code+"?\\n\\nIts issuer does not vouch for it, so this tick is your word rather than a verified fact. It looks identical to an earned tick to everyone on the public site.\\n\\nOnly do this for an asset you have confirmed some other way."))return;
      b.disabled=true; b.textContent=granted?"Withdrawing…":"Vouching…";
      fetch("/lxapi/assetmeta",{method:"PUT",headers:{"content-type":"application/json"},
        body:JSON.stringify({asset:k,override:!granted})})
        .then(function(r){ return r.json().then(function(x){ return {ok:r.ok,b:x}; }); })
        .then(function(z){ b.disabled=false;
          if(!z.ok){ er.textContent=(z.b&&z.b.error)||"Could not change that."; paintVouch(vr); return; }
          if(z.b&&z.b.verified)VERx[k]=z.b.verified; else delete VERx[k];
          paintVouch(vr); if(window.__lxRefresh)window.__lxRefresh();
        }).catch(function(e){ b.disabled=false; er.textContent=e.message; });
    };
  }

  // Upload goes to our own media store and comes back as a relative /lxapi/media URL, so the same
  // record works on staging and production.
  var fi=m.querySelector("#lxeFile"), ub=m.querySelector("#lxeUp"), um=m.querySelector("#lxeUpMsg");
  if(ub&&fi){
    ub.addEventListener("click",function(){ fi.click(); });
    fi.addEventListener("change",function(){
      var f=fi.files&&fi.files[0]; if(!f)return;
      um.textContent="Uploading…";
      var fd=new FormData(); fd.append("file",f);
      fetch("/lxapi/media",{method:"POST",body:fd})
        .then(function(r){ return r.json().then(function(b){ return {ok:r.ok,b:b}; }); })
        .then(function(z){
          if(!z.ok||!z.b||!z.b.url){ um.textContent=(z.b&&(z.b.message||z.b.error))||"Upload failed."; return; }
          m.querySelector("#lxeImg").value=z.b.url; showPrev();
          um.textContent="Uploaded ("+Math.round((z.b.size||0)/1024)+" KB)";
        }).catch(function(e){ um.textContent=e.message; });
    });
  }
  var ii2=m.querySelector("#lxeImg"); if(ii2)ii2.addEventListener("input",showPrev);

  m.querySelector("#lxeOk").addEventListener("click",function(){
    var ok=m.querySelector("#lxeOk"); er.textContent=""; ok.disabled=true; ok.textContent="Saving\u2026";
    fetch("/lxapi/assetmeta",{method:"PUT",headers:{"content-type":"application/json"},
      // A field still equal to the toml is sent empty, so it goes on tracking the issuer's live text
      // rather than being frozen as our copy of today's wording.
      body:JSON.stringify({asset:k,name:same("#lxeName","name"),description:same("#lxeDesc","description"),
        image:same("#lxeImg","image"),website:same("#lxeSite","website"),
        twitter:same("#lxeX","twitter"),telegram:same("#lxeTg","telegram"),category:(m.__lxCat?((m.querySelector("#lxeStable")||{}).checked?"stable":""):undefined)})})
      .then(function(r){ return r.json().then(function(b){ return {ok:r.ok,b:b}; }); })
      .then(function(z){
        ok.disabled=false; ok.textContent="Save";
        if(!z.ok){ er.textContent=(z.b&&(z.b.error||z.b.reason))||"Could not save."; return; }
        close();
      }).catch(function(e){ ok.disabled=false; ok.textContent="Save"; er.textContent=e.message; });
  });

  m.querySelector("#lxeClear").addEventListener("click",function(){
    if(!confirm("Clear the overrides for "+code+"? The asset page will go back to showing whatever the issuer publishes."))return;
    // meta=1 keeps the asset listed and only drops our copy -- de-listing is the x button, a different
    // intention that should not happen by accident from an edit form.
    fetch("/lxapi/assetmeta?meta=1&asset="+encodeURIComponent(k),{method:"DELETE"})
      .then(function(r){ return r.json(); })
      .then(function(b){ if(b&&b.ok)close(); else er.textContent=(b&&b.error)||"Could not clear."; })
      .catch(function(e){ er.textContent=e.message; });
  });
}
`
+ `
function paintAssets(){
  var t=(q(".admin-page-title")||{}).textContent||""; if(!/^s*Assets/.test(t))return;
  var tbl=q(".adm-table"); if(!tbl||tbl.getAttribute("data-lxbuilt")==="1")return; tbl.setAttribute("data-lxbuilt","1");

  // Volume over three windows because one number cannot answer "is this moving now" and "is this worth
  // listing" at the same time.
  var TH=["Asset","Issuer domain","Price","24h","7d","Vol 24h","Vol 7d","Vol 30d","Trustlines","Actions"];
  // The listing queue answers different questions from the asset table, so it gets its own columns.
  // Set per render rather than once, because the tab can change under a table that is already built.
  var TH_REQ=["Asset","Applicant","Paid","Submitted","Status","Actions"];
  var TH_NET=["Asset","Issuer / contract","Price","24h","Volume 24h","Liquidity","Links"];
  var thr=tbl.querySelector("thead tr");
  // Which TH index sorts by what. Only the numeric columns: sorting by Asset or Issuer domain is what
  // the search box is for, and Actions is not a value.
  var SORTABLE={2:"price",3:"d1",4:"d7",5:"v1",6:"v7",7:"v30",8:"trust"};
  // null means "leave the rows in the order the array is already in", which is what the Sort dropdown
  // produces. So the two controls coexist without either having to know about the other's state.
  var COL=null, DIR=-1;
  function setHead(){
    if(!thr)return;
    var want=(MODE==="requests")?TH_REQ:(isNet()?TH_NET:TH), first=(MODE==="requests")?2:1;
    var made=want.map(function(h,i){
      var al=(i>first?" style='text-align:right'":"");
      var col=(MODE==="requests"||isNet())?null:SORTABLE[i];
      if(!col)return "<th"+al+">"+esc(h)+"</th>";
      var on=(COL===col);
      return "<th"+al+"><button type='button' class='lxth"+(on?" on":"")+"' data-lxsort='"+col+"'"
        +" aria-label='Sort by "+esc(h)+(on?(DIR<0?", high to low":", low to high"):"")+"'>"
        +esc(h)+"<span class='lxth-a'>"+(on?(DIR<0?"\\u25bc":"\\u25b2"):"\\u2195")+"</span></button></th>";
    }).join("");
    if(thr.innerHTML!==made)thr.innerHTML=made;
  }
  // The value the column SHOWS, so the order always matches what is on screen. Volume is read in USD
  // for the same reason: the cells are USD, and sorting the raw token amounts would put a million
  // units of something worthless above a thousand dollars of something real.
  function sortVal(a,col){
    var k=key(a), v=DATA[k]||{}, px=PXA[k], w={v1:"d1",v7:"d7",v30:"d30"}[col];
    if(w){ var r=win(k,w); return (r&&r.amt&&px!=null)?r.amt*px:null; }
    if(col==="price")return v.price!=null?+v.price:null;
    if(col==="trust")return v.trust!=null?+v.trust:null;
    if(col==="d1"||col==="d7")return v[col]!=null?+v[col]:null;
    return null;
  }
  // A row whose number has not arrived yet sorts LAST in BOTH directions. Letting nulls ride at one
  // end means clicking "low to high" fills the top of the table with blanks, which looks like the
  // sort is broken rather than like the data is still loading. Ties fall back to code so the order
  // is stable instead of reshuffling on every repaint.
  function bySort(x,y){
    var a=sortVal(x,COL), b=sortVal(y,COL);
    var an=(a==null||a!==a), bn=(b==null||b!==b);
    if(an&&bn)return x.code.localeCompare(y.code);
    if(an)return 1;
    if(bn)return -1;
    if(a===b)return x.code.localeCompare(y.code);
    return DIR*(a-b);
  }
  if(thr&&!thr.__lxs){ thr.__lxs=1; thr.addEventListener("click",function(e){
    var b=e.target.closest&&e.target.closest("[data-lxsort]"); if(!b)return;
    var c=b.getAttribute("data-lxsort");
    // First click on a column is HIGH TO LOW. For money, volume and holders that is the question
    // being asked nine times out of ten; ascending is one more click away.
    if(COL===c)DIR=-DIR; else { COL=c; DIR=-1; }
    render();
  }); }
  var tb=tbl.querySelector("tbody");

  // CURATED and MINTS are different claims. Curated is what LumosCore chooses to list -- the set Trade
  // main shows. Mints are what was issued through our own launchpad: ours by definition, not a curation
  // decision. Merging them made the list look like we had hand-picked 55 assets.
  // MM is mintmeta: the name and artwork a mint was issued with, keyed by id. It is the only source
  // of a logo for an XRPL mint, because /lxapi/assetlogo resolves a Stellar toml.
  var CUR=[], MINTS=[], MODE="curated", DATA={}, VER={}, LXV=null, PXA={}, LOGO={}, MM={};
  // The curated-listing queue. null while it is still being fetched, so the chip can say so instead of
  // claiming zero.
  var LR=null;
  // Requests are not assets: they have no price, no volume and nothing to look up. Returning an empty
  // list keeps every caller that walks the asset rows -- load, sort, kpis -- a harmless no-op in this
  // mode rather than a special case in each of them.
  // D04: the XRPL and NEAR tabs are view-only lists with their own table; the asset-row machinery sees none.
  function isNet(){ return MODE==="xrpl"||MODE==="near"; }
  function rows(){ return (MODE==="requests"||isNet())?[]:(MODE==="mints"?MINTS:CUR); }
  function key(a){ return a.code+"-"+a.iss; }
  function parse(s){ var i=s.indexOf("-"); return {code:s.slice(0,i),iss:s.slice(i+1)}; }

  var head=q(".admin-page-head");
  if(head&&!q(".lxadm-note")){ var nt=document.createElement("div"); nt.className="lxadm-note";
    nt.textContent="Curated is what LumosCore lists — the same set Trade shows. Mints are the tokens issued through our launchpad. A tick means the asset’s own issuer vouches for it: its on-chain home domain publishes a stellar.toml naming this exact code and issuer. Volume is what traded on LumosCore, in USD. Adding an asset here curates it immediately; it appears on the public site at the next publish.";
    head.parentNode.insertBefore(nt, head.nextSibling); }

  function tabs(){
    var seg=q(".seg-row"); if(!seg)return;
    seg.innerHTML=
      "<button class='seg-chip"+(MODE==="curated"?" active":"")+"' type='button' data-lxtab='curated'>"
       +"<span class='seg-label'>Curated assets</span><span class='seg-count'>"+CUR.length+"</span></button>"
      +"<button class='seg-chip"+(MODE==="mints"?" active":"")+"' type='button' data-lxtab='mints'>"
       +"<span class='seg-label'>LumosCore native mints</span><span class='seg-count'>"+MINTS.length+"</span></button>"
      // The count shown is the number still WAITING, not the number ever received: a queue chip is
      // read as work outstanding, and a growing all-time total would stop meaning anything.
      +"<button class='seg-chip"+(MODE==="requests"?" active":"")+"' type='button' data-lxtab='requests'>"
       +"<span class='seg-label'>Listing requests</span><span class='seg-count'>"+(LR===null?"…":String(reqOpen().length))+"</span></button>"
      +["xrpl","near"].map(function(m){ var N=NET[m];
        return "<button class='seg-chip"+(MODE===m?" active":"")+"' type='button' data-lxtab='"+m+"' title='View only: this list is edited in the "+(m==="xrpl"?"XRPL":"NEAR")+" build, not here'>"
          +"<span class='seg-label'>"+(m==="xrpl"?"XRPL":"NEAR")+" curated</span><span class='seg-count'>"+(N&&N.rows?String(N.rows.length):(N&&N.err?"—":"…"))+"</span></button>"; }).join("");
    qa("[data-lxtab]").forEach(function(b){ b.addEventListener("click",function(){
      MODE=b.getAttribute("data-lxtab");
      if(MODE==="requests"&&LR===null)reqLoad();
      if(isNet())netLoad(MODE);
      qa(".admin-page-actions .adm-btn, .filter-strip .fs-select").forEach(function(x){ x.disabled=isNet(); x.style.opacity=isNet()?".45":""; x.style.cursor=isNet()?"not-allowed":""; });
      tabs(); render(); kpis(); rows().forEach(load); }); });
  }

  // The platform resolves logos server-side because plenty of toml hosts refuse a browser's request.
  // Doing it any other way here is how the table ended up wearing initials discs while every other
  // screen showed the real artwork.
  function logoFor(a,k){
    // /lxapi/assetlogo resolves a Stellar toml and knows nothing about r-addresses, so asking it
    // about an XRPL mint just burns a request. The mint's own artwork is already in hand: the
    // launchpad stored it in mintmeta:xrpl and assetmeta now returns it alongside the ids.
    if(isXA(k)||isNA(k)){ var mm=MM[k]; return (mm&&mm.image)||avatar(a.code); }
    if(LOGO[k]===undefined){ LOGO[k]=null;
      j("/lxapi/assetlogo?asset="+encodeURIComponent(k)).then(function(d){
        var u=d&&d.image; if(u){ LOGO[k]=u; render(); } else delete LOGO[k]; }); }
    return LOGO[k]||avatar(a.code);
  }
  function tickFor(k){
    var r=VER[k]; if(!r||!r.v)return "";
    var why=(r.s==="grandfathered")?("Verified by hand when added — "+(r.why||"")):(r.why||"Verified");
    return "<span class='lx-vtick' title='"+esc(why)+"'>"+VTICK+"</span>";
  }

  function win(k,w){ var r=LXV&&LXV[k]; return (r&&r[w])||null; }
  // Dollar volume for sorting (B07): 7D, then 30D; an asset with no price ranks as 0.
  function volUsd(k){ var p=PXA[k]; if(!(p>0))return [0,0]; return [((win(k,"d7")||{}).amt||0)*p, ((win(k,"d30")||{}).amt||0)*p]; }
  function byVol(x,y){ var a=volUsd(key(x)), b=volUsd(key(y)); return (b[0]-a[0])||(b[1]-a[1]); }
  function volSortOn(){ var s=q(".filter-strip .fs-select"); return !s||s.selectedIndex===0; }
  // USD, not asset units: 4,000,001 LUMOS and 1,200 USDC are not comparable, and a table exists to be
  // compared down a column.
  function volCell(k,w){
    if(LXV===null)return "…";
    var r=win(k,w); if(!r||!r.amt)return "<span style='color:var(--text-muted)'>—</span>";
    var px=PXA[k];
    if(px==null)return "<span style='color:var(--text-muted)' title='no USD price for this asset'>—</span>";
    return "<span title='"+r.n+" trade"+(r.n===1?"":"s")+" on LumosCore'>"+esc(usd(r.amt*px))+"</span>";
  }

  function kpis(){
    if(MODE==="requests")return reqKpis();
    if(isNet())return netKpis();
    setNote();
    var LI=rows();
    var vals=LI.map(function(a){ return DATA[key(a)]; }).filter(function(v){ return !!v; });
    var live=0, trades=0, tot=0, unpriced=0;
    if(LXV)LI.forEach(function(a){ var k=key(a);
      var r7=win(k,"d7"); if(r7&&r7.amt>0)live++;
      if(r7)trades+=r7.n;
      if(r7&&r7.amt>0){ var px=PXA[k]; if(px!=null)tot+=r7.amt*px; else unpriced++; } });
    var cards=qa(".kpi-grid .kpi");
    function set(i,label,val,foot){ var c=cards[i]; if(!c)return;
      var l=c.querySelector(".kpi-label"); if(l)setT(l,label);
      setT(c.querySelector(".kpi-value"),val);
      var f=c.querySelector(".kpi-foot"); if(f){ f.innerHTML=""; f.textContent=foot; } }
    set(0,(MODE==="mints"?"Native mints":"Curated assets"),String(LI.length),(MODE==="mints"?"issued on LumosCore":"listed on LumosCore"));
    set(1,"Traded on LumosCore",LXV?String(live):"…","in the last 7 days");
    set(2,"Trades on the platform",LXV?String(trades):"…","swaps in the last 7 days");
    set(3,"LumosCore 7d volume",LXV?usd(tot):"…",unpriced?(unpriced+" asset"+(unpriced===1?"":"s")+" not priced"):"traded on our platform");
    fixPager(LI.length);
    var sub=q(".admin-page-sub"); if(sub)sub.textContent=(MODE==="mints"?"Tokens issued through the LumosCore launchpad":"Assets you list on LumosCore");
  }

  // ---- the curated-listing queue --------------------------------------------------------------------
  // Applications from /list-your-token. Each one arrives already paid for -- the public endpoint
  // verifies the payment on-chain before it will store anything -- so what happens here is only the
  // decision and, on a decline, sending the money back.
  //
  // Approving is done by the SAME PUT /lxapi/assetmeta the Add-asset button uses. Nothing about
  // curation is reimplemented here; the server then refuses to mark a request approved until it can
  // see the asset on the curated list, so a half-finished approval stays visibly pending.
  var REQ_ST={
    pending:{t:"Awaiting review",c:"var(--text)"},
    approved:{t:"Approved",c:"#1fa968"},
    rejected:{t:"Declined, refund owed",c:"#e0553c"},
    refunded:{t:"Declined and refunded",c:"var(--text-muted)"}
  };
  function reqOpen(){ return (LR||[]).filter(function(r){ return r.status==="pending"||r.status==="rejected"; }); }

  // A handle can arrive as "@name", "name" or a full URL -- the applicant types what they think of, and
  // listing.js stores it as typed to match what assetmeta does. Turning it into something clickable is
  // therefore this function's job, and it is the only place that guesses.
  function reqHref(kind,v){
    v=String(v||"").trim(); if(!v)return "";
    if(/^https?:/i.test(v))return v;
    var h=v.replace(/^@/,"");
    if(kind==="twitter")return "https://x.com/"+encodeURIComponent(h);
    if(kind==="telegram")return "https://t.me/"+encodeURIComponent(h);
    return "https://"+v;                    // website or a discord invite typed bare
  }
  function reqLinks(r){
    var out=[];
    [["website",r.website,"Website"],["twitter",r.twitter,"X"],
     ["telegram",r.telegram,"Telegram"],["discord",r.discord,"Discord"]].forEach(function(p){
      if(!p[1])return;
      out.push("<a class='lxreq-link' target='_blank' rel='noopener' title='"+esc(p[1])+"' href='"+esc(reqHref(p[0],p[1]))+"'>"+esc(p[2])+"</a>");
    });
    // Said out loud rather than left blank. "No links given" is itself a review finding -- the bar is
    // whether a project is findable outside our site -- and an empty space does not say that.
    if(!out.length)return "<div class='lxreq-links lxreq-nolinks'>No links given</div>";
    return "<div class='lxreq-links'>"+out.join("")+"</div>";
  }
  function reqLoad(){
    return j("/lxapi/listingadmin").then(function(d){
      LR=(d&&d.requests)||[];
      tabs(); if(MODE==="requests"){ render(); kpis(); }
      return LR;
    }).catch(function(){ LR=[]; tabs(); if(MODE==="requests"){ render(); kpis(); } return LR; });
  }
  // HEDERA ROWS (network "hedera", from /lxapi/hederalisting): paid in HBAR, the asset is a token id,
  // links go to HashScan, and the refund is sent from a Hedera wallet and recorded by transaction id --
  // this panel signs Stellar only. No backslashes in this block: it is a template literal, which eats them.
  function isH(r){ return r&&r.network==="hedera"; }
  // XRP LEDGER and NEAR rows (2026-11-17, /lxapi/xrpllisting and /lxapi/nearlisting): paid in XRP / NEAR,
  // approved only once the token is on that network's curated list, refunded from Xaman / a NEAR wallet
  // and recorded by hash. Together with Hedera these are the "outside" networks this panel cannot sign.
  function isX(r){ return r&&r.network==="xrpl"; }
  function isN(r){ return r&&r.network==="near"; }
  function isExt(r){ return isH(r)||isX(r)||isN(r); }
  function netName(r){ return isH(r)?"Hedera":isX(r)?"XRP Ledger":isN(r)?"NEAR":"Stellar"; }
  function reqUnit(r){ return isH(r)?"HBAR":isX(r)?"XRP":isN(r)?"NEAR":"XLM"; }
  function reqAmt(r){ return (+r.payAmount||0).toLocaleString(undefined,{maximumFractionDigits:2})+" "+reqUnit(r); }
  function reqShort(r,a){ return (isH(r)||isN(r))?String(a||""):shortG(a); }
  var HS="https://hashscan.io/mainnet/";
  function reqTxUrl(r,which){
    if(isH(r)){ var t=which==="refund"?r.refundTxId:r.txId; return t?(HS+"transaction/"+encodeURIComponent(t)):""; }
    var h=which==="refund"?r.refundHash:r.txHash;
    if(isX(r))return h?("https://xrpscan.com/tx/"+encodeURIComponent(String(h).toUpperCase())):"";
    if(isN(r))return h?("https://nearblocks.io/txns/"+encodeURIComponent(h)):"";
    return "https://stellar.expert/explorer/public/tx/"+encodeURIComponent(h);
  }
  function reqIssuerUrl(r){
    if(isH(r))return HS+"token/"+encodeURIComponent(r.issuer);
    if(isX(r))return "https://xrpscan.com/account/"+encodeURIComponent(r.issuer);
    if(isN(r))return "https://nearblocks.io/address/"+encodeURIComponent(r.issuer);
    return "https://stellar.expert/explorer/public/account/"+encodeURIComponent(r.issuer);
  }
  function reqWhen(t){ if(!t)return "—"; var d=new Date(+t);
    return d.toLocaleDateString(undefined,{day:"numeric",month:"short"})+", "+d.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"}); }

  // The explanatory note above the table belongs to the tab, not to the page. Captured on first use so
  // switching back restores exactly the text the assets tabs shipped with.
  var NOTE0=null;
  var NOTE_REQ="Applications from the public List your token page. Each one is already paid for — the "
    + "payment is verified against the ledger before a request is stored, so nothing here arrived free. "
    + "Approving curates the asset immediately, which also gives it the tick; it reaches the public site "
    + "at the next publish. Declining does not send the money back: the row then shows a refund owed, "
    + "and Refund pays it from the wallet connected here, to the account that actually paid. "
    + "Hedera requests are paid in HBAR: approve once the token is vouched in the Hedera build and deployed, "
    + "and send a refund from HashPack or Kabila, then record it here by its transaction id. "
    + "XRP Ledger and NEAR requests work the same way: paid in XRP or NEAR, approved once the token is on that "
    + "network's curated list on the live site, refunded from Xaman or a NEAR wallet and recorded here by its hash.";
  function setNote(){
    var n=q(".lxadm-note"); if(!n)return;
    if(NOTE0===null)NOTE0=n.textContent;
    setT(n, MODE==="requests"?NOTE_REQ:(isNet()?NOTE_NET:NOTE0));
  }

  // ---- XRPL and NEAR curated lists, view only (D04) ------------------------------------------------
  // Read from the live site's own endpoints, so this shows exactly what the public Trade tables list. Prices
  // arrive in XRP / NEAR and are turned into USD with the same answer's own XRP / NEAR price.
  var NET={xrpl:null,near:null};
  var NOTE_NET="View only. These are the tokens the live site lists on the XRP Ledger and on NEAR, read from the public Trade "
    +"tables. XRPL’s list is the vouched list in the XRPL build and NEAR’s is built into the NEAR build, so adding or removing one "
    +"is a site release, not a change made here. Volume and liquidity are each token’s whole market, not only LumosCore’s trades.";
  function netLoad(m){
    if(NET[m]&&(NET[m].rows||NET[m].loading))return;
    NET[m]={loading:1};
    // XRPL's 24h change is against XRP (RLUSD read +7.38% on a day XRP fell 7.12%), so XRP's own move is read too
    // and the column shows the change in dollars. NEAR's rows already carry a dollar change (USDC reads 0).
    function gj(u){ return fetch(u).then(function(r){ return r.ok?r.json():null; }).catch(function(){ return null; }); }
    Promise.all([gj("https://lumoscore.com/lxapi/"+(m==="xrpl"?"xrpltokens":"nearmarket")), m==="xrpl"?gj("https://lumoscore.com/lxapi/xrpltoken?id=XRP"):null, gj("/lxapi/netcurated?net="+m)])
      .then(function(z){ var d=z[0], b=z[1];
        if(!d||!d.ok||!Array.isArray(d.rows))NET[m]={err:"the live site did not answer"};
        else NET[m]={rows:d.rows.filter(function(x){ return !!x.vf; }), usd:(+d.usd>0?+d.usd:null), stale:!!d.stale, extra:(z[2]&&z[2].ok&&Array.isArray(z[2].rows))?z[2].rows:[],
          base24:(m==="xrpl"?((b&&b.ok&&isFinite(+b.p24))?+b.p24:null):0)};
        tabs(); if(MODE===m){ render(); kpis(); } })
      .catch(function(){ NET[m]={err:"the live site did not answer"}; tabs(); if(MODE===m){ render(); kpis(); } });
  }
  function netName(){ return MODE==="xrpl"?"XRPL":"NEAR"; }
  function netUsd(r,x){ var N=NET[MODE]; return (x!=null&&N&&N.usd)?(+x)*N.usd:null; }
  function netKpis(){
    setNote();
    var N=NET[MODE]||{}, L=N.rows||[], priced=0, vol=0, liq=0;
    L.forEach(function(r){ if(netUsd(r,r.p)>0)priced++; vol+=netUsd(r,r.v)||0; liq+=netUsd(r,r.t)||0; });
    var cards=qa(".kpi-grid .kpi"), wait=!N.rows;
    function set(i,label,val,foot){ var c=cards[i]; if(!c)return;
      var l=c.querySelector(".kpi-label"); if(l)setT(l,label);
      setT(c.querySelector(".kpi-value"),val);
      var f=c.querySelector(".kpi-foot"); if(f){ f.innerHTML=""; f.textContent=foot; } }
    set(0,"Curated on "+netName(),wait?(N.err?"—":"…"):String(L.length),"listed on the live site · view only");
    set(1,"Priced",wait?(N.err?"—":"…"):String(priced),"have a market price now");
    set(2,"24h volume",wait?(N.err?"—":"…"):usd(vol),"all markets, not only LumosCore");
    set(3,"Liquidity",wait?(N.err?"—":"…"):usd(liq),MODE==="near"?"each token’s main pair":"across their markets");
    fixPager(L.length);
    var sub=q(".admin-page-sub"); if(sub)sub.textContent="Curated tokens on "+(MODE==="xrpl"?"the XRP Ledger":"NEAR")+", read from the live site";
  }
  // TOKENS ADDED FROM ADMIN (/lxapi/netcurated) get a remove button; built-in ones are changed in code.
  function ncTk(c){ c=String(c||""); if(/^[0-9A-F]{40}$/i.test(c)){ var s=""; for(var i=0;i<40;i+=2){ var x=parseInt(c.substr(i,2),16); if(!x)break; s+=String.fromCharCode(x); } return s.toUpperCase(); } return c.toUpperCase(); }
  function ncRm(m,r,sym){ var N=NET[m], X=(N&&N.extra)||[], id=m==="xrpl"?(String(r.i)+"|"+ncTk(r.c)):String(r.i);
    if(!X.some(function(x){ return (m==="xrpl"?(x.issuer+"|"+x.ticker):x.i)===id; }))return "";
    return "<button class='row-act-btn' type='button' title='Added from admin. Remove it from the curated list' data-lxncrm='"+esc(m+"~"+id)+"' data-lxncn='"+esc(sym)+"'>×</button>"; }
  if(!document.__lxncrm){ document.__lxncrm=1; document.addEventListener("click",function(e){ var t=e.target&&e.target.closest&&e.target.closest("[data-lxncrm]"); if(!t)return;
    e.preventDefault(); e.stopPropagation(); var v=t.getAttribute("data-lxncrm"), k=v.indexOf("~"), n=v.slice(0,k), id=v.slice(k+1);
    if(!confirm("Remove "+(t.getAttribute("data-lxncn")||id)+" from the curated list? Trade stops listing it within a few minutes."))return;
    t.disabled=true;
    fetch("/lxapi/netcurated",{method:"POST",credentials:"include",headers:{"content-type":"application/json"},body:JSON.stringify({op:"remove",net:n,id:id})})
      .then(function(r){ return r.json(); }).then(function(z){ if(!z||!z.ok){ t.disabled=false; alert((z&&z.error)||"Could not remove it."); return; } NET[n]=null; render(); netLoad(n); })
      .catch(function(){ t.disabled=false; alert("Could not remove it."); }); },true); }
  function netRender(){
    var m=MODE, N=NET[m];
    if(!N||N.loading){ tb.innerHTML="<tr><td colspan='7' class='lxadm-empty'>Reading the "+netName()+" curated list from the live site…</td></tr>"; return; }
    if(N.err){ tb.innerHTML="<tr><td colspan='7' class='lxadm-empty'>Could not read the "+netName()+" list: "+esc(N.err)+". Switch tabs to try again.</td></tr>"; NET[m]=null; return; }
    var qy=((q(".fs-search input")||{}).value||"").trim().toLowerCase();
    var L=N.rows.filter(function(r){ return !qy||(String(r.n||"")+" "+String(r.nm||"")+" "+String(r.i||"")+" "+String(r.u||r.o||"")).toLowerCase().indexOf(qy)>=0; });
    if(!L.length){ tb.innerHTML="<tr><td colspan='7' class='lxadm-empty'>"+(N.rows.length?"No token matches that search.":"The live site lists no curated tokens here.")+"</td></tr>"; return; }
    function gray(t){ return "<span style='color:var(--text-muted)'>"+t+"</span>"; }
    tb.innerHTML=L.map(function(r){
      var sym=String(r.n||"?"), id=String(r.i||""), fb=avatar(sym);
      var logo=m==="xrpl"?(r.m?("https://lumoscore.com/lxapi/xrplthumb?id="+encodeURIComponent(r.m)):fb):(r.logo||fb);
      var who=m==="xrpl"?(r.u||r.o||""):(r.nm&&r.nm!==sym?r.nm:"");
      var idShort=id.length>24?shortG(id):id;
      var ex=m==="xrpl"?("https://xrpscan.com/account/"+encodeURIComponent(id)):("https://nearblocks.io/token/"+encodeURIComponent(id));
      var pub=m==="xrpl"?("https://lumoscore.com/trade/xrpl/"+encodeURIComponent(sym+"-"+id)):("https://lumoscore.com/trade/near/"+encodeURIComponent(id));
      var px=netUsd(r,r.p), vv=netUsd(r,r.v), tt=netUsd(r,r.t);
      // The change in dollars: the token's move against XRP / NEAR combined with that coin's own move.
      var ch=(r.d==null||N.base24==null)?null:((1+(+r.d)/100)*(1+N.base24/100)-1)*100;
      return "<tr>"
        +"<td><div class='asset-cell'><img class='lxa-ico' data-lxc='"+esc(sym)+"' alt='' src='"+esc(logo)+"' data-fb='"+esc(fb)+"' onerror='this.onerror=null;this.src=this.getAttribute(&quot;data-fb&quot;)'>"
        +"<div><div class='asset-name'>"+esc(sym)+(who?(" <span style='font-weight:500;color:var(--text-muted);font-size:13.5px'>"+esc(who)+"</span>"):"")+"</div>"
        +"<div class='asset-sub mono'>"+netName()+(r.st?" · stablecoin":"")+"</div></div></div></td>"
        +"<td class='mono' title='"+esc(id)+"'>"+esc(idShort)+"</td>"
        +"<td class='num-cell' style='text-align:right'>"+(px>0?esc(usd(px)):gray("—"))+"</td>"
        +"<td style='text-align:right'>"+pct(ch)+"</td>"
        +"<td class='num-cell' style='text-align:right'>"+(vv>0?esc(usd(vv)):gray("—"))+"</td>"
        +"<td class='num-cell' style='text-align:right'>"+(tt>0?esc(usd(tt)):gray("—"))+"</td>"
        +"<td style='text-align:right'><span class='row-act'>"
        +"<a class='ext-link' title='Open the public trade page' target='_blank' rel='noopener' href='"+esc(pub)+"'>"+EXTICON+"</a>"
        +"<a class='ext-link' title='The token on the "+netName()+" explorer' target='_blank' rel='noopener' href='"+esc(ex)+"'>"+EXTICON+"</a>"
        +ncRm(m,r,sym)+"</span></td></tr>"; }).join("");
  }

  function reqKpis(){
    setNote();
    var L=LR||[], pend=0, owedBy={}, owedN=0, done=0;
    L.forEach(function(r){
      if(r.status==="pending")pend++;
      // Per asset: XLM and HBAR owed are not one number.
      if(r.status==="rejected"){ owedBy[reqUnit(r)]=(owedBy[reqUnit(r)]||0)+(+r.payAmount||0); owedN++; }
      if(r.status==="approved")done++;
    });
    var owedTxt=Object.keys(owedBy).filter(function(u){ return owedBy[u]>0; }).map(function(u){
      return owedBy[u].toLocaleString(undefined,{maximumFractionDigits:2})+" "+u; }).join(" + ");
    var cards=qa(".kpi-grid .kpi");
    function set(i,label,val,foot){ var c=cards[i]; if(!c)return;
      var l=c.querySelector(".kpi-label"); if(l)setT(l,label);
      setT(c.querySelector(".kpi-value"),val);
      var f=c.querySelector(".kpi-foot"); if(f){ f.innerHTML=""; f.textContent=foot; } }
    set(0,"Awaiting review",LR===null?"…":String(pend),"paid and queued");
    set(1,"Approved",LR===null?"…":String(done),"now curated");
    // Money we are holding that is not ours. It reads as a debt on purpose.
    set(2,"Refunds owed",LR===null?"…":String(owedN),"declined, not yet paid back");
    set(3,"Owed back",LR===null?"…":(owedTxt||"none"),"to the accounts that paid");
    fixPager((LR||[]).length);
    var sub=q(".admin-page-sub"); if(sub)sub.textContent="Paid applications for a curated listing";
  }

  function reqRender(){
    if(LR===null){ tb.innerHTML="<tr><td colspan='6' class='lxadm-empty'>Loading the queue…</td></tr>"; return; }
    var qy=((q(".fs-search input")||{}).value||"").trim().toLowerCase();
    var L=LR.filter(function(r){ return !qy || (r.code+" "+r.issuer+" "+r.payer+" "+r.descr).toLowerCase().indexOf(qy)>=0; });
    if(!L.length){ tb.innerHTML="<tr><td colspan='6' class='lxadm-empty'>"
      +(LR.length?"No request matches that search.":"No listing requests yet. They arrive from the public List your token page.")+"</td></tr>"; return; }
    tb.innerHTML=L.map(function(r){
      var st=REQ_ST[r.status]||{t:r.status,c:"var(--text-muted)"};
      var act="";
      if(r.status==="pending"){
        act="<button class='lxreq-btn go' type='button' title='Curate this asset and approve the request' data-lxap='"+esc(r.id)+"'>Approve</button>"
           +"<button class='lxreq-btn' type='button' title='Decline with a reason' data-lxrj='"+esc(r.id)+"'>Decline</button>";
      } else if(r.status==="rejected"&&isExt(r)){
        // No HBAR / XRP / NEAR signer here: the refund is sent from that network's wallet, then recorded and checked.
        act="<button class='lxreq-btn go' type='button' title='Send "+esc(reqAmt(r))+" to "+esc(r.payer)+" from a "+esc(netName(r))+" wallet, then record it' data-lxrh='"+esc(r.id)+"'>Record refund</button>"
           +"<button class='lxreq-btn' type='button' title='Put this back in the queue' data-lxro='"+esc(r.id)+"'>Reopen</button>";
      } else if(r.status==="rejected"){
        act="<button class='lxreq-btn go' type='button' title='Send "+esc(reqAmt(r))+" back to the account that paid' data-lxrf='"+esc(r.id)+"'>Refund</button>"
           +"<button class='lxreq-btn' type='button' title='Record a refund you sent from elsewhere' data-lxrh='"+esc(r.id)+"'>Have the hash</button>"
           +"<button class='lxreq-btn' type='button' title='Put this back in the queue' data-lxro='"+esc(r.id)+"'>Reopen</button>";
      } else if(r.status==="approved"){
        act="<button class='lxreq-btn' type='button' title='Put this back in the queue' data-lxro='"+esc(r.id)+"'>Reopen</button>";
      } else {
        act=reqTxUrl(r,"refund")?("<a class='ext-link' title='The refund transaction' target='_blank' rel='noopener' href='"+esc(reqTxUrl(r,"refund"))+"'>"+EXTICON+"</a>"):"";
      }
      var img=r.logo?("<img class='lxa-ico' data-lxc='"+esc(r.code)+"' alt='' src='"+esc(r.logo)+"'>")
                    :("<img class='lxa-ico' data-lxc='"+esc(r.code)+"' alt='' src='"+esc(avatar(r.code))+"'>");
      return "<tr>"
        +"<td><div class='asset-cell'>"+img
          +"<div><div class='asset-name'>"+esc(r.code)+(r.curated?tickFor(r.asset):"")+"</div>"
          // Truncated with a copy button rather than printed in full: 56 characters would dominate the
          // row, and what you actually do with an issuer is paste it somewhere.
          +"<div class='asset-sub mono'>"+(isExt(r)?(netName(r)+" · "):"")+esc(reqShort(r,r.issuer))
            +"<button class='lxreq-copy' type='button' title='"+((isH(r)||isN(r))?"Copy the token id":"Copy the issuing account")+"' data-lxcp='"+esc(r.issuer)+"'>"+COPYICON+"</button>"
            +"<a class='ext-link' title='The token on the "+esc(netName(r))+" explorer' target='_blank' rel='noopener' href='"
              +esc(reqIssuerUrl(r))+"'>"+EXTICON+"</a>"
          +"</div>"
          // The WHOLE description, not the first 120 characters. This is the review screen; deciding
          // whether a project describes itself honestly cannot be done from an ellipsis.
          +"<div class='lxreq-note' style='min-width:260px;max-width:360px'>"+esc(r.descr)+"</div>"
          +reqLinks(r)
        +"</div></div></td>"
        +"<td><span class='mono' title='"+esc(r.payer)+"'>"+esc(reqShort(r,r.payer))+"</span>"
          +(reqTxUrl(r,"pay")?(" <a class='ext-link' title='The payment' target='_blank' rel='noopener' href='"+esc(reqTxUrl(r,"pay"))+"'>"+EXTICON+"</a>"):"")+"</td>"
        +"<td class='num-cell' style='text-align:right'>"+esc(reqAmt(r))+"</td>"
        +"<td style='text-align:right'>"+esc(reqWhen(r.createdAt))+"</td>"
        +"<td style='text-align:right'><span style='color:"+st.c+";font-weight:600'>"+esc(st.t)+"</span>"
          +(r.note?("<div class='lxreq-note' style='max-width:240px;margin-left:auto'>"+esc(r.note)+"</div>"):"")+"</td>"
        +"<td style='text-align:right'><span class='row-act'>"+act+"</span></td>"
      +"</tr>";
    }).join("");
    qa("[data-lxap]").forEach(function(b){ if(b.__lx)return; b.__lx=1;
      b.addEventListener("click",function(){ reqApprove(b.getAttribute("data-lxap"),b); }); });
    qa("[data-lxrj]").forEach(function(b){ if(b.__lx)return; b.__lx=1;
      b.addEventListener("click",function(){ reqReject(b.getAttribute("data-lxrj")); }); });
    qa("[data-lxrf]").forEach(function(b){ if(b.__lx)return; b.__lx=1;
      b.addEventListener("click",function(){ reqRefund(b.getAttribute("data-lxrf"),b); }); });
    qa("[data-lxrh]").forEach(function(b){ if(b.__lx)return; b.__lx=1;
      b.addEventListener("click",function(){ reqRefundHash(b.getAttribute("data-lxrh")); }); });
    qa("[data-lxro]").forEach(function(b){ if(b.__lx)return; b.__lx=1;
      b.addEventListener("click",function(){ reqAct(b.getAttribute("data-lxro"),{action:"reopen"}); }); });
    qa("[data-lxcp]").forEach(function(b){ if(b.__lx)return; b.__lx=1;
      b.addEventListener("click",function(e){ e.stopPropagation();
        var v=b.getAttribute("data-lxcp"), done=function(){ b.classList.add("ok");
          setTimeout(function(){ b.classList.remove("ok"); },1400); };
        // execCommand is the fallback, not the fashion: navigator.clipboard needs a secure context and
        // a permission that a panel opened from a hash URL does not always have.
        if(navigator.clipboard&&navigator.clipboard.writeText){
          navigator.clipboard.writeText(v).then(done,function(){ legacyCopy(v); done(); });
        } else { legacyCopy(v); done(); } }); });
  }
  function legacyCopy(v){
    try{ var t=document.createElement("textarea"); t.value=v;
      t.style.cssText="position:fixed;left:-9999px;top:0"; document.body.appendChild(t);
      t.select(); document.execCommand("copy"); t.remove(); }catch(_){}
  }

  function reqById(id){ return (LR||[]).filter(function(r){ return r.id===id; })[0]; }

  // Every decision goes through here, so the queue is re-read from the server afterwards rather than
  // patched locally: the row on screen then reflects what was actually stored.
  function reqAct(id,body){
    body.id=id;
    return fetch("/lxapi/listingadmin",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)})
      .then(function(r){ return r.json().then(function(d){ return {ok:r.ok,d:d}; }); })
      .then(function(z){ if(!z.ok||!z.d.ok)throw new Error((z.d&&z.d.error)||"That did not save."); return reqLoad().then(function(){ return z.d; }); });
  }

  function reqApprove(id,btn){
    var r=reqById(id); if(!r)return;
    // Hedera: curation lives in the Hedera build (a vouch, a rebuild, a deploy), not in assetmeta, so
    // this only records the decision -- and the endpoint refuses until the token is on that list.
    if(isExt(r)){
      if(!confirm("Approve "+r.code+" ("+r.issuer+")? It must already be on the "+netName(r)+" curated list on the live site, or this is refused."))return;
      btn.disabled=true; btn.textContent="Recording…";
      reqAct(id,{action:"approve"})
        .then(function(){ alert(r.code+" ("+r.issuer+") is approved."); })
        .catch(function(e){ btn.disabled=false; btn.textContent="Approve"; alert(e.message); });
      return;
    }
    if(!confirm("Approve "+r.code+"? It is curated immediately, carries the tick, and appears on the public site at the next publish."))return;
    btn.disabled=true; btn.textContent="Curating…";
    // Description and logo travel with the approval, so the asset arrives on the public site wearing
    // what the applicant sent rather than an empty record someone has to fill in later.
    var body={asset:r.asset};
    if(r.descr)body.description=r.descr;
    if(r.logo)body.image=r.logo;
    // The links travel with the approval too, so an approved asset lands on the public site already
    // wearing them rather than waiting for someone to retype what the applicant already gave us.
    if(r.website)body.website=r.website;
    if(r.twitter)body.twitter=r.twitter;
    if(r.telegram)body.telegram=r.telegram;
    if(r.discord)body.discord=r.discord;
    fetch("/lxapi/assetmeta",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(body)})
      .then(function(rr){ return rr.json().then(function(bb){ return {ok:rr.ok,b:bb}; }); })
      .then(function(z){
        if(!z.ok)throw new Error((z.b&&(z.b.error||z.b.message))||"Could not curate that asset.");
        if(z.b&&z.b.verified)VER[r.asset]=z.b.verified;
        if(!CUR.some(function(a){ return a.code===r.code&&a.iss===r.issuer; })){
          CUR.push({code:r.code,iss:r.issuer});
          try{ localStorage.setItem(AKEY,JSON.stringify(CUR)); }catch(_){}
        }
        btn.textContent="Recording…";
        return reqAct(id,{action:"approve"});
      })
      .then(function(){ alert(r.code+" is curated and the request is approved. It reaches the public site at the next publish (node _tools/_syncverified.js, then deploy)."); })
      .catch(function(e){ btn.disabled=false; btn.textContent="Approve"; alert(e.message); });
  }

  function reqReject(id){
    var r=reqById(id); if(!r||q(".lxmodal"))return;
    var m=document.createElement("div"); m.className="lxmodal";
    m.innerHTML="<div class='lxmodal-box'><h3 class='lxmodal-t'>Decline "+esc(r.code)+"</h3>"
      +"<p class='lxmodal-s'>The reason is what the applicant is told, so write it for them. Declining does not send the money back — the row then shows a refund owed, and the Refund button pays it from your connected wallet.</p>"
      +"<label class='lxmodal-l' for='lxrjWhy'>Reason</label>"
      +"<textarea class='lxmodal-i' id='lxrjWhy' rows='3' maxlength='300' placeholder='No home domain set, so the handshake cannot resolve.'></textarea>"
      +"<p class='lxmodal-e' id='lxrjErr'></p>"
      +"<div class='lxmodal-a'><button class='adm-btn ghost' type='button' id='lxrjCancel'>Cancel</button>"
      +"<button class='adm-btn primary' type='button' id='lxrjOk'>Decline</button></div></div>";
    document.body.appendChild(m);
    var ta=m.querySelector("#lxrjWhy"), er=m.querySelector("#lxrjErr"), ok=m.querySelector("#lxrjOk");
    ta.focus();
    function close(){ m.remove(); }
    m.addEventListener("click",function(e){ if(e.target===m)close(); });
    m.querySelector("#lxrjCancel").addEventListener("click",close);
    ok.addEventListener("click",function(){
      var why=(ta.value||"").trim();
      if(why.length<8){ er.textContent="Give a real reason — they are told it verbatim."; return; }
      ok.disabled=true; ok.textContent="Saving…";
      reqAct(id,{action:"reject",note:why}).then(close)
        .catch(function(e){ ok.disabled=false; ok.textContent="Decline"; er.textContent=e.message; });
    });
  }

  // The refund is a payment from whichever wallet is connected here, back to the account that paid,
  // for the exact amount it paid. The address comes from the stored PAYMENT, never from anything the
  // applicant typed, so a decline can never be steered to a stranger.
  function reqRefund(id,btn){
    var r=reqById(id); if(!r)return;
    var addr=""; try{ addr=localStorage.getItem("lumos.address")||""; }catch(_){}
    if(addr.charAt(0)!=="G"){
      if(window.lxwOpenWallet){ window.lxwOpenWallet("stellar"); alert("Connect the wallet you want to refund from, then press Refund again."); }
      else alert("Connect a Stellar wallet first.");
      return;
    }
    if(!confirm("Send "+reqAmt(r)+" back to "+shortG(r.payer)+" from "+shortG(addr)+"?"))return;
    btn.disabled=true; btn.textContent="Building…";
    var PASS="Public Global Stellar Network ; September 2015", S;
    lxLpSdk().then(function(sdk){
      S=sdk;
      return fetch(H+"/accounts/"+addr).then(function(x){ if(!x.ok)throw new Error("Could not read your account."); return x.json(); });
    }).then(function(acct){
      var tb2=new S.TransactionBuilder(new S.Account(addr,acct.sequence),{fee:"3000",networkPassphrase:PASS})
        .addOperation(S.Operation.payment({destination:r.payer,asset:S.Asset.native(),amount:String(r.payAmount)}))
        .addMemo(S.Memo.text("LumosCore refund"))
        .setTimeout(180).build();
      btn.textContent="Sign…";
      return lxLpSignXdr(tb2.toXDR(),addr);
    }).then(function(signed){
      btn.textContent="Sending…";
      return fetch(H+"/transactions",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"tx="+encodeURIComponent(signed)})
        .then(function(x){ return x.json(); });
    }).then(function(res){
      if(!res.successful){
        var rc=res.extras&&res.extras.result_codes;
        throw new Error("The refund did not go through: "+(rc?JSON.stringify(rc):(res.detail||"unknown error")));
      }
      btn.textContent="Recording…";
      // Checked against the ledger server-side before the row closes, so a refund we did not make
      // cannot mark one as paid.
      return reqAct(id,{action:"refund",refundHash:res.hash});
    }).catch(function(e){
      btn.disabled=false; btn.textContent="Refund";
      alert(e.message+"— if the payment DID leave your wallet, use Have the hash to record it.");
    });
  }

  // The escape hatch for a refund sent from a phone, a hardware wallet or anywhere else. Still verified
  // on-chain before it is accepted.
  function reqRefundHash(id){
    var r=reqById(id); if(!r||q(".lxmodal"))return;
    if(isH(r))return reqRefundHedera(r);
    if(isX(r)||isN(r))return reqRefundOther(r);
    var m=document.createElement("div"); m.className="lxmodal";
    m.innerHTML="<div class='lxmodal-box'><h3 class='lxmodal-t'>Record a refund</h3>"
      +"<p class='lxmodal-s'>For a refund sent from somewhere else. We check the ledger: it has to be an XLM payment to "+esc(shortG(r.payer))+" of at least "+esc(reqAmt(r))+", or it is not accepted.</p>"
      +"<label class='lxmodal-l' for='lxrhTx'>Transaction hash</label><input class='lxmodal-i' id='lxrhTx' placeholder='64 hex characters' maxlength='64'>"
      +"<p class='lxmodal-e' id='lxrhErr'></p>"
      +"<div class='lxmodal-a'><button class='adm-btn ghost' type='button' id='lxrhCancel'>Cancel</button>"
      +"<button class='adm-btn primary' type='button' id='lxrhOk'>Check and record</button></div></div>";
    document.body.appendChild(m);
    var inp=m.querySelector("#lxrhTx"), er=m.querySelector("#lxrhErr"), ok=m.querySelector("#lxrhOk");
    inp.focus();
    function close(){ m.remove(); }
    m.addEventListener("click",function(e){ if(e.target===m)close(); });
    m.querySelector("#lxrhCancel").addEventListener("click",close);
    ok.addEventListener("click",function(){
      var h=(inp.value||"").trim().toLowerCase();
      if(!/^[0-9a-f]{64}$/.test(h)){ er.textContent="That is not a transaction hash."; return; }
      ok.disabled=true; ok.textContent="Checking…";
      reqAct(id,{action:"refund",refundHash:h}).then(close)
        .catch(function(e){ ok.disabled=false; ok.textContent="Check and record"; er.textContent=e.message; });
    });
  }

  // A Hedera refund: sent from HashPack or Kabila, then recorded by transaction id. Checked on the
  // Mirror Node server-side (an HBAR credit to the payer of at least what was taken) before it closes.
  function reqRefundHedera(r){
    var m=document.createElement("div"); m.className="lxmodal";
    m.innerHTML="<div class='lxmodal-box'><h3 class='lxmodal-t'>Record the HBAR refund</h3>"
      +"<p class='lxmodal-s'>Send "+esc(reqAmt(r))+" to "+esc(r.payer)+" from HashPack or Kabila (memo: LumosCore refund), then paste its transaction id. We check Hedera: it has to be an HBAR payment to "+esc(r.payer)+" of at least "+esc(reqAmt(r))+", or it is not accepted.</p>"
      +"<label class='lxmodal-l' for='lxrhTx'>Transaction id</label><input class='lxmodal-i' id='lxrhTx' placeholder='0.0.1234@1760000000.123456789' maxlength='120'>"
      +"<p class='lxmodal-e' id='lxrhErr'></p>"
      +"<div class='lxmodal-a'><button class='adm-btn ghost' type='button' id='lxrhCancel'>Cancel</button>"
      +"<button class='adm-btn primary' type='button' id='lxrhOk'>Check and record</button></div></div>";
    document.body.appendChild(m);
    var inp=m.querySelector("#lxrhTx"), er=m.querySelector("#lxrhErr"), ok=m.querySelector("#lxrhOk");
    inp.focus();
    function close(){ m.remove(); }
    m.addEventListener("click",function(e){ if(e.target===m)close(); });
    m.querySelector("#lxrhCancel").addEventListener("click",close);
    ok.addEventListener("click",function(){
      // A HashScan link is accepted too: its last path segment is the id.
      var h=(inp.value||"").trim().split("/").pop().split("?")[0];
      if(!/^0[.]0[.][0-9]+[@-][0-9]+[.-][0-9]+$/.test(h)&&!/^[0-9a-fA-F]{96}$/.test(h)){ er.textContent="That is not a Hedera transaction id."; return; }
      ok.disabled=true; ok.textContent="Checking…";
      reqAct(r.id,{action:"refund",refundTxId:h}).then(close)
        .catch(function(e){ ok.disabled=false; ok.textContent="Check and record"; er.textContent=e.message; });
    });
  }

  // An XRP Ledger or NEAR refund: sent from Xaman / a NEAR wallet, then recorded by hash. Checked on that
  // ledger server-side (a payment to the payer of at least what was taken) before the row closes. NEAR
  // finds a transaction by hash AND sender, so it asks for the account the refund was sent from too.
  // No backslashes in this block (template literal).
  function reqRefundOther(r){
    var near=isN(r);
    var m=document.createElement("div"); m.className="lxmodal";
    m.innerHTML="<div class='lxmodal-box'><h3 class='lxmodal-t'>Record the "+esc(reqUnit(r))+" refund</h3>"
      +"<p class='lxmodal-s'>Send "+esc(reqAmt(r))+" to "+esc(r.payer)+" from "+(near?"a NEAR wallet":"Xaman or another XRP Ledger wallet")
      +", then paste the transaction hash. We check the ledger: it has to be a "+esc(reqUnit(r))+" payment to that account of at least "+esc(reqAmt(r))+", or it is not accepted.</p>"
      +"<label class='lxmodal-l' for='lxrhTx'>Transaction hash</label><input class='lxmodal-i' id='lxrhTx' placeholder='"+(near?"The NEAR transaction hash":"64 hex characters")+"' maxlength='120'>"
      +(near?"<label class='lxmodal-l' for='lxrhFrom'>Sent from (NEAR account)</label><input class='lxmodal-i' id='lxrhFrom' placeholder='fees-lumoscore.near' maxlength='64'>":"")
      +"<p class='lxmodal-e' id='lxrhErr'></p>"
      +"<div class='lxmodal-a'><button class='adm-btn ghost' type='button' id='lxrhCancel'>Cancel</button>"
      +"<button class='adm-btn primary' type='button' id='lxrhOk'>Check and record</button></div></div>";
    document.body.appendChild(m);
    var inp=m.querySelector("#lxrhTx"), from=m.querySelector("#lxrhFrom"), er=m.querySelector("#lxrhErr"), ok=m.querySelector("#lxrhOk");
    inp.focus();
    function close(){ m.remove(); }
    m.addEventListener("click",function(e){ if(e.target===m)close(); });
    m.querySelector("#lxrhCancel").addEventListener("click",close);
    ok.addEventListener("click",function(){
      // An explorer link is accepted too: its last path segment is the hash.
      var h=(inp.value||"").trim().split("/").pop().split("?")[0].split("#")[0];
      var body={action:"refund",refundHash:h};
      if(near){
        if(!/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(h)){ er.textContent="That is not a NEAR transaction hash."; return; }
        var f=((from&&from.value)||"").trim().toLowerCase();
        if(!/^[a-z0-9._-]{2,64}$/.test(f)){ er.textContent="Give the NEAR account the refund was sent from."; return; }
        body.refundSigner=f;
      } else if(!/^[0-9a-fA-F]{64}$/.test(h)){ er.textContent="That is not an XRP Ledger transaction hash."; return; }
      ok.disabled=true; ok.textContent="Checking…";
      reqAct(r.id,body).then(close)
        .catch(function(e){ ok.disabled=false; ok.textContent="Check and record"; er.textContent=e.message; });
    });
  }

  function render(){ if(!tb)return;
    setHead();
    if(MODE==="requests")return reqRender();
    if(isNet())return netRender();
    var qy=((q(".fs-search input")||{}).value||"").trim().toLowerCase();
    var LI=rows().filter(function(a){ return !qy || (a.code+" "+a.iss+" "+((DATA[key(a)]||{}).domain||"")).toLowerCase().indexOf(qy)>=0; });
    // Sorted on the FILTERED copy, never on rows() itself. The curated array is the saved order and
    // gets written back to KV by the Sort dropdown's own handler -- reordering it from a column click
    // would silently persist a view preference as the list's real order.
    if(COL)LI.sort(bySort); else if(volSortOn())LI.sort(byVol);
    if(!LI.length){ tb.innerHTML="<tr><td colspan='"+TH.length+"' class='lxadm-empty'>"+(rows().length?"No asset matches that search.":"Nothing here yet.")+"</td></tr>"; return; }
    tb.innerHTML=LI.map(function(a){ var k=key(a), v=DATA[k], xa=isXA(k);
      // undefined means still looking; null means the lookup came back with nothing. Both used to
      // render an ellipsis, so a failed lookup sat there pretending to still be loading forever.
      var pend=(v===undefined), gone=(v===null);
      function cell(x){ return pend?"…":(gone?"<span style='color:var(--text-muted)'>—</span>":x); }
      return "<tr>"
        +"<td><div class='asset-cell'><img class='lxa-ico' data-lxc='"+esc(a.code)+"' alt='' src='"+esc(logoFor(a,k))+"'>"
        +"<div><div class='asset-name'>"+esc(a.code)+tickFor(k)+((v&&v.name&&v.name!==a.code)?" <span style='font-weight:500;color:var(--text-muted);font-size:13.5px'>"+esc(v.name)+"</span>":"")+"</div>"
        // The ledger is named beside the issuer. Two chains in one table, and a G-address next to an
        // r-address is only obvious to someone who already knows which is which.
        +"<div class='asset-sub mono'>"+esc(shortG(a.iss))+"<span style='opacity:.55;font-size:11px;margin-left:6px;font-family:inherit'>"+(xa?"XRPL":(isNA(k)?"NEAR":"Stellar"))+"</span></div></div></div></td>"
        +"<td>"+cell(v&&v.domain?("<a class='lxadm-link' target='_blank' rel='noopener' href='https://"+esc(v.domain)+"'>"+esc(v.domain)+"</a>"):"<span style='color:var(--text-muted)'>no home domain</span>")+"</td>"
        +"<td class='num-cell' style='text-align:right'>"+cell(v&&v.price?esc(usd(v.price)):"<span style='color:var(--text-muted)'>—</span>")+"</td>"
        +"<td style='text-align:right'>"+cell(pct(v&&v.d1))+"</td>"
        +"<td style='text-align:right'>"+cell(pct(v&&v.d7))+"</td>"
        +"<td class='num-cell' style='text-align:right'>"+volCell(k,"d1")+"</td>"
        +"<td class='num-cell' style='text-align:right'>"+volCell(k,"d7")+"</td>"
        +"<td class='num-cell' style='text-align:right'>"+volCell(k,"d30")+"</td>"
        +"<td class='num-cell' style='text-align:right'>"+cell(v?esc(num(v.trust)):"")+"</td>"
        +"<td style='text-align:right'><span class='row-act'>"
        // ABSOLUTE, AND CHAIN-CORRECT. This was a relative link to lumoscore-dex-asset.html, a page
        // the admin build does not contain -- so it 404'd on the admin origin for every row, on both
        // chains. The public site serves these at /trade/<chain>/<asset>, both verified 200.
        +"<a class='ext-link' title='Open the public asset page' target='_blank' rel='noopener' href='https://lumoscore.com/trade/"+(xa?"xrpl":(isNA(k)?"near":"stellar"))+"/"+encodeURIComponent(isNA(k)?a.iss:k)+"'>"+EXTICON+"</a>"
        +"<button class='row-act-btn' type='button' title='Edit description, logo and links' data-lxed='"+esc(k)+"'>✎</button>"
        // A mint is a record of what was issued, not a curation choice, and there is nowhere to
        // persist its removal -- it would simply reappear on the next load. So the tab does not
        // offer a button that cannot keep its promise.
        +(MODE==="mints"?("<button class='row-act-btn' type='button' title='Minter payout wallet — gets 30–70% of LumosCore’s fee on this token, by its volume' data-lxmint='"+esc(isNA(k)?a.iss:k)+"' data-lxmnet='"+(xa?"xrpl":(isNA(k)?"near":"stellar"))+"'>$</button>"):("<button class='row-act-btn' type='button' title='Remove from the curated list' data-lxrm='"+esc(k)+"'>×</button>"))
        +"</span></td></tr>"; }).join("");
    qa("[data-lxrm]").forEach(function(b){ if(b.__lx)return; b.__lx=1;
      b.addEventListener("click",function(){ var k=b.getAttribute("data-lxrm");
        if(!confirm("Remove "+k.split("-")[0]+" from the "+(MODE==="mints"?"mints":"curated")+" list?\\n\\nIt stops being listed on LumosCore. Its description, logo and links are kept, so re-adding it restores them."))return;
        if(MODE==="mints")MINTS=MINTS.filter(function(a){ return key(a)!==k; });
        else { CUR=CUR.filter(function(a){ return key(a)!==k; }); aSave(CUR); }
        tabs(); render(); kpis(); }); });
    qa("[data-lxmint]").forEach(function(b){ if(b.__lx)return; b.__lx=1;
      b.addEventListener("click",function(){ minterEdit(b.getAttribute("data-lxmint"),b.getAttribute("data-lxmnet")); }); });
    qa("[data-lxed]").forEach(function(b){ if(b.__lx)return; b.__lx=1;
      b.addEventListener("click",function(){ editAsset(b.getAttribute("data-lxed")); }); }); }

  function load(a){ var k=key(a); if(DATA[k]!==undefined)return;
    (isNA(k)?nInfo:(isXA(k)?xInfo:aInfo))(a.code,a.iss,function(v){ DATA[k]=v; soonRender(); }); }
  var _lxSoon=0; function soonRender(){ if(_lxSoon)return; _lxSoon=setTimeout(function(){ _lxSoon=0; render(); kpis(); },60); }

  // Our own trades, over three windows, from the ledger the Revenue page already reconstructs.
  function loadLxVol(){ return loadVolume().then(function(V){
    var now=Date.now(), D=86400000, m={};
    (V&&V.rows||[]).forEach(function(r){ if(!r.code||!r.gross)return;
      var k=r.code+"-"+r.iss, age=now-r.t;
      m[k]=m[k]||{d1:{amt:0,n:0},d7:{amt:0,n:0},d30:{amt:0,n:0}};
      if(age<=D){ m[k].d1.amt+=r.gross; m[k].d1.n++; }
      if(age<=7*D){ m[k].d7.amt+=r.gross; m[k].d7.n++; }
      if(age<=30*D){ m[k].d30.amt+=r.gross; m[k].d30.n++; } });
    LXV=m; render(); kpis();
    Object.keys(m).forEach(function(k){ var a=parse(k);
      priceUsd(a.code,a.iss,function(px){ PXA[k]=(px==null?null:px); soonRender(); }); });
    return m; }).catch(function(){ LXV={}; render(); kpis(); return LXV; }); }

  var PAINTED=false;
  function first(){ if(PAINTED)return; PAINTED=true; tabs(); render(); kpis(); rows().forEach(load); }
  setTimeout(function(){ first(); },2500);

  j("/lxapi/assetmeta").then(function(d){
    VER=(d&&d.verified)||{};
    var names=(d&&d.list)||[];
    if(names.length){ CUR=names.map(parse); ASRV=true; try{ localStorage.setItem(AKEY,JSON.stringify(CUR)); }catch(_){} }
    else { CUR=aList(); ASRV=false; }
    MINTS=((d&&d.mints)||[]).map(parse);
    MM=(d&&d.mintmeta)||{};
    PAINTED=true; tabs(); render(); kpis(); rows().forEach(load);
    // Exposed for paintVouch, which has to know whether a withdrawal will STICK: a curated tick on a
    // launchpad mint stays gone, a curated tick on anything else is re-granted on the next read.
    window.__lxVER=VER; window.__lxMINTIDS=((d&&d.mints)||[]).slice();
    window.__lxRefresh=function(){ try{ render(); kpis(); }catch(_){} };
    loadLxVol();
  }).catch(function(){ CUR=aList(); first(); });

  // Fetched on load rather than on the first click, so the chip carries a real waiting count from the
  // moment the page settles -- an unreviewed application is the one thing here nobody should have to
  // go looking for.
  reqLoad();
  // D04: the XRPL and NEAR counts are read on load too, so their chips are not "…" until clicked.
  netLoad("xrpl"); netLoad("near");

  var si=q(".fs-search input"); if(si){ si.placeholder="Search by code, issuer or domain…"; si.addEventListener("input",render); }
  qa(".filter-strip .fs-select").forEach(function(sel,i){
    if(i===0){ sel.innerHTML="<option>Sort: LumosCore volume</option><option>Sort: Trustlines</option><option>Sort: Code</option>";
      // The dropdown reorders the stored list, so it has to win outright -- otherwise a column sort
      // left active would keep overriding it and the dropdown would look broken.
      sel.addEventListener("change",function(){ COL=null; var mm=sel.selectedIndex; var LI=rows();
        LI.sort(function(x,y){ var a=DATA[key(x)]||{}, b=DATA[key(y)]||{};
          if(mm===1)return (b.trust||0)-(a.trust||0);
          if(mm===2)return x.code.localeCompare(y.code);
          return byVol(x,y); var xa=0, xb=0;
          return xb-xa; });
        if(MODE==="curated")aSave(CUR); render(); }); }
    else sel.remove(); });
  var more=qa(".filter-strip .adm-btn").filter(function(b){return /more/i.test(b.textContent);})[0]; if(more)more.remove();

  // ---- share card for a newly curated asset -----------------------------------------------------
  //
  // The two scripts and the font are about 150KB and only matter when an asset is actually added,
  // so they are fetched on demand rather than shipped on every admin page. They are served from
  // THIS origin -- _ogkit.js emits them into dist-admin as well as dist -- because reading the font
  // as an ArrayBuffer cross-origin would need CORS the public site does not send.
  function lxAdmLoad(src){
    return new Promise(function(res,rej){
      if(document.querySelector("script[data-lxog='"+src+"']"))return res();
      var s=document.createElement("script"); s.src=src; s.async=true; s.setAttribute("data-lxog",src);
      s.onload=function(){res();}; s.onerror=function(){rej(new Error("load "+src));};
      document.head.appendChild(s);
    });
  }
  function lxAdmPublishCard(kk, code, domain){
    return lxAdmLoad("/assets/js/lx-ogkit.js")
      .then(function(){ return lxAdmLoad("/assets/js/lx-ogcardgen.js"); })
      .then(function(){
        if(!window.LXOGCard)return null;
        return window.LXOGCard.publish({
          asset:kk, code:code, chain:"Stellar",
          // An admin adding an asset IS the curation, so this badge is earned here -- unlike a
          // launchpad mint, which says "Minted on LumosCore" because minting is not vetting.
          badge:"Curated asset", domain:domain||"",
          logo:"/lxapi/logoimg?asset="+encodeURIComponent(kk), kind:"curated"
        });
      })
      .catch(function(){ return null; });
  }

  qa(".admin-page-actions .adm-btn").forEach(function(b){
    if(/export/i.test(b.textContent)&&!b.__lx){ b.__lx=1; b.addEventListener("click",function(){
      var hd="list,code,issuer,domain,price_usd,change_24h,change_7d,vol_24h_usd,vol_7d_usd,vol_30d_usd,trades_7d,verified,trustlines\\n";
      var bd=rows().map(function(a){ var k=key(a), v=DATA[k]||{}, vr=VER[k]||null, px=PXA[k];
        function u(w){ var r=win(k,w); return (r&&r.amt&&px!=null)?Math.round(r.amt*px*100)/100:0; }
        var r7=win(k,"d7");
        return [MODE,a.code,a.iss,v.domain||"",v.price||"",v.d1==null?"":v.d1.toFixed(4),v.d7==null?"":v.d7.toFixed(4),
          u("d1"),u("d7"),u("d30"),r7?r7.n:0,(vr&&vr.v)?vr.s:"no",v.trust||""].join(","); }).join("\\n");
      var bl=new Blob([hd+bd],{type:"text/csv"}), uu=URL.createObjectURL(bl);
      var el=document.createElement("a"); el.href=uu; el.download="lumoscore-"+MODE+".csv"; el.click();
      setTimeout(function(){URL.revokeObjectURL(uu);},1000); }); }
    if(!/add asset/i.test(b.textContent)||b.__lxa)return; b.__lxa=1;
    b.addEventListener("click",function(){
      if(q(".lxmodal"))return;
      var m=document.createElement("div"); m.className="lxmodal";
      m.innerHTML="<div class='lxmodal-box'><h3 class='lxmodal-t'>Add asset</h3>"
        +"<label class='lxmodal-l' for='lxaNet'>Network</label><select class='lxmodal-i' id='lxaNet'><option value='stellar'>Stellar</option><option value='xrpl'>XRPL</option><option value='near'>NEAR</option></select>"
        +"<p class='lxmodal-s' id='lxaHelp'>A ticker is not an identity on Stellar — hundreds of assets share the code USDC, so give the issuer too. We check the asset exists, then ask its issuer’s own domain to vouch for it. Logo, description and links come next, prefilled from whatever it publishes.</p>"
        +"<div id='lxaF1'><label class='lxmodal-l' for='lxaCode' id='lxaCodeL'>Asset code</label><input class='lxmodal-i' id='lxaCode' placeholder='USDC' maxlength='12'></div>"
        +"<label class='lxmodal-l' for='lxaIss' id='lxaIssL'>Issuer account</label><input class='lxmodal-i' id='lxaIss' placeholder='G…' maxlength='56'>"
        +"<p class='lxmodal-e' id='lxaErr'></p>"
        +"<div class='lxmodal-a'><button class='adm-btn ghost' type='button' id='lxaCancel'>Cancel</button>"
        +"<button class='adm-btn primary' type='button' id='lxaOk'>Verify &amp; add</button></div></div>";
      document.body.appendChild(m);
      var ci=m.querySelector("#lxaCode"), ii=m.querySelector("#lxaIss"), er=m.querySelector("#lxaErr");
      ci.focus();
      // NETWORK (RAZA 2026-11-24: "when we add asset, why isnt it showing the network selection"). Stellar keeps the
      // flow below; XRPL and NEAR go to /lxapi/netcurated, which checks the token on its network and lists it.
      var ni=m.querySelector("#lxaNet"), HELP0=m.querySelector("#lxaHelp").textContent;
      function setNet(n){ var h=m.querySelector("#lxaHelp"), f1=m.querySelector("#lxaF1"), il=m.querySelector("#lxaIssL"), cl=m.querySelector("#lxaCodeL"); er.textContent=""; er.style.color="";
        if(n==="near"){ f1.style.display="none"; il.textContent="Token contract"; ii.placeholder="token.near"; ii.maxLength=64;
          h.textContent="A NEAR token is its contract. We read its name, symbol, decimals and logo from the contract; it is then ticked and listed on Trade within a few minutes."; return; }
        f1.style.display=""; il.textContent="Issuer account";
        if(n==="xrpl"){ cl.textContent="Token code"; ci.placeholder="SOLO"; ci.maxLength=40; ii.placeholder="r…"; ii.maxLength=35;
          h.textContent="A ticker is not an identity on the XRP Ledger either, so give the issuer too. We check the token exists; it is then ticked and listed on Trade within a few minutes."; return; }
        cl.textContent="Asset code"; ci.placeholder="USDC"; ci.maxLength=12; ii.placeholder="G…"; ii.maxLength=56; h.textContent=HELP0; }
      ni.value=(MODE==="xrpl"||MODE==="near")?MODE:"stellar"; setNet(ni.value);
      ni.addEventListener("change",function(){ setNet(ni.value); (ni.value==="near"?ii:ci).focus(); });
      function ncAdd(n){ var ok=m.querySelector("#lxaOk"), body={op:"add",net:n};
        if(n==="xrpl"){ body.code=(ci.value||"").trim(); body.issuer=(ii.value||"").trim();
          if(!body.code){ er.textContent="Enter the token code, e.g. SOLO."; return; }
          if(!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(body.issuer)){ er.textContent="The issuer must be an XRPL account starting with r."; return; } }
        else { body.contract=(ii.value||"").trim().toLowerCase(); if(!body.contract){ er.textContent="Enter the token contract, e.g. token.near."; return; }
          var NN=NET.near; if(NN&&NN.rows&&NN.rows.some(function(r){ return String(r.i)===body.contract; })){ er.textContent="That token is already curated."; return; } }
        ok.disabled=true; ok.textContent="Checking…"; er.textContent=""; er.style.color="";
        fetch("/lxapi/netcurated",{method:"POST",credentials:"include",headers:{"content-type":"application/json"},body:JSON.stringify(body)})
          .then(function(r){ return r.json().catch(function(){ return {ok:false,error:"The server answered "+r.status+"."}; }); })
          .then(function(z){ if(!z||!z.ok){ ok.disabled=false; ok.textContent="Verify & add"; er.textContent=(z&&z.error)||"Could not add."; return; }
            er.style.color="var(--green,#22c55e)"; er.textContent="Added "+((z.row&&(z.row.s||z.row.ticker))||"it")+". Trade lists it within a few minutes.";
            NET[n]=null; setTimeout(function(){ close(); MODE=n; tabs(); render(); kpis(); netLoad(n); },1400); })
          .catch(function(e){ ok.disabled=false; ok.textContent="Verify & add"; er.textContent=e.message; }); }
      function close(){ m.remove(); }
      m.addEventListener("click",function(e){ if(e.target===m)close(); });
      m.querySelector("#lxaCancel").addEventListener("click",close);
      m.querySelector("#lxaOk").addEventListener("click",function(){
        if(ni.value!=="stellar"){ ncAdd(ni.value); return; }
        var code=(ci.value||"").trim(), iss=(ii.value||"").trim().toUpperCase();
        if(!/^[A-Za-z0-9]{1,12}$/.test(code)){ er.textContent="Asset code must be 1–12 letters or digits."; return; }
        if(!/^G[A-Z2-7]{55}$/.test(iss)){ er.textContent="Issuer must be a 56-character Stellar account starting with G."; return; }
        if(CUR.some(function(a){ return a.code===code&&a.iss===iss; })){ er.textContent="That asset is already curated."; return; }
        var ok=m.querySelector("#lxaOk"); ok.disabled=true; ok.textContent="Checking…";
        j(H+"/assets?asset_code="+encodeURIComponent(code)+"&asset_issuer="+encodeURIComponent(iss)+"&limit=1").then(function(d){
          var r=d&&d._embedded&&d._embedded.records&&d._embedded.records[0];
          if(!r){ ok.disabled=false; ok.textContent="Verify & add"; er.textContent="No such asset on Stellar mainnet. Check the code and issuer."; return; }
          var kk=code+"-"+iss;
          ok.textContent="Verifying…";
          // The single-asset route, deliberately: the whole-list save runs no handshake, so an asset
          // added that way would sit there permanently unverified.
          fetch("/lxapi/assetmeta",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({asset:kk})})
            .then(function(rr){ return rr.json().then(function(bb){ return {ok:rr.ok,b:bb}; }); })
            .then(function(z){ ok.disabled=false; ok.textContent="Verify & add";
              if(!z.ok){ er.textContent=(z.b&&(z.b.error||z.b.message))||"Could not add."; return; }
              if(z.b&&z.b.verified)VER[kk]=z.b.verified;
              // Draw this asset's share card now, in this browser.
              //
              // A card can only be rasterised at build time -- satori plus a wasm rasteriser is far
              // over the Worker bundle cap and CPU budget -- and there is no CI or cron here to
              // redraw one out of band, so a freshly curated asset would preview as the generic
              // trade card until the next publish. The browser can rasterise, and it draws through
              // lx-ogkit.js, which IS _tools/_ogkit.js: the same renderer the build uses, so the two
              // cannot drift. FIRE AND FORGET -- the asset is curated either way, and a failure here
              // must never look like the add failed.
              try{ lxAdmPublishCard(kk, code, (z.b&&z.b.verified&&z.b.verified.d)||""); }catch(_){}
              CUR.push({code:code,iss:iss}); DATA[kk]=undefined;
              try{ localStorage.setItem(AKEY,JSON.stringify(CUR)); }catch(_){}
              MODE="curated"; close(); tabs(); render(); kpis(); load({code:code,iss:iss});
              editAsset(kk);
              // Says where it is and is not yet. The curated list lives in KV and the public site is
              // BUILT from it, so an asset is live here the moment it is added and live on Trade only
              // after the next publish. Leaving that unsaid is why an asset was reported missing from
              // Trade twice -- it was curated correctly both times and simply had not been published.
              setTimeout(function(){ var s=document.querySelector("#lxeSrc");
                if(s)s.textContent="Curated and verified. It shows on the public site after the next publish (node _tools/_syncverified.js, then deploy). "+s.textContent; },900); })
            .catch(function(e){ ok.disabled=false; ok.textContent="Verify & add"; er.textContent=e.message; });
        }); }); }); });
}
`
+'function mobNote(txt){ var head=pageHead(); if(!head||q(".lxadm-note"))return;'
+'  var d=document.createElement("div"); d.className="lxadm-note"; d.textContent=txt;'
+'  head.parentNode.insertBefore(d, head.nextSibling); }'
+'function mobKpis(defs){ var g=q(".mob-kpi-grid"); if(!g)return;'
+'  g.innerHTML=defs.map(function(d){ return "<div class=\\"mob-kpi\\"><div class=\\"mob-kpi-head\\"><span class=\\"mob-kpi-label\\">"+esc(d[1])+"</span></div>"'
+'    +"<div class=\\"mob-kpi-value\\" id=\\""+d[0]+"\\">\u2014</div><div class=\\"mob-kpi-foot\\" id=\\""+d[0]+"F\\">"+esc(d[2])+"</div></div>"; }).join(""); }'
+'function paintMobile(){ if(!isMob())return; var t=pageTitle();'
+'  if(/^Dashboard/.test(t)){'
+'    var g=q(".mob-kpi-grid"); if(!g||g.getAttribute("data-lxbuilt")==="1")return; g.setAttribute("data-lxbuilt","1");'
+'    mobKpis([["lxmRevM","This month","fees collected"],["lxmRevA","All time","since first fee"],'
+'      ["lxmUsers","Total users","wallets that paid"],["lxmTx","Fee payments","on-chain receipts"],'
+'      ["lxmTvl","Pool TVL","5 curated pools"],["lxmAct","Actives","needs analytics"]]);'
+'    loadRevenue().then(function(rv){ var w={}; rv.rows.forEach(function(p){ w[p.from]=1; });'
+'      setT(q("#lxmUsers"), num(Object.keys(w).length)); setT(q("#lxmTx"), num(rv.rows.length));'
+'      var now=new Date(), mS=new Date(now.getFullYear(),now.getMonth(),1).getTime();'
// The chain is in the key and the price comes from priceUsdOn, as on the desktop: this tile used the
// Stellar-only priceUsd, so XRP and every NEAR token went to stellar.expert and silently priced to
// nothing. And, as on the desktop, no total while a chain is missing.
+'      var byA={}; rv.rows.forEach(function(p){ var a=assetOf(p), ch=p.chain||"stellar", k=ch+":"+a.code+"|"+a.iss;'
+'        byA[k]=byA[k]||{chain:ch,code:a.code,iss:a.iss,amt:0,month:0}; byA[k].amt+=+p.amount||0;'
+'        if(Date.parse(p.created_at)>=mS)byA[k].month+=+p.amount||0; });'
+'      if(!allRead()){ setT(q("#lxmRevM"),"\\u2014"); setT(q("#lxmRevA"),"\\u2014"); setT(q("#lxmRevAF"),"a chain could not be read in full"); return; }'
+'      var ks=Object.keys(byA), pend=ks.length, all=0, mon=0;'
+'      if(!pend){ setT(q("#lxmRevM"),usd(0)); setT(q("#lxmRevA"),usd(0)); return; }'
+'      ks.forEach(function(k){ var a=byA[k]; priceUsdOn(a.chain,a.code,a.iss,function(px){'
+'        if(px!=null){ all+=a.amt*px; mon+=a.month*px; }'
+'        if(--pend===0){ setT(q("#lxmRevA"),usd(all)); setT(q("#lxmRevM"),usd(mon)); } }); }); });'
+'    loadPools().then(function(ps){ var x=0; ps.forEach(function(p){ x+=p.xlm; });'
+'      priceUsd("XLM","",function(px){ setT(q("#lxmTvl"), px?usd(x*px):num(x)+" XLM"); }); });'
// everything below the KPI grid on the mobile dashboard is design filler with no source
+'    qa(".mob-main .adm-card, .mob-main .mob-card").forEach(function(c){ c.remove(); });'
+'    mobNote("Figures above are read from the chain. The charts and activity feed the design showed here had no data source, so they have been removed rather than filled with invented numbers \u2014 the desktop dashboard has the full breakdown.");'
+'    return; }'
+'  if(/^Users/.test(t)){'
+'    var cards=qa(".mob-user-card"); if(!cards.length)return;'
+'    var host=cards[0].parentNode, anchor=cards[0];'
+'    cards.forEach(function(c){ c.remove(); });'
+'    var box=document.createElement("div"); box.id="lxmList"; host.insertBefore(box,anchor.nextSibling||null);'
+'    box.innerHTML="<div class=\\"lxadm-empty\\">Loading\u2026</div>";'
+'    var seg=q(".mob-seg-row"); if(seg)seg.innerHTML="<button class=\\"mob-seg-chip active\\" type=\\"button\\"><span class=\\"sc-label\\">All wallets</span><span class=\\"sc-count\\" id=\\"lxmAll\\">\u2014</span></button>";'
+'    qa(".mob-page-actions .adm-btn").forEach(function(b){ if(/invite/i.test(b.textContent)){ b.disabled=true; b.style.opacity="0.5"; } });'
+'    mobNote("LumosCore has no sign-up, so there is no user table. A user here is a wallet that has paid a platform fee on-chain \u2014 the only record that someone used the app.");'
+'    var msi=q(".mob-filter-bar input"); if(msi)msi.placeholder="Search by wallet address…";'
+'    loadRevenue().then(function(rv){ var w={};'
+'      rv.rows.forEach(function(p){ var a=assetOf(p), u=w[p.from]=w[p.from]||{addr:p.from,chain:(p.chain||"stellar"),n:0,codes:{},last:p.created_at};'
+'        u.n++; u.codes[a.code]=1; if(Date.parse(p.created_at)>Date.parse(u.last))u.last=p.created_at; });'
+'      var list=Object.keys(w).map(function(k){return w[k];}).sort(function(x,y){return y.n-x.n;});'
+'      setT(q("#lxmAll"),String(list.length)); fixPager(list.length);'
+'      var sub=q(".mob-page-sub"); if(sub)sub.innerHTML="<span class=\\"mono\\">"+list.length+"</span> fee-paying wallets";'
+'      if(!list.length){ box.innerHTML="<div class=\\"lxadm-empty\\">No wallet has paid a fee yet.</div>"; return; }'
// The mobile list is a SEPARATE painter from the desktop table, so the chain fixes have to be made
// twice. It listed XRPL wallets the moment loadRevenue gained them -- captioned "Stellar mainnet",
// and each one linking to a profile page that can only read Horizon.
// A NEAR wallet goes to NearBlocks for the same reason an XRPL one goes to bithomp.
+'      box.innerHTML=list.map(function(u){ var xr=(u.chain==="xrpl"||u.chain==="near");'
+'        return "<a class=\\"lxm-card\\""+(xr?" target=\\"_blank\\" rel=\\"noopener\\"":"")+" href=\\""+(xr?esc(exAcct(u.chain,u.addr)):("lumoscore-admin-user-profile-mobile.html?w="+esc(u.addr)))+"\\">"'
+'          +"<div class=\\"lxm-top\\"><img class=\\"lxm-av\\" data-lxc=\\"wallet\\" alt=\\"\\" src=\\""+avatar(u.addr.slice(1,3))+"\\">"'
+'          +"<div><div class=\\"lxm-name mono\\">"+esc(shortA(u.chain,u.addr))+"</div><div class=\\"lxm-sub\\">"+chainName(u.chain)+" mainnet</div></div></div>"'
+'          +"<div class=\\"lxm-stats\\"><div><div class=\\"lxm-sl\\">Fee payments</div><div class=\\"lxm-sv\\">"+u.n+"</div></div>"'
+'          +"<div><div class=\\"lxm-sl\\">Paid in</div><div class=\\"lxm-sv\\">"+esc(Object.keys(u.codes).join(", "))+"</div></div>"'
+'          +"<div><div class=\\"lxm-sl\\">Last seen</div><div class=\\"lxm-sv\\">"+esc(ago(u.last))+"</div></div></div></a>"; }).join(""); });'
+'    return; }'
+'  if(/^Assets/.test(t)){'
+'    var ac=qa(".mob-user-card"); if(!ac.length)return;'
+'    var ah=ac[0].parentNode, aa=ac[0]; ac.forEach(function(c){ c.remove(); });'
+'    var abox=document.createElement("div"); abox.id="lxmAList"; ah.insertBefore(abox,aa.nextSibling||null);'
+'    abox.innerHTML="<div class=\\"lxadm-empty\\">Loading\u2026</div>";'
+'    mobKpis([["lxmaN","Listed","in your list"],["lxmaV","LumosCore 7d vol","traded with us"]]);'
+'    mobNote("The curated list and the launchpad mints are stored on the server. A tick means the asset’s own issuer vouches for it. Volume is what has traded on LumosCore, not the whole market, on either chain.");'
// TWO TABS, AND THE SERVER'S LIST. This read aList() -- the DESKTOP's localStorage cache -- so on a
// phone it showed whatever a desktop had last looked at, never the mints, and nothing from the XRP
// Ledger. Both lists live on the server; this asks for them and falls back to the cache only when
// that fails, which is exactly what it did before.
+'    var maseg=q(".mob-seg-row");'
+'    var mai=q(".mob-filter-bar input"); if(mai)mai.placeholder="Search by code or issuer\u2026";'
+'    var MCUR=[], MMINT=[], MMODE="curated", MMM={}, D={}, LXV=null;'
+'    function mrows(){ return MMODE==="mints"?MMINT:MCUR; }'
+'    function mseg(){ if(!maseg)return;'
+'      maseg.innerHTML="<button class=\\"mob-seg-chip"+(MMODE==="curated"?" active":"")+"\\" type=\\"button\\" data-lxmt=\\"curated\\"><span class=\\"sc-label\\">Listed</span><span class=\\"sc-count\\">"+MCUR.length+"</span></button>"'
+'        +"<button class=\\"mob-seg-chip"+(MMODE==="mints"?" active":"")+"\\" type=\\"button\\" data-lxmt=\\"mints\\"><span class=\\"sc-label\\">Mints</span><span class=\\"sc-count\\">"+MMINT.length+"</span></button>";'
+'      qa("[data-lxmt]").forEach(function(b){ if(b.__lx)return; b.__lx=1;'
+'        b.addEventListener("click",function(){ MMODE=b.getAttribute("data-lxmt"); mseg(); head(); draw(); mrows().forEach(mload); }); }); }'
+'    function head(){ var L=mrows();'
+'      setT(q("#lxmaN"),String(L.length)); fixPager(L.length);'
+'      var sub2=q(".mob-page-sub"); if(sub2)sub2.innerHTML="<span class=\\"mono\\">"+L.length+"</span> "+(MMODE==="mints"?"tokens issued through our launchpad":"listed assets"); }'
+'    function mload(a){ var k=a.code+"-"+a.iss; if(D[k]!==undefined)return;'
+'      (isNA(k)?nInfo:(isXA(k)?xInfo:aInfo))(a.code,a.iss,function(v){ D[k]=v; draw(); }); }'
+'    function draw(){ var L=mrows();'
+'      if(!L.length){ abox.innerHTML="<div class=\\"lxadm-empty\\">"+(MMODE==="mints"?"No token has been issued through the launchpad yet.":"Nothing listed yet.")+"</div>"; return; }'
+'      abox.innerHTML=L.map(function(a){ var k=a.code+"-"+a.iss, v=D[k], ld=(v===undefined), xa=isXA(k);'
// An XRPL mint's artwork comes from mintmeta, because /lxapi/assetlogo resolves a Stellar toml.
+'      var img=((xa||isNA(k))?((MMM[k]&&MMM[k].image)||""):((v&&v.img)||""))||avatar(a.code);'
// Absolute and chain-correct, for the same reason as the desktop table: lumoscore-dex-asset-mobile.html
// is not in the admin build, so this link 404'd on every card.
+'      return "<a class=\\"lxm-card\\" target=\\"_blank\\" rel=\\"noopener\\" href=\\"https://lumoscore.com/trade/"+(xa?"xrpl":(isNA(k)?"near":"stellar"))+"/"+encodeURIComponent(isNA(k)?a.iss:k)+"\\">"'
+'        +"<div class=\\"lxm-top\\"><img class=\\"lxm-av\\" data-lxc=\\""+esc(a.code)+"\\" alt=\\"\\" src=\\""+esc(img)+"\\">"'
+'        +"<div><div class=\\"lxm-name\\">"+esc(a.code)+"<span style=\\"opacity:.55;font-size:11px;margin-left:6px;font-weight:500\\">"+(xa?"XRPL":(isNA(k)?"NEAR":"Stellar"))+"</span></div>"'
+'        +"<div class=\\"lxm-sub\\">"+(ld?"\u2026":esc((v&&v.domain)||"no home domain"))+"</div></div>"'
+'        +"<div class=\\"lxm-right\\">"+(ld?"\u2026":((v&&v.price)?esc(usd(v.price)):"\u2014"))+"</div></div>"'
+'        +"<div class=\\"lxm-stats\\"><div><div class=\\"lxm-sl\\">24h</div><div class=\\"lxm-sv\\">"+(ld?"\u2026":pct(v&&v.d1))+"</div></div>"'
+'        +"<div><div class=\\"lxm-sl\\">LumosCore 7d</div><div class=\\"lxm-sv\\">"+(LXV===null?"\u2026":(function(){ var r=LXV[k]; return r&&r.amt?esc(num(Math.round(r.amt*100)/100)):"0"; })())+"</div></div>"'
+'        +"<div><div class=\\"lxm-sl\\">Trustlines</div><div class=\\"lxm-sv\\">"+(ld?"\u2026":((v&&v.trust!=null)?esc(num(v.trust)):"\u2014"))+"</div></div></div></a>"; }).join(""); }'
+'    function mstart(){ mseg(); head(); draw(); mrows().forEach(mload); }'
+'    j("/lxapi/assetmeta").then(function(d){'
+'      var names=(d&&d.list)||[];'
+'      MCUR=names.length?names.map(parse):aList();'
+'      MMINT=((d&&d.mints)||[]).map(parse);'
+'      MMM=(d&&d.mintmeta)||{};'
+'      mstart(); }).catch(function(){ MCUR=aList(); mstart(); });'
+'    loadVolume().then(function(V){ var since=Date.now()-7*86400000, m={};'
+'      (V&&V.rows||[]).forEach(function(r){ if(!r.code||!r.gross||r.t<since)return;'
+'        var k=r.code+"-"+r.iss; m[k]=m[k]||{amt:0,n:0}; m[k].amt+=r.gross; m[k].n++; });'
+'      LXV=m; draw();'
+'      var ks=Object.keys(m).filter(function(k){ return m[k].amt>0; });'
+'      if(!ks.length){ setT(q("#lxmaV"),usd(0)); return; }'
+'      var tot=0,pend=ks.length;'
+'      ks.forEach(function(k){ var i=k.lastIndexOf("-"); priceUsd(k.slice(0,i),k.slice(i+1),function(px){'
+'        if(px!=null)tot+=m[k].amt*px; if(--pend===0)setT(q("#lxmaV"),usd(tot)); }); });'
+'    }).catch(function(){ LXV={}; draw(); });'
+'    return; }'
+'}'
+'function profWallet(){ try{ return (new URLSearchParams(location.search)).get("w")||""; }catch(_){ return ""; } }'
+'function paintProfile(){'
+'  var hero=q(".up-hero")||q(".mob-up-hero"); if(!hero||hero.getAttribute("data-lxbuilt")==="1")return;'
+'  hero.setAttribute("data-lxbuilt","1");'
+'  var mob=!!q(".mob-up-hero");'
+'  var usersHref=mob?"lumoscore-admin-users-mobile.html":"lumoscore-admin-users.html";'
+'  var addr=profWallet();'
// disable everything that would need a server to mean anything
+'  qa(".up-actions .adm-btn, .mob-up-actions .adm-btn, .admin-page-actions .adm-btn").forEach(function(b){'
+'    if(/add note/i.test(b.textContent))return; b.remove(); return; /* D05: removed, not disabled: these can never work */'
+'    b.disabled=true; b.style.opacity="0.5"; b.style.cursor="not-allowed";'
+'    b.title="Needs a backend \u2014 LumosCore cannot suspend, message or grant from a static site."; });'
+'  var name=q(".up-name")||q(".mob-up-name");'
+'  var mail=q(".up-email")||q(".mob-up-email");'
+'  var chips=q(".up-wallets")||q(".mob-up-wallets");'
+'  var av=q(".up-av-lg")||q(".mob-up-av");'
// An XRP Ledger address reaches this page only by a typed or saved URL -- both lists route r-addresses
// to bithomp. It still has to answer honestly: this profile reads Horizon balances and a Stellar fee
// history, so it cannot describe an r-address. "No wallet selected" would be a lie about a wallet that
// was selected, and a page of dashes reads as broken rather than inapplicable.
+'  var isX=/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(addr);'
+'  if(!/^G[A-Z2-7]{55}$/.test(addr)){'
+'    if(name)name.textContent=isX?"XRP Ledger wallet":"No wallet selected";'
+'    if(mail)mail.innerHTML=isX'
+'      ?("This profile reads Stellar mainnet, so it cannot describe an XRP Ledger wallet. <a class=\\"lxadm-link\\" target=\\"_blank\\" rel=\\"noopener\\" href=\\"https://bithomp.com/explorer/"+encodeURIComponent(addr)+"\\">Open "+esc(shortG(addr))+" on bithomp</a> \\u00b7 <a class=\\"lxadm-link\\" href=\\""+usersHref+"\\">Back to Users</a>")'
+'      :("Open this page from the Users list to inspect a wallet. <a class=\\"lxadm-link\\" href=\\""+usersHref+"\\">Back to Users</a>");'
+'    if(chips)chips.innerHTML="";'
+'    if(av){ av.textContent=""; av.style.background="var(--surface-2)"; }'
+'    qa(".up-mini-card, .mob-up-mini-card").forEach(function(c){'
+'      var v=c.querySelector(".up-mini-val")||c.querySelector(".mob-up-mini-val"); if(v)setT(v,"\u2014");'
+'      var f=c.querySelector(".up-mini-foot")||c.querySelector(".mob-up-mini-foot"); if(f){ f.innerHTML=""; f.textContent=""; } });'
+'    qa(".up-tabs, .mob-up-tabs, .pagination, .adm-card-head .fs-select, .mob-card-head .fs-select").forEach(function(t){ t.remove(); }); /* D05: design leftovers */ qa(".adm-card-body, .mob-card-body, .act-feed").forEach(function(b){'
+'      if(b.querySelector("textarea"))return;'
+'      b.innerHTML="<div class=\\"lxadm-empty\\">No wallet selected.</div>"; });'
+'    return; }'
// ---- hero ----
+'  if(av){ av.textContent=""; av.style.cssText="background:transparent "+cssUrl(avatar(addr.slice(1,3)))+" center/cover no-repeat;border-radius:50%"; }'
+'  if(name)name.innerHTML="<span class=\\"mono\\">"+esc(shortG(addr))+"</span>";'
+'  if(mail)mail.innerHTML="Stellar mainnet wallet \u00b7 <a class=\\"lxadm-link\\" target=\\"_blank\\" rel=\\"noopener\\" href=\\"https://stellar.expert/explorer/public/account/"+esc(addr)+"\\">view on stellar.expert</a>";'
+'  if(chips)chips.innerHTML="<span class=\\""+(mob?"mob-up-wallet-chip":"up-wallet-chip")+"\\">"+esc(addr)+"</span>";'
+'  var head=pageHead();'
+'  if(head&&!q(".lxadm-note")){ var nt=document.createElement("div"); nt.className="lxadm-note";'
+'    nt.textContent="LumosCore has no accounts, so this is a wallet profile, not a person. Holdings and activity below are read from Stellar mainnet. There is no name, email, tier or risk score to show \u2014 those would need an account system behind the app.";'
+'    head.parentNode.insertBefore(nt, head.nextSibling); }'
// ---- mini stats ----
+'  var minis=qa(".up-mini-card, .mob-up-mini-card");'
+'  var DEF=[["Fees paid","to LumosCore"],["Fee payments","swaps + deposits"],["XLM balance","native"],["Assets held","trustlines"]];'
+'  minis.forEach(function(c,i){ var d=DEF[i]; if(!d){ c.remove(); return; }'
+'    var l=c.querySelector(".up-mini-label")||c.querySelector(".mob-up-mini-label"); if(l)setT(l,d[0]);'
+'    var v=c.querySelector(".up-mini-val")||c.querySelector(".mob-up-mini-val"); if(v){ v.id="lxpM"+i; setT(v,"\u2026"); }'
+'    var f=c.querySelector(".up-mini-foot")||c.querySelector(".mob-up-mini-foot"); if(f){ f.innerHTML=""; f.textContent=d[1]; } });'
+'  loadRevenue().then(function(rv){'
+'    var mine=rv.rows.filter(function(p){ return p.from===addr; });'
+'    setT(q("#lxpM1"), num(mine.length));'
+'    var by={}; mine.forEach(function(p){ var a=assetOf(p), k=a.code+"-"+a.iss;'
+'      by[k]=by[k]||{code:a.code,iss:a.iss,amt:0}; by[k].amt+=+p.amount||0; });'
+'    var ks=Object.keys(by), pend=ks.length, tot=0;'
+'    if(!pend)setT(q("#lxpM0"), usd(0));'
+'    else ks.forEach(function(k){ var a=by[k]; priceUsd(a.code,a.iss,function(px){'
+'      if(px!=null)tot+=a.amt*px; if(--pend===0)setT(q("#lxpM0"), usd(tot)); }); });'
+'    var act=cardByTitle("Recent activity"); var _rs=act&&act.querySelector(".adm-card-head .fs-select, .mob-card-head .fs-select"); if(_rs)_rs.remove(); /* D05: never wired */'
+'    if(act){ var ab=act.querySelector(".adm-card-body")||act.querySelector(".mob-card-body")||act.querySelector(".act-feed");'
+'      if(ab){ ab.removeAttribute("style"); ab.style.padding="0";'
+'        ab.innerHTML = mine.length ? mine.slice(0,10).map(function(p){ var a=assetOf(p);'
+'          return "<a class=\\"lxwal-row\\" target=\\"_blank\\" rel=\\"noopener\\" href=\\"https://stellar.expert/explorer/public/tx/"+esc(p.transaction_hash)+"\\">"'
+'            +"<div class=\\"lxwal-meta\\"><div class=\\"lxwal-addr\\">Paid "+esc(num(+p.amount))+" "+esc(a.code)+" in platform fees</div>"'
+'            +"<div class=\\"lxwal-sub\\">"+esc(new Date(p.created_at).toLocaleString())+"</div></div>"'
+'            +"<div class=\\"lxwal-val\\">"+esc(ago(p.created_at))+"</div></a>"; }).join("")'
+'          : "<div class=\\"lxadm-empty\\">This wallet has not paid a platform fee. Only fee payments are visible to LumosCore \u2014 the rest of its on-chain history is on the explorer.</div>";'
+'        fixPager(mine.length); } }'
+'  });'
// ---- holdings, priced ----
+'  accountOf(addr).then(function(d){'
+'    var hold=cardByTitle("Top holdings");'
+'    var hb=hold&&(hold.querySelector(".adm-card-body")||hold.querySelector(".mob-card-body"));'
+'    if(!d){ if(hb)hb.innerHTML="<div class=\\"lxadm-empty\\">Account not found on Stellar mainnet.</div>"; return; }'
+'    var bal=(d.balances||[]).filter(function(b){ return b.asset_type!=="liquidity_pool_shares"; });'
+'    var nat=bal.filter(function(b){ return b.asset_type==="native"; })[0];'
+'    setT(q("#lxpM2"), nat?num(+nat.balance):"0");'
+'    setT(q("#lxpM3"), num(bal.filter(function(b){ return b.asset_type!=="native"; }).length));'
+'    if(!hb)return;'
+'    var rows=bal.map(function(b){ return b.asset_type==="native"'
+'      ? {code:"XLM",iss:"",amt:+b.balance}'
+'      : {code:b.asset_code,iss:b.asset_issuer,amt:+b.balance}; }).filter(function(r){ return r.amt>0; });'
+'    if(!rows.length){ hb.innerHTML="<div class=\\"lxadm-empty\\">This account holds no positive balances.</div>"; return; }'
+'    function draw(){ rows.sort(function(x,y){ return (y.usd||0)-(x.usd||0)||y.amt-x.amt; });'
+'      hb.removeAttribute("style"); hb.style.padding="0";'
+'      hb.innerHTML=rows.slice(0,12).map(function(r){'
+'        return "<div class=\\"lxwal-row\\"><img class=\\"lxwal-av\\" data-lxc=\\""+esc(r.code)+"\\" alt=\\"\\" src=\\""+(LG[r.code+"-"+r.iss]||avatar(r.code))+"\\">"'
+'          +"<div class=\\"lxwal-meta\\"><div class=\\"lxwal-addr\\">"+esc(r.code)+"</div>"'
+'          +"<div class=\\"lxwal-sub\\">"+esc(num(r.amt))+"</div></div>"'
+'          +"<div class=\\"lxwal-val\\">"+(r.usd==null?"\u2014":esc(usd(r.usd)))+"</div></div>"; }).join(""); }'
+'    draw();'
+'    rows.forEach(function(r){ priceUsd(r.code,r.iss,function(px){ r.usd=(px==null)?null:r.amt*px; draw(); }); });'
+'  });'
// ---- notes: local, but real ----
+'  var notes=cardByTitle("Internal notes");'
+'  if(notes){ var nb=notes.querySelector(".adm-card-body")||notes.querySelector(".mob-card-body");'
+'    if(nb){ var NK="lumos.admin.notes."+addr, cur="";'
+'      try{ cur=localStorage.getItem(NK)||""; }catch(_){}'
+'      nb.removeAttribute("style");'
+'      nb.innerHTML="<textarea class=\\"lxnote\\" id=\\"lxpNote\\" placeholder=\\"Notes about this wallet\u2026\\"></textarea>"'
+'        +"<div class=\\"lxnote-bar\\"><span class=\\"lxnote-hint\\" id=\\"lxpNoteHint\\">Saved in this browser only \u2014 notes need a backend to be shared.</span>"'
+'        +"<button class=\\"adm-btn primary\\" type=\\"button\\" id=\\"lxpNoteSave\\">Save note</button></div>";'
+'      var ta=nb.querySelector("#lxpNote"); ta.value=cur;'
+'      nb.querySelector("#lxpNoteSave").addEventListener("click",function(){'
+'        try{ localStorage.setItem(NK, ta.value); var h2=nb.querySelector("#lxpNoteHint");'
+'          h2.textContent="Saved."; setTimeout(function(){ h2.textContent="Saved in this browser only \u2014 notes need a backend to be shared."; },2500);'
+'        }catch(_){} }); } }'
// ---- risk: nothing scores this ----
+'  var risk=cardByTitle("Risk");'
+'  if(risk){ var rb=risk.querySelector(".adm-card-body")||risk.querySelector(".mob-card-body");'
+'    if(rb){ rb.removeAttribute("style");'
+'      rb.innerHTML="<div class=\\"lxadm-empty\\">Nothing scores wallets for risk. Flags like sanctions screening or unusual-activity detection need a monitoring service and somewhere to record findings \u2014 neither exists yet.</div>"; } }'
+'  qa(".up-tabs, .mob-up-tabs").forEach(function(t){ t.remove(); });'
+'}'
+'function boot(){ try{ paintRevenue(); }catch(e){} try{ paintSources(); }catch(e){} try{ var _sa=q("#lxSrcAdd"); if(_sa&&!_sa.__lx){ _sa.__lx=1; _sa.addEventListener("click",addManual); } }catch(e){} try{ wireCsv(); }catch(e){} try{ paintDashboard(); }catch(e){} try{ paintDashPanels(); }catch(e){} try{ paintDashRow3(); }catch(e){} try{ paintUsers(); }catch(e){} try{ paintAssets(); }catch(e){} try{ paintMobile(); }catch(e){} try{ paintProfile(); }catch(e){} try{ paintNoBackend(); }catch(e){} try{ paintChrome(); }catch(e){} try{ document.documentElement.classList.add("lxadm-ready"); }catch(e){} }'
+'if(document.readyState!=="loading")boot(); else document.addEventListener("DOMContentLoaded",boot);'
+'})();</'+'script>';

// ---- sidebar entry -----------------------------------------------------------------------------------
const REV_ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';
function revItem(active,suffix){ return '<a class="adn-item '+(active?'active':'')+'" href="lumoscore-admin-revenue'+suffix+'.html" data-tip="Revenue">\n      '+REV_ICON+'\n      <span class="adn-label">Revenue</span>\n    </a>\n    '; }

function variantOf(key){ if(/-dark\.html$/.test(key))return '-dark'; if(/-mobile\.html$/.test(key))return '-mobile'; return ''; }

// ---- the Assets page ships with invented figures, so blank them AT BUILD TIME -----------------------
// 492 assets, 423 listed, 187 active, 8 flagged and twenty rows of made-up tokens are the design's
// filler. They are in the HTML, so they paint before a single line of our script runs -- no amount of
// care in the painter can beat markup that is already on screen. This is the markup-level fix the flash
// rules ask for first; the script then fills the same slots with real numbers.
function blankAssets(h, mobile) {
  const LABELS = ['Listed assets', 'Traded on LumosCore', 'With a spot price', 'LumosCore 7d volume'];
  const FEET = ['in your list', 'in the last 7 days', 'priced on the DEX', 'traded on our platform'];
  let i = 0, j = 0, f = 0;
  h = h.replace(/(<div class="kpi-value"[^>]*>)([^<]*)(<\/div>)/g, (m, a, v, b) => (i++ < 4 ? a + '—' + b : m));
  h = h.replace(/(<span class="kpi-label">)([^<]*)(<\/span>)/g, (m, a, v, b) => (j < 4 ? a + LABELS[j++] + b : m));
  h = h.replace(/(<div class="kpi-foot"[^>]*>)([\s\S]*?)(<\/div>)/g, (m, a, v, b) => (f < 4 ? a + FEET[f++] + b : m));
  // Whole element, not just its first text node: the count sits in a nested <span class="mono">, so
  // stopping at the first tag left "Assets you list on LumosCore492 total" on screen.
  h = h.replace(/(<p class="admin-page-sub">)[\s\S]*?(<\/p>)/, '$1Assets you list on LumosCore$2');
  h = h.replace(/(<div class="mob-page-sub"[^>]*>)[\s\S]*?(<\/div>)/, '$1Assets you list on LumosCore$2');
  h = h.replace(/(<span class="seg-count"[^>]*>)[^<]*(<\/span>)/g, '$1—$2');
  h = h.replace(/(<span class="sc-count"[^>]*>)[^<]*(<\/span>)/g, '$1—$2');
  h = h.replace(/Showing[\s\S]{0,200}?assets<\/span>/, 'Showing — assets</span>');

  if (mobile) {
    // The phone lists filler cards instead of a table, and they are anchors, not divs.
    //
    // ONE is kept, hidden. The painter finds the cards, takes the first as its insertion point and
    // removes them all -- delete every card here and it finds none, returns early, and the mobile
    // Assets page renders nothing at all. So the anchor survives with no content to flash.
    let first = true;
    h = h.replace(/<a class="mob-user-card"[\s\S]*?<\/a>/g, () => {
      if (!first) return '';
      first = false;
      return '<a class="mob-user-card" href="#" style="display:none"></a>';
    });
    h = h.replace(/(<p class="mob-page-sub"[^>]*>)[\s\S]*?(<\/p>)/, '$1Assets you list on LumosCore$2');
    h = h.replace(/(<div class="mob-kpi-value"[^>]*>)[^<]*(<\/div>)/g, '$1—$2');
    h = h.replace(/<span class="mono">\d[\d,]*<\/span>/g, '<span class="mono">—</span>');
  } else {
    const a = h.indexOf('<tbody');
    const e = h.indexOf('</tbody>', a);
    if (a >= 0 && e > a) {
      const open = h.indexOf('>', a) + 1;
      h = h.slice(0, open)
        + '<tr><td colspan="8" style="padding:26px 4px;color:var(--text-muted)">Loading…</td></tr>'
        + h.slice(e);
    }
  }
  return h;
}

// The head rule for the load flash (see where it is inserted, below). Two fail-safes, either of which reveals the area:
// the CSS reveal at 8s, and a tiny head timer independent of the data layer -- a hidden or background tab can freeze
// CSS animation clocks (measured in the browser pane: the reveal sat at currentTime 0).
const NOFLASH='<style id="lx-admin-noflash">html:not(.lxadm-ready) main.admin-main,html:not(.lxadm-ready) main.mob-main{visibility:hidden;animation:lxadm-reveal 0s linear 8s forwards}@keyframes lxadm-reveal{to{visibility:visible}}</style>'
  +'<script id="lx-admin-noflash-js">setTimeout(function(){document.documentElement.classList.add("lxadm-ready")},8000)</script>';
let pages=0, made=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain','stellar','xrpl']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    let changed=false;

    // 1. build the Revenue page(s) by cloning the admin dashboard shell
    Object.keys(json).filter(k=>/^lumoscore-admin-dashboard(-dark|-mobile)?\.html$/.test(k)).forEach(function(dk){
      const suffix=variantOf(dk);
      const rk='lumoscore-admin-revenue'+suffix+'.html';
      let h=json[dk];
      // the mobile shell is a different element entirely
      if(suffix==='-mobile'){
        const ms=h.indexOf('<main class="mob-main">');
        const mz=h.indexOf('</main>', ms);
        if(ms<0||mz<0) return;
        let rv=h.slice(0,ms)+'<main class="mob-main">'+REVENUE_MOB+h.slice(mz);
        rv=rv.replace(/<title>[\s\S]*?<\/title>/,'<title>LumosCore \u2014 Admin \u00b7 Revenue</title>');
        rv=rv.replace(/<a class="mob-menu-item active"/,'<a class="mob-menu-item"');
        json[rk]=rv; changed=true; made++; return;
      }
      const mi=h.indexOf('<main class="admin-main">');
      const me=h.indexOf('</main>', mi);
      if(mi<0||me<0) return;
      let rev=h.slice(0,mi)+'<main class="admin-main">'+REVENUE_MAIN+h.slice(me);
      rev=rev.replace(/<title>[\s\S]*?<\/title>/,'<title>LumosCore \u2014 Admin \u00b7 Revenue</title>');
      // move the sidebar "active" marker onto Revenue
      rev=rev.replace(/<a class="adn-item active"/,'<a class="adn-item "');
      json[rk]=rev; changed=true; made++;
    });

    // 2. sidebar entry on every admin page (idempotent), + CSS/script injection
    for(const k of Object.keys(json)){
      if(!/^lumoscore-admin-/.test(k)) continue;
      let h=json[k];
      if(/^lumoscore-admin-assets/.test(k)) h=blankAssets(h, /-mobile\.html$/.test(k));
      h=h.replace(/<a class="adn-item [^"]*" href="lumoscore-admin-revenue[^"]*"[\s\S]*?<\/a>\s*/g,'');   // strip old
      // The mobile menu needs the same strip, and did not have one. The insert below is unguarded, so
      // every run of this transform appended another Revenue entry to the container -- which persists
      // between runs because containers are not rebuilt from the design. 28 had accumulated.
      h=h.replace(/<a class="mob-menu-item[^"]*" href="lumoscore-admin-revenue-mobile\.html"[\s\S]*?<\/a>\s*/g,'');
      h=h.replace(/<style id="lx-admin-css">[\s\S]*?<\/style>/g,'').replace(/<script id="lx-admindata">[\s\S]*?<\/script>/g,'')
         .replace(/<script id="lx-admphone">[\s\S]*?<\/script>/g,'');
      const suffix=variantOf(k);
      const isRev=/^lumoscore-admin-revenue/.test(k);
      // insert directly after the Dashboard item
      const dashRe=/(<a class="adn-item[^"]*" href="lumoscore-admin-dashboard[^"]*"[\s\S]*?<\/a>\s*)/;
      if(dashRe.test(h)) h=h.replace(dashRe,'$1'+revItem(isRev,suffix));
      // mobile menu: add Revenue, and point the design's dead href="#" items at the pages that exist
      if(suffix==='-mobile'){
        const mrev='<a class="mob-menu-item'+(isRev?' active':'')+'" href="lumoscore-admin-revenue-mobile.html">'+REV_ICON+'<span>Revenue</span></a>\n      ';
        const mdash=/(<a class="mob-menu-item[^"]*" href="lumoscore-admin-dashboard-mobile\.html">[\s\S]*?<\/a>\s*)/;
        if(mdash.test(h)) h=h.replace(mdash,'$1'+mrev);
        const MAP={Assets:'assets',Support:'support',Blogs:'blogs'};
        h=h.replace(/<a class="(mob-menu-item[^"]*)" href="#">([\s\S]*?)<\/a>/g,(full,cls,inner)=>{
          const m2=inner.match(/<span>([^<]+)<\/span>/);
          const key=m2&&MAP[m2[1].trim()];
          // no admin page exists behind Trades / Pools / LUMOS Incentives, so drop them rather
          // than leave a menu entry that goes nowhere
          return key ? '<a class="'+cls+'" href="lumoscore-admin-'+key+'-mobile.html">'+inner+'</a>' : '';
        });
      }
      // The page is no longer built (see DROPPED in extract_site.js), so every nav entry that links it
      // has to go too -- otherwise the panel carries an item that 404s.
      //
      // BOTH shapes, and the mobile one is not covered by the MAP above. That map only rewrites the
      // design's dead href="#" items; an earlier run already rewrote this one to a real filename and
      // baked it into the container, so it no longer matches href="#" and has to be cut by name.
      h=h.replace(/<a class="adn-item[^"]*" href="lumoscore-admin-create-pool[^"]*"[\s\S]*?<\/a>\s*/g, '');
      h=h.replace(/<a class="mob-menu-item[^"]*" href="lumoscore-admin-create-pool[^"]*"[\s\S]*?<\/a>\s*/g, '');
      const bi=h.lastIndexOf('</body>');
      if(bi>=0) h=h.slice(0,bi)+CSS+PHONEJS+SCRIPT+h.slice(bi);
      // NO PLACEHOLDER ON SCREEN WHILE THE PAGE LOADS (RAZA 2026-11-18, a screenshot of "Tokens launched 492 · Aptos ·
      // USDC / APT" mid-load: "WTH is this"). The design's invented figures are in the HTML and this layer sits ~1.1 MB
      // into a 1.3 MB page, so a slow load painted them until boot() ran at DOMContentLoaded. The main area is held back
      // from the FIRST paint by a rule in <head>, and boot() marks the page ready when it has painted. Fail-safe: the
      // rule reveals the area on its own after 8s, so a script that never runs cannot leave a blank page. Idempotent.
      h=h.replace(/<style id="lx-admin-noflash">[\s\S]*?<\/style>/g,'');
      h=h.replace(/<script id="lx-admin-noflash-js">[\s\S]*?<\/script>/g,'');
      const hd=h.indexOf('</head>');
      if(hd>=0) h=h.slice(0,hd)+NOFLASH+h.slice(hd);
      json[k]=h; changed=true; pages++;
    }

    if(changed){ const ser=JSON.stringify(json).split('</').join('<'+B+'/'); fs.writeFileSync(file,data.slice(0,s)+ser+data.slice(e),'utf8'); }
  }
}
console.log('admin: Revenue page created on '+made+' variant(s); sidebar + real-data layer on '+pages+' admin page keys');
