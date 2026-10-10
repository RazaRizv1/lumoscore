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
const { LZ_LIVE } = require(__dirname + '/_lzflag.js');
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
    desc: LZ_LIVE
      ? 'Swap tokens, provide liquidity, bridge assets across 52 chains and launch your own asset on Stellar. Non-custodial — you sign every transaction.'
      : 'Swap tokens, provide liquidity, bridge USDC across 8 chains and launch your own asset on Stellar. Non-custodial — you sign every transaction.',
  },
  'home': {
    title: 'Dashboard — Your Stellar Portfolio | ' + BRAND,
    // wallet list verified against the connect modal — Hana is NOT supported, do not re-add it
    desc: 'Track your Stellar portfolio, trending assets, pool liquidity and recent activity in one view. Connect Freighter, Rabet, Albedo, xBull or WalletConnect.',
    // WALLET-GATED: not viewable signed out, so it must never be indexed (RAZA 2026-10-10).
    // lx-authgate is client-side only -- it reads localStorage and does location.replace("/"). A
    // crawler has no localStorage, so it got 200 and the full shell while this table said
    // "index, follow" and the sitemap listed it. Measured on production: 383KB served to Googlebot,
    // with dollar figures on a page whose title promises the reader their OWN portfolio.
    // Also removed from SITEMAP_SKIP's inverse in extract_site.js and given an X-Robots-Tag header.
    noindex: true,
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
  // CCTP_DOMAINS in _tools/_cctp.js is the source of truth for the CCTP half and lists SEVENTEEN destinations as
  // of 2026-09-23: the original eight plus Codex, Sonic, XDC, Plume, Pharos, Cronos, Unichain, Morph and X Layer. Solana, Sui, Aptos,
  // Starknet and Injective are CCTP domains that are deliberately NOT offered, because none has a claim a user
  // could actually make -- see the note above that constant. The title must never count those: this is the page
  // that has to answer "which chains?" for an answer engine, and it once claimed two that could not be reached.
  //
  // FIFTY-TWO: 17 + 21 - 7 = 31 across CCTP and LayerZero, plus the twenty only NEAR Intents reaches, plus XRPL,
  // which ONLY Axelar reaches (and which is the whole reason that fourth route exists). The twenty are (BNB
  // Chain, Gnosis, Scroll, Hood, ADI, Bitcoin, Solana, Tron, TON, Near, Sui, Starknet, Cardano, Litecoin,
  // Dogecoin, Bitcoin Cash, Zcash, Dash, Movement, Fogo). Every one of those twenty was proved with a live
  // dry quote using a correct address for its chain -- XRP, Abstract, Aleo and HyperCore were tested the same way
  // and are deliberately absent, as is Aptos (the re-skin engine renames it). The seven counted out are Ethereum, Arbitrum, Optimism, Polygon,
  // Unichain, Morph and X Layer, which both routes serve. Adding those last three raised the CCTP count without
  // moving the total, which is exactly the point: they are a second route on a row that already existed, not a
  // new destination. Neither half is copied from a vendor page. The LayerZero 21 is complete BY
  // MEASUREMENT: every mainnet eid from 30101 to 30700 went through peer() on the live OFT on 2026-09-23 (600
  // simulations, no failures) and exactly 21 answered. The CCTP 17 is verified the same way -- eth_getCode at
  // MessageTransmitterV2 returned the same 2175 bytes as the Base control on each new chain. So the count cannot
  // quietly drift as either vendor adds deployments; only a re-scan can change it.
  'bridge': LZ_LIVE ? {
    title: 'Bridge Assets to 52 Chains from Stellar | ' + BRAND,
    desc: 'Move native USDC with Circle CCTP, USDT0 with LayerZero, or any major token with NEAR Intents, between Stellar and 52 chains. Nothing arrives wrapped.',
  } : {
    title: 'Bridge USDC to 8 Chains from Stellar — Circle CCTP | ' + BRAND,
    desc: 'Move native USDC between Stellar and Ethereum, Base, Arbitrum, Optimism, Polygon, Avalanche, Linea and World Chain using Circle CCTP. Burn-and-mint, so no wrapped tokens.',
  },
  'wallet': {
    title: 'Stellar Wallet — Balances, Send and Receive | ' + BRAND,
    desc: 'View your Stellar balances and portfolio value, send and receive assets, manage trustlines and swap — all non-custodial, signed in your own wallet.',
    // WALLET-GATED: same reasoning as 'home' above. 427KB of app shell was being served to Googlebot
    // under a title offering to show the reader their balances. It also carried the site's only
    // FAQPage schema, which is now on /faq where it can actually earn a rich result.
    noindex: true,
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
    // ONE MCP PAGE FOR THE WHOLE PLATFORM: there is a single connector however many networks LumosCore
    // runs, so the title stopped naming one chain when the body stopped.
    title: 'LumosCore MCP — Connect Your AI Agent On-Chain | ' + BRAND,
    // 172 characters before this, so the tail was being cut mid-claim in results. "No install, no API
    // key" is the shorter half and the one worth keeping whole.
    desc: 'Give Claude, ChatGPT or any MCP client live prices, wallets, pools and routes from LumosCore, with every transaction prepared for you to approve. No API key.',
  },
  'signin': {
    title: 'Sign In | ' + BRAND,
    desc: 'Connect a Stellar wallet to use LumosCore.',
    noindex: true,   // nothing to rank for, and a sign-in page in results is a bad first impression
  },

  // ---- THE PAGES THIS FILE USED TO SKIP -------------------------------------------------------
  //
  // Until 2026-10-10 _seo.js printed "NO ENTRY for -> account, blog, privacy, terms, support,
  // whitepaper, docs-*, about, list-token" on every run -- twenty-six keys it did not manage. Their
  // titles and descriptions were baked into the containers by nothing in particular, owned by no tool,
  // and every one of them broke the standard set at the top of this file: titles ~50-60 chars,
  // descriptions ~150-160.
  //
  // Measured in the containers, not guessed: all seventeen docs pages had titles of 20-35 characters
  // ("Fees | LumosCore Docs" is 21) and descriptions of 66-94. A 21-character title throws away two
  // thirds of the width Google will give it, and the docs are the pages that answer "how do stellar
  // trustlines work" -- the queries with the clearest intent on the whole site.
  //
  // EVERY DESCRIPTION BELOW IS WRITTEN FROM WHAT THE PAGE ACTUALLY SAYS. The old one-liners were read
  // first and are preserved in substance; nothing here promises a section a page does not have. That
  // matters more than usual in docs, where a description that oversells is found out in one click.
  'about': {
    title: 'About LumosCore — Non-Custodial Multichain DeFi | ' + BRAND,
    desc: 'Multichain Web3 infrastructure from LumosCore OÜ: one interface for trading, liquidity, token issuance and cross-chain transfers, with custody left to you.',
  },
  'support': {
    title: 'Support — Report an Issue or Ask a Question | ' + BRAND,
    desc: 'Get in touch with the LumosCore team about trading, liquidity pools, cross-chain transfers or a token launch. Tell us what happened and we will reply by email.',
  },
  'whitepaper': {
    title: 'Whitepaper — Architecture, Fees and Token Model | ' + BRAND,
    desc: 'The LumosCore whitepaper: fragmentation, interoperability, and a non-custodial architecture for trading, liquidity and cross-chain transfers.',
  },
  'terms': {
    title: 'Terms of Use — Eligibility, Risk and Fees | ' + BRAND,
    desc: 'The terms governing use of LumosCore, operated by LumosCore OÜ in Estonia — eligibility, trading risk, fees and limitation of liability.',
  },
  // "No cookies, no accounts" is a genuine differentiator and belongs in the title, not buried in the
  // body: it is the thing a privacy-minded reader is scanning the result for.
  'privacy': {
    title: 'Privacy Policy — No Cookies, No Accounts | ' + BRAND,
    desc: 'What LumosCore records and what it does not. No cookies, no account, non-custodial — and a plain account of the one thing we do store.',
  },
  'list-token': {
    title: 'List Your Token — Curated Stellar Listings | ' + BRAND,
    desc: 'Apply for a curated listing on LumosCore. $250, paid in XLM, refunded in full if the listing is declined. Reviewed by a person, not a script.',
  },
  // The blog INDEX. Individual posts are titled at the edge from KV (blogSeo in the middleware), so
  // this entry must never describe a specific post -- it is the list page.
  'blog': {
    title: 'Blog — Stellar DeFi Guides and Product News | ' + BRAND,
    desc: 'Guides and product news from LumosCore: how trading, liquidity pools, rewards and cross-chain transfers work on Stellar, and what we have shipped.',
  },
  // SOMEONE ELSE'S ADDRESS, read off the public ledger, one page per account. Deliberately generic:
  // the real title is written at the edge where the address is known, and a baked title must not
  // claim to describe a specific account.
  'account': {
    title: 'Stellar Account — Balances, Assets and Activity | ' + BRAND,
    desc: 'Public profile for any Stellar account: XLM and asset balances, trustlines, liquidity pool participation and recent on-chain activity.',
  },

  // ---- DOCS ------------------------------------------------------------------------------------
  'docs-introduction': {
    title: 'Introduction — How LumosCore Works | ' + BRAND + ' Docs',
    desc: 'What LumosCore is, what runs on it today, and how the non-custodial model works: you hold your own keys and sign every transaction yourself.',
  },
  'docs-connect-a-wallet': {
    // Trimmed to clear Google's ~60-character cut. Naming three of the five wallets pushed it to 62,
    // and a truncated title loses the brand, not the wallet names. "how to connect a stellar wallet"
    // is also the way the question is actually typed.
    title: 'How to Connect a Stellar Wallet | ' + BRAND + ' Docs',
    desc: 'The five supported Stellar wallets, how connecting works, and exactly what LumosCore can and cannot do once a wallet is connected to it.',
  },
  'docs-fees': {
    title: 'Trading Fees on Stellar — 0.2% or 0.1% | ' + BRAND + ' Docs',
    desc: 'What LumosCore charges on a swap, the LUMOS holder discount tier, why limit orders are free, and which costs belong to the Stellar network itself.',
  },
  'docs-swaps': {
    title: 'Swaps on the Stellar DEX — Routing and Slippage | ' + BRAND,
    desc: 'How a trade is routed across the Stellar order book and AMM pools, how price and slippage are determined, and what you approve before signing.',
  },
  'docs-limit-orders': {
    title: 'Limit Orders on Stellar — Free Resting Orders | ' + BRAND,
    desc: 'How resting orders work on the Stellar order book, why LumosCore charges nothing for them, and how to track or cancel one from your own wallet.',
  },
  'docs-liquidity-pools': {
    title: 'Stellar Liquidity Pools — Add, Withdraw, Create | ' + BRAND,
    desc: 'Adding and withdrawing liquidity on Stellar, creating a new pool, what pool shares represent, and the risks of providing liquidity before you commit.',
  },
  // THREE ROUTES, NOT ONE. The old description said "between Stellar and eight networks over Circle's
  // CCTP", which was true when CCTP was the only route and has been wrong since LayerZero and NEAR
  // Intents went live (2026-09-19). Deliberately does NOT repeat the "burn-and-mint, nothing arrives
  // wrapped" line used on the Bridge page: that is true of CCTP, and NEAR Intents is an intent/swap
  // model, so as a blanket claim about all three it would be false.
  'docs-cross-chain': {
    title: 'Cross-Chain Transfers from Stellar | ' + BRAND + ' Docs',
    desc: 'Moving assets between Stellar and other networks using Circle CCTP, LayerZero and NEAR Intents — three routes, each with its own supported chains.',
  },
  'docs-wallet': {
    title: 'Stellar Wallet — Balances, Send and Receive | ' + BRAND + ' Docs',
    desc: 'Viewing balances and activity, sending and receiving Stellar assets, and managing trustlines, all without giving up custody of your keys.',
  },
  'docs-trustlines': {
    title: 'Stellar Trustlines Explained | ' + BRAND + ' Docs',
    desc: 'Why Stellar needs a trustline before you can hold an asset, what XLM reserve each one locks up, and how to add or remove them on LumosCore.',
  },
  'docs-rewards': {
    title: 'LUMOS Rewards — Eligibility and Payout Rounds | ' + BRAND,
    desc: 'The three LUMOS reward programmes, who is eligible for each, how eligibility is measured on-chain, and when each round pays out.',
  },
  'docs-launch-a-token': {
    title: 'Launch a Token on Stellar — Flat $25, No Code | ' + BRAND,
    desc: 'Issuing an asset on Stellar mainnet: the flow step by step, the flat $25 cost, what you receive, and why the issuing account is locked afterwards.',
  },
  'docs-asset-metadata': {
    title: 'Stellar Asset Metadata — stellar.toml and Logos | ' + BRAND,
    desc: 'What the SEP-1 stellar.toml file is, which fields LumosCore reads from it, and how to publish a name, description and logo for your own asset.',
  },
  'docs-verification': {
    title: 'Stellar Asset Verification | ' + BRAND + ' Docs',
    desc: 'How the home_domain and stellar.toml handshake proves an asset is yours, what the verified mark on LumosCore means, and what it deliberately does not.',
  },
  'docs-curated-listing': {
    title: 'Curated Listing on LumosCore — Apply and Review | ' + BRAND,
    desc: 'How to apply for a curated listing, what the review covers, how the decision is made, and the full refund if an application is declined.',
  },
  'docs-security': {
    title: 'Security and Custody — What We Never Ask For | ' + BRAND,
    desc: 'The LumosCore custody model, what we will never ask you for, how every transaction is signed in your own wallet, and the risks that remain.',
  },
  'docs-troubleshooting': {
    title: 'Troubleshooting — Common Errors and Fixes | ' + BRAND + ' Docs',
    desc: 'The errors people actually hit on Stellar: underfunded accounts, missing trustlines and failed signatures — what each means and how to clear it.',
  },
  // THE POST TEMPLATE, AND IT MUST STAY GENERIC. One file serves every post, so a real post's title
  // and description are written at the edge from KV (blogSeo in the middleware) and overwrite whatever
  // is baked here. This entry is only ever seen in the fallback case -- a KV read that threw -- so it
  // describes the blog, never a post. Anything specific here would be a confident lie about whichever
  // post failed to load. It replaces a 14-character "LumosCore Blog", which was the title the old
  // soft-404 served for every nonexistent slug.
  'blog-post': {
    title: 'Blog — Stellar DeFi Guides and Product News | ' + BRAND,
    desc: 'Guides and product news from LumosCore: how trading, liquidity pools, rewards and cross-chain transfers work on Stellar, and what we have shipped.',
  },
  // /faq AND /docs/faq are the same page; the canonical points at /faq. One entry covers both,
  // because baseName() keys on the file and the file is shared.
  'docs-faq': {
    title: 'FAQ — Trading, Pools, Fees and Cross-Chain | ' + BRAND,
    desc: 'Answers to the most common questions about trading, liquidity pools, fees, cross-chain transfers, wallets and launching a token on LumosCore.',
  },
};

// Every admin page is noindex — belt and braces alongside Cloudflare Access and the noindex header,
// in case a page is ever served from somewhere unexpected.
const ADMIN = { title: 'Admin — ' + BRAND, desc: '', noindex: true };

function baseName(key) {
  return key.replace(/^lumoscore-/, '').replace(/\.html$/, '')
            .replace(/-(dark|light|mobile)$/, '');
}

function esc(s){return (String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')).split(String.fromCharCode(39)).join("&#39;");}

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
