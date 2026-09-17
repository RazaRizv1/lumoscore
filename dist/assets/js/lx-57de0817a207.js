
// ===== Wallet Trustlines modal: search + add + existing list with remove =====
(function() {
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  ready(function() {
    var modal = document.getElementById('modalTrustlines');
    if (!modal) return;
    var input = document.getElementById('tlSearchInput');
    var suggBox = document.getElementById('tlSuggestions');
    var existingList = document.getElementById('tlExistingList');
    var existingCount = document.getElementById('tlExistingCount');
    if (!input || !suggBox || !existingList) return;

    // Pool of all available trustlines (searchable)
    var allTrustlines = [
      { code:'USDC',  issuer:'Circle',          addr:'0x0766…9075', col:'linear-gradient(135deg,#2775ca,#1a5491)', ic:'U' },
      { code:'CELL',  issuer:'Cellana',        addr:'0x008d…b282', col:'linear-gradient(135deg,#22d3ee,#0891b2)', ic:'A' },
      { code:'LUMOS', issuer:'LumosCore',       addr:'0x03cc…d71b', col:'linear-gradient(135deg,#ea6a2c,#ff9a3d)', ic:'L' },
      { code:'GUI',  issuer:'Gui Inu',    addr:'0x0a82…f4de', col:'linear-gradient(135deg,#35c07f,#16a34a)', ic:'K' },
      { code:'EURC', issuer:'Schuman Finance', addr:'0x0e6a…63c5', col:'linear-gradient(135deg,#fbbf24,#d97706)', ic:'E' },
      { code:'USDC', issuer:'Ripple',          addr:'0x0962…0e66', col:'linear-gradient(135deg,#6f5ded,#1e40af)', ic:'R' },
      { code:'WBTC', issuer:'Wrapped Bitcoin',         addr:'0x0869…002b', col:'linear-gradient(135deg,#f43f5e,#9f1239)', ic:'P' },
      { code:'RION',  issuer:'Hyperion',         addr:'0x06d0…8b5a', col:'linear-gradient(135deg,#10b981,#047857)', ic:'G' },
      { code:'MOD',  issuer:'Move Dollar',    addr:'0x0b93…15bd', col:'linear-gradient(135deg,#a855f7,#6d28d9)', ic:'N' },
      { code:'XDC',   issuer:'XDC Network',     addr:'0x00e3…a34b', col:'linear-gradient(135deg,#06b6d4,#0e7490)', ic:'X' },
    ];

    // Currently added trustlines (the "your trustlines" list)
    var addedCodes = ['USDC', 'CELL', 'LUMOS'];

    function renderExisting() {
      var added = allTrustlines.filter(function(t) { return addedCodes.indexOf(t.code) >= 0; });
      if (added.length === 0) {
        existingList.innerHTML = '<div class="tl-empty">No trustlines yet. Search above to add your first one.</div>';
      } else {
        existingList.innerHTML = added.map(function(t) {
          return '<div class="tl-row added" data-code="' + t.code + '">' +
            '<div class="tl-ico" style="background:' + t.col + '">' + t.ic + '</div>' +
            '<div class="tl-info">' +
              '<div class="tl-nm">' + t.code + ' <span style="color:var(--text-soft);font-size:14px;font-weight:500;margin-left:4px">· ' + t.issuer + '</span></div>' +
              '<div class="tl-sub">' + t.addr + '</div>' +
            '</div>' +
            '<button class="tl-action remove">Remove</button>' +
          '</div>';
        }).join('');
      }
      var n = added.length;
      var reserve = (n * 0.5).toFixed(1);
      existingCount.textContent = n + ' active · ' + reserve + ' APT reserved';
    }

    function renderSuggestions(query) {
      var q = query.toLowerCase().trim();
      if (!q) {
        suggBox.classList.remove('open');
        suggBox.innerHTML = '';
        return;
      }
      var available = allTrustlines.filter(function(t) {
        return addedCodes.indexOf(t.code) < 0 &&
               (t.code.toLowerCase().indexOf(q) >= 0 ||
                t.issuer.toLowerCase().indexOf(q) >= 0);
      });
      if (available.length === 0) {
        suggBox.innerHTML = '<div class="tl-suggestion" style="cursor:default;color:var(--text-soft);font-size:17px"><div class="tl-s-info">No assets match — try a different search</div></div>';
      } else {
        suggBox.innerHTML = available.slice(0, 6).map(function(t) {
          return '<div class="tl-suggestion" data-code="' + t.code + '">' +
            '<div class="tl-s-ico" style="background:' + t.col + '">' + t.ic + '</div>' +
            '<div class="tl-s-info">' +
              '<div class="tl-s-nm">' + t.code + ' <span style="color:var(--text-soft);font-size:14px;font-weight:500;margin-left:4px">· ' + t.issuer + '</span></div>' +
              '<div class="tl-s-sub">' + t.addr + '</div>' +
            '</div>' +
            '<button class="tl-s-add">Add</button>' +
          '</div>';
        }).join('');
      }
      suggBox.classList.add('open');
    }

    input.addEventListener('input', function() {
      renderSuggestions(input.value);
    });
    input.addEventListener('focus', function() {
      if (input.value) renderSuggestions(input.value);
    });
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.tl-search-wrap')) {
        suggBox.classList.remove('open');
      }
    });

    // Delegate clicks on suggestions
    suggBox.addEventListener('click', function(e) {
      var sugg = e.target.closest('.tl-suggestion[data-code]');
      if (!sugg) return;
      var code = sugg.dataset.code;
      if (addedCodes.indexOf(code) < 0) {
        addedCodes.push(code);
        renderExisting();
        if (window.showToast) window.showToast(code + ' trustline added');
        // Clear search + close suggestions
        input.value = '';
        suggBox.classList.remove('open');
      }
    });

    // Delegate clicks on Remove buttons
    existingList.addEventListener('click', function(e) {
      var btn = e.target.closest('.tl-action.remove');
      if (!btn) return;
      var row = btn.closest('.tl-row');
      if (!row) return;
      var code = row.dataset.code;
      var idx = addedCodes.indexOf(code);
      if (idx >= 0) addedCodes.splice(idx, 1);
      // Animate row out
      row.style.transition = 'opacity .2s, transform .2s';
      row.style.opacity = '0';
      row.style.transform = 'translateX(-8px)';
      setTimeout(function() {
        renderExisting();
      }, 200);
      if (window.showToast) window.showToast(code + ' trustline removed');
    });

    renderExisting();
  });
})();
