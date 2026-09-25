// The MCP playground: a section on /mcp that runs the real tools in front of you.
//
// WHY IT EXISTS. The page could describe twelve tools forever and still not answer "so what?". RAZA's
// own challenge was the right one -- a balance lookup is something an explorer already does in one
// click -- and the honest answer is that the value is in COMPOUND questions. That is a thing to show,
// not to claim.
//
// THE PLAYGROUND IS ITSELF AN MCP CLIENT. Every button here speaks JSON-RPC to POST /mcp on this same
// origin: the exact endpoint an agent connects to, the exact tools, the exact responses. There is no
// backend behind this page and no second code path that could drift from the first. It also means the
// page is a permanent health check -- if the endpoint breaks, the playground visibly breaks with it.
//
// NO MODEL. There is no free-text box, because a text box with nothing behind it fails on the second
// thing anyone types. It would also mean attacker-controlled text -- every asset name on Stellar is
// written by whoever issued it -- flowing into a model on an unauthenticated page.
//
// SAFETY NOTES THAT ARE NOT OPTIONAL HERE:
//   * every value rendered goes in through textContent. Asset codes and descriptions are hostile input.
//   * asset codes are shown as a PAIR ("PEN / XLM"). The site's logo healer repaints any element whose
//     text is 1-5 characters into a ticker badge, and a data-logoed attribute does NOT stop it on a
//     text node (see _adminheader.js). Nine characters is not a ticker.
//   * the full screen is 58 assets x 2 calls and the endpoint allows 240 requests a minute per IP, so
//     the demo runs a labelled subset and offers the full run behind its own button.
//
// RUN ORDER: after _mcp_page.js, which REBUILDS the mcp page key from the wallet template on every run
// and would otherwise throw this away.
// Usage: node _tools/_mcp_page.js && node _tools/_mcpplay.js
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const STYLE = '<style id="lx-mcpplay">'
  + '.lxpg-lead{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 20px}'
  + '.lxpg-chip{display:inline-flex;align-items:center;gap:9px;font:600 13.5px/1 inherit;color:var(--text);'
  + 'background:var(--surface-2);border:1px solid var(--border);border-radius:999px;padding:11px 16px;cursor:pointer;'
  + 'transition:border-color .16s,background .16s,transform .16s}'
  + '.lxpg-chip:hover{border-color:var(--accent);background:var(--accent-soft);transform:translateY(-1px)}'
  + '.lxpg-chip[disabled]{opacity:.5;cursor:default;transform:none}'
  + '.lxpg-chip .n{font:700 10px/1 "JetBrains Mono",monospace;color:var(--accent);background:var(--accent-soft);'
  + 'border-radius:6px;padding:4px 6px}'
  + '.lxpg-grid{display:grid;grid-template-columns:minmax(0,340px) minmax(0,1fr);gap:18px;align-items:stretch}'
  + '.lxpg-panel{background:#0a0a10;border:1px solid rgba(255,255,255,.08);border-radius:16px;overflow:hidden;display:flex;flex-direction:column}'
  + '.lxpg-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 15px;'
  + 'border-bottom:1px solid rgba(255,255,255,.07);font:700 11px/1 "JetBrains Mono",monospace;'
  + 'letter-spacing:.09em;text-transform:uppercase;color:#6a6a74}'
  + '.lxpg-bar .ep{color:var(--accent-2,#ff894c);text-transform:none;letter-spacing:0;font-weight:600}'
  + '.lxpg-body{padding:14px 15px;flex:1;min-height:232px}'
  + '.lxpg-empty{font-size:13.5px;color:#6a6a74;line-height:1.6}'
  + '.lxpg-call{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px dashed rgba(255,255,255,.07)}'
  + '.lxpg-call:last-child{border-bottom:none}'
  + '.lxpg-dot{width:8px;height:8px;border-radius:50%;background:var(--accent);margin-top:6px;flex-shrink:0}'
  + '.lxpg-call.run .lxpg-dot{animation:lxpg-pulse 1s ease-in-out infinite}'
  + '.lxpg-call.err .lxpg-dot{background:#ef4444}'
  + '@keyframes lxpg-pulse{0%,100%{opacity:1}50%{opacity:.25}}'
  + '.lxpg-call .nm{font:700 12.5px/1.4 "JetBrains Mono",monospace;color:var(--text)}'
  + '.lxpg-call .ar{font:500 11.5px/1.5 "JetBrains Mono",monospace;color:#6a6a74;word-break:break-all;margin-top:3px}'
  + '.lxpg-call .ms{margin-left:auto;font:600 11px/1 "JetBrains Mono",monospace;color:#6a6a74;flex-shrink:0;margin-top:5px}'
  + '.lxpg-tbl{width:100%;border-collapse:collapse;font-size:13px}'
  + '.lxpg-tbl th{text-align:left;font:700 10.5px/1 "JetBrains Mono",monospace;letter-spacing:.07em;'
  + 'text-transform:uppercase;color:#6a6a74;padding:0 10px 9px 0;white-space:nowrap}'
  + '.lxpg-tbl td{padding:8px 10px 8px 0;border-top:1px solid rgba(255,255,255,.06);color:var(--text);'
  + 'font-variant-numeric:tabular-nums;white-space:nowrap}'
  + '.lxpg-tbl td.mut{color:#8a8a96}'
  + '.lxpg-pair{font:700 12.5px/1 "JetBrains Mono",monospace;color:var(--text)}'
  + '.lxpg-note{font-size:12.5px;line-height:1.6;color:#8a8a96;margin:12px 0 0}'
  + '.lxpg-kv{display:grid;grid-template-columns:auto 1fr;gap:7px 16px;font-size:13.5px}'
  + '.lxpg-kv dt{color:#8a8a96}.lxpg-kv dd{margin:0;color:var(--text);font-variant-numeric:tabular-nums}'
  + '.lxpg-big{font:800 27px/1.1 "JetBrains Mono",monospace;color:var(--text);letter-spacing:-.02em;margin:0 0 4px}'
  + '.lxpg-sub{font-size:13px;color:#8a8a96;margin:0 0 16px}'
  + '.lxpg-link{display:inline-flex;align-items:center;gap:8px;margin-top:14px;font-weight:700;font-size:13.5px;'
  + 'text-decoration:none;color:#fff;background:var(--accent);padding:11px 17px;border-radius:11px}'
  + '.lxpg-warn{font-size:12.5px;color:#facc15;margin:10px 0 0}'
  + '.lxpg-err{font-size:13px;color:#ef4444;line-height:1.6}'
  + '.lxpg-in{display:flex;gap:9px;flex-wrap:wrap;margin:0 0 14px}'
  + '.lxpg-in input,.lxpg-in select{flex:1;min-width:150px;background:var(--surface-2);border:1px solid var(--border);'
  + 'border-radius:10px;padding:10px 12px;color:var(--text);font:500 13px/1 "JetBrains Mono",monospace}'
  + '.lxpg-in button{background:var(--accent);color:#fff;border:none;border-radius:10px;padding:10px 18px;'
  + 'font-weight:700;font-size:13px;cursor:pointer}'
  + '.lxpg-in button[disabled]{opacity:.55;cursor:default}'
  + '.lxpg-raw{margin:0;padding:13px 15px;background:#07070b;border-radius:12px;max-height:300px;overflow:auto;'
  + 'font:500 11.5px/1.6 "JetBrains Mono",monospace;color:#c7d0e2;white-space:pre-wrap;word-break:break-word}'
  + '.lxpg-exp{margin-top:18px}'
  + '.lxpg-exp summary{cursor:pointer;font-weight:700;font-size:14px;color:var(--text);padding:13px 16px;'
  + 'background:var(--surface-2);border:1px solid var(--border);border-radius:12px;list-style:none}'
  + '.lxpg-exp summary::-webkit-details-marker{display:none}'
  + '.lxpg-exp summary::after{content:" \\203A";color:var(--accent);font-weight:800}'
  + '.lxpg-exp[open] summary{border-bottom-left-radius:0;border-bottom-right-radius:0}'
  + '.lxpg-expbody{border:1px solid var(--border);border-top:none;border-radius:0 0 12px 12px;padding:16px}'
  + '[data-theme="light"] .lxpg-panel{background:#fff;border-color:rgba(0,0,0,.09)}'
  + '[data-theme="light"] .lxpg-raw{background:#f6f6f9;color:#3f3f4a}'
  + '@media(max-width:900px){.lxpg-grid{grid-template-columns:minmax(0,1fr)}}'
  + '</style>';

