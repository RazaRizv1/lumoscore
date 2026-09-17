
  // ===== Hero chart: range tabs + hover/touch tooltip =====
  (function(){
    const wrap = document.getElementById('heroChart');
    if (!wrap) return;
    const W = 400, H = 90;

    // Per-range config: number of points, volatility, axis labels, and the
    // "past N" label + headline delta shown under the portfolio value.
    const config = {
      '1D':  { points: 24, vol: 1.6, seed: 11, axis: ['12 AM','6 AM','12 PM','Now'], mini: 'past 24 hours' },
      '1W':  { points: 30, vol: 2.8, seed: 7,  axis: ['May 16','May 19','May 22','Today'], mini: 'past 7 days' },
      '1M':  { points: 30, vol: 3.4, seed: 23, axis: ['Apr 23','Apr 30','May 14','Today'], mini: 'past 30 days' },
      '1Y':  { points: 40, vol: 5.2, seed: 37, axis: ['Jun','Sep','Dec','May'], mini: 'past year' },
      'ALL': { points: 50, vol: 7.0, seed: 43, axis: ['2023','2024','2025','2026'], mini: 'all-time' },
    };

    // Base portfolio value the synthetic % movements are applied around
    const BASE_VALUE = 31108.45;

    function makeRng(seed) {
      let s = seed;
      return function() { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    }

    let state = null; // holds current geometry + data for the hover handler

    function render(period) {
      const c = config[period] || config['1W'];
      const rng = makeRng(c.seed);
      const pts = []; let v = 45;
      for (let i = 0; i < c.points; i++) {
        v += (rng() - 0.4) * c.vol + 0.4;
        pts.push(Math.max(18, Math.min(82, v)));
      }
      const min = Math.min(...pts), max = Math.max(...pts), r = max - min || 1;
      const step = W / (pts.length - 1);
      const P = pts.map((p,i) => [i*step, H - ((p-min)/r)*(H-14) - 7]);
      const line = P.map((p,i) => (i===0?'M':'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
      const area = line + ` L ${W} ${H} L 0 ${H} Z`;
      const lastP = P[P.length-1];

      // Map each point to a portfolio value for the tooltip (min point ≈ -6%, max ≈ +12%)
      const valAt = pts.map(p => BASE_VALUE * (0.94 + ((p - min) / r) * 0.18));

      wrap.innerHTML =
        '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" width="100%" height="100%" style="display:block">' +
          '<defs><linearGradient id="hg" x1="0" x2="0" y1="0" y2="1">' +
            '<stop offset="0%" stop-color="#35c07f" stop-opacity="0.38"/>' +
            '<stop offset="100%" stop-color="#35c07f" stop-opacity="0"/>' +
          '</linearGradient></defs>' +
          '<path d="' + area + '" fill="url(#hg)"/>' +
          '<path d="' + line + '" fill="none" stroke="#35c07f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<line id="chartCursor" class="chart-cursor-dot" x1="0" y1="0" x2="0" y2="' + H + '" stroke="#35c07f" stroke-width="1" stroke-dasharray="3 3" opacity="0"/>' +
          '<circle id="chartCursorDot" class="chart-cursor-dot" r="3.5" fill="#35c07f" stroke="var(--surface)" stroke-width="1.5" opacity="0"/>' +
          '<circle cx="' + lastP[0] + '" cy="' + lastP[1] + '" r="3" fill="#35c07f"/>' +
          '<circle cx="' + lastP[0] + '" cy="' + lastP[1] + '" r="6" fill="#35c07f" opacity="0.25"/>' +
          '<rect id="chartHit" x="0" y="0" width="' + W + '" height="' + H + '" fill="transparent"/>' +
        '</svg>' +
        '<div class="chart-tooltip" id="chartTooltip"><span class="ct-val" id="ctVal">—</span><div class="ct-date" id="ctDate">—</div></div>';

      // Axis labels
      const axis = wrap.parentElement.querySelector('.chart-axis');
      if (axis) axis.innerHTML = c.axis.map(l => '<span>' + l + '</span>').join('');

      // "past N" mini-label
      const tfMini = document.querySelector('.timeframe-mini');
      if (tfMini) tfMini.textContent = c.mini;

      state = { P, valAt, step, period: period, axis: c.axis };
      bindHover();
    }

    function bindHover() {
      const svg = wrap.querySelector('svg');
      const hit = wrap.querySelector('#chartHit');
      const cursor = wrap.querySelector('#chartCursor');
      const dot = wrap.querySelector('#chartCursorDot');
      const tip = wrap.querySelector('#chartTooltip');
      const ctVal = wrap.querySelector('#ctVal');
      const ctDate = wrap.querySelector('#ctDate');
      if (!hit) return;

      function show(clientX) {
        const rect = svg.getBoundingClientRect();
        const sx = (clientX - rect.left) * (W / rect.width);
        let idx = Math.round(sx / state.step);
        idx = Math.max(0, Math.min(state.P.length - 1, idx));
        const px = state.P[idx][0], py = state.P[idx][1];
        cursor.setAttribute('x1', px); cursor.setAttribute('x2', px); cursor.setAttribute('opacity', '1');
        dot.setAttribute('cx', px); dot.setAttribute('cy', py); dot.setAttribute('opacity', '1');
        ctVal.textContent = state.valAt[idx].toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' APT';
        // Approximate a date label by interpolating across the axis labels
        const frac = idx / (state.P.length - 1);
        const ai = Math.round(frac * (state.axis.length - 1));
        ctDate.textContent = state.axis[ai] || '';
        // Position the tooltip (it's absolute within .mini-chart)
        const leftPx = (px / W) * rect.width;
        tip.style.left = Math.max(28, Math.min(rect.width - 28, leftPx)) + 'px';
        tip.style.top = '2px';
        tip.classList.add('visible');
      }
      function hide() {
        cursor.setAttribute('opacity', '0');
        dot.setAttribute('opacity', '0');
        tip.classList.remove('visible');
      }
      hit.addEventListener('mousemove', e => show(e.clientX));
      hit.addEventListener('mouseleave', hide);
      hit.addEventListener('touchstart', e => { if (e.touches[0]) { show(e.touches[0].clientX); } }, {passive:true});
      hit.addEventListener('touchmove', e => { if (e.touches[0]) { e.preventDefault(); show(e.touches[0].clientX); } }, {passive:false});
      hit.addEventListener('touchend', hide);
    }

    // Range tabs
    const tabs = wrap.parentElement.querySelectorAll('.tf-row .tf-btn');
    tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        tabs.forEach(b => b.classList.toggle('active', b === btn));
        render((btn.textContent || '').trim());
      });
    });

    const initial = wrap.parentElement.querySelector('.tf-row .tf-btn.active');
    render(initial ? (initial.textContent || '').trim() : '1W');
  })();

  // Assets stacked cards
  const assets = [
    { ic:'X', col:'linear-gradient(135deg,#2a2a35,#1a1a23)', nm:'Aptos Coin', sb:'APT · native', p:'1.00 APT', p2:'≈ $0.4128', c24:'+2.34', xlm:'25,420.18 APT', usd:'≈ $10,493.45' },
    { ic:'$', col:'linear-gradient(135deg,#2775ca,#1a5491)', nm:'USD Coin', sb:'USDC · Circle', p:'2.41 APT', p2:'≈ $0.9964', c24:'0.00', xlm:'3,017.10 APT', usd:'1,250.40 USDC' },
    { ic:'USDT', col:'linear-gradient(135deg,var(--accent),#ff9a3d)', nm:'Tether', sb:'USDT · Meme', p:'0.0359 APT', p2:'≈ $0.0148', c24:'+12.42', xlm:'2,113.51 APT', usd:'58,900 USDT' },
    { ic:'PHX', col:'linear-gradient(135deg,#f43f5e,#be123c)', nm:'Wrapped Bitcoin', sb:'WBTC', p:'0.0₄13 APT', p2:'≈ $0.0₅18', c24:'-3.21', xlm:'523.45 APT', usd:'1.2M WBTC' },
    { ic:'PAXG', col:'linear-gradient(135deg,#a855f7,#6d28d9)', nm:'PAX Gold', sb:'PAXG · Utility', p:'2.11 APT', p2:'≈ $0.87', c24:'+5.42', xlm:'51.02 APT', usd:'24.18 PAXG' },
  ];
  const list = document.getElementById('assetList') || document.createElement('div');
  const pools = [
    { ic:'L', col:'linear-gradient(135deg,#ea6a2c,#ff9a3d)', nm:'LUMOS / APT', sb:'AMM Pool', p:'TVL 3,442 APT', p2:'≈ $1,420', c24:'+5.42', xlm:'2,100 APT', usd:'56,800 LUMOS · ≈ $866', poolAddr:'a468d4b3829acbe70088' },
    { ic:'K', col:'linear-gradient(135deg,#35c07f,#16a34a)', nm:'GUI / APT', sb:'AMM Pool', p:'TVL 1,820 APT', p2:'≈ $751', c24:'-1.84', xlm:'1,342 APT', usd:'12,400 GUI · ≈ $554', poolAddr:'b71f9c2538d1ace40177' },
  ];

  let currentTab = 'assets';
  let currentQuery = '';

  function renderAssetList() {
    const dataset = currentTab === 'pools' ? pools : assets;
    const q = currentQuery.trim().toLowerCase();
    const filtered = q
      ? dataset.filter(a => (a.nm + ' ' + a.sb + ' ' + (a.ic || '')).toLowerCase().includes(q))
      : dataset;
    list.innerHTML = '';
    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:32px 16px;text-align:center;color:var(--text-soft);font-size:13.5px;';
      empty.textContent = q ? 'No matches for “' + currentQuery + '”' : 'No items to show';
      list.appendChild(empty);
      return;
    }
    filtered.forEach(a => {
      const c24 = parseFloat(a.c24);
      const isUp = c24 > 0;
      const isZero = c24 === 0;
      const div = document.createElement('div');
      div.className = 'asset-row';
      div.innerHTML = `
      <div class="asset-top">
        <div class="asset-ico" style="background:${a.col}">${a.ic}</div>
        <div class="asset-meta">
          <div class="asset-name-row">
            <span class="asset-name">${a.nm}</span>
            <span class="change-pill ${isUp ? 'up' : 'down'}" style="${isZero ? 'background:var(--bg);color:var(--text-muted)' : ''}">
              ${isUp ? '▲' : (isZero ? '—' : '▼')} ${isZero ? '0.00' : Math.abs(c24)}%
            </span>
          </div>
          <div class="asset-sub">${a.sb}</div>
        </div>
        <div class="asset-balance-block">
          <div class="v1">${a.xlm}</div>
          <div class="v2">${a.usd}</div>
        </div>
      </div>
      <div class="asset-bottom">
        <div class="price-info">
          <span class="price">${a.p} <span style="color:var(--text-soft)">· ${a.p2}</span></span>
        </div>
        <div class="asset-actions">
          <button class="asset-action-btn"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> Trade on DEX</button>
          <button class="asset-action-btn icon-only"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
          ${currentTab === 'pools' ? `<button class="kebab-btn" data-pool-addr="${a.poolAddr || ''}" data-pool-name="${a.nm}" aria-label="Pool options"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg></button>` : ''}
        </div>
      </div>
      `;
      list.appendChild(div);
    });
  }

  // Wire asset-tabs (Assets / Liq Pools)
  document.querySelectorAll('.asset-tabs button').forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.asset-tabs button').forEach(b => b.classList.toggle('active', b === btn));
      currentTab = idx === 0 ? 'assets' : 'pools';
      renderAssetList();
    });
  });

  // Wire search input
  (function() {
    const wrap = list.parentElement;
    const inputEl = wrap ? wrap.querySelector('.search-box input') : null;
    if (inputEl) {
      inputEl.addEventListener('input', e => {
        currentQuery = e.target.value;
        renderAssetList();
      });
    }
  })();

  renderAssetList();
