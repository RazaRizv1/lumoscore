// Landing: give the networks and FAQ sections the weight of sections.
//
// Measured before touching anything: the products heading renders at 42.9px, the FAQ heading at 21px,
// and the networks strip had no heading at all -- three pills floating in a dark band. That is the
// whole reason those two read as afterthoughts next to the products grid. So both get a header at the
// products' own scale, and the elements underneath grow to match rather than sitting at pill size.
//
// Copy is short and checkable: the networks line says what the three cards already say, and the FAQ
// line names what is actually in the eight tabs. Nothing here asserts a number.
//
// Re-injects rather than skipping on a marker: this strips its own previous output first, so the block
// can be tuned by editing this file and running it again.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const NET_HEAD = '<div class="lx-sec-head lx-nethead">'
  + '<h2>Live on Stellar, with more to come.</h2>'
  + '<p>Trading, liquidity pools and the launchpad run on Stellar mainnet today. XRPL is next.</p>'
  + '</div>';

const FAQ_SUB = '<p class="lx-faq-sub">Fees, custody, listings and how each product works — '
  + 'grouped so you can find your own question.</p>';

const CSS = '<style id="lx-landsections">'
  // ---- shared section header, matched to the products heading rather than guessed
  + '.lx-sec-head{text-align:center;max-width:780px;margin:0 auto 44px}'
  // Sizes mirror h2.block-title, which is what the products heading uses: 57.2px, stepping to 42.9px
  // below 1100px. Read off the page rather than picked -- a first pass hardcoded 42.9 everywhere,
  // which matched the products heading only in a narrow window and left both new headings visibly
  // smaller on a real desktop.
  + '.lx-sec-head h2{font-size:57.2px;font-weight:800;letter-spacing:-1px;line-height:1.12;'
  + 'margin:0 0 14px;color:var(--text);text-wrap:balance}'
  + '.lx-sec-head p{font-size:19px;line-height:1.6;color:var(--text-muted);margin:0}'
  // ---- networks: a zone of its own, not a row of chips
  + '.lx-netline{padding:84px 0 92px;position:relative}'
  // A single soft wash centred behind the row gives the band an edge without a hard rule.
  + '.lx-netline::before{content:"";position:absolute;inset:0;pointer-events:none;'
  + 'background:radial-gradient(760px 320px at 50% 40%,rgba(52,211,153,.06),transparent 70%)}'
  + '.lx-netline>*{position:relative;z-index:1}'
  + '.lx-netline-in{gap:20px}'
  + '.lx-net-card{padding:24px 36px 24px 26px;border-radius:24px;gap:20px}'
  + '.lx-net-mark{width:62px;height:62px;border-radius:19px}'
  + '.lx-net-mark svg{width:38px;height:38px}'
  + '.lx-net-txt{gap:5px}'
  + '.lx-net-txt b{font-size:23px;letter-spacing:-.3px}'
  + '.lx-net-txt em{font-size:12.5px;letter-spacing:.08em}'
  + '.lx-net-card.is-live{transform:scale(1.04)}'
  + '.lx-net-card.is-live:hover{transform:scale(1.04) translateY(-4px)}'
  // ---- FAQ: same heading scale, roomier cards, tabs you can hit
  + '.lx-faq{max-width:1260px;padding:84px 24px 96px}'
  + '.lx-faq h2{font-size:57.2px;letter-spacing:-1px;line-height:1.12;margin:0 0 14px;text-align:center}'
  + '.lx-faq-sub{font-size:19px;line-height:1.6;color:var(--text-muted);margin:0 auto 38px;'
  + 'max-width:720px;text-align:center}'
  + '.lx-faqtabs{justify-content:center;gap:12px;margin-bottom:38px}'
  + '.lx-faqtab{font-size:15px;padding:13px 24px}'
  + '.lx-faqtab span{font-size:12.5px;padding:3px 9px}'
  + '.lx-faq .lx-faqpane.is-on{gap:20px}'
  + '.lx-faq .lx-faqpane>div{padding:28px 30px 30px;border-radius:20px;'
  + 'background:linear-gradient(180deg,var(--surface) 0%,var(--bg-elev,var(--surface)) 100%)}'
  + '.lx-faq .lx-faqpane>div::before{left:30px;width:34px;height:3px}'
  + '.lx-faq-q{font-size:18.5px;line-height:1.35;margin-bottom:11px}'
  + '.lx-faq-a{font-size:15.5px;line-height:1.68}'
  // The design's own first step for a section heading.
  + '@media (max-width:1100px){.lx-sec-head h2,.lx-faq h2{font-size:42.9px;letter-spacing:-.8px}}'
  // ---- phones: the same structure, stepped down so nothing has to wrap awkwardly
  + '@media (max-width:900px){'
  + '.lx-sec-head{margin-bottom:30px}'
  + '.lx-sec-head h2{font-size:30px;letter-spacing:-.6px}'
  + '.lx-sec-head p{font-size:16.5px}'
  + '.lx-netline{padding:52px 0 58px}'
  + '.lx-net-card{padding:16px 22px 16px 16px;border-radius:18px;gap:14px}'
  + '.lx-net-mark{width:46px;height:46px;border-radius:14px}'
  + '.lx-net-mark svg{width:28px;height:28px}'
  + '.lx-net-txt b{font-size:17px}'
  + '.lx-net-card.is-live{transform:none}'
  + '.lx-net-card.is-live:hover{transform:translateY(-3px)}'
  + '.lx-faq{padding:54px 16px 62px}'
  + '.lx-faq h2{font-size:30px;letter-spacing:-.6px}'
  + '.lx-faq-sub{font-size:16px;margin-bottom:26px}'
  + '.lx-faqtabs{margin-bottom:26px;gap:9px}'
  + '.lx-faqtab{font-size:13.5px;padding:11px 17px}'
  + '.lx-faq .lx-faqpane>div{padding:22px 20px 24px;border-radius:16px}'
  + '.lx-faq-q{font-size:17px}'
  + '}'
  + '@media (prefers-reduced-motion:reduce){.lx-net-card.is-live,.lx-net-card.is-live:hover'
  + '{transform:none}}'
  + '</st' + 'yle>';

