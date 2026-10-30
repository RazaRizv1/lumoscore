// Repair blog links whose href is a chain identifier rather than a web address.
//
// RAZA 2026-10-16: "Embedded pool links in blog posts fail to open. The navigation URLs are
// generated as incomplete links." Measured on the live post
// /blog/lumoscore-ecosystem-lp-rewards-new-cycle — nine of its ten XRPL pool links read:
//
//   <a href="https://rJnv9wSoSECHzWsNXR7E74hi8mbKX9ZnDM" rel="nofollow noopener noreferrer"
//      target="_blank">LUMOS / RLUSD</a>
//
// The pool's AMM ACCOUNT ADDRESS is being used as a HOSTNAME. There is no such host, so every one of
// those links is dead. The tenth was authored as a real path and works, which is what made the
// difference visible.
//
// WHERE IT CAME FROM: tidyUrl() in the admin editor prefixes "https://" to anything with no scheme
// and no leading slash, because the common case is someone pasting "lumoscore.com". A pasted pool
// address looks identical to that rule. tidyUrl is fixed separately so new posts cannot do this; this
// file is for the posts already stored, which cannot be rewritten from here — blog writes require a
// Cloudflare Access JWT.
//
// WHY A POOL AND NOT AN ACCOUNT, since /account/xrpl/<addr> also exists and an r-address is genuinely
// ambiguous between the two. Three reasons, in order of weight:
//   1. The alternative is a dead link. Any real destination beats a host that does not resolve.
//   2. Every address this currently affects was checked against the ledger with amm_info — all ten
//      are live AMM pools, not wallets.
//   3. An AMM account page would be a strange thing to link from prose; a pool page is what the
//      anchor text ("LUMOS / RLUSD") describes.
// If a post ever wants an account link, the author writes the path directly — tidyUrl leaves any
// value starting with "/" alone, which is the documented way to link anything internal.
//
// SHAPE ONLY, no checksum. The checksum lives in the XRPL build's xrpl-core.js and is not worth
// duplicating here: a mistyped address rewritten to a pool path lands on "pool not found", which is
// an honest answer, where today it lands on a browser error about a site that does not exist.

// 'r' plus 24-34 base58 characters. Base58 is why 0, O, I and l are absent.
const ADDR = 'r[1-9A-HJ-NP-Za-km-z]{24,34}';

// Matches a whole <a> whose href is EXACTLY a scheme plus an address — the closing quote has to come
// straight after, so a real URL that merely contains an address in its path can never match.
const BROKEN_A = new RegExp(
  '<a\\s([^>]*?)href="https?://(' + ADDR + ')"([^>]*)>', 'gi');

// rel and target were added by the link pipeline because the href looked like another site. Once it
// is an internal path they are wrong: nofollow on our own page spends link equity for nothing, and
// target="_blank" sends a reader out of the article to reach a page on the same site.
const DROP_ATTR = /\s(?:rel|target)="[^"]*"/gi;

export function repairBlogLinks(html) {
  const s = String(html || '');
  if (s.indexOf('href="http') < 0) return s;          // nothing to do, and this runs on every read
  return s.replace(BROKEN_A, (m, before, addr, after) => {
    const attrs = (String(before) + ' ' + String(after)).replace(DROP_ATTR, '').replace(/\s+/g, ' ').trim();
    return '<a ' + (attrs ? attrs + ' ' : '') + 'href="/pools/xrpl/id/' + addr + '">';
  });
}

// How many links a body would have repaired. Used by the tests and useful in a log line; it does not
// change the body, so it is safe to call anywhere.
export function countBrokenBlogLinks(html) {
  const m = String(html || '').match(BROKEN_A);
  return m ? m.length : 0;
}
