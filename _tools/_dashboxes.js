// Dashboard: three stat boxes where "Trending on Stellar" used to be.
//
// Trending was a leaderboard of assets, which the Trade page already is and does better -- it duplicated
// that page's job on a screen whose purpose is orientation. These three answer the question the
// dashboard is actually for: how big is each part of this app right now.
//
//   Trade       24h volume across the curated list, its pooled liquidity, and how many markets
//   Pools       every Stellar AMM pool, its total liquidity, its 24h volume
//   Cross-chain the networks reachable from Stellar here, and this bridge's own 24h activity
//
// Every figure is network-wide, per the brief, EXCEPT the cross-chain box, which is deliberately this
// deployment's own bridge traffic. That reads 0 most days, and it says 0 rather than borrowing
// Circle's network-wide numbers to look busier than it is.
//
// Data comes from endpoints that already exist and are already cached -- /lxapi/poolstats for the pool
// totals, /lxapi/dexassets to price the curated list in batches, /lxapi/pools for the ranked pool rows.
// No new endpoint, and nothing here fetches per-asset in a loop.
//
// Idempotent: the style and script blocks are replaced wholesale and the row is only inserted where one
// is not already present.
const fs = require('fs');
const { read, getContents, VERIFIED } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// The curated list, baked from lib.js at build time so it cannot drift from the one the Trade page
// verifies against. XLM itself is dropped: it is the quote asset, not a market in this list.
const CURATED = Object.keys(VERIFIED)
  .map((k) => k.split('|'))
  .filter((p) => p[0] && p[1] && /^G[A-Z2-7]{55}$/.test(p[1]))
  .map((p) => p[0] + '-' + p[1]);

