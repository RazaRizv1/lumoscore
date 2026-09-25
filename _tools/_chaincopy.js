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
