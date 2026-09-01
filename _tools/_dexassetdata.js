// Trade-asset page real-data layer — MAINNET, READ-ONLY (Phase 1).
// Turns the finalized DEX Trade-asset page (lumoscore-dex-asset) into a per-asset trading terminal
// driven by ?asset=CODE-ISSUER (default LUMOS). Fills the finalized header, 6 stat cards, price chart,
// orderbook, Recent Exchanges table and the Holders bottom tab with live Stellar mainnet data.
// Nothing is redesigned; the Buy/Sell execution widget is left for Phase 2 (only its displayed
// asset/price is made consistent). Modeled directly on _lumostoken.js (idempotent applyAll re-asserted
// via a debounced+self-guarded MutationObserver + a bounded interval, CSS no-flash gates, no emoji/\\u
// in the injected string, ES5 var in the browser code).
const fs = require('fs');
// XLM had a stand-in here: a purple disc with a decorative star, which is not the Stellar mark. It shows
// in nearly every pool row -- almost all pools are paired against XLM -- so one wrong glyph made the whole
// column look broken. Same SVG the wallet and bridge use, so XLM is one asset with one face across the app.
// Base64, not percent-encoded: the URI then carries no quote or backslash to survive a template literal,
// a JSON round-trip and an HTML attribute.
const STELLAR_SVG='<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#000"/><path d="M23.13 9.292l-2.4 1.224-11.598 5.907A6.909 6.909 0 0119.35 9.498l1.374-.7.205-.105a8.439 8.439 0 00-13.371 7.472 1.535 1.535 0 01-.834 1.484l-.725.37v1.724l2.134-1.088.691-.353.681-.347 12.226-6.23 1.374-.699 2.84-1.447V7.856zm2.816 2.012L10.201 19.32l-1.374.7L6 21.463v1.723l2.808-1.43 2.401-1.224 11.61-5.916a6.909 6.909 0 01-10.229 6.93l-.085.045-1.49.76a8.439 8.439 0 0013.372-7.475 1.536 1.536 0 01.833-1.483l.726-.37v-1.718z" fill="#FFF"/></svg>';
const STELLAR_URI='data:image/svg+xml;base64,'+Buffer.from(STELLAR_SVG).toString('base64');
// The (i) note and its tooltip are defined on the LUMOS token page. Lifted at build time so there is one
// definition. Deliberately NOT the later ".lx-supinfo,.lt-cmp-v .lx-supinfo" override in that file -- it
// resizes the badge to a 26px image slot and sets font-size:0, which would blank the "i" here.
const DXA_SUPINFO_CSS = (function(){
  const t = fs.readFileSync(__dirname + '/_lumostoken.js', 'utf8');
  const rules = (t.match(/\.lx-supinfo(?::hover::after)?\{[^}]*\}/g) || []).join('');
  if (rules.length < 200) throw new Error('_dexassetdata: .lx-supinfo CSS not found in _lumostoken.js');
  return rules; })();
const DXA_SUPPLY_NOTE = '90% (9B LUMOS) supply is locked forever. The circulating supply is 1B LUMOS.';
const { read, getContents, VERIFIED, CANONICAL, VTICK_SVG, DOMAIN_DISPLAY } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const KEYS = ['lumoscore-dex-asset.html', 'lumoscore-dex-asset-dark.html', 'lumoscore-dex-asset-mobile.html'];

const STYLE = `<style id="lx-dxa-css">
.lx-sortag{display:inline-block;margin-left:7px;padding:1px 7px;border-radius:999px;font-size:10.5px;
  font-weight:800;letter-spacing:.3px;text-transform:uppercase;color:var(--accent);
  background:color-mix(in srgb,var(--accent) 14%,transparent);border:1px solid color-mix(in srgb,var(--accent) 34%,transparent);
  vertical-align:1px;white-space:nowrap}
.mdxa-hl-addr .lx-sortag{margin-left:6px;font-size:9.5px}

.lx-acct{color:inherit;text-decoration:none;cursor:pointer}
.lx-nolink{cursor:default;display:inline-flex;align-items:center;gap:10px}
.lx-nolink:hover .wa,.lx-nolink:hover .mdxa-hl-addr{color:inherit}

.lx-acct:hover .wa,.lx-acct:hover .mdxa-hl-addr{color:var(--accent)}
a.mdxa-hl-row{display:flex;align-items:center;gap:10px}

.lx-vtick{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;margin-left:5px;border-radius:50%;background:var(--green,#35c07f);color:#fff;vertical-align:-2px;flex:0 0 14px}
.lx-vtick svg{width:9px;height:9px;display:block}
/* #5: stellar.expert's directory flags an address as malicious/unsafe. When it flags the issuer of an
   asset we are showing, say so, in the one colour that cannot be mistaken for a neutral label. */
.lx-unsafetag{display:inline-flex;align-items:center;gap:4px;margin-left:6px;padding:1.5px 7px;
  border-radius:999px;background:var(--red-soft,rgba(255,91,91,.14));color:var(--red,#ff5b5b);
  font:800 10.5px/1.5 'Hanken Grotesk',system-ui,sans-serif;letter-spacing:.3px;text-transform:uppercase;
  vertical-align:1px;white-space:nowrap;flex:0 0 auto}
.lx-unsafetag svg{width:11px;height:11px;display:block;flex:0 0 11px}

/* ---- no-flash gates: hide the design's mock values until our data owns the element ---- */
.asset-header:not(.lxda) .asset-name,.asset-header:not(.lxda) .asset-ticker,.asset-header:not(.lxda) .asset-description,.asset-header:not(.lxda) .addr,.asset-header:not(.lxda) .website{visibility:hidden}
.asset-top:not(.lxda) .asset-name,.asset-top:not(.lxda) .asset-ticker,.asset-top:not(.lxda) .asset-description,.asset-top:not(.lxda) .addr,.asset-top:not(.lxda) .website{visibility:hidden}
.stat-row:not(.lxda) .val,.stat-row:not(.lxda) .sub{visibility:hidden}
/* #13: four stats on one line. Two big cells became four, so the type steps down rather than the row
   becoming two rows of cards -- which is what was asked against. minmax(0,1fr) lets a long value
   shrink its own cell instead of pushing the row wider than the screen. */
html body .stat-row{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:8px!important}
.stat-row .stat-cell{min-width:0}
/* #15: 8.5px labels over 13.5px figures. Those sizes were chosen to survive a PHONE, where four cells
   share 375px -- but on a desktop card the same four have three times the room and were still
   whispering. The phone keeps its sizes, below; the desktop gets figures worth reading. */
.stat-row .stat-cell .lbl{font-size:10px;letter-spacing:.06em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stat-row .stat-cell .val{font-size:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stat-row .stat-cell .val .u{font-size:11px;margin-left:3px}
.stat-row .stat-cell .sub{font-size:12.5px}
@media(max-width:760px){
.stat-row .stat-cell .lbl{font-size:8.5px;letter-spacing:.04em}
.stat-row .stat-cell .val{font-size:13.5px}
.stat-row .stat-cell .val .u{font-size:9px;margin-left:2px}
.stat-row .stat-cell .sub{font-size:10.5px}
}
/* #10: this line carried font-size:9.5px and sits AFTER the media query above, outside it -- so it beat
   both the 12px desktop size and the 10.5px phone size on every screen, and the sub-lines stayed at 9.5px
   no matter what the rules above said. That is the "tiny grey text". Only the clipping behaviour belongs
   here; the sizes are set once, above, where they can be read. */
.stat-row .stat-cell .sub{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* #11/#21: a change of zero because nothing traded is not the same thing as a day that ended flat, and
   it must not be dressed in either colour. Grey, no arrow, and the reason on hover. */
.change-pill.lx-flat{background:var(--surface-2,#f1f1f4)!important;color:var(--text-soft,#8a8fa3)!important}
/* AUDIT (flash sweep): the .lxda gates above only covered the header + stat cells. A static-vs-settled diff
   showed 9 more groups still painting the design's Aptos mock (4.2271 APT, 2.66%, 18 holders, 189.93K vol)
   before our data lands. Mask them until they are actually written — .lxp is added by the observer in
   lxUnmask(), so each element reveals the instant its own real value arrives, not on a global timer. */
.crumb span:last-child:not(.lxp),
.price-display .big:not(.lxp),
.price-display .change-pill:not(.lxp),
.price-display .meta b.mono:not(.lxp),
/* #26: drop the change and volume cells. Positional because these six have no distinguishing class;
   the markup ships exactly O, H, L, C, delta, volume in that order. */
.ohlc-strip .pair:nth-of-type(n+5){display:none!important}
/* N4: Open and Close go too. Close is the headline price shown above at twice the size, and Open is the
   previous close, which the 24h change already states -- leaving High and Low, the only two the
   headline does not give you. Same positional basis as the rule above: the markup ships O H L C. */
.ohlc-strip .pair:nth-of-type(1),.ohlc-strip .pair:nth-of-type(4){display:none!important}
.ohlc-strip .pair .v:not(.lxp),
.dxa-perf-grid .dxa-perf-cell .ch:not(.lxp),
.mdxa-perf-grid .mdxa-perf-cell .ch:not(.lxp),
.dxa-hl-stat .val:not(.lxp),
.tabs-bar .tab .count:not(.lxp),
.dxa-trade-frow .mono:not(.lxp),
.dxa-trade-summary .dxa-tsum-row .mono:not(.lxp){visibility:hidden!important}
/* AUDIT REGRESSION (audit #3, bug 10): the two rules below were once inserted into the MIDDLE of the
   selector list above, which invalidated the whole rule and silently killed every one of these masks on
   all three dex-asset variants. Complete rules must stay OUTSIDE the selector list. The Holders/.count
   selectors above cover the panel the design re-renders on tab-switch (baked 12,408 / 38.4% / 67.2%). */
.lx-dxa-nochart{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:13px;color:var(--text-soft,#8a8fa3);pointer-events:none}
#dxaChart,#mdxaChart{position:relative}
#dxaChart:not(.lxda) svg,#mdxaChart:not(.lxda) svg{visibility:hidden}
/* also hide the design's OWN chart marks at all times (it renders a mock svg on load + on every */
/* tool/timeframe click before ours replaces it -> a flash). Only our lxda marks ever render.    */
/*                                                                                                */
/* THIS RULE IS AN ALLOW-LIST AND EVERY NEW MARK HAS TO BE ADDED TO IT. It denies by shape --      */
/* "any rect that is not a candle" -- so the volume bars, which are rects, were hidden by it the   */
/* moment they were added: present in the DOM, correct geometry, correct colour, display:none.     */
/* Three rounds of "the bars are there" measurements missed it because they read attributes and    */
/* SVG units; getBoundingClientRect() reported 0x0 the first time it was asked.                    */
#dxaChart svg path:not(.lxda-line):not(.lxda-area),#dxaChart svg rect:not(.lxda-candle):not(.lxda-vol),#dxaChart svg line:not(.lxda-candle),#dxaChart svg polyline,#dxaChart svg polygon:not(.lxda-area),#mdxaChart svg path:not(.lxda-line):not(.lxda-area),#mdxaChart svg rect:not(.lxda-candle):not(.lxda-vol),#mdxaChart svg line:not(.lxda-candle),#mdxaChart svg polyline,#mdxaChart svg polygon:not(.lxda-area){display:none!important}
#dxaObAsks:not(.lxda) .dxa-ob-row,#dxaObBids:not(.lxda) .dxa-ob-row{visibility:hidden}
#dxaExTable:not(.lxda) tr{visibility:hidden}
/* #38: Time sat left-aligned in its own column with the explorer link right-aligned in the next one,
   so a short value like "just now" ended ~79px short of the icon it belongs beside and read as
   floating in dead space. Right-aligning the column closes that gap without moving any column.
   The header lives in the table thead, OUTSIDE this tbody, so it is squared up in renderExchanges.
   Round two: right-aligning closed the gap from 79px to 24px, but the link column was still 74px wide
   with its icon pinned to the far end of it. Shrink that column to its content so Time finishes beside
   the icon rather than a third of a column short of it. */
#dxaExTable tr>td:nth-child(5){text-align:right}
/* #5: every holder row carried its own "View on Explorer" under the address -- 184 rows, 184 copies of
   the same four words, and it doubled the height of each one. The address above it already opens the
   same page, so the label is pure repetition. Hidden rather than unpicked from two separate string
   builders, because the anchor also carries the href the row's own handler reads. */
/* N9: the mark alone. Hiding it entirely left the EXPLORER heading standing over an empty column,
   which reads as broken rather than as deliberate. The label is what competed with the row's own
   click target, not the icon. */
/* item 9: the arrow is the row's own trailing control, so it pins to the right edge and the numbers stop
   just short of it. flex:none keeps it square when a long balance tries to squeeze it. */
.lxda-hlrow{align-items:center}
.lxda-hlrow .mdxa-hl-meta{min-width:0;flex:1 1 auto}
.lxda-hlrow .mdxa-hl-vals{margin-left:auto;margin-right:8px;text-align:right;flex:none}
.lxda-hlrow .lxda-hlx{flex:none;margin-left:0}
.mdxa-hl-explorer,.dxa-hl-explorer{display:inline-flex!important;align-items:center;justify-content:center;
  width:26px;height:26px;border-radius:7px;color:var(--text-soft,#8a8fa3);text-decoration:none}
.mdxa-hl-explorer:hover,.dxa-hl-explorer:hover{color:var(--accent,#ea6a2c);background:var(--surface-2,rgba(140,140,150,.12))}
.dxa-hl-explorer svg,.mdxa-hl-explorer svg{width:14px;height:14px;display:block}
/* N9b: the Burned tag sat on the text baseline while the address beside it is centred in a taller row,
   so it hung low. The cell becomes a row and both are centred on the same line. */
.dxa-hl-wallet,.dxa-hl-rowcell{display:inline-flex;align-items:center;gap:8px}
.lx-burntag{position:relative;top:0;align-self:center}
/* #13: the asset's mark inside the About heading -- sized to the text, not to a card. */
.lxda-sheet-ico{display:inline-block!important;width:20px!important;height:20px!important;min-width:0!important;flex:none!important;border-radius:50%;overflow:hidden;background-size:cover;background-position:center;background-repeat:no-repeat;
  vertical-align:-4px;margin:0 6px 0 2px}
.lxda-sheet-ico img,.lxda-sheet-ico .lx-tokimg{width:100%;height:100%;object-fit:cover;border-radius:50%}
#dxaExTable tr>td:nth-child(6){width:1%;white-space:nowrap;padding-left:10px}
/* Remove the duplicate price line on DESKTOP. ".price-display .meta" reads
   "<price> XLM per LUMOS - 1D High <x> - Low <y>", and the OHLC strip directly beneath it already
   states O/H/L/C, the change and the volume for the same window. Two rows, one fact.
   Hidden rather than removed: applyOhlc addresses High and Low by INDEX among .meta b.mono, so taking
   the nodes out would silently shift both. The phone keeps it -- it has no OHLC strip to duplicate. */
@media (min-width:761px){.price-display .meta{display:none!important}}
#mdxaExList:not(.lxda) .ex-row{visibility:hidden}
/* the design .ex-row grid is "24px 1fr 70px auto"; our rows add a 5th cell for the explorer link */
#mdxaExList .ex-row[data-lxda]{grid-template-columns:24px 1fr auto auto 16px}
/* real amounts run longer than the mock 18 USDC; the design fixed 70px column wrapped them onto a
   second line and left rows at uneven heights. Size to content and never wrap. */
#mdxaExList .ex-row[data-lxda] .ex-num{white-space:nowrap;text-align:right}
#mdxaExList .ex-row[data-lxda] .ex-num .sub{display:block}
.lxda-exlink{display:inline-flex;align-items:center;justify-content:center;color:var(--text-soft,#8a8fa3)}
.lxda-exlink:hover{color:var(--accent)}
/* chart x-axis dates as an absolute HTML row (SVG text is squished by preserveAspectRatio=none) */
.lxda-cdates{position:absolute;left:14px;right:70px;bottom:5px;display:flex;justify-content:space-between;gap:8px;font:600 11.5px/1 'JetBrains Mono',monospace;color:var(--text-soft,#8a8fa3);pointer-events:none}
/* The price axis. The plot has always reserved a right gutter (PADR) and never drawn anything in it, so
   the chart could be read for shape but not for value -- there was no way to check a figure against the
   line. Positioned as absolute HTML rather than <text> inside the svg because that svg is
   preserveAspectRatio="none": glyphs in it would be stretched by the width/height ratio, differently at
   every window size. Percentages below mirror PADT/PADB against the 380-unit viewBox. */
/* top/bottom are set from JS, not here: they have to track the PRICE band, and the price band moved
   when the volume band was added. A percentage frozen in the stylesheet would have gone on describing the
   old split and quietly labelled the bars. */
/* Unit of the price axis. Sits above the topmost number, right-aligned with them. */
.lxda-cunit{position:absolute;top:2px;right:4px;z-index:2;pointer-events:none;
  font:700 10px/1 'JetBrains Mono',monospace;letter-spacing:.06em;color:var(--text-muted,#8a8fa3)}
.lxda-cprices{position:absolute;right:4px;width:64px;pointer-events:none;z-index:2}
/* item 20: gridlines, aligned to the price labels by construction (same top/bottom). */
.lxda-cgrid{position:absolute;left:0;right:0;pointer-events:none;z-index:0;
  background-image:repeating-linear-gradient(to bottom,
    rgba(127,127,140,.17) 0,rgba(127,127,140,.17) 1px,transparent 1px,transparent 25%);
  box-shadow:inset 0 -1px 0 rgba(127,127,140,.17)}
/* the plot itself has to sit ABOVE the grid: a positioned sibling would otherwise paint over a static svg */
.chart-area svg,.mdxa-chart svg{position:relative;z-index:1}
.lxda-cprices span{position:absolute;right:0;transform:translateY(-50%);font:600 10.5px/1 'JetBrains Mono',monospace;color:var(--text-soft,#8a8fa3);white-space:nowrap}
/* ---- #2: the change pill sits BESIDE the price ------------------------------------------------- */
/* The design stacked .big over .row2, so the headline number had a pill hanging under it and the
   card carried two short lines where one wide one would do. Two columns instead: the price, then the
   pill and the high/low meta on the same baseline to its right. They wrap inside their own column, so
   a long meta line never pushes the price around. */
.price-display{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:baseline;column-gap:14px}
.price-display .big{grid-column:1;grid-row:1}
.price-display .row2{grid-column:2;grid-row:1;margin-top:0!important}
/* No phone override: beside was asked for on BOTH builds, and it fits -- measured at 393px the
   price is 138px and the pill 87px inside a 331px column. The second track is minmax(0,1fr) and
   .row2 already wraps, so a longer price squeezes the meta onto its own line instead of overflowing. */

/* ---- #11: the unit label and the top axis number were in the same corner ----------------------- */
/* Both were pinned right-aligned at the top of the right-hand gutter, so "XLM" printed straight
   through the topmost price. The gutter's BOTTOM right is empty -- the x-axis date row stops short of
   it (right:70px) and the price band ends above the volume bars -- so the unit moves there. */
.lxda-cunit{top:auto!important;bottom:5px!important;right:4px!important}

/* ---- #3: one hover readout, not two ------------------------------------------------------------ */
/* The phone build still ships the design own OHLC tooltip (.chart-tip, #mdxaTipO/H/L/C/V) and it is
   fed by the template MOCK -- it was reading "O 4.5031 XLM ... V 678K USDC" against a chart whose own
   axis was around 0.00018, which is why the numbers looked unrelated to the asset. Ours (.lxda-chtip)
   is built on this page too and carries the real series, the same fields desktop shows. Hide the
   design one, and its crosshair with it, since we draw our own. */
.chart-tip,.chart-hover-line,.chart-hover-dot{display:none!important}
/* #8: the browser keeps vertical scrolling over the chart; a horizontal drag stops being a scroll
   gesture and reaches touchmove, which is what lets the readout track a finger. */
.lxda-cwrap,.chart-body,.chart-area,#dxaChart,#mdxaChart{touch-action:pan-y}
/* #17/#20: the two new pill groups. .chart-tools buttons are 26px icon squares, so these override the
   width for text labels while inheriting everything else -- the tray, the radius, the active treatment. */
/* #8, PHONE ONLY. Four stat cards across 375px gave each one about 80px, which is why Price rendered as
   "0.0002..." with the digits that matter truncated. Supply is the one of the four that is not a market
   figure -- it does not move, and nobody checks it between glances -- so it moves into a sheet behind a
   link and the other three get a third of the row each.
   Scoped to a media query and to nothing else: the desktop grid is untouched, as asked. */
/* The link is BUILT on every layout -- one code path, nothing to rebuild when the window is resized --
   so it needs an explicit default of none. A bare <div> is display:block, which is why it showed on
   desktop, where all four cards are on screen and a "More info" pointing at one of them is just noise. */
.lxda-moreline{display:none}
/* Centred rather than left-aligned, on BOTH layouts -- the Supply tile only exists on desktop, so a
   mobile-scoped rule would have left the very card that was named out of it. These are small tiles of
   one figure each, not a table scanned down a shared left edge, and label / figure / sub-line are all
   different lengths. align-items governs the flex children (the cell is a column flexbox) and
   text-align governs wrapping inside each; either alone leaves one axis untouched. */
.stat-row .stat-cell{align-items:center;text-align:center}
/* Same accent as the website link they sit beside -- these are three ways to reach the same issuer, so
   they read as one row rather than three unrelated controls. currentColor on the svg means the single
   colour rule below drives both marks. */
.lx-soc{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;
  margin-left:8px;color:var(--accent,#ea6a2c);text-decoration:none;vertical-align:middle;opacity:.9;
  border:1px solid var(--border,#e6e6ea);border-radius:8px;background:transparent;
  transition:background-color .15s ease,border-color .15s ease,opacity .15s ease}
.lx-soc svg{width:14px;height:14px}
.lx-soc:hover{opacity:1;background:var(--surface-2,rgba(127,127,140,.10));border-color:var(--accent,#ea6a2c)}
/* item 1: the marks sit in a flex row that already has a gap -- only the first needs a margin of its own,
   or every pair ends up separated twice. */
.lx-soc + .lx-soc{margin-left:0}
/* B16: marks a balance that is locked forever. Deliberately quiet -- it is a fact about the row, not a
   warning, and it sits beside the Soroban tag so the two annotations read as one family. */
/* item 13: centre the address and its tag against each other rather than on a shared baseline that the
   identicon had already dragged down. */
.lxda-hcell{display:flex;align-items:center;min-width:0}
.lxda-hcell .lx-burntag{align-self:center;top:0;flex:none}
.lx-burntag{display:inline-block;margin-left:7px;padding:1px 6px;border-radius:5px;font-size:10px;
  font-weight:700;letter-spacing:.03em;vertical-align:middle;
  color:var(--text-soft,#8a8fa3);border:1px solid var(--border,#e6e6ea)}
.lxda-slinks{display:inline-flex;align-items:center;gap:10px}
.lxda-slinks .lx-soc{margin-left:0}
/* A2: the issuer on one line -- shortened, with the full key on the copy control beside it. */
.lxda-srow .lxda-issh{white-space:nowrap}
.lxda-isscp{margin-left:8px;padding:0;border:0;background:none;cursor:pointer;vertical-align:middle;
  color:var(--text-soft,#8a8fa3);display:inline-flex;align-items:center}
.lxda-isscp:hover{color:var(--accent,#ea6a2c)}
/* A19: the marks were already the real X and Telegram glyphs -- what made them look wrong is that
   .lx-soc paints them with the site accent, so X rendered as an orange X, which is not a logo anyone
   recognises. Each now carries its own brand colour, keyed off the aria-label both builders already
   set (the header row and the More-info sheet), so neither builder had to change.
   X is deliberately var(--text): the brand mark is black on light and white on dark, which is exactly
   what that token resolves to, so it stays correct in both themes rather than being pinned to one. */
.lx-soc[aria-label="X"] svg{fill:var(--text,#0e0e10)}
.lx-soc[aria-label="Telegram"] svg{fill:#229ED9}
.lx-soc svg{width:14px;height:14px;display:block}
@media(max-width:760px){
/* The class above is applied by JS once it has read the labels, so on a phone the Supply card painted,
   the row laid out as four, and then it vanished and the row reflowed to three -- the "4 boxes for a
   split second" on refresh. This hides it from the FIRST paint instead.
   Positional, because at first paint there is nothing to match on yet: the markup ships exactly four
   .stat-cells in a fixed order (Price / 24h Volume / Market Cap / Supply) from a single template shared
   by every asset page, and the grid beneath is already pinned to three columns here. n+4 rather than 4
   so a fifth card, if one is ever added, is covered by the same rule instead of reintroducing this. */
.stat-row .stat-cell:nth-of-type(n+4){display:none!important}
.stat-row .stat-cell.lxda-more{display:none!important}
/* #40: the social marks live in the More info sheet on a phone, so they do not also sit in a header
   that is already carrying the code, the issuer address and the domain in one narrow column. */
.asset-meta .lx-soc,.asset-meta-row .lx-soc{display:none!important}
/* Reserve the meta row so it cannot grow under the boxes. It ships one short placeholder line
   ("Issuer 0x0b59...1756 circle.com") and settles at two, because the real issuer key, its verified
   tick and the domain wrap -- measured 20px -> 44px, which pushed everything below it down after load.
   Expressed in em, not px, so it still reserves the right space if the type scale changes. */
.asset-meta{min-height:3.8em}
html body .stat-row{grid-template-columns:repeat(3,minmax(0,1fr))!important}
.lxda-moreline{grid-column:1/-1;display:flex;justify-content:center;margin-top:2px}
.lxda-morebtn{border:0;background:transparent;padding:6px 4px;cursor:pointer;
  font-weight:800;font-size:12px;line-height:1;color:var(--accent,#ea6a2c);letter-spacing:.01em}
/* The backslash is doubled on purpose: this block is a template literal, where a CSS unicode escape
   would be read as an octal escape and fail the build, and the backslash still has to reach the CSS. */
.lxda-morebtn::after{content:"\\203a";margin-left:5px;font-weight:700}
}
/* The sheet itself. Bottom-anchored on a phone because that is where a thumb is, and it is a reference
   panel rather than a decision -- it closes by tapping anywhere off it. */
.lxda-sheet{position:fixed;inset:0;z-index:10001;display:none;align-items:flex-end;justify-content:center;
  background:rgba(8,10,14,.55);backdrop-filter:blur(3px)}
.lxda-sheet.open{display:flex}
.lxda-sheet-card{width:100%;max-width:520px;max-height:80vh;max-height:80dvh;overflow:auto;
  overscroll-behavior:contain;background:var(--surface,#fff);border:1px solid var(--border);
  border-radius:18px 18px 0 0;padding:16px 18px 22px;animation:lxdaSheetIn .2s ease}
@keyframes lxdaSheetIn{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}
.lxda-sheet-head{display:flex;align-items:center;gap:12px;margin-bottom:10px}
.lxda-sheet-head h3{flex:1;margin:0;font-size:15px;font-weight:800;color:var(--text)}
.lxda-sheet-x{width:30px;height:30px;flex:0 0 30px;border-radius:8px;border:1px solid var(--border);
  background:transparent;color:var(--text-soft);cursor:pointer;font-weight:700;font-size:15px;line-height:1}
.lxda-srow{display:flex;align-items:baseline;justify-content:space-between;gap:14px;padding:9px 0;
  border-bottom:1px solid var(--border)}
.lxda-srow:last-child{border-bottom:0}
.lxda-srow .k{font-weight:600;font-size:12.5px;line-height:1.3;color:var(--text-soft)}
.lxda-srow .v{font:800 13.5px/1.3 'JetBrains Mono',monospace;color:var(--text);text-align:right;
  overflow-wrap:anywhere}
/* Desktop: pinned inside the plot, top-left. z-index above the svg, and a solid tray so the labels stay
   legible if the series runs behind them. */
/* #25: on the control row now, not floating over the plot -- static, no tray, no shadow. The rule is
   kept scoped to the chart hosts so that if either group is ever re-parented back inside one it still
   has somewhere sensible to sit. */
/* #27: the right column ended above the left, leaving a blank strip beside the performance boxes.
   Measured on this page: left 968px, right 916px -- 52px short. The gap is not fixed either: the trade
   card changes height between Swap, Orderbook and Limit, so any hard-coded height would only be right
   on one tab. Stretching the column and letting the ad absorb whatever is left over is correct on all
   three, and on any asset whose chart is a different height.
   Desktop only: the columns stack on a phone, where there is no second column to align to. */
@media(min-width:900px){
  .dxa-grid{align-items:stretch}
  .dxa-trade-col{min-height:100%}
  .dxa-trade-col .lxad-wrap{flex:1 1 auto;display:flex;flex-direction:column;min-height:0}
  .dxa-trade-col .lxad-wrap > *{flex:1 1 auto}
}
.chart-controls .lxda-metric,.chart-controls .lxda-denom{position:static;top:auto;left:auto;
  box-shadow:none;background:transparent;border:0}
#dxaChart .lxda-metric,#mdxaChart .lxda-metric,#dxaChart .lxda-denom,#mdxaChart .lxda-denom{
  position:absolute;top:8px;z-index:4;background:var(--surface,#fff);border:1px solid var(--border);
  box-shadow:0 2px 8px -4px rgba(0,0,0,.35)}
#dxaChart .lxda-metric,#mdxaChart .lxda-metric{left:8px}
#dxaChart .lxda-denom,#mdxaChart .lxda-denom{left:8px;top:40px}
/* #39: inside the plot these two trays were styled but their BUTTONS were not -- browser default,
   13.3px at weight 400 with no padding -- so a finished-looking tray held unfinished-looking labels.
   Worse, the selected button's background was the same white as the tray behind it, which meant the
   control never showed which of the two was active. Same segmented treatment as the timeframe buttons
   right above it: accent fill on the selected one, muted label on the other. (The pair is also put
   side by side on one line, in chartUi -- the offset needs the measured width of the first tray.) */
#dxaChart .lxda-metric button,#mdxaChart .lxda-metric button,
#dxaChart .lxda-denom button,#mdxaChart .lxda-denom button{
  border:0;background:transparent;cursor:pointer;border-radius:6px;padding:4px 9px;
  font-family:'Hanken Grotesk',sans-serif;font-size:11.5px;font-weight:700;line-height:1;
  color:var(--text-soft,#6f6f79);transition:none!important}
/* transition:none is not a style preference, it is what makes the selected state paint at all.
   These buttons inherit the site-wide control transition (background-color/color/box-shadow .16s), and
   something re-asserts their style on every apply tick, which restarted those transitions before they
   could finish -- leaving three CSSTransitions permanently in "running". A running transition sits ABOVE
   !important author styles in the cascade, so nothing could colour the active button: measured, an inline
   background:#0f0 on it computed to transparent, while a clone of the same node in the same parent
   painted correctly. With no transition to restart, the cascade resolves normally. */
#dxaChart .lxda-metric button:hover:not(.active),#mdxaChart .lxda-metric button:hover:not(.active),
#dxaChart .lxda-denom button:hover:not(.active),#mdxaChart .lxda-denom button:hover:not(.active){
  color:var(--text,#0e0e10)}
#dxaChart .lxda-metric button.active,#mdxaChart .lxda-metric button.active,
#dxaChart .lxda-denom button.active,#mdxaChart .lxda-denom button.active{
  background:var(--accent,#ea6a2c);color:#fff}
#dxaChart .lxda-metric button[disabled],#mdxaChart .lxda-metric button[disabled]{opacity:.4;cursor:default}
.chart-controls .lxda-metric{margin-left:auto}
/* At 375px the four groups cannot share one line (measured 367px of controls in a 313px row), so the row
   wraps -- and without this the denomination landed alone at the far LEFT of the second line, reading as
   an orphan rather than as the pair of the group above it. Right-aligned, the two new controls stack
   against the same edge and the design own two keep the left. */
.chart-controls .lxda-denom{margin-left:auto}
/* The unit toggle changed how much room this row needed, so at some column widths the timeframes sat
   on line 1 in XLM and dropped to line 2 in $ -- switching units looked like the design breaking. The
   H/L strip is the only part whose width depends on the unit (a "$" plus more significant digits):
   measured on FRED it goes 221px -> 250px, moving the one-line requirement from 730px to 759px. Give
   back ~31px of gap and padding so the dollar view fits wherever the XLM view already did, rather than
   pinning the strip to its widest state, which would only make both views wrap. */
.chart-controls.chart-controls{gap:8px}
.ohlc-strip.ohlc-strip{gap:11px;padding:7.7px 10px}
/* #3: on the phone these two ended up on different lines -- Price/MCap tucked after the timeframes on
   the first, $/XLM alone on the second -- so the pair that belongs together read as two unrelated
   controls and the row wasted a line. Put them on their OWN line, $/XLM against the left edge and
   Price/MCap against the right, which is the arrangement asked for and also the tidier one: two
   opposing ends instead of three ragged groups.
   The break is a pseudo-element flex item at 100% basis; explicit order values are what keep the
   design's own two groups ahead of it. */
@media (max-width:760px){
  .chart-controls{align-items:center}
  .chart-controls::after{content:"";flex:0 0 100%;height:0;order:2}
  .chart-controls .lxda-denom{order:3;margin-left:0!important}
  .chart-controls .lxda-metric{order:4;margin-left:auto!important}
}
.chart-controls .lxda-metric button,.chart-controls .lxda-denom button{
  width:auto;min-width:0;padding:0 9px;font:800 11px/1 "Hanken Grotesk",system-ui,sans-serif;letter-spacing:.02em}
.chart-controls .lxda-metric button[disabled]{opacity:.4;cursor:default}
/* On a narrow phone the row wraps; keep the two new groups together on whichever line they land on so
   they never split "Price | MCap" from "$ | XLM". */
@media(max-width:420px){
.chart-controls .lxda-metric button,.chart-controls .lxda-denom button{padding:0 7px;font-size:10.5px}
/* #39 on the phone, where these groups live in the controls row rather than inside the plot. Same
   defect and same cure: the selected button was white on a white tray, and the inherited control
   transition kept restarting and outranking whatever set the colour. Sizes stay as they are above --
   only the selected/unselected treatment changes. */
.chart-controls .lxda-metric button,.chart-controls .lxda-denom button{
  background:transparent;color:var(--text-soft,#6f6f79);font-weight:700;transition:none!important}
.chart-controls .lxda-metric button.active,.chart-controls .lxda-denom button.active{
  background:var(--accent,#ea6a2c);color:#fff;box-shadow:none}
}
/* chart hover readout */
.lxda-chtip{position:absolute;pointer-events:none;background:var(--surface,#fff);border:1px solid var(--border,#ececef);border-radius:9px;padding:7px 10px;box-shadow:0 8px 22px rgba(0,0,0,.22);opacity:0;transition:opacity .1s;z-index:6;white-space:nowrap;font-family:'Hanken Grotesk',system-ui,sans-serif}
.lxda-chtip .d{color:var(--text-soft,#8a8fa3);font-size:11px;font-weight:600;margin-bottom:6px}
/* Row labels, same as the pool chart's: 11px soft over a 14px/800 figure. */
.lxda-chtip .l{color:var(--text-soft,#8a8fa3);font-size:11px;font-weight:600}
/* #24: one labelled group per figure, 8px apart -- the pool tooltip's rhythm, measured off it. */
.lxda-chtip .lxrow{margin-top:8px}
.lxda-chtip .lxrow .p{margin-top:1px}
.lxda-chtip .v{margin-top:6px}
.lxda-chtip .p{color:var(--text,#0e0e10);font-size:14px;font-weight:800;font-variant-numeric:tabular-nums}
.lxda-chtip .v{color:var(--text-soft,#8a8fa3);font-size:11px;font-weight:600;margin-top:1px}
.lxda-chdot{position:absolute;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:var(--accent,#ea6a2c);border:2px solid var(--surface,#fff);box-shadow:0 0 0 2px rgba(234,106,44,.35);pointer-events:none;opacity:0;transition:opacity .1s;z-index:5}
.lxda-chvl{position:absolute;width:1px;background:rgba(234,106,44,.45);pointer-events:none;opacity:0;transition:opacity .1s;z-index:4;top:16px;bottom:28px}
#dxaChart svg,#mdxaChart svg{cursor:crosshair}
/* a wide range can take 6-8s on Horizon; say so rather than leaving the previous range looking final */
#dxaChart.lxda-loading::after,#mdxaChart.lxda-loading::after{content:"Loading…";position:absolute;top:8px;right:12px;font:600 10.5px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.04em;color:var(--text-soft,#8a8fa3);opacity:.9;z-index:6;pointer-events:none;animation:lxdaPulse 1.1s ease-in-out infinite}
@keyframes lxdaPulse{0%,100%{opacity:.35}50%{opacity:.95}}
/* header logo: paint via background so the site logo-painter can't clear the token mark */
.asset-logo[data-lxlogo]{background-size:cover!important;background-position:center!important;background-repeat:no-repeat!important;overflow:hidden;color:transparent!important;font-size:0!important}
/* The tile BEFORE any logo is known. The design ships this element as a blue "$" chip -- USDC's mark, the
   asset the mock page was drawn around -- so every token began life looking like USDC for as long as it
   took our script to run. Neutral instead: one quiet surface-coloured tile in both themes, which the real
   logo then replaces in a single step. Paired with the markup edit that drops the "$" glyph itself. */
.asset-logo:not([data-lxlogo]){background-image:none!important;background-color:rgba(127,127,127,.18)!important;color:transparent!important;font-size:0!important}
/* trade-widget: inline error + disabled CTA while amount is invalid/over balance */
.lxda-swaperr{color:var(--red,#ff5b5b);font-size:12.5px;font-weight:600;line-height:1.4;margin:0 0 9px}
.dxa-trade-cta[data-lxdis="1"]{opacity:.55;cursor:not-allowed;filter:grayscale(.25)}
/* trade-widget asset icons: paint via ::before (painter-proof) driven by --lxtic */
.dxa-pane-swap .dxa-trade-ic[data-lxic]{position:relative}
.dxa-pane-swap .dxa-trade-ic[data-lxic]::before{content:"";position:absolute;inset:0;background:var(--lxtic) center/cover no-repeat;border-radius:inherit;z-index:2}
/* limit-pane chips are icon-only (.dxa-trade-asset painted directly) — overlay the correct logo painter-proof */
.dxa-pane-limit .dxa-trade-asset[data-lxic]{position:relative;overflow:hidden;color:transparent!important}
.dxa-pane-limit .dxa-trade-asset[data-lxic]::before{content:"";position:absolute;inset:0;background:var(--lxtic) center/cover no-repeat;border-radius:50%;z-index:2}
/* our ::before owns the icon -> kill any base64 mock the element itself carries so it can't peek through */
.dxa-pane-swap .dxa-trade-ic[data-lxic],.dxa-pane-limit .dxa-trade-asset[data-lxic]{background-image:none!important}
/* You Pay quick %/MAX buttons: orange active state on click */
.dxa-pane-swap .dxa-trade-quick button.lxq-active{box-shadow:inset 0 0 0 3em #ea6a2c!important;color:#fff!important;border-color:#ea6a2c!important}
/* the page inherits -webkit-user-modify:read-only, which blocks TYPING into the swap/limit amount inputs (only %/MAX, which set .value programmatically, worked). Force the editable inputs back to read-write. */
.dxa-pane-swap .dxa-trade-ir input:not([readonly]),.dxa-pane-limit .dxa-trade-ir input:not([readonly]){-webkit-user-modify:read-write!important;user-modify:read-write!important}
/* Limit tab: MAX button on the Total row */
.dxa-pane-limit .dxa-trade-field .dxa-trade-frow .mono[data-lxbal]{margin-left:auto}
.dxa-pane-limit .dxa-trade-field .dxa-trade-frow .lxlim-max{margin-left:8px;padding:2px 8px;font:800 10px/1.4 'Hanken Grotesk',system-ui,sans-serif;letter-spacing:.03em;color:#ea6a2c;background:rgba(234,106,44,.12);border:1px solid rgba(234,106,44,.42);border-radius:6px;cursor:pointer;transition:background .15s}
.dxa-pane-limit .dxa-trade-field .dxa-trade-frow .lxlim-max:hover{background:rgba(234,106,44,.24)}
/* bottom-center copy toast */
#lxCenterToast{position:fixed;left:50%;bottom:34px;transform:translateX(-50%) translateY(12px);background:var(--text,#14151a);color:var(--surface,#fff);font:600 13.5px/1 'Hanken Grotesk',system-ui,sans-serif;padding:12px 20px;border-radius:11px;box-shadow:0 12px 34px rgba(0,0,0,.35);opacity:0;pointer-events:none;z-index:99999;transition:opacity .18s,transform .18s}
#lxCenterToast.show{opacity:1;transform:translateX(-50%) translateY(0)}
/* swap success/error toast — matches the design's "Copied to clipboard" toast exactly (self-contained copy of its CSS so it works before any copy has run) */
.lx-ctoast-stack{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none}
.lx-ctoast{background:var(--text,#16171b);color:var(--bg,#fff);padding:11px 18px 11px 14px;border-radius:10px;font-family:'Hanken Grotesk',system-ui,sans-serif;font-size:16px;font-weight:600;display:inline-flex;align-items:center;gap:9px;white-space:nowrap;box-shadow:0 12px 32px rgba(0,0,0,.28),0 2px 8px rgba(0,0,0,.16);animation:lxCtIn .25s ease}
.lx-ctoast .ci{width:18px;height:18px;border-radius:50%;background:var(--green,#35c07f);color:#fff;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
.lx-ctoast.lxda-terr .ci{background:var(--red,#ff5b5b)}
@keyframes lxCtIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
/* Discussions: hide the design's mock comment rows INSTANTLY (no flash); JS removes them + renders real posts (.lxda-mine) */
.dxa-disc-list .dxa-disc-row:not(.lxda-mine),.mdxa-disc-list .mdxa-disc-row:not(.lxda-mine){display:none!important}
/* The row is an <a> where the design shipped a <div>. With no anchor rule it took the browser default
   link styling -- blue and underlined, inherited by every child. Neutralise the ANCHOR only; the children
   keep whatever the design gives them. */
.mdxa-pl-list a.mdxa-pl-row{color:var(--text);text-decoration:none}
.mdxa-pl-list a.mdxa-pl-row .mdxa-pl-lp{font-size:10.5px;color:var(--text-soft)}
/* Layout guard for the swap panel, independent of the input cap above. A long number should shorten
   itself, never rearrange the card around it: the label row must stay one line with the label at its
   natural width, and the numbers ellipsis inside whatever space is left. Without this a big enough value
   wrapped "You pay" onto two lines and pushed the dollar figure outside the panel. */
.dxa-trade-frow{flex-wrap:nowrap;gap:10px;align-items:baseline}
.dxa-trade-frow>span:first-child{flex:0 0 auto;white-space:nowrap}
.dxa-trade-frow .mono{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dxa-trade-field input{min-width:0;max-width:100%}
/* Pay-side dollar value. The row is space-between with "You pay" on the left and the balance on the
   right; margin-left:auto pulls this into the right-hand group so the two sit together and the balance
   keeps its place. Allowed to shrink and ellipsis rather than push the balance off a narrow phone. */
.lx-oc{margin:10px 0 0;padding:11px 13px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2)}
.lx-oc-t{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-soft);margin-bottom:8px}
.lx-oc-r{display:flex;align-items:baseline;justify-content:space-between;gap:10px;font-size:12px;line-height:1.5}
.lx-oc-r span:first-child{color:var(--text-soft);white-space:nowrap}
.lx-oc-r b{font-weight:700;font-family:"JetBrains Mono",monospace;font-size:12px;white-space:nowrap}
.lx-oc-hi{color:var(--accent,#ea6a2c)}
.lx-oc-ok{color:var(--green,#35c07f)}
.dxa-trade-frow .lx-ltusd{margin-left:auto;margin-right:10px;white-space:nowrap;color:var(--text-soft)}
.dxa-trade-frow .lx-ltusd:empty{display:none}
.dxa-trade-frow .lx-payusd{margin-left:auto;margin-right:10px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dxa-trade-frow .lx-payusd:empty{display:none}
/* Pools tab pagination. An asset can sit in hundreds of pools (AQUA: 1,301), so the list is paged at
   25 rather than truncated -- the header count and the rows on screen have to agree. */
.lx-pl-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:13px 4px 2px;margin-top:6px;border-top:1px solid var(--border);font-size:13px;color:var(--text-soft)}
.lx-pl-foot .pc{display:flex;align-items:center;gap:0}
.lx-pl-foot button{background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:6px 13px;font:600 13px/1 'Hanken Grotesk',system-ui,sans-serif;color:var(--text);cursor:pointer}
.lx-pl-foot button:hover:not(:disabled){border-color:var(--accent-soft)}
.lx-pl-foot button:disabled{opacity:.4;cursor:default}
.lx-pl-foot .pmid{margin:0 12px;white-space:nowrap}
/* Phones: the info line stacks above the controls, and the controls stretch to a comfortable tap size. */
.mdxa-pools .lx-pl-foot{flex-direction:column;align-items:stretch;gap:8px;text-align:center;font-size:12.5px}
.mdxa-pools .lx-pl-foot .pc{justify-content:space-between}
.mdxa-pools .lx-pl-foot button{padding:9px 16px;font-size:13px}
/* description: two lines until asked otherwise. line-clamp keeps the cut on a line boundary rather
   than mid-glyph, and collapses back cleanly when expanded. */
/* held until the stellar.toml attempt concludes, so the generic line is never painted then replaced */
.asset-description.lx-descwait{visibility:hidden}
.asset-description.lx-clamp{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;
overflow:hidden;margin-bottom:0}
/* The same two-line clamp, applied BEFORE any script runs. The description ships in full and was only
   clamped once clampSetup added .lx-clamp, so the first paint drew it at its natural height and every
   pixel of the difference was taken out of the page below it -- measured on LUMOS, 98px collapsing to
   39px, which shifted the stat boxes up. A long toml description moves them further still, which is
   why the boxes appeared to land nowhere near where they first painted.
   Keyed on the ABSENCE of the ready marker, so this governs only the pre-script moment: once
   clampSetup has run, .lx-clamp is in charge again and Show more / Show less behave exactly as before. */
.asset-description:not(.lx-descready){display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;
overflow:hidden;
/* Reserve the Show more control too. It is created by clampSetup, so at first paint it does not exist
   and everything below sat 24px high -- its 20px box plus its 4px margin. Reserving it here means the
   boxes land where they painted for any description long enough to need the control, which is the case
   that moved them furthest. A description too short to clamp gets no button and settles up by this
   much instead; that is the smaller error of the two and it is bounded, where the old behaviour scaled
   with the length of the text. */
margin-bottom:24px}
.lx-descmore{display:none;margin-top:4px;background:none;border:0;padding:0;cursor:pointer;
color:var(--accent,#ea6a2c);font:700 14px/1.4 "Hanken Grotesk",system-ui,sans-serif}
.lx-descmore.on{display:inline-block}
.lx-descmore:hover{text-decoration:underline}
/* Price change, relocated under the chart: a row of six inside the chart card rather than a card of
   its own. Card chrome comes off because it now sits on the chart card surface, and a hairline rule
   separates it from the plot. */
.chart-section .dxa-perf-card{background:none;border:0;border-radius:0;padding:14px 0 0;
margin-top:16px;border-top:1px solid var(--border)}
/* the six cells say 1h/24h/7d themselves, so the "Price change" caption is redundant here */
.chart-section .dxa-perf-lbl{display:none}
.chart-section .dxa-perf-grid{grid-template-columns:repeat(6,1fr);gap:8px}
/* Six across needs about 110px each. Below that it falls back to the 3x2 it always had, which is a
   real arrangement rather than six squeezed cells. */
@media (max-width:1180px){.chart-section .dxa-perf-grid{grid-template-columns:repeat(3,1fr)}}
.lxda-disc-empty{text-align:center;padding:30px 12px;color:var(--text-soft,#8a8fa3);font:600 14px/1.5 'Hanken Grotesk',system-ui,sans-serif}
.dxa-disc-text{margin-top:4px;line-height:1.5;word-break:break-word}
/* Exchanges tab: hide its count badge INSTANTLY (JS was hiding it after data load -> a visible count->hidden flash) */
.tabs-bar .tab[data-tab="exchanges"] .count,.tab[data-tab="exchanges"] .count{display:none!important}
/* restyle_dexstats hides EVERY tab count under 760px because the badges overflowed the 342px strip and
   made it draggable. Bring all three back, but abbreviated on mobile (2.32M, not 2,322,349) so the width
   they cost is bounded -- a seven-digit holder count is what caused the overflow, not the badge itself.
   Exchanges stays hidden: that badge was removed deliberately. */
@media (max-width:760px){
.tabs-bar .tab[data-tab="discussions"] .count,
.tabs-bar .tab[data-tab="holders"] .count,
.tabs-bar .tab[data-tab="pools"] .count{display:inline-block!important}
.tabs-bar .tab[data-tab="discussions"] .count,.tabs-bar .tab[data-tab="holders"] .count{margin-left:3px}
.tabs-bar .tab{font-size:11px!important;letter-spacing:-0.1px}
.tabs-bar .tab .count{font-size:9px!important;padding:1px 4px!important;margin-left:3px!important}}
/* Limit-tab chips: force a real 26px circle (they were rendering as ovals) */
.dxa-pane-limit .dxa-trade-asset[data-lxic]{width:26px!important;height:26px!important;min-width:26px!important;max-width:26px!important;flex:0 0 26px!important;border-radius:50%!important;padding:0!important;box-sizing:border-box}
/* Smart Swap badge — shown in the swap pane when a Soroban AMM (Soroswap/Phoenix/Aquarius) beats the classic Horizon path */
.lx-dxsmart{display:flex;align-items:center;gap:10px;margin:0 0 10px;padding:9px 11px;border-radius:11px;background:linear-gradient(100deg,rgba(234,106,44,.10),rgba(234,106,44,.03));border:1px solid rgba(234,106,44,.34)}
.lx-dxsmart .lx-sb-ic{flex:0 0 26px;width:26px;height:26px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;background:#ea6a2c;color:#fff}
.lx-dxsmart .lx-sb-ic svg{width:15px;height:15px;fill:currentColor}
.lx-dxsmart .lx-sb-mid{flex:1;min-width:0}
.lx-dxsmart .lx-sb-ttl{font:800 12.5px/1.2 'Hanken Grotesk',system-ui,sans-serif;color:var(--text,#14151a)}
.lx-dxsmart .lx-sb-sub{font:600 11.5px/1.3 'Hanken Grotesk',system-ui,sans-serif;color:var(--text-soft,#8a8fa3);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lx-dxsmart .lx-sb-sub b{color:#ea6a2c}
.lx-dxsmart .lx-sb-best{flex:0 0 auto;font:800 10.5px/1 'Hanken Grotesk',system-ui,sans-serif;letter-spacing:.03em;text-transform:uppercase;color:#ea6a2c;background:rgba(234,106,44,.14);border:1px solid rgba(234,106,44,.4);border-radius:7px;padding:5px 8px}
${DXA_SUPINFO_CSS}
.stat-cell .val.lx-hasinfo{overflow:visible!important}
/* The 24h change, small, inside the Price card -- it used to have a whole card to itself.
   It rides on the SUB line, immediately after the dollar price, and the placement is measured rather than
   picked. Beside the big number is the obvious reading of "next to the price", and it does not survive the
   widths people actually use: the value line has 181px at a 1600px window and 141px at 1440, against 126px
   of price plus a ~50px chip, so the PRICE -- the one number the page exists for -- is what ellipsises.
   The sub line carries "$0.00032045" at ~75px in the same measure, so the pair fits with room, and .sub is
   allowed two lines, so a longer price wraps instead of truncating anything. It also groups the two
   secondary figures -- what it is worth, and how it moved -- on one line under the headline. */
/* #30: the 24h move is stated twice within one screen -- once as this chip inside the PRICE stat and
   again as the pill beside the headline price directly below it, where it is bigger and denominated to
   match the headline. Two figures for one number invite the reader to look for the difference. The
   chip goes; the pill stays. Hidden rather than unbuilt, because the same builder writes the USD
   sub-line next to it and that is still wanted. */
.stat-cell .sub .lx-pchg{display:none!important}
.lx-pchg{display:inline-block;font-size:11px;font-weight:800;letter-spacing:-.01em;padding:1px 6px;border-radius:5px;line-height:1.4}
.lx-pchg.up{color:var(--green,#35c07f);background:rgba(53,192,127,.14)}
.lx-pchg.down{color:var(--red,#ff5b5b);background:rgba(255,91,91,.14)}
/* #11: what the trade actually cost. Every row named a UNIT price and a quantity and left the reader
   to multiply a seven-decimal number by a six-figure one -- so the one thing a trade record is for,
   how much changed hands, was the one thing it did not say. On the phone it joins the sub line; on
   desktop it sits under the quantity, in the same cell, because a new column would push the table
   wider than the card. */
.lx-extot{display:block;margin-top:2px;font:600 11.5px/1.3 'JetBrains Mono',monospace;color:var(--text-soft)}
.lx-exmore{margin-left:10px;padding:3px 10px;border-radius:7px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);font-weight:700;font-size:12px;line-height:1.4;cursor:pointer;vertical-align:middle}
.lx-exmore:hover:not(:disabled){border-color:var(--accent);color:var(--accent)}
.lx-exmore:disabled{opacity:.6;cursor:default}
.dxa-ob-asks,.dxa-ob-bids{height:323px!important;max-height:323px!important}
.stat-cell .lx-supinfo::before{content:"i";display:block;font:italic 700 10px/16px Georgia,serif;color:inherit}
/* #8: the tooltip is 240px wide and anchored to the LEFT edge of the icon that opens it. The icon for
   Market Cap sits at x=259 in a 372px phone viewport, so the note ran 127px past the screen -- and
   .asset-card is overflow:hidden, so it was clipped rather than merely off-screen. Unreadable either
   way: "90% (9B LUMOS) sup…".
   Two anchors, by how much room is left. On a desktop card the last two cells open their note to the
   RIGHT edge instead of the left, which is deterministic (four cells, a fixed grid) and needs no
   measuring. */
.stat-cell .lx-supinfo:hover::after{left:0!important;transform:none!important;width:min(240px,70vw)!important}
.stat-row .stat-cell:nth-child(n+3) .lx-supinfo:hover::after{left:auto!important;right:0!important}
/* On a phone there is no "other side" to open towards -- 240px does not fit beside anything in 372px.
   The note anchors to the ROW instead of the icon (hence position:static on the icon: a ::after seeks
   the nearest POSITIONED ancestor) and spans it, inset from both edges, so it cannot leave the card in
   either direction. Above the row rather than below it, because below is where the card ends. */
@media(max-width:760px){
.stat-row{position:relative}
.stat-cell .lx-supinfo{position:static!important}
.stat-cell .lx-supinfo:hover::after,
.stat-row .stat-cell:nth-child(n+3) .lx-supinfo:hover::after{
  left:10px!important;right:10px!important;width:auto!important;max-width:none!important;
  transform:none!important;bottom:calc(100% + 8px)!important}
}
/* Pool pair icons. 22px sat below the 15px pair label beside them, so a row read as text with two specks
   of colour rather than a pair of tokens. 30px gives a logo enough room to be recognised at a glance and
   balances the line; the ring is the row background, so overlapping discs stay separated on any surface. */
.dxa-pl-pair{gap:12px}
/* item 3: the row is the control now, so it has to look like one. */
tr.dxa-pl-row{cursor:pointer;transition:background .14s ease}
tr.dxa-pl-row:hover{background:rgba(127,127,140,.07)}
.dxa-pl-ico{width:34px;height:34px;font-size:14px;border-width:3px;box-shadow:0 1px 4px rgba(0,0,0,.4)}
.dxa-pl-ico + .dxa-pl-ico{margin-left:-11px}
/* the page asset leads the pair, so it sits in front rather than behind the counterpart */
.dxa-pl-icos .dxa-pl-ico{position:relative}
.dxa-pl-icos .dxa-pl-ico:first-child{z-index:2}
.mdxa-pl-l .dxa-pl-ico{width:30px;height:30px;font-size:13px}
.stat-cell .lx-supinfo{width:16px!important;height:16px!important;flex:0 0 16px!important;border:1.4px solid var(--text-soft,#8a8fa3)!important;border-radius:50%!important;background:none!important;font:italic 700 10px/16px Georgia,serif!important;margin-left:7px!important;vertical-align:middle}</style>`;

const SCRIPT = `<script id="lx-dxadata">(function(){document.addEventListener("input",function(e){var t=e.target;if(t&&t.tagName==="INPUT"&&t.closest&&t.closest(".dxa-pane-limit")){try{setLimitTotalUsd();}catch(_){}try{setOrderCtx();}catch(_){}}},true);setInterval(function(){try{setLimitTotalUsd();}catch(_){}try{setOrderCtx();}catch(_){}},1000);var DXA_SUPPLY_NOTE_S="${DXA_SUPPLY_NOTE}";
  // shared verified set, same as the wallet, Trade main and search
  var VFD=${JSON.stringify(VERIFIED)};
  // See CANONICAL in lib.js. The codes that mean exactly one issuer, so an asset wearing one under a
  // different issuer can be named for what it is instead of vaguely warned about.
  var CANON=${JSON.stringify(CANONICAL)};

  // What WE show as an asset home domain where the on-chain value is stale (LUMOS still declares the
  // pre-rename lumosdao.io). Display only -- never the toml fetch, which 404s on the new domain.
  var DDOM=${JSON.stringify(DOMAIN_DISPLAY)};
  function dispDom(c,i,d){ return DDOM[(c||"")+"|"+(i||"")]||d||""; }
  var VTICK='<span class="lx-vtick" title="Verified issuer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>';
  if(window.__lxDXA)return;window.__lxDXA=true;
  var H="https://horizon.stellar.org";                       // MAINNET
  var CG="https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd&include_24hr_change=true";
  var DEFAULT_CODE="LUMOS", DEFAULT_ISSUER="GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S";
  var LUMOS_LOGO="/assets/tokens/lumos.png";
  // hardcoded real logos so common assets never fall back to the initials-avatar placeholder (toml image is CORS-flaky/slow)
  var LOGO_ISS={USDC:"GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",EURC:"GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2",AQUA:"GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",yXLM:"GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55"};
  // ^ canonical issuers, verified on mainnet by holder count (Horizon /assets -> accounts.authorized).
  //   403 distinct assets use the code "USDC", 96 use "AQUA", 109 use "yXLM". Matching a logo on CODE
  //   alone paints a real project's brand onto any look-alike token, so LOGOS is only honoured when the
  //   issuer matches. Codes with no verified issuer (e.g. BTC, ambiguous across anchors) resolve by the
  //   exact code+issuer lookup below instead, and fall back to a generated avatar.
  // The baked registry (window.__lxTokenRegistry, emitted into <head> at build time). Synchronous, so
  // it is known on the first paint. This page previously depended on the toml fetch, which only runs once
  // a home domain is known -- and stellar.expert reports domain:(none) for many of our own assets, so for
  // those the fetch never happened and the header stayed a letter avatar.
  function dxaReg(code,iss){
    try{
      var R=window.__lxTokenRegistry; if(!R||!code||!iss)return "";
      var v=R[code+"-"+iss]; var u=(v&&typeof v==="object")?v.image:v;
      return (typeof u==="string"&&u.charAt(0)==="/"&&u.indexOf("//")!==0)?u:"";
    }catch(e){ return ""; }
  }
  function brandLogo(code,iss){ var u=LOGOS[code]; if(!u)return ""; var want=LOGO_ISS[code]; if(!want)return ""; return (iss&&iss===want)?u:""; }   // NOTE: NOT knownLogo() — that name is already taken below by the page-asset check
  function logoKey(code,iss){ return code+"-"+(iss||""); }
  function cachedLogo(code,iss){ try{ return (window.__lxLogosI||{})[logoKey(code,iss)]||""; }catch(e){ return ""; } }
  var LOGOS={USDC:"https://assets.coingecko.com/coins/images/6319/small/usdc.png",EURC:"https://assets.coingecko.com/coins/images/26045/small/euro.png",AQUA:"https://aqua.network/assets/img/aqua-logo.png",yXLM:"https://assets.coingecko.com/coins/images/100/small/fmpFRHHQ_400x400.jpg",BTC:"https://assets.coingecko.com/coins/images/1/small/bitcoin.png"};

  // ---- selected asset (from ?asset=CODE-ISSUER, or ?code=&issuer=; default LUMOS) ----
  var CODE=DEFAULT_CODE, ISSUER=DEFAULT_ISSUER, NATIVE=false;
  (function parseAsset(){
    try{
      var p=new URLSearchParams(location.search);
      // clean urls put the asset in the path (/trade/stellar/<CODE>-<ISSUER>); fall back to ?asset=
      var a=(window.__lxRoute&&window.__lxRoute.asset)||p.get("asset"), code=p.get("code"), iss=p.get("issuer");
      if(a){ if(a.toUpperCase()==="XLM"){ code="XLM"; iss=""; } else { var dash=a.indexOf("-"); if(dash>0){ code=a.slice(0,dash); iss=a.slice(dash+1); } } }
      if(code){ CODE=code.trim(); ISSUER=(iss||"").trim(); }
      if(CODE.toUpperCase()==="XLM"){ NATIVE=true; CODE="XLM"; ISSUER=""; }
    }catch(e){}
  })();
  var ATYPE=NATIVE?"native":(CODE.length<=4?"credit_alphanum4":"credit_alphanum12");
  var RESV=CODE+":"+ISSUER;                                   // liquidity-pool reserve id form
  // stellar.expert has no page for one trade; /op/<id> opens the TRANSACTION that contains it with its
  // operations listed, which is the closest thing. The row link used EXPLORER — the asset page — so every
  // row on every asset pointed at the same place and told you nothing about the trade you clicked.
  function tradeHref(r){ return (r&&r.op)?("https://stellar.expert/explorer/public/op/"+r.op):EXPLORER; }
  var EXPLORER=NATIVE?"https://stellar.expert/explorer/public/asset/XLM":("https://stellar.expert/explorer/public/asset/"+CODE+"-"+ISSUER);

  // ---- live data ----
  // seed XLM/USD from a shared localStorage cache so a CoinGecko 429 never blanks the USD values (falls back
  // to the last-known price, <=6h old; shared "lumos.xlmUsd" key written by every page on success).
  var xlmUsd=(function(){try{var c=JSON.parse(localStorage.getItem("lumos.xlmUsd")||"null");return (c&&+c.v>0&&(Date.now()-c.ts<216e5))?+c.v:0;}catch(e){return (window.__lxXlmUsd||0);}})();   // XLM/USD (CoinGecko, cached)
  var assetXlm=NATIVE?1:0;                                    // asset price in XLM
  var chg24=null, vol24Xlm=null, volChg=null;                // 24h change / volume / vol change
  // #19: SCOP read +2.82% on the dashboard and -0.97% here, and BOTH were right. The dashboard prices
  // it in dollars (stellar.expert price7d); this page priced it in XLM (Horizon trade_aggregations
  // against native). XLM itself moved +10.33% that day, so an asset can rise in dollars and fall
  // against XLM at the same moment. Nothing on either screen said which unit it meant, so the same
  // asset appeared to contradict itself -- one green, one red.
  //
  // Dollars win, because every other surface already speaks them: the dashboard, search, movers, this
  // page's own volume and market cap. The XLM figure stays on the page as the PAIR price, where it
  // belongs, and is labelled as such.
  var chgSe=null;        // stellar.expert price7d -- the dashboard's own source, so preferring it makes
                         // the two screens agree by construction rather than by coincidence
  var chgCg=null;        // CoinGecko usd_24h_change (XLM native)
  var chgXlm24=null;     // Horizon daily buckets, priced in XLM
  // #11/#21: TRUE when the newest daily bucket is recent enough for "24h" to mean 24h.
  //
  // trade_aggregations is asked for the two most recent buckets THAT EXIST, not the last two days. For
  // an asset whose last trade was months ago those are two ancient buckets, and the difference between
  // them was being printed as a 24h move: WAZAAA read +1020.82% on a token that had not traded in 113
  // days, and LUMOS read +90.76%. The figure was real; the label was a lie.
  var chg24Fresh=false;
  var chg24X=null;       // the change the XLM view shows, unconverted
  var xlmChg24=(function(){ try{ var c=JSON.parse(localStorage.getItem("lumos.xlmUsd")||"null");
    return (c&&c.chg!=null&&(Date.now()-c.ts<216e5))?+c.chg:null; }catch(e){ return null; } })();
  function recomputeChg(){
    // Nothing traded inside the window, so nothing moved inside the window. Both figures are zero and
    // the pill renders them grey, which is how the reader tells a real flat day from a silent one.
    if(!chg24Fresh){ chg24=0; chg24X=0; return; }
    // The XLM view shows the pair move as Horizon reports it -- no conversion, because that IS the
    // number this page is denominated in.
    chg24X=(chgXlm24!=null)?chgXlm24:null;
    if(chgSe!=null){ chg24=chgSe; return; }
    if(chgCg!=null){ chg24=chgCg; return; }
    // The XLM-denominated move converted into dollars: the asset against XLM, times XLM against USD.
    if(chgXlm24!=null&&xlmChg24!=null){ chg24=((1+chgXlm24/100)*(1+xlmChg24/100)-1)*100; return; }
    // Deliberately NOT the bare XLM figure. Showing that here is exactly what contradicted the
    // dashboard; a dash says "not known yet", which is true and does not mislead.
    chg24=null;
  }
  var supply=null, holders=null, poolCount=null, activePools=null, liqXlm=null, assetInPools=null, liqNat=null, liqPoolPair=null;
  // N3: holders is NOT the trustline count -- see the note in the transform. Null until the record lands.
  var holdersFunded=null;
  var seUsd=0;                                               // stellar.expert USD price — real fallback for assets with no XLM orderbook (e.g. PYUSD)
  // chg7d used to be one variable fed by two sources in two different units -- stellar.expert's
  // price7d is USD, Horizon's back(7) is XLM -- so the 7d cell changed denomination depending on
  // which lookup answered last. Kept apart, each is only ever read in the unit it was measured in.
  var chg7dX=null;                                           // 7d from Horizon candles, in XLM
  var chg7dU=null;                                           // 7d from stellar.expert price7d, in USD
  // XLM's own move in dollars over each grid window, used to convert the XLM-measured cells.
  var xu1h=null, xu7d=null, xu1m=null, xu3m=null, xu6m=null;
  var chg1h=null, chg1m=null, chg3m=null, chg6m=null;        // the rest of the performance grid, computed from real candles
  var natMcap=0, natVol=0;                                   // XLM native: real market cap + 24h volume (USD, CoinGecko)
  // #5: is this address flagged by stellar.expert? One request per address, cached for the session --
  // the malicious/unsafe directory is 2,400+ entries and growing, so it cannot be pulled down whole.
  // A 404 (not listed) is a clean "no", and a network failure is NOT a "yes": it resolves false and is
  // not cached, so the question is asked again rather than answered wrongly.
  window.__lxSEUnsafe = window.__lxSEUnsafe || function(addr){
    if(!addr)return Promise.resolve(false);
    var P=window.__lxSEUnsafeP=(window.__lxSEUnsafeP||{});
    if(P[addr])return P[addr];
    var c=null; try{ c=sessionStorage.getItem("lxsed:"+addr); }catch(_){}
    if(c!=null){ P[addr]=Promise.resolve(c==="1"); return P[addr]; }
    // Only a CONCLUSIVE answer is cached. 404 means "not in the directory", which is a real no; a 429
    // or a 5xx means we were not told, and caching that as a no would mark a genuinely flagged asset
    // safe for the rest of the session. stellar.expert does rate-limit -- this is not hypothetical.
    P[addr]=fetch("https://api.stellar.expert/explorer/directory/"+addr)
      .then(function(r){
        if(r.status===404)return {tags:[]};
        if(!r.ok)throw new Error("se "+r.status);
        return r.json();
      })
      .then(function(j){
        var tg=(j&&j.tags)||[], bad=false;
        for(var i=0;i<tg.length;i++){ var t=String(tg[i]).toLowerCase();
          if(t==="malicious"||t==="unsafe"||t==="fraud"){ bad=true; break; } }
        try{ sessionStorage.setItem("lxsed:"+addr,bad?"1":"0"); }catch(_){}
        return bad;
      })
      .catch(function(){ delete P[addr]; return false; });
    return P[addr];
  };
  var WARN_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
  var UNSAFE_TAG='<span class="lx-unsafetag" title="Flagged as malicious on stellar.expert">'+WARN_SVG+'Unsafe</span>';
  // Re-asserted on every header pass: the design re-renders this row, and a tag inserted once would be
  // wiped by the next re-render.
  var LXFLAG=null;      // {txt,tip} -- whichever warning applies, or none
  function lxPaintUnsafe(){
    if(!LXFLAG)return;
    var nm=document.querySelector(".asset-name"); if(!nm||!nm.parentNode)return;
    // The impersonation check is local and lands first; the stellar.expert answer arrives later and
    // must not stack a second tag beside it. Keyed on the text, so a real change still repaints.
    var ex=nm.parentNode.querySelector(".lx-unsafetag");
    if(ex){ if(ex.getAttribute("data-lxk")===LXFLAG.txt)return;
      if(ex.parentNode)ex.parentNode.removeChild(ex); }
    var t=document.createElement("span");
    t.className="lx-unsafetag"; t.setAttribute("title",LXFLAG.tip); t.setAttribute("data-lxk",LXFLAG.txt);
    t.innerHTML=WARN_SVG+LXFLAG.txt;
    nm.parentNode.insertBefore(t,nm.nextSibling);
  }
  var homeDomain=null, tomlDesc=null, tomlImg=null, tomlX=null, tomlTg=null;
  // #4: the green padlock beside the issuer is a claim, not decoration -- it says this asset cannot be
  // minted any further -- and the design ships it baked into the markup, so it was shown for EVERY
  // asset. USDC is not locked: Circle holds five signers on that issuer. An asset is locked only when
  // NO key can sign for the issuing account any more, which is exactly max(signer weight) === 0.
  // Verified against Horizon: USDC 5 signers/max weight 1 -> not locked; SHX 1 signer/weight 0 -> locked.
  // null = we have not been told yet, and an unanswered question is not a yes.
  var issLocked=null;
  // Has the stellar.toml attempt CONCLUDED, either way? The description used to be written the moment the
  // header had a code, which meant the generic sentence was painted and then swapped for the real one a
  // moment later -- a visible flash of the wrong copy on every asset that has a description. The line is
  // now held back until this is true, so the reader sees one sentence rather than two.
  var tomlSettled=false;
  function tomlDone(){ if(tomlSettled)return; tomlSettled=true; try{ guardApply(); }catch(_){} }
  // The same idea for the logo, but on its OWN flag rather than sharing tomlSettled: our mints settle the
  // description early from the icon manifest, and the logo must not settle with them or it would paint
  // from whatever is known at that instant and then be overwritten when the toml image lands.
  // ownLogo means the manifest already gave us the authoritative picture for one of our own assets, so a
  // later toml image -- the same artwork under a different URL -- must not trigger a second paint.
  var logoSettled=false, ownLogo=false;
  function logoDone(){ if(logoSettled)return; logoSettled=true; try{ guardApply(); }catch(_){} }
  var dayOHLC=null;                                          // {o,h,l,c,v} from the latest daily aggregation

  // HOST FALLBACK, which GUARDRAILS E12 has always required and this layer never had.
  //
  // Horizon allows 100 requests per 5 minutes PER IP, and one asset page spends 15-20 of them. Two or
  // three page views in quick succession exhaust the budget, and after that every figure sourced from
  // Horizon -- 24h volume, the 24h change, the OHLC strip, 1D high/low -- renders as an honest but useless
  // dash, while the figures sourced from stellar.expert keep working. That is exactly the state this page
  // was reported in, on two different machines.
  //
  // The retry has to hang off the REJECTION, not off a 429 status: Horizon's 429 carries no CORS header,
  // so the browser never gets to read the status at all and the whole thing surfaces as a bare
  // "TypeError: Failed to fetch". A readable 4xx is a real answer ("no such asset") and is not re-asked.
  var H2="https://horizon.stellar.lobstr.co";
  function j(u){
    return fetch(u).then(function(r){ if(!r.ok)throw new Error("HTTP"+r.status); return r.json(); })
      .catch(function(e){
        var m=String((e&&e.message)||""), readable=(m.indexOf("HTTP")===0), code=readable?+m.slice(4):0;
        if(readable && code>=400 && code<500 && code!==429) throw e;   // a real "no" -- do not ask twice
        if(u.indexOf(H)!==0) throw e;
        return fetch(H2+u.slice(H.length)).then(function(r){ if(!r.ok)throw new Error("HTTP"+r.status); return r.json(); });
      });
  }
  // /trade_aggregations is the ONLY metered Horizon endpoint. Measured 2026-08-25, same IP, same second:
  // /assets, /liquidity_pools, /order_book and /trades all answered 200 and sent no X-RateLimit headers at
  // all, while /trade_aggregations answered 429 with x-ratelimit-remaining:0 -- and stayed exhausted through
  // a 17-minute silence. It is a separate 100-per-5-minutes allowance.
  //
  // This page fires FOUR of them per view (24h, 1h, the 200-bar daily, and the chart), so roughly 25 asset
  // views exhaust the budget for everyone behind that IP -- and an office or a phone network is one IP. Past
  // that, Horizon 429s, and because its 429 carries no Access-Control-Allow-Origin header the browser cannot
  // read the status: it surfaces as an opaque "Failed to fetch" and the .catch() below swallows it. One
  // cause, two reported symptoms: 3M/6M dashed on most assets, and the chart sometimes never drew.
  //
  // So go through our own edge cache first -- a server has neither the rate limit nor the CORS problem, and
  // the cached response collapses many visitors into one upstream hit. Fall back to Horizon directly when
  // that is not there, so localhost (where Pages Functions do not run) behaves exactly as before.
  function jAgg(o){
    var ord=o.order||"desc", lim=o.limit||200;
    var qs="a="+encodeURIComponent(CODE+"-"+ISSUER)+"&res="+o.res+"&order="+ord+"&limit="+lim;
    if(o.start)qs+="&start="+o.start;
    if(o.end)qs+="&end="+o.end;
    var direct=H+"/trade_aggregations?base_asset_type="+ATYPE+"&base_asset_code="+CODE
      +"&base_asset_issuer="+ISSUER+"&counter_asset_type=native&resolution="+o.res
      +"&order="+ord+"&limit="+lim
      +(o.start?("&start_time="+o.start):"")+(o.end?("&end_time="+o.end):"");
    return fetch("/lxapi/candles?"+qs)
      .then(function(r){ if(!r.ok)throw new Error("HTTP"+r.status); return r.json(); })
      .then(function(d){ if(d&&d.error)throw new Error(String(d.error)); return d; })
      .catch(function(){ return j(direct); });
  }
  function q(s){return document.querySelector(s);}
  function qa(s){return [].slice.call(document.querySelectorAll(s));}
  function setText(el,t){if(el&&t!=null&&el.textContent!==t)el.textContent=t;}
  // AUDIT (flash sweep): reveal each masked mock the instant the engine overwrites it. One observer beats
  // patching every write site (setText, the OHLC set(), setSummary, the balance row, the tab counts) and
  // stays correct as new writers are added.
  var LXMASK=".crumb span:last-child,.price-display .big,.price-display .change-pill,.price-display .meta b.mono,.ohlc-strip .pair .v,.dxa-perf-grid .dxa-perf-cell .ch,.mdxa-perf-grid .mdxa-perf-cell .ch,.tabs-bar .tab .count,.dxa-trade-frow .mono,.dxa-trade-summary .dxa-tsum-row .mono,.dxa-hl-stat .val";
  // mark the masked element itself AND any masked descendants: if a block is rebuilt wholesale the mutation
  // target is the container, so closest() alone would never reach the masked leaves inside it.
  // AUDIT (user-reported: Holders flashed 12,408 before 199): these two groups sit inside blocks the DESIGN
  // itself re-renders, so the descendant-marking below was revealing them the moment the design inserted its
  // MOCK — exactly backwards. They are strict: only an explicit lxMark() from one of our writers reveals them.
  // .price-display .meta b.mono joins the strict group: the design re-renders that block, and the observer's
  // descendant-marking was revealing its mock ("1D High 4.62 XLM") before the failsafe could dash it.
  var LXSTRICT=".dxa-hl-stat .val,.tabs-bar .tab .count,.price-display .meta b.mono,.price-display .change-pill,.ohlc-strip .pair .v";
  function lxMark(el){ if(el&&el.classList)el.classList.add("lxp"); return el; }
  function lxPainted(node){ if(!node)return; var el=(node.nodeType===3)?node.parentElement:node;
    if(!el||!el.closest)return; var t=el.closest(LXMASK); if(t&&t.classList&&!t.matches(LXSTRICT))t.classList.add("lxp");
    if(el.querySelectorAll){ var d=el.querySelectorAll(LXMASK); for(var i=0;i<d.length;i++){ if(!d[i].matches(LXSTRICT))d[i].classList.add("lxp"); } } }
  function lxUnmask(){
    try{ var mo=new MutationObserver(function(ms){ for(var i=0;i<ms.length;i++){ var m=ms[i];
      lxPainted(m.target);
      if(m.addedNodes)for(var j=0;j<m.addedNodes.length;j++)lxPainted(m.addedNodes[j]); } });
      mo.observe(document.body,{subtree:true,childList:true,characterData:true}); }catch(_){}
    // failsafe: never leave a value hidden because a fetch died, or because the real value happened to
    // equal the mock (setText skips a same-value write, so no mutation would ever fire)
    setTimeout(function(){ qa(LXMASK).forEach(function(e){
      // AUDIT: this used to dash only the STRICT group and reveal the rest as-is — which meant that on an
      // asset we have no price for (PEACE: AMM-only, no order book) the reveal exposed the design's mock
      // OHLC strip, "1D High 4.62 XLM", etc. Anything in this mask is asset-specific data we own, so if we
      // never wrote it we do not know it: dash it. Unknown, never invented.
      if(!e.classList.contains("lxp"))e.textContent="\\u2014";
      e.classList.add("lxp"); }); },6000);
  }
  if(document.readyState!=="loading")lxUnmask(); else document.addEventListener("DOMContentLoaded",lxUnmask);
  // Below 1e-8 a plain decimal is an unreadable run of zeros and exponential notation is trader-hostile,
  // so the zeros get counted into a subscript instead: 0.000000001234 -> 0.0(8)1234. At 1e-8 and above we
  // stay plain and trim the padding.
  //
  // Deliberately free of backslash escapes: this code is emitted through a template literal, which eats
  // one level of them -- a /\.$/ here would ship as /.$/ and delete the last digit of every price.
  var SUBD=String.fromCharCode(8320,8321,8322,8323,8324,8325,8326,8327,8328,8329);
  function zsub(n){ var s=String(n),o=""; for(var i=0;i<s.length;i++)o+=SUBD.charAt(+s.charAt(i)); return o; }
  function trimZ(t){ while(t.length>1&&t.charAt(t.length-1)==="0")t=t.slice(0,-1);
    if(t.charAt(t.length-1)===".")t=t.slice(0,-1); return t; }
  // #12: subscript kicked in only below 1e-8, so a token at 0.0000324 XLM rendered the full eight
  // decimals -- and the stat cell it lives in is narrower than that, so it showed "0.0000…". Half a
  // price is worse than a compressed one: nobody can tell 0.0000324 from 0.0000009 by its first four
  // characters. From five leading zeros the zero-run is written as a subscript count, which is the
  // convention every exchange uses for this, and 0.0000324 becomes 0.0\u2084324 -- seven characters
  // instead of nine, and complete.
  //
  // The threshold is FIVE, not four: 0.000324 is eight characters and perfectly readable spelled out,
  // and compressing something that already fits only makes it harder to read.
  function smallNum(x,sig){ x=+x||0; if(!(x>0))return "0";
    var e=x.toExponential((sig||4)-1), i=e.indexOf("e");
    if(i<0)return String(x);
    var mant=trimZ(e.slice(0,i)).split(".").join(""), exp=-parseInt(e.slice(i+1),10);
    if(exp>=5)return "0.0"+zsub(exp-1)+mant;
    if(x>=1e-8)return trimZ(x.toFixed(8));
    if(!(exp>1))return trimZ(x.toFixed(8));
    return "0.0"+zsub(exp-1)+mant; }
  function usd(x){x=+x||0;if(x>=1)return "$"+x.toLocaleString("en-US",{maximumFractionDigits:2});if(x>=0.01)return "$"+x.toFixed(4);if(x>0)return "$"+smallNum(x,4);return "$0";}
  function xlmAmt(x){x=+x||0;if(x>=1000)return Math.round(x).toLocaleString("en-US");if(x>=1)return (+x.toFixed(4)).toString();if(x>0)return smallNum(x,4);return "0";}
  function num(n){return Math.round(+n||0).toLocaleString("en-US");}
    // abbrNum rounds sub-1000 values to whole units, which reads as "0 BTC" for a real holding. Keep the
  // abbreviation for big numbers and give small ones enough places to exist. Trailing zeros trimmed so
  // 0.00002000 shows as 0.00002 rather than padding noise.
  function qtyTxt(n){ n=+n||0; var a=Math.abs(n);
    if(a>=1000)return abbrNum(n);
    if(a>=1)return n.toLocaleString("en-US",{maximumFractionDigits:2});
    if(a===0)return "0";
    // #21: "0.4397775 XLM" spends nine characters on precision nobody reads in a trade feed, and it is
    // the widest thing in a narrow row. Cut it at three decimals and say so with two dots, so the reader
    // knows the figure continues rather than believing it ended there. The dots only appear when
    // something was actually dropped -- an exact 0.5 stays "0.5".
    //
    // Only above a thousandth: below that, three decimals would round the whole number away, and
    // smallNum's leading-zero compression is the right tool (0.0000009 -> 0.0(5)9, every digit kept).
    if(a>=0.001){ var _t=n.toFixed(3); return (Math.abs((+_t)-n)<1e-12) ? String(+_t) : (_t+".."); }
    return (n<0?"-":"")+smallNum(Math.abs(n),4); }
  function abbrNum(n){n=+n||0;var a=Math.abs(n);if(a>=1e9)return (n/1e9).toFixed(2)+"B";if(a>=1e6)return (n/1e6).toFixed(2)+"M";if(a>=1e3)return (n/1e3).toFixed(1)+"K";return String(Math.round(n));}
  function abbrUsd(n){n=+n||0;var a=Math.abs(n);if(a>=1e9)return "$"+(n/1e9).toFixed(2)+"B";if(a>=1e6)return "$"+(n/1e6).toFixed(2)+"M";if(a>=1e3)return "$"+(n/1e3).toFixed(1)+"K";if(a>=1)return "$"+n.toFixed(2);return usd(n);}
  function shortG(a){a=String(a||"");return a.length>12?a.slice(0,4)+"…"+a.slice(-4):a;}
  // N9: arrow out of a box -- the same mark the trade rows already use for "opens elsewhere".
  var XPO='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6"></path><path d="M20 4l-8.5 8.5"></path><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"></path></svg>';
  // The LumosDAO burn wallet -- 9B locked forever. See the note in the transform for why it is tagged
  // rather than removed from the list.
  var LX_BURN_ADDR="GBIU5NISX5IP6VXZK7DEKLZC4ZVPWNCDEYQLQGXG33Y3J2LHPKPCHUOK";
  var LX_LUMOS_ISS="GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S";
  function burnTag(addr){
    if(addr!==LX_BURN_ADDR)return "";
    if(!(CODE==="LUMOS"&&ISSUER===LX_LUMOS_ISS))return "";
    return '<span class="lx-burntag" title="Locked forever \u2014 not in circulation">Burned</span>';
  }
  function priceUsd(){return assetXlm*xlmUsd;}
  // circular initial-avatar as an SVG data-URI background (fallback logo for arbitrary Stellar tokens)
  function avatarBg(code){ var c=String(code||"?"); var hue=0; for(var i=0;i<c.length;i++)hue=(hue*31+c.charCodeAt(i))%360;
    var init=c.replace(/[^A-Za-z0-9]/g,"").slice(0,2).toUpperCase()||"?"; var fs=init.length>1?15:20;
    var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="hsl('+hue+',60%,50%)"/><text x="20" y="'+(init.length>1?26:27)+'" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="'+fs+'" fill="#fff">'+init+'</text></svg>';
    return "url(\\"data:image/svg+xml,"+encodeURIComponent(svg)+"\\")"; }
  // neutral gradient (NO letter) — the header's initial "logo pending" state for an unknown asset, so the
  // real logo (fetched async by loadSeLogo) fades in over a plain circle instead of a jarring letter->logo flash.
  function plainBg(code){ var c=String(code||"?"),hue=0; for(var i=0;i<c.length;i++)hue=(hue*31+c.charCodeAt(i))%360; return "linear-gradient(135deg,hsl("+hue+",52%,42%),hsl("+((hue+38)%360)+",52%,30%))"; }
  function knownLogo(){ return (CODE==="LUMOS")||LOGOS[CODE]||dxaReg(CODE,ISSUER)||tomlImg; }
  // Assets we hold the mark for ourselves, which OUTRANK whatever the issuer's toml publishes.
  //
  // LUMOS is the case that matters: its issuer still declares home_domain=lumosdao.io, and that domain's
  // toml publishes an older Image.png, so preferring the toml put the wrong LumosCore mark on our own
  // token -- the full flame is /assets/tokens/lumos.png, which is what every other page shows. This is
  // the same reason the page already DISPLAYS lumoscore.com for LUMOS rather than the on-chain value.
  // Everything else still prefers the issuer's own artwork; this only covers marks we publish.
  function brandFirst(){ return (CODE==="LUMOS")||!!LOGOS[CODE]; }
  function logoBg(){ if(CODE==="LUMOS")return "url("+LUMOS_LOGO+")"; if(LOGOS[CODE])return "url("+LOGOS[CODE]+")"; var _r=dxaReg(CODE,ISSUER); if(_r)return "url("+_r+")"; if(tomlImg)return "url("+tomlImg+")"; return avatarBg(CODE); }

  // ================= HEADER =================
  function clampSetup(desc){
    if(!desc||desc.__lxclamp)return; desc.__lxclamp=1;
    // Hands the clamp over from the static pre-paint rule to .lx-clamp. Added FIRST so there is no
    // frame in which neither is clamping.
    desc.classList.add("lx-clamp");
    desc.classList.add("lx-descready");
    var b=document.createElement("button");
    b.type="button"; b.className="lx-descmore"; b.textContent="Show more";
    b.addEventListener("click",function(){
      var open=desc.classList.toggle("lx-clamp")===false;
      desc.__lxopen=open?1:0;                 // remember it: the painter re-runs on every data tick
      b.textContent=open?"Show less":"Show more";
    });
    if(desc.parentNode)desc.parentNode.insertBefore(b,desc.nextSibling);
    desc.__lxbtn=b;
  }
  // Only offer the control when there is actually more to show. Measured against the clamped box, so a
  // short description gets no button at all rather than one that expands nothing.
  function clampDesc(desc){
    if(!desc)return; var bt=desc.__lxbtn; if(!bt)return;
    // Overflow is measured against the CLAMPED box whatever the current state, then the reader is given
    // their choice back. Without __lxopen an expanded description snapped shut on the next price tick,
    // because this runs on every render -- the reader would be mid-sentence and lose the text.
    var open=desc.__lxopen===1;
    desc.classList.add("lx-clamp");
    var overflows=desc.scrollHeight>desc.clientHeight+1;
    if(open)desc.classList.remove("lx-clamp");
    if(overflows){ bt.classList.add("on"); bt.textContent=open?"Show less":"Show more"; }
    else { bt.classList.remove("on"); desc.classList.add("lx-clamp"); desc.__lxopen=0; bt.textContent="Show more"; }
  }
  function applyHeader(){
    // The MOBILE build wraps the same header in .asset-top, not .asset-header. Matching only the
    // desktop wrapper meant applyHeader() returned on its first line on every phone, so the header kept
    // the design's baked demo asset: open AQUA and you got AQUA's price under USDC's name, logo,
    // description, circle.com link and a foreign 0x… issuer. Every INNER class is shared, so accepting
    // both wrappers is the whole fix.
    function lxMergeV(VFDmap,after){ window.__lxCuratedV=window.__lxCuratedV||fetch("/lxapi/assetmeta").then(function(r){return r.ok?r.json():null;}).then(function(d){return (d&&d.verified)||{};}).catch(function(){return {};}); window.__lxCuratedV.then(function(vf){ var added=0;   Object.keys(vf).forEach(function(id){ var r=vf[id]; if(!r||!r.v)return;     var i=id.lastIndexOf("-"); if(i<0)return;     var k=id.slice(0,i)+"|"+id.slice(i+1);     if(VFDmap[k]===undefined){ VFDmap[k]=r.d||""; added++; } });   if(added&&after){ try{ after(); }catch(_){} } }); } var hdr=q(".asset-header")||q(".asset-top"); if(!hdr)return;
    // name + ticker
    setText(q(".asset-name"), CODE);
    function lxTick(){ try{ var _nm=q(".asset-name");
      if(_nm&&_nm.parentNode){
        var _ok=VFD[CODE+"|"+ISSUER]!==undefined, _b=_nm.parentNode.querySelector(".lx-vtick");
        if(_ok&&!_b){ var _s=document.createElement("span"); _s.className="lx-vtick"; _s.title="Verified issuer";
          _s.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'; _nm.parentNode.insertBefore(_s,_nm.nextSibling); }
        else if(!_ok&&_b&&_b.parentNode){ _b.parentNode.removeChild(_b); }
      } }catch(_){} } lxTick(); lxMergeV(VFD,lxTick);
    // #5: and the same flag on the page the search leads to -- a warning that only appears in the popup
    // is a warning you can walk straight past. Asked once; the tag is inserted when the answer lands.
    // Impersonation is checked FIRST and wins. It needs no network, it is true by construction, and
    // "Not the real USDC" tells someone what to do about it in a way "Unsafe" never does.
    try{ var _cn=CANON[CODE];
      if(_cn&&ISSUER&&_cn.issuer!==ISSUER&&!LXFLAG)
        LXFLAG={txt:"Not the real "+CODE,
          tip:"The real "+CODE+" is issued by "+_cn.by+" ("+shortG(_cn.issuer)
            +"). This one has the same ticker and a different issuer."};
    }catch(_){}
    try{ if(ISSUER&&!window.__lxUnsafeAsked){ window.__lxUnsafeAsked=1;
      window.__lxSEUnsafe(ISSUER).then(function(bad){ if(!bad||LXFLAG)return;
        LXFLAG={txt:"Unsafe",tip:"Flagged as malicious on stellar.expert"};
        try{ lxPaintUnsafe(); }catch(_){} }); } }catch(_){}
    try{ lxPaintUnsafe(); }catch(_){}
    setText(q(".asset-ticker"), CODE);
    // logo mark — painted ONCE, and only when the sources have settled.
    //
    // This used to paint immediately with whatever was known, so a token could show three marks in a
    // second: the design's baked blue "$" tile, then stellar.expert's icon, then the issuer's own toml
    // image. All three are drawn by different code paths, so no single one of them looked wrong.
    // Holding the paint until logoSettled makes the whole sequence one transition: neutral tile -> the
    // real logo. Until then this leaves the element alone, so nothing is stamped and nothing repaints.
    var lg=q(".asset-logo");
    // tomlImg FIRST, deliberately. logoBg() ranks the hardcoded LOGOS map above it, but the old code
    // painted the issuer's own toml image LAST and directly, so that is what actually ended up on screen.
    // Ranking it first here keeps the final logo byte-identical to before -- the only thing this change
    // removes is the frames in between. The chip painters keep using logoBg() exactly as they did.
    if(lg&&logoSettled&&lg.getAttribute("data-lxlogo")!==CODE){ lg.setAttribute("data-lxlogo",CODE); lg.textContent="";
      lg.style.setProperty("background-image", (!brandFirst()&&tomlImg)?("url("+tomlImg+")"):(knownLogo()?logoBg():(NATIVE?plainBg(CODE):avatarBg(CODE))), "important"); }
    // issuer address: set data-copy + the visible truncated text. The design's re-render/reskin engine can
    // hold a REFERENCE to the original text node (restoring its baked mock "0x…") OR re-create the whole
    // node. Fix = (1) clone -> replaceChild ONCE to orphan any stored reference; (2) on EVERY pass also
    // re-correct data-copy + the text (idempotent) so an in-place rewrite is instantly reverted too. Combined
    // with the dedicated synchronous header observer (guardHeader) this sits rock-steady with no flicker.
    function fixTextNode(el,want){ var tn=[].slice.call(el.childNodes).filter(function(n){return n.nodeType===3&&(n.nodeValue||"").replace(/\\s/g,"");})[0];
      if(tn){ if(tn.nodeValue.trim()!==want)tn.nodeValue=" "+want+" "; return true; } return false; }
    qa(".asset-meta-row .addr,.asset-meta .addr").forEach(function(sp){
      var want=NATIVE?"Native (XLM)":shortG(ISSUER);
      if(sp.getAttribute("data-lxfixed")!=="1"){
        var c=sp.cloneNode(true); c.setAttribute("data-lx-noswap",""); c.setAttribute("data-lxfixed","1");
        if(!fixTextNode(c,want))c.insertBefore(document.createTextNode(" "+want+" "), c.querySelector(".copy-i")||null);
        c.setAttribute("data-copy", NATIVE?"native":ISSUER);
        if(sp.parentNode){ sp.parentNode.replaceChild(c,sp); sp=c; }
      }
      if(sp.getAttribute("data-copy")!==(NATIVE?"native":ISSUER))sp.setAttribute("data-copy", NATIVE?"native":ISSUER);
      fixTextNode(sp,want);                                    // re-assert on every pass (beats in-place reverts)
      // #4: hide the padlock unless this issuer really is locked. Re-asserted on every pass, because the
      // design re-renders this row; and hidden outright for XLM, which has no issuer to lock.
      // The DESKTOP markup gives the padlock class="lock-i"; the PHONE markup gives it no class at
      // all, so a class selector found nothing there and every asset kept its padlock on mobile --
      // which is where this was reported. Fall back to the shape: the shackle path is unique to the
      // lock, and the copy icon beside it draws something else entirely.
      var _lk=sp.querySelector(".lock-i");
      if(!_lk){ var _svgs=sp.querySelectorAll("svg");
        for(var _i=0;_i<_svgs.length;_i++){
          if((_svgs[_i].innerHTML||"").indexOf("M7 11V7")>=0){ _lk=_svgs[_i]; break; } } }
      if(_lk){ var _on=(!NATIVE&&issLocked===true);
        if(_lk.style.display!==(_on?"":"none"))_lk.style.display=_on?"":"none";
        if(_on&&_lk.getAttribute("data-tooltip")!=="Supply locked — no key can sign for this issuer")
          _lk.setAttribute("data-tooltip","Supply locked — no key can sign for this issuer"); }
    });
    // website / home domain (same engine-revert issue -> clone-replace once, then re-assert)
    // While the domain is UNKNOWN (fetch pending/failed) hide the link entirely — the baked mock reads
    // "circle.com" and was visible from first paint on every non-USDC asset until home_domain resolved.
    var web=q(".asset-meta-row .website,.asset-meta .website");
    if(web&&homeDomain==null){ if(web.style.display!=="none")web.style.display="none"; }
    if(web&&homeDomain!=null){
      if(web.getAttribute("data-lxfixed")!=="1"){
        var c2=web.cloneNode(true); c2.setAttribute("data-lxfixed","1"); c2.setAttribute("data-lx-noswap","");
        if(web.parentNode){ web.parentNode.replaceChild(c2,web); web=c2; }
      }
      var _hd=dispDom(CODE,ISSUER,homeDomain);
      if(homeDomain){ if(web.style.display==="none")web.style.display=""; if(web.getAttribute("href")!=="https://"+_hd){ web.setAttribute("href","https://"+_hd); web.setAttribute("target","_blank"); web.setAttribute("rel","noopener"); }
        if(!fixTextNode(web,_hd))web.appendChild(document.createTextNode(" "+_hd));
      } else if(web.style.display!=="none"){ web.style.display="none"; }
    }
    // The social marks sit with the website link because they answer the same question -- where else
    // does this issuer exist. Rebuilt only when the set changes, so the header guard's re-asserts do not
    // churn them, and each is added only if the toml actually carried it.
    try{
      var _srow=web&&web.parentNode;
      if(_srow){
        var _want=(tomlX||"")+"|"+(tomlTg||"");
        if(_srow.getAttribute("data-lxsoc")!==_want){
          _srow.setAttribute("data-lxsoc",_want);
          qa(".lx-soc",_srow).forEach(function(n){ if(n.parentNode)n.parentNode.removeChild(n); });
          [[tomlX,X_SVG,"X"],[tomlTg,TG_SVG,"Telegram"]].forEach(function(p){
            if(!p[0])return;
            var a=document.createElement("a");
            a.className="lx-soc"; a.href=p[0]; a.target="_blank"; a.rel="noopener";
            a.setAttribute("title",p[2]); a.setAttribute("aria-label",p[2]);
            a.setAttribute("data-lxc",""); a.setAttribute("data-lx-noswap","");
            a.innerHTML=p[1];
            _srow.appendChild(a);
          });
        }
      }
    }catch(_){}
    // breadcrumb current-asset segment + document title
    var cs=qa(".crumb span").filter(function(s){return s.children.length===0&&(s.textContent||"").trim();}).pop();
    if(cs)setText(cs, CODE);
    var wantTitle=CODE+" price, pools and holders on Stellar | LumosCore"; if(document.title!==wantTitle)document.title=wantTitle;
    // Two-line clamp + a toggle, kept OUTSIDE the paragraph so the next textContent write cannot
    // destroy it. Idempotent: the button is created once and only its state is updated afterwards.
    clampSetup(q(".asset-description"));
    // description (TOML desc if present, else a generic per-asset line)
    var desc=q(".asset-description");
    // Hold the line until the toml attempt has CONCLUDED. Writing the generic sentence first and swapping
    // it for the real one a moment later is a visible flash of copy that was never true for this asset.
    var descReady=(tomlDesc||tomlSettled||NATIVE);
    if(desc&&!descReady)desc.classList.add("lx-descwait");
    if(desc&&descReady){ desc.classList.remove("lx-descwait"); var d=NATIVE?"XLM (Stellar Lumens) is the native asset of the Stellar network \\u2014 every other asset on this DEX trades against it. Market data is pulled live from CoinGecko and the Stellar network."
      :(tomlDesc||(CODE+" trades on the LumosCore DEX against XLM on Stellar mainnet. Live price, order book, trades and holders are pulled directly from the Stellar network.")); if(desc.textContent.trim()!==d.trim())desc.textContent=d;
      clampDesc(desc); }
    hdr.classList.add("lxda");
  }

  // ================= STAT CARDS (.stat-row, 6 cells) =================
  function applyStats(){
    // no XLM orderbook for this asset -> derive the XLM price from the stellar.expert USD price (real data,
    // harvested in loadSeLogo). Real trade-agg/orderbook loaders overwrite assetXlm when they DO have data.
    if(!(assetXlm>0)&&seUsd>0&&xlmUsd>0)assetXlm=seUsd/xlmUsd;
    var pu=priceUsd();
    // Every branch now has an honest "—" fallback: the cells are baked with the design's USDC mock (4.2271 XLM,
    // +2.66%, circle/FDV numbers). If only PART of the data loads (e.g. supply but no XLM market), the .lxda
    // reveal used to expose the remaining mock values as if real — dash anything we don't actually know.
    qa(".stat-row .stat-cell").forEach(function(cell){
      var lbl=((cell.querySelector(".lbl")||{}).textContent||"").trim().toLowerCase();
      var val=cell.querySelector(".val"), sub=cell.querySelector(".sub");
      // The 24h change now rides INSIDE this cell rather than owning one of its own, pinned to the label
      // row -- see .lx-pchg in the stylesheet for why it is not beside the number.
      if(lbl.indexOf("price")===0){
        // The change chip lives on the sub line, so the sub is written as markup rather than through
        // setText. Guarded on a signature: applyStats runs on every data arrival AND again from the
        // observer, and rewriting innerHTML unconditionally would churn the node on every pass -- which is
        // both a wasted reflow and an invitation for the logo painter to have another go at it.
        var _chip=(chg24!=null)?('<span class="lx-pchg '+(chg24>=0?"up":"down")+'" data-lxc>'+(chg24>=0?"+":"")+chg24.toFixed(2)+'%</span>'):"";
        function _setSub(txt){ if(!sub)return; var sig=txt+"|"+_chip;
          if(sub.getAttribute("data-lxsub")===sig)return;
          sub.setAttribute("data-lxsub",sig); sub.innerHTML=txt+_chip; }
        if(NATIVE){ if(xlmUsd>0){ if(val)setText(val,usd(xlmUsd)); _setSub("Stellar Lumens \\u00b7 native"); } else { if(val)setText(val,"—"); _setSub(""); } }   /* native: USD is the price — "1 XLM" was meaningless */
        else if(assetXlm>0){ if(val)val.innerHTML=xlmAmt(assetXlm)+'<span class="u">XLM</span>'; if(pu>0)_setSub(usd(pu)); } else { if(val)setText(val,"—"); _setSub(""); } }
      // Dispatch is by LABEL TEXT, and the mobile build abbreviates two of them: "24h Change" -> "24h"
      // and "24h Volume" -> "Volume". Neither matched, so on every phone those two cells kept the
      // design's baked demo (+2.66% / +0.0422 XLM and 4.14M / $980K) for EVERY asset — the two cells
      // beside them updated, which made the fake pair look real. Exact-match the short labels too.
      else if(lbl.indexOf("24h change")===0||lbl==="24h"){ if(chg24!=null&&val){ var up=chg24>=0; val.className="val change "+(up?"up":"down")+" mono"; setText(val,(up?"+":"")+chg24.toFixed(2)+"%"); } else if(val){ setText(val,"—"); if(val.className!=="val mono")val.className="val mono"; } if(sub&&sub.style.display!=="none")sub.style.display="none"; }   /* % only, no XLM sub */
      else if(lbl.indexOf("24h volume")===0||lbl==="volume"){ if(NATIVE){ if(natVol>0){ if(val)setText(val,abbrUsd(natVol)); if(sub)setText(sub,"across all markets"); } else { if(val)setText(val,"—"); if(sub)setText(sub,""); } }
        else if(vol24Xlm!=null){ if(val)val.innerHTML=abbrNum(vol24Xlm)+'<span class="u">XLM</span>'; if(sub&&xlmUsd>0)setText(sub,usd(vol24Xlm*xlmUsd)); } else { if(val)setText(val,"—"); if(sub)setText(sub,""); } }
      else if(lbl.indexOf("market cap")===0){ if(pu>0&&supply>0){ var _lum=(CODE==="LUMOS"&&ISSUER==="GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S");var _circ=_lum?supply*0.1:supply; if(val){ if(_lum){ var _w=abbrUsd(_circ*pu); if(val.getAttribute("data-lxmc")!==_w){ val.setAttribute("data-lxmc",_w); val.innerHTML=_w+'<span class="lx-supinfo" data-tip="'+DXA_SUPPLY_NOTE_S+'">i</span>'; } val.classList.add("lx-hasinfo"); lxMark(val); } else setText(val,abbrUsd(_circ*pu)); } } else if(val)setText(val,"—"); if(sub&&sub.style.display!=="none")sub.style.display="none"; }   /* no FDV sub */
      else if(lbl.indexOf("liquidity")===0){ if(liqXlm!=null&&xlmUsd>0){ if(val)setText(val,abbrUsd(liqXlm*xlmUsd)); if(sub){ if(sub.style.display==="none")sub.style.display="";
        if(liqPoolPair){ setText(sub, liqPoolPair[0].code+": "+abbrNum(liqPoolPair[0].amt)+" | "+liqPoolPair[1].code+": "+abbrNum(liqPoolPair[1].amt)); }
        else if(assetInPools!=null){ var _p=[]; if(assetInPools>0)_p.push(CODE+": "+abbrNum(assetInPools)); if(liqNat>0)_p.push("XLM: "+abbrNum(liqNat)); setText(sub,_p.join(" | ")||(abbrNum(liqXlm)+" XLM TVL")); } } } else { if(val)setText(val,"—"); if(sub)setText(sub,""); } }
      else if(lbl.indexOf("supply")===0){ if(supply!=null){ if(val)setText(val,abbrNum(supply)); } else if(val)setText(val,"—"); if(sub)setText(sub,NATIVE?"XLM circulating":(CODE+" issued")); }   /* sub ALWAYS names THIS asset (the mock says "USDC issued") */
    });
    if(assetXlm>0||supply!=null){ var sr=q(".stat-row"); if(sr)sr.classList.add("lxda"); }
    // Published for the MOBILE trade adapter (_mobtrade.js). That pane is built from .mdxa-* markup with
    // no desktop counterpart, so it cannot reuse the selectors above — but it can reuse the values.
    try{ window.__lxDXAcode=CODE; window.__lxDXAissuer=ISSUER; window.__lxDXAnative=!!NATIVE;
         if(assetXlm>0)window.__lxDXAassetXlm=assetXlm;
         // The canonical XLM mark, published so the mobile pane paints the same one. It used to scrape the
         // icon out of the design's markup, which on an Aptos-derived build is the APTOS logo.
         window.__lxDXAxlmLogo=xlmLogoCss();
         if(xlmUsd>0)window.__lxDXAxlmUsd=xlmUsd; }catch(_){}
    // chart-head price display (keep consistent with the selected asset). Same mock problem as the stat
    // cells: dash the baked price + HIDE the baked "▲ 2.66% (24h)" pill until the real change is known.
    var _pill=q(".price-display .change-pill");
    if(NATIVE){ setText(q(".price-display .big"), xlmUsd>0?(usd(xlmUsd)+" USD"):"—"); }   /* was "1 USD" (assetXlm=1) */
    else {
      // #19: dollars are the headline, so the number beside the change pill is in the same unit the
      // pill is. seUsd covers assets with no XLM orderbook at all, which have no assetXlm to convert.
      // #40: the headline follows the page toggle, which now starts on XLM. This is the pair price --
      // the thing the order book, the trades and the 1D range below are all quoted in -- so on the
      // default view it is the lumens figure, and the dollar figure only when the reader asks for it.
      // seUsd covers assets with no XLM order book at all; those have no XLM price to show and fall back
      // to dollars rather than to nothing.
      var _pu=(assetXlm>0&&xlmUsd>0)?(assetXlm*xlmUsd):(seUsd>0?seUsd:0);
      var _wantX=(cDenom()==="xlm"&&assetXlm>0);
      if(_wantX)setText(q(".price-display .big"), xlmAmt(assetXlm)+" XLM");
      else if(_pu>0)setText(q(".price-display .big"), usd(_pu));
      else if(assetXlm>0)setText(q(".price-display .big"), xlmAmt(assetXlm)+" XLM");
      else setText(q(".price-display .big"),"—");
      // ...and the pair price keeps its place, named. This is a CODE/XLM market and the order book,
      // trades and 1D range below are all quoted in XLM, so dropping it would be worse than useless.
      // A span, NOT a b.mono: applyOhlc addresses High and Low by index among .meta b.mono, and
      // inserting one in front of them would silently shift both.
      try{ var _mt=q(".price-display .meta");
        if(_mt&&assetXlm>0&&_pu>0){
          var _pp=_mt.querySelector(".lx-pairpx");
          if(!_pp){ _pp=document.createElement("span"); _pp.className="lx-pairpx";
            _mt.insertBefore(_pp,_mt.firstChild); }
          var _t=xlmAmt(assetXlm)+" XLM per "+CODE+" \u00b7 ";
          if(_pp.textContent!==_t)_pp.textContent=_t;
        } }catch(_){}
    }
    // NB: use classList, never className= — a wholesale class assignment on a later pass wipes the .lxp
    // reveal flag, and because setText skips a same-value write no mutation fires to put it back, so the
    // pill stays masked forever.
    // #40: the pill is denominated like the headline beside it -- the pair move on the XLM view, the
    // dollar move on the $ view. #33: "up" is removed explicitly, not just "down" toggled. The design
    // ships that class on the element and leaving it meant ZBS rendered a GREEN pill with a down arrow
    // reading -64.42%, contradicting itself inside one badge. #11/#21: a stale window is a grey zero.
    var _cv=(cDenom()==="xlm")?((chg24X!=null)?chg24X:chg24):chg24;
    if(_pill){ if(_cv!=null){ var _u=_cv>=0;
      _pill.classList.add("change-pill");
      _pill.classList.remove("up","down","lx-flat");
      if(!chg24Fresh)_pill.classList.add("lx-flat");
      else if(_u)_pill.classList.add("up"); else _pill.classList.add("down");
      _pill.title=chg24Fresh?"":"No trades in the last 24 hours";
      setText(_pill,(chg24Fresh?(_u?"▲ ":"▼ "):"")+Math.abs(_cv).toFixed(2)+"% (24h)");
      _pill.classList.add("lxp"); if(_pill.style.display==="none")_pill.style.display=""; }
      else if(_pill.style.display!=="none")_pill.style.display="none"; }
  }

  // ================= PERFORMANCE GRID (.dxa-perf-grid: 1h/24h/7d/1m/3m/6m) =================
  // Fully baked design mock (+0.42%/+2.66%/… — the data layer never touched it, so every asset showed the
  // same fake numbers). Fill 24h from the real chg24 and 7d from stellar.expert price7d; the horizons we
  // have no real data for get an honest "—" instead of an invented percentage.
  // Mobile names these .mdxa-perf-grid/.mdxa-perf-cell, so this returned on its first line there and the
  // baked mock survived — a dollar stablecoin reading "+47.62%" over 6 months. Same numbers, both layouts.
  // A window measured against XLM becomes a dollar figure by compounding it with XLM's own dollar
  // move over the same window. Null when either side is missing: the cell dashes rather than print a
  // number in the wrong unit, which is the whole failure being fixed here.
  function perfUsd(x,xu){ return (x==null||xu==null)?null:((1+x/100)*(1+xu/100)-1)*100; }
  function perfPick(x,xu){ return (cDenom()==="xlm")?x:perfUsd(x,xu); }
  function applyPerf(){
    var g=q(".dxa-perf-grid,.mdxa-perf-grid"); if(!g)return;
    var TFS=["1h","24h","7d","1m","3m","6m"];
    qa(".dxa-perf-grid .dxa-perf-cell,.mdxa-perf-grid .mdxa-perf-cell").forEach(function(cell,i){
      // LANDMINE: the design's data-logo painter treats ANY rounded element whose stripped text is 1-5
      // chars as a token-icon slot ("1h—" qualifies; the baked "+2.66%" escaped at 6 chars), wipes it and
      // paints a logo background. Its isCandidate() skips elements containing an <svg>/<img> child — so
      // plant a zero-size svg guard in every cell. Also undo any prior hijack + rebuild wiped .tf/.ch.
      if(cell.getAttribute("data-logo")){ cell.removeAttribute("data-logo"); cell.style.removeProperty("background"); cell.style.removeProperty("background-image"); cell.innerHTML=""; }
      var tf=cell.querySelector(".tf"), ch=cell.querySelector(".ch");
      if(!tf||!ch){ cell.innerHTML='<div class="tf">'+(TFS[i]||"")+'</div><div class="ch">—</div>'; tf=cell.querySelector(".tf"); ch=cell.querySelector(".ch"); }
      if(!cell.querySelector("svg")){ var gsvg=document.createElementNS("http://www.w3.org/2000/svg","svg"); gsvg.setAttribute("width","0"); gsvg.setAttribute("height","0"); gsvg.setAttribute("aria-hidden","true"); gsvg.style.cssText="position:absolute;width:0;height:0;overflow:hidden"; cell.appendChild(gsvg); }
      var key=((tf||{}).textContent||"").trim().toLowerCase();
      // The 24h cell was the only cell reading a USD figure while the page, the chart, the headline and
      // the other five cells were all in XLM. On FRED that printed the pill at +1.30% and this cell at
      // -0.38% in red -- one grid contradicting itself, and the reason the graph looked like it told a
      // different story. This is the exact expression the pill uses, so the two cannot disagree again.
      var v=null; if(key==="1h")v=perfPick(chg1h,xu1h);
      else if(key==="24h")v=((cDenom()==="xlm")?((chg24X!=null)?chg24X:chg24):chg24);
      // 7d is the one window with a directly measured dollar figure, so in $ it is preferred over a
      // conversion and the conversion is only the fallback.
      else if(key==="7d")v=(cDenom()==="xlm")?chg7dX:((chg7dU!=null)?chg7dU:perfUsd(chg7dX,xu7d));
      else if(key==="1m")v=perfPick(chg1m,xu1m); else if(key==="3m")v=perfPick(chg3m,xu3m);
      else if(key==="6m")v=perfPick(chg6m,xu6m);
      // NEVER leave the bare "dxa-perf-cell" class: the logo-painter targets exactly that (cells with an
      // up/down modifier are skipped) — dashed cells carry an inert "lx-nd" modifier to stay off its radar.
      // Rewriting className wholesale would strip the layout's own class — writing "dxa-perf-cell up" onto
      // a mobile cell drops mdxa-perf-cell and the grid loses its styling. Keep whichever base the cell
      // already has; only the state modifier is ours.
      // No regex here on purpose: this whole script lives inside a JS string in the transform, so a "\s"
      // written here reaches the browser as a bare "s" — /(^|\s)mdxa-perf-cell(\s|$)/ silently became
      // /(^|s)mdxa-perf-cell(s|$)/, never matched, and every mobile cell got the desktop class.
      var base=(" "+(cell.className||"")+" ").indexOf(" mdxa-perf-cell ")>=0?"mdxa-perf-cell":"dxa-perf-cell";
      if(v!=null){ setText(ch,(v>=0?"+":"")+v.toFixed(2)+"%"); var cls=base+" "+(v>=0?"up":"down"); if(cell.className!==cls)cell.className=cls; }
      else { setText(ch,"—"); if(cell.className!==base+" lx-nd")cell.className=base+" lx-nd"; }
    });
  }

  // ================= PRICE CHART (#dxaChart) =================
  var chartTF="1D", chartPts=null, chartWired=false, chartMode="area", chartTypeWired=false;
  // #17/#20. Two independent choices about what the chart MEANS, kept apart from how it is drawn.
  //
  // The series in chartPts is stored in DOLLARS per unit and always has been -- the axis divided by the
  // XLM rate on the way out. That is the whole reason both of these are cheap: the plotted shape does not
  // change under either choice (multiplying every point by a constant moves the min and the max with it),
  // so drawLine and drawCandles are untouched. Only the numbers written beside the curve change.
  //
  //   metric "mcap"  -> multiply by circulating supply
  //   denom  "xlm"   -> divide by the XLM/USD rate
  //
  // #5/#40: this page is denominated in XLM by default, and it keeps its OWN setting.
  //
  // It used to share lumos.dexDenom with the Trade pair list. That has to stop, because the two pages
  // now want opposite defaults for good reasons. This page is a PAIR view -- the asset against XLM is
  // what actually trades, and the order book, the OHLC strip and the rate line are all quoted that way,
  // so a dollar headline sat on top of a screen that was otherwise in lumens.
  //
  // The pair LIST is the opposite case and must stay in dollars: its whole job is "is this thing up or
  // down", and quoted against XLM every asset that merely held its dollar value read as a double-digit
  // loss on a day XLM rose. That was a reported bug and sharing one key would bring it straight back.
  var chartMetric="price", chartUiWired=false;
  // #27: the choice lasts for the page you made it on, and no longer.
//
// This used to persist to localStorage, so switching one asset to $ silently changed the default for
// every asset you opened afterwards -- including days later, with no memory of having set it. The
// asset pages are a browsing surface, and a browsing surface should open the same way every time.
// Window-scoped only: switching still holds while you are on the page, and a reload starts at XLM.
// (The Price/MCap metric already resets, since chartMetric is a plain module variable.)
function cDenom(){ return window.__lxAsDenom || "xlm"; }
  function setCDenom(v){ window.__lxAsDenom=v;
    try{ window.dispatchEvent(new CustomEvent("lx-asdenom",{detail:v})); }catch(_){} }
  // Null when the choice cannot be honoured -- no XLM rate, or no supply for a market cap -- and every
  // caller then falls back to plain dollars rather than printing a number scaled by a guess.
  function chartScale(){
    var sc=1;
    if(chartMetric==="mcap"){ if(!(supply>0))return null; sc*=supply; }
    if(cDenom()==="xlm"){ if(!(xlmUsd>0))return null; sc/=xlmUsd; }
    return sc;
  }
  function chartUnit(){ return cDenom()==="xlm"?"XLM":"$"; }
  // Market caps are large and read better abbreviated; a unit price needs its digits.
  function chartFmt(v){
    if(chartMetric==="mcap")return (cDenom()==="xlm")?(abbrNum(v)+" XLM"):abbrUsd(v);
    return (cDenom()==="xlm")?(axisNum(v)+" XLM"):("$"+axisNum(v));
  }
  function tfCfg(tf){ var m={
    "1D":{res:900000,span:86400000},
    "1W":{res:3600000,span:604800000},
    "1M":{res:86400000,span:2592000000},
    "1Y":{res:604800000,span:31536000000}}; return m[tf]||m["1D"]; }
  function axisLbl(t,tf){ var d=new Date(t),mo=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; if(tf==="1D")return (d.getHours()<10?"0":"")+d.getHours()+":00"; if(tf==="1Y")return mo[d.getMonth()]+" '"+String(d.getFullYear()).slice(2); return mo[d.getMonth()]+" "+d.getDate(); }
  // Label the axis from the DATA span, not the selected timeframe. While a new range loads, the chart
  // guardian keeps redrawing the PREVIOUS points, and keying the labels off chartTF stamped a fresh "1Y"
  // format onto one month of data — the axis read "Jul '26, Jul '26, Jul '26" while the line was still 1M.
  function spanTF(pts){ var d=pts[pts.length-1].t-pts[0].t;
    if(d<=172800000)return "1D";           // <= 2 days  -> hours
    if(d<=10368000000)return "1M";         // <= 120 days -> "Mon D"
    return "1Y"; }
  function fullDate(t){ var d=new Date(t),mo=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; var hm=(chartTF==="1D")?(", "+(d.getHours()<10?"0":"")+d.getHours()+":"+(d.getMinutes()<10?"0":"")+d.getMinutes()):""; return mo[d.getMonth()]+" "+d.getDate()+hm; }
  // A price on Stellar can be 1.5e-5 or 1234.5, so a fixed decimal count is wrong at one end or the other.
  // Four significant figures reads correctly across that whole range; trailing zeros are trimmed so the
  // column does not turn into a wall of noughts. No regex anywhere in here on purpose (DEV landmine 8):
  // a /.$/ written in this file arrives in the browser as /.$/ and would eat the last digit instead.
  // #13: axis labels are the width of the gutter they sit in, and "0.00003225" is wider than it.
  // Same compression as the price cells, so the axis and the headline agree on how a small number is
  // written -- two notations for one price on one screen would be worse than either.
  function axisNum(v){ if(!(v>0))return "0";
    if(v<1e-4)return smallNum(v,4);
    var s=(v>=1)?v.toFixed(4):v.toPrecision(4);
    if(s.indexOf("e")>=0)return s;
    if(s.indexOf(".")>=0){ while(s.length&&s.charAt(s.length-1)==="0")s=s.slice(0,-1);
                           if(s.charAt(s.length-1)===".")s=s.slice(0,-1); }
    return s; }
  // Five gridline values from the SAME mn/mx the line was plotted against -- never recomputed from the
  // raw points. The plot winsorises to the 5th-95th percentile, so an axis built from raw min/max would
  // label the chart with a scale it is not actually drawn on.
  // THE AXIS IS IN XLM, and the conversion is the point rather than a detail. loadChart multiplies every
  // point by xlmUsd, so the line has always been plotted in DOLLARS -- while the headline price, the OHLC
  // strip, the orderbook and the Price stat card are all in XLM. With no axis on the chart nobody could
  // see that the two halves of the page were quoting different units, which is exactly the kind of thing
  // that makes a correct figure look wrong next to a correct chart.
  //
  // Dividing the bounds back out is exact, not an approximation: the conversion is one constant multiply,
  // so winsorising in dollars and dividing gives the same numbers as winsorising in XLM. If the rate has
  // not landed yet the values are still honest dollars, so they are labelled as dollars rather than
  // mislabelled as XLM.
  function priceAxis(pc,mn,mx,topPct,botPct){
    var pr=pc.querySelector(".lxda-cprices");
    if(!pr){ pr=document.createElement("div"); pr.className="lxda-cprices"; pc.appendChild(pr); }
    if(topPct!=null){ pr.style.top=topPct.toFixed(3)+"%"; pr.style.bottom=botPct.toFixed(3)+"%"; }
    // item 20: the gridlines share the label band exactly, so they cannot drift apart.
    var gr=pc.querySelector(".lxda-cgrid");
    if(!gr){ gr=document.createElement("div"); gr.className="lxda-cgrid"; pc.insertBefore(gr,pc.firstChild); }
    if(topPct!=null){ gr.style.top=topPct.toFixed(3)+"%"; gr.style.bottom=botPct.toFixed(3)+"%"; }
    gr.style.display=(mx>mn)?"":"none";      // no scale, no grid
    if(!(mx>mn)){ pr.innerHTML=""; return; }
    // #17/#20: one scale, chosen above, instead of "divide by the rate if we have one". When the chosen
    // combination cannot be expressed (no rate, or a market cap with no supply) this falls back to the
    // dollars the series is already in, which is always available and never a guess.
    var sc=chartScale(), ok=(sc!=null);
    var a=ok?(mn*sc):mn, b=ok?(mx*sc):mx;
    var pre=(ok&&cDenom()==="xlm")?"":"$";
    var N=5,h="";
    // A market cap is eight or nine digits, and axisNum spells every one of them:  987946.5463 down
    // the side of a chart is not a label, it is an obstruction. Abbreviate that scale and leave the price
    // scale alone, where the digits are the whole point.
    function _al(v){ return (chartMetric==="mcap")
      ? ((cDenom()==="xlm")?abbrNum(v):abbrUsd(v))
      : (pre+axisNum(v)); }
    for(var i=0;i<N;i++){ var f=i/(N-1); h+='<span style="top:'+(f*100).toFixed(3)+'%">'+_al(b-f*(b-a))+'</span>'; }
    pr.innerHTML=h;
    // NAME THE UNIT. Priced in XLM the axis carries no symbol at all -- just bare numbers like 0.002039 --
    // so nothing on the chart said whether that was lumens or dollars, and for a sub-cent asset the two
    // are wildly different readings. A dollar axis at least has its "$". Top-right, outside the plot, so
    // it labels the scale without sitting on the data.
    var un=pc.querySelector(".lxda-cunit");
    if(!un){ un=document.createElement("div"); un.className="lxda-cunit"; pc.appendChild(un); }
    // This read a variable that no longer exists after the scale rewrite above, which threw a
    // ReferenceError right here and left the label blank -- silently, because the caller is wrapped.
    // It also has to name the METRIC now: "USD" alone does not distinguish a unit price from a market
    // cap, and on this axis the two differ by nine orders of magnitude.
    var uw=((chartScale()!=null&&cDenom()==="xlm")?"XLM":"USD");
    if(chartMetric==="mcap")uw="MCAP · "+uw;
    if(un.textContent!==uw)un.textContent=uw; }
  // How the plot is divided between price and volume. One function so the line chart, the candles and the
  // price axis cannot drift apart -- the axis has to span the PRICE band only, and hard-coding that split
  // in the stylesheet is exactly how it would end up labelling the bars.
  function volGeom(ih){ var volH=Math.round(ih*0.22), gap=12; return {volH:volH, gap:gap, priceH:ih-volH-gap}; }
  // SQUARE-ROOT SCALE, not linear, and this is the difference between a volume band and an empty strip.
  // DEX volume is violently long-tailed: measured on yXLM, the median session was 14.6 and the largest
  // 2,472 -- 169x. Scaled linearly against that maximum, 67 of 95 bars came out UNDER TWO PIXELS and the
  // median bar was 1.04px, at 38% opacity. The bars were all present in the DOM and none of them were
  // visible, which is exactly what was reported: "I still don't see any volume bars."
  //
  // sqrt compresses the tail so an ordinary session still reads while the outlier keeps the top of the
  // band. It costs strict proportionality -- a bar twice as tall is four times the volume, not twice --
  // which is why there is no volume axis and no label: the band answers "was there activity here", and
  // the hover tooltip carries the exact figure for anyone who wants it.
  // upFn(i) and xFn(i) are passed in because the two renderers disagree on both: candles know their own
  // direction from open vs close and sit on band centres, while the line chart can only compare a close to
  // the one before it and sits on point positions. Baking either assumption in here would misalign the
  // bars under one of them.
  function volBars(pts, upFn, xFn, iw, top, h, n){
    var vmax=0, i;
    for(i=0;i<pts.length;i++){ var v=+pts[i].vol||0; if(v>vmax)vmax=v; }
    if(!(vmax>0)) return "";
    var vroot=Math.sqrt(vmax);
    // 3 units is about 3px at the rendered size -- the floor is what keeps a real but small session from
    // rounding away to nothing, which reads as "no trades" rather than "few"
    var bw=Math.max(1, Math.min(14, iw/n*0.62)), out="";
    for(i=0;i<pts.length;i++){
      var vv=+pts[i].vol||0; if(!(vv>0)) continue;
      var bh=Math.max(3, (Math.sqrt(vv)/vroot)*h);
      out+='<rect class="lxda-vol" x="'+(xFn(i)-bw/2).toFixed(1)+'" y="'+(top+h-bh).toFixed(1)
        +'" width="'+bw.toFixed(1)+'" height="'+bh.toFixed(1)
        +'" fill="'+(upFn(i)?"#22c55e":"#ff5b5b")+'" fill-opacity="0.5"></rect>';
    }
    return out;
  }
  var _lastCW=0, _cwT=null;
  function chartWidthWatch(){
    if(window.__lxDXAcw)return; window.__lxDXAcw=1;
    try{
      window.addEventListener("resize",function(){
        clearTimeout(_cwT);
        _cwT=setTimeout(function(){
          var pc=q("#dxaChart")||q(".dxa-chart"); if(!pc||!chartPts)return;
          var w=Math.round(pc.getBoundingClientRect().width||0);
          if(!w||w===_lastCW)return;
          _lastCW=w;
          try{ drawChart(chartPts); }catch(_){}
        },180);
      },{passive:true});
    }catch(_){}
  }
  function drawChart(pts){ pts=pts||chartPts; if(!pts)return;
    try{ chartWidthWatch(); var _pcw=q("#dxaChart")||q(".dxa-chart"); if(_pcw)_lastCW=Math.round(_pcw.getBoundingClientRect().width||0); }catch(_){}
    // #23: whichever range actually drew is the one to light, and EVERY path ends here -- the
    // aggregations path, the trades fallback and a user click alike. The step-out case has already
    // called tfActive with the wider range it chose, and the ready flag stops this overwriting it.
    if(!document.documentElement.classList.contains("lxda-tfready"))tfActive(chartTF); if(chartMode==="candle"){ try{ drawCandles(pts); return; }catch(_){} } drawLine(pts); }
  // ---- candlesticks (real OHLC from the trade aggregations) ----
  function drawCandles(pts){
    var pc=q("#dxaChart,#mdxaChart"); if(!pc||!pts||pts.length<2)return;
    var svg=pc.querySelector("svg"); if(!svg){ svg=document.createElementNS("http://www.w3.org/2000/svg","svg"); pc.insertBefore(svg,pc.firstChild); }
    var W=900,HT=380,PADL=14,PADT=16,PADB=28,n=pts.length;
    // The gutter is sized in PIXELS, not viewBox units, and that is the whole point. viewBox units scale
    // 70 is NOT arbitrary: .lxda-cprices is a fixed 64px wide at right:4px, so the axis occupies 68 of
    // this gutter. Trying 58 to reclaim "wasted" space put the plot 12px underneath the price labels.
    // with the chart, so one fixed PADR gives 69px of gutter on a desktop and 35px on a phone -- while the
    // price label it has to hold is the same ~56px on both. A fixed 100 put every label 19px on top of the
    // line on a 375px handset. Deriving PADR from the measured width keeps the gutter constant instead,
    // and the cap stops a very narrow chart from spending more than a quarter of itself on the axis.
    var _pw=pc.getBoundingClientRect().width||622, PADR=Math.min(W*0.25, Math.round(900*70/_pw));
    var lows=pts.map(function(p){return p.l||p.v;}).slice().sort(function(a,b){return a-b;});
    var highs=pts.map(function(p){return p.h||p.v;}).slice().sort(function(a,b){return a-b;});
    var lo=lows[Math.floor(lows.length*0.03)]||lows[0], hi=highs[Math.ceil(highs.length*0.97)-1]||highs[highs.length-1];
    // #18: a 3rd/97th percentile fence sounds robust and is not, on the number of buckets a month
    // actually has. Thirty daily candles means the 97th percentile IS the second-highest wick -- so on
    // a thin token where one trade printed at 2.8x the going rate, the scale stretched to that wick and
    // every real candle collapsed into a flat line at the bottom. That is what "the chart appears
    // broken" was: an honest chart of one outlier.
    //
    // Tukey fence on the CLOSES instead -- the textbook outlier rule, and closes are the series the
    // chart is really about; wicks are excursions from it. Anything past the fence is not hidden: Y()
    // already clamps, so the wick still runs to the edge of the plot and says an excursion happened.
    // Only ever TIGHTENS the band, never widens it, and any degenerate case falls straight back to the
    // percentiles above.
    (function(){
      var cl=pts.map(function(p){return p.c||p.v;}).filter(function(x){return x>0;}).sort(function(a,b){return a-b;});
      if(cl.length<8)return;
      var q1=cl[Math.floor(cl.length*0.25)], q3=cl[Math.floor(cl.length*0.75)];
      var iqr=q3-q1; if(!(iqr>0))return;
      var fl=q1-1.5*iqr, fh=q3+1.5*iqr;
      var nlo=Math.max(lo,fl), nhi=Math.min(hi,fh);
      if(nhi>nlo){ lo=nlo; hi=nhi; }
    })();
    var rg=(hi-lo)||(hi||1), iw=W-PADL-PADR, ih=HT-PADT-PADB;
    var vol=volGeom(ih);
    function Y(v){ v=Math.max(lo,Math.min(hi,v)); return PADT+vol.priceH-((v-lo)/rg)*vol.priceH; }
    // Candles carry their own direction, so the bars take it from open/close rather than from the previous
    // close the way the line chart has to.
    var dir=pts.map(function(p){ return ((p.c||p.v)>=(p.o||p.v))?1:0; });
    var h=volBars(pts,
      function(i){ return !!dir[i]; },                                 // candles carry their own direction
      function(i){ return PADL+(i+0.5)/n*iw; },                        // and sit on band centres, not point positions
      iw, PADT+vol.priceH+vol.gap, vol.volH, n);
    var cw=Math.max(1.4, iw/n*0.6), co=[];
    pts.forEach(function(p,i){ var x=PADL+(i+0.5)/n*iw; co.push([x,Y(p.c||p.v)]);
      var up=(p.c||p.v)>=(p.o||p.v), col=up?"#22c55e":"#ff5b5b";
      var yH=Y(p.h||p.v),yL=Y(p.l||p.v),yO=Y(p.o||p.v),yC=Y(p.c||p.v), yT=Math.min(yO,yC), bh=Math.max(1,Math.abs(yC-yO));
      h+='<line class="lxda-candle" x1="'+x.toFixed(1)+'" y1="'+yH.toFixed(1)+'" x2="'+x.toFixed(1)+'" y2="'+yL.toFixed(1)+'" stroke="'+col+'" stroke-width="1"></line>';
      h+='<rect class="lxda-candle" x="'+(x-cw/2).toFixed(1)+'" y="'+yT.toFixed(1)+'" width="'+cw.toFixed(1)+'" height="'+bh.toFixed(1)+'" fill="'+col+'"></rect>';
    });
    svg.setAttribute("viewBox","0 0 "+W+" "+HT); svg.setAttribute("preserveAspectRatio","none"); svg.innerHTML=h;
    var dr=pc.querySelector(".lxda-cdates"); if(!dr){ dr=document.createElement("div"); dr.className="lxda-cdates"; pc.appendChild(dr); }
    var NL=5,dh=""; for(var qi=0;qi<NL;qi++){ var idx=Math.round(qi/(NL-1)*(n-1)); dh+='<span>'+(qi===NL-1?"Now":axisLbl(pts[idx].t,spanTF(pts)))+'</span>'; } dr.innerHTML=dh;
    priceAxis(pc,lo,hi, PADT/HT*100, (HT-(PADT+vol.priceH))/HT*100);
    pc.classList.add("lxda"); chartPts=pts; pc.__lxpts=pts; pc.__lxco=co; window._dxaChartState=null; setupChartHover(pc);
  }
  function drawLine(pts){
    var pc=q("#dxaChart,#mdxaChart"); if(!pc||!pts||pts.length<2)return;
    var svg=pc.querySelector("svg");
    if(!svg){ svg=document.createElementNS("http://www.w3.org/2000/svg","svg"); pc.insertBefore(svg,pc.firstChild); }
    var W=900,HT=380,PADL=14,PADT=16,PADB=28,n=pts.length;
    // The gutter is sized in PIXELS, not viewBox units, and that is the whole point. viewBox units scale
    // 70 is NOT arbitrary: .lxda-cprices is a fixed 64px wide at right:4px, so the axis occupies 68 of
    // this gutter. Trying 58 to reclaim "wasted" space put the plot 12px underneath the price labels.
    // with the chart, so one fixed PADR gives 69px of gutter on a desktop and 35px on a phone -- while the
    // price label it has to hold is the same ~56px on both. A fixed 100 put every label 19px on top of the
    // line on a 375px handset. Deriving PADR from the measured width keeps the gutter constant instead,
    // and the cap stops a very narrow chart from spending more than a quarter of itself on the axis.
    var _pw=pc.getBoundingClientRect().width||622, PADR=Math.min(W*0.25, Math.round(900*70/_pw));
    // winsorize to 5th-95th percentile (thin markets have bad-fill outliers that collapse the y-scale)
    var sorted=pts.map(function(p){return p.v;}).slice().sort(function(a,b){return a-b;});
    var lo=sorted[Math.floor(sorted.length*0.05)]||sorted[0], hi=sorted[Math.ceil(sorted.length*0.95)-1]||sorted[sorted.length-1];
    var cl=pts.map(function(p){return Math.max(lo,Math.min(hi,p.v));});
    var mn=Math.min.apply(null,cl),mx=Math.max.apply(null,cl),rg=(mx-mn)||(mx||1);
    var iw=W-PADL-PADR, ih=HT-PADT-PADB;
    // Split the plot: price on top, a volume band underneath. The volume was already on every point --
    // loadChart carries it and the hover tooltip has always printed it -- it simply was never drawn, so
    // the chart could show that a move happened but never whether anyone traded into it.
    var vol=volGeom(ih);
    var co=cl.map(function(v,i){return [PADL+(i/(n-1))*iw, PADT+vol.priceH-((v-mn)/rg)*vol.priceH];});
    var ln="M"+co.map(function(c){return c[0].toFixed(1)+" "+c[1].toFixed(1);}).join(" L");
    // the area closes on the bottom of the PRICE band, not the bottom of the plot, or the fill would
    // pour down through the bars
    var base=PADT+vol.priceH;
    var ar=ln+" L "+(PADL+iw)+" "+base+" L "+PADL+" "+base+" Z";
    // direction per point, for bar colour: a bar is green when that close is at or above the one before it
    var bars=volBars(pts,
      function(i){ return i===0 ? true : (cl[i]>=cl[i-1]); },        // line chart: close vs previous close
      function(i){ return PADL+(n>1?(i/(n-1))*iw:iw/2); },            // and point positions, matching the line
      iw, PADT+vol.priceH+vol.gap, vol.volH, n);
    svg.setAttribute("viewBox","0 0 "+W+" "+HT); svg.setAttribute("preserveAspectRatio","none");
    svg.innerHTML='<defs><linearGradient id="lxdaGrad" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="var(--accent,#ea6a2c)" stop-opacity="0.20"></stop><stop offset="100%" stop-color="var(--accent,#ea6a2c)" stop-opacity="0"></stop></linearGradient></defs>'
      +bars
      +'<path class="lxda-area" d="'+ar+'"></path><path class="lxda-line" d="'+ln+'"></path>';
    var a=svg.querySelector(".lxda-area"); if(a)a.setAttribute("fill","url(#lxdaGrad)");
    var l=svg.querySelector(".lxda-line"); if(l){l.setAttribute("fill","none");l.setAttribute("stroke","var(--accent,#ea6a2c)");l.setAttribute("stroke-width","2.5");l.setAttribute("stroke-linecap","round");l.setAttribute("stroke-linejoin","round");}
    // x-axis date row (absolute HTML)
    var dr=pc.querySelector(".lxda-cdates"); if(!dr){ dr=document.createElement("div"); dr.className="lxda-cdates"; pc.appendChild(dr); }
    var NL=5,h=""; for(var qi=0;qi<NL;qi++){ var idx=Math.round(qi/(NL-1)*(n-1)); h+='<span>'+(qi===NL-1?"Now":axisLbl(pts[idx].t,spanTF(pts)))+'</span>'; } dr.innerHTML=h;
    pc.classList.add("lxda"); chartPts=pts; pc.__lxpts=pts; pc.__lxco=co;
    priceAxis(pc,mn,mx, PADT/HT*100, (HT-(PADT+vol.priceH))/HT*100);
    window._dxaChartState=null;                                // disable the design's stale hover state
    setupChartHover(pc);
  }
  function setupChartHover(pc){
    var W=900,HT=380;
    var tip=pc.querySelector(".lxda-chtip"); if(!tip){ tip=document.createElement("div"); tip.className="lxda-chtip"; pc.appendChild(tip); }
    var dot=pc.querySelector(".lxda-chdot"); if(!dot){ dot=document.createElement("div"); dot.className="lxda-chdot"; pc.appendChild(dot); }
    var vl=pc.querySelector(".lxda-chvl"); if(!vl){ vl=document.createElement("div"); vl.className="lxda-chvl"; pc.appendChild(vl); }
    if(pc.__lxHoverWired)return; pc.__lxHoverWired=1;
    function move(e){
      var pts=pc.__lxpts, co=pc.__lxco; if(!pts||!co||pts.length<2)return;
      var svg=pc.querySelector("svg"),tip=pc.querySelector(".lxda-chtip"),dot=pc.querySelector(".lxda-chdot"),vl=pc.querySelector(".lxda-chvl");
      if(!svg||!tip||!dot||!vl)return;
      var r=svg.getBoundingClientRect(), pr=pc.getBoundingClientRect();
      var relX=e.clientX-r.left; if(relX<0)relX=0; if(relX>r.width)relX=r.width;
      var idx=Math.round(relX/r.width*(pts.length-1)); idx=Math.max(0,Math.min(pts.length-1,idx));
      var p=pts[idx], ox=r.left-pr.left, oy=r.top-pr.top;
      var sx=ox+co[idx][0]/W*r.width, sy=oy+co[idx][1]/HT*r.height;
      dot.style.left=sx+"px"; dot.style.top=sy+"px"; dot.style.opacity=1;
      vl.style.left=sx+"px"; vl.style.opacity=1;
      // Same unit as the axis it sits on, and the same order as the Price stat card: XLM first, dollars
      // underneath. It read dollars-only while every other price on the page read XLM.
      // The headline follows the chart: whatever the axis is counting, the tooltip says the same thing.
      // The dollar line underneath is kept only when the headline is NOT already in dollars, so the
      // reader never gets the same figure twice.
      var _sc=chartScale(), _ok=(_sc!=null);
      var _head=_ok?chartFmt(p.v*_sc):usd(p.v);
      var _sub=(_ok&&cDenom()==="xlm")?((chartMetric==="mcap")?abbrUsd(p.v*supply):usd(p.v)):"";
      tip.innerHTML='<div class="d">'+fullDate(p.t)+'</div>'
        +'<div class="l">'+((chartMetric==="mcap")?"Market cap":"Price")+'</div>'
        +'<div class="p">'+_head+'</div>'
        +(_sub?('<div class="v">'+_sub+'</div>'):'')
        // #17: volume alone does not say whether a bar was one whale or four hundred people. Horizon
        // returns trade_count on the same aggregation, so it costs nothing to say which -- and #24, it
        // gets its own row rather than being appended to the volume as small print.
        +'<div class="lxrow"><div class="l">Volume</div>'
          +'<div class="p">'+(p.vol>=0.01?abbrUsd(p.vol):"&lt;$0.01")+'</div></div>'
        +(p.n>0?('<div class="lxrow"><div class="l">Trades</div>'
          +'<div class="p">'+p.n.toLocaleString('en-US')+'</div></div>'):'');
      tip.style.opacity=1;
      var tw=tip.offsetWidth,th=tip.offsetHeight,tx=sx+14; if(tx+tw>pr.width)tx=sx-tw-14; if(tx<2)tx=2;
      tip.style.left=tx+"px"; tip.style.top=Math.max(2,sy-th-12)+"px";
    }
    function leave(){ ["lxda-chtip","lxda-chdot","lxda-chvl"].forEach(function(c){ var el=pc.querySelector("."+c); if(el)el.style.opacity=0; }); }
    // Removing the touchend handler was not enough on its own: a browser synthesises a mouse sequence
    // from a touch, so the mouseleave that follows the finger lifting erased the reading anyway --
    // the same symptom, arriving through the mouse path instead of the touch one. Measured: the tip
    // still went to opacity 0 with no touchend listener anywhere in the build.
    var _touchAt=0;
    pc.addEventListener("touchstart",function(){_touchAt=Date.now();},{passive:true});
    pc.addEventListener("touchmove",function(){_touchAt=Date.now();},{passive:true});
    pc.addEventListener("mousemove",move);
    pc.addEventListener("mouseleave",function(){ if(Date.now()-_touchAt<1500)return; leave(); });
    // follow a finger, not just a tap
    var _tp0=null;
    function tmove(ev){ var t=ev.touches&&ev.touches[0]; if(!t)return;
      if(_tp0&&ev.type==="touchmove"&&Math.abs(t.clientX-_tp0.x)>Math.abs(t.clientY-_tp0.y)){
        try{ ev.preventDefault(); }catch(_){}
      }
      move({clientX:t.clientX,clientY:t.clientY,target:ev.target}); }
    pc.addEventListener("touchstart",function(ev){
      var t=ev.touches&&ev.touches[0]; if(t)_tp0={x:t.clientX,y:t.clientY};
      tmove(ev); },{passive:true});
    pc.addEventListener("touchmove",tmove,{passive:false});
    // Deliberately NOT touchend/touchcancel. See above: the reading has to outlive the gesture.
    // A tap outside the chart is what dismisses it, matching the pool chart exactly.
    document.addEventListener("touchstart",function(ev){
      var t=ev.target;
      if(t&&t.closest&&(t.closest("#dxaChart")||t.closest(".chart-area")))return;
      leave();
    },true);
  }
  // Build a price series straight from executed trades. Used when trade_aggregations is empty, which is
  // ALWAYS the case for AMM-only assets (Horizon aggregates order-book trades only). Real executions, in
  // chronological order — no interpolation, no invention. Needs >=2 points to be a line worth drawing.
  // #15, second half. Both paths that can draw the chart now refuse to draw a series the reader has
  // moved on from.
  //
  // Without this, tapping 1M and then 1Y produced the 1M chart: the 1Y fetch succeeded and drew its 51
  // weekly points, and then 1M's SLOW trades fallback finished and painted its 29 daily points over the
  // top. The year of data was fetched, drawn, and then quietly replaced by the previous timeframe.
  function chartFromTrades(tf){
    if(chartTF!==tf)return;   // the reader moved on while this was being assembled
    var rows=window.__lxDXAtrades;
    if(!rows||rows.length<2){ chartEmpty(); return; }
    var cfg=tfCfg(tf), cut=Date.now()-cfg.span;
    var src=rows.slice().filter(function(r){ return r.px>0; });
    var use=src.filter(function(r){ return (r.ts||0)>=cut; });
    if(use.length<2){
      // step out to the first range that actually has a line, rather than asking the user to guess
      var _ORD=["1D","1W","1M","1Y"], _i=_ORD.indexOf(tf), _w=null, _wtf=null;
      for(var _k=(_i<0?0:_i+1);_k<_ORD.length;_k++){
        var _c=Date.now()-tfCfg(_ORD[_k]).span;
        var _u=src.filter(function(r){ return (r.ts||0)>=_c; });
        if(_u.length>=2){ _w=_u; _wtf=_ORD[_k]; break; } }
      // nothing inside any window but history exists -> draw everything we hold
      if(!_w&&src.length>=2){ _w=src; _wtf="1Y"; }
      if(!_w){ chartEmpty(src.length?1:0); return; }
      use=_w;
      tfActive(_wtf);
    }
    // the requested window drew fine, so it is the one to light
    if(!document.documentElement.classList.contains("lxda-tfready"))tfActive(tf);
    var pts=use.slice().sort(function(a,b){ return (a.ts||0)-(b.ts||0); }).map(function(r){
      var v=r.px*xlmUsd; return {t:r.ts||0, v:v, vol:(r.xlm||0)*xlmUsd, o:v, h:v, l:v, c:v}; });
    drawChart(pts);
  }
  // #23: the strip ships with 1D highlighted, but 1D is only the window we ASK for -- when an asset has
  // not traded inside it we step out to the first range that has a line, and the highlight jumped from
  // 1D to 1W a second after load. That reads as the page changing its mind.
  //
  // So nothing is highlighted until we know which window is actually being drawn. The build strips the
  // baked active class, and this sets it once, for whichever range won -- one state change instead of a
  // wrong one followed by a correction.
  function tfActive(tf){
    try{
      var ORD=["1D","1W","1M","1Y"];
      qa("[data-period],[data-tf],.timeframes button").forEach(function(b){
        var v=b.getAttribute("data-period")||b.getAttribute("data-tf")||(b.textContent||"").trim();
        if(ORD.indexOf(v)<0)return;
        b.classList.toggle("active", v===tf);
      });
      document.documentElement.classList.add("lxda-tfready");
    }catch(_){}
  }
  function chartEmpty(hasOlder){
    // An asset with nothing to draw never reaches drawChart, and the strip would sit with no range
    // highlighted at all. Light the one that was asked for: there is no data in any window, so the
    // request is the honest answer.
    if(!document.documentElement.classList.contains("lxda-tfready"))tfActive(chartTF);
    try{ var host=q("#dxaChart,#mdxaChart"); if(!host)return;
      var d=host.querySelector(".lx-dxa-nochart");
      if(!d){ d=document.createElement("div"); d.className="lx-dxa-nochart"; host.appendChild(d); }
      d.textContent=hasOlder?"No trades in this period \u2014 try a longer range.":"No trades yet \u2014 this asset has no price history to chart.";
      // clear any line left from a previous range so the message is not drawn over a stale chart
      var sv=host.querySelector("svg"); if(sv)[].slice.call(sv.querySelectorAll("path")).forEach(function(pp){ if((pp.getAttribute("class")||"").indexOf("lx-ch")>=0&&pp.parentNode)pp.parentNode.removeChild(pp); });
      host.classList.add("lxda");
    }catch(_){}
  }
  // The wide ranges are SLOW on Horizon — the 1Y weekly aggregation measures 6-8s against 0.8s for 1D —
  // and it intermittently answers with zero records (1 in 3 on measurement). Both failed silently: the
  // chart guardian keeps the PREVIOUS range on screen, so a 1Y click looked like it had been ignored, and
  // an empty answer fell straight through to chartFromTrades, drawing the last few HOURS of trades as the
  // "1Y" chart. So: mark the host while a fetch is in flight, and retry once before accepting "no data".
  function loadChart(tf,attempt){
    if(NATIVE)return;
    // #15: a SEQUENCE TOKEN, not a "currently fetching this timeframe" flag.
    //
    // The old dedupe stored the timeframe in loadChart._pending and refused any call matching it. That
    // has two failure modes and both were live. If any path returned without calling clear(), the flag
    // stayed set and every later tap on that same timeframe was silently ignored -- the request was
    // never even made. And it did nothing about the opposite race: a slow response for an ABANDONED
    // timeframe still drew itself over the one the reader had moved to, which is how tapping 1M then 1Y
    // left a month of data under a chart labelled 1Y.
    //
    // One counter fixes both. Every call takes the next token; a response is only allowed to draw while
    // its token is still the newest. Nothing to leak, and the newest tap always wins. Same pattern the
    // asset search in this codebase already uses.
    var myTok=(loadChart._tok=(loadChart._tok||0)+1);
    var live=function(){ return loadChart._tok===myTok; };
    chartTF=tf; var cfg=tfCfg(tf), now=Date.now(), start=now-cfg.span;
    var host=q("#dxaChart,#mdxaChart"); if(host)host.classList.add("lxda-loading");
    var clear=function(){ if(live()&&host)host.classList.remove("lxda-loading"); };
    var again=function(){ loadChart._tok=myTok-1; loadChart(tf,1); };   // hand the token on to the retry
    jAgg({res:cfg.res,order:"asc",limit:200,start:start,end:now}).then(function(d){
      var r=(d&&d._embedded&&d._embedded.records)||[];
      // #15: the 1Y chart was drawing about a month.
      //
      // Every point is multiplied by the XLM/USD rate to store the series in dollars, and the filter
      // below drops anything that comes out at zero. Before the rate lands that is EVERY point -- so a
      // perfectly good 51-week response (checked: Horizon returns all 51) was thrown away wholesale, the
      // code fell through to the raw-trades fallback, and that only reaches back as far as the recent
      // trade pages. 1M and 1Y ended up drawing the identical series.
      //
      // The records are fine; the rate simply is not there yet. Wait for it and re-run rather than
      // discarding a year of data. Bounded, so a page that never gets a rate stops asking.
      if(!live())return;
      if(!(xlmUsd>0)&&r.length>=2&&(attempt||0)<8){
        loadChart._tok=myTok-1;
        setTimeout(function(){ loadChart(tf,(attempt||0)+1); },300);
        return;
      }
      var pts=r.map(function(x){return {t:+x.timestamp, v:(+x.avg||+x.close||0)*xlmUsd, vol:(+x.counter_volume||0)*xlmUsd, n:(+x.trade_count||0),
        o:(+x.open||0)*xlmUsd, h:(+x.high||0)*xlmUsd, l:(+x.low||0)*xlmUsd, c:(+x.close||0)*xlmUsd};}).filter(function(p){return p.v>0;});
      // #7: the delta cell reads the drawn series, so it has to be repainted whenever a new timeframe
      // lands -- otherwise switching to 1Y left yesterday's figure sitting under a year of chart.
      if(pts.length>=2){ clear(); drawChart(pts); try{ applyOhlc(); }catch(_){} return; }
      if(!attempt){ again(); return; }
      clear(); chartFromTrades(tf);
    }).catch(function(){ if(!attempt){ again(); return; } clear(); chartFromTrades(tf); });
  }
  function wireChartTabs(){
    if(chartWired)return; var btns=qa(".timeframes button");
    if(btns.length<2)return; chartWired=true;
    btns.forEach(function(b){ b.addEventListener("click",function(){ btns.forEach(function(x){x.classList.remove("active");}); b.classList.add("active"); loadChart((b.getAttribute("data-period")||b.textContent||"1D").trim()); }); });
  }
  // Dedicated SYNCHRONOUS chart guardian: the design's timeframe handler wipes our line/candles (drawing its own
  // hidden mock) on every click -> a ~50ms blank flash before our observer catches up. Redraw IMMEDIATELY (no
  // debounce) whenever our marks disappear, so the previous chart stays until the new timeframe's data lands.
  function guardChart(){ var pc=q("#dxaChart,#mdxaChart"); if(!pc||pc.__lxcg)return; pc.__lxcg=1;
    try{ var mo=new MutationObserver(function(){ if(pc.__lxcgBusy)return; if(chartPts&&!pc.querySelector(".lxda-line,.lxda-candle")){ pc.__lxcgBusy=1; mo.disconnect(); try{ drawChart(chartPts); }catch(_){} try{ mo.observe(pc,{childList:true,subtree:true}); }catch(_){} pc.__lxcgBusy=0; } });
      mo.observe(pc,{childList:true,subtree:true}); }catch(_){}
  }
  // #17/#20: Price|MCap and $|XLM, built into the row that already holds the chart type and the
  // timeframes. Both are reused DESIGN classes (.chart-tools, the same pill group the area/candle icons
  // sit in) so they inherit that row's look instead of introducing a third button style on one line.
  //
  // Placement: after the timeframes, pushed right with margin-left:auto -- which is "to the right of 1Y,
  // after some space" on a phone, and on a desktop fills the empty right half of a row that already
  // exists. Nothing gains height on either.
  //
  // data-logo is not optional here. The container ships a logo engine that claims ANY element whose text
  // is 1-5 characters inside a rounded, filled box and replaces its contents with a token image -- and
  // "$", "XLM" and "MCap" are all in range. It emptied the identical switch on the Trade page.
  function chartUi(){
    // WHERE these live depends on the width, because on a desktop there is nowhere in the header to put
    // them without costing height -- which was the one constraint given. Measured at 1280px: the controls
    // row is 920px and already holds the OHLC strip (625, and it needs ~600 for its six figures), the
    // chart-type tray (72) and the timeframes (188). That leaves 35px. Adding 175px of controls wrapped
    // the row onto a second line and grew the header by ~55px, and every neighbouring row -- the price
    // line, its meta line -- is full to the pixel as well.
    //
    // So on a desktop they go INSIDE the plot, pinned to its top-left corner, which is empty space the
    // chart already owns (the unit label uses the opposite corner the same way). Nothing moves, nothing
    // is clipped, and the controls sit on the thing they control. On a phone the row has room to wrap
    // and that is the better place, so the host is re-picked on every apply and the group is moved if
    // the window has crossed the breakpoint since.
    var row=q(".chart-controls")||q("#dxaChart,#mdxaChart");
    if(!row)return;
    // Ahead of the line/candle toggle, so the row reads: figures, what is plotted, how it is drawn,
    // over what period. The candle toggle is the .chart-tools that is neither of ours.
    var beforeEl=row.querySelector(".chart-tools:not(.lxda-metric):not(.lxda-denom)")||null;
    function host(el){ if(!el)return; if(el.parentNode===row&&(!beforeEl||el.nextSibling===beforeEl||el.compareDocumentPosition(beforeEl)&Node.DOCUMENT_POSITION_FOLLOWING))return;
      if(beforeEl)row.insertBefore(el,beforeEl); else row.appendChild(el); }
    var mv=q(".lxda-metric"), dv=q(".lxda-denom");
    host(mv); host(dv);
    if(!row.querySelector(".lxda-metric")){
      var g=document.createElement("div");
      g.className="chart-tools lxda-metric"; g.setAttribute("data-logo","");
      g.innerHTML='<button type="button" data-metric="price">Price</button>'
        +'<button type="button" data-metric="mcap">MCap</button>';
      if(beforeEl)row.insertBefore(g,beforeEl); else row.appendChild(g);
    }
    if(!row.querySelector(".lxda-denom")){
      var d=document.createElement("div");
      d.className="chart-tools lxda-denom"; d.setAttribute("data-logo","");
      d.innerHTML='<button type="button" data-cdn="usd">$</button>'
        +'<button type="button" data-cdn="xlm">XLM</button>';
      if(beforeEl)row.insertBefore(d,beforeEl); else row.appendChild(d);
    }
    qa(".lxda-metric button,.lxda-denom button").forEach(function(b){ b.setAttribute("data-logo",""); });
    // #39: side by side rather than one above the other. Stacked, the two trays occupied 68px of the
    // plot's top-left corner and read as two unrelated widgets; they are one control strip. The offset
    // has to be measured because the first tray's width follows its labels, and it is re-asserted on
    // every apply so crossing the breakpoint (which re-hosts both groups) cannot leave it stale.
    // (re-queried, not the mv/dv above: on the first pass those were looked up before the groups existed)
    try{
      var _mv=q(".lxda-metric"), _dv=q(".lxda-denom");
      if(!narrow && _mv && _dv && _mv.parentNode===_dv.parentNode){
        var _dl=(8+_mv.offsetWidth+6)+"px";
        if(_dv.style.left!==_dl)_dv.style.left=_dl;
        if(_dv.style.top!=="8px")_dv.style.top="8px";
      } else if(_dv && (_dv.style.left||_dv.style.top)){ _dv.style.left=""; _dv.style.top=""; }
    }catch(_){}
    chartUiSync();
    if(chartUiWired)return; chartUiWired=true;
    // Bound to the DOCUMENT, not to the host: the host changes when the window crosses the breakpoint,
    // and a listener on the old one would go with it. Capture phase, like every other control here --
    // the design has delegated handlers on the controls row and would otherwise read a click on a new
    // button as a timeframe change.
    document.addEventListener("click",function(e){
      var t=e.target; if(!t||!t.closest)return;
      var m=t.closest("[data-metric]");
      if(m){ e.preventDefault(); e.stopImmediatePropagation();
        chartMetric=(m.getAttribute("data-metric")==="mcap")?"mcap":"price";
        chartUiSync(); if(chartPts)drawChart(chartPts); return; }
      var d2=t.closest("[data-cdn]");
      if(d2){ e.preventDefault(); e.stopImmediatePropagation();
        setCDenom(d2.getAttribute("data-cdn")==="xlm"?"xlm":"usd");
        chartUiSync(); if(chartPts)drawChart(chartPts); try{ applyOhlc(); }catch(_){}
        // The pill and the perf grid are denomination-dependent and were never repainted here, so they
        // kept whatever unit they were painted in at boot. applyAll is idempotent and already runs from
        // every async path on this page, so it is the safe repaint.
        try{ applyAll(); }catch(_){} return; }
    },true);
  }
  function chartUiSync(){
    // A market cap needs a supply. Until one is known the tab would draw a chart it cannot label, so it
    // is disabled rather than allowed to produce an empty axis.
    var okM=(supply>0);
    qa(".lxda-metric button[data-metric]").forEach(function(b){
      var on=b.getAttribute("data-metric")===chartMetric;
      b.classList.toggle("active",on);
      if(b.getAttribute("data-metric")==="mcap"){ b.disabled=!okM;
        b.title=okM?"Market cap = price x circulating supply":"Supply not known yet"; }
    });
    var dn=cDenom();
    qa(".lxda-denom button[data-cdn]").forEach(function(b){ b.classList.toggle("active",b.getAttribute("data-cdn")===dn); });
  }
  // #8: Supply out of the row, into a sheet, on phones only.
  //
  // The card is marked rather than removed, and the CSS hides it at the same breakpoint that drops the
  // grid to three columns -- so a phone held sideways, or a desktop window dragged narrow, gets the same
  // treatment, and nothing has to be rebuilt when the viewport changes. The card keeps being painted by
  // applyStats either way, which is where the sheet reads its value from.
  // Byte-for-byte the toast _batch9.js installs elsewhere, so the two are indistinguishable on screen.
  var DXA_CK='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  var DXA_CK13='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  function dxaCopyToast(msg){
    try{
      // Only when the site-wide script has not already provided it -- then both use the one stylesheet.
      if(!document.getElementById("lx-copytoast-css")){
        var st=document.createElement("style"); st.id="lx-copytoast-css";
        st.textContent=".lx-ctoast-stack{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none}"
          +".lx-ctoast{background:var(--text,#16171b);color:var(--bg,#fff);padding:11px 18px 11px 14px;border-radius:10px;font-family:'Hanken Grotesk',system-ui,sans-serif;font-size:16px;font-weight:600;display:inline-flex;align-items:center;gap:9px;white-space:nowrap;box-shadow:0 12px 32px rgba(0,0,0,.28),0 2px 8px rgba(0,0,0,.16);animation:lxCtIn .25s ease}"
          +".lx-ctoast .ci{width:18px;height:18px;border-radius:50%;background:var(--green,#35c07f);color:#fff;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}"
          +"@keyframes lxCtIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}";
        document.head.appendChild(st);
      }
      var stack=document.querySelector(".lx-ctoast-stack");
      if(!stack){ stack=document.createElement("div"); stack.className="lx-ctoast-stack"; document.body.appendChild(stack); }
      var t=document.createElement("div"); t.className="lx-ctoast";
      t.innerHTML='<span class="ci">'+DXA_CK+'</span><span></span>';
      t.lastChild.textContent=msg;
      stack.appendChild(t);
      setTimeout(function(){ t.style.transition="opacity .25s ease,transform .25s ease";
        t.style.opacity="0"; t.style.transform="translateY(8px)";
        setTimeout(function(){ if(t.parentNode)t.parentNode.removeChild(t); },260); },1800);
    }catch(_){}
  }
  function moreInfoUi(){
    var row=q(".stat-row"); if(!row)return;
    var cells=row.querySelectorAll(".stat-cell");
    if(cells.length<4)return;
    for(var i=0;i<cells.length;i++){
      var l=cells[i].querySelector(".lbl");
      if(l&&/^\s*supply\s*$/i.test(l.textContent||""))cells[i].classList.add("lxda-more");
    }
    if(!row.querySelector(".lxda-moreline")){
      var line=document.createElement("div"); line.className="lxda-moreline";
      var b=document.createElement("button"); b.type="button"; b.className="lxda-morebtn";
      b.setAttribute("data-logo",""); b.textContent="More info";
      line.appendChild(b); row.appendChild(line);
      b.addEventListener("click",function(e){ e.preventDefault(); e.stopPropagation(); openMore(); },true);
    }
  }
  // Identity, not ticker: "LUMOS" is a code anyone may issue, so the locked-supply treatment is keyed
  // to OUR issuer. Falls back to the home domain we already resolved when the issuer is not baked in.
  function isLumos(){
    try{
      if(CODE!=="LUMOS")return false;
      var mine=(window.__lxLumosIssuer||"");
      if(mine)return ISSUER===mine;
      return /(^|\\.)lumoscore\\.com$|(^|\\.)lumosdao\\.io$/.test(String(homeDomain||""));
    }catch(_){ return false; }
  }
  function moreRows(){
    // Read from the cards the page has already painted rather than recomputing: whatever is in the sheet
    // then matches what the row said, including its formatting, and cannot drift from it.
    function cell(name){
      var cs=qa(".stat-cell");
      for(var i=0;i<cs.length;i++){ var l=cs[i].querySelector(".lbl");
        if(l&&new RegExp("^\\s*"+name+"\\s*$","i").test(l.textContent||"")){
          var v=cs[i].querySelector(".val"), sub=cs[i].querySelector(".sub");
          return {v:v?(v.textContent||"").trim():"", s:sub?(sub.textContent||"").trim():""}; } }
      return null;
    }
    var out=[];
    var sup=cell("Supply");
    // #4: for LUMOS the issued figure is NOT the circulating one. 90% of it is locked, so the sheet was
    // labelling 9.97B as "circulating" while the token page states 1B two clicks away -- the same number
    // described two different ways by the same site. The lock is stated in DXA_SUPPLY_NOTE and is the
    // reason the market cap here is computed on 1B; this row now agrees with both, and the issued total
    // keeps its own line so nothing is hidden.
    if(sup){
      if(isLumos()){
        out.push(["Circulating supply","1B LUMOS"]);
        out.push(["Issued supply",sup.v+(sup.s?(" "+sup.s):"")]);
        out.push(["Locked","9B LUMOS \\u2014 locked forever"]);
      } else out.push(["Circulating supply",sup.v+(sup.s?(" "+sup.s):"")]);
    }
    var mc=cell("Market Cap");
    if(mc&&mc.s)out.push(["Fully diluted",mc.s.replace(/^FDV\s*/i,"")]);
    // N3: both numbers, because they answer different questions and only one of them was being shown.
    // See the note in the transform: a trustline is permission to hold, not evidence of holding.
    if(holdersFunded!=null&&holders!=null&&holdersFunded!==holders)out.push(["Trustlines | Holders",num(holders)+" | "+num(holdersFunded)]);
    else if(holdersFunded!=null)out.push(["Holders",num(holdersFunded)]);
    else if(holders!=null)out.push(["Trustlines",num(holders)]);
    if(poolCount!=null)out.push(["Pools",num(poolCount)]);
    if(liqXlm!=null&&xlmUsd>0)out.push(["Pool liquidity",abbrUsd(liqXlm*xlmUsd)]);
    out.push(["Issuer",ISSUER]);
    if(homeDomain)out.push(["Home domain",String(homeDomain)]);
    out.push(["Asset code",CODE]);
    return out;
  }
  function openMore(){
    var sh=q(".lxda-sheet");
    if(!sh){
      sh=document.createElement("div"); sh.className="lxda-sheet";
      sh.innerHTML='<div class="lxda-sheet-card"><div class="lxda-sheet-head">'
        +'<h3></h3><button type="button" class="lxda-sheet-x" aria-label="Close">&times;</button></div>'
        +'<div class="lxda-sbody"></div></div>';
      document.body.appendChild(sh);
      // The sheet lives outside the region the page's own copy delegation covers, so it carries its own.
      sh.addEventListener("click",function(e){
        var b=e.target&&e.target.closest?e.target.closest("[data-copy]"):null; if(!b)return;
        e.preventDefault(); e.stopPropagation();
        var v=b.getAttribute("data-copy")||"";
        // execCommand fallback: clipboard.writeText needs a secure context, and this must not fail quietly.
        var ok=false;
        try{ if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(v); ok=true; } }catch(_){}
        if(!ok){ try{ var ta=document.createElement("textarea"); ta.value=v;
          ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta);
          ta.select(); document.execCommand("copy"); document.body.removeChild(ta); }catch(_){} }
        dxaCopyToast("Copied to clipboard");
        // Same 1.2s check swap on the button itself that the site-wide copy control uses.
        if(!b.__lxc){ var _old=b.innerHTML; b.__lxc=1; b.classList.add("ok");
          b.innerHTML=DXA_CK13;
          setTimeout(function(){ b.innerHTML=_old; b.classList.remove("ok"); b.__lxc=0; },1200); }
      });
      sh.addEventListener("click",function(e){
        if(e.target===sh||(e.target.closest&&e.target.closest(".lxda-sheet-x"))){
          e.preventDefault(); sh.classList.remove("open");
          try{ document.body.style.overflow=sh.__ovf||""; }catch(_){}
        }
      });
    }
    // #13: "About xLMNR" tells you the ticker you already clicked. When the issuer's toml names the
    // asset, use that -- "About [logo] X Lumenaire" -- and keep the code when it does not. The logo is
    // the same mark the header draws, so the sheet opens on something recognisable rather than a code.
    dxaSheetTitle(sh.querySelector("h3"));
    var body=sh.querySelector(".lxda-sbody");
    if(body)body.innerHTML=moreRows().map(function(r){
      return '<div class="lxda-srow"><span class="k">'+escapeHtml(r[0])+'</span><span class="v">'+escapeHtml(String(r[1]))+'</span></div>';
    }).join("");
    // #40: the issuer's own links, built as real anchors. Only what the toml actually carried, so an
    // asset with neither gets no row rather than an empty one.
    if(body){
      var _socs=[[tomlX,X_SVG,"X"],[tomlTg,TG_SVG,"Telegram"]].filter(function(p){return !!p[0];});
      // A2: the issuer row -- one line, with the full key on a copy control beside it.
      try{
        var _rows=body.querySelectorAll(".lxda-srow");
        for(var _i=0;_i<_rows.length;_i++){
          var _k=_rows[_i].querySelector(".k");
          if(!_k||!/^Issuer$/i.test((_k.textContent||"").trim()))continue;
          var _v=_rows[_i].querySelector(".v"); if(!_v)break;
          _v.textContent="";
          var _sp=document.createElement("span");
          _sp.className="mono lxda-issh"; _sp.textContent=shortG(ISSUER); _sp.title=ISSUER;
          var _cp=document.createElement("button");
          _cp.type="button"; _cp.className="lxda-isscp"; _cp.setAttribute("aria-label","Copy issuer address");
          _cp.title="Copy issuer address"; _cp.setAttribute("data-copy",ISSUER);
          _cp.innerHTML='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M5 15V5a2 2 0 0 1 2-2h10"></path></svg>';
          _v.appendChild(_sp); _v.appendChild(_cp);
          break;
        }
      }catch(_){}
      if(_socs.length){
        var _r=document.createElement("div"); _r.className="lxda-srow";
        var _k=document.createElement("span"); _k.className="k"; _k.textContent="Socials"; _r.appendChild(_k);
        var _v=document.createElement("span"); _v.className="v lxda-slinks";
        _socs.forEach(function(p){
          var a=document.createElement("a");
          a.className="lx-soc"; a.href=p[0]; a.target="_blank"; a.rel="noopener";
          a.setAttribute("title",p[2]); a.setAttribute("aria-label",p[2]);
          a.setAttribute("data-lxc",""); a.setAttribute("data-lx-noswap","");
          a.innerHTML=p[1]; _v.appendChild(a);
        });
        _r.appendChild(_v); body.appendChild(_r);
      }
    }
    try{ sh.__ovf=document.body.style.overflow; document.body.style.overflow="hidden"; }catch(_){}
    sh.classList.add("open");
  }
  // Area/Candle toggle: [data-chart="area"|"candle"] buttons. Switch mode + redraw from the cached OHLC pts (no re-fetch).
  function wireChartType(){
    if(chartTypeWired)return; var btns=qa('[data-type="area"],[data-type="candle"]'); if(btns.length<2)return; chartTypeWired=true;
    btns.forEach(function(b){ b.addEventListener("click",function(){ chartMode=(b.getAttribute("data-type")==="candle")?"candle":"area";
      btns.forEach(function(x){ x.classList.toggle("active", x.getAttribute("data-type")===chartMode); });
      if(chartPts)drawChart(chartPts); },true); });
  }

  // ================= ORDERBOOK (.dxa-ob-*) =================
  function loadOrderbook(){
    if(NATIVE)return;
    var url=H+"/order_book?selling_asset_type="+ATYPE+"&selling_asset_code="+CODE+"&selling_asset_issuer="+ISSUER+"&buying_asset_type=native&limit=200";
    j(url).then(function(d){ window.__lxDXAob=d; renderOrderbook(); }).catch(function(){});
  }
  function renderOrderbook(){
    var d=window.__lxDXAob; if(!d)return;
    // #14: the orderbook on a phone was the design's MOCK, start to finish. This renderer only ever
    // looked for the DESKTOP containers -- #dxaObAsks / #dxaObBids -- and the phone ships #mdxaObAsks /
    // #mdxaObBids, so it returned on the first line and nothing was ever painted. Checked against
    // Horizon at the time: the live best ask was 5.0271 x 91.21 while the pane read 4.2406 x 16,974.
    //
    // The ROW markup needs no branch. Both stylesheets style the same three children (.px/.am/.sm) plus
    // the depth bar, and differ only in the wrapper class -- so the rows are emitted with both, and each
    // layout styles the one it knows.
    var MOB=!q("#dxaObAsks");
    var asksEl=q("#dxaObAsks")||q("#mdxaObAsks"), bidsEl=q("#dxaObBids")||q("#mdxaObBids");
    if(!asksEl||!bidsEl)return;
    if(asksEl.__lxobd===d && asksEl.classList.contains("lxda"))return; asksEl.__lxobd=d;   // same book already rendered -> skip
    try{window.__lxDXAbook=d;}catch(_){} var asks=(d.asks||[]).slice(0,16), bids=(d.bids||[]).slice(0,16);
    if(!asks.length&&!bids.length)return;
    // header labels: Price (XLM) / Amount (CODE) / Depth
    var head=q(".dxa-ob-head")||q(".mdxa-ob-head"); if(head){ var hs=head.querySelectorAll("span"); if(hs[0])hs[0].textContent="Price (XLM)"; if(hs[1])hs[1].textContent="Amount ("+CODE+")"; if(hs[2])hs[2].textContent="Depth (XLM)"; }
    function fmtN(n){ n=+n||0; return n.toLocaleString("en-US",{maximumFractionDigits:2}); }
    function px(o){ return +o.price; }
    var cumA=0,cumB=0,aList=[],bList=[];
    // Horizon reports ASK amounts in the base asset (CODE) and BID amounts in the counter (XLM) --
    // proved by refetching this market with the pair reversed: bid amounts came back identical to the
    // reversed asks rather than scaled by price. Rendering both raw made the header "Amount (CODE)"
    // true for asks and false for bids, and left the two sides incomparable. Normalise so each column
    // means one thing: amount is CODE, depth is XLM.
    asks.forEach(function(o){ var am=+o.amount, xlm=am*px(o); cumA+=xlm; aList.push({px:px(o),am:am,sum:cumA}); });
    bids.forEach(function(o){ var xlm=+o.amount, am=px(o)>0?xlm/px(o):0; cumB+=xlm; bList.push({px:px(o),am:am,sum:cumB}); });
    var maxA=cumA||1, maxB=cumB||1;
    function decs(p){ return p>=1?4:(p>=0.01?5:7); }
    asksEl.innerHTML=aList.slice().reverse().map(function(r){ var w=(r.sum/maxA*100).toFixed(1);
      return '<div class="dxa-ob-row mdxa-ob-row ask"><span class="px">'+r.px.toFixed(decs(r.px))+'</span><span class="am">'+fmtN(r.am)+'</span><span class="sm">'+fmtN(r.sum)+'</span><span class="bar" style="width:'+w+'%"></span></div>'; }).join("");
    bidsEl.innerHTML=bList.map(function(r){ var w=(r.sum/maxB*100).toFixed(1);
      return '<div class="dxa-ob-row mdxa-ob-row bid"><span class="px">'+r.px.toFixed(decs(r.px))+'</span><span class="am">'+fmtN(r.am)+'</span><span class="sm">'+fmtN(r.sum)+'</span><span class="bar" style="width:'+w+'%"></span></div>'; }).join("");
    // spread
    var sp=q(".dxa-ob-spread")||q(".mdxa-ob-spread"); if(sp&&aList.length&&bList.length){ var spread=aList[0].px-bList[0].px, mid=(aList[0].px+bList[0].px)/2; var mons=sp.querySelectorAll(".mono"); if(mons[0])mons[0].textContent=(spread>0?spread.toFixed(Math.max(4,decs(mid))):"0")+" XLM"; if(mons[1])mons[1].textContent="("+(mid>0?(spread/mid*100).toFixed(2):"0")+"%)"; }
    asksEl.classList.add("lxda"); bidsEl.classList.add("lxda");
  }

  // ================= RECENT EXCHANGES (#dxaExTable) =================
  var TRADE_FILTER=0;
  var EX_PAGE=1, EX_PER_PAGE=50;
  // #20/#22: this is one narrow cell in a dense table and every row of it repeated the same word. "ago"
// is the only thing a time in a Recent Trades list can mean, and "just now" says in two words what
// "now" says in one. Dropping both buys the width back for the figures beside them.
function relTime(t){ var s=Math.max(0,(Date.now()-Date.parse(t))/1000); if(s<60)return "now"; if(s<3600)return Math.floor(s/60)+"m"; if(s<86400)return Math.floor(s/3600)+"h"; return Math.floor(s/86400)+"d"; }
  // deterministic identicon (matches the design's look; pure ASCII SVG)
  var _icoCache={};
  function identicon(addr,size){ size=size||26; var ck=addr+"@"+size; if(_icoCache[ck])return _icoCache[ck];
    var pal=["#6f5ded","#ef4444","#22c55e","#a855f7","#06b6d4","#f59e0b","#ec4899","#84cc16","#ff894c","#0ea5e9","#14b8a6","#facc15"];
    var h=0; for(var i=0;i<addr.length;i++){ h=((h<<5)-h)+addr.charCodeAt(i); h|=0; }
    function pick(i){ return pal[Math.abs((h>>(i*3))%pal.length)]; }
    var c1=pick(0),c2=pick(2),c3=pick(4),c4=pick(6),cell=size/5;
    var svg='<svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'" style="border-radius:50%;background:'+c1+'">';
    for(var y=0;y<5;y++)for(var x=0;x<3;x++){ var bit=(h>>((y*3+x)%30))&1; if(bit){ var col=(x+y)%2===0?c2:c3; svg+='<rect x="'+(x*cell).toFixed(2)+'" y="'+(y*cell).toFixed(2)+'" width="'+cell.toFixed(2)+'" height="'+cell.toFixed(2)+'" fill="'+col+'"/>'; if(x<2)svg+='<rect x="'+((4-x)*cell).toFixed(2)+'" y="'+(y*cell).toFixed(2)+'" width="'+cell.toFixed(2)+'" height="'+cell.toFixed(2)+'" fill="'+col+'"/>'; } }
    svg+='<circle cx="'+(size/2)+'" cy="'+(size/2)+'" r="'+(cell*0.42).toFixed(2)+'" fill="'+c4+'"/></svg>'; _icoCache[ck]=svg; return svg; }
  // AUDIT (numeric): the side was inverted — every Buy in Recent Exchanges was really a Sell and vice
  // versa. base_is_seller means the MAKER sold the base asset, so the taker (whose side a trade feed
  // reports) BOUGHT it. Measured against a live AQUA/XLM book: base_is_seller=true trades average
  // 0.0019965, i.e. the best ASK (0.0019966) = takers lifting offers = buys; false averages the bid
  // exactly. This query pins base=CODE, counter=native, so base IS the token and no flip is needed.
  function mapTrade(t){ var pr=t.price?(+t.price.n/+t.price.d):0;
    return {addr:t.base_account||t.counter_account||"", side:t.base_is_seller?"buy":"sell", px:pr, amount:+t.base_amount, xlm:+t.counter_amount, ts:Date.parse(t.ledger_close_time||"")||0, time:relTime(t.ledger_close_time),
      // Horizon trade ids are "<operationId>-<order>"; keep the operation id so the row can link to
      // THIS trade rather than to the asset. Matches t._links.operation.href.
      op:String(t.id||"").split("-")[0]}; }
  function tradesUrl(cursor){ return H+"/trades?base_asset_type="+ATYPE+"&base_asset_code="+CODE+"&base_asset_issuer="+ISSUER+"&counter_asset_type=native&order=desc&limit=200"+(cursor?("&cursor="+encodeURIComponent(cursor)):""); }
  function loadTrades(){
    if(NATIVE)return;
    j(tradesUrl(null)).then(function(d){
      var recs=(d&&d._embedded&&d._embedded.records)||[];
      window.__lxDXAtrades=recs.map(mapTrade);
      EX_SCANNED=recs.length;
      EX_CURSOR=recs.length?recs[recs.length-1].paging_token:null;
      EX_DEEP={};                                   // a refresh invalidates what each filter had crawled
      renderExchanges();
    }).catch(function(){});
  }
  // THE SIZE FILTERS USED TO SLICE ONE FIXED WINDOW. loadTrades pulls the 200 most recent trades and every
  // filter sliced that same 200 -- so on an asset whose recent flow is dust, "1K+ XLM" and "10K+ XLM" read
  // "no trades" even though plenty had happened a little further back. The window was the answer, not the
  // data.
  //
  // Now a size filter reaches BACK until it has 25 of them (or runs out, or hits the page cap). Only when
  // it needs to: the crawl is skipped entirely if the trades already in hand satisfy the filter, so "All"
  // and any busy asset still cost exactly one request. Pages are sequential rather than parallel -- this
  // is the same Horizon budget everything else on the page is spending, and it stops the moment it has
  // enough.
  // The scan budget is GLOBAL, not per filter, and that distinction is the whole cost control. With a
  // per-filter cap each size got its own eight pages and the cursor kept advancing, so clicking through
  // 10+, 100+ and 1K+ walked 5,000 trades in 24 requests -- a quarter of the entire five-minute Horizon
  // budget spent on three clicks. One shared ceiling instead: the buffer is shared too, so a later filter
  // reads everything an earlier one paid for, and the total cost of the whole strip is bounded.
  var EX_MIN=25, EX_MAX_SCAN=3000, EX_CURSOR=null, EX_SCANNED=0, EX_DEEP={};
  function exMatches(f){ var r=window.__lxDXAtrades||[]; var n=0; for(var i=0;i<r.length;i++)if(r[i].xlm>=f)n++; return n; }
  // How much TIME the scanned trades actually cover. A count alone is meaningless as a depth: 3,000 trades
  // is months of history on a quiet asset and two hours on yXLM.
  function exSpan(){ var r=window.__lxDXAtrades||[]; if(r.length<2)return "";
    var a=r[r.length-1].ts, b=r[0].ts; if(!(a>0&&b>a))return "";
    var h=(b-a)/3600000;
    var t = h<1 ? (Math.max(1,Math.round(h*60))+" minutes")
          : h<48 ? (Math.round(h)+" hour"+(Math.round(h)===1?"":"s"))
          : (Math.round(h/24)+" days");
    return " (about "+t+")"; }
  function deepenTrades(){
    if(NATIVE)return;
    var f=TRADE_FILTER; if(!(f>0))return;
    var st=EX_DEEP[f]||(EX_DEEP[f]={});
    if(st.busy||st.done)return;
    if(exMatches(f)>=EX_MIN)return;
    st.busy=1; step(0);
    function stop(done){ st.busy=0; if(done)st.done=1; try{ renderExchanges(); }catch(_){} }
    function step(n){
      if(EX_SCANNED>=EX_MAX_SCAN||!EX_CURSOR){ stop(1); return; }
      j(tradesUrl(EX_CURSOR)).then(function(d){
        if(TRADE_FILTER!==f){ st.busy=0; return; }               // the user moved on; leave the rest for later
        var recs=(d&&d._embedded&&d._embedded.records)||[];
        if(!recs.length){ stop(1); return; }                     // reached the start of this pair's history
        EX_CURSOR=recs[recs.length-1].paging_token;
        EX_SCANNED+=recs.length;
        window.__lxDXAtrades=(window.__lxDXAtrades||[]).concat(recs.map(mapTrade));
        renderExchanges();                                       // show them as they arrive
        if(exMatches(f)>=EX_MIN){ st.busy=0; return; }
        step(n+1);
      }).catch(function(){ st.busy=0; });
    }
  }
  // The exchanges pager. The design ships one in .panel-foot .pgn whose buttons we did not own, and
  // whose handler regenerates the design's MOCK rows (Ethereum addresses, APT prices, USDC amounts) —
  // one click replaced real Stellar trades with fabricated ones. Rebuilding the control from our own
  // data on every render kills that: new button nodes carry none of the design's listeners, and the
  // page numbers now describe the real filtered set. Hidden entirely when there is only one page.
  function renderExPager(total, pages){
    var tb=q("#dxaExTable"); if(!tb) return;
    var panel=tb.closest?tb.closest(".panel"):null; if(!panel) return;
    var foot=panel.querySelector(".panel-foot .pgn"); if(!foot) return;
    var sig="p"+EX_PAGE+"/"+pages+"/"+total;
    if(foot.__lxpgsig===sig && foot.querySelector("button[data-pg]")) return;
    foot.__lxpgsig=sig;
    if(pages<=1){ foot.innerHTML=""; foot.style.display="none"; return; }
    foot.style.display="";
    var lo=Math.max(1,EX_PAGE-2), hi=Math.min(pages,lo+4); lo=Math.max(1,hi-4);
    var h='<button data-pg="'+(EX_PAGE-1)+'"'+(EX_PAGE<=1?" disabled":"")+'>‹</button>';
    if(lo>1){ h+='<button data-pg="1">1</button>'; if(lo>2) h+='<button disabled>…</button>'; }
    for(var p=lo;p<=hi;p++) h+='<button data-pg="'+p+'"'+(p===EX_PAGE?' class="active"':"")+'>'+p+'</button>';
    if(hi<pages){ if(hi<pages-1) h+='<button disabled>…</button>'; h+='<button data-pg="'+pages+'">'+pages+'</button>'; }
    h+='<button data-pg="'+(EX_PAGE+1)+'"'+(EX_PAGE>=pages?" disabled":"")+'>›</button>';
    foot.innerHTML=h;
    if(!foot.__lxpgwired){ foot.__lxpgwired=1;
      // capture phase, so this wins even if the design has a delegated handler on an ancestor
      foot.addEventListener("click", function(e){
        var b=e.target&&e.target.closest?e.target.closest("button[data-pg]"):null;
        if(!b||b.disabled) return;
        e.preventDefault(); e.stopPropagation();
        var n=parseInt(b.getAttribute("data-pg"),10); if(!n) return;
        EX_PAGE=n; renderExchanges();
      }, true);
    }
  }

  function renderExchanges(){
    // The mobile page renders these as .ex-row DIVs in #mdxaExList, not <tr> in a <tbody>, so only the
    // markup differs — filtering, paging and the anti-mock guards below are shared. Without the mobile
    // host this bailed on its first line, and the page kept the design's mock: 15 rows of ETHEREUM
    // addresses (0x0f…3ce6) at invented prices, on a Stellar asset page.
    var rows=window.__lxDXAtrades; var tb=q("#dxaExTable"); var MOB=false;
    if(!tb){ tb=q("#mdxaExList"); MOB=!!tb; }
    if(!tb||!rows)return;
    // PAGE the filtered set instead of hard-slicing the first 50. The design's own pager sat in
    // .panel-foot unowned by us, and its "next" handler called the DESIGN's renderExchanges(), which
    // builds 15 rows from a hardcoded WALLETS array of ETHEREUM addresses priced in APT/USDC. One
    // click on a real asset page replaced live Stellar trades with fabricated ones. We now own the
    // pager, so that path is unreachable.
    var all=rows.filter(function(r){ return r.xlm>=TRADE_FILTER; });
    // Short of 25 for this size? Go and find more. Cheap when it is not needed: exMatches short-circuits
    // and deepenTrades returns without a request.
    if(TRADE_FILTER>0 && all.length<EX_MIN) try{ deepenTrades(); }catch(_){}
    var pages=Math.max(1, Math.ceil(all.length/EX_PER_PAGE));
    if(EX_PAGE>pages) EX_PAGE=pages;           // filter narrowed while on a later page
    if(EX_PAGE<1) EX_PAGE=1;
    var from=(EX_PAGE-1)*EX_PER_PAGE;
    var f=all.slice(from, from+EX_PER_PAGE);
    // What the empty state SHOULD say, worked out before the signature so it can go into it.
    //
    // It reports the span in TIME, not just a trade count, because the count is a bad proxy for depth and
    // the difference is enormous: 3,000 trades is months on a quiet asset and TWO HOURS on yXLM, which
    // trades constantly in small size. "the last 3,000 trades" reads like a lot and can mean almost
    // nothing, which is exactly the confusion this message existed to prevent.
    var _sz=(TRADE_FILTER>=1000?(TRADE_FILTER/1000)+"K":TRADE_FILTER)+" XLM";
    var _busy=!!(EX_DEEP[TRADE_FILTER]&&EX_DEEP[TRADE_FILTER].busy);
    var emptyTxt = TRADE_FILTER>0
      ? (_busy ? ("Looking further back for trades \\u2265 "+_sz+" \\u2026")
               : ("No trades \\u2265 "+_sz+" in the last "+num(EX_SCANNED)+" trades"+exSpan()+"."))
      : 'No trades in the recent window.';
    // THE FOOTER AND THE COUNT LINE ARE WRITTEN BEFORE THE SKIP-GUARD, ON EVERY PASS, and that ordering
    // is the fix rather than a tidy-up. They used to sit after it, so a pass that found the TABLE unchanged
    // returned without ever touching them -- and the design's own pager, which it repaints from its own
    // state, was then free to sit there indefinitely saying "Page 1 of 3 / of 137" over two real rows.
    // The observer added for that only fires on a mutation; if the design won the race before it was
    // installed, or repainted while the table happened to be unchanged, nothing ever put ours back.
    // Re-asserting both unconditionally removes the dependency on catching the moment: every applyAll tick
    // now restores them. Each has its own internal signature, so this costs nothing when nothing changed.
    var info=q("#dxaPanelInfo"); if(info){ var ft=TRADE_FILTER>0?(" · ≥ "+(TRADE_FILTER>=1000?(TRADE_FILTER/1000).toFixed(0)+"K":TRADE_FILTER)+" XLM"):"";
      // say WHICH slice of the filtered set is on screen, not just how many rows were drawn
      var _it = all.length
        ? ("Showing "+(from+1)+"–"+(from+f.length)+" of "+num(all.length)+" recent trades"+ft)
        : ("Showing 0 recent trades"+ft);
      if(info.textContent!==_it) info.textContent=_it; }
    renderExPager(all.length, pages);

    // skip the rebuild when the filter+data+page haven't changed — kills the applyAll churn/lag.
    //
    // emptyTxt IS PART OF THE SIGNATURE, and leaving it out is what left "Looking further back…" on
    // screen forever. When a crawl ends with nothing found, all.length and f.length are both still 0, so
    // the final render carried the identical signature to the one that painted the searching message --
    // and this guard skipped it as a no-op. The only thing that had changed was the sentence itself, and
    // the signature could not see it. Verified on yXLM at 10K+: the crawl finished at 2.8s and the page
    // still claimed to be looking eleven seconds later.
    var sig=TRADE_FILTER+"|"+EX_PAGE+"|"+all.length+"|"+f.length+"|"+((f[0]&&f[0].addr)||"")+"|"+((f[f.length-1]&&f[f.length-1].addr)||"")+"|"+emptyTxt;
    // AUDIT: the old guard trusted the .lxda class, which survives when the design replaces the ROWS
    // underneath it — so once the mock came back we refused to repaint and left it on screen. Trust the
    // content instead — but NOT .wallet-cell: the design's mock rows use that class too, so the guard
    // read fabricated rows as "ours" and refused to repaint them. Every row we write carries
    // data-lxda, which the design never emits, so this cannot be spoofed by the mock.
    var ours=!!(tb.querySelector("[data-lxda]")||tb.querySelector(".lxda-ex-empty"));
    if(tb.__lxexsig===sig && ours)return; tb.__lxexsig=sig;
    // and re-assert if the design repaints this table (or its info line) behind our back
    if(!tb.__lxexobs){ tb.__lxexobs=1; try{
      var reassert=function(){ if(!(tb.querySelector("[data-lxda]")||tb.querySelector(".lxda-ex-empty"))){ tb.__lxexsig=null; renderExchanges(); } };
      new MutationObserver(reassert).observe(tb,{childList:true});
      var inf=q("#dxaPanelInfo");
      if(inf)new MutationObserver(function(){ if(!/recent trades/.test(inf.textContent||"")){ tb.__lxexsig=null; renderExchanges(); } }).observe(inf,{childList:true,characterData:true,subtree:true});
      // THE FOOTER NEEDED ONE TOO, and its absence is the reported bug. The table and the info line each
      // re-assert when the design repaints them; the pager did not, so the design's own control could come
      // back and simply stay -- carrying ITS page state and ITS total. That is how "Page 2 of 3" and
      // "of 137" sat under a filter holding two trades: the numbers were not wrong, they belonged to a
      // different pager. Ours is the only one whose buttons carry data-pg, so anything else here is the
      // design's. No loop risk: our own writes always satisfy that test, and clearing it leaves no button.
      var pf=tb.closest?tb.closest(".panel"):null; pf=pf?pf.querySelector(".panel-foot"):null;
      if(pf)new MutationObserver(function(){
        var pg=pf.querySelector(".pgn"); if(!pg)return;
        if(pg.querySelector("button")&&!pg.querySelector("button[data-pg]")){
          pg.__lxpgsig=null; tb.__lxexsig=null; renderExchanges(); }
      }).observe(pf,{childList:true,subtree:true});
    }catch(_){} }
    // KEEP LOOKING. The scan budget has to be bounded -- Horizon gives 100 requests per five minutes and
    // this page is not the only thing spending them -- but a fixed ceiling is the wrong place to end the
    // conversation when the answer is "there might be more further back". So when a size filter has
    // finished short of its 25 and the budget is spent, offer another lap and let the reader decide
    // whether it is worth the wait. Default cost stays exactly what it was; the extra is opt-in.
    (function(){
      var slot=q("#dxaPanelInfo"); if(!slot)return;
      var st=EX_DEEP[TRADE_FILTER]||{};
      var spent=EX_SCANNED>=EX_MAX_SCAN, short=(all.length<EX_MIN);
      var want=(TRADE_FILTER>0 && short && spent && !st.busy);
      var btn=slot.parentNode?slot.parentNode.querySelector(".lx-exmore"):null;
      if(!want){ if(btn)btn.parentNode.removeChild(btn); return; }
      if(btn)return;
      btn=document.createElement("button"); btn.type="button"; btn.className="lx-exmore";
      btn.textContent="Keep looking"; btn.setAttribute("data-lxc","");
      btn.addEventListener("click",function(){
        EX_MAX_SCAN+=3000; EX_DEEP={};                 // a fresh allowance, and let every size try again
        btn.disabled=true; btn.textContent="Looking\\u2026";
        try{ deepenTrades(); }catch(_){}
      });
      slot.parentNode.insertBefore(btn, slot.nextSibling);
    })();
    function decs(p){ return p>=1?4:(p>=0.01?5:7); }
    if(!f.length){
      // emptyTxt is computed above, before the signature, so that a change to THIS SENTENCE alone is
      // enough to force a repaint. Saying how far back we looked is only honest once the looking stopped.
      tb.innerHTML=MOB
        ? '<div class="lxda-ex-empty" style="text-align:center;padding:26px 12px;color:var(--text-soft,#8a8fa3);font-size:13.5px">'+emptyTxt+'</div>'
        : '<tr class="lxda-ex-empty"><td colspan="6" style="text-align:center;padding:26px 12px;color:var(--text-soft,#8a8fa3);font-size:13.5px">'+emptyTxt+'</td></tr>';
      tb.classList.add("lxda"); return; }
    // #30: an arrow states a direction, so it has to follow the side of the trade. Every row read
    // "<asset> -> XLM" whatever the badge beside it said, which puts the Buy rows backwards: someone
    // buying SHX paid lumens and received SHX, and the line described the opposite trade.
    function exFlow(r){
      var a=qtyTxt(r.amount)+" "+CODE, x=qtyTxt(r.px*r.amount)+" XLM";
      return r.side==="buy" ? (x+" \\u2192 "+a) : (a+" \\u2192 "+x);
    }
    // Mobile row: the design's own .ex-row shape, plus the explorer link desktop has and the mock omits.
    if(MOB){ tb.innerHTML=f.map(function(r){
      return '<div class="ex-row" data-lxda="1">'
        +'<span class="ex-ident">'+identicon(r.addr,28)+'</span>'
        +'<div class="ex-meta"><div class="nm mono">'+(r.addr.charAt(0)==="C"
          ? (shortG(r.addr)+'<span class="lx-sortag">Soroban</span>')
          : ('<a class="lx-acct" href="/account/stellar/'+r.addr+'">'+shortG(r.addr)+'</a>'))+'</div>'
        +'<div class="ex-sub"><span class="type-badge '+r.side+'">'+(r.side==="buy"?"▲ Buy":"▼ Sell")+'</span></div></div>'
        // #11: this line was as long as the row and mostly padding -- '310,319 ZBS for 0.025281 XLM' beside a
// price already spelled out in full. qtyTxt is the site's own quantity formatter: it abbreviates above a
// thousand (200,000 -> 200K) and switches to subscript below one, which COMPRESSES the leading zeros
// without dropping a digit -- 0.0000253 becomes 0.0(4)253, still the exact number. The price itself keeps
// smallNum for the same reason. 'for' becomes an arrow: it is a trade, and the row is narrow.
+'<div class="ex-num">'+smallNum(r.px,4)+' XLM<span class="sub">'+exFlow(r)+'</span></div>'
        +'<div class="ex-time">'+r.time+'</div>'
        +'<a class="row-link lxda-exlink" href="'+tradeHref(r)+'" target="_blank" rel="noopener" aria-label="View this trade on stellar.expert">'
        +'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
        +'<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/>'
        +'<line x1="10" y1="14" x2="21" y2="3"/></svg></a>'
        +'</div>'; }).join("");
      tb.classList.add("lxda"); return; }
    tb.innerHTML=f.map(function(r){
      return '<tr data-lxda="1">'
        +'<td>'+(r.addr.charAt(0)==="C"
          ? ('<span class="wallet-cell lx-nolink">'+identicon(r.addr,26)+'<span class="mono wa">'+shortG(r.addr)+'</span><span class="lx-sortag">Soroban</span></span>')
          : ('<a class="lx-acct wallet-cell" href="/account/stellar/'+r.addr+'">'+identicon(r.addr,26)+'<span class="mono wa">'+shortG(r.addr)+'</span></a>'))+'</td>'
        +'<td><span class="type-badge '+r.side+'">'+(r.side==="buy"?"▲ Buy":"▼ Sell")+'</span></td>'
        +'<td><span class="mono">'+r.px.toFixed(decs(r.px))+' XLM</span></td>'
        +'<td><span class="mono">'+xlmAmt(r.amount)+' '+CODE+'</span><span class="lx-extot">'+xlmAmt(r.px*r.amount)+' XLM</span></td>'
        +'<td><span class="time">'+r.time+'</span></td>'
        +'<td style="text-align:right"><a class="row-link" href="'+tradeHref(r)+'" target="_blank" rel="noopener" aria-label="View this trade on stellar.expert"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a></td>'
        +'</tr>'; }).join("");
    tb.classList.add("lxda");
    // #38: the Time header, which sits in the thead and so is out of reach of the tbody-scoped rule.
    try{ var _tbl=tb.closest&&tb.closest("table");
      var _th=_tbl&&_tbl.querySelectorAll("thead th")[4];
      if(_th&&_th.style.textAlign!=="right")_th.style.textAlign="right"; }catch(_){}
    // bottom Exchanges tab: remove the count badge (per request)
    var etab=qa(".tabs-bar .tab").filter(function(t){return /exchanges/i.test(t.getAttribute("data-tab")||"");})[0];
    if(etab){ var c=etab.querySelector(".count"); if(c&&c.style.display!=="none")c.style.display="none"; }
  }
  // wire the filter chips. DELEGATED on the container so it survives the design re-rendering the chips
  // (direct per-chip listeners were lost on re-render -> the filters appeared dead).
  function wireExchangeFilters(){
    // Mobile names this container #mdxaPanelFilters. Gating on the desktop id alone meant the listener was
    // never registered there, so chip clicks fell through to the design's handler: the chip went active
    // (which looks like it worked) while TRADE_FILTER never moved and every trade stayed on screen.
    var fl=q("#dxaPanelFilters,#mdxaPanelFilters"); if(!fl)return;
    qa(".chip",fl).forEach(function(c){ var t=c.textContent||""; if(/APT/.test(t))c.textContent=t.replace(/APT/g,"XLM"); });   // relabel APT->XLM every pass
    if(fl.__lxwired)return; fl.__lxwired=1;
    // AUDIT (user-reported: "recent exchanges are not real"): this listener lived on the filters container,
    // but the design ALSO handles chip clicks from a document-level capture listener — and document capture
    // runs before any element listener. So the design repainted its own MOCK rows (0x… wallets, USDC
    // amounts) and its own "Showing 13 of 2,142 exchanges" line right after we wrote the real ones. On an
    // asset like ARMYXLM, whose trades are ~0.0000012 XLM, picking "100+ XLM" left ONLY the mock on screen,
    // presented as genuine market activity. Window capture + stopImmediatePropagation keeps the design out.
    window.addEventListener("click",function(e){
      var c=e.target&&e.target.closest?e.target.closest("#dxaPanelFilters .chip,#mdxaPanelFilters .chip"):null; if(!c)return;
      e.preventDefault(); e.stopImmediatePropagation();
      qa(".chip",c.parentNode).forEach(function(o){o.classList.toggle("active",o===c);});
      TRADE_FILTER=parseFloat(c.getAttribute("data-min-xlm"))||0; EX_PAGE=1; renderExchanges();
    },true);
  }

  // ================= HOLDERS bottom tab =================
  // Bounded paging: giant assets (e.g. USDC ~2.3M holders) can't be fully paged. Count comes from
  // /assets (accurate); the Top-holders list is best-effort from what we page (capped), sorted by balance.
  var HCAP=200;
  // A ranking is real when it came from the ranked source, OR when one Horizon page happened to contain
  // every holder (small assets — then sorting it locally IS the true order).
  function canRankHolders(){ return !!window.__lxDXAranked || (holders!=null && holders<=HCAP); }
  // ---- HOLDERS PAGING -------------------------------------------------------------------------------
  // Upstream pages by an OPAQUE cursor, never an offset: cursor=200 returns nothing, while the token out
  // of _links.next works and the pages stay correctly ranked with no overlap (page 1 ends at balance
  // 529252300087, page 2 opens at 522663300124, zero shared accounts). So the token is carried forward.
  var HPP=50;
  function holdCursor(d){
    var h=d&&d._links&&d._links.next&&d._links.next.href; if(!h)return "";
    var m=/[?&]cursor=([^&]+)/.exec(h); return m?m[1]:"";
  }
  function holdPage(){ var p=+window.__lxDXAhpage||0; return p>0?p:0; }
  function holdMore(){
    if(window.__lxDXAholdBusy||!window.__lxDXAholdNext)return Promise.resolve(false);
    window.__lxDXAholdBusy=1;
    return j("/lxapi/holders?asset="+encodeURIComponent(CODE+"-"+ISSUER)+"&limit=200&cursor="+encodeURIComponent(window.__lxDXAholdNext))
      .then(function(d){
        window.__lxDXAholdBusy=0;
        var rk=(d&&d._embedded&&d._embedded.records)||[];
        if(!rk.length){ window.__lxDXAholdNext=""; return false; }
        var seen={}; (window.__lxDXAhold||[]).forEach(function(h){ seen[h.addr]=1; });
        var add=[];
        rk.forEach(function(r){ var a=r.address||r.account;
          var b=(+r.balance||0)/1e7;
          if(a&&!seen[a]&&b>0){ seen[a]=1; add.push({addr:a,bal:b}); } });
        window.__lxDXAhold=(window.__lxDXAhold||[]).concat(add);
        window.__lxDXAholdNext=holdCursor(d);
        return add.length>0;
      }).catch(function(){ window.__lxDXAholdBusy=0; return false; });
  }
  // Move the page, then just repaint. NOTHING here clears a built-marker by hand -- that is what failed
  // the first time: the marker was cleared from outside, the pipeline rebuilt with the OLD page, and the
  // table never moved. The page is part of the build signature instead (see data-lxbuilt below), so
  // changing it is by itself what makes the table stale.
  function holdGo(p){
    if(p<0)p=0;
    var hold=window.__lxDXAhold||[];
    if((p+1)*HPP>hold.length&&window.__lxDXAholdNext){
      holdMore().then(function(got){
        var have=(window.__lxDXAhold||[]).length;
        if(p*HPP<have){ window.__lxDXAhpage=p; }
        guardApply();
      });
      return;
    }
    if(p*HPP>=hold.length&&p>0)return;
    window.__lxDXAhpage=p; guardApply();
  }
  if(!window.__lxHoldWired){ window.__lxHoldWired=1;
    document.addEventListener("click",function(e){
      var t=e.target; if(!t||!t.closest)return;
      var b=t.closest("[data-hp]"); if(!b||b.disabled)return;
      e.preventDefault(); e.stopImmediatePropagation();
      holdGo(b.getAttribute("data-hp")==="next"?holdPage()+1:holdPage()-1);
    },true);
  }
  function loadHolders(){
    if(NATIVE||window.__lxDXAhold||window.__lxDXAholdLoading)return;
    window.__lxDXAholdLoading=true;
    // ranked source first (same-origin proxy -> stellar.expert, ordered by balance)
    // 200 is the upstream maximum and it is a single request, so four pages of the table are in hand
    // before anyone touches Next. Deeper pages come from holdMore() on demand.
    j("/lxapi/holders?asset="+encodeURIComponent(CODE+"-"+ISSUER)+"&limit=200").then(function(d){
      var rk=(d&&d._embedded&&d._embedded.records)||[];
      if(!rk.length)throw new Error("no ranked holders");
      window.__lxDXAhold=rk.map(function(r){ return {addr:r.address||r.account, bal:(+r.balance||0)/1e7}; })
        .filter(function(h){ return h.bal>0; });      // a zero balance is a trustline, not a holder
      window.__lxDXAholdNext=holdCursor(d);
      window.__lxDXAranked=1; guardApply();
    }).catch(function(){ horizonHolders(); });                 // proxy absent (static hosting) or upstream down
  }
  // fallback: one Horizon page, ordered by account id — a sample, never a ranking
  function horizonHolders(){
    var acc=[];
    function finish(){ window.__lxDXAhold=acc.sort(function(x,y){return y.bal-x.bal;}); guardApply(); }
    function page(url,depth){
      j(url).then(function(d){
        var recs=(d&&d._embedded&&d._embedded.records)||[];
        recs.forEach(function(a){ (a.balances||[]).forEach(function(bl){ if(bl.asset_code===CODE&&bl.asset_issuer===ISSUER)acc.push({addr:a.account_id||a.id,bal:+bl.balance}); }); });
        var next=d&&d._links&&d._links.next&&d._links.next.href;
        if(next&&recs.length&&depth<0){ page(next,depth+1); } else { finish(); }   // one page only — see HCAP note   // cap ~3 pages (600 accounts) — enough for top-50 + concentration
      }).catch(function(){ if(acc.length)finish(); else window.__lxDXAholdLoading=false; });
    }
    page(H+"/accounts?asset="+CODE+":"+ISSUER+"&limit=200&order=desc",0);
  }
  // Both bottom panels live under a different id AND class prefix on mobile (#mdxaPanel > .mdxa-holders),
  // and mobile renders rows as DIVs where desktop uses a <table>. These two helpers pick the panel and say
  // which markup to build; without them both renderers returned on their first line and the design's mock
  // stayed — Ethereum-style holder wallets and pool pairs like USDC/CELL that do not exist on Stellar.
  function panelWrap(kind){ return q("#dxaPanel .dxa-"+kind+",#mdxaPanel .mdxa-"+kind); }
  function isMobPanel(w){ return !!w && (" "+(w.className||"")).indexOf(" mdxa-")>=0; }
  function applyHolders(){
    var wrap=panelWrap("holders"); if(!wrap)return;                              // only when the Holders tab is open
    var MOB=isMobPanel(wrap);
    try{ loadHolders(); }catch(_){}                                              // lazy: page the top-holders list only once the tab is actually opened
    // header stat count (accurate trustline count from /assets)
    var _hn=(holdersFunded!=null?holdersFunded:holders);
    if(_hn!=null){ var st=wrap.querySelectorAll(".dxa-hl-stat .val,.mdxa-hl-stat .val"); if(st[0]){var _h=num(_hn);if(st[0].textContent!==_h)st[0].textContent=_h;lxMark(st[0]);} }
    // Only the rare fallback (no ranked source) leaves these unknown; dash them then, with no prose.
    if(holders!=null&&!canRankHolders()){
      var _st=wrap.querySelectorAll(".dxa-hl-stat .val,.mdxa-hl-stat .val");
      [1,2].forEach(function(i){ if(_st[i]){ if(_st[i].textContent!=="\u2014")_st[i].textContent="\u2014"; lxMark(_st[i]); } });
    }
    var _n0=wrap.querySelector(".lxda-hl-note"); if(_n0&&_n0.parentNode)_n0.parentNode.removeChild(_n0);
    // Until the real rows land, the design's mock holders sit there — Ethereum-style "0x00…c3a1" wallets
    // and a fabricated "12,408 holders" pager, presented as this asset's data for the ~2s the fetch takes.
    // Clear them and say we're loading instead.
    var hold=window.__lxDXAhold;
    if(!hold||!hold.length){
      var _tb0=MOB?wrap.querySelector(".mdxa-hl-list"):wrap.querySelector("table tbody");
      if(_tb0&&!_tb0.getAttribute("data-lxbuilt")&&_tb0.getAttribute("data-lxload")!=="1"){
        _tb0.setAttribute("data-lxload","1");
        _tb0.innerHTML=MOB?'<div style="padding:22px 14px;text-align:center;color:var(--text-muted)">Loading holders…</div>'
          :'<tr><td colspan="5" style="padding:22px 14px;text-align:center;color:var(--text-muted)">Loading holders…</td></tr>';
      }
      return;
    }
    var pu=priceUsd();
    var tbody=MOB?wrap.querySelector(".mdxa-hl-list"):wrap.querySelector("table tbody"); if(!tbody)return;
    // Which page is on screen. Deliberately NOT gated on canRankHolders(): gating it there meant the
    // rows could render page 0 while the pager still drew controls for page 2, and the two disagreed
    // on screen. The pager below is the thing that is gated, so an unranked sample simply gets no
    // controls while the rows stay page 0.
    var _hp=holdPage();
    if(_hp*HPP>=hold.length){ _hp=Math.max(0,Math.ceil(hold.length/HPP)-1); window.__lxDXAhpage=_hp; }
    // #9, the holders section "blinking light grey to dark grey non stop".
    //
    // This test used to sit on the line above, BEFORE _hp was assigned. var hoists the declaration but
    // not the value, so _hp was undefined there and the guard compared data-lxbuilt against the string
    // "pundefined" -- which never equals "p0". It therefore never returned early, and the table rebuilt
    // its fifty rows on every single call: measured 26 rebuilds in 6 seconds, forever, which is the
    // flicker. (The 1,300 rel= writes/6s from the nofollow guard were it dutifully re-marking 1,300
    // brand-new anchors -- a symptom, not the cause.) Nothing to do with hover; hovering is just when
    // you look closely enough to notice.
    if(tbody.getAttribute("data-lxbuilt")===("p"+_hp))return;
    var top=hold.slice(_hp*HPP,_hp*HPP+HPP), tot=holders!=null?holders:hold.length;
    // top-10 / top-50 concentration (of paged supply — approximate for capped assets)
    var pagedTot=0; hold.forEach(function(h){pagedTot+=h.bal;});
    var sup=supply||pagedTot||1;   // hold is the COMPLETE holder set here (canRankHolders), so pagedTot is a sound fallback
    var t10=0,t50=0; hold.slice(0,10).forEach(function(h){t10+=h.bal;}); hold.slice(0,50).forEach(function(h){t50+=h.bal;});
    var st2=wrap.querySelectorAll(".dxa-hl-stat .val,.mdxa-hl-stat .val");
    if(canRankHolders()){   // hold is a TRUE ranking -> the top-10/top-50 sums are the real thing
      if(st2[1]){var _t10=(Math.min(100,t10/sup*100)).toFixed(1)+"%";if(st2[1].textContent!==_t10)st2[1].textContent=_t10;if(st2[1].hasAttribute("title"))st2[1].removeAttribute("title");lxMark(st2[1]);}
      if(st2[2]){var _t50=(Math.min(100,t50/sup*100)).toFixed(1)+"%";if(st2[2].textContent!==_t50)st2[2].textContent=_t50;if(st2[2].hasAttribute("title"))st2[2].removeAttribute("title");lxMark(st2[2]);}
    }
    var EXPL='https://stellar.expert/explorer/public/account/';
    var html=top.map(function(h,i){ var pct=h.bal/sup*100;
      var pctTxt=(pct>=0.001?pct.toFixed(3):"<0.001")+'%';
      // Mobile's row is the design's .mdxa-hl-row grid, not a table row.
      // The row is a DIV, never an <a>, even for a normal account.
      //
      // It used to be <a class="mdxa-hl-row"> wrapping the whole row -- which also contains
      // <a class="mdxa-hl-explorer">. An anchor inside an anchor is invalid HTML, and the parser does not
      // forgive it: it closes the outer <a> when it meets the inner one and re-parents the rest as
      // SIBLINGS. So each holder became several elements. Measured on USDC: 50 holders rendered as 87
      // .mdxa-hl-row elements, only 50 of which still held an address and only 13 their values block --
      // the address, the explorer link and the amounts each landing on their own line. That is the
      // "design is broken" in the report; it was a nesting bug, not styling.
      //
      // With a div the two links are siblings and both keep working. The address carries the account
      // link, so nothing is lost; lx-acct moves onto it so the existing wiring still finds it.
      if(MOB){ var _c=(h.addr.charAt(0)==="C");
      var _addr='<div class="mdxa-hl-addr mono">'
        +(_c ? (shortG(h.addr)+'<span class="lx-sortag">Soroban</span>')
             : ('<a class="lx-acct" href="/account/stellar/'+h.addr+'">'+shortG(h.addr)+'</a>'))+burnTag(h.addr)+'</div>';
      return '<div class="mdxa-hl-row lxda-hlrow'+(_c?' lx-nolink':'')+'"><span class="mdxa-hl-rank">#'+(_hp*HPP+i+1)+'</span>'
        +'<span class="mdxa-hl-ident">'+identicon(h.addr,28)+'</span>'
        +'<div class="mdxa-hl-meta">'+_addr+'</div>'
        +'<div class="mdxa-hl-vals"><div class="mdxa-hl-bal mono">'+abbrNum(h.bal)+'</div>'
        +'<div class="mdxa-hl-pct mono">'+pctTxt+'</div></div>'
        +'<a class="mdxa-hl-explorer lxda-hlx" href="'+EXPL+h.addr+'" target="_blank" rel="noopener" aria-label="View on Explorer" title="View on Explorer">'+XPO+'</a></div>'; }
      return '<tr><td class="dxa-hl-rank">'+(_hp*HPP+i+1)+'</td>'
        +'<td><div class="lxda-hcell">'+(h.addr.charAt(0)==="C"? ('<span class="wallet-cell lx-nolink">'+identicon(h.addr,24)+'<span class="mono wa">'+shortG(h.addr)+'</span><span class="lx-sortag">Soroban contract</span></span>'): ('<a class="lx-acct wallet-cell" href="/account/stellar/'+h.addr+'">'+identicon(h.addr,24)+'<span class="mono wa">'+shortG(h.addr)+'</span></a>'))+burnTag(h.addr)+'</div></td>'
        +'<td class="mono">'+abbrNum(h.bal)+'</td>'
        +'<td class="mono">'+(pct>=0.001?pct.toFixed(3):"<0.001")+'%</td>'
        +'<td style="text-align:right"><a class="dxa-hl-explorer" href="https://stellar.expert/explorer/public/'+(h.addr.charAt(0)==="C"?"contract":"account")+'/'+h.addr+'" target="_blank" rel="noopener">'+XPO+'</a></td></tr>'; }).join("");
    tbody.innerHTML=html; tbody.setAttribute("data-lxbuilt","p"+_hp);
    // pagination info line
    var _from=_hp*HPP+1, _to=_hp*HPP+top.length;
    var pg=wrap.querySelector(".dxa-hl-pgn .info,.mdxa-hl-pgn .info");
    if(pg)pg.textContent=canRankHolders()?("Showing "+num(_from)+"\\u2013"+num(_to)+" of "+num(tot)+" holders")
                                         :("Showing "+top.length+" of "+num(tot)+" holders (sample)");
    // REAL pager. This used to hide the design's mock buttons outright -- "we only ever render one page,
    // so drop it" -- which was true when the fetch asked for 50 and stopped. It asks for 200 now and
    // follows the cursor, so there are real pages and the control is built rather than hidden.
    //
    // Only when the list is genuinely RANKED. The Horizon fallback is one unordered sample; paging that
    // would walk an arbitrary slice while implying a ranking, so there the buttons stay gone.
    qa(".dxa-hl-pgn .pages, .dxa-hl-pgn .pager, .mdxa-hl-pgn .pages, .mdxa-hl-pgn .pager").forEach(function(b){ b.style.display="none"; });
    var _pgn=wrap.querySelector(".dxa-hl-pgn .pgn,.mdxa-hl-pgn .pgn");
    if(_pgn){
      if(!canRankHolders()){ if(_pgn.innerHTML!=="")_pgn.innerHTML=""; }
      else{
        var _more=((_hp+1)*HPP<hold.length)||!!window.__lxDXAholdNext;
        var _sig="p"+_hp+"|"+(_more?1:0);
        if(_pgn.getAttribute("data-lxhsig")!==_sig){
          _pgn.setAttribute("data-lxhsig",_sig);
          _pgn.innerHTML='<button type="button" data-hp="prev"'+(_hp<=0?" disabled":"")+'>\\u2039 Prev</button>'
            +'<button type="button" data-hp="next"'+(_more?"":" disabled")+'>Next \\u203a</button>';
        }
      }
    }
    // Holders bottom-tab count
    var htab=qa(".tabs-bar .tab").filter(function(t){return /holders/i.test(t.getAttribute("data-tab")||"");})[0];
    if(htab){ var c=htab.querySelector(".count"); if(c){ c.textContent=q("#mdxaPanel")?abbrNum(tot):num(tot); lxMark(c);} }
  }

  // ================= AMM Pools tab — REAL per-asset pools (replaces the hardcoded design mock) =================
  // The design's renderPanelTab('pools') injects a .dxa-pools block from a hardcoded POOLS array (fake pairs,
  // "7 Active pools", duplicated USDC rows, gradient icons). Once the real /liquidity_pools fetch lands
  // (__lxDXApoolsRaw) we rebuild that block from the pools this asset actually trades in: real pairs + logos +
  // TVL + fee tier + LP-holder count + pool share. TVL is valued in XLM (XLM-paired pool: xlmReserve*2;
  // token-paired: assetReserve*assetXlm*2) then converted to USD. No fabricated APR/volume — only real fields.
  var XLM_BG="url('${STELLAR_URI}')";
  var dxaLogoTried={};
  function poolBg(code,iss){ if(code==="XLM")return XLM_BG; if(code===CODE&&(!iss||iss===ISSUER)){ if(CODE==="LUMOS")return "url("+LUMOS_LOGO+")"; var kk=brandLogo(CODE,ISSUER); if(kk)return "url("+kk+")"; if(tomlImg)return "url("+tomlImg+")"; } var u=dxaReg(code,iss)||brandLogo(code,iss)||cachedLogo(code,iss); if(u)return "url("+u+")"; return avatarBg(code); }
  function attrBg(v){ return String(v||"").split('"').join("'"); }   // "-delimited attr: url("...") would close it
  // "View pool" must open THIS pool, not the pools index. Horizon's liquidity-pool id is already the
  // hex the detail page expects (?pool=<hex>). Keep the page's own variant so the link stays in-theme.
  function poolHref(id){ if(!id)return "lumoscore-amm.html"; var f=(location.pathname.split("/").pop()||""); var suf=f.indexOf("-dark.")>=0?"-dark":(f.indexOf("-mobile.")>=0?"-mobile":""); return "lumoscore-amm-pool"+suf+".html?pool="+id; }
  function poolIco(code,iss){ var _kn=brandLogo(code,iss)?' data-lxknown="1"':"";
    return '<span class="dxa-pl-ico" data-lxc="'+code+'" data-lxi="'+(iss||"")+'"'+_kn+' style="background-color:transparent;background-image:'+attrBg(poolBg(code,iss))+';background-size:cover;background-position:center;background-repeat:no-repeat"></span>'; }
  function dxaPutLogo(code,iss,img){ if(!img)return;
    try{ (window.__lxLogosI=window.__lxLogosI||{})[logoKey(code,iss)]=img; }catch(_){}
    qa('.dxa-pl-ico[data-lxc="'+code+'"][data-lxi="'+(iss||"")+'"]:not([data-lxknown])').forEach(function(el){
      el.style.backgroundColor="transparent"; el.style.backgroundImage="url("+img+")"; }); }
  // No regex: this string is emitted through a template literal, which strips one level of backslash.
  function tomlField(block,key){ var lines=block.split(String.fromCharCode(10));
    for(var i=0;i<lines.length;i++){ var ln=lines[i].trim(), eq=ln.indexOf("=");
      if(eq<0)continue; if(ln.slice(0,eq).trim()!==key)continue;
      var v=ln.slice(eq+1).trim();
      if(v.charAt(0)==='"'){ var e=v.indexOf('"',1); v=e>0?v.slice(1,e):v.slice(1); }
      return v; }
    return ""; }
  // SEP-1: issuer -> home_domain -> /.well-known/stellar.toml -> the [[CURRENCIES]] block for this asset.
  // #13: the asset's own name, from the same two sources the logo comes from. Recorded only for the
  // asset THIS page is about, so a stray record for another asset can never retitle the sheet.
  // The header's own mark, copied. Returns quietly when the page has none to give.
  function dxaSheetIco(h){
    try{
      var src=document.querySelector(".asset-logo,.dxa-asset-logo");
      if(!src)return;
      var sp=src.cloneNode(true);
      sp.removeAttribute("id");
      sp.className=(sp.className||"")+" lxda-sheet-ico";
      h.appendChild(sp);
    }catch(_){}
  }
  function dxaSheetTitle(h){
    if(!h)return;
    var nm=String(window.__lxAssetName||"").trim();
    // Same treatment whether or not a name exists -- only the words differ. Clearing first, because
    // assigning textContent later would discard the icon appended before it.
    if(!nm||nm===CODE){ h.textContent=""; dxaSheetIco(h); h.appendChild(document.createTextNode("About "+CODE)); return; }
    var url="";
    // The mark the page header is ALREADY showing comes first, and the resolvers are the fallback --
    // not the other way round. brandLogo/cachedLogo only know assets they fetched themselves, and for
    // this one they returned a URL that does not load: the img's onerror dutifully removed the mark and
    // the heading came out with no logo at all. Whatever the header has on screen is by definition
    // loading, and by definition the right asset.
    try{
      var _hl=document.querySelector(".asset-logo,.dxa-asset-logo");
      var _bg=_hl?getComputedStyle(_hl).backgroundImage:"";
      // Take everything inside url(...) and strip the quotes afterwards. The character-class version of
      // this excluded the quote characters and ended up capturing them instead -- the mark rendered as a
      // 20px box pointing at url("(%22") -- which is the same url(") trap this codebase has hit before.
      var _m=/url\((.*?)\)/.exec(_bg||"");
      if(_m)url=String(_m[1]).replace(/^\s*["']|["']\s*$/g,"");
    }catch(_){}
    if(!url){ try{ url=(brandLogo(CODE,ISSUER)||cachedLogo(CODE,ISSUER)||""); }catch(_){ url=""; } }
    // The header's mark is fetched, so on a fast click the sheet can open before it has landed and the
    // heading would keep the name without it for as long as the sheet stayed open. Two bounded retries,
    // flagged so they can never become a loop.
    if(!url&&!h.__lxIcoRetry){ h.__lxIcoRetry=1;
      setTimeout(function(){ try{ dxaSheetTitle(h); }catch(_){} },500);
      setTimeout(function(){ try{ dxaSheetTitle(h); }catch(_){} },1600); }
    h.textContent="";
    // CLONE the header's mark rather than rebuilding one from a URL.
    //
    // Two attempts at rebuilding it failed for two different reasons: an <img> with the same URL never
    // loaded, and re-extracting the URL out of a computed background-image walked straight into the
    // url(") quoting trap this codebase already has scars from. The header is displaying the right mark,
    // by whatever route -- inline style, CSS variable, a class -- so copy the element and let it carry
    // its own mechanism with it. Nothing to parse, nothing to re-resolve, and it cannot disagree with
    // the header because it IS the header's.
    try{
      var _hl=document.querySelector(".asset-logo,.dxa-asset-logo");
      if(_hl){
        var sp=_hl.cloneNode(true);
        sp.removeAttribute("id");
        sp.className=(sp.className||"")+" lxda-sheet-ico";
        h.appendChild(sp);
      }
    }catch(_){}
    // The mark leads, then the phrase -- "[logo] About TokenGlade". Appended after the icon rather than
    // before it, which is the whole of this change.
    h.appendChild(document.createTextNode("About "+nm));
  }
  function dxaPutName(code,iss,nm){
    nm=String(nm||"").trim();
    if(!nm||nm===code)return;                       // a name identical to the ticker adds nothing
    if(code!==CODE||iss!==ISSUER)return;
    if(window.__lxAssetName===nm)return;
    window.__lxAssetName=nm;
    // if the sheet happens to be open, retitle it in place rather than waiting for the next open
    try{ dxaSheetTitle(document.querySelector(".lxda-sheet h3")); }catch(_){}
  }
  // ...and a lookup of its own, because the one above is short-circuited by
  //     if(brandLogo(code,iss)||cachedLogo(code,iss))return;
  // An asset whose logo we already know never reaches that fetch, so it never got a name either -- which
  // is every well-known asset, i.e. exactly the ones with a name worth showing. One request, fired late
  // so it never competes with the price and chart work, and only on a real credit asset.
  // stellar.expert returns trustlines as [total, authorized, funded] from the search endpoint and as
  // {total, authorized, funded} from the single-asset record. Accept either.
  function dxaFunded(mx){
    try{
      var t=mx&&mx.trustlines; if(!t)return null;
      var v=null;
      if(Object.prototype.toString.call(t)==="[object Array]"){ if(t.length>=3)v=+t[2]; }
      else if(t.funded!=null)v=+t.funded;
      return (v!=null&&isFinite(v)&&v>=0)?v:null;
    }catch(_){ return null; }
  }
  function dxaSetFunded(mx){
    var v=dxaFunded(mx);
    if(v!=null&&holdersFunded!==v){ holdersFunded=v; try{ guardApply(); }catch(_){} }
  }
  var dxaNameTried=false;
  function dxaFetchName(){
    if(dxaNameTried||NATIVE||!ISSUER||!CODE)return; dxaNameTried=true;
    j("https://api.stellar.expert/explorer/public/asset?search="+encodeURIComponent(ISSUER)+"&limit=50").then(function(d){
      var recs=(d&&d._embedded&&d._embedded.records)||[];
      var m=recs.filter(function(r){ return (r.asset||"").indexOf(CODE+"-"+ISSUER)===0; })[0];
      var ti=(m&&(m.tomlInfo||m.toml_info))||{};
      dxaPutName(CODE,ISSUER,ti.name);
      // Same record already in hand -- the funded holder count comes free, with no logo gate in the way.
      dxaSetFunded(m);
    }).catch(function(){});
  }
  try{ setTimeout(dxaFetchName,900); }catch(_){}
  function dxaTomlLogo(code,iss){ if(!iss)return;
    j(H+"/accounts/"+iss).then(function(acc){
      var dom=(acc&&acc.home_domain)||""; if(!dom)return;
      // some issuers put a whole URL in home_domain; only a bare host can be joined to the well-known path
      for(var k=0;k<dom.length;k++){ var c=dom.charAt(k);
        if(!((c>="a"&&c<="z")||(c>="A"&&c<="Z")||(c>="0"&&c<="9")||c==="."||c==="-"))return; }
      return fetch("https://"+dom+"/.well-known/stellar.toml").then(function(r){ return r.text(); }).then(function(txt){
        var blocks=txt.split("[[CURRENCIES]]");
        for(var b=1;b<blocks.length;b++){
          if(tomlField(blocks[b],"code")!==code)continue;
          var bi=tomlField(blocks[b],"issuer"); if(bi&&bi!==iss)continue;
          dxaPutName(code,iss,tomlField(blocks[b],"name"));
          dxaPutLogo(code,iss,tomlField(blocks[b],"image")); return; } });
    }).catch(function(){});   // no CORS on the toml host -> not reachable -> keep the placeholder
  }
  function dxaFetchPoolLogo(code,iss){ if(!code||code==="XLM")return;
    if(brandLogo(code,iss)||cachedLogo(code,iss))return;
    var _k=logoKey(code,iss); if(dxaLogoTried[_k])return; dxaLogoTried[_k]=1;
    // by ISSUER, not by ticker: a ticker search is score-ranked and capped, so a small asset sharing a
    // popular ticker never appears in it at any limit. An issuer has few assets and no ranking problem.
    j("https://api.stellar.expert/explorer/public/asset?search="+encodeURIComponent(iss)+"&limit=50").then(function(d){
      var recs=(d&&d._embedded&&d._embedded.records)||[];
      var m=recs.filter(function(r){ return (r.asset||"").indexOf(code+"-"+iss)===0; })[0];   // exact code+issuer ONLY
      var ti=(m&&(m.tomlInfo||m.toml_info))||{};
      dxaPutName(code,iss,ti.name);
      if(ti.image){ dxaPutLogo(code,iss,ti.image); return; }
      dxaTomlLogo(code,iss);                        // indexed but no image -> ask the issuer directly
    }).catch(function(){ dxaTomlLogo(code,iss); }); }
  // Pools are paged at 25, not truncated. The header says "59 active pools" and the tab badge says 59, so
  // showing 20 rows and stopping was a straight contradiction -- and the design-era paginator (_dexpag)
  // saw a 59 count over a 20-row table and padded it out with CLONED rows to 137, inventing pools that do
  // not exist. Real paging here; _dexpag is told to leave this tab alone.
  var POOLS_PER=25, poolsPage=1, poolsView=null;
  function setTxt(el,t){ if(!el)return; t=String(t); if(el.textContent!==t)el.textContent=t; }
  // Write the live numbers into the rows that are already on screen. TVL and pool share move on every
  // tick; re-rendering the row for that destroys the node under the pointer, which is what made the
  // hovered pool CTA flash between its normal and hover colour.
  function poolsNums(body,top,combined,MOB){ var rows=body.children;
    for(var i=0;i<rows.length&&i<top.length;i++){ var p=top[i],r=rows[i];
      var share=combined>0?(p.tvlXlm/combined*100):0;
      var tvl=xlmUsd>0?abbrUsd(p.tvlXlm*xlmUsd):abbrNum(p.tvlXlm)+" XLM";
      var sh=(share>=0.1?share.toFixed(1):"<0.1")+"%";
      if(MOB){ setTxt(r.querySelector(".mdxa-pl-tvl"),tvl); setTxt(r.querySelector(".mdxa-pl-lp"),num(p.tl)+" LP holders");
        setTxt(r.querySelector(".mdxa-pl-apr"),sh+" share"); }
      else { var c=r.children; if(c.length>=4){ setTxt(c[1],tvl); setTxt(c[2],num(p.tl)); setTxt(c[3],sh); } } } }
  // Same idea for the three stats above the table.
  function poolsHead(){ var v=poolsView; if(!v||!v.wrap)return;
    var vals=v.wrap.querySelectorAll(v.MOB?".mdxa-hl-stat .val":".dxa-hl-stat .val"); if(vals.length<3)return;
    setTxt(vals[0],num(v.list.length));
    setTxt(vals[1],xlmUsd>0?abbrUsd(v.combined*xlmUsd):abbrNum(v.combined)+" XLM");
    setTxt(vals[2],abbrNum(v.lps));
    for(var i=0;i<3;i++)lxMark(vals[i]); }
  function poolsRowsHTML(top,combined){ return top.map(function(p){ var share=combined>0?(p.tvlXlm/combined*100):0;
      return '<tr class="dxa-pl-row" data-pool="'+poolHref(p.id)+'"><td><div class="dxa-pl-pair"><span class="dxa-pl-icos">'+poolIco(CODE,ISSUER)+poolIco(p.other,p.otherIss)+'</span>'
        +'<span class="dxa-pl-name">'+CODE+' / '+p.other+'</span></div></td>'
        +'<td class="mono">'+(xlmUsd>0?abbrUsd(p.tvlXlm*xlmUsd):abbrNum(p.tvlXlm)+" XLM")+'</td>'
        +'<td class="mono">'+num(p.tl)+'</td>'
        +'<td class="mono">'+(share>=0.1?share.toFixed(1):"<0.1")+'%</td>'
        +'</tr>'; }).join(""); }
  function poolsMRowsHTML(top,combined){ return top.map(function(p){ var share=combined>0?(p.tvlXlm/combined*100):0;
      return '<a class="mdxa-pl-row" href="'+poolHref(p.id)+'">'
        +'<div class="mdxa-pl-l"><span class="dxa-pl-icos">'+poolIco(CODE,ISSUER)+poolIco(p.other,p.otherIss)+'</span>'
        +'<div><div class="mdxa-pl-name">'+CODE+' / '+p.other+'</div>'
        +'<div class="mdxa-pl-net mdxa-pl-lp">'+num(p.tl)+' LP holders</div></div></div>'
        +'<div class="mdxa-pl-r"><div class="mdxa-pl-tvl mono">'+(xlmUsd>0?abbrUsd(p.tvlXlm*xlmUsd):abbrNum(p.tvlXlm)+" XLM")+'</div>'
        +'<div class="mdxa-pl-apr apr-low">'+(share>=0.1?share.toFixed(1):"<0.1")+'% share</div></div></a>'; }).join(""); }
  // Repaints rows + footer for the current page. Called on build and by the Prev/Next buttons, so paging
  // never re-runs the whole panel build (which would refetch logos and re-mask the stat row).
  var POOLS_NONE="No liquidity pools yet \u2014 this asset is not paired in any AMM pool.";
  // Horizon allows 100 requests per 5 minutes per IP, so a failed pool fetch is ordinary. Saying "none"
  // when we simply could not ask would be a false claim about the asset.
  var POOLS_ERR="Could not load pools right now \u2014 refresh to try again.";
  function poolsPaint(){ var v=poolsView; if(!v||!v.wrap||!v.wrap.isConnected)return;
    if(!v.list.length){
      var eb=v.wrap.querySelector(v.MOB?".mdxa-pl-list":".ex-table tbody");
      if(eb&&eb.getAttribute("data-lxrows")!=="none"){ eb.setAttribute("data-lxrows","none");
        var msg=window.__lxDXApoolsErr?POOLS_ERR:POOLS_NONE;
        eb.innerHTML=v.MOB?('<div class="lxda-disc-empty">'+msg+'</div>')
          :('<tr><td colspan="5"><div class="lxda-disc-empty">'+msg+'</div></td></tr>'); }
      var ef=v.wrap.querySelector(".lx-pl-foot"); if(ef)ef.style.display="none";
      return;
    }
    var pages=Math.max(1,Math.ceil(v.list.length/POOLS_PER));
    if(poolsPage>pages)poolsPage=pages; if(poolsPage<1)poolsPage=1;
    var start=(poolsPage-1)*POOLS_PER, end=Math.min(start+POOLS_PER,v.list.length), top=v.list.slice(start,end);
    var body=v.wrap.querySelector(v.MOB?".mdxa-pl-list":".ex-table tbody");
    if(!body)return;
    // Rebuild the rows only when WHICH pools are on screen changes (a page turn, or the list itself
    // changing). A number moving is not a reason to throw the nodes away -- it is written into the row
    // that is already there, so the element under the pointer keeps its identity and its :hover.
    var ids=""; for(var i=0;i<top.length;i++)ids+=top[i].id+",";
    var key=poolsPage+"|"+v.list.length+"|"+ids;
    if(body.getAttribute("data-lxrows")===key)poolsNums(body,top,v.combined,v.MOB);
    else{ body.setAttribute("data-lxrows",key);
      body.innerHTML=v.MOB?poolsMRowsHTML(top,v.combined):poolsRowsHTML(top,v.combined);
      top.forEach(function(p){ dxaFetchPoolLogo(p.other,p.otherIss); }); }
    var foot=v.wrap.querySelector(".lx-pl-foot");
    if(foot){ foot.style.display=pages>1?"":"none";
      // The footer carries the buttons; rebuilding it on a tick would cancel a click already in flight.
      var fkey=poolsPage+"|"+pages+"|"+v.list.length;
      if(foot.getAttribute("data-lxfoot")!==fkey){ foot.setAttribute("data-lxfoot",fkey);
        foot.innerHTML='<span class="info">Showing '+num(start+1)+'\\u2013'+num(end)+' of '+num(v.list.length)+' pools</span>'
          +'<span class="pc"><button type="button" class="lx-pl-prev"'+(poolsPage<=1?' disabled':'')+'>\\u2039 Prev</button>'
          +'<span class="pmid">Page '+poolsPage+' of '+pages+'</span>'
          +'<button type="button" class="lx-pl-next"'+(poolsPage>=pages?' disabled':'')+'>Next \\u203a</button></span>'; } }
  }
  function applyPools(){ var wrap=panelWrap("pools"); if(!wrap)return; var MOB=isMobPanel(wrap); var raw=window.__lxDXApoolsRaw;
    // undefined = still fetching, so keep the skeleton; [] once done = genuinely none, and that falls
    // through to the rebuild below so the empty state gets the real header and columns.
    if(!raw)return;
    if(!raw.length && !window.__lxDXApoolsDone)return;
    var list=raw.map(function(p){ var other=null; (p.res||[]).forEach(function(rv){ if(rv.code!==CODE&&!other)other=rv; }); if(!other)other=(p.res||[])[0]||{code:"XLM",iss:""};
      var tvlXlm=p.nat>0?p.nat*2:((p.ass>0&&assetXlm>0)?p.ass*assetXlm*2:0);
      return {id:p.id,other:other.code,otherIss:other.iss,tvlXlm:tvlXlm,fee:p.feeBp,tl:p.tl}; })
      .filter(function(p){return p.tvlXlm>0;}).sort(function(a,b){return b.tvlXlm-a.tvlXlm;});
    // Deliberately NOT an early return: pools that exist but hold no value are still "nothing to show",
    // and bailing here is what left the comp rows up.
    if(!list.length && !window.__lxDXApoolsDone)return;
    var combined=0,lps=0,feeSum=0; list.forEach(function(p){combined+=p.tvlXlm;lps+=p.tl;feeSum+=p.fee;});
    // The tab badge was written from poolCount (every pool Horizon returns) while the list drops pools with
    // no TVL, so AQUA advertised 1306 and listed 1,280 — the same "says N, shows fewer" complaint. The badge
    // now reports what is actually listed, and is re-stated here because this runs after the earlier write.
    try{ var _pt=qa(".tabs-bar .tab").filter(function(t){return /pools/i.test(t.getAttribute("data-tab")||"");})[0];
      if(_pt){ var _c=_pt.querySelector(".count"); if(_c){ var _w=MOB?abbrNum(list.length):num(list.length);
        if(_c.textContent!==String(_w))_c.textContent=_w; lxMark(_c); } } }catch(_){}
    // STRUCTURAL only -- deliberately no TVL and no price. Folding the numbers in here meant every tick
    // changed the signature and rebuilt the entire panel via innerHTML, taking the hovered row with it.
    // Numbers now flow through poolsHead()/poolsNums() into the nodes that already exist.
    var sig=list.length+"|"+(MOB?1:0);
    poolsView={list:list,combined:combined,lps:lps,wrap:wrap,MOB:MOB};
    if(wrap.getAttribute("data-lxsig")===sig){ poolsHead(); poolsPaint(); return; }
    var head='<div class="dxa-pl-head">'
      +'<div class="dxa-hl-stat"><span class="lbl">Active pools</span><span class="val mono">'+num(list.length)+'</span></div>'
      +'<div class="dxa-hl-stat"><span class="lbl">Combined TVL</span><span class="val mono">'+(xlmUsd>0?abbrUsd(combined*xlmUsd):abbrNum(combined)+" XLM")+'</span></div>'
      +'<div class="dxa-hl-stat"><span class="lbl">LP positions</span><span class="val mono">'+abbrNum(lps)+'</span></div>'
      +'</div>';
    if(MOB){
      // Mobile's panel is .mdxa-pl-head + a .mdxa-pl-list of .mdxa-pl-row divs. Its mock row carries an APR
      // badge; we have no honest APR (the desktop table deliberately shows none), so that slot gets the real
      // pool share instead of an invented yield.
      var mhead='<div class="mdxa-pl-head">'
        +'<div class="mdxa-hl-stat"><span class="lbl">Active pools</span><span class="val mono">'+num(list.length)+'</span></div>'
        +'<div class="mdxa-hl-stat"><span class="lbl">Combined TVL</span><span class="val mono">'+(xlmUsd>0?abbrUsd(combined*xlmUsd):abbrNum(combined)+" XLM")+'</span></div>'
        +'<div class="mdxa-hl-stat"><span class="lbl">LP positions</span><span class="val mono">'+abbrNum(lps)+'</span></div>'
        +'</div>';
      wrap.innerHTML=mhead+'<div class="mdxa-pl-list"></div><div class="lx-pl-foot"></div>';
    }
    else wrap.innerHTML=head+'<table class="ex-table"><thead><tr><th>Pool</th><th>TVL</th><th>LP holders</th><th>Pool share</th></tr></thead><tbody></tbody></table><div class="lx-pl-foot"></div>';
    // Delegated, and bound to the freshly-built wrap, so it cannot double-fire across rebuilds.
    wrap.addEventListener("click",function(e){ var t=e.target&&e.target.closest?e.target.closest(".lx-pl-prev,.lx-pl-next"):null; if(!t)return;
      e.preventDefault(); poolsPage+=t.className.indexOf("lx-pl-next")>=0?1:-1; poolsPaint(); });
    poolsPaint();
    wrap.setAttribute("data-lxsig",sig);
    // ".dxa-hl-stat .val" is in LXSTRICT, so the mask observer deliberately never auto-reveals it — a strict
    // element only unmasks where WE mark it. These four are built fresh by the innerHTML above, so without
    // this they stayed visibility:hidden forever: the labels (Active pools / Combined TVL / LP positions /
    // Avg fee) rendered with a blank space under each. applyHolders already lxMark()s its stats; this is the
    // same obligation. Any NEW strict element created by a painter must be marked here too.
    qa(".dxa-pools .dxa-hl-stat .val,.mdxa-pools .mdxa-hl-stat .val").forEach(function(v){ lxMark(v); });
  }

  // ================= Buy/Sell trade widget — REAL execution (Phase 2) =================
  // Buy CODE = pay XLM -> receive CODE; Sell CODE = pay CODE -> receive XLM. Quotes come from Horizon
  // strict-send paths; execution is a real pathPaymentStrictSend (+0.2% LumosCore fee op, auto trustline)
  // signed by the connected wallet via our OWN SDK/Freighter signer (this page has none of _swapcalc's
  // globals). Mirrors _swapcalc.lxSwap + _lumostoken's signer. NATIVE (?asset=XLM) has no counter-asset
  // here, so the widget stays display-only.
  var WPASS_PUB="Public Global Stellar Network ; September 2015";
  var FEE_COLLECTOR="GAMZFXIJD5E3PNRFCG6VPXCJNUOZAP5BY2P3MU3ZXXUSVM2UY5P6LJKD";
  var SLIP=0.5;
  // audit #38: this was a flat 0.002, so a 250,000-LUMOS holder was charged the standard fee on
  // Trade-Asset Buy/Sell while every other surface honoured their 0.1% tier. Read the live rate.
  function FEE_RATE(){var r=window.__lxFeeRate;return (typeof r==="number"&&r>0&&r<=0.002)?r:0.002;}
  var _dxsdk=null, _dxTmr=null, _dxSeq=0, _dxQuoteOut=0, _dxMinRecv=0, _dxSpot={}, _dxView=null, _dxLastPay=null, _dxQuick=null;
  // Swap toast, styled exactly like the design's "Copied to clipboard" toast (dark pill + circular icon,
  // bottom-center). isErr -> red ✕ icon; otherwise green ✓. Replaces the old native alert().
  function dxToast(m,isErr){
    var CKI='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    var XI='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    try{
      var stack=document.querySelector(".lx-ctoast-stack");
      if(!stack){ stack=document.createElement("div"); stack.className="lx-ctoast-stack"; document.body.appendChild(stack); }
      var t=document.createElement("div"); t.className="lx-ctoast"+(isErr?" lxda-terr":"");
      t.innerHTML='<span class="ci">'+(isErr?XI:CKI)+'</span><span>'+String(m==null?"":m).replace(/[&<>]/g,function(c){return c==="&"?"&amp;":c==="<"?"&lt;":"&gt;";})+'</span>';
      stack.appendChild(t);
      setTimeout(function(){ t.style.transition="opacity .22s,transform .22s"; t.style.opacity="0"; t.style.transform="translateY(8px)"; setTimeout(function(){ if(t.parentNode)t.parentNode.removeChild(t); },240); }, isErr?3400:2400);
    }catch(e){ try{ dxCenterToast(m); }catch(e2){} }
  }
  // dedicated bottom-center toast (used by the copy button)
  function dxCenterToast(m){ var el=q("#lxCenterToast"); if(!el){ el=document.createElement("div"); el.id="lxCenterToast"; document.body.appendChild(el); } el.textContent=m; el.classList.add("show"); clearTimeout(el.__t); el.__t=setTimeout(function(){ el.classList.remove("show"); },1800); }
  // Copy the issuer by routing the click through a HIDDEN .lx-tw-copy proxy, so the design's own copy handler
  // runs (real "Copied to clipboard" toast) without restyling our small issuer icon (adding .lx-tw-copy to the
  // icon itself enlarged it + triggered the design's check-swap animation).
  // Clipboard with a fallback: the async API needs a secure context, and the execCommand path keeps
  // older mobile browsers working rather than failing silently.
  function dxCopyText(v){
    function legacy(){ return new Promise(function(res,rej){ try{
      var ta=document.createElement("textarea"); ta.value=v; ta.setAttribute("readonly","");
      ta.style.cssText="position:fixed;left:-9999px;top:0;opacity:0"; document.body.appendChild(ta);
      ta.select(); ta.setSelectionRange(0,v.length);
      var ok=document.execCommand("copy"); document.body.removeChild(ta);
      ok?res():rej(new Error("copy rejected"));
    }catch(err){ rej(err); } }); }
    // The async API is present far more often than it is USABLE — it rejects without a secure context,
    // without document focus, or on a denied permission. Existing is not the same as working, so fall
    // through to execCommand on rejection rather than reporting a failure the user cannot act on.
    try{ if(navigator.clipboard&&navigator.clipboard.writeText)
      return navigator.clipboard.writeText(v).catch(legacy); }catch(_){}
    return legacy();
  }
  // Exposed so the mobile trade layer (_mobtrade.js) raises the SAME toast as everything else here
  // rather than inventing a second look.
  try{ window.__lxDXAtoast=dxToast; }catch(_){}
  function wireCopy(){ if(window.__lxDXAcopy)return; window.__lxDXAcopy=1;
    var proxy=document.createElement("button"); proxy.className="lx-tw-copy"; proxy.setAttribute("aria-hidden","true"); proxy.style.cssText="position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none"; document.body.appendChild(proxy);
    // The MOBILE issuer chip has no .copy-i — its icons are bare <svg> inside the .addr[data-copy] span
    // — so this handler never fired on a phone and the button looked dead. Accept a tap anywhere on the
    // issuer chip as well, which is also the better touch target.
    // item 3: tapping anywhere on a pools row opens that pool. A real link inside the row still wins,
    // so the pair icons/name keep whatever behaviour they already had.
    document.addEventListener("click",function(e){
      var t=e.target; if(!t||!t.closest)return;
      if(t.closest("a[href]"))return;
      var r=t.closest("tr.dxa-pl-row[data-pool]"); if(!r)return;
      var h=r.getAttribute("data-pool"); if(!h)return;
      e.preventDefault(); e.stopPropagation();
      if(e.stopImmediatePropagation)e.stopImmediatePropagation();
      location.href=h;
    },true);
    document.addEventListener("click",function(e){ var t=e.target; if(!t||!t.closest)return;
      var ci=t.closest(".copy-i")||t.closest(".asset-meta .addr[data-copy],.asset-meta-row .addr[data-copy]"); if(!ci)return;
      var host=ci.closest("[data-copy]"); var val=host?host.getAttribute("data-copy"):null; if(!val||val==="native")return;
      e.preventDefault(); e.stopPropagation();
      // The proxy exists to borrow the design's own copy handler, which owns the "Copied" toast — but
      // that handler ships with the DESKTOP header chip. No .lx-topwallet means no handler, so the
      // click vanished silently on mobile. There, do the copy and the toast ourselves.
      if(document.querySelector(".lx-topwallet")){
        proxy.setAttribute("data-copy",val); proxy.dispatchEvent(new MouseEvent("click",{bubbles:true}));
      } else {
        // Match desktop exactly: the design's handler raises "Copied to clipboard" in a dark pill with a
        // green check, and dxToast is a deliberate copy of that styling — so use it rather than the
        // plain centre pill, and use the same wording.
        dxCopyText(val).then(function(){ dxToast("Copied to clipboard"); },
                             function(){ dxToast("Could not copy \\u2014 long-press to select",true); });
      }
    },true);
  }
  function dxLoadSdk(){ if(window.StellarSdk)return Promise.resolve(window.StellarSdk); if(_dxsdk)return _dxsdk;
    _dxsdk=new Promise(function(res,rej){ var s=document.createElement("script"); s.src="/assets/vendor/stellar-sdk-13.3.0.min.js"; s.onload=function(){res(window.StellarSdk);}; s.onerror=function(){rej(new Error("SDK load failed"));}; document.head.appendChild(s); }); return _dxsdk; }
  function dxWallet(){ try{ return (localStorage.getItem("lumos.wallet")||"freighter").toLowerCase(); }catch(_){ return "freighter"; } }
  // sign with the ACTUALLY-connected wallet (was hardcoded to Freighter -> Rabet users got a Freighter popup).
  function dxSign(xdr,addr){ var w=dxWallet();
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
  }
  function dxTimeout(p,ms,msg){ return Promise.race([Promise.resolve(p), new Promise(function(_,rej){ setTimeout(function(){ rej(new Error(msg||"Timed out")); }, ms||120000); })]); }
  // current side + the (pay,receive) asset descriptors {code,iss,native}
  function dxSide(){ return window.__lxDXAside==="sell"?"sell":"buy"; }
  function assetXLM(){ return {code:"XLM",iss:"",native:true}; }
  function assetTok(){ return {code:CODE,iss:ISSUER,native:false}; }
  function payAsset(){ return dxSide()==="buy"?assetXLM():assetTok(); }
  function recvAsset(){ return dxSide()==="buy"?assetTok():assetXLM(); }
  function balOf(a){ return a.native?window.__lxDXAxlm:window.__lxDXAassetBal; }
  function spendOf(a){ return a.native?(window.__lxDXAxlmSpend!=null?window.__lxDXAxlmSpend:window.__lxDXAxlm):window.__lxDXAassetBal; }
  function payEl(){ return qa(".dxa-pane-swap .dxa-trade-field")[0]; }
  function recvEl(){ return qa(".dxa-pane-swap .dxa-trade-field")[1]; }
  function payInput(){ var f=payEl(); return f?f.querySelector(".dxa-trade-ir input"):null; }
  function recvInput(){ var f=recvEl(); return f?f.querySelector(".dxa-trade-ir input"):null; }
  // the site logo-painter only repaints its originally-scanned chips and misses our data-logo change (a
  // load-time race), so we paint the icon OURSELVES via a ::before driven by the --lxtic custom property
  // (the painter can't touch pseudo-elements) -> reliable + painter-proof. Token uses the page asset's real
  // logo; XLM uses the embedded Stellar mark.
  // The site ships its own Stellar mark and already uses it in the app bar, pools, trending, launchpad and
  // the bridge. CoinGecko renders the same logo on a WHITE SQUARE, which reads as a different asset next to
  // the black-circle version sitting inches above it in the header. One file, one mark, everywhere.
  function xlmLogoCss(){ return 'url(/assets/tokens/xlm.png)'; }
  function setChip(field,a){ if(!field)return; var chip=field.querySelector(".dxa-trade-asset"); if(!chip)return;
    var lbl=a.native?"XLM":a.code;
    var tn=[].slice.call(chip.childNodes).filter(function(n){return n.nodeType===3&&(n.nodeValue||"").replace(/\\s/g,"");})[0];
    if(tn){ if(tn.nodeValue.trim()!==lbl)tn.nodeValue=lbl; } else chip.appendChild(document.createTextNode(lbl));
    var ic=chip.querySelector(".dxa-trade-ic"); if(!ic)return;
    var css=a.native?xlmLogoCss():logoBg(); if(!css)return;
    if(ic.getAttribute("data-lxic")!==lbl)ic.setAttribute("data-lxic",lbl);
    if(ic.style.getPropertyValue("--lxtic")!==css)ic.style.setProperty("--lxtic",css);
  }
  function applyTradeWidget(){
    var pane=q(".dxa-pane-swap"); if(!pane)return;
    // NATIVE: there is no counter asset — "Buy XLM / Sell XLM" (paying XLM for XLM) is nonsense and the
    // execute path is guarded off anyway. Make the widget honestly inert: neutral labels + disabled CTA.
    if(NATIVE){ qa(".dxa-pane-swap .dxa-side-btn.buy, .dxa-pane-swap .dxa-side-btn.sell").forEach(function(b){ var w=b.classList.contains("buy")?"Buy":"Sell"; if(b.textContent.trim()!==w)b.textContent=w; });
      var ncta=q(".dxa-trade-cta"); if(ncta){ if(ncta.getAttribute("data-lxdis")!=="1")ncta.setAttribute("data-lxdis","1"); var nl="Select an asset to trade"; if(ncta.textContent.trim()!==nl)ncta.textContent=nl; } return; }
    var side=dxSide();
    // Buy/Sell button labels + active state
    qa(".dxa-pane-swap .dxa-side-btn.buy, .dxa-pane-swap .dxa-side-btn.sell").forEach(function(b){
      var isBuy=b.classList.contains("buy"); var want=(isBuy?"Buy ":"Sell ")+CODE; if(b.textContent.trim()!==want)b.textContent=want;
      var on=(isBuy&&side==="buy")||(!isBuy&&side==="sell"); if(b.classList.contains("active")!==on)b.classList.toggle("active",on); });
    // pay / receive asset chips (code + icon) follow the side
    setChip(payEl(),payAsset()); setChip(recvEl(),recvAsset());
    // re-assert the active %/MAX highlight (the design re-renders these buttons, wiping our class). Set the
    // orange INLINE with !important too — some design rules defeat even our stylesheet !important.
    qa(".dxa-pane-swap .dxa-trade-quick button").forEach(function(o){ var on=_dxQuick!=null&&(o.textContent||"").trim().toUpperCase()===_dxQuick; o.classList.toggle("lxq-active",on);
      if(on){ o.style.setProperty("background","#ea6a2c","important"); o.style.setProperty("color","#fff","important"); o.style.setProperty("border-color","#ea6a2c","important"); }
      else if(o.style&&o.style.background){ o.style.removeProperty("background"); o.style.removeProperty("color"); o.style.removeProperty("border-color"); } });
    // CTA label reflects the side (unless mid-signing)
    var cta=q(".dxa-trade-cta"); if(cta&&!cta.__lxbusy){ var wl="Swap"; if(cta.textContent.trim()!==wl)cta.textContent=wl; }
  }
  function applyOhlc(){
    if(!dayOHLC)return;
    try{ var _mt=q(".price-display .meta"); if(_mt){ var _bs=_mt.querySelectorAll("b.mono");
      if(_bs[0]){_bs[0].textContent=xlmAmt(dayOHLC.h)+" XLM";_bs[0].classList.add("lxp");}
      if(_bs[1]){_bs[1].textContent=xlmAmt(dayOHLC.l)+" XLM";_bs[1].classList.add("lxp");} } }catch(_){}
    var s=q(".ohlc-strip"); if(!s)return; var pairs=s.querySelectorAll(".pair");
    function set(i,txt,cls){ var p=pairs[i]; if(!p)return; var v=p.querySelector(".v");
      if(v){ if(v.textContent!==txt)v.textContent=txt; v.classList.add("lxp"); }   // strict now: reveal only on OUR write
      if(cls!=null){ p.classList.remove("up","down"); if(cls)p.classList.add(cls); } }
    var o=dayOHLC.o,h=dayOHLC.h,l=dayOHLC.l,c=dayOHLC.c;
    // #20: this strip is the chart's own four numbers, so it has to move with it -- leaving it in XLM
    // beside a dollar axis is exactly the mismatch the switch exists to remove. dayOHLC is in XLM per
    // unit (Horizon's quote asset), so the dollar reading multiplies by the rate rather than dividing.
    var _od=(cDenom()==="usd"&&xlmUsd>0);
    // The denomination is stated three times over on this strip -- the user picked XLM on the toggle, the
    // chart corner is labelled XLM, and then every one of O/H/L/C repeated it, which is what pushed the
    // four values onto two lines. The dollar form keeps its $ because a leading symbol costs one glyph
    // and reads as part of the number; a trailing ticker repeated four times does not.
    function _op(v){ return _od?("$"+axisNum(v*xlmUsd)):xlmAmt(v); }
    set(0,_op(o),null);
    set(1,_op(h),"up");
    set(2,_op(l),"down");
    set(3,_op(c), c>=o?"up":"down");
    // #7: the change over the SELECTED window, not always the day.
    //
    // dayOHLC is one 24h bucket, so on the 1W / 1M / 1Y tabs this cell was answering a question nobody
    // had asked -- the chart showed a year and the delta beside it showed yesterday. The drawn series is
    // the right source: first point to last point IS the move over whatever window is on screen, and it
    // needs no extra request because the chart has already fetched it.
    //
    // Scale-invariant, so it does not matter whether the series is in dollars or lumens: a ratio of two
    // points cancels the conversion. Falls back to the day bucket if the series has not landed yet.
    var dp, dlab="";
    if(chartTF!=="1D"&&chartPts&&chartPts.length>1){
      var _a=+chartPts[0].v, _b=+chartPts[chartPts.length-1].v;
      dp=(_a>0)?(((_b-_a)/_a)*100):0;
      dlab=" "+chartTF;
    } else { dp=o>0?((c-o)/o*100):0; }
    set(4,(dp>=0?"+":"")+dp.toFixed(2)+"%"+dlab, dp>=0?"up":"down");
    set(5,abbrNum(dayOHLC.v),null);
  }

  // ================= Swap "You pay" balance + quick % buttons (Phase-1; execution stays Phase 2) =================
  function lxAddr(){ try{ return localStorage.getItem("lumos.address")||""; }catch(e){ return ""; } }
  function loadWalletBalance(){
    var addr=lxAddr(); if(!addr){ window.__lxDXAxlm=null; window.__lxDXAassetBal=null; window.__lxDXAhasTrust=null; return; }
    if(window.__lxDXAwalletLoading)return; window.__lxDXAwalletLoading=true;
    j(H+"/accounts/"+addr).then(function(a){ var nat=0, sub=+a.subentry_count||0, ab=0, has=false;
      var _sellLiab=0;
      (a.balances||[]).forEach(function(b){ if(b.asset_type==="native"){ nat=+b.balance; _sellLiab=+b.selling_liabilities||0; } else if(b.asset_code===CODE&&b.asset_issuer===ISSUER){ ab=+b.balance; has=true; } });
      // AUDIT (user-reported "Trade says I have 0 XLM"): this used its OWN reserve maths and then subtracted
      // a further 0.5 XLM of arbitrary head-room, so a wallet with 0.043 XLM genuinely spendable displayed
      // 0. It also ignored sponsorship, unlike the wallet. Use the wallet's figure (__lxMaxXLM) whenever it
      // is available so both pages state the same number, and mirror its formula as the fallback.
      var _spon=(+a.num_sponsoring||0)-(+a.num_sponsored||0);
      var _minRes=(2+sub+_spon)*0.5;   // Stellar base reserve: 0.5 XLM per (2 base + each subentry/sponsored entry)
      var _free=Math.max(0, nat-_minRes-_sellLiab-0.001);   // 0.001 covers a few hundred base fees
      // AUDIT (user-reported: "it showed XLM available, then the swap failed on insufficient balance"):
      // buying an asset the account does not hold yet adds a changeTrust op, and that new subentry raises
      // the minimum reserve by a further 0.5 XLM. Both _free and the wallet's __lxMaxXLM describe the
      // balance BEFORE that op, so offering all of it guaranteed a failure at submit. Exclude the reserve
      // the trade itself is about to lock up, so the figure shown is what is genuinely tradable.
      var _trustRes=(!has&&!NATIVE)?0.5:0;
      window.__lxDXAxlm=nat; window.__lxDXAxlmFree=Math.max(0, nat-_minRes-_sellLiab);
      var _spendBase=(window.__lxMaxXLM!=null)?window.__lxMaxXLM:_free;
      window.__lxDXAxlmSpend=Math.max(0,_spendBase-_trustRes);
      window.__lxDXAassetBal=has?ab:0; window.__lxDXAhasTrust=has;
      // Release the in-flight latch on SUCCESS too. It was only cleared in the catch, so after the first
      // good load the flag stayed true for the life of the page and every later call returned at line one —
      // which is why the balance never moved again on its own, and why callers had to poke the flag by hand.
      window.__lxDXAwalletLoading=false;
      guardApply();
    }).catch(function(){ window.__lxDXAwalletLoading=false; window.__lxDXAxlm=null; });
  }
  // ---- quote helpers ----
  function apParam(role,a){ if(a.native)return role+"_asset_type=native"; return role+"_asset_type=credit_alphanum"+(a.code.length>4?"12":"4")+"&"+role+"_asset_code="+a.code+"&"+role+"_asset_issuer="+a.iss; }
  function destParam(a){ return "destination_assets="+(a.native?"native":encodeURIComponent(a.code+":"+a.iss)); }
  // ---- Soroswap aggregator "Smart Swap": price the same swap across Soroban AMMs (Soroswap/Phoenix/Aquarius)
  // alongside the classic Horizon path and route through whichever returns more. Mirrors _swapcalc's smart swap. ----
  var LX_SORO="/lxapi/soroswap";
  /* lxSoroKey removed: the API key must never reach a browser. Soroswap is called through
     /lxapi/soroswap, which attaches the key server-side from a Cloudflare secret. */
  function soroHeaders(){ return {"Content-Type":"application/json"}; }
  var _dxSacCache={};
  function dxSac(S,a){ var k=a.native?"native":(a.code+":"+a.iss); if(_dxSacCache[k])return _dxSacCache[k]; var as=a.native?S.Asset.native():new S.Asset(a.code,a.iss); var c=as.contractId(S.Networks.PUBLIC); _dxSacCache[k]=c; return c; }
  // Price impact on this page is a statement about THIS page's asset, because that is what the page is
  // about. Buying it consumes asks and pushes its price up, so the impact is positive; selling it eats
  // bids and pushes it down, so it is negative. The underlying arithmetic cannot supply that sign -- both
  // the Soroswap figure and the classic spot-probe measure how much worse than spot you executed, which is
  // a worsening in either direction and so always came out negative. Hence a buy of LUMOS reported -4.65%
  // when the trade was pushing LUMOS UP. Magnitude from the quote; direction from which side the asset is
  // on. The pair on this widget is always CODE against XLM (Buy = receive CODE, Sell = pay CODE).
  // Input ceiling. Stellar amounts are int64 stroops, so 922,337,203,685.4775807 is the largest quantity
  // of ANY asset the protocol can carry -- there is no such thing as a larger swap, which makes this the
  // real limit rather than a number picked to look sensible. Past it the figures meant nothing, and since
  // every line on the panel derives from this one box, the digits grew wide enough to shove the labels out
  // of their own cards ("You pay" wrapping onto two lines, values spilling the panel).
  // Also holds the field to Stellar's 7 decimal places and to a single decimal point.
  var DX_MAXSTR="922337203685.4775807";
  var DX_MAXMSG="Maximum is 922,337,203,685.4775807 \\u2014 Stellar cannot carry a larger amount";
  // Compare in STROOPS as integers. A double cannot hold the limit: parseFloat("922337203685.4775808")
  // rounds to exactly the maximum, so a float compare let the one value just past the ceiling through,
  // and String(max) rendered as "922337203685.4775" -- clamping to a number that was not the limit.
  function dxStroops(v){ var p=v.split("."), a=(p[0]||"0"), b=(p[1]||"").slice(0,7);
    while(b.length<7)b+="0";
    try{ return BigInt(a||"0")*BigInt(10000000)+BigInt(b||"0"); }catch(e){ return null; } }
  function dxClamp(inp){ if(!inp)return false;
    var raw=String(inp.value==null?"":inp.value), v=raw.replace(/[^0-9.]/g,"");
    var i=v.indexOf("."); if(i>=0)v=v.slice(0,i+1)+v.slice(i+1).replace(/\\./g,"");   // one decimal point only
    var d=v.indexOf("."); if(d>=0&&v.length-d-1>7)v=v.slice(0,d+8);                  // 7dp, Stellar precision
    var capped=false, st=v?dxStroops(v):null;
    if(st!==null&&st>BigInt("9223372036854775807")){ v=DX_MAXSTR; capped=true; }
    if(v!==raw)inp.value=v;
    return capped; }
  function dxImpDir(ra){ return (ra&&!ra.native&&ra.code===CODE)?1:-1; }
  // Turn "execution came out r times spot" into the move in the ASSET's price.
  //
  // The quote degradation (how much less you receive than spot) can only ever fall to zero, so reading it
  // as the impact pinned the number above 100% however large the order got -- 2.3M XLM into LUMOS showed
  // +99.75%, which was the formula reaching its own asymptote, not the market. Price is the reciprocal on
  // the buy side: paying r times fewer LUMOS per XLM means each LUMOS costs 1/r times more, and 1/r has no
  // ceiling. So a buy deep enough to clear the book can honestly read +500%, +15,000%, higher.
  //
  // Sells stay bounded, and correctly so: the floor is -100% because a price cannot fall past zero.
  function dxImpMag(r,ra){ if(!(r>0))return 0; if(r>1)r=1;           // your own order cannot improve the price it pays
    return dxImpDir(ra)>0?(1/r-1)*100:(1-r)*100; }
  // 2dp while small, then progressively coarser -- "+38,412%" reads; "+38412.37%" does not.
  function dxImpNum(m){ if(m<100)return m.toFixed(2); if(m<10000)return m.toFixed(1); return num(Math.round(m)); }
  function dxImpTxt(m,ra){ m=Math.abs(m); if(!isFinite(m))return dxImpDir(ra)>0?"\\u003e+999,999%":"-100%";
    if(m<0.01)return "<0.01%"; return (dxImpDir(ra)>0?"+":"-")+dxImpNum(m)+"%"; }
  function dxImpUp(m,ra){ return Math.abs(m)<0.01||dxImpDir(ra)>0; }
  // Past a point the market cannot fill the order at all, and a percentage stops meaning anything -- it
  // just counts how far beyond the end of the book you typed. On an AMM the output asymptotes to the whole
  // pool reserve, so more money buys nothing more; Horizon goes further and returns LESS for a bigger
  // input once it can no longer find a path (57.3B XLM quoted 16.3M LUMOS where 2.3M XLM quoted 22.2M).
  // Test it empirically rather than guessing a cutoff: re-quote at HALF the spend. If halving what you
  // pay barely changes (or improves) what you get, the quote has saturated and the size is not fillable.
  // Only runs once the impact is already large, so ordinary typing still costs two requests, not three.
  function dxSatCheck(pa,ra,net,out,cb){
    j(H+"/paths/strict-send?"+apParam("source",pa)+"&source_amount="+(net/2).toFixed(7)+"&"+destParam(ra))
      .then(function(pd){ var r=(pd._embedded&&pd._embedded.records)||[]; var half=r.length?parseFloat(r[0].destination_amount):0;
        cb(!(out>0)||(half>0&&out<=half*1.01)); })
      .catch(function(){ cb(false); }); }
  function dxSetImp(mag,ra,pa,net,best,seq){
    if(seq!==_dxSeq||!_dxView)return;
    _dxView.impact=dxImpTxt(mag,ra); _dxView.impUp=dxImpUp(mag,ra); reAssertView();
    if(mag<=100)return;                                   // a doubling of price is steep but still real
    dxSatCheck(pa,ra,net,best,function(sat){ if(seq!==_dxSeq||!_dxView||!sat)return;
      _dxView.impact="\\u2014"; _dxView.impUp=false; _dxView.unfillable=1; reAssertView();
      dxErr("Not enough liquidity to fill this size \\u2014 try a smaller amount");
      var c=q(".dxa-trade-cta"); if(c)c.setAttribute("data-lxdis","1"); }); }

  // POST /quote (EXACT_IN on the post-fee amount) -> {out, impact, quote, route, usesSoroban, usesAqua} or null
  function soroQuote(pa,ra,amtStroops){
    return dxLoadSdk().then(function(S){ var ai,ao; try{ ai=dxSac(S,pa); ao=dxSac(S,ra); }catch(e){ return null; }
      return fetch(LX_SORO+"/quote?network=mainnet",{method:"POST",headers:soroHeaders(),body:JSON.stringify({assetIn:ai,assetOut:ao,amount:String(amtStroops),tradeType:"EXACT_IN",protocols:["sdex","soroswap","phoenix"],slippageBps:50})}).then(function(r){ return r.ok?r.json():null; }).then(function(jj){ if(!jj||!jj.amountOut)return null;
        var route=(jj.routePlan||[]).map(function(x){ return {p:(x.swapInfo&&x.swapInfo.protocol)||"",pct:x.percent}; });
        var usesSoroban=route.some(function(x){ return x.p==="aqua"||x.p==="soroswap"||x.p==="phoenix"; });
        return {out:+jj.amountOut/1e7, impact:parseFloat(jj.priceImpactPct||"0"), quote:jj, route:route, usesSoroban:usesSoroban, usesAqua:route.some(function(x){return x.p==="aqua";})}; }).catch(function(){ return null; }); }); }
  // #5: "Swap failed — Load failed" told the user nothing. "Load failed" is Safari's wording for a
  // fetch that never completed at all -- not an error the server returned -- so it can only come from one
  // of the two calls below, and the toast gave no way to tell which. Naming the stage turns an unusable
  // report into a diagnosable one, and says plainly that the order was NOT placed, which is the thing
  // someone staring at a failed swap most needs to know.
  function soroNet(stage){ return function(e){ var m=(e&&e.message)||String(e||"");
    throw new Error("could not reach the swap router ("+stage+": "+m+"). Nothing was signed or sent — try again in a moment."); }; }
  function soroBuild(quote,from){ return fetch(LX_SORO+"/quote/build?network=mainnet",{method:"POST",headers:soroHeaders(),body:JSON.stringify({quote:quote,from:from,to:from})}).catch(soroNet("build")).then(function(r){ return r.json(); }).then(function(jj){ if(jj&&jj.xdr)return jj.xdr; var m=(jj&&(jj.message||jj.error))||"Could not build swap"; if(/poolHash/i.test(m))m="Aquarius routing is view-only for now (router build pending) \\u2014 this rate is not yet executable"; throw new Error(m); }); }
  // A failure HERE is different: the transaction is signed, and may or may not have reached the network.
  // The wording must not claim it did not happen.
  function soroSend(signedXdr){ return fetch(LX_SORO+"/send?network=mainnet",{method:"POST",headers:soroHeaders(),body:JSON.stringify({xdr:signedXdr})}).catch(function(e){ throw new Error("could not reach the swap router while submitting ("+((e&&e.message)||e)+"). Check your wallet history before retrying."); }).then(function(r){ return r.json(); }).then(function(jj){ if(jj&&(jj.success||jj.txHash))return jj; var x=jj&&(jj.message||jj.error||(jj.result&&jj.result.error)); throw new Error(x||"Swap submit failed"); }); }
  function protLabel(soro){ var ps=(soro.route||[]).map(function(x){return x.p;}).filter(function(v,i,a){return v&&a.indexOf(v)===i;}); var nice={aqua:"Aquarius",soroswap:"Soroswap",phoenix:"Phoenix",sdex:"Stellar DEX"}; return ps.map(function(p){return nice[p]||p;}).join(" + ")||"Aquarius"; }
  // Soroswap's build assumes the destination trustline already exists -> add it (own signature) first if missing
  function dxEnsureTrust(ra){ if(ra.native||window.__lxDXAhasTrust)return Promise.resolve(false); var addr=lxAddr(); if(!addr)return Promise.reject(new Error("No wallet connected"));
    return dxLoadSdk().then(function(S){ var asset=new S.Asset(ra.code,ra.iss); return j(H+"/accounts/"+addr).then(function(acc){ var tb=new S.TransactionBuilder(new S.Account(addr,acc.sequence),{fee:"1000",networkPassphrase:WPASS_PUB}).addOperation(S.Operation.changeTrust({asset:asset})).setTimeout(120).build();
      return dxTimeout(dxSign(tb.toXDR(),addr),150000,"Signing timed out \\u2014 open your wallet and try again").then(function(signed){ return fetch(H+"/transactions",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"tx="+encodeURIComponent(signed)}).then(function(r){return r.json();}).then(function(res){ if(res&&(res.successful||res.hash)){ window.__lxDXAhasTrust=true; return true; } var x=res&&res.extras&&res.extras.result_codes; throw new Error(x?("Trustline failed: "+JSON.stringify(x)):"Trustline failed"); }); }); }); }); }
  // build unsigned XDR from the best-rate quote -> sign with the connected wallet -> submit via Soroswap
  function soroExecute(soro){ var addr=lxAddr(); if(!addr)return Promise.reject(new Error("No wallet connected"));
    return soroBuild(soro.quote,addr).then(function(xdr){ return dxTimeout(dxSign(xdr,addr),150000,"Signing timed out \\u2014 open your wallet and try again").then(function(signed){ return soroSend(signed); }); }); }
  // paint/hide the Smart Swap badge in the swap pane (state re-asserted by reAssertView so the design can't wipe it)
  function dxSmartBadge(soro){ var pane=q(".dxa-pane-swap"); if(!pane)return; var b=pane.querySelector(".lx-dxsmart");
    if(!soro){ if(b)b.style.display="none"; return; }
    if(!b){ b=document.createElement("div"); b.className="lx-dxsmart"; var anchor=pane.querySelector(".lxda-swaperr")||q(".dxa-trade-cta"); if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(b,anchor); else pane.appendChild(b); }
    var html='<span class="lx-sb-ic"><svg viewBox="0 0 24 24"><path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z"></path></svg></span><span class="lx-sb-mid"><div class="lx-sb-ttl">Smart Swap</div><div class="lx-sb-sub">Best rate via <b>'+protLabel(soro)+'</b></div></span><span class="lx-sb-best">Best rate</span>';
    if(b.getAttribute("data-h")!==html){ b.innerHTML=html; b.setAttribute("data-h",html); } b.style.display=""; }
  // best available (top-of-book) receive-per-pay from a small strict-send probe, cached per direction — the
  // honest reference for price impact (the daily-close spot can drift and show a false favorable impact)
  function dxSpotRate(pa,ra,cb){ var key=(pa.native?"X":pa.code)+">"+(ra.native?"X":ra.code); if(_dxSpot[key]>0){ cb(_dxSpot[key]); return; } var probe=pa.native?"5":"1"; j(H+"/paths/strict-send?"+apParam("source",pa)+"&source_amount="+probe+"&"+destParam(ra)).then(function(pd){ var recs=(pd._embedded&&pd._embedded.records)||[]; var out=recs.length?parseFloat(recs[0].destination_amount):0; if(out>0){ _dxSpot[key]=out/parseFloat(probe); cb(_dxSpot[key]); } }).catch(function(){}); }
  function dxErr(m){ var pane=q(".dxa-pane-swap"); if(!pane)return; var cta=q(".dxa-trade-cta"); var e=pane.querySelector(".lxda-swaperr"); if(!e){ if(!m)return; e=document.createElement("div"); e.className="lxda-swaperr"; if(cta&&cta.parentNode)cta.parentNode.insertBefore(e,cta); } if(m){ e.textContent=m; e.style.display="block"; } else { e.style.display="none"; e.textContent=""; } }
  // The design ships the receive-side dollar value as mock text -- a literal "\\u2248 $21.67 USD" in a plain
  // .mono span. This looked for .lc-money, which does not exist in that field, found nothing, and returned
  // without writing. So the mock stood in for every quote ever shown: 1,000 XLM of LUMOS (~$165) read
  // $21.67, and so did 5,000,000 LUMOS sold for 989 XLM, and so did every other size in both directions.
  // The arithmetic behind it was always right -- receive x priceUsd(), or x xlmUsd when receiving XLM --
  // it just had nowhere to land. Match the span that is really there, and keep the design's "= $x USD"
  // shape so the row still reads as drawn.
  // Compact once the digits stop being readable. A swap can legitimately price in the billions, and
  // "$145,613,063,694.22" is a wall that says less than "$145.61B" while being wide enough to fight the
  // label for the row. Full precision stays below a million, where the cents are the point.
  function dxUsdTxt(v){ if(!(v>0))return "\\u2248 $0.00 USD";
    var b=v>=1e12?[1e12,"T"]:v>=1e9?[1e9,"B"]:v>=1e6?[1e6,"M"]:null;
    if(b)return "\\u2248 $"+(v/b[0]).toFixed(2)+b[1]+" USD";
    return "\\u2248 $"+(v>=1?v.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}):v.toFixed(4))+" USD"; }
  function setRecvUsd(usdv){ var rf=recvEl(); if(!rf)return;
    var lc=rf.querySelector(".dxa-trade-frow .lc-money")||rf.querySelector(".dxa-trade-frow .mono"); if(!lc)return;
    var t=dxUsdTxt(usdv);
    if(lc.getAttribute("data-orig")!=null)lc.setAttribute("data-orig",t);
    if(lc.textContent!==t)lc.textContent=t; try{lxMark(lc);}catch(_){} }
  // Same figure for the pay side, so both halves of the trade are priced and the cost of the swap is
  // readable straight off the two lines. The pay row already ends in "Balance: ...", which shares the
  // exact classes the receive USD span uses -- so this gets its OWN element rather than a selector that
  // would have quietly eaten the balance. margin-left:auto parks it beside the balance on the right.
  function payFieldEl(){ return qa(".dxa-pane-swap .dxa-trade-field")[0]; }
  // Limit tab: price the TOTAL (denominated in XLM) at the current market rate. Amount and Limit price
  // are deliberately untouched -- on a limit order those are the users own numbers, not market ones.
  // Everything here is derived from the live book plus the price the user typed, so it moves as they type.
  // Buy joins the BIDS, sell joins the ASKS -- "ahead of you" is the volume that would fill first.
  function limitSide(){ try{ var pane=q(".dxa-pane-limit"); if(!pane)return "buy";
    var btns=[].slice.call(pane.querySelectorAll("button,div"));
    for(var i=0;i<btns.length;i++){ var t=(btns[i].textContent||"").trim().toLowerCase();
      if((t==="buy"||t==="sell")&&/\bactive\b|\bon\b|\bsel\b/.test(btns[i].className||"")) return t; }
  }catch(_){} return "buy"; }
  function setOrderCtx(){ try{
    var pane=q(".dxa-pane-limit"); if(!pane)return;
    var bk=window.__lxDXAob||window.__lxDXAbook; if(!bk)return;
    var asks=(bk.asks||[]), bids=(bk.bids||[]);
    if(!asks.length&&!bids.length)return;
    var host=pane.querySelector(".lx-oc");
    if(!host){ host=document.createElement("div"); host.className="lx-oc";
      var sum=pane.querySelector(".dxa-trade-summary,.mdxa-trade-summary");
      if(sum&&sum.parentNode)sum.parentNode.insertBefore(host,sum); else pane.appendChild(host); }
    var f=pane.querySelectorAll(".dxa-trade-field");
    var pin=f.length?f[0].querySelector("input"):null;
    var pr=parseFloat(String((pin&&pin.value)||"").replace(/,/g,""))||0;
    var bb=bids.length?parseFloat(bids[0].price):0, ba=asks.length?parseFloat(asks[0].price):0;
    var mid=(bb&&ba)?(bb+ba)/2:(bb||ba);
    var spread=(bb&&ba&&mid)?((ba-bb)/mid*100):null;
    var side=limitSide(), ref=(side==="buy")?ba:bb;
    // how far the typed price sits from the price it would have to reach to fill immediately
    var away=(pr>0&&ref)?((pr-ref)/ref*100):null;
    var awayTxt=(away==null)?"\u2014":(Math.abs(away)<0.01?"at the "+(side==="buy"?"ask":"bid")
      :(Math.abs(away).toFixed(2)+"% "+(away<0?"below ":"above ")+(side==="buy"?"the ask":"the bid")));
    var fills=(pr>0&&ref)&&((side==="buy")?pr>=ba:pr<=bb);
    // How much of THIS order the book can actually absorb right now. Crossing the spread does not mean
    // filling: 100,000,000 LUMOS against a book holding a few hundred XLM crosses and barely fills.
    // Buy consumes asks at or below your price (their amount is in CODE); sell consumes bids at or above
    // it (their amount is in XLM, so it converts at each level price to compare like for like).
    var fillPct=null;
    if(fills){ var amtIn=f.length>1?f[1].querySelector("input"):null;
      var want=parseFloat(String((amtIn&&amtIn.value)||"").replace(/,/g,""))||0;
      if(want>0){ var have=0, src=(side==="buy")?asks:bids;
        for(var k=0;k<src.length;k++){ var kp=parseFloat(src[k].price), ka=parseFloat(src[k].amount)||0;
          var usable=(side==="buy")?(kp<=pr):(kp>=pr); if(!usable)break;
          have+=(side==="buy")?ka:(kp>0?ka/kp:0); }
        fillPct=Math.max(0,Math.min(100,have/want*100)); } }
    // queue: orders already at your price or better on YOUR side of the book
    var q0=0,n=0,list0=[];
    if(pr>0){ var list=(side==="buy")?bids:asks; list0=list;
      for(var i=0;i<list.length;i++){ var lp=parseFloat(list[i].price);
        var better=(side==="buy")?(lp>=pr):(lp<=pr);
        if(!better)break; var _raw=parseFloat(list[i].amount)||0; q0+=(side==="buy")?(lp>0?_raw/lp:0):_raw; n++; } }
    host.innerHTML='<div class="lx-oc-t">Order context</div>'
      +'<div class="lx-oc-r"><span>Best bid / ask (XLM)</span><b>'+(bb?(+bb.toPrecision(6)):"\u2014")+' / '+(ba?(+ba.toPrecision(6)):"\u2014")+'</b></div>'
      +'<div class="lx-oc-r"><span>Spread</span><b>'+(spread==null?"\u2014":spread.toFixed(2)+"%")+'</b></div>'
      +'<div class="lx-oc-r"><span>Your price</span><b class="'+(fills?"lx-oc-ok":"")+'">'+awayTxt+'</b></div>'
      +'';
    var ocL,ocV,ocC;
    if(!(pr>0)){ ocL="Ahead of you"; ocV="\\u2014"; ocC=""; }
    else if(fills){ ocL="Execution"; var _pf=(fillPct==null)?100:fillPct;
      if(_pf>=99.5){ ocV="fills now"; ocC="lx-oc-ok"; }
      else { var _a=(_pf<0.5)?"<1%":(Math.round(_pf)+"%"), _b=Math.max(0,100-Math.round(_pf));
        ocV=_a+" fills now | "+_b+"% open order"; ocC="lx-oc-hi"; } }
    else { ocL="Ahead of you"; ocC=n?"lx-oc-hi":"lx-oc-ok";
      var _cq=(n>0&&n>=list0.length); ocV=n?((_cq?"over ":"")+qtyTxt(q0)+" "+CODE+" \\u00b7 "+n+(_cq?"+ orders":(n===1?" order":" orders"))):"nothing \\u2014 first in line"; }
    host.innerHTML+='<div class="lx-oc-r"><span>'+ocL+'</span><b class="'+ocC+'">'+ocV+'</b></div>';
  }catch(_){} }
  function setLimitTotalUsd(){ try{
    var pane=q(".dxa-pane-limit"); if(!pane)return;
    var f=pane.querySelectorAll(".dxa-trade-field"); if(f.length<3)return;
    var row=f[2].querySelector(".dxa-trade-frow"); if(!row)return;
    var el=row.querySelector(".lx-ltusd");
    if(!el){ el=document.createElement("span"); el.className="lx-ltusd"; row.appendChild(el); }
    var inp=f[2].querySelector("input");
    var t=parseFloat(String((inp&&inp.value)||"").replace(/,/g,""))||0;
    var txt=(t>0&&xlmUsd>0)?dxUsdTxt(t*xlmUsd):"";
    if(el.textContent!==txt)el.textContent=txt;
  }catch(_){} }
  function setPayUsd(usdv){ var pf=payFieldEl(); if(!pf)return; var row=pf.querySelector(".dxa-trade-frow"); if(!row)return;
    var el=row.querySelector(".lx-payusd");
    if(!(usdv>0)){ if(el)el.textContent=""; return; }
    if(!el){ el=document.createElement("span"); el.className="mono lxp lx-payusd";
      var bal=row.querySelector(".mono:not(.lx-payusd)"); if(bal)row.insertBefore(el,bal); else row.appendChild(el); }
    var t=dxUsdTxt(usdv);
    if(el.textContent!==t)el.textContent=t; try{lxMark(el);}catch(_){} }
  function setSummary(label,val,cls){ var rows=qa(".dxa-pane-swap .dxa-tsum-row"); for(var i=0;i<rows.length;i++){ var sps=rows[i].querySelectorAll("span"); var lab=sps[0]?(sps[0].textContent||""):""; if(new RegExp(label,"i").test(lab)){ var m=rows[i].querySelector(".mono")||sps[1]; if(m){ if(cls!=null){ m.classList.remove("up","down"); if(cls)m.classList.add(cls); } if(m.textContent!==val)m.textContent=val; } return; } } }
  // single source of truth for the receive side + summary; the design keeps re-asserting its own mock
  // (USDC / 0.23659), so we paint from _dxView and re-assert it via guardSwap the instant it reverts.
  function reAssertView(){ var rin=recvInput(), ra=recvAsset();
    // Do not fight the user for the box they are typing in. While You receive has focus it is an INPUT,
    // not a readout: the reverse quote drives You pay from it, and overwriting it mid-keystroke would
    // make it impossible to type. The summary and USD line still update from _dxView.
    if(rin&&document.activeElement===rin)rin=null;
    if(_dxView){ if(rin&&rin.value!==_dxView.recv)rin.value=_dxView.recv; setRecvUsd(_dxView.usd); setPayUsd(_dxView.payUsd||0);
      setSummary("Rate",_dxView.rate); setSummary("Price impact",_dxView.impact,_dxView.impUp?"up":"down"); setSummary("Slippage",SLIP+"%"); setSummary("Min received",_dxView.minR); setSummary("Network fee","0.00001 XLM"); dxSmartBadge(_dxView.soro||null); }
    else { if(rin&&rin.value!=="")rin.value=""; setRecvUsd(0); setPayUsd(0); setSummary("Rate","\\u2014"); setSummary("Price impact","\\u2014"); setSummary("Min received","\\u2014"); dxSmartBadge(null); }
  }
  // REVERSE QUOTE: type what you want to RECEIVE and we solve for the pay amount.
  //
  // Horizon's strict-receive path returns the source amount needed for an exact destination amount. The
  // platform fee comes off the pay side BEFORE the path runs (dxQuote sends amt-fee), so the gross pay is
  // source/(1-feeRate). We write that into You pay and hand back to the normal forward quote, which then
  // recomputes rate, impact, min received and the CTA exactly as if you had typed the pay amount.
  //
  // Deliberately NOT a strict-receive swap: the signed transaction is the same pathPaymentStrictSend it
  // has always been, priced from the pay amount. Only which box you type in changes, so nothing about
  // execution, fees or slippage handling moves.
  var _dxRevT=null, _dxRevSeq=0;
  function dxQuoteReverse(){
    var rin=recvInput(), pin=payInput(); if(!rin||!pin)return;
    if(_dxRevT){ clearTimeout(_dxRevT); _dxRevT=null; }
    var want=dxNum(rin.value);
    if(!(want>0)){ pin.value=""; _dxLastPay=""; _dxView=null; dxErr(""); reAssertView(); return; }
    var pa=payAsset(), ra=recvAsset(), seq=++_dxRevSeq;
    _dxRevT=setTimeout(function(){
      j(H+"/paths/strict-receive?source_assets="+(pa.native?"native":encodeURIComponent(pa.code+":"+pa.iss))
        +"&"+apParam("destination",ra)+"&destination_amount="+want.toFixed(7)).then(function(pd){
        if(seq!==_dxRevSeq)return;                       // a later keystroke already superseded this one
        var recs=(pd&&pd._embedded&&pd._embedded.records)||[];
        var src=recs.length?parseFloat(recs[0].source_amount):0;
        if(!(src>0)){ dxErr("No route for that amount"); return; }
        dxErr("");
        var gross=src/(1-FEE_RATE());
        pin.value=(+gross.toFixed(7)).toString();
        _dxQuick=null; qa(".dxa-pane-swap .dxa-trade-quick button").forEach(function(o){o.classList.remove("lxq-active");});
        dxQuote();
      }).catch(function(){ if(seq===_dxRevSeq)dxErr("Could not price that amount"); });
    },350);
  }
  function enforceWidget(){ var pane=q(".dxa-pane-swap"); if(!pane)return; applyTradeWidget(); if(NATIVE)return;
    var pin=payInput(); var pv=pin?(pin.value||"").trim():""; if(pv!==_dxLastPay)dxQuote(); else reAssertView(); }
  // dedicated synchronous observer: whenever the design's mock calculator rewrites the receive label/amount/
  // summary, immediately re-assert ours (mirrors guardHeader — beats the flicker, no visible mock frame).
  function guardSwap(){ var pane=q(".dxa-pane-swap"); if(!pane||pane.__lxsg)return; pane.__lxsg=1;
    try{ var mo=new MutationObserver(function(){ if(pane.__lxsgBusy)return; pane.__lxsgBusy=1; mo.disconnect(); try{ enforceWidget(); }catch(_){} try{ mo.observe(pane,{childList:true,subtree:true,characterData:true}); }catch(_){} pane.__lxsgBusy=0; });
      mo.observe(pane,{childList:true,subtree:true,characterData:true}); }catch(_){}
  }
  // Stellar amounts go down to 7 decimals, and JS renders anything below 1e-6 in exponential form. The old
  // parser stripped every character outside [0-9.] -- so "1e-7" lost its "e" and "-" and became SEVENTEEN.
  // A dust balance therefore read as a huge amount and the panel claimed "Insufficient balance" for the very
  // number MAX had just written. Strip separators only and let parseFloat read the notation it produced.
  function dxNum(v){ return parseFloat(String(v==null?"":v).replace(/[,s]/g,""))||0; }
  function dxQuote(){
    var pane=q(".dxa-pane-swap"); if(!pane||NATIVE)return;
    var pin=payInput(), cta=q(".dxa-trade-cta"); if(!pin)return;
    var raw=(pin.value||"").trim(); _dxLastPay=raw;
    var pa=payAsset(), ra=recvAsset();
    var amt=dxNum(raw);
    if(!(amt>0)){ _dxView=null; _dxQuoteOut=0; window.__lxDXASoro=null; dxErr(""); if(cta)cta.setAttribute("data-lxdis","1"); reAssertView(); return; }
    // #24: the SPENDABLE figure, not the raw one.
    //
    // This guard read balOf -- the account total -- while the balance printed directly above it comes
    // from spendOf, which subtracts the account reserve and selling liabilities. So the panel could say
    // "Balance: 0.759945 XLM" and the error underneath say "you have 33.2609": two numbers for one
    // thing, and the larger one unspendable. Worse than the wording, the CHECK was wrong too -- it would
    // pass any amount up to the raw total and let someone sign a transaction the reserve makes
    // impossible, which comes back as op_underfunded after they have already approved it.
    var bal=spendOf(pa);
    if(bal!=null&&amt>bal+1e-9){ dxErr("Insufficient "+(pa.native?"XLM":pa.code)+" balance \\u2014 you have "+xlmAmt(bal)); if(cta)cta.setAttribute("data-lxdis","1"); }
    else { dxErr(""); if(cta)cta.removeAttribute("data-lxdis"); }
    var fee=amt*FEE_RATE(), net=amt-fee, spot=pa.native?(assetXlm>0?1/assetXlm:0):assetXlm; // receive per pay
    var rcode=ra.native?"XLM":ra.code, pcode=pa.native?"XLM":pa.code;
    if(spot>0){ var est=net*spot; _dxView={payUsd:amt*(pa.native?xlmUsd:priceUsd()), recv:xlmAmt(est), usd:est*(ra.native?xlmUsd:priceUsd()), rate:"1 "+pcode+" = "+(+spot.toPrecision(6))+" "+rcode, impact:"\\u2026", impUp:true, minR:xlmAmt(est*(1-SLIP/100))+" "+rcode}; reAssertView(); }
    var seq=++_dxSeq; clearTimeout(_dxTmr);
    _dxTmr=setTimeout(function(){
      // price the classic Horizon path AND the Soroswap aggregator in parallel; route through whichever returns more
      Promise.all([
        j(H+"/paths/strict-send?"+apParam("source",pa)+"&source_amount="+net.toFixed(7)+"&"+destParam(ra)).then(function(pd){ var recs=(pd._embedded&&pd._embedded.records)||[]; return recs.length?parseFloat(recs[0].destination_amount):0; }).catch(function(){ return 0; }),
        soroQuote(pa,ra,Math.round(net*1e7)).catch(function(){ return null; })
      ]).then(function(qres){
        if(seq!==_dxSeq)return; var out=qres[0], soro=qres[1];
        // only prefer Soroswap when a Soroban AMM route beats the classic path by >0.5% and impact stays sane
        var useSoro=soro&&soro.usesSoroban&&soro.out>0&&soro.out>out*1.005&&(soro.impact||0)<10;
        window.__lxDXASoro=useSoro?{quote:soro.quote,out:soro.out,pa:pa,ra:ra}:null;
        var best=useSoro?soro.out:out;
        if(!(best>0)){ dxSmartBadge(null);
          dxErr("No route for "+pcode+" \u2192 "+rcode+" \u2014 this pair has no liquidity right now.");
          if(cta)cta.setAttribute("data-lxdis","1");
          return; }
        _dxQuoteOut=best; var minR=best*(1-SLIP/100); _dxMinRecv=minR; var effRate=best/net;
        _dxView={payUsd:amt*(pa.native?xlmUsd:priceUsd()), recv:xlmAmt(best), usd:best*(ra.native?xlmUsd:priceUsd()), rate:"1 "+pcode+" = "+(+effRate.toPrecision(6))+" "+rcode, impact:useSoro?dxImpTxt(dxImpMag(1-Math.min(Math.abs(soro.impact||0)/100,0.999999),ra),ra):"<0.01%", impUp:useSoro?dxImpUp(dxImpMag(1-Math.min(Math.abs(soro.impact||0)/100,0.999999),ra),ra):true, minR:xlmAmt(minR)+" "+rcode, soro:useSoro?soro:null};
        reAssertView();
        // classic route: size the impact against the honest top-of-book probe. That arithmetic only ever
        // measures execution against spot, so it is negative whichever way you trade -- the direction has
        // to come from dxImpTxt, not from its sign.
        if(!useSoro){ dxSpotRate(pa,ra,function(sr){ if(seq!==_dxSeq||!(sr>0)||!_dxView||_dxView.soro)return; dxSetImp(dxImpMag(effRate/sr,ra),ra,pa,net,best,seq); }); }
        else dxSetImp(dxImpMag(1-Math.min(Math.abs(soro.impact||0)/100,0.999999),ra),ra,pa,net,best,seq);
      }).catch(function(){});
    },260);
  }
  // real pathPaymentStrictSend (+0.2% fee op, auto trustline) signed by the connected wallet — mirrors _swapcalc.lxSwap
  // record each executed swap so the Wallet activity feed can label it "Swapped X -> Y" with amounts, even when
  // it routes through Soroswap (a Soroban invoke_host_function that otherwise shows only "Contract call").
  function dxRecordSwap(hash,pa,ra,fromAmt,toAmt){ if(!hash)return; try{ var a=JSON.parse(localStorage.getItem("lumos.swaps")||"[]"); a.unshift({hash:hash,from:(pa.native?"XLM":pa.code),fromIss:(pa.native?"":pa.iss||""),to:(ra.native?"XLM":ra.code),toIss:(ra.native?"":ra.iss||""),fromAmt:+fromAmt||0,toAmt:+toAmt||0,ts:Date.now()}); localStorage.setItem("lumos.swaps",JSON.stringify(a.slice(0,40))); }catch(_){} }
  function dxExecute(){
    if(NATIVE)return; var cta=q(".dxa-trade-cta"); if(!cta)return;
    var addr=lxAddr(); if(!addr){ dxToast("Connect a Stellar wallet first."); return; }
    if(cta.getAttribute("data-lxdis")==="1"){ dxToast("Enter an amount within your balance"); return; }
    var pin=payInput(); var amt=dxNum(pin&&pin.value); if(!(amt>0)){ dxToast("Enter an amount"); return; }
    var pa=payAsset(), ra=recvAsset(), fr=FEE_RATE(), fee=+(amt*fr).toFixed(7), net=+(amt-fee).toFixed(7);
    if(!(net>0)){ dxToast("Amount too small after fee"); return; }
    var lbl0=cta.textContent; cta.__lxbusy=1; cta.disabled=true; cta.classList.add("lx-btnload"); cta.textContent="Confirm in wallet\\u2026";
    var side=dxSide(), srcP=apParam("source",pa), S;
    // Smart Swap active -> route through Soroswap (best rate). Add the destination trustline first if missing
    // (Soroswap's XDR assumes it exists), then build -> sign -> submit via the aggregator. Single signature.
    var soro=window.__lxDXASoro;
    if(soro&&soro.quote){
      var needT=!ra.native&&!window.__lxDXAhasTrust;
      cta.textContent=needT?("Adding "+CODE+" trustline\\u2026"):"Confirm in wallet\\u2026";
      (needT?dxEnsureTrust(ra):Promise.resolve()).then(function(){ cta.textContent="Confirm in wallet\\u2026"; return soroExecute(soro); }).then(function(resp){
        cta.disabled=false; cta.__lxbusy=0; cta.classList.remove("lx-btnload");
        if(resp&&(resp.success||resp.txHash)){ cta.textContent=(side==="buy"?"Bought ":"Sold ")+CODE+" \\u2713";
          try{ dxRecordSwap(resp.txHash||resp.hash,pa,ra,amt,soro.out); }catch(_){} try{if(window.__lxFeeTierRefresh)window.__lxFeeTierRefresh();}catch(_){}
          dxToast((side==="buy"?"Bought ":"Sold ")+xlmAmt(soro.out)+" "+(side==="buy"?CODE:"XLM"));
          dxPostSwapReset();
          setTimeout(function(){ cta.textContent="Swap"; },1600);
        } else { throw new Error("Submit failed"); }
      }).catch(function(e){ cta.disabled=false; cta.__lxbusy=0; cta.classList.remove("lx-btnload"); cta.textContent="Swap"; dxToast("Swap failed \\u2014 "+((e&&e.message)||e),true); });
      return;
    }
    dxLoadSdk().then(function(sdk){ S=sdk;
      function A(a){ return a.native?S.Asset.native():new S.Asset(a.code,a.iss); }
      var send=A(pa), dest=A(ra);
      return j(H+"/paths/strict-send?"+srcP+"&source_amount="+net.toFixed(7)+"&"+destParam(ra)).then(function(pd){
        var recs=(pd._embedded&&pd._embedded.records)||[]; var freshOut=recs.length?parseFloat(recs[0].destination_amount):0;
        if(freshOut>0&&freshOut<1e-7){
          throw new Error("this would receive less than 0.0000001 "+(ra.native?"XLM":ra.code)
            +", the smallest amount Stellar can transfer \u2014 try a larger amount");
        }
        var path=recs.length?recs[0].path.map(function(a){return a.asset_type==="native"?S.Asset.native():new S.Asset(a.asset_code,a.asset_issuer);}):[];
        var feeXlmP=pa.native?Promise.resolve(null):j(H+"/paths/strict-send?"+srcP+"&source_amount="+fee.toFixed(7)+"&destination_assets=native").catch(function(){return null;});
        return Promise.all([j(H+"/accounts/"+addr), j(H+"/accounts/"+FEE_COLLECTOR).catch(function(){return null;}), feeXlmP]).then(function(res){
          var acc=res[0], collExists=!!res[1], feePd=res[2];
          var dm=(freshOut>0?Math.max(1e-7,freshOut*(1-fr-0.01)):Math.max(1e-7,_dxMinRecv||1e-7)).toFixed(7);
          var needTrust=!ra.native&&!window.__lxDXAhasTrust;
          var tb=new S.TransactionBuilder(new S.Account(addr,acc.sequence),{fee:"1000",networkPassphrase:WPASS_PUB});
          if(needTrust)tb.addOperation(S.Operation.changeTrust({asset:dest}));
          tb.addOperation(S.Operation.pathPaymentStrictSend({sendAsset:send,sendAmount:net.toFixed(7),destination:addr,destAsset:dest,destMin:dm,path:path}));
          if(fee>0&&collExists){ if(pa.native){ tb.addOperation(S.Operation.payment({destination:FEE_COLLECTOR,asset:send,amount:fee.toFixed(7)})); } else { var frr=(feePd&&feePd._embedded&&feePd._embedded.records)||[]; if(frr.length){ var fpath=(frr[0].path||[]).map(function(a){return a.asset_type==="native"?S.Asset.native():new S.Asset(a.asset_code,a.asset_issuer);}); tb.addOperation(S.Operation.pathPaymentStrictSend({sendAsset:send,sendAmount:fee.toFixed(7),destination:FEE_COLLECTOR,destAsset:S.Asset.native(),destMin:"0.0000001",path:fpath})); } } }
          return dxTimeout(dxSign(tb.setTimeout(180).build().toXDR(),addr),150000,"Signing timed out \\u2014 open your wallet and try again");
        });
      });
    }).then(function(signed){
      // #16: the signature is in. Everything from here is the NETWORK -- Horizon's submit endpoint
      // holds the request open until the transaction is in a closed ledger, roughly five seconds and
      // longer when it is busy. Keeping "Confirm in wallet…" up through that told the user their tap
      // in LOBSTR had not registered, when it was the only thing that had.
      try{ cta.textContent="Submitting\\u2026"; }catch(_){}
      return fetch(H+"/transactions",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"tx="+encodeURIComponent(signed)}).then(function(r){return r.json();});
    }).then(function(resp){
      cta.disabled=false; cta.__lxbusy=0; cta.classList.remove("lx-btnload");
      if(resp&&(resp.successful||resp.hash)){ cta.textContent=(side==="buy"?"Bought ":"Sold ")+CODE+" \\u2713";
        try{ dxRecordSwap(resp.hash,pa,ra,amt,_dxQuoteOut); }catch(_){} try{if(window.__lxFeeTierRefresh)window.__lxFeeTierRefresh();}catch(_){}
        dxToast((side==="buy"?"Bought ":"Sold ")+xlmAmt(_dxQuoteOut)+" "+(side==="buy"?CODE:"XLM"));
        dxPostSwapReset();
        setTimeout(function(){ cta.textContent="Swap"; },1600);
      } else { var x=resp&&resp.extras&&resp.extras.result_codes; throw new Error(x?JSON.stringify(x):"Submit failed"); }
    }).catch(function(e){ cta.disabled=false; cta.__lxbusy=0; cta.classList.remove("lx-btnload"); cta.textContent="Swap"; dxToast("Swap failed \\u2014 "+((e&&e.message)||e),true); });
  }
  function resetWidget(){ _dxQuick=null; window.__lxDXASoro=null; var pin=payInput(), rin=recvInput(); if(pin)pin.value=""; if(rin)rin.value=""; dxErr(""); setRecvUsd(0); dxSmartBadge(null); var cta=q(".dxa-trade-cta"); if(cta)cta.removeAttribute("data-lxdis"); }
  // AFTER A COMPLETED SWAP.
  //
  // Emptying the two inputs is not enough, and that is why the widget kept showing a spent balance and the
  // amounts of a trade that had already happened:
  //   - _dxView still held the finished quote, and reAssertView() paints it straight back into You receive;
  //   - _dxLastPay still held the old figure, so enforceWidget() saw a mismatch and re-quoted from it;
  //   - the %/MAX chip kept its lxq-active highlight, so MAX still looked selected;
  //   - and the balance was re-read ONCE, immediately, when Horizon can still be serving the pre-swap
  //     ledger — one stale answer and the number sat there until the page was reloaded.
  // Clear the state the guards read, then re-read the balance a few times over the next few seconds.
  function dxPostSwapReset(){
    try{ resetWidget(); }catch(_){}
    _dxView=null; _dxLastPay=""; _dxQuoteOut=0; _dxMinRecv=0; window.__lxDXASoro=null;
    try{ qa(".dxa-pane-swap .dxa-trade-quick button").forEach(function(b){ b.classList.remove("lxq-active"); }); }catch(_){}
    try{ setRecvUsd(0); }catch(_){}
    [0,1500,4000,9000].forEach(function(ms){ setTimeout(function(){
      window.__lxDXAwalletLoading=false; try{ loadWalletBalance(); }catch(_){}
    },ms); });
  }
  function applySwap(){
    var pane=q(".dxa-pane-swap"); if(!pane)return;
    // You receive ships readonly in the design markup, on BOTH layouts — it was a readout, so there was no
    // way to say "I want exactly N of this". Re-applied every pass because the design re-renders the field.
    var _ri=recvInput(); if(_ri){ if(_ri.hasAttribute("readonly"))_ri.removeAttribute("readonly"); if(_ri.hasAttribute("disabled"))_ri.removeAttribute("disabled"); }
    var pa=payAsset(), pf=payEl();
    // "You pay" balance label follows the pay asset (or "—" when no wallet connected)
    if(pf){ var balSpan=pf.querySelector(".dxa-trade-frow .mono"); if(balSpan){ var b=spendOf(pa); var t=(b==null)?"Balance: —":"Balance: "+xlmAmt(b)+" "+(pa.native?"XLM":pa.code); if(balSpan.textContent!==t)balSpan.textContent=t;
      // spell out WHY it is lower than the wallet total — "Balance: 0.04 XLM" on a 28 XLM account looks broken otherwise
      if(pa.native&&b!=null&&window.__lxDXAxlm!=null){ var _tt=xlmAmt(b)+" XLM spendable \u2014 "+xlmAmt(window.__lxDXAxlm)+" total, "+xlmAmt(Math.max(0,window.__lxDXAxlm-b))+" locked as the Stellar account reserve"; if(balSpan.title!==_tt)balSpan.title=_tt; }
      else if(balSpan.title)balSpan.removeAttribute("title"); } }   // show SPENDABLE (excludes locked reserves) so Balance matches what MAX fills
    if(NATIVE)return;                                          // XLM asset page: no counter asset -> display only
    if(pane.__lxdel)return; pane.__lxdel=1;
    // DELEGATED listeners on the pane (survive the design re-rendering/replacing the widget's child nodes,
    // which was orphaning direct listeners -> the CTA/% buttons did nothing). Capture phase so we run first.
    pane.addEventListener("click",function(e){
      var t=e.target; if(!t||!t.closest)return;
      var side=t.closest(".dxa-side-btn"); if(side&&pane.contains(side)){ window.__lxDXAside=side.classList.contains("sell")?"sell":"buy"; resetWidget(); guardApply(); return; }
      if(t.closest(".dxa-trade-flip")){ e.preventDefault(); window.__lxDXAside=dxSide()==="buy"?"sell":"buy"; resetWidget(); guardApply(); return; }
      var qb=t.closest(".dxa-trade-quick button"); if(qb){ _dxQuick=(qb.textContent||"").trim().toUpperCase(); qa(".dxa-pane-swap .dxa-trade-quick button").forEach(function(o){o.classList.toggle("lxq-active",(o.textContent||"").trim().toUpperCase()===_dxQuick);}); var base=spendOf(payAsset()), pin=payInput(); if(base!=null&&pin){ var pct=_dxQuick==="MAX"?1:((parseFloat(_dxQuick)||0)/100); var v=Math.floor(base*pct*1e7)/1e7; var _t=v.toFixed(7);while(_t.length>1&&_t.charAt(_t.length-1)==="0")_t=_t.slice(0,-1);if(_t.charAt(_t.length-1)===".")_t=_t.slice(0,-1);pin.value=v>0?_t:"0"; dxQuote(); } return; }   // 7-dp (Stellar precision), floored so MAX fills the WHOLE balance (toFixed(4) left dust like 0.0000059)
      // A button drawn as disabled must BEHAVE disabled. data-lxdis only dimmed it, so a "blocked" Swap still
      // opened the review — and with a bad amount behind it, the review read "You pay 0 STONER".
      var cta=t.closest(".dxa-trade-cta"); if(cta){ e.preventDefault(); e.stopPropagation();
        if(cta.getAttribute("data-lxdis")==="1")return;
        dxExecute(); return; }
    },true);
    pane.addEventListener("input",function(e){ var t=e.target; if(t&&t.tagName==="INPUT"){
      var capped=dxClamp(t);
      var pf=payEl(); if(pf&&pf.contains(t)){ _dxQuick=null; qa(".dxa-pane-swap .dxa-trade-quick button").forEach(function(o){o.classList.remove("lxq-active");}); dxQuote(); if(capped)dxErr(DX_MAXMSG); return; }
      var rf=recvEl(); if(rf&&rf.contains(t)){ dxQuoteReverse(); if(capped)dxErr(DX_MAXMSG); } } },true);
    // When You receive loses focus, settle it to the figure the forward quote actually returned, so the
    // number on screen is always the one the swap was priced at rather than what was typed.
    pane.addEventListener("blur",function(e){ var t=e.target;
      if(t&&t.tagName==="INPUT"){ var rf=recvEl(); if(rf&&rf.contains(t))setTimeout(reAssertView,0); } },true);
  }

  // ================= Limit orders (Phase 4): real manageSellOffer / manageBuyOffer =================
  // The Limit pane (.dxa-pane-limit) reuses the swap skeleton with 3 fields: [0] Limit price, [1] Amount,
  // [2] Total (readonly). Price is XLM per CODE. Buy CODE = manageBuyOffer{selling XLM, buying CODE,
  // buyAmount=Amount, price}; Sell CODE = manageSellOffer{selling CODE, buying XLM, amount=Amount, price}.
  // Routed through the same _feemodal review + our dxSign signer. No LumosCore fee op — a resting order may
  // never fill, so charging a fee upfront would be unfair; network fee only.
  function setLimIcon(field,a){ if(!field)return; var chip=field.querySelector(".dxa-trade-asset"); if(!chip)return;
    var lbl=a.native?"XLM":a.code, css=a.native?xlmLogoCss():logoBg(); if(!css)return;
    if(chip.getAttribute("data-lxic")!==lbl)chip.setAttribute("data-lxic",lbl);
    if(chip.style.getPropertyValue("--lxtic")!==css)chip.style.setProperty("--lxtic",css); }
  function limSide(){ return window.__lxDXLside==="sell"?"sell":"buy"; }
  function limPane(){ return q(".dxa-pane-limit"); }
  function limFields(){ return qa(".dxa-pane-limit .dxa-trade-field"); }
  function limPriceInput(){ var f=limFields()[0]; return f?f.querySelector(".dxa-trade-ir input"):null; }
  // A9: a price is a number. Digits and ONE separator; everything else is dropped as it arrives, so a
  // mis-aimed paste is cleaned instead of silently accepted. Delegated and gated on the input itself, so
  // it survives the pane being re-rendered.
  // Take the LEADING number and stop at the first character that is not part of one, rather than
  // deleting invalid characters wherever they appear. Deleting them salvaged digits out of the middle of
  // a pasted key: "0.001 GBNZILSTVQZ4R7IKQDGHY" became 0.00147, a wrong price that looks like a real
  // one. Stopping at the first stray character leaves 0.001 -- what was actually typed before the paste.
  function numOnly(v){
    v=String(v||"").split(",").join(".");
    var out="",dot=false;
    for(var i=0;i<v.length;i++){
      var c=v.charAt(i);
      if(c>="0"&&c<="9"){ out+=c; continue; }
      if(c==="."&&!dot){ dot=true; out+=c; continue; }
      if(out===""&&(c===" "||c==="\\t"))continue;   // leading blanks are not an error
      break;                                        // anything else ends the number
    }
    return out;
  }
  function wireNumericLimit(){
    if(window.__lxDXAnum)return; window.__lxDXAnum=1;
    document.addEventListener("input",function(e){
      var t=e.target; if(!t||t.tagName!=="INPUT")return;
      var f=t.closest?t.closest(".dxa-pane-limit .dxa-trade-field"):null; if(!f)return;
      var clean=numOnly(t.value);
      if(clean===t.value)return;
      // Keep the caret where the user is typing rather than throwing it to the end.
      var pos=(t.selectionStart||0)-(t.value.length-clean.length);
      t.value=clean;
      try{ t.setSelectionRange(Math.max(0,pos),Math.max(0,pos)); }catch(_){}
      try{ t.dispatchEvent(new Event("change",{bubbles:true})); }catch(_){}
    },true);
  }
  function limAmtInput(){ var f=limFields()[1]; return f?f.querySelector(".dxa-trade-ir input"):null; }
  function limTotInput(){ var f=limFields()[2]; return f?f.querySelector(".dxa-trade-ir input"):null; }
  function applyLimit(){
    var pane=limPane(); if(!pane||NATIVE)return; var side=limSide();
    qa(".dxa-pane-limit .dxa-side-btn.buy, .dxa-pane-limit .dxa-side-btn.sell").forEach(function(b){
      var isBuy=b.classList.contains("buy"); var on=(isBuy&&side==="buy")||(!isBuy&&side==="sell"); if(b.classList.contains("active")!==on)b.classList.toggle("active",on); });
    var fields=limFields(); if(fields.length<2)return;
    // field chips: price = XLM, amount = CODE, total = XLM. Limit chips are ICON-ONLY (the painter renders
    // .dxa-trade-asset itself as a mock icon), so paint the right logo painter-proof via ::before/--lxtic.
    setLimIcon(fields[0],assetXLM()); setLimIcon(fields[1],assetTok()); if(fields[2])setLimIcon(fields[2],assetXLM());
    // "Market:" (current price) on the price field; "Available:" on amount; "Balance:" + MAX on the total field
    var mkt=fields[0].querySelector(".dxa-trade-frow .mono"); if(mkt&&mkt.textContent!=="")mkt.textContent="";   // no "Market:" label (per design)
    // #13: the balance and MAX belong on the asset being SPENT, and which one that is depends on the side.
    //
    // They were pinned to the Total field, which is always XLM. That is right when BUYING -- XLM is what
    // leaves the account -- but on a SELL the asset leaving is the token, and the row for it carried
    // neither its balance nor a MAX. Selling 920 xLMNR, the only figure on screen was how much XLM was
    // available, which is not the constraint at all. limMax() already picked the correct side; only the
    // controls were in a fixed place.
    var _sell=(limSide()==="sell");
    var _spendF=_sell?fields[1]:fields[2];
    var _otherF=_sell?fields[2]:fields[1];
    if(_spendF){ var frow2=_spendF.querySelector(".dxa-trade-frow"); if(frow2){ var bm=frow2.querySelector(".mono");
      if(bm){
        var bt;
        if(_sell){ var _tb=window.__lxDXAassetBal; bt=(_tb==null)?"Avail: \\u2014":("Avail: "+xlmAmt(_tb)+" "+CODE); }
        else { var _xb=(window.__lxDXAxlmSpend!=null?window.__lxDXAxlmSpend:window.__lxDXAxlm); bt=(_xb==null)?"Avail: \\u2014":("Avail: "+(Math.floor(_xb*100)/100).toFixed(2)+" XLM"); }
        if(bm.textContent!==bt){bm.textContent=bt; bm.setAttribute("data-lxbal","1");}
      }
      if(!frow2.querySelector(".lxlim-max")){ var mxb=document.createElement("button"); mxb.type="button"; mxb.className="lxlim-max"; mxb.textContent="MAX"; frow2.appendChild(mxb); mxb.addEventListener("click",function(e){ e.preventDefault(); e.stopPropagation(); limMax(); }); } } }
    // and strip both from the row that is now the RECEIVING side, so only one row claims to be the limit.
    if(_otherF){ var frowO=_otherF.querySelector(".dxa-trade-frow");
      if(frowO){ var bmo=frowO.querySelector(".mono"); if(bmo&&bmo.textContent!==""){bmo.textContent=""; bmo.removeAttribute("data-lxbal");}
        var mxo=frowO.querySelector(".lxlim-max"); if(mxo&&mxo.parentNode)mxo.parentNode.removeChild(mxo); } }
    // prefill the price with the current market once per side (design ships a mock value)
    var pin=limPriceInput(); if(pin&&assetXlm>0&&pane.__lxlprefill!==side){ pin.value=(+assetXlm.toPrecision(6)).toString(); pane.__lxlprefill=side; }
    var _tie=limTotInput(); if(_tie){ _tie.removeAttribute("readonly"); _tie.removeAttribute("disabled"); }   // Total is editable -> back-computes Amount
    limRecalc();
    if(pane.__lxldel)return; pane.__lxldel=1;
    pane.addEventListener("click",function(e){ var t=e.target; if(!t||!t.closest)return;
      var sb=t.closest(".dxa-side-btn"); if(sb&&pane.contains(sb)){ window.__lxDXLside=sb.classList.contains("sell")?"sell":"buy"; var a=limAmtInput(); if(a)a.value=""; pane.__lxlprefill=null; guardApply(); return; }
      var cta=t.closest(".dxa-trade-cta"); if(cta){ e.preventDefault(); e.stopPropagation(); dxExecuteLimit(); return; }
    },true);
    pane.addEventListener("input",function(e){ var t=e.target; if(t&&t.tagName==="INPUT"){ if(t===limTotInput())limFromTotal(); else if(t===limPriceInput()||t===limAmtInput())limRecalc(); } },true);
  }
  // user typed in Total (XLM) -> back-compute Amount (= total / price)
  function limFromTotal(){ var pin=limPriceInput(), ain=limAmtInput(), tin=limTotInput(); if(!pin||!ain||!tin)return;
    var price=dxNum(pin.value), total=dxNum(tin.value);
    var amt=price>0?(total/price):0; ain.value=amt>0?xlmAmt(amt):"";
  }
  // MAX button on the Total row: fills the order to use your whole balance. Sell -> all CODE; Buy -> spend all
  // spendable XLM at the current (or market) limit price. Sets the Amount field, then recomputes the total.
  function limMax(){ var side=limSide(); var ain=limAmtInput(); if(!ain)return;
    var price=dxNum(limPriceInput()&&limPriceInput().value)||assetXlm||0;
    var maxAmt=0;
    if(side==="sell"){ maxAmt=window.__lxDXAassetBal||0; }
    else { var xb=(window.__lxDXAxlmSpend!=null?window.__lxDXAxlmSpend:window.__lxDXAxlm)||0; maxAmt=price>0?(xb/price):0; }
    ain.value=maxAmt>0?xlmAmt(maxAmt):""; limRecalc();
  }
  function limRecalc(){
    var pin=limPriceInput(), ain=limAmtInput(), tin=limTotInput(); if(!pin||!ain)return;
    var price=dxNum(pin.value), amt=dxNum(ain.value), total=price*amt;
    if(tin&&document.activeElement!==tin)tin.value=total>0?xlmAmt(total):"";   // don't clobber the Total field while the user is typing in it
    // (the total field's .mono now shows the asset Balance + MAX, set in applyLimit — no longer the USD estimate)
    // "Filled when" summary row
    qa(".dxa-pane-limit .dxa-tsum-row").forEach(function(r){ var lab=(r.querySelector("span")||{}).textContent||""; if(/filled when/i.test(lab)){ var m=r.querySelector(".mono"); if(m){ var op=limSide()==="buy"?"\\u2264":"\\u2265"; var v=CODE+"/XLM "+op+" "+(price>0?(+price.toPrecision(6)):"\\u2014"); if(m.textContent!==v)m.textContent=v; } } });
  }
  function dxExecuteLimit(){
    if(NATIVE)return; var cta=q(".dxa-pane-limit .dxa-trade-cta"); if(!cta)return;
    var addr=lxAddr(); if(!addr){ dxToast("Connect a Stellar wallet first."); return; }
    var side=limSide();
    var price=dxNum(limPriceInput()&&limPriceInput().value);
    var amt=dxNum(limAmtInput()&&limAmtInput().value);
    if(!(price>0)){ dxToast("Enter a limit price"); return; }
    if(!(amt>0)){ dxToast("Enter an amount"); return; }
    if(side==="sell"){ var cb=window.__lxDXAassetBal; if(cb!=null&&amt>cb+1e-9){ dxToast("Insufficient "+CODE+" balance"); return; } }
    else { var need=price*amt; if(window.__lxDXAxlm!=null&&need>window.__lxDXAxlm+1e-9){ dxToast("Not enough XLM for this order.",true); return; } }
    var lbl0=cta.textContent; cta.__lxbusy=1; cta.disabled=true; cta.classList.add("lx-btnload"); cta.textContent="Confirm in wallet\\u2026";
    var S;
    dxLoadSdk().then(function(sdk){ S=sdk; var tok=new S.Asset(CODE,ISSUER), xlm=S.Asset.native();
      return j(H+"/accounts/"+addr).then(function(acc){
        var needTrust=side==="buy"&&!window.__lxDXAhasTrust;
        var tb=new S.TransactionBuilder(new S.Account(addr,acc.sequence),{fee:"1000",networkPassphrase:WPASS_PUB});
        if(needTrust)tb.addOperation(S.Operation.changeTrust({asset:tok}));
        if(side==="sell")tb.addOperation(S.Operation.manageSellOffer({selling:tok,buying:xlm,amount:amt.toFixed(7),price:(+price.toFixed(7)).toString()}));
        else tb.addOperation(S.Operation.manageBuyOffer({selling:xlm,buying:tok,buyAmount:amt.toFixed(7),price:(+price.toFixed(7)).toString()}));
        return dxTimeout(dxSign(tb.setTimeout(180).build().toXDR(),addr),150000,"Signing timed out \\u2014 open your wallet and try again");
      });
    }).then(function(signed){
      // #16: the signature is in. Everything from here is the NETWORK -- Horizon's submit endpoint
      // holds the request open until the transaction is in a closed ledger, roughly five seconds and
      // longer when it is busy. Keeping "Confirm in wallet…" up through that told the user their tap
      // in LOBSTR had not registered, when it was the only thing that had.
      try{ cta.textContent="Submitting\\u2026"; }catch(_){}
      return fetch(H+"/transactions",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"tx="+encodeURIComponent(signed)}).then(function(r){return r.json();});
    }).then(function(resp){
      cta.disabled=false; cta.__lxbusy=0; cta.classList.remove("lx-btnload");
      if(resp&&(resp.successful||resp.hash)){ cta.textContent="Order placed \\u2713";
        dxToast((side==="buy"?"Buy":"Sell")+" limit order placed \\u2014 "+xlmAmt(amt)+" "+CODE+" @ "+(+price.toPrecision(6))+" XLM");
        window.__lxDXAwalletLoading=false; try{ loadWalletBalance(); }catch(_){} try{ loadOpenOffers(); }catch(_){}
        var ai=limAmtInput(); if(ai)ai.value=""; limRecalc();
        setTimeout(function(){ cta.textContent="Place Limit Order"; },1600);
      } else { var x=resp&&resp.extras&&resp.extras.result_codes; var xs=x?JSON.stringify(x):""; throw new Error(/low_reserve/i.test(xs)?"not enough XLM reserve \\u2014 add a little XLM":/underfunded|insufficient/i.test(xs)?"insufficient balance":(xs||"submit failed")); }
    }).catch(function(e){ cta.disabled=false; cta.__lxbusy=0; cta.classList.remove("lx-btnload"); cta.textContent="Place Limit Order"; dxToast("Order failed \\u2014 "+((e&&e.message)||e)); });
  }
  // fetch the connected wallet's resting offers (rendered into an open-orders list if the page has one)
  function loadOpenOffers(){ var addr=lxAddr(); if(!addr)return; j(H+"/accounts/"+addr+"/offers?limit=25&order=desc").then(function(d){ window.__lxDXLoffers=(d&&d._embedded&&d._embedded.records)||[]; try{ renderOpenOffers(); }catch(_){} }).catch(function(){}); }
  function renderOpenOffers(){
    var offers=window.__lxDXLoffers; if(!offers)return;
    // only this asset's offers (base or counter = CODE:ISSUER)
    var mine=offers.filter(function(o){ function m(a){return a&&a.asset_code===CODE&&a.asset_issuer===ISSUER;} return m(o.selling)||m(o.buying); });
    var box=q("#dxaOpenOrders,.dxa-open-orders,.dxa-orders-list"); if(!box)return;   // best-effort: only if the design exposes one
    if(!mine.length){ return; }
    box.innerHTML=mine.map(function(o){ var sell=o.selling&&o.selling.asset_code===CODE; var pr=o.price?(+o.price):(o.price_r?(+o.price_r.n/+o.price_r.d):0);
      return '<div class="dxa-oo-row"><span class="type-badge '+(sell?"sell":"buy")+'">'+(sell?"Sell":"Buy")+'</span><span class="mono">'+xlmAmt(+o.amount)+' '+CODE+'</span><span class="mono">@ '+(+pr.toPrecision(6))+' XLM</span></div>'; }).join("");
    box.classList.add("lxda");
  }

  // The shared _feemodal review reads field[0] (limit PRICE) as "You pay" and derives receive from a "Rate"
  // row limit orders don't have -> shows "You pay 0.0003 / You receive 0". Patch the modal from our side:
  // Buy = pay Total XLM -> receive Amount CODE; Sell = pay Amount CODE -> receive Total XLM.
  function patchLimitModal(){
    var modal=q(".lx-feemodal"); if(!modal||getComputedStyle(modal).display==="none")return;
    var lim=q(".dxa-pane-limit"); if(!lim||!lim.classList.contains("active"))return;
    var side=limSide();
    var price=dxNum(limPriceInput()&&limPriceInput().value);
    var amt=dxNum(limAmtInput()&&limAmtInput().value);
    var total=price*amt, payEl=modal.querySelector("[data-pay]"), recEl=modal.querySelector("[data-receive]");
    if(side==="buy"){ if(payEl)payEl.textContent=xlmAmt(total)+" XLM"; if(recEl)recEl.textContent=xlmAmt(amt)+" "+CODE; }
    else { if(payEl)payEl.textContent=xlmAmt(amt)+" "+CODE; if(recEl)recEl.textContent=xlmAmt(total)+" XLM"; }
  }
  // Watch for the feemodal appearing (it is appended directly to <body>) and drive patchLimitModal off a
  // style/class observer only. NOT subtree childList + NOT reacting to content -> patchLimitModal's own
  // textContent edits never re-trigger the observer (that infinite loop froze the renderer).
  function watchLimitModal(){ if(window.__lxLimModalWatch)return; window.__lxLimModalWatch=1;
    function hook(m){ if(!m||m.__lxsw)return; m.__lxsw=1;
      try{ var so=new MutationObserver(function(){ if(m.__lxpatching)return; m.__lxpatching=1; try{ patchLimitModal(); }catch(_){} m.__lxpatching=0; });
        so.observe(m,{attributes:true,attributeFilter:["style","class"]}); }catch(_){}
      setTimeout(function(){ if(m.__lxpatching)return; m.__lxpatching=1; try{ patchLimitModal(); }catch(_){} m.__lxpatching=0; },0);
    }
    try{ var mo=new MutationObserver(function(){ hook(q(".lx-feemodal")); }); mo.observe(document.body,{childList:true}); }catch(_){}
    hook(q(".lx-feemodal"));
  }
  function escapeHtml(s){ return String(s||"").replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }

  // ================= apply / observe / boot =================
  function applyAll(){
    // The MCap tab is gated on a supply figure that arrives from a separate fetch, so a single sync at
    // boot left it permanently disabled on an asset whose supply landed a second later. chartUi() is
    // idempotent -- it only builds what is missing -- so re-running it here also restores the controls
    // if the design re-renders the row out from under them.
    try{ chartUi(); }catch(_){}
    try{ moreInfoUi(); }catch(_){}
    try{ computeLiquidity(); }catch(_){}
    try{ applyHeader(); }catch(_){}
    try{ applyStats(); }catch(_){}
    try{ applyPerf(); }catch(_){}
    try{ applyTradeWidget(); }catch(_){}
    try{ applySwap(); }catch(_){}
    try{ reAssertView(); }catch(_){}
    try{ applyLimit(); }catch(_){}
    try{ applyOhlc(); }catch(_){}
    try{ renderOrderbook(); }catch(_){}
    try{ renderExchanges(); }catch(_){}
    try{ wireExchangeFilters(); }catch(_){}
    try{ wireChartTabs(); }catch(_){}
    try{ wireNumericLimit(); }catch(_){}   // A9: keep non-numeric text out of the limit price
    try{ wireChartType(); }catch(_){}
    try{ var pc=q("#dxaChart,#mdxaChart"); if(pc&&chartPts&&!pc.querySelector(".lxda-line,.lxda-candle"))drawChart(chartPts); }catch(_){}
    try{ applyHolders(); }catch(_){}
    // update the bottom Pools tab count (best-effort; the design's Pools panel itself is left as-is)
    try{ if(poolCount!=null){ var pt=qa(".tabs-bar .tab").filter(function(t){return /pools/i.test(t.getAttribute("data-tab")||"");})[0]; if(pt){ var c=pt.querySelector(".count"); if(c){ c.textContent=q("#mdxaPanel")?abbrNum(poolCount):String(poolCount); lxMark(c);} } } }catch(_){}
    // Holders bottom-tab count — written HERE (eagerly, from the /assets fetch) rather than at the end
    // of applyHolders(), which returns early unless the Holders panel is already in the DOM. That made the
    // badge sit on "—" until the user opened the tab, while Pools (written eagerly) showed its count.
    try{ var _tabN=(holdersFunded!=null?holdersFunded:holders); if(_tabN!=null){ var ht=qa(".tabs-bar .tab").filter(function(t){return /holders/i.test(t.getAttribute("data-tab")||"");})[0]; if(ht){ var hc=ht.querySelector(".count"); if(hc){ hc.textContent=q("#mdxaPanel")?abbrNum(_tabN):num(_tabN); lxMark(hc);} } } }catch(_){}
    try{ applyPools(); }catch(_){}
  }

  function loadData(){
    // XLM/USD
    j(CG).then(function(d){ var u=(d&&d.stellar&&+d.stellar.usd)||0; var uc=(d&&d.stellar&&d.stellar.usd_24h_change);
      if(uc!=null&&isFinite(+uc)){ xlmChg24=+uc; recomputeChg(); }
      if(u>0){ xlmUsd=u; try{ localStorage.setItem("lumos.xlmUsd",JSON.stringify({v:xlmUsd,chg:xlmChg24,ts:Date.now()})); }catch(_e){} } if(xlmUsd>0){ applyAll(); try{ loadChart(chartTF); }catch(_){} } }).catch(function(){});
    // XLM returns here, before the issuer block below, so none of the settle paths there can ever run for
    // it. Without this the native page would hold the neutral tile for ever and never draw its mark.
    if(NATIVE){ assetXlm=1; logoDone(); loadNativeStats(); return; }
    // price + 24h change + 24h volume via daily trade aggregations
    jAgg({res:86400000,order:"desc",limit:2}).then(function(d){ var r=(d&&d._embedded&&d._embedded.records)||[];
      if(r[0]){ assetXlm=+r[0].close||+r[0].avg||assetXlm; vol24Xlm=+r[0].counter_volume||0;
        dayOHLC={o:+r[0].open||0,h:+r[0].high||0,l:+r[0].low||0,c:+r[0].close||0,v:+r[0].counter_volume||0}; }
      // A daily bucket is stamped with the start of its UTC day, so the newest one is "today" or, just
      // after midnight with no trades yet, "yesterday". Anything older means the asset did not trade in
      // the last 24 hours and there is no 24h move to report. Two days of slack covers the midnight
      // case without letting a months-old bucket through.
      if(r[0]&&r[0].timestamp){ chg24Fresh=((Date.now()-(+r[0].timestamp))<=2*864e5); }
      if(r[0]&&r[1]&&+r[1].close>0){ chgXlm24=((+r[0].close-+r[1].close)/+r[1].close)*100; }
      recomputeChg();
      if(r[0]&&r[1]&&+r[1].counter_volume>0)volChg=((+r[0].counter_volume-+r[1].counter_volume)/+r[1].counter_volume)*100;
      applyAll(); try{ loadChart(chartTF); }catch(_){}
    }).catch(function(){});
    // AUDIT (user-reported: "just show 0.00% instead of -"): 1h/1m/3m/6m were dashed because we simply
    // never fetched them — the dash was honest but useless. Compute them from real candles instead of
    // inventing a flat 0.00%: an hourly pair for 1h, and ~200 daily candles for 1m/3m/6m. A dash now means
    // the asset genuinely had no trade in that window, and 0.00% means it genuinely did not move.
    jAgg({res:3600000,order:"desc",limit:2}).then(function(d){ var r=(d&&d._embedded&&d._embedded.records)||[];
      // trade_aggregations omits hours in which nothing traded, so the two newest records are not
      // necessarily an hour apart -- FRED ran 06:00, 05:00, 03:00, where the newest pair spans three
      // hours and still gets labelled "1h". A cell that quietly measures the wrong window is worse
      // than one that admits it cannot say, so a non-adjacent pair leaves chg1h null and the cell
      // dashes, which applyPerf already renders. 1.5h of slack absorbs bucket-boundary jitter.
      var gap1h=(r[0]&&r[1])?(+r[0].timestamp-+r[1].timestamp):0;
      if(r[0]&&r[1]&&+r[1].close>0&&gap1h<=5400000)chg1h=((+r[0].close-+r[1].close)/+r[1].close)*100; applyAll(); }).catch(function(){});
    jAgg({res:86400000,order:"desc",limit:200}).then(function(d){ var r=(d&&d._embedded&&d._embedded.records)||[];
      if(!r.length)return; var latest=+r[0].close; if(!(latest>0))return;
      var now=Date.now();
      function back(days){ var target=now-days*86400000, best=null, bestDt=Infinity;
        for(var i=0;i<r.length;i++){ var ts=+r[i].timestamp, dt=Math.abs(ts-target);
          // only trust a candle reasonably near the horizon — otherwise we would be comparing to whenever
          // the asset last happened to trade and calling it a "3 month" change
          if(dt<bestDt&&dt<=days*86400000*0.25){ bestDt=dt; best=+r[i].close; } }
        return (best>0)?((latest-best)/best)*100:null; }
      chg1m=back(30); chg3m=back(90); chg6m=back(180);
      // 7d came only from stellar.expert's price7d; when that lookup misses, the cell dashed even though
      // Horizon had the candles all along. Same source as the others as a fallback.
      chg7dX=back(7);
      applyAll(); }).catch(function(){});
    // The perf grid is denominated by the same toggle as the chart, but 1h/7d/1m/3m/6m are measured
    // against XLM, so a dollar reading needs XLM's own move over each of those windows. XLM/USD is
    // not a Stellar pair, but USDC/XLM is: Circle's USDC priced in XLM, whose close is XLM-per-USDC,
    // so a dollar per XLM is 1/close and a window's move inverts to best/latest-1. Same cached
    // /lxapi/candles endpoint as everything else here, and the URL is identical on every asset page,
    // so it is one of the warmest objects at the edge rather than per-asset traffic.
    var XREF="USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
    function jRef(res,limit){
      var direct=H+"/trade_aggregations?base_asset_type=credit_alphanum4&base_asset_code=USDC"
        +"&base_asset_issuer="+XREF.slice(5)+"&counter_asset_type=native&resolution="+res
        +"&order=desc&limit="+limit;
      return fetch("/lxapi/candles?a="+encodeURIComponent(XREF)+"&res="+res+"&order=desc&limit="+limit)
        .then(function(r){ if(!r.ok)throw new Error("HTTP"+r.status); return r.json(); })
        .then(function(d){ if(d&&d.error)throw new Error(String(d.error)); return d; })
        .catch(function(){ return j(direct); });
    }
    // 1h, with the same adjacency rule the asset's own hourly pair uses -- an XLM move measured over
    // three hours would corrupt the conversion exactly the way it corrupted the raw figure.
    jRef(3600000,2).then(function(d){ var r=(d&&d._embedded&&d._embedded.records)||[];
      var g=(r[0]&&r[1])?(+r[0].timestamp-+r[1].timestamp):0;
      if(r[0]&&r[1]&&+r[0].close>0&&+r[1].close>0&&g<=5400000)xu1h=((+r[1].close/+r[0].close)-1)*100;
      applyAll(); }).catch(function(){});
    jRef(86400000,200).then(function(d){ var r=(d&&d._embedded&&d._embedded.records)||[];
      if(!r.length)return; var latest=+r[0].close; if(!(latest>0))return; var now=Date.now();
      function xback(days){ var target=now-days*86400000, best=null, bestDt=Infinity;
        for(var i=0;i<r.length;i++){ var ts=+r[i].timestamp, dt=Math.abs(ts-target);
          if(dt<bestDt&&dt<=days*86400000*0.25&&+r[i].close>0){ bestDt=dt; best=+r[i].close; } }
        return (best>0)?((best/latest)-1)*100:null; }
      xu7d=xback(7); xu1m=xback(30); xu3m=xback(90); xu6m=xback(180);
      applyAll(); }).catch(function(){});
    // supply + holder (trustline) count
    j(H+"/assets?asset_code="+CODE+"&asset_issuer="+ISSUER).then(function(d){ var rec=(d&&d._embedded&&d._embedded.records&&d._embedded.records[0])||null; if(!rec)return;
      if(rec.balances)supply=+rec.balances.authorized||+rec.balances.authorized_to_maintain_liabilities||supply; else if(rec.amount!=null)supply=+rec.amount;
      if(rec.accounts)holders=(+rec.accounts.authorized||0)+(+rec.accounts.authorized_to_maintain_liabilities||0); else if(rec.num_accounts!=null)holders=+rec.num_accounts;
      applyAll();
    }).catch(function(){});
    // liquidity (pool TVL) + pool count. Store the raw reserves; TVL is (re)computed in computeLiquidity()
    // once assetXlm is known (the pools fetch can resolve before the price does).
    (function(){
      var ALLP=[], PMAX=12;                      // 12 x 200 = 2,400 pools; AQUA, the worst case seen, holds 1,301
      function absorb(r){
        ALLP=ALLP.concat(r);
        poolCount=ALLP.length;
        activePools=ALLP.filter(function(p){ return (p.reserves||[]).some(function(rv){ return rv.asset.indexOf(CODE+":"+ISSUER)===0 && +rv.amount>0; }); }).length;
        window.__lxDXApoolsRaw=ALLP.map(function(p){ var nat=0, ass=0; (p.reserves||[]).forEach(function(rv){ if(rv.asset==="native")nat=+rv.amount; else if(rv.asset.indexOf(CODE+":"+ISSUER)===0)ass=+rv.amount; });
          return {id:p.id, feeBp:(p.fee_bp!=null?+p.fee_bp:30), tl:+p.total_trustlines||0, nat:nat, ass:ass, res:(p.reserves||[]).map(function(rv){ var pt=rv.asset==="native"?["XLM",""]:rv.asset.split(":"); return {code:pt[0], iss:pt[1]||"", amt:+rv.amount}; })}; });
        try{ computeLiquidity(); }catch(_){}
        try{ applyAll(); }catch(_){}
      }
      function pg(url,n){
        return j(url).then(function(d){
          var r=(d&&d._embedded&&d._embedded.records)||[];
          if(r.length)absorb(r);
          var nx=d&&d._links&&d._links.next&&d._links.next.href;
          if(r.length===200 && nx && n<PMAX) return pg(nx,n+1);
        });
      }
      // Mark the fetch finished either way. Without this, "no pools" and "not arrived yet" are the same
      // state (raw === undefined), so the panel could only keep waiting -- which is how the comp rows
      // stayed on screen.
      function poolsDone(err){ if(!window.__lxDXApoolsRaw)window.__lxDXApoolsRaw=[];
        if(err)window.__lxDXApoolsErr=1;
        window.__lxDXApoolsDone=1; try{ applyAll(); }catch(_){} }
      pg(H+"/liquidity_pools?reserves="+CODE+":"+ISSUER+"&limit=200",1)
        .then(function(){ poolsDone(0); },function(){ poolsDone(1); });
    })();
    // issuer home_domain (-> website + stellar.toml for logo/description)
    if(ISSUER){ loadOwnDesc(); loadTomlEdge(); loadSeLogo(); loadSeChange(); j(H+"/accounts/"+ISSUER).then(function(a){ homeDomain=a.home_domain||(homeDomain||false);
      try{ var _mw=0; (a.signers||[]).forEach(function(sg){ var w=+sg.weight||0; if(w>_mw)_mw=w; }); issLocked=(_mw===0); }catch(_){ issLocked=false; } guardApply(); if(a.home_domain)loadToml(a.home_domain); else { tomlDone(); logoDone(); } }).catch(function(){ if(homeDomain==null)homeDomain=false; tomlDone(); logoDone(); guardApply(); });
      // Safety net: an unresponsive host must never hold the description back for good.
      setTimeout(tomlDone, 3000);
      // The logo waits longer than the text on purpose. Its fallback is a quiet neutral tile, which costs
      // the reader nothing, whereas settling early means keeping stellar.expert's icon when the issuer's
      // own toml was merely slow -- and since nothing repaints after a settle, that choice is permanent.
      // Measured at ~1.5s for a cross-origin toml on a warm connection, so this only binds on a bad one.
      setTimeout(logoDone, 5000); }
    if(!ISSUER)logoDone();
    // if NO data ever lands (dead/unknown asset), reveal the stat row anyway after 2.5s — the cells hold
    // honest "—" placeholders now, which beats an eternal hidden-skeleton (and never exposes the mock).
    setTimeout(function(){ var sr=q(".stat-row"); if(sr&&!sr.classList.contains("lxda")){ try{ applyStats(); }catch(_){} sr.classList.add("lxda"); } },2500);
    loadOrderbook();
    loadTrades();
    // loadHolders() is LAZY now (triggered by applyHolders when the Holders tab opens) — it was paging 12 Horizon
    // calls on every page load even with the tab closed, which was the main load-time lag.
    loadWalletBalance();                                       // connected wallet XLM balance -> swap "You pay" + % buttons
    loadOpenOffers();                                          // connected wallet resting limit orders (Phase 4)
  }
  // TVL across LUMOS/asset pools, valued in XLM. Native-paired pools use nat*2; asset-paired pools use
  // ass*assetXlm*2 (needs assetXlm). Recomputed each time so a late price still lands the number.
  function computeLiquidity(){
    var raw=window.__lxDXApoolsRaw; if(!raw)return; var txlm=0, ain=0, tnat=0, best=null, bestAss=-1;
    raw.forEach(function(p){ ain+=p.ass; tnat+=p.nat; if(p.nat>0)txlm+=p.nat*2; else if(p.ass>0&&assetXlm>0)txlm+=p.ass*assetXlm*2; if(p.ass>bestAss){ bestAss=p.ass; best=p; } });
    liqXlm=txlm; assetInPools=ain; liqNat=tnat;
    // AUDIT (user-reported: PEACE and "many others" show no price/change/volume/market cap). Price came only
    // from trade_aggregations or the order book, so an asset that trades ONLY through an AMM pool had none —
    // even though its pool reserves state the price exactly. Use the deepest XLM-paired pool's spot ratio.
    // Only as a fallback: a real DEX price, when one exists, stays authoritative.
    if(!(assetXlm>0)&&best&&best.nat>0&&best.ass>0){ assetXlm=best.nat/best.ass; window.__lxDXAammPrice=1; }
    // the largest pool's two real reserves (CODE first), for the "both counts" liquidity sub
    liqPoolPair=(best&&best.res&&best.res.length>=2)?best.res.slice().sort(function(a,b){ return (b.code===CODE?1:0)-(a.code===CODE?1:0); }):null;
  }
  function loadNativeStats(){
    // XLM native: REAL market data from CoinGecko (price + 24h change + 24h volume + market cap; circulating
    // supply derived as mcap/price). The old minimal path left the baked USDC mock in change/volume/cap/supply.
    assetXlm=1; homeDomain="stellar.org"; applyAll();
    j("https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true").then(function(d){
      var s=d&&d.stellar; if(!s)return;
      if(+s.usd>0){ xlmUsd=+s.usd; try{ localStorage.setItem("lumos.xlmUsd",JSON.stringify({v:xlmUsd,chg:xlmChg24,ts:Date.now()})); }catch(_e){} }
      if(s.usd_24h_change!=null&&isFinite(+s.usd_24h_change)){ chgCg=+s.usd_24h_change; xlmChg24=+s.usd_24h_change; recomputeChg(); }
      if(+s.usd_market_cap>0){ natMcap=+s.usd_market_cap; if(xlmUsd>0)supply=natMcap/xlmUsd; }
      if(+s.usd_24h_vol>0)natVol=+s.usd_24h_vol;
      guardApply();
    }).catch(function(){});
  }
  // reliable logo source for ANY asset (new trending tokens like PYUSD had only a letter avatar): stellar.expert
  // returns the toml-parsed image, CORS-open, no dependency on the issuer's own domain being reachable.
  // #19: the assets loadSeLogo SKIPS (it skips anything whose logo we already ship) are exactly the
  // ones that were left with the converted figure -- and that conversion multiplies two different
  // windows, Horizon's UTC-day bucket against CoinGecko's rolling 24h. On USDC that error is the
  // whole reading: a dollar stablecoin showed +0.59%. This fetches the SAME field the dashboard uses,
  // for those assets only, so both screens quote one number. Harvests the change and nothing else --
  // the logo precedence in loadSeLogo is delicate and is deliberately not touched.
  function loadSeChange(){
    if(NATIVE||!LOGOS[CODE]||!ISSUER)return;
    j("https://api.stellar.expert/explorer/public/asset?search="+encodeURIComponent(CODE)+"&limit=20").then(function(d){
      var recs=(d&&d._embedded&&d._embedded.records)||[];
      var mx=recs.filter(function(r){return (r.asset||"").indexOf(CODE+"-"+ISSUER)===0;})[0];
      if(!mx)return;
      // N3: the funded count -- accounts actually holding a balance, as opposed to those merely
      // permitted to. Same record, no extra request.
      dxaSetFunded(mx);
      var p7=mx.price7d;
      if(p7&&p7.length>=2){ var a=+p7[p7.length-2][1], b=+p7[p7.length-1][1];
        if(a>0&&b>0){ chgSe=(b/a-1)*100; recomputeChg(); }
        var f=+p7[0][1]; if(f>0&&b>0)chg7dU=(b/f-1)*100; }
      guardApply();
    }).catch(function(){});
  }
  function loadSeLogo(){ if(NATIVE||CODE==="LUMOS"||LOGOS[CODE])return;
    j("https://api.stellar.expert/explorer/public/asset?search="+encodeURIComponent(CODE)+"&limit=20").then(function(d){
      var recs=(d&&d._embedded&&d._embedded.records)||[]; var mx=recs.filter(function(r){return (r.asset||"").indexOf(CODE+"-"+ISSUER)===0;})[0]; var m=mx||recs[0];
      // harvest REAL fallbacks from the EXACT-issuer record only (recs[0] may be a different issuer's asset):
      // USD price (-> price/market-cap cells for assets with no XLM orderbook), 24h change from price7d, and
      // the toml home domain (-> website link when the Horizon issuer fetch fails or has no home_domain).
      if(mx){ if(+mx.price>0)seUsd=+mx.price;
        var p7=mx.price7d; if(p7&&p7.length>=2){ var _a=+p7[p7.length-2][1],_b=+p7[p7.length-1][1]; if(_a>0&&_b>0){ chgSe=(_b/_a-1)*100; recomputeChg(); }
          var _f=+p7[0][1]; if(_f>0&&_b>0)chg7dU=(_b/_f-1)*100; }
        var dm=(mx.domain||"").trim(); if(dm&&homeDomain==null)homeDomain=dm; }
      // Harvest only. This used to paint the header directly, which is what put stellar.expert's icon on
      // screen a beat before the issuer's own toml image replaced it. applyHeader owns the paint now and
      // does it once, at logoDone; and it does NOT settle here, because the issuer's own toml outranks
      // this and may still be in flight. If no toml is coming, the caller settles instead.
      var ti=(m&&(m.tomlInfo||m.toml_info))||{}; var img=ti.image||ti.orgLogo||"";
      if(img&&!ownLogo&&!tomlImg)tomlImg=img;
      guardApply();
    }).catch(function(){}); }
  // OUR OWN mints: take the description from the icon manifest rather than waiting on the toml.
  //
  // Both carry the same sentence -- the toml is BUILT from this manifest -- but they age very differently.
  // The toml is served max-age=21600 AND browsers partition the HTTP cache per site, so a page that read it
  // once keeps its own private stale copy for six hours: a description published today can stay invisible
  // here until tomorrow while the document itself is plainly correct, and it looks per-site random because
  // each site has its own copy. The manifest is a static same-origin JSON served max-age=60, keyed exactly
  // CODE-ISSUER, and costs no Function invocation and no Horizon verification -- so it is both fresher and
  // cheaper. Third-party issuers are not in it and fall through to loadToml exactly as before.
  var ownDesc=false;
  function loadOwnDesc(){
    if(!CODE||!ISSUER)return;
    fetch("/assets/tokens/launchpad-icons.json").then(function(r){ if(!r.ok)throw 0; return r.json(); }).then(function(m){
      var e=m&&m[CODE+"-"+ISSUER];
      var d=(e&&typeof e==="object"&&typeof e.desc==="string")?e.desc:"";
      // The manifest carries the artwork as well as the copy, and for our own assets it IS the picture
      // the toml publishes -- the same file. Taking it here settles the logo at once from a same-origin
      // fetch instead of waiting on Horizon plus a cross-origin toml, and ownLogo stops that toml from
      // repainting identical artwork under a different URL.
      var im=(e&&typeof e==="object"&&typeof e.image==="string")?e.image:"";
      if(im&&!tomlImg){ tomlImg=im; ownLogo=true; logoDone(); }
      if(!d)return;                          // not ours, or ours with no copy yet: leave the toml path alone
      ownDesc=true; tomlDesc=d;
      tomlDone();                            // settled with the REAL line, so the hold lifts without a flash
      try{ guardApply(); }catch(_){}         // tomlDone only applies on the first call; this covers the rest
    }).catch(function(){});                  // a missing manifest is not an error -- the toml still answers
  }
  var X_SVG='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
    +'<path d="M18.9 2H22l-7.1 8.1L23.2 22h-6.5l-5.1-6.7L5.8 22H2.7l7.6-8.7L1.2 2h6.7l4.6 6.1L18.9 2Zm-1.1 18h1.7L7.4 3.8H5.6L17.8 20Z"/></svg>';
  var TG_SVG='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
    +'<path d="M21.9 4.3 18.9 19c-.2 1-.8 1.2-1.7.8l-4.6-3.4-2.2 2.1c-.2.2-.5.5-1 .5l.3-4.7 8.5-7.7c.4-.3-.1-.5-.6-.2L6.2 13.1 1.7 11.7c-1-.3-1-1 .2-1.5l19-7.3c.8-.3 1.5.2 1.2 1.4Z"/></svg>';
  // A handle, an @handle or a full url -- issuers publish all three. Anything already absolute is left
  // alone; otherwise the leading @ is dropped and the handle is hung off the right host.
  function socialUrl(v,host){
    v=String(v||"").trim(); if(!v)return "";
    // No regex: this region is a template literal, so a backslash is eaten on the way to the browser.
    // Written as / it arrived as a bare / and made /^https?:///i -- a line comment, not a regex --
    // which threw a SyntaxError and took the whole asset layer down with it. indexOf and charAt cannot
    // be mangled by an escape pass.
    var lc=v.toLowerCase();
    if(lc.indexOf("http://")===0||lc.indexOf("https://")===0)return v;
    while(v&&(v.charAt(0)==="@"||v.charAt(0)==="/"))v=v.slice(1);
    if(!v)return "";
    return "https://"+host+"/"+v;
  }
  // stellar.toml (best-effort; many issuers' domains are CORS-OK). Pull [[CURRENCIES]].image + desc.
  // Same information as loadToml, by a route that a redirecting host cannot break.
  var edgePending=false;
  function loadTomlEdge(){
    if(NATIVE||!CODE||!ISSUER)return;
    edgePending=true;
    fetch("/lxapi/assetlogo?v=2&asset="+encodeURIComponent(CODE+"-"+ISSUER))
      .then(function(r){ if(!r.ok)throw 0; return r.json(); })
      .then(function(d){
        if(!d)return;
        var got=false;
        if(d.domain&&homeDomain==null){ homeDomain=d.domain; got=true; }
        if(d.desc&&!ownDesc&&!tomlDesc){ tomlDesc=d.desc; got=true; }
        if(d.image&&!ownLogo&&!tomlImg){ tomlImg=d.image; got=true; }
        if(d.twitter&&!tomlX){ tomlX=socialUrl(d.twitter,"x.com"); got=true; }
        if(d.telegram&&!tomlTg){ tomlTg=socialUrl(d.telegram,"t.me"); got=true; }
        edgePending=false;
        tomlDone(); logoDone();
        if(got){ try{ guardApply(); }catch(_){} }
      })
      // The edge giving up IS the end of the road for the picture, so release the latch the direct path
      // is holding off on -- otherwise a page whose issuer is CORS-blocked would never settle at all.
      .catch(function(){ edgePending=false; tomlDone(); logoDone(); });
  }
  function loadToml(domain){
    fetch("https://"+domain+"/.well-known/stellar.toml").then(function(r){ if(!r.ok)throw 0; return r.text(); }).then(function(txt){
      // find the [[CURRENCIES]] block for our code, then image= and desc=
      var re=new RegExp("code\\\\s*=\\\\s*[\\"']"+CODE+"[\\"'][^]*?(?=\\\\[\\\\[|$)","i");
      // NOT ||txt. Falling back to the whole document meant an asset the toml does NOT list matched the
      // FIRST image= in the file -- LUMOS's -- so every unlisted mint rendered with the LUMOS flame.
      // Invisible while lumoscore.com served no toml; wrong the moment it started serving one.
      var blk=(txt.match(re)||[""])[0];
      if(!blk){ tomlDone(); if(!edgePending)logoDone(); return; }   // toml served, asset simply not listed in it
      var img=(blk.match(/image\\s*=\\s*["']([^"']+)["']/i)||[])[1];
      var desc=(blk.match(/desc\\s*=\\s*["']([^"']+)["']/i)||[])[1];
      if(img&&!ownLogo)tomlImg=img; if(desc&&!ownDesc)tomlDesc=desc;
      // Currency block first (more specific), then the org-level [DOCUMENTATION] keys.
      var _tw=(blk.match(/^\\s*twitter\\s*=\\s*["']([^"']+)["']/im)||[])[1]
             ||(txt.match(/ORG_TWITTER\\s*=\\s*["']([^"']+)["']/i)||[])[1];
      var _tg=(blk.match(/^\\s*telegram\\s*=\\s*["']([^"']+)["']/im)||[])[1]
             ||(txt.match(/ORG_TELEGRAM\\s*=\\s*["']([^"']+)["']/i)||[])[1];
      if(_tw)tomlX=socialUrl(_tw,"x.com");
      if(_tg)tomlTg=socialUrl(_tg,"t.me");
      // No direct paint any more. applyHeader draws the logo once logoDone flips the flag below, which is
      // safe now because that flip also changes the stamp it compares against -- the old blocker (it had
      // already stamped CODE by the time this resolved, so the real logo was never drawn) is gone.
      tomlDone();                            // parsed: whatever we found is what we have
      logoDone();                            // and the picture is settled, image or not
      if(img||desc)guardApply();
      // An unreachable toml is a conclusion for THIS route only -- see item 1 above. If the edge is still
      // looking, let it finish; it is the route that actually works for a cross-origin issuer.
    }).catch(function(){ tomlDone(); if(!edgePending)logoDone(); });
  }

  // Dedicated SYNCHRONOUS header guardian: if any engine reverts the issuer address / website / name in
  // place or re-creates the nodes, re-assert applyHeader immediately (no 200ms debounce) so the mock hex is
  // never visibly painted -> zero flicker. Self-guarded (disconnect while we write) to avoid a loop.
  function guardHeader(){
    var hdr=q(".asset-header")||q(".asset-top"); if(!hdr||hdr.__lxhg)return; hdr.__lxhg=1;
    try{ var mo=new MutationObserver(function(){ if(hdr.__lxhgBusy)return; hdr.__lxhgBusy=1; mo.disconnect(); try{ applyHeader(); }catch(_){} try{ mo.observe(hdr,{childList:true,subtree:true,characterData:true}); }catch(_){} hdr.__lxhgBusy=0; });
      mo.observe(hdr,{childList:true,subtree:true,characterData:true}); }catch(_){}
  }

  // Debounced + self-guarded re-assert (the design re-renders the chart/orderbook/trades/holders on
  // tab/timeframe clicks; we watch childList only, debounce ~200ms, and disconnect while we write).
  var obs=null, sched=false;
  function reobserve(){ try{ if(obs){ var root=q("main")||document.body; if(root)obs.observe(root,{childList:true,subtree:true}); } }catch(_){} }
  function guardApply(){ if(obs)obs.disconnect(); try{ applyAll(); }catch(_){} reobserve(); }
  function schedule(){ if(sched)return; sched=true; setTimeout(function(){ sched=false; guardApply(); },200); }
  window.__lxDXAapply=guardApply;
  window.__lxDXAdbg=function(){return {code:CODE,issuer:ISSUER,xlmUsd:xlmUsd,assetXlm:assetXlm,chg24:chg24,vol24Xlm:vol24Xlm,supply:supply,holders:holders,poolCount:poolCount,liqXlm:liqXlm};};
  // #14: coming back from the wallet app with the keyboard still up.
  //
  // Signing leaves the page while an amount field still holds focus. iOS restores that focus when Safari
  // is fronted again, so the keyboard springs back over a screen the user has finished with -- the order
  // is already placed. Nothing on the page asked for the keyboard at that moment; it is simply the state
  // the tab was suspended in.
  //
  // Blur on the way back, and only if the focused thing is a text field: never touch focus the user has
  // deliberately moved somewhere else. Both events are needed -- visibilitychange covers an app switch,
  // pageshow covers a back-forward-cache restore, and iOS does not reliably fire both.
  function lxDropKeyboard(){
    try{
      var a=document.activeElement;
      if(!a||!a.tagName)return;
      var t=a.tagName.toLowerCase();
      if(t!=="input"&&t!=="textarea"&&!a.isContentEditable)return;
      a.blur();
    }catch(_){}
  }
  function lxWireBlurOnReturn(){
    if(window.__lxBlurOnReturn)return; window.__lxBlurOnReturn=1;
    try{
      document.addEventListener("visibilitychange",function(){ if(!document.hidden)setTimeout(lxDropKeyboard,0); });
      window.addEventListener("pageshow",function(){ setTimeout(lxDropKeyboard,0); });
    }catch(_){}
  }
  function boot(){
    try{ lxWireBlurOnReturn(); }catch(_){}
    guardApply();
    try{ wireCopy(); }catch(_){}
    try{ guardHeader(); }catch(_){}
    try{ guardChart(); }catch(_){}
    try{ guardSwap(); }catch(_){}
    try{ watchLimitModal(); }catch(_){}
    try{ chartUi(); }catch(_){}
    // clear the design's prefilled mock ("100" -> 23.659 USDC) so the widget starts clean; our quote runs on input
    try{ var _pin=payInput(); if(_pin&&!NATIVE){ _pin.value=""; _dxLastPay=""; } dxQuote(); }catch(_){}
    loadData();
    try{ obs=new MutationObserver(schedule); reobserve(); }catch(_){}
    var ticks=0, iv=setInterval(function(){ guardApply(); if(++ticks>4)clearInterval(iv); },1000);   // brief ~4s settle; the synchronous guards + observers handle any later re-render
    // Periodic LIVE refresh every 60s (price + chart + orderbook + trades) — NOT constant real-time polling.
    // Pauses entirely while the tab is hidden, so a backgrounded page costs nothing.
    setInterval(function(){ if(document.hidden)return;
      j(CG).then(function(d){ var u=(d&&d.stellar&&+d.stellar.usd)||0; if(u>0){ xlmUsd=u; try{ localStorage.setItem("lumos.xlmUsd",JSON.stringify({v:xlmUsd,ts:Date.now()})); }catch(_e){} applyAll(); } }).catch(function(){});
      try{ loadChart(chartTF); }catch(_){}
      try{ loadOrderbook(); }catch(_){}
    setInterval(function(){ try{ loadOrderbook(); }catch(_){} },20000);
      try{ loadTrades(); }catch(_){}
    },60000);
  }
  if(document.readyState!=="loading")boot(); else document.addEventListener("DOMContentLoaded",boot);
})();<\/script>`;

// ---- inject into every container that has the dex-asset keys ----
const files = fs.readdirSync('.').filter(f => /^lumoscore-.*-(desktop|mobile)\.html$/.test(f));
let n = 0, containers = 0;
for (const file of files) {
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;
  for (const k of KEYS) {
    if (!json[k]) continue;
    let p = json[k];
    p = p.replace(/<style id="lx-dxa-css">[\s\S]*?<\/style>/g, '')
         .replace(/<script id="lx-dxadata">[\s\S]*?<\/script>/g, '');
    // AUDIT #3 bug 15/52 (mobile residuals): the MOBILE page uses an mdxa- prefix none of the desktop
    // selectors match, so its mock trade panel ("Bal: 1,250 APT", "1 APT = …") and its filter chips
    // ("10+ APT" … "10K+ APT") shipped unrelabeled and flashed until a runtime pass caught them. Relabel
    // the exact literals at build time — display strings only, never identifiers, so a runtime script that
    // looks tokens up by "APT" can never be broken by this. Idempotent: literals are gone after one pass.
    if (k.indexOf('mobile') >= 0) {
      // #13: Market Cap and Supply, which the phone stat row never carried. Four cells across ONE row
      // rather than a second row of cards -- see the stat-row rules in the stylesheet for the sizing
      // that makes four fit a 331px column.
      if (p.indexOf('>Market Cap<') < 0) {
        p = p.replace(/(<div class="stat-row">[\s\S]*?)(<\/div>\s*<!-- Chart inside same card -->)/,
          function (all, body, tail) {
            return body
              + '<div class="stat-cell"><div class="lbl">Market Cap</div><div class="val mono">\u2014</div><div class="sub"></div></div>'
              // #40: ships hidden. Supply is not one of the three figures this strip shows -- it lives in
              // the More info sheet -- but the cell has to EXIST, because moreRows() reads its value back
              // out of the DOM. It used to be hidden at runtime by adding .lxda-more, so the strip painted
              // four cells and dropped to three a moment later. The class is applied here instead, and the
              // inline style with it: a class depends on a stylesheet that may be parsed after this markup,
              // and an inline style cannot lose that race.
              + '<div class="stat-cell lxda-more" style="display:none"><div class="lbl">Supply</div><div class="val mono">\u2014</div><div class="sub"></div></div>'
              + tail;
          });
      }
      [['Bal: 1,250 APT', 'Bal: 1,250 XLM'],
       ['Avail: 1,250 APT', 'Avail: 1,250 XLM'],
       ['1 APT = 0.23659 USDC', '1 XLM = 0.23659 USDC'],
       ['Price (APT)', 'Price (XLM)'],
       ['≤ 4.18 APT', '≤ 4.18 XLM'],
       ['0.0024 APT', '0.0024 XLM'],
       ['+0.0422 APT', '+0.0422 XLM'],
       ['22.4M APT', '22.4M XLM'],
       ['>10+ APT<', '>10+ XLM<'],
       ['>100+ APT<', '>100+ XLM<'],
       ['>1K+ APT<', '>1K+ XLM<'],
       // #15: the 10K+ chip is removed outright below, so there is no label left to rename.
       ["+ ' APT');", "+ ' XLM');"]                     // design chart-tooltip unit (display concat only)
      ].forEach(function (r) { p = p.split(r[0]).join(r[1]); });
    }
    // AUDIT (flash sweep): the exchange-size chips ship as "10+ APT" and the engine relabels them to XLM on
    // every pass — a guaranteed flash for text that is not data at all. Fix the markup so there is nothing
    // to relabel. Idempotent: after one pass no APT remains inside the filters block.
    p = p.replace(/(<div class="filters" id="dxaPanelFilters">[\s\S]*?<\/div>)/,
                  function (blk) { return blk.replace(/\bAPT\b/g, 'XLM'); });
    // #15: drop the 10K+ chip. Recent Exchanges crawls back a bounded number of operations, so on most
    // assets this filter returns nothing at all -- a control that reads as broken more often than it
    // reads as useful. Matched on data-min-xlm rather than on the label, so it goes whether the markup
    // still says APT or has already been relabelled to XLM.
    p = p.replace(/<button class="chip" data-min-xlm="10000">[^<]*<\/button>\s*/g, '');
    // The "$" the design bakes into the logo tile. With the blue gradient behind it (see the CSS above)
    // it reads as USDC on every asset page until our script runs. Removed in the markup so there is
    // nothing to clear at runtime. Idempotent: after one pass the tile is empty and no match remains.
    p = p.split('<div class="asset-logo">$</div>').join('<div class="asset-logo"></div>');
    // ...and opt the tile out of the design's logo HEALER, which is where the USDC picture actually came
    // from. That script walks for /ico|asset-logo|token-logo|pair-ic/ and stamps in artwork keyed by
    // TICKER TEXT ALONE; the page ships baked as USDC, so it injected Circle's mark as a child <img> about
    // 90ms in and it stayed until our painter cleared it. _logoguard.js already teaches the healer to skip
    // anything the data layer owns -- the marker is a data-lxc attribute -- but this element never carried
    // one, so it was fair game on every asset page. Empty value is enough: the check is != null.
    p = p.split('<div class="asset-logo"></div>').join('<div class="asset-logo" data-lxc=""></div>');

    // #23: drop the baked active state from the timeframe strip.
    //
    // 1D is only the window we ASK for. When an asset has not traded inside it the chart steps out to
    // the first range that has a line, and the highlight jumped from 1D to 1W a second after load --
    // the page appearing to change its mind. With nothing pre-selected, tfActive() lights whichever
    // range actually drew, once. Done in the markup rather than with CSS because the stylesheet is
    // not guaranteed to be parsed before this element paints.
    p = p.replace(/<div class="timeframes">[\s\S]{0,500}?<\/div>/, function (all) {
      return all.replace(/\s*class="active"/g, '');
    });
    // The desktop crumb carried a back link AND a "· DEX / CODE" trail: the same destination twice, plus
    // a segment repeating the asset the page is already titled after. The mobile build ships the back
    // link alone and reads better for it, so match it. Markup, not runtime, so there is nothing to
    // relabel on load. Idempotent: with the trail gone the guard no longer matches. applyHeader's
    // ".crumb span" lookup is already null-guarded, so it simply finds nothing to write.
    if (/<div class="crumb">[\s\S]*?class="sep"/.test(p)) {
      p = p.replace(/(<div class="crumb">[\s\S]*?<\/a>)[\s\S]*?<\/div>/, '$1\n  </div>');


    }
    // Discussions was removed: no backend ever existed, so the tab only led to the design's mock thread
    // plus browser-local posts nobody else could see. Idempotent -- after one pass there is no match.
    p = p.replace(/<button[^>]*data-tab="discussions"[^>]*>[\s\S]*?<\/button>/g, '');
    // "Total Reactions": emoji buttons wired to nothing. Depth-scan to the card's OWN closing tag --
    // it wraps nested divs, so a lazy regex would cut it off mid-card. Idempotent: no match, no change.
    for (;;) {
      const rm = /<div class="[^"]*\breact-card\b[^"]*">/.exec(p);
      if (!rm) break;
      const re = /<div\b[^>]*>|<\/div>/g;
      re.lastIndex = rm.index;
      let depth = 0, end = -1, mm;
      while ((mm = re.exec(p))) {
        if (mm[0].charAt(1) === '/') { depth--; if (depth === 0) { end = mm.index + mm[0].length; break; } }
        else depth++;
      }
      if (end < 0) break;                                   // unbalanced markup: leave it rather than corrupt the page
      let start = rm.index;
      const cmt = p.lastIndexOf('<!-- Total Reactions -->', rm.index);
      if (cmt >= 0 && rm.index - cmt < 60) start = cmt;      // take the comment with it
      p = p.slice(0, start) + p.slice(end);
    }
    // Move the price-change block under the chart. Idempotent: once it lives inside .chart-section the
    // scan below finds it there and leaves it alone, so re-running the transform is a no-op.
    // Mobile: the same move, different markup. The design stacks its cards chart / trade / price-change /
    // tabs, so the six figures sat BELOW the trade widget -- a screen and a half from the line they describe,
    // and the opposite of where the desktop layout now puts them. Lift the card to sit directly under the
    // chart so the reading order matches on both: chart, price change, trade, ad.
    //
    // Anchored on the design's own "Trade card" comment rather than on a div index. The mobile page is one
    // flat column of sibling cards with no wrapper to depth-match against, so a comment is the only marker
    // here that names what follows it.
    (function(){
      var POPEN = String.fromCharCode(60) + 'div class="card mdxa-perf-card">';
      var TRADE = String.fromCharCode(60) + '!-- Trade card';
      var pi = p.indexOf(POPEN); if (pi < 0) return;
      var ti = p.indexOf(TRADE); if (ti < 0) return;
      if (pi < ti) return;                                   // already moved
      // take the design's own comment with it rather than leaving it orphaned
      var start = pi, cmt = p.lastIndexOf(String.fromCharCode(60) + '!-- Price change grid --' + String.fromCharCode(62), pi);
      if (cmt >= 0 && pi - cmt < 40) start = cmt;
      // depth-walk to the card's own close: indexOf("</div>") stops at the first perf-cell's
      var d = 0, k = pi;
      while (k < p.length) {
        var no = p.indexOf(String.fromCharCode(60) + 'div', k), nc = p.indexOf(String.fromCharCode(60) + '/div>', k);
        if (nc < 0) return;
        if (no >= 0 && no < nc) { d++; k = no + 4; continue; }
        d--; k = nc + 6;
        if (d === 0) break;
      }
      if (d !== 0) return;
      var block = p.slice(start, k);
      var without = p.slice(0, start) + p.slice(k);
      // recompute against the string being KEPT: removing the block shifts every offset after it
      var ti2 = without.indexOf(TRADE); if (ti2 < 0) return;
      p = without.slice(0, ti2) + block + String.fromCharCode(10) + '      ' + without.slice(ti2);
    })();
        (function(){
      var OPEN = '<div class="dxa-perf-card">';        // exact, so mobile's mdxa-perf-card cannot match
      var ci = p.indexOf('<div class="chart-section">');
      var pi = p.indexOf(OPEN);
      if (ci < 0 || pi < 0) return;

      // depth-scan a block to its OWN closing tag; both of these wrap nested divs, so a lazy regex
      // would cut at the first </div> and shred the page
      function endOf(start){
        var re = /<div\b[^>]*>|<\/div>/g; re.lastIndex = start;
        var depth = 0, m;
        while ((m = re.exec(p))) {
          if (m[0].charAt(1) === '/') { depth--; if (depth === 0) return m.index + m[0].length; }
          else depth++;
        }
        return -1;
      }

      var chartEnd = endOf(ci);
      if (chartEnd < 0) return;
      if (pi > ci && pi < chartEnd) return;             // already moved

      var perfEnd = endOf(pi);
      if (perfEnd < 0) return;
      var block = p.slice(pi, perfEnd);

      // take the design's own comment with it rather than leaving it orphaned above the gap
      var start = pi;
      var cmt = p.lastIndexOf('<!-- Price change grid -->', pi);
      if (cmt >= 0 && pi - cmt < 40) start = cmt;

      var without = p.slice(0, start) + p.slice(perfEnd);
      // recompute the insertion point against the STRING WE ARE KEEPING: removing the block shifts
      // every offset after it, and reusing chartEnd here would splice into the middle of a tag.
      var ci2 = without.indexOf('<div class="chart-section">');
      var pSave = p; p = without;
      var end2 = endOf(ci2);
      p = pSave;
      if (end2 < 0) return;
      var closeLen = '</div>'.length;
      p = without.slice(0, end2 - closeLen) + block + without.slice(end2 - closeLen);
    })();
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
console.log('dex-asset data (phase 1): injected=' + n + ' keys across ' + containers + ' containers');
