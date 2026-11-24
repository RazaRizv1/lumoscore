// "MY EARNINGS" (RAZA 2026-11-24). A Launchpad minter receives 30-70% of LumosCore's fee on every LumosCore trade of
// their token, paid inside the trade (see functions/lxapi/minters.js). Data: /lxapi/earnings (the wallet's Launchpad
// tokens + every payment received), /lxapi/minters (tier), logos and the coin's dollar price.
// Copy states the mechanism only -- no claim about what anyone will earn.
//
// v5 -- A PAGE, NOT A POPUP (RAZA 2026-11-24: "My earnings is not suitable as a popup but as a new page in the side
// menu ... only visible after someone has minted any token on LumosCore ... Also show My earnings in some tab in Wallet
// page ... never indexed like /wallet and remains hidden until someone has connected and has at least 1 mint"):
//   * /earnings -- the full page. Served by the middleware from the Wallet page's shell (so it gets the right network's
//     chrome from the lx_chain cookie, exactly like /wallet), noindex, never in the sitemap. This script swaps the
//     wallet content for the earnings view. Anyone not eligible (no wallet connected, or a wallet with no Launchpad
//     mint on its network) is sent to /wallet: the page never shows to them.
//   * "My Earnings" in the desktop side menu (under Wallet) and the phone slide-out menu -- only for an eligible wallet.
//   * an "Earnings" tab beside Assets / Liq Pools on /wallet -- only for an eligible wallet; a compact view + a link.
//   * the Trade page button and popup are gone.
// Eligibility = the connected wallet's /lxapi/earnings lists at least one token. Remembered per wallet for 15 minutes
// (localStorage, best effort) so the menu item does not flicker in on every page.
(function () {
  if (window.__lxEarn) return; window.__lxEarn = 1;
  var NAMES = { stellar: 'Stellar', xrpl: 'XRPL', near: 'NEAR' };
  var TX = { stellar: 'https://stellar.expert/explorer/public/tx/', xrpl: 'https://xrpscan.com/tx/', near: 'https://nearblocks.io/txns/' };
  var PAGE = location.pathname.replace(/\/+$/, '') === '/earnings';
  var WALLET = location.pathname.replace(/\/+$/, '') === '/wallet';
  function addr() { try { return localStorage.getItem('lumos.address') || ''; } catch (e) { return ''; } }
  function walletNet(a) { return /^G[A-Z2-7]{55}$/.test(a) ? 'stellar' : (/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(a) ? 'xrpl' : (a ? 'near' : '')); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { n = +n || 0; return n >= 1 ? n.toLocaleString(undefined, { maximumFractionDigits: 4 }) : n.toLocaleString(undefined, { maximumSignificantDigits: 4 }); }
  function usd(n) { if (!(n > 0)) return ''; return '≈ $' + (n >= 1 ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : (n >= 0.01 ? n.toFixed(2) : n.toLocaleString(undefined, { maximumSignificantDigits: 2 }))); }
  function short(a) { a = String(a || ''); return a.length > 12 ? a.slice(0, 4) + '…' + a.slice(-4) : a; }
  function ago(t) {
    var s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 2592000) return Math.floor(s / 86400) + 'd ago';
    var d = new Date(t); return d.toLocaleDateString(undefined, d.getFullYear() === new Date().getFullYear() ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function codeOf(id) { id = String(id || ''); var i = id.indexOf('-'); return i > 0 ? id.slice(0, i) : id.split('.')[0].toUpperCase(); }
  var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M14.8 9.2c-.5-.9-1.6-1.4-2.8-1.4-1.6 0-2.8.8-2.8 2s1.2 1.7 2.8 2c1.6.3 2.8.9 2.8 2.1s-1.2 2.1-2.8 2.1c-1.3 0-2.4-.6-2.9-1.5"/><path d="M12 6.3v1.5M12 16.2v1.5"/></svg>';

  function css() {
    if (document.getElementById('lx-earn-css')) return;
    var s = document.createElement('style'); s.id = 'lx-earn-css';
    var B = 'var(--border,rgba(128,128,140,.22))', MU = 'var(--text-muted,#8b8b96)', SO = 'var(--text-soft,' + MU + ')', S2 = 'var(--surface-2,rgba(128,128,140,.08))';
    var MONO = '"JetBrains Mono",monospace';
    s.textContent = ''
      // the page shell
      + 'html.lx-earn-page main.page>*:not(.lx-earnv),html.lx-earn-page section.lx-faq{display:none!important}'   // the Wallet page\'s own FAQ is about wallets
      + '.lx-earnv{max-width:1180px;width:100%;margin:0 auto;padding:8px 0 48px}'
      + '.lx-earnv-h{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:6px 0 22px}'
      + '.lx-earnv-h h1{margin:0;font-size:30px;font-weight:800;letter-spacing:-.02em;line-height:1.15}'
      + '.lx-earnv-h .lxe-who{margin-top:8px}'
      + '.lxe-who{font-size:12.5px;color:' + MU + '}'
      + '.lxe-who b{font-family:' + MONO + ';font-weight:500}'
      + '.lxe-net{display:inline-block;padding:1px 8px;border-radius:999px;background:' + S2 + ';border:1px solid ' + B + ';font-size:11.5px;font-weight:600;margin-right:6px;color:var(--text,inherit)}'
      // v6 (RAZA 2026-11-24 "same as the popup ... this page can have 10s of assets"): the pairs table's own language.
      // stats strip
      + '.lxe-strip{display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:12px}'
      + '.lxe-st{border:1px solid ' + B + ';border-radius:14px;background:var(--surface,transparent);padding:14px 16px;min-width:0}'
      + '.lxe-st .k{font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:' + SO + '}'
      + '.lxe-st .n{margin-top:8px;font-family:' + MONO + ';font-size:20px;font-weight:700;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      + '.lxe-st .u{margin-top:3px;font-size:12.5px;color:' + MU + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      + '.lxe-st.main{background:linear-gradient(135deg,var(--accent-pale,rgba(234,106,44,.10)),transparent 75%),var(--surface,transparent)}'
      + '.lxe-st.main .n{font-size:26px;color:var(--text,inherit)}'
      // table cards
      + '.lxe-card{margin-top:22px;border:1px solid ' + B + ';border-radius:14px;background:var(--surface,transparent);overflow:hidden}'
      + '.lxe-bar0{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px 12px;flex-wrap:wrap}'
      + '.lxe-bar0 h2{margin:0;font-size:17px;font-weight:750;letter-spacing:-.01em;display:flex;align-items:center;gap:8px}'
      + '.lxe-bar0 h2 span{font-size:12px;font-weight:600;color:' + MU + ';padding:1px 8px;border-radius:999px;background:' + S2 + '}'
      + '.lxe-q{display:flex;align-items:center;gap:8px;height:34px;padding:0 12px;border:1px solid ' + B + ';border-radius:10px;background:var(--surface-2,' + S2 + ');min-width:220px}'
      + '.lxe-q svg{width:14px;height:14px;color:' + SO + ';flex:none}'
      + '.lxe-q input{border:0;outline:0;background:transparent;color:inherit;font:inherit;font-size:13.5px;width:100%}'
      + '.lxe-th,.lxe-tr{display:grid;grid-template-columns:minmax(170px,1.5fr) minmax(190px,1.45fr) minmax(96px,.9fr) minmax(76px,.6fr) minmax(130px,1fr) minmax(88px,.7fr) 18px;align-items:center;gap:12px;padding:0 16px}'
      + '.lxe-th{min-height:44px;background:var(--surface-2,' + S2 + ');border-top:1px solid ' + B + ';border-bottom:1px solid ' + B + ';font-size:12.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:' + SO + '}'
      + '.lxe-th>div{white-space:nowrap}.lxe-th .r,.lxe-tr .r{text-align:right}'
      + '.lxe-th [data-k]{cursor:pointer;user-select:none}.lxe-th [data-k]:hover{color:var(--text,inherit)}'
      + '.lxe-th .on{color:var(--accent,#ea6a2c)}'
      + '.lxe-tr{min-height:68px;border-top:1px solid ' + B + ';color:inherit;text-decoration:none;transition:background .15s}'
      + '.lxe-th+.lxe-tr{border-top:0}'
      + '.lxe-tr:hover{background:' + S2 + '}'
      + '.lxe-tk{display:flex;align-items:center;gap:12px;min-width:0}'
      + '.lxe-tk .c{font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      + '.lxe-tk .nm{font-size:12px;color:' + MU + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}'
      + '.lxe-logo{width:36px;height:36px;border-radius:50%;flex:0 0 36px;object-fit:cover;background:' + S2 + ';box-shadow:0 0 0 1px ' + B + '}'
      + '.lxe-av{width:36px;height:36px;border-radius:50%;flex:0 0 36px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;background:var(--accent-pale,rgba(234,106,44,.12));color:var(--accent,#ea6a2c)}'
      + '.lxe-sh{min-width:0}'
      + '.lxe-pct{display:inline-block;padding:1px 8px;border-radius:999px;background:var(--accent-pale,rgba(234,106,44,.12));color:var(--accent,#ea6a2c);font-weight:700;font-size:11.5px}'
      + '.lxe-sh .nx{font-size:11.5px;color:' + MU + ';margin-left:6px;white-space:nowrap}'
      + '.lxe-pb{margin-top:7px;height:4px;border-radius:999px;background:' + S2 + ';overflow:hidden;max-width:180px}'
      + '.lxe-pb i{display:block;height:100%;border-radius:999px;background:var(--accent,#ea6a2c)}'
      + '.lxe-mono{font-family:' + MONO + ';font-size:14px;font-weight:600;white-space:nowrap}'
      + '.lxe-tr .sub,.lxe-pr .sub{display:block;font-size:12px;color:' + MU + ';font-weight:500;margin-top:2px;font-family:inherit}'
      + '.lxe-tr,.lxe-pr{font-size:13.5px}.lxe-tr .c-l,.lxe-pr .c-w{font-size:13px;white-space:nowrap}'
      + '.lxe-tr .ch{color:' + MU + ';font-size:16px;text-align:right}'
      + '.lxe-dim{color:' + MU + '}'
      + '.lxe-earned{color:var(--green,#22c55e)}'
      // payments
      + '.lxe-ph,.lxe-pr{display:grid;grid-template-columns:minmax(150px,1.2fr) minmax(120px,1fr) minmax(130px,1fr) 40px;align-items:center;gap:12px;padding:0 16px}'
      + '.lxe-ph{min-height:44px;background:var(--surface-2,' + S2 + ');border-top:1px solid ' + B + ';border-bottom:1px solid ' + B + ';font-size:12.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:' + SO + '}'
      + '.lxe-ph .r,.lxe-pr .r{text-align:right}'
      + '.lxe-pr{min-height:54px;border-top:1px solid ' + B + '}.lxe-ph+.lxe-pr{border-top:0}'
      + '.lxe-pr .lxe-logo,.lxe-pr .lxe-av{width:26px;height:26px;flex:0 0 26px;font-size:10px}'
      + '.lxe-pr .tx{color:' + MU + ';text-decoration:none;font-size:15px;text-align:right}.lxe-pr .tx:hover{color:var(--text,inherit)}'
      + '.lxe-more{display:block;width:calc(100% - 32px);margin:12px 16px 16px;padding:10px;border:1px solid ' + B + ';border-radius:10px;background:transparent;color:inherit;font:inherit;font-size:13px;font-weight:650;cursor:pointer}'
      + '.lxe-more:hover{background:' + S2 + '}'
      + '.lxe-none{padding:26px 16px;text-align:center;color:' + MU + ';font-size:13.5px;line-height:1.5;border-top:1px solid ' + B + '}'
      + '.lxe-foot{margin-top:18px;font-size:12.5px;color:' + MU + ';line-height:1.6;max-width:820px}'
      + '.lxe-skel{height:14px;border-radius:8px;background:' + S2 + ';margin:8px 0}'
      // phones / narrow: rows become two-line cards
      + '@media (max-width:860px){'
      + '.lxe-strip{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.lxe-st.main{grid-column:1/-1}.lxe-st{padding:11px 12px}.lxe-st .n{font-size:16px}.lxe-st .u{font-size:11px}.lxe-st .k{font-size:11px}'
      + '.lxe-th{display:none}'
      + '.lxe-tr{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"tk e" "sh m";gap:8px 12px;padding:12px 14px;min-height:0}'
      + '.lxe-tr .c-tk{grid-area:tk}.lxe-tr .c-e{grid-area:e}.lxe-tr .c-sh{grid-area:sh}.lxe-tr .c-m{grid-area:m;text-align:right;font-size:12px;color:' + MU + '}'
      + '.lxe-tr .c-v,.lxe-tr .c-p,.lxe-tr .c-l,.lxe-tr .ch{display:none}'
      + '.lxe-ph{display:none}'
      + '.lxe-pr{grid-template-columns:minmax(0,1fr) auto 28px;grid-template-areas:"tk a x" "w a x";gap:2px 10px;padding:10px 14px}'
      + '.lxe-pr .c-tk{grid-area:tk}.lxe-pr .c-a{grid-area:a}.lxe-pr .c-w{grid-area:w;font-size:12px;color:' + MU + ';text-align:left;padding-left:36px}.lxe-pr .tx{grid-area:x}'
      + '.lxe-st .u{white-space:normal;line-height:1.3}'
      + '.lxe-q{min-width:0;flex:1}'
      + '.lx-earnv-h h1{font-size:24px}.lxe-st.main .n{font-size:22px}'
      + '}'
      + '@media (min-width:861px){.lxe-tr .c-m{display:none}}'
      // the Wallet tab
      + '.lx-earn-tabpanel{margin-top:12px}'
      + '.lx-earn-tabpanel .lxe-card{margin-top:14px}'
      + '.lx-earn-full{display:inline-flex;align-items:center;gap:6px;color:var(--accent,#ea6a2c);font-weight:650;font-size:13.5px;text-decoration:none}'
      + '.lx-earn-full:hover{text-decoration:underline}'
      + '.lx-earn-tabpanel>.lx-earn-full{margin:14px 0 30px!important}'
      // the menu items
      + '.lx-earn-mi .nx-ico svg,.lx-earn-mi svg{width:20px;height:20px}';
    document.head.appendChild(s);
  }

  // ---- data ------------------------------------------------------------------------------------------------------------
  function getJ(u) { return fetch(u).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }
  function coinUsd(net) {
    if (net === 'stellar') return getJ('/lxapi/xlm').then(function (d) { return d && d.usd > 0 ? +d.usd : null; });
    if (net === 'xrpl') return getJ('/lxapi/xrpltoken?id=XRP').then(function (d) { return d && d.ok && d.usd > 0 ? +d.usd : null; });
    return getJ('/lxapi/neartoken?i=wrap.near').then(function (d) { return d && d.ok && d.usd > 0 ? +d.usd : null; });
  }
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

  // ---- eligibility: connected + at least one Launchpad mint on the wallet's network --------------------------------
  var EK = 'lx.earn.minter';
  function cached(a) { try { var c = JSON.parse(localStorage.getItem(EK) || 'null'); if (c && c.a === a && Date.now() - c.at < 900000) return c.yes; } catch (e) {} return null; }
  function remember(a, yes) { try { localStorage.setItem(EK, JSON.stringify({ a: a, yes: !!yes, at: Date.now() })); } catch (e) {} }
  var EARN = null;   // the last /lxapi/earnings answer for this wallet (reused by the views)
  function check(a) {
    var net = walletNet(a);
    return getJ('/lxapi/earnings?net=' + net + '&addr=' + encodeURIComponent(a)).then(function (d) {
      if (!d || !d.ok) return null;                          // could not tell: change nothing
      EARN = d;
      var yes = (d.tokens || []).length > 0 || (d.rows || []).length > 0;
      remember(a, yes); return yes;
    });
  }

  // ---- the view (full page or the Wallet tab) ----------------------------------------------------------------------
  // v6 (RAZA 2026-11-24 "i dont like my earnings page ... this page can have 10s of assets"): built like the Trade
  // pairs table -- a stats strip, a sortable + searchable "Your tokens" table (15 rows, then Show more) and a paged
  // payments table. Phones and narrow screens get two-line rows. The Wallet tab shows the strip + the top 5 tokens.
  var SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
  function render(box, net, a, compact) {
    var fail = '<div class="lxe-none" style="border:1px dashed var(--border);border-radius:14px">Could not read your earnings right now. Try again in a minute.</div>';
    box.innerHTML = '<div class="lxe-skel" style="height:96px;border-radius:14px"></div><div class="lxe-skel" style="height:260px;border-radius:14px;margin-top:22px"></div>';
    (EARN ? Promise.resolve(EARN) : getJ('/lxapi/earnings?net=' + net + '&addr=' + encodeURIComponent(a))).then(function (d) {
      if (!d || !d.ok) { box.innerHTML = fail; return; }
      var rows = (d.rows || []).slice().sort(function (x, y) { return Date.parse(y.at || 0) - Date.parse(x.at || 0); });
      var ids = (d.tokens || []).slice();
      var byCode = {}; ids.forEach(function (id) { byCode[codeOf(id)] = id; });
      rows.forEach(function (x) { var c = String(x.token || ''); if (c && !byCode[c]) { byCode[c] = c; ids.push(c); } });
      var per = {}; ids.forEach(function (id) { per[id] = { amt: 0, n: 0, last: 0 }; });
      rows.forEach(function (x) { var id = byCode[String(x.token || '')]; if (!id) return; var p = per[id]; p.amt += +x.amount || 0; p.n++; var t = Date.parse(x.at || 0) || 0; if (t > p.last) p.last = t; });
      return Promise.all([tokenMeta(net, ids), coinUsd(net), tierInfo(net, ids)]).then(function (z) {
        var meta = z[0] || {}, px = z[1], tiers = z[2] || {}, unit = d.unit || (rows[0] && rows[0].unit) || '';
        var last = rows.length ? Date.parse(rows[0].at || 0) : 0;
        var T = ids.map(function (id) { var t = tiers[id] || {}; return { id: id, c: codeOf(id), m: meta[id] || {}, p: per[id], t: tiers[id], vol: +t.volume || 0 }; });
        // ---- strip
        var h = '<div class="lxe-strip">'
          + '<div class="lxe-st main"><div class="k">Total received</div><div class="n">' + esc(fmt(d.total)) + ' ' + esc(unit) + '</div><div class="u">' + (px && d.total > 0 ? esc(usd(d.total * px)) : '&nbsp;') + '</div></div>'
          + '<div class="lxe-st"><div class="k">Tokens</div><div class="n">' + T.length + '</div><div class="u">launched by this wallet</div></div>'
          + '<div class="lxe-st"><div class="k">Payments</div><div class="n">' + rows.length + '</div><div class="u">received in trades</div></div>'
          + '<div class="lxe-st"><div class="k">Last paid</div><div class="n" title="' + esc(last ? new Date(last).toLocaleString() : '') + '">' + (last ? esc(ago(last)) : '—') + '</div><div class="u">' + (last ? esc(new Date(last).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })) : 'no payments yet') + '</div></div>'
          + '</div>';
        // ---- tokens table
        var state = { k: 'amt', dir: -1, q: '', shown: compact ? 5 : 15 };
        h += '<div class="lxe-card lxe-toks"><div class="lxe-bar0"><h2>Your tokens<span>' + T.length + '</span></h2>'
          + (!compact && T.length > 6 ? '<label class="lxe-q">' + SEARCH + '<input type="search" placeholder="Search your tokens" aria-label="Search your tokens"></label>' : '')
          + '</div><div class="lxe-tbody"></div></div>';
        // ---- payments table
        if (!compact) h += '<div class="lxe-card lxe-pays"><div class="lxe-bar0"><h2>Payments<span>' + rows.length + '</span></h2></div><div class="lxe-pbody"></div></div>';
        if (d.partial) h += '<div class="lxe-foot">Part of the history could not be read just now, so these lists may be incomplete.</div>';
        if (!compact) h += '<div class="lxe-foot">Each payment is your token’s share of LumosCore’s fee on a LumosCore trade of the token worth 1 ' + esc(unit || 'coin') + ' or more, sent to this wallet inside that trade. The share rises with the token’s lifetime volume on LumosCore: 30%, then 40% from $100K, 50% from $1M, 60% from $10M and 70% from $100M. Trades from your own wallets are not counted.</div>';
        box.innerHTML = h;

        var COLS = [['tk', 'Token', 'c'], ['sh', 'Your share', 'share'], ['v', 'Lifetime volume', 'vol', 'r'], ['p', 'Payments', 'n', 'r'], ['e', 'Earned', 'amt', 'r'], ['l', 'Last paid', 'last', 'r']];
        function val(r, k) { return k === 'c' ? r.c : (k === 'share' ? (r.t ? r.t.share : 0) : (k === 'vol' ? r.vol : r.p[k])); }
        function shareCell(t) {
          if (!t) return '<span class="lxe-dim">—</span>';
          return '<span class="lxe-pct">' + Math.round(t.share * 100) + '%</span>'
            + '<span class="nx">' + (t.next ? Math.round(t.next.share * 100) + '% from ' + esc(money(t.next.at)) : 'top tier') + '</span>'
            + (t.next ? '<div class="lxe-pb"><i style="width:' + Math.max(1.5, Math.min(100, (t.volume / t.next.at) * 100)).toFixed(1) + '%"></i></div>' : '');
        }
        function drawTokens() {
          var q = state.q.trim().toUpperCase();
          var list = T.filter(function (r) { return !q || r.c.toUpperCase().indexOf(q) >= 0 || String(r.m.name || '').toUpperCase().indexOf(q) >= 0; });
          list.sort(function (x, y) { var a1 = val(x, state.k), b1 = val(y, state.k); var c = (typeof a1 === 'string') ? String(a1).localeCompare(b1) : ((a1 || 0) - (b1 || 0)); return (c * state.dir) || x.c.localeCompare(y.c); });
          var th = '<div class="lxe-th">' + COLS.map(function (c) { var on = state.k === c[2]; return '<div class="' + (c[3] || '') + (on ? ' on' : '') + '" data-k="' + c[2] + '">' + esc(c[1]) + (on ? (state.dir < 0 ? ' ↓' : ' ↑') : '') + '</div>'; }).join('') + '<div></div></div>';
          var body = list.slice(0, state.shown).map(function (r) {
            var p = r.p;
            return '<a class="lxe-tr" href="' + esc(pagePath(net, r.id)) + '">'
              + '<div class="c-tk lxe-tk">' + logoHtml(r.m, r.c) + '<div style="min-width:0"><div class="c">' + esc(r.c) + '</div>' + (r.m.name && r.m.name.toUpperCase() !== r.c ? '<div class="nm">' + esc(r.m.name) + '</div>' : '') + '</div></div>'
              + '<div class="c-sh lxe-sh">' + shareCell(r.t) + '</div>'
              + '<div class="c-v r lxe-mono">' + (r.t ? esc(money(r.vol)) : '<span class="lxe-dim">—</span>') + '</div>'
              + '<div class="c-p r lxe-mono">' + p.n + '</div>'
              + '<div class="c-e r"><span class="lxe-mono' + (p.amt > 0 ? ' lxe-earned' : ' lxe-dim') + '">' + esc(fmt(p.amt)) + ' ' + esc(unit) + '</span>' + (px && p.amt > 0 ? '<span class="sub">' + esc(usd(p.amt * px)) + '</span>' : '') + '</div>'
              + '<div class="c-l r lxe-dim" title="' + esc(p.last ? new Date(p.last).toLocaleString() : '') + '">' + (p.last ? esc(ago(p.last)) : '—') + '</div>'
              + '<div class="c-m">' + p.n + ' payment' + (p.n === 1 ? '' : 's') + (p.last ? ' · ' + esc(ago(p.last)) : '') + '</div>'
              + '<span class="ch">›</span></a>';
          }).join('');
          var more = list.length > state.shown ? (compact ? '<a class="lx-earn-full" href="/earnings" style="margin:12px 16px 16px">See all ' + list.length + ' tokens ›</a>' : '<button type="button" class="lxe-more lxe-more-t">Show more (' + (list.length - state.shown) + ' more)</button>') : '';
          var none = !T.length ? '<div class="lxe-none">No token launched from this wallet was found on ' + esc(NAMES[net]) + '.</div>' : (!list.length ? '<div class="lxe-none">No token matches “' + esc(state.q) + '”.</div>' : '');
          box.querySelector('.lxe-tbody').innerHTML = (list.length ? th + body : '') + none + more;
        }
        var shownPays = 15;
        function drawPays() {
          var pb = box.querySelector('.lxe-pbody'); if (!pb) return;
          if (!rows.length) { pb.innerHTML = '<div class="lxe-none">No payments yet. Each one appears here once someone trades one of your tokens on LumosCore.</div>'; return; }
          var th = '<div class="lxe-ph"><div>Token</div><div class="r">Amount</div><div class="r">When</div><div></div></div>';
          pb.innerHTML = th + rows.slice(0, shownPays).map(function (x) {
            var c = String(x.token || ''), id = byCode[c] || c, t = Date.parse(x.at || 0) || 0;
            return '<div class="lxe-pr"><div class="c-tk lxe-tk">' + logoHtml(meta[id], c) + '<span class="c" style="font-size:14px">' + esc(c || 'Trade') + '</span></div>'
              + '<div class="c-a r lxe-mono lxe-earned">+' + esc(fmt(x.amount)) + ' ' + esc(x.unit || unit) + (px ? '<span class="sub">' + esc(usd((+x.amount || 0) * px)) + '</span>' : '') + '</div>'
              + '<div class="c-w r lxe-dim" title="' + esc(t ? new Date(t).toLocaleString() : '') + '">' + (t ? esc(ago(t)) : '') + '</div>'
              + (x.tx ? '<a class="tx" target="_blank" rel="noopener" title="View the transaction" href="' + esc(TX[net] + x.tx) + '">↗</a>' : '<span></span>') + '</div>';
          }).join('') + (rows.length > shownPays ? '<button type="button" class="lxe-more lxe-more-p">Show more (' + (rows.length - shownPays) + ' more)</button>' : '');
        }
        drawTokens(); drawPays();
        box.addEventListener('click', function (e) {
          var k = e.target.closest && e.target.closest('.lxe-th [data-k]');
          if (k) { var key = k.getAttribute('data-k'); if (state.k === key) state.dir = -state.dir; else { state.k = key; state.dir = key === 'c' ? 1 : -1; } drawTokens(); return; }
          if (e.target.closest && e.target.closest('.lxe-more-t')) { state.shown += 15; drawTokens(); return; }
          if (e.target.closest && e.target.closest('.lxe-more-p')) { shownPays += 15; drawPays(); }
        });
        var qi = box.querySelector('.lxe-q input');
        if (qi) qi.addEventListener('input', function () { state.q = qi.value; state.shown = 15; drawTokens(); });
      });
    }).catch(function () { box.innerHTML = fail; });
  }

  // ---- /earnings ---------------------------------------------------------------------------------------------------
  function page(a) {
    var net = walletNet(a), main = document.querySelector('main.page') || document.querySelector('main');
    if (!main) return false;
    if (main.querySelector('.lx-earnv')) return true;
    css();
    document.title = 'My Earnings | LumosCore';
    var v = document.createElement('section'); v.className = 'lx-earnv';
    v.innerHTML = '<div class="lx-earnv-h"><div><h1>My Earnings</h1><div class="lxe-who"><span class="lxe-net">' + esc(NAMES[net]) + '</span><b>' + esc(short(a)) + '</b></div></div></div><div class="lx-earnv-b"></div>';
    main.insertBefore(v, main.firstChild);
    render(v.querySelector('.lx-earnv-b'), net, a, false);
    return true;
  }

  // ---- menus: desktop side menu (under Wallet) + phone slide-out menu ----------------------------------------------
  function menus(on) {
    // desktop
    var w = document.querySelector('.nx-side a.nx-item[data-id="wallet"], nav.nx-nav a.nx-item[data-id="wallet"]');
    var mine = document.querySelector('a.nx-item[data-id="earnings"]');
    if (!on) { if (mine) mine.remove(); }
    else if (w && !mine) {
      var it = w.cloneNode(true);
      it.setAttribute('data-id', 'earnings'); it.setAttribute('href', '/earnings'); it.setAttribute('title', 'My Earnings'); it.setAttribute('data-lxnonav', '1');
      it.classList.remove('active'); it.classList.add('lx-earn-mi');
      var ic = it.querySelector('.nx-ico'), lb = it.querySelector('.nx-lab');
      if (ic) ic.innerHTML = ICON; if (lb) lb.textContent = 'My Earnings';
      if (!lb && !ic) it.textContent = 'My Earnings';
      w.parentNode.insertBefore(it, w.nextSibling);
      mine = it;
    }
    if (mine && PAGE) { [].forEach.call(document.querySelectorAll('a.nx-item.active'), function (x) { if (x !== mine) x.classList.remove('active'); }); mine.classList.add('active'); }
    // phone slide-out menu: a sibling of its Wallet link
    var mw = [].filter.call(document.querySelectorAll('nav.menu-links a'), function (x) { return (x.getAttribute('href') || '').replace(/\/+$/, '') === '/wallet'; })[0];
    var mm = document.querySelector('nav.menu-links a.lx-earn-mi');
    if (!on) { if (mm) mm.remove(); }
    else if (mw && !mm) {
      var m2 = mw.cloneNode(true);
      m2.setAttribute('href', '/earnings'); m2.classList.add('lx-earn-mi'); m2.classList.remove('active'); m2.setAttribute('data-lxnonav', '1');
      // keep the link's own icon slot if it has one; swap its text for ours
      var svg = m2.querySelector('svg'); if (svg) { var t = document.createElement('span'); t.innerHTML = ICON; svg.parentNode.replaceChild(t.firstChild, svg); }
      var tn = null; (function walk(n) { for (var i = 0; i < n.childNodes.length && !tn; i++) { var c = n.childNodes[i]; if (c.nodeType === 3 && /Wallet/.test(c.nodeValue)) tn = c; else if (c.nodeType === 1) walk(c); } })(m2);
      if (tn) tn.nodeValue = tn.nodeValue.replace(/My Wallet|Wallet/, 'My Earnings'); else m2.textContent = 'My Earnings';
      mw.parentNode.insertBefore(m2, mw.nextSibling);
    }
  }

  // ---- /wallet: an "Earnings" tab beside Assets / Liq Pools ---------------------------------------------------------
  function walletTab(a, on) {
    var tabs = [].filter.call(document.querySelectorAll('.asset-tabs'), function (t) { return !t.classList.contains('lx-wcgroup') && t.offsetParent && /Assets/.test(t.textContent || ''); })[0];
    var mine = document.querySelector('.lx-earn-tab');
    if (!on) { if (mine) mine.remove(); return; }
    if (!tabs || mine) return;
    css();
    var b = document.createElement('button'); b.type = 'button'; b.className = 'lx-earn-tab'; b.textContent = 'Earnings';
    tabs.appendChild(b);
    // what the tab hides while it is open: everything after the tab row up to the next section heading
    var row = tabs.closest('.asset-tabs-row') || tabs;
    var panel = null, hidden = [];
    function show() {
      [].forEach.call(tabs.children, function (x) { x.classList.toggle('active', x === b); });
      hidden = [];
      for (var n = row.nextElementSibling; n && !n.classList.contains('section-heading'); n = n.nextElementSibling) {
        if (n.classList.contains('lx-earn-tabpanel')) continue;
        hidden.push([n, n.style.display]); n.style.display = 'none';
      }
      var sb = row.querySelector('.search-box'); if (sb) { hidden.push([sb, sb.style.display]); sb.style.display = 'none'; }
      if (!panel) {
        panel = document.createElement('div'); panel.className = 'lx-earn-tabpanel';
        panel.innerHTML = '<div class="lx-earn-tabb"></div><a class="lx-earn-full" href="/earnings" style="margin-top:14px">Open My Earnings ›</a>';
        row.parentNode.insertBefore(panel, row.nextSibling);
        render(panel.querySelector('.lx-earn-tabb'), walletNet(a), a, true);
      }
      panel.style.display = '';
    }
    function hide() {
      if (panel) panel.style.display = 'none';
      hidden.forEach(function (h) { h[0].style.display = h[1]; }); hidden = [];
      b.classList.remove('active');
    }
    b.addEventListener('click', function (e) { e.preventDefault(); show(); });
    // any other tab in the row closes ours first; the page's own handler then does its job as before
    tabs.addEventListener('click', function (e) { var t = e.target.closest && e.target.closest('button'); if (t && t !== b && panel && panel.style.display !== 'none') hide(); }, true);
  }

  // ---- links in our views and menu items: claimed before the design's row navigator can swallow them -----------------
  window.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('a.lx-earn-mi, .lx-earnv a[href], .lx-earn-tabpanel a[href]') : null;
    if (!t) return;
    var go = t.getAttribute('href'); if (!go || t.target === '_blank') return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.button === 1 || e.ctrlKey || e.metaKey || e.shiftKey) { window.open(go, '_blank', 'noopener'); return; }
    location.href = go;
  }, true);

  // ---- boot ----------------------------------------------------------------------------------------------------------
  function apply(a, yes) {
    menus(!!yes);
    if (WALLET) walletTab(a, !!yes);
  }
  function boot() {
    var a = addr();
    if (PAGE) {
      if (!a) { location.replace('/wallet'); return; }
      css();
      var c0 = cached(a);
      if (c0 === false) { location.replace('/wallet'); return; }
      check(a).then(function (yes) {
        if (yes === false) { location.replace('/wallet'); return; }
        var tries = 0; (function go() { if (!page(a) && ++tries < 40) setTimeout(go, 150); })();
        apply(a, true);
      });
      if (c0 === true) { var t2 = 0; (function go2() { if (!page(a) && ++t2 < 40) setTimeout(go2, 150); })(); }
    } else {
      if (!a) { apply('', false); return; }
      var c = cached(a);
      if (c !== null) apply(a, c);
      if (c === null || Math.random() < 0.25) check(a).then(function (yes) { if (yes !== null) apply(a, yes); });
    }
    // menus and the tab are drawn by the page late on some layouts; keep them in place for a while
    var k = 0, iv = setInterval(function () { var a2 = addr(), c2 = a2 ? cached(a2) : false; if (c2 !== null) apply(a2, c2); if (++k >= 20) clearInterval(iv); }, 1000);
  }
  // The page is hidden from the first paint while we decide (see the middleware head line for /earnings).
  if (PAGE) document.documentElement.classList.add('lx-earn-page');
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
