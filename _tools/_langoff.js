// English-only + footer incorporation line.
//
// TWO separate things live in the footer:
//   1. the incorporation line, in two shapes -- desktop ".incorp > span", mobile ".incorp-line" (text node,
//      no span). Both become the plain "LumosCore OÜ · Estonia · 17336483"; the dead <a href="#"> goes with
//      the old wording.
//   2. the language picker (.ft-lang / .ft-lang-wrap) plus the small IIFE that opens it and writes a
//      language preference.
//
// The site is English-only for now, so the picker and its wiring are removed. The 138KB locale ENGINE
// (<script data-lumos-locale="1">) is deliberately LEFT IN PLACE: it defaults to English on its own
// (STATE={lang:"en"}), and cutting a script that size out of every page key is a much bigger risk than it
// is worth for a UI change. What matters is that nobody can be left stuck in another language --
// so a tiny script ahead of the engine pins BOTH keys to English:
//     lumos.locale.lang  (what the engine reads)
//     lumos.lang         (what the old footer picker wrote)
// It is set, not removed: the engine patches localStorage.setItem and listens for cross-tab storage
// events, so an explicit "en" keeps every tab and every later write on English.
//
// Idempotent: re-running finds nothing to do.
const {read,writeContents}=require(__dirname+'/lib.js');

const INCORP_NEW = 'LumosCore OÜ · Estonia · 17336483';

const PIN = '<script id="lx-langen">try{localStorage.setItem("lumos.locale.lang","en");localStorage.setItem("lumos.lang","en");}catch(e){}try{if(window.top)window.top.__lumosLang="en";}catch(e){}<\/script>';

// Cut one <div class="X"> ... </div> by walking div depth, so nested markup can't end the slice early.
function cutDiv(html, cls){
  const open = '<div class="'+cls+'"';
  let out = html, n = 0;
  for(;;){
    const i = out.indexOf(open); if(i<0) break;
    let depth = 0, j = i;
    for(;;){
      const nd = out.indexOf('<div', j+1), cd = out.indexOf('</div>', j+1);
      if(cd < 0) return {out, n};                       // malformed: leave the page alone
      if(nd >= 0 && nd < cd){ depth++; j = nd; continue; }
      if(depth === 0){ out = out.slice(0,i) + out.slice(cd+6); n++; break; }
      depth--; j = cd;
    }
  }
  return {out, n};
}

let f=0, langN=0, incorpN=0, pinN=0, scriptN=0, cssN=0;
for(const chain of ['aptos','hedera','starknet','vechain','worldchain','stellar','xrpl']){
  for(const dev of ['desktop','mobile']){
    const file = `lumoscore-${chain}-${dev}.html`;
    try{ read(file); }catch(e){ continue; }
    let touched = false;
    writeContents(file, json=>{
      for(const k of Object.keys(json)){
        let h = json[k], before = h;

        // 1. incorporation line -- desktop shape
        h = h.replace(/<span>Incorporated in Estonia[\s\S]{0,120}?<\/span>/g, ()=>{ incorpN++; return '<span>'+INCORP_NEW+'</span>'; });
        // 1b. mobile shape: bare text + link between the icon and the closing div
        h = h.replace(/Incorporated in Estonia · <a href="#">LumosCore OÜ — REG: 17336483<\/a>/g, ()=>{ incorpN++; return INCORP_NEW; });

        // 2. the picker: wrapper first (mobile nests .ft-lang inside .ft-lang-wrap)
        let r = cutDiv(h,'ft-lang-wrap'); h = r.out; langN += r.n;
        r = cutDiv(h,'ft-lang');          h = r.out; langN += r.n;

        // 2b. its wiring IIFE (identified by the button id, not by position)
        h = h.replace(/<script>\(function\(\)\{var b=document\.getElementById\("ftLangBtn"[\s\S]*?<\/script>/g, ()=>{ scriptN++; return ''; });

        // 2c. the picker's stylesheet, now styling nothing
        // (lx-mlang is the phone's copy of the same rules). Rules for these classes that live INSIDE the
        // shared footer stylesheet are left alone — they now match nothing, and cutting individual rules out
        // of a block that also lays out the footer is a worse trade than a few dead selectors.
        h = h.replace(/<style id="lx-langcss">[\s\S]*?<\/style>/g, ()=>{ cssN++; return ''; });
        h = h.replace(/<style id="lx-mlang">[\s\S]*?<\/style>/g, ()=>{ cssN++; return ''; });

        // 3. pin English ahead of the locale engine
        if(h.indexOf('lx-langen') < 0 && h.indexOf('data-lumos-locale') >= 0){
          h = h.replace('<script data-lumos-locale="1">', PIN+'<script data-lumos-locale="1">');
          pinN++;
        }

        if(h !== before){ json[k] = h; touched = true; }
      }
    });
    if(touched) f++;
  }
}
console.log(`english-only: ${f} containers — incorp lines ${incorpN}, pickers ${langN}, wiring scripts ${scriptN}, css blocks ${cssN}, en-pins ${pinN}`);
