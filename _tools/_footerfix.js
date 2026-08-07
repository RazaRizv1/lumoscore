// Footer: "LUMOS Token" appears in BOTH the Menu column and the Resources column — remove the Menu one
// (keep Resources). Anchored on the "Features" link (only in the Menu column) so it's idempotent + safe.
// ALSO (audit #18): every footer link is a dead href="#" (Home/Features/Docs/FAQs/Terms/Privacy…) that
// jumps the page to the top. Runtime script routes the ones with real pages (Home) and neutralizes the
// rest (default cursor + preventDefault) so nothing pretends to be clickable.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);
const RE=/(>\s*Features\s*<\/a>\s*)<a[^>]*>\s*LUMOS Token\s*<\/a>\s*/i;

// ---- footer socials: real URLs + a LinkedIn icon (the design shipped X + Telegram, both href="#") ----
const SOC={X:'https://x.com/LumosCore', Telegram:'http://t.me/lumoscore', LinkedIn:'https://www.linkedin.com/company/lumoscore/'};
// standard LinkedIn glyph, drawn to match the existing 14x14 / viewBox 24 / fill=currentColor icons
const LI_PATH='M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z';
const LI_A='<a href="'+SOC.LinkedIn+'" target="_blank" rel="noopener" aria-label="LinkedIn"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="'+LI_PATH+'"/></svg></a>';
function fixSocials(h){
  // 1) point the existing icons at the real profiles (idempotent: href="#" is gone after the first pass)
  h=h.replace(/<a href="#" aria-label="X">/g, '<a href="'+SOC.X+'" target="_blank" rel="noopener" aria-label="X">');
  h=h.replace(/<a href="#" aria-label="Telegram">/g, '<a href="'+SOC.Telegram+'" target="_blank" rel="noopener" aria-label="Telegram">');
  // 2) append LinkedIn right after the Telegram icon (only once per page key)
  if(h.indexOf('aria-label="LinkedIn"')<0){
    h=h.replace(/(<a href="[^"]*" target="_blank" rel="noopener" aria-label="Telegram">[\s\S]*?<\/a>)/, '$1\n          '+LI_A);
  }
  return h;
}
const FSCRIPT='<script id="lx-footerlinks">(function(){if(window.__lxFtl)return;window.__lxFtl=1;'
+'var ROUTE={"home":"lumoscore-home.html"};'
+'function fix(){var scope=document.querySelectorAll("footer a[href=\\u0022#\\u0022], .footer a[href=\\u0022#\\u0022], [class*=footer] a[href=\\u0022#\\u0022]");'
+'[].forEach.call(scope,function(a){if(a.__lxf)return;a.__lxf=1;var key=(a.textContent||"").trim().toLowerCase();'
+'if(ROUTE[key]){a.setAttribute("href",ROUTE[key]);return;}'
+'a.style.cursor="default";a.addEventListener("click",function(e){e.preventDefault();});});}'
+'if(document.readyState!=="loading")fix();else document.addEventListener("DOMContentLoaded",fix);setTimeout(fix,1200);'
+'})();</script>';   // literal </script> — the container serializer escapes it for JSON; an \/-escaped one NEVER CLOSES the element and swallows every following script
let n=0,ns=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain','stellar','xrpl']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    let changed=false;
    for(const k of Object.keys(json)){
      let h=json[k]; const before=h;
      if(h.indexOf('LUMOS Token')>=0) h=h.replace(RE,'$1');
      if(h.indexOf('class="socials"')>=0) h=fixSocials(h);
      if(h.indexOf('href="#"')>=0 || h.indexOf('lx-footerlinks')>=0){
        h=h.replace(/<script id="lx-footerlinks">[\s\S]*?<\/script>/g,'');   // GLOBAL: also catches the unclosed-legacy + fixed pair as one lazy span
        const bi=h.lastIndexOf('</body>');
        if(bi>=0){ h=h.slice(0,bi)+FSCRIPT+h.slice(bi); ns++; }
      }
      if(h!==before){ json[k]=h; changed=true; n++; }
    }
    if(changed){ const serialized=JSON.stringify(json).split('</').join('<'+B+'/'); fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8'); }
  }
}
console.log('footer: LUMOS-Token menu removal + dead-link neutralizer on '+n+' page keys ('+ns+' scripted)');
