// Public account page -- /account/stellar/<G...>
//
// Every other explorable thing on the site has a page: an asset, a pool, the market. An ACCOUNT did not,
// so a holder in the Holders tab or a participant in a pool was a dead-end string of 56 characters. This
// gives any Stellar address a read-only public profile: what it holds, what it is worth, which pools it is
// in, and what it has been doing.
//
// SHELL BY CLONE. The page is built by taking an existing page out of the container, keeping everything
// outside <main class="page"> -- nav, footer, theme boot, fonts, the search bar -- and replacing only the
// content. Hand-writing a second shell would mean two things to keep in sync, and the clone is why this
// page already matches the rest of the site.
//
// ONE RESPONSIVE PAGE, not a desktop build and a mobile build. Every layout in here is driven by width,
// so the same markup serves lumoscore-account.html, -dark and -mobile. That is deliberate: the recurring
// failure in this codebase is a selector that silently no-ops on the other layout, and the only way to be
// immune is to have one layout.
//
// BUILD ORDER: run this AFTER the chrome transforms. It clones their output, so running it first
// freezes a one-build-old header and footer into this page.
// Usage: node _tools/_accountpage.js [--write]
const fs = require('fs');
const { read, getContents, VERIFIED, DOMAIN_DISPLAY } = require(__dirname + '/lib.js');

// the page we clone the shell from, and the keys we publish
const SHELLS = [
  { shell: 'lumoscore-amm-pool.html',        out: ['lumoscore-account.html', 'lumoscore-account-dark.html'] },
  { shell: 'lumoscore-amm-pool-mobile.html', out: ['lumoscore-account-mobile.html'] },
];

// ---------------------------------------------------------------------------------------------------
// CONTENT
// ---------------------------------------------------------------------------------------------------
const ICO = {
  copy: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>',
  out: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></svg>',
  back: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>'
};

const MAIN_INNER = `
      <div class="crumb lx-crumb"><a href="/dashboard">${ICO.back}<span>Back to dashboard</span></a></div>

      <section class="acc-head">
        <span class="acc-ava-wrap">
          <span class="acc-avatar" id="accAvatar"></span>
          <span class="acc-net" id="accNet" title="Stellar"></span>
        </span>
        <div class="acc-head-body">
          <div class="acc-title-row">
            <h1 class="acc-addr" id="accAddr" title="">&#8212;</h1>
            <button class="acc-copy" id="accCopy" type="button" aria-label="Copy address">${ICO.copy}</button>
          </div>
          <div class="acc-sub" id="accSub"></div>
        </div>
      </section>

      <section class="acc-stats" id="accStats">
        <div class="acc-stat"><span class="l">Portfolio value</span><b class="v" data-k="total">&#8212;</b><span class="s" data-s="total"></span></div>
        <div class="acc-stat"><span class="l">XLM balance</span><b class="v" data-k="xlm">&#8212;</b><span class="s" data-s="xlm"></span></div>
        <div class="acc-stat"><span class="l">Assets held</span><b class="v" data-k="assets">&#8212;</b><span class="s" data-s="assets"></span></div>
        <div class="acc-stat"><span class="l">Pool positions</span><b class="v" data-k="pools">&#8212;</b><span class="s" data-s="pools"></span></div>
      </section>

      <section class="acc-card">
        <div class="acc-tabs" id="accTabs">
          <button class="acc-tab active" data-t="assets" type="button">Assets <span class="acc-n" id="accAssetsN"></span></button>
          <button class="acc-tab" data-t="pools" type="button">Pools <span class="acc-n" id="accPoolsN"></span></button>
        </div>
        <div class="acc-pane" data-p="assets">
          <div class="acc-scroll">
            <table class="acc-tbl" id="accAssetsTbl">
              <thead><tr><th>Asset</th><th class="num">Balance</th><th class="num">Value</th><th></th></tr></thead>
              <tbody><tr class="acc-empty-row"><td colspan="4"><div class="acc-empty">Loading assets&#8230;</div></td></tr></tbody>
            </table>
          </div>
        </div>
        <div class="acc-pane" data-p="pools" hidden>
          <div class="acc-scroll">
            <table class="acc-tbl" id="accPoolsTbl">
              <thead><tr><th>Pool</th><th class="num">Pool share</th><th class="num">Position value</th><th class="num acc-hide-sm">Pool TVL</th><th></th></tr></thead>
              <tbody><tr class="acc-empty-row"><td colspan="5"><div class="acc-empty">Loading pools&#8230;</div></td></tr></tbody>
            </table>
          </div>
        </div>
      </section>
      <section class="acc-card">
        <div class="acc-card-head"><h2>Recent activity</h2><span class="acc-n" id="accActN"></span></div>
        <div class="acc-acts" id="accActs"><div class="acc-empty">Loading activity&#8230;</div></div>
      </section>
`;
const MAIN = '<main class="page">' + MAIN_INNER + '</main>';

