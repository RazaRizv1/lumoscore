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
  var LAST = {}, LOGO = {}, DATA = null, mounted = false;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) {
    if (n == null || !isFinite(n)) return '—'; n = +n;
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'; if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'; if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    if (n >= 1) return '$' + n.toFixed(2); if (n > 0) return '$' + n.toPrecision(2); return '$0';
  }
  function ago(t) { var s = Math.max(0, (Date.now() - t) / 1000); if (s < 60) return 'now'; if (s < 3600) return Math.floor(s / 60) + 'm'; if (s < 86400) return Math.floor(s / 3600) + 'h'; if (s < 2592000) return Math.floor(s / 86400) + 'd'; return Math.floor(s / 2592000) + 'mo'; }
  function short(a) { a = String(a || ''); return a.length > 12 ? a.slice(0, 4) + '…' + a.slice(-4) : a; }
  function pagePath(id) { return '/trade/' + NET + '/' + encodeURIComponent(id); }
  function walletPath(a) { return '/account/' + NET + '/' + encodeURIComponent(a); }
  function xcur(c) { if (c.length <= 3) return c; var h = ''; for (var i = 0; i < c.length; i++) h += c.charCodeAt(i).toString(16).toUpperCase(); while (h.length < 40) h += '0'; return h; }
  var ROCKET = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>';
  function css() {
    if (document.getElementById('lx-rm-css')) return;
    var s = document.createElement('style'); s.id = 'lx-rm-css';
    var B = 'var(--border,rgba(128,128,140,.22))', MU = 'var(--text-muted,#8b8b96)', S2 = 'var(--surface-2,rgba(128,128,140,.08))';
    s.textContent = ''
      // desktop: two columns on the existing section; the table scrolls sideways inside its own wrap
      + 'section.dex-markets.lx-rm-on{display:grid!important;grid-template-columns:minmax(0,1fr) 340px;column-gap:20px;align-items:start}'
      + 'section.dex-markets.lx-rm-on>*:not(.lx-rm){grid-column:1;min-width:0}'
      + 'section.dex-markets.lx-rm-on>.lx-rm{grid-column:2;grid-row:1/span 40;position:sticky;top:84px}'
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
    document.head.appendChild(s);
  }
  function logo(r) {
    if (LOGO[r.id] !== undefined) return;
    LOGO[r.id] = '';
    var done = function (u) { LOGO[r.id] = u || ''; if (u) document.querySelectorAll('[data-lxrm-logo="' + CSS.escape(r.id) + '"]').forEach(function (el) { el.outerHTML = imgHtml(r); }); };
    if (NET === 'stellar') fetch('/lxapi/assetlogo?v=2&asset=' + encodeURIComponent(r.id)).then(function (x) { return x.ok ? x.json() : null; }).then(function (d) { done(d && d.image); }).catch(function () {});
    else if (NET === 'xrpl') { var i = r.id.lastIndexOf('-'); done('/lxapi/xrplthumb?iss=' + encodeURIComponent(r.id.slice(i + 1)) + '&cur=' + encodeURIComponent(xcur(r.id.slice(0, i))) + '&w=64'); }
    else fetch('/lxapi/neartoken?i=' + encodeURIComponent(r.id)).then(function (x) { return x.ok ? x.json() : null; }).then(function (d) { done(d && d.ok && d.logo); }).catch(function () {});
  }
  function imgHtml(r) {
    var u = LOGO[r.id];
    if (u) return '<img class="lx-rm-logo" alt="" src="' + esc(u) + '" onerror="this.style.visibility=\'hidden\'">';
    return '<span class="lx-rm-av" data-lxrm-logo="' + esc(r.id) + '">' + esc(String(r.code).slice(0, 2)) + '</span>';
  }
  function tri(r, pop) {
    if (!r.last) return '';
    var b = r.last.side === 'buy';
    return '<span class="lx-rm-tri ' + (b ? 'buy' : 'sell') + (pop ? ' lx-rm-pop' : '') + '" title="Latest trade: ' + (b ? 'buy' : 'sell') + ', ' + esc(new Date(r.last.t).toLocaleString()) + '"><i>' + (b ? '▲' : '▼') + '</i>' + (b ? 'Buy' : 'Sell') + ' ' + esc(ago(r.last.t)) + '</span>';
  }
  function isNew(r) { return r.born > 1e12 && Date.now() - r.born < 86400000; }
  function tradesTxt(r) { return r.trades24 == null ? '—' : (r.trades24 + (r.capped ? '+' : '')) + ' trade' + (r.trades24 === 1 && !r.capped ? '' : 's'); }
  // v2 (RAZA 2026-11-24 "too congested"): ticker + one activity line on the left, the 24h price change on the right.
  // Market cap, volume and the minter line are gone from view; the minter is in the row's tooltip.
  function act(r, pop) {
    if (r.trades24 == null && !r.last) return '<span class="lx-rm-act none">No trades yet</span>';
    var b = r.last && r.last.side === 'buy', s = r.last ? (b ? 'buy' : 'sell') : 'none';
    return '<span class="lx-rm-act ' + s + (pop ? ' lx-rm-pop' : '') + '"' + (r.last ? ' title="Latest trade: ' + (b ? 'buy' : 'sell') + ', ' + esc(new Date(r.last.t).toLocaleString()) + '"' : '') + '>'
      + (r.last ? '<i>' + (b ? '▲' : '▼') + '</i>' : '') + esc(tradesTxt(r)) + (r.last ? ' · ' + esc(ago(r.last.t)) : '') + '</span>';
  }
  function chg(r) {
    var c = r.change24;
    if (c == null || !isFinite(c)) return '';   // no trade data: nothing (a lone dash read as a broken cell)
    var a = Math.abs(c), t = (a >= 1000 ? Math.round(a).toLocaleString('en-US') : a >= 100 ? a.toFixed(0) : a.toFixed(a >= 10 ? 1 : 2)) + '%';
    if (a < 0.005) return '<span class="lx-rm-chg flat">0%</span>';
    return '<span class="lx-rm-chg ' + (c > 0 ? 'up' : 'down') + '">' + (c > 0 ? '+' : '−') + t + '</span>';
  }
  function tip(r) { return r.minter ? ' title="' + esc(r.code + ' · minted by ' + r.minter) + '"' : ''; }
  function rowHtml(r, pop) {
    logo(r);
    return '<a class="lx-rm-row' + (pop ? ' lx-rm-flash' : '') + '" href="' + esc(pagePath(r.id)) + '" data-id="' + esc(r.id) + '"' + tip(r) + '>' + imgHtml(r)
      + '<div class="lx-rm-t"><span class="c">' + esc(r.code) + '</span>' + (isNew(r) ? '<span class="lx-rm-new">NEW</span>' : '') + '</div>'
      + '<div class="lx-rm-r">' + chg(r) + '</div>'
      + '<div class="lx-rm-by">' + act(r, pop) + '</div>'
      + '</a>';
  }
  function cardHtml(r, pop) {
    logo(r);
    return '<a class="lx-rm-card' + (pop ? ' lx-rm-flash' : '') + '" href="' + esc(pagePath(r.id)) + '" data-id="' + esc(r.id) + '"' + tip(r) + '><div class="top">' + imgHtml(r)
      + '<span class="c">' + esc(r.code) + '</span>' + (isNew(r) ? '<span class="lx-rm-new">NEW</span>' : '') + '</div>'
      + '<div class="cap">' + chg(r) + '</div>'
      + '<div class="m">' + act(r, pop) + '</div></a>';
  }
  function head(mob) {
    return '<div class="lx-rm-h"><div><h3><span class="lx-rm-live" title="Updates live"></span>Recent Mints</h3><div class="lx-rm-sub">Newest LumosCore Launchpad tokens on ' + esc({ stellar: 'Stellar', xrpl: 'XRPL', near: 'NEAR' }[NET]) + '</div></div>'
      + '<a class="lx-rm-go" href="/launchpad/' + NET + '">' + ROCKET + 'Launch Token</a></div>';
  }
  function paint(box, mob) {
    var rows = (DATA && DATA.rows) || [];
    var body = !DATA ? (mob ? '<div class="lx-rm-strip"><div class="lx-rm-skel" style="flex:0 0 152px;height:120px;border:0;margin:0;border-radius:12px"></div><div class="lx-rm-skel" style="flex:0 0 152px;height:120px;border:0;margin:0;border-radius:12px"></div></div>' : '<div class="lx-rm-skel"></div><div class="lx-rm-skel"></div><div class="lx-rm-skel"></div>')
      : (!rows.length ? '<div class="lx-rm-empty">No token has been launched on ' + esc({ stellar: 'Stellar', xrpl: 'XRPL', near: 'NEAR' }[NET]) + ' yet. Be the first.</div>'
        : (mob ? '<div class="lx-rm-strip">' + rows.map(function (r) { var p = changed(r); return cardHtml(r, p); }).join('') + '</div>'
          : '<div class="lx-rm-list">' + rows.map(function (r) { var p = changed(r); return rowHtml(r, p); }).join('') + '</div>'));
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
    if (mob) host.parentNode.insertBefore(box, host);
    else {
      host.classList.add('lx-rm-on'); host.appendChild(box);
      // narrow desktops stack the panel above the table: there it is the card row too, not a 10-row list
      var narrow = function () { return innerWidth <= 1180; };
      mob = narrow(); box.classList.toggle('lx-rm-mob', mob);
      window.addEventListener('resize', function () {
        var m = narrow(); if (!mounted || m === mounted.mob) return;
        mounted.mob = m; box.classList.toggle('lx-rm-mob', m); paint(box, m);
      });
    }
    // wallet links inside a row link: open the wallet, not the token
    box.addEventListener('click', function (e) {
      var w = e.target.closest && e.target.closest('.lx-rm-wal');
      if (w) { e.preventDefault(); e.stopPropagation(); location.href = w.getAttribute('data-href'); }
    }, true);
    paint(box, mob);
    mounted = { box: box, mob: mob };
    return true;
  }
  function load() {
    fetch('/lxapi/recentmints?net=' + NET).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || !d.ok) return;
      DATA = d; if (mounted) paint(mounted.box, mounted.mob);
    }).catch(function () {});
  }
  // The phone page can show its desktop markup for a moment before switching layouts: a panel mounted into the
  // desktop section then sits hidden. Checked for the first 20 s; a hidden panel is taken out and mounted again.
  function ensure() {
    if (!mounted || mounted.box.offsetParent) return;
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
