// The public Blog page: /blog, which is where the footer's "Blogs" link goes.
//
// The page is CLONED from an already-built page (the MCP page) rather than authored from scratch. Every
// shell concern -- header, sidebar, footer, theme, the nav's own scripts -- is already injected into
// those pages by the other transforms, so cloning one inherits a working shell and this file only has to
// replace what is inside <main>. Authoring a new shell by hand would mean re-deriving all of that and
// keeping it in step for ever.
//
// THE POSTS ARE PLACEHOLDERS AND THE PAGE SAYS SO, for the same reason the dashboard card does: there is
// no blog to read yet. Neutral subjects, no invented announcements. The index cards DO open the article
// page -- the dashboard card stays unclickable, where a placeholder beside live figures would read as
// real. When the feed exists, replace POSTS and drop the "Coming soon" tag; the markup does not change.
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
  + '.lx-bp-card{display:flex;flex-direction:column;gap:12px;min-width:0;text-decoration:none;color:inherit}'
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
    // The index cards ARE links now -- there is a page behind them. The dashboard card stays
    // unclickable, as asked: that one sits next to live figures where a placeholder that opens
    // something reads as real. Here the reader has already chosen to look at the blog.
    return '<a class="lx-bp-card" href="/blog/' + slug(p[0]) + '">'
      + '<div class="lx-bp-cover" style="--c1:' + p[2] + ';--c2:' + p[3] + '">'
      + '<span class="lx-bp-chip">' + esc(p[1]) + '</span></div>'
      + '<div class="lx-bp-title">' + esc(p[0]) + '</div>'
      + '<div class="lx-bp-when">' + esc(p[4]) + '</div>'
      + '</a>';
  }).join('')
  + '</div></div>';