// ---------------------------------------------------------------------------------------------------
// STYLE -- width-driven only. No layout here depends on which build key it landed in.
// ---------------------------------------------------------------------------------------------------
const STYLE = `<style id="lx-acc-css">
/* We INJECT this crumb, so it carries its own styling. The design defines .crumb in the desktop file
   only -- the mobile build has no .crumb rule at all, just .crumb-bar (the separate "Back to Pools"
   strip at the top) -- so on a phone the link fell back to browser defaults and rendered as underlined
   #0000EE, which is what "looks weird" was. Styled on our own .lx-crumb class rather than by adding
   another .crumb rule, so nothing the design owns changes; the values match the desktop rules so both
   platforms look the same. */
.lx-crumb{display:flex;align-items:center;gap:8px;font-size:15px;color:var(--text-soft);margin-bottom:16px}
.lx-crumb a{color:var(--text-muted);text-decoration:none;display:inline-flex;align-items:center;gap:4px}
.lx-crumb a:hover{color:var(--accent)}
.lx-crumb a svg{flex:0 0 auto}
.acc-head{display:flex;align-items:flex-start;gap:16px;margin:6px 0 22px}
.acc-ava-wrap{position:relative;flex:0 0 auto;display:inline-block;line-height:0}
.acc-net{position:absolute;right:-1px;bottom:-1px;width:24px;height:24px;border-radius:50%;
  background-size:cover;background-position:center;background-repeat:no-repeat;
  border:2px solid var(--bg,#0b0b0f);box-shadow:0 1px 4px rgba(0,0,0,.55)}
.acc-avatar{display:block;width:64px;height:64px;border-radius:50%;flex:0 0 auto;background:var(--surface-2);
  background-size:cover;background-position:center;border:2px solid var(--border);box-shadow:0 2px 8px rgba(0,0,0,.28)}
.acc-head-body{min-width:0;flex:1 1 auto}
.acc-title-row{display:flex;align-items:flex-start;gap:8px;min-width:0}

.acc-addr{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:17px;font-weight:800;margin:0;
  letter-spacing:-.2px;line-height:1.3;word-break:break-all;overflow-wrap:anywhere}
.acc-copy{flex:0 0 auto;width:24px;height:24px;margin-top:-1px;border-radius:7px;border:1px solid var(--border);
  background:var(--surface-2);color:var(--text-soft);cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
.acc-copy:hover{color:var(--text);border-color:var(--border-strong)}
.acc-sub{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;margin-top:6px;font-size:13.5px;color:var(--text-soft)}
.acc-sub a{color:var(--accent);text-decoration:none;display:inline-flex;align-items:center;gap:4px}
.acc-sub a:hover{text-decoration:underline}
.acc-ctag{display:inline-block;padding:2px 10px;border-radius:999px;font-size:11.5px;font-weight:800;
  letter-spacing:.3px;text-transform:uppercase;color:var(--accent);
  background:color-mix(in srgb,var(--accent) 14%,transparent);
  border:1px solid color-mix(in srgb,var(--accent) 34%,transparent)}
.acc-tag{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:999px;
  background:var(--surface-2);border:1px solid var(--border);font-size:12.5px;font-weight:700;color:var(--text)}

.acc-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:22px}
.acc-stat{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px;min-width:0}
.acc-stat .l{display:block;font-size:11.5px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:var(--text-muted)}
.acc-stat .v{display:block;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:22px;font-weight:800;margin-top:6px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.acc-stat .s{display:block;font-size:12.5px;color:var(--text-soft);margin-top:2px;min-height:16px}

.acc-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;margin-bottom:18px;overflow:hidden}
.acc-card-head{display:flex;align-items:center;gap:9px;padding:16px 18px 12px}
.acc-tabs{display:flex;gap:2px;padding:6px 8px 0;border-bottom:1px solid var(--border)}
.acc-tab{appearance:none;background:none;border:none;font:inherit;font-size:14.5px;font-weight:800;
  color:var(--text-muted);padding:12px 14px 11px;cursor:pointer;border-bottom:2px solid transparent;
  display:inline-flex;align-items:center;gap:7px;white-space:nowrap}
.acc-tab:hover{color:var(--text)}
.acc-tab.active{color:var(--text);border-bottom-color:var(--accent)}
.acc-pane[hidden]{display:none}
.acc-view{color:var(--accent);text-decoration:none;font-size:13.5px;font-weight:700;white-space:nowrap}
.acc-view:hover{text-decoration:underline}
.acc-iss{display:block;font-size:12px;color:var(--text-soft);font-weight:600}
.lx-vtick{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;margin-left:5px;border-radius:50%;background:var(--green,#35c07f);color:#fff;vertical-align:-2px;flex:0 0 14px}
.lx-vtick svg{width:9px;height:9px;display:block}

.acc-card-head h2{font-size:17px;font-weight:800;margin:0}
.acc-n{font-size:12.5px;font-weight:800;color:var(--text-muted);background:var(--surface-2);
  border-radius:999px;padding:2px 9px;min-width:22px;text-align:center}
/* Wide content scrolls inside its own box; the page itself never scrolls sideways. */
.acc-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.acc-tbl{width:100%;border-collapse:collapse;font-size:14.5px}
.acc-tbl th{text-align:left;font-size:11.5px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;
  color:var(--text-muted);padding:9px 18px;border-top:1px solid var(--border);border-bottom:1px solid var(--border);white-space:nowrap}
.acc-tbl td{padding:13px 18px;border-bottom:1px solid var(--border);vertical-align:middle;white-space:nowrap}
.acc-tbl tbody tr:last-child td{border-bottom:none}
.acc-tbl tbody tr.acc-row{cursor:pointer}
.acc-tbl tbody tr.acc-row:hover{background:var(--surface-2)}
.acc-tbl .num{text-align:right;font-family:'JetBrains Mono',ui-monospace,monospace}
.acc-pair{display:inline-flex;align-items:center;gap:11px;min-width:0}
.acc-ico{width:32px;height:32px;border-radius:50%;flex:0 0 auto;background:var(--surface-2);
  background-size:cover;background-position:center;background-repeat:no-repeat;border:2px solid var(--surface);
  box-shadow:0 1px 4px rgba(0,0,0,.4)}
.acc-ico + .acc-ico{margin-left:-11px}
.acc-icos{display:inline-flex}
.acc-icos .acc-ico{position:relative}
.acc-icos .acc-ico:first-child{z-index:2}
.acc-code{font-weight:700}
.acc-dom{display:block;font-size:12px;color:var(--text-soft);font-weight:600}
.acc-bar{height:5px;border-radius:3px;background:var(--surface-2);overflow:hidden;min-width:64px;margin-left:auto}
.acc-bar i{display:block;height:100%;background:var(--accent);border-radius:3px}
.acc-empty{padding:26px 18px;text-align:center;color:var(--text-soft);font-size:14px}
.acc-more-host{border-top:1px solid var(--border)}
.acc-more{padding:12px 18px}
.acc-more-b{width:100%;padding:11px 14px;border-radius:11px;background:var(--surface-2);border:1px solid var(--border);color:var(--text);font:inherit;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:9px}
.acc-more-b:hover{border-color:var(--accent);color:var(--accent)}
.acc-more-n{font-size:12.5px;font-weight:600;color:var(--text-soft)}
.acc-more-b:hover .acc-more-n{color:inherit;opacity:.75}
.acc-pager-host{border-top:1px solid var(--border)}
.acc-pager{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 18px}
.acc-pg{min-width:78px;padding:8px 14px;border-radius:9px;background:var(--surface-2);border:1px solid var(--border);color:var(--text);font:inherit;font-size:13.5px;font-weight:700;cursor:pointer}
.acc-pg[disabled]{opacity:.4;cursor:default}
.acc-pg-i{font-size:13px;color:var(--text-soft);font-weight:600;white-space:nowrap}

.acc-acts{display:flex;flex-direction:column}
.acc-act{display:flex;align-items:center;gap:12px;padding:12px 18px;border-top:1px solid var(--border)}
.acc-act:first-child{border-top:1px solid var(--border)}
.acc-act-ic{width:32px;height:32px;border-radius:10px;flex:0 0 auto;display:inline-flex;align-items:center;
  justify-content:center;background:var(--surface-2);color:var(--text-soft)}
.acc-act-b{min-width:0;flex:1 1 auto}
.acc-act-t{font-size:14.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.acc-act-s{font-size:12.5px;color:var(--text-soft);margin-top:1px}
.acc-act-r{flex:0 0 auto;text-align:right;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13.5px}
.acc-act-r a{color:var(--text-soft);text-decoration:none;font-size:12px}
.acc-act-r a:hover{color:var(--accent)}
.acc-up{color:var(--green,#35c07f)}
.acc-dn{color:var(--red,#ff5b5b)}

@media (max-width:900px){
  .acc-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
  .acc-addr{font-size:14px}
  .acc-avatar{width:52px;height:52px}
  .acc-net{width:20px;height:20px}
  .acc-stat .v{font-size:19px}
}
@media (max-width:620px){
  .acc-hide-sm{display:none}
  .acc-tbl th,.acc-tbl td{padding-left:14px;padding-right:14px}
  .acc-act{padding-left:14px;padding-right:14px}
}
</style>`;

