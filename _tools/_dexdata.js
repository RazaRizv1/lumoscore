// Trade-MAIN page real-data layer — MAINNET, READ-ONLY (Phase 3).
// Fills the finalized DEX main page (lumoscore-dex) with live Stellar mainnet data across 4 sections:
//   1) hero price chip (XLM/USD + 24h),  2) New Mints list,  3) Market Movers grid,  4) All Trading Pairs table.
// Driven by a fixed curated mainnet asset universe (no all-markets endpoint exists on Horizon). Nothing is
// redesigned; we only ADD real values into existing elements + wire the table filter/search + row navigation.
// Modeled directly on _dexassetdata.js: idempotent applyAll re-asserted via a debounced+self-guarded global
// MutationObserver + dedicated synchronous per-section observers + a bounded interval; CSS no-flash gates so
// the design's mock values never flash; painter-proof icons (::before driven by --lxvar); ES5 var in the
// browser code, no emoji/astral chars and no \\u escapes that would break JSON re-serialization.
const fs = require('fs');
const { read, getContents, VERIFIED, VTICK_SVG } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const KEYS = ['lumoscore-dex.html', 'lumoscore-dex-dark.html', 'lumoscore-dex-mobile.html'];

const STYLE = `<style id="lx-dexmain-css">
.lx-vtick{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;margin-left:5px;border-radius:50%;background:var(--green,#35c07f);color:#fff;vertical-align:-2px;flex:0 0 14px}
.lx-vtick svg{width:9px;height:9px;display:block}

/* ---- no-flash gates: hide the design's mock values until our data owns the element ---- */
#dexMintsList:not(.lxd) .dex-mint-row{visibility:hidden}
#dexMoverGrid:not(.lxd) .dex-mover-card{visibility:hidden}
#dexMkTbody:not(.lxd) tr{visibility:hidden}
.lm-chip:not(.lxd) .p2,.lm-chip:not(.lxd) .p3{visibility:hidden}
/* ---- painter-proof token icons: the site logo-painter can't touch a ::before pseudo-element ---- */
.dex-mint-ic[data-lxic],.dex-mover-ico[data-lxic],.dex-mk-pair-ic[data-lxic]{position:relative;overflow:hidden;color:transparent!important;font-size:0!important}
.dex-mint-ic[data-lxic]::before,.dex-mover-ico[data-lxic]::before,.dex-mk-pair-ic[data-lxic]::before{content:"";position:absolute;inset:0;background:var(--lxvar) center/cover no-repeat;border-radius:inherit;z-index:2}
.lx-dex-empty{text-align:center;padding:34px 12px;color:var(--text-soft);font-size:14px}
/* ---- hero "advanced DEX" card: orange constellation (mirrors the Pools lx-constel, orange theme) with 5 data points ---- */
/* Trade hero gets its OWN warm/amber background (mirrors the Pools purple), always dark regardless of site theme.
   The html prefix boosts specificity to beat inject_livemarket.js's own .lumos-promo.lm-on !important rule (which uses var(--surface) = theme-following). */
html .lumos-promo.lm-on{overflow:hidden!important;background:radial-gradient(58% 84% at 70% 30%,rgba(140,96,246,.26),transparent 60%),radial-gradient(46% 64% at 92% 78%,rgba(198,86,232,.14),transparent 62%),radial-gradient(52% 68% at 24% 90%,rgba(74,110,224,.12),transparent 62%),linear-gradient(140deg,#0f1120 0%,#0a0a15 55%,#070610 100%)!important;border:1px solid rgba(255,255,255,.10)!important}
/* the design's .lm::after overlay uses var(--surface) (resolves LIGHT) -> a white diagonal streak over the heading. Replace with a dark purple readability overlay (mirrors Pools' .lm::after), darkening the heading side, transparent over the constellation. */
html .lumos-promo.lm-on .lm::after{background:linear-gradient(100deg,rgba(14,9,24,.64) 6%,rgba(14,9,24,.15) 44%,transparent 70%)!important;z-index:2!important}
.lumos-promo.lm-on .lm-bars{display:none!important}                 /* replace the old zigzag bars with the constellation */
svg.lm-svg.lx-dxc{overflow:visible}
.lx-dxc .lx-dxfloat{animation:lxDxFloat 12s ease-in-out infinite}
@keyframes lxDxFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
.lx-dxc{display:none!important}                                   /* drop the wireframe constellation; the subtle starfield replaces it */
.lx-dxc line{stroke:rgba(255,255,255,.12);stroke-width:1}
.lx-dxc .nd{fill:#f2ddff;filter:drop-shadow(0 0 6px rgba(226,182,255,.9));animation:lxDxNode 4.5s ease-in-out infinite}
@keyframes lxDxNode{0%,100%{opacity:.4}50%{opacity:1}}
.lx-dxc .dp{fill:#ffcfa6;filter:drop-shadow(0 0 12px rgba(255,155,85,1));animation:lxDxNode 3.4s ease-in-out infinite}
.lx-dxc .dpr{fill:none;stroke:rgba(255,190,150,.9);stroke-width:1.4;transform-box:fill-box;transform-origin:center;animation:lxDxRing 3s ease-out infinite}
@keyframes lxDxRing{0%{opacity:.85;transform:scale(.5)}70%{opacity:0;transform:scale(2.4)}100%{opacity:0}}
/* ---- 5 floating DATA POINTS on the right side of the hero animation (mirrors the Pools .lx-hstats) ---- */
.lumos-promo{position:relative!important}
/* ===== Pools-matched cosmic animation (identical to the AMM/Pools hero): nebulae drift + stars twinkle + constellation float + particles rise ===== */
.lumos-promo .lm{position:relative;z-index:1}
.lumos-promo .lm-c{position:relative;z-index:3}                    /* heading/sub/button above the cosmic layer */
.lx-cosmic{position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden}
.lx-neb{position:absolute;border-radius:50%;filter:blur(50px);mix-blend-mode:screen;will-change:transform}
.lx-neb.n1{width:600px;height:470px;right:-70px;top:-130px;background:radial-gradient(circle,rgba(140,96,246,.62),transparent 66%);animation:lxNeb1 30s ease-in-out infinite alternate}
.lx-neb.n2{width:480px;height:430px;right:150px;bottom:-180px;background:radial-gradient(circle,rgba(206,88,236,.44),transparent 66%);animation:lxNeb2 36s ease-in-out infinite alternate}
.lx-neb.n3{width:410px;height:340px;left:32%;top:4%;background:radial-gradient(circle,rgba(72,120,232,.34),transparent 66%);animation:lxNeb1 33s ease-in-out infinite alternate-reverse}
@keyframes lxNeb1{from{transform:translate(0,0) scale(1)}to{transform:translate(-48px,36px) scale(1.18)}}
@keyframes lxNeb2{from{transform:translate(0,0) scale(1)}to{transform:translate(54px,-32px) scale(1.12)}}
.lx-stars{position:absolute;inset:0;animation:lxTw 7s ease-in-out infinite;background-repeat:no-repeat;background-image:radial-gradient(1.6px 1.6px at 17% 24%,rgba(255,255,255,.9),transparent 60%),radial-gradient(1.3px 1.3px at 61% 16%,rgba(255,255,255,.62),transparent 60%),radial-gradient(1.7px 1.7px at 83% 52%,rgba(255,255,255,.74),transparent 60%),radial-gradient(1.1px 1.1px at 45% 66%,rgba(255,255,255,.5),transparent 60%),radial-gradient(1.4px 1.4px at 93% 30%,rgba(255,255,255,.64),transparent 60%),radial-gradient(1.2px 1.2px at 34% 44%,rgba(255,255,255,.5),transparent 60%),radial-gradient(1.5px 1.5px at 73% 80%,rgba(255,255,255,.58),transparent 60%),radial-gradient(1px 1px at 55% 90%,rgba(255,255,255,.42),transparent 60%),radial-gradient(1.3px 1.3px at 12% 66%,rgba(255,255,255,.52),transparent 60%),radial-gradient(1.6px 1.6px at 70% 40%,rgba(255,255,255,.66),transparent 60%),radial-gradient(1.1px 1.1px at 88% 66%,rgba(255,255,255,.46),transparent 60%),radial-gradient(1.2px 1.2px at 26% 80%,rgba(255,255,255,.48),transparent 60%)}
@keyframes lxTw{0%,100%{opacity:.6}50%{opacity:1}}
.lx-constel{position:absolute;right:3%;top:50%;transform:translateY(-50%);width:330px;height:330px;opacity:.95;pointer-events:none;animation:lxConFloat 12s ease-in-out infinite}
@keyframes lxConFloat{0%,100%{transform:translateY(-50%)}50%{transform:translateY(calc(-50% - 12px))}}
.lx-constel line{stroke:rgba(150,120,240,.26);stroke-width:1}
.lx-constel circle{fill:#cbbaff;filter:drop-shadow(0 0 5px rgba(168,128,255,.9));animation:lxNode 4.5s ease-in-out infinite}
@keyframes lxNode{0%,100%{opacity:.5}50%{opacity:1}}
.lx-part{position:absolute;border-radius:50%;background:rgba(214,196,255,.85);box-shadow:0 0 9px rgba(172,132,255,.9);animation:lxDrift linear infinite}
.lx-part.p1{width:5px;height:5px;left:57%;bottom:14%;animation-duration:15s}
.lx-part.p2{width:4px;height:4px;left:74%;bottom:8%;animation-duration:19s;animation-delay:-4s}
.lx-part.p3{width:6px;height:6px;left:66%;bottom:22%;animation-duration:23s;animation-delay:-9s}
.lx-part.p4{width:3px;height:3px;left:85%;bottom:12%;animation-duration:17s;animation-delay:-2s}
@keyframes lxDrift{0%{transform:translateY(20px);opacity:0}12%{opacity:1}86%{opacity:1}100%{transform:translateY(-160px);opacity:0}}
/* ONE card, top-right: the XLM price chip EXPANDS to also hold the 2x2 stats grid (mirrors Pools .lm-chip).
   Fixed min column widths + chip min-width so the card never reflows/squeezes as "\\u2014" placeholders fill in. */
.lumos-promo .lm-chip{width:auto!important;max-width:none!important;min-width:302px;box-sizing:border-box;display:flex!important;flex-direction:column;padding:17px 23px!important;z-index:4;background:linear-gradient(158deg,rgba(255,255,255,.12),rgba(255,255,255,.035))!important;border:1px solid rgba(255,255,255,.18)!important;border-radius:17px!important;backdrop-filter:blur(24px) saturate(1.4)!important;-webkit-backdrop-filter:blur(24px) saturate(1.4)!important;box-shadow:0 20px 55px rgba(6,2,20,.5),inset 0 1px 0 rgba(255,255,255,.28)!important}
.lumos-promo .lm-chip .lx-dxstats{order:1}                          /* stats grid on TOP (Volume/Liquidity, Markets/Top Pair) */
.lumos-promo .lm-chip .p1{order:2;font-size:12px;margin-top:14px;padding-top:13px;border-top:1px solid rgba(255,255,255,.14);color:rgba(228,230,245,.6)!important}   /* XLM price block moved to the BOTTOM */
.lumos-promo .lm-chip .p2,.lumos-promo .lm-chip .p2 .lc-money{order:3;font-size:28px!important;line-height:1.05;color:#fff!important}   /* SAME size as the other stat values */
.lumos-promo .lm-chip .p3{order:4;font-size:12px}
/* match the Pools card's heading/description sizes (Trade rendered them smaller: 26px/13px vs 38px/15.5px) */
.lumos-promo .lm-h{font-size:38px!important;line-height:1.08!important;letter-spacing:-.01em;color:#fff!important}
.lumos-promo .lm-sub{font-size:15.5px!important;line-height:1.55!important;color:rgba(228,230,245,.78)!important}
/* keep the heading/description/button clear of the (now wider) top-right card so they don't overlap */
.lumos-promo .lm-c{max-width:calc(100% - 388px)!important}
@media(max-width:880px){.lumos-promo .lm-c{max-width:100%!important}.lumos-promo .lm-chip{position:static!important;margin:0 0 16px;display:inline-flex!important;min-width:0}}
.lx-dxstats{display:grid;grid-template-columns:118px 172px;gap:15px 22px}
.lx-dxstat{display:flex;flex-direction:column;gap:3px;min-width:0}
.lx-dxstat .v{font:800 28px/1.05 'Hanken Grotesk',sans-serif;color:#fff!important;letter-spacing:-.01em;white-space:nowrap;display:flex;align-items:center;gap:10px}
.lx-dxstat .l{font:600 12px/1.2 'JetBrains Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:rgba(228,230,245,.6)!important}
.lx-dxstat[data-k=top] .v{font-size:19px}
.lx-dxpair{display:inline-flex;flex:0 0 auto}
.lx-dxpair span{display:block;width:30px;height:30px;border-radius:50%;background:#222 center/cover no-repeat;border:2.5px solid var(--surface-2,#f0f1f4);box-shadow:0 2px 6px rgba(0,0,0,.4)}
.lx-dxpair .pb{margin-left:-11px}
/* ---- Market Movers: symmetric body — price/vol (left) + Trades 24h (right), spark spans below ---- */
.dex-mover-body{display:flex;justify-content:space-between;align-items:flex-end;gap:10px}
.dex-mover-l{min-width:0}
.dex-mover-r{text-align:right;flex:0 0 auto}
.dex-mover-trades{font:800 18px/1.05 'Hanken Grotesk',sans-serif;color:var(--text)}
.dex-mover-tlabel{font:600 9.5px/1.2 'JetBrains Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:var(--text-soft);margin-top:3px;white-space:nowrap}
/* ---- All Trading Pairs: Trades (24h) column (header th inserted via JS) ---- */
.th-trades{text-align:right!important}
.dex-mk-trades-td{text-align:right}
.dex-mk-trades{font-weight:700;white-space:nowrap}
/* kill two stray tiny logos the site's [data-logo] applier paints onto non-logo elements:
   (1) #dexMintTabs = an empty 6px leftover in the New Mints header (data-logo="APT");
   (2) .dex-mover-pct = the % badge, which during LOAD (empty "\\u2014") gets tagged data-logo=<ticker> and
       painted with a tiny logo until the real % lands. Only suppress while it carries data-logo -> loaded pills untouched. */
#dexMintTabs,.dex-mints-tabs{display:none!important}
.dex-mover-pct[data-logo]{background-image:none!important;box-shadow:none!important}
/* the avatar-painter sometimes injects a stray <svg> initials-avatar INTO our painter-proof icons (it broke the
   LUMOS logo in All Trading Pairs). Our real logo lives in ::before -> hide any injected svg child so it can't cover it. */
.dex-mint-ic[data-lxic]>svg,.dex-mover-ico[data-lxic]>svg,.dex-mk-pair-ic[data-lxic]>svg{display:none!important}
/* New Mints: 3 symmetric stat columns (Volume / Trades / Holders), right-aligned */
.dex-mint-stats{display:flex;gap:22px;flex:0 0 auto;margin-left:auto;align-items:flex-start}
.dex-mint-stat{display:flex;flex-direction:column;align-items:flex-end;min-width:60px}
.dex-mint-stat .l{font:600 10px/1 'JetBrains Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:var(--text-soft,#6f6f79);margin-bottom:6px}
.dex-mint-stat .v{font-weight:700;font-size:14px;color:var(--text,#0e0e10);white-space:nowrap;line-height:1.25;text-align:right}
/* the dollar figure is a second line under the XLM price, not a continuation of it */
.dex-mint-stat .v .sub{display:block;font-weight:600;font-size:11.5px;color:var(--text-soft,#6f6f79);margin-top:3px;letter-spacing:0}
/* Price carries the longest string in the row, so it gets room; the counts stay narrow */
.dex-mint-stat:first-child{min-width:104px}
</style>`;

