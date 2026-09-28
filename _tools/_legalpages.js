// The three pages the footer has always linked to and never had: /privacy, /terms and /support.
//
// Cloned from an already-built page (MCP) rather than authored from scratch, exactly as _blogpage.js
// does and for the same reason: header, sidebar, footer, theme and the nav's own scripts are injected
// into those pages by other transforms, so cloning one inherits a working shell and this file only
// replaces what is inside <main>. Hand-authoring a shell would mean re-deriving all of that and keeping
// it in step for ever.
//
// The copy is written against what the code actually does, not what is comfortable to claim. Verified
// before writing: document.cookie is never assigned anywhere in the built site (so "no cookies" is
// true), _beacon.js posts the connected public address to /lxapi/ev once a session, 22 lumos.* keys are
// kept in browser storage, and the browser contacts ~57 third-party hosts directly. A privacy policy
// that denied collecting anything would be the one document where being caught out costs the most.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const SUPPORT_TO = 'team@lumoscore.com';

// ---- shared shell helpers (same contracts as _blogpage.js) ----------------------------------------
function replaceMain(html, inner) {
  const open = html.indexOf('<main');
  if (open < 0) return null;
  const gt = html.indexOf('>', open);
  const close = html.lastIndexOf('</main>');
  if (gt < 0 || close < 0 || close < gt) return null;
  return html.slice(0, gt + 1) + inner + html.slice(close);
}
function clearNavActive(html) {
  return html.replace(/(<a[^>]*class=")nx-item active(")/g, '$1nx-item$2')
             .replace(/(<a[^>]*class=")nx-item active( [^"]*")/g, '$1nx-item$2');
}
// The donor carries the MCP page's FAQ and its schema. Left in place they would answer MCP questions on
// the privacy page and, worse, publish a second FAQPage block for a URL that is not an FAQ.
function stripFaq(html) {
  let h = html;
  const cut = (open, close) => {
    const i = h.indexOf(open); if (i < 0) return false;
    const j = h.indexOf(close, i); if (j < 0) return false;
    h = h.slice(0, i) + h.slice(j + close.length); return true;
  };
  cut('<section class="lx-faq"', '</section>');
  cut('<script type="application/ld+json" id="lx-faq-ld">', '</scr' + 'ipt>');
  cut('<style id="lx-faq-css">', '</style>');
  return h;
}
function setHead(html, title, desc) {
  let h = html.replace(/<title>[\s\S]*?<\/title>/, '<title>' + title + '</title>');
  h = h.replace(/<meta name="description" content="[^"]*">/,
    '<meta name="description" content="' + desc + '">');
  const hi = h.indexOf('</head>');
  return hi < 0 ? h : h.slice(0, hi) + STYLE + h.slice(hi);
}

