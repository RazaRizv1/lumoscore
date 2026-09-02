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

// Nothing is chosen up front: the point of the control is that the reader says which network their
// pasted id belongs to, and preselecting Stellar answers that for them. The resting state is a neutral
// globe and the word "Network", which reads as a prompt; once a network is picked the word goes and the
// mark stands alone, the way it already did on phones.
const GLOBE = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" '
  + 'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/>'
  + '<path d="M12 3c2.6 2.7 4 5.7 4 9s-1.4 6.3-4 9c-2.6-2.7-4-5.7-4-9s1.4-6.3 4-9z"/></svg>';

const SEL = '<div class="lx-nsel" data-lxnonav="1">'
  + '<button type="button" class="lx-nsel-btn" aria-haspopup="listbox" aria-expanded="false" '
  + 'aria-label="Choose a network">'
  + '<span class="lx-nsel-mark lx-nsel-ph">' + GLOBE + '</span>'
  + '<span class="lx-nsel-name">Network</span>' + CHEV
  + '</button>'
  + '<div class="lx-nsel-menu" role="listbox" aria-label="Choose a network" hidden>'
  + '<button type="button" class="lx-nsel-opt" role="option" aria-selected="false" data-net="stellar">'
  + '<span class="lx-nsel-mark">' + STELLAR + '</span><span class="lx-nsel-t">Stellar</span>' + TICK + '</button>'
  + '<button type="button" class="lx-nsel-opt is-off" role="option" aria-selected="false" '
  + 'data-net="xrpl" aria-disabled="true" disabled>'
  + '<span class="lx-nsel-mark">' + XRPL + '</span><span class="lx-nsel-t">XRPL</span>'
  + '<em class="lx-nsel-soon">Soon</em></button>'
  + '</div></div>';

