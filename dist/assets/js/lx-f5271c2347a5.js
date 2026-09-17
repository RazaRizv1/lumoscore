/* LumosCore network switcher (desktop) */
(function(){
  if(window.__lxns)return; window.__lxns=1;
  function ready(fn){ if(document.readyState!=='loading')fn(); else document.addEventListener('DOMContentLoaded',fn); }
  ready(function(){
    var trigger=document.querySelector('.network-pill')||document.querySelector('.ah-net-switcher')||document.querySelector('.lc-net-chip,.net-chip');
    if(!trigger)return;
    var STELLAR='<span style="width:100%;height:100%;border-radius:50%;overflow:hidden;display:inline-flex;align-items:center;justify-content:center"><svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><g fill="none"><circle cx="16" cy="16" r="16" fill="#000"/><path d="M23.13 9.292l-2.4 1.224-11.598 5.907A6.909 6.909 0 0119.35 9.498l1.374-.7.205-.105a8.439 8.439 0 00-13.371 7.472 1.535 1.535 0 01-.834 1.484l-.725.37v1.724l2.134-1.088.691-.353.681-.347 12.226-6.23 1.374-.699 2.84-1.447V7.856L23.13 9.292zm2.816 2.012L10.201 19.32l-1.374.7L6 21.463v1.723l2.808-1.43 2.401-1.224 11.61-5.916a6.909 6.909 0 01-10.229 6.93l-.085.045-1.49.76a8.439 8.439 0 0013.372-7.475 1.536 1.536 0 01.833-1.483l.726-.37v-1.718z" fill="#FFF"/></g></svg></span>';var XRPLICO='<span style="width:100%;height:100%;border-radius:50%;overflow:hidden;display:inline-flex;align-items:center;justify-content:center"><svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><g fill="none"><circle cx="16" cy="16" r="16" fill="#23292F"/><path d="M23.07 8h2.89l-6.015 5.957a5.621 5.621 0 01-7.89 0L6.035 8H8.93l4.57 4.523a3.556 3.556 0 004.996 0L23.07 8zM8.895 24.563H6l6.055-5.993a5.621 5.621 0 017.89 0L26 24.562h-2.895L18.5 20a3.556 3.556 0 00-4.996 0l-4.61 4.563z" fill="#FFF"/></g></svg></span>';var HEDERA='<img src="data:image/webp;base64,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" style="width:100%;height:100%;object-fit:cover;display:block" alt="">';
    var TCHEV='<svg class="lxns-tchev" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
    var COPY='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    var CHECK='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    var css='.lxns-trigger{display:inline-flex;align-items:center;gap:9px;padding:6px 11px 6px 8px;border-radius:12px;border:1px solid var(--lxns-bd);background:var(--lxns-tbg);cursor:pointer;transition:border-color .15s,background .15s;line-height:1;box-sizing:border-box;}'
      +'.lxns-trigger:hover{border-color:var(--lxns-bdh);background:var(--lxns-hv);}'
      +'.lxns-tico{width:26px;height:26px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff;font-weight:800;font-size:15px;}'
      +'.lxns-tico.stellar{background:linear-gradient(135deg,#6f5ded,#2563eb);}'
      +'.lxns-tico.xrpl{background:linear-gradient(135deg,#f7991f,#e8740e);}'+'.lxns-tico.hedera{background:transparent;overflow:hidden;}'
      +'.lxns-tmeta{display:flex;flex-direction:column;gap:2px;min-width:0;text-align:left;}'
      +'.lxns-tname{font-size:15px;font-weight:700;color:var(--lxns-tx);line-height:1.1;white-space:nowrap;}'
      +'.lxns-tstatus{font-size:12.5px;font-weight:500;color:var(--lxns-sf);line-height:1;white-space:nowrap;}'
      +'.lxns-tchev{color:var(--lxns-sf);flex-shrink:0;transition:transform .2s;}'
      +'.lxns-open .lxns-tchev{transform:rotate(180deg);}'
      +'.lxns-panel{position:fixed;z-index:99999;width:300px;max-width:calc(100vw - 20px);background:var(--lxns-bg);color:var(--lxns-tx);border:1px solid var(--lxns-bd);border-radius:16px;padding:8px;box-shadow:0 24px 60px rgba(0,0,0,.4);display:none;font-family:inherit;}'
      +'.lxns-panel.open{display:block;animation:lxnsIn .14s ease;}'
      +'@keyframes lxnsIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}'
      +'.lxns-phead{padding:7px 10px 4px;font-size:12.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--lxns-sf);}'
      +'.lxns-row{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:12px;border:1px solid transparent;cursor:pointer;transition:background .14s,border-color .14s;}'
      +'.lxns-row:hover{background:var(--lxns-hv);}'
      +'.lxns-row.active{background:rgba(247,134,27,.12);border-color:rgba(247,134,27,.30);}'
      +'.lxns-ico{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff;font-weight:800;font-size:17px;}'
      +'.lxns-ico.stellar{background:transparent;}'
      +'.lxns-ico.xrpl{background:transparent;}'+'.lxns-ico.hedera{background:transparent;overflow:hidden;}'
      +'.lxns-meta{flex:1;min-width:0;}'
      +'.lxns-name{font-size:16px;font-weight:700;line-height:1.2;color:var(--lxns-tx);}'
      +'.lxns-addr{display:inline-flex;align-items:center;gap:6px;font-family:ui-monospace,"JetBrains Mono",monospace;font-size:13px;color:var(--lxns-sf);margin-top:3px;}'
      +'.lxns-dot{width:6px;height:6px;border-radius:50%;background:#1fcc8b;box-shadow:0 0 6px #1fcc8b;flex-shrink:0;}'
      +'.lxns-copy{background:transparent;border:none;padding:1px 3px;color:var(--lxns-sf);cursor:pointer;display:inline-flex;align-items:center;}'
      +'.lxns-copy:hover{color:var(--lxns-tx);}'
      +'.lxns-check{width:22px;height:22px;border-radius:50%;background:#f7861b;display:none;align-items:center;justify-content:center;flex-shrink:0;}'
      +'.lxns-row.active .lxns-check{display:flex;}';
    var st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);

    function lum(c){var m=(c||'').match(/[\d.]+/g); if(!m)return 0; return (0.299*+m[0]+0.587*+m[1]+0.114*+m[2])/255; }
    var dark=lum(getComputedStyle(document.body).backgroundColor)<0.5;

    // ----- neaten trigger -----
    var cur='hedera';
    var connected=false; try{connected=!!localStorage.getItem('lumos.wallet');}catch(e){}
    function setTrigger(net,status){
      var name=net==='hedera'?'Aptos':net==='xrpl'?'XRP Ledger':'Stellar Network';
      var ico=net==='hedera'?'<span class="lxns-tico hedera">'+HEDERA+'</span>':net==='xrpl'?'<span class="lxns-tico xrpl">'+XRPLICO+'</span>':'<span class="lxns-tico stellar">'+STELLAR+'</span>';
      trigger.innerHTML=ico+'<span class="lxns-tmeta"><span class="lxns-tname">'+name+'</span><span class="lxns-tstatus">'+status+'</span></span>'+TCHEV;
    }
    trigger.classList.add('lxns-trigger');
    var T=trigger.style;
    if(dark){T.setProperty('--lxns-tbg','rgba(255,255,255,.03)');T.setProperty('--lxns-bd','rgba(255,255,255,.10)');T.setProperty('--lxns-bdh','rgba(255,255,255,.20)');T.setProperty('--lxns-hv','rgba(255,255,255,.06)');T.setProperty('--lxns-tx','#ECECF3');T.setProperty('--lxns-sf','#9A9AAB');}
    else{T.setProperty('--lxns-tbg','#FFFFFF');T.setProperty('--lxns-bd','rgba(15,15,25,.10)');T.setProperty('--lxns-bdh','rgba(15,15,25,.20)');T.setProperty('--lxns-hv','rgba(15,15,25,.04)');T.setProperty('--lxns-tx','#16161E');T.setProperty('--lxns-sf','#6B6B78');}
    setTrigger(cur, connected?'Connected':'Not Connected');

    function rowHTML(net,name,disp,full,sel){
      return '<div class="lxns-row'+(sel?' active':'')+'" data-net="'+net+'">'
        +'<div class="lxns-ico '+net+'">'+(net==='hedera'?HEDERA:net==='xrpl'?XRPLICO:STELLAR)+'</div>'
        +'<div class="lxns-meta"><div class="lxns-name">'+name+'</div>'
        +'<div class="lxns-addr"><span class="lxns-dot"></span>'+disp
        +'<button class="lxns-copy" data-copy="'+full+'" aria-label="Copy address">'+COPY+'</button></div></div>'
        +'<div class="lxns-check">'+CHECK+'</div></div>';
    }
    var panel=document.createElement('div'); panel.className='lxns-panel';
    panel.innerHTML='<div class="lxns-phead">Switch network</div>'+rowHTML('hedera','Aptos','0x00...000a','0x000000000000000000000000000000000000000000000000000000000000000a',cur==='hedera')+rowHTML('stellar','Stellar Network','GCIR...MTTB','GCIRABCD1234567890XYZMTTB',cur==='stellar')+rowHTML('xrpl','XRP Ledger','rUtz...o7d3','rUtzAbCdEfGh12345o7d3',cur==='xrpl');
    document.body.appendChild(panel);
    var P=panel.style;
    if(dark){P.setProperty('--lxns-bg','#15151d');P.setProperty('--lxns-tx','#ECECF3');P.setProperty('--lxns-sf','#9A9AAB');P.setProperty('--lxns-bd','rgba(255,255,255,.09)');P.setProperty('--lxns-hv','rgba(255,255,255,.055)');}
    else{P.setProperty('--lxns-bg','#FFFFFF');P.setProperty('--lxns-tx','#16161E');P.setProperty('--lxns-sf','#6B6B78');P.setProperty('--lxns-bd','rgba(15,15,25,.10)');P.setProperty('--lxns-hv','rgba(15,15,25,.04)');}

    function place(){var r=trigger.getBoundingClientRect(),w=panel.offsetWidth||300,l=r.right-w; if(l<10)l=10; if(l+w>window.innerWidth-10)l=window.innerWidth-10-w; panel.style.top=(r.bottom+8)+'px'; panel.style.left=l+'px';}
    function open(){panel.classList.add('open');place();trigger.classList.add('lxns-open');}
    function close(){panel.classList.remove('open');trigger.classList.remove('lxns-open');}
    trigger.style.cursor='pointer';
    trigger.addEventListener('click',function(e){e.stopPropagation();panel.classList.contains('open')?close():open();});
    document.addEventListener('click',function(e){if(panel.classList.contains('open')&&!panel.contains(e.target)&&!trigger.contains(e.target))close();});
    document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
    window.addEventListener('resize',function(){if(panel.classList.contains('open'))place();});
    window.addEventListener('scroll',function(){if(panel.classList.contains('open'))place();},true);
    panel.querySelectorAll('.lxns-copy').forEach(function(b){b.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();var t=b.getAttribute('data-copy')||'';if(!window.__lxCopyTo){window.__lxCopyTo=function(text){function toast(){try{var st=document.querySelector('.toast-stack');if(!st){st=document.createElement('div');st.className='toast-stack';document.body.appendChild(st);}var fixed=false;try{fixed=(getComputedStyle(st).position==='fixed');}catch(_){}if(!fixed&&!document.getElementById('lx-copytoast-css')){var cs=document.createElement('style');cs.id='lx-copytoast-css';cs.textContent='.toast-stack{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:100002;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none}'+'.toast{background:#1b1e24;color:#fff;padding:11px 18px 11px 14px;border-radius:10px;font-size:15px;font-weight:600;display:inline-flex;align-items:center;gap:9px;box-shadow:0 12px 32px rgba(0,0,0,.28),0 2px 8px rgba(0,0,0,.16);max-width:90vw}'+'.toast .check-ic{width:18px;height:18px;border-radius:50%;background:#35c07f;color:#fff;font-size:11px;font-weight:700;line-height:1;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}';document.head.appendChild(cs);}try{st.style.zIndex='100002';}catch(_){}var t=document.createElement('div');t.className='toast';var ic=document.createElement('span');ic.className='check-ic';ic.textContent='✓';var tx=document.createElement('span');tx.textContent='Copied to clipboard';t.appendChild(ic);t.appendChild(tx);st.appendChild(t);setTimeout(function(){t.remove();},2200);}catch(_){}}function legacy(){try{var ta=document.createElement('textarea');ta.value=String(text);ta.setAttribute('readonly','');ta.style.cssText='position:fixed;left:-9999px;top:0;opacity:0';document.body.appendChild(ta);ta.select();try{ta.setSelectionRange(0,String(text).length);}catch(_){}var ok=document.execCommand('copy');ta.remove();return !!ok;}catch(_){return false;}}try{ if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(toast,function(){ if(legacy())toast(); else window.prompt('Address',text); });return; } }catch(_){}if(legacy())toast(); else window.prompt('Address',text);};}window.__lxCopyTo(t);});});
    panel.querySelectorAll('.lxns-row').forEach(function(rw){rw.addEventListener('click',function(e){
      if(e.target.closest('.lxns-copy'))return;
      var net=rw.getAttribute('data-net');
      panel.querySelectorAll('.lxns-row').forEach(function(x){x.classList.toggle('active',x===rw);});
      close();
      if(net!==cur){
        try{localStorage.setItem('lumos.network',net);}catch(_){}
        setTrigger(net,'Not Connected'); cur=net;
        if(window.lxwOpenWallet) window.lxwOpenWallet(net,'lumoscore-home.html');
      }
    });});

    // called by the wallet modal once a wallet connects
    window.lxnsSetConnected=function(net,name){ cur=net; try{localStorage.setItem('lumos.network',net);}catch(_){} setTrigger(net,'Connected'); };
  });
})();
