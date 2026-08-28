// ADMIN — Support: the inbox for team@ and raza@lumoscore.com.
//
// Mail arrives via the Email Worker in _email-worker/, which forwards to the real mailbox first and
// keeps a copy second. This page is a VIEW of that copy: it never sends, and it cannot delete. Replying
// happens in the normal mail client, where the thread already lives.
//
// Bodies are shown as TEXT, never as the sender's HTML. An inbox that renders arbitrary HTML from
// strangers inside the admin origin is an invitation, and the plain-text part is what support mail is
// actually written in anyway.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const MAIN = `
      <div class="admin-page-head">
        <h1 class="admin-page-title">Support</h1>
        <div class="admin-page-actions">
          <button class="adm-btn ghost" id="lxmRefresh" type="button">Refresh</button>
        </div>
      </div>

      <div class="seg-row" id="lxmSegs">
        <button class="seg-chip active" type="button" data-box="inbox"><span class="seg-label">Inbox</span><span class="seg-count" id="lxmCInbox">&mdash;</span></button>
        <button class="seg-chip" type="button" data-box="unread"><span class="seg-label">Unread</span><span class="seg-count" id="lxmCUnread">&mdash;</span></button>
        <button class="seg-chip" type="button" data-box="archived"><span class="seg-label">Archived</span><span class="seg-count" id="lxmCArch">&mdash;</span></button>
      </div>

      <div class="lxm-grid">
        <div class="adm-card lxm-list">
          <div class="adm-card-body" style="padding:0">
            <div id="lxmList"><div class="lxadm-empty">Loading&hellip;</div></div>
          </div>
        </div>
        <div class="adm-card lxm-read">
          <div class="adm-card-body" id="lxmRead">
            <div class="lxadm-empty">Select a message to read it.</div>
          </div>
        </div>
      </div>
`;

const MOB = `
      <div class="mob-page-head"><h1 class="mob-page-title">Support</h1></div>
      <div class="adm-card"><div class="adm-card-body" style="padding:0"><div id="lxmList"><div class="lxadm-empty">Loading&hellip;</div></div></div></div>
      <div class="adm-card" style="margin-top:14px"><div class="adm-card-body" id="lxmRead"><div class="lxadm-empty">Select a message to read it.</div></div></div>
