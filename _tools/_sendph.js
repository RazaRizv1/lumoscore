// Stops the Send dialog's RECIPIENT field flashing Stellar's old placeholder before the wallet
// layer rewrites it.
//
// WHAT RAZA SAW (2026-10-31, after the same fix landed on XRPL): open Send and the recipient field
// reads "G... or domain.com*username" for a frame, then snaps to "G... Stellar address". Same shape
// as every other flash in this codebase -- the markup is one thing, a script makes it another.
//
// WHY THE SCRIPT IS NOT THE BUG. _walletdata.js's enhanceSend() already writes the right text
// (`rec.placeholder="G... Stellar address"`), and its comment at _walletdata.js:292 records why:
// the only destination check anywhere in send is /^G[A-Z2-7]{55}$/, in validateSend and again in
// wireSend, so there is NO federation lookup in this codebase and the old wording promised a format
// the app refuses. It was also written backwards -- SEP-2 federation is name*domain, not
// domain*name -- and at 201px of JetBrains Mono 16.5px it clipped the 203.6px field on a 360px
// phone. So the replacement text is settled and correct. The only thing left wrong is WHEN it
// arrives: at runtime, which is one frame too late.
//
// THE FIX IS IN THE MARKUP, which is the standing rule for this family of bug -- fix the markup,
// never add a JS gate to hide it. Painting the final text on the first frame makes enhanceSend's
// write a no-op rather than a visible correction.
//
// THE RUNTIME WRITE STAYS. It is now redundant, but it sits inside the same guarded block that
// builds the Paste and Scan buttons, it writes the identical string, and it is the safety net if a
// container is ever rebuilt from an older export. Removing it would buy nothing and risk the
// buttons.
//
// "G..." IS KEPT ON PURPOSE. enhanceSend finds this input as
// `m.querySelector("input.mono")` and falls back to filtering inputs by /G\.\.\.|domain/i. The
// fallback only survives because the literal "G..." is still there; a placeholder starting
// "Stellar" would make the field invisible to its own wiring. This is also why the new text is not
// something tidier like "Recipient address".
//
// WHO ELSE ANCHORS ON THE OLD STRING (checked before writing this, 2026-10-31):
//   _memo_restore.js    uses `placeholder="G... or domain.com*username" />` as its ANCHOR, but only
//                       inside lumoscore-hedera-*.html. This transform touches the aptos base only,
//                       so that anchor is untouched. Do NOT "tidy" this by running it over every
//                       container -- that would silently delete Hedera's Memo field.
//   XRPL _xrplcopy2.js  has a MARKUP_LITERALS entry anchored on the OLD string, and the XRPL fork
//                       copies Stellar's BUILT output. Once this lands, that anchor stops matching
//                       and the XRPL page would show "G... Stellar address" -- wrong-chain copy on
//                       a ledger with no G addresses. It has been widened to accept both bases.
//   XRPL browser/write.js:939, NEAR browser/send.js:882 -- comments only, no functional dependency.
//   ARC / HEDERA -- no reference to the old string at all.
//
// Dry run by default; pass --write to apply. Idempotent: a second run reports 0.

const { read, getContents, writeContents } = require(__dirname + '/lib.js');

const OLD = 'placeholder="G... or domain.com*username"';
const NEW = 'placeholder="G... Stellar address"';
const WRITE = process.argv.includes('--write');

// The aptos pair is the single multichain base every Stellar page is built from. Named explicitly
// rather than globbed so this can never wander into a fork's container.
const FILES = ['lumoscore-aptos-desktop.html', 'lumoscore-aptos-mobile.html'];

// True when `needle` appears OUTSIDE every <script> span -- i.e. as copy the parser paints, not as
// source in a baked layer. Measured before the first run: all 55 occurrences of OLD are markup and
// all 51 of NEW are script, so the replacement below cannot touch code.
function markupOnly(h, needle) {
  let at = h.indexOf(needle);
  if (at < 0) return false;
  const spans = [];
  for (let i = 0; ; ) {
    const a = h.indexOf('<script', i); if (a < 0) break;
    const b = h.indexOf('</script>', a); if (b < 0) break;
    spans.push([a, b + 9]); i = b + 9;
  }
  while (at >= 0) {
    if (!spans.some(([a, b]) => at >= a && at < b)) return true;
    at = h.indexOf(needle, at + 1);
  }
  return false;
}

let totalPages = 0, totalHits = 0, already = 0;

for (const file of FILES) {
  let data;
  try { data = read(file); } catch (e) { console.log('  ' + file + ' -- not found, skipped'); continue; }

  // Count first, so the dry run reports exactly what the write will do -- and count MARKUP only.
  // A naive indexOf(NEW) is misleading here: _walletdata's own `rec.placeholder="G... Stellar
  // address"` is baked into these containers as a <script>, so the new string is already present 51
  // times as CODE. Reporting that as "already fixed" would hide the fact that no page yet paints it.
  const { json } = getContents(data);
  let pages = 0, hits = 0, done = 0;
  for (const k of Object.keys(json)) {
    const h = json[k];
    const n = h.split(OLD).length - 1;
    if (n) { pages++; hits += n; }
    if (markupOnly(h, NEW)) done++;
  }
  totalPages += pages; totalHits += hits; already += done;
  console.log('  ' + file + ': ' + hits + ' in markup on ' + pages + ' page(s)'
    + (done ? ', ' + done + ' page(s) already painting the new text' : ''));

  if (!WRITE || !hits) continue;
  writeContents(file, (j) => {
    for (const k of Object.keys(j)) {
      if (j[k].indexOf(OLD) >= 0) j[k] = j[k].split(OLD).join(NEW);
    }
  });
}

console.log((WRITE ? 'rewrote ' : 'would rewrite ') + totalHits + ' placeholder(s) across '
  + totalPages + ' page(s)' + (already ? ' (' + already + ' already done)' : ''));
if (!WRITE && totalHits) console.log('dry run -- pass --write to apply');