// The donor marks its OWN nav item active. Left alone, the sidebar highlights MCP while the reader
// is on the blog. There is no blog entry in that nav, so the right state is nothing highlighted.
function clearNavActive(html) {
  return html.replace(/(<a[^>]*class=")nx-item active(")/g, "$1nx-item$2")
             .replace(/(<a[^>]*class=")nx-item active( [^"]*")/g, "$1nx-item$2");
}

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

// The url a post gets. Every post resolves to the same template today, because there is one article
// page and no content behind it yet; when the feed exists this is the key it will be looked up by.
function slug(title) {
  return String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

const POST = POSTS[0];   // the template renders one post; the first is the one it shows

// The body is real, accurate, general information about how a constant-product pool works -- not lorem,
// and not an announcement. It states nothing about LumosCore that could be read as a claim, and nothing
// dated, so it is safe on a live site while the section is still marked Coming soon. It exists to show
// the reading experience: heading, paragraph, list, callout, and the measure the type is set to.
const BODY = '<p>A liquidity pool holds a reserve of two assets and lets anyone trade between them '
  + 'without a counterparty on the other side. Instead of matching your order against someone else\'s, '
  + 'the pool quotes a price from the balance of what it holds.</p>'
  + '<h2>The constant product</h2>'
  + '<p>Stellar\'s pools use the constant-product rule: multiply the two reserves together and that '
  + 'product stays the same across a trade. Put one asset in, take the other out, and the amount you '
  + 'receive is whatever keeps that product level after the fee is taken.</p>'
  + '<p>Two things follow from it. The price moves as you trade, because you are changing the very '
  + 'balance the price is read from. And the bigger the trade relative to the reserves, the further it '
  + 'moves — which is what slippage measures.</p>'
  + '<h2>What a depositor holds</h2>'
  + '<p>Depositing means adding both assets in the ratio the pool already holds them, and receiving '
  + 'pool shares in return. The shares are a claim on a fraction of the reserves, not on a fixed amount '
  + 'of either asset:</p>'
  + '<ul><li>Fees from every trade accrue to the reserves, so the shares grow into a slightly larger '
  + 'slice over time.</li>'
  + '<li>The mix changes with the market. As one asset is bought out of the pool, the shares come to '
  + 'represent more of the other.</li>'
  + '<li>Withdrawing returns both assets at whatever ratio holds at that moment.</li></ul>'
  + '<blockquote>Holding pool shares is not the same as holding the two assets. If their prices move '
  + 'apart, the shares are worth less than simply keeping both would have been — the difference is what '
  + 'is meant by impermanent loss.</blockquote>'
  + '<h2>Before depositing</h2>'
  + '<p>Look at the depth of the reserves rather than the headline rate: a pool with little in it will '
  + 'move a long way on a modest trade, in both directions. Check that both assets are ones you are '
  + 'content to hold, since a withdrawal can return more of whichever the market has been selling.</p>';

const POST_MAIN = '<div class="container lx-post">'
  + '<a class="lx-post-back" href="/blog">'
  + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>'
  + 'All posts</a>'
  + '<div class="lx-post-head">'
  + '<span class="lx-bp-chip lx-post-chip">' + esc(POST[1]) + '</span>'
  + '<h1>' + esc(POST[0]) + '</h1>'
  + '<div class="lx-post-meta">' + esc(POST[4]) + '<span class="lx-post-dot"></span>4 min read</div>'
  + '</div>'
  + '<div class="lx-post-cover" style="--c1:' + POST[2] + ';--c2:' + POST[3] + '"></div>'
  + '<article class="lx-post-body">' + BODY + '</article>'
  + '<div class="lx-post-foot"><a class="lx-post-back" href="/blog">'
  + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>'
  + 'Back to all posts</a></div>'
  + '</div>';

const POST_STYLE = '<style id="lx-blogpost-css">/*lxts:1.1*/'
  // A reading measure, not a full-width page: long lines are what makes an article tiring to read.
  + '.lx-post{max-width:760px}'
  + '.lx-post-back{display:inline-flex;align-items:center;gap:6px;text-decoration:none;'
  + 'font:700 13px/1 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-muted,#8a8fa3);'
  + 'transition:color .15s ease}'
  + '.lx-post-back:hover{color:var(--accent,#ea6a2c)}'
  + '.lx-post-back svg{width:13px;height:13px}'
  + '.lx-post-head{margin:18px 0 20px;display:flex;flex-direction:column;align-items:flex-start;gap:12px}'
  + '.lx-post-chip{position:static;background:rgba(127,127,140,.16);border-color:transparent;'
  + 'color:var(--text-muted,#8a8fa3);backdrop-filter:none}'
  + '.lx-post-head h1{margin:0;font:800 36px/1.2 "Hanken Grotesk",system-ui,sans-serif;'
  + 'color:var(--text,#0e0e10);letter-spacing:-.022em;text-wrap:balance}'
  + '.lx-post-meta{display:flex;align-items:center;gap:9px;'
  + 'font:600 13px/1 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-muted,#8a8fa3)}'
  + '.lx-post-dot{width:3px;height:3px;border-radius:50%;background:currentColor;opacity:.6}'
  + '.lx-post-cover{width:100%;aspect-ratio:21/9;border-radius:16px;margin:0 0 30px;position:relative;'
  + 'overflow:hidden;background:linear-gradient(135deg,var(--c1) 0%,var(--c2) 100%)}'
  + '.lx-post-cover::after{content:"";position:absolute;inset:0;'
  + 'background:linear-gradient(180deg,rgba(255,255,255,.20),rgba(255,255,255,0) 55%)}'
  + '.lx-post-body{font:400 17px/1.72 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-soft,#6b6b76)}'
  + '.lx-post-body p{margin:0 0 20px}'
  + '.lx-post-body h2{margin:34px 0 12px;font:800 22px/1.3 "Hanken Grotesk",system-ui,sans-serif;'
  + 'color:var(--text,#0e0e10);letter-spacing:-.015em}'
  + '.lx-post-body ul{margin:0 0 20px;padding-left:20px}'
  + '.lx-post-body li{margin:0 0 9px}'
  + '.lx-post-body blockquote{margin:26px 0;padding:14px 18px;border-left:3px solid var(--accent,#ea6a2c);'
  + 'background:var(--surface-2,rgba(127,127,140,.07));border-radius:0 10px 10px 0;color:var(--text,#0e0e10)}'
  + '.lx-post-foot{margin-top:34px;padding-top:20px;border-top:1px solid var(--border,#ececef)}'
  + '@media(max-width:620px){.lx-post-head h1{font-size:28px}.lx-post-cover{aspect-ratio:16/9}}'
  + '</style>';

function setPostHead(html) {
  let h = html.replace(/<title>[\s\S]*?<\/title>/,
    '<title>' + esc(POST[0]) + ' | LumosCore Blog</title>');
  h = h.replace(/<meta name="description" content="[^"]*">/,
    '<meta name="description" content="How a constant-product liquidity pool prices a trade on Stellar, '
    + 'what pool shares represent, and what to look at before depositing.">');
  const hi = h.indexOf('</head>');
  return hi < 0 ? h : h.slice(0, hi) + STYLE + POST_STYLE + h.slice(hi);
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
  json[target] = clearNavActive(setHead(body));
  made++;

  const postBody = replaceMain(src, POST_MAIN);
  if (postBody) { json[target.replace('-blog', '-blog-post')] = clearNavActive(setPostHead(postBody)); made++; }
  else console.error('  ' + file + ': could not build the post page from the donor');

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
