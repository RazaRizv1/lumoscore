// The Launchpad's worked example names a token that is not issued on this chain.
//
// WHAT RAZA SAW (2026-11-07, reported on the XRPL fork first): the "Token Name" box on /launchpad
// suggests "e.g. Tether" and the ticker beside it "e.g. USDT". Tether is not natively issued on the
// XRP Ledger -- and it is not issued on Stellar either. USDT existed as a Stellar asset years ago
// and was discontinued; there is no live Tether issuance on this network today. So the first field
// anybody fills in to issue a Stellar asset was teaching them an asset Stellar does not have.
//
// He asked for the XRPL one, saw the fix, then asked for this one too: "do the stellar launchpad
// placeholders too".
//
// USDC, BECAUSE IT IS ACTUALLY HERE. Circle issues USDC natively on Stellar --
// GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN, published in circle.com's own
// stellar.toml, checked rather than remembered -- and it is the asset a reader is most likely to
// recognise as belonging to this ledger. It is the same choice the XRPL fork made for the same
// reason, where the native example is Ripple's RLUSD.
//
// "USD Coin" IS A JUDGEMENT CALL AND IT IS THE ONE PART OF THIS WORTH ARGUING WITH. Circle's toml
// carries no `name` for the currency, so lumoscore.com shows this asset as plain "USDC" everywhere
// -- the asset page is titled "USDC price, pools and holders on Stellar". An example whose full
// name is identical to its ticker demonstrates nothing, and the whole point of this PAIR of boxes
// is to show which half goes where. "USD Coin" is the name the asset is universally known by and
// is not contradicted by anything the site prints; if RAZA would rather the two boxes read
// "e.g. USDC" and "e.g. USDC", that is one string here.
//
// THE TWO FIELDS MOVE TOGETHER. They sit side by side in the same row, so "USD Coin" beside
// "e.g. USDT" would read as a worse mistake than the one being fixed.
//
// THE PHONE SHIPS A DIFFERENT EXAMPLE ENTIRELY -- "e.g. Solar Flare" / "e.g. SLR", an invented
// token. That is not WRONG the way Tether is, and it was left alone on the first XRPL pass until
// the inconsistency showed itself: the same form teaching two different examples depending on
// which device opened it. Both layouts now say the same thing.
//
// WHO ELSE ANCHORS ON THE OLD STRINGS (checked before writing this, 2026-11-07):
//   XRPL _xrplcopy2.js  has MARKUP_LITERALS entries anchored on ALL FOUR old strings, because the
//                       XRPL fork copies Stellar's BUILT output as its base. Once this lands, a
//                       `rebuild.js --base` over there would bring "e.g. USD Coin" / "e.g. USDC"
//                       across and those anchors would stop matching -- leaving the XRP Ledger's
//                       launchpad advertising a Stellar asset, with nothing in the build
//                       complaining. It has been widened to accept both bases, exactly as
//                       _sendph.js records doing for the Send placeholder. Keep both spellings
//                       there until a base carrying the old ones is provably gone.
//   NEAR / ARC / HEDERA forks -- not checked from here; they copy this base too, and their
//                       launchpads are their own chats' business. Flagged to RAZA rather than
//                       edited.
//
// ONLY THE APTOS PAIR. There are fourteen containers on disk and twelve of them are other networks'
// design bases carrying the identical markup. _sendph.js's note explains what happens to a
// transform that "tidies" them all: it silently deletes Hedera's Memo field. The Stellar site is
// built from lumoscore-aptos-*.html and nothing else, so that is all this touches.
//
// Dry run by default; pass --write to apply. Idempotent: no target contains its own source, so a
// second run reports 0.
const { read, getContents, writeContents } = require(__dirname + '/lib.js');

const WRITE = process.argv.includes('--write');

