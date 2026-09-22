// Real on-chain data for the STELLAR dashboard (the network the user connected with).
//  - Network-stats cards: TVL (DefiLlama), Market cap + 24h Volume + XLM price (CoinGecko).
//    (Exact live "assets"/"pools" totals need 60+ paged Horizon calls, so those two cards are
//     repurposed to TVL + Market cap — real single-request network metrics.)
//  - Live activity feed: real recent swaps from Horizon /trades (orderbook + AMM pool), refreshed.
// All three sources are public + CORS-enabled. Runs ONLY when the connected network is Stellar;
// other networks keep their sample data until their APIs are wired. Idempotent.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const SWAP='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10l-3 3 3 3"/><path d="M4 13h11"/><path d="M17 14l3-3-3-3"/><path d="M20 11H9"/></svg>';
const DROP='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>';

// CSS goes in <head> so the "hide value pills until the script paints them" rule applies BEFORE first
// paint. When it was bundled with the script at body-end it loaded too late and the mock pills flashed.
const CSS='<style id="lx-realdata-css">/*lxts:1.1*/'
+'/* B14: the wallet that performed the action, where "via LumosCore" used to repeat the section title.'
+'   Mono and muted, the same treatment every other address on the site gets. */'
+'.lx-actwho{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:12px;'
+'color:var(--text-soft,#8a8fa3);text-decoration:none;display:inline-block}'
+'.lx-actwho{display:inline-flex;align-items:center;gap:6px}'
+'.lx-actwho:hover{color:var(--accent,#ea6a2c)}'
+'.lx-actdot{width:13px;height:13px;border-radius:50%;flex:0 0 13px;display:inline-block}'
+'.act-ic.lx-actasset{background-size:cover;background-position:center;background-repeat:no-repeat;'
+'display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;'
+'color:var(--text-soft,#8a8fa3);overflow:hidden}'
+'/* #15: the per-figure mark. flex:0 0 so a long value can never squeeze it out, and the pill becomes a   two-part row -- icon, then label over value -- rather than a single text column. */.lx-vpill{display:flex!important;align-items:center;gap:9px;min-width:0}.lx-vpt{display:flex;flex-direction:column;gap:2px;min-width:0}.lx-pico{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;  border-radius:8px;background:currentColor}.lx-pico svg{width:15px;height:15px;display:block;color:#fff;filter:drop-shadow(0 0 0 transparent)}/* The tinted square is the icon colour at low alpha, with the glyph itself full strength on top. */.lx-pico{background:color-mix(in srgb, currentColor 16%, transparent)}.lx-pico svg{color:currentColor}@media(max-width:900px){.lx-pico{width:22px;height:22px}.lx-pico svg{width:13px;height:13px}}.greeting-row>.greeting{flex:1 1 auto!important;min-width:0!important}.status-row{display:grid!important;grid-template-columns:auto repeat(4,minmax(0,1fr))!important;gap:10px!important;width:100%!important}.status-row .lx-netcard .lx-netmeta{padding-right:18px}.status-row .lx-vpill .val{font-size:18px!important;font-weight:800!important;letter-spacing:-.2px}.status-row .lx-vpill .lbl{font-size:10.5px!important;letter-spacing:.07em}@media(max-width:1100px){.status-row .lx-vpill .val{font-size:16px!important}}@media(max-width:900px){.status-row .lx-vpill .val{font-size:15px!important}.status-row .lx-vpill .lbl{font-size:9.5px!important}}.page>.market-grid:last-child{margin-bottom:0}.page:has(>.market-grid:last-child){padding-bottom:48px}/* lx-nstats-mobile: the five-column row above is a DESKTOP layout. On a phone it overflows - auto sizes to its content and every 1fr floors at min-content, so the last card runs off screen. Two columns fit, and min-width:0 lets the cards actually shrink into them. */@media (max-width:760px){.status-row{grid-template-columns:repeat(2,minmax(0,1fr))!important}.status-row>.status-pill{min-width:0!important;width:auto!important}.status-row>.status-pill.lx-netcard{grid-column:1 / -1}}.status-row .status-pill{width:auto!important}/* #6: the transaction link at the end of each platform-activity row. Icon only -- the row already says what happened, and a word here would compete with it. */.activity-feed-row .lx-actlink{margin-left:12px;flex:0 0 auto;display:inline-flex;align-items:center;color:var(--text-muted);text-decoration:none;transition:color .12s}.activity-feed-row .lx-actlink:hover{color:var(--accent)}'
+'/* item 7: the per-asset mark, inline with the code it names, sized to the text. */'
// item 28: the blinking dot. A heading that pulses is a permanent attention-grab for something that is
// simply true -- the feed is live whether or not a dot blinks -- and it sat oddly against a static title.
+'.live-pulse{display:none!important}'
// The sentence needed 343px in a 270px column, so EVERY row wrapped, and each one broke at a
// different word -- which is what made the list look unsettled rather than merely tall. 16px fits the
// common lines, the padding hands back another 16px, and <b> keeps each value welded to its ticker so
// a line that still has to break falls between clauses instead of inside a number.
+'.activity-feed-row .act-ic{display:none!important}'
+'.activity-feed-row{padding:14px 16px!important;gap:12px;align-items:center;'
+'transition:background .14s ease}'
+'.activity-feed-row .info{display:flex;flex-direction:column;gap:7px;min-width:0}'
+'.activity-feed-row .time{flex:0 0 auto;min-width:38px;text-align:right}'
+'.activity-feed-row:hover{background:rgba(127,127,140,.055)}'
+'@media(prefers-reduced-motion:reduce){.activity-feed-row{transition:none}}'
+'.activity-feed-row .info .type{font-size:16px;line-height:1.45;letter-spacing:-.005em}'
+'.activity-feed-row .info .type b{white-space:nowrap;font-weight:700}'
// Figures in the tabular face, as everywhere else in the app, so amounts down the column line up.
+'.activity-feed-row .info .type b{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:15px}'
+'.activity-feed-row .info .meta{font-size:13px}'
+'.activity-feed-row .time{font-size:13px;color:var(--text-muted,#8a8fa3);font-variant-numeric:tabular-nums}'
// The link is a way out, not a headline: quiet until the row is under the cursor.
+'.activity-feed-row .lx-actlink{opacity:.45;transition:opacity .14s ease,color .14s ease}'
+'.activity-feed-row:hover .lx-actlink{opacity:1;color:var(--accent,#ea6a2c)}'
+'.lx-actident{flex:0 0 auto;margin-right:5px}'
+'.lx-actmeta{display:flex;align-items:center;gap:8px;min-width:0}'
+'.lx-actwho{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
+'.lx-actverb{flex:0 0 auto;font:700 10px/1 "Hanken Grotesk",system-ui,sans-serif;'
+'text-transform:uppercase;letter-spacing:.06em;padding:4px 7px;border-radius:999px;'
+'background:rgba(127,127,140,.14);color:var(--text-muted,#8a8fa3)}'
+'.lx-actverb.swap{background:rgba(139,123,255,.16);color:#8b7bff}'
// Transfer had been sharing swap's purple, so the two most common kinds in the feed looked identical.
// Green is the one clear gap in this set -- purple, teal, pink, sky, orange, yellow and slate are all
// taken, and the near neighbours of each of those would read as the same tag at 11px.
+'.lx-actverb.transfer{background:rgba(34,197,94,.16);color:#22c55e}'
// The arrow between the two ends of a transfer. Muted, so the addresses stay the thing you read.
+'.lx-actarrow{color:var(--text-soft,#8a8fa3);opacity:.75;margin:0 2px;font-size:12px}'
+'.lx-actverb.lp{background:rgba(45,212,191,.16);color:#2dd4bf}'
+'.lx-actverb.order{background:rgba(244,114,182,.16);color:#f472b6}'
+'.lx-lpneg{color:var(--red,#ff5b5b)}'
+'.lx-lppos{color:var(--green,#35c07f)}'
// The 24h count, pushed to the far end of the card header. margin-left:auto rather than a layout
// change on .market-head, which is shared with other cards and must not move because of this one.
+'.activity-card .market-head .lx-act24{margin-left:auto;flex:0 0 auto;white-space:nowrap;'
+'font-family:"JetBrains Mono",monospace;font-size:11px;font-weight:600;letter-spacing:.03em;'
+'color:var(--text-muted);padding:3px 8px;border:1px solid var(--border);border-radius:999px}'
// The header is not guaranteed to be a flex row on every layout; if it is not, margin-left:auto does
// nothing and the pill would sit under the title. This makes it a row only on the card we touch.
//
// nowrap + min-width:0 is the load-bearing pair. The head ships with flex-wrap:wrap, so once the
// Stellar mark widened the heading past the line the COUNT was the thing that wrapped, and it dropped
// to a line of its own. Now the pill can never wrap; a heading too long for the row shrinks and wraps
// its own text underneath it instead. That matters beyond English -- the French heading is
// "Activité de la plateforme en direct — Stellar", half again as long as the English.
+'.activity-card .market-head{display:flex;align-items:center;gap:10px;flex-wrap:nowrap}'
+'.activity-card .market-head h3{min-width:0}'
// No font-size override here any more. One was added when the heading read "Live Platform Activity —
// Stellar", which needed about 15px more than a 375px row had; dropping "Live" gave back roughly
// double that, so the heading keeps its designed size and the shrink is not carried around for a
// problem that no longer exists. nowrap + min-width:0 above still covers the longer translations.
// Sized from the heading's own font so it tracks the two layouts without a second rule, and nudged up
// a hair because the glyph sits low in its disc.
+'.activity-card .market-head h3 .lx-chainmark{display:inline-block;width:1.05em;height:1.05em;'
+'vertical-align:-.16em;margin:0 .18em 0 .02em;border-radius:50%;object-fit:cover;flex:0 0 auto}'
+'.lx-actverb.xchain{background:rgba(56,189,248,.16);color:#38bdf8}'
+'.lx-actvia{font-weight:500;font-size:.86em;color:var(--text-soft,#8b8b95);white-space:nowrap}'
+'.lx-actverb.mint{background:rgba(234,106,44,.18);color:#ea6a2c}'
+'.lx-actverb.claim{background:rgba(250,204,21,.16);color:#facc15}'
+'.lx-actverb.trust{background:rgba(148,163,184,.18);color:#94a3b8}'
+'.lx-vpill .val.lx-pending{color:transparent;border-radius:5px;min-width:56px;display:inline-block;'
+'background-image:linear-gradient(90deg,rgba(140,140,150,.10),rgba(140,140,150,.22),rgba(140,140,150,.10));'
+'background-size:200% 100%;animation:lxdbxshim 1.2s ease-in-out infinite}'
+'@keyframes lxdbxshim{0%{background-position:200% 0}100%{background-position:-200% 0}}'
+'@media(prefers-reduced-motion:reduce){.lx-vpill .val.lx-pending{animation:none}}'
// item 28: the marks were small enough to read as decoration. The identicon and the asset marks now
// share one size, so a row scans as [who or what] + [what happened] instead of two sizes of dot.
+'.lx-actident{flex:0 0 auto;vertical-align:-6px;margin-right:7px;box-shadow:0 0 0 1px rgba(127,127,140,.22)}'
+'.activity-feed-row .act-inl{width:20px!important;height:20px!important;vertical-align:-5px}'
// item 28: give the rows a little rhythm and a hover, so the list reads as a feed rather than a wall.
+'.activity-feed-row{padding-top:11px!important;padding-bottom:11px!important;transition:background .16s ease}'
+'.activity-feed-row:hover{background:rgba(127,127,140,.06)}'
+'.activity-feed-row .lx-actwho{display:inline-flex;align-items:center;font-variant-numeric:tabular-nums}'
+'.activity-feed-row .lx-actwho:hover{color:var(--accent,#ea6a2c)}'
+'/* The leading mark stays: hiding it on rows with an inline chip blanked nearly the whole feed. */'
+'.act-inl{display:inline-block;width:14px;height:14px;border-radius:50%;vertical-align:-2px;margin-right:5px;background-size:cover;background-position:center;background-repeat:no-repeat;background-color:rgba(127,127,140,.18);flex:0 0 auto}'
+'.activity-feed-row .info .type{overflow-wrap:anywhere}'
// ---- the feed row, redesigned (RAZA 2026-09-19: "too dull and boring") ---------------------------------------------
// glyph | sentence over tag + route + wallet | time over link. The glyph is the row's picture: the asset that moved,
// with the one it became tucked over its lower-right edge (ringed in the card colour so the two read as a pair).
+'.activity-feed-row.lx-fr{display:flex!important;align-items:center;gap:14px;padding:13px 16px!important;position:relative}'
+'.activity-feed-row.lx-fr:hover{background:rgba(127,127,140,.07)}'
+'.lx-fg{position:relative;flex:0 0 42px;width:42px;height:42px;display:block}'
+'.activity-feed-row .lx-fg .act-inl.lx-fgi{position:absolute;margin:0!important;vertical-align:0!important;border-radius:50%}'
+'.activity-feed-row .lx-fg:not(.lx-fg2) .lx-fgi{left:3px;top:3px;width:36px!important;height:36px!important}'
+'.activity-feed-row .lx-fg2 .lx-fga .lx-fgi{left:0;top:0;width:32px!important;height:32px!important}'
+'.activity-feed-row .lx-fg2 .lx-fgb .lx-fgi{right:-1px;bottom:-1px;width:23px!important;height:23px!important;'
+'box-shadow:0 0 0 2.5px var(--surface,var(--bg-2,#141419))}'
// rows with no asset (orders cancelled, trustlines...): the type's icon on a disc tinted in the type's own colour
+'.lx-fgt{display:flex!important;align-items:center;justify-content:center;border-radius:50%;color:#94a3b8;'
+'background:color-mix(in srgb,currentColor 15%,transparent)}'
+'.lx-fgt svg{width:19px;height:19px;display:block}'
+'.lx-fgt.swap{color:#8b7bff}.lx-fgt.transfer{color:#22c55e}.lx-fgt.lp{color:#2dd4bf}.lx-fgt.order{color:#f472b6}'
+'.lx-fgt.xchain{color:#38bdf8}.lx-fgt.mint{color:#ea6a2c}.lx-fgt.claim{color:#facc15}'
+'@media(prefers-reduced-motion:no-preference){.lx-fg{transition:transform .18s ease}.activity-feed-row.lx-fr:hover .lx-fg{transform:scale(1.06)}}'
// a non-Stellar asset (ETH, MON, USDT0...): its logo over a letter, the letter drawn by CSS, never a text node
+'.lx-dimg{position:relative;overflow:hidden;background:rgba(127,127,140,.22)!important}'
+'.lx-dimg::before{content:attr(data-l);position:absolute;inset:0;display:flex;align-items:center;justify-content:center;'
+'font:700 .55em/1 "Hanken Grotesk",system-ui,sans-serif;color:var(--text,#e8e8ee)}'
+'.lx-dimg img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%;background:var(--surface,#141419)}'
+'.lx-fg .lx-dimg::before{font-size:13px}'
// the sentence: the UI face, figures tabular, the connecting words quiet
+'.activity-feed-row.lx-fr .info{flex:1 1 auto;gap:6px}'
+'.activity-feed-row.lx-fr .info .type{font:500 15px/1.4 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-soft,#8a8fa3)}'
+'.activity-feed-row.lx-fr .info .type b{font-family:"Hanken Grotesk",system-ui,sans-serif!important;font-size:15px!important;'
+'font-weight:700;color:var(--text,#ececf1);font-variant-numeric:tabular-nums;letter-spacing:-.01em}'
+'.activity-feed-row.lx-fr .info .type .act-inl{width:18px!important;height:18px!important;vertical-align:-4px;margin-right:4px}'
+'.lx-actto{color:var(--text-soft,#8a8fa3);margin:0 1px}.lx-acton{color:var(--text-soft,#8a8fa3);font-weight:500}'
+'.lx-netlg{width:16px;height:16px;border-radius:4px;vertical-align:-3px;margin-right:4px;object-fit:cover}'
+'.lx-actnote{font-size:12px;font-weight:600;color:#facc15;white-space:nowrap}'
// the route, with its own mark: the one place the three bridges look different
+'.lx-via{display:inline-flex;align-items:center;gap:5px;flex:0 0 auto;font:600 11.5px/1 "Hanken Grotesk",system-ui,sans-serif;'
+'color:var(--text-muted,#a1a1ad);padding:3px 8px 3px 4px;border-radius:999px;border:1px solid var(--border,rgba(127,127,140,.25))}'
+'.lx-via img{width:14px;height:14px;border-radius:50%;object-fit:cover;display:block}'
+'.activity-feed-row.lx-fr .lx-actmeta{flex-wrap:wrap;row-gap:6px}'
+'.lx-frr{flex:0 0 auto;display:flex;flex-direction:column;align-items:flex-end;gap:8px}'
+'.activity-feed-row.lx-fr .lx-frr .time{min-width:0;font-size:12.5px}'
+'.activity-feed-row.lx-fr .lx-actlink{margin-left:0}'
// ONE colour for cross-chain, whatever the bridge (it had been two: CCTP rows used a separate class)
+'.lx-actverb.bridge{background:rgba(56,189,248,.16);color:#38bdf8}'
+'@media(max-width:760px){.activity-feed-row.lx-fr{gap:11px;padding:12px 12px!important}.lx-fg{flex-basis:36px;width:36px;height:36px}'
+'.activity-feed-row .lx-fg:not(.lx-fg2) .lx-fgi{width:32px!important;height:32px!important;left:2px;top:2px}'
+'.activity-feed-row .lx-fg2 .lx-fga .lx-fgi{width:28px!important;height:28px!important}'
+'.activity-feed-row .lx-fg2 .lx-fgb .lx-fgi{width:20px!important;height:20px!important}'
+'.activity-feed-row.lx-fr .info .type,.activity-feed-row.lx-fr .info .type b{font-size:14px!important}}'
// the waiting row: the same rhythm as a real one, saying nothing (shares the shimmer the stat pills use)
+'.lx-actskel{display:inline-block;height:15px;border-radius:6px;vertical-align:-2px;'
+'background-image:linear-gradient(90deg,rgba(140,140,150,.10),rgba(140,140,150,.22),rgba(140,140,150,.10));'
+'background-size:200% 100%;animation:lxdbxshim 1.2s ease-in-out infinite}'
+'.lx-actskel-s{height:11px;border-radius:5px}'
+'@media(prefers-reduced-motion:reduce){.lx-actskel{animation:none}}'
+'.lx-frwait .lx-fgt{background:rgba(127,127,140,.14)}'
+'.status-row{opacity:0;animation:lxnsrev 0s linear 3s forwards}@keyframes lxnsrev{to{opacity:1}}.status-row.lx-ready{opacity:1!important;animation:none;transition:opacity .3s ease}'
+'</style>';
// ---- cross-chain rows: one format for every route (RAZA 2026-09-19) -----------------------------------------------
// "for CCTP you haven't mentioned via CCTP. Also i need same tag color for cross-chain, no matter what the bridge. Also
// show logo of the destination asset." Every cross-chain row -- CCTP, LayerZero, NEAR Intents -- is built here, so they
// read alike: what was paid -> what arrived (with its logo) on which chain (with its logo), and the route as a badge.
//
// Sources, all from the chain, nothing invented:
//   the shared bridge record (/lxapi/bridgetx?routes=all) -- every route, verified server-side  -> lxXcRow
//   for a transfer the record has not taken yet: NEAR Intents' deposit account + 1Click status, or LayerZero's `lx:lz`
//   memo + the wallet's nearest USDT0 burn (its dst_eid names the chain)                          -> lxXc
// A NEAR Intents transfer that swapped first is TWO transactions (the `lx:ni` swap carrying the fee, then the deposit);
// the record lists it under the swap, so the deposit row is hidden (see _brBurn in the feed) -- one transfer, one row.
// Serialised with toString(), so `node --check` on this file checks the code that ships; runs inside the feed's closure
// and uses its amt/aic/esc/j.
function lxXcBuild(p) {
  // p: {from, srcAmt, srcCode, srcIss, out, asset, dest, via, note}
  var NI_LOCAL = { NEAR: 1, ETH: 1, WETH: 1, USDC: 1, USDT: 1, USDT0: 1, WBTC: 1, cbBTC: 1, DAI: 1, LINK: 1, UNI: 1, AAVE: 1,
    ARB: 1, GMX: 1, OP: 1, POL: 1, AVAX: 1, BERA: 1, MON: 1, XPL: 1 };
  function dlogo(sym) { return NI_LOCAL[sym] ? '/assets/tokens/ni/' + sym + '.png' : ''; }
  // a logo that is not a Stellar asset: an <img> over a letter drawn by CSS (a text node here would be repainted as a
  // ticker badge by the site's logo healer)
  function dimg(sym) {
    var u = dlogo(sym), l = esc(String(sym || '?').charAt(0).toUpperCase());
    return '<span class="act-inl lx-dimg" data-l="' + l + '">' + (u ? '<img src="' + u + '" alt="" onerror="this.remove()">' : '') + '</span>';
  }
  var net = String(p.dest || ''), key = net.toLowerCase().replace(/\s+/g, '');
  var netImg = net ? '<img class="lx-netlg" src="/assets/networks/' + esc(key) + '.png" alt="" onerror="this.remove()">' : '';
  var src = p.srcCode ? ('<b>' + (p.srcAmt > 0 ? amt(+p.srcAmt) + ' ' : '') + aic(p.srcCode, p.srcIss || '') + esc(p.srcCode) + '</b>') : '';
  var dst = p.asset ? ('<b>' + (p.out > 0 ? amt(+p.out) + ' ' : '') + dimg(p.asset) + esc(p.asset) + '</b>') : '';
  var type = (src ? src + ' <span class="lx-actto">→</span> ' : '') + (dst || '<b>' + esc(net || 'another chain') + '</b>')
    + (dst && net ? ' <span class="lx-acton">on</span> <b class="lx-actnet">' + netImg + esc(net) + '</b>' : '')
    + (p.note ? ' <span class="lx-actnote">' + esc(p.note) + '</span>' : '');
  return { cls: 'xchain', act: 'Cross-chain', from: p.from || '', via: p.via || '', type: type,
    pair: { a: { code: p.srcCode || '', iss: p.srcIss || '' }, b: p.asset ? { img: dlogo(p.asset), code: p.asset } : null } };
}
var LX_C_USDC = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
// a row of the shared bridge record, any route
function lxXcRow(br, fallbackFrom) {
  var route = br.route || 'CCTP';
  var srcCode = br.srcCode || 'USDC';
  var srcAmt = br.srcAmount != null ? +br.srcAmount : (+br.gross || +br.amount || 0);
  var note = route === 'NEAR Intents' && br.niStatus && br.niStatus !== 'SUCCESS'
    ? (br.niStatus === 'REFUNDED' ? 'refunded' : (br.niStatus === 'FAILED' ? 'failed' : 'in progress')) : '';
  return lxXcBuild({ from: br.from || fallbackFrom, srcAmt: srcAmt, srcCode: srcCode, srcIss: srcCode === 'USDC' ? LX_C_USDC : '',
    out: +br.amount || 0, asset: br.asset || (route === 'LayerZero' ? 'USDT0' : 'USDC'), dest: br.destName || '', via: route, note: note });
}
function lxXc(o, t, ops, done) {
  var NI_DEP = 'GDJ4JZXZELZD737NVFORH4PSSQDWFDZTKW3AIDKHYQG23ZXBPDGGQBJK';
  var EID = { 30101: 'Ethereum', 30110: 'Arbitrum', 30111: 'Optimism', 30109: 'Polygon', 30362: 'Berachain', 30339: 'Ink',
    30367: 'Hyperliquid', 30390: 'Monad', 30295: 'Flare', 30280: 'Sei', 30398: 'MegaETH', 30383: 'Plasma' };
  var NI_CHAIN = { eth: 'Ethereum', arb: 'Arbitrum', base: 'Base', pol: 'Polygon', op: 'Optimism', avax: 'Avalanche',
    bera: 'Berachain', monad: 'Monad', plasma: 'Plasma' };
  var recs = (t && t._embedded && t._embedded.records) || [];
  var tx = (recs[0] && recs[0].transaction) || {};
  var memo = String(tx.memo || '');
  var from = (recs[0] && recs[0].source_account) || o.from || '';
  function code(x) { return (x.asset_type === 'native' || !x.asset_code) ? 'XLM' : x.asset_code; }

  // ---- NEAR Intents: the deposit ----
  var dep = ops.filter(function (x) { return x.type === 'payment' && x.to === NI_DEP; })[0];
  if (dep) {
    var c = code(dep), base = { from: from, srcAmt: +dep.amount, srcCode: c, srcIss: dep.asset_issuer || '', via: 'NEAR Intents' };
    if (tx.memo_type === 'id' && /^[0-9]{1,20}$/.test(memo)) {
      Promise.all([
        j('/lxapi/oneclick?op=status&depositAddress=' + NI_DEP + '&depositMemo=' + memo),
        window.__lxNiTok || (window.__lxNiTok = j('/lxapi/oneclick?op=tokens').catch(function () { window.__lxNiTok = null; return null; }))
      ]).then(function (p) {
        var s = p[0] || {}, toks = (p[1] && p[1].tokens) || [];
        var q = s.quoteResponse || {}, dst = (q.quoteRequest || {}).destinationAsset;
        var tk = toks.filter(function (x) { return x.assetId === dst; })[0];
        if (!tk) return;
        var sd = s.swapDetails || {};
        base.out = s.status === 'SUCCESS' ? +(sd.amountOutFormatted || 0) : +((q.quote || {}).amountOutFormatted || 0);
        base.asset = tk.symbol; base.dest = NI_CHAIN[tk.blockchain] || tk.blockchain;
        base.note = s.status === 'REFUNDED' ? 'refunded' : (s.status === 'SUCCESS' ? '' : 'in progress');
        done(lxXcBuild(base));
      }).catch(function () {});
    }
    base.dest = 'NEAR Intents';
    return lxXcBuild(base);
  }
  if (memo === 'lx:ni') return { skip: true };

  // ---- CCTP, when the shared record does not have it (RAZA 2026-09-20: a row reading just "Platform activity") ------
  // A CCTP fee is its own transaction, and `ops` here has already dropped payments to the fee collector -- so for a
  // USDC-sourced transfer NOTHING is left to describe and the row kept its placeholder text. It is normally described
  // from the shared record, but that registration is made by the sending page and can simply not happen (the tab was
  // closed, the call failed): measured on production, one transfer out of four was missing. So the burn is found the
  // same way LayerZero's is -- the payer's nearest USDC deposit_for_burn -- and the pair is registered as well, so
  // every other reader of the record gets it too.
  if (memo === 'lx:cctp' || !ops.length) {
    var DOM = { 0: 'Ethereum', 1: 'Avalanche', 2: 'Optimism', 3: 'Arbitrum', 5: 'Solana', 6: 'Base', 7: 'Polygon', 8: 'Sui', 11: 'Linea', 14: 'World Chain' };
    var cAt = Date.parse((recs[0] && recs[0].created_at) || o.created_at || 0);
    j('https://horizon.stellar.org/accounts/' + from + '/operations?order=desc&limit=30').then(function (a) {
      var best = null, gap = 12e5;
      ((a && a._embedded && a._embedded.records) || []).forEach(function (x) {
        if (x.type !== 'invoke_host_function' || (x.parameters || []).length < 6) return;
        var burn = (x.asset_balance_changes || []).filter(function (b) { return b.type === 'burn' && b.asset_code === 'USDC'; })[0];
        if (!burn) return;
        var d = Math.abs(Date.parse(x.created_at) - cAt);
        if (d < gap) { gap = d; best = { op: x, burn: burn }; }
      });
      // nothing found to describe it with: settle on the generic label rather than leave the row waiting
      if (!best) { done({ cls: 'swap', type: 'Platform activity' }); return; }
      var dom = -1, s = ''; try { s = atob(best.op.parameters[4].value); } catch (_) { s = ''; }
      if (s.length >= 8 && s.charCodeAt(3) === 3) dom = ((s.charCodeAt(4) << 24) >>> 0) + (s.charCodeAt(5) << 16) + (s.charCodeAt(6) << 8) + s.charCodeAt(7);
      // put the pair in the shared record, so this is the last time anyone has to work it out from the chain
      try {
        fetch('/lxapi/bridgetx', { method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ feeHash: o.transaction_hash, burnHash: best.op.transaction_hash }) }).catch(function () {});
      } catch (_) {}
      done(lxXcBuild({ from: from, out: +best.burn.amount, asset: 'USDC', dest: DOM[dom] || 'another chain', via: 'CCTP' }));
    }).catch(function () {});
    // Only the memo PROVES this is a bridge fee. Without one, a fee-only transaction could be a curated-listing
    // payment, so nothing is claimed until the burn above is actually found -- the row simply waits.
    return memo === 'lx:cctp' ? lxXcBuild({ from: from, asset: 'USDC', dest: 'another chain', via: 'CCTP' }) : null;
  }

  // ---- LayerZero ----
  if (memo === 'lx:lz') {
    var at = Date.parse((recs[0] && recs[0].created_at) || o.created_at || 0);
    j('https://horizon.stellar.org/accounts/' + from + '/operations?order=desc&limit=30').then(function (a) {
      var best = null, gap = 12e5;
      ((a && a._embedded && a._embedded.records) || []).forEach(function (x) {
        if (x.type !== 'invoke_host_function') return;
        var burn = (x.asset_balance_changes || []).filter(function (b) { return b.type === 'burn' && b.asset_code === 'USDT0'; })[0];
        if (!burn) return;
        var d = Math.abs(Date.parse(x.created_at) - at);
        if (d < gap) { gap = d; best = { op: x, burn: burn }; }
      });
      // No burn within the window: the swap into USDT0 happened but the send never did (an abandoned or failed
      // attempt). That is a swap, and saying "cross-chain to another chain" would claim a transfer that never left.
      if (!best) {
        var sw = ops.filter(function (x) { return /^path_payment/.test(x.type) && x.to && x.to === x.from; })[0];
        if (sw) done(describeOp(sw));
        return;
      }
      var eid = 0;
      (best.op.parameters || []).forEach(function (p) {
        if (eid || p.type !== 'Map') return;
        var s = ''; try { s = atob(p.value); } catch (_) { return; }
        var k = s.indexOf('dst_eid'); if (k < 0) return;
        var v = k + 8;   // "dst_eid" is 7 bytes, padded to 8; then the value: 4-byte type (3 = u32), 4-byte u32
        if (s.charCodeAt(v + 3) !== 3) return;
        eid = ((s.charCodeAt(v + 4) << 24) >>> 0) + (s.charCodeAt(v + 5) << 16) + (s.charCodeAt(v + 6) << 8) + s.charCodeAt(v + 7);
      });
      done(lxXcBuild({ from: from, out: +best.burn.amount, asset: 'USDT0', dest: EID[eid] || 'another chain', via: 'LayerZero' }));
    }).catch(function () {});
    return lxXcBuild({ from: from, asset: 'USDT0', dest: 'another chain', via: 'LayerZero' });
  }
  return null;
}

