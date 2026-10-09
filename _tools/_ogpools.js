// Share cards for the pool pages: the network chooser, the two per-chain pool pages, and one card
// per pool for the top 100 on each chain.
//
// WHY ONLY THE TOP 100 (RAZA, 2026-10-08). There are 11,026 Stellar pools and 31,328 on the XRP
// Ledger; drawing a card for each is neither possible at build time nor worth it. A pool outside the
// top 100 shows its chain's pools card instead -- the same rule an uncurated asset follows.
//
// HOW THE TOP 100 IS PICKED IS NOT THE SAME ON BOTH CHAINS, deliberately.
//
//   Stellar  -> by TVL, as asked. Stellar pool value is priced from real market data, and the top
//               100 checks out: no pool pairs a code with itself, and the zero-volume entries in it
//               are genuine wrappers (XLM/yXLM, USDC/yUSDC) rather than junk.
//
//   XRPL     -> by 24h VOLUME, not liquidity. XRPL "liquidity" is nominal value that anyone can
//               conjure for free by pairing a worthless token with itself: sorting by it put five
//               BITx pools claiming 113,000,000x liquidity and ZERO volume at the top, which is why
//               xrplpools.js serves the pools page by volume already. Ranking cards by liquidity
//               would have drawn ~100 branded previews for spam pools carrying issuer-supplied
//               artwork. Volume costs real trading, so it cannot be faked for nothing.
//
// Output: dist/assets/og/p/<chain>-<id>.png, served by functions/lxapi/ogpool.js, which falls back
// to the chain's pools card for anything it has not drawn.
//
// Usage: node _tools/_ogpools.js [--xrpl-origin https://...] [--limit N]
const fs = require('fs');
const path = require('path');
const K = require('./_ogkit.js');

const ORIGIN = 'https://lumoscore.com';
const OUT_P = path.join(__dirname, '..', 'dist', 'assets', 'og', 'p');
const OUT_S = path.join(__dirname, '..', 'dist', 'assets', 'og', 's');
const TOP = 100;

// XRPL currency codes are 40-char hex once they are longer than three characters.
function xrplCode(c) {
  const s = String(c || '');
  if (!/^[0-9A-Fa-f]{40}$/.test(s)) return s;
  let out = '';
  for (let i = 0; i < 40; i += 2) {
    const v = parseInt(s.slice(i, i + 2), 16);
    if (!v) break;
    out += String.fromCharCode(v);
  }
  return out.replace(/[^\x20-\x7E]/g, '').trim() || s.slice(0, 8);
}