// ---------------------------------------------------------------------------------------------
// 2026-11-13: NO WORKED EXAMPLE AT ALL. RAZA: "placing usdc in placeholder is not right."
//
// He is right, and the reason generalises past this one asset. The Add-custom-asset modal elsewhere
// on the site says "e.g. USDC" and that is CORRECT there -- you are entering an asset that already
// exists, so naming a real one is the whole point. The launchpad is the opposite form: you are
// CREATING an asset. Any real-looking example there suggests the reader could mint that asset, so
// swapping USDC for another invented token only moves the problem. (Offered "e.g. Solar Flare" /
// "e.g. SLR" -- this form's own earlier example -- and he declined it.)
//
// So both boxes now DESCRIBE what to type instead of naming something:
//     Token Name    -> Your token's name
//     Ticker Symbol -> ASSET
// "ASSET" is five uppercase letters, so it shows the shape the field wants without being a name;
// the helper lines underneath already carry the rules ("Displayed publicly on the DEX",
// "2-6 uppercase letters"). A STRAIGHT apostrophe, not the typographic one the prose uses: this
// string is an anchor in the XRPL fork's _xrplcopy2.js too, and an ASCII anchor cannot be broken by
// a re-encoding somewhere between five repos and the combine.
//
// The ticker input carries style="text-transform: uppercase", so the placeholder renders as ASSET
// whatever case it is written in -- which is also why the old one showed as "E.G. USDC" in RAZA's
// screenshot.
const NAME_NEW = 'placeholder="Your token' + String.fromCharCode(39) + 's name"';
const TICK_NEW = 'placeholder="ASSET"';

// [old, new]. Anchored to the attribute, not to the words alone: "e.g. USDT" as bare text would be
// a rule that could reach any copy on the site, and an attribute value is invisible to the phrase
// passes anyway.
//
// THE CURRENT GENERATION IS ANCHORED BY id AND THE OLDER ONES ARE NOT, and that asymmetry is load
// bearing. `placeholder="e.g. USDC"` is NOT unique in these containers: it appears 33 times on
// desktop and 27 on mobile inside a <script>, as the Asset code field of the Add-custom-asset modal
// that lx-walletdata builds at runtime (that is what markupOnly() below exists to see). A bare rule
// would rewrite that modal on every page of the site -- a different surface, not asked for, and the
// one place where naming USDC is right. The id makes it exact. The older spellings need no anchor:
// "e.g. Tether", "e.g. USDT", "e.g. Solar Flare" and "e.g. SLR" occur only on the launch keys.
//
// THE DOUBLED FORM COMES FIRST because the phone's markup carries the attribute TWICE on the name
// input -- the design's own duplicate, harmless since a parser keeps the first. Listed ahead of the
// single form so it collapses to one attribute rather than leaving a stale second copy behind.
const PAIRS = [
  ['id="tokenName" placeholder="e.g. USD Coin" placeholder="e.g. USD Coin"', 'id="tokenName" ' + NAME_NEW],
  ['id="tokenName" placeholder="e.g. USD Coin"', 'id="tokenName" ' + NAME_NEW],
  ['id="tokenTicker" placeholder="e.g. USDC"', 'id="tokenTicker" ' + TICK_NEW],
  // Older bases, kept so a freshly cut one still converts. Delete none until a base carrying them
  // is provably gone -- the rule _xrplcopy2.js and _sendph.js both record following.
  ['placeholder="e.g. Tether"', NAME_NEW],
  ['placeholder="e.g. USDT"', TICK_NEW],
  ['placeholder="e.g. Solar Flare"', NAME_NEW],
  ['placeholder="e.g. SLR"', TICK_NEW],
];

// The aptos pair is the single multichain base every Stellar page is built from. Named explicitly
// rather than globbed so this can never wander into a fork's container.
const FILES = ['lumoscore-aptos-desktop.html', 'lumoscore-aptos-mobile.html'];

// Measured before the first run: 2 desktop keys hold the Tether/USDT pair once each, 1 mobile key
// holds the Solar Flare/SLR pair -- and the NAME attribute appears twice on that one input, which is
// the design's own duplicate, present in Stellar's base and harmless (a parser keeps the first).
// Asserted so a reshaped form fails here instead of shipping half an example.
const EXPECT = { 'lumoscore-aptos-desktop.html': 4, 'lumoscore-aptos-mobile.html': 3 };

