// ADMIN — Blogs: write, edit and publish posts.
//
// Replaces the design's mock blog screen with a real editor backed by /lxapi/blog (CONTENT_KV).
//
// THE BODY IS SANITISED ON SAVE, to an allowlist of tags the public article page actually styles:
// p, h2, h3, ul, ol, li, blockquote, a, strong, em, br. contenteditable produces whatever the browser
// feels like -- nested divs, inline font styles, pasted Word markup -- and none of that is styled by
// the article CSS, so it would render as unformatted text next to correctly formatted text. Cleaning at
// the boundary means the stored HTML is always something the page knows how to display.
//
// Template-literal rules followed throughout, learned the hard way: HTML attributes are single-quoted,
// there are no backslash escapes inside regexes, and newlines come from String.fromCharCode(10).
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const MAIN = `
      <div class="admin-page-head">
        <h1 class="admin-page-title">Blog</h1>
        <div class="admin-page-actions">
          <button class="adm-btn ghost" id="lxbRefresh" type="button">Refresh</button>
          <button class="adm-btn primary" id="lxbNew" type="button">New post</button>
        </div>
      </div>

      <div class="adm-card">
        <div class="adm-card-head">
          <div><div class="adm-card-title">Posts</div><div class="adm-card-sub" id="lxbSub">Loading&hellip;</div></div>
        </div>
        <div class="adm-card-body" style="padding:0">
          <table class="adm-table" id="lxbTable" style="width:100%;border-collapse:collapse">
            <thead><tr><th style="text-align:left">Title</th><th style="text-align:left">Category</th><th style="text-align:right">Status</th><th style="text-align:right">Updated</th><th style="text-align:right"></th></tr></thead>
            <tbody><tr><td colspan="5" class="lxadm-empty">Loading&hellip;</td></tr></tbody>
          </table>
        </div>
      </div>

      <div class="lxb-editor" id="lxbEditor" hidden>
        <div class="lxb-ed-head">
          <div class="lxb-ed-title" id="lxbEdTitle">New post</div>
          <div class="lxb-ed-actions">
            <button class="adm-btn ghost" id="lxbCancel" type="button">Close</button>
            <button class="adm-btn ghost" id="lxbDraft" type="button">Save draft</button>
            <button class="adm-btn primary" id="lxbPublish" type="button">Publish</button>
          </div>
        </div>
        <div class="lxb-ed-grid">
          <div class="lxb-ed-main">
            <label class="lxb-l">Title</label>
            <input class="lxb-i" id="lxbTitle" type="text" placeholder="How liquidity pools work on Stellar">
            <label class="lxb-l">URL <span class="lxb-h" id="lxbSlugHint"></span></label>
            <input class="lxb-i mono" id="lxbSlug" type="text" placeholder="how-liquidity-pools-work-on-stellar">
            <label class="lxb-l">Excerpt <span class="lxb-h">shown on the blog index card</span></label>
            <textarea class="lxb-i" id="lxbExcerpt" rows="2" placeholder="One or two sentences."></textarea>
            <label class="lxb-l">Body</label>
            <div class="lxb-tools" id="lxbTools">
              <button type="button" data-cmd="bold" title="Bold"><b>B</b></button>
              <button type="button" data-cmd="italic" title="Italic"><i>I</i></button>
              <button type="button" data-cmd="h2" title="Heading">H2</button>
              <button type="button" data-cmd="h3" title="Subheading">H3</button>
              <button type="button" data-cmd="p" title="Paragraph">&para;</button>
              <button type="button" data-cmd="ul" title="Bullet list">&bull; List</button>
              <button type="button" data-cmd="ol" title="Numbered list">1. List</button>
              <button type="button" data-cmd="quote" title="Quote">&ldquo;&rdquo;</button>
              <button type="button" data-cmd="link" title="Link">Link</button>
              <button type="button" data-cmd="unlink" title="Remove link">Unlink</button>
            </div>
            <div class="lxb-body" id="lxbBody" contenteditable="true"></div>
            <div class="lxb-count" id="lxbWords"></div>
          </div>
          <div class="lxb-ed-side">
            <label class="lxb-l">Cover image URL</label>
            <input class="lxb-i" id="lxbCover" type="text" placeholder="https://&hellip;/cover.jpg">
            <div class="lxb-cover" id="lxbCoverPrev"></div>
            <div class="lxb-h">1200&times;630 is the size to export &mdash; it is what link previews crop to.</div>
            <label class="lxb-l">Cover alt text</label>
            <input class="lxb-i" id="lxbCoverAlt" type="text" placeholder="What the image shows">
            <label class="lxb-l">Category</label>
            <input class="lxb-i" id="lxbCat" type="text" placeholder="Stellar" list="lxbCats">
            <datalist id="lxbCats"><option>Stellar</option><option>Guide</option><option>Walkthrough</option><option>Product</option></datalist>
            <label class="lxb-l">Meta description <span class="lxb-h" id="lxbMetaCount"></span></label>
            <textarea class="lxb-i" id="lxbMeta" rows="3" placeholder="What a search result should say about this post."></textarea>
            <label class="lxb-l">Tags <span class="lxb-h">comma separated</span></label>
            <input class="lxb-i" id="lxbTags" type="text" placeholder="liquidity, amm, stellar">
            <label class="lxb-l">Read time</label>
            <input class="lxb-i" id="lxbRead" type="number" min="1" max="60" placeholder="auto">
            <div class="lxb-status" id="lxbStatus"></div>
          </div>
        </div>
      </div>
`;