// Shown as a pair so the logo healer cannot mistake a 3-letter code for a ticker, and because the pair
// is what the number actually refers to: these are all prices against the native asset.
const SCRIPT = '<script id="lx-mcpplay-js">(function(){'
  + 'var EP=location.origin+"/mcp",rid=0;'
  + 'var chipsEl=document.getElementById("lxpgChips"),traceEl=document.getElementById("lxpgTrace"),'
  + 'outEl=document.getElementById("lxpgOut"),busy=false;'
  + 'if(!chipsEl||!traceEl||!outEl)return;'
  + 'function el(t,c,txt){var n=document.createElement(t);if(c)n.className=c;if(txt!=null)n.textContent=String(txt);return n;}'
  + 'function clear(n){while(n.firstChild)n.removeChild(n.firstChild);}'
  + 'function num(v,d){var x=+v;return isFinite(x)?x.toLocaleString(undefined,{maximumFractionDigits:d==null?4:d}):"-";}'
  + 'function sgn(v,d){var x=+v;return (isFinite(x)&&x>0?"+":"")+num(x,d)+"%";}'
  // ---- the transport: one POST per tool call, the same one an agent makes -------------------------
  + 'function rpc(method,params){'
  + '  return fetch(EP,{method:"POST",headers:{"content-type":"application/json"},'
  + '    body:JSON.stringify({jsonrpc:"2.0",id:++rid,method:method,params:params})})'
  + '  .then(function(r){'
  + '    if(r.status===429)throw new Error("Rate limited — the endpoint allows 240 requests a minute. Give it a moment.");'
  + '    return r.json();});}'
  + 'function call(name,args){'
  + '  var t0=Date.now(),card=trace(name,args);'
  + '  return rpc("tools/call",{name:name,arguments:args||{}}).then(function(j){'
  + '    var ms=Date.now()-t0;'
  + '    if(j.error){card.fail(j.error.message,ms);throw new Error(j.error.message);}'
  + '    var c=j.result&&j.result.content&&j.result.content[0],txt=c?c.text:"",data=null;'
  + '    try{data=JSON.parse(txt);}catch(_){}'
  + '    if(j.result&&j.result.isError){card.fail(txt,ms);throw new Error(txt);}'
  + '    card.done(ms);return {data:data,text:txt};'
  + '  },function(e){card.fail(e&&e.message,Date.now()-t0);throw e;});}'
  // ---- the trace: what the answer is actually made of ---------------------------------------------
  + 'function trace(name,args){'
  + '  var row=el("div","lxpg-call run");row.appendChild(el("span","lxpg-dot"));'
  + '  var body=el("div");body.style.minWidth="0";body.appendChild(el("div","nm",name));'
  + '  var a=[];for(var k in (args||{}))a.push(k+": "+args[k]);'
  + '  if(a.length)body.appendChild(el("div","ar",a.join("  ")));'
  + '  row.appendChild(body);var ms=el("span","ms","…");row.appendChild(ms);'
  + '  traceEl.appendChild(row);traceEl.scrollTop=traceEl.scrollHeight;'
  + '  return {done:function(t){row.className="lxpg-call";ms.textContent=t+"ms";},'
  + '          fail:function(m,t){row.className="lxpg-call err";ms.textContent=(t||0)+"ms";'
  + '            body.appendChild(el("div","ar",String(m||"failed").slice(0,120)));}};}'
  // Six at a time: enough to feel instant, far enough under the per-IP ceiling that a second visitor
  // running the same thing does not push either of them over it.
  + 'function pool(items,n,fn){var i=0,out=[];'
  + '  function next(){if(i>=items.length)return Promise.resolve();var k=i++;'
  + '    return Promise.resolve(fn(items[k],k)).then(function(v){out[k]=v;}).then(next);}'
  + '  var runners=[];for(var w=0;w<n;w++)runners.push(next());'
  + '  return Promise.all(runners).then(function(){return out;});}'
  + 'function start(){busy=true;clear(traceEl);clear(outEl);'
  + '  [].slice.call(chipsEl.querySelectorAll("button")).forEach(function(b){b.disabled=true;});}'
  + 'function stop(){busy=false;[].slice.call(chipsEl.querySelectorAll("button")).forEach(function(b){b.disabled=false;});}'
  + 'function fail(e){var d=el("div","lxpg-err",(e&&e.message)||"Something went wrong.");clear(outEl);outEl.appendChild(d);}'
  + 'function head(big,sub){outEl.appendChild(el("div","lxpg-big",big));if(sub)outEl.appendChild(el("div","lxpg-sub",sub));}'
  + 'function table(cols,rows){var t=el("table","lxpg-tbl"),h=el("tr");'
  + '  cols.forEach(function(c){h.appendChild(el("th",null,c));});'
  + '  var th=el("thead");th.appendChild(h);t.appendChild(th);var tb=el("tbody");'
  + '  rows.forEach(function(r){var tr=el("tr");r.forEach(function(cell,ix){'
  + '    var td=el("td",ix?"mut":null);'
  + '    if(ix===0){var s=el("span","lxpg-pair",cell);td.appendChild(s);}else td.textContent=String(cell);'
  + '    tr.appendChild(td);});tb.appendChild(tr);});'
  + '  t.appendChild(tb);outEl.appendChild(t);}'
  // ---- the demos ----------------------------------------------------------------------------------
  + 'var NAT="' + '{{NAT}}' + '";'
  + 'function runFloor(all){var N=all?58:24;'
  + '  return call("list_curated_assets",{}).then(function(r){'
  + '    var list=(r.data&&r.data.assets||[]).slice(0,N);'
  + '    return pool(list,6,function(a){'
  + '      return call("get_orderbook",{asset:a.asset,limit:1}).then(function(b){return b.data;},function(){return null;});'
  + '    }).then(function(books){'
  + '      var hit=books.filter(function(b){return b&&b.spread_pct>=50&&b.last_vs_best_bid_pct!=null&&b.last_vs_best_bid_pct<=30;})'
  + '        .sort(function(x,y){return y.spread_pct-x.spread_pct;});'
  + '      head(hit.length+" of "+list.length+" match","Ask above the floor by 50% or more, and trading within 30% of it.");'
  + '      if(!hit.length){outEl.appendChild(el("div","lxpg-note","Nothing matched in this sample right now — the books move."));return;}'
  + '      table(["Pair","Spread","Above floor","At floor","Drop to next bid"],hit.map(function(b){'
  + '        return [b.code+" / "+NAT,sgn(b.spread_pct,0),sgn(b.last_vs_best_bid_pct,0),'
  + '          num(b.xlm_resting_at_best_bid,2)+" "+NAT,(b.drop_to_next_bid_pct==null?"-":num(b.drop_to_next_bid_pct,0)+"%")];}));'
  + '      outEl.appendChild(el("div","lxpg-note","A wide spread is not on its own an opportunity: check what is actually resting at the floor, and how far it drops to the bid below. One of these often turns out to be a single dust order."));'
  + '      if(!all){var more=el("button","lxpg-chip","Run all 58 instead of "+N);'
  + '        more.type="button";more.addEventListener("click",function(){go(function(){return runFloor(true);});});'
  + '        outEl.appendChild(more);}'
  + '    });});}'
  + 'function runQuote(){return call("get_quote",{from:"XLM",to:"USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",amount:100})'
  + '  .then(function(r){var d=r.data||{};head(num(d.amount_out,4)+" USDC","for 100 "+NAT+", routed by Stellar path finding");'
  + '    var dl=el("dl","lxpg-kv");'
  + '    [["Rate",num(d.rate,7)+" USDC per "+NAT],["Routes compared",String(d.routes_considered==null?"-":d.routes_considered)],'
  + '     ["Hops",(d.hops&&d.hops.length)?d.hops.map(function(h){return String(h).split("-")[0];}).join(" → "):"direct"],'
  + '     ["Trading fee",num(d.trading_fee_pct,2)+"%"]].forEach(function(p){'
  + '      dl.appendChild(el("dt",null,p[0]));dl.appendChild(el("dd",null,p[1]));});'
  + '    outEl.appendChild(dl);'
  + '    outEl.appendChild(el("div","lxpg-note","Indicative. The executed price is quoted again at signing."));});}'
  + 'function runPools(){return call("list_pools",{limit:8}).then(function(r){'
  + '  var rows=(r.data&&r.data.pools||[]);head(rows.length+" pools","Ranked by total value locked.");'
  + '  table(["Pair","TVL","24h volume","Fee","Members"],rows.map(function(p){'
  + '    return [p.pair,"$"+num(p.tvl_usd,0),"$"+num(p.volume_24h_usd,0),(p.fee_bps==null?"-":(p.fee_bps/100)+"%"),String(p.participants==null?"-":p.participants)];}));});}'
  + 'function runWallet(addr){return call("get_portfolio",{address:addr}).then(function(r){'
  + '  var d=r.data||{};'
  + '  if(!d.funded){head("Not funded","This account does not exist on mainnet yet.");return;}'
  + '  var bal=(d.balances||[]),open=(d.open_orders||[]);'
  + '  head(bal.length+" balances",open.length+" open order"+(open.length===1?"":"s")+" · "+d.pool_positions+" pool position"+(d.pool_positions===1?"":"s"));'
  + '  table(["Asset","Balance","Kind"],bal.slice(0,12).map(function(b){'
  + '    return [(b.code==="XLM"?("XLM / native"):(b.code+" / "+NAT)),num(b.balance,4),b.kind];}));'
  + '  if(bal.length>12)outEl.appendChild(el("div","lxpg-note","Showing 12 of "+bal.length+"."));});}'
  // The write demo. It returns a link and nothing else -- which is the whole argument, made by
  // demonstration instead of by a sentence on a page.
  + 'function runSwap(){return call("swap",{from:"XLM",to:"USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",amount:100})'
  + '  .then(function(r){var d=r.data||{};head("Prepared, not signed",d.summary||"");'
  + '    var dl=el("dl","lxpg-kv");'
  + '    [["signed",String(d.signed)],["opens",d.opens||"-"]].forEach(function(p){'
  + '      dl.appendChild(el("dt",null,p[0]));dl.appendChild(el("dd",null,p[1]));});'
  + '    outEl.appendChild(dl);'
  + '    if(d.approve_url){var a=el("a","lxpg-link","Open the prepared swap");a.href=d.approve_url;a.rel="noopener";outEl.appendChild(a);}'
  + '    outEl.appendChild(el("div","lxpg-warn","Nothing has moved. The server holds no key and cannot sign — opening that link shows you the transaction, and your wallet asks you to approve it."));});}'
  + 'function go(fn){if(busy)return;start();'
  + '  Promise.resolve().then(fn).catch(fail).then(stop,stop);}'
  // ---- the chips ----------------------------------------------------------------------------------
  + 'var DEMOS=['
  + '  {n:"2 tools",t:"Which curated assets sit near their floor?",f:function(){return runFloor(false);}},'
  + '  {n:"1 tool",t:"What would 100 "+NAT+" get me in USDC?",f:runQuote},'
  + '  {n:"1 tool",t:"Top liquidity pools",f:runPools},'
