// #1 (real fix) Connect flow: it FORCED every network to stellar/xrpl and only defined 2 wallet
// lists, so Hedera/Starknet/VeChain/Aptos/World Chain all showed the (mislabeled) Stellar wallets.
// This: (a) rebuilds the I icon map with lettermarks for ALL wallets, (b) adds correct per-network
// wallet lists, (c) stops the forcing so each network shows its own wallets, (d) fixes stellar/xrpl labels.
// Lettermark icons (not reproduced brand logos); wallet names are factual per-chain support.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const WL={freighter:'F',xbull:'X',rabet:'R',albedo:'A',lobstr:'L',wc:'W',gem:'G',xaman:'X',joey:'J',crossmark:'C',
  hashpack:'H',kabila:'K',blade:'B',metamask:'M',argent:'A',braavos:'B',petra:'P',martian:'M',pontem:'P',veworld:'V',sync2:'S',coinbase:'C',rainbow:'R'};
function span(t){return "'<span class="+'"'+"lx-wl"+'"'+">"+t+"</span>'";}
const IMAP='var I={'+Object.keys(WL).map(k=>k+':'+span(WL[k])).join(',')+'};';

function w(id,name,sub,grad,icon,inst){return "{id:'"+id+"',name:'"+name+"',sub:'"+sub+"',grad:'"+grad+"',icon:I."+icon+(inst?",installed:true":"")+"}";}
function net(key,label,chip,addr,pop,more){
  return key+":{label:'"+label+"',chip:'"+chip+"',addr:'"+addr+"',sub:'Choose a wallet to continue',groups:["
    +"{section:'Popular',wallets:["+pop.join(",")+"]},"
    +"{section:'More wallets',wallets:["+more.join(",")+"]}]}";
}
const WC=w('WalletConnect','WalletConnect','Scan to connect','linear-gradient(135deg,#3b99fc 0%,#1a6fd4 100%)','wc');
const NEWNETS=[
  net('hedera','Hedera','Hedera','0.0.2754435',
    [w('HashPack','HashPack','Browser & mobile','linear-gradient(135deg,#8259ef 0%,#5b2fd6 100%)','hashpack',1),
     w('Kabila','Kabila','Web & mobile','linear-gradient(135deg,#16c79a 0%,#0b8f6e 100%)','kabila')],
    [w('Blade','Blade','Browser extension','linear-gradient(135deg,#111827 0%,#0b1220 100%)','blade'),
     w('MetaMask','MetaMask','Via Hedera Snap','linear-gradient(135deg,#f6851b 0%,#c85a11 100%)','metamask'), WC]),
  net('starknet','Starknet','Starknet','0x04a7...9c2f',
    [w('Argent','Argent','Browser & mobile','linear-gradient(135deg,#ff875b 0%,#e0417a 100%)','argent',1),
     w('Braavos','Braavos','Browser extension','linear-gradient(135deg,#f4923d 0%,#c2410c 100%)','braavos')],
    [WC]),
  net('aptos','Aptos','Aptos','0x9c7d...a802',
    [w('Petra','Petra','Browser & mobile','linear-gradient(135deg,#2ed3b7 0%,#0b8f6e 100%)','petra',1),
     w('Martian','Martian','Browser extension','linear-gradient(135deg,#6b4df6 0%,#3b1cc4 100%)','martian')],
    [w('Pontem','Pontem','Browser extension','linear-gradient(135deg,#0ea5e9 0%,#0c4a6e 100%)','pontem'), WC]),
  net('vechain','VeChain','VeChain','0x5f2c...b18a',
    [w('VeWorld','VeWorld','Browser & mobile','linear-gradient(135deg,#4a5bdb 0%,#27b4e6 100%)','veworld',1),
     w('Sync2','Sync2','Desktop app','linear-gradient(135deg,#16c79a 0%,#0b8f6e 100%)','sync2')],
    [WC]),
  net('worldchain','World Chain','World Chain','0x81be...4f3d',
    [w('MetaMask','MetaMask','Browser & mobile','linear-gradient(135deg,#f6851b 0%,#c85a11 100%)','metamask',1),
     w('Coinbase Wallet','Coinbase Wallet','Web & mobile','linear-gradient(135deg,#2563eb 0%,#1e40af 100%)','coinbase')],
    [w('Rainbow','Rainbow','Mobile wallet','linear-gradient(135deg,#8b5cf6 0%,#ec4899 100%)','rainbow'), WC])
].join(',');

const FORCE_OLD="net=(net==='xrpl'||net==='xrp')?'xrpl':'stellar';";
const FORCE_NEW="net=(net==='xrp')?'xrpl':(NETS[net]?net:'stellar');";

function insertNets(h){
  const ni=h.indexOf('var NETS={'); if(ni<0) return h;
  const open=h.indexOf('{',ni); let depth=0,k=open;
  for(;k<h.length;k++){const c=h[k];if(c==='{')depth++;else if(c==='}'){depth--;if(depth===0)break;}}
  return h.slice(0,k)+','+NEWNETS+h.slice(k);   // k = NETS closing brace
}

let n=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k];
      if(h.indexOf('var NETS={')<0 || h.indexOf('renderList(net)')<0) continue;
      // (a) icon map
      h=h.replace(/var I=\{[\s\S]*?\};/, IMAP);
      // (b) add networks (guard: skip if already added)
      if(h.indexOf("icon:I.hashpack")<0){ h=insertNets(h); }
      // (c) stop forcing
      h=h.split(FORCE_OLD).join(FORCE_NEW);
      // (d) fix mislabeled stellar/xrpl
      h=h.replace(/stellar:\{\s*label:'Hedera',\s*chip:'Hedera'/, "stellar:{label:'Stellar',chip:'Stellar'");
      h=h.replace(/xrpl:\{\s*label:'HBAR',\s*chip:'HBAR'/, "xrpl:{label:'XRP Ledger',chip:'XRP'");
      // style (once)
      if(h.indexOf('id="lx-wlmark"')<0){ const bi=h.lastIndexOf('</body>'); if(bi>=0) h=h.slice(0,bi)+'<style id="lx-wlmark">.lx-wl{font:800 15px/1 "Hanken Grotesk",system-ui,sans-serif;color:#fff;letter-spacing:-.02em;display:inline-flex;align-items:center;justify-content:center}.lxw-ico{display:inline-flex;align-items:center;justify-content:center}</style>'+h.slice(bi); }
      json[k]=h; n++;
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('per-network wallet lists + lettermark icons on '+n+' pages');
