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
// Flat colour, not outlines. A hairline stroke in currentColor reads as a second piece of punctuation
// beside the label; a solid shape with its own colour reads as a mark, which is what makes a row of
// tabs scannable rather than uniform. Each icon is at most three fills, because these render at 12-13px
// and anything finer turns to mud.
//
// The colours are chosen to be recognisable rather than decorative: the stablecoin blue is USDC's own,
// the meme face is the yellow every messenger uses, and All carries the four accents of the app itself.
function ic(body) {
  return '<span class="lx-tabic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none">'
    + body + '</svg></span>';
}
const IC = {
  // everything: the app's four accents, laid out
  all: '<span class="lx-tabic lx-tabic-img" aria-hidden="true"><img src="/assets/tokens/xlm.png" alt=""></span>',
  _allOld: ic('<rect x="3" y="3" width="8" height="8" rx="2.2" fill="#ea6a2c"/>'
        + '<rect x="13" y="3" width="8" height="8" rx="2.2" fill="#3b82f6"/>'
        + '<rect x="3" y="13" width="8" height="8" rx="2.2" fill="#22c55e"/>'
        + '<rect x="13" y="13" width="8" height="8" rx="2.2" fill="#a855f7"/>'),
  // ours: a filled star, which is what the text star was always standing in for
  native: ic('<path d="M12 2.4l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5-5.8-3.06-5.8 3.06 1.1-6.5-4.7-4.6 6.5-.95z" fill="#f7b733"/>'
           + '<path d="M12 2.4l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5-5.8-3.06z" fill="#eb9b1f"/>'),
  // a coin, in the blue the biggest one on this network actually uses
  stables: ic('<circle cx="12" cy="12" r="9.2" fill="#2775ca"/>'
            + '<path d="M12 6.1v11.8" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/>'
            + '<path d="M14.7 9.2a2.7 2.7 0 0 0-2.6-1.7h-.7a2.35 2.35 0 0 0 0 4.7h1a2.35 2.35 0 0 1 0 4.7h-.7a2.7 2.7 0 0 1-2.6-1.7" stroke="#fff" stroke-width="1.7" stroke-linecap="round" fill="none"/>'),
  // a grin
  memes: ic('<circle cx="12" cy="12" r="9.2" fill="#fbbf24"/>'
          + '<path d="M7.8 13.6a4.9 4.9 0 0 0 8.4 0z" fill="#7c3f00"/>'
          + '<ellipse cx="9.1" cy="9.5" rx="1.25" ry="1.5" fill="#7c3f00"/>'
          + '<ellipse cx="14.9" cy="9.5" rx="1.25" ry="1.5" fill="#7c3f00"/>'),
  // a cog: the token that powers something
  utility: ic('<path d="M12 1.9l2.2 1.5 2.6-.5 1.2 2.4 2.4 1.2-.5 2.6 1.5 2.2-1.5 2.2.5 2.6-2.4 1.2-1.2 2.4-2.6-.5-2.2 1.5-2.2-1.5-2.6.5-1.2-2.4-2.4-1.2.5-2.6L1.9 12l1.5-2.2-.5-2.6 2.4-1.2 1.2-2.4 2.6.5z" fill="#14b8a6"/>'
            + '<circle cx="12" cy="12" r="3.5" fill="#0b3b38"/>'),
  // stacked pools
  // Stroked, so the tab's own colour drives it. Matches poolTabIcons() in _ammdata.js exactly -- if one
  // is ever changed the other has to change with it, or the flash comes back.
  pools: '<span class="lx-tabic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'
    + '<polyline points="12 2.6 2.4 7.3 12 12 21.6 7.3 12 2.6"/>'
    + '<polyline points="2.4 16.7 12 21.4 21.6 16.7"/><polyline points="2.4 12 12 16.7 21.6 12"/>'
    + '</svg></span>',
  _poolsOld: ic('<path d="M12 2.3 2.5 6.9 12 11.5l9.5-4.6z" fill="#60a5fa"/>'
          + '<path d="M2.5 12 12 16.6l9.5-4.6-3-1.45L12 13.7l-6.5-3.15z" fill="#3b82f6"/>'
          + '<path d="M2.5 17.1 12 21.7l9.5-4.6-3-1.45L12 18.8l-6.5-3.15z" fill="#1d4ed8"/>'),
  // mine
  // A wallet, not a person: this tab is not "you", it is the pools your liquidity is in.
  mine: '<span class="lx-tabic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'
    + '<rect x="2.6" y="5.8" width="18.8" height="12.9" rx="2.6"/>'
    + '<path d="M2.6 9.9h18.8"/><path d="M17 14.4h2.2"/>'
    + '</svg></span>',
  _mineOld: ic('<circle cx="12" cy="7.4" r="4.1" fill="#a855f7"/>'
         + '<path d="M3.9 20.9v-1.5a5 5 0 0 1 5-5h6.2a5 5 0 0 1 5 5v1.5z" fill="#7e22ce"/>'),
};

