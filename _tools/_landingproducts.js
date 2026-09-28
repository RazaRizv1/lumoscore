// Landing products section: copy, icons, header width, and a horizontal rail on phones.
//
// ICONS. The cards were drawing their own glyphs while the app's nav draws different ones for the same
// three products -- Trade was a swap arrow against the nav's bar chart, Pools a single droplet against
// two, Cross-Chain a plain right arrow against the nav's bridge. Same product, two symbols, which is
// the same problem the naming had. The card glyphs are now lifted verbatim from the nav (_navicons.json,
// extracted from the built dashboard) so there is one set. Rewards, Wallet and Launchpad already
// matched and are re-emitted from the same source rather than left to drift.
//
// HEADER WIDTH. The heading block was capped narrower than the grid it introduces, so it floated in the
// middle of a wider row. It now spans exactly the grid: the left edge of the first card to the right
// edge of the third.
//
// PHONES. Six full-width cards stacked vertically is most of a screen each. They become a horizontal
// rail with scroll-snap and prev/next buttons, which is a scroller rather than a carousel -- no
// autoplay, no cloning, no hidden state. Native overflow scrolling means a swipe still works and
// keyboard focus still moves through the cards in order; the buttons just drive scrollBy.
//
// Re-injects: strips its own previous output first, so copy can be edited and the transform re-run.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const ICONS = require(__dirname + '/_navicons.json');
const B = String.fromCharCode(92);

// Where each card goes. The HUB, never the chain-scoped page: a signed-out visitor clicking
// "Cross-chain" has to be asked which network, not dropped onto the Stellar bridge -- and the
// chain pages are behind the wallet gate, so the click would bounce them to "/" instead.
// runtime() in extract_site upgrades a hub click to /<thing>/stellar once a wallet is connected.
//
// Keyed by the icon-tile kind, which is the same anchor the copy and marks above use, so a card
// can never end up with one product's href over another's name. Root-relative, so staging and
// production each link to themselves.
const HUB = {
  dex: '/trade',
  amm: '/pools',
  bridge: '/bridge',
  rewards: '/rewards',
  launchpad: '/launchpad',
  // The wallet slot carries LUMOS now; the class stays because it is what locates the card.
  wallet: '/lumos',
};

// The call to action on each card. Written to say what is actually on the other side -- six cards all
// reading "Open" would be six identical labels doing no work, and the card is already a link, so the
// label's only job is to name the destination.
const CTA = {
  dex: 'Explore markets',
  amm: 'Explore pools',
  bridge: 'Open the bridge',
  rewards: 'See rewards',
  launchpad: 'Launch a token',
  wallet: 'About LUMOS',
};
const CTA_ARROW = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" '
  + 'stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="M5 12h13"/><path d="M13 6l6 6-6 6"/></svg>';

const HEAD = 'One Interface. Multiple chains. Zero tab-switching.';
const SUB = 'Trade, pool, bridge, deploy, and manage your entire multichain portfolio from a single '
  + 'interface.';

// kind -> [icon key, copy]
const CARDS = {
  dex: ['trade',
    'LumosCore routes your trade through the best path on any supported network — AMMs, orderbooks, or both.'],
  amm: ['pools',
    'Create, deposit, and manage liquidity positions across multiple networks from a single dashboard.'],
  bridge: ['bridge',
    'Move assets between networks without memorizing ten different bridges. LumosCore integrates the most trusted bridging solution for each chain.'],
  rewards: ['rewards',
    'Put your assets to work and earn LUMOS. Provide liquidity on any supported chain, stake, or hold.'],
  wallet: ['wallet',
    'The token the platform runs on. Hold 250,000 LUMOS and your trading fee halves to 0.1%; earn it by '
    + 'providing liquidity, and spend nothing to hold it.',
    'LUMOS',
    '<img class="ic-prod-img" src="/assets/tokens/lumos.png" width="30" height="30" alt="" '
    + 'decoding="async">'],
  launchpad: ['launchpad',
    'Mint asset and deploy its first pool on any supported network in less than 2 minutes.'],
};

// The nav sizes its glyphs from CSS, so the nav markup carries no width/height -- dropped into the
// card's 54px tile as-is, an unsized <svg> fills the tile edge to edge and the stroke scales 2.25x
// with it. The card glyphs it replaces were all width="24" height="24"; 26 keeps that inset in the
// slightly larger tile, and lets the nav's own 1.9 stroke land at roughly the 2.2 the cards had.
const sized = (svg) => svg.replace('<svg ', '<svg width="26" height="26" ');

