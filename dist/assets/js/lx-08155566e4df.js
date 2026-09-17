
  // Project type cards — toggle selection and update the live preview badge
  (function() {
    const MEME_SVG = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>';
    const UTIL_SVG = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';
    const badge = document.getElementById('previewTypeBadge');
    function updateBadge(type) {
      if (!badge) return;
      if (type === 'utility') {
        badge.innerHTML = UTIL_SVG + ' Utility Project';
      } else {
        badge.innerHTML = MEME_SVG + ' Meme Project';
      }
    }
    document.querySelectorAll('.type-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        const input = card.querySelector('input[type="radio"]');
        if (input) input.checked = true;
        updateBadge(card.getAttribute('data-type'));
      });
    });
  })();

  // Char counter
  const desc = document.getElementById('desc');
  const descCount = document.getElementById('descCount');
  desc.addEventListener('input', e => descCount.textContent = e.target.value.length);

  // Slider
  const fill = document.getElementById('sliderFill');
  const thumb = document.getElementById('sliderThumb');
  const shareNum = document.getElementById('shareNum');
  const previewShare = document.getElementById('previewShare');

  function setShare(v) {
    v = Math.max(0, Math.min(30, parseInt(v) || 0));
    var pct = (v / 30) * 100;
    fill.style.width = pct + '%';
    thumb.style.left = pct + '%';
    shareNum.value = v;
    previewShare.textContent = v;
  }
  shareNum.addEventListener('input', e => setShare(e.target.value));

  const track = thumb.parentElement;
  let dragging = false;
  thumb.addEventListener('mousedown', e => { dragging = true; e.preventDefault(); });
  document.addEventListener('mouseup', () => dragging = false);
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const rect = track.getBoundingClientRect();
    const v = Math.round(((e.clientX - rect.left) / rect.width) * 30);
    setShare(v);
  });
  track.addEventListener('click', e => {
    const rect = track.getBoundingClientRect();
    const v = Math.round(((e.clientX - rect.left) / rect.width) * 30);
    setShare(v);
  });

  // Collapsible
  document.getElementById('liqCollapse').querySelector('.collapsible-head').addEventListener('click', () => {
    document.getElementById('liqCollapse').classList.toggle('open');
  });

  // ============ Live preview wiring ============
  (function() {
    const nameInput = document.getElementById('tokenName');
    const tickerInput = document.getElementById('tokenTicker');
    const supplyInput = document.getElementById('supply');
    const descInput = document.getElementById('desc');
    const previewName = document.getElementById('previewName');
    const previewTicker = document.getElementById('previewTicker');
    const previewIcon = document.getElementById('previewIcon');
    const previewSupply = document.getElementById('previewSupply');
    const previewDesc = document.getElementById('previewDesc');
    const supplyTicker = document.getElementById('supplyTicker');

    let iconIsImage = false;

    if (nameInput && previewName) {
      nameInput.addEventListener('input', function() {
        previewName.textContent = nameInput.value.trim() || 'Your Token Name';
      });
    }
    if (tickerInput && previewTicker) {
      tickerInput.addEventListener('input', function() {
        const v = tickerInput.value.trim().toUpperCase();
        previewTicker.textContent = '$' + (v || 'TICKER');
        if (supplyTicker) supplyTicker.textContent = v || 'TOKEN';
        if (!iconIsImage && previewIcon) {
          previewIcon.textContent = v ? v.slice(0, 3) : ''; previewIcon.classList.toggle('empty', !v);
        }
      });
    }
    if (supplyInput && previewSupply) {
      supplyInput.addEventListener('input', function() {
        const raw = supplyInput.value.replace(/[^0-9.]/g, '');
        if (!raw) { previewSupply.textContent = '—'; recalcCost(); return; }
        const n = parseFloat(raw);
        if (isNaN(n)) { previewSupply.textContent = '—'; recalcCost(); return; }
        previewSupply.textContent = n.toLocaleString('en-US');
        recalcCost();
      });
    }
    if (descInput && previewDesc) {
      descInput.addEventListener('input', function() {
        const v = descInput.value.trim();
        if (v) {
          previewDesc.textContent = v;
          previewDesc.classList.remove('placeholder');
        } else {
          previewDesc.textContent = 'Your project description will appear here...';
          previewDesc.classList.add('placeholder');
        }
      });
    }

    // Image upload
    const zone = document.getElementById('iconUploadZone');
    const fileInput = document.getElementById('iconFileInput');
    const uploadIcon = document.getElementById('iconUploadIcon');
    const uploadTitle = document.getElementById('iconUploadTitle');
    const uploadSub = document.getElementById('iconUploadSub');

    function handleFile(file) {
      if (!file) return;
      if (!/^image[/](png|jpe?g|gif)$/i.test(file.type)) {
        if (window.showToast) window.showToast('Please choose a PNG, JPG, or GIF');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        if (window.showToast) window.showToast('File is too large (max 10MB)');
        return;
      }
      const reader = new FileReader();
      reader.onload = function(e) {
        const dataUrl = e.target.result;
        uploadIcon.innerHTML = '<img src="' + dataUrl + '" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block">';
        if (uploadTitle) uploadTitle.innerHTML = '<span class="lnk">' + (file.name.length > 28 ? file.name.slice(0, 28) + '…' : file.name) + '</span>';
        if (uploadSub) uploadSub.textContent = 'Click to replace';
        iconIsImage = true;
        if (previewIcon) {
          previewIcon.innerHTML = '<img src="' + dataUrl + '" alt="" style="width:100%;height:100%;box-sizing:border-box;padding:7px;border-radius:16px;object-fit:contain;display:block">';
        }
      };
      reader.readAsDataURL(file);
    }

    if (zone && fileInput) {
      zone.addEventListener('click', function() { fileInput.click(); });
      zone.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
      });
      fileInput.addEventListener('change', function() {
        if (fileInput.files && fileInput.files[0]) handleFile(fileInput.files[0]);
      });
      ['dragenter', 'dragover'].forEach(function(evt) {
        zone.addEventListener(evt, function(e) {
          e.preventDefault();
          e.stopPropagation();
          zone.style.borderColor = 'var(--accent)';
          zone.style.background = 'var(--accent-pale, rgba(234,106,44,0.08))';
        });
      });
      ['dragleave', 'drop'].forEach(function(evt) {
        zone.addEventListener(evt, function(e) {
          e.preventDefault();
          e.stopPropagation();
          zone.style.borderColor = '';
          zone.style.background = '';
        });
      });
      zone.addEventListener('drop', function(e) {
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files[0]) handleFile(dt.files[0]);
      });
    }

    // Extra liquidity → Total cost
    const BASE_CREATION_APT = 34.70;
    const BASE_LIQUIDITY_APT = 69.40;
    const BASE_NETWORK_APT = 69.40;
    const USD_PER_APT = 25 / 173.50;

    function fmtXlm(n) {
      return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' APT';
    }
    function fmtUsd(n) {
      if (n >= 100) return '≈ $' + Math.round(n).toLocaleString('en-US');
      return '≈ $' + n.toFixed(n < 10 ? 2 : 0);
    }

    const extraInput = document.getElementById('extraLiquidity');
    const rowLiquidity = document.getElementById('costLiquidity');
    const rowTotal = document.getElementById('costTotal');

    function recalcCost() {
      const extra = parseFloat((extraInput && extraInput.value) || '0') || 0;
      const liquidity = BASE_LIQUIDITY_APT + extra;
      const total = BASE_CREATION_APT + liquidity + BASE_NETWORK_APT;
      if (rowLiquidity) {
        rowLiquidity.innerHTML = fmtXlm(liquidity) + ' <span class="usd">' + fmtUsd(liquidity * USD_PER_APT) + '</span>';
      }
      if (rowTotal) {
        rowTotal.innerHTML = fmtXlm(total) + ' <span class="usd">' + fmtUsd(total * USD_PER_APT) + '</span>';
      }
    }
    if (extraInput) {
      extraInput.addEventListener('input', recalcCost);
    }
    window.__recalcCost = recalcCost;
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
