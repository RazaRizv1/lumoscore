// #10 Replace placeholder logo chips with real token logos by tagging them data-logo="<ticker>".
// The existing in-page LOGOS applier then swaps in the real logo (18 known tickers) and leaves the
// initial/letter fallback for unknown tickers. Covers: New Mints (Trade), pool pair chips (Pools),
// swap-box chips (Trade asset). Idempotent: skips chips that already carry data-logo.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const LOGOFIX='<script id="lx-logofix">(function(){function ok(bg){return bg&&bg.indexOf("url(")>=0&&bg.indexOf("null")<0&&bg.indexOf(\'url("")\')<0&&bg.indexOf("url()")<0;}function fix(){var els=document.querySelectorAll(\'.pa[data-logo],.pb[data-logo],.dex-mint-ic[data-logo],.dxa-trade-ic[data-logo]\');for(var i=0;i<els.length;i++){var el=els[i];if(el.getAttribute("data-lxfixed"))continue;var bg=el.style.backgroundImage||"";if(ok(bg)){el.textContent="";el.style.background="transparent";el.style.backgroundImage=bg;el.style.backgroundSize="contain";el.style.backgroundPosition="center";el.style.backgroundRepeat="no-repeat";el.style.boxShadow="none";el.setAttribute("data-lxfixed","1");}else if(bg&&bg.indexOf("null")>=0){el.style.backgroundImage="none";}}}function boot(){fix();var n=0,iv=setInterval(function(){fix();if(++n>12)clearInterval(iv);},300);try{new MutationObserver(fix).observe(document.body,{attributes:true,attributeFilter:["style"],subtree:true});}catch(e){}}if(document.readyState!=="loading")boot();else document.addEventListener("DOMContentLoaded",boot);})();</script>';

function firstTk(name){ return (name.split('/')[0]||'').trim().toUpperCase(); }
function secondTk(name){ var p=name.split('/'); return ((p[1]||'').trim()).toUpperCase(); }

let stats={mints:0, pairs:0, swap:0};
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k]; const before=h;
      // strip prior normalizer so an updated version can be re-injected
      h=h.replace(/<script id="lx-logofix">[\s\S]*?<\/script>/g,'');

      // 1) New Mints chip -> data-logo from the full ticker m.tk
      h=h.replace(/<span class="dex-mint-ic" style="background:' \+ m\.b \+ '">/g,
        ()=>{stats.mints++;return '<span class="dex-mint-ic" data-logo="\' + m.tk + \'" style="background:\' + m.b + \'">';});

      // 2) Pools pair chips -> data-logo from the pair name (base=pa, quote=pb)
      h=h.replace(/<div class="pair-icons">\s*<div class="pa"([^>]*)>([\s\S]*?)<\/div>\s*<div class="pb"([^>]*)>([\s\S]*?)<\/div>\s*<\/div>\s*<div>\s*<div class="pair-name">([^<]+)<\/div>/g,
        function(m, pa, paIn, pb, pbIn, name){
          if(/data-logo/.test(pa)||/data-logo/.test(pb)) return m;
          var base=firstTk(name), quote=secondTk(name);
          stats.pairs++;
          return '<div class="pair-icons"><div class="pa"'+pa+' data-logo="'+base+'">'+paIn+'</div><div class="pb"'+pb+' data-logo="'+quote+'">'+pbIn+'</div></div><div><div class="pair-name">'+name+'</div>';
        });

      // 2b) give pair chips a correct fallback initial (unresolved tickers show the right letter, not a random one)
      h=h.replace(/(<div class="pa"[^>]*data-logo="([A-Z0-9]+)"[^>]*>)[^<]*(<\/div>)/g, (m,pre,tk,post)=>pre+tk.charAt(0)+post);
      h=h.replace(/(<div class="pb"[^>]*data-logo="([A-Z0-9]+)"[^>]*>)[^<]*(<\/div>)/g, (m,pre,tk,post)=>pre+tk.charAt(0)+post);

      // 3) Swap-box chips -> data-logo from the ticker text that follows the chip
      h=h.replace(/<span class="dxa-trade-ic"((?:(?!data-logo)[^>])*)>([\s\S]*?)<\/span>(\s*)([A-Z][A-Z0-9]{1,7})/g,
        function(m, attrs, inner, ws, tk){
          stats.swap++;
          return '<span class="dxa-trade-ic" data-logo="'+tk+'"'+attrs+'>'+inner+'</span>'+ws+tk;
        });

      // normalizer: theme-mode logos get a bg-image but keep their placeholder letter — finish the swap
      if((h.indexOf('data-logo="')>=0) && h.indexOf('id="lx-logofix"')<0 &&
         /class="(pa|pb|dex-mint-ic|dxa-trade-ic)"/.test(h)){
        const bi=h.lastIndexOf('</body>');
        if(bi>=0){ h=h.slice(0,bi)+LOGOFIX+h.slice(bi); }
      }
      if(h!==before) json[k]=h;
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('logos tagged:', JSON.stringify(stats));
