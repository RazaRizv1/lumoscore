// "MY EARNINGS" ON TRADE (RAZA 2026-11-24). A Launchpad minter receives 30% of LumosCore's fee on every LumosCore trade of
// their token, paid inside the trade (see functions/lxapi/minters.js). This adds a "My Earnings" button to the Trade page's
// market header on every network (.dex-section-head > .dex-mk-controls, the same markup on Stellar, XRPL and NEAR) when a
// wallet is connected, and a panel listing the wallet's Launchpad tokens and each payment received (from
// /lxapi/earnings). Loaded on every page by the middleware; does nothing outside /trade/<network>.
// Copy states the mechanism only -- no claim about what anyone will earn.
//
// v2 PANEL (RAZA 2026-11-24: "My earnings popup doesn't look very attractive. Also, what if i have multiple minted. also
// there's no logo for jensen in my earnings. make it more detailed and attractive"):
//   * a total with its dollar value and three small figures (tokens, payments, last paid);
//   * one card PER TOKEN -- logo, name, what that token has paid this wallet, payment count, last paid -- linking to the
//     token's page, so several mints read as several rows rather than a row of chips;
//   * recent payments with the token's logo, relative time (exact time on hover) and the transaction link.
// Logos: Stellar /lxapi/assetlogo, XRPL the launchpad's mintmeta (via /lxapi/assetmeta), NEAR /lxapi/neartoken; a letter
// disc otherwise. Dollar values: /lxapi/xlm, /lxapi/xrpltoken?id=XRP, /lxapi/neartoken?i=wrap.near -- left out if unread.
// Colours are the page's own theme variables, so dark and light both follow the site.
(function () {
  if (window.__lxEarn) return; window.__lxEarn = 1;
  var NAMES = { stellar: 'Stellar', xrpl: 'XRPL', near: 'NEAR' };
  var TX = { stellar: 'https://stellar.expert/explorer/public/tx/', xrpl: 'https://xrpscan.com/tx/', near: 'https://nearblocks.io/txns/' };
  function addr() { try { return localStorage.getItem('lumos.address') || ''; } catch (e) { return ''; } }
  function walletNet(a) { return /^G[A-Z2-7]{55}$/.test(a) ? 'stellar' : (/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(a) ? 'xrpl' : (a ? 'near' : '')); }
  function pageNet() { var m = /^\/trade\/(stellar|xrpl|near)\/?$/.exec(location.pathname); return m ? m[1] : ''; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { n = +n || 0; return n >= 1 ? n.toLocaleString(undefined, { maximumFractionDigits: 4 }) : n.toLocaleString(undefined, { maximumSignificantDigits: 4 }); }
  function usd(n) { if (!(n > 0)) return ''; return '≈ $' + (n >= 1 ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : (n >= 0.01 ? n.toFixed(2) : n.toLocaleString(undefined, { maximumSignificantDigits: 2 }))); }
  function short(a) { a = String(a || ''); return a.length > 12 ? a.slice(0, 4) + '…' + a.slice(-4) : a; }
  function ago(t) {
    var s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 2592000) return Math.floor(s / 86400) + 'd ago'; return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function codeOf(id) { id = String(id || ''); var i = id.indexOf('-'); return i > 0 ? id.slice(0, i) : id.split('.')[0].toUpperCase(); }
  function css() {
    if (document.getElementById('lx-earn-css')) return;
    var s = document.createElement('style'); s.id = 'lx-earn-css';
    var B = 'var(--border,rgba(128,128,140,.22))', MU = 'var(--text-muted,#8b8b96)', S2 = 'var(--surface-2,rgba(128,128,140,.08))';
    s.textContent = ''
      + '.lx-earn-btn{display:inline-flex;align-items:center;gap:7px;padding:0 14px;border:1px solid var(--border,rgba(128,128,140,.25));background:var(--surface,transparent);color:var(--text,inherit);font:inherit;font-weight:600;font-size:13.5px;cursor:pointer;white-space:nowrap}'
      + '.lx-earn-btn:hover{background:var(--surface-2,rgba(128,128,140,.08))}'
      + '.lx-earn-btn svg{width:15px;height:15px;color:var(--accent,#ff6b1a)}'
      + '.lx-earn-btn.lx-earn-mob{height:34px;border-radius:999px;margin:8px 0 2px;font-size:13px}'
      + '.lx-earn-ov{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px}'
      + '.lx-earn-box{width:100%;max-width:520px;max-height:86vh;display:flex;flex-direction:column;background:var(--surface,#16161a);color:var(--text,#eee);border:1px solid ' + B + ';border-radius:16px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.35)}'
      + '.lxe-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px 20px 0}'
      + '.lxe-head h3{margin:0;font-size:17px;font-weight:700;letter-spacing:-.01em}'
      + '.lxe-who{margin-top:3px;font-size:12.5px;color:' + MU + '}'
      + '.lxe-who b{font-family:"JetBrains Mono",monospace;font-weight:500}'
      + '.lxe-net{display:inline-block;padding:1px 7px;border-radius:999px;background:' + S2 + ';font-size:11.5px;font-weight:600;margin-right:6px;color:var(--text,inherit)}'
      + '.lxe-x{border:0;background:transparent;color:' + MU + ';font-size:22px;line-height:1;cursor:pointer;padding:0 2px;margin-top:-2px}'
      + '.lxe-scroll{overflow:auto;padding:16px 20px 18px}'
      + '.lxe-hero{padding:16px;border-radius:14px;background:linear-gradient(135deg,var(--accent-pale,rgba(234,106,44,.10)),transparent 70%);border:1px solid ' + B + '}'
      + '.lxe-hero .l{font-size:11.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:' + MU + '}'
      + '.lxe-hero .v{margin-top:6px;display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px}'
      + '.lxe-hero .v b{font-family:"JetBrains Mono",monospace;font-size:26px;font-weight:700;letter-spacing:-.02em}'
      + '.lxe-hero .v span{font-size:13px;color:' + MU + '}'
      + '.lxe-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}'
      + '.lxe-stat{padding:8px 10px;border-radius:10px;background:var(--surface,transparent);border:1px solid ' + B + '}'
      + '.lxe-stat .k{font-size:11px;color:' + MU + '}'
      + '.lxe-stat .n{margin-top:2px;font-size:14px;font-weight:700;font-family:"JetBrains Mono",monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      + '.lxe-sec{margin:18px 0 8px;display:flex;align-items:center;justify-content:space-between;font-size:11.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:' + MU + '}'
      + '.lxe-sec span{font-weight:600;letter-spacing:0;text-transform:none}'
      + '.lxe-tok{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid ' + B + ';border-radius:12px;color:inherit;text-decoration:none;margin-bottom:8px;transition:background .15s}'
      + '.lxe-tok:hover{background:' + S2 + '}'
      + '.lxe-logo{width:36px;height:36px;border-radius:50%;flex:0 0 36px;object-fit:cover;background:' + S2 + '}'
      + '.lxe-av{width:36px;height:36px;border-radius:50%;flex:0 0 36px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;background:var(--accent-pale,rgba(234,106,44,.12));color:var(--accent,#ea6a2c)}'
      + '.lxe-tok .t{flex:1;min-width:0}'
      + '.lxe-tok .c{font-weight:700;font-size:14.5px}'
      + '.lxe-tok .nm{font-weight:500;color:' + MU + ';font-size:12.5px;margin-left:6px}'
      + '.lxe-tok .s{font-size:12px;color:' + MU + ';margin-top:2px}'
      + '.lxe-tok .r{text-align:right;flex:0 0 auto}'
      + '.lxe-tok .r b{display:block;font-family:"JetBrains Mono",monospace;font-size:14px}'
      + '.lxe-tok .r span{font-size:11.5px;color:' + MU + '}'
      + '.lxe-tok .ch{color:' + MU + ';font-size:16px;margin-left:2px}'
      + '.lxe-pay{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid ' + B + '}'
      + '.lxe-pay:first-of-type{border-top:0}'
      + '.lxe-pay .lxe-logo,.lxe-pay .lxe-av{width:24px;height:24px;flex:0 0 24px;font-size:10px}'
      + '.lxe-pay .t{flex:1;min-width:0;font-size:13.5px;font-weight:600}'
      + '.lxe-pay .t i{font-style:normal;font-weight:500;color:' + MU + ';font-size:12px;margin-left:6px}'
      + '.lxe-pay .a{font-family:"JetBrains Mono",monospace;font-weight:600;font-size:13.5px;color:var(--green,#22c55e);white-space:nowrap}'
      + '.lxe-pay a{color:' + MU + ';text-decoration:none;margin-left:8px;font-size:13px}'
      + '.lxe-pay a:hover{color:var(--text,inherit)}'
      + '.lxe-more{display:block;width:100%;margin-top:6px;padding:8px;border:1px solid ' + B + ';border-radius:10px;background:transparent;color:inherit;font:inherit;font-size:13px;font-weight:600;cursor:pointer}'
      + '.lxe-empty{padding:14px;border:1px dashed ' + B + ';border-radius:12px;color:' + MU + ';font-size:13px;line-height:1.5;text-align:center}'
      + '.lxe-foot{margin-top:16px;font-size:12px;color:' + MU + ';line-height:1.55}'
      + '.lxe-tier{margin-top:6px;font-size:11.5px;color:' + MU + ';display:flex;flex-wrap:wrap;align-items:center;gap:2px 6px}'
      + '.lxe-pct{padding:1px 7px;border-radius:999px;background:var(--accent-pale,rgba(234,106,44,.12));color:var(--accent,#ea6a2c);font-weight:700;font-size:11px}'
      + '.lxe-bar{margin-top:6px;height:4px;border-radius:999px;background:' + S2 + ';overflow:hidden;max-width:220px}'
      + '.lxe-bar i{display:block;height:100%;border-radius:999px;background:var(--accent,#ea6a2c)}'
      + '.lxe-skel{height:14px;border-radius:6px;background:' + S2 + ';margin:8px 0}'
      + '@media (max-width:480px){.lx-earn-ov{align-items:flex-end;padding:0}.lx-earn-box{max-width:none;border-radius:16px 16px 0 0;max-height:90vh}.lxe-hero .v b{font-size:22px}.lxe-scroll{padding:14px 16px 18px}.lxe-head{padding:16px 16px 0}}';
    document.head.appendChild(s);
  }
  var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M17 6.5c0-1.9-2.2-3.5-5-3.5s-5 1.6-5 3.5S9.2 10 12 10s5 1.6 5 3.5S14.8 17 12 17s-5-1.6-5-3.5"/></svg>';
  function mount() {
    // Desktop: the header's control group. Phone: the filter strip under the mode menu (.mdx-mk-filters).
    var net = pageNet(), a = addr(), ctl = document.querySelector('.dex-section-head .dex-mk-controls'), mob = false;
    // Not inside the phone filter strip: its own tap handler reloads the page on any tap within it. The heading row
    // ("All Trading Pairs" ... "+ Launch Token") instead.
    if (!ctl || !ctl.offsetParent) {
      var h2 = [].filter.call(document.querySelectorAll('h1,h2'), function (x) { return /All Trading Pairs/.test(x.textContent || '') && x.offsetParent; })[0];
      if (h2) { ctl = h2.parentNode; mob = true; }
    }
    var b = document.getElementById('lxEarnBtn');
    var show = !!(net && ctl && a && walletNet(a) === net);
    if (!show) { if (b) b.style.display = 'none'; return; }
    if (!b) {
      css();
      b = document.createElement('button'); b.type = 'button'; b.id = 'lxEarnBtn'; b.className = 'lx-earn-btn';
      b.innerHTML = ICON + '<span>My Earnings</span>';
      // Same height and corners as the control beside it, whatever that network's sheet makes them.
      var ref = !mob && ctl.querySelector('button, input');
      if (ref) { var cs = getComputedStyle(ref); b.style.height = cs.height; b.style.borderRadius = cs.borderRadius; }
      if (mob) b.classList.add('lx-earn-mob');
      if (mob) ctl.appendChild(b); else ctl.insertBefore(b, ctl.firstChild);
    }
    b.style.display = '';
  }

  // ---- data for the panel: logos, names, the coin's dollar price -----------------------------------------------------
  function getJ(u) { return fetch(u).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }
  function coinUsd(net) {
    if (net === 'stellar') return getJ('/lxapi/xlm').then(function (d) { return d && d.usd > 0 ? +d.usd : null; });
    if (net === 'xrpl') return getJ('/lxapi/xrpltoken?id=XRP').then(function (d) { return d && d.ok && d.usd > 0 ? +d.usd : null; });
    return getJ('/lxapi/neartoken?i=wrap.near').then(function (d) { return d && d.ok && d.usd > 0 ? +d.usd : null; });
  }
  // One entry per token: { logo, name }. Never rejects; a missing logo is a letter disc.
  function tokenMeta(net, ids) {
    var out = {};
    if (!ids.length) return Promise.resolve(out);
    if (net === 'stellar') {
      return Promise.all(ids.map(function (id) {
        return getJ('/lxapi/assetlogo?v=2&asset=' + encodeURIComponent(id)).then(function (d) { out[id] = { logo: (d && d.image) || '', name: (d && d.name) || '' }; });
      })).then(function () { return out; });
    }
    if (net === 'xrpl') {
      return getJ('/lxapi/assetmeta').then(function (d) {
        var mm = (d && d.mintmeta) || {};
        // No launch artwork on record (true of every XRPL mint so far): the same thumbnail the XRPL token page shows,
        // via /lxapi/xrplthumb (xrpl.to's image, fetched with our key server-side). A token with none falls to letters.
        var xcur = function (c) { if (c.length <= 3) return c; var h = ''; for (var i = 0; i < c.length; i++) h += c.charCodeAt(i).toString(16).toUpperCase(); while (h.length < 40) h += '0'; return h; };
        ids.forEach(function (id) {
          var m = mm[id] || {}, i = id.lastIndexOf('-'), code = id.slice(0, i), iss = id.slice(i + 1);
          var thumb = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(iss) ? '/lxapi/xrplthumb?iss=' + encodeURIComponent(iss) + '&cur=' + encodeURIComponent(xcur(code)) + '&w=64' : '';
          out[id] = { logo: m.image || thumb, name: m.name && m.name !== codeOf(id) ? m.name : '' };
        });
        return out;
      });
    }
    return Promise.all(ids.map(function (id) {
      var c = id.indexOf('-') > 0 ? id.slice(id.indexOf('-') + 1) : id;
      return getJ('/lxapi/neartoken?i=' + encodeURIComponent(c)).then(function (d) { out[id] = { logo: (d && d.ok && d.logo) || '', name: (d && d.ok && d.name) || '' }; });
    })).then(function () { return out; });
  }
  // MINTER TIERS (RAZA 2026-11-24): each token's share comes from its lifetime LumosCore volume (/lxapi/minters answers
  // share, tier, volume and the next step). Shown as fact, never as a promise.
  function tierInfo(net, ids) {
    var out = {};
    return Promise.all(ids.map(function (id) {
      var q = net === 'near' ? (id.indexOf('-') > 0 ? id.slice(id.indexOf('-') + 1) : id) : id;
      return getJ('/lxapi/minters?net=' + net + '&id=' + encodeURIComponent(q)).then(function (d) { if (d && d.ok && d.share) out[id] = d; });
    })).then(function () { return out; });
  }
  function money(n) { n = +n || 0; return n >= 1e6 ? '$' + (n / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 }) + 'M' : (n >= 1e3 ? '$' + (n / 1e3).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'K' : '$' + n.toLocaleString(undefined, { maximumFractionDigits: 2 })); }
  function tierLine(t) {
    if (!t) return '';
    var pct = Math.round(t.share * 100);
    return '<div class="lxe-tier"><span class="lxe-pct">' + pct + '% share</span>' + esc(money(t.volume)) + ' lifetime volume'
      + (t.next ? ' · ' + Math.round(t.next.share * 100) + '% from ' + esc(money(t.next.at)) : ' · top tier') + '</div>'
      + (t.next ? '<div class="lxe-bar"><i style="width:' + Math.max(1.5, Math.min(100, (t.volume / t.next.at) * 100)).toFixed(1) + '%"></i></div>' : '');
  }
  function logoHtml(meta, code) {
    if (meta && meta.logo) return '<img class="lxe-logo" alt="" src="' + esc(meta.logo) + '" onerror="this.outerHTML=\'<span class=&quot;lxe-av&quot;>' + esc(String(code).slice(0, 2)) + '</span>\'">';
    return '<span class="lxe-av">' + esc(String(code || '?').slice(0, 2)) + '</span>';
  }
  function pagePath(net, id) {
    if (net === 'near') { var c = id.indexOf('-') > 0 ? id.slice(id.indexOf('-') + 1) : id; return '/trade/near/' + encodeURIComponent(c); }
    return '/trade/' + net + '/' + encodeURIComponent(id);
  }

  function open() {
    var net = pageNet(), a = addr(); if (!net || !a) return;
    if (document.querySelector('.lx-earn-ov')) return;
    css();
    var ov = document.createElement('div'); ov.className = 'lx-earn-ov';
    ov.innerHTML = '<div class="lx-earn-box" role="dialog" aria-label="My Earnings">'
      + '<div class="lxe-head"><div><h3>My Earnings</h3><div class="lxe-who"><span class="lxe-net">' + esc(NAMES[net]) + '</span><b>' + esc(short(a)) + '</b></div></div>'
      + '<button type="button" class="lxe-x lx-earn-x" aria-label="Close">×</button></div>'
      + '<div class="lxe-scroll lx-earn-body"><div class="lxe-skel" style="height:96px;border-radius:14px"></div><div class="lxe-skel" style="height:56px;border-radius:12px;margin-top:18px"></div><div class="lxe-skel" style="width:60%"></div></div></div>';
    document.body.appendChild(ov);
    function close() { ov.remove(); document.removeEventListener('keydown', key); }
    function key(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', key);
    // The tap that opened the panel is followed by its own synthetic click, which lands on the backdrop: ignore clicks in
    // the first moment, or the panel would close as it opens.
    var opened = Date.now();
    ov.addEventListener('click', function (e) { if (Date.now() - opened < 450) return; if (e.target === ov || (e.target.closest && e.target.closest('.lx-earn-x'))) close(); });
    var body = ov.querySelector('.lx-earn-body');
    var fail = '<div class="lxe-empty">Could not read your earnings right now. Try again in a minute.</div>';
    getJ('/lxapi/earnings?net=' + net + '&addr=' + encodeURIComponent(a)).then(function (d) {
      if (!d || !d.ok) { body.innerHTML = fail; return; }
      var rows = (d.rows || []).slice().sort(function (x, y) { return Date.parse(y.at || 0) - Date.parse(x.at || 0); });
      var ids = (d.tokens || []).slice();
      // Payments name the token by its code; map each to its id (and keep any paid token the list did not name).
      var byCode = {}; ids.forEach(function (id) { byCode[codeOf(id)] = id; });
      rows.forEach(function (x) { var c = String(x.token || ''); if (c && !byCode[c]) { byCode[c] = c; ids.push(c); } });
      var per = {}; ids.forEach(function (id) { per[id] = { amt: 0, n: 0, last: 0 }; });
      rows.forEach(function (x) { var id = byCode[String(x.token || '')]; if (!id) return; var p = per[id]; p.amt += +x.amount || 0; p.n++; var t = Date.parse(x.at || 0) || 0; if (t > p.last) p.last = t; });
      // Earning tokens first, biggest first; then the rest by name.
      ids.sort(function (x, y) { return (per[y].amt - per[x].amt) || codeOf(x).localeCompare(codeOf(y)); });
      return Promise.all([tokenMeta(net, ids), coinUsd(net), tierInfo(net, ids)]).then(function (z) {
        var meta = z[0] || {}, px = z[1], tiers = z[2] || {}, unit = d.unit || (rows[0] && rows[0].unit) || '';
        var last = rows.length ? Date.parse(rows[0].at || 0) : 0;
        var h = '<div class="lxe-hero"><div class="l">Total received</div>'
          + '<div class="v"><b>' + esc(fmt(d.total)) + ' ' + esc(unit) + '</b>' + (px && d.total > 0 ? '<span>' + esc(usd(d.total * px)) + '</span>' : '') + '</div>'
          + '<div class="lxe-stats">'
          + '<div class="lxe-stat"><div class="k">Tokens</div><div class="n">' + ids.length + '</div></div>'
          + '<div class="lxe-stat"><div class="k">Payments</div><div class="n">' + rows.length + '</div></div>'
          + '<div class="lxe-stat"><div class="k">Last paid</div><div class="n" title="' + esc(last ? new Date(last).toLocaleString() : '') + '">' + (last ? esc(ago(last)) : '—') + '</div></div>'
          + '</div></div>';
        h += '<div class="lxe-sec">Your tokens' + (ids.length > 1 ? '<span>' + ids.length + '</span>' : '') + '</div>';
        if (!ids.length) {
          h += '<div class="lxe-empty">No token launched from this wallet was found on ' + esc(NAMES[net]) + '. Tokens you launch on the LumosCore Launchpad appear here.</div>';
        } else {
          h += ids.map(function (id) {
            var p = per[id], c = codeOf(id), m = meta[id] || {};
            return '<a class="lxe-tok" href="' + esc(pagePath(net, id)) + '">' + logoHtml(m, c)
              + '<div class="t"><div><span class="c">' + esc(c) + '</span>' + (m.name && m.name.toUpperCase() !== c ? '<span class="nm">' + esc(m.name) + '</span>' : '') + '</div>'
              + '<div class="s">' + (p.n ? p.n + ' payment' + (p.n === 1 ? '' : 's') + ' · last ' + esc(ago(p.last)) : 'No payments yet') + '</div>'
              + tierLine(tiers[id]) + '</div>'
              + '<div class="r"><b>' + esc(fmt(p.amt)) + ' ' + esc(unit) + '</b>' + (px && p.amt > 0 ? '<span>' + esc(usd(p.amt * px)) + '</span>' : '') + '</div>'
              + '<span class="ch">›</span></a>';
          }).join('');
        }
        h += '<div class="lxe-sec">Payments' + (rows.length ? '<span>' + rows.length + '</span>' : '') + '</div>';
        if (!rows.length) {
          h += '<div class="lxe-empty">No payments yet. Each one appears here once someone trades one of your tokens on LumosCore.</div>';
        } else {
          var LIM = 12;
          var pay = function (x) {
            var c = String(x.token || ''), id = byCode[c] || c, t = Date.parse(x.at || 0) || 0;
            return '<div class="lxe-pay">' + logoHtml(meta[id], c)
              + '<div class="t">' + esc(c || 'Trade') + '<i title="' + esc(t ? new Date(t).toLocaleString() : '') + '">' + (t ? esc(ago(t)) : '') + '</i></div>'
              + '<span class="a">+' + esc(fmt(x.amount)) + ' ' + esc(x.unit || unit) + '</span>'
              + (x.tx ? '<a target="_blank" rel="noopener" title="View the transaction" href="' + esc(TX[net] + x.tx) + '">↗</a>' : '') + '</div>';
          };
          h += '<div class="lxe-pays">' + rows.slice(0, LIM).map(pay).join('') + '</div>';
          if (rows.length > LIM) h += '<button type="button" class="lxe-more">Show all ' + rows.length + ' payments</button>';
          ov.__lxAll = rows.map(pay).join('');
        }
        if (d.partial) h += '<div class="lxe-foot">Part of the history could not be read just now, so this list may be incomplete.</div>';
        h += '<div class="lxe-foot">Each payment is your token’s share of LumosCore’s fee on a LumosCore trade of the token worth 1 ' + esc(unit || 'coin') + ' or more, sent to this wallet inside that trade. The share rises with the token’s lifetime volume on LumosCore: 30%, then 40% from $100K, 50% from $1M, 60% from $10M and 70% from $100M. Trades from your own wallets are not counted.</div>';
        body.innerHTML = h;
        var more = body.querySelector('.lxe-more');
        if (more) more.addEventListener('click', function () { body.querySelector('.lxe-pays').innerHTML = ov.__lxAll; more.remove(); });
      });
    }).catch(function () { body.innerHTML = fail; });
  }
  // Capture phase on the document: the phone filter strip handles its own taps and does not let a click reach a child
  // button's listener, so the button is answered before the strip sees the event.
  function hit(e) {
    var t = e.target && e.target.closest && e.target.closest('#lxEarnBtn');
    if (!t) return; e.preventDefault(); e.stopPropagation(); open();
  }
  document.addEventListener('click', hit, true);
  // Phones: the site's tap bridge can cancel a touch before any click exists, so the touch itself opens the panel too.
  document.addEventListener('touchend', hit, { capture: true, passive: false });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  setInterval(mount, 1500);
})();
