
// === Price chart (interactive with hover tooltip + working range tabs) ===
(function() {
  var wrap = document.getElementById('priceChart');
  if (!wrap) return;
  var W = 1000, H = 320;
  var ML = 0, MR = 0, MT = 8, MB = 22;

  function makeRng(seed) {
    var s = seed;
    return function() {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  var stellarSupply = 618e6;
  var xrplSupply    = 552e6;

  var endTs = new Date('2026-05-26T12:00:00Z').getTime();
  var MIN_MS = 60 * 1000;
  var HOUR_MS = 60 * MIN_MS;
  var DAY_MS = 24 * HOUR_MS;

  // Time-range presets. Each defines point count, step size, volatility,
  // seeds (so the lines actually look different across ranges), starting
  // price, and how to format axis labels for that scale.
  var ranges = {
    '1H':  { nPts: 60,  stepMs: 1 * MIN_MS,  vol: 0.008, seedS: 11, seedX: 13, base: 0.00320, lblFmt: 'time' },
    '24H': { nPts: 96,  stepMs: 15 * MIN_MS, vol: 0.012, seedS: 17, seedX: 19, base: 0.00316, lblFmt: 'hour' },
    '7D':  { nPts: 168, stepMs: HOUR_MS,     vol: 0.025, seedS: 7,  seedX: 31, base: 0.00305, lblFmt: 'day' },
    '30D': { nPts: 120, stepMs: 6 * HOUR_MS, vol: 0.045, seedS: 23, seedX: 29, base: 0.00280, lblFmt: 'date' },
    '1Y':  { nPts: 180, stepMs: 2 * DAY_MS,  vol: 0.080, seedS: 37, seedX: 41, base: 0.00210, lblFmt: 'month' },
    'All': { nPts: 220, stepMs: 4 * DAY_MS,  vol: 0.140, seedS: 43, seedX: 47, base: 0.00150, lblFmt: 'month-year' }
  };

  function buildSeries(rng, base, vol, nPts) {
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
  function buildTimestamps(stepMs, nPts) {
    var ts = [];
    for (var i = 0; i < nPts; i++) ts.push(endTs - (nPts - 1 - i) * stepMs);
    return ts;
  }

  var MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
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
  function fmtTooltipDate(ts, mode) {
    var d = new Date(ts);
    var dateStr = MONTHS_SHORT[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear();
    if (mode === 'time' || mode === 'hour') {
      var h = d.getUTCHours();
      var m = d.getUTCMinutes();
      var hh = (h % 12 || 12);
      var ap = h < 12 ? 'AM' : 'PM';
      var mm = (m < 10 ? '0' : '') + m;
      return dateStr + ' · ' + hh + ':' + mm + ' ' + ap;
    }
    return dateStr;
  }

  var state = {
    nPts: 0, step: 0, stellar: [], xrpl: [],
    timestamps: [], minV: 0, range: 1, lblFmt: 'day'
  };

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

  function render(rangeKey) {
    var r = ranges[rangeKey];
    if (!r) r = ranges['7D'];

    var nPts = r.nPts;
    var stellar = buildSeries(makeRng(r.seedS), r.base, r.vol, nPts);
    var xrpl    = buildSeries(makeRng(r.seedX), r.base * 0.985, r.vol, nPts);
    var timestamps = buildTimestamps(r.stepMs, nPts);

    var allV = stellar.concat(xrpl);
    var minV = Math.min.apply(null, allV);
    var maxV = Math.max.apply(null, allV);
    var rangeV = maxV - minV || 1;
    var pad = rangeV * 0.10;
    minV -= pad; maxV += pad; rangeV = maxV - minV;

    var plotW = W - ML - MR;
    var plotH = H - MT - MB;
    var step = plotW / (nPts - 1);

    function xAt(i) { return ML + i * step; }
    function yAt(v) { return MT + plotH - ((v - minV) / rangeV) * plotH; }
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

    var yTicks = '';
    for (var k = 0; k <= 4; k++) {
      var v = minV + (k / 4) * rangeV;
      var ty = MT + plotH - (k / 4) * plotH;
      yTicks += '<text x="' + (W - 6) + '" y="' + (ty + 4) + '" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#75757f">' + fmtPrice(v) + '</text>';
    }
    var xLabels = '';
    var nLabels = 7;
    for (var m = 0; m < nLabels; m++) {
      var i = Math.round((m / (nLabels - 1)) * (nPts - 1));
      var tx = ML + (m / (nLabels - 1)) * plotW;
      var anchor = m === 0 ? 'start' : (m === nLabels - 1 ? 'end' : 'middle');
      xLabels += '<text x="' + tx.toFixed(0) + '" y="' + (H - 4) + '" text-anchor="' + anchor + '" font-family="Plus Jakarta Sans, sans-serif" font-size="10.5" fill="#75757f">' + fmtAxis(timestamps[i], r.lblFmt) + '</text>';
    }

    wrap.innerHTML =
      '<svg id="priceChartSvg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="overflow:visible">' +
        '<defs>' +
          '<linearGradient id="gradAptos" x1="0" x2="0" y1="0" y2="1">' +
            '<stop offset="0%" stop-color="#ea6a2c" stop-opacity="0.20"/>' +
            '<stop offset="100%" stop-color="#ea6a2c" stop-opacity="0"/>' +
          '</linearGradient>' +
          '<linearGradient id="gradXrpl" x1="0" x2="0" y1="0" y2="1">' +
            '<stop offset="0%" stop-color="#0284c7" stop-opacity="0.18"/>' +
            '<stop offset="100%" stop-color="#0284c7" stop-opacity="0"/>' +
          '</linearGradient>' +
        '</defs>' +
        '<path d="' + areaAptos + '" fill="url(#gradAptos)"/>' +
        
        '<path d="' + pathAptos + '" fill="none" stroke="#ea6a2c" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<line id="chartCrosshair" x1="0" y1="' + MT + '" x2="0" y2="' + (MT + plotH) + '" stroke="#a5a4ac" stroke-width="1" stroke-dasharray="3 3" opacity="0"/>' +
        '<circle id="chartDotAptos" r="4.5" fill="#ea6a2c" stroke="#ffffff" stroke-width="2" opacity="0"/>' +
        '<circle id="chartDotXrpl" r="4.5" fill="none" stroke="none" opacity="0"/>' +
        yTicks + xLabels +
        '<rect id="chartHover" x="' + ML + '" y="' + MT + '" width="' + plotW + '" height="' + plotH + '" fill="transparent" style="cursor:crosshair"/>' +
      '</svg>' +
      '<div id="chartTooltip" class="chart-tooltip" aria-hidden="true">' +
        '<div class="ct-date" id="ctDate">—</div>' +
        '<div class="ct-row">' +
          '<span class="ct-dot" style="background:#ea6a2c"></span>' +
          '<span class="ct-name">LUMOS (Aptos)</span>' +
          '<span class="ct-spacer"></span>' +
          '<span class="ct-price" id="ctPriceAptos">—</span>' +
        '</div>' +
        '<div class="ct-sub" id="ctMcAptos">MC —</div>' +
        '<div class="ct-row" style="display:none">' +
          '<span class="ct-dot" style="background:#0284c7"></span>' +
          '<span class="ct-name">LUMOS (Aptos)</span>' +
          '<span class="ct-spacer"></span>' +
          '<span class="ct-price" id="ctPriceXrpl">—</span>' +
        '</div>' +
        '<div class="ct-sub" id="ctMcXrpl" style="display:none">MC —</div>' +
      '</div>';

    state.nPts = nPts; state.step = step;
    state.stellar = stellar; state.xrpl = xrpl;
    state.timestamps = timestamps;
    state.minV = minV; state.range = rangeV;
    state.lblFmt = r.lblFmt;
    state.xAt = xAt; state.yAt = yAt;

    bindHover();
  }

  function bindHover() {
    var svg = document.getElementById('priceChartSvg');
    var hoverRect = document.getElementById('chartHover');
    var crosshair = document.getElementById('chartCrosshair');
    var dotS = document.getElementById('chartDotAptos');
    var dotX = document.getElementById('chartDotXrpl');
    var tooltip = document.getElementById('chartTooltip');
    var ctDate = document.getElementById('ctDate');
    var ctPriceS = document.getElementById('ctPriceAptos');
    var ctPriceX = document.getElementById('ctPriceXrpl');
    var ctMcS = document.getElementById('ctMcAptos');
    var ctMcX = document.getElementById('ctMcXrpl');

    function showHover(e) {
      var rect = svg.getBoundingClientRect();
      var sx = (e.clientX - rect.left) * (W / rect.width);
      var idx = Math.round((sx - ML) / state.step);
      if (idx < 0) idx = 0;
      if (idx > state.nPts - 1) idx = state.nPts - 1;

      var px = state.xAt(idx);
      var sPrice = state.stellar[idx];
      var xPrice = state.xrpl[idx];
      crosshair.setAttribute('x1', px); crosshair.setAttribute('x2', px); crosshair.setAttribute('opacity', '1');
      dotS.setAttribute('cx', px); dotS.setAttribute('cy', state.yAt(sPrice)); dotS.setAttribute('opacity', '1');
      dotX.setAttribute('cx', px); dotX.setAttribute('cy', state.yAt(xPrice)); dotX.setAttribute('opacity', '1');

      ctDate.textContent = fmtTooltipDate(state.timestamps[idx], state.lblFmt);
      ctPriceS.textContent = fmtPrice(sPrice);
      ctPriceX.textContent = fmtPrice(xPrice);
      ctMcS.textContent = 'Market cap: ' + fmtMc(sPrice, stellarSupply);
      ctMcX.textContent = 'Market cap: ' + fmtMc(xPrice, xrplSupply);

      var wrapRect = wrap.getBoundingClientRect();
      var pxScreen = rect.left + (px / W) * rect.width;
      var leftInWrap = pxScreen - wrapRect.left;
      var ttWidth = tooltip.offsetWidth || 200;
      var ttLeft = leftInWrap + 14;
      if (ttLeft + ttWidth > wrapRect.width - 8) ttLeft = leftInWrap - ttWidth - 14;
      if (ttLeft < 8) ttLeft = 8;
      tooltip.style.left = ttLeft + 'px';
      tooltip.style.top = '12px';
      tooltip.classList.add('visible');
    }
    function hideHover() {
      crosshair.setAttribute('opacity', '0');
      dotS.setAttribute('opacity', '0');
      dotX.setAttribute('opacity', '0');
      tooltip.classList.remove('visible');
    }

    hoverRect.addEventListener('mousemove', showHover);
    hoverRect.addEventListener('mouseleave', hideHover);
    hoverRect.addEventListener('touchstart', function(e) { if (e.touches[0]) showHover(e.touches[0]); }, { passive: true });
    hoverRect.addEventListener('touchmove',  function(e) { if (e.touches[0]) showHover(e.touches[0]); }, { passive: true });
    hoverRect.addEventListener('touchend', hideHover);
  }

  document.querySelectorAll('.tf-mini').forEach(function(group) {
    group.querySelectorAll('button').forEach(function(btn) {
      btn.addEventListener('click', function() {
        group.querySelectorAll('button').forEach(function(b) { b.classList.toggle('active', b === btn); });
        var key = (btn.textContent || '').trim();
        render(key);
      });
    });
  });

  var initialBtn = document.querySelector('.tf-mini button.active');
  var initialKey = initialBtn ? (initialBtn.textContent || '').trim() : '7D';
  render(initialKey);
})();

// === Chain filter ===
(function() {
  var filter = document.getElementById('chainFilter');
  var body = document.getElementById('poolsBody');
  if (!filter || !body) return;
  filter.querySelectorAll('button').forEach(function(btn) {
    btn.addEventListener('click', function() {
      filter.querySelectorAll('button').forEach(function(b) { b.classList.toggle('active', b === btn); });
      var c = btn.dataset.chain;
      body.querySelectorAll('tr').forEach(function(r) {
        if (c === 'all') r.style.display = '';
        else r.style.display = r.dataset.chain === c ? '' : 'none';
      });
    });
  });
})();

// === Period selector now handled inside the chart IIFE above ===

// === Theme toggle: in-page (toggles html[data-theme] + swaps icon) ===
(function() {
  var btn = document.getElementById('themeBtn');
  var icon = document.getElementById('themeIcon');
  if (!btn) return;
  var root = document.documentElement;
  var SUN = '<svg id="themeIcon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  var XDC = '<svg id="themeIcon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  function applyIcon() {
    var t = root.getAttribute('data-theme');
    // Showing the icon that represents what clicking will give you
    btn.innerHTML = (t === 'dark') ? SUN : XDC;
  }
  applyIcon();
  btn.addEventListener('click', function() {
    var current = root.getAttribute('data-theme');
    root.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
    applyIcon();
  });
})();

// === Toast utility + copy-to-clipboard + modal open/close ===
(function() {
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  ready(function() {
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  function showToast(msg) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = '<span class="check-ic"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' + msg;
    stack.appendChild(t);
    setTimeout(function() { t.remove(); }, 2200);
  }
  window.showToast = showToast;

  document.querySelectorAll('[data-copy]').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      var text = btn.dataset.copy;
      if (!text) return;
      function done() { showToast('Address copied to clipboard'); }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function() {
          var ta = document.createElement('textarea');
          ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
          document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); done(); } catch(_) {}
          document.body.removeChild(ta);
        });
      } else {
        var ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch(_) {}
        document.body.removeChild(ta);
      }
    });
  });

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
  });
})();
