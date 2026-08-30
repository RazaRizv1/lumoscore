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
  // "— Stellar" on the phone too. It was the one layout naming no chain, on the one layout with no
  // other clue which chain it is showing. Kept identical to desktop so both share the i18n key.
  mobile: '<div class="activity-card" data-lxnonav="1">\n      <div class="market-head">\n'
    + '        <h3><span class="live-pulse"></span>Live Platform Activity — Stellar</h3>\n'
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
  + '.lx-blog-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;z-index:2}'
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
  + '@media(min-width:1000px){'
  + '.lx-blogs-list{grid-auto-flow:column;gap:14px;margin:0;padding:0;overflow-x:auto;'
  + 'scroll-snap-type:x mandatory;scroll-behavior:smooth}'
  + '.lx-blogs-list[data-n="1"]{grid-auto-columns:100%}'
  + '.lx-blogs-list[data-n="2"]{grid-auto-columns:calc((100% - 14px)/2)}'
  + '.lx-blogs-list:not([data-n="1"]):not([data-n="2"]){grid-auto-columns:calc((100% - 28px)/3)}'
  + '}'
  + '@media(min-width:1000px) and (prefers-reduced-motion:reduce){'
  + '.lx-blogs-list{scroll-behavior:auto}}'
  // Not a link: no href, and the cursor does not promise one. It keeps a link's hover so the section
  // reads as the list of posts it will become.
  + '.lx-blog-row{display:flex;flex-direction:column;align-items:stretch;gap:10px;min-width:0;'
  + 'border-radius:12px;cursor:pointer}'
  + '.lx-blog-row:hover .lx-blog-cover{transform:translateY(-2px);'
  + 'box-shadow:0 8px 18px -10px rgba(0,0,0,.55)}'
  + '.lx-blog-row:hover .lx-blog-title{color:var(--accent,#ea6a2c)}'
  + '@media(prefers-reduced-motion:reduce){.lx-blog-row{transition:none}}'
  // A real cover shape rather than a thumbnail: full width of its column, 16:10.
  + '.lx-blog-cover{width:100%;aspect-ratio:16/9;border-radius:12px;'
  + 'background:rgba(127,127,140,.10);position:relative;overflow:hidden;'
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
  + '.lx-blog-chip{position:absolute;left:8px;bottom:8px;z-index:3;'
  + 'font:700 9.5px/1 "Hanken Grotesk",system-ui,sans-serif;text-transform:uppercase;letter-spacing:.07em;'
  + 'color:#fff;background:rgba(0,0,0,.30);border:1px solid rgba(255,255,255,.22);'
  + 'border-radius:999px;padding:4px 7px;backdrop-filter:blur(3px)}'
  + '.lx-blogs-list[data-n="1"]{grid-auto-columns:100%}'
  + '@media(min-width:1000px){'
  + '.lx-blogs-list[data-n="1"] .lx-blog-row,.lx-blogs-list[data-n="2"] .lx-blog-row'
  + '{flex-direction:row;align-items:center;gap:18px}'
  + '.lx-blogs-list[data-n="1"] .lx-blog-cover,.lx-blogs-list[data-n="2"] .lx-blog-cover{width:auto}'
  + '.lx-blogs-list[data-n="1"] .lx-blog-cover{flex:0 0 clamp(240px,32%,380px)}'
  + '.lx-blogs-list[data-n="2"] .lx-blog-cover{flex:0 0 clamp(150px,36%,210px)}'
  + '.lx-blogs-list[data-n="1"] .lx-blog-row{padding:14px;border-radius:16px;'
  + 'background:var(--lx-blog-feature,rgba(127,127,140,.07))}'
  + '.lx-blogs-list[data-n="1"] .lx-blog-title{font-size:19px;-webkit-line-clamp:3}'
  + '.lx-blogs-list[data-n="1"] .lx-blog-meta,.lx-blogs-list[data-n="2"] .lx-blog-meta'
  + '{flex:1 1 auto;min-width:0}'
  + '.lx-blogs-list[data-n="1"] .lx-blog-meta{gap:9px}'
  + '}'
  + '.lx-blog-read{display:inline-flex;align-items:center;gap:5px;margin-top:2px;'
  + 'font:700 12.5px/1 "Hanken Grotesk",system-ui,sans-serif;color:var(--accent,#ea6a2c)}'
  + '.lx-blog-read svg{width:11px;height:11px;transition:transform .16s ease}'
  + '.lx-blog-row:hover .lx-blog-read svg{transform:translateX(3px)}'
  + '@media(prefers-reduced-motion:reduce){.lx-blog-read svg{transition:none}}'
  + '.lx-blogs-nav{margin-left:auto;display:inline-flex;align-items:center;gap:6px}'
  + '.lx-blogs-nav+.lx-blogs-more{margin-left:12px}'
  + '.lx-blogs-arrow{width:26px;height:26px;padding:0;border-radius:50%;display:inline-flex;'
  + 'align-items:center;justify-content:center;background:transparent;'
  + 'border:1px solid var(--border,#ececef);color:var(--text-muted,#8a8fa3);cursor:pointer;'
  + 'transition:color .15s ease,border-color .15s ease,opacity .15s ease}'
  + '.lx-blogs-arrow:hover:not(:disabled){color:var(--accent,#ea6a2c);border-color:var(--accent,#ea6a2c)}'
  + '.lx-blogs-arrow:disabled{opacity:.32;cursor:default}'
  + '.lx-blogs-arrow svg{width:12px;height:12px}'
  + '@media(max-width:999px){.lx-blogs-nav{display:none!important}}'
  + '@media(prefers-reduced-motion:reduce){.lx-blogs-arrow{transition:none}}'
  // ---- 3-up card grid ---------------------------------------------------------------------------
  // The wrapper stops being a panel. Quick actions is a heading over cards, and two different
  // container idioms stacked on one screen is most of why this section read as bolted on.
  + '.lx-blogs-card{background:transparent;border:0;border-radius:0;padding:0;margin-top:30px;gap:14px}'
  + '.lx-blogs-head{gap:12px;margin-bottom:2px}'
  + '.lx-blogs-head h3{font-size:29.7px;line-height:1.15;letter-spacing:-.02em}'
  + '.lx-blogs-more{font-size:14px;cursor:pointer}'
  + '.lx-blogs-more:hover{text-decoration:underline}'
  + '.lx-blogs-list{display:flex;grid-auto-flow:row;gap:15.4px;margin:0;padding:2px;'
  + 'overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth}'
  + '.lx-blog-row{flex:0 0 calc((100% - 30.8px)/3);min-width:0;scroll-snap-align:start;'
  + 'background:var(--surface,#131317);border:.8px solid var(--border,#26262c);border-radius:14px;'
  + 'overflow:hidden;display:flex;flex-direction:column;'
  + 'gap:0;align-items:stretch;padding:0;'
  + 'transition:border-color .16s ease,transform .16s ease}'
  + '.lx-blog-row:hover{border-color:var(--accent,#ea6a2c);transform:translateY(-2px)}'
  + '.lx-blogs-list[data-n=\"1\"] .lx-blog-row,.lx-blogs-list[data-n=\"2\"] .lx-blog-row{'
  + 'flex-basis:calc((100% - 30.8px)/3);flex-direction:column;align-items:stretch;'
  + 'gap:0;padding:0;border-radius:14px;background:var(--surface,#131317)}'
  + '.lx-blogs-list[data-n=\"1\"] .lx-blog-cover,.lx-blogs-list[data-n=\"2\"] .lx-blog-cover{'
  + 'width:auto;aspect-ratio:16/9;flex:0 0 auto}'
  + '.lx-blogs-list[data-n=\"1\"] .lx-blog-title{font-size:16.5px;-webkit-line-clamp:2}'
  + '.lx-blog-cover{position:relative;aspect-ratio:16/9;width:auto;height:auto;flex:0 0 auto;'
  + 'background:var(--surface-2,#1a1a1f);border-radius:0}'
  + '.lx-blog-chip{position:absolute;left:10px;bottom:10px;z-index:3;'
  + 'background:rgba(10,10,11,.72);backdrop-filter:blur(6px);color:var(--text,#f6f5f3);'
  + 'padding:4px 9px;border-radius:999px;font:700 10px/1 \"Hanken Grotesk\",system-ui,sans-serif;'
  + 'text-transform:uppercase;letter-spacing:.07em}'
  + '.lx-blog-meta{padding:15px 16px 16px;display:flex;flex-direction:column;gap:9px;flex:1 1 auto;min-width:0}'
  + '.lx-blog-title{font:800 16.5px/1.32 \"Hanken Grotesk\",system-ui,sans-serif;'
  + 'color:var(--text,#f6f5f3);letter-spacing:-.015em;display:-webkit-box;-webkit-line-clamp:2;'
  + '-webkit-box-orient:vertical;overflow:hidden;min-height:2.64em}'
  + '.lx-blog-sub{margin-top:auto;display:flex;align-items:center;gap:7px;'
  + 'font:600 12.5px/1 \"Hanken Grotesk\",system-ui,sans-serif;color:var(--text-soft,#8b8b97)}'
  + '.lx-blog-dot{width:3px;height:3px;border-radius:50%;background:currentColor;opacity:.55}'
  + '.lx-blog-read{display:none}'
  + '@media(max-width:999px){.lx-blogs-card{margin-top:22px}'
  + '.lx-blogs-head h3{font-size:21px}'
  + '.lx-blogs-list{margin:0 -16px;padding:2px 16px}'
  + '.lx-blog-row,.lx-blogs-list[data-n=\"1\"] .lx-blog-row,.lx-blogs-list[data-n=\"2\"] .lx-blog-row{'
  + 'flex-basis:78%}}'
  + '</style>';

