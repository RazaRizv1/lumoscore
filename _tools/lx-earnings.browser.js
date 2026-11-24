// "MY EARNINGS" ON TRADE (RAZA 2026-11-24). A Launchpad minter receives 30% of LumosCore's fee on every LumosCore trade of
// their token, paid inside the trade (see functions/lxapi/minters.js). This adds a "My Earnings" button to the Trade page's
// market header on every network (.dex-section-head > .dex-mk-controls, the same markup on Stellar, XRPL and NEAR) when a
// wallet is connected, and a panel listing the wallet's Launchpad tokens and each payment received (from
// /lxapi/earnings). Loaded on every page by the middleware; does nothing outside /trade/<network>.
// Copy states the mechanism only -- no claim about what anyone will earn.
(function () {
  if (window.__lxEarn) return; window.__lxEarn = 1;
  var NAMES = { stellar: 'Stellar', xrpl: 'XRPL', near: 'NEAR' };
  var TX = { stellar: 'https://stellar.expert/explorer/public/tx/', xrpl: 'https://xrpscan.com/tx/', near: 'https://nearblocks.io/txns/' };
  function addr() { try { return localStorage.getItem('lumos.address') || ''; } catch (e) { return ''; } }
  function walletNet(a) { return /^G[A-Z2-7]{55}$/.test(a) ? 'stellar' : (/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(a) ? 'xrpl' : (a ? 'near' : '')); }
  function pageNet() { var m = /^\/trade\/(stellar|xrpl|near)\/?$/.exec(location.pathname); return m ? m[1] : ''; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { n = +n || 0; return n >= 1 ? n.toLocaleString(undefined, { maximumFractionDigits: 4 }) : n.toLocaleString(undefined, { maximumSignificantDigits: 4 }); }
  function css() {
    if (document.getElementById('lx-earn-css')) return;
    var s = document.createElement('style'); s.id = 'lx-earn-css';
    s.textContent = ''
      + '.lx-earn-btn{display:inline-flex;align-items:center;gap:7px;padding:0 14px;border:1px solid var(--border,rgba(128,128,140,.25));background:var(--surface,transparent);color:var(--text,inherit);font:inherit;font-weight:600;font-size:13.5px;cursor:pointer;white-space:nowrap}'
      + '.lx-earn-btn:hover{background:var(--surface-2,rgba(128,128,140,.08))}'
      + '.lx-earn-btn svg{width:15px;height:15px;color:var(--accent,#ff6b1a)}'
      + '.lx-earn-btn.lx-earn-mob{height:34px;border-radius:999px;margin:8px 0 2px;font-size:13px}'
      + '.lx-earn-ov{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px}'
      + '.lx-earn-box{width:100%;max-width:560px;max-height:84vh;overflow:auto;background:var(--surface,#16161a);color:var(--text,#eee);border:1px solid var(--border,rgba(128,128,140,.25));border-radius:16px;padding:20px 20px 16px}'
      + '.lx-earn-h{display:flex;align-items:center;justify-content:space-between;gap:12px}'
      + '.lx-earn-h h3{margin:0;font-size:18px;font-weight:700}'
      + '.lx-earn-x{border:0;background:transparent;color:var(--text-muted,#999);font-size:22px;line-height:1;cursor:pointer;padding:2px 6px}'
      + '.lx-earn-sub{margin:6px 0 16px;font-size:13px;color:var(--text-muted,#999);line-height:1.5}'
      + '.lx-earn-tot{display:flex;align-items:baseline;gap:8px;padding:14px 16px;border:1px solid var(--border,rgba(128,128,140,.25));border-radius:12px;margin-bottom:14px}'
      + '.lx-earn-tot b{font-size:22px;font-family:"JetBrains Mono",monospace}'
      + '.lx-earn-tot span{font-size:13px;color:var(--text-muted,#999)}'
      + '.lx-earn-l{font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--text-muted,#999);margin:14px 0 8px}'
      + '.lx-earn-chips{display:flex;flex-wrap:wrap;gap:6px}'
      + '.lx-earn-chip{padding:4px 10px;border-radius:999px;background:var(--surface-2,rgba(128,128,140,.1));font-size:13px;font-weight:600}'
      + '.lx-earn-row{display:grid;grid-template-columns:1fr auto;gap:2px 12px;padding:10px 0;border-top:1px solid var(--border,rgba(128,128,140,.18));font-size:13.5px}'
      + '.lx-earn-row .a{font-family:"JetBrains Mono",monospace;font-weight:600;text-align:right}'
      + '.lx-earn-row .m{color:var(--text-muted,#999);font-size:12.5px}'
      + '.lx-earn-row a{color:inherit;text-decoration:none}'
      + '.lx-earn-empty{padding:14px 0 6px;color:var(--text-muted,#999);font-size:13.5px}';
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
  function open() {
    var net = pageNet(), a = addr(); if (!net || !a) return;
    if (document.querySelector('.lx-earn-ov')) return;
    var ov = document.createElement('div'); ov.className = 'lx-earn-ov';
    ov.innerHTML = '<div class="lx-earn-box" role="dialog" aria-label="My Earnings"><div class="lx-earn-h"><h3>My Earnings</h3><button type="button" class="lx-earn-x" aria-label="Close">×</button></div>'
      + '<p class="lx-earn-sub">For tokens launched from this wallet on the LumosCore Launchpad, 30% of LumosCore’s fee on every LumosCore trade of the token is paid to this wallet, inside the trade.</p>'
      + '<div class="lx-earn-body"><div class="lx-earn-empty">Reading ' + esc(NAMES[net]) + '…</div></div></div>';
    document.body.appendChild(ov);
    function close() { ov.remove(); document.removeEventListener('keydown', key); }
    function key(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', key);
    // The tap that opened the panel is followed by its own synthetic click, which lands on the backdrop: ignore clicks in
    // the first moment, or the panel would close as it opens.
    var opened = Date.now();
    ov.addEventListener('click', function (e) { if (Date.now() - opened < 450) return; if (e.target === ov || (e.target.closest && e.target.closest('.lx-earn-x'))) close(); });
    var body = ov.querySelector('.lx-earn-body');
    fetch('/lxapi/earnings?net=' + net + '&addr=' + encodeURIComponent(a)).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.ok) { body.innerHTML = '<div class="lx-earn-empty">Could not read your earnings right now. Try again in a minute.</div>'; return; }
      var rows = d.rows || [], toks = d.tokens || [];
      var h = '<div class="lx-earn-tot"><b>' + esc(fmt(d.total)) + ' ' + esc(d.unit) + '</b><span>received' + (rows.length ? ' across ' + rows.length + ' trade' + (rows.length === 1 ? '' : 's') : '') + '</span></div>';
      h += '<div class="lx-earn-l">Your Launchpad tokens</div>';
      h += toks.length ? '<div class="lx-earn-chips">' + toks.map(function (t) { return '<span class="lx-earn-chip">' + esc(String(t).split('-')[0]) + '</span>'; }).join('') + '</div>'
        : '<div class="lx-earn-empty">No token launched from this wallet on LumosCore was found.</div>';
      h += '<div class="lx-earn-l">Payments received</div>';
      h += rows.length ? rows.map(function (x) {
        var when = x.at ? new Date(x.at).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        return '<div class="lx-earn-row"><div>' + esc(x.token || 'Trade') + '<div class="m">' + esc(when) + '</div></div>'
          + '<div class="a">' + (x.tx ? '<a target="_blank" rel="noopener" href="' + esc(TX[net] + x.tx) + '">' : '') + '+' + esc(fmt(x.amount)) + ' ' + esc(x.unit) + (x.tx ? '</a>' : '') + '</div></div>';
      }).join('') : '<div class="lx-earn-empty">No payments yet. They appear here after someone trades one of your tokens on LumosCore.</div>';
      if (d.partial) h += '<div class="lx-earn-empty">Part of the history could not be read just now; this list may be incomplete.</div>';
      body.innerHTML = h;
    }).catch(function () { body.innerHTML = '<div class="lx-earn-empty">Could not read your earnings right now. Try again in a minute.</div>'; });
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
