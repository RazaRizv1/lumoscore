// ADMIN — Web analytics. Reads Cloudflare Web Analytics through /lxapi/analytics.
//
// The beacon was already collecting before any of this was built, so the page has real history from the
// first load rather than starting at zero.
//
// A NOTE ON THE NUMBERS, stated on the page rather than left to be discovered: Cloudflare Web Analytics
// samples and rounds, so daily figures arrive in tens and a day can show views with zero visits (every
// pageview that day followed an internal link). It is a traffic shape, not an audit trail, and the page
// says so instead of implying a precision it does not have.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const MAIN = `
      <div class="admin-page-head">
        <h1 class="admin-page-title">Analytics</h1>
        <p class="admin-page-sub" id="lxanSub">Loading&hellip;</p>
        <div class="admin-page-actions">
          <select class="adm-btn ghost" id="lxanDays">
            <option value="7">7 days</option>
            <option value="30" selected>30 days</option>
            <option value="90">90 days</option>
          </select>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-head"><span class="kpi-label">Page views</span></div><div class="kpi-value" id="lxanViews">&mdash;</div><div class="kpi-foot" id="lxanViewsF">in the period</div></div>
        <div class="kpi"><div class="kpi-head"><span class="kpi-label">Visits</span></div><div class="kpi-value" id="lxanVisits">&mdash;</div><div class="kpi-foot">arrivals from outside the site</div></div>
        <div class="kpi"><div class="kpi-head"><span class="kpi-label">Pages per visit</span></div><div class="kpi-value" id="lxanPer">&mdash;</div><div class="kpi-foot">how far people go</div></div>
        <div class="kpi"><div class="kpi-head"><span class="kpi-label">Busiest day</span></div><div class="kpi-value" id="lxanPeak">&mdash;</div><div class="kpi-foot" id="lxanPeakF">&nbsp;</div></div>
      </div>

      <div class="adm-card" style="margin-bottom:18px">
        <div class="adm-card-head"><div><div class="adm-card-title">Traffic by day</div><div class="adm-card-sub" id="lxanChartSub"></div></div></div>
        <div class="adm-card-body"><div class="lxan-chart" id="lxanChart"></div></div>
      </div>

      <div class="lxan-grid">
        <div class="adm-card">
          <div class="adm-card-head"><div class="adm-card-title">Top pages</div></div>
          <div class="adm-card-body" style="padding:0"><div id="lxanPages"><div class="lxadm-empty">Loading&hellip;</div></div></div>
        </div>
        <div class="adm-card">
          <div class="adm-card-head"><div class="adm-card-title">Where people came from</div></div>
          <div class="adm-card-body" style="padding:0"><div id="lxanRefs"><div class="lxadm-empty">Loading&hellip;</div></div></div>
        </div>
        <div class="adm-card">
          <div class="adm-card-head"><div class="adm-card-title">Countries</div></div>
          <div class="adm-card-body" style="padding:0"><div id="lxanGeo"><div class="lxadm-empty">Loading&hellip;</div></div></div>
        </div>
        <div class="adm-card">
          <div class="adm-card-head"><div class="adm-card-title">Devices</div></div>
          <div class="adm-card-body" style="padding:0"><div id="lxanDev"><div class="lxadm-empty">Loading&hellip;</div></div></div>
        </div>
      </div>
`;

const MOB = `
      <div class="mob-page-head"><h1 class="mob-page-title">Analytics</h1></div>
      <div class="lxadm-note">Traffic figures read from Cloudflare Web Analytics.</div>
      <div class="adm-card"><div class="adm-card-body" style="padding:0"><div id="lxanPages"><div class="lxadm-empty">Loading&hellip;</div></div></div></div>
`;

const CSS = `<style id="lx-adminanalytics-css">
.lxan-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px;align-items:start}
.lxan-chart{display:flex;align-items:flex-end;gap:3px;height:190px;padding-top:8px}
.lxan-col{flex:1 1 0;min-width:0;display:flex;flex-direction:column;justify-content:flex-end;height:100%;position:relative}
/* Views and visits are the SAME measure at different scopes, so visits sit inside the views bar rather
   than beside it on a second axis. Two y-axes on one chart is the fastest way to mislead someone. */
