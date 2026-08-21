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
    // only pages that actually carry the slide-out
    if (p.indexOf('slide-menu') < 0) { if (p !== before) { json[k] = p; changed = true; } continue; }
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
