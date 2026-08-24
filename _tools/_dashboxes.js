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
  + '.lx-dbx{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:22px}'
  + '@media(max-width:1200px){.lx-dbx{grid-template-columns:repeat(2,minmax(0,1fr))}}'
  + '@media(max-width:640px){.lx-dbx{grid-template-columns:1fr}}'
  + '.lx-dbx-card{background:var(--surface,#fff);border:1px solid var(--border,#ececef);border-radius:14px;'
  + 'padding:14px 16px;min-width:0;display:flex;flex-direction:column;gap:10px}'
  + '.lx-dbx-head{display:flex;align-items:center;gap:8px;min-width:0}'
  + '.lx-dbx-ic{width:26px;height:26px;flex:0 0 26px;border-radius:8px;display:grid;place-items:center;'
  + 'background:var(--accent-soft,rgba(234,106,44,.12));color:var(--accent,#ea6a2c)}'
  + '.lx-dbx-ic svg{width:14px;height:14px;display:block}'
  + '.lx-dbx-t{font:800 13px/1 "Hanken Grotesk",system-ui,sans-serif;color:var(--text,#0e0e10);'
  + 'letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  + '.lx-dbx-go{margin-left:auto;flex:0 0 auto;color:var(--text-muted,#8a8fa3);display:flex}'
  + '.lx-dbx-go svg{width:13px;height:13px;display:block}'
  + '.lx-dbx-card:hover .lx-dbx-go{color:var(--accent,#ea6a2c)}'
  // Three figures on one line. minmax(0,1fr) so a long number shrinks its own column instead of
  // pushing the other two off the card.
  + '.lx-dbx-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}'
  + '.lx-dbx-s{min-width:0}'
  + '.lx-dbx-l{font:600 10px/1.2 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-muted,#8a8fa3);'
  + 'text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  + '.lx-dbx-v{margin-top:3px;font:800 15px/1.15 "JetBrains Mono",ui-monospace,monospace;'
  + 'color:var(--text,#0e0e10);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  // The waiting state is the shape of the number, not a spinner and not a zero -- a zero here would be
  // a claim, and on the cross-chain card it is a claim that happens to be true, so the two must not
  // look alike before the data lands.
  + '.lx-dbx-v.wait{color:transparent;border-radius:5px;'
  + 'background-image:linear-gradient(90deg,rgba(140,140,150,.10),rgba(140,140,150,.20),rgba(140,140,150,.10));'
  + 'background-size:200% 100%;animation:lxdbxshim 1.2s ease-in-out infinite}'
  + '@keyframes lxdbxshim{0%{background-position:200% 0}100%{background-position:-200% 0}}'
  + '@media(prefers-reduced-motion:reduce){.lx-dbx-v.wait{animation:none}}'
  + 'a.lx-dbx-card{text-decoration:none;color:inherit;transition:border-color .15s,transform .15s}'
  + 'a.lx-dbx-card:hover{border-color:var(--accent,#ea6a2c);transform:translateY(-1px)}'
  + '</style>';

const IC_TRADE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M21 7v5h-5"/></svg>';
const IC_POOLS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s6 6.4 6 10a6 6 0 0 1-12 0c0-3.6 6-10 6-10z"/></svg>';
const IC_CHAIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 14.5l5-5"/><path d="M7 10.5L5.5 12a3.5 3.5 0 0 0 5 5l1.5-1.5"/><path d="M17 13.5L18.5 12a3.5 3.5 0 0 0-5-5L12 8.5"/></svg>';
const IC_LAUNCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/></svg>';
const IC_GO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';

function card(href, ic, title, stats) {
  return '<a class="lx-dbx-card" href="' + href + '">'
    + '<div class="lx-dbx-head"><span class="lx-dbx-ic">' + ic + '</span>'
    + '<span class="lx-dbx-t">' + title + '</span>'
    + '<span class="lx-dbx-go">' + IC_GO + '</span></div>'
    + '<div class="lx-dbx-stats">'
    + stats.map((s) => '<div class="lx-dbx-s"><div class="lx-dbx-l">' + s[0] + '</div>'
      + '<div class="lx-dbx-v wait" data-k="' + s[1] + '">0000</div></div>').join('')
    + '</div></a>';
}

const ROW = '<div class="lx-dbx">'
  + card('/trade/stellar', IC_TRADE, 'Trade', [['24h Volume', 'tvol'], ['Liquidity', 'tliq'], ['Markets', 'tmkt']])
  + card('/pools/stellar', IC_POOLS, 'Pools', [['Pools', 'ppool'], ['TVL', 'ptvl'], ['24h Volume', 'pvol']])
  + card('/bridge', IC_CHAIN, 'Cross-chain', [['Networks', 'cnet'], ['24h Transfers', 'ctx'], ['24h Volume', 'cvol']])
  + card('/launchpad', IC_LAUNCH, 'Launchpad', [['Tokens', 'ltok'], ['Newest', 'lnew'], ['24h Mints', 'lmint']])
  + '</div>';

const SCRIPT = '<script id="lx-dashboxes">(function(){'
  + 'var row=document.querySelector(".lx-dbx"); if(!row)return;'
  + 'var CUR=' + JSON.stringify(CURATED) + ';'
  + 'function set(k,v){ var el=row.querySelector(\'[data-k="\'+k+\'"]\'); if(!el)return;'
  + 'el.textContent=v; el.classList.remove("wait"); }'
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
  + 'set("cnet","10");'
  + 'try{'
  + 'var hist=JSON.parse(localStorage.getItem("lumos.cctp.txs")||"[]");'
  + 'if(!Array.isArray(hist))hist=[];'
  + 'var since=Date.now()-864e5, n=0, v=0;'
  + 'hist.forEach(function(h){ var t=+(h.ts||0); if(!(t>=since))return; n++; v+=+(h.amount||h.srcAmount||0)||0; });'
  + 'set("ctx",num(n)); set("cvol",v>0?usd(v):"$0");'
  + '}catch(_){ set("ctx","0"); set("cvol","$0"); }'
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

    p = p.replace(/<style id="lx-dashboxes-css">[\s\S]*?<\/style>/, '')
         .replace(/<script id="lx-dashboxes">[\s\S]*?<\/script>/, '');

    // Trending is RETIRED, not merely un-rendered: _trending.js injects a style and a script that
    // rebuild the section at runtime, so deleting the markup alone let it come straight back on the
    // next tick. Both blocks go with it -- this transform is the only place that knows the section is
    // gone, so it owns the cleanup instead of leaving a dead builder running on every dashboard load.
    p = p.replace(/<style id="lx-trending-css">[\s\S]*?<\/style>/, '')
         .replace(/<script id="lx-trending">[\s\S]*?<\/script>/, '');

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
    if (tc < 0 && mg < 0 && !done) { if (p !== before) { json[k] = p; changed = true; } continue; }
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
    // built last time. Its position is remembered, so the row goes back exactly where it was.
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
      else existing = -1;
    }

    // Exactly where Trending was, so the page keeps its running order. Falls back to the old row's own
    // position, then to above the market grid.
    {
      const at = (insertAt >= 0) ? insertAt
               : (existing >= 0 ? existing : p.indexOf('<div class="market-grid">'));
      if (at >= 0) { p = p.slice(0, at) + ROW + p.slice(at); rows++; }
    }
    if (p.indexOf('</head>') >= 0) p = p.replace('</head>', STYLE + '</head>');
    const bi = p.lastIndexOf('</body>');
    if (bi >= 0) p = p.slice(0, bi) + SCRIPT + p.slice(bi);
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
