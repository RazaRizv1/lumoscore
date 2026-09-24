// The upstream's token id, derived rather than looked up.
//
// xrpl.to keys a token by md5(issuer + "_" + currencyHex) — verified against all 50 rows of
// /lxapi/xrpltokens with no mismatches. That matters because a page often knows an issuer and a
// currency (they come off the ledger) while the id only comes from a ranking the token may not be
// in — an account's own holdings and a pool's own reserves are both like that.
//
// It lives here, and not in each endpoint, because it is a rule about someone else's API and two
// copies of such a rule are two things to update when it changes. The fee collector's address is
// injected at build time for the same reason.
//
// MD5 is not in the Web Crypto standard; Cloudflare supports it as an extension to
// crypto.subtle.digest, which is why this can be done at the edge and not in the browser.

// The native asset is not an issued token and is outside the scheme entirely: it has no issuer, and
// its id is a constant. Confirmed by fetching the thumbnail and looking at it.
export const XRP_ID = '84e5efeb89c4eae8f68188982dc290d8';

const ADDR = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
const CUR = /^([0-9A-F]{40}|[A-Z0-9]{3})$/;

// Returns a 32-hex id, or '' when the inputs are not the right shape. Never throws.
export async function tokenId(issuer, currency) {
  const iss = String(issuer || '').trim();
  const cur = String(currency || '').trim().toUpperCase();
  if (cur === 'XRP') return XRP_ID;
  if (!ADDR.test(iss) || !CUR.test(cur)) return '';
  try {
    const buf = await crypto.subtle.digest('MD5', new TextEncoder().encode(iss + '_' + cur));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    return '';
  }
}
