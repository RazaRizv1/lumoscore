// Dashboard: a Blog section BELOW the Live Platform Activity feed. Both exist; neither replaces the other.
//
// An earlier version of this transform swapped the activity feed out for the blog. That was reverted on
// request, and reverting it is why this file also RESTORES the activity card: the containers are
// gitignored, so a git revert would have brought dist back without them and the next rebuild would have
// dropped the feed again. The markup below is the original, recovered from the tracked dist/ at the
// commit before the swap -- note the two devices genuinely differ (desktop carries "— Stellar", mobile
// does not, and they sit at different depths).
//
// THE POSTS ARE PLACEHOLDERS, AND THE SECTION SAYS SO. There is no blog to read yet -- the footer's
// "Blogs" link is still href="#" and /blog 404s -- so it ships with stand-in rows, a "Coming soon" tag,
// and nothing clickable. The rows keep a link's hover, as asked, but no href and no pointer cursor.
//
// The titles are neutral subjects, not announcements, and there are no dates. A placeholder reading
// "LumosCore launches X" would be taken as fact by anyone who saw it, on a live product handling real
// funds, and an invented timestamp is an invented fact. When the real feed exists, replace POSTS with
// what it returns and drop the tag; the markup and CSS do not need to change.
//
// Covers are inline gradients rather than image files: nothing to host, nothing to cache-bust, and they
// follow the theme instead of carrying a baked background into light mode.
//
// Idempotent: the style block and the blog card are stripped and re-added on every run, and the activity
// card is only re-inserted when it is actually missing.
//
// Usage: node _tools/_dashblogs.js
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// Recovered verbatim from dist/ at the commit before the swap, per device.
const ACTIVITY = {
  desktop: '<div class="activity-card" data-lxnonav="1">\n          <div class="market-head">\n'
    + '            <h3><span class="live-pulse"></span>Live Platform Activity — Stellar</h3>\n'
    + '          </div>\n          <div class="activity-scroll" id="activityList"></div>\n        </div>',
  mobile: '<div class="activity-card" data-lxnonav="1">\n      <div class="market-head">\n'
    + '        <h3><span class="live-pulse"></span>Live Platform Activity</h3>\n'
    + '      </div>\n      <div class="activity-scroll" id="activityList"></div>\n    </div>',
};
// Where the card belongs, if it has to go back in: immediately after the design's own marker comment.
const ANCHOR = { desktop: '<!-- Live activity -->', mobile: '<!-- ===== Live Activity ===== -->' };

// [title, tag, gradient from, gradient to, posted]. The dates are placeholders like the rest of the row
// and will come from the feed's own timestamps once there is one.
const POSTS = [
  ['How liquidity pools work on Stellar', 'Explainer', '#a855f7', '#6d28d9', '2 days ago'],
  ['Understanding trustlines and why assets need them', 'Guide', '#38bdf8', '#2563eb', '5 days ago'],
  ['Bridging USDC across chains with Circle CCTP', 'Explainer', '#2dd4bf', '#0d9488', '1w ago'],
  ['Path payments, and how a swap actually settles', 'Guide', '#f7b733', '#ea6a2c', '3w ago'],
  ['Issuing a token on Stellar, start to finish', 'Walkthrough', '#f472b6', '#be185d', '1mo ago'],
];

