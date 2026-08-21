// The phone slide-out menu, given some hierarchy.
//
// What it was: a 11px "Menu" label, a wallet chip the same weight as everything else, two group
// headings, and five identical 49px rows each carrying a bare 18px outline icon. Nothing led, nothing
// grouped visually, and the icons floated in the row with no shape of their own -- so the whole panel
// read as one undifferentiated list.
//
// What it is now, using the markup that is already there:
//   - the connected wallet reads as a card, with a live dot beside its status and the address in mono
//   - group headings get room and step back
//   - each row's icon sits in a rounded tile, which is what makes a row scan as an object rather than
//     a line of text with a glyph in front of it, and a chevron says the row goes somewhere
//   - taller rows (52px) for a thumb, and a real pressed state
//
// CSS only, on the design's own elements -- no markup is rebuilt, so nothing here can fight the
// menu's open/close behaviour or its navigation.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const STYLE = `<style id="lx-mobmenu-css">
/* ---- the panel ------------------------------------------------------------------------------- */
/* #15: the panel could be dragged up past its own content, leaving a band of nothing under the theme
   row. It scrolls, so the browser rubber-bands it; overscroll-behavior none stops the bounce as well
   as the chaining to the page behind. The height cap makes it scroll to its end, not past it. */
.slide-menu{overscroll-behavior:none;max-height:100dvh;overflow-y:auto}
/* #20: the wallet card is markup that is always present -- when nobody is connected it has no name and
   no address, so the card this file gives a ground and a border to rendered as an empty rounded box
   under the heading. Nothing to say, nothing to draw. */
.slide-menu .menu-user:not(:has(.mu-name:not(:empty))){display:none!important}
.slide-menu .menu-head{padding-bottom:14px;border-bottom:1px solid var(--border);margin-bottom:6px}
.slide-menu .menu-head .lbl{font:800 10.5px/1 'JetBrains Mono',monospace;letter-spacing:.16em;
  text-transform:uppercase;color:var(--text-soft)}
.slide-menu .menu-close{border-radius:10px;transition:background .15s ease,color .15s ease}
.slide-menu .menu-close:hover,.slide-menu .menu-close:active{background:var(--surface-2);color:var(--text)}

/* ---- the connected wallet ---------------------------------------------------------------------- */
/* It was one more row in the stack. It is the single most important thing in this panel -- who you
   are and what you are connected to -- so it gets a ground of its own. */
.slide-menu .menu-user{background:var(--surface-2);border:1px solid var(--border);border-radius:14px;
  padding:12px 12px!important;margin-bottom:4px}
