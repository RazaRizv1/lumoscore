// /docs — the LumosCore documentation site.
//
// Built the same way as _whitepaper.js and _legalpages.js: every page is cloned from an
// already-built page (MCP) so it inherits the working shell -- header, nav, theme toggle, footer and
// the scripts other transforms inject -- and this only replaces what sits inside <main>.
//
// Page bodies live in _tools/docs/<slug>.html, one file each. PAGES below is the single source of
// order: it drives the sidebar, the prev/next pager, the routes you must add to extract_site.js, and
// the index cards. Adding a page means dropping in the file and adding a line here.
//
// The sidebar, the on-this-page rail and the pager are all GENERATED, not authored per page. Anything
// hand-maintained across sixteen pages goes stale on the first rename.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// slug, title, group, one-line description (used on the index cards and as the meta description)
const PAGES = [
  ['introduction',     'Introduction',        'Start here',
    'What LumosCore is, what runs on it today, and how the non-custodial model works.'],
  ['connect-a-wallet', 'Connect a wallet',    'Start here',
    'The five supported Stellar wallets, how connecting works, and what the site can and cannot do.'],
  ['fees',             'Fees',                'Start here',
    'What LumosCore charges, the LUMOS discount tier, and the costs that are the network’s.'],

  ['swaps',            'Swaps',               'Using LumosCore',
    'Trading assets on Stellar: routing, price, slippage and what you approve before signing.'],
  ['limit-orders',     'Limit orders',        'Using LumosCore',
    'Resting orders on the Stellar order book, why they are free, and how to manage them.'],
  ['liquidity-pools',  'Liquidity pools',     'Using LumosCore',
    'Adding and withdrawing liquidity, creating a pool, and the risks of providing it.'],
  ['cross-chain',      'Cross-chain',         'Using LumosCore',
    'Moving USDC between Stellar and eight networks over Circle’s CCTP.'],
  ['wallet',           'Wallet',              'Using LumosCore',
    'Balances, activity, sending and receiving — without giving up custody.'],
  ['trustlines',       'Trustlines',          'Using LumosCore',
    'Why Stellar needs a trustline before you can hold an asset, and what it reserves.'],
  ['rewards',          'Rewards',             'Using LumosCore',
    'The three LUMOS reward programmes, who is eligible, and when rounds pay.'],

  ['launch-a-token',   'Launch a token',      'For issuers',
    'Issuing an asset on Stellar mainnet: the flow, the flat $25 cost and what you receive.'],
  ['asset-metadata',   'Asset metadata',      'For issuers',
    'The stellar.toml file, what LumosCore reads from it, and how to publish a logo.'],
  ['verification',     'Asset verification',  'For issuers',
    'How the domain handshake works, what the mark means, and what it deliberately does not.'],
  ['curated-listing',  'Curated listing',     'For issuers',
    'Applying for a curated listing, what review covers, and the refund if it is declined.'],

  ['security',         'Security',            'Reference',
    'The custody model, what we will never ask for, and the risks that remain.'],
  ['troubleshooting',  'Troubleshooting',     'Reference',
    'The errors people actually hit, what each one means, and how to clear it.'],
];

const TITLE_SUFFIX = ' | LumosCore Docs';
const UPDATED = 'Last updated 29 August 2026';

