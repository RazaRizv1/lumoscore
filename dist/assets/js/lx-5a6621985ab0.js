
// Hero chart — hover-aware (desktop)
(function(){
  const wrap = document.getElementById('heroChart');
  if (!wrap) return;
  const W = 600, H = 100;

  const config = {
    '1D':  { points: 24, vol: 1.6, seed: 11, axis: ['12 AM','6 AM','12 PM','Now'], mini: 'past 24 hours' },
    '1W':  { points: 30, vol: 2.8, seed: 7,  axis: ['May 16','May 18','May 20','May 22','Today'], mini: 'past 7 days' },
    '1M':  { points: 30, vol: 3.4, seed: 23, axis: ['Apr 23','Apr 30','May 14','Today'], mini: 'past 30 days' },
    '1Y':  { points: 40, vol: 5.2, seed: 37, axis: ['Jun','Sep','Dec','Mar','May'], mini: 'past year' },
    'ALL': { points: 50, vol: 7.0, seed: 43, axis: ['2023','2024','2025','2026'], mini: 'all-time' },
  };
  const BASE_VALUE = 31108.45;

  function makeRng(seed) { let s = seed; return function(){ s=(s*9301+49297)%233280; return s/233280; }; }

  let state = null;

  function render(period) {
    const c = config[period] || config['1W'];
    const rng = makeRng(c.seed);
    const pts = []; let v = 50;
    for (let i = 0; i < c.points; i++) {
      v += (rng() - 0.4) * c.vol + 0.5;
      pts.push(Math.max(20, Math.min(90, v)));
    }
    const min = Math.min(...pts), max = Math.max(...pts), r = max - min || 1;
    const step = W / (pts.length - 1);
    const P = pts.map((p,i) => [i*step, H - ((p-min)/r)*(H-16) - 8]);
    const line = P.map((p,i) => (i===0?'M':'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = line + ` L ${W} ${H} L 0 ${H} Z`;
    const lastP = P[P.length-1];
    const valAt = pts.map(p => BASE_VALUE * (0.94 + ((p - min) / r) * 0.18));

    wrap.innerHTML =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" width="100%" height="100%" style="display:block">' +
        '<defs><linearGradient id="hg" x1="0" x2="0" y1="0" y2="1">' +
          '<stop offset="0%" stop-color="#35c07f" stop-opacity="0.35"/>' +
          '<stop offset="100%" stop-color="#35c07f" stop-opacity="0"/>' +
        '</linearGradient></defs>' +
        '<path d="' + area + '" fill="url(#hg)"/>' +
        '<path d="' + line + '" fill="none" stroke="#35c07f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<line id="chartCursor" x1="0" y1="0" x2="0" y2="' + H + '" stroke="#35c07f" stroke-width="1" stroke-dasharray="3 3" opacity="0"/>' +
        '<circle id="chartCursorDot" r="4" fill="#35c07f" stroke="var(--surface)" stroke-width="2" opacity="0"/>' +
        '<circle cx="' + lastP[0] + '" cy="' + lastP[1] + '" r="3.5" fill="#35c07f"/>' +
        '<circle cx="' + lastP[0] + '" cy="' + lastP[1] + '" r="7" fill="#35c07f" opacity="0.25"/>' +
        '<rect id="chartHit" x="0" y="0" width="' + W + '" height="' + H + '" fill="transparent"/>' +
      '</svg>' +
      '<div class="chart-tooltip" id="chartTooltip"><span class="ct-val" id="ctVal">—</span><div class="ct-date" id="ctDate">—</div></div>';

    const axis = wrap.parentElement.querySelector('.chart-axis');
    if (axis) axis.innerHTML = c.axis.map(l => '<span>' + l + '</span>').join('');

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
      const frac = idx / (state.P.length - 1);
      const ai = Math.round(frac * (state.axis.length - 1));
      ctDate.textContent = state.axis[ai] || '';
      const leftPx = (px / W) * rect.width;
      tip.style.left = Math.max(40, Math.min(rect.width - 40, leftPx)) + 'px';
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
    hit.addEventListener('pointermove', e => show(e.clientX));
    hit.addEventListener('pointerleave', hide);
  }

  // Wire timeframe tabs (1D/1W/1M/1Y/ALL)
  function wireTabs() {
    const tabs = wrap.parentElement.querySelectorAll('.tf-btn');
    tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        tabs.forEach(b => b.classList.toggle('active', b === btn));
        render(btn.textContent.trim());
      });
    });
  }

  wireTabs();
  render('1W');
})();
