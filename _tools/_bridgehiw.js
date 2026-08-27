// "How it works?" on the Cross-Chain page — a real explanation behind the button.
//
// The button shipped on the page and did nothing. What it should open is the one thing the page cannot
// say in its own layout: WHAT actually happens to the money. That matters more here than anywhere else
// on the site, because the honest answer is unusual -- the USDC you hold is destroyed, and different
// USDC is created somewhere else. Anyone who has used a lock-and-wrap bridge expects the opposite.
//
// EVERY CLAIM BELOW IS TAKEN FROM WHAT THE PAGE ALREADY ASSERTS or from the CCTP integration itself:
//   - the burn/mint mechanism and "not wrapped"        -> the page's own FAQ, verbatim in substance
//   - the eight destination chains                     -> the page's own FAQ list
//   - two signatures, and the second one being manual  -> how the flow is actually built
// There is deliberately NO timing claim anywhere in it. Attestation is Circle's to do and its duration
// is not ours to promise; saying "a few minutes" is the kind of number that turns into a support
// ticket the one time it is wrong.
//
// The modal reuses the .lx-hiw shape from _dexdata.js so the two read as one component.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const CLOSE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
  + 'stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/>'
  + '<line x1="6" y1="6" x2="18" y2="18"/></svg>';

const STYLE = `<style id="lx-bhiw-css">
.lx-bhiw{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px}
.lx-bhiw[hidden]{display:none}
.lx-bhiw-bd{position:absolute;inset:0;background:rgba(8,8,12,.62);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
.lx-bhiw-card{position:relative;z-index:1;width:100%;max-width:560px;max-height:86vh;max-height:86dvh;
  overflow:auto;-webkit-overflow-scrolling:touch;background:var(--surface,#fff);
  border:1px solid var(--border);border-radius:18px;box-shadow:0 30px 70px -20px rgba(0,0,0,.55)}
.lx-bhiw-head{position:sticky;top:0;display:flex;align-items:center;gap:12px;padding:17px 20px;
  background:var(--surface,#fff);border-bottom:1px solid var(--border);z-index:1}
.lx-bhiw-head h3{flex:1;margin:0;font-size:16.5px;font-weight:800;color:var(--text)}
.lx-bhiw-x{width:30px;height:30px;flex:0 0 30px;border-radius:9px;border:1px solid var(--border);
  background:transparent;color:var(--text-soft);cursor:pointer;display:grid;place-items:center}
.lx-bhiw-x:hover{color:var(--text);border-color:var(--border-strong)}
.lx-bhiw-body{padding:18px 20px 22px}
.lx-bhiw-lede{margin:0 0 18px;font-size:14px;line-height:1.6;color:var(--text-soft)}
.lx-bhiw-lede b{color:var(--text);font-weight:700}
/* the steps: a numbered rail, because this IS a sequence and the order is the explanation */
.lx-bhiw-steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:0}
.lx-bhiw-steps li{position:relative;padding:0 0 20px 40px}
.lx-bhiw-steps li:last-child{padding-bottom:4px}
.lx-bhiw-steps li::before{content:attr(data-n);position:absolute;left:0;top:0;width:26px;height:26px;
  border-radius:50%;display:grid;place-items:center;font:800 12px/1 'JetBrains Mono',monospace;
  background:var(--accent-pale,rgba(234,106,44,.13));color:var(--accent,#ea6a2c)}
/* the connecting line, so the rail reads as one journey rather than four notes */
.lx-bhiw-steps li:not(:last-child)::after{content:"";position:absolute;left:13px;top:30px;bottom:6px;
  width:1px;background:var(--border)}
.lx-bhiw-steps h4{margin:3px 0 4px;font-size:14px;font-weight:800;color:var(--text)}
.lx-bhiw-steps p{margin:0;font-size:13.5px;line-height:1.55;color:var(--text-soft)}
.lx-bhiw-note{margin-top:18px;padding:12px 14px;border-radius:12px;
  border:1px solid var(--border);background:var(--surface-2);
  font-size:13px;line-height:1.55;color:var(--text-soft)}
.lx-bhiw-note b{color:var(--text)}
.lx-bhiw-chains{margin-top:14px;font-size:12.5px;line-height:1.7;color:var(--text-soft)}
.lx-bhiw-chains b{color:var(--text);font-weight:700}
@media(max-width:560px){
.lx-bhiw{padding:12px;align-items:flex-start}
.lx-bhiw-body{padding:16px 16px 20px}
}
</style>`;

// The copy. Kept in one place so it can be read as prose and checked as prose.
const STEPS = [
  ['You choose where it goes',
   'Your connected network is the source. Pick the destination chain and the amount of USDC to move.'],
  ['You sign once, on the source chain',
   'That signature burns your USDC. It is genuinely destroyed rather than parked in a contract, which '
   + 'is what lets the same amount be issued as real USDC on the other side.'],
  ['Circle attests to the burn',
   'Circle observes the burn and issues a signed attestation for it. This is Circle’s step, not '
   + 'LumosCore’s — nobody here can speed it up, and it has to finish before anything can be minted.'],
  ['You claim it on the destination',
   'With the attestation in hand, a second signature mints native USDC to your address on the '
   + 'destination chain. Until you take that step the funds are attested but not yet issued — they '
   + 'are not lost, and the claim can be made later.'],
];

