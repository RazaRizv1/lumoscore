// The home domain an issuer declares ON THE LEDGER, which is not the one the market data reports.
//
// RAZA 2026-10-02: "why do some assets on XRPL search carrying homedomains like x.com and github.io
// which obviously isnt true. Fix it and get their real home domains".
//
// They are not true, and the ledger already says so. xrpl.to's `domain` field is supplied to xrpl.to by
// whoever listed the token, so a token can claim anything; the AccountRoot's `Domain` field is set by
// the issuing account itself, in a transaction that account signed. Measured on the four tokens called
// ATOM:
//
//   r1E7ErLAj4XfbkjUV3E1C57Tgb1TThzW4   market data: x.com            ledger: 7kt6u8…toml.firstledger.net
//   rDS29f4Eb5zWfr7waoR3R8mA3jd7dwXdj2  market data: cosmos.github.io ledger: u4bkes…toml.firstledger.net
//   rG36odwFbMfBCK5X4m3ej2CLvYVRRufko2  market data and ledger agree
//
// This is NOT proof of ownership — the issuer still asserts it, and a domain is only really tied to an
// account when the .toml it points at names that account back (see the Stellar side's SEP-1 notes). It
// is simply the assertion made by the account rather than one made about it, which is the difference
// between "this token says x.com" and "someone told a price site x.com".
const RPCS = ['https://s1.ripple.com:51234/', 'https://s2.ripple.com:51234/', 'https://xrplcluster.com/'];

// TWO TTLs, AND THE SPLIT IS THE WHOLE POINT OF THIS FILE'S SECOND VERSION.
//
// The first version cached one string per issuer and could not tell these two things apart:
//
//   the node answered, and this account has set no Domain   -> true, and good for a day
//   no node answered at all                                 -> we know nothing
//
// Both became `''`, and both were written with a 24-hour TTL. So the first lookup that failed for any
// reason — a node blip, a slow colo, a deadline landing mid-flight — was promoted to the fact "this
// issuer has no home domain" and served to everyone in that colo for the next day, with no way to tell
// from the outside that anything had gone wrong. Measured on the deployed build: all five ATOM rows came
// back blank in 70ms, which is a cache hit, while the same accounts answered from a laptop with their
// real firstledger.net domains. The bug was not in reaching the ledger; it was in remembering a failure
// as an answer.
//
// So an unreached issuer is now cached for thirty seconds — long enough to stop a stampede, short enough
// that nothing is baked in — and only a real answer earns the day.
const TTL_OK = 86400;
const TTL_FAIL = 30;
// Cache entries carry this header so a hit can say WHICH of the two it is; the body alone cannot,
// because the body of a genuine "no domain set" is also empty.
const H_REACHED = 'x-lxdom-reached';

// Hex, because that is how AccountSet stores it. Anything that is not clean ASCII is discarded rather
// than shown: the field is attacker-controlled bytes, and a half-decoded string beside a token name is
// exactly the kind of thing that gets rendered somewhere it should not be.
function decodeDomain(hex) {
  if (!hex || typeof hex !== 'string' || hex.length > 512 || (hex.length % 2)) return '';
  let out = '';
  for (let i = 0; i < hex.length; i += 2) {
    const b = parseInt(hex.slice(i, i + 2), 16);
    if (!isFinite(b) || b < 0x20 || b > 0x7e) return '';
    out += String.fromCharCode(b);
  }
  // A domain, not a sentence: no spaces, no scheme, one dot at least.
  if (!/^[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]{4,100}$/.test(out)) return '';
  if (!/\./.test(out)) return '';
  return out.toLowerCase();
}

