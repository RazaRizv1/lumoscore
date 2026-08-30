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
// Derived from the route table at build time, so a page added to the site is in the sitemap without
// anyone remembering to add it here. That list going stale is exactly how /docs, /faq, /about,
// /whitepaper, /support, /privacy and /terms all ended up unlisted.
import { SITEMAP_ROUTES as STATIC } from './_sitemap-routes.js';

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

// Published posts, newest first. These are the pages meant to rank, so they carry a real lastmod
// from the post's own updatedAt rather than today's date on everything.
async function blogPosts(env){
  try {
    const kv = env && env.CONTENT_KV;
    if (!kv) return [];
    const idx = await kv.get('blog:index', 'json');
    return (Array.isArray(idx) ? idx : [])
      .filter(p => p && p.slug && p.published !== false);
  } catch (e) { return []; }
}

export async function onRequestGet({ request, env }) {
  // always the primary domain, never the pages.dev host: a sitemap full of preview urls invites
  // indexing of the wrong hostname
  const origin = 'https://lumoscore.com';
  const today = new Date().toISOString().slice(0, 10);
  const urls = [];

  for (const [path, priority, freq] of STATIC){
    urls.push({ loc: origin + path, priority, freq });
  }

  for (const p of await blogPosts(env)){
    const when = p.updatedAt || p.publishedAt || p.publishAt;
    let lastmod = today;
    try { if (when) lastmod = new Date(+when || when).toISOString().slice(0, 10); } catch (e) {}
    urls.push({ loc: origin + '/blog/' + p.slug, priority: '0.8', freq: 'weekly', lastmod });
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
      // one url per asset. /asset/stellar/<ASSET> used to be listed too, but the asset-overview page
      // it pointed at was removed (it duplicated Trade-asset). Listing a url that 301s elsewhere is
      // a sitemap smell — submit the destination, not the redirect.
      urls.push({ loc: origin + '/trade/stellar/' + s, priority: '0.7', freq: 'daily' });
    }
  }

  const body = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map(u =>
        '  <url><loc>' + esc(u.loc) + '</loc><lastmod>' + (u.lastmod || today) + '</lastmod>'
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
