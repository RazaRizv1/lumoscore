// Pools hero — the Trade hero's treatment, on the Pools card.
//
// The two heroes were already the same component underneath: both are .lumos-promo.lm-on holding a .lm
// card, both carry a headline, a subtitle, two CTAs and exactly four stats. What differed was the
// arrangement. Trade puts the chain mark beside the headline, lifts the page's CTAs into the card's top
// right, and lays its four stats along the bottom edge as one strip. Pools kept the plain page heading
// above the card and parked its four stats in a floating 2x2 chip.
//
// So this ports the ARRANGEMENT, not the content. The headline, the subtitle, the four stats and the two
// buttons stay exactly what the Pools data layer produces -- 24h Fees, 24h Trades, Tokens, Top Pool, and
// How it works? / Create Pool. Nothing here invents a number or renames a label.
//
// The rules are the Trade hero's own, from _dexdata.js's lx-dexmain-css block, transposed onto this card.
// They are restated rather than imported: _dexdata.js only injects on the three Trade pages, and reaching
// into another transform's template at build time would make the Trade page's styling load-bearing for
// this one.
//
// THE STATS ARE STYLED WHERE THEY SIT, NOT MOVED. The first attempt relocated the four .lx-hstat cells
// out of .lm-chip and into a new strip. The layout was right and every value went blank: the Pools data
// layer writes into those cells through the chip, so cells outside it are never filled again. The chip
// IS the strip now -- same nodes, same parent, same selectors the layer depends on -- and only its box
// changes. That is the whole reason this file styles rather than rebuilds: the data layer owns this card.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const KEYS = ['lumoscore-amm.html', 'lumoscore-amm-dark.html', 'lumoscore-amm-mobile.html'];

// The chain mark, from the same registry the Trade hero reads, so the two cards cannot drift apart.
const CHAIN_REG = JSON.parse(fs.readFileSync(__dirname + '/_chains.json', 'utf8'));
const HERO_MARK = (CHAIN_REG.stellar && CHAIN_REG.stellar.logo) || '';
if (!HERO_MARK) throw new Error('_chains.json: no stellar logo — refusing to ship a blank hero mark');

// The SAME artwork the Trade hero uses, hashed the same way. The Trade card is not a gradient at all --
// it is this SVG over #130c07 -- which is why it reads warm rather than violet, and why it holds still.
// Same ?v=<hash> discipline: a palette change that reuses the URL is what left phones serving last
// year's image from cache.
const heroV = (name) => {
  try {
    const buf = fs.readFileSync(__dirname + '/../assets/hero/' + name);
    return require('crypto').createHash('sha1').update(buf).digest('hex').slice(0, 8);
  } catch (e) { return '0'; }
};
const HERO_DARK = '/assets/hero/trade-hero-dark.svg?v=' + heroV('trade-hero-dark.svg');
const HERO_LIGHT = '/assets/hero/trade-hero-light.svg?v=' + heroV('trade-hero-light.svg');
for (const n of ['trade-hero-dark.svg', 'trade-hero-light.svg']) {
  if (!fs.existsSync(__dirname + '/../assets/hero/' + n)) throw new Error('missing hero art: ' + n);
}

