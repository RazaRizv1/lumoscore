// Cross-chain step 2 -- rebuilt to RAZA's reference design (2026-09-19).
//
// The brief, in his words across four rounds: "too many boxes", "not neat, not symmetrical, not attractive, using
// more space than should be used", then a finished mock to match. The mock is the spec now:
//
//   LEFT CARD   From [Stellar]          / asset + full name / "Available to send" / amount in a box
//               -------- (swap) --------
//               To [network v]          / asset + full name / "You will receive"
//               Receiving address       / [link  input  Paste] / "Make sure the address is on <network>"
//   RIGHT CARD  ROUTE / identity card per route / Receive . Bridge fee . Estimated time, each with an icon
//   BELOW       a proper error banner, and "Review transfer ->"
//
// ONE DEVIATION FROM THE MOCK, ON PURPOSE: it shows "Bridge fee Free". RAZA separately pointed out that LumosCore
// always takes 0.2% (0.1% for 250K+ LUMOS holders), so the fee row states the real rate. The mock is followed for
// layout, not for a figure that would be untrue.
//
// HOW IT IS BUILT, AND WHY:
//
//  * NO ELEMENT LEAVES ITS SECTION. _cctp.js and _lzusdt0.js find things by querying WITHIN each .br-side --
//    sides[1].querySelector('.br-addr-in'), side.querySelector('.br-wallet .br-ic'), and so on. Moving a node out
//    of its section would break those silently. So existing nodes stay exactly where they are; the rows that wrap
//    them become display:contents, which removes their box while keeping them in the tree, and their children are
//    then placed straight onto the section's grid.
//  * NEW TEXT IS CSS WHERE IT CAN BE. "Available to send" and "You will receive" are ::before content, so when an
//    engine rebuilds the node underneath, the label cannot be wiped out with it.
//  * THE BROWSER CODE IS A REAL FUNCTION, serialised with toString(). Earlier layers assembled their browser code by
//    string concatenation, and one missing paren emitted a file that would not parse and silently deleted an entire
//    layer. Written this way, `node --check` on this file validates the code the browser actually runs.
//  * NOTHING HERE FLASHES. Step 2 is hidden until you advance to it, so everything injected at load is in place long
//    before it can be seen, and the one piece that rewrites engine text does it in a MutationObserver, which runs
//    before the next paint.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const ID = 'lx-brpolish';
const S2 = '.br-step[data-step="2"] ';
const SRC = S2 + '.br-io > .br-side:first-child ';
const DST = S2 + '.br-io > .br-side:last-child ';

