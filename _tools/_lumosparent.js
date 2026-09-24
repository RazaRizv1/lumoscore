// Network choosers: /trade, /pools, /bridge, /rewards and /lumos each ask which chain first.
//
// A LumosCore page answers "what is this **on Stellar**" -- the Trade table is Stellar markets, the
// pools are Stellar pools, the rewards are Stellar rounds. Serving one of those at the bare path made
// the Stellar figures look like the whole story, which on /lumos produced a doubled supply and a
// "both chains" holder list on a page that only ever counted one.
//
// So the bare path asks, and /<thing>/stellar answers. Adding XRPL later is a row in NETWORKS, not a
// new page -- and until then it renders as an announced-but-not-live card that cannot be clicked, so
// the chooser is honest about what exists without promoting a chain that is not public.
//
// THIS FILE STARTED AS /lumos ONLY and now drives all five (it keeps its name so its own idempotent
// strip still finds the markup it baked into the containers under the old name -- renaming it would
// orphan an lx-lp block on the LUMOS page forever, since a transform can only remove what it can
// still match).
//
// BOTH PATHS SERVE THE SAME FILE. The route table maps them to one container key and the head script
// decides which view to show from location.pathname. That avoids inventing a second baked page per
// chooser in a design system where every page is a container key.
//
// THE DECISION RUNS IN <head>, NOT AT THE END OF <body>. On /lumos that was survivable; on /trade the
// full market table would paint first and then vanish, which is the flash pattern this codebase keeps
// re-learning. _externalize.js leaves head scripts inline precisely so gates like this stay
// pre-paint, and the class goes on <html> because <body> does not exist yet at that point.
//
// Someone already connected to Stellar is not asked the question -- they are sent straight through. A
// chooser with one live option is a speed bump for the person who has already chosen.
//
// Idempotent: style, script and section blocks are replaced wholesale.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);
// The same registry the bridge and network switcher draw from, so a chain looks identical everywhere.
const CHAINS = JSON.parse(fs.readFileSync(__dirname + '/_chains.json', 'utf8'));
const chainLogo = (id) => (CHAINS[id] && CHAINS[id].logo) || '';