const ARROW = (dir) => '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" '
  + 'stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" '
  + 'aria-hidden="true"><polyline points="' + (dir === 'prev' ? '15 6 9 12 15 18' : '9 6 15 12 9 18') + '"/></svg>';

const RAIL = '<div class="lx-prail" data-lxnonav="1">'
  + '<button type="button" class="lx-prail-b" data-rail="prev" aria-label="Previous products">' + ARROW('prev') + '</button>'
  + '<button type="button" class="lx-prail-b" data-rail="next" aria-label="Next products">' + ARROW('next') + '</button>'
  + '</div>';

const CSS = '<style id="lx-landproducts-css">'
  // The heading block spans the grid it introduces. h2.block-title caps itself at 760px and .block-sub
  // at 620px, inside a 1280px container -- which is why the header sat in a narrow column above a much
  // wider row. Both caps are lifted so the block runs card-edge to card-edge; the selector carries the
  // section id so it outranks h2.block-title without !important.
  + '.block#products .center-head{max-width:none}'
  + '.block#products .center-head h2.block-title,.block#products .center-head .block-sub'
  + '{max-width:none;margin-left:auto;margin-right:auto}'
  // Phones have no width to give away, so the standfirst goes back to a readable measure.
  + '@media (max-width:900px){.block#products .center-head .block-sub{max-width:560px}}'
  // ---- card interior: icon and title on one centred row, copy centred beneath.
  // No markup change -- the card is already a flex column of three siblings, so it becomes a wrapping
  // row and the <p> is forced onto its own line with a 100% basis. That keeps the icon/title pairing
  // in the flow rather than absolutely positioning anything, so a long title still wraps cleanly.
  // display is restated, not assumed: the mobile build sets the card back to display:block, so a rule
  // that only changed flex-direction left the phone cards as three stacked blocks -- icon hard left,
  // title centred on its own line -- while the desktop ones were right.
  + '.block#products .product-card{display:flex;flex-direction:row;flex-wrap:wrap;align-items:center;'
  + 'justify-content:center;text-align:center;gap:15px}'
  + '.block#products .product-card .ic-prod{margin-bottom:0;flex:0 0 auto}'
  + '.block#products .product-card h3{margin-bottom:0}'
  // The design gave the copy flex:1 so the removed "Open" label could be pushed to the card foot.
  // With the label gone that would make the copy a flexible row item, so it is pinned to a full line.
  + '.block#products .product-card p{flex:0 0 100%;margin-bottom:0}'

  // ---- (3) THE CARDS READ AS CARDS.
  //
  // RAZA: make the six more appealing and prominent. They were flat panels -- a tile, a title and a
  // paragraph on the page background, with nothing marking them as objects you can act on. Each now
  // has a surface, a defined edge, and an accent line along the top that arrives on hover, so the row
  // reads as six things rather than as one block of text in three columns.
  //
  // The lift is 3px and the shadow is soft: enough to register as interactive, not enough to make six
  // of them jump about as the pointer crosses the row.
  + '.block#products .product-card{position:relative;overflow:hidden;padding:30px 26px 28px;'
  + 'border-radius:16px;border:1px solid var(--border);'
  + 'background:linear-gradient(180deg,rgba(234,106,44,.035),rgba(234,106,44,0) 130px),var(--surface);'
  + 'transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}'
  + '.block#products .product-card::before{content:"";position:absolute;left:0;right:0;top:0;height:2px;'
  + 'background:linear-gradient(90deg,var(--accent),rgba(234,106,44,.15));'
  + 'opacity:0;transition:opacity .18s ease}'
  + '.block#products .product-card:hover{transform:translateY(-3px);border-color:rgba(234,106,44,.42);'
  + 'box-shadow:0 14px 34px rgba(0,0,0,.34)}'
  + '.block#products .product-card:hover::before{opacity:1}'
  + '@media(prefers-reduced-motion:reduce){'
  + '.block#products .product-card,.block#products .product-card::before{transition:none}'
  + '.block#products .product-card:hover{transform:none}}'

  // NOT repainted. Each product has its own tile colour in the design -- Trade indigo, Pools green,
  // Cross-Chain violet, Rewards amber, Launchpad orange-red -- and one accent tint across all six
  // erased the distinction between them.
  //
  // (3) The LUMOS mark has NO TILE. The other five are stroke glyphs that need a coloured plate to sit
  // on; this one is a finished logo, and the plate behind it just read as an empty box. The mark keeps
  // the same 50px footprint as the five tiles, so all six line up on one baseline.
  + '.block#products .product-card .lx-ic-logo{background:none;border:0;box-shadow:none}'
  + '.block#products .product-card .ic-prod-img{display:block;width:100%;height:100%;'
  + 'object-fit:contain}'

  // (1) The CTA. Accent, quiet until the card is hovered, and the arrow steps forward with it -- the
  // whole card is the link, so this names the destination rather than being a second control.
  + '.block#products .product-card .lx-pc-cta{flex:0 0 100%;display:inline-flex;align-items:center;'
  + 'justify-content:center;gap:7px;margin-top:16px;font-size:14.5px;font-weight:650;'
  + 'letter-spacing:-.005em;color:var(--accent,#ea6a2c);opacity:.92;'
  + 'transition:opacity .18s ease}'
  + '.block#products .product-card .lx-pc-cta svg{transition:transform .18s ease}'
  + '.block#products .product-card:hover .lx-pc-cta{opacity:1}'
  + '.block#products .product-card:hover .lx-pc-cta svg{transform:translateX(3px)}'
  + '@media(prefers-reduced-motion:reduce){'
  + '.block#products .product-card .lx-pc-cta,'
  + '.block#products .product-card .lx-pc-cta svg{transition:none}'
  + '.block#products .product-card:hover .lx-pc-cta svg{transform:none}}'

  // The name was set at the same weight as the sentence under it.
  + '.block#products .product-card h3{font-size:20px;font-weight:700;letter-spacing:-.015em;'
  + 'color:var(--text)}'
  + '.block#products .product-card p{font-size:15.5px;line-height:1.62;color:var(--text-muted);'
  + 'margin-top:14px}'
  // ---- phones: a snapping rail instead of a six-storey stack.
  + '@media (max-width:900px){'
  // flex-direction is explicit: a mobile rule further down already sets the grid to a column, and
  // switching display to flex inherits that -- the rail measured 380px wide with all six cards
  // stacked before this was pinned.
  + '.block#products .products-grid{display:flex;flex-direction:row;flex-wrap:nowrap;'
  + 'grid-template-columns:none;gap:14px;'
  + 'overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding:0 20px;'
  + 'padding:4px 20px 14px;margin:0 -20px;-webkit-overflow-scrolling:touch;scrollbar-width:none}'
  + '.block#products .products-grid::-webkit-scrollbar{display:none}'
  + '.block#products .product-card{flex:0 0 82%;scroll-snap-align:center;min-width:0}'
  + '.lx-prail{display:flex;justify-content:center;gap:12px;margin-top:16px}'
  + '.lx-prail-b{appearance:none;cursor:pointer;width:42px;height:42px;border-radius:999px;'
  + 'display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--border);'
  + 'background:var(--surface);color:var(--text-soft);'
  + 'transition:color .16s ease,border-color .16s ease,opacity .16s ease}'
  + '.lx-prail-b:hover{color:var(--accent);border-color:var(--accent)}'
  + '.lx-prail-b:focus-visible{outline:2px solid var(--accent);outline-offset:2px}'
  // A disabled end reads as an end, rather than a button that silently does nothing.
  + '.lx-prail-b[disabled]{opacity:.35;cursor:default}'
  + '.lx-prail-b[disabled]:hover{color:var(--text-soft);border-color:var(--border)}'
  + '}'
  // Off the rail on wider screens: the grid is back and the buttons are pointless.
  + '@media (min-width:901px){.lx-prail{display:none}}'
  + '</st' + 'yle>';

