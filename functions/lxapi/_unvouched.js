// Tokens that do not get a verified tick, whatever the upstream says about them.
//
// RAZA 2026-10-16: "just remove the tick from gatehub usdc". A search for "usdc" returned two rows,
// both reading USDC, both ticked, and only one of them is Circle's:
//
//   USDC  Circle   rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE  vf=1  domain https://circle.com
//   USDC  GateHub  rcEGREd8NmkKRE8GE424sksyt1tJVFZwu   vf=1  domain (none)
//
// The tick comes from xrpl.to's own `verified` flag, which marks both — reasonably, since GateHub is
// a real gateway and that is a real USDC IOU. It is just not Circle's, and two identically-named
// ticked rows is precisely the confusion the rest of this site keys on issuer to avoid.
//
// The ask was deliberately narrow: the token stays findable, it only loses the mark. GateHub's USDC
// is held by ~2.1K accounts and hiding it from search would take away their ability to find what
// they own. So nothing here removes a row — this is a tick list, not a block list.
//
// THAT HELD UNTIL 2026-10-17, when RAZA overruled it in as many words: "Remove gatehub usdc from
// XRPL entirely since we got circle usdc. We dont want that anywhere like Trade main page." So the
// file now has a second, separate list that DOES remove rows — see HIDE below. The two are kept
// apart on purpose: denying a tick and refusing to list a token are different decisions with
// different costs, and nothing should ever fall into the second by accident.
//
// WHAT THE TICK MEANS, on the record, because this list makes it mean something again. Until now it
// meant "we list it": the ranked table is the top of the market by volume, every row was built with
// vf:1, and a token that trades its way into the top hundred got a mark. See the long note in
// trade.js. This is the first entry that says "and not this one", so the mark is now "the upstream
// vouches for it AND we have not disagreed".
//
// Kept in one place and applied at every endpoint that publishes the flag, because a tick that is
// absent in search and present on the asset page is worse than either answer on its own.

// Keyed ISSUER|TICKER, the shape used by the curated roster in trade.js and the description table in
// dexasset.js. One entry per token; an issuer is not denied wholesale, because a gateway issuing a
// confusable USDC says nothing about its other currencies.
const DENY = new Set([
  'rcEGREd8NmkKRE8GE424sksyt1tJVFZwu|USDC',   // GateHub's USDC — not Circle's
]);

// AND THE OTHER DIRECTION, added 2026-10-17. The header above used to end "nothing here can invent a
// tick"; this is the deliberate exception, and it is what the note in trade.js asked for in as many
// words: *"If this is ever to mean verification again it needs a real curated list — issuer+currency,
// owned by someone."* This is that list. It is owned by RAZA, it is explicit, and an entry is a
// statement that LumosCore vouches for that exact issuer's exact currency.
//
// It exists because the upstream flag is not a judgement about legitimacy — it marks gateways. Every
// token RAZA named on 2026-10-17 ("Why arent the curated assets on XRPL carrying verification icon
// on Trade-main page. For eg phnix, bchamp, army, drop") carries `verified: false` upstream while
// sitting in the top ten of the ledger by volume. ATOM is the opposite case and is why a list is
// needed at all rather than a rule: it is NOT in the ranked roster (187 holders), so no amount of
// "we list it" logic can ever reach it -- only naming it can.
//
// THE ISSUER IS THE IDENTITY, never the ticker. Four different tokens on this ledger are called
// ATOM; the one below is the one RAZA pointed at, identified by address and holder count (187), not
// by name. Adding a token here without its issuer address would tick all four.
const ALLOW = new Set([
  'rDFXbW2ZZCG5WgPtqwNiA2xZokLMm9ivmN|PHNIX',    // Phoenix
  'rhYhn7s6z4HAfuJm7ehuSE7wxepRoUPwpi|BCHAMP',   // Bear Champ
  'rGG3wQ4kUzd7Jnmk1n5NWPZjjut62kCBfC|ARMY',     // ARMY
  'rszenFJoDdiGjyezQc8pME9KWDQH43Tswh|DROP',     // DROP
  'r1E7ErLAj4XfbkjUV3E1C57Tgb1TThzW4|ATOM',      // ATOM — RAZA 2026-10-17, 187 holders
  // LUMOS, moved here from the three places that each hardcoded its tick. The Trade table pinned
  // `vf: 1` onto its row, the asset page tested `asset.issuer === LUMOS_ISS`, and the roster never
  // contained it at all -- three statements of the same fact, none of which could see the others.
  // It belongs in the list that now decides this for every other token.
  'rsPqeamjpr3Bxu4LhtCgvJEAQusYRRg6Ha|LUMOS',
]);

