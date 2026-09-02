// Landing hero: a network selector on the left of the search field.
//
// The landing page is the one place with no connected wallet and therefore no chain in context, so the
// reader has to say which network a pasted pool id, address or asset code belongs to before the result
// can mean anything. Stellar and XRPL are listed, with their real marks from _netlogos.json; only
// Stellar can be picked, and XRPL carries a "Soon" chip and is genuinely disabled rather than merely
// styled to look it -- aria-disabled plus a guard in the handler.
//
// What this DOES change today, honestly: the choice is stored and published as window.__lxSearchNet,
// and the control states the model. It cannot change results yet, because every route the search
// builds is already Stellar (/trade/stellar/..., /pools/stellar/id/..., /account/stellar/...) and
// there is no second network to route to. When XRPL goes live the selector is the thing those routes
// read from; until then a Stellar selection is the only outcome either way.
//
// Two landmines this has to clear on the landing page:
//   * the design binds a click handler to .hero-search itself which opens the search popup, so the
//     selector stops propagation or every interaction with it also opens search;
//   * the page's nav interceptor matches an element's TEXT against nav labels and navigates before
//     anything else runs -- "Stellar" is not a nav label, but data-lxnonav is cheap insurance and is
//     what the product cards and FAQ tabs already needed.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const netlogos = require(__dirname + '/_netlogos.json');
const B = String.fromCharCode(92);

function logoOf(name) {
  const hit = netlogos.filter(x => x.name === name)[0];
  return hit ? String(hit.logo) : '';
}
const STELLAR = logoOf('Stellar');
const XRPL = logoOf('XRP Ledger');
if (!STELLAR || !XRPL) { console.error('hero net: ABORT — a mark is missing from _netlogos.json'); process.exit(1); }

const CHEV = '<svg class="lx-nsel-chev" viewBox="0 0 24 24" width="14" height="14" fill="none" '
  + 'stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" '
  + 'aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
const TICK = '<svg class="lx-nsel-tick" viewBox="0 0 24 24" width="15" height="15" fill="none" '
  + 'stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" '
  + 'aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';

const SEL = '<div class="lx-nsel" data-lxnonav="1">'
  + '<button type="button" class="lx-nsel-btn" aria-haspopup="listbox" aria-expanded="false" '
  + 'aria-label="Network: Stellar">'
  + '<span class="lx-nsel-mark">' + STELLAR + '</span>'
  + '<span class="lx-nsel-name">Stellar</span>' + CHEV
  + '</button>'
  + '<div class="lx-nsel-menu" role="listbox" aria-label="Choose a network" hidden>'
  + '<button type="button" class="lx-nsel-opt is-on" role="option" aria-selected="true" data-net="stellar">'
  + '<span class="lx-nsel-mark">' + STELLAR + '</span><span class="lx-nsel-t">Stellar</span>' + TICK + '</button>'
  + '<button type="button" class="lx-nsel-opt is-off" role="option" aria-selected="false" '
  + 'data-net="xrpl" aria-disabled="true" disabled>'
  + '<span class="lx-nsel-mark">' + XRPL + '</span><span class="lx-nsel-t">XRPL</span>'
  + '<em class="lx-nsel-soon">Soon</em></button>'
  + '</div></div>';

