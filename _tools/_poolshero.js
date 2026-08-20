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

const STYLE = `<style id="lx-poolshero-css">
/* The plain page heading says what the card says. Hidden to the eye, kept in the outline. */
.lx-sronly{position:absolute!important;width:1px!important;height:1px!important;margin:-1px!important;padding:0!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;clip-path:inset(50%)!important;white-space:nowrap!important;border:0!important}
.dex-hero:has(> .dex-hero-l.lx-sronly){margin:0!important;padding:0!important;min-height:0!important;display:block!important}
/* the card is a column: copy on top, stats strip pinned along the bottom edge */
.lm-pools .lm{display:flex!important;flex-direction:column;position:relative}
.lm-pools .lm-c-pool,.lm-pools .lm-c{position:relative;z-index:4;display:flex;align-items:center;gap:24px;flex:1 1 auto}
.lm-pools .lm-h{max-width:420px}
/* the chain mark, beside the headline. A pseudo-element because the site's logo painter rewrites the
   contents of anything icon-shaped -- the same guard the Trade hero and the token icons use. */
.lm-pools .lx-heroico{flex:0 0 auto;position:relative;width:56px;height:56px;border-radius:50%;overflow:hidden;box-shadow:0 6px 18px -8px rgba(0,0,0,.55)}
.lm-pools .lx-heroico::before{content:"";position:absolute;inset:0;background:url("${HERO_MARK}") center/contain no-repeat}
html[data-theme="light"] .lm-pools .lx-heroico{box-shadow:0 6px 18px -10px rgba(16,16,22,.35)}
/* THE CHIP BECOMES THE STRIP. Same element the Pools layer fills; it just spans the bottom edge now
   instead of floating in the top-right corner. z-index 4 clears .lm::after, which is 3. */
.lm-pools .lm-chip{position:absolute!important;left:0!important;right:0!important;bottom:0!important;top:auto!important;
  width:auto!important;max-width:none!important;min-width:0!important;z-index:4!important;
  display:block!important;box-sizing:border-box;
  margin:0!important;padding:13px 26px 15px!important;
  border:0!important;border-top:1px solid rgba(255,255,255,.12)!important;border-radius:0!important;
  background:linear-gradient(180deg,rgba(255,255,255,.015),rgba(255,255,255,.075))!important;
  backdrop-filter:blur(16px) saturate(1.3);-webkit-backdrop-filter:blur(16px) saturate(1.3)}
.lm-pools .lm-chip .lx-hstats{display:grid!important;grid-template-columns:1fr 1fr .78fr 1.32fr;align-items:flex-end;gap:0!important}
.lm-pools .lx-hstat{display:flex;flex-direction:column;gap:4px;min-width:0;overflow:hidden;padding-left:17px;border-left:1px solid rgba(255,255,255,.10)}
.lm-pools .lx-hstat:first-child{padding-left:0;border-left:0}
.lm-pools .lx-hstat .v{font:800 28px/1.05 'Hanken Grotesk',sans-serif;color:#fff!important;letter-spacing:-.01em;white-space:nowrap;display:flex;align-items:center;gap:10px}
.lm-pools .lx-hstat .l{font:600 12px/1.2 'JetBrains Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:rgba(228,230,245,.6)!important;white-space:nowrap}
.lm-pools .lx-hstat[data-k=top] .v{font-size:18px}
.lm-pools .lx-hstat[data-k=top] .pair-icons{width:44px;height:26px;flex:0 0 44px}
html[data-theme="light"] .lm-pools .lm-chip{background:linear-gradient(180deg,rgba(255,255,255,.34),rgba(255,255,255,.70))!important;border-top-color:rgba(16,16,22,.12)!important}
html[data-theme="light"] .lm-pools .lx-hstat .v{color:#0e0e10!important}
html[data-theme="light"] .lm-pools .lx-hstat .l{color:rgba(52,52,64,.72)!important}
/* the strip is absolutely positioned, so the copy needs room to clear it */
.lm-pools .lm-c-pool,.lm-pools .lm-c{padding-bottom:96px!important}
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
/* The hero needs ~830px for mark + headline + CTAs on one line; beside the 445px snapshot card it only
   gets that on a very wide window. Measured the same way as the Trade overview: below this the two
   stack, the hero runs full width, and the CTAs sit beside the headline as they do on Trade. */
@media(max-width:1550px){
.amm-overview{grid-template-columns:1fr!important}
}
/* TABLET / PHONE: four columns will not fit, so the strip becomes 2x2 and the mark steps down. */
@media(max-width:880px){
.lm-pools .lm-chip .lx-hstats{grid-template-columns:1fr 1fr;gap:11px 0!important}
.lm-pools .lm-chip{padding:11px 18px 12px!important}
.lm-pools .lx-hstat{padding-left:14px}
.lm-pools .lx-hstat:nth-child(2n+1){padding-left:0;border-left:0}
.lm-pools .lx-hstat .v{font-size:21px}
.lm-pools .lx-heroico{width:44px;height:44px}
.lm-pools .lm-c-pool,.lm-pools .lm-c{padding-bottom:120px!important}
.lm-pools .lx-dctas{position:static!important;order:9;margin:14px 0 0!important;align-self:flex-start}
}
@media(max-width:560px){
.lm-pools .lx-hstat .v{font-size:16px;gap:6px}
.lm-pools .lx-hstat .l{font-size:8px;letter-spacing:.03em}
.lm-pools .lx-hstat[data-k=top] .v{font-size:10.5px}
.lm-pools .lx-hstat[data-k=top] .pair-icons{width:32px;height:20px;flex:0 0 32px}
.lm-pools .lx-heroico{width:38px;height:38px}
}
</style>`;

const SCRIPT = `<script id="lx-poolshero">(function(){
  function q(s,r){return (r||document).querySelector(s);}
  // Every step is a MOVE or a class flag on something that already exists, and every step is guarded, so
  // a second pass over an arranged card does nothing. The stats are deliberately NOT touched here -- the
  // Pools layer writes into them through .lm-chip, and taking them out of it blanks every value.
  function apply(){
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
    var src=q('.dex-hero-r');
    if(src&&src.parentNode!==copy){
      if((' '+src.className+' ').indexOf(' lx-dctas ')<0)src.className+=' lx-dctas';
      copy.appendChild(src);
    }

    // 3. the plain page heading above the card now duplicates the card. Hidden visually only.
    var h=q('.dex-hero-l');
    if(h&&(' '+h.className+' ').indexOf(' lx-sronly ')<0)h.className+=' lx-sronly';
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
