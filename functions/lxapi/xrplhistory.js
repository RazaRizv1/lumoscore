// Recent exchanges for one token — the Trade-Asset page's "Exchanges" tab.
//
// PROXIED, NOT FETCHED FROM THE BROWSER, for the reason every xrpl.to call in this folder is: the
// anonymous tier is 333 requests a DAY per IP, and this endpoint additionally rate-limits at 2 per
// SECOND — hit while writing this, which is exactly what a page doing its own fetch would do to a
// visitor. One cached call here serves everyone looking at the same token.
//
// WHAT A ROW IS. The upstream returns each LEG of a fill, with `paid` and `got` as
// { currency, issuer, value } — XRP included, as a plain value rather than drops. A path payment
// that routes through this token produces two legs with the same timestamp, and both are real
// exchanges on the ledger, so both are returned rather than collapsed into a guess about which one
// "was" the trade.
//
// Nothing is interpreted here. Buy-or-sell depends on which side the page's own token is, and only
// the page knows that, so the legs travel as they came and the browser decides.

import { tokenId } from './_tokenid.js';

const UP = 'https://api.xrpl.to/api';
const TTL = 60;                    // trades are live; a minute is enough to absorb a page refresh

const json = (body, secs) => new Response(JSON.stringify(body), {
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=' + secs,
    'access-control-allow-origin': '*',
  },
});

const num = (v) => { const n = Number(v); return isFinite(n) ? n : null; };

// Both sides come through unchanged in shape but checked in type: a NaN value would render as a
// price of "—" at best and as garbage at worst, and these rows sit under a column headed "Price".
function side(s) {
  if (!s || typeof s !== 'object') return null;
  const v = num(s.value);
  if (v == null || v <= 0) return null;
  return { c: String(s.currency || ''), i: String(s.issuer || ''), v: v };
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  let id = (url.searchParams.get('id') || '').trim().slice(0, 120);
  if (!id) id = await tokenId(url.searchParams.get('iss'), url.searchParams.get('cur'));
  if (!id) return json({ ok: false, error: 'unknown token', rows: [] }, 60);

  // 100, not 40 (RAZA 2026-09-17: "for keep looking. XRP is taking too long"). Every page is a round trip to a provider
  // that allows about two calls a second, so the page SIZE is what decides how deep a click can reach in a given time.
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('n') || '15', 10) || 15));

  // FURTHER BACK THAN THE LATEST PAGE (RAZA 2026-09-16: "it looks back to maybe hundreds or even thousands of transactions.
  // And keeps looking back couple thousands back if user keeps clicking keep looking"). The upstream pages this feed; only
  // page 0 was ever asked for, so a token whose recent legs were all below a size filter showed an empty table with more
  // history sitting one page away. Capped at 50 pages — 2,000 legs — which is as far as the button can walk.
  const page = Math.min(50, Math.max(0, parseInt(url.searchParams.get('p') || '0', 10) || 0));

  // Versioned: Cloudflare's Cache API survives a deploy, so a shape change would otherwise keep
  // serving the previous build's rows. Same reason as /lxapi/xrplchart and /lxapi/xrplbridge.
  const CACHE_V = '1';
  const cache = caches.default;
  const key = new Request(url.origin + url.pathname + '?v=' + CACHE_V + '&id=' + id + '&n=' + limit + '&p=' + page, request);
  const hit = await cache.match(key);
  if (hit) return hit;

  let out;
  try {
    const headers = { accept: 'application/json', 'user-agent': 'LumosCore/1.0 (+https://lumoscore.com)' };
    if (env && env.XRPLTO_API_KEY) headers['x-api-key'] = env.XRPLTO_API_KEY;

    // ONE REFUSAL IS NOT AN OUTAGE (RAZA 2026-09-17, SOLO's table reading "Recent exchanges are unavailable right now.").
    // This endpoint rate-limits at about two calls a SECOND, and a page that asks for its chart, its token row and its
    // trades at once can trip that on its own. A 429 is retried once here, where the wait costs the visitor nothing —
    // the browser's own retry is 1.5s away and the reader is watching an empty table meanwhile.
    const path = '/history?md5=' + encodeURIComponent(id) + '&page=' + page + '&limit=' + limit;
    let r = await fetch(UP + path, { headers });
    if (r.status === 429) {
      await new Promise((res) => setTimeout(res, 700));
      r = await fetch(UP + path, { headers });
    }
    if (!r.ok) throw new Error('upstream ' + r.status);
    const j = await r.json();

    const rows = ((j && j.data) || [])
      .map((h) => {
        const paid = side(h.paid), got = side(h.got);
        if (!paid || !got) return null;                 // a leg missing a side is not a trade
        return {
          maker: String(h.maker || ''), taker: String(h.taker || ''),
          paid, got,
          t: num(h.time), hash: String(h.hash || ''),
          amm: !!h.isAMM,
        };
      })
      .filter(Boolean);

    out = {
      ok: true, count: rows.length, rows,
      // Contractual, and the upstream restates it in every response body.
      src: 'xrpl.to', attribution: 'Data by xrpl.to', attributionUrl: 'https://xrpl.to',
    };
  } catch (e) {
    return json({ ok: false, error: String((e && e.message) || e), rows: [] }, 30);
  }

  const res = json(out, TTL);
  context.waitUntil(cache.put(key, res.clone()));
  return res;
}
