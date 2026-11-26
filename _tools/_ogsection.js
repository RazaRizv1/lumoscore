// Share cards for the SECTION pages -- the routes that have no single asset to picture.
//
// 2026-11-26 REDESIGN (RAZA: "make them more attractive and modernistic"; mockups v2 approved). Every
// card is K.card(): the LumosCore mark, a label, the page name, one or two lines, chips, and a picture.
//
// NETWORKS ON A CARD ONLY WHEN THE CARD IS THAT NETWORK'S PAGE (RAZA: "Dont show networks because
// networks will just keep increasing ... network logo should only be if its really that network link").
// So /trade, /bridge, /pools, the home/general card and the content pages carry feature or value chips;
// /trade/stellar carries one Stellar chip and a Stellar badge on its picture. No prices, rates or counts
// in a picture: a build-time image would keep quoting a number that has moved.
//
// Output goes to dist/assets/og/s/<name>.png. The NEAR variants are drawn by the NEAR repo
// (_tools/_nearogcards.js) and the pools ones by _ogpools.js, both through the same kit.
//
// Usage: node _tools/_ogsection.js
const fs = require('fs');
const path = require('path');
const K = require('./_ogkit.js');

const OUT_DIR = path.join(__dirname, '..', 'dist', 'assets', 'og', 's');

function localLogo(rel) {
  try {
    const p = path.join(__dirname, '..', 'dist', 'assets', rel);
    if (!fs.existsSync(p)) return '';
    return 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
  } catch (e) { return ''; }
}

// The value chips. True of every page that falls back to the general card, and they cannot go stale.
const VALUE = [{ t: 'Non-custodial', dot: '#1fa968' }, { t: 'No sign-up', dot: '#3fd0ea' }, { t: 'On-chain', dot: '#ffcf5a' }];
const NAME = { Stellar: 'Stellar', XRPL: 'XRP Ledger' };

