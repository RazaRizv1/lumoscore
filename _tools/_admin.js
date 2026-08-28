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
.lxadm-note{margin:0 0 16px;padding:12px 14px;border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:10px;background:var(--surface-2);color:var(--text-muted);font-size:13px;line-height:1.6}
</'+'style>`.replace("</'+'style>","</"+"style>");

// ---- data layer ---------------------------------------------------------------------------------------
const SCRIPT='<script id="lx-admindata">(function(){'
+'var H="https://horizon.stellar.org";'
+'var FEE="'+FEE_COLLECTOR+'";'
+'function q(s){return document.querySelector(s);} function qa(s){return [].slice.call(document.querySelectorAll(s));}'
+'function j(u){return fetch(u).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});}'
+'function setT(el,t){ if(el&&el.textContent!==t)el.textContent=t; }'
+'function usd(n){ if(n==null||!isFinite(n))return "\\u2014"; if(n===0)return "$0"; if(n>=1e6)return "$"+(n/1e6).toFixed(2)+"M"; if(n>=1e3)return "$"+(n/1e3).toFixed(1)+"K"; if(n<0.0001)return "$"+(+n).toPrecision(3); return "$"+n.toFixed(n<1?4:2); }'
+'function num(n){ if(n==null||!isFinite(n))return "\\u2014"; return (+n).toLocaleString(undefined,{maximumFractionDigits:7}); }'
+'function shortG(a){ return a?a.slice(0,4)+"\\u2026"+a.slice(-4):""; }'
+'function esc(s){return String(s==null?"":s).replace(/[<>&"]/g,function(c){return c==="<"?"&lt;":c===">"?"&gt;":c==="&"?"&amp;":"&quot;";});}'
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
+'function fixPager(n){ var b=q(".pg-btn"); if(!b)return; var ctrls=b.parentNode, row=ctrls.parentNode;'
+'  var info=row.querySelector(".pg-info"); if(!info){ var f=row.firstElementChild; if(f&&f!==ctrls)info=f; }'
+'  if(info)info.innerHTML="<span class=\\"mono\\">"+(n?1:0)+"</span>\\u2013<span class=\\"mono\\">"+n+"</span> of <span class=\\"mono\\">"+n+"</span>";'
+'  ctrls.remove(); }'
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
  el.src="https://cdn.jsdelivr.net/npm/@stellar/stellar-base@13.0.1/dist/stellar-base.min.js";
  el.onload=function(){ window.StellarBase?res(window.StellarBase):rej(new Error("sdk")); };
  el.onerror=function(){ rej(new Error("sdk")); };
  document.head.appendChild(el); }); return _sbP; }
// Gross volume for one fee receipt: the user's own swap leg plus the fee leg, both denominated in the
// asset being sent. Returns null when the envelope holds no swap -- a bare fee payment with no trade
// behind it is not volume, and is reported as unresolved rather than counted as zero.
function grossOf(S,p){ try{
  var ex=p.transaction&&p.transaction.envelope_xdr; if(!ex)return null;
  var tx=S.TransactionBuilder.fromXDR(ex,S.Networks.PUBLIC);
  var ops=tx.operations||[], swap=null, fee=0;
  for(var i=0;i<ops.length;i++){ var o=ops[i];
    if(o.type==="pathPaymentStrictSend"&&o.destination===p.from){ swap=o; }
    else if(o.destination===FEE){ fee+=(+o.sendAmount||+o.amount||0); } }
  if(!swap)return null;
  var a=swap.sendAsset; if(!a)return null;
  var code=(a.isNative&&a.isNative())?"XLM":a.code; if(!code)return null;
  var iss=(code==="XLM")?"":(a.issuer||"");
  return {code:code,iss:iss,gross:(+swap.sendAmount||0)+fee};
}catch(e){ return null; } }
var VOL=null;
function loadVolume(){ if(VOL)return Promise.resolve(VOL);
  return Promise.all([loadRevenue(),sdk()]).then(function(z){ var rv=z[0],S=z[1];
    var out=[],miss=0;
    rv.rows.forEach(function(p){ var g=grossOf(S,p);
      if(!g){ miss++; return; }
      out.push({t:Date.parse(p.created_at),from:p.from,code:g.code,iss:g.iss,gross:g.gross}); });
    VOL={rows:out,missing:miss}; return VOL; })
   .catch(function(){ VOL={rows:[],missing:-1}; return VOL; }); }
// Assets we cannot price are reported, never guessed at -- the rule the revenue table already follows.
function volUsd(rows,since,cb){ var byA={};
  rows.forEach(function(r){ if(since&&r.t<since)return; var k=r.code+"-"+r.iss;
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
  var n=0,excl=0;
  function page(cur,depth){
    return j("/lxapi/holders?asset=LUMOS-"+LUMOS_ISS+"&limit=200"+(cur?("&cursor="+encodeURIComponent(cur)):"")).then(function(d){
      var rs=(d&&d._embedded&&d._embedded.records)||[]; if(!rs.length)return;
      var below=false;
      for(var i=0;i<rs.length;i++){ var bal=(+rs[i].balance||0)/1e7;
        if(bal<TIER){ below=true; break; }
        if(TREASURY[rs[i].address||rs[i].account])excl++; else n++; }
      if(below)return;
      var nx=rs[rs.length-1].paging_token;
      if(nx&&depth<6)return page(nx,depth+1); }); }
  return page("",1).then(function(){ TIERC={n:n,excluded:excl}; return TIERC; })
   .catch(function(){ TIERC={n:null,excluded:0}; return TIERC; }); }
var WIN=[["24H",864e5],["7D",6048e5],["30D",2592e6],["Lifetime",0]], WI=0;
function winSince(){ var ms=WIN[WI][1]; return ms?(Date.now()-ms):0; }
function kpiTile(id,label,foot,tip){
  return "<div class='kpi'><div class='kpi-head'><span class='kpi-label'>"+label+"</span></div>"
    +"<div class='kpi-value' id='"+id+"'"+(tip?(" title='"+tip+"'"):"")+">\u2014</div>"
    +"<div class='kpi-foot' id='"+id+"F'>"+foot+"</div></div>"; }
function per(){ return "<span class='lxd-per'>"+WIN[WI][0]+"</span>"; }
function buildDash(grid){
  grid.innerHTML = kpiTile("lxdVol","Volume",per()+" \u00b7 swap volume")
    + kpiTile("lxdTrades","Trades",per()+" \u00b7 fee-paying swaps")
    + kpiTile("lxdWal","Connected wallets",per()+" \u00b7 needs the site beacon","Nothing on-chain records a wallet CONNECTING to the site - only wallets that went on to pay a fee leave a trace. A first-party beacon is needed for this and it is not installed yet, so this is left blank rather than estimated.")
    + kpiTile("lxdRev","Revenue",per()+" \u00b7 fees collected")
    + kpiTile("lxdVolA","Lifetime volume","every swap since launch")
    + kpiTile("lxdTradesA","Lifetime trades","every fee-paying swap")
    + kpiTile("lxdWalA","Lifetime wallets","distinct fee-paying wallets","Distinct wallets that have paid a platform fee. Not the same as wallets that connected - that needs the beacon.")
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
    setT(q("#lxdWalA"), num(Object.keys(wAll).length));
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
  });
  loadTier().then(function(t){ if(t.n==null){ setT(q("#lxdTier"),"\u2014"); return; }
    setT(q("#lxdTier"), num(t.n));
    var f=q("#lxdTierF"); if(f)f.textContent="qualify for the 0.1% fee"+(t.excluded?(" \u00b7 "+t.excluded+" treasury excluded"):""); });
}
function paintDashboard(){ if(!isDash())return; var grid=q(".kpi-grid"); if(!grid)return;
  if(grid.getAttribute("data-lxbuilt")!=="1"){ grid.setAttribute("data-lxbuilt","1"); buildDash(grid); wirePeriod(); }
  fillDash();
}
`
// ---- Support / Blogs: honest empty states, no invented records ----
+'function paintNoBackend(){'
+'  var t=pageTitle();'
+'  var isSup=/support/i.test(t), isBlog=/blog/i.test(t);'
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
// 3. retention needs sessions; there are none
+'  var c3=cardByTitle("New & Retention")||cardByTitle("Retention");'
+'  if(c3&&c3.getAttribute("data-lxbuilt")!=="1"){ c3.setAttribute("data-lxbuilt","1");'
+'    cardBody(c3,"<div class=\\"lxadm-empty\\">Retention needs sessions to measure, and LumosCore has no accounts and no analytics \u2014 a wallet that connects twice is indistinguishable from two wallets. This needs a backend.</div>"); }'
+'}'
+'function accountOf(a){ return j(H+"/accounts/"+a); }'
+'function paintUsers(){'
+'  var t=(q(".admin-page-title")||{}).textContent||""; if(!/^\\s*Users/.test(t))return;'
+'  var tbl=q(".adm-table"); if(!tbl||tbl.getAttribute("data-lxbuilt")==="1")return; tbl.setAttribute("data-lxbuilt","1");'
// there is no tier, no email and no session, so those columns are replaced rather than left blank
+'  var TH=["Wallet","Assets held","XLM balance","Fee payments","Fees paid","First seen","Last seen"];'
+'  var thr=tbl.querySelector("thead tr");'
+'  if(thr)thr.innerHTML=TH.map(function(h,i){ return "<th"+(i>0?" style=\\"text-align:right\\"":"")+">"+esc(h)+"</th>"; }).join("");'
+'  var tb=tbl.querySelector("tbody");'
+'  if(tb)tb.innerHTML="<tr><td colspan=\\""+TH.length+"\\" class=\\"lxadm-empty\\">Loading\u2026</td></tr>";'
// the segment chips describe cohorts nothing here can compute
+'  var seg=q(".seg-row"); if(seg)seg.innerHTML="<button class=\\"seg-chip active\\" type=\\"button\\"><span class=\\"seg-label\\">All wallets</span><span class=\\"seg-count\\" id=\\"lxuAll\\">\u2014</span></button>";'
+'  var head=q(".admin-page-head");'
+'  if(head&&!q(".lxadm-note")){ var nt=document.createElement("div"); nt.className="lxadm-note";'
+'    nt.textContent="LumosCore has no sign-up, so there is no user table to read. A user here is a wallet that has paid a platform fee on-chain \u2014 that is the only record of someone having used the app. Names, emails, tiers and cohort segments would need an account system and analytics behind them.";'
+'    head.parentNode.insertBefore(nt, head.nextSibling); }'
// "Invite admin" has nowhere to send an invite to
+'  qa(".admin-page-actions .adm-btn").forEach(function(b){ if(/invite/i.test(b.textContent)){ b.disabled=true; b.style.opacity="0.5"; b.style.cursor="not-allowed"; b.title="Needs a backend \u2014 there is nowhere to store an admin account or send an invite."; } });'
+'  var ROWS=[];'
+'  loadRevenue().then(function(rv){'
+'    var w={};'
+'    rv.rows.forEach(function(p){ var a=assetOf(p), u=w[p.from]=w[p.from]||{addr:p.from,n:0,by:{},first:p.created_at,last:p.created_at};'
+'      u.n++; u.by[a.code+"-"+a.iss]=(u.by[a.code+"-"+a.iss]||0)+(+p.amount||0);'
+'      if(Date.parse(p.created_at)<Date.parse(u.first))u.first=p.created_at;'
+'      if(Date.parse(p.created_at)>Date.parse(u.last))u.last=p.created_at; });'
+'    ROWS=Object.keys(w).map(function(k){return w[k];}).sort(function(x,y){return y.n-x.n;});'
+'    setT(q("#lxuAll"), String(ROWS.length)); fixPager(ROWS.length);'
+'    var sub=q(".admin-page-sub"); if(sub)sub.innerHTML="Wallets that have paid a platform fee \u00b7 <span class=\\"mono\\">"+ROWS.length+"</span> total";'
+'    if(!ROWS.length){ if(tb)tb.innerHTML="<tr><td colspan=\\""+TH.length+"\\" class=\\"lxadm-empty\\">No wallet has paid a fee yet.</td></tr>"; return; }'
+'    render();'
+'    ROWS.forEach(function(u){ accountOf(u.addr).then(function(d){ if(!d)return;'
+'      var bal=d.balances||[]; u.trust=bal.filter(function(b){return b.asset_type!=="native"&&b.asset_type!=="liquidity_pool_shares";}).length;'
+'      var nb=bal.filter(function(b){return b.asset_type==="native";})[0]; u.xlm=nb?+nb.balance:null; render(); }); });'
+'    var codes={}; ROWS.forEach(function(u){ Object.keys(u.by).forEach(function(k){ codes[k]=1; }); });'
+'    Object.keys(codes).forEach(function(k){ var p=k.split("-");'
+'      priceUsd(p[0],p[1]||"",function(px){ if(px==null)return;'
+'        ROWS.forEach(function(u){ if(u.by[k]!=null){ u.usd=(u.usd||0)+u.by[k]*px; } }); render(); }); });'
+'  });'
+'  function render(){ if(!tb)return; var qy=((q(".fs-search input")||{}).value||"").trim().toLowerCase();'
+'    var list=ROWS.filter(function(u){ return !qy || u.addr.toLowerCase().indexOf(qy)>=0; });'
+'    if(!list.length){ tb.innerHTML="<tr><td colspan=\\""+TH.length+"\\" class=\\"lxadm-empty\\">No wallet matches that search.</td></tr>"; return; }'
+'    tb.innerHTML=list.map(function(u){'
+'      var paid=Object.keys(u.by).map(function(k){ return num(u.by[k])+" "+k.split("-")[0]; }).join(", ");'
+'      return "<tr class=\\"clickable\\" onclick=\\"__lxNav&&__lxNav(\u0027lumoscore-admin-user-profile.html?w="+esc(u.addr)+"\u0027)\\">"'
+'        +"<td><div class=\\"user-cell\\"><img class=\\"lxu-av\\" data-lxc=\\"wallet\\" alt=\\"\\" src=\\""+avatar(u.addr.slice(1,3))+"\\">"'
+'        +"<div><div class=\\"un mono\\">"+esc(shortG(u.addr))+"</div><div class=\\"um\\">Stellar mainnet</div></div></div></td>"'
+'        +"<td class=\\"num-cell\\" style=\\"text-align:right\\">"+(u.trust==null?"\u2026":u.trust)+"</td>"'
+'        +"<td class=\\"num-cell\\" style=\\"text-align:right\\">"+(u.xlm==null?"\u2026":num(u.xlm))+"</td>"'
+'        +"<td class=\\"num-cell\\" style=\\"text-align:right\\">"+u.n+"</td>"'
+'        +"<td class=\\"num-cell\\" style=\\"text-align:right\\" title=\\""+esc(paid)+"\\">"+(u.usd==null?esc(paid):esc(usd(u.usd)))+"</td>"'
+'        +"<td style=\\"text-align:right;color:var(--text-muted);font-size:13.5px\\">"+esc(new Date(u.first).toLocaleDateString())+"</td>"'
+'        +"<td style=\\"text-align:right;color:var(--text-muted);font-size:13.5px\\">"+esc(ago(u.last))+"</td></tr>"; }).join(""); }'
+'  var si=q(".fs-search input"); if(si){ si.placeholder="Search by wallet address\u2026"; si.addEventListener("input",render); }'
// the sort/network selects offer fields that do not exist on a wallet
+'  qa(".filter-strip .fs-select").forEach(function(sel,i){'
+'    if(i===0){ sel.innerHTML="<option>Sort: Fee payments</option><option>Sort: Fees paid</option><option>Sort: Last seen</option>";'
+'      sel.addEventListener("change",function(){ var v=sel.selectedIndex;'
+'        ROWS.sort(function(x,y){ if(v===1)return (y.usd||0)-(x.usd||0); if(v===2)return Date.parse(y.last)-Date.parse(x.last); return y.n-x.n; }); render(); }); }'
+'    else sel.remove(); });'
+'  var more=qa(".filter-strip .adm-btn").filter(function(b){return /more/i.test(b.textContent);})[0]; if(more)more.remove();'
// Export CSV is real: it writes the rows on screen
+'  qa(".admin-page-actions .adm-btn").forEach(function(b){ if(!/export/i.test(b.textContent)||b.__lx)return; b.__lx=1;'
+'    b.addEventListener("click",function(){'
+'      var head="wallet,assets_held,xlm_balance,fee_payments,fees_paid_usd,first_seen,last_seen\\n";'
+'      var body=ROWS.map(function(u){ return [u.addr,u.trust==null?"":u.trust,u.xlm==null?"":u.xlm,u.n,u.usd==null?"":u.usd.toFixed(6),u.first,u.last].join(","); }).join("\\n");'
+'      var bl=new Blob([head+body],{type:"text/csv"}), url=URL.createObjectURL(bl);'
+'      var el=document.createElement("a"); el.href=url; el.download="lumoscore-users.csv"; el.click();'
+'      setTimeout(function(){URL.revokeObjectURL(url);},1000); }); });'
+'}'
+'var ASEED=[["LUMOS","GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S"],["USDC","GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"],["AQUA","GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA"],["yXLM","GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55"],["EURC","GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2"],["yUSDC","GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF"]];'
+'var AKEY="lumos.admin.assets";'
+'function aList(){ try{ var v=JSON.parse(localStorage.getItem(AKEY)||"null"); if(v&&v.length)return v; }catch(_){}'
+'  return ASEED.map(function(t){ return {code:t[0],iss:t[1]}; }); }'
+'function aSave(l){ try{ localStorage.setItem(AKEY,JSON.stringify(l)); }catch(_){} }'
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
+'function paintAssets(){'
+'  var t=(q(".admin-page-title")||{}).textContent||""; if(!/^\\s*Assets/.test(t))return;'
+'  var tbl=q(".adm-table"); if(!tbl||tbl.getAttribute("data-lxbuilt")==="1")return; tbl.setAttribute("data-lxbuilt","1");'
+'  var TH=["Asset","Issuer domain","Price","24h","7d","Volume (7d)","Trustlines","Actions"];'
+'  var thr=tbl.querySelector("thead tr");'
+'  if(thr)thr.innerHTML=TH.map(function(h,i){ return "<th"+(i>1?" style=\\"text-align:right\\"":"")+">"+esc(h)+"</th>"; }).join("");'
+'  var tb=tbl.querySelector("tbody");'
+'  var seg=q(".seg-row"); if(seg)seg.innerHTML="<button class=\\"seg-chip active\\" type=\\"button\\"><span class=\\"seg-label\\">Listed assets</span><span class=\\"seg-count\\" id=\\"lxaAll\\">\u2014</span></button>";'
+'  var head=q(".admin-page-head");'
+'  if(head&&!q(".lxadm-note")){ var nt=document.createElement("div"); nt.className="lxadm-note";'
+'    nt.textContent="LumosCore talks to the Stellar DEX directly and does not curate a token list, so there is no server-side asset table. This is a list you maintain: it is stored in THIS BROWSER until there is a backend, and it seeds with the assets LumosCore already uses. Every figure on a row is live from the chain.";'
+'    head.parentNode.insertBefore(nt, head.nextSibling); }'
+'  var LIST=aList(), DATA={};'
+'  function key(a){ return a.code+"-"+a.iss; }'
+'  function kpis(){'
+'    var vals=LIST.map(function(a){ return DATA[key(a)]; }).filter(Boolean);'
+'    var vol=0, priced=0, live=0;'
+'    vals.forEach(function(v){ vol+=v.vol7d||0; if(v.price)priced++; if(v.vol7d>0)live++; });'
+'    var cards=qa(".kpi-grid .kpi");'
+'    function set(i,label,val,foot){ var c=cards[i]; if(!c)return;'
+'      var l=c.querySelector(".kpi-label"); if(l)setT(l,label);'
+'      setT(c.querySelector(".kpi-value"),val);'
+'      var f=c.querySelector(".kpi-foot"); if(f){ f.innerHTML=""; f.textContent=foot; } }'
+'    set(0,"Listed assets",String(LIST.length),"in your list");'
+'    set(1,"Traded in last 7d",String(live),live===LIST.length?"all of them":"had DEX volume");'
+'    set(2,"With a spot price",String(priced),"priced on the DEX");'
+'    priceUsd("XLM","",function(px){ set(3,"Combined 7d volume", px?usd(vol*px):num(vol)+" XLM","across listed assets"); });'
+'    setT(q("#lxaAll"),String(LIST.length)); fixPager(LIST.length);'
+'    var sub=q(".admin-page-sub"); if(sub)sub.innerHTML="Assets you list on LumosCore \u00b7 <span class=\\"mono\\">"+LIST.length+"</span> total"; }'
+'  function render(){ if(!tb)return;'
+'    var qy=((q(".fs-search input")||{}).value||"").trim().toLowerCase();'
+'    var list=LIST.filter(function(a){ return !qy || (a.code+" "+a.iss+" "+((DATA[key(a)]||{}).domain||"")).toLowerCase().indexOf(qy)>=0; });'
+'    if(!list.length){ tb.innerHTML="<tr><td colspan=\\""+TH.length+"\\" class=\\"lxadm-empty\\">"+(LIST.length?"No asset matches that search.":"Your list is empty. Use \u201cAdd asset\u201d to list one.")+"</td></tr>"; return; }'
+'    tb.innerHTML=list.map(function(a){ var v=DATA[key(a)], k=key(a);'
+'      if(v===null)return "<tr><td colspan=\\""+TH.length+"\\" style=\\"color:var(--text-muted)\\">"+esc(a.code)+" \u2014 not found on mainnet</td></tr>";'
+'      var load=!v;'
+'      return "<tr>"'
+'        +"<td><div class=\\"asset-cell\\"><img class=\\"lxa-ico\\" data-lxc=\\""+esc(a.code)+"\\" alt=\\"\\" src=\\""+((v&&v.img)||avatar(a.code))+"\\">"'
+'        +"<div><div class=\\"asset-name\\">"+esc(a.code)+((v&&v.name&&v.name!==a.code)?" <span style=\\"font-weight:500;color:var(--text-muted);font-size:13.5px\\">"+esc(v.name)+"</span>":"")+"</div>"'
+'        +"<div class=\\"asset-sub mono\\">"+esc(shortG(a.iss))+"</div></div></div></td>"'
+'        +"<td>"+(load?"\u2026":(v.domain?("<a class=\\"lxadm-link\\" target=\\"_blank\\" rel=\\"noopener\\" href=\\"https://"+esc(v.domain)+"\\">"+esc(v.domain)+"</a>"):"<span style=\\"color:var(--text-muted)\\">no home domain</span>"))+"</td>"'
+'        +"<td class=\\"num-cell\\" style=\\"text-align:right\\">"+(load?"\u2026":(v.price?esc(usd(v.price)):"<span style=\\"color:var(--text-muted)\\">\u2014</span>"))+"</td>"'
+'        +"<td style=\\"text-align:right\\">"+(load?"\u2026":pct(v.d1))+"</td>"'
+'        +"<td style=\\"text-align:right\\">"+(load?"\u2026":pct(v.d7))+"</td>"'
+'        +"<td class=\\"num-cell\\" style=\\"text-align:right\\">"+(load?"\u2026":esc(num(Math.round(v.vol7d))+" XLM"))+"</td>"'
+'        +"<td class=\\"num-cell\\" style=\\"text-align:right\\" title=\\""+(v?esc(v.funded+" funded"):"")+"\\">"+(load?"\u2026":esc(num(v.trust)))+"</td>"'
+'        +"<td style=\\"text-align:right\\"><span class=\\"row-act\\">"'
+'        +"<a class=\\"row-act-btn\\" title=\\"Open asset page\\" href=\\"lumoscore-dex-asset.html?asset="+esc(k)+"\\">\u2197</a>"'
+'        +"<button class=\\"row-act-btn\\" type=\\"button\\" title=\\"Remove from list\\" data-lxrm=\\""+esc(k)+"\\">\u00d7</button>"'
+'        +"</span></td></tr>"; }).join("");'
+'    qa("[data-lxrm]").forEach(function(b){ if(b.__lx)return; b.__lx=1;'
+'      b.addEventListener("click",function(){ var k=b.getAttribute("data-lxrm");'
+'        LIST=LIST.filter(function(a){ return key(a)!==k; }); aSave(LIST); render(); kpis(); }); }); }'
+'  function load(a){ var k=key(a); if(DATA[k]!==undefined)return;'
+'    aInfo(a.code,a.iss,function(v){ DATA[k]=v; render(); kpis(); }); }'
+'  render(); kpis(); LIST.forEach(load);'
+'  var si=q(".fs-search input"); if(si){ si.placeholder="Search by code, issuer or domain\u2026"; si.addEventListener("input",render); }'
+'  qa(".filter-strip .fs-select").forEach(function(sel,i){'
+'    if(i===0){ sel.innerHTML="<option>Sort: 7d volume</option><option>Sort: Trustlines</option><option>Sort: Code</option>";'
+'      sel.addEventListener("change",function(){ var m=sel.selectedIndex;'
+'        LIST.sort(function(x,y){ var a=DATA[key(x)]||{}, b=DATA[key(y)]||{};'
+'          if(m===1)return (b.trust||0)-(a.trust||0);'
+'          if(m===2)return x.code.localeCompare(y.code);'
+'          return (b.vol7d||0)-(a.vol7d||0); }); aSave(LIST); render(); }); }'
+'    else sel.remove(); });'
+'  var more=qa(".filter-strip .adm-btn").filter(function(b){return /more/i.test(b.textContent);})[0]; if(more)more.remove();'
// ---- Add asset: verified against Horizon before anything is written ----
+'  qa(".admin-page-actions .adm-btn").forEach(function(b){'
+'    if(/export/i.test(b.textContent)&&!b.__lx){ b.__lx=1; b.addEventListener("click",function(){'
+'      var hd="code,issuer,domain,price_usd,change_24h,change_7d,volume_7d_xlm,trustlines\\n";'
+'      var bd=LIST.map(function(a){ var v=DATA[key(a)]||{};'
+'        return [a.code,a.iss,v.domain||"",v.price||"",v.d1==null?"":v.d1.toFixed(4),v.d7==null?"":v.d7.toFixed(4),v.vol7d==null?"":Math.round(v.vol7d),v.trust||""].join(","); }).join("\\n");'
+'      var bl=new Blob([hd+bd],{type:"text/csv"}), u=URL.createObjectURL(bl);'
+'      var el=document.createElement("a"); el.href=u; el.download="lumoscore-assets.csv"; el.click();'
+'      setTimeout(function(){URL.revokeObjectURL(u);},1000); }); }'
+'    if(!/add asset/i.test(b.textContent)||b.__lxa)return; b.__lxa=1;'
+'    b.addEventListener("click",function(){'
+'      if(q(".lxmodal"))return;'
+'      var m=document.createElement("div"); m.className="lxmodal";'
+'      m.innerHTML="<div class=\\"lxmodal-box\\"><h3 class=\\"lxmodal-t\\">Add asset</h3>"'
+'        +"<p class=\\"lxmodal-s\\">A ticker is not an identity on Stellar \u2014 hundreds of assets share the code USDC. Give the issuer too. The asset is checked against Horizon before it is added.</p>"'
+'        +"<label class=\\"lxmodal-l\\" for=\\"lxaCode\\">Asset code</label><input class=\\"lxmodal-i\\" id=\\"lxaCode\\" placeholder=\\"USDC\\" maxlength=\\"12\\">"'
+'        +"<label class=\\"lxmodal-l\\" for=\\"lxaIss\\">Issuer account</label><input class=\\"lxmodal-i\\" id=\\"lxaIss\\" placeholder=\\"G\u2026\\" maxlength=\\"56\\">"'
+'        +"<p class=\\"lxmodal-e\\" id=\\"lxaErr\\"></p>"'
+'        +"<div class=\\"lxmodal-a\\"><button class=\\"adm-btn ghost\\" type=\\"button\\" id=\\"lxaCancel\\">Cancel</button>"'
+'        +"<button class=\\"adm-btn primary\\" type=\\"button\\" id=\\"lxaOk\\">Verify &amp; add</button></div></div>";'
+'      document.body.appendChild(m);'
+'      var ci=m.querySelector("#lxaCode"), ii=m.querySelector("#lxaIss"), er=m.querySelector("#lxaErr");'
+'      ci.focus();'
+'      function close(){ m.remove(); }'
+'      m.addEventListener("click",function(e){ if(e.target===m)close(); });'
+'      m.querySelector("#lxaCancel").addEventListener("click",close);'
+'      m.querySelector("#lxaOk").addEventListener("click",function(){'
+'        var code=(ci.value||"").trim(), iss=(ii.value||"").trim().toUpperCase();'
+'        er.textContent="";'
+'        if(!/^[A-Za-z0-9]{1,12}$/.test(code)){ er.textContent="Asset code must be 1\u201312 letters or digits."; return; }'
+'        if(!/^G[A-Z2-7]{55}$/.test(iss)){ er.textContent="Issuer must be a 56-character Stellar account starting with G."; return; }'
+'        if(LIST.some(function(a){ return a.code===code&&a.iss===iss; })){ er.textContent="That asset is already in your list."; return; }'
+'        var ok=m.querySelector("#lxaOk"); ok.disabled=true; ok.textContent="Checking\u2026";'
+'        j(H+"/assets?asset_code="+encodeURIComponent(code)+"&asset_issuer="+encodeURIComponent(iss)+"&limit=1").then(function(d){'
+'          var r=d&&d._embedded&&d._embedded.records&&d._embedded.records[0];'
+'          ok.disabled=false; ok.textContent="Verify & add";'
+'          if(!r){ er.textContent="No such asset on Stellar mainnet. Check the code and issuer."; return; }'
+'          LIST.push({code:code,iss:iss}); aSave(LIST); DATA[code+"-"+iss]=undefined;'
+'          close(); render(); kpis(); load({code:code,iss:iss}); }); }); }); });'
+'}'
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
+'    mobKpis([["lxmaN","Listed","in your list"],["lxmaV","7d volume","across listed"]]);'
+'    mobNote("LumosCore does not curate a token list, so there is no server-side asset table. This is a list you maintain \u2014 stored in this browser until there is a backend. Every figure on a row is live from the chain.");'
+'    var maseg=q(".mob-seg-row"); if(maseg)maseg.innerHTML="<button class=\\"mob-seg-chip active\\" type=\\"button\\"><span class=\\"sc-label\\">Listed</span><span class=\\"sc-count\\" id=\\"lxmaSeg\\">\\u2014</span></button>";'
+'    var mai=q(".mob-filter-bar input"); if(mai)mai.placeholder="Search by code or issuer…";'
+'    var LIST=aList(), D={};'
+'    setT(q("#lxmaN"),String(LIST.length)); setT(q("#lxmaSeg"),String(LIST.length)); fixPager(LIST.length);'
+'    var sub2=q(".mob-page-sub"); if(sub2)sub2.innerHTML="<span class=\\"mono\\">"+LIST.length+"</span> listed assets";'
+'    function draw(){ abox.innerHTML=LIST.map(function(a){ var v=D[a.code+"-"+a.iss], ld=!v;'
+'      return "<a class=\\"lxm-card\\" href=\\"lumoscore-dex-asset-mobile.html?asset="+esc(a.code+"-"+a.iss)+"\\">"'
+'        +"<div class=\\"lxm-top\\"><img class=\\"lxm-av\\" data-lxc=\\""+esc(a.code)+"\\" alt=\\"\\" src=\\""+((v&&v.img)||avatar(a.code))+"\\">"'
+'        +"<div><div class=\\"lxm-name\\">"+esc(a.code)+"</div><div class=\\"lxm-sub\\">"+(ld?"\u2026":esc(v.domain||"no home domain"))+"</div></div>"'
+'        +"<div class=\\"lxm-right\\">"+(ld?"\u2026":(v.price?esc(usd(v.price)):"\u2014"))+"</div></div>"'
+'        +"<div class=\\"lxm-stats\\"><div><div class=\\"lxm-sl\\">24h</div><div class=\\"lxm-sv\\">"+(ld?"\u2026":pct(v.d1))+"</div></div>"'
+'        +"<div><div class=\\"lxm-sl\\">7d vol</div><div class=\\"lxm-sv\\">"+(ld?"\u2026":esc(num(Math.round(v.vol7d))))+"</div></div>"'
+'        +"<div><div class=\\"lxm-sl\\">Trustlines</div><div class=\\"lxm-sv\\">"+(ld?"\u2026":esc(num(v.trust)))+"</div></div></div></a>"; }).join(""); }'
+'    draw();'
+'    var vol=0;'
+'    LIST.forEach(function(a){ aInfo(a.code,a.iss,function(v){ D[a.code+"-"+a.iss]=v; if(v)vol+=v.vol7d||0; draw();'
+'      priceUsd("XLM","",function(px){ setT(q("#lxmaV"), px?usd(vol*px):num(Math.round(vol))+" XLM"); }); }); });'
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
+'function boot(){ try{ paintRevenue(); }catch(e){} try{ wireCsv(); }catch(e){} try{ paintDashboard(); }catch(e){} try{ paintDashPanels(); }catch(e){} try{ paintDashRow3(); }catch(e){} try{ paintUsers(); }catch(e){} try{ paintAssets(); }catch(e){} try{ paintMobile(); }catch(e){} try{ paintProfile(); }catch(e){} try{ paintNoBackend(); }catch(e){} }'
+'if(document.readyState!=="loading")boot(); else document.addEventListener("DOMContentLoaded",boot);'
+'})();</'+'script>';