const STYLE_ICONS = `<style id="lx-tabs-css">
.lx-tabic{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;margin-right:2px}
/* Sized UP. At 13px these read as punctuation beside the label rather than as marks in their own
   right -- and a 13px icon next to a 15.5px label is the one proportion that always looks like an
   afterthought. Set a touch LARGER than the label so the icon leads the eye into it. */
.lx-tabic svg{display:block;width:17px;height:17px}
/* The chain mark reads as identity, not decoration: it is the one element on the chip that says WHICH
   network these pairs are on, and at 17px inside a 31px chip it was the smallest thing in the row.
   22px still clears the chip with room either side, and matches the weight of the asset marks in the
   list beneath it. The svg icons on the other chips stay at 17 -- they are glyphs, not logos, and
   growing an outline icon just makes it look heavy. */
.lx-tabic-img img{display:block;width:22px;height:22px;border-radius:50%;object-fit:cover}
/* Same on the phone, scaled to that chip: 15 -> 19. */
.mdx-mk-filter .lx-tabic-img img{width:19px;height:19px}
.mdx-mk-filter .lx-tabic svg{width:15px;height:15px}
#poolTabs .lx-tabic svg{width:18px;height:18px}
@media(max-width:880px){#poolTabs .lx-tabic svg{width:15px;height:15px}}
/* Full colour on every tab. Dimming the inactive ones to .72 was what made a set of otherwise
   saturated marks look washed out and cheap; the active tab is already carried by its filled
   background, so the icons do not need to fade to say which one is on. */
.lx-tabic{opacity:1}
/* The native tab shipped a text star. It now has a drawn one, and two stars on one tab is one too
   many -- hidden only where ours actually landed, so the authored markup still stands on its own. */
.lx-tabic+.lx-mk-star{display:none!important}
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
// The icon is <span class="lx-tabic" ...><svg>...</svg></span> -- ONE closing span. An earlier version
// of this ended the match at </span></span>, which the icon never contains, so it ran forward to the
// next one anywhere in the document and deleted everything in between: ~70KB out of each Trade page.
// End on </svg></span>, which is the icon's own tail and appears nowhere else in these buttons.
function stripIcons(p) {
  return p.replace(/<span class="lx-tabic[^"]*"[^>]*>[\s\S]*?<\/span>/g, '');
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
    p = p.replace(/<style id="lx-tabs-css">[\s\S]*?<\/style>/g, '')
         .replace(/<style id="lx-tabs-phone-css">[\s\S]*?<\/style>/g, '');
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
        [`<button class="${pre}-mk-filter lx-mk-native" data-filter="native" data-cat="native">`, IC.native],
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
// Guard against the failure above ever returning quietly: no button may carry two icons.
for (const dev2 of ['desktop', 'mobile']) {
  let d2; try { d2 = read(`lumoscore-aptos-${dev2}.html`); } catch (e) { continue; }
  const { json: j2 } = getContents(d2);
  for (const k2 of Object.keys(j2)) {
    const dupes = (j2[k2].match(/<span class="lx-tabic[^"]*"[^>]*>[\s\S]*?<\/span>\s*<span class="lx-tabic/g) || []).length;
    if (dupes) throw new Error('tabs: ' + dupes + ' duplicated icon(s) on ' + k2 + ' in ' + dev2 + ' — stripIcons is not matching a form it should');
  }
}
console.log('tabs: ' + added + ' Utility buttons, ' + icons + ' icons, '
  + pages + ' page keys across ' + containers + ' containers');
