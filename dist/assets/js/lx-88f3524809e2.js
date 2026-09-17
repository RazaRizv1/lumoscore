(function(){
var LINK='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
var lines=document.getElementById('lxhLines'),cursor=document.getElementById('lxhCursor'),term=document.getElementById('lxhTerm');
var TO=[];
function wait(ms){return new Promise(function(r){TO.push(setTimeout(r,ms));});}
function mk(html){var d=document.createElement('div');d.className='lxh-tline';d.innerHTML=html;lines.appendChild(d);requestAnimationFrame(function(){d.classList.add('show');});return d;}
function type(el,txt,sp){return new Promise(function(res){var i=0;el.textContent='';(function t(){if(i<txt.length){el.textContent+=txt[i++];TO.push(setTimeout(t,sp));}else res();})();});}
var steps=[
 {t:'in',x:'lumoscore mcp start',d:400},
 {t:'tx',x:'→ Starting LumosCore MCP server…',c:'lxh-dim',d:520},
 {t:'tx',x:'✓ Connected to Aptos mainnet',c:'lxh-ok',d:460},
 {t:'tx',x:'→ Loaded 10 tools · key lx_live_••••',c:'lxh-dim',d:420},
 {t:'sp',d:160},
 {t:'tx',x:'🤖 Swap 500 APT for USDC',c:'lxh-sec',d:680},
 {t:'sp',d:120},
 {t:'tx',x:'⚡ Calling swap_tool…',c:'lxh-em',d:460},
 {t:'tx',x:'   from: APT · amount: 500 · to: USDC',c:'lxh-dim',sm:1,d:300},
 {t:'tx',x:'◉ Pending approval…',c:'lxh-warn',d:560,id:'lxhPend'},
 {t:'pg',d:1400},
 {t:'rep',id:'lxhPend',x:'✓ Approved · Executing…',c:'lxh-ok',d:420},
 {t:'sp',d:100},
 {t:'ok',x:'500 APT → 1,247.82 USDC',d:560},
 {t:'ln',x:'View on AptosScan',d:420}
];
function run(){
 var i=0;
 function next(){
  if(i>=steps.length){ wait(300).then(function(){if(cursor)cursor.style.opacity='1';}); return; }
  var s=steps[i++];
  wait(s.d||400).then(function(){
   if(s.t==='in'){var d=mk('');var pr=document.createElement('span');pr.className='lxh-p';pr.style.marginRight='8px';pr.textContent='❯';var tx=document.createElement('span');tx.className='lxh-w';d.appendChild(pr);d.appendChild(tx);type(tx,s.x,38).then(next);return;}
   else if(s.t==='tx'){var el=mk('<span class="'+s.c+(s.sm?' sm':'')+'">'+s.x+'</span>');if(s.id)el.id=s.id;}
   else if(s.t==='rep'){var e=document.getElementById(s.id);if(e){e.style.transition='opacity .2s';e.style.opacity='0';wait(200).then(function(){e.innerHTML='<span class="'+s.c+'">'+s.x+'</span>';e.style.opacity='1';next();});return;}}
   else if(s.t==='sp'){mk('').style.height='10px';}
   else if(s.t==='pg'){var w=mk('<div style="padding-left:26px;margin-top:2px"><div class="lxh-pgt"><div class="lxh-pg" style="height:100%;width:0;border-radius:9px;background:linear-gradient(90deg,#ea6a2c,#ff9a3d);transition:width 1.3s cubic-bezier(.4,0,.2,1)"></div></div></div>');wait(60).then(function(){var tr=w.querySelector('.lxh-pg');if(tr)tr.style.width='100%';next();});return;}
   else if(s.t==='ok'){mk('<div style="display:flex;align-items:flex-start;gap:8px"><span class="lxh-ok" style="font-size:17px;line-height:19px">✓</span><div><div class="lxh-ok" style="font-weight:600">Swap complete!</div><div class="lxh-dim" style="font-size:12px;margin-top:2px">'+s.x+'</div></div></div>');if(term)term.classList.add('win');}
   else if(s.t==='ln'){mk('<div style="padding-left:26px;margin-top:4px"><a href="#" class="lxh-em" style="font-size:12px;display:inline-flex;align-items:center;gap:6px;text-decoration:none">'+LINK+s.x+'</a></div>');}
   next();
  });
 }
 next();
}
function entrance(){var els=document.querySelectorAll('#lxhLeft .lxh-anim');for(var i=0;i<els.length;i++){(function(el){var dd=+el.getAttribute('data-d')||0;setTimeout(function(){el.classList.add('vis');},dd+150);})(els[i]);}}
var pc=document.getElementById('lxhParticles');
if(pc){for(var i=0;i<18;i++){var p=document.createElement('i');p.style.left=(Math.random()*100)+'%';p.style.animationDuration=(8+Math.random()*10)+'s';p.style.animationDelay=(Math.random()*10)+'s';var sz=(1+Math.random()*2);p.style.width=sz+'px';p.style.height=sz+'px';if(Math.random()>0.5)p.style.background='#ff9a3d';pc.appendChild(p);}}
document.addEventListener('click',function(e){var b=e.target&&e.target.closest?e.target.closest('.lxh-install'):null;if(!b)return;var t=b.getAttribute('data-copy')||'';if(navigator.clipboard)navigator.clipboard.writeText(t);b.classList.add('copied');setTimeout(function(){b.classList.remove('copied');},1800);});
function boot(){entrance();if(lines)run();}
if(document.readyState!=='loading')boot();else window.addEventListener('load',boot);
})();