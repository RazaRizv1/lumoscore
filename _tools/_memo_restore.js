// Restore the Send-popup Memo field on HEDERA only (Hedera natively supports on-chain memos).
// Other chains stay memo-free. Inserts the original field right after the Recipient-address field.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const MEMO='<div class="field">\n          <div class="field-label">Memo <span class="meta">Optional</span></div>\n          <input class="field-input" placeholder="Add a note (visible on-chain)" />\n        </div>';
const ANCHOR='placeholder="G... or domain.com*username" />';

let restored=0;
for(const dev of ['desktop','mobile']){
  const file=`lumoscore-hedera-${dev}.html`;
  let data; try{ data=read(file); }catch(e){ continue; }
  const {json,s,e}=getContents(data);
  for(const k of Object.keys(json)){
    let h=json[k];
    if(h.indexOf('Add a note (visible on-chain)')>=0) continue;   // already has memo
    const ai=h.indexOf(ANCHOR); if(ai<0) continue;                // no send-popup recipient field
    // insert after the recipient field's closing </div>
    const closeDiv=h.indexOf('</div>', ai); if(closeDiv<0) continue;
    const insertAt=closeDiv+6;
    h=h.slice(0,insertAt)+'\n        '+MEMO+h.slice(insertAt);
    json[k]=h; restored++;
  }
  const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
  fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
}
console.log('restored memo on '+restored+' hedera page(s)');
