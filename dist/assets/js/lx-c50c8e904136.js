
// ===== Bottom-of-body wiring (runs after all modal/popup HTML is parsed) =====
(function() {
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  ready(function() {

    // ============ Toast helper (defines window.showToast if missing) ============
    if (!window.showToast) {
      let stack = document.querySelector('.toast-stack');
      if (!stack) {
        stack = document.createElement('div');
        stack.className = 'toast-stack';
        document.body.appendChild(stack);
      }
      window.showToast = function(msg) {
        const t = document.createElement('div');
        t.className = 'toast';
        t.innerHTML = '<span class="check-ic"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span><span>' + msg + '</span>';
        stack.appendChild(t);
        setTimeout(function(){ t.remove(); }, 2200);
      };
    }

    // ============ Generic modal close wiring (close button, overlay click, ESC) ============
    function closeModal(m) {
      m.classList.remove('open');
      document.body.style.overflow = '';
    }
    document.querySelectorAll('[data-modal]').forEach(function(overlay) {
      // Only wire once
      if (overlay.dataset.closeWired) return;
      overlay.dataset.closeWired = '1';
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closeModal(overlay);
        if (e.target.closest && e.target.closest('[data-close]')) closeModal(overlay);
      });
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        document.querySelectorAll('[data-modal].open').forEach(closeModal);
        // Also close search popup
        var sp = document.getElementById('searchPopup');
        if (sp && sp.classList.contains('open')) {
          sp.classList.remove('open');
          document.body.style.overflow = '';
        }
      }
    });

    // ============ Search popup wiring ============
    var searchPopup = document.getElementById('searchPopup');
    if (searchPopup) {
      var input = document.getElementById('spSearchInput');
      var assetList = document.getElementById('spAssetList');
      var assetCount = document.getElementById('spAssetCount');
      var filterBtns = document.querySelectorAll('#spFilters .sp-filter-pill');
      var clearBtn = document.getElementById('spClearFilter');

      var allAssets = [
        { chain:'stellar', tk:'LUMOS',  nm:'LUMOS',  domain:'lumosdao.io', ic:'L', col:'#ea6a2c', price:'0.000713 APT', priceUsd:'$0.000108725', mc:'$1.09M', c24:'-7.12', addr:'0x0955…3cca' },
        { chain:'stellar', tk:'CELL',   nm:'Cellana', domain:null, ic:'A', col:'#6f5ded', price:'0.0042 APT',     priceUsd:'$0.00173', mc:'$48.2M', c24:'+24.8', addr:'0x0ccf…ab54' },
        { chain:'stellar', tk:'USDC',   nm:'USD Coin', domain:'circle.com', ic:'U', col:'#2775ca', price:'0.7449 APT', priceUsd:'$1.00', mc:'$5.1M', c24:'+0.01', addr:'0x0d94…6a2d' },
        { chain:'stellar', tk:'GUI',   nm:'Gui Inu', domain:null, ic:'K', col:'#f5a623', price:'0.018 APT', priceUsd:'$0.0074', mc:'$2.4M', c24:'+12.4', addr:'0x0207…dc68' },
        { chain:'stellar', tk:'MOD',   nm:'Move Dollar', domain:null, ic:'N', col:'#6b4ff2', price:'0.0₄17 APT', priceUsd:'$0.0₅22', mc:'$298K', c24:'+184', addr:'0x0447…7391', isNew:true },
        { chain:'stellar', tk:'APT',    nm:'Aptos Coin', domain:'aptosfoundation.org', ic:'X', col:'#000000', price:'1.00 APT', priceUsd:'$0.4128', mc:'$12.6B', c24:'+2.34', addr:'native' },
        { chain:'stellar', tk:'RION',   nm:'Hyperion', domain:null, ic:'G', col:'#8b5cf6', price:'0.024 APT', priceUsd:'$0.0099', mc:'$1.8M', c24:'+15.7', addr:'0x0c94…c828' },
        { chain:'xrpl', tk:'LUMOS',     nm:'LUMOS',  domain:'lumosdao.io', ic:'L', col:'#ea6a2c', price:'0.4128 aBTC', priceUsd:'$0.928', mc:'$2.1M', c24:'-3.4', addr:'0x0679…3b2b' },
        { chain:'xrpl', tk:'aBTC',       nm:'aBTC', domain:'echo-protocol.xyz', ic:'X', col:'#f7931a', price:'1.00 aBTC', priceUsd:'$2.18', mc:'$124B', c24:'+3.4', addr:'native' },
        { chain:'xrpl', tk:'MOD',      nm:'Move Dollar', domain:'thala.fi', ic:'S', col:'#6b4ff2', price:'0.0651 aBTC', priceUsd:'$0.142', mc:'$94M', c24:'+8.6', addr:'0x0023…a60e' },
        { chain:'xrpl', tk:'MOD',       nm:'Move Dollar', domain:null, ic:'C', col:'#6b4ff2', price:'0.000962 aBTC', priceUsd:'$0.0021', mc:'$1.2M', c24:'+18.2', addr:'0x04e8…1e11' },
        { chain:'xrpl', tk:'GUI',       nm:'Gui Inu', domain:null, ic:'E', col:'#f5a623', price:'0.0011 aBTC', priceUsd:'$0.0024', mc:'$420K', c24:'+9.1', addr:'0x0e3f…79aa' },
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

    // ============ Inline table filter wiring ============
    // Any .search-box.inline-filter[data-target] filters rows in that <tbody>
    document.querySelectorAll('.search-box.inline-filter').forEach(function(wrap){
      if (wrap.dataset.filterWired) return;
      wrap.dataset.filterWired = '1';
      var input = wrap.querySelector('input');
      var targetId = wrap.dataset.target;
      var tbody = targetId ? document.getElementById(targetId) : null;
      // Fallback: nearest tbody after the wrapper
      if (!tbody) {
        var parent = wrap.closest('.assets-card, section, main');
        tbody = parent ? parent.querySelector('tbody') : null;
      }
      if (!input || !tbody) return;
      input.addEventListener('input', function(){
        var q = input.value.toLowerCase().trim();
        var rows = tbody.querySelectorAll('tr');
        rows.forEach(function(row){
          var text = (row.textContent || '').toLowerCase();
          row.style.display = (q === '' || text.indexOf(q) >= 0) ? '' : 'none';
        });
      });
    });

    // ============ Wallet quick-action button wiring (Send/Receive/Swap/Trustlines modals) ============
    function openModalById(id) {
      var m = document.getElementById(id);
      if (!m) return;
      m.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    document.querySelectorAll('.quick-actions .qa-btn').forEach(function(btn){
      if (btn.dataset.modalWired) return;
      btn.dataset.modalWired = '1';
      btn.addEventListener('click', function(e){
        e.preventDefault();
        var label = (btn.textContent || '').trim().toLowerCase();
        if (label.indexOf('send') >= 0) openModalById('modalSend');
        else if (label.indexOf('receive') >= 0) openModalById('modalReceive');
        else if (label.indexOf('swap') >= 0) openModalById('modalSwap');
        else if (label.indexOf('trustlines') >= 0) openModalById('modalTrustlines');
      });
    });
    document.querySelectorAll('.qa-row-btn').forEach(function(btn){
      if (btn.dataset.modalWired) return;
      btn.dataset.modalWired = '1';
      btn.addEventListener('click', function(e){
        var label = (btn.textContent || '').trim().toLowerCase();
        if (label === 'send') { e.preventDefault(); openModalById('modalSend'); }
        else if (label === 'trade') { e.preventDefault(); openModalById('modalSwap'); }
      });
    });

    // Trustline rows toggle
    document.querySelectorAll('.tl-row .tl-action').forEach(function(btn){
      if (btn.dataset.tlWired) return;
      btn.dataset.tlWired = '1';
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        var row = btn.closest('.tl-row');
        var isAdded = row.classList.toggle('added');
        btn.textContent = isAdded ? 'Added' : 'Add';
        var assetName = row.querySelector('.tl-nm') ? row.querySelector('.tl-nm').childNodes[0].textContent.trim() : 'Trustline';
        if (window.showToast) window.showToast(isAdded ? (assetName + ' trustline added') : (assetName + ' trustline removed'));
      });
    });
    // Swap arrow
    document.querySelectorAll('.swap-arrow').forEach(function(arrow){
      if (arrow.dataset.swapWired) return;
      arrow.dataset.swapWired = '1';
      arrow.addEventListener('click', function(){
        var pair = arrow.closest('.swap-pair');
        var picks = pair.querySelectorAll('.asset-pick');
        if (picks.length === 2) {
          var a = picks[0].innerHTML;
          picks[0].innerHTML = picks[1].innerHTML;
          picks[1].innerHTML = a;
        }
      });
    });
    // Max button
    document.querySelectorAll('.field-meta .pill-btn').forEach(function(btn){
      if ((btn.textContent || '').trim() !== 'Max') return;
      if (btn.dataset.maxWired) return;
      btn.dataset.maxWired = '1';
      btn.addEventListener('click', function(e){
        e.preventDefault();
        var field = btn.closest('.field');
        var input = field ? field.querySelector('input') : null;
        if (input) input.value = '25420.18';
      });
    });

    // ============ Toast on any copy trigger ============
    function isCopyTrigger(el) {
      if (!el) return false;
      if (el.matches && (el.matches('[data-copy]') || el.matches('[title="Copy"]'))) return true;
      if (el.classList && el.classList.contains('copy-i')) return true;
      return false;
    }
    if (!document.body.dataset.copyWired) {
      document.body.dataset.copyWired = '1';
      document.addEventListener('click', function(e){
        var trigger = null;
        var node = e.target;
        for (var i = 0; i < 5 && node; i++) {
          if (isCopyTrigger(node)) { trigger = node; break; }
          node = node.parentElement;
        }
        if (!trigger) return;
        var label = trigger.dataset.copyLabel;
        if (!label) {
          var wrap = trigger.closest('.detail-row, .wallet-row, .addr-row, .copy-wrap, .ws-addr');
          if (wrap) {
            var target = wrap.querySelector('.copy-target, .addr, .mono, .v, .v-mono, code');
            if (target) label = (target.textContent || '').trim().substring(0, 40);
          }
        }
        var msg = label ? (label.length > 24 && /^[A-Za-z0-9]/.test(label) ? (label.substring(0,8) + '…' + label.substring(label.length-6)) : label) + ' copied to clipboard' : 'Copied to clipboard';
        if (window.showToast) window.showToast(msg);
        try {
          var val = trigger.dataset.copy || label || '';
          if (val && navigator.clipboard) navigator.clipboard.writeText(val);
        } catch(err) {}
      });
    }

  });
})();
