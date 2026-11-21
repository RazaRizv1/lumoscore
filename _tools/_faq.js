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
//
// 2026-11-13: the LOOK of this section no longer lives here. Markup, stylesheet and behaviour moved
// to _faqview.js, which the XRPL fork renders through too -- the fork holds its own answers but must
// not hold its own design. This file is now the Stellar question table and nothing else.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const view = require(__dirname + '/_faqview.js');
const B = String.fromCharCode(92);

const { LZ_LIVE } = require(__dirname + '/_lzflag.js');

// The bridge FAQ once the LayerZero route is live. Kept as a whole replacement set rather than as edits to the
// CCTP-only answers, because the two differ in substance and not in wording: with more than one route the claim
// step, the fee and the chain list all stop having a single answer. Selected by LZ_LIVE so the prose can never
// promise a route the product is not carrying yet. Answers below are measured, not estimated -- the ~30 minutes
// (median of 53 real sends, 2026-09-19) is a real Stellar->Polygon delivery and the 320-confirmation wait that
// explains it.
//
// FOUR ROUTES NOW, not two: CCTP, LayerZero, NEAR Intents and Axelar. Two of them were missing from this copy.
// NEAR Intents has been live since before this set was written and appeared in exactly ONE answer ("Which chains
// are supported?"), so a reader asking about the claim step, the timing or the fees was told there were two
// routes and given two answers. Axelar shipped 2026-11-12 and appeared in none. EVERY answer that enumerates
// routes must enumerate all four -- the enumerations are the thing that goes stale, so grep this array for route
// names whenever a route is added or removed. The per-route explainers below ("What is Circle CCTP?" and its
// siblings) are one per route for the same reason.
const BRIDGE_ALL_ROUTES = [
  ["How do I bridge to or from Stellar?", "Pick the destination chain and an amount, then choose a route. CCTP delivers USDC and LayerZero delivers USDT0, both by burning on Stellar and minting on the destination — real dollars, never a wrapped copy. NEAR Intents delivers the token you pick instead of a stablecoin, and Axelar carries SHX itself to Ethereum, Solana and the XRP Ledger. Each route shows what it costs and how long it takes before you commit, and none of them holds your funds along the way."],
  ["Do I have to claim it on the other side?", "Only with CCTP. There LumosCore burns the USDC here and the destination chain mints once the redeem is submitted there — that redeem is your own transaction, so keep a little of that chain’s gas token. LayerZero, NEAR Intents and Axelar all deliver for you, with no claim and no gas needed on arrival. Axelar is the one to prepare for in advance: on the XRP Ledger the receiving address needs an SHX trustline first, which costs 0.2 XRP of reserve, and on Solana an SHX token account. Ethereum needs nothing."],
  ["What if I close the tab before claiming?", "Nothing is stranded. For a CCTP transfer the burn hash, Circle’s message and the attestation are all saved the moment they exist and listed under Awaiting redemption, so you can come back and finish whenever you like. LayerZero, NEAR Intents and Axelar need no claim at all — they arrive on their own, whether or not the tab is open."],
  ["What is Circle CCTP?", "Circle’s Cross-Chain Transfer Protocol, run by the company that issues USDC. Rather than locking your USDC and handing you a wrapped copy, it destroys it on one chain and issues real USDC on the other."],
  ["What are LayerZero and USDT0?", "LayerZero is a cross-chain messaging protocol, and USDT0 is Tether’s omnichain dollar built on it, live on Stellar since September 2026. The route burns USDT0 here and mints it on the destination, so what lands is real USDT0 rather than a wrapped copy — and it reaches fourteen chains CCTP cannot."],
  ["What is NEAR Intents?", "A network of solvers, reached through NEAR’s 1Click. Instead of burning and minting a stablecoin it takes XLM or USDC from you on Stellar and has a solver deliver the token you actually picked on the other chain — ETH on Ethereum, SOL on Solana, native XRP on the XRP Ledger. That is how it reaches twenty-one chains the burn-and-mint routes cannot. It is also the fastest, usually about thirty seconds, with no claim and no gas needed on arrival, and if a solver cannot complete the job your deposit is returned."],
  ["What is Axelar?", "A cross-chain network whose Interchain Token Service carries a token itself rather than swapping it for dollars. On LumosCore it moves SHX from Stellar to Ethereum, Solana and the XRP Ledger in about five minutes, delivered automatically. It adds no new destinations — all three were already reachable — so think of it as the way to land SHX on them rather than a stablecoin. What arrives is the Axelar-issued SHX on that chain, so the receiving address has to be able to hold it: an SHX trustline on the XRP Ledger, an SHX token account on Solana, nothing at all on Ethereum."],
  ["Which chains are supported?","Fifty-two destinations. CCTP carries USDC to Ethereum, Base, Arbitrum, Optimism, Polygon, Avalanche, Linea, World Chain, Sonic, Cronos, XDC, Plume, Codex, Pharos, Unichain, Morph and X Layer. LayerZero carries USDT0 to Ethereum, Arbitrum, Optimism, Polygon, Berachain, Ink, Hyperliquid, Monad, Flare, Sei, MegaETH, Plasma, Unichain, Mantle, Morph, X Layer, Hedera, Conflux eSpace, Rootstock, Stable and Tempo. NEAR Intents reaches twenty-one more that neither can -- including the XRP Ledger, Bitcoin, Solana, Tron, TON, Cardano, Litecoin, Dogecoin, Sui, Starknet and BNB Chain -- and delivers the token you pick rather than a stablecoin. The XRP Ledger is among them, carrying native XRP. Axelar adds no destination of its own — it is a second way to reach Ethereum, Solana and the XRP Ledger, carrying SHX rather than a stablecoin. Several chains take more than one route, and you choose which to use."],
  ["How long does a transfer take?", "NEAR Intents is the quickest end to end at about thirty seconds, delivered for you. Axelar takes about five minutes, also delivered for you. LayerZero takes about 30 minutes and likewise needs nothing from you afterwards: it waits 320 Stellar ledgers before its verifiers sign off, then delivers. CCTP is ready in about five seconds, because the confirmations Circle counts are on Stellar and Stellar needs one — but ready is not arrived, and you still have to send the claim yourself."],
  ["What are the cross-chain fees?", "LumosCore takes 0.2% of the amount you bridge, or 0.1% if you hold 250,000 LUMOS or more, so send 100 and 99.8 arrives. Circle charges nothing for CCTP, but you pay the destination chain’s gas to claim. LayerZero charges a messaging fee in XLM, quoted before you sign, and nothing to claim afterwards. Axelar charges a delivery fee, also in XLM and also quoted before you sign — if it cannot be priced the route is shown as unavailable rather than as free. NEAR Intents quotes one all-in rate from its solvers before you deposit. Every route shows the whole cost before you commit."],
  ["Can I bridge my own Stellar asset?", "As the asset you send, yes. Each route carries one thing, so whatever you send is swapped into it first, at a rate shown before you sign. For CCTP that is USDC and for LayerZero USDT0, and what lands is real USDC or USDT0 rather than a wrapped copy of your token. NEAR Intents takes XLM or USDC from Stellar and delivers the token you chose on the other side. Axelar carries SHX, which is the one case where a Stellar asset crosses as itself."],
];