const STYLE = '<style id="lx-legal-css">'
  + '.lxlg{max-width:820px;margin:0 auto;padding:34px 24px 72px}'
  + '.lxlg h1{margin:0 0 8px;font-size:34px;font-weight:800;letter-spacing:-.025em;color:var(--text)}'
  + '.lxlg .lxlg-sub{margin:0 0 8px;color:var(--text-muted,#8a8fa3);font-size:15.5px}'
  + '.lxlg .lxlg-upd{margin:0 0 30px;color:var(--text-muted,#8a8fa3);font-size:13px}'
  + '.lxlg h2{margin:30px 0 10px;font-size:19px;font-weight:800;letter-spacing:-.015em;color:var(--text)}'
  + '.lxlg p{margin:0 0 13px;color:var(--text-muted,#8a8fa3);font-size:15.5px;line-height:1.72;max-width:70ch}'
  + '.lxlg p strong,.lxlg li strong{color:var(--text);font-weight:600}'
  + '.lxlg ul{margin:0 0 13px;padding-left:22px;color:var(--text-muted,#8a8fa3);font-size:15.5px;line-height:1.72;max-width:70ch}'
  + '.lxlg li{margin-bottom:7px}'
  // the one line on either page that must not be skimmed past
  + '.lxlg .lxlg-warn{border-left:3px solid var(--accent,#ea6a2c);background:var(--surface-2,#1a1a1f);'
  + 'border-radius:0 10px 10px 0;padding:13px 16px;margin:0 0 16px;color:var(--text);font-size:14.5px}'
  // ---- support page ----
  // Wider than the prose pages: this one is a form plus a sidebar, not a column of text.
  + '.lxlg.lxlg-sup{max-width:1060px}'
  + '.lxsup-grid{display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:22px;align-items:stretch}'
  + '.lxsup-card{background:var(--surface,#131317);border:.8px solid var(--border,#26262c);'
  + 'border-radius:14px;padding:24px 26px;display:flex;flex-direction:column}'
  + '.lxsup-grow{flex:1 1 auto;min-height:0}'
  + '.lxsup-grow textarea{flex:1 1 auto}'
  + '.lxsup-foot{margin-top:auto}'
  + '.lxsup-two{display:grid;grid-template-columns:1fr 1fr;gap:15px}'
  + '.lxsup-row{display:flex;flex-direction:column;gap:6px;margin-bottom:15px}'
  + '.lxsup-two .lxsup-row{margin-bottom:15px}'
  + '.lxsup-row label{font-size:13px;font-weight:700;color:var(--text);letter-spacing:-.005em}'
  + '.lxsup-row .hint{font-size:12px;color:var(--text-muted,#8a8fa3);font-weight:400}'
  + '.lxsup input,.lxsup textarea{width:100%;padding:10px 13px;border-radius:9px;'
  + 'border:1px solid var(--border,#26262c);background:var(--bg,#0a0a0b);color:var(--text);'
  + 'font-family:inherit;font-size:14.5px;line-height:1.5}'
  + '.lxsup input::placeholder,.lxsup textarea::placeholder{color:var(--text-muted,#8a8fa3);opacity:.62}'
  + '.lxsup textarea{min-height:132px;resize:vertical}'
  + '.lxsup input:focus,.lxsup textarea:focus{outline:0;border-color:var(--accent,#ea6a2c);'
  + 'box-shadow:0 0 0 3px rgba(234,106,44,.16)}'
  + '.lxsup input.mono{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:13px}'
  + '.lxsup-foot{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:4px;'
  + 'padding-top:16px;border-top:1px solid var(--border,#26262c)}'
  + '.lxsup-send{padding:11px 26px;border:0;border-radius:9px;cursor:pointer;'
  + 'background:var(--accent,#ea6a2c);color:#fff;font-family:inherit;font-size:14.5px;font-weight:700}'
  + '.lxsup-send:hover:not(:disabled){filter:brightness(1.06)}'
  + '.lxsup-send:disabled{opacity:.55;cursor:default}'
  + '.lxsup-msg{margin:0;font-size:14px;line-height:1.5;display:none;flex:1 1 220px}'
  + '.lxsup-msg.ok{display:block;color:var(--green,#35c07f)}'
  + '.lxsup-msg.err{display:block;color:var(--red,#e5484d)}'
  + '.lxsup-aside{display:flex;flex-direction:column;gap:14px;justify-content:space-between}'
  + '.lxsup-box{background:var(--surface,#131317);border:.8px solid var(--border,#26262c);'
  + 'border-radius:14px;padding:17px 18px}'
  + '.lxsup-box h3{margin:0 0 9px;font-size:13.5px;font-weight:800;color:var(--text);'
  + 'letter-spacing:-.005em}'
  + '.lxsup-box p{margin:0;font-size:13.5px;line-height:1.6;color:var(--text-muted,#8a8fa3)}'
  + '.lxsup-links{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:9px}'
  + '.lxsup-links{gap:13px}'
  + '.lxsup-links a{display:block;text-decoration:none;color:var(--text)}'
  + '.lxsup-links .tag{display:block;font-size:10.5px;font-weight:700;letter-spacing:.075em;'
  + 'text-transform:uppercase;color:var(--text-muted,#8a8fa3);margin-bottom:3px}'
  + '.lxsup-links .ttl{display:block;font-size:13.5px;line-height:1.42;color:var(--text)}'
  + '.lxsup-links a:hover .ttl{color:var(--accent,#ea6a2c)}'
  + '.lxsup-links a:hover .tag{color:var(--accent,#ea6a2c)}'
  + '.lxsup-box.warn{border-color:rgba(229,72,77,.42)}'
  + '.lxsup-box.warn h3{color:var(--red,#e5484d)}'
  + '@media(max-width:900px){.lxsup-grid{grid-template-columns:1fr}'
  + '.lxsup-aside{order:-1}.lxsup-two{grid-template-columns:1fr;gap:0}'
  + '.lxsup-card{display:block}.lxsup-grow textarea{height:auto}}'
  + '@media(max-width:640px){.lxlg{padding:24px 16px 56px}.lxlg h1{font-size:26px}}'

  // ---- Terms and Privacy: a document, not a centred column ----------------------------------------
  //
  // A CONTENTS RAIL beside the prose. Eleven numbered clauses is precisely the shape that earns one:
  // these get referred to by number ("under clause 8"), so the numerals carry real information rather
  // than decorating the page, and the rail is what gives the layout a reason to be full width instead
  // of a column of text floating in the middle.
  //
  // Colours come from the existing tokens, so both themes keep working with no second set to maintain,
  // and the accent is spent in only two places -- links and the clause numerals.
  + '.lxlg-doc{max-width:1460px;padding:40px 40px 90px}'
  + '.lxlg-hd{position:relative;padding-bottom:26px;margin-bottom:34px;'
  + 'border-bottom:1px solid var(--border,#26262c)}'
  // The same warm wash the rest of the site opens with. These three never had one, which is part of
  // why they felt colder than every other page.
  + '.lxlg-hd::before{content:"";position:absolute;left:-80px;right:-80px;top:-90px;height:300px;'
  + 'pointer-events:none;z-index:0;'
  + 'background:radial-gradient(820px 260px at 14% 0%,rgba(234,106,44,.16),transparent 72%)}'
  + '[data-theme="light"] .lxlg-hd::before{background:radial-gradient(820px 260px at 14% 0%,'
  + 'rgba(234,106,44,.10),transparent 72%)}'
  + '.lxlg-hd>*{position:relative;z-index:1}'
  + '.lxlg-doc h1{font-size:clamp(34px,4.2vw,46px);line-height:1.08;margin:0 0 12px;letter-spacing:-.03em;text-wrap:balance}'
  // The sub-line is a statement about the document, so it reads in full-strength text rather than the
  // muted grey that was making it look like chrome.
  + '.lxlg-doc .lxlg-sub{font-size:19px;line-height:1.5;color:var(--text);margin:0 0 14px;max-width:78ch}'
  + '.lxlg-doc .lxlg-upd{font-size:12px;letter-spacing:.07em;text-transform:uppercase;margin:0;color:var(--text-muted,#8a8fa3)}'
  + '.lxlg-body{display:grid;grid-template-columns:292px minmax(0,1fr);gap:64px;align-items:start}'
  + '.lxlg-toc{position:sticky;top:92px;max-height:calc(100vh - 130px);overflow:auto}'
  // Scoped past '.lxlg-doc p', which is (0,1,1) and was overriding this (0,1,0) rule: the rail heading
  // is a <p>, so it was silently rendering at the 17px body size -- a label set larger than the items
  // it labels.
  + '.lxlg-doc .lxlg-toc-h{margin:0 0 16px;font-size:15px;font-weight:700;letter-spacing:.08em;'
  + 'text-transform:uppercase;color:var(--text-muted,#8a8fa3)}'
  // The guide line runs the length of the list; each item paints its own segment of it when active,
  // which is why the line is drawn on the <ol> and the marker on the <a> rather than both on one node.
  + '.lxlg-toc ol{list-style:none;margin:0;padding:0 0 0 16px;display:flex;flex-direction:column;'
  + 'gap:1px;position:relative}'
  + '.lxlg-toc ol::before{content:"";position:absolute;left:0;top:8px;bottom:8px;width:1px;'
  + 'background:var(--border,#26262c)}'
  + '.lxlg-toc li{margin:0}'
  + '.lxlg-toc a{position:relative}'
  + '.lxlg-toc a::before{content:"";position:absolute;left:-16px;top:6px;bottom:6px;width:2px;'
  + 'border-radius:2px;background:transparent;transition:background .2s}'
  // The reading position. Accent on the marker and the numeral, full-strength text on the label -- one
  // idea said three quiet ways rather than a highlighted block.
  + '.lxlg-toc a.is-on::before{background:var(--accent,#ea6a2c)}'
  // Scoped to beat '.lxlg-doc .lxlg-toc a' (0,3,1), which sets the resting muted colour; at (0,2,1)
  // this rule lost and the active clause read exactly like every inactive one.
  + '.lxlg-doc .lxlg-toc a.is-on{color:var(--text);font-weight:600}'
  + '.lxlg-toc a.is-on .lxlg-tn{color:var(--accent,#ea6a2c);opacity:1}'
  + '@media(prefers-reduced-motion:reduce){.lxlg-toc a::before{transition:none}}'
  // Header: the label earns a companion count, so the rail says how long the document is before you
  // start scrolling it.
  + '.lxlg-toc-h{display:flex;align-items:baseline;gap:9px}'
  + '.lxlg-toc-c{font-size:12px;font-weight:600;letter-spacing:.02em;text-transform:none;'
  + 'color:var(--text-muted,#8a8fa3);opacity:.75;font-variant-numeric:tabular-nums}'
  + '.lxlg-toc a{display:flex;gap:13px;padding:9px 12px;border-radius:9px;font-size:17px;'
  + 'line-height:1.5;transition:background .15s,color .15s}'
  + '.lxlg-toc a span{font-variant-numeric:tabular-nums;font-size:14px;opacity:.7;padding-top:1px}'
  // min-width:0 so a long clause name wraps inside the rail instead of widening the track.
  + '.lxlg-toc a{min-width:0}'
  + '.lxlg-art{min-width:0}'
  + '.lxlg-doc h2{font-size:23px;margin:40px 0 14px;letter-spacing:-.02em;scroll-margin-top:96px;'
  + 'display:flex;gap:13px;align-items:baseline}'
  + '.lxlg-doc h2 .lxlg-n{font-size:13px;font-weight:700;color:var(--accent,#ea6a2c);'
  + 'font-variant-numeric:tabular-nums;flex:none}'
  + '.lxlg-doc .lxlg-art>h2:first-child{margin-top:0}'
  // 17px over 15.5px, and 76ch over 70ch. The measure still stops the line getting unreadably long on a
  // wide monitor -- the fix for "not expanded" is the rail and the 1200px shell, not an endless line.
  + '.lxlg-doc p{font-size:17px;line-height:1.78;margin:0 0 16px;max-width:92ch}'
  + '.lxlg-doc ul{font-size:17px;line-height:1.78;margin:0 0 16px;padding-left:24px;max-width:92ch}'
  + '.lxlg-doc li{margin-bottom:9px}'
  + '.lxlg-doc .lxlg-warn{font-size:16px;line-height:1.66;padding:16px 20px;margin:0 0 20px;max-width:92ch}'
  // THE LINK BUG. Nothing styled an anchor in here, so /terms shipped its Support link in Chrome's
  // default rgb(0,0,238) against a dark page.
  + '.lxlg-doc a{color:var(--accent,#ea6a2c);text-decoration:underline;text-underline-offset:3px;'
  + 'text-decoration-thickness:1px}'
  + '.lxlg-doc a:hover{filter:brightness(1.15)}'
  // The rail is navigation, not prose, so it opts out of the accent-underline treatment above.
  + '.lxlg-doc .lxlg-toc a{color:var(--text-muted,#8a8fa3);text-decoration:none}'
  + '.lxlg-doc .lxlg-toc a:hover{color:var(--text);background:var(--surface,#131317)}'
  + '.lxlg-doc a:focus-visible,.lxlg-doc .lxlg-toc a:focus-visible{outline:2px solid var(--accent,#ea6a2c);'
  + 'outline-offset:2px;border-radius:4px}'
  + '@media(prefers-reduced-motion:reduce){.lxlg-toc a{transition:none}}'
  // Below the two-column threshold the rail becomes a panel above the text, still useful on a phone for
  // skipping to a clause, laid out in as many columns as the width allows.
  + '@media(max-width:1040px){.lxlg-body{grid-template-columns:minmax(0,1fr);gap:0}'
  + '.lxlg-toc{position:static;max-height:none;overflow:visible;margin:0 0 34px;padding:16px 18px;'
  + 'border:1px solid var(--border,#26262c);border-radius:12px;background:var(--surface,#131317)}'
  + '.lxlg-toc ol{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1px}}'
  + '@media(max-width:640px){.lxlg-doc{padding:26px 16px 64px}'
  + '.lxlg-doc h1{font-size:30px}.lxlg-doc .lxlg-sub{font-size:17px}'
  + '.lxlg-doc h2{font-size:21px;margin-top:34px}'
  + '.lxlg-doc p,.lxlg-doc ul{font-size:16.5px}}'
  // ---- Support: matched to the document pages ---------------------------------------------------
  + '.lxlg.lxlg-sup{max-width:1320px;padding:40px 40px 90px}'
  + '.lxlg-sup h1{font-size:clamp(34px,4.2vw,46px);line-height:1.08;margin:0 0 12px;'
  + 'letter-spacing:-.03em}'
  + '.lxlg-sup .lxlg-sub{font-size:19px;line-height:1.5;color:var(--text);margin:0;max-width:78ch}'
  // The form is the page, so it takes the growing track and the aside stays a fixed companion.
  + '.lxlg-sup .lxsup-grid{grid-template-columns:minmax(0,1fr) 352px;gap:28px}'
  + '.lxlg-sup .lxsup-card{padding:28px 30px}'
  + '.lxlg-sup .lxsup-two{gap:18px}'
  + '.lxlg-sup .lxsup-row{gap:8px;margin-bottom:18px}'
  + '.lxlg-sup .lxsup-two .lxsup-row{margin-bottom:18px}'
  + '.lxlg-sup .lxsup-row label{font-size:15px}'
  + '.lxlg-sup .lxsup-row .hint{font-size:13.5px}'
  + '.lxlg-sup .lxsup input,.lxlg-sup .lxsup textarea{font-size:16.5px;padding:12px 15px;'
  + 'border-radius:10px;line-height:1.55}'
  + '.lxlg-sup .lxsup input.mono{font-size:15px}'
  + '.lxlg-sup .lxsup textarea{min-height:170px}'
  + '.lxlg-sup .lxsup-send{font-size:16px;padding:13px 30px;border-radius:10px}'
  + '.lxlg-sup .lxsup-msg{font-size:15.5px}'
  + '.lxlg-sup .lxsup-foot{padding-top:20px;gap:16px}'
  // The aside is genuinely useful -- it answers the question before the form gets sent -- so it stops
  // being set two sizes below the thing it sits next to.
  + '.lxlg-sup .lxsup-box{padding:20px 22px;border-radius:14px}'
  + '.lxlg-sup .lxsup-box h3{font-size:16px;margin:0 0 12px}'
  + '.lxlg-sup .lxsup-box p{font-size:15.5px;line-height:1.62}'
  + '.lxlg-sup .lxsup-links{gap:16px}'
  + '.lxlg-sup .lxsup-links .tag{font-size:12px;letter-spacing:.08em;margin-bottom:4px}'
  + '.lxlg-sup .lxsup-links .ttl{font-size:16px;line-height:1.45}'
  // COLOUR, WHERE IT DOES A JOB.
  //
  // Measured before changing anything: across the whole page the accent appeared exactly ONCE (the
  // send button) against 40 white text nodes, 16 grey ones, 10 grey borders and two greys of
  // background. Nothing was wrong with any single value; there was simply no colour carrying meaning,
  // which is what made it read as flat.
  //
  // Nothing decorative is added below. The accent marks the thing the page is FOR, and the three
  // aside boxes take the three colours their content already implies -- go read this, here is what we
  // will do, here is a warning. Three boxes, three meanings: a legend rather than a palette.

  // The form is the page. An accent edge and the faintest warm wash say so without a heading needing to.
  + '.lxlg-sup .lxsup-card{position:relative;overflow:hidden;'
  + 'background:linear-gradient(180deg,rgba(234,106,44,.05),rgba(234,106,44,0) 200px),var(--surface,#131317)}'
  + '.lxlg-sup .lxsup-card::before{content:"";position:absolute;left:0;right:0;top:0;height:2px;'
  + 'background:linear-gradient(90deg,var(--accent,#ea6a2c),rgba(234,106,44,.12))}'

  // One rail per box, coloured by role, with a tint that fades out well before the text so it never
  // fights the words sitting on it.
  + '.lxlg-sup .lxsup-box{position:relative;overflow:hidden;padding-left:24px}'
  + '.lxlg-sup .lxsup-box::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;'
  + 'background:var(--border,#26262c)}'
  + '.lxlg-sup .lxsup-box--guide::before{background:var(--accent,#ea6a2c)}'
  + '.lxlg-sup .lxsup-box--next::before{background:var(--green,#35c07f)}'
  + '.lxlg-sup .lxsup-box.warn::before{background:var(--red,#e5484d)}'
  + '.lxlg-sup .lxsup-box--guide{background:linear-gradient(90deg,rgba(234,106,44,.055),'
  + 'rgba(234,106,44,0) 48%),var(--surface,#131317)}'
  + '.lxlg-sup .lxsup-box--next{background:linear-gradient(90deg,rgba(53,192,127,.055),'
  + 'rgba(53,192,127,0) 48%),var(--surface,#131317)}'
  + '.lxlg-sup .lxsup-box.warn{background:linear-gradient(90deg,rgba(229,72,77,.06),'
  + 'rgba(229,72,77,0) 48%),var(--surface,#131317)}'

  // The category eyebrows are wayfinding. In accent the four of them can be scanned at a glance;
  // in grey they were four identical labels you had to read to tell apart.
  + '.lxlg-sup .lxsup-links .tag{color:var(--accent,#ea6a2c);opacity:.92}'
  + '.lxlg-sup .lxsup-links a:hover .tag{opacity:1}'

  // "What happens next" is a service commitment, so it gets the marker a status page would use.
  + '.lxlg-sup .lxsup-box--next h3{display:flex;align-items:center;gap:9px}'
  + '.lxlg-sup .lxsup-box--next h3::before{content:"";width:8px;height:8px;border-radius:50%;'
  + 'flex:0 0 auto;background:var(--green,#35c07f);box-shadow:0 0 0 3px rgba(53,192,127,.18)}'

  // The one button on the page carries the one action on the page.
  + '.lxlg-sup .lxsup-send{box-shadow:0 6px 18px rgba(234,106,44,.22)}'
  + '.lxlg-sup .lxsup-send:hover:not(:disabled){box-shadow:0 9px 24px rgba(234,106,44,.3)}'

  + '@media(max-width:1040px){.lxlg-sup .lxsup-grid{grid-template-columns:minmax(0,1fr)}}'
  + '@media(max-width:640px){.lxlg.lxlg-sup{padding:26px 16px 64px}'
  + '.lxlg-sup h1{font-size:30px}.lxlg-sup .lxlg-sub{font-size:17px}'
  + '.lxlg-sup .lxsup-card{padding:20px 18px}'
  + '.lxlg-sup .lxsup input,.lxlg-sup .lxsup textarea{font-size:16px}}'
  + '</style>';

