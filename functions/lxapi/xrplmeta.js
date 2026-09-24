// Token metadata from XRPLMeta — the description the Trade-Asset page had nothing to fill.
//
// WHY THIS EXISTS, AND WHY IT DID NOT SOONER. `.asset-description` ships with 251 characters about
// USD Coin and Circle, so it cannot be left alone, and it was being REMOVED because nothing here
// could fill it honestly:
//
//   * /lxapi/xrpltoken carries no description — the upstream token object has 130+ fields and not
//     one of them is desc/about/info (checked by dumping the key list).
//   * The issuer's own `xrp-ledger.toml` is the XRPL analogue of stellar.toml, but ripple.com —
//     RLUSD's issuer and the most-verified account on the ledger — publishes no [[TOKENS]] block.
//
// Both of those are true, and the conclusion drawn from them ("there is no description source for
// an XRP Ledger token") was still wrong: XRPLMeta is the ecosystem's metadata service, it aggregates
// exactly the issuer-published metadata those two checks were looking for, and it has descriptions
// for blue-chips and meme tokens alike.
//
// PROXIED rather than fetched from the browser, for the reasons every feed here is: one cached call
// serves every visitor looking at the same token, the page keeps depending on our own origin rather
// than a third party's uptime and CORS policy, and the first uncached upstream call measured slow
// enough that putting it in front of a render would be felt.
//
// THE DESCRIPTION IS ATTACKER-CONTROLLED TEXT. Anyone can issue an XRP Ledger token and publish
// whatever metadata they like for it — that is the whole premise of [[lumoscore-xrpl-hostile-input]],
// and it applies to prose even more than to names. So it is normalised and capped here, and the page
// writes it with textContent, never innerHTML.

const UP = 'https://s1.xrplmeta.org/token/';
// A description changes about never. It was a day, and that was the bug: the cache expired over a
// weekend, the next request went cold into an upstream that takes ~6s to wake, and the paragraph
// RAZA had asked for twice disappeared from the page again. A week fresh, plus a month-long STALE
// copy that is served whenever the upstream is slow or down — see the catch below.
const TTL = 604800;
const STALE_TTL = 2592000;

// Long enough for a real project blurb, short enough that a token cannot push a wall of text into
// the page. ARMY's is ~400 characters, SOLO's ~120.
const MAX = 600;

const json = (body, secs) => new Response(JSON.stringify(body), {
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=' + secs,
    'access-control-allow-origin': '*',
  },
});

