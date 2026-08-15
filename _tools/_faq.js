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
    ['What is LumosCore?', 'LumosCore is a non-custodial DeFi platform built on the Stellar network. You can swap assets, provide liquidity to AMM pools, bridge USDC to and from nine other chains, and issue your own token — all from one interface, without giving up custody of your funds.'],
    ['Is LumosCore custodial?', NONCUSTODIAL],
    ['Which wallets does LumosCore support?', WALLETS],
    ['What does it cost to use LumosCore?', FEE],
    ['Which networks does LumosCore support?', 'Trading, liquidity pools and the token launchpad run on Stellar mainnet. USDC can be bridged between Stellar and Ethereum, Base, Arbitrum, Optimism, Polygon, Avalanche, Linea and World Chain using Circle CCTP.'],
  ],
  'dex': [
    ['How do I swap tokens on Stellar?', 'Connect a Stellar wallet, choose the asset you are paying with and the asset you want, enter an amount, review the quote and sign the transaction in your wallet. The swap settles on Stellar in a few seconds.'],
    ['Where does the swap price come from?', 'LumosCore asks Stellar for payment paths across both the DEX orderbook and AMM liquidity pools, and also quotes Soroswap and Aquarius. Whichever venue returns the best rate for your trade is the one used.'],
    ['What fee does LumosCore charge for a swap?', FEE],
    ['Can I place a limit order?', 'Yes. The Limit tab places a real order on the Stellar decentralised exchange at the price you set. It rests on the orderbook until it fills or you cancel it.'],
    ['Do I need an account to trade?', 'No. There is no registration. Connect a supported Stellar wallet and you can trade immediately.'],
  ],
  'dex-asset': [
    ['What does the issuer address mean?', 'On Stellar an asset is identified by its code plus the account that issued it, not by its ticker alone. Many different assets share a code such as USDC, so always check the issuer before trading or adding a trustline.'],
    ['What is a trustline?', 'A trustline is your account explicitly opting in to hold a given asset. Stellar requires one before you can receive a non-native asset, and it reserves a small amount of XLM while it is open.'],
    ['How is the price calculated?', 'Prices come from real trades and liquidity on the Stellar network, aggregated across the DEX orderbook and AMM pools. Thinly traded assets can show volatile or stale prices.'],
    ['What fee does LumosCore charge?', FEE],
  ],
  'amm': [
    ['What is a Stellar liquidity pool?', 'A Stellar liquidity pool holds reserves of two assets and prices swaps between them automatically using a constant-product formula. Anyone can deposit both assets and receive pool shares representing their portion of the reserves.'],
    ['How do liquidity providers earn?', 'Every swap routed through a Stellar pool pays a 0.30% fee, fixed by the protocol, which goes to the pool. Your share of that fee accrues to your pool shares and is realised when you withdraw.'],
    ['What is impermanent loss?', 'If the relative price of the two pooled assets changes, the value of your share can end up lower than if you had simply held both assets. The fees you earn may or may not make up the difference. It is the main risk of providing liquidity.'],
    ['Can I withdraw my liquidity at any time?', 'Yes. Withdrawals are permissionless — you redeem your pool shares for the underlying assets whenever you choose. There is no lock-up.'],
    ['Do I need both assets to deposit?', 'Yes. A Stellar pool deposit adds both assets at the pool’s current ratio, so you need a balance and a trustline for each side of the pair.'],
  ],
  'amm-pool': [
    ['What do the pool reserves mean?', 'The reserves are the amounts of each asset currently held by the pool. Their ratio sets the pool’s price, and their total value is the pool’s liquidity.'],
    ['How is the fee shared?', 'Stellar pools charge a fixed 0.30% on each swap. The fee stays in the pool, so it is distributed to shareholders in proportion to their pool shares.'],
    ['How do I add liquidity to this pool?', 'Connect your wallet, make sure you hold both assets and a trustline for each, enter an amount for one side and the other is calculated at the current pool ratio. Then sign the deposit in your wallet.'],
    ['What are the risks?', 'Providing liquidity exposes you to impermanent loss if the two assets diverge in price, and to the risk of the assets themselves. Check the issuer of each asset before depositing.'],
  ],
  'asset-overview': [
    ['Why does the issuer matter more than the ticker?', 'Stellar lets anyone issue an asset with any code, so a ticker is not an identity — hundreds of distinct assets use the code USDC. The issuing account is what uniquely identifies an asset.'],
    ['What is the difference between holders and trustlines?', 'Trustlines count accounts that have opted in to hold the asset. Holders are the accounts that actually have a non-zero balance, so the holder count is always the smaller number.'],
    ['What is a home domain?', 'A home domain is a website the issuer has linked to their Stellar account, publishing a stellar.toml file with the asset’s details. An asset with no home domain has published nothing verifiable about itself.'],
  ],
  'bridge': [
    ['How do I bridge USDC to or from Stellar?', 'Choose the source and destination chains, enter an amount of USDC, and sign. Your USDC is burned on the source chain and an equivalent amount is minted on the destination chain once Circle attests to the burn.'],
    ['What is Circle CCTP?', 'Cross-Chain Transfer Protocol is Circle’s official mechanism for moving USDC between chains. It burns USDC on the source chain and mints native USDC on the destination, so you never hold a wrapped or synthetic version.'],
    ['Which chains are supported?', 'USDC can move between Stellar and Ethereum, Base, Arbitrum, Optimism, Polygon, Avalanche, Linea and World Chain.'],
    ['Is bridged USDC the same as native USDC?', 'Yes. Because CCTP burns and mints rather than locking and wrapping, what arrives is genuine Circle-issued USDC on the destination chain.'],
  ],
  'wallet': [
    ['Which Stellar wallets are supported?', WALLETS],
    ['Does LumosCore hold my funds?', NONCUSTODIAL],
    ['Why do I need a trustline to receive an asset?', 'Stellar requires an account to opt in before it can hold a non-native asset. The trustline reserves a small amount of XLM while open, which is returned if you remove it.'],
    ['Why must I keep some XLM in my account?', 'Stellar requires a minimum balance that rises with each trustline and offer you hold. That reserved XLM stays in your account and cannot be spent until you close the trustline or offer.'],
  ],
  'launch-token': [
    ['How do I create a token on Stellar?', 'Set a name, ticker, total supply and logo, then sign the issuing transactions in your wallet. LumosCore creates the issuing and distribution accounts and mints the supply to you.'],
    ['Do I need to write a smart contract?', 'No. Stellar issues assets at the protocol level, so there is no contract to write, compile or audit. Issuing a token is a signed transaction.'],
    ['What does launching a token cost?', 'Only Stellar network costs: a small transaction fee, plus the XLM minimum balance reserved for the new accounts and trustlines. LumosCore charges no launch fee.'],
    ['Can I add liquidity for my token afterwards?', 'Yes. Once issued, you can create a liquidity pool pairing your token with XLM or another asset so people can trade it.'],
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
