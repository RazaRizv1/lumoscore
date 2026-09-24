
// === Search popup (ported from wallet) ===
(function() {
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  ready(function() {
    var searchPopup = document.getElementById('searchPopup');
    if (searchPopup) {
      var input = document.getElementById('spSearchInput');
      var assetList = document.getElementById('spAssetList');
      var assetCount = document.getElementById('spAssetCount');
      var filterBtns = document.querySelectorAll('#spFilters .sp-filter-pill');
      var clearBtn = document.getElementById('spClearFilter');

      var allAssets = [
        { chain:'stellar', tk:'LUMOS',  nm:'LUMOS',  domain:'lumosdao.io', ic:'L', col:'#ea6a2c', price:'0.000713 APT', priceUsd:'$0.000108725', mc:'$1.09M', c24:'-7.12', addr:'0x0133…d268' },
        { chain:'stellar', tk:'CELL',   nm:'Cellana', domain:null, ic:'A', col:'#6f5ded', price:'0.0042 APT',     priceUsd:'$0.00173', mc:'$48.2M', c24:'+24.8', addr:'0x0f95…d09e' },
        { chain:'stellar', tk:'USDC',   nm:'USD Coin', domain:'circle.com', ic:'U', col:'#2775ca', price:'0.7449 APT', priceUsd:'$1.00', mc:'$5.1M', c24:'+0.01', addr:'0x0a98…23fa' },
        { chain:'stellar', tk:'GUI',   nm:'Gui Inu', domain:null, ic:'K', col:'#f5a623', price:'0.018 APT', priceUsd:'$0.0074', mc:'$2.4M', c24:'+12.4', addr:'0x07b3…a99b' },
        { chain:'stellar', tk:'MOD',   nm:'Move Dollar', domain:null, ic:'N', col:'#6b4ff2', price:'0.0₄17 APT', priceUsd:'$0.0₅22', mc:'$298K', c24:'+184', addr:'0x07d8…7de8', isNew:true },
        { chain:'stellar', tk:'APT',    nm:'Aptos Coin', domain:'aptosfoundation.org', ic:'X', col:'#000000', price:'1.00 APT', priceUsd:'$0.4128', mc:'$12.6B', c24:'+2.34', addr:'native' },
        { chain:'stellar', tk:'RION',   nm:'Hyperion', domain:null, ic:'G', col:'#8b5cf6', price:'0.024 APT', priceUsd:'$0.0099', mc:'$1.8M', c24:'+15.7', addr:'0x0644…0285' },
        { chain:'xrpl', tk:'LUMOS',     nm:'LUMOS',  domain:'lumosdao.io', ic:'L', col:'#ea6a2c', price:'0.4128 aBTC', priceUsd:'$0.928', mc:'$2.1M', c24:'-3.4', addr:'0x0b86…ce53' },
        { chain:'xrpl', tk:'aBTC',       nm:'aBTC', domain:'echo-protocol.xyz', ic:'X', col:'#f7931a', price:'1.00 aBTC', priceUsd:'$2.18', mc:'$124B', c24:'+3.4', addr:'native' },
        { chain:'xrpl', tk:'MOD',      nm:'Move Dollar', domain:'thala.fi', ic:'S', col:'#6b4ff2', price:'0.0651 aBTC', priceUsd:'$0.142', mc:'$94M', c24:'+8.6', addr:'0x0935…fd16' },
        { chain:'xrpl', tk:'MOD',       nm:'Move Dollar', domain:null, ic:'C', col:'#6b4ff2', price:'0.000962 aBTC', priceUsd:'$0.0021', mc:'$1.2M', c24:'+18.2', addr:'0x0ccd…6b9c' },
        { chain:'xrpl', tk:'GUI',       nm:'Gui Inu', domain:null, ic:'E', col:'#f5a623', price:'0.0011 aBTC', priceUsd:'$0.0024', mc:'$420K', c24:'+9.1', addr:'0x0cc6…c4ae' },
      ];

      var activeFilter = null;
      var currentQuery = '';

      function spOpen() {
        searchPopup.classList.add('open');
        document.body.style.overflow = 'hidden';
        setTimeout(function(){ if (input) input.focus(); }, 50);
        spRender();
      }
      function spClose() {
        searchPopup.classList.remove('open');
        document.body.style.overflow = '';
        if (input) input.value = '';
        currentQuery = '';
        activeFilter = null;
        filterBtns.forEach(function(b){ b.classList.remove('active'); });
        if (clearBtn) clearBtn.style.display = 'none';
      }
      window._openSearchPopup = spOpen;
      window._closeSearchPopup = spClose;

      function spRender() {
        var q = currentQuery.toLowerCase().trim();
        var assets = allAssets;
        if (activeFilter) assets = assets.filter(function(a){ return a.chain === activeFilter; });
        if (q) assets = assets.filter(function(a){
          return a.tk.toLowerCase().indexOf(q) >= 0 ||
                 a.nm.toLowerCase().indexOf(q) >= 0 ||
                 (a.domain || '').toLowerCase().indexOf(q) >= 0;
        });
        if (assetCount) assetCount.textContent = '(' + assets.length + ')';
        if (!assetList) return;
        if (assets.length === 0) {
          assetList.innerHTML = '<div class="sp-empty">No assets match your search.</div>';
        } else {
          assetList.innerHTML = assets.map(function(a){
            var c = parseFloat(a.c24);
            var isUp = c >= 0;
            var newBadge = a.isNew ? '<span style="font-size:11px;padding:2px 5px;border-radius:3px;background:var(--green-soft);color:var(--green);font-weight:800;letter-spacing:0.3px">NEW</span>' : '';
            var domainBadge = a.domain ? '<span class="sp-domain">' + a.domain + '</span>' : '';
            return '<div class="sp-row sp-row--asset" data-chain="' + a.chain + '">' +
              '<div class="sp-ico" style="background:' + a.col + '">' + a.ic + '</div>' +
              '<div class="sp-info">' +
                '<div class="sp-name-row">' + a.tk + ' ' + domainBadge + ' ' + newBadge + '</div>' +
                '<div class="sp-sub">' + a.priceUsd + ' · MC: ' + a.mc + '</div>' +
              '</div>' +
              '<div class="sp-right">' +
                '<div class="sp-price">' + a.price + '</div>' +
                '<div class="sp-change ' + (isUp?'up':'down') + '">' + (isUp?'+':'') + a.c24 + '%</div>' +
                '<div class="sp-addr-mini" data-copy="' + a.addr + '" data-copy-label="' + a.tk + ' address">' + (a.addr === 'native' ? 'Native' : a.addr) + ' <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></div>' +
              '</div>' +
            '</div>';
          }).join('');
        }
      }

      if (input) {
        input.addEventListener('input', function(e){
          currentQuery = e.target.value;
          spRender();
        });
      }
      filterBtns.forEach(function(btn){
        btn.addEventListener('click', function(){
          var chain = btn.dataset.chain;
          if (activeFilter === chain) {
            activeFilter = null;
            btn.classList.remove('active');
          } else {
            activeFilter = chain;
            filterBtns.forEach(function(b){ b.classList.toggle('active', b === btn); });
          }
          if (clearBtn) clearBtn.style.display = activeFilter ? '' : 'none';
          spRender();
        });
      });
      if (clearBtn) {
        clearBtn.addEventListener('click', function(){
          activeFilter = null;
          filterBtns.forEach(function(b){ b.classList.remove('active'); });
          clearBtn.style.display = 'none';
          spRender();
        });
      }
      searchPopup.addEventListener('click', function(e){
        if (e.target === searchPopup) spClose();
      });
      // Cmd+K / Ctrl+K to open
      document.addEventListener('keydown', function(e){
        if ((e.metaKey || e.ctrlKey) && e.key && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          spOpen();
        }
      });

      // Hook up search boxes (skip .inline-filter ones — those filter their target inline)
      function attachToSearch(el) {
        if (!el || el.dataset.spWired) return;
        if (el.closest('.inline-filter')) return; // skip
        el.dataset.spWired = '1';
        el.addEventListener('focus', function(e){ e.preventDefault(); el.blur(); spOpen(); });
        el.addEventListener('click', function(e){ e.preventDefault(); spOpen(); });
      }
      document.querySelectorAll('.search-box input, .hero-search input').forEach(attachToSearch);
      document.querySelectorAll('.search-box, .hero-search').forEach(function(wrapper){
        if (wrapper.classList.contains('inline-filter')) return; // skip
        if (wrapper.dataset.spWired) return;
        wrapper.dataset.spWired = '1';
        wrapper.addEventListener('click', function(e){
          if (e.target.closest('input')) return;
          spOpen();
        });
      });
    }
    // Wire the topbar magnifier button(s) to open the popup
    document.querySelectorAll('button[aria-label="Search"]').forEach(function(btn){
      btn.addEventListener('click', function(){
        if (typeof window._openSearchPopup === 'function') window._openSearchPopup();
      });
    });
    // Wire the sidebar Search nav item
    document.querySelectorAll('.nav-item[data-tooltip="Search"]').forEach(function(item){
      item.style.cursor = 'pointer';
      item.addEventListener('click', function(){
        if (typeof window._openSearchPopup === 'function') window._openSearchPopup();
      });
    });
  });
})();
