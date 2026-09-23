// AUDIT (navigation): the admin sidebar ships 10 sections but only 7 pages exist. "Trades", "Pools" and
// "LUMOS Incentives" point at lumoscore-admin-{trades,pools,incentives}[-dark].html, none of which were ever
// built — 6 dead targets linked from 7 admin pages each, so every one of them is a guaranteed 404.
//
// Removing the entries beats neutralising them: a sidebar item that silently does nothing reads as a broken
// app, and fabricating three admin screens would be inventing product. If those sections do get built later,
// delete this transform (or drop the names from DEAD) and the design's own markup comes straight back.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const DEAD=['trades','pools','incentives'];
// the design's nav entry: <a class="adn-item " href="lumoscore-admin-X.html" data-tip="…"> …svg… <span…>…</span> </a>
// lazy up to the first </a> — these anchors never nest another one.
const RE=new RegExp('<a class="adn-item[^"]*"\\s+href="lumoscore-admin-(?:'+DEAD.join('|')+')(?:-dark|-mobile|-light)?\\.html"[\\s\\S]*?<\\/a>\\s*','g');
// the admin DASHBOARD also hangs "View all →" / "Manage →" links off its Recent Activity and LUMOS
// Incentives cards, pointing at the same two missing pages. Drop just the link — the cards keep their data.
const RE_LINK=new RegExp('<a class="af-link"[^>]*href="lumoscore-admin-(?:'+DEAD.join('|')+')(?:-dark|-mobile|-light)?\\.html"[^>]*>[\\s\\S]*?<\\/a>\\s*','g');

// ---- unread badges on Support and Assets ----------------------------------------------------------
// The sidebar is the only thing on every admin page, which makes it the only place a "there is
// something waiting" mark can live without being built seven times.
//
// WHAT CLEARS IT is a watermark in localStorage, not a flag on the server. Opening Support writes the
// newest message's timestamp; the badge counts what is newer than that. So it clears by looking,
// which is what RAZA asked for ("the count disappears once the page is open"), and it clears per
// browser rather than globally -- the reader is a person, not the account.
const BADGE_CSS = `<style id="lx-admbadge-css">
.adn-item{position:relative}
.adn-badge{position:absolute;top:6px;left:50%;margin-left:4px;min-width:17px;height:17px;padding:0 5px;box-sizing:border-box;
  display:none;align-items:center;justify-content:center;border-radius:999px;background:var(--accent,#ea6a2c);color:#fff;
  font:700 10.5px/1 "Hanken Grotesk",system-ui,sans-serif;letter-spacing:-.2px;pointer-events:none;
  box-shadow:0 0 0 2px var(--surface,#131317)}
.adn-badge.on{display:flex}
/* When the sidebar is expanded the label is beside the icon, so the badge belongs at the end of the
   row rather than floating over the middle of the text. */
.adn-item .adn-label:not([hidden]) ~ .adn-badge,
.adn-wide .adn-badge{left:auto;right:12px;top:50%;margin:-8.5px 0 0}
</style>`;

const BADGE_JS = '<script id="lx-admbadge">' + `(function(){
if(window.__lxAdmBadge)return; window.__lxAdmBadge=1;
// section -> the page whose visit clears it, and the field on the badge response
var MAP=[{k:"mail",page:"support",f:"mailNewest"},{k:"listings",page:"assets",f:"listNewest"}];
function seenKey(k){ return "lx.adm.seen."+k; }
function seen(k){ try{ return parseInt(localStorage.getItem(seenKey(k))||"0",10)||0; }catch(_){ return 0; } }
function setSeen(k,v){ try{ localStorage.setItem(seenKey(k),String(v||Date.now())); }catch(_){ } }
function here(){ var p=(location.pathname||"").toLowerCase(); return p; }
function onPage(name){ return here().indexOf("admin-"+name)>=0; }
function itemFor(name){
  var as=[].slice.call(document.querySelectorAll("a.adn-item[href]"));
  for(var i=0;i<as.length;i++){ if((as[i].getAttribute("href")||"").toLowerCase().indexOf("admin-"+name)>=0) return as[i]; }
  return null;
}
function paint(a,n){
  if(!a)return;
  var b=a.querySelector(".adn-badge");
  if(!b){ b=document.createElement("span"); b.className="adn-badge"; a.appendChild(b); }
  // The number is for glancing at, not for counting past 99.
  b.textContent=n>99?"99+":String(n);
  b.classList.toggle("on",n>0);
  a.setAttribute("data-lxbadge",n>0?String(n):"");
}
function run(){
  // VISITING CLEARS FIRST. Doing it before the fetch means the page you are standing on can never
  // paint its own badge, even for a message that arrives while you are reading.
  MAP.forEach(function(m){ if(onPage(m.page)) setSeen(m.k, Date.now()); });
  var qs="mail="+seen("mail")+"&listings="+seen("listings")+"&t="+Date.now();
  fetch("/lxapi/adminbadges?"+qs,{credentials:"same-origin"}).then(function(r){ return r.ok?r.json():null; })
    .then(function(d){ if(!d||!d.ok)return;
      MAP.forEach(function(m){
        var n=onPage(m.page)?0:(d[m.k]||0);
        paint(itemFor(m.page), n);
        // Park the watermark ON the newest thing seen, not on "now": a message that lands in the same
        // second as the visit would otherwise be marked read without ever being shown.
        if(onPage(m.page)&&d[m.f]) setSeen(m.k, d[m.f]);
      });
    }).catch(function(){ });
}
// Re-checked while the tab is left open, and again when it is brought back to the front. 90s is
// frequent enough for an inbox and far too rare to matter to anything.
function boot(){ if(!document.querySelector("a.adn-item"))return; run(); setInterval(run,90000);
  document.addEventListener("visibilitychange",function(){ if(!document.hidden) run(); }); }
if(document.readyState!=="loading")boot(); else document.addEventListener("DOMContentLoaded",boot);
})();` + '</' + 'script>';

let n=0, keys=0, badged=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain','stellar','xrpl']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    let changed=false;
    for(const k of Object.keys(json)){
      let h=json[k];
      if(h.indexOf('adn-item')<0) continue;              // not an admin page
      const out=h.replace(RE,'').replace(RE_LINK,'');
      if(out!==h){ h=out; changed=true; keys++; n+=1; }
      // Re-runnable: strip our own blocks before appending, or every build stacks another copy.
      const before=h;
      h=h.replace(/<style id="lx-admbadge-css">[\s\S]*?<\/style>/g,'')
         .replace(/<script id="lx-admbadge">[\s\S]*?<\/script>/g,'');
      const bi=h.lastIndexOf('</body>');
      if(bi>=0){ h=h.slice(0,bi)+BADGE_CSS+BADGE_JS+h.slice(bi); badged++; }
      if(h!==before||out!==json[k]){ json[k]=h; changed=true; }
    }
    if(changed){ const serialized=JSON.stringify(json).split('</').join('<'+B+'/'); fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8'); }
  }
}
console.log('admin nav: removed dead entries on '+keys+' page key(s); unread badges on '+badged);
