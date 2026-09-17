
  // ===== Theme toggle =====
  const root = document.documentElement;
  const themeBtn = document.getElementById('themeToggle');
  const SUN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  const XDC = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  themeBtn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    themeBtn.innerHTML = next === 'dark' ? SUN : XDC;
  });

  // ===== Generate radiating starburst rays =====
  (function(){
    const g = document.querySelector('.hero-rays-rotate');
    if (!g) return;
    const svgNS = 'http://www.w3.org/2000/svg';
    const cx = 800, cy = 800;
    const numRays = 110;
    const innerR = 0; // converge to single point
    const outerR = 900;
    for (let i = 0; i < numRays; i++) {
      const angle = (i / numRays) * Math.PI * 2;
      const x1 = cx + Math.cos(angle) * innerR;
      const y1 = cy + Math.sin(angle) * innerR;
      // Vary ray length slightly so it looks more organic
      const lenVar = 0.6 + Math.random() * 0.5;
      const x2 = cx + Math.cos(angle) * outerR * lenVar;
      const y2 = cy + Math.sin(angle) * outerR * lenVar;
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
      let cls = 'ray';
      if (i % 5 === 0) cls += ' alt';
      if (i % 3 === 0) cls += ' faint';
      line.setAttribute('class', cls);
      g.appendChild(line);
    }
  })();

  // ===== Sticky header on scroll =====
  (function(){
    const nav = document.getElementById('siteNav');
    if (!nav) return;
    const onScroll = () => {
      if (window.scrollY > 40) nav.classList.add('is-stuck');
      else nav.classList.remove('is-stuck');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  })();

  // ===== Trending tokens (separated by chain) =====
  const trendingByChain = {
    stellar: [
      { ic:'A', col:'linear-gradient(135deg,#22d3ee,#0891b2)', nm:'CELL', sub:'Cellana', price:'$0.0042', isNew:false, c24:'+24.8', trades:'2,847', vol:'$18.4K' },
      { ic:'K', col:'linear-gradient(135deg,#35c07f,#16a34a)', nm:'GUI', sub:'Gui Inu', price:'$0.018', isNew:false, c24:'+12.4', trades:'1,624', vol:'$11.2K' },
      { ic:'L', col:'linear-gradient(135deg,#ea6a2c,#ff9a3d)', nm:'LUMOS', sub:'LumosCore', price:'$0.0032', isNew:false, c24:'+5.6', trades:'1,128', vol:'$8.4K' },
      { ic:'N', col:'linear-gradient(135deg,#a855f7,#6d28d9)', nm:'MOD', sub:'Just launched', price:'$0.0001', isNew:true, c24:'+184', trades:'948', vol:'$4.2K' },
      { ic:'S', col:'linear-gradient(135deg,#8b5cf6,#6d28d9)', nm:'MESO', sub:'Stronghold', price:'$0.0067', isNew:false, c24:'-3.2', trades:'742', vol:'$3.8K' },
      { ic:'X', col:'linear-gradient(135deg,#2a2a35,#1a1a23)', nm:'APT', sub:'Aptos Coin', price:'$0.4128', isNew:false, c24:'+2.3', trades:'612', vol:'$2.9K' },
      { ic:'G', col:'linear-gradient(135deg,#10b981,#047857)', nm:'RION', sub:'Hyperion', price:'$0.024', isNew:false, c24:'+15.7', trades:'487', vol:'$2.1K' },
    ],
    xrpl: [
      { ic:'X', col:'linear-gradient(135deg,#000,#3b3b3b)', nm:'aBTC', sub:'Ripple', price:'$2.18', isNew:false, c24:'+3.4', trades:'3,142', vol:'$24.6K' },
      { ic:'S', col:'linear-gradient(135deg,#0ea5e9,#0369a1)', nm:'MOD', sub:'Move Dollar', price:'$0.142', isNew:false, c24:'+8.6', trades:'1,840', vol:'$12.8K' },
      { ic:'C', col:'linear-gradient(135deg,#35c07f,#16a34a)', nm:'MOD', sub:'Move Dollar', price:'$0.0021', isNew:false, c24:'+18.2', trades:'1,206', vol:'$6.2K' },
      { ic:'E', col:'linear-gradient(135deg,#f43f5e,#be123c)', nm:'GUI', sub:'Gui Inu', price:'$0.0024', isNew:false, c24:'+9.1', trades:'682', vol:'$3.4K' },
      { ic:'M', col:'linear-gradient(135deg,#fbbf24,#d97706)', nm:'XDC', sub:'Just launched', price:'$0.00008', isNew:true, c24:'+92.4', trades:'412', vol:'$1.8K' },
    ],
  };

  function makeSpark(isUp) {
    const w = 90, h = 30;
    const pts = []; let v = 15;
    const trend = isUp ? 0.15 : -0.1;
    for (let i = 0; i < 24; i++) { v += (Math.random()-0.5+trend) * 1.8; pts.push(Math.max(3, Math.min(27, v))); }
    const min = Math.min(...pts), max = Math.max(...pts), rng = max-min || 1;
    const step = w/(pts.length-1);
    const P = pts.map((p,i) => [i*step, h-((p-min)/rng)*(h-6)-3]);
    const path = P.map((p,i) => (i===0?'M':'L')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
    const color = isUp ? 'var(--green)' : 'var(--red)';
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${path}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function makeSparkBig(isUp) {
    const w = 300, h = 52;
    const pts = []; let v = 26;
    const trend = isUp ? 0.18 : -0.14;
    for (let i = 0; i < 32; i++) { v += (Math.random()-0.5+trend) * 2.5; pts.push(Math.max(6, Math.min(46, v))); }
    const min = Math.min(...pts), max = Math.max(...pts), rng = max-min || 1;
    const step = w/(pts.length-1);
    const P = pts.map((p,i) => [i*step, h-((p-min)/rng)*(h-10)-5]);
    const line = P.map((p,i) => (i===0?'M':'L')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
    const area = line + ` L ${w} ${h} L 0 ${h} Z`;
    const lastP = P[P.length-1];
    const color = isUp ? 'var(--green)' : 'var(--red)';
    const gradId = 'g' + Math.random().toString(36).slice(2,8);
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <defs><linearGradient id="${gradId}" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="${area}" fill="url(#${gradId})"/>
      <path d="${line}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${lastP[0]}" cy="${lastP[1]}" r="3" fill="${color}"/>
    </svg>`;
  }

  function renderTrending(chain) {
    const featured = document.getElementById('trendingFeatured') || document.createElement('div');
    const rest = document.getElementById('trendingRest') || document.createElement('div');
    featured.innerHTML = '';
    rest.innerHTML = '';
    const items = trendingByChain[chain] || [];

    // Top 3 → featured cards
    const top3 = items.slice(0, 3);
    top3.forEach((t, i) => {
      const c24 = parseFloat(t.c24);
      const isUp = c24 > 0;
      const rank = i + 1;
      const div = document.createElement('div');
      div.className = 'tr-card';
      div.innerHTML = `
        <div class="tr-rank-ribbon">#${rank}</div>
        <div class="tr-card-head">
          <div class="tr-card-ico" style="background:${t.col}">${t.ic}</div>
          <div class="tr-card-meta">
            <div class="tr-card-name">
              ${t.nm}
              ${t.isNew ? '<span class="new-badge">NEW</span>' : ''}
            </div>
            <div class="tr-card-sub">${t.sub}</div>
          </div>
        </div>
        <div class="tr-card-spark">${makeSparkBig(isUp)}</div>
        <div class="tr-card-stats">
          <div class="tr-card-stat"><div class="k">Trades 24h</div><div class="v">${t.trades}</div></div>
          <div class="tr-card-stat"><div class="k">Volume 24h</div><div class="v">${t.vol}</div></div>
        </div>
        <div class="tr-card-bottom">
          <div class="tr-card-price">${t.price}</div>
          <div class="tr-card-change ${isUp?'up':'down'}">${isUp?'▲':'▼'} ${Math.abs(c24)}%</div>
        </div>
      `;
      featured.appendChild(div);
    });

    // Ranks 4+ → condensed list rows
    const restItems = items.slice(3);
    restItems.forEach((t, i) => {
      const c24 = parseFloat(t.c24);
      const isUp = c24 > 0;
      const rank = i + 4;
      const div = document.createElement('div');
      div.className = 'tr-list-row';
      div.innerHTML = `
        <div class="tr-rank">#${rank}</div>
        <div class="ico" style="background:${t.col}">${t.ic}</div>
        <div class="info">
          <div class="nm-row">
            <span class="nm">${t.nm}</span>
            ${t.isNew ? '<span class="new-badge">NEW</span>' : ''}
          </div>
          <div class="sub">${t.sub} · ${t.trades} trades · ${t.vol} vol</div>
        </div>
        <div class="spark">${makeSpark(isUp)}</div>
        <div class="price">
          <div class="p1">${t.price}</div>
          <div class="p2"><span class="change-pill ${isUp?'up':'down'}">${isUp?'▲':'▼'} ${Math.abs(c24)}%</span></div>
        </div>
      `;
      rest.appendChild(div);
    });

    // Hide the rest container if empty
    rest.style.display = restItems.length ? '' : 'none';
  }

  renderTrending('stellar');

  document.querySelectorAll('.chain-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('disabled')) return;
      document.querySelectorAll('.chain-tab').forEach(b => b.classList.toggle('active', b === btn));
      renderTrending(btn.dataset.chain);
    });
  });

  // ===== Animated counters =====
  function animateCounter(el) {
    const target = parseFloat(el.dataset.target);
    const isFloat = target % 1 !== 0;
    const dur = 1400;
    const start = performance.now();
    function tick(now){
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = target * eased;
      el.textContent = isFloat ? val.toFixed(1) : Math.round(val).toLocaleString();
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        animateCounter(e.target);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.4 });
  document.querySelectorAll('.counter').forEach(c => obs.observe(c));

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
      { chain:'stellar', tk:'LUMOS',  nm:'LUMOS',  domain:'lumosdao.io', ic:'L', col:'#ea6a2c', price:'0.000713 APT', priceUsd:'$0.000108725', mc:'$1.09M', c24:'-7.12', addr:'0x00bf…3f5f' },
      { chain:'stellar', tk:'CELL',   nm:'Cellana', domain:null, ic:'A', col:'#6f5ded', price:'0.0042 APT',     priceUsd:'$0.00173', mc:'$48.2M', c24:'+24.8', addr:'0x0b85…967f' },
      { chain:'stellar', tk:'USDC',   nm:'USD Coin', domain:'circle.com', ic:'U', col:'#2775ca', price:'0.7449 APT', priceUsd:'$1.00', mc:'$5.1M', c24:'+0.01', addr:'0x0532…f3ab' },
      { chain:'stellar', tk:'GUI',   nm:'Gui Inu', domain:null, ic:'K', col:'#f5a623', price:'0.018 APT', priceUsd:'$0.0074', mc:'$2.4M', c24:'+12.4', addr:'0x03cc…2d0b' },
      { chain:'stellar', tk:'MOD',   nm:'Move Dollar', domain:null, ic:'N', col:'#6b4ff2', price:'0.0₄17 APT', priceUsd:'$0.0₅22', mc:'$298K', c24:'+184', addr:'0x0698…d5c7', isNew:true },
      { chain:'stellar', tk:'APT',    nm:'Aptos Coin', domain:'aptosfoundation.org', ic:'X', col:'#000000', price:'1.00 APT', priceUsd:'$0.4128', mc:'$12.6B', c24:'+2.34', addr:'native' },
      { chain:'stellar', tk:'RION',   nm:'Hyperion', domain:null, ic:'G', col:'#8b5cf6', price:'0.024 APT', priceUsd:'$0.0099', mc:'$1.8M', c24:'+15.7', addr:'0x0e41…ba4e' },
      { chain:'xrpl', tk:'LUMOS',     nm:'LUMOS',  domain:'lumosdao.io', ic:'L', col:'#ea6a2c', price:'0.4128 aBTC', priceUsd:'$0.928', mc:'$2.1M', c24:'-3.4', addr:'0x0a5e…e874' },
      { chain:'xrpl', tk:'aBTC',       nm:'aBTC', domain:'echo-protocol.xyz', ic:'X', col:'#f7931a', price:'1.00 aBTC', priceUsd:'$2.18', mc:'$124B', c24:'+3.4', addr:'native' },
      { chain:'xrpl', tk:'MOD',      nm:'Move Dollar', domain:'thala.fi', ic:'S', col:'#6b4ff2', price:'0.0651 aBTC', priceUsd:'$0.142', mc:'$94M', c24:'+8.6', addr:'0x0ae7…6894' },
      { chain:'xrpl', tk:'MOD',       nm:'Move Dollar', domain:null, ic:'C', col:'#6b4ff2', price:'0.000962 aBTC', priceUsd:'$0.0021', mc:'$1.2M', c24:'+18.2', addr:'0x047a…b57a' },
      { chain:'xrpl', tk:'GUI',       nm:'Gui Inu', domain:null, ic:'E', col:'#f5a623', price:'0.0011 aBTC', priceUsd:'$0.0024', mc:'$420K', c24:'+9.1', addr:'0x0683…536c' },
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
      const q = currentQuery.toLowerCase().trim(); if(!q&&!activeFilter){if(assetList)assetList.innerHTML='';if(assetCount)assetCount.textContent='';return;}
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
                <div class="sp-name-row">${a.tk} <span class="sp-net">${({stellar:'Stellar',hedera:'Hedera',aptos:'Aptos',starknet:'Starknet',vechain:'VeChain',worldchain:'World Chain',xrpl:'XRP Ledger'})[a.chain]||a.chain}</span> ${domainBadge} ${newBadge}</div>
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
