'use strict';
// ADMIN SPEED A01 (2026-11-21): admin pages carried public-site scripts they never use -- the Stellar pools engine
// (lx-ammdata, 336 KB, also fires /lxapi/xlm, poolstats, pools and stellar.expert calls), the public wallet layer
// (lx-realconnect, 69 KB, which also loads the 450 KB WalletConnect client), the design's Aptos connect-wallet popup,
// the desktop network switcher, the chain chooser (lx-mc) and the pool-cache warmer. Admin code references none of
// their globals (measured), and the admin signs Rewards with its own Freighter/Rabet/GemWallet signers.
// Removes whole <script>/<style> blocks by id (or by a unique opening comment). Idempotent.
// Runs before every admin deploy (package.json predeploy:admin), in place: node _tools/admin_strip.js dist-admin dist-admin
// Without it, any admin rebuild that re-runs the public transforms brings these blocks back.
const fs = require('fs'), path = require('path');
const BY_ID = ['lx-ammdata', 'lx-realconnect', 'lx-realconnect-css', 'lx-mc', 'lx-mc-css', 'lx-poolwarm'];
const BY_HEAD = [
  '/* LumosCore connect-wallet modal — Aptos, self-contained.',
  '/* LumosCore network switcher (desktop) */',
];
const [, , inDir, outDir, flag] = process.argv;
const dry = flag === '--dry';
let total = 0;
for (const f of fs.readdirSync(inDir).filter((x) => /^lumoscore-admin-.*\.html$/.test(x))) {
  let s = fs.readFileSync(path.join(inDir, f), 'utf8');
  const before = s.length, gone = [];
  s = s.replace(/<(script|style)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (whole, t, attrs, body) => {
    const id = (/\bid=["']?([^"' >]+)/.exec(attrs) || [])[1] || '';
    const head = body.trimStart();
    if (BY_ID.includes(id) || BY_HEAD.some((h) => head.startsWith(h))) { gone.push(id || head.slice(0, 28)); return ''; }
    return whole;
  });
  total += before - s.length;
  console.log(f.padEnd(44) + Math.round(before / 1024) + 'K -> ' + Math.round(s.length / 1024) + 'K  removed ' + gone.length + ': ' + gone.join(', '));
  if (!dry) { fs.mkdirSync(outDir, { recursive: true }); fs.writeFileSync(path.join(outDir, f), s); }
}
console.log('total removed ' + Math.round(total / 1024) + 'K' + (dry ? ' (dry)' : ''));