// COUNT MARKUP, NOT CODE -- lifted from _sendph.js, which needed it for the same reason and whose
// note explains it best. `placeholder="e.g. USDC"` is ALREADY in these containers 33 times on
// desktop and 27 on mobile, every one of them inside a <script>: it is the Add-custom-asset modal's
// Asset code field, built at runtime by a baked layer. A naive count would report those as "already
// current" and hide the fact that no launch form yet paints the new example.
//
// That collision is also the best evidence for the choice above: "e.g. USDC" is already this site's
// house example for a Stellar asset code. The launchpad was the one form using a different one.
function markupOnly(h, needle) {
  let at = h.indexOf(needle);
  if (at < 0) return 0;
  const spans = [];
  for (let i = 0; ;) {
    const a = h.indexOf('<script', i); if (a < 0) break;
    const b = h.indexOf('</script>', a); if (b < 0) break;
    spans.push([a, b + 9]); i = b + 9;
  }
  let n = 0;
  while (at >= 0) {
    if (!spans.some(([a, b]) => at >= a && at < b)) n++;
    at = h.indexOf(needle, at + 1);
  }
  return n;
}

let totalPages = 0, totalHits = 0, failed = 0;

for (const file of FILES) {
  let data;
  try { data = read(file); } catch (e) { console.log('  ' + file + ' -- not found, skipped'); continue; }

  // Count first, so the dry run reports exactly what the write will do.
  const { json } = getContents(data);
  const keys = new Set();
  let hits = 0, done = 0;
  for (const k of Object.keys(json)) {
    const h = json[k];
    if (typeof h !== 'string') continue;
    for (const [oldS] of PAIRS) {
      const n = h.split(oldS).length - 1;
      if (n) { hits += n; keys.add(k); }
    }
    // Several pairs share a target, so count the two DISTINCT new strings rather than per-pair --
    // otherwise an already-current page reports twice as many as it has.
    //
    // ONLY ON PAGES THAT CARRY THE LAUNCH FORM. `placeholder="ASSET"` is ALREADY in these containers
    // once per device, on /list-your-token -- its asset-code field has used exactly this placeholder
    // all along, which is the best evidence that ASSET is the right word for a box you type your own
    // code into. But counting it here would report "1 already current" on a run where the launchpad
    // itself had not been touched, which is the sort of number that reads as success and is not one.
    if (h.indexOf('id="tokenTicker"') >= 0) done += markupOnly(h, NAME_NEW) + markupOnly(h, TICK_NEW);
  }
  totalPages += keys.size; totalHits += hits;
  console.log('  ' + file + ': ' + hits + ' placeholder(s) on ' + keys.size + ' page(s)'
    + (done ? ', ' + done + ' already current' : ''));

  // Loud, not silent: a run that finds neither the old strings nor the new ones is a run whose
  // anchors have moved, and reporting "0 rewritten" on it looks exactly like success.
  if (!hits && !done) {
    console.error('  ! ' + file + ': neither the old nor the new placeholders are present'
      + ' -- the launch form has been reshaped; fix the anchors before trusting this.');
    failed++;
    continue;
  }
  if (hits && hits !== EXPECT[file]) {
    console.error('  ! ' + file + ': expected ' + EXPECT[file] + ' placeholder(s), found ' + hits
      + ' -- aborting rather than guessing which half of the example to move.');
    failed++;
    continue;
  }

  if (!WRITE || !hits) continue;
  writeContents(file, (j) => {
    for (const k of Object.keys(j)) {
      if (typeof j[k] !== 'string') continue;
      for (const [oldS, newS] of PAIRS) {
        if (j[k].indexOf(oldS) >= 0) j[k] = j[k].split(oldS).join(newS);
      }
    }
  });
}

console.log((WRITE ? 'rewrote ' : 'would rewrite ') + totalHits + ' placeholder(s) across '
  + totalPages + ' page(s)');
if (!WRITE && totalHits) console.log('dry run -- pass --write to apply');
if (failed) process.exit(1);