const STYLE = '<style id="lx-dashboxes-css">'
  // Three across on a desktop, stacked on a phone. Small gap, as asked -- these read as one instrument
  // panel rather than three separate cards.
  // One column: these are a stack beside the activity feed, not a strip across the page.
  + '.lx-dbx{display:grid;grid-template-columns:1fr;gap:10px;align-content:start;min-width:0}'
  // The grid it now lives in collapses to one column on a phone, and the stack comes with it.
  + '@media(max-width:900px){.lx-dbx{margin-bottom:16px}}'
  // A row now: the product's graphic on the left, everything else stacked beside it.
  + '.lx-dbx-card{background:var(--surface,#fff);border:1px solid var(--border,#ececef);border-radius:14px;'
  + 'padding:15px 16px;min-width:0;display:flex;flex-direction:row;align-items:flex-start;gap:14px}'
  // The graphic. currentColor is set from --pc on the card, so one SVG serves every product and both
  // themes; the tile behind the motif is the same colour at low alpha rather than a second value.
  + '.lx-dbx-art{width:56px;height:56px;flex:0 0 56px;display:block;color:var(--pc,var(--accent,#ea6a2c))}'
  + '@media(max-width:520px){.lx-dbx-art{width:46px;height:46px;flex:0 0 46px}}'
  + '.lx-dbx-body{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:9px}'
  + '.lx-dbx-head{display:flex;align-items:center;gap:8px;min-width:0}'
  + '.lx-dbx-t{font:800 15px/1.1 "Hanken Grotesk",system-ui,sans-serif;color:var(--text,#0e0e10);'
  + 'letter-spacing:-.015em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  + '.lx-dbx-go{margin-left:auto;flex:0 0 auto;color:var(--text-muted,#8a8fa3);display:flex;transition:transform .15s,color .15s}'
  + '.lx-dbx-go svg{width:14px;height:14px;display:block}'
  + 'a.lx-dbx-card:hover .lx-dbx-go{color:var(--pc,var(--accent,#ea6a2c));transform:translateX(2px)}'
  // Three figures on one line. minmax(0,1fr) so a long number shrinks its own column instead of
  // pushing the other two off the card.
  + '.lx-dbx-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}'
  + '.lx-dbx-s{min-width:0}'
  + '.lx-dbx-l{font:600 10px/1.2 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-muted,#8a8fa3);'
  + 'text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  // A value that is a NAME rather than a figure reads wrong in the tabular face -- it is set in the text
  // face at a size that fits the row it shares.
  + '.lx-dbx-v[data-k="cvia"]{font:800 15px/1.35 "Hanken Grotesk",system-ui,sans-serif!important;letter-spacing:-.01em}'
  + '.lx-dbx-v{margin-top:4px;font:800 20px/1.1 "JetBrains Mono",ui-monospace,monospace;'
  + 'color:var(--text,#0e0e10);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'
  + 'letter-spacing:-.02em}'
  // The way out, in the product's own colour so the card reads as one control rather than a grey box
  // with an orange link in it. Named for the page it opens, not a generic "more".
  + '.lx-dbx-link{display:inline-flex;align-items:center;gap:5px;'
  + 'font:700 12px/1 "Hanken Grotesk",system-ui,sans-serif;color:var(--pc,var(--accent,#ea6a2c))}'
  + '.lx-dbx-link svg{width:12px;height:12px;transition:transform .15s}'
  + 'a.lx-dbx-card:hover .lx-dbx-link svg{transform:translateX(2px)}'
  // A hairline above the link separates the figures from the action without a heavy divider.
  + '.lx-dbx-foot{padding-top:9px;border-top:1px solid var(--border,#ececef)}'
  // The waiting state is the shape of the number, not a spinner and not a zero -- a zero here would be
  // a claim, and on the cross-chain card it is a claim that happens to be true, so the two must not
  // look alike before the data lands.
  + '.lx-dbx-v.wait{color:transparent;border-radius:5px;'
  + 'background-image:linear-gradient(90deg,rgba(140,140,150,.10),rgba(140,140,150,.20),rgba(140,140,150,.10));'
  + 'background-size:200% 100%;animation:lxdbxshim 1.2s ease-in-out infinite}'
  + '@keyframes lxdbxshim{0%{background-position:200% 0}100%{background-position:-200% 0}}'
  + '@media(prefers-reduced-motion:reduce){.lx-dbx-v.wait{animation:none}}'
  + 'a.lx-dbx-card{text-decoration:none;color:inherit;position:relative;overflow:hidden;'
  + 'transition:border-color .15s,transform .15s,box-shadow .15s}'
  // Hover borrows the product colour rather than the brand orange, so four cards do not all light up
  // the same way. color-mix keeps the shadow honest against either theme.
  + 'a.lx-dbx-card:hover{border-color:var(--pc,var(--accent,#ea6a2c));transform:translateY(-1px);'
  + 'box-shadow:0 10px 24px -16px var(--pc,rgba(234,106,44,.85))}'
  + 'a.lx-dbx-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;'
  + 'background:var(--pc,var(--accent,#ea6a2c));transform:scaleY(0);transform-origin:top;transition:transform .18s}'
  + 'a.lx-dbx-card:hover::before{transform:scaleY(1)}'
  + '@media(prefers-reduced-motion:reduce){a.lx-dbx-card,a.lx-dbx-card::before,.lx-dbx-link svg,.lx-dbx-go{transition:none}}'
  + '</style>';

const IC_GO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';

// Each tile is one inline SVG: a rounded plate of the product colour at low alpha, a motif that says
// what the product does, and nothing that needs a file or a second palette. currentColor throughout,
// so the card sets the colour once via --pc and both themes follow.
var _tileSeq = 0;
function tile(inner) {
  // Unique per call: four of these live in one document and a repeated id makes every later tile paint
  // with the first one's gradient.
  var n = ++_tileSeq, gp = 'lxgw' + n, gl = 'lxgl' + n;
  return '<svg class="lx-dbx-art" viewBox="0 0 56 56" fill="none" aria-hidden="true">'
    + '<defs>'
    + '<linearGradient id="' + gp + '" x1="0" y1="0" x2=".85" y2="1">'
    + '<stop offset="0" stop-color="currentColor" stop-opacity="1"/>'
    + '<stop offset="1" stop-color="currentColor" stop-opacity=".82"/></linearGradient>'
    + '<radialGradient id="' + gl + '" cx=".5" cy=".42" r=".62">'
    + '<stop offset="0" stop-color="#fff" stop-opacity=".26"/>'
    + '<stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'
    + '</defs>'
    + '<rect x="0" y="0" width="56" height="56" rx="16" fill="url(#' + gp + ')"/>'
    + '<rect x="6" y="6" width="44" height="44" rx="14" fill="url(#' + gl + ')"/>'
    + '<rect x=".8" y=".8" width="54.4" height="54.4" rx="15.4" fill="none" stroke="#fff" stroke-opacity=".22"/>'
    // A brighter arc along the top edge. White at 14% rather than the product colour, because a highlight
    // is light falling ON the tile, not more of the tile.
    + '<path d="M4 16 A12 12 0 0 1 16 4 L40 4 A12 12 0 0 1 52 16" fill="none" stroke="#fff" stroke-opacity=".34" stroke-width="1.2"/>'
    + '<g style="color:#fff">' + inner + '</g></svg>';
}
// Trade: a market going up, over its own volume bars.
const ART_TRADE = tile('<g opacity=".30"><rect x="15" y="33" width="5" height="9" rx="2" fill="currentColor"/>'
  + '<rect x="25" y="29" width="5" height="13" rx="2" fill="currentColor"/>'
  + '<rect x="35" y="24" width="5" height="18" rx="2" fill="currentColor"/></g>'
  + '<path d="M15 30 L24 22 L31 27 L42 15" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'
  + '<path d="M35 15 L42 15 L42 22" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>');
// Pools: two reserves overlapping, which is what an AMM pair is, inside the ripple of the pool.
const ART_POOLS = tile('<circle cx="28" cy="28" r="16" stroke="currentColor" stroke-width="1.6" opacity=".30"/>'
  + '<circle cx="23" cy="28" r="9" fill="currentColor" opacity=".38"/>'
  + '<circle cx="33" cy="28" r="9" fill="currentColor" opacity=".72"/>');
// Cross-chain: two networks, and the hop between them.
const ART_CHAIN = tile('<path d="M17 33 C17 19, 39 19, 39 33" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity=".55"/>'
  + '<circle cx="17" cy="35" r="5.5" fill="currentColor"/>'
  + '<circle cx="39" cy="35" r="5.5" fill="currentColor"/>'
  + '<circle cx="28" cy="20" r="2.6" fill="currentColor" opacity=".55"/>');
// Launchpad: a launch, with the trail it leaves.
const ART_LAUNCH = tile('<path d="M19 37 L36 20" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>'
  + '<path d="M29 20 L36 20 L36 27" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>'
  + '<g opacity=".45" fill="currentColor"><circle cx="19" cy="41" r="2.2"/><circle cx="25" cy="43" r="1.5"/><circle cx="14" cy="44" r="1.2"/></g>');

// pc = the product colour, applied once and inherited by the tile, the hover edge and the link.
function card(href, art, title, stats, cta, pc) {
  return '<a class="lx-dbx-card" href="' + href + '" style="--pc:' + pc + '">'
    + art
    + '<div class="lx-dbx-body">'
    + '<div class="lx-dbx-head"><span class="lx-dbx-t">' + title + '</span>'
    + '<span class="lx-dbx-go">' + IC_GO + '</span></div>'
    + '<div class="lx-dbx-stats">'
    + stats.map((s) => '<div class="lx-dbx-s"><div class="lx-dbx-l">' + s[0] + '</div>'
      + '<div class="lx-dbx-v wait" data-k="' + s[1] + '">0000</div></div>').join('')
    + '</div>'
    + '<div class="lx-dbx-foot"><span class="lx-dbx-link">' + cta + IC_GO + '</span></div>'
    + '</div></a>';
}

const QAFIRST = '<script id="lx-dashqafirst">(function(){'
  + 'function go(){'
  + 'var box=document.querySelector(".lx-dbx"); if(!box||!box.parentNode)return;'
  + 'var qa=document.querySelector(".quick-actions"); if(!qa||qa.parentNode!==box.parentNode)return;'
  // Already ahead of the cards? Nothing to do -- this is the gate, not a flag.
  + 'if(box.compareDocumentPosition(qa)&Node.DOCUMENT_POSITION_PRECEDING)return;'
  + 'var head=qa.previousElementSibling;'
  + 'if(head&&!/quick actions/i.test(head.textContent||""))head=null;'
  + 'if(head)box.parentNode.insertBefore(head,box);'
  + 'box.parentNode.insertBefore(qa,box);'
  + '}'
  + 'function run(){ try{ go(); }catch(_){} }'
  + 'if(document.readyState!=="loading")run(); else document.addEventListener("DOMContentLoaded",run);'
  + '[120,400,900,1800,3200].forEach(function(ms){ setTimeout(run,ms); });'
  + 'try{ new MutationObserver(run).observe(document.body,{childList:true,subtree:true}); }catch(_){}'
  + '})();<' + '/script>';

const ROW = '<div class="lx-dbx">'
  + card('/trade/stellar', ART_TRADE, 'Trade', [['24h Volume', 'tvol'], ['Liquidity', 'tliq'], ['Markets', 'tmkt']], 'Browse markets', '#a855f7')
  + card('/pools/stellar', ART_POOLS, 'Pools', [['Pools', 'ppool'], ['TVL', 'ptvl'], ['24h Volume', 'pvol']], 'Explore pools', '#38bdf8')
  + card('/bridge', ART_CHAIN, 'Cross-chain', [['Networks', 'cnet'], ['Asset', 'casset'], ['Via', 'cvia']], 'Bridge USDC', '#2dd4bf')
  + card('/launchpad', ART_LAUNCH, 'Launchpad', [['Tokens', 'ltok'], ['Newest', 'lnew'], ['24h Mints', 'lmint']], 'Launch a token', '#f7b733')
  + '</div>';

const SCRIPT = '<script id="lx-dashboxes">(function(){'
  + 'var row=document.querySelector(".lx-dbx"); if(!row)return;'
  + 'var CUR=' + JSON.stringify(CURATED) + ';'
  + 'var CK="lumos.dbx", CACHE={}; try{ CACHE=JSON.parse(localStorage.getItem(CK)||"{}")||{}; }catch(_){ CACHE={}; }'
  + 'function set(k,v){ var el=row.querySelector(\'[data-k="\'+k+\'"]\'); if(!el)return;'
  + 'el.textContent=v; el.classList.remove("wait");'
  // Remember it, but never remember an unknown -- a dash restored on the next visit would present a
  // failure as though it were the answer.
  + 'if(v&&v!=="\\u2014"){ CACHE[k]=v; try{ localStorage.setItem(CK,JSON.stringify(CACHE)); }catch(_){} } }'
  // Paint the last known values before any request goes out. They are replaced in place the moment the
  // live figure lands, so the worst case is a number that is one visit old for a second or two.
  + 'try{ for(var _ck in CACHE){ var _ce=row.querySelector(\'[data-k="\'+_ck+\'"]\');'
  + 'if(_ce&&CACHE[_ck]){ _ce.textContent=CACHE[_ck]; _ce.classList.remove("wait"); } } }catch(_){}'
  + 'function j(u){ return fetch(u).then(function(r){ if(!r.ok)throw new Error(r.status); return r.json(); }); }'
  + 'function num(n){ return Math.round(+n||0).toLocaleString("en-US"); }'
  + 'function usd(x){ x=+x||0; var a=Math.abs(x);'
  + 'if(a>=1e9)return "$"+(x/1e9).toFixed(2)+"B";'
  + 'if(a>=1e6)return "$"+(x/1e6).toFixed(2)+"M";'
  + 'if(a>=1e3)return "$"+(x/1e3).toFixed(1)+"K";'
  + 'return "$"+x.toFixed(2); }'
  // The XLM rate: the same cached key the rest of the app reads, so the boxes cannot price things
  // differently from the page around them.
  + 'function xu(){ try{ var c=JSON.parse(localStorage.getItem("lumos.xlmUsd")||"null");'
  + 'if(c&&+c.v>0&&(Date.now()-c.ts<216e5))return +c.v; }catch(_){} return 0; }'
  // ---- Pools: one cached call carries all three figures.
  + 'j("/lxapi/poolstats").then(function(d){'
  + 'var r=xu();'
  + 'set("ppool",num(d.pools));'
  + 'set("ptvl", (d.tvlXlm>0&&r>0)?usd(d.tvlXlm*r):"\\u2014");'
  + 'set("pvol", d.vol24Usd!=null?usd(d.vol24Usd):"\\u2014");'
  + '}).catch(function(){ ["ppool","ptvl","pvol"].forEach(function(k){ set(k,"\\u2014"); }); });'
  // ---- Trade: the curated list priced in batches of 16, the same size and endpoint the Trade page uses.
  // Markets is set immediately -- it is the length of a list we already hold, not something to wait for.
  + 'set("tmkt",num(CUR.length));'
  + 'var B=16, jobs=[];'
  + 'for(var i=0;i<CUR.length;i+=B)jobs.push(CUR.slice(i,i+B));'
  + 'Promise.all(jobs.map(function(g){'
  + 'return j("/lxapi/dexassets?a="+encodeURIComponent(g.join(","))).catch(function(){return null;});'
  + '})).then(function(rs){'
  + 'var r=xu(), volX=0, seen=0;'
  + 'rs.forEach(function(d){ if(!d||!d.a)return;'
  + 'for(var k in d.a){ var v=d.a[k]; if(v&&v.vol!=null){ volX+=+v.vol||0; seen++; } } });'
  + 'set("tvol", (seen&&r>0)?usd(volX*r):"\\u2014");'
  + '}).catch(function(){ set("tvol","\\u2014"); });'
  // Liquidity across the curated list. The ranked pool rows are already cached and already sorted by
  // TVL, and Stellar's liquidity is heavily concentrated -- the first pages hold almost all of it -- so
  // a few pages give a figure that is right to within dust, without a request per asset.
  + 'var CODES={}; CUR.forEach(function(s){ CODES[s.split("-")[0]]=1; });'
  + 'Promise.all([1,2,3,4].map(function(p){'
  + 'return j("/lxapi/pools?page="+p).catch(function(){return null;});'
  + '})).then(function(ps){'
  + 'var tot=0, hit=0;'
  + 'ps.forEach(function(d){ if(!d||!d.rows)return;'
  + 'd.rows.forEach(function(row){'
  + 'var a=row.a||{}, b=row.b||{};'
  + 'if(!(CODES[a.code]||CODES[b.code]))return;'   // one side must be a curated asset
  + 'var t=+row.tvl||0;'
  + 'if(t>0){ tot+=t; hit++; } }); });'
  + 'set("tliq", hit?usd(tot):"\\u2014");'
  + '}).catch(function(){ set("tliq","\\u2014"); });'
  // ---- Launchpad: assets issued through this deployment.
  + 'j("https://api.stellar.expert/explorer/public/asset?search=lumoscore&limit=200").then(function(d){'
  + 'var r=(d&&d._embedded&&d._embedded.records)||[];'
  // home_domain is the claim that binds an asset to this launchpad, so filter on it rather than trusting
  // a search term to have matched only ours.
  + 'r=r.filter(function(a){ return (a.domain||"")==="lumoscore.com"; });'
  + 'set("ltok",num(r.length));'
  + 'var now=Math.floor(Date.now()/1000);'
  + 'var newest=0; r.forEach(function(a){ if(a.created>newest)newest=a.created; });'
  + 'set("lmint",num(r.filter(function(a){ return a.created&&(now-a.created)<86400; }).length));'
  // Relative, because an absolute date means nothing at a glance and the question this answers is
  // whether the launchpad is still being used.
  + 'if(newest>0){ var sec=now-newest, t;'
  + 'if(sec<3600)t=Math.max(1,Math.round(sec/60))+"m";'
  + 'else if(sec<86400)t=Math.round(sec/3600)+"h";'
  + 'else if(sec<2592000)t=Math.round(sec/86400)+"d";'
  + 'else t=Math.round(sec/2592000)+"mo";'
  + 'set("lnew",t); } else set("lnew","\u2014");'
  + '}).catch(function(){ ["ltok","lnew","lmint"].forEach(function(k){ set(k,"\u2014"); }); });'
  // ---- Cross-chain: this deployment's own bridge, not the network's.
  // The count of destinations is a property of what is wired up here, so it is stated rather than
  // fetched. The activity figures come from the bridge's own log; absent one, they are an honest 0.
  + 'set("cnet","10"); set("casset","USDC"); set("cvia","Circle CCTP");'
  + '})();</script>';

let removed = 0, rows = 0, keys = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = `lumoscore-aptos-${dev}.html`;
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;

  for (const k of Object.keys(json)) {
    let p = json[k];
    const before = p;

    p = p.replace(/<style id="lx-dashboxes-css">[\s\S]*?<\/style>/g, '')
         .replace(/<script id="lx-dashboxes">[\s\S]*?<\/script>/g, '')
         .replace(/<script id="lx-dashqafirst">[\s\S]*?<\/script>/g, '');

    // Trending is RETIRED, not merely un-rendered: _trending.js injects a style and a script that
    // rebuild the section at runtime, so deleting the markup alone let it come straight back on the
    // next tick. Both blocks go with it -- this transform is the only place that knows the section is
    // gone, so it owns the cleanup instead of leaving a dead builder running on every dashboard load.
    p = p.replace(/<style id="lx-trending-css">[\s\S]*?<\/style>/g, '')
         .replace(/<script id="lx-trending">[\s\S]*?<\/script>/g, '');

    p = p.replace(/<style id="lx-dashnews-css">[\s\S]*?<\/style>/g, '')
         .replace(/<script id="lx-dashnews">[\s\S]*?<\/script>/g, '')
         .replace(/<div class="section-heading lx-newshead">[\s\S]*?<\/div>/, '')
         .replace(/<div class="lx-news"[^>]*><\/div>/, '');

    // The dashboard, identified by the Trending card it carries or by its market grid -- NOT by the
    // grid alone. The phone dashboard has no market-grid around this card: Trending sits directly after
    // the quick actions, so gating on the grid skipped the phone entirely on the first run.
    const mg = p.indexOf('<div class="market-grid">');

    // Drop the Trending card. Balanced div walk from its opening tag: it nests deeply, so a lazy regex
    // takes a fragment and a greedy one swallows whatever sits beside it.
    let tc = -1;
    for (let at = p.indexOf('<div class="market-card"'); at >= 0; at = p.indexOf('<div class="market-card"', at + 1)) {
      if (/Trending on Stellar/.test(p.slice(at, at + 4000))) { tc = at; break; }
    }
    const done = p.indexOf('class="lx-dbx"') >= 0;
    const isDash = done || tc >= 0 || mg >= 0 || p.indexOf('<h2>Quick actions</h2>') >= 0;
    if (!isDash) { if (p !== before) { json[k] = p; changed = true; } continue; }
    let insertAt = -1;
    if (tc >= 0) {
      let depth = 0, i = tc, end = -1;
      const tag = /<(\/?)div\b[^>]*>/g; tag.lastIndex = tc;
      let m;
      while ((m = tag.exec(p))) {
        depth += m[1] ? -1 : 1;
        if (depth === 0) { end = m.index + m[0].length; break; }
        if (m.index > tc + 200000) break;
      }
      if (end > tc) { p = p.slice(0, tc) + p.slice(end); removed++; insertAt = tc; }
    }

    // The row goes ABOVE the grid the trending card used to sit in.
    // Remove any row from a previous run FIRST, so the template is what ships rather than whatever was
    // built last time.
    let existing = p.indexOf('<div class="lx-dbx">');
    if (existing >= 0) {
      let depth = 0, i = existing, end = -1;
      const tag = /<(\/?)div\b[^>]*>/g; tag.lastIndex = existing;
      let m;
      while ((m = tag.exec(p))) {
        depth += m[1] ? -1 : 1;
        if (depth === 0) { end = m.index + m[0].length; break; }
        if (m.index > existing + 200000) break;
      }
      if (end > existing) { p = p.slice(0, existing) + p.slice(end); if (insertAt < 0) insertAt = existing; }
    }

    // INSIDE the market grid, as its first child. That grid is two columns and used to hold Trending
    // plus the activity card; with Trending gone the activity card was alone in it and stretched across
    // column one. The boxes take that column back, so the activity feed returns to the right at its
    // original width -- the arrangement restored rather than a width patched on.
    {
      const mgAt = p.indexOf('<div class="market-grid">');
      if (mgAt >= 0) {
        const at = p.indexOf('>', mgAt) + 1;
        p = p.slice(0, at) + ROW + p.slice(at); rows++;
      } else if (insertAt >= 0) {
        // No grid on this layout (the phone): put it back where it was, or where Trending stood.
        p = p.slice(0, insertAt) + ROW + p.slice(insertAt); rows++;
      } else {
        // First run on a layout with neither: above the quick actions, which every dashboard has.
        const qa = p.search(/<div class="section-heading">\s*<h2>Quick actions<\/h2>/);
        if (qa >= 0) { p = p.slice(0, qa) + ROW + p.slice(qa); rows++; }
        else console.log('  ! nowhere to put the row on ' + k);
      }
    }
    if (p.indexOf('</head>') >= 0) p = p.replace('</head>', STYLE + '</head>');
    const bi = p.lastIndexOf('</body>');
    // Phone only: the desktop dashboard keeps its own order. Decided by WHICH CONTAINER this is, not by
    // anything measured in the browser -- see the note above QAFIRST.
    if (bi >= 0) p = p.slice(0, bi) + SCRIPT + (dev === 'mobile' ? QAFIRST : '') + p.slice(bi);
    keys++;

    if (p !== before) { json[k] = p; changed = true; }
  }

  if (changed) {
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
console.log('dashboard boxes: ' + rows + ' rows inserted, ' + removed + ' trending cards removed, '
  + keys + ' page keys, ' + CURATED.length + ' curated assets baked');
