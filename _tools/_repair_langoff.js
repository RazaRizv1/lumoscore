// ONE-TIME REPAIR: put back every <script> that the old _langoff.js deleted as collateral.
//
// WHAT HAPPENED
// _langoff.js removed the locale layer with regexes shaped like
//     /<script>\s*\n?\(function\(\) \{[\s\S]*?K_LANG = 'lumos\.locale\.lang'[\s\S]*?<\/script>/
// — a generic opener, then a lazy span to a landmark. A lazy span does not respect `</script>`, so the
// match started at the EARLIEST `<script>(function() {` that could still reach the landmark and deleted
// every script in between. Across 40 built pages that destroyed 83 unrelated scripts: the card-reveal
// driver (which is the only thing that clears `opacity:0` off .quick-card/.market-card/.product-card,
// so those pages rendered blank for anyone not in prefers-reduced-motion), and on mobile the slide
// menu, the search popup and window.showToast, among others.
//
// The containers are gitignored, so the loss is not recoverable from them. It IS recoverable from the
// last build before the damage. This restores, per page, exactly the set of scripts that the damaging
// commit removed, minus the four locale scripts that were meant to go, and puts each one back at its
// original position by anchoring to its surviving neighbour.
//
// Idempotent: re-running finds everything present and reports 0.
// _langoff.js now cuts block-wise and asserts nothing but its targets disappeared, so this cannot recur.
const { execSync } = require('child_process');
const { read, getContents, writeContents } = require(__dirname + '/lib.js');
const crypto = require('crypto');

// NB: "^" is an escape character in cmd.exe, which is what execSync uses on Windows, so "64014c4^"
// silently resolves to 64014c4 itself and every comparison comes back empty. Always "~1".
const PRE = '64014c4~1';   // last good build
const BAD = '64014c4';     // the build that shipped the damage

const isIntended = s =>
  s.attrs.indexOf('data-lumos-locale') >= 0 ||
  s.body.indexOf("K_LANG = 'lumos.locale.lang'") >= 0 ||
  s.body.indexOf('__lumosApplyLocale') >= 0 ||
  s.body.indexOf('getElementById("ftLangBtn")') >= 0;

function parse(html) {
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/g; const out = []; let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '', body = m[2];
    out.push({ full: m[0], attrs, body, hash: crypto.createHash('sha1').update(attrs + body).digest('hex') });
  }
  return out;
}
function show(rev, page) {
  try { return execSync(`git show ${rev}:dist/${page}`, { maxBuffer: 1e9, cwd: 'C:/LumosCore' }).toString(); }
  catch (e) { return null; }
}

let restored = 0, already = 0, pages = 0;
const unsourced = [];

for (const dev of ['desktop', 'mobile']) {
  const file = `lumoscore-aptos-${dev}.html`;
  try { read(file); } catch (e) { continue; }

  writeContents(file, json => {
    for (const k of Object.keys(json)) {
      const pre = show(PRE, k), bad = show(BAD, k);
      if (!pre || !bad) continue;                 // page did not exist then — nothing to repair

      const preList = parse(pre);
      const badHashes = parse(bad).map(s => s.hash);
      // exactly what that commit removed, in original order
      const pool = badHashes.slice();
      const removed = preList.filter(s => {
        const i = pool.indexOf(s.hash);
        if (i >= 0) { pool.splice(i, 1); return false; }
        return true;
      }).filter(s => !isIntended(s));
      if (!removed.length) continue;

      let h = json[k], touched = false;
      for (const s of removed) {
        if (h.indexOf(s.full) >= 0) { already++; continue; }

        // Put it back where it was: anchor to the nearest surviving neighbour in the pristine order,
        // preferring the script before it, then the one after it, then end-of-body as a last resort.
        const idx = preList.indexOf(s);
        let at = -1, after = true;
        for (let i = idx - 1; i >= 0 && at < 0; i--) {
          const p = h.indexOf(preList[i].full);
          if (p >= 0) { at = p + preList[i].full.length; }
        }
        if (at < 0) {
          for (let i = idx + 1; i < preList.length && at < 0; i++) {
            const p = h.indexOf(preList[i].full);
            if (p >= 0) { at = p; after = false; }
          }
        }
        if (at < 0) { at = h.lastIndexOf('</body>'); after = false; }
        if (at < 0) { unsourced.push(k); continue; }

        h = h.slice(0, at) + s.full + h.slice(at);
        touched = true; restored++;
      }
      if (touched) { json[k] = h; pages++; }
    }
  });
}

console.log(`langoff repair: restored ${restored} scripts across ${pages} page keys (${already} already present)`);
if (unsourced.length) console.log('  COULD NOT PLACE: ' + unsourced.join(', '));