// ---- the feed row (RAZA 2026-09-19: "Make it more appealing. its too dull and boring") ------------------------------
// A row now LEADS with what moved: the asset's logo, and for a swap or a cross-chain transfer the asset it became
// overlapping it -- so the column scans as pictures, not as a wall of monospace. The sentence beside it is set in the
// UI face with the figures tabular; the type tag, the route (with its own mark) and the wallet sit under it; time and
// the explorer link on the right. Nothing blinks: a pulsing "live" dot was taken out on purpose (item 28).
function lxFeedRow(r) {
  var VIA = { CCTP: '/assets/tokens/circle.png', LayerZero: '/assets/tokens/layerzero.png', 'NEAR Intents': '/assets/tokens/ni/NEAR.png' };
  function gi(x) {
    if (x.img != null) {
      return '<span class="act-inl lx-dimg lx-fgi" data-l="' + esc(String(x.code || '?').charAt(0).toUpperCase()) + '">'
        + (x.img ? '<img src="' + x.img + '" alt="" onerror="this.remove()">' : '') + '</span>';
    }
    return aic(x.code, x.iss || '').replace('class="act-inl ', 'class="act-inl lx-fgi ');
  }
  // not read yet: a shimmer where the sentence will be, rather than a claim about what happened
  if (!r.type) {
    return '<div class="activity-feed-row lx-fr lx-frwait" data-lx-noswap="1"><span class="lx-fg lx-fgt" aria-hidden="true"></span>'
      + '<div class="info"><div class="type"><span class="lx-actskel" style="width:62%"></span></div>'
      + '<div class="meta lx-actmeta"><span class="lx-actskel lx-actskel-s" style="width:84px"></span>' + (r.who ? actWho(r.who) : '') + '</div></div>'
      + '<div class="lx-frr"><div class="time">' + r.when + '</div></div></div>';
  }
  var glyph = (r.pair && r.pair.a && r.pair.a.code)
    ? '<span class="lx-fg' + (r.pair.b ? ' lx-fg2' : '') + '" aria-hidden="true"><span class="lx-fga">' + gi(r.pair.a) + '</span>'
      + (r.pair.b ? '<span class="lx-fgb">' + gi(r.pair.b) + '</span>' : '') + '</span>'
    : '<span class="lx-fg lx-fgt ' + esc(r.cls || '') + '" aria-hidden="true">' + (r.ic || '') + '</span>';
  var via = r.via ? ('<span class="lx-via">' + (VIA[r.via] ? '<img src="' + VIA[r.via] + '" alt="">' : '') + 'via ' + esc(r.via) + '</span>') : '';
  var meta = r.who
    ? ('<div class="meta lx-actmeta">' + (r.act ? ('<span class="lx-actverb ' + esc(r.cls || '') + '">' + esc(r.act) + '</span>') : '') + via
      + actWho(r.who) + ((r.to && r.to !== r.who) ? ('<span class="lx-actarrow" aria-hidden="true">→</span>' + actWho(r.to)) : '') + '</div>')
    : '<div class="meta"></div>';
  return '<div class="activity-feed-row lx-fr" data-lx-noswap="1">' + glyph
    + '<div class="info"><div class="type">' + r.type + '</div>' + meta + '</div>'
    + '<div class="lx-frr"><div class="time">' + r.when + '</div>'
    + '<a class="lx-actlink" href="https://stellar.expert/explorer/public/tx/' + esc(r.hash) + '" target="_blank" rel="noopener" title="View transaction">' + XPI + '</a></div>'
    + '</div>';
}

