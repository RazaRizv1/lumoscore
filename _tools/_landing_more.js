const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);
const HDR=`<div class="search-box lx-nav-search"><svg class="s-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input placeholder="Search assets" readonly /></div>`;
const TEX1=`.why-card:nth-child(1)::before{content:"";position:absolute;inset:0;z-index:0;background:url("assets/prod-texture.png") no-repeat right top/150% auto;opacity:.5;-webkit-mask:radial-gradient(120% 110% at 100% 0,#000,transparent 66%);mask:radial-gradient(120% 110% at 100% 0,#000,transparent 66%)}`;
const TEX2=`html[data-theme="light"] .why-card:nth-child(1)::before{opacity:.7}`;
function removeDiv(h,openTag){var s=h.indexOf(openTag);if(s<0)return {h,hit:false};var i=h.indexOf('>',s)+1,d=1;while(d>0){var a=h.indexOf('<div',i),c=h.indexOf('</div>',i);if(c<0)break;if(a>=0&&a<c){d++;i=a+4}else{d--;i=c+6}}return {h:h.slice(0,s)+h.slice(i),hit:true};}
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  const file=`lumoscore-${c}-desktop.html`;const data=read(file);const{json,s,e}=getContents(data);const k='lumoscore-landing.html';
  let h=json[k];
  const hdr=h.indexOf(HDR)>=0; h=h.split(HDR).join('');
  const spfHit=h.indexOf('<div class="sp-filters" id="spFilters">')>=0; const r=removeDiv(h,'<div class="sp-filters" id="spFilters">'); h=r.h;
  const tex=h.indexOf(TEX1)>=0; h=h.split(TEX1).join('').split(TEX2).join('');
  json[k]=h;
  const serialized=JSON.stringify(json).split('</').join('<'+B+'/');fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  console.log(`${c}: headerSearch=${hdr} spFilters=${spfHit} bentoTexture=${tex}`);
}
