
// === Participants list injection ===
(function() {
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function() {
    var partList = document.getElementById('partList');
    if (!partList) return;
    var participants = [
      { addr: '0x0461…4dc9', share: 94.88, color: 'linear-gradient(135deg,#a855f7,#6d28d9)', a: 'A' },
      { addr: '0x0079…2f32', share: 0.82,  color: 'linear-gradient(135deg,#6f5ded,#1e40af)', a: 'B' },
      { addr: '0x046e…e72f', share: 0.57,  color: 'linear-gradient(135deg,#fb923c,#c2410c)', a: 'C' },
      { addr: '0x0d40…663e', share: 0.30,  color: 'linear-gradient(135deg,#22d3ee,#0891b2)', a: 'D' },
      { addr: '0x078d…a107', share: 0.22,  color: 'linear-gradient(135deg,#f43f5e,#9f1239)', a: 'E' },
      { addr: '0x0079…6e65', share: 0.22,  color: 'linear-gradient(135deg,#10b981,#047857)', a: 'F' },
      { addr: '0x0698…4517', share: 0.19,  color: 'linear-gradient(135deg,#a3e635,#65a30d)', a: 'G' },
      { addr: '0x0ea9…ca91', share: 0.15,  color: 'linear-gradient(135deg,#94a3b8,#475569)', a: 'H' },
      { addr: '0x0a29…1a74', share: 0.14,  color: 'linear-gradient(135deg,#ec4899,#9d174d)', a: 'I' },
      { addr: '0x057e…06a3', share: 0.08,  color: 'linear-gradient(135deg,#6366f1,#3730a3)', a: 'J' },
      { addr: '0x0bf9…232c', share: 0.07,  color: 'linear-gradient(135deg,#14b8a6,#0f766e)', a: 'K' },
      { addr: '0x0df2…87ea', share: 0.06,  color: 'linear-gradient(135deg,#f59e0b,#b45309)', a: 'L' },
      { addr: '0x0fdb…ea13', share: 0.05,  color: 'linear-gradient(135deg,#ef4444,#991b1b)', a: 'M' },
      { addr: '0x0e28…4142', share: 0.04,  color: 'linear-gradient(135deg,#8b5cf6,#5b21b6)', a: 'N' },
      { addr: '0x0e19…2ad2', share: 0.03,  color: 'linear-gradient(135deg,#06b6d4,#0e7490)', a: 'O' },
      { addr: '0x04c3…1194', share: 0.02,  color: 'linear-gradient(135deg,#84cc16,#4d7c0f)', a: 'P' },
      { addr: '0x032a…5d57', share: 0.02,  color: 'linear-gradient(135deg,#d946ef,#a21caf)', a: 'Q' }
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