const STYLE = '<style id="lx-dashblogs-css">/*lxts:1.1*/'
  + '.lx-blogs-card{background:var(--surface,#fff);border:1px solid var(--border,#ececef);'
  + 'border-radius:14px;padding:15px 16px;min-width:0;display:flex;flex-direction:column;gap:12px;'
  + 'margin-top:16px}'
  + '.lx-blogs-head{display:flex;align-items:center;gap:9px;min-width:0}'
  // Not a link either, for the same reason the rows are not -- there is nowhere to go yet.
  + '.lx-blogs-more{margin-left:auto;display:inline-flex;align-items:center;gap:5px;cursor:default;'
  + 'font:700 13px/1 "Hanken Grotesk",system-ui,sans-serif;color:var(--accent,#ea6a2c);white-space:nowrap}'
  + '.lx-blogs-more svg{width:12px;height:12px}'
  // The activity feed sat taller than the product-card stack beside it, so the two columns ended at
  // different depths. Letting the feed shrink below its content height hands the row height to the
  // stack, and the scroll area then takes whatever is left -- so both columns end level.
  + '@media(min-width:1000px){'
  + '.market-grid>.activity-card{display:flex;flex-direction:column;min-height:0}'
  + '.market-grid>.activity-card .activity-scroll{flex:1 1 0;min-height:0;max-height:none;overflow-y:auto}'
  + '}'
  + '.lx-blogs-head h3{margin:0;font:800 15px/1.1 "Hanken Grotesk",system-ui,sans-serif;'
  + 'color:var(--text,#0e0e10);letter-spacing:-.015em}'
  // The tag is the honest part of this section: it says the rows are not real posts yet.
  + '.lx-blog-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit}'
  + '.lx-blog-empty{padding:26px 4px;color:var(--text-muted,#8a8fa3);font-size:13.5px}'
  + 'a.lx-blog-row{text-decoration:none;color:inherit}'
  + '.lx-blogs-soon{font:700 10px/1 "Hanken Grotesk",system-ui,sans-serif;text-transform:uppercase;'
  + 'letter-spacing:.06em;color:var(--text-muted,#8a8fa3);border:1px solid var(--border,#ececef);'
  + 'border-radius:999px;padding:4px 8px;white-space:nowrap}'
  // Phone and tablet: one swipeable row. The cards bleed to the card's edges rather than stopping at its
  // padding, so the row reads as continuing off-screen instead of ending in a margin.
  + '.lx-blogs-list{display:grid;grid-auto-flow:column;grid-auto-columns:62%;gap:12px;min-width:0;'
  + 'overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x proximity;'
  + 'margin:0 -16px;padding:0 16px 2px;scrollbar-width:none;-ms-overflow-style:none}'
  + '.lx-blogs-list::-webkit-scrollbar{display:none}'
  + '.lx-blog-row{scroll-snap-align:start}'
  // Desktop: back to five fixed columns, and every scroller property reset -- leaving grid-auto-flow or
  // the negative margin behind would quietly reshape the row that works.
  + '@media(min-width:1000px){.lx-blogs-list{grid-auto-flow:row;grid-auto-columns:auto;'
  + 'grid-template-columns:repeat(5,minmax(0,1fr));gap:14px;overflow-x:visible;'
  + 'scroll-snap-type:none;margin:0;padding:0}}'
  // Not a link: no href, and the cursor does not promise one. It keeps a link's hover so the section
  // reads as the list of posts it will become.
  + '.lx-blog-row{display:flex;flex-direction:column;align-items:stretch;gap:10px;min-width:0;'
  + 'border-radius:12px;cursor:default}'
  + '.lx-blog-row:hover .lx-blog-cover{transform:translateY(-2px);'
  + 'box-shadow:0 8px 18px -10px rgba(0,0,0,.55)}'
  + '.lx-blog-row:hover .lx-blog-title{color:var(--accent,#ea6a2c)}'
  + '@media(prefers-reduced-motion:reduce){.lx-blog-row{transition:none}}'
  // A real cover shape rather than a thumbnail: full width of its column, 16:10.
  + '.lx-blog-cover{width:100%;aspect-ratio:16/9;border-radius:12px;'
  + 'background:linear-gradient(135deg,var(--c1) 0%,var(--c2) 100%);position:relative;overflow:hidden;'
  + 'transition:transform .16s ease,box-shadow .16s ease}'
  + '@media(prefers-reduced-motion:reduce){.lx-blog-cover{transition:none}}'
  + '@media(min-width:1000px){.lx-blog-cover{aspect-ratio:16/10}}'
  + '.lx-blog-cover::after{content:"";position:absolute;inset:0;'
  + 'background:linear-gradient(180deg,rgba(255,255,255,.20),rgba(255,255,255,0) 55%)}'
  + '.lx-blog-meta{min-width:0;display:flex;flex-direction:column;gap:5px}'
  + '.lx-blog-title{font:700 15px/1.35 "Hanken Grotesk",system-ui,sans-serif;color:var(--text,#0e0e10);'
  + 'transition:color .15s ease;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;'
  + 'overflow:hidden}'
  + '.lx-blog-sub{display:flex;align-items:center;gap:7px;min-width:0}'
  + '.lx-blog-tag,.lx-blog-when{font:600 11px/1 "Hanken Grotesk",system-ui,sans-serif;'
  + 'color:var(--text-muted,#8a8fa3);white-space:nowrap}'
  + '.lx-blog-dot{width:3px;height:3px;border-radius:50%;background:var(--text-muted,#8a8fa3);'
  + 'opacity:.6;flex:0 0 auto}'
  // The tag rides on the cover, where it reads as part of the artwork rather than a third line of text.
  + '.lx-blog-chip{position:absolute;left:8px;bottom:8px;z-index:1;'
  + 'font:700 9.5px/1 "Hanken Grotesk",system-ui,sans-serif;text-transform:uppercase;letter-spacing:.07em;'
  + 'color:#fff;background:rgba(0,0,0,.30);border:1px solid rgba(255,255,255,.22);'
  + 'border-radius:999px;padding:4px 7px;backdrop-filter:blur(3px)}'
  + '</style>';

