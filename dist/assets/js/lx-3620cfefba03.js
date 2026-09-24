
  // ============ Project type cards ============
  // Toggle visual selection + update the live preview badge to match.
  (function() {
    const MEME_SVG = '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>';
    const UTIL_SVG = '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';
    const badge = document.getElementById('previewTypeBadge');
    function updateBadge(type) {
      if (!badge) return;
      badge.innerHTML = (type === 'utility' ? UTIL_SVG : MEME_SVG) + ' ' + (type === 'utility' ? 'Utility Project' : 'Meme Project');
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

  // ============ Description char counter ============
  const desc = document.getElementById('desc');
  const descCount = document.getElementById('descCount');
  if (desc && descCount) {
    desc.addEventListener('input', e => descCount.textContent = e.target.value.length);
  }

  // ============ Live preview wiring (name, ticker, supply) ============
  (function() {
    const nameInput = document.getElementById('tokenName');
    const tickerInput = document.getElementById('tokenTicker');
    const supplyInput = document.getElementById('supply');
    const previewName = document.getElementById('previewName');
    const previewTicker = document.getElementById('previewTicker');
    const previewIcon = document.getElementById('previewIcon');
    const previewSupply = document.getElementById('previewSupply');
    const supplyTicker = document.getElementById('supplyTicker');

    // Track whether the icon was set from an upload so the ticker doesn't overwrite it
    let iconIsImage = false;
    window.__setIconIsImage = function(v) { iconIsImage = v; };

    if (nameInput && previewName) {
      nameInput.addEventListener('input', () => {
        previewName.textContent = nameInput.value.trim() || 'Your Token Name';
      });
    }
    if (tickerInput) {
      tickerInput.addEventListener('input', () => {
        const t = (tickerInput.value || '').toUpperCase().trim();
        if (previewTicker) previewTicker.textContent = t ? '$' + t : '$TICKER';
        if (previewIcon && !iconIsImage) previewIcon.textContent = t || 'SLR';
        if (supplyTicker) supplyTicker.textContent = t || 'SLR';
      });
    }
    if (supplyInput && previewSupply) {
      supplyInput.addEventListener('input', () => {
        const raw = supplyInput.value.replace(/[^\d]/g, '');
        const n = parseInt(raw, 10);
        if (!raw || isNaN(n)) {
          previewSupply.textContent = '—';
        } else {
          previewSupply.textContent = n.toLocaleString('en-US');
        }
      });
    }

    // Description -> preview
    const descInput = document.getElementById('desc');
    const previewDesc = document.getElementById('previewDesc');
    if (descInput && previewDesc) {
      descInput.addEventListener('input', () => {
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
  })();

  // ============ Logo upload (tap + drag/drop) ============
  (function() {
    const zone = document.getElementById('iconUploadZone');
    const fileInput = document.getElementById('iconFileInput');
    const zoneIcon = document.getElementById('iconUploadIcon');
    const zoneTitle = document.getElementById('iconUploadTitle');
    const zoneSub = document.getElementById('iconUploadSub');
    const previewIcon = document.getElementById('previewIcon');
    if (!zone || !fileInput) return;

    zone.addEventListener('click', () => fileInput.click());
    zone.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
    });

    function handleFile(file) {
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = e => {
        const url = 'url(' + JSON.stringify(e.target.result) + ')';
        if (previewIcon) {
          previewIcon.style.backgroundImage = e.target.result ? 'url("' + e.target.result + '")' : '';
          previewIcon.style.backgroundSize = 'contain';
          previewIcon.style.backgroundPosition = 'center';
          previewIcon.style.backgroundRepeat = 'no-repeat';
          previewIcon.textContent = '';
          previewIcon.classList.add('has-image');
          if (window.__setIconIsImage) window.__setIconIsImage(true);
        }
        if (zoneIcon) {
          zoneIcon.style.backgroundImage = 'url("' + e.target.result + '")';
          zoneIcon.classList.add('has-image');
          zoneIcon.innerHTML = '';
        }
        if (zoneTitle) zoneTitle.innerHTML = '<span class="lnk">' + (file.name || 'Uploaded') + '</span>';
        if (zoneSub) zoneSub.textContent = 'Tap to replace';
      };
      reader.readAsDataURL(file);
    }
    fileInput.addEventListener('change', e => {
      if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
    });

    // Drag-and-drop support (works on tablets / mobile-Chrome that support it)
    ['dragenter', 'dragover'].forEach(evt => {
      zone.addEventListener(evt, e => {
        e.preventDefault(); e.stopPropagation();
        zone.style.borderColor = 'var(--accent)';
      });
    });
    ['dragleave', 'drop'].forEach(evt => {
      zone.addEventListener(evt, e => {
        e.preventDefault(); e.stopPropagation();
        zone.style.borderColor = '';
      });
    });
    zone.addEventListener('drop', e => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    });
  })();

  // ============ Share slider ============
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
    if (previewShare) previewShare.textContent = v;
  }
  shareNum.addEventListener('input', e => setShare(e.target.value));

  const track = thumb.parentElement;
  let dragging = false;
  thumb.addEventListener('touchstart', e => { dragging = true; e.preventDefault(); });
  thumb.addEventListener('mousedown', e => { dragging = true; e.preventDefault(); });
  document.addEventListener('mouseup', () => dragging = false);
  document.addEventListener('touchend', () => dragging = false);
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const rect = track.getBoundingClientRect();
    const v = Math.round(((e.clientX - rect.left) / rect.width) * 30);
    setShare(v);
  });
  document.addEventListener('touchmove', e => {
    if (!dragging) return;
    const touch = e.touches[0];
    const rect = track.getBoundingClientRect();
    const v = Math.round(((touch.clientX - rect.left) / rect.width) * 30);
    setShare(v);
  });
  track.addEventListener('click', e => {
    const rect = track.getBoundingClientRect();
    const v = Math.round(((e.clientX - rect.left) / rect.width) * 30);
    setShare(v);
  });

  // ============ Collapsible (Additional Liquidity) ============
  document.getElementById('liqCollapse').querySelector('.collapsible-head').addEventListener('click', () => {
    document.getElementById('liqCollapse').classList.toggle('open');
  });

  // ============ Summary expand ============
  document.getElementById('summaryChevTap').addEventListener('click', () => {
    document.getElementById('summaryFixed').classList.toggle('open');
  });

  // ============ Cost recalc (extra liquidity → liquidity row + total) ============
  // Base fees in APT (shown defaults). USD derived from displayed defaults
  // (173.50 APT ≈ $25 → ~$0.1441 per APT).
  (function() {
    const BASE_CREATION_APT = 34.70;
    const BASE_LIQUIDITY_APT = 69.40;
    const BASE_NETWORK_APT = 69.40;
    const USD_PER_APT = 25 / 173.50;

    const extraInput = document.getElementById('extraLiquidity');
    const rowLiquidity = document.getElementById('costLiquidity');
    const rowTotal = document.getElementById('costTotal');

    function fmtXlm(n) {
      return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' APT';
    }
    function fmtUsd(n) {
      if (n >= 100) return '≈ $' + Math.round(n).toLocaleString('en-US');
      return '≈ $' + n.toFixed(n < 10 ? 2 : 0);
    }
    function recalc() {
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
    if (extraInput) extraInput.addEventListener('input', recalc);
  })();
