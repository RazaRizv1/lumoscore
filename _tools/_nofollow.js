// rel="nofollow" on every outgoing link, so ranking signal stays on the site.
//
// Measured before writing this: every external anchor on the site already carries rel="noopener" and
// NONE carries nofollow. One asset page links out to stellar.expert 50 times; an account page 51. Those
// are per-row explorer links, and at that density the page is passing more signal outward than it keeps.
// The issuer's home_domain link (circle.com on USDC) is the same story -- we vouch for the domain in the
// UI, we do not need to endorse it to a crawler as well.
//
// TWO PASSES, because the links come from two places and only one of them is in the HTML:
//
//   1. BUILD TIME, below: every <a href="http..."> literal in the page gets nofollow folded into its
//      rel. That covers the static markup AND the anchor strings inside the injected scripts, since
//      both are just text in the container at this point. The raw HTML a crawler fetches is therefore
//      already correct -- no rendering required.
//
//   2. RUNTIME, the emitted script: anchors created or re-pointed by JS after load -- a table row that
//      renders when its data lands, a home_domain link whose href is set once the toml resolves. The
//      build-time pass cannot see those hrefs because they are assembled from variables.
//
// The runtime pass resolves a.href against the document, so it compares real hosts rather than guessing
// from a string, and it is the one that decides the edge cases. The build-time pass is deliberately the
// more conservative of the two.
//
// WHAT COUNTS AS OURS: same-origin (which covers localhost and the staging host without naming them) or
// any lumoscore.com subdomain. Everything else is external, including our own social profiles -- that
// was asked for explicitly. To exempt one, add its host to KEEP below.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// Hosts that keep a followed link. Empty on purpose -- listed here so exempting one is a one-line
// change rather than an archaeology exercise.
const KEEP = [];

const SCRIPT = `<script id="lx-nofollow">(function(){
  var KEEP=${JSON.stringify(KEEP)};
  function own(h){
    if(!h)return true;
    if(h===location.host)return true;                       // covers localhost and the staging host
    h=h.toLowerCase();
    if(h==="lumoscore.com"||h.slice(-14)===".lumoscore.com")return true;
    for(var i=0;i<KEEP.length;i++)if(h===KEEP[i])return true;
    return false;
  }
  function stamp(a){
    var raw=a.getAttribute("href");
    if(!raw)return;
    var c=raw.charAt(0);
    if(c==="#"||c==="/"||c==="?")return;                    // relative: ours by definition
    var u;
    try{ u=new URL(a.href,location.href); }catch(_){ return; }
    // mailto:, tel:, javascript: -- not links a crawler follows, and not ours to annotate
    if(u.protocol!=="http:"&&u.protocol!=="https:")return;
    if(own(u.host))return;
    var rel=(a.getAttribute("rel")||"").split(" ");
    var out=[],seen={};
    for(var i=0;i<rel.length;i++){ var t=rel[i]; if(!t||seen[t])continue; seen[t]=1; out.push(t); }
    if(seen.nofollow)return;                                // already done: no write, no mutation
    out.push("nofollow");
    if(!seen.noopener)out.push("noopener");
    a.setAttribute("rel",out.join(" "));
  }
  function sweep(root){
    var n=(root&&root.querySelectorAll)?root:document;
    var list=n.querySelectorAll("a[href]");
    for(var i=0;i<list.length;i++)stamp(list[i]);
    // the root itself can BE the anchor when one is inserted on its own
    if(root&&root.tagName==="A")stamp(root);
  }
  function boot(){
    sweep(document);
    try{
      // childList for anchors that appear with their data; href for an anchor that is re-pointed
      // later. NOT rel -- stamp() is idempotent so a rel mutation would be a wasted pass, and this
      // observer must never react to its own write.
      new MutationObserver(function(muts){
        for(var i=0;i<muts.length;i++){
          var m=muts[i];
          if(m.type==="attributes"){ if(m.target)stamp(m.target); continue; }
          for(var j=0;j<m.addedNodes.length;j++){
            var nd=m.addedNodes[j];
            if(nd.nodeType===1)sweep(nd);
          }
        }
      }).observe(document.documentElement,
        {childList:true,subtree:true,attributes:true,attributeFilter:["href"]});
    }catch(_){}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();</script>`;

// ---- build-time pass ----------------------------------------------------------------------------
// Only absolute http(s) hrefs are considered, and only when the host is not ours. A relative href is
// ours by definition and is left alone.
function externalHost(url) {
  const m = /^https?:\/\/([^/?#"']+)/i.exec(url);
  if (!m) return null;
  const h = m[1].toLowerCase().replace(/:\d+$/, '');
  if (h === 'lumoscore.com' || h.endsWith('.lumoscore.com')) return null;
  if (KEEP.indexOf(h) >= 0) return null;
  return h;
}

// Fold nofollow into one <a ...> tag's attributes. Returns the tag unchanged if anything about it is
// not plainly parseable -- a half-understood tag is not one to rewrite.
function markTag(tag) {
  // An odd number of double quotes means the tag was cut short by a ">" inside an attribute value.
  // Rewriting that would emit broken HTML, so leave it for the runtime pass to handle.
  if ((tag.match(/"/g) || []).length % 2 !== 0) return tag;
  const href = /href=("|')(https?:\/\/[^"']*)\1/i.exec(tag);
  if (!href || !externalHost(href[2])) return tag;
  const rel = /rel=("|')([^"']*)\1/i.exec(tag);
  if (rel) {
    const parts = rel[2].split(' ').filter(Boolean);
    if (parts.indexOf('nofollow') >= 0) return tag;          // idempotent
    parts.push('nofollow');
    return tag.replace(rel[0], 'rel=' + rel[1] + parts.join(' ') + rel[1]);
  }
  // No rel at all: add one, with noopener, matching what every other external link here carries.
  return tag.replace(/^<a\b/i, '<a rel="nofollow noopener"');
}

let containers = 0, pages = 0, tagsMarked = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = `lumoscore-aptos-${dev}.html`;
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;

  for (const k of Object.keys(json)) {
    let p = json[k];
    const before = p;
    p = p.replace(/<script id="lx-nofollow">[\s\S]*?<\/script>/g, '');
    let n = 0;
    p = p.replace(/<a\b[^>]*>/gi, (tag) => {
      const out = markTag(tag);
      if (out !== tag) n++;
      return out;
    });
    tagsMarked += n;
    const bi = p.lastIndexOf('</body>');
    if (bi >= 0) p = p.slice(0, bi) + SCRIPT + p.slice(bi);
    if (p !== before) { json[k] = p; changed = true; pages++; }
  }

  if (changed) {
    containers++;
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
console.log('nofollow: ' + tagsMarked + ' outgoing <a> tags marked at build time, runtime guard on '
  + pages + ' page keys across ' + containers + ' containers');
