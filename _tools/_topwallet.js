// Move the connected wallet (icon + address) from the sidebar foot to the top-right topbar so it stays
// visible even when the sidebar is collapsed. The bottom-left keeps ONLY a Disconnect button.
// Per page: extract the address (.nx-an) + avatar (.nx-av) from .nx-ident, build a topbar chip prepended
// into .topbar-right, and replace the whole .nx-acct with a Disconnect button. Address is read per page,
// so each chain shows its own format. Idempotent (keyed on .lx-topwallet).
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

// depth-matched <div class="CLS" ...> … </div> → {block,start,end} (first match) or null
function grabDiv(html,cls){
  const idx=html.indexOf('<div class="'+cls+'"');
  if(idx<0) return null;
  let i=html.indexOf('>',idx)+1, depth=1;
  while(depth>0){
    const n=html.indexOf('<div',i), c=html.indexOf('</div>',i);
    if(c<0) return null;
    if(n>=0&&n<c){depth++;i=n+4;} else {depth--;i=c+6;}
  }
  return {block:html.slice(idx,i), start:idx, end:i};
}

const LOGOUT_SVG='<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>';

const STYLE='<style id="lx-topwallet-css">'
+'.lx-topwallet{display:inline-flex;align-items:center;gap:9px;height:42px;padding:0 13px 0 7px;border-radius:12px;border:1px solid var(--border);background:var(--surface-2);cursor:pointer;transition:.16s;flex-shrink:0}'
+'.lx-topwallet:hover{border-color:var(--border-strong)}'
+'.lx-topwallet .lx-tw-av{width:28px;height:28px;border-radius:8px;flex-shrink:0;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#5b6bff,#8b5cf6)}'
+'.lx-topwallet .lx-tw-av svg{width:16px;height:16px}'
+".lx-topwallet .lx-tw-addr{font:600 13.5px/1 'JetBrains Mono','JetBrains Mono',monospace;color:var(--text);white-space:nowrap}"
+'.lx-topwallet .lx-tw-dot{width:7px;height:7px;border-radius:50%;background:var(--green,#35c07f);flex-shrink:0}'
+'.nx-logout{display:flex;align-items:center;gap:10px;width:100%;margin-top:7px;padding:9px 11px;border-radius:12px;border:1px solid var(--border);background:var(--surface-2);color:var(--text-soft);cursor:pointer;font:600 14px/1.1 inherit;transition:.16s;text-align:left}'
+'.nx-logout:hover{border-color:var(--border-strong);color:var(--text)}'
+'.nx-logout .nx-lo-ic{width:30px;height:30px;border-radius:9px;flex-shrink:0;display:grid;place-items:center;background:var(--bg);color:var(--text-soft)}'
+'.nx-side.nx-collapsed .nx-logout{justify-content:center;padding:9px 0;gap:0}'
+'@media (max-width:1080px){.lx-topwallet .lx-tw-addr{display:none}}'
+'</style>';

let n=0, skipped=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k];
      if(h.indexOf('class="lx-topwallet"')>=0){ skipped++; continue; }         // already done
      if(h.indexOf('class="nx-acct"')<0 || h.indexOf('class="topbar"')<0) continue;

      const acct=grabDiv(h,'nx-acct');
      if(!acct) continue;
      // extract address + avatar from the account block
      const addrM=acct.block.match(/class="nx-an"[^>]*>([^<]+)</);
      const avM=acct.block.match(/<span class="nx-av"[^>]*>([\s\S]*?)<\/span>/);
      if(!addrM) continue;
      const address=addrM[1].trim();
      const avInner=avM?avM[1]:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="6" width="18" height="13" rx="2"/><circle cx="17" cy="12.5" r="1.3"/></svg>';

      const chip='<button class="lx-topwallet" type="button" title="Connected wallet" onclick="if(window.__lxNav)__lxNav(\'lumoscore-wallet.html\')">'
        +'<span class="lx-tw-av">'+avInner+'</span><span class="lx-tw-addr">'+address+'</span><span class="lx-tw-dot" title="Connected"></span></button>';

      // find the topbar-right insertion point: home uses .topbar-right; other pages use a .grow spacer
      let at=-1;
      const trM=h.match(/<div class="topbar-right"[^>]*>/);
      if(trM){ at=trM.index+trM[0].length; }
      else { const gM=h.match(/<div class="grow">\s*<\/div>/); if(gM){ at=gM.index+gM[0].length; } }
      if(at<0) continue;   // no place to host the chip — leave the page untouched

      // 1) bottom-left: replace whole account block with a Disconnect button
      const logoutBtn='<button class="nx-logout" type="button" title="Disconnect wallet" onclick="event.stopPropagation();if(window.__lxNav)__lxNav(\'lumoscore-signin.html\')">'
        +'<span class="nx-lo-ic">'+LOGOUT_SVG+'</span><span class="nx-lab">Disconnect</span></button>';
      h=h.slice(0,acct.start)+logoutBtn+h.slice(acct.end);
      // (acct removal shifted indices; recompute the insertion point on the updated string)
      at=-1;
      const trM2=h.match(/<div class="topbar-right"[^>]*>/);
      if(trM2){ at=trM2.index+trM2[0].length; }
      else { const gM2=h.match(/<div class="grow">\s*<\/div>/); if(gM2){ at=gM2.index+gM2[0].length; } }
      if(at>=0){ h=h.slice(0,at)+chip+h.slice(at); }

      // 2) styles
      const bi=h.lastIndexOf('</body>'); if(bi>=0 && h.indexOf('id="lx-topwallet-css"')<0) h=h.slice(0,bi)+STYLE+h.slice(bi);
      json[k]=h; n++;
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('top-right wallet chip on '+n+' pages (skipped '+skipped+' already-done)');
