
// ============================================================
// MOBILE DEX ASSET PAGE WIRING
// ============================================================
(function() {
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  function seedRand(seed) { var s = seed; return function() { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
  var PRICE_RANGES = {
    '1D': { points: 20, trend: 0.6, base: 4.55, swing: 0.10 },
    '1W': { points: 21, trend: 0.4, base: 4.35, swing: 0.15 },
    '1M': { points: 30, trend: 0.7, base: 3.90, swing: 0.25 },
    '1Y': { points: 36, trend: 1.6, base: 2.80, swing: 0.55 }
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
    var frame = document.getElementById('mdxaChart');
    if (!frame) return;

    var prices = genSeries(currentPeriod, 22);
    var W = 400, H = 220;
    var PAD = { l: 4, r: 44, t: 10, b: 18 };

    var totalH = H - PAD.t - PAD.b;
    var priceH = totalH * 0.66;
    var gap    = totalH * 0.06;
    var volH   = totalH * 0.28;
    var priceTop = PAD.t;
    var priceBot = priceTop + priceH;
    var volTop   = priceBot + gap;
    var volBot   = volTop + volH;

    var pw = W - PAD.l - PAD.r;
    var n = prices.length;
    var step = pw / (n - 1);
    function xAt(i) { return PAD.l + i * step; }

    function pseudo(seed) { var s = Math.sin(seed * 9301 + 49297) * 233280; return s - Math.floor(s); }
    var ohlcv = [];
    for (var i = 0; i < n; i++) {
      var p = prices[i];
      var prev = i > 0 ? prices[i-1] : p * (0.996 + pseudo(i+71) * 0.004);
      var diff = p - prev;
      var baseRange = Math.abs(diff) * 1.6 + p * 0.014;
      var openShift = (pseudo(i*3+11) - 0.5) * baseRange * 0.6;
      var open = prev + diff * 0.25 + openShift;
      var close = p;
      var top = Math.max(open, close);
      var bot = Math.min(open, close);
      var hExt = baseRange * (0.35 + pseudo(i*7+5) * 0.45);
      var lExt = baseRange * (0.35 + pseudo(i*5+19) * 0.45);
      var high = top + hExt;
      var low  = bot - lExt;
      var v = 0.35 + (Math.abs(diff) / Math.max(0.0001, p * 0.012)) * 0.55 + pseudo(i+200) * 0.45;
      ohlcv.push({ o: open, h: high, l: low, c: close, v: v });
    }

    var minP = ohlcv[0].l, maxP = ohlcv[0].h;
    for (var i = 1; i < n; i++) {
      if (ohlcv[i].l < minP) minP = ohlcv[i].l;
      if (ohlcv[i].h > maxP) maxP = ohlcv[i].h;
    }
    var padP = (maxP - minP) * 0.08;
    var lo = minP - padP, hi = maxP + padP;

    var maxV = 0;
    for (var i = 0; i < n; i++) if (ohlcv[i].v > maxV) maxV = ohlcv[i].v;

    function yPrice(p) { return priceTop + priceH - ((p - lo) / (hi - lo)) * priceH; }
    function yVol(v)   { return volBot - (v / maxV) * volH; }

    var gridY = '';
    for (var g = 0; g <= 3; g++) {
      var y = priceTop + (priceH * g / 3);
      var pv = hi - (hi - lo) * (g / 3);
      gridY += '<line x1="' + PAD.l + '" y1="' + y.toFixed(1) + '" x2="' + (W - PAD.r) + '" y2="' + y.toFixed(1) + '" stroke="var(--border)" stroke-width="0.6" stroke-dasharray="2,3"/>';
      gridY += '<text x="' + (W - PAD.r + 4) + '" y="' + (y + 3).toFixed(1) + '" font-size="8" fill="var(--text-soft)" font-family="JetBrains Mono, monospace">' + pv.toFixed(2) + '</text>';
    }
    // Vol divider + label
    gridY += '<text x="' + (PAD.l + 2) + '" y="' + (volTop - 1).toFixed(1) + '" font-size="8" fill="var(--text-soft)" font-family="Inter, sans-serif" font-weight="600">Vol</text>';
    gridY += '<text x="' + (W - PAD.r + 4) + '" y="' + (volTop + 7).toFixed(1) + '" font-size="7.5" fill="var(--text-soft)" font-family="JetBrains Mono, monospace">' + (maxV * 1000).toFixed(0) + 'K</text>';

    // X-axis labels — fewer on mobile
    var gridX = '';
    var labelCount = Math.min(4, n);
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
      gridX += '<text x="' + xp.toFixed(1) + '" y="' + (H - 5) + '" text-anchor="middle" font-size="8" fill="var(--text-soft)" font-family="JetBrains Mono, monospace">' + label + '</text>';
    }

    var seriesSvg = '';
    if (currentType === 'candle') {
      var candleW = Math.max(2.5, step * 0.62);
      for (var ci = 0; ci < n; ci++) {
        var c = ohlcv[ci];
        var up = c.c >= c.o;
        var color = up ? '#35c07f' : '#ff5b5b';
        var cx = xAt(ci);
        var yo = yPrice(c.o), yc = yPrice(c.c), yh = yPrice(c.h), yl = yPrice(c.l);
        seriesSvg += '<line x1="' + cx.toFixed(1) + '" y1="' + yh.toFixed(1) + '" x2="' + cx.toFixed(1) + '" y2="' + yl.toFixed(1) + '" stroke="' + color + '" stroke-width="1"/>';
        var bodyTop = Math.min(yo, yc);
        var bodyH = Math.max(1.2, Math.abs(yc - yo));
        seriesSvg += '<rect x="' + (cx - candleW/2).toFixed(1) + '" y="' + bodyTop.toFixed(1) + '" width="' + candleW.toFixed(1) + '" height="' + bodyH.toFixed(1) + '" fill="' + color + '" rx="0.5"/>';
      }
    } else {
      var pts = ohlcv.map(function(c, i) { return [xAt(i), yPrice(c.c)]; });
      var dPath = pts.map(function(p, i) { return (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
      var areaD = dPath + ' L ' + pts[n-1][0].toFixed(1) + ' ' + priceBot.toFixed(1) + ' L ' + pts[0][0].toFixed(1) + ' ' + priceBot.toFixed(1) + ' Z';
      seriesSvg += '<defs><linearGradient id="mdxaAreaGrad" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#35c07f" stop-opacity="0.30"/><stop offset="100%" stop-color="#35c07f" stop-opacity="0"/></linearGradient></defs>';
      seriesSvg += '<path d="' + areaD + '" fill="url(#mdxaAreaGrad)"/>';
      seriesSvg += '<path d="' + dPath + '" fill="none" stroke="#35c07f" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>';
      var last = pts[n-1];
      seriesSvg += '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="3" fill="#35c07f"/>';
    }

    var volSvg = '';
    for (var vi = 0; vi < n; vi++) {
      var cv = ohlcv[vi];
      var up = cv.c >= cv.o;
      var color = up ? 'rgba(52,210,122,0.5)' : 'rgba(255,91,91,0.5)';
      var cx2 = xAt(vi);
      var barW = Math.max(1.4, step * 0.55);
      var top = yVol(cv.v);
      var hbar = Math.max(0.8, volBot - top);
      volSvg += '<rect x="' + (cx2 - barW/2).toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + hbar.toFixed(1) + '" fill="' + color + '"/>';
    }

    var lastC = ohlcv[n-1];
    var lastY = yPrice(lastC.c);
    var priceLabel = '<rect x="' + (W - PAD.r + 1) + '" y="' + (lastY - 7).toFixed(1) + '" width="42" height="14" rx="2.5" fill="#35c07f"/>' +
                     '<text x="' + (W - PAD.r + 22) + '" y="' + (lastY + 3).toFixed(1) + '" font-size="8.5" fill="#fff" font-weight="700" font-family="JetBrains Mono, monospace" text-anchor="middle">' + lastC.c.toFixed(4) + '</text>';

    window._mdxaChartState = { ohlcv: ohlcv, W: W, H: H, n: n, step: step, PAD: PAD, lo: lo, hi: hi, priceTop: priceTop, priceH: priceH };

    var hovHTML = '<div class="chart-hover-line"></div>' +
                  '<div class="chart-hover-dot"></div>' +
                  '<div class="chart-tip">' +
                    '<div class="tip-row"><span class="tip-label">O</span><span class="tip-val" id="mdxaTipO">—</span></div>' +
                    '<div class="tip-row"><span class="tip-label">H</span><span class="tip-val" id="mdxaTipH">—</span></div>' +
                    '<div class="tip-row"><span class="tip-label">L</span><span class="tip-val" id="mdxaTipL">—</span></div>' +
                    '<div class="tip-row"><span class="tip-label">C</span><span class="tip-val" id="mdxaTipC">—</span></div>' +
                    '<div class="tip-row"><span class="tip-label">V</span><span class="tip-val" id="mdxaTipV">—</span></div>' +
                  '</div>';

    frame.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' + gridY + gridX + volSvg + seriesSvg + priceLabel + '</svg>' + hovHTML;
  }

  function attachMdxaHover() {
    var box = document.getElementById('mdxaChart');
    if (!box || box._mdxaHovWired) return;
    box._mdxaHovWired = true;
    function show(clientX) {
      var s = window._mdxaChartState;
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
        if (xPct > 55) { tip.classList.add('flip'); } else { tip.classList.remove('flip'); }
        var setT = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
        setT('mdxaTipO', c.o.toFixed(4) + ' XLM');
        setT('mdxaTipH', c.h.toFixed(4) + ' XLM');
        setT('mdxaTipL', c.l.toFixed(4) + ' XLM');
        setT('mdxaTipC', c.c.toFixed(4) + ' XLM');
        setT('mdxaTipV', (c.v * 1000).toFixed(0) + 'K USDC');
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

  function attachMdxaPanelHandlers() {
    var panel = document.getElementById('mdxaPanel');
    if (!panel || panel._mdxaPanelWired) return;
    panel._mdxaPanelWired = true;
    panel.addEventListener('click', function(e) {
      var replyBtn = e.target.closest('.mdxa-action-reply');
      if (replyBtn) {
        var row = replyBtn.closest('.mdxa-disc-row');
        var box = row && row.querySelector('.mdxa-disc-replies');
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
      var cancel = e.target.closest('.mdxa-reply-cancel');
      if (cancel) {
        var box2 = cancel.closest('.mdxa-disc-replies');
        if (box2) {
          var ta2 = box2.querySelector('textarea');
          if (ta2) ta2.value = '';
          box2.setAttribute('hidden', '');
        }
        return;
      }
      var post = e.target.closest('.mdxa-reply-post');
      if (post) {
        var box3 = post.closest('.mdxa-disc-replies');
        var ta3 = box3 && box3.querySelector('textarea');
        if (ta3 && ta3.value.trim()) {
          var row2 = post.closest('.mdxa-disc-row');
          var list2 = box3.querySelector('.mdxa-disc-reply-list');
          if (list2) {
            var youAddr = WALLETS[0];
            var newHTML = '<div class="mdxa-reply-item mdxa-reply-mine">' +
              '<div class="mdxa-reply-av">' + makeIdenticon(youAddr, 22) + '</div>' +
              '<div class="mdxa-reply-body">' +
                '<div class="mdxa-reply-head"><span class="mono mdxa-reply-addr">You · ' + shortAddr(youAddr) + '</span><span class="mdxa-reply-time">just now</span></div>' +
                '<div class="mdxa-reply-txt"></div>' +
              '</div>' +
            '</div>';
            list2.insertAdjacentHTML('beforeend', newHTML);
            var added = list2.lastElementChild;
            if (added) added.querySelector('.mdxa-reply-txt').textContent = ta3.value.trim();
            added && added.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
          ta3.value = '';
          var replyBtn2 = row2 && row2.querySelector('.mdxa-action-reply');
          if (replyBtn2) {
            var m = replyBtn2.textContent.match(/(\d+)/);
            if (m) replyBtn2.innerHTML = '💬 ' + (parseInt(m[1], 10) + 1);
          }
        }
      }
    });
  }



  function renderOrderbook() {
    var asks = document.getElementById('mdxaObAsks');
    var bids = document.getElementById('mdxaObBids');
    if (!asks || !bids) return;
    var midPrice = 4.227;
    var rows = 9;
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
      return '<div class="mdxa-ob-row ask"><span class="px">' + r.px.toFixed(4) + '</span><span class="am">' + fmtN(r.am) + '</span><span class="sm">' + fmtN(r.sum) + '</span><span class="bar" style="width:' + w + '%"></span></div>';
    }).join('');
    bids.innerHTML = bidList.map(function(r) {
      var w = (r.sum / maxCumB * 100).toFixed(1);
      return '<div class="mdxa-ob-row bid"><span class="px">' + r.px.toFixed(4) + '</span><span class="am">' + fmtN(r.am) + '</span><span class="sm">' + fmtN(r.sum) + '</span><span class="bar" style="width:' + w + '%"></span></div>';
    }).join('');
  }

  // ---------- Bottom panel tabs ----------
  var ANON_NAMES = ['Anon Trader', 'Whale 0x4E', 'MarketBot.aqua', 'AptosFox', 'BotAlpha', 'Beam9', 'Whale 0xC2', 'CryptoPanda', 'PathFinder', 'NightOwl', 'CometDAO'];
  var ANON_COLORS = ['#6f5ded','#ef4444','#22c55e','#a855f7','#06b6d4','#f59e0b','#ec4899','#84cc16'];

  var WALLETS = [
    '0x0f421d1a6531b41468e403dcc29a70cfc52eef44014529931675d68743d03ce6',
    '0x060cfeb16f166f6ce55992ba3f6d1e47d1956ead151dacdae7efd85759bbcfb4',
    '0x04c71eef8ec6924db103d1ffd867d37185f9f46b9628f695ac9718806c08e0eb',
    '0x06c6e914f31f95465be43d5108573f50632a0795f6b215ac791862dc084ee007',
    '0x08fc140816d9baa5cd360eb5910dacdeefa6e157d2cb9226577a775c87c1aa80',
    '0x048f9b6d2f1c7413e45a19c700b0f4335e690a51e91b7c325f51a919d301c871',
    '0x00dac5221da6603ff59d8ab28b63fc5bd56f140eeab2c02e7569f329ae0d8c99',
    '0x06f48aa3e6aa0316d9719ef587ca13ea6b7ffbf02776a3976e89efd1f4994475',
    '0x0052ad255bc487aade4e4a1b356827c235f4bb7e094f86d8cb419b01a9f204e2',
    '0x09d898286efcd0ec49b4f61f75b1b66981710d0a4ade46dc5470325db08502e9',
    '0x09b44fbaa4bd14bad317174ba5911248752b7ae17c6bab4e222dd6a9ff5b9c59',
    '0x059442a218ebb214eb95c6977fd42cec23b105ffc780ce9c35471119b62a7c1a'
  ];
  function shortAddr(a) { if (!a) return ''; return a.slice(0, 4) + '…' + a.slice(-4); }
  function makeIdenticon(addr, size) {
    if (!size) size = 24;
    var palette = ['#6f5ded','#ef4444','#22c55e','#a855f7','#06b6d4','#f59e0b','#ec4899','#84cc16','#ff894c','#0ea5e9','#14b8a6','#facc15'];
    var h = 0;
    for (var i = 0; i < addr.length; i++) { h = ((h << 5) - h) + addr.charCodeAt(i); h |= 0; }
    function pick(i) { return palette[Math.abs((h >> (i*3)) % palette.length)]; }
    var c1 = pick(0), c2 = pick(2), c3 = pick(4), c4 = pick(6);
    var cell = size / 5;
    var svg = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" style="border-radius:50%; background:' + c1 + ';" xmlns="http://www.w3.org/2000/svg">';
    for (var y = 0; y < 5; y++) {
      for (var x = 0; x < 3; x++) {
        var bit = (h >> ((y * 3 + x) % 30)) & 1;
        if (bit) {
          var color = (x + y) % 2 === 0 ? c2 : c3;
          svg += '<rect x="' + (x * cell).toFixed(2) + '" y="' + (y * cell).toFixed(2) + '" width="' + cell.toFixed(2) + '" height="' + cell.toFixed(2) + '" fill="' + color + '"/>';
          if (x < 2) svg += '<rect x="' + ((4 - x) * cell).toFixed(2) + '" y="' + (y * cell).toFixed(2) + '" width="' + cell.toFixed(2) + '" height="' + cell.toFixed(2) + '" fill="' + color + '"/>';
        }
      }
    }
    svg += '<circle cx="' + (size/2) + '" cy="' + (size/2) + '" r="' + (cell * 0.42).toFixed(2) + '" fill="' + c4 + '"/></svg>';
    return svg;
  }
  function fmtN(n) { return n.toLocaleString('en-US', { maximumFractionDigits: 2 }); }

  var currentTradeFilter = 0; // mobile filter threshold (APT size)

  function renderExchanges() {
    var list = document.getElementById('mdxaExList');
    if (!list) return;
    var allRows = [];
    for (var i = 0; i < 15; i++) {
      var side = (i % 3 === 1) ? 'sell' : 'buy';
      var addr = WALLETS[i % WALLETS.length];
      var amountUSDC;
      if (i < 3) amountUSDC = 18 + (i * 5);
      else if (i < 6) amountUSDC = 80 + (i * 17 % 60);
      else if (i < 10) amountUSDC = 480 + (i * 137 % 1900);
      else amountUSDC = 4500 + (i * 211 % 18000);
      var px = 4.227 + (i * 7 % 90 - 45) / 1000;
      allRows.push({
        side: side, addr: addr, px: px, amount: amountUSDC,
        xlmSize: px * amountUSDC,
        time: i === 0 ? 'just now' : (i + 1 + 'm')
      });
    }
    var filtered = allRows.filter(function(r) { return r.xlmSize >= currentTradeFilter; });
    var rows = '';
    filtered.forEach(function(r) {
      rows += '<div class="ex-row">' +
        '<span class="ex-ident">' + makeIdenticon(r.addr, 28) + '</span>' +
        '<div class="ex-meta">' +
          '<div class="nm mono">' + shortAddr(r.addr) + '</div>' +
          '<div class="ex-sub"><span class="type-badge ' + r.side + '">' + (r.side === 'buy' ? '▲ Buy' : '▼ Sell') + '</span></div>' +
        '</div>' +
        '<div class="ex-num">' + r.px.toFixed(4) + ' APT<span class="sub">' + fmtN(r.amount) + ' USDC</span></div>' +
        '<div class="ex-time">' + r.time + '</div>' +
      '</div>';
    });
    list.innerHTML = rows;
  }

  function renderPanelTab(tab) {
    var panel = document.getElementById('mdxaPanel');
    var title = document.getElementById('mdxaPanelTitle');
    var filters = document.getElementById('mdxaPanelFilters');
    if (!panel) return;
    var list = document.getElementById('mdxaExList');
    var es = panel.querySelector('.mdxa-empty-state');
    if (es) es.remove();
    var oldExtra = panel.querySelector('.mdxa-tab-extra');
    if (oldExtra) oldExtra.remove();

    if (tab === 'exchanges') {
      if (title) title.textContent = 'Recent Exchanges';
      if (filters) filters.style.display = 'flex';
      if (list) list.style.display = '';
      renderExchanges();
      return;
    }

    if (filters) filters.style.display = 'none';
    if (list) list.style.display = 'none';

    var html = '';
    if (tab === 'discussions') {
      if (title) title.textContent = 'Discussions';
      var DISC = [
        { addr: WALLETS[0], when: '2h', txt: 'USDC depth is finally getting reasonable — anyone routing big trades through Aptos lately?', likes: 18, replies: 4, pin: true,
        replyList: [
          { addr: WALLETS[2], when: '1h', txt: 'Tested a 75K swap yesterday — slippage under 0.18%.' },
          { addr: WALLETS[5], when: '1h', txt: 'Same. Fills deeper than 3 months ago.' },
          { addr: WALLETS[4], when: '47m', txt: 'Watch off-hours though — thins after 02 UTC.' },
          { addr: WALLETS[7], when: '12m', txt: 'Path payments are the move.' }
        ] },
        { addr: WALLETS[3], when: '5h', txt: 'Just bridged 12K USDC from Aptos to Aptos in under 8s. Cross-chain routing is nuts.', likes: 12, replies: 3,
        replyList: [
          { addr: WALLETS[6], when: '4h', txt: 'Bridged 30K last week. 11s confirm.' },
          { addr: WALLETS[1], when: '3h', txt: 'Cross-chain fees seem competitive.' },
          { addr: WALLETS[9], when: '2h', txt: 'Be careful with destination memo on Aptos.' }
        ] },
        { addr: WALLETS[5], when: '1d', txt: 'Volume up 22% week-over-week. Wonder how much is new LP rewards vs organic flow.', likes: 9, replies: 6,
        replyList: [
          { addr: WALLETS[11], when: '20h', txt: 'Guess: 60/40 split, rewards-heavy quarter.' },
          { addr: WALLETS[3], when: '18h', txt: 'More market makers on Aptos now too.' },
          { addr: WALLETS[8], when: '15h', txt: 'Track post-incentive period.' },
          { addr: WALLETS[4], when: '12h', txt: 'Could go either way.' },
          { addr: WALLETS[0], when: '8h', txt: 'Organic ~12% MoM ex-rewards apparently.' },
          { addr: WALLETS[7], when: '4h', txt: 'Healthy clip.' }
        ] },
        { addr: WALLETS[2], when: '2d', txt: 'Always check the path payment route before confirming — saved 0.4% on the last swap.', likes: 27, replies: 8,
        replyList: [
          { addr: WALLETS[10], when: '1d', txt: 'Solid PSA — saved me last week.' },
          { addr: WALLETS[2], when: '1d', txt: 'How to preview path beforehand?' },
          { addr: WALLETS[5], when: '23h', txt: 'Swap button has a preview tooltip.' },
          { addr: WALLETS[1], when: '22h', txt: 'Underrated feature.' },
          { addr: WALLETS[8], when: '14h', txt: 'Splitting orders helps thin pairs.' },
          { addr: WALLETS[9], when: '10h', txt: '2x25K beat 1x50K on CELL.' },
          { addr: WALLETS[3], when: '6h', txt: 'Set max-slippage in advanced settings.' },
          { addr: WALLETS[6], when: '4h', txt: 'Bookmarked, thanks.' }
        ] },
        { addr: WALLETS[7], when: '3d', txt: 'Is there a way to set native price alerts on USDC pairs?', likes: 4, replies: 5,
        replyList: [
          { addr: WALLETS[4], when: '2d', txt: 'Watchlist has basic % alerts only.' },
          { addr: WALLETS[6], when: '2d', txt: 'Use Aptos Explorer or TG bot for now.' },
          { addr: WALLETS[9], when: '1d', txt: 'Native smart alerts on Q2 roadmap.' },
          { addr: WALLETS[11], when: '20h', txt: 'TradingView alert via oracle works.' },
          { addr: WALLETS[8], when: '12h', txt: 'TG bot — DM for link.' }
        ] }
      ];
      html = '<div class="mdxa-tab-extra mdxa-disc">';
      html += '<div class="mdxa-disc-compose"><textarea placeholder="Share your thoughts… (connect wallet to post)" rows="2"></textarea><button class="dc-post">Post</button></div>';
      html += '<div class="mdxa-disc-list">';
      DISC.forEach(function(d) {
        html += '<div class="mdxa-disc-row">' +
          '<div class="mdxa-disc-av">' + makeIdenticon(d.addr, 30) + '</div>' +
          '<div class="mdxa-disc-body">' +
            '<div class="mdxa-disc-head"><span class="mono mdxa-disc-addr">' + shortAddr(d.addr) + '</span><span class="mdxa-disc-time">' + d.when + '</span>' + (d.pin ? '<span class="mdxa-pin">📌</span>' : '') + '</div>' +
            '<div class="mdxa-disc-txt">' + d.txt + '</div>' +
            '<div class="mdxa-disc-actions"><button class="mdxa-action-like">♥ ' + d.likes + '</button><button class="mdxa-action-reply">💬 ' + d.replies + '</button></div>' +
          '<div class="mdxa-disc-replies" hidden>' +
            '<div class="mdxa-disc-reply-list">' +
              (d.replyList || []).map(function(r) {
                return '<div class="mdxa-reply-item">' +
                  '<div class="mdxa-reply-av">' + makeIdenticon(r.addr, 22) + '</div>' +
                  '<div class="mdxa-reply-body">' +
                    '<div class="mdxa-reply-head"><span class="mono mdxa-reply-addr">' + shortAddr(r.addr) + '</span><span class="mdxa-reply-time">' + r.when + '</span></div>' +
                    '<div class="mdxa-reply-txt">' + r.txt + '</div>' +
                  '</div>' +
                '</div>';
              }).join('') +
            '</div>' +
            '<div class="mdxa-disc-reply-box">' +
              '<textarea placeholder="Reply to ' + shortAddr(d.addr) + '…" rows="2"></textarea>' +
              '<div class="mdxa-reply-actions">' +
                '<button class="mdxa-reply-cancel">Cancel</button>' +
                '<button class="mdxa-reply-post">Reply</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '</div>' +
        '</div>';
      });
      html += '</div></div>';
    } else if (tab === 'holders') {
      if (title) title.textContent = 'Top Holders';
      html = '<div class="mdxa-tab-extra mdxa-holders">';
      html += '<div class="mdxa-hl-head">' +
              '<div class="mdxa-hl-stat"><span class="lbl">Holders</span><span class="val mono">12,408</span></div>' +
              '<div class="mdxa-hl-stat"><span class="lbl">Top 10</span><span class="val mono">38.4%</span></div>' +
              '<div class="mdxa-hl-stat"><span class="lbl">Top 50</span><span class="val mono">67.2%</span></div></div>';
      html += '<div class="mdxa-hl-list">';
      function seedR(s) { var t = Math.sin(s * 11317 + 9931) * 233280; return t - Math.floor(t); }
      var totalSupply = 24500000;
      var cumPct = 0;
      for (var i = 0; i < 50; i++) {
        var addr = WALLETS[i % WALLETS.length].slice(0, 4) + (i % 9) + (i * 7 % 100) + 'X' + WALLETS[(i+3) % WALLETS.length].slice(-4);
        var pct = i === 0 ? 12.8 : (i < 5 ? 4.5 - i * 0.6 : i < 10 ? 2.0 - (i-5) * 0.2 : i < 30 ? 0.8 - (i-10) * 0.025 : 0.18 - (i-30) * 0.003);
        if (pct < 0.01) pct = 0.01;
        cumPct += pct;
        var bal = (totalSupply * pct / 100);
        var actAgo = [1,3,7,12,18,24,38,52,76,98,142][i % 11];
        html += '<div class="mdxa-hl-row">' +
          '<span class="mdxa-hl-rank">#' + (i+1) + '</span>' +
          '<span class="mdxa-hl-ident">' + makeIdenticon(addr, 26) + '</span>' +
          '<div class="mdxa-hl-meta"><div class="mdxa-hl-addr mono">' + shortAddr(addr) + '</div><a class="mdxa-hl-explorer" href="#">View on Explorer ↗</a></div>' +
          '<div class="mdxa-hl-vals"><div class="mdxa-hl-bal mono">' + (bal >= 1000000 ? (bal/1000000).toFixed(2) + 'M' : bal >= 1000 ? (bal/1000).toFixed(1) + 'K' : bal.toFixed(0)) + '</div><div class="mdxa-hl-pct mono">' + pct.toFixed(3) + '%</div></div>' +
          
        '</div>';
      }
      html += '</div>';
      html += '<div class="mdxa-hl-pgn"><div class="info">1–50 of 12,408 · Cum ' + cumPct.toFixed(1) + '%</div><div class="pgn"><button class="active">1</button><button>2</button><button>3</button><button>Next ›</button></div></div>';
      html += '</div>';
    } else if (tab === 'pools') {
      if (title) title.textContent = 'AMM Pools';
      var POOLS = [
        { pair: 'USDC / APT', net: 'Aptos', tvl: '$4.85M', apr: '24.8%', vol: '$980K' },
        { pair: 'USDC / AMI', net: 'Aptos', tvl: '$1.42M', apr: '31.2%', vol: '$284K' },
        { pair: 'USDC / CELL', net: 'Aptos', tvl: '$612K', apr: '42.6%', vol: '$148K' },
        { pair: 'USDC / LUMOS', net: 'Aptos', tvl: '$418K', apr: '38.4%', vol: '$92K' },
        { pair: 'USDC / USDT', net: 'Aptos', tvl: '$224K', apr: '28.1%', vol: '$48K' },
        { pair: 'USDC / USDC', net: 'Aptos', tvl: '$184K', apr: '12.4%', vol: '$62K' },
        { pair: 'USDC / BTC', net: 'Aptos', tvl: '$48K', apr: '8.2%', vol: '$14K' }
      ];
      html = '<div class="mdxa-tab-extra mdxa-pools">';
      html += '<div class="mdxa-pl-head">' +
              '<div class="mdxa-hl-stat"><span class="lbl">Pools</span><span class="val mono">7</span></div>' +
              '<div class="mdxa-hl-stat"><span class="lbl">TVL</span><span class="val mono">$7.76M</span></div>' +
              '<div class="mdxa-hl-stat"><span class="lbl">24h vol</span><span class="val mono">$1.63M</span></div></div>';
      html += '<div class="mdxa-pl-list">';
      POOLS.forEach(function(p) {
        var aprNum = parseFloat(p.apr);
        var aprClass = aprNum >= 30 ? 'apr-hot' : aprNum >= 15 ? 'apr-mid' : 'apr-low';
        html += '<div class="mdxa-pl-row">' +
          '<div class="mdxa-pl-l"><span class="dxa-pl-icos"><span class="dxa-pl-ico" style="background:linear-gradient(135deg,#2563eb,#1e40af);">$</span><span class="dxa-pl-ico" style="background:linear-gradient(135deg,#000,#1a1a1f);">★</span></span>' +
            '<div><div class="mdxa-pl-name">' + p.pair + '</div><div class="mdxa-pl-net"><span class="net-pill ' + p.net.toLowerCase() + '">' + p.net + '</span></div></div></div>' +
          '<div class="mdxa-pl-r"><div class="mdxa-pl-tvl mono">' + p.tvl + '</div><div class="mdxa-pl-apr ' + aprClass + '">APR ' + p.apr + '</div></div>' +
        '</div>';
      });
      html += '</div></div>';
    }
    panel.insertAdjacentHTML('beforeend', html);
  }

  ready(function() {
    renderChart();
    attachMdxaHover();
    attachMdxaPanelHandlers();
    renderOrderbook();
    renderPanelTab('exchanges');

    document.querySelectorAll('.chart-tools button').forEach(function(b) {
      b.addEventListener('click', function() {
        document.querySelectorAll('.chart-tools button').forEach(function(o) { o.classList.toggle('active', o === b); });
        currentType = b.dataset.type || 'area';
        renderChart();
      });
    });
    document.querySelectorAll('.timeframes button').forEach(function(b) {
      b.addEventListener('click', function() {
        document.querySelectorAll('.timeframes button').forEach(function(o) { o.classList.toggle('active', o === b); });
        currentPeriod = b.dataset.period || '1D';
        renderChart();
      });
    });
    document.querySelectorAll('.mdxa-trade-tab').forEach(function(b) {
      b.addEventListener('click', function() {
        document.querySelectorAll('.mdxa-trade-tab').forEach(function(o) { o.classList.toggle('active', o === b); });
        var pane = b.dataset.pane;
        document.querySelectorAll('.mdxa-pane').forEach(function(p) { p.classList.toggle('active', p.dataset.pane === pane); });
      });
    });
    document.querySelectorAll('.mdxa-side-toggle').forEach(function(group) {
      var btns = group.querySelectorAll('.mdxa-side-btn');
      btns.forEach(function(b) {
        b.addEventListener('click', function() {
          btns.forEach(function(o) { o.classList.toggle('active', o === b); });
          var pane = group.closest('.mdxa-pane');
          if (pane) {
            var cta = pane.querySelector('.mdxa-trade-cta');
            if (cta) {
              var isBuy = b.classList.contains('buy');
              var label = b.textContent.trim().indexOf('Buy') === 0 ? 'Place Buy Order' : 'Place Sell Order';
              cta.textContent = label;
              cta.style.background = isBuy ? 'var(--green)' : 'var(--red)';
              cta.style.borderColor = isBuy ? 'var(--green)' : 'var(--red)';
            }
          }
        });
      });
    });
    document.querySelectorAll('.tabs-bar .tab').forEach(function(b) {
      b.addEventListener('click', function() {
        document.querySelectorAll('.tabs-bar .tab').forEach(function(o) { o.classList.toggle('active', o === b); });
        renderPanelTab(b.dataset.tab);
      });
    });
    document.querySelectorAll('.mdxa-trade-cta').forEach(function(b) {
      b.addEventListener('click', function() {
        if (window.showToast) window.showToast(b.textContent.trim() + ' submitted');
      });
    });
    document.querySelectorAll('.mdxa-trade-flip').forEach(function(b) {
      b.addEventListener('click', function() {
        var pane = b.closest('.mdxa-pane');
        if (!pane) return;
        var inputs = pane.querySelectorAll('.mdxa-trade-field input');
        if (inputs.length < 2) return;
        var tmp = inputs[0].value; inputs[0].value = inputs[1].value; inputs[1].value = tmp;
      });
    });
    document.querySelectorAll('.panel-head .filters .chip').forEach(function(c) {
      c.addEventListener('click', function() {
        document.querySelectorAll('.panel-head .filters .chip').forEach(function(o) { o.classList.toggle('active', o === c); });
        var minXlm = parseFloat(c.getAttribute('data-min-xlm')) || 0;
        currentTradeFilter = minXlm;
        renderExchanges();
      });
    });
    // Reaction buttons — bump count on tap
    document.querySelectorAll('.mdxa-react-btn').forEach(function(btn) {
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
