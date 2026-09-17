
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

    // Tabs
    document.querySelectorAll('#poolTabs button').forEach(function(b) {
      b.addEventListener('click', function() {
        document.querySelectorAll('#poolTabs button').forEach(function(x) { x.classList.toggle('active', x === b); });
        var t = b.dataset.tab;
        document.getElementById('panelAll').style.display = t === 'all' ? '' : 'none';
        document.getElementById('panelMine').style.display = t === 'mine' ? '' : 'none';
      });
    });

    // Modal
    var modal = document.getElementById('createPoolModal');
    var openBtn = document.getElementById('openCreatePool');
    openBtn.addEventListener('click', function() {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
    modal.addEventListener('click', function(e) {
      if (e.target === modal || e.target.closest('[data-close]')) {
        modal.classList.remove('open');
        document.body.style.overflow = '';
      }
    });

    // Search filter
    var searchInput = document.getElementById('poolSearch');
    if (searchInput) {
      searchInput.addEventListener('input', function() {
        var q = searchInput.value.trim().toLowerCase();
        document.querySelectorAll('#panelAll .pool-card').forEach(function(c) {
          if (!q) { c.style.display = ''; return; }
          var name = (c.querySelector('.pc-name') || {}).textContent || '';
          var sub = (c.querySelector('.pc-sub') || {}).textContent || '';
          c.style.display = (name.toLowerCase().includes(q) || sub.toLowerCase().includes(q)) ? '' : 'none';
        });
      });
    }
  });
})();
