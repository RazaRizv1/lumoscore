// Top holders of one token — the Trade-Asset page's "Holders" tab.
//
// The tab shipped fifty fabricated rows of EVM wallets ("0x00…c3a1  3.14M  12.800%") on a page about
// an XRP Ledger token, with the stats above them invented to match. This is the real thing.
//
// THE UPSTREAM 301-REDIRECTS. `api/richlist/<id>` answers 301 and the payload only arrives if the
// redirect is followed — a plain fetch that does not follow returns 200-with-nothing, which looks
// exactly like "this token has no holders". Workers' fetch follows by default; it is called out here
// because the first manual probe against it came back empty and read as a missing feature.
//
// Proxied for the usual reasons: 333 requests a day per IP, 2 per second, and an API key that must
// not reach the browser.

import { tokenId } from './_tokenid.js';

const UP = 'https://api.xrpl.to/api';
const TTL = 300;                    // a rich list moves slowly; five minutes is generous

const json = (body, secs) => new Response(JSON.stringify(body), {
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=' + secs,
    'access-control-allow-origin': '*',
  },
});

const num = (v) => { const n = Number(v); return isFinite(n) ? n : null; };

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  let id = (url.searchParams.get('id') || '').trim().slice(0, 120);
  if (!id) id = await tokenId(url.searchParams.get('iss'), url.searchParams.get('cur'));
  if (!id) return json({ ok: false, error: 'unknown token', rows: [] }, 60);

  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('n') || '50', 10) || 50));
  // Paging past the first hundred holders (the pool page's Participants list). Bounded, and an integer.
  const start = Math.min(10000, Math.max(0, parseInt(url.searchParams.get('start') || '0', 10) || 0));

  const CACHE_V = '2';
  const cache = caches.default;
  const key = new Request(url.origin + url.pathname + '?v=' + CACHE_V + '&id=' + id + '&n=' + limit + '&start=' + start, request);
  const hit = await cache.match(key);
  if (hit) return hit;

  let out;
  try {
    const headers = { accept: 'application/json', 'user-agent': 'LumosCore/1.0 (+https://lumoscore.com)' };
    if (env && env.XRPLTO_API_KEY) headers['x-api-key'] = env.XRPLTO_API_KEY;

    const r = await fetch(UP + '/richlist/' + encodeURIComponent(id) + '?start=' + start + '&limit=' + limit,
      { headers, redirect: 'follow' });
    if (!r.ok) throw new Error('upstream ' + r.status);
    const j = await r.json();

    const rows = ((j && j.richList) || []).map((h) => ({
      rank: num(h.rank),
      account: String(h.account || ''),
      balance: num(h.balance),
      // Percentage of supply, as the upstream computes it. Not recomputed here: dividing by a supply
      // figure from a different call is how two numbers on one screen end up disagreeing.
      holding: num(h.holding),
      // The biggest holder of a traded token is very often its own AMM pool, and saying so is the
      // difference between "one wallet owns 7%" and "7% is pooled liquidity".
      amm: !!h.isAMM,
      creator: !!h.isCreator,
      frozen: !!h.freeze,
      name: String(h.name || ''),
    })).filter((h) => h.account && h.balance != null);

    // A TRUSTLINE IS NOT A HOLDING (RAZA 2026-10-08: "its showing different count on Pools main page
    // participants column and then inside its showing different on participants box").
    //
    // Measured on rpREX8e8asAiG5vqxYmuDMvNKp2i96vWwA, straight from the ledger: the LP token has 13
    // trustlines and exactly 3 of them carry a balance of zero, so there are 10 liquidity providers.
    // The pools table said 10 and this box said 13, and the detail page showed BOTH — 10 from the
    // pool row, then 13 once the richlist landed and overwrote it. Upstream's `length` counts lines;
    // someone who withdrew everything keeps the line and is not a provider any more.
    //
    // It is the same distinction the LUMOS token page already had to make between holders and
    // trustlines, and a zero row is worth nothing on either page: it renders as a 0.00% participant.
    const kept = rows.filter((h) => h.balance > 0);
    const dropped = rows.length - kept.length;
    // Exact when this page held the whole list, which is every AMM pool — those have tens of
    // providers, not thousands. Past that the upstream total is corrected by what was actually seen,
    // which can still overcount further pages but never reports fewer than it is showing.
    const whole = start === 0 && rows.length < limit;
    const upstreamTotal = num(j && j.length);
    const realTotal = whole ? kept.length
      : Math.max(kept.length, (upstreamTotal == null ? kept.length : upstreamTotal - dropped));

    const s = (j && j.summary) || {};
    out = {
      ok: true,
      total: realTotal,                     // holders with a balance, not trustlines
      summary: { top10: num(s.top10Hold), top50: num(s.top50Hold), frozen: num(s.frozen) },
      start, count: kept.length, rows: kept,
      src: 'xrpl.to', attribution: 'Data by xrpl.to', attributionUrl: 'https://xrpl.to',
    };
  } catch (e) {
    return json({ ok: false, error: String((e && e.message) || e), rows: [] }, 30);
  }

  const res = json(out, TTL);
  context.waitUntil(cache.put(key, res.clone()));
  return res;
}
