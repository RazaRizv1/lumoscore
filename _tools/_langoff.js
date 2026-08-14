// English-only + footer incorporation line.
//
// TWO separate things live in the footer:
//   1. the incorporation line, in two shapes -- desktop ".incorp > span", mobile ".incorp-line" (text node,
//      no span). Both become the plain "LumosCore OÜ · Estonia · 17336483"; the dead <a href="#"> goes with
//      the old wording.
//   2. the language picker (.ft-lang / .ft-lang-wrap) plus the small IIFE that opens it and writes a
//      language preference.
//
// The site is English-only, so the whole locale layer goes:
//   * the 138KB dictionary + engine (<script data-lumos-locale="1">) — the single largest thing on every
//     page, translating into languages nobody can select any more;
//   * the rerun observer, which called __lumosApplyLocale on EVERY dom mutation (debounced 120ms) — on
//     the data-heavy pages that is constant work for no output;
//   * the locale prefs script and its UI (.locale-chip / .locale-panel / .locale-sheet), the language and
//     currency picker.
// Checked before cutting: every reference to lumos.locale.lang, lumos.locale.ccy and __lumosApplyLocale
// lives inside those scripts. Nothing else on the site reads them, so this cannot strand another module.
//
// The English pin stays. It is 159 bytes, it costs nothing, and a browser that already has another
// language in localStorage from an earlier visit keeps a definitive "en" written over it.
//
// Idempotent: re-running finds nothing to do.
let engineN=0, obsN=0, prefsN=0, uiN=0;
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

        // 2d. the dictionary + engine (the 138KB one)
        h = h.replace(/<script data-lumos-locale="1">[\s\S]*?<\/script>/g, ()=>{ engineN++; return ''; });

        // 2e. the observer that re-ran the locale pass on every dom mutation
        h = h.replace(/<script>\(function\(\)\{function rerun\(\)\{[\s\S]*?__lumosApplyLocale[\s\S]*?<\/script>/g, ()=>{ obsN++; return ''; });

        // 2f. the language/currency prefs script (identified by the key it declares, not by position)
        h = h.replace(/<script>\s*\n?\(function\(\) \{[\s\S]*?K_LANG = 'lumos\.locale\.lang'[\s\S]*?<\/script>/g, ()=>{ prefsN++; return ''; });

        // 2g. the picker UI it drove. The trigger is a <button id="localeChip"> — an id on a button, not
        // the class a div-walker would find — so it survived the first pass as a dead globe in the header
        // that opened nothing. Cut by id, then the sheet/backdrop wrappers by class.
        h = h.replace(/<button[^>]*id="localeChip"[\s\S]*?<\/button>/g, ()=>{ uiN++; return ''; });
        h = h.replace(/<div[^>]*id="localeSheetBackdrop"[^>]*>[\s\S]*?<\/div>/g, ()=>{ uiN++; return ''; });
        for(const cls of ['locale-chip','locale-panel','locale-sheet','locale-sheet-backdrop','locale-backdrop']){
          const rr = cutDiv(h, cls); h = rr.out; uiN += rr.n;
        }

        // 3. pin English. This used to be inserted immediately before the locale engine, but the engine
        // is now cut above, so anchor it to </head> — otherwise a container that has never been processed
        // would come out with no pin at all.
        if(h.indexOf('lx-langen') < 0 && h.indexOf('</head>') >= 0){
          h = h.replace('</head>', PIN+'</head>');
          pinN++;
        }

        if(h !== before){ json[k] = h; touched = true; }
      }
    });
    if(touched) f++;
  }
}
console.log(`english-only: ${f} containers — incorp lines ${incorpN}, pickers ${langN}, wiring scripts ${scriptN}, css blocks ${cssN}, en-pins ${pinN}`);
console.log('  locale layer removed: engine '+engineN+', observer '+obsN+', prefs '+prefsN+', ui blocks '+uiN);