// ---------------------------------------------------------------------------------------------------
// DATA LAYER
//
// Everything below is emitted inside a TEMPLATE LITERAL, which eats one level of backslash. So there is
// not a single backslash in it: no regex escapes, no "\n", no "\uXXXX". Special characters come from
// String.fromCharCode. This is the trap that turned /\.$/ into /.$/ and silently deleted the last digit
// of every price on the Trade pages -- it is not worth re-learning.
// ---------------------------------------------------------------------------------------------------
const SCRIPT = `<script id="lx-accdata">(function(){
  var H="https://horizon.stellar.org";
  var CG="https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd";
  var DASH=String.fromCharCode(8212), MID=String.fromCharCode(183), ARROW=String.fromCharCode(8594);
  function q(s,r){ return (r||document).querySelector(s); }
  function qa(s,r){ return [].slice.call((r||document).querySelectorAll(s)); }
  function recs(d){ return (d&&d._embedded&&d._embedded.records)||[]; }
  function fetchJ(u){ return fetch(u).then(function(r){ if(!r.ok)throw new Error(r.status); return r.json(); }); }
  function j(u){ return fetchJ(u).catch(function(e){
    if(u.indexOf("horizon.stellar.org")>=0)return fetchJ(u.replace("horizon.stellar.org","horizon.stellar.lobstr.co"));
    throw e; }); }
  function esc(s){ return String(s==null?"":s).split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;").split('"').join("&quot;"); }

  // ---- address: /account/stellar/<G...> or ?address= ------------------------------------------------
  function readAddr(){
    var a="";
    try{ a=new URLSearchParams(location.search).get("address")||new URLSearchParams(location.search).get("addr")||""; }catch(_){}
    if(!a){ var parts=location.pathname.split("/"); var last=parts[parts.length-1]||parts[parts.length-2]||"";
      if(last.length===56&&last.charAt(0)==="G")a=last; }
    a=(a||"").trim();
    // G only. A C id is a Soroban contract: Horizon serves it no balances, trustlines or history,
    // so there is no page to build -- see the message below rather than an empty shell.
    return (a.length===56&&a.charAt(0)==="G")?a:"";
  }
  var ADDR=readAddr();
  // not a page, just an explanation: readAddr rejects C ids, so ADDR is empty for one
  var PASTED_CONTRACT=(function(){ var raw="";
    try{ raw=new URLSearchParams(location.search).get("address")||""; }catch(_){}
    if(!raw){ var pp=location.pathname.split("/"); raw=pp[pp.length-1]||""; }
    raw=(raw||"").trim(); return raw.length===56&&raw.charAt(0)==="C"; })();

  // ---- formatting ---------------------------------------------------------------------------------
  var SUBD=String.fromCharCode(8320,8321,8322,8323,8324,8325,8326,8327,8328,8329);
  function zsub(n){ var s=String(n),o=""; for(var i=0;i<s.length;i++)o+=SUBD.charAt(+s.charAt(i)); return o; }
  function trimZ(t){ while(t.length>1&&t.charAt(t.length-1)==="0")t=t.slice(0,-1);
    if(t.charAt(t.length-1)===".")t=t.slice(0,-1); return t; }
  // Same rule as the Trade pages: plain decimal to 1e-8, then the zeros collapse into a subscript count.
  function smallNum(x,sig){ x=+x||0; if(!(x>0))return "0";
    if(x>=1e-8)return trimZ(x.toFixed(8));
    var e=x.toExponential((sig||4)-1), i=e.indexOf("e");
    if(i<0)return String(x);
    var mant=trimZ(e.slice(0,i)).split(".").join(""), ex=-parseInt(e.slice(i+1),10);
    if(!(ex>1))return trimZ(x.toFixed(8));
    return "0.0"+zsub(ex-1)+mant; }
  function amt(n){ n=+n||0; if(n>=1e9)return (n/1e9).toFixed(2)+"B"; if(n>=1e6)return (n/1e6).toFixed(2)+"M";
    if(n>=1000)return Math.round(n).toLocaleString("en-US"); if(n>=1)return trimZ(n.toFixed(4)); if(n>0)return smallNum(n,4); return "0"; }
  function usd(n){ n=+n||0; var a=Math.abs(n);
    if(a>=1e9)return "$"+(n/1e9).toFixed(2)+"B"; if(a>=1e6)return "$"+(n/1e6).toFixed(2)+"M";
    if(a>=1000)return "$"+n.toLocaleString("en-US",{maximumFractionDigits:0});
    if(a>=1)return "$"+n.toFixed(2);
    if(a>=0.01)return "$"+n.toFixed(4);          // cents matter; hundred-millionths of a cent do not
    if(a>0)return "$"+smallNum(n,4); return "$0"; }
  function shortG(a){ a=String(a||""); return a.length>12?(a.slice(0,4)+DASH+a.slice(-4)):a; }
  function ago(t){ var s=Math.max(0,(Date.now()-t)/1000);
    if(s<60)return Math.floor(s)+"s ago"; if(s<3600)return Math.floor(s/60)+"m ago";
    if(s<86400)return Math.floor(s/3600)+"h ago"; if(s<2592000)return Math.floor(s/86400)+"d ago";
    return new Date(t).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); }

  // ---- identicon: deterministic from the address, so the same wallet always wears the same face ----
  function hashOf(s){ var h=2166136261; for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=(h*16777619)>>>0; } return h>>>0; }
  function identicon(addr){
    var h=hashOf(addr), hue=h%360, hue2=(hue+52)%360, cells="";
    for(var x=0;x<3;x++)for(var y=0;y<5;y++){
      var bit=(hashOf(addr+":"+x+":"+y)>>>3)&1; if(!bit)continue;
      cells+='<rect x="'+(x*8)+'" y="'+(y*8)+'" width="8" height="8"/>';
      if(x<2)cells+='<rect x="'+((4-x)*8)+'" y="'+(y*8)+'" width="8" height="8"/>';
    }
    var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">'
      +'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
      +'<stop offset="0%" stop-color="hsl('+hue+',62%,52%)"/><stop offset="100%" stop-color="hsl('+hue2+',60%,38%)"/>'
      +'</linearGradient></defs><rect width="40" height="40" fill="url(#g)"/>'
      +'<g fill="rgba(255,255,255,.92)">'+cells+'</g></svg>';
    return "data:image/svg+xml;base64,"+btoa(svg);
  }

  // ---- logos: brand map, then the asset toml, then an initials disc ---------------------------------
  var STELLAR_URI="${'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#000"/><path d="M23.13 9.292l-2.4 1.224-11.598 5.907A6.909 6.909 0 0119.35 9.498l1.374-.7.205-.105a8.439 8.439 0 00-13.371 7.472 1.535 1.535 0 01-.834 1.484l-.725.37v1.724l2.134-1.088.691-.353.681-.347 12.226-6.23 1.374-.699 2.84-1.447V7.856zm2.816 2.012L10.201 19.32l-1.374.7L6 21.463v1.723l2.808-1.43 2.401-1.224 11.61-5.916a6.909 6.909 0 01-10.229 6.93l-.085.045-1.49.76a8.439 8.439 0 0013.372-7.475 1.536 1.536 0 01.833-1.483l.726-.37v-1.718z" fill="#FFF"/></svg>').toString('base64')}";
  var LOGOS={USDC:"https://assets.coingecko.com/coins/images/6319/small/usdc.png",
    EURC:"https://assets.coingecko.com/coins/images/26045/small/euro.png",
    AQUA:"https://aqua.network/assets/img/aqua-logo.png",
    yXLM:"https://assets.coingecko.com/coins/images/100/small/fmpFRHHQ_400x400.jpg",
    BTC:"https://assets.coingecko.com/coins/images/1/small/bitcoin.png"};
  var LOGO_ISS={USDC:"GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    EURC:"GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2",
    AQUA:"GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
    yXLM:"GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55",
    BTC:"GAUTUYY2THLF7SGITDFMXJVYH3LHDSMGEAKSBU267M2K7A3W543CKUEF"};
  var LUMOS_ISS="GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S";
  var LUMOS_LOGO="/assets/tokens/lumos.png";
  var IMG={}, DOM={}, TRIED={};
  // the same verified pairs the rest of the site vouches for -- code|issuer, never code alone
  var VFD=${JSON.stringify(VERIFIED)};

  // What WE show as an asset home domain where the on-chain value is stale (LUMOS still declares the
  // pre-rename lumosdao.io). Display only -- never the toml fetch, which 404s on the new domain.
  var DDOM=${JSON.stringify(DOMAIN_DISPLAY)};
  function dispDom(c,i,d){ return DDOM[(c||"")+"|"+(i||"")]||d||""; }
  var VTICK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  function vtick(c,i){ return VFD[c+"|"+i]?('<span class="lx-vtick" title="Verified issuer">'+VTICK+'</span>'):""; }
  function key(c,i){ return c+"-"+(i||""); }
  function brand(c,i){ if(c==="LUMOS"&&i===LUMOS_ISS)return LUMOS_LOGO;
    var u=LOGOS[c]; if(!u)return ""; return (LOGO_ISS[c]&&i===LOGO_ISS[c])?u:""; }
  function initials(c){ var s=String(c||"?"), hue=hashOf(s)%360;
    var t=s.replace(/[^A-Za-z0-9]/g,"").slice(0,2).toUpperCase()||"?";
    var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="hsl('+hue+',55%,45%)"/>'
      +'<text x="20" y="'+(t.length>1?26:27)+'" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="'+(t.length>1?15:20)+'" fill="#fff">'+t+'</text></svg>';
    return "data:image/svg+xml;base64,"+btoa(svg); }
  function logoOf(c,i){ if(c==="XLM")return STELLAR_URI;
    return brand(c,i)||IMG[key(c,i)]||initials(c); }
  function paintLogos(){ qa(".acc-ico[data-lxc]").forEach(function(el){
    var c=el.getAttribute("data-lxc"), i=el.getAttribute("data-lxi")||"";
    el.style.backgroundImage="url("+logoOf(c,i)+")"; }); }
  // Same two-source chain the pools tab uses: the issuer-scoped index, then the issuer's own toml.
  function tomlField(block,k){ var lines=block.split(String.fromCharCode(10));
    for(var i=0;i<lines.length;i++){ var ln=lines[i].trim(), eq=ln.indexOf("=");
      if(eq<0)continue; if(ln.slice(0,eq).trim()!==k)continue;
      var v=ln.slice(eq+1).trim();
      if(v.charAt(0)==='"'){ var e=v.indexOf('"',1); v=e>0?v.slice(1,e):v.slice(1); }
      return v; }
    return ""; }
  function fetchLogo(c,i){ if(!c||c==="XLM"||!i)return;
    if((brand(c,i)||IMG[key(c,i)])&&DOM[key(c,i)])return;   // logo AND domain known -> nothing to fetch
    if(TRIED[key(c,i)])return; TRIED[key(c,i)]=1;
    fetchJ("https://api.stellar.expert/explorer/public/asset?search="+encodeURIComponent(i)+"&limit=50").then(function(d){
      var m=recs(d).filter(function(r){ return (r.asset||"").indexOf(c+"-"+i)===0; })[0];
      var ti=(m&&(m.tomlInfo||m.toml_info))||{};
      if(m&&m.domain){ DOM[key(c,i)]=m.domain; try{ renderAssets(); }catch(_){} }
      if(ti.image){ IMG[key(c,i)]=ti.image; paintLogos(); return; }
      return j(H+"/accounts/"+i).then(function(acc){
        var dom=(acc&&acc.home_domain)||""; if(!dom)return;
        for(var k2=0;k2<dom.length;k2++){ var ch=dom.charAt(k2);
          if(!((ch>="a"&&ch<="z")||(ch>="A"&&ch<="Z")||(ch>="0"&&ch<="9")||ch==="."||ch==="-"))return; }
        return fetch("https://"+dom+"/.well-known/stellar.toml").then(function(r){ return r.text(); }).then(function(txt){
          var bl=txt.split("[[CURRENCIES]]");
          for(var b=1;b<bl.length;b++){ if(tomlField(bl[b],"code")!==c)continue;
            var bi=tomlField(bl[b],"issuer"); if(bi&&bi!==i)continue;
            var im=tomlField(bl[b],"image"); if(im){ IMG[key(c,i)]=im; paintLogos(); } return; } }); });
    }).catch(function(){}); }

  // ---- state --------------------------------------------------------------------------------------
  var xlmUsd=(function(){ try{ var c=JSON.parse(localStorage.getItem("lumos.xlmUsd")||"null");
    return (c&&+c.v>0&&(Date.now()-c.ts<216e5))?+c.v:0; }catch(e){ return 0; } })();
  var ASSETS=[], POOLS=[], ACTS=[], XLM=0, ACCT=null, DONE={};
  var PER=25, aShown=PER, pShown=PER, PRICE_CAP=75;
  var PIN={XLM:0, USDC:1, LUMOS:2};
  // Pinned three first, then by value. An unpriced row sorts after every priced one: we do not know
  // what it is worth, and ranking it as zero would be a claim we cannot make.
  function sortAssets(list){
    return list.slice().sort(function(x,y){
      var px=(PIN[x.code]!=null&&(x.native||x.code!=="XLM"))?PIN[x.code]:99;
      var py=(PIN[y.code]!=null&&(y.native||y.code!=="XLM"))?PIN[y.code]:99;
      if(px!==py)return px-py;
      var vx=(x.usd==null)?-1:x.usd, vy=(y.usd==null)?-1:y.usd;
      if(vx!==vy)return vy-vx;
      return String(x.code).localeCompare(String(y.code));
    });
  }
  function moreHTML(kind,shown,total){ if(total<=shown)return "";
    var next=Math.min(PER,total-shown);
    return '<div class="acc-more"><button class="acc-more-b" data-more="'+kind+'">Load '+next
      +' more<span class="acc-more-n">'+shown+' of '+total+' shown</span></button></div>'; }
  // A pager only earns its space when there is more than one page.

  function setStat(k,v,s){ var el=q('.acc-stat .v[data-k="'+k+'"]'); if(el&&el.textContent!==v)el.textContent=v;
    var sl=q('.acc-stat .s[data-s="'+k+'"]'); if(sl&&s!=null&&sl.textContent!==s)sl.textContent=s; }

  function totalValue(){ var t=XLM*xlmUsd;
    ASSETS.forEach(function(a){ if(a.usd)t+=a.usd; });
    POOLS.forEach(function(p){ if(p.usd)t+=p.usd; });
    return t; }
  // how much of the account this total actually covers
  function priced(){ var n=1, m=1+ASSETS.length+POOLS.length;
    ASSETS.forEach(function(a){ if(a.usd!=null)n++; });
    POOLS.forEach(function(p){ if(p.usd!=null)n++; });
    return {n:n,m:m}; }

  function renderStats(){
    var tv=totalValue();
    var pc=priced();
    var note = xlmUsd<=0 ? "waiting for XLM price"
      : (pc.n<pc.m ? (amt(tv/xlmUsd)+" XLM "+MID+" priced "+pc.n+" of "+pc.m+" holdings")
                   : (amt(tv/xlmUsd)+" XLM"));
    setStat("total", xlmUsd>0?usd(tv):DASH, note);
    setStat("xlm", amt(XLM)+" XLM", xlmUsd>0?usd(XLM*xlmUsd):"");
    // count what the Assets table shows -- XLM plus every funded trustline -- so the two agree
    setStat("assets", String(ASSETS.length+1), ASSETS.length===1?"1 trustline held":(ASSETS.length+" trustlines held"));
    setStat("pools", String(POOLS.length), POOLS.length?"providing liquidity":"none");
  }

  // ---- assets -------------------------------------------------------------------------------------
  // The button lives after the table inside the same card, so re-rendering the table never destroys it.
  function setMore(tblSel,kind,shown,total){
    var tbl=q(tblSel); if(!tbl)return;
    var card=tbl.closest(".acc-pane")||tbl.closest(".acc-card"); if(!card)return;
    var host=card.querySelector(".acc-more-host");
    if(!host){ host=document.createElement("div"); host.className="acc-more-host"; card.appendChild(host); }
    var html=moreHTML(kind,shown,total);
    if(host.__h!==html){ host.innerHTML=html; host.__h=html; }
    if(!host.__w){ host.__w=1;
      host.addEventListener("click",function(e){
        var b=e.target&&e.target.closest?e.target.closest("[data-more]"):null; if(!b)return;
        e.preventDefault(); e.stopPropagation();
        if(kind==="assets"){ aShown+=PER; renderAssets(); } else { pShown+=PER; renderPools(); }
      },true); }
  }
  function renderAssets(){
    var tb=q("#accAssetsTbl tbody"); if(!tb)return;
    var n=q("#accAssetsN"); if(n)n.textContent=String(ASSETS.length+1);
    var all=sortAssets([{code:"XLM",issuer:"",dom:"Stellar",bal:XLM,px:1,usd:XLM*xlmUsd,native:true}].concat(ASSETS));
    var rows=all.slice(0,Math.min(aShown,all.length));
    var tot=totalValue();
    // whatever is on screen gets priced and gets a logo, cap or no cap
    // Two jobs, two guards. __px used to gate BOTH pricing and logo/domain lookup, and the boot pricing
    // wave claims __px without ever calling fetchLogo -- so whichever ran first decided whether the asset
    // ever got a logo. That race is why some wallets showed initials and a bare issuer and others did not.
    // fetchLogo carries its own TRIED guard, so calling it on every visible row costs nothing extra.
    rows.forEach(function(a){ if(a.native)return;
      fetchLogo(a.code,a.issuer);
      if(!a.__px){ a.__px=1; loadAssetPx(a); } });
    tb.innerHTML=rows.map(function(a){
      var sub = a.native ? "Native asset"
        : (function(){ var _d=dispDom(a.code,a.issuer,DOM[key(a.code,a.issuer)]||"");
            return _d ? (_d+" "+MID+" "+shortG(a.issuer)) : shortG(a.issuer); })();
      return '<tr class="acc-row" data-code="'+esc(a.code)+'" data-iss="'+esc(a.issuer||"")+'">'
        +'<td><span class="acc-pair"><span class="acc-ico" data-lxc="'+esc(a.code)+'" data-lxi="'+esc(a.issuer||"")+'"></span>'
          +'<span><span class="acc-code">'+esc(a.code)+'</span>'+vtick(a.code,a.issuer||"")
          +'<span class="acc-iss">'+esc(sub)+'</span></span></span></td>'
        +'<td class="num">'+amt(a.bal)+'</td>'
        +'<td class="num">'+(a.usd!=null&&xlmUsd>0?usd(a.usd):DASH)+'</td>'
        +'<td style="text-align:right">'+(a.native?"":'<a class="acc-view" href="/trade/stellar/'+esc(a.code)+'-'+esc(a.issuer)+'">View asset</a>')+'</td>'
        +'</tr>'; }).join("");
    setMore("#accAssetsTbl","assets",rows.length,all.length);
    paintLogos();
    qa("#accAssetsTbl tbody tr.acc-row").forEach(function(tr){ tr.addEventListener("click",function(){
      var c=tr.getAttribute("data-code"), i=tr.getAttribute("data-iss");
      if(c&&c!=="XLM"&&i)location.href="/trade/stellar/"+c+"-"+i; }); });
  }

  // ---- pools --------------------------------------------------------------------------------------
  var poolsOpened=false;
  function wireTabs(){
    var bar=q("#accTabs"); if(!bar||bar.__w)return; bar.__w=1;
    bar.addEventListener("click",function(e){
      var b=e.target&&e.target.closest?e.target.closest(".acc-tab[data-t]"):null; if(!b)return;
      var t=b.getAttribute("data-t");
      qa(".acc-tab",bar).forEach(function(x){ x.classList.toggle("active",x===b); });
      qa(".acc-pane").forEach(function(pn){ pn.hidden=(pn.getAttribute("data-p")!==t); });
      if(t==="pools"&&!poolsOpened){ poolsOpened=true; renderPools(); }
    });
  }
  function renderPools(){
    var tb=q("#accPoolsTbl tbody"); if(!tb)return;
    var n0=q("#accPoolsN"); if(n0)n0.textContent=String(POOLS.length);
    if(!poolsOpened)return;                       // deferred until the tab is actually opened
    var n=q("#accPoolsN"); if(n)n.textContent=String(POOLS.length);
    if(!POOLS.length){ tb.innerHTML='<tr class="acc-empty-row"><td colspan="5"><div class="acc-empty">'
      +(DONE.pools?"This account provides no pool liquidity.":"Loading pools"+String.fromCharCode(8230))+'</div></td></tr>'; return; }
    // biggest position first, unvalued last -- same rule as the assets table
    var psorted=POOLS.slice().sort(function(x,y){ var vx=(x.usd==null)?-1:x.usd, vy=(y.usd==null)?-1:y.usd; return vy-vx; });
    var plist=psorted.slice(0,Math.min(pShown,psorted.length));
    plist.forEach(function(p){ if(!p.__ld){ p.__ld=1; loadPool(p); } });
    tb.innerHTML=plist.map(function(p){
      return '<tr class="acc-row" data-pool="'+esc(p.id)+'">'
        +'<td><span class="acc-pair"><span class="acc-icos">'
          +'<span class="acc-ico" data-lxc="'+esc(p.a)+'" data-lxi="'+esc(p.ai||"")+'"></span>'
          +'<span class="acc-ico" data-lxc="'+esc(p.b)+'" data-lxi="'+esc(p.bi||"")+'"></span></span>'
          +'<span><span class="acc-code">'+esc(p.a)+" / "+esc(p.b)+'</span>'
          +'<span class="acc-dom">'+(p.tl!=null?(p.tl+(p.tl===1?" LP holder":" LP holders")):"")+'</span></span></span></td>'
        +'<td class="num">'+(p.share>=0.01?p.share.toFixed(2):"<0.01")+'%</td>'
        +'<td class="num">'+(p.usd!=null&&xlmUsd>0?usd(p.usd):DASH)+'</td>'
        +'<td class="num acc-hide-sm">'+(p.tvl!=null&&xlmUsd>0?usd(p.tvl):DASH)+'</td>'
        +'<td style="text-align:right"><a class="acc-view" href="/pools/stellar/id/'+esc(p.id)+'">View pool</a></td>'
        +'</tr>'; }).join("");
    setMore("#accPoolsTbl","pools",plist.length,psorted.length);
    paintLogos();
    qa("#accPoolsTbl tbody tr.acc-row").forEach(function(tr){ tr.addEventListener("click",function(){
      var id=tr.getAttribute("data-pool"); if(id)location.href="/pools/stellar/id/"+id; }); });
  }

  // ---- activity -----------------------------------------------------------------------------------
  var AIC={
    payment:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    swap:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>',
    trust:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    pool:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2s6 7 6 11a6 6 0 01-12 0c0-4 6-11 6-11z"/></svg>',
    offer:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>',
    other:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg>'
  };
  function opCode(o){ return o.asset_type==="native"?"XLM":(o.asset_code||""); }
  function describe(o){
    var t=o.type||"", me=ADDR;
    if(t==="payment"){
      var out=(o.from===me);
      return {ic:"payment", title:(out?"Sent ":"Received ")+amt(o.amount)+" "+opCode(o),
        sub:(out?("to "+shortG(o.to)):("from "+shortG(o.from))), cls:out?"acc-dn":"acc-up",
        right:(out?"-":"+")+amt(o.amount)+" "+opCode(o)}; }
    if(t.indexOf("path_payment")===0){
      var sc=o.source_asset_type==="native"?"XLM":(o.source_asset_code||"");
      return {ic:"swap", title:"Swapped "+amt(o.source_amount)+" "+sc+" "+ARROW+" "+amt(o.amount)+" "+opCode(o),
        sub:(o.from===me?"outgoing":"incoming"), right:""}; }
    if(t==="change_trust"){
      var add=(+o.limit)>0;
      return {ic:"trust", title:(add?"Added trustline ":"Removed trustline ")+(o.asset_code||opCode(o)),
        sub:o.asset_issuer?shortG(o.asset_issuer):"", right:""}; }
    if(t==="liquidity_pool_deposit")  return {ic:"pool", title:"Deposited into a pool", sub:shortG(o.liquidity_pool_id||""), right:""};
    if(t==="liquidity_pool_withdraw") return {ic:"pool", title:"Withdrew from a pool", sub:shortG(o.liquidity_pool_id||""), right:""};
    if(t.indexOf("offer")>=0){
      var amount=+o.amount||0;
      return {ic:"offer", title:(amount>0?"Placed an order":"Cancelled an order"),
        sub:(o.selling_asset_code||(o.selling_asset_type==="native"?"XLM":""))+" / "+(o.buying_asset_code||(o.buying_asset_type==="native"?"XLM":"")), right:""}; }
    if(t==="create_account") return {ic:"payment", title:"Account created", sub:"funded with "+amt(o.starting_balance)+" XLM", cls:"acc-up", right:""};
    if(t==="account_merge")  return {ic:"other", title:"Account merged", sub:shortG(o.into||""), right:""};
    if(t==="claim_claimable_balance") return {ic:"payment", title:"Claimed a balance", sub:"", right:""};
    if(t==="create_claimable_balance") return {ic:"payment", title:"Created a claimable balance", sub:amt(o.amount)+" "+opCode(o), right:""};
    // Anything else: say what it was rather than inventing a story for it.
    return {ic:"other", title:t.split("_").join(" ").replace(/^./,function(m){return m.toUpperCase();}), sub:"", right:""};
  }
  function renderActs(){
    var box=q("#accActs"); if(!box)return;
    var n=q("#accActN"); if(n)n.textContent=String(ACTS.length);
    if(!ACTS.length){ box.innerHTML='<div class="acc-empty">'
      +(DONE.acts?"No activity on this account yet.":"Loading activity"+String.fromCharCode(8230))+'</div>'; return; }
    box.innerHTML=ACTS.map(function(o){
      var d=describe(o), ts=Date.parse(o.created_at||"")||0;
      return '<div class="acc-act"><span class="acc-act-ic">'+(AIC[d.ic]||AIC.other)+'</span>'
        +'<span class="acc-act-b"><span class="acc-act-t">'+esc(d.title)+'</span>'
        +'<span class="acc-act-s">'+esc(d.sub||"")+(d.sub?(" "+MID+" "):"")+(ts?ago(ts):"")+'</span></span>'
        +'<span class="acc-act-r"><span class="'+(d.cls||"")+'">'+esc(d.right||"")+'</span><br>'
        +'<a href="https://stellar.expert/explorer/public/tx/'+esc(o.transaction_hash||"")+'" target="_blank" rel="noopener">tx <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a></span></div>'; }).join("");
  }

  // ---- load ---------------------------------------------------------------------------------------
  function paintHeader(){
    var el=q("#accAddr"); if(el){ el.textContent=ADDR||"No account"; el.title=ADDR; }
    var av=q("#accAvatar"); if(av&&ADDR)av.style.backgroundImage="url("+identicon(ADDR)+")";
    var nt=q("#accNet"); if(nt&&!nt.style.backgroundImage)nt.style.backgroundImage="url("+STELLAR_URI+")";
    var sub=q("#accSub"); if(!sub)return;
    var bits=[];

    if(ACCT&&ACCT.__created)bits.push("Active since "+esc(ACCT.__created));
    if(ADDR)bits.push('<a href="https://stellar.expert/explorer/public/account/'+esc(ADDR)+'" target="_blank" rel="noopener">View on Explorer <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>');
    sub.innerHTML=bits.join("");
  }
  function fail(msg){
    qa(".acc-empty").forEach(function(e){ e.textContent=msg; });
    var el=q("#accAddr"); if(el)el.textContent=ADDR||"No account";
  }

  function loadPrice(){ return fetchJ(CG).then(function(d){
    if(d&&d.stellar&&+d.stellar.usd){ xlmUsd=+d.stellar.usd;
      try{ localStorage.setItem("lumos.xlmUsd",JSON.stringify({v:xlmUsd,ts:Date.now()})); }catch(_){} }
  }).catch(function(){}); }

  // last trade close against XLM -- the same price the Trade pages quote, so a holding is worth the same
  // number on both screens
  function loadAssetPx(a){
    var t=a.code.length<=4?"credit_alphanum4":"credit_alphanum12";
    return j(H+"/trade_aggregations?base_asset_type="+t+"&base_asset_code="+a.code+"&base_asset_issuer="+a.issuer
      +"&counter_asset_type=native&resolution=86400000&order=desc&limit=1").then(function(d){
      var r=recs(d)[0]; if(r){ a.px=+r.close||+r.avg||0; a.usd=a.bal*a.px*xlmUsd; }
      renderStats(); renderAssets(); }).catch(function(){}); }

  function loadPool(p){
    return j(H+"/liquidity_pools/"+p.id).then(function(d){
      var tot=+d.total_shares||0; p.share=tot>0?(p.shares/tot*100):0; p.tl=+d.total_trustlines||null;
      // Keep BOTH reserves, in order. An asset/asset pool has no native side, and collapsing the two
      // into one variable is what dropped the second ticker.
      var sides=(d.reserves||[]).map(function(rv){
        if(rv.asset==="native")return {code:"XLM",iss:"",amount:+rv.amount};
        var parts=rv.asset.split(":"); return {code:parts[0],iss:parts[1]||"",amount:+rv.amount}; });
      if(sides[0]){ p.a=sides[0].code; p.ai=sides[0].iss; fetchLogo(p.a,p.ai); }
      if(sides[1]){ p.b=sides[1].code; p.bi=sides[1].iss; fetchLogo(p.b,p.bi); }
      // A constant-product pool holds equal value on both sides, so one side doubled IS the TVL.
      function settle(sideXlm){ p.tvl=sideXlm*2*xlmUsd; p.usd=p.tvl*(p.share/100); renderStats(); renderPools(); }
      var nat=null; for(var i=0;i<sides.length;i++)if(sides[i].code==="XLM")nat=sides[i];
      if(nat){ settle(nat.amount); return; }
      // no XLM side: price one side in XLM, then double that
      var s0=sides[0]; if(!s0||!s0.iss){ renderPools(); return; }
      var t0=s0.code.length<=4?"credit_alphanum4":"credit_alphanum12";
      return j(H+"/trade_aggregations?base_asset_type="+t0+"&base_asset_code="+s0.code+"&base_asset_issuer="+s0.iss
        +"&counter_asset_type=native&resolution=86400000&order=desc&limit=1").then(function(pd){
        var r=recs(pd)[0], px=r?(+r.close||+r.avg||0):0;
        if(px>0)settle(s0.amount*px); else renderPools();
      }).catch(function(){ renderPools(); });
      }).catch(function(){}); }

  function loadActs(){
    return j(H+"/accounts/"+ADDR+"/operations?order=desc&limit=50").then(function(d){
      ACTS=recs(d); DONE.acts=1; renderActs(); }).catch(function(){ DONE.acts=1; renderActs(); }); }

  function boot(){
    if(!ADDR){ fail(PASTED_CONTRACT
      ? ("That is a Soroban contract, not a wallet " + String.fromCharCode(8212) + " it holds no balances or history we can show. Open it on stellar.expert to see its state.")
      : "No Stellar address in this link."); return; }
    paintHeader();
    loadPrice().then(function(){ renderStats(); renderAssets(); });
    j(H+"/accounts/"+ADDR).then(function(acc){
      ACCT=acc;
      (acc.balances||[]).forEach(function(b){
        if(b.asset_type==="native"){ XLM=+b.balance||0; return; }
        if(b.asset_type==="liquidity_pool_shares"){
          if((+b.balance||0)>0)POOLS.push({id:b.liquidity_pool_id,shares:+b.balance,a:"",b:"",ai:"",bi:"",share:0,usd:null,tvl:null});
          return; }
        if(!(+b.balance>0))return;                       // an empty trustline is not a holding
        ASSETS.push({code:b.asset_code,issuer:b.asset_issuer,dom:"",bal:+b.balance,px:0,usd:null});
      });
      DONE.pools=1;
      paintHeader(); renderStats(); renderAssets(); wireTabs(); renderPools();
      // Price beyond the first batch so the ORDER is real rather than just Horizon's order, but stop at
      // PRICE_CAP: an account with 400 trustlines must not turn one page view into 400 requests.
      (function wave(i,list){ if(i>=list.length)return;
        Promise.all(list.slice(i,i+5).map(function(a){ if(a.__px)return null; a.__px=1; return loadAssetPx(a); }))
          .then(function(){ wave(i+5,list); },function(){ wave(i+5,list); });
      })(0,ASSETS.slice(0,PRICE_CAP));
      // "active since" comes from the oldest operation we can see, not from the account record --
      // Horizon does not carry a creation timestamp on /accounts.
      j(H+"/accounts/"+ADDR+"/operations?order=asc&limit=1").then(function(d){
        var r=recs(d)[0]; if(r&&r.created_at){ ACCT.__created=new Date(r.created_at).toLocaleDateString("en-US",{month:"short",year:"numeric"}); paintHeader(); }
      }).catch(function(){});
    }).catch(function(){
      fail("This account does not exist on Stellar mainnet, or Horizon is unreachable.");
    });
    loadActs();
    var cp=q("#accCopy");
    // The site owns a bottom-centre toast (window.showToast) that every other copy action uses. Reuse it
    // rather than inventing a second confirmation style on one page.
    function accToast(m){ try{ if(typeof window.showToast==="function"){ window.showToast(m); return; } }catch(_){}
      try{ var t=document.createElement("div"); t.textContent=m;
        t.style.cssText="position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:99999;"
          +"padding:11px 18px;border-radius:12px;background:#1a1a1f;color:#fff;font-size:14px;font-weight:700;"
          +"box-shadow:0 6px 24px rgba(0,0,0,.45);pointer-events:none";
        document.body.appendChild(t); setTimeout(function(){ if(t.parentNode)t.parentNode.removeChild(t); },1800);
      }catch(_){} }
    if(cp)cp.addEventListener("click",function(){
      if(!ADDR)return;
      try{ navigator.clipboard.writeText(ADDR); }catch(_){}
      accToast("Wallet address copied");
    });
  }
  if(document.readyState!=="loading")boot(); else document.addEventListener("DOMContentLoaded",boot);
})();<\/script>`;

