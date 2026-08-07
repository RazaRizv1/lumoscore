// RECOVERY: _wallet_logos.js replaced ALL .opt-card .ico (including NETWORK cards) with lettermark+img,
// removing the network logos. Restore every opt-card's original .ico (matched by its .oc-nm name)
// from the pre-change backup. Also strip the lx-wl-css injected by that transform.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);
const BACKUP='_backup_prelivemarket';

function icoMap(page){
  const map={};
  page.replace(/<span class="ico"([^>]*)>([\s\S]*?)<\/span>\s*<span class="oc-nm">([^<]+)<\/span>/g,
    function(m,attrs,inner,name){ map[name.trim()]='<span class="ico"'+attrs+'>'+inner+'</span>'; return m; });
  return map;
}

let restored=0, pages=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    let bdata; try{ bdata=fs.readFileSync(BACKUP+'/'+file,'utf8'); }catch(e){ bdata=null; }
    const {json,s,e}=getContents(data);
    const bjson = bdata ? getContents(bdata).json : {};
    for(const k of Object.keys(json)){
      let h=json[k];
      if(h.indexOf('lx-wimg')<0) continue;             // nothing broken here
      const before=h;
      const bp=bjson[k];
      if(bp){
        const map=icoMap(bp);
        // replace the broken lettermark+img .ico with the original .ico, matched by adjacent oc-nm name
        h=h.replace(/<span class="ico"[^>]*><span class="lx-wl">[^<]*<\/span><img class="lx-wimg"[^>]*><\/span>(\s*<span class="oc-nm">([^<]+)<\/span>)/g,
          function(m,tail,name){ const o=map[name.trim()]; if(o){restored++;return o+tail;} return m; });
      }
      // strip the lx-wl css block injected by _wallet_logos (harmless leftover)
      h=h.replace(/<style id="lx-wl-css">[\s\S]*?<\/style>/g,'');
      if(h!==before){ json[k]=h; pages++; }
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('recovered '+restored+' opt-card icons on '+pages+' pages');
