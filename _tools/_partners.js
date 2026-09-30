// Partners section: a right-to-left marquee, injected directly below #products.
//
// THE EIGHT are the integrations the product actually runs on, not logos bought for a wall:
// four bridge routes (Circle CCTP, NEAR Intents, LayerZero, Axelar, THORChain) and the wallets
// that sign (LOBSTR on Stellar; Xaman and GemWallet on the XRP Ledger). Every claim the page
// makes about reaching another chain goes through one of the first five.
//
// LOGOS ARE USED ONLY IF THE FILE IS ACTUALLY THERE. Each logo path is checked with existsSync at
// BUILD time and the <img> is emitted only when the file exists -- an item with no logo renders as
// its wordmark alone rather than as a broken image icon. Seven of the eight are already in the
// repo; THORChain has no mark anywhere under assets/, so it ships as a wordmark. Drop a file at
// assets/networks/thorchain.png (and copy it into dist/assets/networks/ -- see below) and re-run
// this transform and it will pick it up with no edit.
//
// AND THE FILE IS CHECKED IN dist/assets TOO, not just assets/. A new file in assets/ passes the
// build AND the predeploy check and still 404s on the live site, because dist/assets is not synced
// from assets/ -- it has to be copied by hand. So a logo that exists in only one of the two is
// treated as missing and named in the output, rather than shipping a broken image.
//
// PATHS ARE ROOT-RELATIVE (`/assets/...`). A bare `assets/...` resolves against the current
// directory, so it would work on `/` and 404 on any page one segment deep. This section only
// renders on the landing page today, but the rule is cheap and the failure is silent.
//
// THE MARQUEE is the standard two-copy trick: the track holds the list twice and translates by
// exactly -50%, so the moment the first copy leaves the frame the second is in the identical
// position and the loop is seamless. It needs the two copies to be byte-identical, which is why
// both are generated from the same array rather than written out.
//   * aria-hidden on the second copy, so a screen reader is not read the list twice.
//   * the whole strip is a <ul>, because it is a list.
//   * paused on hover, so a reader can actually look at one.
//   * prefers-reduced-motion stops it dead and lets the strip scroll manually instead -- a
//     continuously moving band is exactly what that setting exists to switch off.
//   * translate3d, and the animation is on transform only, so it composites instead of repainting.
//
// Idempotent: removes its own <section>, its stylesheet and any stray earlier copy before
// inserting, so re-running edits the list rather than stacking a second marquee.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// Plainly named, because the section is plainly what it says. A cleverer line was tried here
// ("Built on work we did not have to do ourselves.") and it was the wrong register for a strip of
// logos -- a reader scanning for who this thing plugs into should not have to parse a joke first.
const HEAD = 'Partners';
const SUB = 'The bridge routes your assets travel, and the wallets that sign for them.';

// `logo` is relative to assets/ ; null means "no mark exists, use the wordmark".
const PARTNERS = [
  { name: 'Circle CCTP', logo: 'tokens/circle.png' },
  { name: 'NEAR Intents', logo: 'networks/near.png' },
  { name: 'LayerZero', logo: 'tokens/layerzero.png' },
  { name: 'Axelar', logo: 'tokens/axelar.png' },
  { name: 'THORChain', logo: 'networks/thorchain.png' },
  { name: 'LOBSTR', logo: 'wallets/lobstr.png' },
  { name: 'Xaman', logo: 'wallets/xaman.png' },
  { name: 'GemWallet', logo: 'wallets/gem.png' }
];

