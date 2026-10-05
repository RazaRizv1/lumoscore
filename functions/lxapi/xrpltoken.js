// One token's details, for the Trade-Asset page.
//
// The page it serves was the most visibly wrong on the site: `lx-dxadata` ignored the token in the
// URL entirely and rendered Stellar LUMOS -- 105 mentions of XLM and 124 Stellar addresses under a
// title reading "LUMOS price, pools and holders on Stellar", reached by clicking any row in the
// XRP Ledger market table.
//
// Proxied and cached like the other feeds: 333 upstream requests per DAY per IP.
//
// The ORDER BOOK is deliberately not here. It comes straight from the XRP Ledger in the browser via
// book_offers -- there is no rate limit worth proxying for, no third party to trust, and a book is
// the one thing on the page that should be as live as the ledger itself.

// Shared with xrplsearch, so the two surfaces cannot drift apart on what an issuer's home domain is.
import { issuerDomains } from './_issuerdomain.js';

const UP = 'https://api.xrpl.to/api';
const TTL = 60;

const json = (body, secs) => new Response(JSON.stringify(body), {
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=' + secs,
    'access-control-allow-origin': '*',
  },
});

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function upstream(path, env) {
  const headers = { accept: 'application/json', 'user-agent': 'LumosCore/1.0 (+https://lumoscore.com)' };
  if (env && env.XRPLTO_API_KEY) headers['x-api-key'] = env.XRPLTO_API_KEY;
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch(UP + path, { headers });
    if (r.ok) return r.json();
    if (r.status !== 429 || attempt === 1) throw new Error('upstream ' + r.status);
    const ra = Number(r.headers.get('retry-after'));
    await sleep(isFinite(ra) && ra > 0 && ra <= 5 ? ra * 1000 : 1200);
  }
  throw new Error('upstream 429');
}

const num = (v) => { const n = Number(v); return isFinite(n) ? n : null; };

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  // Accepts the upstream's own id forms: "issuer-currencyHex", an md5, or the literal XRP.
  const id = (url.searchParams.get('id') || '').trim().slice(0, 120);
  if (!id) return json({ ok: false, error: 'no id' }, 30);

  const cache = caches.default;
  // Versioned: Cloudflare's Cache API survives a deploy, so a shape change here would otherwise keep
  // serving the previous build's fields. Same reason as /lxapi/xrplchart and /lxapi/xrplbridge.
  const CACHE_V = '2';
  const key = new Request(url.origin + url.pathname + '?v=' + CACHE_V + '&id=' + encodeURIComponent(id), request);
  const hit = await cache.match(key);
  if (hit) return hit;

  let out;
  try {
    const r = await upstream('/token/' + encodeURIComponent(id), env);
    const t = r && r.token;
    if (!t) return json({ ok: false, error: 'not found', id }, 60);

    // `amount` is everything ever issued; `supply` is what is actually circulating. They differ --
    // for LUMOS, 999,955,352 issued against 705,205,451 circulating -- so both travel, labelled.
    out = {
      ok: true,
      id,
      name: String(t.name || ''),
      user: String(t.user || ''),
      issuer: String(t.issuer || ''),
      currency: String(t.currency || ''),
      price: num(t.exch),                    // in XRP
      usd: num(t.usd),
      p24: num(t.pro24h), p7: num(t.pro7d), p1h: num(t.pro1h),
      vol24: num(t.vol24hxrp), trades24: num(t.vol24htx),
      // THE DAY'S RANGE, the same pair /lxapi/xrpltokens sends as `hi`/`lo` (RAZA 2026-09-17: "why is LUMOS high /low not
      // showing up on Trade main page"). The market table builds its rows from the list endpoint; LUMOS alone is fetched
      // from here and folded in, so a field this endpoint did not carry was the one column its row could not fill.
      hi: num((Array.isArray(t.maxMin24h) ? t.maxMin24h : [])[0]),
      lo: num((Array.isArray(t.maxMin24h) ? t.maxMin24h : [])[1]),
      tvl: num(t.tvl), marketcap: num(t.marketcap),
      holders: num(t.holders), trustlines: num(t.trustlines), offers: num(t.offers),
      issued: num(t.amount), circulating: num(t.supply),
      verified: t.verified ? 1 : 0,
      md5: String(t.md5 || ''),
      domain: String(t.domain || ''),
      origin: String(t.origin || ''),
      // NO DESCRIPTION FIELD EXISTS UPSTREAM. Checked by dumping every key the token object carries
      // (130+ of them: whitepaper, social, tags, slug, ext, rsi*, amm*, …) — there is no desc, about
      // or info among them. The issuer's own `xrp-ledger.toml` is no help either: ripple.com, the
      // most-verified issuer on the ledger, publishes VALIDATORS and PRINCIPALS but no [[TOKENS]]
      // block at all. So the Trade-Asset description comes from the token registry or not at all.
      // Don't re-probe this: it costs an upstream call against a 333/day budget.
      src: 'xrpl.to', attribution: 'Data by xrpl.to', attributionUrl: 'https://xrpl.to',
    };
  } catch (e) {
    return json({ ok: false, id, error: String((e && e.message) || e) }, 30);
  }

  // THE LEDGER'S DOMAIN, NOT THE MARKET'S (RAZA 2026-10-06: "On Trade-asset page for many assets like
  // ATOM, the homedomain is showing as X.com and such, even though its showing correctly on search").
  //
  // Search was fixed on 2026-10-02 and this endpoint was not, so one site gave two answers about the
  // same issuer: `firstledger.net` in the search row and `x.com` on the page that row opens. ATOM's
  // issuer r1E7ErLAj4XfbkjUV3E1C57Tgb1TThzW4 is the worked example already written down in
  // _issuerdomain.js — market data says x.com, the AccountRoot says toml.firstledger.net.
  //
  // The difference is who is speaking. xrpl.to's `domain` is supplied by whoever listed the token, so a
  // token can claim anything; the AccountRoot's `Domain` is set by the issuing account in a transaction
  // that account signed. Still not proof of ownership, but an assertion BY the issuer rather than ABOUT
  // it — and on a page carrying a clickable link, that difference is the one that matters.
  //
  // THE CLAIMED DOMAIN IS NOT KEPT AS A FALLBACK, which is deliberate and matches xrplsearch exactly: a
  // row that shows x.com whenever the ledger call is slow, and firstledger.net when it is not, says
  // different things on two loads, and that is worse than saying nothing. The page already removes the
  // link when the field is empty.
  //
  // RESOLVED AFTER the response is otherwise built, and never allowed to fail the request: a domain is a
  // badge, and the price, supply and order book are not worth losing over one.
  //
  // This reads the ledger over public RPC, so it spends no part of the xrpl.to budget — see the breaker
  // note in xrplthumb.js for why that distinction is now load-bearing.
  let domReached = true;
  if (out.issuer) {
    try {
      const map = await issuerDomains([out.issuer], url.origin, context, null);
      domReached = Object.prototype.hasOwnProperty.call(map, out.issuer);
      out.domain = map[out.issuer] || '';
    } catch (e) { out.domain = ''; }
  }

  // An unresolved issuer is cached briefly rather than for the full minute, so the first visitor's slow
  // ledger call does not become everyone else's answer while the per-issuer cache warms.
  const res = json(out, domReached ? TTL : 10);
  context.waitUntil(cache.put(key, res.clone()));
  return res;
}
