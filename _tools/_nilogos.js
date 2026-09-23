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
// EVERY token the bridge can deliver by NEAR Intents, not only the majors (RAZA 2026-09-19: "many of near intents assets
// don't have logos"). The picker lists all of them, and the fallback -- /lxapi/oneclick?op=logo fetching CoinGecko at
// request time -- 404s from Cloudflare's edge (CoinGecko refuses those requests; measured on production for aurora-near,
// hapi, hemi-bitcoin). So every logo is fetched here, once, and shipped. The file name is the SYMBOL, the key the picker,
// the feed and the dashboard look logos up by; _nearintents.js and _realdata.js read this folder at build time.
// READ FROM _nearintents.js RATHER THAN LISTED AGAIN. This was a hand-written array of the original nine chains and
// stayed that way while the route grew to thirty, so not one token on any chain added afterwards was ever fetched --
// DOGE, xDAI, GNO, COW and EURe all rendered as letter discs in the picker (RAZA 2026-09-23). The list of chains is
// not this file's to own; it belongs to the route, and a second copy only tells you it is wrong once someone looks.
const NI_CHAINS = (() => {
  const src = fs.readFileSync(path.join(__dirname, '_nearintents.js'), 'utf8');
  const m = src.match(/var NI_CHAIN = \{([\s\S]*?)\};/);
  if (!m) { console.error('  ! could not read NI_CHAIN from _nearintents.js'); process.exit(1); }
  const keys = (m[1].match(/:\s*'([a-z0-9-]+)'/g) || []).map((s) => s.replace(/^:\s*'|'$/g, ''));
  if (!keys.length) { console.error('  ! NI_CHAIN parsed empty'); process.exit(1); }
  return keys;
})();
const MAJORS = ['NEAR', 'ETH', 'WETH', 'USDC', 'USDT', 'USDT0', 'WBTC', 'cbBTC', 'DAI', 'LINK', 'UNI', 'AAVE', 'ARB', 'GMX', 'OP', 'POL', 'AVAX', 'BERA', 'MON', 'XPL'];
let SYMBOLS = MAJORS.slice();
const SAFE = /^[A-Za-z0-9._-]{1,24}$/;   // becomes a file name and a URL path segment
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
  toks.forEach((t) => { if (NI_CHAINS.indexOf(t.blockchain) >= 0 && !/DEPRECATED/i.test(t.symbol || '') && SAFE.test(t.symbol || '') && SYMBOLS.indexOf(t.symbol) < 0) SYMBOLS.push(t.symbol); });
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
        if (/missing_(large|small|thumb)/.test(url)) throw new Error('CoinGecko has no logo for ' + id);   // its placeholder
        const r = await fetch(url, { signal: AbortSignal.timeout(20000) }); buf = Buffer.from(await r.arrayBuffer());
        console.log('  ' + s.padEnd(6) + ' <- ' + id);
      }
      fs.writeFileSync(file, await png(buf)); made++;
    } catch (e) { missing.push(s + ' (' + e.message + ')'); }
  }
  console.log('ni logos: ' + made + ' written' + (missing.length ? ' | missing: ' + missing.join(', ') : ''));
})();
