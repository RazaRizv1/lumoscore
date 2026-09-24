

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

