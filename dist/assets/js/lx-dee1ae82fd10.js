
// === Create Pool modal open/close ===
(function() {
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  ready(function() {
    var openBtn = document.getElementById('openCreatePool');
    var modal = document.getElementById('createPoolModal');
    if (!openBtn || !modal) return;
    function open() {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function close() {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
    openBtn.addEventListener('click', open);
    modal.addEventListener('click', function(e) {
      if (e.target === modal) close();
      if (e.target.closest('[data-close]')) close();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && modal.classList.contains('open')) close();
    });

    // === Tab switching ===
    var tabs = document.querySelectorAll('#poolTabs button');
    var allPanel = document.getElementById('panelAllPools');
    var myPanel = document.getElementById('panelMyPositions');
    var pagAll = document.getElementById('paginationAll');
    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        tabs.forEach(function(t) { t.classList.toggle('active', t === tab); });
        if (tab.dataset.tab === 'mine') {
          allPanel.style.display = 'none';
          myPanel.style.display = '';
          pagAll.style.display = 'none';
        } else {
          allPanel.style.display = '';
          myPanel.style.display = 'none';
          pagAll.style.display = '';
        }
      });
    });

    // === Search ===
    var searchInput = document.getElementById('poolSearch');
    if (searchInput) {
      searchInput.addEventListener('input', function() {
        var q = searchInput.value.trim().toLowerCase();
        var rows = document.querySelectorAll('#poolsBody tr');
        rows.forEach(function(r) {
          if (!q) { r.style.display = ''; return; }
          var name = (r.querySelector('.pair-name') || {}).textContent || '';
          var sub = (r.querySelector('.pair-sub') || {}).textContent || '';
          var match = name.toLowerCase().includes(q) || sub.toLowerCase().includes(q);
          r.style.display = match ? '' : 'none';
        });
      });
    }

    // === Row click → pool detail ===
    document.querySelectorAll('.pools tbody tr[data-pool]').forEach(function(row) {
      row.addEventListener('click', function() {
        __lxNav('lumoscore-amm-pool-dark.html');
      });
    });
  });
})();
