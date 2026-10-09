// Share cards for XRP Ledger assets -- the top 100 by 24h volume, and nothing else.
//
// WHY A BOUNDED SET. XRPL has no curated roster and every token's name, icon and description come
// from whoever issued it, so drawing a card for any token on request would hand a scam a
// LumosCore-branded social preview. Volume is the one filter that costs something: it cannot be
// inflated for free the way "liquidity" can, which is the same reasoning the pool cards use and the
// same roster /lxapi/xrpltokens already serves the Trade page. Everything outside it keeps the
// /trade/xrpl card (RAZA, 2026-10-08).
//
// WHAT THE CARD SAYS, AND WHAT IT DELIBERATELY DOES NOT.
//
//   NO CURATION BADGE. The green tick means somebody checked, and nobody has checked these. Putting
//   it here would spend the one mark on the site that carries that meaning.
//
//   NO ISSUER NAME. The roster carries one -- "Ripple", "Sologenic" -- and it is set by the issuer,
//   so a token in the top hundred can call itself Circle. The ADDRESS goes on the card instead: it
//   is the only field an impersonator cannot copy, and it is what tells a reader which USDC this is.
//   That is also why the issuer line matters more here than on Stellar, where a curated asset
//   usually publishes a domain and none of these publish anything.
//
// Output: dist/assets/og/x/<CODE>-<issuer>.png, served by functions/lxapi/ogxrpl.js.
//
// Usage: node _tools/_ogxrpl.js [--origin https://...] [--limit N]
const fs = require('fs');
const path = require('path');
const K = require('./_ogkit.js');

const OUT = path.join(__dirname, '..', 'dist', 'assets', 'og', 'x');
const TOP = 100;
// The same shape the url uses: a readable code, a dash, the r-address.
// $ is allowed because real tickers use it -- $max and $FLIPPY are both in the top hundred, and
// rejecting them silently dropped two cards. Still no slashes, dots-leading or control characters:
// this string becomes a filename and a url.
const ID_RE = /^[A-Za-z0-9$][A-Za-z0-9$._-]{0,23}-r[1-9A-HJ-NP-Za-km-z]{24,34}$/;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// xrpl.to rate-limits, and asking for a hundred thumbnails as fast as the loop can run trips it:
// the first full run came back with 46 logos of 98, the rest drawn as monograms while the build
// reported success. Paced, with one retry, because a monogram that is really a 429 is the same
// class of lie as a card that says a price nobody quoted.
async function thumb(origin, m) {
  if (!m) return '';
  for (let i = 0; i < 2; i++) {
    const uri = await K.imageDataUri(origin + '/lxapi/xrplthumb?id=' + m + '&w=128');
    if (uri) return uri;
    await sleep(900);
  }
  return '';
}

(async () => {
  if (!K.hasFont()) { console.error('og xrpl: no font — nothing written'); process.exit(1); }
  const oa = process.argv.indexOf('--origin');
  const ORIGIN = oa > 0 ? process.argv[oa + 1] : 'https://lumoscore.com';
  const la = process.argv.indexOf('--limit');
  const LIMIT = la > 0 ? Math.max(1, parseInt(process.argv[la + 1], 10) || TOP) : TOP;

  let rows = [];
  try {
    const j = await (await fetch(ORIGIN + '/lxapi/xrpltokens?n=' + TOP)).json();
    rows = (j.rows || []).slice(0, LIMIT);
  } catch (e) {
    console.error('og xrpl: could not read the roster from ' + ORIGIN + ' — nothing written');
    process.exit(1);
  }
  if (!rows.length) { console.error('og xrpl: roster is empty — nothing written'); process.exit(1); }

  fs.mkdirSync(OUT, { recursive: true });

  const done = [], skipped = [];
  let withLogo = 0;
  for (const r of rows) {
    const code = String(r.n || '').trim();
    const issuer = String(r.i || '').trim();
    const id = code + '-' + issuer;
    // A code is issuer-chosen text and ends up in a filename and a url, so anything that does not
    // match the shape the route itself accepts is skipped rather than sanitised into something that
    // no longer points at the asset it names.
    if (!ID_RE.test(id)) { skipped.push(code || '(blank)'); continue; }

    const logo = await thumb(ORIGIN, r.m);
    if (logo) withLogo++;
    await sleep(120);                      // pace the roster, not just the retries

    const out = path.join(OUT, id + '.png');
    // Same guard as the asset cards: a thumbnail host blipping must not redraw a good card as a
    // two-letter monogram.
    if (!logo && fs.existsSync(out)) { done.push(id); continue; }

    try {
      fs.writeFileSync(out, K.render(K.assetCard({ code, logo, issuer, chain: 'XRPL' })));
      done.push(id);
    } catch (e) {
      console.error('  ' + id + ': ' + e.message);
    }
  }

  // Drop cards that have fallen out of the top hundred, so the directory stays bounded and a pool
  // that left the roster goes back to the chain card as the rule says it should. Only on a full run.
  let pruned = 0;
  if (LIMIT >= TOP && done.length >= TOP * 0.9) {
    const keep = new Set(done.map((d) => d + '.png'));
    for (const f of fs.readdirSync(OUT)) {
      if (f.endsWith('.png') && !keep.has(f)) { fs.unlinkSync(path.join(OUT, f)); pruned++; }
    }
  }

  console.log('og xrpl: wrote ' + done.length + ' asset card(s) of ' + rows.length
    + ' (' + withLogo + ' with a real logo) -> dist/assets/og/x/'
    + (pruned ? ', pruned ' + pruned + ' out of the top ' + TOP : '')
    + (skipped.length ? '\n  skipped ' + skipped.length + ' with a code the route would not accept: ' + skipped.join(' ') : ''));
})();
