// ADMIN — Support: the inbox for team@ and raza@lumoscore.com.
//
// Mail arrives via the Email Worker in _email-worker/, which forwards to the real mailbox first and
// keeps a copy second. This page is a VIEW of that copy. Nothing done here can touch what was already
// delivered to the real mailbox -- including Delete, which removes LumosCore's copy and nothing else.
//
// Spam is a rule about a SENDER, not a flag on one message: marking a message as spam blocks the
// address, which moves every mail that address has ever sent and every one it sends next. It is
// applied when the list is read, so it is reversible in one click. See functions/lxapi/mail.js.
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

      <div class="lxm-bar">
        <div class="seg-row" id="lxmSegs">
          <button class="seg-chip active" type="button" data-box="inbox"><span class="seg-label">Inbox</span><span class="seg-count" id="lxmCInbox">&mdash;</span></button>
          <button class="seg-chip" type="button" data-box="unread"><span class="seg-label">Unread</span><span class="seg-count" id="lxmCUnread">&mdash;</span></button>
          <button class="seg-chip" type="button" data-box="archived"><span class="seg-label">Archived</span><span class="seg-count" id="lxmCArch">&mdash;</span></button>
          <button class="seg-chip" type="button" data-box="spam"><span class="seg-label">Spam</span><span class="seg-count" id="lxmCSpam">&mdash;</span></button>
        </div>
        <div class="lxm-search">
          <svg class="lxm-search-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>
          <input class="lxm-search-in" id="lxmQ" type="search" autocomplete="off" spellcheck="false" placeholder="Search mail&hellip;">
          <button class="lxm-search-x" id="lxmQX" type="button" hidden aria-label="Clear search">&times;</button>
        </div>
      </div>

      <div class="lxm-grid">
        <div class="adm-card lxm-list">
          <div class="lxm-lhead">
            <label class="lxm-ck lxm-ck-all"><input type="checkbox" id="lxmAll" aria-label="Select all"></label>
            <span class="lxm-lhead-t" id="lxmSelTxt">Select all</span>
            <div class="lxm-bulk" id="lxmBulk" hidden>
              <button class="adm-btn ghost lxm-mini" type="button" data-bulk="spam">Spam</button>
              <button class="adm-btn ghost lxm-mini" type="button" data-bulk="spamdom">Block domain</button>
              <button class="adm-btn ghost lxm-mini lxm-del" type="button" data-bulk="del">Delete</button>
            </div>
          </div>
          <div class="lxm-lbody" id="lxmList"><div class="lxadm-empty">Loading&hellip;</div></div>
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
      <div class="lxm-bar">
        <div class="seg-row" id="lxmSegs">
          <button class="seg-chip active" type="button" data-box="inbox"><span class="seg-label">Inbox</span><span class="seg-count" id="lxmCInbox">&mdash;</span></button>
          <button class="seg-chip" type="button" data-box="unread"><span class="seg-label">Unread</span><span class="seg-count" id="lxmCUnread">&mdash;</span></button>
          <button class="seg-chip" type="button" data-box="archived"><span class="seg-label">Archived</span><span class="seg-count" id="lxmCArch">&mdash;</span></button>
          <button class="seg-chip" type="button" data-box="spam"><span class="seg-label">Spam</span><span class="seg-count" id="lxmCSpam">&mdash;</span></button>
        </div>
        <div class="lxm-search">
          <svg class="lxm-search-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>
          <input class="lxm-search-in" id="lxmQ" type="search" autocomplete="off" spellcheck="false" placeholder="Search mail&hellip;">
          <button class="lxm-search-x" id="lxmQX" type="button" hidden aria-label="Clear search">&times;</button>
        </div>
      </div>
      <div class="adm-card lxm-list">
        <div class="lxm-lhead">
          <label class="lxm-ck lxm-ck-all"><input type="checkbox" id="lxmAll" aria-label="Select all"></label>
          <span class="lxm-lhead-t" id="lxmSelTxt">Select all</span>
          <div class="lxm-bulk" id="lxmBulk" hidden>
            <button class="adm-btn ghost lxm-mini" type="button" data-bulk="spam">Spam</button>
            <button class="adm-btn ghost lxm-mini" type="button" data-bulk="spamdom">Domain</button>
            <button class="adm-btn ghost lxm-mini lxm-del" type="button" data-bulk="del">Delete</button>
          </div>
        </div>
        <div class="lxm-lbody" id="lxmList"><div class="lxadm-empty">Loading&hellip;</div></div>
      </div>
      <div class="adm-card lxm-read" style="margin-top:14px"><div class="adm-card-body" id="lxmRead"><div class="lxadm-empty">Select a message to read it.</div></div></div>
