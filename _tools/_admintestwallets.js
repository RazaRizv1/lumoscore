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

const MAIN = `<main class="admin-main" id="lxTwMain" data-lxnonav="">
  <div class="admin-page-head">
    <h1 class="admin-page-title">Test wallets</h1>
  </div>
  <div class="adm-card" style="margin-bottom:18px">
    <div class="adm-card-head"><div>
      <div class="adm-card-title">Approved test wallets</div>
      <div class="adm-card-sub" style="font-size:13px;color:var(--text-muted)">These wallets pay the minimum: 0.5 of the network's coin for liquidity and 0.5 for the minting fee when launching, and 0.5 for a curated listing. Everyone else pays the normal price.</div>
    </div></div>
    <div class="adm-card-body">
      <form id="lxTwForm" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:16px">
        <label style="display:flex;flex-direction:column;gap:5px;font-size:12px;color:var(--text-muted)">Network
          <select id="lxTwNet" style="min-width:120px;padding:9px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface-2,transparent);color:var(--text);font:inherit;font-size:14px">
            <option value="stellar">Stellar</option><option value="xrpl">XRPL</option><option value="near">NEAR</option>
          </select></label>
        <label style="display:flex;flex-direction:column;gap:5px;font-size:12px;color:var(--text-muted);flex:1 1 320px">Wallet address
          <input id="lxTwAddr" autocomplete="off" spellcheck="false" placeholder="G..., r... or name.near" style="padding:9px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface-2,transparent);color:var(--text);font:14px 'JetBrains Mono',monospace"></label>
        <label style="display:flex;flex-direction:column;gap:5px;font-size:12px;color:var(--text-muted);flex:0 1 200px">Label (optional)
          <input id="lxTwLabel" maxlength="60" autocomplete="off" placeholder="e.g. RAZA test" style="padding:9px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface-2,transparent);color:var(--text);font:inherit;font-size:14px"></label>
        <button class="adm-btn primary" id="lxTwAdd" type="submit" style="height:38px">Add wallet</button>
      </form>
      <div id="lxTwMsg" style="display:none;margin:-6px 0 12px;font-size:13px"></div>
      <div style="overflow-x:auto"><table class="adm-table" style="width:100%;border-collapse:collapse">
        <thead><tr><th style="text-align:left">Network</th><th style="text-align:left">Address</th><th style="text-align:left">Label</th><th style="text-align:left">Added</th><th></th></tr></thead>
        <tbody id="lxTwRows"><tr><td colspan="5" style="color:var(--text-muted)">Loading&hellip;</td></tr></tbody>
      </table></div>
    </div>
  </div>
</main>`;

const SCRIPT = `<script id="lx-admtw">(function(){
if(window.__lxAdmTw)return;window.__lxAdmTw=1;
var NAMES={stellar:"Stellar",xrpl:"XRPL",near:"NEAR"};
function $(i){return document.getElementById(i);}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"}[c];});}
function say(t,bad){var m=$("lxTwMsg");if(!m)return;m.style.display=t?"":"none";m.style.color=bad?"var(--red,#ea3943)":"var(--green,#22c55e)";m.textContent=t||"";}
function load(){fetch("/lxapi/testwallets",{credentials:"include",cache:"no-store"}).then(function(r){return r.json();}).then(function(j){
  var tb=$("lxTwRows");if(!tb)return;
  if(!j||!j.ok){tb.innerHTML='<tr><td colspan="5" style="color:var(--red,#ea3943)">Could not load the list ('+esc(j&&j.error||"error")+').</td></tr>';return;}
  var rows=j.rows||[];
  if(!rows.length){tb.innerHTML='<tr><td colspan="5" style="color:var(--text-muted)">No test wallets yet.</td></tr>';return;}
  tb.innerHTML=rows.map(function(r){var d=r.added_at?new Date(+r.added_at).toISOString().slice(0,10):"";
    return '<tr><td>'+esc(NAMES[r.net]||r.net)+'</td><td style="font-family:JetBrains Mono,monospace;font-size:12.5px;word-break:break-all">'+esc(r.addr)+'</td><td>'+esc(r.label||"")+'</td><td style="color:var(--text-muted)">'+esc(d)+'</td>'
      +'<td style="text-align:right"><button class="adm-btn ghost" type="button" data-twnet="'+esc(r.net)+'" data-twaddr="'+esc(r.addr)+'">Remove</button></td></tr>';}).join("");
}).catch(function(){var tb=$("lxTwRows");if(tb)tb.innerHTML='<tr><td colspan="5" style="color:var(--red,#ea3943)">Could not load the list.</td></tr>';});}
function post(body){return fetch("/lxapi/testwallets",{method:"POST",credentials:"include",headers:{"content-type":"application/json"},body:JSON.stringify(body)}).then(function(r){return r.json();});}
function boot(){var f=$("lxTwForm");if(!f||f.__lxw)return;f.__lxw=1;
  f.addEventListener("submit",function(e){e.preventDefault();e.stopPropagation();
    var net=$("lxTwNet").value,addr=$("lxTwAddr").value.trim(),label=$("lxTwLabel").value.trim(),b=$("lxTwAdd");
    if(!addr){say("Enter a wallet address.",true);return;}
    b.disabled=true;say("");
    post({op:"add",net:net,addr:addr,label:label}).then(function(j){b.disabled=false;
      if(!j||!j.ok){say((j&&j.error)||"Could not add it.",true);return;}
      $("lxTwAddr").value="";$("lxTwLabel").value="";say("Added.");load();
    },function(){b.disabled=false;say("Could not add it.",true);});
  },true);
  document.addEventListener("click",function(e){var b=e.target&&e.target.closest&&e.target.closest("[data-twaddr]");if(!b)return;
    e.preventDefault();e.stopPropagation();b.disabled=true;
    post({op:"remove",net:b.getAttribute("data-twnet"),addr:b.getAttribute("data-twaddr")}).then(function(j){
      if(!j||!j.ok){b.disabled=false;say((j&&j.error)||"Could not remove it.",true);return;}say("Removed.");load();
    },function(){b.disabled=false;say("Could not remove it.",true);});},true);
  load();}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();</script>`;

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
