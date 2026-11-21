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

// The chain marks, from the same registry the switcher and the chooser draw from, so the three can
// never disagree about what a chain looks like on one screen.
const CH = JSON.parse(fs.readFileSync(path.join(__dirname, '_chains.json'), 'utf8'));
// EVERY CHAIN THE COMBINED SITE SERVES, not just the two this was written for. RAZA 2026-11-14,
// connected as razarizv1.near: "when i view stellar or xrpl pages, on top right, instead of showing
// the same logo as its showing on dashboard, it starts showing XRPL logo."
//
// near and arc are NOT in _chains.json and must not be put there -- that file is injected whole into
// the mc-engine by _multichain.js, so a key added there feeds the chain switcher and the hub grids.
// Their marks already ship as ordinary bridge-network artwork at the root of the combined site, so
// they are referenced by path; hedera does have a registry entry, and uses it.
const CHAINLOGO = {
  stellar: (CH.stellar || {}).logo || '',
  xrpl: (CH.xrpl || {}).logo || '',
  hedera: (CH.hedera || {}).logo || '',
  near: '/assets/networks/near.png',
  arc: '/assets/networks/arc.jpg',
};

const DIR = path.join(__dirname, '..', 'assets', 'wallets');
// One wallet can have two files on disk -- rabet.png is the keyed-out version of rabet.jpg, and the
// jpg stays as its source. Whichever readdir happened to return last would otherwise win, so the
// extension order decides it: a format that can carry alpha beats one that cannot.
const RANK = { svg: 0, png: 1, webp: 2, jpeg: 3, jpg: 4 };
let MAP = {}, PICKED = {};
try {
  for (const f of fs.readdirSync(DIR)) {
    const m = f.match(/^(.+)\.(png|jpg|jpeg|webp|svg)$/i);
    if (!m) continue;
    const k = m[1].toLowerCase(), r = RANK[m[2].toLowerCase()];
    if (k in PICKED && PICKED[k] <= r) continue;
    PICKED[k] = r; MAP[k] = '/assets/wallets/' + f;
  }
} catch (e) { }
// THE FORKS' WALLETS TOO, because the chip is read on a Stellar page by someone connected on another
// chain and it should name the wallet they are actually holding keys in. NEAR's five ship in their
// own subdirectory, which the flat readdir above skips, and combine.js already places them at
// /assets/wallets/near/* at the ROOT of the combined site -- so a Stellar page can reference them
// without copying anything.
//
// Keyed the way logo() normalises lumos.wallet, which stores a DISPLAY NAME: "HOT Wallet" lowercases
// and loses its space to become "hotwallet". Identical table to NEAR's own _nearwalletlogo.js, so the
// chip cannot show one wallet on /dashboard and another on /trade/stellar.
const FORK_WALLETS = {
  hotwallet: '/assets/wallets/near/hot-wallet.png',
  meteorwallet: '/assets/wallets/near/meteor-wallet.svg',
  nearmobile: '/assets/wallets/near/near-mobile.webp',
  mynearwallet: '/assets/wallets/near/mynearwallet.png',
  intearwallet: '/assets/wallets/near/intear-wallet.svg',
};
for (const k of Object.keys(FORK_WALLETS)) if (!(k in MAP)) MAP[k] = FORK_WALLETS[k];
if (!Object.keys(MAP).length) { console.log('no wallet logos on disk — nothing to do'); process.exit(0); }

