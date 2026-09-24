
(function(){

  var idx=0;
  function show(i){
    idx=i;
    document.querySelectorAll('.step').forEach(function(s){ s.classList.toggle('active', parseInt(s.getAttribute('data-step'))===i); });
    if(i===3) runLoader();
  }
  function gotoHome(){
    try{ if(window.top && window.top.lxNavigate){ window.top.lxNavigate(['lumoscore-home.html','lumoscore-home-mobile.html']); return true; } }catch(e){}
    return false;
  }
  function exit(){
    try{ if(window.top && window.top.lxNavigate){ window.top.lxNavigate(['lumoscore-landing.html','lumoscore-landing-mobile.html']); return; } }catch(e){}
    show(0);
  }

  document.querySelectorAll('[data-go]').forEach(function(b){
    if(b.hasAttribute('data-net')) return; // handled below
    b.addEventListener('click',function(){ show(parseInt(b.getAttribute('data-go'))); });
  });
  document.querySelectorAll('[data-net]').forEach(function(b){
    b.addEventListener('click',function(){
      document.querySelectorAll('[data-net]').forEach(function(x){x.classList.remove('sel');}); b.classList.add('sel');
      setTimeout(function(){ show(parseInt(b.getAttribute('data-go'))); }, 150);
    });
  });
  document.querySelectorAll('[data-back]').forEach(function(b){ b.addEventListener('click',function(){ if(idx>1) show(idx-1); else exit(); }); });
  document.querySelectorAll('[data-exit]').forEach(function(b){ b.addEventListener('click',exit); }); show(1);

  // loader
  var STAGES=[
    {p:18, s:'Setting up engine', sub:'Booting the LumosCore runtime…', hint:'Initializing'},
    {p:42, s:'Connecting to network', sub:'Handshaking with the ledger…', hint:'Securing channel'},
    {p:66, s:'Routing liquidity', sub:'Mapping pools across chains…', hint:'Building routes'},
    {p:86, s:'Syncing assets', sub:'Loading balances & trustlines…', hint:'Almost there'},
    {p:100,s:'Welcome to LumosCore', sub:'Taking you to your dashboard…', hint:'Done'}
  ];
  var ran=false;
  function runLoader(){
    if(ran) reset(); ran=true;
    var fill=document.getElementById('loadFill'), pct=document.getElementById('loadPct'),
        st=document.getElementById('loadStatus'), sub=document.getElementById('loadSub'), hint=document.getElementById('loadHint');
    var chips=document.querySelectorAll('.lchip'); var i=0;
    function tick(){
      if(i>=STAGES.length){ setTimeout(function(){ if(idx===3){ if(!gotoHome()) show(0); } }, 620); return; }
      var s=STAGES[i]; fill.style.width=s.p+'%';
      st.textContent=s.s;
      sub.textContent=s.sub; hint.textContent=s.hint; if(chips[i]) chips[i].classList.add('done');
      var target=s.p, cur=parseInt(pct.textContent)||0;
      var t=setInterval(function(){ cur+=(target>cur?1:0); pct.textContent=cur+'%'; if(cur>=target) clearInterval(t); }, 14);
      i++; setTimeout(tick, 860);
    }
    tick();
  }
  function reset(){ document.getElementById('loadFill').style.width='0%'; document.getElementById('loadPct').textContent='0%'; document.querySelectorAll('.lchip').forEach(function(c){c.classList.remove('done');}); }
})();