// Numbering and the contents rail are DERIVED from the markup rather than written into it: the two
// documents already carry their clauses as <h2>, and hand-adding ids and numerals to twenty-odd
// headings would mean renumbering by hand every time a clause is inserted or dropped.
//
// Splits the masthead (h1 + sub-line + last-updated) off the top, then walks the rest giving each <h2>
// a slug id and a printed numeral, and emits the rail from the same pass so the two can never disagree.
// Falls back to the original markup untouched if the masthead is not shaped as expected, and skips the
// rail entirely below three clauses, where it would be noise.
function docLayout(inner) {
  const upd = inner.indexOf('<p class="lxlg-upd">');
  const openEnd = inner.indexOf('>') + 1;
  if (upd < 0 || openEnd <= 0) return inner;
  const headEnd = inner.indexOf('</p>', upd) + 4;
  const head = inner.slice(openEnd, headEnd);
  let body = inner.slice(headEnd, inner.lastIndexOf('</div>'));

  const items = [];
  body = body.replace(/<h2>([\s\S]*?)<\/h2>/g, (m, txt) => {
    const plain = txt.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').trim();
    const id = 'sec-' + plain.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    items.push({ id, text: plain });
    return '<h2 id="' + id + '"><span class="lxlg-n">'
      + String(items.length).padStart(2, '0') + '</span><span>' + txt + '</span></h2>';
  });

  const toc = items.length < 3 ? ''
    : '<nav class="lxlg-toc" aria-label="Contents"><p class="lxlg-toc-h">On this page'
      + '<span class="lxlg-toc-c">' + items.length + ' sections</span></p><ol>'
      + items.map((it, i) => '<li><a href="#' + it.id + '"><span class="lxlg-tn">'
          + String(i + 1).padStart(2, '0') + '</span><span>' + it.text + '</span></a></li>').join('')
      + '</ol>' + TOCJS + '</nav>';

  return '<div class="lxlg lxlg-doc"><header class="lxlg-hd">' + head + '</header>'
    + '<div class="lxlg-body">' + toc + '<article class="lxlg-art">' + body + '</article></div></div>';
}

