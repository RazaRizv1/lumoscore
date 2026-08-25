// Cross-Chain Bridge page — per-chain bridge wiring (user spec):
//   aptos: Wormhole+LayerZero | hedera: LayerZero | starknet: CCTP+LayerZero |
//   vechain: Wanchain | worldchain: CCTP+Wormhole+LayerZero  (stellar:CCTP / xrpl:Axelar have no site folder)
// 1) intro .sub sentence + "How it works" modal text name the actual bridge(s) for that source chain.
// 2) destination-network dropdown = the UNION of every network reachable via that chain's bridge(s)
//    (minus the source chain itself). Options use a colored lettermark chip + network name.
// NOTE: the per-bridge network lists below are a curated realistic set — adjust to match the live APIs.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

// network -> [brand color, short label]
const NET={
  'Ethereum':['#627eea','ETH'],'Solana':['#9945ff','SOL'],'Sui':['#4da2ff','SUI'],'Polygon':['#8247e5','POL'],
  'Avalanche':['#e84142','AVX'],'Arbitrum':['#28a0f0','ARB'],'Optimism':['#ff0420','OP'],'Base':['#0052ff','BASE'],
  'BNB Chain':['#f0b90b','BNB'],'Near':['#12b981','NEAR'],'Sei':['#9e1f19','SEI'],'Scroll':['#c9946a','SCR'],
  'Linea':['#121212','LIN'],'zkSync Era':['#1e69ff','ZK'],'Mantle':['#008f6b','MNT'],'Unichain':['#ff007a','UNI'],
  'Cardano':['#0033ad','ADA'],'Tron':['#ff060a','TRX'],'Moonbeam':['#e1147b','GLMR'],'Fantom':['#1969ff','FTM'],
  'Aptos':['#0b0b0b','APT'],'Hedera':['#222831','HBAR'],'VeChain':['#15bdff','VET'],'World Chain':['#1a1a1a','WLD'],
  'Starknet':['#0c0c4f','STRK'],'Stellar':['#111111','XLM'],'XRP Ledger':['#23292f','XRP']
};
// bridge -> supported networks
const BRIDGE={
  CCTP:['Ethereum','Arbitrum','Optimism','Base','Polygon','Avalanche','Solana','Aptos','Sui','World Chain','Linea','Unichain','Sei','Stellar'],
  Axelar:['Ethereum','Polygon','Avalanche','Arbitrum','Optimism','Base','BNB Chain','Fantom','Moonbeam','Sui','Linea','Sei','XRP Ledger','Stellar'],
  LayerZero:['Ethereum','Arbitrum','Optimism','Base','Polygon','Avalanche','BNB Chain','Aptos','Hedera','Scroll','Linea','zkSync Era','Mantle','Sei','Starknet'],
  Wormhole:['Ethereum','Solana','Aptos','Sui','Polygon','Avalanche','Arbitrum','Optimism','Base','BNB Chain','World Chain','Near','Sei','Scroll'],
  Wanchain:['Ethereum','BNB Chain','Polygon','Avalanche','Arbitrum','Optimism','VeChain','Cardano','Tron','XRP Ledger','Moonbeam']
};
// source chain -> {display name, bridges}
const CHAIN={
  aptos:{name:'Aptos',b:['Wormhole','LayerZero']},
  hedera:{name:'Hedera',b:['LayerZero']},
  starknet:{name:'Starknet',b:['CCTP','LayerZero']},
  vechain:{name:'VeChain',b:['Wanchain']},
  worldchain:{name:'World Chain',b:['CCTP','Wormhole','LayerZero']},
  stellar:{name:'Stellar',b:['CCTP']},
  xrpl:{name:'XRP Ledger',b:['Axelar']}
};

function fmtList(a){ if(a.length===1) return a[0]; if(a.length===2) return a[0]+' and '+a[1]; return a.slice(0,-1).join(', ')+' and '+a[a.length-1]; }
function destsFor(c){ const seen={},out=[]; CHAIN[c].b.forEach(function(br){ (BRIDGE[br]||[]).forEach(function(n){ if(n!==CHAIN[c].name && !seen[n]){seen[n]=1;out.push(n);} }); }); return out; }
function optHTML(name){ const m=NET[name]||['#667085',name.slice(0,3).toUpperCase()];
  return '<button class="brd-opt" type="button" data-net="'+name+'"><span class="brd-ic lx-netlm" style="background:'+m[0]+'">'+m[1]+'</span><span class="brd-nm">'+name+'</span></button>'; }
// depth-matched <div class="CLS" ...> … </div>
function grabDiv(html,cls){ const idx=html.indexOf('<div class="'+cls+'"'); if(idx<0) return null;
  let i=html.indexOf('>',idx)+1, depth=1;
  while(depth>0){ const n=html.indexOf('<div',i), c=html.indexOf('</div>',i); if(c<0) return null; if(n>=0&&n<c){depth++;i=n+4;} else {depth--;i=c+6;} }
  return {block:html.slice(idx,i), start:idx, end:i}; }

const SEARCHBOX='<div class="brd-search"><svg class="brd-sic" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><input class="brd-q" type="text" placeholder="Search network" spellcheck="false" autocomplete="off"><div class="brd-nohit" hidden>No networks found</div></div>';

