// ADMIN — Web analytics. Reads /lxapi/analytics: Cloudflare Web Analytics (humans only) plus our own page-view table
// for the two things Cloudflare does not record, bounce rate and cities (functions/lxapi/pv.js).
//
// REBUILT 2026-09-22 (RAZA: "no way to view 24H visits ... only showing 10 countries ... not showing the bounce rate
// ... tap on any country, it should show its cities ... flag icons ... make it more understandable"):
//   * 24H / 7D / 30D / 90D, hourly for 24H;
//   * every headline figure compared with the same length of time just before it;
//   * all countries with flags and their share, each one opening its cities;
//   * bounce rate from our own sessions, with the date our own counting began, so an empty figure explains itself;
//   * pages and sources beyond ten, browsers and operating systems, and bots filtered out of every human figure;
//   * a line under each card saying what it counts.
// Cloudflare samples and rounds, so small numbers arrive in tens; the page says so rather than implying precision.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const MAIN = `
      <div class="admin-page-head">
        <h1 class="admin-page-title">Analytics</h1>
        <p class="admin-page-sub" id="lxanSub">Loading&hellip;</p>
        <div class="admin-page-actions">
          <div class="lxan-seg" id="lxanRange" role="tablist" aria-label="Time range">
            <button type="button" data-r="24h">24H</button><button type="button" data-r="7d">7D</button><button type="button" data-r="30d" class="on">30D</button><button type="button" data-r="90d">90D</button>
          </div>
        </div>
      </div>

      <div class="adm-card lxan-card lxan-livecard" style="margin-bottom:18px">
        <div class="adm-card-head"><div><div class="adm-card-title"><span class="lxan-dot"></span>Live now</div><div class="adm-card-sub" id="lxanLiveSub">people on the site in the last 5 minutes &middot; where they are and the page they are on</div></div><div class="lxan-livebig" id="lxanLiveN">&mdash;</div></div>
        <div class="adm-card-body" style="padding:0"><div id="lxanLiveRows" class="lxan-live"><div class="lxadm-empty">Loading&hellip;</div></div></div>
      </div>

      <div class="lxan-kpis">
        <div class="lxan-kpi"><div class="lxan-kl">Visits</div><div class="lxan-kvrow"><div class="lxan-kv" id="lxanVisits">&mdash;</div><div class="lxan-spark" id="lxanVisitsS"></div></div><div class="lxan-kd" id="lxanVisitsD"></div><div class="lxan-kf">people arriving from another site or typing the address</div></div>
        <div class="lxan-kpi"><div class="lxan-kl">Page views</div><div class="lxan-kvrow"><div class="lxan-kv" id="lxanViews">&mdash;</div><div class="lxan-spark" id="lxanViewsS"></div></div><div class="lxan-kd" id="lxanViewsD"></div><div class="lxan-kf">every page opened, by people</div></div>
        <div class="lxan-kpi"><div class="lxan-kl">Pages per visit</div><div class="lxan-kv" id="lxanPer">&mdash;</div><div class="lxan-kd" id="lxanPerD"></div><div class="lxan-kf">how far a visitor goes on average</div></div>
        <div class="lxan-kpi"><div class="lxan-kl">Bounce rate</div><div class="lxan-kv" id="lxanBounce">&mdash;</div><div class="lxan-kd" id="lxanBounceD"></div><div class="lxan-kf" id="lxanBounceF">visits that left after one page</div></div>
        <div class="lxan-kpi"><div class="lxan-kl">Bots filtered</div><div class="lxan-kv" id="lxanBots">&mdash;</div><div class="lxan-kd" id="lxanBotsD"></div><div class="lxan-kf">crawler page views, left out of every figure here</div></div>
      </div>

      <div class="adm-card lxan-card" style="margin-bottom:18px">
        <div class="adm-card-head"><div><div class="adm-card-title" id="lxanChartT">Traffic over time</div><div class="adm-card-sub" id="lxanChartSub"></div></div>
          <div class="lxan-legend"><span><i class="lxan-key"></i>Page views</span><span><i class="lxan-key vis"></i>Visits</span></div></div>
        <div class="adm-card-body"><div class="lxan-area" id="lxanChart"></div></div>
      </div>

      <div class="lxan-top">
        <div class="adm-card lxan-card lxan-mapcard">
          <div class="adm-card-head"><div><div class="adm-card-title">Where visitors are</div><div class="adm-card-sub" id="lxanMapSub">page views by country &middot; click a country for its cities</div></div></div>
          <div class="adm-card-body"><div class="lxan-mapwrap" id="lxanMap">__WORLD_MAP__<div class="lxan-maptip" id="lxanMapTip"></div></div><div class="lxan-mapkey"><span>fewer</span><i></i><span>more page views</span></div></div>
        </div>
        <div class="lxan-stack">
          <div class="adm-card lxan-card">
            <div class="adm-card-head"><div><div class="adm-card-title">Traffic channels</div><div class="adm-card-sub">how visits started &middot; moving between pages not counted</div></div></div>
            <div class="adm-card-body"><div id="lxanChan"><div class="lxadm-empty">Loading&hellip;</div></div></div>
          </div>
          <div class="adm-card lxan-card">
            <div class="adm-card-head"><div><div class="adm-card-title">Devices</div><div class="adm-card-sub">share of page views</div></div></div>
            <div class="adm-card-body"><div id="lxanDonut" class="lxan-donutwrap"></div></div>
          </div>
        </div>
      </div>

      <div class="adm-card lxan-card" style="margin-bottom:18px">
        <div class="adm-card-head"><div><div class="adm-card-title">Countries</div><div class="adm-card-sub" id="lxanGeoSub">tap a country to see its cities</div></div></div>
        <div class="adm-card-body" style="padding:0"><div id="lxanGeo" class="lxan-box lxan-box-geo"><div class="lxadm-empty">Loading&hellip;</div></div></div>
      </div>

      <div class="lxan-quad">
        <div class="adm-card lxan-card">
          <div class="adm-card-head"><div><div class="adm-card-title">Top pages</div><div class="adm-card-sub">page views per page &middot; click one for its own analytics</div></div></div>
          <div class="adm-card-body" style="padding:0"><div id="lxanPages" class="lxan-box"><div class="lxadm-empty">Loading&hellip;</div></div></div>
        </div>
        <div class="adm-card lxan-card">
          <div class="adm-card-head"><div><div class="adm-card-title">Traffic Sources</div><div class="adm-card-sub" id="lxanRefSub">where visitors came from &middot; Cloudflare (sampled) plus LumosCore’s own record</div></div></div>
          <div class="adm-card-body" style="padding:0"><div id="lxanRefs" class="lxan-box"><div class="lxadm-empty">Loading&hellip;</div></div></div>
        </div>
        <div class="adm-card lxan-card">
          <div class="adm-card-head"><div><div class="adm-card-title">Browsers</div><div class="adm-card-sub">share of page views</div></div></div>
          <div class="adm-card-body" style="padding:0"><div id="lxanBrw" class="lxan-box"><div class="lxadm-empty">Loading&hellip;</div></div></div>
        </div>
        <div class="adm-card lxan-card">
          <div class="adm-card-head"><div><div class="adm-card-title">Operating systems</div><div class="adm-card-sub">share of page views</div></div></div>
          <div class="adm-card-body" style="padding:0"><div id="lxanOs" class="lxan-box"><div class="lxadm-empty">Loading&hellip;</div></div></div>
        </div>
      </div>

      <div class="lxan-about" id="lxanAbout"></div>
`;

// Natural Earth 1:110m (world-atlas), projected once to an SVG with each country tagged by its ISO code
// (generated with d3-geo; see the lumoscore-admin-analytics memory for the recipe). Built in, so the page loads no map library.
const WORLD = fs.readFileSync(require('path').join(__dirname, '..', '_data', 'world-110m.svg'), 'utf8');

const MOB = `
      <div class="mob-page-head"><h1 class="mob-page-title">Analytics</h1></div>
      <div class="lxadm-note">Traffic figures read from Cloudflare Web Analytics. Open the admin on a computer for the full breakdown.</div>
      <div class="adm-card"><div class="adm-card-body" style="padding:0"><div id="lxanPages"><div class="lxadm-empty">Loading&hellip;</div></div></div></div>
`;


const CSS = `<style id="lx-adminanalytics-css">
/* ONE SIZE FOR EVERY SHORT TEXT (RAZA 2026-09-22: "keep the text size of all the short text same and equal"): card notes,
   comparisons, subtitles, list shares, legends, city notes, the map key and the about box all use --lxan-s. Rows read
   one step larger (--lxan-r) because they are the content. */
