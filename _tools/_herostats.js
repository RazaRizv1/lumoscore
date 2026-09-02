// A row of live figures under the hero search field.
//
// The hero's empty space is BELOW the field, not above it -- measured at 310px between the field and
// the scroll cue on desktop and ~350px on a phone. A subheading above the field would have made the
// top denser and left the bottom exactly as empty, so the figures go underneath instead.
//
// No box, no border, no panel. Two boxes have already been tried in this hero and removed; this is
// type on the rays and nothing else.
//
// WHOSE NUMBERS THESE ARE. /lxapi/netstats reports the STELLAR NETWORK, not LumosCore: 524k trades a
// day is the chain's, not ours. Presented under an eyebrow that says so, because a bare "524,418
// trades" in a LumosCore hero reads as LumosCore's own volume, and that would be a false claim on the
// front page of a site handling real money. If platform-level figures are ever wanted here they need
// a platform-level source; there is no honest way to derive them from this endpoint.
//
// NOTHING IS RENDERED UNTIL THE REAL VALUES ARRIVE. The block ships hidden and is revealed only once
// the fetch resolves with usable numbers; a failed or empty response leaves it hidden for good. There
// are no placeholder digits at any point -- a number that is wrong for a second is still a number
// somebody can screenshot.
//
// Re-injects: strips its own output first, so this can be tuned by editing and re-running.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// [ key in the netstats payload, label ]. Three, not five: at hero scale a longer row starts to read
// as a dashboard strip, which is the thing the design already has further down.
const STATS = [
  ['assets', 'Assets'],
  ['trades', 'Trades · 24h'],
  ['accounts', 'Accounts'],
];

// The mark comes from _netlogos.json, the same file every other Stellar logo on this page is drawn
// from, so the hero cannot end up showing a different one from the rest of the site.
const NETLOGOS = require(__dirname + '/_netlogos.json');

const MARKUP = '<div class="lx-herostats" data-lxnonav="1" hidden>'
  + '<span class="lx-hst-eyebrow">On the '
  + '<span class="lx-hst-chain"><i class="lx-hst-logo">' + NETLOGOS[0].logo + '</i>Stellar</span>'
  + ' network</span>'
  + '<div class="lx-hst-row">'
  + STATS.map(([k, label]) =>
      '<div class="lx-hst"><b class="lx-hst-v" data-stat="' + k + '"></b>'
      + '<span class="lx-hst-l">' + label + '</span></div>').join('')
  + '</div></div>';

const CSS = '<style id="lx-herostats-css">'
  + '.lx-herostats{margin:0 auto;text-align:center;opacity:0;transition:opacity .5s ease}'
  + '.lx-herostats.is-in{opacity:1}'
  + '@media (prefers-reduced-motion:reduce){.lx-herostats{transition:none}}'
  // 15px as asked. The tracking comes down from .18em to .1em with it: .18em was set for an 11px
  // label, and letter-spacing is relative to the font size, so keeping it would have widened the line
  // by ~40px on top of the size increase and pushed it off a 320px screen.
  + '.lx-hst-eyebrow{display:block;font-size:15px;font-weight:800;letter-spacing:.1em;'
  + 'text-transform:uppercase;color:var(--text-soft);margin-bottom:20px}'
  // The chain name and its mark are held together so the pair never breaks across a line, and the
  // whole eyebrow can still wrap between "On the" and "network" if a screen is narrow enough.
  + '.lx-hst-chain{display:inline-flex;align-items:center;gap:7px;white-space:nowrap;'
  + 'vertical-align:middle;color:var(--text-muted)}'
  + '.lx-hst-logo{display:inline-flex;width:19px;height:19px;flex:0 0 auto}'
  // The mark is a circular badge in the source file, so it is not letter-spaced along with the text --
  // the gap above owns that spacing instead.
  + '.lx-hst-logo svg{width:100%;height:100%;display:block;border-radius:50%}'
  // No dividers between the figures. The rays radiate from directly behind this row, and every rule
  // tried in this hero has ended up cutting across them; space separates these well enough.
  + '.lx-hst-row{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:center;gap:16px 62px}'
  + '.lx-hst{display:flex;flex-direction:column;align-items:center;gap:7px}'
  // Mono for the values, which is what the rest of the product uses for figures, and tabular-nums so
  // the row does not jitter when a number ticks over.
  + '.lx-hst-v{font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;'
  + 'font-size:30px;font-weight:700;letter-spacing:-1px;line-height:1;color:var(--text);'
  + 'font-variant-numeric:tabular-nums}'
  + '.lx-hst-l{font-size:12.5px;font-weight:700;letter-spacing:.06em;color:var(--text-soft)}'
  + '@media (max-width:1100px){.lx-hst-row{gap:14px 46px}.lx-hst-v{font-size:26px}}'
  + '@media (max-width:900px){.lx-herostats{margin-top:0}'
  + '.lx-hst-eyebrow{font-size:13.5px;letter-spacing:.08em;margin-bottom:15px}'
  + '.lx-hst-logo{width:17px;height:17px}.lx-hst-chain{gap:6px}'
  + '.lx-hst-row{gap:12px 30px}'
  + '.lx-hst-v{font-size:21px;letter-spacing:-.6px}'
  + '.lx-hst-l{font-size:11px}}'
  + '@media (max-width:360px){.lx-hst-row{gap:10px 20px}.lx-hst-v{font-size:18px}'
  + '.lx-hst-l{font-size:10px}}'
  // Short handsets have no room to spare -- the cue has to stay above the fold, and that matters more
  // than this row does.
  + '@media (max-width:900px) and (max-height:680px){.lx-herostats{display:none}}'
  + '</st' + 'yle>';