// A currency reaches these endpoints in EITHER of the ledger's two shapes, and that difference has
// already cost this project two bugs (see the admin panel's xCur). Three characters travel
// literally — "SHX" is "SHX" — while everything else is a 40-character hex, so USDC arrives as
// 5553444300000000000000000000000000000000. A list keyed on one shape silently misses the other.
//
// So both are folded to the ticker. A hex that is not a plain ASCII ticker — an LP token's currency
// begins 03, and arbitrary bytes are legal — is returned unchanged rather than mangled into
// something that might collide with a real ticker.
export function tickerOf(currency) {
  const c = String(currency || '').trim().toUpperCase();
  if (!/^[0-9A-F]{40}$/.test(c)) return c;
  let s = '';
  for (let i = 0; i < 40; i += 2) {
    const b = parseInt(c.slice(i, i + 2), 16);
    if (b === 0) continue;                      // right-hand padding
    if (b < 0x20 || b > 0x7e) return c;         // not a readable ticker — keep the hex
    s += String.fromCharCode(b);
  }
  return s || c;
}

// The upstream's flag, with our disagreement applied in both directions. Always returns 1 or 0,
// never undefined, so a caller can drop it straight into the field it was already writing.
//
// DENY WINS. If a key were ever in both lists the answer is 0: refusing to vouch is the safe
// direction, and an entry appearing in both is a mistake whose least harmful reading is "someone
// meant to take this one back".
//
// A token in neither list is unaffected and still answers exactly what the upstream said.
// TOKENS THIS SITE DOES NOT PROMOTE. A stronger statement than DENY, and a narrower one than it
// first was: the row is dropped from the ranked ROSTER — the Trade table and everything built from
// it — and nothing else.
//
// SEARCH STILL RETURNS IT, DELIBERATELY. The first version of this also filtered search, and RAZA
// pulled it straight back: "I see that gatehub usdc is even gone from search. let it show up there
// just in case, but not verified icon." That is the right line. The roster is a list this site
// chooses to put in front of people; search is someone asking a direct question about a token they
// may already hold — roughly 2.1K accounts hold this one — and refusing to answer that is how a
// holder loses the ability to find what they own. DENY takes away the mark; this takes away the
// promotion; neither takes away the answer.
//
// NOT a safety mechanism. Nothing here blocks a transaction: a direct link to the asset page still
// works, and a holder's own balance still shows in their wallet, because hiding somebody's holdings
// from them would be a different and much worse thing than leaving a token off a list.
const HIDE = new Set([
  'rcEGREd8NmkKRE8GE424sksyt1tJVFZwu|USDC',   // GateHub's USDC — superseded by Circle's own
]);

// Should this token be left out of the ranked roster? Same ISSUER|TICKER key as the two sets above,
// so a currency in either ledger shape resolves the same way. Called from xrpltokens.js ONLY —
// adding it to a search path is the change that was tried and reversed; see the note above.
export function hidden(issuer, currency) {
  return HIDE.has(String(issuer || '').trim() + '|' + tickerOf(currency));
}

// THE INVERSE OF tickerOf, because a vouched token now has to be FETCHED and not merely recognised.
// The ledger wants a currency, the list is keyed on a ticker, and three characters travel literally
// while everything longer is a 40-character hex padded on the right. An input that is already a
// ledger currency is returned untouched, and anything with a byte outside printable ASCII is handed
// back as-is rather than encoded into something that could collide with a real ticker.
export function currencyOf(ticker) {
  const s = String(ticker || '').trim().toUpperCase();
  if (!s) return '';
  if (/^[0-9A-F]{40}$/.test(s)) return s;
  if (s.length <= 3) return s;
  let h = '';
  for (let i = 0; i < s.length && i < 20; i++) {
    const b = s.charCodeAt(i);
    if (b < 0x20 || b > 0x7e) return s;
    h += b.toString(16).padStart(2, '0').toUpperCase();
  }
  return (h + '0'.repeat(40)).slice(0, 40);
}

