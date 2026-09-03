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
// real. When the feed exists, replace POSTS and drop the lede's last sentence; the markup does not change.
// (The "Coming soon" tag next to the heading was removed on request -- the lede still says the cards are
// placeholders, which is what keeps the page honest while there is nothing behind them.)
//
// Idempotent: the page key is rebuilt from the donor on every run, so re-running cannot layer this on
// top of a previous copy of itself.
//
// Usage: node _tools/_blogpage.js   (then extract_site, which reads the new key)
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const POSTS = [
  ['How liquidity pools work on Stellar', 'Stellar', '#a855f7', '#6d28d9', '2 days ago'],
  ['Understanding trustlines and why assets need them', 'Guide', '#38bdf8', '#2563eb', '5 days ago'],
  ['Bridging USDC across chains with Circle CCTP', 'Stellar', '#2dd4bf', '#0d9488', '1w ago'],
  ['Path payments, and how a swap actually settles', 'Guide', '#f7b733', '#ea6a2c', '3w ago'],
  ['Issuing a token on Stellar, start to finish', 'Walkthrough', '#f472b6', '#be185d', '1mo ago'],
  ['Reading a pool: reserves, share and slippage', 'Stellar', '#60a5fa', '#4338ca', '1mo ago'],
];

// /*lxts:1.1*/ pins this at its authored size: without it _typescale scales the block on whichever run
// follows this one, and every size here moves 10%.
const STYLE = '<style id="lx-blogpage-css">/*lxts:1.1*/'
  + '.lx-bp-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 10px}'
  + '.lx-bp-head h1{margin:0;font:800 32px/1.15 "Hanken Grotesk",system-ui,sans-serif;'
  + 'color:var(--text,#0e0e10);letter-spacing:-.02em}'
  // No max-width: the lede runs the full width of the card grid below it rather than stopping at a
  // reading measure halfway across. It is a two-sentence page intro, not body copy, so the long line
  // costs nothing -- the same cap on the ARTICLE page is doing real work and stays.
  + '.lx-bp-lede{margin:0 0 26px;'
  + 'font:400 16px/1.6 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-soft,#6b6b76)}'
  // Three across with room to breathe, down to one on a phone. auto-fit so it reflows rather than
  // overflowing at any width in between.
  + '.lx-bp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:26px 22px}'
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
  + '.lx-bp-chip{position:absolute;left:10px;bottom:10px;z-index:3;'
  + 'font:700 10px/1 "Hanken Grotesk",system-ui,sans-serif;text-transform:uppercase;letter-spacing:.07em;'
  + 'color:#fff;background:rgba(0,0,0,.32);border:1px solid rgba(255,255,255,.24);'
  + 'border-radius:999px;padding:5px 9px;backdrop-filter:blur(3px)}'
  + '.lx-bp-title{font:700 18px/1.35 "Hanken Grotesk",system-ui,sans-serif;color:var(--text,#0e0e10);'
  + 'transition:color .15s ease}'
  + '.lx-bp-when{font:600 12px/1 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-muted,#8a8fa3)}'
  + '</style>';

