// Wire both connect flows (in-app var NETS + signin opt-cards) to load REAL wallet logo files from
// assets/wallets/<file>.png, with the lettermark as an automatic fallback when a file is absent.
// The <img> sits over the lettermark; on load it covers it, on error it removes itself. Also renames
// Starknet "Argent" -> "Ready".
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);
const Q=String.fromCharCode(34);

// icon-map key -> [logo file base, fallback letter]
const IK={freighter:['freighter','F'],xbull:['xbull','X'],rabet:['rabet','R'],albedo:['albedo','A'],lobstr:['lobstr','L'],
  wc:['walletconnect','W'],gem:['gem','G'],xaman:['xaman','X'],joey:['joey','J'],crossmark:['crossmark','C'],
  hashpack:['hashpack','H'],kabila:['kabila','K'],blade:['blade','B'],metamask:['metamask','M'],
  argent:['ready','R'],braavos:['braavos','B'],petra:['petra','P'],martian:['martian','M'],pontem:['pontem','P'],
  veworld:['veworld','V'],sync2:['sync2','S'],coinbase:['coinbase','C'],rainbow:['rainbow','R']};
// icon HTML (single-quoted JS string for the var I map): lettermark + overlaid img with error-fallback
function iconJS(file,letter){
  return "'<span class="+Q+"lx-wl"+Q+">"+letter+"</span><img class="+Q+"lx-wimg"+Q+" src="+Q+"assets/wallets/"+file+".png"+Q+" alt="+Q+Q+" onerror="+Q+"this.remove()"+Q+">'";
}
const IMAP='var I={'+Object.keys(IK).map(k=>k+':'+iconJS(IK[k][0],IK[k][1])).join(',')+'};';

// opt-card wallet name -> file + brand color (color only used for the fallback letter background)
const COLORS={hashpack:'#8259ef',kabila:'#16c79a',blade:'#111827',metamask:'#f6851b',ready:'#ff875b',argent:'#ff875b',braavos:'#f4923d',
  petra:'#2ed3b7',martian:'#6b4df6',pontem:'#0ea5e9',veworld:'#4a5bdb',sync2:'#16c79a',coinbase:'#2563eb',coinbasewallet:'#2563eb',
  rainbow:'#8b5cf6',walletconnect:'#3b99fc',freighter:'#8b5cf6',xbull:'#3b82f6',rabet:'#1f2937',albedo:'#0ea5e9',lobstr:'#fb7185',
  gem:'#2563eb',gemwallet:'#2563eb',xaman:'#e0417a',joey:'#ec4899',crossmark:'#2563eb'};
function slug(name){return name.toLowerCase().replace(/[^a-z0-9]/g,'');}
function fileFor(name){var s=slug(name);var m={walletconnect:'walletconnect',gemwallet:'gem',coinbasewallet:'coinbase',argent:'ready'};return m[s]||s;}

const STYLE='<style id="lx-wl-css">'
+'.lx-wl{font:800 15px/1 "Hanken Grotesk",system-ui,sans-serif;color:#fff;letter-spacing:-.02em;display:inline-flex;align-items:center;justify-content:center;width:100%;height:100%}'
+'.lxw-ico,.opt-card .ico{position:relative;overflow:hidden}'
+'.lx-wimg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block}'
+'</style>';

let inApp=0, optc=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k]; const before=h;
      // in-app NETS system
      if(h.indexOf('var NETS={')>=0 && h.indexOf('renderList(net)')>=0){
        h=h.replace(/var I=\{[\s\S]*?\};/, IMAP);
        h=h.split("id:'Argent',name:'Argent'").join("id:'Ready',name:'Ready'");
        inApp++;
      }
      // signin opt-card system
      if(h.indexOf('class="opt-card"')>=0){
        h=h.replace(/<span class="ico"([^>]*)>[\s\S]*?<\/span>(\s*<span class="oc-nm">([^<]+)<\/span>)/g,
          function(m,attrs,tail,name){
            const f=fileFor(name), l=name.trim().charAt(0).toUpperCase(), col=COLORS[slug(name)]||'#6b7280';
            return '<span class="ico" style="background:'+col+';overflow:hidden"><span class="lx-wl">'+l+'</span><img class="lx-wimg" src="assets/wallets/'+f+'.png" alt="" onerror="this.remove()"></span>'+tail;
          });
        // rename Argent label in opt-cards too
        h=h.split('>Argent</span>').join('>Ready</span>');
        optc++;
      }
      if(h!==before){
        if(h.indexOf('id="lx-wl-css"')<0){ const bi=h.lastIndexOf('</body>'); if(bi>=0) h=h.slice(0,bi)+STYLE+h.slice(bi); }
        json[k]=h;
      }
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('wallet logo <img> wiring: in-app='+inApp+' optcard='+optc+' pages');