const STYLE = '<style id="lx-lumosparent-css">'
  + '.lx-lp{max-width:720px;margin:0 auto;padding:30px 0 60px}'
  // The header is CENTRED and the cards are not: centring a heading reads as a title, while centring
  // a row of label/value pairs makes them harder to scan down.
  + '.lx-lp-head{text-align:center;margin:0 0 28px}'
  + '.lx-lp-h{font:800 34px/1.12 "Hanken Grotesk",system-ui,sans-serif;color:var(--text,#0e0e10);'
  + 'letter-spacing:-.03em;text-wrap:balance;margin:0 0 10px}'
  + '.lx-lp-sub{font:500 15px/1.6 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-muted,#8a8fa3);'
  + 'max-width:46ch;margin:0 auto;text-wrap:pretty}'
  + '@media(max-width:640px){.lx-lp{padding:22px 0 44px}.lx-lp-h{font-size:26px}.lx-lp-sub{font-size:14px}}'
  + '.lx-lp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}'
  + '@media(max-width:640px){.lx-lp-grid{grid-template-columns:1fr}}'
  + '.lx-lp-card{display:flex;align-items:center;gap:14px;padding:18px;border-radius:16px;'
  + 'border:1px solid var(--border,#ececef);background:var(--surface,#fff);text-decoration:none;color:inherit;'
  // a barely-there top highlight, so the card reads as a raised surface on the dark build without
  // needing a second colour token that light mode would have to undo
  + 'background-image:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,0) 58%);'
  + 'transition:border-color .18s ease,transform .18s ease,box-shadow .18s ease}'
  + '.lx-lp-card:hover{border-color:var(--accent,#ea6a2c);transform:translateY(-2px);'
  + 'box-shadow:0 10px 26px rgba(0,0,0,.16)}'
  + '.lx-lp-card:focus-visible{outline:2px solid var(--accent,#ea6a2c);outline-offset:3px}'
  + '.lx-lp-ico{width:42px;height:42px;flex:0 0 42px;border-radius:50%;background-size:cover;'
  + 'background-position:center;background-repeat:no-repeat;position:relative;'
  // a hairline ring so a dark mark still reads as a disc on a dark card
  + 'box-shadow:0 0 0 1px rgba(127,127,140,.22)}'
  // Refuse the healer's letter tile outright if it still lands on this element.
  + '.lx-lp-ico{font-size:0!important;color:transparent!important}'
  + '.lx-lp-ico>svg{width:0!important;height:0!important;position:absolute!important}'
  // A column, because these are two lines: as inline spans they ran together and the meta's margin-top
  // was inert.
  + '.lx-lp-main{min-width:0;flex:1 1 auto;display:flex;flex-direction:column;gap:4px}'
  + '.lx-lp-net{font:800 16px/1.2 "Hanken Grotesk",system-ui,sans-serif;color:var(--text,#0e0e10);'
  + 'letter-spacing:-.01em}'
  + '.lx-lp-meta{font:600 12px/1.35 "JetBrains Mono",ui-monospace,monospace;'
  + 'color:var(--text-muted,#8a8fa3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  // The chevron sits in a disc that fills with the accent on hover, so the live card has one obvious
  // thing to aim at rather than a bare glyph.
  + '.lx-lp-go{flex:0 0 auto;width:28px;height:28px;border-radius:50%;display:flex;'
  + 'align-items:center;justify-content:center;background:var(--surface-2,#f4f5f7);'
  + 'color:var(--text-muted,#8a8fa3);transition:background .18s ease,color .18s ease,transform .18s ease}'
  + '.lx-lp-go svg{width:14px;height:14px}'
  + '.lx-lp-card:hover .lx-lp-go{background:var(--accent,#ea6a2c);color:#fff;transform:translateX(2px)}'
  // A chain that is announced but not live must not look clickable: no hover, no pointer, dimmed.
  + '.lx-lp-card.soon{opacity:.6;pointer-events:none;background-image:none;'
  + 'border-style:dashed}'
  + '.lx-lp-soon{margin-left:auto;flex:0 0 auto;padding:4px 9px;border-radius:99px;'
  + 'background:transparent;border:1px solid var(--border,#ececef);color:var(--text-muted,#8a8fa3);'
  + 'font:700 9.5px/1.4 "Hanken Grotesk",system-ui,sans-serif;text-transform:uppercase;letter-spacing:.07em;'
  + 'white-space:nowrap}'
  + '@media(prefers-reduced-motion:reduce){.lx-lp-card,.lx-lp-go{transition:none}'
  + '.lx-lp-card:hover{transform:none}}'
  // and the tag itself is short enough for the healer to mistake for a ticker, so it opts out too
  + '.lx-lp-soon>svg{width:0!important;height:0!important;position:absolute!important}'
  // The chooser is hidden by default and revealed only on the bare path, so the chain page (same
  // file) never shows it. CSS does the reveal, not script, so it cannot flash in on a slow frame.
  + '.lx-lp{display:none}'
  + 'html.lx-lp-on .lx-lp{display:block}'
  // While the chooser is up, the page's own sections stay out of the flow entirely. The breadcrumb is
  // kept -- it is navigation, not content. Anything OUTSIDE the content wrapper (the FAQ block, the
  // footer) is deliberately untouched and still renders under the chooser.
  + 'html.lx-lp-on .page > *:not(.lx-lp):not(.crumb),'
  + 'html.lx-lp-on main > *:not(.lx-lp):not(.crumb),'
  + 'html.lx-lp-on .container > *:not(.lx-lp):not(.crumb){display:none!important}'
  + '</style>';

// One row per chain per hub. `live:false` renders as an announced-but-not-yet card rather than a dead
// link. XRPL is deliberately NOT linked anywhere here: it is built but not public.
const XRPL_SOON = { id: 'xrpl', name: 'XRP Ledger', href: '', live: false, meta: 'Planned' };

