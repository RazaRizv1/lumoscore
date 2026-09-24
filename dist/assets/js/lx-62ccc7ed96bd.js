
  // ===== Generate radiating starburst rays =====
  (function(){
    const g = document.querySelector('.hero-rays-rotate');
    if (!g) return;
    const svgNS = 'http://www.w3.org/2000/svg';
    const cx = 800, cy = 800;
    const numRays = 90;
    const outerR = 900;
    for (let i = 0; i < numRays; i++) {
      const angle = (i / numRays) * Math.PI * 2;
      const lenVar = 0.6 + Math.random() * 0.5;
      const x2 = cx + Math.cos(angle) * outerR * lenVar;
      const y2 = cy + Math.sin(angle) * outerR * lenVar;
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', cx); line.setAttribute('y1', cy);
      line.setAttribute('x2', x2); line.setAttribute('y2', y2);
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

  // ===== Slide menu =====
  (function(){
    const overlay = document.getElementById('menuOverlay');
    const menu = document.getElementById('slideMenu');
    const openBtn = document.getElementById('menuBtn');
    const closeBtn = document.getElementById('menuClose');
    function open(){ overlay.classList.add('open'); menu.classList.add('open'); document.body.style.overflow = 'hidden'; }
    function close(){ overlay.classList.remove('open'); menu.classList.remove('open'); document.body.style.overflow = ''; }
    openBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', close);
    menu.querySelectorAll('a').forEach(a => a.addEventListener('click', close));
  })();

  // (old theme toggle removed)

  // ===== Trending tokens =====
  const trendingByChain = {
    stellar: [
      { ic:'A', col:'linear-gradient(135deg,#22d3ee,#0891b2)', nm:'CELL', sub:'Cellana', price:'$0.0042', isNew:false, c24:'+24.8' },
      { ic:'K', col:'linear-gradient(135deg,#35c07f,#16a34a)', nm:'GUI', sub:'Gui Inu', price:'$0.018', isNew:false, c24:'+12.4' },
      { ic:'L', col:'linear-gradient(135deg,#ea6a2c,#ff9a3d)', nm:'LUMOS', sub:'LumosCore', price:'$0.0032', isNew:false, c24:'+5.6' },
      { ic:'N', col:'linear-gradient(135deg,#a855f7,#6d28d9)', nm:'MOD', sub:'Just launched', price:'$0.0001', isNew:true, c24:'+184' },
      { ic:'S', col:'linear-gradient(135deg,#8b5cf6,#6d28d9)', nm:'MESO', sub:'Stronghold', price:'$0.0067', isNew:false, c24:'-3.2' },
      { ic:'X', col:'linear-gradient(135deg,#2a2a35,#1a1a23)', nm:'APT', sub:'Aptos Coin', price:'$0.4128', isNew:false, c24:'+2.3' },
      { ic:'G', col:'linear-gradient(135deg,#10b981,#047857)', nm:'RION', sub:'Hyperion', price:'$0.024', isNew:false, c24:'+15.7' },
    ],
    xrpl: [
      { ic:'X', col:'linear-gradient(135deg,#000,#3b3b3b)', nm:'aBTC', sub:'Ripple', price:'$2.18', isNew:false, c24:'+3.4' },
      { ic:'S', col:'linear-gradient(135deg,#0ea5e9,#0369a1)', nm:'MOD', sub:'Move Dollar', price:'$0.142', isNew:false, c24:'+8.6' },
      { ic:'C', col:'linear-gradient(135deg,#35c07f,#16a34a)', nm:'MOD', sub:'Move Dollar', price:'$0.0021', isNew:false, c24:'+18.2' },
      { ic:'E', col:'linear-gradient(135deg,#f43f5e,#be123c)', nm:'GUI', sub:'Gui Inu', price:'$0.0024', isNew:false, c24:'+9.1' },
      { ic:'M', col:'linear-gradient(135deg,#fbbf24,#d97706)', nm:'XDC', sub:'Just launched', price:'$0.00008', isNew:true, c24:'+92.4' },
    ],
  };

  function makeSparkBig(isUp) {
    const w = 280, h = 38;
    const pts = []; let v = 19;
    const trend = isUp ? 0.18 : -0.14;
    for (let i = 0; i < 28; i++) { v += (Math.random()-0.5+trend) * 2; pts.push(Math.max(4, Math.min(34, v))); }
    const min = Math.min(...pts), max = Math.max(...pts), rng = max-min || 1;
    const step = w/(pts.length-1);
    const P = pts.map((p,i) => [i*step, h-((p-min)/rng)*(h-8)-4]);
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
      <path d="${line}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${lastP[0]}" cy="${lastP[1]}" r="2.5" fill="${color}"/>
    </svg>`;
  }

  function makeSpark(isUp) {
    const w = 70, h = 24;
    const pts = []; let v = 12;
    const trend = isUp ? 0.15 : -0.12;
    for (let i = 0; i < 20; i++) { v += (Math.random()-0.5+trend) * 1.4; pts.push(Math.max(3, Math.min(21, v))); }
    const min = Math.min(...pts), max = Math.max(...pts), rng = max-min || 1;
    const step = w/(pts.length-1);
    const P = pts.map((p,i) => [i*step, h-((p-min)/rng)*(h-6)-3]);
    const path = P.map((p,i) => (i===0?'M':'L')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
    const color = isUp ? 'var(--green)' : 'var(--red)';
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${path}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function renderTrending(chain) {
    const featured = document.getElementById('trendingFeatured') || document.createElement('div');
    const rest = document.getElementById('trendingRest') || document.createElement('div');
    featured.innerHTML = '';
    rest.innerHTML = '';
    const items = trendingByChain[chain] || [];
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
            <div class="tr-card-name">${t.nm}${t.isNew ? '<span class="new-badge">NEW</span>' : ''}</div>
            <div class="tr-card-sub">${t.sub}</div>
          </div>
        </div>
        <div class="tr-card-spark">${makeSparkBig(isUp)}</div>
        <div class="tr-card-bottom">
          <div class="tr-card-price">${t.price}</div>
          <div class="tr-card-change ${isUp?'up':'down'}">${isUp?'▲':'▼'} ${Math.abs(c24)}%</div>
        </div>
      `;
      featured.appendChild(div);
    });
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
          <div class="nm-row"><span class="nm">${t.nm}</span>${t.isNew ? '<span class="new-badge">NEW</span>' : ''}</div>
          <div class="sub">${t.sub}</div>
        </div>
        <div class="price">
          <div class="p1">${t.price}</div>
          <div class="p2"><span class="change-pill ${isUp?'up':'down'}">${isUp?'▲':'▼'} ${Math.abs(c24)}%</span></div>
        </div>
      `;
      rest.appendChild(div);
    });
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
