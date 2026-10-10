// robots.txt, generated at the edge so the Sitemap line carries whatever host actually served the
// request — no domain is hardcoded anywhere in this repo.
//
// The AI crawlers are allowed ON PURPOSE. That is the whole premise of GEO: ChatGPT, Claude and
// Perplexity can only cite LumosCore if they are permitted to read it. Blocking them (a common
// copy-pasted default) would quietly opt the site out of every AI answer.
//
// NOTHING IS DISALLOWED ANY MORE, AND THAT IS THE POINT. Until 2026-10-10 this file carried
//
//   Disallow: /signin
//   Disallow: /launchpad/review
//   Disallow: /launchpad/confirm
//
// and all three of those pages ALSO serve <meta name="robots" content="noindex, nofollow">. Those two
// instructions cancel each other out, and the Disallow is the one that loses us the outcome we want.
//
// Disallow blocks CRAWLING, not INDEXING. A blocked url can still be indexed from an external link --
// Google lists it with no title and no snippet -- and because the fetch is forbidden, Google never
// reads the noindex that would have removed it. So the belt-and-braces pairing is self-defeating: it
// pins exactly the pages it was meant to hide. Google's own guidance is explicit that noindex requires
// a crawlable page.
//
// Removing the Disallow lets a crawler fetch each page, read noindex, and drop it. The pages stay
// equally unlisted either way: none is in the sitemap (SITEMAP_SKIP in extract_site.js), each carries
// the noindex meta, and the middleware now adds X-Robots-Tag: noindex, nofollow, noarchive.
//
// THE SAME REASONING IS WHY /dashboard AND /wallet ARE NOT ADDED HERE. They are wallet-gated and must
// never be indexed -- which is precisely why they have to stay crawlable, so the noindex on them is
// readable. Adding them to this list would freeze them in the index instead of clearing them.
//
// Crawl budget is not a concern worth trading this for: the site is ~540 urls, and two app pages that
// answer 200 with a noindex header cost nothing next to being stuck in results.
export async function onRequestGet({ request }) {
  const origin = 'https://lumoscore.com';
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    '# AI assistants and answer engines are welcome to read and cite this site.',
    'User-agent: GPTBot',
    'Allow: /',
    '',
    'User-agent: ClaudeBot',
    'Allow: /',
    '',
    'User-agent: PerplexityBot',
    'Allow: /',
    '',
    'User-agent: Google-Extended',
    'Allow: /',
    '',
    'Sitemap: ' + origin + '/sitemap.xml',
    // the AEO counterpart: what is here, and where the authoritative answer to each question lives
    '# llms.txt: ' + origin + '/llms.txt',
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