// key  — the container page key this chooser is baked into (base name, theme suffix stripped)
// path — the bare url that shows it
const HUBS = [
  {
    key: 'lumoscore-dex', path: '/trade',
    h1: 'Trade', title: 'Trade — Choose a network | LumosCore',
    sub: 'Swap assets and place limit orders on-chain. Choose a network to see its markets.',
    stellarMeta: 'Swaps and limit orders',
  },
  {
    key: 'lumoscore-amm', path: '/pools',
    h1: 'Liquidity Pools', title: 'Liquidity Pools — Choose a network | LumosCore',
    sub: 'Provide liquidity and earn a share of the trading fees. Choose a network to see its pools.',
    stellarMeta: 'AMM pools',
  },
  {
    key: 'lumoscore-bridge', path: '/bridge',
    h1: 'Bridge', title: 'Bridge — Choose a network | LumosCore',
    sub: 'Move assets between networks. Choose the network you are bridging from.',
    stellarMeta: 'CCTP, LayerZero, NEAR Intents',
  },
  {
    key: 'lumoscore-rewards', path: '/rewards',
    h1: 'LUMOS Rewards', title: 'LUMOS Rewards — Choose a network | LumosCore',
    sub: 'Liquidity and holder rewards, paid out each round. Choose a network to see its rounds.',
    stellarMeta: '3M LUMOS per round',
  },
  {
    key: 'lumoscore-lumos-token', path: '/lumos',
    h1: 'LUMOS', title: 'LUMOS — Choose a network | LumosCore',
    sub: 'LumosCore’s native token. Choose a network to see its price, pools and holders there.',
    stellarMeta: 'LUMOS · 1B supply',
  },
];

const GO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';

function netsFor(hub) {
  return [
    { id: 'stellar', name: 'Stellar', href: hub.path + '/stellar', live: true,
      icon: chainLogo('stellar'), meta: hub.stellarMeta },
    Object.assign({ icon: chainLogo('xrpl') }, XRPL_SOON),
  ];
}

function cardHTML(n) {
  // data-lxc / data-logoed / a zero-size svg child: three independent ways to tell the container's logo
  // healer to leave this element alone. Without them it paints a letter-"L" over the chain's mark.
  const SKIP = ' data-lxc="" data-logoed="1"';
  const GUARD = '<svg width="0" height="0" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden"></svg>';
  // SINGLE quotes around the URL, not JSON.stringify.
  //
  // JSON.stringify wraps the data URI in DOUBLE quotes, and this goes inside a double-quoted style
  // attribute, so the parser ended the attribute at the URI's opening quote. What reached the browser
  // was style="background-image:url(" -- an invalid declaration and a pile of junk attributes -- which
  // is why both chain marks on /lumos rendered as empty circles. It looked correct in the source and
  // was broken in the DOM, so it survived every read of the file.
  //
  // Asserted rather than assumed safe: a URI containing a single quote would reintroduce the same bug
  // one quote-character over.
  if (n.icon && n.icon.indexOf("'") >= 0) {
    throw new Error('chain icon for ' + n.id + " contains a single quote; it would break the style attribute");
  }
  const bg = n.icon ? (" style=\"background-image:url('" + n.icon + "')\"") : '';
  const inner = '<span class="lx-lp-ico"' + SKIP + bg + '>' + GUARD + '</span>'
    + '<span class="lx-lp-main"><span class="lx-lp-net">' + n.name + '</span>'
    + '<span class="lx-lp-meta">' + n.meta + '</span></span>'
    + (n.live ? ('<span class="lx-lp-go">' + GO + '</span>')
              : ('<span class="lx-lp-soon"' + SKIP + '>' + GUARD + 'Upcoming</span>'));
  return n.live
    ? '<a class="lx-lp-card" href="' + n.href + '" data-lxnet="' + n.id + '">' + inner + '</a>'
    : '<div class="lx-lp-card soon" data-lxnet="' + n.id + '">' + inner + '</div>';
}

function viewHTML(hub) {
  return '<section class="lx-lp">'
    + '<div class="lx-lp-head">'
    + '<h1 class="lx-lp-h">' + hub.h1 + '</h1>'
    + '<p class="lx-lp-sub">' + hub.sub + '</p>'
    + '</div>'
    + '<div class="lx-lp-grid">' + netsFor(hub).map(cardHTML).join('') + '</div>'
    + '</section>';
}