// ---- shared shell helpers (same contracts as _whitepaper.js) --------------------------------------
function replaceMain(html, inner) {
  const open = html.indexOf('<main');
  if (open < 0) return null;
  const gt = html.indexOf('>', open);
  const close = html.lastIndexOf('</main>');
  if (gt < 0 || close < 0 || close < gt) return null;
  return html.slice(0, gt + 1) + inner + html.slice(close);
}
function clearNavActive(html) {
  return html.replace(/(<a[^>]*class=")nx-item active(")/g, '$1nx-item$2')
             .replace(/(<a[^>]*class=")nx-item active( [^"]*")/g, '$1nx-item$2');
}
function stripFaq(html) {
  let h = html;
  const cut = (open, close) => {
    const i = h.indexOf(open); if (i < 0) return false;
    const j = h.indexOf(close, i); if (j < 0) return false;
    h = h.slice(0, i) + h.slice(j + close.length); return true;
  };
  cut('<section class="lx-faq"', '</section>');
  cut('<script type="application/ld+json" id="lx-faq-ld">', '</scr' + 'ipt>');
  cut('<style id="lx-faq-css">', '</style>');
  return h;
}
function setHead(html, title, desc, style) {
  let h = html.replace(/<title>[\s\S]*?<\/title>/, '<title>' + title + '</title>');
  h = h.replace(/<meta name="description" content="[^"]*">/,
    '<meta name="description" content="' + desc.replace(/"/g, '&quot;') + '">');
  const hi = h.indexOf('</head>');
  return hi < 0 ? h : h.slice(0, hi) + style + h.slice(hi);
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---- generated furniture --------------------------------------------------------------------------
function sidebar(current) {
  let out = '<nav class="dc-nav">';
  let group = null;
  for (const [slug, title, grp] of PAGES) {
    if (grp !== group) {
      if (group !== null) out += '</div>';
      out += '<div class="dc-nav-group"><p class="dc-nav-label">' + esc(grp) + '</p>';
      group = grp;
    }
    out += '<a href="/docs/' + slug + '"' + (slug === current ? ' class="dc-on"' : '')
        + '>' + esc(title) + '</a>';
  }
  return out + '</div></nav>';
}
// The rail is read off the page's own <h2>s, so it cannot drift from the content. Headings are given
// ids here too -- authoring them by hand in sixteen files invites duplicates and typos.
function withAnchors(body) {
  const seen = new Map();
  const toc = [];
  const out = body.replace(/<h2>([\s\S]*?)<\/h2>/g, (m, inner) => {
    const text = inner.replace(/<[^>]+>/g, '').trim();
    let id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
    const n = (seen.get(id) || 0) + 1;
    seen.set(id, n);
    if (n > 1) id += '-' + n;
    toc.push([id, text]);
    return '<h2 id="' + id + '">' + inner + '</h2>';
  });
  return { body: out, toc };
}
function tocRail(toc) {
  if (!toc.length) return '<div class="dc-toc"></div>';
  return '<div class="dc-toc"><p class="dc-toc-h">On this page</p>'
    + toc.map(([id, t]) => '<a href="#' + id + '">' + esc(t) + '</a>').join('') + '</div>';
}
function pager(i) {
  const prev = i > 0 ? PAGES[i - 1] : null;
  const next = i < PAGES.length - 1 ? PAGES[i + 1] : null;
  if (!prev && !next) return '';
  let out = '<div class="dc-pager">';
  if (prev) out += '<a class="dc-page" href="/docs/' + prev[0] + '">'
    + '<span class="dc-page-k">Previous</span><span class="dc-page-t">' + esc(prev[1]) + '</span></a>';
  if (next) out += '<a class="dc-page dc-next" href="/docs/' + next[0] + '">'
    + '<span class="dc-page-k">Next</span><span class="dc-page-t">' + esc(next[1]) + '</span></a>';
  return out + '</div>';
}

// ---- content ---------------------------------------------------------------------------------------
let CSS;
try { CSS = fs.readFileSync(__dirname + '/docs.css', 'utf8'); }
catch (e) { console.error('docs: docs.css missing — nothing written'); process.exit(1); }
const STYLE = '<style id="lx-docs-css">' + CSS.replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map((l) => l.trim()).filter(Boolean).join('') + '</style>';

const BODIES = new Map();
for (const [slug] of PAGES) {
  try { BODIES.set(slug, fs.readFileSync(__dirname + '/docs/' + slug + '.html', 'utf8').trim()); }
  catch (e) { console.error('  docs: missing body for ' + slug + ' — page skipped'); }
}
if (!BODIES.size) { console.error('docs: no page bodies found — nothing written'); process.exit(1); }

// The footer has carried "Docs" and "Documentation" links pointing at "#" since the design was
// finalised. Both resolve here.
const FOOTER = [
  [/(<a[^>]*)href="#"([^>]*>\s*Docs\s*<\/a>)/gi, '$1href="/docs"$2'],
  [/(<a[^>]*)href="#"([^>]*>\s*Documentation\s*<\/a>)/gi, '$1href="/docs"$2'],
];

let made = 0, wired = 0;
for (const [dev, donor, suffix] of [
  ['desktop', 'lumoscore-mcp.html', '.html'],
  ['mobile', 'lumoscore-mcp-mobile.html', '-mobile.html'],
]) {
  const file = 'lumoscore-aptos-' + dev + '.html';
  let data; try { data = read(file); } catch (e) { continue; }
  let json, s, e; try { ({ json, s, e } = getContents(data)); } catch (err) { continue; }

  const src = json[donor];
  if (typeof src !== 'string') {
    console.error('  ' + file + ': donor ' + donor + ' missing — skipped'); continue;
  }
  const shell = stripFaq(src);

  PAGES.forEach(([slug, title, group, desc], i) => {
    const raw = BODIES.get(slug);
    if (!raw) return;
    const { body, toc } = withAnchors(raw);
    const main = '<div class="lxdc">'
      + sidebar(slug)
      + '<div class="dc-main">'
      + '<p class="dc-crumb">' + esc(group) + '</p>'
      + '<h1>' + esc(title) + '</h1>'
      + '<p class="dc-sub">' + esc(desc) + '</p>'
      + body
      + pager(i)
      + '<p class="dc-updated">' + UPDATED + '</p>'
      + '</div>'
      + tocRail(toc)
      + '</div>';
    const page = replaceMain(shell, main);
    if (!page) { console.error('  ' + file + ': no <main> in donor — ' + slug + ' skipped'); return; }
    json['lumoscore-docs-' + slug + suffix] =
      clearNavActive(setHead(page, title + TITLE_SUFFIX, desc, STYLE));
    made++;
  });

  for (const key of Object.keys(json)) {
    let h = json[key]; const before = h;
    for (const [re, to] of FOOTER) h = h.replace(re, to);
    if (h !== before) { json[key] = h; wired++; }
  }

  const ser = JSON.stringify(json).split('</').join('<' + B + '/');
  fs.writeFileSync(file, data.slice(0, s) + ser + data.slice(e), 'utf8');
}
console.log('docs: built ' + made + ' page(s), wired footer links on ' + wired + ' page keys');
console.log('docs: routes needed — /docs -> lumoscore-docs-introduction.html, plus /docs/<slug> for '
  + PAGES.length + ' slugs');
