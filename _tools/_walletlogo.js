// Show the wallet the reader is actually connected with.
//
// Both the phone menu card and the desktop header chip drew the NETWORK mark -- the Stellar disc --
// beside the address. But the line under it already says "Connected · Stellar", so the mark was
// repeating the one fact that was already written and saying nothing about which wallet is holding
// the keys. The wallet's own logo is the useful thing there.
//
// The logos already ship: /assets/wallets/<id>.<ext>, the same files the connect sheet uses. The map
// below is built by READING that directory at build time, so a wallet whose logo is added later is
// picked up by rebuilding, and one whose file is missing simply keeps the network mark rather than
// showing a broken image.
const fs = require('fs');
const path = require('path');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const DIR = path.join(__dirname, '..', 'assets', 'wallets');
let MAP = {};
try {
  for (const f of fs.readdirSync(DIR)) {
    const m = f.match(/^(.+)\.(png|jpg|jpeg|webp|svg)$/i);
    if (m) MAP[m[1].toLowerCase()] = '/assets/wallets/' + f;
  }
} catch (e) { }
if (!Object.keys(MAP).length) { console.log('no wallet logos on disk — nothing to do'); process.exit(0); }

const STYLE = `<style id="lx-walletlogo-css">
/* The avatar is a background-image disc in both places. Swapping the image is enough -- size, radius
   and ring stay whatever each surface already sets. */
.mu-av.lx-haswl,.lx-tw-av.lx-haswl{background-size:cover!important;background-position:center!important;
  background-repeat:no-repeat!important}
/* The network mark was drawn by a child svg in the phone card; with a wallet logo behind it, hide it. */
.mu-av.lx-haswl>svg,.lx-tw-av.lx-haswl>svg{display:none!important}
</style>`;

const SCRIPT = `<script id="lx-walletlogo">(function(){
  var MAP=${JSON.stringify(MAP)};
  function logo(){
    var id="";
    try{ id=(localStorage.getItem("lumos.wallet")||localStorage.getItem("lumos.lastWallet")||""); }catch(_){}
    if(!id)return "";
    id=String(id).toLowerCase().replace(/[^a-z0-9]/g,"");
    // walletconnect stores a few different spellings; they all mean the same sheet entry
    if(id.indexOf("walletconnect")===0||id==="wc")id="wc";
    return MAP[id]||"";
  }
  function paint(){
    var url=logo(); if(!url)return;
    var els=document.querySelectorAll(".mu-av,.lx-tw-av");
    for(var i=0;i<els.length;i++){
      var e=els[i];
      if(e.getAttribute("data-lxwl")===url)continue;
      e.setAttribute("data-lxwl",url);
      e.classList.add("lx-haswl");
      e.style.setProperty("background-image","url('"+url+"')","important");
    }
  }
  function boot(){
    paint();
    // The chip and the menu card are both built after connect, and the menu is rendered on open --
    // so this watches rather than running once.
    try{ new MutationObserver(paint).observe(document.body,{childList:true,subtree:true}); }catch(_){}
    try{ window.addEventListener("storage",paint); }catch(_){}
    var n=0,iv=setInterval(function(){ paint(); if(++n>20)clearInterval(iv); },400);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();</script>`;

let containers = 0, pages = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = `lumoscore-aptos-${dev}.html`;
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;

  for (const k of Object.keys(json)) {
    let p = json[k];
    const before = p;
    p = p.replace(/<style id="lx-walletlogo-css">[\s\S]*?<\/style>/, '')
         .replace(/<script id="lx-walletlogo">[\s\S]*?<\/script>/, '');
    // only pages that carry one of the two avatars
    if (p.indexOf('mu-av') < 0 && p.indexOf('lx-tw-av') < 0) {
      if (p !== before) { json[k] = p; changed = true; }
      continue;
    }
    if (p.indexOf('</head>') >= 0) p = p.replace('</head>', STYLE + '</head>');
    const bi = p.lastIndexOf('</body>');
    if (bi < 0) continue;
    p = p.slice(0, bi) + SCRIPT + p.slice(bi);
    if (p !== before) { json[k] = p; changed = true; pages++; }
  }

  if (changed) {
    containers++;
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
console.log('wallet logo (' + Object.keys(MAP).length + ' known) on ' + pages
  + ' page keys across ' + containers + ' containers');
