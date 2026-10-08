// Phase 1 of the Aptos residue: the shared-overlay COPY, fixed in the markup instead of at runtime.
//
// The site ships from the Aptos design container and corrects the chain's name in the browser. A human
// therefore sees "Stellar" everywhere and the served HTML still says "Aptos" -- 1,141 times across 94 of
// 97 pages. That was invisible until an assistant connected through LumosCore MCP read the markup and
// told RAZA the Pools page "displays conflicting Stellar and Aptos data". Machines read markup.
//
// WHY EXACT STRINGS AND NOT A SWEEP. Two reasons, both measured:
//   * Some Aptos strings are CORRECT. LumosCore is multi-chain and its chain tables name Aptos as
//     Aptos -- NAMES={stellar:'Stellar', ..., aptos:'Aptos', ...} is right. Roughly 42 occurrences are
//     like this. A /Aptos/g sweep would corrupt every one of them. The tell is the KEY on the left, not
//     the word on the right, which no simple regex can see.
//   * Much of what the runtime "corrects" is not a rename at all. Diffing the static markup against the
//     settled DOM on /docs/fees, "25,420.18 APT" becomes "0.00 XLM" -- that is a real balance arriving,
//     not a word being swapped. Baking the settled text would freeze one visitor's data into the page.
//
// So this does only the part that is unambiguously a rename: whole phrases from the two shared overlays
// that ship on nearly every page -- the Send/Receive modal and the search popup. Each string below was
// checked to exist ONLY in the container (no transform emits any of them, so nothing re-introduces them)
// and, where the node renders, to match what the runtime already puts there:
//
//     "Trustlines let you hold non-native assets on Aptos."  ->  runtime shows "... on Stellar."
//     "Assets on Aptos"                                      ->  runtime shows "Assets on Stellar"
//     "Aptos wallet"                                         ->  runtime shows "Stellar wallet"
//
// which makes this a no-op for every human and a fix for every machine.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const FILES = ['lumoscore-aptos-desktop.html', 'lumoscore-aptos-mobile.html'];