.slide-menu .menu-user .mu-name{font-family:'JetBrains Mono',monospace;font-weight:700;letter-spacing:-.2px}
/* a live dot in front of the status, so "Connected" is shown as well as said */
.slide-menu .menu-user .mu-sub{display:inline-flex;align-items:center;gap:6px;color:var(--text-soft)}
.slide-menu .menu-user .mu-sub::before{content:"";width:6px;height:6px;border-radius:50%;
  background:var(--green,#35c07f);box-shadow:0 0 0 3px rgba(53,192,127,.18);flex:0 0 6px}
.slide-menu .menu-user .mu-gear{border-radius:10px;transition:background .15s ease,color .15s ease}
.slide-menu .menu-user .mu-gear:hover,.slide-menu .menu-user .mu-gear:active{
  background:var(--surface);color:var(--red,#ff5b5b)}

/* ---- group headings ---------------------------------------------------------------------------- */
.slide-menu .menu-group{font:800 9.5px/1 'JetBrains Mono',monospace!important;letter-spacing:.16em;
  text-transform:uppercase;color:var(--text-soft);padding:18px 12px 6px!important}

/* ---- the rows ---------------------------------------------------------------------------------- */
.slide-menu .menu-links a{position:relative;display:flex;align-items:center;gap:12px;
  padding:8px 12px!important;min-height:52px;border-radius:12px;font-size:15px;font-weight:600;
  transition:background .15s ease}
.slide-menu .menu-links a:hover,.slide-menu .menu-links a:active{background:var(--surface-2)}
/* The icon gets a tile. content-box so the 18px glyph keeps its size and the padding becomes the
   tile, which means no wrapper element and nothing for the menu's own script to trip over. */
.slide-menu .menu-links a>svg{width:18px;height:18px;box-sizing:content-box;padding:8px;
  border-radius:11px;background:var(--surface-2);color:var(--text-muted);flex:0 0 auto;
  transition:background .15s ease,color .15s ease}
.slide-menu .menu-links a:hover>svg,.slide-menu .menu-links a:active>svg{
  background:var(--accent-pale,rgba(234,106,44,.12));color:var(--accent,#ea6a2c)}
/* a chevron, so a row reads as somewhere to go */
.slide-menu .menu-links a::after{content:"";position:absolute;right:14px;top:50%;
  width:6px;height:6px;margin-top:-3px;border-right:2px solid var(--text-soft);
  border-bottom:2px solid var(--text-soft);transform:rotate(-45deg);opacity:.45;
  transition:opacity .15s ease,transform .15s ease}
.slide-menu .menu-links a:hover::after{opacity:.9;transform:rotate(-45deg) translate(1px,1px)}
/* the wallet card is not a nav row -- it must not grow a chevron or a tile */
.slide-menu .menu-user a::after{content:none}
.slide-menu .menu-user a>svg{padding:0;background:none;border-radius:0}
</style>`;

// ---- #5: the pages the menu skipped -------------------------------------------------------------
// Dashboard, Trade, Pools, Bridge and Launchpad were left out because the bottom bar carries most of
// them. But the bottom bar is five icons with no room for Launchpad at all, and a menu that lists
// Rewards and MCP while omitting Trade and Pools reads as incomplete rather than as deliberate.
// Inserted BEFORE "Discover", so the products come first and the account section stays where it is.
const ICO = (d) => '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
  + 'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';

// #16: use the app's OWN nav icons, not lookalikes. The first version drew its own Pools drop, Bridge
// connector and Launchpad rocket, which is why those three read as a different set from the rail and
// the bottom bar. These are lifted from the desktop rail at build time and keyed by the link's label,
// so they cannot drift from it -- and if a label is ever missing, the local drawing below is used.
let RAIL = {};
try {
  const deskJson = getContents(read('lumoscore-aptos-desktop.html')).json['lumoscore-dex.html'] || '';
  const re = /<a\b[^>]*>([\s\S]{0,900}?)<\/a>/g;
  let m;
  while ((m = re.exec(deskJson))) {
    const inner = m[1];
    const svg = (inner.match(/<svg[\s\S]*?<\/svg>/) || [''])[0];
    if (!svg) continue;
    const label = inner.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (!/^(Dashboard|Trade|Pools|Bridge|Launchpad)$/.test(label)) continue;
    if (RAIL[label]) continue;
    // the rail draws at its own size; the menu wants 18px
    RAIL[label] = svg.replace(/<svg\b/, '<svg width="18" height="18"');
  }
} catch (e) { }
const NAV = [
  ['lumoscore-home-mobile.html', 'Dashboard',
    ICO('<rect x="3" y="3" width="7" height="9" rx="1.6"/><rect x="14" y="3" width="7" height="5" rx="1.6"/><rect x="14" y="12" width="7" height="9" rx="1.6"/><rect x="3" y="16" width="7" height="5" rx="1.6"/>')],
  ['lumoscore-dex-mobile.html', 'Trade',
    ICO('<path d="M3 3v18h18"/><path d="M8 6v3"/><rect x="6" y="9" width="4" height="6" rx="1"/><path d="M8 15v3"/><path d="M16 4v2"/><rect x="14" y="6" width="4" height="9" rx="1"/><path d="M16 15v3"/>')],
  ['lumoscore-amm-mobile.html', 'Pools',
    ICO('<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>')],
  ['lumoscore-bridge-mobile.html', 'Bridge',
    ICO('<circle cx="5" cy="12" r="2.4"/><circle cx="19" cy="12" r="2.4"/><line x1="7.4" y1="12" x2="16.6" y2="12"/><polyline points="14 9.6 16.6 12 14 14.4"/>')],
  ['lumoscore-launch-token-mobile.html', 'Launchpad',
    ICO('<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>')],
];
const NAVBLOCK = '<div class="menu-group" data-lxnav="1">Products</div>'
  + NAV.map(([href, label, ico]) =>
      '<a href="' + href + '" data-lxnav="1">' + (RAIL[label] || ico) + label + '</a>').join('');
console.log('  nav icons taken from the rail: ' + (Object.keys(RAIL).join(', ') || 'none — using local drawings'));

let containers = 0, pages = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = `lumoscore-aptos-${dev}.html`;
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;

  for (const k of Object.keys(json)) {
    let p = json[k];
    const before = p;
    p = p.replace(/<style id="lx-mobmenu-css">[\s\S]*?<\/style>/, '');
    // strip a previous Products block: bounded to the tagged nodes, never a run to the next </div>
    p = p.replace(/<div class="menu-group" data-lxnav="1">[\s\S]*?<\/div>/, '')
         .replace(/<a href="[^"]*" data-lxnav="1">[\s\S]*?<\/a>/g, '');
    // only pages that actually carry the slide-out
    if (p.indexOf('slide-menu') < 0) { if (p !== before) { json[k] = p; changed = true; } continue; }
    // the products group goes above Discover
    const disc = p.indexOf('<div class="menu-group">Discover</div>');
    if (disc >= 0) p = p.slice(0, disc) + NAVBLOCK + p.slice(disc);
    if (p.indexOf('</head>') < 0) continue;
    p = p.replace('</head>', STYLE + '</head>');
    if (p !== before) { json[k] = p; changed = true; pages++; }
  }

  if (changed) {
    containers++;
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
console.log('mobile menu restyled on ' + pages + ' page keys across ' + containers + ' containers');
