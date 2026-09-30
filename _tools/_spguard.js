// Search popup: null-guard every element lookup in the design's own search-popup IIFE.
//
// The bug this fixes. The landing page threw on every load:
//     Uncaught TypeError: Cannot read properties of null (reading 'addEventListener')
//     at dist/assets/js/lx-830d59381d6a.js:331
// Line 331 is `clearBtn.addEventListener('click', ...)`. `clearBtn` is
// `document.getElementById('spClearFilter')`, and the landing page's search popup carries no filter
// pills and therefore no clear-filter button -- so the lookup is null and the whole injected
// <script> dies at that statement (GUARDRAILS C: one throw kills the entire script).
//
// Whose code this is. Neither _hdrsearch.js nor _heronet.js emits it -- both only mention
// `.hero-search input` in CSS or in a comment. The IIFE is the ORIGINAL design's code, stored inside
// each container's page HTML; _externalize.js later lifts it into a hashed file, which is why the
// stack trace points at dist/assets/js/lx-*.js. The only transform that has ever patched it is
// landing_fixes.js (the "empty before typing" early return in render()).
//
// Two copies, one already correct. Every page that carries this popup has the design's
// bottom-of-body wiring too -- the same logic written with `var` -- and THAT copy is already fully
// guarded: `if (input)`, `if (clearBtn)`, `if (!assetList) return;`. This transform brings the older
// `const` copy up to the same standard, statement for statement, so both copies degrade the same way.
// Nothing here invents a new pattern; it copies the one already shipping beside it.
//
// Which lookups can be null, and where (measured across all 14 containers, 60 pages carry this IIFE):
//   popup       #searchPopup   never missing  -- already has `if (!popup) return;`
//   input       #spSearchInput never missing  -- guarded anyway, it is reached from open()/close()
//   assetList   #spAssetList   never missing  -- guarded anyway
//   assetCount  #spAssetCount  never missing  -- guarded anyway
//   userList    #spUserList    MISSING ON ALL 60 -- harmless: declared and never used again, so the
//                              null never reaches a member access. Left exactly as the design wrote
//                              it (only ADD, never regress); noted here so nobody "fixes" it twice.
//   filterBtns  querySelectorAll -> always a NodeList, never null
//   clearBtn    #spClearFilter MISSING ON THE 7 DESKTOP LANDING PAGES -- this is the throw.
//
// Idempotence (landmine: a replacement that contains its own search string appends every build).
// Every search string is anchored on a newline PLUS its exact indent, and every replacement inserts
// `if (x) ` right after that indent -- so after one run the anchor no longer matches (the character
// after the indent is now `i`, not `c`/`a`/`i`nput). The one insertion that would still match its own
// anchor (`if (!assetList) return;`) is gated on the line already being there. Re-running is a no-op;
// two consecutive runs produce byte-identical containers.
//
// Scope. Replacements are applied to the IIFE's own text only, never to the whole page: a bare
// `input.value = '';` at some indent could well exist in another block, and the already-correct
// `var` copy must not be touched (it would grow `if (clearBtn) if (clearBtn) ...`).
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const MARK  = "const clearBtn = document.getElementById('spClearFilter');";
const START = "const popup = document.getElementById('searchPopup');";
const END   = "\n  })();";

// [search, replace, label]. Order does not matter; each anchor is unique within the IIFE.
const EDITS = [
  ["\n      setTimeout(() => input.focus(), 50);",
   "\n      setTimeout(() => { if (input) input.focus(); }, 50);", 'open:input.focus'],

  ["\n      input.value = '';",
   "\n      if (input) input.value = '';", 'close:input.value'],

  ["\n      clearBtn.style.display = 'none';",
   "\n      if (clearBtn) clearBtn.style.display = 'none';", "clearBtn.style='none'"],

  ["\n        clearBtn.style.display = activeFilter ? '' : 'none';",
   "\n        if (clearBtn) clearBtn.style.display = activeFilter ? '' : 'none';", 'pill:clearBtn.style'],

  ["\n      assetCount.textContent = `(${assets.length})`;",
   "\n      if (assetCount) assetCount.textContent = `(${assets.length})`;", 'render:assetCount'],

  ["\n    input.addEventListener('input', (e) => {",
   "\n    if (input) input.addEventListener('input', (e) => {", 'input.addEventListener'],

  ["\n    clearBtn.addEventListener('click', () => {",
   "\n    if (clearBtn) clearBtn.addEventListener('click', () => {", 'clearBtn.addEventListener'],
];

