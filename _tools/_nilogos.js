// Logos for the NEAR Intents destination tokens, fetched ONCE and shipped with the site (assets/tokens/ni/SYMBOL.png).
// Source: CoinGecko's image for the coingeckoId that 1Click's own token list gives each asset -- so the logo is keyed on
// the same identity 1Click delivers, not on a ticker guess. USDC and USDT0 reuse the files the site already ships.
// Re-encoded to 96x96 PNG by sharp, like the curated logos (_bridgelogos.js).
//
// Usage: node _tools/_nilogos.js [--force]   then copy assets/tokens/ni into dist (the build does not copy assets).
const fs = require('fs');
const path = require('path');
let sharp; try { sharp = require('sharp'); } catch (e) { console.error('  ! sharp missing'); process.exit(1); }

const OUT = path.join(__dirname, '..', 'assets', 'tokens', 'ni');
const FORCE = process.argv.includes('--force');
// The destination list the bridge offers (native first per chain) -- kept in step with NI_DEST in _nearintents.js.
const SYMBOLS = ['NEAR', 'ETH', 'WETH', 'USDC', 'USDT', 'USDT0', 'WBTC', 'cbBTC', 'DAI', 'LINK', 'UNI', 'AAVE', 'ARB', 'GMX', 'OP', 'POL', 'AVAX', 'BERA', 'MON', 'XPL'];
const LOCAL = { USDC: 'usdc.png', USDT0: 'usdt0.png' };

// CoinGecko's free tier answers 429 when called in bursts; wait and retry rather than give up.
async function j(url, tries) {
  tries = tries || 4;
  const r = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
  if (r.status === 429 && tries > 1) { console.log('  (rate limited, waiting 30s)'); await new Promise((res) => setTimeout(res, 30000)); return j(url, tries - 1); }
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return r.json();
}
async function png(buf) { return sharp(buf, { density: 300 }).resize(96, 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(); }

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const toks = await j('https://1click.chaindefuser.com/v0/tokens');
  const idOf = {};
  toks.forEach((t) => { if (t.coingeckoId && !/DEPRECATED/i.test(t.symbol) && !idOf[t.symbol]) idOf[t.symbol] = t.coingeckoId; });
  // ONE request for every image: /coins/markets takes a list of ids. Per-coin lookups hit CoinGecko's free-tier 429
  // after five.
  const need = SYMBOLS.filter((s) => !LOCAL[s] && idOf[s] && (FORCE || !fs.existsSync(path.join(OUT, s + '.png'))));
  const imgOf = {};
  if (need.length) {
    const ids = [...new Set(need.map((s) => idOf[s]))].join(',');
    const rows = await j('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=' + encodeURIComponent(ids) + '&per_page=250');
    rows.forEach((r) => { imgOf[r.id] = r.image; });
  }
  let made = 0; const missing = [];
  for (const s of SYMBOLS) {
    const file = path.join(OUT, s + '.png');
    if (!FORCE && fs.existsSync(file)) continue;
    try {
      let buf;
      if (LOCAL[s]) buf = fs.readFileSync(path.join(__dirname, '..', 'assets', 'tokens', LOCAL[s]));
      else {
        const id = idOf[s]; if (!id) throw new Error('no coingeckoId');
        const url = imgOf[id]; if (!url) throw new Error('no image for ' + id);
        const r = await fetch(url, { signal: AbortSignal.timeout(20000) }); buf = Buffer.from(await r.arrayBuffer());
        console.log('  ' + s.padEnd(6) + ' <- ' + id);
      }
      fs.writeFileSync(file, await png(buf)); made++;
    } catch (e) { missing.push(s + ' (' + e.message + ')'); }
  }
  console.log('ni logos: ' + made + ' written' + (missing.length ? ' | missing: ' + missing.join(', ') : ''));
})();