const MOB = `
      <div class="mob-page-head"><h1 class="mob-page-title">Blog</h1></div>
      <div class="lxadm-note">Writing and editing posts needs a wider screen, so the editor is desktop only. Published posts are listed below.</div>
      <div class="adm-card"><div class="adm-card-body" style="padding:0">
        <table class="adm-table" id="lxbTable" style="width:100%;border-collapse:collapse">
          <thead><tr><th style="text-align:left">Title</th><th style="text-align:right">Status</th></tr></thead>
          <tbody><tr><td colspan="2" class="lxadm-empty">Loading&hellip;</td></tr></tbody>
        </table>
      </div></div>
`;

const CSS = `<style id="lx-adminblogs-css">
.lxb-editor{margin-top:18px;border:1px solid var(--border);border-radius:16px;background:var(--surface);overflow:hidden}
.lxb-ed-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid var(--border)}
.lxb-ed-title{font:800 17px/1.2 "Hanken Grotesk",system-ui,sans-serif;color:var(--text)}
.lxb-ed-actions{display:flex;gap:8px}
.lxb-ed-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:22px;padding:18px}
@media(max-width:1100px){.lxb-ed-grid{grid-template-columns:minmax(0,1fr)}}
.lxb-l{display:block;margin:14px 0 6px;font:700 12px/1 "Hanken Grotesk",system-ui,sans-serif;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted)}
.lxb-ed-main .lxb-l:first-child,.lxb-ed-side .lxb-l:first-child{margin-top:0}
.lxb-h{text-transform:none;letter-spacing:0;font-weight:600;color:var(--text-muted);opacity:.85}
.lxb-i{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2,transparent);color:var(--text);font:400 14px/1.5 "Hanken Grotesk",system-ui,sans-serif}
.lxb-i:focus{outline:2px solid var(--accent,#ea6a2c);outline-offset:1px;border-color:transparent}
.lxb-i.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px}
.lxb-tools{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
.lxb-tools button{padding:6px 10px;border:1px solid var(--border);border-radius:8px;background:var(--surface-2,transparent);color:var(--text);font:700 12px/1 "Hanken Grotesk",system-ui,sans-serif;cursor:pointer}
.lxb-tools button:hover{border-color:var(--accent,#ea6a2c);color:var(--accent,#ea6a2c)}
.lxb-body{min-height:340px;max-height:60vh;overflow-y:auto;padding:16px 18px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2,transparent);color:var(--text);font:400 15px/1.7 "Hanken Grotesk",system-ui,sans-serif}
.lxb-body:focus{outline:2px solid var(--accent,#ea6a2c);outline-offset:1px}
.lxb-body h2{font:800 20px/1.3 "Hanken Grotesk",system-ui,sans-serif;margin:22px 0 8px}
.lxb-body h3{font:800 16px/1.35 "Hanken Grotesk",system-ui,sans-serif;margin:18px 0 6px}
.lxb-body p{margin:0 0 14px}
.lxb-body ul,.lxb-body ol{margin:0 0 14px;padding-left:22px}
.lxb-body blockquote{margin:16px 0;padding:10px 14px;border-left:3px solid var(--accent,#ea6a2c);background:rgba(127,127,140,.08);border-radius:0 8px 8px 0}
.lxb-body a{color:var(--accent,#ea6a2c);text-decoration:underline;text-underline-offset:2px}
.lxb-body a::after{content:" 97";font-size:.85em;opacity:.7}
.lxb-count{margin-top:8px;font-size:12.5px;color:var(--text-muted)}
.lxb-cover{margin-top:8px;width:100%;aspect-ratio:1200/630;border-radius:10px;border:1px dashed var(--border);background-size:cover;background-position:center;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:12.5px}
.lxb-status{margin-top:14px;font-size:13px;color:var(--text-muted);min-height:20px}
.lxb-status.ok{color:#22c55e}
.lxb-status.err{color:#ef4444}
.lxb-badge{display:inline-block;font:700 11px/1 "Hanken Grotesk",system-ui,sans-serif;padding:4px 8px;border-radius:999px;background:rgba(127,127,140,.14);color:var(--text-muted)}
.lxb-badge.live{background:rgba(34,197,94,.16);color:#22c55e}
</style>`;

