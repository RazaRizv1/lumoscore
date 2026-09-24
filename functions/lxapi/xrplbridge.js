// Chains reachable from the XRP Ledger through Axelar.
//
// Replaces a page driven by `lx-cctp-js` (~123KB of Circle CCTP), which moved USDC between STELLAR
// and eight EVM chains. Wrong bridge, wrong source chain, on a page whose own heading already said
// "via Axelar".
//
// THE LIST IS FETCHED, NOT HARDCODED. Axelar publishes its live chain registry, and XRPL is in it
// (id "xrpl", chain_type "vm", native XRP) alongside 83 others. A hardcoded list would be wrong the
// first time Axelar adds or removes a chain, and a bridge page that offers a route which no longer
// exists is worse than one that offers fewer.
//
// WHAT THIS DOES NOT DO: quote or execute a transfer. That needs Squid's routing API (which requires
// an x-integrator-id we do not have) and a signed transaction moving real funds. The page says so
// rather than showing a button that looks like it works.

const UP = 'https://api.axelarscan.io/api';
const TTL = 900;                       // the chain registry changes rarely

const json = (body, secs) => new Response(JSON.stringify(body), {
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=' + secs,
    'access-control-allow-origin': '*',
  },
});

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // Versioned, because Cloudflare's Cache API survives a deploy: a 15-minute entry kept serving the
  // previous build's shape and `supportedCount` came back undefined from a Worker that plainly
  // returned it. Bump on any change to the response shape. Same fix as /lxapi/xrplchart.
  const CACHE_V = '3';

  const cache = caches.default;
  const key = new Request(url.origin + url.pathname + '?v=' + CACHE_V, request);
  const hit = await cache.match(key);
  if (hit) return hit;

  let out;
  try {
    const r = await fetch(UP + '/getChains', {
      headers: { accept: 'application/json', 'user-agent': 'LumosCore/1.0 (+https://lumoscore.com)' },
    });
    if (!r.ok) throw new Error('upstream ' + r.status);
    const raw = await r.json();
    const all = Array.isArray(raw) ? raw : (raw.data || []);

    // Each chain's own assets, for the bridge's "You get" picker (RAZA 2026-09-15: "in You Get … show the native token of
    // the network selected … and in dropdown CELO based assets"). Best-effort: without it every chain offers its native
    // token only.
    const byChain = {};
    try {
      const ra = await fetch(UP + '/getAssets', {
        headers: { accept: 'application/json', 'user-agent': 'LumosCore/1.0 (+https://lumoscore.com)' },
      });
      if (ra.ok) {
        const rawA = await ra.json();
        const list = Array.isArray(rawA) ? rawA : (rawA.data || []);
        for (const a of list) {
          const img = a.image ? (/^https?:/.test(a.image) ? a.image : 'https://axelarscan.io' + a.image) : '';
          for (const k of Object.keys(a.addresses || {})) {
            const sym = String((a.addresses[k] && a.addresses[k].symbol) || a.symbol || '').slice(0, 16);
            if (!sym) continue;
            (byChain[k] = byChain[k] || []).push({ s: sym, img });
          }
        }
      }
    } catch (err) { /* native tokens only */ }

    // XRPL must actually be present. If Axelar ever drops it, this page should say the route is
    // unavailable rather than list 83 destinations you cannot reach from here.
    const xrpl = all.find((c) => c.id === 'xrpl');
    if (!xrpl) return json({ ok: false, error: 'xrpl not in the Axelar registry', rows: [] }, 60);

    const rows = all
      .filter((c) => c.id !== 'xrpl' && !c.deprecated && c.name)
      .map((c) => ({
        id: String(c.id || ''),
        name: String(c.name || ''),
        short: String(c.short_name || c.name || ''),
        type: String(c.chain_type || ''),
        // Axelar's own icon, so the list is not a wall of initials.
        img: c.image ? ('https://axelarscan.io' + c.image) : '',
        native: c.native_token ? { symbol: String(c.native_token.symbol || ''), name: String(c.native_token.name || '') } : null,
        assets: (byChain[c.id] || []).slice(0, 40),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // WHAT AXELAR REACHES IS NOT WHAT THE PAGE OFFERS, and the two had drifted apart.
    //
    // The bridge page drives the design's own destination dropdown, which ships a fixed set of
    // `data-net` options. Filtering those to the ones Axelar can reach leaves 14 — so the page
    // offered 14 while the dashboard's Cross-chain card, reading `count` from here, said 58. One
    // site, two answers to "how many networks", and the card was the more visible of the two.
    //
    // So the intersection is computed HERE, once, and both consumers read it. OFFERED is the design's
    // dropdown transcribed — it is markup, which a Worker cannot see, so it has to be restated. It is
    // only ever used to NARROW the live registry: a name that leaves the dropdown simply stops
    // matching, and a name Axelar drops disappears from `supported` on the next fetch. Neither can
    // invent a route.
    const OFFERED = [
      'Arbitrum', 'Avalanche', 'Base', 'BNB Chain', 'Ethereum', 'Hedera', 'Linea', 'Mantle',
      'Near', 'Optimism', 'Polygon', 'Scroll', 'Sei', 'Solana', 'Starknet', 'Sui',
      'World Chain', 'zkSync Era',
    ];
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const reachable = new Set(rows.map((r) => norm(r.name)));
    const supported = OFFERED.filter((n) => reachable.has(norm(n)));

    out = {
      ok: true,
      source: { id: xrpl.id, name: xrpl.name, native: (xrpl.native_token && xrpl.native_token.symbol) || 'XRP' },
      count: rows.length,
      // What the product actually offers as a destination. `count` stays as Axelar's full reach so
      // nothing that wants the registry size loses it.
      supported,
      supportedCount: supported.length,
      rows,
      // Stated in the payload so the page cannot quietly present itself as functional.
      transfers: false,
      note: 'Route discovery only — transfers are not enabled yet.',
      src: 'Axelar', srcUrl: 'https://axelarscan.io',
    };
  } catch (e) {
    return json({ ok: false, error: String((e && e.message) || e), rows: [] }, 60);
  }

  const res = json(out, TTL);
  context.waitUntil(cache.put(key, res.clone()));
  return res;
}
