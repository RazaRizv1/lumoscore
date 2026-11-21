// THE HOLDER-STATE FEE BANNER WRAPPED ONTO TWO LINES, AND THE CAUSE WAS THE SENTENCE.
//
// RAZA 2026-11-06, with a screenshot of the XRPL trade card: "we have this 250K LUMOS message at the
// bottom in one one [line]" on Stellar, but on his own screen it broke as
//
//     You qualify for 0.1% trading fees — 50%
//     Discount
//
// It reads as an XRPL bug and is not one. lx-feemodal ships TWO banner states from one generator,
// and both chains run the same emitted layer, so whatever wraps here wraps there:
//
//   nudge  (not holding)  "50% off trading fees — hold 250,000 LUMOS"          253px natural
//   holder (holding 250K) "You qualify for 0.1% trading fees — 50% Discount"   283px natural
//
// Measured on production at a 445px pane: .txt gets paneWidth - 143px (15+15 padding, 36 icon,
// 12 gap, wrap margins), so 302px available. The nudge keeps 49px of headroom; the holder keeps
// NINETEEN. The holder therefore breaks on any pane under ~426px while the nudge survives to 396px
// -- which is exactly why RAZA saw it and I did not, and why he saw it as a chain difference: he
// holds 250,000 LUMOS, so he is the only one of us ever shown the long string.
//
// A padding or icon tweak buys about 20px and moves the break to ~406px -- still on the knife edge,
// and it would restyle the state that is already fine. The sentence is the real fault: "0.1% trading
// fees" and "50% Discount" state the same fact twice. "0.1% trading fees — 50% discount active"
// keeps the rate visible, needs 232px, and holds one line down to a 375px pane. RAZA approved this
// wording 2026-11-06.
//
// WHY A PATCH AND NOT A RE-RUN of _feemodal.js (which now carries the identical string, so a future
// full re-run is byte-identical): _feemodal strips its own layer and re-appends it at </body>. It
// currently sits 16th of 39 script layers on these pages, so re-running would RELOCATE a whole
// layer to the end of every page carrying a trade card -- an enormous byte diff for one sentence,
// and a reordering relative to lx-feerate, which publishes the balance it reads. Identical
// reasoning to _limitfree.js, whose shape this file copies.
//
// SCOPED TO THE APTOS PAIR BY NAME, and confined to the lx-feemodal layer's own span: the same
// sentence appearing anywhere else in a page would be a different edit wearing the same spelling.
// See [[base-copy-is-an-anchor-in-every-fork]].
//
// CROSS-REPO, flagged not fixed: XRPL does not run _feemodal.js at all -- it inherits the Stellar
// base and patches it in _xrplfeebanner.js, where this same swap is applied. NEAR, Arc and Hedera
// inherit the same layer and still ship the old sentence; a copy call is platform-wide, so each
// needs the same edit in its own chat.
//
// Usage: node _tools/_feecopy.js          (dry run, prints what it would do)
//        node _tools/_feecopy.js --write  (applies)

const { read, getContents, writeContents } = require(__dirname + '/lib.js');

const WRITE = process.argv.includes('--write');
const FILES = ['lumoscore-aptos-desktop.html', 'lumoscore-aptos-mobile.html'];
// TWO LAYERS EMIT THIS SENTENCE, NOT ONE -- [[two-transforms-one-anchor]].
//
// The first run of this patch scoped itself to lx-feemodal and reported "3 reworded", which looked
// like a clean sweep. It was not: 35 page keys in the desktop container carry the sentence, and a
// scan for which <script id> span each one sits inside came back
//
//     lx-swapcalc   33 pages      (the swap box, from _swapcalc.js -- TWICE in that file)
//     lx-feemodal    2 pages      (the trade card, from _feemodal.js)
//
// So the narrow version would have reworded the trade card and left the swap box -- the surface on
// nearly every page -- still saying the old sentence, and the "3 reworded, 0 already done" line
// would have been the only evidence, reading as success. Both layers are patched, and both
// generators now carry the new string so a future re-run of either is byte-identical.
const LAYERS = ['lx-feemodal', 'lx-swapcalc'];

const OLD = '<b>You qualify for 0.1% trading fees</b> — 50% Discount';
const NEW = '<b>0.1% trading fees</b> — 50% discount active';

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
    if (typeof h !== 'string') continue;
    for (const layer of LAYERS) {
      const span = layerSpan(h, layer);
      if (!span) continue;                     // that surface is simply not on this page
      const body = h.slice(span[0], span[1]);
      if (body.indexOf(OLD) >= 0) fTouched++;
      else if (body.indexOf(NEW) >= 0) fAlready++;
    }
    // THE SENTENCE OUTSIDE BOTH LAYERS IS THE FAILURE THIS COUNTS. Missing is not "layer absent" --
    // that is normal and skipped above. It is the sentence being present on the page while neither
    // layer span contains it, i.e. a THIRD emitter appearing later. That is exactly how the first
    // version of this patch under-reached, so it is now an abort rather than a silent short count.
    if (h.indexOf(OLD) >= 0 && !LAYERS.some((l) => {
      const s = layerSpan(h, l);
      return s && h.slice(s[0], s[1]).indexOf(OLD) >= 0;
    })) { fMissing++; console.error('    ' + key + ': sentence present OUTSIDE ' + LAYERS.join('/')); }
  }
  // A layer that is present but holds NEITHER sentence means the generator's output changed under
  // this patch. Silently writing nothing would look identical to "already done", so say it loudly
  // and stop -- the same abort _limitfree.js makes for the same reason.
  if (fMissing) {
    console.error('  ' + file + ': ' + fMissing + ' page(s) carry the sentence outside every known layer - aborting');
    process.exit(1);
  }
  console.log('  ' + file + ': ' + fTouched + ' banner(s) to reword, ' + fAlready + ' already done');
  touched += fTouched; already += fAlready;

  if (!WRITE || !fTouched) continue;

  writeContents(file, (j) => {
    for (const key of Object.keys(j)) {
      let h = j[key];
      if (typeof h !== 'string') continue;
      // Re-read the span for each layer in turn: rewriting one shifts nothing outside its own
      // bounds, but the spans must be taken from the CURRENT h rather than cached before the first
      // write, or the second layer is sliced against stale offsets.
      for (const layer of LAYERS) {
        const span = layerSpan(h, layer);
        if (!span) continue;
        const body = h.slice(span[0], span[1]);
        if (body.indexOf(OLD) < 0) continue;
        h = h.slice(0, span[0]) + body.split(OLD).join(NEW) + h.slice(span[1]);
      }
      j[key] = h;
    }
    return j;
  });
}

console.log('  fee banner copy: ' + touched + ' reworded, ' + already + ' already done'
  + (WRITE ? '' : '   (dry run - pass --write to apply)'));
