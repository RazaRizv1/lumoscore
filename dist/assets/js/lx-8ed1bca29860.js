(function(){
  var KEEP=[];
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
})();