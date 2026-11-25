// "RECENT MINTS" ON THE TRADE MAIN PAGE (RAZA 2026-11-24). On /trade/<network> the "All Trading Pairs" section becomes two
// columns: the pairs table on the left (narrower; its last columns -- Day High / Low and 7D trend -- now sit behind a
// sideways scroll inside the table), and on the right the 10 newest LumosCore Launchpad tokens of that network, newest
// first: logo, market cap ($), minted by (short wallet, links to its public page), 24h trades and volume, and a live
// green / red triangle for the latest trade (buy / sell). A prominent "Launch Token" button heads the panel.
// Narrow desktops put the panel above the table; phones get a swipeable row of cards above "All Trading Pairs".
// Data: /lxapi/recentmints?net=<network> (30 s edge cache), polled every 30 s; a row whose latest trade changed flashes.
// Layout only -- CSS grid on the existing section, nothing of the page's own markup is moved. Loaded on every page by
// the middleware; does nothing outside /trade/<network>.
(function () {
  if (window.__lxRM) return; window.__lxRM = 1;
  var NET = (/^\/trade\/(stellar|xrpl|near)\/?$/.exec(location.pathname) || [])[1];
  if (!NET) return;
  var CUR = { stellar: 'XLM', xrpl: 'XRP', near: 'NEAR' }[NET];
  var LAST = {}, LOGO = {}, PEND = {}, DATA = null, mounted = false;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) {
    if (n == null || !isFinite(n)) return '—'; n = +n;
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'; if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'; if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    if (n >= 1) return '$' + n.toFixed(2); if (n > 0) return '$' + n.toPrecision(2); return '$0';
  }
  function ago(t) { var s = Math.max(0, (Date.now() - t) / 1000); if (s < 60) return 'now'; if (s < 3600) return Math.floor(s / 60) + 'm'; if (s < 86400) return Math.floor(s / 3600) + 'h'; if (s < 2592000) return Math.floor(s / 86400) + 'd'; if (s < 31536000) return Math.floor(s / 2592000) + 'mo'; return Math.floor(s / 31536000) + 'y'; }
  function short(a) { a = String(a || ''); return a.length > 12 ? a.slice(0, 4) + '…' + a.slice(-4) : a; }
  function pagePath(id) { return '/trade/' + NET + '/' + encodeURIComponent(id); }
  function walletPath(a) { return '/account/' + NET + '/' + encodeURIComponent(a); }
  function xcur(c) { if (c.length <= 3) return c; var h = ''; for (var i = 0; i < c.length; i++) h += c.charCodeAt(i).toString(16).toUpperCase(); while (h.length < 40) h += '0'; return h; }
  // v11 (RAZA 2026-11-24 "the green light is too AI"): a small flame in the logo's colours, gently flickering.
  var FLAME = '<svg class="lx-rm-flame" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="lxrmFg" x1="0" y1="1" x2="0" y2="0">'
    + '<stop offset="0" stop-color="#e8452c"/><stop offset=".55" stop-color="#ff7a1a"/><stop offset="1" stop-color="#ffd166"/></linearGradient></defs>'
    + '<path fill="url(#lxrmFg)" d="M12 2.5c.6 2.9 2.4 4.9 4.1 6.7 1.6 1.7 2.9 3.4 2.9 5.9A7 7 0 0 1 12 22a7 7 0 0 1-7-6.9c0-2.1.9-3.9 2.3-5.2.2 1.6.9 2.8 2.1 3.4-.4-3.9.9-7.6 2.6-10.8z"/>'
    + '<path fill="#ffe9a8" opacity=".85" d="M12.2 12.2c.9 1.3 2.3 2.4 2.3 4.3A2.6 2.6 0 0 1 12 19.2a2.6 2.6 0 0 1-2.6-2.6c0-1.6 1.2-2.9 2.8-4.4z"/></svg>';
  var ROCKET = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>';
  // v16 (RAZA 2026-11-25 "never liked it ... make it more professional and modernistic"): a plain plus, not a rocket
  var PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  function css() {
    if (document.getElementById('lx-rm-css')) return;
    var s = document.createElement('style'); s.id = 'lx-rm-css';
    var B = 'var(--border,rgba(128,128,140,.22))', MU = 'var(--text-muted,#8b8b96)', S2 = 'var(--surface-2,rgba(128,128,140,.08))';
    s.textContent = ''
      // desktop: two columns on the existing section; the table scrolls sideways inside its own wrap
      + 'section.dex-markets.lx-rm-on{display:grid!important;grid-template-columns:minmax(0,1fr) 340px;column-gap:20px;align-items:start}'
      + 'section.dex-markets.lx-rm-on>*:not(.lx-rm){grid-column:1;min-width:0}'
      + 'section.dex-markets.lx-rm-on>.lx-rm{grid-column:2;grid-row:var(--lxrm-row,1)/span 40;position:sticky;top:84px}'
      + 'section.dex-markets.lx-rm-on .dex-mk-table-wrap{overflow-x:auto!important;scrollbar-width:thin}'
      + '@media (max-width:1180px){section.dex-markets.lx-rm-on{grid-template-columns:minmax(0,1fr)}section.dex-markets.lx-rm-on>.lx-rm{grid-column:1;grid-row:auto;position:static;order:-1;margin-bottom:18px}}'
      + '.lx-rm{border:1px solid ' + B + ';border-radius:16px;background:var(--surface,transparent);overflow:hidden}'
      + '.lx-rm-h{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 14px 12px 16px;border-bottom:1px solid ' + B + ';background:linear-gradient(135deg,var(--accent-pale,rgba(234,106,44,.08)),transparent 65%)}'
      + '.lx-rm-h h3{margin:0;font-size:16px;font-weight:700;letter-spacing:-.01em;display:flex;align-items:center;gap:8px}'
      + '.lx-rm-live{width:7px;height:7px;border-radius:50%;background:var(--green,#22c55e);box-shadow:0 0 0 0 rgba(34,197,94,.6);animation:lxrmPulse 2s infinite}'
      + '@keyframes lxrmPulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.55)}70%{box-shadow:0 0 0 7px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}'
      + '.lx-rm-sub{font-size:11.5px;color:' + MU + ';margin-top:2px}'
      + '.lx-rm-go{display:inline-flex;align-items:center;gap:7px;padding:9px 14px;border-radius:11px;background:var(--accent,#ea6a2c);color:#fff!important;font-weight:700;font-size:13.5px;text-decoration:none;white-space:nowrap;box-shadow:0 6px 18px -6px var(--accent,#ea6a2c);transition:transform .15s,box-shadow .15s}'
      + '.lx-rm-go:hover{transform:translateY(-1px);box-shadow:0 10px 24px -8px var(--accent,#ea6a2c)}'
      + '.lx-rm-go svg{width:15px;height:15px}'
      + '.lx-rm-list{display:flex;flex-direction:column}'
      + '.lx-rm-row{display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:3px 11px;align-items:center;padding:11px 14px 11px 16px;border-top:1px solid ' + B + ';cursor:pointer;transition:background .15s;text-decoration:none;color:inherit}'
      + '.lx-rm-row:first-child{border-top:0}'
      + '.lx-rm-row:hover{background:' + S2 + '}'
      + '.lx-rm-row.lx-rm-flash{animation:lxrmFlash 1.6s ease-out}'
      + '@keyframes lxrmFlash{0%{background:var(--accent-pale,rgba(234,106,44,.18))}100%{background:transparent}}'
      + '.lx-rm-row{text-align:left}'
      + '.lx-rm-row>.lx-rm-logo,.lx-rm-row>.lx-rm-av{grid-column:1;grid-row:1/span 2}'
      + '.lx-rm-row>.lx-rm-t{grid-column:2;grid-row:1}.lx-rm-row>.lx-rm-by{grid-column:2;grid-row:2}.lx-rm-row>.lx-rm-r{grid-column:3;grid-row:1/span 2}'
      + '.lx-rm-logo,.lx-rm-av{width:36px;height:36px;border-radius:50%;object-fit:cover;background:' + S2 + '}'
      + '.lx-rm-av{display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;background:var(--accent-pale,rgba(234,106,44,.12));color:var(--accent,#ea6a2c)}'
      + '.lx-rm-t{display:flex;align-items:center;gap:6px;min-width:0;font-weight:700;font-size:14px}'
      + '.lx-rm-t .c{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.lx-rm-new{padding:1px 6px;border-radius:999px;background:var(--green-soft,rgba(34,197,94,.15));color:var(--green,#22c55e);font-size:10px;font-weight:700;letter-spacing:.03em}'
      + '.lx-rm-by{font-size:11.5px;color:' + MU + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      + '.lx-rm-wal{font-family:"JetBrains Mono",monospace;border-bottom:1px dashed ' + B + ';cursor:pointer}'
      + '.lx-rm-wal:hover{color:var(--text,inherit)}'
      + '.lx-rm-r{text-align:right;grid-row:1/span 2}'
      + '.lx-rm-cap{font-family:"JetBrains Mono",monospace;font-weight:700;font-size:13.5px}'
      + '.lx-rm-capl{font-size:10.5px;color:' + MU + ';margin-left:3px;font-family:inherit;font-weight:500}'
      + '.lx-rm-m{font-size:11.5px;color:' + MU + ';margin-top:3px;white-space:nowrap}'
      + '.lx-rm-tri{display:inline-flex;align-items:center;gap:3px;font-weight:700;font-size:11.5px;margin-left:6px}'
      + '.lx-rm-tri.buy{color:var(--green,#22c55e)}.lx-rm-tri.sell{color:var(--red,#ef4444)}'
      + '.lx-rm-tri i{font-style:normal;font-size:9px}'
      + '.lx-rm-tri.lx-rm-pop i{animation:lxrmPop .9s ease-out}'
      + '@keyframes lxrmPop{0%{transform:scale(1.9)}100%{transform:scale(1)}}'
      + '.lx-rm-chg{font-family:"JetBrains Mono",monospace;font-weight:700;font-size:14px;padding:4px 9px;border-radius:8px;white-space:nowrap}'
      + '.lx-rm-chg.up{color:var(--green,#22c55e);background:var(--green-soft,rgba(34,197,94,.12))}'
      + '.lx-rm-chg.down{color:var(--red,#ef4444);background:var(--red-soft,rgba(239,68,68,.12))}'
      + '.lx-rm-chg.flat{color:' + MU + ';background:' + S2 + '}'
      + '.lx-rm-act{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;color:' + MU + '}'
      + '.lx-rm-act i{font-style:normal;font-size:9px}.lx-rm-act.buy i{color:var(--green,#22c55e)}.lx-rm-act.sell i{color:var(--red,#ef4444)}'
      + '.lx-rm-act.lx-rm-pop i{display:inline-block;animation:lxrmPop .9s ease-out}'
      + '.lx-rm-card .cap .lx-rm-chg{font-size:15px;padding:3px 8px;display:inline-block}'
      + '.lx-rm-card{flex-basis:138px}'
      + '.lx-rm-empty{padding:22px 16px;text-align:center;color:' + MU + ';font-size:13px;line-height:1.5}'
      + '.lx-rm-skel{height:58px;margin:0 14px;border-top:1px solid ' + B + ';background:linear-gradient(90deg,transparent,' + S2 + ',transparent);background-size:200% 100%;animation:lxrmSk 1.4s infinite}'
      + '@keyframes lxrmSk{0%{background-position:100% 0}100%{background-position:-100% 0}}'
      // phone: a swipeable row of cards above "All Trading Pairs"
      + '.lx-rm.lx-rm-mob{margin:6px 0 18px;border-radius:14px}'
      // The phone Trade page hides the design's own "New Mints" / "Market movers" run -- every sibling from that heading to
      // the next one -- with .lx-mdgone, and this panel sits inside that run. v1 shipped invisible on phones because of it.
      + 'aside.lx-rm.lx-mdgone.lx-mdgone{display:block!important}'
      + 'html.lx-rm-page .mdx-section-head a.mdx-hero-btn.primary,html.lx-rm-page .dex-section-head a.dex-hero-btn.primary{display:none!important}'
      + '.lx-rm-mob .lx-rm-h{padding:12px 12px 10px 14px}'
      + '.lx-rm-mob .lx-rm-h h3{font-size:15px}'
      + '.lx-rm-mob .lx-rm-go{padding:8px 12px;font-size:13px}'
      + '.lx-rm-strip{display:flex;gap:10px;overflow-x:auto;padding:12px 14px 14px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none}'
      + '.lx-rm-strip::-webkit-scrollbar{display:none}'
      + '.lx-rm-card{flex:0 0 152px;scroll-snap-align:start;border:1px solid ' + B + ';border-radius:12px;padding:11px;color:inherit;text-decoration:none;background:var(--surface,transparent)}'
      + '.lx-rm-card.lx-rm-flash{animation:lxrmFlash 1.6s ease-out}'
      + '.lx-rm-card .top{display:flex;align-items:center;gap:8px}'
      + '.lx-rm-card .lx-rm-logo,.lx-rm-card .lx-rm-av{width:30px;height:30px;grid-row:auto}'
      + '.lx-rm-card .c{font-weight:700;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.lx-rm-card .cap{margin-top:9px;font-family:"JetBrains Mono",monospace;font-weight:700;font-size:14px}'
      + '.lx-rm-card .m{margin-top:3px;font-size:11px;color:' + MU + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      + '.lx-rm-card .lx-rm-tri{margin-left:0;margin-top:5px}';
    // v3 (RAZA 2026-11-24 "follows different colors ... header not aligned"): the panel now wears the pairs table's own
    // card -- same surface, border, 14px radius; its header is the table's 47px header band (surface-2, uppercase
    // 13.8px soft labels); numbers are plain coloured mono text like the table's 24H CHANGE; no tinted gradient, no
    // pills, no glow. On desktop it starts level with the table (see mount), not with the "All Trading Pairs" heading.
    var SO = 'var(--text-soft,' + MU + ')';
    s.textContent += ''
      + '.lx-rm{border-radius:14px;background:var(--surface,transparent);border:1px solid ' + B + '}'
      + '.lx-rm-h{min-height:47px;box-sizing:border-box;padding:6px 8px 6px 15px;background:var(--surface-2,transparent);gap:8px}'
      + '.lx-rm-h h3{font-size:13.8px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:' + SO + ';gap:8px}'
      + '.lx-rm-sub{display:none}'
      + '.lx-rm-live{width:6px;height:6px}'
      + '.lx-rm-go{padding:7px 12px;border-radius:8px;font-size:13.5px;box-shadow:none;gap:6px}'
      + '.lx-rm-go:hover{transform:none;box-shadow:none;filter:brightness(1.08)}'
      + '.lx-rm-go svg{width:14px;height:14px}'
      + '.lx-rm-row{min-height:72px;box-sizing:border-box;padding:12px 15px;gap:2px 12px}'
      + '.lx-rm-t{font-size:16px}'
      + '.lx-rm-act{font-size:12.5px;color:' + SO + '}'
      + '.lx-rm-new{font-size:10px;padding:1px 6px}'
      + '.lx-rm-chg,.lx-rm-chg.up,.lx-rm-chg.down,.lx-rm-chg.flat{background:none;padding:0;border-radius:0;font-size:16px}'
      + '.lx-rm-chg.flat{color:' + SO + '}'
      + '.lx-rm-card{border-radius:12px;background:var(--surface,transparent)}'
      + '.lx-rm-card .cap .lx-rm-chg{font-size:16px;padding:0}'
      + '.lx-rm-mob .lx-rm-h{padding:6px 8px 6px 14px}'
      + '.lx-rm-mob .lx-rm-h h3{font-size:12.5px}'
      + '.lx-rm-mob .lx-rm-go{padding:7px 11px;font-size:13px}'
      + '.lx-rm-strip{padding:12px}'
      // v4: the latest-trade arrow sits beside the ticker; the second line is "Minted 2h ago · by G…"
      + '.lx-rm-t .lx-rm-tri,.lx-rm-card .top .lx-rm-tri{margin:0}.lx-rm-t .lx-rm-tri i,.lx-rm-card .top .lx-rm-tri i{font-size:10px}'
      + '.lx-rm-act .lx-rm-wal{color:inherit}.lx-rm-card .m .lx-rm-wal{color:inherit}'
      // v8: sparkline rows -- logo | ticker (+NEW) | line | change ; second line spans under ticker, line and change
      + '.lx-rm-row{grid-template-columns:40px minmax(0,1fr) 64px auto;gap:4px 12px;transition:background .18s}'
      + '.lx-rm-row>.lx-rm-logo{grid-column:1;grid-row:1/span 2}'
      + '.lx-rm-row>.lx-rm-t{grid-column:2;grid-row:1}.lx-rm-row>.lx-rm-sp{grid-column:3;grid-row:1;display:flex;align-items:center}'
      + '.lx-rm-row>.lx-rm-r{grid-column:4;grid-row:1;min-width:72px}.lx-rm-row>.lx-rm-by{grid-column:2/span 3;grid-row:2}'
      + '.lx-rm-logo{width:40px;height:40px;box-shadow:0 0 0 1px ' + B + ',0 2px 8px -3px rgba(0,0,0,.35)}'
      + '.lx-rm-row:hover{background:var(--surface-2,' + S2 + ')}.lx-rm-row:hover .lx-rm-spark .l{stroke-width:2}'
      + '.lx-rm-spark{display:block;overflow:visible}.lx-rm-spark.none{display:inline-block}'
      + '.lx-rm-spark .l{fill:none;stroke-width:1.6;stroke-linejoin:round;stroke-linecap:round;transition:stroke-width .18s}'
      + '.lx-rm-spark.up .l{stroke:var(--green,#22c55e)}.lx-rm-spark.down .l{stroke:var(--red,#ef4444)}.lx-rm-spark.flat .l{stroke:' + SO + ';opacity:.7}'
      + '.lx-rm-spark .a{stroke:none;opacity:.16}.lx-rm-spark.up .a{fill:var(--green,#22c55e)}.lx-rm-spark.down .a{fill:var(--red,#ef4444)}.lx-rm-spark.flat .a{display:none}'
      + '.lx-rm-spark .d{stroke:var(--surface,#131317);stroke-width:1.4}.lx-rm-spark .d.buy,.lx-rm-spark .d.up{fill:var(--green,#22c55e)}.lx-rm-spark .d.sell,.lx-rm-spark .d.down{fill:var(--red,#ef4444)}.lx-rm-spark .d.flat{fill:' + SO + '}'
      + '.lx-rm-spark.lx-rm-pop .d{animation:lxrmDot 1.4s ease-out}'
      + '@keyframes lxrmDot{0%{r:6}100%{r:2.6}}'
      + '.lx-rm-chg{font-size:15px}.lx-rm-by .lx-rm-new{margin-right:4px;vertical-align:1px}'
      + '.lx-rm-card{flex-basis:178px;display:flex;flex-direction:column;gap:2px}.lx-rm-card .sp{margin:10px 0 2px}.lx-rm-card .cap{margin-top:4px}'
      + '.lx-rm-card .lx-rm-logo{width:32px;height:32px}'
      // v9 (RAZA 2026-11-24 "looks disorganised and not symmetrical"): every row has the SAME fixed columns now --
      // logo 40 | ticker + NEW over the minted line | an 84px right block with the % on top and the price line under
      // it. Before, the % column was as wide as its number, so each row's line sat somewhere else. Panel 340 -> 360.
      + '@media (min-width:1181px){section.dex-markets.lx-rm-on{grid-template-columns:minmax(0,1fr) 360px}}'
      + '.lx-rm-row{grid-template-columns:40px minmax(0,1fr) 76px;grid-template-rows:auto auto;gap:5px 10px;align-items:center}'
      + '.lx-rm-row>.lx-rm-logo{grid-column:1;grid-row:1/span 2;align-self:center}'
      + '.lx-rm-row>.lx-rm-t{grid-column:2;grid-row:1;align-self:end}'
      + '.lx-rm-row>.lx-rm-by{grid-column:2;grid-row:2;align-self:start;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.lx-rm-row>.lx-rm-r{grid-column:3;grid-row:1;align-self:end;text-align:right;min-width:0}'
      + '.lx-rm-row>.lx-rm-sp{grid-column:3;grid-row:2;align-self:start;display:block}'
      + '.lx-rm-row .lx-rm-t{line-height:20px;height:20px}.lx-rm-row .lx-rm-r{line-height:20px;height:20px}'
      + '.lx-rm-row .lx-rm-by{line-height:20px;height:20px}.lx-rm-row .lx-rm-act{display:inline;font-size:12px}'
      + '.lx-rm-row .lx-rm-chg{font-size:14.5px}.lx-rm-row .lx-rm-new{margin-left:2px}'
      // the wallet in the minted line: normal font (the mono one cut "GA7N…F4ZD" short), underline only on hover
      + '.lx-rm-acts{display:none}'
      // v11 look: the flame, a proper Launch Token button, and My Earnings in the bar
      + '.lx-rm-flame{width:17px;height:17px;flex:none;transform-origin:50% 90%;filter:drop-shadow(0 0 4px rgba(255,122,26,.45));animation:lxrmFlick 2.4s ease-in-out infinite}'
      + '@keyframes lxrmFlick{0%,100%{transform:scale(1,1) rotate(0)}30%{transform:scale(.96,1.06) rotate(-2deg)}60%{transform:scale(1.03,.97) rotate(1.5deg)}}'
      + '@media (prefers-reduced-motion:reduce){.lx-rm-flame{animation:none}}'
      // v13 polish (RAZA 2026-11-25 "more polishing ... to make it appealing")
      + '.lx-rm{position:relative}.lx-rm::before{content:"";position:absolute;left:12%;right:12%;top:0;height:1px;z-index:1;pointer-events:none;background:linear-gradient(90deg,transparent,rgba(255,122,26,.95),transparent);box-shadow:0 0 10px 1px rgba(255,122,26,.35)}'
      + '.lx-rm .lx-rm-new{background:var(--accent-pale,rgba(234,106,44,.14));color:var(--accent,#ea6a2c);box-shadow:inset 0 0 0 1px rgba(234,106,44,.25)}'
      + '.lx-rm-logo.new{box-shadow:0 0 0 2px var(--surface,#131317),0 0 0 3.5px var(--accent,#ea6a2c),0 0 14px rgba(255,122,26,.35)}'
      + '.lx-rm-row{box-shadow:inset 0 0 0 transparent;transition:background .18s,box-shadow .18s}.lx-rm-row:hover{box-shadow:inset 2px 0 0 var(--accent,#ea6a2c)}'
      + '.lx-rm-row:hover .lx-rm-spark .d{r:3.6}'
      + '.lx-rm-all{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;min-height:44px;padding:0 14px;border:0;border-top:1px solid ' + B + ';background:transparent;color:var(--accent,#ea6a2c);font:inherit;font-size:13px;font-weight:650;cursor:pointer;transition:background .18s}'
      + '.lx-rm-all:hover{background:var(--surface-2,' + S2 + ')}.lx-rm-all span{transition:transform .2s}.lx-rm-all:hover span{transform:translateX(3px)}'
      + '.lx-rm-mob .lx-rm-all{min-height:42px}'
      + '.lx-rm-h h3{gap:7px}'
      + '.lx-rm-go{position:relative;overflow:hidden;isolation:isolate;background:linear-gradient(180deg,#ff8f52 0%,#f26b2a 52%,#e2561b 100%);border:1px solid rgba(255,255,255,.16);box-shadow:inset 0 1px 0 rgba(255,255,255,.32),inset 0 -1px 0 rgba(0,0,0,.12),0 8px 18px -10px rgba(234,106,44,.75);font-weight:650;letter-spacing:.005em;text-shadow:0 1px 0 rgba(0,0,0,.12)}'
      + '.lx-rm-go::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,.32) 50%,transparent 70%);transform:translateX(-120%);transition:transform .75s ease}'
      + '.lx-rm-go:hover{filter:brightness(1.05);box-shadow:inset 0 1px 0 rgba(255,255,255,.36),inset 0 -1px 0 rgba(0,0,0,.12),0 10px 22px -10px rgba(234,106,44,.9)}'
      + '.lx-rm-go:hover::after{transform:translateX(120%)}'
      + '.lx-rm-go:active{transform:translateY(1px)}'
      + '.lx-rm-go svg{width:15px;height:15px;transform:rotate(-8deg);transition:transform .3s}.lx-rm-go:hover svg{transform:rotate(-8deg) translate(1px,-1px)}'
      + '@media (min-width:1181px){section.dex-markets.lx-rm-on>.lx-rm-acts #lxEarnBtn{gap:8px;padding:0 14px 0 8px;border-radius:10px;font-weight:650;background:var(--surface,transparent);border:1px solid ' + B + ';transition:border-color .2s,background .2s}'
      + 'section.dex-markets.lx-rm-on>.lx-rm-acts #lxEarnBtn svg{box-sizing:border-box;width:24px;height:24px;padding:5px;border-radius:50%;background:var(--accent-pale,rgba(234,106,44,.14));box-shadow:inset 0 0 0 1px rgba(234,106,44,.28)}'
      + 'section.dex-markets.lx-rm-on>.lx-rm-acts #lxEarnBtn:hover{border-color:rgba(234,106,44,.55);background:var(--surface-2,' + S2 + ')}}'
      + '@media (min-width:1181px){section.dex-markets.lx-rm-on>.lx-rm-acts{display:flex;grid-column:2;grid-row:1;align-self:end;align-items:center;justify-content:flex-start;gap:10px;margin-bottom:20px}'
      + 'section.dex-markets.lx-rm-on>.lx-rm-acts .lx-rm-go{box-sizing:border-box;height:36px;padding:0 16px;font-size:14px;border-radius:10px}'   // FLASH (RAZA 2026-11-25): right size from the first frame
      + 'section.dex-markets.lx-rm-on>.lx-rm-acts #lxEarnBtn{box-sizing:border-box;margin:0}}'
      + '.lx-rm-wal,.lx-rm-act .lx-rm-wal{font-family:inherit;border-bottom:0;text-decoration:none}.lx-rm-wal:hover{text-decoration:underline;color:var(--text,inherit)}'
      // MORE COLUMNS TO THE RIGHT (RAZA 2026-11-24 "stray H / L"): with this panel beside it the pairs table scrolls
      // sideways, and DAY HIGH / LOW sat half-hidden at the edge showing only its "H" and "L" labels. While columns are
      // hidden to the right, the table's right edge fades out, the usual hint that it scrolls.
      + 'section.dex-markets.lx-rm-on .dex-mk-table-wrap.lx-rm-more{-webkit-mask-image:linear-gradient(to right,#000 calc(100% - 64px),transparent);mask-image:linear-gradient(to right,#000 calc(100% - 64px),transparent)}';
    document.head.appendChild(s);
    // v16 LAUNCH TOKEN: tinted, flat, quiet -- orange text on a soft orange ground with a hairline border; fills solid on
    // hover. No gradient, glow, sheen or text shadow. Same height/corners as the search box beside it.
    var s2 = document.createElement('style'); s2.id = 'lx-rm-css2';
    s2.textContent = ''
      + '.lx-rm .lx-rm-go,.lx-rm-acts .lx-rm-go{background:var(--accent-pale,rgba(234,106,44,.12));color:var(--accent,#ea6a2c)!important;border:1px solid rgba(234,106,44,.38);box-shadow:none;text-shadow:none;filter:none;font-weight:600;letter-spacing:0;gap:7px;transition:background .18s,color .18s,border-color .18s}'
      + '.lx-rm .lx-rm-go::after,.lx-rm-acts .lx-rm-go::after{display:none}'
      + '.lx-rm .lx-rm-go svg,.lx-rm-acts .lx-rm-go svg{width:15px;height:15px;transform:none;transition:transform .2s}'
      + '.lx-rm .lx-rm-go:hover,.lx-rm-acts .lx-rm-go:hover{background:var(--accent,#ea6a2c);border-color:var(--accent,#ea6a2c);color:#fff!important;box-shadow:none;filter:none;transform:none}'
      + '.lx-rm .lx-rm-go:hover svg,.lx-rm-acts .lx-rm-go:hover svg{transform:rotate(90deg)}'
      + '.lx-rm .lx-rm-go:active,.lx-rm-acts .lx-rm-go:active{transform:translateY(1px)}'
      + '.lx-rm .lx-rm-go:focus-visible,.lx-rm-acts .lx-rm-go:focus-visible{outline:2px solid var(--accent,#ea6a2c);outline-offset:2px}';
    document.head.appendChild(s2);
  }
  // LOGOS DECIDE WHO IS LISTED (RAZA 2026-11-24 "lets please not show tokens with no logos"). A token is shown only
  // once its logo has actually LOADED in this browser; LOGO[id]: undefined = still checking, '' = none, url = shown.
  // The feed sends up to 10 candidates so the newest 5 with a logo can still fill the list.
  function logo(r) {
    if (LOGO[r.id] !== undefined || PEND[r.id]) return;
    PEND[r.id] = 1;
    var done = function (u) {
      if (!u) { LOGO[r.id] = ''; delete PEND[r.id]; repaint(); return; }
      var im = new Image();
      im.onload = function () { LOGO[r.id] = im.naturalWidth > 1 ? u : ''; delete PEND[r.id]; repaint(); };
      im.onerror = function () { LOGO[r.id] = ''; delete PEND[r.id]; repaint(); };
      im.src = u;
    };
    var j = function (x) { return x.ok ? x.json() : null; }, no = function () { done(''); };
    if (NET === 'stellar') fetch('/lxapi/assetlogo?v=2&asset=' + encodeURIComponent(r.id)).then(j).then(function (d) { done(d && d.image); }).catch(no);
    else if (NET === 'xrpl') { var i = r.id.lastIndexOf('-'); done('/lxapi/xrplthumb?iss=' + encodeURIComponent(r.id.slice(i + 1)) + '&cur=' + encodeURIComponent(xcur(r.id.slice(0, i))) + '&w=64'); }
    else fetch('/lxapi/neartoken?i=' + encodeURIComponent(r.id)).then(j).then(function (d) { done(d && d.ok && d.logo); }).catch(no);
  }
  var rpT = 0;
  function repaint() { clearTimeout(rpT); rpT = setTimeout(function () { if (mounted) paint(mounted.box, mounted.mob); }, 60); }
  // v13: the footer opens the pairs table's own "LumosCore Mints" view (its mode menu), then scrolls to it.
  var ALL = '<button type="button" class="lx-rm-all">View all LumosCore Mints <span aria-hidden="true">›</span></button>';
  function showAllMints() {
    var btns = function () { return [].filter.call(document.querySelectorAll('button'), function (b) { return b.offsetParent && !b.closest('.lx-rm'); }); };
    var pick = function () { return btns().filter(function (b) { return /LumosCore Mints\s*$/.test((b.textContent || '').trim()); })[0]; };
    var go = function () { var t = document.querySelector('.dex-mk-table-wrap') || pairsHead(); if (t && t.offsetParent) window.scrollTo({ top: t.getBoundingClientRect().top + scrollY - 140, behavior: 'smooth' }); };
    var o = pick();
    if (!o) { var m = btns().filter(function (b) { return /Curated|Stables|LumosCore Mints/.test(b.textContent || '') && !/^\s*[✓]/.test(b.textContent || ''); })[0]; if (m) m.click(); }
    setTimeout(function () { var o2 = pick(); if (o2) o2.click(); setTimeout(go, 250); }, o ? 0 : 280);
  }
  function imgHtml(r) { return '<img class="lx-rm-logo' + (isNew(r) ? ' new' : '') + '" alt="" src="' + esc(LOGO[r.id]) + '">'; }
  function isNew(r) { return r.born > 1e12 && Date.now() - r.born < 86400000; }
  // v4 (RAZA 2026-11-24): "Minted 2h ago" + "by <wallet>" instead of the trade count. The latest trade stays as the small
  // live arrow beside the ticker (green buy / red sell, flashes on a new one).
  function tri(r, pop) {
    if (!r.last) return '';
    var b = r.last.side === 'buy';
    return '<span class="lx-rm-tri ' + (b ? 'buy' : 'sell') + (pop ? ' lx-rm-pop' : '') + '" title="Latest trade: ' + (b ? 'buy' : 'sell') + ' ' + esc(ago(r.last.t)) + (ago(r.last.t) === 'now' ? '' : ' ago') + '"><i>' + (b ? '▲' : '▼') + '</i></span>';
  }
  function minted(r) { if (!(r.born > 1e12)) return ''; var a = ago(r.born); return 'Minted ' + (a === 'now' ? 'just now' : a + ' ago'); }
  function byHtml(r) { return r.minter ? 'by <span class="lx-rm-wal" data-href="' + esc(walletPath(r.minter)) + '" title="Open the minter\'s wallet">' + esc(short(r.minter)) + '</span>' : ''; }
  function meta2(r) { var m = minted(r), b = byHtml(r); return '<span class="lx-rm-act">' + esc(m) + (m && b ? ' · ' : '') + b + '</span>'; }
  function chg(r) {
    var c = r.change24;
    if (c == null || !isFinite(c)) return '';
    // two decimals below 1,000%, like the token page's change row (JENSEN read "+200%" here and "+199.90%" there)
    var a = Math.abs(c), t = (a >= 1000 ? Math.round(a).toLocaleString('en-US') : a.toFixed(2)) + '%';
    if (a < 0.005) return '<span class="lx-rm-chg flat">0%</span>';
    return '<span class="lx-rm-chg ' + (c > 0 ? 'up' : 'down') + '">' + (c > 0 ? '+' : '−') + t + '</span>';
  }
  // v8 (RAZA 2026-11-24 "not at all attractive"): each row carries a small price line (the feed's spark series), coloured
  // by the 24h change; its end dot is the latest trade (green buy / red sell) and pulses when a new one lands. The arrow
  // that sat beside the ticker moved there.
  function sparkSvg(r, pop, W, H) {
    var v = (r.spark || []).filter(function (x) { return x > 0; });
    if (v.length < 2) return '<span class="lx-rm-spark none" style="width:' + W + 'px;height:' + H + 'px"></span>';
    var lo = Math.min.apply(null, v), hi = Math.max.apply(null, v), span = hi - lo, P = 3;
    var pts = v.map(function (x, i) { var X = P + i * (W - 2 * P) / (v.length - 1), Y = span > 0 ? P + (H - 2 * P) * (1 - (x - lo) / span) : H / 2; return [Math.round(X * 10) / 10, Math.round(Y * 10) / 10]; });
    var c = r.change24, tone = c > 0.005 ? 'up' : (c < -0.005 ? 'down' : 'flat');
    var line = pts.map(function (p) { return p.join(','); }).join(' ');
    var area = 'M' + pts[0][0] + ',' + H + ' L' + pts.map(function (p) { return p.join(','); }).join(' L') + ' L' + pts[pts.length - 1][0] + ',' + H + ' Z';
    // the dot shows the latest trade's side only when that trade is inside the line's 24h; older = the line's own tone
    var e = pts[pts.length - 1], side = r.last && Date.now() - r.last.t < 86400000 ? (r.last.side === 'buy' ? 'buy' : 'sell') : tone;
    var tip = r.last ? 'Latest trade: ' + (r.last.side === 'buy' ? 'buy' : 'sell') + ' ' + ago(r.last.t) + (ago(r.last.t) === 'now' ? '' : ' ago') : '';
    return '<svg class="lx-rm-spark ' + tone + (pop ? ' lx-rm-pop' : '') + '" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' + (tip ? '<title>' + esc(tip) + '</title>' : '')
      + '<path class="a" d="' + area + '"/><polyline class="l" points="' + line + '"/>'
      + '<circle class="d ' + side + '" cx="' + e[0] + '" cy="' + e[1] + '" r="2.6"/></svg>';
  }
  function rowHtml(r, pop) {
    return '<a class="lx-rm-row' + (pop ? ' lx-rm-flash' : '') + '" href="' + esc(pagePath(r.id)) + '" data-id="' + esc(r.id) + '">' + imgHtml(r)
      + '<div class="lx-rm-t"><span class="c">' + esc(r.code) + '</span>' + (isNew(r) ? '<span class="lx-rm-new">NEW</span>' : '') + '</div>'
      + '<div class="lx-rm-r">' + (chg(r) || '<span class="lx-rm-chg flat">—</span>') + '</div>'
      + '<div class="lx-rm-by">' + meta2(r) + '</div>'
      + '<div class="lx-rm-sp">' + sparkSvg(r, pop, 76, 20) + '</div>'
      + '</a>';
  }
  function cardHtml(r, pop) {
    var m = minted(r), b = byHtml(r);
    return '<a class="lx-rm-card' + (pop ? ' lx-rm-flash' : '') + '" href="' + esc(pagePath(r.id)) + '" data-id="' + esc(r.id) + '"><div class="top">' + imgHtml(r)
      + '<span class="c">' + esc(r.code) + '</span>' + (isNew(r) ? '<span class="lx-rm-new">NEW</span>' : '') + '</div>'
      + '<div class="sp">' + sparkSvg(r, pop, 150, 36) + '</div>'
      + '<div class="cap">' + chg(r) + '</div>'
      + (m ? '<div class="m">' + esc(m) + '</div>' : '') + (b ? '<div class="m">' + b + '</div>' : '') + '</a>';
  }
  function head(mob) {
    return '<div class="lx-rm-h"><div><h3>' + FLAME + 'Recent Mints</h3><div class="lx-rm-sub">Newest LumosCore Launchpad tokens on ' + esc({ stellar: 'Stellar', xrpl: 'XRPL', near: 'NEAR' }[NET]) + '</div></div>'
      + (mob ? '<a class="lx-rm-go" href="/launchpad/' + NET + '">' + PLUS + 'Launch Token</a>' : '') + '</div>';
  }
  function paint(box, mob) {
    var all = (DATA && DATA.rows) || [];
    all.forEach(logo);
    var rows = all.filter(function (r) { return LOGO[r.id]; }).slice(0, 5);   // RAZA 2026-11-24: 5, not 10
    var checking = all.some(function (r) { return LOGO[r.id] === undefined; });
    var SK = (mob ? '<div class="lx-rm-strip"><div class="lx-rm-skel" style="flex:0 0 178px;height:173px;border:0;margin:0;border-radius:12px"></div><div class="lx-rm-skel" style="flex:0 0 178px;height:173px;border:0;margin:0;border-radius:12px"></div></div>' : '<div class="lx-rm-skel"></div><div class="lx-rm-skel"></div><div class="lx-rm-skel"></div>') + '<div class="lx-rm-all" aria-hidden="true" style="pointer-events:none"></div>';   // the footer's height too, so nothing below moves when the rows arrive
    // hold the skeleton until the logo checks are in, so rows do not pop in one by one on first load
    var body = (!DATA || (checking && !box.__lxrmDone)) ? SK
      : (!rows.length ? '<div class="lx-rm-empty">No token has been launched on ' + esc({ stellar: 'Stellar', xrpl: 'XRPL', near: 'NEAR' }[NET]) + ' yet. Be the first.</div>'
        : (mob ? '<div class="lx-rm-strip">' + rows.map(function (r) { var p = changed(r); return cardHtml(r, p); }).join('') + '</div>' + ALL
          : '<div class="lx-rm-list">' + rows.map(function (r) { var p = changed(r); return rowHtml(r, p); }).join('') + '</div>' + ALL));
    if (DATA && !checking) box.__lxrmDone = 1;
    var keep = mob ? (box.querySelector('.lx-rm-strip') || {}).scrollLeft : 0;
    box.innerHTML = head(mob) + body;
    if (mob && keep) { var st = box.querySelector('.lx-rm-strip'); if (st) st.scrollLeft = keep; }
  }
  // a row "changed" when its latest trade is newer than the one painted before (first paint: no flash)
  function changed(r) {
    var t = r.last ? r.last.t : 0, was = LAST[r.id];
    LAST[r.id] = t;
    return was !== undefined && t > was;
  }
  function mount() {
    var mob = false, host = document.querySelector('section.dex-markets');
    if (!host || !host.offsetParent) {
      var h2 = [].filter.call(document.querySelectorAll('h1,h2'), function (x) { return /All Trading Pairs/.test(x.textContent || '') && x.offsetParent; })[0];
      if (!h2) return false;
      host = h2.closest('.mdx-section-head') || h2.parentNode; mob = true;
    }
    if (document.querySelector('.lx-rm')) return true;
    css();
    var box = document.createElement('aside'); box.className = 'lx-rm' + (mob ? ' lx-rm-mob' : ''); box.setAttribute('aria-label', 'Recent Mints');
    // the small "+ Launch Token" link beside "All Trading Pairs" repeats the panel's button; the page adds it late,
    // so a CSS rule hides it rather than a one-off hide
    document.documentElement.classList.add('lx-rm-page');
    if (mob) {
      host.parentNode.insertBefore(box, host);
      // FLASH (RAZA 2026-11-25 phone screenshot): the page re-orders its sections after load and the panel showed under
      // the pairs list until ensure() moved it ~1 s later. An observer re-places it before the next paint instead.
      try {
        var mo = new MutationObserver(function () { var ph = pairsHead(); if (ph && ph.parentNode && ph.previousElementSibling !== box) ph.parentNode.insertBefore(box, ph); });
        mo.observe(host.parentNode, { childList: true });
        setTimeout(function () { mo.disconnect(); }, 30000);
      } catch (e) {}
    }
    else {
      host.classList.add('lx-rm-on'); host.appendChild(box);
      // ACTION BAR (RAZA 2026-11-24 mockup): Launch Token and My Earnings sit above the panel, level with the filter
      // row, and the panel header is just "RECENT MINTS". The My Earnings button (lx-earnings.js) is created once and
      // then left wherever it is, so it is simply moved in here (see ensure). Narrow desktops and phones keep the
      // button in the panel header: the bar is hidden there.
      var acts = document.createElement('div'); acts.className = 'lx-rm-acts';
      acts.innerHTML = '<a class="lx-rm-go lx-rm-go-bar" href="/launchpad/' + NET + '">' + PLUS + 'Launch Token</a>';
      host.appendChild(acts);
      // start level with the table card, not with the heading: the panel's first grid row = the row of the section
      // child that holds the table (each child of the section is one row of the single left column)
      var tw = host.querySelector('.dex-mk-table-wrap'), kid = tw;
      if (tw) {
        var edge = function () { var w = host.querySelector('.dex-mk-table-wrap'); if (w) w.classList.toggle('lx-rm-more', w.scrollLeft + w.clientWidth < w.scrollWidth - 4); };
        host.addEventListener('scroll', edge, true); window.addEventListener('resize', edge); setInterval(edge, 1500); edge();
      }
      while (kid && kid.parentNode !== host) kid = kid.parentNode;
      var kids = [].filter.call(host.children, function (k) { return k !== box; });
      var at = kid ? kids.indexOf(kid) : -1;
      if (at > 0) { host.style.setProperty('--lxrm-row', String(at + 1)); acts.style.gridRow = String(at); }   // the bar: the row just above the table
      // narrow desktops stack the panel above the table: there it is the card row too, not a 10-row list
      var narrow = function () { return innerWidth <= 1180; };
      mob = narrow(); box.classList.toggle('lx-rm-mob', mob);
      window.addEventListener('resize', function () {
        var m = narrow(); if (!mounted || m === mounted.mob) return;
        mounted.mob = m; box.classList.toggle('lx-rm-mob', m); paint(box, m); ensure();
      });
    }
    // EVERY CLICK IN THE PANEL WAS SWALLOWED (RAZA 2026-11-24 "the minters wallet should be linked"). The design's
    // window.__lumosNav row navigator claims clicks on list rows at WINDOW capture and sent them all to /trade/<net>:
    // token rows, the minter wallet and Launch Token all just reloaded the page. A box-level listener runs too late,
    // so this one sits at window capture too and navigates itself. Ctrl/Cmd/Shift/middle clicks still open new tabs.
    if (!window.__lxRMClick) {
      window.__lxRMClick = 1;
      window.addEventListener('click', function (e) {
        var t = e.target && e.target.closest ? e.target : null; if (!t || !t.closest('.lx-rm')) return;
        if (t.closest('.lx-rm-all')) { e.preventDefault(); e.stopImmediatePropagation(); showAllMints(); return; }
        var w = t.closest('.lx-rm-wal'), a = t.closest('.lx-rm a[href]');
        var go = w ? w.getAttribute('data-href') : (a ? a.getAttribute('href') : '');
        if (!go) return;
        e.preventDefault(); e.stopImmediatePropagation();
        if (e.button === 1 || e.ctrlKey || e.metaKey || e.shiftKey) { window.open(go, '_blank', 'noopener'); return; }
        location.href = go;
      }, true);
    }
    paint(box, mob);
    mounted = { box: box, mob: mob };
    return true;
  }
  function load() {
    fetch('/lxapi/recentmints?net=' + NET).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || !d.ok) return;
      DATA = d; ensure(); if (mounted) paint(mounted.box, mounted.mob);
    }).catch(function () {});
  }
  // The phone page can show its desktop markup for a moment before switching layouts: a panel mounted into the
  // desktop section then sits hidden. Checked for the first 20 s; a hidden panel is taken out and mounted again.
  function pairsHead() {
    var h2 = [].filter.call(document.querySelectorAll('h1,h2'), function (x) { return /All Trading Pairs/.test(x.textContent || '') && x.offsetParent; })[0];
    return h2 ? (h2.closest('.mdx-section-head') || h2.parentNode) : null;
  }
  function ensure() {
    var acts = document.querySelector('.lx-rm-acts');
    if (acts) {
      var eb = document.getElementById('lxEarnBtn');
      // only while the bar is showing (wide desktop); otherwise it goes back to the filter row, where lx-earnings put it
      var shown = getComputedStyle(acts).display !== 'none', home = document.querySelector('.dex-section-head .dex-mk-controls');
      if (eb && !eb.classList.contains('lx-earn-mob')) {
        if (shown && eb.parentNode !== acts) acts.appendChild(eb);
        else if (!shown && eb.parentNode === acts && home) home.insertBefore(eb, home.firstChild);
      }
      var ref = document.querySelector('.dex-section-head .dex-mk-controls input, .dex-section-head .dex-mk-controls button:not(#lxEarnBtn)');
      if (ref && ref.offsetHeight) { var h = ref.offsetHeight + 'px'; [].forEach.call(acts.children, function (c) { if (c.style.height !== h) c.style.height = h; }); }
      // bottom level with the filter row: the same gap the filter row keeps above the table
      var ctl = document.querySelector('.dex-section-head .dex-mk-controls'), tw2 = document.querySelector('.dex-mk-table-wrap');
      // measured against the search box itself (the row's container is taller than the boxes in it)
      var pill = ref && ref.tagName === 'INPUT' ? (ref.closest('.dex-mk-search, [class*=search]') || ref.parentNode) : ref;
      if (pill && tw2 && pill.offsetParent) { var pb = pill.getBoundingClientRect(), g = Math.round(tw2.getBoundingClientRect().top - pb.bottom); if (g >= 0 && g < 80) acts.style.marginBottom = g + 'px'; var hh = Math.round(pb.height) + 'px'; [].forEach.call(acts.children, function (c) { if (c.style.height !== hh) c.style.height = hh; }); }
    }
    if (!mounted) return;
    // Phones: the page re-orders its sections after load, which moved "All Trading Pairs" and its list ABOVE the panel
    // and left the panel at the very bottom (v1 + v2 shipped that way). Put it back right above the heading.
    if (mounted.mob && mounted.box.offsetParent && !document.querySelector('section.dex-markets.lx-rm-on')) {
      var ph = pairsHead();
      if (ph && ph.previousElementSibling !== mounted.box && ph.parentNode) ph.parentNode.insertBefore(mounted.box, ph);
    }
    if (mounted.box.offsetParent) return;
    mounted.box.remove(); var s = document.querySelector('section.dex-markets.lx-rm-on'); if (s) s.classList.remove('lx-rm-on');
    mounted = false; mount();
  }
  function boot() {
    if (!mount()) { setTimeout(boot, 700); return; }
    load(); setInterval(load, 30000);
    var k = 0, iv = setInterval(function () { ensure(); if (++k >= 20) clearInterval(iv); }, 1000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
