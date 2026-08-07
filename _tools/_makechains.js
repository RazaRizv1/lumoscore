// Create Stellar + XRPL showcase source files from the Aptos base, with a base64-safe
// identity swap (network name, ticker, brand logo, chain id, on-chain addresses, brand domains).
// Text swaps run ONLY on non-datauri chunks; the brand-logo swap is an exact full-string replace
// of the Aptos webp data URI with the target chain's SVG data URI. Idempotent (regenerates fresh
// from the Aptos base each run). Run:  node _tools/_makechains.js
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);
const A=require(__dirname+'/_chainassets.json');

function svgURI(svg){ return 'data:image/svg+xml;base64,'+Buffer.from(svg,'utf8').toString('base64'); }

const TARGETS={
  stellar:{ name:'Stellar', TICK:'XLM', id:'stellar', logo:svgURI(A.stellarSvg),
            prefix:'G', alpha:'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', domain:'stellar.org', brand:'Stellar Development Foundation' },
  xrpl:{    name:'XRP Ledger', TICK:'XRP', id:'xrpl', logo:svgURI(A.xrplSvg),
            prefix:'r', alpha:'rpshnaf39wBUDNEGHJKLM4PQRSTUVWXYZ2bcdeg65jkm8oFqi1tuvAxyz', domain:'xrpl.org', brand:'XRPL Foundation' }
};

// deterministic address generator: map an aptos hex address to a target-format one so each unique
// source address yields a stable, distinct target address (truncated keeps the …).
function mkAddr(orig,t){
  const parts=orig.split('…');
  const map=hex=>{ let o=''; for(let i=0;i<hex.length;i++) o+=t.alpha[parseInt(hex[i],16)%t.alpha.length]; return o; };
  if(parts.length===2){ const h=parts[0].replace(/[^0-9a-fA-F]/g,''), tl=parts[1].replace(/[^0-9a-fA-F]/g,'');
    return t.prefix+map(h)+'…'+map(tl); }
  const hex=orig.replace(/[^0-9a-fA-F]/g,''); return t.prefix+map(hex);
}

// split html on data: URIs; run fn only on the non-datauri chunks
function outsideData(html,fn){
  const re=/data:[^"'\)\s]+/g; let out='',last=0,m;
  while((m=re.exec(html))){ out+=fn(html.slice(last,m.index))+m[0]; last=m.index+m[0].length; }
  return out+fn(html.slice(last));
}

function swap(html,t){
  // 1) brand logo — exact full-string replace across the whole doc (datauri included)
  html=html.split(A.aptosLogo).join(t.logo);
  // 2) text swaps on non-datauri chunks only
  return outsideData(html,function(s){
    s=s.split('aptoslabs.com').join(t.domain).split('aptosfoundation.org').join(t.domain);
    s=s.split('aptosfoundation').join(t.id);
    s=s.replace(/Aptos/g,t.name).replace(/APTOS/g,t.name.toUpperCase());
    s=s.replace(/\baptos\b/g,t.id);
    s=s.replace(/\bAPT\b/g,t.TICK);
    // on-chain addresses (truncated 0x..….. and full 0x[16+ hex])
    s=s.replace(/0x[0-9a-fA-F]{2,8}…[0-9a-fA-F]{2,8}/g,m=>mkAddr(m,t));
    s=s.replace(/0x[0-9a-fA-F]{16,}/g,m=>mkAddr(m,t));
    return s;
  });
}

for(const dev of ['desktop','mobile']){
  const base=read(`lumoscore-aptos-${dev}.html`);
  const {json,s,e}=getContents(base);
  for(const key of Object.keys(TARGETS)){
    const t=TARGETS[key];
    const nj={};
    for(const k of Object.keys(json)) nj[k]=swap(json[k],t);
    const serialized=JSON.stringify(nj).split('</').join('<'+B+'/');
    const outFile=`lumoscore-${t.id}-${dev}.html`;
    fs.writeFileSync(outFile, base.slice(0,s)+serialized+base.slice(e),'utf8');
    console.log('wrote '+outFile+'  (name='+t.name+' tick='+t.TICK+')');
  }
}
console.log('done');
