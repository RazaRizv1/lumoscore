
  // Simple confetti
  const confetti = document.getElementById('confetti');
  const colors = ['#ea6a2c','#16a34a','#ffb547','#8b7bff','#dc2626'];
  for (let i = 0; i < 60; i++) {
    const s = document.createElement('span');
    s.style.left = Math.random() * 100 + '%';
    s.style.background = colors[Math.floor(Math.random() * colors.length)];
    s.style.animationDuration = (3 + Math.random() * 2.5) + 's';
    s.style.animationDelay = Math.random() * 0.6 + 's';
    s.style.transform = `rotate(${Math.random() * 360}deg)`;
    confetti.appendChild(s);
  }
  // remove after they fall
  setTimeout(() => confetti.remove(), 7000);

  // ---------- Toast utility + copy-to-clipboard wiring ----------
  (function(){
    let stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      document.body.appendChild(stack);
    }
    function showToast(msg) {
      const t = document.createElement('div');
      t.className = 'toast';
      t.innerHTML = '<span class="check-ic"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span><span>' + msg + '</span>';
      stack.appendChild(t);
      setTimeout(() => t.remove(), 2200);
    }
    window.showToast = showToast;

    // Auto-wire any copy buttons. A copy button is any element with:
    //   - class containing "copy" (button or svg.copy-i parent button), OR
    //   - data-tooltip="Copy" title="Copy" attribute
    // The data-copy-label attribute (or nearby text) determines what to show.
    function findCopyContext(el) {
      // Walk up to find the relevant value to copy (data-copy attribute on ancestor)
      let cur = el;
      for (let i = 0; i < 6 && cur; i++) {
        if (cur.dataset && cur.dataset.copyLabel) return cur.dataset.copyLabel;
        cur = cur.parentElement;
      }
      // Fallback: nearest .v / .mono / .addr text
      const wrap = el.closest('.detail-row, .wallet-row, .addr-row, .copy-wrap, .ws-addr');
      if (wrap) {
        const target = wrap.querySelector('.copy-target, .addr, .mono, .v, .v-mono, code');
        if (target) {
          return (target.textContent || '').trim().substring(0, 40);
        }
      }
      return null;
    }

    function isCopyTrigger(el) {
      if (!el) return false;
      if (el.matches && (el.matches('[data-copy]') || el.matches('[title="Copy"]'))) return true;
      // SVG class copy-i inside a button
      if (el.classList && el.classList.contains('copy-i')) return true;
      return false;
    }
  })();