// ---- sidebar entry -----------------------------------------------------------------------------------
const REV_ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';
function revItem(active,suffix){ return '<a class="adn-item '+(active?'active':'')+'" href="lumoscore-admin-revenue'+suffix+'.html" data-tip="Revenue">\n      '+REV_ICON+'\n      <span class="adn-label">Revenue</span>\n    </a>\n    '; }

function variantOf(key){ if(/-dark\.html$/.test(key))return '-dark'; if(/-mobile\.html$/.test(key))return '-mobile'; return ''; }

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
      h=h.replace(/<a class="adn-item [^"]*" href="lumoscore-admin-revenue[^"]*"[\s\S]*?<\/a>\s*/g,'');   // strip old
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
        const MAP={Assets:'assets',Support:'support',Blogs:'blogs','Create pool':'create-pool','Create Pool':'create-pool'};
        h=h.replace(/<a class="(mob-menu-item[^"]*)" href="#">([\s\S]*?)<\/a>/g,(full,cls,inner)=>{
          const m2=inner.match(/<span>([^<]+)<\/span>/);
          const key=m2&&MAP[m2[1].trim()];
          // no admin page exists behind Trades / Pools / LUMOS Incentives, so drop them rather
          // than leave a menu entry that goes nowhere
          return key ? '<a class="'+cls+'" href="lumoscore-admin-'+key+'-mobile.html">'+inner+'</a>' : '';
        });
      }
      const bi=h.lastIndexOf('</body>');
      if(bi>=0) h=h.slice(0,bi)+CSS+SCRIPT+h.slice(bi);
      json[k]=h; changed=true; pages++;
    }

    if(changed){ const ser=JSON.stringify(json).split('</').join('<'+B+'/'); fs.writeFileSync(file,data.slice(0,s)+ser+data.slice(e),'utf8'); }
  }
}
console.log('admin: Revenue page created on '+made+' variant(s); sidebar + real-data layer on '+pages+' admin page keys');
