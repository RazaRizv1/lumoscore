// Share cards for the SECTION pages — the routes that have no single asset to picture.
//
// A section page's panel is the design problem: the asset card puts the token's logo there, and a
// markets page has no one logo. Markets pages get a 2x2 grid of what is actually traded on them;
// the network chooser gets the two chain marks, because choosing between them is what that page is.
//
// Output goes to dist/assets/og/s/<name>.png. The `s/` folder keeps these clear of the per-asset
// cards, whose filenames are asset ids — those can never begin with "s/" so nothing can collide.
//
// These are also the FALLBACK for an asset with no card of its own: an uncurated asset used to get
// its logo stretched across a flat rectangle with no text and no branding, which was worse than no
// card at all. functions/lxapi/ogcard.js now serves the chain's trade card instead.
//
// Usage: node _tools/_ogsection.js [--xrpl-origin https://...]
const fs = require('fs');
const path = require('path');
const K = require('./_ogkit.js');

const ORIGIN = 'https://lumoscore.com';
const OUT_DIR = path.join(__dirname, '..', 'dist', 'assets', 'og', 's');

// FIXED rosters, not "whatever is top by volume today". A card is a build-time image: if the grid
// followed live volume it would change under readers for reasons none of them can see, and a shared
// link would stop matching the picture someone remembers. These are majors that stay majors, and
// each is curated, so the logo is one we have already vetted.
const STELLAR_TILES = [
  'USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
  'AQUA-GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA',
  'yXLM-GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55',
  'SHX-GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEKEBR7UCHEUUEK72N7I7KJ6JH',
];
// xrpl.to thumbnail ids (md5 of issuer_currencyHex), resolved through /lxapi/xrplthumb. That
// endpoint only serves 32/48/64/96/128 — ask for more and it SILENTLY returns 48, which looks like
// a success and gives a quarter of the resolution.
const XRPL_TILES = [
  { code: 'RLUSD', id: '0dd550278b74cb6690fdae351e8e0df3' },
  { code: 'USDC', id: '1c54f16ec1b45eef983f202b9954999b' },
  { code: 'BCHAMP', id: 'd64c6f50786392b868ee036528a2d823' },
  { code: 'ARMY', id: 'cd9499746c1b2e041563a9724330b3e6' },
];

async function stellarLogo(id) {
  try {
    const r = await fetch(ORIGIN + '/lxapi/assetlogo?asset=' + encodeURIComponent(id));
    if (!r.ok) return '';
    const d = await r.json(); let u = d && d.image; if (!u) return '';
    if (u.indexOf('data:') === 0) {
      if (/^data:image\/(png|jpe?g)/i.test(u)) return u;
      if (/^data:image\/svg/i.test(u)) return '';
      const m = /^data:([^;]+);base64,(.*)$/i.exec(u);
      return m ? await K.toPng(Buffer.from(m[2], 'base64')) : '';
    }
    return await K.imageDataUri(u.indexOf('/') === 0 ? ORIGIN + u : u);
  } catch (e) { return ''; }
}

// Read a logo that already ships in dist rather than fetching it. The network marks and the
// LumosCore mark are ours and are sitting right there; going over the wire for them would make the
// card build depend on a host being up to draw a picture we already have.
async function localLogo(rel) {
  try {
    const p = path.join(__dirname, '..', 'dist', 'assets', rel);
    if (!fs.existsSync(p)) return '';
    const b = fs.readFileSync(p);
    const ext = path.extname(p).toLowerCase();
    if (ext === '.png') return 'data:image/png;base64,' + b.toString('base64');
    if (ext === '.jpg' || ext === '.jpeg') return 'data:image/jpeg;base64,' + b.toString('base64');
    return await K.toPng(b);                       // webp and friends: resvg cannot decode them
  } catch (e) { return ''; }
}

// The asset-card panel: one logo, centred. Used for the one XRPL asset that gets a card of its own.
function panelSingle(uri, code) {
  const IX = K.PX + K.PAD, IY = K.PY + K.PAD, IR = Math.round(K.INNER * 0.25);
  if (!uri) {
    return {
      defs: '',
      svg: '<rect x="' + IX + '" y="' + IY + '" width="' + K.INNER + '" height="' + K.INNER + '" rx="' + IR + '" fill="#2a2a32"/>'
        + K.bold(IX + K.INNER / 2, IY + K.INNER / 2 + 30, 84, String(code || '?').slice(0, 2).toUpperCase(), '#fff', 0, 1.8, 'middle'),
    };
  }
  return {
    defs: '<clipPath id="one"><rect x="' + IX + '" y="' + IY + '" width="' + K.INNER + '" height="' + K.INNER + '" rx="' + IR + '"/></clipPath>',
    svg: '<image x="' + IX + '" y="' + IY + '" width="' + K.INNER + '" height="' + K.INNER + '" href="' + uri
      + '" clip-path="url(#one)" preserveAspectRatio="xMidYMid meet"/>',
  };
}