.lxan-scope,.lxan-kpis,.lxan-card,.lxan-about,.lxan-drawer,.lxan-dim{--lxan-s:15.5px;--lxan-r:16px;--lxan-l:13.5px}
.lxan-seg{display:inline-flex;padding:3px;border-radius:11px;background:rgba(127,127,140,.12);border:1px solid var(--border)}
.lxan-seg button{appearance:none;border:0;background:transparent;color:var(--text-muted);font:700 14.5px/1 "Hanken Grotesk",system-ui,sans-serif;letter-spacing:.04em;padding:8px 13px;border-radius:8px;cursor:pointer}
.lxan-seg button.on{background:var(--accent,#ea6a2c);color:#fff}
.lxan-seg button:focus-visible{outline:2px solid var(--accent,#ea6a2c);outline-offset:2px}
.lxan-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-bottom:18px}
.lxan-kpi{background:var(--surface,#16161b);border:1px solid var(--border);border-radius:14px;padding:16px 18px;min-width:0}
.lxan-kl{font:700 var(--lxan-l)/1 "Hanken Grotesk",system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted)}
.lxan-kvrow{display:flex;align-items:flex-end;justify-content:space-between;gap:10px}
.lxan-kv{margin-top:10px;font:800 28px/1.1 "Hanken Grotesk",system-ui,sans-serif;color:var(--text);font-variant-numeric:tabular-nums}
.lxan-kd{margin-top:7px;min-height:19px;font:700 var(--lxan-s)/1.4 "Hanken Grotesk",system-ui,sans-serif;font-variant-numeric:tabular-nums}
.lxan-kd .up{color:#35c07f}.lxan-kd .dn{color:#ef5f5f}.lxan-kd .fl{color:var(--text-muted)}
.lxan-kd small{font-size:var(--lxan-s);font-weight:500;color:var(--text-muted);margin-left:5px}
.lxan-kf{margin-top:5px;font-size:var(--lxan-s);line-height:1.5;color:var(--text-muted)}
.lxan-spark{flex:0 1 110px;height:34px;min-width:60px}
.lxan-spark svg{display:block;width:100%;height:100%;overflow:visible}
.lxan-card .adm-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.lxan-card .adm-card-sub{font-size:var(--lxan-s);line-height:1.45;font-weight:500;color:var(--text-muted);margin-top:4px}
.lxan-legend{display:flex;gap:14px;align-items:center;font-size:var(--lxan-s);color:var(--text-muted);white-space:nowrap}
.lxan-key{display:inline-block;width:10px;height:10px;border-radius:2px;background:#ea6a2c;margin-right:6px;vertical-align:-1px}
.lxan-key.vis{background:#3fc1b0}
.lxan-area{position:relative}
.lxan-area svg{display:block;width:100%;height:auto;overflow:visible}
.lxan-area .ax{fill:var(--text-muted,#8a8fa3);font:500 14px "Hanken Grotesk",system-ui,sans-serif}
.lxan-area .gl{stroke:rgba(127,127,140,.16);stroke-width:1}
.lxan-area .xh{stroke:rgba(127,127,140,.45);stroke-width:1;stroke-dasharray:3 3}
.lxan-atip{position:absolute;top:6px;pointer-events:none;white-space:nowrap;background:var(--text,#0e0e10);color:var(--surface,#fff);font:600 var(--lxan-s)/1.45 "Hanken Grotesk",system-ui,sans-serif;padding:7px 10px;border-radius:8px;transform:translateX(-50%);opacity:0;transition:opacity .1s;z-index:5}
.lxan-atip i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
.lxan-top{display:grid;grid-template-columns:minmax(0,2fr) minmax(280px,1fr);gap:18px;margin-bottom:18px;align-items:stretch}
@media (max-width:1100px){.lxan-top{grid-template-columns:1fr}}
.lxan-stack{display:grid;gap:18px;align-content:start}
.lxan-mapwrap{position:relative}
.lxan-map{display:block;width:100%;height:auto}
.lxan-map path{fill:rgba(127,127,140,.16);stroke:var(--surface,#16161b);stroke-width:.6;transition:fill .15s}
.lxan-map path.has{cursor:pointer}
.lxan-map path.has:hover,.lxan-map path.sel{stroke:#fff;stroke-width:1.1}
.lxan-maptip{position:absolute;pointer-events:none;white-space:nowrap;background:var(--text,#0e0e10);color:var(--surface,#fff);font:600 var(--lxan-s)/1.45 "Hanken Grotesk",system-ui,sans-serif;padding:7px 10px;border-radius:8px;transform:translate(-50%,-120%);opacity:0;transition:opacity .1s;z-index:5}
.lxan-mapkey{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:var(--lxan-s);color:var(--text-muted)}
.lxan-mapkey i{flex:0 0 120px;height:7px;border-radius:4px;background:linear-gradient(90deg,rgba(234,106,44,.18),rgba(234,106,44,1))}
.lxan-chan{display:grid;gap:12px}
.lxan-chrow{display:grid;grid-template-columns:118px 1fr auto;align-items:center;gap:10px;font-size:var(--lxan-r)}
.lxan-chrow b{font-weight:700;color:var(--text)}
.lxan-chrow .bar{height:10px;border-radius:5px;background:rgba(127,127,140,.14);overflow:hidden}
.lxan-chrow .bar span{display:block;height:100%;border-radius:5px}
.lxan-chrow .v{font-variant-numeric:tabular-nums;font-weight:700;color:var(--text);min-width:84px;text-align:right}
.lxan-chrow .v small{font-size:var(--lxan-s);font-weight:500;color:var(--text-muted);margin-left:5px}
.lxan-donutwrap{display:flex;align-items:center;gap:18px}
.lxan-donutwrap svg{flex:0 0 132px;width:132px;height:132px}
.lxan-dleg{display:grid;gap:9px;font-size:var(--lxan-r);min-width:0}
.lxan-dleg div{display:flex;align-items:center;gap:8px}
.lxan-dleg i{flex:0 0 10px;height:10px;border-radius:3px}
.lxan-dleg b{margin-left:auto;padding-left:10px;font-variant-numeric:tabular-nums}
/* EQUAL BOXES (RAZA: "The box size for Top pages, Traffic Sources, browsers, operating system should be the same ... scrolled
   down rather than vertically increasing ... pagination"): four columns of one fixed height; the rows scroll inside, and
   a pager under them steps through the rest. */
.lxan-quad{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:18px;align-items:stretch}
.lxan-box{display:flex;flex-direction:column;height:520px}
.lxan-box-geo{height:560px}
.lxan-rows{flex:1 1 auto;overflow-y:auto;min-height:0;-webkit-overflow-scrolling:touch;touch-action:pan-y}
.lxan-pager{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 14px;border-top:1px solid var(--border);font-size:var(--lxan-s);color:var(--text-muted);font-variant-numeric:tabular-nums}
.lxan-pager button{appearance:none;border:1px solid var(--border);background:transparent;color:var(--text);font:600 var(--lxan-s)/1 "Hanken Grotesk",system-ui,sans-serif;padding:7px 11px;border-radius:8px;cursor:pointer}
.lxan-pager button:disabled{opacity:.35;cursor:default}
.lxan-row{display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--border)}
.lxan-rows .lxan-row:last-child{border-bottom:0}
.lxan-name{flex:1 1 auto;min-width:0;font-size:var(--lxan-r);color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lxan-name .m{color:var(--text-muted);font-size:var(--lxan-s)}
.lxan-n{flex:0 0 auto;min-width:44px;text-align:right;font-variant-numeric:tabular-nums;font-weight:700;font-size:var(--lxan-r);color:var(--text)}
.lxan-pc{flex:0 0 58px;text-align:right;font-variant-numeric:tabular-nums;font-size:var(--lxan-s);color:var(--text-muted)}
.lxan-track{flex:0 0 72px;height:6px;border-radius:3px;background:rgba(127,127,140,.16);overflow:hidden}
.lxan-fill{height:100%;background:var(--accent,#ea6a2c);border-radius:3px}
.lxan-link{cursor:pointer}
.lxan-link:hover{background:rgba(127,127,140,.07)}
.lxan-link:hover .lxan-name{color:var(--accent,#ea6a2c)}
.lxan-link:focus-visible{outline:2px solid var(--accent,#ea6a2c);outline-offset:-2px}
.lxan-flag{flex:0 0 auto;width:22px;height:16px;border-radius:3px;object-fit:cover;box-shadow:0 0 0 1px rgba(127,127,140,.25)}
.lxan-cc{flex:0 0 auto;width:22px;height:16px;border-radius:3px;background:rgba(127,127,140,.2);color:var(--text-muted);font:700 10px/16px ui-monospace,Menlo,monospace;text-align:center}
.lxan-ctry{cursor:pointer;user-select:none}
.lxan-ctry:hover{background:rgba(127,127,140,.07)}
.lxan-ctry:focus-visible{outline:2px solid var(--accent,#ea6a2c);outline-offset:-2px}
.lxan-chev{flex:0 0 auto;width:14px;color:var(--text-muted);transition:transform .15s;font-size:11px}
.lxan-ctry.open .lxan-chev{transform:rotate(90deg)}
.lxan-cities{background:rgba(127,127,140,.06);border-bottom:1px solid var(--border)}
.lxan-cities .lxan-row{padding:9px 16px 9px 64px;border-bottom:1px solid rgba(127,127,140,.12)}
.lxan-cnote{padding:11px 16px 13px 64px;font-size:var(--lxan-s);line-height:1.55;color:var(--text-muted)}
.lxan-livecard .adm-card-title{display:flex;align-items:center;gap:9px}
.lxan-dot{width:9px;height:9px;border-radius:50%;background:#35c07f;box-shadow:0 0 0 0 rgba(53,192,127,.6);animation:lxanPulse 2s infinite}
@keyframes lxanPulse{70%{box-shadow:0 0 0 9px rgba(53,192,127,0)}100%{box-shadow:0 0 0 0 rgba(53,192,127,0)}}
@media (prefers-reduced-motion:reduce){.lxan-dot{animation:none}}
.lxan-livebig{font:800 30px/1 "Hanken Grotesk",system-ui,sans-serif;color:var(--text);font-variant-numeric:tabular-nums}
.lxan-live{max-height:320px;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y}
/* The quiet state sizes to its own content instead of holding the live list's height open. */
.lxan-quiet{display:flex;align-items:center;gap:16px;padding:18px 20px;flex-wrap:wrap}
.lxan-quiet-i{flex:0 0 auto;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  background:rgba(127,127,140,.10);color:var(--text-muted)}
.lxan-quiet-m{flex:1 1 260px;min-width:0;display:flex;flex-direction:column;gap:3px}
.lxan-quiet-m b{font:700 14.5px/1.3 "Hanken Grotesk",system-ui,sans-serif;color:var(--text)}
.lxan-quiet-m span{font-size:13px;line-height:1.5;color:var(--text-muted)}
.lxan-quiet-m code{font:500 12.5px/1 ui-monospace,SFMono-Regular,Menlo,monospace;padding:2px 5px;border-radius:5px;
  background:rgba(127,127,140,.12);color:var(--text-soft,#6b6b76)}
.lxan-quiet-k{display:flex;gap:26px;flex:0 0 auto;margin-left:auto}
.lxan-quiet-k div{display:flex;flex-direction:column;align-items:flex-end}
.lxan-quiet-k b{font:800 20px/1.1 "Hanken Grotesk",system-ui,sans-serif;color:var(--text);font-variant-numeric:tabular-nums}
.lxan-quiet-k span{font-size:11.5px;color:var(--text-muted);letter-spacing:.02em}
@media(max-width:620px){.lxan-quiet-k{margin-left:0;width:100%;justify-content:space-between}}
.lxan-live .lxan-row{gap:10px}
.lxan-livrow{cursor:pointer;user-select:none}
.lxan-livrow:hover{background:rgba(127,127,140,.07)}
.lxan-livrow.open .lxan-chev{transform:rotate(90deg)}
.lxan-jrn .lxan-row{padding-left:46px}
.lxan-ago{flex:0 0 auto;font-size:var(--lxan-s);color:var(--text-muted);font-variant-numeric:tabular-nums;min-width:74px;text-align:right}
.lxan-dev{flex:0 0 auto;font-size:var(--lxan-s);color:var(--text-muted);text-transform:capitalize;min-width:64px}
.lxan-id{flex:0 0 auto;font:600 12px/1 ui-monospace,Menlo,Consolas,monospace;color:var(--text-muted);background:rgba(127,127,140,.14);padding:4px 6px;border-radius:6px}
.lxan-about{margin-top:18px;padding:16px 18px;border:1px dashed var(--border);border-radius:14px;font-size:var(--lxan-s);line-height:1.65;color:var(--text-muted)}
.lxan-about b{color:var(--text)}
/* PER-PAGE ANALYTICS (RAZA: "When I click on a URL in the top pages box ... analytics related only to that specific URL"): a
   panel that slides in from the right over the dashboard, so the page list stays where it was. */
.lxan-dim{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9990;opacity:0;pointer-events:none;transition:opacity .18s}
.lxan-dim.on{opacity:1;pointer-events:auto}
.lxan-drawer{position:fixed;top:0;right:0;bottom:0;width:min(760px,100%);background:var(--bg,#0e0e12);border-left:1px solid var(--border);z-index:9991;transform:translateX(100%);transition:transform .22s ease;display:flex;flex-direction:column;box-shadow:-24px 0 60px rgba(0,0,0,.45)}
.lxan-drawer.on{transform:none}
.lxan-dh{flex:0 0 auto;display:flex;align-items:flex-start;gap:12px;padding:18px 20px;border-bottom:1px solid var(--border)}
.lxan-dh .t{flex:1 1 auto;min-width:0}
.lxan-dh .k{font:700 var(--lxan-l)/1 "Hanken Grotesk",system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted)}
.lxan-dh .p{margin-top:8px;font:700 17px/1.35 ui-monospace,Menlo,Consolas,monospace;color:var(--text);word-break:break-all}
.lxan-dh .s{margin-top:6px;font-size:var(--lxan-s);color:var(--text-muted)}
.lxan-dh .s a{color:var(--accent,#ea6a2c);text-decoration:none;font-weight:600}
.lxan-dx{flex:0 0 auto;appearance:none;border:1px solid var(--border);background:transparent;color:var(--text);width:36px;height:36px;border-radius:10px;font-size:18px;line-height:1;cursor:pointer}
/* a stacked column, not a grid: a grid of fixed height squeezed the chart and country sections to 2px */
.lxan-db{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;overscroll-behavior:contain;padding:18px 20px 28px;display:flex;flex-direction:column;gap:16px}
.lxan-db > *{flex:0 0 auto}
.lxan-dk{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
@media (max-width:640px){.lxan-dk{grid-template-columns:repeat(2,minmax(0,1fr))}}
.lxan-dk .lxan-kpi{padding:13px 14px}
.lxan-dk .lxan-kv{font-size:22px}
.lxan-sec{background:var(--surface,#16161b);border:1px solid var(--border);border-radius:14px;overflow:hidden}
.lxan-sec h4{margin:0;padding:13px 16px;font:700 16px/1.3 "Hanken Grotesk",system-ui,sans-serif;color:var(--text);border-bottom:1px solid var(--border)}
.lxan-sec h4 span{display:block;margin-top:3px;font-size:var(--lxan-s);font-weight:500;color:var(--text-muted)}
.lxan-sec .pad{padding:14px 16px}
/* in the panel a box is only as tall as its rows, up to a limit, so a short list does not leave a scroll trap */
.lxan-sec .lxan-box{height:auto;max-height:420px}
.lxan-d2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
@media (max-width:640px){.lxan-d2{grid-template-columns:1fr}}
.lxan-dload{padding:40px 0;text-align:center;font-size:var(--lxan-s);color:var(--text-muted)}
</style>`;


const SCRIPT = '<script id="lx-adminanalytics">' + `(function(){
if(window.__lxAnalytics)return; window.__lxAnalytics=1;
function q(s,r){return (r||document).querySelector(s);}
function qa(s,r){return [].slice.call((r||document).querySelectorAll(s));}
function esc(s){return (String(s==null?"":s).replace(/[<>&"]/g,function(c){return c==="<"?"&lt;":c===">"?"&gt;":c==="&"?"&amp;":"&quot;";})).split(String.fromCharCode(39)).join("&#39;");}
function isPage(){var t=((q(".admin-page-title")||q(".mob-page-title")||{}).textContent||"").trim();return t.indexOf("Analytics")===0;}
function num(n){return (+n||0).toLocaleString();}
function pctTxt(v){ return (v>=10?v.toFixed(0):v.toFixed(1))+"%"; }
function setT(sel,t,r){var e=q(sel,r); if(e)e.textContent=t;}
function setH(sel,h,r){var e=q(sel,r); if(e)e.innerHTML=h;}
var RANGE="30d", LAST=null, UID=0;
try{ var rs=localStorage.getItem("lx.admin.anRange"); if(rs==="24h"||rs==="7d"||rs==="30d"||rs==="90d") RANGE=rs; }catch(_){}
var RLABEL={"24h":"last 24 hours","7d":"last 7 days","30d":"last 30 days","90d":"last 90 days"};
var RPREV={"24h":"the 24 hours before","7d":"the 7 days before","30d":"the 30 days before","90d":"the 90 days before"};
var C_VIEW="#ea6a2c", C_VISIT="#3fc1b0", PAL=["#ea6a2c","#3fc1b0","#8b7cf6","#e3a008","#5b8def","#ef5f8f"];
var PAGE=20;

var DN=null; try{ DN=new Intl.DisplayNames(["en"],{type:"region"}); }catch(_){}
function cname(cc){ cc=String(cc||"").toUpperCase(); if(!cc||cc==="(NONE)"||cc==="XX") return "Unknown"; if(cc==="T1") return "Tor network"; try{ var n=DN&&DN.of(cc); if(n&&n!==cc) return n; }catch(_){} return cc; }
function flag(cc){ cc=String(cc||"").toLowerCase(); if(!/^[a-z][a-z]$/.test(cc)) return "<span class='lxan-cc'>?</span>";
  return "<img class='lxan-flag' alt='' loading='lazy' src='https://flagcdn.com/w40/"+cc+".png' data-cc='"+cc.toUpperCase()+"'>"; }
function flagFallback(root){ qa("img.lxan-flag",root).forEach(function(im){ if(im.__lx) return; im.__lx=1;
  im.addEventListener("error",function(){ var s=document.createElement("span"); s.className="lxan-cc"; s.textContent=im.getAttribute("data-cc")||"?"; if(im.parentNode) im.parentNode.replaceChild(s,im); }); }); }
function sinceText(own){ if(!own||!own.since) return "from the moment it went live"; return "since "+new Date(own.since).toLocaleString(undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}); }

function delta(el,cur,prev,opts){ if(!el) return; opts=opts||{};
  if(prev==null||!(prev>0)){ el.innerHTML=(cur>0&&prev===0)?"<span class='fl'>new</span><small>vs "+esc(RPREV[RANGE])+"</small>":""; return; }
  var d=opts.points?(cur-prev):((cur-prev)/prev*100);
  var good=opts.lowerIsBetter?d<0:d>0, flat=Math.abs(d)<0.5;
  var arrow=flat?"\\u2192":(d>0?"\\u25b2":"\\u25bc");
  var txt=opts.points?(Math.abs(d).toFixed(1)+" pts"):(Math.abs(d)>=999?"999%+":(Math.abs(d).toFixed(Math.abs(d)<10?1:0)+"%"));
  el.innerHTML="<span class='"+(flat?"fl":(good?"up":"dn"))+"'>"+arrow+" "+txt+"</span><small>vs "+esc(RPREV[RANGE])+"</small>"; }

// A LIST THAT PAGES (20 rows a page) inside a box of fixed height that scrolls. opts.link marks rows as clickable.
function list(el,rows,total,fmt,opts){
  if(!el)return; opts=opts||{};
  rows=(rows||[]).filter(function(r){ return (r.count||0)>0; });
  if(!rows.length){ el.innerHTML="<div class='lxadm-empty'>Nothing in this period.</div>"; return; }
  var max=rows.reduce(function(m,r){ return Math.max(m,r.count||0); },0)||1, pages=Math.ceil(rows.length/PAGE);
  var pg=Math.min(el.__pg||0,pages-1);
  function draw(){
    var slice=rows.slice(pg*PAGE,(pg+1)*PAGE);
    var html="<div class='lxan-rows'>"+slice.map(function(r){
      var w=Math.max(2,Math.round((r.count/max)*100)), sh=total>0?(r.count/total*100):0;
      return "<div class='lxan-row"+((opts.link||opts.src)?" lxan-link":"")+"'"+(opts.link?(" tabindex='0' role='button' data-path='"+esc(r.key)+"'"):(opts.src?(" tabindex='0' role='button' aria-expanded='false' data-ref='"+esc(r.key)+"'"):""))+">"+(opts.src?"<span class='lxan-chev'>\\u25b6</span>":"")+"<div class='lxan-name' title='"+esc(r.key)+"'>"+(fmt?fmt(r.key):esc(r.key))+"</div>"
        +"<div class='lxan-track'><div class='lxan-fill' style='width:"+w+"%'></div></div>"
        +"<div class='lxan-pc'>"+pctTxt(sh)+"</div><div class='lxan-n'>"+num(r.count)+"</div></div>";
    }).join("")+"</div>";
    if(pages>1) html+="<div class='lxan-pager'><button type='button' data-p='-1'"+(pg===0?" disabled":"")+">\\u2039 Prev</button><span>"+num(pg*PAGE+1)+"\\u2013"+num(Math.min(rows.length,(pg+1)*PAGE))+" of "+num(rows.length)+"</span><button type='button' data-p='1'"+(pg>=pages-1?" disabled":"")+">Next \\u203a</button></div>";
    else html+="<div class='lxan-pager'><span>"+num(rows.length)+" "+(rows.length===1?"row":"rows")+"</span><span></span></div>";
    el.innerHTML=html; el.__pg=pg;
  }
  draw();
  if(!el.__pgw){ el.__pgw=1; el.addEventListener("click",function(e){ var b=e.target&&e.target.closest&&e.target.closest("button[data-p]"); if(!b||b.disabled) return;
    el.__pg=(el.__pg||0)+(+b.getAttribute("data-p")); if(el.__redraw) el.__redraw(); var rw=q(".lxan-rows",el); if(rw) rw.scrollTop=0; }); }
  el.__redraw=function(){ pg=Math.max(0,Math.min(el.__pg||0,pages-1)); draw(); };
}

var CH_LABEL={Direct:"Direct",Search:"Search engine","AI assistants":"AI assistant",Social:"Social","Other sites":"Website"};
function refName(k){ var c=channelOf(k); return refBase(k)+(c&&c!=="Direct"?" <span class='m'>· "+CH_LABEL[c]+"</span>":""); }
function refBase(k){
  if(k==="lumoscore.com")return "lumoscore.com <span class='m'>(moving between pages)</span>";
  if(k==="(none)"||!k)return "Direct <span class='m'>(typed, bookmarked or an app)</span>";
  if(k==="t.co")return "X / Twitter <span class='m'>t.co</span>";
  if(k.indexOf("com.google.android")===0)return "Google app <span class='m'>(Android)</span>";
  if(/(^|[.])google[.]/.test(k))return "Google <span class='m'>"+esc(k)+"</span>";
  return esc(k);
}
// TRAFFIC SOURCES = WHERE VISITS CAME FROM (RAZA 2026-09-22: every page showed "lumoscore.com" as its main source). Cloudflare
// gives each PAGE VIEW's referrer, and after the first page that is the previous page of this site. Ranked by visits instead
// -- sum.visits, the page views that arrived from another site or from nowhere -- internal moves drop out by definition.
// EVERY SOURCE, NOT ONLY THE ONES CLOUDFLARE COUNTS A VISIT FOR (RAZA 2026-09-22: "only showing 7 traffic sources ...
// i need to view all"). Two reasons rows were missing: Cloudflare rounds small numbers, so a real referrer could report
// visits 0 and be dropped; and Cloudflare samples, so a rare referrer may not reach it at all. For a site OTHER than our
// own every page view it refers IS an arrival, so the larger of the two figures is the honest one -- and LumosCore's own
// record (exact, unsampled, from the day it went live) is merged in, so a source Cloudflare missed still appears.
function sources(d){
  var out={}, own=(d.own&&d.own.refs)||[];
  (d.topReferers||[]).forEach(function(r){ var k=String(r.key||""); if(k.toLowerCase()==="lumoscore.com") return;
    var v=Math.max((typeof r.visits==="number")?r.visits:0,(k==="(none)"?0:(r.count||0)));
    if(v>0) out[k]={key:k,count:v,cf:true}; });
  own.forEach(function(r){ var k=String(r.ref||""); if(!k||k.toLowerCase()==="lumoscore.com") return;
    if(out[k]){ out[k].count=Math.max(out[k].count,r.views||0); out[k].own=true; }
    else out[k]={key:k,count:r.views||0,own:true}; });
  return Object.keys(out).map(function(k){ return out[k]; }).filter(function(r){ return r.count>0; })
    .sort(function(a,b){ return b.count-a.count; });
}
function pageName(k){ return k==="/"?"/ <span class='m'>(home)</span>":esc(k); }

function buckets(d){
  var map={}; (d.series||[]).forEach(function(x){ map[String(x.t||"").slice(0,d.hourly?13:10)]=x; });
  var out=[], end=new Date(d.end), t=new Date(d.start);
  if(d.hourly){ t.setUTCMinutes(0,0,0); t=new Date(t.getTime()+3600000); }
  else { t=new Date(Date.UTC(t.getUTCFullYear(),t.getUTCMonth(),t.getUTCDate())); t=new Date(t.getTime()+86400000); }
  var step=d.hourly?3600000:86400000, n=0;
  while(t<=end&&n<400){ var key=t.toISOString().slice(0,d.hourly?13:10); var x=map[key]||{views:0,visits:0};
    out.push({t:new Date(t.getTime()),views:x.views||0,visits:x.visits||0}); t=new Date(t.getTime()+step); n++; }
  return out;
}
function when(b,hourly,long){ return hourly
  ? b.t.toLocaleString(undefined,long?{weekday:"short",hour:"2-digit",minute:"2-digit"}:{hour:"2-digit",minute:"2-digit"})
  : b.t.toLocaleDateString(undefined,long?{weekday:"short",month:"short",day:"numeric"}:{month:"short",day:"numeric"}); }
function nice(m){ if(!(m>0)) return 4; var e=Math.pow(10,Math.floor(Math.log(m)/Math.LN10)), f=m/e; return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*e; }
function short(n){ n=+n||0; return n>=1e6?(n/1e6).toFixed(n>=1e7?0:1)+"M":n>=1e3?(n/1e3).toFixed(n>=1e4?0:1)+"k":String(Math.round(n)); }
function smooth(pts,yMin,yMax){ if(!pts.length) return ""; var d="M"+pts[0][0].toFixed(1)+","+pts[0][1].toFixed(1);
  function cy(v){ return Math.max(yMin,Math.min(yMax,v)).toFixed(1); }
  for(var i=0;i<pts.length-1;i++){ var p0=pts[i-1]||pts[i], p1=pts[i], p2=pts[i+1], p3=pts[i+2]||p2;
    d+=" C"+(p1[0]+(p2[0]-p0[0])/6).toFixed(1)+","+cy(p1[1]+(p2[1]-p0[1])/6)+" "+(p2[0]-(p3[0]-p1[0])/6).toFixed(1)+","+cy(p2[1]-(p3[1]-p1[1])/6)+" "+p2[0].toFixed(1)+","+p2[1].toFixed(1); }
  return d; }
function areaChart(el,d,H0){
  if(!el) return; var bs=buckets(d);
  if(!bs.length||!bs.some(function(b){ return b.views>0; })){ el.innerHTML="<div class='lxadm-empty'>No traffic in this period.</div>"; return; }
  // drawn at its real on-screen width, so the 12px axis labels stay 12px in the narrower per-page panel too
  var u=++UID, W=Math.max(360,Math.round(el.clientWidth||1000)),H=H0||280,L=54,R=14,T=16,Bm=34,iw=W-L-R,ih=H-T-Bm,n=bs.length;
  var top=nice(bs.reduce(function(m,b){ return Math.max(m,b.views); },0));
  function X(i){ return L+(n===1?iw/2:i*iw/(n-1)); } function Y(v){ return T+ih-(v/top)*ih; }
  var pv=bs.map(function(b,i){ return [X(i),Y(b.views)]; }), pi=bs.map(function(b,i){ return [X(i),Y(b.visits)]; });
  var base=(T+ih).toFixed(1), g="";
  for(var k=0;k<=4;k++){ var y=(T+ih*k/4).toFixed(1); g+="<line class='gl' x1='"+L+"' x2='"+(W-R)+"' y1='"+y+"' y2='"+y+"'/><text class='ax' x='"+(L-8)+"' y='"+(+y+4)+"' text-anchor='end'>"+short(top*(1-k/4))+"</text>"; }
  var kx=Math.min(7,n), xl="";
  for(var j=0;j<kx;j++){ var ix=Math.round(j*(n-1)/Math.max(1,kx-1)); xl+="<text class='ax' x='"+X(ix).toFixed(1)+"' y='"+(H-8)+"' text-anchor='"+(j===0?"start":j===kx-1?"end":"middle")+"'>"+esc(when(bs[ix],d.hourly,false))+"</text>"; }
  function area(p,id){ return "<path d='"+smooth(p,T,T+ih)+" L"+p[p.length-1][0].toFixed(1)+","+base+" L"+p[0][0].toFixed(1)+","+base+" Z' fill='url(#"+id+")'/>"; }
  el.innerHTML="<svg viewBox='0 0 "+W+" "+H+"' role='img' aria-label='Page views and visits over time'>"
    +"<defs><linearGradient id='gv"+u+"' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='"+C_VIEW+"' stop-opacity='.35'/><stop offset='1' stop-color='"+C_VIEW+"' stop-opacity='0'/></linearGradient>"
    +"<linearGradient id='gi"+u+"' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='"+C_VISIT+"' stop-opacity='.3'/><stop offset='1' stop-color='"+C_VISIT+"' stop-opacity='0'/></linearGradient></defs>"
    +g+xl+area(pv,"gv"+u)+area(pi,"gi"+u)
    +"<path d='"+smooth(pv,T,T+ih)+"' fill='none' stroke='"+C_VIEW+"' stroke-width='2.4' stroke-linejoin='round'/>"
    +"<path d='"+smooth(pi,T,T+ih)+"' fill='none' stroke='"+C_VISIT+"' stroke-width='2.2' stroke-linejoin='round'/>"
    +"<line class='xh' x1='0' x2='0' y1='"+T+"' y2='"+base+"' style='display:none'/>"
    +"<circle class='dv' r='4.5' fill='"+C_VIEW+"' stroke='#fff' stroke-width='1.5' style='display:none'/><circle class='di' r='4.5' fill='"+C_VISIT+"' stroke='#fff' stroke-width='1.5' style='display:none'/>"
    +"<rect class='hit' x='"+L+"' y='"+T+"' width='"+iw+"' height='"+ih+"' fill='transparent'/></svg><div class='lxan-atip'></div>";
  var svg=q("svg",el), hit=q(".hit",el), tip=q(".lxan-atip",el), xh=q(".xh",el), dv=q(".dv",el), di=q(".di",el);
  function hide(){ xh.style.display=dv.style.display=di.style.display="none"; tip.style.opacity="0"; }
  function show(e){ var r=svg.getBoundingClientRect(); if(!r.width) return; var x=(e.clientX-r.left)/r.width*W;
    var i=Math.max(0,Math.min(n-1,Math.round((x-L)/iw*(n-1)))), b=bs[i], xx=X(i).toFixed(1);
    xh.setAttribute("x1",xx); xh.setAttribute("x2",xx); xh.style.display="";
    dv.setAttribute("cx",xx); dv.setAttribute("cy",Y(b.views).toFixed(1)); dv.style.display="";
    di.setAttribute("cx",xx); di.setAttribute("cy",Y(b.visits).toFixed(1)); di.style.display="";
    tip.innerHTML="<div style='opacity:.7;margin-bottom:2px'>"+esc(when(b,d.hourly,true))+"</div><div><i style='background:"+C_VIEW+"'></i>"+num(b.views)+" page views</div><div><i style='background:"+C_VISIT+"'></i>"+num(b.visits)+" visits</div>";
    tip.style.left=Math.max(9,Math.min(91,X(i)/W*100))+"%"; tip.style.opacity="1"; }
  hit.addEventListener("mousemove",show); hit.addEventListener("mouseleave",hide);
  hit.addEventListener("touchstart",function(e){ if(e.touches&&e.touches[0]) show(e.touches[0]); },{passive:true});
}
function sparkline(el,vals,color){
  if(!el) return; if(!vals||vals.length<2){ el.innerHTML=""; return; }
  var mx=Math.max.apply(null,vals)||1, n=vals.length, pts=vals.map(function(v,i){ return [i*100/(n-1),30-(v/mx)*27-1.5]; });
  var line=smooth(pts,1.5,29), id="sp"+(++UID);
  el.innerHTML="<svg viewBox='0 0 100 30' preserveAspectRatio='none' aria-hidden='true'><defs><linearGradient id='"+id+"' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='"+color+"' stop-opacity='.35'/><stop offset='1' stop-color='"+color+"' stop-opacity='0'/></linearGradient></defs>"
    +"<path d='"+line+" L100,30 L0,30 Z' fill='url(#"+id+")'/><path d='"+line+"' fill='none' stroke='"+color+"' stroke-width='1.8' vector-effect='non-scaling-stroke'/></svg>";
}
var SEARCH_RE=/(^|[.])(google[.][a-z.]+|bing[.]com|duckduckgo[.]com|search[.]yahoo[.]com|yahoo[.]com|yandex[.][a-z.]+|baidu[.]com|ecosia[.]org|search[.]brave[.]com|startpage[.]com)$/i;
var SOCIAL_RE=/(^|[.])(t[.]co|x[.]com|twitter[.]com|facebook[.]com|fb[.]com|instagram[.]com|threads[.]net|threads[.]com|linkedin[.]com|lnkd[.]in|reddit[.]com|t[.]me|telegram[.]org|youtube[.]com|tiktok[.]com|discord[.]com|medium[.]com)$/i;
var AI_RE=/(^|[.])(chatgpt[.]com|chat[.]openai[.]com|openai[.]com|perplexity[.]ai|gemini[.]google[.]com|bard[.]google[.]com|claude[.]ai|copilot[.]microsoft[.]com|poe[.]com|you[.]com|phind[.]com|meta[.]ai|grok[.]com|chat[.]deepseek[.]com|deepseek[.]com|chat[.]mistral[.]ai|kimi[.]com|kagi[.]com)$/i;
function channelOf(k){ k=String(k||"").toLowerCase();
  if(!k||k==="(none)") return "Direct"; if(k==="lumoscore.com") return null;
  if(AI_RE.test(k)||k.indexOf("com.openai")===0) return "AI assistants";
  if(k.indexOf("com.google.android")===0||SEARCH_RE.test(k)) return "Search";
  if(SOCIAL_RE.test(k)||k.indexOf("org.telegram")===0||k.indexOf("com.twitter")===0) return "Social";
  return "Other sites"; }
function channels(el,d){
  if(!el) return; var sums={Direct:0,Search:0,"AI assistants":0,Social:0,"Other sites":0}, tot=0;
  (d.topReferers||[]).forEach(function(r){ var c=channelOf(r.key); if(!c) return; var v=(typeof r.visits==="number")?r.visits:(r.count||0); sums[c]+=v; tot+=v; });
  if(!tot){ el.innerHTML="<div class='lxadm-empty'>No visits in this period.</div>"; return; }
  var order=["Direct","Search","AI assistants","Social","Other sites"], cols={Direct:PAL[0],Search:PAL[1],"AI assistants":PAL[4],Social:PAL[2],"Other sites":PAL[3]};
  var mx=Math.max.apply(null,order.map(function(k){ return sums[k]; }))||1;
  el.innerHTML="<div class='lxan-chan'>"+order.map(function(k){ var v=sums[k];
    return "<div class='lxan-chrow'><b>"+k+"</b><div class='bar'><span style='width:"+Math.max(v?2:0,Math.round(v/mx*100))+"%;background:"+cols[k]+"'></span></div><div class='v'>"+num(v)+"<small>"+pctTxt(v/tot*100)+"</small></div></div>"; }).join("")+"</div>";
}
function donut(el,rows){
  if(!el) return; rows=(rows||[]).filter(function(r){ return (r.count||0)>0; });
  var tot=rows.reduce(function(a,r){ return a+r.count; },0);
  if(!tot){ el.innerHTML="<div class='lxadm-empty'>Nothing in this period.</div>"; return; }
  var off=25, segs=rows.map(function(r,i){ var pct=r.count/tot*100, s="<circle r='15.915' cx='21' cy='21' fill='none' stroke='"+PAL[i%PAL.length]+"' stroke-width='5.2' stroke-dasharray='"+Math.max(0,pct-0.6).toFixed(2)+" "+(100-Math.max(0,pct-0.6)).toFixed(2)+"' stroke-dashoffset='"+off.toFixed(2)+"'/>"; off-=pct; return s; }).join("");
  var lead=rows[0];
  el.innerHTML="<svg viewBox='0 0 42 42' role='img' aria-label='Devices'><circle r='15.915' cx='21' cy='21' fill='none' stroke='rgba(127,127,140,.14)' stroke-width='5.2'/>"+segs
    +"<text x='21' y='21.5' text-anchor='middle' style='font:800 7px Hanken Grotesk,system-ui,sans-serif;fill:var(--text,#fff)'>"+(lead.count/tot*100).toFixed(0)+"%</text>"
    +"<text x='21' y='27' text-anchor='middle' style='font:600 3.2px Hanken Grotesk,system-ui,sans-serif;fill:var(--text-muted,#8a8fa3)'>"+esc(String(lead.key||""))+"</text></svg>"
    +"<div class='lxan-dleg'>"+rows.map(function(r,i){ var k=String(r.key||""); return "<div><i style='background:"+PAL[i%PAL.length]+"'></i>"+esc(k.charAt(0).toUpperCase()+k.slice(1))+"<b>"+pctTxt(r.count/tot*100)+"</b></div>"; }).join("")+"</div>";
}

// COUNTRIES, each opening its cities; the same block serves the dashboard and the per-page panel
function countries(el,d){
  if(!el) return; el.__d=d;
  var rows=(d.countries||[]).filter(function(r){ return (r.count||0)>0; });
  if(!rows.length){ el.innerHTML="<div class='lxadm-empty'>Nothing in this period.</div>"; return; }
  var cities=(d.own&&d.own.cities)||{}, max=rows.reduce(function(m,r){ return Math.max(m,r.count||0); },0)||1, tot=d.pageViews||0;
  el.innerHTML="<div class='lxan-rows'>"+rows.map(function(r){
    var cc=String(r.key||"").toUpperCase(), w=Math.max(2,Math.round((r.count/max)*100)), nc=(cities[cc]||[]).length;
    return "<div class='lxan-row lxan-ctry' tabindex='0' role='button' aria-expanded='false' data-cc='"+esc(cc)+"'>"
      +"<span class='lxan-chev'>\\u25b6</span>"+flag(cc)
      +"<div class='lxan-name'>"+esc(cname(cc))+(nc?" <span class='m'>\\u00b7 "+nc+" "+(nc===1?"city":"cities")+"</span>":"")+"</div>"
      +"<div class='lxan-track'><div class='lxan-fill' style='width:"+w+"%'></div></div>"
      +"<div class='lxan-pc'>"+pctTxt(tot>0?r.count/tot*100:0)+"</div><div class='lxan-n'>"+num(r.count)+"</div></div>";
  }).join("")+"</div><div class='lxan-pager'><span>"+num(rows.length)+" "+(rows.length===1?"country":"countries")+"</span><span>cities: counted by LumosCore "+esc(sinceText(d.own))+"</span></div>";
  flagFallback(el);
  if(!el.__cw){ el.__cw=1;
    el.addEventListener("click",function(e){ var r=e.target&&e.target.closest&&e.target.closest(".lxan-ctry"); if(r) toggleCountry(el,r); });
    el.addEventListener("keydown",function(e){ if(e.key!=="Enter"&&e.key!==" ") return; var r=e.target&&e.target.closest&&e.target.closest(".lxan-ctry"); if(r){ e.preventDefault(); toggleCountry(el,r); } }); }
}
function toggleCountry(el,row){
  var open=row.classList.toggle("open"); row.setAttribute("aria-expanded",open?"true":"false");
  var nx=row.nextElementSibling; if(nx&&nx.classList.contains("lxan-cities")) nx.parentNode.removeChild(nx);
  if(!open) return;
  var d=el.__d||{}, own=d.own||{}, cc=row.getAttribute("data-cc"), cs=((own.cities||{})[cc]||[]).slice().sort(function(a,b){ return b.views-a.views; });
  var box=document.createElement("div"); box.className="lxan-cities";
  if(!cs.length){ box.innerHTML="<div class='lxan-cnote'>No cities recorded for "+esc(cname(cc))+" in this period yet. Cloudflare's analytics has no city data, so LumosCore counts cities itself, "+esc(sinceText(own))+".</div>"; }
  else { var mx=cs[0].views||1, tv=cs.reduce(function(a,c){ return a+(c.views||0); },0)||1;
    box.innerHTML=cs.map(function(c){ return "<div class='lxan-row'><div class='lxan-name'>"+esc(c.city||"Unknown city")+(c.region&&c.region!==c.city?" <span class='m'>"+esc(c.region)+"</span>":"")+"</div>"
        +"<div class='lxan-track'><div class='lxan-fill' style='width:"+Math.max(2,Math.round((c.views/mx)*100))+"%'></div></div>"
        +"<div class='lxan-pc'>"+pctTxt(c.views/tv*100)+"</div><div class='lxan-n' title='page views'>"+num(c.views)+"</div></div>"; }).join(""); }
  // No footnote under a populated city list (RAZA 2026-09-24). It repeated under EVERY country opened,
  // said the same thing each time, and explained the plumbing rather than the numbers -- the rows are
  // self-evident once they are there.
  //
  // The EMPTY-state note above is kept on purpose: it is the only thing standing between the reader and
  // a blank panel, and it answers the question that blank actually raises.
  row.parentNode.insertBefore(box,row.nextSibling);
}
// A SOURCE, OPENED (RAZA 2026-09-22: "it should tell which exact tweet or page brought that visit ... which search query").
// What each site lets the browser send decides what can be shown, and the note says so rather than leaving a gap:
// t.co sends the exact short link of the post's link (and X search finds the post from it); forums and blogs send
// their page; search engines send no search words at all (encrypted search), and AI assistants send only their address.
var SRC_NOTE={
  Search:"Search engines (Google, Bing, DuckDuckGo) have not passed the searched words to websites since search went encrypted, so no website can see which query brought a visit. Those searches are only in Google Search Console \\u2014 connecting it would show them here.",
  "AI assistants":"AI assistants send only their own address, not the conversation or question behind the link.",
  Direct:"A direct visit has no link behind it: the address was typed, bookmarked, or opened from an app, a message or an email.",
  Social:"", "Other sites":""};
function toggleSource(box,row){
  var open=row.classList.toggle("open"); row.setAttribute("aria-expanded",open?"true":"false");
  var nx=row.nextElementSibling; if(nx&&nx.classList.contains("lxan-srcd")) nx.parentNode.removeChild(nx);
  if(!open) return;
  var host=row.getAttribute("data-ref")||"", ch=channelOf(host)||"Other sites";
  var det=document.createElement("div"); det.className="lxan-cities lxan-srcd";
  row.parentNode.insertBefore(det,row.nextSibling);
  if(ch==="Direct"){ det.innerHTML="<div class='lxan-cnote'>"+SRC_NOTE.Direct+"</div>"; return; }
  det.innerHTML="<div class='lxan-cnote'>Reading the links from "+esc(host)+"\\u2026</div>";
  fetch("/lxapi/analytics?range="+encodeURIComponent(RANGE)+"&refhost="+encodeURIComponent(host)+(box.__ctx?("&path="+encodeURIComponent(box.__ctx)):"")+"&t="+Date.now())
    .then(function(r){ return r.json(); }).then(function(d){
      if(!det.parentNode) return;
      if(!d||d.error){ det.innerHTML="<div class='lxan-cnote'>Could not read the links: "+esc((d&&(d.messages&&d.messages.join("; ")||d.error))||"no answer")+"</div>"; return; }
      var rows=(d.refPaths||[]).slice().sort(function(a,b){ return b.visits-a.visits; });
      var withPath=rows.filter(function(r){ return r.ref&&r.ref!=="/"; });
      var html=rows.map(function(r){ var hasP=r.ref&&r.ref!=="/", url="https://"+host+(hasP?r.ref:"/");
        var label=hasP?(host+r.ref):(host+" <span class='m'>(address only)</span>");
        var extra=(host==="t.co"&&hasP)?(" \\u00b7 <a href='https://x.com/search?q="+encodeURIComponent("https://t.co"+r.ref)+"&f=live' target='_blank' rel='noopener noreferrer'>find the post on X \\u2197</a>"):"";
        return "<div class='lxan-row'><div class='lxan-name' style='white-space:normal'>"+(hasP?("<a href='"+esc(url)+"' target='_blank' rel='noopener noreferrer'>"+esc(host+r.ref)+"</a>"):label)+extra
          +" <span class='m'>\\u2192 "+esc(r.landing||"/")+"</span></div><div class='lxan-n' title='visits'>"+num(r.visits)+"</div></div>"; }).join("");
      var note=SRC_NOTE[ch]||((rows.length&&!withPath.length)?("This site shares only its address with the browser, not the page the link was on."):"");
      if(host==="t.co"&&withPath.length) note="Each t.co link is the short link X puts on a post. \\u201cFind the post on X\\u201d searches X for it; a post that has been deleted or is private will not show.";
      det.innerHTML=(html||"<div class='lxan-cnote'>No individual links recorded for this period.</div>")+(note?"<div class='lxan-cnote'>"+note+"</div>":"");
    }).catch(function(e){ if(det.parentNode) det.innerHTML="<div class='lxan-cnote'>Could not read the links: "+esc(e.message)+"</div>"; });
}
function mapPaint(d){
  var wrap=q("#lxanMap"); if(!wrap) return; var svg=q("svg",wrap); if(!svg) return;
  var m={}, mx=0; (d.countries||[]).forEach(function(r){ var cc=String(r.key||"").toUpperCase(); m[cc]=(m[cc]||0)+(r.count||0); if(m[cc]>mx) mx=m[cc]; });
  qa("path",svg).forEach(function(p){ var v=m[p.getAttribute("data-cc")]||0; p.__v=v; p.classList.toggle("has",v>0); p.classList.remove("sel");
    p.style.fill=v>0?("rgba(234,106,44,"+(0.18+0.82*Math.sqrt(v/(mx||1))).toFixed(3)+")"):""; });
  var nC=Object.keys(m).filter(function(k){ return m[k]>0; }).length;
  setT("#lxanMapSub",nC+" "+(nC===1?"country":"countries")+" \\u00b7 hover for figures, click for cities");
  if(wrap.__lx) return; wrap.__lx=1; var tip=q("#lxanMapTip");
  svg.addEventListener("mousemove",function(e){ var p=e.target; if(!p||p.tagName.toLowerCase()!=="path"){ tip.style.opacity="0"; return; }
    var cc=p.getAttribute("data-cc"), v=p.__v||0, tot=(LAST&&LAST.pageViews)||0, wr=wrap.getBoundingClientRect();
    tip.innerHTML=esc(cname(cc))+(v?(" \\u00b7 "+num(v)+" views \\u00b7 "+pctTxt(tot?v/tot*100:0)):" \\u00b7 no visits");
    tip.style.left=(e.clientX-wr.left)+"px"; tip.style.top=(e.clientY-wr.top)+"px"; tip.style.opacity="1"; });
  svg.addEventListener("mouseleave",function(){ tip.style.opacity="0"; });
  svg.addEventListener("click",function(e){ var p=e.target; if(!p||p.tagName.toLowerCase()!=="path"||!p.__v) return;
    var cc=p.getAttribute("data-cc"); qa("path.sel",svg).forEach(function(x){ x.classList.remove("sel"); }); p.classList.add("sel");
    var geo=q("#lxanGeo"), row=geo&&q(".lxan-ctry[data-cc='"+cc+"']",geo); if(!row) return;
    if(!row.classList.contains("open")) toggleCountry(geo,row);
    try{ row.scrollIntoView({block:"center",behavior:"smooth"}); }catch(_){ row.scrollIntoView(); } });
}
function bounceInto(valEl,deltaEl,noteEl,own,entry){
  var cur=own&&own.cur, prv=own&&own.prev;
  if(cur&&cur.sessions>0){ var br=cur.bounces/cur.sessions*100; valEl.textContent=br.toFixed(0)+"%";
    if(prv&&prv.sessions>0) delta(deltaEl,br,prv.bounces/prv.sessions*100,{points:true,lowerIsBetter:true}); else if(deltaEl) deltaEl.innerHTML="";
    if(noteEl) noteEl.textContent=num(cur.bounces)+" of "+num(cur.sessions)+" "+(entry?"visits that started here":"visits")+" left after one page"; }
  else { valEl.textContent="\\u2014"; if(deltaEl) deltaEl.innerHTML="";
    if(noteEl) noteEl.textContent=own&&own.error?("could not read our own visit log: "+own.error):("counting "+sinceText(own)+" \\u00b7 no visits recorded yet"); }
}

function render(d){
  LAST=d;
  if(d.range&&RLABEL[d.range]){ RANGE=d.range; qa("#lxanRange button").forEach(function(b){ b.classList.toggle("on",b.getAttribute("data-r")===RANGE); }); }
  var pv=d.pageViews||0, vi=d.visits||0, pp=d.prev||{};
  setT("#lxanVisits",num(vi)); delta(q("#lxanVisitsD"),vi,pp.visits);
  setT("#lxanViews",num(pv)); delta(q("#lxanViewsD"),pv,pp.pageViews);
  var per=vi>0?pv/vi:null, pper=(pp.visits>0)?pp.pageViews/pp.visits:null;
  setT("#lxanPer",per!=null?per.toFixed(1):"\\u2014"); if(per!=null&&pper!=null) delta(q("#lxanPerD"),per,pper); else setH("#lxanPerD","");
  bounceInto(q("#lxanBounce"),q("#lxanBounceD"),q("#lxanBounceF"),d.own,false);
  var bots=d.botViews||0, all=bots+pv; setT("#lxanBots",all>0?((bots/all*100).toFixed(bots/all<0.1?1:0)+"%"):"\\u2014");
  setH("#lxanBotsD",bots>0?("<span class='fl'>"+num(bots)+" crawler views</span>"):"");
  var bs=buckets(d), peak=bs.reduce(function(a,b){ return b.views>((a&&a.views)||0)?b:a; },null);
  setT("#lxanChartT",d.hourly?"Traffic by hour":"Traffic by day");
  setT("#lxanChartSub",(peak&&peak.views?("busiest: "+when(peak,d.hourly,true)+" \\u00b7 "+num(peak.views)+" views"):"no traffic in this period")+" \\u00b7 hover the chart for each "+(d.hourly?"hour":"day"));
  areaChart(q("#lxanChart"),d);
  sparkline(q("#lxanVisitsS"),bs.map(function(b){ return b.visits; }),C_VISIT); sparkline(q("#lxanViewsS"),bs.map(function(b){ return b.views; }),C_VIEW);
  mapPaint(d); channels(q("#lxanChan"),d); donut(q("#lxanDonut"),d.devices);
  var geo=q("#lxanGeo"); countries(geo,d);
  var nC=(d.countries||[]).filter(function(r){ return (r.count||0)>0; }).length;
  setT("#lxanGeoSub",nC+" "+(nC===1?"country":"countries")+" \\u00b7 tap one to see its cities");
  list(q("#lxanPages"),d.topPages,pv,pageName,{link:true});
  var src=sources(d), rb=q("#lxanRefs"); if(rb) rb.__ctx=""; list(rb,src,src.reduce(function(a,r){ return a+r.count; },0),refName,{src:true});
  // SAY HOW FAR BACK THIS ACTUALLY SEES. "Every site that sent visitors" over 90D reads as a complete
  // answer, and it is not: our own record only began when the counter was installed, and Cloudflare's
  // half is sampled, so a short list looks like a bug rather than the limit of what is knowable
  // (RAZA 2026-09-23: "it says 7 sources in 90 days which is not true"). Our own record IS exact for
  // the window it covers, so the honest line is the one that names that window.
  var rs=q("#lxanRefSub");
  if(rs){
    var msg=src.length+" source"+(src.length===1?"":"s")+" \\u00b7 Cloudflare (sampled) plus LumosCore\\u2019s own record";
    if(d.since){
      var st=(d.start!=null)?d.start:0;
      msg+=(d.since>st)
        ? (" \\u2014 exact only since "+new Date(d.since).toLocaleDateString()+", when the counter was installed; anything earlier in this period is Cloudflare\\u2019s sample alone")
        : " \\u2014 exact for this whole period";
    }
    rs.textContent=msg;
  }
  list(q("#lxanBrw"),d.browsers,pv);
  list(q("#lxanOs"),d.systems,pv);
  setT("#lxanSub","Cloudflare Web Analytics \\u00b7 people only \\u00b7 "+RLABEL[d.range||RANGE]);
  setH("#lxanAbout","<b>About these numbers.</b> Page views, visits, pages, sources, countries, devices, browsers and systems come from Cloudflare Web Analytics, with crawlers taken out. Cloudflare samples and rounds, so small figures arrive in tens, and a period can show page views with no visits \\u2014 that means every page was reached by moving around the site. "
    +"<b>Bounce rate and cities</b> are counted by LumosCore itself, "+esc(sinceText(d.own))+", because Cloudflare's analytics records neither: one anonymous note per page view with the page, where the visit came from, the approximate city Cloudflare attaches to the connection, and a random id that lasts for that browsing session. No IP address, cookie or wallet address is stored.");
}

// ---- per-page analytics: a panel that slides in from the right ----------------------------------------------------
var DRAW=null, DPATH="";
function drawer(){
  if(DRAW) return DRAW;
  var dim=document.createElement("div"); dim.className="lxan-dim";
  var dr=document.createElement("aside"); dr.className="lxan-drawer"; dr.setAttribute("role","dialog"); dr.setAttribute("aria-modal","true"); dr.setAttribute("aria-label","Page analytics");
  dr.innerHTML="<div class='lxan-dh'><div class='t'><div class='k'>Page analytics</div><div class='p' data-f='path'></div><div class='s' data-f='sub'></div></div><button type='button' class='lxan-dx' aria-label='Close'>\\u00d7</button></div><div class='lxan-db' data-f='body'></div>";
  document.body.appendChild(dim); document.body.appendChild(dr);
  function close(){ dim.classList.remove("on"); dr.classList.remove("on"); DPATH=""; }
  dim.addEventListener("click",close); q(".lxan-dx",dr).addEventListener("click",close);
  document.addEventListener("keydown",function(e){ if(e.key==="Escape"&&dr.classList.contains("on")) close(); });
  DRAW={dim:dim,dr:dr,close:close}; return DRAW;
}
function openPage(path){
  var D=drawer(); DPATH=path;
  q("[data-f=path]",D.dr).textContent=path;
  q("[data-f=sub]",D.dr).innerHTML=esc(RLABEL[RANGE])+" \\u00b7 <a href='https://lumoscore.com"+esc(path)+"' target='_blank' rel='noopener'>open the page \\u2197</a>";
  var body=q("[data-f=body]",D.dr); body.innerHTML="<div class='lxan-dload'>Reading this page's figures\\u2026</div>";
  D.dim.classList.add("on"); D.dr.classList.add("on"); body.scrollTop=0;
  var want=path;
  fetch("/lxapi/analytics?range="+encodeURIComponent(RANGE)+"&path="+encodeURIComponent(path)+"&t="+Date.now())
    .then(function(r){ return r.text(); }).then(function(t){ if(DPATH!==want) return; var d=null; try{ d=JSON.parse(t); }catch(_){}
      if(!d||d.error){ body.innerHTML="<div class='lxan-dload'>Could not read this page's figures"+(d&&d.error?(": "+esc(d.reason||(d.messages&&d.messages.join("; "))||d.message||d.error)):"")+"</div>"; return; }
      renderPage(body,d); })
    .catch(function(e){ if(DPATH===want) body.innerHTML="<div class='lxan-dload'>Could not read this page's figures: "+esc(e.message)+"</div>"; });
}
function renderPage(body,d){
  var pv=d.pageViews||0, vi=d.visits||0, pp=d.prev||{}, all=(LAST&&LAST.pageViews)||0;
  body.innerHTML=""
    +"<div class='lxan-dk'>"
    +"<div class='lxan-kpi'><div class='lxan-kl'>Page views</div><div class='lxan-kv'>"+num(pv)+"</div><div class='lxan-kd' data-f='dv'></div></div>"
    +"<div class='lxan-kpi'><div class='lxan-kl'>Visits</div><div class='lxan-kv'>"+num(vi)+"</div><div class='lxan-kd' data-f='di'></div></div>"
    +"<div class='lxan-kpi'><div class='lxan-kl'>Bounce rate</div><div class='lxan-kv' data-f='bv'>\\u2014</div><div class='lxan-kd' data-f='bd'></div><div class='lxan-kf' data-f='bn'></div></div>"
    +"<div class='lxan-kpi'><div class='lxan-kl'>Share of all views</div><div class='lxan-kv'>"+(all>0?pctTxt(pv/all*100):"\\u2014")+"</div><div class='lxan-kf'>of every page view on the site</div></div>"
    +"</div>"
    +"<div class='lxan-sec'><h4>Traffic over time<span>page views and visits for this page</span></h4><div class='pad'><div class='lxan-area' data-f='chart'></div></div></div>"
    +"<div class='lxan-sec'><h4>Countries<span>tap one to see its cities</span></h4><div class='lxan-box' data-f='geo'></div></div>"
    +"<div class='lxan-d2'>"
    +"<div class='lxan-sec'><h4>Traffic Sources<span>visits to this page by where they came from</span></h4><div class='lxan-box' data-f='refs'></div></div>"
    +"<div class='lxan-sec'><h4>Devices<span>share of page views</span></h4><div class='pad'><div class='lxan-donutwrap' data-f='dev'></div></div><div style='padding:0 16px 14px'><div data-f='chan'></div></div></div>"
    +"<div class='lxan-sec'><h4>Browsers<span>share of page views</span></h4><div class='lxan-box' data-f='brw'></div></div>"
    +"<div class='lxan-sec'><h4>Operating systems<span>share of page views</span></h4><div class='lxan-box' data-f='os'></div></div>"
    +"</div>";
  delta(q("[data-f=dv]",body),pv,pp.pageViews); delta(q("[data-f=di]",body),vi,pp.visits);
  bounceInto(q("[data-f=bv]",body),q("[data-f=bd]",body),q("[data-f=bn]",body),d.own,true);
  areaChart(q("[data-f=chart]",body),d,240);
  countries(q("[data-f=geo]",body),d);
  var src=sources(d), rb=q("[data-f=refs]",body); if(rb) rb.__ctx=d.path||""; list(rb,src,src.reduce(function(a,r){ return a+r.count; },0),refName,{src:true});
  donut(q("[data-f=dev]",body),d.devices);
  channels(q("[data-f=chan]",body),d);
  list(q("[data-f=brw]",body),d.browsers,pv);
  list(q("[data-f=os]",body),d.systems,pv);
}

// LIVE NOW: our own page views only -- Cloudflare's analytics is aggregated and arrives too late to answer "who is on the
// site now". Refreshed every 20s while the page is open and in front, paused when it is not, so a tab left open all day
// does not keep asking.
function ago(ts){ var s=Math.max(0,Math.round((Date.now()-ts)/1000)); if(s<15) return "just now"; if(s<60) return s+"s ago"; var m=Math.round(s/60); return m+(m===1?" min ago":" mins ago"); }
function liveTick(){
  var el=q("#lxanLiveRows"); if(!el) return;
  fetch("/lxapi/analytics?live=1&t="+Date.now()).then(function(r){ return r.json(); }).then(function(d){
    var L=(d&&d.live)||{}, rows=L.rows||[];
    setT("#lxanLiveN",String(L.sessions||0));
    setT("#lxanLiveSub",(L.sessions?((L.sessions===1?"1 person":num(L.sessions)+" people")+" in the last 5 minutes \u00b7 "+num(L.views||0)+" page "+((L.views||0)===1?"view":"views")):"nobody on the site in the last 5 minutes")+(L.error?(" \u00b7 "+L.error):""));
    // AN EMPTY WINDOW IS THE NORMAL STATE for a site this size, and it used to render as a tall blank
    // band with one grey sentence in it -- the single least useful thing on the page, taking the most
    // room (RAZA 2026-09-23). It now answers the two questions someone actually has when nobody is on:
    // when was the last person here, and how has today gone.
    if(!rows.length){
      var lt=L.last, td=L.today||{};
      var where=lt?[lt.city,lt.region&&lt.region!==lt.city?lt.region:"",cname(lt.country)].filter(Boolean).join(", "):"";
      el.innerHTML="<div class='lxan-quiet'>"
        +"<div class='lxan-quiet-i'><svg width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='9'/><path d='M12 7v5l3 2'/></svg></div>"
        +"<div class='lxan-quiet-m'><b>Nobody on the site right now.</b>"
        +(lt?("<span>Last visitor "+esc(ago(lt.ts))+(where?(" from "+esc(where)):"")+", on <code>"+esc(lt.path||"/")+"</code>.</span>")
             :"<span>No page view has been recorded yet.</span>")+"</div>"
        +"<div class='lxan-quiet-k'><div><b>"+num(td.sessions||0)+"</b><span>visitors today</span></div>"
        +"<div><b>"+num(td.views||0)+"</b><span>page views today</span></div></div></div>";
      if(lt&&lt.country)flagFallback(el);
      return;
    }
    el.innerHTML=rows.map(function(r){
      var where=[r.city,r.region&&r.region!==r.city?r.region:"",cname(r.country)].filter(Boolean).join(", ");
      return "<div class='lxan-row lxan-livrow' tabindex='0' role='button' aria-expanded='false' data-sid='"+esc(r.sid||"")+"'><span class='lxan-chev'>\u25b6</span>"+flag(r.country)+"<div class='lxan-name' title='"+esc(where)+"'>"+esc(where||"Unknown")+" <span class='m'>\u00b7 "+esc(r.path||"/")+"</span></div>"
        +"<div class='lxan-dev'>"+esc(r.device||"")+"</div><div class='lxan-id' title='a random id for this browsing session'>"+esc(r.id||"")+"</div><div class='lxan-ago'>"+esc(ago(r.ts))+"</div></div>"; }).join("");
    flagFallback(el);
    if(window.__lxLiveOpen){ var row=q(".lxan-livrow[data-sid='"+window.__lxLiveOpen+"']",el); if(row) toggleLive(el,row,true); }
  }).catch(function(){});
}
// THE VISITOR'S JOURNEY (RAZA 2026-09-22: "show their live activity, for eg: clicks and pages. just like ... Plausible"):
// the pages of this visit and the links and buttons pressed, newest first, from our own records.
function toggleLive(el,row,keep){
  var open=keep?true:!row.classList.contains("open");
  qa(".lxan-livrow.open",el).forEach(function(r){ if(r!==row){ r.classList.remove("open"); r.setAttribute("aria-expanded","false"); var n2=r.nextElementSibling; if(n2&&n2.classList.contains("lxan-jrn")) n2.parentNode.removeChild(n2); } });
  row.classList.toggle("open",open); row.setAttribute("aria-expanded",open?"true":"false");
  var nx=row.nextElementSibling; if(nx&&nx.classList.contains("lxan-jrn")) nx.parentNode.removeChild(nx);
  var sid=row.getAttribute("data-sid")||"";
  if(!open){ if(window.__lxLiveOpen===sid) window.__lxLiveOpen=""; return; }
  window.__lxLiveOpen=sid;
  var box=document.createElement("div"); box.className="lxan-cities lxan-jrn";
  box.innerHTML="<div class='lxan-cnote'>Reading this visit\u2026</div>";
  row.parentNode.insertBefore(box,row.nextSibling);
  fetch("/lxapi/analytics?session="+encodeURIComponent(sid)+"&t="+Date.now()).then(function(r){ return r.json(); }).then(function(d){
    if(!box.parentNode) return; var rows=((d&&d.journey)||{}).rows||[];
    if(!rows.length){ box.innerHTML="<div class='lxan-cnote'>Nothing recorded for this visit yet.</div>"; return; }
    box.innerHTML=rows.map(function(r){
      var when=new Date(r.ts).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit",second:"2-digit"});
      var what=r.kind==="page"?("<b>viewed</b> "+esc(r.path||"/")):("<b>clicked</b> \u201c"+esc(r.label||"a link")+"\u201d"+(r.href?(" <span class='m'>\u2192 "+esc(r.href)+"</span>"):"")+" <span class='m'>on "+esc(r.path||"/")+"</span>");
      return "<div class='lxan-row'><div class='lxan-name' style='white-space:normal'>"+what+"</div><div class='lxan-ago'>"+esc(when)+"</div></div>"; }).join("")
      +"<div class='lxan-cnote'>Pages and the labels of links and buttons pressed \u00b7 last 6 hours of this visit.</div>";
  }).catch(function(e){ if(box.parentNode) box.innerHTML="<div class='lxan-cnote'>Could not read this visit: "+esc(e.message)+"</div>"; });
}
function liveStart(){ if(window.__lxLiveT) return; liveTick(); window.__lxLiveT=setInterval(function(){ if(document.visibilityState==="visible") liveTick(); },20000);
  document.addEventListener("visibilitychange",function(){ if(document.visibilityState==="visible") liveTick(); }); }
function load(){
  qa("#lxanRange button").forEach(function(b){ b.classList.toggle("on",b.getAttribute("data-r")===RANGE); b.setAttribute("aria-selected",b.getAttribute("data-r")===RANGE?"true":"false"); });
  setT("#lxanSub","Reading Cloudflare Web Analytics\\u2026");
  qa(".lxan-box").forEach(function(b){ b.__pg=0; });
  var want=RANGE;
  fetch("/lxapi/analytics?range="+encodeURIComponent(RANGE)+"&t="+Date.now())
    .then(function(r){ return r.text(); })
    .then(function(t){ if(want!==RANGE) return; var d=null; try{ d=JSON.parse(t); }catch(_){}
      if(!d){ setT("#lxanSub","Could not read analytics \\u2014 this page has to be opened through the admin login."); return; }
      if(d.error){ setT("#lxanSub","Could not read analytics: "+(d.reason||(d.messages&&d.messages.join("; "))||d.message||d.error)); return; }
      render(d);
    })
    .catch(function(e){ setT("#lxanSub","Could not read analytics: "+e.message); });
}

function boot(){
  if(!isPage())return;
  var seg=q("#lxanRange");
  if(seg&&!seg.__lx){ seg.__lx=1; seg.addEventListener("click",function(e){ var b=e.target&&e.target.closest&&e.target.closest("button[data-r]"); if(!b) return;
    RANGE=b.getAttribute("data-r"); try{ localStorage.setItem("lx.admin.anRange",RANGE); }catch(_){} load(); }); }
  // ONE ROUTER, AT WINDOW CAPTURE (RAZA 2026-09-22: tapping some Top pages rows opened lumoscore-admin.pages.dev/bridge -> 404).
  // The site design carries a navigator that turns a clicked list row whose text looks like a route (/bridge, /dashboard)
  // into a page load, and it runs before any listener on the page itself; only window capture comes earlier
  // (lumoscore-lumosnav-row-hijack). Every click this page owns is handled here and then stopped, so it never sees them.
  if(!window.__lxAnRouter){ window.__lxAnRouter=1;
    function route(e){ var t=e.target; if(!t||!t.closest||!t.closest(".lxan-box,.lxan-drawer,.lxan-live")) return false;
      if(t.closest("a[href]")) return false;                                  // real links inside a row keep working
      var box=t.closest(".lxan-box"), b=t.closest("button[data-p]"), r;
      if(b&&box){ if(!b.disabled){ box.__pg=(box.__pg||0)+(+b.getAttribute("data-p")); if(box.__redraw) box.__redraw(); var rw=q(".lxan-rows",box); if(rw) rw.scrollTop=0; } return true; }
      if((r=t.closest(".lxan-livrow"))){ var lv=q("#lxanLiveRows"); if(lv){ toggleLive(lv,r); return true; } }
      if((r=t.closest(".lxan-ctry"))&&box){ toggleCountry(box,r); return true; }
      if((r=t.closest(".lxan-link[data-path]"))){ openPage(r.getAttribute("data-path")); return true; }
      if((r=t.closest(".lxan-link[data-ref]"))&&box){ toggleSource(box,r); return true; }
      return false; }
    window.addEventListener("click",function(e){ if(route(e)){ e.preventDefault(); e.stopImmediatePropagation(); } },true);
    window.addEventListener("keydown",function(e){ if((e.key==="Enter"||e.key===" ")&&route(e)){ e.preventDefault(); e.stopImmediatePropagation(); } },true);
  }
  var pg=q("#lxanPages");
  if(pg&&!pg.__lk){ pg.__lk=1;
    pg.addEventListener("click",function(e){ var r=e.target&&e.target.closest&&e.target.closest(".lxan-link[data-path]"); if(r) openPage(r.getAttribute("data-path")); });
    pg.addEventListener("keydown",function(e){ if(e.key!=="Enter"&&e.key!==" ") return; var r=e.target&&e.target.closest&&e.target.closest(".lxan-link[data-path]"); if(r){ e.preventDefault(); openPage(r.getAttribute("data-path")); } }); }
  load(); liveStart();
}
window.__lxAnLive=liveTick; window.__lxAnRender=render; window.__lxAnRenderPage=function(d){ var D=drawer(); DPATH=d.path||"/"; q("[data-f=path]",D.dr).textContent=DPATH; D.dim.classList.add("on"); D.dr.classList.add("on"); renderPage(q("[data-f=body]",D.dr),d); };
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
      let page = h.slice(0, mi) + tag + (suffix === '-mobile' ? MOB : MAIN.replace('__WORLD_MAP__', WORLD)) + h.slice(me);
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
