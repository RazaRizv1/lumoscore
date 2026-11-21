// Inject the multichain switcher engine (_mc_engine.js) + its CSS into the aptos base source (the ONE
// version). Reads the engine file, bakes in the chain config (_chains.json), injects into every page key.
// Escaping is handled by the standard serialize/extract round-trip. Idempotent.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);
const CH=require(__dirname+'/_chains.json');

let engine=fs.readFileSync(__dirname+'/_mc_engine.js','utf8');
engine=engine.replace('/*CHAINS*/', JSON.stringify(CH));
// WHICH CHAINS THIS DEPLOY CAN ACTUALLY OPEN. Same flag the hub choosers read in _lumosparent.js, so
// one switch governs every place a chain is offered rather than each learning it separately -- which
// is how the Launch App modal kept offering XRPL after the hubs stopped.
//
// Off by default: a build that does not carry the XRPL pages must not link to them. Set
// LX_XRPL_PUBLIC=1 on a build that merges them (npm run merge:xrpl) and the row becomes clickable.
// The inert row is not a hidden one -- it reads "Support is on the way" with a "Next up" tag, which
// is both true and the state this flag describes.
const XRPL_PUBLIC = process.env.LX_XRPL_PUBLIC === '1';
engine=engine.replace('/*SOON*/', JSON.stringify(XRPL_PUBLIC ? {} : { xrpl: 1 }));
const SCRIPT='<script id="lx-mc">'+engine+'</script>';

// TARGETED anti-flash (NOT a full-body hide — that blanked heavy pages). The dist is the APTOS base and
// mc-engine rebrands to the connected chain at boot, so the network LOGO/NAME briefly show Aptos then
// swap. This HEAD CSS hides ONLY those small elements (netcard logo/name + bridge source-network chip)
// until mc-engine adds html.lx-chainready after its first rebrand. The 3s failsafe reveals them even if
// mc-engine never runs. The rest of the page renders immediately — no blank page.
// The named selectors below were found one at a time, as each flash got reported. That approach cannot
// win: the base is Aptos, so EVERY static chain mark in the markup flashes, and there are more of them
// than anyone will enumerate (the topbar wallet avatar .lx-tw-av, the search filter pill .ch-ico, the
// asset-dropdown .ad-ico, …). So gate on the thing they all have in common instead — the Aptos logo
// itself, matched by an attribute-prefix selector. walkSwap rewrites that src to the active chain's
// logo, at which point the selector stops matching and the image reveals itself. One rule, every page,
// nothing left to miss. The prefix is long enough to be unique to this asset.
const APTOS_LOGO_PREFIX = CH.aptos.logo.slice(0, 96);
// THE LOGO RULE IS NOT GATED ON lx-chainready, AND THAT IS THE WHOLE FIX (RAZA 2026-10-16: "There's a
// flash bug on Pools, trade, main page ... its showing APTOS logo for split seconds ... These flashes
// only appear when im connected to XRPL but visit any stellar page").
//
// The paragraph above already has the right idea — walkSwap rewrites the src, "at which point the
// selector stops matching and the image reveals itself". The rule is SELF-CLEARING: it needs no class
// to let a corrected image through, because a corrected image no longer matches it.
//
// So `html:not(.lx-chainready)` on this line bought nothing and cost the bug. boot() adds that class
// immediately after adoptChain(), and there is a 3s failsafe that adds it regardless — after which
// this rule is switched off for the rest of the page's life. Anything that paints an Aptos mark
// AFTER that moment is unprotected, and reskin() only runs at 300/1200/3000ms, so the wrong logo is
// on screen in between. A gate keyed on "the chain is decided" cannot protect a node repainted after
// that; _bridgelogo.js reached the same conclusion and fixed its own page by rewriting the markup.
//
// WHY IT ONLY SHOWS WHEN CONNECTED: the topbar wallet chip (.lx-tw-av) only exists in the connected
// state, and it is rendered by the wallet layer, which runs after boot. So it arrives carrying a
// fresh Aptos src into a page whose gate has already opened — the one element the original rule
// could never have covered, no matter how the selector was written.
//
// UNCONDITIONAL IS ALSO CORRECT, not merely convenient. ORDER is ["stellar","xrpl"], so `use` can
// never resolve to aptos and this mark is never the right answer at any moment on any page. If
// walkSwap never runs, hiding it forever is the outcome we want: an empty disc, not another chain's
// logo. visibility (not display) keeps the box, so nothing reflows when it reveals.
//
// The class-based rules above KEEP their gate — those hide by element, not by src, so they have no
// way to clear themselves and genuinely need lx-chainready to reveal.
const HEAD_CSS='<style id="lx-chainready-css">'
+'html:not(.lx-chainready) .lx-netcard img,html:not(.lx-chainready) .lx-netcard .val,html:not(.lx-chainready) .br-netbox .br-netchip{visibility:hidden!important}'
+'img[src^="'+APTOS_LOGO_PREFIX+'"]{visibility:hidden!important}'
+'</style>';
// The same two blocks addressable one at a time, so each can be swapped where it already sits rather
// than re-inserted at </head>. HEAD stays the concatenation, for the first-time append path.
const HEAD_JS='<script id="lx-chainready-js">(function(){try{setTimeout(function(){try{document.documentElement.classList.add("lx-chainready");}catch(_){}},3000);}catch(_){}})();<'+'/script>';
const HEAD=HEAD_CSS+HEAD_JS;