const SCRIPT = `<script id="lx-bhiw">(function(){
  if(window.__lxBhiw)return; window.__lxBhiw=1;
  var STEPS=${JSON.stringify(STEPS)};
  var el=null, trigger=null;
  function build(){
    if(el)return el;
    el=document.createElement("div");
    el.className="lx-bhiw"; el.setAttribute("hidden","");
    el.setAttribute("role","dialog"); el.setAttribute("aria-modal","true");
    el.setAttribute("aria-label","How the cross-chain bridge works");
    var steps="";
    for(var i=0;i<STEPS.length;i++){
      steps+='<li data-n="'+(i+1)+'"><h4>'+STEPS[i][0]+'</h4><p>'+STEPS[i][1]+'</p></li>';
    }
    el.innerHTML='<div class="lx-bhiw-bd" data-lxbhiw-close></div>'
      +'<div class="lx-bhiw-card">'
      +'<div class="lx-bhiw-head"><h3>How the bridge works</h3>'
      +'<button class="lx-bhiw-x" type="button" aria-label="Close" data-lxbhiw-close>${CLOSE}</button></div>'
      +'<div class="lx-bhiw-body">'
      +'<p class="lx-bhiw-lede">This is not a wrapped-token bridge. It uses <b>Circle CCTP</b>, Circle\\u2019s '
      +'own mechanism for moving USDC between chains: your USDC is <b>burned</b> on the chain it leaves and '
      +'<b>native USDC is minted</b> on the chain it arrives on. What lands is genuine Circle-issued USDC, '
      +'not a synthetic claim on a pool somewhere.</p>'
      +'<ol class="lx-bhiw-steps">'+steps+'</ol>'
      +'<div class="lx-bhiw-note"><b>Two signatures, not one.</b> One to burn and one to claim. That is '
      +'inherent to CCTP rather than a choice made here \\u2014 the second cannot be prepared until Circle '
      +'has attested to the first.</div>'
      +'<div class="lx-bhiw-chains"><b>Where it goes:</b> USDC can move between Stellar and Ethereum, Base, '
      +'Arbitrum, Optimism, Polygon, Avalanche, Linea and World Chain.</div>'
      +'</div></div>';
    document.body.appendChild(el);
    return el;
  }
  function open(){
    build(); el.removeAttribute("hidden");
    try{ el.querySelector(".lx-bhiw-card").scrollTop=0; }catch(_){}
    try{ el.__lxOvf=document.body.style.overflow; document.body.style.overflow="hidden"; }catch(_){}
    try{ el.querySelector(".lx-bhiw-x").focus(); }catch(_){}
  }
  function close(){
    if(!el)return;
    el.setAttribute("hidden","");
    try{ document.body.style.overflow=el.__lxOvf||""; }catch(_){}
    try{ if(trigger&&trigger.focus)trigger.focus(); }catch(_){}
  }
  // Delegated, and capturing: the button lives inside a step card the page re-renders, so a listener
  // bound to the node itself would be orphaned the first time that happened.
  window.addEventListener("click",function(e){
    var t=e.target; if(!t||!t.closest)return;
    if(t.closest("[data-lxbhiw-close]")){ e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
    var hit=t.closest("#mdxHiwBtn,#brHiwBtn");
    if(!hit){
      // the desktop build labels the same control differently; match on what it SAYS as a fallback
      var b=t.closest("button,a");
      if(b&&/how it works/i.test((b.textContent||""))&&b.closest(".br-step,.mdx-hero-ctas,.crumb-bar,header,main"))hit=b;
    }
    if(hit){ e.preventDefault(); e.stopImmediatePropagation(); trigger=hit; open(); }
  },true);
  document.addEventListener("keydown",function(e){ if(e.key==="Escape"||e.keyCode===27)close(); });
})();</script>`;

let containers = 0, pages = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = `lumoscore-aptos-${dev}.html`;
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;

  for (const k of Object.keys(json)) {
    let p = json[k];
    const before = p;
    p = p.replace(/<style id="lx-bhiw-css">[\s\S]*?<\/style>/g, '')
         .replace(/<script id="lx-bhiw">[\s\S]*?<\/script>/g, '');
    // the bridge page only — identified by its own step rail, not by a filename
    // #1: br-steps ONLY. mdxHiwBtn is not a bridge marker -- the mobile TRADE page carries the same id
    // for its own How-it-works button, so this injected the CCTP explainer there and it won over the
    // Trade page own .lx-hiw dialog. Someone opening How it works on Trade was told how the bridge
    // burns and mints USDC. The step rail is the thing only the bridge has.
    if (p.indexOf('br-steps') >= 0) {
      if (p.indexOf('</head>') >= 0) p = p.replace('</head>', STYLE + '</head>');
      const bi = p.lastIndexOf('</body>');
      if (bi >= 0) { p = p.slice(0, bi) + SCRIPT + p.slice(bi); pages++; }
    }
    if (p !== before) { json[k] = p; changed = true; }
  }

  if (changed) {
    containers++;
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
console.log('bridge "how it works" on ' + pages + ' page keys across ' + containers + ' containers');
