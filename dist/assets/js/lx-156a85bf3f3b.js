(function runtime() {
  var FULL = { USDC: 'USD Coin', USDT0: 'Tether USD', XLM: 'Stellar Lumens', LUMOS: 'LumosCore', AQUA: 'Aquarius',
    yXLM: 'Ultra Stellar yXLM', yUSDC: 'Ultra Stellar yUSDC', SHX: 'Stronghold', BLND: 'Blend', EURC: 'Euro Coin' };

  function el(tag, cls, html) { var e = document.createElement(tag); e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function destNet() {
    var t = document.querySelector('.br-step[data-step="1"] .brd-trigger');
    if (!t) return { name: '', icon: '' };
    var nm = t.querySelector('.nm');
    var img = t.querySelector('img');
    var name = nm ? (nm.textContent || '').trim() : '';
    return { name: /select/i.test(name) ? '' : name, icon: img ? img.getAttribute('src') : '' };
  }

  function build() {
    var step = document.querySelector('.br-step[data-step="2"]');
    if (!step) return false;
    var sides = step.querySelectorAll('.br-io > .br-side');
    if (sides.length < 2) return false;
    var src = sides[0], dst = sides[1];

    if (!src.querySelector('.lx-s2net')) {
      // The source is always Stellar -- this page bridges OUT of the connected Stellar wallet -- so its pill is a
      // label, not a control, and carries no caret that would promise a choice that is not there.
      var srcIcon = src.querySelector('.br-wallet .br-ic img');
      var row = el('div', 'lx-s2net',
        '<span class="lx-s2lbl">From</span>'
        + '<span class="lx-s2pill"><span class="lx-s2ic">' + (srcIcon ? '<img src="' + esc(srcIcon.getAttribute('src')) + '" alt="">' : '') + '</span>'
        + '<span class="lx-s2nm">Stellar</span></span>');
      src.insertBefore(row, src.firstChild);
    }

    if (!dst.querySelector('.lx-s2net')) {
      var drow = el('div', 'lx-s2net',
        '<span class="lx-s2lbl">To</span>'
        + '<button type="button" class="lx-s2pill" data-lxs2dest><span class="lx-s2ic"></span><span class="lx-s2nm"></span><span class="lx-s2cv"></span></button>');
      dst.insertBefore(drow, dst.firstChild);
      // The destination is chosen on step 1, so the pill takes you back there to change it.
      drow.querySelector('[data-lxs2dest]').addEventListener('click', function (e) {
        e.preventDefault();
        var back = step.querySelector('.br-back');
        if (back) back.click();
        setTimeout(function () { var t = document.querySelector('.br-step[data-step="1"] .brd-trigger'); if (t) t.click(); }, 120);
      });
    }

    var wallet = dst.querySelector('.br-wallet.brw-in');
    if (wallet && !dst.querySelector('.lx-s2albl')) {
      dst.insertBefore(el('div', 'lx-s2albl', 'Receiving address'), wallet);
      var hint = el('div', 'lx-s2hint', '');
      if (wallet.nextSibling) dst.insertBefore(hint, wallet.nextSibling); else dst.appendChild(hint);
    }

    [src, dst].forEach(function (side) {
      var a = side.querySelector('.br-asset');
      if (a && !a.querySelector('.lx-s2full')) a.appendChild(el('span', 'lx-s2full', ''));
    });

    // Plain-text labels that change with the user's choices.
    var subs = step.querySelector('.br-sh p');
    if (subs && /Pick your assets/.test(subs.textContent)) {
      subs.textContent = 'Send your assets from one network to another. Choose the asset, amount and destination address.';
    }
    var next = step.querySelector('.br-actions .br-next');
    if (next && (next.textContent || '').trim() === 'Review') next.textContent = 'Review transfer';

    return true;
  }

  function sync() {
    var step = document.querySelector('.br-step[data-step="2"]');
    if (!step) return;
    var d = destNet();
    var pill = step.querySelector('[data-lxs2dest]');
    if (pill) {
      var ic = pill.querySelector('.lx-s2ic'), nm = pill.querySelector('.lx-s2nm');
      if (nm && nm.textContent !== d.name) nm.textContent = d.name || 'Choose network';
      var want = d.icon ? '<img src="' + esc(d.icon) + '" alt="">' : '';
      if (ic && ic.getAttribute('data-src') !== d.icon) { ic.innerHTML = want; ic.setAttribute('data-src', d.icon); }
    }
    var hint = step.querySelector('.lx-s2hint');
    if (hint) {
      var t = d.name ? 'Make sure the address is on ' + d.name : 'Make sure the address is on the destination network';
      if (hint.textContent !== t) hint.textContent = t;
    }
    var input = step.querySelector('.br-addr-in');
    if (input && d.name) {
      var ph = 'Enter ' + d.name + ' address';
      if (input.getAttribute('placeholder') !== ph) input.setAttribute('placeholder', ph);
    }
    // What arrives depends on the route (CCTP -> USDC, LayerZero -> USDT0). The USDT0 face and figure are our own
    // nodes, shown by CSS when the route layer marks <html>; the engine's USDC nodes stay untouched underneath.
    // ANY delivered token now, not only USDT0: NEAR Intents delivers whatever was picked (ETH, POL, WBTC...). The route
    // layer publishes the symbol, its logo and its name on <html>; this draws them. USDC is the engine's own face.
    var de = document.documentElement;
    var arr = de.getAttribute('data-lxroute-asset') || 'USDC';
    // NEAR Intents always draws its own face, USDC included: the engine's USDC face has no picker, so choosing USDC
    // there left the token stuck (RAZA 2026-09-19: 'once I've selected any receiving asset ... I can't change it')
    var viaOther = arr !== 'USDC' || de.getAttribute('data-lxroute') === 'NEAR Intents';
    var logo = de.getAttribute('data-lxroute-logo') || (arr === 'USDT0' ? '/assets/tokens/usdt0.png' : '');
    var sides = step.querySelectorAll('.br-io > .br-side');
    var dside = sides[1];
    if (dside) {
      var da = dside.querySelector('.br-asset');
      if (da && !da.querySelector('.lx-s2ic2')) {
        da.appendChild(el('span', 'lx-s2ic2', '<img src="/assets/tokens/usdt0.png" alt="">'));
        da.appendChild(el('span', 'lx-s2nm2', 'USDT0'));
      }
      if (da && viaOther) {
        var im = da.querySelector('.lx-s2ic2 img'), nm2 = da.querySelector('.lx-s2nm2');
        if (im && logo && im.getAttribute('src') !== logo) im.setAttribute('src', logo);
        if (nm2 && nm2.textContent !== arr) nm2.textContent = arr;
        // NEAR Intents: the token is the user's pick -- the face is the control that changes it (see the picker)
        da.classList.toggle('lx-s2pick', de.getAttribute('data-lxroute') === 'NEAR Intents');
      } else if (da) da.classList.remove('lx-s2pick');
      var dm = dside.querySelector('.br-amt');
      if (dm) {
        var rv = dm.querySelector('.lx-s2recv');
        if (!rv) { rv = el('div', 'lx-s2recv', ''); dm.appendChild(rv); }
        // empty = not quoted yet: a dash, never a 0.00 that would read as a real (and wrong) figure
        var raw = de.getAttribute('data-lxroute-recv') || '';
        var n = parseFloat(raw) || 0;
        // small figures (0.0075 ETH) keep their significant digits; dollar-ish ones read to 2 decimals
        var shown = n > 0 && n < 1 ? n.toPrecision(4) : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
        var txt = raw === '' ? '~ — ' + arr : '~ ' + shown + ' ' + arr;
        if (rv.textContent !== txt) rv.textContent = txt;
      }
    }
    step.querySelectorAll('.br-asset').forEach(function (a) {
      var code = ((a.querySelector('.nm') || {}).textContent || '').trim();
      if (viaOther && dside && dside.contains(a)) code = arr;
      var f = a.querySelector('.lx-s2full');
      // Any other curated asset shows the domain its issuer was verified against -- a real, checked fact about it.
      var full = (viaOther && dside && dside.contains(a) && de.getAttribute('data-lxroute-name')) || FULL[code] || (((window.LX_ASSETS || {})[code] || {}).dom) || '';
      if (f && f.textContent !== full) f.textContent = full;
    });
    // "Balance: 0.030 USDC" sits under a label that already says "Available to send", so the prefix is dropped.
    // Done here, in an observer that runs before paint, because the engine rewrites this text on every refresh.
    try { addScan(step); } catch (_) {}   // the engine can rebuild the address box; put the scan button back
    step.querySelectorAll('.lx-bal-txt').forEach(function (b) {
      var s = b.textContent || '';
      if (/^\s*Balance:\s*/i.test(s)) b.textContent = s.replace(/^\s*Balance:\s*/i, '');
    });
  }

  // ---- phones ---------------------------------------------------------------------------------------------------
  function isMob() { try { return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || ''); } catch (_) { return false; } }
  function toast(msg) {
    var t = el('div', 'lx-s2toast', ''); t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3200);
  }

  // The recipient from an EVM QR code. Wallets show a bare 0x address or an EIP-681 link. In a TOKEN transfer link
  // (ethereum:0xTOKEN@137/transfer?address=0xRECIPIENT) the first address is the token CONTRACT -- taking it would send
  // the funds to the contract -- so an explicit address= parameter always wins.
  function evmAddr(t) {
    t = String(t || '').trim();
    var p = /[?&]address=(0x[0-9a-fA-F]{40})\b/.exec(t); if (p) return p[1];
    var m = /0x[0-9a-fA-F]{40}/.exec(t); return m ? m[0] : '';
  }
  // jsQR is already self-hosted for the Wallet page's scanner; fetched only when someone taps Scan.
  var qrP = null;
  function qrLib() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    if (qrP) return qrP;
    qrP = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = '/assets/vendor/jsqr-1.4.0.min.js';
      s.onload = function () { window.jsQR ? res(window.jsQR) : rej(new Error('Scanner failed to load')); };
      s.onerror = function () { qrP = null; rej(new Error('Scanner failed to load')); };
      document.head.appendChild(s);
    });
    return qrP;
  }
  // The same sheet as the Wallet page's scanner: everything that can end it goes through stop(), so the camera is
  // never left running.
  function scan(net, onFound) {
    if (!window.isSecureContext) { toast('The camera needs a secure (https) connection.'); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('This browser cannot open the camera.'); return; }
    var ov = el('div', 'lx-qr', '');
    ov.innerHTML = '<video playsinline muted autoplay></video><div class="lx-qr-frame"></div>'
      + '<div class="lx-qr-hint">Point at ' + esc(net ? ('a ' + net) : 'the') + ' address QR code</div>'
      + '<button type="button" class="lx-qr-x">Cancel</button>';
    document.body.appendChild(ov);
    var vid = ov.querySelector('video'), stream = null, timer = 0, dead = false;
    function stop() {
      if (dead) return; dead = true; clearTimeout(timer);
      try { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); } catch (_) {}
      try { vid.srcObject = null; } catch (_) {}
      document.removeEventListener('keydown', onKey, true);
      if (ov.parentNode) ov.parentNode.removeChild(ov);
    }
    function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); stop(); } }
    document.addEventListener('keydown', onKey, true);
    ov.querySelector('.lx-qr-x').addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); stop(); });
    var cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
    qrLib().then(function (dec) {
      return navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }).then(function (st) {
        if (dead) { st.getTracks().forEach(function (t) { t.stop(); }); return; }
        stream = st; vid.srcObject = st;
        return vid.play().catch(function () {}).then(function () {
          (function tick() {
            if (dead) return;
            if (vid.readyState === vid.HAVE_ENOUGH_DATA) {
              var w = 480, h = Math.max(1, Math.round(vid.videoHeight * (w / (vid.videoWidth || w))));
              if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
              cx.drawImage(vid, 0, 0, w, h);
              var d = cx.getImageData(0, 0, w, h), r = null;
              try { r = dec(d.data, w, h, { inversionAttempts: 'attemptBoth' }); } catch (_) {}
              if (r && r.data) {
                var a = evmAddr(r.data); stop();
                if (a) onFound(a); else toast('That QR code has no ' + (net || 'EVM') + ' address in it.');
                return;
              }
            }
            timer = setTimeout(tick, 120);
          })();
        });
      });
    }).catch(function (err) {
      stop();
      var n = (err && err.name) || '';
      if (n === 'NotAllowedError' || n === 'SecurityError') toast('Camera permission was declined.');
      else if (n === 'NotFoundError' || n === 'OverconstrainedError') toast('No camera found on this device.');
      else toast((err && err.message) || 'Could not open the camera.');
    });
  }
  // A scan button beside Paste, wherever a camera meets a finger (on a desktop the camera faces the user; Paste is the
  // gesture there). Gated on the DEVICE, not its user agent: Chrome on an Android tablet does not call itself "Mobile",
  // and that is exactly where the clipboard is least reliable -- an overlay from another app can stop Chrome asking for
  // clipboard permission at all (RAZA 2026-09-20), leaving scan and long-press as the only ways in.
  function addScan(step) {
    var touch = false; try { touch = window.matchMedia('(pointer:coarse)').matches; } catch (_) {}
    if (!(touch || isMob()) || !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) return;
    var sides = step.querySelectorAll('.br-io > .br-side'), dst = sides[1]; if (!dst) return;
    var box = dst.querySelector('.br-wallet.brw-in'); if (!box || box.querySelector('.lx-scan')) return;
    var input = box.querySelector('.br-addr-in');
    var b = el('button', 'lx-scan', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/></svg>');
    b.type = 'button'; b.setAttribute('aria-label', 'Scan address QR code'); b.title = 'Scan QR code';
    var paste = box.querySelector('.br-paste');
    if (paste) box.insertBefore(b, paste); else box.appendChild(b);
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      scan(destNet().name, function (a) {
        if (!input) return;
        input.value = a; input.dispatchEvent(new Event('input', { bubbles: true })); input.blur();
      });
    });
  }

  // THE KEYPAD (RAZA 2026-09-19: "hide the keypad if I'm not typing"). A phone only closes it when the field loses
  // focus, and tapping text, a card or empty space does not take focus -- so it stayed up over the page. A tap
  // anywhere that is not itself a field (or the amount box, whose tap focuses its own input) now closes it.
  function wireKeypad() {
    if (window.__lxKbWired) return; window.__lxKbWired = 1;
    document.addEventListener('touchstart', function (e) {
      var a = document.activeElement;
      if (!a || !/^(INPUT|TEXTAREA)$/.test(a.tagName)) return;
      var t = e.target;
      if (t === a || (t && t.closest && t.closest('input,textarea,select,label,.br-amt,.br-paste,.lx-scan'))) return;
      a.blur();
    }, { passive: true, capture: true });
  }

  // THE NETWORK PICKER ON A PHONE opened at a fixed 344px wherever the field was, so it ran under the bottom tab
  // bar (measured: panel to 792px, tab bar from 740px). When it opens, scroll it into the clear space; if the screen
  // is too short for all of it, shorten the panel instead.
  function fitMenu() {
    var m = document.querySelector('.brd.open .brd-menu'); if (!m) return;
    var bar = document.querySelector('.nb-bar');
    var limit = (bar ? bar.getBoundingClientRect().top : window.innerHeight) - 10;
    var r = m.getBoundingClientRect(); if (r.bottom <= limit) return;
    m.style.scrollMarginBottom = Math.max(0, window.innerHeight - limit) + 'px';
    try { m.scrollIntoView({ block: 'nearest' }); } catch (_) { m.scrollIntoView(false); }
    r = m.getBoundingClientRect();
    if (r.bottom > limit) m.style.maxHeight = Math.max(180, Math.floor(limit - r.top)) + 'px';
  }
  function wireMenuFit() {
    var brd = document.querySelector('.br-step[data-step="1"] .brd'); if (!brd || brd.__lxFit) return; brd.__lxFit = 1;
    new MutationObserver(function () { if (brd.classList.contains('open')) setTimeout(fitMenu, 30); })
      .observe(brd, { attributes: true, attributeFilter: ['class'] });
  }

  function start() {
    if (!build()) return false;
    try { addScan(document.querySelector('.br-step[data-step="2"]')); wireKeypad(); if (isMob()) wireMenuFit(); } catch (_) {}
    sync();
    var root = document.querySelector('.bridge-wizard, .br-wizard, .br-card') || document.body;
    new MutationObserver(function () { try { sync(); } catch (_) {} })
      .observe(root, { childList: true, subtree: true, characterData: true });
    // The route choice is published on <html>, outside that subtree.
    new MutationObserver(function () { try { sync(); } catch (_) {} })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-lxroute-asset', 'data-lxroute-recv', 'data-lxroute', 'data-lxroute-logo', 'data-lxroute-name'] });
    return true;
  }

  if (!start()) {
    var tries = 0, iv = setInterval(function () { if (start() || ++tries > 60) clearInterval(iv); }, 150);
  }
})();