// The admin header: our logo, and nothing that claims a chain.
//
// Four things wrong with what the design shipped (RAZA 2026-09-24):
//
//  1. THE LOGO WAS NOT OURS. An orange gradient tile with a generic droplet glyph, drawn in CSS and
//     SVG, while the public site's header uses the LumosCore flame. Replaced with that flame --
//     /assets/favicon.png, which this build already ships and which is BYTE-IDENTICAL to the image the
//     public header inlines (checked: same 23747 bytes, same md5), so the two cannot drift.
//     Referenced as a file rather than re-inlined: the public pages carry it as ~24KB of base64 each,
//     and there is no reason to pay that again on every admin page.
//
//  2. THE NETWORK SWITCHER DOES NOT BELONG HERE. Admin is not a wallet surface -- nothing on these
//     pages is signed, and the chain it named was whatever the multichain engine last re-skinned it to
//     ("Aptos" in the markup, "Stellar / Not Connected" on screen). Removed outright.
//
//  3. NO SEARCH. The button opened nothing; the admin sections have their own filters.
//
//  4. THE ADMIN BUTTON WORE A STELLAR MARK, which misstates what the panel governs -- it administers
//     the whole platform, XRPL and the bridge included, not one chain. The markup says "AD", two
//     characters, which is exactly what the logo healer repaints as a ticker badge. So it gets the
//     flame as an <img> child: per the healer's own rules an image child is left alone, where a
//     data-logoed attribute on a text node is not.
//
// Idempotent: each edit is skipped when its result is already present, so re-running changes nothing.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const LOGO = '/assets/favicon.png';
// A plain <img>, so the logo healer leaves it alone and there is no text for it to mistake for a ticker.
const MARK_IMG = '<img src="' + LOGO + '" alt="" width="26" height="26" '
  + 'style="width:100%;height:100%;object-fit:contain;display:block">';
const AV_IMG = '<img src="' + LOGO + '" alt="" width="22" height="22" '
  + 'style="width:100%;height:100%;object-fit:contain;display:block;border-radius:50%">';

// The gradient tile and its padding existed to frame a glyph; the flame is its own mark and needs
// neither. !important because the design's own rule is later in the cascade on some variants.
const CSS = '<style id="lx-admhdr-css">'
  + '.admin-logo-mark{background:none!important;border-radius:0!important;padding:0!important;'
  + 'display:inline-flex!important;align-items:center;justify-content:center}'
  + '.admin-logo-mark img{width:100%;height:100%;object-fit:contain;display:block}'
  + '.ah-admin-av{background:none!important;color:transparent!important;font-size:0!important;'
  + 'display:inline-flex!important;align-items:center;justify-content:center;overflow:hidden}'
  + '.ah-admin-av img{display:block}'
  + '</style>';

// <div class="ah-net-switcher"> ... </div> -- matched by its own nesting depth rather than lazily to
// the first </div>, which would cut it open and leave its children orphaned in the header.
function dropBlock(h, openRe) {
  const m = openRe.exec(h);
  if (!m) return h;
  let i = m.index + m[0].length, depth = 1;
  const tag = /<\/?div\b/gi;
  tag.lastIndex = i;
  let t;
  while (depth > 0 && (t = tag.exec(h))) {
    depth += t[0][1] === '/' ? -1 : 1;
    i = t.index + t[0].length;
  }
  if (depth !== 0) return h;                 // unbalanced: leave it alone rather than truncate the page
  const end = h.indexOf('>', i);
  return end < 0 ? h : h.slice(0, m.index) + h.slice(end + 1);
}

let logo = 0, nets = 0, search = 0, avs = 0, pages = 0, seen = 0;
for (const c of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain', 'stellar', 'xrpl']) {
  for (const dev of ['desktop', 'mobile']) {
    const file = `lumoscore-${c}-${dev}.html`;
    let data; try { data = read(file); } catch (e) { continue; }
    const { json, s, e } = getContents(data);
    let changed = false;

    for (const k of Object.keys(json)) {
      let h = json[k];
      if (h.indexOf('admin-header') < 0) continue;          // not an admin page
      seen++;
      const before = h;

      // 1. the mark
      if (h.indexOf('admin-logo-mark') >= 0 && h.indexOf(MARK_IMG) < 0) {
        const out = h.replace(/(<span class="admin-logo-mark"[^>]*>)[\s\S]*?(<\/span>)/, '$1' + MARK_IMG + '$2');
        if (out !== h) { h = out; logo++; }
      }
      // 2. the network switcher
      if (h.indexOf('ah-net-switcher') >= 0) {
        const out = dropBlock(h, /<div class="ah-net-switcher"[^>]*>/);
        if (out !== h) { h = out; nets++; }
      }
      // 3. search
      if (h.indexOf('admSearchBtn') >= 0) {
        const out = h.replace(/<button[^>]*id="admSearchBtn"[\s\S]*?<\/button>/, '');
        if (out !== h) { h = out; search++; }
      }
      // 4. the admin avatar
      if (h.indexOf('ah-admin-av') >= 0 && h.indexOf(AV_IMG) < 0) {
        const out = h.replace(/(<span class="ah-admin-av"[^>]*>)[\s\S]*?(<\/span>)/, '$1' + AV_IMG + '$2');
        if (out !== h) { h = out; avs++; }
      }

      h = h.replace(/<style id="lx-admhdr-css">[\s\S]*?<\/style>/g, '');   // idempotent
      if (h.indexOf('</head>') >= 0) h = h.replace('</head>', CSS + '</head>');

      if (h !== before) { json[k] = h; changed = true; pages++; }
    }

    if (changed) {
      const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
      fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
    }
  }
}
console.log('admin header: ' + seen + ' header(s), ' + pages + ' changed — logo ' + logo + ', net switcher ' + nets
  + ', search ' + search + ', avatar ' + avs);
// A re-run legitimately changes nothing -- that is idempotence, not failure. The real failure is
// finding NO admin header at all, which means the design's markup moved and this is a silent no-op.
if (!seen) { console.error('  ! no admin header found — markup has changed'); process.exit(1); }
