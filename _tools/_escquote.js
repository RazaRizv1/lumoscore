// SECURITY: make every HTML-escaping esc() also escape the apostrophe.
//
// THE BUG. This codebase builds HTML by string concatenation, and it overwhelmingly uses SINGLE
// quotes for attributes -- "<a href='mailto:"+esc(m.from_addr)+"'>" and about thirty more like it.
// Every esc() escaped & < > and " but not ', so a value containing an apostrophe closed the attribute
// early and everything after it was parsed as more attributes. That is script execution, not a
// display glitch: `' onmouseover=...` is all it takes.
//
// WHERE IT ACTUALLY BITES. The worst site is the admin support inbox, which renders the From address
// of an inbound email into href='mailto:...'. That address is written by whoever sent the mail, and
// it lands in the one panel that holds every privilege on the platform. Others take asset codes, blog
// slugs and pool ids -- narrower, but narrow by luck rather than by construction.
//
// WHY A CONTAINER PATCH AND NOT TEN TRANSFORM RE-RUNS. Ten transforms each carry their own copy of
// esc(). Re-running all of them to change one character class would rebuild ten large script blocks
// for a one-line fix -- far more risk than the fix. The sources are corrected too, so a future re-run
// of any of them emits the fixed version; this brings the already-built pages up to it.
//
// HOW. Each esc() is found by brace matching, checked to be an HTML escaper (it must produce &lt; --
// which excludes _mc_engine's identically-named REGEX escaper, and the How-it-works modal's
// pass-through), and its return value is wrapped. Wrapping rather than editing the character class:
// the bodies differ in eleven ways across the tree and a wrapper is correct for all of them without
// having to parse any of them.
//
// String.fromCharCode(39) rather than a literal apostrophe on purpose. These bodies are re-emitted
// from host strings that are variously single-quoted, double-quoted and template literals, and an
// apostrophe -- or a backslash escape -- would have to be written differently in each. This contains
// neither.
//
// Idempotent: an esc() that already produces &#39; is skipped.
//
// Usage: node _tools/_escquote.js
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const TAIL = '.split(String.fromCharCode(39)).join("&#39;")';

// function esc(P){ return EXPR; }  -- every HTML escaper in the tree has this shape.
const SHAPE = /^function esc\((\w+)\)\s*\{\s*return\s+([\s\S]*?);?\s*\}$/;

function patch(html, stats) {
  let out = '', i = 0;
  for (;;) {
    const at = html.indexOf('function esc(', i);
    if (at < 0) { out += html.slice(i); break; }
    // brace-match to the end of the function
    let depth = 0, k = html.indexOf('{', at);
    if (k < 0) { out += html.slice(i, at + 13); i = at + 13; continue; }
    for (; k < html.length; k++) {
      if (html[k] === '{') depth++;
      else if (html[k] === '}') { depth--; if (!depth) { k++; break; } }
    }
    const fn = html.slice(at, k);
    out += html.slice(i, at);
    i = k;

    // Only real HTML escapers. The regex escaper and the pass-through never produce an entity.
    if (fn.indexOf('&lt;') < 0) { out += fn; stats.skipped++; continue; }
    if (fn.indexOf('&#39;') >= 0) { out += fn; stats.already++; continue; }
    const m = SHAPE.exec(fn);
    if (!m) { out += fn; stats.unrecognised.push(fn.slice(0, 120)); continue; }
    out += 'function esc(' + m[1] + '){return (' + m[2] + ')' + TAIL + ';}';
    stats.fixed++;
  }
  return out;
}

let pages = 0, containers = 0;
const stats = { fixed: 0, skipped: 0, already: 0, unrecognised: [] };
for (const chain of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain', 'stellar', 'xrpl']) {
  for (const dev of ['desktop', 'mobile']) {
    const file = `lumoscore-${chain}-${dev}.html`;
    let data; try { data = read(file); } catch (e) { continue; }
    let json, s, e; try { ({ json, s, e } = getContents(data)); } catch (err) { continue; }

    let changed = false;
    for (const key of Object.keys(json)) {
      if (typeof json[key] !== 'string') continue;
      const before = stats.fixed;
      const html = patch(json[key], stats);
      if (stats.fixed === before) continue;
      json[key] = html; changed = true; pages++;
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
console.log('esc quote: ' + stats.fixed + ' escaper(s) now escape the apostrophe, across '
  + pages + ' page key(s) in ' + containers + ' container(s)'
  + '  [not html escapers: ' + stats.skipped + ', already fixed: ' + stats.already + ']');
// Loud, not silent: a body that stops matching the expected shape must not be quietly left unfixed.
if (stats.unrecognised.length) {
  console.log('  ! ' + stats.unrecognised.length + ' esc() body(ies) NOT recognised and NOT fixed:');
  [...new Set(stats.unrecognised)].forEach((u) => console.log('    ' + u));
}
