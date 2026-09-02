// Landing page polish: product cards, networks strip, FAQ.
//
// NAMES. DEX -> Trade, AMM Pools -> Liquidity Pools, LUMOS Rewards -> Rewards, My Wallet -> Wallet,
// Cross-Chain Bridge -> Cross-Chain. These now match what the nav calls them, so the landing page and
// the app stop using two vocabularies for the same six things.
//
// CARDS. Five of the six were plain <div>s, so the only clickable product on the page was Wallet --
// on a page whose whole job is to route people. All six are links now, each to its real clean URL,
// with an "Open" affordance that moves on hover. Each card also carries its own accent, taken from the
// icon tile it already had, so the grid reads as six distinct products rather than six grey boxes:
// the border, the glow, the corner wash and the arrow all pick it up.
//
// BRIDGE COPY. The card read "Stellar <-> Stellar live, Stellar and more coming throughout 2026",
// which is the donor design's "Aptos <-> Aptos live" with the chain name correctly substituted into a
// sentence that never made sense. Replaced with what the bridge actually does. Eight, not ten:
// _cctp.js carries markup for Solana and Sui, but the bridge stylesheet hides both with
// display:none!important, so they are not offered. Eight is also what the bridge page's own meta
// description and the FAQ already say.
//
// NETWORKS + FAQ. Same treatment: real surfaces, real hover, and a live marker that does not depend on
// colour alone. The FAQ answers were bare text in a grid; each is a card now, which is what makes a
// wall of 51 answers readable.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const MARK = 'lx-landpolish';

// icon class -> [route, accent, rgb for glow]
const CARDS = {
  dex: ['/trade/stellar', '#8b7bff', '139,123,255'],
  amm: ['/pools/stellar', '#34d37a', '52,211,122'],
  bridge: ['/bridge', '#a855f7', '168,85,247'],
  rewards: ['/rewards', '#ffb547', '255,181,71'],
  wallet: ['/wallet', '#ec4899', '236,72,153'],
  launchpad: ['/launchpad', '#ea6a2c', '234,106,44'],
};

const RENAMES = [
  ['<h3>DEX</h3>', '<h3>Trade</h3>'],
  ['<h3>AMM Pools</h3>', '<h3>Liquidity Pools</h3>'],
  ['<h3>LUMOS Rewards</h3>', '<h3>Rewards</h3>'],
  ['<h3>My Wallet</h3>', '<h3>Wallet</h3>'],
  ['<h3>Cross-Chain Bridge</h3>', '<h3>Cross-Chain</h3>'],
];

const BRIDGE_COPY = 'Move native USDC between Stellar and eight other chains — Ethereum, Base, '
  + 'Arbitrum, Optimism, Polygon, Avalanche, Linea and World Chain — using Circle CCTP.';

const ARROW = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" '
  + 'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

function pcGo(label) {
  return '<span class="pc-go">' + label + ARROW + '</span>';
}

// Nesting-aware: a card contains divs, so the first </div> is not its own.
function elRange(html, startIdx, tag) {
  const re = new RegExp('<\\/?' + tag + '\\b', 'g');
  re.lastIndex = startIdx;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    if (m[0].charAt(1) === '/') { depth--; if (depth === 0) return { start: startIdx, end: html.indexOf('>', m.index) + 1 }; }
    else depth++;
  }
  return null;
}

