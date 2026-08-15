// "Built for users" section: 4-col bento + fuller premium constellation (cell 1), refined corner
// motifs (cells 2-6), more distinctive/relevant card icons (uniform ember chips), and fee copy fix.
// Idempotent: keyed on <style id="lx-whybento"> / <script id="lx-whyart">.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const STYLE='<style id="lx-whybento">'
+'.why-grid{display:grid !important;grid-template-columns:repeat(4,1fr) !important;grid-auto-rows:minmax(150px,1fr) !important;gap:14px !important;max-width:1080px;margin:0 auto}'
+'.why-card{position:relative !important;overflow:hidden !important;display:flex !important;flex-direction:column}'
+'.why-card:hover{transform:translateY(-3px);border-color:var(--accent-soft,rgba(234,106,44,.28)) !important;box-shadow:0 20px 44px -24px rgba(234,106,44,.4)}'
+'.why-card:nth-child(1){grid-column:span 2;grid-row:span 2;background:radial-gradient(120% 90% at 78% 22%,rgba(234,106,44,.13),transparent 60%),var(--surface)}'
+'.why-card:nth-child(2),.why-card:nth-child(5),.why-card:nth-child(6){grid-column:span 2}'
+'.why-card>*{position:relative;z-index:1}'
+'.why-card:nth-child(1) h3{font-size:25px !important;margin-top:auto}'
+'.why-card:nth-child(1) .ic-why{width:56px !important;height:56px !important;border-radius:15px}'
+'.why-card:nth-child(1) .ic-why svg{width:28px !important;height:28px !important}'
+'.why-card:nth-child(1) p{font-size:15px !important;max-width:34ch}'
// uniform ember chips
+'.why-card .ic-why{background:linear-gradient(140deg,#ffeadb,#ffd0ab) !important;color:#e05e1f !important;box-shadow:0 6px 16px -8px rgba(224,94,31,.5)}'
// constellation
+'.cst{position:absolute;inset:0;z-index:0;pointer-events:none;-webkit-mask:linear-gradient(180deg,#000 0,#000 54%,transparent 84%);mask:linear-gradient(180deg,#000 0,#000 54%,transparent 84%)}'
+'.cst svg{position:absolute;inset:0;width:100%;height:100%}'
+'@keyframes cstCore{0%,100%{opacity:.7;transform:scale(1)}50%{opacity:1;transform:scale(1.05)}}'
+'@keyframes cstRing{0%{opacity:.55;transform:scale(.5)}75%{opacity:0}100%{opacity:0;transform:scale(1.6)}}'
+'@keyframes cstTwinkle{0%,100%{opacity:.55}50%{opacity:1}}'
+'.cst-core{transform-origin:center;transform-box:fill-box;animation:cstCore 3.4s ease-in-out infinite}'
+'.cst-ring{transform-origin:center;transform-box:fill-box;fill:none;stroke:var(--accent);stroke-width:1.1;animation:cstRing 3.6s ease-out infinite}'
+'.cst-node{animation:cstTwinkle 3s ease-in-out infinite}'
+'.cst-mesh{stroke:var(--accent);opacity:.14;stroke-width:1}'
+'.cst-fila{fill:none;stroke:url(#cstL);stroke-width:1.3}'
+'@media(prefers-reduced-motion:reduce){.cst-core,.cst-ring,.cst-node{animation:none}}'
// motifs
+'.mcn-motif{position:absolute;top:0;right:0;width:120px;height:120px;z-index:0;pointer-events:none;color:var(--accent);-webkit-mask:radial-gradient(120% 120% at 100% 0,#000 32%,transparent 76%);mask:radial-gradient(120% 120% at 100% 0,#000 32%,transparent 76%)}'
+'.mcn-motif svg{width:100%;height:100%;display:block}'
+'.mcn-motif .st{fill:none;stroke:currentColor;stroke-width:2.1;stroke-linecap:round;stroke-linejoin:round;opacity:.52}'
+'.mcn-motif .st.dim{opacity:.28}'
+'.mcn-motif .fl{fill:var(--accent-2,#ff894c);opacity:.5}'
+'.mcn-motif .dot{fill:var(--accent-2,#ff894c)}'
+'@keyframes mDash{to{stroke-dashoffset:-16}}'
+'@keyframes mBlink{0%,100%{opacity:.4}50%{opacity:.95}}'
+'.mcn-motif .flow{stroke-dasharray:3 5;animation:mDash 1.5s linear infinite}'
+'.mcn-motif .blink{animation:mBlink 2.6s ease-in-out infinite}'
+'@media(prefers-reduced-motion:reduce){.mcn-motif .flow,.mcn-motif .blink{animation:none}}'
+'</style>';