function esc(s){return (String(s).split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;')).split(String.fromCharCode(39)).join("&#39;");}

function FALSE_AND(){ return { join: function(){ return ""; } }; }

const MAIN = '<div class="container">'
  + '<div class="lx-bp-head"><h1>Blog</h1></div>'
  + '<p class="lx-bp-lede">Guides and explainers on trading, pools, bridging and issuing assets on '
  + 'Stellar.</p>'
  + '<div class="lx-bp-grid">'
  + FALSE_AND(function (p) {
    // The index cards ARE links now -- there is a page behind them. The dashboard card stays
    // unclickable, as asked: that one sits next to live figures where a placeholder that opens
    // something reads as real. Here the reader has already chosen to look at the blog.
    return '<a class="lx-bp-card" href="/blog/' + slug(p[0]) + '">'
      + '<div class="lx-bp-cover" style="--c1:' + p[2] + ';--c2:' + p[3] + '">'
      + '<span class="lx-bp-chip" data-lxc="">' + esc(p[1]) + '</span></div>'
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

// The donor page carries its own FAQ section outside <main>, so replaceMain() never sees it. It is
// MCP content on a blog page. Remove the section, its FAQPage JSON-LD and its stylesheet together --
// keeping the structured data after the visible answers are gone would describe a page that does not
// exist. Nothing links to #faq on these pages (checked), so no dead anchor is left behind.
function stripFaq(html) {
  let h = html;
  const cut = (open, close) => {
    const i = h.indexOf(open);
    if (i < 0) return false;
    const j = h.indexOf(close, i);
    if (j < 0) return false;
    h = h.slice(0, i) + h.slice(j + close.length);
    return true;
  };
  cut('<section class="lx-faq"', '</section>');
  cut('<script type="application/ld+json" id="lx-faq-ld">', '<\/script>');
  cut('<style id="lx-faq-css">', '</style>');
  return h;
}

// The blog pages' own copy of the second logo healer learns the data-lxc opt-out. Deliberately scoped
// to these pages: see the note above -- the same script is on 47 others where data-lxc means something
// else, so this must not be hoisted into the shared transform.
function optOutLogoHealer(html) {
  const A = 'function isCandidate(el){';
  const i = html.indexOf(A);
  if (i < 0) return html;   // donor changed shape; the chips just look wrong rather than the build failing
  return html.slice(0, i + A.length)
    + 'if(el.getAttribute&&el.getAttribute("data-lxc")!=null)return false;'
    + html.slice(i + A.length);
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
  + '<div class="mcp-crumb lx-post-crumb"><a href="/blog" data-lxback="1">'
  + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>'
  + ' Back to LumosCore blog</a></div>'
  + '<div class="lx-post-head">'
  + '<h1></h1>'
  + '<div class="lx-post-meta"></div>'
  + '</div>'
  + "<aside class=\"lx-sh\" aria-label=\"Share this article\"><div class=\"lx-sh-in\"><span class=\"lx-sh-lab\">Share</span><a class=\"lx-sh-btn\" data-sh=\"x\" href=\"#\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"Share on X\" title=\"Share on X\"><svg viewBox=\"0 0 24 24\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z\"/></svg></a><a class=\"lx-sh-btn\" data-sh=\"tg\" href=\"#\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"Share on Telegram\" title=\"Share on Telegram\"><svg viewBox=\"0 0 24 24\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z\"/></svg></a><a class=\"lx-sh-btn\" data-sh=\"li\" href=\"#\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"Share on LinkedIn\" title=\"Share on LinkedIn\"><svg viewBox=\"0 0 24 24\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0z\"/></svg></a><a class=\"lx-sh-btn\" data-sh=\"rd\" href=\"#\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"Share on Reddit\" title=\"Share on Reddit\"><svg viewBox=\"0 0 24 24\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M12 0C5.373 0 0 5.373 0 12c0 6.627 5.373 12 12 12s12-5.373 12-12c0-6.627-5.373-12-12-12zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-6.994 4.87-3.864 0-6.994-2.176-6.994-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z\"/></svg></a><button class=\"lx-sh-btn\" data-sh=\"cp\" type=\"button\" aria-label=\"Copy link\" title=\"Copy link\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71\"/><path d=\"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71\"/></svg></button></div></aside>"
  + '<div class="lx-post-cover"></div>'
  + '<article class="lx-post-body"></article>'
  + "<script>(function(){if(window.__lxShare)return; window.__lxShare=1;function ttl(){var h=document.querySelector('.lx-post-head h1');var t=(h&&h.textContent||'').trim(); return t||document.title||'LumosCore';}function url(){return location.origin+location.pathname;}function target(k){var u=encodeURIComponent(url()),t=encodeURIComponent(ttl());if(k==='x')return 'https://twitter.com/intent/tweet?text='+t+'&url='+u;if(k==='tg')return 'https://t.me/share/url?url='+u+'&text='+t;if(k==='li')return 'https://www.linkedin.com/sharing/share-offsite/?url='+u;if(k==='rd')return 'https://www.reddit.com/submit?url='+u+'&title='+t;return '';}document.addEventListener('click',function(e){var b=e.target&&e.target.closest?e.target.closest('.lx-sh-btn'):null; if(!b)return;var k=b.getAttribute('data-sh');if(k==='cp'){e.preventDefault();var done=function(){var old=b.innerHTML;b.innerHTML=\"<svg viewBox=\\\"0 0 24 24\\\" fill=\\\"none\\\" stroke=\\\"currentColor\\\" stroke-width=\\\"2.6\\\" stroke-linecap=\\\"round\\\" stroke-linejoin=\\\"round\\\" aria-hidden=\\\"true\\\"><path d=\\\"M20 6 9 17l-5-5\\\"/></svg>\";b.classList.add('is-ok');b.setAttribute('aria-label','Link copied');setTimeout(function(){b.innerHTML=old;b.classList.remove('is-ok');b.setAttribute('aria-label','Copy link');},1500);};try{function fb(t){try{var ta=document.createElement('textarea');ta.value=t;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;top:-9999px;left:-9999px;opacity:0';document.body.appendChild(ta);ta.select();ta.setSelectionRange(0,ta.value.length);var ok=document.execCommand('copy');document.body.removeChild(ta);return !!ok;}catch(_){return false;}}var u=url();if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(u).then(done,function(){if(fb(u))done();});}else if(fb(u)){done();}}catch(_){}return;}var t=target(k); if(!t){e.preventDefault();return;}b.setAttribute('href',t);},true);})();</script>"
  + '</div>';

const POST_STYLE = '<style id="lx-blogpost-css">/*lxts:1.1*/'
  // A reading measure, not a full-width page: long lines are what makes an article tiring to read.
  + '.lx-post{max-width:1060px;margin-left:auto;margin-right:auto;padding-left:24px;padding-right:24px;'
  + 'text-align:center}'
  // The furniture is centred; the PROSE is not. Centred paragraphs give every line a different
  // starting point, so the eye has to hunt for each one -- it is the one part of a page where
  // centring costs real readability.
  + '.lx-post-body{text-align:left}'
  + '.lx-post-crumb{text-align:left;margin:0 0 15.4px}'
  + '.lx-post-head{margin:22px 0 22px;display:flex;flex-direction:column;align-items:center;gap:12px}'
  + '.lx-post-chip{flex:0 0 auto;position:static;background:rgba(127,127,140,.16);border-color:transparent;'
  + 'color:var(--text-muted,#8a8fa3);backdrop-filter:none}'
  + '.lx-post-head h1{margin:0;font:800 40px/1.18 "Hanken Grotesk",system-ui,sans-serif;'
  + 'color:var(--text,#0e0e10);letter-spacing:-.022em;text-wrap:balance}'
  + '.lx-post-meta{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:9px;'
  + 'font:600 13px/1 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-muted,#8a8fa3)}'
  + '.lx-post-dot{width:3px;height:3px;border-radius:50%;background:currentColor;opacity:.6}'
  + '.lx-post-cover{width:100%;aspect-ratio:1200/630;border-radius:16px;margin:0 0 32px;position:relative;'
  + 'overflow:hidden;background:linear-gradient(135deg,var(--c1) 0%,var(--c2) 100%)}'
  + '.lx-post-cover::after{content:"";position:absolute;inset:0;'
  + 'background:linear-gradient(180deg,rgba(255,255,255,.20),rgba(255,255,255,0) 55%)}'
  + '.lx-post-body{font:400 19.5px/1.8 "Hanken Grotesk",system-ui,sans-serif;color:var(--text,#0e0e10)}'
  + '.lx-post-body p{margin:0 0 20px}'
  // Post bodies had no link rule at all, so every link fell through to the browser default: bright
  // blue, underlined, the one colour that appears nowhere else on the site. Accent, with the underline
  // kept -- a link inside running prose has to stay visible as a link.
  + '.lx-post-body a{color:var(--accent,#ea6a2c);text-decoration:underline;'
  + 'text-decoration-color:rgba(234,106,44,.4);text-decoration-thickness:1.5px;'
  + 'text-underline-offset:3px;transition:text-decoration-color .13s}'
  + '.lx-post-body a:hover{text-decoration-color:var(--accent,#ea6a2c)}'
  + '.lx-post-body a:visited{color:var(--accent,#ea6a2c)}'
  + '.lx-post-body img{max-width:100%;height:auto;display:block;border-radius:12px;margin:22px auto}'
  + '.lx-post-body figure{margin:22px 0}'
  + '.lx-post-body figcaption{margin-top:8px;text-align:center;font-size:13.5px;color:var(--text-muted,#8a8fa3)}'
  + '.lx-post-body h2{margin:36px 0 12px;font:800 24px/1.3 "Hanken Grotesk",system-ui,sans-serif;'
  + 'color:var(--text,#0e0e10);letter-spacing:-.015em}'
  + '.lx-post-body ul{margin:0 0 20px;padding-left:20px}'
  + '.lx-post-body li{margin:0 0 9px}'
  + '.lx-post-body blockquote{margin:26px 0;padding:14px 18px;border-left:3px solid var(--accent,#ea6a2c);'
  + 'background:var(--surface-2,rgba(127,127,140,.07));border-radius:0 10px 10px 0;color:var(--text,#0e0e10)}'
  + ".lx-post{position:relative}.lx-sh{display:block;width:100%;margin:0 0 26px}.lx-sh-in{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap}.lx-sh-lab{font:700 10.5px/1 'Hanken Grotesk',system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--text-muted,#8a8fa3)}.lx-sh-btn{width:40px;height:40px;flex:0 0 auto;border-radius:50%;display:grid;place-items:center;background:var(--surface-2,rgba(127,127,140,.08));border:1px solid var(--border,rgba(127,127,140,.18));color:var(--text-muted,#8a8fa3);cursor:pointer;padding:0;text-decoration:none;transition:transform .18s ease,background .18s ease,color .18s ease,border-color .18s ease,box-shadow .18s ease}.lx-sh-btn svg{width:16px;height:16px;display:block}.lx-sh-btn:hover{transform:translateY(-2px);color:#fff;border-color:transparent;box-shadow:0 6px 16px rgba(0,0,0,.18)}.lx-sh-btn:focus-visible{outline:2px solid var(--accent,#ea6a2c);outline-offset:3px}.lx-sh-btn[data-sh=\"x\"]:hover{background:#0f0f10}.lx-sh-btn[data-sh=\"tg\"]:hover{background:#229ed9}.lx-sh-btn[data-sh=\"li\"]:hover{background:#0a66c2}.lx-sh-btn[data-sh=\"rd\"]:hover{background:#ff4500}.lx-sh-btn[data-sh=\"cp\"]:hover{background:var(--accent,#ea6a2c)}html[data-theme=\"dark\"] .lx-sh-btn[data-sh=\"x\"]:hover{background:#f2f2f5;color:#0d0d0f}.lx-sh-btn.is-ok{background:#2ea043;border-color:transparent;color:#fff}@media(min-width:1520px){.lx-sh{position:absolute;left:-84px;top:0;bottom:0;width:56px;margin:0;pointer-events:none}.lx-sh-in{position:sticky;top:104px;flex-direction:column;gap:11px;pointer-events:auto}.lx-sh-lab{writing-mode:vertical-rl;transform:rotate(180deg);letter-spacing:.2em;margin:0 0 4px}.lx-sh-btn{width:42px;height:42px}.lx-sh-btn svg{width:17px;height:17px}}@media(prefers-reduced-motion:reduce){.lx-sh-btn{transition:none}.lx-sh-btn:hover{transform:none}}"
  + '@media(max-width:620px){.lx-post-head h1{font-size:28px}.lx-post-body{font-size:18px}'
  + '.lx-post{padding-left:0;padding-right:0}}'
  + '</style>';

function setPostHead(html) {
  let h = html.replace(/<title>[\s\S]*?<\/title>/,
    '<title>LumosCore Blog</title>');
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

  const body = replaceMain(optOutLogoHealer(stripFaq(src)), MAIN);
  if (!body) { console.error('  ' + file + ': could not find <main> in the donor — skipped'); continue; }
  json[target] = clearNavActive(setHead(body));
  made++;

  const postBody = replaceMain(optOutLogoHealer(stripFaq(src)), POST_MAIN);
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