const STYLE='<style id="lx-mc-css">'
+'.lxmc{position:relative;flex-shrink:0}'
+'.lxmc-trig{display:inline-flex;align-items:center;gap:8px;height:42px;padding:0 12px;border-radius:12px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);cursor:pointer;font:600 14px/1 "Hanken Grotesk",system-ui,sans-serif;transition:.15s}'
+'.lxmc-trig:hover{border-color:var(--border-strong)}'
+'.lxmc-logo,.lxmc-ol{width:24px;height:24px;border-radius:50%;overflow:hidden;display:inline-flex;flex-shrink:0;background:var(--surface-3,#eee)}'
+'.lxmc-logo img,.lxmc-ol img{width:100%;height:100%;object-fit:cover;display:block}'
+'.lxmc-name{white-space:nowrap}'
+'.lxmc-trig svg{width:14px;height:14px;color:var(--text-soft)}'
+'.lxmc-menu{position:absolute;top:calc(100% + 8px);right:0;z-index:200;min-width:216px;background:var(--surface);border:1px solid var(--border-strong);border-radius:14px;padding:6px;box-shadow:0 18px 50px rgba(0,0,0,.28)}'
+'.lxmc-menu[hidden]{display:none}'
+'.lxmc-opt{width:100%;display:flex;align-items:center;gap:11px;padding:9px 11px;border:none;background:transparent;color:var(--text);border-radius:10px;cursor:pointer;font:600 14.5px/1 "Hanken Grotesk",system-ui,sans-serif;text-align:left}'
+'.lxmc-opt:hover{background:var(--surface-2)}'
+'.lxmc-opt.active{background:var(--accent-soft);color:var(--accent)}'
+'@media(max-width:1080px){.lxmc-name{display:none}.lxmc-trig{padding:0 9px}}'
// network-choice screen (lives INSIDE the .lxw connect modal, reuses its .lxw-row design)
// The fallback has to be a DARK one. --surface-3 is defined on the landing page (#1d1d25) and
// nowhere else, so every app page fell through to #eee and the chain logos sat on a light grey
// tile with the inset ring around them -- the "not clean" halo RAZA reported on 2026-10-30, on an
// otherwise identical modal. Measured: landing icon background rgb(29,29,37), /trade/stellar
// rgb(238,238,238), same markup and same rule.
//
// --surface-2 is the app pages' own near-black (#1a1a1f), so the tile keeps the depth the inset
// ring was drawn for instead of disappearing. Landing is UNCHANGED: --surface-3 still wins there.
// A literal dark hex as the last resort, because a page defining neither must not get #eee again.
+'.lxw-neti{overflow:hidden;background:var(--surface-3,var(--surface-2,#1d1d25))!important}'
+'.lxw-neti img{width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit}'
// Network logos in a ROUND frame with no inset ring (RAZA 2026-11-17: "fix the white border around stellar and
// hedera logos"). Stellar/Hedera are black circles; the rounded-square tile + its white inset ring drew
// a halo around them. Drawn 12% larger so a logo file's own light rim (hedera.png on the hubs) is clipped.
+'.lxw-neti{border-radius:50%!important;box-shadow:none!important}.lxw-neti img{transform:scale(1.12)}'
+'</style>';

