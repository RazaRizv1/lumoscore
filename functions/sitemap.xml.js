// sitemap.xml, generated at the edge.
//
// Two reasons this is a Function rather than a static file:
//   1. every <loc> must be absolute, and the host comes from the request, so no domain is hardcoded;
//   2. the interesting pages are DYNAMIC. /trade/stellar/<ASSET> is one file serving hundreds of
//      assets, and a crawler has no way to discover those urls — nothing links to most of them. This
//      lists the real, currently-liquid ones straight from the chain.
//
// Only assets that actually have a Stellar liquidity pool are listed. Submitting thousands of dead
// tickers would bury the pages that matter and looks like spam.
const STATIC = [
  ['/', '1.0', 'daily'],
  ['/trade/stellar', '0.9', 'daily'],
  ['/pools/stellar', '0.9', 'daily'],
  ['/bridge', '0.8', 'weekly'],
  ['/wallet', '0.7', 'weekly'],
  ['/rewards', '0.7', 'weekly'],
  ['/lumos', '0.8', 'weekly'],
  ['/launchpad', '0.8', 'weekly'],
  ['/dashboard', '0.6', 'weekly'],
  ['/mcp', '0.6', 'monthly'],
];

const MAX_POOLS = 200;

function esc(s){
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
// Horizon writes a reserve as "native" or "CODE:ISSUER"; our urls use "native" or "CODE-ISSUER"
function seg(a){
  if (!a || a === 'native') return 'native';
  const i = a.indexOf(':');
  return i > 0 ? a.slice(0, i) + '-' + a.slice(i + 1) : a;
}

async function livePools(){
  try {
    const r = await fetch(
      'https://horizon.stellar.org/liquidity_pools?limit=' + MAX_POOLS + '&order=desc',
      { cf: { cacheTtl: 1800, cacheEverything: true } });
    if (!r.ok) return [];
    const d = await r.json();
    return ((d._embedded && d._embedded.records) || [])
      .filter(p => (p.reserves || []).length === 2 && +p.total_shares > 0);
  } catch (e) { return []; }
}

export async function onRequestGet({ request }) {
  // always the primary domain, never the pages.dev host: a sitemap full of preview urls invites
  // indexing of the wrong hostname
  const origin = 'https://lumoscore.com';
  const today = new Date().toISOString().slice(0, 10);
  const urls = [];

  for (const [path, priority, freq] of STATIC){
    urls.push({ loc: origin + path, priority, freq });
  }

  const pools = await livePools();
  const seenAsset = new Set();
  for (const p of pools){
    const a = seg(p.reserves[0].asset), b = seg(p.reserves[1].asset);
    const [x, y] = b === 'native' ? [b, a] : [a, b];   // native first = canonical, one url per pool
    urls.push({ loc: origin + '/pools/stellar/' + x + '/' + y, priority: '0.6', freq: 'daily' });
    for (const s of [a, b]){
      if (s === 'native' || seenAsset.has(s)) continue;
      seenAsset.add(s);
      urls.push({ loc: origin + '/trade/stellar/' + s, priority: '0.7', freq: 'daily' });
      urls.push({ loc: origin + '/asset/stellar/' + s, priority: '0.5', freq: 'weekly' });
    }
  }

  const body = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map(u =>
        '  <url><loc>' + esc(u.loc) + '</loc><lastmod>' + today + '</lastmod>'
        + '<changefreq>' + u.freq + '</changefreq><priority>' + u.priority + '</priority></url>'
      ).join('\n')
    + '\n</urlset>\n';

  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
