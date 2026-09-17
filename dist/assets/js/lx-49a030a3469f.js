
(function(){
  if(window.__lumosNav) return; window.__lumosNav=1;
  var MOBILE = true;
  var LISTTARGET = 'amm-pool';     // blanket row target for pure list pages ('amm-pool'|'dex-asset'|'')
  var CONTAINERNAV = true;    // allow container-signal row nav (dex/amm/home)
  var LANDING = false;              // landing 'Pick a product' wiring
  var NAVMAP = {dashboard:'home',home:'home',trade:'dex',pools:'amm',bridge:'bridge',launchpad:'launch-token',lumos:'lumos-token',wallet:'wallet',settings:'user-settings',more:'user-settings',profile:'profile'};
  var TAB = {'24h':1,'7d':1,'30d':1,'all':1,'utility':1,'memes':1,'stables':1,'gainers':1,'losers':1,'volume':1,'most volume':1,'top gainers':1,'top losers':1,'overview':1,'holders':1,'assets':1,'liq pools':1,'positions':1,'all pools':1,'my positions':1,'orderbook':1,'limit':1,'market':1,'trades':1,'chart':1,'info':1,'activity':1,'open orders':1,'history':1,'en':1,'live':1,'1d':1,'1w':1,'1m':1,'1y':1};
  // in-page actions that must NEVER navigate (popups, wizards, trade actions)
  var ACTIONRE = /^(buy|sell|swap|send|receive|deposit|withdraw|approve|confirm|reject|max|half|claim|stake|unstake|harvest|copy|share|export|import|cancel|clear|edit|save|delete|remove|continue|review|submit|retry|wrap|unwrap|mint|connect wallet|disconnect|add liquidity|provide liquidity|remove liquidity|create pool|create a pool|new pool|create token|launch (?!a token)|add trustline|place order|set |select |choose |upload|browse|filter|sort|refresh|how it works|next|back|previous|skip|done|got it|close)/;
  function isDark(){var t=(document.documentElement.getAttribute('data-theme')||'').toLowerCase();if(t==='dark')return true;if(t==='light')return false;try{var c=getComputedStyle(document.body).backgroundColor.match(/\d+/g);if(c)return (0.299*+c[0]+0.587*+c[1]+0.114*+c[2])<128;}catch(e){}return true;}
  function cand(base){ var b='lumoscore-'+base; if(MOBILE) return [b+'-mobile.html']; return isDark()?[b+'-dark.html',b+'.html',b+'-light.html']:[b+'-light.html',b+'.html',b+'-dark.html']; }
  function nav(base){ try{var c=cand(base); var P=window.parent; if(P&&P!==window&&P.lxNavigate){ P.lxNavigate(c); return; } if(window.lxNavigate){ window.lxNavigate(c); return; } if(c&&c[0]) location.href=c[0]; }catch(e){} }
  function labelKey(node){ var t=((node.textContent||'').toLowerCase().replace(/[^a-z$ ]/g,'').replace(/\$/g,'')).trim(); var w=t.split(/\s+/).filter(Boolean); if(!w.length||w.length>2) return null; for(var i=0;i<w.length;i++) if(NAVMAP[w[i]]) return w[i]; return null; }
  function inNav(node){ var it=node; for(var i=0;i<4 && it.parentElement;i++){ var sib=[].slice.call(it.parentElement.children),seen={},h=0; for(var s=0;s<sib.length;s++){ var k=labelKey(sib[s]); if(k&&!seen[k]){seen[k]=1;h++;} } if(h>=3) return true; it=it.parentElement; } return false; }
  function navLabel(el){ var n=el,hop=0; while(n&&hop<5){ var k=labelKey(n); if(k && inNav(n)) return NAVMAP[k]; n=n.parentElement; hop++; } return null; }
  var BTNRULES=[[/^lumoscore$/,'home'],[/trade on dex/,'dex-asset'],[/start trading|launch app|open app/,'dex'],[/swap tokens/,'dex'],[/cross-chain bridge|cross chain bridge/,'bridge'],[/launch a token/,'launch-token'],[/view wallet|open wallet|go to wallet/,'wallet'],[/^amm pools$/,'amm'],[/^lumos token$/,'lumos-token'],[/^home$/,'home']]; function btnMatch(t){ t=(t||'').trim().toLowerCase(); if(!t) return null; var first=null,seen={},n=0; for(var i=0;i<BTNRULES.length;i++){ var m=t.match(BTNRULES[i][0]); if(!m) continue; var g=BTNRULES[i][1]; if(!seen[g]){seen[g]=1;n++;} if(!first) first={target:g,len:m[0].length}; } if(!first) return null; first.distinct=n; first.textLen=t.length; return first; } function btnTarget(t){ var m=btnMatch(t); return m?m.target:null; } function lxHere(t){ try{ var it=document.querySelectorAll('.nx-item[href],.nb-tab[href]'); for(var i=0;i<it.length;i++){ var _pt=(it[i].textContent||'').toLowerCase().split(/[^a-z0-9]+/); var lab=_pt[0]||_pt[1]||''; if(NAVMAP[lab]!==t) continue; var h=it[i].getAttribute('href')||''; if(!h) return false; var p=location.pathname; return p===h || p.indexOf(h+'/')===0 || h.indexOf(p+'/')===0; } }catch(_){} return false; }
  function landingTarget(el){
    var c=el.closest('[class*="product-card"]');
    if(c){ var ttl=c.querySelector('h1,h2,h3,h4,[class*="title"],[class*="ttl"],[class*="name"]'); var t=((ttl||c).textContent||'').toLowerCase();
      if(/bridge/.test(t)) return 'bridge';
      if(/wallet/.test(t)) return 'wallet';
      if(/launchpad/.test(t)) return 'launch-token';
      if(/amm|pool/.test(t)) return 'amm';
      if(/\bdex\b|exchange/.test(t)) return 'dex'; }
    var a=el.closest('a,button'); var at=((a||el).textContent||'').toLowerCase().trim();
    if(/see all tokens|view all tokens|all tokens on the dex|explore the dex/.test(at)) return 'dex';
    return null;
  }
  function rowTarget(el){
    if(!CONTAINERNAV && !LISTTARGET) return null;
    var r=el.closest('tr,li,[class*="row"],[class*="pair"],[class*="item"],[class*="card"]'); if(!r) return null;
    if(CONTAINERNAV){ var n=r,hop=0; while(n&&hop<7){ var s=((n.id||'')+' '+(typeof n.className==='string'?n.className:'')).toLowerCase();
        if(/pool/.test(s)&&!/(trend|mover|market|dex|trading)/.test(s)) return 'amm-pool';
        if(/(trend|mover|market|dex|trading)/.test(s)) return 'dex-asset'; n=n.parentElement; hop++; } }
    if(LISTTARGET) return LISTTARGET;
    return null;
  }
  document.addEventListener('click', function(e){
    try{
      var el=e.target; if(!el||!el.closest) return;
      if(el.closest('input,textarea,select,label')) return;
      if(el.closest('[data-lxnonav]')) return;
      var a0=el.closest('a[href]'); if(a0){ var h=a0.getAttribute('href')||''; if(/lumoscore-[\w-]+\.html$/.test(h)) return; }
      if(LANDING){ var lt=landingTarget(el); if(lt){ e.preventDefault(); e.stopImmediatePropagation(); nav(lt); return; } }
      var nt=navLabel(el); if(nt){ e.preventDefault(); e.stopImmediatePropagation(); nav(nt); return; }
      if(el.closest('[class*="toggle"],[class*="Toggle"],[class*="theme"],[class*="lang"],[class*="search"],[class*="switch"],[role="tab"],[role="switch"],[role="tablist"]')) return;
      var act=el.closest('button,a,[role="button"],[class*="btn"],[class*="Btn"]');
      var s=((act||el).textContent||'').trim(), low=s.toLowerCase();
      if(TAB[low]) return;
      if(low.length<=4 && /^[«»‹›\d.\s]+$/.test(low)) return;
      var lbl=act||el; var bm=btnMatch(s); if(bm && bm.distinct===1 && bm.len>=bm.textLen*0.12 && (act || !((lbl.querySelector&&lbl.querySelector('h1'))||(lbl.closest&&lbl.closest('h1')))) && !lxHere(bm.target)){ e.preventDefault(); e.stopImmediatePropagation(); nav(bm.target); return; }
      if(s.length<=28 && ACTIONRE.test(low)) return;   // in-page action → let the page handle it
      var rt=rowTarget(el); if(rt){ e.preventDefault(); e.stopImmediatePropagation(); nav(rt); return; }
    }catch(err){}
  }, true);
})();
