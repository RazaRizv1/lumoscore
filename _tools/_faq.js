// AEO / GEO — layer 2: real FAQ content + FAQPage structured data.
//
// Two problems solved at once:
//   1. AEO. Answer engines (Google's AI Overviews, ChatGPT, Claude, Perplexity) quote short, direct
//      answers to real questions. FAQPage schema makes that machine-readable.
//   2. THIN CONTENT. The app pages carried ~280 crawler-visible words, and most of that was the nav.
//      There was nothing to rank. These blocks are genuine page content, not keyword filler.
//
// Rendered as plain visible <h3>/<p> rather than a collapsed accordion: no reliance on the crawler
// expanding anything, and no JS needed to read it.
//
// EVERY ANSWER IS FACT-CHECKED AGAINST THE CODE — these become what AI tools state about LumosCore,
// so a wrong one propagates. Verified while writing:
//   * wallets  = Freighter, Rabet, Albedo, xBull, WalletConnect   (connect modal — NOT Hana)
//   * fee      = 0.2%, or 0.1% holding 250,000+ LUMOS            (_feerate.js: 0.002 / 0.001)
//   * routing  = Horizon /paths/strict-send + /paths/strict-receive (covers DEX orderbook AND AMM
//                pools) plus Soroswap and Aquarius                (_swapcalc.js)
//   * bridge   = Circle CCTP to 9 chains: Ethereum, Base, Arbitrum, Optimism, Polygon, Avalanche,
//                Linea, World Chain                               (_cctp.js)
//   * pool fee = 0.30%, fixed by the Stellar protocol
// No timing claims for the bridge (attestation time varies and is Circle's, not ours), and no FAQ on
// Rewards at all — parts of that page are still placeholder, so there is nothing honest to assert.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const FEE = 'LumosCore charges 0.2% per trade, reduced to 0.1% if you hold at least 250,000 LUMOS. '
          + 'On top of that Stellar itself charges a network fee of a small fraction of a cent.';
const NONCUSTODIAL = 'No. LumosCore is non-custodial and never holds your funds or your keys. '
          + 'Every transaction is built in your browser and signed in your own wallet.';
const WALLETS = 'Freighter, Rabet, Albedo, xBull and WalletConnect. There is no sign-up, password or '
          + 'email — connecting a wallet is the whole process.';

