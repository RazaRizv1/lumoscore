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
  // The page chart's two volume-bar fills, taken from its own rects.
  var VOL_UP = '#22c55e', VOL_DOWN = '#ff5b5b';
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
    var series = [], vols = [], times = [], i;
    for (i = 0; i < raw.length; i++) {
      var v = parseFloat(raw[i].v);
      if (!isFinite(v)) continue;
      series.push(denom === 'xlm' && xlmUsd > 0 ? v / xlmUsd : v);
      vols.push(Math.max(0, parseFloat(raw[i].vol) || 0));
      // t is epoch ms on every point; carried so the X axis can be labelled with real times rather
      // than a guess derived from the timeframe button.
      times.push(+raw[i].t || 0);
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
      hi: hi, lo: lo, wins: wins, series: series, vols: vols, times: times,
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
  // THE ISSUER IS IN THE URL. __lxDXAissuer is written by the data layer and is empty until it runs,
  // so a card taken early skipped the proxy step entirely and fell through to initials -- which is how
  // SCOP came out as "SC" on a page that was showing its real mark. The path is /trade/stellar/CODE-ISSUER
  // and needs nothing to have run, so it is the reliable source.
  //
  // Step 3 cannot rescue this either: measured, meta.stellar.expert answers with NO
  // access-control-allow-origin, so loading it with crossOrigin set always fails -- and that host is
  // where most third-party marks live. The proxy is effectively the only route, so it must be reached.
  function idFromPath() {
    try {
      var m2 = (location.pathname || '').match(/\/([A-Za-z0-9]{1,12})-(G[A-Z2-7]{55})(?:\/|$)/);
      if (m2) return { code: m2[1], issuer: m2[2] };
      var qs = new URLSearchParams(location.search || '').get('asset') || '';
      var m3 = qs.match(/^([A-Za-z0-9]{1,12})-(G[A-Z2-7]{55})$/);
      if (m3) return { code: m3[1], issuer: m3[2] };
    } catch (e) { /* fall through */ }
    return null;
  }
  function logo(m) {
    var url = pageLogoUrl();
    var isPlaceholder = url.indexOf('data:') === 0;
    var first = (url && !isPlaceholder && sameOrigin(url)) ? loadImg(url, false) : Promise.resolve(null);
    return first.then(function (a) {
      if (a) return a;
      var id = (m.code && m.issuer) ? { code: m.code, issuer: m.issuer } : idFromPath();
      if (id && !m.native) {
        var pu = '/lxapi/logoimg?asset=' + encodeURIComponent(id.code + '-' + id.issuer);
        // One retry. The proxy's first call for an asset builds from the issuer's toml and can fail
        // where the second, now cached, succeeds -- and the cost of losing this race is a card that
        // silently misrepresents the asset with initials.
        return loadImg(pu, false).then(function (r) { return r || loadImg(pu, false); });
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
    // The halo that used to sit behind the mark -- a radial in the logo's own colour at 0.34, spread
    // over 2.4x the glyph box -- is gone with the rest of the tinting. On the white card it read as a
    // warm smudge in the top-left corner, which is the last thing left looking like the flame wash
    // once the ground went flat. The page sets the same mark on a plain background with nothing
    // behind it.
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
  function drawChart(g, R, series, vols, d, th, times) {
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
      // PER BAR, not one colour for the whole series. Read off the page's own chart rather than
      // guessed: its 88 volume rects come back as exactly two fills, #22c55e and #ff5b5b, split 43/45
      // -- so each bar is coloured by whether that candle closed up or down. The card was painting
      // every bar in d.c, the single 24h direction colour, which on a red day made a solid red block
      // out of a series that is half green.
      g.save();
      g.globalAlpha = 0.17;
      var bw = Math.max(2, (R.w / n) * 0.62);
      for (i = 0; i < n; i++) {
        var bh = (vols[i] / mv) * (R.h * 0.24);
        if (bh < 1) continue;
        g.fillStyle = (i > 0 && series[i] < series[i - 1]) ? VOL_DOWN : VOL_UP;
        g.fillRect(X(i) - bw / 2, R.y + R.h - bh, bw, bh);
      }
      g.restore();
    }

    function trace() {
      g.beginPath();
      g.moveTo(X(0), Y(series[0]));
      for (var k = 1; k < n; k++) g.lineTo(X(k), Y(series[k]));
    }

    // MATCHED TO THE CHART ON THE PAGE, read off it rather than eyeballed: the SVG line computes to
    // stroke #ea6a2c at 2.5px with round caps and filter:none, and its area is a single linear
    // gradient from the accent at 0.20 opacity to 0. The card used to draw something else entirely --
    // three stacked strokes standing in for a bloom, a left-dim/right-bright ramp along the line, an
    // area running 0.34 -> 0.10 -> 0, and the whole thing in the 24h direction colour rather than the
    // accent. It read as a different product's chart. All of that is gone.
    // Stroke width is proportional so the phone card and the desktop card land on the same weight
    // relative to the plot, rather than one looking hairline and the other heavy.
    var LINE = accentOf(th);
    var lw = Math.max(2, R.h * 0.016);

    trace();
    g.lineTo(R.x + R.w, R.y + R.h);
    g.lineTo(R.x, R.y + R.h);
    g.closePath();
    var ag = g.createLinearGradient(0, R.y, 0, R.y + R.h);
    ag.addColorStop(0, hexA(LINE, 0.20));
    ag.addColorStop(1, hexA(LINE, 0));
    g.fillStyle = ag; g.fill();

    g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = LINE; g.lineWidth = lw;
    trace(); g.stroke();

    // ---- axes. The page labels price down the right and time along the bottom, both in the muted
    // ink; the card had neither, only a high/low pair and the words "Last 24 hours". Same two scales
    // here, at the same relative sizes, so a shared card can actually be read as a chart.
    // Proportional to the plot, but capped. Moving the portrait QR out of the footer handed the chart
    // ~190px of extra height, and a size derived purely from R.h grew the price and time labels with
    // it until they were competing with the stat tiles. The axis is meant to be read second.
    var aS = Math.max(9, Math.min(R.big ? 22 : 15, Math.round(R.h * 0.052)));
    g.save();
    g.globalAlpha = 0.9;
    var TICKS = 4;
    for (i = 0; i <= TICKS; i++) {
      var vv = mn + (mx - mn) * (i / TICKS);
      var yy = Y(vv);
      // a hairline behind each label, so the eye can carry the value across the plot
      g.globalAlpha = 0.10; g.fillStyle = th.axis;
      g.fillRect(R.x, Math.round(yy) + 0.5, R.w, 1);
      g.globalAlpha = 0.9;
      // IN THE RIGHT GUTTER, which is where the page puts its own price numbers -- its high/low pair
      // measures to 84% of the chart width. These used to be set inside the plot at R.x + 6, over the
      // line, and needed a double-drawn shadow halo to stay legible against it. Outside the plot they
      // need no halo at all, and the gutter was already being reserved on the portrait card.
      // 16px, not 8: the endpoint dot is centred on the plot's right edge with an 8-11px radius, so at
      // 8px it painted over the first character of whichever label it sat beside.
      tx(g, axisNum(vv), R.x + R.w + 16, yy - aS / 2, aS, '500', MONO, th.axis);
    }
    if (times && times.length === n) {
      var XT = 4;
      for (i = 0; i <= XT; i++) {
        var idx = Math.round((n - 1) * (i / XT));
        var lab = axisTime(times[idx], times[0], times[n - 1]);
        if (!lab) continue;
        var al = i === 0 ? 'left' : (i === XT ? 'right' : 'center');
        var xx = X(idx) + (i === 0 ? 2 : (i === XT ? -2 : 0));
        // Drawn on the row that used to hold "Last 24 hours … now". Those two were a description of
        // the window; these are the window, and they cannot both live here -- chartBot is only 8-12px
        // above this line.
        var xay = (R.xAxisY != null) ? R.xAxisY : (R.y + R.h + 6);
        tx(g, lab, xx, xay, aS, '500', MONO, th.axis, al);
      }
    }
    g.restore();

    var ex = X(n - 1), ey = Y(series[n - 1]);
    return { x: ex, y: ey };
  }

  // The page's accent, not a colour of our own: the card should be the same orange the chart behind
  // it is drawn in, and it follows a theme change for free.
  function accentOf(th) {
    var v = '';
    try { v = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '').trim(); } catch (_) {}
    return /^#[0-9a-f]{6}$/i.test(v) ? v : ACCENT;
  }
  // Axis values are read at a glance, not to seven decimals. Significant figures rather than a fixed
  // precision, because one asset trades at 5.63 and the next at 0.0000499.
  function axisNum(v) {
    var a = Math.abs(v);
    if (!isFinite(v)) return '';
    if (a >= 1000) return Math.round(v).toLocaleString('en-US');
    if (a >= 1) return v.toFixed(2);
    if (a >= 0.01) return v.toFixed(4);
    if (a === 0) return '0';
    var dp = Math.min(8, Math.max(4, 2 - Math.floor(Math.log(a) / Math.LN10)));
    return v.toFixed(dp).replace(/0+$/, '').replace(/\.$/, '');
  }
  // A day of data wants clock times; a year wants dates. Decided from the span the series covers, so
  // it is right for whichever timeframe button is active without being told which.
  function axisTime(t, t0, t1) {
    if (!t) return '';
    var d0 = new Date(t), span = (t1 - t0) || 0;
    if (span <= 36 * 3600 * 1000) return pad2(d0.getHours()) + ':' + pad2(d0.getMinutes());
    if (span <= 400 * 24 * 3600 * 1000) {
      return d0.getDate() + ' ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d0.getMonth()];
    }
    return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d0.getMonth()] + ' ' + String(d0.getFullYear()).slice(2);
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
    // Bigger, and with the stamp set beneath it rather than alongside. The landscape card had no room
    // to grow the code downward -- its QR is bottom-aligned to the stat-tile row, which already sits on
    // the bottom padding -- so the column now starts at the x-axis line and runs to the tile row's
    // bottom edge, using the 36px of dead gap above the tiles. Nothing else lives out there: the price
    // labels stop 8px above that line and the x-axis labels stop short of the gutter.
    var stampLine = big ? 16 : 12, stampGap = 8;
    // The portrait price column: the number, the gap beneath it, and the change pill -- the same three
    // numbers chartTop is derived from just above. Sizing the code's block to exactly this makes its
    // top edge sit on the price's top edge and its bottom edge on the pill's, which is the whole point
    // of moving it up there.
    var priceBlockH = 92 + 24 + 32;
    // Portrait: the code runs the full height of the header column -- from the top padding, level with
    // the asset mark, down to the foot of the price -- with the stamp under it landing just above the
    // change pill. Sized to the price column alone it was a small square floating in a lot of empty
    // space; this fills the block it shares.
    var qrIdeal = (P.t + Math.max(glyph, codeS + (big ? 11 : 9) + domS * 1.2) + 52 + 92) - P.t;
    var qrBox = big ? Math.max(124, qrIdeal) : 100;
    var winH = big ? 106 : 100;
    var winsTop, timeTop, chartBot, qrTop = 0;
    if (big) {
      // TOP RIGHT, level with the price, instead of a band beneath the stat tiles. The right half of
      // the portrait header was empty -- the price and pill are both left-aligned and rightH is 0 for
      // this layout -- while the code sat alone in a footer that existed only to hold it. Moving it up
      // pairs it with the price and hands the whole footer band, rule and all, back to the chart.
      qrTop = headTop;
      // ...but never into the price. The price is the one long line on this card and its width is a
      // function of the asset -- 0.0295482 is nine characters where 0.00012345678 is thirteen -- so an
      // ideal-height code would have run into a long one. 124 is the floor because that is the size
      // this layout already carried without collision.
      var hn0 = (m.unit === '$' ? '$' : '') + m.price;
      var priceRight = P.l + wid(g, hn0, 92, '700', MONO)
        + ((m.unit && m.unit !== '$') ? wid(g, ' ' + m.unit, 42, '500', MONO) : 0);
      qrBox = Math.max(124, Math.min(qrBox, (W - P.r) - priceRight - 30));
      winsTop = H - P.b - winH;
      timeTop = winsTop - 40 - 20;
      chartBot = timeTop - 12;
    } else {
      winsTop = H - P.b - winH;
      timeTop = winsTop - 20 - 16;
      chartBot = timeTop - 8;
      // Grow the code into the gap above the stat tiles, but stop short of the x-axis line: the last
      // time label is right-aligned to the plot's edge, and a code sized to the full gap sat on top of
      // it and hid it. 26px of clearance is the label's own height plus a margin. The stamp goes below
      // the tile row, into the bottom padding, which is 40px on this layout and holds it comfortably.
      qrBox = Math.max(100, (winsTop + winH) - (timeTop + 26));
    }
    // The gutter has to exist on BOTH layouts now that the price labels are set in it -- it used to be
    // reserved only on the portrait card (big ? 0 : 78) because the labels were drawn inside the plot.
    // Measured rather than guessed at, because the widest label is a function of the asset's price:
    // SCOP needs "0.0148324" where a four-figure asset needs "1,234". A fixed 78 clipped one and
    // stranded the other.
    var chartH = Math.max(60, chartBot - chartTop);
    // Same clamp drawChart uses, or the gutter gets measured for a font larger than the one drawn.
    var probeS = Math.max(9, Math.min(big ? 22 : 15, Math.round(chartH * 0.052)));
    var widest = 0;
    for (var pk = 0; pk < m.series.length; pk++) {
      var pw = wid(g, axisNum(m.series[pk]), probeS, '500', MONO);
      if (pw > widest) widest = pw;
    }
    var axisGutter = Math.ceil(widest) + 22;
    var R = { x: P.l, y: chartTop, w: W - P.l - P.r - axisGutter, h: chartH, xAxisY: timeTop, big: big };

    // ---- ground. FLAT, and the same flat the page is. What used to be here was a 24%-opacity orange
    // radial across the whole card (th.wash), a second radial in the 24h direction colour centred on
    // the endpoint, an orange-to-transparent bar along the top edge, full-width banding every 44-60px,
    // and a grain pass. Five tints stacked on a ground that the page paints as one solid colour, which
    // is why the card came out looking like it was lit by a flame while the chart it was copying is
    // plain. The page's own .chart-area sits on the page background with nothing behind it, so does
    // this now. The only lines left are the axis hairlines, and those are drawn inside the plot rect
    // by drawChart -- not run edge to edge across the header and the footer.
    g.fillStyle = th.bg; g.fillRect(0, 0, W, H);

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
    var end2 = drawChart(g, R, m.series, m.vols, d, th, m.times);
    if (end2) drawDot(g, end2.x, end2.y, big ? 11 : 8, d, th);

    // The separate "H"/"L" pair that used to sit here is gone. It was drawn at the right edge of the
    // plot -- exactly where the Y ticks now are -- and it was saying the same thing twice: the ticks
    // run mn..mx, so the top tick IS the high and the bottom tick IS the low. Two sets of price
    // numbers stacked in the same gutter read as a collision, not as two readouts.

    // The "Last 24 hours … now" row is gone: drawChart now draws the real X scale on this line, which
    // says the same thing and says it at every point rather than only at the two ends.

    // ---- the windows
    var wins = m.wins.length ? m.wins : [];
    if (wins.length) {
      var gap = 12;
      // THE BLANK SPACE. This reserved a flat 200px to the left of the QR for a timestamp and a short
      // url set one above the other. The url is gone, so 200px was being held for a single 12px line
      // -- the tiles stopped early and the gap before the QR read as a hole in the row. Reserve what
      // the stamp actually measures instead, and the tiles grow into what is left.
      // The stamp no longer sits beside the QR, so only the QR column has to be kept clear -- the tiles
      // take back the width that was being held for a line of text.
      var availW = big ? (W - P.l - P.r) : (W - P.l - P.r - qrBox - 28);
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
    // The wordmark, the flame and the short url are GONE from the footer -- the QR is the only mark
    // left, and it already carries the address the url was spelling out. shortUrl stays computed in
    // the model because the QR encodes the full link; it is simply no longer drawn.
    // The timestamp stays: it is neither the brand nor the link, and a shared card is worth less if
    // you cannot tell when the price in it was true. Easy to drop if it is not wanted.
    // Both items were pinned to the right edge -- the timestamp set right-aligned a few px off the QR --
    // which left the whole left half of the footer empty and read as a gap rather than as space. They
    // now sit at opposite ends of the row, left-aligned to the same P.l every other element on the card
    // starts from, and centred on the QR's own vertical midpoint so the two read as one line.
    // The stamp is centred on the code's own vertical axis in both layouts, directly beneath it, so the
    // two read as one stacked block rather than as a code with a line of text pushed off to one side.
    // Centred under the code when it fits, right-aligned to the card margin when it does not. The
    // stamp is a 22-character line and the code is ~120px wide, so centring it on the code's axis ran
    // it off the right edge of the card -- the QR's right edge already sits on that margin. Both flush
    // right reads as the same stacked block and cannot clip.
    function drawStamp(qx0, topY) {
      var sw = wid(g, stampS, stampLine, '400', MONO);
      if (sw <= qrBox) tx(g, stampS, qx0 + qrBox / 2, topY, stampLine, '400', MONO, th.axis, 'center');
      else tx(g, stampS, qx0 + qrBox, topY, stampLine, '400', MONO, th.axis, 'right');
    }
    if (big) {
      // No rule any more: it was the top edge of a footer band that no longer exists.
      var qx = W - P.r - qrBox;
      drawQR(g, m.url, qx, qrTop, qrBox, th);
      drawStamp(qx, qrTop + qrBox + stampGap);
    } else {
      var qBot = winsTop + winH;
      var qx2 = W - P.r - qrBox, qy2 = qBot - qrBox;
      drawQR(g, m.url, qx2, qy2, qrBox, th);
      drawStamp(qx2, qBot + stampGap);
    }

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
    // The price and the chart are not the last things to arrive. The 24h/7d/1m/3m figures come from
    // their own fetch, and model() takes only the cells that are already filled -- so a card taken
    // straight after a refresh came out with a single 24H tile stretched across the whole row, which
    // reads as a card that only tracks a day rather than one caught mid-load. Waiting is the right
    // answer rather than refusing the click: the press is the intent, and the data is seconds away.
    waitWins().then(function () {
      var m = model();
      // A card with no line is not worth saving, and would be a blank rectangle with a price on it.
      if (m.series.length < 2) {
        toast('The chart is still loading — try again in a moment.');
        return;
      }
      var portrait = false;
      try { portrait = window.matchMedia('(pointer:coarse)').matches && window.innerWidth < 760; } catch (e) { }
      if (q('#mdxaChart')) portrait = true;

      return Promise.all([logo(m), loadImg('/assets/tokens/lumos.png', false), fonts(), waitDom()])
        .then(function (r) {
          if (!m.domain && r[3]) m.domain = r[3];
          return save(render(m, r[0], r[1], portrait), m);
        });
    })
      .catch(function (e) {
        toast('Could not build the snapshot. ' + ((e && e.message) || ''));
      })
      .then(function () {
        busy = false;
        btn.classList.remove('lxsnap-busy');
      });
  }

  // Resolves once all four windows carry a real figure, or after a ceiling -- whichever lands first.
  // Capped rather than open-ended because an asset with no 3m history never fills that cell at all,
  // and the card is still worth having with three.
  function waitWins() {
    var WANTK = ['24h', '7d', '1m', '3m'];
    function ready() {
      var have = {};
      qa('.dxa-perf-cell,.mdxa-perf-cell').forEach(function (c) {
        var k = c.querySelector('.tf'), v = c.querySelector('.ch');
        if (k && v) have[k.textContent.trim().toLowerCase()] = v.textContent.trim();
      });
      for (var i = 0; i < WANTK.length; i++) {
        var val = have[WANTK[i]];
        if (!val || val === '—') return false;
      }
      return true;
    }
    if (ready()) return Promise.resolve();
    return new Promise(function (res) {
      var t0 = Date.now();
      var iv = setInterval(function () {
        if (ready() || Date.now() - t0 > 6000) { clearInterval(iv); res(); }
      }, 120);
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
