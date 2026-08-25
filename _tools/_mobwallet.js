// Mobile wallet page: real data.
//
// _walletdata.js gated on #assetsTable, which only the DESKTOP wallet has, so the whole layer was
// absent on mobile and every figure on the page was the design's mock — including an Ethereum 0x…
// address presented as the user's Stellar account, a portfolio denominated in APT, three invented open
// orders and a fabricated activity feed. That gate now accepts the mobile page too, so the fetching and
// pricing run there; this transform renders the result into the mobile markup, which shares no class
// names with desktop and so cannot be reached by the aliasing trick used on the trade pane.
//
// Everything comes from the globals that layer publishes — __lxNative / __lxHoldings / __lxTotalXLM /
// __lxXlmUsd / __lxOffers / __lxOps — so the two layouts can never disagree about a balance.
//
// Usage: node _tools/_mobwallet.js [--write]
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const STYLE = '<style id="lx-mobwallet-css">'
// #18: the three controls sat hard against the right edge, as far from the asset they act on as the
// row allows. Left-aligned, they read as belonging to the row above them.
+ '.lxmw-astacts{justify-content:flex-start!important}'
  // The dots go to the end of the row; Trade and Send keep their own spacing.
  + '.lxmw-astacts .lxmw-astbtn.icon{margin-left:auto!important}'
  // #38: pinned rows say so. Star and colour match the desktop badge exactly.
  + '.lxmw-pinbadge{display:inline-flex;vertical-align:middle;margin-left:6px;color:#f5b301}'
  + '.lxmw-pinbadge svg{width:13px;height:13px;display:block}'
  + '.lxmw-row.lxmw-pinned{box-shadow:inset 3px 0 0 var(--accent,#ea6a2c)}'