// ---- Privacy -------------------------------------------------------------------------------------
const PRIVACY = '<div class="lxlg">'
  + '<h1>Privacy Policy</h1>'
  + '<p class="lxlg-sub">What happens to information when you use LumosCore.</p>'
  + '<p class="lxlg-upd">Last updated 29 August 2026 · LumosCore OÜ, Estonia</p>'

  + '<p>LumosCore is a non-custodial interface to the Stellar network. We do not hold your funds, we do '
  + 'not hold your keys, and there is no account to create. This page explains exactly what happens to '
  + 'information when you use the site.</p>'

  + '<h2>We do not use cookies</h2>'
  + '<p>LumosCore sets no cookies of any kind, for any purpose. There is no advertising network, no '
  + 'cross-site tracker and no consent banner, because there is nothing to consent to.</p>'

  + '<h2>There is no account, and no personal information</h2>'
  + '<p>We never ask for your name, email address, phone number or identity documents to use the '
  + 'platform. You connect a wallet you already control and that is the whole of it. We cannot see your '
  + 'private keys, your seed phrase or your recovery details — those never leave your wallet.</p>'

  + '<h2>What we do record</h2>'
  + '<p>When you connect a wallet, the site sends your <strong>public wallet address</strong> to our own '
  + 'server once per browsing session, so we can count how many people use the platform. That address is '
  + 'already public on the Stellar network, and we do not attach a name, email or profile to it.</p>'
  // The activity feed is built from this. Stated plainly and in its natural place -- the section that
  // already says what we record -- rather than as an alarming standalone heading. It is accurate about
  // the two fields kept, and about the fact that both are already public on the ledger.
  + '<p>When you submit a transaction through the site, we record its <strong>transaction hash</strong> '
  + 'and the address that submitted it, so the platform can show its own recent activity. Both are '
  + 'already public on the Stellar network. Nothing is recorded for a transaction you do not submit.</p>'
  + '<p>Our hosting provider, <strong>Cloudflare</strong>, keeps standard server logs and aggregate '
  + 'analytics for security and performance. We do not use them to build a profile of you.</p>'
  // Added 2026-09-22 with functions/lxapi/pv.js (bounce rate and cities on the admin Analytics page). Worded to match
  // exactly what that endpoint stores, field for field, and what it does not.
  + '<p>We also count <strong>page views</strong> ourselves, to see how the site is used: for each page you open, '
  + 'the page, the website you came from, your device type (desktop, mobile or tablet), and the approximate city '
  + 'and country Cloudflare associates with your connection. A random identifier that your browser keeps only for '
  + 'the current browsing session links the pages of one visit together. We do not store your IP address, your '
  + 'browser details or your wallet address with it, and these records are deleted after 180 days.</p>'
  // Added 2026-09-23 with functions/lxapi/walletgeo.js. This is a NEW processing activity -- a wallet address stored
  // alongside a country -- so it is disclosed on its own rather than folded into the page-view paragraph above. That
  // paragraph's promise that no wallet address is stored with the page-view record stays true: this is a separate
  // table with no session identifier in it, which is exactly why the beacon sends the address and nothing else.
  + '<p>When you <strong>connect a wallet</strong>, we record the wallet address together with the country '
  + 'Cloudflare associates with your connection, so we can see roughly where LumosCore is used. We keep only the '
  + 'most recent one — it is overwritten each time you connect, so it is not a history of where you have been — '
  + 'and we do not keep the city or region with it, or link it to the page-view record described above.</p>'
  // Added with the live-activity panel (pvevent, functions/lxapi/pv.js kind=click). Deliberately explicit about the
  // boundary: the label of what was pressed, never the content of anything typed.
  + '<p>Within that same record we also note <strong>which links and buttons you press</strong> — the words shown on '
  + 'them, such as &ldquo;Confirm swap&rdquo;, and the website a link leads to when it takes you off LumosCore. We do '
  + 'not record anything you type: not amounts, not addresses, not search boxes, not any field on any form.</p>'

  + '<h2>What your own browser stores</h2>'
  + '<p>The site keeps a small amount of information in your browser so it can work properly between '
  + 'visits: which wallet you connected, your theme and language, the currency you chose to price things '
  + 'in, and any bridge transfer you have started but not yet claimed. This never leaves your device '
  + 'unless you are sending a transaction that needs it, and clearing your browser data removes all of '
  + 'it.</p>'
  + '<p><strong>One thing to know:</strong> a bridge transfer you have burned but not yet redeemed is '
  + 'recorded there, and clearing your browser data removes that record. The transfer itself is not '
  + 'affected and your USDC is not at risk — keep the transaction hash shown on the transfer, which '
  + 'is all Circle needs to rebuild the claim, and you can finish it from any browser.</p>'

  + '<h2>Services your browser contacts directly</h2>'
  + '<p>To show live prices, balances and charts, your browser talks straight to public services rather '
  + 'than routing through us — the Stellar network, block explorers, price feeds, the RPC endpoint '
  + 'of whichever chain you are bridging to, and Circle’s attestation service. Those services can '
  + 'see your IP address and what you requested, under their own privacy policies rather than ours. We '
  + 'do not send them your wallet address.</p>'

  + '<h2>If you contact support</h2>'
  + '<p>When you use the support form we receive your email address, your message and anything you '
  + 'choose to include in it. We use it to answer you and we keep the correspondence so we can follow '
  + 'up.</p>'
  + '<p class="lxlg-warn">Never send us your seed phrase or private keys. We will never ask for them, '
  + 'and anyone who does is trying to steal from you.</p>'

  + '<h2>Your choices</h2>'
  + '<ul><li>Disconnect your wallet at any time; nothing further is recorded.</li>'
  + '<li>Clear your browser data to remove everything stored on your device.</li></ul>'

  + '<h2>Changes</h2>'
  + '<p>If this policy changes we will update this page and the date above. Continuing to use LumosCore '
  + 'after a change means you accept it.</p>'

  + '<h2>Contact</h2>'
  + '<p>Questions about this policy go through the <a href="/support">Support page</a>, which reaches us '
  + 'directly.</p>'
  + '</div>';

