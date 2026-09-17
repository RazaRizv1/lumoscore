
  // Assets table
  const assets = [
    { ic:'X', col:'linear-gradient(135deg,#2a2a35,#1a1a23)', nm:'Aptos Coin', sb:'APT · native', p:'1.00 APT', p2:'≈ $0.4128', c24:'+2.34', xlm:'25,420.18 APT', usd:'≈ $10,493.45' },
    { ic:'$', col:'linear-gradient(135deg,#2775ca,#1a5491)', nm:'USD Coin', sb:'USDC · Circle', p:'2.41 APT', p2:'≈ $0.9964', c24:'0.00', xlm:'3,017.10 APT', usd:'1,250.40 USDC · ≈ $1,245.93' },
    { ic:'USDT', col:'linear-gradient(135deg,var(--accent),#ff9a3d)', nm:'Tether', sb:'USDT · Meme', p:'0.0359 APT', p2:'≈ $0.0148', c24:'+12.42', xlm:'2,113.51 APT', usd:'58,900 USDT · ≈ $871.72' },
    { ic:'PHX', col:'linear-gradient(135deg,#f43f5e,#be123c)', nm:'Wrapped Bitcoin', sb:'WBTC', p:'0.0₄13 APT', p2:'≈ $0.0₅18', c24:'-3.21', xlm:'523.45 APT', usd:'1.2M WBTC · ≈ $216.00' },
    { ic:'PAXG', col:'linear-gradient(135deg,#a855f7,#6d28d9)', nm:'PAX Gold', sb:'PAXG · Utility', p:'2.11 APT', p2:'≈ $0.87', c24:'+5.42', xlm:'51.02 APT', usd:'24.18 PAXG · ≈ $21.04' },
  ];
  const tbody = document.getElementById('assetsTable') || document.createElement('tbody');
  assets.forEach((a, i) => {
    const c24 = parseFloat(a.c24);
    const isUp = c24 > 0;
    const isZero = c24 === 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="asset-id">
          <div class="ico" style="background:${a.col}">${a.ic}</div>
          <div class="meta">
            <div class="nm">${a.nm}</div>
            <div class="sb">${a.sb}</div>
          </div>
        </div>
      </td>
      <td class="price-cell">
        <div class="p1">${a.p}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
          <span class="change-pill ${isUp ? 'up' : 'down'}" style="${isZero ? 'background:var(--bg);color:var(--text-muted)' : ''}">
            ${isUp ? '▲' : (isZero ? '—' : '▼')} ${isZero ? '0.00' : Math.abs(c24)}%
          </span>
          <span class="p2">${a.p2}</span>
        </div>
      </td>
      <td class="spark-cell"><svg viewBox="0 0 130 38" preserveAspectRatio="none"></svg></td>
      <td class="right balance-cell">
        <div class="b1">${a.xlm}</div>
        <div class="b2">${a.usd}</div>
      </td>
      <td class="right">
        <div class="row-quick-actions">
          <button class="qa-row-btn"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> Trade on DEX</button>
          <button class="qa-row-btn"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send</button>
          <button class="qa-row-btn icon-only"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
    const sp = tr.querySelector('.spark-cell svg');
    const trend = isUp ? 0.1 : (isZero ? 0 : -0.1);
    const sPts = []; let sv = 19;
    for (let j = 0; j < 30; j++) { sv += (Math.random()-0.5+trend) * 2.4; sPts.push(Math.max(4, Math.min(34, sv))); }
    const w = 130, h = 38;
    const smin = Math.min(...sPts), smax = Math.max(...sPts), srng = smax-smin || 1;
    const stp = w/(sPts.length-1);
    const SP = sPts.map((p,i) => [i*stp, h-((p-smin)/srng)*(h-8)-4]);
    const path = SP.map((p,i) => (i===0?'M':'L')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
    const ar = path + ` L ${w} ${h} L 0 ${h} Z`;
    const color = isZero ? '#a5a4ac' : (isUp ? '#35c07f' : '#ff5b5b');
    const gid = 'sg'+i;
    sp.innerHTML = `
      <defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="${ar}" fill="url(#${gid})"/>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    `;
  });

  // ---------- Asset tabs (Assets / Liq Pools) ----------
  (function(){
    const tabs = document.querySelectorAll('.asset-tabs button');
    const assetsCard = document.querySelector('.assets-card');
    const lpPanel = document.getElementById('lpPanel');
    if (!tabs.length || !assetsCard || !lpPanel) return;
    tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        const label = (btn.textContent || '').trim().toLowerCase();
        const isPools = label.startsWith('liq');
        tabs.forEach(b => b.classList.toggle('active', b === btn));
        assetsCard.style.display = isPools ? 'none' : '';
        lpPanel.style.display = isPools ? '' : 'none';
        if (isPools) { lpPanel.classList.add('lcm-on'); lpPanel.setAttribute('data-lcm-done',''); }
      });
    });
  })();

  // ---------- Toast utility + copy-to-clipboard wiring ----------
  (function(){
    let stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      document.body.appendChild(stack);
    }
    function showToast(msg) {
      const t = document.createElement('div');
      t.className = 'toast';
      t.innerHTML = '<span class="check-ic"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span><span>' + msg + '</span>';
      stack.appendChild(t);
      setTimeout(() => t.remove(), 2200);
    }
    window.showToast = showToast;

    // Auto-wire any copy buttons. A copy button is any element with:
    //   - class containing "copy" (button or svg.copy-i parent button), OR
    //   - data-tooltip="Copy" title="Copy" attribute
    // The data-copy-label attribute (or nearby text) determines what to show.
    function findCopyContext(el) {
      // Walk up to find the relevant value to copy (data-copy attribute on ancestor)
      let cur = el;
      for (let i = 0; i < 6 && cur; i++) {
        if (cur.dataset && cur.dataset.copyLabel) return cur.dataset.copyLabel;
        cur = cur.parentElement;
      }
      // Fallback: nearest .v / .mono / .addr text
      const wrap = el.closest('.detail-row, .wallet-row, .addr-row, .copy-wrap, .ws-addr');
      if (wrap) {
        const target = wrap.querySelector('.copy-target, .addr, .mono, .v, .v-mono, code');
        if (target) {
          return (target.textContent || '').trim().substring(0, 40);
        }
      }
      return null;
    }

    function isCopyTrigger(el) {
      if (!el) return false;
      if (el.matches && (el.matches('[data-copy]') || el.matches('[title="Copy"]'))) return true;
      // SVG class copy-i inside a button
      if (el.classList && el.classList.contains('copy-i')) return true;
      return false;
    }
  })();

  // ---------- Modal system ----------
  (function(){
    // Open modal helpers
    function openModal(id) {
      const m = document.getElementById(id);
      if (!m) return;
      m.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function closeModal(m) {
      m.classList.remove('open');
      document.body.style.overflow = '';
    }

    // Wire close buttons
    document.querySelectorAll('[data-modal]').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        // Click on overlay (not the inner modal) → close
        if (e.target === overlay) closeModal(overlay);
        // Click on element with data-close → close
        if (e.target.closest('[data-close]')) closeModal(overlay);
      });
    });

    // Escape key closes any open modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('[data-modal].open').forEach(m => closeModal(m));
      }
    });

    // Wire wallet quick-action buttons (Send/Receive/Swap/Trustlines)
    document.querySelectorAll('.quick-actions .qa-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const label = (btn.textContent || '').trim().toLowerCase();
        if (label.includes('send')) openModal('modalSend');
        else if (label.includes('receive')) openModal('modalReceive');
        else if (label.includes('swap')) openModal('modalSwap');
        else if (label.includes('trustlines')) openModal('modalTrustlines');
      });
    });

    // Asset table row "Send" / "Trade" buttons also use Send modal
    document.querySelectorAll('.qa-row-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const label = (btn.textContent || '').trim().toLowerCase();
        if (label === 'send') { e.preventDefault(); openModal('modalSend'); }
        else if (label === 'trade') { e.preventDefault(); openModal('modalSwap'); }
      });
    });

    // Trustline rows — toggle "Add"/"Added" state
    document.querySelectorAll('.tl-row .tl-action').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const row = btn.closest('.tl-row');
        const isAdded = row.classList.toggle('added');
        btn.textContent = isAdded ? 'Added' : 'Add';
        const assetName = row.querySelector('.tl-nm') ? row.querySelector('.tl-nm').childNodes[0].textContent.trim() : 'Trustline';
        if (window.showToast) {
          window.showToast(isAdded ? (assetName + ' trustline added') : (assetName + ' trustline removed'));
        }
      });
    });

    // Swap arrow — flip the two asset pickers visually
    document.querySelectorAll('.swap-arrow').forEach(arrow => {
      arrow.addEventListener('click', () => {
        const pair = arrow.closest('.swap-pair');
        const picks = pair.querySelectorAll('.asset-pick');
        if (picks.length === 2) {
          const a = picks[0].innerHTML;
          picks[0].innerHTML = picks[1].innerHTML;
          picks[1].innerHTML = a;
        }
      });
    });

    // Max button — fill amount with full balance (visually)
    document.querySelectorAll('.field-meta .pill-btn').forEach(btn => {
      if ((btn.textContent || '').trim() !== 'Max') return;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const field = btn.closest('.field');
        const input = field ? field.querySelector('input') : null;
        if (input) input.value = '25420.18';
      });
    });
  })();

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
      { chain:'stellar', tk:'LUMOS',  nm:'LUMOS',  domain:'lumosdao.io', ic:'L', col:'#ea6a2c', price:'0.000713 APT', priceUsd:'$0.000108725', mc:'$1.09M', c24:'-7.12', addr:'0x0dd2…cfb8' },
      { chain:'stellar', tk:'CELL',   nm:'Cellana', domain:null, ic:'A', col:'#6f5ded', price:'0.0042 APT',     priceUsd:'$0.00173', mc:'$48.2M', c24:'+24.8', addr:'0x0a5f…1b46' },
      { chain:'stellar', tk:'USDC',   nm:'USD Coin', domain:'circle.com', ic:'U', col:'#2775ca', price:'0.7449 APT', priceUsd:'$1.00', mc:'$5.1M', c24:'+0.01', addr:'0x0159…5919' },
      { chain:'stellar', tk:'GUI',   nm:'Gui Inu', domain:null, ic:'K', col:'#f5a623', price:'0.018 APT', priceUsd:'$0.0074', mc:'$2.4M', c24:'+12.4', addr:'0x0cb5…89f6' },
      { chain:'stellar', tk:'MOD',   nm:'Move Dollar', domain:null, ic:'N', col:'#6b4ff2', price:'0.0₄17 APT', priceUsd:'$0.0₅22', mc:'$298K', c24:'+184', addr:'0x0aec…38bc', isNew:true },
      { chain:'stellar', tk:'APT',    nm:'Aptos Coin', domain:'aptosfoundation.org', ic:'X', col:'#000000', price:'1.00 APT', priceUsd:'$0.4128', mc:'$12.6B', c24:'+2.34', addr:'native' },
      { chain:'stellar', tk:'RION',   nm:'Hyperion', domain:null, ic:'G', col:'#8b5cf6', price:'0.024 APT', priceUsd:'$0.0099', mc:'$1.8M', c24:'+15.7', addr:'0x0acf…836e' },
      { chain:'xrpl', tk:'LUMOS',     nm:'LUMOS',  domain:'lumosdao.io', ic:'L', col:'#ea6a2c', price:'0.4128 aBTC', priceUsd:'$0.928', mc:'$2.1M', c24:'-3.4', addr:'0x0d5a…148f' },
      { chain:'xrpl', tk:'aBTC',       nm:'aBTC', domain:'echo-protocol.xyz', ic:'X', col:'#f7931a', price:'1.00 aBTC', priceUsd:'$2.18', mc:'$124B', c24:'+3.4', addr:'native' },
      { chain:'xrpl', tk:'MOD',      nm:'Move Dollar', domain:'thala.fi', ic:'S', col:'#6b4ff2', price:'0.0651 aBTC', priceUsd:'$0.142', mc:'$94M', c24:'+8.6', addr:'0x0d28…cbc9' },
      { chain:'xrpl', tk:'MOD',       nm:'Move Dollar', domain:null, ic:'C', col:'#6b4ff2', price:'0.000962 aBTC', priceUsd:'$0.0021', mc:'$1.2M', c24:'+18.2', addr:'0x038e…019b' },
      { chain:'xrpl', tk:'GUI',       nm:'Gui Inu', domain:null, ic:'E', col:'#f5a623', price:'0.0011 aBTC', priceUsd:'$0.0024', mc:'$420K', c24:'+9.1', addr:'0x0b87…23d3' },
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

  // ---------- Cancel order confirmation ----------
  (function(){
    const modal = document.getElementById('modalCancelOrder');
    if (!modal) return;
    const titleEl = document.getElementById('cancelOrderTitle');
    const textEl = document.getElementById('cancelOrderText');
    const detailsEl = document.getElementById('cancelOrderDetails');
    const btnLabel = document.getElementById('cancelOrderBtnLabel');
    const keepSuffix = document.getElementById('cancelOrderKeepSuffix');
    const confirmBtn = document.getElementById('cancelOrderConfirm');

    function openSingle(rowEl) {
      // Build a one-line preview from the row's pair-text + order-details
      const name = rowEl.querySelector('.pair-text .name') ? rowEl.querySelector('.pair-text .name').textContent : 'this order';
      const side = rowEl.querySelector('.pair-text .side') ? rowEl.querySelector('.pair-text .side').textContent.trim() : '';
      const cols = rowEl.querySelectorAll('.order-details .col');
      let summary = '';
      if (cols.length >= 3) {
        summary = `<div style="display:flex;justify-content:space-between;color:var(--text-soft);font-size:14.5px;text-transform:uppercase;letter-spacing:0.4px;font-weight:700;margin-bottom:6px">${name} · ${side}</div>` +
          `<div style="display:flex;justify-content:space-between;gap:14px"><span>Price · <strong style="color:var(--text);font-family:'JetBrains Mono',monospace">${cols[0].querySelector('.v').textContent}</strong></span><span>Amount · <strong style="color:var(--text);font-family:'JetBrains Mono',monospace">${cols[1].querySelector('.v').textContent}</strong></span></div>`;
      }
      titleEl.textContent = 'Cancel this order?';
      textEl.textContent = 'This action cannot be undone. Any partially filled portion of the order will stay in your wallet.';
      detailsEl.innerHTML = summary;
      detailsEl.style.display = summary ? '' : 'none';
      btnLabel.textContent = 'Cancel order';
      keepSuffix.textContent = '';
      confirmBtn.onclick = () => {
        rowEl.style.transition = 'opacity .2s, transform .2s';
        rowEl.style.opacity = '0';
        rowEl.style.transform = 'translateX(-8px)';
        setTimeout(() => rowEl.remove(), 200);
        modal.classList.remove('open');
        document.body.style.overflow = '';
        if (window.showToast) window.showToast('Order cancelled');
      };
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function openAll() {
      const rows = document.querySelectorAll('.orders-block .order-row');
      const n = rows.length;
      if (n === 0) {
        if (window.showToast) window.showToast('No active orders to cancel');
        return;
      }
      titleEl.textContent = `Cancel all open orders?`;
      textEl.innerHTML = `This will cancel <strong style="color:var(--text)">${n} order${n === 1 ? '' : 's'}</strong>. Any partially filled portions stay in your wallet. This action cannot be undone.`;
      detailsEl.style.display = 'none';
      btnLabel.textContent = `Cancel all (${n})`;
      keepSuffix.textContent = '';
      confirmBtn.onclick = () => {
        rows.forEach((row, i) => {
          setTimeout(() => {
            row.style.transition = 'opacity .2s, transform .2s';
            row.style.opacity = '0';
            row.style.transform = 'translateX(-8px)';
            setTimeout(() => row.remove(), 200);
          }, i * 60);
        });
        modal.classList.remove('open');
        document.body.style.overflow = '';
        if (window.showToast) window.showToast(`${n} order${n === 1 ? '' : 's'} cancelled`);
      };
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    // Wire single-cancel buttons
    document.querySelectorAll('.order-cancel').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const row = btn.closest('.order-row');
        if (row) openSingle(row);
      });
    });

    // Wire "Cancel all" button (header)
    document.querySelectorAll('.ctrl-btn').forEach(btn => {
      const txt = (btn.textContent || '').trim().toLowerCase();
      if (txt.includes('cancel all')) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          openAll();
        });
      }
    });
  })();

  // (Portfolio USD/APT toggle removed — both values shown together)

  // ---------- Hero time-range tabs (1D/1W/1M/1Y/ALL) ----------
  (function(){
    const tabs = document.querySelectorAll('.tf-row .tf-btn');
    const chartEl = document.getElementById('heroChart');
    if (!tabs.length || !chartEl) return;

    // Configure each period
    const config = {
      '1D':  { points: 24, vol: 1.6, axis: ['12 AM', '6 AM', '12 PM', '6 PM', 'Now'] },
      '1W':  { points: 30, vol: 2.8, axis: ['May 16', 'May 18', 'May 20', 'May 22', 'May 23'] },
      '1M':  { points: 30, vol: 3.4, axis: ['Apr 23', 'Apr 30', 'May 7', 'May 14', 'May 23'] },
      '1Y':  { points: 40, vol: 5.2, axis: ['Jun', 'Sep', 'Dec', 'Mar', 'May'] },
      'ALL': { points: 50, vol: 7.0, axis: ['2023', '2024 H1', '2024 H2', '2025', '2026'] },
    };

    function renderChart(period) {
      const c = config[period] || config['1W'];
      // Random walk
      const pts = [];
      let v = 50;
      for (let i = 0; i < c.points; i++) {
        v += (Math.random() - 0.45) * c.vol;
        pts.push(Math.max(20, Math.min(90, v)));
      }
      // Determine width/height from chartEl
      const w = chartEl.clientWidth || 600;
      const h = chartEl.clientHeight || 140;
      const min = Math.min(...pts), max = Math.max(...pts), r = max - min || 1;
      const step = w / (pts.length - 1);
      const P = pts.map((p, i) => [i*step, h - ((p - min)/r) * (h - 18) - 9]);
      const path = P.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
      const area = path + ` L ${w} ${h} L 0 ${h} Z`;
      const gid = 'heroG' + Math.random().toString(36).slice(2, 8);
      chartEl.innerHTML = `
        <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" width="100%" height="100%">
          <defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="#ea6a2c" stop-opacity="0.34"/>
            <stop offset="100%" stop-color="#ea6a2c" stop-opacity="0"/>
          </linearGradient></defs>
          <path d="${area}" fill="url(#${gid})"/>
          <path d="${path}" fill="none" stroke="#ea6a2c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="${P[P.length-1][0]}" cy="${P[P.length-1][1]}" r="3.5" fill="#ea6a2c"/>
        </svg>
      `;
      // Update axis labels
      const axis = document.querySelector('.chart-axis');
      if (axis) {
        const spans = axis.querySelectorAll('span');
        if (spans.length === c.axis.length) {
          c.axis.forEach((label, i) => spans[i].textContent = label);
        } else {
          // Rebuild axis
          axis.innerHTML = c.axis.map(l => `<span>${l}</span>`).join('');
        }
      }
      // Update "past N days" timeframe-mini label
      const tfMini = document.querySelector('.timeframe-mini');
      if (tfMini) {
        const map = {'1D':'past 24 hours','1W':'past 7 days','1M':'past 30 days','1Y':'past year','ALL':'all-time'};
        tfMini.textContent = map[period] || 'past 7 days';
      }
    }

    tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        const period = (btn.textContent || '').trim();
        tabs.forEach(b => b.classList.toggle('active', b === btn));
        renderChart(period);
      });
    });
  })();

  // ---------- Row ⋯ dropdown menu ----------
  (function(){
    // Define menu contents per context
    const menus = {
      asset: [
        { ic: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
          label: 'View asset' },
        { ic: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
          label: 'Pin to top' },
        { ic: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
          label: 'Copy issuer address' },
        { divider: true },
        { ic: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
          label: 'View on Aptos Explorer' },
      ],
      lp: [
        { ic: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
          label: 'View pool details' },
        { ic: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
          label: 'View transaction history' },
        { ic: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
          label: 'Copy pool address' },
      ]
    };

    let openMenu = null;

    function closeOpenMenu() {
      if (openMenu) {
        openMenu.remove();
        openMenu = null;
      }
    }

    function showMenu(triggerBtn, kind) {
      closeOpenMenu();
      const items = menus[kind] || [];
      const menu = document.createElement('div');
      menu.className = 'row-menu open';
      menu.innerHTML = items.map(it => {
        if (it.divider) return '<div class="divider"></div>';
        return `<button${it.danger ? ' class="danger"' : ''}>${it.ic}${it.label}</button>`;
      }).join('');

      // Position the menu
      const rect = triggerBtn.getBoundingClientRect();
      menu.style.position = 'fixed';
      menu.style.top = (rect.bottom + 6) + 'px';
      menu.style.left = (rect.right - 180) + 'px';   // align right edge
      document.body.appendChild(menu);
      openMenu = menu;

      // Hook actions
      menu.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const label = (btn.textContent || '').trim();
          // Only show toast for copy actions
          if (label === 'Copy issuer address' || label === 'Copy pool address') {
            try { navigator.clipboard && navigator.clipboard.writeText('0x0bb54b8bb53759c0767cb7f8013cb790fef33ef2c3ff57de13628bef7a127f6c'); } catch (err) {}
            if (window.showToast) window.showToast(label.replace('Copy ', '') + ' copied to clipboard');
          }
          // Other actions (View pool details, Tx history, View asset, etc.) just close the menu silently
          closeOpenMenu();
        });
      });
    }

    // Detect ⋯ buttons (icon-only with 3 circles svg)
    function isDotsButton(btn) {
      const svg = btn.querySelector('svg');
      if (!svg) return false;
      const circles = svg.querySelectorAll('circle');
      // 3 vertical circles → dots button
      return circles.length === 3;
    }

    // Decide context: if inside lp-card → 'lp', else 'asset'
    function detectKind(btn) {
      if (btn.closest('.lp-card')) return 'lp';
      return 'asset';
    }

    // Use event delegation so dynamically-rendered buttons also work
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button.qa-row-btn.icon-only');
      if (btn && isDotsButton(btn)) {
        e.preventDefault();
        e.stopPropagation();
        // Toggle if same button was the trigger
        if (openMenu && openMenu._trigger === btn) {
          closeOpenMenu();
          return;
        }
        showMenu(btn, detectKind(btn));
        openMenu._trigger = btn;
        return;
      }
      // Click outside closes
      if (openMenu && !openMenu.contains(e.target)) {
        closeOpenMenu();
      }
    });

    // Esc closes
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeOpenMenu();
    });

    // Repositioning on scroll/resize
    window.addEventListener('scroll', closeOpenMenu, true);
    window.addEventListener('resize', closeOpenMenu);
  })();

  // ---------- LP Add / Remove modals + JS ----------
  (function(){
    const addModal = document.getElementById('modalLpAdd');
    const removeModal = document.getElementById('modalLpRemove');
    if (!addModal || !removeModal) return;

    // Wire LP table Add / Remove buttons
    document.querySelectorAll('.lp-card .qa-row-btn').forEach(btn => {
      const label = (btn.textContent || '').trim();
      if (label.endsWith('Add')) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          // Update modal with the right pool details based on row
          const row = btn.closest('tr');
          const pairName = row ? row.querySelector('.lp-nm') : null;
          const aprEl = row ? row.querySelector('.lp-apr') : null;
          if (pairName) {
            const titleEl = addModal.querySelector('.modal-body > div:first-child > div:nth-child(2) > div:first-child');
            if (titleEl) titleEl.textContent = pairName.textContent + ' Pool';
          }
          if (aprEl) {
            const aprModalEl = document.getElementById('lpAddApr');
            if (aprModalEl) aprModalEl.textContent = aprEl.textContent;
          }
          addModal.classList.add('open');
          document.body.style.overflow = 'hidden';
        });
      } else if (label.endsWith('Remove')) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          removeModal.classList.add('open');
          document.body.style.overflow = 'hidden';
        });
      }
    });

    // Range slider on Remove modal
    const range = document.getElementById('lpRemoveRange');
    const pctLabel = document.getElementById('lpRemovePct');
    const xlmOut = document.getElementById('lpRemoveXlm');
    const usdcOut = document.getElementById('lpRemoveUsdc');
    const rewardsOut = document.getElementById('lpRemoveRewards');
    const pillBtns = removeModal.querySelectorAll('.pill-btn-range');

    function updateRemove(pct) {
      pct = Math.max(0, Math.min(100, pct));
      pctLabel.textContent = pct + '%';
      // Base: 142 LP → $2,478 ($1,239 APT-side + $1,239 USDC-side)
      // Underlying: ~1,842 APT total and ~1,239 USDC total ⇒ at pct%
      const xlm = (1842 * pct / 100).toFixed(0);
      const usdc = (1239 * pct / 100).toFixed(0);
      const rewards = (18.4 * pct / 100).toFixed(1);
      xlmOut.textContent = Number(xlm).toLocaleString() + ' APT';
      usdcOut.textContent = Number(usdc).toLocaleString() + ' USDC';
      rewardsOut.textContent = '+' + rewards + ' APT';
      pillBtns.forEach(b => b.classList.toggle('active', parseInt(b.dataset.pct) === pct));
      range.value = pct;
    }

    if (range) {
      range.addEventListener('input', e => updateRemove(parseInt(e.target.value)));
      pillBtns.forEach(b => {
        b.addEventListener('click', () => updateRemove(parseInt(b.dataset.pct)));
      });
      updateRemove(50);
    }
  })();

  // ---------- Recent Activity (25 entries, paginated) ----------
  (function(){
    const block = document.querySelector('.activity-block');
    if (!block) return;

    // Activity data (25 entries spanning today, yesterday, earlier)
    const allActivities = [
      // Today · May 23
      { day: 'Today · May 23, 2026', kind:'received', type:'Received USDT', meta:'From 0x0222…02b2 · 13:14', amt:'+500 USDT', amtSub:'≈ $7.42', status:'success', statusLabel:'Confirmed' },
      { day: 'Today · May 23, 2026', kind:'swap', type:'Swap APT → USDC', meta:'Rate 6.81 · 12:42', amt:'+50 USDC', amtSub:'−340.5 APT', status:'success', statusLabel:'Filled' },
      { day: 'Today · May 23, 2026', kind:'order', type:'Limit order placed · APT/USDT', meta:'Buy 10K USDT @ 0.0142 · 11:30', amt:'Pending', amtSub:'0% filled', status:'pending', statusLabel:'Pending' },
      { day: 'Today · May 23, 2026', kind:'send', type:'Sent APT', meta:'To 0x043f…8e53 · 10:55', amt:'−240 APT', amtSub:'≈ $99.07', status:'success', statusLabel:'Confirmed' },
      { day: 'Today · May 23, 2026', kind:'lp', type:'Added liquidity · APT/USDC', meta:'+48 LP tokens · 09:18', amt:'+48 LP', amtSub:'$1,239 deposited', status:'success', statusLabel:'Confirmed' },
      { day: 'Today · May 23, 2026', kind:'received', type:'Received APT', meta:'From rN7n…fzRH · 08:42', amt:'+1,250 APT', amtSub:'≈ $515.99', status:'success', statusLabel:'Confirmed' },
      // Yesterday · May 22
      { day: 'Yesterday · May 22, 2026', kind:'swap', type:'Swap APT → USDT', meta:'Rate 0.0142 · 22:13', amt:'+8,452 USDT', amtSub:'−120 APT', status:'success', statusLabel:'Filled' },
      { day: 'Yesterday · May 22, 2026', kind:'received', type:'Received CELL airdrop', meta:'From Cellana Protocol · 19:00', amt:'+1,250 CELL', amtSub:'≈ $2.16', status:'success', statusLabel:'Confirmed' },
      { day: 'Yesterday · May 22, 2026', kind:'order', type:'Limit order filled · APT/USDC', meta:'Sell 500 APT @ 0.4128 · 17:42', amt:'+206.4 USDC', amtSub:'−500 APT', status:'success', statusLabel:'Filled' },
      { day: 'Yesterday · May 22, 2026', kind:'trustline', type:'Trustline added · GUI', meta:'0x089c…d5e3 · 16:30', amt:'—', amtSub:'+0.5 APT reserve', status:'success', statusLabel:'Confirmed' },
      { day: 'Yesterday · May 22, 2026', kind:'lp', type:'Claimed LP rewards', meta:'LUMOS/APT pool · 14:08', amt:'+12.4 APT', amtSub:'≈ $5.12', status:'success', statusLabel:'Confirmed' },
      { day: 'Yesterday · May 22, 2026', kind:'send', type:'Sent USDC', meta:'To 0x0eaa…60c7 · 12:15', amt:'−100 USDC', amtSub:'≈ $100.00', status:'success', statusLabel:'Confirmed' },
      { day: 'Yesterday · May 22, 2026', kind:'order', type:'Limit order cancelled · APT/WBTC', meta:'Buy 100K WBTC · 10:18', amt:'Cancelled', amtSub:'0% filled', status:'cancelled', statusLabel:'Cancelled' },
      // May 21
      { day: 'May 21, 2026', kind:'swap', type:'Swap USDC → APT', meta:'Rate 2.42 · 21:48', amt:'+483 APT', amtSub:'−200 USDC', status:'success', statusLabel:'Filled' },
      { day: 'May 21, 2026', kind:'received', type:'Received LUMOS', meta:'Token mint · 20:00', amt:'+10,000 LUMOS', amtSub:'≈ $7.13', status:'success', statusLabel:'Confirmed' },
      { day: 'May 21, 2026', kind:'lp', type:'Added liquidity · LUMOS/APT', meta:'+34 LP tokens · 18:42', amt:'+34 LP', amtSub:'$462 deposited', status:'success', statusLabel:'Confirmed' },
      { day: 'May 21, 2026', kind:'send', type:'Sent USDT', meta:'To 0x036b…a806 · 15:30', amt:'−2,000 USDT', amtSub:'≈ $29.68', status:'success', statusLabel:'Confirmed' },
      { day: 'May 21, 2026', kind:'order', type:'Limit order placed · USDC/EURC', meta:'Buy 50 EURC @ 1.16 · 12:00', amt:'Pending', amtSub:'0% filled', status:'pending', statusLabel:'Pending' },
      // May 20
      { day: 'May 20, 2026', kind:'received', type:'Received APT', meta:'From rDexX…7B2P · 22:15', amt:'+2,800 APT', amtSub:'≈ $1,155.84', status:'success', statusLabel:'Confirmed' },
      { day: 'May 20, 2026', kind:'swap', type:'Swap APT → CELL', meta:'Rate 238.1 · 19:32', amt:'+11,905 CELL', amtSub:'−50 APT', status:'success', statusLabel:'Filled' },
      { day: 'May 20, 2026', kind:'lp', type:'Removed liquidity · APT/USDC', meta:'−24 LP tokens · 17:08', amt:'+382 APT', amtSub:'+157 USDC', status:'success', statusLabel:'Confirmed' },
      { day: 'May 20, 2026', kind:'trustline', type:'Trustline added · USDC', meta:'0x0225…9851 · 14:42', amt:'—', amtSub:'+0.5 APT reserve', status:'success', statusLabel:'Confirmed' },
      // May 19
      { day: 'May 19, 2026', kind:'order', type:'Limit order filled · APT/CELL', meta:'Sell 500 APT @ 240 · 20:00', amt:'+120,000 CELL', amtSub:'−500 APT', status:'success', statusLabel:'Filled' },
      { day: 'May 19, 2026', kind:'send', type:'Sent APT', meta:'To 0x04f3…1c82 · 15:42', amt:'−800 APT', amtSub:'≈ $330.24', status:'success', statusLabel:'Confirmed' },
      { day: 'May 19, 2026', kind:'received', type:'Received GUI', meta:'From Kale Foundation · 12:08', amt:'+5,000 GUI', amtSub:'≈ $37.20', status:'success', statusLabel:'Confirmed' },
    ];

    // SVG icons by kind
    const iconMap = {
      received: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>',
      send:     '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
      swap:     '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
      order:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
      lp:       '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>',
      trustline:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    };

    // Amount class by kind
    function amtClass(act) {
      if (act.status === 'cancelled' || act.status === 'pending') return '';
      if (act.kind === 'received') return 'up';
      if (act.kind === 'send') return 'down';
      if (act.kind === 'swap' || act.kind === 'lp') return 'swap';
      return '';
    }

    let pageSize = 25;

    function render() {
      // Slice to pageSize
      const items = allActivities.slice(0, pageSize);
      // Group by day
      let html = '';
      let prevDay = null;
      items.forEach(act => {
        if (act.day !== prevDay) {
          html += `<div class="day-divider">${act.day}</div>`;
          prevDay = act.day;
        }
        const ac = amtClass(act);
        html += `
          <div class="activity-row">
            <div class="activity-icon ${act.kind}">${iconMap[act.kind] || iconMap.swap}</div>
            <div class="activity-info">
              <div class="type">${act.type} <span class="status ${act.status}">${act.statusLabel}</span></div>
              <div class="meta">${act.meta}</div>
            </div>
            <div class="activity-amt"><div class="a1 ${ac}">${act.amt}</div><div class="a2">${act.amtSub}</div></div>
          </div>
        `;
      });
      block.innerHTML = html;
    }

    // Initial render replaces hardcoded 6 rows
    render();

    // Add pagination footer below the block
    const foot = document.createElement('div');
    foot.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:14px 4px;font-size:16px;color:var(--text-soft)';
    foot.innerHTML = `
      <div>Showing <span id="actCount">${pageSize}</span> of ${allActivities.length} activities</div>
      <div style="display:flex;align-items:center;gap:8px">
        <span>Show:</span>
        <div class="act-size-tabs" style="display:inline-flex;gap:4px;background:var(--surface);padding:3px;border-radius:8px;border:1px solid var(--border)">
          <button data-size="25" class="active">25</button>
          <button data-size="50">50</button>
          <button data-size="100">100</button>
        </div>
      </div>
    `;
    block.parentElement.insertBefore(foot, block.nextSibling);

    // Style the per-page buttons (inject CSS once)
    if (!document.getElementById('actSizeTabsCss')) {
      const css = document.createElement('style');
      css.id = 'actSizeTabsCss';
      css.textContent = `
        .act-size-tabs button {
          padding: 4px 11px; border-radius: 6px; border: none;
          background: transparent; cursor: pointer;
          font-family: inherit; font-size:16px; font-weight: 700;
          color: var(--text-muted);
        }
        .act-size-tabs button.active { background: var(--accent); color: #fff; }
        .act-size-tabs button:not(.active):hover { color: var(--accent); }
      `;
      document.head.appendChild(css);
    }

    foot.querySelectorAll('.act-size-tabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        const newSize = parseInt(btn.dataset.size);
        // For demo, we have 25 entries; "50" and "100" just keep all 25 but indicate selection
        pageSize = Math.min(newSize, allActivities.length);
        foot.querySelectorAll('.act-size-tabs button').forEach(b => b.classList.toggle('active', b === btn));
        document.getElementById('actCount').textContent = pageSize;
        render();
      });
    });
  })();
