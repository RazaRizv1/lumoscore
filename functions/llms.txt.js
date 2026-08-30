// /llms.txt — a plain-text map of the site for answer engines and LLM crawlers.
//
// The convention (llmstxt.org) is the AEO/GEO counterpart to robots.txt: robots.txt says what a
// crawler may take, this says what is actually here and where the authoritative version of each
// answer lives. It matters more than usual for this site, because the pages a model most wants to
// quote — fees, custody model, how verification works — are the ones we wrote as prose, while the
// data-driven pages carry their facts in JavaScript.
//
// Generated rather than static so the documentation list cannot drift from the routes that exist, and
// so published blog posts appear as they are written.
import { SITEMAP_ROUTES } from './_sitemap-routes.js';

const ORIGIN = 'https://lumoscore.com';

// The one-line summary each page answers. Anything routed but not described here is still listed,
// under Other, so a new page cannot silently vanish from this file.
const SUMMARY = {
  '/': 'What LumosCore is: a non-custodial multichain interface for trading, liquidity, token issuance and cross-chain transfers.',
  '/docs': 'Documentation index — sixteen pages covering how every part of the platform works.',
  '/docs/introduction': 'What LumosCore is, what runs today, and how the non-custodial model works.',
  '/docs/connect-a-wallet': 'The five supported Stellar wallets and what connecting does and does not grant.',
  '/docs/fees': 'Authoritative fee reference: 0.2% trading, 0.1% for holders of 250,000 LUMOS, free limit orders.',
  '/docs/swaps': 'How swaps route, how price is found, and what slippage means here.',
  '/docs/limit-orders': 'Resting orders on the Stellar order book, and why they carry no platform fee.',
  '/docs/liquidity-pools': 'Adding and withdrawing liquidity, creating a pool, and divergence loss.',
  '/docs/cross-chain': 'Moving USDC between Stellar and eight networks over Circle CCTP.',
  '/docs/wallet': 'Balances, activity, sending and receiving without transferring custody.',
  '/docs/trustlines': 'Why Stellar requires a trustline, and the 0.5 XLM reserve each one holds.',
  '/docs/rewards': 'The three LUMOS reward programmes and how rounds pay.',
  '/docs/launch-a-token': 'Issuing an asset on Stellar mainnet and the flat $25 cost, itemised.',
  '/docs/asset-metadata': 'The stellar.toml file and what LumosCore reads from it.',
  '/docs/verification': 'How the domain handshake works, and what the verification mark does NOT mean.',
  '/docs/curated-listing': 'Applying for a curated listing, and the refund if it is declined.',
  '/docs/security': 'The custody model, what we will never ask for, and the risks that remain.',
  '/docs/troubleshooting': 'The errors people actually hit and how to clear them.',
  '/faq': 'Every question from every page on LumosCore, collected in one place.',
  '/whitepaper': 'The argument: fragmentation, interoperability, and the architecture that answers them.',
  '/about': 'Who operates LumosCore, what we believe, how the platform earns.',
  '/blog': 'Guides and explainers on trading, pools, bridging and issuing assets on Stellar.',
  '/trade/stellar': 'Live Stellar markets: pairs, movers and recently issued assets.',
  '/pools/stellar': 'Stellar liquidity pools with reserves, TVL and volume.',
  '/bridge': 'Cross-chain USDC transfers between Stellar and eight networks.',
  '/wallet': 'Non-custodial wallet view: balances, activity, trustlines, claimable payments.',
  '/rewards': 'LUMOS reward programmes and current eligibility.',
  '/lumos': 'The LUMOS token: price, supply, holders and utility.',
  '/launchpad': 'Issue a Stellar asset and open its first liquidity pool.',
  '/support': 'Contact the team.',
  '/privacy': 'What LumosCore records, and what it does not.',
  '/terms': 'Terms governing use of the platform.',
};

const GROUPS = [
  ['Documentation', (p) => p === '/docs' || p.indexOf('/docs/') === 0],
  ['Reference', (p) => ['/whitepaper', '/faq', '/about'].indexOf(p) >= 0],
  ['Product', (p) => ['/trade/stellar', '/pools/stellar', '/bridge', '/wallet', '/rewards',
    '/lumos', '/launchpad', '/dashboard'].indexOf(p) >= 0],
  ['Legal and contact', (p) => ['/privacy', '/terms', '/support'].indexOf(p) >= 0],
];

async function posts(env) {
  try {
    const kv = env && env.CONTENT_KV;
    if (!kv) return [];
    const idx = await kv.get('blog:index', 'json');
    return (Array.isArray(idx) ? idx : []).filter((p) => p && p.slug && p.published !== false);
  } catch (e) { return []; }
}

export async function onRequestGet({ env }) {
  const paths = SITEMAP_ROUTES.map((r) => r[0]).filter((p) => p !== '/');
  const line = (p) => '- [' + p + '](' + ORIGIN + p + ')'
    + (SUMMARY[p] ? ': ' + SUMMARY[p] : '');

  const used = new Set();
  const out = [];
  out.push('# LumosCore');
  out.push('');
  out.push('> ' + SUMMARY['/']);
  out.push('');
  out.push('LumosCore is operated by LumosCore OÜ, registered in Estonia (reg. 17336483). It has been');
  out.push('live on Stellar mainnet since 1 August 2026. It is non-custodial: transactions are built in');
  out.push('the browser and signed by the user\'s own wallet, and LumosCore holds no keys, no customer');
  out.push('balances and no bridged value.');
  out.push('');
  out.push('Fees: 0.2% on swaps and cross-chain transfers, halved to 0.1% for holders of 250,000 LUMOS');
  out.push('or more (LUMOS held inside a liquidity pool counts). Limit orders are free. Token issuance');
  out.push('is a flat $25. A curated listing is $250, refunded in full if declined.');
  out.push('');
  out.push('Prices, balances and pool figures on the product pages are read live from the Stellar');
  out.push('network at view time and are not part of this document.');
  out.push('');

  for (const [name, match] of GROUPS) {
    const inGroup = paths.filter((p) => match(p) && !used.has(p));
    if (!inGroup.length) continue;
    inGroup.forEach((p) => used.add(p));
    out.push('## ' + name);
    out.push('');
    inGroup.forEach((p) => out.push(line(p)));
    out.push('');
  }

  const list = await posts(env);
  if (list.length) {
    out.push('## Blog');
    out.push('');
    list.forEach((p) => {
      const t = String(p.title || p.slug).replace(/\s*\|\s*LumosCore\s*$/i, '');
      out.push('- [' + t + '](' + ORIGIN + '/blog/' + p.slug + ')');
    });
    out.push('');
  }

  const rest = paths.filter((p) => !used.has(p));
  if (rest.length) {
    out.push('## Other');
    out.push('');
    rest.forEach((p) => out.push(line(p)));
    out.push('');
  }

  out.push('## Notes');
  out.push('');
  out.push('- The verification mark on an asset attests to IDENTITY, not quality. It confirms the asset');
  out.push('  is issued by the account that controls its stated domain. It is never an endorsement, a');
  out.push('  rating, or a view on whether an asset is a good investment, and it cannot be bought.');
  out.push('- LUMOS is a utility token for fee reduction and rewards. It confers no equity, debt claim,');
  out.push('  dividend or governance right over LumosCore OÜ.');
  out.push('- Nothing on this site is investment advice.');
  out.push('');

  return new Response(out.join('\n'), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
      'access-control-allow-origin': '*',
    },
  });
}