// ---- Terms ---------------------------------------------------------------------------------------
const TERMS = '<div class="lxlg">'
  + '<h1>Terms of Use</h1>'
  + '<p class="lxlg-sub">The agreement between you and LumosCore OÜ.</p>'
  + '<p class="lxlg-upd">Last updated 29 August 2026 · LumosCore OÜ, Estonia</p>'

  + '<p>These terms govern your use of LumosCore, operated by LumosCore OÜ, a company registered in '
  + 'Estonia. By using the site you agree to them. If you do not agree, do not use it.</p>'

  + '<h2>Who can use LumosCore</h2>'
  + '<p>You must be at least 18 and legally able to enter into this agreement where you live.</p>'
  + '<p class="lxlg-warn"><strong>LumosCore is not currently available to residents of the European '
  + 'Union.</strong> It is also not offered to anyone in a jurisdiction where using it would break local '
  + 'law, or to anyone subject to applicable sanctions.</p>'
  + '<p>You are responsible for knowing the rules that apply to you. Do not use a VPN or any other method '
  + 'to get around this restriction.</p>'

  + '<h2>What LumosCore is</h2>'
  + '<p>LumosCore is a <strong>non-custodial interface</strong> to the Stellar network and to Circle’s '
  + 'CCTP bridge. We never take possession of your assets. Every transaction is built in your browser and '
  + 'signed by your own wallet — we cannot move your funds, reverse a transaction, or recover one '
  + 'sent to the wrong place.</p>'
  + '<p>Once a transaction is signed and submitted it is final. The blockchain does not have an undo.</p>'

  + '<h2>You accept the risk</h2>'
  + '<p>Trading digital assets carries real risk of loss, and you take it on knowingly. In particular:</p>'
  + '<ul>'
  + '<li><strong>Prices move, and can move violently.</strong> An asset can lose most or all of its value '
  + 'in a short time. Any profit or loss is yours.</li>'
  + '<li><strong>Liquidity pools can return less than you deposited.</strong> As prices move the pool '
  + 'rebalances, and the fees you earn may not cover the difference.</li>'
  + '<li><strong>Assets can fail.</strong> An issuer may mint more, abandon a project, or turn out to be '
  + 'fraudulent. A listing on LumosCore is not a promise that any asset is sound.</li>'
  + '<li><strong>Nothing here is financial advice.</strong> We do not recommend assets, and nothing on the '
  + 'site is an offer or solicitation to buy or sell anything.</li>'
  + '</ul>'

  + '<h2>What a verified tick means</h2>'
  + '<p>A verified mark means we checked that an asset comes from the issuer it claims — either '
  + 'because the issuer proves it through its own domain, or because LumosCore has reviewed and curated '
  + 'it. It is a check on <strong>identity, not quality</strong>. It is not an endorsement, not a rating, '
  + 'and not a view on whether an asset is a good investment.</p>'

  + '<h2>Fees</h2>'
  + '<p>LumosCore charges 0.2% on a trade, reduced to 0.1% if you hold at least 250,000 LUMOS. Network '
  + 'fees are paid to the relevant blockchain, not to us. Fees for listing and for token issuance are '
  + 'shown before you commit to them. We may change our fees, and the current fees are always the ones '
  + 'shown in the interface.</p>'

  + '<h2>Your responsibilities</h2>'
  + '<ul>'
  + '<li>Keep your wallet, keys and recovery phrase safe. We cannot recover them, and anyone who has them '
  + 'controls your funds.</li>'
  + '<li>Check the asset, the issuer and the amounts before you sign anything.</li>'
  + '<li>Do not use LumosCore for anything unlawful, and do not attempt to attack, overload or interfere '
  + 'with the site.</li>'
  + '</ul>'

  + '<h2>Availability</h2>'
  + '<p>We provide LumosCore as it is, without warranty of any kind. We do not promise it will be '
  + 'available without interruption or free of errors, and we may change or withdraw any part of it. Much '
  + 'of what you see comes from public networks and third-party services we do not control.</p>'

  + '<h2>Limitation of liability</h2>'
  + '<p>To the fullest extent the law allows, LumosCore OÜ is not liable for any loss of funds, '
  + 'profits or data arising from your use of the platform, including losses caused by price movements, '
  + 'your own transactions, faults in a blockchain or third-party service, or assets that fail or turn '
  + 'out to be fraudulent.</p>'

  + '<h2>Governing law</h2>'
  + '<p>These terms are governed by the laws of Estonia, and disputes are subject to the Estonian '
  + 'courts.</p>'

  + '<h2>Changes</h2>'
  + '<p>We may update these terms. The current version is always the one on this page, and continuing to '
  + 'use LumosCore after a change means you accept it.</p>'

  + '<h2>Contact</h2>'
  + '<p>Questions about these terms go through the <a href="/support">Support page</a>.</p>'
  + '</div>';