function esc(s) {
  return String(s).split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;');
}

const DATA_SCRIPT = "<script id=\"lx-dashblogdata\">(function(){\nif(window.__lxDashBlog)return; window.__lxDashBlog=1;\nfunction esc(s){return String(s==null?\"\":s).replace(/[<>&\"]/g,function(c){return c===\"<\"?\"&lt;\":c===\">\"?\"&gt;\":c===\"&\"?\"&amp;\":\"&quot;\";});}\nfunction when(t){ if(!t)return \"\";\n  var d=Date.now()-t, day=86400000;\n  if(d<day)return \"today\";\n  if(d<2*day)return \"yesterday\";\n  if(d<7*day)return Math.floor(d/day)+\" days ago\";\n  if(d<30*day)return Math.floor(d/(7*day))+\"w ago\";\n  if(d<365*day)return Math.floor(d/(30*day))+\"mo ago\";\n  return new Date(t).toLocaleDateString(); }\n\nfunction paint(posts){\n  var card=document.querySelector(\".lx-blogs-card\"); if(!card)return;\n  var list=card.querySelector(\".lx-blogs-list\"); if(!list)return;\n  var soon=card.querySelector(\".lx-blogs-soon\");\n\n  if(!posts.length){\n    // No posts is a real state and says so. Falling back to the stand-in rows would put invented\n    // article titles on the dashboard, which is worse than an empty card.\n    if(soon)soon.remove();\n    list.innerHTML=\"<div class='lx-blog-empty'>No posts yet.</div>\";\n    return;\n  }\n  if(soon)soon.remove();\n  list.innerHTML=posts.slice(0,5).map(function(p){\n    var cover=p.cover\n      ? (\"<img class='lx-blog-img' alt='' src='\"+esc(p.cover)+\"'>\")\n      : \"\";\n    return \"<a class='lx-blog-row' href='/blog/\"+esc(p.slug)+\"'>\"\n      +\"<div class='lx-blog-cover' style='--c1:#a855f7;--c2:#6d28d9'>\"+cover\n      +(p.category?(\"<span class='lx-blog-chip' data-lxc=''>\"+esc(p.category)+\"</span>\"):\"\")+\"</div>\"\n      +\"<div class='lx-blog-meta'>\"\n      +\"<div class='lx-blog-title'>\"+esc(p.title)+\"</div>\"\n      +\"<div class='lx-blog-sub'><span class='lx-blog-when'>\"+esc(when(p.publishedAt||p.createdAt))+\"</span></div>\"\n      +\"</div></a>\";\n  }).join(\"\");\n}\n\nfunction boot(){\n  if(!document.querySelector(\".lx-blogs-card\"))return;\n  fetch(\"/lxapi/blog\").then(function(r){ return r.ok?r.json():null; })\n    .then(function(d){ if(d&&d.posts)paint(d.posts); })\n    .catch(function(){});\n  // The card's own header link goes to the blog index. It was inert while there was nothing to link to.\n  var more=document.querySelector(\".lx-blogs-more\");\n  if(more&&!more.__lx){ more.__lx=1; more.style.cursor=\"pointer\";\n    more.addEventListener(\"click\",function(){ location.href=\"/blog\"; }); }\n}\nif(document.readyState!==\"loading\")boot(); else document.addEventListener(\"DOMContentLoaded\",boot);\n})();</script>";

