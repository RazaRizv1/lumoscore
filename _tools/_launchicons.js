// Give every LumosCore mint a logo this site actually hosts.
//
// WHERE THE LOGOS COME FROM. Each token has an X account whose profile picture IS its logo. That is how
// they appeared in the app before and why they vanished: nothing ever saved the image, so the moment the
// URL holding it went stale the rows fell back to coloured letter tiles. Confirmed against the user's own
// screenshots -- REKT's green croc and TDT's tool-stamped coin come back byte-for-byte from X.
//
// This script DOWNLOADS them and writes real files. It deliberately does not hotlink: a hotlinked avatar
// breaks when the account renames, is rate-limited by the host, and leaks every visitor's IP to X.
//
// It also emits assets/tokens/launchpad-icons.json, the manifest functions/.well-known/stellar.toml.js
// reads, so an image can only be published in our SEP-1 document if the file it names was written here.
//
// Input: a JSON object of CODE -> source, where source is any of
//     "https://x.com/<handle>"  |  "@<handle>"  |  "<handle>"   -> the account's profile picture
//     "https://.../logo.png"                                    -> that image
//     "data:image/png;base64,..."                               -> that image
//     { "source": <any of the above>, "name": "Liberator" }     -> that image, plus a display name
//
// The NAME matters as much as the image. SEP-1 lets a [[CURRENCIES]] entry carry name= alongside code=,
// and without it every wallet and explorer shows a bare ticker. Nothing upstream knows these names --
// stellar.expert has no tomlInfo for our assets at all -- so they can only come from us.
//
// Usage:  node _tools/_launchicons.js <sources.json> [--write]
// Dry-run by default: it reports what it WOULD write and touches nothing.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'assets', 'tokens');
const DIST_DIR = path.join(ROOT, 'dist', 'assets', 'tokens');
const MANIFEST = 'launchpad-icons.json';

const EXT = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/avif': 'avif', 'image/svg+xml': 'svg',
};
// A SEP-1 image is fetched by wallets and explorers; a multi-megabyte file would be rude to them.
const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 20000;

// The issuer is not optional decoration: an asset is CODE+ISSUER, and a file named for the code alone
// would silently attach a logo to anyone else's token of the same ticker.
function issuerMap() {
  const lib = fs.readFileSync(path.join(ROOT, '_tools', 'lib.js'), 'utf8');
  const out = new Map();
  for (const m of lib.matchAll(/"([A-Za-z0-9]{1,12})\|(G[A-Z2-7]{55})":"lumoscore\.com"/g)) out.set(m[1], m[2]);
  return out;
}

