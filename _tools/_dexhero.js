// Trade-main: drop the hero, and move Launch Token / How it works into the New Mints card.
//
// The hero was a banner of headline stats above a page whose entire purpose is the table beneath it.
// Those same figures now live on the dashboard's Trade box, which is where someone goes to ask "how big
// is this exchange" -- so on the Trade page they were a second answer to a question nobody asks here,
// pushing the markets below the fold.
//
// Measured before touching anything: on BOTH layouts the only section above the table is the hero. New
// Mints and Market Movers sit BELOW it (desktop: dex-overview, dex-markets, dex-mints-card, dex-movers;
// mobile: lumos-promo, mdx-section-head, list, mdx-mints-card, movers). That matters because it is what
// makes "remove everything above the table" and "put the CTAs in the New Mints box" compatible -- the
// box survives the removal.
//
// The CTA row is MOVED before the hero is hidden, not rebuilt: on desktop it lives inside the hero, so
// hiding the hero first would take it with it. Moving the live node also keeps every handler already
// bound to those two links.
//
// Idempotent: style and script blocks are replaced wholesale; the move is a no-op once done.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const STYLE = '<style id="lx-dexhero-css">'
  // Hidden rather than deleted from the markup. The design re-renders these containers, and a removed
  // node comes back on the next pass while a CSS rule does not.
  + '.lx-dexhero-off{display:none!important}'
  // #40: static, so the hero never gets a frame to paint in.
  //
  // .dex-hero is deliberately NOT in this list, though the script above still names it. It is not a
  // visible hero any more -- an earlier SEO pass emptied it to zero height and left the page's <h1>
  // inside as screen-reader-only text, held open by
  //     .dex-hero:has(> .dex-hero-l.lx-sronly){display:block!important}
  // Adding display:none here would have taken that <h1> out of the crawl and the accessibility tree,
  // on a site whose SEO problem is already thin content. That :has() rule outranks a plain class, so
  // this was a no-op rather than a regression -- but only by luck, and it is not a rule to lean on.
  + '.dex-overview,.lumos-promo.lx-mobhero,.amm-overview{display:none!important}'
  // In the mints card the pair reads as a small toolbar, not as page furniture.
  + '.dex-mints-card .lx-dctas,.mdx-mints-card .lx-dctas,'
  + '.dex-mints-card .mdx-hero-ctas,.mdx-mints-card .mdx-hero-ctas{position:static!important;'
  + 'margin:0 0 0 12px!important;display:flex!important;align-items:center;gap:12px;'
  // #32: order 2 puts it directly after the title (order 0); flex:1 lets it span so the ghost's own
  // auto margin can carry it to the far edge.
  + 'order:2;flex:1 1 auto!important}'
  + '.dex-mints-card .lx-dctas .dex-hero-btn.primary,.dex-mints-card .mdx-hero-ctas .mdx-hero-btn.primary{order:1}'
  + '.dex-mints-card .lx-dctas .dex-hero-btn.ghost,.dex-mints-card .mdx-hero-ctas .mdx-hero-btn.ghost{order:2;margin-left:auto!important}'
  + '.mdx-mints-card .mdx-hero-ctas .mdx-hero-btn.ghost{order:2;margin-left:auto!important}'

  // #32b: the four figures were laid out with flex and content-sized cells, so each row placed its
  // columns wherever its own text happened to end -- measured, PRICE started at x=854 on one row and
  // x=845 on the next, and MARKET CAP at 980 against 971. Nothing lined up vertically. A fixed track
  // list fixes the columns for every row at once. The outer row template is pinned too: its last column
  // was auto, so the whole stats block shifted with the length of the token name beside it.
  //
  // Track widths are not equal because the contents are not: PRICE carries two lines ("0.0000765 XLM"
  // over its dollar value) while 24H TRADES is a small integer. Equal quarters would wrap the first and
  // strand the last.
  // The curated table has been wider than the box holding it all along: measured 1175px of table
  // inside a 968px wrap at a 1280px viewport, with overflow-x:hidden, so the rightmost columns -- Trade
  // among them -- were simply unreachable on any window narrower than about 1500px. The 10% type scale
  // widened it to 1277 and made that worse rather than causing it. Letting the wrap scroll makes the
  // whole table reachable at any width, without hiding a column or dropping one. Horizontal only, so
  // the sticky header is unaffected.
  + '.dex-mk-table-wrap{overflow-x:auto!important}'
  + '.dex-mk-table-wrap::-webkit-scrollbar{height:9px}'
  + '.dex-mk-table-wrap::-webkit-scrollbar-thumb{background:rgba(140,140,150,.4);border-radius:5px}'
  + '.dex-mint-row{grid-template-columns:32px 1fr 440px!important}'
  + '.dex-mint-stats{display:grid!important;'
  + 'grid-template-columns:minmax(0,1.35fr) minmax(0,1fr) minmax(0,1.15fr) minmax(0,.6fr);'
  + 'gap:0 16px!important;align-items:center;'
  // Fill the track. The block was narrower than the 440px column holding it (measured 376px on one row,
  // 369px on the next) and sat against the right edge, so its LEFT edge moved with its own content and
  // the columns drifted apart again even though the row template was identical on every row. A grid item
  // only stretches if nothing else sizes it; an auto margin from the design was overriding that.
  + 'width:100%!important;margin:0!important}'
  // Right-aligned as a block AND inside each cell: the label sat left over a right-aligned value, so
  // even a single cell read as ragged.
  + '.dex-mint-stat{align-items:flex-end!important;text-align:right}'
  + '.dex-mint-stat .l,.dex-mint-stat .v{width:100%;text-align:right!important}'
  // Digits in a column only line up if they are the same width.
  + '.dex-mint-stat .v{font-variant-numeric:tabular-nums}'
  // #32c: a hairline between rows. Four columns of figures are read ACROSS, and desktop gave the eye
  // nothing to travel along -- measured, the rows had no separator at all (border-top: 0px none) and
  // were held apart by padding alone. This is not a new flourish: the mobile list already separates its
  // rows with exactly this border, so desktop was the layout departing from the design's own convention.
  // Padding evens up at the same time, since 4px above and 10px below only looked deliberate while there
  // was no line to sit between.
  + '.dex-mint-row + .dex-mint-row{border-top:1px solid var(--border)}'
  + '.dex-mint-row{padding:10px 8px!important}'
  // Launch Token: an orange text link, not a filled button competing with the Trade control in every row.
  + '.mdx-hero-ctas .mdx-hero-btn.primary{background:none!important;color:var(--accent,#ea6a2c)!important;'
  + 'box-shadow:none!important;border:0!important;height:auto!important;padding:0!important;font-weight:700}'
  // How it works: the icon carries it. The label is hidden in CSS because it is a bare text node the
  // design rewrites, so removing it from the DOM would not keep it removed.
  + '.mdx-hero-ctas .mdx-hero-btn.ghost{background:none!important;border:0!important;box-shadow:none!important;'
  + 'height:auto!important;padding:0!important;font-size:0!important;gap:0!important}'
  + '.mdx-hero-ctas .mdx-hero-btn.ghost svg{width:17px!important;height:17px!important}'
  + '</style>';

