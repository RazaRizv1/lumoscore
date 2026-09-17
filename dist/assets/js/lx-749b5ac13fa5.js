
// === Participants list injection ===
(function() {
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function() {
    var partList = document.getElementById('partList');
    if (!partList) return;
    var participants = [
      { addr: '0x0f6f…4572', share: 94.88, color: 'linear-gradient(135deg,#a855f7,#6d28d9)', a: 'A' },
      { addr: '0x0bc2…c3bd', share: 0.82,  color: 'linear-gradient(135deg,#6f5ded,#1e40af)', a: 'B' },
      { addr: '0x0abc…4e01', share: 0.57,  color: 'linear-gradient(135deg,#fb923c,#c2410c)', a: 'C' },
      { addr: '0x0fbc…d950', share: 0.30,  color: 'linear-gradient(135deg,#22d3ee,#0891b2)', a: 'D' },
      { addr: '0x04bc…a7a5', share: 0.22,  color: 'linear-gradient(135deg,#f43f5e,#9f1239)', a: 'E' },
      { addr: '0x0c59…340a', share: 0.22,  color: 'linear-gradient(135deg,#10b981,#047857)', a: 'F' },
      { addr: '0x0fef…8b0b', share: 0.19,  color: 'linear-gradient(135deg,#a3e635,#65a30d)', a: 'G' },
      { addr: '0x0af3…a8c8', share: 0.15,  color: 'linear-gradient(135deg,#94a3b8,#475569)', a: 'H' },
      { addr: '0x00bc…2b08', share: 0.14,  color: 'linear-gradient(135deg,#ec4899,#9d174d)', a: 'I' },
      { addr: '0x0a9f…5c02', share: 0.08,  color: 'linear-gradient(135deg,#6366f1,#3730a3)', a: 'J' },
      { addr: '0x0661…4497', share: 0.07,  color: 'linear-gradient(135deg,#14b8a6,#0f766e)', a: 'K' },
      { addr: '0x071d…8334', share: 0.06,  color: 'linear-gradient(135deg,#f59e0b,#b45309)', a: 'L' },
      { addr: '0x024d…61fc', share: 0.05,  color: 'linear-gradient(135deg,#ef4444,#991b1b)', a: 'M' },
      { addr: '0x0d25…4912', share: 0.04,  color: 'linear-gradient(135deg,#8b5cf6,#5b21b6)', a: 'N' },
      { addr: '0x0153…10a5', share: 0.03,  color: 'linear-gradient(135deg,#06b6d4,#0e7490)', a: 'O' },
      { addr: '0x03e5…356b', share: 0.02,  color: 'linear-gradient(135deg,#84cc16,#4d7c0f)', a: 'P' },
      { addr: '0x06b3…dacd', share: 0.02,  color: 'linear-gradient(135deg,#d946ef,#a21caf)', a: 'Q' }
    ];
    partList.innerHTML = participants.map(function(p) {
      var fillW = Math.max(2, Math.min(100, p.share)) + '%';
      return '<div class="part-row">' +
        '<div class="part-avatar">' + window.lxIdent(p.addr, 26) + '</div>' +
        '<div class="wallet">' + p.addr + '</div>' +
        '<div class="share">' + p.share.toFixed(2) + '%</div>' +
        '<div class="share-bar"><div class="fill" style="width:' + fillW + '"></div></div>' +
      '</div>';
    }).join('');
  });
})();
