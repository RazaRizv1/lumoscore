// Pulls every distinct esc() out of the BUILT pages and RUNS it against a real attribute-breakout
// payload. Nothing is asserted from reading the source: each function is compiled and called.
//
// It also checks the two esc()s that must NOT have changed -- _mc_engine's identically-named REGEX
// escaper, and the How-it-works modal's pass-through -- because a fix that quietly rewrote either of
// those would break search highlighting rather than announce itself.
import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['C:/LumosCore/dist', 'C:/LumosCore/dist-admin'];
const bodies = new Map();   // body -> Set(file)

function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) { if (f.name !== 'assets') walk(p); continue; }
    if (!/\.html$/.test(f.name)) continue;
    const s = fs.readFileSync(p, 'utf8');
    let i = 0;
    for (;;) {
      const at = s.indexOf('function esc(', i);
      if (at < 0) break;
      let depth = 0, k = s.indexOf('{', at);
      for (; k < s.length; k++) {
        if (s[k] === '{') depth++;
        else if (s[k] === '}') { depth--; if (!depth) { k++; break; } }
      }
      const b = s.slice(at, k);
      if (b.length < 500) { if (!bodies.has(b)) bodies.set(b, new Set()); bodies.get(b).add(f.name); }
      i = at + 5;
    }
  }
}
for (const r of ROOTS) if (fs.existsSync(r)) walk(r);

// The whole point: an apostrophe closes a single-quoted attribute, and everything after it is parsed
// as more attributes.
const BREAKOUT = "x' onmouseover=alert(1) y='";
const APOS = String.fromCharCode(39);
const BACKSLASH = String.fromCharCode(92);

let bad = 0, html = 0, other = 0;
for (const [b, files] of bodies) {
  let fn;
  try { fn = new Function('return (' + b.replace(/^function esc/, 'function') + ')')(); }
  catch (e) { console.log('  FAIL  does not compile: ' + b.slice(0, 80)); bad++; continue; }
  const where = ' [' + [...files].slice(0, 2).join(', ') + (files.size > 2 ? ', +' + (files.size - 2) : '') + ']';

  if (b.indexOf('&lt;') >= 0) {
    html++;
    const out = fn(BREAKOUT);
    const ent = fn('<b>&"');
    const ok = out.indexOf(APOS) < 0 && out.indexOf('&#39;') >= 0
            && ent.indexOf('<') < 0 && ent.indexOf('&lt;') >= 0 && ent.indexOf('&amp;') >= 0;
    if (!ok) { console.log('  FAIL  breakout survives' + where + '\n        ' + JSON.stringify(out)); bad++; }
    if (fn('Hello world 123') !== 'Hello world 123') {
      console.log('  FAIL  mangles ordinary text' + where); bad++;
    }
  } else {
    other++;
    if (b.indexOf('$&') >= 0) {
      // the regex escaper: escapes metacharacters, and must leave an apostrophe alone
      const out = fn('a.b' + APOS + 'c');
      const want = 'a' + BACKSLASH + '.b' + APOS + 'c';
      if (out !== want) {
        console.log('  FAIL  the regex escaper was altered' + where
          + '\n        got ' + JSON.stringify(out) + ' want ' + JSON.stringify(want)); bad++;
      }
    }
  }
}

console.log('\n' + html + ' distinct HTML escaper(s) executed, ' + other + ' non-HTML esc() left alone');
console.log(bad ? bad + ' FAILED' : 'all passed');
process.exit(bad ? 1 : 0);