// NO BARE TICKER IN THIS LABEL. The runtime logo healer paints a small element that sits next to an
// uppercase ticker word, and the first version of this chip read "the LUMOS issuer wallet" -- so the
// healer replaced the chip's own "1 tool" badge with a base64 LUMOS logo. Verified in the DOM, not
// guessed: the badge came back carrying data-logo="LUMOS" and an empty text node.
  + '  {n:"1 tool",t:"What is in a public issuer wallet?",f:function(){return runWallet("GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S");}},'
  + '  {n:"write",t:"Prepare a swap (nothing is signed)",f:runSwap}];'
  + 'DEMOS.forEach(function(d){var b=el("button","lxpg-chip");b.type="button";'
  + '  b.appendChild(el("span","n",d.n));b.appendChild(el("span",null,d.t));'
  + '  b.addEventListener("click",function(){go(d.f);});chipsEl.appendChild(b);});'
  // ---- the explorer, built from the server's OWN schema -------------------------------------------
  // Generated from tools/list rather than written out here, so it cannot drift from the server: a tool
  // added tomorrow appears in this form with its real arguments and no edit to this file.
  + 'var sel=document.getElementById("lxpgTool"),fieldsEl=document.getElementById("lxpgFields"),'
  + 'runBtn=document.getElementById("lxpgRun"),rawEl=document.getElementById("lxpgRaw"),TOOLS=[];'
  + 'function fields(){clear(fieldsEl);var t=TOOLS[sel.value];if(!t)return;'
  + '  var p=(t.inputSchema&&t.inputSchema.properties)||{},req=(t.inputSchema&&t.inputSchema.required)||[];'
  + '  Object.keys(p).forEach(function(k){var i=el("input");i.setAttribute("data-k",k);'
  + '    i.placeholder=k+(req.indexOf(k)>=0?" (required)":"")+(p[k].type==="number"?" — number":"");'
  + '    fieldsEl.appendChild(i);});'
  + '  if(!Object.keys(p).length)fieldsEl.appendChild(el("div","lxpg-note","This tool takes no arguments."));}'
  + 'function loadTools(){if(TOOLS.length)return Promise.resolve();'
  + '  return rpc("tools/list",{}).then(function(j){TOOLS=(j.result&&j.result.tools)||[];'
  + '    clear(sel);TOOLS.forEach(function(t,i){var o=el("option",null,t.name);o.value=String(i);sel.appendChild(o);});'
  + '    fields();});}'
  + 'if(sel&&fieldsEl&&runBtn&&rawEl){'
  + '  var det=document.getElementById("lxpgExp");'
  + '  if(det)det.addEventListener("toggle",function(){if(det.open)loadTools().catch(function(){});});'
  + '  sel.addEventListener("change",fields);'
  + '  runBtn.addEventListener("click",function(){'
  + '    var t=TOOLS[sel.value];if(!t)return;runBtn.disabled=true;rawEl.textContent="Running…";'
  + '    var args={},p=(t.inputSchema&&t.inputSchema.properties)||{};'
  + '    [].slice.call(fieldsEl.querySelectorAll("input")).forEach(function(i){'
  + '      var k=i.getAttribute("data-k"),v=i.value.trim();if(!v)return;'
  + '      args[k]=(p[k]&&p[k].type==="number")?Number(v):v;});'
  + '    rpc("tools/call",{name:t.name,arguments:args}).then(function(j){'
  + '      var c=j.result&&j.result.content&&j.result.content[0];'
  + '      rawEl.textContent=j.error?("error: "+j.error.message):(c?c.text:JSON.stringify(j,null,1));'
  + '    }).catch(function(e){rawEl.textContent=(e&&e.message)||"failed";})'
  + '    .then(function(){runBtn.disabled=false;},function(){runBtn.disabled=false;});});}'
  + '})();<' + '/script>';

