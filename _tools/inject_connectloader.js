// Wrap the wallet-connect "Connecting…" wallet icon in a cinematic Higgsfield
// energy-core video stage (assets/connect-loop.mp4). CSS lives in extract_site runtime.
// Idempotent. Usage: node _tools/inject_connectloader.js [--write]
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const OLD = '<div class="lxw-cwallet"><span class="lxw-cwallet-ico"></span><span class="lxw-ring"></span></div>';
const NEW = '<div class="lxw-cstage"><video class="lxw-cvid" src="assets/connect-loop.mp4" autoplay loop muted playsinline></video>'
          + '<div class="lxw-cwallet"><span class="lxw-cwallet-ico"></span><span class="lxw-ring"></span></div></div>';
// sign-in full-screen boot loader orb (flame in pulsing circle) -> Higgsfield energy-core orb
const OLD2 = '<div class="lorb"><span class="glow"></span><span class="disc"></span><span class="pw"></span><span class="pw"></span><span class="pw"></span><span class="flame lumos-mark"></span></div>';
const NEW2 = '<div class="lorb"><video class="lorb-vid" src="assets/connect-loop.mp4" autoplay loop muted playsinline></video><span class="flame lumos-mark"></span></div>';
const PAIRS = [[OLD, NEW, 'lxw-cstage'], [OLD2, NEW2, 'lorb-vid']];

const chains = ['aptos','hedera','starknet','vechain','worldchain'];
const files = [];
for (const c of chains){ files.push(`lumoscore-${c}-desktop.html`, `lumoscore-${c}-mobile.html`); }
const write = process.argv.includes('--write');
for (const file of files){
  const data = read(file);
  const { json, s, e } = getContents(data);
  let n = 0;
  for (const k of Object.keys(json)){
    let h = json[k], hit = false;
    for (const [oldStr, newStr, marker] of PAIRS){
      if (h.indexOf(oldStr) >= 0 && h.indexOf(marker) < 0){ h = h.split(oldStr).join(newStr); hit = true; }
    }
    if (hit){ json[k] = h; n++; }
  }
  if (write && n){
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
  console.log(`${write?'[WROTE]':'[DRY]'} ${file}: injected loader into ${n} pages`);
}
