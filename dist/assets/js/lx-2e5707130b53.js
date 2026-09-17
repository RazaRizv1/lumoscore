
/* Universal subtle scroll-reveal (matches the lcm motion on Home/Wallet/etc.) */
(function(){
  if (window.__lcmU) return; window.__lcmU = 1;
  if (!window.IntersectionObserver) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  function start(){
    var st = document.createElement('style');
    st.textContent = '[data-lcmu]{opacity:0;transform:translateY(8px);}[data-lcmu].lcmu-in{opacity:1;transform:none;transition:opacity .55s cubic-bezier(.2,.65,.2,1),transform .55s cubic-bezier(.2,.65,.2,1);will-change:opacity,transform;}';
    document.head.appendChild(st);
    var root = document.querySelector('main')
      || document.querySelector('.app-main,.app-body,.app-content,.page,.page-wrap,.page-main,.content,.main-content,.wrap,.shell-main,.admin-main,.admin-content,.dash,.mdx-main,.mob-main')
      || document.body;
    var vh = window.innerHeight || 800;
    var BAD = /(topbar|navbar|sidebar|footer|modal|overlay|toast|drawer|sheet|locale-|backdrop|tooltip|nav-dock)/i;
    function ok(el){
      if(!el || el.nodeType!==1) return false;
      var tag = el.tagName.toLowerCase();
      if(tag==='script'||tag==='style'||tag==='svg'||tag==='header'||tag==='nav'||tag==='footer'||tag==='template'||tag==='link'||tag==='meta') return false;
      var cls = (el.className && el.className.baseVal!=null) ? el.className.baseVal : (''+(el.className||''));
      if(BAD.test(cls) || BAD.test(el.id||'')) return false;
      var cs = getComputedStyle(el);
      if(cs.display==='none'||cs.visibility==='hidden'||cs.position==='fixed'||cs.position==='sticky') return false;
      return el.getBoundingClientRect().height >= 44;
    }
    function blocks(el){ return Array.prototype.slice.call(el.children).filter(ok); }
    var targets = [];
    function collect(el, depth){
      var kids = blocks(el);
      var sizable = kids.filter(function(e){ return e.getBoundingClientRect().height >= 72; });
      var shouldDescend = depth < 3 && kids.length >= 1 && (
            depth === 0 ||
            kids.length === 1 ||
            (kids.length >= 2 && el.getBoundingClientRect().height > vh*0.55 && sizable.length >= 2)
      );
      if (shouldDescend) kids.forEach(function(k){ collect(k, depth+1); });
      else targets.push(el);
    }
    collect(root, 0);
    targets = targets.filter(function(el,i){ return targets.indexOf(el)===i; });
    targets = targets.filter(function(el){ return !targets.some(function(o){ return o!==el && o.contains(el); }); });
    if (targets.length > 36) targets = targets.slice(0, 36);
    if(!targets.length) return;
    targets.forEach(function(el){ el.setAttribute('data-lcmu',''); });
    var io = new IntersectionObserver(function(ents){
      ents.sort(function(a,b){ return a.boundingClientRect.top - b.boundingClientRect.top; });
      var k = 0;
      ents.forEach(function(e){
        if(e.isIntersecting){
          var el = e.target;
          setTimeout(function(){ el.classList.add('lcmu-in'); }, Math.min(k,7)*70);
          k++; io.unobserve(el);
        }
      });
    }, { threshold: 0.05, rootMargin: '0px 0px -6% 0px' });
    targets.forEach(function(el){ io.observe(el); });
    setTimeout(function(){ targets.forEach(function(el){ el.classList.add('lcmu-in'); }); }, 1800);
  }
  if(document.readyState !== 'loading') start();
  else document.addEventListener('DOMContentLoaded', start);
})();
