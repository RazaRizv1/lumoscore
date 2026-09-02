// Replace the networks section with "Why Choose LumosCore?".
//
// The section was "Live on Stellar, with more to come." over three chain cards. It becomes four
// reasons instead. The section element itself is kept -- same tag, same id -- because the nav links to
// #networks and the anchor has to keep resolving; only its contents are rewritten.
//
// THE NAV LABEL IS CHANGED WITH IT. A link that says "Networks" and jumps to "Why Choose LumosCore?"
// is broken, and it is broken by this change specifically, so the label becomes "Why LumosCore" and
// the anchor stays #networks. Renaming the id instead would break every other transform that finds
// this section by it.
//
// EVERY NUMBER HERE IS CHECKED against the source of truth rather than written from memory:
// _feerate.js sets 0.2% / 0.1% with a 250,000 LUMOS threshold, and _faq.js states the same in words.
// If the fee ever moves, those two and this file have to move together.
//
// Re-injects: strips its own output first, so the copy can be edited and the transform re-run.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const HEAD = 'Why Choose LumosCore?';
const SUB = 'One place for everything multichain, without giving up custody of anything.';

const ICON = (paths) => '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" '
  + 'stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" '
  + 'aria-hidden="true">' + paths + '</svg>';

// Four reasons, in the order they were asked for. Each is one claim and one supporting sentence --
// the products grid above already lists features, so this section has to argue rather than enumerate.
const CARDS = [
  {
    key: 'all',
    icon: ICON('<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/>'
      + '<rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/>'),
    title: 'Everything in one place',
    body: 'Trade, provide liquidity, bridge, launch a token and manage your portfolio from a single '
      + 'interface. No hopping between a DEX, a bridge and three explorers to finish one job.'
  },
  {
    key: 'custody',
    icon: ICON('<path d="M12 2.5l7.5 3v6c0 4.6-3.1 8.6-7.5 10-4.4-1.4-7.5-5.4-7.5-10v-6z"/>'
      + '<path d="M9.4 12.2l1.9 1.9 3.6-3.9"/>'),
    title: 'Non-custodial and open source',
    body: 'Your keys never leave your wallet and LumosCore never holds your funds — there is nothing '
      + 'to deposit and nothing to withdraw. The code is open for anyone to read.'
  },
  {
    key: 'fees',
    icon: ICON('<path d="M20.6 13.4L13.4 20.6a2 2 0 0 1-2.83 0l-7.16-7.16A2 2 0 0 1 2.83 12V4a1 1 0 0 1 1-1h8a2 2 0 0 1 1.41.59l7.37 7.37a2 2 0 0 1 0 2.83z"/>'
      + '<circle cx="7.5" cy="7.5" r="1.3"/>'),
    title: '0.2% fees, or 0.1%',
    body: 'A flat 0.2% per trade, halved to 0.1% when you hold 250,000 LUMOS — pool-held LUMOS counts '
      + 'too. Limit orders are free, because an order that may never fill should not cost you anything.'
  },
  {
    key: 'chains',
    icon: ICON('<circle cx="12" cy="12" r="9"/><path d="M3.2 9.5h17.6M3.2 14.5h17.6"/>'
      + '<path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/>'),
    title: 'Built for more than one chain',
    body: 'Stellar today and XRP Ledger alongside it, with more to come. One account, one interface, '
      + 'and every new network arrives as somewhere else to explore rather than another tool to learn.'
  }
];

function cardHtml(c) {
  return '<div class="lx-why-card" data-why="' + c.key + '">'
    + '<span class="lx-why-ic">' + c.icon + '</span>'
    + '<h3>' + c.title + '</h3>'
    + '<p>' + c.body + '</p>'
    + '</div>';
}

const INNER = '<div class="container">'
  + '<div class="lx-sec-head lx-whyhead"><h2>' + HEAD + '</h2><p>' + SUB + '</p></div>'
  + '<div class="lx-why-grid">' + CARDS.map(cardHtml).join('') + '</div>'
  + '</div>';

