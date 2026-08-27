// Inject the multichain switcher engine (_mc_engine.js) + its CSS into the aptos base source (the ONE
// version). Reads the engine file, bakes in the chain config (_chains.json), injects into every page key.
// Escaping is handled by the standard serialize/extract round-trip. Idempotent.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);
const CH=require(__dirname+'/_chains.json');

let engine=fs.readFileSync(__dirname+'/_mc_engine.js','utf8');
engine=engine.replace('/*CHAINS*/', JSON.stringify(CH));
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
const HEAD='<style id="lx-chainready-css">'
+'html:not(.lx-chainready) .lx-netcard img,html:not(.lx-chainready) .lx-netcard .val,html:not(.lx-chainready) .br-netbox .br-netchip{visibility:hidden!important}'
+'html:not(.lx-chainready) img[src^="'+APTOS_LOGO_PREFIX+'"]{visibility:hidden!important}'
+'</style>'
+'<script id="lx-chainready-js">(function(){try{setTimeout(function(){try{document.documentElement.classList.add("lx-chainready");}catch(_){}},3000);}catch(_){}})();<'+'/script>';

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
+'.lxw-neti{overflow:hidden;background:var(--surface-3,#eee)!important}'
+'.lxw-neti img{width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit}'
+'</style>';

let n=0;
for(const dev of ['desktop','mobile']){
  const file=`lumoscore-aptos-${dev}.html`;
  let data; try{ data=read(file); }catch(e){ continue; }
  const {json,s,e}=getContents(data);
  for(const k of Object.keys(json)){
    let h=json[k];
    if(h.indexOf('</body>')<0) continue;
    h=h.replace(/<style id="lx-mc-css">[\s\S]*?<\/style>/g,'').replace(/<script id="lx-mc">[\s\S]*?<\/script>/g,'');
    // strip the OLD whole-body gate (blanked heavy pages) + our own chainready gate (idempotent re-inject)
    h=h.replace(/<style id="lx-preskin-css">[\s\S]*?<\/style>/g,'').replace(/<script id="lx-preskin-js">[\s\S]*?<\/script>/g,'');
    h=h.replace(/<style id="lx-chainready-css">[\s\S]*?<\/style>/g,'').replace(/<script id="lx-chainready-js">[\s\S]*?<\/script>/g,'');
    if(h.indexOf('</head>')>=0) h=h.replace('</head>',HEAD+'</head>');   // TARGETED per-element gate in <head>
    const bi=h.lastIndexOf('</body>');
    json[k]=h.slice(0,bi)+STYLE+SCRIPT+h.slice(bi); n++;
  }
  const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
  fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
}
console.log('multichain engine injected on '+n+' aptos page keys');