const STYLE = `<style id="lx-walletlogo-css">
/* The avatar is a background-image disc in both places. Swapping the image is enough -- size, radius
   and ring stay whatever each surface already sets. */
.mu-av.lx-haswl,.lx-tw-av.lx-haswl{background-size:cover!important;background-position:center!important;
  background-repeat:no-repeat!important}
/* A mark on a white ground would otherwise read as a hole punched in the header. The ring gives it an
   edge; it is translucent so it works on either theme. */
.mu-av.lx-haswl,.lx-tw-av.lx-haswl{box-shadow:inset 0 0 0 1px rgba(127,127,140,.30)}
/* ...but a mark with a transparent ground has no tile for the ring to edge, so it would draw an empty
   box around the artwork. Those carry .lx-wl-bare instead (RAZA asked for a transparent rabet on
   2026-09-20, and it is the first logo here that has no ground of its own). */
.mu-av.lx-wl-bare,.lx-tw-av.lx-wl-bare{box-shadow:none!important}
/* The network mark was drawn by a child svg in the phone card; with a wallet logo behind it, hide it. */
.mu-av.lx-haswl>svg,.lx-tw-av.lx-haswl>svg{display:none!important}
/* ...and by a child IMG in the desktop chip, which this rule did not cover. _walletchip2.js bakes the
   chain mark in as an <img>, so on desktop it sat ON TOP of the wallet logo: the chip showed Stellar
   where the phone menu showed the wallet you are actually connected with. Worse, that mark is a CIRCLE
   inside a 28px rounded SQUARE, so its four transparent corners let the wallet logo behind it bleed
   through as a light fringe -- the "white from the sides" on a dark chip. Both were the same element.
   Hidden only when a real wallet logo is behind it (.lx-haswl); with none, the chain mark still shows. */
.mu-av.lx-haswl>img,.lx-tw-av.lx-haswl>img{display:none!important}
/* THE MARK IS HIDDEN UNTIL IT IS KNOWN TO BE RIGHT (RAZA 2026-10-17: "there's still a flash on some
   pages that shows Stellar logo for split seconds"). The chip ships with whatever mark the markup
   carries, and mc-engine rewrites it to the chain the URL adopted before this script has read which
   wallet is connected — so for a few hundred milliseconds it shows the page's chain, which on a
   Stellar page beside an r-address is the exact thing the banner is there to deny.
   Gated on OUR work being done, not on "the chain is decided": paint() adds lx-wlready on both of
   its paths, so this lifts whether a wallet logo was found or the chain mark stood in. A gate keyed
   on the earlier event is what let the Aptos flash through for months.
   visibility, not display, so the chip does not change width when it reveals. */
html:not(.lx-wlready) .mu-av>img,html:not(.lx-wlready) .lx-tw-av>img{visibility:hidden!important}

/* THE PHONE'S HEADER DISC, which this script never reached (RAZA 2026-10-17: "It's showing network
   logo instead of wallet logo on top right" and "While being connected to XRPL, I opened stellar
   page and it's showing stellar logo and wallet on top right. Please make the same logics as on
   desktop").
   Desktop's chip is an <img> inside .lx-tw-av; the phone's is a.avatar-sm.lx-mav painted through
   a CSS custom property, --lx-netlogo, by _wallet_header.js. Two different mechanisms for the same
   idea, so every fix made to the desktop chip missed this one entirely -- including the one that
   made the mark follow the wallet instead of the page.
   _wallet_header.js sets that variable to the BUILD's chain mark, unconditionally: never the
   wallet's artwork, and on a Stellar page never the XRPL wallet's chain.
   A SEPARATE PROPERTY AND OUR OWN ATTRIBUTE, rather than writing --lx-netlogo ourselves, because
   that layer repaints on its own schedule and would win the next time it ran. A rule keyed on an
   attribute only this script sets cannot be overwritten by a later variable assignment -- the same
   second-writer lesson the swap chip taught. */
.lx-mav[data-lxwav]::before,.avatar-sm[data-lxwav]::before{background-image:var(--lxwav)!important}.mu-av[data-lxwav]{background-image:var(--lxwav)!important}
</style>`;

