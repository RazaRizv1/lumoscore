// Token prices for the XRP Ledger, proxied and cached at the edge.
//
// WHY A PROXY AND NOT A DIRECT BROWSER FETCH. xrpl.to's anonymous tier is 2 requests/second and
// **333 requests per DAY per IP**. A public site cannot spend that from the visitor's own IP: a
// handful of page views exhausts it, and behind CGNAT one exhausted mobile carrier takes out every
// user on it. That is not hypothetical here -- the Stellar side already shipped a search that
// "failed constantly on mobile" for exactly this reason. One request from the edge, cached, serves
// everyone.
//
// PRICES ARE DERIVED, SO THEY ARE CHECKED. Each token carries `exch` (its price in XRP) and the
// response envelope carries `exch.USD` (XRP per USD). USD price = token.exch / envelope.exch.USD.
// Getting that ratio upside down does not throw -- it produces prices wrong by the square of the XRP
// rate, which looks like a plausible number. The Stellar build shipped that exact class of bug once
// (a token page showing $0.00320 against a real $0.0000618, ~52x). So the conversion is validated
// against a KNOWN OUTSIDE VALUE on every fetch: a USD stablecoin must come out near $1, or no USD
// price is served at all.
//
// ATTRIBUTION: xrpl.to's terms require a visible link on any surface showing this data. The browser
// layer renders it. It is echoed in the payload so it cannot be quietly dropped by a later edit
// without the reason being right there.

const UP = 'https://api.xrpl.to/api';
const TTL = 120;                       // seconds at the edge
const MAX_MISSES = 24;                 // still capped: one page view must not become a burst
const PACE = 60;                       // ms between calls; keyed burst is 20/sec, anonymous was 2

// How many 100-token pages of the volume ranking to pull. MEASURED against a real 51-token wallet:
//   top 100 -> 37%   top 200 -> 49%   top 300 -> 55%   top 400 -> 61%   top 500 -> 61%
// Page 5 added nothing, so the tail is tokens with no 24h volume at all rather than tokens the
// ranking has not reached. Three pages was the anonymous-tier compromise; with a key the budget is
// ~33,000 requests a day instead of 333, so this now pulls six and fills far more per-token misses.
const PAGES = 6;

// Always priced, whatever its volume rank. LUMOS trades ~18 XRP/day, far below the top-100 cutoff,
// so a "top tokens" list alone would leave the platform's own token showing a dash.
// 'XRP' is the literal the upstream uses for the native asset. It is NOT in the token rankings --
// those list issued tokens -- so without this the very first row of every wallet, the one showing
// the user's XRP, is the one row with no 24h or 7d figure.
const ALWAYS = [
  'XRP',
  'rsPqeamjpr3Bxu4LhtCgvJEAQusYRRg6Ha-4C554D4F53000000000000000000000000000000',
];

// A slug we are willing to look up individually: an issued token, or the native asset.
const LOOKUPABLE = (s) => s === 'XRP' || /^r[1-9A-HJ-NP-Za-km-z]{24,34}-[0-9A-Fa-f]{40}$/.test(s);

// Issued USD stablecoins, used only as the sanity check on the XRP->USD conversion.
const PEGGED = [
  'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De-524C555344000000000000000000000000000000', // RLUSD
];

const json = (body, secs) => new Response(JSON.stringify(body), {
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=' + secs,
    'access-control-allow-origin': '*',
  },
});

const slugOf = (t) => String(t.issuer || '') + '-' + String(t.currency || '');

