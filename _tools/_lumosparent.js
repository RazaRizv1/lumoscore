// /lumos is a network chooser; /lumos/stellar is the token page.
//
// LUMOS is planned across several chains, and the token page answers "what is LUMOS **on Stellar**" --
// its price, its pools, its holders are all Stellar facts. Serving that at /lumos made the Stellar
// figures look like the whole story, which is what produced doubled supply and a "both chains" holder
// list on a page that only ever counted one.
//
// So: /lumos asks which network, /lumos/stellar answers for Stellar. Today there is one live box and a
// placeholder for what is coming; adding XRPL later is a row in NETWORKS, not a new page.
//
// BOTH PATHS SERVE THE SAME FILE. The route table maps them to lumoscore-lumos-token, and this script
// decides which view to show from location.pathname. That avoids inventing a second page in a design
// system where every page is a baked container key.
//
// Someone already connected to Stellar is not asked the question -- they are sent straight through. A
// chooser with one live option is a speed bump for the person who has already chosen.
//
// Idempotent: style and script blocks are replaced wholesale.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const STYLE = '<style id="lx-lumosparent-css">'
  + '.lx-lp{max-width:760px;margin:0 auto;padding:8px 0 40px}'
  + '.lx-lp-h{font:800 26px/1.15 "Hanken Grotesk",system-ui,sans-serif;color:var(--text,#0e0e10);'
  + 'letter-spacing:-.02em;margin:0 0 6px}'
  + '.lx-lp-sub{font:600 14px/1.5 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-muted,#8a8fa3);margin:0 0 22px}'
  + '.lx-lp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}'
  + '@media(max-width:640px){.lx-lp-grid{grid-template-columns:1fr}}'
  + '.lx-lp-card{display:flex;align-items:center;gap:13px;padding:16px;border-radius:15px;'
  + 'border:1px solid var(--border,#ececef);background:var(--surface,#fff);text-decoration:none;color:inherit;'
  + 'transition:border-color .15s,transform .15s}'
  + '.lx-lp-card:hover{border-color:var(--accent,#ea6a2c);transform:translateY(-1px)}'
  + '.lx-lp-ico{width:40px;height:40px;flex:0 0 40px;border-radius:50%;background-size:cover;background-position:center}'
  + '.lx-lp-main{min-width:0;flex:1 1 auto}'
  + '.lx-lp-net{font:800 15px/1.2 "Hanken Grotesk",system-ui,sans-serif;color:var(--text,#0e0e10)}'
  + '.lx-lp-meta{margin-top:3px;font:600 12.5px/1.35 "JetBrains Mono",ui-monospace,monospace;'
  + 'color:var(--text-muted,#8a8fa3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  + '.lx-lp-go{flex:0 0 auto;color:var(--text-muted,#8a8fa3);display:flex}'
  + '.lx-lp-go svg{width:15px;height:15px}'
  + '.lx-lp-card:hover .lx-lp-go{color:var(--accent,#ea6a2c)}'
  // A chain that is announced but not live must not look clickable.
  + '.lx-lp-card.soon{opacity:.55;pointer-events:none}'
  + '.lx-lp-soon{margin-left:auto;flex:0 0 auto;padding:3px 8px;border-radius:99px;'
  + 'background:var(--surface-2,#f4f5f7);color:var(--text-muted,#8a8fa3);'
  + 'font:700 10px/1.4 "Hanken Grotesk",system-ui,sans-serif;text-transform:uppercase;letter-spacing:.04em}'
  // While the chooser is up, the token page's own sections stay out of the flow entirely.
  + 'body.lx-lp-on .page > *:not(.lx-lp):not(.crumb),'
  + 'body.lx-lp-on .container > *:not(.lx-lp):not(.crumb){display:none!important}'
  + '</style>';

// One entry per chain. `live:false` renders as an announced-but-not-yet row rather than a dead link.
const NETWORKS = [
  { id: 'stellar', name: 'Stellar', href: '/lumos/stellar', live: true,
    icon: '/assets/tokens/xlm.png', meta: 'LUMOS · 1B supply' },
  { id: 'xrpl', name: 'XRP Ledger', href: '', live: false,
    icon: '', meta: 'Planned' },
];

const GO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';

function cardHTML(n) {
  const inner = '<span class="lx-lp-ico"' + (n.icon ? (' style="background-image:url(' + JSON.stringify(n.icon) + ')"') : '') + '></span>'
    + '<span class="lx-lp-main"><span class="lx-lp-net">' + n.name + '</span>'
    + '<span class="lx-lp-meta">' + n.meta + '</span></span>'
    + (n.live ? ('<span class="lx-lp-go">' + GO + '</span>') : '<span class="lx-lp-soon">Soon</span>');
  return n.live
    ? '<a class="lx-lp-card" href="' + n.href + '" data-lxnet="' + n.id + '">' + inner + '</a>'
    : '<div class="lx-lp-card soon" data-lxnet="' + n.id + '">' + inner + '</div>';
}

const VIEW = '<section class="lx-lp" hidden>'
  + '<h1 class="lx-lp-h">LUMOS</h1>'
  + '<p class="lx-lp-sub">LumosCore&rsquo;s native token. Choose a network to see its price, pools and holders there.</p>'
  + '<div class="lx-lp-grid">' + NETWORKS.map(cardHTML).join('') + '</div>'
  + '</section>';

const SCRIPT = '<script id="lx-lumosparent">(function(){'
  + 'var view=document.querySelector(".lx-lp"); if(!view)return;'
  // Trailing slash tolerated; anything deeper (/lumos/stellar) is a network page, not the chooser.
  + 'var p=(location.pathname||"").replace(/\\/+$/,"");'
  + 'var isParent=(p==="/lumos"||p===""||p==="/lumoscore-lumos-token");'
  + 'if(!isParent)return;'
  // Already on Stellar: answer the question rather than ask it. replace() so Back does not bounce
  // between the chooser and the page it forwarded to.
  + 'var onStellar=false;'
  + 'try{ var a=localStorage.getItem("lumos.address")||"";'
  + 'var c=(localStorage.getItem("lumos.chain")||"").toLowerCase();'
  + 'onStellar=!!a&&(c===""||c==="stellar"); }catch(_){}'
  + 'if(onStellar){ location.replace("/lumos/stellar"); return; }'
  + 'document.body.classList.add("lx-lp-on");'
  + 'view.removeAttribute("hidden");'
  + 'try{ document.title="LUMOS — Choose a network | LumosCore"; }catch(_){}'
  + '})();</script>';

let keys = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = `lumoscore-aptos-${dev}.html`;
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;

  for (const k of Object.keys(json)) {
    if (!/lumos-token/.test(k)) continue;
    let p = json[k];
    const before = p;

    p = p.replace(/<style id="lx-lumosparent-css">[\s\S]*?<\/style>/, '')
         .replace(/<script id="lx-lumosparent">[\s\S]*?<\/script>/, '')
         .replace(/<section class="lx-lp"[\s\S]*?<\/section>/, '');

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
    if (ins > 0) p = p.slice(0, ins) + VIEW + p.slice(ins);
    else console.log('  ! no insertion point on ' + k);

    if (p.indexOf('</head>') >= 0) p = p.replace('</head>', STYLE + '</head>');
    const bi = p.lastIndexOf('</body>');
    if (bi >= 0) p = p.slice(0, bi) + SCRIPT + p.slice(bi);
    keys++;

    if (p !== before) { json[k] = p; changed = true; }
  }

  if (changed) {
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
console.log('lumos parent: chooser on ' + keys + ' page keys, ' + NETWORKS.length + ' networks ('
  + NETWORKS.filter((n) => n.live).length + ' live)');
