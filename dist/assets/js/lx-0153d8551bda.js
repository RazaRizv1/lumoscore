

// ===== Mobile search popup =====
(function() {
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  ready(function() {
    var popup = document.getElementById('searchPopup');
    var input = document.getElementById('spSearchInput');
    var closeBtn = document.getElementById('spCloseBtn');
    var assetList = document.getElementById('spAssetList');
    var assetCount = document.getElementById('spAssetCount');
    var filterBtns = popup.querySelectorAll('.sp-filter-pill');
    var clearBtn = document.getElementById('spClearFilter');

    var allAssets = [
      { chain:'stellar', tk:'LUMOS',  nm:'LUMOS',         ic:'L', col:'#ea6a2c', priceUsd:'$0.000109', c24:'-7.12' },
      { chain:'stellar', tk:'CELL',   nm:'Cellana',      ic:'A', col:'#6f5ded', priceUsd:'$0.00173',  c24:'+24.8' },
      { chain:'stellar', tk:'USDC',   nm:'USD Coin',    ic:'U', col:'#2775ca', priceUsd:'$1.00',     c24:'+0.01' },
      { chain:'stellar', tk:'GUI',   nm:'Gui Inu',  ic:'K', col:'#f5a623', priceUsd:'$0.0074',   c24:'+12.4' },
      { chain:'stellar', tk:'MOD',   nm:'Move Dollar',  ic:'N', col:'#6b4ff2', priceUsd:'$0.00002',  c24:'+184',  isNew:true },
      { chain:'stellar', tk:'APT',    nm:'Aptos Coin',ic:'X', col:'#000000', priceUsd:'$0.4128',   c24:'+2.34' },
      { chain:'stellar', tk:'RION',   nm:'Hyperion',       ic:'G', col:'#8b5cf6', priceUsd:'$0.0099',   c24:'+15.7' },
      { chain:'xrpl',    tk:'LUMOS',  nm:'LUMOS',         ic:'L', col:'#ea6a2c', priceUsd:'$0.928',    c24:'-3.4' },
      { chain:'xrpl',    tk:'aBTC',    nm:'aBTC',        ic:'X', col:'#f7931a',    priceUsd:'$2.18',     c24:'+3.4' },
      { chain:'xrpl',    tk:'MOD',   nm:'Move Dollar',     ic:'S', col:'#6b4ff2', priceUsd:'$0.142',    c24:'+8.6' },
      { chain:'xrpl',    tk:'MOD',    nm:'Move Dollar',   ic:'C', col:'#6b4ff2', priceUsd:'$0.0021',   c24:'+18.2' },
      { chain:'xrpl',    tk:'GUI',    nm:'Gui Inu',       ic:'E', col:'#f5a623', priceUsd:'$0.0024',   c24:'+9.1' }
    ];

    var activeFilter = null;
    var currentQuery = '';

    function spOpen() {
      popup.classList.add('open');
      document.body.style.overflow = 'hidden';
      setTimeout(function(){ if (input) input.focus(); }, 60);
      spRender();
    }
    window._openSearchPopup = spOpen;
    function spClose() {
      popup.classList.remove('open');
      document.body.style.overflow = '';
      input.value = '';
      currentQuery = '';
      activeFilter = null;
      filterBtns.forEach(function(b){ b.classList.remove('active'); });
      clearBtn.style.display = 'none';
    }
    window._closeSearchPopup = spClose;

    function spRender() {
      var q = currentQuery.toLowerCase().trim();
      var assets = allAssets;
      if (activeFilter) assets = assets.filter(function(a){ return a.chain === activeFilter; });
      if (q) assets = assets.filter(function(a){
        return a.tk.toLowerCase().indexOf(q) >= 0 ||
               a.nm.toLowerCase().indexOf(q) >= 0;
      });
      assetCount.textContent = '(' + assets.length + ')';
      if (assets.length === 0) {
        assetList.innerHTML = '<div class="sp-empty">No assets match your search.</div>';
        return;
      }
      assetList.innerHTML = assets.map(function(a) {
        var up = a.c24.indexOf('-') < 0;
        var newBadge = a.isNew ? '<span class="sp-new">NEW</span>' : '';
        return '<div class="sp-row sp-row--asset">' +
          '<div class="sp-ico" style="background:' + a.col + '">' + a.ic + '</div>' +
          '<div class="sp-info">' +
            '<div class="sp-name-row"><span class="sp-tk">' + a.tk + '</span>' + newBadge + '</div>' +
            '<div class="sp-nm">' + a.nm + '</div>' +
          '</div>' +
          '<div class="sp-right">' +
            '<div class="sp-price">' + a.priceUsd + '</div>' +
            '<div class="sp-change ' + (up ? 'up' : 'down') + '">' + (up ? '+' : '') + a.c24 + '%</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    // ----- Wire up triggers -----
    function attachToSearch(el) {
      if (!el) return;
      el.addEventListener('focus', function(e) { e.preventDefault(); el.blur(); spOpen(); });
      el.addEventListener('click', function(e) { e.preventDefault(); spOpen(); });
    }
    document.querySelectorAll('.hero-search input').forEach(attachToSearch);
    document.querySelectorAll('.hero-search').forEach(function(wrapper) {
      wrapper.addEventListener('click', function(e) {
        if (e.target.closest('input')) return;
        spOpen();
      });
    });

    // ----- Close handlers -----
    closeBtn.addEventListener('click', spClose);
    popup.addEventListener('click', function(e) {
      // Clicking the dark backdrop closes; clicking the sheet itself does not
      if (e.target === popup) spClose();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && popup.classList.contains('open')) spClose();
    });

    // ----- Search input -----
    input.addEventListener('input', function(e) {
      currentQuery = e.target.value;
      spRender();
    });

    // ----- Filters -----
    filterBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var chain = btn.dataset.chain;
        if (activeFilter === chain) {
          activeFilter = null;
          btn.classList.remove('active');
          clearBtn.style.display = 'none';
        } else {
          activeFilter = chain;
          filterBtns.forEach(function(b){ b.classList.toggle('active', b === btn); });
          clearBtn.style.display = '';
        }
        spRender();
      });
    });
    clearBtn.addEventListener('click', function() {
      activeFilter = null;
      filterBtns.forEach(function(b){ b.classList.remove('active'); });
      clearBtn.style.display = 'none';
      spRender();
    });

    // Initial render so the body has content if the user opens it instantly
    spRender();
  });
})();