(async () => {
  const emitted = K.emitBrowser();
  if (emitted.length) console.log('  browser kit -> dist/assets/: ' + emitted.join(' '));
  if (!K.hasFont()) { console.error('og sections: missing ' + K.FONT + ' -- nothing written'); process.exit(1); }
  const lumos = localLogo('tokens/lumos.png');

  const CARDS = [
    // THE GENERAL CARD: the homepage and everything with no better answer (legal pages, footer links).
    ['general', { eyebrow: 'Multichain web3 infrastructure', title: 'LumosCore',
      sub: ['Trade, pool, launch and bridge', 'from your own wallet.'], chipList: VALUE, visual: K.VIS.home() }],
    ['about', { eyebrow: 'About', title: 'LumosCore',
      sub: ['The layer above the networks,', 'with custody left to you.'], chipList: VALUE, visual: K.VIS.home() }],

    ['blog', { eyebrow: 'Guides and explainers', title: 'Blog',
      sub: ['How to trade, provide liquidity', 'and move assets across chains.'],
      chipList: [{ t: 'Trading' }, { t: 'Liquidity' }, { t: 'Cross-chain' }], visual: K.VIS.posts() }],
    ['docs', { eyebrow: 'Documentation', title: 'Docs',
      sub: ['How everything on LumosCore', 'works, step by step.'],
      chipList: [{ t: 'Swaps' }, { t: 'Pools' }, { t: 'Bridging' }, { t: 'Fees' }], visual: K.VIS.docs() }],
    ['whitepaper', { eyebrow: 'Whitepaper', title: 'Whitepaper',
      sub: ['The architecture behind', 'LumosCore, in full.'],
      chipList: [{ t: 'Interoperability' }, { t: 'Custody' }, { t: 'Design' }], visual: K.VIS.paper() }],
    ['list-your-token', { eyebrow: 'For issuers', title: 'List your token',
      sub: ['Apply for a curated listing,', 'reviewed by a person.'],
      chipList: [{ t: 'Reviewed by a person' }, { t: 'Refunded if declined' }], visual: K.VIS.listing() }],

    ['trade', { eyebrow: 'Markets', title: 'Trade', sub: ['Swaps and limit orders,', 'signed in your wallet.'],
      chipList: [{ t: 'Swaps' }, { t: 'Limit orders' }, { t: 'Best-rate routing' }], visual: K.VIS.chart() }],
    ['trade-stellar', { eyebrow: 'Markets on Stellar', title: 'Trade', sub: ['Swaps and limit orders', 'on the Stellar DEX.'],
      chipList: [{ t: 'Stellar', chain: 'Stellar' }, { t: 'Swaps' }, { t: 'Limit orders' }], visual: K.VIS.chart('Stellar') }],
    ['trade-xrpl', { eyebrow: 'Markets on XRP Ledger', title: 'Trade', sub: ['Swaps and limit orders', 'on the XRP Ledger DEX.'],
      chipList: [{ t: 'XRP Ledger', chain: 'XRPL' }, { t: 'Swaps' }, { t: 'Limit orders' }], visual: K.VIS.chart('XRPL') }],

    ['bridge', { eyebrow: 'Cross-chain', title: 'Bridge', sub: ['Move assets between', 'networks in one flow.'],
      chipList: [{ t: 'Non-custodial', dot: '#1fa968' }, { t: 'Tracked to arrival' }], visual: K.VIS.bridge() }],
    ['bridge-stellar', { eyebrow: 'Cross-chain from Stellar', title: 'Bridge', sub: ['Move assets in and out', 'of Stellar.'],
      chipList: [{ t: 'Stellar', chain: 'Stellar' }, { t: 'Circle CCTP' }, { t: 'LayerZero' }], visual: K.VIS.bridge('Stellar') }],
    ['bridge-xrpl', { eyebrow: 'Cross-chain from XRP Ledger', title: 'Bridge', sub: ['Move assets in and out', 'of the XRP Ledger.'],
      chipList: [{ t: 'XRP Ledger', chain: 'XRPL' }, { t: 'NEAR Intents' }, { t: 'Axelar' }], visual: K.VIS.bridge('XRPL') }],

    // LUMOS: the hub names no network; each network page wears its own.
    ['lumos', { eyebrow: "LumosCore's native token", title: 'LUMOS', titleSize: 108,
      sub: ['Powers platform fees', 'and rewards.'], chipList: [{ t: 'LumosCore token', tick: true }], visual: K.VIS.token(lumos, 'LU') }],
    ['lumos-stellar', { eyebrow: 'Token on Stellar', title: 'LUMOS', titleSize: 108, sub: ['Issued by lumoscore.com'],
      chipList: [{ t: 'Stellar', chain: 'Stellar' }, { t: 'LumosCore token', tick: true }], visual: K.VIS.token(lumos, 'LU') }],
    ['lumos-xrpl', { eyebrow: 'Token on XRP Ledger', title: 'LUMOS', titleSize: 108, sub: ['Issued by lumoscore.com'],
      chipList: [{ t: 'XRP Ledger', chain: 'XRPL' }, { t: 'LumosCore token', tick: true }], visual: K.VIS.token(lumos, 'LU') }],

    // REWARDS: LUMOS payouts are real, so naming them is not an earning claim; no amounts, no rates.
    ['rewards', { eyebrow: 'Rewards', title: 'Rewards', sub: ['LUMOS rewards for holders', 'and liquidity providers.'],
      chipList: [{ t: 'Holder rewards' }, { t: 'LP rewards' }], visual: K.VIS.rewards() }],
    ['rewards-stellar', { eyebrow: 'Rewards on Stellar', title: 'Rewards', sub: ['LUMOS rewards for holders', 'and liquidity providers.'],
      chipList: [{ t: 'Stellar', chain: 'Stellar' }, { t: 'Paid in LUMOS' }], visual: K.VIS.rewards('Stellar') }],
    ['rewards-xrpl', { eyebrow: 'Rewards on XRP Ledger', title: 'Rewards', sub: ['LUMOS rewards for holders', 'and liquidity providers.'],
      chipList: [{ t: 'XRP Ledger', chain: 'XRPL' }, { t: 'Paid in LUMOS' }], visual: K.VIS.rewards('XRPL') }],

    // 2026-11-27 (card audit): pages that were still on the general card. Wording from each page itself.
    ['support', { eyebrow: 'Support', title: 'Support', sub: ['Tell us what happened and', 'we will reply by email.'],
      chipList: [{ t: 'Reply by email' }, { t: 'We never ask for your keys', dot: '#1fa968' }], visual: K.VIS.support() }],
    ['privacy', { eyebrow: 'Legal', title: 'Privacy', sub: ['What happens to information', 'when you use LumosCore.'],
      chipList: [{ t: 'No cookies' }, { t: 'No account to create' }], visual: K.VIS.legal() }],
    ['terms', { eyebrow: 'Legal', title: 'Terms', sub: ['The terms for using', 'LumosCore.'],
      chipList: [{ t: 'Non-custodial', dot: '#1fa968' }, { t: 'LumosCore OÜ, Estonia' }], visual: K.VIS.legal() }],
    ['list-your-token-xrpl', { eyebrow: 'For issuers on XRP Ledger', title: 'List your token', sub: ['Apply for a curated listing,', 'reviewed by a person.'],
      chipList: [{ t: 'XRP Ledger', chain: 'XRPL' }, { t: 'Refunded if declined' }], visual: K.VIS.listing('XRPL') }],
    ['list-your-token-near', { eyebrow: 'For issuers on NEAR', title: 'List your token', sub: ['Apply for a curated listing,', 'reviewed by a person.'],
      chipList: [{ t: 'NEAR', chain: 'NEAR' }, { t: 'Refunded if declined' }], visual: K.VIS.listing('NEAR') }],
    // PUBLIC WALLET pages (/account/<chain>/<address>): one card per network, no address, no numbers.
    ['account-stellar', { eyebrow: 'Wallet on Stellar', title: 'Wallet', sub: ['Balances, pools and activity', 'of a Stellar address.'],
      chipList: [{ t: 'Stellar', chain: 'Stellar' }, { t: 'Public view' }], visual: K.VIS.wallet('Stellar') }],
    ['account-xrpl', { eyebrow: 'Wallet on XRP Ledger', title: 'Wallet', sub: ['Balances, pools and activity', 'of an XRP Ledger address.'],
      chipList: [{ t: 'XRP Ledger', chain: 'XRPL' }, { t: 'Public view' }], visual: K.VIS.wallet('XRPL') }],
    ['account-near', { eyebrow: 'Wallet on NEAR', title: 'Wallet', sub: ['Balances, pools and activity', 'of a NEAR account.'],
      chipList: [{ t: 'NEAR', chain: 'NEAR' }, { t: 'Public view' }], visual: K.VIS.wallet('NEAR') }],

    // MCP (new 2026-11-26, RAZA: "please make sure not to miss out mcp"). Wording from the /mcp page itself.
    ['mcp', { eyebrow: 'Model Context Protocol', title: 'MCP', sub: ['Your AI agent, on-chain.', 'You sign every transaction.'],
      chipList: [{ t: 'One URL' }, { t: 'No API key' }, { t: 'Never holds your key', dot: '#1fa968' }], visual: K.VIS.terminal() }],

    // LAUNCHPAD (new 2026-11-26: these routes used to fall back to the general card).
    ['launchpad', { eyebrow: 'Launchpad', title: 'Launchpad', sub: ['Mint your own token', 'in a few steps.'],
      chipList: [{ t: 'No code' }, { t: 'Signed in your wallet' }], visual: K.VIS.launch() }],
    ['launchpad-stellar', { eyebrow: 'Launchpad on Stellar', title: 'Launchpad', sub: ['Mint your own token', 'on Stellar in a few steps.'],
      chipList: [{ t: 'Stellar', chain: 'Stellar' }, { t: 'No code' }], visual: K.VIS.launch('Stellar') }],
    ['launchpad-xrpl', { eyebrow: 'Launchpad on XRP Ledger', title: 'Launchpad', sub: ['Mint your own token', 'on the XRP Ledger.'],
      chipList: [{ t: 'XRP Ledger', chain: 'XRPL' }, { t: 'No code' }], visual: K.VIS.launch('XRPL') }],
  ];

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const only = process.argv.indexOf('--only') > 0 ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
  const done = [];
  for (const [name, c] of CARDS) {
    if (only && only.indexOf(name) < 0) continue;
    try {
      const png = K.render(K.card(c));
      fs.writeFileSync(path.join(OUT_DIR, name + '.png'), png);
      done.push(name);
      console.log('  ' + name.padEnd(18) + png.length + ' bytes');
    } catch (e) { console.error('  ' + name + ': ' + e.message); }
  }
  console.log('og sections: wrote ' + done.length + ' of ' + CARDS.length + ' -> dist/assets/og/s/');
})();
