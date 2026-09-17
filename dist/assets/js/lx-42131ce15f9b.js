(function(){
  if(window.__lxNavWired)return; window.__lxNavWired=1;
  var t0=null, lastTap=null;
  window.addEventListener("touchstart",function(e){
    var p=e.touches&&e.touches[0]; t0=p?{x:p.clientX,y:p.clientY,t:Date.now()}:null;
    lastTap=null;               // a new finger-down starts a new gesture: never swallow a real second tap
  },true);
  window.addEventListener("touchend",function(e){
    if(e.defaultPrevented)return;                                                  // someone already handled it
    var p=e.changedTouches&&e.changedTouches[0]; if(!p||!t0)return;
    if(Math.abs(p.clientX-t0.x)>=12||Math.abs(p.clientY-t0.y)>=12||(Date.now()-t0.t)>=600)return;   // a scroll
    var el=e.target; if(!el||!el.closest)return;
    if(el.closest("input,select,textarea,label,[contenteditable]"))return;         // native focus/picker wins
    var t=el.closest("a[href],button,[role=button]"); if(!t)return;
    if(t.disabled)return;
    var h=t.tagName==="A"?(t.getAttribute("href")||""):null;
    if(h==="#")return;                                                             // design owns these
    e.preventDefault();                                                            // also suppresses any native click
    // Re-dispatch as a real click so every existing handler — ours, the design's, the browser's default
    // link activation — behaves exactly as it does with a mouse.
    lastTap={el:t,t:Date.now()};
    var ce=new MouseEvent("click",{bubbles:true,cancelable:true,view:window});
    ce.__lxBridged=1;
    t.dispatchEvent(ce);
  },true);
  // preventDefault on touchend SHOULD suppress the native compatibility click, and on most handsets it
  // does. On some it still arrives, up to a few hundred ms later — and a control that toggles then gets
  // activated twice from one finger: it opens on our click and closes on the straggler. That is the
  // "dropdown closes on the first tap, works on the second" report, and it is mobile-only by definition,
  // which is why the desktop fix did not touch it. Swallow a native click that lands on the SAME element
  // we just bridged: by construction that click is the duplicate, never a second real tap.
  window.addEventListener("click",function(e){
    if(e.__lxBridged)return;                                                       // the one we dispatched
    // Only the browser's own compatibility click may be swallowed, and that one is always TRUSTED.
    // A script-dispatched click is not, and swallowing those broke the theme toggle on mobile: it
    // suppresses the first click and re-fires el.click() inside startViewTransition, so the real
    // handler runs on a click that is untrusted, lands on the same element, and arrives well inside
    // the window below. This ate it, and the theme never changed. Any control that re-dispatches its
    // own click would have hit the same wall.
    if(!e.isTrusted)return;
    if(!lastTap)return;
    // Deliberately generous: the straggler's delay is the device's to choose, and guessing it wrong is
    // what leaves the bug in place on exactly the handsets that have it. Safe to be generous because a
    // genuine second tap begins with a touchstart, which disarms this first.
    if(Date.now()-lastTap.t>1500){ lastTap=null; return; }
    var el=e.target&&e.target.closest?e.target.closest("a[href],button,[role=button]"):null;
    if(el&&el===lastTap.el){ lastTap=null; e.preventDefault(); e.stopImmediatePropagation(); }
  },true);
})();