const SCRIPT = '<script id="lx-dexhero">(function(){'
  + 'function q(s){return document.querySelector(s);}'
  + 'function go(){'
  // The mints card, either layout.
  + 'var mints=q(".dex-mints-card")||q(".mdx-mints-card");'
  + 'var ctas=q(".lx-dctas")||q(".mdx-hero-ctas");'
  // The card's own heading row, so the links sit beside the title rather than on top of the list.
  + 'if(mints&&ctas&&!mints.contains(ctas)){'
  + 'var head=mints.querySelector(".dex-mints-head,.mdx-mints-head,.card-head,h3");'
  + 'var host=(head&&head.parentNode===mints)?head:mints;'
  + 'if(host===head&&head.appendChild){head.appendChild(ctas);}else{mints.insertBefore(ctas,mints.firstChild);}'
  
+ '}'
  // #32: the rocket becomes the plus used by Create Pool on Pools -- same .dex-hero-btn.primary class
  // there, so this is the identical control drawn two different ways, and now it is drawn one way.
  + 'var prim=q(".lx-dctas .dex-hero-btn.primary")||q(".mdx-hero-ctas .mdx-hero-btn.primary");'
  + 'if(prim){var psvg=prim.querySelector("svg");'
  + 'if(psvg&&!psvg.querySelector("line")){psvg.setAttribute("stroke-width","2.4");'
  + 'psvg.innerHTML=\'<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>\';}}'
+ 'var hiw=q("#mdxHiwBtn")||q("#dexHiwBtn");'
+ 'if(hiw&&hiw.getAttribute("data-lxhiw")!=="1"){'
+ 'hiw.setAttribute("data-lxhiw","1");'
+ 'hiw.setAttribute("title","How it works");hiw.setAttribute("aria-label","How it works");'
  + '}'
  // Only now is it safe to hide the hero: on desktop the CTA row was inside it.
  + '[".dex-overview",".lumos-promo.lx-mobhero",".dex-hero",".amm-overview"].forEach(function(sel){'
  + 'var el=q(sel); if(el&&!el.classList.contains("lx-dexhero-off"))el.classList.add("lx-dexhero-off");'
  + '});'
  + '}'
  // The design rebuilds this region for a second or two after load, so run a few times rather than once.
  // Cheap: every step is a no-op after the first success.
  + 'function run(){ try{ go(); }catch(_){} }'
  + 'if(document.readyState!=="loading")run(); else document.addEventListener("DOMContentLoaded",run);'
  + '[120,400,900,1800,3200].forEach(function(ms){ setTimeout(run,ms); });'
  // The section head is rebuilt on filter and sort changes too, so watch rather than only poll.
  + 'try{ new MutationObserver(function(){ run(); }).observe(document.body,{childList:true,subtree:true}); }catch(_){}'
  + '})();</script>';

let pages = 0, keys = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = `lumoscore-aptos-${dev}.html`;
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;

  for (const k of Object.keys(json)) {
    let p = json[k];
    const before = p;

    p = p.replace(/<style id="lx-dexhero-css">[\s\S]*?<\/style>/, '')
         .replace(/<script id="lx-dexhero">[\s\S]*?<\/script>/, '');

    // The Trade landing, identified by its markets section rather than by filename.
    const isTrade = p.indexOf('class="dex-markets"') >= 0
                 || p.indexOf('mdx-mk-list') >= 0;
    const isPools = p.indexOf('id="poolsBody"') >= 0
                 || p.indexOf('class="amm-overview"') >= 0;
    if (!isTrade && !isPools) { if (p !== before) { json[k] = p; changed = true; } continue; }

    if (p.indexOf('</head>') >= 0) p = p.replace('</head>', STYLE + '</head>');
    const bi = p.lastIndexOf('</body>');
    if (bi >= 0) p = p.slice(0, bi) + SCRIPT + p.slice(bi);
    keys++;

    if (p !== before) { json[k] = p; changed = true; }
  }

  if (changed) {
    pages++;
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
console.log('trade hero: hidden + CTAs moved into New Mints, on ' + keys + ' page keys across ' + pages + ' container(s)');
