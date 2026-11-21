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
// PHONES GET THE PHONE PAGES (C01, 2026-11-21). Every admin page exists as a -mobile build, but nothing sent a phone
// there: the public site's device swap works through its middleware, and the admin has none for its pages. This runs
// first thing in <head> of every non-mobile admin page: on a screen narrower than 768 px it replaces the location with
// the same page's -mobile build (query and hash kept; -dark dropped), before the 800 KB desktop page does any work.
// The -mobile pages link only to -mobile pages, so it fires once per visit. ?desktop=1 sets a one-year cookie that
// turns it off on that device.
const MOBILE_REDIRECT = '<script id="lx-admmob">(function(){try{'
  + 'var p=location.pathname;if(/-mobile(\\.html)?$/.test(p))return;'
  + 'if(/[?&]desktop=1(&|$)/.test(location.search)){document.cookie="lxadmdev=d;path=/;max-age=31536000;samesite=lax";return;}'
  + 'if(/(?:^|; )lxadmdev=d/.test(document.cookie||""))return;'
  + 'var sw=(window.screen&&window.screen.width)||9999;if(sw>=768)return;'
  + 'var m=p.replace(/\\.html$/,"").replace(/-dark$/,"");if(!/^\\/lumoscore-admin-[a-z-]+$/.test(m))return;'
  + 'location.replace(m+"-mobile"+location.search+location.hash);'
  + '}catch(_){}})();</' + 'script>';
const [, , inDir, outDir, flag] = process.argv;
const dry = flag === '--dry';
let total = 0, redirects = 0;
for (const f of fs.readdirSync(inDir).filter((x) => /^lumoscore-admin-.*\.html$/.test(x))) {
  let s = fs.readFileSync(path.join(inDir, f), 'utf8');
  const before = s.length, gone = [];
  s = s.replace(/<(script|style)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (whole, t, attrs, body) => {
    const id = (/\bid=["']?([^"' >]+)/.exec(attrs) || [])[1] || '';
    const head = body.trimStart();
    if (BY_ID.includes(id) || BY_HEAD.some((h) => head.startsWith(h))) { gone.push(id || head.slice(0, 28)); return ''; }
    return whole;
  });
  if (!/-mobile\.html$/.test(f) && s.indexOf('id="lx-admmob"') < 0) {
    const h = /<head\b[^>]*>/i.exec(s);
    if (h) { s = s.slice(0, h.index + h[0].length) + MOBILE_REDIRECT + s.slice(h.index + h[0].length); redirects++; }
  }
  total += before - s.length;
  console.log(f.padEnd(44) + Math.round(before / 1024) + 'K -> ' + Math.round(s.length / 1024) + 'K  removed ' + gone.length + ': ' + gone.join(', '));
  if (!dry) { fs.mkdirSync(outDir, { recursive: true }); fs.writeFileSync(path.join(outDir, f), s); }
}
console.log('total removed ' + Math.round(total / 1024) + 'K, phone redirect added to ' + redirects + ' page(s)' + (dry ? ' (dry)' : ''));
