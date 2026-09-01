// Landing page trim.
//
// The page ran 11.4 viewport-heights. Everything below the hero was either duplicated, unsupported by
// the product, or restating the hero, so this cuts it back to: hero -> products -> networks -> FAQ -> CTA.
//
// What comes out, and why each one rather than "it was long":
//
//  - .lx-netmq            The marquee read "Supported networks: Stellar, XRP Ledger, Hedera, Starknet,
//                         World Chain, VeChain" with no qualifier on any of them. Four of those six are
//                         not supported, and nothing in the codebase marks them as coming. On a platform
//                         holding real funds that is a factual claim, not decoration. Replaced by a
//                         networks line that says what is actually true.
//  - #why                 3.3 screens, the largest block on the page, restating the hero in six cards.
//  - .testimonial-block   Three invented people. One is attributed to the "Founder, Wrapped Bitcoin
//                         Protocol" -- a real project -- which reads as an endorsement that was never
//                         given. This one would have to go regardless of length.
//  - .block#faq           A second FAQ, immediately above the generated one, both opening with "What is
//                         LumosCore?" and BOTH carrying id="faq", so the anchor could only ever reach the
//                         first. The generated .lx-faq is the one that carries the FAQPage structured
//                         data, so that is the one that stays.
//  - #how (mobile only)   Mobile carried three sections desktop never had. This one is static filler.
//
// The mobile trending block is deliberately LEFT ALONE: it is fed by _trending.js, and removing an
// element a data layer still queries is how this codebase produces silent TypeErrors.
//
// Removal is asserted. Every signature must match exactly once or the whole run aborts without writing,
// because a transform that removes markup and guesses is the failure mode that took the site down on
// 2026-08-14. Re-running is a no-op once the marker is in place.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const MARK = 'lx-netline-css';

const NETCSS = '<style id="lx-netline-css">'
  + '.lx-netline{padding:38px 0 42px}'
  + '.lx-netline-in{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:14px 18px}'
  + '.lx-netline-i{display:inline-flex;align-items:center;gap:10px;padding:11px 20px;border:1px solid var(--border);border-radius:999px;background:var(--surface)}'
  + '.lx-netline-i b{font-size:15px;font-weight:700;color:var(--text)}'
  + '.lx-netline-i em{font-style:normal;font-size:12px;font-weight:600;color:var(--text-soft);background:var(--bg-elev,rgba(127,127,127,.14));padding:3px 10px;border-radius:999px}'
  + '@media (max-width:640px){.lx-netline{padding:24px 0 28px}.lx-netline-i{padding:9px 15px}.lx-netline-i b{font-size:14px}.lx-netline-i em{font-size:11px}}'
  + '</style>';

const NETLINE = '<section class="lx-netline" id="networks"><div class="container"><div class="lx-netline-in">'
  + '<span class="lx-netline-i"><b>Stellar</b></span>'
  + '<span class="lx-netline-i"><b>XRPL</b><em>Next up</em></span>'
  + '<span class="lx-netline-i"><b>More Networks</b><em>Upcoming</em></span>'
  + '</div></div></section>';

// Lifted from the mobile landing so both layouts close the same way, with the docs button given the
// destination it never had -- it carried no handler and nothing delegated to it by text.
const DOCS = ' onclick="location.href=' + "'/docs'" + '"';
const CTA = '<section class="final-cta-section"><div class="container"><div class="final-cta">'
  + '<h2>Ready to build <span class="grad">across chains?</span></h2>'
  + '<p>Connect your wallet and launch your first token in under 5 minutes.</p>'
  + '<div class="ctas">'
  + '<button class="btn primary" data-lxnonav="1" onclick="try{window.lxChooseNetwork&&window.lxChooseNetwork(' + "'lumoscore-home.html'" + ')}catch(e){}">Launch App</button>'
  + '<button class="btn"' + DOCS + '>Read the docs</button>'
  + '</div></div></div></section>';

// Walks the tag stream from the opening tag and stops on the </section> that closes IT, so a nested
// section cannot end the cut early. Returns the range so callers can insert relative to it instead of
// re-deriving indexes from a string they have already modified.
function range(html, sig) {
  const i = html.indexOf(sig);
  if (i < 0) return null;
  const re = /<\/?section\b/g;
  re.lastIndex = i;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    if (m[0].charAt(1) === '/') {
      depth--;
      if (depth === 0) return { start: i, end: html.indexOf('>', m.index) + 1 };
    } else depth++;
  }
  return null;
}
function cutSection(html, sig) {
  const r = range(html, sig);
  if (!r) return null;
  return { html: html.slice(0, r.start) + html.slice(r.end), cut: html.slice(r.start, r.end) };
}
// Places markup immediately after the section that sig opens.
function insertAfter(html, sig, markup) {
  const r = range(html, sig);
  if (!r) return null;
  return html.slice(0, r.end) + markup + html.slice(r.end);
}

function count(s, sig) { let n = 0, i = 0; while ((i = s.indexOf(sig, i)) >= 0) { n++; i += sig.length; } return n; }