// ---- Support -------------------------------------------------------------------------------------
const SUPPORT = '<div class="lxlg lxlg-sup">'
  + '<header class="lxlg-hd">'
  + '<h1>Get in touch</h1>'
  + '<p class="lxlg-sub">Tell us what happened and we will reply by email.</p>'
  + '</header>'
  + '<div class="lxsup-grid">'
  + '<form class="lxsup lxsup-card" id="lxSupForm" novalidate>'
  + '<div class="lxsup-two">'
  + '<div class="lxsup-row"><label for="lxsEmail">Your email <span class="hint">— so we can '
  + 'reply</span></label><input id="lxsEmail" name="email" type="email" autocomplete="email" '
  + 'required placeholder="you@example.com"></div>'
  + '<div class="lxsup-row"><label for="lxsName">Name <span class="hint">— optional</span>'
  + '</label><input id="lxsName" name="name" type="text" autocomplete="name" '
  + 'placeholder="What to call you"></div>'
  + '</div>'
  + '<div class="lxsup-row"><label for="lxsSubject">Subject</label>'
  + '<input id="lxsSubject" name="subject" type="text" required '
  + 'placeholder="What\u2019s this about?"></div>'
  + '<div class="lxsup-row lxsup-grow"><label for="lxsMsg">Message</label>'
  + '<textarea id="lxsMsg" name="message" required '
  + 'placeholder="What were you trying to do, and what happened instead?"></textarea></div>'
  + '<div class="lxsup-two">'
  + '<div class="lxsup-row"><label for="lxsWallet">Wallet address <span class="hint">— '
  + 'optional</span></label><input id="lxsWallet" name="wallet" type="text" class="mono" '
  + 'placeholder="G…"></div>'
  + '<div class="lxsup-row"><label for="lxsTx">Transaction ID <span class="hint">— optional'
  + '</span></label><input id="lxsTx" name="txHash" type="text" class="mono" '
  + 'placeholder="Transaction hash"></div>'
  + '</div>'
  + '<div class="lxsup-foot"><button type="submit" class="lxsup-send" id="lxsSend">'
  + 'Send message</button><p class="lxsup-msg" id="lxsMsgOut"></p></div>'
  + '</form>'
  + '<aside class="lxsup-aside">'
  + '<div class="lxsup-box lxsup-box--guide"><h3>The answer may already be here</h3>'
  + '<ul class="lxsup-links">'
  + '<li><a href="/trade/stellar#faq"><span class="tag">Trade</span><span class="ttl">Fees, curated listings and LUMOS</span></a></li>'
  + '<li><a href="/bridge#faq"><span class="tag">Cross-chain</span><span class="ttl">Bridging USDC and claiming it</span></a></li>'
  + '<li><a href="/wallet#faq"><span class="tag">Wallet</span><span class="ttl">Trustlines and claimable payments</span></a></li>'
  + '<li><a href="/pools/stellar#faq"><span class="tag">Pools</span><span class="ttl">Liquidity pools and their risks</span></a></li>'
  + '</ul></div>'
  + '<div class="lxsup-box lxsup-box--next"><h3>What happens next</h3>'
  + '<p>We usually reply within one business day, to the address you give above. Including your '
  + 'wallet address or a transaction ID normally saves a round trip.</p></div>'
  + '<div class="lxsup-box warn"><h3>We will never ask for your keys</h3>'
  + '<p>Not your seed phrase, not your private key, not for any reason. Anyone who does — here or '
  + 'anywhere claiming to be us — is trying to steal from you.</p></div>'
  + '</aside>'
  + '</div></div>'
  + '<script id="lx-support-js">(function(){'
  + 'var f=document.getElementById("lxSupForm"); if(!f||f.__lx)return; f.__lx=1;'
  + 'var out=document.getElementById("lxsMsgOut"), btn=document.getElementById("lxsSend");'
  // pre-fill the wallet from the connection rather than making someone copy their own address
  + 'function say(t,cls){ out.textContent=t; out.className="lxsup-msg "+cls; }'
  + 'f.addEventListener("submit",function(e){ e.preventDefault();'
  + 'var email=(f.email.value||"").trim(), subject=(f.subject.value||"").trim(), message=(f.message.value||"").trim();'
  + 'if(!email||email.indexOf("@")<1){ say("Enter an email address so we can reply.","err"); f.email.focus(); return; }'
  + 'if(!subject){ say("Add a subject so we know what this is about.","err"); f.subject.focus(); return; }'
  + 'if(!message){ say("Tell us what happened.","err"); f.message.focus(); return; }'
  + 'btn.disabled=true; var orig=btn.textContent; btn.textContent="Sending…"; say("","");'
  + 'fetch("/lxapi/support",{method:"POST",headers:{"content-type":"application/json"},'
  + 'body:JSON.stringify({email:email,name:(f.name.value||"").trim(),subject:subject,message:message,'
  + 'wallet:(f.wallet.value||"").trim(),txHash:(f.txHash.value||"").trim()})})'
  + '.then(function(r){ return r.json().catch(function(){ return null; }).then(function(d){ return {ok:r.ok,d:d}; }); })'
  + '.then(function(r){ if(!r.ok||!r.d||!r.d.ok){ var er=new Error("send failed");'
  + 'er.srv=(r.d&&r.d.error)||""; throw er; }'
  + 'f.reset(); say("Thanks — we have got it, and we will reply to "+email+".","ok"); })'
  // an error must always leave a way through: the direct address is the fallback
  + '.catch(function(err){ var m=(err&&err.srv)||"";'
  + 'say(m||"That did not send. Email ' + SUPPORT_TO + ' directly and we will pick it up.","err"); })'
  + '.then(function(){ btn.disabled=false; btn.textContent=orig; });'
  + '});'
  + '})();</scr' + 'ipt>';

