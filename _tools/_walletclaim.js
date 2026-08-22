// Claimable payments on the wallet page, and a tab to reach them.
//
// WHAT A CLAIMABLE BALANCE IS, and why it deserves its own place: on Stellar you can be SENT money you
// have not received yet. The sender locks it into a claimable balance addressed to you, and it sits on
// the ledger until you sign for it. It is the mechanism behind airdrops, escrowed payouts, and any
// payment to someone without the right trustline. The wallet had no surface for it at all -- money
// genuinely addressed to the reader, invisible on the page that exists to show their money.
//
// The Liquidity Pools card it replaces was the weakest of the three: the Pools section already shows
// positions in far more detail, and the card duplicated a number the reader can reach in one tap.
//
// TABS, NOT CARDS. Two lists that are both "things waiting on you" belong in one panel with a switch,
// not two summary cards that each lead somewhere else. The count lives on the tab, which is what a
// summary card was really for.
//
// A CLAIM IS A SIGNED TRANSACTION, and it may need two operations rather than one: claiming a
// non-native asset requires a trustline for it, and someone receiving an asset for the first time by
// definition does not have one. Both go in the same transaction, so it is still a single signature.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const STYLE = `<style id="lx-wclaim-css">
/* #5: these tabs used to carry their own look -- pill buttons with a rounded count badge -- and sat
   directly above the design's Assets / Liq Pools tabs, which are a different shape, a different badge
   and a different active treatment. Two tab bars, one screen, two visual languages.
   So they are not styled here at all any more. The markup below reuses the design's own .asset-tabs
   wrapper, its plain <button>, its .active state and its .cnt badge, which makes them the same control
   by construction rather than by a copy of its numbers that would drift the next time the design moves.
   Only the spacing below the bar is ours. */
.lx-wctabs{margin:0 0 14px}
.lx-wcpanel[hidden]{display:none}

.lx-wclist{background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;
  margin-bottom:32px}
.lx-wcrow{display:flex;align-items:center;gap:14px;padding:14px 18px;border-bottom:1px solid var(--border)}
.lx-wcrow:last-child{border-bottom:0}
/* #6: the asset disc. --lxlogo is set inline -- a real logo when we have one, otherwise a flat colour
   derived from the code, with the initial drawn over it by ::after. data-lxc/data-lxi opt this element
   INTO the shared resolver in _walletdata.js, which replaces --lxlogo in place once a toml logo turns up,
   so a row never has to be rebuilt to gain its picture. */
.lx-wcico{width:30px;height:30px;flex:0 0 30px;border-radius:50%;position:relative;overflow:hidden;
  background-image:var(--lxlogo,none);background-size:cover;background-position:center;
  background-repeat:no-repeat;background-color:var(--surface-2)}
