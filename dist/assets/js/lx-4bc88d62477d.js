
  // ============ DYNAMIC TIME-OF-DAY GREETING ============
  // Based on the user's local browser time
  (function(){
    const h = new Date().getHours();
    let g;
    if (h < 5) g = 'Burning the midnight oil';
    else if (h < 12) g = 'Good morning';
    else if (h < 17) g = 'Good afternoon';
    else if (h < 22) g = 'Good evening';
    else g = 'Good night';
    var _gt=document.getElementById('greetingTime'); if(_gt) _gt.textContent = g;
  })();

  // ============ THEME TOGGLE ============
  const root = document.documentElement;
  const themeBtn = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  const SUN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  const XDC = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    themeBtn.innerHTML = t === 'dark' ? SUN : XDC;
  }
  themeBtn.addEventListener('click', () => {
    applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  // ============ Trending tokens (25 entries, scrollable) ============
  const trending = [
    { ic:'A', col:'linear-gradient(135deg,#22d3ee,#0891b2)', nm:'CELL', sub:'Cellana · Aptos', isNew:false, price:'$0.0042', vol:'Vol $8.2K', c24:'+24.8' },
    { ic:'K', col:'linear-gradient(135deg,#35c07f,#16a34a)', nm:'GUI', sub:'Gui Inu · Aptos', isNew:false, price:'$0.018', vol:'Vol $5.4K', c24:'+12.4' },
    { ic:'L', col:'linear-gradient(135deg,#ea6a2c,#ff9a3d)', nm:'LUMOS', sub:'LumosCore · Aptos', isNew:false, price:'$0.0032', vol:'Vol $3.8K', c24:'+5.6' },
    { ic:'N', col:'linear-gradient(135deg,#a855f7,#6d28d9)', nm:'MOD', sub:'Just launched · Aptos', isNew:true, price:'$0.0001', vol:'Vol $1.4K', c24:'+184' },
    { ic:'Y', col:'linear-gradient(135deg,#f43f5e,#be123c)', nm:'AMI', sub:'Ultra Aptos', isNew:false, price:'$0.274', vol:'Vol $2.9K', c24:'+3.8' },
    { ic:'S', col:'linear-gradient(135deg,#8b5cf6,#6d28d9)', nm:'MESO', sub:'Stronghold · Aptos', isNew:false, price:'$0.0067', vol:'Vol $2.1K', c24:'-3.2' },
    { ic:'M', col:'linear-gradient(135deg,#fbbf24,#d97706)', nm:'XDC', sub:'Just launched · Aptos', isNew:true, price:'$0.00008', vol:'Vol $1.1K', c24:'+92.4' },
    { ic:'P', col:'linear-gradient(135deg,#ec4899,#be185d)', nm:'WBTC', sub:'Wrapped Bitcoin · Aptos', isNew:false, price:'$0.000018', vol:'Vol $1.8K', c24:'+8.2' },
    { ic:'G', col:'linear-gradient(135deg,#10b981,#047857)', nm:'RION', sub:'Hyperion · Aptos', isNew:false, price:'$0.024', vol:'Vol $1.6K', c24:'+15.7' },
    { ic:'D', col:'linear-gradient(135deg,#0ea5e9,#0369a1)', nm:'ETH', sub:'Ethereum · Aptos', isNew:false, price:'$0.142', vol:'Vol $1.3K', c24:'-1.4' },
    { ic:'R', col:'linear-gradient(135deg,#ff894c,#c2410c)', nm:'MESO', sub:'Stronghold · Aptos', isNew:false, price:'$0.087', vol:'Vol $1.2K', c24:'+6.8' },
    { ic:'C', col:'linear-gradient(135deg,#06b6d4,#0891b2)', nm:'PAXG', sub:'PAX Gold · Aptos', isNew:false, price:'$0.012', vol:'Vol $980', c24:'+4.2' },
    { ic:'F', col:'linear-gradient(135deg,#eab308,#a16207)', nm:'USDT', sub:'Tether · Aptos', isNew:false, price:'$0.0148', vol:'Vol $870', c24:'+12.4' },
    { ic:'T', col:'linear-gradient(135deg,#84cc16,#4d7c0f)', nm:'ATOM', sub:'Cosmos · Aptos', isNew:false, price:'$0.0034', vol:'Vol $740', c24:'-2.8' },
    { ic:'Z', col:'linear-gradient(135deg,#6f5ded,#1e40af)', nm:'LINK', sub:'Chainlink · Aptos', isNew:false, price:'$0.056', vol:'Vol $680', c24:'+18.2' },
    { ic:'V', col:'linear-gradient(135deg,#ef4444,#991b1b)', nm:'GUI', sub:'Gui Inu · Aptos', isNew:false, price:'$0.0028', vol:'Vol $590', c24:'-4.6' },
    { ic:'O', col:'linear-gradient(135deg,#14b8a6,#0f766e)', nm:'CELL', sub:'Cellana · Aptos', isNew:false, price:'$0.092', vol:'Vol $540', c24:'+7.4' },
    { ic:'I', col:'linear-gradient(135deg,#a3e635,#65a30d)', nm:'MOD', sub:'Move Dollar · Aptos', isNew:false, price:'$0.018', vol:'Vol $520', c24:'+3.1' },
    { ic:'B', col:'linear-gradient(135deg,#f472b6,#db2777)', nm:'EURC', sub:'Euro Coin · Aptos', isNew:false, price:'$0.0067', vol:'Vol $470', c24:'+9.8' },
    { ic:'X', col:'linear-gradient(135deg,#6366f1,#4338ca)', nm:'DAI', sub:'Dai · Aptos', isNew:false, price:'$0.234', vol:'Vol $420', c24:'-0.8' },
    { ic:'H', col:'linear-gradient(135deg,#fb923c,#ea580c)', nm:'WBTC', sub:'Wrapped Bitcoin · Aptos', isNew:false, price:'$0.043', vol:'Vol $380', c24:'+5.3' },
    { ic:'Q', col:'linear-gradient(135deg,#22c55e,#15803d)', nm:'BTC', sub:'Bitcoin · Aptos', isNew:false, price:'$0.0096', vol:'Vol $340', c24:'+11.7' },
    { ic:'J', col:'linear-gradient(135deg,#facc15,#ca8a04)', nm:'RION', sub:'Hyperion · Aptos', isNew:false, price:'$0.058', vol:'Vol $310', c24:'-1.2' },
    { ic:'W', col:'linear-gradient(135deg,#c084fc,#7e22ce)', nm:'PYUSD', sub:'PayPal USD · Aptos', isNew:false, price:'$0.0023', vol:'Vol $290', c24:'+6.5' },
    { ic:'E', col:'linear-gradient(135deg,#fb7185,#be123c)', nm:'XDC', sub:'XDC Network · Aptos', isNew:false, price:'$0.014', vol:'Vol $260', c24:'+4.9' },
  ];

  function makeSpark(isUp) {
    const w = 90, h = 32;
    const pts = []; let v = 16;
    const trend = isUp ? 0.15 : -0.1;
    for (let i = 0; i < 24; i++) { v += (Math.random()-0.5+trend) * 2; pts.push(Math.max(3, Math.min(29, v))); }
    const min = Math.min(...pts), max = Math.max(...pts), rng = max-min || 1;
    const step = w/(pts.length-1);
    const P = pts.map((p,i) => [i*step, h-((p-min)/rng)*(h-6)-3]);
    const path = P.map((p,i) => (i===0?'M':'L')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
    const color = isUp ? 'var(--green)' : 'var(--red)';
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${path}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  const tList = document.getElementById('trendingList');

  function renderTrending(period) {
    let data;
    if (period === '7d') {
      // Reorder + amplify changes for a "7 days" view
      data = trending.slice().map(t => {
        const v = parseFloat(t.c24);
        const c7 = (v * 2.3 + (v >= 0 ? 4.2 : -3.1)).toFixed(1);
        const subWindow = t.vol.replace('Vol $', '');
        return { ...t, c24: c7, vol: 'Vol $' + subWindow.replace('K','K').replace(/\d+/, n => Math.round(parseFloat(n) * 4.2)), label: '7d' };
      }).sort((a,b) => parseFloat(b.c24) - parseFloat(a.c24));
    } else if (period === '30d') {
      data = trending.slice().map(t => {
        const v = parseFloat(t.c24);
        const c30 = (v * 4.6 + (v >= 0 ? 12 : -8.5)).toFixed(1);
        const subWindow = t.vol.replace('Vol $', '');
        return { ...t, c24: c30, vol: 'Vol $' + subWindow.replace(/\d+/, n => Math.round(parseFloat(n) * 14)), label: '30d' };
      }).sort((a,b) => parseFloat(b.c24) - parseFloat(a.c24));
    } else {
      data = trending; // 24h default
    }

    tList.innerHTML = '';
    data.forEach((t, i) => {
      const c24 = parseFloat(t.c24);
      const isUp = c24 > 0;
      const rank = i + 1;
      const periodLbl = t.label || '24h';
      const div = document.createElement('div');
      div.className = 'trending-row';
      div.innerHTML = `
        <div class="rank ${rank<=3?'top':''}">#${rank}</div>
        <div class="ico" style="background:${t.col}">${t.ic}</div>
        <div class="info">
          <div class="nm-row">
            <span class="nm">${t.nm}</span>
            ${t.isNew ? '<span class="new-badge">NEW</span>' : ''}
          </div>
          <div class="sub">${t.sub} · ${t.vol}</div>
        </div>
        <div class="spark">${makeSpark(isUp)}</div>
        <div class="price">
          <div class="p1">${t.price}</div>
          <div class="p2"><span class="change-pill ${isUp?'up':'down'}">${isUp?'▲':'▼'} ${Math.abs(c24)}%</span></div>
        </div>
        <button class="trade-btn">Trade</button>
      `;
      tList.appendChild(div);
    });
  }

  // Hook up trending tabs (24h / 7d / 30d)
  (function(){
    const card = document.getElementById('trendingList').closest('.market-card');
    if (!card) return;
    const badge = card.querySelector('.market-head .badge');
    const tabs = card.querySelectorAll('.tf-mini button');
    tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        const label = btn.textContent.trim();
        tabs.forEach(b => b.classList.toggle('active', b === btn));
        if (badge) badge.textContent = 'Past ' + label;
        const period = label.toLowerCase();
        renderTrending(period);
      });
    });
  })();

  renderTrending('24h');

  // ============ Live activity ============
  const activity = [
    { type:'launch', html:'<span class="hl">MOD</span> launched on Aptos', meta:'Supply 500M · 90% in LP', time:'8s' },
    { type:'swap', html:'Swap <span class="hl">$6,120 CELL</span>', meta:'via Aptos DEX · slippage 0.12%', time:'24s' },
    { type:'bridge', html:'Bridged <span class="hl">2,400 APT → Aptos</span>', meta:'0x0baf…90d0 → rN9…Kj3n', time:'1m' },
    { type:'lp', html:'New LP added to <span class="hl">LUMOS/APT</span>', meta:'+1,840 APT · +152K LUMOS', time:'2m' },
    { type:'launch', html:'<span class="hl">XDC</span> launched on Aptos', meta:'Supply 1B · 85% in LP', time:'3m' },
    { type:'swap', html:'Swap <span class="hl">$1,240 GUI</span>', meta:'via AMM pool · slippage 0.08%', time:'4m' },
    { type:'lp', html:'New LP added to <span class="hl">MESO/APT</span>', meta:'+820 APT · +12.4M MESO', time:'5m' },
    { type:'swap', html:'Swap <span class="hl">$2,400 AMI</span>', meta:'via Aptos DEX · slippage 0.18%', time:'6m' },
    { type:'launch', html:'<span class="hl">XDC</span> launched on Aptos', meta:'Supply 250M · 80% in LP', time:'7m' },
    { type:'bridge', html:'Bridged <span class="hl">5,800 APT → Aptos</span>', meta:'0x0d3b…f162 → rPbT…M9zw', time:'9m' },
    { type:'swap', html:'Swap <span class="hl">$840 MOD</span>', meta:'via AMM pool · slippage 0.42%', time:'12m' },
    { type:'lp', html:'New LP added to <span class="hl">RION/APT</span>', meta:'+2,300 APT · +98K RION', time:'14m' },
    { type:'launch', html:'<span class="hl">RION</span> launched on Aptos', meta:'Supply 100M · 90% in LP', time:'18m' },
  ];
  const icons = {
    launch: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.9 12.9 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>',
    swap: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
    bridge: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9 1.5 12 4 15"/><path d="M20 9l2.5 3L20 15"/><path d="M2.5 12h19"/></svg>',
    lp: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>'
  };
  const actList = document.getElementById('activityList');
  activity.forEach(a => {
    const div = document.createElement('div');
    div.className = 'activity-feed-row';
    div.innerHTML = `
      <div class="act-ic ${a.type}">${icons[a.type]}</div>
      <div class="info">
        <div class="type">${a.html}</div>
        <div class="meta">${a.meta}</div>
      </div>
      <div class="time">${a.time}</div>
    `;
    actList.appendChild(div);
  });

  // ---------- Search popup ----------
  (function(){
    const popup = document.getElementById('searchPopup');
    if (!popup) return;
    const input = document.getElementById('spSearchInput');
    const assetList = document.getElementById('spAssetList');
    const assetCount = document.getElementById('spAssetCount');
    const userList = document.getElementById('spUserList');
    const filterBtns = document.querySelectorAll('#spFilters .sp-filter-pill');
    const clearBtn = document.getElementById('spClearFilter');

    // Sample dataset for the popup (decoupled from other page data)
    const allAssets = [
      { chain:'stellar', tk:'LUMOS',  nm:'LUMOS',  domain:'lumosdao.io', ic:'L', col:'#ea6a2c', price:'0.000713 APT', priceUsd:'$0.000108725', mc:'$1.09M', c24:'-7.12', addr:'0x049d…db14' },
      { chain:'stellar', tk:'CELL',   nm:'Cellana', domain:null, ic:'A', col:'#6f5ded', price:'0.0042 APT',     priceUsd:'$0.00173', mc:'$48.2M', c24:'+24.8', addr:'0x0f71…010b' },
      { chain:'stellar', tk:'USDC',   nm:'USD Coin', domain:'circle.com', ic:'U', col:'#2775ca', price:'0.7449 APT', priceUsd:'$1.00', mc:'$5.1M', c24:'+0.01', addr:'0x093b…7d94' },
      { chain:'stellar', tk:'GUI',   nm:'Gui Inu', domain:null, ic:'K', col:'#f5a623', price:'0.018 APT', priceUsd:'$0.0074', mc:'$2.4M', c24:'+12.4', addr:'0x06bf…5407' },
      { chain:'stellar', tk:'MOD',   nm:'Move Dollar', domain:null, ic:'N', col:'#6b4ff2', price:'0.0₄17 APT', priceUsd:'$0.0₅22', mc:'$298K', c24:'+184', addr:'0x04e3…248c', isNew:true },
      { chain:'stellar', tk:'APT',    nm:'Aptos Coin', domain:'aptosfoundation.org', ic:'X', col:'#000000', price:'1.00 APT', priceUsd:'$0.4128', mc:'$12.6B', c24:'+2.34', addr:'native' },
      { chain:'stellar', tk:'RION',   nm:'Hyperion', domain:null, ic:'G', col:'#8b5cf6', price:'0.024 APT', priceUsd:'$0.0099', mc:'$1.8M', c24:'+15.7', addr:'0x0801…bef7' },
      { chain:'xrpl', tk:'LUMOS',     nm:'LUMOS',  domain:'lumosdao.io', ic:'L', col:'#ea6a2c', price:'0.4128 aBTC', priceUsd:'$0.928', mc:'$2.1M', c24:'-3.4', addr:'0x0501…10c5' },
      { chain:'xrpl', tk:'aBTC',       nm:'aBTC', domain:'echo-protocol.xyz', ic:'X', col:'#f7931a', price:'1.00 aBTC', priceUsd:'$2.18', mc:'$124B', c24:'+3.4', addr:'native' },
      { chain:'xrpl', tk:'MOD',      nm:'Move Dollar', domain:'thala.fi', ic:'S', col:'#6b4ff2', price:'0.0651 aBTC', priceUsd:'$0.142', mc:'$94M', c24:'+8.6', addr:'0x0751…3064' },
      { chain:'xrpl', tk:'MOD',       nm:'Move Dollar', domain:null, ic:'C', col:'#6b4ff2', price:'0.000962 aBTC', priceUsd:'$0.0021', mc:'$1.2M', c24:'+18.2', addr:'0x0d6d…5929' },
      { chain:'xrpl', tk:'GUI',       nm:'Gui Inu', domain:null, ic:'E', col:'#f5a623', price:'0.0011 aBTC', priceUsd:'$0.0024', mc:'$420K', c24:'+9.1', addr:'0x01f0…cde2' },
    ];

    let activeFilter = null;
    let currentQuery = '';

    function open() {
      popup.classList.add('open');
      document.body.style.overflow = 'hidden';
      setTimeout(() => input.focus(), 50);
      render();
    }
    function close() {
      popup.classList.remove('open');
      document.body.style.overflow = '';
      input.value = '';
      currentQuery = '';
      activeFilter = null;
      filterBtns.forEach(b => b.classList.remove('active'));
      clearBtn.style.display = 'none';
    }
    window._openSearchPopup = open;
    window._closeSearchPopup = close;

    function render() {
      const q = currentQuery.toLowerCase().trim();
      // Filter
      let assets = allAssets;
      if (activeFilter) assets = assets.filter(a => a.chain === activeFilter);
      if (q) {
        assets = assets.filter(a =>
          a.tk.toLowerCase().includes(q) ||
          a.nm.toLowerCase().includes(q) ||
          (a.domain || '').toLowerCase().includes(q)
        );
      }
      // Render asset count
      assetCount.textContent = `(${assets.length})`;
      // Build HTML
      if (assets.length === 0) {
        assetList.innerHTML = '<div class="sp-empty">No assets match your search.</div>';
      } else {
        assetList.innerHTML = assets.map(a => {
          const c = parseFloat(a.c24);
          const isUp = c >= 0;
          const newBadge = a.isNew ? '<span style="font-size:11px;padding:2px 5px;border-radius:3px;background:var(--green-soft);color:var(--green);font-weight:800;letter-spacing:0.3px">NEW</span>' : '';
          const domainBadge = a.domain ? `<span class="sp-domain">${a.domain}</span>` : '';
          return `
            <div class="sp-row sp-row--asset" data-chain="${a.chain}">
              <div class="sp-ico" style="background:${a.col}">${a.ic}</div>
              <div class="sp-info">
                <div class="sp-name-row">${a.tk} ${domainBadge} ${newBadge}</div>
                <div class="sp-sub">${a.priceUsd} · MC: ${a.mc}</div>
              </div>
              <div class="sp-right">
                <div class="sp-price">${a.price}</div>
                <div class="sp-change ${isUp?'up':'down'}">${isUp?'+':''}${a.c24}%</div>
                <div class="sp-addr-mini" data-copy="${a.addr}" data-copy-label="${a.tk} address">${a.addr === 'native' ? 'Native' : a.addr} <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Wire input
    input.addEventListener('input', (e) => {
      currentQuery = e.target.value;
      render();
    });

    // Wire filter pills
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const chain = btn.dataset.chain;
        if (activeFilter === chain) {
          // Deselect
          activeFilter = null;
          btn.classList.remove('active');
        } else {
          activeFilter = chain;
          filterBtns.forEach(b => b.classList.toggle('active', b === btn));
        }
        clearBtn.style.display = activeFilter ? '' : 'none';
        render();
      });
    });

    // Clear filter
    clearBtn.addEventListener('click', () => {
      activeFilter = null;
      filterBtns.forEach(b => b.classList.remove('active'));
      clearBtn.style.display = 'none';
      render();
    });

    // Close on overlay click
    popup.addEventListener('click', (e) => {
      if (e.target === popup) close();
    });

    // Escape closes
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && popup.classList.contains('open')) close();
      // Cmd/Ctrl + K opens
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        open();
      }
    });

    // Hook up all search-box inputs and landing hero-search input across the page
    function attachToSearch(el) {
      if (!el) return;
      // The input itself opens on focus / click
      el.addEventListener('focus', (e) => { e.preventDefault(); el.blur(); open(); });
      el.addEventListener('click', (e) => { e.preventDefault(); open(); });
    }
    // Find any search input
    document.querySelectorAll('.search-box input, .hero-search input').forEach(attachToSearch);
    // Also any container clicks
    document.querySelectorAll('.search-box, .hero-search').forEach(wrapper => {
      wrapper.addEventListener('click', (e) => {
        if (e.target.closest('input')) return;
        open();
      });
    });
  })();
