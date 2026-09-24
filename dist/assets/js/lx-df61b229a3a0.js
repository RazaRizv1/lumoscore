
// === Full search popup wiring (AMM) ===
(function() {
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function() {
    // ============ Search popup wiring ============
    var searchPopup = document.getElementById('searchPopup');
    if (searchPopup) {
      var input = document.getElementById('spSearchInput');
      var assetList = document.getElementById('spAssetList');
      var assetCount = document.getElementById('spAssetCount');
      var filterBtns = document.querySelectorAll('#spFilters .sp-filter-pill');
      var clearBtn = document.getElementById('spClearFilter');

      var allAssets = [
        { chain:'aptos', tk:'APT',    nm:'Aptos Coin', domain:'aptosfoundation.org', ic:'A', col:'#000000', price:'1.00 APT', priceUsd:'$6.24', mc:'$3.8B', c24:'+3.10', addr:'0x0000...000a' },
        { chain:'aptos', tk:'USDC',   nm:'USD Coin', domain:'circle.com', ic:'U', col:'#2775ca', price:'0.160 APT', priceUsd:'$1.00', mc:'$180M', c24:'+0.01', addr:'0xbae2...6f3b' },
        { chain:'aptos', tk:'USDT',   nm:'Tether USD', domain:'tether.to', ic:'₮', col:'#26a17b', price:'0.160 APT', priceUsd:'$1.00', mc:'$142M', c24:'+0.00', addr:'0x357b...dc2b' },
        { chain:'aptos', tk:'AMI',    nm:'Amnis amAPT', domain:'amnis.finance', ic:'a', col:'#00c2a8', price:'1.03 APT', priceUsd:'$6.43', mc:'$96M', c24:'+3.4', addr:'0x111a...542a' },
        { chain:'aptos', tk:'MOD',    nm:'Move Dollar', domain:'thala.fi', ic:'M', col:'#6b4ff2', price:'0.160 APT', priceUsd:'$1.00', mc:'$28M', c24:'+0.02', addr:'0x94ed...5ff4' },
        { chain:'aptos', tk:'aBTC',   nm:'aBTC', domain:'echo-protocol.xyz', ic:'₿', col:'#f7931a', price:'15,110 APT', priceUsd:'$94,300', mc:'$1.1B', c24:'-2.1', addr:'0x4e18...5fe4' },
        { chain:'aptos', tk:'CELL',   nm:'Cellana', domain:'cellana.finance', ic:'C', col:'#6f5ded', price:'0.104 APT', priceUsd:'$0.65', mc:'$42M', c24:'+22.4', addr:'0x2ebb...df12', isNew:true },
        { chain:'aptos', tk:'LSD',    nm:'Liquidswap', domain:'liquidswap.com', ic:'L', col:'#ff5c00', price:'0.058 APT', priceUsd:'$0.36', mc:'$11M', c24:'+8.1', addr:'0x53a3...3719' },
        { chain:'aptos', tk:'LUMOS',  nm:'LUMOS', domain:'lumosdao.io', ic:'L', col:'#ea6a2c', price:'0.0116 APT', priceUsd:'$0.0725', mc:'$1.09M', c24:'-3.4', addr:'0x8c0f...bdc' }
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

    var searchBtn = document.getElementById('headerSearchBtn');
    if (searchBtn && typeof spOpen === 'function') {
      searchBtn.addEventListener('click', function(e) { e.preventDefault(); spOpen(); });
    }
  });
})();