// Guards render()'s two `assetList.innerHTML = ...` writes in one statement, the way the `var` copy
// does. Inserted before the if/else rather than onto each branch: same effect, one line, and it keeps
// the two copies readable side by side.
const RENDER_ANCHOR = "\n      if (assets.length === 0) {";
const RENDER_GUARD  = "\n      if (!assetList) return;";

function guard(iife, tally) {
  for (const [s, r, label] of EDITS) {
    const n = iife.split(s).length - 1;
    if (n) { iife = iife.split(s).join(r); tally[label] = (tally[label] || 0) + n; }
  }
  if (iife.indexOf(RENDER_GUARD) < 0 && iife.indexOf(RENDER_ANCHOR) >= 0) {
    iife = iife.split(RENDER_ANCHOR).join(RENDER_GUARD + RENDER_ANCHOR);
    tally['render:assetList'] = (tally['render:assetList'] || 0) + 1;
  }
  return iife;
}

const dry = process.argv.includes('--dry');
// --emit <path>: dump the first transformed IIFE so it can be `node --check`ed BEFORE anything is
// written. GUARDRAILS C: checking this transform's own syntax says nothing about the browser code it
// emits, and a parse error there kills the whole injected script silently.
const emitAt = process.argv.indexOf('--emit');
const emit = emitAt > 0 ? process.argv[emitAt + 1] : null;
let emitted = false;
const tally = {};
let pages = 0, files = 0, skipped = [];

for (const chain of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain', 'stellar', 'xrpl']) {
  for (const variant of ['desktop', 'mobile']) {
    const file = 'lumoscore-' + chain + '-' + variant + '.html';
    let data;
    try { data = read(file); } catch (e) { continue; }
    const { json, s, e } = getContents(data);
    let changed = false;

    for (const k of Object.keys(json)) {
      const h = json[k];
      if (h.indexOf(MARK) < 0) continue;
      pages++;

      // Cut out the IIFE precisely: from its own `const popup = ...` line to the `  })();` that ends
      // it. Bailing out loudly rather than guessing -- a silent miss here is a page that keeps
      // throwing while the log says it was fixed.
      const mi = h.indexOf(MARK);
      const a = h.lastIndexOf(START, mi);
      const b = h.indexOf(END, mi);
      if (a < 0 || b < 0) { skipped.push(chain + '/' + variant + '/' + k + ' (IIFE bounds not found)'); continue; }

      const before = h.slice(a, b + END.length);
      const after = guard(before, tally);
      if (after === before) continue;
      if (emit && !emitted) { fs.writeFileSync(emit, '(function(){\n    ' + after + '\n', 'utf8'); emitted = true; }
      json[k] = h.slice(0, a) + after + h.slice(b + END.length);
      changed = true;
    }

    if (changed) {
      files++;
      if (!dry) {
        // landmine #9: `</` must go back escaped or the container truncates on the next read, and
        // containers are gitignored -- there is no undo.
        const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
        fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
      }
    }
  }
}

console.log((dry ? '[DRY] ' : '[WROTE] ') + 'search-popup guards: ' + pages + ' pages carry the IIFE, '
  + files + ' container(s) ' + (dry ? 'would change' : 'changed'));
for (const k of Object.keys(tally)) console.log('  ' + k + ': ' + tally[k]);
if (!Object.keys(tally).length) console.log('  nothing to do (already guarded)');
if (skipped.length) console.log('  SKIPPED: ' + skipped.join(', '));
