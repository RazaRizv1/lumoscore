// ADMIN "TEST WALLETS" PAGE (RAZA 2026-11-23: "a section in admin panel where i could add approved wallet addresses
// (on all 3 networks + more later). These wallets will be charged minimum fees for things like Launch, and curated
// listing ... This should be a separate page on admin panel").
//
//   node _tools/_admintestwallets.js [dist-admin]
//
// 1. Every admin page's sidebar gets a "Test wallets" entry right after Revenue (same markup as the design's own
//    items, the variant's own suffix: -dark pages link to -dark pages).
// 2. lumoscore-admin-testwallets{,-dark,-mobile}.html are made from the Revenue page of the same variant: its head,
//    sidebar and scripts unchanged, its <main> replaced by this page, the sidebar's active item moved here.
//    The Revenue scripts on it find none of their own elements and do nothing (each checks for its ids).
//
// The page talks to /lxapi/testwallets (admin only, Access-protected; functions/lxapi/testwallets.js). What an
// approved wallet gets is in _lib/testwallets.js. Idempotent: run it again and nothing doubles.
const fs = require('fs'), path = require('path');
const DIR = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist-admin'));
// The -mobile admin pages are cut-down builds phones are never sent to (phones get the normal page), so not those.
const VARIANTS = ['', '-dark'];
const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6"/><path d="M10 3v6.2L4.6 18.4A1.7 1.7 0 0 0 6.1 21h11.8a1.7 1.7 0 0 0 1.5-2.6L14 9.2V3"/><path d="M7.5 15h9"/></svg>';
function navItem(suffix, active) {
  return '<a class="adn-item ' + (active ? 'active' : '') + '" href="lumoscore-admin-testwallets' + suffix + '.html" data-tip="Test wallets">\n      '
    + ICON + '\n      <span class="adn-label">Test wallets</span>\n    </a>';
}
function suffixOf(f) { const m = /lumoscore-admin-[a-z-]+?(-dark|-mobile)?\.html$/.exec(f); return (m && m[1]) || ''; }

