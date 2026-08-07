// Revert the video-orb loader changes back to the originals.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);
const OLD  = '<div class="lxw-cwallet"><span class="lxw-cwallet-ico"></span><span class="lxw-ring"></span></div>';
const NEW  = '<div class="lxw-cstage"><video class="lxw-cvid" src="assets/connect-loop.mp4" autoplay loop muted playsinline></video>'
           + '<div class="lxw-cwallet"><span class="lxw-cwallet-ico"></span><span class="lxw-ring"></span></div></div>';
const OLD2 = '<div class="lorb"><span class="glow"></span><span class="disc"></span><span class="pw"></span><span class="pw"></span><span class="pw"></span><span class="flame lumos-mark"></span></div>';
const NEW2 = '<div class="lorb"><video class="lorb-vid" src="assets/connect-loop.mp4" autoplay loop muted playsinline></video><span class="flame lumos-mark"></span></div>';
const chains = ['aptos','hedera','starknet','vechain','worldchain'];
const files = [];
for (const c of chains){ files.push(`lumoscore-${c}-desktop.html`, `lumoscore-${c}-mobile.html`); }
for (const file of files){
  const data = read(file);
  const { json, s, e } = getContents(data);
  let n = 0;
  for (const k of Object.keys(json)){
    let h = json[k];
    if (h.indexOf(NEW) >= 0){ h = h.split(NEW).join(OLD); n++; }
    if (h.indexOf(NEW2) >= 0){ h = h.split(NEW2).join(OLD2); n++; }
    json[k] = h;
  }
  const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
  fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  console.log(`${file}: reverted ${n}`);
}