const FAQ = {
  'landing': [
    ["What is LumosCore?", "LumosCore is a non-custodial DeFi platform on Stellar. You can swap assets, provide liquidity to AMM pools, bridge USDC to and from eight other chains and issue your own token, all without giving up custody of your funds."],
    ["Is LumosCore secure?", "LumosCore is non-custodial: we never hold your assets or your keys, and every transaction is signed in your own wallet. There is no account to create. We record your public wallet address once per visit to count usage, and that address is already public on-chain."],
    ["Why trade on LumosCore?", "Low fees at 0.2%, halved for LUMOS holders. Non-custodial throughout, so there are no deposits or withdrawals to wait on. Listings verified by issuer rather than ticker. Trading, pools, token issuance and USDC bridging in one place."],
    ['Which wallets does LumosCore support?', WALLETS],
    ['What does it cost to use LumosCore?', FEE],
    ["Which networks does LumosCore support?", "Trading, liquidity pools and the token launchpad run on Stellar mainnet. USDC can be bridged between Stellar and Ethereum, Base, Arbitrum, Optimism, Polygon, Avalanche, Linea and World Chain using Circle CCTP."],
  ],
  'dex': [
    ['What does it cost to use LumosCore?', FEE],
    ["Do limit orders cost anything?", "No. LumosCore takes no fee on a limit order, because a resting order may never fill and charging upfront would not be fair. You pay only the Stellar network fee, a fraction of a cent, whether or not it fills."],
    ["What is the Curated list?", "Curated is the set of assets LumosCore has checked and chosen to list. Anyone can issue a token under any ticker on Stellar, so we verify which issuer an asset actually comes from before putting it in front of people."],
    ["How do I get an asset onto the curated list?", "Submit the asset code, issuer, description, logo and socials, and pay $250 in XLM or LUMOS. We review it by hand and verify the issuer. Listing is not automatic, but if we say no you get the whole $250 back."],
    ["What happens if my listing is rejected?", "You are refunded in full, in whatever you paid with: XLM comes back as XLM, LUMOS as LUMOS, the same amount you sent. In effect you only pay if the asset is listed."],
    ["How do I promote my token on LumosCore?", "Getting curated puts a token into Trade, into search and onto its own asset page with a verified tick, and funding a pool makes it tradeable. Beyond that you can buy placement at $15 per 1,000 impressions, with a 5,000 minimum, paid in XLM or LUMOS."],
    ["What does advertising on LumosCore cost?", "$15 per 1,000 impressions, with a minimum buy of 5,000 impressions, so $75 to start. Pay in XLM or LUMOS. Your placement is shown to people already trading Stellar assets, so the impressions are an audience rather than traffic."],
    ["How does holding 250,000 LUMOS halve my fees?", "Hold 250,000 LUMOS or more and your fee drops from 0.2% to 0.1% across Trade, Pools and the bridge. There is nothing to stake, lock or claim, and LUMOS held in a liquidity pool counts towards the total too."],
  ],
  'dex-asset': [
    ["What does the issuer address mean?", "Every Stellar asset except XLM is created by an account, and that account’s address is the issuer. It is the asset’s real identity: two tokens can both call themselves USDC and be entirely unrelated."],
    ["What is a trustline?", "A trustline is your account’s permission to hold a given asset, and Stellar will not deliver a token you have not opted into. Each one locks 0.5 XLM of your reserve, released when you remove it."],
    ["How is the price calculated?", "From real trades on the Stellar DEX: what the asset last traded at against XLM, read from the network rather than quoted by us. The dollar figure converts that at the live XLM rate, so the two can disagree."],
    ['What does it cost to use LumosCore?', FEE],
    ["What is a locked issuer address?", "A locked issuer has given up its own signing keys, so no more of the asset can ever be minted and the supply you can see is final. An unlocked issuer can still mint at any time."],
  ],
  'launch-token': [
    ["What does it cost to mint a token?", "A flat $25: $5 to create the token, $10 of starting liquidity that goes into your own pool, and $10 for pool and network setup. You pay in XLM at the live rate, so the total stays $25."],
    ["How do I launch a token on the Launchpad?", "Connect your wallet, set the name, ticker and supply, and choose how much goes into the opening pool. Review shows the exact cost before you sign, and confirming creates the issuer, mints the supply to you and opens the pool."],
    ["Can I add liquidity for my token afterwards?", "Yes. Open Pools, find your token’s pool and add to it whenever you like, since a deeper pool means less price impact for anyone trading it. You can also pair your token with other assets."],
    ["How do I add my token to the curated list?", "Minting here does not curate a token or earn it a verified tick, otherwise anyone could mint themselves one. Submit the code and issuer with your site and socials and pay $250, refunded in full if the review says no."],
  ],
  'amm': [
    ["What is a liquidity pool?", "A pool holds reserves of two assets and lets people swap between them, with the price set by the ratio between the two rather than by an order book. Every swap pays a fee to whoever supplied the reserves."],
    ["How do I create a liquidity pool?", "Choose Create pool, pick two assets and an amount of each. The ratio sets the opening price, so match the market rate. Keep spare XLM: a new pool position is a trustline and locks 0.5 XLM of reserve."],
    ["Do I need to deposit both assets?", "Yes. A pool prices one asset against the other, so it needs both sides, deposited at the pool’s current ratio. If you hold only one of them, swap part of it first."],
    ["Can I withdraw my liquidity at any time?", "Yes, with no lock-up and no waiting period. What comes back is your share of the reserves as they stand then, which will not be the same split you deposited if the price has moved."],
  ],
  'amm-pool': [
    ["How do I add liquidity to this pool?", "Use Add liquidity on this page: enter an amount for either asset and the other side fills in at the pool’s ratio. A first position also opens a trustline, which locks 0.5 XLM, so keep a little spare."],
    ["What do the pool reserves mean?", "The reserves are how much of each asset the pool currently holds. Their ratio is its price and their size is its depth, so a bigger pool absorbs a large trade with less movement."],
    ["What are the risks?", "As prices move the pool sells whichever asset is rising and buys the one falling, so you can withdraw less of the winner than you put in and fees may not cover it. A pool is also only as sound as its two assets."],
  ],
  'bridge': [
    ["How do I bridge USDC to or from Stellar?", "Pick the source and destination chains, enter an amount and approve it in your wallet. The USDC is burned on one chain and minted on the other, never wrapped and never held by us. You then redeem it on the destination chain to finish."],
    ["Do I have to claim the USDC on the other side?", "Yes. A bridge is two halves: LumosCore burns the USDC on the chain you are leaving, and the destination chain only mints once a redeem is submitted there. That redeem is your own transaction, so keep a little of the destination chain’s gas token."],
    ["What if I close the tab before claiming?", "Nothing is stranded. The burn hash, Circle’s message and the attestation, everything a redeem needs, are saved the moment they exist and listed under Awaiting redemption. Come back and finish the transfer whenever you like."],
    ["What is Circle CCTP?", "Circle’s Cross-Chain Transfer Protocol, run by the company that issues USDC. Rather than locking your USDC and handing you a wrapped copy, it destroys it on one chain and issues real USDC on the other."],
    ["Which chains are supported?", "USDC moves between Stellar and Ethereum, Base, Arbitrum, Optimism, Polygon, Avalanche, Linea and World Chain: eight destinations, nine chains in all."],
    ["What are the cross-chain fees?", "LumosCore takes 0.2% of the amount you bridge, or 0.1% if you hold 250,000 LUMOS or more, so send 100 USDC and 99.8 arrives. Circle charges nothing for CCTP itself. You also pay each chain’s network fee."],
    ["Can I bridge my own Stellar asset?", "Not through Cross-chain. It runs on Circle’s CCTP, which moves USDC only, and that is what makes the USDC arriving real rather than wrapped. List your asset and give it a pool, and anyone bridging USDC can swap straight into it."],
  ],
  'wallet': [
    ["What are claimable payments?", "A payment someone has sent that is waiting for you to accept, used when it cannot be delivered straight away, usually because you do not hold a trustline for that asset yet. Add the trustline and claim it."],
    ["How do I add or remove a trustline?", "In Wallet, use Add asset with the code and issuer, or add it from search. To remove one its balance must be zero, so send or swap the remainder first, and that releases the 0.5 XLM it was holding."],
    ["Does LumosCore have access to my wallet?", "No. Your keys stay in your own wallet and never reach us. Every transaction is built in your browser and signed by you, so we cannot move your funds and we cannot sign anything on your behalf."],
  ],
  'rewards': [
    ["When did rewards start on Stellar?", "The three programmes began at different times. Native LP rewards started on 15 December 2025, whale holder rewards on 1 April 2026, and Ecosystem LP rewards on 15 April 2026."],
    ["How often are rewards paid?", "Every round, and rounds run from the 1st and 15th of each month, so twice a month and twelve rounds over a six-month cycle. Ecosystem LP began on 15 April 2026, making 1 October 2026 its twelfth and final round."],
    ["Which assets are in the Ecosystem LP rewards?", "Ten pools, each pairing LUMOS with one other asset: currently LMNR, yXLM, sages, AQUA, SSLX, SHX, TKG, LIBERATOR, KALE and USDC. Each pays 100,000 LUMOS per round, and the ten are reselected every 6 months."],
  ],
  'asset-overview': [
    ['Why does the issuer matter more than the ticker?', 'Stellar lets anyone issue an asset with any code, so a ticker is not an identity — hundreds of distinct assets use the code USDC. The issuing account is what uniquely identifies an asset.'],
    ['What is the difference between holders and trustlines?', 'Trustlines count accounts that have opted in to hold the asset. Holders are the accounts that actually have a non-zero balance, so the holder count is always the smaller number.'],
    ['What is a home domain?', 'A home domain is a website the issuer has linked to their Stellar account, publishing a stellar.toml file with the asset’s details. An asset with no home domain has published nothing verifiable about itself.'],
  ],
  'lumos-token': [
    ['What is LUMOS?', 'LUMOS is the platform token of LumosCore, issued on Stellar. It is used to reduce trading fees and to distribute liquidity and holder incentives.'],
    ['What does holding LUMOS do?', 'Holding at least 250,000 LUMOS halves your LumosCore trading fee from 0.2% to 0.1%. The balance is checked on-chain when you trade.'],
    ['How do I buy LUMOS?', 'LUMOS trades on the Stellar network. You can swap into it from XLM or another asset on the Trade page, using the same routing as any other Stellar asset.'],
  ],
  'mcp': [
    ['What is the Model Context Protocol?', 'MCP is an open standard that lets AI assistants connect to external tools and data. The LumosCore MCP server exposes Stellar market data and account information so an assistant can work with it directly.'],
    ['What can I do with LumosCore MCP?', 'Ask an AI assistant about Stellar asset prices, liquidity pools, account balances and trading activity in plain language, and have it prepare actions for you to review.'],
    ['Can an AI assistant move my funds?', 'No. Signing always happens in your own wallet, where you review and approve every transaction. An assistant can prepare a transaction but cannot authorise one.'],
  ],
};

