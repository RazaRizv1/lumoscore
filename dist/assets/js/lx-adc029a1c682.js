
// ============================================================
// DEX MAIN PAGE WIRING
// (header theme/search wiring is handled by closing_post — don't duplicate)
// ============================================================
(function() {
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  // ---------- Asset palette ----------
  var pairs = [
    { base: 'USDC', cat: 'stable',  domain: 'circle.com',         addr: '0x025c…4db1', price: 4.5844, priceUsd: 0.9936, ch: 11.21,  vol: 42.5e6,  volUsd: 9.2e6,  tvl: 5e6,    b: '#2775ca', bIco: '$' },
    { base: 'XRP', cat: 'utility',   domain: 'ripple.com',         addr: '0x0876…7a03', price: 5.5994, priceUsd: 1.2136, ch: -0.23,  vol: 586.9e3, volUsd: 127.2e3, tvl: 121.9e3, b: '#23292f', bIco: 'X' },
    { base: 'MESO', cat: 'utility',   domain: 'meso.finance',      addr: '0x0fda…0bdf', price: 0.0224, priceUsd: 0.0049, ch: 5.26,  vol: 548.5e3, volUsd: 118.9e3, tvl: 887.5e3, b: '#22c55e', bIco: 'S' },
    { base: 'AMI', cat: 'utility',  domain: 'amnis.finance',   addr: '0x0a6a…57af', price: 0.9998, priceUsd: 0.2167, ch: 0.02,  vol: 508e3,   volUsd: 110.1e3, tvl: 778.2e3, b: '#00c2a8', bIco: 'y' },
    { base: 'PYUSD', cat: 'stable', domain: 'paypal.com',         addr: '0x0bf3…d70f',      price: 4.2275, priceUsd: 0.9162, ch: -0.05, vol: 470e3,   volUsd: 102e3,   tvl: 690e3,   b: '#0066cc', bIco: 'P' },
    { base: 'RION', cat: 'utility',  domain: 'hyperion.xyz',           addr: '0x03ec…f23b',      price: 0.0161, priceUsd: 0.0035, ch: 7.28,  vol: 216e3,   volUsd: 46.8e3,  tvl: 199.2e3, b: '#8b5cf6', bIco: 'V' },
    { base: 'EURC', cat: 'stable',  domain: 'circle.com',         addr: '0x051d…68fb',      price: 4.4377, priceUsd: 0.9618, ch: -11.17, vol: 158.8e3, volUsd: 34.4e3, tvl: 211e3,   b: '#6f5ded', bIco: 'E' },
    { base: 'CELL', cat: 'utility',  domain: 'cellana.finance',       addr: '0x0548…aaa0',      price: 0.0019, priceUsd: 0.0004, ch: 4.90,  vol: 116e3,   volUsd: 25.1e3,  tvl: 254.1e3, b: '#6f5ded', bIco: 'A' },
    { base: 'WBTC', cat: 'utility', domain: 'wbtc.network',  addr: '0x0729…a367',      price: 0.0027, priceUsd: 0.0006, ch: -12.04, vol: 108.5e3, volUsd: 23.5e3, tvl: 179.4e3, b: '#f59e0b', bIco: '⚡' },
    { base: 'GUI', cat: 'utility',  domain: 'mobius.network',        addr: '0x01fd…653e',       price: 0.0134, priceUsd: 0.0029, ch: 12.50, vol: 94.4e3,  volUsd: 20.4e3, tvl: 142e3,   b: '#f5a623', bIco: 'S', isNew: true },
    { base: 'PYUSD', cat: 'stable',  domain: 'paypal.com', addr: '0x07d4…3942',    price: 5.4965, priceUsd: 1.1908, ch: 2.31,  vol: 91.4e3,  volUsd: 19.8e3,  tvl: 112e3,   b: '#fbbf24', bIco: 'U' },
    { base: 'BTC', cat: 'utility',   domain: 'bitcoin.org',        addr: '0x0f04…e686',    price: 307072.29, priceUsd: 66551.78, ch: 6.06, vol: 76.8e3, volUsd: 16.7e3, tvl: 144.9e3, b: '#f7931a', bIco: '₿' },
    { base: 'PAXG', cat: 'utility',  domain: 'paxos.com',           addr: '0x09e6…1a01',     price: 466.5267, priceUsd: 101.11, ch: -3.15, vol: 59.9e3, volUsd: 13e3,   tvl: 16.6e3,  b: '#fbbf24', bIco: 'G' },
    { base: 'DAI', cat: 'meme',  domain: 'makerdao.com',           addr: '0x0f34…5d01', price: 0.0027, priceUsd: 0.0006, ch: 12.80, vol: 38.6e3, volUsd: 8.4e3,  tvl: 59.8e3,  b: '#fb923c', bIco: 'S', isNew: true },
    { base: 'MOD', cat: 'utility',   domain: null,                 addr: '0x086f…ab38', price: 0.0010, priceUsd: 0.0002, ch: -1.21, vol: 2.2e3,  volUsd: 468,    tvl: 45.6e3,  b: '#6b4ff2', bIco: 'L', isNew: true },
    { base: 'ETH', cat: 'meme',  domain: null,                 addr: '0x0a21…71b7',         price: 0.00000019, priceUsd: 0.0000000412, ch: 100, vol: 1, volUsd: 0.2, tvl: 100,    b: '#fde047', bIco: 'X', isNew: true },
    { base: 'LINK', cat: 'meme', domain: null,                 addr: '0x0429…ef30',         price: 0.0007, priceUsd: 0.0002, ch: 24.07, vol: 480,   volUsd: 104,    tvl: 8.5e3,   b: '#a855f7', bIco: 'P', isNew: true },
    { base: 'ATOM', cat: 'meme',   domain: 'cosmos.network',         addr: '0x038e…8abd', price: 0.0103, priceUsd: 0.0022, ch: 18.70, vol: 9.6e3, volUsd: 2.1e3,  tvl: 14.6e3,  b: '#fb923c', bIco: 'X', isNew: true }
  ];

  function dayRange(p) {
    var swing = Math.max(Math.abs(p.ch) / 100, 0.012);
    return { high: p.price * (1 + swing * 0.62), low: p.price * (1 - swing * 0.48) };
  }

  function fmtMoney(n) {
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n.toFixed(0);
  }
  function fmtAmt(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toFixed(0);
  }
  function fmtPrice(n) {
    if (n >= 1000) return n.toFixed(2);
    if (n >= 1) return n.toFixed(4);
    if (n >= 0.01) return n.toFixed(5);
    if (n >= 0.0001) return n.toFixed(7);
    return n.toExponential(2);
  }

  // ---------- Sparkline helper ----------
  function makeSpark(seed, n, trend) {
    var s = seed; function rand() { s = (s * 9301 + 49297) % 233280; return s / 233280; }
    var pts = []; var v = 50;
    for (var i = 0; i < n; i++) {
      v += (rand() - 0.5 + (trend || 0) * 0.18) * 5;
      v = Math.max(15, Math.min(85, v));
      pts.push(v);
    }
    var min = Math.min.apply(null, pts), max = Math.max.apply(null, pts);
    var w = 88, h = 28;
    var step = w / (n - 1);
    var p = pts.map(function(y, i) { return [i * step, h - ((y - min) / (max - min || 1)) * (h - 4) - 2]; });
    var d = p.map(function(pt, i) { return (i === 0 ? 'M' : 'L') + pt[0].toFixed(1) + ' ' + pt[1].toFixed(1); }).join(' ');
    var color = trend > 0 ? '#35c07f' : trend < 0 ? '#ff5b5b' : '#a5a4ac';
    return '<svg class="dex-mk-spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' +
      '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';
  }

  // ---------- APT price chart (Trading Activity card) ----------
  var APT_RANGES = {
    '1H': { points: 24, base: 0.4063, trend: 0.4, swing: 0.012 },
    '1D': { points: 24, base: 0.4035, trend: 0.6, swing: 0.020 },
    '1W': { points: 28, base: 0.3870, trend: 0.7, swing: 0.040 },
    '1M': { points: 30, base: 0.3624, trend: 0.9, swing: 0.060 },
    '1Y': { points: 36, base: 0.2680, trend: 1.8, swing: 0.180 }
  };
  function seedRand(seed) { var s = seed; return function() { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
  function genXlmSeries(period) {
    var cfg = APT_RANGES[period] || APT_RANGES['1W'];
    var rand = seedRand(period.charCodeAt(0) * 53);
    var pts = []; var v = cfg.base;
    for (var i = 0; i < cfg.points; i++) {
      var noise = (rand() - 0.48) * cfg.swing * 0.4;
      var drift = (cfg.trend / cfg.points) * cfg.swing * 0.7;
      v = Math.max(0.01, v + drift + noise);
      pts.push(v);
    }
    return pts;
  }
  var currentTf = '1W';
  function renderXlmChart() {
    var box = document.getElementById('dexXlmChart');
    if (!box) return;
    var prices = genXlmSeries(currentTf);
    window._dexLastPrices = prices;
    var W = 460, H = 110;
    var PAD = { l: 0, r: 4, t: 6, b: 4 };
    var pw = W - PAD.l - PAD.r;
    var ph = H - PAD.t - PAD.b;
    var min = Math.min.apply(null, prices), max = Math.max.apply(null, prices);
    var pad = (max - min) * 0.18;
    var lo = min - pad, hi = max + pad;
    var n = prices.length;
    var step = pw / (n - 1);
    var pts = prices.map(function(p, i) {
      return [PAD.l + i * step, PAD.t + ph - ((p - lo) / (hi - lo)) * ph];
    });
    var d = pts.map(function(p, i) { return (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var areaD = d + ' L ' + pts[n-1][0].toFixed(1) + ' ' + (PAD.t + ph) + ' L ' + pts[0][0].toFixed(1) + ' ' + (PAD.t + ph) + ' Z';
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
      '<defs><linearGradient id="dexXlmGrad" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#ea6a2c" stop-opacity="0.30"/><stop offset="100%" stop-color="#ea6a2c" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + areaD + '" fill="url(#dexXlmGrad)"/>' +
      '<path d="' + d + '" fill="none" stroke="#ea6a2c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';
    // Preserve hover overlay across re-renders
    var _dexHov = document.getElementById('dexChartHover');
    var _dexHovHTML = _dexHov ? _dexHov.outerHTML : '<div class="dex-chart-hover" id="dexChartHover"><div class="dex-chart-line"></div><div class="dex-chart-dot"></div><div class="dex-chart-tip"><span class="t-val" id="dexHoverVal">—</span></div></div>';
    if (_dexHov) _dexHov.classList.remove('active');
    box.innerHTML = svg + _dexHovHTML;
    // Update price display
    var lastPrice = prices[prices.length - 1];
    var firstPrice = prices[0];
    var ch = ((lastPrice - firstPrice) / firstPrice) * 100;
    var priceEl = document.getElementById('dexXlmPrice');
    var chEl = document.getElementById('dexXlmCh');
    if (priceEl) priceEl.textContent = '$' + lastPrice.toFixed(4);
    if (chEl) {
      chEl.textContent = (ch >= 0 ? '▲ ' : '▼ ') + Math.abs(ch).toFixed(2) + '%';
      chEl.className = 'ch ' + (ch >= 0 ? 'up' : 'down');
    }
  }
  ready(function() {
    renderXlmChart();
    document.querySelectorAll('#dexTfTabs button').forEach(function(b) {
      b.addEventListener('click', function() {
        document.querySelectorAll('#dexTfTabs button').forEach(function(o) { o.classList.toggle('active', o === b); });
        currentTf = b.dataset.tf || '1W';
        renderXlmChart();
      });
    });
  });

  // ---------- New Mints list ----------
  var MINTS_24H = [
    { tk: 'USDT',  nm: 'Tether USD',    age: '14 min ago', mc: '$84.2K',  holders: 128, b: '#26a17b', isNew: true },
    { tk: 'MOD', nm: 'Move Dollar',  age: '1h 22m ago', mc: '$162.9K', holders: 341, b: '#6b4ff2' },
    { tk: 'PAXG',  nm: 'PAX Gold', age: '3h 04m ago', mc: '$41.5K',  holders: 96,  b: 'linear-gradient(135deg,#a855f7,#6d28d9)' },
    { tk: 'RION', nm: 'Hyperion',  age: '5h 47m ago', mc: '$28.0K',  holders: 62,  b: '#8b5cf6' },
    { tk: 'LINK', nm: 'XDC Network',         age: '8h 11m ago', mc: '$19.3K',  holders: 44,  b: 'linear-gradient(135deg,#e11d48,#9f1239)' }
  ];
  var MINTS_7D = [
    { tk: 'ETH', nm: 'Ethereum',    age: '2d ago',     mc: '$412.8K', holders: 1042, b: 'linear-gradient(135deg,#f59e0b,#d97706)' },
    { tk: 'USDT',  nm: 'Tether USD',    age: '14 min ago', mc: '$84.2K',  holders: 128, b: '#26a17b', isNew: true },
    { tk: 'MOD', nm: 'Move Dollar',  age: '1h 22m ago', mc: '$162.9K', holders: 341, b: '#6b4ff2' },
    { tk: 'ATOM', nm: 'Cosmos',       age: '4d ago',     mc: '$76.5K',  holders: 284, b: 'linear-gradient(135deg,#6f5ded,#1d4ed8)' },
    { tk: 'DAI', nm: 'Euro Coin',    age: '6d ago',     mc: '$54.3K',  holders: 196, b: 'linear-gradient(135deg,#ec4899,#be185d)' }
  ];
  function renderMints(period) {
    var list = document.getElementById('dexMintsList');
    if (!list) return;
    var data = period === '7D' ? MINTS_7D : MINTS_24H;
    list.innerHTML = data.map(function(m) {
      var initials = m.tk.slice(0, 3);
      var newTag = m.isNew ? '<span class="new-tag">NEW</span>' : '';
      return '<div class="dex-mint-row">' +
        '<span class="dex-mint-ic" data-logo="' + m.tk + '" style="background:' + m.b + '">' + initials + '</span>' +
        '<div class="dex-mint-meta">' +
          '<div class="dex-mint-name">' + m.nm + ' <span class="tk">' + m.tk + '</span>' + newTag + '</div>' +
          '<div class="dex-mint-sub">Minted ' + m.age + '</div>' +
        '</div>' +
        '<div class="dex-mint-right">' +
          '<div class="dex-mint-mc">' + m.mc + '</div>' +
          '<div class="dex-mint-holders">' + m.holders.toLocaleString() + ' holders</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }
  ready(function() {
    renderMints('24H');
    document.querySelectorAll('#dexMintTabs button').forEach(function(b) {
      b.addEventListener('click', function() {
        document.querySelectorAll('#dexMintTabs button').forEach(function(o) { o.classList.toggle('active', o === b); });
        renderMints(b.dataset.period || '24H');
      });
    });
  });

  // ---------- Movers ----------
  ready(function() {
    var grid = document.getElementById('dexMoverGrid');
    var tabs = document.querySelectorAll('.dex-mover-tab');
    if (!grid) return;

    function renderMovers(cat) {
      var data = pairs.slice();
      if (cat === 'gainers') data = data.filter(function(p){ return p.ch > 0; }).sort(function(a,b){ return b.ch - a.ch; });
      else if (cat === 'losers') data = data.filter(function(p){ return p.ch < 0; }).sort(function(a,b){ return a.ch - b.ch; });
      else if (cat === 'volume') data = data.sort(function(a,b){ return b.volUsd - a.volUsd; });
      data = data.slice(0, 4);
      grid.innerHTML = data.map(function(p, i) {
        var up = p.ch >= 0;
        var sign = up ? '+' : '';
        var sub = p.domain ? p.domain : p.addr;
        return '<div class="dex-mover-card" data-pair="' + p.base + '">' +
          '<div class="dex-mover-head">' +
            '<span class="dex-mover-ico" style="background:linear-gradient(135deg,' + p.b + ',' + p.b + 'cc)">' + p.bIco + '</span>' +
            '<div class="dex-mover-pair">' + p.base + '<span class="sub">' + sub + '</span></div>' +
            '<span class="dex-mover-pct ' + (up ? 'up' : 'down') + '">' + sign + p.ch.toFixed(2) + '%</span>' +
          '</div>' +
          '<div>' +
            '<div class="dex-mover-price">' + fmtPrice(p.price) + ' <span style="font-size:14px;color:var(--text-soft);font-weight:600">APT</span></div>' +
            '<div class="dex-mover-vol">Vol ' + fmtMoney(p.volUsd) + ' &middot; TVL ' + fmtMoney(p.tvl) + '</div>' +
          '</div>' +
          makeSpark(p.base.charCodeAt(0) * 13 + i * 7, 24, up ? 1 : -1) +
        '</div>';
      }).join('');
      grid.querySelectorAll('.dex-mover-card').forEach(function(card) {
        card.addEventListener('click', function() { __lxNav('lumoscore-dex-asset-dark.html'); });
      });
    }
    renderMovers('gainers');
    tabs.forEach(function(btn) {
      btn.addEventListener('click', function() {
        tabs.forEach(function(b) { b.classList.toggle('active', b === btn); });
        renderMovers(btn.dataset.cat);
      });
    });
  });

  // ---------- Markets table ----------
  ready(function() {
    var tbody = document.getElementById('dexMkTbody');
    var search = document.getElementById('dexMkSearch');
    var shown = document.getElementById('dexMkShown');
    var filterBtns = document.querySelectorAll('.dex-mk-filter');
    if (!tbody) return;
    var query = '';
    var activeFilter = 'all';

    function renderTable() {
      var data = pairs.slice();
      if (activeFilter === 'utility') {
        data = data.filter(function(p) { return p.cat === 'utility'; });
      } else if (activeFilter === 'memes') {
        data = data.filter(function(p) { return p.cat === 'meme'; });
      } else if (activeFilter === 'stables') {
        data = data.filter(function(p) { return p.cat === 'stable'; });
      }
      if (query) {
        var q = query.toLowerCase();
        data = data.filter(function(p) {
          return p.base.toLowerCase().indexOf(q) >= 0 ||
            (p.domain && p.domain.toLowerCase().indexOf(q) >= 0) ||
            p.addr.toLowerCase().indexOf(q) >= 0;
        });
      }
      tbody.innerHTML = data.map(function(p, i) {
        var up = p.ch >= 0;
        var sign = up ? '+' : '';
        var r = dayRange(p);
        var domainBadge = p.domain
          ? '<a class="dex-mk-domain" href="#" onclick="event.stopPropagation();return false"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>' + p.domain + '</a>'
          : '';
        var newBadge = p.isNew
          ? '<span class="dex-mk-newtag">NEW</span>'
          : '';
        return '<tr data-pair="' + p.base + '">' +
          '<td><div class="dex-mk-pair-cell">' +
            '<span class="dex-mk-pair-ic" style="background:linear-gradient(135deg,' + p.b + ',' + p.b + 'aa)">' + p.bIco + '</span>' +
            '<div class="dex-mk-pair-name"><div class="dex-mk-pair-head">' + p.base + newBadge + domainBadge + '</div><span class="sub">' + p.addr + '</span></div>' +
          '</div></td>' +
          '<td><div class="dex-mk-price">' + fmtPrice(p.price) + ' APT<span class="sub">$' + p.priceUsd.toFixed(p.priceUsd < 0.01 ? 6 : 4) + '</span></div></td>' +
          '<td><div class="dex-mk-change ' + (up ? 'up' : 'down') + '">' + sign + p.ch.toFixed(2) + '%</div></td>' +
          '<td><div class="dex-mk-vol">' + fmtAmt(p.vol) + ' APT<span class="sub">' + fmtMoney(p.volUsd) + '</span></div></td>' +
          '<td><div class="dex-mk-tvl">' + fmtMoney(p.tvl) + '</div></td>' +
          '<td><div class="dex-mk-hl">' +
            '<div class="row"><span class="lab">H</span><span class="v-h">' + fmtPrice(r.high) + ' APT</span></div>' +
            '<div class="row"><span class="lab">L</span><span class="v-l">' + fmtPrice(r.low) + ' APT</span></div>' +
          '</div></td>' +
          '<td style="text-align:right">' + makeSpark(p.base.charCodeAt(0) * 31, 20, up ? 1 : -1) + '</td>' +
          '<td style="text-align:right"><button class="dex-mk-action-btn">Trade</button></td>' +
        '</tr>';
      }).join('');
      shown.textContent = data.length === 0 ? '0' : '1–' + data.length;

      tbody.querySelectorAll('tr').forEach(function(tr) {
        tr.addEventListener('click', function() {
          __lxNav('lumoscore-dex-asset-dark.html');
        });
      });
    }

    renderTable();
    if (search) {
      search.addEventListener('input', function() {
        query = search.value.trim();
        renderTable();
      });
    }
    filterBtns.forEach(function(b) {
      b.addEventListener('click', function() {
        filterBtns.forEach(function(o) { o.classList.toggle('active', o === b); });
        activeFilter = b.dataset.filter || 'all';
        renderTable();
      });
    });
  });

})();