function sectionHTML(nat) {
  return '<section class="mcp-sec" id="mcp-play">'
    + '<div class="mcp-sec-head">'
    + '<h2>Try it right here</h2>'
    + '<p>Every button below speaks to <b>POST /mcp on this domain</b> &mdash; the same endpoint, the same twelve tools '
    + 'and the same answers an agent gets. The left panel shows the actual calls behind each answer.</p>'
    + '</div>'
    + '<div class="lxpg-lead" id="lxpgChips"></div>'
    + '<div class="lxpg-grid">'
    + '<div class="lxpg-panel"><div class="lxpg-bar"><span>Tool calls</span><span class="ep">POST /mcp</span></div>'
    + '<div class="lxpg-body" id="lxpgTrace"><div class="lxpg-empty">Pick a question above and the calls appear here, in order, with how long each one took.</div></div></div>'
    + '<div class="lxpg-panel"><div class="lxpg-bar"><span>Answer</span><span class="ep">live ' + nat + ' mainnet</span></div>'
    + '<div class="lxpg-body" id="lxpgOut"><div class="lxpg-empty">Results render here. Nothing is cached in the page &mdash; each run asks the endpoint again.</div></div></div>'
    + '</div>'
    + '<details class="lxpg-exp" id="lxpgExp"><summary>Or call any tool directly</summary>'
    + '<div class="lxpg-expbody">'
    + '<div class="lxpg-in"><select id="lxpgTool"></select><button type="button" id="lxpgRun">Run</button></div>'
    + '<div class="lxpg-in" id="lxpgFields"></div>'
    + '<pre class="lxpg-raw" id="lxpgRaw">Open this panel to load the tool list from the server.</pre>'
    + '<div class="lxpg-note">This form is generated from the server&rsquo;s own <code>tools/list</code> response, so it cannot drift from what the endpoint actually accepts.</div>'
    + '</div></details>'
    + '</section>';
}

