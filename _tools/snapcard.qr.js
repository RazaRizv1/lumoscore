// A QR encoder, because the snapshot card carries one and there is nowhere to fetch it from.
//
// WHY IT IS HERE AT ALL: the card is downloaded as an image and reposted as an image -- screenshotted,
// cropped, pasted into a group chat -- and every one of those strips the link. The QR is the only part
// of the picture that survives being a picture. It encodes the asset's own page URL, nothing else.
//
// SCOPE, deliberately small: byte mode, error correction level L, versions 1-10. That covers
// https://lumoscore.com/trade/stellar/CODE-G... at about 100 characters with room to spare (v6-L holds
// 136 bytes) and stops well before the version-info and multi-block-group cases that make a general
// encoder three times this size. Level L rather than M because this code is read off a bright screen
// from a foot away, never off a crumpled label -- the redundancy buys nothing here and costs modules,
// and more modules at a fixed 56px means finer squares and a WORSE scan.
//
// Loaded both in the browser (as an IIFE that defines window.LXQR) and by node in the build, which is
// how it gets tested at all -- see the self-check at the bottom of _snapcard.js.
(function (root) {
  'use strict';

  // ---- GF(256) --------------------------------------------------------------------------------
  // Primitive polynomial x^8+x^4+x^3+x^2+1 = 0x11D, as the spec fixes it.
  var EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x; LOG[x] = i;
      x <<= 1; if (x & 0x100) x ^= 0x11D;
    }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();
  function mul(a, b) { return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]]; }

  // Generator polynomial for `deg` error-correction codewords: (x-a^0)(x-a^1)...(x-a^(deg-1)).
  //
  // RETURNED IN DESCENDING POWERS, leading 1 first. The loop below builds it the other way round --
  // index k is the coefficient of x^k -- and the division that follows indexes it as g[j+1], which is
  // the standard form and expects descending. Leaving the two disagreeing computed every parity byte
  // against the REVERSED polynomial: still a well-formed codeword, but of a different code, so a
  // decoder reading a flawless symbol still got non-zero syndromes and could not correct. Nothing in a
  // round-trip test notices, because the same reversed generator verifies it.
  //
  // Descending also makes this directly comparable to the published tables: deg 7 must come out
  // 1,127,122,154,164,11,68,117, which is a^0,a^87,a^229,a^146,a^149,a^238,a^102,a^21.
  function genPoly(deg) {
    var p = [1];
    for (var i = 0; i < deg; i++) {
      var np = new Array(p.length + 1);
      for (var k = 0; k < np.length; k++) np[k] = 0;
      for (var j = 0; j < p.length; j++) {
        np[j] ^= mul(p[j], EXP[i]);
        np[j + 1] ^= p[j];
      }
      p = np;
    }
    return p.reverse();
  }

  // Polynomial long division; the remainder IS the error-correction block.
  function ecc(data, deg) {
    var g = genPoly(deg), res = new Array(deg), i;
    for (i = 0; i < deg; i++) res[i] = 0;
    for (i = 0; i < data.length; i++) {
      var f = data[i] ^ res[0];
      res.shift(); res.push(0);
      if (f !== 0) for (var j = 0; j < deg; j++) res[j] ^= mul(g[j + 1], f);
    }
    return res;
  }

  // ---- version tables (ECC level L only) ------------------------------------------------------
  // [ total codewords, ec codewords per block, blocks in group 1, data per block in group 1,
  //   blocks in group 2, data per block in group 2 ]
  var VER = {
    1:  [26,   7, 1,  19, 0,  0],
    2:  [44,  10, 1,  34, 0,  0],
    3:  [70,  15, 1,  55, 0,  0],
    4:  [100, 20, 1,  80, 0,  0],
    5:  [134, 26, 1, 108, 0,  0],
    6:  [172, 18, 2,  68, 0,  0],
    7:  [196, 20, 2,  78, 0,  0],
    8:  [242, 24, 2,  97, 0,  0],
    9:  [292, 30, 2, 116, 0,  0],
    10: [346, 18, 2,  68, 2, 69],
  };
  // Alignment-pattern centre coordinates. Version 1 has none.
  var ALIGN = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
    6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
  };
  // Bits of padding after the last codeword. Zero for 1 and for 7-10; seven for 2-6.
  function remainderBits(v) { return (v >= 2 && v <= 6) ? 7 : 0; }

  function capacity(v) {
    var t = VER[v];
    return t[2] * t[3] + t[4] * t[5];
  }

  // ---- bit buffer -----------------------------------------------------------------------------
  function Bits() { this.b = []; }
  Bits.prototype.put = function (val, len) {
    for (var i = len - 1; i >= 0; i--) this.b.push((val >>> i) & 1);
  };

  // ---- matrix ---------------------------------------------------------------------------------
  function Mat(size) {
    this.n = size;
    this.m = [];        // 0/1 module value
    this.fixed = [];    // true where a function pattern lives and data must not be written
    for (var i = 0; i < size; i++) {
      this.m.push(new Uint8Array(size));
      this.fixed.push(new Uint8Array(size));
    }
  }
  Mat.prototype.set = function (r, c, v, fixed) {
    this.m[r][c] = v ? 1 : 0;
    if (fixed) this.fixed[r][c] = 1;
  };

  function finder(mat, r, c) {
    for (var y = -1; y <= 7; y++) for (var x = -1; x <= 7; x++) {
      var rr = r + y, cc = c + x;
      if (rr < 0 || cc < 0 || rr >= mat.n || cc >= mat.n) continue;
      var on = (y >= 0 && y <= 6 && x >= 0 && x <= 6) &&
        (y === 0 || y === 6 || x === 0 || x === 6 || (y >= 2 && y <= 4 && x >= 2 && x <= 4));
      mat.set(rr, cc, on, true);
    }
  }

  function alignment(mat, r, c) {
    for (var y = -2; y <= 2; y++) for (var x = -2; x <= 2; x++) {
      var on = (Math.abs(y) === 2 || Math.abs(x) === 2 || (y === 0 && x === 0));
      mat.set(r + y, c + x, on, true);
    }
  }

  // BCH(15,5) for the format bits, BCH(18,6) for the version bits. Same shape, different generator.
  function bch(v, g, gBits) {
    var d = v << (gBits - 1);
    while (bitLen(d) >= gBits) d ^= g << (bitLen(d) - gBits);
    return d;
  }
  function bitLen(x) { var n = 0; while (x) { n++; x >>>= 1; } return n; }

  // The 15 format bits, written twice.
  //
  // COPY 1 IS NOT THE TRANSPOSE OF COPY 2, and getting that wrong is why the first version of this
  // file produced a symbol no camera would read. The low bits of copy 1 run ALONG ROW 8 (8,0)..(8,5),
  // and the high bits run UP COLUMN 8 (5,8)..(0,8). Writing them the other way round puts all fifteen
  // bits in valid cells -- the region is symmetric in shape, so nothing looks wrong and every
  // structural check still passes -- but in permuted order. A decoder reads copy 1 first, gets a
  // format whose BCH will not decode, and gives up before it ever looks at copy 2.
  //
  // It survived a round-trip test because the test's reader was written from the same mistaken
  // understanding: it read copy 1 the same wrong way and agreed with itself. The self-check in
  // _snapcard.js now pins both copies against the published format strings instead.
  function drawFormat(mat, mask) {
    // 01 = level L, then the three mask bits, through BCH and the fixed 0x5412 mask.
    var data = (0x01 << 3) | mask;
    var bitsv = ((data << 10) | bch(data, 0x537, 11)) ^ 0x5412;
    var n = mat.n, i;
    for (i = 0; i < 15; i++) {
      var bit = (bitsv >>> i) & 1;
      // copy 1, wrapped around the top-left finder
      if (i < 6) mat.set(8, i, bit, true);
      else if (i === 6) mat.set(8, 7, bit, true);
      else if (i === 7) mat.set(8, 8, bit, true);
      else if (i === 8) mat.set(7, 8, bit, true);
      else mat.set(14 - i, 8, bit, true);
      // copy 2, split between the other two finders
      if (i < 8) mat.set(8, n - 1 - i, bit, true);
      else mat.set(n - 15 + i, 8, bit, true);
    }
    mat.set(n - 8, 8, 1, true);   // the always-dark module
  }

  function drawVersion(mat, v) {
    if (v < 7) return;
    var bitsv = (v << 12) | bch(v, 0x1F25, 13);
    for (var i = 0; i < 18; i++) {
      var bit = (bitsv >>> i) & 1;
      var r = Math.floor(i / 3), c = i % 3;
      mat.set(r, mat.n - 11 + c, bit, true);
      mat.set(mat.n - 11 + c, r, bit, true);
    }
  }

  function maskFn(k, i, j) {
    switch (k) {
      case 0: return ((i + j) % 2) === 0;
      case 1: return (i % 2) === 0;
      case 2: return (j % 3) === 0;
      case 3: return ((i + j) % 3) === 0;
      case 4: return ((Math.floor(i / 2) + Math.floor(j / 3)) % 2) === 0;
      case 5: return (((i * j) % 2) + ((i * j) % 3)) === 0;
      case 6: return ((((i * j) % 2) + ((i * j) % 3)) % 2) === 0;
      default: return ((((i + j) % 2) + ((i * j) % 3)) % 2) === 0;
    }
  }

  // The four penalty rules, scored on the finished (masked) matrix. Lowest total wins.
  function penalty(m, n) {
    var p = 0, i, j, run, last, dark = 0;
    // rule 1 -- runs of five or more of the same colour, in both directions
    for (i = 0; i < n; i++) {
      run = 1; last = -1;
      for (j = 0; j < n; j++) {
        if (m[i][j] === last) { run++; if (run === 5) p += 3; else if (run > 5) p += 1; }
        else { last = m[i][j]; run = 1; }
      }
      run = 1; last = -1;
      for (j = 0; j < n; j++) {
        if (m[j][i] === last) { run++; if (run === 5) p += 3; else if (run > 5) p += 1; }
        else { last = m[j][i]; run = 1; }
      }
    }
    // rule 2 -- every 2x2 block of one colour
    for (i = 0; i < n - 1; i++) for (j = 0; j < n - 1; j++) {
      var v = m[i][j];
      if (m[i][j + 1] === v && m[i + 1][j] === v && m[i + 1][j + 1] === v) p += 3;
    }
    // rule 3 -- the 1:1:3:1:1 finder-like sequence with four light modules on either side
    var A = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], B = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    for (i = 0; i < n; i++) for (j = 0; j <= n - 11; j++) {
      var okA = true, okB = true, okA2 = true, okB2 = true;
      for (var k = 0; k < 11; k++) {
        if (m[i][j + k] !== A[k]) okA = false;
        if (m[i][j + k] !== B[k]) okB = false;
        if (m[j + k][i] !== A[k]) okA2 = false;
        if (m[j + k][i] !== B[k]) okB2 = false;
      }
      if (okA) p += 40; if (okB) p += 40; if (okA2) p += 40; if (okB2) p += 40;
    }
    // rule 4 -- how far the dark/light balance strays from even
    for (i = 0; i < n; i++) for (j = 0; j < n; j++) if (m[i][j]) dark++;
    var pct = (dark * 100) / (n * n);
    p += Math.floor(Math.abs(pct - 50) / 5) * 10;
    return p;
  }

  // ---- the encoder ----------------------------------------------------------------------------
  function encode(text) {
    // UTF-8 bytes. Every URL we encode is ASCII, but a description or a domain need not be.
    var bytes = [];
    var esc = encodeURIComponent(String(text));
    for (var i = 0; i < esc.length; i++) {
      if (esc.charAt(i) === '%') { bytes.push(parseInt(esc.substr(i + 1, 2), 16)); i += 2; }
      else bytes.push(esc.charCodeAt(i));
    }

    // Smallest version that fits. The character-count field grows from 8 to 16 bits at version 10,
    // so the check has to account for its own size.
    var ver = 0;
    for (var v = 1; v <= 10; v++) {
      var ccBits = v < 10 ? 8 : 16;
      var need = Math.ceil((4 + ccBits + bytes.length * 8) / 8);
      if (need <= capacity(v)) { ver = v; break; }
    }
    if (!ver) return null;   // too long for this encoder; the caller draws no QR rather than a wrong one

    var t = VER[ver], eccLen = t[1];
    var total = capacity(ver);
    var bits = new Bits();
    bits.put(4, 4);                                   // byte mode
    bits.put(bytes.length, ver < 10 ? 8 : 16);
    for (i = 0; i < bytes.length; i++) bits.put(bytes[i], 8);
    // Terminator, then round up to a whole codeword, then the fixed alternating pad.
    var room = total * 8 - bits.b.length;
    bits.put(0, Math.min(4, room));
    while (bits.b.length % 8) bits.b.push(0);
    var dataCw = [];
    for (i = 0; i < bits.b.length; i += 8) {
      var byteV = 0;
      for (var k = 0; k < 8; k++) byteV = (byteV << 1) | bits.b[i + k];
      dataCw.push(byteV);
    }
    var pad = [0xEC, 0x11], pi = 0;
    while (dataCw.length < total) { dataCw.push(pad[pi & 1]); pi++; }

    // Split into blocks, compute each block's error correction, then interleave both sets.
    var blocks = [], eccs = [], at = 0, b;
    for (b = 0; b < t[2]; b++) { blocks.push(dataCw.slice(at, at + t[3])); at += t[3]; }
    for (b = 0; b < t[4]; b++) { blocks.push(dataCw.slice(at, at + t[5])); at += t[5]; }
    for (b = 0; b < blocks.length; b++) eccs.push(ecc(blocks[b], eccLen));

    var seq = [], maxD = 0;
    for (b = 0; b < blocks.length; b++) if (blocks[b].length > maxD) maxD = blocks[b].length;
    for (i = 0; i < maxD; i++) for (b = 0; b < blocks.length; b++) if (i < blocks[b].length) seq.push(blocks[b][i]);
    for (i = 0; i < eccLen; i++) for (b = 0; b < eccs.length; b++) seq.push(eccs[b][i]);

    // The stream that gets laid into the matrix, remainder bits included.
    var stream = [];
    for (i = 0; i < seq.length; i++) for (k = 7; k >= 0; k--) stream.push((seq[i] >>> k) & 1);
    for (i = 0; i < remainderBits(ver); i++) stream.push(0);

    // Function patterns first, so the data placement knows what to step over.
    var n = 17 + 4 * ver;
    var mat = new Mat(n);
    finder(mat, 0, 0); finder(mat, 0, n - 7); finder(mat, n - 7, 0);
    var ax = ALIGN[ver];
    for (i = 0; i < ax.length; i++) for (var j2 = 0; j2 < ax.length; j2++) {
      var r = ax[i], c = ax[j2];
      // The three corners already hold finders.
      if ((r <= 8 && c <= 8) || (r <= 8 && c >= n - 9) || (r >= n - 9 && c <= 8)) continue;
      alignment(mat, r, c);
    }
    for (i = 8; i < n - 8; i++) {           // timing patterns
      mat.set(6, i, (i % 2) === 0, true);
      mat.set(i, 6, (i % 2) === 0, true);
    }
    drawVersion(mat, ver);
    drawFormat(mat, 0);                      // reserves the format area; rewritten per mask below

    // Zigzag placement: two columns at a time, right to left, skipping the vertical timing column.
    var idx = 0, up = true;
    for (var col = n - 1; col > 0; col -= 2) {
      if (col === 6) col--;                  // column 6 is the timing pattern
      for (var step = 0; step < n; step++) {
        var row = up ? (n - 1 - step) : step;
        for (var s = 0; s < 2; s++) {
          var cc = col - s;
          if (mat.fixed[row][cc]) continue;
          mat.m[row][cc] = idx < stream.length ? stream[idx] : 0;
          idx++;
        }
      }
      up = !up;
    }

    // Try all eight masks, keep the one the spec's penalty rules like best.
    var best = null, bestScore = Infinity;
    for (var mk = 0; mk < 8; mk++) {
      var cand = [];
      for (i = 0; i < n; i++) {
        cand.push(new Uint8Array(n));
        for (var j3 = 0; j3 < n; j3++) {
          cand[i][j3] = mat.fixed[i][j3]
            ? mat.m[i][j3]
            : (mat.m[i][j3] ^ (maskFn(mk, i, j3) ? 1 : 0));
        }
      }
      // The format bits are not masked by the data mask -- they carry the mask number.
      var tmp = new Mat(n);
      tmp.m = cand; tmp.fixed = mat.fixed;
      drawFormat(tmp, mk);
      var sc = penalty(cand, n);
      if (sc < bestScore) { bestScore = sc; best = cand; }
    }

    return { size: n, version: ver, modules: best };
  }

  // Build-time only: hands back each block as data||parity so the self-check in _snapcard.js can test
  // the syndromes directly. Not used in the browser.
  function __codeword(text) {
    var bytes = [];
    var esc = encodeURIComponent(String(text));
    for (var i = 0; i < esc.length; i++) {
      if (esc.charAt(i) === '%') { bytes.push(parseInt(esc.substr(i + 1, 2), 16)); i += 2; }
      else bytes.push(esc.charCodeAt(i));
    }
    var ver = 0;
    for (var v = 1; v <= 10; v++) {
      var ccBits = v < 10 ? 8 : 16;
      if (Math.ceil((4 + ccBits + bytes.length * 8) / 8) <= capacity(v)) { ver = v; break; }
    }
    if (!ver) return null;
    var t = VER[ver], total = capacity(ver);
    var bits = new Bits();
    bits.put(4, 4);
    bits.put(bytes.length, ver < 10 ? 8 : 16);
    for (i = 0; i < bytes.length; i++) bits.put(bytes[i], 8);
    bits.put(0, Math.min(4, total * 8 - bits.b.length));
    while (bits.b.length % 8) bits.b.push(0);
    var dataCw = [];
    for (i = 0; i < bits.b.length; i += 8) {
      var byteV = 0;
      for (var k = 0; k < 8; k++) byteV = (byteV << 1) | bits.b[i + k];
      dataCw.push(byteV);
    }
    var pad = [0xEC, 0x11], pi = 0;
    while (dataCw.length < total) { dataCw.push(pad[pi & 1]); pi++; }
    var blocks = [], at = 0, b;
    for (b = 0; b < t[2]; b++) { blocks.push(dataCw.slice(at, at + t[3])); at += t[3]; }
    for (b = 0; b < t[4]; b++) { blocks.push(dataCw.slice(at, at + t[5])); at += t[5]; }
    return { ecLen: t[1], blocks: blocks.map(function (d) { return d.concat(ecc(d, t[1])); }) };
  }

  var API = { encode: encode, __codeword: __codeword };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else root.LXQR = API;
})(typeof self !== 'undefined' ? self : this);