const CSS = '<style id="lx-heronet-css">'
  + '.lx-nsel{position:relative;flex:0 0 auto;display:flex;align-items:center}'
  + '.lx-nsel::after{content:"";position:absolute;right:-11px;top:50%;transform:translateY(-50%);'
  + 'width:1px;height:24px;background:var(--border)}'
  + '.lx-nsel-btn{appearance:none;cursor:pointer;font:inherit;display:inline-flex;align-items:center;'
  + 'gap:7px;padding:6px 8px 6px 4px;border:0;background:transparent;color:var(--text);'
  + 'border-radius:9px;transition:background .16s ease}'
  + '.lx-nsel-btn:hover{background:var(--bg-elev,rgba(127,127,127,.10))}'
  + '.lx-nsel-btn:focus-visible{outline:2px solid var(--accent);outline-offset:1px}'
  + '.lx-nsel-mark{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}'
  + '.lx-nsel-mark svg{width:22px;height:22px;display:block;border-radius:50%}'
  + '.lx-nsel-name{font-size:15px;font-weight:700;letter-spacing:-.01em}'
  + '.lx-nsel-chev{color:var(--text-soft);transition:transform .18s ease}'
  + '.lx-nsel[data-open="1"] .lx-nsel-chev{transform:rotate(180deg)}'
  // The menu hangs below the field, aligned to its left edge.
  + '.lx-nsel-menu{position:absolute;top:calc(100% + 14px);left:-8px;z-index:40;min-width:212px;'
  + 'padding:7px;border:1px solid var(--border);border-radius:15px;background:var(--surface);'
  + 'box-shadow:0 26px 54px -22px rgba(0,0,0,.55);display:flex;flex-direction:column;gap:3px}'
  + '.lx-nsel-menu[hidden]{display:none}'
  + '.lx-nsel-opt{appearance:none;font:inherit;display:flex;align-items:center;gap:11px;width:100%;'
  + 'padding:11px 12px;border:0;border-radius:11px;background:transparent;color:var(--text);'
  + 'text-align:left;cursor:pointer;transition:background .14s ease}'
  + '.lx-nsel-opt .lx-nsel-t{font-size:15px;font-weight:700;flex:1}'
  + '.lx-nsel-opt:hover:not([disabled]){background:var(--bg-elev,rgba(127,127,127,.12))}'
  + '.lx-nsel-opt.is-on{background:var(--bg-elev,rgba(127,127,127,.10))}'
  + '.lx-nsel-tick{color:var(--accent);flex:0 0 auto}'
  // Disabled is carried by the chip and the cursor as well as the dimming, so it does not rely on
  // opacity alone to say "not yet".
  + '.lx-nsel-opt[disabled]{cursor:not-allowed;opacity:.55}'
  + '.lx-nsel-soon{font-style:normal;font-size:11px;font-weight:700;letter-spacing:.06em;'
  + 'text-transform:uppercase;color:var(--text-soft);background:var(--bg-elev,rgba(127,127,127,.16));'
  + 'border-radius:999px;padding:3px 9px;flex:0 0 auto}'
  // Narrow phones: drop the word, keep the mark and the chevron, so the input keeps its room.
  + '@media (max-width:430px){.lx-nsel-name{display:none}.lx-nsel-btn{gap:4px;padding:6px 4px}'
  + '.lx-nsel-menu{min-width:196px}}'
  + '@media (prefers-reduced-motion:reduce){.lx-nsel-btn,.lx-nsel-chev,.lx-nsel-opt{transition:none}}'
  + '</st' + 'yle>';