// Stroke icons, drawn once and used as masks so they take the theme's colour rather than carrying their own.
function mask(svg) { return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")'; }
const I = {
  link: mask('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/></svg>'),
  shield: mask('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'),
  alert: mask('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>'),
  caret: mask('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>'),
  arrow: mask('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'),
};

const CSS = '<style id="' + ID + '">'

  // ---- the two cards --------------------------------------------------------------------------------------
  + '.lx-brwrap{display:grid !important;grid-template-columns:minmax(0,1.9fr) minmax(290px,1fr) !important;'
  // Flush LEFT, under the heading, as in the mock. Centred, the cards started 60px right of the title and subtitle
  // above them, so the page had two left edges.
  + 'gap:24px !important;align-items:start !important;max-width:1240px;margin:0}'
  + S2 + '.br-io{max-width:none !important;margin:0 !important;background:var(--surface-2);'
  + 'border:1px solid var(--border);border-radius:18px;padding:22px 26px;gap:0;overflow:visible}'

  // ---- each half is a grid; the wrapping rows dissolve into it ----------------------------------------------
  + S2 + '.br-io > .br-side{background:transparent !important;border:0 !important;border-radius:0 !important;'
  // The second column is the amount box's, and it is FIXED: sized by content it took the text input's intrinsic
  // width and grew to ~400px. The mock's box is small and sits at the right edge.
  + 'padding:0 !important;display:grid !important;grid-template-columns:minmax(0,1fr) 220px !important;'
  + 'grid-template-rows:none !important;column-gap:18px !important;row-gap:16px !important;align-items:center !important;'
  + 'max-width:none !important;width:auto !important}'
  + S2 + '.br-io > .br-side > .br-assetrow,' + S2 + '.br-io > .br-side > .br-amtrow{display:contents !important}'
  // What the mock replaced: the section heading, the source wallet chip and the old "You swap / You get" line.
  // Hidden, never removed -- the engines still read and write them.
  + S2 + '.br-io > .br-side > .hd{display:none !important}'
  + SRC + '> .br-wallet{display:none !important}'
  + S2 + '.br-io > .br-side > .br-amtrow > *{display:none !important}'

  // ---- row order is set explicitly, never inherited ---------------------------------------------------------
  // The design pins .br-wallet to grid-row:2. Left alone, that dropped the address box ABOVE its own "Receiving
  // address" label and above the asset -- the opposite of the mock. Unpinning every item and giving each an order
  // makes the sequence independent of both the DOM order and whatever the design's grid rules say.
  + S2 + '.br-io > .br-side > *,' + S2 + '.br-asset,' + S2 + '.br-amt{grid-row:auto !important}'
  + '.lx-s2net{order:1}'
  + S2 + '.br-asset,' + S2 + '.br-amt{order:2}'
  + '.lx-s2albl{order:3}'
  + DST + '> .br-wallet.brw-in{order:4}'
  + '.lx-s2hint{order:5}'

  // ---- "From [Stellar]" / "To [network v]" -----------------------------------------------------------------
  // The pill sits right after its label (RAZA 2026-09-19: "should be more closed"); no fixed label width, so "To"
  // does not get From's width and a gap of its own.
  + '.lx-s2net{grid-column:1 / -1;display:flex;align-items:center;gap:12px}'
  + '.lx-s2lbl{font:600 16px/1 "Hanken Grotesk",system-ui,sans-serif;color:var(--text)}'
  + '.lx-s2pill{display:inline-flex;align-items:center;gap:10px;height:42px;padding:0 14px 0 12px;border-radius:999px;'
  + 'border:1px solid var(--border);background:var(--surface);color:var(--text);'
  + 'font:600 15px/1 "Hanken Grotesk",system-ui,sans-serif;cursor:default}'
  + 'button.lx-s2pill{cursor:pointer;transition:border-color .15s ease}'
  + 'button.lx-s2pill:hover{border-color:var(--border-strong,#34343c)}'
  + '.lx-s2ic{width:22px;height:22px;border-radius:50%;overflow:hidden;flex:0 0 22px;display:block}'
  + '.lx-s2ic img{width:100%;height:100%;object-fit:cover;display:block}'
  + '.lx-s2cv{width:14px;height:14px;background:currentColor;opacity:.6;-webkit-mask:' + I.caret + ' center/contain no-repeat;mask:' + I.caret + ' center/contain no-repeat}'

  // ---- the asset: logo, ticker, and what it actually is ----------------------------------------------------
  + S2 + '.br-asset{grid-column:1;display:grid !important;grid-template-columns:auto auto auto;'
  + 'grid-template-areas:"ic nm cv" "ic full full";column-gap:12px;row-gap:1px;align-items:center;justify-content:start}'
  + S2 + '.br-asset > .br-ic{grid-area:ic;width:44px !important;height:44px !important;min-width:44px !important}'
  + S2 + '.br-asset > .nm{grid-area:nm;font:700 18px/1.15 "Hanken Grotesk",system-ui,sans-serif;color:var(--text)}'
  + S2 + '.br-asset > .cv{grid-area:cv}'
  + '.lx-s2full{grid-area:full;font:400 13.5px/1.3 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-soft)}'

  // ---- source amount: the number sits in a box, "Available to send" to its left ----------------------------
  // Padding is !important on every side: a design rule zeroed padding-right, so the figure ran into the border.
  + SRC + '.br-amt{grid-column:2;position:relative;display:flex !important;flex-direction:column;align-items:flex-end;'
  + 'justify-content:center;box-sizing:border-box;width:220px !important;min-width:0 !important;min-height:0 !important;'
  + 'padding:10px 16px !important;border-radius:12px;'
  + 'border:1px solid var(--border-strong,#34343c);background:var(--surface)}'
  + SRC + '.br-amt:focus-within{border-color:var(--accent,#ea6a2c)}'
  + SRC + '.br-amt .v{width:100%;min-width:0}'
  + SRC + '.br-amt .v,' + SRC + '.br-amt .v input{font:600 24px/1.15 "Hanken Grotesk",system-ui,sans-serif !important;text-align:right}'
  + SRC + '.br-amt .v input{width:100% !important;min-width:0 !important;height:auto !important;padding:0 !important;margin:0 !important;'
  + 'border:0 !important;background:transparent !important;box-shadow:none !important}'
  + SRC + '.br-amt .usd{font:400 13px/1.3 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-soft);margin-top:2px}'
  // Anchored to the LEFT of the box rather than placed on the grid, because it lives INSIDE the amount node and
  // must stay there for the engine that writes it. Its right edge is the box's left edge minus 26px -- the same
  // line "You will receive" is set against below, so the two read as one column, as in the mock.
  + SRC + '.lx-balrow{position:absolute !important;right:calc(100% + 26px);top:50%;transform:translateY(-50%);'
  + 'display:flex !important;flex-direction:column;align-items:flex-end;gap:4px;white-space:nowrap;margin:0 !important}'
  + SRC + '.lx-balrow::before{content:"Available to send";font:400 13px/1.2 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-soft)}'
  + SRC + '.lx-balrow .bal{display:flex !important;align-items:center;gap:8px;font:500 15px/1.2 "Hanken Grotesk",system-ui,sans-serif !important;color:var(--text)}'

  // ---- destination amount: "You will receive", in the same column as "Available to send" --------------------
  // It sits in the box column (220px) and is moved left by the box width plus the 26px gap, so its right edge lands
  // on the line the source label and balance end on. A transform moves the drawing, not the grid, so nothing else
  // on the row shifts.
  + DST + '.br-amt{grid-column:2;display:flex !important;flex-direction:column;align-items:flex-end;justify-content:center;'
  + 'transform:translateX(-246px);white-space:nowrap}'
  + DST + '.br-amt::before{content:"You will receive";font:400 13px/1.2 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-soft);margin-bottom:4px}'
  + DST + '.br-amt .v,.lx-s2recv{font:500 15px/1.2 "Hanken Grotesk",system-ui,sans-serif !important;color:var(--text)}'
  // CCTP always delivers USDC, so the unit is constant on that path; LayerZero's figure is drawn by .lx-s2recv.
  + DST + '.br-amt .v::after{content:" USDC"}'
  + DST + '.br-amt .usd{display:none !important}'

  // ---- the destination follows the chosen route ------------------------------------------------------------
  // CCTP delivers USDC and LayerZero delivers USDT0 (RAZA 2026-09-19: the To side said USDC with LayerZero chosen).
  // The engine's own nodes are hidden, never rewritten -- it keeps writing its USDC figures underneath, so switching
  // back to CCTP shows them again with nothing to restore.
  + '.lx-s2ic2,.lx-s2nm2,.lx-s2recv{display:none}'
  + 'html[data-lxroute-asset]:not([data-lxroute-asset="USDC"]) ' + DST + '.br-asset > .br-ic,html[data-lxroute="NEAR Intents"] ' + DST + '.br-asset > .br-ic,'
  + 'html[data-lxroute-asset]:not([data-lxroute-asset="USDC"]) ' + DST + '.br-asset > .nm,html[data-lxroute="NEAR Intents"] ' + DST + '.br-asset > .nm,'
  + 'html[data-lxroute-asset]:not([data-lxroute-asset="USDC"]) ' + DST + '.br-amt .v,html[data-lxroute="NEAR Intents"] ' + DST + '.br-amt .v{display:none !important}'
  + 'html[data-lxroute-asset]:not([data-lxroute-asset="USDC"]) ' + DST + '.lx-s2ic2,html[data-lxroute="NEAR Intents"] ' + DST + '.lx-s2ic2{display:block;grid-area:ic;width:44px;height:44px;border-radius:50%;overflow:hidden}'
  + '.lx-s2ic2 img{width:100%;height:100%;display:block;object-fit:cover}'
  + 'html[data-lxroute-asset]:not([data-lxroute-asset="USDC"]) ' + DST + '.lx-s2nm2,html[data-lxroute="NEAR Intents"] ' + DST + '.lx-s2nm2{display:block;grid-area:nm;font:700 18px/1.15 "Hanken Grotesk",system-ui,sans-serif;color:var(--text)}'
  + 'html[data-lxroute-asset]:not([data-lxroute-asset="USDC"]) ' + DST + '.lx-s2recv,html[data-lxroute="NEAR Intents"] ' + DST + '.lx-s2recv{display:block}'
  // NEAR Intents: the delivered token is the user's pick -- a caret says the face is the control that changes it
  + DST + '.br-asset.lx-s2pick{cursor:pointer}'
  + DST + '.br-asset.lx-s2pick .lx-s2nm2::after{content:"";display:inline-block;width:14px;height:14px;margin-left:6px;vertical-align:-1px;'
  + 'background:currentColor;opacity:.6;-webkit-mask:' + I.caret + ' center/contain no-repeat;mask:' + I.caret + ' center/contain no-repeat}'
  + '.lx-ni-menu{position:absolute;z-index:99999;min-width:230px;max-height:320px;overflow:auto;padding:6px;border-radius:14px;'
  + 'background:var(--surface-2);border:1px solid var(--border);box-shadow:0 18px 44px rgba(0,0,0,.35)}'
  + '.lx-ni-menu button{display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;border:0;border-radius:10px;background:transparent;'
  + 'color:var(--text);font:600 14px/1.2 "Hanken Grotesk",system-ui,sans-serif;cursor:pointer;text-align:left}'
  + '.lx-ni-menu button:hover,.lx-ni-menu button[aria-selected="true"]{background:var(--surface)}'
  + '.lx-ni-menu img{width:26px;height:26px;border-radius:50%;flex:0 0 26px;display:block}'
  + '.lx-ni-menu .n{font-weight:400;font-size:12px;color:var(--text-soft)}'
  // the full list: a search field pinned on top, the rows scrolling beneath it
  + '.lx-ni-menu{padding-top:0;width:min(300px,calc(100vw - 16px))}'
  + '.lx-ni-search{position:sticky;top:0;z-index:2;padding:8px 2px 6px;background:var(--surface-2)}'
  + '.lx-ni-search input{width:100%;box-sizing:border-box;padding:9px 11px;border-radius:10px;border:1px solid var(--border);'
  + 'background:var(--surface);color:var(--text);font:400 13.5px/1.2 "Hanken Grotesk",system-ui,sans-serif;outline:none}'
  + '.lx-ni-search input:focus{border-color:var(--accent,#ea6a2c)}'
  + '.lx-ni-l{width:26px;height:26px;border-radius:50%;flex:0 0 26px;display:inline-flex;align-items:center;justify-content:center;'
  + 'background:var(--surface);color:var(--text-soft);font:700 12px/1 "Hanken Grotesk",system-ui,sans-serif}'
  // the letter is CSS content, never a text node: a round coloured span holding one character is what the site's logo
  // painter repaints as a token badge (it did exactly that to the bridge's step tick)
  + '.lx-ni-l::before{content:attr(data-l)}'
  + '.lx-ni-empty{padding:12px 10px;color:var(--text-soft);font:400 13px/1.3 "Hanken Grotesk",system-ui,sans-serif}'

  // ---- receiving address: a labelled input, with the hint beneath ------------------------------------------
  + '.lx-s2albl{grid-column:1 / -1;font:600 15px/1 "Hanken Grotesk",system-ui,sans-serif;color:var(--text);margin-top:4px}'
  + DST + '> .br-wallet.brw-in{grid-column:1 / -1;display:flex !important;align-items:center;gap:12px;'
  + 'min-height:56px !important;padding:0 8px 0 16px !important;border-radius:14px !important;'
  + 'border:1px solid var(--border-strong,#34343c) !important;background:var(--surface) !important}'
  + DST + '> .br-wallet.brw-in:focus-within{border-color:var(--accent,#ea6a2c) !important}'
  + DST + '> .br-wallet.brw-in > .br-ic{display:none !important}'
  + DST + '> .br-wallet.brw-in::before{content:"";flex:0 0 18px;width:18px;height:18px;background:var(--text-soft);'
  + '-webkit-mask:' + I.link + ' center/contain no-repeat;mask:' + I.link + ' center/contain no-repeat}'
  + DST + '.br-addr-in{flex:1;min-width:0;font:400 15px/1.2 "Hanken Grotesk",system-ui,sans-serif !important}'
  + '.lx-s2hint{grid-column:1 / -1;display:flex;align-items:center;gap:8px;margin-top:-6px;'
  + 'font:400 13px/1.3 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-soft)}'
  + '.lx-s2hint::before{content:"";flex:0 0 14px;width:14px;height:14px;background:currentColor;'
  + '-webkit-mask:' + I.shield + ' center/contain no-repeat;mask:' + I.shield + ' center/contain no-repeat}'

  // ---- the divider, swap control on it ----------------------------------------------------------------------
  // THE HAIRLINE IS A PSEUDO-ELEMENT, AND THAT IS LOAD-BEARING. Painting it as .br-swapmid's own background made
  // the logo healer (the script that repaints any span/div whose text is 1-5 characters as a token badge) read the
  // container as an icon: its looksLikeIcon() returns true for ANY computed background colour, and the container's
  // only text is the button's single "⇄". So it stamped data-logo="APT" on it, set textContent='' -- and the swap
  // button vanished from the DOM. A ::before is invisible to getComputedStyle(el), so the container stays plain.
  + S2 + '.br-swapmid{position:relative !important;display:flex !important;align-items:center;justify-content:center;'
  + 'height:1px !important;margin:28px 0 !important;padding:0 !important;background:transparent !important;overflow:visible !important}'
  + S2 + '.br-swapmid::before{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:var(--border)}'
  // Round and outlined in the accent, as in the mock, on the card's own colour so the hairline stops at its edge.
  + S2 + '.br-swapmid > *{position:relative;z-index:1;width:46px !important;height:46px !important;min-width:46px !important;'
  + 'border-radius:50% !important;background:var(--surface-2) !important;border:1px solid var(--accent,#ea6a2c) !important;'
  + 'color:var(--accent,#ea6a2c) !important;box-shadow:none !important;padding:0 !important}'

  // ---- the error banner -------------------------------------------------------------------------------------
  // Width and offset repeat the wrapper grid's arithmetic (max 1240px, columns 1.9fr/1fr, 24px gap) so the banner
  // sits under the LEFT card exactly, as in the mock, instead of running the full width under both. It is outside
  // the grid on purpose: the engines write to .br-errslot by querying the step, and moving it into the grid would
  // be moving a node they own.
  + S2 + '.br-errslot:not(:empty){display:flex !important;align-items:flex-start;gap:14px;max-width:none !important;'
  + 'box-sizing:border-box;width:calc((min(100%,1240px) - 24px) * 1.9 / 2.9) !important;'
  + 'margin:18px auto 0 0 !important;'
  + 'padding:16px 20px !important;border-radius:14px;justify-content:flex-start !important;'
  + 'text-align:left !important;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.35);'
  + 'font:500 14px/1.45 "Hanken Grotesk",system-ui,sans-serif !important;color:#f87171 !important}'
  + S2 + '.br-errslot:not(:empty)::before{content:"";flex:0 0 22px;width:22px;height:22px;margin-top:1px;background:currentColor;'
  + '-webkit-mask:' + I.alert + ' center/contain no-repeat;mask:' + I.alert + ' center/contain no-repeat}'

  // ---- "Review transfer ->" ---------------------------------------------------------------------------------
  // The row spans the LEFT card, Back on its left edge and Review on its right (RAZA 2026-09-19), using the same
  // width arithmetic as the error banner above it so all three share edges.
  + S2 + '.br-actions{display:flex !important;justify-content:space-between !important;align-items:center;box-sizing:border-box;'
  + 'width:calc((min(100%,1240px) - 24px) * 1.9 / 2.9) !important;max-width:none !important;margin-left:0 !important;margin-right:auto !important;'
  + 'padding-left:0 !important;padding-right:0 !important}'
  + S2 + '.br-actions .br-next{display:inline-flex !important;align-items:center;justify-content:center;gap:10px}'
  + S2 + '.br-actions .br-next::after{content:"";width:18px;height:18px;background:currentColor;'
  + '-webkit-mask:' + I.arrow + ' center/contain no-repeat;mask:' + I.arrow + ' center/contain no-repeat}'

  // ---- ROUTE: a card holding the route identities, then the chosen route's figures ------------------------
  + '.lx-brroute{background:var(--surface-2) !important;border:1px solid var(--border) !important;'
  + 'border-radius:18px !important;padding:20px !important;overflow:visible;max-width:none !important;margin:0 !important}'
  + '.lx-brroute > .hd{padding:0 !important;margin:0 0 14px !important;font:700 12.5px/1 "Hanken Grotesk",system-ui,sans-serif !important;'
  + 'letter-spacing:.1em !important;text-transform:uppercase;color:var(--text-soft) !important}'
  // The heading's text lives here rather than in the markup -- see _lzusdt0.js for why a real text node got the
  // whole panel erased by the logo healer.
  + '.lx-brroute > .hd::before{content:"Route"}'
  + '.lx-brr-opts{display:flex !important;flex-direction:column;gap:10px !important;padding:0 !important}'
  + '.lx-brr{background:var(--surface) !important;border:1px solid var(--border) !important;border-radius:14px !important;'
  + 'padding:14px 16px !important;min-height:0 !important;box-shadow:none !important;transform:none !important}'
  + '.lx-brr:hover:not([disabled]){border-color:var(--border-strong,#34343c) !important}'
  // Name and tag on one line, the description under both, as in the mock: the tag belongs to the name, not to the
  // card's far edge. The heading wrapper dissolves so its two lines can sit on the card's own grid.
  + '.lx-brr .lx-brr-top{margin-bottom:0 !important;display:grid !important;grid-template-columns:auto auto minmax(0,1fr) !important;'
  + 'grid-template-areas:"mk nm tg" "mk sb sb";column-gap:12px !important;row-gap:3px;align-items:center}'
  + '.lx-brr .lx-brr-mark{grid-area:mk}'
  + '.lx-brr .lx-brr-hd{display:contents !important}'
  + '.lx-brr .lx-brr-nm{grid-area:nm}'
  + '.lx-brr .lx-brr-sub{grid-area:sb}'
  + '.lx-brr .lx-brr-tag{grid-area:tg;justify-self:start;margin:0 !important}'
  + '.lx-brr .lx-brr-mark{width:40px !important;height:40px !important;flex:0 0 40px !important}'
  + '.lx-brr .lx-brr-nm{font:600 17px/1.2 "Hanken Grotesk",system-ui,sans-serif !important}'
  // Allowed to wrap: in the narrow route column "Tether's omnichain dollar" was ellipsised to "...omnichain dol",
  // which reads as a rendering fault rather than a design choice. Two lines is better than a clipped word.
  + '.lx-brr .lx-brr-sub{font:400 13.5px/1.3 "Hanken Grotesk",system-ui,sans-serif !important;'
  + 'white-space:normal !important;overflow:visible !important;text-overflow:clip !important}'
  // Chosen: the accent edge only. The mock's card is quiet; the earlier wash plus a doubled ring made the choice
  // shout louder than the transfer it belongs to.
  + '.lx-brr[aria-pressed="true"]{border-color:var(--accent,#ea6a2c) !important;'
  + 'background:var(--surface) !important;box-shadow:none !important}'
  + '.lx-brr[disabled]{opacity:.55 !important}'
  + '.lx-brr .lx-brr-soon{margin:10px 0 0 51px !important}'
  + '.lx-brr-stats{margin-top:18px;display:flex;flex-direction:column;gap:15px;padding:4px 4px 0}'
  + '.lx-brr-stats[hidden]{display:none}'
  + '.lx-brs-row{display:grid;grid-template-columns:20px auto minmax(0,1fr);align-items:center;gap:12px;'
  + 'font:400 15px/1.3 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-soft)}'
  + '.lx-brs-ic{width:19px;height:19px;color:var(--text-soft);display:block}'
  + '.lx-brs-ic svg{width:100%;height:100%;display:block}'
  // Solid glyphs, as in the mock: fill the outlines, and cut the tag's hole and the clock's hands in the card colour.
  + '.lx-brs-ic svg path,.lx-brs-ic svg circle{fill:currentColor}'
  + '.lx-brs-row:nth-child(2) .lx-brs-ic svg circle{fill:var(--surface-2);stroke:none}'
  + '.lx-brs-row:nth-child(3) .lx-brs-ic svg path{fill:none;stroke:var(--surface-2)}'
  + '.lx-brs-k{white-space:nowrap}'
  + '.lx-brs-v{font:600 16px/1.3 "Hanken Grotesk",system-ui,sans-serif;color:var(--text);text-align:right;white-space:normal}'
  // Swap price impact above 1%: amber, the one semantic colour on the card, so a costly swap is noticed.
  + '.lx-brs-warn,.lx-brs-warn .lx-brs-ic,.lx-brs-warn .lx-brs-v{color:#f5a524 !important}'
  + '.lx-brs-note{margin-top:2px;padding-top:14px;border-top:1px solid var(--border);'
  + 'font:400 13px/1.45 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-soft)}'

  // ---- the destination picker's search bar -------------------------------------------------------------------
  // It is sticky at the top of a panel that has ~6.6px of padding, so rows scrolled up THROUGH that band and showed
  // above the search bar ("Arbitrum" peeking over it on RAZA's phone, 2026-09-19). No top padding, no gap.
  + '.brd-menu{padding-top:0 !important}.brd-menu .brd-search{margin-top:0 !important;top:0 !important}'
  // THE OPEN DROPDOWN MUST WIN AGAINST THE CARDS BELOW IT (RAZA 2026-09-20: two transaction icons floating over the
  // network list on a phone). Each .br-step carries a transform for its slide, which traps the menu's z-index INSIDE
  // the step -- so the step as a whole paints at its place in the page, and anything positioned further down (the
  // recent-transaction icons, which are positioned because the network badge sits in their corner) paints over it.
  // Giving the step its own layer restores the obvious order: the wizard, then the history beneath it. Modals are
  // children of <body> with their own far higher layers, so they are unaffected.
  + S2.replace('[data-step="2"] ', '') + '{position:relative;z-index:5}'

  // ---- scan a QR code for the receiving address (phones) ----------------------------------------------------
  + DST + '.lx-scan{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;'
  + 'padding:0;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);cursor:pointer}'
  + DST + '.lx-scan svg{width:19px;height:19px}'
  + DST + '.lx-scan:active{border-color:var(--accent,#ea6a2c);color:var(--accent,#ea6a2c)}'
  + '.lx-qr{position:fixed;inset:0;z-index:2147483000;background:#000;display:flex;align-items:center;justify-content:center}'
  + '.lx-qr video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}'
  + '.lx-qr-frame{position:relative;width:66vw;max-width:300px;aspect-ratio:1;border:3px solid rgba(255,255,255,.92);border-radius:18px;box-shadow:0 0 0 100vmax rgba(0,0,0,.55)}'
  + '.lx-qr-hint{position:absolute;left:16px;right:16px;bottom:15vh;text-align:center;color:#fff;font:600 14px/1.4 "Hanken Grotesk",system-ui,sans-serif;text-shadow:0 1px 3px rgba(0,0,0,.8)}'
  + '.lx-qr-x{position:absolute;left:50%;transform:translateX(-50%);bottom:6vh;padding:11px 28px;border-radius:999px;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.5);color:#fff;font:700 14px "Hanken Grotesk",system-ui,sans-serif;cursor:pointer}'
  + '.lx-s2toast{position:fixed;left:16px;right:16px;bottom:96px;z-index:2147483001;padding:12px 14px;border-radius:12px;background:#2a1414;border:1px solid rgba(239,68,68,.45);color:#fca5a5;font:500 13.5px/1.4 "Hanken Grotesk",system-ui,sans-serif;text-align:center}'

  // ---- narrow screens: stack the two cards, and stop anchoring "Available to send" beside the box ----------
  // One column: the banner goes full width with it.
  + '@media (max-width:1080px){.lx-brwrap{grid-template-columns:1fr !important}'
  + S2 + '.br-errslot:not(:empty){width:100% !important;margin-left:0 !important}'
  + S2 + '.br-actions{width:100% !important}}'
  // PHONES: the asset and the amount box cannot share a row. Side by side at 375px the box took 252px and left the
  // asset column ~37px, so the box sat on top of the USDC logo and name. Stacked, each gets the full width, and
  // "Available to send" moves inside the box under the figure, where it still reads as belonging to it.
  + '@media (max-width:720px){'
  + S2 + '.br-io{padding:18px}'
  + SRC + '.br-asset{grid-column:1 / -1 !important}'
  + SRC + '.br-amt{grid-column:1 / -1 !important;min-width:0;width:100% !important;box-sizing:border-box;padding:12px 18px !important}'
  + DST + '.br-amt{transform:none}'
  + S2 + '.br-io > .br-side{grid-template-columns:minmax(0,1fr) auto !important}'
  + SRC + '.lx-balrow{position:static !important;transform:none;flex-direction:row !important;align-items:center;'
  + 'justify-content:space-between;width:100%;margin-top:12px !important;padding-top:12px;border-top:1px solid var(--border)}'
  + SRC + '.lx-balrow::before{margin-right:auto}'
  // A long balance ("134,341,480.97 LUMOS" + MAX) is wider than the box: it pushed MAX out past the edge (RAZA
  // 2026-09-19). The row may wrap now -- the balance and MAX drop to their own right-aligned line, inside the box.
  + SRC + '.lx-balrow{flex-wrap:wrap !important;row-gap:6px;column-gap:10px;box-sizing:border-box;max-width:100%}'
  + SRC + '.lx-balrow .bal{margin-left:auto;min-width:0;flex-wrap:wrap;justify-content:flex-end}'
  // The figure and its dollar value on ONE line -- figure left, value right -- then "Available to send" beneath.
  // Stacked, the box was three rows tall for two facts (RAZA 2026-09-19: "move 1000 to the left and the $value to the
  // right").
  + SRC + '.br-amt{display:grid !important;grid-template-columns:minmax(0,1fr) auto;align-items:center;column-gap:12px}'
  + SRC + '.br-amt .v{grid-column:1;min-width:0}'
  + SRC + '.br-amt .v,' + SRC + '.br-amt .v input{text-align:left !important}'
  + SRC + '.br-amt .usd{grid-column:2;margin-top:0 !important;white-space:nowrap;text-align:right}'
  + SRC + '.lx-balrow{grid-column:1 / -1}'
  // the label keeps one line; a long value ("~5 seconds to claimable") wraps instead of squeezing it
  + '.lx-brs-row{grid-template-columns:20px auto minmax(0,1fr)}'
  + '.lx-brs-k{white-space:nowrap}.lx-brs-v{white-space:normal;font-size:15px}'
  + '}'
  + '<' + '/style>';

// ---- the runtime: only what cannot be CSS ------------------------------------------------------------------
// Written as a real function so node --check validates exactly what ships.
function runtime() {
  var FULL = { USDC: 'USD Coin', USDT0: 'Tether USD', XLM: 'Stellar Lumens', LUMOS: 'LumosCore', AQUA: 'Aquarius',
    yXLM: 'Ultra Stellar yXLM', yUSDC: 'Ultra Stellar yUSDC', SHX: 'Stronghold', BLND: 'Blend', EURC: 'Euro Coin' };

  function el(tag, cls, html) { var e = document.createElement(tag); e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function destNet() {
    var t = document.querySelector('.br-step[data-step="1"] .brd-trigger');
    if (!t) return { name: '', icon: '' };
    var nm = t.querySelector('.nm');
    var img = t.querySelector('img');
    var name = nm ? (nm.textContent || '').trim() : '';
    return { name: /select/i.test(name) ? '' : name, icon: img ? img.getAttribute('src') : '' };
  }

  function build() {
    var step = document.querySelector('.br-step[data-step="2"]');
    if (!step) return false;
    var sides = step.querySelectorAll('.br-io > .br-side');
    if (sides.length < 2) return false;
    var src = sides[0], dst = sides[1];

    if (!src.querySelector('.lx-s2net')) {
      // The source is always Stellar -- this page bridges OUT of the connected Stellar wallet -- so its pill is a
      // label, not a control, and carries no caret that would promise a choice that is not there.
      var srcIcon = src.querySelector('.br-wallet .br-ic img');
      var row = el('div', 'lx-s2net',
        '<span class="lx-s2lbl">From</span>'
        + '<span class="lx-s2pill"><span class="lx-s2ic">' + (srcIcon ? '<img src="' + esc(srcIcon.getAttribute('src')) + '" alt="">' : '') + '</span>'
        + '<span class="lx-s2nm">Stellar</span></span>');
      src.insertBefore(row, src.firstChild);
    }

    if (!dst.querySelector('.lx-s2net')) {
      var drow = el('div', 'lx-s2net',
        '<span class="lx-s2lbl">To</span>'
        + '<button type="button" class="lx-s2pill" data-lxs2dest><span class="lx-s2ic"></span><span class="lx-s2nm"></span><span class="lx-s2cv"></span></button>');
      dst.insertBefore(drow, dst.firstChild);
      // The destination is chosen on step 1, so the pill takes you back there to change it.
      drow.querySelector('[data-lxs2dest]').addEventListener('click', function (e) {
        e.preventDefault();
        var back = step.querySelector('.br-back');
        if (back) back.click();
        setTimeout(function () { var t = document.querySelector('.br-step[data-step="1"] .brd-trigger'); if (t) t.click(); }, 120);
      });
    }

    var wallet = dst.querySelector('.br-wallet.brw-in');
    if (wallet && !dst.querySelector('.lx-s2albl')) {
      dst.insertBefore(el('div', 'lx-s2albl', 'Receiving address'), wallet);
      var hint = el('div', 'lx-s2hint', '');
      if (wallet.nextSibling) dst.insertBefore(hint, wallet.nextSibling); else dst.appendChild(hint);
    }

    [src, dst].forEach(function (side) {
      var a = side.querySelector('.br-asset');
      if (a && !a.querySelector('.lx-s2full')) a.appendChild(el('span', 'lx-s2full', ''));
    });

    // Plain-text labels that change with the user's choices.
    var subs = step.querySelector('.br-sh p');
    if (subs && /Pick your assets/.test(subs.textContent)) {
      subs.textContent = 'Send your assets from one network to another. Choose the asset, amount and destination address.';
    }
    var next = step.querySelector('.br-actions .br-next');
    if (next && (next.textContent || '').trim() === 'Review') next.textContent = 'Review transfer';

    return true;
  }

  function sync() {
    var step = document.querySelector('.br-step[data-step="2"]');
    if (!step) return;
    var d = destNet();
    var pill = step.querySelector('[data-lxs2dest]');
    if (pill) {
      var ic = pill.querySelector('.lx-s2ic'), nm = pill.querySelector('.lx-s2nm');
      if (nm && nm.textContent !== d.name) nm.textContent = d.name || 'Choose network';
      var want = d.icon ? '<img src="' + esc(d.icon) + '" alt="">' : '';
      if (ic && ic.getAttribute('data-src') !== d.icon) { ic.innerHTML = want; ic.setAttribute('data-src', d.icon); }
    }
    var hint = step.querySelector('.lx-s2hint');
    if (hint) {
      var t = d.name ? 'Make sure the address is on ' + d.name : 'Make sure the address is on the destination network';
      if (hint.textContent !== t) hint.textContent = t;
    }
    var input = step.querySelector('.br-addr-in');
    if (input && d.name) {
      var ph = 'Enter ' + d.name + ' address';
      if (input.getAttribute('placeholder') !== ph) input.setAttribute('placeholder', ph);
    }
    // What arrives depends on the route (CCTP -> USDC, LayerZero -> USDT0). The USDT0 face and figure are our own
    // nodes, shown by CSS when the route layer marks <html>; the engine's USDC nodes stay untouched underneath.
    // ANY delivered token now, not only USDT0: NEAR Intents delivers whatever was picked (ETH, POL, WBTC...). The route
    // layer publishes the symbol, its logo and its name on <html>; this draws them. USDC is the engine's own face.
    var de = document.documentElement;
    var arr = de.getAttribute('data-lxroute-asset') || 'USDC';
    // NEAR Intents always draws its own face, USDC included: the engine's USDC face has no picker, so choosing USDC
    // there left the token stuck (RAZA 2026-09-19: 'once I've selected any receiving asset ... I can't change it')
    var viaOther = arr !== 'USDC' || de.getAttribute('data-lxroute') === 'NEAR Intents';
    var logo = de.getAttribute('data-lxroute-logo') || (arr === 'USDT0' ? '/assets/tokens/usdt0.png' : '');
    var sides = step.querySelectorAll('.br-io > .br-side');
    var dside = sides[1];
    if (dside) {
      var da = dside.querySelector('.br-asset');
      if (da && !da.querySelector('.lx-s2ic2')) {
        da.appendChild(el('span', 'lx-s2ic2', '<img src="/assets/tokens/usdt0.png" alt="">'));
        da.appendChild(el('span', 'lx-s2nm2', 'USDT0'));
      }
      if (da && viaOther) {
        var im = da.querySelector('.lx-s2ic2 img'), nm2 = da.querySelector('.lx-s2nm2');
        if (im && logo && im.getAttribute('src') !== logo) im.setAttribute('src', logo);
        if (nm2 && nm2.textContent !== arr) nm2.textContent = arr;
        // NEAR Intents: the token is the user's pick -- the face is the control that changes it (see the picker)
        da.classList.toggle('lx-s2pick', de.getAttribute('data-lxroute') === 'NEAR Intents');
      } else if (da) da.classList.remove('lx-s2pick');
      var dm = dside.querySelector('.br-amt');
      if (dm) {
        var rv = dm.querySelector('.lx-s2recv');
        if (!rv) { rv = el('div', 'lx-s2recv', ''); dm.appendChild(rv); }
        // empty = not quoted yet: a dash, never a 0.00 that would read as a real (and wrong) figure
        var raw = de.getAttribute('data-lxroute-recv') || '';
        var n = parseFloat(raw) || 0;
        // small figures (0.0075 ETH) keep their significant digits; dollar-ish ones read to 2 decimals
        var shown = n > 0 && n < 1 ? n.toPrecision(4) : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
        var txt = raw === '' ? '~ — ' + arr : '~ ' + shown + ' ' + arr;
        if (rv.textContent !== txt) rv.textContent = txt;
      }
    }
    step.querySelectorAll('.br-asset').forEach(function (a) {
      var code = ((a.querySelector('.nm') || {}).textContent || '').trim();
      if (viaOther && dside && dside.contains(a)) code = arr;
      var f = a.querySelector('.lx-s2full');
      // Any other curated asset shows the domain its issuer was verified against -- a real, checked fact about it.
      var full = (viaOther && dside && dside.contains(a) && de.getAttribute('data-lxroute-name')) || FULL[code] || (((window.LX_ASSETS || {})[code] || {}).dom) || '';
      if (f && f.textContent !== full) f.textContent = full;
    });
    // "Balance: 0.030 USDC" sits under a label that already says "Available to send", so the prefix is dropped.
    // Done here, in an observer that runs before paint, because the engine rewrites this text on every refresh.
    try { addScan(step); } catch (_) {}   // the engine can rebuild the address box; put the scan button back
    step.querySelectorAll('.lx-bal-txt').forEach(function (b) {
      var s = b.textContent || '';
      if (/^\s*Balance:\s*/i.test(s)) b.textContent = s.replace(/^\s*Balance:\s*/i, '');
    });
  }

  // ---- phones ---------------------------------------------------------------------------------------------------
  function isMob() { try { return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || ''); } catch (_) { return false; } }
  function toast(msg) {
    var t = el('div', 'lx-s2toast', ''); t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3200);
  }

  // The recipient from an EVM QR code. Wallets show a bare 0x address or an EIP-681 link. In a TOKEN transfer link
  // (ethereum:0xTOKEN@137/transfer?address=0xRECIPIENT) the first address is the token CONTRACT -- taking it would send
  // the funds to the contract -- so an explicit address= parameter always wins.
  function evmAddr(t) {
    t = String(t || '').trim();
    var p = /[?&]address=(0x[0-9a-fA-F]{40})\b/.exec(t); if (p) return p[1];
    var m = /0x[0-9a-fA-F]{40}/.exec(t); return m ? m[0] : '';
  }
  // jsQR is already self-hosted for the Wallet page's scanner; fetched only when someone taps Scan.
  var qrP = null;
  function qrLib() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    if (qrP) return qrP;
    qrP = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = '/assets/vendor/jsqr-1.4.0.min.js';
      s.onload = function () { window.jsQR ? res(window.jsQR) : rej(new Error('Scanner failed to load')); };
      s.onerror = function () { qrP = null; rej(new Error('Scanner failed to load')); };
      document.head.appendChild(s);
    });
    return qrP;
  }
  // The same sheet as the Wallet page's scanner: everything that can end it goes through stop(), so the camera is
  // never left running.
  function scan(net, onFound) {
    if (!window.isSecureContext) { toast('The camera needs a secure (https) connection.'); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('This browser cannot open the camera.'); return; }
    // ONE SCANNER AT A TIME. On touch the same finger can deliver two clicks -- _mobnav re-dispatches the click it
    // suppressed and the native straggler still lands -- which opened two scanners and made two camera requests.
    // Two concurrent requests race, one loses, and its NotAllowedError is reported as a refusal the reader never
    // made: RAZA accepted the prompt on his tablet and still got "Camera permission was declined" (2026-09-21).
    if (document.querySelector('.lx-qr')) return;
    var ov = el('div', 'lx-qr', '');
    ov.innerHTML = '<video playsinline muted autoplay></video><div class="lx-qr-frame"></div>'
      + '<div class="lx-qr-hint">Point at ' + esc(net ? ('a ' + net) : 'the') + ' address QR code</div>'
      + '<button type="button" class="lx-qr-x">Cancel</button>';
    document.body.appendChild(ov);
    var vid = ov.querySelector('video'), stream = null, timer = 0, dead = false;
    function stop() {
      if (dead) return; dead = true; clearTimeout(timer);
      try { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); } catch (_) {}
      try { vid.srcObject = null; } catch (_) {}
      document.removeEventListener('keydown', onKey, true);
      if (ov.parentNode) ov.parentNode.removeChild(ov);
    }
    function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); stop(); } }
    document.addEventListener('keydown', onKey, true);
    ov.querySelector('.lx-qr-x').addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); stop(); });
    var cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
    // ASK FOR THE CAMERA IN THE SAME TURN AS THE TAP. This used to await qrLib() first -- a script fetched over the
    // network -- and only then call getUserMedia, by which time the tap's user activation is long spent. A permission
    // prompt asked for without it can be refused before the reader ever sees it, and that refusal is the same
    // NotAllowedError as a real decline. Both start together now; the decoder is only needed once frames arrive.
    var camP = navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    var libP = qrLib();
    // If the decoder fails to load, the camera must not be left running behind the failure.
    libP.catch(function () { camP.then(function (st) { try { st.getTracks().forEach(function (t) { t.stop(); }); } catch (_) {} }, function () {}); });
    Promise.all([libP, camP]).then(function (both) {
      var dec = both[0], st = both[1];
      return Promise.resolve().then(function () {
        if (dead) { st.getTracks().forEach(function (t) { t.stop(); }); return; }
        stream = st; vid.srcObject = st;
        return vid.play().catch(function () {}).then(function () {
          (function tick() {
            if (dead) return;
            if (vid.readyState === vid.HAVE_ENOUGH_DATA) {
              var w = 480, h = Math.max(1, Math.round(vid.videoHeight * (w / (vid.videoWidth || w))));
              if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
              cx.drawImage(vid, 0, 0, w, h);
              var d = cx.getImageData(0, 0, w, h), r = null;
              try { r = dec(d.data, w, h, { inversionAttempts: 'attemptBoth' }); } catch (_) {}
              if (r && r.data) {
                var a = evmAddr(r.data); stop();
                if (a) onFound(a); else toast('That QR code has no ' + (net || 'EVM') + ' address in it.');
                return;
              }
            }
            timer = setTimeout(tick, 120);
          })();
        });
      });
    }).catch(function (err) {
      stop();
      var n = (err && err.name) || '';
      if (n === 'NotAllowedError' || n === 'SecurityError') toast('Camera permission was declined.');
      else if (n === 'NotFoundError' || n === 'OverconstrainedError') toast('No camera found on this device.');
      else toast((err && err.message) || 'Could not open the camera.');
    });
  }
  // A scan button beside Paste, wherever a camera meets a finger (on a desktop the camera faces the user; Paste is the
  // gesture there). Gated on the DEVICE, not its user agent: Chrome on an Android tablet does not call itself "Mobile",
  // and that is exactly where the clipboard is least reliable -- an overlay from another app can stop Chrome asking for
  // clipboard permission at all (RAZA 2026-09-20), leaving scan and long-press as the only ways in.
  function addScan(step) {
    var touch = false; try { touch = window.matchMedia('(pointer:coarse)').matches; } catch (_) {}
    if (!(touch || isMob()) || !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) return;
    var sides = step.querySelectorAll('.br-io > .br-side'), dst = sides[1]; if (!dst) return;
    var box = dst.querySelector('.br-wallet.brw-in'); if (!box || box.querySelector('.lx-scan')) return;
    var input = box.querySelector('.br-addr-in');
    var b = el('button', 'lx-scan', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/></svg>');
    b.type = 'button'; b.setAttribute('aria-label', 'Scan address QR code'); b.title = 'Scan QR code';
    var paste = box.querySelector('.br-paste');
    if (paste) box.insertBefore(b, paste); else box.appendChild(b);
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      scan(destNet().name, function (a) {
        if (!input) return;
        input.value = a; input.dispatchEvent(new Event('input', { bubbles: true })); input.blur();
      });
    });
  }

  // THE KEYPAD (RAZA 2026-09-19: "hide the keypad if I'm not typing"). A phone only closes it when the field loses
  // focus, and tapping text, a card or empty space does not take focus -- so it stayed up over the page. A tap
  // anywhere that is not itself a field (or the amount box, whose tap focuses its own input) now closes it.
  function wireKeypad() {
    if (window.__lxKbWired) return; window.__lxKbWired = 1;
    document.addEventListener('touchstart', function (e) {
      var a = document.activeElement;
      if (!a || !/^(INPUT|TEXTAREA)$/.test(a.tagName)) return;
      var t = e.target;
      if (t === a || (t && t.closest && t.closest('input,textarea,select,label,.br-amt,.br-paste,.lx-scan'))) return;
      a.blur();
    }, { passive: true, capture: true });
  }

  // THE NETWORK PICKER ON A PHONE opened at a fixed 344px wherever the field was, so it ran under the bottom tab
  // bar (measured: panel to 792px, tab bar from 740px). When it opens, scroll it into the clear space; if the screen
  // is too short for all of it, shorten the panel instead.
  function fitMenu() {
    var m = document.querySelector('.brd.open .brd-menu'); if (!m) return;
    var bar = document.querySelector('.nb-bar');
    var limit = (bar ? bar.getBoundingClientRect().top : window.innerHeight) - 10;
    var r = m.getBoundingClientRect(); if (r.bottom <= limit) return;
    m.style.scrollMarginBottom = Math.max(0, window.innerHeight - limit) + 'px';
    try { m.scrollIntoView({ block: 'nearest' }); } catch (_) { m.scrollIntoView(false); }
    r = m.getBoundingClientRect();
    if (r.bottom > limit) m.style.maxHeight = Math.max(180, Math.floor(limit - r.top)) + 'px';
  }
  function wireMenuFit() {
    var brd = document.querySelector('.br-step[data-step="1"] .brd'); if (!brd || brd.__lxFit) return; brd.__lxFit = 1;
    new MutationObserver(function () { if (brd.classList.contains('open')) setTimeout(fitMenu, 30); })
      .observe(brd, { attributes: true, attributeFilter: ['class'] });
  }

  function start() {
    if (!build()) return false;
    try { addScan(document.querySelector('.br-step[data-step="2"]')); wireKeypad(); if (isMob()) wireMenuFit(); } catch (_) {}
    sync();
    var root = document.querySelector('.bridge-wizard, .br-wizard, .br-card') || document.body;
    new MutationObserver(function () { try { sync(); } catch (_) {} })
      .observe(root, { childList: true, subtree: true, characterData: true });
    // The route choice is published on <html>, outside that subtree.
    new MutationObserver(function () { try { sync(); } catch (_) {} })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-lxroute-asset', 'data-lxroute-recv', 'data-lxroute', 'data-lxroute-logo', 'data-lxroute-name'] });
    return true;
  }

  if (!start()) {
    var tries = 0, iv = setInterval(function () { if (start() || ++tries > 60) clearInterval(iv); }, 150);
  }
}

