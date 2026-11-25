// Makes the public /blog index and /blog/:slug article page read real posts from KV, instead of the
// six placeholders _blogpage.js bakes in.
//
// WHY IT IS A RUNTIME LAYER RATHER THAN BUILD-TIME: posts are written in the admin panel and must
// appear without a rebuild. The pages ship as a shell; this fills them from /lxapi/blog on load.
//
// ONE ARTICLE TEMPLATE SERVES EVERY POST. /blog/:slug rewrites to the same file, so the slug is read
// from the path at runtime and the matching post is fetched. That is why the page must fill its own
// <title> and meta description too -- they are per-post and cannot be baked in.
//
// WHEN THERE ARE NO POSTS the index says so plainly rather than falling back to the placeholders. Once
// a real editor exists, fake cards stop being a layout preview and start being a lie.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const CSS = `<style id="lx-blogdata-css">
.lx-bd-empty{padding:56px 20px;text-align:center;border:1px dashed var(--border,#ececef);border-radius:16px}
.lx-bd-empty .t{font:700 17px/1.3 "Hanken Grotesk",system-ui,sans-serif;color:var(--text,#0e0e10)}
.lx-bd-empty .s{margin-top:8px;font-size:14.5px;line-height:1.6;color:var(--text-muted,#8a8fa3)}
.lx-bd-retry{margin-top:16px;font:700 13.5px/1 "Hanken Grotesk",system-ui,sans-serif;padding:10px 18px;border-radius:999px;border:1px solid var(--border-strong,#d7d7dc);background:transparent;color:var(--text,#0e0e10);cursor:pointer;transition:.15s}
.lx-bd-retry:hover{border-color:var(--accent,#ea6a2c);color:var(--accent,#ea6a2c)}
.lx-bd-retry[disabled]{opacity:.55;cursor:default}
.lx-bd-cover-img{width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit;
position:relative;z-index:2}
.lx-post-cover,.lx-bp-cover{background:rgba(127,127,140,.10)}
.lx-post-cover:empty{display:none}
.lx-bp-when{display:flex;align-items:center;gap:8px}
.lx-post-tags{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:26px 0 0}
.lx-post-tag{font:600 12px/1 "Hanken Grotesk",system-ui,sans-serif;padding:6px 10px;border-radius:999px;background:rgba(127,127,140,.12);color:var(--text-muted,#8a8fa3)}
</style>`;

const SCRIPT = '<script id="lx-blogdata">' + `(function(){
if(window.__lxBlogData)return; window.__lxBlogData=1;
function q(s){return document.querySelector(s);}
function qa(s){return [].slice.call(document.querySelectorAll(s));}
function esc(s){return (String(s==null?"":s).replace(/[<>&"]/g,function(c){return c==="<"?"&lt;":c===">"?"&gt;":c==="&"?"&amp;":"&quot;";})).split(String.fromCharCode(39)).join("&#39;");}
function when(t){ if(!t)return "";
  var d=Date.now()-t, day=86400000;
  if(d<day)return "today";
  if(d<2*day)return "yesterday";
  if(d<7*day)return Math.floor(d/day)+" days ago";
  if(d<30*day)return Math.floor(d/(7*day))+"w ago";
  if(d<365*day)return Math.floor(d/(30*day))+"mo ago";
  return new Date(t).toLocaleDateString(); }
// "WE COULD NOT ASK" IS NOT "THERE IS NOTHING" (RAZA 2026-10-30).
//
// This used to return null for every outcome -- a 500, a dropped connection, a parse error and a
// genuine 404 all arrived identically. The two callers then said the most confident possible thing:
// the index rendered "No posts yet", and an article rendered "Post not found" AND rewrote
// document.title to match. Reproduced locally, where serve.js does not proxy /lxapi/blog: a 404 on
// the endpoint printed "No posts yet" over 16 published posts.
//
// The article case is the worse one. Those urls are indexed and reachable from search, so a blip on
// one fetch told a reader -- and any crawler that renders -- that a live article does not exist.
//
// 404 is the ONLY status that means "the server looked and there is no such thing". Everything else
// is us failing to get an answer, and is reported as such.
//
// ONE QUIET RETRY FIRST, same reasoning as the pool page's transactions list: a single blip should
// not produce a message at all. Only the second failure is worth telling anyone about.
function jOnce(u){
  return fetch(u).then(function(r){
    if(r.ok)return r.json().catch(function(){ return {__failed:1}; });
    if(r.status===404)return null;
    return {__failed:1};
  }).catch(function(){ return {__failed:1}; });
}
function j(u,n){
  n=(n==null)?1:n;
  return jOnce(u).then(function(d){
    if(d&&d.__failed&&n>0){
      return new Promise(function(rs){ setTimeout(rs,900); }).then(function(){ return j(u,n-1); });
    }
    return d;
  });
}

// THIS PAGE DOES NOT READ THE READER'S NETWORK ANY MORE (RAZA 2026-10-30: "if im not connected and i
// view /blog i dont see XRPL blog post on this page. And if i connect with XRPL and visit blog page,
// it only shows the XRPL post instead of all posts").
//
// It used to. readerChain() resolved url -> localStorage -> lx_chain cookie, defaulting to "stellar",
// and fillIndex dropped every post tagged for another network. Measured on production before this
// change, against 16 published posts (14 Stellar, 2 XRPL, none untagged):
//
//   signed out, no cookie : 14 cards -- both XRPL posts hidden
//   lx_chain=xrpl         :  2 cards -- all 14 Stellar posts hidden
//
// Neither is what a blog index is for. The filter came from "make the blog posts only visible to
// their relevant network" (2026-10-28), and that reading is right for the two DASHBOARDS -- you are
// already inside one chain's dashboard there, and each is served as its own file. It is wrong here:
// /blog is a single SHARED page (combine.js lists it in SHARED, and /blog/xrpl is a 410), so there is
// no other page the hidden posts are visible on. A reader on XRPL could not reach 14 published
// articles from anywhere in the site.
//
// The article page never filtered -- netOf/readerChain were only ever called from fillIndex -- so a
// hidden post was still readable by url, and Google indexes them. The index was hiding things the
// rest of the web could see.
//
// Both functions are deleted rather than left unused: an orphaned chain-reader sitting here is an
// invitation to wire it back in. The two dashboards keep their own copies, which is where the
// per-network behaviour still belongs.
//
// NO BACKSLASHES IN THIS FILE. The whole script is a template literal, which eats an unrecognised
// escape: a cookie test written with the usual regex would emit (?:^|;s*) and match nothing. That is
// why the path tests say [/] elsewhere and cookies are split rather than matched.
//
// The lede named one network because the list only ever held one. It now describes the whole blog,
// and says nothing that needs editing when a third network ships.
function lede(){
  return "Guides and explainers on trading, pools, bridging and issuing assets on LumosCore.";
}

// The placeholder cards carry their cover as a CSS gradient. A real post carries an image URL, so the
// same slot has to render either -- an <img> inside the gradient block, which also keeps the 1200x630
// crop the CSS already defines.
function coverInto(el,post,small){
  if(!el)return;
  if(!post.cover){ el.remove(); return; }
  // PREPEND, do not overwrite. This slot used to hold the category chip too, and an innerHTML
  // assignment deleted it from every card that had a picture. The chip is gone now, but the rule
  // stands: this function's job is to add the image, not to decide what else may live here.
  var img=document.createElement("img");
  img.className="lx-bd-cover-img";
  img.alt=post.coverAlt||"";
  img.src=small?(String(post.cover).indexOf("/lxapi/media?id=")>=0&&String(post.cover).indexOf("&")<0?post.cover+"&w=1200":post.cover):post.cover;   // lists: 1200 px copy (2026-11-21); the article keeps the original
  el.insertBefore(img, el.firstChild);
}

function fillIndex(posts){
  var grid=q(".lx-bp-grid"); if(!grid)return;
  // EVERY PUBLISHED POST, WHOEVER IS READING. The network filter that used to sit here is gone --
  // see the note above lede(). "No posts yet" below now means the blog is genuinely empty, which is
  // the only thing it should ever have meant on a shared index.
  var ld=q(".lx-bp-lede");
  if(ld)ld.textContent=lede();
  if(!posts.length){
    grid.outerHTML="<div class='lx-bd-empty'><div class='t'>No posts yet</div>"
      +"<div class='s'>The first ones are being written. Check back shortly.</div></div>";
    return;
  }
  // NO CATEGORY CHIP. The field holds the network now, and the network is not something a reader is
  // shown -- they are already on one. Printing it would also contradict the filter: every chip on
  // the page would read the same word.
  grid.innerHTML=posts.map(function(p){
    return "<a class='lx-bp-card' href='/blog/"+esc(p.slug)+"'>"
      +"<div class='lx-bp-cover' data-cov='"+esc(p.slug)+"'></div>"
      +"<div class='lx-bp-title'>"+esc(p.title)+"</div>"
      +"<div class='lx-bp-when'>"+esc(when(p.publishedAt||p.createdAt))+(p.readMins>0?"<span class='lx-bp-dot'></span><span class='lx-bp-read'>"+Math.round(p.readMins)+" min read</span>":"")+"</div></a>";
  }).join("");
  posts.forEach(function(p){ coverInto(q(".lx-bp-cover[data-cov='"+p.slug+"']"),p,true); });
}

function fillPost(post){
  var root=q(".lx-post"); if(!root)return;
  var h1=q(".lx-post-head h1"); if(h1)h1.textContent=post.title;
  // The baked-in chip goes unconditionally: it holds the network now, which is not reader-facing.
  // Removed rather than blanked -- an emptied element is still an element, and the logo healer
  // repaints short icon-ish nodes it finds sitting empty.
  var chip=q(".lx-post-chip"); if(chip)chip.remove();
  var meta=q(".lx-post-meta");
  if(meta){
    var dot="<span class='lx-post-dot'></span>";
    var bits=[];
    bits.push(esc(when(post.publishedAt||post.createdAt)));
    if(post.readMins)bits.push(esc(post.readMins)+" min read");
    meta.innerHTML=bits.join(dot);
  }
  coverInto(q(".lx-post-cover"),post);
  var body=q(".lx-post-body");
  // The body was sanitised to a known tag allowlist before it was stored, so it can be written in
  // as HTML -- that is the whole point of cleaning at the boundary rather than at render time.
  if(body)body.innerHTML=post.body||"";
  if(post.tags&&post.tags.length&&body){
    var tw=document.createElement("div"); tw.className="lx-post-tags";
    tw.innerHTML=post.tags.map(function(t){ return "<span class='lx-post-tag' data-lxc=''>"+esc(t)+"</span>"; }).join("");
    body.parentNode.insertBefore(tw, body.nextSibling);
  }
  // Per-post <title> and description: one file answers every /blog/:slug, so these cannot be baked in.
  try{
    document.title=post.title+" | LumosCore Blog";
    var m=document.querySelector("meta[name='description']");
    if(m&&post.metaDescription)m.setAttribute("content",post.metaDescription);
    var og=document.querySelector("meta[property='og:title']"); if(og)og.setAttribute("content",post.title);
    var od=document.querySelector("meta[property='og:description']");
    if(od&&post.metaDescription)od.setAttribute("content",post.metaDescription);
    var oi=document.querySelector("meta[property='og:image']"); if(oi&&post.cover)oi.setAttribute("content",post.cover);
  }catch(e){}
}

// COULD NOT LOAD -- said plainly, and distinct from "there are none". Both of these replace the same
// slot their success path would have filled, and both carry a Retry rather than making the reader
// guess whether a reload would help.
function retryBtn(fn){
  var b=document.createElement("button");
  b.type="button"; b.className="lx-bd-retry"; b.textContent="Retry";
  b.addEventListener("click",function(){
    b.disabled=true; b.textContent="Retrying...";
    fn();
  });
  return b;
}
function failBox(title,msg,fn){
  var d=document.createElement("div");
  d.className="lx-bd-empty";
  var t=document.createElement("div"); t.className="t"; t.textContent=title;
  var s=document.createElement("div"); s.className="s"; s.textContent=msg;
  d.appendChild(t); d.appendChild(s); d.appendChild(retryBtn(fn));
  return d;
}
function indexFailed(){
  var grid=q(".lx-bp-grid")||q(".lx-bd-empty"); if(!grid)return;
  var ld=q(".lx-bp-lede"); if(ld)ld.textContent=lede();
  var box=failBox("Couldn't load posts",
    "We could not reach the blog just now. This is usually a moment, not an outage.",
    loadIndex);
  grid.parentNode.replaceChild(box,grid);
}
// NOTE the slot: the body, not the heading. notFound() rewrites the h1 and the document title, and
// neither is safe here -- we do not know that anything is wrong with the post.
function postFailed(){
  var body=q(".lx-post-body"); if(!body)return;
  body.innerHTML="";
  body.appendChild(failBox("Couldn't load this post",
    "The article could not be fetched just now. It has not gone anywhere.",
    loadPost));
}
function notFound(){
  var root=q(".lx-post"); if(!root)return;
  var h1=q(".lx-post-head h1"); if(h1)h1.textContent="Post not found";
  var chip=q(".lx-post-chip"); if(chip)chip.remove();
  var meta=q(".lx-post-meta"); if(meta)meta.innerHTML="";
  var cov=q(".lx-post-cover"); if(cov)cov.remove();
  var body=q(".lx-post-body");
  if(body)body.innerHTML="<p>This post is not published, or the link is wrong. "
    +"<a href='/blog'>Back to all posts</a>.</p>";
  try{ document.title="Post not found | LumosCore Blog"; }catch(e){}
}

// The grid is REPLACED by whichever box gets drawn (outerHTML / replaceChild), so a successful retry
// has nothing left to fill -- fillIndex returns early on a missing .lx-bp-grid and the reader is left
// looking at the error. Put a fresh grid back before filling it.
function restoreGrid(){
  if(q(".lx-bp-grid"))return;
  var box=q(".lx-bd-empty"); if(!box||!box.parentNode)return;
  var g=document.createElement("div"); g.className="lx-bp-grid";
  box.parentNode.replaceChild(g,box);
}
var SLUG="";
// Three failures, one empty answer. A 404 (d===null) is a FAILURE here even though it is a real
// answer for a post: the collection endpoint always replies 200 when it exists, so a 404 means the
// function is missing. And "reason" is the server saying it could not read the store -- it has
// always distinguished that from an empty blog ("no kv" / "kv error"), and reading it is the half
// that was missing. Only a 200 with no reason and an empty list means "nothing published yet".
function loadIndex(){
  j("/lxapi/blog").then(function(d){
    if(!d||d.__failed||d.reason){ indexFailed(); return; }
    restoreGrid();
    fillIndex(d.posts||[]);
  });
}
function loadPost(){
  j("/lxapi/blog?slug="+encodeURIComponent(SLUG)).then(function(d){
    if(d&&d.__failed){ postFailed(); return; }
    if(d&&d.post)fillPost(d.post); else notFound();
  });
}
function boot(){
  var path=location.pathname.replace(/[/]+$/,"");
  var m=path.match(/[/]blog[/]([a-z0-9-]+)$/);
  if(m){ SLUG=m[1]; loadPost(); return; }
  if(/[/]blog$/.test(path)||q(".lx-bp-grid")){ loadIndex(); }
}
if(document.readyState!=="loading")boot(); else document.addEventListener("DOMContentLoaded",boot);
})();` + '</' + 'script>';

let pages = 0;
for (const c of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain', 'stellar', 'xrpl']) {
  for (const dev of ['desktop', 'mobile']) {
    const file = `lumoscore-${c}-${dev}.html`;
    let data; try { data = read(file); } catch (e) { continue; }
    const { json, s, e } = getContents(data);
    let changed = false;
    for (const k of Object.keys(json)) {
      if (!/^lumoscore-blog(-post)?(-mobile)?\.html$/.test(k)) continue;
      let h = json[k];
      h = h.replace(/<style id="lx-blogdata-css">[\s\S]*?<\/style>/g, '')
           .replace(/<script id="lx-blogdata">[\s\S]*?<\/script>/g, '');
      const bi = h.lastIndexOf('</body>');
      if (bi < 0) continue;
      h = h.slice(0, bi) + CSS + SCRIPT + h.slice(bi);
      json[k] = h; changed = true; pages++;
    }
    if (changed) {
      const ser = JSON.stringify(json).split('</').join('<' + B + '/');
      fs.writeFileSync(file, data.slice(0, s) + ser + data.slice(e), 'utf8');
    }
  }
}
console.log('blog data layer on ' + pages + ' page key(s)');
