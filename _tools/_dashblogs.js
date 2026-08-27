// Dashboard: replace "Live Platform Activity" with a Blog section.
//
// The activity feed listed raw Horizon trades. That is the Trade page's job, and on a screen meant for
// orientation it was a wall of other people's swaps. The slot goes to LumosCore's own writing instead.
//
// THE POSTS ARE PLACEHOLDERS, DELIBERATELY, AND THEY SAY SO. There is no blog to read yet -- the footer's
// "Blogs" link is still href="#" and /blog 404s -- so the section ships with five rows of stand-in
// content and a "Coming soon" tag beside the heading, and nothing in it is clickable.
//
// The titles are neutral topic lines, not announcements. A placeholder that reads "LumosCore launches X"
// would be read as fact by anyone who saw it, on a live product handling real funds; these name subjects
// a blog might cover and claim nothing. There are no dates either, for the same reason -- a fabricated
// timestamp is a fabricated fact. When the real feed exists, replace POSTS with what it returns and drop
// the "Coming soon" tag; the markup and CSS do not need to change.
//
// The covers are inline gradients rather than image files: nothing to host, nothing to cache-bust, and
// they follow the theme instead of carrying a baked background into light mode.
//
// Idempotent: the style block and the card are both replaced wholesale on each run.
//
// Usage: node _tools/_dashblogs.js
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// Neutral subjects, no claims, no dates. Each pair is [title, tag] and the two gradient stops.
const POSTS = [
  ['How liquidity pools work on Stellar', 'Explainer', '#a855f7', '#6d28d9'],
  ['Understanding trustlines and why assets need them', 'Guide', '#38bdf8', '#2563eb'],
  ['Bridging USDC across chains with Circle CCTP', 'Explainer', '#2dd4bf', '#0d9488'],
  ['Path payments, and how a swap actually settles', 'Guide', '#f7b733', '#ea6a2c'],
  ['Issuing a token on Stellar, start to finish', 'Walkthrough', '#f472b6', '#be185d'],
];

const STYLE = '<style id="lx-dashblogs-css">/*lxts:1.1*/'
  + '.lx-blogs-card{background:var(--surface,#fff);border:1px solid var(--border,#ececef);'
  + 'border-radius:14px;padding:15px 16px;min-width:0;display:flex;flex-direction:column;gap:12px}'
  + '.lx-blogs-head{display:flex;align-items:center;gap:9px;min-width:0}'
  + '.lx-blogs-head h3{margin:0;font:800 15px/1.1 "Hanken Grotesk",system-ui,sans-serif;'
  + 'color:var(--text,#0e0e10);letter-spacing:-.015em}'
  // The tag is the honest part of this section: it says the rows are not real posts yet.
  + '.lx-blogs-soon{font:700 10px/1 "Hanken Grotesk",system-ui,sans-serif;text-transform:uppercase;'
  + 'letter-spacing:.06em;color:var(--text-muted,#8a8fa3);border:1px solid var(--border,#ececef);'
  + 'border-radius:999px;padding:4px 8px;white-space:nowrap}'
  + '.lx-blogs-list{display:flex;flex-direction:column;gap:2px;min-width:0}'
  // Not a link: no href, and the cursor does not promise one. It keeps a link's hover so the section
  // reads as the list of posts it will become.
  + '.lx-blog-row{display:flex;align-items:center;gap:12px;min-width:0;padding:9px 8px;margin:0 -8px;'
  + 'border-radius:10px;cursor:default;transition:background .15s ease}'
  + '.lx-blog-row:hover{background:rgba(127,127,140,.08)}'
  + '.lx-blog-row:hover .lx-blog-title{color:var(--accent,#ea6a2c)}'
  + '@media(prefers-reduced-motion:reduce){.lx-blog-row{transition:none}}'
  + '.lx-blog-cover{flex:0 0 auto;width:56px;height:56px;border-radius:12px;'
  + 'background:linear-gradient(135deg,var(--c1) 0%,var(--c2) 100%);position:relative;overflow:hidden}'
  // a soft top light, so the cover reads as a surface rather than a flat swatch
  + '.lx-blog-cover::after{content:"";position:absolute;inset:0;'
  + 'background:linear-gradient(180deg,rgba(255,255,255,.20),rgba(255,255,255,0) 55%)}'
  + '.lx-blog-meta{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:4px}'
  + '.lx-blog-title{font:600 14px/1.35 "Hanken Grotesk",system-ui,sans-serif;color:var(--text,#0e0e10);'
  + 'transition:color .15s ease;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;'
  + 'overflow:hidden}'
  + '.lx-blog-tag{font:700 10px/1 "Hanken Grotesk",system-ui,sans-serif;text-transform:uppercase;'
  + 'letter-spacing:.06em;color:var(--text-muted,#8a8fa3)}'
  + '</style>';

function esc(s) {
  return String(s).split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;');
}

const CARD = '<div class="lx-blogs-card" data-lxnonav="1">'
  + '<div class="lx-blogs-head"><h3>Blog</h3><span class="lx-blogs-soon">Coming soon</span></div>'
  + '<div class="lx-blogs-list">'
  + POSTS.map(function (p) {
    return '<article class="lx-blog-row">'
      + '<div class="lx-blog-cover" style="--c1:' + p[2] + ';--c2:' + p[3] + '"></div>'
      + '<div class="lx-blog-meta">'
      + '<div class="lx-blog-title">' + esc(p[0]) + '</div>'
      + '<div class="lx-blog-tag">' + esc(p[1]) + '</div>'
      + '</div></article>';
  }).join('')
  + '</div></div>';

// Pull out a balanced <div ...> ... </div> starting at `from`, so nested divs do not end it early.
function balancedDiv(html, from) {
  let i = html.indexOf('>', from);
  if (i < 0) return -1;
  let depth = 1;
  i++;
  while (i < html.length && depth > 0) {
    const nextOpen = html.indexOf('<div', i);
    const nextClose = html.indexOf('</div>', i);
    if (nextClose < 0) return -1;
    if (nextOpen >= 0 && nextOpen < nextClose) { depth++; i = nextOpen + 4; }
    else { depth--; i = nextClose + 6; }
  }
  return depth === 0 ? i : -1;
}

let files = 0, keys = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = 'lumoscore-aptos-' + dev + '.html';
  let data; try { data = read(file); } catch (e) { continue; }
  let json, s, e; try { ({ json, s, e } = getContents(data)); } catch (err) { continue; }

  let changed = false;
  for (const k of Object.keys(json)) {
    let p = json[k];
    if (typeof p !== 'string') continue;
    if (p.indexOf('status-row') < 0 || (p.indexOf('activityList') < 0 && p.indexOf('lx-blogs-card') < 0)) continue;

    const before = p;
    p = p.replace(/<style id="lx-dashblogs-css">[\s\S]*?<\/style>/g, '');

    // Replace whichever is there: the original activity card, or our own card from a previous run.
    let at = p.indexOf('<div class="activity-card"');
    if (at < 0) at = p.indexOf('<div class="lx-blogs-card"');
    if (at < 0) continue;
    const end = balancedDiv(p, at);
    if (end < 0) { console.error('  ' + file + ' / ' + k + ': could not find the end of the card — skipped'); continue; }
    p = p.slice(0, at) + CARD + p.slice(end);

    const hi = p.indexOf('</head>');
    if (hi < 0) continue;
    p = p.slice(0, hi) + STYLE + p.slice(hi);

    if (p !== before) { json[k] = p; changed = true; keys++; }
  }
  if (changed) {
    files++;
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
console.log('dashboard blog section on ' + keys + ' page key(s) across ' + files + ' container(s)');