// Resolve a code we do not already know by asking Horizon which issuer declares our domain. Anything
// ambiguous is reported rather than guessed.
async function findIssuer(code) {
  try {
    const r = await fetch('https://horizon.stellar.org/assets?asset_code=' + encodeURIComponent(code) + '&limit=200',
      { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!r.ok) return null;
    const recs = ((await r.json())._embedded || {}).records || [];
    const mine = recs.filter((x) => String(x.asset_issuer || '') && x.amount !== '0.0000000');
    for (const rec of mine) {
      const a = await fetch('https://horizon.stellar.org/accounts/' + rec.asset_issuer,
        { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!a.ok) continue;
      const acc = await a.json();
      if (String(acc.home_domain || '').toLowerCase() === 'lumoscore.com') return rec.asset_issuer;
    }
  } catch (e) { /* fall through */ }
  return null;
}

function handleOf(src) {
  const s = String(src || '').trim();
  let m = /^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/@?([A-Za-z0-9_]{1,15})/i.exec(s);
  if (m) return m[1];
  m = /^@([A-Za-z0-9_]{1,15})$/.exec(s);
  if (m) return m[1];
  if (/^[A-Za-z0-9_]{1,15}$/.test(s)) return s;
  return null;
}

async function grab(src) {
  const s = String(src || '').trim();

  if (s.startsWith('data:')) {
    const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(s);
    if (!m) return { err: 'malformed data URI' };
    const ext = EXT[m[1].toLowerCase()];
    if (!ext) return { err: 'unsupported type ' + m[1] };
    try {
      const buf = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8');
      return buf.length ? { ext, buf } : { err: 'empty payload' };
    } catch (e) { return { err: 'undecodable payload' }; }
  }

  const handle = handleOf(s);
  // fallback=false makes the resolver 404 rather than hand back a generic silhouette -- a placeholder
  // published as a token's logo is worse than no logo, because it looks deliberate.
  const url = handle ? 'https://unavatar.io/x/' + handle + '?fallback=false'
    : (/^https?:\/\//.test(s) ? s : null);
  if (!url) return { err: 'not a handle, URL or data URI' };

  try {
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!r.ok) return { err: 'HTTP ' + r.status + (handle ? ' (no profile picture for @' + handle + ')' : '') };
    const ct = String(r.headers.get('content-type') || '').split(';')[0].toLowerCase();
    const ext = EXT[ct];
    if (!ext) return { err: 'served ' + (ct || 'no content-type') + ', not an image' };
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length) return { err: 'empty response' };
    if (buf.length > MAX_BYTES) return { err: 'too large (' + Math.round(buf.length / 1024) + ' KB)' };
    return { ext, buf, from: url };
  } catch (e) { return { err: 'fetch failed: ' + (e.message || e) }; }
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const input = args.filter((a) => a !== '--write')[0];
  if (!input) {
    console.error('usage: node _tools/_launchicons.js <sources.json> [--write]');
    process.exit(2);
  }

  let sources;
  try { sources = JSON.parse(fs.readFileSync(input, 'utf8')); }
  catch (e) { console.error('cannot read ' + input + ': ' + e.message); process.exit(2); }

  const known = issuerMap();
  const planned = [];
  const skipped = [];

  for (const code of Object.keys(sources)) {
    let issuer = known.get(code);
    if (!issuer) {
      issuer = await findIssuer(code);
      if (issuer) console.log('  resolved issuer for ' + code + ' -> ' + issuer);
    }
    if (!issuer) { skipped.push(code + ' -> no issuer on lumoscore.com found; add it to _tools/lib.js'); continue; }

    const raw = sources[code];
    const spec = (raw && typeof raw === 'object') ? raw : { source: raw };
    const got = await grab(spec.source);
    if (got.err) { skipped.push(code + ' -> ' + got.err); continue; }
    planned.push({ code, issuer, file: code + '-' + issuer + '.' + got.ext, buf: got.buf,
      title: typeof spec.name === 'string' ? spec.name.trim() : '', from: got.from || 'inline' });
  }

  planned.sort((a, b) => a.code.localeCompare(b.code));
  for (const p of planned) {
    console.log('  ' + (write ? 'write' : 'would write') + '  ' + p.code.padEnd(12)
      + String(Math.round(p.buf.length / 1024)).padStart(4) + ' KB  ' + p.file
      + (p.title ? '   name="' + p.title + '"' : ''));
  }
  for (const s of skipped) console.log('  SKIP   ' + s);
  console.log(planned.length + ' icon(s), ' + skipped.length + ' skipped');

  if (!planned.length) { console.log('nothing to do'); return; }
  if (!write) { console.log('\ndry run — re-run with --write to actually write'); return; }

  // Merge with any manifest already on disk so a partial run never deletes previously published icons.
  const manifest = {};
  try { Object.assign(manifest, JSON.parse(fs.readFileSync(path.join(SRC_DIR, MANIFEST), 'utf8'))); } catch (e) {}
  // An entry is {image, name} when we know a display name, and a bare path otherwise. The toml Function
  // accepts both, so older entries written before names existed keep working untouched.
  // ?v=<content hash>. The image files ARE immutable-cached for a year, which is right for a file whose
  // bytes never change -- but a logo REPLACED at the same path is then pinned for a year too, which is
  // what happened when POTATO's flames avatar was swapped for the real artwork. The hash changes with the
  // bytes, so a replacement gets a new URL and a re-fetch, while an unchanged file keeps its cache.
  for (const p of planned) {
    const v = crypto.createHash('sha1').update(p.buf).digest('hex').slice(0, 8);
    const path_ = '/assets/tokens/' + p.file + '?v=' + v;
    manifest[p.code + '-' + p.issuer] = p.title ? { image: path_, name: p.title } : path_;
  }

  // BOTH directories, deliberately. dist/ is what Cloudflare serves and is tracked by git; the root
  // assets/ is the SOURCE extract_site.js copies from and is not tracked. Writing only dist/ means the
  // next rebuild silently deletes these; writing only assets/ means they are never deployed.
  for (const dir of [SRC_DIR, DIST_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
    for (const p of planned) fs.writeFileSync(path.join(dir, p.file), p.buf);
    fs.writeFileSync(path.join(dir, MANIFEST), JSON.stringify(manifest, null, 2) + '\n');
  }
  console.log('\nwrote ' + planned.length + ' icon(s) + ' + MANIFEST + ' to:\n  ' + SRC_DIR + '\n  ' + DIST_DIR);
  console.log('manifest now publishes ' + Object.keys(manifest).length + ' asset(s)');
}

main().catch((e) => { console.error(e); process.exit(1); });