// The logos actually shipped in assets/tokens/ni (see _nilogos.js), read at BUILD time and baked into the page, so a
// token gets its logo the moment its file exists -- no second list to keep in step by hand.
const NI_FILES = (() => { const o = {}; try { fs.readdirSync(require('path').join(__dirname, '..', 'assets', 'tokens', 'ni')).forEach((f) => { const m = f.match(/^([A-Za-z0-9._-]+).png$/); if (m) o[m[1]] = 1; }); } catch (e) {} return o; })();
function withNiFiles(src) { const out = src.replace(/var NI_LOCAL = {[^}]*};/, 'var NI_LOCAL = ' + JSON.stringify(NI_FILES) + ';'); if (out === src) throw new Error('NI_LOCAL not found'); return out; }
const SCRIPT='<script id="lx-realdata">(function(){'
+ withNiFiles(lxXcBuild.toString()) + ';' + 'var LX_C_USDC="' + LX_C_USDC + '";' + lxXcRow.toString() + ';' + lxXc.toString() + ';' + lxFeedRow.toString() + ';'
+'if(window.__lxRealData)return;window.__lxRealData=1;'
+'function net(){try{return (localStorage.getItem("lumos.network")||localStorage.getItem("lumos.chain")||"").toLowerCase();}catch(_){return "";}}'
+'if(net()!=="stellar")return;'                        // Stellar-only for now
+'var SWAP=\''+SWAP+'\',DROP=\''+DROP+'\';'
+'function j(u){return fetch(u).then(function(r){if(!r.ok)throw new Error(r.status);return r.json();});}'
+'function abbr(n){n=+n||0;var a=Math.abs(n);if(a>=1e9)return (n/1e9).toFixed(2)+"B";if(a>=1e6)return (n/1e6).toFixed(2)+"M";if(a>=1e3)return (n/1e3).toFixed(1)+"K";return String(Math.round(n));}'
+'function usd(n){return "$"+abbr(n);}'
// toFixed, NOT toPrecision — the feed showed "9e-7 TGM" (scientific notation).
//
// Sub-1 amounts are also CUT after three decimals, with an ellipsis saying so. Seven decimals is what
// the ledger stores, and printing all of them put "0.00998 XLM → 0.747725 SCOP" over two lines and
// broke the row. Three decimals is enough to tell one trade from another; anyone who needs the exact
// figure has the transaction link at the end of the row.
+'function amt(n){n=+n||0;var a=Math.abs(n);'
+'if(a>=1e9)return (n/1e9).toFixed(2)+"B";'
+'if(a>=1e6)return (n/1e6).toFixed(2)+"M";'
+'if(a>=1e3)return (n/1e3).toFixed(1)+"K";'
+'if(a>=1)return (Math.round(n*100)/100).toString();'
+'if(a>0){var s=n.toFixed(7).replace(/0+$/,"").replace(/\\.$/,"");'
+'if(!s||s==="0")return "<0.0000001";'
// A run of leading zeros is collapsed the way exchanges write it: 0.0000998 becomes 0.0(3)998, where
// the subscript counts the zeros the "0.0" is standing in for. Reading 0.0000998 means counting zeros
// in a 10px monospace row, which is exactly what the notation exists to stop.
//
// Only from three zeros up. At two, "0.009" is already short and 0.0(1)9 would be longer AND harder.
+'var z=/^(-?)0\\.(0+)([0-9]+)$/.exec(s);'
+'if(z&&z[2].length>=3){var SUB="\\u2080\\u2081\\u2082\\u2083\\u2084\\u2085\\u2086\\u2087\\u2088\\u2089";'
+'var hid=z[2].length-1, tag=String(hid).split("").map(function(d){return SUB.charAt(+d);}).join("");'
+'return z[1]+"0.0"+tag+z[3].slice(0,3);}'
+'var dot=s.indexOf("."); if(dot<0||s.length<=dot+4)return s;'
+'var head=s.slice(0,dot+4);'
// Truncated, never rounded: 0.00998 reads 0.009, not 0.01. A feed row should not report a number
// larger than the one on the ledger, however slightly.
+'if(/[1-9]/.test(head.slice(dot+1)))return head+"\\u2026";'
// Three decimals of a very small amount is just "0.000", which says nothing. Those keep three
// SIGNIFICANT digits instead, so a tiny trade still shows what it was.
+'var m=/^(-?0\\.0*)(\\d+)$/.exec(s);'
+'if(m)return m[1]+m[2].slice(0,3)+(m[2].length>3?"\\u2026":"");'
+'return s;}'
+'return "0";}'
+'function price(n){n=+n||0;return "$"+(n<1?n.toFixed(4):n.toFixed(2));}'
+'function ago(t){var s=Math.max(0,(Date.now()-new Date(t).getTime())/1000);if(s<60)return Math.floor(s)+"s";if(s<3600)return Math.floor(s/60)+"m";if(s<86400)return Math.floor(s/3600)+"h";return Math.floor(s/86400)+"d";}'
+'function esc(s){return (String(s==null?"":s).replace(/[&<>]/g,function(c){return c==="&"?"&amp;":c==="<"?"&lt;":"&gt;";})).split(String.fromCharCode(39)).join("&#39;");}'
// Rebuild the whole stats row atomically (keeps the network logo card, replaces the 4 value cards).
// This sidesteps the logo-painter (which mangles individual pills) and the re-skin entirely.
+'var PICO={'
+'"Assets":["#f7b733",\'<ellipse cx="14.8" cy="8.6" rx="4.4" ry="2.1"/><path d="M10.4 8.6v3.4c0 1.16 1.97 2.1 4.4 2.1s4.4-.94 4.4-2.1V8.6"/><ellipse cx="9.2" cy="14.4" rx="4.4" ry="2.1"/><path d="M4.8 14.4v3.4c0 1.16 1.97 2.1 4.4 2.1s4.4-.94 4.4-2.1v-3.4"/>\'],'
+'"Pools":["#38bdf8",\'<path d="M12 3.4l3.9 4.7a5.1 5.1 0 1 1-7.8 0z"/><ellipse cx="12" cy="17.6" rx="7.4" ry="2.5"/><path d="M8.6 15.9c.9.5 2.1.8 3.4.8s2.5-.3 3.4-.8"/>\'],'
+'"Trades":["#a855f7",\'<path d="M4.8 9.2h13.6M15.4 6.2l3 3-3 3"/><path d="M19.2 14.8H5.6M8.6 11.8l-3 3 3 3"/>\'],'
+'"Accounts":["#2dd4bf",\'<circle cx="12" cy="8.7" r="3.5"/><path d="M5.5 19.4a6.5 6.5 0 0 1 13 0"/>\']};'
+'function pico(lbl){var e=PICO[lbl];if(!e)return "";'
+'return \'<span class="lx-pico" style="color:\'+e[0]+\'" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">\'+e[1]+\'</svg></span>\';}'
+'function vpill(lbl,val,tip){var _p=(val==="\\u2014"||val==="\\u2026")?" lx-pending":"";return \'<span class="status-pill lx-vpill" data-lx-noswap=""\'+(tip?\' title="\'+tip+\'"\':"")+\'>\'+pico(lbl)+\'<span class="lx-vpt"><span class="lbl">\'+lbl+\'</span><span class="val\'+_p+\'">\'+val+\'</span></span></span>\';}'
+'function rebuildStats(v){var row=document.querySelector(".status-row");if(!row)return;var net=row.querySelector(".lx-netcard");'
// keep the LIVE netcard node (do NOT snapshot its HTML or mark the row noswap) so mc-engine can still
// rebrand it aptos->stellar; only the value pills are rebuilt (each is its own data-lx-noswap pill).
+'[].slice.call(row.querySelectorAll(".status-pill")).forEach(function(p){if(p!==net)p.parentNode.removeChild(p);});'
+'var frag=document.createElement("div");frag.innerHTML='
+'vpill("Assets",v.assets,"Every asset ever issued on Stellar")'
+'+vpill("Pools",v.pools,"Liquidity pools on the Stellar AMM")'
+'+vpill("Trades",v.trades,v.dayTip)'
+'+vpill("Accounts",v.accounts,(v.accountsExact?v.accountsExact+" \\u2014 e":"E")+"very account ever funded on Stellar, a running total rather than a daily figure");while(frag.firstChild)row.appendChild(frag.firstChild);'
+'row.classList.add("lx-ready");}'
// ---- stat cards ----
+'var _lxX=null,_lxNS=null,_lxPS=null;'
+'function stats(){'
+'Promise.all([j("/lxapi/xlm").catch(function(){return null;}),j("/lxapi/netstats").catch(function(){return null;})])'
+'.then(function(res){if(res[0])_lxX=res[0];if(res[1])_lxNS=res[1];paintStats();}).catch(function(){});'
+'j("/lxapi/poolstats").catch(function(){return null;}).then(function(p){if(p){_lxPS=p;paintStats();}}).catch(function(){});'
+'}'
+'function paintStats(){var x=_lxX||{};var ns=_lxNS;var ps=_lxPS;'
+'var cg={usd:x.usd,usd_24h_change:x.chg24,usd_market_cap:x.mcap,usd_24h_vol:x.vol24};'
// Publish it: _dashtop.js needs the same price and 24h change, and CoinGecko's free tier is a few
// calls a minute -- two components each fetching the same object is how that budget gets spent.
+'try{window.__lxCG=cg;window.dispatchEvent(new CustomEvent("lx:cg"));}catch(_){}'
// #2: the strip used to be TVL, market cap and 24h volume -- three prices, none of which say anything
// about the chain a trader is about to trade on. These four do: how much there is to trade, where, how
// busy the place was yesterday, and how many accounts exist. All of them are ledger facts.
+'var _n=function(x){return (x==null||!isFinite(x))?"\\u2014":Math.round(x).toLocaleString("en-US");};'
// Past a million the digits stop being readable at a glance and start being counted; 2dp keeps it
// honest to ~0.05%. Below that, exact -- these are the figures people cross-check.
+'var _na=function(x){if(x==null||!isFinite(x))return "\\u2014";var a=Math.abs(x);'
+'if(a>=1e9)return (x/1e9).toFixed(2)+"B";if(a>=1e6)return (x/1e6).toFixed(2)+"M";return _n(x);};'
+'var _day="";try{if(ns&&ns.ts)_day="On "+new Date(ns.ts*1000).toLocaleDateString("en-US",{timeZone:"UTC",month:"short",day:"numeric"})+" (UTC), the last full day";}catch(_){}'

