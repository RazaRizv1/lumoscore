// ADMIN PANEL — Revenue page + real on-chain data for the admin surfaces.
//
// The design already shipped an admin front end (dashboard/users/assets/support/blogs/create-pool), but
// every figure in it was mock. This transform:
//   1. adds a REVENUE page (the design had none), cloned from the dashboard shell so it inherits the exact
//      chrome, then re-bodied;
//   2. inserts "Revenue" into the admin sidebar, right after Dashboard;
//   3. injects a data layer that fills Revenue + the Dashboard KPIs from the chain.
//
// WHERE THE MONEY COMES FROM: platform fees are paid to LX_FEE_COLLECTOR by _swapcalc.js. That account's
// payment history IS the revenue ledger — on-chain, auditable, and impossible to fabricate. Nothing here
// is estimated: per-asset totals are exact sums of real payments. USD is a CONVERSION of those exact
// amounts (stellar.expert spot price per asset, CoinGecko for XLM) and any asset we cannot price is
// counted in its own units and excluded from the USD total rather than guessed at.
//
// Metrics that CANNOT be real without a backend (DAU/MAU, signups, sessions) are dashed with a tooltip
// rather than invented — the same rule the rest of the site follows.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const FEE_COLLECTOR='GAMZFXIJD5E3PNRFCG6VPXCJNUOZAP5BY2P3MU3ZXXUSVM2UY5P6LJKD';

// ---- the Revenue page body (uses the admin design's own classes so it is visually native) -------------
const REVENUE_MAIN=`
      <div class="admin-page-head">
        <h1 class="admin-page-title">Revenue</h1>
        <div class="admin-page-actions">
          <button class="adm-btn ghost" id="lxRevCsv" type="button">Export CSV</button>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-head">Revenue this month</div><div class="kpi-value" id="lxRevMonth">&mdash;</div><div class="kpi-foot" id="lxRevMonthSub">collected in fees</div></div>
        <div class="kpi"><div class="kpi-head">Revenue all time</div><div class="kpi-value" id="lxRevAll">&mdash;</div><div class="kpi-foot" id="lxRevAllSub">since first fee</div></div>
        <div class="kpi"><div class="kpi-head">Fee payments</div><div class="kpi-value" id="lxRevCount">&mdash;</div><div class="kpi-foot">on-chain receipts</div></div>
        <div class="kpi"><div class="kpi-head">Paying wallets</div><div class="kpi-value" id="lxRevWallets">&mdash;</div><div class="kpi-foot">distinct payers</div></div>
      </div>

      <div class="adm-card" style="margin-bottom:18px">
        <div class="adm-card-head">
          <div><div class="adm-card-title">Revenue by source</div><div class="adm-card-sub" id="lxSrcSub">Working out where the money came from&hellip;</div></div>
          <div class="adm-card-actions"><button class="adm-btn ghost" id="lxSrcAdd" type="button">Add off-chain entry</button></div>
        </div>
        <div class="adm-card-body" style="padding:0">
          <table class="adm-table" id="lxSrcTable" style="width:100%;border-collapse:collapse">
            <thead><tr><th style="text-align:left">Source</th><th style="text-align:left">How it is counted</th><th style="text-align:right">Amount</th><th style="text-align:right">Share</th></tr></thead>
            <tbody><tr><td colspan="4" class="lxadm-empty">Loading&hellip;</td></tr></tbody>
          </table>
        </div>
      </div>

      <div class="adm-card" style="margin-bottom:18px">
        <div class="adm-card-head"><div class="adm-card-title">Revenue by asset</div><div class="adm-card-sub" id="lxRevBySub"></div></div>
        <div class="adm-card-body" style="padding:0">
          <table class="adm-table" id="lxRevByAsset" style="width:100%;border-collapse:collapse">
            <thead><tr><th style="text-align:left">Asset</th><th style="text-align:right">Collected</th><th style="text-align:right">&asymp; USD</th><th style="text-align:right">Share</th></tr></thead>
            <tbody><tr><td colspan="4" class="lxadm-empty">Loading fee receipts&hellip;</td></tr></tbody>
          </table>
        </div>
      </div>

      <div class="adm-card">
        <div class="adm-card-head"><div class="adm-card-title">Fee ledger</div><div class="adm-card-sub" id="lxRevLedgerSub"></div></div>
        <div class="adm-card-body" style="padding:0">
          <table class="adm-table" id="lxRevLedger" style="width:100%;border-collapse:collapse">
            <thead><tr><th style="text-align:left">When</th><th style="text-align:left">From</th><th style="text-align:left">Asset</th><th style="text-align:right">Amount</th><th style="text-align:right">Tx</th></tr></thead>
            <tbody><tr><td colspan="5" class="lxadm-empty">Loading fee receipts&hellip;</td></tr></tbody>
          </table>
        </div>
      </div>
`;

const REVENUE_MOB=`
      <div class="mob-page-head">
        <h1 class="mob-page-title">Revenue</h1>
        <p class="mob-page-sub">Platform fees collected on-chain</p>
        <div class="mob-page-actions">
          <button class="adm-btn ghost" id="lxRevCsv" type="button">Export CSV</button>
        </div>
      </div>

      <div class="mob-kpi-grid">
        <div class="mob-kpi"><div class="mob-kpi-head"><span class="mob-kpi-label">This month</span></div><div class="mob-kpi-value" id="lxRevMonth">&mdash;</div><div class="mob-kpi-foot" id="lxRevMonthSub">collected in fees</div></div>
        <div class="mob-kpi"><div class="mob-kpi-head"><span class="mob-kpi-label">All time</span></div><div class="mob-kpi-value" id="lxRevAll">&mdash;</div><div class="mob-kpi-foot" id="lxRevAllSub">since first fee</div></div>
        <div class="mob-kpi"><div class="mob-kpi-head"><span class="mob-kpi-label">Fee payments</span></div><div class="mob-kpi-value" id="lxRevCount">&mdash;</div><div class="mob-kpi-foot">on-chain receipts</div></div>
        <div class="mob-kpi"><div class="mob-kpi-head"><span class="mob-kpi-label">Paying wallets</span></div><div class="mob-kpi-value" id="lxRevWallets">&mdash;</div><div class="mob-kpi-foot">distinct payers</div></div>
      </div>

      <div class="adm-card" style="margin-bottom:14px">
        <div class="adm-card-head"><div class="adm-card-title">Revenue by asset</div><div class="adm-card-sub" id="lxRevBySub"></div></div>
        <div class="adm-card-body" style="padding:0;overflow-x:auto">
          <table class="adm-table" id="lxRevByAsset" style="width:100%;border-collapse:collapse">
            <thead><tr><th style="text-align:left">Asset</th><th style="text-align:right">Collected</th><th style="text-align:right">&asymp; USD</th><th style="text-align:right">Share</th></tr></thead>
            <tbody><tr><td colspan="4" class="lxadm-empty">Loading fee receipts&hellip;</td></tr></tbody>
          </table>
        </div>
      </div>

      <div class="adm-card">
        <div class="adm-card-head"><div class="adm-card-title">Fee ledger</div><div class="adm-card-sub" id="lxRevLedgerSub"></div></div>
        <div class="adm-card-body" style="padding:0;overflow-x:auto">
          <table class="adm-table" id="lxRevLedger" style="width:100%;border-collapse:collapse">
            <thead><tr><th style="text-align:left">When</th><th style="text-align:left">From</th><th style="text-align:left">Asset</th><th style="text-align:right">Amount</th><th style="text-align:right">Tx</th></tr></thead>
            <tbody><tr><td colspan="5" class="lxadm-empty">Loading fee receipts&hellip;</td></tr></tbody>
          </table>
        </div>
      </div>
`;

const CSS=`<style id="lx-admin-css">
.lxu-tier{display:inline-block;font-weight:700;font-size:12px;letter-spacing:.02em;padding:4px 9px;border-radius:999px}
.lxu-tier.on{background:rgba(34,197,94,.14);color:#22c55e}
.lxu-tier.off{background:rgba(127,127,140,.14);color:var(--text-muted)}
.lxu-tre{display:inline-block;margin-left:6px;font:700 10px/1 "Hanken Grotesk",system-ui,sans-serif;text-transform:uppercase;letter-spacing:.05em;padding:3px 6px;border-radius:999px;background:rgba(234,106,44,.16);color:#ea6a2c;vertical-align:middle}
#lxdPeriod{-webkit-appearance:none;appearance:none;cursor:pointer;padding-right:26px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a8fa3' stroke-width='2.6' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 8px center;background-size:11px}
.adm-table th{font-size:12px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;color:var(--text-muted);padding:12px 18px;border-bottom:1px solid var(--border)}
.adm-table td{padding:13px 18px;border-bottom:1px solid var(--border);font-size:14px;vertical-align:middle}
.adm-table tbody tr:last-child td{border-bottom:0}
.adm-table td.mono,.adm-table th.mono{font-family:'JetBrains Mono',monospace}
.lxadm-empty{padding:30px 18px!important;text-align:center;color:var(--text-muted);font-size:13.5px;line-height:1.6}
.lxadm-asset{display:inline-flex;align-items:center;gap:9px;font-weight:700}
.lxadm-ico{width:24px;height:24px;border-radius:50%;overflow:hidden;flex-shrink:0}
.lxadm-ico img{width:100%;height:100%;object-fit:cover;display:block;border-radius:50%}
.lxadm-link{color:var(--accent);font-weight:700;text-decoration:none}
.lxadm-link:hover{text-decoration:underline}
.lxbars{display:flex;align-items:stretch;gap:12px;height:300px;padding:18px 18px 14px}
.lxbar{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:6px;min-width:0}
/* transparent track: an empty month should read as no bar, not as a full-height grey one */
.lxbar-track{width:100%;flex:1;display:flex;align-items:flex-end;border-radius:7px 7px 0 0;overflow:hidden;background:transparent;border-bottom:1px solid var(--border)}
.lxbar-fill{width:100%;border-radius:7px 7px 0 0;background:linear-gradient(180deg,#8b7bff,#6d28d9);min-height:2px}
.lxbar-lab{font-size:11.5px;color:var(--text-muted);white-space:nowrap}
.lxbar-val{font-family:'JetBrains Mono',monospace;font-size:11.5px;font-weight:700;color:var(--text);white-space:nowrap}
.lxbars-empty{padding:60px 18px;text-align:center;color:var(--text-muted);font-size:13.5px}
.lxstat-row{display:flex;align-items:center;gap:11px;padding:11px 18px;border-bottom:1px solid var(--border)}
.lxstat-row:last-child{border-bottom:0}
.lxstat-dot{width:9px;height:9px;border-radius:50%;background:var(--text-muted);flex-shrink:0}
.lxstat-dot.ok{background:#35c07f}.lxstat-dot.bad{background:#dc2626}
.lxstat-name{flex:1;font-size:14px;font-weight:600;color:var(--text)}
.lxstat-val{font-family:'JetBrains Mono',monospace;font-size:12.5px;color:var(--text-muted)}
.lxwal-row{display:flex;align-items:center;gap:11px;padding:11px 18px;border-bottom:1px solid var(--border);text-decoration:none;color:inherit}
.lxwal-row:last-child{border-bottom:0}
.lxwal-av{width:28px;height:28px;border-radius:50%;flex-shrink:0}
.lxwal-meta{flex:1;min-width:0}
.lxwal-addr{font-family:'JetBrains Mono',monospace;font-size:13.5px;font-weight:700;color:var(--text)}
.lxwal-sub{font-size:12.5px;color:var(--text-muted)}
.lxwal-val{font-family:'JetBrains Mono',monospace;font-size:13.5px;font-weight:700;color:var(--text)}
.lxu-av{width:32px;height:32px;border-radius:50%;flex-shrink:0}
.lxa-ico{width:30px;height:30px;border-radius:50%;flex-shrink:0}
.lxmodal{position:fixed;inset:0;background:rgba(15,17,26,.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px}
.lxmodal-box{background:var(--surface);border:1px solid var(--border);border-radius:16px;width:100%;max-width:460px;padding:22px;box-shadow:0 24px 60px rgba(0,0,0,.28)}
.lxmodal-t{font-size:18px;font-weight:800;color:var(--text);margin:0 0 4px}
.lxmodal-s{font-size:13px;color:var(--text-muted);margin:0 0 18px;line-height:1.6}
.lxmodal-l{display:block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.02em;color:var(--text-muted);margin:0 0 6px}
.lxmodal-i{width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:14px;font-family:'JetBrains Mono',monospace;margin-bottom:14px;box-sizing:border-box}
.lxmodal-i:focus{outline:none;border-color:var(--accent)}
.lxmodal-e{font-size:13px;color:#dc2626;margin:0 0 12px;line-height:1.5;min-height:0}
.lxmodal-a{display:flex;gap:10px;justify-content:flex-end;margin-top:4px}
.lxm-card{display:block;padding:13px 14px;border:1px solid var(--border);border-radius:14px;background:var(--surface);margin-bottom:10px;text-decoration:none;color:inherit}
.lxm-top{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.lxm-av{width:34px;height:34px;border-radius:50%;flex-shrink:0}
.lxm-name{font-size:13.5px;font-weight:700;color:var(--text)}
.lxm-sub{font-size:11px;color:var(--text-muted)}
.lxm-right{margin-left:auto;text-align:right;font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:var(--text)}
.lxm-stats{display:flex;gap:14px}
.lxm-stats>div{flex:1;min-width:0}
.lxm-sl{font-size:10.5px;color:var(--text-muted);margin-bottom:2px}
.lxm-sv{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:var(--text)}
.lxnote{width:100%;box-sizing:border-box;min-height:76px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13.5px;font-family:inherit;resize:vertical}
.lxnote:focus{outline:none;border-color:var(--accent)}
.lxnote-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:9px}
.lxnote-hint{font-size:12px;color:var(--text-muted)}
.lxadm-sub{font-size:12.5px;color:var(--text-muted);font-weight:500}
.lx-vtick{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;margin-left:5px;border-radius:50%;background:var(--green,#35c07f);color:#fff;vertical-align:-2px;flex:0 0 14px}
.lx-vtick svg{width:9px;height:9px}
a.ext-link{display:inline-flex;align-items:center;justify-content:center;color:var(--text-muted);text-decoration:none}
a.ext-link:hover{color:var(--accent)}
.lxa-ico{width:26px;height:26px;border-radius:50%;object-fit:cover;background:var(--surface-2)}
.lxadm-note{margin:0 0 16px;padding:12px 14px;border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:10px;background:var(--surface-2);color:var(--text-muted);font-size:13px;line-height:1.6}
/* The listing queue's row actions are WORDS, not glyphs: "Approve" and "Decline" are decisions about
   someone's money and should not be a pair of unlabelled squares. .row-act-btn is 28x28 and made for
   the pencil and the cross, so these get their own size. */
.lxreq-btn{display:inline-flex;align-items:center;height:26px;padding:0 10px;margin-left:6px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font:inherit;font-size:12.5px;font-weight:600;line-height:1;white-space:nowrap;cursor:pointer;transition:border-color .13s,color .13s}
.lxreq-btn:hover:not(:disabled){border-color:var(--accent);color:var(--accent)}
.lxreq-btn:disabled{opacity:.55;cursor:default}
.lxreq-btn.go{border-color:var(--accent);background:var(--accent);color:#fff}
.lxreq-btn.go:hover:not(:disabled){filter:brightness(1.06);color:#fff}
.lxreq-note{white-space:normal;margin-top:4px;line-height:1.45;color:var(--text-muted);font-size:12.5px}
.lxreq-copy{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;margin-left:5px;padding:0;vertical-align:-5px;border:0;border-radius:5px;background:transparent;color:var(--text-muted);cursor:pointer;transition:color .13s,background .13s}
.lxreq-copy:hover{color:var(--text);background:var(--surface-2)}
.lxreq-copy .c2{display:none}
.lxreq-copy.ok{color:#1fa968}
.lxreq-copy.ok .c1{display:none}
.lxreq-copy.ok .c2{display:block}
.lxreq-links{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}
.lxreq-links a{display:inline-flex;align-items:center;height:22px;padding:0 9px;border:1px solid var(--border);border-radius:6px;font-size:11.5px;font-weight:600;color:var(--text-muted);text-decoration:none;transition:border-color .13s,color .13s}
.lxreq-links a:hover{border-color:var(--accent);color:var(--accent)}
.lxreq-nolinks{font-size:11.5px;font-style:italic;color:var(--text-muted);opacity:.75}
/* The admin activity feed on the dashboard. */
.lxaud-row{display:flex;align-items:center;gap:11px;padding:11px 16px;border-bottom:1px solid var(--border)}
.lxaud-row:last-child{border-bottom:0}
.lxaud-dot{width:7px;height:7px;flex:0 0 7px;border-radius:50%;background:var(--text-muted)}
.lxaud-dot.ok{background:#1fa968}
.lxaud-dot.warn{background:#e0553c}
.lxaud-dot.money{background:var(--accent)}
.lxaud-meta{flex:1;min-width:0}
.lxaud-act{font-size:13.5px;color:var(--text);line-height:1.35}
.lxaud-tgt{font-family:'JetBrains Mono',monospace;font-size:12.5px;color:var(--text-muted)}
.lxaud-who{font-size:11.5px;color:var(--text-muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lxaud-when{flex:0 0 auto;font-size:11.5px;color:var(--text-muted);font-family:'JetBrains Mono',monospace}
</'+'style>`.replace("</'+'style>","</"+"style>");

// ---- wallet signing, borrowed from the launchpad ------------------------------------------------------
// The panel signs exactly one kind of transaction: a refund to a declined listing applicant. Rather
// than write a second wallet stack for that, the launchpad's signer is lifted here BY NAME at build
// time, so Freighter / Albedo / Rabet / xBull / LOBSTR / WalletConnect keep one implementation across
// the whole site. If those functions are renamed the build FAILS instead of shipping a dead button.
function lpSigner(){
  const src=fs.readFileSync(__dirname+'/_launchpad.js','utf8');
  const grab=(name)=>{
    const i=src.indexOf('function '+name+'(');
    if(i<0) return null;
    let d=0;
    for(let k=src.indexOf('{',i); k>=0 && k<src.length; k++){
      if(src[k]==='{') d++;
      else if(src[k]==='}'){ d--; if(!d) return src.slice(i,k+1); }
    }
    return null;
  };
  const parts=[];
  for(const v of ['var _lpSdkP=null;','var _lpMods={};']){
    if(src.indexOf(v)<0){ console.error('admin: _launchpad.js no longer declares "'+v+'" — refusing to build.'); process.exit(1); }
    parts.push(v);
  }
  for(const n of ['lxLpSdk','lxLpFreighter','lxLpWalletId','lxLpConnectedAddr','lxLpMod','lxLpSignXdr']){
    const b=grab(n);
    if(!b){ console.error('admin: _launchpad.js no longer defines '+n+'() — refusing to build.'); process.exit(1); }
    parts.push(b);
  }
  // lxLpSignXdr reads the passphrase off this. The launchpad sets a fuller version of the same object;
  // the panel needs only the one field and never overwrites an existing one.
  parts.push('if(!window.__lxLP)window.__lxLP={passphrase:"Public Global Stellar Network ; September 2015"};');
  return parts.join('\n')+'\n';
}
const LP_SIGNER=lpSigner();

