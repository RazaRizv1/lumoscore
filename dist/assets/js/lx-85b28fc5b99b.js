
(function() {
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function() {
    var root = document.documentElement;
    function updateBtnIcons() {
      var theme = root.getAttribute('data-theme');
      document.querySelectorAll('.theme-toggle .t-sun').forEach(function(el) { el.style.display = theme === 'dark' ? '' : 'none'; });
      document.querySelectorAll('.theme-toggle .t-moon').forEach(function(el) { el.style.display = theme === 'light' ? '' : 'none'; });
    }
    updateBtnIcons();
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('.theme-toggle');
      if (!btn) return;
      var current = root.getAttribute('data-theme');
      root.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
      updateBtnIcons();
    });

    // Panel tabs
    document.querySelectorAll('#ptabs button').forEach(function(b) {
      b.addEventListener('click', function() {
        document.querySelectorAll('#ptabs button').forEach(function(x) { x.classList.toggle('active', x === b); });
        var t = b.dataset.ptab;
        document.querySelectorAll('.ptab-panel').forEach(function(p) { p.classList.toggle('active', p.dataset.panel === t); });
      });
    });

    // Deposit/Withdraw tabs
    document.querySelectorAll('[data-dw]').forEach(function(b) {
      b.addEventListener('click', function() {
        document.querySelectorAll('[data-dw]').forEach(function(x) { x.classList.toggle('active', x === b); });
        var cta = document.getElementById('dwCta');
        if (b.dataset.dw === 'withdraw') {
          cta.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> Withdraw';
        } else {
          cta.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Liquidity';
        }
      });
    });

    // Participants list
    var partList = document.getElementById('participantsList');
    if (partList) {
      var participants = [
        { addr: '0x0cd2…40dc', share: 94.88, color: 'linear-gradient(135deg,#a855f7,#6d28d9)', a: 'A' },
        { addr: '0x0842…c71b', share: 0.82, color: 'linear-gradient(135deg,#6f5ded,#1e40af)', a: 'B' },
        { addr: '0x09fa…2d7d', share: 0.57, color: 'linear-gradient(135deg,#fb923c,#c2410c)', a: 'C' },
        { addr: '0x0645…7589', share: 0.30, color: 'linear-gradient(135deg,#22d3ee,#0891b2)', a: 'D' },
        { addr: '0x0ddc…e1aa', share: 0.22, color: 'linear-gradient(135deg,#f43f5e,#9f1239)', a: 'E' },
        { addr: '0x031e…feff', share: 0.22, color: 'linear-gradient(135deg,#10b981,#047857)', a: 'F' },
        { addr: '0x001b…a94e', share: 0.19, color: 'linear-gradient(135deg,#a3e635,#65a30d)', a: 'G' },
        { addr: '0x08e4…512f', share: 0.15, color: 'linear-gradient(135deg,#94a3b8,#475569)', a: 'H' },
        { addr: '0x0adb…8ee2', share: 0.14, color: 'linear-gradient(135deg,#ec4899,#9d174d)', a: 'I' },
        { addr: '0x0f24…401c', share: 0.08, color: 'linear-gradient(135deg,#6366f1,#3730a3)', a: 'J' },
      ];
      partList.innerHTML = participants.map(function(p) {
        var fillW = Math.max(2, Math.min(100, p.share)) + '%';
        return '<div class="part-row">' +
          '<div class="part-avatar">' + window.lxIdent(p.addr, 26) + '</div>' +
          '<div class="wallet">' + p.addr + '</div>' +
          '<div class="share">' + p.share.toFixed(2) + '%</div>' +
          '<div class="share-bar"><div class="fill" style="width:' + fillW + '"></div></div>' +
        '</div>';
      }).join('');
    }
  });
})();