async function upstream(path, env) {
  // The User-Agent is REQUIRED, not politeness: without one the upstream answers 403 to every
  // request. Measured, not assumed -- identical calls returned 403 with no UA and 200 with one.
  const headers = { accept: 'application/json', 'user-agent': 'LumosCore/1.0 (+https://lumoscore.com)' };
  // Optional. A free key lifts 333/day to 33K/day; without one this still works, just thinner.
  if (env && env.XRPLTO_API_KEY) headers['x-api-key'] = env.XRPLTO_API_KEY;
  // 429 is expected, not exceptional: the anonymous burst cap is 2/sec and the edge may be sharing
  // an IP with other callers. One backoff retry, honouring Retry-After when it is sane.
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch(UP + path, { headers });
    if (r.ok) return r.json();
    if (r.status !== 429 || attempt === 1) throw new Error('upstream ' + r.status);
    const ra = Number(r.headers.get('retry-after'));
    await sleep(isFinite(ra) && ra > 0 && ra <= 5 ? ra * 1000 : 1200);
  }
  throw new Error('upstream 429');
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const cache = caches.default;
  const key = new Request(url.origin + url.pathname + '?t=' + (url.searchParams.get('t') || ''), request);
  const hit = await cache.match(key);
  if (hit) return hit;

  let out;
  try {
    // Bulk pages, ranked by real 24h volume. `lightweight` drops ~77% of the per-token fields;
    // note it also drops `usd`, which is why the conversion below exists at all.
    const map = {};
    let xrpPerUsd = 0;
    for (let p = 0; p < PAGES; p++) {
      if (p) await sleep(PACE);          // the burst cap applies to these too, not just the misses
      const bulk = await upstream(
        '/tokens?limit=100&start=' + (p * 100) + '&sort=vol24hxrp&order=desc&lightweight=true', env);
      // XRP per USD, from the same response the prices came from -- never a second source, which
      // could be minutes out of step and would show as every token drifting together.
      if (!xrpPerUsd) xrpPerUsd = Number(bulk && bulk.exch && bulk.exch.USD);
      for (const t of ((bulk && bulk.tokens) || [])) {
        const e = Number(t.exch);
        if (!isFinite(e)) continue;
        map[slugOf(t)] = [e, num(t.pro24h), num(t.pro7d)];
      }
    }
    const usdPerXrp = xrpPerUsd > 0 ? 1 / xrpPerUsd : null;

    // THE GUARD. A USD stablecoin priced through this conversion must land near $1. If it does not,
    // the rate is wrong or upside down, and serving USD would be worse than serving none.
    let usdOk = usdPerXrp != null;
    let checked = null;
    if (usdOk) {
      for (const p of PEGGED) {
        const row = map[p];
        if (!row) continue;
        checked = row[0] * usdPerXrp;
        if (!(checked > 0.90 && checked < 1.10)) usdOk = false;
        break;
      }
      if (checked === null) usdOk = false;    // nothing to check against: do not assert USD
    }

    // Anything the page asked for that the top-100 does not cover, up to a strict cap.
    const want = (url.searchParams.get('t') || '').split(',').map((s) => s.trim()).filter(Boolean);
    const misses = [];
    for (const s of ALWAYS.concat(want)) {
      if (!map[s] && misses.indexOf(s) < 0 && LOOKUPABLE(s)) misses.push(s);
    }
    const picked = misses.slice(0, MAX_MISSES);
    for (let i = 0; i < picked.length; i++) {
      // Paced. The anonymous tier's hard burst cap is 2/sec and a 429 here would cost the whole
      // batch, so the calls are spread rather than fired together.
      if (i) await sleep(PACE);
      try {
        const one = await upstream('/token/' + encodeURIComponent(picked[i]), env);
        const t = one && one.token;
        const e = t && Number(t.exch);
        if (isFinite(e)) map[picked[i]] = [e, num(t.pro24h), num(t.pro7d)];
      } catch (e) { /* one missing token is not a failed response */ }
    }

    out = {
      ok: true,
      usd: usdOk ? usdPerXrp : null,          // null = show XRP prices only, never a guessed USD
      usdCheck: checked,                      // what the stablecoin actually came out at
      count: Object.keys(map).length,
      t: map,
      src: 'xrpl.to',
      attribution: 'Data by xrpl.to',
      attributionUrl: 'https://xrpl.to',
    };
  } catch (e) {
    // A price column that says nothing is fine. A price column that says something wrong is not.
    return json({ ok: false, error: String((e && e.message) || e), t: {} }, 0);   // a refusal is never cached
  }

  const res = json(out, TTL);
  context.waitUntil(cache.put(key, res.clone()));
  return res;
}

function num(v) {
  const n = Number(v);
  return isFinite(n) ? n : null;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