+ '.lxmw-astbtn.icon{display:inline-flex;align-items:center;justify-content:center;text-decoration:none}'
  // Hide the mock until real data lands, so no one ever sees a foreign address or an invented order.
  + 'body:not(.lxmw-ready) .orders-stack,body:not(.lxmw-ready) .activity-block,body:not(.lxmw-ready) #assetList{visibility:hidden}'
  // N13: the identicon beside the address is a baked SVG -- a deterministic avatar OF THE MOCK ADDRESS,
  // a grid of orange squares belonging to 0x0a72...3c9d. The address text next to it was already held
  // back by this gate, but the picture of it was not, so the wrong avatar still flashed on every
  // refresh. Same marker, same moment: it appears when there is a real Stellar address to draw it from.
  + 'html:not(.lx-adrdone) .wallet-chip .av>*,html:not(.lx-adrdone) .chip .av>*{visibility:hidden!important}'
  + 'html:not(.lx-adrdone) .wallet-chip .text,html:not(.lx-adrdone) .chip .text{color:transparent!important;position:relative}'
  + 'html:not(.lx-adrdone) .wallet-chip .text::after,html:not(.lx-adrdone) .chip .text::after{content:"";position:absolute;left:0;top:20%;width:100%;height:60%;'
  + 'border-radius:6px;background:linear-gradient(90deg,rgba(128,128,140,.12) 25%,rgba(128,128,140,.2) 37%,rgba(128,128,140,.12) 63%);'
  + 'background-size:400% 100%;animation:lxPvSk 1.3s ease infinite}'
  // The unit and the delta were left out of this list, so "APT" and "+3,114.20 APT" painted for a frame
  // on a Stellar wallet -- see the note in the transform above this block.
  + 'html:not(.lx-pvdone) .unit,html:not(.lx-pvdone) .delta-secondary{visibility:hidden!important}'
  + 'html:not(.lx-pvdone) .portfolio-value,html:not(.lx-pvdone) .portfolio-sub,html:not(.lx-pvdone) .portfolio-usd{color:transparent!important;position:relative}'
  + 'html:not(.lx-pvdone) .portfolio-value>*,html:not(.lx-pvdone) .portfolio-sub>*,html:not(.lx-pvdone) .portfolio-usd>*{visibility:hidden}'
  + 'html:not(.lx-pvdone) .portfolio-value::after,html:not(.lx-pvdone) .portfolio-sub::after,html:not(.lx-pvdone) .portfolio-usd::after{content:"";position:absolute;left:0;top:14%;width:min(62%,190px);height:72%;'
  + 'border-radius:8px;background:linear-gradient(90deg,rgba(255,255,255,.05) 25%,rgba(255,255,255,.11) 37%,rgba(255,255,255,.05) 63%);'
  + 'background-size:400% 100%;animation:lxPvSk 1.3s ease infinite}'
  + '@keyframes lxPvSk{0%{background-position:100% 50%}100%{background-position:0 50%}}'
  + '@media(prefers-reduced-motion:reduce){html:not(.lx-pvdone) .portfolio-value::after,html:not(.lx-pvdone) .portfolio-sub::after{animation:none}}'
  + '.orders-stack .lxmw-row{align-items:center;gap:10px}'
  + '.lxmw-omain{flex:1 1 auto;min-width:0}'
  // width:auto is not redundant. The container's own stylesheet carries .order-cancel{width:100%} for the
  // DESKTOP list, where the button sits on its own line -- and reusing that class to share the cancel
  // handler brought the width along with it, so the button ate the whole row and pushed the order text
  // to zero. Scoped to .orders-stack so the desktop rule is untouched.
  + '.orders-stack .lxmw-ocx{flex:0 0 auto;width:auto;height:28px;padding:0 11px;border-radius:8px;cursor:pointer;'
  + 'font-weight:800;font-size:11.5px;line-height:1;color:var(--text-soft);background:transparent;'
  + 'border:1px solid var(--border);transition:color .14s ease,border-color .14s ease}'
  + '.orders-stack .lxmw-ocx:hover:not(:disabled){color:#e5484d;border-color:#e5484d}'
  + '.orders-stack .lxmw-ocx:disabled{opacity:.6;cursor:default}'
  // The shared activity renderer emits DESKTOP row markup, and at 375px .activity-info collapsed to
  // ~92px so the 'From G…' line wrapped and spilled out of the card. Let the middle column take the
  // slack and truncate, and stop the amount and the explorer link from being squeezed.
  + '.activity-block .activity-row{align-items:center;gap:10px}'
  + '.activity-block .activity-info{flex:1 1 auto;min-width:0}'
  // .type is itself a flex container, so white-space could never stop it wrapping — it was breaking
  // onto three lines and making every row 93px tall. Keep its children on one line and let the ticker
  // be the thing that truncates.
  + '.activity-block .activity-info .type{display:flex;flex-wrap:nowrap;align-items:center;gap:6px;min-width:0;white-space:nowrap;overflow:hidden}'
  + '.activity-block .activity-info .type>*{flex:0 0 auto}'
  + '.activity-block .activity-amt{min-width:0}'
  + '.activity-block .activity-info .meta{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}'
  + '.activity-block .activity-amt{flex:0 0 auto;text-align:right;white-space:nowrap}'
  + '.activity-block .lx-txlink{flex:0 0 auto;margin-left:8px}'
  // --- hero quick actions ------------------------------------------------------------------------------
  // The design declares FOUR columns for three tiles (Send / Receive / Swap), so the row always ended in an
  // empty fourth cell — that is the dead space on the right, not a margin. Three columns, sharing the full
  // width, and a slightly taller tile so the icons are not marooned in the middle.
  + '.actions-grid{grid-template-columns:repeat(3,1fr)!important;gap:10px!important}'
  + '.actions-grid .action-btn{width:100%;padding:15px 8px}'
  // --- Open Orders / Liquidity Pools -------------------------------------------------------------------
  // Two summary cards stacked as two full-width rows; side by side they read as one line and give the page
  // back ~90px of height. The third card in this stack is display:none, and a hidden grid item takes no
  // cell, so the two visible ones fill the two columns.
  + '.insights-stack{display:grid!important;grid-template-columns:1fr 1fr;gap:10px;align-items:stretch}'
  + '.insights-stack .insight-card{min-width:0}'
  + '.insights-stack .insight-card .body{min-width:0}'
  // At ~166px a card fits a label and a number, not a sentence. Tighten the label so "LIQUIDITY POOLS"
  // fits whole, and drop the descriptive line rather than serve "Across your p…" — a truncated sentence
  // reads as broken, and the title plus the count already say the whole thing.
  + '.insights-stack .insight-card{padding:12px 12px;gap:10px}'
  + '.insights-stack .insight-card .ttl{font-size:9.5px;letter-spacing:.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  + '.insights-stack .insight-card .head{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  + '.insights-stack .insight-card .sub{display:none}'
  + '.insights-stack .insight-card .ic{width:34px;height:34px;flex:0 0 34px}'
  // the chevron is decoration; at half width it competes with the number
  + '.insights-stack .insight-card>svg:last-child,.insights-stack .insight-card .chev{display:none}'
  + '.lxmw-empty{padding:18px 4px;text-align:center;color:var(--text-soft,#8a8fa3);'
  + 'font:600 13px/1.5 "Hanken Grotesk",system-ui,sans-serif}'
  + '.lxmw-row{display:flex;align-items:center;gap:11px;padding:13px 2px;border-bottom:1px solid var(--border)}'
  + '.lxmw-row:last-child{border-bottom:0}'
  + '.lxmw-ico{width:32px;height:32px;border-radius:50%;flex:0 0 auto;background:var(--surface-2,#222) center/cover no-repeat}'
  // Until a logo resolves, show the ticker's first letters on a colour derived from the code — the
  // same idea as the desktop table's data-l fallback. An empty grey disc reads as broken; a letter
  // disc reads as an asset without a logo, which is the truth.
  + '.lxmw-ico[data-l]::after{content:attr(data-l);position:absolute;inset:0;display:flex;'
  + 'align-items:center;justify-content:center;color:#fff;font:800 11px/1 "Hanken Grotesk",system-ui,sans-serif}'
  + '.lxmw-ico{position:relative;overflow:hidden}'
  + '.lxmw-ico.lxmw-hasico::after{display:none}'
  + '.lxmw-nm{font:800 14px/1.2 "Hanken Grotesk",system-ui,sans-serif}'
  // the shared issuer line has to survive a 375px row: it wraps rather than pushing the balance off
  + '.lxmw-ast .lxmw-sub .lx-asb{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap}'
  + '.lxmw-ast .lxmw-sub .lx-vfd{width:13px;height:13px;flex:0 0 13px;border-radius:50%;background:#35c07f;color:#fff;display:inline-flex;align-items:center;justify-content:center}'
  + '.lxmw-ast .lxmw-sub .lx-vfd svg{width:8px;height:8px;display:block}'
  + '.lxmw-ast .lxmw-sub .lx-iss{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;opacity:.85}'
  + '.lxmw-ast .lxmw-sub .lx-hd:empty{display:none}'
  + '.lxmw-ast .lxmw-sub .lx-isscopy{width:20px;height:20px;padding:0;border:0;border-radius:6px;background:transparent;color:inherit;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}'
  + '.lxmw-ast .lxmw-sub .lx-isscopy svg{width:12px;height:12px;display:block}'
  // same red bin as the desktop table's Trustline button. Desktop also reddens the label on hover; a phone
  // has no hover, so :active carries that feedback instead.
  + '.lxmw-astbtn.lx-rmtrust svg{stroke:var(--red,#ea3943)!important}'
  + '.lxmw-astbtn.lx-rmtrust:active{color:var(--red,#ea3943);border-color:rgba(234,57,67,.45)}'
  + '.lxmw-sub{font:600 11.5px/1.3 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-soft,#8a8fa3);margin-top:3px}'
  + '.lxmw-amt{margin-left:auto;text-align:right}'
  + '.lxmw-amt .a{font:800 14px/1.2 "JetBrains Mono",ui-monospace,monospace}'
  + '.lxmw-amt .u{font:600 11.5px/1.3 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-soft,#8a8fa3);margin-top:3px}'
  // --- liquidity pool rows: overlapped pair icon, tappable row, per-row actions -----------------------
  // The row wraps so the actions sit on their own line: at 390px an icon pair + pair name + share figure
  // + three controls on ONE line squeezes the name to nothing.
  + '.lxmw-row.lxmw-lp{flex-wrap:wrap;align-items:center}'
  + '.lxmw-lplink{display:flex;align-items:center;gap:11px;flex:1 1 auto;min-width:0;color:inherit;text-decoration:none}'
  + '.lxmw-lpmeta{min-width:0}'
  + '.lxmw-lp .lxmw-nm,.lxmw-lp .lxmw-sub{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  // 46px box holds two 32px discs overlapping by 18px — the same shape as the desktop pair icon
  + '.lxmw-pair{position:relative;width:46px;height:32px;flex:0 0 auto}'
  + '.lxmw-pair .lxmw-ico{position:absolute;top:0;left:0}'
  + '.lxmw-pair .lxmw-ico:last-child{left:18px;box-shadow:0 0 0 2px var(--surface,#12121a)}'
  + '.lxmw-lpacts{display:flex;gap:8px;flex:1 0 100%;margin-top:11px}'
  + '.lxmw-lpbtn{flex:1;text-align:center;padding:8px 0;border-radius:9px;border:1px solid var(--border);'
  + 'background:var(--surface-2,#1a1a24);color:var(--text);text-decoration:none;'
  + 'font:700 12.5px/1 "Hanken Grotesk",system-ui,sans-serif}'
  + '.lxmw-lpbtn:active{border-color:var(--accent);color:var(--accent)}'
  + '.lxmw-lpbtn.ghost{color:var(--text-soft,#8a8fa3)}'
  // My Assets rows get the same actions the desktop table has (Trade / Send / more). Same button shape as
  // the pool rows so the two tabs read as one list, and the row itself wraps to give them their own line.
  + '.lxmw-row.lxmw-ast{flex-wrap:wrap}'
  // Sized to their labels and pushed to the right, under the amount column. Stretching two words across a
  // third of the screen each (flex:1, the pool-row rule) made them read as banners rather than buttons.
  + '.lxmw-astacts{display:flex;gap:8px;flex:1 0 100%;margin-top:10px;justify-content:flex-end}'
  + '.lxmw-astbtn{display:inline-flex;align-items:center;justify-content:center;gap:6px;flex:0 0 auto;'
  + 'padding:7px 13px;border-radius:9px;border:1px solid var(--border);background:var(--surface-2,#1a1a24);'
  + 'color:var(--text);text-decoration:none;font:700 12.5px/1 "Hanken Grotesk",system-ui,sans-serif;cursor:pointer}'
  + '.lxmw-astbtn svg{width:12px;height:12px;flex:0 0 auto}'
  + '.lxmw-astbtn:active{border-color:var(--accent);color:var(--accent)}'
  + '.lxmw-astbtn.icon{width:36px;padding:0;color:var(--text-soft,#8a8fa3)}'
  + '.lxmw-astmenu{position:fixed;z-index:100003;min-width:214px;background:var(--surface,#171922);border:1px solid var(--border);border-radius:12px;padding:6px;box-shadow:0 14px 44px rgba(0,0,0,.55)}'
  + '.lxmw-astmenu button,.lxmw-astmenu a{display:block;width:100%;padding:10px 11px;border:0;border-radius:9px;background:transparent;color:var(--text);text-align:left;text-decoration:none;font:700 13px/1.25 "Hanken Grotesk",system-ui,sans-serif}'
  + '.lxmw-astmenu button:active,.lxmw-astmenu a:active{background:rgba(234,106,44,.12);color:var(--accent)}'
  + '.lxmw-astmenu .danger{color:var(--red,#ea3943)}'
  // icon-only copy: fixed width so it never steals room from the three labelled actions
  + '.lxmw-lpbtn.icon{flex:0 0 42px;padding:0;display:inline-flex;align-items:center;justify-content:center;'
  + 'color:var(--text-soft,#8a8fa3);cursor:pointer}'
  + '</style>';

const SCRIPT = '<script id="lx-mobwallet">(function(){'
+ 'if(window.__lxMobWallet)return;window.__lxMobWallet=1;'
+ 'var DASH="\\u2014";'
+ 'function q(s,r){return (r||document).querySelector(s);}'
+ 'function qa(s,r){return [].slice.call((r||document).querySelectorAll(s));}'
+ 'function n(v){return (typeof v==="number"&&isFinite(v))?v:null;}'
+ 'function esc(t){return String(t==null?"":t).replace(/[&<>"]/g,function(c){return c==="&"?"&amp;":c==="<"?"&lt;":c===">"?"&gt;":"&quot;";});}'
+ 'function fmt(v,d){if(v==null||!isFinite(+v))return DASH;var x=Math.abs(+v);'
+ 'return (+v).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:(d!=null?d:(x>=1000?2:(x>=1?4:7)))});}'
+ 'function usd(v){return v==null?DASH:"$"+(+v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});}'
+ 'function addr(){try{return localStorage.getItem("lumos.address")||"";}catch(_){return "";}}'
+ 'function trunc(a){a=String(a||"");return a.length>12?a.slice(0,6)+"\\u2026"+a.slice(-4):a;}'
+ 'function rate(){return n(window.__lxXlmUsd);}'
+ 'var HZ="https://horizon.stellar.org";'
// The wallet layer already resolved every logo it knows about; reuse that map rather than a second
// source of truth. XLM has its own published URI.
+ 'function logoFor(code,native){if(native||code==="XLM")return window.__lxStellarUri||"";'
+ 'return (window.__lxLogos||{})[code]||"";}'
// __lxHoldings carries balances but no valuation; __lxRows carries balance x price in XLM. Match on
// code+issuer so two assets sharing a ticker cannot be confused for one another.
+ 'function valueXlm(code,iss,native){var rows=window.__lxRows;if(!rows)return null;'
+ 'for(var i=0;i<rows.length;i++){var b=rows[i]&&rows[i].b;if(!b)continue;'
+ 'var nat=b.asset_type==="native";'
+ 'if(native||code==="XLM"){if(nat)return n(rows[i].xlm);continue;}'
+ 'if(b.asset_code===code&&(!iss||b.asset_issuer===iss))return n(rows[i].xlm);}'
+ 'return null;}'
// __lxLogos is a short curated map (9 entries), so every other asset fell through to a blank disc.
// The asset pages already resolve arbitrary logos from stellar.expert; do the same here, cache the
// answer in localStorage so a repeat visit is instant, and cap concurrency so 30-odd holdings do not
// arrive as one burst. A miss is remembered too — re-asking on every visit for an asset that has no
// TOML image would be pure waste.
+ 'var LOGOQ=[],LOGOBUSY=0,LOGOMEM={},LOGOPAUSE=0,LOGOFAILS=0;'
+ 'function lkey(code,iss){return "lumos.alogo2."+code+"-"+(iss||"");}'
+ 'function cachedLogo(code,iss){var k=lkey(code,iss);if(LOGOMEM[k]!==undefined)return LOGOMEM[k];'
+ 'try{var raw=localStorage.getItem(k);if(raw){var o=JSON.parse(raw);'
+ 'if(o&&(Date.now()-o.ts)<2592e6){LOGOMEM[k]=o.v||"";return LOGOMEM[k];}}}catch(_){}return undefined;}'
+ 'function storeLogo(code,iss,v){var k=lkey(code,iss);LOGOMEM[k]=v||"";'
+ 'try{localStorage.setItem(k,JSON.stringify({v:v||"",ts:Date.now()}));}catch(_){}}'
+ 'function pumpLogos(){if(Date.now()<LOGOPAUSE)return;while(LOGOBUSY<1&&LOGOQ.length){(function(job){LOGOBUSY++;'
+ 'fetch("https://api.stellar.expert/explorer/public/asset?search="+encodeURIComponent(job.code)+"&limit=20")'
+ '.then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(d){'
+ 'var recs=(d&&d._embedded&&d._embedded.records)||[];'
+ 'var want=job.code+"-"+job.iss;'
+ 'var m=recs.filter(function(x){return String(x.asset||"").indexOf(want)===0;})[0];'
+ 'var t=(m&&(m.tomlInfo||m.toml_info))||{};LOGOFAILS=0;storeLogo(job.code,job.iss,t.image||"");},'
+ 'function(){try{delete LOGOMEM[lkey(job.code,job.iss)+"|q"];}catch(_){}'
+ 'LOGOFAILS++;LOGOPAUSE=Date.now()+(LOGOFAILS>3?6e5:3e4);})'
+ '.then(function(){LOGOBUSY--;setTimeout(pumpLogos,120);setTimeout(pass,0);});})(LOGOQ.shift());}}'
+ 'function resolveLogo(code,iss,native){'
+ 'var known=logoFor(code,native);if(known)return known;'
+ 'if(native||!iss)return "";'
+ 'var c=cachedLogo(code,iss);if(c!==undefined)return c;'
+ 'return "";}'
+ 'function wantLogo(code,iss){var k=lkey(code,iss);if(LOGOMEM[k+"|q"])return;'
+ 'LOGOMEM[k+"|q"]=1;LOGOQ.push({code:code,iss:iss});pumpLogos();}'
+ 'function seeRows(){if(!("IntersectionObserver" in window))return;'
+ 'var io=window.__lxmwIO;if(!io){io=window.__lxmwIO=new IntersectionObserver(function(es){'
+ 'es.forEach(function(e){if(!e.isIntersecting)return;var el=e.target;'
+ 'var c=el.getAttribute("data-c"),i=el.getAttribute("data-i");'
+ 'if(c&&i)wantLogo(c,i);io.unobserve(el);});},{rootMargin:"300px 0px"});}'
+ 'qa("#assetList .lxmw-ico[data-c]").forEach(function(el){if(el.__lxmwObs)return;el.__lxmwObs=1;io.observe(el);});}'
+ 'function _unusedResolveTail(){'
+ 'return "";}'
+ 'function initials(code){return String(code||"?").replace(/[^A-Za-z0-9]/g,"").slice(0,2).toUpperCase();}'
+ 'function hueOf(code){var h=0,c=String(code||"");for(var i=0;i<c.length;i++)h=(h*31+c.charCodeAt(i))%360;return h;}'

+ 'function activeTab(){var b=qa(".asset-tabs:not(.lx-wcgroup) button");for(var i=0;i<b.length;i++)if(b[i].classList.contains("active"))return i;return 0;}'

// ---- header: address + portfolio -----------------------------------------------------------------
// AUDIT (funds): the design baked an Ethereum address into both the visible chip and its copy button.
// On a Stellar wallet page that is not a cosmetic problem — someone could paste it as a destination.
+ 'function fixHeader(){var a=addr();'
+ 'var t=q(".wallet-chip .text")||q(".chip .text")||q(".wallet-address .text");'
+ 'if(t)t.textContent=a?trunc(a):DASH;'
+ 'try{ if(a&&/^G[A-Z2-7]{55}$/.test(a))document.documentElement.classList.add("lx-adrdone"); }catch(_){}'
// #12: the second icon in the address chip is a bare <button> -- no class, no aria-label, no href and
// no handler. It draws an external-link glyph and does nothing when tapped. Wire it to the account on
// stellar.expert, which is what the same icon does everywhere else on the site.
// Identified by elimination rather than by position: the copy control is the one carrying data-copy or
// a copy class, so whatever else is in the chip is the link.
+ 'var _chip=q(".wallet-chip")||q(".chip");'
+ 'if(_chip&&a){[].slice.call(_chip.parentNode?_chip.parentNode.querySelectorAll(".wallet-chip button,.chip button"):[]).forEach(function(b){'
+ 'if(b.hasAttribute("data-copy")||/copy/i.test(b.className||""))return;'
+ 'b.setAttribute("aria-label","View this account on stellar.expert");'
+ 'b.setAttribute("title","View on Explorer");'
+ 'if(b.__lxexp)return; b.__lxexp=1;'
+ 'b.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();'
+ 'try{window.open("https://stellar.expert/explorer/public/account/"+encodeURIComponent(a),"_blank","noopener");}catch(_){}'
+ '});});}'
+ 'qa(".copy-addr-btn,[data-copy]").forEach(function(b){var v=b.getAttribute("data-copy")||"";'
+ 'if(/^0x[0-9a-fA-F]{8,}$/.test(v)||(a&&b.className.indexOf("copy-addr")>=0))b.setAttribute("data-copy",a||"");});'
// portfolio total, in XLM with a USD line — the mock said "31,108.45 APT"
+ 'var pv=q(".portfolio-value");'
+ 'if(pv){var tot=n(window.__lxTotalXLM),u=rate();'
+ 'var sub=q(".portfolio-sub")||q(".portfolio-usd");'

+ 'if(tot!=null){pv.innerHTML=esc(fmt(tot,2))+\'<span class="unit">XLM</span>\';'
+ 'try{document.documentElement.classList.add("lx-pvdone");}catch(_){}'
// Four closers, not three: if(sub&&u), if(tot!=null), if(pv), and fixHeader itself. The old tail carried
// the same count across two lines; collapsing them lost one and the whole script stopped parsing.
+ 'if(sub&&u){sub.textContent=usd(tot*u);}}}}'
// ---- open orders ----------------------------------------------------------------------------------
+ 'function fixOrders(){var stack=q(".orders-stack");if(!stack)return;'
+ 'var offs=window.__lxOffers;if(!offs)return;'
+ 'var cnt=q("#ordersCount");if(cnt)cnt.textContent=offs.length+" active";'
+ 'var cancelAll=q("#cancelAllBtn");if(cancelAll)cancelAll.style.display=offs.length?"":"none";'
+ 'if(!offs.length){stack.innerHTML=\'<div class="lxmw-empty">No open orders</div>\';return;}'
+ 'var sig=offs.map(function(o){return o.id;}).join(",");'
+ 'if(stack.getAttribute("data-lxmw")===sig)return;stack.setAttribute("data-lxmw",sig);'
+ 'var html="";'
+ 'offs.forEach(function(o){'
+ 'var s=o.selling||{},b=o.buying||{};'
+ 'var sc=s.asset_type==="native"?"XLM":(s.asset_code||"?");'
+ 'var bc=b.asset_type==="native"?"XLM":(b.asset_code||"?");'
+ 'var amt=+o.amount||0,pr=+o.price||0;'
+ 'html+=\'<div class="lxmw-row" data-oid="\'+esc(o.id)+\'" data-price="\'+esc(o.price)+\'"\''
+ '+\' data-snt="\'+(s.asset_type==="native"?"1":"")+\'" data-sc="\'+esc(s.asset_code||"")+\'" data-si="\'+esc(s.asset_issuer||"")+\'"\''
+ '+\' data-bnt="\'+(b.asset_type==="native"?"1":"")+\'" data-bc="\'+esc(b.asset_code||"")+\'" data-bi="\'+esc(b.asset_issuer||"")+\'">\''
+ '+\'<div class="lxmw-omain"><div class="lxmw-nm">Sell \'+esc(sc)+\' \\u2192 \'+esc(bc)+\'</div>\''
+ '+\'<div class="lxmw-sub">Price \'+esc(fmt(pr,7))+\' \'+esc(bc)+\' per \'+esc(sc)+\'</div></div>\''
+ '+\'<div class="lxmw-amt"><div class="a">\'+esc(fmt(amt))+\' \'+esc(sc)+\'</div>\''
+ '+\'<div class="u">\'+esc(fmt(amt*pr))+\' \'+esc(bc)+\'</div></div>\''
+ '+\'<button type="button" class="order-cancel lxmw-ocx">Cancel</button></div>\';});'
+ 'stack.innerHTML=html;}'
// ---- my assets -------------------------------------------------------------------------------------
+ 'function fixAssets(){var list=q("#assetList");if(!list||activeTab()!==0)return;'
+ 'var hold=window.__lxHoldings;if(!hold||!hold.length)return;'
+ 'if(window.__lxRows&&window.__lxRows.length){var seen={};var pr=[];'
+ 'window.__lxRows.forEach(function(r){var b=r&&r.b;if(!b)return;var nat=b.asset_type==="native";'
+ 'var c=nat?"XLM":b.asset_code,i=nat?"":(b.asset_issuer||"");if(seen[c+i])return;seen[c+i]=1;'
+ 'pr.push({code:c,iss:i,bal:+b.balance,native:nat});});'
+ 'hold.forEach(function(h){if(h.native&&!seen["XLM"]){seen["XLM"]=1;pr.unshift(h);}});'
+ 'if(pr.length)hold=pr;}'
+ 'var PIN=(function(){try{var p=JSON.parse(localStorage.getItem("lumos.pinned")||"[]");return Array.isArray(p)?p:[];}catch(_){return [];}})();'
// Stable: only the pinned move, and only ahead of the rest. Sorting by index keeps a pinned XLM above a
// pinned USDC in the order they were pinned, which is what the desktop list does.
+ 'if(PIN.length){hold=hold.slice().sort(function(a,b){'
+ 'var ia=PIN.indexOf(a.code||(a.native?"XLM":"")),ib=PIN.indexOf(b.code||(b.native?"XLM":""));'
+ 'if(ia<0&&ib<0)return 0; if(ia<0)return 1; if(ib<0)return -1; return ia-ib;});}'
+ 'var u=rate();'
+ 'var sig="a|"+PIN.join(",")+"|"+(window.__lxRows?"v":"n")+"|"+hold.map(function(h){'
+ 'return (h.code||"")+":"+(h.bal||h.balance||0)+":"+(resolveLogo(h.code,h.iss,h.native)?1:0);}).join("|");'
+ 'if(list.getAttribute("data-lxmw")===sig)return;list.setAttribute("data-lxmw",sig);'
+ 'var html="";'
+ 'hold.forEach(function(h){'
+ 'var code=h.code||(h.native?"XLM":"?");'
+ 'var bal=+(h.bal!=null?h.bal:(h.balance!=null?h.balance:0));'
+ 'var xlm=valueXlm(code,h.iss,h.native);if(xlm==null&&h.native)xlm=bal;'
// Only XLM has a price we hold here. For issued assets the wallet layer does not publish a per-asset
  // value, so the USD line stays blank rather than inventing one.
+ 'var v=(xlm!=null&&u)?xlm*u:null;'
+ 'var ico=h.logo||h.ico||resolveLogo(code,h.iss,h.native);'
+ 'html+=\'<div class="lxmw-row lxmw-ast\'+(PIN.indexOf(code)>=0?" lxmw-pinned":"")+\'"><div class="lxmw-ico\'+(ico?" lxmw-hasico":"")+\'" data-lxc="\'+esc(code)+\'" data-c="\'+esc(code)+\'" data-i="\'+esc(h.iss||"")+\'" data-l="\'+esc(initials(code))+\'" style="\'+(ico?(\'background-image:url(\\\'\'+esc(ico)+\'\\\')\'):(\'background-color:hsl(\'+hueOf(code)+\',52%,38%)\'))+\'"></div>\''
+ '+\'<div><div class="lxmw-nm">\'+esc(code)+(PIN.indexOf(code)>=0?\'<span class="lxmw-pinbadge" title="Pinned"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path></svg></span>\':"")+\'</div>\''
+ '+\'<div class="lxmw-sub">\'+((window.__lxIssLine)?window.__lxIssLine(code,h.iss||"",!!h.native):esc(h.name||h.domain||""))+\'</div></div>\''
+ '+\'<div class="lxmw-amt"><div class="a">\'+esc(fmt(bal))+\'</div>\''
+ '+\'<div class="u">\'+(v==null?"":esc(usd(v)))+\'</div></div>\''
// Same three controls as the desktop table, same marks: the nav's candlestick for Trade, the paper plane
// for Send, the vertical dots for the overflow. Trade is a BUTTON now, because it opens the DEX/Swap
// chooser rather than navigating straight off — wireAstActs drives it from touchend as well as click, since
// a phone does not reliably synthesise the click an anchor would have got for free.
// data-lxnonav keeps the global label-based nav bridge off a control reading "Trade".
+ '+\'<div class="lxmw-astacts" data-lxnonav>\''
+ '+\'<button type="button" class="lxmw-astbtn" data-asttrade="\'+esc(code)+\'" data-astiss="\'+esc(h.iss||"")+\'" data-astnat="\'+(h.native?"1":"")+\'">\''
+ '+\'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"></path><path d="M8 6v3"></path><rect x="6" y="9" width="4" height="6" rx="1"></rect><path d="M8 15v3"></path><path d="M16 4v2"></path><rect x="14" y="6" width="4" height="9" rx="1"></rect><path d="M16 15v3"></path></svg>Trade</button>\''
// zero balance -> the desktop table's Send/Trustline swap, mirrored here
+ '+((!h.native&&!(+bal>0))?'
+ '(\'<button type="button" class="lxmw-astbtn lx-rmtrust" data-astrm="1" data-rmc="\'+esc(code)+\'" data-rmi="\'+esc(h.iss||"")+\'">\''
+ '+\'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>Trustline</button>\')'
+ ':(\'<button type="button" class="lxmw-astbtn" data-astsend="\'+esc(code)+\'" data-astiss="\'+esc(h.iss||"")+\'">\''
+ '+\'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>Send</button>\'))'
// #17/#18: the overflow menu is gone; this is a direct Explorer link.
//
// The menu held two items. One was "Copy issuer address", which duplicated the copy control already
// sitting beside the issuer on the same row; with that dropped the menu had a single item left, and a
// menu with one item is two taps to do what a button does in one. data-lxnonav keeps the page's
// label-based nav bridge from claiming the click.
+ '+\'<button type="button" class="lxmw-astbtn icon" data-lxnonav data-astmenu="\'+esc(code)+\'" data-astmi="\'+esc(h.iss||"")+\'" aria-label="More" title="More">\''
+ '+\'<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="5" r="1.9"></circle><circle cx="12" cy="12" r="1.9"></circle><circle cx="12" cy="19" r="1.9"></circle></svg></button>\''
+ '+\'</div></div>\';});'
+ 'list.innerHTML=html;try{window.__lxFillHd&&window.__lxFillHd(list);}catch(_){}}'
// ---- liquidity pools -------------------------------------------------------------------------------
// The mobile page has ONE list container shared by both tabs and no pool panel of its own, so pool
// rows render into #assetList when the Liq Pools tab is selected. __lxLps gives the share balances;
// the pair and the reserves behind them need the pool itself, fetched once each and cached.
+ 'var POOLS={};'
+ 'function poolDetail(id,cb){if(POOLS[id]!==undefined){cb(POOLS[id]);return;}POOLS[id]=null;'
+ 'fetch(HZ+"/liquidity_pools/"+id).then(function(r){return r.ok?r.json():null;}).then(function(d){POOLS[id]=d||false;cb(POOLS[id]);})'
+ '.catch(function(){POOLS[id]=false;cb(false);});}'
+ 'function resCode(rv){var a=(rv&&rv.asset)||"";return a==="native"?"XLM":String(a).split(":")[0];}'
// The pool rows shipped with an EMPTY .lxmw-ico — no logo, no letter, so every position showed the same
// orange disc. The Assets tab two functions up already resolves a real logo per asset; a pool just needs
// it twice, overlapped, the way the desktop pair icon looks.
+ 'function resIss(rv){var p=String((rv&&rv.asset)||"").split(":");return p.length>1?p[1]:"";}'
+ 'function resNative(rv){return ((rv&&rv.asset)||"")==="native";}'
+ 'function lpIco(code,iss,native){var u=resolveLogo(code,iss,native);'
+ 'return \'<div class="lxmw-ico\'+(u?" lxmw-hasico":"")+\'" data-lxc="\'+esc(code)+\'" data-c="\'+esc(code)+\'" data-i="\'+esc(iss||"")+\'" data-l="\'+esc(initials(code))+\'" style="\'+(u?(\'background-image:url(\\\'\'+esc(u)+\'\\\')\'):(\'background-color:hsl(\'+hueOf(code)+\',52%,38%)\'))+\'"></div>\';}'
+ 'function fixPools(){var list=q("#assetList");if(!list||activeTab()!==1)return;'
+ 'var lps=window.__lxLps;if(!lps)return;'
+ 'var cnts=qa(".asset-tabs:not(.lx-wcgroup) button .cnt");if(cnts[1])cnts[1].textContent=lps.length;'
+ 'if(!lps.length){if(list.getAttribute("data-lxmw")!=="p|0"){list.setAttribute("data-lxmw","p|0");'
+ 'list.innerHTML=\'<div class="lxmw-empty">No liquidity positions</div>\';}return;}'
+ 'var ready=lps.every(function(b){return POOLS[b.liquidity_pool_id]!==undefined;});'
+ 'if(!ready){lps.forEach(function(b){poolDetail(b.liquidity_pool_id,function(){});});}'
+ 'var sig="p|"+lps.map(function(b){return b.liquidity_pool_id+":"+b.balance+":"+(POOLS[b.liquidity_pool_id]?1:0);}).join("|");'
+ 'if(list.getAttribute("data-lxmw")===sig)return;list.setAttribute("data-lxmw",sig);'
+ 'var html="";'
+ 'lps.forEach(function(b){var d=POOLS[b.liquidity_pool_id];var shares=+b.balance||0;'
+ 'var pair="Pool "+String(b.liquidity_pool_id).slice(0,6)+"\\u2026",sub="loading\\u2026",amt="",icos="";'
+ 'var href="/pools/stellar/id/"+b.liquidity_pool_id;'
+ 'if(d){var rv=(d.reserves||[]);var c0=resCode(rv[0]),c1=resCode(rv[1]);'
+ 'icos=lpIco(c0,resIss(rv[0]),resNative(rv[0]))+lpIco(c1,resIss(rv[1]),resNative(rv[1]));'
+ 'pair=c0+" / "+c1;'
+ 'var tot=+d.total_shares||0;var frac=tot>0?(shares/tot):0;'
+ 'if(frac>0&&rv.length>1)sub=fmt((+rv[0].amount||0)*frac)+" "+c0+" + "+fmt((+rv[1].amount||0)*frac)+" "+c1;'
+ 'else sub=(tot>0?((frac*100).toFixed(4)+"% of pool"):"");'
+ 'amt=(frac*100).toFixed(4)+"%";}'
+ 'else if(d===false){sub="pool unavailable";}'
// The row was a plain <div>, so there was nothing to tap — the desktop table navigates on the pair cell
// and offers Add/Remove per row, and the phone had neither. Anchors rather than buttons on purpose: the
// tap bridge already turns a tap into a click on a[href], so these need no JS of their own, and Remove
// carries ?act=withdraw so the pool page opens on the Withdraw tab.
+ 'html+=\'<div class="lxmw-row lxmw-lp">\''
+ '+\'<a class="lxmw-lplink" href="\'+esc(href)+\'">\''
+ '+\'<div class="lxmw-pair">\'+(icos||\'<div class="lxmw-ico"></div>\')+\'</div>\''
+ '+\'<div class="lxmw-lpmeta"><div class="lxmw-nm">\'+esc(pair)+\'</div>\''
+ '+\'<div class="lxmw-sub">\'+esc(sub)+\'</div></div></a>\''
+ '+\'<div class="lxmw-amt"><div class="a">\'+esc(fmt(shares))+\'</div><div class="u">shares \'+esc(amt)+\'</div></div>\''
+ '+\'<div class="lxmw-lpacts">\''
+ '+\'<a class="lxmw-lpbtn" href="\'+esc(href)+\'">Add</a>\''
+ '+\'<a class="lxmw-lpbtn" href="\'+esc(href)+\'?act=withdraw">Remove</a>\''
+ '+\'<a class="lxmw-lpbtn ghost" href="\'+esc(href)+\'">Details</a>\''
// The desktop row's ... menu also offers "Copy pool address". Icon-only and fixed-width so the three
// labelled actions keep the rest of the line.
+ '+\'<button type="button" class="lxmw-lpbtn icon" data-lpcopy="\'+esc(b.liquidity_pool_id)+\'" aria-label="Copy pool address" title="Copy pool address">\''
+ '+\'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>\''
+ '+\'</div></div>\';});'
+ 'list.innerHTML=html;}'
// Copy the pool address. Delegated on DOCUMENT and registered once, because fixPools replaces the whole
// list with innerHTML on every data change — a listener bound to the button itself would not survive it.
+ 'function lpCopy(v){try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(v);return true;}}catch(_){}'
+ 'try{var ta=document.createElement("textarea");ta.value=v;ta.setAttribute("readonly","");ta.style.cssText="position:fixed;top:0;left:0;opacity:0";'
+ 'document.body.appendChild(ta);ta.select();ta.setSelectionRange(0,v.length);document.execCommand("copy");document.body.removeChild(ta);return true;}catch(_){return false;}}'
// Send opens the design's own Send dialog the way the design does (class "open"), rather than replaying a
// click on something labelled "Send" — the page carries a label-based nav bridge that would grab that.
// The overflow menu is positioned against the button and closes on the next tap anywhere else.
+ 'function astMenu(btn,code,iss){var old=q(".lxmw-astmenu");if(old)old.remove();'
+ 'var m=document.createElement("div");m.className="lxmw-astmenu";m.setAttribute("data-lxnonav","");'
+ 'var exp=iss?("https://stellar.expert/explorer/public/asset/"+encodeURIComponent(code+"-"+iss)):"https://stellar.expert/explorer/public/asset/XLM";'
+ 'm.innerHTML=\'<a href="\'+esc(exp)+\'" target="_blank" rel="noopener">View on Stellar.Expert</a>\'+(iss?\'<button type="button" data-astcopy>Copy issuer address</button>\':"");'
+ 'document.body.appendChild(m);var r=btn.getBoundingClientRect();'
+ 'm.style.top=Math.max(8,Math.min(r.bottom+6,(window.innerHeight||600)-m.offsetHeight-8))+"px";'
+ 'm.style.left=Math.max(8,Math.min(r.left,(window.innerWidth||360)-m.offsetWidth-8))+"px";'
+ 'function shut(){if(m.parentNode)m.remove();document.removeEventListener("click",away,true);document.removeEventListener("touchend",away,true);}'
+ 'function away(ev){if(m.contains(ev.target))return;shut();}'
+ 'setTimeout(function(){document.addEventListener("click",away,true);document.addEventListener("touchend",away,true);},60);'
+ 'm.addEventListener("click",function(ev){var b=ev.target&&ev.target.closest?ev.target.closest("[data-astcopy]"):null;if(!b)return;'
+ 'ev.preventDefault();try{navigator.clipboard.writeText(iss);}catch(_){}b.textContent="Copied \u2713";setTimeout(shut,700);});}'
// Trade offers the same two destinations the desktop row does: the asset's own DEX page, or the swap
// dialog with the asset already on the pay side (__lxSwapFrom, published by the swap wiring).
+ 'function astTradeMenu(btn,code,iss,nat){var old=q(".lxmw-astmenu");if(old)old.remove();'
+ 'var m=document.createElement("div");m.className="lxmw-astmenu";m.setAttribute("data-lxnonav","");'
+ 'm.innerHTML=\'<button type="button" data-tr="dex">Trade on DEX</button><button type="button" data-tr="swap">Swap</button>\';'
+ 'document.body.appendChild(m);var r=btn.getBoundingClientRect();'
+ 'm.style.top=Math.max(8,Math.min(r.bottom+6,(window.innerHeight||600)-m.offsetHeight-8))+"px";'
+ 'm.style.left=Math.max(8,Math.min(r.left,(window.innerWidth||360)-m.offsetWidth-8))+"px";'
+ 'function shut(){if(m.parentNode)m.remove();document.removeEventListener("click",away,true);document.removeEventListener("touchend",away,true);}'
+ 'function away(ev){if(m.contains(ev.target))return;shut();}'
+ 'setTimeout(function(){document.addEventListener("click",away,true);document.addEventListener("touchend",away,true);},60);'
+ 'function pick(kind){shut();'
+ 'if(kind==="dex"){location.href=nat?"lumoscore-dex.html":("lumoscore-dex-asset.html?asset="+encodeURIComponent(code)+(iss?("-"+iss):""));return;}'
+ 'var sm=document.getElementById("modalSwap");if(sm){sm.classList.add("open");try{document.body.style.overflow="hidden";}catch(_){}}'
+ 'setTimeout(function(){try{if(window.__lxSwapFrom)window.__lxSwapFrom(code,iss);}catch(_){}},60);}'
+ 'function hit(ev){var b=ev.target&&ev.target.closest?ev.target.closest("[data-tr]"):null;if(!b)return;'
+ 'ev.preventDefault();ev.stopPropagation();pick(b.getAttribute("data-tr"));}'
+ 'm.addEventListener("click",hit);m.addEventListener("touchend",hit);}'
// touchend as well as click: these are <button>s, and this page is the one where a tap is not guaranteed to
// become a click. The 12px/600ms guard keeps a scroll that happens to end on a button from firing it.
+ 'function wireAstActs(){if(window.__lxmwAst)return;window.__lxmwAst=1;'
+ 'var _t0=null;'
+ 'document.addEventListener("touchstart",function(e){var p=e.touches&&e.touches[0];_t0=p?{x:p.clientX,y:p.clientY,t:Date.now()}:null;},true);'
+ 'function isTap(e){if(e.type!=="touchend")return true;var p=e.changedTouches&&e.changedTouches[0];if(!p||!_t0)return false;'
+ 'return Math.abs(p.clientX-_t0.x)<12&&Math.abs(p.clientY-_t0.y)<12&&(Date.now()-_t0.t)<600;}'
+ 'function act(e){var t=e.target;if(!t||!t.closest)return;'
+ 'if(e.type==="touchend"&&e.defaultPrevented)return;'
+ 'if(!isTap(e))return;'
+ 'var tr=t.closest("[data-asttrade]");'
+ 'if(tr){e.preventDefault();e.stopPropagation();astTradeMenu(tr,tr.getAttribute("data-asttrade")||"",tr.getAttribute("data-astiss")||"",tr.getAttribute("data-astnat")==="1");return;}'
+ 'var sd=t.closest("[data-astsend]");'
+ 'if(sd){e.preventDefault();e.stopPropagation();var sm=document.getElementById("modalSend");'
+ 'if(sm){sm.classList.add("open");try{document.body.style.overflow="hidden";}catch(_){}}return;}'
+ 'var rm=t.closest("[data-astrm]");'
+ 'if(rm){ if(e.type==="touchend"){ e.preventDefault(); e.stopPropagation(); rm.click(); } return; }'
+ 'var mr=t.closest("[data-astmore]");'
+ 'if(mr){e.preventDefault();e.stopPropagation();astMenu(mr,mr.getAttribute("data-astmore")||"",mr.getAttribute("data-astiss")||"");return;}'
+ '}'
+ 'document.addEventListener("click",act,true);document.addEventListener("touchend",act,true);}'
+ 'function wireLpCopy(){if(window.__lxmwCopy)return;window.__lxmwCopy=1;'
+ 'document.addEventListener("click",function(e){var t=e.target;if(!t||!t.closest)return;'
+ 'var b=t.closest("[data-lpcopy]");if(!b)return;'
+ 'e.preventDefault();e.stopPropagation();'
+ 'var id=b.getAttribute("data-lpcopy")||"";var ok=lpCopy(id);'
+ 'try{if(window.lxToast)window.lxToast(ok?"Pool address copied":"Could not copy");}catch(_){}'
+ '},true);}'
+ 'function wireTabs(){var b=qa(".asset-tabs:not(.lx-wcgroup) button");if(!b.length||window.__lxmwTabs)return;window.__lxmwTabs=1;'
+ 'b.forEach(function(btn){btn.addEventListener("click",function(){setTimeout(pass,30);setTimeout(pass,260);});});}'

// ---- recent activity --------------------------------------------------------------------------------
// Desktop tints .activity-icon by operation type and paints the asset logo over it. The mobile rows
// shipped with no icon element at all, so there was nothing for the logo guard to heal either.
+ 'function actIcon(kind,code,native){'
+ 'var tint={Received:"#10b981",Sent:"#ef4444",Swapped:"#8b5cf6",Trustline:"#64748b",Order:"#ea6a2c",Liquidity:"#06b6d4"}[kind]||"#64748b";'
+ 'var lg=logoFor(code,native);'
+ 'var st="background-color:"+tint+"22;color:"+tint+";";'
+ 'if(lg)st+="background-image:url(\\x27"+lg+"\\x27);background-size:cover;background-position:50% 50%;";'
+ 'return \'<div class="lxmw-ico lxmw-actico" style="\'+st+\'"></div>\';}'
+ 'function fixActivity(){var block=q(".activity-block");if(!block)return;'
// _walletdata.js renders this same block — .activity-block is shared by both layouts — and its version
  // is richer: tinted type icons with the asset logo painted over them, day dividers, explorer links. But
  // it runs after the per-asset pricing, so on a phone the section sat empty for a long time. Ours is a
  // fast first paint that STANDS DOWN the moment the real one lands. .lxp is that renderer own ownership
  // marker (its CSS hides every un-marked node), so it is the honest test — the design mock also uses
  // .activity-row, which is why matching on the tag alone would never render anything.
+ 'if(q(".activity-row .lxp",block)||q(".day-divider.lxp",block))return;'
+ 'var ops=window.__lxOps;if(!ops)return;'
+ 'var sig=ops.length+":"+((ops[0]&&ops[0].id)||"");'
+ 'if(block.getAttribute("data-lxmw")===sig)return;block.setAttribute("data-lxmw",sig);'
+ 'if(!ops.length){block.innerHTML=\'<div class="lxmw-empty">No activity yet</div>\';return;}'
+ 'var me=addr(),html="";'
+ 'ops.slice(0,25).forEach(function(o){'
+ 'var lbl=o.type||"operation",sub="",amt="";'
+ 'var aCode=(o.asset_type==="native"||!o.asset_code)?"XLM":o.asset_code,aNat=(o.asset_type==="native");'
+ 'if(o.type==="payment"){lbl=(o.to===me)?"Received":"Sent";'
+ 'amt=fmt(+o.amount)+" "+(o.asset_type==="native"?"XLM":(o.asset_code||""));'
+ 'sub=(o.to===me)?("from "+trunc(o.from)):("to "+trunc(o.to));}'
+ 'else if(o.type&&o.type.indexOf("path_payment")===0){lbl="Swapped";'
+ 'amt=fmt(+o.amount)+" "+(o.asset_type==="native"?"XLM":(o.asset_code||""));'
+ 'sub="via path payment";}'
+ 'else if(o.type==="change_trust"){lbl="Trustline";sub=(o.asset_code||"")+" "+((+o.limit===0)?"removed":"added");}'
+ 'else if(o.type==="create_account"){lbl="Account created";amt=fmt(+o.starting_balance)+" XLM";}'
+ 'else if(o.type&&o.type.indexOf("manage")===0&&o.type.indexOf("offer")>0){lbl="Order";'
+ 'sub=(+o.amount===0)?"cancelled":"placed";amt=(+o.amount?fmt(+o.amount):"");}'
+ 'else if(o.type&&o.type.indexOf("liquidity_pool")===0){lbl="Liquidity";sub=o.type.replace(/_/g," ");}'
+ 'var when=o.created_at?String(o.created_at).slice(0,10):"";'
+ 'html+=\'<div class="lxmw-row">\'+actIcon(lbl,aCode,aNat)+\'<div><div class="lxmw-nm">\'+esc(lbl)+\'</div>\''
+ '+\'<div class="lxmw-sub">\'+esc(sub||when)+\'</div></div>\''
+ '+\'<div class="lxmw-amt"><div class="a">\'+esc(amt)+\'</div><div class="u">\'+esc(when)+\'</div></div></div>\';});'
+ 'block.innerHTML=html;}'
// ---- run --------------------------------------------------------------------------------------------
+ 'function pass(){try{fixHeader();fixOrders();wireTabs();wireLpCopy();wireAstActs();fixAssets();fixPools();fixActivity();seeRows();'
+ 'if((window.__lxWalletEarly||window.__lxWalletReady)&&!document.body.classList.contains("lxmw-ready"))document.body.classList.add("lxmw-ready");'
+ '}catch(_){}}'
+ 'if(document.readyState!=="loading")pass();else document.addEventListener("DOMContentLoaded",pass);'
+ 'setInterval(pass,900);'

// ---- asset row overflow menu (kebab) ----------------------------------------------------------
+ 'function rmShut(){var m=document.querySelector(".lxmw-astmenu");if(m&&m.parentNode)m.parentNode.removeChild(m);}'
+ 'function rmPinned(){try{var p=JSON.parse(localStorage.getItem("lumos.pinned")||"[]");return Array.isArray(p)?p:[];}catch(_){return [];}}'
+ 'function rmTogglePin(code){var p=rmPinned(),i=p.indexOf(code);'
+ 'if(i>=0)p.splice(i,1); else p.unshift(code);'
+ 'try{localStorage.setItem("lumos.pinned",JSON.stringify(p));}catch(_){}'
+ 'try{var l=document.getElementById("assetList");if(l)l.removeAttribute("data-lxmw");}catch(_){}'
+ 'try{if(window.__lxMWassets)window.__lxMWassets();}catch(_){}}'
+ 'document.addEventListener("click",function(e){'
+ 'var t=e.target&&e.target.closest?e.target.closest("[data-astmenu]"):null;'
+ 'if(!t){ if(!(e.target.closest&&e.target.closest(".lxmw-astmenu")))rmShut(); return; }'
+ 'e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();'
+ 'var open=!!document.querySelector(".lxmw-astmenu"); rmShut(); if(open)return;'
+ 'var code=t.getAttribute("data-astmenu")||"",iss=t.getAttribute("data-astmi")||"";'
+ 'var pinned=rmPinned().indexOf(code)>=0;'
+ 'var m=document.createElement("div");m.className="lxmw-astmenu";'
+ 'm.innerHTML=\'<button type="button" data-rm="view">View asset</button>\''
+ '+\'<button type="button" data-rm="pin"\'+(pinned?\' class="on"\':"")+\'>\'+(pinned?"Unpin":"Pin to top")+\'</button>\''
+ '+(iss?\'<button type="button" data-rm="copy">Copy issuer address</button>\':"")'
+ '+\'<button type="button" data-rm="exp">View on Stellar Explorer</button>\';'
+ 'document.body.appendChild(m);'
+ 'var vw=document.documentElement.clientWidth||window.innerWidth||360;'
+ 'var vh=document.documentElement.clientHeight||window.innerHeight||640;'
+ 'var r=t.getBoundingClientRect(),mw=m.offsetWidth||196,mh=m.offsetHeight||160;'
+ 'var L=Math.max(8,Math.min(r.right-mw,vw-mw-8));'
+ 'var T=(r.bottom+6+mh>vh-8)?Math.max(8,r.top-mh-6):(r.bottom+6);'
+ 'm.style.left=L+"px";m.style.top=T+"px";'
+ 'm.addEventListener("click",function(ev){'
+ 'var b=ev.target&&ev.target.closest?ev.target.closest("[data-rm]"):null; if(!b)return;'
+ 'ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();'
+ 'var k=b.getAttribute("data-rm");'
+ 'if(k==="view"){ rmShut(); location.href="/trade/stellar/"+encodeURIComponent(code+(iss?("-"+iss):"")); return; }'
+ 'if(k==="pin"){ rmShut(); rmTogglePin(code); return; }'
+ 'if(k==="copy"){ try{navigator.clipboard.writeText(iss);}catch(_){} b.textContent="Copied \u2713"; setTimeout(rmShut,700); return; }'
+ 'if(k==="exp"){ rmShut(); window.open(iss?("https://stellar.expert/explorer/public/asset/"+encodeURIComponent(code+"-"+iss)):"https://stellar.expert/explorer/public/asset/XLM","_blank","noopener"); return; }'
+ '},true);'
+ '},true);'
+ '})();</scr'+'ipt>';

let n = 0;
for (const chain of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain', 'stellar', 'xrpl']) {
  for (const dev of ['desktop', 'mobile']) {
    const file = `lumoscore-${chain}-${dev}.html`;
    let data; try { data = read(file); } catch (e) { continue; }
    const { json, s, e } = getContents(data);
    let changed = false;

    for (const k of Object.keys(json)) {
      let h = json[k];
      // mobile wallet only — identified by its own markup, not the filename
      if (h.indexOf('id="assetList"') < 0 || h.indexOf('orders-stack') < 0) continue;
      h = h.replace(/<style id="lx-mobwallet-css">[\s\S]*?<\/style>/g, '')
           .replace(/<script id="lx-mobwallet">[\s\S]*?<\/script>/g, '');
      if (h.indexOf('</head>') >= 0) h = h.replace('</head>', STYLE + '</head>');
      const bi = h.lastIndexOf('</body>'); if (bi < 0) continue;
      json[k] = h.slice(0, bi) + SCRIPT + h.slice(bi);
      changed = true; n++;
    }

    if (changed && process.argv.includes('--write')) {
      const ser = JSON.stringify(json).split('</').join('<' + B + '/');
      fs.writeFileSync(file, data.slice(0, s) + ser + data.slice(e), 'utf8');
    }
  }
}
console.log('mobile wallet renderer: ' + n + ' page keys'
  + (process.argv.includes('--write') ? '' : '  (dry run — pass --write)'));