// Two layouts off one grid: four cells for a markets page, two centred cells for the chooser.
function panelGrid(items, kind) {
  const GAP = 14, CELL = Math.round((K.INNER - GAP) / 2);
  const slots = kind === 'pair'
    ? [[0, (K.INNER - CELL) / 2], [CELL + GAP, (K.INNER - CELL) / 2]]
    : [[0, 0], [CELL + GAP, 0], [0, CELL + GAP], [CELL + GAP, CELL + GAP]];
  let svg = '', defs = '';
  items.slice(0, slots.length).forEach((it, i) => {
    const cx = K.PX + K.PAD + slots[i][0], cy = K.PY + K.PAD + slots[i][1];
    svg += '<rect x="' + cx + '" y="' + cy + '" width="' + CELL + '" height="' + CELL + '" rx="' + Math.round(CELL * 0.27)
      + '" fill="#ffffff" fill-opacity="0.05" stroke="#ffffff" stroke-opacity="0.09"/>';
    if (!it) return;
    if (it.chain) {
      const h = Math.round(CELL * 0.46);
      svg += K.chainMark(it.chain, cx + CELL / 2 - (K.CHAIN[it.chain].bb[2] * (h / K.CHAIN[it.chain].bb[3])) / 2, cy + CELL / 2, h, K.INK).svg;
      return;
    }
    const p = 14, s = CELL - p * 2, id = 'g' + i;
    defs += '<clipPath id="' + id + '"><rect x="' + (cx + p) + '" y="' + (cy + p) + '" width="' + s + '" height="' + s + '" rx="' + Math.round(s * 0.28) + '"/></clipPath>';
    svg += '<image x="' + (cx + p) + '" y="' + (cy + p) + '" width="' + s + '" height="' + s + '" href="' + it.uri
      + '" clip-path="url(#' + id + ')" preserveAspectRatio="xMidYMid meet"/>';
  });
  return { svg, defs };
}

