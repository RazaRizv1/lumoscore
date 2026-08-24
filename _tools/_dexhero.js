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
  + 'margin:0 0 0 auto!important;display:flex!important;align-items:center;gap:12px;order:9}'
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