const STYLE='<style id="lx-brdnet">'
+'.brd-menu{max-height:344px;overflow-y:auto}'
+'.brd-opt .brd-ic.lx-netlm{display:inline-flex !important;align-items:center;justify-content:center;width:26px;height:26px;min-width:26px;border-radius:50%;color:#fff;font:800 8.5px/1 \'Hanken Grotesk\',system-ui,sans-serif;letter-spacing:.01em;flex-shrink:0;overflow:hidden;background-clip:padding-box}'
// destination search box (sticky at top of the menu)
+'.brd-search{position:sticky;top:0;z-index:3;display:flex;align-items:center;gap:8px;padding:9px 11px;margin:-6px -6px 6px;background:var(--surface);border-bottom:1px solid var(--border);border-radius:14px 14px 0 0}'
+'.brd-search .brd-sic{color:var(--text-soft);flex:0 0 auto}'
+'.brd-q{flex:1;min-width:0;border:none;outline:none;background:transparent;color:var(--text);font:600 14.5px/1.2 \'Hanken Grotesk\',system-ui,sans-serif}'
+'.brd-q::placeholder{color:var(--text-soft);font-weight:500}'
+'.brd-nohit{display:none;padding:14px 12px;text-align:center;color:var(--text-soft);font-size:13.5px;font-weight:600}'
+'.brd-nohit[data-on]{display:block}'
// selected-network lettermark/logo on the trigger (its .br-ic has font-size:0, so give it its own)
+'.br-ic .lx-netlm2{display:flex;width:100%;height:100%;align-items:center;justify-content:center;color:#fff;border-radius:50%;font:800 11px/1 \'Hanken Grotesk\',system-ui,sans-serif;letter-spacing:.01em;overflow:hidden}'
+'.br-ic .lx-netlm2 img,.br-ic .lx-netlm2 svg{width:100%;height:100%;object-fit:cover;border-radius:50%;display:block}'
+'</style>';

// runtime: filter options as you type + reset on open (icon copy is fixed in the native handler below)
const DROPJS='<script id="lx-brdnetjs">(function(){function boot(){var d=document.querySelector(".brd");if(!d)return;var t=d.querySelector(".brd-trigger"),menu=d.querySelector(".brd-menu"),srch=menu&&menu.querySelector(".brd-search"),q=srch&&srch.querySelector(".brd-q"),nohit=srch&&srch.querySelector(".brd-nohit");if(!q)return;'
+'srch.addEventListener("click",function(e){e.stopPropagation();});'
+'function apply(){var v=q.value.trim().toLowerCase(),shown=0;d.querySelectorAll(".brd-opt").forEach(function(o){var n=(o.getAttribute("data-net")||"").toLowerCase();var ok=!v||n.indexOf(v)>=0;o.style.display=ok?"":"none";if(ok)shown++;});if(nohit)nohit.setAttribute("data-on",shown?"":"1"),shown?nohit.removeAttribute("data-on"):nohit.setAttribute("data-on","1");}'
+'q.addEventListener("input",apply);q.addEventListener("keydown",function(e){if(e.key==="Escape"){q.value="";apply();}});'
+'t.addEventListener("click",function(){setTimeout(function(){if(d.classList.contains("open")){q.value="";apply();try{q.focus();}catch(_){}}},20);});'
+'return true;}var n=0,iv=setInterval(function(){if(boot()||++n>30)clearInterval(iv);},200);})();</script>';

let n=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain','stellar','xrpl']){
  const cfg=CHAIN[c]; const bridgeStr=fmtList(cfg.b);
  const dests=destsFor(c).sort(function(a,b){return a.localeCompare(b);}); // sort A-Z
  const menuInner=SEARCHBOX+dests.map(optHTML).join('');
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      if(!/bridge/.test(k)) continue;
      let h=json[k]; const before=h;
      // (a) intro sentence + HIW text
      h=h.replace(/Swap assets seamlessly between networks via [^<]*/,'Swap assets seamlessly between networks via '+bridgeStr+'.');
      h=h.replace(/Cross-chain transfers via [^<]*/,'Cross-chain transfers via '+bridgeStr+'.');
      h=h.replace(/bridging between \([^)]*\)/,'bridging between ('+cfg.name+' and your destination network)');
      h=h.replace(/Transfers route through .*?, so you receive/,'Transfers route through '+bridgeStr+', so you receive');
      // (b) destination dropdown options (with sticky search box)
      const menu=grabDiv(h,'brd-menu');
      if(menu){ const open=menu.block.slice(0,menu.block.indexOf('>')+1); h=h.slice(0,menu.start)+open+menuInner+'</div>'+h.slice(menu.end); }
      // (c) selected-network icon: the native handler copies the option's bare ticker text into the
      //     trigger's .br-ic (font-size:0 → invisible). Rewrite it to render a full lettermark/logo.
      h=h.replace(/if\(ic\)ic\.innerHTML=o\.querySelector\("\.brd-ic"\)\.innerHTML;/,
        'if(ic)ic.innerHTML=(function(_c){if(!_c)return"";if(_c.querySelector("img,svg"))return \'<span class="lx-netlm2">\'+_c.innerHTML+\'</span>\';return \'<span class="lx-netlm2" style="background:\'+_c.style.background+\'">\'+_c.textContent+\'</span>\';})(o.querySelector(".brd-ic"));');
      // style + dropdown search script (strip prior, re-inject fresh → idempotent)
      h=h.replace(/<style id="lx-brdnet">[\s\S]*?<\/style>/g,'').replace(/<script id="lx-brdnetjs">[\s\S]*?<\/script>/g,'');
      { const bi=h.lastIndexOf('</body>'); if(bi>=0) h=h.slice(0,bi)+STYLE+DROPJS+h.slice(bi); }
      if(h!==before){ json[k]=h; n++; }
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('bridge per-chain (sub + HIW + destinations) on '+n+' pages');
for(const c of Object.keys(CHAIN)) console.log('  '+c+' ['+CHAIN[c].b.join('+')+'] -> '+destsFor(c).length+' destinations: '+destsFor(c).join(', '));
