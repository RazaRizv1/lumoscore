// ON-PAGE SEO / AEO / GEO — layer 1: <title>, meta description, robots.
//
// Baseline before this ran: not one page had a description, canonical, Open Graph tag or any
// structured data, and two titles were plain wrong (the Bridge page's tab said "DEX", all three
// Rewards pages said "My Wallet").
//
// WHAT IS DELIBERATELY NOT HERE YET:
//   * canonical / og:url / sitemap.xml — those are ABSOLUTE urls, so they need the real domain AND
//     the final url scheme. Set SITE below and run _seo_urls.js once both are settled.
//   * per-asset and per-pool metadata — /trade/stellar/<ASSET> is one file served by a rewrite, so
//     every asset would otherwise share one title and one description (duplicate content on exactly
//     the pages that could rank). That is solved at the edge, not here.
//
// Titles: ~50-60 chars so they are not truncated in results. Descriptions: ~150-160 chars, written to
// earn the click and to be quotable by an answer engine — concrete nouns, no marketing air, and NO
// claim the app cannot back up (no "lowest fees", no invented user counts).
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// Fill this in once the domain is live, then run _seo_urls.js for canonical/OG/sitemap.
const SITE = '';   // e.g. 'https://lumoscore.com'

const BRAND = 'LumosCore';

// keyed by the page's base name (theme/device variants all share one entry, because they are the
// same page and will share one canonical url)
const PAGES = {
  'landing': {
    title: 'LumosCore — Trade, Pool and Bridge on Stellar',
    desc: 'Swap tokens, provide liquidity, bridge USDC across 8 chains and launch your own asset on Stellar. Non-custodial — you sign every transaction.',
  },
  'home': {
    title: 'Dashboard — Your Stellar Portfolio | ' + BRAND,
    // wallet list verified against the connect modal — Hana is NOT supported, do not re-add it
    desc: 'Track your Stellar portfolio, trending assets, pool liquidity and recent activity in one view. Connect Freighter, Rabet, Albedo, xBull or WalletConnect.',
  },
  'dex': {
    title: 'Trade on the Stellar DEX — Swap and Limit Orders | ' + BRAND,
    desc: 'Trade any Stellar asset with best-rate routing across the Stellar DEX orderbook and AMM pools. Market swaps or limit orders, non-custodial.',
  },
  'dex-asset': {
    title: 'Asset Price, Pools and Holders on Stellar | ' + BRAND,
    desc: 'Live price, 24h volume, liquidity pools, top holders and recent trades for any Stellar asset — plus buy and sell directly from the same page.',
  },
  'amm': {
    title: 'Stellar Liquidity Pools — TVL, Volume and Fees | ' + BRAND,
    desc: 'Browse every Stellar AMM liquidity pool by total value locked, 24h volume and fees earned. Add or withdraw liquidity and track your own positions.',
  },
  'amm-pool': {
    title: 'Stellar Liquidity Pool — Reserves and Liquidity | ' + BRAND,
    desc: 'Pool reserves, total value locked, 24h volume, fee income and participants for a Stellar AMM pool. Deposit or withdraw liquidity from your own wallet.',
  },
  'bridge': {
    title: 'Bridge USDC Across 10 Chains — Circle CCTP | ' + BRAND,   // was wrongly titled "DEX"
    desc: 'Move native USDC between Stellar, Ethereum, Base, Arbitrum, Optimism, Polygon, Avalanche and more using Circle CCTP. Burn-and-mint, so no wrapped tokens.',
  },
  'wallet': {
    title: 'Stellar Wallet — Balances, Send and Receive | ' + BRAND,
    desc: 'View your Stellar balances and portfolio value, send and receive assets, manage trustlines and swap — all non-custodial, signed in your own wallet.',
  },
  'rewards': {
    title: 'LUMOS Rewards — LP and Holder Incentives | ' + BRAND,     // was wrongly titled "My Wallet"
    desc: 'Earn LUMOS for providing liquidity and holding. Check eligibility, see reward pools and track what you have earned across Stellar liquidity positions.',
  },
  'launch-token': {
    title: 'Launch a Token on Stellar — No Code Required | ' + BRAND,
    desc: 'Issue your own Stellar asset in minutes. Set name, ticker, supply and logo, then mint straight from your wallet. No smart contract and no code needed.',
  },
  'launch-review': {
    title: 'Review Your Token — Stellar Launchpad | ' + BRAND,
    desc: 'Check your token details, supply and issuing account before minting on Stellar mainnet.',
    noindex: true,   // mid-flow step: no standalone value, and indexing it strands people mid-wizard
  },
  'launch-confirm': {
    title: 'Token Launched — Stellar Launchpad | ' + BRAND,
    desc: 'Your Stellar asset has been issued. Share it, add liquidity, or list it for trading.',
    noindex: true,
  },
  'lumos-token': {
    title: 'LUMOS Token — Price, Supply and Utility | ' + BRAND,
    desc: 'LUMOS is the LumosCore platform token on Stellar. See price, supply, holders and liquidity, and how holding 250,000+ LUMOS halves your trading fee.',
  },
  'asset-overview': {
    title: 'Stellar Asset Overview — Supply and Holders | ' + BRAND,
    desc: 'Full profile for a Stellar asset: issuer, circulating supply, holders, trustlines, home domain and the liquidity pools it trades in.',
  },
  'mcp': {
    title: 'LumosCore MCP — Stellar DeFi for AI Agents | ' + BRAND,
    desc: 'Connect Claude and other AI assistants to Stellar via the Model Context Protocol. Query prices, pools and balances in natural language.',
  },
  'signin': {
    title: 'Sign In | ' + BRAND,
    desc: 'Connect a Stellar wallet to use LumosCore.',
    noindex: true,   // nothing to rank for, and a sign-in page in results is a bad first impression
  },
};

