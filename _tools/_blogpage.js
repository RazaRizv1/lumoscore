// The public Blog page: /blog, which is where the footer's "Blogs" link goes.
//
// The page is CLONED from an already-built page (the MCP page) rather than authored from scratch. Every
// shell concern -- header, sidebar, footer, theme, the nav's own scripts -- is already injected into
// those pages by the other transforms, so cloning one inherits a working shell and this file only has to
// replace what is inside <main>. Authoring a new shell by hand would mean re-deriving all of that and
// keeping it in step for ever.
//
// THE POSTS ARE PLACEHOLDERS AND THE PAGE SAYS SO, for the same reason the dashboard card does: there is
// no blog to read yet. Neutral subjects, no invented announcements, and nothing clickable -- a card that
// opened nothing would be worse than one that plainly is not ready. When the real feed exists, replace
// POSTS and drop the "Coming soon" tag; the markup and CSS do not change.
//
// Idempotent: the page key is rebuilt from the donor on every run, so re-running cannot layer this on
// top of a previous copy of itself.
//
// Usage: node _tools/_blogpage.js   (then extract_site, which reads the new key)
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const POSTS = [
  ['How liquidity pools work on Stellar', 'Explainer', '#a855f7', '#6d28d9', '2 days ago'],
  ['Understanding trustlines and why assets need them', 'Guide', '#38bdf8', '#2563eb', '5 days ago'],
  ['Bridging USDC across chains with Circle CCTP', 'Explainer', '#2dd4bf', '#0d9488', '1w ago'],
  ['Path payments, and how a swap actually settles', 'Guide', '#f7b733', '#ea6a2c', '3w ago'],
  ['Issuing a token on Stellar, start to finish', 'Walkthrough', '#f472b6', '#be185d', '1mo ago'],
  ['Reading a pool: reserves, share and slippage', 'Explainer', '#60a5fa', '#4338ca', '1mo ago'],
];

// /*lxts:1.1*/ pins this at its authored size: without it _typescale scales the block on whichever run
// follows this one, and every size here moves 10%.
const STYLE = '<style id="lx-blogpage-css">/*lxts:1.1*/'
  + '.lx-bp-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 10px}'
  + '.lx-bp-head h1{margin:0;font:800 32px/1.15 "Hanken Grotesk",system-ui,sans-serif;'
  + 'color:var(--text,#0e0e10);letter-spacing:-.02em}'
  + '.lx-bp-soon{font:700 10px/1 "Hanken Grotesk",system-ui,sans-serif;text-transform:uppercase;'
  + 'letter-spacing:.06em;color:var(--text-muted,#8a8fa3);border:1px solid var(--border,#ececef);'
  + 'border-radius:999px;padding:5px 9px;white-space:nowrap}'
  + '.lx-bp-lede{margin:0 0 26px;max-width:62ch;'
  + 'font:400 16px/1.6 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-soft,#6b6b76)}'
  // Three across with room to breathe, down to one on a phone. auto-fit so it reflows rather than
  // overflowing at any width in between.
  + '.lx-bp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:26px 22px}'
  // Not links: there is nowhere to go yet, so the cursor does not promise one. The hover stays, so the
  // page reads as the index it will become.
  + '.lx-bp-card{display:flex;flex-direction:column;gap:12px;min-width:0;cursor:default}'
  + '.lx-bp-cover{width:100%;aspect-ratio:16/9;border-radius:14px;position:relative;overflow:hidden;'
  + 'background:linear-gradient(135deg,var(--c1) 0%,var(--c2) 100%);'
  + 'transition:transform .18s ease,box-shadow .18s ease}'
  + '.lx-bp-card:hover .lx-bp-cover{transform:translateY(-3px);box-shadow:0 14px 30px -16px rgba(0,0,0,.6)}'
  + '.lx-bp-card:hover .lx-bp-title{color:var(--accent,#ea6a2c)}'
  + '@media(prefers-reduced-motion:reduce){.lx-bp-cover{transition:none}}'
  + '.lx-bp-cover::after{content:"";position:absolute;inset:0;'
  + 'background:linear-gradient(180deg,rgba(255,255,255,.20),rgba(255,255,255,0) 55%)}'
  + '.lx-bp-chip{position:absolute;left:10px;bottom:10px;z-index:1;'
  + 'font:700 10px/1 "Hanken Grotesk",system-ui,sans-serif;text-transform:uppercase;letter-spacing:.07em;'
  + 'color:#fff;background:rgba(0,0,0,.32);border:1px solid rgba(255,255,255,.24);'
  + 'border-radius:999px;padding:5px 9px;backdrop-filter:blur(3px)}'
  + '.lx-bp-title{font:700 18px/1.35 "Hanken Grotesk",system-ui,sans-serif;color:var(--text,#0e0e10);'
  + 'transition:color .15s ease}'
  + '.lx-bp-when{font:600 12px/1 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-muted,#8a8fa3)}'
  + '</style>';

