(function(){
if(window.__lxDashBlog)return; window.__lxDashBlog=1;
var MAX=10;
function esc(s){return (String(s==null?"":s).replace(/[<>&"]/g,function(c){return c==="<"?"&lt;":c===">"?"&gt;":c==="&"?"&amp;":"&quot;";})).split(String.fromCharCode(39)).join("&#39;");}
function when(t){ if(!t)return "";
  var d=Date.now()-t, day=86400000;
  if(d<day)return "today";
  if(d<2*day)return "yesterday";
  if(d<7*day)return Math.floor(d/day)+" days ago";
  if(d<30*day)return Math.floor(d/(7*day))+"w ago";
  if(d<365*day)return Math.floor(d/(30*day))+"mo ago";
  return new Date(t).toLocaleDateString(); }
function arrow(d){
  return "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'><path d='"
    +(d<0?"M15 18l-6-6 6-6":"M9 6l6 6-6 6")+"'/></svg>";
}
var READ="<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'><path d='M5 12h14'/><path d='M13 5l7 7-7 7'/></svg>";

// The arrows only exist when the row actually overflows. Three posts in a three-up row scroll
// nowhere, and a control that cannot do anything is worse than no control.
function wireNav(list,head){
  var nav=head.querySelector(".lx-blogs-nav");
  if(!nav){
    nav=document.createElement("div");
    nav.className="lx-blogs-nav";
    nav.innerHTML="<button type='button' class='lx-blogs-arrow' data-d='-1' aria-label='Previous posts'>"+arrow(-1)+"</button>"
                 +"<button type='button' class='lx-blogs-arrow' data-d='1' aria-label='Next posts'>"+arrow(1)+"</button>";
    var more=head.querySelector(".lx-blogs-more");
    if(more)head.insertBefore(nav,more); else head.appendChild(nav);
    nav.addEventListener("click",function(e){
      var t=e.target&&e.target.closest?e.target.closest(".lx-blogs-arrow"):null;
      if(!t||t.disabled)return;
      step(t.getAttribute("data-d")==="1"?1:-1);
    });
  }
  var prev=nav.querySelector("[data-d='-1']"), next=nav.querySelector("[data-d='1']");
  function sync(){
    var max=list.scrollWidth-list.clientWidth;
    nav.style.display=(max>2)?"":"none";
    var at=(list.__lxtarget!=null)?list.__lxtarget:list.scrollLeft;
    prev.disabled=at<=1;
    next.disabled=at>=max-1;
  }
  // Paging from the DESTINATION, not from where the animation happens to be. scrollBy mid-animation
  // measures from the current position, so a second click before the first finished barely moved --
  // five clicks advanced one page. Holding the target makes repeat clicks accumulate, and lets the
  // arrow disable the moment the last page is asked for rather than when it arrives.
  function step(dir){
    var max=list.scrollWidth-list.clientWidth;
    var base=(list.__lxtarget!=null)?list.__lxtarget:list.scrollLeft;
    var amt=Math.max(200,Math.round(list.clientWidth*0.92));
    list.__lxtarget=Math.max(0,Math.min(max,base+dir*amt));
    list.scrollTo({left:list.__lxtarget,behavior:"smooth"});
    clearTimeout(list.__lxtid);
    list.__lxtid=setTimeout(function(){ list.__lxtarget=null; sync(); },700);
    sync();
  }
  if(!list.__lxnav){
    list.__lxnav=1;
    list.addEventListener("scroll",sync,{passive:true});
    window.addEventListener("resize",sync);
  }
  list.__lxsync=sync;
  sync();
  // Cover images change the row's height, not its width, but a late layout pass can still move the
  // ends -- re-check once things have settled rather than trusting the first frame.
  setTimeout(sync,400);
}

function paint(posts){
  var card=document.querySelector(".lx-blogs-card"); if(!card)return;
  var list=card.querySelector(".lx-blogs-list"); if(!list)return;
  var head=card.querySelector(".lx-blogs-head");
  var soon=card.querySelector(".lx-blogs-soon");
  if(soon)soon.remove();

  if(!posts.length){
    list.removeAttribute("data-n");
    list.innerHTML="<div class='lx-blog-empty'>No posts yet.</div>";
    var nav=head&&head.querySelector(".lx-blogs-nav");
    if(nav)nav.style.display="none";
    return;
  }
  var show=posts.slice(0,MAX);
  // Drives the track width: three across once there are three, and an even split below that so a
  // short list fills the card instead of leaving empty columns beside it.
  list.setAttribute("data-n",String(show.length));
  var wide=false;
  var SUF=" | LumosCore";
  function ttl(t){ t=String(t||"");
    return (t.length>SUF.length&&t.slice(-SUF.length)===SUF)?t.slice(0,-SUF.length):t; }
  list.innerHTML=show.map(function(p){
    var cover=p.cover?("<img class='lx-blog-img' alt='' src='"+esc(p.cover)+"'>"):"";
    var sub="<span class='lx-blog-when'>"+esc(when(p.publishedAt||p.createdAt))+"</span>";
    if(p.readMins)sub+="<span class='lx-blog-dot'></span><span class='lx-blog-when'>"+esc(p.readMins)+" min read</span>";
    var read=wide?("<span class='lx-blog-read'>Read article"+READ+"</span>"):"";
    return "<a class='lx-blog-row' href='/blog/"+esc(p.slug)+"'>"
      +"<div class='lx-blog-cover'>"+cover
      +(p.category?("<span class='lx-blog-chip' data-lxc=''>"+esc(p.category)+"</span>"):"")+"</div>"
      +"<div class='lx-blog-meta'>"
      +"<div class='lx-blog-title'>"+esc(ttl(p.title))+"</div>"
      +"<div class='lx-blog-sub'>"+sub+"</div>"+read
      +"</div></a>";
  }).join("");
  if(head)wireNav(list,head);
}

function boot(){
  if(!document.querySelector(".lx-blogs-card"))return;
  fetch("/lxapi/blog").then(function(r){ return r.ok?r.json():null; })
    .then(function(d){ paint((d&&d.posts)||[]); })
    .catch(function(){});
  var more=document.querySelector(".lx-blogs-more");
  if(more&&!more.__lx){ more.__lx=1; more.style.cursor="pointer";
    more.addEventListener("click",function(){ location.href="/blog"; }); }
}
if(document.readyState!=="loading")boot(); else document.addEventListener("DOMContentLoaded",boot);
})();