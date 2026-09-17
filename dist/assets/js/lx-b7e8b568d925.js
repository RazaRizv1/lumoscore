(function(){
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
function j(u){ return fetch(u).then(function(r){ return r.ok?r.json():null; }).catch(function(){ return null; }); }

// The placeholder cards carry their cover as a CSS gradient. A real post carries an image URL, so the
// same slot has to render either -- an <img> inside the gradient block, which also keeps the 1200x630
// crop the CSS already defines.
function coverInto(el,post){
  if(!el)return;
  if(!post.cover){ el.remove(); return; }
  // PREPEND, do not overwrite: the index cards keep their category chip inside this same slot, and
  // replacing the contents wholesale deleted the chip from every card that had a picture.
  var img=document.createElement("img");
  img.className="lx-bd-cover-img";
  img.alt=post.coverAlt||"";
  img.src=post.cover;
  el.insertBefore(img, el.firstChild);
}

function fillIndex(posts){
  var grid=q(".lx-bp-grid"); if(!grid)return;
  if(!posts.length){
    grid.outerHTML="<div class='lx-bd-empty'><div class='t'>No posts yet</div>"
      +"<div class='s'>The first ones are being written. Check back shortly.</div></div>";
    var lede=q(".lx-bp-lede");
    if(lede)lede.textContent="Guides and explainers on trading, pools, bridging and issuing assets on Stellar.";
    return;
  }
  grid.innerHTML=posts.map(function(p){
    // The category chip normally sits over the picture. A post with no picture has no slot to sit
    // in -- the empty one is removed rather than shown as a blank frame -- so it moves to the date
    // line instead of disappearing with it.
    var chip=p.category?("<span class='lx-bp-chip' data-lxc=''>"+esc(p.category)+"</span>"):"";
    return "<a class='lx-bp-card' href='/blog/"+esc(p.slug)+"'>"
      +"<div class='lx-bp-cover' data-cov='"+esc(p.slug)+"'>"+(p.cover?chip:"")+"</div>"
      +"<div class='lx-bp-title'>"+esc(p.title)+"</div>"
      +"<div class='lx-bp-when'>"+(p.cover?"":(chip?chip+"<span class='lx-bp-sep'></span>":""))
        +esc(when(p.publishedAt||p.createdAt))+"</div></a>";
  }).join("");
  posts.forEach(function(p){ coverInto(q(".lx-bp-cover[data-cov='"+p.slug+"']"),p); });
  var lede=q(".lx-bp-lede");
  if(lede)lede.textContent="Guides and explainers on trading, pools, bridging and issuing assets on Stellar.";
}

function fillPost(post){
  var root=q(".lx-post"); if(!root)return;
  var h1=q(".lx-post-head h1"); if(h1)h1.textContent=post.title;
  var chip=q(".lx-post-chip");
  if(chip){ if(post.category)chip.textContent=post.category; else chip.remove(); }
  var meta=q(".lx-post-meta");
  if(meta){
    var dot="<span class='lx-post-dot'></span>";
    var bits=[];
    if(post.category)bits.push("<span class='lx-bp-chip lx-post-chip' data-lxc=''>"+esc(post.category)+"</span>");
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

function boot(){
  var path=location.pathname.replace(/[/]+$/,"");
  var m=path.match(/[/]blog[/]([a-z0-9-]+)$/);
  if(m){
    j("/lxapi/blog?slug="+encodeURIComponent(m[1])).then(function(d){
      if(d&&d.post)fillPost(d.post); else notFound(); });
    return;
  }
  if(/[/]blog$/.test(path)||q(".lx-bp-grid")){
    j("/lxapi/blog").then(function(d){ fillIndex((d&&d.posts)||[]); });
  }
}
if(document.readyState!=="loading")boot(); else document.addEventListener("DOMContentLoaded",boot);
})();