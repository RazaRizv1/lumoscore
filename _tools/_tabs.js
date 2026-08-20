// Filter tabs: a Utility tab on Trade, an icon on every tab, and the Pools phone tabs and search
// rebuilt as Trade's.
//
// Three separate asks, one file, because they all edit the same four button rows and doing them in
// separate passes means four strip-and-reinject cycles over the same markup.
//
// 1) UTILITY on Trade (desktop and phone). This is markup only -- no filter logic is added. Both
//    readers already handle the value: the desktop table filters on a.cat==="utility" and the phone
//    list matches cat or cat+"s" against a.cat, and AQUA, yXLM, SHX, BTC and LUMOS are already
//    carried as cat:"utility" in the roster. So the tab works the moment the button exists.
//
// 2) An icon on all five Trade tabs and both Pools tabs. Injected right after each button's opening
//    tag rather than around its label, because the labels are rewritten at runtime -- "My Positions"
//    is painted as "My Pools" -- and an icon anchored to label text would be dropped on that pass.
//    LumosCore native keeps the star it already had; that IS its icon, and it is the one tab whose
//    mark is meant to read as a badge rather than a glyph.
//
// 3) The Pools PHONE tabs and search restyled to the Trade phone's. Values are lifted from the Trade
//    build (.mdx-mk-filters, .mdx-mk-search) rather than re-picked. Deliberately scoped to the phone
//    page key: .filter-tabs and .search-box are the same classes on Pools DESKTOP, which was not part
//    of the ask and is left exactly as it is.
//
// Both filter rows scroll horizontally on the phone. Five chips with icons do not fit across 393px,
// and the alternative -- shortening "LumosCore native" -- is a copy change nobody asked for.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const DEX_KEYS = ['lumoscore-dex.html', 'lumoscore-dex-dark.html', 'lumoscore-dex-mobile.html'];
const AMM_KEYS = ['lumoscore-amm.html', 'lumoscore-amm-dark.html', 'lumoscore-amm-mobile.html'];
const PHONE_KEYS = ['lumoscore-amm-mobile.html'];

// ---- icons ---------------------------------------------------------------------------------------
// One stroke weight, one box, currentColor throughout, so a tab's icon inherits whatever state the
// tab is in rather than carrying its own palette.
function ic(paths) {
  return '<span class="lx-tabic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" '
    + 'stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'
    + paths + '</svg></span>';
}
const IC = {
  // four panes: everything, laid out
  all: ic('<rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6"/>'),
  // a coin holding its value
  stables: ic('<circle cx="12" cy="12" r="9"/><path d="M12 6.5v11"/><path d="M14.8 9.1a2.7 2.7 0 0 0-2.6-1.8h-.6a2.4 2.4 0 0 0 0 4.8h.8a2.4 2.4 0 0 1 0 4.8h-.6a2.7 2.7 0 0 1-2.6-1.8"/>'),
  // a grin
  memes: ic('<circle cx="12" cy="12" r="9"/><path d="M8.2 14a4.6 4.6 0 0 0 7.6 0"/><path d="M9 9.4h.01"/><path d="M15 9.4h.01"/>'),
  // a tool
  utility: ic('<path d="M14.6 6.4a3.9 3.9 0 0 0 5.1 5.1l-8.2 8.2a2.1 2.1 0 0 1-3-3l8.2-8.2a3.9 3.9 0 0 0-5.1-5.1l3 3-2.1 2.1-3-3a3.9 3.9 0 0 1 5.1-5.1z"/>'),
  // stacked pools
  pools: ic('<path d="M12 2.6 2.8 7 12 11.4 21.2 7 12 2.6z"/><path d="M2.8 16.8 12 21.2l9.2-4.4"/><path d="M2.8 11.9 12 16.3l9.2-4.4"/>'),
  // one holder
  mine: ic('<path d="M20 20.4v-1.7a4.2 4.2 0 0 0-4.2-4.2H8.2A4.2 4.2 0 0 0 4 18.7v1.7"/><circle cx="12" cy="7.6" r="3.9"/>'),
};

const STYLE_ICONS = `<style id="lx-tabs-css">
.lx-tabic{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;margin-right:1px}
.lx-tabic svg{display:block;width:13px;height:13px}
.mdx-mk-filter .lx-tabic svg,#poolTabs .lx-tabic svg{width:12px;height:12px}
/* An icon on a tab that is not the active one should read as part of the label, not as a second
   thing competing with it. */
.lx-tabic{opacity:.75}
.dex-mk-filter.active .lx-tabic,.mdx-mk-filter.active .lx-tabic,#poolTabs button.active .lx-tabic{opacity:1}
/* Five chips with icons do not fit across a phone. Scroll rather than wrap: a wrapped second row
   pushes the list down and reads as two groups. */
.mdx-mk-filters{display:flex!important;max-width:100%;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.mdx-mk-filters::-webkit-scrollbar{display:none}
.mdx-mk-filter{flex:0 0 auto;white-space:nowrap}
</style>`;