.lx-wcico::after{content:attr(data-l);position:absolute;inset:0;display:flex;align-items:center;
  justify-content:center;color:#fff;font:800 12.5px/1 inherit;pointer-events:none}
/* Once a real picture is in, the initial would sit on top of it. The resolver blanks data-l when it
   paints, so this only ever hides a letter that has been deliberately cleared. */
.lx-wcico[data-l=""]::after{content:none}
.lx-wcmain{flex:1 1 auto;min-width:0}
.lx-wcamt{font:800 15px/1.2 'JetBrains Mono',monospace;color:var(--text)}
.lx-wcsub{margin-top:3px;font-size:12.5px;color:var(--text-soft);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lx-wcbtn{flex:0 0 auto;height:34px;padding:0 15px;border-radius:10px;border:0;color:#fff;cursor:pointer;
  font:800 12.5px/1 inherit;background:linear-gradient(135deg,var(--accent,#ea6a2c),#c1440a);
  box-shadow:0 4px 14px -6px rgba(234,106,44,.85);transition:filter .14s ease,transform .14s ease}
.lx-wcbtn:hover:not(:disabled){filter:brightness(1.05);transform:translateY(-1px)}
.lx-wcbtn:disabled{opacity:.6;cursor:default;box-shadow:none;transform:none}
/* A balance whose predicate has not opened yet is shown, not hidden -- knowing it is coming is the
   point -- but it cannot be claimed, and the row says why rather than failing at the wallet. */
.lx-wcrow.locked .lx-wcamt{color:var(--text-soft)}
.lx-wcnote{padding:22px 18px;text-align:center;font-size:13.5px;color:var(--text-muted)}
@media(max-width:620px){
.lx-wcrow{padding:13px 14px;gap:10px}
.lx-wcbtn{height:32px;padding:0 12px}
}
</style>`;

const SCRIPT = `<script id="lx-wclaim">(function(){
  if(window.__lxWClaim)return; window.__lxWClaim=1;
  var H="https://horizon.stellar.org";
  function me(){ try{ return localStorage.getItem("lumos.address")||""; }catch(_){ return ""; } }
  function j(u){ return fetch(u).then(function(r){ if(!r.ok)throw new Error(r.status); return r.json(); }); }
  function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){
    return c==="&"?"&amp;":c==="<"?"&lt;":c===">"?"&gt;":"&quot;"; }); }
  function amt(n){ n=+n||0; if(n>=1000)return n.toLocaleString("en-US",{maximumFractionDigits:2});
    if(n>=1)return String(+n.toFixed(4)); return String(+n.toFixed(7)); }
  function shortG(a){ a=String(a||""); return a.length>12?(a.slice(0,4)+"\\u2026"+a.slice(-4)):a; }
  function ago(t){ var s=Math.max(0,(Date.now()-new Date(t).getTime())/1000);
    if(s<3600)return Math.floor(s/60)+"m ago"; if(s<86400)return Math.floor(s/3600)+"h ago";
    return Math.floor(s/86400)+"d ago"; }
  function say(m){ try{ if(window.lxToast)window.lxToast(m); }catch(_){} }

  // Horizon writes an asset as "native" or "CODE:ISSUER".
  function parseAsset(a){
    if(!a||a==="native")return {code:"XLM",issuer:"",native:true};
    var p=String(a).split(":"); return {code:p[0],issuer:p[1]||"",native:false};
  }

  // Is this predicate open RIGHT NOW? Stellar predicates nest, so this walks them. Anything it does
  // not recognise is treated as claimable and left to the network to refuse -- the ledger is the
  // authority here, and refusing to offer a claim we could have made is the worse error.
  function open(p){
    if(!p)return true;
    if(p.unconditional)return true;
    var now=Date.now();
    if(p.abs_before)return now < new Date(p.abs_before).getTime();
    if(p.abs_before_epoch)return now < (+p.abs_before_epoch*1000);
    if(p.rel_before)return true;                       // relative to close time; not knowable here
    if(p.not)return !open(p.not);
    if(p.and&&p.and.length)return p.and.every(open);
    if(p.or&&p.or.length)return p.or.some(open);
    return true;
  }
  function mine(rec,addr){
    var cs=(rec&&rec.claimants)||[];
    for(var i=0;i<cs.length;i++)if(cs[i].destination===addr)return cs[i];
    return null;
  }

  // NEVER claimable is not the same as NOT YET, and only the second is worth a row. Checked against
  // real data: the dICE airdrops list thousands of accounts as claimants with the predicate
  // {"not":{"unconditional":true}} -- the senders reclaim clause, which can never be true for the
  // recipient. Listing fifty of those as "Locked" would bury a real pending payment under noise, and
  // offering a Claim button on one would be worse: it can only ever fail.
  function never(p){
    if(!p)return false;
    if(p.not)return !!p.not.unconditional;
    if(p.and&&p.and.length)return p.and.some(never);
    if(p.or&&p.or.length)return p.or.every(never);
    return false;
  }
  var CB=[], loaded=false;
  function load(){
    var addr=me(); if(!addr)return Promise.resolve([]);
    return j(H+"/claimable_balances?claimant="+addr+"&limit=50&order=desc")
      .then(function(d){ var all=((d&&d._embedded&&d._embedded.records)||[]);
        CB=all.filter(function(r){ var c2=mine(r,addr); return c2&&!never(c2.predicate); });
        loaded=true; return CB; })
      .catch(function(){ loaded=true; CB=[]; return CB; });
  }

  // Same palette and same hash as the wallet's own fallback discs, borrowed from _walletdata.js when it
  // is on the page so the two can never drift, with a local copy for the case where it is not.
  var WCCOL=["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#06b6d4","#ef4444","#84cc16"];
  function wcCol(s){ try{ if(window.__lxColFor)return window.__lxColFor(s); }catch(_){}
    var h=0; s=String(s||""); for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0; return WCCOL[h%WCCOL.length]; }
  function xlmLogo(a){ return a.native?"/assets/tokens/xlm.png":""; }
  // Borrowed from _walletdata.js when it is on the page, so the two lists cannot diverge; the local
  // copy is the same markup and is only reached if that script is absent.
  function meta(a){
    if(a.native||!a.code||!a.issuer)return "";
    try{ if(window.__lxAssetMeta)return window.__lxAssetMeta(a.code,a.issuer,false); }catch(_){}
    return '<span class="lx-ameta"><span class="lx-hd" data-hd="'+esc(a.issuer)+'"></span>'
      +'<a class="lx-vasset" href="/trade/stellar/'+encodeURIComponent(a.code)+'-'+encodeURIComponent(a.issuer)+'">View asset</a></span>';
  }

  function rows(){
    var addr=me();
    if(!CB.length){
      return '<div class="lx-wcnote">'+(loaded
        ? "Nothing is waiting to be claimed. Payments sent to you as a claimable balance will appear here."
        : "Looking for claimable payments\\u2026")+'</div>';
    }
    return CB.map(function(r){
      var a=parseAsset(r.asset), c=mine(r,addr), ok=open(c&&c.predicate);
      var who=r.sponsor?("from "+shortG(r.sponsor)):"";
      var when=r.last_modified_time?ago(r.last_modified_time):"";
      var sub=[who,when].filter(Boolean).join(" \\u00b7 ");
      // #6: the same disc every other list on this page uses. data-lxc/data-lxi are what the shared
      // resolver in _walletdata.js reads -- it checks its cache, then looks the issuer up on
      // stellar.expert for a toml logo, then paints --lxlogo. Until (or unless) that answers, the disc
      // is a deterministic colour from the code with its initial on it, which is the site's existing
      // fallback rather than a second invention. XLM is local and needs no lookup.
      var _lg=xlmLogo(a);
      var _ic='<span class="lx-wcico"'
        +(a.native?'':(' data-lxc="'+esc(a.code)+'" data-lxi="'+esc(a.issuer)+'"'))
        +' data-l="'+esc(a.code.slice(0,1).toUpperCase())+'"'
        +' style="'+(_lg?('--lxlogo:url('+_lg+')')
                        :('--lxlogo:linear-gradient('+wcCol(a.code+a.issuer)+','+wcCol(a.code+a.issuer)+')'))+'"></span>';
      return '<div class="lx-wcrow'+(ok?"":" locked")+'" data-cb="'+esc(r.id)+'"'
        +' data-code="'+esc(a.code)+'" data-iss="'+esc(a.issuer)+'" data-nat="'+(a.native?"1":"0")+'">'
        +_ic
        +'<div class="lx-wcmain"><div class="lx-wcamt">'+amt(r.amount)+' '+esc(a.code)+'</div>'
        +'<div class="lx-wcsub">'+esc(sub||"claimable balance")+'</div>'
        // #3: same provenance line as the open orders -- the issuer's home domain, resolved after the
        // row is on screen by the shared lxFillHd, plus a way through to the asset's own page. A code
        // on its own says nothing about who issued it.
        +meta(a)
        +'</div>'
        +(ok?'<button class="lx-wcbtn" type="button">Claim</button>'
            :'<button class="lx-wcbtn" type="button" disabled title="This balance is not claimable yet">Locked</button>')
        +'</div>';
    }).join("");
  }

  function paint(){
    var panel=document.querySelector(".lx-wcpanel-claim");
    if(panel)panel.innerHTML='<div class="lx-wclist">'+rows()+'</div>';
    var tab=document.querySelector('.lx-wctab[data-t="claim"] .cnt');
    if(tab)tab.textContent=String(CB.length);
    // These rows arrive after their own Horizon fetch, which normally lands after _walletdata.js has
    // finished its timed heal passes -- so ask for one now rather than hoping to be in time for theirs.
    try{ if(panel&&window.__lxHealLogos)window.__lxHealLogos(panel); }catch(_){}
    try{ if(panel&&window.__lxFillHd)window.__lxFillHd(panel); }catch(_){}
  }

  function claim(btn){
    var row=btn.closest(".lx-wcrow"); if(!row)return;
    var id=row.getAttribute("data-cb"), code=row.getAttribute("data-code"),
        iss=row.getAttribute("data-iss"), nat=row.getAttribute("data-nat")==="1";
    if(!window.lxStellar||!window.lxSign){ say("Wallet not ready \\u2014 reload and try again"); return; }
    btn.disabled=true; var lbl=btn.textContent; btn.textContent="Confirm in wallet\\u2026";
    var addr=me();
    window.lxStellar().then(function(S){
      return j(H+"/accounts/"+addr).then(function(acc){
        var PP=S.Networks.PUBLIC;
        var tb=new S.TransactionBuilder(new S.Account(addr,acc.sequence),{fee:"1000",networkPassphrase:PP});
        // A claim of a non-native asset needs a trustline for it, and someone receiving an asset for
        // the first time does not have one. Same transaction, so it is still one signature.
        if(!nat){
          var has=(acc.balances||[]).some(function(b){
            return b.asset_code===code&&b.asset_issuer===iss; });
          if(!has)tb.addOperation(S.Operation.changeTrust({asset:new S.Asset(code,iss)}));
        }
        tb.addOperation(S.Operation.claimClaimableBalance({balanceId:id}));
        var tx=tb.setTimeout(180).build();
        var p=window.lxSign(tx.toXDR(),S);
        if(window.lxTimeout)p=window.lxTimeout(p,150000,"Signing timed out \\u2014 open your wallet and try again");
        return p.then(function(signed){
          if(!signed)throw new Error("Signing cancelled");
          btn.textContent="Submitting\\u2026";
          return fetch(H+"/transactions",{method:"POST",
            headers:{"Content-Type":"application/x-www-form-urlencoded"},
            body:"tx="+encodeURIComponent(signed)}).then(function(r){ return r.json(); });
        });
      });
    }).then(function(res){
      if(res&&(res.successful||res.hash)){
        btn.textContent="Claimed \\u2713";
        say("Claimed "+row.querySelector(".lx-wcamt").textContent);
        // Gone from the ledger, so gone from the list -- and the balances above are now wrong.
        CB=CB.filter(function(x){ return x.id!==id; });
        setTimeout(function(){ paint(); },900);
        setTimeout(function(){ try{ location.reload(); }catch(_){} },1600);
        return;
      }
      var x=res&&res.extras&&res.extras.result_codes;
      throw new Error(x?JSON.stringify(x):"Claim failed");
    }).catch(function(e){
      btn.disabled=false; btn.textContent=lbl;
      say("Claim failed \\u2014 "+((e&&e.message)||e));
    });
  }

  function select(which){
    var tabs=document.querySelectorAll(".lx-wctab");
    for(var i=0;i<tabs.length;i++)tabs[i].classList.toggle("active",tabs[i].getAttribute("data-t")===which);
    var o=document.querySelector(".lx-wcpanel-orders"), c=document.querySelector(".lx-wcpanel-claim");
    if(o){ if(which==="orders")o.removeAttribute("hidden"); else o.setAttribute("hidden",""); }
    if(c){ if(which==="claim")c.removeAttribute("hidden"); else c.setAttribute("hidden",""); }
    try{ localStorage.setItem("lumos.wcTab",which); }catch(_){}
  }

  function build(){
    // #8 (batch 5): the phone wraps these cards in .insights-stack and the DESKTOP wraps the same
    // three in .insights-rail. Keying on the phone name meant the tabs only ever appeared on a phone.
    var stack=document.querySelector(".insights-stack,.insights-rail");
    if(!stack||document.querySelector(".lx-wctabs"))return false;
    // The two cards this replaces, found by what they SAY rather than by position -- the stack is
    // rebuilt by the page and the order is not ours to rely on.
    var cards=[].slice.call(stack.querySelectorAll(".insight-card"));
    var ordersCard=null, poolsCard=null;
    cards.forEach(function(c){
      var t=((c.querySelector(".ttl")||{}).textContent||"").trim();
      if(/open orders/i.test(t))ordersCard=c;
      if(/liquidity pools/i.test(t))poolsCard=c;
    });
    if(!ordersCard&&!poolsCard)return false;
    var nOrders="0";
    if(ordersCard){
      var hl=((ordersCard.querySelector(".headline")||{}).textContent||"").match(/\\d+/);
      if(hl)nOrders=hl[0];
    }
    if(ordersCard)ordersCard.style.display="none";
    if(poolsCard)poolsCard.style.display="none";

    var bar=document.createElement("div");
    bar.className="asset-tabs-row lx-wctabs";
    bar.innerHTML='<div class="asset-tabs">'
      +'<button class="lx-wctab active" type="button" data-t="orders">Open orders'
      +' <span class="cnt">'+nOrders+'</span></button>'
      +'<button class="lx-wctab" type="button" data-t="claim">Claimable payments'
      +' <span class="cnt">0</span></button>'
      +'</div>';

    // The orders list the page already builds becomes the first panel; the second is ours.
    var orders=document.querySelector(".orders-block");
    var host=orders?orders.parentNode:stack.parentNode;
    var anchor=orders||stack.nextSibling;

    var pOrders=document.createElement("div"); pOrders.className="lx-wcpanel lx-wcpanel-orders";
    var pClaim=document.createElement("div"); pClaim.className="lx-wcpanel lx-wcpanel-claim";
    pClaim.setAttribute("hidden","");

    host.insertBefore(bar,anchor);
    host.insertBefore(pOrders,anchor);
    if(orders)pOrders.appendChild(orders);
    else pOrders.innerHTML='<div class="lx-wclist"><div class="lx-wcnote">No open orders.</div></div>';
    host.insertBefore(pClaim,pOrders.nextSibling);

    paint();
    try{ var last=localStorage.getItem("lumos.wcTab"); if(last==="claim")select("claim"); }catch(_){}
    return true;
  }

  document.addEventListener("click",function(e){
    var t=e.target; if(!t||!t.closest)return;
    var tab=t.closest(".lx-wctab");
    if(tab){ e.preventDefault(); select(tab.getAttribute("data-t")); return; }
    var b=t.closest(".lx-wcbtn");
    if(b&&!b.disabled){ e.preventDefault(); e.stopPropagation(); claim(b); }
  },true);

  function boot(){
    if(!me())return;
    // The insights stack and the orders block are both built by the page's own data layer, so this
    // waits for them rather than assuming they exist yet.
    var n=0,iv=setInterval(function(){ if(build()||++n>40)clearInterval(iv); },250);
    load().then(paint);
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
    p = p.replace(/<style id="lx-wclaim-css">[\s\S]*?<\/style>/, '')
         .replace(/<script id="lx-wclaim">[\s\S]*?<\/script>/, '');
    // the wallet page only, identified by its own insights stack
    // Same reason as the runtime lookup above: the two layouts name the wrapper differently, and the
    // desktop page was therefore never injected at all.
    if ((p.indexOf('insights-stack') >= 0 || p.indexOf('insights-rail') >= 0) && p.indexOf('hero-id-row') >= 0) {
      if (p.indexOf('</head>') >= 0) p = p.replace('</head>', STYLE + '</head>');
      const bi = p.lastIndexOf('</body>');
      if (bi >= 0) { p = p.slice(0, bi) + SCRIPT + p.slice(bi); pages++; }
    }
    if (p !== before) { json[k] = p; changed = true; }
  }

  if (changed) {
    containers++;
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
console.log('wallet claimable payments on ' + pages + ' page keys across ' + containers + ' containers');