const SCRIPT = `<script id="lx-dexmain">(function(){
  // Verified issuers come from _tools/lib.js so every page ticks the same set — a list that drifted
  // between screens would make an asset trustworthy here and not there.
  var VFD={"USDC|GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN":"circle.com","EURC|GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2":"circle.com","yXLM|GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55":"ultracapital.xyz","yUSDC|GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF":"ultracapital.xyz","SHX|GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEKEBR7UCHEUUEK72N7I7KJ6JH":"stronghold.co","LUMOS|GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S":"lumosdao.io","AQUA|GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA":"aqua.network"};
  var VTICK='<span class="lx-vtick" title="Verified issuer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>';
  function vtick(c,i){ return VFD[c+"|"+i]?VTICK:""; }
  if(window.__lxDEX)return;window.__lxDEX=true;
  var H="https://horizon.stellar.org";                       // MAINNET (+ lobstr fallback in j())
  var CG="https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd&include_24hr_change=true";
  var LUMOS_LOGO="https://stellar.myfilebase.com/ipfs/QmTrohhpDADXPw9fkLT2J8aip7SxZEoqcvpZ7jBgW9HYSp";

  // ---- curated real mainnet asset universe (no all-markets endpoint exists on Horizon) ----
  // logo = hardcoded real logo URL so it renders IMMEDIATELY (no placeholder-avatar flash); toml image is a
  // best-effort upgrade only for assets without a hardcoded one.
  var ASSETS=[
    {code:"USDC", issuer:"GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", cat:"stable",  b:"#2775ca", logo:"https://assets.coingecko.com/coins/images/6319/small/usdc.png"},
    {code:"EURC", issuer:"GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2", cat:"stable",  b:"#1a4fb4", logo:"https://assets.coingecko.com/coins/images/26045/small/euro.png"},
    {code:"ARST", issuer:"GCSAZVWXZKWS4XS223M5F54H2B6XPIIXZZGP7KEAIU6YSL5HDRGCI3DG", cat:"stable",  b:"#5b9bd5"},
    {code:"AQUA", issuer:"GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA", cat:"utility", b:"#7b3ff2", logo:"https://aqua.network/assets/img/aqua-logo.png"},
    {code:"yXLM", issuer:"GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55", cat:"utility", b:"#08b5e5", logo:"https://assets.coingecko.com/coins/images/100/small/fmpFRHHQ_400x400.jpg"},
    {code:"SHX",  issuer:"GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEKEBR7UCHEUUEK72N7I7KJ6JH", cat:"utility", b:"#3fb89a"},
    {code:"BTC",  issuer:"GAUTUYY2THLF7SGITDFMXJVYH3LHDSMGEAKSBU267M2K7A3W543CKUEF", cat:"utility", b:"#f7931a", logo:"https://assets.coingecko.com/coins/images/1/small/bitcoin.png"},
    {code:"LUMOS",issuer:"GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S", cat:"utility", b:"#ea6a2c", logo:"https://stellar.myfilebase.com/ipfs/QmTrohhpDADXPw9fkLT2J8aip7SxZEoqcvpZ7jBgW9HYSp"}
  ];
  var byCode={}; ASSETS.forEach(function(a){ byCode[a.code]=a; a.px=0; a.chg=null; a.vol=null; a.high=null; a.low=null;
    a.tvlUsd=null; a.holders=null; a.supply=null; a.spark=null; a.domain=null; a.img=null; a.trades=null; });
  // ---- LumosCore-native assets: issuer home_domain = lumoscore.com (minted through our Launchpad) ----
  var NATIVE=[], nativeState=0;                             // 0 idle | 1 loading | 2 loaded
  var SX="https://api.stellar.expert/explorer/public/asset?search=lumoscore&limit=200";
  var NKEY="lumos.native.v1", NTTL=216e5;                       // 6h: identity changes slowly, prices do not
  function nativeCached(){
    try{ var c=JSON.parse(localStorage.getItem(NKEY)||"null");
      return (c&&c.ts&&(Date.now()-c.ts<NTTL)&&c.a&&c.a.length)?c.a:null; }catch(e){ return null; }
  }
  function nativeSave(list){
    try{ localStorage.setItem(NKEY,JSON.stringify({ts:Date.now(),a:list.map(function(x){
      return {c:x.code,i:x.issuer,l:x.logo||"",d:x.domain||"",t:x.created||0}; })})); }catch(e){}
  }
  // one shape for both paths, so a cached roster and a fresh one cannot drift
  function nativeMake(code,iss,logo,dom,created){
    var key=byCode[code]?code+"~"+iss.slice(0,4):code;
    if(byCode[key])return null;
    var a={code:code,issuer:iss,cat:"native",tkr:key,b:"#3d4351",created:(+created||0),
      logo:logo||"",domain:dom||"",px:0,chg:null,vol:null,high:null,low:null,tvlUsd:null,
      holders:null,supply:null,spark:null,img:null,trades:null};
    byCode[key]=a; NATIVE.push(a); return a;
  }
  // One request per 16 assets, served from the edge cache. Falls back to Horizon per asset if the
  // endpoint is unreachable, so this can never be the reason a price is missing.
  var BATCH=16;
  function batchPx(list){
    var want=list.filter(function(a){ return a&&a.code&&a.issuer; });
    if(!want.length)return Promise.resolve();
    var jobs=[];
    for(var i=0;i<want.length;i+=BATCH)jobs.push(want.slice(i,i+BATCH));
    return Promise.all(jobs.map(function(grp){
      var qs=grp.map(function(a){ return a.code+"-"+a.issuer; }).join(",");
      return fetchJ("/lxapi/dexassets?a="+encodeURIComponent(qs)).then(function(d){
        if(!d||!d.a)throw new Error("empty");
        grp.forEach(function(a){
          var v=d.a[a.code+"-"+a.issuer]; if(!v)return;
          if(v.px>0)a.px=v.px;
          if(v.chg!=null)a.chg=v.chg;
          if(v.vol!=null)a.vol=v.vol;
          if(v.high!=null)a.high=v.high;
          if(v.low!=null)a.low=v.low;
          if(v.tr!=null)a.trades=v.tr;
          if(v.ho!=null)a.holders=v.ho;
          if(v.su!=null)a.supply=v.su;
        });
        touch();
      }).catch(function(){
        // endpoint down -> the old path, so the page degrades instead of emptying
        return Promise.all(grp.map(function(a){ return loadAssetLite(a).catch(function(){}); }));
      });
    }));
  }
  // Sparklines and TVL are the bulk of the remaining Horizon traffic, and that traffic is what throttles
  // the endpoint the prices come from. Hold them until the numbers are painted, then trickle in fours.
  var EXTRA_HOLD=1200;
  function deferExtras(list){
    setTimeout(function(){ (function wave(i){ if(i>=list.length)return;
      Promise.all(list.slice(i,i+4).map(function(a){ return rowExtras(a).catch(function(){}); }))
        .then(function(){ wave(i+4); },function(){ wave(i+4); });
    })(0); }, EXTRA_HOLD);
  }
  // Decorative extras, fetched only after the numbers are showing: the 7d sparkline and pool TVL.
  function rowExtras(a){
    if(a.__extra)return Promise.resolve(); a.__extra=1;
    var atype=a.code.length<=4?"credit_alphanum4":"credit_alphanum12";
    var base="base_asset_type="+atype+"&base_asset_code="+a.code+"&base_asset_issuer="+a.issuer+"&counter_asset_type=native";
    if(a.domain)loadToml(a,a.domain);
    return Promise.all([
      j(H+"/trade_aggregations?"+base+"&resolution=3600000&order=desc&limit=168").then(function(d){
        var r=recs(d).slice().reverse();
        var pts=r.map(function(x){ return +x.avg||+x.close||0; }).filter(function(v){ return v>0; });
        if(pts.length>=2)a.spark=pts; touch(); }).catch(function(){}),
      j(H+"/liquidity_pools?reserves="+a.code+":"+a.issuer+"&limit=200").then(function(d){
        a.poolsRaw=recs(d).map(function(pl){ var nat=0,ass=0;
          (pl.reserves||[]).forEach(function(rv){ if(rv.asset==="native")nat=+rv.amount;
            else if(rv.asset.indexOf(a.code+":"+a.issuer)===0)ass=+rv.amount; });
          return {nat:nat,ass:ass}; });
        computeTvl(a); touch(); }).catch(function(){})
    ]);
  }
  function nativePrice(add){
    // ONLY the five the mints box shows, and only two requests each. Everything else is fetched when a
    // row is actually rendered -- see priceVisible(). Sweeping the roster here is what made the page
    // fire ~210 requests before showing a single price.
    var _first=add.slice().sort(function(x,y){ return (y.created||0)-(x.created||0); }).slice(0,5);
    _first.forEach(function(a){ a.__lite=1; a.__px=1; });
    // five assets, one request -- and the edge is not rate-limited the way each visitor was, which is
    // what used to leave ZERO and UPT permanently showing a dash
    MINTS_READY=batchPx(_first).then(function(){ nativeState=2; touch(); },function(){ nativeState=2; touch(); });
  }
  // Rows on screen get the full loadAsset (the table shows TVL and a sparkline); in waves of four so a
  // page turn cannot open 25 sockets at once.
  var MINTS_READY=null;                                       // resolves when the mints box has its prices
  function priceVisible(list){
    var need=list.filter(function(a){ return a&&!a.__px; });
    if(!need.length)return;
    need.forEach(function(a){ a.__px=1; });
    var gate=MINTS_READY||Promise.resolve();
    gate.then(function(){
      // numbers first, in one or two requests; the sparkline and TVL follow in waves of four
      batchPx(need).then(function(){ deferExtras(need); });
    });
  }
  function loadNative(){
    if(nativeState)return; nativeState=1;
    // LUMOS is the platform's own token, but its issuer still declares the pre-rename lumosdao.io, so a
    // strict domain match drops it from its own tab. Pin it in until that home_domain is updated.
    var l=byCode["LUMOS"]; if(l&&NATIVE.indexOf(l)<0)NATIVE.push(l);
    touch();
    var cached=nativeCached();
    if(cached){
      var addC=[];
      cached.forEach(function(x){ var a=nativeMake(x.c,x.i,x.l,x.d,x.t); if(a)addC.push(a); });
      touch(); nativePrice(addC);
      return;                                                  // refreshed on the next cold load
    }
    fetchJ(SX).then(function(d){
      var r=(d&&d._embedded&&d._embedded.records)||[], add=[];
      r.forEach(function(x){
        if(String(x.domain||"").toLowerCase()!=="lumoscore.com")return;
        var q0=String(x.asset||"").split("-"), code=q0[0], iss=q0[1];
        if(!code||!iss||code.length>12||iss.length!==56)return;
        // Retired and mistyped tickers linger in the index as husks: zero supply, no trustlines, no toml.
        // They cannot be traded, and padding the tab with dead rows buries the real ones.
        var tl=x.trustlines; tl=(tl&&typeof tl==="object"&&tl.length)?(+tl[0]||0):(+tl||0);
        if(!(+x.supply>0)||tl<1)return;
        var key=byCode[code]?code+"~"+iss.slice(0,4):code;
        if(byCode[key])return;
        var a={code:code,issuer:iss,cat:"native",tkr:key,b:"#3d4351",created:(+x.created||0),
          logo:(x.tomlInfo&&x.tomlInfo.image)||"",domain:x.domain||"",
          px:0,chg:null,vol:null,high:null,low:null,tvlUsd:null,holders:null,
          supply:null,spark:null,img:null,trades:null};
        byCode[key]=a; NATIVE.push(a); add.push(a);
      });
      touch();
      nativeSave(NATIVE.filter(function(x){ return x.cat==="native"; }));
      // The mints box shows the five NEWEST, and they can sit anywhere in discovery order -- so price
      // Same routine the cached path uses: price the five the mints box shows, and stop. Everything
      // else is fetched by priceVisible() when a row is rendered.
      nativePrice(add);
    }).catch(function(){ nativeState=0; });                  // allow a retry on the next click
  }
  // "All" means every pair LumosCore lists, curated majors AND our own Launchpad tokens. Identity dedupe,
  // not code+issuer: LUMOS is literally the same object in both lists, pinned into NATIVE by loadNative.
  function allAssets(){ var out=ASSETS.slice();
    for(var i=0;i<NATIVE.length;i++)if(out.indexOf(NATIVE[i])<0)out.push(NATIVE[i]);
    return out; }
  function curFilter(){ var el=q(".dex-mk-filter.active"); return (el&&el.getAttribute)?(el.getAttribute("data-filter")||"all"):"all"; }
  // Newest first. Assets we have no created stamp for sort last rather than jumping to the top on a 0.
  function mintList(){
    return NATIVE.slice()
      .filter(function(a){ return a.cat==="native"; })            // LUMOS is pinned into NATIVE but was not minted here
      .sort(function(x,y){ return (y.created||0)-(x.created||0); })
      .slice(0,5);
  }
  var MINTS=["LUMOS","AQUA","EURC","ARST","SHX"];             // "new mints" subset (LUMOS = the project token, tagged NEW)

  // seed XLM/USD from a shared localStorage cache so a CoinGecko 429 never blanks the USD values (falls back
  // to the last-known price, <=6h old; the shared "lumos.xlmUsd" key is written by every page on success).
  var xlmUsd=(function(){try{var c=JSON.parse(localStorage.getItem("lumos.xlmUsd")||"null");return (c&&+c.v>0&&(Date.now()-c.ts<216e5))?+c.v:0;}catch(e){return (window.__lxXlmUsd||0);}})(), xlmChg=null;
  var DV=0;                                                   // data version — bumped only when real data lands

  // ---- helpers (mirrors _dexassetdata) ----
  function fetchJ(u){ return fetch(u).then(function(r){ if(!r.ok)throw new Error(r.status); return r.json(); }); }
  // at most MAXQ requests in flight; everything else waits its turn
  function wait(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  var MAXQ=6, qRun=0, qWait=[];
  function qNext(){ if(qRun>=MAXQ||!qWait.length)return; qRun++; var t=qWait.shift();
    t.go().then(t.ok,t.no).then(function(){ qRun--; qNext(); },function(){ qRun--; qNext(); }); }
  function queued(go){ return new Promise(function(ok,no){ qWait.push({go:go,ok:ok,no:no}); qNext(); }); }
  function j(u){
    return queued(function(){
      return fetchJ(u).catch(function(e){
        // A 429 arrives without CORS headers, so we cannot tell it apart from a network fault -- assume
        // the worse of the two and back off. Retrying instantly is what deepens a rate limit.
        return wait(500).then(function(){ return fetchJ(u); }).catch(function(){
          return wait(1400).then(function(){ return fetchJ(u); }).catch(function(){
            if(u.indexOf("horizon.stellar.org")>=0)return fetchJ(u.replace("horizon.stellar.org","horizon.stellar.lobstr.co"));
            throw e; }); });
      });
    });
  }
  function q(s,r){ return (r||document).querySelector(s); }
  function qa(s,r){ return [].slice.call((r||document).querySelectorAll(s)); }
  function recs(d){ return (d&&d._embedded&&d._embedded.records)||[]; }
  // close/avg round to 7dp; below that they read "0.0000000" though the asset does have a price
  function subPx(r){ var b=+r.base_volume||0, c=+r.counter_volume||0; return (b>0&&c>0)?(c/b):0; }
  function priceUsd(a){ return (a.px||0)*xlmUsd; }
  function num(n){ if(n==null)return "\\u2014"; return Math.round(+n||0).toLocaleString("en-US"); }
  // Below 1e-8 a plain decimal is an unreadable run of zeros and exponential notation is trader-hostile,
  // so the zeros get counted into a subscript instead: 0.000000001234 -> 0.0(8)1234. At 1e-8 and above we
  // stay plain and trim the padding.
  //
  // Deliberately free of backslash escapes: this code is emitted through a template literal, which eats
  // one level of them -- a /\.$/ here would ship as /.$/ and delete the last digit of every price.
  var SUBD=String.fromCharCode(8320,8321,8322,8323,8324,8325,8326,8327,8328,8329);
  function zsub(n){ var s=String(n),o=""; for(var i=0;i<s.length;i++)o+=SUBD.charAt(+s.charAt(i)); return o; }
  function trimZ(t){ while(t.length>1&&t.charAt(t.length-1)==="0")t=t.slice(0,-1);
    if(t.charAt(t.length-1)===".")t=t.slice(0,-1); return t; }
  function smallNum(x,sig){ x=+x||0; if(!(x>0))return "0";
    if(x>=1e-8)return trimZ(x.toFixed(8));
    var e=x.toExponential((sig||4)-1), i=e.indexOf("e");
    if(i<0)return String(x);
    var mant=trimZ(e.slice(0,i)).split(".").join(""), exp=-parseInt(e.slice(i+1),10);
    if(!(exp>1))return trimZ(x.toFixed(8));
    return "0.0"+zsub(exp-1)+mant; }
  function usdSmall(x){ x=+x||0; if(x>=1)return "$"+x.toLocaleString("en-US",{maximumFractionDigits:2}); if(x>=0.01)return "$"+x.toFixed(4); if(x>0)return "$"+smallNum(x,4); return "$0"; }
  function abbrUsd(n){ n=+n||0; var a=Math.abs(n); if(a>=1e9)return "$"+(n/1e9).toFixed(2)+"B"; if(a>=1e6)return "$"+(n/1e6).toFixed(2)+"M"; if(a>=1e3)return "$"+(n/1e3).toFixed(1)+"K"; if(a>=1)return "$"+n.toFixed(2); return usdSmall(n); }
  function fmtAmt(n){ n=+n||0; if(n>=1e6)return (n/1e6).toFixed(2)+"M"; if(n>=1e3)return (n/1e3).toFixed(1)+"K"; return n.toFixed(0); }
  function fmtPrice(n){ n=+n||0; if(n>=1000)return n.toFixed(2); if(n>=1)return n.toFixed(4); if(n>=0.01)return n.toFixed(5); if(n>=0.0001)return n.toFixed(7); if(n>0)return smallNum(n,4); return "0"; }
  function shortG(a){ a=String(a||""); return a.length>12?a.slice(0,4)+"\\u2026"+a.slice(-4):a; }
  // circular initial-avatar as an SVG data-URI (fallback logo for arbitrary Stellar tokens)
  function avatarBg(code){ var c=String(code||"?"); var hue=0; for(var i=0;i<c.length;i++)hue=(hue*31+c.charCodeAt(i))%360;
    var init=c.replace(/[^A-Za-z0-9]/g,"").slice(0,2).toUpperCase()||"?"; var fz=init.length>1?15:20;
    var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="hsl('+hue+',60%,50%)"/><text x="20" y="'+(init.length>1?26:27)+'" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="'+fz+'" fill="#fff">'+init+'</text></svg>';
    return "url(\\"data:image/svg+xml,"+encodeURIComponent(svg)+"\\")"; }
  function logoCss(a){ var u=a.logo||a.img; return u?"url("+u+")":avatarBg(a.code); }
  // money value wrapped as a .lc-money span (the site money-formatter keys off data-usd/data-orig -> no revert)
  function lcm(v){ v=+v||0; var s=abbrUsd(v); return '<span class="lc-money" data-usd="'+v+'" data-orig="'+s+'">'+s+'</span>'; }
  function lcmExact(v){ v=+v||0; var s=usdSmall(v); return '<span class="lc-money" data-usd="'+v+'" data-orig="'+s+'">'+s+'</span>'; }
  // paint icons ourselves (painter-proof) after any innerHTML rebuild
  function paintIcons(root){ qa("[data-lxic]",root).forEach(function(ic){ var a=byCode[ic.getAttribute("data-lxic")]; if(!a)return; var css=logoCss(a); if(css&&ic.style.getPropertyValue("--lxvar")!==css)ic.style.setProperty("--lxvar",css); }); }
  function initials(code){ return String(code||"?").replace(/[^A-Za-z0-9]/g,"").slice(0,3); }

  // ---- sparkline (winsorized, real 24x1h points) ----
  function sparkPath(vals){ if(!vals||vals.length<2)return null;
    var s=vals.slice().sort(function(a,b){return a-b;});
    var lo=s[Math.floor(s.length*0.05)]||s[0], hi=s[Math.ceil(s.length*0.95)-1]||s[s.length-1];
    var cl=vals.map(function(v){return Math.max(lo,Math.min(hi,v));});
    var mn=Math.min.apply(null,cl),mx=Math.max.apply(null,cl),rg=(mx-mn)||1;
    var w=88,h=28,n=cl.length,step=w/(n-1);
    return cl.map(function(v,i){ return (i?"L":"M")+(i*step).toFixed(1)+" "+(h-((v-mn)/rg)*(h-4)-2).toFixed(1); }).join(" "); }
  function sparkSvg(vals,up){ var d=sparkPath(vals); var color=up?"#35c07f":"#ff5b5b";
    if(!d)return '<svg class="dex-mk-spark" viewBox="0 0 88 28" preserveAspectRatio="none"></svg>';
    return '<svg class="dex-mk-spark" viewBox="0 0 88 28" preserveAspectRatio="none"><path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }

  // Navigate to the asset page WITH the ?asset= query. window.__lxNav (the site SPA router) drops the query
  // string, landing on the default (LUMOS) page, so use a direct location.href which preserves it.
  function navTo(a){ try{ location.href="lumoscore-dex-asset.html?asset="+a.code+"-"+a.issuer; }catch(e){} }

  // ================= 1) HERO price chip (.lm-chip) =================
  function applyHero(){ var chip=q(".lm-chip"); if(!chip)return;
    var p2=chip.querySelector(".p2"), p3=chip.querySelector(".p3");
    if(p2){ var t=xlmUsd>0?usdSmall(xlmUsd):"\\u2014"; if(p2.textContent!==t)p2.textContent=t; }
    if(p3&&xlmChg!=null){ var up=xlmChg>=0; p3.style.color=up?"var(--green)":"var(--red)";
      var h='<span>'+(up?"\\u25B2":"\\u25BC")+'</span> '+Math.abs(xlmChg).toFixed(2)+'%'; if(p3.innerHTML!==h)p3.innerHTML=h; }
    chip.classList.add("lxd");
  }
  // Replace the "advanced DEX" card's zigzag (svg.lm-svg + .lm-bars) with an orange constellation matching
  // the Pools page's lx-constel (streams + pulsing nodes) plus 5 prominent DATA POINTS (bigger dot + ring).
  // inject the SAME cosmic animation the Pools/AMM hero uses (nebulae + stars + constellation + particles), once
  function applyCosmic(){ var card=q(".lumos-promo"); if(!card||card.querySelector(".lx-cosmic"))return;
    var host=card.querySelector(".lm")||card;
    var d=document.createElement("div"); d.className="lx-cosmic";
    d.innerHTML='<div class="lx-neb n1"></div><div class="lx-neb n2"></div><div class="lx-neb n3"></div><div class="lx-stars"></div>'
      +'<svg class="lx-constel" viewBox="0 0 330 330" xmlns="http://www.w3.org/2000/svg"><g><line x1="52" y1="72" x2="146" y2="46"/><line x1="146" y1="46" x2="238" y2="78"/><line x1="52" y1="72" x2="104" y2="134"/><line x1="146" y1="46" x2="104" y2="134"/><line x1="238" y1="78" x2="202" y2="150"/><line x1="104" y1="134" x2="202" y2="150"/><line x1="238" y1="78" x2="284" y2="166"/><line x1="104" y1="134" x2="68" y2="206"/><line x1="202" y1="150" x2="166" y2="222"/><line x1="284" y1="166" x2="252" y2="242"/><line x1="68" y1="206" x2="166" y2="222"/><line x1="166" y1="222" x2="252" y2="242"/><line x1="166" y1="222" x2="124" y2="272"/><line x1="68" y1="206" x2="124" y2="272"/></g><g><circle cx="52" cy="72" r="3.4" style="animation-delay:-.2s"></circle><circle cx="146" cy="46" r="4" style="animation-delay:-1.4s"></circle><circle cx="238" cy="78" r="3" style="animation-delay:-2.1s"></circle><circle cx="104" cy="134" r="4.4" style="animation-delay:-.8s"></circle><circle cx="202" cy="150" r="3.6" style="animation-delay:-2.7s"></circle><circle cx="284" cy="166" r="2.8" style="animation-delay:-1.1s"></circle><circle cx="68" cy="206" r="3.2" style="animation-delay:-3.2s"></circle><circle cx="166" cy="222" r="4.2" style="animation-delay:-.5s"></circle><circle cx="252" cy="242" r="3" style="animation-delay:-1.9s"></circle><circle cx="124" cy="272" r="3.4" style="animation-delay:-2.4s"></circle></g></svg>'
      +'<div class="lx-part p1"></div><div class="lx-part p2"></div><div class="lx-part p3"></div><div class="lx-part p4"></div>';
    host.insertBefore(d, host.firstChild);
  }
  function applyPromoConstel(){
    var svg=q(".lumos-promo .lm-svg"); if(!svg)return;
    if(svg.classList.contains("lx-dxc")&&svg.querySelector(".lx-dxfloat"))return;    // idempotent (rebuild only if clobbered)
    svg.setAttribute("viewBox","0 0 640 300"); svg.setAttribute("preserveAspectRatio","xMidYMid meet"); svg.classList.add("lx-dxc");
    var L=[[70,90,180,55],[180,55,250,90],[250,90,300,100],[300,100,200,120],[200,120,160,150],[160,150,120,205],[120,205,70,90],[70,90,160,150],[300,100,430,160],[300,100,400,60],[400,60,470,70],[470,70,540,105],[540,105,600,110],[540,105,575,170],[575,170,610,195],[430,160,390,200],[390,200,330,235],[330,235,240,175],[240,175,200,120],[430,160,500,225],[500,225,575,170],[390,200,500,225],[470,70,430,160],[240,175,160,150]];
    var ND=[[70,90,3.2,-0.2],[240,175,3.4,-0.8],[120,205,3,-3.2],[400,60,3.4,-1.1],[500,225,3,-1.9],[610,195,3.2,-2.4],[160,150,3,-1.5],[600,110,3.2,-2.9]];   // small pulsing nodes
    var DP=[[180,55,-0.3],[300,100,-1.4],[430,160,-2.1],[540,105,-0.9],[330,235,-2.7],[200,120,-1.7],[470,70,-0.6],[250,90,-2.3],[575,170,-1.2],[390,200,-3.0]];   // 10 data points (5 added)
    var lines=L.map(function(p){return '<line x1="'+p[0]+'" y1="'+p[1]+'" x2="'+p[2]+'" y2="'+p[3]+'"></line>';}).join("");
    var nodes=ND.map(function(p){return '<circle class="nd" cx="'+p[0]+'" cy="'+p[1]+'" r="'+p[2]+'" style="animation-delay:'+p[3]+'s"></circle>';}).join("");
    var dps=DP.map(function(p){return '<circle class="dpr" cx="'+p[0]+'" cy="'+p[1]+'" r="5.5" style="animation-delay:'+p[1+1]+'s"></circle><circle class="dp" cx="'+p[0]+'" cy="'+p[1]+'" r="5" style="animation-delay:'+p[2]+'s"></circle>';}).join("");
    svg.innerHTML='<g class="lx-dxfloat">'+lines+nodes+dps+'</g>';
  }
  // 5 floating DATA POINTS (real trade stats) on the right of the hero animation — like the Pools .lx-hstats
  var XLM_LOGO="https://assets.coingecko.com/coins/images/100/small/fmpFRHHQ_400x400.jpg";
  function applyHeroStats(){
    var card=q(".lumos-promo"); if(!card)return;
    var chip=card.querySelector(".lm-chip");                      // ONE card: put the stats INSIDE the XLM price chip (top-right, like Pools)
    var box=(chip||card).querySelector(".lx-dxstats");
    if(!box){ box=document.createElement("div"); box.className="lx-dxstats";   // 2x2 grid like the Pools .lx-hstats
      box.innerHTML='<div class="lx-dxstat" data-k="vol"><span class="v">\\u2014</span><span class="l">24h Volume</span></div>'
        +'<div class="lx-dxstat" data-k="liq"><span class="v">\\u2014</span><span class="l">Liquidity</span></div>'
        +'<div class="lx-dxstat" data-k="mkts"><span class="v">'+allAssets().length+'</span><span class="l">Markets</span></div>'
        +'<div class="lx-dxstat" data-k="top"><span class="v"><span class="lx-dxpair"><span class="pa"></span><span class="pb"></span></span><span class="lx-dxtxt">\\u2014</span></span><span class="l">Top Pair</span></div>';
      (chip||card).appendChild(box);
    }
    if(!window.__lxDEXloaded)return;                              // reveal with the rest, not one by one
    // Sum what the page actually lists. Leaving these on the curated 8 while the table says 39 pairs
    // would put two different definitions of "this exchange" on one screen.
    var _agg=allAssets();
    var vol=0,liq=0; _agg.forEach(function(a){ if(a.vol!=null)vol+=a.vol*xlmUsd; if(a.tvlUsd!=null)liq+=a.tvlUsd; });
    var top=_agg.slice().filter(function(a){return a.vol!=null&&a.vol>0;}).sort(function(a,b){return (b.vol||0)-(a.vol||0);})[0];
    function set(k,v){ var el=box.querySelector('[data-k="'+k+'"] .v'); if(el&&el.innerHTML!==v)el.innerHTML=v; }
    set("vol",vol>0?abbrUsd(vol):"\\u2014"); set("liq",liq>0?abbrUsd(liq):"\\u2014");
    set("mkts",String(_agg.length));   // the strip is built once; the roster grows after
    // Top Pair cell: two overlapping token logos (asset + XLM) + the pair name
    if(top){ var pa=box.querySelector('[data-k="top"] .pa'), pb=box.querySelector('[data-k="top"] .pb'), txt=box.querySelector('[data-k="top"] .lx-dxtxt');
      if(pa){ var pc=logoCss(top); if(pa.style.backgroundImage!==pc)pa.style.backgroundImage=pc; }
      if(pb){ var xc="url("+XLM_LOGO+")"; if(pb.style.backgroundImage!==xc)pb.style.backgroundImage=xc; }
      if(txt){ var tt=top.code+" / XLM"; if(txt.textContent!==tt)txt.textContent=tt; }
    }
  }

  // ================= 2) NEW MINTS (#dexMintsList) =================
  // In-place update helpers: build each section's skeleton ONCE (all rows, real tickers/icons, "\\u2014"
  // placeholders), then fill VALUES in place on every data tick. No innerHTML rebuild per tick -> kills the
  // "loading one by one" pop-in and the nonstop glitch that came from rebuilding on ~40 streamed updates.
  function setTxt(el,t){ if(el&&el.textContent!==t)el.textContent=t; }
  function setHTML(el,h){ if(el&&el.innerHTML!==h)el.innerHTML=h; }
  function fillSpark(root,vals,up){ if(vals&&vals.length>=2)up=vals[vals.length-1]>=vals[0]; var svg=q(".dex-mk-spark",root); if(!svg)return; var d=sparkPath(vals);
    var want=d?'<path d="'+d+'" fill="none" stroke="'+(up?"#35c07f":"#ff5b5b")+'" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path>':"";
    if(svg.innerHTML!==want)svg.innerHTML=want; }
  function renderMints(){ var list=q("#dexMintsList"); if(!list)return;
    loadNative();                                              // this list IS the native roster
    // The design ships "New Mints on Stellar" and re-renders the title in place, so the correction is
    // re-asserted rather than written once.
    try{ var mt=q(".dex-mints-title"); if(mt&&!mt.__lxT){ mt.__lxT=1;
      var fixT=function(){ [].slice.call(mt.childNodes).forEach(function(tn){
        if(tn.nodeType===3&&/New Mints on Stellar|Featured on Stellar/.test(tn.nodeValue))
          tn.nodeValue=tn.nodeValue.replace(/New Mints on Stellar|Featured on Stellar/,"New mints on LumosCore"); }); };
      fixT(); try{ new MutationObserver(fixT).observe(mt,{childList:true,characterData:true,subtree:true}); }catch(_e){}
    } }catch(_){}

    var rows=mintList();
    if(!rows.length){
      if(!list.__lxEmpty){ list.__lxEmpty=1;
        list.innerHTML='<div class="dex-mint-row" style="justify-content:center;color:var(--text-soft);font-size:14px">Loading mints'+String.fromCharCode(8230)+'</div>'; }
      return;
    }
    list.__lxEmpty=0;
    // rebuild only when WHICH assets are listed changes -- not on every price tick, or the row under the
    // pointer is destroyed mid-hover
    var sig=rows.map(function(a){ return a.tkr||a.code; }).join("|");
    if(list.__lxsig!==sig){
      list.__lxsig=sig;
      list.innerHTML=rows.map(function(a){
        return '<div class="dex-mint-row" data-tkr="'+(a.tkr||a.code)+'">'
          +'<span class="dex-mint-ic" data-lxic="'+a.code+'" style="background:'+a.b+'">'+initials(a.code)+'</span>'
          +'<div class="dex-mint-meta">'
            +'<div class="dex-mint-name">'+a.code+'</div>'
            +'<div class="dex-mint-sub">\\u2014</div>'
          +'</div>'
          +'<div class="dex-mint-stats">'
            +'<div class="dex-mint-stat"><span class="l">Price</span><span class="v" data-k="px">\\u2014</span></div>'
            +'<div class="dex-mint-stat"><span class="l">Market cap</span><span class="v" data-k="mcap">\\u2014</span></div>'
            +'<div class="dex-mint-stat"><span class="l">Holders</span><span class="v" data-k="holders">\\u2014</span></div>'
          +'</div>'
        +'</div>'; }).join("");
      paintIcons(list);
      qa(".dex-mint-row",list).forEach(function(row){ row.addEventListener("click",function(){
        var a=byCode[row.getAttribute("data-tkr")]; if(a)navTo(a); }); });
      list.classList.add("lxd");
    }
    qa(".dex-mint-row[data-tkr]",list).forEach(function(row){
      var a=byCode[row.getAttribute("data-tkr")]; if(!a)return; paintIcons(row);
      setTxt(row.querySelector(".dex-mint-sub"),shortG(a.issuer));
      if(!window.__lxDEXloaded)return;
      // price in XLM with the dollar underneath -- the asset trades in XLM, the reader thinks in dollars
      var pxEl=row.querySelector('[data-k="px"]');
      if(pxEl){ var pu=priceUsd(a);
        setHTML(pxEl, a.px>0 ? (fmtPrice(a.px)+' XLM<span class="sub">'+(pu>0?usdSmall(pu):"")+'</span>') : "\\u2014"); }
      // supply x price: both already fetched by loadAsset, so this costs nothing extra
      var mc=(a.supply!=null&&a.px>0&&xlmUsd>0)?(a.supply*a.px*xlmUsd):null;
      setTxt(row.querySelector('[data-k="mcap"]'),mc!=null?abbrUsd(mc):"\\u2014");
      setTxt(row.querySelector('[data-k="holders"]'),a.holders!=null?num(a.holders):"\\u2014");
    });
  }

  // ================= 3) MARKET MOVERS (#dexMoverGrid) =================
  // The order is FROZEN: during load we show a stable set (no continuous re-sort glitch of the % on the right),
  // then compute the real top-4 by |24h change| ONCE all data is in, and keep that order.
  // frozen top-4 PER category: each tab keeps its OWN stable order (no re-sort glitch), but switching tabs
  // now yields the correct set (previously a single global freeze made all 3 tabs show the same 4 assets).
  var _moverFrozen={};
  function moverCat(){ var t=q(".dex-mover-tab.active"); return (t&&t.getAttribute)?(t.getAttribute("data-cat")||"gainers"):"gainers"; }
  // Takes an optional category so the mobile renderer can ask for a specific tab. Without it, the
  // category comes from ".dex-mover-tab.active" — a selector the mobile markup does not have, so a
  // mobile caller silently got "gainers" for all three tabs.
  function moverData(forceCat){
    if(!window.__lxDEXloaded)return ASSETS.slice(0,4);           // stable placeholder order during load
    var cat=forceCat||moverCat();
    if(_moverFrozen[cat])return _moverFrozen[cat].map(function(c){return byCode[c];}).filter(Boolean);
    var d=ASSETS.slice();
    if(cat==="losers")d=d.filter(function(a){return a.chg!=null&&a.chg<0;}).sort(function(a,b){return a.chg-b.chg;});
    else if(cat==="volume")d=d.sort(function(a,b){return (b.vol||0)-(a.vol||0);});
    else d=d.filter(function(a){return a.chg!=null&&a.chg>=0;}).sort(function(a,b){return b.chg-a.chg;});
    if(d.length<4)d=ASSETS.slice().sort(function(a,b){return Math.abs(b.chg||0)-Math.abs(a.chg||0);});
    d=d.slice(0,4); _moverFrozen[cat]=d.map(function(a){return a.code;}); return d;
  }
  function renderMovers(){ var grid=q("#dexMoverGrid"); if(!grid)return;
    var data=moverData(); var sig=data.map(function(a){return a.code;}).join(",");
    if(grid.__lxsig!==sig || !grid.querySelector(".dex-mover-card[data-tkr]")){    // rebuild only when the top-4 order changes
      grid.innerHTML=data.map(function(a){
        return '<div class="dex-mover-card" data-tkr="'+a.code+'" data-cat="'+a.cat+'">'
          +'<div class="dex-mover-head">'
            +'<span class="dex-mover-ico" data-lxic="'+a.code+'" style="background:linear-gradient(135deg,'+a.b+','+a.b+'cc)">'+initials(a.code)+'</span>'
            +'<div class="dex-mover-pair">'+a.code+vtick(a.code,a.issuer)+'<span class="sub">\\u2014</span></div>'
            +'<span class="dex-mover-pct">\\u2014</span>'
          +'</div>'
          +'<div class="dex-mover-body">'
            +'<div class="dex-mover-l">'
              +'<div class="dex-mover-price">\\u2014</div>'
              +'<div class="dex-mover-vol">\\u2014</div>'
            +'</div>'
            +'<div class="dex-mover-r"><div class="dex-mover-trades">\\u2014</div><div class="dex-mover-tlabel">Trades 24h</div></div>'
          +'</div>'
          +sparkSvg(null,true)
        +'</div>'; }).join("");
      grid.__lxsig=sig; paintIcons(grid);
      qa(".dex-mover-card",grid).forEach(function(card){ card.addEventListener("click",function(){ var a=byCode[card.getAttribute("data-tkr")]; if(a)navTo(a); }); });
      grid.classList.add("lxd");
    }
    qa(".dex-mover-card[data-tkr]",grid).forEach(function(card){ var a=byCode[card.getAttribute("data-tkr")]; if(!a)return; paintIcons(card);
      if(!window.__lxDEXloaded)return;                          // reveal all detail values together, not one by one
      var up=(a.chg||0)>=0;
      setTxt(card.querySelector(".dex-mover-pair .sub"),a.domain?a.domain:shortG(a.issuer));
      var pct=card.querySelector(".dex-mover-pct"); if(pct){ pct.className="dex-mover-pct"+(a.chg!=null?(up?" up":" down"):""); setTxt(pct,a.chg!=null?(up?"+":"")+a.chg.toFixed(2)+"%":"\\u2014"); }
      setHTML(card.querySelector(".dex-mover-price"),fmtPrice(a.px)+' <span style="font-size:14px;color:var(--text-soft);font-weight:600">XLM</span>');
      var vu=a.vol!=null?a.vol*xlmUsd:null;
      setHTML(card.querySelector(".dex-mover-vol"),'Vol '+(vu!=null?lcm(vu):"\\u2014")+' \\u00b7 TVL '+(a.tvlUsd!=null?lcm(a.tvlUsd):"\\u2014"));
      setTxt(card.querySelector(".dex-mover-trades"),a.trades!=null?num(a.trades):"\\u2014");
      fillSpark(card,a.spark,up);
    });
  }

  // ================= 4) ALL TRADING PAIRS (#dexMkTbody) =================
  function tableData(){ var f=(q(".dex-mk-filter.active")||{}).getAttribute?(q(".dex-mk-filter.active").getAttribute("data-filter")||"all"):"all";
    var qs=""; var si=q("#dexMkSearch"); if(si)qs=(si.value||"").trim().toLowerCase();
    // Kicked off here rather than on the native tab alone: All lists them too, so they load with the page.
    loadNative();
    var d=(f==="native")?NATIVE.slice():allAssets();
    if(f==="utility")d=d.filter(function(a){return a.cat==="utility";});
    else if(f==="stables")d=d.filter(function(a){return a.cat==="stable";});
    else if(f==="memes")d=[];
    if(qs)d=d.filter(function(a){ return a.code.toLowerCase().indexOf(qs)>=0 || (a.issuer||"").toLowerCase().indexOf(qs)>=0 || (a.domain||"").toLowerCase().indexOf(qs)>=0; });
    return d;
  }
  function tableSig(){ var f=(q(".dex-mk-filter.active")||{}).getAttribute?(q(".dex-mk-filter.active").getAttribute("data-filter")||"all"):"all"; var qs=(q("#dexMkSearch")||{}).value||""; return f+"|"+qs.trim().toLowerCase()+"|"+NATIVE.length+"|"+nativeState; }
  // the thead is design markup (8 cols); insert a "Trades (24h)" th once, right after Volume (24h), so the 24h-activity columns sit together.
  function ensureTradesHeader(){ var tb=q("#dexMkTbody"); if(!tb||!tb.closest)return; var tbl=tb.closest("table"); if(!tbl)return;
    var thr=tbl.querySelector("thead tr"); if(!thr||thr.querySelector(".th-trades"))return;
    var th=document.createElement("th"); th.className="th-trades"; th.textContent="Trades (24h)";
    var volTh=thr.querySelector(".th-vol");
    if(volTh){ thr.insertBefore(th,volTh.nextSibling); } else { thr.appendChild(th); }
  }
  // ---- pagination -----------------------------------------------------------------------------------
  var MK_PER=25, mkPage=1;
  var PG_F='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>';
  var PG_P='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="15 18 9 12 15 6"/></svg>';
  var PG_N='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="9 18 15 12 9 6"/></svg>';
  var PG_L='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>';
  function renderPager(pages){
    var pg=q(".dex-mk-pager"); if(!pg)return;
    // One page needs no controls -- a lone "1" with four dead arrows is furniture, not navigation.
    if(pages<2){ if(pg.__lxh!=="")  { pg.innerHTML=""; pg.__lxh=""; } pg.style.display="none"; return; }
    pg.style.display="";
    var h="";
    function nav(ic,to,lab){ var off=(to<1||to>pages||to===mkPage);
      return '<button class="dex-mk-pgbtn" data-pg="'+to+'" aria-label="'+lab+'"'+(off?' disabled style="opacity:.4;cursor:default"':"")+'>'+ic+'</button>'; }
    h+=nav(PG_F,1,"First")+nav(PG_P,mkPage-1,"Previous");
    // a five-wide window around the current page, with the first/last page always reachable
    var lo=Math.max(1,mkPage-2), hi=Math.min(pages,lo+4); lo=Math.max(1,hi-4);
    if(lo>1){ h+='<button class="dex-mk-pgbtn" data-pg="1">1</button>'; if(lo>2)h+='<span class="dex-mk-dots">\u2026</span>'; }
    for(var i=lo;i<=hi;i++)h+='<button class="dex-mk-pgbtn'+(i===mkPage?" active":"")+'" data-pg="'+i+'">'+i+'</button>';
    if(hi<pages){ if(hi<pages-1)h+='<span class="dex-mk-dots">\u2026</span>'; h+='<button class="dex-mk-pgbtn" data-pg="'+pages+'">'+pages+'</button>'; }
    h+=nav(PG_N,mkPage+1,"Next")+nav(PG_L,pages,"Last");
    if(pg.__lxh!==h){ pg.innerHTML=h; pg.__lxh=h; }
    if(!pg.__lxw){ pg.__lxw=1;
      // CAPTURE, and stop the event here: the layer already runs a window-capture nav handler for rows,
      // and the design has its own click plumbing in this footer.
      pg.addEventListener("click",function(e){
        var b=e.target&&e.target.closest?e.target.closest("[data-pg]"):null; if(!b||b.disabled)return;
        e.preventDefault(); e.stopImmediatePropagation();
        var n=+b.getAttribute("data-pg")||1; if(n===mkPage)return; mkPage=n; guardApply();
        try{ var sec=q(".dex-markets"); if(sec&&sec.scrollIntoView)sec.scrollIntoView({block:"start",behavior:"smooth"}); }catch(_){}
      },true); }
  }
  function renderTable(){ var tb=q("#dexMkTbody"); if(!tb)return;
    try{ ensureTradesHeader(); }catch(_){}
    var all=tableData();
    // A new filter or search starts at page 1 -- but NOT a data refresh. tableSig() also moves as the
    // native roster loads, so keying the reset on it would yank a reader back to page 1 mid-browse.
    var fkey=curFilter()+"|"+(((q("#dexMkSearch")||{}).value)||"").trim().toLowerCase();
    if(tb.__lxfk!==fkey){ tb.__lxfk=fkey; mkPage=1; }
    var pages=Math.max(1,Math.ceil(all.length/MK_PER)); if(mkPage>pages)mkPage=pages;
    var start=(mkPage-1)*MK_PER, data=all.slice(start,start+MK_PER);
    try{ priceVisible(data); }catch(_){}                      // fetch the rows this page actually shows
    var sig=tableSig()+"|p"+mkPage;
    try{ renderPager(pages); }catch(_){}
    // rebuild the skeleton ONLY when the filter/search changes (user action) or our rows were clobbered
    if(tb.__lxsig!==sig || (!tb.querySelector("tr[data-tkr]")&&!tb.querySelector("tr.lx-dex-empty-row"))){
      if(!data.length){ tb.innerHTML='<tr class="lx-dex-empty-row"><td colspan="9"><div class="lx-dex-empty">No matching markets on Stellar right now.</div></td></tr>'; }
      else tb.innerHTML=data.map(function(a){
        return '<tr data-tkr="'+(a.tkr||a.code)+'" data-iss="'+a.issuer+'" data-cat="'+a.cat+'">'
          +'<td><div class="dex-mk-pair-cell">'
            +'<span class="dex-mk-pair-ic" data-lxic="'+a.code+'" style="background:linear-gradient(135deg,'+a.b+','+a.b+'aa)">'+initials(a.code)+'</span>'
            +'<div class="dex-mk-pair-name"><div class="dex-mk-pair-head">'+a.code+vtick(a.code,a.issuer)+'</div><span class="sub">'+(a.domain?a.domain:shortG(a.issuer))+'</span></div>'
          +'</div></td>'
          +'<td><div class="dex-mk-price">\\u2014</div></td>'
          +'<td><div class="dex-mk-change">\\u2014</div></td>'
          +'<td><div class="dex-mk-vol">\\u2014</div></td>'
          +'<td class="dex-mk-trades-td"><div class="dex-mk-trades">\\u2014</div></td>'
          +'<td><div class="dex-mk-tvl">\\u2014</div></td>'
          +'<td><div class="dex-mk-hl">'
            +'<div class="row"><span class="lab">H</span><span class="v-h">\\u2014</span></div>'
            +'<div class="row"><span class="lab">L</span><span class="v-l">\\u2014</span></div>'
          +'</div></td>'
          +'<td style="text-align:right">'+sparkSvg(null,true)+'</td>'
          +'<td style="text-align:right"><button class="dex-mk-action-btn" data-tkr="'+(a.tkr||a.code)+'">Trade</button></td>'
        +'</tr>'; }).join("");
      tb.__lxsig=sig; paintIcons(tb);
      qa("tr[data-tkr]",tb).forEach(function(tr){ tr.addEventListener("click",function(){ var a=byCode[tr.getAttribute("data-tkr")]; if(a)navTo(a); }); });
      qa(".dex-mk-action-btn",tb).forEach(function(btn){ btn.addEventListener("click",function(e){ e.stopPropagation(); var a=byCode[btn.getAttribute("data-tkr")]; if(a)navTo(a); }); });
      var shown=q("#dexMkShown"); if(shown)setTxt(shown,data.length===0?"0":(start+1)+"\\u2013"+(start+data.length));
      var strongs=qa(".dex-mk-page-info strong"); if(strongs[1])setTxt(strongs[1],String(all.length));
      tb.classList.add("lxd");
    }
    // fill values in place (no innerHTML churn -> no glitch); gated so ALL rows' details reveal together
    qa("tr[data-tkr]",tb).forEach(function(tr){ var a=byCode[tr.getAttribute("data-tkr")]; if(!a)return; paintIcons(tr);
      if(!window.__lxDEXloaded)return;                          // reveal all detail values together, not one by one
      var up=(a.chg||0)>=0;
      var pu=priceUsd(a), vu=a.vol!=null?a.vol*xlmUsd:null, hi=a.high!=null?a.high:a.px, lo=a.low!=null?a.low:a.px;
      setHTML(q(".dex-mk-price",tr),fmtPrice(a.px)+' XLM<span class="sub">'+(pu>0?lcmExact(pu):"\\u2014")+'</span>');
      var chg=q(".dex-mk-change",tr); if(chg){ chg.className="dex-mk-change"+(a.chg!=null?(up?" up":" down"):""); setTxt(chg,a.chg!=null?(up?"+":"")+a.chg.toFixed(2)+"%":"\\u2014"); }
      setHTML(q(".dex-mk-vol",tr),(a.vol!=null?fmtAmt(a.vol)+" XLM":"\\u2014")+'<span class="sub">'+(vu!=null?lcm(vu):"")+'</span>');
      setTxt(q(".dex-mk-trades",tr),a.trades!=null?num(a.trades):"\\u2014");
      setHTML(q(".dex-mk-tvl",tr),a.tvlUsd!=null?lcm(a.tvlUsd):"\\u2014");
      setTxt(q(".v-h",tr),fmtPrice(hi)+" XLM"); setTxt(q(".v-l",tr),fmtPrice(lo)+" XLM");
      fillSpark(tr,a.spark,up); paintIcons(tr);
    });
  }

  // ================= apply / observe / boot =================
  function applyAll(){
    try{ applyHero(); }catch(_){}
    try{ applyCosmic(); }catch(_){}             // same nebula/stars/constellation animation as the Pools hero
    try{ applyPromoConstel(); }catch(_){}       // keeps the original .lm-svg zigzag hidden (rebuilt as hidden .lx-dxc)
    try{ applyHeroStats(); }catch(_){}
    try{ renderMints(); }catch(_){}
    try{ renderMovers(); }catch(_){}
    try{ renderTable(); }catch(_){}
  }

  // TVL across an asset's pools valued in USD (native-paired: nat*2; asset-paired: ass*px*2), then *xlmUsd.
  function computeTvl(a){ if(!a.poolsRaw)return; var txlm=0; a.poolsRaw.forEach(function(p){ if(p.nat>0)txlm+=p.nat*2; else if(p.ass>0&&a.px>0)txlm+=p.ass*a.px*2; }); a.tvlXlm=txlm; a.tvlUsd=txlm*xlmUsd; }
  function recomputeAllTvl(){ ASSETS.forEach(computeTvl); }

  // stellar.toml (best-effort; many issuers' domains are CORS-OK) -> [[CURRENCIES]].image for the real logo
  function loadToml(a,domain){
    fetch("https://"+domain+"/.well-known/stellar.toml").then(function(r){ if(!r.ok)throw 0; return r.text(); }).then(function(txt){
      var re=new RegExp("code\\\\s*=\\\\s*[\\"']"+a.code+"[\\"'][^]*?(?=\\\\[\\\\[|$)","i");
      var blk=(txt.match(re)||[""])[0]||txt;
      var img=(blk.match(/image\\s*=\\s*["']([^"']+)["']/i)||[])[1];
      if(img){ a.img=img; touch(); }
    }).catch(function(){});
  }

  // Just enough for a mints row: the latest daily bar (price) and /assets (supply + holders). Two
  // requests instead of five, and none of them the 168-bucket sparkline series.
  function loadAssetLite(a){
    var atype=a.code.length<=4?"credit_alphanum4":"credit_alphanum12";
    var base="base_asset_type="+atype+"&base_asset_code="+a.code+"&base_asset_issuer="+a.issuer+"&counter_asset_type=native";
    return Promise.all([
      j(H+"/trade_aggregations?"+base+"&resolution=86400000&order=desc&limit=1").then(function(d){
        var r=recs(d)[0]; if(r){ a.px=+r.close||+r.avg||subPx(r)||a.px; } }).catch(function(){}),
      j(H+"/assets?asset_code="+a.code+"&asset_issuer="+a.issuer).then(function(d){
        var rec=recs(d)[0]; if(!rec)return;
        if(rec.accounts)a.holders=(+rec.accounts.authorized||0)+(+rec.accounts.authorized_to_maintain_liabilities||0);
        if(rec.balances)a.supply=+rec.balances.authorized||+rec.balances.authorized_to_maintain_liabilities||a.supply;
        else if(rec.amount!=null)a.supply=+rec.amount; }).catch(function(){})
    ]).then(touch);
  }

  function loadAsset(a){
    var atype=a.code.length<=4?"credit_alphanum4":"credit_alphanum12";
    var base="base_asset_type="+atype+"&base_asset_code="+a.code+"&base_asset_issuer="+a.issuer+"&counter_asset_type=native";
    var calls=[];
    // price + 24h change + high/low + 24h volume (daily aggregations)
    calls.push(j(H+"/trade_aggregations?"+base+"&resolution=86400000&order=desc&limit=2").then(function(d){ var r=recs(d);
      if(r[0]){ a.px=+r[0].close||+r[0].avg||subPx(r[0])||a.px; a.vol=+r[0].counter_volume||0; a.high=+r[0].high||0; a.low=+r[0].low||0; a.trades=+r[0].trade_count||0; }
      if(r[0]&&r[1]&&+r[1].close>0)a.chg=((+r[0].close-+r[1].close)/+r[1].close)*100;
      computeTvl(a); touch(); }).catch(function(){}));
    // 7D trend sparkline: the MOST RECENT 168 hourly buckets (=7 days), desc then reversed to chronological.
    // (was resolution=3600000 order=asc limit=24 -> the 24 OLDEST buckets = wrong window under a "7D" label.)
    calls.push(j(H+"/trade_aggregations?"+base+"&resolution=3600000&order=desc&limit=168").then(function(d){ var r=recs(d).slice().reverse();
      var pts=r.map(function(x){ return +x.avg||+x.close||0; }).filter(function(v){ return v>0; }); if(pts.length>=2)a.spark=pts; touch(); }).catch(function(){}));
    // pool TVL
    calls.push(j(H+"/liquidity_pools?reserves="+a.code+":"+a.issuer+"&limit=200").then(function(d){ var r=recs(d);
      a.poolsRaw=r.map(function(p){ var nat=0,ass=0; (p.reserves||[]).forEach(function(rv){ if(rv.asset==="native")nat=+rv.amount; else if(rv.asset.indexOf(a.code+":"+a.issuer)===0)ass=+rv.amount; }); return {nat:nat,ass:ass}; });
      computeTvl(a); touch(); }).catch(function(){}));
    // holders (trustlines) + supply
    calls.push(j(H+"/assets?asset_code="+a.code+"&asset_issuer="+a.issuer).then(function(d){ var rec=recs(d)[0]; if(!rec)return;
      if(rec.accounts)a.holders=(+rec.accounts.authorized||0)+(+rec.accounts.authorized_to_maintain_liabilities||0);
      if(rec.balances)a.supply=+rec.balances.authorized||+rec.balances.authorized_to_maintain_liabilities||a.supply;
      else if(rec.amount!=null)a.supply=+rec.amount; touch(); }).catch(function(){}));
    // issuer home_domain (-> mint/mover sub + stellar.toml logo)
    // home_domain is stable and the cached roster already carries it -- only ask when we do not know
    if(a.domain){ loadToml(a,a.domain); }
    else calls.push(j(H+"/accounts/"+a.issuer).then(function(acc){ a.domain=acc.home_domain||""; touch(); if(acc.home_domain)loadToml(a,acc.home_domain); }).catch(function(){ a.domain=""; }));
    return Promise.all(calls);
  }

  function loadData(){
    j(CG).then(function(d){ if(d&&d.stellar){ if(+d.stellar.usd){ xlmUsd=+d.stellar.usd; try{ localStorage.setItem("lumos.xlmUsd",JSON.stringify({v:xlmUsd,ts:Date.now()})); }catch(_e){} } if(d.stellar.usd_24h_change!=null)xlmChg=+d.stellar.usd_24h_change; } recomputeAllTvl(); touch(); }).catch(function(){});
    // load ALL assets in PARALLEL so values + logos land together (no "loading one by one" cascade). When
    // every asset is in, flag loaded -> the movers compute their final top-4 order ONCE (no re-sort glitch).
    // the curated set the same way as everything else: numbers in one batched request, extras after
    ASSETS.forEach(function(a){ a.__px=1; });
    batchPx(ASSETS).then(function(){ window.__lxDEXloaded=1; try{window.__lxDEXassets=ASSETS;window.__lxDEXmovers=moverData;window.__lxDEXlogoCss=logoCss;}catch(_){} touch(); deferExtras(ASSETS); },
      function(){ window.__lxDEXloaded=1; touch(); });
    // safety: reveal details even if an asset's request hangs (never leave the table stuck on placeholders)
    setTimeout(function(){ if(!window.__lxDEXloaded){ window.__lxDEXloaded=1; try{window.__lxDEXassets=ASSETS;window.__lxDEXmovers=moverData;window.__lxDEXlogoCss=logoCss;}catch(_){} touch(); } }, 4500);
  }

  // dedicated per-section guardian: fires only on a CHILDLIST change of the container (i.e. the design blew
  // away our rows with its mock render). We observe childList ONLY (not subtree/characterData) so the site
  // money-formatter's in-place text tweaks never trigger us, and the render funcs self-skip unless our marker
  // is gone or DV changed -> no MutationObserver ping-pong / renderer freeze.
  function guardEl(sel,fn){ var el=q(sel); if(!el||el.__lxg)return; el.__lxg=1;
    try{ var mo=new MutationObserver(function(){ if(el.__lxgBusy)return; el.__lxgBusy=1; mo.disconnect(); try{ fn(); }catch(_){} try{ mo.observe(el,{childList:true}); }catch(_){} el.__lxgBusy=0; });
      mo.observe(el,{childList:true}); }catch(_){}
  }

  var sched2=false;
  function guardApply(){ try{ applyAll(); }catch(_){} }
  function sched(){ if(sched2)return; sched2=true; setTimeout(function(){ sched2=false; guardApply(); },200); }
  function touch(){ DV++; sched(); }                          // real data landed -> bump version + re-render
  window.__lxDEXapply=guardApply;
  window.__lxDEXloadNative=loadNative;
  window.__lxDEXnativeList=function(){ return {list:NATIVE,state:nativeState}; };
  window.__lxDEXdbg=function(){ return {xlmUsd:xlmUsd,xlmChg:xlmChg,assets:ASSETS.map(function(a){return {code:a.code,px:a.px,chg:a.chg,vol:a.vol,tvlUsd:a.tvlUsd,holders:a.holders,supply:a.supply,domain:a.domain,img:a.img};})}; };

  function boot(){
    guardApply();                                              // synchronous skeleton (real tickers/icons, "\\u2014" values, .lxd) -> no mock flash, no blank
    // The design has its own row/Trade click handler that opens the asset page WITHOUT the ?asset= param
    // (lands on default LUMOS). Preempt it with a document-CAPTURE delegated nav that carries the param and
    // stopImmediatePropagation()s the design's handler. Survives node replacement (delegated) too.
    if(!window.__lxDEXnav){ window.__lxDEXnav=1;
      // WINDOW-capture (the earliest phase) so we run before the design's document-capture nav handler.
      window.addEventListener("click",function(e){ var t=e.target; if(!t||!t.closest)return;
        var el=t.closest(".dex-mk-action-btn[data-tkr],tr[data-tkr],.dex-mint-row[data-tkr],.dex-mover-card[data-tkr]"); if(!el)return;
        var a=byCode[el.getAttribute("data-tkr")]; if(!a)return;
        e.preventDefault(); e.stopImmediatePropagation(); navTo(a);
      },true);
    }
    // Market-mover tab clicks must re-render (the boot interval stops after ~21s, and a tab click alone
    // doesn't change #dexMoverGrid's children, so the childList observer wouldn't fire). Delegated so it
    // survives node replacement; a short + backup tick lets the design toggle .active first.
    if(!window.__lxDEXtab){ window.__lxDEXtab=1;
      document.addEventListener("click",function(e){ var t=e.target&&e.target.closest?e.target.closest(".dex-mover-tab,.dex-mk-filter"):null; if(t){ setTimeout(guardApply,30); setTimeout(guardApply,160); } });
    }
    guardEl("#dexMintsList",renderMints);
    guardEl("#dexMoverGrid",renderMovers);
    guardEl("#dexMkTbody",renderTable);
    loadData();
    var ticks=0, iv=setInterval(function(){ guardApply(); if(++ticks>30)clearInterval(iv); },700);
  }
  if(document.readyState!=="loading")boot(); else document.addEventListener("DOMContentLoaded",boot);
})();<\/script>`;

// ---- inject into every container that has the dex-main keys ----
const files = fs.readdirSync('.').filter(f => /^lumoscore-.*-(desktop|mobile)\.html$/.test(f));
let n = 0, containers = 0;
for (const file of files) {
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;
  for (const k of KEYS) {
    if (!json[k]) continue;
    let p = json[k];
    p = p.replace(/<style id="lx-dexmain-css">[\s\S]*?<\/style>/, '')
         .replace(/<script id="lx-dexmain">[\s\S]*?<\/script>/, '');
    if (p.indexOf('</head>') >= 0) p = p.replace('</head>', STYLE + '</head>');
    else { const hb = p.lastIndexOf('</body>'); p = p.slice(0, hb) + STYLE + p.slice(hb); }
    const bi = p.lastIndexOf('</body>');
    p = p.slice(0, bi) + SCRIPT + p.slice(bi);
    json[k] = p; changed = true; n++;
  }
  if (changed) {
    containers++;
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
console.log('dex-main data (phase 3): injected=' + n + ' keys across ' + containers + ' containers');