const ROOT = __dirname + '/..';
function haveLogo(rel) {
  if (!rel) return false;
  // Both trees, for the dist-is-not-synced reason in the header.
  return fs.existsSync(ROOT + '/assets/' + rel) && fs.existsSync(ROOT + '/dist/assets/' + rel);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const resolved = PARTNERS.map(p => ({ name: p.name, logo: haveLogo(p.logo) ? p.logo : null, want: p.logo }));
const missing = resolved.filter(p => !p.logo).map(p => p.name + ' (' + p.want + ')');

function item(p, dup) {
  // The logo is a real <img> child, which matters beyond decoration: the nav logo-healer repaints
  // any element whose text is 1-5 characters as a ticker badge, and an <img> child is one of the
  // few things it leaves alone. "Xaman" is exactly 5. Every item that has a logo is therefore
  // already safe; the ::before on .lx-pt-name covers the wordmark-only ones by the same mechanism.
  const img = p.logo
    ? '<img class="lx-pt-logo" src="/assets/' + esc(p.logo) + '" alt="" loading="lazy" '
      + 'width="26" height="26" decoding="async">'
    : '';
  return '<li class="lx-pt' + (p.logo ? '' : ' lx-pt-nologo') + '"'
    + (dup ? ' aria-hidden="true"' : '') + '>'
    + img + '<span class="lx-pt-name">' + esc(p.name) + '</span></li>';
}

const ONE = resolved.map(p => item(p, false)).join('');
const TWO = resolved.map(p => item(p, true)).join('');

const SECTION = '<section class="lx-partners" id="partners" aria-labelledby="lx-pt-h">'
  + '<div class="container">'
  + '<div class="lx-sec-head lx-pthead"><h2 id="lx-pt-h">' + HEAD + '</h2><p>' + SUB + '</p></div>'
  + '</div>'
  // The strip is full-bleed, OUTSIDE .container, so the logos run off both edges rather than
  // stopping at the text column -- a marquee that starts and ends inside a 1280px box reads as a
  // row that happens to move.
  + '<div class="lx-pt-strip" role="group" aria-label="Partners">'
  + '<ul class="lx-pt-track">' + ONE + TWO + '</ul>'
  + '</div>'
  + '</section>';

const CSS = '<style id="lx-partners-css">'
  + '.lx-partners{padding:76px 0 84px;position:relative;overflow:hidden}'
  // Left, on the same rail as every other section head on the page. _landingrefine.js left-aligns
  // #products and #networks by name and cannot know about a section that did not exist when it was
  // written, so this section aligns itself rather than waiting to be adopted. margin-inline:0 is
  // what undoes the inherited `margin:0 auto`; without it the block stays centred and only its text
  // moves. Same h2 scale as the others, stated in px for the 21.5px-root reason recorded there.
  + '.lx-partners .lx-sec-head{margin-bottom:38px;text-align:left;margin-inline:0;max-width:none}'
  + '.lx-partners .lx-sec-head h2{text-align:left;font-size:clamp(28px,2.6vw,42px);line-height:1.12;'
  + 'letter-spacing:-.022em;font-weight:800;margin:0 0 14px;text-wrap:balance}'
  + '.lx-partners .lx-sec-head p{text-align:left;margin-inline:0;max-width:58ch;'
  + 'font-size:clamp(15px,1.15vw,17.5px);line-height:1.6;color:var(--text-muted);text-wrap:pretty}'

  + '.lx-pt-strip{position:relative;width:100%;overflow:hidden}'
  // Fade both ends into the page background so items enter and leave instead of appearing and
  // vanishing at a hard edge. mask-image needs the -webkit- prefix for Safari.
  + '.lx-pt-strip{-webkit-mask-image:linear-gradient(90deg,transparent,#000 9%,#000 91%,transparent);'
  + 'mask-image:linear-gradient(90deg,transparent,#000 9%,#000 91%,transparent)}'

  + '.lx-pt-track{display:flex;align-items:center;gap:18px;margin:0;padding:0;list-style:none;'
  + 'width:max-content;animation:lx-pt-run 42s linear infinite;will-change:transform}'
  + '.lx-pt-strip:hover .lx-pt-track{animation-play-state:paused}'
  // -50% exactly, because the track holds the list twice: at -50% the second copy sits precisely
  // where the first started, so the restart is invisible. Any other value visibly jumps.
  + '@keyframes lx-pt-run{from{transform:translate3d(0,0,0)}'
  + 'to{transform:translate3d(-50%,0,0)}}'

  + '.lx-pt{flex:0 0 auto;display:inline-flex;align-items:center;gap:11px;'
  + 'padding:13px 22px;border:1px solid var(--border);border-radius:999px;'
  + 'background:var(--surface);white-space:nowrap;'
  + 'transition:border-color .22s ease,background-color .22s ease}'
  + '.lx-pt:hover{border-color:var(--border-strong);background:var(--surface-2)}'
  + '.lx-pt-logo{width:26px;height:26px;border-radius:50%;object-fit:contain;flex:0 0 auto;'
  + 'background:var(--surface-2)}'
  + '.lx-pt-name{font-size:15.5px;font-weight:700;letter-spacing:-.2px;color:var(--text)}'
  // An empty ::before is one of the escapes the nav logo-healer honours, and it costs nothing. It
  // is here for the wordmark-only items, which have no <img> child to protect them.
  + '.lx-pt-name::before{content:"";display:inline-block;width:0}'
  // Without a mark the wordmark carries the item on its own, so it gets the padding the logo would
  // have taken rather than sitting light next to its neighbours.
  + '.lx-pt-nologo{padding-left:24px;padding-right:24px}'

  + '@media (max-width:900px){'
  + '.lx-partners{padding:52px 0 58px}'
  + '.lx-partners .lx-sec-head{margin-bottom:28px}'
  + '.lx-pt-track{gap:12px;animation-duration:32s}'
  + '.lx-pt{padding:11px 17px;gap:9px}'
  + '.lx-pt-logo{width:22px;height:22px}'
  + '.lx-pt-name{font-size:14.5px}'
  + '}'

  // A band of logos sliding across the screen forever is precisely what this setting is for. The
  // strip becomes a normal horizontal scroller so the content is still all reachable.
  + '@media (prefers-reduced-motion:reduce){'
  + '.lx-pt-track{animation:none;width:auto}'
  + '.lx-pt-strip{overflow-x:auto;-webkit-mask-image:none;mask-image:none;'
  + 'scrollbar-width:none;padding-bottom:4px}'
  + '.lx-pt-strip::-webkit-scrollbar{display:none}'
  // The duplicate copy is decorative padding for a loop that is no longer running.
  + '.lx-pt[aria-hidden="true"]{display:none}'
  + '}'
  + '</st' + 'yle>';

// Depth walk: #products holds nested divs, so a non-greedy regex would close on the first </section>
// it finds inside rather than the section's own.
function elRange(html, startIdx, tag) {
  const re = new RegExp('<\\/?' + tag + '\\b', 'g');
  re.lastIndex = startIdx;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    if (m[0].charAt(1) === '/') { depth--; if (depth === 0) return html.indexOf('>', m.index) + 1; }
    else depth++;
  }
  return -1;
}

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

  // Undo any previous run first -- stylesheet and section both, and with /g so a page that ever
  // ended up with two copies is cleaned rather than left with one.
  html = html.replace(/<style id="lx-partners-css">[\s\S]*?<\/style>/g, '');
  for (let guard = 0; guard < 8; guard++) {
    const at = html.indexOf('<section class="lx-partners"');
    if (at < 0) break;
    const end = elRange(html, at, 'section');
    if (end < 0) { problems.push(p.key + ': previous partners section is not closed'); break; }
    html = html.slice(0, at) + html.slice(end);
  }
  if (problems.length) continue;

  // Insert directly after #products, which is where it was asked to go.
  const at = html.indexOf('<section class="block" id="products"');
  if (at < 0) { problems.push(p.key + ': products section not found'); continue; }
  const end = elRange(html, at, 'section');
  if (end < 0) { problems.push(p.key + ': products section is not closed'); continue; }

  html = html.slice(0, end) + SECTION + html.slice(end);

  // INTO <head>, NOT THE END OF <body>, and this is a flash fix rather than tidiness. These rules
  // restyle the hero -- headline size, and the two-column grid it sits in -- so a browser that
  // paints before the parser reaches an end-of-body <style> shows the ORIGINAL headline first and
  // then jumps to this one. That is the flash visible on reload, right on "Many networks. / One
  // Core.". Every other transform that ships CSS for this page puts it in <head> (see the
  // `</head>` replace in _launchpad.js); these four were the exception.
  //
  // GUARDRAILS B calls a visible swap during load a flash bug and makes catching it mandatory. It
  // was missed here because it was measured as layout-shift inside the hidden browser pane, which
  // does not paint on the same schedule -- CLS 0 there is not evidence of no flash on a real load.
  //
  // Source order drops with the move, so every rule in this file is written to win on SPECIFICITY
  // rather than on position; the computed sizes are re-checked on the built page after the change.
  // INJECTED AT THE END OF <body>, LIKE EVERY OTHER LAYER -- and deliberately not into <head>.
  // _externalize.js hoists every lx-* stylesheet into <head> on each build, as a group and in the
  // order it finds them, so injecting here is what keeps this layer in its NATURAL position in the
  // cascade relative to the layers it has to override.
  //
  // Injecting into <head> directly was tried first and is worse: this block then lands ahead of
  // every layer that still injects at end-of-body, i.e. it becomes the weakest instead of the
  // strongest. That silently cost two rules their overrides -- .lxu-cue reverted to 40px and the FAQ
  // heading re-centred -- and those were only the two that happened to be noticed.
  const bo = html.lastIndexOf('</body>');
  html = bo >= 0 ? html.slice(0, bo) + CSS + html.slice(bo) : html + CSS;

  json[p.key] = html;
  staged.push({ file: p.file, data, s, e, json, key: p.key });
}

if (problems.length) {
  console.error('partners: ABORT - nothing written.');
  problems.forEach(x => console.error('  ' + x));
  process.exit(1);
}
for (const st of staged) {
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.key + ': partners marquee inserted after #products ('
    + resolved.length + ' partners, ' + resolved.filter(p => p.logo).length + ' with logos)');
}
if (missing.length) {
  console.log('  NOTE - wordmark only, no logo file found in BOTH assets/ and dist/assets/:');
  missing.forEach(m => console.log('    ' + m));
}
console.log('partners: done on ' + staged.length + ' page(s)');
