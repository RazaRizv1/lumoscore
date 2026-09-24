
(function() {
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function() {
    var root = document.documentElement;

    // === Theme toggle ===
    var SUN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>';
    var XDC = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    var themeBtn = document.getElementById('themeBtn') || document.createElement('button');
    var themeIcon = document.getElementById('themeIcon');
    function updateThemeIcon() {
      var t = root.getAttribute('data-theme');
      themeBtn.innerHTML = t === 'dark' ? SUN : XDC;
    }
    updateThemeIcon();
    themeBtn.addEventListener('click', function() {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      updateThemeIcon();
      // Rebuild chart so dot strokes get the new bg color
      buildChart();
    });

    // === Toast helper ===
    (function() {
      var stack = document.querySelector('.toast-stack');
      if (!stack) {
        stack = document.createElement('div');
        stack.className = 'toast-stack';
        document.body.appendChild(stack);
      }
      window.showToast = function(msg) {
        var t = document.createElement('div');
        t.className = 'toast';
        t.innerHTML = '<span class="check-ic"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' + msg;
        stack.appendChild(t);
        setTimeout(function() { t.remove(); }, 2200);
      };
    })();

    // (data-copy now handled by global delegated handler)
    function fallback(text) {
      var t = document.createElement('textarea');
      t.value = text; t.style.position = 'fixed'; t.style.left = '-9999px';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); } catch(_) {}
      document.body.removeChild(t);
    }

    // === Modal open / close (with body-scroll-lock) ===
    function openModal(id) {
      var m = document.getElementById(id);
      if (m) { m.classList.add('open'); document.body.classList.add('modal-open'); }
    }
    function closeModal(el) {
      var m = el.closest('.modal-overlay');
      if (m) m.classList.remove('open');
      if (!document.querySelector('.modal-overlay.open')) document.body.classList.remove('modal-open');
    }
    document.querySelectorAll('[data-open-modal]').forEach(function(btn) {
      btn.addEventListener('click', function() { openModal(btn.getAttribute('data-open-modal')); });
    });
    document.querySelectorAll('[data-close]').forEach(function(btn) {
      btn.addEventListener('click', function() { closeModal(btn); });
    });
    document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
          overlay.classList.remove('open');
          if (!document.querySelector('.modal-overlay.open')) document.body.classList.remove('modal-open');
        }
      });
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.open').forEach(function(m) { m.classList.remove('open'); });
        document.body.classList.remove('modal-open');
      }
    });

    // === Chain filter ===
    document.querySelectorAll('#chainFilter button').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('#chainFilter button').forEach(function(b) { b.classList.toggle('active', b === btn); });
        var c = btn.dataset.chain;
        document.querySelectorAll('#poolList .pool-item').forEach(function(r) {
          if (c === 'all') r.style.display = '';
          else r.style.display = r.dataset.chain === c ? '' : 'none';
        });
      });
    });

    // === Period selector — wired up below, after buildChart is defined ===

    // === Price chart with touch tooltip ===
    var chartState = null;
    var currentRange = '7D';

    // Time-range presets. Each preset controls how many points are plotted,
    // how far back the window stretches, how volatile the synthetic data
    // feels, and how to format axis labels for that scale.
    var MIN_MS = 60 * 1000;
    var HOUR_MS = 60 * MIN_MS;
    var DAY_MS = 24 * HOUR_MS;
    var ranges = {
      '1H':  { nPts: 60,  stepMs: 1 * MIN_MS,  vol: 0.008, seedS: 11, seedX: 13, base: 0.00320, lblFmt: 'time' },
      '24H': { nPts: 96,  stepMs: 15 * MIN_MS, vol: 0.012, seedS: 17, seedX: 19, base: 0.00316, lblFmt: 'hour' },
      '7D':  { nPts: 168, stepMs: HOUR_MS,     vol: 0.025, seedS: 7,  seedX: 31, base: 0.00305, lblFmt: 'day' },
      '30D': { nPts: 120, stepMs: 6 * HOUR_MS, vol: 0.045, seedS: 23, seedX: 29, base: 0.00280, lblFmt: 'date' },
      '1Y':  { nPts: 180, stepMs: 2 * DAY_MS,  vol: 0.080, seedS: 37, seedX: 41, base: 0.00210, lblFmt: 'month' },
      'All': { nPts: 220, stepMs: 4 * DAY_MS,  vol: 0.140, seedS: 43, seedX: 47, base: 0.00150, lblFmt: 'month-year' }
    };

    var MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    function buildChart(rangeKey) {
      if (rangeKey) currentRange = rangeKey;
      var r = ranges[currentRange] || ranges['7D'];

      var wrap = document.getElementById('priceChart');
      if (!wrap) return;
      var W = 700, H = 200;
      var ML = 0, MR = 0, MT = 8, MB = 22;

      function makeRng(seed) {
        var s = seed;
        return function() {
          s = (s * 9301 + 49297) % 233280;
          return s / 233280;
        };
      }
      var nPts = r.nPts;
      function buildSeries(rng, base, vol) {
        var pts = [];
        var v = base;
        var drift = base * 0.0008;
        for (var i = 0; i < nPts; i++) {
          v += (rng() - 0.48) * (base * vol) + drift;
          v = Math.max(base * (1 - vol * 4), Math.min(base * (1 + vol * 4), v));
          pts.push(v);
        }
        return pts;
      }
      var stellar = buildSeries(makeRng(r.seedS), r.base, r.vol);
      var xrpl    = buildSeries(makeRng(r.seedX), r.base * 0.985, r.vol);

      var stellarSupply = 618e6;
      var xrplSupply    = 552e6;

      var endTs = new Date('2026-05-26T12:00:00Z').getTime();
      var timestamps = [];
      for (var i = 0; i < nPts; i++) {
        timestamps.push(endTs - (nPts - 1 - i) * r.stepMs);
      }

      var allV = stellar.concat(xrpl);
      var minV = Math.min.apply(null, allV);
      var maxV = Math.max.apply(null, allV);
      var range = maxV - minV || 1;
      var pad = range * 0.10;
      minV -= pad; maxV += pad; range = maxV - minV;

      var plotW = W - ML - MR;
      var plotH = H - MT - MB;
      var step = plotW / (nPts - 1);

      function xAt(i) { return ML + i * step; }
      function yAt(v) { return MT + plotH - ((v - minV) / range) * plotH; }

      function toPath(pts) {
        var d = '';
        for (var i = 0; i < pts.length; i++) {
          d += (i === 0 ? 'M' : 'L') + xAt(i).toFixed(1) + ' ' + yAt(pts[i]).toFixed(1) + ' ';
        }
        return d;
      }
      function toArea(pts) {
        return toPath(pts) + 'L ' + xAt(pts.length - 1).toFixed(1) + ' ' + (MT + plotH) + ' L ' + ML + ' ' + (MT + plotH) + ' Z';
      }
      var pathAptos = toPath(stellar);
      var areaAptos = toArea(stellar);
      var pathXrpl = toPath(xrpl);
      var areaXrpl = toArea(xrpl);

      // x-axis labels for the current range — sparse on mobile (4 labels)
      function fmtAxis(ts, mode) {
        var d = new Date(ts);
        if (mode === 'time') {
          var m = d.getUTCMinutes();
          return (m < 10 ? '0' : '') + m + 'm';
        }
        if (mode === 'hour') {
          var h = d.getUTCHours();
          var hh = (h % 12 || 12);
          return hh + (h < 12 ? 'a' : 'p');
        }
        if (mode === 'day' || mode === 'date') return MONTHS_SHORT[d.getUTCMonth()] + ' ' + d.getUTCDate();
        if (mode === 'month') return MONTHS_SHORT[d.getUTCMonth()];
        return MONTHS_SHORT[d.getUTCMonth()] + ' ' + String(d.getUTCFullYear()).slice(-2);
      }
      var nLabels = 4;
      var xLabels = '';
      for (var m = 0; m < nLabels; m++) {
        var i = Math.round((m / (nLabels - 1)) * (nPts - 1));
        var tx = ML + (m / (nLabels - 1)) * plotW;
        var anchor = m === 0 ? 'start' : (m === nLabels - 1 ? 'end' : 'middle');
        xLabels += '<text x="' + tx.toFixed(0) + '" y="' + (H - 4) + '" text-anchor="' + anchor + '" font-family="Plus Jakarta Sans, sans-serif" font-size="9.5" fill="' + getComputedStyle(root).getPropertyValue('--text-soft').trim() + '">' + fmtAxis(timestamps[i], r.lblFmt) + '</text>';
      }

      var accent = getComputedStyle(root).getPropertyValue('--accent').trim();
      var xrplColor = getComputedStyle(root).getPropertyValue('--xrpl').trim();
      var dotStroke = getComputedStyle(root).getPropertyValue('--dot-stroke').trim();

      wrap.innerHTML =
        '<svg id="priceChartSvg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="overflow:visible">' +
          '<defs>' +
            '<linearGradient id="gradAptos" x1="0" x2="0" y1="0" y2="1">' +
              '<stop offset="0%" stop-color="' + accent + '" stop-opacity="0.22"/>' +
              '<stop offset="100%" stop-color="' + accent + '" stop-opacity="0"/>' +
            '</linearGradient>' +
            '<linearGradient id="gradXrpl" x1="0" x2="0" y1="0" y2="1">' +
              '<stop offset="0%" stop-color="' + xrplColor + '" stop-opacity="0.20"/>' +
              '<stop offset="100%" stop-color="' + xrplColor + '" stop-opacity="0"/>' +
            '</linearGradient>' +
          '</defs>' +
          '<path d="' + areaAptos + '" fill="url(#gradAptos)"/>' +
          
          '<path d="' + pathAptos + '" fill="none" stroke="' + accent + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<line id="chartCrosshair" x1="0" y1="' + MT + '" x2="0" y2="' + (MT + plotH) + '" stroke="#a5a4ac" stroke-width="1" stroke-dasharray="3 3" opacity="0"/>' +
          '<circle id="chartDotAptos" r="4.5" fill="' + accent + '" stroke="' + dotStroke + '" stroke-width="2" opacity="0"/>' +
          '<circle id="chartDotXrpl" r="4.5" fill="none" stroke="none" opacity="0"/>' +
          xLabels +
          '<rect id="chartHover" x="' + ML + '" y="0" width="' + plotW + '" height="' + H + '" fill="transparent" style="cursor:crosshair"/>' +
        '</svg>' +
        '<div id="chartTooltip" class="chart-tooltip" aria-hidden="true">' +
          '<div class="ct-date" id="ctDate">—</div>' +
          '<div class="ct-row">' +
            '<span class="ct-dot" style="background:' + accent + '"></span>' +
            '<span class="ct-name">Aptos</span>' +
            '<span class="ct-spacer"></span>' +
            '<span class="ct-price" id="ctPriceAptos">—</span>' +
          '</div>' +
          '<div class="ct-sub" id="ctMcAptos">MC —</div>' +
          '<div class="ct-row" style="display:none">' +
            '<span class="ct-dot" style="background:' + xrplColor + '"></span>' +
            '<span class="ct-name">Aptos</span>' +
            '<span class="ct-spacer"></span>' +
            '<span class="ct-price" id="ctPriceXrpl">—</span>' +
          '</div>' +
          '<div class="ct-sub" id="ctMcXrpl" style="display:none">MC —</div>' +
        '</div>';

      chartState = {
        wrap: wrap, W: W, H: H, ML: ML, MT: MT, plotW: plotW, plotH: plotH, step: step, nPts: nPts,
        xAt: xAt, yAt: yAt,
        stellar: stellar, xrpl: xrpl, timestamps: timestamps,
        stellarSupply: stellarSupply, xrplSupply: xrplSupply,
        lblFmt: r.lblFmt
      };

      var hoverRect = document.getElementById('chartHover');
      hoverRect.addEventListener('mousemove', showHover);
      hoverRect.addEventListener('mouseleave', hideHover);
      hoverRect.addEventListener('touchstart', function(e) {
        if (e.touches[0]) { e.preventDefault(); showHover(e.touches[0]); }
      }, { passive: false });
      hoverRect.addEventListener('touchmove', function(e) {
        if (e.touches[0]) { e.preventDefault(); showHover(e.touches[0]); }
      }, { passive: false });
      hoverRect.addEventListener('touchend', hideHover);
    }

    function fmtPrice(p) {
      if (p < 0.001) return '$' + p.toFixed(6);
      if (p < 0.01) return '$' + p.toFixed(5);
      if (p < 1) return '$' + p.toFixed(4);
      return '$' + p.toFixed(2);
    }
    function fmtMc(p, supply) {
      var mc = p * supply;
      if (mc >= 1e6) return '$' + (mc / 1e6).toFixed(2) + 'M';
      if (mc >= 1e3) return '$' + (mc / 1e3).toFixed(2) + 'K';
      return '$' + mc.toFixed(2);
    }
    function fmtDate(ts, mode) {
      var d = new Date(ts);
      var dateStr = MONTHS_SHORT[d.getUTCMonth()] + ' ' + d.getUTCDate();
      if (mode === 'time' || mode === 'hour') {
        var h = d.getUTCHours();
        var mm = d.getUTCMinutes();
        var hh = (h % 12 || 12);
        var ap = h < 12 ? 'AM' : 'PM';
        var mms = (mm < 10 ? '0' : '') + mm;
        return dateStr + ' · ' + hh + ':' + mms + ' ' + ap;
      }
      return dateStr + ', ' + d.getUTCFullYear();
    }

    function showHover(e) {
      if (!chartState) return;
      var svg = document.getElementById('priceChartSvg');
      var rect = svg.getBoundingClientRect();
      var sx = (e.clientX - rect.left) * (chartState.W / rect.width);
      var idx = Math.round((sx - chartState.ML) / chartState.step);
      if (idx < 0) idx = 0;
      if (idx > chartState.nPts - 1) idx = chartState.nPts - 1;

      var px = chartState.xAt(idx);
      var sPrice = chartState.stellar[idx];
      var xPrice = chartState.xrpl[idx];
      var sY = chartState.yAt(sPrice);
      var xY = chartState.yAt(xPrice);

      var crosshair = document.getElementById('chartCrosshair');
      var dotS = document.getElementById('chartDotAptos');
      var dotX = document.getElementById('chartDotXrpl');
      crosshair.setAttribute('x1', px); crosshair.setAttribute('x2', px); crosshair.setAttribute('opacity', '1');
      dotS.setAttribute('cx', px); dotS.setAttribute('cy', sY); dotS.setAttribute('opacity', '1');
      dotX.setAttribute('cx', px); dotX.setAttribute('cy', xY); dotX.setAttribute('opacity', '1');

      document.getElementById('ctDate').textContent = fmtDate(chartState.timestamps[idx], chartState.lblFmt);
      document.getElementById('ctPriceAptos').textContent = fmtPrice(sPrice);
      document.getElementById('ctPriceXrpl').textContent = fmtPrice(xPrice);
      document.getElementById('ctMcAptos').textContent = 'MC: ' + fmtMc(sPrice, chartState.stellarSupply);
      document.getElementById('ctMcXrpl').textContent = 'MC: ' + fmtMc(xPrice, chartState.xrplSupply);

      var wrap = chartState.wrap;
      var wrapRect = wrap.getBoundingClientRect();
      var pxScreen = rect.left + (px / chartState.W) * rect.width;
      var leftInWrap = pxScreen - wrapRect.left;
      var tt = document.getElementById('chartTooltip');
      var ttWidth = tt.offsetWidth || 180;
      var ttLeft = leftInWrap + 10;
      if (ttLeft + ttWidth > wrapRect.width - 6) {
        ttLeft = leftInWrap - ttWidth - 10;
      }
      if (ttLeft < 6) ttLeft = 6;
      tt.style.left = ttLeft + 'px';
      tt.style.top = '8px';
      tt.classList.add('visible');
    }
    function hideHover() {
      var c = document.getElementById('chartCrosshair');
      var s = document.getElementById('chartDotAptos');
      var x = document.getElementById('chartDotXrpl');
      var t = document.getElementById('chartTooltip');
      if (c) c.setAttribute('opacity', '0');
      if (s) s.setAttribute('opacity', '0');
      if (x) x.setAttribute('opacity', '0');
      if (t) t.classList.remove('visible');
    }

    // Wire up range tabs — clicking rebuilds the chart with that range
    document.querySelectorAll('.tf-strip').forEach(function(strip) {
      strip.querySelectorAll('button').forEach(function(b) {
        b.addEventListener('click', function() {
          strip.querySelectorAll('button').forEach(function(x) { x.classList.toggle('active', x === b); });
          var key = (b.textContent || '').trim();
          buildChart(key);
        });
      });
    });

    var initialBtn = document.querySelector('.tf-strip button.active');
    var initialKey = initialBtn ? (initialBtn.textContent || '').trim() : '7D';
    buildChart(initialKey);
  });
})();