// Rail behaviour. Self-contained, no globals, and safe to run on a page whose rail was suppressed
// (fewer than three sections) -- it returns immediately when there is no nav.
//
// "Current" is the last heading whose top has passed 150px: that matches how someone reads, since the
// clause you are in is the one whose title has gone above your eyeline, not the one nearest the middle.
// The final section gets special handling -- at the bottom of the page its heading may never reach the
// line, so hitting the end of the scroll always selects the last item.
const TOCJS = '<scr' + 'ipt id="lx-legal-toc">(function(){'
  // DEFERRED UNTIL THE DOCUMENT IS PARSED. This script sits inside <nav>, and the rail is emitted
  // BEFORE <article> in the grid, so at execution time not one section heading exists yet:
  // getElementById returned null for every one of them and the rail silently tracked nothing,
  // sitting on clause 1 for the whole page. Resolving after DOMContentLoaded is what makes the
  // lookups find their targets, and it holds wherever the script is later moved to.
  + 'function init(){'
  + 'var nav=document.querySelector(".lxlg-toc");if(!nav)return;'
  + 'var links=[].slice.call(nav.querySelectorAll("a[href^=\'#\']"));if(!links.length)return;'
  + 'var secs=links.map(function(a){try{return document.getElementById(a.getAttribute("href").slice(1));}catch(e){return null;}});'
  + 'var cur=-1;'
  + 'function pick(){'
  + 'var best=0;'
  + 'for(var i=0;i<secs.length;i++){var s=secs[i];if(!s)continue;'
  + 'if(s.getBoundingClientRect().top<=150)best=i;}'
  + 'if((window.innerHeight+window.scrollY)>=(document.documentElement.scrollHeight-4))best=links.length-1;'
  + 'if(best===cur)return;cur=best;'
  + 'for(var j=0;j<links.length;j++){if(j===cur)links[j].classList.add("is-on");else links[j].classList.remove("is-on");}'
  + '}'
  + 'var q=false;'
  + 'function onScroll(){if(q)return;q=true;setTimeout(function(){q=false;pick();},70);}'
  + 'window.addEventListener("scroll",onScroll,{passive:true});'
  + 'window.addEventListener("resize",onScroll,{passive:true});'
  // Smooth only when the reader has not asked for less motion; the jump still works either way because
  // the href is a real anchor and preventDefault is only called on the branch that scrolls.
  + 'try{var rm=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;'
  + 'if(!rm)nav.addEventListener("click",function(e){'
  + 'var a=e.target&&e.target.closest?e.target.closest("a[href^=\'#\']"):null;if(!a)return;'
  + 'var t=document.getElementById(a.getAttribute("href").slice(1));if(!t)return;'
  + 'e.preventDefault();t.scrollIntoView({behavior:"smooth",block:"start"});'
  + 'try{history.replaceState(null,"",a.getAttribute("href"));}catch(_){}'
  + '});}catch(_){}'
  + 'pick();'
  + '}'
  + 'if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();'
  + '})();</scr' + 'ipt>';