// v2 (RAZA 2026-11-24: "make the test wallets page on admin more organised and better. also check on mobile ...
// also add network logos"): a network picker with logos (the address also picks it: G... Stellar, r... XRPL,
// otherwise NEAR), what an approved wallet pays as three small figures, and the list as rows with the network's
// logo, filter chips with counts, copy, and a two-tap Remove. On a phone everything stacks and addresses wrap.
// Logos: /assets/networks/<net>.png, copied into the admin tree from the public site's (step 0).
const NETS = [['stellar', 'Stellar', 'XLM'], ['xrpl', 'XRPL', 'XRP'], ['near', 'NEAR', 'NEAR']];
const MAIN = `<main class="admin-main" id="lxTwMain" data-lxnonav="">
<style id="lx-admtw-css">
#lxTwMain .tw-sub{margin:4px 0 0;font-size:13.5px;color:var(--text-muted)}
#lxTwMain .tw-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;margin-bottom:16px}
#lxTwMain .tw-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:16px 18px;border-bottom:1px solid var(--border)}
#lxTwMain .tw-title{font-weight:700;font-size:15px;color:var(--text)}
#lxTwMain .tw-title .tw-n{color:var(--text-muted);font-weight:600;margin-left:4px}
#lxTwMain .tw-body{padding:16px 18px}
#lxTwMain .tw-fields label{font-family:inherit}
#lxTwMain .tw-lbl{display:block;font-family:inherit;font-size:12px;font-weight:600;color:var(--text-muted);margin:0 0 6px}
#lxTwMain .tw-nets{display:inline-flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
#lxTwMain .tw-net{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 14px 0 8px;border-radius:999px;border:1px solid var(--border);background:transparent;color:var(--text-soft,var(--text));font:inherit;font-size:13.5px;font-weight:600;cursor:pointer}
#lxTwMain .tw-net:hover{background:var(--surface-2)}
#lxTwMain .tw-net[aria-checked="true"]{border-color:var(--text);color:var(--text);background:var(--surface-2)}
#lxTwMain .tw-logo{width:22px;height:22px;border-radius:50%;object-fit:cover;flex-shrink:0;display:block}
#lxTwMain .tw-fields{display:grid;grid-template-columns:170px minmax(0,1fr) 200px auto;gap:10px;align-items:end}
#lxTwMain .tw-dd{position:relative}
#lxTwMain .tw-ddb{display:flex;align-items:center;gap:8px;cursor:pointer;text-align:left;font-weight:600}
#lxTwMain .tw-ddb .tw-ddn{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#lxTwMain .tw-chev{width:16px;height:16px;color:var(--text-muted);flex-shrink:0}
#lxTwMain .tw-ddl{position:absolute;z-index:30;left:0;top:calc(100% + 6px);min-width:100%;max-height:280px;overflow-y:auto;padding:6px;box-sizing:border-box;background:var(--surface);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow-md,0 8px 24px rgba(0,0,0,.18))}
#lxTwMain .tw-ddl[hidden]{display:none}
#lxTwMain .tw-opt{display:flex;align-items:center;gap:10px;width:100%;height:40px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:var(--text);font:inherit;font-size:14px;font-weight:600;cursor:pointer;text-align:left}
#lxTwMain .tw-opt:hover,#lxTwMain .tw-opt[aria-selected="true"]{background:var(--surface-2)}
#lxTwMain .tw-in{width:100%;box-sizing:border-box;height:40px;padding:0 12px;border-radius:10px;border:1px solid var(--border);background:var(--surface-2,transparent);color:var(--text);font:inherit;font-size:14px;outline:none}
#lxTwMain .tw-in:focus{border-color:var(--border-strong,var(--text-muted))}
#lxTwMain .tw-in.tw-mono{font-family:'JetBrains Mono',monospace;font-size:13px}
#lxTwMain .tw-add{height:40px;white-space:nowrap}
#lxTwMain .tw-msg{margin-top:10px;font-size:13px}
#lxTwMain .tw-pays{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:16px;padding-top:14px;border-top:1px solid var(--border)}
#lxTwMain .tw-pay .tw-k{font-size:12px;color:var(--text-muted)}
#lxTwMain .tw-pay .tw-v{font-size:14px;font-weight:700;color:var(--text);margin-top:2px}
#lxTwMain .tw-pay .tw-v s{color:var(--text-muted);font-weight:500;margin-left:6px;font-size:12.5px}
#lxTwMain .tw-chips{display:flex;gap:6px;flex-wrap:wrap}
#lxTwMain .tw-chip{height:30px;padding:0 12px;border-radius:999px;border:1px solid var(--border);background:transparent;color:var(--text-muted);font:inherit;font-size:12.5px;font-weight:600;cursor:pointer}
#lxTwMain .tw-chip[aria-pressed="true"]{color:var(--text);border-color:var(--text);background:var(--surface-2)}
#lxTwMain .tw-row{display:grid;grid-template-columns:32px minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px 18px;border-top:1px solid var(--border)}
#lxTwMain .tw-row:first-child{border-top:0}
#lxTwMain .tw-row .tw-logo{width:32px;height:32px}
#lxTwMain .tw-addr{font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#lxTwMain .tw-meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:3px;font-size:12.5px;color:var(--text-muted)}
#lxTwMain .tw-tag{padding:1px 8px;border-radius:6px;background:var(--surface-2);color:var(--text-soft,var(--text));font-weight:600}
#lxTwMain .tw-acts{display:flex;gap:6px}
#lxTwMain .tw-ib{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;min-width:32px;padding:0 10px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text-muted);font:inherit;font-size:12.5px;font-weight:600;cursor:pointer}
#lxTwMain .tw-ib:hover{color:var(--text);background:var(--surface-2)}
#lxTwMain .tw-ib svg{width:15px;height:15px}
#lxTwMain .tw-ib.tw-sure{color:#fff;background:var(--red,#ea3943);border-color:var(--red,#ea3943)}
#lxTwMain .tw-empty{padding:28px 18px;text-align:center;color:var(--text-muted);font-size:13.5px}
@media (max-width:720px){
  #lxTwMain .tw-fields{grid-template-columns:minmax(0,1fr) auto}
  #lxTwMain .tw-f-net,#lxTwMain .tw-f-wallet{grid-column:1 / -1}
  #lxTwMain .tw-add{padding:0 18px}
  #lxTwMain .tw-head,#lxTwMain .tw-body{padding:14px}
  #lxTwMain .tw-row{padding:12px 14px;grid-template-columns:28px minmax(0,1fr);align-items:start}
  #lxTwMain .tw-row .tw-logo{width:28px;height:28px}
  #lxTwMain .tw-addr{white-space:normal;word-break:break-all;font-size:12.5px}
  #lxTwMain .tw-acts{grid-column:2}
  #lxTwMain .tw-ib .tw-t{display:inline}
}
</style>
  <div class="admin-page-head" style="display:block">
    <h1 class="admin-page-title">Test wallets</h1>
    <p class="tw-sub">Approved wallets pay the minimum to launch a token or get a curated listing.</p>
  </div>
  <section class="tw-card">
    <div class="tw-head"><div class="tw-title">Add a wallet</div></div>
    <div class="tw-body">
      <form id="lxTwForm" autocomplete="off">
        <input type="hidden" id="lxTwNet" value="stellar">
        <div class="tw-fields">
          <div class="tw-f-net"><span class="tw-lbl">Network</span>
            <div class="tw-dd" id="lxTwDd">
              <button type="button" class="tw-in tw-ddb" id="lxTwDdb" aria-haspopup="listbox" aria-expanded="false"><img class="tw-logo" alt="" src="/assets/networks/${NETS[0][0]}.png"><span class="tw-ddn">${NETS[0][1]}</span><svg class="tw-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>
              <div class="tw-ddl" id="lxTwDdl" role="listbox" hidden>${NETS.map(([k, n], i) => '<button type="button" class="tw-opt" role="option" data-twpick="' + k + '" aria-selected="' + (i === 0) + '"><img class="tw-logo" alt="" src="/assets/networks/' + k + '.png">' + n + '</button>').join('')}</div>
            </div></div>
          <label class="tw-f-wallet"><span class="tw-lbl">Wallet address</span><input id="lxTwAddr" class="tw-in tw-mono" spellcheck="false" placeholder="G..., r... or name.near"></label>
          <label class="tw-f-lbl"><span class="tw-lbl">Label (optional)</span><input id="lxTwLabel" class="tw-in" maxlength="60" placeholder="e.g. RAZA test"></label>
          <button class="adm-btn primary tw-add" id="lxTwAdd" type="submit">Add wallet</button>
        </div>
        <div id="lxTwMsg" class="tw-msg" style="display:none"></div>
      </form>
      <div class="tw-pays" id="lxTwPays"></div>
    </div>
  </section>
  <section class="tw-card">
    <div class="tw-head"><div class="tw-title">Approved wallets<span class="tw-n" id="lxTwCount"></span></div><div class="tw-chips" id="lxTwChips"></div></div>
    <div id="lxTwRows"><div class="tw-empty">Loading&hellip;</div></div>
  </section>
</main>`;

