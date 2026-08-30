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
  // Both labels: desktop ships "X", the phone ships "X / Twitter". The captured label is put back
  // unchanged so each layout keeps the wording it had.
  h=h.replace(/<a href="#" aria-label="(X(?: \/ Twitter)?)">/g, '<a href="'+SOC.X+'" target="_blank" rel="noopener" aria-label="$1">');
  h=h.replace(/<a href="#" aria-label="Telegram">/g, '<a href="'+SOC.Telegram+'" target="_blank" rel="noopener" aria-label="Telegram">');
  // 2) append LinkedIn right after the Telegram icon (only once per page key)
  if(h.indexOf('aria-label="LinkedIn"')<0){
    h=h.replace(/(<a href="[^"]*" target="_blank" rel="noopener" aria-label="Telegram">[\s\S]*?<\/a>)/, '$1\n          '+LI_A);
  }
  return h;
}
// ---- the phone footer's hole ----------------------------------------------------------------------
// .ft-cols-2 is a two-column grid holding THREE columns: Menu, Resources, Legal. Grid puts Menu and
// Resources on row 1 and Legal on row 2, and row 1 is as tall as its tallest cell -- Resources, with
// six links against Menu's three. The result is a column of dead space under Menu, which is the gap in
// the screenshot.
//
// Fixed by placement, not by padding: Resources spans both rows, Legal moves up under Menu. Each row
// is then only as tall as what is in it.
//
// The selectors are deliberately narrow. :nth-child(2):nth-last-child(2) and :nth-child(3):last-child
// both only match when the footer has EXACTLY three columns, so a footer that gains a fourth falls
// back to the plain grid instead of being mis-placed by a rule written for three.
const FGRID='<style id="lx-footergrid">'
  +'.ft-cols-2{align-items:start}'
  +'.ft-cols-2 .ft-col:nth-child(2):nth-last-child(2){grid-row:1/span 2}'
  +'.ft-cols-2 .ft-col:nth-child(3):last-child{grid-column:1;grid-row:2}'
  +'</style>';
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
      // "Features" pointed at nothing and named nothing on the site — dropped from the Menu column.
      // Runs AFTER the RE above, which anchors on it.
      h=h.replace(/\s*<a[^>]*href="#"[^>]*>\s*Features\s*<\/a>/gi,'');
      // "FAQs" now has a page. Wired here rather than left to the runtime neutralizer below.
      h=h.replace(/(<a[^>]*)href="#"([^>]*>\s*FAQs?\s*<\/a>)/gi,'$1href="/faq"$2');

      // ---- mobile footer parity -------------------------------------------------------------------
      // The phone footer is a DIFFERENT markup block from the desktop one, so wiring href="#" links
      // never reached it: it had no Support or About entry to wire, and its FAQs pointed at #faq --
      // a section that exists only on the landing page, so everywhere else it linked to nothing.
      //
      // EVERY edit here is confined to the <footer> slice. "Why LumosCore" and "Whitepaper" both
      // appear in the top nav as well, and an unscoped replace put an About link into the mobile
      // navigation menu instead of the footer. The line below removes that if a previous run left
      // one; the inserts then work on the footer substring alone.
      h=h.replace(/(<nav class="menu-links">[\s\S]*?)\s*<a href="\/about">About<\/a>/g,'$1');
      // Same slip, second symptom: the nav's own FAQs link was rewritten from #faq to /faq. On a page
      // that HAS an on-page FAQ section that link is meant to scroll, not navigate away, so it is put
      // back. Only where the section actually exists — elsewhere #faq would be a link to nothing.
      if(h.indexOf('id="faq"')>=0)
        h=h.replace(/(<nav class="menu-links">[\s\S]*?)<a href="\/faq">FAQs<\/a>/g,'$1<a href="#faq">FAQs</a>');

      const fi=h.lastIndexOf('<footer');
      if(fi>=0){
        let ft=h.slice(fi);
        const bft=ft;
        ft=ft.replace(/<a href="#faq">FAQs<\/a>/g,'<a href="/faq">FAQs</a>');
        if(ft.indexOf('href="/about"')<0)
          ft=ft.replace(/(<a href="#why">Why LumosCore<\/a>)/,'$1\n        <a href="/about">About</a>');
        if(ft.indexOf('href="/support"')<0)
          ft=ft.replace(/(<a href="\/whitepaper">Whitepaper<\/a>)/,'<a href="/support">Support</a>\n        $1');
        // The phone ships TWO footer variants: the landing one (Products / Why LumosCore / FAQs) and
        // the in-app one (Home / AMM Pools), which carries neither FAQs nor About. Anchored on
        // Documentation and Blog, which the in-app variant does have.
        if(ft.indexOf('href="/faq"')<0)
          ft=ft.replace(/(<a href="\/docs">Documentation<\/a>)/,'$1\n        <a href="/faq">FAQs</a>');
        if(ft.indexOf('href="/about"')<0)
          ft=ft.replace(/(<a href="\/blog">Blog<\/a>)/,'$1\n        <a href="/about">About</a>');
        if(ft!==bft) h=h.slice(0,fi)+ft;
      }
      if(h.indexOf('class="socials"')>=0) h=fixSocials(h);
      // Only where that grid actually exists, and only once.
      if(h.indexOf('ft-cols-2')>=0 && h.indexOf('id="lx-footergrid"')<0){
        const hi=h.indexOf('</head>');
        if(hi>=0) h=h.slice(0,hi)+FGRID+h.slice(hi);
      }
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
