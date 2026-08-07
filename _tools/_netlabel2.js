const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);
const OLD=`'<div class="sp-name-row">' + a.tk + ' ' + domainBadge + ' ' + newBadge + '</div>'`;
const NEW=`'<div class="sp-name-row">' + a.tk + ' <span class="sp-net">' + ({stellar:'Stellar',hedera:'Hedera',aptos:'Aptos',starknet:'Starknet',vechain:'VeChain',worldchain:'World Chain',xrpl:'XRP Ledger'}[a.chain]||a.chain) + '</span> ' + domainBadge + ' ' + newBadge + '</div>'`;
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  const file=`lumoscore-${c}-desktop.html`;const data=read(file);const{json,s,e}=getContents(data);const k='lumoscore-landing.html';
  const had=json[k].indexOf(OLD)>=0; if(had) json[k]=json[k].split(OLD).join(NEW);
  const serialized=JSON.stringify(json).split('</').join('<'+B+'/');fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  console.log(c+': '+(had?'added net label to concat impl':'string not found'));
}