const STYLE = `<style id="lx-poolshero-css">
/* The card's ground is set once, for BOTH heroes, in _heromono.js. Declaring it here as well is how
   the two drifted apart before. Only overflow stays -- the strip's bottom corners need it. */
html .lumos-promo.lm-on.lm-pools{overflow:hidden!important}
/* NOTHING MOVES ON THIS CARD. The Pools hero shipped a drifting constellation, three nebula blooms and a
   twinkling starfield; the Trade hero has none -- its own constellation layer is display:none, and the
   warm art is a still image. These are the animated layers, switched off rather than left running under
   an opaque background where they would still burn a repaint every frame. */
.lm-pools .lx-cosmic,.lm-pools .lx-constel,.lm-pools .lx-neb,.lm-pools .lx-stars,.lm-pools .lx-part,.lm-pools .lm-svg,.lm-pools .lm-streams,.lm-pools .lm-bars,.lm-pools .lm-pool{display:none!important}
/* THE SAME HEIGHT AS TRADE. The Pools card carried min-height:366 on itself and 330 on .lm, from when
   the stats sat beside the copy in a tall chip. With the strip along the bottom the content decides the
   height, exactly as it does on Trade -- and 366 was the difference between a 370px card here and a
   302px one there. */
/* Desktop only. Trade's phone card sets no floor and sizes to its content -- about 140px -- so
   carrying the desktop 300 onto mobile was doubling the height of a card with the same rows in it. */
@media(min-width:881px){
html .lumos-promo.lm-on.lm-pools{min-height:300px!important}
.lm-pools .lm{min-height:300px!important}
}
/* _ammdata hides the chip below 1100px -- correct while it was a floating 2x2 box beside the copy,
   wrong now that it IS the stats strip along the bottom edge. */
@media(max-width:1100px){.lm-pools .lm-chip{display:block!important}}
/* the rotating carousel the built card replaces */
.lm-pools .lumos-promo-slides,.lm-pools .lumos-promo-dots{display:none!important}
/* The phone card is one column: mark and headline, then the CTAs, then the strip. */
@media(max-width:880px){
.lm-pools .lm-c-pool,.lm-pools .lm-c{flex-wrap:wrap;align-items:center;gap:14px;padding:18px 18px 16px!important}
.lm-pools .lm-h{font-size:27px!important;line-height:1.12!important;max-width:none;flex:1 1 180px}
.lm-pools .lm-sub{display:none!important}
.lm-pools .lx-dctas{flex:1 1 100%;margin:2px 0 0!important}
}
/* The plain page heading says what the card says. Hidden to the eye, kept in the outline. */
.lx-sronly{position:absolute!important;width:1px!important;height:1px!important;margin:-1px!important;padding:0!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;clip-path:inset(50%)!important;white-space:nowrap!important;border:0!important}
.dex-hero:has(> .dex-hero-l.lx-sronly){margin:0!important;padding:0!important;min-height:0!important;display:block!important}
/* the card is a column: copy on top, stats strip pinned along the bottom edge */
.lm-pools .lm{display:flex!important;flex-direction:column;position:relative}
.lm-pools .lm-c-pool,.lm-pools .lm-c{position:relative;z-index:4;display:flex;align-items:center;gap:24px;flex:1 1 auto;padding:26px 30px!important}
/* 340, not the Trade hero's 420. Same intent, different sentence: "The most advanced DEX on Stellar."
   wraps of its own accord and renders 311px wide, so 420 never binds there. "Provide liquidity, earn
   swap fees." runs to the full 420 and then the row needs 774px in a 744px card, which is what pushed
   the CTAs onto their own line. At 340 it breaks after the comma -- two lines, same shape as Trade -- and
   the row fits with room to spare. */
.lm-pools .lm-h{max-width:340px}
/* the chain mark, beside the headline. A pseudo-element because the site's logo painter rewrites the
   contents of anything icon-shaped -- the same guard the Trade hero and the token icons use. */
.lm-pools .lx-heroico{flex:0 0 auto;position:relative;width:56px;height:56px;border-radius:50%;overflow:hidden;box-shadow:0 6px 18px -8px rgba(0,0,0,.55)}
.lm-pools .lx-heroico::before{content:"";position:absolute;inset:0;background:url("${HERO_MARK}") center/contain no-repeat}
html[data-theme="light"] .lm-pools .lx-heroico{box-shadow:0 6px 18px -10px rgba(16,16,22,.35)}
/* THE CHIP BECOMES THE STRIP. Same element the Pools layer fills; it just spans the bottom edge now
   instead of floating in the top-right corner. z-index 4 clears .lm::after, which is 3. */
.lm-pools .lm-chip{position:relative!important;order:9;margin-top:auto!important;left:auto!important;right:auto!important;bottom:auto!important;top:auto!important;
  width:auto!important;max-width:none!important;min-width:0!important;z-index:4!important;
  display:block!important;box-sizing:border-box;
  padding:13px 26px 15px!important;
  border:0!important;border-radius:0!important;
  /* colour (background + top border) belongs to _heromono.js, which styles this strip and Trade's
     together. Declaring it here too is what would let the two drift, and once _heromono moved into
     <head> to stop the first-paint flash, this later copy would have won. */
  backdrop-filter:blur(16px) saturate(1.3);-webkit-backdrop-filter:blur(16px) saturate(1.3)}
.lm-pools .lm-chip .lx-hstats{display:grid!important;grid-template-columns:1fr 1fr .78fr 1.32fr;align-items:flex-end;gap:0!important}
.lm-pools .lx-hstat{display:flex;flex-direction:column;gap:4px;min-width:0;overflow:hidden;padding-left:17px;border-left:1px solid rgba(255,255,255,.10)}
.lm-pools .lx-hstat:first-child{padding-left:0;border-left:0}
.lm-pools .lx-hstat .v{font:800 28px/1.05 'Hanken Grotesk',sans-serif;letter-spacing:-.01em;white-space:nowrap;display:flex;align-items:center;gap:10px}
.lm-pools .lx-hstat .l{font:600 12px/1.2 'JetBrains Mono',monospace;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
.lm-pools .lx-hstat[data-k=top] .v{font-size:18px}
.lm-pools .lx-hstat[data-k=top] .pair-icons{width:46px;height:28px;flex:0 0 46px;overflow:visible}
.lm-pools .lx-hstat[data-k=top] .pair-icons .lx-ico{width:28px!important;height:28px!important}
/* Stat colours -- both themes -- belong to _heromono.js, so Trade and Pools cannot disagree about
   them. They were declared here too, and with _heromono now in <head> this later copy would win. */
/* the page CTAs, lifted into the hero's top-right corner */
.lm-pools .lx-dctas{position:absolute!important;top:20px;right:22px;z-index:5;display:flex!important;align-items:center;gap:14px;margin:0!important;padding:0!important}
.lm-pools .lx-dctas .dex-hero-btn.primary{order:1}
.lm-pools .lx-dctas .dex-hero-btn.ghost{order:2}
.lm-pools .lx-dctas .dex-hero-btn{display:inline-flex!important;align-items:center;justify-content:center;gap:7px;height:38px;padding:0 15px!important;border-radius:10px;font-weight:700;font-size:13px;line-height:1;text-decoration:none;white-space:nowrap;border:1px solid transparent;margin:0!important;flex:0 0 auto}
.lm-pools .lx-dctas .dex-hero-btn svg{width:15px;height:15px;flex:0 0 auto}
.lm-pools .lx-dctas .dex-hero-btn.primary{background:linear-gradient(180deg,#ff8a4c,var(--accent,#ea6a2c))!important;color:#fff!important;box-shadow:0 10px 22px -12px rgba(234,106,44,.95),inset 0 1px 0 rgba(255,255,255,.30)}
.lm-pools .lx-dctas .dex-hero-btn.ghost{background:none!important;border:0!important;box-shadow:none!important;height:auto!important;padding:0!important;font-weight:600;font-size:13px;color:rgba(255,255,255,.82)!important;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1px;text-decoration-color:currentColor}
html[data-theme="light"] .lm-pools .lx-dctas .dex-hero-btn.ghost{color:#33333d!important}
/* DESKTOP: the CTAs share the headline's row rather than floating in a corner -- the Trade arrangement.
   The card is one of two columns here, so it only has the room for that once the overview stops splitting
   (see the stacking rule below); the wrap is the fallback, not the intent. */
@media(min-width:881px){
.lm-pools .lm-c-pool,.lm-pools .lm-c{flex-wrap:wrap;column-gap:24px;row-gap:12px;align-content:center}
.lm-pools .lm-h{flex:0 0 auto}
/* The Trade hero drops its subtitle on desktop -- mark, headline, CTAs, strip, nothing else -- and that
   is what leaves the CTAs room to sit on the headline's line rather than wrapping under it. Kept on the
   phone, where the Trade hero keeps its own. */
.lm-pools .lm-sub{display:none!important}
/* The copy column is capped at 58% by the design, which was right when the stats floated beside it in a
   chip. The strip is along the bottom now, so the row has the whole card to lay out in. */
.lm-pools .lm-c-pool,.lm-pools .lm-c{max-width:none!important;width:100%!important}
/* The card's own "Provide Liquidity" link, hidden for the same reason the Trade hero hides its "Start
   Trading": the page's two CTAs have moved into the card and a third button in the row is what pushes
   them onto their own line. The action still exists on the page; only this copy of it goes. */
.lm-pools .lm-cta{display:none!important}
.lm-pools .lx-dctas{position:static!important;top:auto;right:auto;order:9;margin-left:auto!important;align-self:flex-start}
.lm-pools .lx-heroico{width:64px;height:64px}
}
/* Stacking point: the SAME number the Trade overview uses, so the two pages change shape together
   instead of one splitting while the other has already stacked. Measured identical at 1696px -- both
   rows resolve to 798px + 570px -- so the threshold is the only thing that could put them out of step. */
@media(max-width:1615px){
.amm-overview{grid-template-columns:1fr!important}
}
/* ...unless the rail is collapsed, which is where the width comes back from. Same pair of rules, same
   numbers, as the Trade overview: collapse the menu and the hero sits beside Market Overview exactly
   as it sits beside New Mints there. */
@media(min-width:1445px) and (max-width:1615px){
.nx-side.nx-collapsed ~ .main .amm-overview{grid-template-columns:1.4fr 1fr!important}
}
/* TABLET / PHONE: four columns will not fit, so the strip becomes 2x2 and the mark steps down. */
@media(max-width:880px){
.lm-pools .lm-chip .lx-hstats{grid-template-columns:1fr 1fr;gap:11px 0!important}
.lm-pools .lm-chip{padding:11px 18px 12px!important}
.lm-pools .lx-hstat{padding-left:14px}
.lm-pools .lx-hstat:nth-child(2n+1){padding-left:0;border-left:0}
.lm-pools .lx-hstat .v{font-size:21px}
.lm-pools .lx-heroico{width:44px;height:44px}
.lm-pools .lx-dctas{position:static!important;order:9;margin:14px 0 0!important;align-self:flex-start}
}
@media(max-width:560px){
/* Trade fits all four across on the phone rather than stacking 2x2, which is what keeps its card
   about 140px tall instead of 300. Same grid here. */
.lm-pools .lm-chip .lx-hstats{grid-template-columns:repeat(4,auto)!important;justify-content:space-between;gap:0!important}
.lm-pools .lm-chip{padding:9px 14px 10px!important}
.lm-pools .lx-hstat{padding-left:0;border-left:0}
.lm-pools .lx-hstat .v{font-size:16px;gap:6px}
.lm-pools .lx-hstat .l{font-size:8px;letter-spacing:.03em}
.lm-pools .lx-hstat[data-k=top] .v{font-size:10.5px}
.lm-pools .lx-heroico{width:38px;height:38px}
}
/* PHONE, and deliberately last in this sheet: the desktop rules above use !important too, so an
   earlier media block loses the tie to them on document order alone. Everything here exists to
   match Trade's phone card, which is a mark, a headline and the strip -- nothing else. */
@media(max-width:880px){
/* _ammdata floors the card at 366px, which is a desktop number; Trade's phone card has no floor
   and sizes to its three rows. It declares the floor TWICE -- on the card and on the inner .lm --
   so releasing one alone still leaves a 366px card wrapped round a 147px one. */
.lm-pools .lm{min-height:0!important}
html .lumos-promo.lm-on.lm-pools{min-height:0!important}
/* the Top Pool pair marks are sized for the desktop strip and are what make this row taller
   than Trade's otherwise identical one */
/* Same selector shape as the desktop rule above on purpose: [data-k=top] gives that one four
   classes to this one's three, so a shorter selector here loses the cascade however late it sits. */
.lm-pools .lx-hstat[data-k=top] .pair-icons{
  position:relative!important;display:inline-flex!important;align-items:center;
  width:auto!important;height:17px!important;flex:0 0 auto!important;overflow:visible}
/* .lx-ico is named explicitly: the desktop rule above is .lm-pools .lx-hstat[data-k=top]
   .pair-icons .lx-ico -- five classes to a child selector's four, so it kept winning on height
   (28px) while flex-basis quietly set the width to 17, which is what left the marks overflowing
   the strip by 5px. Equal specificity now, and this sheet is later. */
.lm-pools .lx-hstat[data-k=top] .pair-icons>*,
.lm-pools .lx-hstat[data-k=top] .pair-icons .lx-ico{
  position:static!important;left:auto!important;top:auto!important;right:auto!important;bottom:auto!important;
  width:17px!important;height:17px!important;flex:0 0 17px}
.lm-pools .lx-hstat[data-k=top] .pair-icons>*+*,
.lm-pools .lx-hstat[data-k=top] .pair-icons .lx-ico+.lx-ico{margin-left:-6px!important}
.lm-pools .lm-c,.lm-pools .lm-c-pool{flex-direction:row!important;flex-wrap:nowrap!important;align-items:center!important;gap:12px!important;padding:14px 14px!important}
/* 18px is Trade's phone headline. 27px was a desktop size on a 375px screen. The margin goes
   too: the headline box measures 44px inside an 85px column, and that 13px of leftover is the
   last of the height difference against Trade, whose own headline carries none. */
.lm-pools .lm-h{font-size:18px!important;line-height:1.22!important;max-width:none!important;flex:1 1 auto;margin:0!important}
.lm-pools .lm-sub{display:none!important}
/* The strip cells: Trade sets 3px between value and label, and its Top Pair value box is exactly
   as tall as the marks inside it. Pools ran 4px and a 21px value box against 17px marks, which is
   the whole of the 54px-vs-49px difference between the two strips. */
.lm-pools .lx-hstat{gap:3px!important}
.lm-pools .lx-hstat[data-k=top] .v{height:17px!important}
.lm-pools .lx-hstat[data-k=top] .pair-icons{margin:0!important}
}
/* ---- the list section head, matching Trade's -------------------------------------------------- */
/* Trade heads its list with a title and tucks the two actions in on the right; Pools had them as a
   full-width bar under the hero, which is the loudest thing on the screen and not what Trade does.
   Values are copied from the Trade phone build rather than re-picked, so the two cannot drift. */
.lx-poolhead{display:flex;justify-content:space-between;align-items:baseline;margin:22px 0 10px}
.lx-poolhead h2{margin:0;font-size:17px;font-weight:800;color:var(--text);letter-spacing:-.3px}
.lx-poolhead .mdx-hero-ctas{display:flex!important;align-items:center;gap:7px;margin:0 0 0 auto!important;padding:0!important;flex:0 0 auto}
/* primary first, ghost second -- the order Trade reads in */
.lx-poolhead .mdx-hero-btn.primary{order:1}
.lx-poolhead .mdx-hero-btn.ghost{order:2}
.lx-poolhead .mdx-hero-btn{display:inline-flex!important;align-items:center;justify-content:center;gap:5px;height:31px;padding:0 8px!important;border-radius:9px;font-weight:700;font-size:10.5px;line-height:1;text-decoration:none;white-space:nowrap;border:1px solid transparent;width:auto!important;margin:0!important;flex:0 0 auto}
.lx-poolhead .mdx-hero-btn svg{width:11px;height:11px;flex:0 0 auto}
.lx-poolhead .mdx-hero-btn.primary{background:linear-gradient(180deg,#ff8a4c,var(--accent,#ea6a2c))!important;color:#fff!important;box-shadow:0 8px 18px -11px rgba(234,106,44,.95),inset 0 1px 0 rgba(255,255,255,.30)}
.lx-poolhead .mdx-hero-btn.ghost{flex:0 0 auto;justify-content:flex-start!important;background:none!important;border:0!important;box-shadow:none!important;height:auto!important;padding:0!important;font-weight:600;font-size:10.5px;color:var(--text-muted,#b8b8c2)!important;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1px;text-decoration-color:currentColor}
.lx-poolhead .mdx-hero-btn.ghost svg{width:10px;height:10px;opacity:.75}
html[data-theme="light"] .lx-poolhead .mdx-hero-btn.ghost{color:#33333d!important}
</style>`;

