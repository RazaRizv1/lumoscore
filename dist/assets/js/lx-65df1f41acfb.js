(function(){
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
})();