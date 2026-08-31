// Trade-Asset: save the chart as a shareable card.
//
// A camera in the chart's control strip, beside $ / XLM. One tap draws the asset's current state onto
// a canvas at social-card size and hands the file to the browser -- a download on a desktop, the share
// sheet on a phone, which is the only route that reliably reaches the camera roll on iOS.
//
// THE CARD IS LIT BY THE MOVE. The chart is the light source rather than something decorated around:
// the line runs dim at the start of the window and reaches full strength at now, and the colour it
// ends on is thrown across the card behind it. A green day is lit green, a red day red. Everything
// else on the card stays quiet so that one thing lands.
//
// EVERY VALUE IS READ OFF THE PAGE, never recomputed. The headline price, the change pill, the high and
// low, the 24h/7d/1m/3m windows -- all of them are the strings the page is already showing, so a card
// can never disagree with the screen it was taken from. The series comes from the chart's own points
// (#dxaChart.__lxpts), which is what the plot itself was drawn from.
//
// THE LOGO IS NEVER DRAWN BY US. It is the asset's real mark: whatever LumosCore has for it (an admin
// upload, served same-origin) or its issuer's toml artwork, fetched through our own /lxapi/logoimg so
// the canvas stays untainted -- a cross-origin image would make toBlob throw SecurityError and there
// would be no card at all. Only when an asset genuinely has no mark does it get a placeholder, and the
// placeholder is initials on a neutral disc, the same stand-in the page itself uses.
//
// ES5 on purpose -- var, function, .then. Everything injected into these pages is written that way for
// the wallet-browser range, and this file is no exception.
(function () {
  'use strict';
  if (window.__lxSnapCard) return;
  window.__lxSnapCard = 1;

  var CAM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" '
    + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2a1 1 0 0 0 .84-.46l.92-1.42A1 1 0 0 1 9.3 4.7h5.4a1 1 0 0 1 .84.42l.92 1.42A1 1 0 0 0 17.3 7h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z"/>'
    + '<circle cx="12" cy="13" r="3.4"/></svg>';

  // Palettes, straight from the approved card design. Light is not an inversion of dark: it takes its
  // own greens and reds because the dark-ground values have too little contrast on white.
  var TH = {
    dark: {
      bg: '#08080a', ink: '#ffffff', muted: '#8a8fa3', axis: '#6f7484',
      grid: 'rgba(255,255,255,.028)', edge: 'rgba(255,255,255,.08)',
      winA: 'rgba(255,255,255,.075)', winB: 'rgba(255,255,255,.022)',
      winLine: 'rgba(255,255,255,.09)', wash: 'rgba(234,106,44,.24)',
      qrBg: '#ffffff', qrFg: '#08080a', tickInk: '#08080a', grain: 0.05,
      rule: 'rgba(255,255,255,.10)',
    },
    light: {
      bg: '#ffffff', ink: '#0e0e12', muted: '#6b7180', axis: '#8b909c',
      grid: 'rgba(14,14,18,.04)', edge: 'rgba(14,14,18,.09)',
      winA: 'rgba(14,14,18,.055)', winB: 'rgba(14,14,18,.015)',
      winLine: 'rgba(14,14,18,.08)', wash: 'rgba(234,106,44,.11)',
      qrBg: '#0e0e12', qrFg: '#ffffff', tickInk: '#ffffff', grain: 0.03,
      rule: 'rgba(14,14,18,.10)',
    },
  };
  // c = the line and the figures. g = how hard the endpoint's light is thrown across the card.
  var DIR = {
    up: {
      dark: { c: '#35c07f', s: 'rgba(53,192,127,.13)', l: 'rgba(53,192,127,.26)', g: 'rgba(53,192,127,.30)' },
      light: { c: '#0f8a56', s: 'rgba(15,138,86,.10)', l: 'rgba(15,138,86,.22)', g: 'rgba(15,138,86,.12)' },
    },
    down: {
      dark: { c: '#e0553c', s: 'rgba(224,85,60,.13)', l: 'rgba(224,85,60,.26)', g: 'rgba(224,85,60,.27)' },
      light: { c: '#bf3b23', s: 'rgba(191,59,35,.09)', l: 'rgba(191,59,35,.20)', g: 'rgba(191,59,35,.11)' },
    },
  };
  var ACCENT = '#ea6a2c';
  var UI = "'Hanken Grotesk',system-ui,sans-serif";
  var MONO = "'JetBrains Mono',ui-monospace,monospace";

  function q(s) { return document.querySelector(s); }
  function qa(s) { var a = []; var l = document.querySelectorAll(s); for (var i = 0; i < l.length; i++) a.push(l[i]); return a; }
  function txt(sel) { var e = q(sel); return e ? String(e.textContent).replace(/\s+/g, ' ').trim() : ''; }

  // ---------------------------------------------------------------------------------------------
  // The button
  // ---------------------------------------------------------------------------------------------
  // chartUi() in the data layer re-homes the $ / XLM tray on every apply -- into the plot's corner on
  // a wide column, into the .chart-controls row when it wraps -- so the camera cannot be placed once.
  // It follows that tray wherever it goes, and re-reads its offset, because inside the plot the trays
  // are absolutely positioned and their left is measured from the width of the one before.
  function place() {
    var denom = q('.lxda-denom');
    if (!denom || !denom.parentNode) return;
    var grp = q('.lxda-snap');
    if (!grp) {
      grp = document.createElement('div');
      grp.className = 'chart-tools lxda-snap';
      // The container ships a logo engine that replaces the contents of any short-labelled element
      // inside a rounded box with a token image; it ate the identical $ / XLM tray before this
      // attribute was added to it. An icon-only button is exactly the shape it looks for.
      grp.setAttribute('data-logo', '');
      grp.innerHTML = '<button type="button" data-lxsnap="1" title="Save snapshot" '
        + 'aria-label="Save a snapshot of this chart" data-logo="">' + CAM + '</button>';
    }
    if (grp.parentNode !== denom.parentNode || denom.nextSibling !== grp) {
      denom.parentNode.insertBefore(grp, denom.nextSibling);
    }
    // Inside the plot: sit on the same line as the unit tray, one gap to its right. In the controls
    // row it is a normal flex child and must not carry a stale offset from the other layout.
    try {
      var inPlot = grp.parentNode && grp.parentNode.id
        && (grp.parentNode.id === 'dxaChart' || grp.parentNode.id === 'mdxaChart');
      if (inPlot) {
        var left = (denom.offsetLeft + denom.offsetWidth + 6) + 'px';
        if (grp.style.left !== left) grp.style.left = left;
        if (grp.style.top !== '8px') grp.style.top = '8px';
      } else if (grp.style.left || grp.style.top) {
        grp.style.left = ''; grp.style.top = '';
      }
    } catch (e) { /* placement is cosmetic; the button still works where it landed */ }
  }

  var pending = 0;
  function schedule() {
    if (pending) return;
    pending = 1;
    requestAnimationFrame(function () { pending = 0; place(); });
  }

  function watch() {
    place();
    // The tray is created by the data layer some time after this script runs, and is re-created when
    // the layout crosses its breakpoint. place() is a no-op once the position is already right, so
    // this observer cannot feed itself.
    try {
      new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    } catch (e) { /* no observer: the interval below still catches it */ }
    window.addEventListener('resize', schedule);
    var tries = 0;
    var iv = setInterval(function () { place(); if (++tries > 60 || q('.lxda-snap')) clearInterval(iv); }, 400);
  }

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'lxsnap-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('on'); });
    setTimeout(function () {
      t.classList.remove('on');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 260);
    }, 3200);
  }

  // ---------------------------------------------------------------------------------------------
  // What the card says -- all of it lifted off the page as painted
  // ---------------------------------------------------------------------------------------------
  function fmtN(v) {
    if (!isFinite(v)) return '0';
    var a = Math.abs(v);
    if (a === 0) return '0';
    var d = a >= 1000 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 5 : a >= 0.0001 ? 7 : 9;
    var s = v.toFixed(d);
    if (s.indexOf('.') >= 0) { s = s.replace(/0+$/, ''); if (s.charAt(s.length - 1) === '.') s = s.slice(0, -1); }
    return s;
  }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function stamp(d) {
    return d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear()
      + ' · ' + pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + ' UTC';
  }

  function model() {
    var code = window.__lxDXAcode || txt('.asset-ticker') || '';
    var issuer = window.__lxDXAissuer || '';
    var native = !!window.__lxDXAnative;
    var xlmUsd = parseFloat(window.__lxDXAxlmUsd) || 0;
    var denom = (window.__lxAsDenom === 'usd') ? 'usd' : 'xlm';

    var pc = q('#dxaChart') || q('#mdxaChart');
    var raw = (pc && pc.__lxpts) || [];
    // __lxpts is stored in USD per unit whatever the toggle says; the toggle is applied at label time.
    var series = [], vols = [], i;
    for (i = 0; i < raw.length; i++) {
      var v = parseFloat(raw[i].v);
      if (!isFinite(v)) continue;
      series.push(denom === 'xlm' && xlmUsd > 0 ? v / xlmUsd : v);
      vols.push(Math.max(0, parseFloat(raw[i].vol) || 0));
    }

    // "0.0275049 XLM" or "$0.0048145" -- the page has already chosen the unit and the precision.
    var big = txt('.price-display .big'), num = big, unit = '';
    if (big.charAt(0) === '$') { unit = '$'; num = big.slice(1).trim(); }
    else { var sp = big.lastIndexOf(' '); if (sp > 0) { unit = big.slice(sp + 1); num = big.slice(0, sp); } }

    // The other denomination, as the quiet second line.
    var last = series.length ? series[series.length - 1] : 0;
    var alt = '';
    if (denom === 'xlm' && xlmUsd > 0) alt = '$' + fmtN(last * xlmUsd);
    else if (denom === 'usd' && xlmUsd > 0) alt = fmtN(last / xlmUsd) + ' XLM';

    var pillEl = q('.price-display .change-pill');
    var dir = 'up', chg = '';
    if (pillEl) {
      if (pillEl.classList.contains('down')) dir = 'down';
      chg = String(pillEl.textContent).replace(/\s+/g, ' ').trim();
      // "▲ 8.88% (24h)" -> "8.88%"; the arrow and the window are redrawn by the card.
      var pm = chg.match(/-?[\d.,]+%/);
      chg = pm ? pm[0] : '';
    }
    // A pill can be missing or flat; the series then decides which way the card is lit.
    if (!pillEl && series.length > 1) dir = series[series.length - 1] >= series[0] ? 'up' : 'down';

    // High and low. The OHLC strip is the canonical pair and both builds carry it, keyed by its own
    // labels rather than by position -- the phone has no .price-display .meta at all, which is why the
    // portrait card came out with no water marks the first time. The meta line stays as the fallback.
    // Either way the unit is stripped: the page appends it ("0.029 XLM"), the card's headline already
    // says it once, and repeated in a 13px axis label it pushed the high mark into the change pill.
    function bare(s) { return String(s || '').trim().replace(/\s*(XLM|\$)\s*$/i, '').trim(); }
    var hi = '', lo = '';
    qa('.ohlc-strip .pair').forEach(function (p) {
      var k = (p.querySelector('.k') || {}).textContent, v = (p.querySelector('.v') || {}).textContent;
      k = String(k || '').trim().toUpperCase();
      if (k === 'H' && !hi) hi = bare(v);
      if (k === 'L' && !lo) lo = bare(v);
    });
    if (!hi && !lo) {
      var hl = qa('.price-display .meta b.mono');
      hi = bare(hl[0] && hl[0].textContent);
      lo = bare(hl[1] && hl[1].textContent);
    }

    // The window grid ships 1h/24h/7d/1m/3m/6m; the card takes the four the design settled on.
    var WANT = [['24h', '24H'], ['7d', '7D'], ['1m', '1M'], ['3m', '3M']];
    var have = {};
    qa('.dxa-perf-cell,.mdxa-perf-cell').forEach(function (c) {
      var k = c.querySelector('.tf'), v = c.querySelector('.ch');
      if (k && v) have[k.textContent.trim().toLowerCase()] = v.textContent.trim();
    });
    var wins = [];
    for (i = 0; i < WANT.length; i++) {
      var val = have[WANT[i][0]];
      if (val && val !== '—') wins.push([WANT[i][1], val]);
    }

    var tfEl = q('.timeframes button.active') || q('.timeframes button');
    // Scoped to the asset header, and only when the page is actually showing it: applyHeader keeps the
    // link hidden until it has a home domain, and an unscoped a.website can pick up something from the
    // ad column instead. A card that names the wrong project is worse than one that names none.
    var wEl = q('.asset-meta-row a.website');
    var dom = '';
    try {
      if (wEl && getComputedStyle(wEl).display !== 'none') {
        dom = String(wEl.textContent).trim()
          .replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
      }
    } catch (e) { dom = ''; }

    return {
      code: code, issuer: issuer, native: native, verified: !!q('.lx-vtick'),
      domain: dom, price: num, unit: unit, alt: alt, chg: chg, dir: dir,
      hi: hi, lo: lo, wins: wins, series: series, vols: vols,
      tf: tfEl ? tfEl.textContent.trim() : '', denom: denom,
      url: location.origin + location.pathname,
      short: location.host.replace(/^www\./i, '') + '/trade',
      theme: document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
    };
  }

  // ---------------------------------------------------------------------------------------------
  // The asset's real mark
  // ---------------------------------------------------------------------------------------------
  function sameOrigin(u) {
    try { return new URL(u, location.href).origin === location.origin; } catch (e) { return false; }
  }
  function loadImg(src, cross) {
    return new Promise(function (res) {
      if (!src) { res(null); return; }
      var im = new Image();
      if (cross) im.crossOrigin = 'anonymous';
      im.onload = function () { res(im.naturalWidth ? im : null); };
      im.onerror = function () { res(null); };
      im.src = src;
    });
  }
  // The issuer's home domain arrives late -- it comes from the issuer account on Horizon, and until it
  // does the page keeps the link display:none over its baked sample value. So the card gives it a short
  // grace period rather than either omitting it from a card taken two seconds early or, worse, reading
  // the sample underneath. Bounded, and it runs alongside the logo fetch, so it usually costs nothing.
  function waitDom() {
    return new Promise(function (res) {
      var tries = 0;
      (function poll() {
        var w = q('.asset-meta-row a.website');
        var vis = false;
        try { vis = !!w && getComputedStyle(w).display !== 'none'; } catch (e) { vis = false; }
        if (vis) {
          res(String(w.textContent).trim()
            .replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, ''));
          return;
        }
        if (++tries > 10) { res(''); return; }
        setTimeout(poll, 120);
      })();
    });
  }

  function pageLogoUrl() {
    var el = q('.asset-logo');
    if (!el) return '';
    var bg = '';
    try { bg = getComputedStyle(el).backgroundImage || ''; } catch (e) { return ''; }
    var at = bg.indexOf('url(');
    if (at < 0) return '';
    var end = bg.indexOf(')', at);
    if (end < 0) return '';
    return bg.slice(at + 4, end).replace(/^\s*["']|["']\s*$/g, '');
  }
  // Resolution order, and the reason for it:
  //   1. what the page is showing, when that is already on our origin -- an admin upload through
  //      /lxapi/media, or a baked /assets/tokens file. Guaranteed to match the screen, and safe for
  //      the canvas.
  //   2. /lxapi/logoimg, which resolves the admin override and then the issuer's toml and proxies the
  //      bytes from our origin. This is what covers an asset whose mark lives on someone else's
  //      domain -- loading that directly would taint the canvas and toBlob would throw.
  //   3. the page's own cross-origin url, but only if that host sends CORS headers. Best effort; it
  //      either arrives clean or not at all.
  //   4. the page's placeholder, if that is what it is showing.
  // Anything past that and the asset has no mark, and the card draws initials.
  function logo(m) {
    var url = pageLogoUrl();
    var isPlaceholder = url.indexOf('data:') === 0;
    var first = (url && !isPlaceholder && sameOrigin(url)) ? loadImg(url, false) : Promise.resolve(null);
    return first.then(function (a) {
      if (a) return a;
      if (m.code && m.issuer && !m.native) {
        return loadImg('/lxapi/logoimg?asset=' + encodeURIComponent(m.code + '-' + m.issuer), false);
      }
      return null;
    }).then(function (b) {
      if (b) return b;
      if (url && !isPlaceholder && !sameOrigin(url)) return loadImg(url, true);
      return null;
    }).then(function (c) {
      if (c) return c;
      if (isPlaceholder) return loadImg(url, false);
      return null;
    }).catch(function () { return null; });
  }

  // The halo behind the mark is the mark's own colour, so it belongs to the asset rather than to us.
  // Averaged over a tiny downscale, then pushed away from grey -- a flat average of a colourful logo
  // comes back muddy, and a muddy halo reads as a smudge.
  function logoColor(img) {
    if (!img) return ACCENT;
    try {
      var c = document.createElement('canvas'); c.width = 10; c.height = 10;
      var g = c.getContext('2d');
      g.drawImage(img, 0, 0, 10, 10);
      var d = g.getImageData(0, 0, 10, 10).data;
      var r = 0, gg = 0, b = 0, n = 0;
      for (var i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 40) continue;                       // ignore transparent padding
        r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++;
      }
      if (!n) return ACCENT;
      r /= n; gg /= n; b /= n;
      var mean = (r + gg + b) / 3;
      var K = 1.55;                                        // saturation push
      r = Math.max(0, Math.min(255, mean + (r - mean) * K));
      gg = Math.max(0, Math.min(255, mean + (gg - mean) * K));
      b = Math.max(0, Math.min(255, mean + (b - mean) * K));
      return 'rgb(' + Math.round(r) + ',' + Math.round(gg) + ',' + Math.round(b) + ')';
    } catch (e) { return ACCENT; }
  }
  function rgba(rgb, a) {
    var m = /rgb\((\d+),(\d+),(\d+)\)/.exec(rgb);
    if (!m) return 'rgba(234,106,44,' + a + ')';
    return 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',' + a + ')';
  }

  // ---------------------------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------------------------
  function rr(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function font(weight, size, fam) { return weight + ' ' + size + 'px ' + fam; }
  // Positions text by the TOP of its ink, not by a baseline, so the layout below reads like the css
  // it came from. Returns the advance width, which several rows need to place the next thing.
  function tx(g, str, x, yTop, size, weight, fam, color, align) {
    g.font = font(weight, size, fam);
    g.fillStyle = color;
    g.textAlign = align || 'left';
    g.textBaseline = 'alphabetic';
    var m = g.measureText(str);
    var asc = m.actualBoundingBoxAscent;
    if (!isFinite(asc) || asc <= 0) asc = size * 0.72;
    g.fillText(str, x, yTop + asc);
    return m.width;
  }
  function wid(g, str, size, weight, fam) {
    g.font = font(weight, size, fam);
    return g.measureText(str).width;
  }

  var grainPat = null;
  function grain(g, W, H, alpha) {
    if (!alpha) return;
    if (!grainPat) {
      var c = document.createElement('canvas'); c.width = 128; c.height = 128;
      var gc = c.getContext('2d');
      var im = gc.createImageData(128, 128);
      // A fixed generator, so the same card drawn twice is the same file.
      var seed = 20260831;
      for (var i = 0; i < im.data.length; i += 4) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        var v = 108 + ((seed >> 16) & 63);
        im.data[i] = v; im.data[i + 1] = v; im.data[i + 2] = v; im.data[i + 3] = 255;
      }
      gc.putImageData(im, 0, 0);
      grainPat = c;
    }
    g.save();
    g.globalCompositeOperation = 'overlay';
    g.globalAlpha = alpha;
    var p = g.createPattern(grainPat, 'repeat');
    g.fillStyle = p;
    g.fillRect(0, 0, W, H);
    g.restore();
  }

  // The glyph: the mark inside a rounded square, lit by its own colour.
  function drawGlyph(g, img, x, y, size, code, col, th) {
    var r = size * 0.26;
    // halo first, behind everything
    var hg = g.createRadialGradient(x + size / 2, y + size / 2, 0, x + size / 2, y + size / 2, size * 1.2);
    hg.addColorStop(0, rgba(col, 0.34));
    hg.addColorStop(1, rgba(col, 0));
    g.fillStyle = hg;
    g.fillRect(x - size * 0.7, y - size * 0.7, size * 2.4, size * 2.4);

    g.save();
    rr(g, x, y, size, size, r);
    g.clip();
    if (img) {
      // cover-fit, never squashed
      var s = Math.max(size / img.naturalWidth, size / img.naturalHeight);
      var w = img.naturalWidth * s, h = img.naturalHeight * s;
      g.fillStyle = th.bg;
      g.fillRect(x, y, size, size);
      g.drawImage(img, x + (size - w) / 2, y + (size - h) / 2, w, h);
    } else {
      // No mark for this asset. Initials on a neutral disc -- the same stand-in the page uses.
      var lg = g.createLinearGradient(x, y, x + size, y + size);
      lg.addColorStop(0, th.bg === '#ffffff' ? '#e9e9ee' : '#26262e');
      lg.addColorStop(1, th.bg === '#ffffff' ? '#d6d6de' : '#171720');
      g.fillStyle = lg;
      g.fillRect(x, y, size, size);
      var ini = (code || '?').slice(0, 2).toUpperCase();
      tx(g, ini, x + size / 2, y + size * 0.31, size * 0.38, '800', UI, th.muted, 'center');
    }
    g.restore();
    // A hairline lip, so a white logo does not bleed into a white card.
    rr(g, x + 0.5, y + 0.5, size - 1, size - 1, r);
    g.strokeStyle = th.edge; g.lineWidth = 1; g.stroke();
  }

  function drawTick(g, cx, cy, r, col, ink) {
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = col; g.fill();
    g.beginPath();
    g.moveTo(cx - r * 0.42, cy + r * 0.03);
    g.lineTo(cx - r * 0.13, cy + r * 0.33);
    g.lineTo(cx + r * 0.44, cy - r * 0.30);
    g.strokeStyle = ink; g.lineWidth = r * 0.23; g.lineCap = 'round'; g.lineJoin = 'round';
    g.stroke();
  }

  function drawPill(g, x, yTop, text, arrow, size, padX, padY, d) {
    var label = arrow + ' ' + text;
    var w = wid(g, label, size, '800', MONO) + padX * 2 + wid(g, '  24h', size, '500', MONO);
    var h = size + padY * 2;
    g.save();
    // The move's own glow, so the pill belongs to the lit half of the card.
    g.shadowColor = d.s; g.shadowBlur = 34;
    rr(g, x, yTop, w, h, h / 2);
    g.fillStyle = d.s; g.fill();
    g.restore();
    rr(g, x + 0.5, yTop + 0.5, w - 1, h - 1, h / 2);
    g.strokeStyle = d.l; g.lineWidth = 1; g.stroke();
    var tw = tx(g, label, x + padX, yTop + padY, size, '800', MONO, d.c);
    g.globalAlpha = 0.7;
    tx(g, ' 24h', x + padX + tw, yTop + padY, size, '500', MONO, d.c);
    g.globalAlpha = 1;
    return { w: w, h: h };
  }

  // Returns the endpoint, which the light behind the card is centred on.
  function drawChart(g, R, series, vols, d, th) {
    var n = series.length;
    if (n < 2) return null;
    var mn = series[0], mx = series[0], i;
    for (i = 1; i < n; i++) { if (series[i] < mn) mn = series[i]; if (series[i] > mx) mx = series[i]; }
    if (mx === mn) { mx = mn + (Math.abs(mn) || 1) * 0.01; }
    var padY = R.h * 0.07;
    function X(k) { return R.x + (k / (n - 1)) * R.w; }
    function Y(v) { return R.y + padY + (1 - (v - mn) / (mx - mn)) * (R.h - padY * 2); }

    // Volume, under the fade-out of the area fill: present when you look for it, invisible when you
    // are not looking for it.
    var mv = 0;
    for (i = 0; i < vols.length; i++) if (vols[i] > mv) mv = vols[i];
    if (mv > 0) {
      g.save();
      g.globalAlpha = 0.17;
      g.fillStyle = d.c;
      var bw = Math.max(2, (R.w / n) * 0.62);
      for (i = 0; i < n; i++) {
        var bh = (vols[i] / mv) * (R.h * 0.24);
        if (bh < 1) continue;
        g.fillRect(X(i) - bw / 2, R.y + R.h - bh, bw, bh);
      }
      g.restore();
    }

    function trace() {
      g.beginPath();
      g.moveTo(X(0), Y(series[0]));
      for (var k = 1; k < n; k++) g.lineTo(X(k), Y(series[k]));
    }

    // area
    trace();
    g.lineTo(R.x + R.w, R.y + R.h);
    g.lineTo(R.x, R.y + R.h);
    g.closePath();
    var ag = g.createLinearGradient(0, R.y, 0, R.y + R.h);
    ag.addColorStop(0, hexA(d.c, 0.34));
    ag.addColorStop(0.55, hexA(d.c, 0.10));
    ag.addColorStop(1, hexA(d.c, 0));
    g.fillStyle = ag; g.fill();

    // The dim-past / bright-now ramp, shared by all three passes. Three stacked strokes stand in for a
    // bloom: a real blur filter would have to be applied to the whole layer and canvas filters are not
    // dependable across the browsers a wallet ships.
    var sg = g.createLinearGradient(R.x, 0, R.x + R.w, 0);
    sg.addColorStop(0, hexA(d.c, 0.30));
    sg.addColorStop(0.45, hexA(d.c, 0.62));
    sg.addColorStop(0.82, d.c);
    sg.addColorStop(1, d.c);
    g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = sg;
    var passes = [[R.h * 0.062, 0.10], [R.h * 0.029, 0.22], [R.h * 0.0118, 1]];
    for (i = 0; i < passes.length; i++) {
      g.globalAlpha = passes[i][1];
      g.lineWidth = Math.max(1, passes[i][0]);
      trace(); g.stroke();
    }
    g.globalAlpha = 1;

    var ex = X(n - 1), ey = Y(series[n - 1]);
    return { x: ex, y: ey };
  }
  // Alpha onto a #rrggbb, since the palette is stored as hex and gradients need rgba.
  function hexA(hex, a) {
    var h = hex.replace('#', '');
    var r = parseInt(h.slice(0, 2), 16), g2 = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g2 + ',' + b + ',' + a + ')';
  }

  function drawDot(g, x, y, r, d, th) {
    g.beginPath(); g.arc(x, y, r + 5, 0, Math.PI * 2); g.fillStyle = d.s; g.fill();
    g.beginPath(); g.arc(x, y, r + 3, 0, Math.PI * 2); g.fillStyle = th.bg; g.fill();
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = d.c; g.fill();
  }

  // Box-driven rather than module-driven, and it always comes out DARK ON LIGHT.
  //
  // Two things the mock could not know. First, a real asset url is a host plus a 56-character issuer
  // key, which needs a 37-module symbol -- at the 56px the design sketched that is 1.5px per module and
  // nothing will read it, so the chip is bigger here and the row it sits in grew to match. Second, the
  // light card called for a dark chip with light modules: iOS reads an inverted code, plenty of Android
  // scanners do not, and a QR nobody can scan is just a texture. The light card gets a hairline instead,
  // so the white chip still has an edge against the white ground.
  //
  // The pale margin is a real four-module quiet zone, which the spec requires and which a scanner uses
  // to find the symbol at all.
  function drawQR(g, text, x, y, box, th) {
    var res = null;
    try { res = window.LXQR && window.LXQR.encode(text); } catch (e) { res = null; }
    if (!res) return 0;

    // THE MODULE IS A WHOLE NUMBER OF PIXELS, and the symbol is centred in whatever chip the layout
    // gave it. Both halves matter, and measuring is what settled it -- for a 37-module symbol in a
    // 100px chip the natural pitch is 2.22px, and neither obvious way of drawing that is any good:
    //
    //   round()+ceil() : crisp edges, but a 3px module on a 2.22px pitch. Measured 46.4% of the chip
    //                    dark against a correct 34.5% -- every dark module a third too fat, bleeding
    //                    into the light one beside it.
    //   exact floats   : correct proportions, but 27% of the chip lands on a half-lit edge pixel, so
    //                    every module boundary is a grey smear.
    //
    // An integer pitch has neither problem: measured 0% antialiasing and the exact ideal dark ratio.
    // It costs a few pixels of symbol, and a crisp small symbol beats a fat or fuzzy larger one.
    var m = Math.max(2, Math.floor(box / (res.size + 8)));
    var drawn = m * (res.size + 8);
    var off = Math.floor((box - drawn) / 2);           // slack becomes extra quiet zone, which is free
    var padPx = off + m * 4;

    rr(g, x, y, box, box, 8);
    g.fillStyle = '#ffffff'; g.fill();
    if (th.bg === '#ffffff') { rr(g, x + 0.5, y + 0.5, box - 1, box - 1, 8); g.strokeStyle = th.edge; g.lineWidth = 1; g.stroke(); }
    g.fillStyle = '#0b0b0d';
    for (var i = 0; i < res.size; i++) for (var j = 0; j < res.size; j++) {
      if (!res.modules[i][j]) continue;
      g.fillRect(x + padPx + j * m, y + padPx + i * m, m, m);
    }
    return box;
  }

  // ---------------------------------------------------------------------------------------------
  // The card
  // ---------------------------------------------------------------------------------------------
  function render(m, img, flame, portrait) {
    var W = portrait ? 1080 : 1200, H = portrait ? 1350 : 630;
    var th = TH[m.theme], d = DIR[m.dir][m.theme];
    var col = logoColor(img);
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');

    var P = portrait ? { t: 70, r: 64, b: 56, l: 64 } : { t: 44, r: 52, b: 40, l: 52 };
    var big = portrait;
    var glyph = big ? 98 : 78;
    var codeS = big ? 68 : 54, tickR = (big ? 34 : 28) / 2, domS = big ? 22 : 17;
    var axisS = big ? 19 : 13;

    // ---- geometry, before anything is painted, because the light behind the card is centred on the
    // chart's endpoint and has to go down first.
    var headTop = P.t;
    var textBlockH = codeS + (big ? 11 : 9) + domS * 1.2;
    var leftH = Math.max(glyph, textBlockH);
    // On the landscape card the price sits OPPOSITE the identity block, not under it, so the header is
    // as tall as the taller of the two. Measuring only the left column put the chart's top -- and with
    // it the high-water label -- underneath the change pill.
    var rightH = big ? 0 : (60 + 13 + (22 + 16));
    var headH = Math.max(leftH, rightH);
    var chartTop, priceTop = 0;
    if (big) {
      priceTop = headTop + headH + 52;
      chartTop = priceTop + 92 + 24 + (32 + 24) + 38;
    } else {
      chartTop = headTop + headH + 22;
    }
    // The bottom row carries the QR, so its height is set by what a 37-module symbol needs to stay
    // readable rather than by the stat cards, which look right at anything in this range.
    var qrBox = big ? 106 : 100;
    var winH = big ? 106 : 100;
    var footH = big ? qrBox : 0;
    var winsTop, timeTop, chartBot, footTop = 0, ruleY = 0;
    if (big) {
      footTop = H - P.b - footH;
      ruleY = footTop - 30;
      winsTop = ruleY - 40 - winH;
      timeTop = winsTop - 40 - 20;
      chartBot = timeTop - 12;
    } else {
      winsTop = H - P.b - winH;
      timeTop = winsTop - 20 - 16;
      chartBot = timeTop - 8;
    }
    var axisGutter = big ? 0 : 78;
    var R = { x: P.l, y: chartTop, w: W - P.l - P.r - axisGutter, h: Math.max(60, chartBot - chartTop) };

    // A first, throwaway pass just to learn where the line ends, so the light can be laid down before
    // the chart is drawn over it. Cheaper and far simpler than duplicating the scale maths.
    var probe = document.createElement('canvas').getContext('2d');
    var end = drawChart(probe, R, m.series, m.vols, d, th);

    // ---- ground
    g.fillStyle = th.bg; g.fillRect(0, 0, W, H);
    var wg = g.createRadialGradient(W * 0.06, -H * 0.12, 0, W * 0.06, -H * 0.12, Math.max(W, H) * 0.72);
    wg.addColorStop(0, th.wash);
    wg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = wg; g.fillRect(0, 0, W, H);

    g.fillStyle = th.grid;
    var step = big ? 60 : 44;
    for (var gy = 0; gy < H; gy += step) g.fillRect(0, gy, W, 1);

    // THE MOVE IS THE LIGHT SOURCE. Centred on the endpoint, drawn far larger than the card and
    // clipped by it, so what shows is the middle of a light and never a disc with an edge.
    if (end) {
      var GR = (big ? 590 : 500);
      var sg2 = g.createRadialGradient(end.x, end.y, 0, end.x, end.y, GR);
      sg2.addColorStop(0, d.g);
      sg2.addColorStop(0.7, hexA(d.c, 0));
      sg2.addColorStop(1, hexA(d.c, 0));
      g.fillStyle = sg2; g.fillRect(0, 0, W, H);
    }

    var tg = g.createLinearGradient(0, 0, W, 0);
    tg.addColorStop(0, ACCENT); tg.addColorStop(0.22, '#ff9a3d');
    tg.addColorStop(0.78, 'rgba(234,106,44,0)'); tg.addColorStop(1, 'rgba(234,106,44,0)');
    g.fillStyle = tg; g.fillRect(0, 0, W, big ? 8 : 5);

    // ---- identity. Top-aligned in the header, with the mark centred against its own text block.
    var gy0 = headTop + Math.max(0, (textBlockH - glyph) / 2);
    drawGlyph(g, img, P.l, gy0, glyph, m.code, col, th);
    var tX = P.l + glyph + (big ? 24 : 20);
    var tY = headTop + Math.max(0, (glyph - textBlockH) / 2);
    var cw = tx(g, m.code, tX, tY, codeS, '800', UI, th.ink);
    if (m.verified) {
      drawTick(g, tX + cw + (big ? 14 : 12) + tickR, tY + codeS * 0.42, tickR, DIR.up[m.theme].c, th.tickInk);
    }
    var sub = m.domain ? (m.domain + '   ·   Stellar') : 'Stellar';
    tx(g, sub, tX, tY + codeS + (big ? 11 : 9), domS, '500', MONO, th.muted);

    // ---- price. XLM is a trailing unit in the muted weight; dollars are a leading sign that belongs
    // to the figure, so it is set with it rather than dropped -- the first pass printed a bare number.
    var headNum = (m.unit === '$' ? '$' : '') + m.price;
    if (big) {
      var pw = tx(g, headNum, P.l, priceTop, 92, '700', MONO, th.ink);
      if (m.unit && m.unit !== '$') tx(g, ' ' + m.unit, P.l + pw, priceTop + 92 - 42, 42, '500', MONO, th.muted);
      var py = priceTop + 92 + 24;
      var pill = drawPill(g, P.l, py, m.chg, m.dir === 'down' ? '▼' : '▲', 32, 22, 12, d);
      if (m.alt) tx(g, m.alt, P.l + pill.w + 18, py + (pill.h - 25) / 2, 25, '400', MONO, th.muted);
    } else {
      var rx = W - P.r;
      var uw = (m.unit && m.unit !== '$') ? wid(g, ' ' + m.unit, 28, '500', MONO) : 0;
      var nw = wid(g, headNum, 60, '700', MONO);
      tx(g, headNum, rx - uw - nw, headTop, 60, '700', MONO, th.ink);
      if (uw) tx(g, ' ' + m.unit, rx - uw, headTop + 60 - 28, 28, '500', MONO, th.muted);
      // the second line sits under it, right-aligned: alt price, then the move
      var py2 = headTop + 60 + 13;
      var pillW = wid(g, (m.dir === 'down' ? '▼' : '▲') + ' ' + m.chg, 22, '800', MONO)
        + 30 + wid(g, '  24h', 22, '500', MONO);
      drawPill(g, rx - pillW, py2, m.chg, m.dir === 'down' ? '▼' : '▲', 22, 15, 8, d);
      if (m.alt) tx(g, m.alt, rx - pillW - 13, py2 + (22 + 16 - 19) / 2, 19, '400', MONO, th.muted, 'right');
    }

    // ---- chart, over the light it cast
    var end2 = drawChart(g, R, m.series, m.vols, d, th);
    if (end2) drawDot(g, end2.x, end2.y, big ? 11 : 8, d, th);

    // Axis labels. High and low keep their own directional colours -- they are not the day's direction.
    var lx = big ? (R.x + R.w) : (R.x + R.w + 70);
    if (m.hi) tx(g, m.hi + ' H', lx, R.y, axisS, '400', MONO, DIR.up[m.theme].c, 'right');
    if (m.lo) tx(g, m.lo + ' L', lx, R.y + R.h - axisS, axisS, '400', MONO, DIR.down[m.theme].c, 'right');

    // Time row: the window the chart is actually showing, then now.
    var label = ({ '1D': 'Last 24 hours', '1W': 'Last 7 days', '1M': 'Last 30 days', '1Y': 'Last year' })[m.tf]
      || (m.tf ? 'Last ' + m.tf : '');
    if (label) tx(g, label, R.x, timeTop, axisS, '500', MONO, th.axis);
    tx(g, 'now', R.x + R.w, timeTop, axisS, '700', MONO, th.ink, 'right');

    // ---- the windows
    var wins = m.wins.length ? m.wins : [];
    if (wins.length) {
      var gap = 12;
      var availW = big ? (W - P.l - P.r) : (W - P.l - P.r - qrBox - 16 - 200);
      var cellW = (availW - gap * (wins.length - 1)) / wins.length;
      for (var i2 = 0; i2 < wins.length; i2++) {
        var cx = P.l + i2 * (cellW + gap);
        rr(g, cx, winsTop, cellW, winH, 15);
        var wgd = g.createLinearGradient(0, winsTop, 0, winsTop + winH);
        wgd.addColorStop(0, th.winA); wgd.addColorStop(1, th.winB);
        g.save(); g.clip();
        g.fillStyle = wgd; g.fillRect(cx, winsTop, cellW, winH);
        // A bright rule along the top edge: a lit surface rather than a boxed one.
        g.globalAlpha = 0.5; g.fillStyle = d.c; g.fillRect(cx, winsTop, cellW, 2); g.globalAlpha = 1;
        g.restore();
        rr(g, cx + 0.5, winsTop + 0.5, cellW - 1, winH - 1, 15);
        g.strokeStyle = th.winLine; g.lineWidth = 1; g.stroke();
        var padL = big ? 18 : 16, padT = big ? 16 : 12;
        tx(g, wins[i2][0], cx + padL, winsTop + padT, big ? 16 : 12, '700', MONO, th.muted);
        var neg = wins[i2][1].charAt(0) === '-' || wins[i2][1].charAt(0) === '−';
        tx(g, wins[i2][1], cx + padL, winsTop + padT + (big ? 16 + 8 : 12 + 6),
          big ? 36 : 29, '700', MONO, DIR[neg ? 'down' : 'up'][m.theme].c);
      }
    }

    // ---- footer
    var stampS = stamp(new Date());
    // The section, not the deep link. A full asset url is a host plus a 56-character issuer key: set at
    // 14px it ran clean through the stat cards beside it, and truncated it reads as broken. The QR two
    // centimetres away carries the exact address, which is what the QR is for.
    var shortUrl = m.short;
    if (big) {
      g.fillStyle = th.rule; g.fillRect(P.l, ruleY, W - P.l - P.r, 1);
      if (flame) g.drawImage(flame, P.l, footTop + (footH - 46) / 2, 46, 46);
      tx(g, 'LumosCore', P.l + 46 + 12, footTop + (footH - 34) / 2, 34, '800', UI, th.ink);
      var qx = W - P.r - qrBox;
      drawQR(g, m.url, qx, footTop, qrBox, th);
      var rx2 = qx - 22;
      tx(g, shortUrl, rx2, footTop + (footH - 45) / 2, 20, '400', MONO, th.muted, 'right');
      tx(g, stampS, rx2, footTop + (footH - 45) / 2 + 25, 16, '400', MONO, th.axis, 'right');
    } else {
      var fy = winsTop, fh = winH;
      var qx2 = W - P.r - qrBox;
      drawQR(g, m.url, qx2, fy + fh - qrBox, qrBox, th);
      var rx3 = qx2 - 16;
      var bw2 = wid(g, 'LumosCore', 25, '800', UI);
      var by = fy + fh - 66;
      if (flame) g.drawImage(flame, rx3 - bw2 - 34 - 10, by - 4, 34, 34);
      tx(g, 'LumosCore', rx3, by, 25, '800', UI, th.ink, 'right');
      tx(g, shortUrl, rx3, by + 25 + 8, 14, '400', MONO, th.muted, 'right');
      tx(g, stampS, rx3, by + 25 + 8 + 14 + 5, 12, '400', MONO, th.axis, 'right');
    }

    grain(g, W, H, th.grain);
    g.strokeStyle = th.edge; g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, W - 1, H - 1);
    return c;
  }

  // ---------------------------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------------------------
  function fileName(m) {
    var d = new Date();
    return (m.code || 'asset') + '-lumoscore-' + d.getUTCFullYear() + pad2(d.getUTCMonth() + 1)
      + pad2(d.getUTCDate()) + '.png';
  }
  function download(blob, name) {
    var u = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = u; a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(u);
    }, 1200);
  }
  function save(canvas, m) {
    return new Promise(function (res, rej) {
      canvas.toBlob(function (blob) {
        if (!blob) { rej(new Error('no image')); return; }
        var name = fileName(m);
        // A phone gets the share sheet, which is the only route that reaches the camera roll on iOS --
        // a download attribute there opens the image in a tab and saves nothing. A desktop gets the
        // download, because a share sheet is not what a click on a camera promises.
        var coarse = false;
        try { coarse = window.matchMedia('(pointer:coarse)').matches; } catch (e) { coarse = false; }
        if (coarse && window.File && navigator.canShare) {
          try {
            var f = new File([blob], name, { type: 'image/png' });
            if (navigator.canShare({ files: [f] })) {
              navigator.share({ files: [f] }).then(function () { res(); }, function (err) {
                // A cancelled sheet is a decision, not a failure; anything else falls back to a save.
                if (err && err.name === 'AbortError') { res(); return; }
                download(blob, name); res();
              });
              return;
            }
          } catch (e) { /* fall through to the download */ }
        }
        download(blob, name);
        res();
      }, 'image/png');
    });
  }

  // The card sets type at sizes the page never uses, and canvas silently falls back to a system face
  // for any weight/size pair that is not resident. Asking for them explicitly first is what keeps the
  // saved image in the site's own typography.
  function fonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var want = ['800 68px ' + UI, '800 34px ' + UI, '500 22px ' + MONO, '700 92px ' + MONO,
      '700 36px ' + MONO, '800 32px ' + MONO, '400 20px ' + MONO, '700 12px ' + MONO];
    var jobs = [];
    for (var i = 0; i < want.length; i++) {
      try { jobs.push(document.fonts.load(want[i], '0123456789.%XLM$')); } catch (e) { /* best effort */ }
    }
    return Promise.all(jobs).catch(function () { });
  }

  var busy = false;
  function run(btn) {
    if (busy) return;
    busy = true;
    btn.classList.add('lxsnap-busy');
    // THE MOCK TRAP. This page ships the design's sample asset baked into its markup and the data layer
    // paints over it; the sample is USDC, so a card taken a second too early comes out with VELO's
    // price beside circle.com. Observed, not hypothetical. Every element the data layer writes gets
    // .lxp, so the card waits for the price to carry it -- and for the chart to have a line -- before
    // it will read anything off the page at all.
    if (!q('.price-display .big.lxp') || !((q('#dxaChart') || q('#mdxaChart') || {}).__lxpts || []).length) {
      busy = false; btn.classList.remove('lxsnap-busy');
      toast('Still loading this asset — try again in a moment.');
      return;
    }
    var m = model();
    // A card with no line is not worth saving, and would be a blank rectangle with a price on it.
    if (m.series.length < 2) {
      busy = false; btn.classList.remove('lxsnap-busy');
      toast('The chart is still loading — try again in a moment.');
      return;
    }
    var portrait = false;
    try { portrait = window.matchMedia('(pointer:coarse)').matches && window.innerWidth < 760; } catch (e) { }
    if (q('#mdxaChart')) portrait = true;

    Promise.all([logo(m), loadImg('/assets/tokens/lumos.png', false), fonts(), waitDom()])
      .then(function (r) {
        if (!m.domain && r[3]) m.domain = r[3];
        return save(render(m, r[0], r[1], portrait), m);
      })
      .catch(function (e) {
        toast('Could not build the snapshot. ' + ((e && e.message) || ''));
      })
      .then(function () {
        busy = false;
        btn.classList.remove('lxsnap-busy');
      });
  }

  // Capture phase and stopImmediatePropagation, like every other control in this strip: the design has
  // delegated listeners on the controls row that would otherwise read this as a timeframe change.
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-lxsnap]') : null;
    if (!b) return;
    e.preventDefault();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    run(b);
  }, true);
  // A handset can withhold the synthesised click on these pages. A scroll that starts on the button is
  // not a tap.
  var sx = 0, sy = 0, moved = false;
  document.addEventListener('touchstart', function (e) {
    if (!(e.target && e.target.closest && e.target.closest('[data-lxsnap]'))) return;
    var t = e.touches && e.touches[0]; if (!t) return;
    sx = t.clientX; sy = t.clientY; moved = false;
  }, { passive: true, capture: true });
  document.addEventListener('touchmove', function (e) {
    var t = e.touches && e.touches[0]; if (!t) return;
    if (Math.abs(t.clientX - sx) > 12 || Math.abs(t.clientY - sy) > 12) moved = true;
  }, { passive: true, capture: true });
  document.addEventListener('touchend', function (e) {
    if (moved) return;
    var b = e.target && e.target.closest ? e.target.closest('[data-lxsnap]') : null;
    if (!b) return;
    e.preventDefault();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    run(b);
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
  else watch();
})();
