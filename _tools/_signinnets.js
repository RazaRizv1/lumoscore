// The /signin network chooser offered seven chains. Five of them go nowhere.
//
// RAZA 2026-10-08, approving the recommendation. Measured on production before the change, the chooser
// listed: Stellar, XRP Ledger, VeChain, Hedera, Starknet, "Stellar", World Chain — seven tiles, and the
// SIXTH one, labelled Stellar, opened the APTOS wallet list (Petra, OKX Wallet, Nightly, Fox Wallet).
// Picking it got you four wallets for a chain this site does not run, under the name of the chain it
// does. The duplicate name is the inherited runtime re-skin rewriting the Aptos tile's label to the
// connected chain, which is right everywhere except on a chooser, where each tile names a DIFFERENT
// chain by design.
//
// THIS IS NOT A NEW DECISION. _mc_engine.js already says it, in its own words:
//
//     var ORDER=["stellar","xrpl"];
//     // Networks offered in the "Choose a network" screen. Only the chains LumosCore actually runs on —
//     // listing Aptos/Hedera/Starknet/VeChain/World Chain advertised connections that go nowhere.
//
// That ORDER governs the chooser the engine BUILDS inside the .lxw connect modal. /signin is a separate
// inherited page with its own markup, so the filter never reached it — the engine does run there
// (window.__lxMC is true on the live page), it simply has nothing to say about this DOM. This applies
// the same decision to the page that was missed.
//
// WHY REMOVE AND NOT HIDE. The whole reason the sibling transform _chaincopy.js exists is that machines
// read markup: an assistant reading the page through LumosCore MCP is what surfaced the Aptos residue in
// the first place. A display:none tile still advertises a connection that cannot be made. The tiles for
// the unsupported chains are deleted outright, and so are their wallet groups — otherwise the page keeps
// shipping sixteen wallet buttons for chains with no route behind them.
//
// Of those sixteen, the Aptos four were the only ones NOT carrying style="display:none" — Aptos is the
// design's base chain, so its group is the default-visible one. Removing it is also what finally clears
// "Petra — Official Stellar wallet", a label _chaincopy.js created by rewriting the bare phrase
// "Aptos wallet" to "Stellar wallet" and catching "Official Aptos wallet" with it. That string occurs
// three times in the whole build and all three are Petra, so nothing else depended on it.

const fs = require('fs');
const { read, getContents, writeContents } = require(__dirname + '/lib.js');

const FILES = ['lumoscore-aptos-desktop.html', 'lumoscore-aptos-mobile.html'];

// The two builds that exist. Anything else is a tile with no site behind it.
const KEEP = new Set(['stellar', 'xrpl']);

// Tiles carry data-net-id; the wallet buttons behind them carry data-wnet. Both are <button> elements
// in flat grids, which is what makes this a clean removal rather than a surgical one.
const ATTRS = ['data-net-id', 'data-wnet'];

// The SEARCH POPUP's chain filters are the same problem in a different component: one pill is
// data-chain="hedera" labelled "Aptos (9)" -- a chain this site does not run, named after a
// different chain it also does not run. The whole #spFilters bar is display:none, so nobody sees
// it; a crawler still reads a filter offering Hedera assets.
//
// MATCHED WITH THE CLASS, NOT ON data-chain ALONE, and that distinction is the whole rule. Adding
// "data-chain" to ATTRS above looked equivalent and is not: the attribute appears 289 times for
// stellar on the desktop container, including inside script template literals as
// data-chain="' + a.chain + '" and data-chain="${a.chain}". It removed nothing only because the
// <button> guard happened to reject those -- the verification still refused the run, correctly.
const PILL = 'class="sp-filter-pill" data-chain="';

// Remove the <button> whose opening tag starts at `idx`, with its children. Scanned rather than
// regexed: the buttons hold inline <svg> and <span> (and base64 images hundreds of characters long),
// so a non-greedy match to the first </button> is right only by luck and a greedy one eats the grid.
// Depth counting keeps it honest even though these buttons do not nest today.
function cutButton(html, idx) {
  let depth = 0, p = idx;
  for (;;) {
    const nOpen = html.indexOf('<button', p + 1);
    const nClose = html.indexOf('</button>', p + 1);
    if (nClose < 0) return null;                       // unbalanced: leave the page alone
    if (nOpen > -1 && nOpen < nClose) { depth++; p = nOpen; continue; }
    if (depth === 0) return html.slice(0, idx) + html.slice(nClose + '</button>'.length);
    depth--; p = nClose;
  }
}

