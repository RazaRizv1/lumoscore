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

// Remove whole <script> blocks by testing EACH BLOCK'S OWN BODY — never with a regex that spans from
// a generic opener to a landmark, because such a pattern runs straight through `</script><script>` and
// deletes every innocent script in between.
//
// That is not hypothetical. The old prefs pattern opened on `<script>\n(function() {`, then searched
// lazily for K_LANG. The nearest earlier match for that opener was the card REVEAL script -- the only
// thing that sets `lcm-on` / `data-lcm-done` on `.kpi-card, .quick-card, .product-card, .market-card,
// .activity-card`. It was deleted as collateral, and since the stylesheet holds those cards at
// `opacity:0` until revealed (`html.lcm-ready .quick-card:not([data-lcm-done])`), every card on the
// dashboard stayed invisible for anyone whose browser was NOT in prefers-reduced-motion. That shipped
// and took the site down. Boundary-safe removal is the whole point of this helper.
function cutScripts(html, test){
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/g;
  let out = '', last = 0, m, n = 0;
  while((m = re.exec(html))){
    if(!test(m[1] || '', m[2])) continue;
    out += html.slice(last, m.index);
    last = m.index + m[0].length;
    n++;
  }
  return {out: out + html.slice(last), n};
}

let f=0, langN=0, incorpN=0, pinN=0, scriptN=0, cssN=0;
let engineN=0, obsN=0, prefsN=0, uiN=0;
for(const chain of ['aptos','hedera','starknet','vechain','worldchain','stellar','xrpl']){
  for(const dev of ['desktop','mobile']){
    const file = `lumoscore-${chain}-${dev}.html`;
    try{ read(file); }catch(e){ continue; }
    let touched = false;
    writeContents(file, json=>{
      for(const k of Object.keys(json)){
        let h = json[k], before = h;
        const beforeCuts = engineN + obsN + prefsN + scriptN;   // script-removing counters only
        const beforePin  = pinN;                                 // the pin ADDS a script back

        // 1. incorporation line -- desktop shape
        h = h.replace(/<span>Incorporated in Estonia[\s\S]{0,120}?<\/span>/g, ()=>{ incorpN++; return '<span>'+INCORP_NEW+'</span>'; });
        // 1b. mobile shape: bare text + link between the icon and the closing div
        h = h.replace(/Incorporated in Estonia · <a href="#">LumosCore OÜ — REG: 17336483<\/a>/g, ()=>{ incorpN++; return INCORP_NEW; });

        // 2. the picker: wrapper first (mobile nests .ft-lang inside .ft-lang-wrap)
        let r = cutDiv(h,'ft-lang-wrap'); h = r.out; langN += r.n;
        r = cutDiv(h,'ft-lang');          h = r.out; langN += r.n;

        // 2b. its wiring IIFE (identified by the button id it drives, inside its own block)
        { const r2 = cutScripts(h, (a,b)=> b.indexOf('getElementById("ftLangBtn")') >= 0);
          h = r2.out; scriptN += r2.n; }

        // 2c. the picker's stylesheet, now styling nothing
        // (lx-mlang is the phone's copy of the same rules). Rules for these classes that live INSIDE the
        // shared footer stylesheet are left alone — they now match nothing, and cutting individual rules out
        // of a block that also lays out the footer is a worse trade than a few dead selectors.
        h = h.replace(/<style id="lx-langcss">[\s\S]*?<\/style>/g, ()=>{ cssN++; return ''; });
        h = h.replace(/<style id="lx-mlang">[\s\S]*?<\/style>/g, ()=>{ cssN++; return ''; });

        // 2d. the dictionary + engine (the 138KB one) — identified by its own attribute
        { const r2 = cutScripts(h, (a,b)=> a.indexOf('data-lumos-locale') >= 0);
          h = r2.out; engineN += r2.n; }

        // 2e. the observer that re-ran the locale pass on every DOM mutation. Matched on the call it
        // makes, not on its opening line: desktop declares `function rerun()` and mobile `function r()`,
        // so a shape-based pattern silently missed every mobile page and left the observer running,
        // re-firing on every mutation to call a function that no longer exists.
        { const r2 = cutScripts(h, (a,b)=> b.indexOf('__lumosApplyLocale') >= 0);
          h = r2.out; obsN += r2.n; }

        // 2f. the language/currency prefs script, identified by the key it declares — inside its own body
        { const r2 = cutScripts(h, (a,b)=> b.indexOf("K_LANG = 'lumos.locale.lang'") >= 0);
          h = r2.out; prefsN += r2.n; }

        // 2g. the picker UI the prefs script drove. The trigger is a <button id="localeChip"> — an id on
        // a button, not a class a div-walker would find — so it survived as a dead globe in the header.
        h = h.replace(/<button[^>]*id="localeChip"[\s\S]*?<\/button>/g, ()=>{ uiN++; return ''; });
        for(const cls of ['locale-chip','locale-panel','locale-sheet','locale-sheet-backdrop','locale-backdrop']){
          const rr = cutDiv(h, cls); h = rr.out; uiN += rr.n;
        }

        // 3. pin English. This used to be inserted immediately before the locale engine, but the engine
        // is now cut above, so anchor it to </head> — otherwise a container processed after the cut
        // would come out with no pin at all.
        if(h.indexOf('lx-langen') < 0 && h.indexOf('</head>') >= 0){
          h = h.replace('</head>', PIN+'</head>');
          pinN++;
        }

        // GUARD. Cutting scripts out of a page is the operation that broke production, and it broke it
        // silently: the page still parsed, still served, still looked right in a reduced-motion browser.
        // So assert it here instead of hoping. Count the <script> blocks we meant to remove, compare
        // against the blocks that actually disappeared, and refuse to write if the numbers disagree.
        // Also name the card-reveal script explicitly, since that is the one that was lost.
        {
          const nScripts = s => (s.match(/<script[^>]*>/g) || []).length;
          const intended = (engineN + obsN + prefsN + scriptN - beforeCuts) - (pinN - beforePin);
          const actual   = nScripts(before) - nScripts(h);
          if(actual !== intended)
            throw new Error(`${file} [${k}]: removed ${actual} <script> blocks but only ${intended} were targeted `
              + `— a pattern is spanning a </script> boundary and eating neighbours. Refusing to write.`);
          if(before.indexOf('lcm-on') >= 0 && h.indexOf('lcm-on') < 0)
            throw new Error(`${file} [${k}]: the card-reveal script was deleted. Every .quick-card/.market-card/`
              + `.product-card would stay at opacity:0 for any visitor not in prefers-reduced-motion.`);
        }

        if(h !== before){ json[k] = h; touched = true; }
      }
    });
    if(touched) f++;
  }
}
console.log(`english-only: ${f} containers — incorp lines ${incorpN}, pickers ${langN}, wiring scripts ${scriptN}, css blocks ${cssN}, en-pins ${pinN}`);
console.log(`  locale layer removed: engine ${engineN}, observer ${obsN}, prefs ${prefsN}, ui blocks ${uiN}`);
