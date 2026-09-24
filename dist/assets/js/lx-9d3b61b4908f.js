
// ============================================================
// DEX ASSET PAGE WIRING (Launchpad-Asset structure)
// Header theme/search wiring lives in closing_post — do NOT duplicate here.
// ============================================================
(function() {
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  // ---------- Chart synth ----------
  function seedRand(seed) { var s = seed; return function() { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
  var PRICE_RANGES = {
    '1D': { points: 24, trend: 0.6, base: 4.55, swing: 0.10 },
    '1W': { points: 21, trend: 0.4, base: 4.35, swing: 0.15 },
    '1M': { points: 30, trend: 0.7, base: 3.90, swing: 0.25 },
    '1Y': { points: 60, trend: 1.6, base: 2.80, swing: 0.55 }
  };
  function genSeries(period, seed) {
    var cfg = PRICE_RANGES[period] || PRICE_RANGES['1D'];
    var rand = seedRand(seed || 17);
    var pts = []; var v = cfg.base;
    for (var i = 0; i < cfg.points; i++) {
      var noise = (rand() - 0.48) * cfg.swing * 0.4;
      var drift = (cfg.trend / cfg.points) * cfg.swing * 0.7;
      v = v + drift + noise;
      pts.push(v);
    }
    return pts;
  }

  var currentType = 'area';
  var currentPeriod = '1D';

  function renderChart() {
    var frame = document.getElementById('dxaChart');
    if (!frame) return;

    var prices = genSeries(currentPeriod, 26);
    var W = 900, H = 380;
    var PAD = { l: 18, r: 64, t: 16, b: 28 };

    // Split: price 65%, gap 6%, volume 29% of usable height
    var totalH = H - PAD.t - PAD.b;
    var priceH = totalH * 0.65;
    var gap    = totalH * 0.06;
    var volH   = totalH * 0.29;
    var priceTop = PAD.t;
    var priceBot = priceTop + priceH;
    var volTop   = priceBot + gap;
    var volBot   = volTop + volH;

    var pw = W - PAD.l - PAD.r;
    var n = prices.length;
    var step = pw / (n - 1);
    function xAt(i) { return PAD.l + i * step; }

    // Build deterministic OHLCV per index from prices (seeded by index so reproducible)
    function pseudo(seed) { var s = Math.sin(seed * 9301 + 49297) * 233280; return s - Math.floor(s); }
    var ohlcv = [];
    for (var i = 0; i < n; i++) {
      var p = prices[i];
      var prev = i > 0 ? prices[i-1] : p * (0.996 + pseudo(i+71) * 0.004);
      var diff = p - prev;
      var baseRange = Math.abs(diff) * 1.6 + p * 0.014;  // intraday range — bigger than before
      var openShift = (pseudo(i*3+11) - 0.5) * baseRange * 0.6;
      var open = prev + diff * 0.25 + openShift;
      var close = p;
      var top = Math.max(open, close);
      var bot = Math.min(open, close);
      var hExt = baseRange * (0.35 + pseudo(i*7+5) * 0.45);
      var lExt = baseRange * (0.35 + pseudo(i*5+19) * 0.45);
      var high = top + hExt;
      var low  = bot - lExt;
      // Volume — bigger on bigger moves
      var v = 0.35 + (Math.abs(diff) / Math.max(0.0001, p * 0.012)) * 0.55 + pseudo(i+200) * 0.45;
      ohlcv.push({ o: open, h: high, l: low, c: close, v: v });
    }

    // Price range from full OHLC
    var minP = ohlcv[0].l, maxP = ohlcv[0].h;
    for (var i = 1; i < n; i++) {
      if (ohlcv[i].l < minP) minP = ohlcv[i].l;
      if (ohlcv[i].h > maxP) maxP = ohlcv[i].h;
    }
    var padP = (maxP - minP) * 0.08;
    var lo = minP - padP, hi = maxP + padP;

    // Volume max
    var maxV = 0;
    for (var i = 0; i < n; i++) if (ohlcv[i].v > maxV) maxV = ohlcv[i].v;

    function yPrice(p) { return priceTop + priceH - ((p - lo) / (hi - lo)) * priceH; }
    function yVol(v)   { return volBot - (v / maxV) * volH; }

    // Grid + Y labels on price
    var gridY = '';
    for (var g = 0; g <= 4; g++) {
      var y = priceTop + (priceH * g / 4);
      var pv = hi - (hi - lo) * (g / 4);
      gridY += '<line x1="' + PAD.l + '" y1="' + y.toFixed(1) + '" x2="' + (W - PAD.r) + '" y2="' + y.toFixed(1) + '" stroke="var(--border)" stroke-width="1" stroke-dasharray="3,5"/>';
      gridY += '<text x="' + (W - PAD.r + 6) + '" y="' + (y + 3).toFixed(1) + '" font-size="10" fill="var(--text-soft)" font-family="JetBrains Mono, monospace">' + pv.toFixed(2) + '</text>';
    }
    // Volume label
    gridY += '<text x="' + (PAD.l + 2) + '" y="' + (volTop - 2).toFixed(1) + '" font-size="9.5" fill="var(--text-soft)" font-family="Inter, sans-serif" font-weight="600">Volume</text>';
    // Volume Y mark — max
    gridY += '<text x="' + (W - PAD.r + 6) + '" y="' + (volTop + 8).toFixed(1) + '" font-size="9" fill="var(--text-soft)" font-family="JetBrains Mono, monospace">' + (maxV * 1000).toFixed(0) + 'K</text>';
    gridY += '<text x="' + (W - PAD.r + 6) + '" y="' + (volBot - 1).toFixed(1) + '" font-size="9" fill="var(--text-soft)" font-family="JetBrains Mono, monospace">0</text>';

    // X-axis labels
    var gridX = '';
    var labelCount = Math.min(6, n);
    for (var x = 0; x < labelCount; x++) {
      var xi = Math.floor((n - 1) * x / (labelCount - 1));
      var xp = xAt(xi);
      var label;
      if (currentPeriod === '1D') {
        var hh = Math.floor(xi * 24 / (n - 1));
        label = (hh < 10 ? '0' + hh : hh) + ':00';
      } else if (currentPeriod === '1W') {
        var days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
        label = days[Math.floor(xi * 7 / n)];
      } else if (currentPeriod === '1M') {
        label = 'D' + (Math.floor(xi * 30 / n) + 1);
      } else {
        var mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        label = mo[Math.floor(xi * 12 / n)];
      }
      gridX += '<text x="' + xp.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10" fill="var(--text-soft)" font-family="JetBrains Mono, monospace">' + label + '</text>';
    }

    // Series — candles or area
    var seriesSvg = '';
    if (currentType === 'candle') {
      var candleW = Math.max(4, step * 0.62);
      for (var ci = 0; ci < n; ci++) {
        var c = ohlcv[ci];
        var up = c.c >= c.o;
        var color = up ? '#35c07f' : '#ff5b5b';
        var cx = xAt(ci);
        var yo = yPrice(c.o);
        var yc = yPrice(c.c);
        var yh = yPrice(c.h);
        var yl = yPrice(c.l);
        // Wick
        seriesSvg += '<line x1="' + cx.toFixed(1) + '" y1="' + yh.toFixed(1) + '" x2="' + cx.toFixed(1) + '" y2="' + yl.toFixed(1) + '" stroke="' + color + '" stroke-width="1.4"/>';
        // Body
        var bodyTop = Math.min(yo, yc);
        var bodyH = Math.max(1.5, Math.abs(yc - yo));
        seriesSvg += '<rect x="' + (cx - candleW/2).toFixed(1) + '" y="' + bodyTop.toFixed(1) + '" width="' + candleW.toFixed(1) + '" height="' + bodyH.toFixed(1) + '" fill="' + color + '" rx="0.5"/>';
      }
    } else {
      // Area chart on close prices
      var pts = ohlcv.map(function(c, i) { return [xAt(i), yPrice(c.c)]; });
      var dPath = pts.map(function(p, i) { return (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
      var areaD = dPath + ' L ' + pts[n-1][0].toFixed(1) + ' ' + priceBot.toFixed(1) + ' L ' + pts[0][0].toFixed(1) + ' ' + priceBot.toFixed(1) + ' Z';
      seriesSvg += '<defs><linearGradient id="dxaAreaGrad" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#35c07f" stop-opacity="0.32"/><stop offset="100%" stop-color="#35c07f" stop-opacity="0"/></linearGradient></defs>';
      seriesSvg += '<path d="' + areaD + '" fill="url(#dxaAreaGrad)"/>';
      seriesSvg += '<path d="' + dPath + '" fill="none" stroke="#35c07f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
      var last = pts[n-1];
      seriesSvg += '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="4" fill="#35c07f"/>';
    }

    // Volume bars
    var volSvg = '';
    for (var vi = 0; vi < n; vi++) {
      var cv = ohlcv[vi];
      var up = cv.c >= cv.o;
      var color = up ? 'rgba(52,210,122,0.5)' : 'rgba(255,91,91,0.5)';
      var cx2 = xAt(vi);
      var barW = Math.max(2, step * 0.55);
      var top = yVol(cv.v);
      var hbar = Math.max(1, volBot - top);
      volSvg += '<rect x="' + (cx2 - barW/2).toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + hbar.toFixed(1) + '" fill="' + color + '" rx="0.5"/>';
    }

    // Latest price label on right
    var lastC = ohlcv[n-1];
    var lastY = yPrice(lastC.c);
    var priceLabel = '<rect x="' + (W - PAD.r + 1) + '" y="' + (lastY - 9).toFixed(1) + '" width="58" height="18" rx="3" fill="#35c07f"/>' +
                     '<text x="' + (W - PAD.r + 30) + '" y="' + (lastY + 4).toFixed(1) + '" font-size="10.5" fill="#fff" font-weight="700" font-family="JetBrains Mono, monospace" text-anchor="middle">' + lastC.c.toFixed(4) + '</text>';

    // Save state for hover handler
    window._dxaChartState = { ohlcv: ohlcv, W: W, H: H, n: n, step: step, PAD: PAD, lo: lo, hi: hi, priceTop: priceTop, priceH: priceH, volTop: volTop, volBot: volBot, volH: volH, maxV: maxV };

    var hovHTML = '<div class="chart-hover-line" id="dxaHoverLine"></div>' +
                  '<div class="chart-hover-dot" id="dxaHoverDot"></div>' +
                  '<div class="chart-tip" id="dxaTip">' +
                    '<div class="tip-row"><span class="tip-label">O</span><span class="tip-val" id="dxaTipO">—</span></div>' +
                    '<div class="tip-row"><span class="tip-label">H</span><span class="tip-val" id="dxaTipH">—</span></div>' +
                    '<div class="tip-row"><span class="tip-label">L</span><span class="tip-val" id="dxaTipL">—</span></div>' +
                    '<div class="tip-row"><span class="tip-label">C</span><span class="tip-val" id="dxaTipC">—</span></div>' +
                    '<div class="tip-row"><span class="tip-label">V</span><span class="tip-val" id="dxaTipV">—</span></div>' +
                  '</div>';

    frame.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' + gridY + gridX + volSvg + seriesSvg + priceLabel + '</svg>' + hovHTML;
  }

  function attachDxaHover() {
    var box = document.getElementById('dxaChart');
    if (!box || box._dxaHovWired) return;
    box._dxaHovWired = true;
    function show(clientX) {
      var s = window._dxaChartState;
      if (!s) return;
      var rect = box.getBoundingClientRect();
      var rel = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      var i = Math.round(rel * (s.n - 1));
      var c = s.ohlcv[i];
      var x = s.PAD.l + i * s.step;
      var y = s.priceTop + s.priceH - ((c.c - s.lo) / (s.hi - s.lo)) * s.priceH;
      var xPct = (x / s.W) * 100;
      var yPct = (y / s.H) * 100;
      var line = box.querySelector('.chart-hover-line');
      var dot  = box.querySelector('.chart-hover-dot');
      var tip  = box.querySelector('.chart-tip');
      if (line) line.style.left = xPct + '%';
      if (dot)  { dot.style.left = xPct + '%'; dot.style.top = yPct + '%'; }
      if (tip)  {
        tip.style.left = xPct + '%';
        tip.style.top = yPct + '%';
        // Flip tip to left side when near right edge
        if (xPct > 70) { tip.classList.add('flip'); } else { tip.classList.remove('flip'); }
        var setT = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
        setT('dxaTipO', c.o.toFixed(4) + ' APT');
        setT('dxaTipH', c.h.toFixed(4) + ' APT');
        setT('dxaTipL', c.l.toFixed(4) + ' APT');
        setT('dxaTipC', c.c.toFixed(4) + ' APT');
        setT('dxaTipV', (c.v * 1000).toFixed(0) + 'K USDC');
      }
      box.classList.add('hovering');
    }
    function hide() { box.classList.remove('hovering'); }
    box.addEventListener('mouseenter', function(e) { show(e.clientX); });
    box.addEventListener('mousemove',  function(e) { show(e.clientX); });
    box.addEventListener('mouseleave', hide);
    box.addEventListener('touchstart', function(e) { var t = e.touches[0]; if (t) show(t.clientX); }, { passive: true });
    box.addEventListener('touchmove',  function(e) { var t = e.touches[0]; if (t) { show(t.clientX); e.preventDefault && e.preventDefault(); } }, { passive: false });
    box.addEventListener('touchend',   hide);
  }

  function attachDxaPanelHandlers() {
    var panel = document.getElementById('dxaPanel');
    if (!panel || panel._dxaPanelWired) return;
    panel._dxaPanelWired = true;
    panel.addEventListener('click', function(e) {
      var replyBtn = e.target.closest('.dxa-action-reply');
      if (replyBtn) {
        var row = replyBtn.closest('.dxa-disc-row');
        var box = row && row.querySelector('.dxa-disc-replies');
        if (box) {
          if (box.hasAttribute('hidden')) {
            box.removeAttribute('hidden');
            var ta = box.querySelector('textarea');
            if (ta) setTimeout(function() { ta.focus(); }, 30);
          } else {
            box.setAttribute('hidden', '');
          }
        }
        return;
      }
      var cancel = e.target.closest('.dxa-reply-cancel');
      if (cancel) {
        var box2 = cancel.closest('.dxa-disc-replies');
        if (box2) {
          var ta2 = box2.querySelector('textarea');
          if (ta2) ta2.value = '';
          box2.setAttribute('hidden', '');
        }
        return;
      }
      var post = e.target.closest('.dxa-reply-post');
      if (post) {
        var box3 = post.closest('.dxa-disc-replies');
        var ta3 = box3 && box3.querySelector('textarea');
        if (ta3 && ta3.value.trim()) {
          var row2 = post.closest('.dxa-disc-row');
          var list2 = box3.querySelector('.dxa-disc-reply-list');
          if (list2) {
            var youAddr = WALLETS[0];
            var newHTML = '<div class="dxa-reply-item dxa-reply-mine">' +
              '<div class="dxa-reply-av">' + makeIdenticon(youAddr, 26) + '</div>' +
              '<div class="dxa-reply-body">' +
                '<div class="dxa-reply-head"><span class="mono dxa-reply-addr">You · ' + shortAddr(youAddr) + '</span><span class="dxa-reply-time">just now</span></div>' +
                '<div class="dxa-reply-txt"></div>' +
              '</div>' +
            '</div>';
            list2.insertAdjacentHTML('beforeend', newHTML);
            // Set text safely (avoid XSS in this demo render)
            var added = list2.lastElementChild;
            if (added) added.querySelector('.dxa-reply-txt').textContent = ta3.value.trim();
            added && added.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
          ta3.value = '';
          var replyBtn2 = row2 && row2.querySelector('.dxa-action-reply');
          if (replyBtn2) {
            var m = replyBtn2.textContent.match(/(\d+)/);
            if (m) replyBtn2.innerHTML = '💬 ' + (parseInt(m[1], 10) + 1) + ' replies';
          }
        }
      }
    });
  }


  // ---------- Orderbook synth ----------
  function renderOrderbook() {
    var asks = document.getElementById('dxaObAsks');
    var bids = document.getElementById('dxaObBids');
    if (!asks || !bids) return;
    var midPrice = 4.227;
    var rows = 11;
    var maxAmt = 0;
    var askList = [], bidList = [];
    var r = seedRand(101);
    var cumA = 0, cumB = 0;
    for (var i = 0; i < rows; i++) {
      var aPx = midPrice + (i + 1) * 0.0015 + r() * 0.0008;
      var aAm = 800 + r() * 18000;
      cumA += aAm;
      askList.push({ px: aPx, am: aAm, sum: cumA });
      if (aAm > maxAmt) maxAmt = aAm;
      var bPx = midPrice - (i + 1) * 0.0015 - r() * 0.0008;
      var bAm = 800 + r() * 18000;
      cumB += bAm;
      bidList.push({ px: bPx, am: bAm, sum: cumB });
      if (bAm > maxAmt) maxAmt = bAm;
    }
    var maxCumA = cumA, maxCumB = cumB;
    askList.reverse();
    function fmtN(n) { return n.toLocaleString('en-US', { maximumFractionDigits: 2 }); }
    asks.innerHTML = askList.map(function(r) {
      var w = (r.sum / maxCumA * 100).toFixed(1);
      return '<div class="dxa-ob-row ask"><span class="px">' + r.px.toFixed(4) + '</span><span class="am">' + fmtN(r.am) + '</span><span class="sm">' + fmtN(r.sum) + '</span><span class="bar" style="width:' + w + '%"></span></div>';
    }).join('');
    bids.innerHTML = bidList.map(function(r) {
      var w = (r.sum / maxCumB * 100).toFixed(1);
      return '<div class="dxa-ob-row bid"><span class="px">' + r.px.toFixed(4) + '</span><span class="am">' + fmtN(r.am) + '</span><span class="sm">' + fmtN(r.sum) + '</span><span class="bar" style="width:' + w + '%"></span></div>';
    }).join('');
  }

  // ---------- Exchanges table + panel switching ----------
  var ANON_NAMES = ['Anon Trader', 'Whale 0x4E', 'MarketBot.aqua', 'AptosFox', 'BotAlpha', 'Beam9', 'Whale 0xC2', 'CryptoPanda', 'PathFinder', 'NightOwl', 'CometDAO'];
  var ANON_COLORS = ['#6f5ded','#ef4444','#22c55e','#a855f7','#06b6d4','#f59e0b','#ec4899','#84cc16'];

  // Aptos-style wallet addresses (G... 56 chars, but we show truncated)
  var WALLETS = [
    '0x0069235eb36c868c3d78cd3d5548446f56754c2fba27200323b7dabcd519665c',
    '0x0e7df72fdd89d8f1efb0f5993ff225eebf8ac4e02b94baadf0446b7cac4e17a1',
    '0x0429bdf9cb6877f85f36f2d8233bf7f2fb84f4156f47f8e03c8793918574e4f0',
    '0x046b991ae27c8e483476e53aeac5548c0f322d573771a22cb3143fea2a23c3a1',
    '0x0781ab3f7f366404002588633a7056d1337512398ccbf172e1bdecd51af0408a',
    '0x0fe2938407cf7ba849b792009ae895cb72e336819ffdf0b91e1fc0ab620fb752',
    '0x0c0bc311ce041b325628eda45b032e3a5a4e16432cbf2a54fa897e8d97559fbc',
    '0x028f189323f4a1df652f4993ef4c0bc182b5f79e3589780dbb28fde21b241f87',
    '0x01a0a8633b923e7b81726cd9bba602f26bf0661a54b4b6e5a2af69f111ea25bc',
    '0x0b26ee8f4642cd11d4148d3eddac8164b6b1bb59d6a38fda97ebdd293f4b55a7',
    '0x0775e4822fde2bfb322c2b9b806427be5d046b98ad4d4f8638d981264a124f6c',
    '0x0596176412fb3fac1d1cb195c161450c0573d50df16f263c2e71e5cf2d9e1cb7'
  ];

  function shortAddr(a) {
    if (!a) return '';
    return a.slice(0, 4) + '…' + a.slice(-4);
  }

  // Deterministic identicon: 4-color 2x2 SVG block with diagonal symmetry derived from address chars
  function makeIdenticon(addr, size) {
    if (!size) size = 28;
    var palette = ['#6f5ded','#ef4444','#22c55e','#a855f7','#06b6d4','#f59e0b','#ec4899','#84cc16','#ff894c','#0ea5e9','#14b8a6','#facc15'];
    // Hash the address
    var h = 0;
    for (var i = 0; i < addr.length; i++) { h = ((h << 5) - h) + addr.charCodeAt(i); h |= 0; }
    function pick(i) { return palette[Math.abs((h >> (i*3)) % palette.length)]; }
    var c1 = pick(0), c2 = pick(2), c3 = pick(4), c4 = pick(6);
    // 5x5 grid, mirrored on Y axis
    var cell = size / 5;
    var bg = '#0a0a0b';  // dark base
    var svg = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" style="border-radius:50%; background:' + c1 + ';" xmlns="http://www.w3.org/2000/svg">';
    // Generate a 3-column pattern (columns 0,1,2) and mirror to columns 4,3
    for (var y = 0; y < 5; y++) {
      for (var x = 0; x < 3; x++) {
        var bit = (h >> ((y * 3 + x) % 30)) & 1;
        if (bit) {
          var color = (x + y) % 2 === 0 ? c2 : c3;
          svg += '<rect x="' + (x * cell).toFixed(2) + '" y="' + (y * cell).toFixed(2) + '" width="' + cell.toFixed(2) + '" height="' + cell.toFixed(2) + '" fill="' + color + '"/>';
          if (x < 2) {
            svg += '<rect x="' + ((4 - x) * cell).toFixed(2) + '" y="' + (y * cell).toFixed(2) + '" width="' + cell.toFixed(2) + '" height="' + cell.toFixed(2) + '" fill="' + color + '"/>';
          }
        }
      }
    }
    // Center accent dot
    svg += '<circle cx="' + (size/2) + '" cy="' + (size/2) + '" r="' + (cell * 0.42).toFixed(2) + '" fill="' + c4 + '"/>';
    svg += '</svg>';
    return svg;
  }

  var currentTradeFilter = 0; // min APT size threshold

  function makeExchanges() {
    var rows = [];
    for (var i = 0; i < 15; i++) {
      var side = (i % 3 === 1) ? 'sell' : 'buy';
      var addr = WALLETS[i % WALLETS.length];
      // Vary amounts more dramatically so APT filters work meaningfully
      var amountUSDC;
      if (i < 3) amountUSDC = 18 + (i * 5);                 // tiny: ~75 APT total
      else if (i < 6) amountUSDC = 80 + (i * 17 % 60);      // small: ~340-590 APT
      else if (i < 10) amountUSDC = 480 + (i * 137 % 1900); // medium: ~2K-10K APT
      else amountUSDC = 4500 + (i * 211 % 18000);            // large: ~19K-95K APT
      var px = 4.227 + (i * 7 % 90 - 45) / 1000;
      rows.push({
        side: side,
        addr: addr,
        px: px,
        amount: amountUSDC,
        xlmSize: px * amountUSDC,
        time: i === 0 ? 'just now' : (i + 1 + 'm ago')
      });
    }
    // Apply filter
    return rows.filter(function(r) { return r.xlmSize >= currentTradeFilter; });
  }
  function fmtN(n) { return n.toLocaleString('en-US', { maximumFractionDigits: 4 }); }

  function renderExchanges() {
    var tbody = document.getElementById('dxaExTable');
    var infoEl = document.getElementById('dxaPanelInfo');
    if (!tbody) return;
    var rows = makeExchanges();
    if (infoEl) {
      var filterTxt = currentTradeFilter > 0 ? ' · ≥ ' + (currentTradeFilter >= 1000 ? (currentTradeFilter / 1000).toFixed(0) + 'K' : currentTradeFilter) + ' APT' : '';
      infoEl.textContent = 'Showing ' + rows.length + ' of 2,142 exchanges' + filterTxt;
    }
    tbody.innerHTML = rows.map(function(r) {
      return '<tr>' +
        '<td><div class="wallet-cell">' + makeIdenticon(r.addr, 26) + '<span class="mono wa">' + shortAddr(r.addr) + '</span></div></td>' +
        '<td><span class="type-badge ' + r.side + '">' + (r.side === 'buy' ? '▲ Buy' : '▼ Sell') + '</span></td>' +
        '<td><span class="mono">' + r.px.toFixed(4) + ' APT</span></td>' +
        '<td><span class="mono">' + fmtN(r.amount) + ' USDC</span></td>' +
        '<td><span class="time">' + r.time + '</span></td>' +
        '<td style="text-align:right"><button class="row-link" aria-label="View on explorer"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></button></td>' +
      '</tr>';
    }).join('');
  }

  function renderPanelTab(tab) {
    var panel = document.getElementById('dxaPanel');
    var title = document.getElementById('dxaPanelTitle');
    var info = document.getElementById('dxaPanelInfo');
    var filters = document.getElementById('dxaPanelFilters');
    if (!panel) return;

    var table = panel.querySelector('.ex-table');
    var foot = panel.querySelector('.panel-foot');
    var oldExtra = panel.querySelector('.dxa-tab-extra');
    if (oldExtra) oldExtra.remove();
    var oldEs = panel.querySelector('.dxa-empty-state');
    if (oldEs) oldEs.remove();

    if (tab === 'exchanges') {
      if (title) title.textContent = 'Recent Exchanges';
      if (info) info.textContent = 'Showing 9 of 2,142 exchanges';
      if (filters) filters.style.display = 'flex';
      if (table) table.style.display = '';
      if (foot) foot.style.display = '';
      renderExchanges();
      return;
    }

    // Other tabs hide the exchanges table + foot
    if (filters) filters.style.display = 'none';
    if (table) table.style.display = 'none';
    if (foot) foot.style.display = 'none';

    var html = '';
    if (tab === 'discussions') {
      if (title) title.textContent = 'Discussions';
      var DISC = [
        { addr: WALLETS[0], when: '2h ago', txt: 'USDC depth is finally getting reasonable — anyone routing big trades through Aptos lately? Curious how slippage holds up on $50K+ paths.', likes: 18, replies: 4, pin: true,
        replyList: [
          { addr: WALLETS[2], when: '1h ago', txt: 'Tested with a 75K USDC swap yesterday — slippage was under 0.18% across two AMM hops.' },
          { addr: WALLETS[5], when: '1h ago', txt: 'Same experience here. Orderbook fills are noticeably deeper than 3 months ago.' },
          { addr: WALLETS[4], when: '47m ago', txt: 'Watch out for off-hours though — depth thins after 02:00 UTC.' },
          { addr: WALLETS[7], when: '12m ago', txt: 'Path payments are the move. Anything beyond 25K should route automatically.' }
        ] },
        { addr: WALLETS[3], when: '5h ago', txt: 'I just bridged 12K USDC from Aptos to Aptos in under 8s. The cross-chain routing is honestly nuts. Anyone else stress-tested it?', likes: 12, replies: 3,
        replyList: [
          { addr: WALLETS[6], when: '4h ago', txt: 'I bridged 30K last week. Hit confirmation in 11s. Pretty impressive.' },
          { addr: WALLETS[1], when: '3h ago', txt: 'Curious about the fee structure on those cross-chain routes. Seems competitive.' },
          { addr: WALLETS[9], when: '2h ago', txt: 'Just be careful with the destination memo on Aptos side — easy to mess up.' }
        ] },
        { addr: WALLETS[5], when: '1d ago', txt: 'Volume is up 22% week-over-week. Wonder how much of that is the new LP rewards kicking in vs organic flow.', likes: 9, replies: 6,
        replyList: [
          { addr: WALLETS[11], when: '20h ago', txt: 'My guess is roughly 60/40 split — rewards are heavy this quarter.' },
          { addr: WALLETS[3], when: '18h ago', txt: 'Also helps that there are more market makers running on Aptos now.' },
          { addr: WALLETS[8], when: '15h ago', txt: 'Worth tracking how it holds after the incentive program ends.' },
          { addr: WALLETS[4], when: '12h ago', txt: 'Could go either way honestly. Hopefully organic by then.' },
          { addr: WALLETS[0], when: '8h ago', txt: 'Org volume seems to be growing month-over-month at ~12% even excluding rewards.' },
          { addr: WALLETS[7], when: '4h ago', txt: 'That\'s a healthy organic clip if true.' }
        ] },
        { addr: WALLETS[2], when: '2d ago', txt: 'PSA for new traders: always check the path payment route before confirming. Saved myself 0.4% on the last swap by picking the AMM leg over orderbook.', likes: 27, replies: 8,
        replyList: [
          { addr: WALLETS[10], when: '1d ago', txt: 'Solid PSA — saved me on a bigger trade last week.' },
          { addr: WALLETS[2], when: '1d ago', txt: 'How do you check which route the path will use ahead of time?' },
          { addr: WALLETS[5], when: '23h ago', txt: '@above: the "preview" tooltip on the swap button shows the hops + estimated slippage.' },
          { addr: WALLETS[1], when: '22h ago', txt: 'Underrated feature honestly. Wish more people knew about it.' },
          { addr: WALLETS[8], when: '14h ago', txt: 'For thin pairs, sometimes splitting the order into 2 chunks is even better.' },
          { addr: WALLETS[9], when: '10h ago', txt: 'Agree. Tried that on CELL — better fill on 2x 25K vs 1x 50K.' },
          { addr: WALLETS[3], when: '6h ago', txt: 'You can also set a max-slippage in advanced settings to auto-cancel bad routes.' },
          { addr: WALLETS[6], when: '4h ago', txt: 'Bookmarked. Thanks all.' }
        ] },
        { addr: WALLETS[7], when: '3d ago', txt: 'Is there a way to set price alerts on USDC pairs natively or do I need to use an external tool?', likes: 4, replies: 5,
        replyList: [
          { addr: WALLETS[4], when: '2d ago', txt: 'There\'s a basic alert tool in the watchlist section, but it only does percentage triggers.' },
          { addr: WALLETS[6], when: '2d ago', txt: 'Use Aptos Explorer or a TG bot for now — native alerts on the roadmap.' },
          { addr: WALLETS[9], when: '1d ago', txt: 'Roadmap mentions "smart alerts" for Q2 — could be promising.' },
          { addr: WALLETS[11], when: '20h ago', txt: 'I just use a TradingView alert pointed at a Aptos oracle. Janky but works.' },
          { addr: WALLETS[8], when: '12h ago', txt: 'TG bot is what I use — DM and I can share the link.' }
        ] }
      ];
      html = '<div class="dxa-tab-extra dxa-disc">';
      html += '<div class="dxa-disc-compose"><textarea placeholder="Share your thoughts about USDC… (connect wallet to post)" rows="2"></textarea><button class="dc-post">Post</button></div>';
      html += '<div class="dxa-disc-list">';
      DISC.forEach(function(d) {
        html += '<div class="dxa-disc-row">' +
          '<div class="dxa-disc-av">' + makeIdenticon(d.addr, 36) + '</div>' +
          '<div class="dxa-disc-body">' +
            '<div class="dxa-disc-head"><span class="mono dxa-disc-addr">' + shortAddr(d.addr) + '</span><span class="dxa-disc-time">' + d.when + '</span>' + (d.pin ? '<span class="dxa-pin">📌 Pinned</span>' : '') + '</div>' +
            '<div class="dxa-disc-txt">' + d.txt + '</div>' +
            '<div class="dxa-disc-actions"><button class="dxa-action-like">♥ ' + d.likes + '</button><button class="dxa-action-reply">💬 ' + d.replies + ' replies</button></div>' +
          '<div class="dxa-disc-replies" hidden>' +
            '<div class="dxa-disc-reply-list">' +
              (d.replyList || []).map(function(r) {
                return '<div class="dxa-reply-item">' +
                  '<div class="dxa-reply-av">' + makeIdenticon(r.addr, 26) + '</div>' +
                  '<div class="dxa-reply-body">' +
                    '<div class="dxa-reply-head"><span class="mono dxa-reply-addr">' + shortAddr(r.addr) + '</span><span class="dxa-reply-time">' + r.when + '</span></div>' +
                    '<div class="dxa-reply-txt">' + r.txt + '</div>' +
                  '</div>' +
                '</div>';
              }).join('') +
            '</div>' +
            '<div class="dxa-disc-reply-box">' +
              '<textarea placeholder="Reply to ' + shortAddr(d.addr) + '…" rows="2"></textarea>' +
              '<div class="dxa-reply-actions">' +
                '<button class="dxa-reply-cancel">Cancel</button>' +
                '<button class="dxa-reply-post">Reply</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '</div>' +
        '</div>';
      });
      html += '</div></div>';
    } else if (tab === 'holders') {
      if (title) title.textContent = 'Top Holders';
      // 50 rows of holders
      var totalSupply = 24500000;
      html = '<div class="dxa-tab-extra dxa-holders">';
      html += '<div class="dxa-hl-head"><div class="dxa-hl-stat"><span class="lbl">Holders</span><span class="val mono">12,408</span></div>' +
              '<div class="dxa-hl-stat"><span class="lbl">Top 10 hold</span><span class="val mono">38.4%</span></div>' +
              '<div class="dxa-hl-stat"><span class="lbl">Top 50 hold</span><span class="val mono">67.2%</span></div></div>';
      html += '<table class="ex-table dxa-hl-table"><thead><tr><th>#</th><th>Wallet</th><th>Balance</th><th>% supply</th><th style="text-align:right">Explorer</th></tr></thead><tbody>';
      function seedR(s) { var t = Math.sin(s * 11317 + 9931) * 233280; return t - Math.floor(t); }
      var cumPct = 0;
      for (var i = 0; i < 50; i++) {
        var addr = WALLETS[i % WALLETS.length].slice(0, 4) + (i % 9) + (i * 7 % 100) + 'X' + WALLETS[(i+3) % WALLETS.length].slice(-4);
        // Power-law distribution: top holders have much more
        var pct = i === 0 ? 12.8 : (i < 5 ? 4.5 - i * 0.6 : i < 10 ? 2.0 - (i-5) * 0.2 : i < 30 ? 0.8 - (i-10) * 0.025 : 0.18 - (i-30) * 0.003);
        if (pct < 0.01) pct = 0.01;
        cumPct += pct;
        var bal = (totalSupply * pct / 100);
        var actAgo = [1,3,7,12,18,24,38,52,76,98,142][i % 11];
        html += '<tr><td class="dxa-hl-rank">' + (i+1) + '</td>' +
          '<td><div class="wallet-cell">' + makeIdenticon(addr, 24) + '<span class="mono wa">' + shortAddr(addr) + '</span>' +  '</div></td>' +
          '<td class="mono">' + (bal >= 1000000 ? (bal/1000000).toFixed(2) + 'M' : bal >= 1000 ? (bal/1000).toFixed(1) + 'K' : bal.toFixed(0)) + '</td>' +
          '<td class="mono">' + pct.toFixed(3) + '%</td>' +
          '<td style="text-align:right"><a class="dxa-hl-explorer" href="#">View on Explorer <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg></a></td></tr>';
      }
      html += '</tbody></table>';
      html += '<div class="dxa-hl-pgn"><div class="info">Showing 1–50 of 12,408 holders · Cumulative ' + cumPct.toFixed(1) + '%</div><div class="pgn"><button class="active">1</button><button>2</button><button>3</button><button>…</button><button>249</button><button>Next ›</button></div></div>';
      html += '</div>';
    } else if (tab === 'pools') {
      if (title) title.textContent = 'AMM Pools';
      var POOLS = [
        { pair: 'USDC / APT', net: 'Aptos', tvl: '$4.85M', apr: '24.8%', vol: '$980K', share: '62.4%' },
        { pair: 'USDC / AMI', net: 'Aptos', tvl: '$1.42M', apr: '31.2%', vol: '$284K', share: '18.3%' },
        { pair: 'USDC / CELL', net: 'Aptos', tvl: '$612K', apr: '42.6%', vol: '$148K', share: '7.9%' },
        { pair: 'USDC / LUMOS', net: 'Aptos', tvl: '$418K', apr: '38.4%', vol: '$92K', share: '5.4%' },
        { pair: 'USDC / USDT', net: 'Aptos', tvl: '$224K', apr: '28.1%', vol: '$48K', share: '2.9%' },
        { pair: 'USDC / USDC', net: 'Aptos', tvl: '$184K', apr: '12.4%', vol: '$62K', share: '2.4%' },
        { pair: 'USDC / BTC', net: 'Aptos', tvl: '$48K', apr: '8.2%', vol: '$14K', share: '0.7%' }
      ];
      html = '<div class="dxa-tab-extra dxa-pools">';
      html += '<div class="dxa-pl-head"><div class="dxa-hl-stat"><span class="lbl">Active pools</span><span class="val mono">7</span></div>' +
              '<div class="dxa-hl-stat"><span class="lbl">Combined TVL</span><span class="val mono">$7.76M</span></div>' +
              '<div class="dxa-hl-stat"><span class="lbl">24h vol</span><span class="val mono">$1.63M</span></div>' +
              '<div class="dxa-hl-stat"><span class="lbl">Avg APR</span><span class="val mono">26.5%</span></div></div>';
      html += '<table class="ex-table"><thead><tr><th>Pool</th><th>TVL</th><th>APR</th><th>24h Volume</th><th>Pool share</th><th></th></tr></thead><tbody>';
      POOLS.forEach(function(p) {
        var aprNum = parseFloat(p.apr);
        var aprClass = aprNum >= 30 ? 'apr-hot' : aprNum >= 15 ? 'apr-mid' : 'apr-low';
        html += '<tr><td><div class="dxa-pl-pair">' +
          '<span class="dxa-pl-icos"><span class="dxa-pl-ico" style="background:linear-gradient(135deg,#2563eb,#1e40af);">$</span><span class="dxa-pl-ico" style="background:linear-gradient(135deg,#000,#1a1a1f);">★</span></span>' +
          '<span class="dxa-pl-name">' + p.pair + '</span></div></td>' +
          '<td class="mono">' + p.tvl + '</td>' +
          '<td><span class="dxa-pl-apr ' + aprClass + '">' + p.apr + '</span></td>' +
          '<td class="mono">' + p.vol + '</td>' +
          '<td class="mono">' + p.share + '</td>' +
          '<td style="text-align:right;"><a class="dxa-pl-cta" href="/pools">Add liquidity →</a></td></tr>';
      });
      html += '</tbody></table></div>';
    }
    panel.insertAdjacentHTML('beforeend', html);
  }

  // ---------- Wire everything ----------
  ready(function() {
    renderChart();
    attachDxaHover();
    attachDxaPanelHandlers();
    renderOrderbook();
    renderPanelTab('exchanges');

    // Chart tools (area/candle)
    document.querySelectorAll('.chart-tools button').forEach(function(b) {
      b.addEventListener('click', function() {
        document.querySelectorAll('.chart-tools button').forEach(function(o) { o.classList.toggle('active', o === b); });
        currentType = b.dataset.type || 'area';
        renderChart();
      });
    });
    // Timeframes
    document.querySelectorAll('.timeframes button').forEach(function(b) {
      b.addEventListener('click', function() {
        document.querySelectorAll('.timeframes button').forEach(function(o) { o.classList.toggle('active', o === b); });
        currentPeriod = b.dataset.period || '1D';
        renderChart();
      });
    });
    // Trade tabs
    document.querySelectorAll('.dxa-trade-tab').forEach(function(b) {
      b.addEventListener('click', function() {
        document.querySelectorAll('.dxa-trade-tab').forEach(function(o) { o.classList.toggle('active', o === b); });
        var pane = b.dataset.pane;
        document.querySelectorAll('.dxa-pane').forEach(function(p) { p.classList.toggle('active', p.dataset.pane === pane); });
      });
    });
    // Side toggle (buy/sell)
    document.querySelectorAll('.dxa-side-toggle').forEach(function(group) {
      var btns = group.querySelectorAll('.dxa-side-btn');
      btns.forEach(function(b) {
        b.addEventListener('click', function() {
          btns.forEach(function(o) { o.classList.toggle('active', o === b); });
          var pane = group.closest('.dxa-pane');
          if (pane) {
            var cta = pane.querySelector('.dxa-trade-cta');
            if (cta) {
              var isBuy = b.classList.contains('buy');
              cta.textContent = (isBuy ? 'Place Buy Order' : 'Place Sell Order');
              cta.style.background = isBuy ? 'var(--green)' : 'var(--red)';
              cta.style.borderColor = isBuy ? 'var(--green)' : 'var(--red)';
              cta.style.boxShadow = isBuy ? '0 6px 18px rgba(52,210,122,0.30)' : '0 6px 18px rgba(255,91,91,0.30)';
            }
          }
        });
      });
    });
    // Bottom panel tabs
    document.querySelectorAll('.tabs-bar .tab').forEach(function(b) {
      b.addEventListener('click', function() {
        document.querySelectorAll('.tabs-bar .tab').forEach(function(o) { o.classList.toggle('active', o === b); });
        renderPanelTab(b.dataset.tab);
      });
    });
    // CTA toast
    document.querySelectorAll('.dxa-trade-cta').forEach(function(b) {
      b.addEventListener('click', function() {
        if (window.showToast) window.showToast(b.textContent.trim() + ' submitted');
      });
    });
    // Flip
    document.querySelectorAll('.dxa-trade-flip').forEach(function(b) {
      b.addEventListener('click', function() {
        var pane = b.closest('.dxa-pane');
        if (!pane) return;
        var fields = pane.querySelectorAll('.dxa-trade-field');
        if (fields.length < 2) return;
        var inputs = [fields[0].querySelector('input'), fields[1].querySelector('input')];
        var tmp = inputs[0].value; inputs[0].value = inputs[1].value; inputs[1].value = tmp;
      });
    });
    // Panel filter chips (visual)
    document.querySelectorAll('.panel-head .filters .chip').forEach(function(c) {
      c.addEventListener('click', function() {
        document.querySelectorAll('.panel-head .filters .chip').forEach(function(o) { o.classList.toggle('active', o === c); });
        var minXlm = parseFloat(c.getAttribute('data-min-xlm')) || 0;
        currentTradeFilter = minXlm;
        renderExchanges();
      });
    });
    // Reaction buttons — bump count on click
    document.querySelectorAll('.dxa-react-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (btn.dataset.tapped) return;
        btn.dataset.tapped = '1';
        var numEl = btn.querySelector('.num');
        if (!numEl) return;
        var t = numEl.textContent.trim();
        var n;
        if (t.indexOf('K') >= 0) n = Math.round(parseFloat(t) * 1000);
        else n = parseInt(t.replace(/,/g, ''), 10) || 0;
        n = n + 1;
        numEl.textContent = n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toLocaleString();
        btn.style.borderColor = 'var(--accent)';
        btn.style.background = 'var(--accent-pale)';
      });
    });
  });

})();