const CSS = '<style id="lx-landpolish">'
  // ---------- product cards
  + '.products-grid{gap:22px}'
  + '.product-card{position:relative;overflow:hidden;text-decoration:none;color:inherit;'
  + 'border-radius:20px;padding:30px 28px 24px;'
  + 'background:linear-gradient(180deg,var(--surface) 0%,var(--bg-elev,var(--surface)) 100%);'
  + 'border:1px solid var(--border);'
  + 'transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease}'
  // The wash sits behind the content and only appears on hover, so a resting grid stays calm.
  + '.product-card::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:0;'
  + 'background:radial-gradient(420px 220px at 8% 0%,rgba(var(--pc-rgb),.16),transparent 70%);'
  + 'transition:opacity .22s ease}'
  + '.product-card:hover{transform:translateY(-5px);border-color:rgba(var(--pc-rgb),.55);'
  + 'box-shadow:0 26px 50px -30px rgba(var(--pc-rgb),.75),0 2px 10px -6px rgba(0,0,0,.5)}'
  + '.product-card:hover::before{opacity:1}'
  + '.product-card:focus-visible{outline:2px solid var(--pc);outline-offset:3px}'
  + '.product-card>*{position:relative;z-index:1}'
  + '.product-card .ic-prod{width:54px;height:54px;border-radius:15px;margin-bottom:22px;'
  + 'transition:transform .2s ease}'
  + '.product-card:hover .ic-prod{transform:scale(1.06) rotate(-3deg)}'
  + '.product-card h3{font-size:26px;letter-spacing:-.5px;margin-bottom:10px}'
  + '.product-card p{font-size:16.5px;line-height:1.6;margin-bottom:20px}'
  // The affordance: present but quiet until the card is hovered.
  + '.pc-go{display:inline-flex;align-items:center;gap:7px;margin-top:auto;'
  + 'font-size:13.5px;font-weight:700;letter-spacing:.02em;color:var(--pc);opacity:.75;'
  + 'transition:opacity .2s ease,gap .2s ease}'
  + '.pc-go svg{transition:transform .2s ease}'
  + '.product-card:hover .pc-go{opacity:1;gap:11px}'
  + '.product-card:hover .pc-go svg{transform:translateX(3px)}'
  // ---------- networks
  + '.lx-netline{padding:56px 0 60px}'
  + '.lx-net-card{padding:18px 30px 18px 20px;border-radius:20px;'
  + 'background:linear-gradient(180deg,var(--surface) 0%,var(--bg-elev,var(--surface)) 100%)}'
  + '.lx-net-card:hover{transform:translateY(-4px)}'
  + '.lx-net-mark{width:48px;height:48px;border-radius:15px;'
  + 'box-shadow:inset 0 0 0 1px var(--border)}'
  + '.lx-net-mark svg{width:30px;height:30px}'
  + '.lx-net-txt b{font-size:18px}'
  + '.lx-net-card.is-live{border-color:rgba(52,211,153,.45)}'
  + '.lx-net-card.is-live .lx-net-mark{box-shadow:inset 0 0 0 1px rgba(52,211,153,.5),0 0 22px -6px rgba(52,211,153,.5)}'
  + '.lx-net-card.is-live:hover{border-color:rgba(52,211,153,.75);box-shadow:0 20px 40px -26px rgba(52,211,153,.7)}'
  + '.lx-net-card.is-next:hover{border-color:var(--accent);box-shadow:0 20px 40px -26px rgba(234,106,44,.6)}'
  + '.lx-net-card.is-soon{opacity:.72}'
  + '.lx-net-card.is-soon:hover{opacity:.92;border-color:var(--border-strong,var(--border));transform:translateY(-2px)}'
  // ---------- FAQ
  + '.lx-faq h2{margin-bottom:26px}'
  + '.lx-faq .lx-faqpane.is-on{gap:16px}'
  + '.lx-faq .lx-faqpane>div{position:relative;background:var(--surface);'
  + 'border:1px solid var(--border);border-radius:16px;padding:22px 24px 24px;'
  + 'transition:border-color .18s ease,transform .18s ease,box-shadow .18s ease}'
  + '.lx-faq .lx-faqpane>div:hover{border-color:var(--accent);transform:translateY(-2px);'
  + 'box-shadow:0 20px 40px -30px rgba(234,106,44,.6)}'
  // A short accent rule above each question does the work a heavier card border would.
  + '.lx-faq .lx-faqpane>div::before{content:"";position:absolute;left:24px;top:0;width:26px;height:2px;'
  + 'background:var(--accent);border-radius:0 0 2px 2px;opacity:0;transition:opacity .18s ease}'
  + '.lx-faq .lx-faqpane>div:hover::before{opacity:1}'
  + '.lx-faq-q{font-size:16.5px;margin-bottom:9px}'
  + '.lx-faq-a{font-size:15px;line-height:1.62}'
  + '.lx-faqtab{padding:11px 20px}'
  + '@media (max-width:900px){.product-card{padding:24px 22px 20px}'
  + '.product-card h3{font-size:22px}.product-card p{font-size:15.5px}'
  + '.lx-net-card{padding:14px 20px 14px 15px}.lx-net-mark{width:40px;height:40px}'
  + '.lx-net-mark svg{width:25px;height:25px}.lx-net-txt b{font-size:16px}'
  + '.lx-faq .lx-faqpane>div{padding:18px 18px 20px}}'
  + '@media (prefers-reduced-motion:reduce){.product-card,.product-card .ic-prod,.pc-go,.pc-go svg,'
  + '.lx-net-card,.lx-faq .lx-faqpane>div{transition:none}'
  + '.product-card:hover,.lx-net-card:hover,.lx-faq .lx-faqpane>div:hover{transform:none}'
  + '.product-card:hover .ic-prod{transform:none}}'
  + '</st' + 'yle>';