// Two logos, side by side, which is what makes a pool card read as a pool rather than an asset.
// The two logos of a pair. `ca`/`cb` are the asset CODES, used only when a logo is missing.
//
// AN EMPTY TILE READS AS A BROKEN CARD, NOT AS A MISSING LOGO. This used to draw the tile and then
// `return` on no uri, leaving an outline with nothing in it -- 43 of the 100 Stellar pool cards,
// because a pool pairing XLM with an asset outside the curated manifest has no logo to draw for the
// second half. (XRPL: 1 of 100, since its logos come from a source that covers the whole roster.)
// The reader cannot tell that from a load failure, which is the same reasoning already written into
// the asset card's issuer fallback.
//
// So: the two-letter monogram assetPanel has always drawn, at the same proportions -- its glyph is
// 84 on a 226 tile and sits 30 above centre, which is 0.372 and 0.357 of those, applied to CELL here
// so the pair tiles and the single tile look like the same object at two sizes.
function pairPanel(a, b, ca, cb) {
  const GAP = 14, CELL = Math.round((K.INNER - GAP) / 2);
  const top = K.PY + K.PAD + (K.INNER - CELL) / 2;
  const slots = [K.PX + K.PAD, K.PX + K.PAD + CELL + GAP];
  const FS = Math.round(CELL * 0.372);
  let svg = '', defs = '';
  [a, b].forEach((uri, i) => {
    const cx = slots[i], r = Math.round(CELL * 0.27);
    svg += '<rect x="' + cx + '" y="' + top + '" width="' + CELL + '" height="' + CELL + '" rx="' + r
      + '" fill="#ffffff" fill-opacity="0.05" stroke="#ffffff" stroke-opacity="0.09"/>';
    if (!uri) {
      // Drawn ON the tile already laid down above, rather than on assetPanel's opaque #2a2a32, so a
      // monogram tile and a logo tile beside it stay siblings instead of two different objects.
      const code = String((i === 0 ? ca : cb) || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?';
      svg += K.bold(cx + CELL / 2, top + CELL / 2 + Math.round(FS * 0.357), FS, code, '#fff', 0, 1.8, 'middle');
      return;
    }
    const p = 14, s = CELL - p * 2, id = 'pp' + i;
    defs += '<clipPath id="' + id + '"><rect x="' + (cx + p) + '" y="' + (top + p) + '" width="' + s + '" height="' + s + '" rx="' + Math.round(s * 0.28) + '"/></clipPath>';
    svg += '<image x="' + (cx + p) + '" y="' + (top + p) + '" width="' + s + '" height="' + s + '" href="' + uri
      + '" clip-path="url(#' + id + ')" preserveAspectRatio="xMidYMid meet"/>';
  });
  return { svg, defs };
}

function poolCard({ chain, ca, cb, la, lb }) {
  const p = pairPanel(la, lb, ca, cb);
  return K.shell({
    defs: p.defs,
    row: K.metaRow([{ chain }, { text: 'Liquidity pool' }]).svg,
    headline: ca + ' / ' + cb,
    accent: 'Provide liquidity on LumosCore',
    features: 'Reserves · Activity · Participants',
    panel: p.svg,
  });
}

// WRITTEN WITH A RETRY. Cards here fail with "UNKNOWN: unknown error" on open every few runs -- a
// transient Windows lock, the sort a virus scanner takes on a file written a moment ago. One or two
// of the two hundred hit it each time, and the card is then silently left on the previous design,
// which is the same failure the XRPL asset cards already carry this fix for.
async function writeCard(file, png) {
  let last = '';
  for (let i = 0; i < 3; i++) {
    try { fs.writeFileSync(file, png); return true; }
    catch (e) { last = e.message; await new Promise((r) => setTimeout(r, 300)); }
  }
  throw new Error(last);
}

// The XRPL pool roster, top by 24h volume. CALLED BEFORE ANY LOGO IS FETCHED -- see the note at the
// call site for why the order is the fix.
//
// The endpoint has two moods. Asked on its own it pages properly: `more:true, nextP0:2`, a different
// fifty each time. Asked after this build has hammered the same host it answers
// `{ok,count,total,filteredBy,summary,rows,...}` -- fifty rows, no p0/nextP0/more -- and IGNORES p0,
// handing back the first fifty for every page. Measured both, including p0=1 itself coming back
// without `more` mid-build.
//
// Each obvious rule fails one mood. Stopping on `!j.more` stopped at exactly fifty every run: half
// the cards never redrawn and, because the prune needs a full set, stale ones piling up unreported
// (116 files for a hundred pools). Continuing on a full page instead collected the same fifty twice
// -- a hundred rows, fifty distinct accounts -- and the prune then deleted the fifty it had just
// been told were not in the keep set. So the loop dedupes on the account and stops when a page
// brings nothing NEW, which is the real terminating condition: no new work.
async function fetchXrplRoster(origin, limit) {
  const PAGE = 50;
  const out = [], seenAcct = new Set();
  try {
    for (let p0 = 1; out.length < limit; ) {
      let rows = [], j = {}, added = 0;
      for (let att = 0; att < 3; att++) {
        if (att) await new Promise((r) => setTimeout(r, 1500));
        try {
          j = await (await fetch(origin + '/lxapi/xrplpools?n=' + PAGE + '&p0=' + p0)).json();
        } catch (e) { continue; }
        rows = j.rows || [];
        added = 0;
        for (const r of rows) {
          if (!r || !r.acct || seenAcct.has(r.acct)) continue;
          seenAcct.add(r.acct);
          out.push(r);
          added++;
        }
        if (added) break;
      }
      if (!rows.length || !added) break;
      if (!j.more && rows.length < PAGE) break;
      p0 = j.nextP0 || (p0 + 1);
    }
  } catch (e) { console.error('  xrpl pools: ' + e.message); }
  return out.slice(0, limit);
}

async function stellarLogo(u) {
  if (!u) return '';
  return await K.imageDataUri(u.indexOf('/') === 0 ? ORIGIN + u : u);
}

(async () => {
  if (!K.hasFont()) { console.error('og pools: no font — nothing written'); process.exit(1); }
  const xa = process.argv.indexOf('--xrpl-origin');
  const XORIGIN = xa > 0 ? process.argv[xa + 1] : ORIGIN;
  const la = process.argv.indexOf('--limit');
  const LIMIT = la > 0 ? Math.max(1, parseInt(process.argv[la + 1], 10) || TOP) : TOP;

  fs.mkdirSync(OUT_P, { recursive: true });
  fs.mkdirSync(OUT_S, { recursive: true });

  // THE XRPL ROSTER IS FETCHED FIRST, BEFORE A SINGLE LOGO. Not tidiness -- it is the fix.
  //
  // /lxapi/xrplpools pages correctly when asked cold and stops paging once this build has put a
  // couple of hundred logo requests through the same host: no `more`, no `nextP0`, and p0 ignored so
  // every page is page one. Three retries with pauses did not shift it, because the degradation
  // lasts the whole run rather than a moment. Asking before the load is what actually works, and it
  // costs nothing -- the rows are only needed further down.
  const xTop = await fetchXrplRoster(XORIGIN, LIMIT);

  const logos = new Map();                      // one fetch per distinct token, not per pool side
  const getS = async (u) => { if (!logos.has(u)) logos.set(u, await stellarLogo(u)); return logos.get(u); };
  const getX = async (m) => {
    if (!m) return '';
    if (!logos.has(m)) logos.set(m, await K.imageDataUri(XORIGIN + '/lxapi/xrplthumb?id=' + m + '&w=128'));
    return logos.get(m);
  };

  let drawn = 0;
  const seen = [];

  // ---- Stellar: top 100 by TVL -------------------------------------------------------------------
  let sTop = [];
  try {
    const j = await (await fetch(ORIGIN + '/lxapi/pools?per=' + LIMIT)).json();
    sTop = (j.rows || []).slice(0, LIMIT);
  } catch (e) { console.error('  stellar pools: ' + e.message); }
  for (const r of sTop) {
    try {
      const la2 = await getS(r.a && r.a.img), lb2 = await getS(r.b && r.b.img);
      const png = K.render(poolCard({ chain: 'Stellar', ca: (r.a && r.a.code) || '?', cb: (r.b && r.b.code) || '?', la: la2, lb: lb2 }));
      await writeCard(path.join(OUT_P, 'stellar-' + r.id + '.png'), png);
      drawn++;
    } catch (e) { console.error('  stellar ' + r.id + ': ' + e.message); }
  }
  if (sTop[0]) seen.push(['pools-stellar', 'Stellar', sTop[0]]);

  // ---- XRPL: top 100 by 24h volume ---------------------------------------------------------------
  // Already fetched, at the very top of this run. Nothing to do here but draw.
  for (const r of xTop) {
    try {
      const la2 = await getX(r.a1 && r.a1.m), lb2 = await getX(r.a2 && r.a2.m);
      const png = K.render(poolCard({
        chain: 'XRPL',
        ca: xrplCode(r.a1 && r.a1.c), cb: xrplCode(r.a2 && r.a2.c), la: la2, lb: lb2,
      }));
      // The URL keys on the AMM ACCOUNT, not the row's own id.
      await writeCard(path.join(OUT_P, 'xrpl-' + r.acct + '.png'), png);
      drawn++;
    } catch (e) { console.error('  xrpl ' + r.acct + ': ' + e.message); }
  }
  if (xTop[0]) seen.push(['pools-xrpl', 'XRPL', xTop[0]]);

  // ---- the three section cards -------------------------------------------------------------------
  // Each chain's pools card wears that chain's busiest pool as its pair, so it reads as a pool page
  // rather than another markets page.
  for (const [name, chain, r] of seen) {
    const isX = chain === 'XRPL';
    const la2 = isX ? await getX(r.a1 && r.a1.m) : await getS(r.a && r.a.img);
    const lb2 = isX ? await getX(r.a2 && r.a2.m) : await getS(r.b && r.b.img);
    // The codes too, so the section card gets the same fallback as the per-pool ones. Its pair is the
    // chain's busiest pool, which has always had both logos -- but "has always" is not a guarantee.
    const p = pairPanel(la2, lb2,
      isX ? xrplCode(r.a1 && r.a1.c) : ((r.a && r.a.code) || ''),
      isX ? xrplCode(r.a2 && r.a2.c) : ((r.b && r.b.code) || ''));
    const png = K.render(K.shell({
      defs: p.defs,
      row: K.metaRow([{ chain }]).svg,
      headline: isX ? 'XRPL Pools' : 'Stellar Pools',
      accent: 'Provide liquidity on LumosCore',
      features: 'TVL · Volume · Fees · APR',
      panel: p.svg,
    }));
    await writeCard(path.join(OUT_S, name + '.png'), png);
  }
  // The chooser: both chain marks, matching the trade hub.
  {
    const GAP = 14, CELL = Math.round((K.INNER - GAP) / 2);
    const top = K.PY + K.PAD + (K.INNER - CELL) / 2;
    let svg = '';
    ['Stellar', 'XRPL'].forEach((c, i) => {
      const cx = K.PX + K.PAD + i * (CELL + GAP);
      svg += '<rect x="' + cx + '" y="' + top + '" width="' + CELL + '" height="' + CELL + '" rx="' + Math.round(CELL * 0.27)
        + '" fill="#ffffff" fill-opacity="0.05" stroke="#ffffff" stroke-opacity="0.09"/>';
      const h = Math.round(CELL * 0.46);
      svg += K.chainMark(c, cx + CELL / 2 - (K.CHAIN[c].bb[2] * (h / K.CHAIN[c].bb[3])) / 2, top + CELL / 2, h, K.INK).svg;
    });
    await writeCard(path.join(OUT_S, 'pools.png'), K.render(K.shell({
      row: K.metaRow([{ chain: 'Stellar' }, { chain: 'XRPL' }]).svg,
      headline: 'Pools',
      accent: 'Earn a share of the trading fees',
      features: 'TVL · Volume · Fees · APR',
      panel: svg,
    })));
  }

  // PRUNE WHAT IS NO LONGER IN THE TOP HUNDRED.
  //
  // The ranking moves, so each run draws a slightly different hundred. Without this, every pool that
  // ever entered the top hundred would keep its card for ever: the directory grows without bound and
  // the repo carries it, because production deploys from git. Dropping them also keeps the rule
  // honest -- a pool outside the top hundred is supposed to show its chain's card, and a leftover
  // file would quietly exempt it.
  //
  // Only run when a full set was drawn. A partial run -- the limit flag, or an endpoint that failed
  // mid-way -- must never be read as "everything else has dropped out".
  let pruned = 0;
  if (LIMIT >= TOP && sTop.length >= TOP && xTop.length >= TOP) {
    const keep = new Set([].concat(
      sTop.map((r) => 'stellar-' + r.id + '.png'),
      xTop.map((r) => 'xrpl-' + r.acct + '.png'),
    ));
    for (const f of fs.readdirSync(OUT_P)) {
      if (f.endsWith('.png') && !keep.has(f)) { fs.unlinkSync(path.join(OUT_P, f)); pruned++; }
    }
  }

  console.log('og pools: ' + drawn + ' pool card(s) (' + sTop.length + ' stellar by tvl, '
    + xTop.length + ' xrpl by 24h volume) -> dist/assets/og/p/, plus 3 section card(s)'
    + (pruned ? ', pruned ' + pruned + ' no longer in the top ' + TOP : ''));
})();
