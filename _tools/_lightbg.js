// Light mode: the page background goes from #f7f8fa to pure white.
//
// The grey was reading as dull. It is a single variable -- --bg -- and every one of its 125
// occurrences across the built site sets exactly that, nothing else, so this is a value swap rather
// than a restyle. Checked before writing: no gradient, border or shadow uses the colour.
//
// WHAT IT COSTS, stated so it is a decision and not a surprise. In light mode --surface is ALREADY
// #ffffff, so the page and the cards on it are now the same colour. Cards do not disappear -- they
// carry a 1px #ececef border and a shadow, and those become the only thing separating them. Inset
// surfaces still read, because --surface-2 (#fafbfc, or #f0f1f4 on twelve pages) is darker than
// white and now sits BELOW the page rather than above it, which is the right way round for an inset.
//
// The one place this genuinely flattens is the landing page, which alternates sections between --bg
// and --bg-elev (#ffffff). Those two are now identical, so the alternation stops. Left alone rather
// than invented around: giving --bg-elev a tint would be choosing a new colour, which is not what was
// asked for.
//
// Idempotent by construction: once the value is gone there is nothing left to match.
//
// Usage: node _tools/_lightbg.js
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const FROM = 'f7f8fa';
const TO = 'ffffff';

// Only where it is assigned to --bg. A future stylesheet using the same grey for something else must
// not be swept up by this.
function swap(html) {
  let out = '';
  let i = 0;
  let hits = 0;
  for (;;) {
    const at = html.indexOf(FROM, i);
    if (at < 0) { out += html.slice(i); break; }
    // walk back over "#", whitespace and the colon to find the property name
    let j = at;
    if (html[j - 1] === '#') j--;
    while (j > 0 && (html[j - 1] === ' ' || html[j - 1] === '\t')) j--;
    const isBg = html.slice(Math.max(0, j - 5), j) === '--bg:';
    out += html.slice(i, at) + (isBg ? TO : FROM);
    if (isBg) hits++;
    i = at + FROM.length;
  }
  return { html: out, hits };
}

let pages = 0, total = 0, containers = 0;
for (const chain of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain', 'stellar', 'xrpl']) {
  for (const dev of ['desktop', 'mobile']) {
    const file = `lumoscore-${chain}-${dev}.html`;
    let data; try { data = read(file); } catch (e) { continue; }
    let json, s, e; try { ({ json, s, e } = getContents(data)); } catch (err) { continue; }

    let changed = false;
    for (const k of Object.keys(json)) {
      if (typeof json[k] !== 'string') continue;
      const r = swap(json[k]);
      if (!r.hits) continue;
      json[k] = r.html; changed = true; pages++; total += r.hits;
    }

    if (changed) {
      containers++;
      // </ must be re-escaped or the JSON blob is truncated at the first </script> inside it, and the
      // root containers are gitignored -- there is no undo.
      const ser = JSON.stringify(json).split('</').join('<' + B + '/');
      fs.writeFileSync(file, data.slice(0, s) + ser + data.slice(e), 'utf8');
    }
  }
}
console.log('light background: --bg #' + FROM + ' -> #' + TO + ' on ' + pages
  + ' page key(s) across ' + containers + ' container(s), ' + total + ' declaration(s)');