const FEE = 'LumosCore charges 0.2% per trade, reduced to 0.1% if you hold at least 250,000 LUMOS. '
          + 'On top of that Stellar itself charges a network fee of a small fraction of a cent.';
const NONCUSTODIAL = 'No. LumosCore is non-custodial and never holds your funds or your keys. '
          + 'Every transaction is built in your browser and signed in your own wallet.';
const WALLETS = 'Freighter, Rabet, Albedo, xBull and WalletConnect. There is no sign-up, password or '
          + 'email — connecting a wallet is the whole process.';

const FAQ = {
  'landing': [
    ["What is LumosCore?", "LumosCore is a non-custodial, multichain DeFi platform. You can swap assets, provide liquidity to AMM pools, move assets cross-chain and launch your own token on the Launchpad — yourself, or by asking an AI assistant through the LumosCore MCP server. You keep custody of your funds and sign every transaction."],
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
    ["How do I get an asset onto the curated list?", "Apply on the List your token page: pick the network, give the asset code, issuing account, description and logo, and pay $250 in XLM from your own wallet. We review it by hand and verify the issuer. Listing is not automatic, but if we say no you get the whole $250 back."],
    ["What happens if my listing is rejected?", "You are refunded in full — the same amount of XLM, sent back to the account that paid it — and told why. In effect you only pay if the asset is listed, and most declines are fixable, so reapplying afterwards is fine."],
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
    ["How do I add my token to the curated list?", "Minting here does not curate a token or earn it a verified tick, otherwise anyone could mint themselves one. Apply on the List your token page with the code, issuer, description and logo, and pay $250 in XLM, refunded in full if the review says no."],
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
  'bridge': LZ_LIVE ? BRIDGE_ALL_ROUTES : [
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
    ["How often are rewards paid?", "Every round, and rounds run from the 1st and 15th of each month, so twice a month and twelve rounds over a six-month cycle. Ecosystem LP began on 15 April 2026, so 1 October 2026 was the twelfth and final round of its first cycle; the second cycle, with a new set of pools, began on 15 October 2026."],
    ["Which assets are in the Ecosystem LP rewards?", "Ten pools, each pairing LUMOS with one other asset: currently USDC, USDT0, EURC, SHX, AQUA, BLND, xLMNR, yXLM, XRP and PYUSD. Each pays 100,000 LUMOS per round, and the ten are reselected every 6 months."],
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
    ['What is the Model Context Protocol?', 'MCP is an open standard that lets an AI assistant use an outside tool instead of guessing. Connecting the LumosCore server gives an assistant live market data, wallets, pools and routes, and the ability to prepare a transaction for you.'],
    ['How do I connect it?', 'Point any MCP client at https://lumoscore.com/mcp. There is nothing to install and no API key: it is a remote server, so a paste is the whole setup. Claude, ChatGPT, Cursor and VS Code all speak it.'],
    ['Can an assistant move my funds?', 'No. The server holds no private key and cannot sign anything. A write tool validates what you asked for and hands back a link; the transaction opens in your browser, in your wallet, with the figures in front of you, and nothing moves until you approve it there.'],
    ['What can it see?', 'Only what is already public on-chain. It reads balances, orders and pool positions for any address you name, the same way a block explorer does. It never sees your keys, and it is not connected to your wallet.'],
    ['Does it cost anything?', 'No. The connector is free and unauthenticated. Trades placed through the links it prepares pay the ordinary LumosCore fee of 0.2%, or 0.1% if you hold 250,000 LUMOS, and limit orders are free.'],
    ['Which networks does it cover?', 'Stellar, the XRP Ledger and NEAR, from one endpoint. Every tool takes a chain argument (stellar, xrpl or near; Stellar if it is left out), and an asset can also be written with its network, such as xrpl:XRP or near:NEAR. On NEAR there is no order book, because NEAR trading runs through pools; swap quotes there come straight from the Rhea pool contracts themselves, the same figure the trade page shows.'],
  ],

};

// The look of this block -- the stylesheet, the accordion markup and its behaviour -- is in
// _faqview.js. See that file for why it is shaped the way it is and which three constraints the
// shape is answering. Everything below is content and grouping.

// The landing page was showing 7 of the ~64 answers this file already holds, because it rendered one
// page's set like every other page does. The other 57 existed and were reachable nowhere from the front
// door. Grouped into tabs, all of them ship on the landing page and all of them go into its FAQPage
// structured data, which is the thing answer engines actually read.
//
// Grouping is by what a reader would look for, not by page key: Trade covers the market, the asset page
// and the overview; Pools covers the list and the detail; LUMOS Token covers the token and rewards. A
// question repeated across merged sets -- the fee answer appears in three -- is kept once.
const GROUPS = [
  ['General', ['landing']],
  ['Trade', ['dex', 'dex-asset', 'asset-overview']],
  ['Pools', ['amm', 'amm-pool']],
  ['Launchpad', ['launch-token']],
  ['Cross-chain', ['bridge']],
  ['Wallet', ['wallet']],
  ['LUMOS Token', ['lumos-token', 'rewards']],
  ['MCP', ['mcp']],
];

// Grouped (landing) and flat (every other page) both go through the one renderer. Grouping is by
// what a reader would look for, not by page key -- Trade covers the market, the asset page and the
// overview -- and a question that appears in more than one merged set is kept once.
function groupedSpec() {
  return {
    groups: GROUPS.map(function (g) {
      const seen = {}, items = [];
      g[1].forEach(function (k) {
        (FAQ[k] || []).forEach(function (qa) { if (!seen[qa[0]]) { seen[qa[0]] = 1; items.push(qa); } });
      });
      return { label: g[0], id: g[0].toLowerCase().replace(/[^a-z0-9]+/g, '-'), items: items };
    }),
  };
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
      const isLanding = /^lumoscore-landing(-mobile)?\.html$/.test(key);
      // Strip, render and re-anchor all happen in the renderer, so the two chains cannot diverge on
      // any of the three. It returns null when a page has nowhere to put the block -- skip rather
      // than guess, same as before.
      const out = view.apply(json[key], isLanding ? groupedSpec() : { items: items });
      if (out === null) continue;

      json[key] = out; changed = true; touched++;
    }

    if (changed) {
      const ser = JSON.stringify(json).split('</').join('<' + B + '/');
      fs.writeFileSync(file, data.slice(0, s) + ser + data.slice(e), 'utf8');
    }
  }
}
console.log('faq: injected on ' + touched + ' page keys (' + Object.keys(FAQ).length + ' distinct pages)');