// Collapses the CRLF runs real tomls are full of (ARMY's desc arrives with "\r\n\r\n" between
// paragraphs) and drops control characters outright. The cap lands on a word boundary rather than
// mid-word, and only adds an ellipsis when something was actually removed.
//
// The control range is spelled \x00-\x1f ON PURPOSE. Written as literal control characters it is
// invisible in a diff, makes grep call the file binary, and sits one keystroke away from "[ -]" —
// a printable range covering most of ASCII, which would silently shred every description it saw.
function clean(s) {
  let t = String(s || '').replace(/[\x00-\x1f]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length <= MAX) return t;
  t = t.slice(0, MAX);
  const sp = t.lastIndexOf(' ');
  if (sp > MAX * 0.6) t = t.slice(0, sp);
  return t.replace(/[\s.,;:—-]+$/, '') + '…';
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // Strict, so this cannot be turned into an open proxy for arbitrary upstream paths: an r-address
  // and a currency that is either a 3-character code or 40 hex characters. Anything else is refused
  // rather than forwarded.
  const iss = (url.searchParams.get('iss') || '').trim();
  const cur = (url.searchParams.get('cur') || '').trim();
  if (!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(iss)) return json({ ok: false, error: 'bad issuer' }, 3600);
  if (!/^([0-9A-Fa-f]{40}|[A-Za-z0-9?!@#$%^&*<>(){}\[\]|]{3})$/.test(cur)) {
    return json({ ok: false, error: 'bad currency' }, 3600);
  }

  const CACHE_V = '1';
  const cache = caches.default;
  const key = new Request(url.origin + url.pathname + '?v=' + CACHE_V + '&iss=' + iss + '&cur=' + cur, request);
  // The last GOOD answer, kept for a month under its own key. The fresh key expires after a week so
  // descriptions can still update; this one exists purely so an upstream outage or a slow cold start
  // serves yesterday's description instead of deleting the paragraph.
  const staleKey = new Request(url.origin + url.pathname + '?stale=' + CACHE_V + '&iss=' + iss + '&cur=' + cur, request);
  const hit = await cache.match(key);
  if (hit) return hit;

  let out;
  try {
    // THE UPSTREAM HANGS. Measured: the same token that answered in under a second returned nothing
    // at all for 60s a few minutes later, from the Cloudflare edge AND from a local machine — this
    // is a community-run service and it goes slow under load rather than erroring.
    //
    // Without this abort the hang is INHERITED: a request to /lxapi/xrplmeta sat open for the full
    // 60s of the test, because a Worker awaiting a fetch waits as long as the fetch does.
    //
    // TWELVE SECONDS, NOT SIX. Six looked generous against a sub-second happy path, but that is the
    // WARM path. Measured on 2026-09-15 after the cache had expired: the first request took 5.9s
    // and the next two 0.5s and 1.0s. A 6s abort sits right on top of the cold start, so the one
    // request that most needed to succeed — the first after expiry — was the one being cut off.
    // The page does not wait on this (the paragraph stays hidden until it lands), so a slower
    // answer costs nothing; an aborted one costs the description.
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 12000);
    let r;
    try {
      r = await fetch(UP + encodeURIComponent(cur + ':' + iss), {
        headers: { accept: 'application/json', 'user-agent': 'LumosCore/1.0 (+https://lumoscore.com)' },
        signal: ctl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    // A token XRPLMeta has never seen answers 404. That is a real answer, not a failure: it means
    // there is no description, and the page should remove its paragraph rather than retry.
    if (r.status === 404) return json({ ok: true, found: false, desc: '' }, TTL);
    if (!r.ok) throw new Error('upstream ' + r.status);
    const j = await r.json();

    const t = (j && j.meta && j.meta.token) || {};
    const issuer = (j && j.meta && j.meta.issuer) || {};

    out = {
      ok: true,
      found: true,
      desc: clean(t.desc),
      name: clean(t.name).slice(0, 80),
      issuerName: clean(issuer.name).slice(0, 80),
      domain: String(issuer.domain || '').slice(0, 120),
      // 0-3, XRPLMeta's own confidence in the metadata. Carried so the page can decide later whether
      // to show a description at all for an unvetted token; nothing reads it yet.
      trust: Number(t.trust_level) || 0,
      src: 'XRPLMeta', attribution: 'Metadata by XRPLMeta', attributionUrl: 'https://xrplmeta.org',
    };
  } catch (e) {
    // STALE BEATS BLANK. An abort or an upstream error used to go straight to `ok:false`, which the
    // page answers by deleting the paragraph — so a slow minute at XRPLMeta erased a description we
    // had already fetched successfully the day before. If a good answer exists under the stale key,
    // serve that instead, marked so, and only fall back to "no description" when we never had one.
    try {
      const old = await cache.match(staleKey);
      if (old) {
        const body = await old.json();
        if (body && body.ok && body.desc) {
          body.stale = true;
          return json(body, 60);                 // short, so the next request tries upstream again
        }
      }
    } catch (e2) { /* a broken stale entry is the same as none */ }
    return json({ ok: false, error: String((e && e.message) || e), desc: '' }, 60);
  }

  const res = json(out, TTL);
  // Both keys on every success: the fresh one for the next week, the stale one for the month after.
  context.waitUntil(Promise.all([
    cache.put(key, res.clone()),
    cache.put(staleKey, json(out, STALE_TTL)),
  ]));
  return res;
}