const PAGES = [
  { file: 'lumoscore-aptos-desktop.html', key: 'lumoscore-landing.html', addCta: true },
  { file: 'lumoscore-aptos-mobile.html', key: 'lumoscore-landing-mobile.html', addCta: false }
];

// The mobile-only #how is listed per page rather than globally: asserting "exactly once" against a
// signature that legitimately does not exist on desktop would abort every run.
const CUTS = {
  'lumoscore-landing.html': [
    '<section class="lx-netmq"',
    '<section class="block" id="why">',
    '<section class="block testimonial-block">',
    '<section class="block" id="faq">'
  ],
  'lumoscore-landing-mobile.html': [
    '<section class="lx-netmq"',
    '<section class="block" id="how">',
    '<section class="block" id="why">',
    '<section class="block testimonial-block">',
    '<section class="block" id="faq">'
  ]
};

const ANCHOR = '<section class="block" id="products"';
const FAQ = '<section class="lx-faq"';

const problems = [];
const staged = [];

for (const p of PAGES) {
  const data = read(p.file);
  const { json, s, e } = getContents(data);
  let html = json[p.key];
  if (html == null) { problems.push(p.file + ': no key ' + p.key); continue; }
  if (html.indexOf(MARK) >= 0) { console.log('  ' + p.key + ': already trimmed, skipping'); continue; }

  // Assert BEFORE touching anything: every signature exactly once, and both anchors present.
  for (const sig of CUTS[p.key]) {
    const n = count(html, sig);
    if (n !== 1) problems.push(p.key + ': expected 1 of ' + JSON.stringify(sig) + ', found ' + n);
  }
  if (count(html, ANCHOR) !== 1) problems.push(p.key + ': products anchor not found exactly once');
  if (count(html, FAQ) !== 1) problems.push(p.key + ': generated .lx-faq not found exactly once');
  if (problems.length) continue;

  const before = html.length;
  for (const sig of CUTS[p.key]) {
    const r = cutSection(html, sig);
    if (!r) { problems.push(p.key + ': could not close ' + JSON.stringify(sig)); break; }
    html = r.html;
  }
  if (problems.length) continue;

  // Networks line directly after the products block.
  const withNet = insertAfter(html, ANCHOR, NETLINE);
  if (!withNet) { problems.push(p.key + ': could not close the products section'); continue; }
  html = withNet;

  // The CTA closes the page, placed after the generated FAQ -- NOT appended to the string, which would
  // put it outside </body>. Mobile already ships a CTA above the FAQ; it is lifted and re-seated below
  // so both layouts end on the same thing rather than on a list of questions.
  let cta = CTA;
  if (!p.addCta) {
    const ex = cutSection(html, '<section class="final-cta-section"');
    if (!ex) { problems.push(p.key + ': mobile CTA not found'); continue; }
    html = ex.html;
    cta = ex.cut.replace('<button class="btn">Read the docs</button>',
      '<button class="btn"' + DOCS + '>Read the docs</button>');
  }
  const withCta = insertAfter(html, FAQ, cta);
  if (!withCta) { problems.push(p.key + ': could not close the generated FAQ'); continue; }
  html = withCta;

  // ---- anchors that now point at nothing.
  // Removing a section silently breaks every link into it, and the landing page had four such links --
  // including "Scroll to learn more", which pointed at the marquee's own id. Rather than enumerate them
  // (mobile had four where desktop had two, and enumerating is how you miss one), every in-page href is
  // resolved against the ids that actually survive, and anything dangling is repointed. The nav item is
  // relabelled too: it read "Why LumosCore" and led to a section that no longer exists.
  html = html.replace('<a href="#why">Why LumosCore</a>', '<a href="#networks">Networks</a>');
  const ids = {};
  (html.match(/\sid=["'][^"']+["']/g) || []).forEach(a => { ids[a.replace(/.*=["']|["']$/g, '')] = 1; });
  const FALLBACK = { why: 'networks' };
  html = html.replace(/href=["']#([\w-]+)["']/g, function (whole, id) {
    if (ids[id]) return whole;
    return 'href="#' + (FALLBACK[id] || 'products') + '"';
  });
  const dangling = (html.match(/href=["']#([\w-]+)["']/g) || [])
    .map(h => h.replace(/.*#|["']$/g, '')).filter(id => !ids[id]);
  if (dangling.length) { problems.push(p.key + ': anchors still dangling -> ' + dangling.join(', ')); continue; }

  const bi = html.lastIndexOf('</body>');
  html = bi >= 0 ? html.slice(0, bi) + NETCSS + html.slice(bi) : html + NETCSS;

  json[p.key] = html;
  staged.push({ file: p.file, data, s, e, json, key: p.key, before, after: html.length });
}

if (problems.length) {
  console.error('landing trim: ABORT — nothing written.');
  problems.forEach(x => console.error('  ' + x));
  process.exit(1);
}

for (const st of staged) {
  const serialized = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + serialized + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.key + ': ' + st.before + ' -> ' + st.after + ' chars (' +
    Math.round((1 - st.after / st.before) * 100) + '% smaller)');
}
console.log('landing trim: done on ' + staged.length + ' page(s)');