const CFG = {
  hedera: 'HBAR', aptos: 'APT', starknet: 'STRK', vechain: 'VET',
  worldchain: 'WLD', stellar: 'XLM', xrpl: 'XRP',
};

let pages = 0, containers = 0;
for (const chain of Object.keys(CFG)) {
  for (const dev of ['desktop', 'mobile']) {
    const file = `lumoscore-${chain}-${dev}.html`;
    let data; try { data = read(file); } catch (e) { continue; }
    const { json, s, e } = getContents(data);
    let changed = false;

    for (const k of Object.keys(json)) {
      if (!/lumoscore-mcp/.test(k)) continue;
      let h = json[k];
      const before = h;
      // Idempotent, and it must be: a stripById that leaves the <style> behind is how this codebase
      // ends up with stale duplicate rules winning on source order.
      h = h.replace(/<style id="lx-mcpplay">[\s\S]*?<\/style>/g, '');
      h = h.replace(/<section class="mcp-sec" id="mcp-play">[\s\S]*?<\/section>\s*(?=<section|<\/div>)/g, '');
      h = h.replace(/<script id="lx-mcpplay-js">[\s\S]*?<\/script>/g, '');

      if (h.indexOf('</head>') >= 0) h = h.replace('</head>', STYLE + '</head>');
      // Directly after the hero banner: "try it" before "read about it". The anchor is the Connect
      // section because the feature-card section that used to sit here was cut -- it described what the
      // playground already shows.
      const anchor = '<section class="mcp-sec" id="mcp-connect">';
      if (h.indexOf(anchor) < 0) continue;
      h = h.replace(anchor, sectionHTML(CFG[chain]) + anchor);
      const bi = h.lastIndexOf('</body>');
      if (bi < 0) continue;
      h = h.slice(0, bi) + SCRIPT.split('{{NAT}}').join(CFG[chain]) + h.slice(bi);

      if (h !== before) { json[k] = h; changed = true; pages++; }
    }

    if (changed) {
      containers++;
      const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
      fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
    }
  }
}
console.log('mcp playground: ' + pages + ' page key(s) across ' + containers + ' container(s)');
if (!pages) { console.error('  ! no MCP page matched — run _tools/_mcp_page.js first'); process.exit(1); }
