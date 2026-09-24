
  // ===== Dynamic time-of-day greeting =====
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

  // (old theme toggle JS removed; delegation handler at bottom of body)

  // ===== Trending tokens (25 entries) =====
  const trending = [
    { ic:'A', col:'linear-gradient(135deg,#22d3ee,#0891b2)', nm:'CELL', price:'$0.0042', vol:'Vol $8.2K', c24:'+24.8' },
    { ic:'K', col:'linear-gradient(135deg,#35c07f,#16a34a)', nm:'GUI', price:'$0.018', vol:'Vol $5.4K', c24:'+12.4' },
    { ic:'L', col:'linear-gradient(135deg,#ea6a2c,#ff9a3d)', nm:'LUMOS', price:'$0.0032', vol:'Vol $3.8K', c24:'+5.6' },
    { ic:'N', col:'linear-gradient(135deg,#a855f7,#6d28d9)', nm:'MOD', isNew:true, price:'$0.0001', vol:'Vol $1.4K', c24:'+184' },
    { ic:'Y', col:'linear-gradient(135deg,#f43f5e,#be123c)', nm:'AMI', price:'$0.274', vol:'Vol $2.9K', c24:'+3.8' },
    { ic:'S', col:'linear-gradient(135deg,#8b5cf6,#6d28d9)', nm:'MESO', price:'$0.0067', vol:'Vol $2.1K', c24:'-3.2' },
    { ic:'M', col:'linear-gradient(135deg,#fbbf24,#d97706)', nm:'XDC', isNew:true, price:'$0.00008', vol:'Vol $1.1K', c24:'+92.4' },
    { ic:'P', col:'linear-gradient(135deg,#ec4899,#be185d)', nm:'WBTC', price:'$0.000018', vol:'Vol $1.8K', c24:'+8.2' },
    { ic:'G', col:'linear-gradient(135deg,#10b981,#047857)', nm:'RION', price:'$0.024', vol:'Vol $1.6K', c24:'+15.7' },
    { ic:'D', col:'linear-gradient(135deg,#0ea5e9,#0369a1)', nm:'ETH', price:'$0.142', vol:'Vol $1.3K', c24:'-1.4' },
    { ic:'R', col:'linear-gradient(135deg,#ff894c,#c2410c)', nm:'MESO', price:'$0.087', vol:'Vol $1.2K', c24:'+6.8' },
    { ic:'C', col:'linear-gradient(135deg,#06b6d4,#0891b2)', nm:'PAXG', price:'$0.012', vol:'Vol $980', c24:'+4.2' },
    { ic:'F', col:'linear-gradient(135deg,#eab308,#a16207)', nm:'USDT', price:'$0.0148', vol:'Vol $870', c24:'+12.4' },
    { ic:'T', col:'linear-gradient(135deg,#84cc16,#4d7c0f)', nm:'ATOM', price:'$0.0034', vol:'Vol $740', c24:'-2.8' },
    { ic:'Z', col:'linear-gradient(135deg,#6f5ded,#1e40af)', nm:'LINK', price:'$0.056', vol:'Vol $680', c24:'+18.2' },
    { ic:'V', col:'linear-gradient(135deg,#ef4444,#991b1b)', nm:'GUI', price:'$0.0028', vol:'Vol $590', c24:'-4.6' },
    { ic:'O', col:'linear-gradient(135deg,#14b8a6,#0f766e)', nm:'CELL', price:'$0.092', vol:'Vol $540', c24:'+7.4' },
    { ic:'I', col:'linear-gradient(135deg,#a3e635,#65a30d)', nm:'MOD', price:'$0.018', vol:'Vol $520', c24:'+3.1' },
    { ic:'B', col:'linear-gradient(135deg,#f472b6,#db2777)', nm:'EURC', price:'$0.0067', vol:'Vol $470', c24:'+9.8' },
    { ic:'X', col:'linear-gradient(135deg,#6366f1,#4338ca)', nm:'DAI', price:'$0.234', vol:'Vol $420', c24:'-0.8' },
    { ic:'H', col:'linear-gradient(135deg,#fb923c,#ea580c)', nm:'WBTC', price:'$0.043', vol:'Vol $380', c24:'+5.3' },
    { ic:'Q', col:'linear-gradient(135deg,#22c55e,#15803d)', nm:'BTC', price:'$0.0096', vol:'Vol $340', c24:'+11.7' },
    { ic:'J', col:'linear-gradient(135deg,#facc15,#ca8a04)', nm:'RION', price:'$0.058', vol:'Vol $310', c24:'-1.2' },
    { ic:'W', col:'linear-gradient(135deg,#c084fc,#7e22ce)', nm:'PYUSD', price:'$0.0023', vol:'Vol $290', c24:'+6.5' },
    { ic:'E', col:'linear-gradient(135deg,#fb7185,#be123c)', nm:'XDC', price:'$0.014', vol:'Vol $260', c24:'+4.9' },
  ];
  function makeSpark(isUp) {
    const w = 58, h = 26;
    const pts = []; let v = 13;
    const trend = isUp ? 0.15 : -0.1;
    for (let i = 0; i < 22; i++) { v += (Math.random()-0.5+trend) * 1.6; pts.push(Math.max(3, Math.min(23, v))); }
    const min = Math.min(...pts), max = Math.max(...pts), rng = max-min || 1;
    const step = w/(pts.length-1);
    const P = pts.map((p,i) => [i*step, h-((p-min)/rng)*(h-6)-3]);
    const path = P.map((p,i) => (i===0?'M':'L')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
    const color = isUp ? 'var(--green)' : 'var(--red)';
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${path}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  const tList = document.getElementById('trendingList');
  function renderTrending(period) {
    let data;
    if (period === '7d') {
      data = trending.slice().map(t => {
        const v = parseFloat(t.c24);
        const c7 = (v * 2.3 + (v >= 0 ? 4.2 : -3.1)).toFixed(1);
        return { ...t, c24: c7, vol: 'Vol $' + (t.vol.replace('Vol $', '').replace(/[0-9.]+/, n => (parseFloat(n) * 4.2).toFixed(0))) };
      }).sort((a, b) => parseFloat(b.c24) - parseFloat(a.c24));
    } else if (period === '30d') {
      data = trending.slice().map(t => {
        const v = parseFloat(t.c24);
        const c30 = (v * 4.6 + (v >= 0 ? 12 : -8.5)).toFixed(1);
        return { ...t, c24: c30, vol: 'Vol $' + (t.vol.replace('Vol $', '').replace(/[0-9.]+/, n => (parseFloat(n) * 14).toFixed(0))) };
      }).sort((a, b) => parseFloat(b.c24) - parseFloat(a.c24));
    } else {
      data = trending;
    }
    tList.innerHTML = '';
    data.forEach((t, i) => {
      const c24 = parseFloat(t.c24);
      const isUp = c24 > 0;
      const rank = i + 1;
      const div = document.createElement('div');
      div.className = 'trending-row';
      div.innerHTML = `
        <div class="rank ${rank<=3?'top':''}">#${rank}</div>
        <div class="ico" style="background:${t.col}">${t.ic}</div>
        <div class="info">
          <div class="nm-row">
            <span class="nm">${t.nm}</span>
            ${t.isNew ? '<span class="new-badge">NEW</span>' : ''}
            <span class="change-pill ${isUp?'up':'down'}" style="margin-left:auto">${isUp?'▲':'▼'} ${Math.abs(c24)}%</span>
          </div>
          <div class="sub-row">
            <span class="price-mono">${t.price}</span>
            <span class="vol">· ${t.vol}</span>
          </div>
        </div>
        <div class="spark">${makeSpark(isUp)}</div>
      `;
      tList.appendChild(div);
    });
  }

  // Wire timeframe tabs (24h / 7d / 30d)
  (function() {
    const card = tList.closest('.market-card');
    if (!card) return;
    const badge = card.querySelector('.market-head .badge');
    const tabs = card.querySelectorAll('.tf-mini button');
    tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        const label = btn.textContent.trim();
        tabs.forEach(b => b.classList.toggle('active', b === btn));
        if (badge) badge.textContent = label;
        renderTrending(label.toLowerCase());
      });
    });
  })();

  renderTrending('24h');


  // ===== Live activity =====
  const activity = [
    { type:'launch', html:'<span class="hl">MOD</span> launched on Aptos', meta:'Supply 500M', time:'8s' },
    { type:'swap', html:'Swap <span class="hl">$6,120 CELL</span>', meta:'via Aptos DEX', time:'24s' },
    { type:'bridge', html:'Bridged <span class="hl">2,400 APT → Aptos</span>', meta:'0x0789…8107', time:'1m' },
    { type:'lp', html:'New LP added to <span class="hl">LUMOS/APT</span>', meta:'+1,840 APT', time:'2m' },
    { type:'launch', html:'<span class="hl">XDC</span> launched', meta:'Supply 1B', time:'3m' },
    { type:'swap', html:'Swap <span class="hl">$1,240 GUI</span>', meta:'via AMM pool', time:'4m' },
    { type:'lp', html:'New LP added to <span class="hl">MESO/APT</span>', meta:'+820 APT', time:'5m' },
    { type:'swap', html:'Swap <span class="hl">$2,400 AMI</span>', meta:'via Aptos DEX', time:'6m' },
    { type:'launch', html:'<span class="hl">XDC</span> launched', meta:'Supply 250M', time:'7m' },
    { type:'bridge', html:'Bridged <span class="hl">5,800 APT → Aptos</span>', meta:'0x0799…55d2', time:'9m' },
    { type:'swap', html:'Swap <span class="hl">$840 MOD</span>', meta:'via AMM pool', time:'12m' },
    { type:'lp', html:'New LP added to <span class="hl">RION/APT</span>', meta:'+2,300 APT', time:'14m' },
    { type:'launch', html:'<span class="hl">RION</span> launched', meta:'Supply 100M', time:'18m' },
  ];
  const icons = {
    launch: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.9 12.9 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>',
    swap: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
    bridge: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9 1.5 12 4 15"/><path d="M20 9l2.5 3L20 15"/><path d="M2.5 12h19"/></svg>',
    lp: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>'
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
