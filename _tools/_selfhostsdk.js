// SECURITY: take the Stellar libraries off the public CDN and serve them from our own origin.
//
// THE PROBLEM. Every page that touches the chain pulled @stellar/stellar-sdk@13.3.0 and
// @stellar/stellar-base@13.0.1 from cdn.jsdelivr.net at runtime, with no integrity attribute and no
// Content-Security-Policy anywhere on the site. Those are the libraries that BUILD the transaction a
// user is about to sign with real mainnet funds. If the CDN were compromised, or a user's DNS or
// network path intercepted, substituted code could change the destination, amount or asset before the
// wallet ever renders its confirmation -- and the wallet would faithfully show, and the user approve,
// the attacker's transaction. Keys never leaving the wallet is a real guarantee, but it only covers
// the signing; it says nothing about what was composed to be signed.
//
// WHY SELF-HOSTING RATHER THAN AN INTEGRITY ATTRIBUTE. A hash pins the bytes, which closes the
// substitution hole, but it keeps a third party in the critical path and adds a hard failure mode: if
// jsdelivr ever re-serves that version differently the hash stops matching and the signing path stops
// working entirely. Serving the file ourselves removes the third party instead of verifying it, and
// /assets/* is already served immutable by _headers. Same-origin also means no integrity attribute is
// needed and no CSP exception has to be carved for a CDN later.
//
// HOW, without touching the ten loaders. Ten different transforms each build their own script element,
// several of them among the largest and most landmine-ridden files in the tree, and re-running all ten
// to change one string would be a far bigger change than this is. The URL is a plain string in the
// stored page, so this swaps the string -- the loaders keep working exactly as written, they just
// point somewhere else.
//
// The files were fetched and checked before being committed: byte-identical from jsdelivr AND unpkg
// independently, sizes and payload sanity confirmed, and the version pinned against the npm registry.
// See the scratch fetch script referenced in the commit.
//
// Idempotent: once the CDN url is gone there is nothing left to match.
//
// Usage: node _tools/_selfhostsdk.js
const fs = require('fs');
const path = require('path');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// ⚠ THE LEFT COLUMN MUST STAY A CDN URL. It is the search pattern, not a setting -- rewriting it to
// the local path (which a bulk find-and-replace across _tools/ will happily do, and once did) turns
// every entry into a no-op and this file silently stops swapping anything.
const SWAPS = [
  ['https://cdn.jsdelivr.net/npm/@stellar/stellar-sdk@13.3.0/dist/stellar-sdk.min.js',
   '/assets/vendor/stellar-sdk-13.3.0.min.js'],
  ['https://cdn.jsdelivr.net/npm/@stellar/stellar-base@13.0.1/dist/stellar-base.min.js',
   '/assets/vendor/stellar-base-13.0.1.min.js'],
];

// The swap is only safe if the file is actually there to serve. A page pointing at a 404 would break
// every wallet operation on it, so this refuses to run rather than shipping that.
const VENDOR = path.join(__dirname, '..', 'dist', 'assets', 'vendor');
for (const [, local] of SWAPS) {
  const f = path.join(VENDOR, path.basename(local));
  if (!fs.existsSync(f)) {
    console.error('self-host sdk: MISSING ' + f + ' — refusing to rewrite the loaders');
    process.exit(1);
  }
  const n = fs.statSync(f).size;
  if (n < 100000) {
    console.error('self-host sdk: ' + path.basename(local) + ' is only ' + n + ' bytes — refusing');
    process.exit(1);
  }
}

let pages = 0, hits = 0, containers = 0;
for (const chain of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain', 'stellar', 'xrpl']) {
  for (const dev of ['desktop', 'mobile']) {
    const file = `lumoscore-${chain}-${dev}.html`;
    let data; try { data = read(file); } catch (e) { continue; }
    let json, s, e; try { ({ json, s, e } = getContents(data)); } catch (err) { continue; }

    let changed = false;
    for (const k of Object.keys(json)) {
      if (typeof json[k] !== 'string') continue;
      let p = json[k], n = 0;
      for (const [from, to] of SWAPS) {
        const parts = p.split(from);
        if (parts.length > 1) { n += parts.length - 1; p = parts.join(to); }
      }
      if (!n) continue;
      json[k] = p; changed = true; pages++; hits += n;
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
console.log('self-host sdk: ' + hits + ' loader url(s) moved to /assets/vendor on '
  + pages + ' page key(s) across ' + containers + ' container(s)');