function esc(s) {
  return String(s).split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;');
}

const MAIN = '<div class="container">'
  + '<div class="lx-bp-head"><h1>Blog</h1><span class="lx-bp-soon">Coming soon</span></div>'
  + '<p class="lx-bp-lede">Guides and explainers on trading, pools, bridging and issuing assets on '
  + 'Stellar. The first posts are being written — the cards below are placeholders for their layout.</p>'
  + '<div class="lx-bp-grid">'
  + POSTS.map(function (p) {
    return '<article class="lx-bp-card">'
      + '<div class="lx-bp-cover" style="--c1:' + p[2] + ';--c2:' + p[3] + '">'
      + '<span class="lx-bp-chip">' + esc(p[1]) + '</span></div>'
      + '<div class="lx-bp-title">' + esc(p[0]) + '</div>'
      + '<div class="lx-bp-when">' + esc(p[4]) + '</div>'
      + '</article>';
  }).join('')
  + '</div></div>';

// swap the contents of <main>, keeping the tag itself (its classes drive the page's own layout)
function replaceMain(html, inner) {
  const open = html.indexOf('<main');
  if (open < 0) return null;
  const gt = html.indexOf('>', open);
  const close = html.lastIndexOf('</main>');
  if (gt < 0 || close < 0 || close < gt) return null;
  return html.slice(0, gt + 1) + inner + html.slice(close);
}

function setHead(html) {
  let h = html.replace(/<title>[\s\S]*?<\/title>/,
    '<title>Blog — Guides and explainers | LumosCore</title>');
  h = h.replace(/<meta name="description" content="[^"]*">/,
    '<meta name="description" content="Guides and explainers on trading, liquidity pools, '
    + 'cross-chain transfers and token issuance on Stellar, from the LumosCore team.">');
  // our own block last, so it is not outranked by the donor page's styles
  const hi = h.indexOf('</head>');
  return hi < 0 ? h : h.slice(0, hi) + STYLE + h.slice(hi);
}

let made = 0, linked = 0;
for (const [dev, donor, target] of [
  ['desktop', 'lumoscore-mcp.html', 'lumoscore-blog.html'],
  ['mobile', 'lumoscore-mcp-mobile.html', 'lumoscore-blog-mobile.html'],
]) {
  const file = 'lumoscore-aptos-' + dev + '.html';
  let data; try { data = read(file); } catch (e) { continue; }
  let json, s, e; try { ({ json, s, e } = getContents(data)); } catch (err) { continue; }

  const src = json[donor];
  if (typeof src !== 'string') { console.error('  ' + file + ': donor ' + donor + ' missing — skipped'); continue; }

  const body = replaceMain(src, MAIN);
  if (!body) { console.error('  ' + file + ': could not find <main> in the donor — skipped'); continue; }
  json[target] = setHead(body);
  made++;

  // the footer's "Blogs" link, on every page in this container, now has somewhere to go
  for (const k of Object.keys(json)) {
    if (typeof json[k] !== 'string') continue;
    const before = json[k];
    // Desktop's footer says "Blogs", the phone's says "Blog". Matching only the plural left every
    // mobile page with a dead href="#". Both spellings, and only where the href is still a placeholder.
    json[k] = json[k]
      .replace(/<a href="#">Blogs<\/a>/g, '<a href="/blog">Blogs</a>')
      .replace(/<a href="#">Blog<\/a>/g, '<a href="/blog">Blog</a>');
    if (json[k] !== before) linked++;
  }

  const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
  fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
}
console.log('blog page built on ' + made + ' container(s); footer link pointed at /blog on ' + linked + ' page(s)');