// ---- data layer ---------------------------------------------------------------------------------------
const SCRIPT='<script id="lx-admindata">(function(){'
+LP_SIGNER
+'var H="https://horizon.stellar.org";'
+'var VTICK="<svg viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"currentColor\\" stroke-width=\\"3.4\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\"><polyline points=\\"20 6 9 17 4 12\\"></polyline></svg>";'
+'var EXTICON="<svg width=\\"13\\" height=\\"13\\" viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"currentColor\\" stroke-width=\\"2\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\"><path d=\\"M7 17L17 7M17 7H8M17 7v9\\"></path></svg>";'
// Two glyphs in one button: the pages stack, and a tick that replaces them for a moment after a copy.
// Feedback matters more than usual here -- copying a 56-character account gives you nothing visible to
// check, so without it you cannot tell whether the click registered.
+'var COPYICON="<svg class=\\"c1\\" width=\\"12\\" height=\\"12\\" viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"currentColor\\" stroke-width=\\"2\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\"><rect x=\\"9\\" y=\\"9\\" width=\\"12\\" height=\\"12\\" rx=\\"2\\"></rect><path d=\\"M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1\\"></path></svg>"'
+'  +"<svg class=\\"c2\\" width=\\"12\\" height=\\"12\\" viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"currentColor\\" stroke-width=\\"3\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\"><polyline points=\\"20 6 9 17 4 12\\"></polyline></svg>";'
+'var FEE="'+FEE_COLLECTOR+'";'
+'function q(s){return document.querySelector(s);} function qa(s){return [].slice.call(document.querySelectorAll(s));}'
+'function j(u){return fetch(u).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});}'
+'function setT(el,t){ if(el&&el.textContent!==t)el.textContent=t; }'
+'function usd(n){ if(n==null||!isFinite(n))return "\\u2014"; if(n===0)return "$0"; if(n>=1e6)return "$"+(n/1e6).toFixed(2)+"M"; if(n>=1e3)return "$"+(n/1e3).toFixed(1)+"K"; if(n<0.0001)return "$"+(+n).toPrecision(3); return "$"+n.toFixed(n<1?4:2); }'
+'function num(n){ if(n==null||!isFinite(n))return "\\u2014"; return (+n).toLocaleString(undefined,{maximumFractionDigits:7}); }'
+'function shortG(a){ return a?a.slice(0,4)+"\\u2026"+a.slice(-4):""; }'
+'function esc(s){return (String(s==null?"":s).replace(/[<>&"]/g,function(c){return c==="<"?"&lt;":c===">"?"&gt;":c==="&"?"&amp;":"&quot;";})).split(String.fromCharCode(39)).join("&#39;");}'
+'function avatar(code){ var c=String(code||"?"),h=0; for(var i=0;i<c.length;i++)h=(h*31+c.charCodeAt(i))%360;'
+'  var t=c.replace(/[^A-Za-z0-9]/g,"").slice(0,2).toUpperCase()||"?";'
+'  return "data:image/svg+xml,"+encodeURIComponent(\'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="hsl(\'+h+\',60%,50%)"/><text x="20" y="26" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="15" fill="#fff">\'+t+\'</text></svg>\'); }'
+'function avatarPart(code){ return avatar(code); }'
+'function cssUrl(u){ return "url(\'"+String(u).split("\'").join("%27")+"\')"; }'
// ---- fetch every fee receipt (paged) ----
+'var RV=null, RV_SELF=0;'
+'function loadRevenue(){ if(RV)return Promise.resolve(RV); var recs=[];'
+'  function page(url,n){ return j(url).then(function(d){ if(!d)return; var r=(d._embedded&&d._embedded.records)||[]; recs=recs.concat(r);'
+'    var nx=d._links&&d._links.next&&d._links.next.href; if(r.length===200&&nx&&n<10)return page(nx,n+1); }); }'
+'  return page(H+"/accounts/"+FEE+"/payments?order=desc&limit=200&join=transactions",1).then(function(){'
+'    var inc=recs.filter(function(p){ return p.to===FEE && p.from!==FEE && (p.type==="payment"||p.type==="path_payment_strict_send"||p.type==="path_payment_strict_receive"); });'
+'    RV_SELF=recs.filter(function(p){ return p.to===FEE && p.from===FEE; }).length;'
+'    RV={rows:inc}; return RV; }); }'
// ---- USD pricing: exact amounts, converted only where a real price exists ----
+'var PX={}, LG={};'
+'function priceUsd(code,iss,cb){ var k=code+"-"+(iss||"");'
+'  if(PX[k]!==undefined){ cb(PX[k]); return; }'
+'  if(code==="XLM"){ j("/lxapi/xlm").then(function(d){ if(d&&+d.usd>0){ PX[k]=+d.usd; cb(PX[k]); return null; } return j("https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd").then(function(g){ PX[k]=(g&&g.stellar&&+g.stellar.usd)||null; cb(PX[k]); }); }); return; }'
+'  j("https://api.stellar.expert/explorer/public/asset?search="+encodeURIComponent(code+"-"+iss)+"&limit=5").then(function(d){'
+'    var rs=(d&&d._embedded&&d._embedded.records)||[];'
+'    var m=rs.filter(function(r){ return String(r.asset||"").indexOf(code+"-"+iss)===0; })[0];'
+'    PX[k]=(m&&+m.price>0)?+m.price:null;'
+'    var ti=(m&&(m.tomlInfo||m.toml_info))||{}; if(ti.image)LG[k]=ti.image;'   // same call already carries the artwork
+'    cb(PX[k]); }); }'
+'var KN=[["USDC","GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"],["AQUA","GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA"],["yXLM","GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55"],["EURC","GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2"],["yUSDC","GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF"]];'
// each curated pool is <asset>/XLM, so the XLM side doubled is the pool's total value in XLM
+'var POOLS=null;'
+'function loadPools(){ if(POOLS)return Promise.resolve(POOLS);'
+'  return Promise.all(KN.map(function(t){'
+'    return j(H+"/liquidity_pools?reserves=native,"+encodeURIComponent(t[0]+":"+t[1])+"&limit=1").then(function(d){'
+'      var p=d&&d._embedded&&d._embedded.records&&d._embedded.records[0]; if(!p)return null;'
+'      var xlm=0; (p.reserves||[]).forEach(function(r){ if(r.asset==="native")xlm+=+r.amount||0; });'
+'      return {code:t[0],iss:t[1],id:p.id,xlm:xlm*2}; });'
+'  })).then(function(a){ POOLS=a.filter(Boolean).sort(function(x,y){return y.xlm-x.xlm;}); return POOLS; }); }'
+'function pageTitle(){ return ((q(".admin-page-title")||q(".mob-page-title")||{}).textContent||"").trim(); }'
+'function pageHead(){ return q(".admin-page-head")||q(".mob-page-head"); }'
// The first call REMOVES the pager buttons, which used to make every later call a no-op: .pg-btn was
// gone, so the function returned before touching the count. That is why switching to a tab with one
// row left the line reading "1-55 of 55" -- the curated tab had written it and nothing could rewrite
// it. The info element is stamped on the way past so it can still be found afterwards.
+'function fixPager(n){ var info=q(".lxpg-info"), b=q(".pg-btn");'
+'  if(b){ var ctrls=b.parentNode, row=ctrls.parentNode;'
+'    info=row.querySelector(".pg-info"); if(!info){ var f=row.firstElementChild; if(f&&f!==ctrls)info=f; }'
+'    if(info)info.className=(info.className?info.className+" ":"")+"lxpg-info";'
+'    ctrls.remove(); }'
+'  if(info)info.innerHTML="<span class=\\"mono\\">"+(n?1:0)+"</span>\\u2013<span class=\\"mono\\">"+n+"</span> of <span class=\\"mono\\">"+n+"</span>"; }'
+'function isMob(){ return !!q(".mob-page-title"); }'
+'function isDash(){ return /^Dashboard/.test(pageTitle()) && !isMob(); }'
+'function assetOf(p){ return p.asset_type==="native"?{code:"XLM",iss:""}:{code:p.asset_code||"?",iss:p.asset_issuer||""}; }'
// ---- Revenue page ----
+'function paintRevenue(){ if(!q("#lxRevByAsset"))return;'
+'  loadRevenue().then(function(rv){ if(!RV_SELF)return; var head=pageHead(); if(!head||q(".lxadm-note"))return;'
+'    var d=document.createElement("div"); d.className="lxadm-note";'
+'    d.textContent="Excludes "+RV_SELF+" self-transfers — payments where the fee collector is both sender and recipient. Those move no money and are not revenue, so the totals here are lower than the raw account history on stellar.expert.";'
+'    head.parentNode.insertBefore(d, head.nextSibling); });'
+'  loadRevenue().then(function(rv){ var rows=rv.rows;'
+'    var now=new Date(), mStart=new Date(now.getFullYear(),now.getMonth(),1).getTime();'
+'    var byA={}, wallets={}, monthRows=[];'
+'    rows.forEach(function(p){ var a=assetOf(p), k=a.code+"-"+a.iss;'
+'      byA[k]=byA[k]||{code:a.code,iss:a.iss,amt:0,month:0};'
+'      byA[k].amt+=+p.amount||0; wallets[p.from]=1;'
+'      if(Date.parse(p.created_at)>=mStart){ byA[k].month+=+p.amount||0; monthRows.push(p); } });'
+'    setT(q("#lxRevCount"), num(rows.length));'
+'    setT(q("#lxRevWallets"), num(Object.keys(wallets).length));'
+'    var keys=Object.keys(byA);'
+'    var sub=q("#lxRevLedgerSub"); if(sub)sub.textContent=rows.length?("newest first \\u00b7 "+rows.length+" receipts"):"";'
+'    var tb=q("#lxRevLedger tbody");'
+'    if(tb){ tb.innerHTML = rows.length ? rows.slice(0,60).map(function(p){ var a=assetOf(p);'
+'        return "<tr><td>"+esc(new Date(p.created_at).toLocaleString())+"</td>"'
+'          +"<td class=\\"mono\\"><a class=\\"lxadm-link\\" target=\\"_blank\\" rel=\\"noopener\\" href=\\"https://stellar.expert/explorer/public/account/"+esc(p.from)+"\\">"+esc(shortG(p.from))+"</a></td>"'
+'          +"<td>"+esc(a.code)+"</td>"'
+'          +"<td style=\\"text-align:right\\" class=\\"mono\\">"+esc(num(+p.amount))+"</td>"'
+'          +"<td style=\\"text-align:right\\"><a class=\\"lxadm-link\\" target=\\"_blank\\" rel=\\"noopener\\" href=\\"https://stellar.expert/explorer/public/tx/"+esc(p.transaction_hash)+"\\">view</a></td></tr>"; }).join("")'
+'      : "<tr><td colspan=\\"5\\" class=\\"lxadm-empty\\">No fee receipts yet. Fees are paid to <span class=\\"mono\\">"+esc(shortG(FEE))+"</span> when users swap or add liquidity.</td></tr>"; }'
+'    var pending=keys.length, usdAll=0, usdMonth=0, priced=0, unpriced=[];'
+'    function render(){'
+'      var tb2=q("#lxRevByAsset tbody"); if(!tb2)return;'
+'      var tot=keys.reduce(function(s,k){ return s+(byA[k].usd||0); },0);'
+'      tb2.innerHTML = keys.length ? keys.sort(function(x,y){ return (byA[y].usd||0)-(byA[x].usd||0); }).map(function(k){ var a=byA[k];'
+'          var sh=tot>0&&a.usd!=null?((a.usd/tot*100).toFixed(1)+"%"):"\\u2014";'
+'          return "<tr><td><span class=\\"lxadm-asset\\"><span class=\\"lxadm-ico\\" data-lxc=\\""+esc(a.code)+"\\"><img src=\\""+(LG[k]||avatar(a.code))+"\\" alt=\\"\\"></span>"+esc(a.code)+"</span></td>"'
+'            +"<td style=\\"text-align:right\\" class=\\"mono\\">"+esc(num(a.amt))+"</td>"'
+'            +"<td style=\\"text-align:right\\" class=\\"mono\\">"+(a.usd==null?"<span title=\\"No spot price published for this asset \\u2014 counted in its own units, excluded from the USD total.\\">\\u2014</span>":esc(usd(a.usd)))+"</td>"'
+'            +"<td style=\\"text-align:right\\">"+sh+"</td></tr>"; }).join("")'
+'        : "<tr><td colspan=\\"4\\" class=\\"lxadm-empty\\">No fees collected yet.</td></tr>";'
+'      setT(q("#lxRevAll"), keys.length?usd(usdAll):"\\u2014");'
+'      setT(q("#lxRevMonth"), keys.length?usd(usdMonth):"\\u2014");'
+'      var s1=q("#lxRevAllSub"), s2=q("#lxRevMonthSub");'
+'      var uns=unpriced.length?(" \\u00b7 "+unpriced.length+" asset"+(unpriced.length>1?"s":"")+" unpriced"):"";'
+'      if(s1)s1.textContent="across "+keys.length+" asset"+(keys.length===1?"":"s")+uns;'
+'      if(s2)s2.textContent=new Date().toLocaleString(undefined,{month:"long"})+uns;'
+'      var bs=q("#lxRevBySub"); if(bs)bs.textContent="exact on-chain amounts"+(unpriced.length?" \\u00b7 USD shown where a spot price exists":"");'
+'    }'
+'    if(!pending){ render(); return; }'
+'    keys.forEach(function(k){ var a=byA[k];'
+'      priceUsd(a.code,a.iss,function(px){'
+'        if(px!=null){ a.usd=a.amt*px; usdAll+=a.usd; usdMonth+=a.month*px; priced++; } else { a.usd=null; unpriced.push(a.code); }'
+'        if(--pending===0)render(); }); });'
+'  }); }'
// ---- CSV export (real ledger, no backend needed) ----
+'function wireCsv(){ var b=q("#lxRevCsv"); if(!b||b.__lx)return; b.__lx=1;'
+'  b.addEventListener("click",function(){ loadRevenue().then(function(rv){'
+'    var head="date,from,asset,issuer,amount,tx\\n";'
+'    var body=rv.rows.map(function(p){ var a=assetOf(p); return [p.created_at,p.from,a.code,a.iss,p.amount,p.transaction_hash].join(","); }).join("\\n");'
+'    var blob=new Blob([head+body],{type:"text/csv"}); var u=URL.createObjectURL(blob);'
+'    var el=document.createElement("a"); el.href=u; el.download="lumoscore-fees.csv"; el.click(); setTimeout(function(){URL.revokeObjectURL(u);},1000); }); }); }'
// ---- Dashboard KPIs: fill what is real, dash what needs a backend ----
+`
// ---- Dashboard: windowed volume / trades / wallets, lifetime totals, and the 250K fee tier ----
// The SDK is only needed to read an envelope, so it loads on demand and only where it is used.
var _sbP=null;
function sdk(){ if(!_sbP)_sbP=new Promise(function(res,rej){
  if(window.StellarBase)return res(window.StellarBase);
  var el=document.createElement("script");
  el.src="/assets/vendor/stellar-base-13.0.1.min.js";
  el.onload=function(){ window.StellarBase?res(window.StellarBase):rej(new Error("sdk")); };
  el.onerror=function(){ rej(new Error("sdk")); };
  document.head.appendChild(el); }); return _sbP; }
// Gross volume for one fee receipt: the user's own swap leg plus the fee leg, both denominated in the
// asset being sent. Returns null when the envelope holds no swap -- a bare fee payment with no trade
// behind it is not volume, and is reported as unresolved rather than counted as zero.
// Also classifies WHERE the money came from, by the shape of the transaction rather than by its size.
// Measured across all 69 receipts, the shapes are: a user swap plus its fee (trading), the launchpad's
// issuance transaction which carries createAccount / setOptions / liquidityPoolDeposit (minting), and a
// handful of bare payments that are neither. Amount-based guessing would have been fragile -- a mint
// fee is 34.70 XLM today and that number is a config value, not a law.
function grossOf(S,p){ try{
  var ex=p.transaction&&p.transaction.envelope_xdr; if(!ex)return null;
  var tx=S.TransactionBuilder.fromXDR(ex,S.Networks.PUBLIC);
  var ops=tx.operations||[], swap=null, fee=0, mint=false;
  for(var i=0;i<ops.length;i++){ var o=ops[i];
    if(o.type==="setOptions"||o.type==="createAccount"||o.type==="liquidityPoolDeposit")mint=true;
    if(o.type==="pathPaymentStrictSend"&&o.destination===p.from){ swap=o; }
    else if(o.destination===FEE){ fee+=(+o.sendAmount||+o.amount||0); } }
  var kind=swap?"trade":(mint?"mint":"other");
  if(!swap)return {kind:kind,code:null,iss:"",gross:0};
  var a=swap.sendAsset; if(!a)return {kind:kind,code:null,iss:"",gross:0};
  var code=(a.isNative&&a.isNative())?"XLM":a.code;
  if(!code)return {kind:kind,code:null,iss:"",gross:0};
  var iss=(code==="XLM")?"":(a.issuer||"");
  return {kind:kind,code:code,iss:iss,gross:(+swap.sendAmount||0)+fee};
}catch(e){ return null; } }
// Which receipts were bridge fees. Shape cannot tell us (see the note above), so this is the authority;
// every entry was verified against the ledger server-side before it was stored. An unreachable
// registry degrades to {} and the rows simply stay in "other" -- never to a wrong attribution.
var BRIDGE=null;
function loadBridge(){ if(BRIDGE)return Promise.resolve(BRIDGE);
  return fetch("/lxapi/bridgetx?limit=200").then(function(r){ return r.ok?r.json():null; })
    .then(function(d){ var m={}; ((d&&d.rows)||[]).forEach(function(x){ if(x&&x.feeHash)m[x.feeHash]=x; });
      BRIDGE=m; return m; })
    .catch(function(){ BRIDGE={}; return BRIDGE; }); }
var VOL=null;
function loadVolume(){ if(VOL)return Promise.resolve(VOL);
  return Promise.all([loadRevenue(),sdk(),loadBridge()]).then(function(z){ var rv=z[0],S=z[1],BR=z[2]||{};
    var out=[],miss=0;
    // Every receipt is kept now, not just the ones with a swap, because the revenue breakdown needs to
    // account for all of them. Volume still only counts rows with gross > 0; a mint fee is revenue but
    // it is not trading volume, and adding it to volume would overstate how much is being traded.
    rv.rows.forEach(function(p){ var g=grossOf(S,p);
      if(!g){ miss++; return; }
      var br=BR[p.transaction_hash];
      // A registered bridge is a bridge, whatever its shape looked like. Its "gross" is the amount
      // that crossed, kept in bridged rather than gross so it can never be added to SWAP volume --
      // bridging is real volume, but it is not trading, and conflating them overstates the DEX.
      if(br)g.kind="bridge";
      if(!g.gross&&!br)miss++;
      var fa=assetOf(p);
      out.push({t:Date.parse(p.created_at),from:p.from,code:g.code,iss:g.iss,gross:g.gross,
        kind:g.kind,fee:(+p.amount||0),feeCode:fa.code,feeIss:fa.iss,
        bridged:br?(+br.gross||+br.amount||0):0,bridgeTo:br?(br.destName||""):""}); });
    VOL={rows:out,missing:miss}; return VOL; })
   .catch(function(){ VOL={rows:[],missing:-1}; return VOL; }); }
// Assets we cannot price are reported, never guessed at -- the rule the revenue table already follows.
function volUsd(rows,since,cb){ var byA={};
  rows.forEach(function(r){ if(since&&r.t<since)return; if(!r.code||!r.gross)return; var k=r.code+"-"+r.iss;
    byA[k]=byA[k]||{code:r.code,iss:r.iss,amt:0}; byA[k].amt+=r.gross; });
  var ks=Object.keys(byA); if(!ks.length){ cb(0,0); return; }
  var pend=ks.length,total=0,unpriced=0;
  ks.forEach(function(k){ var a=byA[k]; priceUsd(a.code,a.iss,function(px){
    if(px!=null)total+=a.amt*px; else unpriced++;
    if(--pend===0)cb(total,unpriced); }); }); }
// Wallets at or above the fee-tier threshold. stellar.expert ranks holders by balance DESCENDING, so
// this stops at the first holder below the line instead of paging every trustline: measured, the
// boundary sits at #115 inside the very first page of 200. Balances arrive in stroops.
// Treasury / burn wallets use the SAME list the rewards engine uses, so the two agree.
var LUMOS_ISS="GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S",TIER=250000;
var TREASURY={"GBIU5NISX5IP6VXZK7DEKLZC4ZVPWNCDEYQLQGXG33Y3J2LHPKPCHUOK":1,
"GCCDEU4DOW3AQ5WFWY7LDEFZIJAQBI5TQXRT3XAZSWDRLK3LG53HBQCP":1,
"GAR4HYWGY4YE7WOU2TGH7G4RL7ON72KQP24WWBT755WAWPCKRFS4SHWL":1,
"GA27ELKFRT7JVZTJW4P3I3ORWLLNKRIB3D6GELPN7IESPOCUNS5NHTOD":1,
"GCYFMZPDAR7ZTTTBA5DVG2SPR2N4CLPZLGLVI475BCGJ532WOKWRKUDG":1,
"GAMXMHJX6CW6LZWUYRKVF73GOMRFJDQI57UMA4LE5QUF4DCJRGI55QD6":1,
"GDVU64GNDFDR3OWKGPK37DAK67RPOK4OMZB4RH7NQN5UOYB4GPFVQUOD":1,
"GDB46BXMVI7FEZCHG4OTZ3OCSJX4CRBOOK6OJL5JD7BF5QIW3AS53IWA":1};
var TIERC=null;
function loadTier(){ if(TIERC)return Promise.resolve(TIERC);
  var n=0,excl=0,set={},failed=false;
  function page(cur,depth){
    return j("/lxapi/holders?asset=LUMOS-"+LUMOS_ISS+"&limit=200"+(cur?("&cursor="+encodeURIComponent(cur)):"")).then(function(d){
      if(!d){ failed=true; return; }
      var rs=(d._embedded&&d._embedded.records)||[]; if(!rs.length)return;
      var below=false;
      for(var i=0;i<rs.length;i++){ var bal=(+rs[i].balance||0)/1e7;
        if(bal<TIER){ below=true; break; }
        var ad=rs[i].address||rs[i].account; if(TREASURY[ad])excl++; else { n++; set[ad]=1; } }
      if(below)return;
      var nx=rs[rs.length-1].paging_token;
      if(nx&&depth<6)return page(nx,depth+1); }); }
  return page("",1).then(function(){ TIERC={n:(failed?null:n),excluded:excl,set:set}; return TIERC; })
   .catch(function(){ TIERC={n:null,excluded:0,set:{}}; return TIERC; }); }
var WIN=[["24H",864e5],["7D",6048e5],["30D",2592e6],["Lifetime",0]], WI=0;
function winSince(){ var ms=WIN[WI][1]; return ms?(Date.now()-ms):0; }
function kpiTile(id,label,foot,tip){
  return "<div class='kpi'><div class='kpi-head'><span class='kpi-label'>"+label+"</span></div>"
    +"<div class='kpi-value' id='"+id+"'"+(tip?(" title='"+tip+"'"):"")+">\u2014</div>"
    +"<div class='kpi-foot' id='"+id+"F'>"+foot+"</div></div>"; }
function per(){ return "<span class='lxd-per'>"+WIN[WI][0]+"</span>"; }
function buildDash(grid){
  grid.innerHTML = kpiTile("lxdVol","Volume",per()+" \u00b7 swap volume")
    + kpiTile("lxdBrVol","Cross-chain volume",per()+" \u00b7 bridged via CCTP","USDC sent through the Cross-Chain bridge, counted gross \u2014 what the sender parted with, including our fee. Kept out of Volume on purpose: that figure is swap volume, and adding bridged USDC to it would overstate how much is being traded.")
    + kpiTile("lxdTrades","Trades",per()+" \u00b7 fee-paying swaps")
    + kpiTile("lxdWal","Connected wallets",per()+" · distinct wallets","Distinct wallets that connected a wallet to the site in this window. Recorded by our own beacon, because nothing on-chain marks a connection - only wallets that go on to pay a fee leave a trace, and those are a fraction of the people who open the app. Counted per UTC day.")
    + kpiTile("lxdRev","Revenue",per()+" \u00b7 fees collected")
    + kpiTile("lxdVolA","Lifetime volume","every swap since launch")
    + kpiTile("lxdBrVolA","Lifetime cross-chain","every bridge since launch")
    + kpiTile("lxdTradesA","Lifetime trades","every fee-paying swap")
    + kpiTile("lxdWalA","Lifetime wallets","connected since the beacon went live","Distinct wallets ever seen connecting. This starts from the day the beacon was installed - it cannot be backfilled, because the connections before it were never recorded anywhere.")
    + kpiTile("lxdTier","Holders \u2265 250K LUMOS","qualify for the 0.1% fee","Wallets holding at least 250,000 LUMOS, the threshold for the reduced 0.1% platform fee. Treasury and burn wallets are excluded.");
}
// The window control sits in the page header beside Export/Refresh, where the design puts actions.
function wirePeriod(){ var host=q(".admin-page-actions"); if(!host||q("#lxdPeriod"))return;
  var sel=document.createElement("select"); sel.id="lxdPeriod"; sel.className="adm-btn ghost";
  sel.innerHTML=WIN.map(function(w,i){ return "<option value='"+i+"'>"+w[0]+"</option>"; }).join("");
  sel.addEventListener("change",function(){ WI=+sel.value||0;
    qa(".lxd-per").forEach(function(e){ e.textContent=WIN[WI][0]; }); fillDash(); });
  host.insertBefore(sel,host.firstChild); }
function fillDash(){
  var since=winSince();
  loadRevenue().then(function(rv){
    var inWin=rv.rows.filter(function(p){ return !since||Date.parse(p.created_at)>=since; });
    setT(q("#lxdTrades"), num(inWin.length));
    setT(q("#lxdTradesA"), num(rv.rows.length));
    var wAll={}; rv.rows.forEach(function(p){ wAll[p.from]=1; });
    // (fee-paying wallet count lives on the Users page; these two tiles are connections)
    var byA={}; inWin.forEach(function(p){ var a=assetOf(p), k=a.code+"-"+a.iss;
      byA[k]=byA[k]||{code:a.code,iss:a.iss,amt:0}; byA[k].amt+=+p.amount||0; });
    var ks=Object.keys(byA);
    if(!ks.length){ setT(q("#lxdRev"),usd(0)); return; }
    var pend=ks.length,tot=0;
    ks.forEach(function(k){ var a=byA[k]; priceUsd(a.code,a.iss,function(px){
      if(px!=null)tot+=a.amt*px; if(--pend===0)setT(q("#lxdRev"),usd(tot)); }); });
  });
  loadVolume().then(function(v){
    if(v.missing<0){ var e=q("#lxdVolF"); if(e)e.textContent="could not read the transaction envelopes"; return; }
    volUsd(v.rows,since,function(t,un){ setT(q("#lxdVol"), usd(t));
      // Some fee receipts carry no swap in their envelope -- real revenue, but not volume. That is why
      // revenue/volume lands above the 0.2% fee rate, so the count is shown rather than left to puzzle
      // over: an unexplained ratio invites someone to trust the wrong number.
      var f=q("#lxdVolF"); if(f)f.innerHTML=per()+" \u00b7 swap volume"+(un?(" \u00b7 "+un+" asset(s) unpriced"):"")+(v.missing>0?(" \u00b7 "+v.missing+" receipt(s) with no swap"):""); });
    volUsd(v.rows,0,function(t){ setT(q("#lxdVolA"), usd(t)); });
    // Straight sum, no pricing step: CCTP moves USDC and nothing else.
    var brP=0,brA=0,brN=0;
    v.rows.forEach(function(r){ var b=+r.bridged||0; if(!b)return;
      brA+=b; brN++; if(!since||r.t>=since)brP+=b; });
    setT(q("#lxdBrVol"), usd(brP)); setT(q("#lxdBrVolA"), usd(brA));
    var bf=q("#lxdBrVolF"); if(bf)bf.innerHTML=per()+" \u00b7 bridged via CCTP";
    var bfa=q("#lxdBrVolAF"); if(bfa)bfa.textContent=brN?("every bridge since launch \u00b7 "+brN+" transfer"+(brN===1?"":"s")):"no bridges recorded yet";
  });
  loadTier().then(function(t){ if(t.n==null){ setT(q("#lxdTier"),"\u2014");
    var e=q("#lxdTierF"); if(e)e.textContent="could not read the holder list"; return; }
    setT(q("#lxdTier"), num(t.n));
    var f=q("#lxdTierF"); if(f)f.textContent="qualify for the 0.1% fee"+(t.excluded?(" \u00b7 "+t.excluded+" treasury excluded"):""); });
  // Connected wallets. All four windows arrive in one response, so switching the period never
  // re-fetches. null means the store could not answer -- rendered as a dash with the reason, never as
  // zero, because "no connections" and "we could not look" are different claims.
  loadWallets().then(function(w){
    var k=["d1","d7","d30","all"][WI];
    setT(q("#lxdWal"), w[k]==null?"\u2014":num(w[k]));
    setT(q("#lxdWalA"), w.all==null?"\u2014":num(w.all));
    var f=q("#lxdWalF");
    if(f)f.innerHTML=(w[k]==null)?"beacon not reporting":(per()+" \u00b7 distinct wallets");
    var g=q("#lxdWalAF");
    if(g)g.textContent=w.since?("connected since "+w.since):"connected since the beacon went live";
  });
}
// Cached for the page's lifetime: the four windows come back together, so the period selector reads
// from this instead of going to the network again.
var WAL=null;
function loadWallets(){ if(WAL)return Promise.resolve(WAL);
  return j("/lxapi/walletstats").then(function(d){
    WAL=d||{d1:null,d7:null,d30:null,all:null}; return WAL; })
   .catch(function(){ WAL={d1:null,d7:null,d30:null,all:null}; return WAL; }); }

// Where the revenue came from. The on-chain half is classified by transaction SHAPE (see grossOf), not
// by amount. The off-chain half cannot be read from anywhere, so it is entered by hand -- and shown as
// such, because a category that only ever reads zero should say whether that means "none" or "nobody
// has recorded any".
var MANUAL=null;
function loadManual(){ if(MANUAL)return Promise.resolve(MANUAL);
  return fetch("/lxapi/revenue").then(function(r){ return r.ok?r.json():null; })
    .then(function(d){ MANUAL=(d&&d.entries)||[]; return MANUAL; })
    .catch(function(){ MANUAL=[]; return MANUAL; }); }

var SRC_LABEL={trade:"Trading fees",mint:"Token minting",bridge:"Cross-chain fees",other:"Other on-chain",
  ads:"Advertising",listing:"Token listings",sponsorship:"Sponsorships",other_manual:"Other"};
var SRC_HOW={trade:"platform fee on each swap, read from the chain",
  mint:"launchpad issuance fee, read from the chain",
  bridge:"CCTP bridge fee, matched to its burn on the chain",
  other:"payments to the fee collector with no swap, mint or bridge behind them",
  ads:"entered by hand",listing:"entered by hand",sponsorship:"entered by hand",other_manual:"entered by hand"};

function paintSources(){
  var tbl=q("#lxSrcTable"); if(!tbl)return;
  var tb=tbl.querySelector("tbody"); if(!tb)return;
  var rows={};
  function add(k,usd){ rows[k]=(rows[k]||0)+usd; }

  Promise.all([loadVolume(),loadManual()]).then(function(z){
    var v=z[0], man=z[1];
    if(v.missing<0){ tb.innerHTML="<tr><td colspan='4' class='lxadm-empty'>Could not read the transaction envelopes, so the on-chain split is unavailable.</td></tr>"; return; }

    // group the on-chain receipts by kind, then by fee asset, so each asset is priced once
    var byKind={};
    v.rows.forEach(function(r){ var k=r.kind||"other";
      byKind[k]=byKind[k]||{}; var a=r.feeCode+"-"+r.feeIss;
      byKind[k][a]=(byKind[k][a]||0)+r.fee; });

    var pend=0, unpriced=0;
    Object.keys(byKind).forEach(function(k){ Object.keys(byKind[k]).forEach(function(){ pend++; }); });
    man.forEach(function(e){ add(e.source==="other"?"other_manual":e.source, parseFloat(e.amountUsd)||0); });
    if(!pend){ draw(); return; }

    Object.keys(byKind).forEach(function(k){
      Object.keys(byKind[k]).forEach(function(a){
        var i=a.lastIndexOf("-"), code=a.slice(0,i), iss=a.slice(i+1);
        priceUsd(code,iss,function(px){
          if(px!=null)add(k,byKind[k][a]*px); else unpriced++;
          if(--pend===0)draw();
        });
      });
    });

    function draw(){
      var order=["trade","mint","bridge","other","ads","listing","sponsorship","other_manual"];
      var total=0; order.forEach(function(k){ total+=rows[k]||0; });
      var any=order.some(function(k){ return rows[k]; });
      if(!any&&!man.length){ tb.innerHTML="<tr><td colspan='4' class='lxadm-empty'>No revenue recorded yet.</td></tr>"; }
      else {
        tb.innerHTML=order.map(function(k){
          var val=rows[k]||0;
          var manual=(k==="ads"||k==="listing"||k==="sponsorship"||k==="other_manual");
          // A zero from the chain means zero. A zero from a hand-entered category means nobody has
          // recorded one, which is a different statement and should not read as revenue of nil.
          if(!val&&manual)return "";
          var share=total>0?((val/total*100).toFixed(1)+"%"):"\u2014";
          return "<tr><td><b>"+esc(SRC_LABEL[k])+"</b></td>"
            +"<td style='color:var(--text-muted);font-size:13px'>"+esc(SRC_HOW[k])+"</td>"
            +"<td class='num-cell' style='text-align:right'>"+esc(usd(val))+"</td>"
            +"<td style='text-align:right'>"+share+"</td></tr>";
        }).join("");
      }
      var sub=q("#lxSrcSub");
      if(sub){
        var noManual=!man.length;
        sub.textContent=usd(total)+" total"
          +(unpriced?(" \u00b7 "+unpriced+" asset(s) unpriced"):"")
          +(noManual?" \u00b7 nothing entered for advertising or listings yet":"");
      }
    }
  });
}

// Adding an off-chain entry. Deliberately a short form: source, amount, date, note. Anything more
// elaborate is an accounting package, and this only exists so the revenue page is not silently missing
// the money that never touches the chain.
function addManual(){
  if(q(".lxmodal"))return;
  var m=document.createElement("div"); m.className="lxmodal";
  var today=new Date().toISOString().slice(0,10);
  m.innerHTML="<div class='lxmodal-box'><h3 class='lxmodal-t'>Add off-chain revenue</h3>"
    +"<p class='lxmodal-s'>Advertising, paid listings and sponsorships are invoiced off-chain and leave no trace we can read, so they have to be recorded here or they never appear.</p>"
    +"<label class='lxmodal-l' for='lxrvSrc'>Source</label>"
    +"<select class='lxmodal-i' id='lxrvSrc'><option value='ads'>Advertising</option>"
    +"<option value='listing'>Token listing</option><option value='sponsorship'>Sponsorship</option>"
    +"<option value='other'>Other</option></select>"
    +"<label class='lxmodal-l' for='lxrvAmt'>Amount (USD)</label><input class='lxmodal-i' id='lxrvAmt' type='number' step='0.01' placeholder='500.00'>"
    +"<label class='lxmodal-l' for='lxrvWhen'>Date received</label><input class='lxmodal-i' id='lxrvWhen' type='date' value='"+today+"'>"
    +"<label class='lxmodal-l' for='lxrvNote'>Note</label><input class='lxmodal-i' id='lxrvNote' placeholder='Who paid, and what for'>"
    +"<p class='lxmodal-e' id='lxrvErr'></p>"
    +"<div class='lxmodal-a'><button class='adm-btn ghost' type='button' id='lxrvCancel'>Cancel</button>"
    +"<button class='adm-btn primary' type='button' id='lxrvOk'>Record</button></div></div>";
  document.body.appendChild(m);
  function close(){ m.remove(); }
  m.addEventListener("click",function(e){ if(e.target===m)close(); });
  m.querySelector("#lxrvCancel").addEventListener("click",close);
  var er=m.querySelector("#lxrvErr");
  m.querySelector("#lxrvOk").addEventListener("click",function(){
    var amt=parseFloat(m.querySelector("#lxrvAmt").value);
    if(!isFinite(amt)||amt===0){ er.textContent="Enter an amount."; return; }
    var d=m.querySelector("#lxrvWhen").value;
    var when=d?Date.parse(d+"T12:00:00Z"):Date.now();
    var ok=m.querySelector("#lxrvOk"); ok.disabled=true; ok.textContent="Saving\u2026";
    fetch("/lxapi/revenue",{method:"PUT",headers:{"content-type":"application/json"},
      body:JSON.stringify({source:m.querySelector("#lxrvSrc").value,amountUsd:amt,when:when,
        note:m.querySelector("#lxrvNote").value})})
      .then(function(r){ return r.json().then(function(b){ return {ok:r.ok,b:b}; }); })
      .then(function(z){ ok.disabled=false; ok.textContent="Record";
        if(!z.ok){ er.textContent=(z.b&&z.b.error)||"Could not save."; return; }
        MANUAL=null; close(); paintSources(); })
      .catch(function(e){ ok.disabled=false; ok.textContent="Record"; er.textContent=e.message; });
  });
}

function paintDashboard(){ if(!isDash())return; var grid=q(".kpi-grid"); if(!grid)return;
  if(grid.getAttribute("data-lxbuilt")!=="1"){ grid.setAttribute("data-lxbuilt","1"); buildDash(grid); wirePeriod(); }
  fillDash();
}
`
// ---- Support / Blogs: honest empty states, no invented records ----
// ---- stale chrome inherited from the design ------------------------------------------------------
// Two things the admin pages carry from the Aptos template they were built out of, both of which say
// something untrue:
//   1. The network chip reads "Aptos". These pages are extracted from the lumoscore-aptos-* container,
//      so the switcher defaults to that chain. LumosCore has been Stellar-only since the mainnet
//      migration -- and every figure on these pages is read from Stellar.
//   2. The dashboard subtitle promises "refreshed every 30s". Nothing polls; the figures are read once
//      per page load. Either build a poller or stop claiming one, and a claim nobody checks is the
//      worse of the two.
// Re-asserted through an observer because the chip is drawn by the design's own script, which can
// redraw it after we run -- the same defence the wallet and rewards layers use.
+'function paintChrome(){'
+'  function fixChip(){ qa(".lxns-trigger").forEach(function(t){'
+'    var el=t.querySelector(".lxns-tname")||t;'
+'    if(/Aptos/i.test(el.textContent||""))setT(el,"Stellar"); }); }'
+'  fixChip();'
+'  try{ var mo=new MutationObserver(fixChip);'
+'    mo.observe(document.body,{childList:true,subtree:true,characterData:true}); }catch(e){}'
+'  var sub=q(".admin-page-sub");'
+'  if(sub&&/refreshed every/i.test(sub.textContent||""))'
+'    setT(sub,"Read from Stellar mainnet when this page loads \\u2014 press Refresh for current figures.");'
+'}'
+'function paintNoBackend(){'
+'  var t=pageTitle();'
+'  var isSup=false, isBlog=false;'
+'  if(!isSup&&!isBlog)return;'
+'  qa(".kpi .kpi-value").forEach(function(v){ setT(v,"\\u2014"); v.title="No backend connected \\u2014 there is nowhere for this data to come from yet."; });'
+'  qa(".kpi .kpi-foot").forEach(function(f){ setT(f,"awaiting backend"); });'
+'  var msg=isSup'
+'    ? "Support tickets need somewhere to live. LumosCore is a static site today, so there is no store to read tickets from and nothing is being collected. The screen below is the finished UI, waiting on a backend."'
+'    : "Blog posts need somewhere to live. LumosCore is a static site today, so there is no store to read or publish posts from. The screen below is the finished UI, waiting on a backend.";'
+'  qa(".mob-kpi .mob-kpi-value").forEach(function(v){ setT(v,"\u2014"); });'
+'  qa(".mob-kpi .mob-kpi-foot").forEach(function(f){ f.innerHTML=""; f.textContent="awaiting backend"; });'
+'  var head=pageHead();'
+'  if(head&&!q(".lxadm-note")){ var d=document.createElement("div"); d.className="lxadm-note"; d.textContent=msg; head.parentNode.insertBefore(d, head.nextSibling); }'
+'  fixPager(0);'
+'  if(isMob()){'
+'    var msub=q(".mob-page-sub"); if(msub)msub.textContent="Awaiting a backend";'
+'    var mseg=q(".mob-seg-row"); if(mseg)mseg.remove();'
+'    var mc=qa(".mob-user-card");'
+'    if(mc.length){ var hst=mc[0].parentNode, ref=mc[0].nextSibling;'
+'      mc.forEach(function(c){ c.remove(); });'
+'      var em=document.createElement("div"); em.className="lxadm-empty";'
+'      em.textContent="Nothing to show — no backend connected.";'
+'      hst.insertBefore(em, ref); } }'
+'  qa(".adm-card tbody, .adm-table tbody").forEach(function(tb){'
+'    var cols=(tb.parentNode.querySelectorAll("thead th")||[]).length||4;'
+'    if(!tb.querySelector(".lxadm-empty")) tb.innerHTML="<tr><td colspan=\\""+cols+"\\" class=\\"lxadm-empty\\">Nothing to show \\u2014 no backend connected.</td></tr>"; });'
+'}'
+'function retitle(head,txt,sub){ if(!head)return; var t=head.querySelector(".adm-card-title")||head;'
+'  for(var i=t.childNodes.length-1;i>=0;i--){ var n=t.childNodes[i]; if(n.nodeType===3&&n.textContent.trim()){ n.textContent=" "+txt; break; } }'
+'  if(sub&&!head.querySelector(".lxadm-sub")){ var e2=document.createElement("span"); e2.className="lxadm-sub"; e2.textContent=sub; head.appendChild(e2); } }'
+'function ago(iso){ var d=(Date.now()-Date.parse(iso))/1000; if(!isFinite(d))return "";'
+'  if(d<60)return Math.max(1,Math.round(d))+"s ago"; if(d<3600)return Math.round(d/60)+"m ago";'
+'  if(d<86400)return Math.round(d/3600)+"h ago"; return Math.round(d/86400)+"d ago"; }'
// Fee receipts are denominated in whatever asset the user swapped, so a monthly total is only
// meaningful once each is converted. Prices are today's spot -- said so on the card, not implied.
+'function paintDashPanels(){ if(!isDash())return;'
+'  var chartCard=q(".adm-card.chart-card");'
+'  if(chartCard&&chartCard.getAttribute("data-lxbuilt")!=="1"){ chartCard.setAttribute("data-lxbuilt","1");'
+'    chartCard.innerHTML="<div class=\\"adm-card-head\\"><div class=\\"adm-card-title\\">Revenue by month</div>"'
+'      +"<span class=\\"lxadm-sub\\">platform fees, converted at today\u2019s prices</span></div>"'
+'      +"<div class=\\"adm-card-body\\"><div id=\\"lxDashBars\\" class=\\"lxbars-empty\\">Loading\u2026</div></div>"; }'
+'  var netBars=q(".net-bars"); if(netBars)retitle(netBars.previousElementSibling,"Revenue by asset");'
+'  var strip=q(".top-strip"); if(strip)retitle(strip.previousElementSibling,"Largest LumosCore pools");'
+'  var feed=q("#actFeed"); if(feed){ feed.id="lxActFeed"; feed.innerHTML="<div class=\\"lxadm-empty\\">Loading\u2026</div>"; }'
// nothing on a static site watches for anomalies, so the alert list is emptied rather than invented
+'  var alertRows=qa(".alert-row");'
+'  if(alertRows.length){ var wrap=alertRows[0].parentNode;'
+'    wrap.innerHTML="<div class=\\"lxadm-empty\\">No monitoring connected. Alerts need a service watching the chain and a place to store what it finds \u2014 nothing is being generated here.</div>";'
+'    var pill=wrap.previousElementSibling&&wrap.previousElementSibling.querySelector(".pill"); if(pill)pill.remove(); }'
+'  loadRevenue().then(function(rv){'
// ---- month bars ----
+'    var now=new Date(), buckets=[], idx={};'
+'    for(var i=5;i>=0;i--){ var d=new Date(now.getFullYear(),now.getMonth()-i,1);'
+'      var k=d.getFullYear()+"-"+d.getMonth();'
+'      idx[k]=buckets.length; buckets.push({label:d.toLocaleString(undefined,{month:"short"}),usd:0}); }'
+'    var byA={}; rv.rows.forEach(function(p){ var a=assetOf(p), k=a.code+"-"+a.iss;'
+'      byA[k]=byA[k]||{code:a.code,iss:a.iss,amt:0,rows:[]}; byA[k].amt+=+p.amount||0; byA[k].rows.push(p); });'
+'    var ks=Object.keys(byA), pend=ks.length, total=0;'
+'    function drawBars(){'
+'      var box=q("#lxDashBars"); if(!box)return;'
+'      var max=0; buckets.forEach(function(b){ if(b.usd>max)max=b.usd; });'
+'      if(!max){ box.className="lxbars-empty"; box.textContent="No fees collected in the last six months."; return; }'
+'      box.className="lxbars";'
+'      box.innerHTML=buckets.map(function(b){ var pct=b.usd>0?Math.max(3,Math.round(b.usd/max*100)):0;'
+'        return "<div class=\\"lxbar\\"><div class=\\"lxbar-track\\"><div class=\\"lxbar-fill\\" style=\\"height:"+pct+"%\\"></div></div>"'
+'          +"<div class=\\"lxbar-val\\">"+usd(b.usd)+"</div><div class=\\"lxbar-lab\\">"+esc(b.label)+"</div></div>"; }).join(""); }'
+'    function drawSplit(){'
+'      if(!netBars)return;'
+'      var list=ks.map(function(k){return byA[k];}).filter(function(a){return a.usd>0;}).sort(function(x,y){return y.usd-x.usd;});'
+'      if(!list.length||!total){ netBars.innerHTML="<div class=\\"lxadm-empty\\">No priced fee revenue yet.</div>"; return; }'
+'      var C=["linear-gradient(90deg,#8b7bff,#2563eb)","linear-gradient(90deg,#35c07f,#15803d)","linear-gradient(90deg,#ea6a2c,#c2410c)","linear-gradient(90deg,#f59e0b,#b45309)","linear-gradient(90deg,#ec4899,#9d174d)"];'
+'      netBars.innerHTML=list.slice(0,5).map(function(a,i){ var pc=a.usd/total*100;'
+'        return "<div class=\\"net-bar\\"><div class=\\"net-bar-head\\"><span class=\\"net-bar-name\\">"+esc(a.code)+"</span>"'
+'          +"<span class=\\"net-bar-val\\">"+usd(a.usd)+" \u00b7 "+pc.toFixed(1)+"%</span></div>"'
+'          +"<div class=\\"net-bar-track\\"><div class=\\"net-bar-fill\\" style=\\"width:"+pc.toFixed(1)+"%;background:"+C[i%C.length]+"\\"></div></div></div>"; }).join(""); }'
+'    if(!pend){ drawBars(); drawSplit(); } else {'
+'      ks.forEach(function(k){ var a=byA[k]; priceUsd(a.code,a.iss,function(px){'
+'        if(px!=null){ a.usd=a.amt*px; total+=a.usd;'
+'          a.rows.forEach(function(p){ var d=new Date(Date.parse(p.created_at));'
+'            var bk=idx[d.getFullYear()+"-"+d.getMonth()]; if(bk!=null)buckets[bk].usd+=(+p.amount||0)*px; }); }'
+'        if(--pend===0){ drawBars(); drawSplit(); } }); }); }'
// ---- recent activity: the last six real fee receipts ----
+'    var fd=q("#lxActFeed"); if(fd){'
+'      if(!rv.rows.length){ fd.innerHTML="<div class=\\"lxadm-empty\\">No fee payments yet.</div>"; }'
+'      else fd.innerHTML=rv.rows.slice(0,6).map(function(p){ var a=assetOf(p);'
+'        return "<div class=\\"act-row\\"><span class=\\"act-ico green\\"></span><div class=\\"act-text\\">"'
+'          +"<div class=\\"act-title\\"><span class=\\"mono\\">"+esc(shortG(p.from))+"</span> paid <span class=\\"mono\\">"+esc(num(+p.amount))+" "+esc(a.code)+"</span> in platform fees</div>"'
+'          +"<div class=\\"act-meta\\"><span>Stellar mainnet</span><a class=\\"lxadm-link mono\\" target=\\"_blank\\" rel=\\"noopener\\" href=\\"https://stellar.expert/explorer/public/tx/"+esc(p.transaction_hash)+"\\">tx: "+esc(String(p.transaction_hash).slice(0,4))+"\u2026"+esc(String(p.transaction_hash).slice(-4))+"</a></div>"'
+'          +"</div><span class=\\"act-time\\">"+esc(ago(p.created_at))+"</span></div>"; }).join(""); }'
+'  });'
// ---- largest pools strip ----
+'  if(strip){ loadPools().then(function(ps){ priceUsd("XLM","",function(px){'
+'    if(!ps.length){ strip.innerHTML="<div class=\\"lxadm-empty\\">No curated pools found.</div>"; return; }'
+'    strip.innerHTML=ps.map(function(p){'
+'      return "<a class=\\"top-strip-card\\" href=\\"lumoscore-pools-pool.html?pool="+esc(p.id)+"\\" style=\\"text-decoration:none;color:inherit\\">"'
+'        +"<span class=\\"top-mini-ico\\" data-lxc=\\""+esc(p.code)+"\\" style=\\"background:transparent "+cssUrl(LG[p.code+"-"+p.iss]||avatar(p.code))+" center/cover no-repeat\\"></span>"'
+'        +"<div class=\\"top-mini-meta\\"><div class=\\"top-mini-name\\">"+esc(p.code)+" / XLM</div>"'
+'        +"<div class=\\"top-mini-sub\\">Stellar mainnet</div></div>"'
+'        +"<div class=\\"top-mini-val\\">"+(px?usd(p.xlm*px):num(p.xlm)+" XLM")+"</div></a>"; }).join("");'
+'    ps.forEach(function(p){ priceUsd(p.code,p.iss,function(){ var u=LG[p.code+"-"+p.iss]; if(!u)return;'
+'      var el=strip.querySelector("[data-lxc=\\""+p.code+"\\"]"); if(el)el.style.background="transparent "+cssUrl(u)+" center/cover no-repeat"; }); });'
+'  }); }); }'
+'}'
+'function cardByTitle(txt){ var hit=null;'
+'  qa(".adm-card, .mob-card").forEach(function(c){ if(hit)return;'
+'    var t=c.querySelector(".adm-card-title")||c.querySelector(".mob-card-title");'
+'    if(t&&t.textContent.replace(/\\s+/g," ").toLowerCase().indexOf(String(txt).toLowerCase())>=0)hit=c; }); return hit; }'
+'function cardBody(c,html){ if(!c)return null; var b=c.querySelector(".adm-card-body")||c.querySelector(".mob-card-body");'
+'  if(!b){ b=document.createElement("div"); b.className="adm-card-body"; c.appendChild(b); }'
+'  b.removeAttribute("style"); b.innerHTML=html; return b; }'
+'function paintDashRow3(){ if(!isDash())return;'
// 1. the listing donut had no registry behind it; the wallets that paid fees are countable
+'  var c1=cardByTitle("Listed-On Distribution");'
+'  if(c1&&c1.getAttribute("data-lxbuilt")!=="1"){ c1.setAttribute("data-lxbuilt","1");'
+'    retitle(c1.querySelector(".adm-card-head"),"Fee-paying wallets");'
+'    var b1=cardBody(c1,"<div class=\\"lxadm-empty\\">Loading\u2026</div>");'
+'    loadRevenue().then(function(rv){ var w={};'
+'      rv.rows.forEach(function(p){ var a=assetOf(p); w[p.from]=w[p.from]||{n:0,last:p.created_at,codes:{}};'
+'        w[p.from].n++; w[p.from].codes[a.code]=1; });'
+'      var list=Object.keys(w).map(function(k){ return {addr:k,n:w[k].n,codes:Object.keys(w[k].codes)}; })'
+'        .sort(function(x,y){ return y.n-x.n; });'
+'      if(!list.length){ b1.innerHTML="<div class=\\"lxadm-empty\\">No wallet has paid a fee yet.</div>"; return; }'
+'      b1.removeAttribute("style"); b1.style.padding="0";'
+'      b1.innerHTML=list.slice(0,6).map(function(u){'
+'        return "<a class=\\"lxwal-row\\" target=\\"_blank\\" rel=\\"noopener\\" href=\\"https://stellar.expert/explorer/public/account/"+esc(u.addr)+"\\">"'
+'          +"<img class=\\"lxwal-av\\" data-lxc=\\"wallet\\" alt=\\"\\" src=\\""+avatarPart(u.addr.slice(1,3))+"\\">"'
+'          +"<div class=\\"lxwal-meta\\"><div class=\\"lxwal-addr\\">"+esc(shortG(u.addr))+"</div>"'
+'          +"<div class=\\"lxwal-sub\\">paid in "+esc(u.codes.join(", "))+"</div></div>"'
+'          +"<div class=\\"lxwal-val\\">"+u.n+" fees</div></a>"; }).join(""); }); }'
// 2. LUMOS incentive emissions are not on-chain to read; API health is, and matters more to an operator
+'  var c2=cardByTitle("LUMOS Incentives");'
+'  if(c2&&c2.getAttribute("data-lxbuilt")!=="1"){ c2.setAttribute("data-lxbuilt","1");'
+'    retitle(c2.querySelector(".adm-card-head"),"System status");'
+'    var SVC=[["Horizon (Stellar RPC)",H+"/assets?limit=1"],["stellar.expert index","https://api.stellar.expert/explorer/public/asset?search=XLM&limit=1"],["CoinGecko prices","https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd"]];'
+'    var b2=cardBody(c2,SVC.map(function(x,i){ return "<div class=\\"lxstat-row\\" id=\\"lxsvc"+i+"\\"><span class=\\"lxstat-dot\\"></span><span class=\\"lxstat-name\\">"+esc(x[0])+"</span><span class=\\"lxstat-val\\">checking\u2026</span></div>"; }).join(""));'
+'    b2.style.padding="0";'
+'    SVC.forEach(function(x,i){ var t0=Date.now();'
+'      j(x[1]).then(function(d){ var row=q("#lxsvc"+i); if(!row)return; var ms=Date.now()-t0;'
+'        row.querySelector(".lxstat-dot").className="lxstat-dot "+(d?"ok":"bad");'
+'        row.querySelector(".lxstat-val").textContent=d?(ms+"ms"):"unreachable"; }); }); }'
// 3. Retention needed sessions and there are none, so that card sat admitting it had nothing to show.
//    The audit trail goes here instead: with two people working in the panel, "who changed this and
//    when" is a question that now gets asked, and this is the first place anyone looks.
+'  var c3=cardByTitle("New & Retention")||cardByTitle("Retention")||cardByTitle("Admin activity");'
+'  if(c3&&c3.getAttribute("data-lxbuilt")!=="1"){ c3.setAttribute("data-lxbuilt","1");'
+'    retitle(c3.querySelector(".adm-card-head"),"Admin activity");'
+'    var b3=cardBody(c3,"<div class=\\"lxadm-empty\\">Loading\u2026</div>");'
+'    j("/lxapi/adminaudit?limit=8").then(function(d){'
+'      var es=(d&&d.entries)||[];'
+'      if(!es.length){ b3.innerHTML="<div class=\\"lxadm-empty\\">Nothing recorded yet. Every change made here \u2014 a listing approved, an asset curated, a refund sent, a post published \u2014 is logged with who made it and when.</div>"; return; }'
+'      b3.removeAttribute("style"); b3.style.padding="0";'
+'      b3.innerHTML=es.map(function(e){'
+'        return "<div class=\\"lxaud-row\\">"'
+'          +"<span class=\\"lxaud-dot "+esc(auditTone(e.action))+"\\"></span>"'
+'          +"<div class=\\"lxaud-meta\\"><div class=\\"lxaud-act\\">"+esc(auditLabel(e.action))'
+'            +(e.target?(" <span class=\\"lxaud-tgt\\">"+esc(auditTarget(e.target))+"</span>"):"")+"</div>"'
+'          +"<div class=\\"lxaud-who\\">"+esc(e.actor)+"</div></div>"'
+'          +"<div class=\\"lxaud-when\\">"+esc(ago(new Date(e.at).toISOString()))+"</div></div>"; }).join(""); }); }'
+'}'
// Reads as a sentence rather than a dotted key. Anything unmapped falls through to the raw action, so
// a new one added later shows up unlabelled instead of not showing up at all.
+'var AUD_LABEL={"listing.approve":"approved a listing","listing.decline":"declined a listing",'
+'"listing.refund":"refunded a listing fee","listing.reopen":"reopened a request",'
+'"asset.curate":"curated","asset.uncurate":"removed from curated","asset.edit":"edited",'
+'"asset.tick.override":"granted a tick","asset.untick":"removed a tick",'
+'"asset.meta.clear":"cleared overrides for","asset.list.replace":"reordered the curated list",'
+'"blog.publish":"published","blog.save":"saved a draft of","blog.delete":"deleted the post",'
+'"media.upload":"uploaded an image","revenue.add":"added a revenue entry",'
+'"support.reply":"replied to a support message"};'
+'function auditLabel(a){ return AUD_LABEL[a]||a; }'
// Money and removals are the entries worth spotting from across the room.
+'function auditTone(a){ if(a==="listing.refund"||a==="revenue.add")return "money";'
+'  if(a.indexOf("delete")>=0||a.indexOf("uncurate")>=0||a.indexOf("untick")>=0||a==="listing.decline")return "warn";'
+'  return "ok"; }'
// A 56-character issuer would swamp the row; the asset code is what identifies it at a glance.
+'function auditTarget(t){ t=String(t||""); var m=/^([A-Za-z0-9]{1,12})-G[A-Z2-7]{55}$/.exec(t);'
+'  if(m)return m[1]; if(/^G[A-Z2-7]{55}$/.test(t))return shortG(t); return t.length>28?(t.slice(0,27)+"\u2026"):t; }'
+'function accountOf(a){ return j(H+"/accounts/"+a); }'
+`
function paintUsers(){
  var t=((q(".admin-page-title")||{}).textContent||"").trim(); if(t.indexOf("Users")!==0)return;
  var tbl=q(".adm-table"); if(!tbl||tbl.getAttribute("data-lxbuilt")==="1")return; tbl.setAttribute("data-lxbuilt","1");
  // Columns are the question asked of this page: who trades most, how much, and what they are worth.
  var TH=["Wallet","Volume","Trades","Revenue","Fee tier","First seen","Last seen"];
  var thr=tbl.querySelector("thead tr");
  if(thr)thr.innerHTML=TH.map(function(h,i){ return "<th"+(i>0?" style='text-align:right'":"")+">"+esc(h)+"</th>"; }).join("");
  var tb=tbl.querySelector("tbody");
  if(tb)tb.innerHTML="<tr><td colspan='"+TH.length+"' class='lxadm-empty'>Loading\u2026</td></tr>";
  var seg=q(".seg-row");
  if(seg)seg.innerHTML="<button class='seg-chip active' type='button'><span class='seg-label'>All wallets</span><span class='seg-count' id='lxuAll'>\u2014</span></button>"
    +"<button class='seg-chip' type='button' data-seg='tier'><span class='seg-label'>On 0.1% fee</span><span class='seg-count' id='lxuTier'>\u2014</span></button>"
    +"<button class='seg-chip' type='button' data-seg='ext'><span class='seg-label'>External only</span><span class='seg-count' id='lxuExt'>\u2014</span></button>";
  var head=q(".admin-page-head");
  if(head&&!q(".lxadm-note")){ var nt=document.createElement("div"); nt.className="lxadm-note";
    nt.textContent="LumosCore has no sign-up, so there is no user table to read. A user here is a wallet that has paid a platform fee on-chain \u2014 the only record of someone having used the app. Everything on this page is Stellar mainnet; there is no second network to split by.";
    head.parentNode.insertBefore(nt, head.nextSibling); }
  qa(".admin-page-actions .adm-btn").forEach(function(b){ if(/invite/i.test(b.textContent)){ b.disabled=true; b.style.opacity="0.5"; b.style.cursor="not-allowed"; b.title="Needs a backend \u2014 there is nowhere to store an admin account or send an invite."; } });
  var ROWS=[], SORT=0, TIERSET=null, SEG="all";
  loadRevenue().then(function(rv){
    var w={};
    rv.rows.forEach(function(p){ var a=assetOf(p), u=w[p.from]=w[p.from]||{addr:p.from,n:0,by:{},vol:{},first:p.created_at,last:p.created_at};
      u.n++; u.by[a.code+"-"+a.iss]=(u.by[a.code+"-"+a.iss]||0)+(+p.amount||0);
      if(Date.parse(p.created_at)<Date.parse(u.first))u.first=p.created_at;
      if(Date.parse(p.created_at)>Date.parse(u.last))u.last=p.created_at; });
    ROWS=Object.keys(w).map(function(k){return w[k];});
    // The top row by volume was a LumosDAO treasury wallet -- our own testing, not a customer.
    // Labelling beats silently dropping: excluding them here would make this page disagree with the
    // dashboard and the Revenue page, which DO count that on-chain activity. The admin can filter.
    ROWS.forEach(function(u){ u.tre=!!TREASURY[u.addr]; });
    setT(q("#lxuExt"), String(ROWS.filter(function(u){return !u.tre;}).length));
    setT(q("#lxuAll"), String(ROWS.length)); fixPager(ROWS.length);
    var sub=q(".admin-page-sub"); if(sub)sub.innerHTML="Wallets that have paid a platform fee \u00b7 <span class='mono'>"+ROWS.length+"</span> total";
    if(!ROWS.length){ if(tb)tb.innerHTML="<tr><td colspan='"+TH.length+"' class='lxadm-empty'>No wallet has paid a fee yet.</td></tr>"; return; }
    sortRows(); render();
    // revenue: the fees this wallet actually paid us, priced per asset
    var codes={}; ROWS.forEach(function(u){ Object.keys(u.by).forEach(function(k){ codes[k]=1; }); });
    Object.keys(codes).forEach(function(k){ var pp=k.split("-");
      priceUsd(pp[0],pp[1]||"",function(px){ if(px==null)return;
        ROWS.forEach(function(u){ if(u.by[k]!=null){ u.usd=(u.usd||0)+u.by[k]*px; } }); sortRows(); render(); }); });
    // volume: gross swap size per wallet, from the same decoded envelopes the dashboard uses
    loadVolume().then(function(v){
      var idx={}; ROWS.forEach(function(u){ idx[u.addr]=u; });
      var vcodes={};
      v.rows.forEach(function(r){ var u=idx[r.from]; if(!u)return; var k=r.code+"-"+r.iss;
        u.vol[k]=(u.vol[k]||0)+r.gross; vcodes[k]=1; });
      Object.keys(vcodes).forEach(function(k){ var pp=k.split("-");
        priceUsd(pp[0],pp[1]||"",function(px){ if(px==null)return;
          ROWS.forEach(function(u){ if(u.vol[k]!=null){ u.volUsd=(u.volUsd||0)+u.vol[k]*px; } }); sortRows(); render(); }); });
    });
    // fee tier: membership of the >=250K LUMOS set, which is already fetched for the dashboard
    loadTier().then(function(ti){ TIERSET=ti.set||{};
      var onTier=0; ROWS.forEach(function(u){ u.tier=!!TIERSET[u.addr]; if(u.tier)onTier++; });
      setT(q("#lxuTier"), String(onTier)); render(); });
  });
  function sortRows(){ ROWS.sort(function(x,y){
    if(SORT===1)return (y.n||0)-(x.n||0);
    if(SORT===2)return (y.usd||0)-(x.usd||0);
    if(SORT===3)return Date.parse(y.last)-Date.parse(x.last);
    return (y.volUsd||0)-(x.volUsd||0); }); }
  function render(){ if(!tb)return; var qy=((q(".fs-search input")||{}).value||"").trim().toLowerCase();
    var list=ROWS.filter(function(u){ if(qy&&u.addr.toLowerCase().indexOf(qy)<0)return false; if(SEG==="ext"&&u.tre)return false; if(SEG==="tier"&&!u.tier)return false; return true; });
    if(!list.length){ tb.innerHTML="<tr><td colspan='"+TH.length+"' class='lxadm-empty'>No wallet matches that search.</td></tr>"; return; }
    tb.innerHTML=list.map(function(u){
      var paid=Object.keys(u.by).map(function(k){ return num(u.by[k])+" "+k.split("-")[0]; }).join(", ");
      // A wallet whose LUMOS balance we have not resolved yet shows a dash, not "No" -- claiming someone
      // is off the discount before the check has finished would be a wrong answer, not a pending one.
      var tier=(u.tier==null)?"\u2014":(u.tier
        ?"<span class='lxu-tier on' title='Holds at least 250,000 LUMOS, so pays the reduced 0.1% platform fee.'>0.1%</span>"
        :"<span class='lxu-tier off' title='Below 250,000 LUMOS, so pays the standard 0.2% platform fee.'>0.2%</span>");
      return "<tr class='clickable' data-w='"+esc(u.addr)+"'>"
        +"<td><div class='user-cell'><img class='lxu-av' data-lxc='wallet' alt='' src='"+avatar(u.addr.slice(1,3))+"'>"
        +"<div><div class='un mono'>"+esc(shortG(u.addr))+(u.tre?" <span class='lxu-tre' title='A LumosDAO treasury or burn wallet, not a customer. Its activity is real on-chain volume so it is counted, but it is not a trader.'>treasury</span>":"")+"</div><div class='um'>Stellar mainnet</div></div></div></td>"
        +"<td class='num-cell' style='text-align:right'>"+(u.volUsd==null?"\u2026":esc(usd(u.volUsd)))+"</td>"
        +"<td class='num-cell' style='text-align:right'>"+u.n+"</td>"
        +"<td class='num-cell' style='text-align:right' title='"+esc(paid)+"'>"+(u.usd==null?esc(paid):esc(usd(u.usd)))+"</td>"
        +"<td style='text-align:right'>"+tier+"</td>"
        +"<td style='text-align:right;color:var(--text-muted);font-size:13.5px'>"+esc(new Date(u.first).toLocaleDateString())+"</td>"
        +"<td style='text-align:right;color:var(--text-muted);font-size:13.5px'>"+esc(ago(u.last))+"</td></tr>"; }).join(""); }
  // Delegated, so the row markup carries no inline handler and the address needs no quote juggling.
  if(tb&&!tb.__lxw){ tb.__lxw=1; tb.addEventListener("click",function(e){
    var tr=e.target.closest&&e.target.closest("tr[data-w]"); if(!tr)return;
    if(window.__lxNav)window.__lxNav("lumoscore-admin-user-profile.html?w="+tr.getAttribute("data-w")); }); }
  qa(".seg-chip").forEach(function(ch){ ch.addEventListener("click",function(){ qa(".seg-chip").forEach(function(o){ o.classList.remove("active"); }); ch.classList.add("active"); SEG=ch.getAttribute("data-seg")||"all"; render(); }); });   var si=q(".fs-search input"); if(si){ si.placeholder="Search by wallet address\u2026"; si.addEventListener("input",render); }
  qa(".filter-strip .fs-select").forEach(function(sel,i){
    if(i===0){ sel.innerHTML="<option>Sort: Volume</option><option>Sort: Trades</option><option>Sort: Revenue</option><option>Sort: Last seen</option>";
      sel.addEventListener("change",function(){ SORT=sel.selectedIndex; sortRows(); render(); }); }
    else sel.remove(); });
  var more=qa(".filter-strip .adm-btn").filter(function(b){return /more/i.test(b.textContent);})[0]; if(more)more.remove();
  qa(".admin-page-actions .adm-btn").forEach(function(b){ if(!/export/i.test(b.textContent)||b.__lx)return; b.__lx=1;
    b.addEventListener("click",function(){
      var head2="wallet,volume_usd,trades,revenue_usd,fee_rate,first_seen,last_seen\\n";
      var body=ROWS.map(function(u){ return [u.addr,u.volUsd==null?"":u.volUsd.toFixed(6),u.n,u.usd==null?"":u.usd.toFixed(6),u.tier==null?"":(u.tier?"0.001":"0.002"),u.first,u.last].join(","); }).join("\\n");
      var bl=new Blob([head2+body],{type:"text/csv"}), url=URL.createObjectURL(bl);
      var el=document.createElement("a"); el.href=url; el.download="lumoscore-users.csv"; el.click();
      setTimeout(function(){URL.revokeObjectURL(url);},1000); }); });
}
`
+'var ASEED=[["LUMOS","GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S"],["USDC","GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"],["AQUA","GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA"],["yXLM","GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55"],["EURC","GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2"],["yUSDC","GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF"]];'
+'var AKEY="lumos.admin.assets";'
+'function aList(){ try{ var v=JSON.parse(localStorage.getItem(AKEY)||"null"); if(v&&v.length)return v; }catch(_){}'
+'  return ASEED.map(function(t){ return {code:t[0],iss:t[1]}; }); }'
// The list lives in KV now, not in this browser, so it is the same list for everyone and the public
// site can read it. localStorage is kept only as an instant-paint cache for the next page load.
+'var ASRV=false;'
+'function aSave(l){ try{ localStorage.setItem(AKEY,JSON.stringify(l)); }catch(_){}'
+'  if(!ASRV){ return Promise.resolve(null); }'

