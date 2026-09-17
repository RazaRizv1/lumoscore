
// === Pool chart (metric + timeframe + line/candle) ===
(function() {
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function() {
    var wrap = document.getElementById('tvlChart');
    if (!wrap) return;

    var svgWrap = wrap.querySelector('.chart-svg-wrap');
    if (!svgWrap) {
      svgWrap = document.createElement('div');
      svgWrap.className = 'chart-svg-wrap';
      svgWrap.style.cssText = 'position:absolute;inset:0;';
      wrap.appendChild(svgWrap);
    }
    if (window.getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';

    // Detect mobile via container width (more reliable than window.innerWidth in iframes)
    var IS_MOBILE = (wrap.getBoundingClientRect().width || 500) < 500;
    // Use a viewBox whose aspect ratio is close to the container so preserveAspectRatio="none"
    // doesn't squash text. Mobile container is ~380×190 (≈ 2:1) so use W=400 H=220.
    var W = IS_MOBILE ? 400 : 1000;
    var H = IS_MOBILE ? 220 : 280;
    var PAD_R = IS_MOBILE ? 56 : 64;  // reserved right margin for y-axis labels
    var DRAW_W = W - PAD_R;
    var FS_Y = IS_MOBILE ? 9 : 10.5;   // y-tick font size
    var FS_X = IS_MOBILE ? 9 : 10.5;   // x-tick font size
    var BAR_FACTOR = IS_MOBILE ? 0.72 : 0.62;
    var BAR_MIN = IS_MOBILE ? 3 : 2.5;

    function makeRand(seed) {
      var s = seed;
      return function() { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    }

    // Fewer points on mobile so bars are wider / line less crowded
    var pointCounts = IS_MOBILE
      ? { '1D': 24, '1W': 14, '1M': 30, '3M': 45, '1Y': 60, 'ALL': 90 }
      : { '1D': 24, '1W': 28, '1M': 30, '3M': 65, '1Y': 110, 'ALL': 200 };

    var configs = {
      'tvl-1D':   { base: 3.20, drift: 0.0008, vol: 0.012, color: '#16a34a' },
      'tvl-1W':   { base: 3.10, drift: 0.0040, vol: 0.040, color: '#16a34a' },
      'tvl-1M':   { base: 2.85, drift: 0.018,  vol: 0.060, color: '#16a34a' },
      'tvl-3M':   { base: 2.30, drift: 0.018,  vol: 0.080, color: '#16a34a' },
      'tvl-1Y':   { base: 1.80, drift: 0.014,  vol: 0.090, color: '#16a34a' },
      'tvl-ALL':  { base: 1.40, drift: 0.011,  vol: 0.100, color: '#16a34a' },
      'vol-1D':   { base: 14,   drift: 0,      vol: 8,     color: '#8b7bff' },
      'vol-1W':   { base: 60,   drift: 0,      vol: 28,    color: '#8b7bff' },
      'vol-1M':   { base: 110,  drift: 0,      vol: 50,    color: '#8b7bff' },
      'vol-3M':   { base: 140,  drift: 0,      vol: 60,    color: '#8b7bff' },
      'vol-1Y':   { base: 180,  drift: 0,      vol: 95,    color: '#8b7bff' },
      'vol-ALL':  { base: 210,  drift: 0,      vol: 110,   color: '#8b7bff' }
    };

    function generatePts(metric, range) {
      var key = metric + '-' + range;
      var cfg = configs[key] || configs['tvl-1Y'];
      var n = pointCounts[range] || 100;
      var seed = key.split('').reduce(function(a,c) { return a + c.charCodeAt(0); }, 7);
      var rand = makeRand(seed);
      var pts = [];
      var v = cfg.base;
      for (var i = 0; i < n; i++) {
        if (metric === 'vol') {
          v = cfg.base + (rand() - 0.3) * cfg.vol + Math.sin(i * 0.7) * cfg.vol * 0.3;
          pts.push(Math.max(cfg.base * 0.2, v));
        } else {
          v += (rand() - 0.5) * cfg.vol + cfg.drift;
          pts.push(v);
        }
      }
      return { pts: pts, cfg: cfg };
    }

    var state = { type: 'line', range: '1Y', metric: 'tvl' };
    var currentPts = [], currentMin = 0, currentMax = 1, currentStep = 1, currentColor = '#16a34a';

    function fmtY(val, metric) {
      if (metric === 'vol') {
        if (val >= 1000) return (val / 1000).toFixed(1) + 'M';
        return Math.round(val) + 'K';
      }
      return val.toFixed(2) + 'M';
    }
    function unitY() { return ' APT'; }

    function xLabelsFor(range, n) {
      var now = new Date();
      var spans = {'1D':1, '1W':7, '1M':30, '3M':90, '1Y':365, 'ALL':730};
      var days = spans[range] || 365;
      if (range === '1D') {
        var hours = IS_MOBILE ? ['12a','6a','12p','6p','11p'] : ['12a','4a','8a','12p','4p','8p','11p'];
        return hours.map(function(h,i){ return {pos: i/(hours.length-1), text: h}; });
      }
      var ticks = IS_MOBILE ? Math.min(5, n) : Math.min(7, n);
      var out = [];
      for (var i = 0; i < ticks; i++) {
        var pos = i / (ticks - 1);
        var dt = new Date(now - (1-pos) * days * 86400000);
        var fmt;
        if (days <= 30) fmt = dt.toLocaleDateString('en-US', {month:'short', day:'numeric'});
        else if (days <= 365) fmt = dt.toLocaleDateString('en-US', {month:'short'});
        else fmt = dt.toLocaleDateString('en-US', {month:'short', year:'2-digit'});
        out.push({pos: pos, text: fmt});
      }
      return out;
    }

    function renderChart() {
      var gen = generatePts(state.metric, state.range);
      var pts = gen.pts;
      var cfg = gen.cfg;
      var minV = Math.min.apply(null, pts);
      var maxV = Math.max.apply(null, pts);
      var pad = (maxV - minV) * 0.12 || 0.5;
      minV -= pad; maxV += pad * 0.5;
      if (state.metric === 'vol') minV = 0;
      var range = maxV - minV || 1;
      var step = DRAW_W / Math.max(1, pts.length - 1);
      var color = cfg.color;
      var fillGradId = state.metric === 'vol' ? 'volGrad' : 'tvlGrad';

      currentPts = pts.slice();
      currentMin = minV; currentMax = maxV; currentStep = step; currentColor = color;

      function yFor(val) { return H - 20 - ((val - minV) / range) * (H - 40); }

      // Y-axis ticks (5 ticks) — in reserved right margin
      var yTicks = '';
      var Y_TICK_COUNT = 5;
      for (var k = 0; k < Y_TICK_COUNT; k++) {
        var tv = minV + (range * (Y_TICK_COUNT - 1 - k) / (Y_TICK_COUNT - 1));
        var ty = (k / (Y_TICK_COUNT - 1)) * (H - 40) + 12;
        yTicks += '<text x="' + (W - 4) + '" y="' + (ty + 4) + '" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="' + FS_Y + '" fill="#75757f">' + fmtY(tv, state.metric) + unitY() + '</text>';
        yTicks += '<line x1="0" y1="' + ty.toFixed(1) + '" x2="' + DRAW_W + '" y2="' + ty.toFixed(1) + '" stroke="rgba(180,180,200,0.08)" stroke-width="1"/>';
      }

      // X-axis labels
      var xLabels = '';
      var lblData = xLabelsFor(state.range, pts.length);
      for (var mm = 0; mm < lblData.length; mm++) {
        var lx = lblData[mm].pos * DRAW_W;
        var anchor = mm === 0 ? 'start' : (mm === lblData.length - 1 ? 'end' : 'middle');
        xLabels += '<text x="' + lx.toFixed(0) + '" y="' + (H - 2) + '" text-anchor="' + anchor + '" font-family="Plus Jakarta Sans, sans-serif" font-size="' + FS_X + '" fill="#75757f">' + lblData[mm].text + '</text>';
      }

      var contentSVG = '';
      var defs = '<defs>' +
        '<linearGradient id="' + fillGradId + '" x1="0" x2="0" y1="0" y2="1">' +
          '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.28"/>' +
          '<stop offset="100%" stop-color="' + color + '" stop-opacity="0"/>' +
        '</linearGradient>' +
      '</defs>';

      if (state.metric === 'vol' || state.type === 'bar') {
        var barWidth = Math.max(BAR_MIN, step * BAR_FACTOR);
        var bars = '';
        for (var i = 0; i < pts.length; i++) {
          var cx = i * step;
          var c = pts[i];
          if (state.metric === 'vol') {
            var yC = yFor(c);
            var yBase = yFor(minV);
            bars += '<rect x="' + (cx - barWidth/2).toFixed(1) + '" y="' + yC.toFixed(1) + '" width="' + barWidth.toFixed(1) + '" height="' + Math.max(2, yBase - yC).toFixed(1) + '" fill="' + color + '" opacity="0.82" rx="' + (IS_MOBILE ? 1 : 1.5) + '"/>';
          } else {
            var o = (i > 0) ? pts[i-1] : c;
            var spread = Math.abs(c - o) * 0.4 + (range * 0.025);
            var hi = Math.max(c, o) + spread;
            var lo = Math.min(c, o) - spread;
            var yHi = yFor(hi), yLo = yFor(lo), yO = yFor(o), yC2 = yFor(c);
            var bodyTop = Math.min(yO, yC2);
            var bodyH = Math.max(2.5, Math.abs(yO - yC2));
            var candleColor = (c >= o) ? '#16a34a' : '#ff5b5b';
            bars += '<line x1="' + cx.toFixed(1) + '" y1="' + yHi.toFixed(1) + '" x2="' + cx.toFixed(1) + '" y2="' + yLo.toFixed(1) + '" stroke="' + candleColor + '" stroke-width="1.4"/>';
            bars += '<rect x="' + (cx - barWidth/2).toFixed(1) + '" y="' + bodyTop.toFixed(1) + '" width="' + barWidth.toFixed(1) + '" height="' + bodyH.toFixed(1) + '" fill="' + candleColor + '" rx="1"/>';
          }
        }
        contentSVG = defs + bars;
      } else {
        var path = '';
        for (var i = 0; i < pts.length; i++) {
          var x = i * step;
          var y = yFor(pts[i]);
          path += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
        }
        var area = path + 'L ' + DRAW_W + ' ' + yFor(minV).toFixed(1) + ' L 0 ' + yFor(minV).toFixed(1) + ' Z';
        var lastX = (pts.length - 1) * step;
        var lastY = yFor(pts[pts.length - 1]);
        contentSVG = defs +
          '<path d="' + area + '" fill="url(#' + fillGradId + ')"/>' +
          '<path d="' + path + '" fill="none" stroke="' + color + '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<circle cx="' + lastX.toFixed(1) + '" cy="' + lastY.toFixed(1) + '" r="3.5" fill="' + color + '"/>';
      }

      svgWrap.innerHTML =
        '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="display:block;width:100%;height:100%;">' +
          contentSVG + yTicks + xLabels +
        '</svg>';
    }
    renderChart();

    document.querySelectorAll('.tf-mini').forEach(function(grp) {
      var btns = grp.querySelectorAll('button');
      btns.forEach(function(btn) {
        btn.addEventListener('click', function() {
          btns.forEach(function(b) { b.classList.toggle('active', b === btn); });
          state.range = (btn.textContent || '').trim().toUpperCase();
          renderChart();
        });
      });
    });
    document.querySelectorAll('.chart-type').forEach(function(grp) {
      var btns = grp.querySelectorAll('button');
      btns.forEach(function(btn, idx) {
        btn.addEventListener('click', function() {
          btns.forEach(function(b) { b.classList.toggle('active', b === btn); });
          state.type = (idx === 0) ? 'line' : 'bar';
          renderChart();
        });
      });
    });

    var modeBtn = document.querySelector('.chart-mode-select');
    if (modeBtn) {
      var menu = document.querySelector('#chartMetricMenu');
      if (!menu) {
        menu = document.createElement('div');
        menu.id = 'chartMetricMenu';
        menu.className = 'chart-mode-menu';
        menu.innerHTML =
          '<button data-metric="tvl" class="active">Pool TVL</button>' +
          '<button data-metric="vol">Volume</button>';
        if (window.getComputedStyle(modeBtn.parentElement).position === 'static') {
          modeBtn.parentElement.style.position = 'relative';
        }
        modeBtn.parentElement.insertBefore(menu, modeBtn.nextSibling);
      }
      modeBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation();
        menu.classList.toggle('open');
      });
      document.addEventListener('click', function(e) {
        if (!menu.contains(e.target) && e.target !== modeBtn) menu.classList.remove('open');
      });
      menu.querySelectorAll('button').forEach(function(btn) {
        btn.addEventListener('click', function() {
          menu.querySelectorAll('button').forEach(function(b) { b.classList.toggle('active', b === btn); });
          var metric = btn.getAttribute('data-metric');
          state.metric = metric;
          var label = (metric === 'vol') ? 'Volume' : 'Pool TVL';
          var caret = modeBtn.querySelector('svg');
          modeBtn.innerHTML = label + ' ' + (caret ? caret.outerHTML : '');
          menu.classList.remove('open');
          renderChart();
        });
      });
    }

    window.__tvlChartState = function() {
      return { pts: currentPts, minV: currentMin, maxV: currentMax, step: currentStep,
               W: W, H: H, DRAW_W: DRAW_W,
               type: state.type, range: state.range, metric: state.metric, color: currentColor };
    };
  });
})();
