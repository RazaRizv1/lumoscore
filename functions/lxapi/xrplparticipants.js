// How many wallets hold a pool's LP token — the Pools list's "Participants" column.
//
// RAZA reported the same pool twice (2026-09-16 and 2026-09-17): "ARMY / LUMOS pool still shows no participants on pools
// main page, but it does have one participant as shown inside." The upstream pool list leaves `lpHolderCount` null on a
// lot of pools, so the column was repaired in the browser: amm_info for the LP token, then a holder count, two calls per
// row, straight from the reader's own IP to a public cluster. Searching "army" put twenty-five such rows on screen at
// once — fifty requests in a burst — and whatever the cluster refused was swallowed by a catch and left an em dash that
// nothing ever retried.
//
// One call per pool from HERE instead: cached at the edge for everyone looking at the same table, off the visitor's IP,
// and with a real answer or a real error rather than silence.
//
// WHAT IS COUNTED. The AMM account issues the LP token, so every liquidity provider holds a trust line to it. Its own
// trust lines for the pooled assets sit in the same list, which is why the LP currency is read first and only lines in
// that currency are counted. A line with a zero balance is a provider who has withdrawn, and is not a participant.
// NOT xrplcluster.com. That is the node the BROWSER uses on this site, and it answers a Cloudflare Worker with 418
// "usage exceeded" — measured from this very endpoint — because Workers egress from shared addresses it has already
// spent. Ripple's own public nodes answer normally from here; both are listed so one being down is not an outage.
const RPCS = ['https://s1.ripple.com:51234/', 'https://s2.ripple.com:51234/', 'https://xrplcluster.com/'];
const TTL = 300;
const MAX_PAGES = 5;               // 400 lines a page: a pool with more than 2,000 providers reports what it counted

const json = (body, secs) => new Response(JSON.stringify(body), {
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=' + secs,
    'access-control-allow-origin': '*',
  },
});

async function rpc(method, params) {
  let last = null;
  for (const node of RPCS) {
    let r;
    try {
      r = await fetch(node, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': 'LumosCore/1.0 (+https://lumoscore.com)' },
        body: JSON.stringify({ method, params: [params || {}] }),
      });
    } catch (e) { last = new Error('ledger unreachable'); continue; }
    if (!r.ok) { last = new Error('ledger ' + r.status); continue; }   // a refusal is this NODE's answer: ask the next
    const j = await r.json().catch(() => null);
    const res = j && j.result;
    if (!res) { last = new Error('ledger unavailable'); continue; }
    // An error the ledger itself reports (actNotFound, and so on) is a real answer — every node will give the same one.
    if (res.error) throw new Error(res.error_message || res.error);
    return res;
  }
  throw last || new Error('ledger unavailable');
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const acct = (url.searchParams.get('acct') || '').trim();
  // An r-address and nothing else: this value is pasted into a ledger request.
  if (!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(acct)) return json({ ok: false, error: 'bad account' }, 300);

  const cache = caches.default;
  const key = new Request(url.origin + url.pathname + '?v=1&acct=' + acct, request);
  const hit = await cache.match(key);
  if (hit) return hit;

  let out;
  try {
    const info = await rpc('amm_info', { amm_account: acct, ledger_index: 'validated' });
    const lp = info && info.amm && info.amm.lp_token;
    if (!lp || !lp.currency) throw new Error('not an AMM account');

    let total = 0, marker, pages = 0, complete = true;
    for (;;) {
      const p = { account: acct, limit: 400, ledger_index: 'validated' };
      if (marker) p.marker = marker;
      const r = await rpc('account_lines', p);
      ((r && r.lines) || []).forEach((l) => {
        if (l.currency !== lp.currency) return;          // the pool's own asset lines, not its LP token
        if (Number(l.balance) === 0) return;             // withdrawn in full
        total++;
      });
      marker = r && r.marker;
      if (!marker) break;
      if (++pages >= MAX_PAGES) { complete = false; break; }
    }

    out = { ok: true, acct, currency: lp.currency, total, complete };
  } catch (e) {
    // No count is better than a wrong one, and the caller shows what it already had.
    return json({ ok: false, acct, error: String((e && e.message) || e) }, 30);
  }

  const res = json(out, TTL);
  context.waitUntil(cache.put(key, res.clone()));
  return res;
}