// ORDER IS LOAD-BEARING: longest first. "Aptos wallet" -> "Stellar wallet" applied first would turn
// "Choose an Aptos wallet to continue" into "Choose an Stellar wallet", so the phrase that carries the
// article is rewritten whole, before the bare label is touched.
const SUBS = [
  ['Choose an Aptos wallet to continue', 'Choose a Stellar wallet to continue'],
  ['Only send APT and Aptos-based assets to this address', 'Only send XLM and Stellar-based assets to this address'],
  ['Trustlines let you hold non-native assets on Aptos', 'Trustlines let you hold non-native assets on Stellar'],
  ['Your Aptos address', 'Your Stellar address'],
  ['Assets on Aptos', 'Assets on Stellar'],
  ['Aptos wallet', 'Stellar wallet'],

  // THE CHAIN SLOT IN THE TRADE HERO (RAZA 2026-10-08, approving the fix). `<h1>Explore the
  // <em>Aptos</em> DEX</h1>` — the inner element is the slot the runtime re-skin rewrites to the
  // connected chain, so a human has always read "Explore the Stellar DEX" and every crawler has read
  // Aptos. That is this transform's whole remit: the rename is unambiguous, and after it the runtime
  // rewrites Stellar to Stellar, a no-op.
  //
  // MATCHED WITH THE TAGS, not on the bare word, which is the discipline the header above sets out —
  // roughly 42 Aptos strings in these containers are CORRECT and a /Aptos/g sweep would corrupt every
  // one. Measured before adding: these three markup-exact forms occur 3 times in total, all of them
  // the Trade hero (desktop, dark, mobile). Mobile spells the same slot with a span.
  ['<em>Aptos</em>', '<em>Stellar</em>'],
  ['<span class="hl">Aptos</span>', '<span class="hl">Stellar</span>'],

  // ---- PHASE 2: the chain's name in the copy, verified hit by hit ------------------------------
  //
  // RAZA 2026-10-08, with the count from his own audit: 96 of 97 built pages carry "Aptos"
  // somewhere, and a crawler reads the served markup, not what the runtime re-skin puts there.
  // The inventory behind this batch: 415 occurrences, 73 distinct visible phrases, 10 attributes.
  //
  // EVERY PAIR BELOW WAS COUNTED IN THE CONTAINERS BEFORE IT WAS WRITTEN -- 30 pairs, 144
  // occurrences, no rule matching zero. A pair that matches nothing is a silent no-op that reads
  // like a fix, which is the failure this file's header already warns about.
  //
  // WHAT IS DELIBERATELY NOT HERE, because a rename would make it wrong rather than right:
  //   * sample DATA -- "Aptos Coin", "$APT", "CELL / APT", "Aptos - 1.48% of supply". These are the
  //     design's mock rows, replaced at runtime by the real asset. Renaming the chain inside a made
  //     up holding does not make the holding true, it just hides that it is mock.
  //   * "Aptos DEX charges roughly 0.0001 APT per operation" and "trades natively on the Aptos
  //     Decentralized Exchange against APT" -- both carry a FIGURE and a pair. Swapping the chain
  //     name alone leaves a Stellar sentence quoting an Aptos fee; changing the number too is a
  //     factual edit, not a copy pass.
  //   * "Powered by Aptos Wallet Standard" and the per-network label map beside it -- Stellar has no
  //     "Wallet Standard" to name, so the right text is a product decision, not a substitution.
  //   * the two search-popup chain pills -- their label disagrees with their own data-chain, which
  //     is a component bug rather than a word.
  ['Discover early gems on Aptos.', 'Discover early gems on Stellar.'],
  ['How the Aptos DEX works', 'How the Stellar DEX works'],
  ['Trade any Aptos-issued asset', 'Trade any Stellar-issued asset'],
  ['Initialize a new liquidity pool on Aptos AMM', 'Initialize a new liquidity pool on Stellar AMM'],
  ['Initialize a new pool on Aptos AMM', 'Initialize a new pool on Stellar AMM'],
  ["Pools run on Aptos's native AMM.", "Pools run on Stellar's native AMM."],
  ["Discover, trade, and launch tokens on Aptos's decentralized exchange.", "Discover, trade, and launch tokens on Stellar's decentralized exchange."],
  ['DEX on Aptos.', 'DEX on Stellar.'],
  ['Every trade settles peer-to-peer on Aptos.', 'Every trade settles peer-to-peer on Stellar.'],
  ['Launch tokens on the Aptos DEX.', 'Launch tokens on the Stellar DEX.'],
  ['Trade pairs on Aptos DEX.', 'Trade pairs on Stellar DEX.'],
  ['Launch tokens directly on the Aptos DEX.', 'Launch tokens directly on the Stellar DEX.'],
  ['Your token is now live on the Aptos network', 'Your token is now live on the Stellar network'],
  ['Once your token is minted on the Aptos network', 'Once your token is minted on the Stellar network'],
  ['Asset issued on Aptos', 'Asset issued on Stellar'],
  ['New Mints on Aptos', 'New Mints on Stellar'],
  ['Create another token on Aptos', 'Create another token on Stellar'],
  ['Native utility token \u00b7 live on Aptos', 'Native utility token \u00b7 live on Stellar'],
  ['Aptos distributions are anchored to this same contract.', 'Stellar distributions are anchored to this same contract.'],
  ["Choose the chains you're bridging between (Aptos and your destination network)", "Choose the chains you're bridging between (Stellar and your destination network)"],
  ['Aptos automatically finds the cheapest route', 'Stellar automatically finds the cheapest route'],
  ['digital representation of the US Dollar on the Aptos Decentralized Exchange.', 'digital representation of the US Dollar on the Stellar Decentralized Exchange.'],
  // Covers the bare text and the aria-label/data-tooltip that wrap it -- we link stellar.expert.
  ['View on Aptos Explorer', 'View on Stellar Explorer'],
  ['aria-label="Aptos AMM"', 'aria-label="Stellar AMM"'],
  ['aria-label="Aptos DEX"', 'aria-label="Stellar DEX"'],
  ['title="One-time Aptos asset issuance fee"', 'title="One-time Stellar asset issuance fee"'],
  // Labels that contradict the class sitting on the very same element.
  ['<span class="chain-pill stellar">Aptos</span>', '<span class="chain-pill stellar">Stellar</span>'],
  ['<span class="chain-pill xrpl">Aptos</span>', '<span class="chain-pill xrpl">XRP Ledger</span>'],
  ['<span class="dot stellar"></span>Aptos', '<span class="dot stellar"></span>Stellar'],
  ['Connected \u00b7 Aptos', 'Connected \u00b7 Stellar'],

  // ---- the search popup's chain filters, whose labels contradict their own data-chain ----------
  //
  // Two pills, on 88 and 85 pages, together about half of everything still saying "Aptos". The
  // first is data-chain="xrpl" labelled Aptos; the second is data-chain="stellar", also labelled
  // Aptos. The wiring is right -- the live layer filters by the id -- only the roster is wrong,
  // which is the same shape as the sign-in chooser.
  //
  // ANCHORED ON WHAT IS ADJACENT, NOT ON THE BUTTON. Each pill opens thousands of characters
  // earlier because its icon is an inline base64 image, so "the Aptos inside an sp-filter-pill" is
  // not expressible as a plain string. Verified instead by walking back 12,000 characters from
  // every match: 88/88 for the xrpl pill, 51/51 desktop and 40/40 for the stellar one. An earlier
  // candidate anchor was dropped for failing exactly this -- 3 of its matches were in an lt-panel.
  ['<span class="ch-ico xrpl">X</span> Aptos', '<span class="ch-ico xrpl">X</span> XRP Ledger'],
  ['</span></span> Aptos <span style="opacity:0.7;font-weight:600">(',
    '</span></span> Stellar <span style="opacity:0.7;font-weight:600">('],
  ['</span></span> Aptos' + String.fromCharCode(10) + '          </button>',
    '</span></span> Stellar' + String.fromCharCode(10) + '          </button>'],

  // ---- the chain's name inside the design's sample rows -----------------------------------------
  //
  // RAZA 2026-10-08: "why dont you remove the mock rows outright... if it can be done without
  // breaking anything". It cannot, for the rows that matter, and that is measured rather than
  // argued. _lumostoken.js fills Top Holders by CLONING the design's rows as templates:
  //
  //     var hr=qa(".holder-row"), top=hold.filter(...).slice(0, hr.length);
  //     hr.forEach(function(row,i){ var c=row.cloneNode(true); ... replaceChild ... })
  //
  // "slice(0, hr.length)" means the number of REAL holders the page can show is bounded by the
  // number of MOCK rows in the markup. Delete them and Top Holders renders nothing. The same
  // fill-in-place shape is why this codebase marks claimed nodes .lxp at all.
  //
  // So the nodes stay and only the chain word changes -- which is the whole machine-readable point,
  // since none of this is ever visible: sampled 150 times over 9s from first paint on /pools, and
  // checked at settle on /lumos, /rewards, /dashboard and both launchpad steps -- zero visible.
  // The renderer drops the "Aptos " prefix entirely at runtime (it removes the .b-ico and rewrites
  // the text node), so this edit is invisible to a reader and only ever read by a crawler.
  ['Aptos ' + '·' + ' ', 'Stellar ' + '·' + ' '],
  ['Aptos AMM utility', 'Stellar AMM utility'],
  ['fee tier ' + '·' + ' Aptos AMM', 'fee tier ' + '·' + ' Stellar AMM'],
  ['Aptos price', 'Stellar price'],
];

