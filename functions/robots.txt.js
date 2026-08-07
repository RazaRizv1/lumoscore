// robots.txt, generated at the edge so the Sitemap line carries whatever host actually served the
// request — no domain is hardcoded anywhere in this repo.
//
// The AI crawlers are allowed ON PURPOSE. That is the whole premise of GEO: ChatGPT, Claude and
// Perplexity can only cite LumosCore if they are permitted to read it. Blocking them (a common
// copy-pasted default) would quietly opt the site out of every AI answer.
//
// The launchpad's mid-flow steps are disallowed — they are wizard states, not pages, and a searcher
// landing on "review your token" with no draft sees a broken screen.
export async function onRequestGet({ request }) {
  const origin = 'https://lumoscore.com';
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /signin',
    'Disallow: /launchpad/review',
    'Disallow: /launchpad/confirm',
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
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