// ---------------------------------------------------------------------------------------------------
// BUILD
// ---------------------------------------------------------------------------------------------------
const TITLE = 'Stellar Account &#8212; Balances, Pools and Activity | LumosCore';
const DESC = 'Public profile for any Stellar account: assets held and their value, liquidity pool positions, total portfolio worth and the last 50 operations.';

// Walk forward from an opening <div ...> counting nested opens and closes, so we get ITS close tag and
// not the first one that happens to appear. Divs are never self-closing, so a counter is sufficient.
function innerRange(html, openTag) {
  const start = html.indexOf(openTag);
  if (start < 0) return null;
  let i = start + openTag.length, depth = 1;
  while (i < html.length && depth > 0) {
    const o = html.indexOf("<div", i), c = html.indexOf("</div>", i);
    if (c < 0) return null;
    if (o >= 0 && o < c) { depth++; i = o + 4; }
    else { depth--; i = c + 6; if (depth === 0) return { from: start + openTag.length, to: c }; }
  }
  return null;
}
function buildPage(shell) {
  let p = shell;
  // Replace only the content. Everything outside <main> is the site: nav, footer, theme boot, fonts.
  const s = p.indexOf('<main class="page">');
  const e = p.indexOf('</main>');
  if (s >= 0 && e > s) {
    p = p.slice(0, s) + MAIN + p.slice(e + '</main>'.length);
  } else {
    const r = innerRange(p, '<div class="container">');
    if (!r) return null;
    p = p.slice(0, r.from) + MAIN_INNER + p.slice(r.to);
  }

  // The clone carries the source page's FAQ and its data layer. Strip both -- they answer questions about
  // pools, and lx- scripts from other transforms would run against markup that is no longer there.
  p = p.replace(/<section class="lx-faq"[\s\S]*?<\/section>/g, '');
  // DENYLIST, not an allowlist. The shell carries ~50 lx- blocks and almost all of them are the SITE:
  // the header logo, the footer, the theme, the wallet chip and its Disconnect button, search. Keeping
  // only our own left the page in the raw design. Strip just what is about POOLS.
  const POOL_ONLY = ['ammdata', 'amm-css', 'partpage', 'faq-css'];
  for (const id of POOL_ONLY) {
    p = p.replace(new RegExp('<style id="lx-' + id + '">[\\s\\S]*?</style>', 'g'), '');
    p = p.replace(new RegExp('<script id="lx-' + id + '">[\\s\\S]*?</script>', 'g'), '');
  }

  // title + description
  p = p.replace(/<title>[\s\S]*?<\/title>/, '<title>' + TITLE + '</title>');
  p = p.replace(/<meta name="description" content="[^"]*"/, '<meta name="description" content="' + DESC + '"');

  if (p.indexOf('</head>') < 0) return null;
  p = p.replace('</head>', STYLE + '</head>');
  const bi = p.lastIndexOf('</body>');
  if (bi < 0) return null;
  return p.slice(0, bi) + SCRIPT + p.slice(bi);
}

let made = 0, containers = 0, skipped = [];
const files = fs.readdirSync('.').filter(f => /^lumoscore-.*-(desktop|mobile)\.html$/.test(f));
for (const file of files) {
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let any = false;
  for (const { shell, out } of SHELLS) {
    const src = json[shell];
    if (!src) continue;
    const page = buildPage(src);
    if (!page) { skipped.push(file + ':' + shell + ' (no <main class="page">)'); continue; }
    for (const k of out) { json[k] = page; made++; }
    any = true;
  }
  if (!any) { skipped.push(file + ' (no amm-pool shell)'); continue; }
  containers++;
  if (process.argv.includes('--write')) {
    const B = String.fromCharCode(92);
    const ser = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + ser + data.slice(e), 'utf8');
  }
}
console.log('account page: wrote ' + made + ' keys across ' + containers + ' containers'
  + (skipped.length ? '\n  SKIPPED: ' + skipped.join(', ') : '')
  + (process.argv.includes('--write') ? '' : '  (dry run - pass --write)'));
