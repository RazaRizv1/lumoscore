
(function(){
  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function(){
    var modal = document.getElementById('lcConnectModal');
    if (!modal) return;

    var screens = {
      wallet: modal.querySelector('[data-screen="wallet"]'),
      connecting: modal.querySelector('[data-screen="connecting"]'),
      connected: modal.querySelector('[data-screen="connected"]')
    };
    var searchInput = document.getElementById('lcWalletSearch');
    var emptyEl = modal.querySelector('.lc-wempty');

    var SAMPLE_ADDR = 'GA7H4M2KPQRSTNVWXYZ234CRZ7';
    var state = { wallet: null, walletIcon: '', returnFocus: null };

    function showScreen(name) {
      Object.keys(screens).forEach(function(k) {
        if (screens[k]) {
          if (k === name) screens[k].removeAttribute('hidden');
          else screens[k].setAttribute('hidden', '');
        }
      });
    }

    function openModal(opener) {
      state.returnFocus = opener || null;
      modal.removeAttribute('hidden');
      showScreen('wallet');
      document.body.style.overflow = 'hidden';
      // Reset search
      if (searchInput) {
        searchInput.value = '';
        filterWallets('');
      }
    }
    function closeModal() {
      modal.setAttribute('hidden', '');
      document.body.style.overflow = '';
      modal.querySelectorAll('.lc-wrow.is-pending').forEach(function(r) {
        r.classList.remove('is-pending');
      });
      if (state.returnFocus && state.returnFocus.focus) state.returnFocus.focus();
    }
    function shortAddr(a) {
      if (!a) return '';
      return a.slice(0, 5) + '…' + a.slice(-4);
    }

    function filterWallets(q) {
      q = (q || '').toLowerCase().trim();
      var anyVisible = false;
      modal.querySelectorAll('.lc-wrow').forEach(function(row) {
        var hay = (row.getAttribute('data-search') || '').toLowerCase();
        var match = !q || hay.indexOf(q) !== -1;
        row.style.display = match ? '' : 'none';
        if (match) anyVisible = true;
      });
      // Hide section labels whose group has no visible rows
      modal.querySelectorAll('.lc-wgroup').forEach(function(g) {
        var visible = Array.prototype.some.call(g.querySelectorAll('.lc-wrow'), function(r) { return r.style.display !== 'none'; });
        var label = g.querySelector('.lc-wsection');
        if (label) label.style.display = visible ? '' : 'none';
      });
      if (emptyEl) {
        if (anyVisible) emptyEl.setAttribute('hidden', '');
        else emptyEl.removeAttribute('hidden');
      }
    }

    if (searchInput) {
      searchInput.addEventListener('input', function(e) { filterWallets(e.target.value); });
    }

    // Click delegation
    document.body.addEventListener('click', function(e) {
      // Open from any guest button
      var openBtn = e.target.closest('.lc-guest-open');
      if (openBtn) { openModal(openBtn); return; }

      if (modal.hasAttribute('hidden')) return;

      // Close: backdrop or close buttons
      if (e.target === modal || e.target.closest('.lc-mclose')) { closeModal(); return; }

      // Cancel during connecting
      if (e.target.closest('.lc-modal-cancel')) { showScreen('wallet'); return; }

      // Done after connected
      if (e.target.closest('.lc-modal-done')) { closeModal(); return; }

      // Copy address
      var copyBtn = e.target.closest('.lc-acctcard-copy');
      if (copyBtn) {
        var addrEl = document.getElementById('lcConnectedAddr');
        var full = SAMPLE_ADDR;
        try {
          navigator.clipboard && navigator.clipboard.writeText(full);
        } catch(_) {}
        copyBtn.classList.add('is-copied');
        var orig = copyBtn.innerHTML;
        copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
        setTimeout(function() {
          copyBtn.classList.remove('is-copied');
          copyBtn.innerHTML = orig;
        }, 1400);
        return;
      }

      // Wallet row click
      var wRow = e.target.closest('.lc-wrow');
      if (wRow) {
        state.wallet = wRow.getAttribute('data-wallet') || 'Wallet';
        // Capture the wallet icon SVG for use in connecting/connected screens
        var icoEl = wRow.querySelector('.lc-wico');
        state.walletIcon = icoEl ? icoEl.outerHTML.replace('class="lc-wico"', 'class="lc-wico"') : '';
        wRow.classList.add('is-pending');

        // Populate connecting screen
        var conIco = document.getElementById('lcConnectingIco');
        var conTitle = document.getElementById('lcConnectingTitle');
        if (conIco) {
          // Replace its content with the wallet icon visual (clone styles via copying classes/styles)
          conIco.style.cssText = icoEl ? icoEl.style.cssText : '';
          conIco.innerHTML = icoEl ? icoEl.innerHTML : '';
        }
        if (conTitle) conTitle.textContent = 'Confirming with ' + state.wallet;

        showScreen('connecting');

        setTimeout(function() {
          // Populate connected screen
          var doneIco = document.getElementById('lcConnectedIco');
          if (doneIco) {
            doneIco.style.cssText = icoEl ? icoEl.style.cssText : '';
            doneIco.innerHTML = icoEl ? icoEl.innerHTML : '';
          }
          var addrEl = document.getElementById('lcConnectedAddr');
          if (addrEl) addrEl.textContent = shortAddr(SAMPLE_ADDR);
          var netDone = document.getElementById('lcNetNameDone');
          if (netDone) netDone.textContent = 'Aptos';
          var walDone = document.getElementById('lcWalletNameDone');
          if (walDone) walDone.textContent = state.wallet;
          showScreen('connected');
        }, 1500);
      }
    });

    // ESC closes
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && !modal.hasAttribute('hidden')) closeModal();
    });
  });
})();
