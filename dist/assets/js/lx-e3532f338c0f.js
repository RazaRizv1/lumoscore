
(function() {
  function ready(fn){ if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function() {
    // ===== HIW modal =====
    var btn = document.getElementById('mdxHiwBtn');
    var modal = document.getElementById('hiwModal') || document.createElement('div');
    if (btn && modal) {
      function openHiw(){ modal.classList.add('open'); document.body.style.overflow = 'hidden'; }
      function closeHiw(){ modal.classList.remove('open'); document.body.style.overflow = ''; }
      btn.addEventListener('click', function(e){ e.preventDefault(); openHiw(); });
      modal.addEventListener('click', function(e){
        if (e.target === modal) closeHiw();
        if (e.target.closest && e.target.closest('[data-close]')) closeHiw();
      });
      document.addEventListener('keydown', function(e){
        if (e.key === 'Escape' && modal.classList.contains('open')) closeHiw();
      });
    }

    // ===== Chart hover (touch + mouse) =====
    var chartBox = document.getElementById('mdxXlmChart');
    if (!chartBox) return;
    var W = 360, H = 90, PAD_R = 4, PAD_T = 6, PAD_B = 4;
    var ph = H - PAD_T - PAD_B;
    var pw = W - PAD_R;
    function getHoverEls() {
      return {
        wrap: chartBox.querySelector('#mdxChartHover') || chartBox.querySelector('.mdx-chart-hover'),
        dot: chartBox.querySelector('.mdx-chart-dot'),
        tip: chartBox.querySelector('.mdx-chart-tip'),
        val: chartBox.querySelector('#mdxHoverVal') || chartBox.querySelector('.t-val')
      };
    }
    function fmt(p) {
      if (p >= 1000) return '$' + p.toFixed(2);
      if (p >= 1) return '$' + p.toFixed(4);
      if (p >= 0.01) return '$' + p.toFixed(5);
      return '$' + p.toFixed(7);
    }
    function showHover(clientX) {
      var prices = window._mdxLastPrices;
      if (!prices || !prices.length) return;
      var els = getHoverEls();
      if (!els.wrap) return;
      var rect = chartBox.getBoundingClientRect();
      var rel = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      var n = prices.length;
      var idx = Math.round(rel * (n - 1));
      var price = prices[idx];
      // X position: account for PAD_R gutter
      var xViewbox = (idx / (n - 1)) * (pw - 0);  // 0 .. pw
      var xPct = (xViewbox / W) * 100;
      // Y position: same scaling logic as renderXlmChart
      var min = Math.min.apply(null, prices), max = Math.max.apply(null, prices);
      var pad = (max - min) * 0.18;
      var lo = min - pad, hi = max + pad;
      var yViewbox = PAD_T + ph - ((price - lo) / (hi - lo)) * ph;
      var yPct = (yViewbox / H) * 100;
      var line = chartBox.querySelector('.mdx-chart-line');
      if (line) line.style.left = xPct + '%';
      if (els.dot) {
        els.dot.style.left = xPct + '%';
        els.dot.style.top = yPct + '%';
      }
      if (els.tip) {
        els.tip.style.left = xPct + '%';
        els.tip.style.top = yPct + '%';
        els.tip.style.transform = 'translate(-50%, calc(-100% - 8px))';
      }
      if (els.val) els.val.textContent = fmt(price);
      els.wrap.classList.add('active');
    }
    function hideHover() {
      var els = getHoverEls();
      if (els.wrap) els.wrap.classList.remove('active');
    }
    // Touch
    chartBox.addEventListener('touchstart', function(e) {
      var t = e.touches[0]; if (t) showHover(t.clientX);
    }, { passive: true });
    chartBox.addEventListener('touchmove', function(e) {
      var t = e.touches[0]; if (t) { showHover(t.clientX); e.preventDefault && e.preventDefault(); }
    }, { passive: false });
    chartBox.addEventListener('touchend', hideHover);
    chartBox.addEventListener('touchcancel', hideHover);
    // Mouse (for desktop preview)
    chartBox.addEventListener('mouseenter', function(e) { showHover(e.clientX); });
    chartBox.addEventListener('mousemove',  function(e) { showHover(e.clientX); });
    chartBox.addEventListener('mouseleave', hideHover);
  });
})();