const JS = '<script id="lx-heronet-js">(function(){'
  + 'if(window.__lxHeroNet)return;window.__lxHeroNet=1;'
  // Published for whatever builds the search routes. Stellar is the only selectable value today.
  + 'try{window.__lxSearchNet=localStorage.getItem("lumos.searchNet")||"stellar";}catch(e){window.__lxSearchNet="stellar";}'
  + 'function root(){return document.querySelector(".lx-nsel");}'
  + 'function close(){var r=root();if(!r)return;r.removeAttribute("data-open");'
  + 'var m=r.querySelector(".lx-nsel-menu"),b=r.querySelector(".lx-nsel-btn");'
  + 'if(m)m.hidden=true;if(b)b.setAttribute("aria-expanded","false");}'
  + 'function open(){var r=root();if(!r)return;r.setAttribute("data-open","1");'
  + 'var m=r.querySelector(".lx-nsel-menu"),b=r.querySelector(".lx-nsel-btn");'
  + 'if(m)m.hidden=false;if(b)b.setAttribute("aria-expanded","true");}'
  + 'document.addEventListener("click",function(e){'
  + 'var t=e.target;if(!t||!t.closest)return;'
  + 'var btn=t.closest(".lx-nsel-btn");'
  + 'if(btn){'
  // Both are needed: preventDefault keeps the form-less button inert, and stopPropagation keeps the
  // design's own .hero-search click handler from opening the search popup underneath the menu.
  + 'e.preventDefault();e.stopPropagation();'
  + 'var r=root();if(r&&r.getAttribute("data-open")==="1")close();else open();return;}'
  + 'var opt=t.closest(".lx-nsel-opt");'
  + 'if(opt){e.preventDefault();e.stopPropagation();'
  + 'if(opt.hasAttribute("disabled")||opt.getAttribute("aria-disabled")==="true")return;'
  + 'var net=opt.getAttribute("data-net")||"stellar";'
  + 'window.__lxSearchNet=net;try{localStorage.setItem("lumos.searchNet",net);}catch(_){}'
  + 'var r=root();if(r){'
  + 'r.querySelectorAll(".lx-nsel-opt").forEach(function(o){var on=o===opt;'
  + 'o.classList.toggle("is-on",on);o.setAttribute("aria-selected",on?"true":"false");});'
  + 'var nm=r.querySelector(".lx-nsel-name"),mk=r.querySelector(".lx-nsel-btn .lx-nsel-mark"),'
  + 'src=opt.querySelector(".lx-nsel-mark"),lbl=opt.querySelector(".lx-nsel-t");'
  + 'if(nm&&lbl)nm.textContent=lbl.textContent;'
  + 'if(mk&&src)mk.innerHTML=src.innerHTML;'
  + 'var b=r.querySelector(".lx-nsel-btn");if(b&&lbl)b.setAttribute("aria-label","Network: "+lbl.textContent);}'
  + 'close();return;}'
  + 'if(!t.closest(".lx-nsel"))close();'
  // CAPTURE, not bubble. The design binds its own click handler to .hero-search, which is an ancestor
  // of this button -- on the way up it fires before a document-level listener, so stopPropagation from
  // there is already too late and every press of the selector also opened the search popup behind the
  // menu. Capturing at the document means this runs first and the wrapper never sees the event.
  + '},true);'
  + 'document.addEventListener("keydown",function(e){if(e.key==="Escape")close();},false);'
  + '})();</scr' + 'ipt>';

const PAGES = [
  { file: 'lumoscore-aptos-desktop.html', key: 'lumoscore-landing.html' },
  { file: 'lumoscore-aptos-mobile.html', key: 'lumoscore-landing-mobile.html' }
];

const problems = [];
const staged = [];

for (const p of PAGES) {
  const data = read(p.file);
  const { json, s, e } = getContents(data);
  let html = json[p.key];
  if (html == null) { problems.push(p.key + ': missing'); continue; }

  // Re-injects rather than skipping, so the markup and the script can be tuned by re-running.
  html = html
    .replace(/<div class="lx-nsel" data-lxnonav="1">[\s\S]*?<\/div><\/div>/g, '')
    .replace(/<style id="lx-heronet-css">[\s\S]*?<\/style>/g, '')
    .replace(/<script id="lx-heronet-js">[\s\S]*?<\/script>/g, '');

  const open = '<div class="hero-search">';
  const at = html.indexOf(open);
  if (at < 0) { problems.push(p.key + ': hero search field not found'); continue; }
  if (html.indexOf(open, at + 1) >= 0) { problems.push(p.key + ': more than one hero search field'); continue; }
  html = html.slice(0, at + open.length) + SEL + html.slice(at + open.length);

  const bo = html.lastIndexOf('</body>');
  html = bo >= 0 ? html.slice(0, bo) + CSS + JS + html.slice(bo) : html + CSS + JS;

  json[p.key] = html;
  staged.push({ file: p.file, data, s, e, json, key: p.key });
}

if (problems.length) {
  console.error('hero net: ABORT — nothing written.');
  problems.forEach(x => console.error('  ' + x));
  process.exit(1);
}
for (const st of staged) {
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.key + ': network selector added to the hero search');
}
console.log('hero net: done on ' + staged.length + ' page(s)');