// The vouch list itself, for the one caller that needs to ACT on it rather than consult it.
//
// RAZA 2026-10-20: "ATOM is a curated asset but its not in the assets list on Trade-main page." It
// could not be. The roster is the ledger's top hundred by 24h volume — its lowest member trades
// 424 XRP a day and ATOM trades 0.22 — so no ranking rule reaches it, exactly as the ALLOW note
// above predicted. Vouching and listing had drifted into two different statements.
//
// They are one statement now: xrpltokens.js appends any vouched token the ranking missed, so
// "curated" means listed AND ticked, and the next token added to ALLOW needs no second edit
// somewhere else. Returned as issuer/ticker pairs rather than the raw keys so the caller does not
// have to re-parse a format this file owns.
export function vouchedTokens() {
  return [...ALLOW].map((k) => {
    const cut = k.indexOf('|');
    return { issuer: k.slice(0, cut), ticker: k.slice(cut + 1) };
  });
}

export function vouched(issuer, currency, flag) {
  const key = String(issuer || '').trim() + '|' + tickerOf(currency);
  if (DENY.has(key)) return 0;
  if (ALLOW.has(key)) return 1;
  return flag ? 1 : 0;
}

// THE ISSUER'S DISPLAY NAME, where the upstream feed has one we do not accept. xrpl.to carries
// "LumosDAO" against our own token and the site printed it on the asset page and in every search
// result (RAZA 2026-10-17: "On XRPL for lumos token, change from LumosDao to LumosCore"). The
// organisation is LumosCore; LumosDAO is the treasury, and the two are not interchangeable in front
// of a reader deciding whether a token is ours.
//
// Applied at the EDGE rather than in a painter, because three different screens print this name --
// the asset page, the search row and the token card -- and patching them one at a time is how the
// fourth one ends up disagreeing. The same reasoning the domain override already follows.
const NAMES = new Map([
  ['rsPqeamjpr3Bxu4LhtCgvJEAQusYRRg6Ha|LUMOS', 'LumosCore'],
]);

export function issuerName(issuer, currency, upstream) {
  const key = String(issuer || '').trim() + '|' + tickerOf(currency);
  return NAMES.get(key) || String(upstream || '');
}

// THE ISSUER'S HOME DOMAIN, tidied into the form the lists actually print. Upstream is inconsistent
// about it — "ripple.com", "www.circle.com" and "https://ripple.com/" all arrive for the same kind of
// value — so it is normalised ONCE here rather than in each of the three screens that show it.
//
// The scheme and a trailing slash are noise in a one-line chip, and "www." is noise everywhere: RAZA
// asked for "circle.com", and upstream says "www.circle.com".
function cleanDomain(d) {
  let s = String(d || '').trim().toLowerCase();
  if (!s) return '';
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');   // scheme
  s = s.replace(/^www\./, '');
  s = s.split('/')[0].split('?')[0].split('#')[0];
  // A LAUNCHPAD'S TOML HOST IS NOT A READABLE HOME DOMAIN. Tokens minted through FirstLedger declare
  // their toml at "<20 random chars>.toml.firstledger.net" — measured on FUZZY, BCHAMP, PHNIX and
  // DROP, which all carry one. That string is accurate and useless in a one-line chip, and it is the
  // launchpad that the reader is actually being told about: RAZA expected "FirstLedger.com".
  //
  // Narrow on purpose — only the literal "<something>.toml." prefix collapses, so a genuine subdomain
  // like app.example.com is left exactly as the issuer declared it.
  s = s.replace(/^[a-z0-9-]+\.toml\./, '');
  // A domain has a dot and no spaces. Anything else is a name that happened to land in the field, and
  // printing it would recreate the very thing this replaces.
  return (s.indexOf('.') > 0 && !/\s/.test(s)) ? s : '';
}

// Same override shape as NAMES: upstream files our own token under lumosdao.com, and every other
// surface on the site says lumoscore.com.
const DOMAINS = new Map([
  ['rsPqeamjpr3Bxu4LhtCgvJEAQusYRRg6Ha|LUMOS', 'lumoscore.com'],
]);

export function issuerDomain(issuer, currency, upstream) {
  const key = String(issuer || '').trim() + '|' + tickerOf(currency);
  return DOMAINS.get(key) || cleanDomain(upstream);
}