const JS = '<script id="lx-landproducts-js">(function(){'
  + 'if(window.__lxPrail)return;window.__lxPrail=1;'
  + 'function grid(){return document.querySelector(".block#products .products-grid");}'
  + 'function step(){var g=grid();if(!g)return 0;var c=g.querySelector(".product-card");'
  + 'return c?(c.getBoundingClientRect().width+14):g.clientWidth;}'
  + 'function sync(){var g=grid();if(!g)return;'
  + 'var p=document.querySelector(\'.lx-prail-b[data-rail="prev"]\'),'
  + 'n=document.querySelector(\'.lx-prail-b[data-rail="next"]\');'
  + 'if(!p||!n)return;'
  + 'var max=g.scrollWidth-g.clientWidth;'
  + 'if(g.scrollLeft<=2)p.setAttribute("disabled","");else p.removeAttribute("disabled");'
  + 'if(g.scrollLeft>=max-2)n.setAttribute("disabled","");else n.removeAttribute("disabled");}'
  // pointerup, not click: this section sits outside the search field so the swallower does not reach
  // it, but the landing page's nav interceptor matches on TEXT and these buttons carry none -- the
  // data-lxnonav on the wrapper is what keeps them clear of it either way.
  + 'document.addEventListener("click",function(e){'
  + 'var b=e.target&&e.target.closest?e.target.closest(".lx-prail-b"):null;if(!b)return;'
  + 'e.preventDefault();e.stopPropagation();'
  + 'var g=grid();if(!g)return;'
  + 'g.scrollBy({left:(b.getAttribute("data-rail")==="prev"?-1:1)*step(),behavior:"smooth"});'
  + 'setTimeout(sync,420);},false);'
  + 'function boot(){var g=grid();if(!g)return;g.addEventListener("scroll",function(){'
  + 'clearTimeout(window.__lxPrailT);window.__lxPrailT=setTimeout(sync,90);},{passive:true});sync();}'
  + 'if(document.readyState!=="loading")setTimeout(boot,0);'
  + 'else document.addEventListener("DOMContentLoaded",boot);'
  + 'window.addEventListener("resize",function(){clearTimeout(window.__lxPrailR);'
  + 'window.__lxPrailR=setTimeout(sync,150);});'
  + '})();</scr' + 'ipt>';

