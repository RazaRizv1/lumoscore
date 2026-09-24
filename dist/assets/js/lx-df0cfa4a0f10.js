
// === LUMOS Trustline gate wiring ===
(function() {
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function() {
    var hasTrustline = false;

    function setModalLocked(modal, locked) {
      if (!modal) return;
      var primary = modal.querySelector('.modal-foot .btn-primary');
      if (primary) {
        if (locked) primary.setAttribute('disabled', '');
        else primary.removeAttribute('disabled');
      }
    }

    function refreshUI() {
      var chip = document.getElementById('lumosTrustlineChip');
      if (chip) {
        chip.classList.toggle('active', hasTrustline);
        var txt = chip.querySelector('.tl-text');
        if (txt) {
          if (hasTrustline) txt.textContent = 'LUMOS trustline active';
          else if (window.innerWidth < 480) txt.textContent = 'No LUMOS trustline yet';
          else txt.textContent = 'You don’t have a LUMOS trustline yet';
        }
      }
      document.querySelectorAll('[data-trustline-gate]').forEach(function(gate) {
        if (hasTrustline) {
          gate.classList.add('success');
          var ttl = gate.querySelector('.tg-title');
          var sub = gate.querySelector('.tg-sub');
          if (ttl) ttl.textContent = 'LUMOS trustline active';
          if (sub) sub.textContent = 'You can now hold and trade LUMOS';
        } else {
          gate.classList.remove('success');
          var ttl = gate.querySelector('.tg-title');
          var sub = gate.querySelector('.tg-sub');
          if (ttl) ttl.textContent = 'LUMOS trustline required';
          if (sub) sub.textContent = 'Reserves 0.5 APT from your account';
        }
      });
      setModalLocked(document.getElementById('modalSwap'), !hasTrustline);
      setModalLocked(document.getElementById('createPoolModal'), !hasTrustline);
    }

    function addTrustline() {
      hasTrustline = true;
      refreshUI();
      if (window.showToast) window.showToast('LUMOS trustline added');
    }

    document.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-tl-add]');
      if (!btn) return;
      e.preventDefault();
      addTrustline();
    });

    refreshUI();
  });
})();
