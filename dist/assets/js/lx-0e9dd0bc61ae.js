(function(){
  function q(s,r){return (r||document).querySelector(s);}
  // item 18: desktop ships #openCreatePool inside the dropped hero, so it measures 0x0 and the page has
  // no way to create a pool at all. Put a link in the controls row and let it click the original button,
  // so the design's own open/close wiring stays the single path into the modal.
  function createPoolLink(){
    var row=q('.table-controls'); if(!row)return;
    if(q('.lx-cplink',row))return;                       // idempotent
    var src=q('#openCreatePool'); if(!src)return;        // nothing to delegate to; add no dead control
    var b=document.createElement('button');
    b.type='button'; b.className='lx-cplink';
    b.setAttribute('aria-label','Create Pool');
    b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" '
      +'stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line>'
      +'<line x1="5" y1="12" x2="19" y2="12"></line></svg><span>Create Pool</span>';
    b.addEventListener('click',function(e){ e.preventDefault();
      var t=q('#openCreatePool'); if(t)t.click(); });
    row.appendChild(b);
  }
  // Every step is a MOVE or a class flag on something that already exists, and every step is guarded, so
  // a second pass over an arranged card does nothing. The stats are deliberately NOT touched here -- the
  // Pools layer writes into them through .lm-chip, and taking them out of it blanks every value.
  // Only ever runs where the page did not ship a .lm -- i.e. the phone build. Idempotent: once the
  // card exists this returns on the first line.
  function buildMobile(){
    var promo=q('.lumos-promo'); if(!promo)return;
    if(q('.lm',promo))return;
    var slide=q('.lumos-promo-slide',promo);
    var title=slide?q('.lumos-promo-title',slide):null;
    var sub=slide?q('.lumos-promo-sub',slide):null;
    if(!title)return;                       // no copy to build from; leave the page as it is
    var lm=document.createElement('div'); lm.className='lm';
    var c=document.createElement('div'); c.className='lm-c lm-c-pool';
    var ic=document.createElement('span'); ic.className='lx-heroico'; ic.setAttribute('aria-hidden','true');
    var h=document.createElement('h2'); h.className='lm-h';
    h.innerHTML=title.innerHTML;            // keeps the line break and the accent span
    var pEl=document.createElement('p'); pEl.className='lm-sub';
    if(sub)pEl.innerHTML=sub.innerHTML;
    c.appendChild(ic); c.appendChild(h); c.appendChild(pEl);
    // the chip is what _ammdata.js looks for before it will build and fill the four stats
    var chip=document.createElement('div'); chip.className='lm-chip';
    lm.appendChild(c); lm.appendChild(chip);
    promo.appendChild(lm);
    promo.className+=' lm-pools lm-on lx-mobhero';
  }
  function apply(){
    // The phone page ships the carousel and no .lm. Build the card first; every step below then
    // treats mobile and desktop identically.
    buildMobile();
    var card=q('.lumos-promo.lm-pools'); if(!card)return;
    var lm=q('.lm',card); if(!lm)return;
    var copy=q('.lm-c-pool',lm)||q('.lm-c',lm); if(!copy)return;

    // 1. the chain mark, first thing in the copy column
    if(!q('.lx-heroico',copy)){
      var ic=document.createElement('span');
      ic.className='lx-heroico'; ic.setAttribute('aria-hidden','true');
      copy.insertBefore(ic,copy.firstChild);
    }

    // 2. the page's two CTAs, lifted into the card. MOVED, not rebuilt -- #ammHiwBtn already carries its
    //    listener, and a clone would render correctly and then do nothing when pressed.
    //    On the phone they go BELOW the card instead. Trade's phone card carries no buttons at all,
    //    and folding this row in was the whole reason the Pools card ran to twice Trade's height.
    //    Moved rather than dropped: Create Pool stays on the page, one row further down than the
    //    page originally put it, and keeps .mdx-hero-ctas -- NOT lx-dctas, which positions absolute
    //    against the card it would no longer be inside.
    var phone=(' '+card.className+' ').indexOf(' lx-mobhero ')>=0;
    var src=q('.dex-hero-r')||q('.mdx-hero-ctas');
    if(src&&phone){
      // Trade's two actions live in the list's section head, not in a bar under the hero -- and the
      // Pools phone page ships no section head at all, so build the one it is missing and move them
      // into it. Inserted before the All Pools / My Positions tabs, which is where Trade's head sits
      // relative to its own filter row.
      var tabs=q('#poolTabs')||q('.filter-tabs');
      var head=q('.lx-poolhead');
      if(tabs&&!head){
        head=document.createElement('div');
        head.className='mdx-section-head lx-poolhead';
        var h2=document.createElement('h2'); h2.textContent='Liquidity Pools';
        head.appendChild(h2);
        tabs.parentNode.insertBefore(head,tabs);
      }
      if(head&&src.parentNode!==head)head.appendChild(src);
    }else if(src&&src.parentNode!==copy){
      if((' '+src.className+' ').indexOf(' lx-dctas ')<0)src.className+=' lx-dctas';
      copy.appendChild(src);
    }

    // 3. Market Overview carries five rows to Trade's New Mints three, so the column beside the hero
    //    runs taller than the hero itself. Participants and 24h Fees go -- matched on their label rather
    //    than their position, so a reordered list cannot take the wrong two.
    var drop={'participants':1,'24h fees':1};
    var rows=document.querySelectorAll('.amm-snapshot-row');
    for(var r=0;r<rows.length;r++){
      var lbl=rows[r].querySelector('.amm-snapshot-label');
      if(!lbl)continue;
      if(drop[(lbl.textContent||'').trim().toLowerCase()])rows[r].style.display='none';
    }

    // 3. the plain page heading above the card now duplicates the card. Hidden visually only.
    var heads=[q('.dex-hero-l'),q('.page-title'),q('.page-subtitle')];
    for(var hi=0;hi<heads.length;hi++){ var hd=heads[hi];
      if(hd&&(' '+hd.className+' ').indexOf(' lx-sronly ')<0)hd.className+=' lx-sronly'; }
  }
  function boot(){
    apply();
    try{ createPoolLink(); }catch(_){}
    // The Pools layer rebuilds this card when its data lands and again on each refresh, so re-assert
    // rather than assuming one pass is enough. Cheap: every branch above is a no-op once arranged.
    try{
      var host=document.querySelector('.page')||document.body;
      new MutationObserver(function(){ apply(); try{ createPoolLink(); }catch(_){} }).observe(host,{childList:true,subtree:true});
    }catch(_){}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();