
// === Asset picker dropdown wiring (AMM Create Pool) ===
document.addEventListener('DOMContentLoaded', function() {
  var modal = document.getElementById('createPoolModal');
  if (!modal) return;

  var pickers = modal.querySelectorAll('.asset-picker');
  var dropdowns = modal.querySelectorAll('.asset-dropdown');
  var fields = modal.querySelectorAll('.asset-field');
  var primaryBtn = modal.querySelector('.modal-foot .btn-primary');

  function closeAll() {
    dropdowns.forEach(function(dd) { dd.classList.remove('open'); });
  }

  function updateCreateBtnState() {
    if (!primaryBtn) return;
    var allSelected = Array.prototype.every.call(pickers, function(p) {
      return !p.classList.contains('placeholder');
    });
    if (allSelected) primaryBtn.removeAttribute('disabled');
    else primaryBtn.setAttribute('disabled', '');
  }

  // For each field, wire its picker -> open its dropdown, and dropdown items -> select asset
  fields.forEach(function(field, idx) {
    var picker = field.querySelector('.asset-picker');
    var dd = field.querySelector('.asset-dropdown');
    var amtInput = field.querySelector('.asset-amt');
    var balanceEl = field.querySelector('.balance strong') || field.querySelector('.field-foot span:first-child');
    if (!picker || !dd) return;

    picker.addEventListener('click', function(e) {
      e.preventDefault(); e.stopPropagation();
      var isOpen = dd.classList.contains('open');
      closeAll();
      if (!isOpen) dd.classList.add('open');
    });

    dd.querySelectorAll('.ad-item').forEach(function(item) {
      item.addEventListener('click', function(e) {
        e.preventDefault();
        var ticker = item.getAttribute('data-asset') || '';
        var name = item.getAttribute('data-asset-name') || '';
        var bal = item.getAttribute('data-asset-bal') || '—';
        var color1 = item.getAttribute('data-asset-color1') || 'var(--accent)';
        var color2 = item.getAttribute('data-asset-color2') || 'var(--accent)';

        // Update picker visual
        picker.classList.remove('placeholder');
        var apIco = picker.querySelector('.ap-ico');
        var apName = picker.querySelector('.ap-name');
        if (apIco) {
          apIco.style.background = 'linear-gradient(135deg,' + color1 + ',' + color2 + ')';
          apIco.style.color = '#fff';
          apIco.style.fontWeight = '700';
          apIco.style.fontSize = '11px';
          apIco.textContent = ticker.charAt(0);
        }
        if (apName) apName.textContent = ticker;

        // Update balance display in field-foot
        if (balanceEl) {
          if (balanceEl.tagName === 'STRONG') balanceEl.textContent = bal + ' ' + ticker;
          else balanceEl.innerHTML = 'Balance: <strong>' + bal + ' ' + ticker + '</strong>';
        }

        dd.classList.remove('open');
        updateCreateBtnState();
      });
    });

    // Search filter inside dropdown
    var searchInput = dd.querySelector('.ad-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function(e) {
        var q = (e.target.value || '').toLowerCase();
        dd.querySelectorAll('.ad-item').forEach(function(it) {
          var matches = (it.getAttribute('data-asset') || '').toLowerCase().indexOf(q) >= 0 ||
                        (it.getAttribute('data-asset-name') || '').toLowerCase().indexOf(q) >= 0;
          it.style.display = matches ? '' : 'none';
        });
      });
    }
  });

  // Close dropdowns when clicking outside any of them
  document.addEventListener('click', function(e) {
    if (!modal.contains(e.target)) return;
    var inDropdown = e.target.closest('.asset-dropdown');
    var onPicker = e.target.closest('.asset-picker');
    if (!inDropdown && !onPicker) closeAll();
  });
});
