
// ===== Wallet-specific bottom wiring (cancel-order + LP modals) =====
(function() {
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  ready(function() {

    // ============ Cancel-order modal wiring ============
    var cancelModal = document.getElementById('modalCancelOrder');
    if (cancelModal && !cancelModal.dataset.cancelWired) {
      cancelModal.dataset.cancelWired = '1';
      var titleEl = document.getElementById('cancelOrderTitle');
      var textEl = document.getElementById('cancelOrderText');
      var detailsEl = document.getElementById('cancelOrderDetails');
      var btnLabel = document.getElementById('cancelOrderBtnLabel');
      var confirmBtn = document.getElementById('cancelOrderConfirm');

      function openSingle(rowEl) {
        var name = rowEl.querySelector('.pair-text .name') ? rowEl.querySelector('.pair-text .name').textContent : 'this order';
        var side = rowEl.querySelector('.pair-text .side') ? rowEl.querySelector('.pair-text .side').textContent.trim() : '';
        var cols = rowEl.querySelectorAll('.order-details .col');
        var summary = '';
        if (cols.length >= 3) {
          summary =
            '<div style="display:flex;justify-content:space-between;color:var(--text-soft);font-size:14.5px;text-transform:uppercase;letter-spacing:0.4px;font-weight:700;margin-bottom:6px">' + name + ' · ' + side + '</div>' +
            '<div style="display:flex;justify-content:space-between;gap:14px">' +
              '<span>Price · <strong style="color:var(--text);font-family:\'JetBrains Mono\',monospace">' + cols[0].querySelector('.v').textContent + '</strong></span>' +
              '<span>Amount · <strong style="color:var(--text);font-family:\'JetBrains Mono\',monospace">' + cols[1].querySelector('.v').textContent + '</strong></span>' +
            '</div>';
        }
        if (titleEl) titleEl.textContent = 'Cancel this order?';
        if (textEl) textEl.textContent = 'This action cannot be undone. Any partially filled portion of the order will stay in your wallet.';
        if (detailsEl) {
          detailsEl.innerHTML = summary;
          detailsEl.style.display = summary ? '' : 'none';
        }
        if (btnLabel) btnLabel.textContent = 'Cancel order';
        if (confirmBtn) {
          confirmBtn.onclick = function() {
            rowEl.style.transition = 'opacity .2s, transform .2s';
            rowEl.style.opacity = '0';
            rowEl.style.transform = 'translateX(-8px)';
            setTimeout(function(){ rowEl.remove(); }, 200);
            cancelModal.classList.remove('open');
            document.body.style.overflow = '';
            if (window.showToast) window.showToast('Order cancelled');
          };
        }
        cancelModal.classList.add('open');
        document.body.style.overflow = 'hidden';
      }

      function openAll() {
        var rows = document.querySelectorAll('.orders-block .order-row');
        var n = rows.length;
        if (n === 0) {
          if (window.showToast) window.showToast('No active orders to cancel');
          return;
        }
        if (titleEl) titleEl.textContent = 'Cancel all open orders?';
        if (textEl) textEl.innerHTML = 'This will cancel <strong style="color:var(--text)">' + n + ' order' + (n === 1 ? '' : 's') + '</strong>. Any partially filled portions stay in your wallet. This action cannot be undone.';
        if (detailsEl) detailsEl.style.display = 'none';
        if (btnLabel) btnLabel.textContent = 'Cancel all (' + n + ')';
        if (confirmBtn) {
          confirmBtn.onclick = function() {
            rows.forEach(function(row, i){
              setTimeout(function(){
                row.style.transition = 'opacity .2s, transform .2s';
                row.style.opacity = '0';
                row.style.transform = 'translateX(-8px)';
                setTimeout(function(){ row.remove(); }, 200);
              }, i * 60);
            });
            cancelModal.classList.remove('open');
            document.body.style.overflow = '';
            if (window.showToast) window.showToast(n + ' order' + (n === 1 ? '' : 's') + ' cancelled');
          };
        }
        cancelModal.classList.add('open');
        document.body.style.overflow = 'hidden';
      }

      // Wire per-row Cancel
      document.querySelectorAll('.order-cancel').forEach(function(btn){
        if (btn.dataset.cancelWired) return;
        btn.dataset.cancelWired = '1';
        btn.addEventListener('click', function(e){
          e.preventDefault();
          var row = btn.closest('.order-row');
          if (row) openSingle(row);
        });
      });
      // Wire "Cancel all"
      document.querySelectorAll('.ctrl-btn').forEach(function(btn){
        var txt = (btn.textContent || '').trim().toLowerCase();
        if (txt.indexOf('cancel all') >= 0 && !btn.dataset.cancelAllWired) {
          btn.dataset.cancelAllWired = '1';
          btn.addEventListener('click', function(e){
            e.preventDefault();
            openAll();
          });
        }
      });
    }

    // ============ LP Add / Remove modal wiring ============
    var lpAddModal = document.getElementById('modalLpAdd');
    var lpRemoveModal = document.getElementById('modalLpRemove');
    if (lpAddModal || lpRemoveModal) {
      document.querySelectorAll('.lp-card .qa-row-btn').forEach(function(btn){
        if (btn.dataset.lpWired) return;
        btn.dataset.lpWired = '1';
        var label = (btn.textContent || '').trim();
        if (label.indexOf('Add') === label.length - 3 && lpAddModal) {
          btn.addEventListener('click', function(e){
            e.preventDefault();
            var row = btn.closest('tr');
            var pairName = row ? row.querySelector('.lp-nm') : null;
            var aprEl = row ? row.querySelector('.lp-apr') : null;
            if (pairName) {
              var titleEl = lpAddModal.querySelector('.modal-body > div:first-child > div:nth-child(2) > div:first-child');
              if (titleEl) titleEl.textContent = pairName.textContent + ' Pool';
            }
            if (aprEl) {
              var aprModalEl = document.getElementById('lpAddApr');
              if (aprModalEl) aprModalEl.textContent = aprEl.textContent;
            }
            lpAddModal.classList.add('open');
            document.body.style.overflow = 'hidden';
          });
        } else if (label.indexOf('Remove') === label.length - 6 && lpRemoveModal) {
          btn.addEventListener('click', function(e){
            e.preventDefault();
            lpRemoveModal.classList.add('open');
            document.body.style.overflow = 'hidden';
          });
        }
      });

      // LP Remove modal slider
      if (lpRemoveModal && !lpRemoveModal.dataset.sliderWired) {
        lpRemoveModal.dataset.sliderWired = '1';
        var range = document.getElementById('lpRemoveRange');
        var pctLabel = document.getElementById('lpRemovePct');
        var xlmOut = document.getElementById('lpRemoveXlm');
        var usdcOut = document.getElementById('lpRemoveUsdc');
        var rewardsOut = document.getElementById('lpRemoveRewards');
        var pillBtns = lpRemoveModal.querySelectorAll('.pill-btn-range');

        function updateRemove(pct) {
          pct = Math.max(0, Math.min(100, pct));
          if (pctLabel) pctLabel.textContent = pct + '%';
          var xlm = (1842 * pct / 100).toFixed(0);
          var usdc = (1239 * pct / 100).toFixed(0);
          var rewards = (18.4 * pct / 100).toFixed(1);
          if (xlmOut) xlmOut.textContent = Number(xlm).toLocaleString() + ' APT';
          if (usdcOut) usdcOut.textContent = Number(usdc).toLocaleString() + ' USDC';
          if (rewardsOut) rewardsOut.textContent = '+' + rewards + ' APT';
          pillBtns.forEach(function(b){ b.classList.toggle('active', parseInt(b.dataset.pct) === pct); });
          if (range) range.value = pct;
        }
        if (range) {
          range.addEventListener('input', function(e){ updateRemove(parseInt(e.target.value)); });
          pillBtns.forEach(function(b){
            b.addEventListener('click', function(){ updateRemove(parseInt(b.dataset.pct)); });
          });
          updateRemove(50);
        }
      }
    }

  });
})();
