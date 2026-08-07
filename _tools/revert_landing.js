const fs=require('fs');
const {read,getContents}=require(__dirname+'/lib.js');
const {restyle}=require(__dirname+'/restyle.js');
const B=String.fromCharCode(92);
const POLISH={'#ff6a1a':'#ea6a2c','#f97316':'#ff894c'};
function polishColors(html){let out=html;for(const f of Object.keys(POLISH)){out=out.replace(new RegExp(f,'gi'),POLISH[f]);}return out;}
const chains=['aptos','hedera','starknet','vechain','worldchain'];
const write=process.argv.includes('--write');
for(const c of chains){
  const bak=read(`_backup_navfixed/lumoscore-${c}-desktop.html`);
  const landingRaw=getContents(bak).json['lumoscore-landing.html'];
  if(!landingRaw){console.log(c,'NO LANDING IN BACKUP');continue;}
  const restyled=polishColors(restyle(landingRaw).out);
  const liveFile=`lumoscore-${c}-desktop.html`;
  const data=read(liveFile);
  const {json,s,e}=getContents(data);
  const before=(json['lumoscore-landing.html']||'').length;
  json['lumoscore-landing.html']=restyled;
  const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
  const out=data.slice(0,s)+serialized+data.slice(e);
  if(write){fs.writeFileSync(liveFile,out,'utf8');}
  console.log((write?'[WROTE] ':'[DRY] ')+c, 'landing', before,'->',restyled.length);
}
