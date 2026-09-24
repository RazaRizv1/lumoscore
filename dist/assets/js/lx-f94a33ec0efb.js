
// === Share modal wiring ===
document.addEventListener('DOMContentLoaded', function() {
  var modal = document.getElementById('modalShare');
  if (!modal) return;

  // Find Share action button (text "Share with Community")
  var triggers = Array.prototype.filter.call(
    document.querySelectorAll('.action-btn, button, a'),
    function(el) { return /share with community/i.test(el.textContent || ''); }
  );

  function openShare(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Wire share URLs at open time so we have the current page URL
    var url = encodeURIComponent(window.location.href || 'https://lumoscore.app');
    var text = encodeURIComponent('Just launched Aptos Coin ($APT) on LumosCore — check it out!');
    var endpoints = {
      x:        'https://twitter.com/intent/tweet?text=' + text + '&url=' + url,
      telegram: 'https://t.me/share/url?url=' + url + '&text=' + text,
      whatsapp: 'https://wa.me/?text=' + text + '%20' + url,
      reddit:   'https://www.reddit.com/submit?url=' + url + '&title=' + text,
      linkedin: 'https://www.linkedin.com/sharing/share-offsite/?url=' + url,
      facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + url
    };
    modal.querySelectorAll('.share-tile[data-platform]').forEach(function(tile) {
      var p = tile.getAttribute('data-platform');
      if (endpoints[p]) tile.setAttribute('href', endpoints[p]);
    });
  }
  function closeShare() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  triggers.forEach(function(el) {
    el.addEventListener('click', openShare);
  });

  modal.querySelectorAll('[data-close]').forEach(function(el) {
    el.addEventListener('click', function(e) { e.preventDefault(); closeShare(); });
  });
  modal.addEventListener('click', function(e) { if (e.target === modal) closeShare(); });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeShare();
  });

  var copyBtn = document.getElementById('shareCopyBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', function(e) {
      e.preventDefault();
      var url = window.location.href || 'https://lumoscore.app';
      try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url); } catch(_) {}
      if (window.showToast) window.showToast('Link copied to clipboard');
      closeShare();
    });
  }
});