+'  var names=l.map(function(a){ return a.code+"-"+a.iss; });'
+'  return fetch("/lxapi/assetmeta",{method:"PUT",headers:{"content-type":"application/json"},'
+'    body:JSON.stringify({list:names})}).then(function(r){ return r.json(); })'
+'    .catch(function(){ return null; }); }'
// stellar.expert prices in USD (USDC comes back at 1.0001, not 6.26), so no XLM conversion here
+'function aInfo(code,iss,cb){ j("https://api.stellar.expert/explorer/public/asset?search="+encodeURIComponent(code+"-"+iss)+"&limit=5").then(function(d){'
+'    var rs=(d&&d._embedded&&d._embedded.records)||[];'
+'    var m=rs.filter(function(r){ return String(r.asset||"").indexOf(code+"-"+iss)===0; })[0];'
+'    if(!m){ cb(null); return; }'
+'    var ti=m.tomlInfo||m.toml_info||{}, sr=m.price7d||[];'
+'    function chg(n){ if(sr.length<n+1)return null; var a=sr[sr.length-1-n]&&sr[sr.length-1-n][1], b=sr[sr.length-1]&&sr[sr.length-1][1];'
+'      if(!a||!b)return null; return (b-a)/a*100; }'
+'    cb({code:code,iss:iss,price:+m.price||null,d1:chg(1),d7:chg(sr.length-1),'
+'      vol7d:(+m.volume7d||0)/1e7,trust:(m.trustlines&&m.trustlines[0])||0,'
+'      funded:(m.trustlines&&m.trustlines[2])||0,domain:m.domain||"",img:ti.image||"",name:ti.name||""}); }); }'
+'function pct(v){ if(v==null||!isFinite(v))return "<span style=\\"color:var(--text-muted)\\">\u2014</span>";'
+'  var c=v>=0?"ch-up":"ch-down"; return "<span class=\\""+c+"\\">"+(v>=0?"+":"")+v.toFixed(2)+"%</span>"; }'
+`
// Per-asset overrides for the public Trade-Asset page. Everything there normally comes from the
// issuer's own stellar.toml, which we cannot edit -- so when a project asks us to fix their
// description, logo or links, this is the only place that can answer. Saved values beat the toml.
function editAsset(k){
  if(q(".lxmodal"))return;
  var i=k.lastIndexOf("-"), code=k.slice(0,i);
  var m=document.createElement("div"); m.className="lxmodal";
  function row(id,label,hint,type){
    return "<label class='lxmodal-l' for='"+id+"'>"+esc(label)+(hint?(" <span style='font-weight:600;text-transform:none;letter-spacing:0;opacity:.7'>"+esc(hint)+"</span>"):"")+"</label>"
      +(type==="area"
        ? "<textarea class='lxmodal-i' id='"+id+"' rows='4'></textarea>"
        : "<input class='lxmodal-i' id='"+id+"' type='text'>");
  }
  m.innerHTML="<div class='lxmodal-box' style='max-width:560px'><h3 class='lxmodal-t'>Edit "+esc(code)+"</h3>"
    +"<p class='lxmodal-s'>What the public asset page shows. Prefilled from the issuer's own stellar.toml where we have no override of our own — change a field and ours is used instead.</p>"
    +"<p class='lxmodal-s' id='lxeSrc' style='opacity:.75'>Checking the issuer’s domain…</p>"
    +"<button class='adm-btn ghost' type='button' id='lxeVouch' style='display:none;margin:0 0 10px'></button>"
    +row("lxeName","Display name","optional")
    +row("lxeDesc","Description","shown under the asset name","area")
    +row("lxeImg","Logo","paste a URL, or upload a file")
    +"<div style='display:flex;align-items:center;gap:10px;margin:8px 0 4px'>"
    +"<input type='file' id='lxeFile' accept='image/png,image/jpeg,image/webp,image/gif,image/avif' style='display:none'>"
    +"<button class='adm-btn ghost' type='button' id='lxeUp'>Upload logo…</button>"
    +"<button class='adm-btn ghost' type='button' id='lxeCopy' style='display:none'>Save a copy here</button>"
    +"<span class='lxmodal-s' id='lxeUpMsg' style='margin:0'></span>"
    +"<img id='lxePrev' data-lxc='' alt='' style='display:none;width:28px;height:28px;border-radius:50%;object-fit:cover'></div>"
    +row("lxeSite","Website","https://…")
    +row("lxeX","X / Twitter","handle or full URL")
    +row("lxeTg","Telegram","handle or full URL")
    +"<p class='lxmodal-e' id='lxeErr'></p>"
    +"<div class='lxmodal-a'><button class='adm-btn ghost' type='button' id='lxeClear'>Clear overrides</button>"
    +"<button class='adm-btn ghost' type='button' id='lxeCancel'>Cancel</button>"
    +"<button class='adm-btn primary' type='button' id='lxeOk'>Save</button></div></div>";
  document.body.appendChild(m);
  function close(){ m.remove(); }
  m.addEventListener("click",function(e){ if(e.target===m)close(); });
  m.querySelector("#lxeCancel").addEventListener("click",close);
  var er=m.querySelector("#lxeErr");
  function val(id){ return (m.querySelector(id).value||"").trim(); }
  function same(id,key){ var x=val(id); return (x===(TOMLV[key]||"").trim())?"":x; }

  // Prefilled from the issuer's own stellar.toml wherever we hold no override, so the form opens
  // showing what the asset page actually displays today instead of six empty boxes.
  //
  // The hazard that kept it empty before is still avoided, just further along: saving a field that
  // still holds the toml's own text would freeze the issuer's live wording as our copy. So on save,
  // any field still equal to the toml value is sent EMPTY -- it keeps tracking theirs. Only what you
  // actually changed is stored as an override.
  var TOMLV={name:"",description:"",image:"",website:"",twitter:"",telegram:""};
  var prev=m.querySelector("#lxePrev");
  function showPrev(){ var u=(m.querySelector("#lxeImg").value||"").trim();
    var copy=m.querySelector("#lxeCopy"), msg=m.querySelector("#lxeUpMsg");
    // Offered only for a logo still living on someone else's host. Once it is ours there is nothing
    // left to copy, and the button would be an action with no effect.
    if(copy)copy.style.display=(u&&u.indexOf("/lxapi/media")!==0)?"":"none";
    if(!prev)return;
    if(!u){ prev.style.display="none"; return; }
    prev.style.display=""; prev.src=u;
    // A broken image with an empty alt renders as a silent glyph and says nothing about why. The
    // usual causes are all actionable -- a wrong URL, a host that is down, or a blocker in THIS
    // browser refusing the issuer's domain -- so say them rather than showing a broken square.
    prev.onerror=function(){ prev.style.display="none";
      if(msg)msg.textContent="That image would not load here. The URL may be wrong or its host unreachable — or your browser is blocking that domain. “Save a copy here” serves it from LumosCore instead.";
    };
    prev.onload=function(){ if(msg&&/would not load/.test(msg.textContent))msg.textContent=""; };
  }

  // Copies the issuer's published logo into our own media store. The server fetches only the image
  // that asset's own toml declares, so this cannot be pointed anywhere else.
  var cp=m.querySelector("#lxeCopy");
  if(cp)cp.addEventListener("click",function(){
    var msg=m.querySelector("#lxeUpMsg");
    cp.disabled=true; if(msg)msg.textContent="Copying…";
    fetch("/lxapi/media?fromToml="+encodeURIComponent(k),{method:"POST"})
      .then(function(r){ return r.json().then(function(b){ return {ok:r.ok,b:b}; }); })
      .then(function(z){ cp.disabled=false;
        if(!z.ok||!z.b||!z.b.url){ if(msg)msg.textContent=(z.b&&(z.b.error||z.b.message))||"Could not copy that image."; return; }
        m.querySelector("#lxeImg").value=z.b.url; showPrev();
        if(msg)msg.textContent="Copied ("+Math.round((z.b.size||0)/1024)+" KB) — now served from LumosCore.";
      }).catch(function(e){ cp.disabled=false; if(msg)msg.textContent=e.message; });
  });
  Promise.all([
    j("/lxapi/assetmeta?asset="+encodeURIComponent(k)),
    j("/lxapi/assetverify?asset="+encodeURIComponent(k))
  ]).then(function(z){
    var v=(z[0]&&z[0].meta)||{}, vr=z[1]||{}, t=(vr&&vr.toml)||{};
    TOMLV={name:t.name||"",description:t.description||"",image:t.image||"",
           website:t.website||"",twitter:t.twitter||"",telegram:t.telegram||""};
    function put(sel,own,tom){ m.querySelector(sel).value=(own!=null&&own!=="")?own:(tom||""); }
    put("#lxeName",v.name,TOMLV.name);
    put("#lxeDesc",v.description,TOMLV.description);
    put("#lxeImg",v.image,TOMLV.image);
    put("#lxeSite",v.website,TOMLV.website);
    put("#lxeX",v.twitter,TOMLV.twitter);
    put("#lxeTg",v.telegram,TOMLV.telegram);
    showPrev();
    var src=m.querySelector("#lxeSrc");
    // Says which of the three situations this asset is in, because "empty because they publish
    // nothing" and "empty because their domain is unreachable" call for different action from you.
    if(src){
      if(!vr.domain) src.textContent="This issuer publishes no home domain, so nothing could be prefilled. Whatever you enter here is what the asset page will show.";
      else if(!t.name&&!t.description&&!t.image) src.textContent="No usable stellar.toml at "+vr.domain+" — nothing to prefill. Whatever you enter here is what the asset page will show.";
      else src.textContent=(vr.verified?"Verified · ":"Not verified · ")+"prefilled from "+vr.domain+"’s stellar.toml. Edited fields override it.";
    }
    paintVouch(vr);
  });

  // Granting a tick the handshake could not. Offered only where it is actually needed, and the wording
  // is the point: the reader of the public site cannot tell an earned tick from a granted one, so the
  // person granting it should be told exactly what they are asserting.
  function paintVouch(vr){
    var b=m.querySelector("#lxeVouch"); if(!b)return;
    var VERx=window.__lxVER||{}; var rec=VERx[k]||null;
    var granted=rec&&rec.v&&rec.s==="manual";
    if(vr&&vr.verified&&!granted){ b.style.display="none"; return; }   // earned it; nothing to grant
    b.style.display="";
    b.textContent=granted?"Withdraw the tick":"Vouch for this asset";
    b.onclick=function(){
      if(!granted&&!confirm("Vouch for "+code+"?\\n\\nIts issuer does not vouch for it, so this tick is your word rather than a verified fact. It looks identical to an earned tick to everyone on the public site.\\n\\nOnly do this for an asset you have confirmed some other way."))return;
      b.disabled=true; b.textContent=granted?"Withdrawing…":"Vouching…";
      fetch("/lxapi/assetmeta",{method:"PUT",headers:{"content-type":"application/json"},
        body:JSON.stringify({asset:k,override:!granted})})
        .then(function(r){ return r.json().then(function(x){ return {ok:r.ok,b:x}; }); })
        .then(function(z){ b.disabled=false;
          if(!z.ok){ er.textContent=(z.b&&z.b.error)||"Could not change that."; paintVouch(vr); return; }
          if(z.b&&z.b.verified)VERx[k]=z.b.verified; else delete VERx[k];
          paintVouch(vr); if(window.__lxRefresh)window.__lxRefresh();
        }).catch(function(e){ b.disabled=false; er.textContent=e.message; });
    };
  }

  // Upload goes to our own media store and comes back as a relative /lxapi/media URL, so the same
  // record works on staging and production.
  var fi=m.querySelector("#lxeFile"), ub=m.querySelector("#lxeUp"), um=m.querySelector("#lxeUpMsg");
  if(ub&&fi){
    ub.addEventListener("click",function(){ fi.click(); });
    fi.addEventListener("change",function(){
      var f=fi.files&&fi.files[0]; if(!f)return;
      um.textContent="Uploading…";
      var fd=new FormData(); fd.append("file",f);
      fetch("/lxapi/media",{method:"POST",body:fd})
        .then(function(r){ return r.json().then(function(b){ return {ok:r.ok,b:b}; }); })
        .then(function(z){
          if(!z.ok||!z.b||!z.b.url){ um.textContent=(z.b&&(z.b.message||z.b.error))||"Upload failed."; return; }
          m.querySelector("#lxeImg").value=z.b.url; showPrev();
          um.textContent="Uploaded ("+Math.round((z.b.size||0)/1024)+" KB)";
        }).catch(function(e){ um.textContent=e.message; });
    });
  }
  var ii2=m.querySelector("#lxeImg"); if(ii2)ii2.addEventListener("input",showPrev);

  m.querySelector("#lxeOk").addEventListener("click",function(){
    var ok=m.querySelector("#lxeOk"); er.textContent=""; ok.disabled=true; ok.textContent="Saving\u2026";
    fetch("/lxapi/assetmeta",{method:"PUT",headers:{"content-type":"application/json"},
      // A field still equal to the toml is sent empty, so it goes on tracking the issuer's live text
      // rather than being frozen as our copy of today's wording.
      body:JSON.stringify({asset:k,name:same("#lxeName","name"),description:same("#lxeDesc","description"),
        image:same("#lxeImg","image"),website:same("#lxeSite","website"),
        twitter:same("#lxeX","twitter"),telegram:same("#lxeTg","telegram")})})
      .then(function(r){ return r.json().then(function(b){ return {ok:r.ok,b:b}; }); })
      .then(function(z){
        ok.disabled=false; ok.textContent="Save";
        if(!z.ok){ er.textContent=(z.b&&(z.b.error||z.b.reason))||"Could not save."; return; }
        close();
      }).catch(function(e){ ok.disabled=false; ok.textContent="Save"; er.textContent=e.message; });
  });

  m.querySelector("#lxeClear").addEventListener("click",function(){
    if(!confirm("Clear the overrides for "+code+"? The asset page will go back to showing whatever the issuer publishes."))return;
    // meta=1 keeps the asset listed and only drops our copy -- de-listing is the x button, a different
    // intention that should not happen by accident from an edit form.
    fetch("/lxapi/assetmeta?meta=1&asset="+encodeURIComponent(k),{method:"DELETE"})
      .then(function(r){ return r.json(); })
      .then(function(b){ if(b&&b.ok)close(); else er.textContent=(b&&b.error)||"Could not clear."; })
      .catch(function(e){ er.textContent=e.message; });
  });
}
`
+ `
function paintAssets(){
  var t=(q(".admin-page-title")||{}).textContent||""; if(!/^s*Assets/.test(t))return;
  var tbl=q(".adm-table"); if(!tbl||tbl.getAttribute("data-lxbuilt")==="1")return; tbl.setAttribute("data-lxbuilt","1");

  // Volume over three windows because one number cannot answer "is this moving now" and "is this worth
  // listing" at the same time.
  var TH=["Asset","Issuer domain","Price","24h","7d","Vol 24h","Vol 7d","Vol 30d","Trustlines","Actions"];
  // The listing queue answers different questions from the asset table, so it gets its own columns.
  // Set per render rather than once, because the tab can change under a table that is already built.
  var TH_REQ=["Asset","Applicant","Paid","Submitted","Status","Actions"];
  var thr=tbl.querySelector("thead tr");
  function setHead(){
    if(!thr)return;
    var want=(MODE==="requests")?TH_REQ:TH, first=(MODE==="requests")?2:1;
    var made=want.map(function(h,i){ return "<th"+(i>first?" style='text-align:right'":"")+">"+esc(h)+"</th>"; }).join("");
    if(thr.innerHTML!==made)thr.innerHTML=made;
  }
  var tb=tbl.querySelector("tbody");

  // CURATED and MINTS are different claims. Curated is what LumosCore chooses to list -- the set Trade
  // main shows. Mints are what was issued through our own launchpad: ours by definition, not a curation
  // decision. Merging them made the list look like we had hand-picked 55 assets.
  var CUR=[], MINTS=[], MODE="curated", DATA={}, VER={}, LXV=null, PXA={}, LOGO={};
  // The curated-listing queue. null while it is still being fetched, so the chip can say so instead of
  // claiming zero.
  var LR=null;
  // Requests are not assets: they have no price, no volume and nothing to look up. Returning an empty
  // list keeps every caller that walks the asset rows -- load, sort, kpis -- a harmless no-op in this
  // mode rather than a special case in each of them.
  function rows(){ return MODE==="requests"?[]:(MODE==="mints"?MINTS:CUR); }
  function key(a){ return a.code+"-"+a.iss; }
  function parse(s){ var i=s.lastIndexOf("-"); return {code:s.slice(0,i),iss:s.slice(i+1)}; }

  var head=q(".admin-page-head");
  if(head&&!q(".lxadm-note")){ var nt=document.createElement("div"); nt.className="lxadm-note";
    nt.textContent="Curated is what LumosCore lists — the same set Trade shows. Mints are the tokens issued through our launchpad. A tick means the asset’s own issuer vouches for it: its on-chain home domain publishes a stellar.toml naming this exact code and issuer. Volume is what traded on LumosCore, in USD. Adding an asset here curates it immediately; it appears on the public site at the next publish.";
    head.parentNode.insertBefore(nt, head.nextSibling); }

  function tabs(){
    var seg=q(".seg-row"); if(!seg)return;
    seg.innerHTML=
      "<button class='seg-chip"+(MODE==="curated"?" active":"")+"' type='button' data-lxtab='curated'>"
       +"<span class='seg-label'>Curated assets</span><span class='seg-count'>"+CUR.length+"</span></button>"
      +"<button class='seg-chip"+(MODE==="mints"?" active":"")+"' type='button' data-lxtab='mints'>"
       +"<span class='seg-label'>LumosCore native mints</span><span class='seg-count'>"+MINTS.length+"</span></button>"
      // The count shown is the number still WAITING, not the number ever received: a queue chip is
      // read as work outstanding, and a growing all-time total would stop meaning anything.
      +"<button class='seg-chip"+(MODE==="requests"?" active":"")+"' type='button' data-lxtab='requests'>"
       +"<span class='seg-label'>Listing requests</span><span class='seg-count'>"+(LR===null?"…":String(reqOpen().length))+"</span></button>";
    qa("[data-lxtab]").forEach(function(b){ b.addEventListener("click",function(){
      MODE=b.getAttribute("data-lxtab");
      if(MODE==="requests"&&LR===null)reqLoad();
      tabs(); render(); kpis(); rows().forEach(load); }); });
  }

  // The platform resolves logos server-side because plenty of toml hosts refuse a browser's request.
  // Doing it any other way here is how the table ended up wearing initials discs while every other
  // screen showed the real artwork.
  function logoFor(a,k){
    if(LOGO[k]===undefined){ LOGO[k]=null;
      j("/lxapi/assetlogo?asset="+encodeURIComponent(k)).then(function(d){
        var u=d&&d.image; if(u){ LOGO[k]=u; render(); } else delete LOGO[k]; }); }
    return LOGO[k]||avatar(a.code);
  }
  function tickFor(k){
    var r=VER[k]; if(!r||!r.v)return "";
    var why=(r.s==="grandfathered")?("Verified by hand when added — "+(r.why||"")):(r.why||"Verified");
    return "<span class='lx-vtick' title='"+esc(why)+"'>"+VTICK+"</span>";
  }

  function win(k,w){ var r=LXV&&LXV[k]; return (r&&r[w])||null; }
  // USD, not asset units: 4,000,001 LUMOS and 1,200 USDC are not comparable, and a table exists to be
  // compared down a column.
  function volCell(k,w){
    if(LXV===null)return "…";
    var r=win(k,w); if(!r||!r.amt)return "<span style='color:var(--text-muted)'>—</span>";
    var px=PXA[k];
    if(px==null)return "<span style='color:var(--text-muted)' title='no USD price for this asset'>—</span>";
    return "<span title='"+r.n+" trade"+(r.n===1?"":"s")+" on LumosCore'>"+esc(usd(r.amt*px))+"</span>";
  }

  function kpis(){
    if(MODE==="requests")return reqKpis();
    setNote();
    var LI=rows();
    var vals=LI.map(function(a){ return DATA[key(a)]; }).filter(function(v){ return !!v; });
    var live=0, trades=0, tot=0, unpriced=0;
    if(LXV)LI.forEach(function(a){ var k=key(a);
      var r7=win(k,"d7"); if(r7&&r7.amt>0)live++;
      if(r7)trades+=r7.n;
      if(r7&&r7.amt>0){ var px=PXA[k]; if(px!=null)tot+=r7.amt*px; else unpriced++; } });
    var cards=qa(".kpi-grid .kpi");
    function set(i,label,val,foot){ var c=cards[i]; if(!c)return;
      var l=c.querySelector(".kpi-label"); if(l)setT(l,label);
      setT(c.querySelector(".kpi-value"),val);
      var f=c.querySelector(".kpi-foot"); if(f){ f.innerHTML=""; f.textContent=foot; } }
    set(0,(MODE==="mints"?"Native mints":"Curated assets"),String(LI.length),(MODE==="mints"?"issued on LumosCore":"listed on LumosCore"));
    set(1,"Traded on LumosCore",LXV?String(live):"…","in the last 7 days");
    set(2,"Trades on the platform",LXV?String(trades):"…","swaps in the last 7 days");
    set(3,"LumosCore 7d volume",LXV?usd(tot):"…",unpriced?(unpriced+" asset"+(unpriced===1?"":"s")+" not priced"):"traded on our platform");
    fixPager(LI.length);
    var sub=q(".admin-page-sub"); if(sub)sub.textContent=(MODE==="mints"?"Tokens issued through the LumosCore launchpad":"Assets you list on LumosCore");
  }

  // ---- the curated-listing queue --------------------------------------------------------------------
  // Applications from /list-your-token. Each one arrives already paid for -- the public endpoint
  // verifies the payment on-chain before it will store anything -- so what happens here is only the
  // decision and, on a decline, sending the money back.
  //
  // Approving is done by the SAME PUT /lxapi/assetmeta the Add-asset button uses. Nothing about
  // curation is reimplemented here; the server then refuses to mark a request approved until it can
  // see the asset on the curated list, so a half-finished approval stays visibly pending.
  var REQ_ST={
    pending:{t:"Awaiting review",c:"var(--text)"},
    approved:{t:"Approved",c:"#1fa968"},
    rejected:{t:"Declined, refund owed",c:"#e0553c"},
    refunded:{t:"Declined and refunded",c:"var(--text-muted)"}
  };
  function reqOpen(){ return (LR||[]).filter(function(r){ return r.status==="pending"||r.status==="rejected"; }); }

  // A handle can arrive as "@name", "name" or a full URL -- the applicant types what they think of, and
  // listing.js stores it as typed to match what assetmeta does. Turning it into something clickable is
  // therefore this function's job, and it is the only place that guesses.
  function reqHref(kind,v){
    v=String(v||"").trim(); if(!v)return "";
    if(/^https?:/i.test(v))return v;
    var h=v.replace(/^@/,"");
    if(kind==="twitter")return "https://x.com/"+encodeURIComponent(h);
    if(kind==="telegram")return "https://t.me/"+encodeURIComponent(h);
    return "https://"+v;                    // website or a discord invite typed bare
  }
  function reqLinks(r){
    var out=[];
    [["website",r.website,"Website"],["twitter",r.twitter,"X"],
     ["telegram",r.telegram,"Telegram"],["discord",r.discord,"Discord"]].forEach(function(p){
      if(!p[1])return;
      out.push("<a class='lxreq-link' target='_blank' rel='noopener' title='"+esc(p[1])+"' href='"+esc(reqHref(p[0],p[1]))+"'>"+esc(p[2])+"</a>");
    });
    // Said out loud rather than left blank. "No links given" is itself a review finding -- the bar is
    // whether a project is findable outside our site -- and an empty space does not say that.
    if(!out.length)return "<div class='lxreq-links lxreq-nolinks'>No links given</div>";
    return "<div class='lxreq-links'>"+out.join("")+"</div>";
  }
  function reqLoad(){
    return j("/lxapi/listingadmin").then(function(d){
      LR=(d&&d.requests)||[];
      tabs(); if(MODE==="requests"){ render(); kpis(); }
      return LR;
    }).catch(function(){ LR=[]; tabs(); if(MODE==="requests"){ render(); kpis(); } return LR; });
  }
  function reqAmt(r){ return (+r.payAmount||0).toLocaleString(undefined,{maximumFractionDigits:2})+" XLM"; }
  function reqWhen(t){ if(!t)return "—"; var d=new Date(+t);
    return d.toLocaleDateString(undefined,{day:"numeric",month:"short"})+", "+d.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"}); }

  // The explanatory note above the table belongs to the tab, not to the page. Captured on first use so
  // switching back restores exactly the text the assets tabs shipped with.
  var NOTE0=null;
  var NOTE_REQ="Applications from the public List your token page. Each one is already paid for — the "
    + "payment is verified against the ledger before a request is stored, so nothing here arrived free. "
    + "Approving curates the asset immediately, which also gives it the tick; it reaches the public site "
    + "at the next publish. Declining does not send the money back: the row then shows a refund owed, "
    + "and Refund pays it from the wallet connected here, to the account that actually paid.";
  function setNote(){
    var n=q(".lxadm-note"); if(!n)return;
    if(NOTE0===null)NOTE0=n.textContent;
    setT(n, MODE==="requests"?NOTE_REQ:NOTE0);
  }

  function reqKpis(){
    setNote();
    var L=LR||[], pend=0, owed=0, owedN=0, done=0;
    L.forEach(function(r){
      if(r.status==="pending")pend++;
      if(r.status==="rejected"){ owed+=(+r.payAmount||0); owedN++; }
      if(r.status==="approved")done++;
    });
    var cards=qa(".kpi-grid .kpi");
    function set(i,label,val,foot){ var c=cards[i]; if(!c)return;
      var l=c.querySelector(".kpi-label"); if(l)setT(l,label);
      setT(c.querySelector(".kpi-value"),val);
      var f=c.querySelector(".kpi-foot"); if(f){ f.innerHTML=""; f.textContent=foot; } }
    set(0,"Awaiting review",LR===null?"…":String(pend),"paid and queued");
    set(1,"Approved",LR===null?"…":String(done),"now curated");
    // Money we are holding that is not ours. It reads as a debt on purpose.
    set(2,"Refunds owed",LR===null?"…":String(owedN),"declined, not yet paid back");
    set(3,"Owed back",LR===null?"…":(owed?owed.toLocaleString(undefined,{maximumFractionDigits:2})+" XLM":"none"),"to the accounts that paid");
    fixPager((LR||[]).length);
    var sub=q(".admin-page-sub"); if(sub)sub.textContent="Paid applications for a curated listing";
  }

  function reqRender(){
    if(LR===null){ tb.innerHTML="<tr><td colspan='6' class='lxadm-empty'>Loading the queue…</td></tr>"; return; }
    var qy=((q(".fs-search input")||{}).value||"").trim().toLowerCase();
    var L=LR.filter(function(r){ return !qy || (r.code+" "+r.issuer+" "+r.payer+" "+r.descr).toLowerCase().indexOf(qy)>=0; });
    if(!L.length){ tb.innerHTML="<tr><td colspan='6' class='lxadm-empty'>"
      +(LR.length?"No request matches that search.":"No listing requests yet. They arrive from the public List your token page.")+"</td></tr>"; return; }
    tb.innerHTML=L.map(function(r){
      var st=REQ_ST[r.status]||{t:r.status,c:"var(--text-muted)"};
      var act="";
      if(r.status==="pending"){
        act="<button class='lxreq-btn go' type='button' title='Curate this asset and approve the request' data-lxap='"+esc(r.id)+"'>Approve</button>"
           +"<button class='lxreq-btn' type='button' title='Decline with a reason' data-lxrj='"+esc(r.id)+"'>Decline</button>";
      } else if(r.status==="rejected"){
        act="<button class='lxreq-btn go' type='button' title='Send "+esc(reqAmt(r))+" back to the account that paid' data-lxrf='"+esc(r.id)+"'>Refund</button>"
           +"<button class='lxreq-btn' type='button' title='Record a refund you sent from elsewhere' data-lxrh='"+esc(r.id)+"'>Have the hash</button>"
           +"<button class='lxreq-btn' type='button' title='Put this back in the queue' data-lxro='"+esc(r.id)+"'>Reopen</button>";
      } else if(r.status==="approved"){
        act="<button class='lxreq-btn' type='button' title='Put this back in the queue' data-lxro='"+esc(r.id)+"'>Reopen</button>";
      } else {
        act="<a class='ext-link' title='The refund transaction' target='_blank' rel='noopener' href='https://stellar.expert/explorer/public/tx/"+esc(r.refundHash)+"'>"+EXTICON+"</a>";
      }
      var img=r.logo?("<img class='lxa-ico' data-lxc='"+esc(r.code)+"' alt='' src='"+esc(r.logo)+"'>")
                    :("<img class='lxa-ico' data-lxc='"+esc(r.code)+"' alt='' src='"+esc(avatar(r.code))+"'>");
      return "<tr>"
        +"<td><div class='asset-cell'>"+img
          +"<div><div class='asset-name'>"+esc(r.code)+(r.curated?tickFor(r.asset):"")+"</div>"
          // Truncated with a copy button rather than printed in full: 56 characters would dominate the
          // row, and what you actually do with an issuer is paste it somewhere.
          +"<div class='asset-sub mono'>"+esc(shortG(r.issuer))
            +"<button class='lxreq-copy' type='button' title='Copy the issuing account' data-lxcp='"+esc(r.issuer)+"'>"+COPYICON+"</button>"
            +"<a class='ext-link' title='The issuing account on stellar.expert' target='_blank' rel='noopener' href='https://stellar.expert/explorer/public/account/"+esc(r.issuer)+"'>"+EXTICON+"</a>"
          +"</div>"
          // The WHOLE description, not the first 120 characters. This is the review screen; deciding
          // whether a project describes itself honestly cannot be done from an ellipsis.
          +"<div class='lxreq-note' style='min-width:260px;max-width:360px'>"+esc(r.descr)+"</div>"
          +reqLinks(r)
        +"</div></div></td>"
        +"<td><span class='mono' title='"+esc(r.payer)+"'>"+esc(shortG(r.payer))+"</span>"
          +" <a class='ext-link' title='The payment' target='_blank' rel='noopener' href='https://stellar.expert/explorer/public/tx/"+esc(r.txHash)+"'>"+EXTICON+"</a></td>"
        +"<td class='num-cell' style='text-align:right'>"+esc(reqAmt(r))+"</td>"
        +"<td style='text-align:right'>"+esc(reqWhen(r.createdAt))+"</td>"
        +"<td style='text-align:right'><span style='color:"+st.c+";font-weight:600'>"+esc(st.t)+"</span>"
          +(r.note?("<div class='lxreq-note' style='max-width:240px;margin-left:auto'>"+esc(r.note)+"</div>"):"")+"</td>"
        +"<td style='text-align:right'><span class='row-act'>"+act+"</span></td>"
      +"</tr>";
    }).join("");
    qa("[data-lxap]").forEach(function(b){ if(b.__lx)return; b.__lx=1;
      b.addEventListener("click",function(){ reqApprove(b.getAttribute("data-lxap"),b); }); });
    qa("[data-lxrj]").forEach(function(b){ if(b.__lx)return; b.__lx=1;
      b.addEventListener("click",function(){ reqReject(b.getAttribute("data-lxrj")); }); });
    qa("[data-lxrf]").forEach(function(b){ if(b.__lx)return; b.__lx=1;
      b.addEventListener("click",function(){ reqRefund(b.getAttribute("data-lxrf"),b); }); });
    qa("[data-lxrh]").forEach(function(b){ if(b.__lx)return; b.__lx=1;
      b.addEventListener("click",function(){ reqRefundHash(b.getAttribute("data-lxrh")); }); });
    qa("[data-lxro]").forEach(function(b){ if(b.__lx)return; b.__lx=1;
      b.addEventListener("click",function(){ reqAct(b.getAttribute("data-lxro"),{action:"reopen"}); }); });
    qa("[data-lxcp]").forEach(function(b){ if(b.__lx)return; b.__lx=1;
      b.addEventListener("click",function(e){ e.stopPropagation();
        var v=b.getAttribute("data-lxcp"), done=function(){ b.classList.add("ok");
          setTimeout(function(){ b.classList.remove("ok"); },1400); };
        // execCommand is the fallback, not the fashion: navigator.clipboard needs a secure context and
        // a permission that a panel opened from a hash URL does not always have.
        if(navigator.clipboard&&navigator.clipboard.writeText){
          navigator.clipboard.writeText(v).then(done,function(){ legacyCopy(v); done(); });
        } else { legacyCopy(v); done(); } }); });
  }
  function legacyCopy(v){
    try{ var t=document.createElement("textarea"); t.value=v;
      t.style.cssText="position:fixed;left:-9999px;top:0"; document.body.appendChild(t);
      t.select(); document.execCommand("copy"); t.remove(); }catch(_){}
  }

  function reqById(id){ return (LR||[]).filter(function(r){ return r.id===id; })[0]; }

  // Every decision goes through here, so the queue is re-read from the server afterwards rather than
  // patched locally: the row on screen then reflects what was actually stored.
  function reqAct(id,body){
    body.id=id;
    return fetch("/lxapi/listingadmin",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)})
      .then(function(r){ return r.json().then(function(d){ return {ok:r.ok,d:d}; }); })
      .then(function(z){ if(!z.ok||!z.d.ok)throw new Error((z.d&&z.d.error)||"That did not save."); return reqLoad().then(function(){ return z.d; }); });
  }

  function reqApprove(id,btn){
    var r=reqById(id); if(!r)return;
    if(!confirm("Approve "+r.code+"? It is curated immediately, carries the tick, and appears on the public site at the next publish."))return;
    btn.disabled=true; btn.textContent="Curating…";
    // Description and logo travel with the approval, so the asset arrives on the public site wearing
    // what the applicant sent rather than an empty record someone has to fill in later.
    var body={asset:r.asset};
    if(r.descr)body.description=r.descr;
    if(r.logo)body.image=r.logo;
    // The links travel with the approval too, so an approved asset lands on the public site already
    // wearing them rather than waiting for someone to retype what the applicant already gave us.
    if(r.website)body.website=r.website;
    if(r.twitter)body.twitter=r.twitter;
    if(r.telegram)body.telegram=r.telegram;
    if(r.discord)body.discord=r.discord;
    fetch("/lxapi/assetmeta",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(body)})
      .then(function(rr){ return rr.json().then(function(bb){ return {ok:rr.ok,b:bb}; }); })
      .then(function(z){
        if(!z.ok)throw new Error((z.b&&(z.b.error||z.b.message))||"Could not curate that asset.");
        if(z.b&&z.b.verified)VER[r.asset]=z.b.verified;
        if(!CUR.some(function(a){ return a.code===r.code&&a.iss===r.issuer; })){
          CUR.push({code:r.code,iss:r.issuer});
          try{ localStorage.setItem(AKEY,JSON.stringify(CUR)); }catch(_){}
        }
        btn.textContent="Recording…";
        return reqAct(id,{action:"approve"});
      })
      .then(function(){ alert(r.code+" is curated and the request is approved. It reaches the public site at the next publish (node _tools/_syncverified.js, then deploy)."); })
      .catch(function(e){ btn.disabled=false; btn.textContent="Approve"; alert(e.message); });
  }

  function reqReject(id){
    var r=reqById(id); if(!r||q(".lxmodal"))return;
    var m=document.createElement("div"); m.className="lxmodal";
    m.innerHTML="<div class='lxmodal-box'><h3 class='lxmodal-t'>Decline "+esc(r.code)+"</h3>"
      +"<p class='lxmodal-s'>The reason is what the applicant is told, so write it for them. Declining does not send the money back — the row then shows a refund owed, and the Refund button pays it from your connected wallet.</p>"
      +"<label class='lxmodal-l' for='lxrjWhy'>Reason</label>"
      +"<textarea class='lxmodal-i' id='lxrjWhy' rows='3' maxlength='300' placeholder='No home domain set, so the handshake cannot resolve.'></textarea>"
      +"<p class='lxmodal-e' id='lxrjErr'></p>"
      +"<div class='lxmodal-a'><button class='adm-btn ghost' type='button' id='lxrjCancel'>Cancel</button>"
      +"<button class='adm-btn primary' type='button' id='lxrjOk'>Decline</button></div></div>";
    document.body.appendChild(m);
    var ta=m.querySelector("#lxrjWhy"), er=m.querySelector("#lxrjErr"), ok=m.querySelector("#lxrjOk");
    ta.focus();
    function close(){ m.remove(); }
    m.addEventListener("click",function(e){ if(e.target===m)close(); });
    m.querySelector("#lxrjCancel").addEventListener("click",close);
    ok.addEventListener("click",function(){
      var why=(ta.value||"").trim();
      if(why.length<8){ er.textContent="Give a real reason — they are told it verbatim."; return; }
      ok.disabled=true; ok.textContent="Saving…";
      reqAct(id,{action:"reject",note:why}).then(close)
        .catch(function(e){ ok.disabled=false; ok.textContent="Decline"; er.textContent=e.message; });
    });
  }

  // The refund is a payment from whichever wallet is connected here, back to the account that paid,
  // for the exact amount it paid. The address comes from the stored PAYMENT, never from anything the
  // applicant typed, so a decline can never be steered to a stranger.
  function reqRefund(id,btn){
    var r=reqById(id); if(!r)return;
    var addr=""; try{ addr=localStorage.getItem("lumos.address")||""; }catch(_){}
    if(addr.charAt(0)!=="G"){
      if(window.lxwOpenWallet){ window.lxwOpenWallet("stellar"); alert("Connect the wallet you want to refund from, then press Refund again."); }
      else alert("Connect a Stellar wallet first.");
      return;
    }
    if(!confirm("Send "+reqAmt(r)+" back to "+shortG(r.payer)+" from "+shortG(addr)+"?"))return;
    btn.disabled=true; btn.textContent="Building…";
    var PASS="Public Global Stellar Network ; September 2015", S;
    lxLpSdk().then(function(sdk){
      S=sdk;
      return fetch(H+"/accounts/"+addr).then(function(x){ if(!x.ok)throw new Error("Could not read your account."); return x.json(); });
    }).then(function(acct){
      var tb2=new S.TransactionBuilder(new S.Account(addr,acct.sequence),{fee:"3000",networkPassphrase:PASS})
        .addOperation(S.Operation.payment({destination:r.payer,asset:S.Asset.native(),amount:String(r.payAmount)}))
        .addMemo(S.Memo.text("LumosCore refund"))
        .setTimeout(180).build();
      btn.textContent="Sign…";
      return lxLpSignXdr(tb2.toXDR(),addr);
    }).then(function(signed){
      btn.textContent="Sending…";
      return fetch(H+"/transactions",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"tx="+encodeURIComponent(signed)})
        .then(function(x){ return x.json(); });
    }).then(function(res){
      if(!res.successful){
        var rc=res.extras&&res.extras.result_codes;
        throw new Error("The refund did not go through: "+(rc?JSON.stringify(rc):(res.detail||"unknown error")));
      }
      btn.textContent="Recording…";
      // Checked against the ledger server-side before the row closes, so a refund we did not make
      // cannot mark one as paid.
      return reqAct(id,{action:"refund",refundHash:res.hash});
    }).catch(function(e){
      btn.disabled=false; btn.textContent="Refund";
      alert(e.message+"— if the payment DID leave your wallet, use Have the hash to record it.");
    });
  }

  // The escape hatch for a refund sent from a phone, a hardware wallet or anywhere else. Still verified
  // on-chain before it is accepted.
  function reqRefundHash(id){
    var r=reqById(id); if(!r||q(".lxmodal"))return;
    var m=document.createElement("div"); m.className="lxmodal";
    m.innerHTML="<div class='lxmodal-box'><h3 class='lxmodal-t'>Record a refund</h3>"
      +"<p class='lxmodal-s'>For a refund sent from somewhere else. We check the ledger: it has to be an XLM payment to "+esc(shortG(r.payer))+" of at least "+esc(reqAmt(r))+", or it is not accepted.</p>"
      +"<label class='lxmodal-l' for='lxrhTx'>Transaction hash</label><input class='lxmodal-i' id='lxrhTx' placeholder='64 hex characters' maxlength='64'>"
      +"<p class='lxmodal-e' id='lxrhErr'></p>"
      +"<div class='lxmodal-a'><button class='adm-btn ghost' type='button' id='lxrhCancel'>Cancel</button>"
      +"<button class='adm-btn primary' type='button' id='lxrhOk'>Check and record</button></div></div>";
    document.body.appendChild(m);
    var inp=m.querySelector("#lxrhTx"), er=m.querySelector("#lxrhErr"), ok=m.querySelector("#lxrhOk");
    inp.focus();
    function close(){ m.remove(); }
    m.addEventListener("click",function(e){ if(e.target===m)close(); });
    m.querySelector("#lxrhCancel").addEventListener("click",close);
    ok.addEventListener("click",function(){
      var h=(inp.value||"").trim().toLowerCase();
      if(!/^[0-9a-f]{64}$/.test(h)){ er.textContent="That is not a transaction hash."; return; }
      ok.disabled=true; ok.textContent="Checking…";
      reqAct(id,{action:"refund",refundHash:h}).then(close)
        .catch(function(e){ ok.disabled=false; ok.textContent="Check and record"; er.textContent=e.message; });
    });
  }

  function render(){ if(!tb)return;
    setHead();
    if(MODE==="requests")return reqRender();
    var qy=((q(".fs-search input")||{}).value||"").trim().toLowerCase();
    var LI=rows().filter(function(a){ return !qy || (a.code+" "+a.iss+" "+((DATA[key(a)]||{}).domain||"")).toLowerCase().indexOf(qy)>=0; });
    if(!LI.length){ tb.innerHTML="<tr><td colspan='"+TH.length+"' class='lxadm-empty'>"+(rows().length?"No asset matches that search.":"Nothing here yet.")+"</td></tr>"; return; }
    tb.innerHTML=LI.map(function(a){ var k=key(a), v=DATA[k];
      // undefined means still looking; null means the lookup came back with nothing. Both used to
      // render an ellipsis, so a failed lookup sat there pretending to still be loading forever.
      var pend=(v===undefined), gone=(v===null);
      function cell(x){ return pend?"…":(gone?"<span style='color:var(--text-muted)'>—</span>":x); }
      return "<tr>"
        +"<td><div class='asset-cell'><img class='lxa-ico' data-lxc='"+esc(a.code)+"' alt='' src='"+esc(logoFor(a,k))+"'>"
        +"<div><div class='asset-name'>"+esc(a.code)+tickFor(k)+((v&&v.name&&v.name!==a.code)?" <span style='font-weight:500;color:var(--text-muted);font-size:13.5px'>"+esc(v.name)+"</span>":"")+"</div>"
        +"<div class='asset-sub mono'>"+esc(shortG(a.iss))+"</div></div></div></td>"
        +"<td>"+cell(v&&v.domain?("<a class='lxadm-link' target='_blank' rel='noopener' href='https://"+esc(v.domain)+"'>"+esc(v.domain)+"</a>"):"<span style='color:var(--text-muted)'>no home domain</span>")+"</td>"
        +"<td class='num-cell' style='text-align:right'>"+cell(v&&v.price?esc(usd(v.price)):"<span style='color:var(--text-muted)'>—</span>")+"</td>"
        +"<td style='text-align:right'>"+cell(pct(v&&v.d1))+"</td>"
        +"<td style='text-align:right'>"+cell(pct(v&&v.d7))+"</td>"
        +"<td class='num-cell' style='text-align:right'>"+volCell(k,"d1")+"</td>"
        +"<td class='num-cell' style='text-align:right'>"+volCell(k,"d7")+"</td>"
        +"<td class='num-cell' style='text-align:right'>"+volCell(k,"d30")+"</td>"
        +"<td class='num-cell' style='text-align:right'>"+cell(v?esc(num(v.trust)):"")+"</td>"
        +"<td style='text-align:right'><span class='row-act'>"
        +"<a class='ext-link' title='Open asset page' href='lumoscore-dex-asset.html?asset="+esc(k)+"'>"+EXTICON+"</a>"
        +"<button class='row-act-btn' type='button' title='Edit description, logo and links' data-lxed='"+esc(k)+"'>✎</button>"
        // A mint is a record of what was issued, not a curation choice, and there is nowhere to
        // persist its removal -- it would simply reappear on the next load. So the tab does not
        // offer a button that cannot keep its promise.
        +(MODE==="mints"?"":("<button class='row-act-btn' type='button' title='Remove from the curated list' data-lxrm='"+esc(k)+"'>×</button>"))
        +"</span></td></tr>"; }).join("");
    qa("[data-lxrm]").forEach(function(b){ if(b.__lx)return; b.__lx=1;
      b.addEventListener("click",function(){ var k=b.getAttribute("data-lxrm");
        if(!confirm("Remove "+k.split("-")[0]+" from the "+(MODE==="mints"?"mints":"curated")+" list?\\n\\nIt stops being listed on LumosCore. Its description, logo and links are kept, so re-adding it restores them."))return;
        if(MODE==="mints")MINTS=MINTS.filter(function(a){ return key(a)!==k; });
        else { CUR=CUR.filter(function(a){ return key(a)!==k; }); aSave(CUR); }
        tabs(); render(); kpis(); }); });
    qa("[data-lxed]").forEach(function(b){ if(b.__lx)return; b.__lx=1;
      b.addEventListener("click",function(){ editAsset(b.getAttribute("data-lxed")); }); }); }

  function load(a){ var k=key(a); if(DATA[k]!==undefined)return;
    aInfo(a.code,a.iss,function(v){ DATA[k]=v; render(); kpis(); }); }

  // Our own trades, over three windows, from the ledger the Revenue page already reconstructs.
  function loadLxVol(){ return loadVolume().then(function(V){
    var now=Date.now(), D=86400000, m={};
    (V&&V.rows||[]).forEach(function(r){ if(!r.code||!r.gross)return;
      var k=r.code+"-"+r.iss, age=now-r.t;
      m[k]=m[k]||{d1:{amt:0,n:0},d7:{amt:0,n:0},d30:{amt:0,n:0}};
      if(age<=D){ m[k].d1.amt+=r.gross; m[k].d1.n++; }
      if(age<=7*D){ m[k].d7.amt+=r.gross; m[k].d7.n++; }
      if(age<=30*D){ m[k].d30.amt+=r.gross; m[k].d30.n++; } });
    LXV=m; render(); kpis();
    Object.keys(m).forEach(function(k){ var a=parse(k);
      priceUsd(a.code,a.iss,function(px){ PXA[k]=(px==null?null:px); render(); kpis(); }); });
    return m; }).catch(function(){ LXV={}; render(); kpis(); return LXV; }); }

  var PAINTED=false;
  function first(){ if(PAINTED)return; PAINTED=true; tabs(); render(); kpis(); rows().forEach(load); }
  setTimeout(function(){ first(); },2500);

  j("/lxapi/assetmeta").then(function(d){
    VER=(d&&d.verified)||{};
    var names=(d&&d.list)||[];
    if(names.length){ CUR=names.map(parse); ASRV=true; try{ localStorage.setItem(AKEY,JSON.stringify(CUR)); }catch(_){} }
    else { CUR=aList(); ASRV=false; }
    MINTS=((d&&d.mints)||[]).map(parse);
    PAINTED=true; tabs(); render(); kpis(); rows().forEach(load);
    window.__lxVER=VER; window.__lxRefresh=function(){ try{ render(); kpis(); }catch(_){} };
    loadLxVol();
  }).catch(function(){ CUR=aList(); first(); });

  // Fetched on load rather than on the first click, so the chip carries a real waiting count from the
  // moment the page settles -- an unreviewed application is the one thing here nobody should have to
  // go looking for.
  reqLoad();

  var si=q(".fs-search input"); if(si){ si.placeholder="Search by code, issuer or domain…"; si.addEventListener("input",render); }
  qa(".filter-strip .fs-select").forEach(function(sel,i){
    if(i===0){ sel.innerHTML="<option>Sort: LumosCore volume</option><option>Sort: Trustlines</option><option>Sort: Code</option>";
      sel.addEventListener("change",function(){ var mm=sel.selectedIndex; var LI=rows();
        LI.sort(function(x,y){ var a=DATA[key(x)]||{}, b=DATA[key(y)]||{};
          if(mm===1)return (b.trust||0)-(a.trust||0);
          if(mm===2)return x.code.localeCompare(y.code);
          var xa=(win(key(x),"d7")||{}).amt||0, xb=(win(key(y),"d7")||{}).amt||0;
          return xb-xa; });
        if(MODE==="curated")aSave(CUR); render(); }); }
    else sel.remove(); });
  var more=qa(".filter-strip .adm-btn").filter(function(b){return /more/i.test(b.textContent);})[0]; if(more)more.remove();

  qa(".admin-page-actions .adm-btn").forEach(function(b){
    if(/export/i.test(b.textContent)&&!b.__lx){ b.__lx=1; b.addEventListener("click",function(){
      var hd="list,code,issuer,domain,price_usd,change_24h,change_7d,vol_24h_usd,vol_7d_usd,vol_30d_usd,trades_7d,verified,trustlines\\n";
      var bd=rows().map(function(a){ var k=key(a), v=DATA[k]||{}, vr=VER[k]||null, px=PXA[k];
        function u(w){ var r=win(k,w); return (r&&r.amt&&px!=null)?Math.round(r.amt*px*100)/100:0; }
        var r7=win(k,"d7");
        return [MODE,a.code,a.iss,v.domain||"",v.price||"",v.d1==null?"":v.d1.toFixed(4),v.d7==null?"":v.d7.toFixed(4),
          u("d1"),u("d7"),u("d30"),r7?r7.n:0,(vr&&vr.v)?vr.s:"no",v.trust||""].join(","); }).join("\\n");
      var bl=new Blob([hd+bd],{type:"text/csv"}), uu=URL.createObjectURL(bl);
      var el=document.createElement("a"); el.href=uu; el.download="lumoscore-"+MODE+".csv"; el.click();
      setTimeout(function(){URL.revokeObjectURL(uu);},1000); }); }
    if(!/add asset/i.test(b.textContent)||b.__lxa)return; b.__lxa=1;
    b.addEventListener("click",function(){
      if(q(".lxmodal"))return;
      var m=document.createElement("div"); m.className="lxmodal";
      m.innerHTML="<div class='lxmodal-box'><h3 class='lxmodal-t'>Add asset</h3>"
        +"<p class='lxmodal-s'>A ticker is not an identity on Stellar — hundreds of assets share the code USDC, so give the issuer too. We check the asset exists, then ask its issuer’s own domain to vouch for it. Logo, description and links come next, prefilled from whatever it publishes.</p>"
        +"<label class='lxmodal-l' for='lxaCode'>Asset code</label><input class='lxmodal-i' id='lxaCode' placeholder='USDC' maxlength='12'>"
        +"<label class='lxmodal-l' for='lxaIss'>Issuer account</label><input class='lxmodal-i' id='lxaIss' placeholder='G…' maxlength='56'>"
        +"<p class='lxmodal-e' id='lxaErr'></p>"
        +"<div class='lxmodal-a'><button class='adm-btn ghost' type='button' id='lxaCancel'>Cancel</button>"
        +"<button class='adm-btn primary' type='button' id='lxaOk'>Verify &amp; add</button></div></div>";
      document.body.appendChild(m);
      var ci=m.querySelector("#lxaCode"), ii=m.querySelector("#lxaIss"), er=m.querySelector("#lxaErr");
      ci.focus();
      function close(){ m.remove(); }
      m.addEventListener("click",function(e){ if(e.target===m)close(); });
      m.querySelector("#lxaCancel").addEventListener("click",close);
      m.querySelector("#lxaOk").addEventListener("click",function(){
        var code=(ci.value||"").trim(), iss=(ii.value||"").trim().toUpperCase();
        if(!/^[A-Za-z0-9]{1,12}$/.test(code)){ er.textContent="Asset code must be 1–12 letters or digits."; return; }
        if(!/^G[A-Z2-7]{55}$/.test(iss)){ er.textContent="Issuer must be a 56-character Stellar account starting with G."; return; }
        if(CUR.some(function(a){ return a.code===code&&a.iss===iss; })){ er.textContent="That asset is already curated."; return; }
        var ok=m.querySelector("#lxaOk"); ok.disabled=true; ok.textContent="Checking…";
        j(H+"/assets?asset_code="+encodeURIComponent(code)+"&asset_issuer="+encodeURIComponent(iss)+"&limit=1").then(function(d){
          var r=d&&d._embedded&&d._embedded.records&&d._embedded.records[0];
          if(!r){ ok.disabled=false; ok.textContent="Verify & add"; er.textContent="No such asset on Stellar mainnet. Check the code and issuer."; return; }
          var kk=code+"-"+iss;
          ok.textContent="Verifying…";
          // The single-asset route, deliberately: the whole-list save runs no handshake, so an asset
          // added that way would sit there permanently unverified.
          fetch("/lxapi/assetmeta",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({asset:kk})})
            .then(function(rr){ return rr.json().then(function(bb){ return {ok:rr.ok,b:bb}; }); })
            .then(function(z){ ok.disabled=false; ok.textContent="Verify & add";
              if(!z.ok){ er.textContent=(z.b&&(z.b.error||z.b.message))||"Could not add."; return; }
              if(z.b&&z.b.verified)VER[kk]=z.b.verified;
              CUR.push({code:code,iss:iss}); DATA[kk]=undefined;
              try{ localStorage.setItem(AKEY,JSON.stringify(CUR)); }catch(_){}
              MODE="curated"; close(); tabs(); render(); kpis(); load({code:code,iss:iss});
              editAsset(kk);
              // Says where it is and is not yet. The curated list lives in KV and the public site is
              // BUILT from it, so an asset is live here the moment it is added and live on Trade only
              // after the next publish. Leaving that unsaid is why an asset was reported missing from
              // Trade twice -- it was curated correctly both times and simply had not been published.
              setTimeout(function(){ var s=document.querySelector("#lxeSrc");
                if(s)s.textContent="Curated and verified. It shows on the public site after the next publish (node _tools/_syncverified.js, then deploy). "+s.textContent; },900); })
            .catch(function(e){ ok.disabled=false; ok.textContent="Verify & add"; er.textContent=e.message; });
        }); }); }); });
}
`
+'function mobNote(txt){ var head=pageHead(); if(!head||q(".lxadm-note"))return;'
+'  var d=document.createElement("div"); d.className="lxadm-note"; d.textContent=txt;'
+'  head.parentNode.insertBefore(d, head.nextSibling); }'
+'function mobKpis(defs){ var g=q(".mob-kpi-grid"); if(!g)return;'
+'  g.innerHTML=defs.map(function(d){ return "<div class=\\"mob-kpi\\"><div class=\\"mob-kpi-head\\"><span class=\\"mob-kpi-label\\">"+esc(d[1])+"</span></div>"'
+'    +"<div class=\\"mob-kpi-value\\" id=\\""+d[0]+"\\">\u2014</div><div class=\\"mob-kpi-foot\\" id=\\""+d[0]+"F\\">"+esc(d[2])+"</div></div>"; }).join(""); }'
+'function paintMobile(){ if(!isMob())return; var t=pageTitle();'
+'  if(/^Dashboard/.test(t)){'
+'    var g=q(".mob-kpi-grid"); if(!g||g.getAttribute("data-lxbuilt")==="1")return; g.setAttribute("data-lxbuilt","1");'
+'    mobKpis([["lxmRevM","This month","fees collected"],["lxmRevA","All time","since first fee"],'
+'      ["lxmUsers","Total users","wallets that paid"],["lxmTx","Fee payments","on-chain receipts"],'
+'      ["lxmTvl","Pool TVL","5 curated pools"],["lxmAct","Actives","needs analytics"]]);'
+'    loadRevenue().then(function(rv){ var w={}; rv.rows.forEach(function(p){ w[p.from]=1; });'
+'      setT(q("#lxmUsers"), num(Object.keys(w).length)); setT(q("#lxmTx"), num(rv.rows.length));'
+'      var now=new Date(), mS=new Date(now.getFullYear(),now.getMonth(),1).getTime();'
+'      var byA={}; rv.rows.forEach(function(p){ var a=assetOf(p), k=a.code+"-"+a.iss;'
+'        byA[k]=byA[k]||{code:a.code,iss:a.iss,amt:0,month:0}; byA[k].amt+=+p.amount||0;'
+'        if(Date.parse(p.created_at)>=mS)byA[k].month+=+p.amount||0; });'
+'      var ks=Object.keys(byA), pend=ks.length, all=0, mon=0;'
+'      if(!pend){ setT(q("#lxmRevM"),usd(0)); setT(q("#lxmRevA"),usd(0)); return; }'
+'      ks.forEach(function(k){ var a=byA[k]; priceUsd(a.code,a.iss,function(px){'
+'        if(px!=null){ all+=a.amt*px; mon+=a.month*px; }'
+'        if(--pend===0){ setT(q("#lxmRevA"),usd(all)); setT(q("#lxmRevM"),usd(mon)); } }); }); });'
+'    loadPools().then(function(ps){ var x=0; ps.forEach(function(p){ x+=p.xlm; });'
+'      priceUsd("XLM","",function(px){ setT(q("#lxmTvl"), px?usd(x*px):num(x)+" XLM"); }); });'
// everything below the KPI grid on the mobile dashboard is design filler with no source
+'    qa(".mob-main .adm-card, .mob-main .mob-card").forEach(function(c){ c.remove(); });'
+'    mobNote("Figures above are read from the chain. The charts and activity feed the design showed here had no data source, so they have been removed rather than filled with invented numbers \u2014 the desktop dashboard has the full breakdown.");'
+'    return; }'
+'  if(/^Users/.test(t)){'
+'    var cards=qa(".mob-user-card"); if(!cards.length)return;'
+'    var host=cards[0].parentNode, anchor=cards[0];'
+'    cards.forEach(function(c){ c.remove(); });'
+'    var box=document.createElement("div"); box.id="lxmList"; host.insertBefore(box,anchor.nextSibling||null);'
+'    box.innerHTML="<div class=\\"lxadm-empty\\">Loading\u2026</div>";'
+'    var seg=q(".mob-seg-row"); if(seg)seg.innerHTML="<button class=\\"mob-seg-chip active\\" type=\\"button\\"><span class=\\"sc-label\\">All wallets</span><span class=\\"sc-count\\" id=\\"lxmAll\\">\u2014</span></button>";'
+'    qa(".mob-page-actions .adm-btn").forEach(function(b){ if(/invite/i.test(b.textContent)){ b.disabled=true; b.style.opacity="0.5"; } });'
+'    mobNote("LumosCore has no sign-up, so there is no user table. A user here is a wallet that has paid a platform fee on-chain \u2014 the only record that someone used the app.");'
+'    var msi=q(".mob-filter-bar input"); if(msi)msi.placeholder="Search by wallet address…";'
+'    loadRevenue().then(function(rv){ var w={};'
+'      rv.rows.forEach(function(p){ var a=assetOf(p), u=w[p.from]=w[p.from]||{addr:p.from,n:0,codes:{},last:p.created_at};'
+'        u.n++; u.codes[a.code]=1; if(Date.parse(p.created_at)>Date.parse(u.last))u.last=p.created_at; });'
+'      var list=Object.keys(w).map(function(k){return w[k];}).sort(function(x,y){return y.n-x.n;});'
+'      setT(q("#lxmAll"),String(list.length)); fixPager(list.length);'
+'      var sub=q(".mob-page-sub"); if(sub)sub.innerHTML="<span class=\\"mono\\">"+list.length+"</span> fee-paying wallets";'
+'      if(!list.length){ box.innerHTML="<div class=\\"lxadm-empty\\">No wallet has paid a fee yet.</div>"; return; }'
+'      box.innerHTML=list.map(function(u){'
+'        return "<a class=\\"lxm-card\\" href=\\"lumoscore-admin-user-profile-mobile.html?w="+esc(u.addr)+"\\">"'
+'          +"<div class=\\"lxm-top\\"><img class=\\"lxm-av\\" data-lxc=\\"wallet\\" alt=\\"\\" src=\\""+avatar(u.addr.slice(1,3))+"\\">"'
+'          +"<div><div class=\\"lxm-name mono\\">"+esc(shortG(u.addr))+"</div><div class=\\"lxm-sub\\">Stellar mainnet</div></div></div>"'
+'          +"<div class=\\"lxm-stats\\"><div><div class=\\"lxm-sl\\">Fee payments</div><div class=\\"lxm-sv\\">"+u.n+"</div></div>"'
+'          +"<div><div class=\\"lxm-sl\\">Paid in</div><div class=\\"lxm-sv\\">"+esc(Object.keys(u.codes).join(", "))+"</div></div>"'
+'          +"<div><div class=\\"lxm-sl\\">Last seen</div><div class=\\"lxm-sv\\">"+esc(ago(u.last))+"</div></div></div></a>"; }).join(""); });'
+'    return; }'
+'  if(/^Assets/.test(t)){'
+'    var ac=qa(".mob-user-card"); if(!ac.length)return;'
+'    var ah=ac[0].parentNode, aa=ac[0]; ac.forEach(function(c){ c.remove(); });'
+'    var abox=document.createElement("div"); abox.id="lxmAList"; ah.insertBefore(abox,aa.nextSibling||null);'
+'    abox.innerHTML="<div class=\\"lxadm-empty\\">Loading\u2026</div>";'
+'    mobKpis([["lxmaN","Listed","in your list"],["lxmaV","LumosCore 7d vol","traded with us"]]);'
+'    mobNote("The curated list is stored on the server. A tick means the asset’s own issuer vouches for it. Volume is what has traded on LumosCore, not the whole Stellar DEX.");'
+'    var maseg=q(".mob-seg-row"); if(maseg)maseg.innerHTML="<button class=\\"mob-seg-chip active\\" type=\\"button\\"><span class=\\"sc-label\\">Listed</span><span class=\\"sc-count\\" id=\\"lxmaSeg\\">\\u2014</span></button>";'
+'    var mai=q(".mob-filter-bar input"); if(mai)mai.placeholder="Search by code or issuer…";'
+'    var LIST=aList(), D={}, LXV=null;'
+'    setT(q("#lxmaN"),String(LIST.length)); setT(q("#lxmaSeg"),String(LIST.length)); fixPager(LIST.length);'
+'    var sub2=q(".mob-page-sub"); if(sub2)sub2.innerHTML="<span class=\\"mono\\">"+LIST.length+"</span> listed assets";'
+'    function draw(){ abox.innerHTML=LIST.map(function(a){ var v=D[a.code+"-"+a.iss], ld=!v;'
+'      return "<a class=\\"lxm-card\\" href=\\"lumoscore-dex-asset-mobile.html?asset="+esc(a.code+"-"+a.iss)+"\\">"'
+'        +"<div class=\\"lxm-top\\"><img class=\\"lxm-av\\" data-lxc=\\""+esc(a.code)+"\\" alt=\\"\\" src=\\""+((v&&v.img)||avatar(a.code))+"\\">"'
+'        +"<div><div class=\\"lxm-name\\">"+esc(a.code)+"</div><div class=\\"lxm-sub\\">"+(ld?"\u2026":esc(v.domain||"no home domain"))+"</div></div>"'
+'        +"<div class=\\"lxm-right\\">"+(ld?"\u2026":(v.price?esc(usd(v.price)):"\u2014"))+"</div></div>"'
+'        +"<div class=\\"lxm-stats\\"><div><div class=\\"lxm-sl\\">24h</div><div class=\\"lxm-sv\\">"+(ld?"\u2026":pct(v.d1))+"</div></div>"'
+'        +"<div><div class=\\"lxm-sl\\">LumosCore 7d</div><div class=\\"lxm-sv\\">"+(LXV===null?"\u2026":(function(){ var r=LXV[a.code+"-"+a.iss]; return r&&r.amt?esc(num(Math.round(r.amt*100)/100)):"0"; })())+"</div></div>"'
+'        +"<div><div class=\\"lxm-sl\\">Trustlines</div><div class=\\"lxm-sv\\">"+(ld?"\u2026":esc(num(v.trust)))+"</div></div></div></a>"; }).join(""); }'
+'    draw();'
+'    LIST.forEach(function(a){ aInfo(a.code,a.iss,function(v){ D[a.code+"-"+a.iss]=v; draw(); }); });'
+'    loadVolume().then(function(V){ var since=Date.now()-7*86400000, m={};'
+'      (V&&V.rows||[]).forEach(function(r){ if(!r.code||!r.gross||r.t<since)return;'
+'        var k=r.code+"-"+r.iss; m[k]=m[k]||{amt:0,n:0}; m[k].amt+=r.gross; m[k].n++; });'
+'      LXV=m; draw();'
+'      var ks=Object.keys(m).filter(function(k){ return m[k].amt>0; });'
+'      if(!ks.length){ setT(q("#lxmaV"),usd(0)); return; }'
+'      var tot=0,pend=ks.length;'
+'      ks.forEach(function(k){ var i=k.lastIndexOf("-"); priceUsd(k.slice(0,i),k.slice(i+1),function(px){'
+'        if(px!=null)tot+=m[k].amt*px; if(--pend===0)setT(q("#lxmaV"),usd(tot)); }); });'
+'    }).catch(function(){ LXV={}; draw(); });'
+'    return; }'
+'}'
+'function profWallet(){ try{ return (new URLSearchParams(location.search)).get("w")||""; }catch(_){ return ""; } }'
+'function paintProfile(){'
+'  var hero=q(".up-hero")||q(".mob-up-hero"); if(!hero||hero.getAttribute("data-lxbuilt")==="1")return;'
+'  hero.setAttribute("data-lxbuilt","1");'
+'  var mob=!!q(".mob-up-hero");'
+'  var usersHref=mob?"lumoscore-admin-users-mobile.html":"lumoscore-admin-users.html";'
+'  var addr=profWallet();'
// disable everything that would need a server to mean anything
+'  qa(".up-actions .adm-btn, .mob-up-actions .adm-btn, .admin-page-actions .adm-btn").forEach(function(b){'
+'    if(/add note/i.test(b.textContent))return;'
+'    b.disabled=true; b.style.opacity="0.5"; b.style.cursor="not-allowed";'
+'    b.title="Needs a backend \u2014 LumosCore cannot suspend, message or grant from a static site."; });'
+'  var name=q(".up-name")||q(".mob-up-name");'
+'  var mail=q(".up-email")||q(".mob-up-email");'
+'  var chips=q(".up-wallets")||q(".mob-up-wallets");'
+'  var av=q(".up-av-lg")||q(".mob-up-av");'
+'  if(!/^G[A-Z2-7]{55}$/.test(addr)){'
+'    if(name)name.textContent="No wallet selected";'
+'    if(mail)mail.innerHTML="Open this page from the Users list to inspect a wallet. <a class=\\"lxadm-link\\" href=\\""+usersHref+"\\">Back to Users</a>";'
+'    if(chips)chips.innerHTML="";'
+'    if(av){ av.textContent=""; av.style.background="var(--surface-2)"; }'
+'    qa(".up-mini-card, .mob-up-mini-card").forEach(function(c){'
+'      var v=c.querySelector(".up-mini-val")||c.querySelector(".mob-up-mini-val"); if(v)setT(v,"\u2014");'
+'      var f=c.querySelector(".up-mini-foot")||c.querySelector(".mob-up-mini-foot"); if(f){ f.innerHTML=""; f.textContent=""; } });'
+'    qa(".adm-card-body, .mob-card-body, .act-feed").forEach(function(b){'
+'      if(b.querySelector("textarea"))return;'
+'      b.innerHTML="<div class=\\"lxadm-empty\\">No wallet selected.</div>"; });'
+'    return; }'
// ---- hero ----
+'  if(av){ av.textContent=""; av.style.cssText="background:transparent "+cssUrl(avatar(addr.slice(1,3)))+" center/cover no-repeat;border-radius:50%"; }'
+'  if(name)name.innerHTML="<span class=\\"mono\\">"+esc(shortG(addr))+"</span>";'
+'  if(mail)mail.innerHTML="Stellar mainnet wallet \u00b7 <a class=\\"lxadm-link\\" target=\\"_blank\\" rel=\\"noopener\\" href=\\"https://stellar.expert/explorer/public/account/"+esc(addr)+"\\">view on stellar.expert</a>";'
+'  if(chips)chips.innerHTML="<span class=\\""+(mob?"mob-up-wallet-chip":"up-wallet-chip")+"\\">"+esc(addr)+"</span>";'
+'  var head=pageHead();'
+'  if(head&&!q(".lxadm-note")){ var nt=document.createElement("div"); nt.className="lxadm-note";'
+'    nt.textContent="LumosCore has no accounts, so this is a wallet profile, not a person. Holdings and activity below are read from Stellar mainnet. There is no name, email, tier or risk score to show \u2014 those would need an account system behind the app.";'
+'    head.parentNode.insertBefore(nt, head.nextSibling); }'
// ---- mini stats ----
+'  var minis=qa(".up-mini-card, .mob-up-mini-card");'
+'  var DEF=[["Fees paid","to LumosCore"],["Fee payments","swaps + deposits"],["XLM balance","native"],["Assets held","trustlines"]];'
+'  minis.forEach(function(c,i){ var d=DEF[i]; if(!d){ c.remove(); return; }'
+'    var l=c.querySelector(".up-mini-label")||c.querySelector(".mob-up-mini-label"); if(l)setT(l,d[0]);'
+'    var v=c.querySelector(".up-mini-val")||c.querySelector(".mob-up-mini-val"); if(v){ v.id="lxpM"+i; setT(v,"\u2026"); }'
+'    var f=c.querySelector(".up-mini-foot")||c.querySelector(".mob-up-mini-foot"); if(f){ f.innerHTML=""; f.textContent=d[1]; } });'
+'  loadRevenue().then(function(rv){'
+'    var mine=rv.rows.filter(function(p){ return p.from===addr; });'
+'    setT(q("#lxpM1"), num(mine.length));'
+'    var by={}; mine.forEach(function(p){ var a=assetOf(p), k=a.code+"-"+a.iss;'
+'      by[k]=by[k]||{code:a.code,iss:a.iss,amt:0}; by[k].amt+=+p.amount||0; });'
+'    var ks=Object.keys(by), pend=ks.length, tot=0;'
+'    if(!pend)setT(q("#lxpM0"), usd(0));'
+'    else ks.forEach(function(k){ var a=by[k]; priceUsd(a.code,a.iss,function(px){'
+'      if(px!=null)tot+=a.amt*px; if(--pend===0)setT(q("#lxpM0"), usd(tot)); }); });'
+'    var act=cardByTitle("Recent activity");'
+'    if(act){ var ab=act.querySelector(".adm-card-body")||act.querySelector(".mob-card-body")||act.querySelector(".act-feed");'
+'      if(ab){ ab.removeAttribute("style"); ab.style.padding="0";'
+'        ab.innerHTML = mine.length ? mine.slice(0,10).map(function(p){ var a=assetOf(p);'
+'          return "<a class=\\"lxwal-row\\" target=\\"_blank\\" rel=\\"noopener\\" href=\\"https://stellar.expert/explorer/public/tx/"+esc(p.transaction_hash)+"\\">"'
+'            +"<div class=\\"lxwal-meta\\"><div class=\\"lxwal-addr\\">Paid "+esc(num(+p.amount))+" "+esc(a.code)+" in platform fees</div>"'
+'            +"<div class=\\"lxwal-sub\\">"+esc(new Date(p.created_at).toLocaleString())+"</div></div>"'
+'            +"<div class=\\"lxwal-val\\">"+esc(ago(p.created_at))+"</div></a>"; }).join("")'
+'          : "<div class=\\"lxadm-empty\\">This wallet has not paid a platform fee. Only fee payments are visible to LumosCore \u2014 the rest of its on-chain history is on the explorer.</div>";'
+'        fixPager(mine.length); } }'
+'  });'
// ---- holdings, priced ----
+'  accountOf(addr).then(function(d){'
+'    var hold=cardByTitle("Top holdings");'
+'    var hb=hold&&(hold.querySelector(".adm-card-body")||hold.querySelector(".mob-card-body"));'
+'    if(!d){ if(hb)hb.innerHTML="<div class=\\"lxadm-empty\\">Account not found on Stellar mainnet.</div>"; return; }'
+'    var bal=(d.balances||[]).filter(function(b){ return b.asset_type!=="liquidity_pool_shares"; });'
+'    var nat=bal.filter(function(b){ return b.asset_type==="native"; })[0];'
+'    setT(q("#lxpM2"), nat?num(+nat.balance):"0");'
+'    setT(q("#lxpM3"), num(bal.filter(function(b){ return b.asset_type!=="native"; }).length));'
+'    if(!hb)return;'
+'    var rows=bal.map(function(b){ return b.asset_type==="native"'
+'      ? {code:"XLM",iss:"",amt:+b.balance}'
+'      : {code:b.asset_code,iss:b.asset_issuer,amt:+b.balance}; }).filter(function(r){ return r.amt>0; });'
+'    if(!rows.length){ hb.innerHTML="<div class=\\"lxadm-empty\\">This account holds no positive balances.</div>"; return; }'
+'    function draw(){ rows.sort(function(x,y){ return (y.usd||0)-(x.usd||0)||y.amt-x.amt; });'
+'      hb.removeAttribute("style"); hb.style.padding="0";'
+'      hb.innerHTML=rows.slice(0,12).map(function(r){'
+'        return "<div class=\\"lxwal-row\\"><img class=\\"lxwal-av\\" data-lxc=\\""+esc(r.code)+"\\" alt=\\"\\" src=\\""+(LG[r.code+"-"+r.iss]||avatar(r.code))+"\\">"'
+'          +"<div class=\\"lxwal-meta\\"><div class=\\"lxwal-addr\\">"+esc(r.code)+"</div>"'
+'          +"<div class=\\"lxwal-sub\\">"+esc(num(r.amt))+"</div></div>"'
+'          +"<div class=\\"lxwal-val\\">"+(r.usd==null?"\u2014":esc(usd(r.usd)))+"</div></div>"; }).join(""); }'
+'    draw();'
+'    rows.forEach(function(r){ priceUsd(r.code,r.iss,function(px){ r.usd=(px==null)?null:r.amt*px; draw(); }); });'
+'  });'
// ---- notes: local, but real ----
+'  var notes=cardByTitle("Internal notes");'
+'  if(notes){ var nb=notes.querySelector(".adm-card-body")||notes.querySelector(".mob-card-body");'
+'    if(nb){ var NK="lumos.admin.notes."+addr, cur="";'
+'      try{ cur=localStorage.getItem(NK)||""; }catch(_){}'
+'      nb.removeAttribute("style");'
+'      nb.innerHTML="<textarea class=\\"lxnote\\" id=\\"lxpNote\\" placeholder=\\"Notes about this wallet\u2026\\"></textarea>"'
+'        +"<div class=\\"lxnote-bar\\"><span class=\\"lxnote-hint\\" id=\\"lxpNoteHint\\">Saved in this browser only \u2014 notes need a backend to be shared.</span>"'
+'        +"<button class=\\"adm-btn primary\\" type=\\"button\\" id=\\"lxpNoteSave\\">Save note</button></div>";'
+'      var ta=nb.querySelector("#lxpNote"); ta.value=cur;'
+'      nb.querySelector("#lxpNoteSave").addEventListener("click",function(){'
+'        try{ localStorage.setItem(NK, ta.value); var h2=nb.querySelector("#lxpNoteHint");'
+'          h2.textContent="Saved."; setTimeout(function(){ h2.textContent="Saved in this browser only \u2014 notes need a backend to be shared."; },2500);'
+'        }catch(_){} }); } }'
// ---- risk: nothing scores this ----
+'  var risk=cardByTitle("Risk");'
+'  if(risk){ var rb=risk.querySelector(".adm-card-body")||risk.querySelector(".mob-card-body");'
+'    if(rb){ rb.removeAttribute("style");'
+'      rb.innerHTML="<div class=\\"lxadm-empty\\">Nothing scores wallets for risk. Flags like sanctions screening or unusual-activity detection need a monitoring service and somewhere to record findings \u2014 neither exists yet.</div>"; } }'
+'  qa(".up-tabs, .mob-up-tabs").forEach(function(t){ t.remove(); });'
+'}'
+'function boot(){ try{ paintRevenue(); }catch(e){} try{ paintSources(); }catch(e){} try{ var _sa=q("#lxSrcAdd"); if(_sa&&!_sa.__lx){ _sa.__lx=1; _sa.addEventListener("click",addManual); } }catch(e){} try{ wireCsv(); }catch(e){} try{ paintDashboard(); }catch(e){} try{ paintDashPanels(); }catch(e){} try{ paintDashRow3(); }catch(e){} try{ paintUsers(); }catch(e){} try{ paintAssets(); }catch(e){} try{ paintMobile(); }catch(e){} try{ paintProfile(); }catch(e){} try{ paintNoBackend(); }catch(e){} try{ paintChrome(); }catch(e){} }'
+'if(document.readyState!=="loading")boot(); else document.addEventListener("DOMContentLoaded",boot);'
+'})();</'+'script>';