const JS = '(' + runtime.toString() + ')();';
// Belt and braces: the function above already passed node --check with this file, but a serialised function can
// still be broken by the wrapper, so the emitted text is parsed too before anything is written.
try { new Function(JS); } catch (e) { console.error('  ! step-2 runtime does not parse: ' + e.message); process.exit(1); }
const SCRIPT = '<script id="lx-brstep2">' + JS + '<' + '/script>';

let n = 0, seen = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = 'lumoscore-aptos-' + dev + '.html';
  let data;
  try { data = read(file); } catch (e) { console.error('  ' + file + ': missing — skipped'); continue; }
  const { json, s, e } = getContents(data);
  for (const k of Object.keys(json)) {
    if (!/bridge/.test(k)) continue;
    let h = json[k];
    const before = h;
    // Both injections strip their previous copy first, or a rebuild stacks them.
    h = h.replace(new RegExp('<style id="' + ID + '">[' + B + 's' + B + 'S]*?<' + B + '/style>', 'g'), '');
    h = h.replace(new RegExp('<script id="lx-brstep2">[' + B + 's' + B + 'S]*?<' + B + '/script>', 'g'), '');
    if (h.indexOf('</head>') < 0) { json[k] = h; continue; }
    // LAST in the head so it outranks the CCTP and LayerZero layers' rules for the same nodes.
    h = h.replace('</head>', CSS + '</head>');
    const bi = h.lastIndexOf('</body>');
    if (bi >= 0) h = h.slice(0, bi) + SCRIPT + h.slice(bi);
    seen++;
    if (h !== before) { json[k] = h; n++; }
  }
  const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
  fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
}
console.log('bridge step 2 (reference design): ' + seen + ' bridge page key(s), ' + n + ' changed');
if (!seen) { console.error('  ! no bridge page matched — nothing was wired'); process.exit(1); }