// { reached, domain }. `reached` is whether a node actually told us about this account — which is the
// only basis on which an empty domain may be remembered as a fact.
async function rpcDomain(account) {
  for (const node of RPCS) {
    let r;
    try {
      r = await fetch(node, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': 'LumosCore/1.0 (+https://lumoscore.com)' },
        body: JSON.stringify({ method: 'account_info', params: [{ account, ledger_index: 'validated' }] }),
      });
    } catch (e) { continue; }
    if (!r.ok) continue;
    const j = await r.json().catch(() => null);
    const res = j && j.result;
    if (!res) continue;
    // actNotFound and friends are a real answer from this node: the account has no domain to give.
    if (res.error) return { reached: true, domain: '' };
    return { reached: true, domain: decodeDomain(res.account_data && res.account_data.Domain) };
  }
  return { reached: false, domain: '' };
}

// One cache entry per ISSUER, not per query, so the fiftieth search that happens to include a token
// costs nothing.
//
// A SEARCH BOX MUST NOT WAIT ON THE LEDGER. Measured after the first version of this shipped: every
// query took 3.0s, because the response was held until every issuer had been asked. That is a worse
// bug than the one it fixes — a search that is right and takes three seconds is a search nobody uses.
//
// So the lookups race a deadline. Whatever has answered by then is used; the rest are left for the
// cache to pick up, and since every answer is cached per issuer the second person to search a token
// gets it instantly. An unresolved issuer shows no domain rather than the claimed one — the point of
// the exercise was to stop showing a domain we have no basis for.
const DEADLINE_MS = 1200;

// `stat`, if passed, is filled in with what happened — resolved / none / unreachable / cached. It exists
// so this is measurable from outside: the first version's failure was invisible precisely because a
// missing domain and an unreachable node looked identical in the response.
export async function issuerDomains(issuers, origin, ctx, stat) {
  const uniq = [...new Set((issuers || []).filter((a) => /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(a || '')))];
  const out = {};
  const st = stat || {};
  st.asked = uniq.length; st.resolved = 0; st.none = 0; st.unreachable = 0; st.cached = 0;
  if (!uniq.length) return out;
  let cache = null;
  try { cache = caches.default; } catch (e) { cache = null; }

  // The work for one issuer: cache first, ledger second, and the answer written back either way — but
  // with the TTL that matches what kind of answer it is.
  // It keeps running past the deadline under waitUntil, so a slow lookup still warms the cache for
  // the next search rather than being wasted.
  const work = uniq.map(async (acct) => {
    const key = new Request(origin + '/__issuerdomain/' + acct);
    if (cache) {
      const hit = await cache.match(key).catch(() => null);
      // A hit only counts as an answer if it was stored as one. Entries written by the FIRST version of
      // this file carry no such header, so they are treated as unknown and re-resolved rather than
      // trusted — otherwise this fix would sit behind a day of the old version's poisoned blanks.
      if (hit && hit.headers.get(H_REACHED) === '1') {
        out[acct] = (await hit.text().catch(() => '')) || '';
        st.cached++;
        if (out[acct]) st.resolved++; else st.none++;
        return;
      }
    }
    let got = { reached: false, domain: '' };
    try { got = await rpcDomain(acct); } catch (e) { got = { reached: false, domain: '' }; }
    // ONLY a reached answer goes into `out`. An unreachable issuer is left absent, so the caller can
    // tell "no domain" from "we do not know" and shorten its own TTL instead of publishing a blank.
    if (got.reached) {
      out[acct] = got.domain;
      if (got.domain) st.resolved++; else st.none++;
    } else {
      st.unreachable++;
    }
    if (cache) {
      const res = new Response(got.domain, {
        headers: {
          'cache-control': 'public, max-age=' + (got.reached ? TTL_OK : TTL_FAIL),
          [H_REACHED]: got.reached ? '1' : '0',
        },
      });
      await cache.put(key, res).catch(() => {});
    }
  });

  const all = Promise.all(work);
  if (ctx && ctx.waitUntil) ctx.waitUntil(all.catch(() => {}));
  await Promise.race([
    all.catch(() => {}),
    new Promise((r) => setTimeout(r, DEADLINE_MS)),
  ]);
  return out;
}