// One pass per attribute value found, from the end backwards so earlier indices stay valid.
function stripNets(html) {
  const hits = [];
  for (const attr of ATTRS) {
    const re = new RegExp(attr + '="([^"]+)"', 'g');
    let m;
    while ((m = re.exec(html))) {
      const net = m[1];
      if (KEEP.has(net)) continue;
      // Walk back to the opening '<' of the tag this attribute sits in.
      const open = html.lastIndexOf('<button', m.index);
      if (open < 0) continue;
      // Only if the attribute really belongs to THAT tag (no '>' between them).
      if (html.slice(open, m.index).indexOf('>') > -1) continue;
      hits.push({ open, net, attr });
    }
  }
  // the search popup's filter pills, matched on the class so no other data-chain is touched
  let q = -1;
  while ((q = html.indexOf(PILL, q + 1)) > -1) {
    const vs = q + PILL.length, ve = html.indexOf('"', vs);
    if (ve < 0) continue;
    const net = html.slice(vs, ve);
    if (KEEP.has(net)) continue;
    const open = html.lastIndexOf('<button', q);
    if (open < 0 || html.slice(open, q).indexOf('>') > -1) continue;
    hits.push({ open, net, attr: 'sp-filter-pill' });
  }
  hits.sort((a, b) => b.open - a.open);
  let out = html, removed = 0;
  const seen = new Set();
  for (const h of hits) {
    if (seen.has(h.open)) continue;
    seen.add(h.open);
    const next = cutButton(out, h.open);
    if (next == null) continue;
    out = next; removed++;
  }
  return { html: out, removed };
}

const problems = [];
let totalRemoved = 0, pagesTouched = 0;

for (const file of FILES) {
  if (!fs.existsSync(file)) { problems.push(file + ': missing'); continue; }

  // COUNTED THROUGH THE JSON, NEVER OFF THE RAW FILE. The container holds its pages as JSON strings
  // inside a <script>, so every attribute quote on disk is written \" — a regex for data-net-id="x"
  // matches nothing there. The first version of this counted and then VERIFIED against the raw bytes,
  // reported `before: {}` and then claimed it had deleted the Stellar and XRPL tiles it had in fact
  // left untouched. The write had already happened by then, so the scary report was pure fiction.
  const tally = (f) => {
    const { json } = getContents(read(f));
    const counts = {};
    for (const key of Object.keys(json)) {
      const html = String(json[key] || '');
      for (const attr of ATTRS) {
        for (const m of html.matchAll(new RegExp(attr + '="([^"]+)"', 'g'))) {
          counts[attr + '=' + m[1]] = (counts[attr + '=' + m[1]] || 0) + 1;
        }
      }
      // pills counted the same way, so the post-pass check sees them too
      let q = -1;
      while ((q = html.indexOf(PILL, q + 1)) > -1) {
        const vs = q + PILL.length, ve = html.indexOf('"', vs);
        if (ve < 0) continue;
        const k = 'sp-filter-pill=' + html.slice(vs, ve);
        counts[k] = (counts[k] || 0) + 1;
      }
    }
    return counts;
  };
  const beforeCounts = tally(file);

  let removedHere = 0, keysHere = 0;
  writeContents(file, (json) => {
    for (const key of Object.keys(json)) {
      const html = String(json[key] || '');
      // The pill pages carry NEITHER of the sign-in attributes, so a gate naming only those two
      // skipped every one of them and the pass reported a confident 0. The gate has to admit any
      // page the stripper knows how to act on.
      if (!html) continue;
      if (html.indexOf('data-net-id="') < 0 && html.indexOf('data-wnet="') < 0
        && html.indexOf(PILL) < 0) continue;
      const { html: next, removed } = stripNets(html);
      if (removed) { json[key] = next; removedHere += removed; keysHere++; }
    }
    return removedHere;
  });

  totalRemoved += removedHere;
  if (removedHere) pagesTouched += keysHere;
  console.log(file + ': removed ' + removedHere + ' button(s) across ' + keysHere + ' page(s)');
  console.log('  before: ' + JSON.stringify(beforeCounts));

  // Prove the result rather than trust the loop: nothing outside KEEP may survive, and everything
  // inside it must. Read back through the JSON for the reason above.
  const afterCounts = tally(file);
  const left = Object.keys(afterCounts).filter((k) => !KEEP.has(k.split('=')[1]));
  if (left.length) problems.push(file + ': still present after the pass -> ' + left.join(', '));
  for (const net of KEEP) {
    if (!afterCounts['data-net-id=' + net]) problems.push(file + ': lost the ' + net + ' tile');
    if (!afterCounts['data-wnet=' + net]) problems.push(file + ': lost the ' + net + ' wallet group');
  }
}

if (problems.length) {
  console.error('\nPROBLEMS:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('\nok — ' + totalRemoved + ' unsupported-network button(s) removed; stellar + xrpl intact');