+'var _v={assets:(ns&&ns.assets)?_n(ns.assets):"\\u2014",'
+'pools:(ps&&ps.pools)?_n(ps.pools):"\\u2014",'
+'trades:(ns&&ns.trades)?_n(ns.trades):"\\u2014",'
+'accounts:(ns&&ns.accounts)?_na(ns.accounts):"\\u2014",'
// the exact total, for the tooltip
+'accountsExact:(ns&&ns.accounts)?_n(ns.accounts):"",'
+'dayTip:_day};'
+'var _old=null;try{_old=JSON.parse(localStorage.getItem("lumos.netstats")||"null");}catch(_){}'
+'if(_old&&!_old.length){for(var _k in _v){if(_v[_k]==="\\u2014"&&_old[_k]&&_old[_k]!=="\\u2014")_v[_k]=_old[_k];}}'
+'rebuildStats(_v);'
+'var _keep={};for(var _k2 in _v){if(_v[_k2]&&_v[_k2]!=="\\u2014")_keep[_k2]=_v[_k2];}'
+'try{localStorage.setItem("lumos.netstats",JSON.stringify(_keep));}catch(_){}'   // cache last real values so the next load shows them instantly (no blank/loading flash)
+'}'
// ---- live activity feed (real swaps) ----
+'var LX_FEEACCT="GAMZFXIJD5E3PNRFCG6VPXCJNUOZAP5BY2P3MU3ZXXUSVM2UY5P6LJKD";'
+'var XPI=\'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>\';'
+'function acode(o,p){return (o[p+"_asset_type"]==="native"||!o[p+"_asset_code"])?"XLM":o[p+"_asset_code"];}'
// Describe the operation that earned the fee. A path payment IS the swap; an offer is an order; a
// plain payment is a transfer. Anything else is named by its own type rather than guessed at.
+'function describeOp(o){'
+'if(!o)return null;'
+'if(o.type&&o.type.indexOf("path_payment")===0)'
// The DESTINATION asset of a path payment has no field prefix -- it is asset_type/asset_code, not
// dest_asset_*. acode(o,"") builds o["_asset_type"], which is always undefined, so every swap printed
// its destination as XLM regardless of what was actually received.
+'return {ic:SWAP,cls:"swap",act:"Swap",type:"<b>"+amt(+o.source_amount)+" "+aic(acode(o,"source"),o.source_asset_issuer||"")+esc(acode(o,"source"))+"</b> \\u2192 <b>"+amt(+o.amount)+" "+aic((o.asset_type==="native"||!o.asset_code)?"XLM":o.asset_code,o.asset_issuer||"")+esc((o.asset_type==="native"||!o.asset_code)?"XLM":o.asset_code)+"</b>",'
+'acode:acode(o,"source"),aiss:(o.source_asset_issuer||""),bcode:((o.asset_type==="native"||!o.asset_code)?"XLM":o.asset_code),biss:(o.asset_issuer||""),inl:1};'
+'if(o.type==="payment"&&o.asset_issuer&&o.asset_issuer===o.from)'
+'return {ic:DROP,cls:"mint",act:"Mint",type:"<b>"+amt(+o.amount)+" "+aic(o.asset_code,o.asset_issuer)+esc(o.asset_code)+"</b> issued",inl:1};'
+'if(o.type==="payment")'
// cls is "transfer", not "swap": both tags were reading the same purple, so a transfer and a swap
// were indistinguishable at a glance. from/to are carried through so the row can name both ends --
// a transfer with only one address does not say who was paid, which is the half that matters.
+'return {ic:SWAP,cls:"transfer",act:"Transfer",from:(o.from||""),to:(o.to||""),type:"<b>"+amt(+o.amount)+" "+aic((o.asset_type==="native"||!o.asset_code)?"XLM":o.asset_code,o.asset_issuer||"")+esc((o.asset_type==="native"||!o.asset_code)?"XLM":o.asset_code)+"</b>",inl:1};'
+'if(o.type&&o.type.indexOf("offer")>=0)'
+'{var oamt=+o.amount||0, isNew=String(o.offer_id||"0")==="0";'
+'var pair=aic(acode(o,"selling"),o.selling_asset_issuer||"")+esc(acode(o,"selling"))+" / "+aic(acode(o,"buying"),o.buying_asset_issuer||"")+esc(acode(o,"buying"));'
+'return {ic:DROP,cls:"order",act:(oamt===0?"Order cancelled":(isNew?"Order placed":"Order updated")),'
+'type:(oamt===0?("<b>"+pair+"</b>"):("<b>"+amt(oamt)+" "+pair+"</b>")),inl:1};}'
+'if(o.type&&o.type.indexOf("liquidity_pool")===0){'
+'var dep=o.type.indexOf("deposit")>=0;'
+'var res=(dep?(o.reserves_deposited||o.reserves_max):(o.reserves_received||o.reserves_min))||[];'
+'var lp=[];'
+'for(var li=0;li<res.length&&li<2;li++){var ra=res[li]||{};'
+'var rs=String(ra.asset||"native");'
+'var rc=rs==="native"?"XLM":rs.split(":")[0];'
+'var ri=rs==="native"?"":(rs.split(":")[1]||"");'
+'lp.push("<b><span class="+(dep?"lx-lppos>+":"lx-lpneg>-")+amt(+ra.amount)+"</span> "+aic(rc,ri)+esc(rc)+"</b>");}'
+'return {ic:DROP,cls:"lp",act:(dep?"Liquidity Added":"Liquidity Withdrawn"),'
// The verb lives in the tag now, so the amount line starts with the numbers rather than repeating a
// word the tag beside it already says.
+'type:(lp.length?lp.join(" \u00b7 "):(dep?"Added liquidity":"Removed liquidity")),'
+'inl:lp.length?1:0};}'
+'if(o.type==="invoke_host_function")'
+'return {ic:SWAP,cls:"xchain",act:"Cross-chain",type:"Cross-chain transfer"};'
+'if(o.type==="create_claimable_balance")'
+'return {ic:DROP,cls:"claim",act:"Claimable",type:"Payment set aside to be claimed"};'
+'if(o.type==="change_trust")'
+'return {ic:DROP,cls:"trust",act:"Trustline",type:"Trustline "+esc(String(o.asset_code||""))};'
+'return {ic:SWAP,cls:"swap",type:esc(String(o.type||"Activity").split("_").join(" "))};}'
// A 5x3 block identicon inside a 22px circle is 11 rectangles in about 380 usable pixels -- there is
// no room for the pattern to read as anything, so it came out as static. Two hues from the address
// hash across a disc, with a soft top light, reads as an avatar at that size and still gives every
// address its own colour.
+'function iavatar(a,size){a=String(a||"");size=size||20;'
// FNV-1a, byte for byte the hash _accountpage.js uses -- the two faces must agree.
+'function ih(t){var v=2166136261;for(var i=0;i<t.length;i++){v^=t.charCodeAt(i);v=(v*16777619)>>>0;}return v>>>0;}'
+'var h=ih(a),hue=h%360,hue2=(hue+52)%360,cells="";'
+'for(var x=0;x<3;x++)for(var y=0;y<5;y++){'
+'if(!((ih(a+":"+x+":"+y)>>>3)&1))continue;'
+'cells+=\'<rect x="\'+(x*8)+\'" y="\'+(y*8)+\'" width="8" height="8"/>\';'
+'if(x<2)cells+=\'<rect x="\'+((4-x)*8)+\'" y="\'+(y*8)+\'" width="8" height="8"/>\';}'
// ids are per-address: two avatars in one row must not share a gradient or a clip path.
+'var gid="lxav"+h,cid="lxac"+h;'
+'return \'<svg class="lx-actident" width="\'+size+\'" height="\'+size+\'" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">\''
+'+\'<defs><linearGradient id="\'+gid+\'" x1="0" y1="0" x2="1" y2="1">\''
+'+\'<stop offset="0%" stop-color="hsl(\'+hue+\',62%,52%)"/><stop offset="100%" stop-color="hsl(\'+hue2+\',60%,38%)"/>\''
+'+\'</linearGradient><clipPath id="\'+cid+\'"><circle cx="20" cy="20" r="20"/></clipPath></defs>\''
+'+\'<g clip-path="url(#\'+cid+\')"><rect width="40" height="40" fill="url(#\'+gid+\')"/>\''
+'+\'<g fill="rgba(255,255,255,.92)">\'+cells+\'</g></g></svg>\';}'
+'function idot(a){a=String(a||"");var h=0;for(var i=0;i<a.length;i++){h=(h*31+a.charCodeAt(i))>>>0;}'
+'var h1=h%360,h2=(h1+120)%360;'
+'return \'<span class="lx-actdot" style="background:linear-gradient(135deg,hsl(\'+h1+\',62%,55%),hsl(\'+h2+\',62%,45%))"></span>\';}'
+'function shortAddr(a){a=String(a||"");return a.length>12?(a.slice(0,4)+"\\u2026"+a.slice(-4)):a;}'
+'function feedLogo(code,iss){'
+'try{var L=window.__lxLogos||{};'
+'if(iss&&L[code+"-"+iss])return L[code+"-"+iss];'
// XLM has no issuer, and the registry keys it plainly.
+'if(code==="XLM")return (L.XLM||"/assets/tokens/xlm.png");'
// A CODE-ONLY KEY, which this lookup used to walk straight past. The registry stores some marks under
// the bare code ("USDC") rather than "CODE-ISSUER", and the scan below only matches keys beginning
// "CODE-" - so for those the feed concluded there was no logo, drew the letter, and the site's logo
// healer then painted the real mark over it a moment later. That swap was the flicker: every chip
// that changed was USDC, its mark was never in this registry under an issuer key, and what replaced
// the letter was an inline SVG the feed had not painted at all.
//
// Same precision as the scan underneath it, which already matches on code alone - so this adds no
// new risk of showing one issuer's mark for another's ticker, and removes a guaranteed repaint.
+'if(L[code])return L[code];'
// Fall back to a code-only match when the registry holds one, which it does for our own mints.
+'var ks=Object.keys(L);for(var i=0;i<ks.length;i++){if(ks[i].indexOf(code+"-")===0)return L[ks[i]];}'
// The launchpad icon manifest: the only source that has our own mints. /lxapi/assetlogo answers
// "asset not in toml" for them and stellar.expert has no image either, so without this a token we
// minted ourselves was the one thing the feed could not draw.
+'if(FMAN){if(iss&&FMAN[code+"-"+iss])return FMAN[code+"-"+iss];'
+'var mk=Object.keys(FMAN);for(var j=0;j<mk.length;j++){if(mk[j].indexOf(code+"-")===0)return FMAN[mk[j]];}}'
+'}catch(_){}return "";}'
// Loaded once, then the feed repaints. Static JSON, so the browser caches it across pages.
+'var FMAN=null,_fManGo=0;'
+'function fManLoad(){if(_fManGo)return;_fManGo=1;'
+'fetch("/assets/tokens/launchpad-icons.json").then(function(r){return r.ok?r.json():null;}).then(function(m){'
+'var out={};Object.keys(m||{}).forEach(function(k){var v=m[k];var img=(v&&typeof v==="object")?v.image:v;if(img)out[k]=img;});'
+'FMAN=out;try{paintFeedIcons();}catch(_){}'
+'}).catch(function(){FMAN={};});}'
// THE FEED FLICKERED BECAUSE EACH MARK WAS DRAWN TWICE. A chip starts empty, paintFeedIcons gives it
// a coloured LETTER when no logo is known yet, and the logo replaces that letter when its request
// lands. With ~100 marks resolving a few at a time over about three seconds, the section spent those
// seconds visibly swapping letters for logos on every refresh.
//
// _fAsked only records that a request went out, so a pending lookup and a lookup that came back with
// nothing were indistinguishable — and the letter was drawn for both. _fDone separates them: the
// letter is now only drawn once we KNOW there is no logo coming, so a mark is painted once.
//
// _fT is the safety valve. If a request never settles the chip would otherwise stay blank forever,
// so after a bounded wait the letters are allowed regardless — a letter is a fine end state, it is
// only a bad intermediate one.
+'var _fQ=[],_fA=0,_fAsked={},_fDone={},_fT=0;'
+'function _fPump(){while(_fA<4&&_fQ.length){_fA++;(_fQ.shift())();}}'
// Bounded to 4 in flight and asked once per code, so a feed that refreshes every 60s does not re-ask.
// LUMOS must be seeded before the fill runs. Its issuer's home_domain resolves to lumosdao.io -- a
// DIFFERENT project -- so asking the toml for it paints someone else's mark on our own token. The
// wallet page already seeds the brand flame for exactly this reason; the dashboard did not, and the
// /^assets// guard below only protects a seed that is already there.
+'try{(window.__lxLogos=window.__lxLogos||{});var _LK="LUMOS-GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S";if(!window.__lxLogos[_LK])window.__lxLogos[_LK]="assets/favicon.png";paintFeedIcons();}catch(_){}'
+'function feedFillLogos(){try{'
+'var els=[].slice.call(document.querySelectorAll("#activityList .lx-actasset"));'
+'var want={};els.forEach(function(e){var c=e.getAttribute("data-c")||e.getAttribute("data-lxc")||"";'
+'var i=e.getAttribute("data-i")||"";'
+'if(c&&i&&!_fAsked[c]&&!((window.__lxLogos||{})[c+"-"+i]))want[c]=i;});'
+'var codes=Object.keys(want); if(!codes.length)return;'
+'codes.forEach(function(c){_fAsked[c]=1;_fQ.push(function(){'
+'fetch("/lxapi/assetlogo?v=2&asset="+encodeURIComponent(c+"-"+want[c])).then(function(r){return r.ok?r.json():null;})'
+'.then(function(d){var u=d&&d.image;'
+'if(u&&!/^assets\\//.test(((window.__lxLogos||{})[c+"-"+want[c]])||"")){(window.__lxLogos=window.__lxLogos||{})[c+"-"+want[c]]=u;try{paintFeedIcons();}catch(_){}}'
// Marked settled on BOTH paths — resolved and rejected — because "we asked and got nothing back" and
// "we asked and it failed" both mean the letter is now the right answer for this asset.
+'},function(){}).then(function(){_fDone[c]=1;_fA--;_fPump();try{paintFeedIcons();}catch(_){}});});});'
+'_fPump();}catch(_){}}'
+'function lxActHue(c){c=String(c||"?");var h=0;for(var i=0;i<c.length;i++)h=(h*31+c.charCodeAt(i))%360;return "hsl("+h+",52%,42%)";}'
+'function paintFeedIcons(){'
+'try{fManLoad();}catch(_){}'
+'try{var els=document.querySelectorAll(".lx-actasset");'
+'for(var i=0;i<els.length;i++){var e=els[i];'
+'if(e.getAttribute("data-lxpainted")==="1")continue;'
+'var u=feedLogo(e.getAttribute("data-c")||"",e.getAttribute("data-i")||"");'
+'if(u){e.style.backgroundImage="url(\'"+u+"\')";e.textContent="";e.style.backgroundColor="";e.style.color="";e.setAttribute("data-lxpainted","1");}'
// The letter is only drawn once the logo lookup has SETTLED (or was never going to happen, or the
// safety valve has fired). Drawing it while a request is in flight is what produced the swap.
//
// KEYED ON HAVING AN ISSUER, NOT ON _fAsked. The first version tested _fAsked and still produced 49
// letter-to-logo swaps, because this function runs BEFORE feedFillLogos queues the request for a
// freshly inserted batch — so nothing had been asked yet, the chip looked settled, and the letter was
// drawn a moment before the logo arrived. An asset with an issuer is one a lookup is coming for,
// whether or not it has been queued at this instant, which is the property that actually matters.
// THE SAFETY VALVE HAS TO BE PER CHIP, which a second measurement forced. As one global deadline it
// fired 2.5s after the first request while rows were still arriving until about five seconds — so
// every chip inserted after the deadline drew its letter immediately and then swapped to its logo,
// and the swap count did not move. Each chip now carries the moment it was first seen and waits its
// own 2.5s, so a late row gets the same grace as an early one.
+'else if(!e.textContent){var _c=e.getAttribute("data-c")||"",_i2=e.getAttribute("data-i")||"";'
+'var _seen=+(e.getAttribute("data-lxseen")||0);'
+'if(!_seen){_seen=Date.now();e.setAttribute("data-lxseen",String(_seen));}'
// TWO SOURCES FEED A MARK, and waiting on only one is what kept the swap alive through three
// attempts. feedLogo() reads window.__lxLogos (the per-asset /lxapi/assetlogo request, tracked by
// _fDone) and ALSO falls back to FMAN, the launchpad icon manifest, which is fetched separately.
//
// Measuring which chips actually swapped is what found it: every one was USDC, and its logo was not
// in __lxLogos at all - it arrived from the manifest, after the per-asset request had already
// settled empty and the letter had been drawn. So a chip is pending until BOTH have answered.
+'var _pending=_c&&(FMAN===null||(_i2&&!_fDone[_c]))&&(Date.now()-_seen<12000);'
// One repaint pass is kept scheduled while anything is still waiting, so a chip whose lookup never
// settles is not left blank -- it simply falls back to the letter when its own grace expires.
+'if(_pending){if(_fT)clearTimeout(_fT);_fT=setTimeout(function(){try{paintFeedIcons();}catch(_){}},700);}'
+'if(!_pending){var _l=(e.getAttribute("data-l")||"");if(_l){e.textContent=_l;e.style.backgroundColor=lxActHue(_c);e.style.color="#fff";}}}'
+'try{var _b=e.closest&&e.closest("b");if(_b&&(e.getAttribute("data-c")||"")!=="XLM"&&/^G[A-Z2-7]{55}$/.test(e.getAttribute("data-i")||"")){_b.style.cursor="pointer";}}catch(_){}}'
+'}catch(_){}}'
// item 7: one mark per asset, inline with the code it names.
+'function aic(code,iss){ code=String(code||""); if(!code)return "";'
+'return \'<span class="act-inl lx-actasset" data-lxc="\'+esc(code)+\'" data-c="\'+esc(code)+\'"'
+' data-i="\'+esc(iss||"")+\'" data-l="\'+esc(code.charAt(0).toUpperCase())+\'"></span>\'; }'
// One address link, so a row can render two of them without the markup being written out twice.
+'function actWho(a){return \'<a class="lx-actwho" href="/account/stellar/\'+esc(a)+\'" title="\'+esc(a)+\'">\'+iavatar(a,20)+esc(shortAddr(a))+\'</a>\';}'
+'if(!document.__lxActNav){document.__lxActNav=1;document.addEventListener("click",function(ev){'
+'try{var t=ev.target;if(!t||!t.closest)return;if(!t.closest("#activityList"))return;'
+'if(t.closest(".lx-actlink")||t.closest(".lx-actwho"))return;'
+'var b=t.closest("b");if(!b)return;var sp=b.querySelector(".lx-actasset");if(!sp)return;'
+'var c=sp.getAttribute("data-c")||"",i=sp.getAttribute("data-i")||"";'
+'if(!c||c==="XLM"||!/^G[A-Z2-7]{55}$/.test(i))return;'
+'ev.preventDefault();ev.stopPropagation();location.href="/trade/stellar/"+c+"-"+i;}catch(_){}},true);}'
// the row itself is lxFeedRow (a real function, above SCRIPT): a logo glyph, the sentence, tag + route + wallet
+'function feedRow(r){ return lxFeedRow(r); }'
// How many distinct transactions came through LumosCore in the last 24 hours. The COUNT only -- no
// volume, no value -- because that is the one number this panel can state without qualification: it is
// what the feed itself is built from, deduplicated by hash across both sources.
//
// Added to the card header from script rather than to the markup, so it lands on both layouts from one
// place and simply does not appear if the data never arrives, instead of sitting there reading zero.
//
// SOURCE_CAP is the honest part. Both sources are capped -- 100 beacon rows, 100 fee payments -- so a
// day busier than that could not be counted, only under-reported. If the answer touches the cap it is
// shown as "100+" rather than as a precise number that is quietly wrong.
+'var SOURCE_CAP=100;'
// The Stellar mark, in the heading, before the word it belongs to: "Live Platform Activity — (*) Stellar".
//
// Inserted from script rather than written into the container markup, for the same reason the 24h pill
// is: the heading string is ALSO an i18n dictionary key, verbatim. Putting an <img> inside it would
// change the key and drop every non-English visitor back to raw English.
//
// It anchors on the word rather than on a position, so the four translated headings -- which all end
// in "Stellar" -- get the mark in the right place too.
+'function paintChainMark(){'
+'var h3=document.querySelector(".activity-card .market-head h3"); if(!h3)return;'
+'if(h3.querySelector(".lx-chainmark"))return;'
+'var nodes=[].slice.call(h3.childNodes);'
+'for(var k=0;k<nodes.length;k++){ var n=nodes[k];'
+'if(n.nodeType!==3)continue;'
+'var t=n.nodeValue||"", p=t.lastIndexOf("Stellar"); if(p<0)continue;'
+'var img=document.createElement("img"); img.className="lx-chainmark";'
+'img.src="/assets/tokens/xlm.png"; img.alt=""; img.setAttribute("aria-hidden","true");'
// data-lxc is the logo healer's opt-out. Without it _logoguard.js treats this as an asset icon it
// should resolve and swaps the source out from under us.
+'img.setAttribute("data-lxc","XLM");'
+'var tail=document.createTextNode(t.slice(p)); n.nodeValue=t.slice(0,p);'
+'n.parentNode.insertBefore(tail,n.nextSibling); n.parentNode.insertBefore(img,tail);'
+'return; } }'
+'function paint24(rows){'
+'paintChainMark();'
+'var head=document.querySelector(".activity-card .market-head"); if(!head)return;'
+'var cut=Date.now()-864e5, n=0;'
+'rows.forEach(function(o){ var t=Date.parse(o.created_at); if(t>=cut)n++; });'
+'var el=head.querySelector(".lx-act24");'
+'if(!el){ el=document.createElement("span"); el.className="lx-act24"; head.appendChild(el); }'
+'el.textContent=(n>=SOURCE_CAP?(SOURCE_CAP+"+"):String(n))+" in 24h";'
+'el.title=(n===1?"1 transaction":n+" transactions")+" through LumosCore in the last 24 hours";'
+'}'
+'function feed(){'
+'var list=document.getElementById("activityList");if(!list)return;'
+'j("/lxapi/act").then(function(av){'
+'return ((av&&av.items)||[]).map(function(x){'
+'return {transaction_hash:x.hash,from:x.addr,created_at:new Date(x.ts).toISOString()};});'
+'}).catch(function(){return [];}).then(function(acts){'
// join=transactions costs no extra request and brings back each payment's transaction, which is what
// makes the operation-count test below possible without a second round trip per row.
// limit=100, not 40: the 24h counter below counts these too, and a limit sized for the eight visible
// rows would cap that number without ever saying it had.
+'return j(\"https://horizon.stellar.org/accounts/\"+LX_FEEACCT+\"/payments?order=desc&limit=100&join=transactions\").then(function(d){'
+'d.__acts=acts;return d;});'
+'}).then(function(d){'
+'var recs=((d._embedded&&d._embedded.records)||[]).filter(function(o){'
// fees paid TO the collector, and never the collector shuffling its own balance
+'if(!(o.to===LX_FEEACCT&&o.from&&o.from!==LX_FEEACCT))return false;'
// A LONE payment to the collector is not platform activity -- it is somebody paying us for something.
// Every real action bundles the fee WITH the operation it is a fee for, so a fee-paying swap, mint or
// bridge is always 2+ operations; a curated-listing fee is one payment and nothing else. Measured
// against the collector's last 40 inbound payments: 34 were 2-44 ops and every one was a real action,
// 1 was a single op and it was a listing fee. Without this the row still appeared, and appeared as an
// unlabelled "Platform activity" stub, because the only operation it had was the one the describer
// deliberately skips.
// ...except LayerZero's deferred fee: a USDT0-sourced send pays its fee alone, in its own `lx:lz` transaction
+'var tx=o.transaction; if(tx&&tx.operation_count===1&&tx.memo!=="lx:lz")return false;'
+'return true;});'
+'if(!recs.length&&!((d&&d.__acts)||[]).length){list.innerHTML=\'<div class="activity-feed-row" style="justify-content:center;color:var(--text-soft);font-size:14px">No platform activity yet.</div>\';return;}'
+'var seenH={},merged=[];'
+'((d&&d.__acts)||[]).concat(recs).forEach(function(o){'
+'var hh=o.transaction_hash; if(!hh||seenH[hh])return; seenH[hh]=1; merged.push(o);});'
+'merged.sort(function(a,b){return new Date(b.created_at)-new Date(a.created_at);});'
+'paint24(merged);'
+'var use=merged.slice(0,50);'
// Paint what we already know immediately, then upgrade each row once its transaction is read.
// A ROW SAYS NOTHING UNTIL IT KNOWS (RAZA 2026-09-20: "There's this flash bug on Dashboard page when it loads").
// Every row was painted as "Platform activity" and then replaced one by one as its transaction was read -- so the feed
// opened as a column of identical placeholder text. The row is drawn as a loading shimmer instead: the time, the wallet
// and the row's shape are already known and stay put, and nothing is claimed about what happened until it is.
+'var rows=use.map(function(o){return {ic:SWAP,cls:"",type:"",pending:1,who:o.from,when:ago(o.created_at),hash:o.transaction_hash};});'
// ONE REPAINT PER BURST, NOT ONE PER ROW (RAZA 2026-09-22, Android tablet: "the dashboard kinda lags for ~5 seconds
// until becoming smooth"). Every row that resolved rebuilt the WHOLE list and queued five more icon passes, so ~50 rows
// arriving one by one meant ~50 rebuilds and ~250 passes -- measured at 8,000+ attribute writes in three seconds, each
// one a style/layout recalculation, which a tablet feels as stutter. Rows resolving together now share one repaint
// (at most every 120ms), and the delayed icon passes are re-armed rather than stacked.
+'var _frT=0,_frP=[];'
+'function _feedRender(){ if(_frT) return; _frT=setTimeout(function(){ _frT=0;'
+' list.innerHTML=rows.filter(function(r){ return !r.hide; }).map(feedRow).join("");paintFeedIcons();feedFillLogos();'
+' _frP.forEach(clearTimeout); _frP=[300,1200,3000,6000,10000].map(function(ms){ return setTimeout(paintFeedIcons,ms); }); },120); }'
+'list.innerHTML=rows.map(feedRow).join("");paintFeedIcons();feedFillLogos();'
+'[300,1200,3000,6000,10000].forEach(function(ms){setTimeout(paintFeedIcons,ms);});'
+'var C_USDC="GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";'
+'var _brMap=null,_brBurn={};'
+'function _brLoad(){ if(_brMap)return Promise.resolve(_brMap);'
+'return fetch("/lxapi/bridgetx?limit=200&routes=all").then(function(r){return r.ok?r.json():null;}).then(function(d){'
+'var m={},bm={}; ((d&&d.rows)||[]).forEach(function(x){ if(x&&x.feeHash)m[x.feeHash]=x; if(x&&x.burnHash)bm[x.burnHash]=x; }); _brMap=m; _brBurn=bm; return m;'
+'}).catch(function(){ _brMap={}; return _brMap; }); }'
+'var _eQ=[],_eA=0;'
+'function _ePump(){ while(_eA<6&&_eQ.length){ _eA++; (_eQ.shift())(); } }'
+'use.forEach(function(o,i){ _eQ.push(function(){'
// join=transactions brings the memo, which is how a LayerZero or NEAR Intents transfer is recognised (lxXc)
+'j("https://horizon.stellar.org/transactions/"+o.transaction_hash+"/operations?limit=20&join=transactions").then(function(t){'
+'var ops=((t._embedded&&t._embedded.records)||[]).filter(function(x){'
// the fee payment itself is not the story; the operation beside it is
+'return !(x.type==="payment"&&x.to===LX_FEEACCT);});'
+'var _mint=ops.some(function(x){return x.type==="create_account";})&&ops.some(function(x){return x.type==="set_options"&&String(x.master_key_weight)==="0";});'
+'var pick=(_mint&&ops.filter(function(x){return x.type==="payment"&&x.asset_issuer&&x.asset_issuer===x.from;})[0])'
+'||ops.filter(function(x){return x.type&&x.type.indexOf("path_payment")===0;})[0]'
+'||ops.filter(function(x){return x.type&&x.type.indexOf("liquidity_pool")===0;})[0]'
+'||ops.filter(function(x){return x.type==="invoke_host_function";})[0]'
+'||ops.filter(function(x){return x.type==="payment"&&x.asset_issuer&&x.asset_issuer===x.from;})[0]'
+'||ops.filter(function(x){return x.type&&x.type.indexOf("offer")>=0;})[0]'
+'||ops.filter(function(x){return x.type==="create_claimable_balance";})[0]'
+'||ops[0];'
+'var _br=(_brMap||{})[o.transaction_hash];'
// A registered cross-chain transfer. Described from the registry because the transaction itself holds
// only the fee payment -- the burn that gives it meaning is a separate transaction.
// The shared record now holds LayerZero and NEAR Intents rows too; they say what they delivered, so they are
// described from it (what was paid, what arrived, where, which route) rather than as USDC.
// Every route through ONE builder (lxXcRow), so CCTP rows also say "via CCTP" and all share the Cross-chain tag.
// A transfer the record lists under ANOTHER transaction (a NEAR Intents deposit whose fee rode the swap before it) is
// the same transfer twice -- hidden here, the record's own row stands for it.
+'var _dup=!_br&&(_brBurn||{})[o.transaction_hash];'
+'var de=_br?lxXcRow(_br,o.from||""):((_dup&&_dup.feeHash&&_dup.feeHash!==o.transaction_hash)?{skip:true}:null);'
// LayerZero and NEAR Intents transfers not in the record yet are recognised from the chain (lxXc); put() may refine
+'if(!de){ try{ de=lxXc(o,t,ops,function(d2){ put(d2); }); }catch(_){ de=null; } }'
+'if(!de)de=describeOp(pick);'
// EVERY ROW SETTLES. A waiting row that never resolves would shimmer for good, which is worse than the placeholder it
// replaced -- so a transaction nothing can describe lands on the honest generic label instead.
+'if(!de)de={ic:SWAP,cls:"swap",type:"Platform activity"}; put(de);'
+'function put(de){'
+'if(de.skip){ rows[i].hide=1; }else{'
+'rows[i].ic=de.ic||SWAP;rows[i].cls=de.cls;rows[i].type=de.type;rows[i].act=de.act||"";rows[i].acode=de.acode||"";rows[i].aiss=de.aiss||"";'
// the logo glyph: what moved, and (swap / cross-chain) what it became
+'rows[i].via=de.via||"";rows[i].pair=de.pair||(de.acode?{a:{code:de.acode,iss:de.aiss||""},b:(de.bcode?{code:de.bcode,iss:de.biss||""}:null)}:null);'
// The row is seeded with the transaction's source account; the operation knows who actually paid and
// who was paid, so prefer those once it has been read.
+'if(de.from)rows[i].who=de.from;rows[i].to=de.to||""; }'
+'_feedRender(); }'
// the fetch itself failed: put() lives inside the then() above and cannot be reached from here, so the row is settled
// directly -- a waiting row must never be left waiting.
+'}).catch(function(){ try{ rows[i].ic=SWAP; rows[i].cls="swap"; rows[i].type="Platform activity"; rows[i].pending=0;'
+'  _feedRender(); }catch(_){} })'
+'.then(function(){ _eA--; _ePump(); });});});'
+'_brLoad().then(function(){ _ePump(); });'
+'}).catch(function(){});}'
// A cache written by a previous build is an ARRAY, not this object, so the shape check is what stops a
// warm start restoring a strip of undefineds.
// The other way to get a strip of undefineds is for THIS list to fall behind the pills: prep() renders
// before the fetch lands, so any key rebuildStats reads that is missing here paints the literal string
// "undefined" until the network answers. That is why the key list lives in NSKEYS and is used both to
// build the placeholders and to restore them -- rename a pill, change it in one place.
+'var NSKEYS=["assets","pools","trades","accounts"];'
+'function prep(){var c=null;try{c=JSON.parse(localStorage.getItem("lumos.netstats")||"null");}catch(_){}'
+'var _d={dayTip:"",accountsExact:""};for(var i=0;i<NSKEYS.length;i++)_d[NSKEYS[i]]="\\u2026";'
+'if(c&&!c.length&&typeof c==="object"){for(var k in _d){if(c[k]&&c[k]!=="\\u2014")_d[k]=c[k];}}'
+'rebuildStats(_d);}'
// paintChainMark runs here as well as from paint24: the mark belongs to the heading, not to the data,
// so it must not wait on a fetch that might never land. The later calls cover the language switcher,
// which rewrites the heading's text and would otherwise take the mark with it. Idempotent, so the
// repeats cost nothing.
+'function run(){prep();stats();feed();paintChainMark();'
+'[400,1500,4000].forEach(function(ms){setTimeout(paintChainMark,ms);});}'
+'if(document.readyState!=="loading")run();else document.addEventListener("DOMContentLoaded",run);'
+'setInterval(feed,60000);setInterval(stats,45000);'
+'})();</script>';

let n=0;
for(const dev of ['desktop','mobile']){
  const file=`lumoscore-aptos-${dev}.html`;
  let data; try{ data=read(file); }catch(e){ continue; }
  const {json,s,e}=getContents(data);
  for(const k of Object.keys(json)){
    let h=json[k];
    if(h.indexOf('activityList')<0 || h.indexOf('status-row')<0) continue;   // dashboard only
    h=h.replace(/<style id="lx-realdata-css">[\s\S]*?<\/style>/g,'').replace(/<script id="lx-realdata">[\s\S]*?<\/script>/g,'');  // idempotent
    if(h.indexOf('</head>')>=0) h=h.replace('</head>',CSS+'</head>');   // CSS in head -> applies before first paint (no flash)
    const bi=h.lastIndexOf('</body>'); if(bi<0) continue;
    json[k]=h.slice(0,bi)+SCRIPT+h.slice(bi); n++;
  }
  const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
  fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
}
console.log('real-data (Stellar) injected on '+n+' dashboard page keys');