const SCRIPT = `<script id="lx-admtw">(function(){
if(window.__lxAdmTw)return;window.__lxAdmTw=1;
var NETS=${JSON.stringify(NETS)},NAMES={},COIN={};NETS.forEach(function(n){NAMES[n[0]]=n[1];COIN[n[0]]=n[2];});
var ROWS=[],FILTER="all";
var ICO_COPY='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
var ICO_OK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
var ICO_DEL='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';
function $(i){return document.getElementById(i);}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"}[c];});}
function logo(n){return '<img class="tw-logo" alt="" src="/assets/networks/'+esc(n)+'.png">';}
function say(t,bad){var m=$("lxTwMsg");if(!m)return;m.style.display=t?"":"none";m.style.color=bad?"var(--red,#ea3943)":"var(--green,#22c55e)";m.textContent=t||"";}
function pick(n){if(!NAMES[n])return;$("lxTwNet").value=n;
  [].forEach.call(document.querySelectorAll("[data-twpick]"),function(b){b.setAttribute("aria-selected",String(b.getAttribute("data-twpick")===n));});
  var d=$("lxTwDdb");if(d){d.querySelector("img").src="/assets/networks/"+n+".png";d.querySelector(".tw-ddn").textContent=NAMES[n];}pays(n);}
function dd(open){var l=$("lxTwDdl"),b=$("lxTwDdb");if(!l||!b)return;l.hidden=!open;b.setAttribute("aria-expanded",String(open));}
// The address names its network: G... (56) Stellar, r... XRPL, anything else NEAR (name.near or a 64-hex implicit account).
function guess(a){if(/^G[A-Z2-7]{55}$/.test(a))return "stellar";if(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(a))return "xrpl";if(/[.]near$|^[0-9a-f]{64}$/.test(a))return "near";return "";}
function pays(n){var c=COIN[n]||"",p=$("lxTwPays");if(!p)return;
  p.innerHTML=[["Launch liquidity","0.5 "+c],["Minting fee","0.5 "+c],["Curated listing","0.5 "+c,"$250"]].map(function(x){
    return '<div class="tw-pay"><div class="tw-k">'+esc(x[0])+'</div><div class="tw-v">'+esc(x[1])+(x[2]?'<s>'+esc(x[2])+'</s>':"")+'</div></div>';}).join("");}
function when(t){if(!t)return "";var d=new Date(+t);return d.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"});}
function paint(){var box=$("lxTwRows");if(!box)return;
  var cnt={all:ROWS.length};NETS.forEach(function(n){cnt[n[0]]=0;});ROWS.forEach(function(r){cnt[r.net]=(cnt[r.net]||0)+1;});
  $("lxTwCount").textContent=ROWS.length?"("+ROWS.length+")":"";
  var chips=[["all","All"]].concat(NETS.filter(function(n){return cnt[n[0]];}).map(function(n){return [n[0],n[1]];}));
  $("lxTwChips").innerHTML=ROWS.length&&chips.length>2?chips.map(function(c){return '<button type="button" class="tw-chip" data-twf="'+c[0]+'" aria-pressed="'+(FILTER===c[0])+'">'+esc(c[1])+' '+cnt[c[0]]+'</button>';}).join(""):"";
  var rows=ROWS.filter(function(r){return FILTER==="all"||r.net===FILTER;});
  if(!ROWS.length){box.innerHTML='<div class="tw-empty">No test wallets yet. Add one above.</div>';return;}
  box.innerHTML=rows.map(function(r){
    return '<div class="tw-row">'+logo(r.net)+'<div style="min-width:0"><div class="tw-addr" title="'+esc(r.addr)+'">'+esc(r.addr)+'</div>'
      +'<div class="tw-meta"><span>'+esc(NAMES[r.net]||r.net)+'</span>'+(r.label?'<span class="tw-tag">'+esc(r.label)+'</span>':"")+'<span>Added '+esc(when(r.added_at))+'</span></div></div>'
      +'<div class="tw-acts"><button type="button" class="tw-ib" data-twcopy="'+esc(r.addr)+'" title="Copy address" aria-label="Copy address">'+ICO_COPY+'</button>'
      +'<button type="button" class="tw-ib" data-twnet="'+esc(r.net)+'" data-twaddr="'+esc(r.addr)+'">'+ICO_DEL+'<span class="tw-t">Remove</span></button></div></div>';}).join("");}
function load(){fetch("/lxapi/testwallets",{credentials:"include",cache:"no-store"}).then(function(r){return r.json();}).then(function(j){
  if(!j||!j.ok){$("lxTwRows").innerHTML='<div class="tw-empty" style="color:var(--red,#ea3943)">Could not load the list ('+esc(j&&j.error||"error")+').</div>';return;}
  ROWS=j.rows||[];if(FILTER!=="all"&&!ROWS.some(function(r){return r.net===FILTER;}))FILTER="all";paint();
}).catch(function(){$("lxTwRows").innerHTML='<div class="tw-empty" style="color:var(--red,#ea3943)">Could not load the list.</div>';});}
function post(body){return fetch("/lxapi/testwallets",{method:"POST",credentials:"include",headers:{"content-type":"application/json"},body:JSON.stringify(body)}).then(function(r){return r.json();});}
function boot(){var f=$("lxTwForm");if(!f||f.__lxw)return;f.__lxw=1;pays("stellar");
  document.addEventListener("keydown",function(e){if(e.key==="Escape")dd(false);});
  $("lxTwAddr").addEventListener("input",function(){var g=guess(this.value.trim());if(g)pick(g);});
  f.addEventListener("submit",function(e){e.preventDefault();e.stopPropagation();
    var net=$("lxTwNet").value,addr=$("lxTwAddr").value.trim(),label=$("lxTwLabel").value.trim(),b=$("lxTwAdd");
    if(!addr){say("Enter a wallet address.",true);return;}
    b.disabled=true;say("");
    post({op:"add",net:net,addr:addr,label:label}).then(function(j){b.disabled=false;
      if(!j||!j.ok){say((j&&j.error)||"Could not add it.",true);return;}
      $("lxTwAddr").value="";$("lxTwLabel").value="";say("Added.");load();
    },function(){b.disabled=false;say("Could not add it.",true);});
  },true);
  document.addEventListener("click",function(e){var t=e.target&&e.target.closest?e.target:null;if(!t)return;
    var p=t.closest("[data-twpick]");if(p){e.preventDefault();pick(p.getAttribute("data-twpick"));dd(false);return;}
    if(t.closest("#lxTwDdb")){e.preventDefault();dd($("lxTwDdl").hidden);return;}
    if(!t.closest("#lxTwDd"))dd(false);
    var c=t.closest("[data-twf]");if(c){e.preventDefault();FILTER=c.getAttribute("data-twf");paint();return;}
    var y=t.closest("[data-twcopy]");if(y){e.preventDefault();var a=y.getAttribute("data-twcopy");
      (navigator.clipboard?navigator.clipboard.writeText(a):Promise.reject()).then(function(){y.innerHTML=ICO_OK;setTimeout(function(){y.innerHTML=ICO_COPY;},1400);},function(){});return;}
    var b=t.closest("[data-twaddr]");if(!b)return;e.preventDefault();e.stopPropagation();
    // Two taps: the first turns the button red ("Sure?"), the second removes. It turns back after 4 seconds.
    if(!b.classList.contains("tw-sure")){b.classList.add("tw-sure");b.querySelector(".tw-t").textContent="Sure?";
      clearTimeout(b.__t);b.__t=setTimeout(function(){b.classList.remove("tw-sure");var s=b.querySelector(".tw-t");if(s)s.textContent="Remove";},4000);return;}
    b.disabled=true;
    post({op:"remove",net:b.getAttribute("data-twnet"),addr:b.getAttribute("data-twaddr")}).then(function(j){
      if(!j||!j.ok){b.disabled=false;say((j&&j.error)||"Could not remove it.",true);return;}say("Removed.");load();
    },function(){b.disabled=false;say("Could not remove it.",true);});},true);
  load();}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();</script>`;

