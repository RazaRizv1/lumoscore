
// === Kebab menu wiring for pool rows ===
(function() {
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function() {
    var menu = document.getElementById('kebabMenu');
    var backdrop = document.getElementById('kebabBackdrop');
    if (!menu || !backdrop) return;
    var currentAddr = '';
    var currentName = '';

    function openMenu(btn) {
      var rect = btn.getBoundingClientRect();
      menu.style.position = 'fixed';
      menu.style.top = (rect.bottom + 6) + 'px';
      menu.style.left = '';
      menu.style.right = Math.max(8, window.innerWidth - rect.right) + 'px';
      menu.classList.add('open');
      backdrop.classList.add('open');
      currentAddr = btn.getAttribute('data-pool-addr') || '';
      currentName = btn.getAttribute('data-pool-name') || '';
    }
    function closeMenu() {
      menu.classList.remove('open');
      backdrop.classList.remove('open');
    }

    // Delegate click on kebab buttons (re-rendered by renderAssetList)
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('.kebab-btn');
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        if (menu.classList.contains('open')) { closeMenu(); }
        else { openMenu(btn); }
        return;
      }
      // Click outside closes
      if (menu.classList.contains('open') && !e.target.closest('.kebab-menu')) {
        closeMenu();
      }
    });

    backdrop.addEventListener('click', closeMenu);

    menu.querySelectorAll('button').forEach(function(b) {
      b.addEventListener('click', function(e) {
        var act = b.dataset.act;
        // Only Copy triggers a toast; details/history just close the menu (matches desktop behavior).
        if (act === 'copy') {
          try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(currentAddr); } catch(_) {}
          if (window.showToast) window.showToast('Pool address copied to clipboard');
        }
        closeMenu();
      });
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && menu.classList.contains('open')) closeMenu();
    });
  });
})();
