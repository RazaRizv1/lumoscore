// #16: a news row on the dashboard, between the stats and Quick actions.
//
// Headlines come from /lxapi/news -- a Function, because none of these publishers send an
// access-control-allow-origin header on their feeds, so a browser cannot read them at all. See that file
// for the source list and how Stellar items are ranked to the front.
//
// The section REMOVES ITSELF if there is nothing to show. A heading with an empty rail under it looks
// like a fault, and a news row is the one part of a dashboard nobody misses if it is absent -- so a dead
// feed leaves the page exactly as it was rather than leaving evidence of itself.
//
// No "more" link, as asked: there is no news index on this site to send anyone to, and a link that goes
// nowhere useful is worse than no link.
//
// Idempotent: style and script blocks are replaced wholesale, and the rail is only inserted where one is
// not already present.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const STYLE = '<style id="lx-dashnews-css">'
  + '.lx-news{display:flex;flex-direction:row;flex-wrap:nowrap;gap:12px;overflow-x:auto;overflow-y:hidden;'
  + 'scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;padding-bottom:6px;margin-bottom:26px}'
  + '.lx-news::-webkit-scrollbar{height:6px}'
  + '.lx-news::-webkit-scrollbar-thumb{background:var(--border,#ececef);border-radius:99px}'
  + '.lx-news::-webkit-scrollbar-track{background:transparent}'
  + '.lx-newscard{flex:0 0 236px;scroll-snap-align:start;display:flex;flex-direction:column;gap:9px;'
  + 'text-decoration:none;color:inherit;min-width:0}'
  // 16:9 so a row of cards has one baseline whatever each publisher's art happens to be, and the image
  // is cropped to fill rather than letterboxed.
  + '.lx-newsimg{width:100%;aspect-ratio:16/9;border-radius:11px;overflow:hidden;background:var(--surface-2,#f4f5f7);'
  + 'background-size:cover;background-position:center;flex:0 0 auto}'
  + '.lx-newstitle{font:700 13.5px/1.35 "Hanken Grotesk",system-ui,sans-serif;color:var(--text,#0e0e10);'
  // Two lines, then an ellipsis. A headline that wraps to four makes every card in the row a different
  // height, and the row stops reading as a row.
  + 'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}'
  + '.lx-newsmeta{font:600 11px/1 "JetBrains Mono",ui-monospace,monospace;color:var(--text-soft,#8a8fa3);'
  + 'letter-spacing:.02em;display:flex;align-items:center;gap:6px}'
  + '.lx-newsdot{width:3px;height:3px;border-radius:50%;background:currentColor;flex:0 0 3px;opacity:.65}'
  + '.lx-newscard:hover .lx-newstitle{color:var(--accent,#ea6a2c)}'
  + '@media(max-width:760px){.lx-newscard{flex:0 0 76%;max-width:280px}}'
  + '</style>';

const SCRIPT = '<script id="lx-dashnews">(function(){'
  + 'var rail=document.querySelector(".lx-news"); if(!rail)return;'
  + 'function esc(s){return (String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")).split(String.fromCharCode(39)).join("&#39;");}'
  // Same shortening the trade feed uses, so two parts of the app do not describe the same age differently.
  + 'function ago(ts){var s=Math.max(0,(Date.now()-ts)/1000);'
  + 'if(s<3600)return Math.max(1,Math.floor(s/60))+"m";'
  + 'if(s<86400)return Math.floor(s/3600)+"h";'
  + 'return Math.floor(s/86400)+"d";}'
  + 'function drop(){ try{ var h=rail.previousElementSibling;'
  + 'if(h&&h.classList&&h.classList.contains("lx-newshead"))h.parentNode.removeChild(h);'
  + 'rail.parentNode.removeChild(rail); }catch(_){} }'
  + 'fetch("/lxapi/news?limit=12").then(function(r){return r.ok?r.json():null;}).then(function(d){'
  + 'var items=(d&&d.items)||[]; if(!items.length){drop();return;}'
  + 'rail.innerHTML=items.map(function(n){'
  + 'var img=n.img?(\' style="background-image:url(&quot;\'+esc(n.img)+\'&quot;)"\'):"";'
  + 'return \'<a class="lx-newscard" href="\'+esc(n.link)+\'" target="_blank" rel="noopener">\''
  + '+\'<div class="lx-newsimg"\'+img+\'></div>\''
  + '+\'<div class="lx-newstitle">\'+esc(n.title)+\'</div>\''
  + '+\'<div class="lx-newsmeta"><span>\'+esc(n.source)+\'</span>\''
  + '+(n.ts?(\'<span class="lx-newsdot"></span><span>\'+esc(ago(n.ts))+\'</span>\'):"")'
  + '+\'</div></a>\';}).join("");'
  + '}).catch(function(){drop();});'
  + '})();</script>';

const HEAD = '<div class="section-heading lx-newshead"><h2>XLM News</h2></div>';
const RAIL = '<div class="lx-news" aria-label="Crypto headlines"></div>';

let keys = 0, rails = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = `lumoscore-aptos-${dev}.html`;
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;

  for (const k of Object.keys(json)) {
    let p = json[k];
    const before = p;
    p = p.replace(/<style id="lx-dashnews-css">[\s\S]*?<\/style>/g, '')
         .replace(/<script id="lx-dashnews">[\s\S]*?<\/script>/g, '');

    // The dashboard, identified by its own Quick actions heading rather than by a filename.
    const qa = p.indexOf('<div class="section-heading">\n        <h2>Quick actions</h2>');
    const qaLoose = qa >= 0 ? qa : p.search(/<div class="section-heading">\s*<h2>Quick actions<\/h2>/);
    if (qaLoose >= 0) {
      if (p.indexOf('class="lx-news"') < 0) {
        p = p.slice(0, qaLoose) + HEAD + RAIL + p.slice(qaLoose);
        rails++;
      }
      if (p.indexOf('</head>') >= 0) p = p.replace('</head>', STYLE + '</head>');
      const bi = p.lastIndexOf('</body>');
      if (bi >= 0) p = p.slice(0, bi) + SCRIPT + p.slice(bi);
      keys++;
    }

    if (p !== before) { json[k] = p; changed = true; }
  }

  if (changed) {
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
console.log('dashboard news: ' + rails + ' rails inserted, wired on ' + keys + ' page keys');