// Runs in <head>, before the body exists and before anything paints.
function scriptHTML(hub) {
  return '<script id="lx-lumosparent">(function(){try{'
    // Trailing slash tolerated; anything deeper (/trade/stellar) is a network page, not the chooser.
    + 'var p=(location.pathname||"").replace(/\\/+$/,"");'
    + 'var HUB=' + JSON.stringify(hub.path) + ', KEY=' + JSON.stringify(hub.key) + ';'
    // The raw container filename only comes up opening the built file directly, where there is no
    // routing at all; matching it keeps the chooser reachable there too. Anything else -- above all
    // HUB + "/stellar" -- is the network page and must render normally.
    + 'var last=p.split("/").pop()||"";'
    + 'if(p!==HUB&&last.indexOf(KEY)!==0)return;'
    // Already connected on Stellar: answer the question rather than ask it. replace() so Back does not
    // bounce between the chooser and the page it forwarded to.
    + 'var a="",c="";'
    + 'try{ a=localStorage.getItem("lumos.address")||"";'
    + 'c=(localStorage.getItem("lumos.chain")||"").toLowerCase(); }catch(_){}'
    + 'if(a&&(c===""||c==="stellar")){ location.replace(HUB+"/stellar"); return; }'
    + 'document.documentElement.classList.add("lx-lp-on");'
    + 'document.addEventListener("DOMContentLoaded",function(){try{document.title=' + JSON.stringify(hub.title) + ';}catch(_){}});'
    + 'try{document.title=' + JSON.stringify(hub.title) + ';}catch(_){}'
    + '}catch(_){}})();</script>';
}

const baseOf = (k) => k.replace(/\.html$/, '').replace(/-(dark|light|mobile)$/, '');

let pages = 0, missed = 0;
const hit = {};
for (const dev of ['desktop', 'mobile']) {
  const file = `lumoscore-aptos-${dev}.html`;
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;

  for (const k of Object.keys(json)) {
    // EXACT base match, never a substring: "lumoscore-dex" is a prefix of "lumoscore-dex-asset" and
    // "lumoscore-amm" of "lumoscore-amm-pool", so an unanchored test would bake a chooser onto every
    // asset and pool detail page.
    const hub = HUBS.filter((h) => h.key === baseOf(k))[0];
    let p = json[k];
    const before = p;

    // Strip unconditionally, on EVERY page: an earlier run of this file put the LUMOS chooser on its
    // page, and a page that is no longer a hub must lose its markup rather than keep it forever.
    p = p.replace(/<style id="lx-lumosparent-css">[\s\S]*?<\/style>/g, '')
         .replace(/<script id="lx-lumosparent">[\s\S]*?<\/script>/g, '')
         .replace(/<section class="lx-lp"[\s\S]*?<\/section>/g, '');

    if (hub) {
      // The view goes at the top of the page's own content wrapper, so the breadcrumb above it still
      // reads. Desktop wraps in <main>; the phone has no <main> at all and uses .container -- checked
      // rather than assumed, because the first pass silently inserted nothing on mobile.
      let ins = -1;
      const mainAt = p.indexOf('<main');
      if (mainAt >= 0) ins = p.indexOf('>', mainAt) + 1;
      if (ins <= 0) {
        const contAt = p.indexOf('<div class="container"');
        if (contAt >= 0) ins = p.indexOf('>', contAt) + 1;
      }
      if (ins > 0) {
        p = p.slice(0, ins) + viewHTML(hub) + p.slice(ins);
        // head, so the gate is pre-paint and the style is present before the first frame
        if (p.indexOf('</head>') >= 0) p = p.replace('</head>', STYLE + scriptHTML(hub) + '</head>');
        pages++;
        hit[hub.path] = (hit[hub.path] || 0) + 1;
      } else { console.log('  ! no insertion point on ' + k); missed++; }
    }

    if (p !== before) { json[k] = p; changed = true; }
  }

  if (changed) {
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
const cover = HUBS.map((h) => h.path + ':' + (hit[h.path] || 0)).join(' ');
console.log('network choosers: ' + pages + ' page key(s) — ' + cover);
// Every hub must land on at least one page key, or a bare path silently serves the chain page.
const empty = HUBS.filter((h) => !hit[h.path]);
if (empty.length) { console.error('  ! no page key matched: ' + empty.map((h) => h.path).join(', ')); process.exit(1); }
if (missed) process.exit(1);