// ---- the pages ------------------------------------------------------------------------------------
const PAGES = [
  ['privacy', docLayout(PRIVACY), 'Privacy Policy | LumosCore',
    'What LumosCore records and what it does not. No cookies, no account, non-custodial — and a '
    + 'plain account of the one thing we do store.'],
  ['terms', docLayout(TERMS), 'Terms of Use | LumosCore',
    'The terms governing use of LumosCore, operated by LumosCore OÜ in Estonia — eligibility, '
    + 'trading risk, fees and liability.'],
  ['support', SUPPORT, 'Support | LumosCore',
    'Get in touch with the LumosCore team. Tell us what happened and we will reply by email.'],
];

// The footer links these three pages have always had, pointing nowhere. Rewritten across every page in
// the container, not just the new ones.
const FOOTER = [
  [/(<a[^>]*)href="#"([^>]*>\s*Privacy Policy\s*<\/a>)/gi, '$1href="/privacy"$2'],
  [/(<a[^>]*)href="#"([^>]*>\s*Terms of Condition\s*<\/a>)/gi, '$1href="/terms"$2'],
  [/(<a[^>]*)href="#"([^>]*>\s*Terms of Use\s*<\/a>)/gi, '$1href="/terms"$2'],
  [/(<a[^>]*)href="#"([^>]*>\s*Support\s*<\/a>)/gi, '$1href="/support"$2'],
  // "Terms of Condition" is not a phrase. It shipped in the design's footer and is therefore on every
  // page of the site; the document it points at is titled Terms and Conditions, so the link says that.
  // Runs after the href rewrites above, which still match the old label.
  [/(<a[^>]*>)\s*Terms of Condition\s*(<\/a>)/gi, '$1Terms and Conditions$2'],
];

let made = 0, wired = 0;
for (const [dev, donor, suffix] of [
  ['desktop', 'lumoscore-mcp.html', '.html'],
  ['mobile', 'lumoscore-mcp-mobile.html', '-mobile.html'],
]) {
  const file = 'lumoscore-aptos-' + dev + '.html';
  let data; try { data = read(file); } catch (e) { continue; }
  let json, s, e; try { ({ json, s, e } = getContents(data)); } catch (err) { continue; }

  const src = json[donor];
  if (typeof src !== 'string') { console.error('  ' + file + ': donor ' + donor + ' missing — skipped'); continue; }

  for (const [name, main, title, desc] of PAGES) {
    const body = replaceMain(stripFaq(src), main);
    if (!body) { console.error('  ' + file + ': no <main> in donor — ' + name + ' skipped'); continue; }
    json['lumoscore-' + name + suffix] = clearNavActive(setHead(body, title, desc));
    made++;
  }

  for (const key of Object.keys(json)) {
    let h = json[key], before = h;
    for (const [re, to] of FOOTER) h = h.replace(re, to);
    if (h !== before) { json[key] = h; wired++; }
  }

  const ser = JSON.stringify(json).split('</').join('<' + B + '/');
  fs.writeFileSync(file, data.slice(0, s) + ser + data.slice(e), 'utf8');
}
console.log('legal pages: built ' + made + ' pages, wired footer links on ' + wired + ' page keys');