const SCRIPT=`<script id="lx-whyart">(function(){
var NETS=["Hedera","Aptos","Starknet","VeChain","World Chain","XRP Ledger","Stellar"];
function constellation(){
  var CX=372,CY=150,W=520,H=470,n=NETS.length,pts=[],a0=2.15,a1=4.55;
  for(var i=0;i<n;i++){var t=n>1?i/(n-1):.5,ang=a0+(a1-a0)*t,rad=(i%2?205:150)+(i%3)*16;pts.push([CX+Math.cos(ang)*rad,CY+Math.sin(ang)*rad,2.7+(i%3)*1.1,(i*0.3).toFixed(2)]);}
  var fil="",mesh="",node="";
  for(var i=0;i<pts.length;i++){var p=pts[i],x=p[0].toFixed(1),y=p[1].toFixed(1),r=p[2].toFixed(1),d=p[3];
    fil+='<path class="cst-fila" d="M'+x+" "+y+" L"+CX+" "+CY+'"/>';
    node+='<circle class="cst-node" style="animation-delay:'+d+'s" cx="'+x+'" cy="'+y+'" r="'+r+'" fill="var(--accent-2,#ff894c)"/>';
    node+='<circle cx="'+x+'" cy="'+y+'" r="'+(p[2]+3.2).toFixed(1)+'" fill="none" stroke="var(--accent)" stroke-width="1" opacity=".3"/>';
    if(i<pts.length-1){var q=pts[i+1];mesh+='<line class="cst-mesh" x1="'+x+'" y1="'+y+'" x2="'+q[0].toFixed(1)+'" y2="'+q[1].toFixed(1)+'"/>';}}
  return '<div class="cst"><svg viewBox="0 0 '+W+" "+H+'" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs>'
    +'<linearGradient id="cstL" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--accent-2,#ff894c)" stop-opacity=".12"/><stop offset="1" stop-color="var(--accent)" stop-opacity=".85"/></linearGradient>'
    +'<radialGradient id="cstC"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="var(--accent-2,#ff894c)"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></radialGradient></defs>'
    +mesh+fil+node
    +'<circle class="cst-ring" cx="'+CX+'" cy="'+CY+'" r="18"/><circle class="cst-ring" cx="'+CX+'" cy="'+CY+'" r="18" style="animation-delay:1.8s"/>'
    +'<circle class="cst-core" cx="'+CX+'" cy="'+CY+'" r="30" fill="url(#cstC)"/>'
    +'<circle cx="'+CX+'" cy="'+CY+'" r="8" fill="var(--accent-2,#ff894c)"/><circle cx="'+CX+'" cy="'+CY+'" r="3.4" fill="#fff"/></svg></div>';
}
function motif(k){var g={
  lock:'<rect class="st" x="52" y="30" width="36" height="26" rx="5"/><path class="st" d="M58 30v-6a12 12 0 0 1 24 0v6"/><circle class="dot" cx="70" cy="41" r="3.2"/><path class="st" d="M70 44v6"/>',
  fees:'<circle class="st" cx="70" cy="33" r="18"/><path class="st" d="M77 26 63 40"/><circle class="st dim" cx="64" cy="28" r="3.2"/><circle class="st dim" cx="76" cy="38" r="3.2"/><path class="st dim" d="M58 58l12 8 12-8"/>',
  pulse:'<path class="st flow" d="M36 42h9l5-18 7 32 6-22 5 10h16"/><circle class="dot blink" cx="92" cy="34" r="3.4"/>',
  ui:'<rect class="st" x="44" y="16" width="48" height="34" rx="6"/><path class="st dim" d="M44 26h48"/><circle class="dot" cx="49" cy="21" r="1.7"/><path class="st dim" d="M50 34h14M50 42h22"/><path class="st" d="M74 40l7 3-3 1-1 3z"/>',
  chain:'<rect class="st" x="47" y="21" width="27" height="16" rx="8" transform="rotate(-32 60 29)"/><rect class="st" x="64" y="31" width="27" height="16" rx="8" transform="rotate(-32 77 39)"/>'};
  return '<div class="mcn-motif"><svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">'+(g[k]||"")+'</svg></div>';
}
function art(k){return k==="const"?constellation():motif(k);}
var ICG={
  network:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2.4"/><circle cx="5" cy="18" r="2.4"/><circle cx="19" cy="18" r="2.4"/><path d="M12 7.4v4.3M10.4 13.2 6.6 16M13.6 13.2 17.4 16"/><circle cx="12" cy="12.5" r="1.2" fill="currentColor" stroke="none"/></svg>',
  key:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 21 2M16 7l3 3M14 9l3 3"/></svg>',
  pct:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>',
  signal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 8a10 10 0 0 1 15 0M7.5 11.5a6 6 0 0 1 9 0"/><circle cx="12" cy="16" r="1.6" fill="currentColor" stroke="none"/><path d="M12 16v3"/></svg>',
  sliders:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/><circle cx="9" cy="8" r="2.4" fill="#ffeadb"/><circle cx="15" cy="16" r="2.4" fill="#ffeadb"/></svg>',
  verified:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V5z"/><polyline points="9 12 11 14 15 9.5"/></svg>'
};
var cards=document.querySelectorAll("#why .why-card");if(!cards.length)cards=document.querySelectorAll(".why-grid .why-card");
var order=["const","lock","fees","pulse","ui","chain"];
var icons=["network","key","pct","signal","sliders","verified"];
for(var j=0;j<cards.length&&j<order.length;j++){
  if(!cards[j].querySelector(".cst,.mcn-motif")) cards[j].insertAdjacentHTML("afterbegin",art(order[j]));
  var chip=cards[j].querySelector(".ic-why"); if(chip&&ICG[icons[j]]) chip.innerHTML=ICG[icons[j]];
}
})();</script>`;

// fee copy update (#2)
const FEE_OLD='A flat 0.2% on trades and swaps. No hidden costs, no surprise fees, no premium tiers — every user gets the same fair price.';
const FEE_NEW='0.2% on trades and swaps — hold 250K LUMOS and it drops to 0.1%. No hidden costs, no surprise fees.';

for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  const file=`lumoscore-${c}-desktop.html`;const data=read(file);const{json,s,e}=getContents(data);const k='lumoscore-landing.html';
  let h=json[k];
  h=h.replace(/<style id="lx-whybento">[\s\S]*?<\/style>/g,'').replace(/<script id="lx-whyart">[\s\S]*?<\/script>/g,'');
  h=h.split(FEE_OLD).join(FEE_NEW);
  const bi=h.lastIndexOf('</body>');
  const inject=STYLE+SCRIPT;
  h=bi>=0?h.slice(0,bi)+inject+h.slice(bi):h+inject;
  json[k]=h;
  const serialized=JSON.stringify(json).split('</').join('<'+B+'/');fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  console.log(`${c}: why illustrations + icons + fee copy updated`);
}