const SCRIPT = `<script id="lx-poolshero">(function(){
  function q(s,r){return (r||document).querySelector(s);}
  // Every step is a MOVE or a class flag on something that already exists, and every step is guarded, so
  // a second pass over an arranged card does nothing. The stats are deliberately NOT touched here -- the
  // Pools layer writes into them through .lm-chip, and taking them out of it blanks every value.
  // Only ever runs where the page did not ship a .lm -- i.e. the phone build. Idempotent: once the
  // card exists this returns on the first line.
  function buildMobile(){
    var promo=q('.lumos-promo'); if(!promo)return;
    if(q('.lm',promo))return;
    var slide=q('.lumos-promo-slide',promo);
    var title=slide?q('.lumos-promo-title',slide):null;
    var sub=slide?q('.lumos-promo-sub',slide):null;
    if(!title)return;                       // no copy to build from; leave the page as it is
    var lm=document.createElement('div'); lm.className='lm';
    var c=document.createElement('div'); c.className='lm-c lm-c-pool';
    var ic=document.createElement('span'); ic.className='lx-heroico'; ic.setAttribute('aria-hidden','true');
    var h=document.createElement('h2'); h.className='lm-h';
    h.innerHTML=title.innerHTML;            // keeps the line break and the accent span
    var pEl=document.createElement('p'); pEl.className='lm-sub';
    if(sub)pEl.innerHTML=sub.innerHTML;
    c.appendChild(ic); c.appendChild(h); c.appendChild(pEl);
    // the chip is what _ammdata.js looks for before it will build and fill the four stats
    var chip=document.createElement('div'); chip.className='lm-chip';
    lm.appendChild(c); lm.appendChild(chip);
    promo.appendChild(lm);
    promo.className+=' lm-pools lm-on lx-mobhero';
  }
  function apply(){
    // The phone page ships the carousel and no .lm. Build the card first; every step below then
    // treats mobile and desktop identically.
    buildMobile();
    var card=q('.lumos-promo.lm-pools'); if(!card)return;
    var lm=q('.lm',card); if(!lm)return;
    var copy=q('.lm-c-pool',lm)||q('.lm-c',lm); if(!copy)return;

    // 1. the chain mark, first thing in the copy column
    if(!q('.lx-heroico',copy)){
      var ic=document.createElement('span');
      ic.className='lx-heroico'; ic.setAttribute('aria-hidden','true');
      copy.insertBefore(ic,copy.firstChild);
    }

    // 2. the page's two CTAs, lifted into the card. MOVED, not rebuilt -- #ammHiwBtn already carries its
    //    listener, and a clone would render correctly and then do nothing when pressed.
    //    On the phone they go BELOW the card instead. Trade's phone card carries no buttons at all,
    //    and folding this row in was the whole reason the Pools card ran to twice Trade's height.
    //    Moved rather than dropped: Create Pool stays on the page, one row further down than the
    //    page originally put it, and keeps .mdx-hero-ctas -- NOT lx-dctas, which positions absolute
    //    against the card it would no longer be inside.
    var phone=(' '+card.className+' ').indexOf(' lx-mobhero ')>=0;
    var src=q('.dex-hero-r')||q('.mdx-hero-ctas');
    if(src&&phone){
      // Trade's two actions live in the list's section head, not in a bar under the hero -- and the
      // Pools phone page ships no section head at all, so build the one it is missing and move them
      // into it. Inserted before the All Pools / My Positions tabs, which is where Trade's head sits
      // relative to its own filter row.
      var tabs=q('#poolTabs')||q('.filter-tabs');
      var head=q('.lx-poolhead');
      if(tabs&&!head){
        head=document.createElement('div');
        head.className='mdx-section-head lx-poolhead';
        var h2=document.createElement('h2'); h2.textContent='Liquidity Pools';
        head.appendChild(h2);
        tabs.parentNode.insertBefore(head,tabs);
      }
      if(head&&src.parentNode!==head)head.appendChild(src);
    }else if(src&&src.parentNode!==copy){
      if((' '+src.className+' ').indexOf(' lx-dctas ')<0)src.className+=' lx-dctas';
      copy.appendChild(src);
    }

    // 3. Market Overview carries five rows to Trade's New Mints three, so the column beside the hero
    //    runs taller than the hero itself. Participants and 24h Fees go -- matched on their label rather
    //    than their position, so a reordered list cannot take the wrong two.
    var drop={'participants':1,'24h fees':1};
    var rows=document.querySelectorAll('.amm-snapshot-row');
    for(var r=0;r<rows.length;r++){
      var lbl=rows[r].querySelector('.amm-snapshot-label');
      if(!lbl)continue;
      if(drop[(lbl.textContent||'').trim().toLowerCase()])rows[r].style.display='none';
    }

    // 3. the plain page heading above the card now duplicates the card. Hidden visually only.
    var heads=[q('.dex-hero-l'),q('.page-title'),q('.page-subtitle')];
    for(var hi=0;hi<heads.length;hi++){ var hd=heads[hi];
      if(hd&&(' '+hd.className+' ').indexOf(' lx-sronly ')<0)hd.className+=' lx-sronly'; }
  }
  function boot(){
    apply();
    // The Pools layer rebuilds this card when its data lands and again on each refresh, so re-assert
    // rather than assuming one pass is enough. Cheap: every branch above is a no-op once arranged.
    try{
      var host=document.querySelector('.page')||document.body;
      new MutationObserver(function(){ apply(); }).observe(host,{childList:true,subtree:true});
    }catch(_){}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();</script>`;

let containers = 0, pages = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = `lumoscore-aptos-${dev}.html`;
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;
  for (const k of KEYS) {
    if (!json[k]) continue;
    let p = json[k];
    // idempotent: strip any previous copy before re-inserting
    p = p.replace(/<style id="lx-poolshero-css">[\s\S]*?<\/style>/, '')
         .replace(/<script id="lx-poolshero">[\s\S]*?<\/script>/, '');
    if (p.indexOf('</body>') < 0) continue;
    p = p.replace('</body>', STYLE + SCRIPT + '</body>');
    if (p !== json[k]) { json[k] = p; changed = true; pages++; }
  }
  if (changed) {
    containers++;
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
console.log('pools hero: Trade treatment applied to ' + pages + ' page keys across ' + containers + ' containers');