const SCRIPT = '<script id="lx-adminblogs">' + `(function(){
if(window.__lxBlogAdmin)return; window.__lxBlogAdmin=1;
function q(s){return document.querySelector(s);}
function qa(s){return [].slice.call(document.querySelectorAll(s));}
function esc(s){return String(s==null?"":s).replace(/[<>&"]/g,function(c){return c==="<"?"&lt;":c===">"?"&gt;":c==="&"?"&amp;":"&quot;";});}
function isPage(){var t=((q(".admin-page-title")||q(".mob-page-title")||{}).textContent||"").trim();return t.indexOf("Blog")===0;}
function slugify(s){return String(s||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80);}
function ago(t){var d=Date.now()-t; if(d<60000)return "just now"; if(d<3600000)return Math.floor(d/60000)+"m ago";
  if(d<86400000)return Math.floor(d/3600000)+"h ago"; return Math.floor(d/86400000)+"d ago"; }

// ---- sanitising --------------------------------------------------------------------------------
// Only tags the public article page styles survive. Anything else is unwrapped, keeping its text, so
// pasting from Word or Google Docs cannot smuggle in font tags and inline styles that would render
// unformatted next to properly formatted paragraphs.
var OK={P:1,H2:1,H3:1,UL:1,OL:1,LI:1,BLOCKQUOTE:1,A:1,STRONG:1,EM:1,BR:1,B:1,I:1};
var MAP={B:"STRONG",I:"EM",DIV:"P"};
// These are dropped WITH their contents. Everything else that is not on the allowlist is unwrapped so
// its words survive -- but a script's words are code, and leaving "alert(1)" sitting in the article as
// visible text is not what anyone meant by keeping the text.
var DROP={SCRIPT:1,STYLE:1,NOSCRIPT:1,IFRAME:1,OBJECT:1,EMBED:1,TEMPLATE:1};
function clean(root){
  var doc=document.createElement("div"); doc.innerHTML=root.innerHTML;
  (function walk(n){
    var kids=[].slice.call(n.childNodes);
    kids.forEach(function(c){
      if(c.nodeType===3)return;
      if(c.nodeType!==1){ c.remove(); return; }
      if(DROP[c.tagName]){ c.remove(); return; }
      walk(c);
      var tag=c.tagName;
      if(MAP[tag]&&MAP[tag]!==tag){
        var rep=document.createElement(MAP[tag]);
        while(c.firstChild)rep.appendChild(c.firstChild);
        c.replaceWith(rep); c=rep; tag=rep.tagName;
      }
      if(!OK[tag]){ // keep the words, drop the wrapper
        var frag=document.createDocumentFragment();
        while(c.firstChild)frag.appendChild(c.firstChild);
        c.replaceWith(frag); return;
      }
      [].slice.call(c.attributes||[]).forEach(function(a){
        var keep=(tag==="A"&&a.name==="href");
        if(!keep)c.removeAttribute(a.name);
      });
      if(tag==="A"){
        var href=c.getAttribute("href")||"";
        // Only http(s) and site-relative links. javascript: and data: in a stored post would be
        // executable content on the public site.
        if(!(href.indexOf("https://")===0||href.indexOf("http://")===0||href.indexOf("/")===0)){ c.removeAttribute("href"); }
        else { c.setAttribute("rel","noopener"); if(href.indexOf("/")!==0)c.setAttribute("target","_blank"); }
      }
    });
  })(doc);
  // Anything left loose at the top level -- bare text, a stray <strong> -- gets wrapped in a paragraph.
  // The article page styles p, not naked text nodes, so unwrapped content would render at the browser
  // default size next to properly set paragraphs.
  var BLOCK={P:1,H2:1,H3:1,UL:1,OL:1,BLOCKQUOTE:1};
  var out=document.createElement("div"), buf=null;
  function flush(){ if(buf&&buf.textContent.trim())out.appendChild(buf); buf=null; }
  [].slice.call(doc.childNodes).forEach(function(n){
    if(n.nodeType===1&&BLOCK[n.tagName]){ flush(); out.appendChild(n); return; }
    if(n.nodeType===3&&!n.textContent.trim())return;
    if(!buf)buf=document.createElement("p");
    buf.appendChild(n);
  });
  flush();
  return out.innerHTML.replace(/<p><.p>/g,"").trim();
}
function words(){ var t=(q("#lxbBody")||{}).innerText||""; return (t.trim().match(/[^ ]+/g)||[]).length; }

// ---- api ---------------------------------------------------------------------------------------
function api(method,body,slug){
  var u="/lxapi/blog"+(slug?("?slug="+encodeURIComponent(slug)):"");
  var o={method:method,headers:{"content-type":"application/json"}};
  if(body)o.body=JSON.stringify(body);
  return fetch(u,o).then(function(r){ return r.json().then(function(d){ return {ok:r.ok,status:r.status,d:d}; }); });
}
function list(){ return fetch("/lxapi/blog?all=1&t="+Date.now()).then(function(r){return r.json();}); }

var POSTS=[], CUR=null;
function renderList(){
  var tb=q("#lxbTable tbody"); if(!tb)return;
  var sub=q("#lxbSub");
  if(sub)sub.textContent=POSTS.length?(POSTS.length+" post"+(POSTS.length===1?"":"s")+" \\u00b7 "+POSTS.filter(function(p){return p.published;}).length+" published"):"No posts yet.";
  if(!POSTS.length){ tb.innerHTML="<tr><td colspan='5' class='lxadm-empty'>No posts yet. Press <b>New post</b> to write the first one.</td></tr>"; return; }
  var mob=!!q(".mob-page-title");
  tb.innerHTML=POSTS.map(function(p){
    var badge="<span class='lxb-badge"+(p.published?" live":"")+"'>"+(p.published?"published":"draft")+"</span>";
    if(mob)return "<tr><td>"+esc(p.title)+"</td><td style='text-align:right'>"+badge+"</td></tr>";
    return "<tr data-slug='"+esc(p.slug)+"'><td><b>"+esc(p.title)+"</b><div class='lxb-h mono' style='margin-top:3px'>/blog/"+esc(p.slug)+"</div></td>"
      +"<td>"+esc(p.category||"")+"</td>"
      +"<td style='text-align:right'>"+badge+"</td>"
      +"<td style='text-align:right;color:var(--text-muted);font-size:13px'>"+esc(ago(p.updatedAt||p.createdAt||Date.now()))+"</td>"
      +"<td style='text-align:right'><button class='adm-btn ghost lxb-edit' type='button' data-slug='"+esc(p.slug)+"'>Edit</button> "
      +"<button class='adm-btn ghost lxb-del' type='button' data-slug='"+esc(p.slug)+"'>Delete</button></td></tr>";
  }).join("");
}
function refresh(){ return list().then(function(d){ POSTS=(d&&d.posts)||[]; renderList();
  if(d&&d.reason==="no kv"){ var s=q("#lxbSub"); if(s)s.textContent="Storage is not connected (CONTENT_KV binding missing on this project)."; } }); }

function openEditor(post){
  CUR=post||null;
  var ed=q("#lxbEditor"); if(!ed)return;
  ed.hidden=false;
  q("#lxbEdTitle").textContent=post?"Edit post":"New post";
  q("#lxbTitle").value=post?post.title:"";
  q("#lxbSlug").value=post?post.slug:"";
  q("#lxbSlug").disabled=!!post;
  q("#lxbSlugHint").textContent=post?"fixed once published \\u2014 changing it would break shared links":"set from the title";
  q("#lxbExcerpt").value=post?(post.excerpt||""):"";
  q("#lxbBody").innerHTML=post?(post.body||""):"";
  q("#lxbCover").value=post?(post.cover||""):"";
  q("#lxbCoverAlt").value=post?(post.coverAlt||""):"";
  q("#lxbCat").value=post?(post.category||""):"";
  q("#lxbMeta").value=post?(post.metaDescription||""):"";
  q("#lxbTags").value=post?((post.tags||[]).join(", ")):"";
  q("#lxbRead").value=post&&post.readMins?post.readMins:"";
  q("#lxbPublish").textContent=(post&&post.published)?"Update":"Publish";
  status("");
  coverPrev(); metaCount(); wordCount();
  ed.scrollIntoView({behavior:"smooth",block:"start"});
}
function closeEditor(){ var ed=q("#lxbEditor"); if(ed)ed.hidden=true; CUR=null; }
function status(msg,kind){ var s=q("#lxbStatus"); if(!s)return; s.textContent=msg||""; s.className="lxb-status"+(kind?(" "+kind):""); }
function coverPrev(){ var v=(q("#lxbCover")||{}).value||""; var p=q("#lxbCoverPrev"); if(!p)return;
  if(v){ p.style.backgroundImage="url('"+v.replace(/'/g,"%27")+"')"; p.textContent=""; }
  else { p.style.backgroundImage="none"; p.textContent="no cover set"; } }
function metaCount(){ var v=(q("#lxbMeta")||{}).value||""; var e=q("#lxbMetaCount"); if(!e)return;
  // 155 is roughly where Google truncates. Stated as guidance, not enforced.
  e.textContent=v.length+" / 155"+(v.length>165?" \\u2014 likely to be cut off":""); }
function wordCount(){ var n=words(); var e=q("#lxbWords"); if(!e)return;
  e.textContent=n+" words \\u00b7 about "+Math.max(1,Math.round(n/200))+" min read"; }

function gather(published){
  var title=(q("#lxbTitle").value||"").trim();
  if(!title){ status("A title is required.","err"); return null; }
  var slug=(q("#lxbSlug").value||"").trim()||slugify(title);
  var tags=(q("#lxbTags").value||"").split(",").map(function(t){return t.trim();}).filter(Boolean);
  var read=parseInt(q("#lxbRead").value,10);
  return {slug:slug,title:title,category:(q("#lxbCat").value||"").trim(),
    excerpt:(q("#lxbExcerpt").value||"").trim(),
    body:clean(q("#lxbBody")),
    cover:(q("#lxbCover").value||"").trim(),
    coverAlt:(q("#lxbCoverAlt").value||"").trim(),
    metaDescription:(q("#lxbMeta").value||"").trim(),
    tags:tags, readMins:(read>0?read:Math.max(1,Math.round(words()/200))),
    published:!!published};
}
function save(published){
  var body=gather(published); if(!body)return;
  status("Saving\\u2026");
  api("PUT",body).then(function(r){
    if(!r.ok){ status("Could not save: "+((r.d&&(r.d.error||r.d.reason))||("HTTP "+r.status)),"err"); return; }
    status(published?"Published.":"Draft saved.","ok");
    q("#lxbSlug").disabled=true; CUR=r.d.post;
    q("#lxbPublish").textContent=published?"Update":"Publish";
    refresh();
  }).catch(function(e){ status("Could not save: "+e.message,"err"); });
}

// THE SELECTION HAS TO BE SAVED AND PUT BACK.
//
// Pressing a toolbar button moves focus out of the editable, and the browser drops the selection with
// it -- so by the time the command runs there is nothing selected to apply it to. prompt() destroys it
// a second time. This affected every button; Link was simply the one where the failure was visible,
// because bold on a collapsed cursor still looks like it might have worked.
//
// Two defences: preventDefault on MOUSEDOWN (so focus never leaves in the first place), and an
// explicit save/restore of the Range around anything that can steal it.
var SAVED=null;
function saveSel(){
  try{
    var s=window.getSelection();
    if(!s||!s.rangeCount)return;
    var b=q("#lxbBody"); if(!b)return;
    var r=s.getRangeAt(0);
    if(b.contains(r.commonAncestorContainer))SAVED=r.cloneRange();
  }catch(_){}
}
function restoreSel(){
  var b=q("#lxbBody"); if(!b)return;
  b.focus();
  try{
    if(!SAVED)return;
    var s=window.getSelection(); s.removeAllRanges(); s.addRange(SAVED);
  }catch(_){}
}
// A link with no scheme is the common case -- people paste "lumoscore.com". Left alone the browser
// treats it as a relative path and the link goes nowhere. javascript: is refused outright: the body is
// sanitised on save anyway, but an editor that lets you build one is a trap for whoever uses it next.
function tidyUrl(u){
  u=String(u||"").trim();
  if(!u)return "";
  var lc=u.toLowerCase();
  if(lc.indexOf("javascript:")===0||lc.indexOf("data:")===0)return "";
  if(lc.indexOf("http://")===0||lc.indexOf("https://")===0)return u;
  if(u.charAt(0)==="/"||u.charAt(0)==="#")return u;          // site-relative and anchors are fine
  if(lc.indexOf("mailto:")===0)return u;
  return "https://"+u;
}
function cmd(name){
  restoreSel();
  try{
    if(name==="h2"||name==="h3"||name==="p")document.execCommand("formatBlock",false,name);
    else if(name==="quote")document.execCommand("formatBlock",false,"blockquote");
    else if(name==="ul")document.execCommand("insertUnorderedList");
    else if(name==="ol")document.execCommand("insertOrderedList");
    else if(name==="link"){
      var sel=window.getSelection();
      var had=sel&&String(sel).length>0;
      var u=tidyUrl(prompt("Link URL", "https://"));
      if(!u){ if(u==="")return; return; }
      restoreSel();                                   // prompt() collapsed it again
      if(had)document.execCommand("createLink",false,u);
      // Nothing selected: insert the address as its own link rather than doing nothing silently.
      else document.execCommand("insertHTML",false,"<a href='"+u.replace(/'/g,"%27")+"'>"+u+"</a>");
    }
    else if(name==="unlink")document.execCommand("unlink");
    else document.execCommand(name);
  }catch(e){}
  saveSel();
  wordCount();
}

function boot(){
  if(!isPage())return;
  refresh();
  var nb=q("#lxbNew"); if(nb&&!nb.__lx){ nb.__lx=1; nb.addEventListener("click",function(){ openEditor(null); }); }
  var rf=q("#lxbRefresh"); if(rf&&!rf.__lx){ rf.__lx=1; rf.addEventListener("click",refresh); }
  var cn=q("#lxbCancel"); if(cn&&!cn.__lx){ cn.__lx=1; cn.addEventListener("click",closeEditor); }
  var dr=q("#lxbDraft"); if(dr&&!dr.__lx){ dr.__lx=1; dr.addEventListener("click",function(){ save(false); }); }
  var pb=q("#lxbPublish"); if(pb&&!pb.__lx){ pb.__lx=1; pb.addEventListener("click",function(){ save(true); }); }
  var tl=q("#lxbTools");
  if(tl&&!tl.__lx){ tl.__lx=1;
    // mousedown, not click: by the time click fires the browser has already moved focus and thrown the
    // selection away. Preventing the default here means the caret never leaves the editor at all.
    tl.addEventListener("mousedown",function(e){
      if(e.target.closest&&e.target.closest("button[data-cmd]"))e.preventDefault(); });
    tl.addEventListener("click",function(e){
      var b=e.target.closest&&e.target.closest("button[data-cmd]"); if(!b)return;
      e.preventDefault(); cmd(b.getAttribute("data-cmd")); }); }
  // Track the selection as it moves, so a command always has something to put back even if focus was
  // lost some other way -- clicking the sidebar, tabbing out, switching windows.
  var bd2=q("#lxbBody");
  if(bd2&&!bd2.__lxsel){ bd2.__lxsel=1;
    ["keyup","mouseup","input"].forEach(function(ev){ bd2.addEventListener(ev,saveSel); });
    document.addEventListener("selectionchange",function(){
      var a=document.activeElement; if(a===bd2)saveSel(); }); }
  var tb=q("#lxbTable"); if(tb&&!tb.__lx){ tb.__lx=1; tb.addEventListener("click",function(e){
    var ed=e.target.closest&&e.target.closest(".lxb-edit");
    var dl=e.target.closest&&e.target.closest(".lxb-del");
    if(ed){ var s=ed.getAttribute("data-slug");
      fetch("/lxapi/blog?all=1&slug="+encodeURIComponent(s)+"&t="+Date.now()).then(function(r){return r.json();})
        .then(function(d){ if(d&&d.post)openEditor(d.post); }); return; }
    if(dl){ var s2=dl.getAttribute("data-slug");
      if(!confirm("Delete this post? The URL /blog/"+s2+" will stop working."))return;
      api("DELETE",null,s2).then(function(r){ if(!r.ok)alert("Could not delete: "+((r.d&&r.d.error)||r.status)); refresh(); }); } }); }
  var ti=q("#lxbTitle"); if(ti&&!ti.__lx){ ti.__lx=1; ti.addEventListener("input",function(){
    var sl=q("#lxbSlug"); if(sl&&!sl.disabled)sl.value=slugify(ti.value); }); }
  var cv=q("#lxbCover"); if(cv&&!cv.__lx){ cv.__lx=1; cv.addEventListener("input",coverPrev); }
  var mt=q("#lxbMeta"); if(mt&&!mt.__lx){ mt.__lx=1; mt.addEventListener("input",metaCount); }
  var bd=q("#lxbBody"); if(bd&&!bd.__lx){ bd.__lx=1; bd.addEventListener("input",wordCount);
    // Paste as plain text: the sanitiser would strip the markup at save time anyway, and stripping it
    // at paste time means what you see while writing is what gets stored.
    bd.addEventListener("paste",function(e){ try{ var t=(e.clipboardData||window.clipboardData).getData("text/plain");
      e.preventDefault(); document.execCommand("insertText",false,t); }catch(_){}}); }
}
if(document.readyState!=="loading")boot(); else document.addEventListener("DOMContentLoaded",boot);
})();` + '</' + 'script>';

