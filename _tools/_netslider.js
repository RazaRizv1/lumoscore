const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);
const STYLE='<style id="lx-netslider">'
+'.lx-netmq{padding:56px 0 60px}'
+'.lx-mq-track{gap:16px !important;animation-play-state:running !important;animation-duration:46s !important}'
+'.lx-mq-vp:hover .lx-mq-track{animation-play-state:paused !important}'
+'.lx-mq-item{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:11px 22px 11px 13px;box-shadow:0 6px 18px -12px rgba(0,0,0,.35);color:var(--text) !important;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}'
+'.lx-mq-item:hover{transform:translateY(-3px);border-color:var(--accent-soft,rgba(234,106,44,.45)) !important;box-shadow:0 16px 34px -18px rgba(234,106,44,.5)}'
+'.lx-mq-ico{width:34px !important;height:34px !important}'
+'.lx-mq-name{font-size:16px !important;font-weight:700 !important;color:var(--text) !important}'
+'@media (prefers-reduced-motion:reduce){.lx-mq-track{animation-play-state:paused !important}}'
+'</style>';
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  const file=`lumoscore-${c}-desktop.html`;const data=read(file);const{json,s,e}=getContents(data);const k='lumoscore-landing.html';
  if(json[k].indexOf('id="lx-netslider"')<0){const bi=json[k].lastIndexOf('</body>');json[k]=bi>=0?json[k].slice(0,bi)+STYLE+json[k].slice(bi):json[k]+STYLE;}
  const serialized=JSON.stringify(json).split('</').join('<'+B+'/');fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
}
console.log('network slider restyled');