const CSS = '<style id="lx-whylumos">'
  + '.lx-netline.lx-why{padding:88px 0 96px}'
  // Four cards on one row at desktop, two at tablet, one on phones. Equal columns so the row reads as
  // a set -- the products grid above is 3-up, so 4-up here keeps them from looking like the same block
  // twice.
  + '.lx-why-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;align-items:stretch}'
  + '.lx-why-card{position:relative;display:flex;flex-direction:column;padding:28px 26px 30px;'
  + 'border-radius:20px;border:1px solid var(--border);background:var(--surface);'
  + 'transition:border-color .2s ease,transform .2s ease}'
  // A quiet lift on hover. These are not links, so nothing here should suggest they are -- no accent
  // border, no cursor change, just enough response to stop the row feeling inert.
  + '.lx-why-card:hover{transform:translateY(-3px);border-color:var(--border-strong,#34343c)}'
  + '.lx-why-ic{display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;'
  + 'border-radius:14px;margin-bottom:20px;color:var(--accent);'
  + 'background:rgba(234,106,44,.12);border:1px solid rgba(234,106,44,.22)}'
  + '.lx-why-card h3{font-size:19.5px;font-weight:800;letter-spacing:-.3px;line-height:1.25;'
  + 'margin:0 0 10px;color:var(--text)}'
  + '.lx-why-card p{font-size:15px;line-height:1.62;color:var(--text-muted);margin:0}'
  // The fee card is the one with a number in it, so the number gets to be the thing you see.
  + '.lx-why-card[data-why="fees"] h3{font-family:"JetBrains Mono",ui-monospace,monospace;'
  + 'font-size:18.5px;letter-spacing:-.5px}'
  + '@media (max-width:1100px){.lx-why-grid{grid-template-columns:repeat(2,1fr);gap:18px}'
  + '.lx-netline.lx-why{padding:72px 0 78px}}'
  + '@media (max-width:900px){.lx-why-grid{grid-template-columns:1fr;gap:14px}'
  + '.lx-netline.lx-why{padding:54px 0 58px}'
  + '.lx-why-card{padding:22px 20px 24px;border-radius:16px}'
  + '.lx-why-ic{width:42px;height:42px;border-radius:12px;margin-bottom:15px}'
  + '.lx-why-ic svg{width:22px;height:22px}'
  + '.lx-why-card h3{font-size:17.5px}'
  + '.lx-why-card[data-why="fees"] h3{font-size:17px}'
  + '.lx-why-card p{font-size:14.5px}}'
  + '@media (prefers-reduced-motion:reduce){.lx-why-card,.lx-why-card:hover{transition:none;'
  + 'transform:none}}'
  + '</st' + 'yle>';

// Depth walk, so the section's own nested divs cannot confuse the end of it.
function elRange(html, startIdx, tag) {
  const re = new RegExp('<\\/?' + tag + '\\b', 'g');
  re.lastIndex = startIdx;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    if (m[0].charAt(1) === '/') { depth--; if (depth === 0) return { start: startIdx, end: html.indexOf('>', m.index) + 1 }; }
    else depth++;
  }
  return null;
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

  html = html.replace(/<style id="lx-whylumos">[\s\S]*?<\/style>/g, '');

  const at = html.indexOf('<section class="lx-netline"');
  if (at < 0) { problems.push(p.key + ': networks section not found'); continue; }
  if (html.indexOf('<section class="lx-netline"', at + 1) >= 0) {
    problems.push(p.key + ': more than one networks section'); continue;
  }
  const r = elRange(html, at, 'section');
  if (!r) { problems.push(p.key + ': networks section is not closed'); continue; }

  // The id is read off the page rather than assumed: the nav anchor depends on it, and writing a
  // guessed id here would break the link silently.
  const idM = /<section class="lx-netline[^"]*"([^>]*)>/.exec(html.slice(at, at + 300));
  const attrs = idM ? idM[1] : '';
  if (attrs.indexOf('id=') < 0) { problems.push(p.key + ': networks section has no id to preserve'); continue; }

  html = html.slice(0, r.start)
    + '<section class="lx-netline lx-why"' + attrs + '>' + INNER + '</section>'
    + html.slice(r.end);

  // ---- the nav label. "Networks" pointing at "Why Choose LumosCore?" is broken by this change, so
  // it changes with it. Desktop nav links only; the mobile slide menu is handled by its own markup
  // and is left alone unless it carries the same anchor text.
  const NAV_FROM = '<a href="#networks">Networks</a>';
  const NAV_TO = '<a href="#networks">Why LumosCore</a>';
  const navN = (html.match(/<a href="#networks">Networks<\/a>/g) || []).length;
  if (navN > 0) html = html.split(NAV_FROM).join(NAV_TO);

  const bo = html.lastIndexOf('</body>');
  html = bo >= 0 ? html.slice(0, bo) + CSS + html.slice(bo) : html + CSS;

  json[p.key] = html;
  staged.push({ file: p.file, data, s, e, json, key: p.key, navN });
}

if (problems.length) {
  console.error('why-lumoscore: ABORT — nothing written.');
  problems.forEach(x => console.error('  ' + x));
  process.exit(1);
}
for (const st of staged) {
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.key + ': networks section -> Why Choose LumosCore ('
    + CARDS.length + ' reasons), ' + st.navN + ' nav label(s) renamed');
}
console.log('why-lumoscore: done on ' + staged.length + ' page(s)');