function esc(s) {
  return String(s).split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;');
}

const DATA_SCRIPT = "<script id=\"lx-dashblogdata\">(function(){\nif(window.__lxDashBlog)return; window.__lxDashBlog=1;\nvar MAX=10;\nfunction esc(s){return String(s==null?\"\":s).replace(/[<>&\"]/g,function(c){return c===\"<\"?\"&lt;\":c===\">\"?\"&gt;\":c===\"&\"?\"&amp;\":\"&quot;\";});}\nfunction when(t){ if(!t)return \"\";\n  var d=Date.now()-t, day=86400000;\n  if(d<day)return \"today\";\n  if(d<2*day)return \"yesterday\";\n  if(d<7*day)return Math.floor(d/day)+\" days ago\";\n  if(d<30*day)return Math.floor(d/(7*day))+\"w ago\";\n  if(d<365*day)return Math.floor(d/(30*day))+\"mo ago\";\n  return new Date(t).toLocaleDateString(); }\nfunction arrow(d){\n  return \"<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'><path d='\"\n    +(d<0?\"M15 18l-6-6 6-6\":\"M9 6l6 6-6 6\")+\"'/></svg>\";\n}\nvar READ=\"<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'><path d='M5 12h14'/><path d='M13 5l7 7-7 7'/></svg>\";\n\n// The arrows only exist when the row actually overflows. Three posts in a three-up row scroll\n// nowhere, and a control that cannot do anything is worse than no control.\nfunction wireNav(list,head){\n  var nav=head.querySelector(\".lx-blogs-nav\");\n  if(!nav){\n    nav=document.createElement(\"div\");\n    nav.className=\"lx-blogs-nav\";\n    nav.innerHTML=\"<button type='button' class='lx-blogs-arrow' data-d='-1' aria-label='Previous posts'>\"+arrow(-1)+\"</button>\"\n                 +\"<button type='button' class='lx-blogs-arrow' data-d='1' aria-label='Next posts'>\"+arrow(1)+\"</button>\";\n    var more=head.querySelector(\".lx-blogs-more\");\n    if(more)head.insertBefore(nav,more); else head.appendChild(nav);\n    nav.addEventListener(\"click\",function(e){\n      var t=e.target&&e.target.closest?e.target.closest(\".lx-blogs-arrow\"):null;\n      if(!t||t.disabled)return;\n      step(t.getAttribute(\"data-d\")===\"1\"?1:-1);\n    });\n  }\n  var prev=nav.querySelector(\"[data-d='-1']\"), next=nav.querySelector(\"[data-d='1']\");\n  function sync(){\n    var max=list.scrollWidth-list.clientWidth;\n    nav.style.display=(max>2)?\"\":\"none\";\n    var at=(list.__lxtarget!=null)?list.__lxtarget:list.scrollLeft;\n    prev.disabled=at<=1;\n    next.disabled=at>=max-1;\n  }\n  // Paging from the DESTINATION, not from where the animation happens to be. scrollBy mid-animation\n  // measures from the current position, so a second click before the first finished barely moved --\n  // five clicks advanced one page. Holding the target makes repeat clicks accumulate, and lets the\n  // arrow disable the moment the last page is asked for rather than when it arrives.\n  function step(dir){\n    var max=list.scrollWidth-list.clientWidth;\n    var base=(list.__lxtarget!=null)?list.__lxtarget:list.scrollLeft;\n    var amt=Math.max(200,Math.round(list.clientWidth*0.92));\n    list.__lxtarget=Math.max(0,Math.min(max,base+dir*amt));\n    list.scrollTo({left:list.__lxtarget,behavior:\"smooth\"});\n    clearTimeout(list.__lxtid);\n    list.__lxtid=setTimeout(function(){ list.__lxtarget=null; sync(); },700);\n    sync();\n  }\n  if(!list.__lxnav){\n    list.__lxnav=1;\n    list.addEventListener(\"scroll\",sync,{passive:true});\n    window.addEventListener(\"resize\",sync);\n  }\n  list.__lxsync=sync;\n  sync();\n  // Cover images change the row's height, not its width, but a late layout pass can still move the\n  // ends -- re-check once things have settled rather than trusting the first frame.\n  setTimeout(sync,400);\n}\n\nfunction paint(posts){\n  var card=document.querySelector(\".lx-blogs-card\"); if(!card)return;\n  var list=card.querySelector(\".lx-blogs-list\"); if(!list)return;\n  var head=card.querySelector(\".lx-blogs-head\");\n  var soon=card.querySelector(\".lx-blogs-soon\");\n  if(soon)soon.remove();\n\n  if(!posts.length){\n    list.removeAttribute(\"data-n\");\n    list.innerHTML=\"<div class='lx-blog-empty'>No posts yet.</div>\";\n    var nav=head&&head.querySelector(\".lx-blogs-nav\");\n    if(nav)nav.style.display=\"none\";\n    return;\n  }\n  var show=posts.slice(0,MAX);\n  // Drives the track width: three across once there are three, and an even split below that so a\n  // short list fills the card instead of leaving empty columns beside it.\n  list.setAttribute(\"data-n\",String(show.length));\n  var wide=false;\n  var SUF=\" | LumosCore\";\n  function ttl(t){ t=String(t||\"\");\n    return (t.length>SUF.length&&t.slice(-SUF.length)===SUF)?t.slice(0,-SUF.length):t; }\n  list.innerHTML=show.map(function(p){\n    var cover=p.cover?(\"<img class='lx-blog-img' alt='' src='\"+esc(p.cover)+\"'>\"):\"\";\n    var sub=\"<span class='lx-blog-when'>\"+esc(when(p.publishedAt||p.createdAt))+\"</span>\";\n    if(p.readMins)sub+=\"<span class='lx-blog-dot'></span><span class='lx-blog-when'>\"+esc(p.readMins)+\" min read</span>\";\n    var read=wide?(\"<span class='lx-blog-read'>Read article\"+READ+\"</span>\"):\"\";\n    return \"<a class='lx-blog-row' href='/blog/\"+esc(p.slug)+\"'>\"\n      +\"<div class='lx-blog-cover'>\"+cover\n      +(p.category?(\"<span class='lx-blog-chip' data-lxc=''>\"+esc(p.category)+\"</span>\"):\"\")+\"</div>\"\n      +\"<div class='lx-blog-meta'>\"\n      +\"<div class='lx-blog-title'>\"+esc(ttl(p.title))+\"</div>\"\n      +\"<div class='lx-blog-sub'>\"+sub+\"</div>\"+read\n      +\"</div></a>\";\n  }).join(\"\");\n  if(head)wireNav(list,head);\n}\n\nfunction boot(){\n  if(!document.querySelector(\".lx-blogs-card\"))return;\n  fetch(\"/lxapi/blog\").then(function(r){ return r.ok?r.json():null; })\n    .then(function(d){ paint((d&&d.posts)||[]); })\n    .catch(function(){});\n  var more=document.querySelector(\".lx-blogs-more\");\n  if(more&&!more.__lx){ more.__lx=1; more.style.cursor=\"pointer\";\n    more.addEventListener(\"click\",function(){ location.href=\"/blog\"; }); }\n}\nif(document.readyState!==\"loading\")boot(); else document.addEventListener(\"DOMContentLoaded\",boot);\n})();</script>";

// NO PLACEHOLDER ROWS IN THE MARKUP.
//
// They used to be baked in and swapped out by script on load, which meant the page painted five
// invented articles and a "Coming soon" tag for a moment before the real ones arrived -- a flash of
// content that was never true. Worse, if the fetch was slow or failed they simply stayed. The card now
// ships EMPTY and the script fills it; nothing false is ever on screen, and a failed fetch leaves an
// empty card rather than fiction.
const CARD = '<div class="lx-blogs-card" data-lxnonav="1">'
  + '<div class="lx-blogs-head"><h3>Blog</h3>'
  + '<span class="lx-blogs-more">View more'
  + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>'
  + '</span></div>'
  + '<div class="lx-blogs-list" data-lxempty="1"></div></div>';

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
    // Strip before inserting, the way the stylesheet above is handled. Insert-if-absent looks
    // idempotent but pins the container to whichever version of the painter landed first, so every
    // later edit to this script is silently a no-op -- the transform reports success and ships the
    // old code.
    p = p.replace(/<script id="lx-dashblogdata">[\s\S]*?<\/script>/g, "");
    {
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
