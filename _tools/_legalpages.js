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
  + '</style>';

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
  + '<p>Our hosting provider, <strong>Cloudflare</strong>, keeps standard server logs and aggregate '
  + 'analytics for security and performance. We do not use them to build a profile of you.</p>'

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
  + '<h1>Get in touch</h1>'
  + '<p class="lxlg-sub">Tell us what happened and we will reply by email.</p>'
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
  + '<div class="lxsup-box"><h3>The answer may already be here</h3>'
  + '<ul class="lxsup-links">'
  + '<li><a href="/trade/stellar#faq"><span class="tag">Trade</span><span class="ttl">Fees, curated listings and LUMOS</span></a></li>'
  + '<li><a href="/bridge#faq"><span class="tag">Cross-chain</span><span class="ttl">Bridging USDC and claiming it</span></a></li>'
  + '<li><a href="/wallet#faq"><span class="tag">Wallet</span><span class="ttl">Trustlines and claimable payments</span></a></li>'
  + '<li><a href="/pools/stellar#faq"><span class="tag">Pools</span><span class="ttl">Liquidity pools and their risks</span></a></li>'
  + '</ul></div>'
  + '<div class="lxsup-box"><h3>What happens next</h3>'
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

// ---- the pages ------------------------------------------------------------------------------------
const PAGES = [
  ['privacy', PRIVACY, 'Privacy Policy | LumosCore',
    'What LumosCore records and what it does not. No cookies, no account, non-custodial — and a '
    + 'plain account of the one thing we do store.'],
  ['terms', TERMS, 'Terms of Use | LumosCore',
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
