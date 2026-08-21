// One back link per page, saying where it goes.
//
// Trade already read "← Back to dashboard" and Trade-Asset "← Back to DEX". Everywhere else had
// drifted into one of four shapes:
//   "← Back · Home / Cross-Chain Bridge"   a back link that does not say where, plus a crumb trail
//   "← Back to Pools · Home / AMM Pools /" the right label, followed by the trail anyway
//   "Home / MCP CLI"                       a trail and NO back link, in the page's own font
//   "← Back" -> javascript:history.back()  or href="#", which is not a destination at all
//
// All of them become the shape the two correct pages already use: a single anchor, the same arrow,
// the same typography, naming its destination. history.back() and "#" are replaced with the real
// URL -- "back" should be a place, not a guess about where the reader came from.
//
// Pages whose parent is the DASHBOARD also get data-lxdash, and the link is hidden outright when no
// wallet is connected: the dashboard is behind the auth gate, so offering it to a signed-out reader
// is offering a redirect. The hide is a <head> rule keyed off a class set synchronously in <head>,
// so the link never paints and then disappears.
//
// Deliberately NOT touched: Trade-Asset (its parent is the DEX, not the dashboard), the public
// address page (already correct), and the Bridge/Launchpad step buttons -- .br-back and friends are
// wizard controls that move between steps, not page navigation.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// page base (theme and mobile suffixes stripped) -> where its back link goes
const DEST = {
  'lumoscore-dex': ['Back to dashboard', '/dashboard', true],
  'lumoscore-amm': ['Back to dashboard', '/dashboard', true],
  'lumoscore-amm-pool': ['Back to Pools', '/pools/stellar', false],
  'lumoscore-bridge': ['Back to dashboard', '/dashboard', true],
  'lumoscore-launch-token': ['Back to dashboard', '/dashboard', true],
  'lumoscore-lumos-token': ['Back to dashboard', '/dashboard', true],
  'lumoscore-wallet': ['Back to dashboard', '/dashboard', true],
  'lumoscore-rewards': ['Back to dashboard', '/dashboard', true],
  'lumoscore-mcp': ['Back to dashboard', '/dashboard', true],
};

const ARROW = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
  + 'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
  + '<path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>';

function anchor(label, href, dash, cls) {
  return '<a' + (cls ? ' class="' + cls + '"' : '') + ' href="' + href + '" data-lxback="1"'
    + (dash ? ' data-lxdash="1"' : '') + '>' + ARROW + ' ' + label + '</a>';
}

const STYLE = `<style id="lx-backlink-css">
/* The MCP page styles its own crumb at 13px with no arrow slot; matched to .crumb so the link reads
   the same size and weight as it does on every other page. */
.mcp-crumb{display:flex;align-items:center;gap:8px;font-size:15px;color:var(--text-soft);margin:0 0 14px}
.mcp-crumb a{display:inline-flex;align-items:center;gap:4px;color:var(--text-muted);text-decoration:none}
.mcp-crumb a:hover{color:var(--accent)}
/* One size everywhere. Measured across the builds these were 13px (MCP), 15px (Trade, Pools, Bridge),
   16.5px (Wallet, Rewards, Launchpad) and 17px (LUMOS Token) -- the same control in four sizes. 15px
   is Trade's, which is the one that was called correct. Colour likewise: some inherited --text-soft
   and some --text-muted. Weight is deliberately left to each page, so nothing else shifts. */
/* !important because .back-link ties a bare attribute selector on specificity, which left Wallet,
   Rewards and Launchpad at 16.5px while the rest moved to 15. */
html [data-lxback]{font-size:15px!important;color:var(--text-muted);display:inline-flex;
  align-items:center;gap:4px;text-decoration:none}
[data-lxback]:hover{color:var(--accent)}
[data-lxback] svg{width:13px;height:13px;flex:0 0 auto}
/* No wallet, no dashboard link. Hidden by a rule rather than by script so it never paints first. */
html.lx-noconn [data-lxdash]{display:none!important}
</style>`;

// Set in <head>, synchronously, before the body that carries the link is parsed.
const GUARD = '<script id="lx-backlink-guard">(function(){try{'
  + 'if(!(localStorage.getItem("lumos.wallet")||localStorage.getItem("lumos.address")))'
  + 'document.documentElement.className+=" lx-noconn";}catch(_){ }})();</script>';

function baseOf(k) {
  let b = k.replace(/\.html$/, '');
  let prev;
  do { prev = b; b = b.replace(/-(dark|light|mobile)$/, ''); } while (b !== prev);
  return b;
}

let containers = 0, fixed = 0, skipped = [];
for (const dev of ['desktop', 'mobile']) {
  const file = `lumoscore-aptos-${dev}.html`;
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;

  for (const k of Object.keys(json)) {
    const cfg = DEST[baseOf(k)];
    if (!cfg) continue;
    const [label, href, dash] = cfg;
    let p = json[k];
    const before = p;

    p = p.replace(/<style id="lx-backlink-css">[\s\S]*?<\/style>/, '')
         .replace(/<script id="lx-backlink-guard">[\s\S]*?<\/script>/, '');

    let did = false;
    // 1) a .crumb block -- replace everything inside it
    p = p.replace(/<div class="(crumb)(?: [^"]*)?">([\s\S]{0,900}?)<\/div>/, function (all, cls, inner) {
      if (/<div/.test(inner)) { skipped.push(k + ' (.crumb has a nested div)'); return all; }
      did = true;
      return '<div class="' + cls + '">' + anchor(label, href, dash) + '</div>';
    });
    // 2) a .crumb-row -- Wallet, Rewards and Launchpad wrap the back link AND the trail in one of
    //    these, so replacing just the anchor left "· Home / Wallet" sitting beside the new link.
    if (!did) {
      p = p.replace(/<div class="crumb-row">([\s\S]{0,900}?)<\/div>/, function (all, inner) {
        if (/<div/.test(inner)) { skipped.push(k + ' (.crumb-row has a nested div)'); return all; }
        did = true;
        return '<div class="crumb-row">' + anchor(label, href, dash, 'back-link') + '</div>';
      });
    }
    // 3) the MCP page's own crumb
    if (!did) {
      p = p.replace(/<div class="mcp-crumb">([\s\S]{0,600}?)<\/div>/, function (all, inner) {
        if (/<div/.test(inner)) { skipped.push(k + ' (.mcp-crumb has a nested div)'); return all; }
        did = true;
        return '<div class="mcp-crumb">' + anchor(label, href, dash) + '</div>';
      });
    }
    // 3) a standalone .back-link anchor (keeps its class so the page's own rules still apply)
    if (!did) {
      p = p.replace(/<a class="back-link"[^>]*>[\s\S]{0,600}?<\/a>/, function () {
        did = true;
        return anchor(label, href, dash, 'back-link');
      });
    }
    if (!did) continue;

    if (p.indexOf('</head>') >= 0) p = p.replace('</head>', STYLE + GUARD + '</head>');
    if (p !== before) { json[k] = p; changed = true; fixed++; }
  }

  if (changed) {
    containers++;
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
if (skipped.length) skipped.forEach(x => console.log('  !! skipped ' + x));
console.log('back links: normalised on ' + fixed + ' page keys across ' + containers + ' containers');
