// AUDIT (navigation): the admin sidebar ships 10 sections but only 7 pages exist. "Trades", "Pools" and
// "LUMOS Incentives" point at lumoscore-admin-{trades,pools,incentives}[-dark].html, none of which were ever
// built — 6 dead targets linked from 7 admin pages each, so every one of them is a guaranteed 404.
//
// Removing the entries beats neutralising them: a sidebar item that silently does nothing reads as a broken
// app, and fabricating three admin screens would be inventing product. If those sections do get built later,
// delete this transform (or drop the names from DEAD) and the design's own markup comes straight back.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const DEAD=['trades','pools','incentives'];
// the design's nav entry: <a class="adn-item " href="lumoscore-admin-X.html" data-tip="…"> …svg… <span…>…</span> </a>
// lazy up to the first </a> — these anchors never nest another one.
const RE=new RegExp('<a class="adn-item[^"]*"\\s+href="lumoscore-admin-(?:'+DEAD.join('|')+')(?:-dark|-mobile|-light)?\\.html"[\\s\\S]*?<\\/a>\\s*','g');
// the admin DASHBOARD also hangs "View all →" / "Manage →" links off its Recent Activity and LUMOS
// Incentives cards, pointing at the same two missing pages. Drop just the link — the cards keep their data.
const RE_LINK=new RegExp('<a class="af-link"[^>]*href="lumoscore-admin-(?:'+DEAD.join('|')+')(?:-dark|-mobile|-light)?\\.html"[^>]*>[\\s\\S]*?<\\/a>\\s*','g');

let n=0, keys=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain','stellar','xrpl']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    let changed=false;
    for(const k of Object.keys(json)){
      const h=json[k];
      if(h.indexOf('adn-item')<0) continue;              // not an admin page
      const out=h.replace(RE,'').replace(RE_LINK,'');
      if(out!==h){ json[k]=out; changed=true; keys++; n+=(h.length-out.length>0?1:0); }
    }
    if(changed){ const serialized=JSON.stringify(json).split('</').join('<'+B+'/'); fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8'); }
  }
}
console.log('admin nav: removed dead Trades/Pools/Incentives entries on '+keys+' page keys');