// The Pools phone tabs and search, as Trade's. Every value here is Trade's own.
const STYLE_PHONE = `<style id="lx-tabs-phone-css">
/* .filter-tabs on Pools is a pair of full-width pills with the active one filled accent -- the
   loudest control on the page. Trade uses a small segmented chip group instead, and these are the
   same numbers off .mdx-mk-filters / .mdx-mk-filter. Scoped to #poolTabs so the Pools DESKTOP tabs,
   which share the class and were not part of this, keep their own look. */
#poolTabs{display:flex!important;gap:4px!important;background:var(--surface-2)!important;border:0!important;
  padding:3px!important;border-radius:8px!important;margin:0 0 10px!important;
  max-width:100%;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}
#poolTabs::-webkit-scrollbar{display:none}
#poolTabs button{flex:0 0 auto!important;height:auto!important;padding:5px 11px!important;
  border-radius:5px!important;font-size:11.5px!important;font-weight:700!important;gap:4px!important;
  white-space:nowrap;background:transparent!important;color:var(--text-muted)!important}
#poolTabs button.active{background:var(--surface)!important;color:var(--text)!important}
/* the count rode on the filled accent pill; on a chip it needs its own quiet ground */
#poolTabs .count{font-size:9px!important;font-weight:800!important;padding:1px 5px!important;
  border-radius:999px!important;background:var(--surface-2)!important;color:var(--text-soft)!important}
#poolTabs button.active .count{background:var(--surface-2)!important;color:var(--text-muted)!important}
/* the search row, off .mdx-mk-search: 36px on a recessed ground, not 42px on a raised one */
.search-box.inline-filter{height:36px!important;padding:0 12px!important;gap:8px!important;
  background:var(--surface-2)!important;border-radius:10px!important;margin-bottom:10px!important}
.search-box.inline-filter:focus-within{border-color:var(--accent)!important}
.search-box.inline-filter input{font-size:12.5px!important}
.search-box.inline-filter svg{width:13px!important;height:13px!important}
</style>`;

// ---- markup --------------------------------------------------------------------------------------
function stripIcons(p) {
  return p.replace(/<span class="lx-tabic"[\s\S]*?<\/span><\/span>/g, '')
          .replace(/<span class="lx-tabic" aria-hidden="true">[\s\S]*?<\/svg><\/span>/g, '');
}
function stripUtility(p) {
  return p.replace(/<button class="(?:dex|mdx)-mk-filter"[^>]*data-cat="utility"[^>]*>[\s\S]*?<\/button>/g, '');
}
// Put the icon immediately after the opening tag. The labels are rewritten at runtime, so anchoring
// to them would lose the icon on the next paint.
function iconize(p, btnOpen, icon) {
  const at = p.indexOf(btnOpen);
  if (at < 0) return { p: p, ok: false };
  return { p: p.replace(btnOpen, btnOpen + icon), ok: true };
}

let containers = 0, pages = 0, added = 0, icons = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = `lumoscore-aptos-${dev}.html`;
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;

  for (const k of DEX_KEYS.concat(AMM_KEYS)) {
    if (!json[k]) continue;
    let p = json[k];
    const before = p;
    p = p.replace(/<style id="lx-tabs-css">[\s\S]*?<\/style>/, '')
         .replace(/<style id="lx-tabs-phone-css">[\s\S]*?<\/style>/, '');
    p = stripIcons(p);
    p = stripUtility(p);

    const isDex = DEX_KEYS.indexOf(k) >= 0;
    if (isDex) {
      const pre = k.indexOf('mobile') >= 0 ? 'mdx' : 'dex';
      // Utility, right after Memes
      const memes = `<button class="${pre}-mk-filter" data-filter="memes" data-cat="memes">Memes</button>`;
      if (p.indexOf(memes) >= 0) {
        p = p.replace(memes, memes + `<button class="${pre}-mk-filter" data-filter="utility" data-cat="utility">Utility</button>`);
        added++;
      }
      const rows = [
        [`<button class="${pre}-mk-filter active" data-filter="all" data-cat="all">`, IC.all],
        [`<button class="${pre}-mk-filter" data-filter="stables" data-cat="stables">`, IC.stables],
        [`<button class="${pre}-mk-filter" data-filter="memes" data-cat="memes">`, IC.memes],
        [`<button class="${pre}-mk-filter" data-filter="utility" data-cat="utility">`, IC.utility],
      ];
      for (const [open, icon] of rows) { const r = iconize(p, open, icon); p = r.p; if (r.ok) icons++; }
    } else {
      for (const [open, icon] of [['<button class="active" data-tab="all">', IC.pools],
                                  ['<button data-tab="mine">', IC.mine]]) {
        const r = iconize(p, open, icon); p = r.p; if (r.ok) icons++;
      }
    }

    if (p.indexOf('</head>') >= 0) {
      let css = STYLE_ICONS;
      if (PHONE_KEYS.indexOf(k) >= 0) css += STYLE_PHONE;
      p = p.replace('</head>', css + '</head>');
    }
    if (p !== before) { json[k] = p; changed = true; pages++; }
  }

  if (changed) {
    containers++;
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
console.log('tabs: ' + added + ' Utility buttons, ' + icons + ' icons, '
  + pages + ' page keys across ' + containers + ' containers');
