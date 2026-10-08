/* Browser-side card generator. Copied verbatim to dist/assets/js/lx-ogcardgen.js by _ogkit.js.
 *
 * WHY THIS EXISTS. A card can only be rasterised at build time -- satori plus a wasm rasteriser is
 * about 8.5MB against a 1MB Worker bundle cap, and 50-200ms of CPU against 10ms -- so an asset
 * curated or minted between builds would have no card of its own until the next one. There is no CI,
 * no cron and no deploy hook in this project to hang a regeneration on. The one thing that can
 * rasterise on demand is the browser already performing the action, so it draws the card and uploads
 * it; /lxapi/ogcard serves that ahead of the build's static file.
 *
 * It draws through window.LXOGKit, which is _tools/_ogkit.js itself, the same file the build uses.
 * Two implementations would drift the first time the design changed. Verified against resvg on a
 * 24x13 grid: mean channel distance 4.6 of a possible 441, worst cell 36, nothing over 40.
 *
 * Usage:
 *   await LXOGCard.publish({ asset: 'CODE-GISSUER', code: 'CODE', chain: 'Stellar',
 *                            badge: 'Curated asset', domain: 'example.com', logo: '<url or data uri>' });
 */
(function () {
  'use strict';
  var FONT_URL = '/assets/fonts/HankenGrotesk-variable.ttf';
  var W = 1200, H = 630;
  var fontB64 = null;

  function abToB64(buf) {
    var bytes = new Uint8Array(buf), s = '', CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }

  // The metrics come from the real TTF, not from the woff2 the pages use: those are compressed
  // subsets this parser cannot read, and measuring with a different file would place the row and the
  // verification tick differently from the build.
  var fontReady = null;
  function ensureFont() {
    if (fontReady) return fontReady;
    fontReady = fetch(FONT_URL, { credentials: 'omit' }).then(function (r) {
      if (!r.ok) throw new Error('font ' + r.status);
      return r.arrayBuffer();
    }).then(function (buf) {
      if (!window.LXOGKit || !window.LXOGKit.initMetrics(new Uint8Array(buf))) throw new Error('font parse failed');
      fontB64 = abToB64(buf);
      return true;
    });
    return fontReady;
  }

  // A logo straight off an issuer's domain taints the canvas, and toDataURL then throws. Everything
  // is therefore pulled through our own origin and normalised to PNG, which also sidesteps the
  // formats the renderer cannot read.
  function logoDataUri(src) {
    if (!src) return Promise.resolve('');
    if (src.indexOf('data:') === 0) return Promise.resolve(src);
    var url = src.indexOf('/') === 0 ? src : null;
    if (!url) return Promise.resolve('');          // never fetch a foreign origin from here
    return fetch(url, { credentials: 'omit' }).then(function (r) {
      if (!r.ok) throw new Error('logo ' + r.status);
      return r.blob();
    }).then(function (b) {
      return new Promise(function (res, rej) {
        var fr = new FileReader();
        fr.onload = function () { res(String(fr.result)); };
        fr.onerror = function () { rej(new Error('logo read failed')); };
        fr.readAsDataURL(b);
      });
    }).then(function (uri) {
      // Re-encode through a canvas so the embedded image is always PNG.
      return new Promise(function (res) {
        var im = new Image();
        im.onload = function () {
          var side = Math.min(512, Math.max(im.naturalWidth, im.naturalHeight)) || 256;
          var c = document.createElement('canvas');
          c.width = side; c.height = side;
          var x = c.getContext('2d');
          var s = Math.min(side / im.naturalWidth, side / im.naturalHeight);
          var w = im.naturalWidth * s, h = im.naturalHeight * s;
          x.drawImage(im, (side - w) / 2, (side - h) / 2, w, h);
          try { res(c.toDataURL('image/png')); } catch (e) { res(uri); }
        };
        im.onerror = function () { res(''); };
        im.src = uri;
      });
    }).catch(function () { return ''; });
  }

  function rasterise(svg) {
    return new Promise(function (res, rej) {
      var img = new Image();
      var url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      img.onload = function () {
        try {
          var c = document.createElement('canvas');
          c.width = W; c.height = H;
          c.getContext('2d').drawImage(img, 0, 0, W, H);
          URL.revokeObjectURL(url);
          c.toBlob(function (b) { b ? res(b) : rej(new Error('toBlob gave nothing')); }, 'image/png');
        } catch (e) { URL.revokeObjectURL(url); rej(e); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('svg did not load')); };
      img.src = url;
    });
  }

  function generate(opt) {
    return ensureFont().then(function () {
      return logoDataUri(opt.logo);
    }).then(function (logo) {
      var svg = window.LXOGKit.assetCard({
        code: opt.code, logo: logo, badge: opt.badge || '', domain: opt.domain || '', chain: opt.chain || 'Stellar',
      });
      // An SVG rendered through an <img> does not see the document's fonts, so the face travels
      // inside it. Without this the card silently falls back to a system font.
      var face = '<style>@font-face{font-family:\'Hanken Grotesk\';src:url(data:font/ttf;base64,'
        + fontB64 + ') format(\'truetype\');font-weight:1 999;}</style>';
      return rasterise(svg.replace('<defs>', '<defs>' + face));
    });
  }

  function publish(opt) {
    return generate(opt).then(function (blob) {
      var fd = new FormData();
      fd.append('asset', opt.asset);
      fd.append('file', blob, 'card.png');
      if (opt.kind) fd.append('kind', opt.kind);
      return fetch('/lxapi/ogcardput', { method: 'POST', body: fd, credentials: 'same-origin' });
    }).then(function (r) {
      return r.json().catch(function () { return { ok: r.ok, status: r.status }; });
    });
  }

  window.LXOGCard = { generate: generate, publish: publish, rasterise: rasterise };
})();
