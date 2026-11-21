// STELLAR LIMIT ORDERS ARE FREE, AND THE LIMIT PANE NOW SAYS NOTHING ABOUT FEES.
//
// RAZA 2026-11-01: "On Stellar limit orders, we are not charging 0.2% fees or any fees for that
// matter, so please remove 0.2% fees from limit section on Stellar" -- and, on why: "what if the
// order never fills. the user would have still paid the fees."
//
// It is not a policy that could have gone the other way. A limit order here is a native
// manageSellOffer/manageBuyOffer (_dexassetdata.js dxExecuteLimit): the offer rests on Stellar's own
// book and the fill happens directly between two accounts, with NO LumosCore operation in the path.
// Placement is the only moment a fee could be attached, so charging means charging for an order that
// may never fill. /docs/fees has said "Limit orders | Free | No platform fee, whether the order fills
// or not" since launch and /docs/limit-orders is titled "Free Resting Orders". The pane was the last
// surface contradicting them.
//
// THREE claims were showing, all injected at runtime -- none of them in the design markup, which is
// why grepping a page for "Trading fee" finds only <script>. Read off PRODUCTION before the change,
// on /trade/stellar/LUMOS-GB5T...55B6S with the Limit tab active:
//
//   .lx-feerow          "Trading fee  0.2%"                                    <- lx-feemodal
//   .lx-feebanner-wrap  "50% off trading fees - hold 250,000 LUMOS"            <- lx-feemodal
//   .lx-feetier         "Hold 250,000 LUMOS to lower your fee to 0.1%" + CTA   <- lx-feetier
//
// The first two are appended by the same function to the same summary element, so one selector owns
// both. The third is a separate layer. Hence two edits, one per layer.
//
// WHY A PATCH AND NOT A RE-RUN of _feemodal.js / _feetier.js (which are the authoritative generators
// and now carry the identical change): both of them strip their own layer and re-append it at
// </body>. They currently sit 16th and 29th of 39 script layers on these pages, so re-running would
// RELOCATE two whole layers to the end on every page carrying a trade card -- an enormous byte diff
// for two selectors, and a reordering of lx-feetier relative to lx-feerate, which publishes the
// balance it reads. Same reasoning as the fork's _xrplfeebanner.js. The emitted script differs from
// the generators' output by these two strings ONLY (the new comments there are Node-level, between
// concatenation fragments, so nothing new is emitted), so a future full re-run is byte-identical.
//
// SCOPED TO THE APTOS PAIR BY NAME. _feemodal.js and _feetier.js also write hedera/starknet/vechain/
// worldchain containers; only aptos is built for Stellar (extract_site.js aptos), and a transform
// that sweeps every container is how _memo_restore.js's anchor nearly got deleted. See
// [[base-copy-is-an-anchor-in-every-fork]].
//
// CROSS-REPO, flagged not fixed: NEAR charges on its limit orders and browser/dxalimit.js feeRow()
// opens `var row = $('.lx-feerow', p); if (!row) return;` -- it writes its figure INTO the row
// lx-feemodal creates. A NEAR base re-cut from a Stellar build made after this change finds no row
// and silently stops showing the NEAR fee. Belongs in the NEAR chat. XRPL already hides this row
// itself (browser/limit.js:263), Hedera builds its own when absent (browser/hederalimit.js:106), Arc
// hides the whole limit tab (browser/arcasset.js:293) -- all three unaffected.
//
// Usage: node _tools/_limitfree.js          (dry run, prints what it would do)
//        node _tools/_limitfree.js --write  (applies)

const { read, getContents, writeContents } = require(__dirname + '/lib.js');

const WRITE = process.argv.includes('--write');
const FILES = ['lumoscore-aptos-desktop.html', 'lumoscore-aptos-mobile.html'];

const EDITS = [
  { layer: 'lx-feemodal',
    old: '".dxa-pane-swap .dxa-trade-summary,.dxa-pane-limit .dxa-trade-summary,'
       + '.dxa-pane-swap .mdxa-trade-summary,.dxa-pane-limit .mdxa-trade-summary"',
    new: '".dxa-pane-swap .dxa-trade-summary,.dxa-pane-swap .mdxa-trade-summary"' },
  { layer: 'lx-feetier',
    old: '".dxa-pane-swap,.dxa-pane-limit"',
    new: '".dxa-pane-swap"' },
];

// Both selectors live inside a <script id="..."> that is baked into the page as source. Replacing
// them anywhere else in the page would be a different edit with the same spelling, so each one is
// confined to its own layer's span -- the pattern that _sendph.js's markupOnly() check exists for,
// applied the other way round.
function layerSpan(h, id) {
  const open = '<script id="' + id + '">';
  const a = h.indexOf(open);
  if (a < 0) return null;
  const b = h.indexOf('</script>', a);
  if (b < 0) throw new Error('layer ' + id + ' has no closing tag');
  return [a, b + 9];
}

let touched = 0, already = 0, missing = 0;

for (const file of FILES) {
  let data;
  try { data = read(file); } catch (e) { console.error('  ' + file + ': missing - skipped'); continue; }
  const { json } = getContents(data);

  let fTouched = 0, fAlready = 0, fMissing = 0;
  for (const key of Object.keys(json)) {
    const h = json[key];
    if (typeof h !== 'string' || h.indexOf('dxa-trade-card') < 0) continue;
    for (const e of EDITS) {
      const span = layerSpan(h, e.layer);
      if (!span) { fMissing++; continue; }
      const body = h.slice(span[0], span[1]);
      if (body.indexOf(e.old) >= 0) fTouched++;
      else if (body.indexOf(e.new) >= 0) fAlready++;
      else { console.error('  ' + file + ' / ' + key + ' / ' + e.layer + ': selector NOT FOUND - aborting'); process.exit(1); }
    }
  }
  console.log('  ' + file + ': ' + fTouched + ' selector(s) to change, '
    + fAlready + ' already done, ' + fMissing + ' layer(s) absent');
  touched += fTouched; already += fAlready; missing += fMissing;

  if (!WRITE || !fTouched) continue;

  writeContents(file, (j) => {
    for (const key of Object.keys(j)) {
      let h = j[key];
      if (typeof h !== 'string' || h.indexOf('dxa-trade-card') < 0) continue;
      for (const e of EDITS) {
        const span = layerSpan(h, e.layer);
        if (!span) continue;
        const body = h.slice(span[0], span[1]);
        if (body.indexOf(e.old) < 0) continue;
        h = h.slice(0, span[0]) + body.split(e.old).join(e.new) + h.slice(span[1]);
      }
      j[key] = h;
    }
  });
}

console.log((WRITE ? 'WROTE' : 'DRY RUN') + ': ' + touched + ' selector(s), '
  + already + ' already correct, ' + missing + ' layer(s) absent'
  + (WRITE ? '' : '   -- re-run with --write to apply'));
