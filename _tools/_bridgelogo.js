// The Aptos logo that flashes on the cross-chain page before Stellar's paints.
//
// RAZA 2026-10-11: "There's a flash bug on cross chain page. it shows aptos logo for split seconds
// when i refresh."
//
// WHY IT FLASHES, and why none of the three existing defences stop it:
//
//  1. The design bakes its network mark into the markup as an INLINE base64 webp. A data URI needs no
//     network request, so it is on screen the moment the HTML parses — before any script runs. There
//     is no load event to hook and nothing to be "too slow"; the wrong logo is simply what the page
//     IS until something rewrites it.
//
//  2. There is already an anti-flash gate, and somebody already aimed it at this exact image:
//       html:not(.lx-chainready) img[src^="data:image/webp;base64,UklGRgwJ…"]{visibility:hidden}
//     It opens too early. _mc_engine.js adds `lx-chainready` immediately after adoptChain() and only
//     then schedules reskin at 300/1200/3000ms, so the gate lifts BEFORE the logo is corrected. A
//     gate that opens on "the chain is decided" cannot protect a node repainted after that.
//
//  3. _cctp.js walks `.br-netchip` and would set the right PNG — except it resolves the icon through
//     `LX_NETMAP[name]`, and LX_NETMAP has no `Stellar` key at all. `if (key)` is false, apply() never
//     runs, and that whole path is dead for the source chip. (Not fixed here: adding Stellar to that
//     map would make it fetch /assets/networks/stellar.png, which does not exist.)
//
// So the fix is the one the flash pattern calls for first — MARKUP, not a gate. Replace the baked
// webp with Stellar's own SVG at build time and the first paint is already correct, which makes the
// timing of every script above irrelevant.
//
// SCOPE IS THE BRIDGE PAGE, BY RAZA'S CHOICE. The same webp appears 457 times across the Stellar
// container — it is the design's generic network mark, not a bridge asset — and rewriting all of them
// is a large change to pages nobody has reported a problem with. Offered and declined in favour of
// the contained fix; if the flash turns up elsewhere, widen the key filter below, not the method.
//
// The replacement string is the SAME one _tools/_makechains.js uses (_chainassets.json → stellarSvg),
// so there is one definition of "Stellar's logo" and this cannot drift away from the showcase build.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);
const A = require(__dirname + '/_chainassets.json');

// Matching on a PREFIX, not the whole 9KB data URI: the container stores these inside a JSON string,
// and an exact full-string compare is one escaping change away from silently matching nothing. The
// prefix is long enough to be unique to this image (verified: it appears on no other data URI in the
// container) and short enough to survive re-encoding.
const APTOS_PREFIX = 'UklGRgwJAABXRUJQVlA4WAoAAAAQAAAAXwAAXwAAQUxQSGMDAAAB';
const svgURI = (svg) => 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64');
const STELLAR = svgURI(A.stellarSvg);

if (!A.stellarSvg) { console.error('  ! _chainassets.json has no stellarSvg — aborting'); process.exit(1); }

// Replace every `src="data:image/webp;base64,<APTOS_PREFIX>…"` with the Stellar SVG. The value runs to
// the closing quote, so the end is unambiguous without parsing base64.
function swap(h) {
  let count = 0;
  const out = h.replace(/src=\\?"data:image\/webp;base64,([A-Za-z0-9+/=]+)\\?"/g, (m, b64) => {
    if (b64.indexOf(APTOS_PREFIX) !== 0) return m;      // a different webp: leave it alone
    count++;
    // Keep whatever escaping the original used, so the JSON string stays valid either way.
    const esc = m.indexOf('\\"') === 0 || m.indexOf('=\\"') > 0 ? '\\"' : '"';
    return 'src=' + esc + STELLAR + esc;
  });
  return { h: out, count };
}

let pages = 0, swaps = 0, files = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = 'lumoscore-aptos-' + dev + '.html';
  let data;
  try { data = read(file); } catch (e) { console.error('  ' + file + ': missing — skipped'); continue; }
  const { json, s, e } = getContents(data);
  let touched = 0;
  for (const k of Object.keys(json)) {
    if (!/bridge/.test(k)) continue;
    const r = swap(json[k]);
    if (r.count) { json[k] = r.h; pages++; swaps += r.count; touched++; }
  }
  files++;
  if (!touched) { console.log('  ' + file + ': bridge pages already clean'); continue; }
  const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
  fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  console.log('  ' + file + ': ' + touched + ' bridge page key(s) rewritten');
}

console.log('bridge logo: ' + swaps + ' Aptos mark(s) replaced with Stellar on ' + pages
  + ' page key(s) across ' + files + ' container(s)');
// Idempotent by construction: after a run there is no Aptos webp left on these keys, so a re-run
// reports 0 and changes nothing. That is a pass, not a failure — only a MISSING container is fatal.
if (!files) { console.error('  ! no container was read'); process.exit(1); }
