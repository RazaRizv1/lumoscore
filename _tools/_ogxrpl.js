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
//   THE BADGE READS "Listed asset", WITH THE TICK. It was omitted at first on the reasoning that the
//   tick means somebody checked and nobody has checked these -- which was wrong about what the tick
//   already means on this chain. dexasset.js grants it on membership of THIS ROSTER (see curatedSet()
//   there, fetching /lxapi/xrpltokens?n=100), so all hundred of these assets show a tick on their own
//   page. A card that previews a ticked page without the tick is not caution, it is a card that
//   disagrees with the site. The wording is the same one _ogcards.js uses for a Stellar asset in the
//   manifest that is not flagged verified: "Listed asset" says it is on LumosCore's list, which is
//   exactly what roster membership means, and claims nothing about vetting. "Curated asset" is kept
//   for the chain that has a curated list.
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

// EVERY LOGO THAT EVER ARRIVED IS KEPT. The pacing below makes a 429 unlikely, not impossible, and
// the old answer to one was to keep the whole previous PNG untouched -- which protected the logo and
// froze the DESIGN with it. The badge landed on 99 cards and BERT kept its pre-badge row, because its
// thumbnail happened to fail on the one run that changed the layout. Any future change would skip a
// different arbitrary card the same way, and nothing would report it.
//
// So the cache holds the LOGO, not the card: a failed fetch falls back to the bytes from last time
// and the card is still redrawn. Design changes reach every asset; a host blip still cannot downgrade
// one to a monogram. ([[never-cache-a-failure-as-an-answer]] inverted -- only successes are written.)
const LOGOS = path.join(__dirname, '..', '_data', 'ogxlogos');
let CACHE_HITS = 0;

async function thumb(origin, m) {
  if (!m) return '';
  const cached = path.join(LOGOS, m + '.png');
  // Paced, with one retry: the first full run came back with 46 logos of 98, the rest drawn as
  // monograms while the build reported success. A monogram that is really a 429 is the same class of
  // lie as a card that states a price nobody quoted.
  for (let i = 0; i < 2; i++) {
    const uri = await K.imageDataUri(origin + '/lxapi/xrplthumb?id=' + m + '&w=128');
    if (uri) {
      const c = uri.indexOf('base64,');
      if (c > 0) {
        try {
          fs.mkdirSync(LOGOS, { recursive: true });
          fs.writeFileSync(cached, Buffer.from(uri.slice(c + 7), 'base64'));
        } catch (e) { /* the card is drawn either way; the cache is an optimisation */ }
      }
      return uri;
    }
    await sleep(900);
  }
  try {
    if (fs.existsSync(cached)) {
      CACHE_HITS++;
      return 'data:image/png;base64,' + fs.readFileSync(cached).toString('base64');
    }
  } catch (e) { /* fall through to the monogram */ }
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

  const done = [], skipped = [], stale = [], inRoster = [], failed = [];
  let withLogo = 0;
  for (const r of rows) {
    const code = String(r.n || '').trim();
    const issuer = String(r.i || '').trim();
    const id = code + '-' + issuer;
    // A code is issuer-chosen text and ends up in a filename and a url, so anything that does not
    // match the shape the route itself accepts is skipped rather than sanitised into something that
    // no longer points at the asset it names.
    if (!ID_RE.test(id)) { skipped.push(code || '(blank)'); continue; }
    // IN THE ROSTER, which is what the prune at the bottom must decide on. It used to prune against
    // the list of cards written SUCCESSFULLY, so a card that merely failed to write -- two did, to a
    // transient file lock -- was deleted outright, turning a stale card into no card at all.
    inRoster.push(id);

    const logo = await thumb(ORIGIN, r.m);
    if (logo) withLogo++;
    await sleep(120);                      // pace the roster, not just the retries

    const out = path.join(OUT, id + '.png');
    // LAST RESORT ONLY, now that the logo itself is cached: this skips the redraw for an asset whose
    // thumbnail has never once been fetched, where the alternative really is a monogram. Everything
    // that has ever had a logo gets redrawn, so a design change cannot miss it.
    if (!logo && fs.existsSync(out)) { stale.push(id); done.push(id); continue; }

    const png = K.render(K.assetCard({
      code, logo, issuer, chain: 'XRPL', badge: 'Listed asset',
    }));
    // WRITTEN WITH A RETRY. Two of the hundred came back "UNKNOWN: unknown error" on open -- a
    // transient Windows lock, the sort a virus scanner takes on a file written a moment ago. One
    // pause clears it, and the alternative is a card arbitrarily left on the previous design.
    let wrote = false, last = '';
    for (let i = 0; i < 3 && !wrote; i++) {
      try { fs.writeFileSync(out, png); wrote = true; }
      catch (e) { last = e.message; await sleep(300); }
    }
    if (wrote) done.push(id);
    else { failed.push(id); console.error('  ' + id + ': ' + last); }
  }

  // Drop cards that have fallen out of the top hundred, so the directory stays bounded and an asset
  // that left the roster goes back to the chain card as the rule says it should. Only on a full run,
  // and decided on ROSTER MEMBERSHIP rather than on what was written this time: a card that failed to
  // write is out of date, which is a smaller problem than the card not existing at all.
  let pruned = 0;
  if (LIMIT >= TOP && inRoster.length >= TOP * 0.9) {
    const keep = new Set(inRoster.map((d) => d + '.png'));
    for (const f of fs.readdirSync(OUT)) {
      if (f.endsWith('.png') && !keep.has(f)) { fs.unlinkSync(path.join(OUT, f)); pruned++; }
    }
    // The logo cache is bounded the same way, or it keeps every thumbnail the roster has ever shown
    // -- a directory that only grows, holding logos for assets no card is drawn for any more.
    try {
      const live = new Set(rows.map((r) => String(r.m || '') + '.png'));
      for (const f of fs.readdirSync(LOGOS)) {
        if (f.endsWith('.png') && !live.has(f)) fs.unlinkSync(path.join(LOGOS, f));
      }
    } catch (e) { /* no cache yet, or one file busy; neither affects the cards */ }
  }

  console.log('og xrpl: wrote ' + done.length + ' asset card(s) of ' + rows.length
    + ' (' + withLogo + ' with a real logo'
    + (CACHE_HITS ? ', ' + CACHE_HITS + ' of them from the logo cache' : '')
    + ') -> dist/assets/og/x/'
    + (pruned ? ', pruned ' + pruned + ' out of the top ' + TOP : '')
    // Named, not just counted: these are the cards still carrying the PREVIOUS design, which is the
    // failure that let one card keep a pre-badge row while ninety-nine moved on.
    + (stale.length ? '\n  NOT REDRAWN, still on the older design (no logo ever fetched): ' + stale.join(' ') : '')
    + (failed.length ? '\n  FAILED TO WRITE, left on the older design: ' + failed.join(' ') : '')
    + (skipped.length ? '\n  skipped ' + skipped.length + ' with a code the route would not accept: ' + skipped.join(' ') : ''));
})();