const JS = '<script id="lx-herostats-js">(function(){'
  + 'if(window.__lxHeroStats)return;window.__lxHeroStats=1;'
  // Compact above a million, grouped below it. 10,905,991 as "10.9M" is readable at a glance; as
  // "10,905,991" it is a licence plate.
  + 'function fmt(n){if(!(n>0))return null;'
  + 'if(n>=1e9)return (n/1e9).toFixed(1).replace(/\\.0$/,"")+"B";'
  + 'if(n>=1e6)return (n/1e6).toFixed(1).replace(/\\.0$/,"")+"M";'
  + 'return n.toLocaleString("en-US");}'
  + 'function boot(){'
  + 'var box=document.querySelector(".lx-herostats");if(!box)return;'
  + 'fetch("/lxapi/netstats",{headers:{accept:"application/json"}}).then(function(r){'
  + 'if(!r.ok)throw 0;return r.json();}).then(function(d){'
  + 'if(!d||d.error)throw 0;'
  + 'var cells=box.querySelectorAll("[data-stat]"),filled=0;'
  + 'for(var i=0;i<cells.length;i++){'
  + 'var v=fmt(+d[cells[i].getAttribute("data-stat")]);'
  + 'if(v){cells[i].textContent=v;filled++;}else{'
  // A figure that did not arrive takes its label with it rather than leaving a labelled blank.
  + 'var cell=cells[i].parentNode;if(cell&&cell.parentNode)cell.parentNode.removeChild(cell);}}'
  // All or nothing below two: one lonely number under "On the Stellar network" is worse than no row.
  + 'if(filled<2)return;'
  + 'box.hidden=false;'
  + 'requestAnimationFrame(function(){box.classList.add("is-in");});'
  + '}).catch(function(){});}'
  + 'if(document.readyState!=="loading")setTimeout(boot,0);'
  + 'else document.addEventListener("DOMContentLoaded",boot);'
  + '})();</scr' + 'ipt>';

// Depth walk: the block is a div holding a div, so a non-greedy regex would cut it in half.
function cutElement(html, openMarker, tag) {
  let out = html;
  for (let guard = 0; guard < 20; guard++) {
    const at = out.indexOf(openMarker);
    if (at < 0) return out;
    const re = new RegExp('<' + tag + '\\b|</' + tag + '>', 'g');
    re.lastIndex = at;
    let depth = 0, m, end = -1;
    while ((m = re.exec(out))) {
      if (m[0].charAt(1) === '/') { depth--; if (depth === 0) { end = m.index + m[0].length; break; } }
      else depth++;
    }
    if (end < 0) return out;
    out = out.slice(0, at) + out.slice(end);
  }
  return out;
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

  html = html
    .replace(/<style id="lx-herostats-css">[\s\S]*?<\/style>/g, '')
    .replace(/<script id="lx-herostats-js">[\s\S]*?<\/script>/g, '');
  html = cutElement(html, '<div class="lx-herostats"', 'div');
  if (html.indexOf('lx-herostats') >= 0) { problems.push(p.key + ': stats block survived the strip'); continue; }

  // Anchored to the end of the search wrapper, so the row lands under the field on both builds
  // whatever else the hero holds.
  const swAt = html.indexOf('<div class="hero-search-wrap">');
  if (swAt < 0) { problems.push(p.key + ': hero search wrap not found'); continue; }
  if (html.indexOf('<div class="hero-search-wrap">', swAt + 1) >= 0) {
    problems.push(p.key + ': more than one hero search wrap'); continue;
  }
  const rest = cutElement(html.slice(swAt), '<div class="hero-search-wrap">', 'div');
  const swEnd = swAt + (html.length - swAt - rest.length);
  html = html.slice(0, swEnd) + MARKUP + html.slice(swEnd);

  const bo = html.lastIndexOf('</body>');
  html = bo >= 0 ? html.slice(0, bo) + CSS + JS + html.slice(bo) : html + CSS + JS;

  json[p.key] = html;
  staged.push({ file: p.file, data, s, e, json, key: p.key });
}

if (problems.length) {
  console.error('hero stats: ABORT — nothing written.');
  problems.forEach(x => console.error('  ' + x));
  process.exit(1);
}
for (const st of staged) {
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.key + ': ' + STATS.length + ' live figures under the search field');
}
console.log('hero stats: done on ' + staged.length + ' page(s)');