.lxan-bar{width:100%;background:var(--accent,#ea6a2c);opacity:.28;border-radius:3px 3px 0 0;position:relative}
.lxan-bar i{position:absolute;left:0;right:0;bottom:0;background:var(--accent,#ea6a2c);opacity:1;border-radius:3px 3px 0 0;display:block}
.lxan-col:hover .lxan-bar{opacity:.45}
.lxan-tip{position:absolute;bottom:100%;left:50%;transform:translateX(-50%);margin-bottom:6px;white-space:nowrap;
  background:var(--text,#0e0e10);color:var(--surface,#fff);font:600 11.5px/1.4 "Hanken Grotesk",system-ui,sans-serif;
  padding:6px 9px;border-radius:7px;opacity:0;pointer-events:none;transition:opacity .12s;z-index:5}
.lxan-col:hover .lxan-tip{opacity:1}
.lxan-legend{display:flex;gap:14px;align-items:center;font-size:12.5px;color:var(--text-muted);margin-top:10px}
.lxan-key{display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--accent,#ea6a2c);margin-right:5px;vertical-align:-1px}
.lxan-key.soft{opacity:.28}
.lxan-row{display:flex;align-items:center;gap:12px;padding:11px 16px;border-bottom:1px solid var(--border)}
.lxan-row:last-child{border-bottom:0}
.lxan-name{flex:1 1 auto;min-width:0;font-size:13.5px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lxan-n{flex:0 0 auto;font-variant-numeric:tabular-nums;font-weight:700;font-size:13.5px;color:var(--text)}
.lxan-track{flex:0 0 90px;height:6px;border-radius:3px;background:rgba(127,127,140,.16);overflow:hidden}
.lxan-fill{height:100%;background:var(--accent,#ea6a2c);border-radius:3px}
.lxan-note{margin-top:14px;font-size:12.5px;color:var(--text-muted);line-height:1.6}
</style>`;

const SCRIPT = '<script id="lx-adminanalytics">' + `(function(){
if(window.__lxAnalytics)return; window.__lxAnalytics=1;
function q(s){return document.querySelector(s);}
function esc(s){return String(s==null?"":s).replace(/[<>&"]/g,function(c){return c==="<"?"&lt;":c===">"?"&gt;":c==="&"?"&amp;":"&quot;";});}
function isPage(){var t=((q(".admin-page-title")||q(".mob-page-title")||{}).textContent||"").trim();return t.indexOf("Analytics")===0;}
function num(n){return (+n||0).toLocaleString();}
function setT(sel,t){var e=q(sel); if(e)e.textContent=t;}

// A country code is not a country name. Only the ones that actually show up are listed; anything else
// falls back to the code itself rather than being guessed at.
var CC={PK:"Pakistan",US:"United States",SG:"Singapore",VN:"Vietnam",UA:"Ukraine",KR:"South Korea",
TR:"Turkey",ID:"Indonesia",HK:"Hong Kong",IN:"India",GB:"United Kingdom",DE:"Germany",FR:"France",
NL:"Netherlands",CA:"Canada",AU:"Australia",BR:"Brazil",RU:"Russia",JP:"Japan",CN:"China",ES:"Spain",
IT:"Italy",PL:"Poland",NG:"Nigeria",PH:"Philippines",MY:"Malaysia",TH:"Thailand",AE:"UAE",BD:"Bangladesh"};

function list(sel,rows,fmt){
  var el=q(sel); if(!el)return;
  if(!rows||!rows.length){ el.innerHTML="<div class='lxadm-empty'>Nothing in this period.</div>"; return; }
  var max=rows.reduce(function(m,r){ return Math.max(m,r.count||0); },0)||1;
  el.innerHTML=rows.map(function(r){
    var pct=Math.max(2,Math.round((r.count/max)*100));
    return "<div class='lxan-row'><div class='lxan-name' title='"+esc(r.key)+"'>"+esc(fmt?fmt(r.key):r.key)+"</div>"
      +"<div class='lxan-track'><div class='lxan-fill' style='width:"+pct+"%'></div></div>"
      +"<div class='lxan-n'>"+num(r.count)+"</div></div>";
  }).join("");
}

function chart(days){
  var el=q("#lxanChart"); if(!el)return;
  if(!days||!days.length){ el.innerHTML=""; return; }
  var max=days.reduce(function(m,d){ return Math.max(m,d.views||0); },0)||1;
  el.innerHTML=days.map(function(d){
    var h=Math.max(2,Math.round((d.views/max)*100));
    var vh=d.views>0?Math.round((d.visits/d.views)*100):0;
    var when=new Date(d.date+"T00:00:00Z").toLocaleDateString(undefined,{month:"short",day:"numeric"});
    return "<div class='lxan-col'><div class='lxan-tip'>"+esc(when)+" \\u00b7 "+num(d.views)+" views \\u00b7 "+num(d.visits)+" visits</div>"
      +"<div class='lxan-bar' style='height:"+h+"%'><i style='height:"+vh+"%'></i></div></div>";
  }).join("");
  var sub=q("#lxanChartSub");
  if(sub)sub.textContent=days.length+" days \\u00b7 hover a bar for the figures";
}

function load(){
  var sel=q("#lxanDays"); var days=(sel&&sel.value)||"30";
  setT("#lxanSub","Reading Cloudflare Web Analytics\\u2026");
  fetch("/lxapi/analytics?days="+encodeURIComponent(days)+"&t="+Date.now())
    .then(function(r){ return r.text(); })
    .then(function(t){ var d=null; try{ d=JSON.parse(t); }catch(_){}
      if(!d){ setT("#lxanSub","Could not read analytics \\u2014 this page has to be opened through the admin login."); return; }
      if(d.error){
        setT("#lxanSub","Could not read analytics: "+(d.reason||(d.messages&&d.messages.join("; "))||d.message||d.error));
        return;
      }
      setT("#lxanViews",num(d.pageViews));
      setT("#lxanVisits",num(d.visits));
      setT("#lxanPer", d.visits>0 ? (d.pageViews/d.visits).toFixed(1) : "\\u2014");
      var peak=(d.byDay||[]).reduce(function(a,b){ return (b.views>((a&&a.views)||0))?b:a; },null);
      if(peak){ setT("#lxanPeak",num(peak.views));
        var pf=q("#lxanPeakF"); if(pf)pf.textContent=new Date(peak.date+"T00:00:00Z").toLocaleDateString(undefined,{month:"long",day:"numeric"}); }
      chart(d.byDay);
      list("#lxanPages",d.topPages);
      // The site's own hostname dominates the referrer list because internal navigation counts as a
      // referrer. Labelling it beats dropping it -- a reader who sees only t.co would wrongly conclude
      // almost nobody arrives from anywhere.
      list("#lxanRefs",d.topReferers,function(k){
        if(k==="lumoscore.com")return "lumoscore.com (internal navigation)";
        if(k==="(none)")return "Direct / no referrer";
        if(k==="t.co")return "t.co (X / Twitter)";
        return k;
      });
      list("#lxanGeo",d.topCountries,function(k){ return CC[k]||k; });
      list("#lxanDev",d.devices);
      setT("#lxanSub","Cloudflare Web Analytics \\u00b7 last "+d.days+" days");
      var vf=q("#lxanViewsF");
      if(vf)vf.textContent="in the last "+d.days+" days";
      var host=q(".adm-card-body");
      if(host&&!q(".lxan-note")){
        var n=document.createElement("div"); n.className="lxan-note";
        n.textContent="Cloudflare samples and rounds these figures, so daily numbers arrive in tens and a day can show views with no visits \\u2014 that means every pageview followed an internal link. Read it as the shape of traffic, not as an exact count.";
        var chartCard=q("#lxanChart"); if(chartCard&&chartCard.parentNode)chartCard.parentNode.appendChild(n);
      }
    })
    .catch(function(e){ setT("#lxanSub","Could not read analytics: "+e.message); });
}

function boot(){
  if(!isPage())return;
  var sel=q("#lxanDays"); if(sel&&!sel.__lx){ sel.__lx=1; sel.addEventListener("change",load); }
  load();
}
if(document.readyState!=="loading")boot(); else document.addEventListener("DOMContentLoaded",boot);
})();` + '</' + 'script>';

const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>';
function navItem(active, suffix) {
  return '<a class="adn-item ' + (active ? 'active' : '') + '" href="lumoscore-admin-analytics' + suffix + '.html" data-tip="Analytics">\n      '
    + ICON + '\n      <span class="adn-label">Analytics</span>\n    </a>\n    ';
}
function variantOf(key) { if (/-dark\.html$/.test(key)) return '-dark'; if (/-mobile\.html$/.test(key)) return '-mobile'; return ''; }

let made = 0, pages = 0;
for (const c of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain', 'stellar', 'xrpl']) {
  for (const dev of ['desktop', 'mobile']) {
    const file = `lumoscore-${c}-${dev}.html`;
    let data; try { data = read(file); } catch (e) { continue; }
    const { json, s, e } = getContents(data);
    let changed = false;

    Object.keys(json).filter((k) => /^lumoscore-admin-dashboard(-dark|-mobile)?\.html$/.test(k)).forEach(function (dk) {
      const suffix = variantOf(dk);
      const rk = 'lumoscore-admin-analytics' + suffix + '.html';
      const h = json[dk];
      const tag = suffix === '-mobile' ? '<main class="mob-main">' : '<main class="admin-main">';
      const mi = h.indexOf(tag);
      const me = h.indexOf('</main>', mi);
      if (mi < 0 || me < 0) return;
      let page = h.slice(0, mi) + tag + (suffix === '-mobile' ? MOB : MAIN) + h.slice(me);
      page = page.replace(/<title>[\s\S]*?<\/title>/, '<title>LumosCore — Admin · Analytics</title>');
      page = page.replace(/<a class="adn-item active"/, '<a class="adn-item "');
      page = page.replace(/<a class="mob-menu-item active"/, '<a class="mob-menu-item"');
      json[rk] = page; changed = true; made++;
    });

    for (const k of Object.keys(json)) {
      if (!/^lumoscore-admin-/.test(k)) continue;
      let h = json[k];
      h = h.replace(/<a class="adn-item [^"]*" href="lumoscore-admin-analytics[^"]*"[\s\S]*?<\/a>\s*/g, '');
      h = h.replace(/<style id="lx-adminanalytics-css">[\s\S]*?<\/style>/g, '')
           .replace(/<script id="lx-adminanalytics">[\s\S]*?<\/script>/g, '');
      const suffix = variantOf(k);
      const isMine = /^lumoscore-admin-analytics/.test(k);
      const dashRe = /(<a class="adn-item[^"]*" href="lumoscore-admin-dashboard[^"]*"[\s\S]*?<\/a>\s*)/;
      if (dashRe.test(h)) h = h.replace(dashRe, '$1' + navItem(isMine, suffix));
      if (suffix === '-mobile') {
        const mi = '<a class="mob-menu-item' + (isMine ? ' active' : '') + '" href="lumoscore-admin-analytics-mobile.html">' + ICON + '<span>Analytics</span></a>\n      ';
        const mdash = /(<a class="mob-menu-item[^"]*" href="lumoscore-admin-dashboard-mobile\.html">[\s\S]*?<\/a>\s*)/;
        if (mdash.test(h)) h = h.replace(mdash, '$1' + mi);
      }
      const bi = h.lastIndexOf('</body>');
      if (bi >= 0) h = h.slice(0, bi) + CSS + SCRIPT + h.slice(bi);
      json[k] = h; changed = true; pages++;
    }

    if (changed) {
      const ser = JSON.stringify(json).split('</').join('<' + B + '/');
      fs.writeFileSync(file, data.slice(0, s) + ser + data.slice(e), 'utf8');
    }
  }
}
console.log('admin analytics: page created on ' + made + ' variant(s); sidebar + layer on ' + pages + ' admin page keys');
