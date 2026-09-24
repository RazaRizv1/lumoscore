
// ============================================================
// DEX MAIN PAGE WIRING
// (header theme/search wiring is handled by closing_post — don't duplicate)
// ============================================================
(function() {
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  // ---------- Asset palette ----------
  var pairs = [
    { base: 'USDC',    cat: 'stable',  domain: 'circle.com',        addr: '0xbae2...6f3b', price: 0.160,   priceUsd: 1.0000,  ch: 0.01,   vol: 45.2e6,  volUsd: 9.6e6,   tvl: 6.1e6,   b: '#2775ca', bIco: '$' },
    { base: 'APT',     cat: 'utility', domain: 'aptosfoundation.org', addr: '0x0000...000a', price: 1.0,   priceUsd: 6.2400,  ch: 3.10,   vol: 12.4e6,  volUsd: 3.3e6,   tvl: 8.9e6,   b: '#000000', bIco: 'A' },
    { base: 'AMI',     cat: 'utility', domain: 'amnis.finance',     addr: '0x111a...542a', price: 1.03,    priceUsd: 6.4300,  ch: 3.40,   vol: 1.8e6,   volUsd: 388e3,   tvl: 2.4e6,   b: '#00c2a8', bIco: 'a' },
    { base: 'MOD',     cat: 'stable',  domain: 'thala.fi',          addr: '0x94ed...5ff4', price: 0.160,   priceUsd: 1.0000,  ch: 0.02,   vol: 3.2e6,   volUsd: 690e3,   tvl: 5.1e6,   b: '#6b4ff2', bIco: 'M' },
    { base: 'aBTC',    cat: 'utility', domain: 'echo-protocol.xyz', addr: '0x4e18...5fe4', price: 15110,   priceUsd: 94300,   ch: -2.10,  vol: 6.4e6,   volUsd: 1.38e6,  tvl: 9.1e6,   b: '#f7931a', bIco: '₿' },
    { base: 'CELL',    cat: 'utility', domain: 'cellana.finance',   addr: '0x2ebb...df12', price: 0.104,   priceUsd: 0.6500,  ch: 22.40,  vol: 962e3,   volUsd: 208e3,   tvl: 640e3,   b: '#6f5ded', bIco: 'C', isNew: true },
    { base: 'LSD',     cat: 'utility', domain: 'liquidswap.com',    addr: '0x53a3...3719', price: 0.058,   priceUsd: 0.3600,  ch: 8.10,   vol: 148e3,   volUsd: 32e3,    tvl: 96e3,    b: '#ff5c00', bIco: 'L' },
    { base: 'MESO',    cat: 'utility', domain: 'meso.finance',      addr: '0x6884...2a3d', price: 0.072,   priceUsd: 0.4500,  ch: -1.90,  vol: 302e3,   volUsd: 65e3,    tvl: 210e3,   b: '#22c55e', bIco: 'M' },
    { base: 'RION',    cat: 'utility', domain: 'hyperion.xyz',      addr: '0x435a...3a5b', price: 0.088,   priceUsd: 0.5500,  ch: 1.20,   vol: 214e3,   volUsd: 46e3,    tvl: 118e3,   b: '#8b5cf6', bIco: 'R' },
    { base: 'ECHO',    cat: 'utility', domain: 'echo-protocol.xyz', addr: '0xb2c7...d1b7', price: 0.019,   priceUsd: 0.1200,  ch: 7.10,   vol: 421e3,   volUsd: 91e3,    tvl: 305e3,   b: '#06b6d4', bIco: 'E' },
    { base: 'GUI',     cat: 'utility', domain: null,                addr: '0x7769...1a2c', price: 0.0000027,priceUsd: 0.000017,ch: 12.40,  vol: 512e3,   volUsd: 110e3,   tvl: 880e3,   b: '#f5a623', bIco: 'G' },
    { base: 'USDT',    cat: 'stable',  domain: 'tether.to',         addr: '0x357b...dc2b', price: 0.160,   priceUsd: 0.9990,  ch: 0.00,   vol: 22.4e6,  volUsd: 4.7e6,   tvl: 3.9e6,   b: '#26a17b', bIco: '₮' }
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