function elRange(html, startIdx, tag) {
  const re = new RegExp('<\\/?' + tag + '\\b', 'g');
  re.lastIndex = startIdx;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    if (m[0].charAt(1) === '/') { depth--; if (depth === 0) return { start: startIdx, end: html.indexOf('>', m.index) + 1 }; }
    else depth++;
  }
  return null;
}

const PAGES = [
  { file: 'lumoscore-aptos-desktop.html', key: 'lumoscore-landing.html' },
  { file: 'lumoscore-aptos-mobile.html', key: 'lumoscore-landing-mobile.html' }
];

const problems = [];
const staged = [];

for (const p of PAGES) {
  const data = read(p.file);
  const { json, s, e } = getContents(data);
  let html = json[p.key];
  if (html == null) { problems.push(p.key + ': missing'); continue; }

  html = html
    .replace(/<style id="lx-landproducts-css">[\s\S]*?<\/style>/g, '')
    .replace(/<script id="lx-landproducts-js">[\s\S]*?<\/script>/g, '')
    .replace(/<div class="lx-prail" data-lxnonav="1">[\s\S]*?<\/div>/g, '');

  const secStart = html.indexOf('<section class="block" id="products"');
  if (secStart < 0) { problems.push(p.key + ': products section not found'); continue; }
  const sec = elRange(html, secStart, 'section');
  if (!sec) { problems.push(p.key + ': products section not closed'); continue; }
  let section = html.slice(sec.start, sec.end);

  // The "Open ->" label. _landingpolish no longer emits it, but that transform skips pages it has
  // already polished, so containers built before that change still carry one per card -- they are
  // removed here, where the section is rewritten every run.
  const goBefore = (section.match(/<span class="pc-go">/g) || []).length;
  section = section.replace(/<span class="pc-go">[\s\S]*?<\/span>\s*/g, '');
  // Our own CTA comes out the same way, so this transform is safe to run against its own output.
  section = section.replace(/<span class="lx-pc-cta"[\s\S]*?<\/span>\s*/g, '');
  if (section.indexOf('pc-go') >= 0) { problems.push(p.key + ': pc-go survived the strip'); continue; }

  // ---- the cards ARE links (RAZA).
  //
  // They were deliberately unlinked before, because _landingpolish wrapped them in anchors
  // pointing at chain pages that bounce a signed-out visitor to "/". The hubs fix the
  // destination, so the cards can carry the click again.
  //
  // Both shapes are handled and the result is the same either way, so the transform is stable
  // whether it runs on _landingpolish's anchors or on its own output: an <a> has its href
  // corrected, a <div> becomes an <a>. The tag is rebuilt from the ORIGINAL attributes rather
  // than from scratch -- data-pc and the --pc/--pc-rgb custom properties are what colour each
  // card, and losing them would leave six grey tiles.
  let linked = 0;
  {
    const openRe = /<(div|a)\b[^>]*class="[^"]*product-card[^"]*"[^>]*>/g;
    const found = [];
    let cm;
    while ((cm = openRe.exec(section))) {
      const r = elRange(section, cm.index, cm[1]);
      if (!r) { problems.push(p.key + ': a product card is not closed'); break; }
      found.push({ tag: cm[1], open: cm.index, openEnd: cm.index + cm[0].length, end: r.end, raw: cm[0] });
    }
    if (!problems.length) {
      // Applied back to front so the offsets of the cards still to do stay valid.
      for (let i = found.length - 1; i >= 0; i--) {
        const c = found[i];
        const inner = section.slice(c.openEnd, c.end - (c.tag === 'a' ? 4 : 6));
        const kind = (inner.match(/ic-prod ([a-z-]+)/) || [])[1];
        const href = kind && HUB[kind];
        if (!href) { problems.push(p.key + ': no hub for card ' + (kind || '?')); break; }
        // Drop any existing href and the tag name; keep everything else verbatim.
        const attrs = c.raw.replace(/^<(div|a)\s*/, '').replace(/>$/, '').replace(/\s*href="[^"]*"/, '');
        section = section.slice(0, c.open)
          + '<a href="' + href + '" ' + attrs + '>' + inner + '</a>'
          + section.slice(c.end);
        linked++;
      }
    }
  }
  if (problems.length) continue;
  if (linked !== 6) { problems.push(p.key + ': linked ' + linked + ' cards, expected 6'); continue; }
  // Every card is an anchor, and every anchor has somewhere to go. An <a> without href is still
  // in the tab order and still announced as a link, which is the trap the old unlink pass existed
  // to avoid; this asserts we have not recreated it.
  if (/<a(?![^>]*href=)[^>]*class="[^"]*product-card/.test(section)) {
    problems.push(p.key + ': a product card anchor has no href'); continue;
  }

  // ---- heading + standfirst
  const h2s = section.indexOf('<h2');
  const h2e = section.indexOf('</h2>', h2s);
  if (h2s < 0 || h2e < 0) { problems.push(p.key + ': products heading not found'); continue; }
  section = section.slice(0, section.indexOf('>', h2s) + 1) + HEAD + section.slice(h2e);

  const ps = section.indexOf('<p', section.indexOf('</h2>'));
  const pe = section.indexOf('</p>', ps);
  if (ps < 0 || pe < 0) { problems.push(p.key + ': products standfirst not found'); continue; }
  section = section.slice(0, section.indexOf('>', ps) + 1) + SUB + section.slice(pe);

  // ---- per-card icon and copy, matched by the icon-tile kind the card already carries
  let done = 0;
  for (const kind of Object.keys(CARDS)) {
    const [iconKey, copy, title, rawIcon] = CARDS[kind];
    const icon = rawIcon || ICONS[iconKey];
    if (!icon) { problems.push(p.key + ': no nav icon for ' + iconKey); break; }
    const at = section.indexOf('ic-prod ' + kind);
    if (at < 0) { problems.push(p.key + ': no card for ' + kind); break; }
    // Swap the mark inside that tile, and ONLY inside it.
    let tileEndShift = 0;
    const tileOpenEnd = section.indexOf('>', at) + 1;
    const tileEnd = section.indexOf('</div>', tileOpenEnd);
    if (tileEnd < 0) { problems.push(p.key + ': unterminated icon tile for ' + kind); break; }
    // A logo mark gets its tile tagged, so the stylesheet can treat it differently without a :has().
    if (rawIcon) {
      const clsAt = section.lastIndexOf('class="', at);
      const clsEnd = section.indexOf('"', clsAt + 7);
      if (clsAt >= 0 && clsEnd > clsAt && !/lx-ic-logo/.test(section.slice(clsAt, clsEnd))) {
        section = section.slice(0, clsEnd) + ' lx-ic-logo' + section.slice(clsEnd);
        tileEndShift = ' lx-ic-logo'.length;
      }
    }
    const inner = section.slice(tileOpenEnd + tileEndShift, tileEnd + tileEndShift);
    // Either shape: the design ships an <svg>, and a previous run of this transform may have left an
    // <img> for a card whose mark is a token logo.
    let mS = inner.indexOf('<svg'), mE = -1;
    if (mS >= 0) mE = inner.indexOf('</svg>', mS) + 6;
    else { mS = inner.indexOf('<img'); if (mS >= 0) mE = inner.indexOf('>', mS) + 1; }
    if (mS < 0 || mE <= mS) { problems.push(p.key + ': could not find the mark for ' + kind); break; }
    // A raw mark goes in as written; a nav glyph still gets sized, since the nav leaves its svgs unsized.
    section = section.slice(0, tileOpenEnd + tileEndShift + mS) + (rawIcon ? rawIcon : sized(icon))
      + section.slice(tileOpenEnd + tileEndShift + mE);
    // then the copy: the <p> after this card's <h3>
    const h3 = section.indexOf('<h3', section.indexOf('ic-prod ' + kind));
    const cps = section.indexOf('<p', h3);
    const cpe = section.indexOf('</p>', cps);
    if (h3 < 0 || cps < 0 || cpe < 0) { problems.push(p.key + ': could not find copy for ' + kind); break; }
    section = section.slice(0, section.indexOf('>', cps) + 1) + copy + section.slice(cpe);
    // The title, for the card whose name changed. Rewritten from the same anchor as everything else so
    // a card can never end up with one product's heading over another's copy.
    if (title) {
      // Replaces the heading's contents rather than inserting, so re-running is a no-op.
      const hOpen = section.indexOf('>', h3) + 1;
      const hEnd = section.indexOf('</h3>', hOpen);
      if (hOpen < 1 || hEnd < 0) { problems.push(p.key + ': could not find the title for ' + kind); break; }
      section = section.slice(0, hOpen) + title + section.slice(hEnd);
    }
    // The CTA, appended after this card's copy.
    const cta = CTA[kind];
    if (cta) {
      const pEnd = section.indexOf('</p>', cps) + 4;
      if (pEnd < 4) { problems.push(p.key + ': could not place the CTA for ' + kind); break; }
      section = section.slice(0, pEnd)
        + '<span class="lx-pc-cta">' + cta + CTA_ARROW + '</span>'
        + section.slice(pEnd);
    }
    done++;
  }
  if (problems.length) continue;
  if (done !== 6) { problems.push(p.key + ': expected 6 cards, rewrote ' + done); continue; }

  // Launchpad sits before LUMOS (RAZA). Written as an ORDER -- "put launchpad first if it is not
  // already" -- never as a swap, because a swap exchanges them again on every run and the order
  // would flip with each build.
  //
  // Card blocks are collected by scanning forward for opener tags that carry the class. Walking
  // BACKWARDS from the icon tile was the first attempt and it silently found nothing: the opener is
  // <div data-lxnonav="1" class="product-card lxpc" ...>, so neither the attribute order nor the
  // nesting is what a reverse search can rely on.
  {
    // Tag-agnostic: the relink pass above has already turned these into anchors.
    const openRe = /<(div|a)\b[^>]*class="[^"]*product-card[^"]*"[^>]*>/g;
    const cards = [];
    let cm;
    while ((cm = openRe.exec(section))) {
      const r = elRange(section, cm.index, cm[1]);
      if (r) cards.push({ s: cm.index, e: r.end, html: section.slice(cm.index, r.end) });
    }
    const iLp = cards.findIndex((c) => c.html.indexOf('ic-prod launchpad') >= 0);
    const iLm = cards.findIndex((c) => c.html.indexOf('ic-prod wallet') >= 0);
    if (iLp < 0 || iLm < 0) problems.push(p.key + ': could not place launchpad before LUMOS');
    else if (iLp > iLm) {
      const lp = cards[iLp], lm = cards[iLm];
      section = section.slice(0, lm.s) + lp.html + section.slice(lm.s, lp.s) + section.slice(lp.e);
    }
  }
  // ---- the rail buttons, right after the grid
  const gi = section.indexOf('class="products-grid"');
  if (gi < 0) { problems.push(p.key + ': products grid not found'); continue; }
  const gOpen = section.lastIndexOf('<div', gi);
  const gr = elRange(section, gOpen, 'div');
  if (!gr) { problems.push(p.key + ': products grid not closed'); continue; }
  section = section.slice(0, gr.end) + RAIL + section.slice(gr.end);

  html = html.slice(0, sec.start) + section + html.slice(sec.end);

  const bo = html.lastIndexOf('</body>');
  html = bo >= 0 ? html.slice(0, bo) + CSS + JS + html.slice(bo) : html + CSS + JS;

  json[p.key] = html;
  staged.push({ file: p.file, data, s, e, json, key: p.key, goBefore, linked });
}

if (problems.length) {
  console.error('landing products: ABORT — nothing written.');
  problems.forEach(x => console.error('  ' + x));
  process.exit(1);
}
for (const st of staged) {
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.key + ': heading, standfirst, 6 icons + 6 copies, rail, '
    + st.goBefore + ' "Open" label(s) removed, ' + st.linked + ' card(s) linked');
}
console.log('landing products: done on ' + staged.length + ' page(s)');