// ---- sidebar entry -----------------------------------------------------------------------------------
const REV_ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';
function revItem(active,suffix){ return '<a class="adn-item '+(active?'active':'')+'" href="lumoscore-admin-revenue'+suffix+'.html" data-tip="Revenue">\n      '+REV_ICON+'\n      <span class="adn-label">Revenue</span>\n    </a>\n    '; }

function variantOf(key){ if(/-dark\.html$/.test(key))return '-dark'; if(/-mobile\.html$/.test(key))return '-mobile'; return ''; }

// ---- the Assets page ships with invented figures, so blank them AT BUILD TIME -----------------------
// 492 assets, 423 listed, 187 active, 8 flagged and twenty rows of made-up tokens are the design's
// filler. They are in the HTML, so they paint before a single line of our script runs -- no amount of
// care in the painter can beat markup that is already on screen. This is the markup-level fix the flash
// rules ask for first; the script then fills the same slots with real numbers.
function blankAssets(h, mobile) {
  const LABELS = ['Listed assets', 'Traded on LumosCore', 'With a spot price', 'LumosCore 7d volume'];
  const FEET = ['in your list', 'in the last 7 days', 'priced on the DEX', 'traded on our platform'];
  let i = 0, j = 0, f = 0;
  h = h.replace(/(<div class="kpi-value"[^>]*>)([^<]*)(<\/div>)/g, (m, a, v, b) => (i++ < 4 ? a + '—' + b : m));
  h = h.replace(/(<span class="kpi-label">)([^<]*)(<\/span>)/g, (m, a, v, b) => (j < 4 ? a + LABELS[j++] + b : m));
  h = h.replace(/(<div class="kpi-foot"[^>]*>)([\s\S]*?)(<\/div>)/g, (m, a, v, b) => (f < 4 ? a + FEET[f++] + b : m));
  // Whole element, not just its first text node: the count sits in a nested <span class="mono">, so
  // stopping at the first tag left "Assets you list on LumosCore492 total" on screen.
  h = h.replace(/(<p class="admin-page-sub">)[\s\S]*?(<\/p>)/, '$1Assets you list on LumosCore$2');
  h = h.replace(/(<div class="mob-page-sub"[^>]*>)[\s\S]*?(<\/div>)/, '$1Assets you list on LumosCore$2');
  h = h.replace(/(<span class="seg-count"[^>]*>)[^<]*(<\/span>)/g, '$1—$2');
  h = h.replace(/(<span class="sc-count"[^>]*>)[^<]*(<\/span>)/g, '$1—$2');
  h = h.replace(/Showing[\s\S]{0,200}?assets<\/span>/, 'Showing — assets</span>');

  if (mobile) {
    // The phone lists filler cards instead of a table, and they are anchors, not divs.
    //
    // ONE is kept, hidden. The painter finds the cards, takes the first as its insertion point and
    // removes them all -- delete every card here and it finds none, returns early, and the mobile
    // Assets page renders nothing at all. So the anchor survives with no content to flash.
    let first = true;
    h = h.replace(/<a class="mob-user-card"[\s\S]*?<\/a>/g, () => {
      if (!first) return '';
      first = false;
      return '<a class="mob-user-card" href="#" style="display:none"></a>';
    });
    h = h.replace(/(<p class="mob-page-sub"[^>]*>)[\s\S]*?(<\/p>)/, '$1Assets you list on LumosCore$2');
    h = h.replace(/(<div class="mob-kpi-value"[^>]*>)[^<]*(<\/div>)/g, '$1—$2');
    h = h.replace(/<span class="mono">\d[\d,]*<\/span>/g, '<span class="mono">—</span>');
  } else {
    const a = h.indexOf('<tbody');
    const e = h.indexOf('</tbody>', a);
    if (a >= 0 && e > a) {
      const open = h.indexOf('>', a) + 1;
      h = h.slice(0, open)
        + '<tr><td colspan="8" style="padding:26px 4px;color:var(--text-muted)">Loading…</td></tr>'
        + h.slice(e);
    }
  }
  return h;
}

