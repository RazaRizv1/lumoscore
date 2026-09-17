
// ===== Toast utility + copy-to-clipboard + cancel-order confirmation =====
(function() {
  // ---- Toast ----
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = '<span class="check-ic"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' + msg;
    stack.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }
  window.showToast = showToast;

  // ---- Copy address to clipboard ----
// (data-copy now handled by global delegated handler)

  // ---- Cancel order confirmation ----
  const modal = document.getElementById('cancelModal');
  const mTitle = document.getElementById('cancelModalTitle');
  const mText = document.getElementById('cancelModalText');
  const mDetail = document.getElementById('cancelModalDetail');
  const mKeep = document.getElementById('cancelModalKeep');
  const mConfirm = document.getElementById('cancelModalConfirm');
  const mBtnLabel = document.getElementById('cancelModalBtnLabel');

  let pendingAction = null; // function to run on confirm

  function openModal() { modal.classList.add('open'); }
  function closeModal() { modal.classList.remove('open'); pendingAction = null; }

  // Individual order cancel
  document.querySelectorAll('.order-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      const pair = btn.getAttribute('data-order') || 'this order';
      const side = btn.getAttribute('data-side') || '';
      mTitle.textContent = 'Cancel order?';
      mText.textContent = 'This action cannot be undone. Any partially filled portion of the order will remain in your wallet.';
      mDetail.style.display = 'block';
      mDetail.innerHTML = '<strong>' + (side ? side + ' · ' : '') + pair + '</strong>';
      mBtnLabel.textContent = 'Cancel order';
      const card = btn.closest('.order-card');
      pendingAction = () => {
        if (card) card.remove();
        updateOrdersCount();
        showToast('Order cancelled');
      };
      openModal();
    });
  });

  // Cancel all
  const cancelAll = document.getElementById('cancelAllBtn');
  if (cancelAll) {
    cancelAll.addEventListener('click', (e) => {
      e.preventDefault();
      const cards = document.querySelectorAll('.order-card');
      const n = cards.length;
      if (n === 0) { showToast('No active orders to cancel'); return; }
      mTitle.textContent = 'Cancel all orders?';
      mText.textContent = 'This will cancel all open orders. This action cannot be undone.';
      mDetail.style.display = 'block';
      mDetail.innerHTML = '<strong>' + n + ' open order' + (n === 1 ? '' : 's') + '</strong> will be cancelled.';
      mBtnLabel.textContent = 'Cancel all';
      pendingAction = () => {
        cards.forEach(c => c.remove());
        updateOrdersCount();
        showToast(n + ' order' + (n === 1 ? '' : 's') + ' cancelled');
      };
      openModal();
    });
  }

  function updateOrdersCount() {
    const remaining = document.querySelectorAll('.order-card').length;
    const countEl = document.getElementById('ordersCount');
    if (countEl) countEl.textContent = remaining + ' active';
  }

  mKeep.addEventListener('click', closeModal);
  mConfirm.addEventListener('click', () => {
    if (pendingAction) pendingAction();
    closeModal();
  });
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('open')) closeModal(); });
})();