const CSS = '<style id="lx-heronet-css">'
  // ---- the field itself: taller, wider, softer, with room either side of the divider. The magnifier
  // used to sit ~2px from the rule, which read as one crowded cluster rather than a scope control and
  // a search box.
  + '.hero-search-wrap{max-width:680px}'
  + '.hero-search{height:68px;border-radius:19px;padding:0 24px;gap:14px;'
  + 'box-shadow:0 20px 54px -20px rgba(0,0,0,.30)}'
  + '.hero-search svg.s-ico{width:21px;height:21px}'
  + '.hero-search input{font-size:19.5px}'
  + '.hero-search:focus-within{box-shadow:0 0 0 4px var(--accent-pale),0 20px 54px -18px rgba(234,106,44,.34)}'
  + '@media (max-width:900px){.hero-search{height:60px;border-radius:17px;padding:0 16px;gap:11px}'
  + '.hero-search input{font-size:17px}.hero-search svg.s-ico{width:19px;height:19px}}'
  + '.lx-nsel{position:relative;flex:0 0 auto;display:flex;align-items:center;margin-right:18px}'
  + '.lx-nsel::after{content:"";position:absolute;right:-16px;top:50%;transform:translateY(-50%);'
  + 'width:1px;height:26px;background:var(--border)}'
  // Selected state: the mark alone, on every width.
  + '.lx-nsel[data-sel="1"] .lx-nsel-name{display:none}'
  + '.lx-nsel-ph{color:var(--text-soft)}'
  + '@media (max-width:900px){.lx-nsel{margin-right:14px}.lx-nsel::after{right:-12px;height:22px}}'
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
  // Empty until the reader chooses. A previously made choice is restored, because that WAS their
  // choice; what is not done is answering the question for them on a first visit.
  + 'try{window.__lxSearchNet=localStorage.getItem("lumos.searchNet")||"";}catch(e){window.__lxSearchNet="";}'
  + 'function apply(net,silent){var r=root();if(!r||!net)return;'
  + 'var opt=r.querySelector(\'.lx-nsel-opt[data-net="\'+net+\'"]\');if(!opt)return;'
  + 'r.querySelectorAll(".lx-nsel-opt").forEach(function(o){var on=o===opt;'
  + 'o.classList.toggle("is-on",on);o.setAttribute("aria-selected",on?"true":"false");});'
  + 'var mk=r.querySelector(".lx-nsel-btn .lx-nsel-mark"),src=opt.querySelector(".lx-nsel-mark"),'
  + 'lbl=opt.querySelector(".lx-nsel-t"),b=r.querySelector(".lx-nsel-btn");'
  + 'if(mk&&src){mk.innerHTML=src.innerHTML;mk.classList.remove("lx-nsel-ph");}'
  + 'r.setAttribute("data-sel","1");'
  + 'if(b&&lbl)b.setAttribute("aria-label","Network: "+lbl.textContent);'
  + 'window.__lxSearchNet=net;'
  + 'if(!silent){try{localStorage.setItem("lumos.searchNet",net);}catch(_){}}'
  + 'try{hint();}catch(_){}'
  + '}'
  // Restore on load, once the markup exists.
  + 'function boot(){if(window.__lxSearchNet)apply(window.__lxSearchNet,true);try{hint();}catch(_){}}'
  + 'if(document.readyState!=="loading")setTimeout(boot,0);'
  + 'else document.addEventListener("DOMContentLoaded",boot);'
  + 'function root(){return document.querySelector(".lx-nsel");}'
  + 'function close(){var r=root();if(!r)return;r.removeAttribute("data-open");'
  + 'var m=r.querySelector(".lx-nsel-menu"),b=r.querySelector(".lx-nsel-btn");'
  + 'if(m)m.hidden=true;if(b)b.setAttribute("aria-expanded","false");}'
  + 'function open(){var r=root();if(!r)return;r.setAttribute("data-open","1");'
  + 'var m=r.querySelector(".lx-nsel-menu"),b=r.querySelector(".lx-nsel-btn");'
  + 'if(m)m.hidden=false;if(b)b.setAttribute("aria-expanded","true");}'
  // Driven by pointerup, NOT click. The page ships a script (id="lx-nonav") that arms on mousedown
  // inside .hero-search / .hero-search-wrap / .search-box and then swallows the following click with
  // stopImmediatePropagation -- so no click event reaches anything inside the field, including this
  // control. Measured: mousedown, focus, pointerup and mouseup all arrive on the button and the click
  // never does. A synthetic btn.click() worked precisely because it never armed the swallower, which is
  // why this passed testing and failed for a real finger.
  //
  // click stays registered as a fallback for anything without pointer events; the timestamp guard stops
  // the pair double-firing on the same gesture.
  // De-duped per GESTURE, not on a timer. A time window was wrong twice over: it blocked a second,
  // genuinely separate tap that happened to land inside it -- tapping the disabled XRPL row and then
  // Stellar did nothing at all, because the first tap started the window -- and it would have kept
  // doing so for any quick pair. A flag cleared on pointerdown covers exactly the pointerup/click pair
  // of one press and nothing else.
  + 'var handled=false;'
  + 'document.addEventListener("pointerdown",function(){handled=false;},true);'
  + 'function act(e){if(e.type==="click"&&handled)return;if(e.type==="pointerup")handled=true;'
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
  + 'var net=opt.getAttribute("data-net");if(net)apply(net,false);'
  + 'close();return;}'
  // Close on a press outside -- except the gated press on the search field, which has just opened this
  // menu on purpose from the mousedown handler below. Without that exemption the two fight: mousedown
  // opens it and the pointerup that follows closes it again, so the field looked simply dead.
  + 'if(t.closest(".lx-nsel"))return;'
  + 'if(gated(t))return;'
  + 'close();'
  // CAPTURE, not bubble. The design binds its own click handler to .hero-search, which is an ancestor
  // of this button -- on the way up it fires before a document-level listener, so stopPropagation from
  // there is already too late and every press of the selector also opened the search popup behind the
  // menu. Capturing at the document means this runs first and the wrapper never sees the event.
  + '}'
  + 'document.addEventListener("pointerup",act,true);'
  + 'document.addEventListener("click",act,true);'
  + 'document.addEventListener("keydown",function(e){if(e.key==="Escape")close();},false);'
  // ---- a network has to be chosen before the field will search.
  // The search popup opens on FOCUS, not click (the swallower above eats the click), so the gate is on
  // mousedown -- preventing the default stops focus ever happening -- with a focus guard behind it for
  // keyboard tabbing. Choosing a network is offered in the same gesture rather than just refusing.
  + 'function gated(t){try{return t&&t.closest&&!t.closest(".lx-nsel")&&'
  + 't.closest(".hero-search,.hero-search-wrap")&&!window.__lxSearchNet;}catch(_){return false;}}'
  + 'document.addEventListener("mousedown",function(e){if(!gated(e.target))return;'
  + 'e.preventDefault();open();},true);'
  + 'document.addEventListener("focus",function(e){if(!gated(e.target))return;'
  + 'try{e.target.blur();}catch(_){}open();},true);'
  // The field says why it is inert instead of just ignoring the tap.
  + 'function hint(){var i=document.querySelector(".hero-search input");if(!i)return;'
  + 'if(!i.getAttribute("data-lxph"))i.setAttribute("data-lxph",i.getAttribute("placeholder")||"");'
  + 'i.setAttribute("placeholder",window.__lxSearchNet?i.getAttribute("data-lxph"):'
  + '"Select a network to search");}'
  + 'window.__lxNetHint=hint;'
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