// IN PLACE, NOT STRIP-AND-RE-APPEND.
//
// This used to strip `lx-mc-css` + `lx-mc` by regex and re-append both before </body>. On a tree that
// already carries them that is a MOVE: the pair lands LAST however early it used to sit, dragging
// every layer that followed it one position earlier. Harmless in a full rebuild, where every
// transform runs in order; a silent, 95-page cascade when this one is run on its own to carry a
// single edit to _mc_engine.js -- which is exactly what it is useful for.
// ([[running-one-stellar-transform-reorders-layers]], [[a-transform-that-patches-in-place-cannot-reorder]])
//
// Swapping each block where it already sits makes the transform order-neutral. A page that never
// carried the layer still appends, and still lands last; that is correct, and a layer-order gate
// should read it as a set difference rather than as a move -- which is why `swapped` and `appended`
// are reported separately below. An `appended` above zero on an already-built tree is the one outward
// sign a layer is about to change position.
const swapAt=(src,open,block)=>{
  const at=src.indexOf(open);
  if(at<0) return null;
  const close=open.slice(0,1)+'/'+open.slice(1,open.indexOf(' '))+'>';
  const end=src.indexOf(close,at);
  if(end<at) return null;
  return src.slice(0,at)+block+src.slice(end+close.length);
};

let n=0,swapped=0,appended=0;
for(const dev of ['desktop','mobile']){
  const file=`lumoscore-aptos-${dev}.html`;
  let data; try{ data=read(file); }catch(e){ continue; }
  const {json,s,e}=getContents(data);
  for(const k of Object.keys(json)){
    let h=json[k];
    if(h.indexOf('</body>')<0) continue;
    // The OLD whole-body gate is REMOVED, not re-inserted — a genuine deletion, so it moves nothing.
    h=h.replace(/<style id="lx-preskin-css">[\s\S]*?<\/style>/g,'').replace(/<script id="lx-preskin-js">[\s\S]*?<\/script>/g,'');

    // `</head>` IS NOT A FIXED CASCADE POSITION EITHER. This pair was stripped and re-inserted at
    // </head> under the comment "a FIXED anchor ... cannot change their position". It can and did:
    // re-inserting at </head> lands them LAST in the head, so on a tree that already carried them
    // they jumped from just after lx-wrongchain to after lx-faq-head — 128 of 128 page keys, caught
    // by the ordered-id fingerprint and not by anything else. Same trap as </body>, same fix: swap
    // where they already sit ([[body-end-is-not-a-fixed-cascade-position]]).
    const hs1=swapAt(h,'<style id="lx-chainready-css">',HEAD_CSS);
    const hs2=swapAt(hs1===null?h:hs1,'<script id="lx-chainready-js">',HEAD_JS);
    if(hs1!==null&&hs2!==null) h=hs2;
    else{
      h=h.replace(/<style id="lx-chainready-css">[\s\S]*?<\/style>/g,'').replace(/<script id="lx-chainready-js">[\s\S]*?<\/script>/g,'');
      if(h.indexOf('</head>')>=0) h=h.replace('</head>',HEAD+'</head>');   // first time: lands last in <head>
    }

    const sw1=swapAt(h,'<style id="lx-mc-css">',STYLE);
    const sw2=swapAt(sw1===null?h:sw1,'<script id="lx-mc">',SCRIPT);
    if(sw1!==null&&sw2!==null){ h=sw2; swapped++; }
    else{
      // Never carried the pair (or carried only half of one): clear whatever is there and append,
      // which correctly lands last on a page seeing this for the first time.
      h=h.replace(/<style id="lx-mc-css">[\s\S]*?<\/style>/g,'').replace(/<script id="lx-mc">[\s\S]*?<\/script>/g,'');
      const bi=h.lastIndexOf('</body>');
      h=h.slice(0,bi)+STYLE+SCRIPT+h.slice(bi); appended++;
    }
    json[k]=h; n++;
  }
  const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
  fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
}
console.log('multichain engine injected on '+n+' aptos page keys — '
  +swapped+' swapped in place, '+appended+' appended');