function variantOf(key) { if (/-dark\.html$/.test(key)) return '-dark'; if (/-mobile\.html$/.test(key)) return '-mobile'; return ''; }

let pages = 0, built = 0;
for (const c of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain', 'stellar', 'xrpl']) {
  for (const dev of ['desktop', 'mobile']) {
    const file = `lumoscore-${c}-${dev}.html`;
    let data; try { data = read(file); } catch (e) { continue; }
    const { json, s, e } = getContents(data);
    let changed = false;
    for (const k of Object.keys(json)) {
      if (!/^lumoscore-admin-blogs(-dark|-mobile)?\.html$/.test(k)) continue;
      let h = json[k];
      const suffix = variantOf(k);
      const tag = suffix === '-mobile' ? '<main class="mob-main">' : '<main class="admin-main">';
      const mi = h.indexOf(tag);
      const me = h.indexOf('</main>', mi);
      if (mi < 0 || me < 0) continue;
      h = h.slice(0, mi) + tag + (suffix === '-mobile' ? MOB : MAIN) + h.slice(me);
      h = h.replace(/<style id="lx-adminblogs-css">[\s\S]*?<\/style>/g, '')
           .replace(/<script id="lx-adminblogs">[\s\S]*?<\/script>/g, '');
      const bi = h.lastIndexOf('</body>');
      if (bi >= 0) h = h.slice(0, bi) + CSS + SCRIPT + h.slice(bi);
      json[k] = h; changed = true; pages++; built++;
    }
    if (changed) {
      const ser = JSON.stringify(json).split('</').join('<' + B + '/');
      fs.writeFileSync(file, data.slice(0, s) + ser + data.slice(e), 'utf8');
    }
  }
}
console.log('admin blogs: editor on ' + pages + ' page key(s)');