// 0. The network logos, from the public site's own (dist/assets/networks), into the admin tree.
fs.mkdirSync(path.join(DIR, 'assets', 'networks'), { recursive: true });
for (const [k] of NETS) {
  const src = path.join(__dirname, '..', 'dist', 'assets', 'networks', k + '.png');
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DIR, 'assets', 'networks', k + '.png')); else console.log('  no logo', src);
}
let navAdded = 0, made = 0;
const files = fs.readdirSync(DIR).filter((f) => /^lumoscore-admin-.*\.html$/.test(f) && !/testwallets/.test(f) && !/-mobile.html$/.test(f));
for (const f of files) {
  const p = path.join(DIR, f); let s = fs.readFileSync(p, 'utf8');
  if (s.includes('href="lumoscore-admin-testwallets')) continue;
  const sfx = suffixOf(f);
  const re = new RegExp('<a class="adn-item[^"]*" href="lumoscore-admin-revenue' + sfx.replace('-', '\\-') + '\\.html"[\\s\\S]*?<\\/a>');
  const m = re.exec(s); if (!m) { console.log('  no Revenue nav item in', f); continue; }
  s = s.slice(0, m.index + m[0].length) + '\n    ' + navItem(sfx, false) + s.slice(m.index + m[0].length);
  fs.writeFileSync(p, s); navAdded++;
}
for (const sfx of VARIANTS) {
  const src = path.join(DIR, 'lumoscore-admin-revenue' + sfx + '.html');
  if (!fs.existsSync(src)) { console.log('  no', src); continue; }
  let s = fs.readFileSync(src, 'utf8');
  const a = s.indexOf('<main class="admin-main">'), b = s.indexOf('</main>', a);
  if (a < 0 || b < 0) { console.log('  no <main> in', src); continue; }
  s = s.slice(0, a) + MAIN + s.slice(b + '</main>'.length);
  s = s.replace(/<title>[^<]*<\/title>/, '<title>LumosCore — Admin · Test wallets</title>');
  s = s.replace(/class="adn-item active" href="lumoscore-admin-revenue/g, 'class="adn-item " href="lumoscore-admin-revenue');
  s = s.split('class="adn-item " href="lumoscore-admin-testwallets' + sfx + '.html"').join('class="adn-item active" href="lumoscore-admin-testwallets' + sfx + '.html"');
  const end = s.lastIndexOf('</body>');
  s = s.slice(0, end) + SCRIPT + '\n' + s.slice(end);
  fs.writeFileSync(path.join(DIR, 'lumoscore-admin-testwallets' + sfx + '.html'), s); made++;
}
// 3. THE LINK GUARD (RAZA 2026-11-24: "the admin -testwallets is unclickable in the menu"). Every admin page carries
//    a click guard that cancels a click on any lumoscore-*.html link missing from its baked VALID list -- the list
//    extract_site.js writes from the pages it built, which never included this one. The two pages join the list on
//    every admin page (mobile included), right after Revenue's entry.
const OLDV = '"lumoscore-admin-revenue-dark.html",';
const NEWV = OLDV + '"lumoscore-admin-testwallets.html","lumoscore-admin-testwallets-dark.html",';
let validFixed = 0;
for (const f of fs.readdirSync(DIR).filter((x) => /^lumoscore-admin-.*\.html$/.test(x))) {
  const p = path.join(DIR, f); let s = fs.readFileSync(p, 'utf8');
  if (s.includes('"lumoscore-admin-testwallets.html","lumoscore-admin-testwallets-dark.html"') || !s.includes('var VALID=')) continue;
  if (!s.includes(OLDV)) { console.log('  no VALID anchor in', f); continue; }
  s = s.split(OLDV).join(NEWV); fs.writeFileSync(p, s); validFixed++;
}
console.log('sidebar entries added:', navAdded, '| pages made:', made, '| link guard lists updated:', validFixed);