`;

const CSS = `<style id="lx-adminsupport-css">
/* ONE TOOLBAR, not two stacked blocks. The chips and the search box both narrow the same list, so they
   belong on the same line -- the search sitting alone underneath read as an orphaned control and was
   the first thing RAZA called out (2026-09-23). Chips left, search right, one shared baseline; they
   stack only when the row genuinely runs out of width. */
.lxm-bar{display:flex;align-items:center;justify-content:space-between;gap:14px 18px;flex-wrap:wrap;margin:16px 0 18px}
.lxm-bar .seg-row{margin:0;flex:0 1 auto}
.lxm-search{position:relative;display:flex;align-items:center;margin:0;flex:1 1 240px;max-width:340px;min-width:200px}
.lxm-search-i{position:absolute;left:13px;width:17px;height:17px;color:var(--text-muted);pointer-events:none;stroke-linecap:round}
.lxm-search-in{width:100%;box-sizing:border-box;padding:11px 38px 11px 39px;border:1px solid var(--border);border-radius:10px;
  background:var(--surface-2,transparent);color:var(--text);font:400 14.5px/1.4 "Hanken Grotesk",system-ui,sans-serif}
.lxm-search-in::placeholder{color:var(--text-muted)}
.lxm-search-in:focus{outline:2px solid var(--accent,#ea6a2c);outline-offset:1px;border-color:transparent}
/* the browser's own search-cancel button is unstyleable and sits in the wrong place next to ours */
.lxm-search-in::-webkit-search-cancel-button{display:none}
.lxm-search-x{position:absolute;right:6px;width:26px;height:26px;border:0;border-radius:7px;background:none;cursor:pointer;
  color:var(--text-muted);font-size:19px;line-height:1;display:flex;align-items:center;justify-content:center}
.lxm-search-x:hover{background:rgba(127,127,140,.12);color:var(--text)}
/* display:flex above beats the UA sheet's [hidden]{display:none}, so the clear button sat there on an
   empty field with nothing to clear. Any author rule that sets display has to restate this. */
.lxm-search-x[hidden]{display:none}
/* TWO COLUMNS OF THE SAME HEIGHT, each scrolling inside itself. Before this the list was capped at
   70vh while the reading pane grew with its message, so the two cards ended on different lines and
   the page looked unaligned however much was in it. A shared height is what makes a mail layout read
   as one object instead of two panels that happen to sit side by side. */
.lxm-grid{display:grid;grid-template-columns:minmax(0,380px) minmax(0,1fr);gap:18px;align-items:stretch}
@media(max-width:1000px){.lxm-grid{grid-template-columns:minmax(0,1fr)}}
.lxm-list,.lxm-read{display:flex;flex-direction:column;min-height:0;height:clamp(460px,72vh,820px)}
.lxm-lbody{flex:1;min-height:0;overflow-y:auto}
.lxm-read>.adm-card-body{flex:1;min-height:0;overflow-y:auto}
@media(max-width:1000px){.lxm-list,.lxm-read{height:auto;max-height:none}.lxm-lbody{max-height:60vh}}

/* The list header: one row that is the select-all control at rest and the bulk toolbar once anything
   is ticked, so the actions appear exactly where the selection was made. */
.lxm-lhead{display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid var(--border);
  min-height:48px;box-sizing:border-box;flex:0 0 auto}
.lxm-lhead-t{font:600 12.5px/1.3 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-muted);letter-spacing:.2px}
.lxm-lhead.on .lxm-lhead-t{color:var(--accent,#ea6a2c);font-weight:700}
.lxm-bulk{display:flex;gap:7px;margin-left:auto}
.lxm-bulk[hidden]{display:none}
.lxm-mini{padding:6px 11px;font-size:12.5px;border-radius:8px}

/* Checkboxes get a fixed-width gutter so every row's text starts on the same vertical line, header
   included -- that single shared edge is most of what "organised" means here. */
.lxm-ck{display:flex;align-items:center;justify-content:center;flex:0 0 auto;width:26px;cursor:pointer}
.lxm-ck input{width:15px;height:15px;margin:0;cursor:pointer;accent-color:var(--accent,#ea6a2c)}
.lxm-row{display:flex;align-items:flex-start;border-bottom:1px solid var(--border)}
.lxm-row:last-child{border-bottom:0}
.lxm-row:hover{background:rgba(127,127,140,.06)}
.lxm-row.sel{background:rgba(234,106,44,.09)}
.lxm-row.tick{background:rgba(234,106,44,.06)}
.lxm-row .lxm-ck{align-self:stretch;padding:0 0 0 8px}
/* The clickable part of the row is a button INSIDE the row, not the row itself: a checkbox cannot
   live inside a button, and one click target for "open" and another for "select" is the whole point. */
.lxm-rowmain{flex:1;min-width:0;display:block;text-align:left;background:none;border:0;padding:13px 16px 13px 10px;cursor:pointer;color:inherit;font:inherit}
.lxm-from{display:flex;align-items:center;gap:8px;font:700 14px/1.3 "Hanken Grotesk",system-ui,sans-serif;color:var(--text)}
.lxm-from-n{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lxm-when{margin-left:auto;flex:0 0 auto;font:400 11.5px/1.3 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-muted)}
.lxm-dot{width:7px;height:7px;border-radius:50%;background:var(--accent,#ea6a2c);flex:0 0 auto}
.lxm-subj{margin-top:4px;font-size:13.5px;line-height:1.4;color:var(--text-soft,#6b6b76);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lxm-meta{margin-top:4px;font-size:12px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lxm-snip{margin-top:3px;font-size:12.5px;line-height:1.4;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lxm-raw{margin-top:12px;max-height:340px;overflow:auto;padding:12px 14px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2,transparent);font:400 11.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--text-muted);white-space:pre-wrap;word-break:break-all}
.lxm-read-head{border-bottom:1px solid var(--border);padding-bottom:14px;margin-bottom:14px}
.lxm-read-subj{font:800 19px/1.3 "Hanken Grotesk",system-ui,sans-serif;color:var(--text)}
.lxm-read-meta{margin-top:7px;font-size:13px;color:var(--text-muted);line-height:1.7}
.lxm-read-meta a{color:var(--accent,#ea6a2c);text-decoration:none}
/* +2pt on everything that is the EMAIL ITSELF -- the received body, a sent reply, and the box you type
   the reply into, so what you write matches what you read (RAZA 2026-09-23). The list rows keep their
   smaller type: those are an index, not the mail. */
.lxm-body{word-break:break-word;font:400 16.5px/1.7 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-soft,#6b6b76)}
.lxm-body p{margin:0 0 14px;white-space:pre-line}
.lxm-body p:last-child{margin-bottom:0}
.lxm-html{width:100%;min-height:280px;max-height:60vh;border:1px solid var(--border);border-radius:10px;background:#fff}
.lxm-acts{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap}
/* Delete is the only irreversible control on this page, so it is the only one that is red -- and it
   only turns red on the SECOND click, once it is asking to be confirmed. A destructive button that
   looks dangerous from the start trains you to ignore how it looks. */
/* Scoped by the parent so it cannot tie with the panel's own .adm-btn.ghost on specificity. Both are
   (0,2,0) unscoped, which leaves the armed state depending on which sheet is injected last -- true
   today, and not something to leave to the build order. */
.lxm-acts .lxm-del{margin-left:auto}
.lxm-acts .lxm-del.arm,.lxm-bulk .lxm-del.arm{border-color:rgba(220,74,74,.55);color:#dc4a4a;background:rgba(220,74,74,.08)}
.lxm-acts .lxm-del.arm:hover,.lxm-bulk .lxm-del.arm:hover{background:rgba(220,74,74,.16)}
/* Why a message is in Spam, said where the question gets asked. Without it the box looks like a filter
   with no explanation and no way back. */
.lxm-spambar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;
  margin-bottom:14px;padding:11px 14px;border-radius:10px;background:rgba(234,179,8,.10);border:1px solid rgba(234,179,8,.28)}
.lxm-spambar-t{font-size:13px;line-height:1.55;color:var(--text-soft,#6b6b76)}
.lxm-spambar-t b{color:var(--text)}
.lxm-note{margin-top:14px;font-size:12.5px;color:var(--text-muted)}
.lxm-thread{margin-top:16px}
.lxm-sent{margin-top:10px;padding:12px 14px;border-radius:10px;background:rgba(234,106,44,.07);border:1px solid rgba(234,106,44,.18)}
.lxm-sent-h{font:700 12px/1 "Hanken Grotesk",system-ui,sans-serif;color:var(--accent,#ea6a2c);margin-bottom:7px}
.lxm-sent-b{white-space:pre-wrap;word-break:break-word;font-size:16px;line-height:1.65;color:var(--text-soft,#6b6b76)}
/* delivery state, read from Resend when the thread opens: what the reader actually needs to know about a reply */
.lxm-st{display:inline-block;margin-left:6px;padding:2px 7px;border-radius:999px;font:700 10.5px/1.5 "Hanken Grotesk",system-ui,sans-serif;letter-spacing:.2px;vertical-align:1px}
.lxm-st.ok{background:rgba(53,192,127,.14);color:#2aa56c}
.lxm-st.bad{background:rgba(239,68,68,.12);color:#dc4a4a}
.lxm-st.warn{background:rgba(234,179,8,.15);color:#b7870a}
.lxm-st.wait{background:rgba(127,127,140,.14);color:var(--text-soft,#6b6b76)}
.lxm-reply{margin-top:18px;padding-top:16px;border-top:1px solid var(--border)}
.lxm-ta{width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2,transparent);color:var(--text);font:400 16.5px/1.65 "Hanken Grotesk",system-ui,sans-serif;resize:vertical}
.lxm-ta:focus{outline:2px solid var(--accent,#ea6a2c);outline-offset:1px;border-color:transparent}
.lxm-reply-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px;flex-wrap:wrap}
.lxm-reply-hint{font-size:12.5px;color:var(--text-muted)}
</style>`;

const SCRIPT = '<script id="lx-adminsupport">' + `(function(){
if(window.__lxMailAdmin)return; window.__lxMailAdmin=1;
function q(s){return document.querySelector(s);}
function qa(s){return [].slice.call(document.querySelectorAll(s));}
function esc(s){return (String(s==null?"":s).replace(/[<>&"]/g,function(c){return c==="<"?"&lt;":c===">"?"&gt;":c==="&"?"&amp;":"&quot;";})).split(String.fromCharCode(39)).join("&#39;");}
// What happened to a reply AFTER Resend accepted it -- delivered, bounced, marked as spam -- as the server read it
// from Resend. Wording says what the reader can act on; "unknown" shows nothing rather than a false claim.
function lxmStatus(st){
  var M={delivered:["ok","Delivered"], opened:["ok","Delivered \\u00b7 opened"], bounced:["bad","Bounced \\u2014 not delivered"],
    complained:["bad","Marked as spam"], failed:["bad","Failed"], delayed:["warn","Delivery delayed"], sent:["wait","Sent \\u2014 waiting for delivery"]};
  var v=M[st]; if(!v) return "";
  return "<span class='lxm-st "+v[0]+"'>"+v[1]+"</span>";
}
function isPage(){var t=((q(".admin-page-title")||q(".mob-page-title")||{}).textContent||"").trim();return t.indexOf("Support")===0;}
// The @host of an address, for the domain-block button's label. Last @ wins: a local part may legally
// contain one inside quotes, and the host is always what follows the final separator.
function dom(a){ var s=String(a||""), i=s.lastIndexOf("@"); return i>0?("@"+s.slice(i+1).toLowerCase()):""; }
function when(t){ var d=Date.now()-t;
  if(d<60000)return "just now";
  if(d<3600000)return Math.floor(d/60000)+"m ago";
  if(d<86400000)return Math.floor(d/3600000)+"h ago";
  if(d<604800000)return Math.floor(d/86400000)+"d ago";
  return new Date(t).toLocaleDateString(); }

var BOX="inbox", MSGS=[], SEL=null, Q="", QT=0, TICK={};

function api(path,opts){ return fetch("/lxapi/mail"+path,opts).then(function(r){
  return r.text().then(function(t){ var d=null; try{ d=JSON.parse(t); }catch(_){ }
    return {ok:r.ok&&!!d,status:r.status,d:d}; }); }); }

function load(){
  // "Unread" is not a box on the server -- it is the inbox with a client-side filter, because the
  // inbox rows are already loaded and refetching them to hide the read ones is a round trip for
  // nothing. Every other chip maps straight through.
  var box=(BOX==="archived")?"archived":(BOX==="spam")?"spam":"inbox";
  api("?box="+box+(Q?("&q="+encodeURIComponent(Q)):"")+"&t="+Date.now()).then(function(r){
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
    setC("#lxmCInbox",c.inbox); setC("#lxmCUnread",c.unread); setC("#lxmCArch",c.archived); setC("#lxmCSpam",c.spam);
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
    // A search that finds nothing says WHERE it looked, because the box it looked in is the usual
    // reason: mail you remember is often archived, or from someone you have since blocked.
    var msg = Q
      ? ("No match for \\u201c"+esc(Q)+"\\u201d in "+({inbox:"Inbox",unread:"Unread",archived:"Archived",spam:"Spam"}[BOX]||"Inbox")
         +". Try another box \\u2014 search only looks in the one you are on.")
      : (BOX==="archived"?"Nothing archived."
        :(BOX==="spam"?"Nothing in spam. Mark a message as spam and everything from that sender moves here."
        :(BOX==="unread"?"Nothing unread.":"No messages yet. Mail sent to support@, info@ or raza@lumoscore.com will appear here.")));
    list.innerHTML="<div class='lxadm-empty'>"+msg+"</div>";
    return;
  }
  list.innerHTML=rows.map(function(m){
    var tick=!!TICK[m.id];
    return "<div class='lxm-row"+(SEL===m.id?" sel":"")+(tick?" tick":"")+"' data-id='"+esc(m.id)+"'>"
      +"<label class='lxm-ck'><input type='checkbox' data-ck='"+esc(m.id)+"'"+(tick?" checked":"")
      +" aria-label='Select message from "+esc(m.from_name||m.from_addr)+"'></label>"
      +"<button class='lxm-rowmain' type='button' data-open='"+esc(m.id)+"'>"
      // The time moves onto the sender line and out of the meta line. It is the one value every row
      // has in the same shape, so it makes a clean right-hand column -- and the meta line stops being
      // two unrelated facts jammed together.
      +"<div class='lxm-from'>"+(m.read_at?"":"<span class='lxm-dot'></span>")
      +"<span class='lxm-from-n'>"+esc(m.from_name||m.from_addr)+"</span>"
      +"<span class='lxm-when'>"+esc(when(m.ts))+"</span></div>"
      +"<div class='lxm-subj'>"+esc(m.subject||"(no subject)")+"</div>"
      +"<div class='lxm-snip'>"+esc((m.snippet||"").replace(/[ ]+/g," ").trim()||"(no message body)")+"</div>"
      +"<div class='lxm-meta'>to "+esc(m.to_addr)+"</div></button></div>";
  }).join("");
  paintSel();
}

// ---- selection ---------------------------------------------------------------------------------
// TICK holds ids, not indexes, so a redraw after a load cannot move a tick onto a different message.
// It is cleared whenever the visible set changes (box or search), because a selection you can no
// longer see is a selection you can act on by accident.
// A bulk action that fails says so in the header where the buttons are, not in a dialog and not in
// silence -- the selection is still there, so the message has somewhere to point.
function bulkErr(r){
  var txt=q("#lxmSelTxt"); if(!txt)return;
  var was=txt.textContent;
  txt.textContent=((r&&r.d&&r.d.error)||("HTTP "+((r&&r.status)||"?")));
  txt.style.color="#dc4a4a";
  setTimeout(function(){ txt.style.color=""; txt.textContent=was; },4000);
}
function selIds(){ return visible().map(function(m){ return m.id; }).filter(function(id){ return TICK[id]; }); }
function clearSel(){ TICK={}; }
function paintSel(){
  var ids=selIds(), n=ids.length, total=visible().length;
  var head=q(".lxm-lhead"), txt=q("#lxmSelTxt"), bulk=q("#lxmBulk"), all=q("#lxmAll");
  if(!head)return;
  if(all){ all.checked=n>0&&n===total; all.indeterminate=n>0&&n<total; }
  head.classList.toggle("on",n>0);
  if(txt) txt.textContent = n ? (n+" selected") : (total?("Select all "+total):"Select all");
  if(bulk){ bulk.hidden=!n;
    // Re-arming has to reset with the selection: a Delete left armed for three messages must not
    // still be armed when the selection has become thirty.
    var d=bulk.querySelector(".lxm-del"); if(d&&!n){ d.classList.remove("arm"); d.textContent="Delete"; } }
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
      body.setAttribute("srcdoc","<style>body{font:400 16.5px/1.7 system-ui,sans-serif;color:#333;margin:0}"
        +"img{max-width:100%;height:auto}</style>"+html);
    }
    else {
      body=document.createElement("div"); body.className="lxm-body";
      // Say what is actually true. "Sent as HTML only" was wrong and sent me looking for a parser bug
      // that did not exist -- the sender had simply written a subject and no message.
      body.textContent="(No message body \\u2014 the sender wrote only a subject.)";
    }
    // Name the RULE, not the sender. A message blocked by domain and one blocked by address look
    // identical in the list, and "why is this in spam" has a different answer and a different undo.
    var blk=m.block_addr||m.from_addr, byDom=String(blk).charAt(0)==="@";
    pane.innerHTML=(m.spam?("<div class='lxm-spambar'><div class='lxm-spambar-t'>In <b>Spam</b> because <b>"
        +esc(blk)+"</b> is blocked \\u2014 everything from "+(byDom?"this domain":"this address")+" lands here.</div>"
        +"<button class='adm-btn ghost' type='button' data-act='unspam'>Not spam</button></div>"):"")
      +"<div class='lxm-read-head'>"
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
            +(x.err?" · <b>failed</b>":lxmStatus(x.status))+"</div><div class='lxm-sent-b'></div></div>"; }).join("");
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
      +"<button class='adm-btn ghost' type='button' data-act='arch'>"+(m.archived?"Move to inbox":"Archive")+"</button>"
      +"<button class='adm-btn ghost' type='button' data-act='"+(m.spam?"unspam":"spam")+"'>"+(m.spam?"Not spam":"Mark as spam")+"</button>"
      // Offered beside it rather than instead of it, with the host spelled out, because the choice
      // between "this sender" and "everyone at this host" is the user's and the two are not close.
      +(m.spam?"":"<button class='adm-btn ghost' type='button' data-act='spamdom'>Block "+esc(dom(m.from_addr))+"</button>")
      +"<button class='adm-btn ghost lxm-del' type='button' data-act='del'>Delete</button>";
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
    note.textContent="This is a copy. The original was delivered to your mailbox as usual — archiving, spam and delete here change only this copy.";
    pane.appendChild(note);

    function done(){ SEL=null; pane.innerHTML="<div class='lxadm-empty'>Select a message to read it.</div>"; load(); }
    function fail(b,msg){ var n=document.createElement("div"); n.className="lxm-note"; n.style.color="#dc4a4a";
      n.textContent=msg; acts.parentNode.insertBefore(n,acts.nextSibling); if(b){b.disabled=false;} }

    function doAct(act,b){
      // DELETE IS THE ONE THING THAT CANNOT BE UNDONE, so it takes two clicks rather than a confirm()
      // dialog: the button says what the second click will do, in place, where the message it will
      // destroy is still on screen.
      if(act==="del"){
        if(!b.classList.contains("arm")){
          b.classList.add("arm"); b.textContent="Delete permanently?";
          setTimeout(function(){ if(b&&b.classList){ b.classList.remove("arm"); b.textContent="Delete"; } },5000);
          return;
        }
        b.disabled=true; b.textContent="Deleting\\u2026";
        api("",{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({id:m.id})})
          .then(function(r){ if(!r.ok||!r.d||r.d.error){ fail(b,"Not deleted: "+((r.d&&r.d.error)||("HTTP "+r.status))); b.textContent="Delete"; b.classList.remove("arm"); return; }
            done(); });
        return;
      }
      if(act==="spam"||act==="spamdom"||act==="unspam"){
        b.disabled=true;
        api("",{method:"PATCH",headers:{"content-type":"application/json"},
          body:JSON.stringify({id:m.id,spam:act!=="unspam",scope:act==="spamdom"?"domain":"addr"})})
          .then(function(r){ if(!r.ok||!r.d||r.d.error){ fail(b,(r.d&&r.d.error)||("HTTP "+r.status)); return; } done(); });
        return;
      }
      var body2=(act==="unread")?{id:m.id,read:false}:{id:m.id,archived:m.archived?0:1};
      api("",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(body2)}).then(done);
    }

    acts.addEventListener("click",function(e){
      var b=e.target.closest&&e.target.closest("button[data-act]"); if(!b)return;
      doAct(b.getAttribute("data-act"),b);
    });
    // The "Not spam" button in the banner at the top does the same job as the one in the row of
    // actions at the bottom; both go through doAct so there is only one description of what happens.
    var bar=pane.querySelector(".lxm-spambar button[data-act]");
    if(bar) bar.addEventListener("click",function(){ doAct(bar.getAttribute("data-act"),bar); });

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
    // This line is what stops Delete and Spam from being frightening, so it has to stay TRUE. It said
    // replies were sent from your own mail client, which stopped being true when the reply box landed.
    n.textContent="Mail to support@, info@ and raza@lumoscore.com is forwarded to your mailbox exactly as before; this is a copy kept for reference. Marking as spam or deleting here changes only this copy \\u2014 never what was delivered to your mailbox.";
    head.parentNode.insertBefore(n, head.nextSibling); }
  var list=q("#lxmList");
  if(list&&!list.__lx){ list.__lx=1;
    list.addEventListener("change",function(e){
      var c=e.target; if(!c||c.type!=="checkbox"||!c.getAttribute("data-ck"))return;
      var id=c.getAttribute("data-ck");
      if(c.checked)TICK[id]=1; else delete TICK[id];
      var row=c.closest(".lxm-row"); if(row)row.classList.toggle("tick",!!c.checked);
      paintSel();
    });
    list.addEventListener("click",function(e){
      // Only the row's own button opens a message. A click on the checkbox (or its label) must not
      // also open the mail, or ticking twenty rows would open twenty of them on the way through.
      if(e.target.closest&&e.target.closest(".lxm-ck"))return;
      var b=e.target.closest&&e.target.closest(".lxm-rowmain"); if(b)open(b.getAttribute("data-open"));
    });
  }

  var all=q("#lxmAll");
  if(all&&!all.__lx){ all.__lx=1; all.addEventListener("change",function(){
    // Select all means everything CURRENTLY LISTED -- the box you are in, narrowed by the search you
    // typed. Never the whole mailbox: the list is what you can see and check before acting.
    var rows=visible();
    if(all.checked)rows.forEach(function(m){ TICK[m.id]=1; }); else clearSel();
    render();
  }); }

  var bulk=q("#lxmBulk");
  if(bulk&&!bulk.__lx){ bulk.__lx=1; bulk.addEventListener("click",function(e){
    var b=e.target.closest&&e.target.closest("[data-bulk]"); if(!b)return;
    var ids=selIds(); if(!ids.length)return;
    var kind=b.getAttribute("data-bulk");
    if(b.__lbl==null)b.__lbl=b.textContent;
    if(kind==="del"){
      if(!b.classList.contains("arm")){
        b.classList.add("arm"); b.textContent="Delete "+ids.length+" permanently?";
        setTimeout(function(){ if(b&&b.classList){ b.classList.remove("arm"); b.textContent=b.__lbl; } },5000);
        return;
      }
      b.disabled=true; b.textContent="Deleting\\u2026";
      api("",{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({ids:ids})})
        .then(function(r){ b.disabled=false; b.classList.remove("arm"); b.textContent=b.__lbl;
          if(!r.ok||!r.d||r.d.error){ bulkErr(r); return; }
          clearSel(); SEL=null; var p=q("#lxmRead"); if(p)p.innerHTML="<div class='lxadm-empty'>Select a message to read it.</div>"; load(); });
      return;
    }
    // "Spam" blocks each selected message's exact address; "Block domain" blocks the sending host
    // instead, which is the only thing that works on senders that never reuse an address.
    b.disabled=true; b.textContent="Blocking\\u2026";
    api("",{method:"PATCH",headers:{"content-type":"application/json"},
      body:JSON.stringify({ids:ids,spam:true,scope:kind==="spamdom"?"domain":"addr"})})
      .then(function(r){ b.disabled=false; b.textContent=b.__lbl;
        if(!r.ok||!r.d||r.d.error){ bulkErr(r); return; }
        clearSel(); SEL=null; var p=q("#lxmRead"); if(p)p.innerHTML="<div class='lxadm-empty'>Select a message to read it.</div>"; load(); });
  }); }
  var segs=q("#lxmSegs");
  if(segs&&!segs.__lx){ segs.__lx=1; segs.addEventListener("click",function(e){
    var b=e.target.closest&&e.target.closest("[data-box]"); if(!b)return;
    qa("#lxmSegs .seg-chip").forEach(function(c){ c.classList.remove("active"); });
    b.classList.add("active"); BOX=b.getAttribute("data-box"); clearSel();
    // Unread alone can be drawn from what is already in memory. Archived, Spam and ANY search need
    // the server -- and once a search is running even Unread does, because the loaded set is a
    // filtered one, not the whole inbox.
    if(BOX==="unread"&&!Q)render(); else load(); }); }

  // Search asks the server, so it waits for a pause in typing rather than firing per keystroke. 280ms
  // is long enough that a whole word is one query and short enough that it still feels live.
  var qi=q("#lxmQ"), qx=q("#lxmQX");
  if(qi&&!qi.__lx){ qi.__lx=1;
    var run=function(){ var v=(qi.value||"").trim(); if(v===Q)return; Q=v; clearSel(); if(qx)qx.hidden=!Q; load(); };
    qi.addEventListener("input",function(){ if(qx)qx.hidden=!(qi.value||"").trim(); clearTimeout(QT); QT=setTimeout(run,280); });
    // Enter searches at once instead of waiting out the debounce; Escape clears, which is what the
    // key does in every other search field.
    qi.addEventListener("keydown",function(e){
      if(e.key==="Enter"){ e.preventDefault(); clearTimeout(QT); run(); }
      if(e.key==="Escape"){ e.preventDefault(); qi.value=""; clearTimeout(QT); run(); } });
  }
  if(qx&&!qx.__lx){ qx.__lx=1; qx.addEventListener("click",function(){
    if(qi)qi.value=""; qx.hidden=true; clearTimeout(QT); if(Q){ Q=""; clearSel(); load(); } if(qi)qi.focus(); }); }
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
