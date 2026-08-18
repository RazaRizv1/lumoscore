// Turn the launchpad's browser-held token icons into files this site actually serves.
//
// WHY THIS EXISTS. _launchpad.js stores an uploaded token icon only in localStorage
// ("lumos.launch.icons", keyed CODE-ISSUER, last 12 kept). That is the minter's browser and nowhere
// else: no other visitor, device or wallet can ever see it, and the 13th mint silently evicts the first.
// Meanwhile functions/.well-known/stellar.toml.js -- the document that publishes an asset's logo to the
// whole Stellar ecosystem -- sources its image from stellar.expert, and stellar.expert fills that field
// by reading OUR toml. Neither side can bootstrap, so every launchpad mint publishes no image at all
// (measured: 10 [[CURRENCIES]] blocks, 1 image= line, and that one hardcoded).
//
// This script breaks the loop by writing the icons somewhere we control.
//
// Input:  the JSON produced by the console snippet (the raw localStorage value).
// Output: assets/tokens/<CODE>-<ISSUER>.<ext>  AND  dist/assets/tokens/<CODE>-<ISSUER>.<ext>
//         plus assets/tokens/launchpad-icons.json, the manifest the toml Function reads.
//
// BOTH directories, deliberately. dist/ is what Cloudflare serves and is tracked by git; the root
// assets/ is the SOURCE that extract_site.js copies from and is NOT tracked. Writing only dist/ means
// the next rebuild silently deletes these files from the deploy; writing only assets/ means they are
// not deployed until someone rebuilds. This project has been bitten by exactly that drift before.
//
// Usage:  node _tools/_launchicons.js <path-to-lumos-launch-icons.json> [--write]
// Dry-run by default: it reports what it WOULD write and touches nothing.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'assets', 'tokens');
const DIST_DIR = path.join(ROOT, 'dist', 'assets', 'tokens');
const MANIFEST = 'launchpad-icons.json';

// Only formats a browser will actually render as a token icon, and only ones the launchpad accepts.
const EXT = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/avif': 'avif', 'image/svg+xml': 'svg',
};
// A SEP-1 image is fetched by wallets and explorers; a multi-megabyte data blob would be rude to them
// and slow for us. The launchpad has no size limit today, so enforce one here rather than publish it.
const MAX_BYTES = 512 * 1024;
const KEY_RE = /^([A-Za-z0-9]{1,12})-(G[A-Z2-7]{55})$/;

function parseDataUri(u) {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(String(u || ''));
  if (!m) return null;
  const mime = m[1].toLowerCase();
  const ext = EXT[mime];
  if (!ext) return { err: 'unsupported type ' + mime };
  let buf;
  try {
    buf = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8');
  } catch (e) { return { err: 'undecodable payload' }; }
  if (!buf.length) return { err: 'empty payload' };
  if (buf.length > MAX_BYTES) return { err: 'too large (' + Math.round(buf.length / 1024) + ' KB)' };
  return { ext, buf };
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const input = args.filter((a) => a !== '--write')[0];
  if (!input) {
    console.error('usage: node _tools/_launchicons.js <lumos-launch-icons.json> [--write]');
    process.exit(2);
  }

  let map;
  try { map = JSON.parse(fs.readFileSync(input, 'utf8')); }
  catch (e) { console.error('cannot read ' + input + ': ' + e.message); process.exit(2); }
  if (!map || typeof map !== 'object' || Array.isArray(map)) {
    console.error('expected a { "CODE-ISSUER": "data:..." } object'); process.exit(2);
  }

  const manifest = {};
  const skipped = [];
  const planned = [];

  for (const key of Object.keys(map)) {
    const km = KEY_RE.exec(key);
    if (!km) { skipped.push(key + ' -> key is not CODE-GISSUER'); continue; }
    const got = parseDataUri(map[key]);
    if (!got) { skipped.push(key + ' -> not a data: URI (already a URL?)'); continue; }
    if (got.err) { skipped.push(key + ' -> ' + got.err); continue; }
    const name = key + '.' + got.ext;
    planned.push({ key, name, buf: got.buf });
    manifest[key] = '/assets/tokens/' + name;
  }

  planned.sort((a, b) => a.key.localeCompare(b.key));
  for (const p of planned) console.log('  ' + (write ? 'write' : 'would write') + '  ' + p.name + '  (' + Math.round(p.buf.length / 1024) + ' KB)');
  for (const s of skipped) console.log('  SKIP   ' + s);
  console.log(planned.length + ' icon(s), ' + skipped.length + ' skipped');

  if (!planned.length) { console.log('nothing to do'); return; }
  if (!write) { console.log('\ndry run — re-run with --write to actually write'); return; }

  for (const dir of [SRC_DIR, DIST_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
    for (const p of planned) fs.writeFileSync(path.join(dir, p.name), p.buf);
    // The manifest is what functions/.well-known/stellar.toml.js reads, so an icon can never be
    // published in the toml unless the file it names was written in the same run.
    fs.writeFileSync(path.join(dir, MANIFEST), JSON.stringify(manifest, null, 2) + '\n');
  }
  console.log('\nwrote ' + planned.length + ' icon(s) + ' + MANIFEST + ' to:\n  ' + SRC_DIR + '\n  ' + DIST_DIR);
}

main();
