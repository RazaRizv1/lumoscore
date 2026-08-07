// Patch the top-right wallet chip:
//  (a) avatar shows the CONNECTED NETWORK's logo (extracted from the signin data-net-id card) instead of
//      the generic wallet glyph;
//  (b) a Copy button sits beside the address (copies the full address found on the wallet page);
//  (c) the bottom-left Disconnect icon is red.
// The chip is rebuilt from <button> to <div> so the copy <button> can nest legally. Idempotent (skips if
// a .lx-tw-copy already exists). Desktop pages only (mobile has no chip).
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);
const ELL=String.fromCharCode(0x2026); // …

// inner markup of the .ico span on the signin network card for `chain`
function netLogo(signin,chain){
  const i=signin.indexOf('data-net-id="'+chain+'"'); if(i<0) return null;
  const st=signin.indexOf('<span class="ico"',i); if(st<0) return null;
  let j=signin.indexOf('>',st)+1, depth=1;
  while(depth>0){ const n=signin.indexOf('<span',j), c=signin.indexOf('</span>',j); if(c<0) break; if(n>=0&&n<c){depth++;j=n+5;} else {depth--;j=c+7;} }
  const full=signin.slice(st,j);
  return full.slice(full.indexOf('>')+1, full.lastIndexOf('</span>')).trim();
}
function esc(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
function fullAddr(walletHtml, truncated){
  if(!truncated) return truncated;
  if(truncated.indexOf(ELL)<0) return truncated;               // not truncated (e.g. Hedera 0.0.x)
  const p=truncated.split(ELL); const pre=p[0], suf=p[1]||'';
  const m=walletHtml.match(new RegExp('data-copy="('+esc(pre)+'[^"]*'+esc(suf)+')"'));
  return m?m[1]:truncated;
}

const COPY_SVG='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

const STYLE='<style id="lx-walletchip2-css">'
+'.lx-topwallet .lx-tw-av{background:transparent !important;overflow:hidden;padding:0}'
+'.lx-topwallet .lx-tw-av img,.lx-topwallet .lx-tw-av svg{width:100%;height:100%;border-radius:8px;object-fit:cover;display:block}'
+'.lx-tw-copy{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:7px;border:1px solid var(--border);background:transparent;color:var(--text-soft);cursor:pointer;flex-shrink:0;padding:0;transition:.14s}'
+'.lx-tw-copy:hover{color:var(--text);border-color:var(--border-strong)}'
+'.lx-tw-copy.ok{color:var(--green,#35c07f);border-color:var(--green,#35c07f)}'
+'.nx-logout .nx-lo-ic{color:#e5484d;background:rgba(229,72,77,.12)}'
+'.nx-logout:hover{border-color:#e5484d}.nx-logout:hover .nx-lab{color:#e5484d}'
+'</style>';

const SCRIPT='<script id="lx-chipcopy">(function(){'
+'var CK=\'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>\';'
+'document.addEventListener("click",function(e){var b=e.target&&e.target.closest?e.target.closest(".lx-tw-copy"):null;if(!b)return;e.stopPropagation();e.preventDefault();'
+'var t=b.getAttribute("data-copy")||"";try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t);}else{var ta=document.createElement("textarea");ta.value=t;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);}}catch(_){}'
+'if(b.__lxc)return;var old=b.innerHTML;b.__lxc=1;b.classList.add("ok");b.innerHTML=CK;setTimeout(function(){b.innerHTML=old;b.classList.remove("ok");b.__lxc=0;},1200);},true);'
+'})();</script>';

let n=0, skipped=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  const file=`lumoscore-${c}-desktop.html`;
  let data; try{ data=read(file); }catch(e){ continue; }
  const {json,s,e}=getContents(data);
  const logo=netLogo(json['lumoscore-signin.html']||'', c) || '';
  const wallet=json['lumoscore-wallet.html']||'';
  for(const k of Object.keys(json)){
    let h=json[k];
    if(h.indexOf('class="lx-topwallet"')<0) continue;
    if(h.indexOf('lx-tw-copy')>=0){ skipped++; continue; }        // already patched
    // rebuild the chip button -> div with network logo + copy button
    h=h.replace(/<button class="lx-topwallet"([^>]*)>([\s\S]*?)<\/button>/, function(m, attrs, inner){
      const onclick=(attrs.match(/onclick="([^"]*)"/)||[])[1]||'';
      const title=(attrs.match(/title="([^"]*)"/)||[])[1]||'Connected wallet';
      const truncated=(inner.match(/lx-tw-addr">([^<]+)</)||[])[1]||'';
      const full=fullAddr(wallet, truncated);
      const av=logo?logo:(inner.match(/<span class="lx-tw-av">([\s\S]*?)<\/span>/)||[])[1]||'';
      const copyBtn='<button class="lx-tw-copy" type="button" title="Copy address" data-copy="'+full+'" onclick="event.stopPropagation()">'+COPY_SVG+'</button>';
      return '<div class="lx-topwallet" role="button" tabindex="0" title="'+title+'"'+(onclick?' onclick="'+onclick+'"':'')+'>'
        +'<span class="lx-tw-av">'+av+'</span>'
        +'<span class="lx-tw-addr">'+truncated+'</span>'
        +copyBtn
        +'<span class="lx-tw-dot" title="Connected"></span></div>';
    });
    const bi=h.lastIndexOf('</body>');
    if(bi>=0){
      let add='';
      if(h.indexOf('id="lx-walletchip2-css"')<0) add+=STYLE;
      if(h.indexOf('id="lx-chipcopy"')<0) add+=SCRIPT;
      if(add) h=h.slice(0,bi)+add+h.slice(bi);
    }
    json[k]=h; n++;
  }
  const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
  fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
}
console.log('wallet chip patched (network logo + copy + red disconnect) on '+n+' pages (skipped '+skipped+')');