const CSS = `<style id="lx-faq-css">
.lx-faq{max-width:1180px;margin:8px auto 0;padding:38px 24px 46px;border-top:1px solid var(--border)}
.lx-faq h2{font-size:26px;font-weight:800;letter-spacing:-.01em;color:var(--text);margin:0 0 22px}
.lx-faq-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:22px 34px}
.lx-faq-q{font-size:16px;font-weight:700;color:var(--text);margin:0 0 7px}
.lx-faq-a{font-size:14.5px;line-height:1.7;color:var(--text-muted);margin:0}
@media(max-width:640px){.lx-faq{padding:28px 16px 34px}.lx-faq h2{font-size:21px}}
</'+'style>`.replace("</'+'style>", "</" + "style>");

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function block(items) {
  const qs = items.map(([q, a]) =>
    '<div><h3 class="lx-faq-q">' + esc(q) + '</h3><p class="lx-faq-a">' + esc(a) + '</p></div>').join('');
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(([q, a]) => ({
      '@type': 'Question', name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
  return '<section class="lx-faq" id="faq"><h2>Frequently asked questions</h2>'
       + '<div class="lx-faq-grid">' + qs + '</div></section>'
       + '<script type="application/ld+json" id="lx-faq-ld">'
       + JSON.stringify(ld).replace(/</g, '\\u003c') + '</scr' + 'ipt>';
}

function baseName(key) {
  return key.replace(/^lumoscore-/, '').replace(/\.html$/, '').replace(/-(dark|light|mobile)$/, '');
}

let touched = 0;
for (const chain of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain', 'stellar', 'xrpl']) {
  for (const dev of ['desktop', 'mobile']) {
    const file = `lumoscore-${chain}-${dev}.html`;
    let data; try { data = read(file); } catch (e) { continue; }
    const { json, s, e } = getContents(data);
    let changed = false;

    for (const key of Object.keys(json)) {
      const items = FAQ[baseName(key)];
      if (!items) continue;
      let h = json[key];
      // idempotent: drop whatever a previous run injected
      h = h.replace(/<section class="lx-faq"[\s\S]*?<\/section>/g, '')
           .replace(/<script type="application\/ld\+json" id="lx-faq-ld">[\s\S]*?<\/script>/g, '')
           .replace(/<style id="lx-faq-css">[\s\S]*?<\/style>/g, '');

      const fi = h.lastIndexOf('<footer');
      if (fi < 0) continue;                       // no footer to anchor to — skip rather than guess
      h = h.slice(0, fi) + block(items) + h.slice(fi);

      const bi = h.lastIndexOf('</body>');
      if (bi >= 0) h = h.slice(0, bi) + CSS + h.slice(bi);

      json[key] = h; changed = true; touched++;
    }

    if (changed) {
      const ser = JSON.stringify(json).split('</').join('<' + B + '/');
      fs.writeFileSync(file, data.slice(0, s) + ser + data.slice(e), 'utf8');
    }
  }
}
console.log('faq: injected on ' + touched + ' page keys (' + Object.keys(FAQ).length + ' distinct pages)');