const CARD = '<div class="lx-blogs-card" data-lxnonav="1">'
  + '<div class="lx-blogs-head"><h3>Blog</h3><span class="lx-blogs-soon">Coming soon</span>'
  + '<span class="lx-blogs-more">View more'
  + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>'
  + '</span></div>'
  + '<div class="lx-blogs-list">'
  + POSTS.map(function (p) {
    return '<article class="lx-blog-row">'
      + '<div class="lx-blog-cover" style="--c1:' + p[2] + ';--c2:' + p[3] + '">'
      + '<span class="lx-blog-chip">' + esc(p[1]) + '</span></div>'
      + '<div class="lx-blog-meta">'
      + '<div class="lx-blog-title">' + esc(p[0]) + '</div>'
      + '<div class="lx-blog-sub"><span class="lx-blog-when">' + esc(p[4]) + '</span></div>'
      + '</div></article>';
  }).join('')
  + '</div></div>';

// End index of a balanced <div ...> ... </div> that starts at `from`, so nested divs do not end it early.
function balancedDiv(html, from) {
  let i = html.indexOf('>', from);
  if (i < 0) return -1;
  let depth = 1;
  i++;
  while (i < html.length && depth > 0) {
    const o = html.indexOf('<div', i), c = html.indexOf('</div>', i);
    if (c < 0) return -1;
    if (o >= 0 && o < c) { depth++; i = o + 4; } else { depth--; i = c + 6; }
  }
  return depth === 0 ? i : -1;
}

let files = 0, keys = 0, restored = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = 'lumoscore-aptos-' + dev + '.html';
  let data; try { data = read(file); } catch (e) { continue; }
  let json, s, e; try { ({ json, s, e } = getContents(data)); } catch (err) { continue; }

  let changed = false;
  for (const k of Object.keys(json)) {
    let p = json[k];
    if (typeof p !== 'string') continue;
    if (p.indexOf('status-row') < 0) continue;                       // dashboard only
    if (p.indexOf(ANCHOR[dev]) < 0) continue;

    const before = p;
    p = p.replace(/<style id="lx-dashblogs-css">[\s\S]*?<\/style>/g, '');

    // 1. drop our own card wherever it is, so a re-run cannot stack a second one
    let b = p.indexOf('<div class="lx-blogs-card"');
    while (b >= 0) {
      const bEnd = balancedDiv(p, b);
      if (bEnd < 0) break;
      p = p.slice(0, b) + p.slice(bEnd);
      b = p.indexOf('<div class="lx-blogs-card"');
    }

    // 2. put the activity feed back if it is missing
    let a = p.indexOf('<div class="activity-card"');
    if (a < 0) {
      const an = p.indexOf(ANCHOR[dev]);
      const ins = an + ANCHOR[dev].length;
      p = p.slice(0, ins) + '\n        ' + ACTIVITY[dev] + p.slice(ins);
      a = p.indexOf('<div class="activity-card"');
      restored++;
    }

    // 3. blog goes BELOW it. On desktop the feed sits inside a grid, so step past that grid's close;
    //    on mobile it is a direct child of <main> and the card follows it straight away.
    let at = balancedDiv(p, a);
    if (at < 0) { console.error('  ' + file + ' / ' + k + ': activity card not balanced — skipped'); continue; }
    const after = p.slice(at, at + 40);
    const m = after.match(/^\s*<\/div>/);
    if (m) at += m[0].length;
    p = p.slice(0, at) + '\n\n        ' + CARD + p.slice(at);

    const hi = p.indexOf('</head>');
    if (hi < 0) continue;
    p = p.slice(0, hi) + STYLE + p.slice(hi);
    if (p.indexOf("lx-dashblogdata") < 0) {
      const bi = p.lastIndexOf("</body>");
      if (bi >= 0) p = p.slice(0, bi) + DATA_SCRIPT + p.slice(bi);
    }

    if (p !== before) { json[k] = p; changed = true; keys++; }
  }
  if (changed) {
    files++;
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
console.log('blog section below the activity feed on ' + keys + ' page key(s), ' + files
  + ' container(s); activity card restored on ' + restored);
