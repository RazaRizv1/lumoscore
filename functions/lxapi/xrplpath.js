// ripple_path_find, run from the edge because the node the browser can reach takes thirty seconds.
//
// RAZA 2026-10-18, two user reports that turned out to be one bug:
//   #1 Dashboard -> Quick actions -> Custom Swap -> Swap: "No route between those two assets right now"
//   #5 Trade-asset swap: "Finding the best route..." sits there
//
// Measured, same request, same account, same amount (RLUSD -> XRP, an amount the account can fund):
//
//   xrplcluster.com        29.1s   1 alternative
//   s2.ripple.com:51234     1.6s   1 alternative      (1.60 / 1.47 / 1.65 over three runs)
//
// Eighteen times slower for an identical answer. Every caller's deadline is shorter than 29s — the
// Trade-asset swap allows 12s, the Custom Swap popup 25s — so the lookup ALWAYS expired. The popup
// then printed "No route between those two assets right now", which is a timeout being reported as a
// fact about the market: the route exists, and s2 returns it in under two seconds.
//
// THE DIRECTION MATTERS AND IS NOT SYMMETRIC. Out of XRP is 0.47s on the same node that takes 29s
// going in, which is why swaps one way felt instant and the other way never finished. See
// [[xrpl-pathfind-direction-asymmetry]].
//
// WHY THIS CANNOT BE FIXED IN THE BROWSER. The fast nodes are unreachable from a page:
// s2.ripple.com:51234 answers `TypeError: Failed to fetch` from https://lumoscore.com (measured).
// And the reverse is also true — xrplcluster.com answers a Cloudflare Worker with 418, which is why
// xrplparticipants.js already lists Ripple's nodes first. Browser and Worker can each reach exactly
// the node the other cannot, so the only way to the fast node is through here.
//
// NOT CACHED, DELIBERATELY. A path-find answer depends on the source account's current balance and
// on the live order book; serving a neighbour's quote to someone else is how a swap gets signed
// against a price that was never theirs. Every call is fresh and `no-store`.
//
// NOT AN OPEN PROXY. One method, and every field is shape-checked before it is forwarded — same rule
// as the holders endpoint. Nothing here takes a URL, a node, or a method name from the caller.
const RPCS = ['https://s2.ripple.com:51234/', 'https://s1.ripple.com:51234/'];

const ACCT = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
const CUR = /^([A-Za-z0-9]{3}|[0-9A-Fa-f]{40})$/;

const json = (body, status) => new Response(JSON.stringify(body), {
  status: status || 200,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    // A quote is per-account and per-moment. Nothing about it may be reused.
    'cache-control': 'no-store',
  },
});

// An amount is either a drops string (XRP) or an issued-currency object. Anything else is refused
// rather than passed through, because "forward whatever arrived" is what makes a proxy open.
// -1 IS NOT A TYPO AND MUST SURVIVE VALIDATION. It is rippled's "fill this from send_max and tell me
// what comes out" idiom, and it is the form the swap panel actually sends:
//
//   destination_amount: '-1'                       (XRP out)
//   destination_amount: { currency, issuer, value: '-1' }   (IOU out)
//   send_max: <what the user is paying>
//
// A validator that insisted on a positive number would have refused every real quote this endpoint
// exists to serve, and the fallback would have hidden it as "the proxy is down" forever.
function okAmount(a) {
  if (typeof a === 'string') return /^-?[0-9]{1,17}$/.test(a);
  if (!a || typeof a !== 'object') return false;
  if (!CUR.test(String(a.currency || ''))) return false;
  if (!ACCT.test(String(a.issuer || ''))) return false;
  return /^-?[0-9]+(\.[0-9]+)?$/.test(String(a.value || ''));
}

function clean(body) {
  const p = (body && body.params) || body || {};
  const src = String(p.source_account || '');
  const dst = String(p.destination_account || '');
  if (!ACCT.test(src) || !ACCT.test(dst)) return null;
  if (!okAmount(p.destination_amount)) return null;

  const out = {
    source_account: src,
    destination_account: dst,
    destination_amount: p.destination_amount,
  };

  // Optional, and capped: this is the list the node walks, so an unbounded one is a cost handed to
  // us by the caller.
  if (Array.isArray(p.source_currencies)) {
    const list = [];
    for (const c of p.source_currencies.slice(0, 10)) {
      if (!c || !CUR.test(String(c.currency || ''))) return null;
      const one = { currency: String(c.currency) };
      if (c.issuer != null) {
        if (!ACCT.test(String(c.issuer))) return null;
        one.issuer = String(c.issuer);
      }
      list.push(one);
    }
    if (list.length) out.source_currencies = list;
  }
  if (p.send_max != null) {
    if (!okAmount(p.send_max)) return null;
    out.send_max = p.send_max;
  }
  // Carried through because the caller asks for 'validated' deliberately — quoting against an
  // unvalidated ledger would price a swap on state that can still change. An enum, not a passthrough.
  if (p.ledger_index != null) {
    const li = String(p.ledger_index);
    if (li !== 'validated' && li !== 'current' && li !== 'closed') return null;
    out.ledger_index = li;
  }
  return out;
}

export async function onRequest(context) {
  const { request } = context;
  if (request.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);

  let body = null;
  try { body = await request.json(); } catch (e) { return json({ ok: false, error: 'bad json' }, 400); }

  const params = clean(body);
  if (!params) return json({ ok: false, error: 'bad params' }, 400);

  let last = 'ledger unavailable';
  for (const node of RPCS) {
    let r;
    try {
      r = await fetch(node, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': 'LumosCore/1.0 (+https://lumoscore.com)' },
        body: JSON.stringify({ method: 'ripple_path_find', params: [params] }),
      });
    } catch (e) { last = 'ledger unreachable'; continue; }
    if (!r.ok) { last = 'ledger ' + r.status; continue; }
    const j = await r.json().catch(() => null);
    const res = j && j.result;
    if (!res) { last = 'ledger unavailable'; continue; }
    // The SAME envelope the browser gets from a node, so the caller's existing handling is unchanged:
    // it reads j.result and nothing else has to know where this came from.
    return json({ ok: true, result: res });
  }
  return json({ ok: false, error: last }, 502);
}
