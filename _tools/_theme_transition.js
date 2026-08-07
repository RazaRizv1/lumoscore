// Site-wide smooth light<->dark theme transition.
// The theme flips `data-theme` on <html>, swapping every CSS variable instantly -> cards/borders snapped
// while <body> faded ("glitchy"). We now use the View Transitions API (Chromium) to crossfade the whole
// viewport in one smooth pass; browsers without it fall back to a brief color transition. We do NOT block
// the finalized toggle handler (it also swaps the sun/moon icon) — we re-dispatch its click INSIDE the
// view-transition callback so all its DOM changes are captured in the crossfade. Idempotent.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const STYLE='<style id="lx-theme-transition">'
// View Transitions crossfade (smooth full-page theme fade)
+'::view-transition-old(root),::view-transition-new(root){animation-duration:.42s;animation-timing-function:cubic-bezier(.4,0,.2,1);mix-blend-mode:normal}'
// fallback (no View Transitions): brief color-only transition while the html.lx-theming flag is set
+'html.lx-theming,html.lx-theming *,html.lx-theming *::before,html.lx-theming *::after{transition:background-color .3s ease,border-color .3s ease,color .3s ease,fill .3s ease,stroke .3s ease!important}'
+'</style>';

const SCRIPT='<script id="lx-theme-transition-js">(function(){'
+'var R=document.documentElement,reentry=false,t=null;'
+'function anim(){try{R.classList.add("lx-theming");if(t)clearTimeout(t);t=setTimeout(function(){R.classList.remove("lx-theming");t=null;},420);}catch(e){}}'
+'function isToggle(e){try{return e.target&&e.target.closest?e.target.closest(\'#themeToggle,[data-tooltip="Toggle theme"],[aria-label*="theme" i],.theme-toggle\'):null;}catch(_){return null;}}'
+'document.addEventListener("click",function(e){'
+'var el=isToggle(e);if(!el)return;'
+'if(reentry)return;'                                   // the re-dispatched click: let it reach the finalized handler
+'if(typeof document.startViewTransition!=="function"){anim();return;}'  // fallback path
+'e.preventDefault();e.stopImmediatePropagation();'      // suppress THIS click; we re-run it inside the transition
+'var run=function(){reentry=true;try{el.click();}catch(_){}reentry=false;};'
+'try{document.startViewTransition(run);}catch(_){run();}'
+'},true);'
+'})();<'+'/script>';

let n=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k];
      if(h.indexOf('id="themeToggle"')<0 && h.indexOf('data-theme')<0) continue;
      h=h.replace(/<style id="lx-theme-transition">[\s\S]*?<\/style>/g,'').replace(/<script id="lx-theme-transition-js">[\s\S]*?<\/script>/g,'');
      const bi=h.lastIndexOf('</body>'); if(bi<0) continue;
      json[k]=h.slice(0,bi)+STYLE+SCRIPT+h.slice(bi); n++;
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('theme-transition (view-transitions) injected on '+n+' page keys');