const problems = [];
const staged = [];

for (const file of FILES) {
  if (!fs.existsSync(file)) { problems.push(file + ': missing'); continue; }
  const data = read(file);
  const { json, s, e } = getContents(data);
  const counts = {};
  let touched = 0, done = 0, keys = 0;

  for (const key of Object.keys(json)) {
    let html = String(json[key] || '');
    if (!html) continue;
    const before = html;
    for (const [from, to] of SUBS) {
      const n = html.split(from).length - 1;
      if (!n) continue;
      counts[from] = (counts[from] || 0) + n;
      touched += n;
      html = html.split(from).join(to);
    }
    if (html !== before) { json[key] = html; keys++; }
    // idempotence: a finished container holds the replacements and none of the searches
    for (const [, to] of SUBS) if (html.indexOf(to) >= 0) { done++; break; }
  }

  // THE ARTICLE CHECK. If any phrasing this list does not know about left an "an" stranded in front of
  // Stellar, the copy is now wrong in a way a reader would notice, and that is worse than leaving the
  // markup alone. Abort rather than ship it.
  for (const key of Object.keys(json)) {
    const v = String(json[key] || '');
    if (/\ban Stellar\b/.test(v)) problems.push(key + ': left "an Stellar" — a phrasing this list does not cover');
  }

  if (!touched && !done) { problems.push(file + ': none of the overlay copy found'); continue; }
  staged.push({ file, data, s, e, json, touched, keys, counts });
}

if (problems.length) {
  console.error('chain copy: ABORT — nothing written.');
  problems.slice(0, 12).forEach((x) => console.error('  ' + x));
  process.exit(1);
}

for (const st of staged) {
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.file + ': ' + st.touched + ' replacement(s) across ' + st.keys + ' page(s)'
    + (st.touched ? '' : ' — already done'));
  for (const [from] of SUBS) if (st.counts[from]) console.log('      ' + String(st.counts[from]).padStart(4) + '  ' + JSON.stringify(from.slice(0, 52)));
}
console.log('chain copy: done');