const PAGES = [
  { file: 'lumoscore-aptos-desktop.html', key: 'lumoscore-landing.html' },
  { file: 'lumoscore-aptos-mobile.html', key: 'lumoscore-landing-mobile.html' }
];

const problems = [];
const staged = [];

for (const p of PAGES) {
  const data = read(p.file);
  const { json, s, e } = getContents(data);
  let html = json[p.key];
  if (html == null) { problems.push(p.key + ': missing'); continue; }
  // Opt the cards out of the landing click interceptor, checked on EVERY run rather than behind the
  // marker below. That handler matches an element's text against the nav labels and calls
  // preventDefault + stopImmediatePropagation before any anchor gets to act, so a card titled "Trade"
  // or "Wallet" was swallowed: measured, the click neither navigated nor opened the network chooser,
  // it simply did nothing. With the flag the handler bails and the anchor's own href does the work.
  // The replace only matches cards that lack the attribute, so re-running adds nothing.
  const beforePatch = html;
  html = html.replace(/<a class="product-card lxpc"/g, '<a data-lxnonav="1" class="product-card lxpc"');

  // The mobile landing's "See what's trending" block, which desktop never had. It was left in place
  // earlier on the assumption that _trending.js fed it, and removing an element a data layer still
  // queries is how this codebase produces silent TypeErrors. That assumption was wrong: _trending.js
  // injects only on lumoscore-dex-asset.html, and the built mobile landing contains no trendingList,
  // no trending-row and no lx-tready -- nothing reads it. What it actually held was donor filler,
  // chain tabs reading "Aptos 7 / Aptos 5 / Aptos Soon" and no tokens, under a heading promising
  // "real tokens, real prices, real volume". Also checked on every run rather than behind the marker,
  // and a no-op on desktop, which has no such section.
  const ti = html.indexOf('<section class="block trending-block"');
  if (ti >= 0) {
    const tr = elRange(html, ti, 'section');
    if (!tr) { problems.push(p.key + ': could not close the trending section'); continue; }
    html = html.slice(0, tr.start) + html.slice(tr.end);
  }

  // Mobile's product cards carried a .pc-stats row that desktop's never had, and the figures in it are
  // static markup, not data: "Listed 482", "Trades 24h 2,728", "Vol 24h $72.4K", "Pools 142". Nothing
  // updates them, so the phone was showing invented platform metrics as though they were live.
  //
  // Scoped to the inside of a product card rather than a global replace: of the nine
  // <div class="pc-stats"> literals on that page, four sit inside JS strings that build a different
  // component, and a blanket strip would have cut them out of the script.
  let statsRemoved = 0;
  for (let guard = 0; guard < 20; guard++) {
    let hit = -1, cardRange = null;
    let from = 0;
    while (from < html.length) {
      const ci = html.indexOf('class="product-card lxpc"', from);
      if (ci < 0) break;
      const open = html.lastIndexOf('<a', ci);
      const r = elRange(html, open, 'a');
      if (!r) { from = ci + 10; continue; }
      const si = html.indexOf('<div class="pc-stats">', r.start);
      if (si >= 0 && si < r.end) { hit = si; cardRange = r; break; }
      from = r.end;
    }
    if (hit < 0) break;
    const sr = elRange(html, hit, 'div');
    if (!sr || sr.end > cardRange.end) { problems.push(p.key + ': could not bound a pc-stats block'); break; }
    html = html.slice(0, sr.start) + html.slice(sr.end);
    statsRemoved++;
  }
  if (problems.length) continue;

  const patched = html !== beforePatch;

  if (html.indexOf(MARK) >= 0) {
    if (patched) {
      json[p.key] = html;
      staged.push({ file: p.file, data, s, e, json, key: p.key, converted: 0, patchOnly: true });
      console.log('  ' + p.key + ': already polished — cards opted out of the nav interceptor');
    } else {
      console.log('  ' + p.key + ': already polished, skipping');
    }
    continue;
  }

  // ---- renames, each asserted
  for (const [from, to] of RENAMES) {
    const n = html.split(from).length - 1;
    if (n !== 1) { problems.push(p.key + ': expected 1 of ' + from + ', found ' + n); continue; }
    html = html.replace(from, to);
  }
  if (problems.length) continue;

  // ---- bridge copy
  const bi = html.indexOf('<h3>Cross-Chain</h3>');
  if (bi < 0) { problems.push(p.key + ': renamed bridge card not found'); continue; }
  const ps = html.indexOf('<p>', bi), pe = html.indexOf('</p>', ps);
  if (ps < 0 || pe < 0) { problems.push(p.key + ': bridge card has no paragraph'); continue; }
  // Assert on the chain-agnostic half of the sentence. The container still says "Aptos <-> Aptos
  // live" -- the substitution to Stellar happens at build time -- so a guard looking for "Stellar"
  // here fails against the very text it is meant to be replacing.
  if (html.slice(ps, pe).indexOf('Move assets between supported chains') < 0) {
    problems.push(p.key + ': bridge copy is not the donor sentence this expects to replace'); continue;
  }
  html = html.slice(0, ps + 3) + BRIDGE_COPY + html.slice(pe);

  // ---- every card becomes a link carrying its own accent
  let converted = 0;
  for (let guard = 0; guard < 12; guard++) {
    const m = /<(div|a)([^>]*)class="product-card"([^>]*)>/.exec(html);
    if (!m) break;
    const tag = m[1], at = m.index;
    const r = elRange(html, at, tag);
    if (!r) { problems.push(p.key + ': could not close a product card'); break; }
    let inner = html.slice(html.indexOf('>', at) + 1, r.end - (tag.length + 3));
    const kind = (inner.match(/ic-prod ([a-z]+)/) || [])[1];
    if (!kind || !CARDS[kind]) { problems.push(p.key + ': card with unknown icon kind ' + kind); break; }
    const [href, accent, rgb] = CARDS[kind];
    // The "Open ->" label is gone: the whole card is the link, so the label was restating the
    // affordance rather than adding one, and it fought the centred icon/title layout the cards now
    // use. The strip stays so re-running this removes any left by an earlier build; pcGo() and the
    // .pc-go rules stay defined and unused rather than being torn out of a working stylesheet.
    inner = inner.replace(/<span class="pc-go">[\s\S]*?<\/span>/g, '');
    html = html.slice(0, at)
      + '<a data-lxnonav="1" class="product-card lxpc" data-pc="' + kind + '" href="' + href + '"'
      + ' style="--pc:' + accent + ';--pc-rgb:' + rgb + '">' + inner + '</a>'
      + html.slice(r.end);
    converted++;
  }
  if (problems.length) continue;
  if (converted !== 6) { problems.push(p.key + ': expected 6 product cards, converted ' + converted); continue; }

  const bo = html.lastIndexOf('</body>');
  html = bo >= 0 ? html.slice(0, bo) + CSS + html.slice(bo) : html + CSS;

  json[p.key] = html;
  staged.push({ file: p.file, data, s, e, json, key: p.key, converted });
}

if (problems.length) {
  console.error('landing polish: ABORT — nothing written.');
  problems.forEach(x => console.error('  ' + x));
  process.exit(1);
}
for (const st of staged) {
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.key + (st.patchOnly
    ? ': nav opt-out written'
    : ': 5 renamed, bridge copy fixed, ' + st.converted + ' cards linked and styled'));
}
console.log('landing polish: done on ' + staged.length + ' page(s)');
