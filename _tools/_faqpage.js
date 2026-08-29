// Generates the aggregate FAQ page body from the SAME data the per-page FAQs are built from.
//
// It reads _faq.js as text and evaluates only the three declarations (FEE, WALLETS, FAQ) rather than
// requiring the file, because requiring it would run that transform and rewrite the containers as a
// side effect. Slicing the literals keeps one source of truth without touching a working file: change
// a question in _faq.js and this page changes with it.
//
// Output is _tools/docs/faq.html, which _docs.js then picks up like any other page body. Run this
// BEFORE _docs.js.
const fs = require('fs');

const SRC = __dirname + '/_faq.js';
const OUT = __dirname + '/docs/faq.html';

// Friendly section titles, in the order they should appear. Anything in FAQ not listed here is
// appended under its raw key, so a new FAQ group cannot silently vanish from this page.
const SECTIONS = [
  ['landing', 'About LumosCore'],
  ['dex', 'Trading'],
  ['dex-asset', 'Asset pages'],
  ['amm', 'Liquidity pools'],
  ['amm-pool', 'Individual pools'],
  ['bridge', 'Cross-chain'],
  ['wallet', 'Wallet'],
  ['launch-token', 'Launchpad'],
  ['rewards', 'Rewards'],
  ['lumos-token', 'LUMOS token'],
  ['mcp', 'MCP'],
];
// The asset-overview page was removed from the site (its URLs 301 to Trade-asset), so its questions
// are not reachable anywhere and are deliberately not republished here.
const SKIP = new Set(['asset-overview']);

const src = fs.readFileSync(SRC, 'utf8');
const from = src.indexOf('const FEE =');
const braceEnd = src.indexOf('\n};', src.indexOf('const FAQ = {'));
if (from < 0 || braceEnd < 0) {
  console.error('faqpage: could not locate the FEE/FAQ declarations in _faq.js — nothing written');
  process.exit(1);
}
let FAQ;
try {
  FAQ = new Function(src.slice(from, braceEnd + 3) + '\nreturn FAQ;')();
} catch (e) {
  console.error('faqpage: could not evaluate the FAQ literal — ' + ((e && e.message) || e));
  process.exit(1);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const order = SECTIONS.map(([k]) => k);
for (const k of Object.keys(FAQ)) if (!order.includes(k) && !SKIP.has(k)) SECTIONS.push([k, k]);

// FEE and WALLETS are shared constants reused across several page FAQs. On the per-page FAQs that is
// correct; collected onto one page it would be the same answer four times, so first occurrence wins.
const seen = new Set();
// The page description already says what this page is, so the opening line adds something else:
// where each section came from and where to go for more.
let out = '<p>These are the questions asked on the pages themselves, gathered here so you can search '
  + 'them in one place. Each section names the documentation that covers the same ground properly, '
  + 'and anything still unanswered is worth sending to <a href="/support">support</a>.</p>\n\n';
let total = 0, deduped = 0;

// Deep-linking into the docs from each section keeps this page an index rather than a dead end.
const DOCS = {
  'About LumosCore': '/docs/introduction',
  'Trading': '/docs/swaps',
  'Asset pages': '/docs/verification',
  'Liquidity pools': '/docs/liquidity-pools',
  'Individual pools': '/docs/liquidity-pools',
  'Cross-chain': '/docs/cross-chain',
  'Wallet': '/docs/wallet',
  'Launchpad': '/docs/launch-a-token',
  'Rewards': '/docs/rewards',
  'LUMOS token': '/docs/fees',
};

for (const [key, title] of SECTIONS) {
  const list = FAQ[key];
  if (!Array.isArray(list) || !list.length || SKIP.has(key)) continue;
  const items = [];
  for (const [q, a] of list) {
    const sig = String(q).trim().toLowerCase();
    if (seen.has(sig)) { deduped++; continue; }
    seen.add(sig);
    items.push('<details class="dc-qa"><summary>' + esc(q) + '</summary>'
      + '<div class="dc-qa-a"><p>' + esc(a) + '</p></div></details>');
    total++;
  }
  if (!items.length) continue;
  out += '<h2>' + esc(title) + '</h2>\n';
  if (DOCS[title]) {
    out += '<p class="dc-qa-more">Covered in depth in <a href="' + DOCS[title] + '">the docs</a>.</p>\n';
  }
  out += '<div class="dc-qa-set">' + items.join('') + '</div>\n\n';
}

fs.writeFileSync(OUT, out.trim() + '\n', 'utf8');
console.log('faq page: ' + total + ' questions across ' + SECTIONS.filter(([k]) => FAQ[k] && !SKIP.has(k)).length
  + ' sections (' + deduped + ' duplicates folded) -> _tools/docs/faq.html');
