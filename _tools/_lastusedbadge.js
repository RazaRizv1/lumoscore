// The "Last used" tag never appeared in the Connect Wallet modal on desktop.
//
// THE CAUSE. Two different tags share one class. renderList() emits the availability tag as
//     (w.installed?'<span class="lxw-badge">Installed</span>':'')
// and __lxMarkLastUsed() then looks for the recency tag with
//     var b = rows[i].querySelector('.lxw-badge');
//     if (on && !b) { ...add "Last used"... } else if (!on && b) { b.remove(); }
// which cannot tell one from the other. w.installed is only ever true for a browser extension, so on a
// phone no row carries that tag, the query finds nothing, and the feature works -- which is exactly
// why this looked like a desktop-only bug.
//
// Reproduced against the real function in the real modal before changing anything, by giving a row the
// same tag renderList would and calling __lxMarkLastUsed():
//   last used, NOT installed  -> ["Last used"]     the phone, working
//   last used AND installed   -> ["Installed"]     the report: no "Last used" at all
//   installed, not last used  -> []                the second bug: "Installed" was DELETED
// The third case was not reported and is arguably worse -- every wallet the visitor has installed
// silently lost its tag as soon as any wallet had been used before.
//
// THE FIX is to stop the two tags sharing an identity: the availability tag gains .lxw-inst, the
// recency tag is created with .lxw-last, and the query asks for .lxw-last. Both keep .lxw-badge so
// neither changes appearance.
//
// When a row is both, it shows "Last used" only. One tag per row is the design's rhythm and the row has
// no space for two; "Last used" is also the more useful of the two, and it already implies the wallet
// is installed.
//
// Done as string surgery on the containers rather than by hand because the containers are gitignored:
// this way the change is reproducible after a restore. Four short exact replacements rather than one
// multi-line block, so reformatting elsewhere in that script cannot silently stop it matching.
//
// Idempotent: every FROM below disappears once applied, and the whole pass is skipped for a page that
// already carries lxw-last.
//
// Usage: node _tools/_lastusedbadge.js
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const EDITS = [
  // 1. the availability tag becomes identifiable
  [`(w.installed?'<span class="lxw-badge">Installed</span>':'')`,
   `(w.installed?'<span class="lxw-badge lxw-inst">Installed</span>':'')`],
  // 2. look for the recency tag, not "whichever tag is here"
  [`rows[i].querySelector('.lxw-badge')`,
   `rows[i].querySelector('.lxw-last')`],
  // 3. and create it as one
  [`sp.className='lxw-badge';`,
   `sp.className='lxw-badge lxw-last';`],
  // 4. one tag per row: the recency tag supersedes the availability tag
  [`sp.textContent='Last used';`,
   `sp.textContent='Last used';var iB=rows[i].querySelector('.lxw-inst');`
   + `if(iB&&iB.parentNode)iB.parentNode.removeChild(iB);`],
];

let pages = 0, containers = 0, edits = 0, already = 0;
for (const chain of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain', 'stellar', 'xrpl']) {
  for (const dev of ['desktop', 'mobile']) {
    const file = `lumoscore-${chain}-${dev}.html`;
    let data; try { data = read(file); } catch (e) { continue; }
    let json, s, e; try { ({ json, s, e } = getContents(data)); } catch (err) { continue; }

    let changed = false;
    for (const key of Object.keys(json)) {
      let p = json[key];
      if (typeof p !== 'string') continue;
      if (p.indexOf('lxw-last') >= 0) { already++; continue; }
      let n = 0;
      for (const [from, to] of EDITS) {
        const parts = p.split(from);
        if (parts.length < 2) continue;
        n += parts.length - 1;
        p = parts.join(to);
      }
      if (!n) continue;
      json[key] = p; changed = true; pages++; edits += n;
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
console.log('last-used badge: ' + edits + ' edit(s) on ' + pages + ' page key(s) across '
  + containers + ' container(s)' + (already ? '  [' + already + ' already done]' : ''));