(async () => {
  const emitted = K.emitBrowser();
  if (emitted.length) console.log('  browser kit -> dist/assets/: ' + emitted.join(' '));
  if (!K.hasFont()) { console.error('og sections: missing ' + K.FONT + ' — nothing written'); process.exit(1); }
  const xa = process.argv.indexOf('--xrpl-origin');
  const XRPL_ORIGIN = xa > 0 ? process.argv[xa + 1] : ORIGIN;

  const sTiles = [];
  for (const id of STELLAR_TILES) { const uri = await stellarLogo(id); sTiles.push(uri ? { uri } : null); }
  const xTiles = [];
  for (const t of XRPL_TILES) {
    const uri = await K.imageDataUri(XRPL_ORIGIN + '/lxapi/xrplthumb?id=' + t.id + '&w=128');
    xTiles.push(uri ? { uri } : null);
  }
  const sOk = sTiles.filter(Boolean).length, xOk = xTiles.filter(Boolean).length;

  // LUMOS IS THE ONE XRPL ASSET WITH A CARD OF ITS OWN.
  //
  // XRPL has no curated roster -- RAZA decided on 2026-10-07 not to create one -- and every XRPL
  // token's name, description and icon come from whoever issued it. A per-token card would put
  // attacker-controlled artwork and wording onto a LumosCore-branded image and publish it as a
  // social preview, which reads as an endorsement nobody made. That is the whole reason the Stellar
  // cards are drawn only for curated assets. So every other XRPL asset shows the trade card, the
  // same rule an uncurated Stellar asset follows.
  //
  // LUMOS is safe to draw: it is ours, the issuer is fixed and blackholed, and the artwork is the
  // same flame as the Stellar side -- which is why the logo is read from our own Stellar entry
  // rather than from xrpl.to, whose thumbnails cap at 128px and would be upscaled here.
  const lumosLogo = await stellarLogo('LUMOS-GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S');

  // Destination networks for the bridge panels, read out of dist. These are the corridors each
  // chain actually has, not a decorative selection: Stellar bridges USDC through Circle CCTP and
  // tokens through LayerZero and NEAR Intents; the XRP Ledger goes out through NEAR Intents, Axelar
  // and THORChain, which is what puts Bitcoin on its side and not on Stellar's.
  const bridgeS = [];
  for (const n of ['ethereum.png', 'base.png', 'arbitrum.png', 'solana.png']) {
    const uri = await localLogo('networks/' + n); bridgeS.push(uri ? { uri } : null);
  }
  const bridgeX = [];
  for (const n of ['ethereum.png', 'base.png', 'solana.png', 'bitcoin.png']) {
    const uri = await localLogo('networks/' + n); bridgeX.push(uri ? { uri } : null);
  }
  const lumosMark = await localLogo('tokens/lumos.png');

  const CARDS = [
    // THE GENERAL CARD. Everything the middleware has no better answer for lands here -- the docs,
    // the legal pages, the footer links, a blog post with no cover. It names the product and the two
    // chains and claims nothing else, because it has to be true of every page that uses it.
    ['general', {
      row: K.metaRow([{ chain: 'Stellar' }, { chain: 'XRPL' }]).svg,
      // NOT "Trade, pool and bridge". This card is the fallback for the docs, the legal pages and
      // every footer link, and naming three products reads oddly on a privacy policy -- it has to
      // describe what LumosCore IS, not what three of its pages do (RAZA, 2026-10-08).
      headline: 'LumosCore', accent: 'Multichain web3 infrastructure',
      features: 'Non-custodial · On-chain',
      grid: panelSingle(lumosMark, 'LC'),
    }],
    ['bridge', {
      row: K.metaRow([{ chain: 'Stellar' }, { chain: 'XRPL' }]).svg,
      headline: 'Bridge', accent: 'Move assets between networks',
      features: 'Choose a network · Non-custodial',
      grid: panelGrid([{ chain: 'Stellar' }, { chain: 'XRPL' }], 'pair'),
    }],
    ['bridge-stellar', {
      row: K.metaRow([{ chain: 'Stellar' }, { text: 'Non-custodial' }]).svg,
      headline: 'Stellar Bridge', accent: 'Bridge on LumosCore',
      // The routes themselves, which do not go stale between builds -- unlike the chain COUNT the
      // page title carries, which moves whenever a corridor is added.
      features: 'Circle CCTP · LayerZero · NEAR Intents',
      grid: panelGrid(bridgeS, 'quad'),
    }],
    ['bridge-xrpl', {
      row: K.metaRow([{ chain: 'XRPL' }, { text: 'Non-custodial' }]).svg,
      headline: 'XRP Ledger Bridge', accent: 'Bridge on LumosCore',
      features: 'NEAR Intents · Axelar · THORChain',
      grid: panelGrid(bridgeX, 'quad'),
    }],
    ['asset-lumos-xrpl', {
      row: K.metaRow([{ chain: 'XRPL' }, { check: 'LumosCore token' }, { text: 'lumoscore.com' }]).svg,
      headline: 'LUMOS', accent: 'Trade on LumosCore',
      features: 'Price · Pools · Holders',
      grid: panelSingle(lumosLogo, 'LU'),
    }],
    ['trade', {
      row: K.metaRow([{ chain: 'Stellar' }, { chain: 'XRPL' }]).svg,
      headline: 'Trade', accent: 'Swaps and limit orders, on-chain',
      features: 'Choose a network · Non-custodial',
      grid: panelGrid([{ chain: 'Stellar' }, { chain: 'XRPL' }], 'pair'),
    }],
    ['trade-stellar', {
      row: K.metaRow([{ chain: 'Stellar' }, { text: 'Non-custodial' }]).svg,
      headline: 'Stellar DEX', accent: 'Trade on LumosCore',
      features: 'Orderbook · AMM pools · Limit orders',
      grid: panelGrid(sTiles, 'quad'),
    }],
    ['trade-xrpl', {
      row: K.metaRow([{ chain: 'XRPL' }, { text: 'Non-custodial' }]).svg,
      headline: 'XRP Ledger DEX', accent: 'Trade on LumosCore',
      features: 'Orderbook · AMM pools · Limit orders',
      // With no XRPL origin to read thumbnails from, the chooser's pair of chain marks is a
      // truthful stand-in rather than four empty tiles.
      grid: xOk ? panelGrid(xTiles, 'quad') : panelGrid([{ chain: 'XRPL' }], 'pair'),
    }],
  ];

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const done = [];
  for (const [name, c] of CARDS) {
    try {
      const png = K.render(K.shell({
        defs: c.grid.defs, row: c.row, headline: c.headline,
        accent: c.accent, features: c.features, panel: c.grid.svg,
      }));
      fs.writeFileSync(path.join(OUT_DIR, name + '.png'), png);
      done.push(name);
      console.log('  ' + name.padEnd(16) + png.length + ' bytes');
    } catch (e) {
      console.error('  ' + name + ': ' + e.message);
    }
  }
  console.log('og sections: wrote ' + done.length + ' of ' + CARDS.length
    + ' (stellar tiles ' + sOk + '/4, xrpl tiles ' + xOk + '/4) -> dist/assets/og/s/');
})();