// Every admin page is noindex — belt and braces alongside Cloudflare Access and the noindex header,
// in case a page is ever served from somewhere unexpected.
const ADMIN = { title: 'Admin — ' + BRAND, desc: '', noindex: true };

function baseName(key) {
  return key.replace(/^lumoscore-/, '').replace(/\.html$/, '')
            .replace(/-(dark|light|mobile)$/, '');
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function apply(html, meta) {
  // strip anything a previous run added so this is idempotent
  html = html.replace(/\s*<meta name="description"[^>]*>/gi, '')
             .replace(/\s*<meta name="robots"[^>]*>/gi, '')
             .replace(/\s*<meta id="lx-seo"[^>]*>/gi, '');

  if (meta.title) {
    const t = '<title>' + esc(meta.title) + '</title>';
    html = /<title>[\s\S]*?<\/title>/i.test(html)
      ? html.replace(/<title>[\s\S]*?<\/title>/i, t)
      : html.replace(/<head([^>]*)>/i, '<head$1>\n  ' + t);
  }

  const tags = [];
  if (meta.desc) tags.push('<meta name="description" content="' + esc(meta.desc) + '">');
  tags.push(meta.noindex
    ? '<meta name="robots" content="noindex, nofollow">'
    // max-image-preview:large is what makes a rich thumbnail eligible in results and AI answers
    : '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">');

  return html.replace(/<\/title>/i, '</title>\n  ' + tags.join('\n  '));
}

let touched = 0, skipped = [];
for (const chain of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain', 'stellar', 'xrpl']) {
  for (const dev of ['desktop', 'mobile']) {
    const file = `lumoscore-${chain}-${dev}.html`;
    let data; try { data = read(file); } catch (e) { continue; }
    const { json, s, e } = getContents(data);
    let changed = false;

    for (const key of Object.keys(json)) {
      const meta = /^lumoscore-admin-/.test(key) ? ADMIN : PAGES[baseName(key)];
      if (!meta) { if (!skipped.includes(baseName(key))) skipped.push(baseName(key)); continue; }
      json[key] = apply(json[key], meta);
      changed = true; touched++;
    }

    if (changed) {
      const ser = JSON.stringify(json).split('</').join('<' + B + '/');
      fs.writeFileSync(file, data.slice(0, s) + ser + data.slice(e), 'utf8');
    }
  }
}

console.log('seo: title + description + robots on ' + touched + ' page keys');
if (skipped.length) console.log('seo: NO ENTRY for -> ' + skipped.join(', '));
if (!SITE) console.log('seo: SITE is empty — canonical/og/sitemap still pending the real domain');