const PAGES = [
  { file: 'lumoscore-aptos-desktop.html', key: 'lumoscore-landing.html' },
  { file: 'lumoscore-aptos-mobile.html', key: 'lumoscore-landing-mobile.html' }
];

const problems = [];
const staged = [];

for (const p of PAGES) {
  const data = read(p.file);
  const { json, s, e } = getContents(data);
  let html = json[p.key];
  if (html == null) { problems.push(p.key + ': missing'); continue; }

  // Drop whatever a previous run put in, so this is a rewrite rather than a stack.
  html = html
    .replace(/<style id="lx-landsections">[\s\S]*?<\/style>/g, '')
    // The header holds only an h2 and a p, so the first </div> is its own — no nesting to walk.
    .replace(/<div class="lx-sec-head lx-nethead">[\s\S]*?<\/div>/g, '')
    .replace(/<p class="lx-faq-sub">[\s\S]*?<\/p>/g, '');

  // ---- networks header, inside the section's own container
  const ni = html.indexOf('<section class="lx-netline"');
  if (ni < 0) { problems.push(p.key + ': no networks section'); continue; }
  const nc = html.indexOf('<div class="container">', ni);
  if (nc < 0 || nc > html.indexOf('</section>', ni)) { problems.push(p.key + ': networks container not found'); continue; }
  const at = nc + '<div class="container">'.length;
  html = html.slice(0, at) + NET_HEAD + html.slice(at);

  // ---- FAQ sub, right after its heading
  const fh = html.indexOf('<h2>Frequently asked questions</h2>');
  if (fh < 0) { problems.push(p.key + ': FAQ heading not found'); continue; }
  const after = fh + '<h2>Frequently asked questions</h2>'.length;
  html = html.slice(0, after) + FAQ_SUB + html.slice(after);

  const bo = html.lastIndexOf('</body>');
  html = bo >= 0 ? html.slice(0, bo) + CSS + html.slice(bo) : html + CSS;

  json[p.key] = html;
  staged.push({ file: p.file, data, s, e, json, key: p.key });
}

if (problems.length) {
  console.error('landing sections: ABORT — nothing written.');
  problems.forEach(x => console.error('  ' + x));
  process.exit(1);
}
for (const st of staged) {
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.key + ': networks + FAQ headers and scale applied');
}
console.log('landing sections: done on ' + staged.length + ' page(s)');