`;

const CSS = `<style id="lx-adminsupport-css">
.lxm-grid{display:grid;grid-template-columns:minmax(0,360px) minmax(0,1fr);gap:18px;align-items:start}
@media(max-width:1000px){.lxm-grid{grid-template-columns:minmax(0,1fr)}}
.lxm-list{max-height:70vh;overflow-y:auto}
.lxm-row{display:block;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--border);padding:13px 16px;cursor:pointer;color:inherit}
.lxm-row:hover{background:rgba(127,127,140,.06)}
.lxm-row.sel{background:rgba(234,106,44,.09)}
.lxm-row:last-child{border-bottom:0}
.lxm-from{display:flex;align-items:center;gap:8px;font:700 14px/1.3 "Hanken Grotesk",system-ui,sans-serif;color:var(--text)}
.lxm-dot{width:7px;height:7px;border-radius:50%;background:var(--accent,#ea6a2c);flex:0 0 auto}
.lxm-subj{margin-top:3px;font-size:13.5px;line-height:1.4;color:var(--text-soft,#6b6b76);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lxm-meta{margin-top:4px;font-size:12px;color:var(--text-muted)}
.lxm-snip{margin-top:3px;font-size:12.5px;line-height:1.4;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lxm-raw{margin-top:12px;max-height:340px;overflow:auto;padding:12px 14px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2,transparent);font:400 11.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--text-muted);white-space:pre-wrap;word-break:break-all}
.lxm-read-head{border-bottom:1px solid var(--border);padding-bottom:14px;margin-bottom:14px}
.lxm-read-subj{font:800 19px/1.3 "Hanken Grotesk",system-ui,sans-serif;color:var(--text)}
.lxm-read-meta{margin-top:7px;font-size:13px;color:var(--text-muted);line-height:1.7}
.lxm-read-meta a{color:var(--accent,#ea6a2c);text-decoration:none}
.lxm-body{word-break:break-word;max-width:92ch;font:400 14.5px/1.7 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-soft,#6b6b76)}
.lxm-body p{margin:0 0 14px;white-space:pre-line}
.lxm-body p:last-child{margin-bottom:0}
.lxm-html{width:100%;min-height:280px;max-height:60vh;border:1px solid var(--border);border-radius:10px;background:#fff}
.lxm-acts{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap}
.lxm-note{margin-top:14px;font-size:12.5px;color:var(--text-muted)}
.lxm-thread{margin-top:16px}
.lxm-sent{margin-top:10px;padding:12px 14px;border-radius:10px;background:rgba(234,106,44,.07);border:1px solid rgba(234,106,44,.18)}
.lxm-sent-h{font:700 12px/1 "Hanken Grotesk",system-ui,sans-serif;color:var(--accent,#ea6a2c);margin-bottom:7px}
.lxm-sent-b{white-space:pre-wrap;word-break:break-word;font-size:14px;line-height:1.65;color:var(--text-soft,#6b6b76)}
.lxm-reply{margin-top:18px;padding-top:16px;border-top:1px solid var(--border)}
.lxm-ta{width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2,transparent);color:var(--text);font:400 14.5px/1.65 "Hanken Grotesk",system-ui,sans-serif;resize:vertical}
.lxm-ta:focus{outline:2px solid var(--accent,#ea6a2c);outline-offset:1px;border-color:transparent}
.lxm-reply-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px;flex-wrap:wrap}
.lxm-reply-hint{font-size:12.5px;color:var(--text-muted)}
</style>`;

const SCRIPT = '<script id="lx-adminsupport">' + `(function(){
if(window.__lxMailAdmin)return; window.__lxMailAdmin=1;
function q(s){return document.querySelector(s);}
function qa(s){return [].slice.call(document.querySelectorAll(s));}
function esc(s){return String(s==null?"":s).replace(/[<>&"]/g,function(c){return c==="<"?"&lt;":c===">"?"&gt;":c==="&"?"&amp;":"&quot;";});}
function isPage(){var t=((q(".admin-page-title")||q(".mob-page-title")||{}).textContent||"").trim();return t.indexOf("Support")===0;}
function when(t){ var d=Date.now()-t;
  if(d<60000)return "just now";
  if(d<3600000)return Math.floor(d/60000)+"m ago";
  if(d<86400000)return Math.floor(d/3600000)+"h ago";
  if(d<604800000)return Math.floor(d/86400000)+"d ago";
  return new Date(t).toLocaleDateString(); }

var BOX="inbox", MSGS=[], SEL=null;

function api(path,opts){ return fetch("/lxapi/mail"+path,opts).then(function(r){
  return r.text().then(function(t){ var d=null; try{ d=JSON.parse(t); }catch(_){ }
    return {ok:r.ok&&!!d,status:r.status,d:d}; }); }); }

function load(){
  var box=(BOX==="archived")?"archived":"inbox";
  api("?box="+box+"&t="+Date.now()).then(function(r){
    var list=q("#lxmList"); if(!list)return;
    if(!r.ok){
      list.innerHTML="<div class='lxadm-empty'>Could not read the inbox"
        +(r.status===403?" \\u2014 this page has to be opened through the admin login.":".")+"</div>";
      return;
    }
    if(r.d&&r.d.reason==="no db"){
      list.innerHTML="<div class='lxadm-empty'>Storage is not connected yet.</div>"; return;
    }
    MSGS=(r.d&&r.d.messages)||[];
    var c=(r.d&&r.d.counts)||{};
    setC("#lxmCInbox",c.inbox); setC("#lxmCUnread",c.unread); setC("#lxmCArch",c.archived);
    render();
  }).catch(function(e){
    var list=q("#lxmList"); if(list)list.innerHTML="<div class='lxadm-empty'>Could not read the inbox: "+esc(e.message)+"</div>";
  });
}
function setC(sel,n){ var e=q(sel); if(e)e.textContent=(n==null?"0":String(n)); }

function visible(){ return (BOX==="unread")?MSGS.filter(function(m){return !m.read_at;}):MSGS; }

function render(){
  var list=q("#lxmList"); if(!list)return;
  var rows=visible();
  if(!rows.length){
    list.innerHTML="<div class='lxadm-empty'>"+(BOX==="archived"?"Nothing archived."
      :(BOX==="unread"?"Nothing unread.":"No messages yet. Mail sent to support@, info@ or raza@lumoscore.com will appear here."))+"</div>";
    return;
  }
  list.innerHTML=rows.map(function(m){
    return "<button class='lxm-row"+(SEL===m.id?" sel":"")+"' type='button' data-id='"+esc(m.id)+"'>"
      +"<div class='lxm-from'>"+(m.read_at?"":"<span class='lxm-dot'></span>")
      +esc(m.from_name||m.from_addr)+"</div>"
      +"<div class='lxm-subj'>"+esc(m.subject||"(no subject)")+"</div>"
      +"<div class='lxm-snip'>"+esc((m.snippet||"").replace(/[ ]+/g," ").trim()||"(no message body)")+"</div>"
      +"<div class='lxm-meta'>"+esc(when(m.ts))+" \\u00b7 to "+esc(m.to_addr)+"</div></button>";
  }).join("");
}

function open(id){
  SEL=id; render();
  var pane=q("#lxmRead"); if(!pane)return;
  pane.innerHTML="<div class='lxadm-empty'>Loading\\u2026</div>";
  api("?id="+encodeURIComponent(id)+"&t="+Date.now()).then(function(r){
    if(!r.ok||!r.d||!r.d.message){ pane.innerHTML="<div class='lxadm-empty'>Could not open that message.</div>"; return; }
    var m=r.d.message;
    // Plain text is shown as text. HTML is shown in a SANDBOXED iframe -- srcdoc with a bare sandbox
    // attribute, so no scripts, no forms, no top-level navigation and its own opaque origin. Inserting
    // a stranger's markup into this document instead would run their script on the admin origin.
    var text=(m.body_text||"").trim();
    var html=(m.body_html||"");
    // An HTML part can be technically present and still say nothing: Gmail sends
    // <div dir="ltr"><br></div> for an empty message. Strip the tags to see whether there are words.
    var htmlWords=html.replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ").trim();
    var body;
    if(text){
      body=document.createElement("div"); body.className="lxm-body";
      // Plain-text mail is HARD-WRAPPED by the sending client -- Gmail breaks at about 78 characters.
      // Rendering it with pre-wrap honours every one of those breaks, so the text kept its 78-column
      // shape no matter how wide the pane was. Lines within a paragraph are rejoined so the text flows
      // to the available width, and blank lines still separate paragraphs.
      //
      // Breaks are KEPT before quotes and list items: a line starting with >, -, * or "1." is a
      // structure the sender intended, and joining those would turn a list into a run-on sentence.
      // No newline escapes in the regexes here: this sits inside a template literal, where a written
      // backslash-n becomes a real line break and silently destroys the pattern it was meant to be.
      // The characters come from fromCharCode instead, which nothing can mangle on the way out.
      var LF=String.fromCharCode(10), CR=String.fromCharCode(13);
      var keep=/^[ ]*([>*-]|[0-9]+[.)])[ ]/;
      var lines=text.split(CR).join("").split(LF);
      var paras=[], cur=[];
      lines.forEach(function(ln){
        if(!ln.trim()){ if(cur.length){ paras.push(cur); cur=[]; } return; }
        cur.push(ln);
      });
      if(cur.length)paras.push(cur);
      if(!paras.length)paras=[[text]];
      paras.forEach(function(para){
        var out=[];
        para.forEach(function(ln){
          if(!out.length||keep.test(ln)){ out.push(ln); return; }
          out[out.length-1]=out[out.length-1].replace(/[ ]+$/,"")+" "+ln.trim();
        });
        var p=document.createElement("p"); p.textContent=out.join(LF); body.appendChild(p);
      });
    }
    else if(htmlWords){
      body=document.createElement("iframe");
      body.className="lxm-html";
      body.setAttribute("sandbox","");
      body.setAttribute("srcdoc","<style>body{font:400 14.5px/1.7 system-ui,sans-serif;color:#333;margin:0}"
        +"img{max-width:100%;height:auto}</style>"+html);
    }
    else {
      body=document.createElement("div"); body.className="lxm-body";
      // Say what is actually true. "Sent as HTML only" was wrong and sent me looking for a parser bug
      // that did not exist -- the sender had simply written a subject and no message.
      body.textContent="(No message body \\u2014 the sender wrote only a subject.)";
    }
    pane.innerHTML="<div class='lxm-read-head'>"
      +"<div class='lxm-read-subj'>"+esc(m.subject||"(no subject)")+"</div>"
      +"<div class='lxm-read-meta'>From <b>"+esc(m.from_name||"")+"</b> &lt;<a href='mailto:"+esc(m.from_addr)+"'>"+esc(m.from_addr)+"</a>&gt;<br>"
      +"To "+esc(m.to_addr)+" \\u00b7 "+esc(new Date(m.ts).toLocaleString())+"</div></div>";
    pane.appendChild(body);
    // Replies already sent, so the pane shows the whole thread and not just the inbound half.
    var thread=document.createElement("div"); thread.className="lxm-thread"; pane.appendChild(thread);
    fetch("/lxapi/reply?id="+encodeURIComponent(m.id)+"&t="+Date.now()).then(function(r){ return r.json(); })
      .then(function(d){ var rs=(d&&d.replies)||[]; if(!rs.length)return;
        thread.innerHTML=rs.map(function(x){
          return "<div class='lxm-sent'><div class='lxm-sent-h'>You replied · "+esc(new Date(x.ts).toLocaleString())
            +(x.err?" · <b>failed</b>":"")+"</div><div class='lxm-sent-b'></div></div>"; }).join("");
        [].slice.call(thread.querySelectorAll(".lxm-sent-b")).forEach(function(el,i){ el.textContent=rs[i].body; });
      });
    // The reply box. It sends to the address on the STORED message, never to anything typed here.
    var box=document.createElement("div"); box.className="lxm-reply";
    box.innerHTML="<textarea class='lxm-ta' id='lxmReply' rows='5' placeholder='Write your reply…'></textarea>"
      +"<div class='lxm-reply-bar'><span class='lxm-reply-hint' id='lxmReplyHint'>Sends to "+esc(m.from_addr)+" · replies come back to support@lumoscore.com</span>"
      +"<button class='adm-btn primary' type='button' id='lxmSend'>Send reply</button></div>";
    pane.appendChild(box);
    box.querySelector("#lxmSend").addEventListener("click",function(){
      var ta=box.querySelector("#lxmReply"), btn=box.querySelector("#lxmSend"), hint=box.querySelector("#lxmReplyHint");
      var text=(ta.value||"").trim();
      if(!text){ hint.textContent="Write something first."; return; }
      btn.disabled=true; btn.textContent="Sending…";
      fetch("/lxapi/reply",{method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({id:m.id,body:text})})
        .then(function(r){ return r.json(); })
        .then(function(d){ btn.disabled=false; btn.textContent="Send reply";
          if(!d||d.error){ hint.textContent="Not sent: "+((d&&(d.message||d.error))||"unknown error"); return; }
          ta.value=""; hint.textContent="Sent to "+d.to+"."; open(m.id); })
        .catch(function(e){ btn.disabled=false; btn.textContent="Send reply"; hint.textContent="Not sent: "+e.message; });
    });
    var acts=document.createElement("div"); acts.className="lxm-acts";
    acts.innerHTML="<a class='adm-btn primary' href='mailto:"+esc(m.from_addr)
      +"?subject="+encodeURIComponent("Re: "+(m.subject||""))+"'>Reply in mail client</a>"
      +"<button class='adm-btn ghost' type='button' data-act='unread'>Mark unread</button>"
      +"<button class='adm-btn ghost' type='button' data-act='arch'>"+(m.archived?"Move to inbox":"Archive")+"</button>";
    pane.appendChild(acts);
    // View original. The stored raw is the record; the parsed body is a convenience. Being able to see
    // the source is what settles "is this empty or did the parser miss it?" without a round trip.
    if(m.raw){
      var tog=document.createElement("button"); tog.type="button"; tog.className="adm-btn ghost"; tog.style.marginTop="14px";
      tog.textContent="View original";
      var pre=document.createElement("pre"); pre.className="lxm-raw"; pre.hidden=true; pre.textContent=m.raw;
      tog.addEventListener("click",function(){ pre.hidden=!pre.hidden; tog.textContent=pre.hidden?"View original":"Hide original"; });
      pane.appendChild(tog); pane.appendChild(pre);
    }
    var note=document.createElement("div"); note.className="lxm-note";
    note.textContent="This is a copy. The original was delivered to your mailbox as usual, and replies are sent from there.";
    pane.appendChild(note);

    acts.addEventListener("click",function(e){
      var b=e.target.closest&&e.target.closest("button[data-act]"); if(!b)return;
      var act=b.getAttribute("data-act");
      var body2=(act==="unread")?{id:m.id,read:false}:{id:m.id,archived:m.archived?0:1};
      api("",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(body2)})
        .then(function(){ SEL=null; pane.innerHTML="<div class='lxadm-empty'>Select a message to read it.</div>"; load(); });
    });

    if(!m.read_at){
      api("",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:m.id,read:true})})
        .then(function(){ var row=MSGS.filter(function(x){return x.id===m.id;})[0];
          if(row){ row.read_at=Date.now(); render(); }
          var c=q("#lxmCUnread"); if(c){ var n=parseInt(c.textContent,10); if(n>0)c.textContent=String(n-1); } });
    }
  });
}

function boot(){
  if(!isPage())return;
  var head=q(".admin-page-head")||q(".mob-page-head");
  if(head&&!q(".lxadm-note")){ var n=document.createElement("div"); n.className="lxadm-note";
    n.textContent="Mail to support@, info@ and raza@lumoscore.com is forwarded to your mailbox exactly as before; this is a copy kept for reference. Replies are sent from your own mail client, not from here.";
    head.parentNode.insertBefore(n, head.nextSibling); }
  var list=q("#lxmList");
  if(list&&!list.__lx){ list.__lx=1; list.addEventListener("click",function(e){
    var b=e.target.closest&&e.target.closest(".lxm-row"); if(b)open(b.getAttribute("data-id")); }); }
  var segs=q("#lxmSegs");
  if(segs&&!segs.__lx){ segs.__lx=1; segs.addEventListener("click",function(e){
    var b=e.target.closest&&e.target.closest("[data-box]"); if(!b)return;
    qa("#lxmSegs .seg-chip").forEach(function(c){ c.classList.remove("active"); });
    b.classList.add("active"); BOX=b.getAttribute("data-box");
    if(BOX==="archived")load(); else render(); }); }
  var rf=q("#lxmRefresh"); if(rf&&!rf.__lx){ rf.__lx=1; rf.addEventListener("click",load); }
  load();
}
if(document.readyState!=="loading")boot(); else document.addEventListener("DOMContentLoaded",boot);
})();` + '</' + 'script>';

function variantOf(key) { if (/-dark\.html$/.test(key)) return '-dark'; if (/-mobile\.html$/.test(key)) return '-mobile'; return ''; }

let pages = 0;
for (const c of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain', 'stellar', 'xrpl']) {
  for (const dev of ['desktop', 'mobile']) {
    const file = `lumoscore-${c}-${dev}.html`;
    let data; try { data = read(file); } catch (e) { continue; }
    const { json, s, e } = getContents(data);
    let changed = false;
    for (const k of Object.keys(json)) {
      if (!/^lumoscore-admin-support(-dark|-mobile)?\.html$/.test(k)) continue;
      let h = json[k];
      const suffix = variantOf(k);
      const tag = suffix === '-mobile' ? '<main class="mob-main">' : '<main class="admin-main">';
      const mi = h.indexOf(tag);
      const me = h.indexOf('</main>', mi);
      if (mi < 0 || me < 0) continue;
      h = h.slice(0, mi) + tag + (suffix === '-mobile' ? MOB : MAIN) + h.slice(me);
      h = h.replace(/<style id="lx-adminsupport-css">[\s\S]*?<\/style>/g, '')
           .replace(/<script id="lx-adminsupport">[\s\S]*?<\/script>/g, '');
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
console.log('admin support: inbox on ' + pages + ' page key(s)');