let pages=0, made=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain','stellar','xrpl']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    let changed=false;

    // 1. build the Revenue page(s) by cloning the admin dashboard shell
    Object.keys(json).filter(k=>/^lumoscore-admin-dashboard(-dark|-mobile)?\.html$/.test(k)).forEach(function(dk){
      const suffix=variantOf(dk);
      const rk='lumoscore-admin-revenue'+suffix+'.html';
      let h=json[dk];
      // the mobile shell is a different element entirely
      if(suffix==='-mobile'){
        const ms=h.indexOf('<main class="mob-main">');
        const mz=h.indexOf('</main>', ms);
        if(ms<0||mz<0) return;
        let rv=h.slice(0,ms)+'<main class="mob-main">'+REVENUE_MOB+h.slice(mz);
        rv=rv.replace(/<title>[\s\S]*?<\/title>/,'<title>LumosCore \u2014 Admin \u00b7 Revenue</title>');
        rv=rv.replace(/<a class="mob-menu-item active"/,'<a class="mob-menu-item"');
        json[rk]=rv; changed=true; made++; return;
      }
      const mi=h.indexOf('<main class="admin-main">');
      const me=h.indexOf('</main>', mi);
      if(mi<0||me<0) return;
      let rev=h.slice(0,mi)+'<main class="admin-main">'+REVENUE_MAIN+h.slice(me);
      rev=rev.replace(/<title>[\s\S]*?<\/title>/,'<title>LumosCore \u2014 Admin \u00b7 Revenue</title>');
      // move the sidebar "active" marker onto Revenue
      rev=rev.replace(/<a class="adn-item active"/,'<a class="adn-item "');
      json[rk]=rev; changed=true; made++;
    });

    // 2. sidebar entry on every admin page (idempotent), + CSS/script injection
    for(const k of Object.keys(json)){
      if(!/^lumoscore-admin-/.test(k)) continue;
      let h=json[k];
      if(/^lumoscore-admin-assets/.test(k)) h=blankAssets(h, /-mobile\.html$/.test(k));
      h=h.replace(/<a class="adn-item [^"]*" href="lumoscore-admin-revenue[^"]*"[\s\S]*?<\/a>\s*/g,'');   // strip old
      // The mobile menu needs the same strip, and did not have one. The insert below is unguarded, so
      // every run of this transform appended another Revenue entry to the container -- which persists
      // between runs because containers are not rebuilt from the design. 28 had accumulated.
      h=h.replace(/<a class="mob-menu-item[^"]*" href="lumoscore-admin-revenue-mobile\.html"[\s\S]*?<\/a>\s*/g,'');
      h=h.replace(/<style id="lx-admin-css">[\s\S]*?<\/style>/g,'').replace(/<script id="lx-admindata">[\s\S]*?<\/script>/g,'');
      const suffix=variantOf(k);
      const isRev=/^lumoscore-admin-revenue/.test(k);
      // insert directly after the Dashboard item
      const dashRe=/(<a class="adn-item[^"]*" href="lumoscore-admin-dashboard[^"]*"[\s\S]*?<\/a>\s*)/;
      if(dashRe.test(h)) h=h.replace(dashRe,'$1'+revItem(isRev,suffix));
      // mobile menu: add Revenue, and point the design's dead href="#" items at the pages that exist
      if(suffix==='-mobile'){
        const mrev='<a class="mob-menu-item'+(isRev?' active':'')+'" href="lumoscore-admin-revenue-mobile.html">'+REV_ICON+'<span>Revenue</span></a>\n      ';
        const mdash=/(<a class="mob-menu-item[^"]*" href="lumoscore-admin-dashboard-mobile\.html">[\s\S]*?<\/a>\s*)/;
        if(mdash.test(h)) h=h.replace(mdash,'$1'+mrev);
        const MAP={Assets:'assets',Support:'support',Blogs:'blogs'};
        h=h.replace(/<a class="(mob-menu-item[^"]*)" href="#">([\s\S]*?)<\/a>/g,(full,cls,inner)=>{
          const m2=inner.match(/<span>([^<]+)<\/span>/);
          const key=m2&&MAP[m2[1].trim()];
          // no admin page exists behind Trades / Pools / LUMOS Incentives, so drop them rather
          // than leave a menu entry that goes nowhere
          return key ? '<a class="'+cls+'" href="lumoscore-admin-'+key+'-mobile.html">'+inner+'</a>' : '';
        });
      }
      // The page is no longer built (see DROPPED in extract_site.js), so every nav entry that links it
      // has to go too -- otherwise the panel carries an item that 404s.
      //
      // BOTH shapes, and the mobile one is not covered by the MAP above. That map only rewrites the
      // design's dead href="#" items; an earlier run already rewrote this one to a real filename and
      // baked it into the container, so it no longer matches href="#" and has to be cut by name.
      h=h.replace(/<a class="adn-item[^"]*" href="lumoscore-admin-create-pool[^"]*"[\s\S]*?<\/a>\s*/g, '');
      h=h.replace(/<a class="mob-menu-item[^"]*" href="lumoscore-admin-create-pool[^"]*"[\s\S]*?<\/a>\s*/g, '');
      const bi=h.lastIndexOf('</body>');
      if(bi>=0) h=h.slice(0,bi)+CSS+SCRIPT+h.slice(bi);
      json[k]=h; changed=true; pages++;
    }

    if(changed){ const ser=JSON.stringify(json).split('</').join('<'+B+'/'); fs.writeFileSync(file,data.slice(0,s)+ser+data.slice(e),'utf8'); }
  }
}
console.log('admin: Revenue page created on '+made+' variant(s); sidebar + real-data layer on '+pages+' admin page keys');
