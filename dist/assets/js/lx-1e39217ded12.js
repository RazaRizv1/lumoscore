
(function() {
  function ready(fn){ if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function() {
    var chartBox = document.getElementById('dexXlmChart');
    if (!chartBox) return;
    var W = 460, H = 110, PAD_R = 4, PAD_T = 6, PAD_B = 4;
    var ph = H - PAD_T - PAD_B;
    var pw = W - PAD_R;
    function fmt(p) {
      if (p >= 1000) return '$' + p.toFixed(2);
      if (p >= 1) return '$' + p.toFixed(4);
      if (p >= 0.01) return '$' + p.toFixed(5);
      return '$' + p.toFixed(7);
    }
    function showHover(clientX) {
      var prices = window._dexLastPrices;
      if (!prices || !prices.length) return;
      var wrap = chartBox.querySelector('#dexChartHover');
      if (!wrap) return;
      var rect = chartBox.getBoundingClientRect();
      var rel = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      var n = prices.length;
      var idx = Math.round(rel * (n - 1));
      var price = prices[idx];
      var xViewbox = (idx / (n - 1)) * pw;
      var xPct = (xViewbox / W) * 100;
      var min = Math.min.apply(null, prices), max = Math.max.apply(null, prices);
      var pad = (max - min) * 0.18;
      var lo = min - pad, hi = max + pad;
      var yViewbox = PAD_T + ph - ((price - lo) / (hi - lo)) * ph;
      var yPct = (yViewbox / H) * 100;
      var line = chartBox.querySelector('.dex-chart-line');
      var dot = chartBox.querySelector('.dex-chart-dot');
      var tip = chartBox.querySelector('.dex-chart-tip');
      var val = chartBox.querySelector('#dexHoverVal');
      if (line) line.style.left = xPct + '%';
      if (dot) { dot.style.left = xPct + '%'; dot.style.top = yPct + '%'; }
      if (tip) { tip.style.left = xPct + '%'; tip.style.top = yPct + '%'; }
      if (val) val.textContent = fmt(price);
      wrap.classList.add('active');
    }
    function hideHover() {
      var wrap = chartBox.querySelector('#dexChartHover');
      if (wrap) wrap.classList.remove('active');
    }
    chartBox.addEventListener('mouseenter', function(e) { showHover(e.clientX); });
    chartBox.addEventListener('mousemove',  function(e) { showHover(e.clientX); });
    chartBox.addEventListener('mouseleave', hideHover);
    chartBox.addEventListener('touchstart', function(e) {
      var t = e.touches[0]; if (t) showHover(t.clientX);
    }, { passive: true });
    chartBox.addEventListener('touchmove', function(e) {
      var t = e.touches[0]; if (t) { showHover(t.clientX); e.preventDefault && e.preventDefault(); }
    }, { passive: false });
    chartBox.addEventListener('touchend', hideHover);
    chartBox.addEventListener('touchcancel', hideHover);
  });
})();