const SCRIPT = `<script id="lx-walletlogo">(function(){
  // FAILSAFE FIRST. The gate above hides the mark from the stylesheet, which does not care whether
  // this script ever ran -- so anything that throws below would hide the chip's mark permanently
  // rather than for a frame. ready() is a hoisted declaration, so this is legal here, and the timer
  // is registered before any code that could fail. Normal paths clear the gate long before 2s.
  try{ setTimeout(ready,2000); }catch(_){}
  var MAP=${JSON.stringify(MAP)};
  var CHAINLOGO=${JSON.stringify(CHAINLOGO)};
  function logo(){
    var id="";
    try{ id=(localStorage.getItem("lumos.wallet")||localStorage.getItem("lumos.lastWallet")||""); }catch(_){}
    if(!id)return "";
    id=String(id).toLowerCase().replace(/[^a-z0-9]/g,"");
    // walletconnect stores a few different spellings; they all mean the same sheet entry
    if(id.indexOf("walletconnect")===0||id==="wc")id="wc";
    if(MAP[id])return MAP[id];
    // A DISPLAY NAME IS NOT A FILENAME, and GemWallet is where that bit (RAZA 2026-10-17, on a
    // Stellar page with an XRPL wallet connected: "instead of showing Gem wallet icon, its showing
    // XRP icon"). lumos.wallet holds what the picker calls the wallet -- "GemWallet" -- while the
    // artwork ships as gem.png, so the exact lookup above missed and the chip fell back to a chain
    // mark. Which mark that was then depended on the page, and on a Stellar page it read as though
    // a Stellar wallet were connected.
    //
    // Matching on a key the id STARTS WITH covers that without a table to maintain: "gemwallet"
    // finds "gem". Longest first, so a future "ready" and "readyv2" cannot resolve to each other by
    // accident, and keys under three characters are skipped because a two-letter prefix is a
    // coincidence waiting to happen rather than a match.
    var keys=Object.keys(MAP).sort(function(a,b){return b.length-a.length;});
    for(var i=0;i<keys.length;i++){
      if(keys[i].length>2&&id.indexOf(keys[i])===0)return MAP[keys[i]];
    }
    return "";
  }
  // #11: the menu card said "Connected · Stellar" -- which wallet you are connected WITH was the one
  // thing it did not say. The logo covers that when we ship one, but a generic WalletConnect session
  // has no wallet-specific asset to show and drawing a brand mark from memory is not the answer.
  // Naming it is: the sub-line reads "LOBSTR · Stellar", and falls back to the id itself for a wallet
  // this map has not been taught, which is still better than saying nothing.
  var NAMES={lobstr:"LOBSTR",freighter:"Freighter",rabet:"Rabet",albedo:"Albedo",xbull:"xBull",
    walletconnect:"WalletConnect",wc:"WalletConnect",hana:"Hana",xaman:"Xaman",gem:"Gem",
    hashpack:"HashPack",kabila:"Kabila",crossmark:"Crossmark",ready:"Ready"};
  function walletId(){
    var id="";
    try{ id=(localStorage.getItem("lumos.wallet")||localStorage.getItem("lumos.lastWallet")||""); }catch(_){}
    return String(id).toLowerCase().replace(/[^a-z0-9]/g,"");
  }
  function nameIt(){
    var id=walletId(); if(!id)return;
    var nm=NAMES[id]||(id.charAt(0).toUpperCase()+id.slice(1));
    var els=document.querySelectorAll(".mu-sub");
    for(var i=0;i<els.length;i++){
      var e=els[i], t=(e.textContent||"").trim();
      if(!t||t.indexOf(nm)===0)continue;
      // Keep whatever the card said after the separator -- that is the network, and it is still true.
      var tail=t.indexOf("\u00b7")>=0?t.slice(t.indexOf("\u00b7")):"";
      var want=nm+(tail?(" "+tail):"");
      if(e.textContent!==want)e.textContent=want;
    }
  }
  // Measured ink-bounding-box crops: how much to scale a logo whose artwork sits inside dead margin.
  // The first pass set each of these to 100/inkFraction, which scales the ink to touch the tile edges
  // with NO margin left. On a squat mark that merely looks tight; on Rabet's -- ink box 36% wide by
  // 71% tall in a 400px square -- the mark then ran straight off the top and bottom of a 28px rounded
  // tile and read as a broken image (RAZA 2026-09-20: "the connected wallet logo is messed up, it was
  // fine before"). An app icon leaves a margin, so the target is the ink filling ~75% of the tile:
  // zoom = 75/inkPercent, and a mark already at or above that keeps plain cover (albedo is 82%).
  var ZOOM={rabet:106,ready:120};
  // Logos whose artwork has no ground of its own: they take the surface's colour, so no ring.
  var BARE={rabet:1};
  // THE WALLET'S OWN CHAIN, for the case where we have no artwork for it. Read from lumos.network,
  // and from the address SHAPE when that is not a chain we know. No regex on purpose: this block is
  // emitted from a template literal, where a backslash does not survive.
  //
  // A FIRST LETTER IS NOT AN ADDRESS SHAPE. This used to read \`if(a.charAt(0)==="r")return "xrpl"\`
  // with no length test at all, so RAZA's NEAR account **razarizv1.near** was taken for an XRP
  // Ledger address and the chip painted the XRP mark -- on Stellar pages as well as XRPL ones, since
  // this never looked at the page (RAZA 2026-11-14: "instead of showing the same logo as its showing
  // on dashboard, it starts showing XRPL logo"). Any NEAR account id starting with r or G hit it.
  //
  // The tests below are the same ones _wrongchain.js uses as ITS backstop, deliberately: two
  // resolvers disagreeing about the connected chain is how the chip ends up contradicting the
  // view-only notice three lines under it. An EVM 0x address is absent from both for the same
  // reason -- lumos.address is one key shared by every chain and a 0x value in it is as likely to be
  // a bridge destination as a connected Arc wallet ([[lumos-address-is-a-shared-key-across-chains]]).
  //
  // The known-chain test is membership of CHAINLOGO rather than a hardcoded pair, so a chain can
  // only be named here if there is a mark to paint for it -- and the legacy lumos.network value
  // "mainnet", which never self-heals for pre-multichain wallets, falls through to the shapes
  // instead of being trusted ([[lumos-network-is-not-a-chain]]).
  function hexonly(s){
    for(var i=0;i<s.length;i++){ if("0123456789abcdef".indexOf(s.charAt(i))<0)return false; }
    return true;
  }
  function wchain(){
    var n="",a="";
    try{ n=(localStorage.getItem("lumos.network")||"").toLowerCase();
         a=localStorage.getItem("lumos.address")||""; }catch(_){}
    if(n&&CHAINLOGO[n])return n;
    var l=String(a).toLowerCase();
    if(a.charAt(0)==="G"&&a.length===56)return "stellar";
    if(a.charAt(0)==="r"&&a.length>=25&&a.length<=35)return "xrpl";
    if(l.indexOf("0.0.")===0)return "hedera";
    if(l.length>5&&(l.slice(-5)===".near"||l.slice(-3)===".tg"))return "near";
    if(l.length===64&&hexonly(l))return "near";
    return "";
  }
  // Reveal the mark once this has decided what it should be -- see the gate in the stylesheet.
  function ready(){ try{ document.documentElement.classList.add("lx-wlready"); }catch(_){} }

  // The phone header disc, painted from the same two answers the desktop chip uses: the wallet's own
  // artwork when we have it, otherwise the WALLET'S chain -- never the page's.
  function paintMobile(url){
    try{
      var c=wchain();
      var want=url||(c?CHAINLOGO[c]:"");
      if(!want)return;
      var els=document.querySelectorAll(".lx-mav,.avatar-sm.lx-mav,.mu-av.lx-mav-net");
      for(var i=0;i<els.length;i++){
        els[i].style.setProperty("--lxwav",'url("'+want+'")');
        els[i].setAttribute("data-lxwav","");
      }
    }catch(_){}
  }

  function paint(){
    try{ nameIt(); }catch(_){}
    var url=logo();
    paintMobile(url);
    if(!url){
      // NO ARTWORK FOR THIS WALLET, so the chain mark stands in -- and it must be the WALLET'S
      // chain, not the page's (RAZA 2026-10-17: an XRPL wallet on a Stellar page showed Stellar's
      // mark beside its r-address). mc-engine's walkSwap rewrites every chain mark to whatever the
      // url adopted; data-lx-noswap is its documented opt-out, which it honours via closest().
      //
      // Owned HERE rather than in the wrong-chain layer, because this function runs on every page
      // and that one returns early whenever the chains agree. One writer for this node, which is
      // the lesson the chip has already taught twice today.
      //
      // AND IT TAUGHT IT A THIRD TIME. "no artwork" means THIS script found none in MAP -- it does
      // NOT mean the chip is unpainted. XRPL's connect layer resolves the wallet by DISPLAY NAME
      // (lumos.wallet holds "GemWallet", not "gem") and paints /assets/wallets/*.png straight into
      // this img on a poll. The first version of this branch overwrote that with the chain mark, so
      // RAZA lost his wallet logo on every XRPL page: "you entirely removed the wallet icon and
      // replace with network icon". A chain mark stands in for a mark we do not have; it never
      // replaces artwork someone else resolved. Hence: leave any img that already holds a wallet
      // logo alone, whoever put it there.
      try{
        var c=wchain(), want=c?CHAINLOGO[c]:"";
        if(want){
          var ims=document.querySelectorAll(".mu-av img,.lx-tw-av img");
          for(var q=0;q<ims.length;q++){
            var cur=ims[q].getAttribute("src")||"";
            if(cur.indexOf("/assets/wallets/")>=0)continue;
            ims[q].setAttribute("data-lx-noswap","");
            if(cur!==want)ims[q].setAttribute("src",want);
          }
        }
      }catch(_){}
      ready();
      return;
    }
    var els=document.querySelectorAll(".mu-av,.lx-tw-av");
    for(var i=0;i<els.length;i++){
      var e=els[i];
      if(e.getAttribute("data-lxwl")===url)continue;
      e.setAttribute("data-lxwl",url);
      e.classList.add("lx-haswl");
      e.style.setProperty("background-image","url('"+url+"')","important");
      // Crop the dead margin on the marks that have one; the rest keep plain cover.
      var _w=walletId(), _z=ZOOM[_w];
      if(_z)e.style.setProperty("background-size",_z+"%","important");
      else e.style.removeProperty("background-size");
      if(BARE[_w])e.classList.add("lx-wl-bare"); else e.classList.remove("lx-wl-bare");
    }
    ready();
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

let containers = 0, pages = 0, swapped = 0, appended = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = `lumoscore-aptos-${dev}.html`;
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;

  for (const k of Object.keys(json)) {
    let p = json[k];
    const before = p;

    // Pages with neither avatar keep the strip: there is nothing for the layer to paint, so it is
    // removed outright rather than swapped.
    if (p.indexOf('mu-av') < 0 && p.indexOf('lx-tw-av') < 0) {
      p = p.replace(/<style id="lx-walletlogo-css">[\s\S]*?<\/style>/g, '')
           .replace(/<script id="lx-walletlogo">[\s\S]*?<\/script>/g, '');
      if (p !== before) { json[k] = p; changed = true; }
      continue;
    }

    // IN PLACE, NOT STRIP-AND-RE-APPEND. The old form removed both blocks and put them back at the
    // end of <head> and just before </body>, which lands them LAST in the cascade however early they
    // used to sit -- the trap in [[running-one-stellar-transform-reorders-layers]], whose only other
    // remedy is re-running every transform whose layer belongs after this one. Swapping each block
    // where it already sits keeps its position exactly, so this transform is order-neutral and safe
    // to run on its own ([[a-transform-that-patches-in-place-cannot-reorder]]).
    //
    // A container that never carried the layer still appends, and still lands last. That is correct,
    // and a layer-order gate should read it as a set difference rather than as a move.
    for (const [open, close, block, tail] of [
      ['<style id="lx-walletlogo-css">', '</style>', STYLE, '</head>'],
      ['<script id="lx-walletlogo">', '</script>', SCRIPT, '</body>'],
    ]) {
      const at = p.indexOf(open);
      const end = at < 0 ? -1 : p.indexOf(close, at);
      if (at >= 0 && end > at) { p = p.slice(0, at) + block + p.slice(end + close.length); swapped++; continue; }
      if (tail === '</head>') {
        if (p.indexOf('</head>') < 0) continue;
        p = p.replace('</head>', block + '</head>');
      } else {
        const bi = p.lastIndexOf('</body>');
        if (bi < 0) continue;
        p = p.slice(0, bi) + block + p.slice(bi);
      }
      appended++;
    }
    if (p !== before) { json[k] = p; changed = true; pages++; }
  }

  if (changed) {
    containers++;
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
// Swapped vs appended, not one total: on a tree that already carries the layer every block should
// SWAP. An `appended` above zero on a re-run is the one outward sign a layer is about to move.
console.log('wallet logo (' + Object.keys(MAP).length + ' known) on ' + pages
  + ' page keys across ' + containers + ' containers — '
  + swapped + ' block(s) swapped in place, ' + appended + ' appended');
